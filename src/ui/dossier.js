import gsap from 'gsap';
import { PROFILE, CONTACT, EXPERIENCE, PROJECTS, SKILLS, TOOLS, SERVICES } from '../config/content.js';
import { LENS } from '../fx/post.js';
import { scramble } from './scramble.js';

// The Dossier: every fact about Nyende on one frosted-glass sheet that grows over the dive
// from any scene (button, or the I key). The ocean keeps moving, blurred, behind it.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function markup(imgBase) {
  const contactRows = [
    `<div class="dz-contact__row"><span class="dz-k">Email</span><span class="dz-v" id="dz-email">${esc(CONTACT.email)}</span><button class="dz-copy" type="button" data-copy="${esc(CONTACT.email)}">Copy</button></div>`,
    `<div class="dz-contact__row"><span class="dz-k">Phone</span><span class="dz-v">${esc(CONTACT.phone)}</span><button class="dz-copy" type="button" data-copy="${esc(CONTACT.phone)}">Copy</button></div>`,
    `<div class="dz-contact__row"><span class="dz-k">GitHub</span><a class="dz-v dz-link" href="${CONTACT.github}" target="_blank" rel="noopener">github.com/nyenz ↗</a></div>`,
    CONTACT.linkedin ? `<div class="dz-contact__row"><span class="dz-k">LinkedIn</span><a class="dz-v dz-link" href="${CONTACT.linkedin}" target="_blank" rel="noopener">Profile ↗</a></div>` : '',
    CONTACT.x ? `<div class="dz-contact__row"><span class="dz-k">X</span><a class="dz-v dz-link" href="${CONTACT.x}" target="_blank" rel="noopener">Profile ↗</a></div>` : '',
    `<div class="dz-contact__row"><span class="dz-k">Based in</span><span class="dz-v">${esc(PROFILE.location)}</span></div>`,
  ].join('');
  return `
  <div class="dz-frost" aria-hidden="true"></div>
  <div class="dz-sheet" role="dialog" aria-modal="true" aria-labelledby="dz-title" tabindex="-1">
    <button class="dz-close" type="button" aria-label="Close the Dossier" data-cursor="CLOSE">
      <span></span><span></span><em>ESC</em>
    </button>
    <div class="dz-grid" data-lenis-prevent>
      <aside class="dz-side">
        <figure class="dz-portrait" data-tilt>
          <img src="${imgBase}img/portrait-stipple.webp" alt="Stipple portrait of Nyende David" width="700" height="560" loading="lazy" />
          <img class="dz-portrait__photo" src="${imgBase}img/portrait-photo.webp" alt="" width="700" height="560" loading="lazy" />
        </figure>
        <p class="dz-eyebrow"><span class="dz-dot"></span>${esc(PROFILE.available)}</p>
        <h2 class="dz-name" id="dz-title">${esc(PROFILE.name)}</h2>
        <p class="dz-role">${esc(PROFILE.role)}</p>
        <dl class="dz-stats">${PROFILE.stats.map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('')}</dl>
        <div class="dz-actions">
          <a class="dz-btn dz-btn--main" href="mailto:${CONTACT.email}">Email me</a>
          ${CONTACT.cv ? `<a class="dz-btn" href="${imgBase}${CONTACT.cv}" target="_blank" rel="noopener">Download CV</a>` : `<span class="dz-btn dz-btn--muted" title="Add your CV file to show this button">CV coming soon</span>`}
        </div>
      </aside>
      <div class="dz-main">
        <section class="dz-sec" aria-labelledby="dz-about">
          <h3 class="dz-h" id="dz-about"><span>01</span><b>About</b></h3>
          <p class="dz-lead">${esc(PROFILE.summary)}</p>
          ${PROFILE.about.map((p) => `<p class="dz-p">${esc(p)}</p>`).join('')}
        </section>
        <section class="dz-sec" aria-labelledby="dz-work">
          <h3 class="dz-h" id="dz-work"><span>02</span><b>Projects</b></h3>
          <div class="dz-cards">
            ${PROJECTS.map((p) => `
            <article class="dz-card" data-tilt>
              <p class="dz-card__kind">${esc(p.kind)} · ${esc(p.year)}</p>
              <h4 class="dz-card__name">${esc(p.name)}</h4>
              <p class="dz-card__line">${esc(p.line)}</p>
              <p class="dz-card__result">${esc(p.result)}</p>
              <ul class="dz-tags">${p.tech.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
              <div class="dz-card__links">${p.links.length ? p.links.map((l) => `<a href="${l.href}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('') : '<span>Presentation coming in Phase 8</span>'}</div>
            </article>`).join('')}
          </div>
        </section>
        <section class="dz-sec" aria-labelledby="dz-exp">
          <h3 class="dz-h" id="dz-exp"><span>03</span><b>Experience &amp; education</b></h3>
          <ol class="dz-timeline">
            ${EXPERIENCE.map((e) => `<li><p class="dz-when">${esc(e.when)}</p><div><h4>${esc(e.title)}</h4><p class="dz-org">${esc(e.org)}</p><p class="dz-p">${esc(e.text)}</p></div></li>`).join('')}
          </ol>
        </section>
        <section class="dz-sec" aria-labelledby="dz-skills">
          <h3 class="dz-h" id="dz-skills"><span>04</span><b>Skills &amp; tools</b></h3>
          <div class="dz-skillgrid">
            ${SKILLS.map((g) => `<div><h4 class="dz-sub">${esc(g.group)}</h4><ul class="dz-tags dz-tags--lg">${g.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`).join('')}
          </div>
          <h4 class="dz-sub">Tools I use every day</h4>
          <ul class="dz-tags">${TOOLS.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        </section>
        <section class="dz-sec" aria-labelledby="dz-help">
          <h3 class="dz-h" id="dz-help"><span>05</span><b>What I can help with</b></h3>
          <ul class="dz-services">${SERVICES.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
        </section>
        <section class="dz-sec" aria-labelledby="dz-contact">
          <h3 class="dz-h" id="dz-contact"><span>06</span><b>Contact</b></h3>
          <div class="dz-contact">${contactRows}</div>
        </section>
        <p class="dz-foot">You can keep diving any time. Close this with Esc, the × button or the I key.</p>
      </div>
    </div>
  </div>`;
}

export function createDossier({ lenis, sound }) {
  const root = document.createElement('div');
  root.id = 'dossier';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = markup(import.meta.env.BASE_URL);
  document.body.appendChild(root);
  const sheet = root.querySelector('.dz-sheet');
  const frost = root.querySelector('.dz-frost');
  const btn = document.querySelector('.dossier-btn');
  let open = false, lastFocus = null, tl = null;
  const L = LENS.uniforms;

  function show(x = innerWidth - 60, y = 40) {
    if (open) return;
    open = true; lastFocus = document.activeElement;
    root.style.setProperty('--fx', `${x}px`); root.style.setProperty('--fy', `${y}px`);
    root.classList.add('is-open'); root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('dossier-open');
    btn && btn.setAttribute('aria-expanded', 'true');
    lenis.stop();
    sound && sound.ping(1.25);
    tl && tl.kill();
    tl = gsap.timeline();
    tl.fromTo(root, { '--r': 0 }, { '--r': 150, duration: 1.1, ease: 'power3.inOut' }, 0)   // frost grows from the button
      .to(L.uCA, { value: 0.006, duration: 0.6, ease: 'sine.out' }, 0)
      .to(L.uCA, { value: 0.0016, duration: 0.9, ease: 'sine.inOut' }, 0.6)
      .fromTo(sheet, { opacity: 0, y: 30, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'power3.out' }, 0.35)
      .fromTo(root.querySelectorAll('.dz-side > *, .dz-sec'), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.05, ease: 'power3.out' }, 0.45)
      .add(() => { root.querySelectorAll('.dz-h b').forEach((b, i) => setTimeout(() => scramble(b, b.dataset.text || b.textContent, 520), i * 70)); }, 0.5);
    setTimeout(() => sheet.focus({ preventScroll: true }), 50);
  }
  function hide() {
    if (!open) return;
    open = false;
    btn && btn.setAttribute('aria-expanded', 'false');
    tl && tl.kill();
    tl = gsap.timeline({ onComplete: () => { root.classList.remove('is-open'); root.setAttribute('aria-hidden', 'true'); document.body.classList.remove('dossier-open'); } });
    tl.to(sheet, { opacity: 0, y: 20, filter: 'blur(8px)', duration: 0.45, ease: 'power2.in' }, 0)
      .to(root, { '--r': 0, duration: 0.8, ease: 'power3.inOut' }, 0.1);
    lenis.start();
    lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
  }
  const toggle = (e) => (open ? hide() : show(e && e.clientX, e && e.clientY));

  btn && btn.addEventListener('click', (e) => { const r = btn.getBoundingClientRect(); toggle({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }); });
  root.querySelector('.dz-close').addEventListener('click', hide);
  document.querySelectorAll('[data-open-dossier]').forEach((b) => b.addEventListener('click', (e) => show(e.clientX, e.clientY)));
  frost.addEventListener('click', hide);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) hide();
    if ((e.key === 'i' || e.key === 'I') && !e.metaKey && !e.ctrlKey && !/input|textarea/i.test(document.activeElement?.tagName || '')) toggle();
    if (e.key === 'Tab' && open) { // keep focus inside the sheet
      const f = [...sheet.querySelectorAll('a[href],button:not([disabled])')];
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  // copy buttons (with a selectable fallback)
  root.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const text = b.dataset.copy;
    try { await navigator.clipboard.writeText(text); scramble(b, 'Copied', 300); }
    catch { const r = document.createRange(); r.selectNodeContents(b.previousElementSibling); const s = getSelection(); s.removeAllRanges(); s.addRange(r); scramble(b, 'Selected', 300); }
    setTimeout(() => scramble(b, 'Copy', 300), 1800);
  }));

  // cards and portrait tilt toward the cursor, with a moving light spot
  const tilts = [...root.querySelectorAll('[data-tilt]')];
  root.addEventListener('pointermove', (e) => {
    tilts.forEach((el) => {
      const r = el.getBoundingClientRect();
      const inside = e.clientX > r.left - 40 && e.clientX < r.right + 40 && e.clientY > r.top - 40 && e.clientY < r.bottom + 40;
      const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--mx', `${(nx + 0.5) * 100}%`); el.style.setProperty('--my', `${(ny + 0.5) * 100}%`);
      el.style.transform = inside ? `perspective(800px) rotateY(${(nx * 7).toFixed(2)}deg) rotateX(${(-ny * 7).toFixed(2)}deg) translateZ(0)` : '';
      el.classList.toggle('is-lit', inside);
    });
  });

  return { show, hide, get open() { return open; } };
}
