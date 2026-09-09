/**
 * The asset library, packed for the GPU.
 *
 * The game has never drawn an asset. It draws `makeCity()`'s output -- a
 * hundred thousand parametric boxes expanded in `box.wgsl` -- and the four
 * hundred and ten generators in `src/assets` have only ever been called by the
 * viewer. This is the seam between them: it turns a generator into a span of
 * vertices the renderer can point an instanced draw at.
 *
 * The whole design is answering one number. Baked in the builder's own vertex
 * format, the library is four hundred and twenty-six megabytes:
 *
 *     LOD0  1,907k tris  5,720k verts   284 MB
 *     LOD1    674k tris  2,023k verts   100 MB
 *     LOD2    280k tris    839k verts    42 MB
 *
 * Two facts bring that down to something a browser can hold. First, the
 * vertices are unshared -- five million seven hundred thousand of them for one
 * million nine hundred thousand triangles is exactly three per triangle,
 * because a flat normal forces a vertex per corner. So the index buffer is
 * pure redundancy and there isn't one: the draws are non-indexed, which costs
 * nothing and saves twenty-two megabytes and a bind slot. Second, a vertex
 * does not need fifty-two bytes. Position quantises to three unsigned shorts
 * against the prototype's own bounding box -- the same trick the fleet
 * importer already ships -- the normal octahedron-encodes into one word, and
 * material, tint, occlusion and part key pack into another. Sixteen bytes.
 *
 * That is eighty-seven megabytes for every LOD0 in the library, and the game
 * never needs every LOD0 at once: baking is on demand and cached, so what is
 * resident is what has actually been placed. A city of a hundred and fifty
 * distinct prototypes is about forty-eight megabytes.
 */

import { ASSETS } from '../assets/registry';
import type { AssetDef } from '../assets/types';

/** Bytes per packed vertex: pos u16x3 + pad, normal u32, attributes u32. */
export const VERTEX_BYTES = 16;

/** How much vertex arena to start with, in vertices. Grows by doubling. */
const INITIAL_VERTS = 1 << 18;

/**
 * Where one prototype's mesh lives at one level of detail.
 *
 * `first` and `count` are vertices, not triangles, and the draw is non-indexed,
 * so a bucket's draw is `draw(count, instances, first, 0)` and nothing else.
 */
export interface Span {
  first: number;
  count: number;
}

/**
 * A prototype: one asset, its three spans, and the parts of its descriptor the
 * renderer and the spawner actually read.
 *
 * `lo` and `span` are the quantisation frame -- the box the positions were
 * squeezed into -- and the shader needs both to get the metres back.
 */
export interface Prototype {
  index: number;
  id: string;
  def: AssetDef;
  lo: [number, number, number];
  span: [number, number, number];
  lods: Array<Span | null>;
}

/** Two 8-bit signed values in one word: an octahedron-mapped unit normal. */
function packNormal(nx: number, ny: number, nz: number): number {
  const s = Math.abs(nx) + Math.abs(ny) + Math.abs(nz) || 1;
  let ox = nx / s, oz = nz / s;
  if (ny < 0) {
    const tx = (1 - Math.abs(oz)) * (ox >= 0 ? 1 : -1);
    const tz = (1 - Math.abs(ox)) * (oz >= 0 ? 1 : -1);
    ox = tx; oz = tz;
  }
  const q = (v: number): number => Math.max(0, Math.min(255, Math.round(v * 127.5 + 127.5)));
  return q(ox) | (q(oz) << 8);
}

/**
 * The library, baked on demand into one arena.
 *
 * Deliberately not a constructor that bakes everything: the point of the
 * on-demand path is that a map which never places a nuclear station never pays
 * for one.
 */
export class Atlas {
  readonly prototypes: Prototype[] = [];
  private byId = new Map<string, Prototype>();
  private data = new ArrayBuffer(INITIAL_VERTS * VERTEX_BYTES);
  private u16 = new Uint16Array(this.data);
  private u32 = new Uint32Array(this.data);
  /** Vertices written so far. The arena is dense; spans never move. */
  private used = 0;

  constructor(defs: readonly AssetDef[] = ASSETS) {
    defs.forEach((def, index) => {
      const p: Prototype = {
        index, id: def.id, def,
        lo: [0, 0, 0], span: [1, 1, 1], lods: [null, null, null],
      };
      this.prototypes.push(p);
      this.byId.set(def.id, p);
    });
  }

  get vertexCount(): number { return this.used; }
  get byteLength(): number { return this.used * VERTEX_BYTES; }
  /** The packed arena, trimmed to what has been written. */
  get bytes(): Uint8Array { return new Uint8Array(this.data, 0, this.byteLength); }

  get(id: string): Prototype | undefined { return this.byId.get(id); }

  private grow(need: number): void {
    let size = this.data.byteLength;
    while (size < need * VERTEX_BYTES) size *= 2;
    if (size === this.data.byteLength) return;
    const next = new ArrayBuffer(size);
    new Uint8Array(next).set(new Uint8Array(this.data, 0, this.used * VERTEX_BYTES));
    this.data = next;
    this.u16 = new Uint16Array(next);
    this.u32 = new Uint32Array(next);
  }

  /**
   * Bake one level of detail, or return the span already baked.
   *
   * The quantisation frame is taken from LOD0 and reused for the others. It
   * has to be: the three levels share one frame in the shader, and deriving it
   * separately per level would make a building's LOD1 a slightly different
   * size from its LOD0 and pop as it crossed the switch.
   */
  bake(id: string, lod: number): Span {
    const p = this.byId.get(id);
    if (p === undefined) throw new Error(`no such asset: ${id}`);
    const have = p.lods[lod];
    if (have !== null) return have;

    const mesh = p.def.build(lod).build();
    const v = mesh.vertices, ix = mesh.indices;
    const STRIDE = 13;

    if (p.lods.every((s) => s === null)) {
      // First bake of this prototype sets the frame, from LOD0 wherever it can
      // be had, so the coarser levels quantise against the shape's real bounds
      // rather than their own.
      const src = lod === 0 ? v : p.def.build(0).build().vertices;
      const lo: [number, number, number] = [Infinity, Infinity, Infinity];
      const hi: [number, number, number] = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < src.length; i += STRIDE) {
        for (let k = 0; k < 3; k++) {
          if (src[i + k] < lo[k]) lo[k] = src[i + k];
          if (src[i + k] > hi[k]) hi[k] = src[i + k];
        }
      }
      p.lo = lo;
      // A degenerate axis would divide by zero; a millimetre of span is
      // cheaper than a special case in the shader.
      p.span = [
        Math.max(hi[0] - lo[0], 0.001),
        Math.max(hi[1] - lo[1], 0.001),
        Math.max(hi[2] - lo[2], 0.001),
      ];
    }

    const count = ix.length;
    this.grow(this.used + count);
    const first = this.used;
    for (let t = 0; t < count; t++) {
      const o = ix[t] * STRIDE;
      const w = (first + t) * 8;          // u16 words per vertex
      for (let k = 0; k < 3; k++) {
        const q = ((v[o + k] - p.lo[k]) / p.span[k]) * 65535;
        this.u16[w + k] = q < 0 ? 0 : q > 65535 ? 65535 : Math.round(q);
      }
      this.u16[w + 3] = 0;
      const d = (first + t) * 4;          // u32 words per vertex
      this.u32[d + 2] = packNormal(v[o + 3], v[o + 4], v[o + 5]);
      // material, occlusion, tint slot, part key -- one byte each.
      this.u32[d + 3] = (v[o + 6] & 255)
        | ((Math.max(0, Math.min(255, Math.round(v[o + 7] * 255))) & 255) << 8)
        | ((v[o + 8] & 255) << 16)
        | ((v[o + 11] & 255) << 24);
    }
    this.used += count;
    const span: Span = { first, count };
    p.lods[lod] = span;
    return span;
  }

  /** Bake every level of a prototype. What a placed asset needs. */
  bakeAll(id: string): void {
    for (const lod of [0, 1, 2]) this.bake(id, lod);
  }
}
