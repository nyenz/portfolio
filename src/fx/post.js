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
    uZoom: { value: 0 },         // radial zoom blur strength (dive-in transitions)
    uZoomC: { value: new THREE.Vector2(0.5, 0.5) },
    uInk: { value: 0 },          // 0..2: ink grows (0->1) then thins into wisps (1->2)
    uInkC: { value: new THREE.Vector2(0.65, 0.4) },
    uGlitch: { value: 0 },       // pressure glitch strength
    uShatter: { value: 0 },      // glass shatter progress
    uBub: { value: 0 },          // bubble rush strength
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uCA, uGrain, uVig, uWobble, uLid, uExpo, uRing, uRingAmp, uVel, uDark, uZoom, uInk, uGlitch, uShatter, uBub;
    uniform vec2 uRes, uRingC, uZoomC, uInkC;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec2 h2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
      return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
    float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.02 + 7.3; a *= .5; } return s; }
    // ink: metaball field of blobs bursting out of the squid, curling with noise
    float inkField(vec2 p, float grow){
      float f = 0.;
      for (int i = 0; i < 9; i++){
        float fi = float(i);
        vec2 dir = vec2(cos(fi * 2.399 + 0.6), sin(fi * 2.399 + 0.6));
        float sp = 0.35 + h(vec2(fi, 3.1)) * 0.9;
        vec2 c = uInkC * vec2(uRes.x / uRes.y, 1.) + dir * grow * sp * 0.9 + vec2(sin(uTime * 0.7 + fi), cos(uTime * 0.6 + fi * 1.7)) * 0.03;
        float r = (0.05 + grow * (0.35 + 0.35 * h(vec2(fi, 9.2))));
        f += r * r / (dot(p - c, p - c) + 1e-4);
      }
      return f;
    }
    void main(){
      vec2 uv = vUv;
      float asp = uRes.x / uRes.y;

      // pressure glitch: blocks slip sideways, lines tear
      if (uGlitch > 0.001) {
        vec2 blk = floor(vUv * vec2(8., 26.) + floor(uTime * 14.));
        float r = h(blk);
        if (r > 1. - uGlitch * 0.55) uv.x += (h(blk + 3.7) - 0.5) * 0.12 * uGlitch;
        uv.y += (h(vec2(floor(uTime * 30.), floor(vUv.y * 90.))) - 0.5) * 0.004 * uGlitch;
      }
      // glass shatter: the view breaks into shards that slide and fall
      float crack = 0.;
      if (uShatter > 0.001) {
        vec2 g = vUv * vec2(asp, 1.) * 5.;
        vec2 gi = floor(g), gf = fract(g);
        float d1 = 8., d2 = 8.; vec2 cell = vec2(0.);
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
          vec2 o = vec2(float(x), float(y)); vec2 pt = o + h2(gi + o);
          float d = length(gf - pt);
          if (d < d1) { d2 = d1; d1 = d; cell = gi + o; } else if (d < d2) d2 = d;
        }
        crack = 1. - smoothstep(0.0, 0.035 + uShatter * 0.03, d2 - d1);
        vec2 rnd = h2(cell) - 0.5;
        float fall = smoothstep(0.35, 1., uShatter) * (0.4 + h(cell) * 0.8);
        uv += rnd * 0.05 * uShatter + vec2(0., fall * fall * 0.9);
      }
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

      // radial zoom blur: streaks rushing out from the centre while diving in
      if (uZoom > 0.001) {
        vec3 acc = col; vec2 zd = (uv - uZoomC) * uZoom * 0.09;
        for (int i = 1; i < 10; i++) acc += texture2D(tDiffuse, uv - zd * float(i)).rgb;
        col = acc / 10.;
      }

      col += vec3(0.5, 0.95, 1.) * ring * 0.25;           // bright ring edge

      // glitch colour tear
      if (uGlitch > 0.001) {
        vec2 go = vec2(0.012 * uGlitch, 0.);
        col.r = mix(col.r, texture2D(tDiffuse, uv + go).r, uGlitch);
        col.b = mix(col.b, texture2D(tDiffuse, uv - go).b, uGlitch);
        col *= 1. + (h(vec2(floor(uTime * 20.), 1.)) - 0.5) * 0.4 * uGlitch;
      }
      // shatter: bright crack lines, darkness behind falling shards
      if (uShatter > 0.001) {
        col += vec3(0.7, 1., 0.85) * crack * (1. - smoothstep(0.4, 0.9, uShatter)) * 0.8;
        col *= 1. - smoothstep(0.55, 1., uShatter) * 0.85 * step(1.0, uv.y);
        col = mix(col, vec3(0.), smoothstep(0.6, 1., uShatter) * step(1., uv.y));
      }
      // ink: grows into a dark cloud, then thins into curling wisps
      if (uInk > 0.001) {
        vec2 p = vUv * vec2(asp, 1.);
        float grow = min(uInk, 1.);
        float thin = max(uInk - 1., 0.);
        float field = inkField(p, grow * 1.4);
        float n = fbm(p * 3.2 + vec2(uTime * 0.05, -uTime * 0.04));
        float thr = 1.0 + thin * 5.5 * (0.4 + n);
        float ink = smoothstep(thr, thr + 0.6, field + n * 0.8);
        ink = max(ink, smoothstep(0.75, 1., grow) * (1. - smoothstep(0., 0.8, thin)) * smoothstep(0.35, 0.6, n + 0.3));
        vec3 inkCol = mix(vec3(0.006, 0.012, 0.02), vec3(0.05, 0.03, 0.09), smoothstep(0.4, 0.8, n));
        float edgeI = ink * (1. - ink) * 4.;
        col = mix(col, inkCol, ink) + vec3(0.15, 0.1, 0.3) * edgeI * 0.25;
      }
      // bubble rush: bubbles streaming up past the lens
      if (uBub > 0.001) {
        vec2 p = vUv * vec2(asp, 1.) * 9.;
        float b = 0.;
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          vec2 q = p * (1. + fi * 0.7) + vec2(0., -uTime * (3. + fi * 2.));
          vec2 qi = floor(q), qf = fract(q) - 0.5 - (h2(qi + fi) - 0.5) * 0.5;
          float r = 0.12 + h(qi * 1.3 + fi) * 0.25;
          float d = length(qf);
          b += (smoothstep(r, r - 0.04, d) - smoothstep(r - 0.05, r - 0.12, d)) * step(0.55, h(qi + fi * 7.));
        }
        col += vec3(0.8, 1., 1.) * b * uBub * 0.6;
        col = mix(col, col * 1.6 + vec3(0.1, 0.25, 0.3), uBub * 0.35);
      }
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
