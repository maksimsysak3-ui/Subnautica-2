/**
 * Finds parts that float.
 *
 * A box placed a few centimetres clear of what it is meant to sit on looks
 * fine head-on in a viewer and reads as a mistake the moment the camera moves
 * -- a canopy hovering off its posts, a sign with no bracket, a balcony with
 * nothing under it. There is no way to eyeball a hundred and forty assets for
 * this, so it is measured instead.
 *
 * Method: voxelise the surface at 25cm, split it into connected parts, and
 * ask of each part that does not reach the ground whether anything else is
 * near enough underneath or beside it to be holding it up. A cantilever is
 * held at its side, a canopy at its back, a chimney from below -- all of those
 * find a neighbour. A part with half a metre of clear air all round it, below
 * and to every side, is not attached to the building at all.
 *
 * Reports rather than fails: some floating is deliberate (a lamp head on a
 * thin arm the voxel grid loses, a wire). Read the list, fix what is wrong.
 *
 *   node tools/asset-audit.mjs [id-substring]
 */

import * as esbuild from 'esbuild';

const STRIDE = 11;
/** Coarse enough to bridge a real joint, fine enough to catch a real gap. */
const VOX = 0.25;
/** Components smaller than this are noise -- a stray sliver, a lamp lens. */
const MIN_VOXELS = 24;
/** A component whose lowest point is under this is standing on the ground. */
const GROUND = VOX * 1.5;

const ONLY = process.argv[2] ?? '';

const built = await esbuild.build({
  entryPoints: ['src/assets/registry.ts'],
  bundle: true, format: 'esm', write: false, target: 'es2022',
});
const mod = await import(
  `data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`
);
const ASSETS = mod.ASSETS.filter((a) => a.id.includes(ONLY));

const key = (x, y, z) => `${x},${y},${z}`;

/** Every voxel the surface passes through, sampled finely enough not to leak. */
function voxelize(vertices, indices) {
  const grid = new Set();
  const mark = (x, y, z) =>
    grid.add(key(Math.floor(x / VOX), Math.floor(y / VOX), Math.floor(z / VOX)));
  for (let t = 0; t < indices.length; t += 3) {
    const p = [0, 1, 2].map((k) => {
      const i = indices[t + k] * STRIDE;
      return [vertices[i], vertices[i + 1], vertices[i + 2]];
    });
    // Sample density from the triangle's own size, so a large wall is not
    // sampled at the same count as a door handle.
    const e = Math.max(
      Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]),
      Math.hypot(p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]),
    );
    const n = Math.min(24, Math.max(2, Math.ceil(e / (VOX * 0.5))));
    for (let i = 0; i <= n; i++) {
      for (let j = 0; i + j <= n; j++) {
        const u = i / n, v = j / n, w = 1 - u - v;
        mark(p[0][0] * w + p[1][0] * u + p[2][0] * v,
             p[0][1] * w + p[1][1] * u + p[2][1] * v,
             p[0][2] * w + p[1][2] * u + p[2][2] * v);
      }
    }
  }
  return grid;
}

/** 26-connected components, so a part touching another at a corner counts. */
function components(grid) {
  const seen = new Set();
  const out = [];
  for (const start of grid) {
    if (seen.has(start)) continue;
    const stack = [start];
    seen.add(start);
    const cell = [];
    while (stack.length) {
      const cur = stack.pop();
      cell.push(cur);
      const [x, y, z] = cur.split(',').map(Number);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const k = key(x + dx, y + dy, z + dz);
            if (grid.has(k) && !seen.has(k)) { seen.add(k); stack.push(k); }
          }
        }
      }
    }
    out.push(cell);
  }
  return out;
}

let floating = 0;
const rows = [];
for (const a of ASSETS) {
  const mesh = a.build(0).build({ occlusion: false });
  const grid = voxelize(mesh.vertices, mesh.indices);
  const parts = components(grid);
  const bad = [];
  for (const cell of parts) {
    if (cell.length < MIN_VOXELS) continue;
    const coords = cell.map((c) => c.split(',').map(Number));
    let lowest = Infinity;
    let cx = 0, cy = 0, cz = 0;
    for (const [x, y, z] of coords) {
      lowest = Math.min(lowest, y);
      cx += x * VOX; cy += y * VOX; cz += z * VOX;
    }
    if (lowest * VOX <= GROUND) continue;
    // Connectivity alone is not the question -- a parapet ringing a roof is a
    // separate component and perfectly well supported. What matters is whether
    // anything at all sits under the part's lowest layer. If nothing does, it
    // hangs in the air, whatever else it may be near.
    const own = new Set(cell);
    let supported = false;
    for (const [x, y, z] of coords) {
      if (y > lowest + 1) continue;
      // 75cm of search. Tighter than this and every thin support -- a mast, a
      // canopy post, a bracket -- reads as a gap, because a 15cm column only
      // just registers in a 25cm grid and can miss a layer.
      for (let dx = -3; dx <= 3 && !supported; dx++) {
        for (let dz = -3; dz <= 3 && !supported; dz++) {
          for (let dy = -3; dy <= 1; dy++) {
            const k = key(x + dx, y + dy, z + dz);
            if (grid.has(k) && !own.has(k)) { supported = true; break; }
          }
        }
      }
      if (supported) break;
    }
    if (supported) continue;
    bad.push({
      voxels: cell.length,
      base: lowest * VOX,
      at: [cx / cell.length, cy / cell.length, cz / cell.length],
    });
  }
  if (bad.length) {
    floating++;
    rows.push([a.id, bad]);
  }
}

for (const [id, bad] of rows) {
  console.log(`\n${id}`);
  for (const b of bad.sort((p, q) => q.voxels - p.voxels).slice(0, 6)) {
    console.log(`   ${String(b.voxels).padStart(5)} voxels floating, base ${b.base.toFixed(2)}m, ` +
      `centred (${b.at.map((v) => v.toFixed(1)).join(', ')})`);
  }
}
console.log(`\n${floating} of ${ASSETS.length} assets have a detached part off the ground.`);

// ------------------------------------------------------------- flat lids
//
// The other thing that cannot be eyeballed across a library: a roof that is
// one bare plane. A flat-roofed block with nothing on top reads as an
// extrusion of its own plan, and from the angle a city builder is played at,
// the roof is a third of what you see of every building.

console.log('\nFlat roofs with nothing on them:');
let bare = 0;
for (const a of ASSETS) {
  if (a.zone === 'fleet') continue;
  const mesh = a.build(0).build({ occlusion: false });
  const v = mesh.vertices, ix = mesh.indices;
  let top = -Infinity;
  for (let i = 1; i < v.length; i += STRIDE) top = Math.max(top, v[i]);
  if (top < 3) continue;

  // Find the main flat roof: bin every upward-facing triangle's area by
  // height and take the tallest bin holding a real amount of area. A pitched
  // roof has no such bin, which is the point -- a pitch is never a bare lid.
  const bins = new Map();
  const tri = [];
  for (let t = 0; t < ix.length; t += 3) {
    const p = [0, 1, 2].map((k) => {
      const i = ix[t + k] * STRIDE;
      return [v[i], v[i + 1], v[i + 2], v[i + 4]];
    });
    const cy = (p[0][1] + p[1][1] + p[2][1]) / 3;
    tri.push(cy);
    if (p[0][3] < 0.9) continue;
    const ux = p[1][0] - p[0][0], uz = p[1][2] - p[0][2];
    const wx = p[2][0] - p[0][0], wz = p[2][2] - p[0][2];
    const area = Math.abs(ux * wz - uz * wx) / 2;
    const k = Math.round(cy * 4) / 4;
    bins.set(k, (bins.get(k) ?? 0) + area);
  }
  let roofY = null, best = 0;
  for (const [y, area] of bins) {
    // Big enough to be a roof rather than a coping, and high enough to be the
    // building's own top rather than a podium.
    if (area >= 30 && y > top * 0.55 && y >= (roofY ?? -1)) { roofY = y; best = area; }
  }
  if (roofY === null) continue;
  const above = tri.filter((y) => y > roofY + 0.35).length;
  if (above < 24) {
    bare++;
    console.log(`   ${a.id.padEnd(22)} roof at ${roofY.toFixed(1)}m (${Math.round(best)} m2), ` +
      `${above} triangles standing on it`);
  }
}
console.log(`\n${bare} assets have a bare lid.`);
