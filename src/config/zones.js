// The dive: one entry per scene. `from`/`to` are the depths shown on the meter (metres).
// Each zone gets an equal share of the scroll; depth is linear inside a zone.
export const ZONES = [
  { id: 'hero',       num: '01', name: 'Sunlit Zone',   from: 0,    to: 200 },
  { id: 'about',      num: '02', name: 'Sunlit Edge',   from: 200,  to: 500 },
  { id: 'experience', num: '03', name: 'Twilight Zone', from: 500,  to: 1000 },
  { id: 'archive',    num: '04', name: 'The Archive',   from: 1000, to: 2000 },
  { id: 'abyss',      num: '05', name: 'The Abyss',     from: 2000, to: 3800 },
  { id: 'core',       num: '06', name: 'The Core',      from: 3800, to: 4000 },
];

export const MAX_DEPTH = 4000;

// World units: the camera starts a little under the surface and sinks this far by the end.
export const WORLD = {
  surfaceY: 0,
  startY: -7,
  travel: 190,          // world units from first to last zone
  floorOffset: 5.5,     // sea floor sits this far below the final camera height
};

// Environment keyframes by depth (metres). Everything in the ocean reads these.
// top/mid/deep = water colour looking up / level / down. fogD = fog density per world unit.
export const ENV = [
  { d: 0,    top: '#7fe6ee', mid: '#1c93a8', deep: '#063a4c', fog: '#11738a', fogD: 0.030, rays: 1.00, caustic: 1.0, snow: 0.35, bio: 0.00, torch: 0.10, bloom: 0.55, warm: 0 },
  { d: 200,  top: '#2fa8bd', mid: '#0e6478', deep: '#032738', fog: '#0b5466', fogD: 0.045, rays: 0.70, caustic: 0.5, snow: 0.55, bio: 0.05, torch: 0.25, bloom: 0.60, warm: 0 },
  { d: 500,  top: '#16627e', mid: '#073b55', deep: '#011522', fog: '#063550', fogD: 0.060, rays: 0.32, caustic: 0.1, snow: 0.70, bio: 0.20, torch: 0.50, bloom: 0.70, warm: 0 },
  { d: 1000, top: '#123a63', mid: '#061f3c', deep: '#010812', fog: '#05193a', fogD: 0.075, rays: 0.10, caustic: 0.0, snow: 0.85, bio: 0.45, torch: 0.75, bloom: 0.80, warm: 0 },
  { d: 2000, top: '#082539', mid: '#031322', deep: '#00050a', fog: '#03121f', fogD: 0.085, rays: 0.02, caustic: 0.0, snow: 1.00, bio: 0.70, torch: 0.90, bloom: 0.85, warm: 0 },
  { d: 3200, top: '#04141d', mid: '#020b12', deep: '#000305', fog: '#020a10', fogD: 0.090, rays: 0.00, caustic: 0.0, snow: 0.85, bio: 0.85, torch: 1.00, bloom: 0.90, warm: 0.3 },
  { d: 3800, top: '#04161b', mid: '#030b0d', deep: '#120602', fog: '#060b0a', fogD: 0.075, rays: 0.00, caustic: 0.0, snow: 0.70, bio: 0.70, torch: 1.00, bloom: 0.95, warm: 1.0 },
  { d: 4000, top: '#031a20', mid: '#020c10', deep: '#0a0503', fog: '#04100f', fogD: 0.070, rays: 0.00, caustic: 0.0, snow: 0.90, bio: 1.00, torch: 1.00, bloom: 1.00, warm: 0.6 },
];

/** scroll progress (0..1) -> depth in metres */
export function depthAt(t) {
  const n = ZONES.length;
  const x = Math.min(Math.max(t, 0), 1) * n;
  const i = Math.min(Math.floor(x), n - 1);
  const z = ZONES[i];
  return z.from + (z.to - z.from) * (x - i);
}

/** zone index for a scroll progress */
export function zoneAt(t) {
  return Math.min(Math.floor(Math.min(Math.max(t, 0), 0.99999) * ZONES.length), ZONES.length - 1);
}

/** scroll progress where a zone's scene is framed best (used by depth-meter jumps) */
export function zoneCenter(i) {
  return i === 0 ? 0 : (i + 0.3) / ZONES.length;
}
