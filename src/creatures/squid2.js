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
const MANTLE = [[-0.04, 0.16], [0.0, 0.166], [0.05, 0.182], [0.11, 0.193], [0.17, 0.192], [0.22, 0.182], [0.27, 0.166], [0.31, 0.149], [0.35, 0.128], [0.39, 0.1], [0.42, 0.073], [0.45, 0.046], [0.5, 0.03], [0.6, 0.022], [0.8, 0.013], [0.95, 0.006], [1.0, 0.002]];
const HEAD = [[0.07, 0.075], [0.03, 0.08], [-0.02, 0.086], [-0.07, 0.09], [-0.11, 0.084], [-0.145, 0.074], [-0.175, 0.066], [-0.2, 0.058], [-0.215, 0.04], [-0.222, 0.001]].reverse();   // ascending x for curve()
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
  if (u < 0.3) return 0.226 * Math.pow(Math.sin((u / 0.3) * Math.PI / 2), 0.5);   // rounded front lobes
  const v = (u - 0.3) / 0.7;
  return 0.226 * Math.pow(1 - v, 0.6);                                              // near-straight edges to the tip
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
function mantlePoint(x, a, scaleR, out) {
  const r = curve(MANTLE, x) * scaleR;
  const mantleZone = 1 - ss(0.36, 0.44, x);
  const hRatio = lp(0.78, 1.0 + 0.14 * Math.exp(-Math.pow((x - 0.2) / 0.14, 2)), mantleZone);   // deepest mid-mantle (side photo)   // round at the collar, deeper than wide toward the rear (side photo)   // wide and flat at the collar, deep and round behind it   // flat and wide at the collar, round behind           // tail rod is flatter
  const ca = Math.cos(a), sa = Math.sin(a);
  const sq = 1;
  const rk = ss(0.03, 0.2, x) * mantleZone;
  const groove = 1 + 0.07 * rk * Math.exp(-(a * a) / 0.006) - 0.035 * rk * Math.exp(-Math.pow(Math.abs(a) - 0.2, 2) / 0.006) - 0.18 * (1 - mantleZone) * Math.exp(-(a * a) / 0.018);
  const ventralFlat = 1;
  const rr = r * sq * groove * ventralFlat;
  const yAsym = lp(1, lp(0.88, 1.18, (1 - ca) / 2) , mantleZone * (1 - ss(0.3, 0.42, x) * 0.6));   // flatter back, deep rounded belly
  // the body rides slightly high behind the mantle so the fin sits on the back
  const lift = 0.02 * ss(0.3, 0.5, x);
  return out.set(x, ca * rr * hRatio * yAsym + lift - 0.012 * mantleZone, sa * rr);
}

function buildBody() {
  const B = GeoBuilder();
  const NA = 56;
  // outer mantle + tail rod (angle a: 0 = top)
  const rimX = (a) => -0.04 + 0.11 * Math.pow((1 - Math.cos(a)) / 2, 1.3);   // the back of the collar reaches forward over the head; the belly side is cut back
  B.grid(110, NA, (u, v, o) => { const a = (v - 0.5) * TAU; const x = lp(rimX(a), 1.0, Math.pow(u, 1.15)); mantlePoint(x, a, 1, o); }, P_MANTLE, false);
  // inner wall of the collar opening (dark), slightly inside the rim
  // rolled lip: a half-round from the outer skin to the inner wall
  B.grid(8, NA, (u, v, o) => { const a = (v - 0.5) * TAU, t = u * Math.PI; mantlePoint(rimX(a) - 0.014 * Math.sin(t), a, 1 - 0.045 * (1 - Math.cos(t)), o); }, P_MANTLE, false, undefined, 0);
  B.grid(16, NA, (u, v, o) => { const x = lp(rimX((v - 0.5) * TAU), 0.22, u); mantlePoint(x, (v - 0.5) * TAU, 0.91 * (1 - u * 0.25), o); }, P_INNER, true);
  // head (neck hidden inside the collar, bulge, crown where the arms grow)
  B.grid(40, 40, (u, v, o) => {
    const x = lp(0.07, -0.222, u), r = curve(HEAD, x), a = (v - 0.5) * TAU;
    o.set(x, Math.cos(a) * r * 1.18 + 0.012, Math.sin(a) * r * 0.92);   // deeper than wide (side vs top photos)
  }, P_HEAD, true);
  // funnel: a short cone under the head, coming out of the collar
  B.grid(8, 14, (u, v, o) => {
    const x = lp(0.02, -0.085, u), r = lp(0.03, 0.017, u), a = (v - 0.5) * TAU;
    o.set(x, -0.088 + Math.cos(a) * r * 0.8 + u * 0.012, Math.sin(a) * r);
  }, P_FUNNEL, true);
  return B.build();
}

function buildEyes() {
  const B = GeoBuilder();
  for (const side of [-1, 1]) {
    B.grid(18, 24, (u, v, o) => {
      const th = u * Math.PI, ph = v * TAU, r = 0.05;
      // the eye looks sideways (local z), u=0 at the pupil
      o.set(Math.sin(th) * Math.cos(ph) * r - 0.075, Math.sin(th) * Math.sin(ph) * r * 0.95 + 0.022, side * (0.07 + Math.cos(th) * r * 0.55));
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
      const x0 = 0.402;
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
      float k = 1.0 - uPulse * 0.085 * zone + uFlare * 0.05 * rim;
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

  const vec3 RED = vec3(0.86, 0.09, 0.15);
  const vec3 RED2 = vec3(0.99, 0.27, 0.32);
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
      float fleck = smoothstep(0.86, 0.92, n3(q * vec3(22.0, 90.0, 60.0))) * smoothstep(0.45, 0.7, fbm(q * 4.0 + 5.0));
      float dorsal = smoothstep(-0.05, 0.08, vL.y);
      flecks = clamp(blot * 0.75 + fleck * (0.55 + 0.45 * dorsal), 0.0, 1.0);
      // dark midline groove
      float groove = exp(-pow(vL.z / 0.009, 2.0)) * smoothstep(0.03, 0.15, vL.x) * dorsal;
      float ridge = exp(-pow((abs(vL.z) - 0.022) / 0.01, 2.0)) * smoothstep(0.05, 0.2, vL.x) * dorsal;
      base *= 1.0 - groove * 0.7;
      base = mix(base, RED2 * 1.15, ridge * 0.5);
      // pale collar rim
      float rim = 1.0 - smoothstep(0.02, 0.1, vUv.x + (m - 0.5) * 0.035);
      if (part == ${P_MANTLE}) { base = mix(base, PALE * 1.02, rim * 0.92); flecks *= 1.0 - rim; }
      if (part == ${P_HEAD}) {
        base = mix(base, base * vec3(1.0, 0.9, 0.95), 0.3); flecks *= 0.8;
        float de = length(vec2(vL.x + 0.075, vL.y - 0.022)) * step(0.03, abs(vL.z)) + (1.0 - step(0.03, abs(vL.z)));
        base = mix(base, vec3(0.45, 0.5, 0.45), smoothstep(0.012, 0.0, abs(de - 0.05)) * 0.3);  // faint silver rim
        base *= 1.0 - 0.25 * smoothstep(0.062, 0.05, de);                                         // the socket is a little darker
        flecks *= smoothstep(0.05, 0.08, de);
      }
      if (part == ${P_FUNNEL}) base = mix(RED, vec3(0.5, 0.2, 0.25), 0.4);
    } else if (part == ${P_INNER}) {
      base = vec3(0.02, 0.035, 0.05);
      float rim = 1.0 - smoothstep(0.0, 0.14, vUv.x);
      base = mix(base, PALE * 1.0, rim);
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
      float s = vRest.x, ang = vRest.y, f = vUv.x;  // distance along, angle around (0 = inner face), fraction along
      float c = cos(ang * 6.2831853);
      float inner = smoothstep(0.1, 0.75, c);         // oral face (where the hooks sit)
      float outer = smoothstep(0.2, -0.7, c);         // aboral back of the arm
      float m = fbm(vec3(s * 18.0, ang * 4.0, vRest.z * 3.1));
      if (part == ${P_ARM}) {
        vec3 back = mix(RED, RED2, smoothstep(0.35, 0.7, m));
        back = mix(back, vec3(0.9, 0.62, 0.66), smoothstep(0.5, 0.75, fbm(vec3(s * 22.0, ang * 5.0, vRest.z * 4.0 + 8.0))) * 0.6);
        vec3 face = vec3(0.74, 0.8, 0.77);                          // grey-green oral face
        base = mix(face, back, smoothstep(-0.2, 0.45, -c) * 0.85 + 0.15);
        // two staggered rows of hook sockets along the oral face
        float row = sin(ang * 6.2831853 * 2.0);
        float ring = abs(sin(s * 165.0 + step(0.0, row) * 1.57));
        float sock = (1.0 - smoothstep(0.55, 0.9, ring)) * inner;
        base = mix(base, vec3(0.9, 0.9, 0.88), sock * 0.25);
        base *= 1.0 - inner * 0.12 * smoothstep(0.85, 1.0, ring);
        // a dark seam where the red back meets the pale face
        base *= 1.0 - 0.35 * exp(-pow((c - 0.15) / 0.12, 2.0));
        // white blotches on the back, pale toward the tip
        float blot = smoothstep(0.56, 0.68, fbm(vec3(s * 44.0, ang * 9.0, vRest.z * 7.0)));
        flecks = blot * (0.4 + outer * 0.6);
        base = mix(base, vec3(0.86, 0.84, 0.85), smoothstep(0.6, 1.0, f) * 0.8);
      } else {
        // stalk: crisp red / white bands, red near the base; club: pale with pink blotches
        float bandN = n3(vec3(floor(s * 52.0), vRest.z, 1.0));
        float band = step(0.38 + bandN * 0.2, fract(s * 52.0));
        vec3 stalk = mix(vec3(0.94, 0.9, 0.9), RED2 * 0.92, band);
        stalk = mix(stalk, vec3(0.95), smoothstep(0.8, 0.9, n3(vec3(s * 160.0, ang * 10.0, 3.0))) * 0.6);
        stalk = mix(stalk, RED, 1.0 - smoothstep(0.02, 0.12, f));
        float club = smoothstep(0.68, 0.73, f);
        // club: pink-red mottled with white, the toothed edge and the tip go pale
        float mot = fbm(vec3(s * 70.0, ang * 7.0, vRest.z * 5.0 + 4.0));
        vec3 clubC = mix(vec3(0.86, 0.26, 0.36), vec3(0.95, 0.9, 0.9), smoothstep(0.42, 0.62, mot));
        float cu = clamp((f - 0.7) / 0.3, 0.0, 1.0);
        clubC = mix(clubC, vec3(0.95, 0.93, 0.92), smoothstep(0.75, 1.0, cu) * 0.7 + inner * 0.25);
        base = mix(stalk, clubC, club);
        flecks = club * smoothstep(0.66, 0.74, fbm(vec3(s * 60.0, ang * 6.0, 2.0))) * 0.6;
      }
      spec = 0.55; gloss = 36.0;
    } else if (part == ${P_HOOK}) {
      // hook: bone white, a little pink at the root, glossy
      base = mix(vec3(0.86, 0.6, 0.64), vec3(0.97, 0.96, 0.93), smoothstep(0.0, 0.7, vRest.y));
      spec = 0.9; gloss = 60.0;
    } else { // eye
      vec3 c = vec3(-0.075, 0.022, sign(vL.z) * 0.07);
      vec3 d = normalize(vL - c);
      vec3 look = normalize(vec3(uEye.x * 0.6, uEye.y * 0.4, sign(vL.z)));
      float k = dot(d, look);
      // red lid -> silver ring -> green-grey iris -> big black pupil
      vec3 iris = mix(vec3(0.62, 0.7, 0.68), vec3(0.36, 0.44, 0.42), smoothstep(0.9, 0.95, k));
      base = mix(RED * 0.55, vec3(0.1, 0.12, 0.11), smoothstep(0.35, 0.48, k));         // skin lid -> dark eye
      base = mix(base, vec3(0.62, 0.68, 0.64), smoothstep(0.035, 0.0, abs(k - 0.66)) * 0.75); // pale iris ring
      base = mix(base, vec3(0.14, 0.18, 0.17), smoothstep(0.68, 0.72, k));
      base = mix(base, vec3(0.005, 0.01, 0.012), smoothstep(0.78, 0.82, k));          // big black pupil
      spec = 1.6; gloss = 140.0;
    }

    float underK = 0.0;
    // counter-shading: the underside is dark blue-black with only a red rim (the belly photos)
    if (part != ${P_EYE} && part != ${P_INNER} && part != ${P_HOOK}) {
      vec3 nl = normalize(vNL + vec3(0.0, 1e-5, 0.0));
      float ny = (part == ${P_MANTLE} || part == ${P_HEAD} || part == ${P_FUNNEL}) ? (vL.y - 0.01) / max(length(vL.yz - vec2(0.01, 0.0)), 1e-3) : nl.y;
      float under = part == ${P_FIN} ? smoothstep(0.05, -0.15, dot(V, normalize(vN))) : smoothstep(0.3, -0.4, ny);
      if (part == ${P_FIN}) under *= 1.0 - smoothstep(0.5, 0.85, clamp(abs(vL.z) / max(1e-3, finHalfGLSL(vL.x)), 0.0, 1.0));
      if (part == ${P_ARM} || part == ${P_TENT}) under *= 0.85;
      base = mix(base, vec3(0.025, 0.045, 0.055) + base * vec3(0.12, 0.05, 0.06), under * 0.95);
      flecks *= 1.0 - under * 0.9;
      underK = under;
    }
    // white flecks are brighter and a bit glossy
    base = mix(base, PALE * 1.05, flecks * 0.8);

    // light: sun from above through water, dark blue-green belly (counter-shading)
    vec3 L = normalize(uSunD);
    float wrap = clamp((dot(N, L) + 0.35) / 1.35, 0.0, 1.0);
    float up = N.y * 0.5 + 0.5;
    vec3 amb = mix(uDeepTint * 1.6, uTop * 0.3 + vec3(0.12, 0.1, 0.1), up);
    vec3 col = base * (amb * 0.95 + vec3(1.0, 0.96, 0.92) * wrap * 1.25 + 0.12);   // the skin glows a little (the reference is luminous)
    // belly falls into a dark teal shadow
    float belly = smoothstep(0.1, -0.5, N.y);
    col = mix(col, uDeepTint * 0.9 + base * 0.12, belly * 0.3);

    // specular + glitter: tiny specks that twinkle as the squid turns (the "shine specs")
    vec3 H = normalize(L + V);
    float sp = pow(max(dot(N, H), 0.0), gloss) * spec * 1.4 + pow(max(dot(N, H), 0.0), 8.0) * spec * 0.3;
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
    float u = (x - 0.4) / 0.6;
    if (u <= 0.0 || u >= 1.0) return 0.0;
    if (u < 0.3) return 0.226 * pow(sin((u / 0.3) * 1.5707963), 0.5);
    float v = (u - 0.3) / 0.7;
    return 0.226 * pow(max(1.0 - v, 0.0), 0.6);
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
    const len = [0.54, 0.6, 0.68, 0.63][pair] * (0.96 + 0.08 * ((i * 37) % 7) / 7);
    specs.push({ kind: 'arm', part: P_ARM, ang, len, n: 80, r0: 0.02, r1: 0.0012, ph: i * 1.7 });
  }
  for (const s of [-1, 1]) specs.push({ kind: 'tent', part: P_TENT, ang: Math.PI + s * 0.2, len: 1.3, n: 150, r0: 0.017, r1: 0.0098, ph: s > 0 ? 0 : 2.4, side: s });
  const limbs = buildLimbs(specs, RAD);
  const limbMesh = new THREE.Mesh(limbs.geo, mat);
  limbMesh.frustumCulled = false; finMesh.frustumCulled = false;
  body.add(limbMesh);

  // hook list
  const hookList = [];
  specs.forEach((L, li) => {
    if (L.kind === 'arm') {
      for (const side of [-1, 1]) {
        let s = 0.06 + (side > 0 ? 0.5 : 0) * 0.02 / L.len;
        while (s < 0.94) {
          hookList.push({ li, s, side, len: L.len, arm: true, k: 0.8 + Math.random() * 0.35 });
          const w = section(L, s).r * 1.08;
          s += Math.max(0.0045, w * (1.05 + Math.random() * 0.25)) / L.len;   // about one tooth per arm width
        }
      }
    } else {
      for (let s = 0.715; s < 0.985; s += 0.0145 / L.len) hookList.push({ li, s, side: L.side, len: L.len, arm: false });
    }
  });
  const hookGeo = buildHooks(hookList);
  const hookMesh = new THREE.Mesh(hookGeo, mat);
  hookMesh.frustumCulled = false;
  body.add(hookMesh);
  const HP = hookGeo.attributes.position.array, HN = hookGeo.attributes.normal.array;
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
        const wave = Math.sin(ph - x * 7.5);
        const fold = Q.jetE * 0.9 + Q.pulse * 0.12;    // folds down along the body during a push
        const lift = (wave * amp * 0.17 * Math.pow(e, 1.25) - fold * 0.16 * Math.pow(e, 1.1)) * ss(0.36, 0.5, x);
        // a soft cup across the fin (edges slightly up when relaxed)
        const lobe = (1 - ss(0.5, 0.78, x)) * e * e;        // the front lobes cup and open with the beat
        const cup = -0.05 * e * e + 0.02 * e * e * (1 - Q.pulse) + 0.06 * Math.cos(ph - 0.6) * lobe * amp + 0.006 * Math.sin(x * 120 + ph * 0.6) * ss(0.8, 1, e);
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
      const rootR = isT ? 0.02 : 0.046;
      P[0].set(isT ? -0.185 : -0.19, ca * rootR * 1.12 + 0.012, sa * rootR * 0.95);
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
        const ampA = (isT ? 2.0 : 1.0) * (0.15 + 0.85 * s * s) * (0.75 + Q.agit * 0.8 + (Q.mode === 'idle' ? 0.5 : 0));
        // arms leave the crown nearly parallel, fan out slightly, then the tips curl a touch inward
        const open = isT ? spread * (1.2 - s * 0.5) : spread * (1.25 - s * 1.1);
        dir.set(-1, 0, 0)
          .addScaledVector(rad, open)
          .addScaledVector(perp, w1 * ampA * 0.16)
          .addScaledVector(rad, w2 * ampA * 0.1 + (isT ? 0 : -0.26 * s * (0.5 + 0.5 * Math.sin(Q.ph * 0.2 + L.ph))));
        if (!isT) {
          dir.y -= 0.1 * s;                                                     // the bundle droops toward the belly
          dir.addScaledVector(perp, 0.14 * Math.sin(L.ph * 2.3) * s);          // each arm bends its own way
          dir.addScaledVector(rad, -0.18 * ss(0.55, 1.0, s));                   // tips curl inward
        }
        if (isT) {
          // stalks run inside the arm bundle first, then trail in long lazy S-curves
          const free = ss(0.25, 0.45, s);
          dir.addScaledVector(perp, L.side * (0.1 + 0.24 * Math.sin(Q.ph * 0.22 + L.ph)) * free);          // the two stalks drift apart and back together
          dir.addScaledVector(rad, 0.38 * Math.sin(Q.ph * 0.38 - s * 3.5 + L.ph) * s * free);          // clubs swing slowly, behind the beat
          dir.addScaledVector(rad, -0.06 * (1 - free));
        }
        dir.normalize();
        P[i].copy(P[i - 1]).addScaledVector(dir, seg);
      }
      if (!ch.init) { for (let i = 0; i <= L.n; i++) ch.lag[i].copy(P[i]); ch.init = true; }
      for (let i = 1; i <= L.n; i++) {
        const s = i / L.n, f = k1(dt, lp(30, isT ? 3.5 : 7, s));
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
      const r = L.r0 * Math.pow(Math.max(1 - Math.pow(s, 1.5), 0), 0.95) * (0.82 + 0.18 * ss(0.0, 0.05, s)) + L.r1;   // roots tuck into the head, full width just outside it
      return { r, w: 1.08, h: 0.92, club: 0 };
    }
    // tentacle: slightly thicker where it leaves the head, thin stalk, leaf club
    const cu = cl((s - 0.7) / 0.3, 0, 1);
    const club = cu > 0 ? Math.pow(Math.sin(Math.pow(cu, 0.62) * Math.PI), 0.75) : 0;
    let r = lp(L.r0, L.r1, ss(0.0, 0.2, s));
    r *= 1 - ss(0.95, 1.0, s) * 0.7;
    return { r, w: 1 + club * 7.6, h: 1 - club * 0.66, club };
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
  function writeHooks() {
    hookList.forEach((h, k) => {
      const L = specs[h.li], F = frames[h.li];
      const fi = h.s * L.n, i0 = Math.floor(fi), i1 = Math.min(i0 + 1, L.n), w = fi - i0, a = i0 * 14, b = i1 * 14;
      const g = (o) => F[a + o] * (1 - w) + F[b + o] * w;
      hp.set(g(0), g(1), g(2)); ht.set(g(3), g(4), g(5)).normalize(); hn.set(g(6), g(7), g(8)).normalize(); hb.set(g(9), g(10), g(11)).normalize();
      const rW = g(12), rH = g(13);
      let size, thick;
      if (h.arm) {
        // two rows on the edges of the inner face; biggest in the middle of the arm
        // two rows on the edges of the flat inner face; hooked toward the tip like saw teeth
        hc.copy(hp).addScaledVector(hn, rH * 0.5).addScaledVector(hb, h.side * rW * 0.78);
        hd.copy(hb).multiplyScalar(h.side * 0.62).addScaledVector(hn, 0.5).addScaledVector(ht, 0.75).normalize();
        size = (0.002 + rW * 0.62) * (0.6 + 0.4 * Math.sin(Math.PI * cl((h.s - 0.02) / 0.9, 0, 1))) * h.k;
        thick = size * 0.5;
      } else {
        // one row of big teeth along the edge of the club
        const cu = (h.s - 0.7) / 0.3;
        hc.copy(hp).addScaledVector(hb, h.side * rW * 0.86).addScaledVector(hn, rH * 0.25);
        hd.copy(hb).multiplyScalar(h.side).addScaledVector(ht, 0.42).addScaledVector(hn, 0.15).normalize();
        size = 0.008 + 0.04 * Math.pow(Math.sin(Math.PI * Math.pow(cl(cu, 0, 1), 0.7)), 0.8);
        thick = size * 0.45;
      }
      hv.crossVectors(hd, ht).normalize();
      const o = k * 15, half = size * (h.arm ? 0.5 : 0.45);
      // base: two points along the limb, two across (thin blade)
      const put = (n, x, y, z) => { HP[o + n * 3] = x; HP[o + n * 3 + 1] = y; HP[o + n * 3 + 2] = z; };
      put(0, hc.x - ht.x * half, hc.y - ht.y * half, hc.z - ht.z * half);
      put(1, hc.x - hv.x * thick * 0.5, hc.y - hv.y * thick * 0.5, hc.z - hv.z * thick * 0.5);
      put(2, hc.x + ht.x * half, hc.y + ht.y * half, hc.z + ht.z * half);
      put(3, hc.x + hv.x * thick * 0.5, hc.y + hv.y * thick * 0.5, hc.z + hv.z * thick * 0.5);
      put(4, hc.x + hd.x * size, hc.y + hd.y * size, hc.z + hd.z * size);
      const nrm = (n, x, y, z) => { HN[o + n * 3] = x; HN[o + n * 3 + 1] = y; HN[o + n * 3 + 2] = z; };
      nrm(0, -ht.x, -ht.y, -ht.z); nrm(1, -hv.x, -hv.y, -hv.z); nrm(2, ht.x, ht.y, ht.z); nrm(3, hv.x, hv.y, hv.z); nrm(4, hd.x, hd.y, hd.z);
    });
    hookGeo.attributes.position.needsUpdate = true;
    hookGeo.attributes.normal.needsUpdate = true;
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
    Q.spread = lp(Q.spread, Q.mode === 'idle' ? 0.6 : 0.36 + Q.agit * 0.3, k1(dt, 1.5));
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
    dispose() { bodyMesh.geometry.dispose(); eyeMesh.geometry.dispose(); fin.geo.dispose(); limbs.geo.dispose(); hookGeo.dispose(); mat.dispose(); finMat.dispose(); },
  };
}
