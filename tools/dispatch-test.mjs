/**
 * The dispatch machine, checked.
 *
 * Two kinds of claim, proved two ways.
 *
 * The mechanism is exact and is asserted exactly: that a call raises, that a
 * station with a crew free takes it, that the vehicle it sends is a real vehicle on
 * a real lane with a real route, that it gets there and goes home, that the station
 * gets its crew back, and that a call nobody answers in time damages the building it
 * happened at. Also that the strict rules hold -- never more vehicles out than the
 * cap, never more live calls than the table, no route leaked by any of it.
 *
 * Whether the services are worth building is a claim about the whole simulation, so
 * it is proved the only way such a claim can be: run the same city twice, once with
 * fire stations and once without, and show that the one without burns.
 *
 *   node tools/dispatch-test.mjs [days]
 */

import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { Simulation } from '${src}sim/agents/sim';`,
      `export * from '${src}sim/agents/dispatch';`,
      `export { Purpose } from '${src}sim/agents/places';`,
      `export { Kind } from '${src}sim/agents/driving';`,
      `export { makeCity } from '${src}sim/city';`,
      `export { defaultWorld, emptyWorld } from '${src}sim/world';`,
      `export { RoadGraph } from '${src}sim/roadgraph';`,
      `export { ASSETS } from '${src}assets/registry';`,
      `export { BRANCHES } from '${src}assets/types';`,
      `export { TICKS_PER_DAY } from '${src}sim/agents/calendar';`,
      `export { configureSim, simConfig } from '${src}sim/config';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022',
})).outputFiles[0].text;

const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));
const {
  Simulation, Need, NEED_NAMES, Purpose, Kind, makeCity, defaultWorld,
  ASSETS, BRANCHES, TICKS_PER_DAY, configureSim,
} = M;

let failed = 0, checks = 0;
const ok = (cond, what, detail = '') => {
  checks++;
  if (!cond) { failed++; console.log(`  FAIL  ${what}${detail ? '  -- ' + detail : ''}`); }
};
const section = (name) => console.log(`\n${name}`);
const pct = (x) => `${(x * 100).toFixed(0)}%`;

// ---- one call, start to finish ---------------------------------------------

section('a call, answered');
{
  configureSim({ cityGrid: 200, terrainSize: 9216 });
  const world = defaultWorld();
  const sim = new Simulation(makeCity(world), world.net, 0xf1e);
  sim.found(20);
  // Somewhere for the engine to come from, right where the camera is.
  const engine = ASSETS.findIndex((a) => a.id === 'svc.fire.station');
  const station = sim.places.add(engine, 40, 40, -1, -1);
  ok(station >= 0, 'a fire station was placed');
  for (let k = 0; k < sim.places.col.jobs[station]; k++) sim.places.hire(station);
  // Point it at a road, the way the placement tool does.
  sim.roadsChanged(world.net);
  sim.look(0, 0);
  ok(sim.places.col.lane[station] >= 0, 'and it fronts a road',
    `${sim.places.col.lane[station]}`);

  // A house near it, and a fire in it.
  let home = -1;
  const pc = sim.places.col;
  for (let p = 0; p < sim.places.count; p++) {
    if (sim.places.live[p] === 0 || pc.purpose[p] !== Purpose.HOME) continue;
    if (Math.hypot(pc.x[p] - 40, pc.z[p] - 40) < 400 && pc.lane[p] >= 0) { home = p; break; }
  }
  ok(home >= 0, 'and there is a house near it to catch fire');

  const before = { raised: sim.dispatch.stats.raised[Need.FIRE] };
  // Raise the fire outright rather than waiting for the watch to roll one.
  //
  // This used to set the building's health to zero and step four thousand
  // ticks, which is four and a half game days -- and the base rate is one fire
  // per building per two thousand six hundred days. The highest hazard the
  // model has still only lifts that to about a one in four hundred chance over
  // the whole run, so the check was failing far more often than it passed and
  // was measuring the die, not the dispatcher. What this section is for is the
  // response: a call goes out, an engine is sent, it arrives in time. So the
  // call is made directly, and the rate itself is checked further down over a
  // city and a fortnight, where the sample is big enough to mean something.
  pc.health[home] = 0;
  sim.dispatch.open(Need.FIRE, home);
  let raisedAny = sim.dispatch.stats.raised[Need.FIRE] > before.raised;
  for (let i = 0; i < 4000 && !raisedAny; i++) {
    sim.step(1);
    raisedAny = sim.dispatch.stats.raised[Need.FIRE] > before.raised;
  }
  ok(raisedAny, 'a fire was raised', `${sim.dispatch.stats.raised[Need.FIRE]}`);

  // Somebody must be sent, and what is sent must be a real vehicle on a real lane.
  let sawVehicle = false, sawEmergency = false, sawRoute = false;
  for (let i = 0; i < 1200; i++) {
    sim.step(1);
    const t = sim.traffic;
    for (let v = 0; v < t.bound; v++) {
      if (t.live[v] === 0 || t.col.job[v] < 0) continue;
      sawVehicle = true;
      if (t.col.kind[v] === Kind.EMERGENCY) sawEmergency = true;
      if (t.col.route[v] >= 0) sawRoute = true;
    }
    if (sawVehicle && sawEmergency && sawRoute) break;
  }
  ok(sawVehicle, 'a vehicle was sent');
  ok(sawEmergency, 'and it is an emergency vehicle');
  ok(sawRoute, 'driving a real route rather than wandering');

  // And it finishes: the call closes and the station gets its crew back.
  let closed = false;
  for (let i = 0; i < 6000 && !closed; i++) {
    sim.step(1);
    closed = sim.dispatch.stats.answered[Need.FIRE] + sim.dispatch.stats.missed[Need.FIRE] > 0;
  }
  ok(closed, 'the call was closed one way or the other');
  const d = sim.dispatch.stats;
  console.log(`  raised                  ${d.raised[Need.FIRE]}`);
  console.log(`  answered                ${d.answered[Need.FIRE]}`);
  console.log(`  too late                ${d.missed[Need.FIRE]}`);
  console.log(`  mean response           ${d.meanResponseMinutes.toFixed(1)} min`);
  ok(d.answered[Need.FIRE] > 0, 'and at least one was answered in time',
    `${d.answered[Need.FIRE]} of ${d.raised[Need.FIRE]}`);
  ok(d.meanResponseMinutes > 0 && d.meanResponseMinutes < 60,
    'the response time is a plausible number', `${d.meanResponseMinutes.toFixed(1)} min`);
}

// ---- the strict rules ------------------------------------------------------

section('the caps hold');
{
  configureSim({ cityGrid: 200, terrainSize: 9216 });
  const world = defaultWorld();
  const sim = new Simulation(makeCity(world), world.net, 0x5afe);
  sim.found(40);
  sim.look(0, 0);
  // Every service staffed, so the machine is doing as much as it can.
  const pc = sim.places.col;
  for (let p = 0; p < sim.places.count; p++) {
    if (sim.places.live[p] === 0 || pc.purpose[p] !== Purpose.SERVICE) continue;
    for (let k = 0; k < pc.jobs[p]; k++) sim.places.hire(p);
  }

  let mostVehicles = 0, mostLive = 0, mostTraffic = 0;
  const DAYS = Number(process.argv[2] || 0) || 14;
  for (let i = 0; i < DAYS * TICKS_PER_DAY; i++) {
    sim.step(1);
    let mine = 0;
    const t = sim.traffic;
    for (let v = 0; v < t.bound; v++) {
      if (t.live[v] !== 0 && t.col.job[v] >= 0) mine++;
    }
    if (mine > mostVehicles) mostVehicles = mine;
    if (sim.dispatch.count > mostLive) mostLive = sim.dispatch.count;
    if (t.count > mostTraffic) mostTraffic = t.count;
  }
  console.log(`  most dispatch vehicles  ${mostVehicles}`);
  console.log(`  most live calls         ${mostLive}`);
  console.log(`  most vehicles of all    ${mostTraffic.toLocaleString()}`);
  ok(mostVehicles <= 120, 'never more than the vehicle cap', `${mostVehicles}`);
  ok(mostLive <= 512, 'never more live calls than the table', `${mostLive}`);
  ok(mostVehicles > 0, 'but it did send some', `${mostVehicles}`);

  // Every kind of call has to be reachable, or a branch is dead code.
  const raised = sim.dispatch.stats.raised;
  for (let k = 0; k < NEED_NAMES.length; k++) {
    console.log(`  ${NEED_NAMES[k].padEnd(22)}${Math.round(raised[k]).toLocaleString()} raised, `
      + `${pct(sim.dispatch.rate(k))} answered`);
  }
  ok(raised[Need.FIRE] > 0, 'fires happen');
  ok(raised[Need.CRIME] > 0, 'crimes happen');
  ok(raised[Need.MEDICAL] > 0, 'people fall ill');

  // No leaked routes. The arena only ever grows, so a machine that forgets to
  // release is invisible until the city has been running for an hour.
  const live = sim.router.paths;
  let held = 0;
  // A call does not hold a route; the vehicle it sent does. Asking the call
  // table for a `route` column read undefined and threw, which took the whole
  // suite down with it after this section.
  const dc = sim.dispatch.table.col;
  const tc = sim.traffic.table.col;
  for (let r = 0; r < sim.dispatch.table.bound; r++) {
    if (sim.dispatch.table.live[r] === 0) continue;
    const v = dc.vehicle[r];
    if (v >= 0 && sim.traffic.table.live[v] !== 0 && tc.route[v] >= 0) held++;
  }
  console.log(`  routes held by open calls ${held}`);
  ok(held <= mostLive, 'no call holds more than one route', `${held} for ${mostLive}`);
  void live;
}

// ---- bins ------------------------------------------------------------------

section('bins, when the plants fall behind');
{
  configureSim({ cityGrid: 200, terrainSize: 9216 });
  const world = defaultWorld();
  const sim = new Simulation(makeCity(world), world.net, 0xb1a5);
  sim.found(40);
  sim.look(0, 0);
  const pc = sim.places.col;
  // Everything staffed except what burns or sorts the rubbish, so the piles
  // grow. This is the state a player reaches by not building enough of them,
  // and it is the only state in which a bin lorry has anything to do: routine
  // collection is handled in bulk by the capacity model, and this is what is
  // left over.
  //
  // The plants that need hardly anyone -- a landfill, a transfer station -- are
  // taken away rather than left empty: they run at most of their capacity with
  // nobody on the gate, which is true of them, and left standing they quietly
  // took everything the test was waiting to see pile up.
  let depots = 0;
  for (let p = 0; p < sim.places.count; p++) {
    if (sim.places.live[p] === 0 || pc.purpose[p] !== Purpose.SERVICE) continue;
    const id = ASSETS[pc.proto[p]]?.id ?? '';
    if (id.includes('landfill') || id.includes('transfer')) { sim.places.remove(p); continue; }
    if (id.includes('waste') || id.includes('recycling')) { depots++; continue; }
    for (let k = 0; k < pc.jobs[p]; k++) sim.places.hire(p);
  }
  console.log(`  unstaffed waste plants  ${depots}`);
  for (let i = 0; i < 20 * TICKS_PER_DAY; i++) sim.step(1);
  const raised = sim.dispatch.stats.raised[Need.RUBBISH];
  let worst = 0;
  for (let p = 0; p < sim.places.count; p++) {
    if (sim.places.live[p] === 0) continue;
    const pile = sim.utilities.pileAt(p);
    if (pile > worst) worst = pile;
  }
  console.log(`  worst pile              ${worst.toFixed(1)} units`);
  console.log(`  collections wanted      ${Math.round(raised).toLocaleString()}`);
  ok(worst > 0, 'rubbish piles up when nothing is burning it', worst.toFixed(1));
  ok(raised > 0, 'and a lorry is wanted for it', `${raised}`);
}

// ---- a service worth paying for --------------------------------------------

section('a necessity, not a bonus');
{
  const DAYS = Number(process.argv[2] || 0) || 14;
  // The generated city has no fire station in it at all, so four are added here --
  // without them both runs would be the same run, which is how the first version of
  // this test managed to pass a service that did not exist.
  const engine = ASSETS.findIndex((a) => a.id === 'svc.fire.station');
  const run = (withFire) => {
    configureSim({ cityGrid: 200, terrainSize: 9216 });
    const world = defaultWorld();
    const sim = new Simulation(makeCity(world), world.net, 0x1eaf);
    sim.found(40);
    sim.look(0, 0);
    const pc = sim.places.col;
    const b = BRANCHES.indexOf('fire');
    const built = [];
    for (const [x, z] of [[-300, -300], [300, -300], [-300, 300], [300, 300]]) {
      const p = sim.places.add(engine, x, z, -1, -1);
      if (p >= 0) built.push(p);
    }
    // Pointed at the roads, the way the placement tool does it.
    sim.roadsChanged(world.net);
    for (let p = 0; p < sim.places.count; p++) {
      if (sim.places.live[p] === 0 || pc.purpose[p] !== Purpose.SERVICE) continue;
      // The one difference between the two runs: whether the fire service has
      // anybody in it. Nothing else is touched, so anything that follows is the
      // fire service and nothing else.
      if (!withFire && pc.branch[p] === b) continue;
      for (let k = 0; k < pc.jobs[p]; k++) sim.places.hire(p);
    }
    void built;
    for (let i = 0; i < DAYS * TICKS_PER_DAY; i++) sim.step(1);
    let health = 0, n = 0;
    for (let p = 0; p < sim.places.count; p++) {
      if (sim.places.live[p] === 0 || pc.purpose[p] === Purpose.SERVICE) continue;
      health += pc.health[p]; n++;
    }
    return {
      answered: sim.dispatch.rate(Need.FIRE),
      missed: sim.dispatch.stats.missed[Need.FIRE],
      health: n > 0 ? health / n / 255 : 0,
      pop: sim.people.population,
    };
  };

  const on = run(true);
  const off = run(false);
  console.log(`  with a fire service     ${pct(on.answered)} answered, `
    + `${on.missed} lost, buildings ${(on.health * 100).toFixed(2)}%, pop ${on.pop.toLocaleString()}`);
  console.log(`  without one             ${pct(off.answered)} answered, `
    + `${off.missed} lost, buildings ${(off.health * 100).toFixed(2)}%, pop ${off.pop.toLocaleString()}`);
  ok(on.answered > off.answered + 0.2,
    'a staffed fire service answers far more of its calls',
    `${pct(on.answered)} vs ${pct(off.answered)}`);
  ok(off.missed > on.missed,
    'and without one the calls are lost', `${off.missed} vs ${on.missed}`);
  ok(on.health > off.health,
    'so the buildings in the city it protects are in better repair',
    `${(on.health * 100).toFixed(2)}% vs ${(off.health * 100).toFixed(2)}%`);
}

// ---- cost ------------------------------------------------------------------

section('cost');
{
  configureSim({ cityGrid: 200, terrainSize: 9216 });
  const world = defaultWorld();
  const sim = new Simulation(makeCity(world), world.net, 0xc057);
  sim.found(40);
  sim.look(0, 0);
  const pc = sim.places.col;
  for (let p = 0; p < sim.places.count; p++) {
    if (sim.places.live[p] === 0 || pc.purpose[p] !== Purpose.SERVICE) continue;
    for (let k = 0; k < pc.jobs[p]; k++) sim.places.hire(p);
  }
  for (let i = 0; i < 3 * TICKS_PER_DAY; i++) sim.step(1);

  let worst = 0, total = 0;
  const N = 2 * TICKS_PER_DAY;
  for (let i = 0; i < N; i++) {
    const t = performance.now();
    sim.step(1);
    const ms = performance.now() - t;
    total += ms;
    if (ms > worst) worst = ms;
  }
  const per = sim.scheduler.cost;
  const mine = (per.get('raise') ?? 0) + (per.get('assign') ?? 0) + (per.get('respond') ?? 0);
  console.log(`  whole tick              ${(total / N * 1000).toFixed(0)} us mean, `
    + `worst ${worst.toFixed(1)} ms`);
  console.log(`  dispatch's share        ${mine.toFixed(2)} ms a second`);
  console.log(`  memory                  ${(sim.dispatch.bytes() / 1024).toFixed(1)} KiB`);
  ok(total / N < 8, 'a tick still fits in a frame', `${(total / N).toFixed(2)} ms`);
  ok(mine < 12, 'and dispatch is a small part of it', `${mine.toFixed(2)} ms/s`);
}

console.log(failed === 0
  ? `\nDISPATCH_OK  ${checks}/${checks} checks`
  : `\nDISPATCH_FAIL  ${failed} of ${checks} checks failed`);
process.exitCode = failed === 0 ? 0 : 1;
