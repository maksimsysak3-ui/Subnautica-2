/**
 * Roads on the ground: every vertex of a road's carriageway, junctions and
 * crossings against the ground as the terrain mesh draws it (graded), on every
 * starting map with a few roads laid across open country as a player would.
 *
 * A road floating over the ground, or buried in it, is a gap here. Cars ride
 * the same drawn ground (`surfaceAt`), so a road that passes is a road the
 * traffic sits on. Lamp posts, kerbs, skirts and viaducts are not measured;
 * over water a road is a bridge and is not measured either.
 *
 *   node tools/road-ground-test.mjs
 */
import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { makeCity } from '${src}sim/city';`,
      `export { startingWorld } from '${src}sim/world';`,
      `export { surfaceAt, baseHeightAt } from '${src}sim/terrain';`,
      `export { buildRoadMesh, ROAD_FLOATS, SURF } from '${src}sim/roadmesh';`,
      `export { waterAt } from '${src}sim/river';`,
      `export { configureSim } from '${src}sim/config';`,
      `export { useMap, MAPS } from '${src}sim/maps';`,
      `export { clearGrading, clearTerrainCache } from '${src}sim/grading';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022', loader: { '.wgsl': 'text' },
})).outputFiles[0].text;
const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));
M.configureSim({ cityGrid: 640, terrainSize: 9216 });

const MEASURED = new Set([M.SURF.ROAD, M.SURF.JUNCTION, M.SURF.MEDIAN, M.SURF.CROSSING]);
let failed = 0;
for (const map of M.MAPS) {
  M.useMap(map.id);
  M.clearGrading(); M.clearTerrainCache();
  const world = M.startingWorld(640);
  const net = world.net;
  // Roads across open country, over whatever the map has there.
  for (const [ax, az, bx, bz] of [[-300, -300, 400, -150], [400, -150, 500, 450], [-500, 200, 300, 350]]) {
    net.add(ax, az, bx, bz, 'street', 0, null, 0);
  }
  net.rasterise();
  M.makeCity(world);
  const mesh = M.buildRoadMesh(net, M.baseHeightAt);
  const v = mesh.vertices, F = M.ROAD_FLOATS;
  let worst = 0, sum = 0, n = 0, over = 0;
  for (let i = 0; i < v.length; i += F) {
    const x = v[i], y = v[i + 1], z = v[i + 2], surf = v[i + 9], lift = v[i + 13];
    if (!MEASURED.has(surf) || lift > 0.5 || M.waterAt(x, z) !== null) continue;
    const gap = y - M.surfaceAt(x, z);
    worst = Math.max(worst, Math.abs(gap));
    sum += Math.abs(gap); n++;
    if (Math.abs(gap) > 0.5) over++;
  }
  const ok = n > 0 && worst < 1.0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${map.id.padEnd(11)} worst gap ${worst.toFixed(2)} m, `
    + `mean ${(sum / Math.max(1, n)).toFixed(2)} m, ${over}/${n} vertices over 0.5 m`);
}
console.log(failed === 0 ? '\nROAD_GROUND_OK' : `\nROAD_GROUND: ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
