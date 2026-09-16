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
      `export * from '${src}sim/mains';`,
      `export { buildMainsMesh, MAIN_VERTEX_FLOATS } from '${src}gfx/mains-mesh';`,
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
  Purpose, Stage, makeCity, INSTANCE_FLOATS, defaultWorld, emptyWorld, RoadGraph,
  Mains, Main, buildMainsMesh, MAIN_VERTEX_FLOATS,
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

  // Counted per utility now that each one has its own mains. With none laid --
  // which is this case, since the Simulation was built without a world -- every
  // utility falls back to the road components, which is the old behaviour.
  const before = u.networkCount(Util.POWER);
  console.log(`  two districts           ${before} power networks`);
  ok(before >= 2, 'two unjoined districts are two networks', `${before}`);

  // Join them, and they become one.
  net.add(-300, -400, 400, 300, 'street', 0);
  sim.roadsChanged(net);
  const after = sim.utilities.networkCount(Util.POWER);
  console.log(`  joined by one street    ${after} networks`);
  ok(after < before || after === 1, 'joining them joins their grids', `${after}`);
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

// ---- the mains --------------------------------------------------------------

section('pipes are laid, not free with the road');
{
  // One street, and a building on it. Nothing is piped until the player lays it,
  // which is the whole change: a road used to carry every utility the moment it
  // was drawn, and now it carries nothing.
  const grid = 200;
  const net = new RoadGraph(grid);
  net.add(-600, 0, 600, 0, 'street', 0);
  net.rasterise();
  const mains = new Mains(grid);

  ok(mains.netAt(0, 0, Main.WATER) < 0, 'a new street has no water main in it');
  const laid = mains.lay(net, -400, 0, 400, 0, Main.WATER, true);
  console.log(`  dragged 800 m of water  ${laid} cells`);
  ok(laid > 40, 'dragging along it lays one', `${laid}`);
  ok(mains.netAt(0, 0, Main.WATER) >= 0, 'and the street now has water');
  ok(mains.netAt(0, 0, Main.POWER) < 0, 'but not power: they are separate networks');

  // The service band: a house set back from the kerb connects, one behind the
  // block does not. That band is the whole of "drag along the road and the houses
  // connect themselves".
  const near = mains.netAt(0, 24, Main.WATER);
  const far = mains.netAt(0, 90, Main.WATER);
  console.log(`  24 m back from the kerb ${near >= 0 ? 'connected' : 'not'}`);
  console.log(`  90 m back               ${far >= 0 ? 'connected' : 'not'}`);
  ok(near >= 0, 'a house set back from the street connects itself');
  ok(far < 0, 'one across the block does not');

  // Off the road it does not go, however the drag wanders.
  const before = mains.report.laid[Main.POWER] ?? 0;
  mains.lay(net, -400, 300, 400, 300, Main.POWER, true);
  ok((mains.report.laid[Main.POWER] ?? 0) === before,
    'a drag across open ground lays nothing: a main goes in the street');

  // Two runs with a gap are two networks; closing the gap makes them one.
  const m2 = new Mains(grid);
  m2.lay(net, -600, 0, -200, 0, Main.POWER, true);
  m2.lay(net, 200, 0, 600, 0, Main.POWER, true);
  const split = m2.networksOf(Main.POWER);
  m2.lay(net, -220, 0, 220, 0, Main.POWER, true);
  const joined = m2.networksOf(Main.POWER);
  console.log(`  two runs with a gap     ${split} grids -> ${joined} after joining`);
  ok(split === 2, 'a gap in the line is two grids', `${split}`);
  ok(joined === 1, 'and closing it makes one', `${joined}`);

  // Drawn as one line down the middle of the street, not as a ladder.
  //
  // A street is three cells wide, so the first version of the mesh -- a segment
  // between every laid pair of neighbouring cells -- drew two rails and a rung
  // every eight metres. The test is geometric: every vertex has to sit within a
  // couple of metres of the road's centreline, which a rung cannot.
  {
    const mesh = buildMainsMesh(mains, net, () => 0, Main.WATER);
    let worst = 0;
    for (let i = 0; i < mesh.count; i++) {
      const at = i * MAIN_VERTEX_FLOATS;
      // The road under test runs along z = 0, so the offset from it is |z|.
      worst = Math.max(worst, Math.abs(mesh.vertices[at + 2]));
    }
    console.log(`  drawn line              ${mesh.count / 6} segments, `
      + `worst ${worst.toFixed(2)} m off the centreline`);
    ok(mesh.count > 0, 'the main is drawn', `${mesh.count} vertices`);
    ok(worst < 2.5, 'as one line down the middle of the street, not a ladder',
      `${worst.toFixed(2)} m`);
  }

  // And lifting takes it away again.
  const lifted = m2.lay(net, -600, 0, 600, 0, Main.POWER, false);
  ok(lifted > 0 && m2.networksOf(Main.POWER) === 0,
    'lifting the whole run leaves no grid', `${lifted} cells`);
}

section('a city with no pipes has no power');
{
  // The same city twice. In one the mains are laid the way the generator leaves
  // them; in the other they are pulled up. Nothing else differs, so everything
  // that follows is the pipes.
  configureSim({ cityGrid: 160 });
  const run = (piped) => {
    const world = defaultWorld();
    if (!piped) world.mains.clear();
    const sim = new Simulation(makeCity(world), world.net, 0x91e5, world.mains);
    const pc = sim.places.col;
    for (let p = 0; p < sim.places.count; p++) {
      if (sim.places.live[p] === 0 || pc.purpose[p] !== Purpose.SERVICE) continue;
      for (let k = 0; k < pc.jobs[p]; k++) sim.places.hire(p);
    }
    sim.found(12);
    for (let i = 0; i < 12 * TICKS_PER_DAY; i++) sim.step(1);
    return {
      power: sim.utilities.report.served[Util.POWER],
      water: sim.utilities.report.served[Util.WATER],
      cutOff: sim.utilities.report.cutOff,
      pop: sim.people.population,
      happy: sim.people.happiness,
    };
  };
  const on = run(true);
  const off = run(false);
  console.log(`  mains laid              ${pct(on.power)} powered, ${pct(on.water)} watered, `
    + `pop ${on.pop.toLocaleString()}, happy ${pct(on.happy)}`);
  console.log(`  mains pulled up         ${pct(off.power)} powered, ${pct(off.water)} watered, `
    + `pop ${off.pop.toLocaleString()}, happy ${pct(off.happy)}`);
  ok(on.power > 0.5, 'a piped city is powered', pct(on.power));
  ok(off.power === 0, 'one with the pipes pulled up is not', pct(off.power));
  ok(off.cutOff > 0.9, 'and reads as cut off', pct(off.cutOff));
  ok(off.happy < on.happy, 'and the people in it are unhappier',
    `${pct(off.happy)} vs ${pct(on.happy)}`);
}

// ---- coverage is an area, and a full station covers it less ---------------

section('coverage is a catchment, not a route');
{
  // Nothing about a school catchment is a journey down a road: it is the ground
  // around the building. So the test is the shape of that ground, and what happens
  // to it when more people stand inside it than the building can look after.
  // Six hundred cells rather than two hundred: the grid's extent is the map's,
  // and a probe past the edge of the map reads as uncovered whatever the station
  // is doing -- which looked like a broken falloff and was a small map.
  const net = new RoadGraph(600);
  net.add(-600, -50, 600, -50, 'street', 0);
  // Empty land, so the only fire station on the map is the one placed below. The
  // generated city has its own, and a probe past the edge of this catchment was
  // reading one of those -- which looked like a falloff that never fell.
  const world = emptyWorld(600);
  const city = makeCity(world);
  const sim = new Simulation(city, net, 0x3c0f);
  const fire = ASSETS.findIndex((a) => a.id === 'svc.fire.station');
  ok(fire >= 0, 'the library has a fire station');

  const station = sim.places.add(fire, 0, 0, -1, -1);
  for (let k = 0; k < sim.places.col.jobs[station]; k++) sim.places.hire(station);
  const b = BRANCHES.indexOf('fire');
  const std = sim.services.standardOf('fire');
  const settle = () => { for (let i = 0; i < 60; i++) sim.services.refresh(0, 0, 0, 1e9); };
  settle();

  const on = sim.services.coverAt(0, 0, b);
  // Off the road entirely, and across it: neither is a journey, both are inside
  // the catchment, and both must read as covered. This is the assertion that would
  // fail if coverage went back to following the streets.
  const beside = sim.services.coverAt(0, -300, b);
  const across = sim.services.coverAt(200, 260, b);
  const edge = sim.services.coverAt(std.worst - 60, 0, b);
  const outside = sim.services.coverAt(std.worst + 300, 0, b);
  console.log(`  at the station          ${pct(on)}`);
  console.log(`  300 m off, no road      ${pct(beside)}`);
  console.log(`  330 m off, across it    ${pct(across)}`);
  console.log(`  just inside the edge    ${pct(edge)}`);
  console.log(`  past the edge           ${pct(outside)}`);
  ok(on > 0.95, 'the station covers where it stands', pct(on));
  ok(beside > 0.9, 'and the open ground beside it, with no road to get there',
    pct(beside));
  ok(across > 0.6, 'and the far side of the street', pct(across));
  ok(edge > 0 && edge < 0.35, 'the edge of the catchment is weak, not sharp',
    pct(edge));
  ok(outside === 0, 'and past it there is nothing', pct(outside));

  // Now fill the catchment. A station rated for a few thousand people with fifty
  // thousand living on top of it has to read as overloaded -- that is the whole of
  // "a percentage of usage", and it is the half of coverage a circle cannot say.
  const holds = Math.max(1, sim.places.col.serves[station]) * std.per;
  const homes = ASSETS.findIndex((a) => a.id.startsWith('res.'));
  ok(homes >= 0, 'the library has housing');
  let placed = 0;
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const r = 40 + (i % 6) * 30;
    const h = sim.places.add(homes, Math.cos(a) * r, Math.sin(a) * r, -1, -1);
    if (h < 0) continue;
    // Straight into the column: what is being tested is the load model, and going
    // through the migration system to get ten thousand residents would be testing
    // that instead.
    sim.places.col.living[h] = Math.min(0xffff, Math.ceil(holds / 40));
    placed++;
  }
  ok(placed > 100, 'the district was built', `${placed} homes`);
  settle();

  const loaded = sim.services.coverAt(0, 0, b);
  const load = sim.services.cover[b].worstLoad;
  console.log(`  rated for               ${Math.round(holds).toLocaleString()} people`);
  console.log(`  standing in it          ${(placed * Math.ceil(holds / 40)).toLocaleString()}`);
  console.log(`  the station is at       ${pct(load)} of what it can do`);
  console.log(`  coverage there is now   ${pct(loaded)} (was ${pct(on)})`);
  ok(load > 1.5, 'the station reads as overloaded', pct(load));
  ok(loaded < on * 0.75, 'and the district it covers reads worse for it',
    `${pct(loaded)} vs ${pct(on)}`);
  ok(loaded > 0, 'but not as abandoned: an overstretched service is still a service',
    pct(loaded));
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
      + `${(cov.meanMetres >= UNREACHED ? '--' : Math.round(cov.meanMetres) + ' m').padStart(8)}  `
      + `capacity ${pct(cov.capacityRatio)}  busiest ${pct(cov.worstLoad)}`);
  }
  const built = lit.services.cover.filter((c) => c.stations > 0);
  ok(built.length >= 4, 'several branches are built', `${built.length}`);
  ok(built.some((c) => c.served > 0.2), 'and at least one of them covers the city',
    built.map((c) => `${c.branch} ${pct(c.served)}`).join(' '));
  ok(built.every((c) => c.meanMetres >= 0), 'every mean distance is a number');

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
