import gsap from 'gsap';
import { PROJECTS, DETAILS, CONTACT } from '../config/content.js';
import { LENS } from '../fx/post.js';
import { scramble } from './scramble.js';

// Project presentations: a short full-screen story per project, told over the live tank.
// Same six parts every time (cover, problem, what it does, how it works, built with + results,
// links), each project with its own transition style between parts.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function diagram(flow) {
  const n = flow.length, W = 920, step = W / n, H = 150;
  const nodes = flow.map((label, i) => {
    const x = step * i + step / 2;
    const words = label.split(' ');
    const lines = []; let cur = '';
    words.forEach((w) => { if ((cur + ' ' + w).trim().length > 13) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w; });
    lines.push(cur.trim());
    return `<g class="pz-node" style="--i:${i}">
      <rect x="${x - step / 2 + 10}" y="40" width="${step - 20}" height="70" rx="14"/>
      ${lines.map((ln, k) => `<text x="${x}" y="${78 - (lines.length - 1) * 9 + k * 18}">${esc(ln)}</text>`).join('')}
    </g>`;
  }).join('');
  const links = flow.slice(1).map((_, i) => {
    const x1 = step * (i + 1) - 10, x2 = step * (i + 1) + 10;
    return `<g class="pz-link" style="--i:${i}"><line x1="${x1 - 2}" y1="75" x2="${x2 + 2}" y2="75"/><circle class="pz-pulse" cx="${x1}" cy="75" r="3"/></g>`;
  }).join('');
  return `<svg class="pz-diagram" viewBox="0 0 ${W} ${H}" role="img" aria-label="How it works: ${esc(flow.join(' to '))}">${links}${nodes}</svg>`;
}

function slides(p, d, idx) {
  const next = PROJECTS[(idx + 1) % PROJECTS.length];
  const links = p.links.length
    ? p.links.map((l) => `<a class="pz-btn" href="${l.href}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')
    : `<a class="pz-btn" href="mailto:${CONTACT.email}?subject=${encodeURIComponent('About ' + p.name)}">Ask me for a demo</a>`;
  return [
    `<section class="pz-slide pz-cover">
      <p class="pz-kicker">${esc(p.kind)} · ${esc(p.year)}</p>
      <h2 class="pz-title">${esc(p.name)}</h2>
      <p class="pz-lead">${esc(p.line)}</p>
      <p class="pz-badge">${esc(p.result)}</p>
    </section>`,
    `<section class="pz-slide pz-problem">
      <p class="pz-kicker">02 · The problem</p>
      <p class="pz-quote">${esc(d.problem)}</p>
    </section>`,
    `<section class="pz-slide pz-features">
      <p class="pz-kicker">03 · What it does</p>
      <div class="pz-cards">${d.features.map(([h, t], i) => `<article class="pz-card" style="--i:${i}"><p class="pz-card__n">0${i + 1}</p><h3>${esc(h)}</h3><p>${esc(t)}</p></article>`).join('')}</div>
    </section>`,
    `<section class="pz-slide pz-how">
      <p class="pz-kicker">04 · How it works</p>
      <div class="pz-diagram-wrap">${diagram(d.flow)}</div>
      <p class="pz-note">Data moves left to right. The glowing dots show it flowing between the parts.</p>
    </section>`,
    `<section class="pz-slide pz-results">
      <p class="pz-kicker">05 · Built with</p>
      <ul class="pz-tech">${p.tech.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <div class="pz-stats">${d.results.map(([v, l]) => `<div><p class="pz-stat__v">${esc(v)}</p><p class="pz-stat__l">${esc(l)}</p></div>`).join('')}</div>
    </section>`,
    `<section class="pz-slide pz-links">
      <p class="pz-kicker">06 · See it</p>
      <h2 class="pz-title pz-title--sm">${esc(p.name)}</h2>
      <div class="pz-btns">${links}</div>
      <button class="pz-next" type="button" data-next="${(idx + 1) % PROJECTS.length}">Next project: ${esc(next.name)} →</button>
    </section>`,
  ];
}

export function createPresentation({ lenis, sound, archive }) {
  const root = document.createElement('div');
  root.id = 'presentation';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="pz-veil"></div>
    <div class="pz-panel" tabindex="-1">
      <div class="pz-track"></div>
      <nav class="pz-nav" aria-label="Presentation">
        <button class="pz-arrow" type="button" data-dir="-1" aria-label="Previous part">←</button>
        <div class="pz-dots"></div>
        <button class="pz-arrow" type="button" data-dir="1" aria-label="Next part">→</button>
      </nav>
      <div class="pz-progress"><i></i></div>
    </div>
    <button class="pz-close" type="button" aria-label="Back to the Archive" data-cursor="BACK"><span></span><span></span></button>
    <p class="pz-hint">← → keys, scroll or swipe · Esc to go back</p>`;
  document.body.appendChild(root);
  const track = root.querySelector('.pz-track'), dots = root.querySelector('.pz-dots'), bar = root.querySelector('.pz-progress i');
  let open = false, idx = 0, part = 0, els = [], style = 'grid', busy = false, wheelT = 0;
  const L = LENS.uniforms;

  function render(i) {
    idx = i; part = 0;
    const p = PROJECTS[i], d = DETAILS[p.id];
    style = d.style;
    root.dataset.style = style;
    track.innerHTML = slides(p, d, i).join('');
    els = [...track.querySelectorAll('.pz-slide')];
    dots.innerHTML = els.map((_, k) => `<button type="button" aria-label="Part ${k + 1}" data-k="${k}"></button>`).join('');
    els.forEach((e, k) => e.classList.toggle('is-on', k === 0));
    track.querySelector('.pz-next')?.addEventListener('click', (ev) => { ev.stopPropagation(); switchProject(+ev.currentTarget.dataset.next); });
    sync();
  }
  function sync() {
    [...dots.children].forEach((b, k) => b.classList.toggle('is-on', k === part));
    bar.style.transform = `scaleX(${(part + 1) / els.length})`;
    root.querySelectorAll('.pz-arrow')[0].disabled = part === 0;
    root.querySelectorAll('.pz-arrow')[1].disabled = part === els.length - 1;
  }
  function go(k) {
    if (busy || k === part || k < 0 || k >= els.length) return;
    busy = true;
    const from = els[part], to = els[k], dir = k > part ? 1 : -1;
    from.classList.remove('is-on'); from.classList.add('is-out'); from.style.setProperty('--dir', dir);
    to.style.setProperty('--dir', dir); to.classList.add('is-on', 'is-in');
    gsap.fromTo(L.uCA, { value: 0.008 }, { value: 0.0016, duration: 0.8, ease: 'power2.out' });
    sound && sound.ping(1.4 + k * 0.05);
    part = k; sync();
    const kicker = to.querySelector('.pz-kicker');
    kicker && scramble(kicker, kicker.dataset.text || kicker.textContent, 450);
    setTimeout(() => { from.classList.remove('is-out'); to.classList.remove('is-in'); busy = false; }, 850);
  }
  const SC = { v: 0 };
  const scanSet = () => root.style.setProperty('--scan', SC.v.toFixed(4));
  function show(i) {
    render(i);
    if (open) return;
    open = true;
    root.classList.add('is-open'); root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('pz-open');
    lenis.stop();
    archive && archive.focus(i);
    sound && sound.ping(1.3);
    SC.v = 0; gsap.to(SC, { v: 1, onUpdate: scanSet, duration: 1.0, ease: 'power3.inOut' });   // scanline wipe in
    gsap.fromTo(L.uCA, { value: 0.01 }, { value: 0.0016, duration: 1.2, ease: 'power2.out' });
    setTimeout(() => root.querySelector('.pz-panel').focus({ preventScroll: true }), 60);
  }
  function switchProject(i) {
    gsap.to(SC, { v: 0, onUpdate: scanSet, duration: 0.45, ease: 'power2.in', onComplete: () => { render(i); archive && archive.focus(i); gsap.to(SC, { v: 1, onUpdate: scanSet, duration: 0.7, ease: 'power3.out' }); } });
  }
  function hide() {
    if (!open) return;
    open = false;
    archive && archive.focus(-1);
    gsap.to(SC, { v: 0, onUpdate: scanSet, duration: 0.7, ease: 'power3.inOut', onComplete: () => { root.classList.remove('is-open'); root.setAttribute('aria-hidden', 'true'); document.body.classList.remove('pz-open'); } });
    lenis.start();
  }

  root.querySelector('.pz-close').addEventListener('click', hide);
  root.querySelector('.pz-veil').addEventListener('click', hide);
  root.querySelectorAll('.pz-arrow').forEach((b) => b.addEventListener('click', () => go(part + +b.dataset.dir)));
  dots.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) go(+b.dataset.k); });
  addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') hide();
    if (e.key === 'ArrowRight' || e.key === 'PageDown') go(part + 1);
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(part - 1);
  });
  root.addEventListener('wheel', (e) => {
    if (!open) return;
    e.preventDefault();
    const now = performance.now();
    if (now - wheelT < 900 || Math.abs(e.deltaY) < 12) return;
    wheelT = now; go(part + (e.deltaY > 0 ? 1 : -1));
  }, { passive: false });
  let tx = 0, ty = 0;
  root.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  root.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 50) go(part + ((Math.abs(dx) > Math.abs(dy) ? dx : dy) < 0 ? 1 : -1));
  }, { passive: true });

  return { show, hide, get open() { return open; } };
}
