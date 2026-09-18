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
