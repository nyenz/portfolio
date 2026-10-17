import * as THREE from 'three';
import { U } from '../world/env.js';

// The living models inside the Archive tanks: each one shows what its project does.
// Every builder returns { obj, update(t, dt, hot) } and fits inside a ~1.2 unit cube.
const mat = (c, e = 0, opts = {}) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: e, roughness: 0.45, metalness: 0.1, ...opts });
const lineMat = (c, o = 1) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o });

// 1 · traffic monitoring: a koi school with live detection boxes and IDs
function traffic() {
  const obj = new THREE.Group();
  const fish = [];
  const bodyGeo = new THREE.SphereGeometry(0.06, 14, 10); bodyGeo.scale(2.4, 0.8, 1);
  const tailGeo = new THREE.ConeGeometry(0.05, 0.1, 4); tailGeo.rotateZ(Math.PI / 2); tailGeo.translate(-0.17, 0, 0);
  const boxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.34, 0.14, 0.18));
  const palettes = [[0xf4f0ea, 0xe8442e], [0xf4f0ea, 0x1a1a1a], [0xff7a30, 0xf4f0ea], [0xf4f0ea, 0xe8442e], [0xe8442e, 0x1a1a1a]];
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const [a, b] = palettes[i % palettes.length];
    const body = new THREE.Mesh(bodyGeo, mat(a, 0.15));
    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat(b, 0.2)); patch.position.set(0.02, 0.03, 0); patch.scale.set(2, 0.6, 1.1);
    const tail = new THREE.Mesh(tailGeo, mat(b, 0.15));
    const box = new THREE.LineSegments(boxGeo, lineMat(0x5dff9a, 0.9));
    g.add(body, patch, tail);
    obj.add(g, box);
    fish.push({ g, box, tail, r: 0.25 + Math.random() * 0.3, y: (Math.random() - 0.5) * 0.7, sp: 0.5 + Math.random() * 0.5, ph: Math.random() * 6.28, dir: Math.random() < 0.5 ? 1 : -1 });
  }
  return {
    obj,
    update(t) {
      for (const f of fish) {
        const a = t * f.sp * f.dir + f.ph;
        f.g.position.set(Math.cos(a) * f.r, f.y + Math.sin(t * 0.8 + f.ph) * 0.05, Math.sin(a) * f.r * 0.8);
        f.g.rotation.y = -a - (f.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
        f.tail.rotation.y = Math.sin(t * 9 + f.ph) * 0.5;
        f.box.position.copy(f.g.position);
        f.box.material.opacity = 0.55 + 0.45 * (Math.sin(t * 6 + f.ph) > 0.85 ? 0.2 : 1);
      }
    },
  };
}

// 2 · ERP: project-file cubes glide through stage gates that check and stamp them
function erp() {
  const obj = new THREE.Group();
  const gates = [-0.35, 0, 0.35].map((x) => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 8, 40), mat(0x7ff3ff, 0.6));
    r.position.x = x; r.rotation.y = Math.PI / 2; obj.add(r); return r;
  });
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.01, 0.06), mat(0x163a44, 0.1)); rail.position.y = -0.12; obj.add(rail);
  const cubes = [];
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.03), mat(0xe6fbfb, 0.15));
    obj.add(c); cubes.push({ c, off: i / 5 });
  }
  return {
    obj,
    update(t) {
      gates.forEach((g) => (g.material.emissiveIntensity = 0.35));
      for (const q of cubes) {
        const k = (t * 0.12 + q.off) % 1;
        q.c.position.set(-0.55 + k * 1.1, -0.02 + Math.sin(k * 30) * 0.004, 0);
        q.c.rotation.y = Math.sin(t + q.off * 6) * 0.2;
        gates.forEach((g) => { const d = Math.abs(q.c.position.x - g.position.x); if (d < 0.05) g.material.emissiveIntensity = 2.2; });
        q.c.material.color.setHex(k > 0.68 ? 0xff7a6b : k > 0.36 ? 0x9df5c4 : 0xe6fbfb);
        q.c.material.emissive.copy(q.c.material.color);
      }
    },
  };
}

// 3 · Ugachick: eggs travel from distributor phones to a hub; each locks a new chain link
function ugachick() {
  const obj = new THREE.Group();
  const phones = [0.35, 0, -0.35].map((y) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.02), mat(0x2a3b44, 0.05)); p.position.set(-0.45, y, 0); obj.add(p);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.14), mat(0x7ff3ff, 0.8)); sc.position.set(-0.45, y, 0.012); obj.add(sc); return p; });
  const hub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1), mat(0xffb36b, 0.6, { flatShading: true })); hub.position.set(0.3, 0, 0); obj.add(hub);
  const eggGeo = new THREE.SphereGeometry(0.035, 12, 10); eggGeo.scale(1, 1.3, 1);
  const eggs = [];
  for (let i = 0; i < 6; i++) { const e = new THREE.Mesh(eggGeo, mat(0xfff1d8, 0.4)); obj.add(e); eggs.push({ e, off: i / 6, from: i % 3 }); }
  const links = [];
  for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 20), mat(0x9df5c4, 0.5)); l.position.set(0.3, 0.16 + i * 0.06, 0); l.rotation.y = i % 2 ? Math.PI / 2 : 0; obj.add(l); links.push(l); }
  return {
    obj,
    update(t) {
      for (const q of eggs) {
        const k = (t * 0.25 + q.off) % 1, p = phones[q.from].position;
        q.e.position.set(p.x + (0.3 - p.x) * k, p.y * (1 - k) + Math.sin(k * Math.PI) * 0.1, Math.sin(k * Math.PI) * 0.08);
        q.e.scale.setScalar(k > 0.92 ? (1 - k) / 0.08 : 1);
      }
      const n = Math.floor((t * 0.5) % 7);
      links.forEach((l, i) => { l.visible = i < n; l.rotation.z = Math.sin(t + i) * 0.1; });
      hub.rotation.y = t * 0.4; hub.rotation.x = t * 0.25;
    },
  };
}

// 4 · Paper Cinema: faceted paper figures act a little scene under a spotlight
function paper() {
  const obj = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1c2, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  cone.position.y = 0.12; obj.add(cone);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.42, 6), mat(0x3a2f2a, 0.05, { flatShading: true })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.38; obj.add(floor);
  const figs = [[-0.18, 0xff7a6b], [0.05, 0xf4f0ea], [0.25, 0x7ff3ff]].map(([x, c], i) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), mat(c, 0.15, { flatShading: true })); body.scale.set(0.8, 1.5, 0.6);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), mat(c, 0.15, { flatShading: true })); head.position.y = 0.16;
    g.add(body, head); g.position.set(x, -0.25, 0); obj.add(g); return { g, i };
  });
  return {
    obj,
    update(t) {
      figs.forEach(({ g, i }) => { g.position.y = -0.25 + Math.abs(Math.sin(t * 2 + i * 1.3)) * 0.05; g.rotation.y = Math.sin(t * 0.7 + i) * 0.8; g.rotation.z = Math.sin(t * 2 + i) * 0.1; });
      cone.material.opacity = 0.07 + Math.sin(t * 3) * 0.01;
    },
  };
}

// 5 · EditForge: a film strip slices into pieces on the beat and joins back up
function editforge() {
  const obj = new THREE.Group();
  const frames = [];
  for (let i = 0; i < 9; i++) {
    const f = new THREE.Group();
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.22), mat(0x101418, 0.05, { side: THREE.DoubleSide }));
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.13), mat(new THREE.Color().setHSL(0.5 + i * 0.04, 0.6, 0.55).getHex(), 0.7, { side: THREE.DoubleSide }));
    pic.position.z = 0.002;
    f.add(strip, pic); obj.add(f); frames.push(f);
  }
  return {
    obj,
    update(t) {
      const beat = t * 1.2, k = Math.pow(Math.max(0, Math.sin(beat * Math.PI)), 6);
      frames.forEach((f, i) => {
        const x = (i - 4) * 0.135;
        const kept = i % 3 !== 1;
        f.position.set(x * (1 + k * 0.25), Math.sin(t * 1.5 + i * 0.5) * 0.04 + (kept ? 0 : k * 0.18), kept ? 0 : -k * 0.2);
        f.rotation.y = Math.sin(t * 0.8 + i * 0.4) * 0.3;
        f.children[1].material.emissiveIntensity = 0.5 + k * 0.8;
      });
    },
  };
}

// 6 · CPU Showdown: a chip with a live heat map and a pulsing radar chart
function cpu() {
  const obj = new THREE.Group();
  const chipMat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      void main(){ vec2 g = floor(vUv * 6.); float h = 0.5 + 0.5 * sin(uTime * (1. + fract(sin(dot(g, vec2(12.9, 78.2))) * 4.)) + g.x * 1.7 + g.y);
        vec3 c = mix(vec3(0.05, 0.2, 0.5), vec3(1., 0.35, 0.15), h); c = mix(c, vec3(1., 0.9, 0.4), smoothstep(0.85, 1., h));
        vec2 f = fract(vUv * 6.); c *= smoothstep(0., 0.08, f.x) * smoothstep(0., 0.08, f.y) * 0.9 + 0.1; gl_FragColor = vec4(c, 1.); }` });
  const chip = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), chipMat); chip.rotation.x = -Math.PI / 2; chip.position.y = -0.2; obj.add(chip);
  const pins = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.03, 0.58), mat(0x1c2328, 0.05)); pins.position.y = -0.22; obj.add(pins);
  const radar = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 6 }, () => new THREE.Vector3())), lineMat(0x7ff3ff, 1));
  const grid = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 6 }, (_, i) => new THREE.Vector3(Math.cos(i / 6 * 6.283) * 0.3, Math.sin(i / 6 * 6.283) * 0.3, 0))), lineMat(0x3a6a74, 0.8));
  radar.position.y = grid.position.y = 0.2; obj.add(radar, grid);
  return {
    obj,
    update(t) {
      const p = radar.geometry.attributes.position;
      for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283, r = 0.12 + 0.17 * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 1.9)); p.setXYZ(i, Math.cos(a) * r, Math.sin(a) * r, 0); }
      p.needsUpdate = true;
      radar.rotation.y = grid.rotation.y = Math.sin(t * 0.4) * 0.5;
    },
  };
}

// 7 · GES website: a glowing topographic contour map that ripples
function ges() {
  const obj = new THREE.Group();
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime }, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    vertexShader: `uniform float uTime; varying float vH; varying vec2 vUv;
      float hgt(vec2 p){ return sin(p.x * 5.) * cos(p.y * 4.) * 0.5 + sin(p.x * 9. + p.y * 7.) * 0.25 + exp(-dot(p - vec2(0.15, 0.1), p - vec2(0.15, 0.1)) * 12.) * 0.9; }
      void main(){ vUv = uv; vec3 p = position; float h = hgt(p.xy) + sin(length(p.xy) * 14. - uTime * 2.) * 0.05; vH = h; p.z += h * 0.18; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
    fragmentShader: `uniform float uTime; varying float vH; varying vec2 vUv;
      void main(){ float l = abs(fract(vH * 6. - uTime * 0.05) - 0.5); float line = smoothstep(0.06, 0.0, l);
        vec3 c = mix(vec3(0.2, 0.9, 0.7), vec3(1., 0.6, 0.35), smoothstep(0., 1., vH)); float edge = smoothstep(0.5, 0.42, length(vUv - 0.5));
        gl_FragColor = vec4(c * (line + 0.08), (line * 0.95 + 0.06) * edge); }` });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 90, 90), m); plane.rotation.x = -Math.PI / 2.3; plane.position.y = -0.1; obj.add(plane);
  return { obj, update(t) { plane.rotation.z = t * 0.08; } };
}

// 8 · cash-crop predictor: kelp stalks grow like a bar chart, one per forecast year
function crops() {
  const obj = new THREE.Group();
  const stalks = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 1, 6, 8), mat(0x3fae6a, 0.25)); s.position.y = 0.5;
    g.add(s);
    for (let k = 0; k < 3; k++) { const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.16), mat(0x6fdc8f, 0.3, { side: THREE.DoubleSide })); leaf.position.set(0.03, 0.3 + k * 0.25, 0); leaf.rotation.z = -0.6; g.add(leaf); }
    g.position.set((i - 3) * 0.13, -0.42, (i % 2) * 0.08 - 0.04);
    obj.add(g); stalks.push(g);
  }
  const base = new THREE.Mesh(new THREE.BoxGeometry(1, 0.02, 0.3), mat(0x2a2219, 0.05)); base.position.y = -0.43; obj.add(base);
  return {
    obj,
    update(t) {
      stalks.forEach((g, i) => {
        const v = 0.3 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.5 + i * 0.7)) * (0.55 + i * 0.07);
        g.scale.y += (v - g.scale.y) * 0.05;
        g.rotation.z = Math.sin(t * 1.2 + i) * 0.06;
      });
    },
  };
}

export const MODELS = { traffic, erp, ugachick, paper, editforge, cpu, ges, crops };
