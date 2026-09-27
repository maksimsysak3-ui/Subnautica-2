/**
 * The council, played without a city: opinion, seats, bills, the whip count,
 * petitions, protests and a save round trip.
 *
 *   node tools/council-test.mjs
 */
import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { Council, BILLS, billById, COUNCIL_POPULATION, COMMITTEE_DAYS, PETITIONS } from '${src}sim/council';`,
      `export { Policies } from '${src}sim/policies';`,
      `export { Budget } from '${src}sim/budget';`,
      `export { Newsroom } from '${src}sim/news';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022', loader: { '.wgsl': 'text' },
})).outputFiles[0].text;
const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };

const city = (over = {}) => ({
  population: 3000, happiness: 0.66, net: 20000, resTax: 0.09,
  rubbish: 0.02, crime: 0.03, health: 0.02, schooling: 0.03, transport: 0.05, utilities: 0,
  trade: 0.05, industry: 0.3, flowing: 0.9,
  unemployment: 0.06, seniors: 0.12, students: 0.1, offices: 0.1, comTax: 0.09, indTax: 0.09,
  ...over,
});

const policies = new M.Policies();
const budget = new M.Budget();
budget.balance = 1e7;
const news = new M.Newsroom();
const c = new M.Council();

// Closed below the line.
c.update(5, city({ population: M.COUNCIL_POPULATION - 1 }), policies, budget, news);
check(!c.open, 'no council below the population line');
c.update(6, city(), policies, budget, news);
check(c.open, 'the council sits once the town is big enough');
check(c.seatCount === 7, `a small town elects seven (${c.seatCount})`);
check(Math.abs(c.share.reduce((a, b) => a + b, 0) - 1) < 1e-9, 'bloc shares sum to one');
check(news.stories.length > 0 && /council/i.test(news.stories[0].head), 'the paper reports it');

// Opinion follows the city: a jobless, taxed city loses the workers.
const w0 = c.approval[0];
for (let d = 7; d < 27; d++) c.update(d, city({ unemployment: 0.3, resTax: 0.16 }), policies, budget, news);
check(c.approval[0] < w0 - 0.15, `workers sour on mass unemployment (${w0.toFixed(2)} -> ${c.approval[0].toFixed(2)})`);
check(c.protesting[0] === 1, 'and strike once they are low enough');
const strikeYield = policies.effects.industrialYield;
check(strikeYield < 1, `a strike costs the works (${strikeYield.toFixed(2)})`);
check(c.mood < 0, `a protest costs mood (${c.mood.toFixed(1)})`);
for (let d = 27; d < 70; d++) c.update(d, city(), policies, budget, news);
check(c.protesting[0] === 0, 'the strike ends once things improve');
check(policies.effects.industrialYield === 1, 'and the works are back to normal');

// A bill, through committee to a vote the whip count predicted.
c.capital = 80;
const id = 'education';
const whip = c.whip(id, false);
const predicted = whip.filter((x) => x).length * 2 > whip.length;
check(c.table(id, false, 70, 3000), 'a bill can be tabled');
check(c.blocked('tourism', false, 3000) !== null, 'only one bill in committee at a time');
c.update(70 + M.COMMITTEE_DAYS, city(), policies, budget, news);
check(c.pending === null, 'it is voted on after committee');
check(c.has(id) === predicted, `the result matches the whip count (${predicted ? 'passed' : 'failed'})`);
if (c.has(id)) {
  check(policies.effects.learningReach > 1, 'a law in force changes the effects');
  check(policies.weekly(3000, 1000, 100) > 0, 'and costs its weekly price');
}

// Lobbying moves waverers.
c.capital = 100;
const hard = M.BILLS.find((b) => !c.has(b.id) && c.whip(b.id, false).filter((x) => x).length * 2 <= c.seatCount);
if (hard) {
  const before = c.whip(hard.id, false).filter((x) => x).length;
  const after = c.whip(hard.id, false, 4).filter((x) => x).length;
  check(after >= before, `lobbying never loses votes (${before} -> ${after} of ${c.seatCount} on ${hard.id})`);
}

// A bond raises money now and costs it back weekly.
c.pending = null;
c.cooldown.clear();
c.capital = 100;
const cash0 = budget.balance;
for (let s = 0; s < c.seats.length; s++) c.seats[s] = s === 0 ? 7 : 0; // a majority
c.table('bond', false, 80, 3000);
c.update(80 + M.COMMITTEE_DAYS, city(), policies, budget, news);
check(c.has('bond') && budget.balance > cash0, `a bond raises money (${Math.round(budget.balance - cash0)})`);
check(policies.weekly(3000, 1000, 100) > 5.5 * 3000 * 0.9, 'and is repaid weekly');
for (let d = 83; d < 170; d++) c.update(d, city(), policies, budget, news);
check(!c.has('bond'), 'the bond lapses after twelve weeks');

// Petitions arrive, can be answered, and lapse if ignored.
for (let d = 170; d < 180 && c.inbox.length === 0; d++) c.update(d, city(), policies, budget, news);
check(c.inbox.length > 0, `petitions arrive (${c.inbox.map((p) => p.id).join(', ')})`);
const p = c.inbox[0];
const n0 = c.inbox.length;
check(c.answer(p.id, 0, 180, 3000, budget, policies, news), 'a petition can be answered');
check(c.inbox.length === n0 - 1, 'and leaves the inbox');

// A project runs for weeks, costs weekly, and leaves its effect for good.
c.capital = 100;
const pw0 = policies.weekly(3000, 1000, 100);
check(c.startProject('cleanRiver', 181, 3000, policies, news), 'a project can be started');
check(c.projectBlocked('fibre', 3000) !== null, 'only one project at a time');
check(policies.weekly(3000, 1000, 100) > pw0, 'and it costs while it runs');
check(policies.effects.industrialPollution >= 1 || c.has('carbonLevy'), 'but does nothing until it is done');
for (let d = 182; d < 181 + 8 * 7 + 2; d++) c.update(d, city(), policies, budget, news);
check(c.project === null && c.finished.includes('cleanRiver'), 'it completes on time');
check(policies.effects.landValue > 0, 'and its effect stays');

// A save round trip keeps everything that matters.
const saved = JSON.parse(JSON.stringify(c.saved()));
const d2 = new M.Council();
const pol2 = new M.Policies();
d2.restore(saved, pol2);
check(d2.open && d2.seatCount === c.seatCount && d2.laws.length === c.laws.length
  && Math.abs(d2.capital - c.capital) < 1e-9 && d2.inbox.length === c.inbox.length
  && d2.finished.length === c.finished.length, 'a save restores the council');
check(Math.abs(pol2.effects.learningReach - policies.effects.learningReach) < 1e-9,
  'and the laws take effect again on load');

console.log(failed === 0 ? '\nCOUNCIL_OK' : `\nCOUNCIL: ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
