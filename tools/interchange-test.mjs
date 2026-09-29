/**
 * Ready-made interchanges: each one builds, joins where it should, passes
 * over where it should, and can be driven through in every direction.
 *
 * For every template and every quarter turn: the bridge of a diamond stands
 * clear of the motorway (its deck junction has two arms, not four), the slip
 * roads meet their roads at junctions, and a car can get from every loose end
 * to every other loose end on the lane graph -- which is what "the exits work"
 * means once the one-way slip roads are in.
 *
 *   node tools/interchange-test.mjs
 */
import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export * from '${src}sim/interchanges';`,
      `export { RoadGraph } from '${src}sim/roadgraph';`,
      `export { buildLaneGraph, Use } from '${src}sim/agents/lanes';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022', loader: { '.wgsl': 'text' },
})).outputFiles[0].text;
const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));

let failed = 0, checks = 0;
const ok = (cond, what, detail = '') => {
  checks++;
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${what}${detail ? '  -- ' + detail : ''}`);
};

for (const t of M.INTERCHANGES) {
  for (const yaw of [0, 1, 2, 3]) {
    const net = new M.RoadGraph(400);
    const ctl = M.layInterchange(net, t, 120, -80, yaw);
    const arms = new Map();
    for (const l of net.links) { arms.set(l.a, (arms.get(l.a) ?? 0) + 1); arms.set(l.b, (arms.get(l.b) ?? 0) + 1); }
    const ends = [...arms].filter(([, n]) => n === 1).map(([i]) => i);
    const g = M.buildLaneGraph(net);
    // Car lanes leaving and reaching each loose end.
    const car = (l) => (g.use[l] & M.Use.CAR) !== 0;
    const from = (node) => { const o = []; for (let l = 0; l < g.count; l++) if (car(l) && g.from[l] === node) o.push(l); return o; };
    const into = (node) => { const o = new Set(); for (let l = 0; l < g.count; l++) if (car(l) && g.to[l] === node) o.add(l); return o; };
    let pairs = 0, reached = 0;
    const missing = [];
    for (const a of ends) {
      const seen = new Uint8Array(g.count);
      const stack = from(a);
      for (const l of stack) seen[l] = 1;
      while (stack.length > 0) {
        const l = stack.pop();
        for (let e = g.edgeStart[l]; e < g.edgeEnd[l]; e++) {
          const o = g.edgeTo[e];
          if (!car(o) || seen[o] === 1) continue;
          seen[o] = 1; stack.push(o);
        }
      }
      for (const b of ends) {
        if (a === b) continue;
        pairs++;
        if ([...into(b)].some((l) => seen[l] === 1)) reached++; else missing.push(`${a}->${b}`);
      }
    }
    const label = `${t.id}, turned ${yaw * 90} degrees`;
    ok(ends.length >= 4 && pairs > 0 && reached === pairs, `${label}: every loose end reaches every other`,
      `${reached}/${pairs}${missing.length ? ' missing ' + missing.slice(0, 4).join(' ') : ''}`);
    ok(ctl.length === (t.controls ?? []).length, `${label}: its junction controls land on junctions`, `${ctl.length}`);
    if (t.id === 'diamond') {
      const deck = net.nodes.findIndex((n) => !n.dead && n.elev > 0);
      ok(deck >= 0 && arms.get(deck) === 2, `${label}: the bridge passes over the motorway rather than joining it`,
        `deck junction has ${arms.get(deck)} arms`);
    }
  }
}

console.log(`\n${checks} checks`);
console.log(failed === 0 ? 'INTERCHANGE_OK' : `INTERCHANGE: ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
