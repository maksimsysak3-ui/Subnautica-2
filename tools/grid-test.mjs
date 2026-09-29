/**
 * Road topology: a dragged grid, and the joins every road tool relies on.
 *
 * What a player sees go wrong is quiet in the data: two streets lying across
 * each other with no junction, a street laid on top of one already there, a
 * stub of road left past a T, or a straight that bends because it started at
 * a dead end. Each is checked here against the real road graph.
 *
 *   node tools/grid-test.mjs
 */
import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { RoadGraph } from '${src}sim/roadgraph';`,
      `export { configureSim } from '${src}sim/config';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022', loader: { '.wgsl': 'text' },
})).outputFiles[0].text;
const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));
M.configureSim({ cityGrid: 400 });

let failed = 0, checks = 0;
const ok = (cond, what, detail = '') => {
  checks++;
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${what}${detail ? '  -- ' + detail : ''}`);
};

/** Straight links only, which is everything these tests lay. */
const seg = (g, l) => [g.nodes[l.a], g.nodes[l.b]];
const cross = (p, q, r, s) => {
  const rx = q.x - p.x, rz = q.z - p.z, sx = s.x - r.x, sz = s.z - r.z;
  const d = rx * sz - rz * sx;
  if (Math.abs(d) < 1e-9) return null;
  const t = ((r.x - p.x) * sz - (r.z - p.z) * sx) / d, u = ((r.x - p.x) * rz - (r.z - p.z) * rx) / d;
  return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999 ? [t, u] : null;
};
/** Links that cross mid-span with no node between them. */
function unjoined(g) {
  const live = g.links;
  let n = 0;
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      if (a.a === b.a || a.a === b.b || a.b === b.a || a.b === b.b) continue;
      const [p, q] = seg(g, a), [r, s] = seg(g, b);
      if (cross(p, q, r, s) !== null) n++;
    }
  }
  return n;
}
/** Pairs of links lying along each other: a stretch of one within a metre of the other's middle. */
function overlapping(g) {
  let n = 0;
  for (let i = 0; i < g.links.length; i++) {
    for (let j = 0; j < g.links.length; j++) {
      if (i === j) continue;
      const [p, q] = seg(g, g.links[i]);
      const mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2;
      const [r, s] = seg(g, g.links[j]);
      const dx = s.x - r.x, dz = s.z - r.z, len2 = dx * dx + dz * dz || 1;
      const f = ((mx - r.x) * dx + (mz - r.z) * dz) / len2;
      if (f <= 0.02 || f >= 0.98) continue;
      if (Math.hypot(r.x + dx * f - mx, r.z + dz * f - mz) < 1) { n++; break; }
    }
  }
  return n;
}
const degree = (g, x, z) => {
  const node = g.nodes.findIndex((n) => Math.hypot(n.x - x, n.z - z) < 1.5 && g.links.some((l) => l.a === g.nodes.indexOf(n) || l.b === g.nodes.indexOf(n)));
  if (node < 0) return 0;
  return g.links.filter((l) => l.a === node || l.b === node).length;
};

/** The grid tool's rule: block edges, node to node, skipping stretches already built. */
function layGrid(g, x0, z0, nx, nz, B = 96) {
  let kept = 0;
  const add = (ax, az, bx, bz) => {
    if (g.covered(ax, az, bx, bz)) { kept++; return; }
    g.add(ax, az, bx, bz, 'street', 0, null, 0, true);
  };
  for (let j = 0; j <= nz; j++) for (let i = 0; i < nx; i++) add(x0 + i * B, z0 + j * B, x0 + (i + 1) * B, z0 + j * B);
  for (let i = 0; i <= nx; i++) for (let j = 0; j < nz; j++) add(x0 + i * B, z0 + j * B, x0 + i * B, z0 + (j + 1) * B);
  return kept;
}

{
  const g = new M.RoadGraph(400);
  layGrid(g, -300, -200, 4, 3);
  ok(unjoined(g) === 0, 'a dragged grid has a junction wherever two streets cross', `${unjoined(g)} crossings without one`);
  ok(overlapping(g) === 0, 'and no street lying on another', `${overlapping(g)}`);
  ok(g.links.length === 4 * 4 + 5 * 3, 'one link per block edge', `${g.links.length}`);
  ok(degree(g, -300, -200) === 2 && degree(g, -204, -200) === 3 && degree(g, -204, -104) === 4,
    'corners, edges and middles meet 2, 3 and 4 ways');
  ok(g.links.every((l) => { const [p, q] = seg(g, l); const mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2; return Math.hypot(l.cx - mx, l.cz - mz) < 1e-6; }),
    'and every street in it is straight');
}

{
  // A grid dragged over a street that is already there, and across another.
  const g = new M.RoadGraph(400);
  g.add(-500, -200, 300, -200, 'avenue', 0, null, 0, true);       // along the grid's first row
  g.add(-100, -600, -100, 400, 'street', 0, null, 0, true);       // through it, off the lattice
  const kept = layGrid(g, -300, -200, 3, 2);
  g.rasterise();
  ok(kept === 3, 'a grid over an existing street keeps it rather than laying a second', `${kept} kept`);
  ok(overlapping(g) === 0, 'so nothing lies on top of anything', `${overlapping(g)}`);
  ok(unjoined(g) === 0, 'and the street it crosses gets junctions', `${unjoined(g)} without`);
}

{
  // A long road crossed a few metres from its end: two per cent of 900 m is 18 m.
  const g = new M.RoadGraph(400);
  g.add(-450, 0, 450, 0, 'street', 0, null, 0, true);
  g.add(440, -100, 440, 100, 'street', 0, null, 0, true);
  ok(unjoined(g) === 0, 'a road crossed ten metres from its end still gets a junction', `${unjoined(g)}`);
}

{
  // A road that overshoots another by three metres: a T, not a crossroads with a stub.
  const g = new M.RoadGraph(400);
  g.add(-300, 0, 300, 0, 'street', 0, null, 0, true);
  g.add(0, -200, 0, 3, 'street', 0, null, 0, true);
  const stubs = g.links.filter((l) => { const [p, q] = seg(g, l); return Math.hypot(q.x - p.x, q.z - p.z) < 8; }).length;
  ok(unjoined(g) === 0 && stubs === 0 && degree(g, 0, 0) === 3, 'a road ending just past another makes a clean T', `${stubs} stubs, degree ${degree(g, 0, 0)}`);
  // And one that stops four metres short.
  const h = new M.RoadGraph(400);
  h.add(-300, 0, 300, 0, 'street', 0, null, 0, true);
  h.add(0, -200, 0, -4, 'street', 0, null, 0, true);
  ok(degree(h, 0, 0) === 3, 'and one stopping just short joins it too', `degree ${degree(h, 0, 0)}`);
}

{
  // A straight started at a dead end must not bend to follow it.
  const g = new M.RoadGraph(400);
  g.add(-300, 0, 0, 0, 'street', 0, null, 0, true);
  g.add(0, 0, 0, 250, 'street', 0, null, 0, true);
  const l = g.links[g.links.length - 1];
  const [p, q] = seg(g, l);
  ok(Math.hypot(l.cx - (p.x + q.x) / 2, l.cz - (p.z + q.z) / 2) < 1e-6, 'a straight chained off a dead end stays straight');
}

console.log(`\n${checks} checks`);
console.log(failed === 0 ? 'GRID_OK' : `GRID: ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
