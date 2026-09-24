/**
 * Saves, as a round trip: a city with something in every part of it is
 * written, read back, and compared field by field against the original.
 *
 * The comparison walks every key the world object has, so a field added to
 * `World` and forgotten in the save format fails here -- which is the bug this
 * test exists for: loads that quietly dropped the career, the ordinances, the
 * building tiers and the blight, because the save listed its fields by hand.
 *
 *   node tools/save-test.mjs
 */
import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: `export { serialise, deserialise } from '${src}sim/save';
export { startingWorld, emptyWorld, paint } from '${src}sim/world';
export { POLICIES } from '${src}sim/policies';
export { CALM } from '${src}sim/politics';
export { useDifficulty } from '${src}sim/difficulty';`,
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022', loader: { '.wgsl': 'text' },
})).outputFiles[0].text;
const M = await import(`data:text/javascript;base64,${Buffer.from(bundle).toString('base64')}`);

let pass = 0, fail = 0;
const check = (ok, what) => { if (ok) pass++; else { fail++; console.log(`FAIL  ${what}`); } };

// ---- a city with something in every part of it ------------------------------
M.useDifficulty('hard');
const w = M.startingWorld(96);
w.net.add(-100, 40, 120, 40, 'avenue');
w.net.add(20, -60, 20, 140, 'street');
M.paint(w, 50, 50, 6, 4, 1);
w.grown[50 * 96 + 50] = 1;
w.tier[50 * 96 + 51] = 2;
w.blight[52 * 96 + 50] = 1;
w.lots.push({ id: 'res.low.house', gx: 40, gz: 40, w: 1, d: 1, yaw: 1 });
w.lots.push({ id: 'civic.hall', gx: 60, gz: 60, w: 4, d: 4, yaw: 0, grounds: [58, 58, 8, 8] });
w.land.lo = 0x3f; w.land.hi = 0x5;
w.budget.balance = 123456;
w.budget.setRate(2, 0.14);
w.policies.set(M.POLICIES.findIndex((p) => p.id === 'recycling'), true);
w.progress.xp = 5000; w.progress.level = 4; w.progress.stars = 7;
w.progress.bought.add('power-1'); w.progress.done.add('first-road');
w.clock = 123456; w.residents = 7890;
w.map = 'kestrel';
const c = { ...M.CALM, population: 6000, rubbish: 0.2 };
w.politics.update(1, 0.016, c, w.policies, w.budget);
w.politics.setPledges(1, ['recycling', 'taxCut', 'watch']);
for (let d = 2; w.politics.phase === 'campaign' && d < 40; d++) w.politics.update(d + 0.5, 0.016, c, w.policies, w.budget);
for (let s = 0; s < 40 && w.politics.phase === 'count'; s++) w.politics.update(20, 1, c, w.policies, w.budget);
check(w.politics.phase === 'term', 'the test city has a mayor in office');

// ---- write and read ------------------------------------------------------------
const text = M.serialise(w, 'Round Trip');
const back = M.deserialise(text);
check(back !== null, 'the save reads back');
const r = back.world;
check(back.name === 'Round Trip', 'the name survives');

// Everything a world holds, as plain data, so any two can be compared.
function plain(v, seen = new Set()) {
  if (v === null || typeof v !== 'object') return v;
  // Ancestors only: two fields sharing one array is not a cycle.
  if (seen.has(v)) return '[cycle]';
  seen.add(v);
  let out;
  if (ArrayBuffer.isView(v)) out = Array.from(v);
  else if (v instanceof Set) out = [...v].sort();
  else if (v instanceof Map) out = [...v.entries()].map(([k, x]) => [k, plain(x, seen)]);
  else if (Array.isArray(v)) out = v.map((x) => plain(x, seen));
  else {
    out = {};
    for (const k of Object.keys(v).sort()) {
      if (typeof v[k] === 'function') continue;
      out[k] = plain(v[k], seen);
    }
  }
  seen.delete(v);
  return out;
}
// Derived or bookkeeping state that a load is allowed to rebuild rather than copy.
const DERIVED = new Set(['painted', 'version', 'at', 'shapeVersion', 'spent', 'earned', 'lastDay']);
function diff(a, b, path) {
  const out = [];
  if (typeof a !== typeof b) return [`${path}: ${typeof a} vs ${typeof b}`];
  if (a === null || typeof a !== 'object') {
    if (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) > 1e-9 : a !== b) {
      return [`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`];
    }
    return [];
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (DERIVED.has(k)) continue;
    out.push(...diff(a[k], b[k], `${path}.${k}`));
    if (out.length > 6) break;
  }
  return out;
}
// The road graph by what it is -- its nodes and links -- rather than the
// rasters and indexes it derives from them, which a load rebuilds.
const graph = (net) => ({
  nodes: net.nodes.map((n) => [n.x, n.z]),
  links: net.links.map((l) => [l.a, l.b, l.cx, l.cz, l.cls]),
});
for (const key of Object.keys(w)) {
  if (DERIVED.has(key)) continue;
  const a = key === 'net' ? graph(w.net) : w[key];
  const b = key === 'net' ? graph(r.net) : r[key];
  const d = diff(plain(a), plain(b), key);
  check(d.length === 0, `world.${key} round-trips${d.length ? `: ${d.slice(0, 3).join('; ')}` : ''}`);
}
check(r.policies.isPinned(M.POLICIES.findIndex((p) => p.id === 'recycling')),
  'a mandate is pinned again after a load');

// ---- older versions and junk ------------------------------------------------
const v3 = JSON.parse(text);
v3.v = 3; delete v3.clock; delete v3.residents;
const old = M.deserialise(JSON.stringify(v3));
check(old !== null && old.world.clock === 0 && old.world.residents === 0,
  'a version 3 save migrates and loads with a fresh clock');
const nomap = JSON.parse(text); delete nomap.map;
check(M.deserialise(JSON.stringify(nomap))?.world.map === 'vale',
  'a save from before the map choice loads onto Meridian Vale');
const v2 = JSON.parse(text); v2.v = 2;
check(M.deserialise(JSON.stringify(v2)) === null, 'a version 2 save is refused rather than misread');
check(M.deserialise('{not json') === null, 'junk is refused');
const future = JSON.parse(text); future.v = 99;
check(M.deserialise(JSON.stringify(future)) === null, 'a save from a newer game is refused');

console.log(fail === 0 ? `SAVE_OK  ${pass}/${pass} checks` : `FAIL  ${fail} of ${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
