// Pointer, drag-to-look, phone tilt and idle time — shared by every scene.
export const input = {
  x: 0, y: 0,            // pointer in NDC (-1..1), raw
  sx: 0, sy: 0,          // smoothed
  px: innerWidth / 2, py: innerHeight / 2, // pixels
  speed: 0,              // smoothed pointer speed (NDC/s)
  dragging: false,
  dragX: 0, dragY: 0,    // accumulated drag look (radians-ish), springs back to 0 on release
  dragVX: 0, dragVY: 0,
  tiltX: 0, tiltY: 0,    // phone tilt (-1..1)
  idle: 0,               // seconds since the last pointer movement
  active: false,         // pointer has moved at least once
  down: false,
};

let lastX = 0, lastY = 0, lastT = performance.now();
let dragStartX = 0, dragStartY = 0, dragMoved = false;

function setPos(cx, cy) {
  const now = performance.now();
  const nx = (cx / innerWidth) * 2 - 1;
  const ny = -(cy / innerHeight) * 2 + 1;
  const dt = Math.max((now - lastT) / 1000, 1 / 240);
  const v = Math.hypot(nx - lastX, ny - lastY) / dt;
  input.speed = Math.max(input.speed, Math.min(v, 12));
  lastX = nx; lastY = ny; lastT = now;
  input.x = nx; input.y = ny; input.px = cx; input.py = cy;
  input.idle = 0; input.active = true;
}

const isUi = (el) => !!(el && el.closest && el.closest('a,button,input,textarea,[data-no-drag]'));

export function initInput() {
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' && !input.dragging) { input.idle = 0; return; }
    setPos(e.clientX, e.clientY);
    if (input.dragging) {
      const dx = (e.clientX - dragStartX) / innerWidth;
      const dy = (e.clientY - dragStartY) / innerHeight;
      if (Math.abs(dx) + Math.abs(dy) > 0.004) dragMoved = true;
      input.dragX = Math.max(-1.25, Math.min(1.25, input.dragX0 - dx * 3.2));
      input.dragY = Math.max(-0.6, Math.min(0.6, input.dragY0 + dy * 1.8));
    }
  }, { passive: true });

  addEventListener('pointerdown', (e) => {
    input.down = true;
    // Mouse drag looks around. Touch keeps native scrolling (tilt does the looking on phones).
    if (e.pointerType === 'mouse' && e.button === 0 && !isUi(e.target)) {
      input.dragging = true; dragMoved = false;
      dragStartX = e.clientX; dragStartY = e.clientY;
      input.dragX0 = input.dragX; input.dragY0 = input.dragY;
      document.body.classList.add('is-dragging');
    }
  });
  const end = () => {
    input.down = false;
    if (input.dragging) { input.dragging = false; document.body.classList.remove('is-dragging'); }
  };
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
  addEventListener('blur', end);

  // Phone tilt (Android gives it freely; iOS asks once on first tap).
  const onTilt = (e) => {
    if (e.gamma == null) return;
    input.tiltX = Math.max(-1, Math.min(1, e.gamma / 30));
    input.tiltY = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
  };
  if (window.DeviceOrientationEvent) {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      addEventListener('touchend', function ask() {
        DeviceOrientationEvent.requestPermission().then((r) => { if (r === 'granted') addEventListener('deviceorientation', onTilt); }).catch(() => {});
        removeEventListener('touchend', ask);
      }, { once: true });
    } else addEventListener('deviceorientation', onTilt);
  }
}

export const wasDrag = () => dragMoved;

/** per-frame smoothing + spring-back of the drag look */
export function updateInput(dt, reduced) {
  const k = 1 - Math.exp(-dt * (reduced ? 3 : 6));
  input.sx += (input.x - input.sx) * k;
  input.sy += (input.y - input.sy) * k;
  input.speed *= Math.exp(-dt * 4);
  input.idle += dt;
  if (!input.dragging) {
    // critically-damped spring back to the scene's framing
    const w = 5.5;
    input.dragVX += (-w * w * input.dragX - 2 * w * input.dragVX) * dt;
    input.dragVY += (-w * w * input.dragY - 2 * w * input.dragVY) * dt;
    input.dragX += input.dragVX * dt;
    input.dragY += input.dragVY * dt;
  } else { input.dragVX = 0; input.dragVY = 0; }
}
