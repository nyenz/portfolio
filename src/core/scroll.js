import Lenis from 'lenis';
import { ZONES, depthAt } from '../config/zones.js';

// Smooth, weighted scroll. Exposes progress (0..1 over the whole dive), the zone float
// (0..6: integer part = zone, fraction = how far through it) and the scroll speed.
export const scroll = {
  lenis: null,
  t: 0,          // 0..1 over the dive
  x: 0,          // zone float
  depth: 0,      // metres
  zone: 0,
  local: 0,      // 0..1 inside the current zone
  velocity: 0,   // smoothed, px per frame-ish
  zoneH: 1,
  locked: false,
};

export function initScroll(reduced) {
  const lenis = new Lenis({
    lerp: reduced ? 0.2 : 0.075,
    wheelMultiplier: 0.9,
    touchMultiplier: 1.4,
    smoothWheel: true,
  });
  scroll.lenis = lenis;
  const measure = () => {
    const first = document.querySelector('.zone');
    scroll.zoneH = first ? first.offsetHeight : innerHeight * 1.7;
  };
  measure();
  addEventListener('resize', measure);
  lenis.on('scroll', ({ scroll: y, velocity }) => {
    scroll.raw = y;
    scroll.velocity = velocity;
    if (y > 8) document.body.classList.add('has-scrolled');
  });
  return lenis;
}

export function updateScroll(time) {
  const lenis = scroll.lenis;
  if (!lenis) return;
  lenis.raf(time);
  const y = lenis.animatedScroll ?? lenis.scroll;
  const n = ZONES.length;
  scroll.x = Math.min(Math.max(y / scroll.zoneH, 0), n);
  scroll.t = scroll.x / n;
  scroll.depth = depthAt(scroll.t);
  scroll.zone = Math.min(Math.floor(scroll.x), n - 1);
  scroll.local = scroll.x - scroll.zone;
}

/** scroll to a progress value (0..1) */
export function scrollToProgress(t, opts = {}) {
  const y = t * ZONES.length * scroll.zoneH;
  scroll.lenis.scrollTo(y, { duration: 2.4, easing: (k) => 1 - Math.pow(1 - k, 4), ...opts });
}
