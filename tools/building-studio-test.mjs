/**
 * The building studio, every style and every use: each generated design must
 * build, stay on its lot, keep to the triangle budget, wind every face the
 * right way out, hold somebody, and survive a round trip through a mod file.
 *
 *   node tools/building-studio-test.mjs
 */
import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { blueprintAsset, blueprintMesh, cleanBlueprint, blueprintCapacity } from '${src}assets/generators/blueprint';`,
      `export { generateBuilding, BB_THEMES, BB_TYPES, BB_ROOFS, BB_PLANS, THEMES } from '${src}assets/generators/blueprint-building';`,
      `export { MeshBuilder } from '${src}assets/mesh';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022', loader: { '.wgsl': 'text' },
})).outputFiles[0].text;
const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));

let failed = 0, checks = 0;
const fail = (what) => { failed++; console.log(`FAIL  ${what}`); };
let worstTris = 0, seenRoofs = new Set(), seenPlans = new Set();
for (const theme of M.BB_THEMES) {
  for (const type of M.THEMES[theme].types) {
    for (let seed = 1; seed <= 6; seed++) {
      const g = M.generateBuilding(seed * 9973 + theme.length * 31, theme, type);
      const bp = M.cleanBlueprint({ name: `${theme} ${type}`, kind: 'building', building: g.plan, width: g.width, depth: g.depth });
      seenRoofs.add(bp.building.roof); seenPlans.add(bp.building.plan);
      const before = M.MeshBuilder.inverted ?? 0;
      for (const lod of [0, 1, 2]) {
        checks++;
        const m = M.blueprintMesh(bp, lod);
        const built = m.build({ occlusion: false });
        const tris = built.indices.length / 3;
        if (lod === 0) worstTris = Math.max(worstTris, tris);
        if (tris === 0) fail(`${theme}/${type}/${seed} lod ${lod}: empty mesh`);
        if (tris > 24000) fail(`${theme}/${type}/${seed} lod ${lod}: ${tris} triangles`);
        const b = m.bounds();
        const lx = bp.width * 4 + 0.05, lz = bp.depth * 4 + 0.05;
        if (b.max[0] > lx || b.min[0] < -lx || b.max[2] > lz || b.min[2] < -lz) {
          fail(`${theme}/${type}/${seed} lod ${lod}: off its lot (${b.min[0].toFixed(1)}..${b.max[0].toFixed(1)} x ${b.min[2].toFixed(1)}..${b.max[2].toFixed(1)}, lot ±${lx}, ±${lz})`);
        }
      }
      checks++;
      if ((M.MeshBuilder.inverted ?? 0) !== before) fail(`${theme}/${type}/${seed}: inverted boxes`);
      const cap = M.blueprintCapacity(bp);
      checks++;
      if (cap.homes + cap.jobs <= 0) fail(`${theme}/${type}/${seed}: holds nobody`);
      const asset = M.blueprintAsset(bp, 'test', `${theme}-${type}-${seed}`);
      checks++;
      const zoneOk = { house: 'residential', townhouses: 'residential', apartments: 'residential', shop: 'commercial',
        warehouse: 'industrial', factory: 'industrial', civic: 'office' }[type];
      if (asset.zone !== zoneOk) fail(`${theme}/${type}: zone ${asset.zone}, expected ${zoneOk}`);
      // A mod file round trip.
      checks++;
      const again = M.cleanBlueprint(JSON.parse(JSON.stringify(bp)));
      if (JSON.stringify(again) !== JSON.stringify(bp)) fail(`${theme}/${type}/${seed}: does not survive a mod file`);
    }
  }
}
checks++;
if (seenRoofs.size < M.BB_ROOFS.length) fail(`only ${[...seenRoofs].join(', ')} roofs came up`);
checks++;
if (seenPlans.size < 4) fail(`only ${[...seenPlans].join(', ')} plans came up`);
// An old tower blueprint is still a tower.
checks++;
const tower = M.cleanBlueprint({ name: 'Old', floors: 30 });
if (tower.kind === 'building') fail('a blueprint without a kind became a building');
console.log(`${checks} checks; ${M.BB_THEMES.length} styles; roofs ${[...seenRoofs].join('/')}; plans ${[...seenPlans].join('/')}; heaviest ${worstTris} triangles`);
console.log(failed === 0 ? 'BUILDING_STUDIO_OK' : `BUILDING_STUDIO: ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
