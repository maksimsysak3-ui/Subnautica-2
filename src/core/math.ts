/**
 * Core math utilities shared by every system.
 * Deterministic where it matters — the mission generator and ballistics
 * both need reproducible results from a seed.
 */

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
export const TAU = Math.PI * 2;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function inverseLerp(a: number, b: number, v: number): number {
  return a === b ? 0 : (v - a) / (b - a);
}

export function remap(v: number, inA: number, inB: number, outA: number, outB: number): number {
  return lerp(outA, outB, clamp01(inverseLerp(inA, inB, v)));
}

/** Frame-rate independent exponential smoothing. `rate` is per-second. */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-rate * dt));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01(inverseLerp(edge0, edge1, x));
  return t * t * (3 - 2 * t);
}

export function smootherstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01(inverseLerp(edge0, edge1, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function sign(v: number): number {
  return v < 0 ? -1 : v > 0 ? 1 : 0;
}

/** Shortest signed angular difference in radians. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function moveTowards(current: number, target: number, maxDelta: number): number {
  const d = target - current;
  if (Math.abs(d) <= maxDelta) return target;
  return current + sign(d) * maxDelta;
}

/** Approach a target angle by at most maxDelta radians, wrapping correctly. */
export function moveTowardsAngle(current: number, target: number, maxDelta: number): number {
  const d = angleDelta(current, target);
  if (Math.abs(d) <= maxDelta) return current + d;
  return current + sign(d) * maxDelta;
}

// ---------------------------------------------------------------------------
// Deterministic RNG — xoshiro128** seeded from a string or number.
// ---------------------------------------------------------------------------

export class Rng {
  private s0 = 0;
  private s1 = 0;
  private s2 = 0;
  private s3 = 0;

  constructor(seed: number | string = 0x9e3779b9) {
    this.reseed(seed);
  }

  reseed(seed: number | string): void {
    let h = typeof seed === 'number' ? (seed >>> 0) : hashString(seed);
    // splitmix32 expansion into four words
    const next = (): number => {
      h = (h + 0x9e3779b9) >>> 0;
      let z = h;
      z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
      z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
      return (z ^ (z >>> 15)) >>> 0;
    };
    this.s0 = next();
    this.s1 = next();
    this.s2 = next();
    this.s3 = next();
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) this.s0 = 1;
  }

  /** Raw 32-bit unsigned. */
  nextU32(): number {
    const r = (Math.imul(this.s1 * 5, 1) >>> 0);
    const result = ((r << 7) | (r >>> 25)) * 9 >>> 0;
    const t = (this.s1 << 9) >>> 0;
    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = ((this.s3 << 11) | (this.s3 >>> 21)) >>> 0;
    return result >>> 0;
  }

  /** [0,1) */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  range(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }

  int(loInclusive: number, hiExclusive: number): number {
    return loInclusive + Math.floor(this.next() * (hiExclusive - loInclusive));
  }

  bool(chance = 0.5): boolean {
    return this.next() < chance;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length)];
  }

  /** Weighted pick. `weights[i]` corresponds to `arr[i]`. */
  pickWeighted<T>(arr: readonly T[], weights: readonly number[]): T {
    let total = 0;
    for (let i = 0; i < arr.length; i++) total += weights[i];
    let r = this.next() * total;
    for (let i = 0; i < arr.length; i++) {
      r -= weights[i];
      if (r <= 0) return arr[i];
    }
    return arr[arr.length - 1];
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i + 1);
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  /** Standard normal via Box–Muller. */
  gaussian(mean = 0, stdDev = 1): number {
    const u = Math.max(1e-9, this.next());
    const v = this.next();
    return mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }

  /** Uniform point on the unit disc — used for cone-of-fire dispersion. */
  onDisc(): [number, number] {
    const a = this.next() * TAU;
    const r = Math.sqrt(this.next());
    return [Math.cos(a) * r, Math.sin(a) * r];
  }
}

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Noise — value + simplex-ish gradient noise for terrain, weather, wind.
// ---------------------------------------------------------------------------

function grad2(hash: number, x: number, y: number): number {
  switch (hash & 7) {
    case 0: return x + y;
    case 1: return x - y;
    case 2: return -x + y;
    case 3: return -x - y;
    case 4: return x;
    case 5: return -x;
    case 6: return y;
    default: return -y;
  }
}

/** Deterministic 2D gradient noise in roughly [-1,1]. */
export class Noise2D {
  private perm = new Uint8Array(512);

  constructor(seed: number | string = 1337) {
    const rng = new Rng(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = rng.int(0, i + 1);
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  sample(x: number, y: number): number {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const X = xi & 255, Y = yi & 255;
    const aa = this.perm[X + this.perm[Y]];
    const ab = this.perm[X + this.perm[Y + 1]];
    const ba = this.perm[X + 1 + this.perm[Y]];
    const bb = this.perm[X + 1 + this.perm[Y + 1]];
    const x1 = lerp(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u);
    const x2 = lerp(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v) * 0.7071;
  }

  /** Fractal Brownian motion. */
  fbm(x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.sample(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  /** Ridged multifractal — good for rocky terrain spines. */
  ridged(x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      const n = 1 - Math.abs(this.sample(x * freq, y * freq));
      sum += n * n * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return (sum / norm) * 2 - 1;
  }
}

// ---------------------------------------------------------------------------
// Small helpers used across gameplay code.
// ---------------------------------------------------------------------------

/** Linear→dB and back, for the audio mixer. */
export function linToDb(v: number): number {
  return 20 * Math.log10(Math.max(1e-6, v));
}
export function dbToLin(db: number): number {
  return Math.pow(10, db / 20);
}

/** Format seconds as M:SS for the HUD. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
