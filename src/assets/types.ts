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
import type { Theme } from './themes';

export type Zone =
  | 'residential' | 'commercial' | 'industrial' | 'office' | 'service'
  | 'fleet' | 'road';
export type Density = 'low' | 'medium' | 'high' | 'none';

/**
 * The service branches a city has to provide for itself.
 *
 * These are not zoned -- the player places them one at a time and pays for
 * them -- so they behave differently from the four zones in every way that
 * matters: no density ladder, no brand, a coverage radius instead of a
 * demand curve, and a silhouette that has to be recognisable at a glance
 * because the player is looking for "the fire station" specifically.
 */
export type Branch =
  | 'fire' | 'police' | 'health' | 'education' | 'water'
  | 'power' | 'transport' | 'government' | 'parks';

export const BRANCHES: Branch[] = [
  'fire', 'police', 'health', 'education', 'water',
  'power', 'transport', 'government', 'parks',
];

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

/**
 * A fictional business identity.
 *
 * Fictional on purpose: real chains' names, colours and marks are trademarks,
 * and a city builder wants a recognisable *kind* of place rather than a
 * specific one. Each brand is a colour pair plus a sign style, which is enough
 * for a shopfront generator to make a burger bar and a pharmacy look like
 * different businesses without a second generator.
 */
export interface Brand {
  name: string;
  /** Primary colour: fascia, awning, pylon. */
  colour: [number, number, number];
  /** Secondary: stripes, doors, sign returns. */
  accent: [number, number, number];
  sign: 'fascia' | 'blade' | 'pylon' | 'box' | 'none';
}

export const DEFAULT_BRAND: Brand = {
  name: '', colour: [0.42, 0.44, 0.47], accent: [0.30, 0.32, 0.35], sign: 'none',
};

/**
 * Colour seed for an asset, from its id.
 *
 * The materials pick their colours from this, so it decides whether a
 * prototype is red brick or yellow stock, slate or pantile. It was
 * `id.length * 7.3 + charCodeAt(0)` -- which collides constantly, because most
 * ids in a category share a prefix and a length, and the result was a whole
 * roster in the same beige. A real string hash spreads them.
 *
 * At runtime the game adds the instance's own seed on top, so two of the same
 * prototype on one street still differ; this only sets the prototype's
 * character.
 */
export function idSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 8) % 100000) / 97.0;
}

export interface AssetDef {
  id: string;
  /** Regional theme, for the four zoned categories. See assets/themes.ts. */
  theme?: Theme;
  /** Service branch, for zone 'service' only. */
  branch?: Branch;
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
  /** Business identity, for anything with a shopfront. */
  brand?: Brand;
  /**
   * Builds the mesh. lod 0 is full detail, 1 drops small geometry, 2 is bare
   * massing. Everything past 2 is an impostor and needs no mesh at all.
   */
  build(lod: number): MeshBuilder;
}

/** Metres per zoning cell. Matches sim/city.ts. */
export const CELL = 8;
