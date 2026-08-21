/**
 * Procedural surface textures.
 *
 * OWNED BY: World / Graphics.
 *
 * No binary assets ship with this project, so every texture is drawn into a
 * canvas at boot. That is a real constraint but not a crippling one: what flat
 * untextured geometry actually lacks is **high-frequency break-up**, and noise
 * is exactly what a procedural generator is good at.
 *
 * Each texture is small (256px) and tiles, so it costs almost nothing in
 * memory and the repeat factor does the work of making a wall look like a wall
 * rather than a coloured rectangle.
 *
 * ## Why these are greyscale
 * They multiply the material's base colour rather than replacing it. The
 * palette in palette.ts is carefully value-separated and per-brick tinting
 * rides on top of it; a coloured texture would fight both. A texture centred
 * on mid-grey modulates without shifting hue.
 */

import * as THREE from 'three';

/**
 * Value noise with a deterministic hash.
 *
 * Not `Math.random()`: two runs must produce the same textures, or a critic's
 * before/after comparison is comparing two different builds.
 */
function hash2(x: number, y: number, seed: number): number {
  let h = x * 374761393 + y * 668265263 + seed * 1274126177;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smoothNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** Tiling fBm. The modulo on the lattice is what makes the result seamless. */
function fbmTiled(x: number, y: number, period: number, octaves: number, seed: number): number {
  let sum = 0, amp = 1, norm = 0, p = period;
  for (let o = 0; o < octaves; o++) {
    const sx = ((x * p) % p + p) % p;
    const sy = ((y * p) % p + p) % p;
    sum += smoothNoise(sx, sy, seed + o * 97) * amp;
    norm += amp;
    amp *= 0.5;
    p *= 2;
  }
  return sum / norm;
}

export type TextureKind =
  | 'stucco' | 'concrete' | 'gravel' | 'sand' | 'grass' | 'dirt'
  | 'metal' | 'wood' | 'tile' | 'asphalt' | 'foliage';

interface Recipe {
  /** Low-frequency blotching, 0..1 of the value range. */
  blotch: number;
  /** Fine grain. */
  grain: number;
  /** Base lattice period — smaller is chunkier. */
  period: number;
  /** Straight lines: horizontal courses (brick/tile) or vertical grain (wood). */
  lines?: { axis: 'x' | 'y'; count: number; depth: number; jitter: number };
  /** Discrete speckles, for gravel and grass. */
  speckle?: { count: number; radius: number; depth: number };
}

const RECIPES: Record<TextureKind, Recipe> = {
  // Hand-floated render: broad soft blotching, almost no grain.
  stucco:   { blotch: 0.20, grain: 0.05, period: 5 },
  // Poured concrete: tighter mottling plus aggregate speckle.
  concrete: { blotch: 0.14, grain: 0.10, period: 7, speckle: { count: 420, radius: 1.6, depth: 0.13 } },
  gravel:   { blotch: 0.10, grain: 0.16, period: 11, speckle: { count: 1500, radius: 2.1, depth: 0.34 } },
  sand:     { blotch: 0.13, grain: 0.09, period: 6 },
  grass:    { blotch: 0.22, grain: 0.20, period: 9, speckle: { count: 1900, radius: 1.5, depth: 0.24 } },
  dirt:     { blotch: 0.20, grain: 0.13, period: 6, speckle: { count: 700, radius: 1.9, depth: 0.18 } },
  metal:    { blotch: 0.07, grain: 0.05, period: 4, lines: { axis: 'y', count: 6, depth: 0.06, jitter: 0.2 } },
  wood:     { blotch: 0.11, grain: 0.07, period: 3, lines: { axis: 'y', count: 26, depth: 0.16, jitter: 0.55 } },
  tile:     { blotch: 0.06, grain: 0.04, period: 5, lines: { axis: 'x', count: 8, depth: 0.18, jitter: 0 } },
  asphalt:  { blotch: 0.09, grain: 0.15, period: 9, speckle: { count: 1100, radius: 1.4, depth: 0.16 } },
  foliage:  { blotch: 0.26, grain: 0.22, period: 12, speckle: { count: 900, radius: 2.6, depth: 0.30 } },
};

const SIZE = 256;
const cache = new Map<string, THREE.CanvasTexture>();

/**
 * Build (or fetch) a tiling greyscale texture.
 *
 * `repeat` is in tiles per world metre, so a wall and the ground next to it
 * agree on scale — mismatched texel density is one of the loudest tells that
 * a scene was assembled rather than built.
 */
export function surfaceTexture(kind: TextureKind, repeat = 0.5): THREE.CanvasTexture {
  const key = `${kind}:${repeat}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const r = RECIPES[kind];
  const seed = kind.charCodeAt(0) * 31 + kind.length * 17;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(SIZE, SIZE);
  const d = img.data;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE, v = y / SIZE;
      let value = 0.5;
      value += (fbmTiled(u, v, r.period, 4, seed) - 0.5) * 2 * r.blotch;
      value += (hash2(x, y, seed + 7) - 0.5) * 2 * r.grain;

      if (r.lines) {
        const along = r.lines.axis === 'x' ? v : u;
        const across = r.lines.axis === 'x' ? u : v;
        const jitter = r.lines.jitter
          ? (fbmTiled(across, along * 0.25, 4, 2, seed + 31) - 0.5) * r.lines.jitter
          : 0;
        const t = (along + jitter) * r.lines.count;
        // Distance to the nearest course line, in line-widths.
        const edge = Math.abs(t - Math.round(t));
        if (edge < 0.06) value -= r.lines.depth * (1 - edge / 0.06);
      }

      const i = (y * SIZE + x) * 4;
      const c = Math.max(0, Math.min(255, Math.round(value * 255)));
      d[i] = d[i + 1] = d[i + 2] = c;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Speckle on top, so it reads as discrete stones rather than more noise.
  if (r.speckle) {
    for (let i = 0; i < r.speckle.count; i++) {
      const sx = hash2(i, 1, seed + 11) * SIZE;
      const sy = hash2(i, 2, seed + 13) * SIZE;
      const dark = hash2(i, 3, seed + 17) > 0.5;
      const a = r.speckle.depth * (0.4 + hash2(i, 4, seed + 19) * 0.6);
      ctx.fillStyle = dark ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.7})`;
      ctx.beginPath();
      ctx.arc(sx, sy, r.speckle.radius * (0.5 + hash2(i, 5, seed + 23)), 0, Math.PI * 2);
      ctx.fill();
      // Wrap the ones that cross an edge, or the tile seam shows.
      for (const [ox, oy] of [[-SIZE, 0], [SIZE, 0], [0, -SIZE], [0, SIZE]] as const) {
        if (sx + ox > -8 && sx + ox < SIZE + 8 && sy + oy > -8 && sy + oy < SIZE + 8) {
          ctx.beginPath();
          ctx.arc(sx + ox, sy + oy, r.speckle.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  // Linear, not sRGB: this is a multiplier, not a colour. Decoding it as sRGB
  // would push the mid-grey no-op point away from 0.5 and darken everything.
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  // A compound wall runs 100 m across the frame; without real anisotropy the
  // tiling turns into a moire grid at grazing angles.
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

/** Free every generated texture. */
export function disposeTextures(): void {
  for (const t of cache.values()) t.dispose();
  cache.clear();
}
