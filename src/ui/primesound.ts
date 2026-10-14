// Show stings for the prime-time opens, synthesized with Web Audio (no files). Thursday is
// a fast synth riser and arpeggio, Sunday a timpani roll under a brass swell, Monday a run of
// heavy hits and metal clangs. Quiet by design and silent when sound effects are off.
import { sfxOn } from './sfx';
import type { Look } from './primestage';

let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (!sfxOn()) return null;
  try {
    if (!ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      const len = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

/** Plays the sting for a look; returns a stop function (fades out quickly). */
export function playSting(look: Look, hits: number[]): () => void {
  const c = audio(); if (!c || !noiseBuf) return () => {};
  const T = c.currentTime + 0.05;
  const out = c.createGain(); out.gain.value = 0.2;
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5;
  out.connect(comp).connect(c.destination);
  const nb = noiseBuf;

  const osc = (type: OscillatorType, f: number, at: number, dur: number, gain: number, o: { attack?: number; to?: number; detune?: number; lp?: number; lpTo?: number } = {}) => {
    const s = T + at, os = c.createOscillator(), g = c.createGain();
    os.type = type; os.frequency.setValueAtTime(f, s); if (o.to) os.frequency.exponentialRampToValueAtTime(o.to, s + dur); if (o.detune) os.detune.value = o.detune;
    const a = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, s); g.gain.linearRampToValueAtTime(gain, s + a); g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    let node: AudioNode = os;
    if (o.lp) { const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.setValueAtTime(o.lp, s); if (o.lpTo) f2.frequency.exponentialRampToValueAtTime(o.lpTo, s + Math.min(dur, a + 0.6)); node = os.connect(f2); }
    node.connect(g).connect(out); os.start(s); os.stop(s + dur + 0.05);
  };
  const noise = (at: number, dur: number, gain: number, type: BiquadFilterType, f: number, o: { attack?: number; to?: number; q?: number } = {}) => {
    const s = T + at, src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    src.buffer = nb; src.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, s); fl.Q.value = o.q ?? 0.7;
    if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, s + dur);
    const a = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, s); g.gain.linearRampToValueAtTime(gain, s + a); g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    src.connect(fl).connect(g).connect(out); src.start(s); src.stop(s + dur + 0.05);
  };
  const kick = (at: number, g = 0.9) => { osc('sine', 130, at, 0.45, g, { to: 38 }); osc('triangle', 60, at, 0.6, g * 0.5, { to: 32 }); noise(at, 0.06, g * 0.4, 'highpass', 2500); };
  const clang = (at: number, g = 0.25) => { for (const [f, k] of [[523, 1], [1307, 0.6], [2153, 0.45], [3411, 0.3]] as const) osc('sine', f, at, 1.1, g * k); noise(at, 0.3, g * 0.6, 'bandpass', 4200, { q: 2 }); };
  const whoosh = (at: number, dur = 0.5, g = 0.2) => noise(at, dur, g, 'bandpass', 400, { to: 5000, attack: dur * 0.7, q: 1.2 });
  const chord = (at: number, notes: number[], dur: number, g: number) => { for (const n of notes) for (const d of [-7, 0, 7]) osc('sawtooth', n, at, dur, g / notes.length, { attack: 0.5, detune: d, lp: 300, lpTo: 2600 }); };

  if (look === 'thu') {
    whoosh(0, 0.32, 0.25);
    const arp = [329.6, 493.9, 659.3, 987.8, 659.3, 493.9, 740, 987.8];
    for (let i = 0; i < 16; i++) osc('square', arp[i % 8], 0.3 + i * 0.075, 0.12, 0.05, { lp: 3800 });
    for (const h of hits) { kick(h, 0.55); osc('sawtooth', 82.4, h, 0.35, 0.12, { lp: 900, lpTo: 200 }); }
    noise(0.75, 0.5, 0.12, 'highpass', 6000, { attack: 0.3 });
    osc('sawtooth', 110, 1.2, 1.4, 0.12, { to: 440, attack: 0.9, lp: 600, lpTo: 4000 });
    osc('sine', 55, 2.55, 0.9, 0.35, { to: 40 });
    whoosh(4.7, 0.35, 0.15); whoosh(6.85, 0.35, 0.15); whoosh(8.45, 0.5, 0.18);
  } else if (look === 'sun') {
    for (let i = 0; i < 14; i++) osc('sine', 72, 0.1 + i * 0.07, 0.3, 0.1 + i * 0.03, { to: 58 });
    noise(0.2, 1.3, 0.12, 'highpass', 5000, { attack: 1.1 });
    osc('sine', 65, 1.15, 1.6, 0.7, { to: 52 }); noise(1.15, 0.2, 0.25, 'lowpass', 400);
    chord(1.15, [116.5, 174.6, 233.1, 293.7, 349.2], 3.4, 0.5);
    chord(3.9, [155.6, 233.1, 311.1, 392], 3.0, 0.38);
    osc('sine', 65, 4.1, 1.2, 0.4, { to: 52 });
    chord(9.3, [116.5, 174.6, 233.1, 293.7, 466.2], 2.4, 0.45);
    osc('sine', 65, 9.3, 1.4, 0.5, { to: 50 }); noise(10.85, 0.7, 0.12, 'highpass', 3000, { attack: 0.5 });
  } else {
    osc('sawtooth', 41.2, 0.3, 2.8, 0.18, { attack: 0.3, lp: 220, lpTo: 600 });
    osc('sawtooth', 41.6, 0.3, 2.8, 0.14, { attack: 0.3, lp: 220, lpTo: 600, detune: 12 });
    hits.forEach((h, i) => { kick(h, 1); clang(h, i < 3 || i === 3 ? 0.22 : 0.14); });
    whoosh(2.9, 0.25, 0.2); whoosh(5.5, 0.25, 0.2); whoosh(7.5, 0.25, 0.2);
  }
  return () => { try { out.gain.cancelScheduledValues(c.currentTime); out.gain.setValueAtTime(out.gain.value, c.currentTime); out.gain.linearRampToValueAtTime(0, c.currentTime + 0.25); setTimeout(() => out.disconnect(), 400); } catch { /* already gone */ } };
}
