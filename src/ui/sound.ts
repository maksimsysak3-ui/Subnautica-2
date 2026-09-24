/**
 * The game's noises, synthesised rather than shipped.
 *
 * A city builder needs about five sounds and not one of them is worth a
 * download: a click, a confirmation, a refusal, a cash register and the chime
 * when the city levels up. Every one of those is a couple of oscillators and an
 * envelope, so they are built here out of Web Audio and the whole sound design
 * costs nothing in the bundle and nothing in load time.
 *
 * The context is created on the first sound rather than at boot, because a
 * browser will not start one until the player has clicked something, and an
 * AudioContext created before that is a suspended one that never recovers
 * without being resumed by hand.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let level = 0.7;
let muted = false;

function audio(): AudioContext | null {
  if (ctx !== null) return ctx;
  const Ctor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (Ctor === undefined) return null;
  try {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : level;
    master.connect(ctx.destination);
  } catch {
    return null;
  }
  return ctx;
}

/** Sets the master volume, 0 to 1. Persisted by the settings panel. */
export function setVolume(v: number): void {
  level = Math.max(0, Math.min(1, v));
  if (master !== null) master.gain.value = muted ? 0 : level;
}

export function setMuted(on: boolean): void {
  muted = on;
  if (master !== null) master.gain.value = muted ? 0 : level;
}

export function volume(): number { return level; }
export function isMuted(): boolean { return muted; }

interface Voice {
  /** Frequency in hertz, or a pair to slide between. */
  from: number;
  to?: number;
  /** Seconds. */
  length: number;
  type?: OscillatorType;
  gain?: number;
  /** Seconds to wait before it starts, for a chord or an arpeggio. */
  delay?: number;
}

function play(voices: Voice[]): void {
  const c = audio();
  if (c === null || master === null) return;
  if (c.state === 'suspended') void c.resume();
  const now = c.currentTime;
  for (const v of voices) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const at = now + (v.delay ?? 0);
    osc.type = v.type ?? 'sine';
    osc.frequency.setValueAtTime(v.from, at);
    if (v.to !== undefined) osc.frequency.exponentialRampToValueAtTime(v.to, at + v.length);
    // A short attack and an exponential tail: the shape of everything struck.
    const peak = (v.gain ?? 0.2);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + v.length);
    osc.connect(gain);
    gain.connect(master);
    osc.start(at);
    osc.stop(at + v.length + 0.02);
  }
}

/** A tool picked up, a button pressed. */
export function click(): void {
  play([{ from: 620, to: 460, length: 0.06, type: 'triangle', gain: 0.10 }]);
}

/** Something placed, something bought. */
export function confirm(): void {
  play([
    { from: 540, length: 0.09, type: 'triangle', gain: 0.12 },
    { from: 810, length: 0.12, type: 'sine', gain: 0.10, delay: 0.05 },
  ]);
}

/** Money spent or received. */
export function cash(): void {
  play([
    { from: 1180, length: 0.07, type: 'square', gain: 0.05 },
    { from: 1560, length: 0.16, type: 'sine', gain: 0.07, delay: 0.04 },
  ]);
}

/** A refusal: not enough money, not unlocked, nowhere to put it. */
export function deny(): void {
  play([{ from: 260, to: 150, length: 0.16, type: 'sawtooth', gain: 0.07 }]);
}

/**
 * The level-up: a rising major arpeggio with a fifth under it.
 *
 * Four notes rather than a fanfare. It plays at a moment the player is already
 * being shown a card, so it has to arrive, say "good", and get out of the way.
 */
export function fanfare(): void {
  const root = 523.25;
  play([
    { from: root, length: 0.5, type: 'triangle', gain: 0.13 },
    { from: root * 1.26, length: 0.5, type: 'triangle', gain: 0.12, delay: 0.09 },
    { from: root * 1.5, length: 0.55, type: 'triangle', gain: 0.12, delay: 0.18 },
    { from: root * 2, length: 0.9, type: 'sine', gain: 0.14, delay: 0.27 },
    { from: root / 2, length: 1.0, type: 'sine', gain: 0.08 },
  ]);
}

/** A notice arriving in the corner. */
export function ping(): void {
  play([{ from: 880, length: 0.14, type: 'sine', gain: 0.07 }]);
}

/**
 * The context and the master gain, for the soundscape to mix into. Created on
 * first ask; null where the browser has no Web Audio.
 */
export function bus(): { ctx: AudioContext; out: GainNode } | null {
  const c = audio();
  if (c === null || master === null) return null;
  return { ctx: c, out: master };
}

/** A road laid: a low, soft thud, like a roller settling tarmac. */
export function thud(): void {
  play([
    { from: 150, to: 70, length: 0.22, type: 'sine', gain: 0.22 },
    { from: 420, to: 260, length: 0.07, type: 'triangle', gain: 0.05 },
  ]);
}

/** Land zoned: a quick rising brush of two notes. */
export function brush(): void {
  play([
    { from: 660, to: 760, length: 0.09, type: 'sine', gain: 0.07 },
    { from: 990, to: 1120, length: 0.12, type: 'sine', gain: 0.05, delay: 0.05 },
  ]);
}

/** Something knocked down: a short crunch. */
export function crunch(): void {
  play([
    { from: 190, to: 55, length: 0.26, type: 'sawtooth', gain: 0.08 },
    { from: 95, to: 45, length: 0.32, type: 'square', gain: 0.05, delay: 0.03 },
  ]);
}

/**
 * A siren, somewhere off to one side: two tones, falling away as it passes.
 * `level` is 0 to 1 by how close the vehicle is to the camera.
 */
export function siren(level: number, pan = 0): void {
  const b = bus();
  if (b === null || level <= 0.01) return;
  const ctx = b.ctx;
  const out = ctx.createGain();
  out.gain.value = 0;
  let dest: AudioNode = b.out;
  if (typeof ctx.createStereoPanner === 'function') {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(b.out);
    dest = p;
  }
  out.connect(dest);
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  const t = ctx.currentTime;
  for (let i = 0; i < 6; i++) {
    osc.frequency.setValueAtTime(i % 2 === 0 ? 740 : 588, t + i * 0.42);
  }
  const peak = 0.05 * level;
  out.gain.linearRampToValueAtTime(peak, t + 0.3);
  out.gain.setValueAtTime(peak, t + 1.8);
  out.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
  osc.connect(out);
  osc.start(t);
  osc.stop(t + 2.7);
  setTimeout(() => { try { dest.disconnect(); out.disconnect(); } catch { /* gone */ } }, 3200);
}
