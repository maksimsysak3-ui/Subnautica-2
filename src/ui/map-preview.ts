/**
 * A starting map, drawn from above as a relief map.
 *
 * Read from the map's own height field -- the same function the terrain mesh is
 * built from -- so the picture is exactly the ground the player will get, not
 * a painting of it. Hillshaded from the north-west the way survey maps are,
 * tinted by height, with the river, the buildable square and the motorway
 * that brings the first residents in.
 */

import { baseHeightAt, waterAt, simConfig } from '../sim';
import { peekMap, MAP } from '../sim/maps';

/** Height tints, low to high, in metres. */
const RAMP: Array<[number, [number, number, number]]> = [
  [-20, [70, 104, 60]],
  [10, [96, 128, 70]],
  [45, [128, 138, 82]],
  [95, [142, 128, 92]],
  [160, [128, 118, 104]],
  [230, [164, 160, 154]],
  [300, [226, 228, 230]],
];

function tint(h: number): [number, number, number] {
  if (h <= RAMP[0][0]) return RAMP[0][1];
  for (let i = 1; i < RAMP.length; i++) {
    const [h1, c1] = RAMP[i];
    if (h <= h1) {
      const [h0, c0] = RAMP[i - 1];
      const t = (h - h0) / (h1 - h0);
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
    }
  }
  return RAMP[RAMP.length - 1][1];
}

/** The shader's `climate()`, on a preview colour, so the tile matches the ground. */
function climate(c: [number, number, number], k: number): [number, number, number] {
  const l = c[0] * 0.30 + c[1] * 0.56 + c[2] * 0.14;
  if (k > 0) {
    const t = k * 0.85;
    return [c[0] + (l * 1.30 - c[0]) * t, c[1] + (l * 1.04 - c[1]) * t, c[2] + (l * 0.52 - c[2]) * t];
  }
  const t = -k;
  return [c[0] + (c[0] * 0.72 - c[0]) * t, c[1] + (c[1] * 1.10 - c[1]) * t, c[2] + (c[2] * 0.82 - c[2]) * t];
}

/**
 * Paints `map` into `canvas` at its current pixel size.
 *
 * `span` is the metres shown across; the view is centred on the city.
 */
export function drawMapPreview(canvas: HTMLCanvasElement, map: string, span = 8400): void {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return;
  const img = ctx.createImageData(w, h);
  const mpp = span / w;
  const x0 = -span / 2, z0 = -(h * mpp) / 2;
  peekMap(map, () => {
    // One height per pixel plus a border, so the shading has neighbours.
    const H = new Float32Array((w + 2) * (h + 2));
    const wet = new Uint8Array(w * h);
    for (let j = -1; j <= h; j++) {
      for (let i = -1; i <= w; i++) {
        H[(j + 1) * (w + 2) + (i + 1)] = baseHeightAt(x0 + (i + 0.5) * mpp, z0 + (j + 0.5) * mpp);
      }
    }
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (waterAt(x0 + (i + 0.5) * mpp, z0 + (j + 0.5) * mpp) !== null) wet[j * w + i] = 1;
      }
    }
    const at = (i: number, j: number): number => H[(j + 1) * (w + 2) + (i + 1)];
    // Light from the north-west and above, exaggerated a little so gentle
    // country still reads as country at this scale.
    const lx = -0.6, lz = -0.6, ly = 0.53;
    const k = 1.6 / (2 * mpp);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const o = (j * w + i) * 4;
        const e = at(i, j);
        if (wet[j * w + i] === 1) {
          img.data[o] = 44; img.data[o + 1] = 92; img.data[o + 2] = 128; img.data[o + 3] = 255;
          continue;
        }
        const dx = (at(i + 1, j) - at(i - 1, j)) * k;
        const dz = (at(i, j + 1) - at(i, j - 1)) * k;
        const n = 1 / Math.hypot(dx, 1, dz);
        const lit = Math.max(0, (-dx * lx + ly - dz * lz) * n);
        const shade = 0.45 + lit * 0.8;
        // Vegetation takes the climate; bare high ground does not.
        const c = e < 150 ? climate(tint(e), MAP.climate) : tint(e);
        img.data[o] = Math.min(255, c[0] * shade);
        img.data[o + 1] = Math.min(255, c[1] * shade);
        img.data[o + 2] = Math.min(255, c[2] * shade);
        img.data[o + 3] = 255;
      }
    }
  });
  ctx.putImageData(img, 0, 0);

  // The buildable square and the road in, drawn over the relief.
  const px = (x: number): number => (x - x0) / mpp;
  const pz = (z: number): number => (z - z0) / mpp;
  const half = (simConfig.cityGrid / 2) * 8;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1;
  ctx.strokeRect(px(-half), pz(-half), (half * 2) / mpp, (half * 2) / mpp);
  ctx.setLineDash([]);
  ctx.strokeStyle = '#f4b54a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px(-half), pz(0));
  ctx.lineTo(px(-half * 0.18), pz(0));
  ctx.stroke();
  ctx.restore();
}
