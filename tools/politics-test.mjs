/**
 * City Hall, as rules: elections open at the right size, voters answer the
 * city they live in, rallies and pledges move the polls, the count ends in a
 * term, and the winner's mandate is really enforced -- then lifted.
 *
 *   node tools/politics-test.mjs
 */
import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: `export * from '${src}sim/politics';
export { Policies, POLICIES } from '${src}sim/policies';
export { Budget } from '${src}sim/budget';`,
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022',
})).outputFiles[0].text;
const M = await import(`data:text/javascript;base64,${Buffer.from(bundle).toString('base64')}`);
const { Politics, Policies, POLICIES, Budget, CALM, ELECTION_POPULATION, CAMPAIGN_DAYS,
  TERM_DAYS, COUNT_SECONDS, TAX_CUT_CEILING } = M;

let pass = 0, fail = 0;
const check = (ok, what) => { if (ok) pass++; else { fail++; console.log(`FAIL  ${what}`); } };

const city = (over = {}) => ({ ...CALM, ...over });
const world = () => ({ pol: new Politics(), policies: new Policies(), budget: new Budget() });

// Runs whole days, then the count in real seconds.
function days(w, from, n, c) {
  for (let d = 0; d < n; d++) w.pol.update(from + d + 0.5, 0.016, c, w.policies, w.budget);
  return from + n;
}
function count(w, day, c) {
  for (let s = 0; s < COUNT_SECONDS * 2 && w.pol.phase === 'count'; s += 0.5) {
    w.pol.update(day, 0.5, c, w.policies, w.budget);
  }
}

// ---- opening -----------------------------------------------------------------
{
  const w = world();
  w.pol.update(1, 0.016, city({ population: ELECTION_POPULATION - 1 }), w.policies, w.budget);
  check(w.pol.phase === 'closed', 'closed below the threshold');
  w.pol.update(2, 0.016, city({ population: ELECTION_POPULATION }), w.policies, w.budget);
  check(w.pol.phase === 'campaign', 'a campaign opens at the threshold');
  check(w.pol.candidates.length === 3, 'three candidates stand');
  check(w.pol.candidates.filter((c) => c.player).length === 1, 'exactly one is the player\'s');
  check(w.pol.candidates.filter((c) => !c.player).every((c) => c.pledges.length === 3),
    'every rival stands on three pledges');
  check(Math.abs(w.pol.poll.reduce((a, b) => a + b, 0) - 1) < 1e-9, 'the poll sums to one');
}

// ---- voters answer the city --------------------------------------------------
{
  const w = world();
  const dirty = city({ population: 6000, rubbish: 0.3 });
  w.pol.update(0, 0.016, dirty, w.policies, w.budget);
  const you = w.pol.yours;
  w.pol.setPledges(0, ['heightLimit', 'metering', 'parking']);
  const weak = w.pol.standing(dirty)[w.pol.candidates.indexOf(you)];
  w.pol.setPledges(0, ['recycling', 'greenCorridors', 'taxCut']);
  const strong = w.pol.standing(dirty)[w.pol.candidates.indexOf(you)];
  check(strong > weak + 0.1, `recycling sells in a city buried in rubbish (${weak.toFixed(2)} -> ${strong.toFixed(2)})`);
  const clean = w.pol.standing(city({ population: 6000, rubbish: 0 }))[w.pol.candidates.indexOf(you)];
  check(strong > clean, 'and sells less once the rubbish is collected');
  w.pol.setPledges(0, ['recycling', 'watch', 'taxCut', 'freeTransit']);
  check(you.pledges.length === 3, 'no more than three pledges');
}

// ---- rallies -----------------------------------------------------------------
{
  const w = world();
  const c = city({ population: 6000 });
  w.pol.update(0, 0.016, c, w.policies, w.budget);
  const i = w.pol.candidates.indexOf(w.pol.yours);
  const before = w.pol.standing(c)[i];
  check(w.pol.rally(0.5), 'a rally can be held');
  check(w.pol.standing(c)[i] > before, 'a rally lifts the candidate');
  check(!w.pol.rally(1.0), 'a second rally the next day is refused');
  check(w.pol.rally(2.6), 'a rally two days later is fine');
}

// ---- polling day, the count, and the mandate ----------------------------------
{
  const w = world();
  const c = city({ population: 6000, resTax: 0.14 });
  w.pol.update(0, 0.016, c, w.policies, w.budget);
  w.pol.setPledges(0, ['taxCut', 'recycling', 'watch']);
  w.budget.setRate(0, 0.14);
  // The player campaigns hard, so they should win.
  let d = 0;
  for (; w.pol.phase === 'campaign' && d < CAMPAIGN_DAYS + 2; d++) {
    w.pol.rally(d + 0.1);
    w.pol.update(d + 0.5, 0.016, c, w.policies, w.budget);
  }
  check(w.pol.phase === 'count', `polling day arrives after ${CAMPAIGN_DAYS} days`);
  check(w.pol.result.length === 3, 'the count has a result for everyone');
  count(w, d, c);
  check(w.pol.phase === 'term', 'the count ends in a term');
  const m = w.pol.mayor;
  check(m !== null && m.player, 'a hard-campaigning player wins');
  const rec = POLICIES.findIndex((p) => p.id === 'recycling');
  check(w.policies.has(rec) && w.policies.isPinned(rec), 'the winner\'s pledge is switched on and pinned');
  w.policies.set(rec, false);
  check(w.policies.has(rec), 'a pinned pledge cannot be switched off');
  check(Math.abs(w.budget.rates[0] - TAX_CUT_CEILING) < 1e-9, 'a tax-cut mandate pulls the rate down');
  w.budget.setRate(0, 0.2);
  check(w.budget.rates[0] <= TAX_CUT_CEILING + 1e-9, 'and holds it down for the term');

  // Save and load, mid-term.
  const again = new Politics();
  again.restore(JSON.parse(JSON.stringify(w.pol.saved())));
  const p2 = new Policies(), b2 = new Budget();
  again.reapply(p2, b2);
  check(again.phase === 'term' && again.mayor?.name === m.name, 'a save keeps the term and the mayor');
  check(p2.isPinned(rec) && b2.ceiling[0] === TAX_CUT_CEILING, 'a loaded term re-applies its mandate');

  // The term ends: pins and caps lift, and a new race starts with the same ticket.
  d = days(w, d, TERM_DAYS + 1, c);
  check(w.pol.phase === 'campaign', 'the term ends in a new campaign');
  check(!w.policies.isPinned(rec), 'the pins lift at the end of the term');
  w.budget.setRate(0, 0.15);
  check(w.budget.rates[0] > 0.14, 'and so does the tax cap');
  check(w.pol.yours?.name === m.name, 'the player runs the same candidate again');
}

// ---- recall ------------------------------------------------------------------
{
  const w = world();
  const c = city({ population: 6000 });
  w.pol.update(0, 0.016, c, w.policies, w.budget);
  let d = days(w, 0, CAMPAIGN_DAYS + 1, c);
  count(w, d, c);
  check(w.pol.phase === 'term', 'a term starts');
  const misery = city({ population: 6000, happiness: 0.05, net: -5000 });
  let n = 0;
  for (; n < 30 && w.pol.phase === 'term'; n++, d++) {
    w.pol.update(d + 0.5, 0.016, misery, w.policies, w.budget);
  }
  check(w.pol.phase === 'campaign' && n < TERM_DAYS,
    `a miserable city recalls its mayor after ${n} days (approval ${w.pol.approval.toFixed(2)})`);
  check(w.pol.until - d < CAMPAIGN_DAYS, 'and the snap campaign is short');
}

// ---- determinism -------------------------------------------------------------
{
  const run = () => {
    const w = world();
    const c = city({ population: 7000, crime: 0.1 });
    w.pol.update(0, 0.016, c, w.policies, w.budget);
    const d = days(w, 0, CAMPAIGN_DAYS + 1, c);
    count(w, d, c);
    return JSON.stringify(w.pol.saved());
  };
  check(run() === run(), 'the same city runs the same election');
}

console.log(fail === 0 ? `POLITICS_OK  ${pass}/${pass} checks` : `FAIL  ${fail} of ${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
