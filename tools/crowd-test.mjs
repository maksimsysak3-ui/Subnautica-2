/**
 * Crowds: traffic and pavements that follow the city, and places people cross
 * the city for.
 *
 * Runs the generated city from its founding and checks three things a player
 * sees without looking for them: the number of cars on screen rises with the
 * population under a camera that never moves, so does the number of people on
 * the pavements, and the roads round the city's attractions carry more than
 * its average road does -- which is what makes them the jams worth fixing.
 *
 *   node tools/crowd-test.mjs [days] [grid]
 */

import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { Simulation } from '${src}sim/agents/sim';`,
      `export * from '${src}sim/agents/calendar';`,
      `export { Use } from '${src}sim/agents/lanes';`,
      `export { makeCity } from '${src}sim/city';`,
      `export { defaultWorld } from '${src}sim/world';`,
      `export { configureSim } from '${src}sim/config';`,
      `export { ASSETS } from '${src}assets/registry';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022',
})).outputFiles[0].text;

const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));
const { Simulation, TICKS_PER_DAY, Use, makeCity, defaultWorld, configureSim, ASSETS } = M;

const DAYS = Number(process.argv[2] || 0) || 24;
const GRID = Number(process.argv[3] || 0) || 180;
configureSim({ cityGrid: GRID });

let failed = 0, checks = 0;
const ok = (cond, what, detail = '') => {
  checks++;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${what}${detail ? '  -- ' + detail : ''}`);
  if (!cond) failed++;
};

const world = defaultWorld();
const city = makeCity(world);
const sim = new Simulation(city, world.net, 0xc40d);
sim.look(0, 0);
const p = sim.places;
const names = [...p.appeal.entries()].map(([id, a]) => `${ASSETS[p.col.proto[id]].name} ${a.toFixed(1)}`);
console.log(`attractions     ${p.attractions.size}: ${names.slice(0, 8).join(', ')}${names.length > 8 ? ', ...' : ''}`);

sim.found(12);
// Load round the attractions against the city's, at the busiest moment seen.
// The strongest draws only: with every landmark in the city counted, a ring
// round each covers most of the map and "near an attraction" is the average.
const top = [...p.appeal.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id);
const measure = () => {
  const load = sim.routine.load, g = sim.lanes;
  let near = 0, nn = 0, all = 0, na = 0;
  for (let l = 0; l < Math.min(g.count, load.length); l++) {
    if ((g.use[l] & Use.CAR) === 0) continue;
    const mx = (g.ax[l] + g.bx[l]) / 2, mz = (g.az[l] + g.bz[l]) / 2;
    all += load[l]; na++;
    if (load[l] > worst) worst = load[l];
    for (const id of top) {
      const dx = p.col.x[id] - mx, dz = p.col.z[id] - mz;
      if (dx * dx + dz * dz < 200 * 200) { near += load[l]; nn++; break; }
    }
  }
  if (nn > 0) nearPeak = Math.max(nearPeak, near / nn);
  if (na > 0) meanPeak = Math.max(meanPeak, all / na);
  let h = 0; for (let l = 0; l < load.length; l++) if (load[l] > 0.8) h++;
  hot = Math.max(hot, h);
};
const samples = [];
let nearPeak = 0, meanPeak = 0, hot = 0, worst = 0;
for (let day = 0; day < DAYS; day++) {
  let cars = 0, walkers = 0, n = 0;
  for (let t = 0; t < TICKS_PER_DAY; t++) {
    sim.step(1);
    if (t % 30 === 0) { cars += sim.traffic.stats.driving; walkers += sim.strollers.count; n++; measure(); }
  }
  samples.push({ day, pop: sim.people.population, cars: cars / n, walkers: walkers / n,
    share: sim.routine.drawShare() });
  if (day % 4 === 3 || day === DAYS - 1) {
    const s = samples[samples.length - 1];
    console.log(`day ${String(day + 1).padStart(3)}   pop ${String(s.pop).padStart(6)}   cars ${s.cars.toFixed(0).padStart(5)}`
      + `   on foot ${s.walkers.toFixed(0).padStart(5)}   cross-town share ${(s.share * 100).toFixed(0)}%`);
  }
}

const first = samples[1], last = samples[samples.length - 1];
ok(p.attractions.size > 0, 'the city has places people travel to', `${p.attractions.size}`);
ok(last.pop > first.pop * 1.3, 'the city grew', `${first.pop} -> ${last.pop}`);
ok(last.cars > first.cars * 1.15, 'traffic grew with it, under a still camera',
  `${first.cars.toFixed(0)} -> ${last.cars.toFixed(0)}`);
ok(last.walkers > first.walkers * 1.15, 'so did the pavements',
  `${first.walkers.toFixed(0)} -> ${last.walkers.toFixed(0)}`);
ok(nearPeak > meanPeak * 1.1, 'the roads round attractions carry more than the average road',
  `${(nearPeak * 100).toFixed(1)}% vs ${(meanPeak * 100).toFixed(1)}%`);
console.log(`worst lane ${(worst * 100).toFixed(0)}%, lanes over 80% at once: ${hot} of ${sim.lanes.count}`);
console.log(`\nCROWDS  ${checks - failed}/${checks} checks`);
process.exit(failed === 0 ? 0 : 1);
