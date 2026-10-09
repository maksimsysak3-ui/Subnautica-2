// Sound effects, synthesized with Web Audio: no files, nothing to download. UI clicks and
// tab switches, a confirmation chime, the crowd on touchdowns and turnovers, and the
// referee's whistle. Quiet by design, and switchable in Options.
const KEY = 'gg-sfx';
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export const sfxOn = () => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } };
export const setSfx = (on: boolean) => { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage blocked */ } };

function ac(): AudioContext | null {
  if (!sfxOn()) return null;
  try {
    if (!ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C(); master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}
function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.25, at = 0, slide?: number) {
  const c = ac(); if (!c || !master) return;
  const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur: number, gain: number, filter: number, q = 0.8, attack = 0.15) {
  const c = ac(); if (!c || !master) return;
  const len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime;
  src.buffer = buf; f.type = 'bandpass'; f.frequency.value = filter; f.Q.value = q;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master); src.start(t);
}

export const sfx = {
  click: () => tone(1800, 0.04, 'triangle', 0.08),
  tab: () => { tone(520, 0.09, 'sine', 0.08, 0, 760); },
  confirm: () => { tone(660, 0.12, 'sine', 0.14); tone(990, 0.18, 'sine', 0.12, 0.08); },
  error: () => { tone(220, 0.16, 'square', 0.06); tone(180, 0.2, 'square', 0.05, 0.1); },
  crowd: () => { noise(2.2, 0.32, 900, 0.6, 0.25); noise(2.0, 0.18, 2200, 0.7, 0.3); },
  groan: () => { noise(1.3, 0.2, 420, 0.9, 0.12); },
  whistle: () => { tone(2900, 0.32, 'sine', 0.12, 0, 3100); tone(2950, 0.32, 'sine', 0.05, 0.02, 3150); },
};

/** One listener for the whole app: every button and chip clicks; tabs swish. */
export function installUiSounds() {
  document.addEventListener('pointerdown', e => {
    const el = (e.target as HTMLElement).closest('button, .chip, .bigtab, .subtab');
    if (!el || (el as HTMLButtonElement).disabled) return;
    if (el.matches('.bigtab, .subtab')) sfx.tab(); else sfx.click();
  }, { passive: true });
}
