/**
 * The draw census: every prototype's visibility slice is as big as the
 * instances written for it, and an incremental edit reserves exactly what a
 * fresh build does.
 *
 * The renderer sizes each prototype's slice from `City.population`. An
 * instance the census never counted overflows into its neighbour's slice and
 * is drawn with the wrong mesh; a census that grows on every edit reserves
 * memory for nothing, for as long as the session runs -- which is what the
 * in-place top-up of the woods and the mover reserve used to do.
 *
 *   node tools/census-test.mjs
 */
import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: { contents: `export { makeCity, defaultWorld } from '${src}sim/index';`, resolveDir: src, loader: 'ts' },
  bundle: true, format: 'esm', write: false, target: 'es2022', loader: { '.wgsl': 'text' },
})).outputFiles[0].text;
const m = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));

const world = m.defaultWorld();
const fails = [];
const census = (label, city) => {
  const real = new Map();
  for (let i = 0; i < city.count; i++) {
    const p = Math.round(city.data[i * 12 + 7]);
    real.set(p, (real.get(p) ?? 0) + 1);
  }
  let overflow = 0;
  for (const [p, n] of real) if (n > (city.population[p] ?? 0)) overflow++;
  let spare = 0;
  for (let p = 0; p < city.population.length; p++) spare += Math.max(0, city.population[p] - (real.get(p) ?? 0));
  console.log(`${label.padEnd(8)} instances ${city.count}  overflowing ${overflow}  spare ${spare}`);
  if (overflow > 0) fails.push(`${label}: ${overflow} prototypes have more instances than slots`);
  return spare;
};

const fresh = census('fresh', m.makeCity(world));
census('again', m.makeCity(world));
let edited = 0;
for (let i = 0; i < 3; i++) edited = census(`edit ${i + 1}`, m.makeCity(world, { gx: 100 + i * 7, gz: 100, w: 20, d: 20 }));
if (edited !== fresh) fails.push(`an edit reserves ${edited} spare slots where a fresh build reserves ${fresh}`);

if (fails.length > 0) {
  console.log('FAIL');
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('PASS  every slice holds its instances, and edits reserve what a fresh build does');
