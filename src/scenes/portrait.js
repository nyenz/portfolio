import * as THREE from 'three';
import { U } from '../world/env.js';
import { camYAt, smooth, isNarrow, damp } from './util.js';

// About: thousands of plankton specks drift in the dark, then gather into Nyende's stipple
// portrait. The cursor is a torch: specks part around it and the real photo shows through.
// Later a current sweeps the specks away sideways.
export function createPortrait({ count = 12000, renderer }) {
  const group = new THREE.Group();
  group.visible = false;
  const base = import.meta.env.BASE_URL;
  const W = 4.2, H = 3.36;
  const uniforms = {
    ...U,
    uForm: { value: 0 }, uCurrent: { value: 0 }, uPhoto: { value: null }, uReveal: { value: 0 },
    uCursorPx: { value: new THREE.Vector2(-1e4, -1e4) }, uRes: { value: new THREE.Vector2(1, 1) }, uDpr: { value: 1 }, uSize: { value: 1 },
  };

  // the real photo: shows only inside the torch circle
  const photoMat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uPhoto; uniform vec2 uCursorPx, uRes; uniform float uDpr, uForm, uCurrent, uReveal, uTime;
      varying vec2 vUv;
      void main(){
        vec2 px = gl_FragCoord.xy / uDpr; px.y = uRes.y - px.y;
        float d = length(px - uCursorPx);
        float r = 120. + 12. * sin(uTime * 2.);
        float m = smoothstep(r, r * 0.45, d) * uForm * (1. - uCurrent) * uReveal;
        vec3 c = texture2D(uPhoto, vUv).rgb;
        float edge = smoothstep(0., 0.06, vUv.x) * smoothstep(1., 0.94, vUv.x) * smoothstep(0., 0.06, vUv.y) * smoothstep(1., 0.94, vUv.y);
        // key out the bright studio backdrop so only the person shows, tinted by the water
        float lum = dot(c, vec3(.299, .587, .114));
        float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
        float bg = smoothstep(0.62, 0.86, lum) * (1. - smoothstep(0.08, 0.2, sat));
        c = mix(c, c * vec3(.75, .95, 1.05), 0.35) * 0.92;
        gl_FragColor = vec4(c, m * edge * 0.95 * (1. - bg));
      }`,
  });
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(W, H), photoMat);
  photo.position.z = -0.05;
  group.add(photo);
  new THREE.TextureLoader().load(base + 'img/portrait-photo.webp', (t) => { t.colorSpace = THREE.SRGBColorSpace; uniforms.uPhoto.value = t; });

  let points = null;
  const img = new Image();
  img.onload = () => {
    const cw = 300, ch = Math.round(300 * img.height / img.width);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, cw, ch);
    const data = g.getImageData(0, 0, cw, ch).data;
    const pos = [], start = [], rnd = [];
    let tries = 0;
    while (pos.length / 3 < count && tries < count * 30) {
      tries++;
      const x = Math.random() * cw, y = Math.random() * ch;
      const i = ((y | 0) * cw + (x | 0)) * 4;
      const dark = 1 - (data[i] + data[i + 1] + data[i + 2]) / 765;
      if (Math.random() > Math.pow(dark, 1.4) * 1.15) continue;     // denser where the drawing is darker
      pos.push((x / cw - 0.5) * W, (0.5 - y / ch) * H, (Math.random() - 0.5) * 0.12);
      const a = Math.random() * 6.283, r = 3 + Math.random() * 6;
      start.push(Math.cos(a) * r, (Math.random() - 0.5) * 7, Math.sin(a) * r * 0.6 - 1.5);
      rnd.push(Math.random(), Math.random(), dark, Math.random());
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aStart', new THREE.Float32BufferAttribute(start, 3));
    geo.setAttribute('aRand', new THREE.Float32BufferAttribute(rnd, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
    const mat = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute vec3 aStart; attribute vec4 aRand;
        uniform float uForm, uCurrent, uTime, uPx, uSize, uTorch;
        uniform vec2 uCursorPx, uRes;
        varying float vA, vGlow, vDark;
        void main(){
          float t = uTime;
          // each speck arrives in its own time, drifting like plankton
          float st = aRand.x * 0.45;
          float f = smoothstep(st, st + 0.55, uForm);
          f = f * f * (3. - 2. * f);
          vec3 drift = vec3(sin(t * 0.4 + aRand.y * 30.), cos(t * 0.35 + aRand.w * 20.), sin(t * 0.3 + aRand.x * 10.)) * (0.25 * (1. - f) + 0.012);
          vec3 p = mix(aStart, position, f) + drift;
          // the current: specks are pulled sideways in streaks
          float cu = smoothstep(aRand.w * 0.4, aRand.w * 0.4 + 0.6, uCurrent);
          p.x += cu * cu * (6. + aRand.y * 6.);
          p.y += cu * sin(aRand.x * 6.28 + t) * 0.4;
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          vec4 cp = projectionMatrix * mv;
          // part around the cursor on screen
          vec2 sp = (cp.xy / cp.w * 0.5 + 0.5) * uRes; sp.y = uRes.y - sp.y;
          vec2 dv = sp - uCursorPx; float d = length(dv);
          float push = smoothstep(150., 20., d) * f * (1. - cu);
          mv.xy += normalize(vec2(dv.x, -dv.y) + 1e-3) * push * 0.22;
          vGlow = smoothstep(220., 60., d) * f;
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (0.012 + aRand.z * 0.022) * uSize * uPx / -mv.z;
          vA = (0.25 + 0.75 * f) * (1. - cu * 0.9) * (0.5 + 0.5 * aRand.z);
          vDark = aRand.z;
        }`,
      fragmentShader: /* glsl */`
        varying float vA, vGlow, vDark;
        void main(){
          vec2 c = gl_PointCoord - 0.5; float r = length(c); if (r > 0.5) discard;
          float a = smoothstep(0.5, 0.05, r);
          vec3 col = mix(vec3(0.55, 0.9, 0.95), vec3(0.9, 1., 1.), vDark);
          col += vec3(0.4, 0.9, 1.) * vGlow * 0.6;
          float al = a * vA;
          gl_FragColor = vec4(col * al, al);
        }`,
    });
    points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    group.add(points);
  };
  img.src = base + 'img/portrait-stipple.webp';

  const size = new THREE.Vector2();
  return {
    group,
    update(dt, s) {
      const l = s.x - 1;                       // progress through the About zone
      const on = s.x > 0.8 && s.x < 2.05;
      group.visible = on;
      if (!on) return;
      const narrow = isNarrow();
      uniforms.uForm.value = smooth(-0.12, 0.32, l);
      uniforms.uCurrent.value = smooth(0.58, 0.95, l);
      uniforms.uReveal.value += ((s.input.active ? 1 : 0) - uniforms.uReveal.value) * damp(dt, 3);
      renderer.getSize(size);
      uniforms.uRes.value.copy(size);
      uniforms.uDpr.value = renderer.getPixelRatio();
      uniforms.uSize.value = narrow ? 0.8 : 1;
      uniforms.uCursorPx.value.set(s.input.px, s.input.py);
      // framed beside the text (desktop) or above it (phone); floats gently
      const camY = s.camera.position.y;
      const ty = camY + (narrow ? 1.35 : 0.05) + Math.sin(s.time * 0.5) * 0.06 + (l - 0.3) * 0.6;
      group.position.set(s.camera.position.x + (narrow ? 0 : 1.9), ty, narrow ? -7.2 : -6);
      group.rotation.y = -s.input.sx * 0.12 + (narrow ? 0 : -0.18);
      group.rotation.x = s.input.sy * 0.06;
      group.scale.setScalar(narrow ? 0.85 : 1);
      void camYAt;
    },
  };
}
