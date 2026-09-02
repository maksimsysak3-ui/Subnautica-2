/**
 * Asset invariants. No GPU needed.
 *
 * The one that matters is footprint. An asset whose geometry runs past its
 * declared lot looks perfectly fine in a viewer and then overlaps the street
 * and its neighbours once the spawner places it, which is a bug you find
 * months later in a screenshot and cannot easily trace back. Cheaper to assert.
 *
 *   node tools/asset-test.mjs
 */

import * as esbuild from 'esbuild';

/** pos(3) + normal(3) + material(1) + occlusion(1) + tint(1) + local uv(2). */
const STRIDE = 11;

const CELL = 8;
/** Eaves, canopies and cornices may lean out this far past the lot. */
const OVERHANG = 0.8;
/** LOD0 ceiling. Above this an asset is too heavy to repeat across a city. */
const MAX_TRIS = 10000;
/**
 * Services get a wider band at both ends. There is only ever one or two of
 * each on a map so a landmark can afford more, and each has to be
 * recognisable on its own rather than as a member of a category -- which
 * needs a floor a zoned building does not.
 */
const SERVICE_MIN = 2400;
const SERVICE_MAX = 12000;
/**
 * LOD0 floor. Below this an asset has not been detailed -- no frames, no
 * furniture, nothing at street level -- and it shows next to its neighbours.
 */
const MIN_TRIS = 1000;

const bundle = (
  await esbuild.build({
    entryPoints: [new URL('../src/assets/registry.ts', import.meta.url).pathname],
    bundle: true, format: 'esm', write: false, target: 'es2022',
  })
).outputFiles[0].text;

const { ASSETS } = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));

const fails = [];
const note = (id, msg) => fails.push(`${id}: ${msg}`);

console.log('asset'.padEnd(22) + 'LOD0 / 1 / 2'.padEnd(22) + 'extent (m)'.padEnd(18) + 'height');

for (const a of ASSETS) {
  const meshes = [0, 1, 2].map((l) => a.build(l).build());
  const tris = meshes.map((m) => m.indices.length / 3);

  const limitX = (a.footprint[0] * CELL) / 2 + OVERHANG;
  const limitZ = (a.footprint[1] * CELL) / 2 + OVERHANG;
  let maxX = 0, maxZ = 0, maxY = 0, minY = 0;

  for (const [lod, mesh] of meshes.entries()) {
    if (tris[lod] === 0) { note(a.id, `LOD ${lod} is empty`); continue; }
    for (let i = 0; i < mesh.vertices.length; i += STRIDE) {
      const x = mesh.vertices[i], y = mesh.vertices[i + 1], z = mesh.vertices[i + 2];
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        note(a.id, `LOD ${lod} has a non-finite vertex`);
        break;
      }
      maxX = Math.max(maxX, Math.abs(x));
      maxZ = Math.max(maxZ, Math.abs(z));
      maxY = Math.max(maxY, y);
      minY = Math.min(minY, y);
    }
  }

  console.log(
    a.id.padEnd(22) +
    tris.map((t) => String(t).padStart(5)).join(' / ').padEnd(22) +
    `${(maxX * 2).toFixed(1)} x ${(maxZ * 2).toFixed(1)}`.padEnd(18) +
    `${maxY.toFixed(1)}m`,
  );

  if (maxX > limitX) note(a.id, `overflows its lot on X: ${maxX.toFixed(1)}m past centre, lot allows ${limitX.toFixed(1)}m`);
  if (maxZ > limitZ) note(a.id, `overflows its lot on Z: ${maxZ.toFixed(1)}m past centre, lot allows ${limitZ.toFixed(1)}m`);
  if (minY < -0.01) note(a.id, `has geometry below ground (${minY.toFixed(2)}m)`);
  const service = a.zone === 'service';
  const ceiling = service ? SERVICE_MAX : MAX_TRIS;
  const floor = service ? SERVICE_MIN : MIN_TRIS;
  if (tris[0] > ceiling) note(a.id, `LOD0 is ${tris[0]} triangles, over the ${ceiling} ceiling`);
  if (tris[0] < floor) note(a.id, `LOD0 is only ${tris[0]} triangles, under the ${floor} floor`);
  if (tris[1] > tris[0] || tris[2] > tris[1]) note(a.id, `LOD ladder is not decreasing: ${tris.join(' / ')}`);
  if (Math.abs(maxY - a.height) > 0.2) {
    note(a.id, `height ${a.height}m does not match the mesh at ${maxY.toFixed(1)}m`);
  }
  // The smallest lot this geometry would actually fit in, so the failure
  // message says what to change rather than only that something is wrong.
  const needX = Math.ceil(((maxX - OVERHANG) * 2) / CELL);
  const needZ = Math.ceil(((maxZ - OVERHANG) * 2) / CELL);
  if (needX > a.footprint[0] || needZ > a.footprint[1]) {
    note(a.id, `declared ${a.footprint[0]}x${a.footprint[1]} cells but needs ${needX}x${needZ}`);
  }
}

if (fails.length) {
  console.error('\nFAIL\n' + fails.map((f) => '  - ' + f).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`\nPASS  ${ASSETS.length} assets inside their lots, within budget, LODs decreasing`);
}
