/**
 * The population, over time.
 *
 * Everything in the demographic model is a rate, and a rate is impossible to
 * judge by reading it. Eleven per cent of households having a child per year
 * sounds reasonable and might be a population that halves every month. So this
 * runs a real city for a few hundred game days and prints the curves: who came,
 * who left, who was born, who died, how old they all are, and what it cost per
 * tick to work out.
 *
 * It is a measurement tool as much as a test. The assertions at the end are the
 * things that must never be true -- a population that collapses, a population that
 * explodes, everybody unemployed, nobody ever travelling -- and the numbers above
 * them are for judging whether the curve is the one the game wants.
 *
 *   node tools/city-life.mjs [days] [grid]
 */

import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { Simulation } from '${src}sim/agents/sim';`,
      `export * from '${src}sim/agents/people';`,
      `export * from '${src}sim/agents/places';`,
      `export * from '${src}sim/agents/calendar';`,
      `export { MODE_NAMES, MODES, belongs } from '${src}sim/agents/routine';`,
      `export { makeCity } from '${src}sim/city';`,
      `export { defaultWorld, startingWorld, paint, ZONES, DENSITIES } from '${src}sim/world';`,
      `export { RoadGraph } from '${src}sim/roadgraph';`,
      `export { configureSim, simConfig } from '${src}sim/config';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022',
})).outputFiles[0].text;

const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));
const {
  Simulation, STAGE_NAMES, EDU_NAMES, DOING_NAMES, Stage, Doing, NONE,
  Purpose, TICKS_PER_DAY, SECONDS_PER_DAY, YEARS_PER_DAY,
  MODE_NAMES, MODES, makeCity, defaultWorld, configureSim,
} = M;

const DAYS = Number(process.argv[2] || 0) || 120;
const GRID = Number(process.argv[3] || 0) || 220;
configureSim({ cityGrid: GRID });

// ---- a city to live in ----------------------------------------------------
// The procedural city, which is the one the game actually builds: a mixed grid of
// housing, shops, offices, industry and services, with a real road network under
// it. Anything hand-made here would be a city whose demographics were decided by
// whoever made it.
const t0 = performance.now();
const world = defaultWorld();
const city = makeCity(world);
const built = performance.now() - t0;
// The network the spawner actually used. Anything else means buildings that do
// not front onto a road, which shows up as trips that cannot reach the network
// and is a property of the test rather than of the game.
const net = world.net;

const sim = new Simulation(city, net, 0xc17a);
sim.look(0, 0);

const p = sim.places;
console.log(`city            ${city.count.toLocaleString()} instances in ${built.toFixed(0)} ms, `
  + `${(GRID * 8 / 1000).toFixed(1)} km square`);
console.log(`places          ${p.table.size.toLocaleString()} occupiable  `
  + `(${p.homes.size.toLocaleString()} residential, ${p.homeCapacity.toLocaleString()} homes, `
  + `${p.jobCapacity.toLocaleString()} jobs)`);
const byBranch = p.byBranch.map((pool, i) => [i, pool.size]).filter(([, n]) => n > 0);
console.log(`services        ${byBranch.length} branches built, `
  + `${byBranch.reduce((a, [, n]) => a + n, 0)} buildings`);
console.log(`a game day      ${SECONDS_PER_DAY} s, ${TICKS_PER_DAY} ticks; `
  + `a year of life is ${(1 / YEARS_PER_DAY).toFixed(0)} days\n`);

sim.found(12);
console.log(`founded with    ${sim.people.population} people in ${sim.people.households.size} households\n`);

// ---- run it ---------------------------------------------------------------
const rows = [];
let worstTick = 0, totalMs = 0, ticks = 0, worstAt = '';
let spikes = 0;
const hist = new Int32Array(7);
const RATES = [2, 8, 32, 128, 512];
const phase = new Int32Array(RATES.length);
const costs = new Map();
let samples = 0;

for (let day = 0; day < DAYS; day++) {
  const before = performance.now();
  for (let t = 0; t < TICKS_PER_DAY; t++) {
    const t1 = performance.now();
    sim.step(1);
    const dt = performance.now() - t1;
    if (dt > worstTick) { worstTick = dt; worstAt = `tick ${sim.clock.tick}, day ${day}, pop ${sim.people.population}`; }
    // A histogram rather than a maximum. In a garbage-collected runtime the
    // maximum is a fact about the collector; the shape of the distribution is a
    // fact about the simulation, and it is the one worth asserting on.
    const bucket = dt < 0.5 ? 0 : dt < 1 ? 1 : dt < 2 ? 2 : dt < 4 ? 3 : dt < 8 ? 4 : dt < 16 ? 5 : 6;
    hist[bucket]++;
    if (dt > 4) {
      spikes++;
      // Which periodic system a spike lands on, from where it sits in each rate's
      // cycle. A spike that is always on the same phase of one rate is that
      // system; one spread evenly across all of them is the collector.
      for (let k = 0; k < RATES.length; k++) {
        if (sim.clock.tick % RATES[k] === 0) phase[k]++;
      }
    }
    ticks++;
  }
  totalMs += performance.now() - before;
  if (sim.scheduler.cost.size > 0) {
    samples++;
    for (const [k, v] of sim.scheduler.cost) costs.set(k, (costs.get(k) || 0) + v);
  }

  if (day % Math.max(1, Math.floor(DAYS / 18)) === 0 || day === DAYS - 1) {
    const f = sim.migration.flow;
    const ppl = sim.people;
    rows.push({
      day,
      pop: ppl.population,
      hh: ppl.households.size,
      queue: f.queue,
      appeal: f.appeal,
      unemp: ppl.unemployment,
      happy: ppl.happiness,
      arr: f.arrivalsPerDay,
      dep: f.departuresPerDay,
      births: ppl.births,
      deaths: ppl.deaths,
      moving: sim.routine.travelling,
      spare: p.spareHomes,
    });
  }
}

// ---- the curves -----------------------------------------------------------
console.log('day    pop     h/holds  queue  appeal  unemp  happy  +/day  -/day  travelling  spare homes');
for (const r of rows) {
  console.log(
    String(r.day).padStart(4)
    + String(r.pop.toLocaleString()).padStart(9)
    + String(r.hh.toLocaleString()).padStart(9)
    + String(r.queue).padStart(7)
    + (r.appeal * 100).toFixed(0).padStart(7) + '%'
    + (r.unemp * 100).toFixed(0).padStart(6) + '%'
    + (r.happy * 100).toFixed(0).padStart(6) + '%'
    + r.arr.toFixed(1).padStart(7)
    + r.dep.toFixed(1).padStart(7)
    + String(r.moving.toLocaleString()).padStart(12)
    + String(r.spare.toLocaleString()).padStart(13));
}

const ppl = sim.people;
const f = sim.migration.flow;
console.log(`\nover ${DAYS} days`);
console.log(`  arrived       ${f.arrived.toLocaleString()} households`);
console.log(`  departed      ${f.departed.toLocaleString()} households`);
console.log(`  gave up       ${f.gaveUp.toLocaleString()} applicants (no home they could take)`);
console.log(`  born          ${ppl.births.toLocaleString()}`);
console.log(`  died          ${ppl.deaths.toLocaleString()}`);

const pyramid = [...ppl.byStage];
const total = Math.max(1, ppl.population);
console.log(`\nage`);
for (let s = 0; s < pyramid.length; s++) {
  const share = pyramid[s] / total;
  console.log(`  ${STAGE_NAMES[s].padEnd(8)} ${String(pyramid[s]).padStart(7)}  `
    + (share * 100).toFixed(1).padStart(5) + '%  ' + '#'.repeat(Math.round(share * 50)));
}
console.log(`school places`);
for (let lv = 1; lv <= 3; lv++) {
  const [taken, made] = p.schoolPlaces(lv);
  console.log(`  ${['', 'school', 'college', 'university'][lv].padEnd(11)} `
    + `${taken.toLocaleString()} of ${made.toLocaleString()}`);
}
console.log(`education`);
for (let e = 0; e < EDU_NAMES.length; e++) {
  console.log(`  ${EDU_NAMES[e].padEnd(11)} ${String(ppl.byEdu[e]).padStart(7)}  `
    + (ppl.byEdu[e] / total * 100).toFixed(1).padStart(5) + '%');
}

// What everybody is doing right now.
const doing = new Int32Array(DOING_NAMES.length);
const c = ppl.citizens.col;
for (let i = 0; i < ppl.citizens.bound; i++) if (ppl.citizens.live[i]) doing[c.doing[i]]++;
console.log(`doing, at ${sim.clock.label}`);
for (let d = 0; d < doing.length; d++) {
  if (doing[d] === 0) continue;
  console.log(`  ${DOING_NAMES[d].padEnd(11)} ${String(doing[d]).padStart(7)}  `
    + (doing[d] / total * 100).toFixed(1).padStart(5) + '%');
}

const trips = sim.routine.stats;
console.log(`\ntrips`);
console.log(`  started       ${trips.started.toLocaleString()}  arrived ${trips.arrived.toLocaleString()}`);
console.log(`  per person a day  ${(trips.started / total / DAYS).toFixed(2)}`);
console.log(`                (a travel survey measures about three; this counts the`);
console.log(`                 ones that matter -- the cost is linear in the rate)`);
console.log(`  estimated     ${trips.estimated.toLocaleString()} `
  + `(${(trips.estimated / Math.max(1, trips.started) * 100).toFixed(0)}% not routed; `
  + `each routed trip stands for ${sim.routine.sampleWeight.toFixed(1)})`);
console.log(`  stranded      ${trips.stranded.toLocaleString()} `
  + `(no lane ${trips.noLane.toLocaleString()}, timed out ${trips.timedOut.toLocaleString()}, `
  + `lost route ${trips.lostRoute.toLocaleString()})`);
console.log(`  journey       ${trips.meanMinutes.toFixed(0)} game minutes on average`);
console.log(`  mode split    ` + [...trips.byMode].map((n, i) =>
  `${MODE_NAMES[i]} ${(n / Math.max(1, trips.started) * 100).toFixed(0)}%`).join(', '));
console.log(`  lane load     at its worst: ${(sim.routine.peakMeanLoad * 100).toFixed(0)}% mean, `
  + `${(sim.routine.peakLoad * 100).toFixed(0)}% on the busiest lane`);
const rs = sim.router.stats;
console.log(`  router        ${sim.router.report}, ${(sim.router.hitRate * 100).toFixed(0)}% cached`);
console.log(`  router calls  solved ${rs.solved.toLocaleString()} cached ${rs.cached.toLocaleString()} `
  + `failed ${rs.failed.toLocaleString()} stale ${rs.stale.toLocaleString()} `
  + `refused ${rs.refused.toLocaleString()}`);

console.log(`\ncost`);
console.log(`  ${DAYS} days in ${(totalMs / 1000).toFixed(1)} s of real time `
  + `(${(totalMs / ticks * 1000).toFixed(0)} us a tick, worst ${worstTick.toFixed(1)} ms at ${worstAt})`);
const pct = (n) => (n / ticks * 100).toFixed(2) + '%';
console.log('  tick spread   ' + ['<0.5', '<1', '<2', '<4', '<8', '<16', '16+']
  .map((label, i) => `${label}ms ${pct(hist[i])}`).join('  '));
if (spikes > 0) {
  console.log(`  spikes >4ms   ${spikes} (${pct(spikes)}); of those, on a tick divisible by: `
    + RATES.map((r, i) => `${r} ${(phase[i] / spikes * 100).toFixed(0)}%`).join(', ')
    + `  (chance alone would give ${RATES.map((r) => `${(100 / r).toFixed(0)}%`).join(', ')})`);
}
const perSecond = [...costs].sort((a, b) => b[1] - a[1]);
const grand = perSecond.reduce((a, [, v]) => a + v, 0) || 1;
for (const [name, ms] of perSecond) {
  if (ms < grand * 0.005) continue;
  console.log(`  ${name.padEnd(9)} ${(ms / grand * 100).toFixed(0).padStart(3)}% of the tick`);
}
console.log(`  memory        ${sim.report.memory}`);

// ---- the things that must not be true -------------------------------------
let failed = 0, checks = 0;
const ok = (cond, what, detail = '') => {
  checks++;
  if (!cond) { failed++; console.log(`  FAIL  ${what}${detail ? '  -- ' + detail : ''}`); }
};
console.log('');
ok(ppl.population > 200, 'the city grew', `${ppl.population}`);
ok(ppl.population < p.homeCapacity * 8,
  'the population is plausible for the housing built',
  `${ppl.population} people in ${p.homeCapacity} homes`);
ok(ppl.households.size <= p.homeCapacity,
  'no more households than homes', `${ppl.households.size} vs ${p.homeCapacity}`);
ok(ppl.deaths > 0, 'people die', `${ppl.deaths}`);
ok(ppl.births > 0, 'people are born', `${ppl.births}`);
ok(pyramid[Stage.SENIOR] > 0, 'the city has old people in it');
ok(pyramid[Stage.INFANT] + pyramid[Stage.CHILD] > 0, 'and children');
ok(ppl.unemployment < 0.35, 'most people who want work have it',
  `${(ppl.unemployment * 100).toFixed(0)}%`);
ok(trips.started > total, 'people make trips', `${trips.started}`);
ok(trips.arrived > trips.started * 0.9, 'and nearly all of them finish',
  `${trips.arrived}/${trips.started}`);
ok(trips.stranded < trips.started * 0.06, 'few trips fail outright',
  `${(trips.stranded / Math.max(1, trips.started) * 100).toFixed(1)}%`);
ok([...trips.byMode].filter((n) => n > 0).length >= 2, 'more than one way to travel is used',
  [...trips.byMode].join(','));
ok(sim.routine.travelling <= ppl.population, 'nobody travels who does not exist');
// Consistency of every running total against a count from scratch. The running
// totals are what the game reads -- the walks are what they are supposed to be --
// and a drift between them is the failure mode of this whole design.
const m = ppl.measure();
let inHomes = 0;
for (let i = 0; i < ppl.households.bound; i++) {
  if (ppl.households.live[i] === 0) continue;
  if (ppl.households.col.home[i] !== NONE) inHomes++;
}
ok(m.population === ppl.population, 'the population count is the population',
  `${ppl.population} vs ${m.population}`);
ok(m.employed === ppl.employed, 'the employment count is right', `${ppl.employed} vs ${m.employed}`);
ok(m.students === ppl.students, 'the student count is right', `${ppl.students} vs ${m.students}`);
ok(m.moodSum === ppl.moodTotal, 'the maintained mood total is exact',
  `${ppl.moodTotal} vs ${m.moodSum}`);
let schoolTaken = 0;
for (let i = 0; i < p.count; i++) if (p.live[i]) schoolTaken += p.col.studying[i];
ok(schoolTaken === ppl.students, 'school places taken match the students',
  `${schoolTaken} vs ${ppl.students}`);
ok(inHomes === p.households, 'housed households match occupied homes',
  `${p.households} vs ${inHomes}`);
let jobsTaken = 0, homesTaken = 0;
for (let i = 0; i < p.count; i++) {
  if (p.live[i] === 0) continue;
  jobsTaken += p.col.working[i];
  homesTaken += p.col.living[i];
}
ok(jobsTaken === p.workers, 'occupied jobs match the total', `${p.workers} vs ${jobsTaken}`);
ok(homesTaken === p.households, 'occupied homes match the total', `${p.households} vs ${homesTaken}`);
// On the distribution, not the maximum. The spikes are spread evenly across every
// rate's phase -- which is the signature of the garbage collector, not of any
// system in here -- so the maximum measures the runtime and the shape measures the
// simulation. What must hold is that the simulation itself is flat.
const under4 = (hist[0] + hist[1] + hist[2] + hist[3]) / ticks;
ok(under4 > 0.98, '98% of ticks are under 4 ms', `${(under4 * 100).toFixed(2)}%`);
ok(hist[6] / ticks < 0.001, 'almost no tick exceeds 16 ms',
  `${(hist[6] / ticks * 100).toFixed(3)}%`);
ok(worstTick < 80, 'and nothing stalls outright', `${worstTick.toFixed(1)} ms`);
ok(totalMs / ticks < 4, 'the average tick leaves the frame alone',
  `${(totalMs / ticks * 1000).toFixed(0)} us`);

// ---- what one building says about itself -----------------------------------
//
// The card the player gets when they click a building is a join across five
// tables, and a join is exactly the kind of thing that keeps compiling while
// quietly reading the wrong row. So: pick a real home out of the places table,
// ask the simulation what is at its coordinates, and check the answer describes
// that building rather than its neighbour.
{
  const col = sim.places.col;
  let home = -1;
  for (let id = 0; id < sim.places.count; id++) {
    if (sim.places.live[id] !== 0 && col.homes[id] > 0) { home = id; break; }
  }
  ok(home >= 0, 'the city has somewhere to live', `place ${home}`);
  const card = sim.inspect(col.x[home], col.z[home]);
  ok(card !== null, 'clicking it finds a building');
  ok(card?.place === home, 'and finds that one', `${card?.place} vs ${home}`);
  ok(card?.homes === col.homes[home], 'with the right number of homes',
    `${card?.homes} vs ${col.homes[home]}`);
  ok(card?.residents === col.living[home], 'and the people actually in them',
    `${card?.residents} vs ${col.living[home]}`);
  ok((card?.cover.length ?? 0) >= 5, 'and its service coverage',
    `${card?.cover.length} branches`);
  ok(card !== null && card.power >= 0 && card.power <= 1,
    'power reads as a share', `${card?.power}`);
  // Far out over the water, where the city is not: a click on nothing has to
  // come back as nothing rather than as the nearest building half a mile away.
  const far = sim.inspect(GRID * 8, GRID * 8);
  ok(far === null, 'and clicking open ground finds nothing');
  console.log(`\ninspect         "${card?.name}" ${card?.residents}/${(card?.homes ?? 0) * 2} `
    + `residents, power ${Math.round((card?.power ?? 0) * 100)}%, `
    + `${card?.gripe === '' ? 'no complaint' : card?.gripe}`);
}

console.log(`\n${failed === 0 ? 'LIFE_OK' : 'LIFE_FAIL'}  ${checks - failed}/${checks} checks`);
process.exit(failed === 0 ? 0 : 1);
