/**
 * The terrain heightfield, and the chunked mesh built from it.
 *
 * Chunked for three reasons, only one of which matters today:
 *   - frustum culling per chunk, which is what is wired up now
 *   - regenerating a chunk when the player raises or lowers ground, without
 *     rebuilding the whole map
 *   - LOD per chunk, later, when the map is bigger than the view
 *
 * All chunks share one vertex buffer and one index buffer. The topology of a
 * chunk is identical to every other chunk's, so the indices are written once
 * and each chunk is drawn with its own baseVertex. That is the layout that
 * makes multi-draw indirect possible later without reshuffling anything.
 */

import { simConfig } from './config';
import { gradingAt } from './grading';
import { valleyAt } from './river';
import { naturalHeightAt } from './land';

export const TERRAIN = {
  /** Metres across, centred on the origin. Set by configureSim. */
  get size(): number { return simConfig.terrainSize; },
  /** Metres per chunk. */
  chunk: 256,
  /** Quads per chunk edge. 8 m between vertices at 256/32 -- one zoning cell. */
  res: 32,
};
export const VERTS_PER_CHUNK_EDGE = TERRAIN.res + 1;       // 33
export const INDICES_PER_CHUNK = TERRAIN.res * TERRAIN.res * 6;
/** position(3) + normal(3) */
export const FLOATS_PER_VERTEX = 6;

/**
 * Height in metres at a world position, before anything is built on it.
 *
 * Flattened towards the origin so the city has buildable ground: the noise
 * amplitude ramps in with distance rather than being cut off, which avoids a
 * visible rim around the flat area.
 *
 * The spawner works against this while it is deciding where things go, and
 * the grading it produces is then folded into heightAt below. Everything
 * after placement -- the terrain mesh, the camera, anything asking what the
 * ground is doing -- wants heightAt, not this.
 */
export function baseHeightAt(x: number, z: number): number {
  const land = naturalHeightAt(x, z);

  // The river. Folded into the height rather than added to the map after it,
  // so everything that asks what the ground is doing -- the spawner's slope
  // test, the grading, the planting, the road tiler -- sees a valley without
  // any of them having to know what a river is.
  const valley = valleyAt(x, z);
  if (valley === null) return land;
  const y = land + (valley.y - land) * valley.w;
  // The ground beside a river cannot be below the river. Where the country the
  // valley crosses happens to fall away, blending straight back to it leaves
  // the water sitting on a ridge above a terrace -- so the floodplain is held
  // at the water line and released over the outermost part of the bank, which
  // is far enough away to read as the land taking over rather than as a step.
  // Not in the channel itself, obviously: the bed is meant to be under the
  // water, and clamping it too filled the river in with its own floor.
  if (valley.bed) return y;
  const hold = Math.min(1, valley.w / 0.28);
  return y + (Math.max(y, valley.water + 0.4) - y) * hold;
}

/**
 * Height in metres at a world position, as built.
 *
 * The ground plus whatever the city did to it. A lot is levelled and ramps out
 * to the terrain around it, so a building stands on flat ground instead of
 * being buried at one corner and on stilts at the other.
 */
export function heightAt(x: number, z: number): number {
  return baseHeightAt(x, z) + gradingAt(x, z);
}

/** Central difference normal. Matches heightAt exactly, so no seams. */
function normalAt(x: number, z: number, out: [number, number, number]): void {
  const e = 2;
  const dx = heightAt(x + e, z) - heightAt(x - e, z);
  const dz = heightAt(x, z + e) - heightAt(x, z - e);
  const len = Math.hypot(dx, 2 * e, dz) || 1;
  out[0] = -dx / len;
  out[1] = (2 * e) / len;
  out[2] = -dz / len;
}

export interface Chunk {
  baseVertex: number;
  /** World-space bounds, for frustum culling. */
  min: [number, number, number];
  max: [number, number, number];
}

export interface TerrainMesh {
  vertices: Float32Array<ArrayBuffer>;
  indices: Uint32Array<ArrayBuffer>;
  chunks: Chunk[];
}

export function buildTerrain(): TerrainMesh {
  const chunksPerEdge = Math.max(1, Math.round(TERRAIN.size / TERRAIN.chunk));
  const vpe = VERTS_PER_CHUNK_EDGE;
  const vertsPerChunk = vpe * vpe;
  const chunkCount = chunksPerEdge * chunksPerEdge;
  const step = TERRAIN.chunk / TERRAIN.res;
  const half = TERRAIN.size / 2;

  const vertices = new Float32Array(chunkCount * vertsPerChunk * FLOATS_PER_VERTEX);
  const chunks: Chunk[] = [];
  const n: [number, number, number] = [0, 0, 0];
  let v = 0;

  for (let cz = 0; cz < chunksPerEdge; cz++) {
    for (let cx = 0; cx < chunksPerEdge; cx++) {
      const baseVertex = v / FLOATS_PER_VERTEX;
      const originX = cx * TERRAIN.chunk - half;
      const originZ = cz * TERRAIN.chunk - half;
      let lo = Infinity;
      let hi = -Infinity;

      for (let j = 0; j < vpe; j++) {
        for (let i = 0; i < vpe; i++) {
          // Chunks overlap by one vertex row, both evaluating heightAt at the
          // same world position, so edges match exactly and no cracks appear.
          const x = originX + i * step;
          const z = originZ + j * step;
          const y = heightAt(x, z);
          normalAt(x, z, n);

          vertices[v++] = x;
          vertices[v++] = y;
          vertices[v++] = z;
          vertices[v++] = n[0];
          vertices[v++] = n[1];
          vertices[v++] = n[2];

          if (y < lo) lo = y;
          if (y > hi) hi = y;
        }
      }

      chunks.push({
        baseVertex,
        min: [originX, lo, originZ],
        max: [originX + TERRAIN.chunk, hi, originZ + TERRAIN.chunk],
      });
    }
  }

  // One index buffer, reused by every chunk via baseVertex.
  const indices = new Uint32Array(INDICES_PER_CHUNK);
  let k = 0;
  for (let j = 0; j < TERRAIN.res; j++) {
    for (let i = 0; i < TERRAIN.res; i++) {
      const a = j * vpe + i;
      const b = a + 1;
      const c = a + vpe;
      const d = c + 1;
      indices[k++] = a; indices[k++] = c; indices[k++] = b;
      indices[k++] = b; indices[k++] = c; indices[k++] = d;
    }
  }

  return { vertices, indices, chunks };
}
