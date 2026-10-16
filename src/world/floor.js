import * as THREE from 'three';
import { U, GLSL_NOISE } from './env.js';
import { WORLD } from '../config/zones.js';

// The abyssal plain: soft sediment dunes, scattered stones, lit only by the cursor torch
// and the warm glow of a distant vent.
function fbm2(x, z) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < 5; i++) {
    s += a * (Math.sin(x * f * 0.9 + Math.cos(z * f * 0.7) * 1.7) * Math.cos(z * f * 1.1 + Math.sin(x * f * 0.6) * 1.3));
    f *= 2.07; a *= 0.5;
  }
  return s;
}

export function createFloor(segments) {
  const floorY = WORLD.startY - WORLD.travel - WORLD.floorOffset;
  const geo = new THREE.PlaneGeometry(140, 140, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    let h = fbm2(x * 0.06, z * 0.06) * 1.6 + fbm2(x * 0.25 + 3, z * 0.25) * 0.25;
    h += Math.max(0, 1 - Math.hypot(x - 7, z + 22) / 9) * 2.4; // the vent mound
    p.setY(i, h);
  }
  geo.computeVertexNormals();
  const vent = new THREE.Vector3(7, floorY + 2.4, -22);
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uVent: { value: vent } },
    vertexShader: /* glsl */`
      varying vec3 vWorld; varying vec3 vN;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.); vWorld = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uTorch, uWarm, uFogD; uniform vec3 uCamPos, uCursorDir, uFog, uVent, uMid;
      varying vec3 vWorld; varying vec3 vN;
      ${GLSL_NOISE}
      void main(){
        vec3 N = normalize(vN);
        // sediment colour with ripples and specks
        float rip = sin(vWorld.x * 2.2 + fbm(vWorld.xz * 0.3) * 6.) * 0.5 + 0.5;
        float speck = step(0.93, hash21(floor(vWorld.xz * 18.)));
        vec3 base = mix(vec3(0.07, 0.075, 0.07), vec3(0.16, 0.15, 0.13), fbm(vWorld.xz * 0.8)) * (0.85 + 0.15 * rip);
        base += speck * 0.05;
        // torch: a spot from the camera along the cursor ray
        vec3 Lv = uCamPos - vWorld; float dl = length(Lv); Lv /= dl;
        float spot = pow(max(dot(-Lv, uCursorDir), 0.), 22.);
        float diff = max(dot(N, Lv), 0.);
        vec3 col = base * vec3(0.55, 0.9, 1.) * diff * spot * 9. / (1. + dl * dl * 0.04) * uTorch;
        // vent glow, flickering
        vec3 Vv = uVent - vWorld; float dv = length(Vv);
        float flick = 0.8 + 0.2 * sin(uTime * 3.1) * sin(uTime * 1.7 + 1.);
        col += base * vec3(1.0, 0.45, 0.15) * max(dot(N, Vv / dv), 0.) * 26. / (1. + dv * dv * 0.12) * uWarm * flick;
        // faint ambient so the floor never goes fully black
        col += base * uMid * 0.6;
        float fog = 1. - exp(-length(vWorld - uCamPos) * uFogD * 1.1);
        gl_FragColor = vec4(mix(col, uFog, fog), 1.);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = floorY;
  mesh.position.z = -16;

  // scattered stones (instanced, low poly, lit the same way via vertex colours)
  const stoneGeo = new THREE.IcosahedronGeometry(1, 1);
  const sp = stoneGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(sp, i);
    v.multiplyScalar(0.75 + Math.random() * 0.4); v.y *= 0.55;
    sp.setXYZ(i, v.x, v.y, v.z);
  }
  stoneGeo.computeVertexNormals();
  const stoneMat = new THREE.ShaderMaterial({ uniforms: mat.uniforms, vertexShader: /* glsl */`
      varying vec3 vWorld; varying vec3 vN;
      void main(){ vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.); vWorld = w.xyz; vN = normalize(mat3(modelMatrix * instanceMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: mat.fragmentShader });
  const N = 90;
  const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), t = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const x = (Math.random() - 0.5) * 70, z = -16 + (Math.random() - 0.5) * 70;
    const h = fbm2(x * 0.06, (z + 16) * 0.06) * 1.6;
    t.set(x, floorY + h + 0.05, z);
    q.setFromEuler(new THREE.Euler(Math.random(), Math.random() * 6, Math.random()));
    const sc = 0.15 + Math.pow(Math.random(), 3) * 1.2;
    s.set(sc, sc, sc);
    stones.setMatrixAt(i, m.compose(t, q, s));
  }
  const group = new THREE.Group();
  group.add(mesh, stones);
  return {
    group, floorY, vent,
    update(camera) { group.visible = camera.position.y < floorY + 60; },
  };
}
