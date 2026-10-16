# Notes for working on this repo

Nyende David's portfolio: "The Descent", a one-page scroll dive built with Three.js (no framework).
The full plan (scenes, transitions, asset fixes, build order) lives in the Claude doc "The Descent — Portfolio Plan".

- Stack: Vite + vanilla JS, `three` 0.178 (WebGL2), `lenis` smooth scroll, `gsap` for tweens. Versions pinned exactly.
- Deploy: push to `main` -> `.github/workflows/deploy.yml` builds and publishes to GitHub Pages
  (https://nyenz.github.io/portfolio/). `vite.config.js` sets `base: '/portfolio/'`.
- Layout: `src/config/zones.js` (zones, depth ranges, environment keyframes), `src/core/*` (quality tiers,
  input, scroll, camera rig), `src/world/*` (water, surface, light shafts, marine snow, bubbles, floor),
  `src/fx/*` (post stack + transitions), `src/ui/*` (HUD, cursor, loader, sound, text scramble).
- Every ocean shader reads the shared uniforms in `src/world/env.js` (`U`); add new depth-driven values there.
- Living-scene rules: nothing is ever still, every scene supports look-around (pointer + drag + phone tilt),
  everything reacts to the cursor. Check the per-scene detail list before calling a scene done.
- Testing: `npm run build && npx vite preview`, then `?skipintro` skips the loader, `?q=low|med|high` forces a tier.
  `window.__dive` exposes scroll/input/uniforms for scripted screenshots.
- Keep user-facing text in simple English. Sound stays off until the visitor turns it on.
