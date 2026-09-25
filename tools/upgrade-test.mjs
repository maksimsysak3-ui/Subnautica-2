/**
 * Service upgrades: a wing on the map, a tier on the building, and what the
 * tier buys -- checked from the world through the simulation to the save.
 *
 *   node tools/upgrade-test.mjs
 */

import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { Simulation } from '${src}sim/agents/sim';`,
      `export { makeCity, INSTANCE_FLOATS } from '${src}sim/city';`,
      `export { defaultWorld, upgradeLot, nextWing, wingOfLot, demolish } from '${src}sim/world';`,
      `export { serialise, deserialise } from '${src}sim/save';`,
      `export { configureSim, LITE } from '${src}sim/config';`,
      `export { ASSET_INDEX } from '${src}sim/inventory';`,
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
world.land.lo = world.land.hi = 0xffffffff;

// A school: capacity is what its tier should raise.
const lot = world.lots.find((l) => l.id.startsWith('svc.edu.') && M.nextWing(world, l).why === null)
  ?? world.lots.find((l) => l.id.startsWith('svc.') && M.nextWing(world, l).why === null);
ok(lot !== undefined, 'a service building has room for a wing', lot?.id);

const city0 = M.makeCity(world);
const sim = new M.Simulation(city0, world.net, 5, world);
const proto = M.ASSET_INDEX.get(lot.id);
const half = world.grid / 2;
const x = (lot.gx - half + lot.w / 2) * 8, z = (lot.gz - half + lot.d / 2) * 8;
const placeOf = () => {
  const c = sim.places.col;
  for (let id = 0; id < sim.places.count; id++) {
    if (sim.places.live[id] && c.proto[id] === proto && Math.abs(c.x[id] - x) < 6 && Math.abs(c.z[id] - z) < 6) return id;
  }
  return -1;
};
const pid = placeOf();
ok(pid >= 0, 'the building is a place in the simulation');
const servesBefore = sim.places.col.serves[pid];

ok(M.upgradeLot(world, lot) === null, 'tier one builds');
const wing1 = M.wingOfLot(world, lot);
ok(lot.tier === 1 && wing1?.id.startsWith('spec.wing.1.'), 'the lot is tier one with a tier-one wing', `${lot.tier} ${wing1?.id}`);
const cityA = M.makeCity(world);
const wi = M.ASSET_INDEX.get(wing1.id);
let drawn = 0;
for (let i = 0; i < cityA.count; i++) if ((cityA.data[i * M.INSTANCE_FLOATS + 7] | 0) === wi) drawn++;
ok(drawn === 1, 'the wing is built into the city', `${drawn}`);

ok(M.upgradeLot(world, lot) === null, 'tier two builds');
const wing2 = M.wingOfLot(world, lot);
ok(lot.tier === 2 && wing2 === wing1 && wing2.id.startsWith('spec.wing.2.'), 'tier two rebuilds the same wing', wing2?.id);
ok(M.nextWing(world, lot).why === 'fully upgraded', 'and there is no tier three');

sim.applyTiers();
const servesAfter = sim.places.col.serves[pid];
ok(sim.places.col.tier[pid] === 2, 'the simulation reads the tier', `${sim.places.col.tier[pid]}`);
ok(servesAfter === Math.round(servesBefore * 2), 'capacity doubled at tier two', `${servesBefore} -> ${servesAfter}`);
sim.step(M.TICKS_PER_DAY);
const row = [...sim.economy.upkeepByProto].find(([p]) => p === proto);
ok(row !== undefined && row[1].total > 0, 'the upkeep table carries it', row ? String(Math.round(row[1].total)) : '');

const back = M.deserialise(M.serialise(world, 'upgrades'));
const blot = back?.world.lots.find((l) => l.gx === lot.gx && l.gz === lot.gz && l.id === lot.id);
const bwing = blot === undefined ? undefined : M.wingOfLot(back.world, blot);
ok(blot?.tier === 2 && bwing?.id === wing2.id, 'a save keeps the tier and the wing', `${blot?.tier} ${bwing?.id}`);

M.demolish(world, lot.gx, lot.gz, lot.w, lot.d);
ok(!world.lots.some((l) => l.wingOf !== undefined), 'demolishing the building takes its wing');

console.log(`\nUPGRADES  ${checks - failed}/${checks} checks`);
process.exit(failed === 0 ? 0 : 1);
