/**
 * Growth, checked: a painted district fills in over game days, and only then.
 *
 * The claim this has to prove is not "the mask works". It is that the game loop
 * the mask sits in actually produces a city that grows -- so the test runs that
 * loop, headlessly and whole: growth releases ground, the city is built again over
 * it, and the simulation is reconciled against the result, exactly as `live.ts`
 * does it every frame. Anything less would check the data structure and miss the
 * feature, which is how the mains came to be correctly drawn and invisible.
 *
 * Four things are asserted, and the first is the one that matters:
 *
 *   NOTHING IS BUILT BEFORE IT IS EARNED. Paint a district and the map stays
 *   empty. This is the whole change; if it does not hold, nothing else means
 *   anything.
 *
 *   IT FILLS IN, over days rather than at once, and monotonically.
 *
 *   DEMAND IS THE GATE. Run the same world with the bars held at zero and nothing
 *   comes up at all; hold them high and it does.
 *
 *   IT SURVIVES A SAVE. A city halfway through growing reloads halfway through
 *   growing, rather than as bare zoning or as a finished city.
 *
 *   node tools/growth-test.mjs [days]
 */

import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { Simulation } from '${src}sim/agents/sim';`,
      `export { Growth } from '${src}sim/agents/growth';`,
      `export { Demand, Want } from '${src}sim/agents/demand';`,
      `export { makeCity } from '${src}sim/city';`,
      `export { emptyWorld, paint, zoneCode, zoneIndexOf } from '${src}sim/world';`,
      `export { serialise, deserialise } from '${src}sim/save';`,
      `export { PLOTS } from '${src}sim/plots';`,
      `export { TICKS_PER_DAY } from '${src}sim/agents/calendar';`,
      `export { configureSim } from '${src}sim/config';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022',
})).outputFiles[0].text;

const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));
const {
  Simulation, Growth, Want, makeCity, emptyWorld, paint, zoneCode, zoneIndexOf,
  serialise, deserialise, PLOTS, TICKS_PER_DAY, configureSim,
} = M;

let failed = 0, checks = 0;
const ok = (cond, what, detail = '') => {
  checks++;
  if (!cond) { failed++; console.log(`  FAIL  ${what}${detail ? '  -- ' + detail : ''}`); }
};
const section = (name) => console.log(`\n${name}`);

const GRID = 200;
configureSim({ cityGrid: GRID, terrainSize: 9216 });

/**
 * A small town's worth of site: a crossroads, every plot bought, and the mains in.
 *
 * `emptyWorld` hands back a released mask -- that is what a generated city and
 * every other test want -- so this clears it, which is the one thing that turns
 * growth on and is exactly what `startingWorld` does.
 */
function site() {
  const world = emptyWorld(GRID);
  for (let p = 0; p < PLOTS * PLOTS; p++) world.land.take(p);
  const span = (GRID / 2 - 6) * 8;
  for (let k = -3; k <= 3; k++) {
    world.net.add(-span, k * 120, span, k * 120, 'street');
    world.net.add(k * 120, -span, k * 120, span, 'street');
  }
  world.net.rasterise();
  world.mains.layEverywhere(world.net);
  world.grown.fill(0);
  return world;
}

/** Paints a square of one zone around the middle of the map. */
function zone(world, kind, density, cells) {
  const g0 = Math.floor(GRID / 2 - cells / 2);
  paint(world, g0, g0, cells, cells, zoneCode(kind, density));
}

/** Zoned cells still waiting. */
function waiting(world) {
  let n = 0;
  for (let i = 0; i < world.zones.length; i++) {
    if (world.zones[i] !== 0 && world.grown[i] === 0) n++;
  }
  return n;
}

/**
 * Runs the game loop for a number of game days, as `live.ts` runs it.
 *
 * Returns the housing and job capacity at the end, which is the only honest
 * measure of "buildings appeared": an instance count includes trees.
 */
function play(world, days, onDay) {
  const sim = new Simulation(makeCity(world), world.net, 0x6a0b, world);
  sim.found(6);
  const CHUNK = 32;
  for (let d = 0; d < days; d++) {
    for (let t = 0; t < TICKS_PER_DAY; t += CHUNK) {
      sim.step(CHUNK);
      const grew = sim.grew();
      if (grew !== null) sim.buildingsChanged(makeCity(world, grew));
    }
    onDay?.(d + 1, sim);
  }
  return sim;
}

// ---- the gate --------------------------------------------------------------

section('painted, not built');
{
  const world = site();
  zone(world, 'residential', 'low', 40);
  const painted = waiting(world);
  ok(painted > 900, 'the brush painted a district', `${painted} cells`);

  const sim = new Simulation(makeCity(world), world.net, 0x1, world);
  ok(sim.places.homeCapacity === 0, 'nothing is built on it yet',
    `${sim.places.homeCapacity} homes`);

  // And the mask is the reason, not the roads or the land: release it by hand
  // and the same world builds the same district at once.
  world.grown.fill(1);
  const full = new Simulation(makeCity(world), world.net, 0x1, world);
  ok(full.places.homeCapacity > 200, 'releasing the mask builds it',
    `${full.places.homeCapacity} homes`);
}

// ---- it fills in -----------------------------------------------------------

section('a district fills in');
{
  // Zoned the way a player zones: somewhere to live, somewhere to shop and
  // somewhere to work. A district of nothing but housing genuinely does stall --
  // nobody has a job, so nobody else moves in -- and that is the model working.
  const world = site();
  const g0 = Math.floor(GRID / 2 - 40);
  paint(world, g0, g0, 36, 36, zoneCode('residential', 'low'));
  paint(world, g0 + 40, g0, 24, 36, zoneCode('commercial', 'low'));
  paint(world, g0, g0 + 40, 36, 24, zoneCode('industrial', 'low'));
  const painted = waiting(world);
  const seen = [];
  const sim = play(world, 10, (day, s) => seen.push([day, s.places.homeCapacity]));

  const homes = seen.map((s) => s[1]);
  ok(homes[0] > 0, 'the first day builds something', `${homes[0]} homes`);
  ok(homes[0] < homes[homes.length - 1], 'it keeps building',
    `${homes[0]} -> ${homes[homes.length - 1]}`);
  let fell = 0;
  for (let i = 1; i < homes.length; i++) if (homes[i] < homes[i - 1]) fell++;
  ok(fell === 0, 'and never goes backwards', `${fell} days lost housing`);
  const left = waiting(world);
  ok(left < painted, 'the queue is shorter than it was', `${painted} -> ${left}`);
  ok(left > 0, 'and ten days did not build the whole thing at once', `${left} left`);
  ok(sim.people.population > 0, 'people moved into what was built',
    `${sim.people.population}`);
  console.log(`  ${homes.join(' ')} homes by day`);
  console.log(`  ${sim.people.population} citizens, ${sim.growth.report.patches} patches`);
}

// ---- demand is the gate ----------------------------------------------------

section('demand decides');
{
  // Growth on its own, with the bars held where the test wants them, which is the
  // only way to ask this question without also asking every other one.
  const flat = { want: new Float64Array(4) };
  const world = site();
  zone(world, 'residential', 'low', 30);
  const cold = new Growth(world, flat, () => 5000);
  for (let i = 0; i < 40; i++) cold.grow(1);
  ok(cold.report.patches === 0, 'no demand builds nothing',
    `${cold.report.patches} patches`);

  flat.want[Want.RESIDENTIAL] = 1;
  const warm = new Growth(world, flat, () => 5000);
  warm.grow(1);
  ok(warm.report.patches > 0, 'demand builds', `${warm.report.patches} patches`);

  // The backlog cap: a city that sat idle for forty days must not empty its
  // whole queue on the first visit after the player finally zones something.
  const idle = site();
  const dry = new Growth(idle, flat, () => 5000);
  for (let i = 0; i < 40; i++) dry.grow(1);     // nothing zoned yet
  zone(idle, 'residential', 'low', 30);
  dry.grow(0.01);
  ok(dry.report.patches > 0 && dry.report.patches <= 5,
    'a long wait does not dump the whole backlog', `${dry.report.patches} patches`);

  // And a zone the market does not want stays empty while its neighbour fills.
  const mixed = site();
  const g0 = Math.floor(GRID / 2 - 30);
  paint(mixed, g0, g0, 26, 26, zoneCode('residential', 'low'));
  paint(mixed, g0 + 30, g0, 26, 26, zoneCode('industrial', 'low'));
  const pick = { want: new Float64Array(4) };
  pick.want[Want.RESIDENTIAL] = 1;
  const one = new Growth(mixed, pick, () => 20000);
  for (let i = 0; i < 20; i++) one.grow(1);
  let res = 0, ind = 0;
  for (let i = 0; i < mixed.zones.length; i++) {
    if (mixed.grown[i] === 0) continue;
    const z = zoneIndexOf(mixed.zones[i]);
    if (z === 0) res++; else if (z === 2) ind++;
  }
  ok(res > 100, 'the zone in demand came up', `${res} cells`);
  ok(ind === 0, 'the zone nobody wants did not', `${ind} cells`);
}

// ---- a brand new city is not deadlocked ------------------------------------

section('a new city wants residents');
{
  const world = site();
  zone(world, 'residential', 'low', 20);
  const sim = new Simulation(makeCity(world), world.net, 0x2, world);
  sim.demand.refresh();
  ok(sim.demand.want[Want.RESIDENTIAL] > 0.2,
    'an empty site wants housing, with no jobs to pull anyone',
    `${sim.demand.want[Want.RESIDENTIAL].toFixed(2)}`);
}

// ---- it survives a save ----------------------------------------------------

section('a half-grown city saves and loads');
{
  const world = site();
  zone(world, 'residential', 'medium', 34);
  play(world, 4);
  const before = waiting(world);
  let released = 0;
  for (let i = 0; i < world.grown.length; i++) if (world.grown[i] !== 0) released++;
  ok(before > 0 && released > 0, 'the city is genuinely halfway',
    `${released} released, ${before} waiting`);

  const back = deserialise(serialise(world, 'Halfway'));
  ok(back !== null, 'it reloads');
  let same = 0;
  for (let i = 0; i < world.grown.length; i++) {
    if (back.world.grown[i] === world.grown[i]) same++;
  }
  ok(same === world.grown.length, 'every cell of the mask came back',
    `${world.grown.length - same} wrong`);

  const a = new Simulation(makeCity(world), world.net, 0x3, world);
  const b = new Simulation(makeCity(back.world), back.world.net, 0x3, back.world);
  ok(a.places.homeCapacity === b.places.homeCapacity,
    'and the loaded city is the same city',
    `${a.places.homeCapacity} vs ${b.places.homeCapacity}`);

  // A save written before any of this existed has no mask, and must come back as
  // the finished city its player saved rather than as bare ground.
  const file = JSON.parse(serialise(world, 'Old'));
  delete file.grown;
  const old = deserialise(JSON.stringify(file));
  let releasedOld = 0;
  for (let i = 0; i < old.world.grown.length; i++) if (old.world.grown[i]) releasedOld++;
  ok(releasedOld === old.world.grown.length,
    'an old save loads with everything released', `${releasedOld}`);
}

console.log(`\n${checks - failed}/${checks} checks`);
process.exit(failed === 0 ? 0 : 1);
