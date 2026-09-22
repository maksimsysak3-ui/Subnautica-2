/**
 * The city as something that happens to itself.
 *
 * Until this batch a building was a stamp: it came up, and then it stood there
 * unaltered for the rest of the game however the district around it was
 * treated. Two models change that -- a land value and pollution field
 * (`agents/ground.ts`) and a building lifecycle (`agents/lifecycle.ts`) -- and
 * both of them are the sort of thing that is easy to write, easy to believe,
 * and completely inert. A weighted sum of five numbers will always produce a
 * plausible-looking map. The question is whether any of it *does* anything.
 *
 * So this runs the real loop -- grow, rebuild, reconcile, exactly as `live.ts`
 * does every frame -- and asserts on consequences rather than on fields:
 *
 *   LAND VALUE IS SPATIAL. The streets by the park are worth more than the
 *   streets by the works. If they are not, the field is decoration.
 *
 *   POLLUTION COMES FROM SOMEWHERE AND GOES SOMEWHERE. Dirty over industry,
 *   clean a long way from it, and gone when the industry is.
 *
 *   NEGLECT COSTS BUILDINGS. Cut a town's power and water off and its buildings
 *   lose condition, start complaining, and are eventually condemned and
 *   cleared.
 *
 *   AND IT COMES BACK. Put the supply back and the cleared plots are released
 *   again and rebuilt.
 *
 *   GOOD DISTRICTS GROW INTO SOMETHING. A well-served, clean, quiet quarter
 *   climbs its tier and the buildings on it get bigger.
 *
 *   IT IS CHEAP. Both models run on the slow rates over whole grids, which is
 *   exactly the shape of thing that turns up in a profile later.
 *
 *   node tools/lifecycle-test.mjs
 */

import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { Simulation } from '${src}sim/agents/sim';`,
      `export { makeCity } from '${src}sim/city';`,
      `export { emptyWorld, paint, zoneCode, placeLot } from '${src}sim/world';`,
      `export { PLOTS } from '${src}sim/plots';`,
      `export { TICKS_PER_DAY } from '${src}sim/agents/calendar';`,
      `export { configureSim } from '${src}sim/config';`,
      `export { GROUND_GRID } from '${src}sim/agents/ground';`,
      `export { DERELICT_AT } from '${src}sim/agents/lifecycle';`,
      `export { TIERS } from '${src}sim/inventory';`,
      `export { assetById } from '${src}assets/registry';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022',
})).outputFiles[0].text;

const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));
const {
  Simulation, makeCity, emptyWorld, paint, zoneCode, placeLot, PLOTS,
  TICKS_PER_DAY, configureSim, GROUND_GRID, DERELICT_AT, TIERS,
} = M;

let failed = 0, checks = 0;
const ok = (cond, what, detail = '') => {
  checks++;
  if (!cond) { failed++; console.log(`  FAIL  ${what}${detail ? '  -- ' + detail : ''}`); }
};
const section = (name) => console.log(`\n${name}`);
const pct = (v) => `${Math.round(v * 100)}%`;

const GRID = 200;
configureSim({ cityGrid: GRID, terrainSize: 9216 });

/** A town's worth of site: a grid of streets, every plot bought, mains in. */
function site() {
  const world = emptyWorld(GRID);
  for (let p = 0; p < PLOTS * PLOTS; p++) world.land.take(p);
  const span = (GRID / 2 - 8) * 8;
  for (let k = -4; k <= 4; k++) {
    world.net.add(-span, k * 104, span, k * 104, 'street');
    world.net.add(k * 104, -span, k * 104, span, 'street');
  }
  world.net.rasterise();
  world.mains.layEverywhere(world.net);
  world.grown.fill(0);
  return world;
}

/** Paints a rectangle of zoning, in cells, around a centre cell. */
function zone(world, kind, density, cx, cz, cells) {
  paint(world, cx - (cells >> 1), cz - (cells >> 1), cells, cells,
    zoneCode(kind, density));
}

/**
 * Puts a service building down, the way the tool does.
 *
 * Loud about failing. The first run of this test had a town with no power
 * station in it because four of the ids were wrong, and every reading it
 * produced was a reading about a town with no power station -- which looked
 * exactly like the models being broken.
 */
function place(world, id, cx, cz) {
  // placeLot returns the reason it could not, and null for success -- so the
  // obvious truthiness test is exactly backwards, which is how the first run of
  // this file reported a broken land value model over a town that had no power
  // station, no water and no parks in it.
  const why = placeLot(world, id, cx, cz, 0);
  if (why !== null) { failed++; console.log(`  FAIL  could not place ${id}: ${why}`); }
  return why === null;
}

/**
 * The middle of the block `k` steps along and `j` steps across from the centre.
 *
 * The streets in `site` are thirteen cells apart, so anything put down has to
 * go between them or the placement is refused for standing on a road.
 */
function block(k, j) {
  const C = GRID >> 1;
  return [C + k * 13 + 6, C + j * 13 + 6];
}

/** Runs the real loop for a number of game days. */
function play(sim, world, days, onDay) {
  const CHUNK = 32;
  for (let d = 0; d < days; d++) {
    for (let t = 0; t < TICKS_PER_DAY; t += CHUNK) {
      sim.step(CHUNK);
      const grew = sim.grew();
      if (grew !== null) sim.buildingsChanged(makeCity(world, grew));
    }
    onDay?.(d + 1, sim);
  }
}

/** Mean of a field over a disc of world metres. */
function around(sim, field, x, z, metres) {
  const g = sim.ground;
  let sum = 0, n = 0;
  const step = (g.extentMetres ?? 1600) / GROUND_GRID;
  for (let dz = -metres; dz <= metres; dz += step) {
    for (let dx = -metres; dx <= metres; dx += step) {
      if (dx * dx + dz * dz > metres * metres) continue;
      const at = g.cellAt(x + dx, z + dz);
      if (at < 0) continue;
      sum += field[at]; n++;
    }
  }
  return n > 0 ? sum / n : 0;
}

// ---- where the value is ----------------------------------------------------

section('a plot is worth what is around it');
{
  const world = site();
  const C = GRID >> 1;
  // Housing across the middle, a works on one side and a park on the other, far
  // enough apart that neither is inside the other's spread.
  zone(world, 'residential', 'medium', C, C, 36);
  zone(world, 'industrial', 'medium', C - 30, C, 14);
  place(world, 'svc.power.gas', ...block(-3, -2));
  place(world, 'svc.water.borehole', ...block(0, -2));
  place(world, 'svc.sewage.lagoon', ...block(-1, 2));
  place(world, 'svc.parks.square', ...block(2, 0));
  place(world, 'svc.parks.garden', ...block(2, 1));
  place(world, 'svc.fire.station', ...block(0, -1));
  place(world, 'svc.health.clinic', ...block(1, 1));

  const sim = new Simulation(makeCity(world), world.net, 0x11ee, world);
  sim.found(60);
  play(sim, world, 26);

  const g = sim.ground;
  const half = (GRID * 8) / 2;
  const at = (gx, gz) => [gx * 8 - half + 4, gz * 8 - half + 4];
  const [wx, wz] = at(C - 30, C);
  const [px, pz] = at(C + 26, C);

  const worksAir = around(sim, g.pollution, wx, wz, 90);
  const parkAir = around(sim, g.pollution, px, pz, 90);
  const worksValue = around(sim, g.value, wx, wz, 90);
  const parkValue = around(sim, g.value, px, pz, 90);

  console.log(`  by the works      air ${pct(worksAir)} dirty, land ${pct(worksValue)}`);
  console.log(`  by the park       air ${pct(parkAir)} dirty, land ${pct(parkValue)}`);
  console.log(`  city              value ${pct(g.meanValue)}, air ${pct(g.meanPollution)},`
    + ` noise ${pct(g.meanNoise)}, amenity ${pct(g.meanAmenity)}`);

  ok(worksAir > parkAir + 0.05, 'the air is dirtier over the industry',
    `${pct(worksAir)} against ${pct(parkAir)}`);
  ok(parkValue > worksValue + 0.05, 'the land by the park is worth more',
    `${pct(parkValue)} against ${pct(worksValue)}`);
  ok(g.meanValue > 0.1 && g.meanValue < 0.95, 'the city-wide value is not pinned',
    pct(g.meanValue));
  ok(g.worstPollution > 0.1, 'industry registers at all', pct(g.worstPollution));

  // And the far corner of the map, which has nothing on it, is clean.
  const corner = around(sim, g.pollution, -half + 200, -half + 200, 120);
  ok(corner < worksAir * 0.5, 'pollution does not reach the empty corner',
    `${pct(corner)} against ${pct(worksAir)}`);
}

// ---- neglect ---------------------------------------------------------------

section('a town nobody supplies falls down');
{
  const world = site();
  const C = GRID >> 1;
  zone(world, 'residential', 'medium', C, C, 30);
  zone(world, 'commercial', 'medium', C + 18, C, 10);
  place(world, 'svc.power.gas', ...block(-2, -2));
  place(world, 'svc.water.borehole', ...block(0, -2));
  place(world, 'svc.sewage.lagoon', ...block(2, -2));
  place(world, 'svc.fire.station', ...block(-1, -2));

  const sim = new Simulation(makeCity(world), world.net, 0x4b0b, world);
  sim.found(80);
  play(sim, world, 22);
  const built = sim.places.homeCapacity;
  const soundBefore = health(sim);
  const supply = meanSupply(sim);
  console.log(`  supplied          ${built} homes, power ${pct(supply[0])},`
    + ` water ${pct(supply[1])}, mean condition ${pct(soundBefore)}`);
  ok(supply[0] > 0.5 && supply[1] > 0.5, 'the town really is supplied',
    `power ${pct(supply[0])}, water ${pct(supply[1])}`);
  ok(built > 40, 'the town grew', `${built} homes`);
  ok(soundBefore > 0.5, 'a supplied town is in good condition', pct(soundBefore));

  // The lights go out: every main pulled up, which is what bulldozing the
  // network amounts to.
  world.mains.bits.fill(0);
  world.mains.rebuild();
  sim.mainsChanged();
  sim.buildingsChanged(makeCity(world));

  play(sim, world, 30);
  const after = health(sim);
  const condemned = sim.life.total.condemned;
  const ailing = countAiling(sim);
  console.log(`  cut off           mean condition ${pct(after)}, `
    + `${ailing} buildings failing, ${condemned} plots condemned`);
  ok(after < soundBefore - 0.2, 'condition falls when the supply is cut',
    `${pct(soundBefore)} to ${pct(after)}`);
  ok(ailing > 0, 'buildings start complaining', `${ailing}`);
  ok(condemned > 0, 'plots are eventually condemned', `${condemned}`);
  const blighted = count(world.blight);
  ok(blighted > 0, 'and the cells are marked as cleared', `${blighted}`);
  const lost = built - sim.places.homeCapacity;
  ok(lost > 0, 'and the homes on them are gone',
    `${built} homes to ${sim.places.homeCapacity}`);

  // ---- and back -----------------------------------------------------------
  world.mains.layEverywhere(world.net);
  sim.mainsChanged();
  sim.buildingsChanged(makeCity(world));
  // And the money to do it with. A town that has just lost nine tenths of its
  // buildings has lost nine tenths of its tax base with them and is deep in its
  // overdraft, and a bankrupt city correctly refuses to build anything -- which
  // is a real consequence and not one this section is testing. The first run of
  // this test spent a hundred and twenty game days watching a solvent-looking
  // recovery that was actually a city two and a half million in the red.
  world.budget.restore(400000, [...world.budget.rates]);
  const lowest = sim.places.homeCapacity;
  play(sim, world, 120, (d, sm) => {
    if (d % 20) return;
    let waiting = 0;
    for (let i = 0; i < world.zones.length; i++) {
      if (world.zones[i] !== 0 && world.blight[i] === 0 && world.grown[i] === 0) waiting++;
    }
    console.log(`    day ${d}: ${count(world.blight)} blighted, ${waiting} waiting,`
      + ` ${sm.places.homeCapacity} homes, ${sm.people.population} people,`
      + ` R ${pct(sm.demand.want[0])}, balance ${Math.round(sm.budget.balance)}`);
  });
  const back = health(sim);
  const left = count(world.blight);
  console.log(`  supplied again    mean condition ${pct(back)}, `
    + `${left} cells still cleared, ${sim.places.homeCapacity} homes, `
    + `${sim.people.population} people, demand ${[...sim.demand.want].map((b) => pct(b)).join("/")}`);
  ok(back > after + 0.1, 'condition recovers when the supply comes back',
    `${pct(after)} to ${pct(back)}`);
  ok(left < blighted, 'condemned land is released again',
    `${blighted} cells to ${left}`);
  ok(sim.places.homeCapacity > lowest, 'and it is rebuilt on',
    `${lowest} homes to ${sim.places.homeCapacity}`);
}

// ---- growing into it -------------------------------------------------------

section('a good district grows into something grander');
{
  const world = site();
  const C = GRID >> 1;
  // Only the bare necessities to start with: a town that works and has nothing
  // else going for it. Whether the tier moves has to be the player's doing, and
  // a district that started with the parks in it would not show that.
  zone(world, 'residential', 'high', C, C, 30);
  place(world, 'svc.power.gas', ...block(-3, -3));
  place(world, 'svc.water.borehole', ...block(-3, 2));
  place(world, 'svc.sewage.lagoon', ...block(3, -3));

  const sim = new Simulation(makeCity(world), world.net, 0x9a7d, world);
  sim.found(120);
  play(sim, world, 40);
  const before = {
    tier: meanTier(world), homes: sim.places.homeCapacity,
    value: sim.ground.meanValue, raised: sim.life.total.raised,
  };
  console.log(`  bare              tier ${before.tier.toFixed(2)},`
    + ` land ${pct(before.value)}, ${before.homes} homes`);

  // Now the player looks after it.
  place(world, 'svc.parks.square', ...block(-1, 0));
  place(world, 'svc.parks.garden', ...block(1, 0));
  place(world, 'svc.parks.playground', ...block(0, 1));
  place(world, 'svc.fire.station', ...block(0, -1));
  place(world, 'svc.health.clinic', ...block(1, -1));
  place(world, 'svc.edu.primary', ...block(-1, 1));
  place(world, 'svc.police.post', ...block(1, 1));
  place(world, 'svc.transport.station', ...block(2, -1));
  sim.buildingsChanged(makeCity(world));

  play(sim, world, 110);
  const after = { tier: meanTier(world), homes: sim.places.homeCapacity };
  const raised = sim.life.total.raised - before.raised;

  console.log(`  tier              ${before.tier.toFixed(2)} -> ${after.tier.toFixed(2)}`
    + ` of ${TIERS - 1}, ${raised} plots raised, ${sim.life.total.lowered} fell back`);
  console.log(`  looked after      ${before.homes} homes -> ${after.homes}`);
  const g = sim.ground;
  const half = (GRID * 8) / 2;
  const mid = g.cellAt(C * 8 - half + 4, C * 8 - half + 4);
  console.log(`  land value        district ${pct(g.value[mid])}, city ${pct(g.meanValue)}`
    + ` (amenity ${pct(g.meanAmenity)}, density ${g.density[mid].toFixed(0)})`);
  ok(raised > 0, 'plots climb a tier when the land is worth it', `${raised}`);
  ok(after.tier > before.tier, 'the district as a whole grows into it',
    `${before.tier.toFixed(2)} to ${after.tier.toFixed(2)}`);
  ok(after.homes > before.homes, 'and the grander buildings hold more people',
    `${before.homes} homes to ${after.homes}`);
}

// ---- what it costs ---------------------------------------------------------

section('what it costs');
{
  const world = site();
  const C = GRID >> 1;
  zone(world, 'residential', 'medium', C, C, 44);
  zone(world, 'industrial', 'medium', C - 40, C, 18);
  place(world, 'svc.power.gas', ...block(-3, -2));
  place(world, 'svc.water.borehole', ...block(0, -2));
  const sim = new Simulation(makeCity(world), world.net, 0x3333, world);
  sim.found(200);
  play(sim, world, 30);

  const g = sim.ground;
  let t0 = performance.now();
  for (let i = 0; i < 40; i++) g.settle();
  const settle = (performance.now() - t0) / 40;
  t0 = performance.now();
  for (let i = 0; i < 40; i++) sim.life.survey(1 / 900);
  const survey = (performance.now() - t0) / 40;

  console.log(`  ground settle     ${settle.toFixed(2)} ms a visit`
    + ` (${GROUND_GRID}x${GROUND_GRID} cells, five fields)`);
  console.log(`  tier survey       ${survey.toFixed(2)} ms a visit`);
  console.log(`  memory            ${Math.round(g.bytes() / 1024)} KiB of field,`
    + ` ${Math.round(sim.life.bytes() / 1024)} KiB of patience`);
  ok(settle < 6, 'the field settle is cheap', `${settle.toFixed(2)} ms`);
  ok(survey < 4, 'the tier survey is cheap', `${survey.toFixed(2)} ms`);
}

// ---- helpers ---------------------------------------------------------------

function health(sim) {
  const p = sim.places, c = p.col;
  let sum = 0, n = 0;
  for (let id = 0; id < p.count; id++) {
    if (p.live[id] === 0) continue;
    if (c.homes[id] === 0 && c.jobs[id] === 0) continue;
    if (c.purpose[id] === 4) continue;
    sum += c.health[id] / 255; n++;
  }
  return n > 0 ? sum / n : 0;
}

function meanSupply(sim) {
  const p = sim.places, c = p.col, u = sim.utilities;
  let power = 0, water = 0, n = 0;
  for (let id = 0; id < p.count; id++) {
    if (p.live[id] === 0 || c.purpose[id] === 4) continue;
    if (c.homes[id] === 0 && c.jobs[id] === 0) continue;
    power += u.at(id, 0); water += u.at(id, 1); n++;
  }
  return n > 0 ? [power / n, water / n] : [0, 0];
}

function countAiling(sim) {
  const p = sim.places, c = p.col;
  let n = 0;
  for (let id = 0; id < p.count; id++) {
    if (p.live[id] === 0 || c.purpose[id] === 4) continue;
    if (c.homes[id] === 0 && c.jobs[id] === 0) continue;
    if (c.health[id] < DERELICT_AT) n++;
  }
  return n;
}

function count(a) {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== 0) n++;
  return n;
}

function meanTier(world) {
  let sum = 0, n = 0;
  for (let i = 0; i < world.zones.length; i++) {
    if (world.zones[i] === 0) continue;
    sum += world.tier[i]; n++;
  }
  return n > 0 ? sum / n : 0;
}

console.log(failed === 0 ? `\nLIFE_CYCLE_OK  ${checks}/${checks} checks`
  : `\nLIFE_CYCLE_FAIL  ${failed} of ${checks} checks`);
process.exit(failed === 0 ? 0 : 1);
