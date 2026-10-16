import * as THREE from 'three';
import { U, GLSL_NOISE } from './env.js';
import { WORLD } from '../config/zones.js';

// The underside of the sea surface: rippling, with the bright "Snell's window" overhead
// and total internal reflection (darker, mirrored water) toward the horizon.
export function createSurface() {
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uFogD, uRays, uCaustic, uTorch;
      uniform vec3 uTop, uMid, uFog, uCamPos, uCursorDir;
      varying vec3 vWorld;
      ${GLSL_NOISE}
      vec2 waveGrad(vec2 p, float t){
        float e = 0.08;
        float h  = fbm(p * 0.35 + vec2(t * 0.05, t * 0.03)) + 0.5 * fbm(p * 0.9 - vec2(t * 0.09, -t * 0.06));
        float hx = fbm((p + vec2(e, 0.)) * 0.35 + vec2(t * 0.05, t * 0.03)) + 0.5 * fbm((p + vec2(e, 0.)) * 0.9 - vec2(t * 0.09, -t * 0.06));
        float hz = fbm((p + vec2(0., e)) * 0.35 + vec2(t * 0.05, t * 0.03)) + 0.5 * fbm((p + vec2(0., e)) * 0.9 - vec2(t * 0.09, -t * 0.06));
        return vec2(hx - h, hz - h) / e;
      }
      void main(){
        vec3 V = normalize(vWorld - uCamPos);
        vec2 g = waveGrad(vWorld.xz, uTime);
        vec3 N = normalize(vec3(-g.x * 0.35, -1., -g.y * 0.35)); // facing down
        float c = abs(dot(V, N));
        // Snell's window: inside ~48.6° from vertical we see the bright sky
        float win = smoothstep(0.62, 0.70, c);
        vec3 sky = mix(uTop * 1.6, vec3(0.92, 1.0, 1.0), 0.55);
        vec3 refl = mix(uMid * 0.9, uTop * 0.7, 0.35);
        vec3 col = mix(refl, sky, win);
        // bright ripple lines and sparkle
        float cs = caustic(vWorld.xz * 0.06, uTime * 0.35);
        col += vec3(0.8, 1., 1.) * cs * 0.6 * win;
        float spark = pow(max(dot(reflect(V, N), normalize(vec3(0.2, 1., -0.3))), 0.), 200.);
        col += spark * 1.5 * win;
        // fade into the water with distance (fog) and with depth below the surface
        float dist = length(vWorld - uCamPos);
        float fog = 1. - exp(-dist * uFogD * 0.75);
        col = mix(col, uFog, fog);
        float a = (1. - fog * 0.85) * clamp(uRays * 1.2, 0., 1.);
        gl_FragColor = vec4(col, a);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(260, 260, 1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = WORLD.surfaceY;
  mesh.renderOrder = -50;
  return {
    mesh,
    update(camera) {
      mesh.position.x = camera.position.x;
      mesh.position.z = camera.position.z;
      mesh.visible = camera.position.y > -70;
    },
  };
}
