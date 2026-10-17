import * as THREE from 'three';
import { WORLD, ZONES } from '../config/zones.js';

// Shared helpers for the scenes along the dive.
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (dt, r) => 1 - Math.exp(-dt * r);

/** camera height (world y) at a zone float x (0..6) */
export const camYAt = (x) => WORLD.startY - (x / ZONES.length) * WORLD.travel;

/** narrow (phone portrait) layout? */
export const isNarrow = () => innerWidth / innerHeight < 0.8;

// one HTML layer above the canvas for labels that follow 3D objects
let layer = null;
export function labelLayer() {
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'labels';
    document.body.appendChild(layer);
  }
  return layer;
}

const _v = new THREE.Vector3();
/** world position -> screen pixels; returns { x, y, behind } */
export function toScreen(pos, camera, out = {}) {
  _v.copy(pos).project(camera);
  out.x = (_v.x * 0.5 + 0.5) * innerWidth;
  out.y = (-_v.y * 0.5 + 0.5) * innerHeight;
  out.behind = _v.z > 1;
  return out;
}

/** text on a canvas -> texture (used for labels inside 3D objects) */
export function textTexture(text, { w = 512, h = 256, size = 64, color = '#e6fbfb', font = '600 {s}px Syne, system-ui, sans-serif', sub = '' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  let s = size;
  g.font = font.replace('{s}', s);
  while (g.measureText(text).width > w * 0.86 && s > 18) { s -= 2; g.font = font.replace('{s}', s); }
  g.fillText(text, w / 2, sub ? h * 0.44 : h / 2);
  if (sub) { g.font = `500 ${Math.round(s * 0.42)}px "JetBrains Mono", monospace`; g.globalAlpha = 0.7; g.fillText(sub, w / 2, h * 0.72); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
