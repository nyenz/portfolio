import { ZONES, zoneCenter } from '../config/zones.js';
import { scramble } from './scramble.js';

// Depth meter (a clickable map of the dive), live readouts, zone label and card reveals.
export function createHud({ onJump }) {
  const ticks = document.querySelector('.meter__ticks');
  ZONES.forEach((z, i) => {
    const li = document.createElement('li');
    li.style.top = `${(i / ZONES.length) * 100}%`;
    li.innerHTML = `<button class="tick" type="button" data-cursor="DIVE TO ${z.from} M" aria-label="Dive to ${z.name}, ${z.from} metres">
      <span class="tick__name">${z.name.toUpperCase()}</span><span class="tick__num">${z.num}</span></button>`;
    li.querySelector('button').addEventListener('click', (e) => onJump(zoneCenter(i), e.clientX, e.clientY));
    ticks.appendChild(li);
  });
  // bottom end tick
  const end = document.createElement('li');
  end.style.top = '100%';
  end.innerHTML = `<span class="tick" aria-hidden="true" style="cursor:default">4000</span>`;
  ticks.appendChild(end);

  document.querySelectorAll('[data-jump]').forEach((el) => {
    el.addEventListener('click', (e) => { e.preventDefault(); onJump(+el.dataset.jump, e.clientX, e.clientY); });
  });

  const els = {
    num: document.querySelector('.meter__num'),
    fill: document.querySelector('.meter__fill'),
    marker: document.querySelector('.meter__marker'),
    p: document.querySelector('.stat-p'),
    t: document.querySelector('.stat-t'),
    l: document.querySelector('.stat-l'),
    zNum: document.querySelector('.zone-label__num'),
    zName: document.querySelector('.zone-label__name'),
    tickBtns: [...document.querySelectorAll('.meter__ticks button')],
    cards: [...document.querySelectorAll('.zone .card')],
  };
  let lastZone = -1, frame = 0;

  // simple ocean model for the readouts (approximate, for flavour)
  const temp = (d) => (d < 1000 ? 26 - 22 * (1 - Math.exp(-d / 260)) : 4 - 2.2 * Math.min((d - 1000) / 3000, 1));

  return {
    update(s, onZoneChange) {
      // marker + fill every frame (smooth), numbers every 3rd frame
      const pct = (s.t * 100).toFixed(3) + '%';
      els.fill.style.height = pct;
      els.marker.style.top = pct;
      if (frame++ % 3 === 0) {
        const d = s.depth;
        els.num.textContent = String(Math.round(d)).padStart(4, '0');
        els.p.textContent = `${(1 + d / 10).toFixed(1)} atm`;
        els.t.textContent = `${temp(d).toFixed(1)} °C`;
        els.l.textContent = `${Math.max(0, 100 * Math.exp(-d / 120)).toFixed(d > 600 ? 2 : 0)}%`;
      }
      if (s.zone !== lastZone) {
        lastZone = s.zone;
        const z = ZONES[s.zone];
        els.zNum.textContent = z.num;
        scramble(els.zName, z.name.toUpperCase(), 700);
        els.tickBtns.forEach((b, i) => b.classList.toggle('is-active', i === s.zone));
        onZoneChange && onZoneChange(s.zone);
      }
      // cards: rise in as their zone arrives, drift out as the next one comes
      els.cards.forEach((c, i) => {
        const local = s.x - i;
        let p = i === 0 ? 1 - smooth(0.42, 0.66, local) : smooth(-0.08, 0.14, local) * (i === ZONES.length - 1 ? 1 : 1 - smooth(0.46, 0.66, local));
        p = Math.max(0, Math.min(1, p));
        if (Math.abs((c._p ?? -1) - p) > 0.001) { c.style.setProperty('--p', p.toFixed(3)); c._p = p; c.style.visibility = p < 0.002 ? 'hidden' : 'visible'; }
      });
    },
  };
}

function smooth(a, b, x) { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); }
