import './styles.css';
import * as THREE from 'three';
import gsap from 'gsap';
import { quality, createFpsWatch, reducedMotion, isTouch } from './core/quality.js';
import { initInput, updateInput, input } from './core/input.js';
import { initScroll, updateScroll, scroll } from './core/scroll.js';
import { createCameraRig } from './core/camera.js';
import { U, updateEnv, envState } from './world/env.js';
import { createWater } from './world/water.js';
import { createSurface } from './world/surface.js';
import { createParticles } from './world/particles.js';
import { createBubbles } from './world/bubbles.js';
import { createShafts } from './world/shafts.js';
import { createFloor } from './world/floor.js';
import { createPost, LENS } from './fx/post.js';
import { eyesOpen, sonarJump } from './fx/transitions.js';
import { createHud } from './ui/hud.js';
import { createCursor } from './ui/cursor.js';
import { createSound } from './ui/sound.js';
import { createLoader } from './ui/loader.js';
import { initHoverScramble, scramble } from './ui/scramble.js';

const params = new URLSearchParams(location.search);
const SKIP_INTRO = params.has('skipintro');

function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

async function boot() {
  initInput();
  const lenis = initScroll(reducedMotion);
  initHoverScramble();

  if (!webglOk()) {
    document.body.classList.add('no-webgl');
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
    document.getElementById('loader')?.remove();
    const loop = (t) => { lenis.raf(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    return;
  }

  lenis.stop();
  window.scrollTo(0, 0);
  const cfg = quality.cfg;
  const canvas = document.getElementById('world');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
  let dpr = Math.min(devicePixelRatio, cfg.dpr);
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const rig = createCameraRig(reducedMotion);
  const camera = rig.camera;

  // ---- the ocean ----
  const water = createWater();
  const surface = createSurface();
  const shafts = createShafts(cfg.shafts);
  const far = createParticles('far', cfg.far);
  const mid = createParticles('mid', cfg.mid);
  const near = createParticles('near', cfg.near);
  const bubbles = createBubbles(cfg.bubbles);
  const floor = createFloor(cfg.floorSeg);
  scene.add(water.mesh, surface.mesh, shafts.mesh, far.points, mid.points, near.points, bubbles.points, floor.group);

  // the torch: a real light that future creatures will catch
  const torch = new THREE.PointLight(0x9fefff, 0, 9, 1.6);
  scene.add(torch);
  scene.add(new THREE.HemisphereLight(0x9fe8f0, 0x02070a, 0.6));

  const post = createPost(renderer, scene, camera, cfg);
  const loader = createLoader(renderer, quality.name === 'low' ? 0.55 : quality.name === 'med' ? 0.8 : 1);

  const sound = createSound();
  const jump = (t, x, y) => sonarJump(t, x, y, { reduced: reducedMotion, sound });
  const hud = createHud({ onJump: jump });
  const cursor = createCursor();
  const fpsWatch = createFpsWatch();

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    rig.resize();
    post.resize(innerWidth, innerHeight, dpr);
    loader.resize(dpr);
    const h = innerHeight * dpr;
    U.uPx.value = h / (2 * Math.tan((camera.fov * Math.PI) / 360));
  }
  addEventListener('resize', resize);
  resize();

  quality.onChange(() => {
    const c = quality.cfg;
    dpr = Math.min(devicePixelRatio, c.dpr);
    renderer.setPixelRatio(dpr);
    far.setCount(c.far); mid.setCount(c.mid); near.setCount(c.near); bubbles.setCount(c.bubbles);
    resize();
  });

  // ---- intro state ----
  let loading = !SKIP_INTRO;
  LENS.uniforms.uLid.value = SKIP_INTRO ? 1 : 0;
  LENS.uniforms.uWobble.value = reducedMotion ? 0 : 1;
  LENS.uniforms.uGrain.value = isTouch ? 0.026 : 0.034;

  // ---- frame loop ----
  let last = performance.now(), time = 0, torchWake = 0.35;
  renderer.setAnimationLoop((now) => {
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now; time += dt;
    fpsWatch(dt);
    updateScroll(now);
    updateInput(dt, reducedMotion);
    updateEnv(scroll.depth);

    U.uTime.value = time;
    torchWake += ((input.active ? 1 : 0.35) - torchWake) * (1 - Math.exp(-dt * 1.5));
    U.uTorch.value *= torchWake;
    U.uVel.value = scroll.velocity;
    const dir = rig.update(time, dt);
    U.uCamPos.value.copy(camera.position);
    U.uCursorDir.value.copy(dir);
    torch.position.copy(camera.position).addScaledVector(dir, 2.2);
    torch.intensity = U.uTorch.value * 6;

    water.update(camera);
    surface.update(camera);
    shafts.update(camera);
    bubbles.update(camera);
    floor.update(camera);

    hud.update(scroll, (z) => { sound.ping(1 - z * 0.06); });
    cursor.update(dt, time);
    sound.setDepth(scroll.depth);

    post.bloom.strength = envState.bloom * (isTouch ? 0.85 : 1);
    LENS.uniforms.uTime.value = time;
    LENS.uniforms.uVel.value = scroll.velocity;
    post.composer.render(dt);
    if (loading) loader.render(time);
  });

  // debug handle for testing
  window.__dive = { scroll, input, U, quality, jump, LENS };

  if (SKIP_INTRO) {
    loading = false;
    document.getElementById('loader')?.remove();
    finish();
    return;
  }

  // ---- loading: compile everything, wait for fonts, let the helix build ----
  const t0 = performance.now();
  const build = gsap.to(loader.uniforms.uP, { value: 0.9, duration: 2.2, ease: 'power1.inOut' });
  renderer.compile(scene, camera);
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
  const wait = Math.max(0, 2300 - (performance.now() - t0));
  await new Promise((r) => setTimeout(r, wait));
  build.kill();
  await new Promise((r) => gsap.to(loader.uniforms.uP, { value: 1.05, duration: 0.6, ease: 'power2.out', onComplete: r }));
  scramble(document.querySelector('.loader__label'), 'READY', 400);
  await new Promise((r) => setTimeout(r, 350));

  // dissolve the helix into the water while the eyes open
  gsap.to(loader.uniforms.uD, { value: 1, duration: 1.7, ease: 'power1.in', onComplete: () => { loading = false; loader.dispose(); } });
  loader.done();
  setTimeout(finish, 250);

  async function finish() {
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
    setTimeout(() => lenis.start(), SKIP_INTRO ? 0 : 1200);
    if (!SKIP_INTRO) await eyesOpen({ reduced: reducedMotion });
  }
}

boot();
