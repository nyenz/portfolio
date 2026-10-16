// Ambient ocean sound, generated in the browser (no files): a low rumble that gets deeper
// and darker as you dive, slow swells, and a sonar ping at every new zone. Off by default.
import { scramble } from './scramble.js';

export function createSound() {
  const btn = document.querySelector('.sound');
  const label = btn.querySelector('.sound__text');
  let ctx, master, filter, swell, on = false;

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    // brown noise
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 900; filter.Q.value = 0.7;
    swell = ctx.createGain(); swell.gain.value = 0.7;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0.25;
    lfo.connect(lfoAmt).connect(swell.gain); lfo.start();
    src.connect(filter).connect(swell).connect(master); src.start();
  }

  function setOn(v) {
    on = v;
    if (on && !ctx) build();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    if (ctx) master.gain.setTargetAtTime(on ? 0.32 : 0, ctx.currentTime, 0.6);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
    scramble(label, on ? 'SOUND ON' : 'SOUND OFF', 420);
  }
  btn.addEventListener('click', () => setOn(!on));

  return {
    setDepth(d) {
      if (!ctx || !on) return;
      filter.frequency.setTargetAtTime(160 + 900 * Math.exp(-d / 700), ctx.currentTime, 0.4);
    },
    ping(pitch = 1) {
      if (!ctx || !on) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain();
      const dl = ctx.createDelay(1.5), fb = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(1180 * pitch, t); o.frequency.exponentialRampToValueAtTime(1020 * pitch, t + 1.2);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      dl.delayTime.value = 0.42; fb.gain.value = 0.38;
      o.connect(g); g.connect(master); g.connect(dl); dl.connect(fb).connect(dl); dl.connect(master);
      o.start(t); o.stop(t + 1.5);
    },
    get on() { return on; },
  };
}
