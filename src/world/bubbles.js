import * as THREE from 'three';
import { U } from './env.js';
import { WORLD } from '../config/zones.js';

// Streams of bubbles rising to the surface in the sunlit water. Each bubble wobbles,
// grows as it rises, has a bright rim, and drifts away from the cursor ray.
export function createBubbles(count) {
  const streams = [
    [-5.5, -9], [6.5, -12], [-2, -15], [9, -7], [-10, -14], [3.5, -6],
  ];
  const pos = new Float32Array(count * 3);
  const rnd = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const loose = Math.random() < 0.3;
    const s = streams[i % streams.length];
    pos[i * 3] = loose ? (Math.random() - 0.5) * 30 : s[0] + (Math.random() - 0.5) * 0.25;
    pos[i * 3 + 1] = 0;
    pos[i * 3 + 2] = loose ? -3 - Math.random() * 18 : s[1] + (Math.random() - 0.5) * 0.25;
    rnd[i * 4] = Math.random();
    rnd[i * 4 + 1] = Math.random();
    rnd[i * 4 + 2] = Math.random();
    rnd[i * 4 + 3] = loose ? 1 : 0;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uTopY: { value: WORLD.surfaceY }, uSpan: { value: 34 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec4 aRand;
      uniform float uTime, uTopY, uSpan, uPx, uFogD, uRays;
      uniform vec3 uCamPos, uCursorDir;
      varying float vA;
      void main(){
        float speed = 0.55 + aRand.x * 0.9;
        float k = fract(uTime * speed / uSpan + aRand.y);       // 0 = bottom, 1 = surface
        vec3 p = position;
        p.y = uTopY - uSpan + k * uSpan;
        float wob = uTime * (2. + aRand.z * 3.) + aRand.y * 40.;
        p.x += sin(wob) * 0.08 * (0.4 + k) + sin(uTime * 0.3 + aRand.y * 9.) * 0.4 * aRand.w;
        p.z += cos(wob * 0.9) * 0.08 * (0.4 + k);
        // drift away from the cursor ray
        vec3 v = p - uCamPos; float along = dot(v, uCursorDir);
        vec3 off = v - uCursorDir * along; float d = length(off); float r0 = 0.25 + max(along, 0.) * 0.06;
        if (along > 0.) p += normalize(off + 1e-4) * exp(-d * d / (r0 * r0)) * r0;
        vec4 mv = viewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        float size = (0.025 + aRand.x * 0.06) * (0.6 + k * 0.7) * (aRand.w > 0.5 ? 0.6 : 1.);
        gl_PointSize = clamp(size * uPx / max(-mv.z, 0.1), 0., 40.);
        vA = smoothstep(0., 0.12, k) * smoothstep(1., 0.94, k) * exp(-(-mv.z) * uFogD * 1.2) * clamp(uRays * 1.6, 0., 1.);
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main(){
        vec2 c = gl_PointCoord - 0.5; float r = length(c);
        if (r > 0.5) discard;
        float rim = smoothstep(0.32, 0.47, r) * smoothstep(0.5, 0.46, r);
        float fill = smoothstep(0.5, 0.0, r) * 0.12;
        float hi = smoothstep(0.14, 0.0, length(c - vec2(-0.16, 0.16))) * 0.9;
        float a = (rim * 0.85 + fill + hi) * vA;
        gl_FragColor = vec4(vec3(0.85, 1., 1.) * a, a);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 6;
  return {
    points,
    setCount(n) { geo.setDrawRange(0, Math.min(n, count)); },
    update(camera) { points.visible = camera.position.y > -60; },
  };
}
