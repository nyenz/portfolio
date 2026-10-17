import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { U } from '../world/env.js';
import { TOOLS } from '../config/content.js';
import { smooth, isNarrow, damp, textTexture, clamp } from './util.js';

// The Abyss: almost no light. Nyende's tools float as real glass cubes (rainbow-edged glass,
// physics pull to the centre, they bump and settle; the cursor shoves them aside like a hand
// in water; tilting a phone sloshes them). Gold blobs rise from a vent far below and merge
// with a blob that follows the cursor (the metaball-cubes reactivity).
export function createAbyss({ quality, renderer }) {
  const group = new THREE.Group();
  group.visible = false;
  const high = quality.name !== 'low';

  // ---- light: the torch and a warm glow from below
  const warm = new THREE.PointLight(0xff8a3a, 8, 9, 1.5); warm.position.set(0, -3.2, 0.5); group.add(warm);
  const cool = new THREE.PointLight(0x8ff6ff, 4, 9, 1.5); cool.position.set(1.5, 2.2, 2.5); group.add(cool);

  let goldEnv = null;
  // ---- glass tool cubes
  const cubes = [];
  const geo = new RoundedBoxGeometry(0.62, 0.62, 0.62, 3, 0.09);
  const glass = high
    ? new THREE.MeshPhysicalMaterial({ color: 0xd9fff4, roughness: 0.06, metalness: 0, transmission: 1, thickness: 0.6, ior: 1.45, dispersion: 3, iridescence: 0.6, iridescenceIOR: 1.3, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 1, envMapIntensity: 1 })
    : new THREE.MeshStandardMaterial({ color: 0x9fe8d8, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.35 });
  if (high && renderer) {
    const pm = new THREE.PMREMGenerator(renderer);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    glass.envMap = env; glass.envMapIntensity = 0.6;
    goldEnv = env;
  }
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x9dffd0, transparent: true, opacity: 0.55 });
  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.6, 0.6, 0.6));
  TOOLS.forEach((name, i) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(geo, glass);
    const e = new THREE.LineSegments(edges, edgeMat);
    const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.28), new THREE.MeshBasicMaterial({ map: textTexture(name, { w: 512, h: 256, size: 74 }), transparent: true, depthWrite: false }));
    lbl.renderOrder = 12;
    g.add(m, e, lbl);
    const a = (i / TOOLS.length) * Math.PI * 2;
    const p = new THREE.Vector3(Math.cos(a) * 1.8, (Math.random() - 0.5) * 1.6, Math.sin(a) * 0.9);
    group.add(g);
    cubes.push({ g, lbl, p, v: new THREE.Vector3(), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, 0)), w: new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 0) });
  });

  // ---- gold metaballs (marching cubes)
  const res = quality.name === 'high' ? 34 : quality.name === 'med' ? 28 : 22;
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffb35a, emissive: 0xff6a10, emissiveIntensity: 0.18, roughness: 0.18, metalness: 1, envMap: goldEnv, envMapIntensity: 1.4 });
  const eBase = goldEnv ? 0.16 : 0.5; if (!goldEnv) goldMat.metalness = 0.5;
  const blobs = new MarchingCubes(res, goldMat, false, false, 60000);
  blobs.scale.setScalar(2.4);
  blobs.position.set(0, -1.6, -1.2);
  group.add(blobs);
  const balls = Array.from({ length: 6 }, (_, i) => ({ ph: Math.random() * 10, sp: 0.07 + Math.random() * 0.06, x: (Math.random() - 0.5) * 0.4, s: 0.32 + Math.random() * 0.25, i }));
  const cursorBall = new THREE.Vector3(0.5, 0.5, 0.5);

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), inv = new THREE.Matrix4(), pLocal = new THREE.Vector3(), tmp = new THREE.Vector3(), axis = new THREE.Vector3(), dq = new THREE.Quaternion();
  const CENTER = new THREE.Vector3(0, 0.15, 0);

  return {
    group,
    update(dt, s) {
      const l = s.x - 4;
      const on = s.x > 3.85 && s.x < 5.25;
      group.visible = on;
      if (!on) return;
      const narrow = isNarrow();
      group.position.set(s.camera.position.x + (narrow ? 0 : 1.9), s.camera.position.y + (narrow ? 0.9 : 0), narrow ? -8.4 : -6.8);
      group.updateMatrixWorld(true);
      const appear = smooth(-0.05, 0.25, l) * (1 - smooth(0.88, 1.15, l));

      // cursor ray in the group's space
      ndc.set(s.input.sx, s.input.sy);
      ray.setFromCamera(ndc, s.camera);
      inv.copy(group.matrixWorld).invert();
      const ro = ray.ray.origin.clone().applyMatrix4(inv), rd = ray.ray.direction.clone().transformDirection(inv);
      const h = Math.min(dt, 1 / 30);
      const gravity = tmp.set(s.input.tiltX * 1.5, -s.input.tiltY * 1.2, 0);
      for (const c of cubes) {
        // pull to the centre (spring) + water drag
        c.v.addScaledVector(pLocal.copy(CENTER).sub(c.p), 1.6 * h);
        c.v.addScaledVector(gravity, h);
        // the cursor is an invisible ball pushing through the water
        const along = Math.max(0, tmp.copy(c.p).sub(ro).dot(rd));
        const closest = pLocal.copy(ro).addScaledVector(rd, along);
        const off = tmp.copy(c.p).sub(closest); const d = off.length();
        if (s.input.active && d < 0.9) {
          const f = (1 - d / 0.9) * (3 + s.input.speed * 4);
          c.v.addScaledVector(off.normalize(), f * h);
          c.w.x += (Math.random() - 0.5) * f * h * 3; c.w.y += (Math.random() - 0.5) * f * h * 3;
        }
        c.v.multiplyScalar(Math.exp(-h * 1.8));
        c.w.multiplyScalar(Math.exp(-h * 0.8));
      }
      // collisions between cubes (sphere approximation)
      for (let i = 0; i < cubes.length; i++) for (let j = i + 1; j < cubes.length; j++) {
        const a = cubes[i], b = cubes[j];
        const dx = b.p.x - a.p.x, dy = b.p.y - a.p.y, dz = b.p.z - a.p.z, d = Math.hypot(dx, dy, dz), min = 0.68;
        if (d < min && d > 1e-4) {
          const k = (min - d) / d * 0.5;
          a.p.x -= dx * k; a.p.y -= dy * k; a.p.z -= dz * k; b.p.x += dx * k; b.p.y += dy * k; b.p.z += dz * k;
          const rel = (b.v.x - a.v.x) * dx + (b.v.y - a.v.y) * dy + (b.v.z - a.v.z) * dz;
          if (rel < 0) { const imp = rel / (d * d) * 0.9; a.v.x += dx * imp; a.v.y += dy * imp; a.v.z += dz * imp; b.v.x -= dx * imp; b.v.y -= dy * imp; b.v.z -= dz * imp; a.w.z += imp * 2; b.w.z -= imp * 2; }
        }
      }
      for (const c of cubes) {
        c.p.addScaledVector(c.v, h);
        c.p.z = clamp(c.p.z, -1.4, 1.2);
        const wl = c.w.length() + 0.12;
        axis.copy(c.w).addScalar(0.05).normalize();
        dq.setFromAxisAngle(axis, wl * h); c.q.premultiply(dq);
        c.g.position.copy(c.p);
        c.g.quaternion.copy(c.q);
        c.g.scale.setScalar(appear * (narrow ? 0.8 : 1));
        // the name always faces the viewer, floating inside its cube
        c.lbl.quaternion.copy(c.q).invert().multiply(s.camera.quaternion);
      }

      // metaballs rise from the vent; one follows the cursor
      blobs.reset();
      const t = s.time;
      for (const b of balls) {
        const k = (t * b.sp + b.ph) % 1;
        blobs.addBall(0.5 + b.x + Math.sin(t * 0.7 + b.i) * 0.08, 0.08 + k * 0.84, 0.5 + Math.cos(t * 0.5 + b.i) * 0.08, b.s * Math.sin(k * Math.PI) * 0.9, 9);
      }
      // the cursor blob, in marching-cube space (0..1)
      const toBlob = blobs.matrixWorld.clone().invert();
      const target = ray.ray.at(6.4, tmp.clone()).applyMatrix4(toBlob);
      cursorBall.lerp(new THREE.Vector3(clamp(target.x * 0.5 + 0.5, 0.1, 0.9), clamp(target.y * 0.5 + 0.5, 0.1, 0.9), 0.55), damp(dt, 4));
      if (s.input.active || s.input.tiltX) blobs.addBall(cursorBall.x, cursorBall.y, cursorBall.z, 0.55, 9);
      blobs.update();
      goldMat.emissiveIntensity = eBase + Math.sin(t * 1.3) * 0.05;
      blobs.visible = appear > 0.02;
      warm.intensity = 8 * appear * (0.85 + 0.15 * Math.sin(t * 3.1));
    },
  };
}
