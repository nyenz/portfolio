import { input } from '../core/input.js';
import { isTouch } from '../core/quality.js';

// Custom cursor (ring + dot + label), magnetic buttons, and hero letters that ripple
// like they sit under water when the cursor passes.
export function createCursor() {
  const root = document.getElementById('cursor');
  if (isTouch) { document.body.classList.add('no-cursor'); return { update() {} }; }
  document.body.classList.add('custom-cursor');
  const ring = root.querySelector('.cursor__ring');
  const dot = root.querySelector('.cursor__dot');
  const label = root.querySelector('.cursor__label');
  let rx = innerWidth / 2, ry = innerHeight / 2;

  // hover states
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest && e.target.closest('a,button,[data-cursor]');
    root.classList.toggle('is-hover', !!el);
    const txt = el && (el.dataset.cursor || '');
    label.textContent = txt;
    root.classList.toggle('has-label', !!txt);
  });

  // magnetic elements
  const mags = [...document.querySelectorAll('[data-magnetic]')];
  const magState = mags.map(() => ({ x: 0, y: 0 }));

  return {
    update(dt) {
      const k = 1 - Math.exp(-dt * 14);
      rx += (input.px - rx) * k; ry += (input.py - ry) * k;
      dot.style.transform = `translate3d(${input.px}px, ${input.py}px, 0)`;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      label.style.transform = `translate3d(${rx + 26}px, ${ry + 14}px, 0)`;
      root.classList.toggle('is-drag', input.dragging);
      root.style.opacity = input.active ? 1 : 0;

      // magnets: pull toward the cursor when close
      mags.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2 - magState[i].x, cy = r.top + r.height / 2 - magState[i].y;
        const dx = input.px - cx, dy = input.py - cy;
        const d = Math.hypot(dx, dy), reach = Math.max(r.width, r.height) * 1.1 + 30;
        const f = d < reach ? (1 - d / reach) : 0;
        magState[i].x += (dx * f * 0.35 - magState[i].x) * k;
        magState[i].y += (dy * f * 0.35 - magState[i].y) * k;
        el.style.transform = `translate3d(${magState[i].x.toFixed(2)}px, ${magState[i].y.toFixed(2)}px, 0)`;
      });

    },
  };
}
