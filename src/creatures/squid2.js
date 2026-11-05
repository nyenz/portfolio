import * as THREE from 'three';
import { U as ENVU } from '../world/env.js';

/* Colossal squid, rebuilt from Nyenz's reference stills and swim video.
   Proportions are measured from the top and side views, in units of the body length
   (collar rim to fin tip = 1):
   - mantle: a fat egg cut open at the front (big dark collar opening, pale rim), 0.40 long,
     0.42 wide, then a sharp narrowing into a thin tail rod
   - fin: a huge heart shape from 0.40 to the tip, 0.42 wide at its rounded front lobes,
     pale see-through margins, a dark midrib groove running the whole back
   - head: 0.17 long with large silver eyes; funnel under the collar
   - 8 pale arms (~0.45) with saw-tooth hooks on the inner side and pink bands
   - 2 tentacles (~1.25) with thin banded stalks and leaf-shaped serrated clubs
   Swim: fin first, upward. The mantle pulses, the fins beat in a wave, arms gather on each
   push and open on the glide, tentacles trail with a travelling wave. Every part moves together.

   Local axes: +X = toward the fin tip (direction of travel), +Y = back (dorsal), Z = side. */

const cl = (x, a, b) => (x < a ? a : x > b ? b : x);
const lp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const k1 = (dt, r) => 1 - Math.exp(-dt * r);
const TAU = Math.PI * 2;

// part ids (shader)
const P_MANTLE = 0, P_INNER = 1, P_HEAD = 2, P_FIN = 3, P_ARM = 4, P_TENT = 5, P_EYE = 6, P_FUNNEL = 7;

/* ------------------------------------------------------------------ shape */
// mantle half-width along the body (x = 0 at the collar rim)
const MANTLE = [[-0.04, 0.236], [-0.004, 0.228], [0.03, 0.232], [0.1, 0.232], [0.2, 0.202], [0.28, 0.155], [0.34, 0.104], [0.38, 0.064], [0.41, 0.038], [0.45, 0.029], [0.6, 0.021], [0.8, 0.013], [0.95, 0.006], [1.0, 0.002]];
const HEAD = [[0.07, 0.11], [0.02, 0.118], [-0.03, 0.134], [-0.078, 0.14], [-0.125, 0.122], [-0.175, 0.096], [-0.22, 0.078], [-0.258, 0.066], [-0.282, 0.046], [-0.292, 0.001]].reverse();   // ascending x for curve()
function curve(tab, x) {
  // Catmull-Rom through the profile points (smooth, no kinks -> no shading bands)
  if (x <= tab[0][0]) return tab[0][1];
  if (x >= tab[tab.length - 1][0]) return tab[tab.length - 1][1];
  let i = 0; while (i < tab.length - 2 && tab[i + 1][0] < x) i++;
  const p0 = tab[Math.max(0, i - 1)], p1 = tab[i], p2 = tab[i + 1], p3 = tab[Math.min(tab.length - 1, i + 2)];
  const h = p2[0] - p1[0], t = (x - p1[0]) / h;
  const m1 = (p2[1] - p0[1]) / ((p2[0] - p0[0]) || 1) * h, m2 = (p3[1] - p1[1]) / ((p3[0] - p1[0]) || 1) * h;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
}
// fin half-width: rounded front lobes, straight-ish edges to a sharp tip
export function finHalf(x) {
  const u = (x - 0.372) / 0.628;
  if (u <= 0 || u >= 1) return 0;
  if (u < 0.34) return 0.262 * Math.pow(Math.sin((u / 0.34) * Math.PI / 2), 0.38);
  const v = (u - 0.34) / 0.66;
  return 0.262 * Math.pow(1 - v, 0.62);
}

/* --------------------------------------------------------------- geometry */
function GeoBuilder() {
  const pos = [], rest = [], part = [], uv = [], idx = [];
  return {
    pos, rest, part, uv, idx,
    v(p, pr, u, w) { pos.push(p.x, p.y, p.z); rest.push(p.x, p.y, p.z); part.push(pr); uv.push(u, w); return pos.length / 3 - 1; },
    grid(nu, nv, fn, pr, flip, wrapV) {
      const b = pos.length / 3, tmp = new THREE.Vector3();
      for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { fn(i / nu, j / nv, tmp); this.v(tmp, pr, i / nu, j / nv); }
      const C = nv + 1;
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const a = b + i * C + j, c = a + C, d = a + 1, e = c + 1;
        if (flip) idx.push(a, d, c, d, e, c); else idx.push(a, c, d, d, c, e);
      }
      void wrapV;
    },
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('aRest', new THREE.Float32BufferAttribute(rest, 3));
      g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
      g.setAttribute('aUv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    },
  };
}

// cross-section of the mantle: a slightly squarish ellipse with a dorsal groove
function mantlePoint(x, a, scaleR, out) {
  const r = curve(MANTLE, x) * scaleR;
  const mantleZone = 1 - ss(0.36, 0.44, x);
  const hRatio = lp(0.78, lp(0.66, 0.9, ss(-0.01, 0.2, x)), mantleZone);   // flat and wide at the collar, round behind           // tail rod is flatter
  const ca = Math.cos(a), sa = Math.sin(a);
  const sq = 1 + 0.06 * Math.pow(Math.abs(Math.sin(2 * a)), 1.5) * mantleZone; // squarer shoulders
  const groove = 1 - (0.06 + 0.18 * (1 - mantleZone)) * Math.exp(-(a * a) / 0.018) * ss(0.02, 0.12, x);
  const ventralFlat = 1 - 0.06 * Math.exp(-((Math.abs(a) - Math.PI) ** 2) / 0.4) * mantleZone;
  const rr = r * sq * groove * ventralFlat;
  // the body rides slightly high behind the mantle so the fin sits on the back
  const lift = 0.02 * ss(0.3, 0.5, x);
  return out.set(x, ca * rr * hRatio + lift, sa * rr);
}

function buildBody() {
  const B = GeoBuilder();
  const NA = 56;
  // outer mantle + tail rod (angle a: 0 = top)
  const rimX = (a) => -0.03 + 0.075 * (1 - Math.cos(a)) / 2;   // the back of the collar reaches forward over the head; the belly side is cut back
  B.grid(110, NA, (u, v, o) => { const a = (v - 0.5) * TAU; const x = lp(rimX(a), 1.0, Math.pow(u, 1.15)); mantlePoint(x, a, 1, o); }, P_MANTLE, false);
  // inner wall of the collar opening (dark), slightly inside the rim
  B.grid(16, NA, (u, v, o) => { const x = lp(rimX((v - 0.5) * TAU), 0.22, u); const s = lp(1, 0.9, ss(0, 0.05, u)); mantlePoint(x, (v - 0.5) * TAU, s * (1 - u * 0.25), o); }, P_INNER, true);
  // head (neck hidden inside the collar, bulge, crown where the arms grow)
  B.grid(40, 40, (u, v, o) => {
    const x = lp(0.07, -0.292, u), r = curve(HEAD, x), a = (v - 0.5) * TAU;
    o.set(x, Math.cos(a) * r * 0.86 + 0.045 * ss(-0.2, 0.06, x) - 0.005, Math.sin(a) * r * (1 - 0.1 * ss(-0.15, -0.29, x)));
  }, P_HEAD, true);
  // funnel: a short cone under the head, coming out of the collar
  B.grid(8, 14, (u, v, o) => {
    const x = lp(0.02, -0.085, u), r = lp(0.03, 0.017, u), a = (v - 0.5) * TAU;
    o.set(x, -0.06 + Math.cos(a) * r * 0.8 + u * 0.012, Math.sin(a) * r);
  }, P_FUNNEL, true);
  return B.build();
}

function buildEyes() {
  const B = GeoBuilder();
  for (const side of [-1, 1]) {
    B.grid(18, 24, (u, v, o) => {
      const th = u * Math.PI, ph = v * TAU, r = 0.054;
      // the eye looks sideways (local z), u=0 at the pupil
      o.set(Math.sin(th) * Math.cos(ph) * r - 0.08, Math.sin(th) * Math.sin(ph) * r * 0.95 + 0.024, side * (0.122 + Math.cos(th) * r * 0.55));
    }, P_EYE, side < 0);
  }
  return B.build();
}

/* fin: a dynamic double-sided sheet (one per side). Rebuilt on the CPU each frame for the beat. */
function buildFin() {
  const NX = 46, NZ = 14;
  const B = GeoBuilder();
  for (const side of [-1, 1]) {
    B.grid(NX, NZ, (u, v, o) => {
      // rows run from the midline (v=0) to the edge (v=1); the front of each row moves forward
      // toward the edge so the lobes overhang the waist like the reference's heart shape
      const x0 = 0.43 - 0.055 * Math.pow(v, 1.4);
      const x = lp(x0, 1.0, u), w = finHalf(x);
      o.set(x, 0, side * (0.012 + v * Math.max(w - 0.012, 0)));
    }, P_FIN, side > 0);
  }
  const g = B.build();
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
  return { geo: g, NX, NZ };
}

/* limbs: tubes rebuilt from chains each frame */
function buildLimbs(specs, RAD) {
  const B = GeoBuilder();
  const rings = [];
  specs.forEach((L, li) => {
    const start = B.pos.length / 3;
    for (let i = 0; i <= L.n; i++) for (let j = 0; j <= RAD; j++) B.v(new THREE.Vector3(), L.part, i / L.n, j / RAD);
    for (let i = 0; i < L.n; i++) for (let j = 0; j < RAD; j++) {
      const a = start + i * (RAD + 1) + j, c = a + RAD + 1;
      B.idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
    rings.push(start);
    // rest coords for the pattern: (s along, angle, limb id)
    for (let i = 0; i <= L.n; i++) for (let j = 0; j <= RAD; j++) { const k = (start + i * (RAD + 1) + j) * 3; B.rest[k] = (i / L.n) * L.len; B.rest[k + 1] = j / RAD; B.rest[k + 2] = li; }
  });
  const g = B.build();
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
  return { geo: g, rings };
}

/* ----------------------------------------------------------------- shader */
const VERT = /* glsl */`
  attribute vec3 aRest; attribute float aPart; attribute vec2 aUv;
  uniform float uPulse, uFlare, uTime;
  varying vec3 vRest, vN, vW, vL; varying float vPart; varying vec2 vUv;
  void main(){
    vec3 p = position;
    // mantle breathing: the mantle squeezes on each push, the rim flares on the refill
    if (aPart < 1.5) {
      float zone = (1.0 - smoothstep(0.30, 0.43, p.x));
      float rim = 1.0 - smoothstep(0.0, 0.07, p.x);
      float k = 1.0 - uPulse * 0.085 * zone + uFlare * 0.05 * rim;
      p.yz *= k;
    }
    vRest = aRest; vPart = aPart; vUv = aUv;
    vec4 w = modelMatrix * vec4(p, 1.0);
    vW = w.xyz; vL = p;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const FRAG = /* glsl */`
  precision highp float;
  uniform vec3 uCamPos, uSunD, uFog, uTop, uDeepTint;
  uniform float uFogD, uTime, uTorch, uLook, uFin;
  uniform vec2 uEye;
  varying vec3 vRest, vN, vW, vL; varying float vPart; varying vec2 vUv;

  float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * n3(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }

  const vec3 RED = vec3(0.78, 0.06, 0.13);
  const vec3 RED2 = vec3(0.98, 0.22, 0.30);
  const vec3 PALE = vec3(0.92, 0.86, 0.88);
  const vec3 LIMB = vec3(0.82, 0.22, 0.3);

  void main(){
    int part = int(vPart + 0.5);
    vec3 N = normalize(vN + vec3(0.0, 1e-5, 0.0));
    vec3 V = normalize(uCamPos - vW);
    if (!gl_FrontFacing) N = -N;
    {
      vec3 bq = vRest * 46.0;
      float e0 = n3(bq), ex = n3(bq + vec3(0.37, 0.0, 0.0)), ey = n3(bq + vec3(0.0, 0.37, 0.0)), ez = n3(bq + vec3(0.0, 0.0, 0.37));
      vec3 g = vec3(ex - e0, ey - e0, ez - e0);
      N = normalize(N - (g - N * dot(g, N)) * (vPart > 5.5 ? 0.0 : 0.35));
    }
    float alpha = 1.0;
    vec3 base; float spec = 0.55, gloss = 40.0, flecks = 0.0;

    // pattern coordinates that stick to the animal
    vec3 q = vRest;
    if (part == ${P_MANTLE} || part == ${P_HEAD} || part == ${P_FUNNEL}) {
      float m = fbm(q * vec3(7.0, 9.0, 9.0));
      base = mix(RED, RED2, smoothstep(0.35, 0.75, m));
      // pale blotches and fine white flecks (the reference has lots of them on the back)
      float blot = smoothstep(0.55, 0.68, fbm(q * vec3(7.0, 18.0, 18.0) + 3.0)) * (0.5 + 0.5 * smoothstep(0.4, 0.7, fbm(q * 3.0 + 11.0)));
      float fleck = smoothstep(0.8, 0.88, n3(q * vec3(30.0, 70.0, 70.0))) * smoothstep(0.35, 0.6, fbm(q * 4.0 + 5.0));
      float dorsal = smoothstep(-0.05, 0.08, vL.y);
      flecks = clamp(blot * 0.75 + fleck * (0.55 + 0.45 * dorsal), 0.0, 1.0);
      // dark midline groove
      float groove = exp(-pow(vL.z / 0.009, 2.0)) * smoothstep(0.03, 0.15, vL.x) * dorsal;
      float ridge = exp(-pow((abs(vL.z) - 0.022) / 0.01, 2.0)) * smoothstep(0.05, 0.2, vL.x) * dorsal;
      base *= 1.0 - groove * 0.7;
      base = mix(base, RED2 * 1.15, ridge * 0.5);
      // pale collar rim
      float rim = 1.0 - smoothstep(0.012, 0.035, vUv.x * 1.0 + (m - 0.5) * 0.015);
      if (part == ${P_MANTLE}) base = mix(base, PALE * 0.85, rim * 0.85);
      if (part == ${P_HEAD}) { base = mix(base, base * vec3(1.0, 0.9, 0.95), 0.3); flecks *= 0.8; }
      if (part == ${P_FUNNEL}) base = mix(RED, vec3(0.5, 0.2, 0.25), 0.4);
    } else if (part == ${P_INNER}) {
      base = vec3(0.02, 0.035, 0.05);
      float rim = 1.0 - smoothstep(0.0, 0.08, vUv.x);
      base = mix(base, PALE * 0.8, rim);
      spec = 0.15;
    } else if (part == ${P_FIN}) {
      float w = max(1e-3, ${'finHalfGLSL'}(vL.x));
      float e = clamp(abs(vL.z) / w, 0.0, 1.0);
      float m = fbm(q * vec3(6.0, 6.0, 9.0));
      base = mix(RED, RED2, smoothstep(0.35, 0.7, m));
      // ribs radiating from the midline and the dark midrib
      float rib = smoothstep(0.75, 1.0, sin(atan(abs(vL.z), (vL.x - 0.38)) * 60.0 + m * 4.0)) * (1.0 - e) * 0.25;
      base *= 1.0 - rib;
      base *= 1.0 - 0.6 * exp(-pow(vL.z / 0.014, 2.0));
      // pale, see-through margin
      float margin = smoothstep(0.55, 0.9, e + (m - 0.5) * 0.22);
      base = mix(base, PALE * 1.08, margin * 0.92);
      float blot = smoothstep(0.68, 0.76, fbm(q * vec3(8.0, 8.0, 12.0) + 9.0));
      flecks = blot * 0.7 * (1.0 - margin);
      alpha = mix(1.0, 0.5, margin) * (1.0 - smoothstep(0.985, 1.0, e) * 0.6);
      spec = 0.4;
    } else if (part == ${P_ARM} || part == ${P_TENT}) {
      float s = vRest.x, ang = vRest.y;           // distance along the limb, angle around it
      float inner = smoothstep(0.22, 0.0, min(ang, 1.0 - ang)); // the sucker side (faces the body axis)
      float band = smoothstep(0.35, 0.7, sin(s * (part == ${P_ARM} ? 70.0 : 55.0) + vRest.z * 1.7) * 0.5 + 0.5);
      vec3 pink = vec3(0.90, 0.30, 0.40);
      base = mix(LIMB, vec3(0.9, 0.7, 0.72), band * 0.35);
      // the base of each limb is still red like the head
      float root = 1.0 - smoothstep(0.0, part == ${P_ARM} ? 0.3 : 0.12, s);
      base = mix(base, RED2 * 0.95, root * 0.8);
      // hooks/suckers on the inner side: pale with dark dots
      float dots = smoothstep(0.55, 0.8, sin(s * 160.0) * sin(ang * 40.0));
      base = mix(base, vec3(0.92, 0.9, 0.88), inner * 0.5);
      base *= 1.0 - dots * inner * 0.25;
      // the club of the tentacle
      if (part == ${P_TENT}) {
        float club = smoothstep(0.68, 0.74, vUv.x);
        base = mix(base, mix(PALE, pink, smoothstep(0.4, 0.6, sin(s * 120.0) * 0.5 + 0.5) * 0.6), club);
      }
      flecks = smoothstep(0.82, 0.9, n3(vec3(s * 40.0, ang * 12.0, vRest.z))) * 0.5;
      spec = 0.5; gloss = 30.0;
    } else { // eye
      vec3 c = vec3(-0.08, 0.024, sign(vL.z) * 0.122);
      vec3 d = normalize(vL - c);
      vec3 look = normalize(vec3(uEye.x * 0.6, uEye.y * 0.4, sign(vL.z)));
      float k = dot(d, look);
      // red lid -> silver ring -> green-grey iris -> big black pupil
      vec3 iris = mix(vec3(0.62, 0.7, 0.68), vec3(0.36, 0.44, 0.42), smoothstep(0.9, 0.95, k));
      base = mix(RED * 0.6, vec3(0.62, 0.68, 0.7), smoothstep(0.5, 0.56, k));
      base = mix(base, iris * 0.7, smoothstep(0.6, 0.66, k));
      base = mix(base, vec3(0.01, 0.015, 0.02), smoothstep(0.86, 0.89, k));
      spec = 1.6; gloss = 140.0;
    }

    // white flecks are brighter and a bit glossy
    base = mix(base, PALE * 1.05, flecks * 0.8);

    // light: sun from above through water, dark blue-green belly (counter-shading)
    vec3 L = normalize(uSunD);
    float wrap = clamp((dot(N, L) + 0.35) / 1.35, 0.0, 1.0);
    float up = N.y * 0.5 + 0.5;
    vec3 amb = mix(uDeepTint * 1.6, uTop * 0.3 + vec3(0.12, 0.1, 0.1), up);
    vec3 col = base * (amb * 0.8 + vec3(1.0, 0.96, 0.92) * wrap * 1.1);
    // belly falls into a dark teal shadow
    float belly = smoothstep(0.1, -0.5, N.y);
    col = mix(col, uDeepTint * 0.9 + base * 0.12, belly * 0.6);

    // specular + glitter: tiny specks that twinkle as the squid turns (the "shine specs")
    vec3 H = normalize(L + V);
    float sp = pow(max(dot(N, H), 0.0), gloss) * spec + pow(max(dot(N, H), 0.0), 10.0) * spec * 0.22;
    float glit = 0.0;
    if (part != ${P_EYE} && part != ${P_INNER}) {
      float g = n3(q * 140.0 + vec3(0.0, 0.0, floor(dot(V, vec3(3.1, 2.3, 1.7)) * 6.0)));
      glit = smoothstep(0.93, 0.995, g) * (0.25 + 0.75 * wrap) * (0.4 + flecks);
    }
    col += vec3(1.0, 0.96, 0.95) * (sp * (0.35 + flecks) + glit * 0.9);

    // soft rim of water light
    float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    col += uTop * fr * 0.35 * (part == ${P_FIN} ? 1.4 : (part == ${P_ARM} || part == ${P_TENT}) ? 0.25 : 1.0);
    // a little subsurface: thin parts glow red when lit from behind
    if (part == ${P_FIN} || part == ${P_ARM} || part == ${P_TENT}) col += base * pow(max(dot(-N, L), 0.0), 2.0) * 0.25;

    // torch from the cursor
    col *= 1.0 + uTorch * 0.25;

    // water fog
    float d = length(uCamPos - vW);
    float f = 1.0 - exp(-d * uFogD * 0.55);
    col = mix(col, uFog, clamp(f, 0.0, 0.75));
    gl_FragColor = vec4(col, alpha);
  }`;

const FIN_GLSL = /* glsl */`
  float finHalfGLSL(float x){
    float u = (x - 0.372) / 0.628;
    if (u <= 0.0 || u >= 1.0) return 0.0;
    if (u < 0.34) return 0.262 * pow(sin((u / 0.34) * 1.5707963), 0.38);
    float v = (u - 0.34) / 0.66;
    return 0.262 * pow(max(1.0 - v, 0.0), 0.62);
  }`;

/* ----------------------------------------------------------------- squid */
export function createSquid() {
  const holder = new THREE.Group();     // placed in the world by the caller
  const body = new THREE.Group();       // orientation + swim motion
  holder.add(body);

  const uniforms = {
    uPulse: { value: 0 }, uFlare: { value: 0 }, uTime: ENVU.uTime, uFin: { value: 0 },
    uCamPos: ENVU.uCamPos, uSunD: { value: new THREE.Vector3(0.3, 1, 0.4).normalize() },
    uFog: ENVU.uFog, uFogD: ENVU.uFogD, uTop: ENVU.uTop, uDeepTint: { value: new THREE.Color(0x06222c) },
    uTorch: { value: 0.3 }, uLook: { value: 0 }, uEye: { value: new THREE.Vector2() },
  };
  const frag = FRAG.replace('precision highp float;', 'precision highp float;\n' + FIN_GLSL).replace("${'finHalfGLSL'}", 'finHalfGLSL');
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: frag, side: THREE.DoubleSide });
  const finMat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: frag, side: THREE.DoubleSide, transparent: true, depthWrite: true });

  const bodyMesh = new THREE.Mesh(buildBody(), mat);
  const eyeMesh = new THREE.Mesh(buildEyes(), mat);
  const fin = buildFin();
  const finMesh = new THREE.Mesh(fin.geo, finMat);
  finMesh.renderOrder = 2;
  body.add(bodyMesh, eyeMesh, finMesh);

  // ---- limbs
  const RAD = 10;
  const specs = [];
  const ARMN = 8;
  for (let i = 0; i < ARMN; i++) {
    // arm pairs: dorsal pair shortest, ventral-lateral pair longest (squid arm formula)
    const ang = ((i + 0.5) / ARMN) * TAU;          // around the crown, 0 = top
    const pair = Math.min(i, ARMN - 1 - i);         // 0 top .. 3 bottom
    const len = [0.42, 0.46, 0.5, 0.44][pair];
    specs.push({ kind: 'arm', part: P_ARM, ang, len, n: 34, r0: 0.025, r1: 0.0025, ph: i * 1.7 });
  }
  for (const s of [-1, 1]) specs.push({ kind: 'tent', part: P_TENT, ang: Math.PI + s * 0.55, len: 1.28, n: 96, r0: 0.013, r1: 0.007, ph: s > 0 ? 0 : 2.4, side: s });
  const limbs = buildLimbs(specs, RAD);
  const limbMesh = new THREE.Mesh(limbs.geo, mat);
  limbMesh.frustumCulled = false; finMesh.frustumCulled = false;
  body.add(limbMesh);

  const LP = limbs.geo.attributes.position.array, LN = limbs.geo.attributes.normal.array;
  const FP = fin.geo.attributes.position.array, FN = fin.geo.attributes.normal.array, FR = fin.geo.attributes.aRest.array;

  // chain state for each limb: points + a lagged copy for drag
  const chains = specs.map((L) => ({ pts: Array.from({ length: L.n + 1 }, () => new THREE.Vector3()), lag: Array.from({ length: L.n + 1 }, () => new THREE.Vector3()), init: false }));

  // ---- swim state
  const Q = {
    t: 0, mode: 'cruise', modeT: 0,
    cyc: 0,           // mantle cycle phase 0..1
    pulse: 0,         // 0 relaxed .. 1 squeezed
    jet: 0,           // set to 1 to fire a strong jet
    jetE: 0,          // jet envelope
    agit: 0, spread: 0.3, finAmp: 0.6, speed: 0.5, surge: 0,
    yaw: 0, pitch: 0, roll: 0, eye: new THREE.Vector2(),
  };

  const tmp = new THREE.Vector3(), tA = new THREE.Vector3(), tB = new THREE.Vector3(), tN = new THREE.Vector3(), tBn = new THREE.Vector3(), tT = new THREE.Vector3(), prevN = new THREE.Vector3();
  const qBody = new THREE.Quaternion(), qTmp = new THREE.Quaternion(), eul = new THREE.Euler();

  /* mantle cycle: quick squeeze (push) then slow refill (glide) */
  function cycleShape(c) {
    const push = 0.32;
    return c < push ? Math.sin((c / push) * Math.PI / 2) : 1 - ss(push, 1, c);
  }

  function updateFin(t) {
    const NX = fin.NX, NZ = fin.NZ;
    const beatW = 4.4 + Q.agit * 3, amp = Q.finAmp;
    let k = 0;
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) {
        const ri = k * 3; const x = FR[ri], z = FR[ri + 2];
        const w = Math.max(finHalf(x), 1e-3), e = Math.min(Math.abs(z) / w, 1);
        // the fin beats up and down in a wave running from front to tip; lobes lead
        const wave = Math.sin(beatW * t - x * 7.5 + (side ? 0 : 0.0));
        const fold = Q.jetE * 0.9 + Q.pulse * 0.12;    // folds down along the body during a push
        const lift = (wave * amp * 0.17 * Math.pow(e, 1.25) - fold * 0.16 * Math.pow(e, 1.1)) * ss(0.36, 0.5, x);
        // a soft cup across the fin (edges slightly up when relaxed)
        const cup = 0.02 * e * e * (1 - Q.pulse) + 0.006 * Math.sin(x * 120 + t * 2) * ss(0.8, 1, e);
        // the tip flicks a little
        const tip = Math.sin(beatW * t - 6.5) * 0.012 * ss(0.85, 1, x) * amp;
        const zz = z * (1 - fold * 0.12 * e);
        FP[ri] = x; FP[ri + 1] = 0.018 + 0.02 * ss(0.3, 0.5, x) + lift + cup + tip; FP[ri + 2] = zz;
        k++;
      }
    }
    // normals (fast: from neighbours in the grid)
    k = 0;
    const C = NZ + 1;
    for (let side = 0; side < 2; side++) {
      const base = side * (NX + 1) * C;
      for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) {
        const a = base + i * C + j;
        const ia = base + Math.min(i + 1, NX) * C + j, ib = base + Math.max(i - 1, 0) * C + j;
        const ja = base + i * C + Math.min(j + 1, NZ), jb = base + i * C + Math.max(j - 1, 0);
        tA.set(FP[ia * 3] - FP[ib * 3], FP[ia * 3 + 1] - FP[ib * 3 + 1], FP[ia * 3 + 2] - FP[ib * 3 + 2]);
        tB.set(FP[ja * 3] - FP[jb * 3], FP[ja * 3 + 1] - FP[jb * 3 + 1], FP[ja * 3 + 2] - FP[jb * 3 + 2]);
        tN.crossVectors(tB, tA); if (tN.lengthSq() < 1e-14) tN.set(0, 1, 0); tN.normalize(); if (tN.y < 0) tN.negate();
        FN[a * 3] = tN.x; FN[a * 3 + 1] = tN.y; FN[a * 3 + 2] = tN.z;
        k++;
      }
    }
    fin.geo.attributes.position.needsUpdate = true;
    fin.geo.attributes.normal.needsUpdate = true;
  }

  /* limbs: each is a curve grown from its root, shaped by the swim cycle, then dragged by water */
  function updateLimbs(dt, t) {
    specs.forEach((L, li) => {
      const ch = chains[li], P = ch.pts;
      const isT = L.kind === 'tent';
      const ca = Math.cos(L.ang), sa = Math.sin(L.ang);
      // root on the crown of the head
      const rootR = isT ? 0.03 : 0.046;
      P[0].set(-0.255, ca * rootR * 0.9 + 0.014, sa * rootR);
      // radial direction of this limb and a perpendicular for waves
      const rad = tA.set(0, ca, sa);
      const perp = tB.set(0, -sa, ca);
      const seg = L.len / L.n;
      // arms: open on the glide, gather on the push; tentacles stay close and long
      const spread = isT ? 0.05 + 0.05 * (1 - Q.pulse) : Q.spread * (1 - Q.pulse * 0.75) * (1 - Q.jetE * 0.7) * (0.85 + 0.3 * Math.sin(t * 0.7 + L.ph));
      const dir = tT.set(-1, 0, 0);
      for (let i = 1; i <= L.n; i++) {
        const s = i / L.n;
        // waves travel from root to tip (the trailing limbs ripple in the flow)
        const wv = isT ? 2.6 : 3.4;
        const w1 = Math.sin(TAU * (s * (isT ? 1.6 : 1.1)) - wv * t + L.ph);
        const w2 = Math.cos(TAU * (s * (isT ? 1.1 : 0.8)) - wv * 0.7 * t + L.ph * 1.3);
        const ampA = (isT ? 1.6 : 1.15) * (0.25 + 0.75 * s) * (0.75 + Q.agit * 0.8 + (Q.mode === 'idle' ? 0.4 : 0));
        // opening angle: wide near the root, closing toward the tips (arms curl back in)
        const open = spread * (1.3 - s * (isT ? 0.4 : 1.6));
        dir.set(-1, 0, 0)
          .addScaledVector(rad, open)
          .addScaledVector(perp, w1 * ampA * 0.18)
          .addScaledVector(rad, w2 * ampA * 0.12);
        if (isT) {
          // tentacles: long lazy S-curves, slightly apart, a slow sway of the clubs
          dir.addScaledVector(perp, L.side * (0.07 + 0.12 * Math.sin(t * 0.55 + L.ph)) * (1 - s * 0.4));
          dir.addScaledVector(rad, 0.22 * Math.sin(t * 0.9 + s * 3.5 + L.ph) * s);   // clubs swing slowly
        }
        dir.normalize();
        P[i].copy(P[i - 1]).addScaledVector(dir, seg);
      }
      // water drag: points further out lag behind body motion (in local space this shows as a soft follow)
      if (!ch.init) { for (let i = 0; i <= L.n; i++) ch.lag[i].copy(P[i]); ch.init = true; }
      for (let i = 1; i <= L.n; i++) {
        const s = i / L.n, f = k1(dt, lp(30, isT ? 3.5 : 6, s));
        ch.lag[i].lerp(P[i], f);
      }
      ch.lag[0].copy(P[0]);
      // keep segment lengths
      for (let i = 1; i <= L.n; i++) { tmp.subVectors(ch.lag[i], ch.lag[i - 1]); const d = tmp.length() || 1; ch.lag[i].copy(ch.lag[i - 1]).addScaledVector(tmp, seg / d); }
      writeTube(li, L, ch.lag);
    });
    limbs.geo.attributes.position.needsUpdate = true;
    limbs.geo.attributes.normal.needsUpdate = true;
  }

  function writeTube(li, L, P) {
    const start = limbs.rings[li];
    const isT = L.kind === 'tent';
    // inner direction: toward the body axis (the sucker side faces in)
    prevN.set(0, -Math.cos(L.ang), -Math.sin(L.ang));
    for (let i = 0; i <= L.n; i++) {
      const s = i / L.n;
      const a = P[Math.max(i - 1, 0)], b = P[Math.min(i + 1, L.n)];
      tT.subVectors(b, a).normalize();
      // parallel transport the inner normal
      tN.copy(prevN).addScaledVector(tT, -prevN.dot(tT)).normalize();
      prevN.copy(tN);
      tBn.crossVectors(tT, tN);
      let r = lp(L.r0, L.r1, Math.pow(s, isT ? 0.5 : 0.62));
      if (!isT) r *= 1 + 0.45 * (1 - ss(0.0, 0.14, s));   // webbed base merges into the head
      let flatW = 1, flatH = 1, serr = 0;
      if (isT) {
        const cu = cl((s - 0.68) / 0.32, 0, 1); const club = Math.pow(Math.sin(Math.pow(cu, 0.8) * Math.PI), 0.75);
        flatW = 1 + club * 7.5; flatH = 1 - club * 0.45;
        serr = club * 0.55 * Math.pow(0.5 + 0.5 * Math.sin(s * 640), 2);
        r *= 1 - ss(0.9, 1.0, s) * 0.75;
      } else {
        serr = 0.32 * Math.pow(0.5 + 0.5 * Math.sin(s * 300), 3) * ss(0.05, 0.2, s);
        if (s > 0.97) r *= 0.6;
      }
      for (let j = 0; j <= RAD; j++) {
        const th = (j / RAD) * TAU;  // 0 = inner side
        const c = Math.cos(th), sn = Math.sin(th);
        let rr = r;
        // saw-tooth hooks along the inner side (arms) / both edges of the club (tentacles)
        if (!isT) rr *= 1 + serr * Math.max(0, c) * Math.max(0, c);
        const ex = isT ? Math.abs(sn) : 0;
        if (isT) rr *= 1 + serr * Math.pow(ex, 6);
        const k = (start + i * (RAD + 1) + j) * 3;
        const ox = c * rr * flatH, oy = sn * rr * flatW;
        LP[k] = P[i].x + tN.x * ox + tBn.x * oy;
        LP[k + 1] = P[i].y + tN.y * ox + tBn.y * oy;
        LP[k + 2] = P[i].z + tN.z * ox + tBn.z * oy;
        tmp.set(0, 0, 0).addScaledVector(tN, c * flatW).addScaledVector(tBn, sn * flatH).normalize();
        LN[k] = tmp.x; LN[k + 1] = tmp.y; LN[k + 2] = tmp.z;
      }
    }
  }

  /* one step of the swim */
  function step(dt, ctx) {
    Q.t += dt; Q.modeT += dt;
    const t = Q.t;
    const wantIdle = ctx.idle > 7;
    if (wantIdle && Q.mode !== 'idle') { Q.mode = 'idle'; Q.modeT = 0; }
    if (!wantIdle && Q.mode === 'idle') { Q.mode = 'cruise'; Q.modeT = 0; }
    Q.agit = lp(Q.agit, ctx.agitate || 0, k1(dt, (ctx.agitate || 0) > Q.agit ? 6 : 0.8));

    // mantle cycle speed: gentle in cruise, slow in hover, quicker when nervous
    const period = Q.mode === 'idle' ? 2.6 : 1.7 - Q.agit * 0.6;
    if (Q.jet >= 1) { Q.jetE = 1; Q.jet = 0; Q.cyc = 0; }
    Q.jetE = Math.max(0, Q.jetE - dt * 0.55);
    Q.cyc = (Q.cyc + dt / period * (1 + Q.jetE * 1.5)) % 1;
    const shape = cycleShape(Q.cyc);
    Q.pulse = lp(Q.pulse, Math.max(shape * (Q.mode === 'idle' ? 0.5 : 0.85), Q.jetE * (Q.cyc < 0.3 ? 1 : 0)), k1(dt, 14));
    // forward surge comes from the push; it decays into a glide
    const push = Q.cyc < 0.32 ? 1 : 0;
    Q.speed = lp(Q.speed, (Q.mode === 'idle' ? 0.12 : 0.42) + push * (0.35 + Q.jetE * 1.6) + Q.agit * 0.4, k1(dt, push ? 5 : 1.4));
    Q.surge = lp(Q.surge, push * 0.045 * (1 + Q.jetE * 1.5), k1(dt, push ? 6 : 1.8));
    Q.spread = lp(Q.spread, Q.mode === 'idle' ? 0.6 : 0.34 + Q.agit * 0.3, k1(dt, 1.5));
    Q.finAmp = lp(Q.finAmp, (Q.mode === 'idle' ? 0.85 : 0.6) * (1 - Q.jetE * 0.8) + Q.agit * 0.3, k1(dt, 2));

    // body attitude: fin first and upward; a slow drift so it never looks fixed
    const curious = (ctx.pointerX || 0);
    Q.yaw = lp(Q.yaw, 0.12 * Math.sin(t * 0.23) + curious * 0.12 * (1 - Q.agit) - curious * 0.2 * Q.agit, k1(dt, 0.8));
    Q.pitch = lp(Q.pitch, 0.06 * Math.sin(t * 0.31 + 1) + (ctx.pointerY || 0) * 0.06 + (Q.mode === 'idle' ? -0.25 : 0), k1(dt, 0.8));
    Q.roll = lp(Q.roll, 0.1 * Math.sin(t * 0.19 + 2) - curious * 0.1, k1(dt, 0.7));
    Q.eye.x = lp(Q.eye.x, cl(ctx.pointerX || 0, -1, 1), k1(dt, 6));
    Q.eye.y = lp(Q.eye.y, cl(ctx.pointerY || 0, -1, 1), k1(dt, 6));

    uniforms.uPulse.value = Q.pulse;
    uniforms.uFlare.value = (1 - Q.pulse) * ss(0.4, 0.8, Q.cyc);
    uniforms.uEye.value.copy(Q.eye);
  }

  function apply(dt) {
    // base orientation: travel direction up and to the right, back toward the viewer
    eul.set(Q.pitch, Q.yaw, Q.roll, 'YXZ');
    body.quaternion.copy(qBody).multiply(qTmp.setFromEuler(eul));
    // the whole body bobs forward on each push
    body.position.set(Q.surge, 0, 0).applyQuaternion(body.quaternion);
    updateFin(Q.t);
    updateLimbs(dt, Q.t);
  }

  // travel direction: local +X points up-right, slightly toward the camera; dorsal side faces the viewer
  {
    const fwd = new THREE.Vector3(0.62, 0.78, 0.08).normalize();
    const up = new THREE.Vector3(-0.1, 0.05, 1).normalize();   // dorsal (+Y local) faces the camera
    const side = new THREE.Vector3().crossVectors(fwd, up).normalize();
    up.crossVectors(side, fwd).normalize();
    const m = new THREE.Matrix4().makeBasis(fwd, up, side);
    qBody.setFromRotationMatrix(m);
  }

  // prime so limbs already trail on the first frame
  for (let i = 0; i < 120; i++) { step(1 / 60, { idle: 0, pointerX: 0, pointerY: 0 }); apply(1 / 60); }

  const proj = new THREE.Vector3();
  const BODY_LEN = 1.9;              // world size of the body (collar to fin tip)
  body.scale.setScalar(BODY_LEN);
  const CENTER = new THREE.Vector3(0.1, 0, 0);   // what the holder keeps on the anchor (local)

  return {
    group: holder,
    state: Q,
    setOrientation(fwd, up) {
      const f = fwd.clone().normalize(), u0 = up.clone().normalize();
      const s = new THREE.Vector3().crossVectors(f, u0).normalize();
      const u = new THREE.Vector3().crossVectors(s, f).normalize();
      qBody.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f, u, s));
    },
    /** ctx: { anchor, camera, idle, pointerX, pointerY, pointerPx, pointerPy, pointerSpeed, exit } */
    update(dt, ctx) {
      holder.updateMatrixWorld();
      proj.copy(CENTER).applyMatrix4(body.matrixWorld).project(ctx.camera);
      const sx = (proj.x * 0.5 + 0.5) * innerWidth, sy = (-proj.y * 0.5 + 0.5) * innerHeight;
      const near = Math.max(0, 1 - Math.hypot((ctx.pointerPx ?? -1e4) - sx, (ctx.pointerPy ?? -1e4) - sy) / 320);
      const agitate = cl(((ctx.pointerSpeed || 0) - 1.2) / 3, 0, 1) * near;
      step(dt, { idle: ctx.idle, pointerX: ctx.pointerX, pointerY: ctx.pointerY, agitate });
      apply(dt);
      // keep the body centre on the anchor
      tmp.copy(CENTER).multiplyScalar(BODY_LEN).applyQuaternion(body.quaternion);
      holder.position.copy(ctx.anchor).sub(tmp);
      holder.position.y += (ctx.exit || 0) * (ctx.exit || 0) * 9;
      uniforms.uTorch.value = ENVU.uTorch.value * 1.4 + 0.15;
      tmp.set(0.35 + (ctx.pointerX || 0) * 0.4, 1, 0.5 + (ctx.pointerY || 0) * 0.2).normalize();
      uniforms.uSunD.value.lerp(tmp, k1(dt, 2));
    },
    flow() { return Q.speed; },
    dispose() { bodyMesh.geometry.dispose(); eyeMesh.geometry.dispose(); fin.geo.dispose(); limbs.geo.dispose(); mat.dispose(); finMat.dispose(); },
  };
}
