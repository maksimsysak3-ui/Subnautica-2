/**
 * Districts: paint, policies that move the takings they claim to, fees that
 * are charged, and a save that keeps all of it.
 *
 *   node tools/district-test.mjs
 */

import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { Simulation } from '${src}sim/agents/sim';`,
      `export { makeCity } from '${src}sim/city';`,
      `export { defaultWorld } from '${src}sim/world';`,
      `export { serialise, deserialise } from '${src}sim/save';`,
      `export { configureSim, LITE } from '${src}sim/config';`,
      `export { TICKS_PER_DAY } from '${src}sim/agents/calendar';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022',
})).outputFiles[0].text;
const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));

let failed = 0, checks = 0;
const ok = (cond, what, detail = '') => {
  checks++;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${what}${detail ? '  -- ' + detail : ''}`);
  if (!cond) failed++;
};

M.configureSim(M.LITE);
const world = M.defaultWorld();
const sim = new M.Simulation(M.makeCity(world), world.net, 9, world);
sim.found(40);
sim.step(M.TICKS_PER_DAY * 2);
sim.economy.settle(0);
const before = { ...sim.economy.report };

const D = world.districts;
const d = D.add();
ok(d !== null && d.name.length > 0, 'a new district has a name', d?.name);
const n = D.paint(0, 0, world.grid, world.grid, d.id);
ok(n === world.grid * world.grid, 'painting covers the cells asked for', `${n}`);
D.toggle(d.id, 'tourism');
sim.economy.districts = D;
sim.economy.settle(0);
const after = sim.economy.report;
ok(after.commercial > before.commercial * 1.2, 'a tourist quarter over the whole city lifts shop takings by about a quarter',
  `${Math.round(before.commercial)} -> ${Math.round(after.commercial)}`);
ok(Math.abs(after.office - before.office) < 1, 'and leaves offices alone');
const st = sim.economy.districtStats.get(d.id);
const shops = (() => { let n = 0; const c = sim.places.col; for (let i = 0; i < sim.places.count; i++) if (sim.places.live[i] && c.purpose[i] === 1) n++; return n; })();
ok(st !== undefined && st.cost === shops * 14, 'its fee is charged on the shops it works on', `${shops} shops, ${st?.cost}`);
ok(after.policies >= before.policies + st.cost - 1, 'and lands on the policies line');

D.toggle(d.id, 'tourism');
D.toggle(d.id, 'enterprise');
sim.economy.settle(0);
ok(sim.economy.report.commercial < before.commercial * 0.8, 'an enterprise zone cuts it');

const back = M.deserialise(M.serialise(world, 'districts'));
const bd = back?.world.districts;
ok(bd?.list.length === 1 && bd.list[0].name === d.name && bd.list[0].policies[0] === 'enterprise', 'a save keeps the district and its policies');
ok(bd?.at(0, 0) === d.id, 'and its ground');

D.paint(0, 0, world.grid, world.grid, 0);
ok(D.list.length === 0, 'erasing all its ground removes the district');

console.log(`\nDISTRICTS  ${checks - failed}/${checks} checks`);
process.exit(failed === 0 ? 0 : 1);
