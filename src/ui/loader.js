import * as THREE from 'three';
import { input } from '../core/input.js';

// The DNA intro: particles drift in and gently assemble a double helix while the site gets
// ready; then the camera glides in and dives through one glowing base pair into the ocean.
// Driven from main.js by a single GSAP timeline through `state`.
export function createLoader(renderer, density = 1) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.01, 100);

  const N = 18, H = 13, R = 2.0, TURNS = 1.6;
  const pos = [], from = [], data = [];
  const add = (x, y, z, kind) => {
    pos.push(x, y, z);
    const a = Math.random() * Math.PI * 2, r = 7 + Math.random() * 12;
    from.push(Math.cos(a) * r, (Math.random() - 0.5) * 26, Math.sin(a) * r - 3);
    data.push((y + H / 2) / H, Math.random(), kind, Math.random());
  };
  const strand = (t, phase) => {
    const ang = t * Math.PI * 2 * TURNS + phase;
    return [Math.cos(ang) * R, -H / 2 + t * H, Math.sin(ang) * R];
  };
  const k = density;
  for (let s = 0; s < 2; s++) {
    const cnt = Math.round(2600 * k);
    for (let i = 0; i < cnt; i++) {
      const t = Math.random(); const [x, y, z] = strand(t, s * Math.PI);
      const rr = 0.16 * Math.sqrt(Math.random()), aa = Math.random() * 6.283;
      add(x + Math.cos(aa) * rr, y + (Math.random() - 0.5) * 0.12, z + Math.sin(aa) * rr, 0);
    }
  }
  let target = null;
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N;
    const A = strand(t, 0), B = strand(t, Math.PI);
    if (i === 9) target = new THREE.Vector3(...A);
    for (let j = 0; j < Math.round(150 * k); j++) {
      const u = Math.random(), w = Math.random(); const [x, y, z] = (w < 0.5 ? A : B);
      const v = new THREE.Vector3().randomDirection().multiplyScalar(0.34 * Math.cbrt(u));
      add(x + v.x, y + v.y, z + v.z, 1);
    }
    for (let j = 0; j < Math.round(170 * k); j++) {
      const u = Math.random(); if (Math.abs(u - 0.5) < 0.03) continue;
      const rr = 0.06 * Math.random(), aa = Math.random() * 6.283;
      add(A[0] + (B[0] - A[0]) * u + Math.cos(aa) * rr, A[1] + Math.sin(aa) * rr, A[2] + (B[2] - A[2]) * u, u < 0.5 ? 2 : 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aFrom', new THREE.Float32BufferAttribute(from, 3));
  geo.setAttribute('aData', new THREE.Float32BufferAttribute(data, 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
  const uniforms = { uP: { value: 0 }, uFade: { value: 0 }, uTime: { value: 0 }, uPx: { value: 1 }, uGlow: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 aFrom; attribute vec4 aData;
      uniform float uP, uTime, uPx;
      varying float vA; varying float vKind; varying float vFront;
      void main(){
        float t = aData.x;
        // each particle arrives in its own time window; the bottom of the helix builds first
        float start = t * 0.7 + aData.y * 0.12;
        float arrive = smoothstep(start, start + 0.22, uP);
        float e = arrive * arrive * (3. - 2. * arrive);
        // arrive along a gentle curve instead of a straight line
        vec3 mid = mix(aFrom, position, 0.5) + vec3(0., 1.2 * (1. - aData.w), 0.);
        vec3 p = mix(mix(aFrom, mid, e), mix(mid, position, e), e);
        p += vec3(sin(uTime * 0.9 + aData.y * 40.), cos(uTime * 0.7 + aData.w * 30.), sin(uTime * 0.8 + aData.y * 20.)) * (0.02 + 0.25 * (1. - e));
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        float z = -mv.z;
        float big = aData.z > 0.5 && aData.z < 1.5 ? 1.5 : 1.;
        gl_PointSize = min((0.05 + aData.w * 0.05) * big * uPx / max(z, 0.01), 70.);
        vFront = smoothstep(0.1, 0., abs(start + 0.11 - uP));
        vA = (0.12 + 0.88 * e) * smoothstep(0.05, 0.6, z);   // particles right at the lens fade, no giant blobs
        vKind = aData.z;
      }`,
    fragmentShader: /* glsl */`
      uniform float uFade, uGlow;
      varying float vA; varying float vKind; varying float vFront;
      void main(){
        vec2 c = gl_PointCoord - 0.5; float r = length(c); if (r > 0.5) discard;
        float a = smoothstep(0.5, 0.0, r); a *= a;
        vec3 col = vec3(0.45, 0.95, 1.0);
        if (vKind > 1.5 && vKind < 2.5) col = vec3(1.0, 0.5, 0.42);
        if (vKind > 2.5) col = vec3(0.55, 1.0, 0.82);
        col += vFront * vec3(0.7, 1., 1.) * 1.2;
        col *= 1. + uGlow;
        float al = a * vA * (1. - uFade);
        gl_FragColor = vec4(col * al, al);
      }`,
  });
  const helix = new THREE.Points(geo, mat);
  const group = new THREE.Group();
  group.add(helix);
  scene.add(group);

  // timeline-driven state
  const state = { dolly: 0, dive: 0, spin: 0.32 };
  const startPos = new THREE.Vector3(), tgtW = new THREE.Vector3(), look = new THREE.Vector3(), tmp = new THREE.Vector3();
  let angle = 0, baseZ = 17;

  const el = document.getElementById('loader');
  const pctEl = el.querySelector('.loader__pct');
  let shown = -1;
  return {
    uniforms, state,
    resize(dpr) {
      camera.aspect = innerWidth / innerHeight;
      baseZ = camera.aspect < 0.8 ? 31 : 21;
      camera.updateProjectionMatrix();
      uniforms.uPx.value = (innerHeight * dpr) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    },
    render(time, dt) {
      uniforms.uTime.value = time;
      angle += dt * state.spin;
      helix.rotation.y = angle;
      group.rotation.set(0.22 - input.sy * 0.12 * (1 - state.dive), 0, -0.5 + input.sx * 0.1 * (1 - state.dive));
      // dolly in slowly, then dive through base pair #9
      startPos.set(input.sx * 0.6 * (1 - state.dive), input.sy * 0.4 * (1 - state.dive), baseZ - state.dolly * baseZ * 0.24);
      group.updateMatrixWorld(true);
      tgtW.copy(target).applyMatrix4(helix.matrixWorld);
      const d = state.dive;
      const e = d * d * d;               // slow start, fast finish
      camera.position.lerpVectors(startPos, tgtW, Math.min(e * 1.08, 1.08));
      tmp.subVectors(tgtW, startPos).normalize();
      const lk = Math.min(d * 4, 1), s = lk * lk * (3 - 2 * lk);
      look.copy(tgtW).addScaledVector(tmp, 4).multiplyScalar(s); // from the helix centre (origin) to past the target
      camera.lookAt(look);
      camera.fov = 38 + e * 30;
      camera.updateProjectionMatrix();
      const p = Math.round(Math.min(uniforms.uP.value / 0.96, 1) * 100);
      if (p !== shown) { shown = p; pctEl.textContent = String(p).padStart(3, '0'); }
      const ac = renderer.autoClear;
      renderer.autoClear = false;
      renderer.setRenderTarget(null);
      renderer.clearDepth();
      renderer.render(scene, camera);
      renderer.autoClear = ac;
    },
    done() { el.classList.add('is-done'); setTimeout(() => el.remove(), 1400); },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
