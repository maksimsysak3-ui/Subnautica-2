/**
 * Tourism: what draws visitors, where they sleep, how they get here, and that
 * the names it looks for are still the names in the asset library.
 *
 *   node tools/tourism-test.mjs
 */
import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { attractionOf, bedsOf, gatewayOf, visitors, appealOf } from '${src}sim/tourism';`,
      `export { ASSETS } from '${src}assets/registry';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022', loader: { '.wgsl': 'text' },
})).outputFiles[0].text;
const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));

let failed = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); };

// The library: the attractions and hotels it looks for exist, by the ids it looks for.
const byId = new Map(M.ASSETS.map((a) => [a.id, a]));
for (const id of ['svc.parks.zoo', 'svc.parks.stadium', 'svc.gov.museum', 'svc.transport.airport', 'svc.transport.rail']) {
  check(byId.has(id), `the library has ${id}`);
}
const draws = M.ASSETS.filter((a) => M.attractionOf(a).draw > 0);
const hotels = M.ASSETS.filter((a) => M.bedsOf(a) > 0);
console.log(`  ${draws.length} attractions, ${hotels.length} hotels in the library`);
check(draws.length >= 20, 'plenty of things draw visitors');
check(hotels.length >= 5, `hotels grow in more than one style (${hotels.map((h) => h.id).slice(0, 4).join(', ')}...)`);
check(hotels.every((h) => h.zone === 'commercial'), 'every hotel is commercial');
check(M.attractionOf(byId.get('svc.parks.zoo')).draw > M.attractionOf(byId.get('svc.parks.playground') ?? { id: 'svc.parks.playground', footprint: [1, 1] }).draw,
  'a zoo draws more than a playground');
check(M.ASSETS.filter((a) => a.zone === 'residential' && !a.signature).every((a) => M.attractionOf(a).draw === 0), 'nobody visits an ordinary house');
check(hotels.some((h) => h.signature && M.bedsOf(h) > 160), 'the grand hotel has the most beds');

// The model.
const base = M.visitors(300, 1000, 1, 1, 5000);
check(M.visitors(0, 1000, 1.8, 1, 5000).visitors === 0, 'nothing to see, nobody comes');
check(base.visitors > 0 && base.overnight > 0, `something to see brings visitors (${base.visitors} a day)`);
const noBeds = M.visitors(300, 0, 1, 1, 5000);
check(noBeds.overnight === 0 && noBeds.visitors < base.visitors, 'no hotels, no overnight stays, and fewer visitors');
const flown = M.visitors(300, 5000, 1.8, 1, 5000), driven = M.visitors(300, 5000, 0.8, 1, 5000);
check(flown.visitors > driven.visitors * 1.8, `an airport brings the world (${driven.visitors} -> ${flown.visitors})`);
check(M.appealOf(0.9, 0.8) > M.appealOf(0.4, 0.2), 'a happy, handsome city is better spoken of');
const village = M.visitors(300, 0, 1, 1, 100);
check(village.visitors < noBeds.visitors, 'a village gets fewer day-trippers than a town');
check(M.gatewayOf(new Set(['svc.transport.airport', 'svc.transport.rail'])).via === 'the airport', 'the best way in counts');

console.log(`\n${checks} checks`);
console.log(failed === 0 ? 'TOURISM_OK' : `TOURISM: ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
