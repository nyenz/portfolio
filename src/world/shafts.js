import * as THREE from 'three';
import { U, GLSL_NOISE } from './env.js';
import { WORLD } from '../config/zones.js';

// Volumetric-looking light shafts hanging from the surface. Each is a camera-facing
// ribbon (around the vertical axis) with soft edges and moving noise, so looking around
// gives real parallax between near and far shafts.
export function createShafts(count) {
  const n = count;
  const pos = [], uv = [], data = [], idx = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
    const r = 4 + Math.random() * 20;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r - 6;
    const w = 0.8 + Math.random() * 2.4, h = 26 + Math.random() * 20;
    const seed = Math.random();
    for (let k = 0; k < 4; k++) {
      const sx = k % 2, sy = k < 2 ? 0 : 1;
      pos.push(cx, WORLD.surfaceY, cz);
      uv.push(sx, sy);
      data.push(w, h, seed, (sx - 0.5));
    }
    const b = i * 4;
    idx.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aData', new THREE.Float32BufferAttribute(data, 4));
  geo.setIndex(idx);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      attribute vec4 aData;
      uniform vec3 uCamPos; uniform float uTime;
      varying vec2 vUv; varying float vSeed; varying float vDist;
      void main(){
        vec3 c = position;
        float sway = sin(uTime * 0.15 + aData.z * 20.) * 0.8;
        vec3 toCam = uCamPos - c; toCam.y = 0.;
        vec3 right = normalize(cross(vec3(0., 1., 0.), normalize(toCam + 1e-4)));
        float y = -uv.y * aData.y;
        // shafts lean with the sun direction a little and widen with depth
        vec3 p = c + right * aData.w * aData.x * (1. + uv.y * 0.9) + vec3(sway * uv.y + uv.y * 3., y, uv.y * -1.5);
        vUv = uv; vSeed = aData.z;
        vec4 mv = viewMatrix * vec4(p, 1.);
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uRays, uFogD; uniform vec3 uTop;
      varying vec2 vUv; varying float vSeed; varying float vDist;
      ${GLSL_NOISE}
      void main(){
        float side = 1. - pow(abs(vUv.x - 0.5) * 2., 1.6);
        float len = smoothstep(0., 0.08, vUv.y) * pow(1. - vUv.y, 1.8);
        float n = vnoise(vec2(vUv.x * 3. + vSeed * 9., vUv.y * 4. - uTime * 0.12 + vSeed * 5.));
        float flick = 0.65 + 0.35 * sin(uTime * 0.6 + vSeed * 30.);
        float a = side * len * (0.45 + 0.55 * n) * flick * uRays * 0.11;
        a *= smoothstep(0.6, 3., vDist);           // no harsh slab right in front of the lens
        a *= exp(-vDist * uFogD * 0.6);
        vec3 col = mix(uTop, vec3(0.9, 1., 0.95), 0.4);
        gl_FragColor = vec4(col * a, a);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  return {
    mesh,
    update(camera) {
      mesh.visible = U.uRays.value > 0.01;
      mesh.position.x = Math.round(camera.position.x / 40) * 40; // stays roughly overhead
    },
  };
}
