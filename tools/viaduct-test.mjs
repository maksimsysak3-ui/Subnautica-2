/**
 * Raised roads: a viaduct passes over what it crosses instead of joining it, a
 * road drawn out of a street at a height ramps up from it, nothing fronts onto
 * the deck, the traffic rides on it, and a save keeps the heights.
 *
 *   node tools/viaduct-test.mjs
 */

import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { RoadGraph, CLEARANCE } from '${src}sim/roadgraph';`,
      `export { buildRoadMesh } from '${src}sim/roadmesh';`,
      `export { buildLaneGraph, deckAt } from '${src}sim/agents/lanes';`,
      `export { baseHeightAt } from '${src}sim/terrain';`,
      `export { defaultWorld } from '${src}sim/world';`,
      `export { serialise, deserialise } from '${src}sim/save';`,
      `export { configureSim, LITE } from '${src}sim/config';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022', loader: { '.wgsl': 'text' },
})).outputFiles[0].text;
const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));

let failed = 0, checks = 0;
const ok = (cond, what, detail = '') => {
  checks++;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${what}${detail ? '  -- ' + detail : ''}`);
  if (!cond) failed++;
};

M.configureSim(M.LITE);

// A street on the ground, and an avenue across it fourteen metres up.
{
  const g = new M.RoadGraph(90);
  g.add(-200, 0, 200, 0, 'street');
  g.add(0, -200, 0, 200, 'avenue', 0, null, 14);
  ok(g.links.length === 2, 'a viaduct across a street does not cut either of them', `${g.links.length} links`);
  ok(g.nodes.filter((n) => n.elev === 14).length === 2,
    'and its two ends stand fourteen metres up');

  // The same crossing on the ground is a junction, as it always was.
  const h = new M.RoadGraph(90);
  h.add(-200, 0, 200, 0, 'street');
  h.add(0, -200, 0, 200, 'avenue');
  ok(h.links.length === 4, 'the same crossing at street level is still a junction', `${h.links.length} links`);

  // Out of the street at a height: the end on the street takes the street's.
  g.add(-200, 0, -200, -200, 'street', 0, null, 14);
  const ramp = g.links[g.links.length - 1];
  const low = Math.min(g.nodes[ramp.a].elev, g.nodes[ramp.b].elev);
  const high = Math.max(g.nodes[ramp.a].elev, g.nodes[ramp.b].elev);
  ok(low === 0 && high === 14, 'a raised road drawn out of a street ramps up from it', `${low} to ${high}`);

  // Nothing fronts onto the deck.
  g.rasterise();
  const fronts = g.frontages().map((f) => f.link);
  const deck = g.links.findIndex((l) => g.nodes[l.a].elev === 14 && g.nodes[l.b].elev === 14);
  ok(deck >= 0 && !fronts.includes(deck), 'no building fronts onto the viaduct');
  ok(fronts.includes(0), 'while the street under it keeps its frontage');

  // The mesh leaves the ground alone under the deck and puts piers down.
  const mesh = M.buildRoadMesh(g, M.baseHeightAt, false);
  let under = 0;
  for (const p of mesh.pins) {
    const x = (p.gx - 45) * 8, z = (p.gz - 45) * 8;
    if (Math.abs(x) < 4 && Math.abs(z) > 60 && Math.abs(z) < 140 && p.y > M.baseHeightAt(x, z) + 5) under++;
  }
  ok(under === 0, 'the ground is not held up to the deck under the span', `${under} raised pins`);
  let tall = 0;
  const v = mesh.vertices;
  for (let i = 0; i < v.length; i += 14) {
    if (v[i + 9] === 15 && v[i + 1] < M.baseHeightAt(v[i], v[i + 2]) + 0.5) tall++;
  }
  ok(tall > 0, 'and it stands on piers that reach the ground', `${tall} pier vertices near the ground`);

  // Traffic on the deck rides at the deck's height.
  const lanes = M.buildLaneGraph(g);
  let raised = 0, grounded = 0;
  for (let l = 0; l < lanes.count; l++) {
    const y = M.deckAt(lanes, l, lanes.length[l] / 2);
    if (Number.isNaN(y)) grounded++;
    else if (y > M.baseHeightAt((lanes.ax[l] + lanes.bx[l]) / 2, (lanes.az[l] + lanes.bz[l]) / 2) + 10) raised++;
  }
  ok(raised > 0 && grounded > 0, 'lanes on the deck know its height, lanes on the street do not',
    `${raised} raised, ${grounded} on the ground`);
}

// A save keeps the heights.
{
  const w = M.defaultWorld();
  w.net.add(-150, -150, -150, 150, 'avenue', 0, null, 20);
  const before = w.net.nodes.filter((n) => n.elev === 20).length;
  const back = M.deserialise(M.serialise(w, 'viaduct'));
  const after = back?.world.net.nodes.filter((n) => n.elev === 20).length ?? -1;
  ok(before === 2 && after === before, 'a save keeps a viaduct at its height', `${before} -> ${after}`);
}

console.log(`\n${failed === 0 ? 'VIADUCT_OK' : 'VIADUCT_FAIL'}  ${checks - failed}/${checks} checks`);
process.exit(failed === 0 ? 0 : 1);
