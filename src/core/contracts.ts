/**
 * Cross-team interface contracts.
 *
 * THIS FILE IS THE INTEGRATION BOUNDARY. Teams implement these interfaces in
 * their own directory and register the implementation with `services`.
 * Consumers resolve by key and never import another team's concrete module.
 *
 * If you need to change a signature here, it affects other teams — widen
 * (add optional fields) rather than break.
 */

import type { Object3D, Vector3, Camera, Scene, WebGLRenderer } from 'three';
import type { Faction, HitRegion, Alertness, StanceId, DamageType } from './events';

// ===========================================================================
// World / physics queries
// ===========================================================================

export type SurfaceKind =
  | 'concrete' | 'metal' | 'wood' | 'drywall' | 'glass' | 'dirt' | 'sand'
  | 'gravel' | 'grass' | 'water' | 'foliage' | 'flesh' | 'ceramic' | 'rubber'
  | 'plastic' | 'fabric' | 'tile' | 'snow' | 'mud';

export interface SurfaceProperties {
  kind: SurfaceKind;
  /** kg/m³ — used with thickness for penetration energy loss. */
  density: number;
  /** 0..1 how much of the bullet's energy is absorbed per cm of travel. */
  absorption: number;
  /** 0..1 chance modifier for ricochet at shallow angles. */
  ricochetBias: number;
  /** Footstep loudness multiplier, 1 = neutral concrete. */
  footstepLoudness: number;
  /** Whether bullets can pass through at all. */
  penetrable: boolean;
  /** Approximate thickness in metres for penetration math. */
  thickness: number;
}

export interface RayHit {
  point: Vector3;
  normal: Vector3;
  distance: number;
  surface: SurfaceKind;
  /** Actor id if the ray hit a character, otherwise -1. */
  actorId: number;
  region?: HitRegion;
  object: Object3D | null;
  /** True if the hit object blocks line of sight (not foliage/glass). */
  opaque: boolean;
}

export interface RaycastOptions {
  maxDistance?: number;
  /** Ignore these actor ids — normally the shooter. */
  ignoreActors?: readonly number[];
  /** Only test level geometry, skip characters. */
  staticOnly?: boolean;
  /** Include foliage and other non-blocking surfaces. */
  includeSoft?: boolean;
}

/** Capsule used by character movement. */
export interface CharacterShape {
  radius: number;
  height: number;
  /** Maximum obstacle height climbed without jumping. */
  stepHeight: number;
  /** Steepest walkable slope as a minimum normal.y. */
  minGroundNormalY: number;
}

export interface CharacterMove {
  x: number; y: number; z: number;
  grounded: boolean;
  hitWall: boolean;
  stepped: boolean;
  groundY: number;
}

export interface IWorldQuery {
  raycast(origin: Vector3, direction: Vector3, opts?: RaycastOptions): RayHit | null;
  /** All hits along the ray, sorted near→far. Needed for wall penetration. */
  raycastAll(origin: Vector3, direction: Vector3, opts?: RaycastOptions): RayHit[];
  /** Cheap boolean visibility test. */
  lineOfSight(from: Vector3, to: Vector3, ignoreActors?: readonly number[]): boolean;
  /** Ground height at an XZ position, or null if outside the world. */
  groundHeight(x: number, z: number): number | null;
  surfaceAt(point: Vector3): SurfaceKind;
  surfaceProps(kind: SurfaceKind): SurfaceProperties;
  /** Sphere overlap against level geometry — used by grenades and the drone. */
  overlapSphere(center: Vector3, radius: number): Object3D[];
  /** True when the point is inside a building interior (drives reverb + rain). */
  isIndoors(point: Vector3): boolean;
  /**
   * Move a character capsule, resolving against level geometry and terrain.
   * This is the only correct way to move an actor — `overlapSphere` does not
   * see instanced level geometry, so anything built on it walks through walls.
   * `y` is at the FEET, not the eye.
   */
  moveCharacter(
    x: number, y: number, z: number,
    dx: number, dy: number, dz: number,
    shape: CharacterShape,
  ): CharacterMove;
  /** Floor height under a point: terrain, or a surface standing above it. */
  floorAt(x: number, z: number, fromY: number, searchDown?: number, searchUp?: number): number;
  /** World bounds in metres. */
  readonly extent: { minX: number; maxX: number; minZ: number; maxZ: number };
}

// ===========================================================================
// Navigation
// ===========================================================================

export interface NavPath {
  points: Vector3[];
  valid: boolean;
  cost: number;
}

export interface CoverPoint {
  position: Vector3;
  /** Direction the cover protects FROM. */
  facing: Vector3;
  /** 0 = low (crouch behind), 1 = full standing cover. */
  height: number;
  /** True if the operator can lean out and shoot without leaving cover. */
  peekable: boolean;
  /** Which side to lean: -1 left, 1 right, 0 over the top. */
  peekSide: number;
  /** Set by AI to avoid two actors claiming one spot. */
  claimedBy: number;
}

export interface INavigation {
  findPath(from: Vector3, to: Vector3, agentRadius?: number): NavPath;
  /** Nearest point on the navmesh, for snapping spawns and destinations. */
  nearestNavPoint(p: Vector3, maxRadius?: number): Vector3 | null;
  isOnNavMesh(p: Vector3): boolean;
  /** Cover points near a position, best-first for the given threat direction. */
  findCover(near: Vector3, threatFrom: Vector3, radius?: number): CoverPoint[];
  /** Random reachable point within radius — used by patrol and search. */
  randomPointNear(p: Vector3, radius: number): Vector3 | null;
  /** Rooms are the unit of tactical reasoning for clearing behaviour. */
  roomAt(p: Vector3): RoomInfo | null;
  readonly rooms: readonly RoomInfo[];
}

export interface RoomInfo {
  id: number;
  name: string;
  center: Vector3;
  /** Axis-aligned bounds. */
  min: Vector3;
  max: Vector3;
  /** Door ids connecting out of this room. */
  doorIds: number[];
  /** Adjacent room ids. */
  neighbors: number[];
  indoors: boolean;
  /** Building id this room belongs to, -1 for exterior zones. */
  buildingId: number;
}

// ===========================================================================
// Actors (player and AI share this surface so systems treat them uniformly)
// ===========================================================================

export interface ActorState {
  id: number;
  faction: Faction;
  archetype: string;
  alive: boolean;
  downed: boolean;
  surrendered: boolean;
  health: number;
  maxHealth: number;
  stance: StanceId;
  alertness: Alertness;
  /** Eye position — the origin for perception and shooting. */
  eye: Vector3;
  position: Vector3;
  /** Forward vector of the body. */
  forward: Vector3;
  /** Where the actor is currently looking. */
  aimDirection: Vector3;
  velocity: Vector3;
  /** 0..1 how suppressed — affects accuracy and willingness to peek. */
  suppression: number;
  /** 0..1 morale; low morale leads to surrender or flight. */
  morale: number;
  weaponId: string | null;
  /** Set by the drone or by spotting; makes the actor show on the HUD. */
  tagged: boolean;
}

export interface IActorRegistry {
  get(id: number): ActorState | undefined;
  readonly all: readonly ActorState[];
  /** Living actors of a faction. */
  byFaction(f: Faction): ActorState[];
  /** Living enemies of the given faction, sorted by distance. */
  hostilesNear(position: Vector3, faction: Faction, radius: number): ActorState[];
  readonly playerId: number;
  applyDamage(
    actorId: number,
    amount: number,
    type: DamageType,
    region: HitRegion,
    sourceId: number,
    direction?: Vector3,
  ): void;
}

// ===========================================================================
// Weapons
// ===========================================================================

export type FireMode = 'safe' | 'semi' | 'burst2' | 'burst3' | 'auto';
export type WeaponClass =
  | 'pistol' | 'smg' | 'carbine' | 'rifle' | 'dmr' | 'sniper'
  | 'shotgun' | 'lmg' | 'launcher' | 'melee';
export type AttachmentSlot =
  | 'optic' | 'muzzle' | 'underbarrel' | 'magazine' | 'stock'
  | 'handguard' | 'grip' | 'laser' | 'ammo' | 'charging' | 'trigger' | 'receiver';

export interface AmmoSpec {
  id: string;
  name: string;
  caliber: string;
  /** grams */
  massG: number;
  /** m/s at the muzzle from a reference barrel length. */
  muzzleVelocity: number;
  /** Ballistic coefficient (G7). */
  bc: number;
  /** Armour penetration class 1..6, matched against armour class. */
  penetration: number;
  /** Base flesh damage before region multipliers. */
  damage: number;
  /** 0..1 how much the round fragments — raises damage, lowers penetration. */
  fragmentation: number;
  /** Multiplier on the tracer visibility. 0 = no tracer. */
  tracer: number;
  /** Extra muzzle flash and report. */
  flashMultiplier: number;
  /** Recoil impulse multiplier vs the caliber baseline. */
  recoilMultiplier: number;
  /** Chance per shot of a malfunction, before weapon durability. */
  malfunctionChance: number;
  price: number;
}

export interface AttachmentSpec {
  id: string;
  name: string;
  slot: AttachmentSlot;
  /** Slots this attachment itself provides (e.g. a handguard adds rails). */
  provides?: AttachmentSlot[];
  /** Only fits weapons listing this compatibility tag. */
  fitsTags: string[];
  massKg: number;
  /** Additive/multiplicative stat deltas — see WeaponStats for meanings. */
  mods: Partial<WeaponStatMods>;
  /** Optic-specific. */
  optic?: {
    magnification: number;
    reticle: string;
    /** Eye relief affects how fast you can get on target. */
    adsSpeedMod: number;
    /** True for holographic/red dot — allows both-eyes-open. */
    unmagnified: boolean;
    nightVisionCompatible: boolean;
    /** Screen-space zoom vs true scope render. */
    scopeRender: boolean;
  };
  price: number;
  unlockLevel: number;
  description: string;
}

/** All values are multipliers unless the name says otherwise. */
export interface WeaponStatMods {
  verticalRecoil: number;
  horizontalRecoil: number;
  recoilRecovery: number;
  ergonomics: number;      // additive points, higher = faster handling
  adsTimeMs: number;       // additive milliseconds
  muzzleVelocity: number;
  soundMeters: number;     // additive metres of audible radius
  flash: number;
  swayAmplitude: number;
  swayFrequency: number;
  spreadMoa: number;
  reloadTimeMs: number;    // additive
  magazineSize: number;    // additive rounds
  durabilityBurn: number;
  weightKg: number;        // additive
}

export interface WeaponSpec {
  id: string;
  name: string;
  /** Manufacturer / in-fiction designation. */
  make: string;
  class: WeaponClass;
  caliber: string;
  tags: string[];
  fireModes: FireMode[];
  /** rounds per minute */
  rpm: number;
  /** Cyclic variance — real guns aren't metronomes. */
  rpmJitter: number;
  baseMagazine: number;
  massKg: number;
  barrelLengthMm: number;
  /** Base mechanical accuracy in MOA. */
  spreadMoa: number;
  ergonomics: number;
  adsTimeMs: number;
  /** Recoil pattern in degrees per shot. */
  verticalRecoil: number;
  horizontalRecoil: number;
  recoilRecovery: number;
  /** Audible radius in metres, unsuppressed. */
  soundMeters: number;
  reloadTimeMs: number;
  reloadEmptyTimeMs: number;
  /** Which attachment slots exist on the base weapon. */
  slots: AttachmentSlot[];
  /** Default attachment ids per slot. */
  defaults: Partial<Record<AttachmentSlot, string>>;
  /** Compatible ammo ids. */
  ammo: string[];
  unlockLevel: number;
  price: number;
  description: string;
}

/** Fully resolved weapon after attachments and ammo are applied. */
export interface ResolvedWeaponStats {
  spreadMoa: number;
  verticalRecoil: number;
  horizontalRecoil: number;
  recoilRecovery: number;
  ergonomics: number;
  adsTimeMs: number;
  muzzleVelocity: number;
  soundMeters: number;
  flash: number;
  swayAmplitude: number;
  swayFrequency: number;
  magazineSize: number;
  reloadTimeMs: number;
  reloadEmptyTimeMs: number;
  massKg: number;
  rpm: number;
  suppressed: boolean;
  magnification: number;
}

export interface WeaponInstance {
  uid: string;
  specId: string;
  attachments: Partial<Record<AttachmentSlot, string>>;
  ammoId: string;
  /** Rounds in the magazine right now. */
  loaded: number;
  /** True when a round is in the chamber (matters for +1 reloads). */
  chambered: boolean;
  /** 0..1, degrades with rounds fired, raises malfunction chance. */
  durability: number;
  /** 0..1 how hot the barrel is; affects mirage and malfunction. */
  heat: number;
  malfunction: string | null;
  stats: ResolvedWeaponStats;
}

export interface IWeaponSystem {
  readonly specs: ReadonlyMap<string, WeaponSpec>;
  readonly attachments: ReadonlyMap<string, AttachmentSpec>;
  readonly ammo: ReadonlyMap<string, AmmoSpec>;
  createInstance(specId: string, attachments?: Partial<Record<AttachmentSlot, string>>, ammoId?: string): WeaponInstance;
  resolveStats(inst: WeaponInstance): ResolvedWeaponStats;
  /** Validate an attachment fits — used by the gunsmith UI. */
  canAttach(inst: WeaponInstance, attachmentId: string): boolean;
  attach(inst: WeaponInstance, attachmentId: string): boolean;
  detach(inst: WeaponInstance, slot: AttachmentSlot): void;
  /** Available slots including ones added by attachments. */
  availableSlots(inst: WeaponInstance): AttachmentSlot[];
}

// ===========================================================================
// Audio
// ===========================================================================

export interface IAudio {
  /** Fire-and-forget positional sound. */
  play(id: string, opts?: { position?: Vector3; volume?: number; pitch?: number; radiusM?: number }): void;
  /** Looping source the caller controls. Returns a stop handle. */
  loop(id: string, opts?: { position?: Vector3; volume?: number; pitch?: number }): { stop(): void; setVolume(v: number): void; setPosition(p: Vector3): void };
  setListener(position: Vector3, forward: Vector3, up: Vector3, velocity?: Vector3): void;
  /** Environmental reverb preset — driven by the world's indoor/room data. */
  setReverb(preset: string, wet: number): void;
  /** Duck everything (flashbang, death). */
  setDeafen(amount: number, durationMs: number): void;
  setMusicIntensity(v: number): void;
  readonly ready: boolean;
  resume(): Promise<void>;
}

// ===========================================================================
// Rendering
// ===========================================================================

export interface IRenderContext {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  /** Main world camera. */
  readonly camera: Camera;
  /** Separate camera+scene for the first-person weapon, drawn without world FOV distortion. */
  readonly viewScene: Scene;
  readonly viewCamera: Camera;
  /** Register a fullscreen post-process pass. */
  addPass(pass: PostPass): void;
  removePass(id: string): void;
  /** Quality tier 0 (low) .. 3 (ultra). */
  quality: number;
  readonly width: number;
  readonly height: number;
}

export interface PostPass {
  id: string;
  order: number;
  enabled: boolean;
  render(ctx: IRenderContext, dt: number): void;
  resize?(w: number, h: number): void;
  dispose?(): void;
}

// ===========================================================================
// Environment: time of day + weather
// ===========================================================================

export type WeatherKind =
  | 'clear' | 'overcast' | 'fog' | 'lightRain' | 'heavyRain'
  | 'thunderstorm' | 'sandstorm' | 'snow' | 'smoke';

export interface WeatherState {
  kind: WeatherKind;
  /** 0..1 transition progress toward `kind`. */
  blend: number;
  cloudCover: number;
  precipitation: number;
  fogDensity: number;
  windDirection: number;  // radians
  windSpeed: number;      // m/s
  temperature: number;    // celsius
  /** 0..1 how much the weather muffles sound. */
  soundOcclusion: number;
  /** Multiplier on AI visual detection range. */
  visibilityFactor: number;
  lightningActive: boolean;
}

export interface TimeOfDayState {
  /** 0..24 */
  hour: number;
  /** Seconds of game time per real second. */
  timeScale: number;
  sunElevation: number;   // radians, negative = below horizon
  sunAzimuth: number;
  moonPhase: number;      // 0..1
  /** 0 = pitch dark, 1 = full daylight. Used by AI vision. */
  ambientLightLevel: number;
  isNight: boolean;
}

export interface IEnvironment {
  readonly weather: WeatherState;
  readonly time: TimeOfDayState;
  setWeather(kind: WeatherKind, transitionSeconds?: number): void;
  setHour(hour: number): void;
  setTimeScale(scale: number): void;
  /** Light level at a world point, accounting for indoor shadowing and lamps. */
  lightLevelAt(p: Vector3): number;
}

// ===========================================================================
// Missions
// ===========================================================================

export type ObjectiveKind =
  | 'eliminate' | 'eliminateHVT' | 'rescue' | 'extract' | 'secureIntel'
  | 'destroy' | 'sabotage' | 'defuse' | 'arrest' | 'survive'
  | 'recon' | 'escort' | 'tag' | 'plant' | 'clear';

export interface Objective {
  id: string;
  kind: ObjectiveKind;
  label: string;
  description: string;
  optional: boolean;
  hidden: boolean;
  state: 'pending' | 'active' | 'complete' | 'failed';
  progress: number;
  required: number;
  position?: Vector3;
  /** Objectives that must complete before this one activates. */
  dependsOn: string[];
}

export interface MissionDefinition {
  id: string;
  seed: number;
  name: string;
  codename: string;
  region: string;
  siteId: string;
  faction: Faction;
  /** 1..10 */
  difficulty: number;
  objectives: Objective[];
  weather: WeatherKind;
  hour: number;
  /** Approaches the planner offers before insertion. */
  approaches: MissionApproach[];
  briefing: string;
  intel: string[];
  enemyCount: number;
  civilianCount: number;
  rewards: { xp: number; cash: number; reputation: Partial<Record<Faction, number>> };
  modifiers: string[];
}

export interface MissionApproach {
  id: string;
  name: string;
  description: string;
  insertPoint: Vector3;
  /** Tactical trade-offs shown in the planning UI. */
  traits: { stealth: number; speed: number; risk: number };
}

export interface IMissionSystem {
  readonly current: MissionDefinition | null;
  readonly objectives: readonly Objective[];
  generate(seed: number, opts?: { difficulty?: number; region?: string; kind?: ObjectiveKind }): MissionDefinition;
  start(def: MissionDefinition, approachId: string): Promise<void>;
  abort(reason: string): void;
  reportProgress(objectiveId: string, delta: number): void;
  readonly stats: Record<string, number>;
}

// ===========================================================================
// Progression
// ===========================================================================

export interface SkillNode {
  id: string;
  name: string;
  branch: string;
  description: string;
  maxLevel: number;
  level: number;
  cost: number[];
  requires: string[];
  /** Applied by the systems that care; keys are documented per skill. */
  effects: Record<string, number>;
}

export interface IProgression {
  readonly level: number;
  readonly xp: number;
  readonly xpToNext: number;
  readonly cash: number;
  readonly skills: readonly SkillNode[];
  readonly skillPoints: number;
  /** Aggregate effect value across all levelled skills, 0 if none. */
  effect(key: string): number;
  hasUnlocked(itemId: string): boolean;
  reputation(f: Faction): number;
  awardXp(amount: number, reason: string): void;
  spendSkillPoint(skillId: string): boolean;
  purchase(itemId: string, price: number): boolean;
  save(): void;
  load(): void;
}

// ===========================================================================
// Service registry
// ===========================================================================

export interface ServiceMap {
  world: IWorldQuery;
  nav: INavigation;
  actors: IActorRegistry;
  weapons: IWeaponSystem;
  audio: IAudio;
  render: IRenderContext;
  environment: IEnvironment;
  missions: IMissionSystem;
  progression: IProgression;
}

class ServiceRegistry {
  private map = new Map<keyof ServiceMap, unknown>();
  private waiters = new Map<keyof ServiceMap, Array<(v: unknown) => void>>();

  register<K extends keyof ServiceMap>(key: K, impl: ServiceMap[K]): void {
    this.map.set(key, impl);
    const list = this.waiters.get(key);
    if (list) {
      for (const fn of list) fn(impl);
      this.waiters.delete(key);
    }
  }

  /** Returns undefined if not yet registered — for optional dependencies. */
  tryGet<K extends keyof ServiceMap>(key: K): ServiceMap[K] | undefined {
    return this.map.get(key) as ServiceMap[K] | undefined;
  }

  /** Throws if missing — for mandatory dependencies resolved after init. */
  get<K extends keyof ServiceMap>(key: K): ServiceMap[K] {
    const v = this.map.get(key);
    if (!v) throw new Error(`[services] "${String(key)}" is not registered yet`);
    return v as ServiceMap[K];
  }

  has(key: keyof ServiceMap): boolean {
    return this.map.has(key);
  }

  /** Await registration — lets systems initialise in any order. */
  when<K extends keyof ServiceMap>(key: K): Promise<ServiceMap[K]> {
    const existing = this.map.get(key);
    if (existing) return Promise.resolve(existing as ServiceMap[K]);
    return new Promise((resolve) => {
      let list = this.waiters.get(key);
      if (!list) {
        list = [];
        this.waiters.set(key, list);
      }
      list.push(resolve as (v: unknown) => void);
    });
  }

  clear(): void {
    this.map.clear();
    this.waiters.clear();
  }
}

export const services = new ServiceRegistry();
