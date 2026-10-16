import { input } from '../core/input.js';
import { reducedMotion } from '../core/quality.js';

// Every word on the page lives in the water: headings split into letters that lift, tilt and
// glow when the cursor (or a finger) comes near; body text splits into words that rise and
// brighten; everything bobs gently, and whole cards drag slightly when you scroll fast.
const INK = [230, 251, 251], DIM = [214, 246, 248], GLOW = [127, 243, 255], ACCENT = [255, 122, 107];

function split(el, mode) {
  const pieces = [];
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((tok) => {
          if (!tok) return;
          if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(tok)); return; }
          const w = document.createElement('span');
          w.className = 'rt-w';
          if (mode === 'chars') {
            for (const ch of tok) {
              const c = document.createElement('span');
              c.className = 'rt-c'; c.textContent = ch;
              w.appendChild(c); pieces.push(c);
            }
          } else { w.textContent = tok; pieces.push(w); }
          frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.classList.contains('rt-w')) walk(n);
    });
  };
  walk(el);
  return pieces;
}

export function createReactiveText() {
  const groups = [];
  const add = (sel, mode, opts) => document.querySelectorAll(sel).forEach((el) => {
    const card = el.closest('.card') || el;
    const pieces = split(el, mode).map((p, i) => ({ el: p, i, ox: 0, oy: 0, y: 0, r: 0, s: 1, g: 0 }));
    const baseColor = getComputedStyle(el).color.match(/\d+/g)?.slice(0, 3).map(Number) || INK;
    groups.push({ el, card, mode, pieces, baseColor, ...opts });
  });
  add('.hero__name > span:first-child', 'chars', { radius: 280, lift: 18, tilt: 7, scale: 0.1, glow: GLOW, bob: 2.2 });
  add('.hero__name > span:last-child', 'chars', { radius: 280, lift: 18, tilt: 7, scale: 0.1, glow: ACCENT, bob: 2.2, outline: true });
  add('.card__title', 'chars', { radius: 260, lift: 14, tilt: 6, scale: 0.08, glow: GLOW, bob: 1.6 });
  add('.hero__role', 'words', { radius: 200, lift: 6, tilt: 2, scale: 0.04, glow: ACCENT, bob: 0.8 });
  add('.card__eyebrow, .card__num, .card__phase', 'chars', { radius: 160, lift: 5, tilt: 0, scale: 0, glow: GLOW, bob: 0.4 });
  add('.card__body, .hero__lead', 'words', { radius: 170, lift: 4, tilt: 0, scale: 0.02, glow: INK, bob: 0.6 });

  const measure = () => {
    groups.forEach((g) => {
      const base = g.el.getBoundingClientRect();
      g.pieces.forEach((p) => {
        const prev = p.el.style.transform; p.el.style.transform = 'none';
        const r = p.el.getBoundingClientRect();
        p.ox = r.left - base.left + r.width / 2; p.oy = r.top - base.top + r.height / 2;
        p.el.style.transform = prev;
      });
    });
  };
  measure();
  addEventListener('resize', () => requestAnimationFrame(measure));
  document.fonts && document.fonts.ready.then(measure);

  // touches count as a pointer for a moment after the finger moves
  let touchX = -1e4, touchY = -1e4, touchK = 0;
  addEventListener('touchstart', (e) => { const t = e.touches[0]; touchX = t.clientX; touchY = t.clientY; touchK = 1; }, { passive: true });
  addEventListener('touchmove', (e) => { const t = e.touches[0]; touchX = t.clientX; touchY = t.clientY; touchK = 1; }, { passive: true });

  let skew = 0;
  const mix = (a, b, t) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;

  return {
    update(dt, time, velocity) {
      touchK *= Math.exp(-dt * 0.9);
      const usingTouch = touchK > 0.02;
      const px = usingTouch ? touchX : input.px, py = usingTouch ? touchY : input.py;
      const strength = usingTouch ? touchK : input.active ? 1 : 0;
      const k = 1 - Math.exp(-dt * 9);
      skew += (Math.max(-3.5, Math.min(3.5, velocity * 0.05)) - skew) * (1 - Math.exp(-dt * 5));
      const motion = reducedMotion ? 0.3 : 1;

      for (const g of groups) {
        const vis = g.card._p === undefined ? 1 : g.card._p;
        if (vis < 0.01) continue;
        const base = g.el.getBoundingClientRect();
        if (base.bottom < -100 || base.top > innerHeight + 100) continue;
        if (g.mode === 'chars') g.el.style.transform = `skewY(${(skew * 0.6 * motion).toFixed(2)}deg)`;
        for (const p of g.pieces) {
          const cx = base.left + p.ox, cy = base.top + p.oy;
          const dx = px - cx, dy = py - cy;
          const d = Math.hypot(dx, dy);
          const f = d < g.radius ? Math.pow(1 - d / g.radius, 2) * strength : 0;
          const bob = Math.sin(time * 1.3 + p.i * 0.55 + base.top * 0.01) * g.bob * motion;
          const wave = Math.sin(p.i * 0.45 - time * 6) * Math.min(Math.abs(velocity) * 0.12, 6) * motion;
          const ty = -f * g.lift * motion + bob + wave;
          const rot = g.tilt ? f * g.tilt * (dx > 0 ? -1 : 1) * motion : 0;
          const sc = 1 + f * g.scale;
          p.y += (ty - p.y) * k; p.r += (rot - p.r) * k; p.s += (sc - p.s) * k; p.g += (f - p.g) * k;
          p.el.style.transform = `translate3d(0,${p.y.toFixed(2)}px,0) rotate(${p.r.toFixed(2)}deg) scale(${p.s.toFixed(3)})`;
          if (g.outline) p.el.style.webkitTextStrokeColor = p.g > 0.01 ? mix(DIM, g.glow, Math.min(p.g * 1.4, 1)) : '';
          else p.el.style.color = p.g > 0.01 ? mix(g.baseColor, g.glow, Math.min(p.g * 1.3, 1)) : '';
          p.el.style.textShadow = p.g > 0.05 ? `0 0 ${(p.g * 18).toFixed(1)}px rgba(${g.glow.join(',')},${(p.g * 0.55).toFixed(2)})` : '';
        }
      }
    },
  };
}
