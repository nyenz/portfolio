import * as THREE from 'three';
import { U } from '../world/env.js';
import { SKILLS } from '../config/content.js';
import { smooth, isNarrow, damp, labelLayer, toScreen, clamp } from './util.js';

// The Core: at the sea floor we zoom into one speck of marine snow and find Nyende's DNA —
// the same helix the site opened with, now made of particles and little cubes (the
// dna_combined idea). Every rung is a skill: hover or tap to read it. Scrolling unzips the
// helix into its skill groups. The smallest thing, last.
export function createCore({ quality }) {
  const group = new THREE.Group();
  group.visible = false;
  const helix = new THREE.Group();
  group.add(helix);
  const rungs = [];
  SKILLS.forEach((g, gi) => g.items.forEach((name) => rungs.push({ name, gi })));
  const N = rungs.length, H = 9, R = 1.5, TURNS = 2.1;
  const strand = (t, ph) => { const a = t * Math.PI * 2 * TURNS + ph; return new THREE.Vector3(Math.cos(a) * R, -H / 2 + t * H, Math.sin(a) * R); };
  const groupColors = [0x7ff3ff, 0x9df5c4, 0xff8b7d, 0xc2a6ff].map((c) => new THREE.Color(c));

  // particles along both backbones (split into strand A / B so they can unzip)
  const dens = quality.name === 'high' ? 1 : quality.name === 'med' ? 0.7 : 0.45;
  const pos = [], info = [];
  for (let s = 0; s < 2; s++) for (let i = 0; i < 3200 * dens; i++) {
    const t = Math.random(), p = strand(t, s * Math.PI);
    const r = 0.13 * Math.sqrt(Math.random()), a = Math.random() * 6.283;
    pos.push(p.x + Math.cos(a) * r, p.y + (Math.random() - 0.5) * 0.1, p.z + Math.sin(a) * r);
    info.push(s, Math.random(), t, 0);
  }
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  pgeo.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 4));
  pgeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
  const uni = { ...U, uUnzip: { value: 0 }, uAppear: { value: 0 }, uScale: { value: 1 } };
  const pmat = new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec4 aInfo; uniform float uUnzip, uTime, uPx, uAppear, uScale;
      varying float vA;
      void main(){
        vec3 p = position;
        float side = aInfo.x < 0.5 ? -1. : 1.;
        p.x += side * uUnzip * (1.2 + aInfo.z * 0.6);
        p += vec3(sin(uTime + aInfo.y * 40.), cos(uTime * 0.8 + aInfo.y * 30.), 0.) * 0.02;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.5, (0.035 + aInfo.y * 0.04) * uPx * mix(0.35, 1., uScale) / -mv.z);
        vA = uAppear * (0.5 + 0.5 * aInfo.y);
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main(){ vec2 c = gl_PointCoord - .5; float r = length(c); if (r > .5) discard; float a = smoothstep(.5, 0., r); a *= a;
        gl_FragColor = vec4(vec3(.5, .95, 1.) * a * vA * .6, a * vA); }`,
  });
  const pts = new THREE.Points(pgeo, pmat);
  pts.frustumCulled = false;
  helix.add(pts);

  // rungs: little cubes (instanced) with edges, one rung per skill, two halves each
  const PER = 7;
  const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
  const cubeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x0a1418, emissiveIntensity: 1, roughness: 0.35, metalness: 0.15, transparent: true });
  const inst = new THREE.InstancedMesh(cubeGeo, cubeMat, N * PER * 2);
  inst.frustumCulled = false;
  helix.add(inst);
  const nodeGeo = new THREE.IcosahedronGeometry(0.16, 1);
  const nodes = new THREE.InstancedMesh(nodeGeo, new THREE.MeshStandardMaterial({ color: 0xbff8ff, emissive: 0x7ff3ff, emissiveIntensity: 0.32, roughness: 0.3 }), N * 2);
  nodes.frustumCulled = false;
  helix.add(nodes);
  const cubeData = [];
  rungs.forEach((r, i) => {
    const t = (i + 0.5) / N;
    r.a = strand(t, 0); r.b = strand(t, Math.PI); r.t = t;
    r.mid = r.a.clone().add(r.b).multiplyScalar(0.5);
    for (let half = 0; half < 2; half++) for (let k = 0; k < PER; k++) {
      const u = (k + 0.5) / PER * 0.46 + (half ? 0.54 : 0);
      cubeData.push({ r: i, half, u, size: 0.07 + Math.random() * 0.06, rot: new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3), jitter: new THREE.Vector3().randomDirection().multiplyScalar(0.05) });
    }
    inst.setColorAt(i * PER * 2, groupColors[r.gi]);
  });
  cubeData.forEach((c, j) => inst.setColorAt(j, groupColors[rungs[c.r].gi]));

  // labels
  const hoverLabel = document.createElement('div'); hoverLabel.className = 'dna-label'; labelLayer().appendChild(hoverLabel);
  const groupLabels = SKILLS.map((g, gi) => { const el = document.createElement('div'); el.className = 'dna-group'; el.style.setProperty('--c', '#' + groupColors[gi].getHexString()); el.innerHTML = `<span></span>${g.group}`; labelLayer().appendChild(el); return el; });
  const light = new THREE.PointLight(0x9ff6ff, 5, 12, 1.4); light.position.set(0, 0, 4); group.add(light);

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3(), scr = {};
  let hoverI = -1, hoverK = 0, lastHover = -2;

  return {
    group,
    update(dt, s) {
      const l = s.x - 5;
      const on = s.x > 4.9;
      group.visible = on;
      hoverLabel.style.opacity = '0';
      groupLabels.forEach((e) => (e.style.opacity = '0'));
      if (!on) return;
      const narrow = isNarrow();
      // zoom in from a single speck to the full helix
      const zoom = smooth(0.0, 0.3, l);
      const unzip = smooth(0.38, 0.62, l);
      const appear = smooth(0.02, 0.18, l);
      uni.uUnzip.value = unzip; uni.uAppear.value = appear;
      group.position.set(s.camera.position.x + (narrow ? 0 : 2.3 + smooth(0.6, 0.9, l) * 1.1), s.camera.position.y + (narrow ? 1.9 + smooth(0.6, 0.9, l) * 1.4 : 0.1), narrow ? -10 : -8.5);
      const scale = (0.02 + 0.98 * Math.pow(zoom, 2.2)) * (narrow ? 0.62 : 0.86) * (1 - unzip * 0.12);
      group.scale.setScalar(scale);
      uni.uScale.value = scale;
      helix.rotation.y = s.time * 0.18 * (1 - unzip * 0.8) + s.input.sx * 0.5;
      helix.rotation.z = 0.32 - unzip * 0.32 + s.input.sy * 0.08;
      helix.rotation.x = 0.15;

      // cubes + nodes follow the strands (and split on unzip)
      cubeData.forEach((c, j) => {
        const r = rungs[c.r];
        pv.lerpVectors(r.a, r.b, c.u).add(c.jitter);
        pv.x += (c.half ? 1 : -1) * unzip * (1.2 + r.t * 0.6) + (c.half ? 1 : -1) * unzip * 0.25;
        const pulse = c.r === hoverI ? 1 + hoverK * 0.9 : 1;
        sc.setScalar(c.size * pulse * appear);
        q.setFromEuler(c.rot);
        c.rot.x += dt * 0.6; c.rot.y += dt * 0.4;
        inst.setMatrixAt(j, m.compose(pv, q, sc));
      });
      inst.instanceMatrix.needsUpdate = true;
      rungs.forEach((r, i) => {
        for (let k = 0; k < 2; k++) {
          pv.copy(k ? r.b : r.a); pv.x += (k ? 1 : -1) * unzip * (1.2 + r.t * 0.6);
          sc.setScalar(appear * (i === hoverI ? 1.5 : 1));
          nodes.setMatrixAt(i * 2 + k, m.compose(pv, q.identity(), sc));
        }
      });
      nodes.instanceMatrix.needsUpdate = true;

      // hover: nearest rung to the cursor (or finger) on screen
      group.updateMatrixWorld(true);
      let best = -1, bd = 1e9;
      if (appear > 0.5) rungs.forEach((r, i) => {
        pv.copy(r.mid).applyMatrix4(helix.matrixWorld);
        toScreen(pv, s.camera, scr);
        const d = Math.hypot(scr.x - s.input.px, scr.y - s.input.py);
        if (d < bd) { bd = d; best = i; r.sx = scr.x; r.sy = scr.y; }
      });
      const hov = s.input.active && bd < 70 ? best : -1;
      if (hov !== hoverI) { hoverI = hov; hoverK = 0; }
      hoverK += (1 - hoverK) * damp(dt, 6);
      if (hoverI >= 0) {
        const r = rungs[hoverI];
        if (lastHover !== hoverI) { lastHover = hoverI; hoverLabel.innerHTML = `<p>${SKILLS[r.gi].group}</p><h4>${r.name}</h4>`; hoverLabel.style.setProperty('--c', '#' + groupColors[r.gi].getHexString()); }
        hoverLabel.style.opacity = '1';
        hoverLabel.style.transform = `translate3d(${(r.sx + 22).toFixed(1)}px, ${(r.sy - 30).toFixed(1)}px, 0)`;
      }
      // unzipped: show the four skill groups beside their stretch of the helix
      if (unzip > 0.3) {
        SKILLS.forEach((g, gi) => {
          const idx = rungs.map((r, i) => (r.gi === gi ? i : -1)).filter((i) => i >= 0);
          const r = rungs[idx[Math.floor(idx.length / 2)]];
          pv.copy(r.a); pv.x -= unzip * (1.2 + r.t * 0.6) + 0.6; pv.applyMatrix4(helix.matrixWorld);
          toScreen(pv, s.camera, scr);
          const el = groupLabels[gi];
          el.style.opacity = (smooth(0.3, 0.8, unzip) * (1 - smooth(0.8, 0.95, l))).toFixed(3);
          el.style.transform = `translate3d(${clamp(scr.x - 200, 12, innerWidth - 220).toFixed(1)}px, ${scr.y.toFixed(1)}px, 0)`;
        });
      }
      light.intensity = 5 * appear;
      cubeMat.opacity = appear;
    },
    /** depth meter switches to scale while we zoom in */
    scaleText(s) {
      const l = s.x - 5;
      if (l < 0.04) return null;
      const k = smooth(0.04, 0.3, l);
      const metres = Math.pow(10, -6 * k);          // 1 m -> 1 µm
      if (metres >= 0.01) return { num: (metres * 100).toFixed(metres >= 0.1 ? 0 : 1), unit: 'cm' };
      if (metres >= 1e-3) return { num: (metres * 1000).toFixed(1), unit: 'mm' };
      return { num: (metres * 1e6).toFixed(metres >= 1e-5 ? 0 : 1), unit: 'µm' };
    },
  };
}
