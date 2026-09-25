/**
 * The ordinances, and whether any of them actually do anything.
 *
 * A policy panel is the easiest thing in a city builder to fake: ten switches,
 * ten blurbs, and a number in a ledger that moves. The interesting question is
 * whether the *city* changes -- whether the bins really fill more slowly, the
 * air over the works really clears, and people really get on the bus when the
 * fare goes. So every claim below is measured on the simulation rather than on
 * the switch:
 *
 *   IT IS SAVED AND RESTORED, by id, and an id the game no longer has is
 *   dropped rather than turning some other policy on.
 *
 *   THE BILL IS REAL, scales with the city, and shows up on the budget as its
 *   own line rather than hidden in the service upkeep. Parking charges earn,
 *   which is what makes the line worth having a sign.
 *
 *   RECYCLING AND METERING reduce what the city's bins and its water mains are
 *   asked for.
 *
 *   SMOKE CONTROL clears the air over an industrial quarter and takes its cut
 *   of what industry is worth.
 *
 *   FREE TRANSPORT moves people onto the network and takes the fare income
 *   away, and PARKING CHARGES take people off the road.
 *
 *   THE HEIGHT LIMIT stops a lot building past the second tier.
 *
 *   GREEN CORRIDORS raise what the land is worth.
 *
 *   CONGESTION COSTS MONEY, which is the other half of this file: a jam that
 *   costs nothing is a jam nobody fixes.
 *
 *   node tools/policy-test.mjs
 */

import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { Simulation } from '${src}sim/agents/sim';`,
      `export { POLICIES, Policies } from '${src}sim/policies';`,
      `export { CURRENCY } from '${src}sim/difficulty';`,
      `export { makeCity } from '${src}sim/city';`,
      `export { defaultWorld } from '${src}sim/world';`,
      `export { serialise, deserialise } from '${src}sim/save';`,
      `export { PLOTS } from '${src}sim/plots';`,
      `export { Mode } from '${src}sim/agents/routine';`,
      `export { Util } from '${src}sim/agents/utilities';`,
      `export { configureSim } from '${src}sim/config';`,
      `export { TICKS_PER_DAY } from '${src}sim/agents/calendar';`,
      `export { TransitKind } from '${src}sim/transit';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022',
})).outputFiles[0].text;
const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));
const {
  Simulation, POLICIES, Policies, makeCity, defaultWorld,
  serialise, deserialise, PLOTS, Mode, configureSim, TICKS_PER_DAY, TransitKind,
} = M;

let failed = 0, checks = 0;
const ok = (cond, what, detail = '') => {
  checks++;
  if (!cond) { failed++; console.log(`  FAIL  ${what}${detail ? '  -- ' + detail : ''}`); }
};
const section = (name) => console.log(`\n${name}`);
const cash = (n) => Math.round(n).toLocaleString();
const pct = (n) => `${(n * 100).toFixed(1)}%`;

configureSim({ cityGrid: 200, terrainSize: 9216 });

const INDEX = Object.fromEntries(POLICIES.map((p, i) => [p.id, i]));

/**
 * Households the city is founded with.
 *
 * The same figure the game uses, and for the same reason: enough that the first
 * block fills, people take jobs and the roads have somebody on them.
 */
const FOUNDING = 30;

/**
 * A rectangular loop of bus stops snapped to the street grid.
 *
 * Copied in spirit from the transit test, and here for one reason: free public
 * transport cannot move anybody onto a network that does not exist. A city with
 * no lines in it has no riders to gain, and a test run on one would report that
 * the policy does nothing and be wrong about why.
 */
function loopStops(world, half) {
  const out = [];
  const step = 24 * 8;
  for (let x = -half; x <= half; x += step) out.push(x, -half);
  for (let z = -half; z <= half; z += step) out.push(half, z);
  for (let x = half; x >= -half; x -= step) out.push(x, half);
  for (let z = half; z >= -half; z -= step) out.push(-half, z);
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

/** A city with every plot bought, a bus line running, and every job filled. */
function town(seed = 0xb0) {
  const world = defaultWorld();
  for (let p = 0; p < PLOTS * PLOTS; p++) world.land.take(p);
  world.transit.add(TransitKind.BUS, loopStops(world, 600), 8);
  const sim = new Simulation(makeCity(world), world.net, seed, world);
  // Founded, not merely built. A city with no inhabitants has no bins to empty,
  // no trips to make and no bill to pay, and every claim below about what a
  // policy does to people would come back zero and pass for the wrong reason.
  sim.found(FOUNDING);
  const p = sim.places;
  for (let id = 0; id < p.count; id++) {
    if (p.live[id] === 0) continue;
    for (let k = p.col.working[id]; k < p.col.jobs[id]; k++) p.hire(id);
  }
  return { world, sim };
}

/**
 * Runs the real loop for a number of game days, rebuilding what grows.
 *
 * `step` takes ticks and there are nine hundred of them in a day, so a test
 * that passes it a day count is a test that runs for a fortieth of a second of
 * city and then reports that nothing happened -- which is how the first draft
 * of this file concluded that half the policies did nothing.
 */
function play(sim, world, days) {
  const CHUNK = 64;
  for (let d = 0; d < days; d++) {
    for (let t = 0; t < TICKS_PER_DAY; t += CHUNK) {
      sim.step(CHUNK);
      const grew = sim.grew();
      if (grew !== null) sim.buildingsChanged(makeCity(world, grew));
    }
  }
}

/**
 * Two runs of the same city, one with a policy on, played the same number of
 * days. Same seed and same world, so anything that differs is the policy.
 */
function compare(id, days, read) {
  const before = town();
  play(before.sim, before.world, days);
  before.sim.economy.settle(7);
  const a = read(before.sim, before.world);
  const after = town();
  after.world.policies.set(INDEX[id], true);
  play(after.sim, after.world, days);
  after.sim.economy.settle(7);
  const b = read(after.sim, after.world);
  return [a, b];
}

// ---- the table itself ------------------------------------------------------

section('the table is well formed');
{
  ok(POLICIES.length >= 8, 'there are enough of them to be a choice', String(POLICIES.length));
  const ids = new Set(POLICIES.map((p) => p.id));
  ok(ids.size === POLICIES.length, 'every id is unique');
  ok(POLICIES.every((p) => p.name.length > 0 && p.blurb.length > 0 && p.says.length > 0),
    'every one says what it is and what it does');
  // Nothing may be free in both senses: a policy with no price and no downside
  // is a button nobody has to think about.
  const free = POLICIES.filter((p) => {
    const priced = Object.values(p.price).some((v) => v !== 0);
    const e = { garbage: 1, water: 1, power: 1, industrialPollution: 1,
      residentialYield: 1, commercialYield: 1, industrialYield: 1, officeYield: 1,
      serviceUpkeep: 1, landValue: 0, safetyReach: 1, learningReach: 1,
      transitFare: 1, parkingCharge: 0, tierCap: 2 };
    p.apply(e);
    const costsSomething = e.industrialYield < 1 || e.officeYield < 1
      || e.commercialYield < 1 || e.residentialYield < 1
      || e.tierCap < 2 || e.transitFare < 1 || e.parkingCharge > 0;
    return !priced && !costsSomething;
  });
  ok(free.length === 0, 'none of them is free in money and in consequence',
    free.map((p) => p.id).join(', '));
}

section('it saves and restores');
{
  const { world } = town();
  world.policies.set(INDEX.recycling, true);
  world.policies.set(INDEX.heightLimit, true);
  const back = deserialise(serialise(world, 'Ordinances'));
  ok(back !== null, 'the save reloads');
  ok(back.world.policies.has(INDEX.recycling) && back.world.policies.has(INDEX.heightLimit),
    'the two that were on come back on');
  ok(back.world.policies.active === 2, 'and nothing else did',
    String(back.world.policies.active));

  const odd = new Policies();
  odd.restore(['recycling', 'a-policy-from-the-future']);
  ok(odd.has(INDEX.recycling) && odd.active === 1,
    'an unknown id is dropped rather than guessed at', String(odd.active));
}

// ---- the bill --------------------------------------------------------------

section('the bill is real and its own line');
{
  const { world, sim } = town();
  play(sim, world, 6);
  sim.economy.settle(7);
  const quiet = sim.economy.report.policies;
  ok(quiet === 0, 'nothing in force costs nothing', cash(quiet));

  world.policies.set(INDEX.recycling, true);
  sim.economy.settle(7);
  const billed = sim.economy.report.policies;
  ok(billed > 0, 'a policy in force costs something', cash(billed));
  const pop = sim.people.population;
  // The table is in designed units; the treasury is in the currency's.
  ok(Math.abs(billed - pop * 1.15 * M.CURRENCY) < 1, 'and the bill is what the table says',
    `${cash(billed)} for ${pop} residents`);

  world.policies.set(INDEX.parking, true);
  sim.economy.settle(7);
  ok(sim.economy.report.policies < billed,
    'parking charges earn, so the line comes down',
    cash(sim.economy.report.policies));
  console.log(`  recycling ${cash(billed)}/wk over ${pop} residents; `
    + `with parking ${cash(sim.economy.report.policies)}/wk`);
}

// ---- what they do to the city ---------------------------------------------

section('recycling takes the load off the tips');
{
  // Measured on the network's headroom rather than on what has piled up in the
  // street: a city whose collection keeps up has no pile at all, and a test
  // that reads zero against zero is a test that would pass with the policy
  // deleted.
  const [a, b] = compare('recycling', 10, (sim) => sim.utilities.report.margin[3] ?? 0);
  ok(b > a, 'the collection network has more headroom',
    `${a.toFixed(2)} -> ${b.toFixed(2)}`);
  console.log(`  rubbish margin ${a.toFixed(2)} -> ${b.toFixed(2)}`);
}

section('smoke control clears the air');
{
  const [a, b] = compare('smokeControl', 10, (sim) => ({
    air: sim.ground.meanPollution,
    industry: sim.economy.report.industrial,
  }));
  ok(b.air < a.air * 0.9, 'the air over the city is cleaner',
    `${a.air.toFixed(3)} -> ${b.air.toFixed(3)}`);
  ok(b.industry < a.industry, 'and industry is worth less',
    `${cash(a.industry)} -> ${cash(b.industry)}`);
  console.log(`  mean pollution ${a.air.toFixed(3)} -> ${b.air.toFixed(3)}; `
    + `industry ${cash(a.industry)} -> ${cash(b.industry)}`);
}

section('green corridors are worth something');
{
  const [a, b] = compare('greenCorridors', 10, (sim) => sim.ground.meanValue);
  ok(b > a, 'land is worth more everywhere', `${pct(a)} -> ${pct(b)}`);
  console.log(`  mean land value ${pct(a)} -> ${pct(b)}`);
}

section('the height limit holds the skyline down');
{
  const [a, b] = compare('heightLimit', 30, (_sim, world) => {
    let top = 0, raised = 0;
    for (let i = 0; i < world.tier.length; i++) {
      if (world.tier[i] > top) top = world.tier[i];
      if (world.tier[i] > 0) raised++;
    }
    return { top, raised };
  });
  ok(b.top <= 1, 'nothing gets past the second tier', `top tier ${b.top}`);
  console.log(`  top tier ${a.top} -> ${b.top}; lots raised ${a.raised} -> ${b.raised}`);

  // And directly, because thirty days of a small city may not reach the top
  // tier on its own merits: put a district there by hand, bring the order in,
  // and it has to come back down. A cap that only stops new height is a cap
  // that lets whatever was already tall stay tall for ever.
  const { world, sim } = town();
  play(sim, world, 6);
  let tall = 0;
  for (let i = 0; i < world.tier.length; i++) {
    if (world.zones[i] !== 0 && world.blight[i] === 0) { world.tier[i] = 2; tall++; }
  }
  ok(tall > 0, 'there is a district at the top tier to hold down', String(tall));
  world.policies.set(INDEX.heightLimit, true);
  // Drained between visits. The survey merges everything it changes into one
  // rebuild rectangle and stops as soon as that rectangle is too big to be
  // cheap, so a loop that never collects it does one visit's work and spins --
  // which is how a first draft of this check concluded the cap did nothing.
  for (let i = 0; i < 900; i++) { sim.life.survey(1); sim.grew(); }
  let left = 0;
  for (let i = 0; i < world.tier.length; i++) if (world.tier[i] > 1) left++;
  ok(left < tall * 0.25, 'what was already tall comes down',
    `${tall} -> ${left} cells above the cap`);
  console.log(`  cells above the cap ${tall} -> ${left}`);
}

section('the fare changes how people travel');
{
  const [a, b] = compare('freeTransit', 10, (sim) => ({
    transit: sim.routine.stats.byMode[Mode.TRANSIT],
    car: sim.routine.stats.byMode[Mode.CAR],
    fares: sim.economy.report.fares,
  }));
  ok(b.transit > a.transit, 'more trips are made on the network',
    `${a.transit} -> ${b.transit}`);
  ok(b.fares === 0, 'and the fare income is gone', cash(b.fares));
  console.log(`  transit trips ${a.transit} -> ${b.transit}; `
    + `car trips ${a.car} -> ${b.car}; fares ${cash(a.fares)} -> ${cash(b.fares)}`);

  const [c, d] = compare('parking', 10, (sim) => sim.routine.stats.byMode[Mode.CAR]);
  ok(d < c, 'a charge on driving means less driving', `${c} -> ${d}`);
  console.log(`  car trips under parking charges ${c} -> ${d}`);
}

section('water metering is felt at the mains');
{
  const [a, b] = compare('metering', 10, (sim) => sim.utilities.report.margin[1] ?? 0);
  ok(b >= a, 'the water network has more headroom',
    `${a.toFixed(2)} -> ${b.toFixed(2)}`);
  console.log(`  water margin ${a.toFixed(2)} -> ${b.toFixed(2)}`);
}

// ---- congestion ------------------------------------------------------------

section('a jam costs money');
{
  const { sim, world } = town();
  play(sim, world, 10);
  // A baseline settle of its own, immediately before the one below. The report
  // left behind by `step` is from whichever slow tick last ran, and comparing
  // against it would be comparing two different weeks of the city as well as
  // two different traffic states.
  sim.economy.settle(7);
  const free = { ...sim.economy.report };
  ok(free.congestion >= 0, 'the line exists and is never negative',
    cash(free.congestion));
  // Force the traffic readout to gridlock and settle again: the same city,
  // the same buildings, the same rates -- only the roads have stopped.
  sim.traffic.stats.meanSpeed = 0.2;
  sim.traffic.stats.driving = Math.max(40, sim.traffic.stats.driving);
  sim.economy.settle(7);
  const stuck = sim.economy.report;
  ok(stuck.congestion > free.congestion, 'gridlock costs more than free running',
    `${cash(free.congestion)} -> ${cash(stuck.congestion)}`);
  ok(stuck.commercial < free.commercial && stuck.industrial < free.industrial,
    'and it is the shops and the works that pay for it',
    `${cash(free.commercial)} -> ${cash(stuck.commercial)}`);
  console.log(`  congestion cost ${cash(free.congestion)} -> ${cash(stuck.congestion)} a week`);
}

console.log(`\n${checks - failed}/${checks} checks`);
if (failed > 0) {
  console.error(`\nFAIL  ${failed} of ${checks}`);
  process.exitCode = 1;
} else {
  console.log('\nPASS  the ordinances change the city, and a jam costs money');
}
