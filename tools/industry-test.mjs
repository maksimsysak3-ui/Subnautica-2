/**
 * Industry specialisations, end to end without a GPU.
 *
 * A headquarters is placed on a small map, given an area over the richest
 * ground for its resource, and run for simulated weeks. The checks are the
 * things the feature promises: it produces and earns; the split between
 * shipping and supplying the city moves the money the right way; finite
 * resources run down and renewable ones recover when left alone; the city build
 * covers the area in its props and not somewhere else; and the lot, the area
 * and what has been taken all survive a save.
 *
 *   node tools/industry-test.mjs
 */
import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: `export { serialise, deserialise } from '${src}sim/save';
export { startingWorld, placeLot, lotFits } from '${src}sim/world';
export { configureSim, LITE } from '${src}sim/config';
export { useMap } from '${src}sim/maps';
export { resourceFields, RES_GRID } from '${src}sim/resources';
export { makeCity, INSTANCE_FLOATS } from '${src}sim/city';
export { ASSET_INDEX } from '${src}sim/inventory';
export { useDifficulty } from '${src}sim/difficulty';`,
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022', loader: { '.wgsl': 'text' },
})).outputFiles[0].text;
const M = await import(`data:text/javascript;base64,${Buffer.from(bundle).toString('base64')}`);

let pass = 0, fail = 0;
const check = (ok, what) => { if (ok) pass++; else { fail++; console.log(`FAIL  ${what}`); } };

M.useDifficulty('standard');
M.useMap('ashfield');
const w = M.startingWorld();
w.land.lo = 0xffffffff; w.land.hi = 0xffffffff;
const grid = w.grid, half = grid / 2;

// The richest oil cell, and a headquarters on free ground near it.
const f = M.resourceFields();
let best = -1, bestV = 0;
for (let k = 0; k < f.amount.oil.length; k++) if (f.amount.oil[k] > bestV) { bestV = f.amount.oil[k]; best = k; }
check(best >= 0, 'the map has oil somewhere');
const cell = f.extent / M.RES_GRID;
const ox = -f.extent / 2 + ((best % M.RES_GRID) + 0.5) * cell;
const oz = -f.extent / 2 + (Math.floor(best / M.RES_GRID) + 0.5) * cell;
let at = null;
for (let r = 0; r < 40 && at === null; r++) {
  for (let t = 0; t < 16 && at === null; t++) {
    const a = (t / 16) * Math.PI * 2;
    const gx = Math.round((ox + Math.cos(a) * r * 10) / 8 + half) - 3;
    const gz = Math.round((oz + Math.sin(a) * r * 10) / 8 + half) - 2;
    if (M.lotFits(w, 'spec.hq.oil', gx, gz, 0).why === null) at = [gx, gz];
  }
}
check(at !== null, 'an oil headquarters fits somewhere near the field');
if (at === null) { console.log(`INDUSTRY  ${pass}/${pass + fail}`); process.exit(1); }
check(M.placeLot(w, 'spec.hq.oil', at[0], at[1], 0) === null, 'the headquarters is placed as a lot');
const hq = w.industry.add({ kind: 'oil', gx: at[0], gz: at[1], w: 6, d: 5, area: [], exportShare: 1 });
const R = 200;
w.industry.setArea(hq, [ox - R, oz - R, ox + R, oz - R, ox + R, oz + R, ox - R, oz + R]);
const cells = w.industry.cells(hq).length;
check(cells > 40, `the area covers harvest cells (${cells})`);

// ---- production and money -------------------------------------------------
const run = (weeks, staff = 1) => {
  for (let i = 0; i < weeks * 7; i++) w.industry.settle(1, () => staff, () => 2000);
};
run(1);
const r0 = w.industry.reports[hq];
console.log(`oil      ${cells} cells, ${r0.units.toFixed(0)} units and ${Math.round(w.industry.weekly)} a week at full staff, full export`);
check(r0.units > 10, `a staffed oil field produces (${r0.units.toFixed(0)} a week)`);
check(w.industry.weekly > 1000, `and earns (${Math.round(w.industry.weekly)} a week)`);
check(w.industry.upkeep === 2000, 'its upkeep is carried');
run(1, 0);
check(w.industry.reports[hq].units === 0, 'an unstaffed headquarters produces nothing');

w.industry.setExport(hq, 0);
run(1);
const local = w.industry.weekly, localUnits = w.industry.localUnits;
w.industry.setExport(hq, 1);
run(1);
const shipped = w.industry.weekly;
check(localUnits > 0 && shipped > local, 'supplying the city earns less than shipping, and counts as local supply');

// ---- depletion ---------------------------------------------------------------
const before = w.industry.reports[hq].remaining;
run(20);
const after = w.industry.reports[hq].remaining;
check(after < before - 0.3, `a worked oil field runs down (${(before * 100).toFixed(0)}% → ${(after * 100).toFixed(0)}%)`);

// ---- the city build lays the props in the area ------------------------------
const city = M.makeCity(w);
const pump = M.ASSET_INDEX.get('spec.prop.oil');
let inArea = 0, outside = 0;
for (let i = 0; i < city.count; i++) {
  const o = i * M.INSTANCE_FLOATS;
  if ((city.data[o + 7] | 0) !== pump) continue;
  const x = city.data[o], z = city.data[o + 1];
  if (Math.abs(x - ox) <= R + 20 && Math.abs(z - oz) <= R + 20) inArea++; else outside++;
}
check(inArea > 5, `the city build stands pumpjacks in the area (${inArea})`);
check(outside === 0, 'and none outside it');

// ---- renewables recover -----------------------------------------------------
M.useMap('lakeland');
const w2 = M.startingWorld();
const f2 = M.resourceFields();
let wood = -1;
for (let k = 0; k < f2.amount.forest.length; k++) if (f2.amount.forest[k] > 200) { wood = k; break; }
const wx = -f2.extent / 2 + ((wood % M.RES_GRID) + 0.5) * (f2.extent / M.RES_GRID);
const wz = -f2.extent / 2 + (Math.floor(wood / M.RES_GRID) + 0.5) * (f2.extent / M.RES_GRID);
const h2 = w2.industry.add({ kind: 'forest', gx: 0, gz: 0, w: 6, d: 5, area: [], exportShare: 1 });
w2.industry.setArea(h2, [wx - 150, wz - 150, wx + 150, wz - 150, wx + 150, wz + 150, wx - 150, wz + 150]);
for (let i = 0; i < 20 * 7; i++) w2.industry.settle(1, () => 1, () => 0);
const worked = w2.industry.reports[h2].remaining;
check(worked < 0.85 && worked > 0.3, `worked forest settles below its first yield (${(worked * 100).toFixed(0)}%)`);
w2.industry.setArea(h2, []);
for (let i = 0; i < 30 * 7; i++) w2.industry.settle(1, () => 1, () => 0);
w2.industry.setArea(h2, [wx - 150, wz - 150, wx + 150, wz - 150, wx + 150, wz + 150, wx - 150, wz + 150]);
w2.industry.settle(0.001, () => 1, () => 0);
check(w2.industry.reports[h2].remaining > worked + 0.2, 'left alone, the forest grows back');

// ---- saves --------------------------------------------------------------------
M.useMap('ashfield');
const text = M.serialise(w, 'Oil Town');
const back = M.deserialise(text);
check(back !== null, 'the city reads back');
const bi = back.world.industry;
check(bi.hqs.length === 1 && bi.hqs[0].kind === 'oil' && bi.hqs[0].gx === at[0], 'the headquarters survives a save');
check(bi.hqs[0].area.length === 8, 'and its area');
bi.settle(0.001, () => 1, () => 0);
check(Math.abs(bi.reports[0].remaining - after) < 0.05, 'and how much of the field is left');

console.log(`INDUSTRY  ${pass}/${pass + fail} checks`);
process.exit(fail === 0 ? 0 : 1);
