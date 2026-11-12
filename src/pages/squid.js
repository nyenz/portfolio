import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './squid.css';
import { U, updateEnv, envState } from '../world/env.js';
import { createWater } from '../world/water.js';
import { createParticles } from '../world/particles.js';
import { createShafts } from '../world/shafts.js';
import { createPost, LENS } from '../fx/post.js';
import { quality, isTouch } from '../core/quality.js';
import { createSquid } from '../creatures/squid2.js';

// Squid study page: the hero squid on its own, in open sunlit water, with free look-around.
const cfg = quality.cfg;
const canvas = document.getElementById('sq-world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const dpr = Math.min(devicePixelRatio, cfg.dpr);
renderer.setPixelRatio(dpr);
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.05, 400);
const DEPTH_Y = -18;
const target = new THREE.Vector3(0, DEPTH_Y, 0);
camera.position.set(0.5, DEPTH_Y + 0.3, 6.2);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(target);
controls.enableDamping = true; controls.dampingFactor = 0.06;
controls.enablePan = false; controls.minDistance = 3; controls.maxDistance = 14;
controls.autoRotate = !new URLSearchParams(location.search).has('still'); controls.autoRotateSpeed = 0.35;
canvas.addEventListener('pointerdown', () => { controls.autoRotate = false; });

const water = createWater();
const shafts = createShafts(cfg.shafts);
const far = createParticles('far', Math.round(cfg.far * 0.6));
const mid = createParticles('mid', cfg.mid);
const near = createParticles('near', cfg.near);
scene.add(water.mesh, shafts.mesh, far.points, mid.points, near.points);

const squid = createSquid();
scene.add(squid.group);

const post = createPost(renderer, scene, camera, cfg);
LENS.uniforms.uLid.value = 1;
LENS.uniforms.uDark.value = 0;
LENS.uniforms.uCA.value = 0.0035;   // a little colour split and softness at the edges

// pointer (for the squid's curiosity and nerves)
const P = { x: 0, y: 0, px: innerWidth / 2, py: innerHeight / 2, speed: 0, idle: 0, lx: 0, ly: 0 };
addEventListener('pointermove', (e) => {
  P.px = e.clientX; P.py = e.clientY;
  P.x = (e.clientX / innerWidth) * 2 - 1; P.y = -((e.clientY / innerHeight) * 2 - 1);
  P.idle = 0;
});

// swim mode buttons
let mode = 'cruise', jetT = 0;
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
  mode = b.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach((o) => o.classList.toggle('is-on', o === b));
  if (mode === 'jet') { squid.state.jet = 1; jetT = 0; }
}));

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  post.resize(innerWidth, innerHeight, dpr);
});

let last = performance.now(), time = 0, pendingT = 0;
const MANUAL = new URLSearchParams(location.search).has('manual');
renderer.setAnimationLoop((now) => {
  // ?manual: time only moves when a test calls __squid.advance(seconds) (for exact frame-by-frame checks)
  let dt = Math.min((now - last) / 1000, 1 / 20);
  if (MANUAL) { dt = 1 / 60; if (pendingT <= 0) { dt = 0; } }
  if (MANUAL && pendingT > 0) {
    while (pendingT > 1e-6) { const h = Math.min(1 / 60, pendingT); pendingT -= h; time += h; U.uTime.value = time;
      squid.update(h, { anchor: target, camera, idle: mode === 'idle' ? 10 : 0, pointerX: 0, pointerY: 0, pointerPx: -1e4, pointerPy: -1e4, pointerSpeed: 0, exit: 0 }); }
    dt = 0;
  }
  last = now; time += dt;
  updateEnv(850);   // dark open water like the reference viewer
  U.uTop.value.set(0x0f4f5e); U.uMid.value.set(0x05303f); U.uDeep.value.set(0x011720); U.uFog.value.set(0x042833);
  U.uTorch.value = 0.04;
  U.uTime.value = time;
  U.uPx.value = innerHeight * dpr / (2 * Math.tan((camera.fov * Math.PI) / 360));
  P.speed = Math.hypot(P.px - P.lx, P.py - P.ly) / Math.max(dt, 1e-3) / 900;
  P.lx = P.px; P.ly = P.py; P.idle += dt;

  if (controls.enabled) controls.update();
  U.uCamPos.value.copy(camera.position);
  water.update(camera); shafts.update(camera);

  if (mode === 'jet') { jetT += dt; if (jetT > 2.4) { squid.state.jet = 1; jetT = 0; } }
  if (dt > 0) squid.update(dt, {
    anchor: target, camera,
    idle: mode === 'idle' ? 10 : 0,
    pointerX: P.x, pointerY: P.y, pointerPx: P.px, pointerPy: P.py, pointerSpeed: P.speed, exit: 0,
  });
  U.uFlow.value.y -= squid.flow() * dt * 1.5; U.uFlow.value.x -= squid.flow() * dt * 0.85;   // the water streams back past it: it is travelling up

  post.bloom.strength = 0.7 * (isTouch ? 0.85 : 1);
  post.bloom.radius = 0.7; post.bloom.threshold = 0.72;   // soft glow that blurs edges (the reference video is soft)   // soft glow like the reference
  LENS.uniforms.uTime.value = time;
  post.composer.render(dt);
});
window.__squid = { squid, camera, controls, target, advance(t) { pendingT += t; },
  view(name) {
    // fixed views to compare against the reference pictures
    const q = squid.group.children[0].quaternion, d = new THREE.Vector3();
    if (name === 'world') { camera.position.set(0.5, DEPTH_Y + 0.3, 6.2); controls.update(); return; }
    const local = { top: [0.12, 1, 0], side: [0.05, 0.12, 1], hero: [0, 0.35, 1], belly: [0, -1, 0.2], front: [-1, 0.2, 0.3] }[name] || [0, 0, 1];
    d.set(...local).normalize().applyQuaternion(q);
    camera.position.copy(target).addScaledVector(d, name === 'hero' ? 7.5 : 5.2);
    controls.update();
  } };
