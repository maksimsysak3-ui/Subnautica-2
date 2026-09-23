import * as esbuild from 'esbuild';
const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({ stdin: { contents: `export { makeCity, defaultWorld } from '${src}sim/index';\nexport { ASSETS } from '${src}assets/registry';`, resolveDir: src, loader: 'ts' },
  bundle: true, format: 'esm', write: false, target: 'es2022', loader: { '.wgsl': 'text' } })).outputFiles[0].text;
const m = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));
const world = m.defaultWorld();
const check = (label, city) => {
  const real = new Map();
  for (let i = 0; i < city.count; i++) { const p = Math.round(city.data[i * 12 + 7]); real.set(p, (real.get(p) ?? 0) + 1); }
  let bad = 0;
  for (const [p, n] of real) if (n > (city.population[p] ?? 0)) { bad++; if (bad < 8) console.log(label, 'OVERFLOW', m.ASSETS[p]?.id, 'instances', n, 'reserved', city.population[p]); }
  let over = 0; for (let p = 0; p < city.population.length; p++) over += Math.max(0, city.population[p] - (real.get(p) ?? 0));
  console.log(label, 'instances', city.count, 'protos overflowing', bad, 'excess reserved', over);
};
check('first', m.makeCity(world));
check('again', m.makeCity(world));
check('dirty', m.makeCity(world, { gx: 100, gz: 100, w: 20, d: 20 }));
