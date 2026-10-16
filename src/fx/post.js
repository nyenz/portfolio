import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Post stack: glow (bloom) -> the "lens" pass (underwater wobble, colour split at the edges,
// eyelid opening, sonar ring transition, grain, vignette) -> colour output.
export const LENS = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uCA: { value: 0.0016 },
    uGrain: { value: 0.045 },
    uVig: { value: 0.9 },
    uWobble: { value: 1 },
    uLid: { value: 0 },          // 0 = eyes closed, 1 = open
    uExpo: { value: 0 },         // over-exposure while eyes adjust
    uRing: { value: -1 },        // sonar ring radius (screen heights), -1 = off
    uRingC: { value: new THREE.Vector2(0.5, 0.5) },
    uRingAmp: { value: 0 },
    uVel: { value: 0 },
    uDark: { value: 0 },         // global dip to dark (transitions)
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uCA, uGrain, uVig, uWobble, uLid, uExpo, uRing, uRingAmp, uVel, uDark;
    uniform vec2 uRes, uRingC;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      float asp = uRes.x / uRes.y;
      // underwater wobble: slow refraction drift
      uv += vec2(sin(uv.y * 9. + uTime * 0.7), cos(uv.x * 7. + uTime * 0.55)) * 0.0011 * uWobble;

      // sonar ring: a refracting wave that travels out from the click point
      vec2 rc = (uv - uRingC) * vec2(asp, 1.);
      float rd = length(rc);
      float ring = 0.;
      if (uRing > 0.) {
        float w = 0.06 + uRing * 0.05;
        ring = exp(-pow((rd - uRing) / w, 2.)) * uRingAmp;
        uv -= normalize(rc + 1e-5) / vec2(asp, 1.) * ring * 0.035;
      }

      // colour split, stronger toward the edges and while moving fast
      vec2 cc = uv - 0.5;
      float edge = dot(cc, cc);
      vec2 off = cc * (uCA * (1. + edge * 6.) + abs(uVel) * 0.00004 + ring * 0.01);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off).b;

      col += vec3(0.5, 0.95, 1.) * ring * 0.25;           // bright ring edge
      col *= 1. + uExpo * 2.2;                              // eyes adjusting to light
      col = mix(col, vec3(0.), uDark);

      // vignette
      float v = smoothstep(1.25, 0.25, length(cc * vec2(asp * 0.85, 1.)));
      col *= mix(1., v, uVig);

      // eyelids: an almond-shaped opening that widens from the middle
      if (uLid < 0.999) {
        float x = (vUv.x - 0.5) * 2.;
        float shape = (1. - x * x * 0.6) * uLid * 0.75;    // half-height of the opening
        float soft = 0.05 + 0.3 * (1. - uLid);
        float lid = smoothstep(shape + soft * 0.3, shape - soft, abs(vUv.y - 0.5));
        col *= lid * lid;
      }

      // film grain (animated)
      float g = h(vUv * uRes + fract(uTime * 37.) * 100.) - 0.5;
      col += g * uGrain * (0.35 + 0.65 * (1. - dot(col, vec3(0.33))));
      gl_FragColor = vec4(col, 1.);
    }`,
};

export function createPost(renderer, scene, camera, cfg) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: cfg.samples });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x * cfg.bloom, size.y * cfg.bloom), 0.6, 0.55, 0.62);
  composer.addPass(bloom);
  const lens = new ShaderPass(LENS);
  lens.uniforms = LENS.uniforms; // share the object so transitions can drive it
  lens.material.uniforms = LENS.uniforms;
  composer.addPass(lens);
  composer.addPass(new OutputPass());
  return {
    composer, bloom, lens,
    resize(w, h, dpr) {
      composer.setPixelRatio(dpr);
      composer.setSize(w, h);
      LENS.uniforms.uRes.value.set(w * dpr, h * dpr);
    },
  };
}
