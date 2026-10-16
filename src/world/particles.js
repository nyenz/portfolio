import * as THREE from 'three';
import { U } from './env.js';

// Marine snow in three layers (far haze, mid specks, out-of-focus bokeh near the lens).
// Positions wrap around the camera on the GPU, drift with currents, part around the cursor
// ray, catch the torch light, and some glow (bioluminescence) in the deep.
const layers = {
  far:  { box: 46, size: [0.035, 0.08], fall: 0.05, alpha: 0.55, bokeh: 0 },
  mid:  { box: 18, size: [0.03, 0.075], fall: 0.08, alpha: 0.85, bokeh: 0 },
  near: { box: 5,  size: [0.18, 0.42],  fall: 0.06, alpha: 0.22, bokeh: 1 },
};

export function createParticles(kind, count) {
  const L = layers[kind];
  const pos = new Float32Array(count * 3);
  const rnd = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = Math.random() * L.box;
    pos[i * 3 + 1] = Math.random() * L.box;
    pos[i * 3 + 2] = Math.random() * L.box;
    rnd[i * 4] = Math.random();
    rnd[i * 4 + 1] = Math.random();
    rnd[i * 4 + 2] = Math.random();
    rnd[i * 4 + 3] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);

  const uniforms = {
    ...U,
    uBox: { value: L.box },
    uSize: { value: new THREE.Vector2(...L.size) },
    uFall: { value: L.fall },
    uAlpha: { value: L.alpha },
    uBokeh: { value: L.bokeh },
    uPush: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec4 aRand;
      uniform float uTime, uBox, uFall, uSnow, uBio, uTorch, uPx, uFogD, uVel, uBokeh, uPush;
      uniform vec2 uSize;
      uniform vec3 uCamPos, uCursorDir, uFlow;
      varying float vA, vGlow, vBio, vTw;
      void main(){
        float t = uTime;
        vec3 p = position + uFlow;
        p += vec3(sin(t * 0.13 + aRand.y * 31.) * 0.5, -t * uFall * (0.4 + aRand.x), cos(t * 0.11 + aRand.y * 17.) * 0.5);
        p += vec3(sin(t * 0.7 + aRand.z * 40.), sin(t * 0.5 + aRand.x * 30.), cos(t * 0.6 + aRand.w * 20.)) * 0.04; // micro jitter
        p = uCamPos + mod(p - uCamPos + uBox * 0.5, uBox) - uBox * 0.5;

        // part around the cursor ray (like a hand through water)
        vec3 v = p - uCamPos;
        float along = dot(v, uCursorDir);
        vec3 off = v - uCursorDir * along;
        float dist = length(off);
        float r0 = 0.12 + max(along, 0.) * 0.07;
        float infl = along > 0. ? exp(-(dist * dist) / (r0 * r0 * 2.2)) : 0.;
        p += normalize(off + 1e-4) * infl * r0 * 1.4 * uPush;
        vGlow = (along > 0. ? exp(-(dist * dist) / (r0 * r0 * 9.)) : 0.) * uTorch;

        vec4 mv = viewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        float z = -mv.z;
        float size = mix(uSize.x, uSize.y, aRand.x * aRand.x);
        float keep = step(aRand.w, uSnow + uBokeh * 0.6);
        gl_PointSize = clamp(size * uPx / max(z, 0.05), 0., uBokeh > .5 ? 90. : 9.) * keep;

        // fade at the box edges, very near the lens, and with fog
        float edge = 1. - smoothstep(uBox * 0.32, uBox * 0.5, length(v));
        float nearF = smoothstep(0.15, 0.6, z);
        float fog = exp(-z * uFogD * 1.4);
        vA = edge * nearF * fog;
        vBio = step(aRand.z, uBio * 0.22) * (1. - uBokeh);
        vTw = 0.5 + 0.5 * sin(t * (1.2 + aRand.y * 2.5) + aRand.x * 50.);
        vA *= 1. + min(abs(uVel) * 0.02, 0.6); // a touch brighter while moving fast
      }`,
    fragmentShader: /* glsl */`
      uniform float uAlpha, uBokeh, uTorch;
      varying float vA, vGlow, vBio, vTw;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float r = length(c);
        if (r > 0.5) discard;
        float a;
        if (uBokeh > 0.5) {
          a = smoothstep(0.5, 0.42, r) * (0.35 + 0.65 * smoothstep(0.25, 0.47, r)); // soft disc with brighter rim
        } else {
          a = smoothstep(0.5, 0.0, r);
          a *= a;
        }
        vec3 col = vec3(0.78, 0.95, 0.96) * (0.55 + 0.45 * vTw);
        col = mix(col, vec3(0.25, 0.95, 1.0) * (0.6 + 1.6 * vTw), vBio);
        col += vec3(0.6, 0.95, 1.0) * vGlow * 2.2;
        float alpha = a * vA * uAlpha * (1. + vBio * 1.5 + vGlow * 3.);
        gl_FragColor = vec4(col * alpha, alpha);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  return {
    points,
    setCount(n) { geo.setDrawRange(0, Math.min(n, count)); },
  };
}
