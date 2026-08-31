/**
 * Deterministic hashing and value noise.
 *
 * The design doc commits to a reproducible simulation, so nothing in sim/ may
 * call Math.random(). Terrain, city layout and later the agent schedules all
 * draw from here: same seed, same world, on every machine.
 */

/** Integer hash of a 2D cell plus a salt. Returns [0, 1). */
export function hash2(x: number, y: number, salt: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(salt, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const fade = (t: number): number => t * t * (3 - 2 * t);

/** Value noise in [0, 1], smooth across cell boundaries. */
export function noise2(x: number, y: number, salt: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = fade(x - xi), yf = fade(y - yi);
  const a = hash2(xi, yi, salt), b = hash2(xi + 1, yi, salt);
  const c = hash2(xi, yi + 1, salt), d = hash2(xi + 1, yi + 1, salt);
  return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf;
}

/** Fractal Brownian motion: octaves of value noise at halving amplitude. */
export function fbm(x: number, y: number, octaves: number, salt: number): number {
  let sum = 0, amp = 1, norm = 0, freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x * freq, y * freq, salt + i * 31) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;   // slightly off 2 so octaves do not align into visible grids
  }
  return sum / norm;
}
