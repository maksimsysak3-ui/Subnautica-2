// Synthesised stadium audio: crowd bed, roars, whistles and UI ticks. No audio files.
let ctx: AudioContext | null = null;
let crowd: { src: AudioBufferSourceNode; gain: GainNode; filt: BiquadFilterNode } | null = null;
let enabled = true;
export const setSound = (on: boolean) => { enabled = on; if (!on) stopCrowd(); };

function ac() {
  if (!ctx) { try { ctx = new AudioContext(); } catch { return null; } }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
function noiseBuffer(c: AudioContext, secs: number) {
  const b = c.createBuffer(1, c.sampleRate * secs, c.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5 + w * 0.08; }
  return b;
}

export function startCrowd() {
  if (!enabled) return;
  const c = ac(); if (!c || crowd) return;
  const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 4); src.loop = true;
  const filt = c.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 700; filt.Q.value = 0.6;
  const gain = c.createGain(); gain.gain.value = 0.0001;
  src.connect(filt).connect(gain).connect(c.destination); src.start();
  gain.gain.exponentialRampToValueAtTime(0.11, c.currentTime + 1.5);
  crowd = { src, gain, filt };
}
export function stopCrowd() {
  if (!crowd || !ctx) return;
  const cr = crowd; crowd = null;
  cr.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
  setTimeout(() => { try { cr.src.stop(); } catch { /* */ } }, 900);
}
/** Swell the crowd: 0.3 for a chance, 1 for a goal. */
export function roar(level = 1) {
  if (!enabled || !crowd || !ctx) return;
  const g = crowd.gain.gain, f = crowd.filt.frequency, t = ctx.currentTime;
  g.cancelScheduledValues(t); f.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.11 + 0.5 * level, t + 0.25); g.exponentialRampToValueAtTime(0.11, t + 1.5 + level * 3.5);
  f.setValueAtTime(f.value, t); f.linearRampToValueAtTime(900 + 600 * level, t + 0.3); f.linearRampToValueAtTime(700, t + 3 + level * 2);
}
export function groan() {
  if (!enabled || !crowd || !ctx) return;
  const g = crowd.gain.gain, f = crowd.filt.frequency, t = ctx.currentTime;
  g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.3, t + 0.2); g.exponentialRampToValueAtTime(0.11, t + 1.6);
  f.setValueAtTime(f.value, t); f.linearRampToValueAtTime(420, t + 0.2); f.linearRampToValueAtTime(700, t + 1.6);
}
export function whistle(long = false) {
  if (!enabled) return;
  const c = ac(); if (!c) return;
  const reps = long ? 3 : 1;
  for (let i = 0; i < reps; i++) {
    const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    o.frequency.value = 2650; lfo.frequency.value = 38; lg.gain.value = 120;
    lfo.connect(lg).connect(o.frequency);
    const t = c.currentTime + i * 0.55;
    const len = long && i === 2 ? 0.9 : 0.32;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.02); g.gain.setValueAtTime(0.09, t + len - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(c.destination); o.start(t); lfo.start(t); o.stop(t + len + 0.05); lfo.stop(t + len + 0.05);
  }
}
export function tick() {
  if (!enabled) return;
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'triangle'; o.frequency.value = 1400;
  g.gain.setValueAtTime(0.03, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.06);
  o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.07);
}
export function sting() {
  if (!enabled) return;
  const c = ac(); if (!c) return;
  [523, 659, 784, 1046].forEach((f, i) => {
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = f;
    const filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 1800;
    const t = c.currentTime + i * 0.09;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(filt).connect(g).connect(c.destination); o.start(t); o.stop(t + 1);
  });
}
