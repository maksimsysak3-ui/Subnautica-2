/**
 * The economy, end to end.
 *
 * Six claims, and each of them is a place where a city builder's money quietly
 * stops being money:
 *
 *   IT IS ACTUALLY CHARGED. A price nothing checks is a label. Building takes it
 *   out of the treasury, and a city that cannot pay is told so rather than
 *   getting the thing anyway.
 *
 *   IT SCALES WITH THE CITY. Twice the working city is about twice the revenue,
 *   because every tax is on what people and buildings do rather than on how many
 *   of them there are.
 *
 *   THE RATE IS A LEVER BOTH WAYS. Up: more money, less appeal, worse mood.
 *   Down: the opposite. If only one direction moved it would be a slider with
 *   one interesting end.
 *
 *   TRADE IS REAL. Industry makes goods and commerce eats them; the surplus is
 *   exported for money and the shortfall is imported for money. An industrial
 *   city earns from the outside world and a shop-only city pays it.
 *
 *   SERVICES COST. Every one of them, every week, whether it is doing anything
 *   or not -- which is the entire reason a service is a decision.
 *
 *   AND IT SAVES.
 *
 *   node tools/economy-test.mjs
 */

import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { Simulation } from '${src}sim/agents/sim';`,
      `export { Tax, TAX_NEUTRAL, TAX_MIN, TAX_MAX, STARTING_FUNDS, OVERDRAFT } from '${src}sim/budget';`,
      `export { Purpose } from '${src}sim/agents/places';`,
      `export { makeCity } from '${src}sim/city';`,
      `export { defaultWorld, emptyWorld } from '${src}sim/world';`,
      `export { serialise, deserialise } from '${src}sim/save';`,
      `export { buildingPrice, roadPrice } from '${src}sim/costs';`,
      `export { ASSETS } from '${src}assets/registry';`,
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
  Simulation, Tax, TAX_NEUTRAL, TAX_MIN, TAX_MAX, STARTING_FUNDS, OVERDRAFT,
  Purpose, makeCity, defaultWorld, serialise, deserialise,
  buildingPrice, ASSETS, PLOTS, TICKS_PER_DAY, configureSim,
} = M;

let failed = 0, checks = 0;
const ok = (cond, what, detail = '') => {
  checks++;
  if (!cond) { failed++; console.log(`  FAIL  ${what}${detail ? '  -- ' + detail : ''}`); }
};
const section = (name) => console.log(`\n${name}`);
const cash = (n) => Math.round(n).toLocaleString();

configureSim({ cityGrid: 200, terrainSize: 9216 });

function city(seed = 0xe0) {
  const world = defaultWorld();
  for (let p = 0; p < PLOTS * PLOTS; p++) world.land.take(p);
  const sim = new Simulation(makeCity(world), world.net, seed, world);
  return { world, sim };
}

/** Staffs everything, so a young city has a working economy to measure. */
function staff(sim) {
  const p = sim.places;
  for (let id = 0; id < p.count; id++) {
    if (p.live[id] === 0) continue;
    for (let k = p.col.working[id]; k < p.col.jobs[id]; k++) p.hire(id);
  }
}

// ---- the treasury is real --------------------------------------------------

section('money is actually spent');
{
  const { world } = city();
  const b = world.budget;
  ok(b.balance === STARTING_FUNDS, 'a new city starts with its funds',
    cash(b.balance));

  const clinic = ASSETS.find((a) => a.id === 'svc.health.clinic')
    ?? ASSETS.find((a) => a.zone === 'service');
  const price = buildingPrice(clinic);
  ok(b.spend(price), 'it can afford a clinic');
  ok(Math.abs(b.balance - (STARTING_FUNDS - price)) < 1,
    'and the money is gone', `${cash(b.balance)}`);

  ok(!b.spend(STARTING_FUNDS * 40), 'it cannot afford a nuclear station');
  ok(Math.abs(b.balance - (STARTING_FUNDS - price)) < 1,
    'and a refusal costs nothing', `${cash(b.balance)}`);

  // The overdraft is a floor, not a wall.
  b.balance = 1000;
  ok(b.spend(1000 + OVERDRAFT), 'it can borrow down to the floor');
  ok(!b.spend(1), 'and not a pound past it', cash(b.balance));
}

// ---- revenue scales with the city ------------------------------------------

section('revenue follows the city');
let small = 0;
{
  const a = city(0xe1);
  staff(a.sim);
  a.sim.step(400);
  const one = { ...a.sim.economy.report };
  small = one.income;
  ok(one.income > 0, 'a working city earns something', cash(one.income));
  ok(one.residential > 0 && one.commercial > 0 && one.industrial > 0,
    'from all three of housing, shops and industry',
    `${cash(one.residential)} / ${cash(one.commercial)} / ${cash(one.industrial)}`);
  ok(one.services > 0, 'and pays for its services', cash(one.services));
  console.log(`  income ${cash(one.income)}  spending ${cash(one.spending)}`
    + `  net ${cash(one.net)} a week`);
  console.log(`  residential ${cash(one.residential)}  commercial ${cash(one.commercial)}`
    + `  industrial ${cash(one.industrial)}  office ${cash(one.office)}`);
  console.log(`  services ${cash(one.services)}  roads ${cash(one.roads)}`
    + `  exports ${cash(one.exports)}  imports ${cash(one.imports)}`);

  // Half the jobs filled is about half the revenue: every tax is on activity.
  const half = city(0xe1);
  staff(half.sim);
  const p = half.sim.places;
  let fired = 0;
  for (let id = 0; id < p.count; id++) {
    if (p.live[id] === 0 || p.col.purpose[id] === Purpose.SERVICE) continue;
    const want = Math.floor(p.col.working[id] / 2);
    while (p.col.working[id] > want) { p.fire(id); fired++; }
  }
  half.sim.step(400);
  const two = { ...half.sim.economy.report };
  ok(fired > 0 && two.income < one.income * 0.75,
    'half the city at work is far less revenue',
    `${cash(one.income)} -> ${cash(two.income)}`);
}

// ---- the rate is a lever, both ways ----------------------------------------

section('the rate is a lever');
{
  const at = (rate) => {
    const { world, sim } = city(0xe2);
    for (let i = 0; i < 4; i++) world.budget.setRate(i, rate);
    staff(sim);
    sim.step(400);
    return sim;
  };
  const low = at(TAX_MIN);
  const mid = at(TAX_NEUTRAL);
  const high = at(TAX_MAX);

  ok(low.economy.report.income < mid.economy.report.income
    && mid.economy.report.income < high.economy.report.income,
    'a higher rate takes more money',
    `${cash(low.economy.report.income)} < ${cash(mid.economy.report.income)}`
    + ` < ${cash(high.economy.report.income)}`);
  ok(high.migration.taxAppeal < mid.migration.taxAppeal
    && mid.migration.taxAppeal < low.migration.taxAppeal,
    'and costs more appeal',
    `${low.migration.taxAppeal.toFixed(2)} > ${mid.migration.taxAppeal.toFixed(2)}`
    + ` > ${high.migration.taxAppeal.toFixed(2)}`);
  ok(high.people.taxMood < 0 && low.people.taxMood > 0,
    'people mind a high rate and like a low one',
    `${low.people.taxMood.toFixed(0)} vs ${high.people.taxMood.toFixed(0)}`);
  ok(Math.abs(mid.people.taxMood) < 0.001, 'and neutral is neutral',
    `${mid.people.taxMood}`);
  console.log(`  ${(TAX_MIN * 100).toFixed(0)}% ${cash(low.economy.report.income)}`
    + `   ${(TAX_NEUTRAL * 100).toFixed(0)}% ${cash(mid.economy.report.income)}`
    + `   ${(TAX_MAX * 100).toFixed(0)}% ${cash(high.economy.report.income)} a week`);
}

// ---- trade -----------------------------------------------------------------

section('industry exports, shops import');
{
  const { sim } = city(0xe3);
  staff(sim);
  sim.step(300);
  const p = sim.places;

  // Shut the works. What the shops sell now comes from outside.
  for (let id = 0; id < p.count; id++) {
    if (p.live[id] === 0 || p.col.purpose[id] !== Purpose.WORKS) continue;
    while (p.col.working[id] > 0) p.fire(id);
  }
  sim.step(300);
  const noIndustry = { ...sim.economy.report };
  ok(noIndustry.imports > 0 && noIndustry.exports === 0,
    'a city with no industry pays an import bill',
    `${cash(noIndustry.imports)} a week`);
  ok(noIndustry.goodsMade < noIndustry.goodsWanted,
    'because it makes less than its shops want',
    `${cash(noIndustry.goodsMade)} vs ${cash(noIndustry.goodsWanted)}`);

  // Open them again, and the same city sells out of the surplus.
  staff(sim);
  sim.step(300);
  const withIndustry = { ...sim.economy.report };
  ok(withIndustry.exports > 0 && withIndustry.imports === 0,
    'and with the works running it exports instead',
    `${cash(withIndustry.exports)} a week`);
  ok(withIndustry.income > noIndustry.income,
    'which is more money than the shops alone',
    `${cash(noIndustry.income)} -> ${cash(withIndustry.income)}`);
  console.log(`  goods ${cash(withIndustry.goodsMade)} made, `
    + `${cash(withIndustry.goodsWanted)} wanted, `
    + `${cash(withIndustry.exports)} in duty`);
}

// ---- services cost ---------------------------------------------------------

section('services are a standing order');
{
  const { sim } = city(0xe4);
  staff(sim);
  sim.step(300);
  const before = sim.economy.report.services;

  // Two dozen more fire stations, staffed, in two batches of twelve.
  //
  // Measured as two equal increments rather than as a percentage of the bill.
  // A ratio is a claim about how big the rest of the city's service bill
  // happens to be, and it quietly stops testing anything as the library grows:
  // the same twelve stations went from six per cent of the upkeep to four and a
  // half when the commercial stock was widened. Two batches say the thing the
  // section is actually about -- that the city pays for every one of them,
  // every week -- and say it without restating a constant from the model.
  const engine = ASSETS.findIndex((a) => a.id === 'svc.fire.station');
  const dozen = () => {
    for (let i = 0; i < 12; i++) {
      const id = sim.places.add(engine, 100 + i * 40, added * 40 + 100, -1, -1);
      if (id < 0) continue;
      for (let k = 0; k < sim.places.col.jobs[id]; k++) sim.places.hire(id);
    }
    added += 12;
    sim.step(300);
    return sim.economy.report.services;
  };
  let added = 0;
  const mid = dozen();
  const after = dozen();
  const first = mid - before, second = after - mid;
  ok(first > 0, 'twelve more fire stations cost more every week',
    `${cash(before)} -> ${cash(mid)}`);
  ok(Math.abs(second - first) < first * 0.08,
    'and the next twelve cost the same again',
    `+${cash(first)} then +${cash(second)}`);
  console.log(`  upkeep ${cash(before)} -> ${cash(mid)} -> ${cash(after)} a week`
    + `  (+${cash(first)}, +${cash(second)} for a dozen stations each)`);
}

// ---- events ----------------------------------------------------------------

section('things happen');
{
  const { sim } = city(0xe5);
  staff(sim);
  sim.step(TICKS_PER_DAY * 30);
  ok(sim.economy.report.event !== '', 'a month of a working city sees an event',
    sim.economy.report.event);
  console.log(`  ${sim.economy.report.event} (${cash(sim.economy.report.eventValue)})`);
}

// ---- and it saves ----------------------------------------------------------

section('it saves and loads');
{
  const { world } = city(0xe6);
  world.budget.balance = 412345;
  world.budget.setRate(Tax.RESIDENTIAL, 0.14);
  world.budget.setRate(Tax.INDUSTRIAL, 0.21);
  const back = deserialise(serialise(world, 'Money'));
  ok(back !== null, 'the save reloads');
  ok(Math.round(back.world.budget.balance) === 412345, 'with the balance',
    cash(back.world.budget.balance));
  ok(Math.abs(back.world.budget.rates[Tax.RESIDENTIAL] - 0.14) < 1e-6
    && Math.abs(back.world.budget.rates[Tax.INDUSTRIAL] - 0.21) < 1e-6,
    'and every rate as it was set');

  // A save from before there was money loads playable rather than bankrupt.
  const file = JSON.parse(serialise(world, 'Old'));
  delete file.money;
  const old = deserialise(JSON.stringify(file));
  ok(old.world.budget.balance === STARTING_FUNDS,
    'and an old save starts with the founding grant', cash(old.world.budget.balance));
  ok(old.world.budget.rates.every((r) => Math.abs(r - TAX_NEUTRAL) < 1e-6),
    'at the neutral rate');
}

// ---- cost ------------------------------------------------------------------

section('cost');
{
  const { sim } = city(0xe7);
  staff(sim);
  sim.step(300);
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) sim.economy.settle(0.1);
  const us = ((performance.now() - t0) / 200) * 1000;
  ok(us < 900, 'a settle is bounded', `${us.toFixed(0)} us`);
  let ms = 0;
  for (const [k, v] of sim.scheduler.cost) if (k === 'money') ms = v;
  console.log(`  ${sim.places.count} buildings, ${us.toFixed(0)} us a settle, `
    + `${ms.toFixed(2)} ms/s of the tick`);
}

console.log(`\n${checks - failed}/${checks} checks`);
process.exit(failed === 0 ? 0 : 1);
