// Picks a quality tier from the device, and steps down if the frame rate stays low.
const TIERS = {
  high: { dpr: 2,   far: 6500, mid: 1800, near: 70, bubbles: 260, shafts: 14, bloom: 1,   samples: 4, floorSeg: 220 },
  med:  { dpr: 1.5, far: 4000, mid: 1200, near: 46, bubbles: 180, shafts: 10, bloom: 0.5, samples: 2, floorSeg: 160 },
  low:  { dpr: 1,   far: 2000, mid: 650,  near: 24, bubbles: 100, shafts: 6,  bloom: 0.5, samples: 0, floorSeg: 100 },
};
const ORDER = ['high', 'med', 'low'];

export const isTouch = matchMedia('(hover: none), (pointer: coarse)').matches;
export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function pickTier() {
  const q = new URLSearchParams(location.search).get('q');
  if (q && TIERS[q]) return q;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const saveData = navigator.connection && navigator.connection.saveData;
  const small = Math.min(screen.width, screen.height) < 500;
  if (saveData || (isTouch && (cores <= 4 || mem <= 2))) return 'low';
  if (isTouch || small || cores <= 4) return 'med';
  return 'high';
}

export const quality = {
  name: pickTier(),
  get cfg() { return TIERS[this.name]; },
  listeners: [],
  onChange(fn) { this.listeners.push(fn); },
  stepDown() {
    const i = ORDER.indexOf(this.name);
    if (i >= ORDER.length - 1) return false;
    this.name = ORDER[i + 1];
    this.listeners.forEach((f) => f(this.name));
    return true;
  },
};

// Frame-rate watch: average over 3 s windows, after the intro has settled.
export function createFpsWatch() {
  let acc = 0, frames = 0, armed = false, drops = 0;
  setTimeout(() => (armed = true), 6000);
  return (dt) => {
    if (!armed || drops >= 2) return;
    acc += dt; frames++;
    if (acc >= 3) {
      const fps = frames / acc;
      acc = 0; frames = 0;
      if (fps < 38 && quality.stepDown()) { drops++; console.info('[quality] stepped down to', quality.name, Math.round(fps) + 'fps'); }
    }
  };
}
