/**
 * Storms, floods and earthquakes, against a made-up town: how often they come
 * at each setting, that they spare a village, what they damage and what the
 * player's defences take off it, and that a forecast survives a save.
 *
 *   node tools/disaster-test.mjs
 */
import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { Disasters, DISASTER_POPULATION } from '${src}sim/disasters';`,
      `export { Policies } from '${src}sim/policies';`,
      `export { Budget } from '${src}sim/budget';`,
      `export { Newsroom } from '${src}sim/news';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022', loader: { '.wgsl': 'text' },
})).outputFiles[0].text;
const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));

let failed = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failed++; console.log(`FAIL  ${what}`); } else console.log(`PASS  ${what}`); };

/** A town on a grid, 40 m apart, with a river down x = 0 (its banks within 60 m). */
function town({ pop = 5000, cover = 0, services = [] } = {}) {
  const xs = [], zs = [];
  for (let gx = -12; gx <= 12; gx++) for (let gz = -12; gz <= 12; gz++) { xs.push(gx * 40 + 20); zs.push(gz * 40); }
  const n = xs.length;
  const health = new Uint8Array(n).fill(255);
  const lit = [];
  return {
    population: pop, count: n,
    live: () => true, service: (i) => services.includes(i),
    x: (i) => xs[i], z: (i) => zs[i], health,
    cover: () => cover,
    riverside: (x) => Math.abs(x) < 60,
    ignite: (i) => lit.push(i),
    lit,
  };
}
const fresh = () => ({ policies: new M.Policies(), budget: Object.assign(new M.Budget(), { balance: 1e7 }), news: new M.Newsroom() });

// How often: count what happens over ten simulated years at each setting.
// Several cities per setting, each on its own dice, so one lucky seed decides nothing.
const count = (level, pop) => {
  let n = 0;
  for (let seed = 1; seed <= 6; seed++) n += countOne(level, pop, seed * 7919);
  return n / 6;
};
const countOne = (level, pop, seed) => {
  const d = new M.Disasters(seed); d.level = level;
  const c = town({ pop }); const f = fresh();
  let n = 0;
  for (let day = 0; day < 280 * 2; day += 0.25) {
    const got = d.update(day, c, f.policies.effects, f.budget, f.news);
    if (got?.struck) n++;
    c.health.fill(255);
  }
  return n;
};
const off = count('off', 9000), rare = count('rare', 9000), normal = count('normal', 9000), often = count('often', 9000), village = count('often', M.DISASTER_POPULATION - 1);
console.log(`  per city over 20 years: off ${off}, rare ${rare}, normal ${normal}, often ${often}, a village on often ${village}`);
check(off === 0, 'off means never');
check(village === 0, 'a village is spared');
check(rare >= 3 && rare <= 11, `rare is rare (${rare.toFixed(1)} in twenty years)`);
check(normal > rare && often > normal, 'each setting more than the last');
check(often <= 26, `even often leaves room to rebuild (${often.toFixed(1)})`);
check(new Set([1, 2, 3].map((k) => JSON.stringify(new M.Disasters().saved()))).size === 3, 'each new city rolls its own dice');

// A quake: worst at the epicentre, nothing outside the radius, a bill, a story.
{
  const d = new M.Disasters(4242); const c = town(); const f = fresh();
  const before = f.budget.balance;
  const s = d.force('quake', 50, c, f.policies.effects, f.budget, f.news);
  check(s !== null && s.hit > 0, `a quake damages buildings (${s?.hit})`);
  let near = 0, nearN = 0, far = 0, outside = 0;
  for (let i = 0; i < c.count; i++) {
    const dist = Math.hypot(c.x(i) - s.x, c.z(i) - s.z);
    if (dist < s.radius * 0.3) { near += 255 - c.health[i]; nearN++; }
    else if (dist < s.radius) far += 0;
    else if (c.health[i] !== 255) outside++;
  }
  check(outside === 0, 'nothing outside the radius is touched');
  check(nearN > 0 && near / nearN > 40, `the epicentre is hit hard (${(near / Math.max(1, nearN)).toFixed(0)} points)`);
  check(f.budget.balance < before && before - f.budget.balance === s.bill, `repairs are charged (${s.bill})`);
  check(f.news.stories.some((x) => /earthquake/i.test(x.head)), 'the paper reports it');
  check(s.magnitude >= 4.5 && s.magnitude <= 7, `a believable magnitude (${s.magnitude})`);
  void far;
}

// Fire cover and the building code both take damage off, on the same quake.
{
  const damage = (opts, apply) => {
    const d = new M.Disasters(4242); const c = town(opts); const f = fresh();
    if (apply) apply(f.policies.effects);
    d.force('quake', 50, c, f.policies.effects, f.budget, f.news);
    let sum = 0; for (let i = 0; i < c.count; i++) sum += 255 - c.health[i];
    return sum;
  };
  const bare = damage({}), covered = damage({ cover: 1 }), coded = damage({}, (e) => { e.quakeDamage = 0.45; });
  check(covered < bare * 0.75, `fire cover saves buildings (${bare} -> ${covered})`);
  check(coded < bare * 0.6, `the seismic code saves more (${bare} -> ${coded})`);
}

// A flood: the banks only, and defences stop most of it.
{
  const flood = (mult) => {
    const d = new M.Disasters(4242); const c = town(); const f = fresh();
    f.policies.effects.floodDamage = mult;
    const s = d.force('flood', 50, c, f.policies.effects, f.budget, f.news);
    let dry = 0, sum = 0;
    for (let i = 0; i < c.count; i++) {
      if (c.health[i] === 255) continue;
      sum += 255 - c.health[i];
      if (!c.riverside(c.x(i), c.z(i))) dry++;
    }
    return { s, dry, sum };
  };
  const open = flood(1), walled = flood(0.25);
  check(open.s !== null && open.s.hit > 0, `a flood damages the banks (${open.s?.hit})`);
  check(open.dry === 0, 'and nothing away from the river');
  check(walled.sum < open.sum * 0.35, `flood defences stop most of it (${open.sum} -> ${walled.sum})`);
}

// A storm is forecast a day ahead, then strikes, and a service building is spared.
{
  const d = new M.Disasters(4242); d.level = 'often';
  const c = town({ services: [300, 301, 302, 303, 304] }); const f = fresh();
  let warned = null, struck = null;
  for (let day = 0; day < 400 && struck === null; day += 0.1) {
    const got = d.update(day, c, f.policies.effects, f.budget, f.news);
    if (got?.warned && warned === null) warned = { ...got.warned, seen: day };
    if (got?.struck) struck = { ...got.struck, seen: day };
    if (warned === null) c.health.fill(255);
  }
  check(struck !== null, 'something strikes on often');
  if (struck.kind !== 'quake') {
    check(warned !== null && struck.seen - warned.seen >= 0.9, `a ${struck.kind} is forecast a day ahead`);
  } else {
    check(warned === null || warned.kind !== 'quake', 'a quake is never forecast');
  }
  check([300, 301, 302, 303, 304].every((i) => c.health[i] === 255), 'service buildings are spared');
}

// Save and restore: the setting, a pending forecast and the record.
{
  const d = new M.Disasters(4242); d.level = 'normal';
  const c = town(); const f = fresh();
  d.force('storm', 10, c, f.policies.effects, f.budget, f.news);
  d.warning = { kind: 'flood', at: 42, x: 1, z: 2, radius: 650, heading: 0, severity: 0.5 };
  const again = new M.Disasters();
  again.restore(JSON.parse(JSON.stringify(d.saved())));
  check(again.level === 'normal', 'the setting survives a save');
  check(again.warning?.kind === 'flood' && again.warning.at === 42, 'a forecast survives a save');
  check(again.history.length === 1 && again.history[0].kind === 'storm', 'the record survives a save');
  const junk = new M.Disasters();
  junk.restore({ level: 'apocalypse', warning: { kind: 'meteor', at: 1 }, history: 'x' });
  check(junk.level === 'rare' && junk.warning === null && junk.history.length === 0, 'a mangled save is refused, not trusted');
}

console.log(`\n${checks} checks`);
console.log(failed === 0 ? 'DISASTERS_OK' : `DISASTERS: ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
