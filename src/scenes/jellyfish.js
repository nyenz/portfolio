import * as THREE from 'three';
import { U } from '../world/env.js';
import { EXPERIENCE } from '../config/content.js';
import { camYAt, smooth, isNarrow, damp, labelLayer, toScreen, clamp } from './util.js';

// Experience: a column of glowing moon jellies (Aurelia-style: see-through bell, four-leaf
// gonads, frilly oral arms, fine tentacles) drifting past as you sink. Each carries one chapter
// of the timeline. Hovering a jelly makes it pulse faster, glow and lean toward you.
const BELL_VS = /* glsl */`
  uniform float uPhase, uTime;
  varying vec3 vN, vW; varying vec2 vUv;
  float squeeze(float t){ float ph = uPhase - t * 1.3; return 0.17 * pow(max(sin(ph), 0.), 2.); }
  void main(){
    vUv = uv;
    float t = uv.y;                         // 0 apex .. 1 margin
    float a = uv.x * 6.2832;
    vec3 p = position;
    float sq = squeeze(t);
    float r = length(p.xz);
    float nr = r * (1. - sq * (0.4 + 0.8 * t)) + sin(a * 16. + uTime * 2.) * 0.018 * pow(t, 4.);
    p.xz = r > 1e-4 ? p.xz / r * nr : p.xz;
    p.y += sq * 0.22 * t - sq * 0.05;
    vec4 w = modelMatrix * vec4(p, 1.);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const BELL_FS = /* glsl */`
  uniform vec3 uCamPos, uC1, uC2, uFog; uniform float uGlow, uTime, uFogD;
  varying vec3 vN, vW; varying vec2 vUv;
  void main(){
    vec3 V = normalize(uCamPos - vW);
    float fr = pow(1. - abs(dot(normalize(vN), V)), 2.2);
    float t = vUv.y, a = vUv.x * 6.2832;
    float canals = smoothstep(0.92, 1., cos(a * 16.)) * smoothstep(0.25, 0.9, t) * 0.35;
    float ring = smoothstep(0.03, 0., abs(t - 0.86)) * 0.5;
    float clover = smoothstep(0.55, 0.9, cos(2. * a) * 0.5 + 0.5) * smoothstep(0.5, 0.22, t) * smoothstep(0.08, 0.2, t);
    vec3 col = mix(uC1, uC2, t);
    float glow = 1. + uGlow * 1.6;
    vec3 c = col * (0.09 + fr * 0.85 + canals + ring) * glow + vec3(1., 0.55, 0.85) * clover * 0.55 * glow;
    float al = clamp(0.06 + fr * 0.7 + canals * 0.5 + clover * 0.6 + ring * 0.4, 0., 1.);
    float fog = exp(-length(uCamPos - vW) * uFogD * 0.7);
    gl_FragColor = vec4(c * fog, al * fog);
  }`;
const LINE_VS = /* glsl */`
  attribute vec2 aInfo;                     // x: angle (0..1), y: t along (0..1)
  uniform float uPhase, uTime, uLen, uKind;
  varying float vT; varying vec3 vW;
  float squeeze(float t){ float ph = uPhase - t * 1.3; return 0.17 * pow(max(sin(ph), 0.), 2.); }
  void main(){
    float a = aInfo.x * 6.2832, t = aInfo.y;
    vT = t;
    vec3 p;
    if (uKind < 0.5) {                      // tentacles from the bell margin
      float r0 = 1.0 * (1. - squeeze(1.) * 1.2);
      float lag = uPhase - t * 4.;
      p = vec3(cos(a) * r0 * (1. - t * 0.25), -t * uLen, sin(a) * r0 * (1. - t * 0.25));
      p.x += sin(lag + a * 3.) * 0.12 * t + sin(uTime * 0.7 + a) * 0.25 * t * t;
      p.z += cos(lag * 0.9 + a * 2.) * 0.12 * t;
      p.y += squeeze(1.) * 0.3;
    } else {                                // frilly oral arms
      float side = position.x;               // ribbon width offset
      float sway = sin(uTime * 0.9 - t * 3. + a * 2.) * 0.25 * t;
      float tw = t * 4. + a;
      p = vec3(cos(a) * 0.12 + sway, -0.1 - t * uLen, sin(a) * 0.12 + cos(uTime * 0.7 - t * 2.5 + a) * 0.2 * t);
      p += vec3(cos(tw), 0., sin(tw)) * side * (0.08 + 0.05 * sin(t * 40.));
    }
    vec4 w = modelMatrix * vec4(p, 1.);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const LINE_FS = /* glsl */`
  uniform vec3 uC1, uC2, uCamPos; uniform float uGlow, uAlpha, uFogD;
  varying float vT; varying vec3 vW;
  void main(){
    float a = uAlpha * (1. - vT * 0.85) * (1. + uGlow);
    float fog = exp(-length(uCamPos - vW) * uFogD * 0.7);
    gl_FragColor = vec4(mix(uC2, uC1, vT) * a * fog, a * fog);
  }`;

function buildJelly(hueA, hueB) {
  const uni = {
    uPhase: { value: Math.random() * 6 }, uTime: U.uTime, uGlow: { value: 0 },
    uC1: { value: new THREE.Color(hueA) }, uC2: { value: new THREE.Color(hueB) },
    uCamPos: U.uCamPos, uFog: U.uFog, uFogD: U.uFogD,
  };
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 26; i++) { const t = i / 26, phi = t * (Math.PI / 2 + 0.18); pts.push(new THREE.Vector2(Math.sin(phi), Math.cos(phi) * 0.62)); }
  const bellGeo = new THREE.LatheGeometry(pts, 48);
  const bellMat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: BELL_VS, fragmentShader: BELL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const bell = new THREE.Mesh(bellGeo, bellMat);
  g.add(bell);
  // tentacles
  const T = 36, S = 34, tp = [], ti = [];
  for (let i = 0; i < T; i++) for (let j = 0; j < S; j++) {
    tp.push(0, 0, 0, 0, 0, 0); ti.push(i / T, j / S, i / T, (j + 1) / S);
  }
  const tgeo = new THREE.BufferGeometry();
  tgeo.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
  tgeo.setAttribute('aInfo', new THREE.Float32BufferAttribute(ti, 2));
  tgeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);
  const tmat = new THREE.ShaderMaterial({ uniforms: { ...uni, uLen: { value: 2.6 }, uKind: { value: 0 }, uAlpha: { value: 0.35 } }, vertexShader: LINE_VS, fragmentShader: LINE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const tent = new THREE.LineSegments(tgeo, tmat);
  tent.frustumCulled = false;
  g.add(tent);
  // oral arms: 4 ribbons as triangle strips (x = width side)
  const ap = [], ai = [], idx = [];
  const AS = 40;
  for (let k = 0; k < 4; k++) {
    const b = ap.length / 3;
    for (let j = 0; j <= AS; j++) for (const side of [-1, 1]) { ap.push(side, 0, 0); ai.push(k / 4 + 0.125, j / AS); }
    for (let j = 0; j < AS; j++) { const q = b + j * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  }
  const ageo = new THREE.BufferGeometry();
  ageo.setAttribute('position', new THREE.Float32BufferAttribute(ap, 3));
  ageo.setAttribute('aInfo', new THREE.Float32BufferAttribute(ai, 2));
  ageo.setIndex(idx);
  ageo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);
  const amat = new THREE.ShaderMaterial({ uniforms: { ...uni, uLen: { value: 1.5 }, uKind: { value: 1 }, uAlpha: { value: 0.22 } }, vertexShader: LINE_VS, fragmentShader: LINE_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const arms = new THREE.Mesh(ageo, amat);
  arms.frustumCulled = false;
  g.add(arms);
  return { g, uni };
}

export function createJellyfish() {
  const group = new THREE.Group();
  group.visible = false;
  const colors = [['#7ff3ff', '#b08cff'], ['#9fd7ff', '#ff9ad6'], ['#86ffe0', '#7f9cff'], ['#c2a6ff', '#7ff3ff']];
  const jellies = EXPERIENCE.map((e, i) => {
    const j = buildJelly(colors[i % 4][0], colors[i % 4][1]);
    group.add(j.g);
    const side = i % 2 === 0 ? 1 : -1;
    const card = document.createElement('article');
    card.className = 'jcard';
    card.innerHTML = `<p class="jcard__when">${e.when}</p><h3 class="jcard__title">${e.title}</h3><p class="jcard__org">${e.org}</p><p class="jcard__text">${e.text}</p>`;
    labelLayer().appendChild(card);
    return { ...j, side, card, l: 0.18 + i * 0.2, hover: 0, size: 0.75 + (i % 3) * 0.12, seed: Math.random() * 10 };
  });
  const scr = {}, edge = {}, tmp = new THREE.Vector3();

  return {
    group,
    update(dt, s) {
      const on = s.x > 1.75 && s.x < 3.2;
      group.visible = on;
      jellies.forEach((j) => { j.card.style.opacity = '0'; j.card.style.visibility = on ? 'visible' : 'hidden'; });
      if (!on) return;
      const narrow = isNarrow();
      for (const j of jellies) {
        // fixed in the water column; the camera sinks past them
        const y = camYAt(2 + j.l) + 0.5 + Math.sin(s.time * 0.4 + j.seed) * 0.25;
        const x = (narrow ? 0.8 : 2.1) * j.side + Math.sin(s.time * 0.21 + j.seed) * 0.3;
        j.g.position.set(s.camera.position.x * 0.2 + x, y, -6.2 - (j.side > 0 ? 0 : 1.2));
        j.g.scale.setScalar(j.size * (narrow ? 0.75 : 1));
        // hover: cursor near the bell on screen
        toScreen(j.g.position, s.camera, scr);
        tmp.copy(j.g.position).x += j.size;
        toScreen(tmp, s.camera, edge);
        const rad = Math.abs(edge.x - scr.x) * 1.3 + 30;
        const d = Math.hypot(s.input.px - scr.x, s.input.py - scr.y);
        const want = s.input.active && d < rad ? 1 : 0;
        j.hover += (want - j.hover) * damp(dt, 5);
        j.uni.uGlow.value = j.hover + 0.15 * Math.sin(s.time * 2 + j.seed) * j.hover;
        j.uni.uPhase.value += dt * (1.7 + j.hover * 2.2);           // pulse rate
        // lean toward the cursor when hovered, drift otherwise
        const lean = j.hover * clamp((s.input.px - scr.x) / 400, -1, 1);
        j.g.rotation.z = -lean * 0.35 + Math.sin(s.time * 0.3 + j.seed) * 0.08;
        j.g.rotation.x = Math.sin(s.time * 0.27 + j.seed * 2) * 0.1;
        // the timeline card rides beside its jelly while it crosses the middle of the screen
        const mid = 1 - clamp(Math.abs(scr.y - innerHeight * 0.48) / (innerHeight * 0.42));
        const vis = smooth(0, 0.5, mid) * (scr.behind ? 0 : 1);
        if (vis > 0.01) {
          const cardW = narrow ? Math.min(innerWidth - 112, 320) : 360;
          let cx = narrow ? 16 : (j.side > 0 ? scr.x - rad - cardW - 10 : scr.x + rad + 10);
          cx = clamp(cx, 16, Math.max(16, innerWidth - cardW - 80));
          const cy = narrow ? clamp(scr.y + rad * 0.9, innerHeight * 0.42, innerHeight - 300) : scr.y - 80;
          j.card.style.opacity = vis.toFixed(3);
          j.card.style.width = cardW + 'px';
          j.card.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0) translateY(${((1 - vis) * 20).toFixed(1)}px)`;
          j.card.classList.toggle('is-hot', j.hover > 0.4);
        }
      }
    },
  };
}
