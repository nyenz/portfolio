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
import { sonarJump } from './fx/transitions.js';
import { createHud } from './ui/hud.js';
import { createCursor } from './ui/cursor.js';
import { createSound } from './ui/sound.js';
import { createLoader } from './ui/loader.js';
import { initHoverScramble, scramble } from './ui/scramble.js';
import { createReactiveText } from './ui/reactiveText.js';
import { createDossier } from './ui/dossier.js';
import { createSquid } from './creatures/squid.js';
import { createPortrait } from './scenes/portrait.js';
import { createJellyfish } from './scenes/jellyfish.js';
import { createArchive } from './scenes/archive.js';
import { createAbyss } from './scenes/abyss.js';
import { createCore } from './scenes/core.js';
import { createPresentation } from './ui/presentation.js';
import { smooth as sm, toScreen } from './scenes/util.js';

const params = new URLSearchParams(location.search);
const SKIP_INTRO = params.has('skipintro');
if (params.has('test')) gsap.ticker.lagSmoothing(0);

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

  // ---- creatures ----
  const squid = createSquid();
  squid.group.scale.setScalar(1.25);
  scene.add(squid.group);
  const squidAnchor = new THREE.Vector3();
  const portrait = createPortrait({ count: quality.name === 'high' ? 14000 : quality.name === 'med' ? 9000 : 5000, renderer });
  const jellies = createJellyfish();
  let presentation = null;
  const archive = createArchive({ onOpen: (i) => presentation && presentation.show(i) });
  const abyss = createAbyss({ quality, renderer });
  const core = createCore({ quality });
  const scenes = [portrait, jellies, archive, abyss, core];
  scenes.forEach((sc) => scene.add(sc.group));

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
  const words = createReactiveText();
  const dossier = createDossier({ lenis, sound });
  presentation = createPresentation({ lenis, sound, archive });
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
  LENS.uniforms.uLid.value = 1;
  LENS.uniforms.uWobble.value = reducedMotion ? 0 : 1;
  LENS.uniforms.uGrain.value = isTouch ? 0.026 : 0.034;

  // ---- frame loop ----
  let last = performance.now(), time = 0, torchWake = 0.35, lastX = 0;
  const scrP = {}, darkBase = { v: 0 };
  void sm;
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

    // hero squid: lives in the sunlit zone, swims up and away as you dive
    const heroOn = scroll.x < 1.3;
    squid.group.visible = heroOn;
    if (heroOn) {
      const narrow = innerWidth / innerHeight < 0.8;
      squidAnchor.set(narrow ? -0.1 : 0.85, camera.position.y + (narrow ? 2.3 : -0.2), narrow ? -7.4 : -5.0);
      squidAnchor.x += camera.position.x;
      squid.update(dt, {
        anchor: squidAnchor, camera, idle: input.idle, pointerX: input.sx, pointerY: input.sy,
        pointerPx: input.px, pointerPy: input.py, pointerSpeed: input.speed,
        exit: Math.min(Math.max((scroll.x - 0.2) / 0.85, 0), 1),
      });
      U.uFlow.value.y -= squid.flow() * dt * 0.55;     // specks stream down past the swimming squid
    }

    // the scenes along the dive
    const S = { x: scroll.x, time, camera, input, scroll };
    for (const sc of scenes) sc.update(dt, S);

    // scroll-scrubbed transitions between scenes (they all play backwards too)
    if (!loading) {
      const L = LENS.uniforms, x = scroll.x;
      // ink burst: the squid jets and squirts ink (hero -> about)
      const inkP = Math.min(Math.max((x - 0.6) / 0.5, 0), 1) * 2;
      if (x > 0.6 && lastX <= 0.6) { squid.state.jet = 1; sound.ping(0.7); }
      L.uInk.value = x > 0.6 && x < 1.1 ? inkP : 0;
      if (squid.group.visible) { toScreen(squid.group.position, camera, scrP); L.uInkC.value.set(scrP.x / innerWidth, 1 - scrP.y / innerHeight); }
      // pressure glitch (experience -> archive)
      const g = Math.max(0, 1 - Math.abs(x - 2.97) / 0.15);
      L.uGlitch.value = g * g * (reducedMotion ? 0.3 : 1);
      // glass shatter (archive -> abyss)
      if (x > 3.82 && x < 4.0) { L.uShatter.value = (x - 3.82) / 0.18; if (lastX <= 3.82) sound.ping(0.55); }
      else L.uShatter.value = 0;
      const after = x >= 4.0 && x < 4.14 ? 1 - (x - 4.0) / 0.14 : 0;
      L.uDark.value = Math.max(after * 0.9, darkBase.v);
      // zoom into a speck (abyss -> core)
      L.uZoom.value = Math.max(0, 1 - Math.abs(x - 5.08) / 0.16) * (reducedMotion ? 0.25 : 0.9);
      lastX = x;
    }

    hud.update(scroll, (z) => { sound.ping(1 - z * 0.06); }, core.scaleText(scroll));
    cursor.update(dt);
    words.update(dt, time, scroll.velocity);
    sound.setDepth(scroll.depth);

    post.bloom.strength = envState.bloom * (isTouch ? 0.85 : 1);
    LENS.uniforms.uTime.value = time;
    LENS.uniforms.uVel.value = scroll.velocity;
    post.composer.render(dt);
    if (loading) loader.render(time, dt);
  });

  // debug handle for testing
  window.__dive = { scroll, input, U, quality, jump, LENS, dossier, squid, archive, presentation };

  if (SKIP_INTRO) {
    loading = false;
    document.getElementById('loader')?.remove();
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
    rig.intro.value = 1;
    lenis.start();
    return;
  }

  // ---- the intro: one choreographed timeline (gentle build -> glide in -> dive through a particle) ----
  const L = LENS.uniforms;
  L.uLid.value = 1;
  L.uDark.value = 1;                       // ocean waits in the dark behind the helix
  rig.intro.value = 0;
  const label = document.querySelector('.loader__label');
  const S = loader.state, LU = loader.uniforms;

  // let one frame of the loader show, then compile all shaders before the timeline starts
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  renderer.compile(scene, camera);
  last = performance.now();
  const ready = Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);

  const tl = gsap.timeline({ paused: true });
  const slow = reducedMotion ? 0.5 : 1;
  tl.to(LU.uP, { value: 0.96, duration: 4.8 * slow, ease: 'sine.inOut' }, 0)
    .to(S, { dolly: 1, duration: 6.2 * slow, ease: 'sine.inOut' }, 0)
    .addLabel('built')
    .add(() => scramble(label, 'READY', 500))
    .to(LU.uP, { value: 1.12, duration: 0.9, ease: 'sine.out' }, 'built')            // a light sweep runs up the helix
    .to(LU.uGlow, { value: 0.6, duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 'built')
    .to(S, { spin: 0.04, duration: 1.4, ease: 'sine.inOut' }, 'built')
    .addLabel('dive', 'built+=1.0')
    .add(() => loader.done(), 'dive')
    .to(S, { dive: 1, duration: 2.6 * slow, ease: 'none' }, 'dive')
    .to(L.uDark, { value: 0, duration: 1.9, ease: 'sine.out' }, 'dive+=1.2')
    .fromTo(L.uZoom, { value: 0 }, { value: 1, duration: 1.0, ease: 'power2.in' }, 'dive+=1.0')
    .to(L.uZoom, { value: 0, duration: 1.8, ease: 'power2.out' }, 'dive+=2.0')
    .fromTo(L.uExpo, { value: 0 }, { value: 0.35, duration: 0.5, ease: 'sine.in' }, 'dive+=1.9')
    .to(L.uExpo, { value: 0, duration: 1.6, ease: 'sine.out' }, 'dive+=2.4')
    .to(LU.uFade, { value: 1, duration: 0.9, ease: 'sine.in' }, 'dive+=1.8')
    .to(rig.intro, { value: 1, duration: 3.2, ease: 'power3.out' }, 'dive+=1.6')
    .add(() => finish(), 'dive+=2.3')
    .add(() => { loading = false; loader.dispose(); }, 'dive+=2.9');

  // hold just before the end of the build until the fonts are ready
  window.__dive.intro = tl;
  if (params.has('tl')) { tl.pause(); } else tl.play();
  let isReady = false;
  ready.then(() => { isReady = true; });
  tl.eventCallback('onUpdate', () => {
    if (!isReady && tl.time() > tl.labels.built - 0.05) { tl.pause(); ready.then(() => tl.play()); }
  });

  // tap / click / any key skips ahead to the dive
  const skipBtn = document.querySelector('.loader__skip');
  const skip = () => { if (tl.time() < tl.labels.dive) { tl.timeScale(1); tl.seek('dive'); } skipBtn?.remove(); };
  skipBtn?.addEventListener('click', skip);
  addEventListener('keydown', function k(e) { if (loading && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) skip(); if (!loading) removeEventListener('keydown', k); });

  function finish() {
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
    if (SKIP_INTRO) { L.uDark.value = 0; rig.intro.value = 1; }
    setTimeout(() => lenis.start(), SKIP_INTRO ? 0 : 900);
  }
}

boot();
