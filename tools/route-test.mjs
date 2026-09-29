/**
 * The route view: click a road, see where the people on it are going.
 *
 * Checked here: a busy road can be picked, the reading finds people on it, the
 * roads lit are the whole routes of those people (so more than the road
 * itself), the card leads with the count and says what to try, empty ground
 * clears the pick, a road rebuild keeps it, and the load on every lane goes
 * back to nothing once everybody has arrived -- the road space an arrival held
 * is given back once, not twice.
 *
 *   node tools/route-test.mjs
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
      `export { View } from '${src}sim/agents/views';`,
      `export { Use } from '${src}sim/agents/lanes';`,
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
const sim = new M.Simulation(M.makeCity(world), world.net, 0x2047);
sim.found(40);
sim.look(0, 0);
// The morning rush.
for (let i = 0; i < 6.36 * M.TICKS_PER_DAY; i++) sim.step(1);

const g = sim.lanes, load = sim.routine.load;
let busiest = -1;
for (let l = 0; l < g.count; l++) {
  if ((g.use[l] & M.Use.CAR) === 0) continue;
  if (busiest < 0 || load[l] > load[busiest]) busiest = l;
}
ok(busiest >= 0 && load[busiest] > 0, 'the town has a loaded road at rush hour', `${Math.round(load[busiest] * 100)}%`);
const mx = (g.ax[busiest] + g.bx[busiest]) / 2, mz = (g.az[busiest] + g.bz[busiest]) / 2;

sim.show(M.View.TRAFFIC);
const plain = sim.viewStats;
ok(plain.some((r) => r.label === 'Click a road'), 'the traffic card says a road can be clicked');

ok(sim.views.pickRoute(mx, mz, 7), 'a click on it picks it');
sim.show(M.View.TRAFFIC);
const r = sim.views.route;
ok(r !== null && r.travellers > 0, 'people are found on it', r ? `${Math.round(r.travellers)} travellers` : '');
const lit = sim.viewGrid.reduce((n, v) => n + (v > 0 ? 1 : 0), 0);
let own = 0;
for (let l = 0; l < g.count; l++) if (g.link[l] === g.link[busiest]) own++;
ok(lit > 20, 'their whole routes are drawn, not only the picked road', `${lit} cells lit`);
const rows = sim.viewStats;
const hero = rows.find((x) => x.hero);
ok(hero?.label === 'travelling along this road', 'the card leads with how many', hero ? `${hero.value}` : '');
const tip = rows.find((x) => x.label === 'Try');
ok(tip !== undefined && tip.value.length > 10, 'and says what would help', tip?.value ?? '');
const through = rows.find((x) => x.label === 'Passing through');
const local = rows.find((x) => x.label === 'Starting or stopping nearby');
ok(through !== undefined && local !== undefined
  && Math.abs(parseInt(through.value) + parseInt(local.value) - 100) <= 1,
'through and local traffic add up', `${through?.value} + ${local?.value}`);

// Kept across more of the day as the numbers move.
for (let i = 0; i < 0.02 * M.TICKS_PER_DAY; i++) sim.step(1);
ok(sim.views.routing, 'the pick stays as the day goes on');

ok(!sim.views.pickRoute(1e5, 1e5, 7) && !sim.views.routing, 'a click on empty ground clears it');
sim.show(M.View.TRAFFIC);
ok(sim.viewStats.some((x) => x.label === 'Click a road'), 'and the card is the whole city again');

// The road space on every lane is exactly what the people routed over it
// hold -- no more, and no less. Arrivals used to hand theirs back twice, and
// the clamp at zero hid it by emptying lanes others were still on.
for (let i = 0; i < 0.3 * M.TICKS_PER_DAY; i++) sim.step(1);
const all = new Uint8Array(g.count).fill(1);
const held = new Float32Array(g.count);
sim.routine.through(all, held, 0, 0, 0);
const w = sim.routine.sampleWeight, onLane = sim.routine.onLane;
let off = 0, worst = 0, busy = 0;
for (let l = 0; l < g.count; l++) {
  const want = held[l] / w;
  if (want > 0) busy++;
  const d = Math.abs(onLane[l] - want);
  if (d > 1e-3) { off++; worst = Math.max(worst, d); }
}
ok(busy > 0 && off === 0, 'every lane carries exactly the road space routed over it',
  `${busy} lanes in use, ${off} off by up to ${worst.toFixed(3)}`);

console.log(`\n${checks} checks`);
console.log(failed === 0 ? 'ROUTE_OK' : `ROUTE: ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
