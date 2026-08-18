/**
 * World data model.
 *
 * Everything in a BLACK MERIDIAN site is built from *bricks*: yaw-oriented
 * boxes (plus a wedge and a cylinder variant) tagged with a surface, a material
 * and gameplay flags. One representation drives four consumers:
 *
 *   render   → instanced meshes, grouped by (site, material, shape)
 *   collide  → exact ray/OBB tests behind a BVH broadphase
 *   navigate → solid-span rasterisation into the walkable heightfield
 *   cover    → face analysis for the cover graph
 *
 * Keeping them on one primitive is the whole trick: geometry, collision and
 * navigation can never disagree, because they are literally the same data.
 */

import type { SurfaceKind } from '../core/contracts';

// ---------------------------------------------------------------------------
// Bricks
// ---------------------------------------------------------------------------

export const SHAPE_BOX = 0;
/** Right-triangular prism: full at -z, zero at +z. Used for roofs and ramps. */
export const SHAPE_WEDGE = 1;
/** 8-gon prism along Y. Used for poles, tanks, pipes and columns. */
export const SHAPE_CYL = 2;

export type BrickShape = 0 | 1 | 2;

/** Bit flags on a brick. */
export const enum BF {
  /** Does not block line of sight (glass, foliage, chain-link). */
  SOFT = 1 << 0,
  /** Nav treats it as an obstacle but its top is never a floor. */
  NO_WALK = 1 << 1,
  /** Ignored entirely by the navmesh rasteriser (door leaves, trim). */
  NO_NAV = 1 << 2,
  /** Inside a building volume — drives reverb and rain occlusion. */
  INDOORS = 1 << 3,
  /** Excluded from cover analysis (floors, ceilings, decorative trim). */
  NO_COVER = 1 << 4,
  /** Ladder or climbable face; navigation links vertically here. */
  CLIMB = 1 << 5,
  /** Rendered with the transparent material queue. */
  TRANSPARENT = 1 << 6,
  /** A window opening — vaultable, shootable, and a peek position. */
  WINDOW = 1 << 7,
  /** Does not cast shadows (thin trim, glass) — keeps the shadow pass cheap. */
  NO_SHADOW = 1 << 8,
  /** Belongs to a door leaf; transform is dynamic. */
  DOOR = 1 << 9,
}

/**
 * A single world box. Stored in parallel typed arrays inside `Brickyard`;
 * this interface is the authoring-side view.
 */
export interface BrickDef {
  x: number; y: number; z: number;
  /** Half extents in the brick's own frame. */
  hx: number; hy: number; hz: number;
  /** Rotation about +Y, radians. */
  yaw?: number;
  shape?: BrickShape;
  surface: SurfaceKind;
  /** Index into the material table (see palette.ts). */
  mat: number;
  /** Multiplicative per-instance tint, 0xRRGGBB. Defaults to white. */
  tint?: number;
  flags?: number;
  /** Owning building, -1 for terrain-level structures. */
  building?: number;
  /** Owning room, -1 when the brick is not inside one. */
  room?: number;
  /** Owning door, -1 for static geometry. */
  door?: number;
}

// ---------------------------------------------------------------------------
// Doors
// ---------------------------------------------------------------------------

export type DoorState = 'closed' | 'open' | 'locked';
export type DoorMaterial = 'wood' | 'reinforced' | 'metal' | 'glass' | 'gate';

export interface WorldDoor {
  id: number;
  /** Human label used by the UI and AI barks: "Kitchen door". */
  name: string;
  buildingId: number;
  /** Rooms this door connects. -1 means the exterior. */
  roomA: number;
  roomB: number;
  /** Centre of the doorway at floor level. */
  x: number; y: number; z: number;
  /** Facing of the doorway plane normal, radians about +Y. */
  yaw: number;
  width: number;
  height: number;
  /** Which end the hinge is on: -1 = left of the facing, +1 = right. */
  hinge: -1 | 1;
  /** Which way the leaf swings: -1 = toward -normal, +1 = toward +normal. */
  swing: -1 | 1;
  state: DoorState;
  /** Locked doors need a breach, a pick or a key. */
  locked: boolean;
  breachable: boolean;
  material: DoorMaterial;
  /** 0..1 structural integrity; breaching drops this to 0. */
  integrity: number;
  /** 0 closed .. 1 fully open. Animated. */
  openAmount: number;
  /** Animation target for openAmount. */
  targetOpen: number;
  /** Radians per second while animating; kicked doors are much faster. */
  speed: number;
  /** True once the leaf has been destroyed — the doorway is permanently open. */
  destroyed: boolean;
  /** Brick indices making up the leaf, for the dynamic transform update. */
  brickIds: number[];
  /** Instance slot in the door InstancedMesh, -1 if none. */
  instance: number;
}

// ---------------------------------------------------------------------------
// Sites
// ---------------------------------------------------------------------------

export type SiteArchetype =
  | 'villa'
  | 'favela'
  | 'port'
  | 'outpost'
  | 'research'
  | 'hydro';

export interface ApproachRoute {
  id: string;
  name: string;
  /** front | flank | roof | drainage | water | air */
  kind: 'front' | 'flank' | 'roof' | 'drainage' | 'water' | 'air';
  /** Where an operator inserts for this approach. */
  x: number; y: number; z: number;
  /** First contact point once the approach commits — used by the planning map. */
  toX: number; toZ: number;
  description: string;
  /** 0..1 trade-off hints for the mission planner. */
  stealth: number;
  speed: number;
  risk: number;
}

export interface Landmark {
  name: string;
  x: number; y: number; z: number;
  /** Rough visible radius in metres — the UI uses this for the compass. */
  prominence: number;
}

export interface SiteInstance {
  id: string;
  name: string;
  archetype: SiteArchetype;
  /** Site origin in world space. */
  x: number;
  z: number;
  /** Ground height of the site pad. */
  padY: number;
  /** Playable bounds of the site, world space. */
  minX: number; maxX: number;
  minZ: number; maxZ: number;
  /** Tight bounds of the built-up core — the navmesh only covers this. */
  coreMinX: number; coreMaxX: number;
  coreMinZ: number; coreMaxZ: number;
  /** Vertical extent the navmesh must span. */
  minY: number; maxY: number;
  roomIds: number[];
  doorIds: number[];
  approaches: ApproachRoute[];
  landmarks: Landmark[];
  /** Suggested defender patrol anchors — the AI director seeds from these. */
  garrison: Array<{ x: number; y: number; z: number; role: string }>;
  buildingCount: number;
}

// ---------------------------------------------------------------------------
// Authoring helpers
// ---------------------------------------------------------------------------

/** An opening punched through a wall run. Offsets are along the wall. */
export interface WallOpening {
  /** Distance from the wall's start point to the opening's centre. */
  at: number;
  width: number;
  /** Bottom of the opening above the wall base. */
  y0: number;
  /** Top of the opening above the wall base. */
  y1: number;
  kind: 'door' | 'window' | 'arch' | 'hole';
  /** Populated for doors so the door registry can be built afterwards. */
  doorSpec?: DoorSpec;
  /** Populated for windows: glazing + sill. */
  glazed?: boolean;
}

export interface DoorSpec {
  name: string;
  roomA: number;
  roomB: number;
  material: DoorMaterial;
  locked?: boolean;
  breachable?: boolean;
  hinge?: -1 | 1;
  swing?: -1 | 1;
  /** Start the door already open — used for arches and blown-out frames. */
  open?: boolean;
}

export interface RoomSpec {
  name: string;
  minX: number; maxX: number;
  minZ: number; maxZ: number;
  minY: number; maxY: number;
  indoors: boolean;
  buildingId: number;
  /** Free-form tag used by mission generation: 'stairwell', 'lab', 'garage'. */
  tag: string;
}
