import * as THREE from 'three';
import { input } from '../core/input.js';

// The DNA loader: thousands of glowing particles fly in and assemble a double helix while
// the site gets ready, then the helix dissolves into the water as the eyes open.
export function createLoader(renderer, density = 1) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0, 15);

  const N = 18, H = 13, R = 2.0, TURNS = 1.6;
  const pos = [], from = [], data = [];
  const add = (x, y, z, kind) => {
    pos.push(x, y, z);
    const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 10;
    from.push(Math.cos(a) * r, (Math.random() - 0.5) * 22, Math.sin(a) * r - 4);
    data.push((y + H / 2) / H, Math.random(), kind, Math.random());
  };
  const strand = (t, phase) => {
    const ang = t * Math.PI * 2 * TURNS + phase;
    return [Math.cos(ang) * R, -H / 2 + t * H, Math.sin(ang) * R];
  };
  const k = density;
  // backbones
  for (let s = 0; s < 2; s++) {
    const cnt = Math.round(2600 * k);
    for (let i = 0; i < cnt; i++) {
      const t = Math.random(); const [x, y, z] = strand(t, s * Math.PI);
      const rr = 0.16 * Math.sqrt(Math.random()), aa = Math.random() * 6.283;
      add(x + Math.cos(aa) * rr, y + (Math.random() - 0.5) * 0.12, z + Math.sin(aa) * rr, 0);
    }
  }
  // base-pair nodes + rungs
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N;
    const A = strand(t, 0), B = strand(t, Math.PI);
    for (let j = 0; j < Math.round(140 * k); j++) {
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
  const uniforms = { uP: { value: 0 }, uD: { value: 0 }, uTime: { value: 0 }, uPx: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 aFrom; attribute vec4 aData;
      uniform float uP, uD, uTime, uPx;
      varying float vA; varying float vKind; varying float vFront;
      void main(){
        float t = aData.x;
        float arrive = smoothstep(t * 0.85 - 0.02, t * 0.85 + 0.15, uP);           // bottom builds first
        vec3 p = mix(aFrom, position, arrive * arrive * (3. - 2. * arrive));
        p += vec3(sin(uTime * 1.3 + aData.y * 40.), cos(uTime * 1.1 + aData.w * 30.), sin(uTime + aData.y * 20.)) * 0.025;
        // dissolve: drift outward and up like marine snow, then fade
        vec3 outw = normalize(vec3(p.x, 0.2, p.z) + 1e-3);
        p += (outw * (1.5 + aData.y * 5.) + vec3(0., aData.w * 3. - 0.6, 2.5 + aData.y * 6.)) * uD * uD;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        float big = aData.z > 0.5 && aData.z < 1.5 ? 1.5 : 1.;
        gl_PointSize = (0.05 + aData.w * 0.05) * big * uPx / -mv.z;
        vFront = smoothstep(0.12, 0., abs(t * 0.85 + 0.07 - uP)) * (1. - uD);
        vA = (0.15 + 0.85 * arrive) * (1. - smoothstep(0.35, 1., uD));
        vKind = aData.z;
      }`,
    fragmentShader: /* glsl */`
      varying float vA; varying float vKind; varying float vFront;
      void main(){
        vec2 c = gl_PointCoord - 0.5; float r = length(c); if (r > 0.5) discard;
        float a = smoothstep(0.5, 0.0, r); a *= a;
        vec3 col = vec3(0.45, 0.95, 1.0);
        if (vKind > 1.5 && vKind < 2.5) col = vec3(1.0, 0.5, 0.42);   // coral rungs
        if (vKind > 2.5) col = vec3(0.55, 1.0, 0.82);                  // sea-green rungs
        col += vFront * vec3(0.8, 1., 1.) * 1.5;
        gl_FragColor = vec4(col * a * vA, a * vA);
      }`,
  });
  const helix = new THREE.Points(geo, mat);
  const group = new THREE.Group();
  group.add(helix);
  group.rotation.set(0.25, 0, -0.55);
  scene.add(group);

  const el = document.getElementById('loader');
  const pctEl = el.querySelector('.loader__pct');
  let shown = -1;
  return {
    uniforms,
    resize(dpr) {
      camera.aspect = innerWidth / innerHeight;
      camera.position.z = camera.aspect < 0.8 ? 21 : 15;
      camera.updateProjectionMatrix();
      uniforms.uPx.value = (innerHeight * dpr) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    },
    render(time) {
      uniforms.uTime.value = time;
      helix.rotation.y = time * 0.35;
      group.rotation.x = 0.25 - input.sy * 0.15;
      group.rotation.z = -0.55 + input.sx * 0.12;
      const p = Math.round(Math.min(uniforms.uP.value, 1) * 100);
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
