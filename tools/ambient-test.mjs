/**
 * The traffic and the people on screen are going somewhere.
 *
 * Checked here: ambient cars are given a route by a real search and most
 * searches succeed; cars reach the building they set out for and come off the
 * road there; people on the pavements leave one building for another, walk a
 * planned route, and go in at the far door; and a carriageway with more
 * painted lanes carries more before it fills. Plus the cost: a tick with all
 * of this in it stays cheap.
 *
 *   node tools/ambient-test.mjs
 */
import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { Simulation } from '${src}sim/agents/sim';`,
      `export { makeCity } from '${src}sim/city';`,
      `export { defaultWorld } from '${src}sim/world';`,
      `export { configureSim } from '${src}sim/config';`,
      `export { TICKS_PER_DAY } from '${src}sim/agents/calendar';`,
      `export { RoadGraph } from '${src}sim/roadgraph';`,
      `export { buildLaneGraph } from '${src}sim/agents/lanes';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022', loader: { '.wgsl': 'text' },
})).outputFiles[0].text;
const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));
M.configureSim({ cityGrid: 200, terrainSize: 9216 });

let failed = 0, checks = 0;
const ok = (cond, what, detail = '') => {
  checks++;
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${what}${detail ? '  -- ' + detail : ''}`);
};

const world = M.defaultWorld();
const sim = new M.Simulation(M.makeCity(world), world.net, 0x5eed);
sim.found(40);
sim.look(0, 0);
for (let i = 0; i < 6.3 * M.TICKS_PER_DAY; i++) sim.step(1);
const t0 = sim.traffic.stats.parked, w0 = sim.strollers.arrived;
const s0 = sim.traffic.planning;
let slow = 0, ticks = 0;
for (let i = 0; i < 0.25 * M.TICKS_PER_DAY; i++) {
  const a = performance.now();
  sim.step(1);
  if (performance.now() - a > 4) slow++;
  ticks++;
}
const p = sim.traffic.planning;
const searched = p.searched - s0.searched, found = p.found - s0.found;
ok(searched > 20, 'ambient cars are routed by a real search', `${searched} searches`);
ok(found > searched * 0.7, 'and most searches find a way', `${found} of ${searched}`);
ok(p.active > 0, 'cars are driving planned routes right now', `${p.active}`);
const parked = sim.traffic.stats.parked - t0;
ok(parked > 10, 'cars reach where they were going and leave the road', `${parked} in a quarter day`);
// Walking is slow next to the clock -- a quarter day is twenty seconds of
// somebody's stroll -- so the pavements are given longer.
for (let i = 0; i < 1.5 * M.TICKS_PER_DAY; i++) sim.step(1);
const walked = sim.strollers.arrived - w0;
ok(sim.strollers.count > 0 && sim.strollers.headed > sim.strollers.count * 0.5,
  'most people on the pavements are walking to a door', `${sim.strollers.headed} of ${sim.strollers.count}`);
ok(walked > 5, 'and they go in when they get there', `${walked} in a day and three quarters`);
ok(slow < ticks * 0.05, 'a tick with all of this in it stays cheap', `${slow} of ${ticks} over 4 ms`);

// Wider carriageways carry more.
const net = new M.RoadGraph(400);
net.add(-300, 0, 300, 0, 'expressway', 0, null, 0, true);
net.add(-300, 200, 300, 200, 'motorway', 0, null, 0, true);
net.add(-300, 400, 300, 400, 'superhighway', 0, null, 0, true);
const g = M.buildLaneGraph(net);
const wideOf = (link) => { for (let l = 0; l < g.count; l++) if (g.link[l] === link) return g.wide[l]; return 0; };
ok(wideOf(0) === 1 && wideOf(1) === 1.5 && wideOf(2) === 2,
  'each routing lane stands for its share of the painted lanes', `2 / 3 / 4 lanes -> ${wideOf(0)} / ${wideOf(1)} / ${wideOf(2)}`);

console.log(`\n${checks} checks`);
console.log(failed === 0 ? 'AMBIENT_OK' : `AMBIENT: ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
