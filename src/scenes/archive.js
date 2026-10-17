import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { U } from '../world/env.js';
import { PROJECTS } from '../config/content.js';
import { MODELS } from './tankModels.js';
import { smooth, isNarrow, damp, labelLayer, toScreen, clamp } from './util.js';
import { input, wasDrag } from '../core/input.js';

// The Archive: eight glass specimen tanks floating in the dark (glass-cubes-green material:
// thin horizontal cut lines, crosshair etched into every face, green rim light). Each holds
// a living model of one project. Scroll slides the row; hover lifts and turns a tank; click
// opens that project's presentation.
const GLASS_VS = /* glsl */`
  varying vec3 vN, vW, vL;
  void main(){ vL = position; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const GLASS_FS = /* glsl */`
  uniform vec3 uCamPos, uCursorDir; uniform float uTime, uHot, uFocus, uTorch, uFogD; uniform vec3 uHalf, uFog;
  varying vec3 vN, vW, vL;
  void main(){
    vec3 N = normalize(vN), V = normalize(uCamPos - vW);
    float ndv = abs(dot(N, V));
    float fr = pow(1. - ndv, 3.);
    // face coordinates for the etched crosshair
    vec3 an = abs(normalize(vL / uHalf));
    vec2 f = an.x > an.y && an.x > an.z ? vL.yz / uHalf.yz : (an.y > an.z ? vL.xz / uHalf.xz : vL.xy / uHalf.xy);
    float cross = smoothstep(0.012, 0.0, abs(f.x)) * step(abs(f.y), 0.72) + smoothstep(0.012, 0.0, abs(f.y)) * step(abs(f.x), 0.72);
    float ticks = smoothstep(0.012, 0.0, abs(abs(f.x) - 0.82)) * step(0.7, abs(f.y)) + smoothstep(0.012, 0.0, abs(abs(f.y) - 0.82)) * step(0.7, abs(f.x));
    // thin horizontal cut lines across the glass
    float cut = step(0.9, fract(vL.y * 34.)) * (0.5 + 0.5 * fr);
    float sheen = pow(max(dot(reflect(-V, N), normalize(vec3(0.3, 1., 0.5))), 0.), 40.);
    vec3 green = vec3(0.42, 1., 0.68);
    float spot = pow(max(dot(normalize(vW - uCamPos), uCursorDir), 0.), 60.) * uTorch;
    vec3 c = green * (fr * 1.4 + cross * 0.55 + ticks * 0.4 + cut * 0.22) * (0.6 + uHot * 0.8 + uFocus * 0.5) + vec3(1.) * sheen * 1.2 + green * spot * 0.6;
    c += vec3(0.04, 0.18, 0.14) * 0.25;
    float a = clamp(0.07 + fr * 0.6 + cross * 0.45 + cut * 0.2 + sheen + ticks * 0.3, 0., 0.95);
    float fog = exp(-length(uCamPos - vW) * uFogD * 0.6);
    gl_FragColor = vec4(c * fog, a * fog);
  }`;

export function createArchive({ onOpen }) {
  const group = new THREE.Group();
  group.visible = false;
  const row = new THREE.Group();
  group.add(row);
  const SP = 3.1;
  const size = new THREE.Vector3(1.55, 1.85, 1.55);
  const tankGeo = new RoundedBoxGeometry(size.x, size.y, size.z, 4, 0.14);
  const key = new THREE.PointLight(0xbffff0, 6, 7, 1.4);
  key.position.set(0, 1.6, 1.4);
  group.add(key);
  const fill = new THREE.PointLight(0x7f9cff, 2.5, 7, 1.6); fill.position.set(-1.5, -1, 1.5); group.add(fill);

  const label = document.createElement('div');
  label.className = 'tank-label';
  labelLayer().appendChild(label);

  const tanks = PROJECTS.map((p, i) => {
    const holder = new THREE.Group();
    holder.position.x = i * SP;
    const uni = { ...U, uHot: { value: 0 }, uFocus: { value: 0 }, uHalf: { value: size.clone().multiplyScalar(0.5) } };
    const glass = new THREE.Mesh(tankGeo, new THREE.ShaderMaterial({ uniforms: uni, vertexShader: GLASS_VS, fragmentShader: GLASS_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    glass.renderOrder = 10;
    const model = MODELS[p.id]();
    model.obj.scale.setScalar(1.05);
    // pedestal ring of light below the tank (Igloo-style)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.82, 64), new THREE.MeshBasicMaterial({ color: 0x7affc0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = -size.y / 2 - 0.25;
    const halo = new THREE.Mesh(new THREE.CircleGeometry(0.8, 48), new THREE.MeshBasicMaterial({ color: 0x2bd18a, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = ring.position.y - 0.01;
    holder.add(model.obj, glass, ring, halo);
    row.add(holder);
    return { p, i, holder, glass, uni, model, ring, hot: 0, spin: 0, spinV: 0, lift: 0 };
  });

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), scr = {};
  let hovered = -1, focus = -1, centerF = 0, lastLabel = -2, openK = 0;
  const glassMeshes = tanks.map((t) => t.glass);

  let cam = null;
  addEventListener('click', (e) => {
    if (!group.visible || !cam || wasDrag()) return;
    if (e.target.closest && e.target.closest('a,button,#dossier,#presentation,.meter,.hud-top')) return;
    // raycast at the click point itself (works for taps on phones too)
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const h = ray.intersectObjects(glassMeshes, false)[0];
    const i = h ? glassMeshes.indexOf(h.object) : -1;
    if (i >= 0 && onOpen) onOpen(i);
  });

  return {
    group,
    tanks,
    focus(i) { focus = i; },
    get hovered() { return hovered; },
    update(dt, s) {
      const l = s.x - 3;
      const on = s.x > 2.75 && s.x < 4.25;
      group.visible = on;
      label.style.opacity = '0';
      if (!on) { hovered = -1; document.body.classList.remove('tank-hover'); return; }
      cam = s.camera;
      const narrow = isNarrow();
      // which tank is centred: follows the scroll, or the open presentation
      const target = focus >= 0 ? focus : clamp((l - 0.05) / 0.82) * (tanks.length - 1);
      centerF += (target - centerF) * damp(dt, focus >= 0 ? 4 : 6);
      // while a presentation is open the tank slides aside to make room for the panel
      openK += ((focus >= 0 ? 1 : 0) - openK) * damp(dt, 3);
      group.position.set(s.camera.position.x + (narrow ? 0 : 0.6 + openK * 2.3), s.camera.position.y + (narrow ? 0.5 + openK * 1.6 : -0.15), narrow ? -7.6 - openK * 1.5 : -6.6);
      row.position.x = -centerF * SP;
      key.position.x = 0; fill.position.x = -1.5;

      // hover by raycast
      ndc.set(input.sx, input.sy);
      ray.setFromCamera(ndc, s.camera);
      const hit = input.active ? ray.intersectObjects(glassMeshes, false)[0] : null;
      hovered = hit ? glassMeshes.indexOf(hit.object) : -1;
      document.body.classList.toggle('tank-hover', hovered >= 0);

      for (const t of tanks) {
        const dc = Math.abs(t.i - centerF);
        const want = t.i === hovered ? 1 : 0;
        t.hot += (want - t.hot) * damp(dt, 6);
        t.uni.uHot.value = t.hot;
        t.uni.uFocus.value = Math.max(0, 1 - dc) * (focus === t.i ? 1.5 : 1);
        // spin: slow idle turn, follows the cursor when hovered, a flick when the cursor moves fast
        t.spinV += ((t.hot > 0.3 ? input.sx * 1.4 : 0.25) - t.spinV) * damp(dt, 2);
        t.spin += t.spinV * dt;
        t.holder.rotation.y = t.spin;
        t.holder.rotation.x = Math.sin(s.time * 0.4 + t.i) * 0.04 + t.hot * input.sy * -0.2;
        const lift = t.hot * 0.18 + (focus === t.i ? 0.2 : 0);
        t.lift += (lift - t.lift) * damp(dt, 5);
        const sc = (1 - Math.min(dc, 2) * 0.12) * (1 + t.hot * 0.05) * (focus === t.i ? 1.18 : 1);
        t.holder.scale.setScalar(sc);
        t.holder.position.y = Math.sin(s.time * 0.6 + t.i * 1.3) * 0.08 + t.lift;
        t.holder.position.z = -Math.min(dc, 3) * 0.6 + (focus === t.i ? 1.2 : 0);
        t.ring.material.opacity = 0.18 + 0.4 * Math.max(0, 1 - dc) + t.hot * 0.3;
        if (dc < 2.5) t.model.update(s.time + t.i * 3, dt, t.hot);
      }

      // label under the centred tank
      const ci = Math.round(centerF), ct = tanks[ci];
      const near = 1 - Math.min(Math.abs(ci - centerF) * 2.5, 1);
      const vis = near * smooth(-0.05, 0.08, l) * (1 - smooth(0.9, 1.0, l)) * (focus >= 0 ? 0 : 1);
      if (vis > 0.01) {
        if (ci !== lastLabel) {
          lastLabel = ci;
          label.innerHTML = `<p class="tank-label__num">${String(ci + 1).padStart(2, '0')} / 08 · ${ct.p.kind}</p><h3 class="tank-label__name">${ct.p.name}</h3><p class="tank-label__line">${ct.p.line}</p><p class="tank-label__cta">${input.active ? 'Click the tank to open' : 'Tap the tank to open'} →</p>`;
        }
        const wp = new THREE.Vector3(0, -size.y / 2 - 0.45, 0).applyMatrix4(ct.holder.matrixWorld);
        toScreen(wp, s.camera, scr);
        label.style.opacity = vis.toFixed(3);
        label.style.transform = `translate3d(${scr.x.toFixed(1)}px, ${scr.y.toFixed(1)}px, 0) translateX(-50%)`;
      }
    },
  };
}
