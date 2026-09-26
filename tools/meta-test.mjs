/**
 * Mods, loans and achievements: the systems around the city rather than in it.
 *
 * Mods must refuse anything that is not their few numbers and clamp the
 * numbers they accept, and what they do has to reach the rules a city is
 * founded under. Loans must clear on schedule and survive a save.
 * Achievements must unlock off a real reading of the city, once.
 *
 *   node tools/meta-test.mjs
 */

import * as esbuild from 'esbuild';

// A stand-in for the browser's storage: mods and achievements keep their
// state there.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
};

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export * as mods from '${src}sim/mods';`,
      `export { useDifficulty, RULES, DIFFICULTIES } from '${src}sim/difficulty';`,
      `export { Budget, LOAN_OFFERS, MAX_LOANS } from '${src}sim/budget';`,
      `export { defaultWorld } from '${src}sim/world';`,
      `export { serialise, deserialise } from '${src}sim/save';`,
      `export { configureSim, LITE } from '${src}sim/config';`,
      `export { ACHIEVEMENTS, checkAchievements, earnedAt } from '${src}sim/achievements';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022', loader: { '.wgsl': 'text' },
})).outputFiles[0].text;
const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));

let failed = 0, checks = 0;
const ok = (cond, what, detail = '') => {
  checks++;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${what}${detail ? '  -- ' + detail : ''}`);
  if (!cond) failed++;
};

// ---- mods ---------------------------------------------------------------------
{
  const { mods } = M;
  ok(typeof mods.importMod('not json') === 'string', 'a mod file that is not JSON is refused');
  ok(typeof mods.importMod('{"effects":{"income":2}}') === 'string', 'a mod with no name is refused');
  ok(typeof mods.importMod('{"name":"x","effects":{}}') === 'string', 'a mod that changes nothing is refused');
  ok(typeof mods.importMod('{"name":"x","effects":{"income":"lots"}}') === 'string', 'a multiplier that is not a number is refused');
  const wild = mods.importMod('{"name":"Wild","effects":{"income":1e9,"build":-4,"evil":"alert(1)"},"script":"alert(1)"}');
  ok(typeof wild !== 'string' && wild.effects.income === 5 && wild.effects.build === 0.05,
    'multipliers are clamped to their range', JSON.stringify(wild.effects));
  ok(typeof wild !== 'string' && !('evil' in wild.effects) && !('script' in wild),
    'anything but the known multipliers is dropped');

  const base = M.DIFFICULTIES.find((d) => d.id === 'standard');
  M.useDifficulty('standard');
  ok(M.RULES.income === base.income && M.RULES.growth === 1, 'with no mods on, the rules are the difficulty\'s');
  mods.setEnabled('boom', true);
  mods.setEnabled('tycoon', true);
  M.useDifficulty('standard');
  ok(Math.abs(M.RULES.income - base.income * 1.5) < 1e-6, 'Boom Economy lifts tax income by half', `${M.RULES.income} vs ${base.income}`);
  ok(Math.abs(M.RULES.funds - base.funds * 10) < 1e-6, 'Tycoon founds with ten times the treasury');
  mods.setEnabled('boom', false);
  mods.setEnabled('tycoon', false);
  M.useDifficulty('standard');
  ok(M.RULES.income === base.income && M.RULES.funds === base.funds, 'switching mods off restores the rules');

  const err = mods.saveCustom({ id: 'custom-test', name: 'Test', author: 'me', description: '', effects: { upkeep: 0.5 } });
  ok(err === null && mods.allMods().some((m) => m.id === 'custom-test'), 'a mod of your own can be saved');
  const back = mods.importMod(mods.exportMod(mods.allMods().find((m) => m.id === 'custom-test')));
  ok(typeof back !== 'string' && back.effects.upkeep === 0.5, 'an exported mod reads back the same');
  mods.removeCustom('custom-test');
  ok(!mods.allMods().some((m) => m.id === 'custom-test'), 'and can be deleted');

  M.configureSim(M.LITE);
  mods.setEnabled('master-planner', true);
  const w = M.defaultWorld();
  mods.applyWorldMods(w);
  ok(w.progress.level >= 10 && w.progress.earned.size > 10, 'Master Planner opens every level and landmark',
    `level ${w.progress.level}, ${w.progress.earned.size} landmarks`);
  mods.setEnabled('master-planner', false);
}

// ---- loans --------------------------------------------------------------------
{
  const b = new M.Budget();
  b.balance = 0;
  ok(b.borrow(0), 'a loan can be taken');
  ok(b.balance === M.LOAN_OFFERS[0].amount, 'and its money lands in the treasury');
  const weeks = M.LOAN_OFFERS[0].weeks;
  for (let d = 0; d < weeks * 7 + 7 && b.loans.length > 0; d++) { b.charge(b.loanWeekly / 7); b.amortise(1 / 7); }
  ok(b.loans.length === 0, 'it clears on its schedule');
  ok(b.balance < 0 && -b.balance > M.LOAN_OFFERS[0].amount - M.LOAN_OFFERS[0].amount,
    'having cost more than was borrowed', `${Math.round(-b.balance)}`);
  const c = new M.Budget();
  for (let i = 0; i < M.MAX_LOANS; i++) c.borrow(1);
  ok(!c.borrow(0), `no more than ${M.MAX_LOANS} at once`);
  c.balance = 0;
  ok(!c.repay(0), 'a loan cannot be paid off without the money');
  c.balance = 1e12;
  ok(c.repay(0) && c.loans.length === M.MAX_LOANS - 1, 'and can with it');

  const w = M.defaultWorld();
  w.budget.borrow(2);
  const back = M.deserialise(M.serialise(w, 'loans'));
  ok(back?.world.budget.loans.length === 1 && Math.abs(back.world.budget.loans[0].owed - w.budget.loans[0].owed) < 1,
    'a save keeps the loans');
}

// ---- achievements ---------------------------------------------------------------
{
  const w = M.defaultWorld();
  const sim = {
    people: { population: 300, happiness: 0.6, byStage: [] },
    places: { staffed: [0, 0] },
    economy: { report: { net: 0 } },
    utilities: { report: { served: [0, 0, 0, 0] } },
    transit: { report: { ridersPerDay: 0 } },
    traffic: { stats: { driving: 0, meanSpeed: 0 } },
  };
  const got = M.checkAchievements(sim, w).map((a) => a.id);
  ok(got.includes('pop.250') && !got.includes('pop.1000'), 'a city of 300 earns Village and not Market Town', got.join(','));
  ok(M.checkAchievements(sim, w).length === 0, 'and earns it only once');
  ok(M.earnedAt('pop.250') !== null, 'which is remembered');
  ok(new Set(M.ACHIEVEMENTS.map((a) => a.id)).size === M.ACHIEVEMENTS.length, 'achievement ids are unique');
}

console.log(`\n${failed === 0 ? 'META_OK' : 'META_FAIL'}  ${checks - failed}/${checks} checks`);
process.exit(failed === 0 ? 0 : 1);
