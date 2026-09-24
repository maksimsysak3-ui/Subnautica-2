/**
 * The starting maps: the same generator, set differently.
 *
 * Every map is the one landscape function in `land.ts` and the one river router
 * in `river.ts`, read through a profile. What changes is what a player notices
 * from overhead: how high the hills stand and how far apart, how much flat
 * ground the core gives them, which edge the river comes in from, how wide it
 * is -- or whether there is one at all -- and what lies under the ground.
 * That last is the one that shapes a game rather than a view: a map rich in
 * ore plays differently from a map of farmland (see `resources.ts`).
 *
 * Module state like the difficulty: `MAP` is the one in force, set before the
 * terrain is built, and a city carries its map's id in the save.
 */

import { clearTerrainCache } from './grading';
import { forgetTerrain } from './terrain';
import { forgetRiver } from './river';

export type MapId = 'vale' | 'highmoor' | 'lakeland' | 'broadwater' | 'ashfield' | 'saltmere' | 'kestrel';

/** How much of each natural resource a map has, as multipliers on the base fields. */
export interface Richness {
  fertile: number; forest: number; ore: number; oil: number; stone: number; fish: number;
}

/** A lake: a bowl in the land with its own water level. Centre and radius in metres. */
export interface Lake { x: number; z: number; r: number }

/**
 * Open sea along one side of the map, or all round it.
 *
 * `coast`: the land falls to the seabed past a line `at` metres from the centre,
 * in the direction `angle` (0 is east). `island`: past a radius of `at`.
 * Either way the shore is broken up by noise into bays and headlands.
 */
export interface Sea { kind: 'coast' | 'island'; angle: number; at: number }

/** The one sea level every map with a sea shares, in metres. */
export const SEA_LEVEL = -2.5;

export interface MapProfile {
  id: MapId;
  name: string;
  tagline: string;
  blurb: string;
  /** Offset on every noise salt, so the same shapes do not recur between maps. */
  seed: number;
  /** Multiplier on the height of the hills. */
  relief: number;
  /** Multiplier on their spacing: above one, broader and gentler country. */
  scale: number;
  /** Multiplier on the short, sharp ridges. */
  ridges: number;
  /** Fraction of the half-map, from the centre, that stays near-level. */
  flat: number;
  /** Radians the river's route is turned by (0 comes in from the west), and its width. */
  river: { angle: number; width: number } | null;
  sea: Sea | null;
  lakes: readonly Lake[];
  /** -1 lush to +1 arid: what the grass looks like. */
  climate: number;
  richness: Richness;
}

export const MAPS: readonly MapProfile[] = [
  {
    id: 'vale', name: 'Meridian Vale', tagline: 'Rolling country, one river',
    blurb: 'A broad valley with a river crossing from the west and hills on every side. '
      + 'A little of everything underground.',
    seed: 0, relief: 1, scale: 1, ridges: 1, flat: 0.05,
    river: { angle: 0, width: 1 }, sea: null, lakes: [],
    climate: 0,
    richness: { fertile: 1, forest: 1, ore: 0.8, oil: 0.6, stone: 1, fish: 0.4 },
  },
  {
    id: 'saltmere', name: 'Saltmere Coast', tagline: 'A river meets the sea',
    blurb: 'Open sea along the east, a ragged coast of bays and headlands, and a river '
      + 'running down to it. Fish offshore, fair farmland inland.',
    seed: 211, relief: 0.8, scale: 1.1, ridges: 0.9, flat: 0.06,
    river: { angle: 0, width: 1.1 },
    sea: { kind: 'coast', angle: 0, at: 1500 }, lakes: [],
    climate: -0.15,
    richness: { fertile: 1.1, forest: 0.8, ore: 0.5, oil: 0.9, stone: 0.7, fish: 1.8 },
  },
  {
    id: 'kestrel', name: 'Kestrel Isle', tagline: 'An island, sea on every side',
    blurb: 'A hilly island with nowhere to sprawl but up. Rich fishing all round it, '
      + 'stone in the hills, little flat farmland.',
    seed: 263, relief: 0.95, scale: 0.85, ridges: 1.2, flat: 0.08,
    river: null,
    sea: { kind: 'island', angle: 0, at: 2650 }, lakes: [],
    climate: -0.1,
    richness: { fertile: 0.6, forest: 0.9, ore: 0.6, oil: 0.4, stone: 1.4, fish: 2.0 },
  },
  {
    id: 'lakeland', name: 'Northreach Lakes', tagline: 'Forest, and lakes everywhere',
    blurb: 'Long wooded ridges around a chain of lakes, and a river coming in from the east. '
      + 'Timber everywhere, fish in every lake.',
    seed: 157, relief: 1.1, scale: 1.2, ridges: 1.1, flat: 0.06,
    river: { angle: Math.PI, width: 1.0 }, sea: null,
    lakes: [
      { x: -1500, z: -1200, r: 520 }, { x: 900, z: -1500, r: 380 },
      { x: -700, z: 1500, r: 640 }, { x: 1700, z: 900, r: 420 },
    ],
    climate: -0.7,
    richness: { fertile: 0.8, forest: 1.9, ore: 0.7, oil: 0.3, stone: 0.9, fish: 1.3 },
  },
  {
    id: 'highmoor', name: 'Highmoor', tagline: 'A plateau among mountains',
    blurb: 'A level plateau ringed by steep, high country, with two tarns and a narrow river '
      + 'falling from the north. Stone and ore in the hills, thin soil.',
    seed: 37, relief: 1.9, scale: 0.8, ridges: 1.7, flat: 0.14,
    river: { angle: Math.PI / 2, width: 0.7 }, sea: null,
    lakes: [{ x: 1300, z: 1200, r: 330 }, { x: -1600, z: 600, r: 280 }],
    climate: 0.25,
    richness: { fertile: 0.45, forest: 1.3, ore: 1.6, oil: 0.2, stone: 1.7, fish: 0.3 },
  },
  {
    id: 'broadwater', name: 'Broadwater Plains', tagline: 'Flat, fertile, a great river',
    blurb: 'Open plain for kilometres in every direction and a wide, slow river across it. '
      + 'The best farmland on any map, and some oil beneath it.',
    seed: 71, relief: 0.32, scale: 1.6, ridges: 0.35, flat: 0.05,
    river: { angle: -Math.PI / 5, width: 1.9 }, sea: null, lakes: [],
    climate: -0.35,
    richness: { fertile: 1.8, forest: 0.6, ore: 0.3, oil: 1.1, stone: 0.4, fish: 0.7 },
  },
  {
    id: 'ashfield', name: 'Ashfield Basin', tagline: 'Dry ground, rich underneath',
    blurb: 'A dry basin with no river and no lakes, broken ridges and little good soil -- '
      + 'but the richest oil and ore anywhere. Water has to be pumped from the ground.',
    seed: 113, relief: 0.9, scale: 0.9, ridges: 1.5, flat: 0.08,
    river: null, sea: null, lakes: [],
    climate: 0.9,
    richness: { fertile: 0.3, forest: 0.35, ore: 1.5, oil: 1.9, stone: 1.2, fish: 0 },
  },
];

export const mapById = (id: string): MapProfile => MAPS.find((m) => m.id === id) ?? MAPS[0];

/** The map in force. */
export const MAP: MapProfile = { ...MAPS[0] };

/**
 * Puts a map in force, and throws away everything built from the old ground.
 *
 * Cheap when the map is already the one in force, so a load or a new game can
 * call it unconditionally.
 */
export function useMap(id: string): MapProfile {
  const next = mapById(id);
  if (next.id === MAP.id) return MAP;
  Object.assign(MAP, next);
  forgetRiver();
  clearTerrainCache();
  forgetTerrain();
  return MAP;
}

/**
 * Runs `fn` with another map's ground in force, and puts the current one back.
 *
 * For reading a map without moving to it -- the previews on the setup screen.
 * Only the landscape and the river swap: the caches built against the ground
 * in use (the grading, the terrain mesh) are not touched, so nothing already
 * built changes, and the river is re-routed for whichever map is current the
 * next time it is asked.
 */
export function peekMap<T>(id: string, fn: () => T): T {
  if (id === MAP.id) return fn();
  const saved = { ...MAP };
  Object.assign(MAP, mapById(id));
  forgetRiver();
  try {
    return fn();
  } finally {
    Object.assign(MAP, saved);
    forgetRiver();
  }
}
