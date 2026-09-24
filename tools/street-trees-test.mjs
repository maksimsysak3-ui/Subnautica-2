/**
 * No tree in the road.
 *
 * Every tree on the default map is measured against every road near it: its
 * trunk must not be on a carriageway, and its crown -- the canopy the player
 * actually sees from above -- must end short of the kerb, or sit wholly
 * inside a central reservation. A canopy spread over the asphalt reads, from
 * the game's camera, as a tree standing in the road.
 *
 *   node tools/street-trees-test.mjs
 */
import * as esbuild from 'esbuild';
const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({ stdin: { contents: `export { makeCity, defaultWorld } from '${src}sim/index';\nexport { ROAD_SPECS } from '${src}sim/roadgraph';\nexport { ASSETS } from '${src}assets/registry';`, resolveDir: src, loader: 'ts' },
  bundle: true, format: 'esm', write: false, target: 'es2022', loader: { '.wgsl': 'text' } })).outputFiles[0].text;
const m = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));
const world = m.defaultWorld();
const city = m.makeCity(world);
const net = world.net;
const crown = new Map();
const segs = [];
for (const link of net.links) {
  const pts = net.samples(link); const spec = m.ROAD_SPECS[link.cls];
  for (let i = 0; i + 1 < pts.length; i++) segs.push([pts[i].x, pts[i].z, pts[i + 1].x, pts[i + 1].z, spec.half, spec.median]);
}
const dist = (px, pz, s) => { const [ax, az, bx, bz] = s; const dx = bx - ax, dz = bz - az; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
const G = 32, grid = new Map();
for (const sg of segs) {
  const x0 = Math.floor((Math.min(sg[0], sg[2]) - 20) / G), x1 = Math.floor((Math.max(sg[0], sg[2]) + 20) / G);
  const z0 = Math.floor((Math.min(sg[1], sg[3]) - 20) / G), z1 = Math.floor((Math.max(sg[1], sg[3]) + 20) / G);
  for (let a = x0; a <= x1; a++) for (let b = z0; b <= z1; b++) { const k = a * 100000 + b; (grid.get(k) ?? grid.set(k, []).get(k)).push(sg); }
}
let trees = 0, over = 0, onRoad = 0, worst = 0;
for (let i = 0; i < city.count; i++) {
  const o = i * 12; const def = m.ASSETS[Math.round(city.data[o + 7])];
  if (!def || def.zone !== 'nature') continue;
  const x = city.data[o], z = city.data[o + 1];
  let r = crown.get(def.id); if (r === undefined) { const b = def.build(2).bounds(); r = Math.max(-b.min[0], b.max[0], -b.min[2], b.max[2]); crown.set(def.id, r); }
  for (const s of grid.get(Math.floor(x / G) * 100000 + Math.floor(z / G)) ?? []) {
    const d = dist(x, z, s); const half = s[4], med = s[5];
    if (d > half + 12) continue;
    // Inside the carriageway band: between the median edge and the kerb.
    if (d < half && d > med) { onRoad++; break; }
    const intrude = d >= half ? (half - (d - r)) : (med > 0 && d <= med ? (d + r) - med : 0);
    if (intrude > 0.01) { over++; worst = Math.max(worst, intrude); break; }
  }
  trees++;
}
console.log(`trees ${trees}  trunk on a carriageway ${onRoad}  crown over a carriageway ${over}  worst ${worst.toFixed(2)} m`);
if (onRoad > 0 || over > 0) { console.log('FAIL  trees standing in or hanging over the road'); process.exit(1); }
console.log('PASS  no tree stands in a carriageway or spreads its crown over one');
