/**
 * What an asset is, before any of it reaches the GPU.
 *
 * An asset here is a *generator*, not a file. The mesh is produced from
 * parameters at load time, which is why levels of detail are cheap: LOD1 is
 * the same generator with the detail flags off, not a decimated copy of LOD0.
 * That is a genuine advantage of procedural assets over authored ones -- a
 * decimator has to guess which edges matter, whereas the generator knows.
 *
 * The gameplay half of the descriptor (footprint, households, jobs, upkeep)
 * matches planning/CITY-SIM-DESIGN.md section 4.2, so these definitions become
 * the real asset.json when packs land.
 */

import type { MeshBuilder } from './mesh';

export type Zone = 'residential' | 'commercial' | 'industrial';
export type Density = 'low' | 'medium' | 'high' | 'none';

/**
 * The two approaches being compared. Same category, same footprint, so the
 * question "is the extra geometry worth it" has an answer you can look at.
 */
export type Variant =
  /** Simple massing; detail comes from the facade shader. Hundreds of triangles. */
  | 'shaded'
  /** Detail modelled as geometry: balconies, frames, plant, setbacks. Thousands. */
  | 'sculpted';

export interface SimCosts {
  households?: number;
  jobs?: number;
  powerKW: number;
  waterM3: number;
  garbagePerWeek: number;
  pollution: number;
  upkeep: number;
}

export interface AssetDef {
  id: string;
  name: string;
  zone: Zone;
  density: Density;
  variant: Variant;
  /** Lot size in 8 m zoning cells. */
  footprint: [number, number];
  /** Approximate height in metres, for the spawner and for sorting. */
  height: number;
  sim: SimCosts;
  /** One line on what this asset is demonstrating. */
  note: string;
  /**
   * Builds the mesh. lod 0 is full detail, 1 drops small geometry, 2 is bare
   * massing. Everything past 2 is an impostor and needs no mesh at all.
   */
  build(lod: number): MeshBuilder;
}

/** Metres per zoning cell. Matches sim/city.ts. */
export const CELL = 8;
