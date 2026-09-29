/**
 * Junction control: what the player chooses changes the traffic.
 *
 * A junction's control used to decide only how the drawn cars behaved; the
 * flow model that turns roads red and times every journey never saw it. Now an
 * approach keeps the share of its capacity its junction lets through, and the
 * player can set any junction of three arms or more. Checked here: the rules'
 * choice stands until overridden, an override takes, it moves the load on that
 * junction's approaches the way it should, it can be handed back to the rules,
 * and it survives a save.
 *
 *   node tools/junction-test.mjs
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
      `export { Control } from '${src}sim/agents/junctions';`,
      `export { View } from '${src}sim/agents/views';`,
      `export { serialise, deserialise } from '${src}sim/save';`,
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
const sim = new M.Simulation(M.makeCity(world), world.net, 0x71c);
sim.found(40);
sim.look(0, 0);
// To the morning rush, when the roads carry something to measure.
for (let i = 0; i < 6.36 * M.TICKS_PER_DAY; i++) sim.step(1);

const j = sim.junctions, g = sim.lanes, r = sim.routine;
/** Summed capacity of the lanes arriving at a node, and the load on them. */
const approaches = (node) => {
  let cap = 0, top = 0;
  for (let l = 0; l < g.count; l++) if (g.to[l] === node) top = Math.max(top, g.rank[l]);
  let major = 0, minor = 0, sides = 0;
  for (let l = 0; l < g.count; l++) {
    if (g.to[l] !== node) continue;
    cap += r.capacity[l];
    if (g.rank[l] >= top) major += r.load[l]; else { minor += r.load[l]; sides++; }
  }
  return { cap, major, minor, sides };
};
// The busiest junction the rules left on give way.
let node = -1, best = -1;
for (let n = 0; n < j.count; n++) {
  if (j.armsAt(n) < 3 || j.control[n] !== M.Control.GIVE_WAY) continue;
  const a = approaches(n);
  if (a.sides > 0 && a.major > 0 && a.major + a.minor > best) { best = a.major + a.minor; node = n; }
}
ok(node >= 0, 'the town has a give-way junction to work on', `node ${node}`);

const before = approaches(node);
ok(sim.setJunction(world.net, node, M.Control.SIGNALS) === M.Control.SIGNALS && j.control[node] === M.Control.SIGNALS,
  'a junction can be put on traffic lights');
const lights = approaches(node);
ok(lights.cap < before.cap, 'lights cost the main road its free flow: less capacity on the approaches',
  `${before.cap.toFixed(1)} -> ${lights.cap.toFixed(1)}`);
ok(lights.major > before.major, 'the main road, held at a red light, loads up', `${before.major.toFixed(3)} -> ${lights.major.toFixed(3)}`);
ok(lights.minor <= before.minor, 'while the side road, given a green of its own, does not', `${before.minor.toFixed(3)} -> ${lights.minor.toFixed(3)}`);

sim.setJunction(world.net, node, M.Control.ROUNDABOUT);
const round = approaches(node);
ok(round.cap > lights.cap, 'roundabout rules let more through than lights', `${lights.cap.toFixed(1)} -> ${round.cap.toFixed(1)}`);

sim.setJunction(world.net, node, 0);
ok(j.control[node] === M.Control.GIVE_WAY && Math.abs(approaches(node).cap - before.cap) < 1e-3,
  'and handed back to the rules it is what it was');

// The traffic view names the worst junction and what to try there.
sim.show(M.View.TRAFFIC);
const rows = sim.viewStats;
const worst = rows.find((r) => r.label === 'Most jammed junction');
const tip = rows.find((r) => r.label === 'Try there');
ok(worst !== undefined, 'the traffic view names the most jammed junction', worst ? `${worst.value}; ${tip?.value ?? ''}` : '');

// Two arms: nothing to control.
let two = -1;
for (let n = 0; n < j.count && two < 0; n++) if (j.armsAt(n) === 2) two = n;
if (two >= 0) ok(sim.setJunction(world.net, two, M.Control.SIGNALS) === M.Control.FREE, 'a bend in the road cannot be given lights');

// Kept through a save.
sim.setJunction(world.net, node, M.Control.ROUNDABOUT);
const back = M.deserialise(M.serialise(world, 'junctions'));
ok(back !== null && back.world.net.nodes[node].ctl === M.Control.ROUNDABOUT, 'the choice survives a save',
  `${back?.world.net.nodes[node].ctl}`);
if (back !== null) {
  const sim2 = new M.Simulation(M.makeCity(back.world), back.world.net, 0x71c);
  ok(sim2.junctions.control[node] === M.Control.ROUNDABOUT, 'and a loaded city runs the junction that way');
}

console.log(`\n${checks} checks`);
console.log(failed === 0 ? 'JUNCTION_OK' : `JUNCTION: ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
