/**
 * Finds elevations with nothing on them.
 *
 * A building generator is written elevation by elevation, and the ones that
 * face the street get the attention. The end wall of a wing, the back of a
 * courtyard range, the flank of a podium -- those get written once as a box
 * and never come back, and the result is a four-storey blank slab that reads
 * as unfinished from wherever the spawner happens to face the asset. Nothing
 * else catches it: the mesh is closed, it fits its lot, it is inside budget.
 * It just has no windows in it.
 *
 * So this measures it. Every near-vertical triangle is filed under the wall
 * plane it lies in, glazing is snapped onto the wall it belongs to rather than
 * counted as a plane of its own, and any plane with a wall of the opposite
 * facing pressed against it is dropped -- that is two solids meeting, and the
 * faces inside the joint are never seen.
 *
 *   node tools/blank-walls.mjs [id-substring]
 */

import * as esbuild from 'esbuild';

const STRIDE = 13;
/** Openings. Glass, panes and shopfronts are what makes an elevation read. */
const GLAZING = new Set([2, 6, 13, 24]);
/**
 * Materials that draw their own windows.
 *
 * The shaded variants carry the openings in the surface rather than modelling
 * them, so a wall in one of these is never blank however little stands on it.
 */
const SELF_GLAZED = new Set([1, 9, 10]);
/** Surfaces that are not building walls, and are not expected to be glazed. */
const NOT_WALL = new Set([0, 7, 8, 14, 19, 20, 21, 25, 26, 27, 28, 29, 30]);
/** Below this an elevation is a detail, not a facade. */
const MIN_AREA = 45;
/** Glazing as a fraction of the plane's area, under which it reads as blank. */
const MIN_RATIO = 0.03;
/** Wall planes closer together than this are the same elevation. */
const MERGE = 0.4;
/** How far in front of its wall a pane may sit and still belong to it. */
const REACH = 0.9;
/** Two opposed walls this close are a joint between solids: never seen. */
const JOINT = 0.15;

const src = new URL('../src/assets/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: { contents: `export { ASSETS } from '${src}registry';`, resolveDir: src, loader: 'ts' },
  bundle: true, format: 'esm', write: false, target: 'es2022',
})).outputFiles[0].text;
const { ASSETS } = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));

/** The plane a vertical triangle lies in, or null if it is not one. */
function facet(v, ix, t) {
  const p = [0, 1, 2].map((k) => ix[t + k] * STRIDE);
  const mat = v[p[0] + 6];
  const P = p.map((o) => [v[o], v[o + 1], v[o + 2]]);
  const ux = P[1][0] - P[0][0], uy = P[1][1] - P[0][1], uz = P[1][2] - P[0][2];
  const wx = P[2][0] - P[0][0], wy = P[2][1] - P[0][1], wz = P[2][2] - P[0][2];
  const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-9 || Math.abs(ny / len) > 0.35) return null;
  const axis = Math.abs(nx) > Math.abs(nz) ? 0 : 2;
  return {
    mat, area: len / 2, axis,
    sign: (axis === 0 ? nx : nz) > 0 ? 1 : -1,
    plane: (P[0][axis] + P[1][axis] + P[2][axis]) / 3,
    lo: Math.min(...P.map((q) => q[2 - axis])), hi: Math.max(...P.map((q) => q[2 - axis])),
    y0: Math.min(...P.map((q) => q[1])), y1: Math.max(...P.map((q) => q[1])),
  };
}

const filter = process.argv[2];
let blank = 0, worst = [];

for (const a of ASSETS) {
  if (filter && !a.id.includes(filter)) continue;
  if (a.zone === 'fleet' || a.zone === 'road') continue;
  const mesh = a.build(0).build();
  const v = mesh.vertices, ix = mesh.indices;

  const walls = [], panes = [];
  for (let t = 0; t < ix.length; t += 3) {
    const f = facet(v, ix, t);
    if (f === null || NOT_WALL.has(f.mat)) continue;
    (GLAZING.has(f.mat) ? panes : walls).push(f);
  }

  // Wall facets gathered into elevations: same axis, same facing, and within
  // a hand's breadth of the same plane. Sorted first so a run of near-equal
  // planes joins one elevation rather than seeding several.
  walls.sort((p, q) => p.axis - q.axis || p.sign - q.sign || p.plane - q.plane);
  const planes = [];
  for (const f of walls) {
    const last = planes[planes.length - 1];
    // Measured against the plane the cluster started at, not the one before
    // it. Chaining off the previous facet walks a whole elevation's worth of
    // slightly different planes into one, and the merged plane then swallows
    // the glazed frontage next to it.
    if (last && last.axis === f.axis && last.sign === f.sign && f.plane - last.anchor < MERGE) {
      last.area += f.area; last.self += SELF_GLAZED.has(f.mat) ? f.area : 0;
      last.lo = Math.min(last.lo, f.lo); last.hi = Math.max(last.hi, f.hi);
      last.y0 = Math.min(last.y0, f.y0); last.y1 = Math.max(last.y1, f.y1);
    } else {
      planes.push({ axis: f.axis, sign: f.sign, plane: f.plane, anchor: f.plane, area: f.area,
        self: SELF_GLAZED.has(f.mat) ? f.area : 0, glass: 0,
        lo: f.lo, hi: f.hi, y0: f.y0, y1: f.y1 });
    }
  }

  // Glazing joins the elevation it stands in front of, wherever the generator
  // chose to float it. A pane is emitted a centimetre proud of its wall and a
  // shopfront rather more, and counting either as a plane of its own is what
  // made a fully glazed frontage read as two blank ones.
  for (const g of panes) {
    let best = null, near = REACH;
    for (const p of planes) {
      if (p.axis !== g.axis || p.sign !== g.sign) continue;
      const d = (g.plane - p.plane) * g.sign;
      if (d > -0.25 && d < near) { near = d; best = p; }
    }
    if (best) best.glass += g.area;
  }

  const bad = [];
  for (const p of planes) {
    if (p.area < MIN_AREA) continue;
    if (p.self > p.area * 0.5) continue;
    if (p.glass >= p.area * MIN_RATIO) continue;
    // A face with another wall facing straight back at it is a joint between
    // two solids, and neither side of it is ever seen.
    if (planes.some((q) => q.axis === p.axis && q.sign === -p.sign
      && Math.abs(q.plane - p.plane) < JOINT && q.area > p.area * 0.4)) continue;
    bad.push({ p, s: `${p.axis === 0 ? 'x' : 'z'}${p.sign > 0 ? '+' : '-'}${p.plane.toFixed(1)}` +
      ` ${p.area.toFixed(0)}m2 ${(p.hi - p.lo).toFixed(0)}x${(p.y1 - p.y0).toFixed(0)}m` });
  }
  if (bad.length) {
    blank += bad.length;
    const sum = bad.reduce((s, b) => s + b.p.area, 0);
    worst.push([a.id, sum]);
    console.log(`${a.id.padEnd(26)} ${bad.map((b) => b.s).join('  |  ')}`);
  }
}
worst.sort((x, y) => y[1] - x[1]);
console.log(`\n${blank} blank elevation(s). Worst:`);
for (const [id, m2] of worst.slice(0, 20)) console.log(`  ${id.padEnd(26)} ${m2.toFixed(0)}m2`);
