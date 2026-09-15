/**
 * Services and utilities, checked.
 *
 * Two kinds of claim here and they need different kinds of proof.
 *
 * The mechanisms are exact and are asserted exactly: that two districts joined by a
 * street share a power grid and two that are not do not; that a pump inland pumps
 * nothing and one on the river pumps; that coverage follows the roads rather than a
 * radius, which is checked by putting a station where the crow could fly to a
 * district but a fire engine cannot.
 *
 * Whether the services are a *necessity* is a claim about the whole simulation, so
 * it is proved the only way such a claim can be: run the same city twice, once with
 * the power on and once without, and show that the one without empties.
 *
 *   node tools/service-test.mjs [days] [grid]
 */

import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { Simulation } from '${src}sim/agents/sim';`,
      `export * from '${src}sim/agents/utilities';`,
      `export * from '${src}sim/agents/services';`,
      `export * from '${src}sim/agents/views';`,
      `export { Purpose, Teaches } from '${src}sim/agents/places';`,
      `export { Stage } from '${src}sim/agents/people';`,
      `export { makeCity, INSTANCE_FLOATS } from '${src}sim/city';`,
      `export { defaultWorld, emptyWorld, paint, placeLot, ZONES } from '${src}sim/world';`,
      `export { RoadGraph } from '${src}sim/roadgraph';`,
      `export { ASSETS } from '${src}assets/registry';`,
      `export { BRANCHES } from '${src}assets/types';`,
      `export { TICKS_PER_DAY } from '${src}sim/agents/calendar';`,
      `export { configureSim, simConfig } from '${src}sim/config';`,
      `export { waterAt } from '${src}sim/river';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022',
})).outputFiles[0].text;

const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));
const {
  Simulation, Utilities, Util, UTIL_NAMES, supplyOf, producerIds,
  Services, UNREACHED, Views, View, VIEWS, VIEW_GRID, Look, NO_DATA,
  Purpose, Stage, makeCity, INSTANCE_FLOATS, defaultWorld, RoadGraph,
  ASSETS, BRANCHES, TICKS_PER_DAY, configureSim, waterAt,
} = M;

let failed = 0, checks = 0;
const ok = (cond, what, detail = '') => {
  checks++;
  if (!cond) { failed++; console.log(`  FAIL  ${what}${detail ? '  -- ' + detail : ''}`); }
};
const section = (name) => console.log(`\n${name}`);
const pct = (x) => `${(x * 100).toFixed(0)}%`;

// ---- the supply table has to cover the library -----------------------------

section('the supply table');
{
  const producers = producerIds();
  const missing = producers.filter((id) => supplyOf(id) === undefined);
  console.log(`  power and water assets  ${producers.length}`);
  ok(missing.length === 0,
    'every power and water building is accounted for in the supply table',
    missing.join(' '));
  // And at least one of each thing a city cannot do without.
  const makes = (key) => producers.filter((id) => (supplyOf(id) ?? {})[key] > 0).length;
  ok(makes('power') > 0, 'something generates electricity', `${makes('power')}`);
  ok(makes('water') > 0, 'something pumps water', `${makes('water')}`);
  ok(makes('sewage') > 0, 'something treats sewage', `${makes('sewage')}`);
  const rubbish = ASSETS.filter((a) => (supplyOf(a.id) ?? {}).rubbish > 0).length;
  ok(rubbish > 0, 'something deals with rubbish', `${rubbish}`);
  console.log(`  producers               `
    + `${makes('power')} generate, ${makes('water')} pump, `
    + `${makes('sewage')} treat sewage, ${rubbish} take rubbish`);
}

// ---- the grid is the road network -----------------------------------------

section('networks');
{
  // Two districts, deliberately not joined. `add` snaps endpoints within eleven
  // metres, so they are laid a long way apart.
  const net = new RoadGraph(200);
  net.add(-700, -400, -300, -400, 'street', 0);
  net.add(-500, -400, -500, -100, 'street', 0);
  net.add(400, 300, 800, 300, 'street', 0);
  net.add(600, 300, 600, 600, 'street', 0);

  const world = defaultWorld();
  const city = makeCity(world);
  const sim = new Simulation(city, net, 0x5e12);
  const u = sim.utilities;

  console.log(`  two districts           ${u.networks.length} networks`);
  ok(u.networks.length >= 2, 'two unjoined districts are two networks',
    `${u.networks.length}`);

  // Join them, and they become one.
  net.add(-300, -400, 400, 300, 'street', 0);
  sim.roadsChanged(net);
  const after = sim.utilities.networks.length;
  console.log(`  joined by one street    ${after} networks`);
  ok(after < u.networks.length || after === 1,
    'joining them joins their grids', `${after}`);
}

// ---- a pump has to stand on water -----------------------------------------

section('water has to come from somewhere');
{
  const world = defaultWorld();
  // Find the river, and a point well away from it.
  let onWater = null, inland = null;
  for (let r = 0; r < 4000 && (onWater === null || inland === null); r++) {
    const x = (r * 137) % 2400 - 1200, z = (r * 311) % 2400 - 1200;
    if (waterAt(x, z) !== null) { if (onWater === null) onWater = [x, z]; }
    else if (inland === null) {
      // Properly inland: nothing wet within a hundred metres.
      let wet = false;
      for (let k = 0; k < 8 && !wet; k++) {
        const a = (k / 8) * Math.PI * 2;
        if (waterAt(x + Math.cos(a) * 100, z + Math.sin(a) * 100) !== null) wet = true;
      }
      if (!wet) inland = [x, z];
    }
  }
  ok(onWater !== null, 'the map has a river on it',
    onWater === null ? 'none found' : onWater.map(Math.round).join(','));
  ok(inland !== null, 'and somewhere dry', inland === null ? 'none' : '');

  if (onWater !== null && inland !== null) {
    const pump = ASSETS.findIndex((a) => a.id === 'svc.water.pump');
    ok(pump >= 0, 'the library has a pump in it');
    // Two one-road cities, one with the pump on the river and one without.
    const build = (at) => {
      const net = new RoadGraph(200);
      net.add(at[0] - 220, at[1], at[0] + 220, at[1], 'street', 0);
      const city = makeCity(defaultWorld());
      const sim = new Simulation(city, net, 0x9a1);
      const p = sim.places.add(pump, at[0], at[1], 0, 0);
      sim.utilities.rewire(sim.lanes, net.nodes.length);
      // Staff it, so that only the river is in question.
      const jobs = sim.places.col.jobs[p];
      for (let k = 0; k < jobs; k++) sim.places.hire(p);
      sim.utilities.settle(1);
      let made = 0;
      for (const n of sim.utilities.networks) made += n.waterMade;
      return made;
    };
    const wet = build(onWater);
    const dry = build(inland);
    console.log(`  pump on the river       ${Math.round(wet).toLocaleString()} m³ a day`);
    console.log(`  pump inland             ${Math.round(dry).toLocaleString()} m³ a day`);
    ok(wet > 0, 'a pump on the river pumps', `${wet}`);
    ok(dry === 0, 'a pump inland pumps nothing', `${dry}`);
  }
}

// ---- coverage follows the roads, not the crow ------------------------------

section('coverage is a response time');
{
  // Two parallel streets a hundred metres apart, joined only at one far end. A
  // station on one is a hundred metres from the other as the crow flies and over a
  // kilometre away by road -- which is the case a coverage circle gets wrong.
  const net = new RoadGraph(200);
  net.add(-600, -50, 600, -50, 'street', 0);
  net.add(-600, 50, 600, 50, 'street', 0);
  net.add(600, -50, 600, 50, 'street', 0);
  const world = defaultWorld();
  const city = makeCity(world);
  const sim = new Simulation(city, net, 0x3c0f);
  const fire = ASSETS.findIndex((a) => a.id === 'svc.fire.station');
  ok(fire >= 0, 'the library has a fire station');

  const station = sim.places.add(fire, -560, -50, -1, -1);
  // Point it at the near street.
  const { nearestLane } = await (async () => {
    const b = (await esbuild.build({
      stdin: {
        contents: `export { nearestLane, buildLaneIndex, Use } from '${src}sim/agents/lanes';`,
        resolveDir: src, loader: 'ts',
      }, bundle: true, format: 'esm', write: false, target: 'es2022',
    })).outputFiles[0].text;
    return import('data:text/javascript;base64,' + Buffer.from(b).toString('base64'));
  })();
  sim.places.col.lane[station] = nearestLane(sim.lanes, sim.index, -560, -50, 1, 200);
  ok(sim.places.col.lane[station] >= 0, 'the station fronts a road');
  for (let k = 0; k < sim.places.col.jobs[station]; k++) sim.places.hire(station);

  // Run the coverage search to completion.
  const b = BRANCHES.indexOf('fire');
  for (let i = 0; i < 400; i++) sim.services.refresh(1000, 200, 500, 20000);

  const near = nearestLane(sim.lanes, sim.index, -400, -50, 1, 200);
  const far = nearestLane(sim.lanes, sim.index, -400, 50, 1, 200);
  const mNear = sim.services.minutes[b][near];
  const mFar = sim.services.minutes[b][far];
  console.log(`  160 m along the same street   ${mNear.toFixed(2)} min`);
  console.log(`  100 m away, other side        ${mFar.toFixed(2)} min`);
  ok(mNear < 2, 'the near end of the same street is covered', `${mNear.toFixed(2)} min`);
  ok(mFar > mNear * 3, 'the street a hundred metres away is not, because of the roads',
    `${mFar.toFixed(2)} vs ${mNear.toFixed(2)} min`);
  ok(mFar < UNREACHED, 'but it is reachable, the long way round', `${mFar}`);
}

// ---- a city that depends on its utilities ---------------------------------

section('a necessity, not a bonus');
{
  const DAYS = Number(process.argv[2] || 0) || 45;
  const GRID = Number(process.argv[3] || 0) || 200;
  configureSim({ cityGrid: GRID });

  // The same city twice. In one, every plant in it works. In the other, the
  // generators are switched off by taking their staff away -- which is the only
  // difference, so anything that follows is the utilities and nothing else.
  const run = (cutPower) => {
    const world = defaultWorld();
    const city = makeCity(world);
    const sim = new Simulation(city, world.net, 0x1eaf);
    sim.look(0, 0);
    sim.found(12);
    if (cutPower) {
      // The generators are taken off the map. Nothing else differs -- same seed,
      // same roads, same buildings -- so whatever follows is the electricity.
      //
      // Starving them of staff instead did not work, and finding out why was
      // worthwhile: an unstaffed plant used to run at forty per cent, and forty per
      // cent of a city with twice the generation it needed was still a city with
      // the lights on.
      for (let p = sim.places.count - 1; p >= 0; p--) {
        if (sim.places.live[p] === 0) continue;
        const def = ASSETS[sim.places.col.proto[p]];
        if ((supplyOf(def.id)?.power ?? 0) > 0) sim.places.remove(p);
      }
      sim.utilities.rewire(sim.lanes, world.net.nodes.length);
    }
    for (let d = 0; d < DAYS; d++) sim.step(TICKS_PER_DAY);
    return sim;
  };

  const lit = run(false);
  const dark = run(true);
  const lr = lit.utilities.report, dr = dark.utilities.report;
  console.log(`  with the power on       pop ${lit.people.population.toLocaleString()}, `
    + `happy ${pct(lit.people.happiness)}, power ${pct(lr.served[Util.POWER])} supplied, `
    + `appeal ${pct(lit.migration.appeal)}`);
  console.log(`  with it off             pop ${dark.people.population.toLocaleString()}, `
    + `happy ${pct(dark.people.happiness)}, power ${pct(dr.served[Util.POWER])} supplied, `
    + `appeal ${pct(dark.migration.appeal)}`);
  console.log(`  left because of it      `
    + `${(dark.migration.flow.departed - lit.migration.flow.departed).toLocaleString()} `
    + `more households`);

  ok(lr.margin[Util.POWER] > dr.margin[Util.POWER] * 2,
    'the lit city generates and the dark one does not',
    `${pct(lr.margin[Util.POWER])} vs ${pct(dr.margin[Util.POWER])} of demand met`);
  ok(dr.margin[Util.POWER] < 0.2, 'with the generators gone, there is almost no power',
    pct(dr.margin[Util.POWER]));
  ok(dark.people.happiness < lit.people.happiness - 0.05,
    'people in the dark city are unhappier',
    `${pct(dark.people.happiness)} vs ${pct(lit.people.happiness)}`);
  ok(dark.people.population < lit.people.population * 0.95,
    'and there are fewer of them',
    `${dark.people.population} vs ${lit.people.population}`);
  ok(dark.migration.appeal < lit.migration.appeal,
    'and fewer want to come', `${pct(dark.migration.appeal)} vs ${pct(lit.migration.appeal)}`);

  // The lit city's own numbers, which are what the readout will show.
  section('the lit city');
  const u = lit.utilities;
  console.log(`  networks                ${u.report.networks}, `
    + `largest holds ${pct(u.report.biggest)} of the buildings`);
  for (let k = 0; k < 4; k++) {
    console.log(`  ${UTIL_NAMES[k].padEnd(22)} `
      + `${pct(u.report.margin[k])} of demand met, ${pct(u.report.served[k])} of buildings served`);
  }
  console.log(`  not connected           ${pct(u.report.cutOff)}`);
  console.log(`  into the river          ${Math.round(u.report.spilled).toLocaleString()} m³ a day`);
  console.log(`  rubbish piled up        ${Math.round(u.report.piled).toLocaleString()} `
    + `at ${u.report.smelly} buildings`);
  ok(u.report.networks >= 1, 'the city has at least one network');
  ok(u.report.biggest > 0.5, 'and most of it is on one', pct(u.report.biggest));

  section('coverage');
  for (const cov of lit.services.cover) {
    if (cov.stations === 0) continue;
    console.log(`  ${cov.branch.padEnd(11)} ${String(cov.stations).padStart(3)} built  `
      + `${pct(cov.wellServed).padStart(4)} well served  `
      + `${pct(cov.served).padStart(4)} served  `
      + `${(cov.meanMinutes >= UNREACHED ? '--' : cov.meanMinutes.toFixed(1) + ' min').padStart(8)}  `
      + `capacity ${pct(cov.capacityRatio)}`);
  }
  const built = lit.services.cover.filter((c) => c.stations > 0);
  ok(built.length >= 4, 'several branches are built', `${built.length}`);
  ok(built.some((c) => c.served > 0.2), 'and at least one of them covers the city',
    built.map((c) => `${c.branch} ${pct(c.served)}`).join(' '));
  ok(built.every((c) => c.meanMinutes >= 0), 'every mean response time is a number');

  // ---- the views -------------------------------------------------------
  section('views');
  let empty = 0, unpainted = 0;
  const cells = VIEW_GRID * VIEW_GRID;
  for (const info of VIEWS) {
    const grid = lit.views.build(info.id, 0);
    let painted = 0, min = 255, max = 0;
    for (let i = 0; i < cells; i++) {
      if (grid[i] === NO_DATA) continue;
      painted++;
      if (grid[i] < min) min = grid[i];
      if (grid[i] > max) max = grid[i];
    }
    const stats = lit.views.stats(info.id);
    console.log(`  ${info.name.padEnd(13)} ${String(Math.round(painted / cells * 100)).padStart(3)}% `
      + `of the map painted, ${min}..${max}, `
      + `${stats.length} figures, ${info.look === Look.UNDERGROUND ? 'underground' : 'surface'}`);
    if (painted === 0) empty++;
    if (painted < cells * 0.02) unpainted++;
    if (stats.length < 4) {
      ok(false, `${info.name} has enough to read`, `${stats.length} lines`);
    }
    for (const line of stats) {
      if (typeof line.label !== 'string' || typeof line.value !== 'string'
        || line.value.includes('NaN') || line.value.includes('undefined')) {
        ok(false, `${info.name}: every figure is a real number`,
          `${line.label} = ${line.value}`);
      }
    }
  }
  ok(empty === 0, 'every view paints something', `${empty} blank`);
  ok(unpainted === 0, 'and paints a useful amount of the map', `${unpainted} nearly blank`);
  ok(VIEWS.length >= 10, 'there are enough views to be worth a row of buttons',
    `${VIEWS.length}`);
  ok(VIEWS.filter((v) => v.look === Look.UNDERGROUND).length >= 3,
    'the buried services are drawn as buried');
  ok(new Set(VIEWS.map((v) => v.icon)).size === VIEWS.length, 'every view has its own icon');
  ok(new Set(VIEWS.map((v) => v.id)).size === VIEWS.length, 'and its own id');

  // ---- what it costs ---------------------------------------------------
  section('cost');
  let worst = 0, total = 0;
  const N = 600;
  lit.show(View.POWER);
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    lit.step(1);
    const dt = performance.now() - t0;
    total += dt;
    if (dt > worst) worst = dt;
  }
  console.log(`  with a view open        ${(total / N * 1000).toFixed(0)} us a tick, `
    + `worst ${worst.toFixed(1)} ms`);
  const t1 = performance.now();
  for (const info of VIEWS) lit.views.build(info.id, 0);
  const buildMs = (performance.now() - t1) / VIEWS.length;
  console.log(`  building one view       ${buildMs.toFixed(1)} ms`);
  console.log(`  memory                  ${lit.report.memory}`);
  ok(total / N < 4, 'a tick with the services in it stays cheap',
    `${(total / N * 1000).toFixed(0)} us`);
  ok(buildMs < 25, 'and a view is quick enough to rebuild as it changes',
    `${buildMs.toFixed(1)} ms`);
}

console.log(`\n${failed === 0 ? 'SERVICE_OK' : 'SERVICE_FAIL'}  ${checks - failed}/${checks} checks`);
process.exit(failed === 0 ? 0 : 1);
