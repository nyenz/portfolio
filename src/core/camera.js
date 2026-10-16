import * as THREE from 'three';
import { WORLD, ZONES } from '../config/zones.js';
import { input } from './input.js';
import { scroll } from './scroll.js';

// The diver's eye: sinks with the scroll, always floats a little, turns with the pointer,
// looks around on drag (springing back), and tilts with the phone.
export function createCameraRig(reduced) {
  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.05, 200);
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const ndc = new THREE.Vector3();
  const dir = new THREE.Vector3(0, 0, -1);
  let fovKick = 0, velPitch = 0;
  const amp = reduced ? 0.3 : 1;
  const intro = { value: 1 };   // 0 -> 1 while arriving from the DNA dive (wide, rushing in)

  // per-zone resting pitch: look up at the light near the surface, down at the floor at the end
  const restPitch = (x) => {
    const pts = [0.2, 0.06, 0.0, -0.02, -0.04, -0.12, -0.42];
    const i = Math.min(Math.floor(x), ZONES.length - 1), f = x - i;
    const a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)];
    const s = f * f * (3 - 2 * f);
    return a + (b - a) * s;
  };

  function update(time, dt) {
    const t = time;
    const y = WORLD.startY - scroll.t * WORLD.travel;
    // floating drift (layered sines, never repeats visibly)
    const fx = (Math.sin(t * 0.21) * 0.6 + Math.sin(t * 0.53 + 1.3) * 0.4) * 0.09 * amp;
    const fy = (Math.sin(t * 0.17 + 2.1) * 0.6 + Math.sin(t * 0.41) * 0.4) * 0.07 * amp;
    camera.position.set(fx, y + fy, 0);

    velPitch += ((-scroll.velocity * 0.0016) - velPitch) * (1 - Math.exp(-dt * 3));
    velPitch = Math.max(-0.12, Math.min(0.12, velPitch));
    euler.y = -input.sx * 0.2 * amp + input.dragX - input.tiltX * 0.25 * amp + Math.sin(t * 0.07) * 0.03 * amp;
    euler.x = restPitch(scroll.x) + input.sy * 0.12 * amp + input.dragY + input.tiltY * 0.12 * amp + velPitch + Math.sin(t * 0.11 + 0.7) * 0.015 * amp;
    euler.z = Math.sin(t * 0.13) * 0.012 * amp - input.sx * 0.015 * amp;
    camera.quaternion.setFromEuler(euler);

    fovKick += (Math.min(Math.abs(scroll.velocity) * 0.12, 6) - fovKick) * (1 - Math.exp(-dt * 2.5));
    const baseFov = innerWidth / innerHeight < 0.8 ? 62 : 48;
    const ik = 1 - intro.value;
    camera.fov = baseFov + fovKick * amp + ik * 34;
    camera.position.y += ik * 2.5;
    camera.updateProjectionMatrix();

    // the cursor ray (torch direction) in world space
    ndc.set(input.sx, input.sy, 0.5).unproject(camera);
    dir.copy(ndc).sub(camera.position).normalize();
    return dir;
  }

  function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
  return { camera, update, resize, cursorDir: dir, intro };
}
