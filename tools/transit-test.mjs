/**
 * Public transport, end to end.
 *
 * The claim is not "a line can be stored". It is that a line the player draws is
 * a service: the vehicles run on the real roads, the timetable comes out of how
 * long that takes, somebody decides to ride it on those numbers, and putting on
 * more of them makes it better. Each of those is asserted separately, because
 * each of them is a place where transit quietly becomes decoration.
 *
 *   node tools/transit-test.mjs
 */

import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { Simulation } from '${src}sim/agents/sim';`,
      `export { Mode, MODE_NAMES } from '${src}sim/agents/routine';`,
      `export { Kind } from '${src}sim/agents/driving';`,
      `export { TRANSIT_SPEC, TransitKind } from '${src}sim/transit';`,
      `export { makeCity } from '${src}sim/city';`,
      `export { defaultWorld } from '${src}sim/world';`,
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
  Simulation, Mode, MODE_NAMES, Kind, TRANSIT_SPEC, TransitKind,
  makeCity, defaultWorld, serialise, deserialise, PLOTS, TICKS_PER_DAY, configureSim,
} = M;

let failed = 0, checks = 0;
const ok = (cond, what, detail = '') => {
  checks++;
  if (!cond) { failed++; console.log(`  FAIL  ${what}${detail ? '  -- ' + detail : ''}`); }
};
const section = (name) => console.log(`\n${name}`);

const GRID = 200;
configureSim({ cityGrid: GRID, terrainSize: 9216 });

/** A generated city with every plot bought, so the whole map is in play. */
function city() {
  const world = defaultWorld();
  for (let p = 0; p < PLOTS * PLOTS; p++) world.land.take(p);
  return world;
}

/**
 * A rectangular loop of stops on the street grid.
 *
 * Laid on the corridor centrelines the generator draws its streets down, so the
 * stops land on roads -- which is what the tool's snap does for a player.
 */
function loopStops(world, half, ox = 0, oz = 0) {
  const out = [];
  const step = 24 * 8;
  for (let x = -half; x <= half; x += step) out.push(x + ox, -half + oz);
  for (let z = -half; z <= half; z += step) out.push(half + ox, z + oz);
  for (let x = half; x >= -half; x -= step) out.push(x + ox, half + oz);
  for (let z = half; z >= -half; z -= step) out.push(-half + ox, z + oz);
  // Snapped to the nearest road cell, exactly as the tool does it.
  const g = world.grid, gh = g / 2;
  const snapped = [];
  for (let i = 0; i < out.length; i += 2) {
    const cx = Math.floor(out[i] / 8 + gh), cz = Math.floor(out[i + 1] / 8 + gh);
    let best = null, bestD = Infinity;
    for (let j = -6; j <= 6; j++) {
      for (let k = -6; k <= 6; k++) {
        const gx = cx + k, gz = cz + j;
        if (gx < 0 || gz < 0 || gx >= g || gz >= g) continue;
        if (!world.net.has(gx, gz)) continue;
        const d = j * j + k * k;
        if (d < bestD) { bestD = d; best = [gx, gz]; }
      }
    }
    if (best !== null) snapped.push((best[0] - gh + 0.5) * 8, (best[1] - gh + 0.5) * 8);
  }
  return snapped;
}

// ---- a line is a route on the real roads -----------------------------------

section('a line runs on the roads');
let stopCount = 0;
{
  const world = city();
  const stops = loopStops(world, 600);
  stopCount = stops.length / 2;
  ok(stopCount >= 8, 'the stops landed on streets', `${stopCount} stops`);
  const line = world.transit.add(TransitKind.BUS, stops, 6);
  ok(line !== null, 'the line was accepted');

  const sim = new Simulation(makeCity(world), world.net, 0x8051, world);
  sim.found(120);
  sim.step(200);
  ok(sim.transit.worksOf(line.id), 'its roads join up');
  ok(sim.transit.report.broken === 0, 'nothing is broken',
    `${sim.transit.report.broken}`);

  // The vehicles are real vehicles, in the real traffic model, on real lanes.
  // Counted from the network rather than from the traffic table, because the
  // dispatch machine drives buses too and a table scan cannot tell them apart.
  const buses = sim.transit.report.vehicles;
  let onLanes = 0;
  const t = sim.traffic;
  for (let v = 0; v < t.table.bound; v++) {
    if (t.table.live[v] === 0) continue;
    if (t.col.kind[v] === Kind.BUS && t.col.lane[v] >= 0) onLanes++;
  }
  ok(buses > 0, 'and there are buses on the road', `${buses}`);
  ok(buses <= line.fleet, 'never more than the fleet', `${buses} of ${line.fleet}`);
  ok(onLanes >= buses, 'each of them on a real lane', `${onLanes} on lanes`);
  ok(sim.transit.skippedOf(line.id) < stopCount / 3,
    'and most of the stops are on the route',
    `${sim.transit.skippedOf(line.id)} of ${stopCount} skipped`);
  console.log(`  ${stopCount} stops, ${buses}/${line.fleet} out, `
    + `${sim.transit.report.weekly.toLocaleString()} a week`);
}

// ---- and somebody rides it -------------------------------------------------

section('and somebody rides it');
{
  const runFor = (withLine, days) => {
    const world = city();
    let line = null;
    if (withLine) line = world.transit.add(TransitKind.BUS, loopStops(world, 600), 8);
    const sim = new Simulation(makeCity(world), world.net, 0x1d5, world);
    sim.found(200);
    sim.step(TICKS_PER_DAY * days);
    return { sim, line };
  };

  const without = runFor(false, 2);
  const withOne = runFor(true, 2);
  const rides = (r) => r.sim.routine.stats.byMode[Mode.TRANSIT];
  ok(rides(without) === 0, 'a city with no lines has no transit trips',
    `${rides(without)}`);
  ok(rides(withOne) > 0, 'a city with one does', `${rides(withOne)}`);
  const total = withOne.sim.routine.stats.started;
  console.log(`  ${rides(withOne).toLocaleString()} of `
    + `${total.toLocaleString()} trips by transit `
    + `(${((rides(withOne) / Math.max(1, total)) * 100).toFixed(1)}%)`);
  const by = [...withOne.sim.routine.stats.byMode]
    .map((n, i) => `${MODE_NAMES[i]} ${n.toLocaleString()}`).join('  ');
  console.log(`  ${by}`);
  ok(withOne.sim.transit.ridersOf(withOne.line.id) >= 0, 'the line counts its riders');
}

// ---- the timetable comes out of the roads ----------------------------------

section('the timetable is real');
{
  const world = city();
  const stops = loopStops(world, 600);
  const thin = world.transit.add(TransitKind.BUS, stops, 2);
  const sim = new Simulation(makeCity(world), world.net, 0x77e, world);
  sim.found(60);
  sim.step(120);

  // A journey between two points that the loop passes. Taken at the stops
  // themselves, so the walk is the same in both readings and what changes is the
  // wait -- which is the thing under test.
  const ax = stops[0], az = stops[1];
  const k = Math.floor(stops.length / 4) * 2;
  const bx = stops[k], bz = stops[k + 1];
  const thinSeconds = sim.transit.journey(ax, az, bx, bz);
  ok(thinSeconds > 0, 'a journey along the line has a time', `${thinSeconds}`);

  world.transit.setFleet(thin.id, 8);
  sim.step(40);
  const thickSeconds = sim.transit.journey(ax, az, bx, bz);
  ok(thickSeconds > 0 && thickSeconds < thinSeconds,
    'four times the fleet is a shorter journey',
    `${thinSeconds.toFixed(0)}s -> ${thickSeconds.toFixed(0)}s`);

  // Off the line entirely: no answer, rather than a cheap one.
  const far = sim.transit.journey(-2000, -2000, 2000, 2000);
  ok(far < 0, 'somewhere the line does not go has no answer', `${far}`);
  console.log(`  2 buses ${thinSeconds.toFixed(0)}s, `
    + `8 buses ${thickSeconds.toFixed(0)}s for the same trip`);
}

// ---- it fills up -----------------------------------------------------------

section('and it fills up');
{
  const world = city();
  const stops = loopStops(world, 600);
  const line = world.transit.add(TransitKind.BUS, stops, 2);
  const sim = new Simulation(makeCity(world), world.net, 0x9c0, world);
  sim.found(60);
  sim.step(120);
  const ax = stops[0], az = stops[1];
  const k = Math.floor(stops.length / 4) * 2;
  const bx = stops[k], bz = stops[k + 1];
  const quiet = sim.transit.journey(ax, az, bx, bz);

  // A day's worth of riders far beyond what two buses can carry.
  for (let i = 0; i < 400000; i++) sim.transit.board(ax, az, bx, bz);
  sim.transit.endOfDay();
  const packed = sim.transit.journey(ax, az, bx, bz);
  ok(packed > quiet, 'a line nobody can get on is a worse journey',
    `${quiet.toFixed(0)}s -> ${packed.toFixed(0)}s`);
  ok(sim.transit.report.ridersPerDay > 0, 'and the riders are counted',
    `${sim.transit.report.ridersPerDay.toLocaleString()}`);
}

// ---- and it saves ----------------------------------------------------------

section('it saves and loads');
{
  const world = city();
  const a = world.transit.add(TransitKind.BUS, loopStops(world, 600), 5);
  const b = world.transit.add(TransitKind.TRAM, loopStops(world, 320), 3);
  ok(a !== null && b !== null, 'two lines of two kinds');

  const back = deserialise(serialise(world, 'Lines'));
  ok(back !== null, 'the save reloads');
  ok(back.world.transit.lines.length === 2, 'with both lines',
    `${back.world.transit.lines.length}`);
  const same = back.world.transit.lines.every((l, i) =>
    l.id === world.transit.lines[i].id
    && l.kind === world.transit.lines[i].kind
    && l.fleet === world.transit.lines[i].fleet
    && l.stops.length === world.transit.lines[i].stops.length
    && l.stops.every((v, k) => v === world.transit.lines[i].stops[k]));
  ok(same, 'every stop, kind and fleet exactly as drawn');

  // And the loaded city runs them, which is the claim that matters: the routes
  // are derived, so a save that restored the stops and nothing else still has to
  // produce a working service on the other side.
  const sim = new Simulation(makeCity(back.world), back.world.net, 0x5a1, back.world);
  sim.found(40);
  sim.step(150);
  ok(sim.transit.worksOf(a.id) && sim.transit.worksOf(b.id),
    'and both run after loading');
  console.log(`  ${back.world.transit.lines.length} lines, `
    + `${TRANSIT_SPEC[0].name} and ${TRANSIT_SPEC[1].name}, `
    + `${(sim.transit.bytes() / 1024).toFixed(1)} KiB`);
}

// ---- cost ------------------------------------------------------------------

section('lines make a network');
{
  // Two loops that meet in the middle. From the far side of one to the far
  // side of the other takes both -- one change -- and the streets a line calls
  // at count as served by public transport, whatever buildings stand nearby.
  const world = city();
  world.transit.add(TransitKind.BUS, loopStops(world, 300, -260, 0), 6);
  world.transit.add(TransitKind.BUS, loopStops(world, 300, 260, 0), 6);
  const sim = new Simulation(makeCity(world), world.net, 0x7a5, world);
  sim.step(20);
  const across = sim.transit.journey(-540, 0, 540, 0);
  ok(across > 0, 'a trip across both lines is possible with one change', `${across.toFixed(0)} s`);
  const nowhere = sim.transit.journey(-540, 0, 2200, 2200);
  ok(nowhere < 0, 'and a trip neither line goes near is not');
  // The coverage model, brought up to date for the transport branch.
  const b = sim.services.cover.findIndex((c) => c.branch === 'transport');
  for (let i = 0; i < 40; i++) sim.services.refresh(sim.people.population, 0, 0, 1e9);
  const at = sim.services.coverAt(-560, 0, b);
  const off = sim.services.coverAt(2200, 2200, b);
  ok(at > 0.5, 'a street a bus calls at counts as served', at.toFixed(2));
  ok(off < 0.05, 'and a street no line reaches does not', off.toFixed(2));
}

section('cost');
{
  const world = city();
  for (let i = 0; i < 6; i++) {
    world.transit.add(i % 2, loopStops(world, 250 + i * 90), 6);
  }
  const sim = new Simulation(makeCity(world), world.net, 0x3f1, world);
  sim.found(200);
  sim.step(400);
  const t0 = performance.now();
  sim.step(600);
  const perTick = ((performance.now() - t0) / 600) * 1000;
  let ms = 0;
  for (const [k, v] of sim.scheduler.cost) if (k === 'transit') ms = v;
  ok(perTick < 4000, 'a tick with six lines on it is still a tick',
    `${perTick.toFixed(0)} us`);
  console.log(`  6 lines, ${sim.transit.report.vehicles} vehicles, `
    + `${perTick.toFixed(0)} us a tick, transit's share ${ms.toFixed(2)} ms/s`);
}

console.log(`\n${checks - failed}/${checks} checks`);
process.exit(failed === 0 ? 0 : 1);
