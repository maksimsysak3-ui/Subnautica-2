/**
 * DSP primitives — the vocabulary every synth chain in this directory is
 * written in.
 *
 * There are no audio files in BLACK MERIDIAN and there can be none: a CSP
 * blocks external hosts and the game must boot offline. Every sound is built
 * from noise, oscillators, filters, waveshapers and procedurally generated
 * impulse responses. That is not a handicap — a gunshot is a transient, a
 * body resonance and a room, and all three synthesise well.
 *
 * Conventions used throughout:
 *   - Every generator takes an explicit `when` (AudioContext time) so a whole
 *     event can be scheduled ahead of the clock. Propagation delay over
 *     distance depends on this.
 *   - Every generator returns the time it finishes, so callers can schedule
 *     cleanup without guessing.
 *   - Envelopes are attack + double-exponential decay. A single exponential
 *     sounds synthetic; the fast-then-slow knee is what reads as "impact".
 */

import { Rng } from '../core/math';

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** m/s at 20°C. Everything about distance modelling hangs off this. */
export const SPEED_OF_SOUND = 343;

/**
 * Shared variation source. Audio does not need to be reproducible from a
 * mission seed (world generation does), but a seeded stream is still nicer
 * than Math.random: a bug reproduces.
 */
export const arng = new Rng('black-meridian-audio');

export function rand(lo: number, hi: number): number {
  return lo + arng.next() * (hi - lo);
}
/** Multiplicative jitter, e.g. `f * jitter(0.06)` for ±6%. */
export function jitter(amount: number): number {
  return 1 + (arng.next() * 2 - 1) * amount;
}
export function chance(p: number): boolean {
  return arng.next() < p;
}
export function pickOne<T>(list: readonly T[]): T {
  return list[Math.min(list.length - 1, Math.floor(arng.next() * list.length))];
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

// ===========================================================================
// Noise
// ===========================================================================

export type NoiseKind = 'white' | 'pink' | 'brown' | 'violet';

const noiseCache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

/**
 * Cached noise beds. Two seconds is long enough that reading from a random
 * offset never sounds like a loop, and short enough to stay cheap.
 */
export function noiseBuffer(ctx: BaseAudioContext, kind: NoiseKind, seconds = 2): AudioBuffer {
  let byKind = noiseCache.get(ctx);
  if (!byKind) {
    byKind = new Map();
    noiseCache.set(ctx, byKind);
  }
  const key = `${kind}:${seconds}`;
  const hit = byKind.get(key);
  if (hit) return hit;

  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const r = new Rng(`noise:${kind}`);

  switch (kind) {
    case 'white': {
      for (let i = 0; i < len; i++) d[i] = r.next() * 2 - 1;
      break;
    }
    case 'pink': {
      // Paul Kellet's economical pink filter — flat-ish -3dB/octave.
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = r.next() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
      break;
    }
    case 'brown': {
      // Leaky integrator — -6dB/octave, the bed for wind and blast bodies.
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = r.next() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
      break;
    }
    case 'violet': {
      // Differentiated white — +6dB/octave, used for glass and fine grit.
      let prev = 0;
      for (let i = 0; i < len; i++) {
        const w = r.next() * 2 - 1;
        d[i] = (w - prev) * 0.5;
        prev = w;
      }
      break;
    }
  }
  byKind.set(key, buf);
  return buf;
}

/** A looping noise source read from a random offset. Caller connects it on. */
export function noiseSource(
  ctx: BaseAudioContext,
  kind: NoiseKind,
  when: number,
  duration: number,
  rate = 1,
): AudioBufferSourceNode {
  const buf = noiseBuffer(ctx, kind);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.playbackRate.value = rate;
  const offset = arng.next() * (buf.duration - 0.05);
  src.start(when, offset);
  src.stop(when + duration + 0.01);
  return src;
}

const impulseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Single-sample-ish click used to excite resonators. Perfectly flat spectrum. */
export function impulseSource(ctx: BaseAudioContext, when: number): AudioBufferSourceNode {
  let buf = impulseCache.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, 8, ctx.sampleRate);
    const d = buf.getChannelData(0);
    d[0] = 1;
    d[1] = -0.5;
    d[2] = 0.2;
    impulseCache.set(ctx, buf);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.start(when);
  return src;
}

// ===========================================================================
// Ballistic N-wave
// ===========================================================================

const nwaveCache = new WeakMap<BaseAudioContext, Map<number, AudioBuffer>>();

/**
 * The supersonic crack is not noise — it is a literal N-shaped pressure wave:
 * an instantaneous rise, a linear fall through zero, and a second
 * discontinuity back to ambient. Duration is a few hundred microseconds and
 * grows with miss distance and projectile size. Synthesising the actual shape
 * is what makes a near miss read as a near miss instead of a snare hit.
 *
 * @param micros total N-wave duration in microseconds (150..1400 is sane)
 */
export function nWaveBuffer(ctx: BaseAudioContext, micros: number): AudioBuffer {
  let byLen = nwaveCache.get(ctx);
  if (!byLen) {
    byLen = new Map();
    nwaveCache.set(ctx, byLen);
  }
  const bucket = Math.round(clamp(micros, 120, 1600) / 40) * 40;
  const hit = byLen.get(bucket);
  if (hit) return hit;

  const sr = ctx.sampleRate;
  const nLen = Math.max(4, Math.round((bucket / 1e6) * sr));
  const total = nLen + Math.round(sr * 0.004);
  const buf = ctx.createBuffer(1, total, sr);
  const d = buf.getChannelData(0);
  // Rise time of a real N-wave is finite (~1/10 of the wave) because of
  // atmospheric dispersion — a perfect step aliases horribly.
  const rise = Math.max(1, Math.round(nLen * 0.08));
  for (let i = 0; i < nLen; i++) {
    let v: number;
    if (i < rise) v = i / rise;
    else v = 1 - 2 * ((i - rise) / (nLen - rise));
    d[i] = v;
  }
  // Second shock returns to ambient over the same rise time, then a short
  // exponential relaxation tail so it does not click.
  for (let i = 0; i < total - nLen; i++) {
    d[nLen + i] = -Math.exp(-i / (sr * 0.0004)) * 0.35;
  }
  byLen.set(bucket, buf);
  return buf;
}

// ===========================================================================
// Envelopes
// ===========================================================================

export interface EnvOpts {
  /** Seconds to peak. Anything under ~0.3ms reads as instantaneous. */
  attack?: number;
  /** Seconds held at peak before the decay starts. */
  hold?: number;
  /**
   * 0..1 fraction of peak reached at `kneeAt` of the decay. Lower = punchier
   * (fast collapse then long tail), which is how real impacts behave.
   */
  knee?: number;
  kneeAt?: number;
}

/**
 * Attack + two-stage exponential decay, terminated hard at the end so nothing
 * leaves a DC tail behind. Returns the end time.
 */
export function env(
  p: AudioParam,
  when: number,
  peak: number,
  decay: number,
  opts: EnvOpts = {},
): number {
  const attack = Math.max(0.0002, opts.attack ?? 0.0004);
  const hold = opts.hold ?? 0;
  const knee = clamp(opts.knee ?? 0.22, 0.001, 0.95);
  const kneeAt = clamp(opts.kneeAt ?? 0.16, 0.02, 0.9);
  const pk = Math.max(1e-5, peak);
  const t0 = when;
  const tPeak = t0 + attack + hold;
  const tKnee = tPeak + decay * kneeAt;
  const tEnd = tPeak + decay;

  p.setValueAtTime(0, t0);
  p.linearRampToValueAtTime(pk, t0 + attack);
  if (hold > 0) p.setValueAtTime(pk, tPeak);
  p.exponentialRampToValueAtTime(Math.max(1e-5, pk * knee), tKnee);
  p.exponentialRampToValueAtTime(Math.max(1e-5, pk * 1e-4), tEnd);
  p.setValueAtTime(0, tEnd);
  return tEnd;
}

/** Symmetric swell — used for gusts, tails and distant reports. */
export function swell(
  p: AudioParam,
  when: number,
  peak: number,
  rise: number,
  fall: number,
): number {
  const pk = Math.max(1e-5, peak);
  p.setValueAtTime(0, when);
  p.linearRampToValueAtTime(pk, when + rise);
  p.exponentialRampToValueAtTime(Math.max(1e-5, pk * 1e-4), when + rise + fall);
  p.setValueAtTime(0, when + rise + fall);
  return when + rise + fall;
}

// ===========================================================================
// Waveshaping
// ===========================================================================

const curveCache = new Map<string, Float32Array>();

/** tanh soft clip. `drive` 1 = gentle, 12 = aggressive blast saturation. */
export function softClipCurve(drive: number): Float32Array {
  const key = `soft:${drive.toFixed(2)}`;
  const hit = curveCache.get(key);
  if (hit) return hit;
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  curveCache.set(key, c);
  return c;
}

/**
 * Asymmetric shaper. Real muzzle blast is a positive overpressure spike
 * followed by a shallower negative phase; the asymmetry generates even
 * harmonics, which is a large part of why a gunshot sounds "big" rather than
 * "loud".
 */
export function blastCurve(drive: number): Float32Array {
  const key = `blast:${drive.toFixed(2)}`;
  const hit = curveCache.get(key);
  if (hit) return hit;
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const d = x >= 0 ? drive : drive * 0.55;
    c[i] = Math.tanh(x * d) / Math.tanh(drive);
  }
  curveCache.set(key, c);
  return c;
}

export function shaper(ctx: BaseAudioContext, curve: Float32Array): WaveShaperNode {
  const ws = ctx.createWaveShaper();
  ws.curve = curve;
  ws.oversample = '2x';
  return ws;
}

// ===========================================================================
// Building blocks
// ===========================================================================

export interface Mode {
  /** Hz */
  f: number;
  /** linear */
  gain: number;
  /** seconds to -60dB */
  decay: number;
  /** resonance sharpness for the filtered variant */
  q?: number;
}

/**
 * Modal resonator bank driven by a click. Noise-excited bandpasses beat pure
 * sines here: the excitation noise survives in the attack, which is exactly
 * the grit a struck metal object has.
 */
export function resonantModes(
  ctx: BaseAudioContext,
  dest: AudioNode,
  when: number,
  modes: readonly Mode[],
  exciteMs = 1.2,
  exciteKind: NoiseKind = 'white',
): number {
  let end = when;
  const exc = noiseSource(ctx, exciteKind, when, exciteMs / 1000);
  const excGain = ctx.createGain();
  env(excGain.gain, when, 1, exciteMs / 1000, { attack: 0.0002 });
  exc.connect(excGain);
  for (const m of modes) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = clamp(m.f * jitter(0.02), 20, 20000);
    bp.Q.value = m.q ?? clamp(m.f * m.decay * 0.35, 4, 220);
    const g = ctx.createGain();
    const e = env(g.gain, when, m.gain, m.decay, { attack: 0.0003, knee: 0.3, kneeAt: 0.25 });
    end = Math.max(end, e);
    excGain.connect(bp);
    bp.connect(g);
    g.connect(dest);
  }
  return end;
}

/** Additive sine modes — cleaner and cheaper, for bells, tinnitus and rings. */
export function sineModes(
  ctx: BaseAudioContext,
  dest: AudioNode,
  when: number,
  modes: readonly Mode[],
): number {
  let end = when;
  for (const m of modes) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = clamp(m.f * jitter(0.006), 10, 20000);
    const g = ctx.createGain();
    const e = env(g.gain, when, m.gain, m.decay, { attack: 0.0006, knee: 0.35, kneeAt: 0.3 });
    o.connect(g);
    g.connect(dest);
    o.start(when);
    o.stop(e + 0.02);
    end = Math.max(end, e);
  }
  return end;
}

/**
 * Band-limited noise burst — the workhorse. Returns the end time.
 */
export interface BurstOpts {
  kind?: NoiseKind;
  /** 'bandpass' | 'lowpass' | 'highpass' */
  filter?: BiquadFilterType;
  f0: number;
  /** If set, the filter sweeps f0 -> f1 across the burst. */
  f1?: number;
  q?: number;
  gain: number;
  attack?: number;
  decay: number;
  knee?: number;
  kneeAt?: number;
  rate?: number;
}

export function noiseBurst(
  ctx: BaseAudioContext,
  dest: AudioNode,
  when: number,
  o: BurstOpts,
): number {
  const dur = (o.attack ?? 0.0005) + o.decay;
  const src = noiseSource(ctx, o.kind ?? 'white', when, dur, o.rate ?? 1);
  const filt = ctx.createBiquadFilter();
  filt.type = o.filter ?? 'bandpass';
  filt.frequency.setValueAtTime(clamp(o.f0, 20, 20000), when);
  if (o.f1 !== undefined && Math.abs(o.f1 - o.f0) > 1) {
    filt.frequency.exponentialRampToValueAtTime(clamp(o.f1, 20, 20000), when + dur);
  }
  filt.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  const end = env(g.gain, when, o.gain, o.decay, {
    attack: o.attack,
    knee: o.knee,
    kneeAt: o.kneeAt,
  });
  src.connect(filt);
  filt.connect(g);
  g.connect(dest);
  return end;
}

/** Pitch-swept sine — sub thumps, ricochet whines, bullet zips. */
export function sweep(
  ctx: BaseAudioContext,
  dest: AudioNode,
  when: number,
  o: {
    f0: number;
    f1: number;
    gain: number;
    decay: number;
    attack?: number;
    type?: OscillatorType;
    knee?: number;
    kneeAt?: number;
    /** Frequency glide time; defaults to the whole decay. */
    glide?: number;
  },
): number {
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(clamp(o.f0, 8, 20000), when);
  osc.frequency.exponentialRampToValueAtTime(
    clamp(o.f1, 8, 20000),
    when + (o.glide ?? o.decay),
  );
  const g = ctx.createGain();
  const end = env(g.gain, when, o.gain, o.decay, {
    attack: o.attack ?? 0.0008,
    knee: o.knee,
    kneeAt: o.kneeAt,
  });
  osc.connect(g);
  g.connect(dest);
  osc.start(when);
  osc.stop(end + 0.02);
  return end;
}

/**
 * Granular crackle — N short filtered clicks scattered over a window. Gravel
 * underfoot, concrete spall, glass tinkle, debris rain.
 */
export function grains(
  ctx: BaseAudioContext,
  dest: AudioNode,
  when: number,
  o: {
    count: number;
    window: number;
    f0: number;
    f1: number;
    q?: number;
    gain: number;
    grainMs?: number;
    kind?: NoiseKind;
    /** 0 = even spread, 1 = all bunched at the start. */
    front?: number;
  },
): number {
  let end = when;
  const front = o.front ?? 0.5;
  for (let i = 0; i < o.count; i++) {
    const u = arng.next();
    const t = when + Math.pow(u, 1 + front * 2) * o.window;
    const dur = ((o.grainMs ?? 4) / 1000) * jitter(0.5);
    const f = o.f0 * Math.pow(o.f1 / o.f0, arng.next());
    const e = noiseBurst(ctx, dest, t, {
      kind: o.kind ?? 'white',
      filter: 'bandpass',
      f0: f,
      q: o.q ?? 6,
      gain: o.gain * rand(0.35, 1),
      decay: dur,
      attack: 0.0002,
    });
    end = Math.max(end, e);
  }
  return end;
}

// ===========================================================================
// Small helpers
// ===========================================================================

export function dist3(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Atmospheric absorption as a one-pole cutoff. Air is a lowpass whose corner
 * halves roughly every 77 metres; humidity and precipitation tighten it.
 * This single line is most of why a rifle at 300m does not sound like a rifle
 * at 5m.
 */
export function airCutoff(distance: number, weatherOcclusion = 0): number {
  const halfLife = lerp(77, 42, clamp01(weatherOcclusion));
  return clamp(19000 * Math.pow(0.5, Math.max(0, distance) / halfLife), 220, 20000);
}

/** Propagation delay in seconds. */
export function propagationDelay(distance: number): number {
  return Math.max(0, distance) / SPEED_OF_SOUND;
}
