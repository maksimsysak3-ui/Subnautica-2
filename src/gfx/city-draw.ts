/**
 * The city's draw path: from a spawned city to a list of indirect draws.
 *
 * Everything here is decided once, at load, and never per frame. The frame
 * loop's whole job is to reset a counter buffer, dispatch one compute pass and
 * walk the list this file produced.
 *
 * The shape of it: a *bucket* is one prototype at one level of detail, so
 * there are three per prototype and the bucket a building lands in is
 * `prototype * 3 + lod`. Each bucket owns a fixed slice of one visibility
 * buffer, sized from the city's own census -- if the map holds four hundred and
 * twelve of a prototype, no bucket of it can ever be handed a four hundred and
 * thirteenth, so the slices can never overflow into each other and the culling
 * pass needs no bounds check.
 *
 * Bases are known to the CPU, which is what makes this work without the
 * indirect-first-instance feature: the draw hands the shader its slice as a
 * dynamic buffer offset rather than as a firstInstance the culler computed.
 * Dynamic offsets must be 256-byte aligned, so slices are rounded up to 64
 * entries -- about thirty kilobytes of slack across the whole library.
 */

import { Atlas, PROTO_FLOATS, protoTable } from './atlas';
import type { City } from '../sim';

/** u32s per DrawArgs, matching GPURenderPassEncoder.drawIndirect. */
export const ARGS_WORDS = 4;
/** Visibility-list entries per slice, rounded up for the dynamic offset. */
const SLICE_ALIGN = 64;

/** One prototype at one level of detail: the unit the renderer draws. */
export interface Bucket {
  /** Prototype index; also the row in the prototype table. */
  proto: number;
  lod: number;
  /** First entry of this bucket's slice of the visibility buffer. */
  base: number;
  /** Vertices in the mesh, for the stats overlay. */
  vertices: number;
  /** Byte offset of this bucket's DrawArgs. */
  argsOffset: number;
  /** Byte offset of this bucket's slice, for setBindGroup's dynamic offset. */
  sliceOffset: number;
}

export interface CityDraw {
  /** The packed vertex arena for every prototype the city placed. */
  vertices: Uint8Array<ArrayBuffer>;
  /** One row per prototype in the library, indexed by prototype. */
  protos: Float32Array<ArrayBuffer>;
  /** Slice base per bucket, for the culling pass. */
  bases: Uint32Array<ArrayBuffer>;
  /** DrawArgs for every bucket, with the counts zeroed. Uploaded each frame. */
  args: Uint32Array<ArrayBuffer>;
  /** Entries in the visibility buffer, slack included. */
  visibleEntries: number;
  /** Bytes one bind group covers, which caps the dynamic offset. */
  sliceBytes: number;
  /** The buckets with something to draw, in a stable order. */
  buckets: Bucket[];
  /** Triangles in the arena, per level of detail, for the overlay. */
  triangles: [number, number, number];
}

/**
 * Bakes every prototype the city actually placed and lays out the buffers.
 *
 * A prototype the spawner never chose is never generated -- which is most of
 * the point of procedural assets, and is why this takes the census rather than
 * the library.
 */
export function planCity(city: City, atlas: Atlas): CityDraw {
  const protoCount = atlas.prototypes.length;
  const bases = new Uint32Array(protoCount * 3);
  const args = new Uint32Array(protoCount * 3 * ARGS_WORDS);
  const buckets: Bucket[] = [];
  const triangles: [number, number, number] = [0, 0, 0];
  let cursor = 0;
  let sliceBytes = 0;

  for (let p = 0; p < protoCount; p++) {
    const pop = city.population[p] ?? 0;
    if (pop === 0) continue;
    const proto = atlas.prototypes[p];
    // Rounded up so every slice starts on a dynamic-offset boundary. The
    // whole slice is reserved for each level: any one of the three can hold
    // every copy in the world at once, because on a given frame it might.
    const slice = Math.ceil(pop / SLICE_ALIGN) * SLICE_ALIGN;
    sliceBytes = Math.max(sliceBytes, slice * 4);
    for (let lod = 0; lod < 3; lod++) {
      const span = atlas.bake(proto.id, lod);
      const bucket = p * 3 + lod;
      bases[bucket] = cursor;
      const o = bucket * ARGS_WORDS;
      args[o] = span.count;        // vertexCount, fixed for the life of the run
      args[o + 1] = 0;             // instanceCount, filled in by the culler
      args[o + 2] = span.first;    // firstVertex into the shared arena
      args[o + 3] = 0;             // firstInstance; the slice offset does this job
      triangles[lod] += span.count / 3;
      buckets.push({
        proto: p, lod, base: cursor, vertices: span.count,
        argsOffset: bucket * ARGS_WORDS * 4, sliceOffset: cursor * 4,
      });
      cursor += slice;
    }
  }

  return {
    vertices: atlas.bytes,
    protos: protoTable(atlas.prototypes),
    bases, args,
    // The last slice must fit a whole binding past its own offset, or the
    // final bucket's dynamic offset runs off the end of the buffer.
    visibleEntries: cursor + sliceBytes / 4,
    sliceBytes,
    buckets,
    triangles,
  };
}

export { PROTO_FLOATS };
