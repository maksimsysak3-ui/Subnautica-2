/**
 * Mods, loans and achievements: the systems around the city rather than in it.
 *
 * Mods must refuse anything that is not a blueprint and clamp the numbers
 * they accept, and every building a mod can add -- the Wonders, and a
 * blueprint at the extremes of every control -- has to build on its lot. Loans must clear on schedule and survive a save.
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
      `export * as bp from '${src}assets/generators/blueprint';`,
      `export { WONDERS } from '${src}assets/generators/wonders';`,
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
  const { mods, bp } = M;
  ok(typeof mods.importMod('not json') === 'string', 'a mod file that is not JSON is refused');
  ok(typeof mods.importMod('{"buildings":[{}]}') === 'string', 'a mod with no name is refused');
  ok(typeof mods.importMod('{"name":"x","buildings":[]}') === 'string', 'a mod with no buildings is refused');
  ok(typeof mods.importMod('{"name":"x","buildings":["tower"]}') === 'string', 'a building that is not a blueprint is refused');
  const wild = mods.importMod(JSON.stringify({ name: 'Wild', script: 'alert(1)', buildings: [
    { name: 'Big', floors: 1e9, width: -4, twist: 99, colour: 'red; background:url(x)', crown: 'rocket', evil: 1 },
  ] }));
  const b0 = typeof wild === 'string' ? null : wild.buildings[0];
  ok(b0 !== null && b0.floors === 90 && b0.width === 3 && b0.twist === 1.6 && /^#[0-9a-f]{6}$/.test(b0.colour) && b0.crown !== 'rocket',
    'blueprint numbers are clamped and unknown values replaced', JSON.stringify(b0));
  ok(b0 !== null && !('evil' in b0) && !('script' in wild), 'anything but the known fields is dropped');
  const many = mods.importMod(JSON.stringify({ name: 'Many', buildings: Array.from({ length: 20 }, () => ({})) }));
  ok(typeof many !== 'string' && many.buildings.length === mods.MAX_BUILDINGS, `no more than ${mods.MAX_BUILDINGS} buildings in one mod`);

  ok(mods.modAssets().length === 0, 'with no mods on, nothing joins the library');
  mods.setEnabled('wonders', true);
  mods.setEnabled('skyline-kit', true);
  const got = mods.modAssets();
  ok(got.length === 4 + 6 && got.every((a) => a.mod !== undefined && a.signature === true && a.id.startsWith('mod.')),
    'the Wonders and the Skyline Kit add their buildings', got.map((a) => a.id).join(','));
  ok(new Set(got.map((a) => a.id)).size === got.length, 'mod building ids are unique');
  ok(mods.reloadNeeded(), 'and the screen knows a reload is due');
  mods.setEnabled('wonders', false);
  mods.setEnabled('skyline-kit', false);
  ok(!mods.reloadNeeded(), 'which switching them back off undoes');

  const err = mods.saveCustom({ id: mods.freshId('Test'), name: 'Test', author: 'me', description: '', kind: 'buildings',
    buildings: [{ ...bp.DEFAULT_BLUEPRINT, name: 'T1', floors: 20 }] });
  const mine = mods.allMods().find((m) => m.name === 'Test');
  ok(err === null && mine !== undefined, 'a mod of your own can be saved', err ?? '');
  const back = mods.importMod(mods.exportMod(mine));
  ok(typeof back !== 'string' && back.buildings[0].floors === 20 && back.id !== mine.id,
    'an exported mod reads back the same, under a fresh id');
  mods.setEnabled(mine.id, true);
  ok(mods.modAssets().some((a) => a.id === `mod.${mine.id}.b0` && a.sim.jobs > 0), 'and its tower joins the library when on');
  mods.removeCustom(mine.id);
  ok(!mods.allMods().some((m) => m.id === mine.id) && mods.modAssets().length === 0, 'and can be deleted');
  ok(!mods.toolOn('photo'), 'tools are off until switched on');
  mods.setEnabled('photo-mode', true);
  ok(mods.toolOn('photo') && !mods.toolOn('sky'), 'and on when they are');
  mods.setEnabled('photo-mode', false);
}

// ---- mod buildings: every one builds, stays on its lot and in budget -------------
{
  const { bp, mods } = M;
  const check = (def) => {
    const [w, d] = def.footprint;
    const hx = w * 4, hz = d * 4;
    const tris = [0, 1, 2].map((l) => def.build(l).build({ occlusion: false }).indices.length / 3);
    const bb = def.build(0).bounds();
    const over = Math.max(bb.max[0] - hx, -bb.min[0] - hx, bb.max[2] - hz, -bb.min[2] - hz);
    const low = bb.min[1];
    return { tris, over, low };
  };
  let worst = 0, bad = [];
  for (const w of M.WONDERS) {
    const r = check(w);
    worst = Math.max(worst, r.tris[0]);
    if (r.over > 0.35 || r.low < -0.01 || !(r.tris[0] > r.tris[1] && r.tris[1] > r.tris[2])) bad.push(`${w.id} ${JSON.stringify(r)}`);
  }
  ok(bad.length === 0, `every Wonder stands on its lot with falling detail (worst ${worst} triangles)`, bad.join('; '));
  ok(worst <= 26000, 'and within the landmark triangle budget');

  // A spread of blueprints, from the presets to the extremes of every control.
  const cases = [...mods.PRESET_BLUEPRINTS];
  for (const shape of bp.BP_SHAPES) for (const crown of bp.BP_CROWNS) {
    cases.push(bp.cleanBlueprint({ shape, crown, width: 12, depth: 3, floors: 90, twist: 1.6, taper: 0.45, balconies: true, podium: 6, bands: 3 }));
    cases.push(bp.cleanBlueprint({ shape, crown, width: 3, depth: 12, floors: 3, twist: -1.6, taper: 1, podium: 0, bands: 0, lit: false }));
  }
  bad = []; worst = 0;
  for (const [i, b] of cases.entries()) {
    const def = bp.blueprintAsset(b, 'test', `c${i}`);
    const r = check(def);
    worst = Math.max(worst, r.tris[0]);
    if (r.over > 0.35 || r.low < -0.01 || r.tris[0] <= 0) bad.push(`${b.shape}/${b.crown} ${JSON.stringify(r)}`);
  }
  ok(bad.length === 0, `${cases.length} blueprints, extremes included, all build inside their lots`, bad.slice(0, 3).join('; '));
  ok(worst <= 26000, `and within the landmark triangle budget (worst ${worst})`);
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
