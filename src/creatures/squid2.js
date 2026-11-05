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
const P_MANTLE = 0, P_INNER = 1, P_HEAD = 2, P_FIN = 3, P_ARM = 4, P_TENT = 5, P_EYE = 6, P_FUNNEL = 7, P_HOOK = 8;

/* ------------------------------------------------------------------ shape */
// mantle half-width along the body (x = 0 at the collar rim)
const MANTLE = [[-0.1, 0.176], [-0.07, 0.187], [-0.04, 0.196], [0.0, 0.205], [0.04, 0.213], [0.09, 0.215], [0.15, 0.21], [0.21, 0.199], [0.27, 0.181], [0.32, 0.158], [0.36, 0.13], [0.39, 0.102], [0.42, 0.072], [0.45, 0.046], [0.5, 0.03], [0.6, 0.022], [0.8, 0.013], [0.95, 0.006], [1.0, 0.002]];
const HEAD = [[0.07, 0.066], [0.03, 0.068], [0.0, 0.07], [-0.04, 0.08], [-0.08, 0.09], [-0.11, 0.088], [-0.15, 0.076], [-0.19, 0.064], [-0.22, 0.052], [-0.237, 0.034], [-0.245, 0.001]].reverse();   // ascending x for curve()
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
  const u = (x - 0.4) / 0.6;
  if (u <= 0 || u >= 1) return 0;
  if (u < 0.32) return 0.31 * Math.pow(Math.sin((u / 0.32) * Math.PI / 2), 0.42);   // big rounded front lobes
  const v = (u - 0.32) / 0.68;
  return 0.31 * Math.pow(1 - v, 0.55);                                              // near-straight edges to the tip
}

/* --------------------------------------------------------------- geometry */
function GeoBuilder() {
  const pos = [], rest = [], part = [], uv = [], idx = [];
  return {
    pos, rest, part, uv, idx,
    v(p, pr, u, w) { pos.push(p.x, p.y, p.z); rest.push(p.x, p.y, p.z); part.push(pr); uv.push(u, w); return pos.length / 3 - 1; },
    grid(nu, nv, fn, pr, flip, wrapV, uvx) {
      const b = pos.length / 3, tmp = new THREE.Vector3();
      for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { fn(i / nu, j / nv, tmp); this.v(tmp, pr, uvx === undefined ? i / nu : uvx, j / nv); }
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
// collar edge: the back reaches forward over the head, the belly side is cut back with a notch for the funnel
const rimX = (a) => -0.085 + 0.17 * Math.pow((1 - Math.cos(a)) / 2, 1.15) + 0.03 * Math.exp(-Math.pow((Math.abs(a) - Math.PI) / 0.32, 2));
function mantlePoint(x, a, scaleR, out) {
  // near the lip the belly side curls in, so the opening reads as a rounded mouth, not a cut tube
  const vent = Math.pow(Math.max(0, -Math.cos(a)), 1.5);
  const nearLip = 1 - ss(rimX(a), rimX(a) + 0.12, x);
  const r = curve(MANTLE, x) * scaleR * (1 + 0.03 * (1 - ss(-0.08, 0.05, x))) * (1 - 0.16 * vent * nearLip * nearLip);
  const mantleZone = 1 - ss(0.36, 0.44, x);
  const hRatio = lp(1.55, 0.86 + 0.16 * Math.exp(-Math.pow((x - 0.13) / 0.22, 2)), mantleZone);   // fullest in the front third (side photo)   // flatter at the collar, deep mid-mantle   // deepest mid-mantle (side photo)   // round at the collar, deeper than wide toward the rear (side photo)   // wide and flat at the collar, deep and round behind it   // flat and wide at the collar, round behind           // tail rod is flatter
  const ca = Math.cos(a), sa = Math.sin(a);
  const sq = 1;
  const rk = ss(0.03, 0.2, x) * mantleZone;
  const keel = ss(0.04, 0.36, x);
  const groove = (1 + 0.2 * keel * mantleZone * Math.exp(-(a * a) / 0.14))            // roof shape
               * (1 + 0.15 * keel * Math.exp(-(a * a) / 0.006))                         // the raised rod on the midline
               * (1 - 0.06 * keel * Math.exp(-Math.pow(Math.abs(a) - 0.2, 2) / 0.004));   // a crease each side of the rod
  void rk;
  const ventralFlat = 1;
  const rr = r * sq * groove * ventralFlat;
  const yAsym = lp(1, lp(0.92, 1.14, (1 - ca) / 2), mantleZone);   // flatter back, fuller belly, kept smooth along the body   // flatter back, deep rounded belly
  // the body rides slightly high behind the mantle so the fin sits on the back
  const lift = 0.02 * ss(0.3, 0.5, x);
  return out.set(x, ca * rr * hRatio * yAsym + lift - 0.012 * mantleZone, sa * rr);
}

function buildBody() {
  const B = GeoBuilder();
  const NA = 56;
  // outer mantle + tail rod (angle a: 0 = top)
  B.grid(110, NA, (u, v, o) => { const a = (v - 0.5) * TAU; const x = lp(rimX(a), 1.0, Math.pow(u, 1.15)); mantlePoint(x, a, 1, o); }, P_MANTLE, false);
  // inner wall of the collar opening (dark), slightly inside the rim
  // rolled lip: a half-round from the outer skin to the inner wall
  B.grid(8, NA, (u, v, o) => { const a = (v - 0.5) * TAU, t = u * Math.PI; mantlePoint(rimX(a) - 0.014 * Math.sin(t), a, 1 - 0.045 * (1 - Math.cos(t)), o); }, P_MANTLE, false, undefined, 0);
  B.grid(16, NA, (u, v, o) => { const x = lp(rimX((v - 0.5) * TAU), 0.22, u); mantlePoint(x, (v - 0.5) * TAU, 0.91 * (1 - u * 0.25), o); }, P_INNER, true);
  // head (neck hidden inside the collar, bulge, crown where the arms grow)
  B.grid(40, 40, (u, v, o) => {
    const x = lp(0.07, -0.245, u), r = curve(HEAD, x), a = (v - 0.5) * TAU;
    // eye orbits: the sides swell where the eyes sit
    const orb = Math.exp(-Math.pow((x + 0.095) / 0.04, 2)) * Math.pow(Math.abs(Math.sin(a)), 1.5) * Math.exp(-Math.pow(Math.cos(a) - 0.15, 2) / 0.5);
    o.set(x, Math.cos(a) * r * 1.1 + 0.012, Math.sin(a) * r * 0.9 * (1 + 0.18 * orb));
  }, P_HEAD, true);
  // funnel: a short cone under the head, coming out of the collar
  B.grid(14, 18, (u, v, o) => {
    const x = lp(0.06, -0.075, u), r = lp(0.048, 0.02, Math.pow(u, 0.8)) * (1 + 0.15 * ss(0.85, 1, u)), a = (v - 0.5) * TAU;
    o.set(x, -0.098 + u * 0.018 + Math.cos(a) * r * 0.72, Math.sin(a) * r * 1.1);
  }, P_FUNNEL, true);
  return B.build();
}

function buildEyes() {
  const B = GeoBuilder();
  for (const side of [-1, 1]) {
    B.grid(18, 24, (u, v, o) => {
      const th = u * Math.PI, ph = v * TAU, r = 0.068;
      // the eye looks sideways (local z), u=0 at the pupil
      o.set(Math.sin(th) * Math.cos(ph) * r - 0.095, Math.sin(th) * Math.sin(ph) * r * 0.95 + 0.026, side * (0.1 + Math.cos(th) * r * 0.28));
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
      const x0 = 0.402 - 0.05 * Math.pow(v, 1.6);   // the lobes reach forward beside the mantle (dorsal photo)
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

/* hooks: small saw-tooth blades along the arms and the tentacle clubs (5 verts each, rewritten every frame) */
function buildHooks(list) {
  const n = list.length, pos = new Float32Array(n * 5 * 3), nor = new Float32Array(n * 5 * 3), rest = new Float32Array(n * 5 * 3), part = new Float32Array(n * 5), uv = new Float32Array(n * 5 * 2), idx = [];
  list.forEach((h, k) => {
    for (let v = 0; v < 5; v++) { const o = k * 5 + v; part[o] = P_HOOK; rest[o * 3] = h.s * h.len; rest[o * 3 + 1] = v === 4 ? 1 : 0; rest[o * 3 + 2] = h.li; uv[o * 2] = h.s; uv[o * 2 + 1] = v === 4 ? 1 : 0; }
    const b = k * 5;
    idx.push(b, b + 1, b + 4, b + 1, b + 2, b + 4, b + 2, b + 3, b + 4, b + 3, b, b + 4);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('aRest', new THREE.BufferAttribute(rest, 3));
  g.setAttribute('aPart', new THREE.BufferAttribute(part, 1));
  g.setAttribute('aUv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/* ----------------------------------------------------------------- shader */
const VERT = /* glsl */`
  attribute vec3 aRest; attribute float aPart; attribute vec2 aUv;
  uniform float uPulse, uFlare, uTime;
  varying vec3 vRest, vN, vW, vL, vNL; varying float vPart; varying vec2 vUv;
  void main(){
    vec3 p = position;
    // mantle breathing: the mantle squeezes on each push, the rim flares on the refill
    if (aPart < 1.5) {
      float zone = (1.0 - smoothstep(0.30, 0.43, p.x));
      float rim = 1.0 - smoothstep(0.0, 0.07, p.x);
      float k = 1.0 - uPulse * 0.14 * zone + uFlare * 0.07 * rim;
      p.yz *= k;
    }
    vRest = aRest; vPart = aPart; vUv = aUv;
    vec4 w = modelMatrix * vec4(p, 1.0);
    vW = w.xyz; vL = p;
    vN = normalize(mat3(modelMatrix) * normal);
    vNL = normal;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const FRAG = /* glsl */`
  precision highp float;
  uniform vec3 uCamPos, uSunD, uFog, uTop, uDeepTint;
  uniform float uFogD, uTime, uTorch, uLook, uFin;
  uniform vec2 uEye;
  varying vec3 vRest, vN, vW, vL, vNL; varying float vPart; varying vec2 vUv;

  float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * n3(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }

  const vec3 RED = vec3(0.9, 0.16, 0.18);
  const vec3 RED2 = vec3(1.0, 0.36, 0.36);
  const vec3 PALE = vec3(0.92, 0.86, 0.88);
  const vec3 LIMB = vec3(0.82, 0.22, 0.3);

  void main(){
    int part = int(vPart + 0.5);
    vec3 N = normalize(vN + vec3(0.0, 1e-5, 0.0));
    vec3 V = normalize(uCamPos - vW);
    if (!gl_FrontFacing) N = -N;
    if (vPart < 3.5) {
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
      float blot = smoothstep(0.55, 0.66, fbm(q * vec3(5.0, 16.0, 16.0) + 3.0)) * (0.35 + 0.65 * smoothstep(0.35, 0.7, fbm(q * 2.5 + 11.0)));
      blot = max(blot, smoothstep(0.5, 0.62, fbm(q * vec3(4.0, 22.0, 22.0) + 17.0)) * (1.0 - smoothstep(0.02, 0.12, vUv.x)) * float(part == ${P_MANTLE}));
      // sharp white specks of many sizes, stretched along the body, clustered in patches
      float cl1 = smoothstep(0.4, 0.68, fbm(q * vec3(3.0, 6.0, 6.0) + 5.0));
      float sp1 = smoothstep(0.62, 0.67, fbm(q * vec3(9.0, 34.0, 34.0) + 2.0));            // irregular patches
      float sp2 = smoothstep(0.84, 0.87, n3(q * vec3(30.0, 110.0, 110.0))) * smoothstep(0.45, 0.7, fbm(q * 7.0 + 1.0));
      float fleck = max(sp1, sp2 * 0.9) * (0.35 + 0.65 * cl1);
      float dorsal = smoothstep(-0.05, 0.08, vL.y);
      flecks = clamp(blot * 0.85 + fleck * (0.7 + 0.3 * dorsal), 0.0, 1.0);
      // dark midline groove
      // bright raised rod on the midline, dark creases either side of it
      float kk = smoothstep(0.06, 0.3, vL.x) * dorsal;
      float rodK = exp(-pow(vL.z / 0.018, 2.0)) * kk;
      float crease = exp(-pow((abs(vL.z) - 0.036) / 0.011, 2.0)) * kk;
      base = mix(base, RED2 * 1.1, rodK * 0.45);
      base *= 1.0 - crease * 0.6;
      // pale collar rim
      float streak = fbm(vec3(vUv.y * 60.0, vUv.x * 6.0, 3.0));                          // streaks run back from the lip
      float streak2 = smoothstep(0.45, 0.7, fbm(vec3(vUv.y * 90.0, vUv.x * 3.0, 9.0)));
      float rim = 1.0 - smoothstep(0.01, 0.03 + 0.16 * streak2 * streak, vUv.x + (m - 0.5) * 0.02);
      rim *= mix(0.35, 1.0, smoothstep(0.3, -0.4, vL.y / 0.2));
      if (part == ${P_MANTLE}) { base = mix(base, PALE * 1.05, rim * 0.95); flecks = max(flecks * (1.0 - rim), smoothstep(0.6, 0.75, streak) * (1.0 - smoothstep(0.04, 0.2, vUv.x)) * 0.8); }
      if (part == ${P_HEAD}) {
        float sideK = smoothstep(0.03, 0.08, abs(vL.z)) * smoothstep(0.06, -0.06, vL.y);
        base = mix(base, vec3(0.62, 0.72, 0.66), sideK * 0.45);            // silvery green cheeks below the eye
        flecks *= 0.8;
        float de = length(vec2(vL.x + 0.095, vL.y - 0.026)) * step(0.03, abs(vL.z)) + (1.0 - step(0.03, abs(vL.z)));
        base = mix(base, vec3(0.45, 0.5, 0.45), smoothstep(0.012, 0.0, abs(de - 0.05)) * 0.3);  // faint silver rim
        base *= 1.0 - 0.25 * smoothstep(0.062, 0.05, de);
        float mot = smoothstep(0.4, 0.65, fbm(vec3(vL.x * 60.0, vL.y * 60.0, vL.z * 30.0)));
        base = mix(base, mix(vec3(0.32, 0.46, 0.42), vec3(0.62, 0.72, 0.66), mot), smoothstep(0.11, 0.07, de) * 0.75);   // mottled silvery-green skin around the eye   // silvery-green skin around the eye                                         // the socket is a little darker
        flecks *= smoothstep(0.05, 0.08, de);
      }
      if (part == ${P_FUNNEL}) base = mix(RED, vec3(0.5, 0.2, 0.25), 0.4);
    } else if (part == ${P_INNER}) {
      base = vec3(0.012, 0.02, 0.03);
      float rim = 1.0 - smoothstep(0.0, 0.05, vUv.x);
      base = mix(base, PALE * 0.9, rim * 0.8);
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
      float vband = exp(-pow((abs(vL.z) - 0.05 * (1.0 - smoothstep(0.45, 1.0, vL.x))) / 0.016, 2.0)) * smoothstep(0.42, 0.5, vL.x);
      base *= 1.0 - vband * 0.45;                                          // the dark V on the fin's midline
      // pale, see-through margin
      float rag = fbm(vec3(vL.x * 40.0, vL.z * 6.0, 2.0));
      float margin = smoothstep(0.5, 0.86, e + (m - 0.5) * 0.3 + (rag - 0.5) * 0.25);
      base *= 1.0 - 0.75 * exp(-pow(vL.z / 0.007, 2.0)) * smoothstep(0.5, 0.6, vL.x) * (1.0 - smoothstep(0.88, 0.98, vL.x));   // the dark slit
      base = mix(base, PALE * 1.08, margin * 0.92);
      float blot = smoothstep(0.68, 0.76, fbm(q * vec3(8.0, 8.0, 12.0) + 9.0));
      flecks = blot * 0.7 * (1.0 - margin);
      alpha = mix(1.0, 0.55, margin) * (1.0 - smoothstep(0.9 + rag * 0.08, 0.99, e));   // ragged, see-through edge
      spec = 0.4;
    } else if (part == ${P_ARM} || part == ${P_TENT}) {
      float s = vRest.x, ang = vRest.y, f = vUv.x;  // distance along, angle around (0 = inner face), fraction along
      float c = cos(ang * 6.2831853);
      float inner = smoothstep(0.1, 0.75, c);         // oral face (where the hooks sit)
      float outer = smoothstep(0.2, -0.7, c);         // aboral back of the arm
      float m = fbm(vec3(s * 18.0, ang * 4.0, vRest.z * 3.1));
      if (part == ${P_ARM}) {
        // arm close-ups: grey-teal skin, pale streaks running along the arm, irregular red-pink patches on the
        // back that thin out toward the tip, a lighter sucker face, faint rings
        float n1 = fbm(vec3(s * 9.0, ang * 3.0, vRest.z * 2.3));
        vec3 skin = mix(vec3(0.06, 0.11, 0.12), vec3(0.16, 0.24, 0.25), smoothstep(0.35, 0.7, n1));   // linear values
        float streak = smoothstep(0.55, 0.85, fbm(vec3(s * 3.0, ang * 14.0, vRest.z * 5.0 + 2.0)));
        skin = mix(skin, vec3(0.36, 0.42, 0.41), streak * 0.45);
        float rpatch = smoothstep(0.52, 0.66, fbm(vec3(s * 16.0, ang * 5.0, vRest.z * 3.0 + 9.0)));
        rpatch *= (0.35 + 0.65 * outer) * (1.0 - smoothstep(0.55, 0.95, f));
        base = mix(skin, vec3(0.5, 0.07, 0.1), rpatch * 0.85);
        base = mix(base, vec3(0.16, 0.22, 0.22), inner * 0.5);          // the sucker face is paler
        base = mix(base, RED2 * 0.85, (1.0 - smoothstep(0.03, 0.14, f)) * 0.7);   // red where it meets the head
        base *= 1.0 - 0.08 * smoothstep(0.6, 1.0, sin(s * 260.0)) * outer;          // faint rings
        flecks = smoothstep(0.66, 0.76, fbm(vec3(s * 60.0, ang * 10.0, vRest.z * 7.0))) * 0.35 * outer;
      } else {
        // stalk: crisp red / white bands, red near the base; club: pale with pink blotches
        float bandN = n3(vec3(floor(s * 52.0), vRest.z, 1.0));
        float band = step(0.38 + bandN * 0.2, fract(s * 52.0));
        vec3 stalk = mix(vec3(0.34, 0.36, 0.36), RED2 * 0.55, band);   // linear: pale grey and red bands
        stalk = mix(stalk, vec3(0.5), smoothstep(0.8, 0.9, n3(vec3(s * 160.0, ang * 10.0, 3.0))) * 0.6);
        stalk = mix(stalk, RED, 1.0 - smoothstep(0.02, 0.12, f));
        float club = smoothstep(0.78, 0.83, f);
        // club: pink-red mottled with white, the toothed edge and the tip go pale
        float mot = fbm(vec3(s * 70.0, ang * 7.0, vRest.z * 5.0 + 4.0));
        vec3 clubC = mix(vec3(0.5, 0.08, 0.12), vec3(0.4, 0.42, 0.42), smoothstep(0.42, 0.62, mot));
        float cu = clamp((f - 0.8) / 0.2, 0.0, 1.0);
        clubC = mix(clubC, vec3(0.45, 0.46, 0.45), smoothstep(0.75, 1.0, cu) * 0.7 + inner * 0.25);
        base = mix(stalk, clubC, club);
        flecks = club * smoothstep(0.66, 0.74, fbm(vec3(s * 60.0, ang * 6.0, 2.0))) * 0.6;
      }
      spec = 0.32; gloss = 30.0;
    } else if (part == ${P_HOOK}) {
      // hook: bone white, a little pink at the root, glossy
      base = mix(vec3(0.45, 0.55, 0.56), vec3(0.82, 0.86, 0.85), smoothstep(0.0, 0.8, vRest.y));
      spec = 0.5; gloss = 50.0;
    } else { // eye
      vec3 c = vec3(-0.095, 0.026, sign(vL.z) * 0.1);
      vec3 d = normalize((vL - c) / vec3(0.068, 0.0646, 0.019));   // undo the eyeball's flattening
      vec3 look = normalize(vec3(uEye.x * 0.25, uEye.y * 0.18, sign(vL.z)));
      float k = dot(d, look);
      // red lid -> silver ring -> green-grey iris -> big black pupil
      vec3 iris = mix(vec3(0.62, 0.7, 0.68), vec3(0.36, 0.44, 0.42), smoothstep(0.9, 0.95, k));
      vec3 tng = normalize(cross(look, vec3(0.0, 1.0, 0.0)));
      float ang = atan(dot(d, cross(look, tng)), dot(d, tng));
      float fib = n3(vec3(ang * 9.0, k * 30.0, 1.0)) * 0.6 + 0.2 * sin(ang * 46.0 + k * 20.0);
      vec3 lid = mix(vec3(0.3, 0.38, 0.34), vec3(0.55, 0.22, 0.24), smoothstep(0.55, 0.7, n3(d * 18.0)));   // mottled green-grey and red lid
      vec3 irisC = mix(vec3(0.16, 0.3, 0.32), vec3(0.38, 0.55, 0.56), fib * 0.6);
      irisC = mix(irisC, vec3(0.7, 0.82, 0.8), smoothstep(0.03, 0.0, abs(k - 0.56)) * 0.8 + smoothstep(0.03, 0.0, abs(k - 0.8)) * 0.4);   // concentric rings
      vec3 skin = mix(RED * 0.8, vec3(0.34, 0.48, 0.44), smoothstep(0.4, 0.65, n3(d * 22.0)));   // the eyeball's edge is covered by mottled skin
      base = mix(skin, vec3(0.1, 0.2, 0.2), smoothstep(0.5, 0.56, k));           // dark rim around the iris
      base = mix(base, irisC, smoothstep(0.6, 0.66, k));                            // silver-teal iris
      base = mix(base, vec3(0.002, 0.003, 0.004), smoothstep(0.84, 0.86, k));
      if (k > 0.86) spec = 0.6;      // black pupil
      spec = 2.2; gloss = 180.0;
    }

    float underK = 0.0;
    // counter-shading: the underside is dark blue-black with only a red rim (the belly photos)
    if (part != ${P_EYE} && part != ${P_INNER} && part != ${P_HOOK}) {
      vec3 nl = normalize(vNL + vec3(0.0, 1e-5, 0.0));
      float ny = (part == ${P_MANTLE} || part == ${P_HEAD} || part == ${P_FUNNEL}) ? (vL.y - 0.01) / max(length(vL.yz - vec2(0.01, 0.0)), 1e-3) : nl.y;
      float under = part == ${P_FIN} ? smoothstep(0.05, -0.15, dot(V, normalize(vN))) : smoothstep(-0.05, -0.65, ny);
      if (part == ${P_FIN}) under *= 1.0 - smoothstep(0.5, 0.85, clamp(abs(vL.z) / max(1e-3, finHalfGLSL(vL.x)), 0.0, 1.0));
      if (part == ${P_ARM} || part == ${P_TENT}) under *= 0.85;
      base = mix(base, vec3(0.025, 0.07, 0.09) + base * vec3(0.12, 0.04, 0.05), under * 0.82);
      flecks *= 1.0 - under * 0.9;
      underK = under;
    }
    // white flecks are brighter and a bit glossy
    base = mix(base, vec3(1.0, 0.97, 0.96), flecks * 0.95);   // the marks are crisp near-white

    // light: sun from above through water, dark blue-green belly (counter-shading)
    vec3 L = normalize(uSunD);
    float wrap = clamp((dot(N, L) + 0.35) / 1.35, 0.0, 1.0);
    float up = N.y * 0.5 + 0.5;
    vec3 amb = mix(uDeepTint * 1.6, uTop * 0.25 + vec3(0.1, 0.07, 0.07), up);
    vec3 col = base * (amb * 0.95 + vec3(1.0, 0.95, 0.9) * wrap * 1.35) + base * base * 0.22;   // self-coloured glow keeps it saturated   // the skin glows a little (the reference is luminous)
    // belly falls into a dark teal shadow
    float belly = smoothstep(0.1, -0.5, N.y);
    col = mix(col, uDeepTint * 0.9 + base * 0.12, belly * 0.3);

    // specular + glitter: tiny specks that twinkle as the squid turns (the "shine specs")
    vec3 H = normalize(L + V);
    float sp = pow(max(dot(N, H), 0.0), gloss) * spec * 1.4 + pow(max(dot(N, H), 0.0), 8.0) * spec * 0.1 * (part == ${P_EYE} ? 0.0 : 1.0);
    float glit = 0.0;
    if (part != ${P_EYE} && part != ${P_INNER} && part != ${P_HOOK}) {
      float g = n3(q * 140.0 + vec3(0.0, 0.0, floor(dot(V, vec3(3.1, 2.3, 1.7)) * 6.0)));
      glit = smoothstep(0.93, 0.995, g) * (0.25 + 0.75 * wrap) * (0.4 + flecks);
    }
    col += vec3(1.0, 0.96, 0.95) * (sp * (0.35 + flecks) + glit * 0.9);

    // soft rim of water light
    float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    col += uTop * fr * 0.35 * (1.0 - underK * 0.7) * (part == ${P_FIN} ? 1.4 : (part == ${P_ARM} || part == ${P_TENT}) ? 0.25 : 1.0);
    // a little subsurface: thin parts glow red when lit from behind
    if (part == ${P_FIN} || part == ${P_ARM} || part == ${P_TENT}) col += base * pow(max(dot(-N, L), 0.0), 2.0) * 0.25;

   // arms sit in the shadow of the mantle (close-ups: dark teal)
    // torch from the cursor
    col *= 1.0 + uTorch * 0.25;

    // water fog
    float d = length(uCamPos - vW);
    float f = 1.0 - exp(-d * uFogD * 0.55);
    col = mix(col, uFog, clamp(f, 0.0, 0.45));
    if (part == ${P_INNER}) col = col * 0.3 + uTop * 0.04 * (1.0 - max(dot(N, V), 0.0));   // the mantle cavity stays dark
    gl_FragColor = vec4(col, alpha);
  }`;

const FIN_GLSL = /* glsl */`
  float finHalfGLSL(float x){
    float u = (x - 0.4) / 0.6;
    if (u <= 0.0 || u >= 1.0) return 0.0;
    if (u < 0.32) return 0.31 * pow(sin((u / 0.32) * 1.5707963), 0.42);
    float v = (u - 0.32) / 0.68;
    return 0.31 * pow(max(1.0 - v, 0.0), 0.55);
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

  // ---- limbs (measured from the side and front stills)
  // arms: thick webbed bases packed tight around the crown, ~1.6 x head length, red back,
  // pale inner face lined on both edges with saw-tooth hooks, tapering to fine pale points.
  // tentacles: from between the lowest arm pair, thin red/white banded stalk, leaf-shaped club
  // (last 28%) about 5x the stalk width, with a row of large teeth along one edge.
  const RAD = 14;
  const specs = [];
  const ARMN = 8;
  for (let i = 0; i < ARMN; i++) {
    const ang = ((i + 0.5) / ARMN) * TAU;          // around the crown, 0 = top
    const pair = Math.min(i, ARMN - 1 - i);         // 0 top .. 3 bottom
    const len = [0.68, 0.76, 0.86, 0.8][pair] * (0.96 + 0.08 * ((i * 37) % 7) / 7);
    specs.push({ kind: 'arm', part: P_ARM, ang, len, n: 80, r0: 0.03, r1: 0.0012, ph: i * 1.7 });
  }
  for (const s of [-1, 1]) specs.push({ kind: 'tent', part: P_TENT, ang: Math.PI + s * 0.45, len: 2.2, n: 200, r0: 0.017, r1: 0.0098, ph: s > 0 ? 0 : 2.4, side: s });
  const limbs = buildLimbs(specs, RAD);
  const limbMesh = new THREE.Mesh(limbs.geo, mat);
  limbMesh.frustumCulled = false; finMesh.frustumCulled = false;
  body.add(limbMesh);

  // suckers (arm and tentacle close-ups): round beads on short stalks with a pale rim and a dark cup.
  // arms: two zigzag rows down the oral face; tentacle clubs: four rows, biggest in the middle of the club;
  // the last part of each stalk carries a sparse row of small ones.
  const hookList = [];
  specs.forEach((L, li) => {
    if (L.kind === 'arm') {
      let s = 0.05, row = 0;
      while (s < 0.97) {
        hookList.push({ li, s, side: row ? 1 : -1, lat: 0.42, arm: true, k: 0.85 + Math.random() * 0.3 });
        const w = section(L, s).r;
        s += Math.max(0.003, w * (0.62 + Math.random() * 0.1)) / L.len;   // one sucker per row every arm-width, rows offset
        row ^= 1;
      }
    } else {
      for (let s = 0.805; s < 0.985; s += 0.0105 / L.len) for (const lat of [-0.66, -0.22, 0.22, 0.66]) {
        hookList.push({ li, s: s + (Math.abs(lat) < 0.3 ? 0.0052 / L.len : 0), side: Math.sign(lat), lat: Math.abs(lat), arm: false, k: 0.85 + Math.random() * 0.3 });
      }
      for (let s = 0.62; s < 0.8; s += 0.022 / L.len) hookList.push({ li, s, side: 1, lat: 0, arm: false, stalk: true, k: 1 });
    }
  });
  const suckGeo = new THREE.SphereGeometry(1, 10, 6);
  suckGeo.translate(0, 0.35, 0);                               // the bead sits on a short stalk above the skin
  const suckMat = new THREE.ShaderMaterial({
    uniforms: { uCamPos: ENVU.uCamPos, uFog: ENVU.uFog, uFogD: ENVU.uFogD, uSunD: uniforms.uSunD, uTop: ENVU.uTop },
    vertexShader: /* glsl */`
      varying vec3 vN, vW; varying float vY;
      void main(){
        vY = position.y;
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vW = w.xyz; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCamPos, uFog, uSunD, uTop; uniform float uFogD;
      varying vec3 vN, vW; varying float vY;
      void main(){
        vec3 N = normalize(vN), V = normalize(uCamPos - vW), L = normalize(uSunD);
        // pale bead with a darker cup on top and a teal-grey stalk below
        vec3 c = mix(vec3(0.05, 0.09, 0.1), vec3(0.42, 0.52, 0.5), smoothstep(0.0, 0.7, vY));
        c = mix(c, vec3(0.08, 0.12, 0.13), smoothstep(1.15, 1.32, vY));
        float wrap = clamp((dot(N, L) + 0.4) / 1.4, 0.0, 1.0);
        vec3 col = c * (0.35 + 0.85 * wrap) + uTop * 0.08;
        vec3 H = normalize(L + V);
        col += vec3(1.0) * pow(max(dot(N, H), 0.0), 60.0) * 0.3;   // wet glint on each bead
        float d = length(uCamPos - vW);
        col = mix(col, uFog, clamp(1.0 - exp(-d * uFogD * 0.55), 0.0, 0.45));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const suckers = new THREE.InstancedMesh(suckGeo, suckMat, hookList.length);
  suckers.frustumCulled = false;
  body.add(suckers);
  const sm4 = new THREE.Matrix4(), sBasis = new THREE.Matrix4(), sScale = new THREE.Vector3();

  // web: the thin skin that joins the arm bases into a cup (front close-up: dark webbed centre)
  const WK = 14, WJ = 8;
  const armIdx = specs.map((L, i) => (L.kind === 'arm' ? i : -1)).filter((i) => i >= 0);
  const webGeoB = GeoBuilder();
  armIdx.forEach(() => {
    const st = webGeoB.pos.length / 3;
    for (let i = 0; i <= WK; i++) for (let j = 0; j <= WJ; j++) webGeoB.v(new THREE.Vector3(), P_HEAD, i / WK, j / WJ);
    for (let i = 0; i < WK; i++) for (let j = 0; j < WJ; j++) { const a0 = st + i * (WJ + 1) + j, c0 = a0 + WJ + 1; webGeoB.idx.push(a0, c0, a0 + 1, a0 + 1, c0, c0 + 1); }
  });
  const webGeo = webGeoB.build();
  const webPos = webGeo.attributes.position.array;
  const webMesh = new THREE.Mesh(webGeo, mat);
  webMesh.frustumCulled = false;
  body.add(webMesh);

  // per-ring frames, filled by writeTube: p(3) t(3) n(3) b(3) rW rH
  const frames = specs.map((L) => new Float32Array((L.n + 1) * 14));

  const LP = limbs.geo.attributes.position.array, LN = limbs.geo.attributes.normal.array;
  const FP = fin.geo.attributes.position.array, FN = fin.geo.attributes.normal.array, FR = fin.geo.attributes.aRest.array;

  // chain state for each limb: points + a lagged copy for drag
  const chains = specs.map((L) => ({ pts: Array.from({ length: L.n + 1 }, () => new THREE.Vector3()), lag: Array.from({ length: L.n + 1 }, () => new THREE.Vector3()), init: false }));

  // ---- swim state
  const Q = {
    t: 0, mode: 'cruise', modeT: 0,
    cyc: 0,           // mantle cycle phase 0..1
    ph: 0,            // master swim phase (radians): everything moves to this one beat
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
    const ph = Q.ph, amp = Q.finAmp;
    let k = 0;
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) {
        const ri = k * 3; const x = FR[ri], z = FR[ri + 2];
        const w = Math.max(finHalf(x), 1e-3), e = Math.min(Math.abs(z) / w, 1);
        // the fin beats up and down in a wave running from front to tip; lobes lead
        const wave = Math.sin(ph - x * 9.0) + 0.35 * Math.sin(2.0 * ph - x * 14.0 + 1.0);   // a strong wave runs from the lobes to the tip
        const fold = Q.jetE * 0.9 + Q.pulse * 0.06;    // folds down along the body during a push
        const lift = (wave * amp * 0.06 * Math.pow(e, 1.2) - fold * 0.16 * Math.pow(e, 1.1)) * ss(0.36, 0.5, x);
        // a soft cup across the fin (edges slightly up when relaxed)
        const lobe = (1 - ss(0.5, 0.78, x)) * e * e;        // the front lobes cup and open with the beat
        const cup = 0.01 * e * e * (1 - Q.pulse) + 0.025 * Math.cos(ph - 0.6) * lobe * amp + 0.006 * Math.sin(x * 120 + ph * 0.6) * ss(0.8, 1, e);
        // the tip flicks a little
        const tip = Math.sin(ph - 6.5) * 0.012 * ss(0.85, 1, x) * amp;
        const scal = 1 + 0.035 * Math.sin(x * 95 + ph * 0.5) * ss(0.75, 1, e);   // ruffled, scalloped margin
        const zz = z * (1 - fold * 0.12 * e) * scal * (1 - 0.06 * e * e * (0.6 + 0.4 * Math.cos(ph - 0.6)));
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
      // roots packed on the crown of the head (tentacles sit just inside the ventral arms)
      const rootR = isT ? 0.02 : 0.042;
      P[0].set(isT ? -0.21 : -0.215, ca * rootR * 1.12 + 0.012, sa * rootR * 0.95);
      const rad = tA.set(0, ca, sa);
      const perp = tB.set(0, -sa, ca);
      const seg = L.len / L.n;
      // arms: a tight bundle that opens a little on the glide and closes on each push
      const P2 = Q.ph * 0.5;                                     // limbs ripple at half the fin beat
      const spread = isT ? 0.03 + 0.04 * (1 - Q.pulse) : Q.spread * (1 - Q.pulse * 0.7) * (1 - Q.jetE * 0.7) * (0.85 + 0.25 * Math.sin(Q.ph * 0.25 + L.ph));
      const dir = tT.set(-1, 0, 0);
      for (let i = 1; i <= L.n; i++) {
        const s = i / L.n;
        const wv = isT ? 2.4 : 3.0;
        const lp0 = isT ? L.ph : L.ph * 0.2;                     // arms stay nearly in step as a bundle
        const w1 = Math.sin(TAU * (s * (isT ? 1.3 : 0.85)) - P2 + lp0);
        const w2 = Math.cos(TAU * (s * (isT ? 0.9 : 0.6)) - P2 * 0.7 + lp0 * 1.3);
        void wv;
        const ampA = (isT ? 2.4 : 0.6) * (0.15 + 0.85 * s * s) * (0.75 + Q.agit * 0.8 + (Q.mode === 'idle' ? 0.5 : 0));
        // each segment's heading is two angles: lat (sideways, around the crown) and out (away from / toward
        // the body axis). Angles, unlike added vectors, can go past 90 degrees, so limbs can loop and hook.
        let lat, out;
        if (!isT) {
          // arms (swim video): fan wide like loose fingers, then each tip hooks back inward; the whole bundle
          // rides one slow shared wave, neighbours only slightly out of step
          const ai = L.ang / TAU, tq = Q.t * 0.7, sp = Math.pow(s, 1.3);
          const ph = tq - s * 3.6 + ai * 1.2;
          const curl = (1.0 + 0.45 * Math.sin(tq * 0.55 + ai * 2.0 + L.ph)) * ss(0.38, 1.0, s);
          out = spread * (1.0 - 0.15 * s) - 1.9 * curl + 0.35 * sp * Math.cos(ph * 0.9 + 0.7);
          lat = 0.7 * sp * Math.sin(ph) + 0.25 * Math.sin(L.ph * 2.3) * s + w1 * ampA * 0.12;
        } else {
          // tentacles (swim video): big loose loops and S-bends rolling slowly from the head to the club;
          // both share the wave, a little out of step; the club flops over behind it
          const free = ss(0.1, 0.35, s), tq = Q.t * 0.55, off = L.side * 0.4;
          const A = free * (0.45 + 1.6 * s);
          lat = L.side * 0.14 * free + A * Math.sin(tq - s * 4.0 + off);
          out = spread * (1.2 - s * 0.5) - 0.05 * (1 - free) + A * 0.75 * Math.cos(tq * 0.73 - s * 3.0 + off * 0.6 + 1.3);
          out += ss(0.78, 0.97, s) * 1.1 * Math.sin(tq * 1.1 - 2.4 + off);   // the club folds over
        }
        const co = Math.cos(out), so = Math.sin(out), cl2 = Math.cos(lat), sl = Math.sin(lat);
        dir.set(-co * cl2, 0, 0).addScaledVector(perp, co * sl).addScaledVector(rad, so);
        if (!isT) dir.y -= 0.06 * s;
        dir.normalize();
        P[i].copy(P[i - 1]).addScaledVector(dir, seg);
      }
      if (!ch.init) { for (let i = 0; i <= L.n; i++) ch.lag[i].copy(P[i]); ch.init = true; }
      for (let i = 1; i <= L.n; i++) {
        const s = i / L.n, f = k1(dt, lp(30, isT ? 1.4 : 5, s));
        ch.lag[i].lerp(P[i], f);
      }
      ch.lag[0].copy(P[0]);
      for (let i = 1; i <= L.n; i++) { tmp.subVectors(ch.lag[i], ch.lag[i - 1]); const d = tmp.length() || 1; ch.lag[i].copy(ch.lag[i - 1]).addScaledVector(tmp, seg / d); }
      writeTube(li, L, ch.lag);
    });
    writeHooks();
    limbs.geo.attributes.position.needsUpdate = true;
    limbs.geo.attributes.normal.needsUpdate = true;
  }

  // limb radius and cross-section along the limb
  function section(L, s) {
    if (L.kind === 'arm') {
      // thick webbed base, holds its width for the first third, then a long taper to a fine point
      const r = L.r0 * Math.pow(Math.max(1 - s, 0), 0.75) * (0.85 + 0.15 * ss(0.0, 0.06, s)) + L.r1;   // round tube: steady taper to a fine tip   // roots tuck into the head, full width just outside it
      return { r, w: 1.0, h: 0.96, club: 0 };
    }
    // tentacle: slightly thicker where it leaves the head, thin stalk, leaf club
    const cu = cl((s - 0.8) / 0.2, 0, 1);
    const club = cu > 0 ? Math.pow(Math.sin(Math.pow(cu, 0.62) * Math.PI), 0.75) : 0;
    let r = lp(L.r0, L.r1, ss(0.0, 0.2, s));
    r *= 1 - ss(0.95, 1.0, s) * 0.7;
    return { r, w: 1 + club * 5.8, h: 1 - club * 0.6, club };
  }

  function writeTube(li, L, P) {
    const start = limbs.rings[li], F = frames[li];
    prevN.set(0, -Math.cos(L.ang), -Math.sin(L.ang));   // inner direction: toward the body axis
    for (let i = 0; i <= L.n; i++) {
      const s = i / L.n;
      const a = P[Math.max(i - 1, 0)], b = P[Math.min(i + 1, L.n)];
      tT.subVectors(b, a).normalize();
      tN.copy(prevN).addScaledVector(tT, -prevN.dot(tT)).normalize();   // parallel transport
      prevN.copy(tN);
      tBn.crossVectors(tT, tN);
      const S = section(L, s), r = S.r, rW = r * S.w, rH = r * S.h;
      const o = i * 14;
      F[o] = P[i].x; F[o + 1] = P[i].y; F[o + 2] = P[i].z;
      F[o + 3] = tT.x; F[o + 4] = tT.y; F[o + 5] = tT.z;
      F[o + 6] = tN.x; F[o + 7] = tN.y; F[o + 8] = tN.z;
      F[o + 9] = tBn.x; F[o + 10] = tBn.y; F[o + 11] = tBn.z;
      F[o + 12] = rW; F[o + 13] = rH;
      for (let j = 0; j <= RAD; j++) {
        const th = (j / RAD) * TAU;  // 0 = inner face
        const c = Math.cos(th), sn = Math.sin(th);
        let ox = c * rH, oy = sn * rW;
        if (L.kind === 'arm') {
          ox *= 1 + 0.22 * Math.pow(Math.max(0, -c), 6);   // a keel along the back
          ox *= 1 - 0.25 * Math.pow(Math.max(0, c), 2);     // flatter oral face
        } else if (S.club > 0) {
          ox *= 1 - 0.3 * S.club * Math.pow(Math.max(0, c), 2);
          ox += -0.25 * rH * S.club * Math.max(0, -c);       // a thin keel on the back of the club
        }
        const k = (start + i * (RAD + 1) + j) * 3;
        LP[k] = P[i].x + tN.x * ox + tBn.x * oy;
        LP[k + 1] = P[i].y + tN.y * ox + tBn.y * oy;
        LP[k + 2] = P[i].z + tN.z * ox + tBn.z * oy;
        tmp.set(0, 0, 0).addScaledVector(tN, c * rW).addScaledVector(tBn, sn * rH).normalize();
        LN[k] = tmp.x; LN[k + 1] = tmp.y; LN[k + 2] = tmp.z;
      }
    }
  }

  // place every hook on its limb: a small pointed blade leaning toward the tip
  const hp = new THREE.Vector3(), ht = new THREE.Vector3(), hn = new THREE.Vector3(), hb = new THREE.Vector3(), hd = new THREE.Vector3(), hv = new THREE.Vector3(), hc = new THREE.Vector3();
  function frameAt(li, sAlong) {
    const L = specs[li], F = frames[li];
    const fi = sAlong * L.n, i0 = Math.min(Math.floor(fi), L.n), i1 = Math.min(i0 + 1, L.n), w = fi - i0, a = i0 * 14, b = i1 * 14;
    const g = (o) => F[a + o] * (1 - w) + F[b + o] * w;
    hp.set(g(0), g(1), g(2)); ht.set(g(3), g(4), g(5)).normalize(); hn.set(g(6), g(7), g(8)).normalize(); hb.set(g(9), g(10), g(11)).normalize();
    return [g(12), g(13)];
  }
  function writeHooks() {
    hookList.forEach((h, k) => {
      const [rW, rH] = frameAt(h.li, h.s);
      let size;
      if (h.arm) {
        hc.copy(hp).addScaledVector(hn, rH * 0.62).addScaledVector(hb, h.side * rW * h.lat);
        hd.copy(hn).addScaledVector(hb, h.side * 0.25).normalize();
        size = rW * 0.36 * h.k * (0.75 + 0.25 * Math.sin(Math.PI * cl(h.s / 0.8, 0, 1)));
      } else if (h.stalk) {
        hc.copy(hp).addScaledVector(hn, rH * 0.75);
        hd.copy(hn);
        size = rW * 0.42;
      } else {
        const cu = (h.s - 0.8) / 0.2, prof = Math.sin(Math.PI * Math.pow(cl(cu, 0, 1), 0.7));
        hc.copy(hp).addScaledVector(hn, rH * 0.55).addScaledVector(hb, h.side * rW * h.lat * 0.92);
        hd.copy(hn).addScaledVector(hb, h.side * h.lat * 0.4).normalize();
        size = (0.0035 + rW * 0.12 * (1.25 - h.lat)) * (0.45 + 0.55 * prof) * h.k;
      }
      hv.crossVectors(hd, ht).normalize();
      const tl = tmp.crossVectors(hv, hd).normalize();
      sBasis.makeBasis(tl, hd, hv);
      sScale.set(size, size * 0.75, size);
      sm4.copy(sBasis).scale(sScale).setPosition(hc);
      suckers.setMatrixAt(k, sm4);
    });
    suckers.instanceMatrix.needsUpdate = true;
    writeWeb();
  }
  const wa = new THREE.Vector3(), wb = new THREE.Vector3(), wc = new THREE.Vector3(), wd = new THREE.Vector3(), wq = new THREE.Vector3();
  function writeWeb() {
    // a membrane between each pair of neighbouring arms, deepest at the crown, scalloped at its edge
    const order = armIdx.slice().sort((x, y) => specs[x].ang - specs[y].ang);
    let o = 0;
    order.forEach((ai, pi) => {
      const bi = order[(pi + 1) % order.length];
      for (let i = 0; i <= WK; i++) for (let j = 0; j <= WJ; j++) {
        const v = j / WJ, sc = 0.17 * (1 - 0.55 * Math.sin(Math.PI * v)) * (i / WK);
        const ra = frameAt(ai, sc)[0]; wa.copy(hp);
        const rb = frameAt(bi, sc)[0]; wb.copy(hp);
        wd.subVectors(wb, wa); const dl = wd.length() || 1; wd.multiplyScalar(1 / dl);
        wa.addScaledVector(wd, ra * 0.8); wb.addScaledVector(wd, -rb * 0.8);
        wc.lerpVectors(wa, wb, v);
        wq.set(0, -wc.y, -wc.z); if (wq.lengthSq() > 1e-10) wq.normalize();
        wc.addScaledVector(wq, Math.sin(Math.PI * v) * 0.09 * dl);   // sags in toward the mouth
        webPos[o++] = wc.x; webPos[o++] = wc.y; webPos[o++] = wc.z;
      }
    });
    webGeo.attributes.position.needsUpdate = true;
    webGeo.computeVertexNormals();
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
    if (Q.jet >= 1) { Q.jetE = 1; Q.jet = 0; Q.ph = Math.ceil(Q.ph / TAU) * TAU; }
    Q.jetE = Math.max(0, Q.jetE - dt * 0.55);
    Q.ph += dt / period * TAU * (1 + Q.jetE * 1.5);
    Q.cyc = (Q.ph / TAU) % 1;
    const shape = cycleShape(Q.cyc);
    Q.pulse = lp(Q.pulse, Math.max(shape * (Q.mode === 'idle' ? 0.5 : 0.85), Q.jetE * (Q.cyc < 0.3 ? 1 : 0)), k1(dt, 14));
    // forward surge comes from the push; it decays into a glide
    const push = Q.cyc < 0.32 ? 1 : 0;
    Q.speed = lp(Q.speed, (Q.mode === 'idle' ? 0.12 : 0.42) + push * (0.35 + Q.jetE * 1.6) + Q.agit * 0.4, k1(dt, push ? 5 : 1.4));
    Q.surge = lp(Q.surge, push * 0.045 * (1 + Q.jetE * 1.5) + 0.012 * Math.max(0, Math.sin(Q.ph)), k1(dt, push ? 6 : 1.8));
    Q.spread = lp(Q.spread, Q.mode === 'idle' ? 1.1 : 0.95 + Q.agit * 0.3, k1(dt, 1.5));
    Q.finAmp = lp(Q.finAmp, (Q.mode === 'idle' ? 1.0 : 0.9) * (1 - Q.jetE * 0.8) + Q.agit * 0.3, k1(dt, 2));

    // body attitude: fin first and upward; a slow drift so it never looks fixed
    const curious = (ctx.pointerX || 0);
    Q.yaw = lp(Q.yaw, 0.3 * Math.sin(t * 0.17) + 0.12 * Math.sin(t * 0.41 + 2.0) + curious * 0.12 * (1 - Q.agit) - curious * 0.2 * Q.agit, k1(dt, 0.8));
    Q.pitch = lp(Q.pitch, 0.2 * Math.sin(t * 0.21 + 1) + 0.08 * Math.sin(t * 0.53) + (ctx.pointerY || 0) * 0.06 + (Q.mode === 'idle' ? -0.25 : 0), k1(dt, 0.8));
    Q.roll = lp(Q.roll, 0.38 * Math.sin(t * 0.15 + 2) + 0.12 * Math.sin(t * 0.37) - curious * 0.1, k1(dt, 0.7));
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
    const fwd = new THREE.Vector3(0.84, 0.52, 0.1).normalize();
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
    dispose() { bodyMesh.geometry.dispose(); eyeMesh.geometry.dispose(); fin.geo.dispose(); limbs.geo.dispose(); suckGeo.dispose(); suckMat.dispose(); webGeo.dispose(); mat.dispose(); finMat.dispose(); },
  };
}
