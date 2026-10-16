import * as THREE from 'three';
import { U, GLSL_NOISE } from './env.js';

// The water volume all around the camera: colour by view direction, sun glow,
// god rays converging toward the surface, the cursor torch haze and the abyss vent glow.
export function createWater() {
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uRays, uTorch, uWarm, uDepth, uBio;
      uniform vec3 uTop, uMid, uDeep, uSun, uCursorDir, uCamPos;
      varying vec3 vWorld;
      ${GLSL_NOISE}
      void main(){
        vec3 d = normalize(vWorld - uCamPos);
        float y = d.y;
        // base gradient: deep below, mid level, bright toward the surface
        vec3 col = mix(uDeep, uMid, smoothstep(-0.95, 0.15, y));
        col = mix(col, uTop, smoothstep(0.05, 0.98, y) * 0.9);

        // sun glow through the water
        float sd = max(dot(d, uSun), 0.);
        col += uTop * (pow(sd, 5.) * 0.55 + pow(sd, 48.) * 0.9) * uRays;

        // god rays: streaks around the sun direction, swaying slowly
        vec3 axis = uSun;
        vec3 tA = normalize(cross(axis, vec3(0., 0., 1.)));
        vec3 tB = cross(axis, tA);
        float ang = atan(dot(d, tB), dot(d, tA));
        float spread = acos(clamp(sd, -1., 1.));
        float r = vnoise(vec2(ang * 7.0 + uTime * 0.05, uTime * 0.04)) * 0.65
                + vnoise(vec2(ang * 19.0 - uTime * 0.08, 3.1 + uTime * 0.07)) * 0.35;
        r = smoothstep(0.42, 0.95, r);
        float rayMask = smoothstep(1.45, 0.05, spread) * smoothstep(-0.25, 0.55, y);
        col += mix(uTop, vec3(0.85, 1., 0.98), 0.35) * r * rayMask * 0.32 * uRays;

        // the cursor torch lights the haze it points through
        float td = max(dot(d, uCursorDir), 0.);
        vec3 torchCol = vec3(0.55, 0.92, 1.0);
        col += torchCol * (pow(td, 160.) * 0.32 + pow(td, 22.) * 0.035) * uTorch;

        // deep-sea vent: warm glow rising from below in the abyss
        float down = max(-y, 0.);
        col += vec3(1.0, 0.42, 0.12) * pow(down, 2.2) * 0.22 * uWarm;
        col += vec3(1.0, 0.55, 0.2) * pow(max(dot(d, normalize(vec3(0.35, -0.55, -1.))), 0.), 14.) * 0.25 * uWarm;

        // faint distant bioluminescent haze in the deep
        float bio = vnoise(d.xz * 6. + uTime * 0.02) * vnoise(d.yx * 9. - uTime * 0.03);
        col += vec3(0.1, 0.45, 0.6) * smoothstep(0.55, 0.9, bio) * 0.05 * uBio;

        // dither to kill banding in the dark gradients
        col += (hash21(gl_FragCoord.xy + fract(uTime) * 61.) - 0.5) / 180.;
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(70, 48, 32), mat);
  mesh.renderOrder = -100;
  mesh.frustumCulled = false;
  return {
    mesh,
    update(camera) { mesh.position.copy(camera.position); },
  };
}
