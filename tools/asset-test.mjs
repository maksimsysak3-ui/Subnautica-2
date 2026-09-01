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

/** position(3) + normal(3) + material(1) + occlusion(1). Must match mesh.ts. */
const STRIDE = 8;

const CELL = 8;
/** Eaves, canopies and cornices may lean out this far past the lot. */
const OVERHANG = 0.8;
/** LOD0 ceiling. Above this an asset is too heavy to repeat across a city. */
const MAX_TRIS = 5000;

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
  if (tris[0] > MAX_TRIS) note(a.id, `LOD0 is ${tris[0]} triangles, over the ${MAX_TRIS} ceiling`);
  if (tris[1] > tris[0] || tris[2] > tris[1]) note(a.id, `LOD ladder is not decreasing: ${tris.join(' / ')}`);
  if (Math.abs(maxY - a.height) > a.height * 0.18) {
    note(a.id, `declared height ${a.height}m but the mesh is ${maxY.toFixed(1)}m`);
  }
  // A shaded variant that is not markedly cheaper than its sculpted twin has
  // no reason to exist.
  const twin = ASSETS.find((o) => o.zone === a.zone && o.density === a.density && o.variant !== a.variant);
  if (twin && a.variant === 'shaded' && tris[0] > twin.build(0).triangleCount * 0.5) {
    note(a.id, 'shaded variant is not meaningfully cheaper than its sculpted twin');
  }
}

if (fails.length) {
  console.error('\nFAIL\n' + fails.map((f) => '  - ' + f).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`\nPASS  ${ASSETS.length} assets inside their lots, within budget, LODs decreasing`);
}
