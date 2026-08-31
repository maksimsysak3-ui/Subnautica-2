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

import { fbm } from './hash';

export const TERRAIN = {
  /** Metres across, centred on the origin. */
  size: 2048,
  /** Metres per chunk. */
  chunk: 128,
  /** Quads per chunk edge. 4 m between vertices at 128/32. */
  res: 32,
};

const CHUNKS_PER_EDGE = TERRAIN.size / TERRAIN.chunk;      // 16
export const VERTS_PER_CHUNK_EDGE = TERRAIN.res + 1;       // 33
export const INDICES_PER_CHUNK = TERRAIN.res * TERRAIN.res * 6;
/** position(3) + normal(3) */
export const FLOATS_PER_VERTEX = 6;

/**
 * Height in metres at a world position.
 *
 * Flattened towards the origin so the city has buildable ground: the noise
 * amplitude ramps in with distance rather than being cut off, which avoids a
 * visible rim around the flat area.
 */
export function heightAt(x: number, z: number): number {
  const s = 1 / 640;
  const hills = (fbm(x * s, z * s, 5, 101) - 0.5) * 2;      // [-1, 1]
  const ridges = (fbm(x * s * 3.7, z * s * 3.7, 3, 233) - 0.5) * 2;

  // Distance from the city centre, 0 at origin and 1 at the map edge.
  const d = Math.min(Math.hypot(x, z) / (TERRAIN.size * 0.5), 1);
  const relief = Math.pow(Math.max(0, (d - 0.05) / 0.95), 1.05);

  return (hills * 98 + ridges * 24) * relief;
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
  const vpe = VERTS_PER_CHUNK_EDGE;
  const vertsPerChunk = vpe * vpe;
  const chunkCount = CHUNKS_PER_EDGE * CHUNKS_PER_EDGE;
  const step = TERRAIN.chunk / TERRAIN.res;
  const half = TERRAIN.size / 2;

  const vertices = new Float32Array(chunkCount * vertsPerChunk * FLOATS_PER_VERTEX);
  const chunks: Chunk[] = [];
  const n: [number, number, number] = [0, 0, 0];
  let v = 0;

  for (let cz = 0; cz < CHUNKS_PER_EDGE; cz++) {
    for (let cx = 0; cx < CHUNKS_PER_EDGE; cx++) {
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
