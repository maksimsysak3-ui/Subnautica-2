/**
 * What the spawner actually laid down.
 *
 * A city that renders is not the same as a city that is right, and the things
 * that go wrong here -- half the map empty, one prototype used ten thousand
 * times, a zone that never appears because no bucket matched it -- are all
 * invisible in a screenshot taken from two kilometres up.
 *
 *   node tools/city-stats.mjs [grid]
 */

import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: `export { makeCity, INSTANCE_FLOATS } from '${src}sim/city';\n`
      + `export { configureSim, simConfig } from '${src}sim/config';\n`
      + `export { ASSETS } from '${src}assets/registry';`,
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022',
})).outputFiles[0].text;
const { makeCity, INSTANCE_FLOATS, configureSim, simConfig, ASSETS } = await import(
  'data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));

// The map's own size unless one is asked for, so the numbers here are the
// numbers the game actually builds.
const asked = Number(process.argv[2] || 0);
if (asked > 0) configureSim({ cityGrid: asked });
const grid = asked > 0 ? asked : simConfig.cityGrid;

const t0 = performance.now();
const city = makeCity();
const ms = performance.now() - t0;

const byZone = new Map();
const byTheme = new Map();
let placedProtos = 0, tallest = 0, tallestId = '';
for (let i = 0; i < city.population.length; i++) {
  const n = city.population[i];
  if (n === 0) continue;
  placedProtos++;
  const a = ASSETS[i];
  byZone.set(a.zone, (byZone.get(a.zone) || 0) + n);
  if (a.theme) byTheme.set(a.theme, (byTheme.get(a.theme) || 0) + n);
  if (a.height > tallest) { tallest = a.height; tallestId = a.id; }
}

// How evenly the work is spread: if one prototype is a third of the city, the
// per-bucket draw path has one enormous bucket and four hundred empty ones.
const pop = [...city.population].map((n, i) => [n, ASSETS[i].id]).filter((r) => r[0] > 0);
pop.sort((a, b) => b[0] - a[0]);

// Occupancy, on the cell grid the spawner used.
const CELL = 8, half = grid / 2;
const d = city.data;
let covered = 0;
for (let i = 0; i < city.count; i++) {
  const o = i * INSTANCE_FLOATS;
  covered += (d[o + 4] * 2 - 1.6) * (d[o + 5] * 2 - 1.6);
}
const area = (grid * CELL) ** 2;

console.log(`grid            ${grid} cells (${((grid * CELL) / 1000).toFixed(1)} km square)`);
console.log(`built in        ${ms.toFixed(0)} ms`);
console.log(`instances       ${city.count.toLocaleString()}  (${(city.data.byteLength / 1024).toFixed(0)} KiB)`);
console.log(`prototypes used ${placedProtos} of ${ASSETS.length}`);
console.log(`lot coverage    ${((covered / area) * 100).toFixed(1)}% of the map`);
console.log(`tallest placed  ${tallestId} at ${tallest} m`);
console.log(`\nby zone`);
for (const [k, v] of [...byZone].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(12)} ${v.toLocaleString()}`);
}
console.log(`by theme`);
for (const [k, v] of [...byTheme].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(12)} ${v.toLocaleString()}`);
}
console.log(`\nmost placed`);
for (const [n, id] of pop.slice(0, 8)) {
  console.log(`  ${id.padEnd(24)} ${n.toLocaleString()}  ${((n / city.count) * 100).toFixed(1)}%`);
}
const never = ASSETS.filter((a, i) => city.population[i] === 0
  && a.zone !== 'fleet');
// Overlap. Two prototypes on the same ground is the one spawner fault that
// cannot be seen from above and cannot be missed from the street.
//
// Road on road is excluded, and not as a convenience: a straight run is
// deliberately a continuous carriageway of tiles stretched to fit, so
// consecutive tiles share the cell their boundary falls inside. What must
// never happen is a building on a road, or a building on a building.
const CELLS = grid;
const grid2 = new Int32Array(CELLS * CELLS).fill(-1);
let clashes = 0; let firstClash = null;
for (let i = 0; i < city.count; i++) {
  const o = i * INSTANCE_FLOATS;
  const hx = d[o + 4] - 0.8, hz = d[o + 5] - 0.8;
  const gx0 = Math.round((d[o] - hx) / CELL + half), gz0 = Math.round((d[o + 1] - hz) / CELL + half);
  const w = Math.round((hx * 2) / CELL), h = Math.round((hz * 2) / CELL);
  for (let b = 0; b < h; b++) {
    for (let a = 0; a < w; a++) {
      const c = (gz0 + b) * CELLS + gx0 + a;
      if (c < 0 || c >= grid2.length) continue;
      if (grid2[c] >= 0) {
        const other = ASSETS[d[grid2[c] * INSTANCE_FLOATS + 7]];
        const mine = ASSETS[d[o + 7]];
        // Planting is allowed to overlap: a wood is interlocking crowns, and
        // trees deliberately do not reserve the ground they stand on.
        if (other.zone !== 'nature' && mine.zone !== 'nature'
          && !(other.zone === 'road' && mine.zone === 'road')) {
          clashes++;
          if (!firstClash) firstClash = [other.id, mine.id];
        }
      }
      grid2[c] = i;
    }
  }
}
console.log(`\noverlapping cells ${clashes}${firstClash ? '  e.g. ' + firstClash.join(' over ') : ''}`);

const big = ['svc.transport.airport', 'svc.parks.gridiron', 'svc.parks.soccer', 'svc.gov.convention', 'svc.power.nuclear'];
console.log('landmarks       ' + big.map((id) => {
  const i = ASSETS.findIndex((a) => a.id === id);
  return `${id.split('.').pop()} ${city.population[i]}`;
}).join(', '));
const sig = ASSETS.reduce((n, a, i) => n + (a.signature ? city.population[i] : 0), 0);
console.log(`signature       ${sig}`);

console.log(`\nnever placed    ${never.length}`);
if (never.length) console.log('  ' + never.slice(0, 24).map((a) => a.id).join(' '));
