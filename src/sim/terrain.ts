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
import { gradingAt, baseAtCorner, CELL } from './grading';
import { valleyAt } from './river';
import { naturalHeightAt } from './land';

export const TERRAIN = {
  /** Metres across, centred on the origin. Set by configureSim. */
  get size(): number { return simConfig.terrainSize; },
  /** Metres per chunk. */
  /**
   * Metres across one chunk, and quads across it. Eight metres a vertex either
   * way -- one zoning cell, which is what lets the mesh read its heights
   * straight out of the grading's corner cache.
   *
   * Five hundred and twelve rather than two hundred and fifty-six. A chunk is
   * the unit of both culling and drawing, and those two want opposite things:
   * small chunks cull tightly, and small chunks mean four hundred draw calls to
   * put the ground on screen. Four hundred draws is most of a frame's encoding
   * budget spent on terrain, and terrain is the cheapest thing in the scene to
   * actually rasterise -- so the trade is the wrong way round at 256. At 512
   * there are a hundred chunks in view rather than four hundred, and the extra
   * ground drawn outside the frustum costs almost nothing.
   */
  chunk: 512,
  res: 64,
};
export const VERTS_PER_CHUNK_EDGE = TERRAIN.res + 1;       // 65
export const INDICES_PER_CHUNK = TERRAIN.res * TERRAIN.res * 6;

/**
 * Levels of detail for a chunk, as strides through its vertex grid.
 *
 * A chunk is sixty-four quads across whether it is under the camera or four
 * kilometres away, and at four kilometres that is eight thousand triangles for
 * a patch of ground a hundred pixels wide -- with a hundred and fifty chunks
 * in view, more than a million triangles of far distance every frame. Taking
 * every second or every fourth vertex of the same grid quarters and then
 * sixteenths that, and costs nothing but index buffer: the vertices are
 * already there and already uploaded, so a level of detail here is a different
 * range of the index buffer and nothing else.
 *
 * Two levels rather than four. The saving is a geometric series -- the first
 * step is three quarters of it -- and every extra level is another seam
 * between chunks that disagree about where the ground is.
 */
export const TERRAIN_STRIDES = [1, 2, 4] as const;

/** Where each level's indices start, and how many there are. */
export interface LodSpan { first: number; count: number; }
export const TERRAIN_LOD_SPANS: LodSpan[] = (() => {
  const out: LodSpan[] = [];
  let first = 0;
  for (const stride of TERRAIN_STRIDES) {
    const quads = TERRAIN.res / stride;
    const count = quads * quads * 6;
    out.push({ first, count });
    first += count;
  }
  return out;
})();
const TOTAL_INDICES = TERRAIN_LOD_SPANS.reduce((n, s) => n + s.count, 0);

/**
 * How far from the eye each level takes over, in metres.
 *
 * Set from what the seam costs rather than from what looks tidy on paper. Two
 * neighbouring chunks at different levels disagree about the ground by roughly
 * the curvature over one vertex spacing -- a few tens of centimetres on this
 * terrain. At nine hundred metres, thirty centimetres is a tenth of a pixel,
 * so the crack the seam would open is smaller than the pixel it would open in.
 */
export const TERRAIN_LOD_METRES = [900, 2000];
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

/**
 * The height at a terrain vertex, through the cached corner grid.
 *
 * Terrain vertices sit at eight metres, which is exactly the zoning cell
 * pitch, so every one of them is a corner the grading pass has already
 * sampled. Going through the cache turns three octaves of noise and a river
 * lookup into an array read -- and there are five of those per vertex once the
 * normal is counted, which is why generating the mesh was most of what an edit
 * cost.
 *
 * Falls through to the real function outside the cell grid, where the map is
 * wider than the city and there is nothing cached to read.
 */
function gridHeight(x: number, z: number): number {
  const half = simConfig.cityGrid / 2;
  const gx = Math.round(x / CELL + half);
  const gz = Math.round(z / CELL + half);
  return baseAtCorner(gx, gz, baseHeightAt) + gradingAt(x, z);
}

/**
 * The normal at a terrain vertex, from its neighbours on the same grid.
 *
 * A central difference over one cell rather than over two metres. That is not
 * a compromise for speed, it is more correct: the mesh is faceted at eight
 * metres, and a difference taken two metres either side samples the height
 * field inside a facet and returns a normal the facet does not have. Over the
 * facet's own span the two agree, and it costs four cache reads instead of
 * four evaluations of the noise.
 */
function gridNormal(x: number, z: number, out: [number, number, number]): void {
  const e = CELL;
  const dx = gridHeight(x + e, z) - gridHeight(x - e, z);
  const dz = gridHeight(x, z + e) - gridHeight(x, z - e);
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

/**
 * The mesh as it was last built, so a rebuild can keep the chunks that did not
 * move. Dropped whenever the map size changes, which reallocates it anyway.
 */
let cached: TerrainMesh | null = null;
/** How much of the mesh the last call rewrote, for the rebuild profile. */
export let terrainChunksRebuilt = 0;

/**
 * The terrain mesh.
 *
 * `only` is a world-space box: chunks that do not touch it keep the vertices
 * they already had, because the ground there is provably unchanged. It comes
 * from the grading, which knows exactly which corners moved.
 *
 * That matters because this is the single most expensive thing a rebuild does,
 * and nearly all of it is wasted: every vertex costs five evaluations of the
 * height field -- its own, and four more for the normal -- and drawing one
 * street moves the ground under one street. Regenerating the other thirty-five
 * chunks produced, at considerable expense, exactly the bytes already on the
 * GPU.
 */
export function buildTerrain(only?: { x0: number; z0: number; x1: number; z1: number } | null):
TerrainMesh {
  const chunksPerEdge = Math.max(1, Math.round(TERRAIN.size / TERRAIN.chunk));
  const vpe = VERTS_PER_CHUNK_EDGE;
  const vertsPerChunk = vpe * vpe;
  const chunkCount = chunksPerEdge * chunksPerEdge;
  const step = TERRAIN.chunk / TERRAIN.res;
  const half = TERRAIN.size / 2;

  const floats = chunkCount * vertsPerChunk * FLOATS_PER_VERTEX;
  const reuse = only !== undefined && only !== null
    && cached !== null && cached.vertices.length === floats;
  const vertices = reuse ? cached!.vertices : new Float32Array(floats);
  const chunks: Chunk[] = [];
  const n: [number, number, number] = [0, 0, 0];
  let v = 0;
  terrainChunksRebuilt = 0;

  for (let cz = 0; cz < chunksPerEdge; cz++) {
    for (let cx = 0; cx < chunksPerEdge; cx++) {
      const baseVertex = v / FLOATS_PER_VERTEX;
      const originX = cx * TERRAIN.chunk - half;
      const originZ = cz * TERRAIN.chunk - half;

      // Untouched: keep the vertices and the bounds exactly as they were.
      if (reuse && only !== undefined && only !== null
        && (originX + TERRAIN.chunk < only.x0 || originX > only.x1
          || originZ + TERRAIN.chunk < only.z0 || originZ > only.z1)) {
        const was = cached!.chunks[chunks.length];
        if (was !== undefined) {
          chunks.push(was);
          v += vertsPerChunk * FLOATS_PER_VERTEX;
          continue;
        }
      }
      terrainChunksRebuilt++;
      let lo = Infinity;
      let hi = -Infinity;

      for (let j = 0; j < vpe; j++) {
        for (let i = 0; i < vpe; i++) {
          // Chunks overlap by one vertex row, both evaluating heightAt at the
          // same world position, so edges match exactly and no cracks appear.
          const x = originX + i * step;
          const z = originZ + j * step;
          const y = gridHeight(x, z);
          gridNormal(x, z, n);

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

  // One index buffer, reused by every chunk via baseVertex, holding all three
  // levels of detail end to end over the same vertices.
  const indices = new Uint32Array(TOTAL_INDICES);
  let k = 0;
  for (const stride of TERRAIN_STRIDES) {
    for (let j = 0; j < TERRAIN.res; j += stride) {
      for (let i = 0; i < TERRAIN.res; i += stride) {
        const a = j * vpe + i;
        const b = a + stride;
        const c = a + vpe * stride;
        const d = c + stride;
        indices[k++] = a; indices[k++] = c; indices[k++] = b;
        indices[k++] = b; indices[k++] = c; indices[k++] = d;
      }
    }
  }

  const mesh = { vertices, indices, chunks };
  cached = mesh;
  return mesh;
}

/** Forgets the cached mesh, for a tool that changes the terrain itself. */
export function forgetTerrain(): void {
  cached = null;
}
