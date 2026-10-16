import gsap from 'gsap';
import { LENS } from './post.js';
import { scrollToProgress, scroll } from '../core/scroll.js';

// Transition library. Phase 1 ships the shared machinery + the two the foundation needs:
// the eyes-adjust opening and the sonar-ring jump used by the depth meter.
const L = LENS.uniforms;

export function eyesOpen({ reduced }) {
  return new Promise((resolve) => {
    if (reduced) { L.uLid.value = 1; L.uExpo.value = 0; return resolve(); }
    const tl = gsap.timeline({ onComplete: resolve });
    L.uExpo.value = 0.5;
    tl.to(L.uLid, { value: 0.4, duration: 0.8, ease: 'power2.out' })
      .to(L.uLid, { value: 0.18, duration: 0.28, ease: 'sine.inOut' })           // a blink
      .to(L.uLid, { value: 1, duration: 1.3, ease: 'power3.out' })
      .to(L.uExpo, { value: 0, duration: 2.2, ease: 'power2.out' }, 0.4)
      .fromTo(L.uCA, { value: 0.012 }, { value: 0.0016, duration: 2.2, ease: 'power2.out' }, 0);
  });
}

let jumping = false;
export function sonarJump(target, cx = innerWidth / 2, cy = innerHeight / 2, { reduced, sound } = {}) {
  if (jumping) return;
  const dist = Math.abs(target - scroll.t);
  if (dist < 0.002) return;
  jumping = true;
  sound && sound.ping(target > scroll.t ? 0.9 : 1.1);
  if (reduced) {
    gsap.to(L.uDark, { value: 1, duration: 0.35, onComplete: () => {
      scrollToProgress(target, { immediate: true });
      gsap.to(L.uDark, { value: 0, duration: 0.5, onComplete: () => (jumping = false) });
    } });
    return;
  }
  L.uRingC.value.set(cx / innerWidth, 1 - cy / innerHeight);
  const duration = 1.6 + Math.min(dist * 3, 1.6);
  const tl = gsap.timeline({ onComplete: () => (jumping = false) });
  tl.fromTo(L.uRing, { value: 0.01 }, { value: 2.4, duration: 1.7, ease: 'power2.out' }, 0)
    .fromTo(L.uRingAmp, { value: 1 }, { value: 0, duration: 1.7, ease: 'power1.in' }, 0)
    .set(L.uRing, { value: -1 });
  setTimeout(() => scrollToProgress(target, { duration }), 120);
}
