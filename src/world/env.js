import * as THREE from 'three';
import { ENV } from '../config/zones.js';

// Shared uniforms every ocean shader reads. Updated once per frame from the depth.
const C = () => ({ value: new THREE.Color() });
export const U = {
  uTime: { value: 0 },
  uDepth: { value: 0 },          // metres
  uTop: C(), uMid: C(), uDeep: C(), uFog: C(),
  uFogD: { value: 0.03 },
  uRays: { value: 1 },
  uCaustic: { value: 1 },
  uSnow: { value: 0.4 },
  uBio: { value: 0 },
  uTorch: { value: 0.1 },        // strength of the cursor torch
  uWarm: { value: 0 },
  uSun: { value: new THREE.Vector3(0.25, 1, -0.35).normalize() },
  uCursorDir: { value: new THREE.Vector3(0, 0, -1) }, // world-space ray from camera through the cursor
  uCamPos: { value: new THREE.Vector3() },
  uVel: { value: 0 },            // scroll speed (for streaks)
  uPx: { value: 1 },             // pixel scale for point sizes
  uFlow: { value: new THREE.Vector3() }, // water streaming past (a creature swimming makes specks rush by)
};

export const envState = { bloom: 0.6 };

const cache = ENV.map((k) => ({
  ...k,
  top: new THREE.Color(k.top), mid: new THREE.Color(k.mid), deep: new THREE.Color(k.deep), fog: new THREE.Color(k.fog),
}));
const smooth = (x) => x * x * (3 - 2 * x);

export function updateEnv(depth) {
  let i = 0;
  while (i < cache.length - 2 && cache[i + 1].d < depth) i++;
  const a = cache[i], b = cache[i + 1];
  const f = smooth(Math.min(Math.max((depth - a.d) / (b.d - a.d), 0), 1));
  U.uDepth.value = depth;
  U.uTop.value.lerpColors(a.top, b.top, f);
  U.uMid.value.lerpColors(a.mid, b.mid, f);
  U.uDeep.value.lerpColors(a.deep, b.deep, f);
  U.uFog.value.lerpColors(a.fog, b.fog, f);
  const L = (k) => a[k] + (b[k] - a[k]) * f;
  U.uFogD.value = L('fogD');
  U.uRays.value = L('rays');
  U.uCaustic.value = L('caustic');
  U.uSnow.value = L('snow');
  U.uBio.value = L('bio');
  U.uTorch.value = L('torch');
  U.uWarm.value = L('warm');
  envState.bloom = L('bloom');
}

// GLSL helpers shared by the ocean shaders.
export const GLSL_NOISE = /* glsl */`
float hash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(hash21(i), hash21(i+vec2(1,0)), f.x), mix(hash21(i+vec2(0,1)), hash21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
float hash31(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.-2.*f);
  return mix(mix(mix(hash31(i), hash31(i+vec3(1,0,0)), f.x), mix(hash31(i+vec3(0,1,0)), hash31(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash31(i+vec3(0,0,1)), hash31(i+vec3(1,0,1)), f.x), mix(hash31(i+vec3(0,1,1)), hash31(i+vec3(1,1,1)), f.x), f.y), f.z); }
// Dave Hoskins-style animated caustic pattern (cheap, tileable-looking)
float caustic(vec2 uv, float t){
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.;
  vec2 i = p; float c = 1.; float inten = .005;
  for (int n = 0; n < 4; n++){
    float tt = t * (1. - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1. / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.; c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.);
}
`;
