/**
 * The packed atlas, checked against the meshes it came from.
 *
 * Twenty bytes a vertex is a lossy format and the loss has to be bounded
 * somewhere other than in a screenshot. Position is quantised to three
 * unsigned shorts against the prototype's own bounding box, so the error is a
 * fixed fraction of the building rather than a fixed distance -- which is the
 * right trade and also the reason a two-hundred-metre tower needs checking
 * separately from a wheelie bin. The normal is octahedron-mapped into two
 * bytes and the occlusion into one. Everything else has to survive exactly,
 * including the last word, which carries the part key or the imported vertex
 * colour depending on the material -- so this also checks that no vertex
 * wanted both, which is the assumption the whole union rests on.
 *
 * The decode here is written independently of the encoder and mirrors what the
 * shader will do, so this is a round-trip test rather than a restatement of
 * the packing.
 *
 *   node tools/atlas-test.mjs
 */

import * as esbuild from 'esbuild';

const STRIDE = 13;
/** Worst tolerated position error, as a fraction of the prototype's size. */
const POS_TOL = 1 / 30000;
/** Worst tolerated angle between the source normal and the unpacked one. */
const NORMAL_TOL_DEG = 2.0;

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: `export { Atlas, VERTEX_BYTES } from '${src}gfx/atlas';\n`
      + `export { ASSETS } from '${src}assets/registry';`,
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022',
})).outputFiles[0].text;
const { Atlas, VERTEX_BYTES, ASSETS } = await import(
  'data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));

/** The shader's side of the packing, written from the format not the encoder. */
function unpackNormal(word) {
  const d = (b) => (b - 127.5) / 127.5;
  let x = d(word & 255), z = d((word >>> 8) & 255);
  let y = 1 - Math.abs(x) - Math.abs(z);
  if (y < 0) {
    const tx = (1 - Math.abs(z)) * (x >= 0 ? 1 : -1);
    const tz = (1 - Math.abs(x)) * (z >= 0 ? 1 : -1);
    x = tx; z = tz;
  }
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

const atlas = new Atlas(ASSETS);
const fails = [];
const note = (m) => fails.push(m);

let worstPos = 0, worstPosId = '', worstAng = 0, worstAngId = '';
let checkedVerts = 0;
const perLod = [0, 0, 0];

for (const def of ASSETS) {
  // A prototype is baked as a unit -- all three levels on the first touch,
  // because the quantisation frame is the union of the three and measuring it
  // needs all three built. So the invariant is about the prototype, not about
  // the call: its three spans lie end to end in the arena, in order, and
  // together they are exactly what the arena grew by.
  const before = atlas.vertexCount;
  const spans = [0, 1, 2].map((lod) => atlas.bake(def.id, lod));
  let at = before;
  for (const lod of [0, 1, 2]) {
    const span = spans[lod];
    if (span.first !== at) {
      note(`${def.id} lod${lod}: span starts at ${span.first}, expected ${at}`);
    }
    at += span.count;
    perLod[lod] += span.count;
  }
  if (atlas.vertexCount !== at) {
    note(`${def.id}: arena is at ${atlas.vertexCount}, its spans end at ${at}`);
  }

  // Baking again must be free and must return the same spans.
  const grew = atlas.vertexCount;
  for (const lod of [0, 1, 2]) {
    const again = atlas.bake(def.id, lod);
    if (again.first !== spans[lod].first || again.count !== spans[lod].count) {
      note(`${def.id} lod${lod}: re-bake returned a different span`);
    }
  }
  if (atlas.vertexCount !== grew) note(`${def.id}: re-baking grew the arena`);
}

// Decode the arena once and compare it against freshly built meshes.
const WORDS = VERTEX_BYTES / 4;
const u32 = new Uint32Array(atlas.bytes.buffer, 0, atlas.vertexCount * WORDS);
const MAT_IMPORTED = 26;

for (const def of ASSETS) {
  const p = atlas.get(def.id);
  const diag = Math.hypot(...p.span);
  for (const lod of [0, 1, 2]) {
    const span = p.lods[lod];
    const mesh = def.build(lod).build();
    const v = mesh.vertices, ix = mesh.indices;
    const raw = new Uint32Array(v.buffer, v.byteOffset, v.length);
    if (span.count !== ix.length) {
      note(`${def.id} lod${lod}: baked ${span.count} vertices for ${ix.length} indices`);
      continue;
    }
    // Every twelfth vertex, so the whole library is covered without decoding
    // eight and a half million of them.
    for (let t = 0; t < span.count; t += 12) {
      const o = ix[t] * STRIDE;
      const d = (span.first + t) * WORDS;
      const qp = [u32[d] & 65535, u32[d] >>> 16, u32[d + 1] & 65535];
      let err = 0;
      for (let k = 0; k < 3; k++) {
        const got = p.lo[k] + (qp[k] / 65535) * p.span[k];
        err = Math.max(err, Math.abs(got - v[o + k]) / p.span[k]);
      }
      if (err > worstPos) { worstPos = err; worstPosId = `${def.id} lod${lod}`; }

      const n = unpackNormal(u32[d + 1] >>> 16);
      const dot = Math.max(-1, Math.min(1, n[0] * v[o + 3] + n[1] * v[o + 4] + n[2] * v[o + 5]));
      const ang = (Math.acos(dot) * 180) / Math.PI;
      if (ang > worstAng) { worstAng = ang; worstAngId = `${def.id} lod${lod}`; }

      const attrs = u32[d + 2];
      const mat = attrs & 255;
      if (mat !== v[o + 6]) note(`${def.id} lod${lod}: material ${mat} != ${v[o + 6]}`);
      if (((attrs >>> 16) & 255) !== v[o + 8]) note(`${def.id} lod${lod}: tint slot lost`);
      const ao = ((attrs >>> 8) & 255) / 255;
      if (Math.abs(ao - v[o + 7]) > 1 / 255) note(`${def.id} lod${lod}: occlusion ${ao} != ${v[o + 7]}`);

      // The facade uv. Only meaningful on a minority of faces, but the sign
      // labeller and the window-interior shader both read it, so a face that
      // loses it renders a blank sign or a lit room in the wrong place.
      const uvw = u32[d + 3];
      for (const [k, got] of [[9, (uvw & 65535) / 65535], [10, (uvw >>> 16) / 65535]]) {
        if (Math.abs(got - v[o + k]) > 1 / 30000) {
          note(`${def.id} lod${lod}: uv${k === 9 ? 'u' : 'v'} ${got} != ${v[o + k]}`);
        }
      }

      // The union word, checked against whichever side the material selects --
      // and the other side checked to be absent, which is what makes sharing
      // the word sound rather than merely convenient.
      const union = u32[d + 4];
      if (mat === MAT_IMPORTED) {
        if (union !== raw[o + 12]) note(`${def.id} lod${lod}: vertex colour lost`);
        if (v[o + 11] !== 0) note(`${def.id} lod${lod}: imported vertex also carries key ${v[o + 11]}`);
      } else {
        if (union !== v[o + 11]) note(`${def.id} lod${lod}: part key ${union} != ${v[o + 11]}`);
        if (v[o + 12] !== 0) note(`${def.id} lod${lod}: keyed vertex also carries a colour`);
      }
      checkedVerts++;
    }
    void diag;
  }
}

const MB = (b) => (b / 1048576).toFixed(1);
console.log(`prototypes      ${ASSETS.length}`);
console.log(`vertices        ${(atlas.vertexCount / 1000).toFixed(0)}k` +
  `  (LOD0 ${(perLod[0] / 1000).toFixed(0)}k, LOD1 ${(perLod[1] / 1000).toFixed(0)}k, LOD2 ${(perLod[2] / 1000).toFixed(0)}k)`);
console.log(`arena           ${MB(atlas.byteLength)} MB at ${VERTEX_BYTES} B/vertex` +
  `  (was ${MB(atlas.vertexCount * 52)} MB unpacked, plus ${MB((atlas.vertexCount / 3) * 12)} MB of indices)`);
console.log(`LOD2 only       ${MB(perLod[2] * VERTEX_BYTES)} MB  -- resident for the whole library`);
console.log(`checked         ${(checkedVerts / 1000).toFixed(0)}k vertices decoded`);
console.log(`worst position  ${(worstPos * 100).toFixed(4)}% of extent   ${worstPosId}`);
console.log(`worst normal    ${worstAng.toFixed(2)} degrees   ${worstAngId}`);

if (worstPos > POS_TOL) note(`position error ${worstPos} over tolerance ${POS_TOL} (${worstPosId})`);
if (worstAng > NORMAL_TOL_DEG) note(`normal error ${worstAng.toFixed(2)} deg over tolerance ${NORMAL_TOL_DEG} (${worstAngId})`);

if (fails.length) {
  console.error('\nFAIL\n' + fails.slice(0, 20).map((f) => '  - ' + f).join('\n')
    + (fails.length > 20 ? `\n  ... and ${fails.length - 20} more` : ''));
  process.exitCode = 1;
} else {
  console.log('\nPASS  every prototype bakes, round-trips inside tolerance, and re-bakes free');
}
