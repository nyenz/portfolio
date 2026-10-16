// Text that decodes into place, letter by letter (used on every HUD label).
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/<>*+=';
const running = new WeakMap();

export function scramble(el, text = el.dataset.text || el.textContent, duration = 650) {
  if (!el) return;
  el.dataset.text = text;
  const prev = running.get(el);
  if (prev) cancelAnimationFrame(prev);
  const start = performance.now();
  const len = text.length;
  const step = () => {
    const k = Math.min((performance.now() - start) / duration, 1);
    let out = '';
    for (let i = 0; i < len; i++) {
      const ch = text[i];
      const reveal = k * (len + 4) - i;
      if (ch === ' ' || reveal >= 4) out += ch;
      else if (reveal > 0) out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
      else out += ' ';
    }
    el.textContent = out;
    if (k < 1) running.set(el, requestAnimationFrame(step));
    else { el.textContent = text; running.delete(el); }
  };
  step();
}

/** scramble on hover for every [data-scramble] element (and its closest interactive parent) */
export function initHoverScramble(root = document) {
  root.querySelectorAll('[data-scramble]').forEach((el) => {
    const host = el.closest('a,button') || el;
    host.addEventListener('pointerenter', () => scramble(el, el.dataset.text || el.textContent, 420));
  });
}
