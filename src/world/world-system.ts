/**
 * World system — terrain, sites, and the spatial queries everything else
 * depends on.
 *
 * OWNED BY: World design team.
 *
 * This is the integration point for the world pipeline. All level geometry is
 * *bricks* (see types.ts): yaw-oriented boxes, wedges and cylinders tagged with
 * a surface and gameplay flags. One representation feeds four consumers, so
 * they can never disagree about the level:
 *
 *   Brickyard.buildMeshes()  → instanced render meshes, batched by material
 *   Brickyard.raycast()      → collision + line of sight, behind a BVH
 *   NavGrid.build()          → walkable spans rasterised from the same bricks
 *   CoverGraph.build()       → cover points derived from the same faces
 *
 * Terrain stays analytic: `sampleTerrain` is the single source of ground height
 * for gameplay and for the mesh, so the player can never stand in a hole the
 * renderer doesn't show.
 */

import * as THREE from 'three';
import { surfaceTexture } from './textures';
import type { System, EngineContext } from '../core/engine';
import {
  services,
  type IWorldQuery,
  type RayHit,
  type RaycastOptions,
  type SurfaceKind,
  type SurfaceProperties,
} from '../core/contracts';
import { Noise2D, Rng, clamp, lerp } from '../core/math';
import { Brickyard } from './brickyard';
import { SiteBuilder } from './builder';
import { DoorRegistry } from './doors';
import { NavGrid } from './navmesh';
import { Navigation } from './navigation';
import { buildVilla } from './sites/villa';
import { buildQuay } from './sites/quay';
import { buildOutskirts } from './sites/outskirts';
import { BF, type SiteInstance, type SiteBuildResult, type ApproachRoute } from './types';
import { SURFACE_TABLE } from './surfaces';
import { moveCharacter, brickGroundAt, type CharacterShape, type MoveResult } from './collision';

const TERRAIN_SIZE = 640;
/**
 * 640 m across 384 quads is 1.67 m per quad. It was 192 (3.33 m), which could
 * not hold a ditch, a berm or a spoil bank even where the terrain existed.
 */
const TERRAIN_SEGMENTS = 384;

/**
 * The flat pad each site is built on, as a rectangle rather than a disc.
 *
 * This was a circle of radius 118 m, blending to real terrain over a further
 * 110. The villa's perimeter has a half-diagonal of 107.5 m and the quay's is
 * 121 — so **both playspaces sat entirely inside the flat pad**, and the 26 m
 * of fbm plus 9 m of ridged noise underneath them existed nowhere a player
 * could stand. Every exterior shot had a horizon that was a perfectly straight
 * line across the whole frame, with more than half the image empty above it.
 *
 * A rectangle hugging each site lets the ground start rolling immediately
 * outside the wire, which is where it does any good: it gives the approach a
 * ridge to come over, it breaks the horizon, and it means the standoff outside
 * the compound is terrain rather than a parking lot.
 */
type Rect = { x0: number; z0: number; x1: number; z1: number };
const SITE_PAD: Record<'villa' | 'quay', Rect[]> = {
  villa: [
    // The compound. Perimeter is x -78..78, z -58..74.
    { x0: -88, z0: -70, x1: 88, z1: 96 },
    // The access road corridor.
    //
    // A road is graded, and this one has to be: it is laid as 6 m slabs that
    // each sample the ground at their own centre, so the moment real terrain
    // appeared underneath it the road became a staircase with daylight between
    // the treads. Carrying the pad up the corridor is both the correct answer
    // visually — roads ARE cut into hillsides — and the one that keeps the
    // checkpoint, the bus shelter and the culverts sitting flat.
    { x0: -18, z0: 90, x1: 18, z1: 214 },
  ],
  // Perimeter is x -96..94, z -74..76; the outer checkpoint sits at z -114,
  // and the approach road and rail siding are both inside this rectangle.
  quay: [{ x0: -106, z0: -122, x1: 104, z1: 88 }],
};
/** Metres over which the pad grades into open ground. */
const PAD_BLEND = 26;
/** Height of the pad above sea level. */
// The terrain sits deliberately BELOW the compound's paving.
//
// It used to be exactly 2.0, the same as the villa's lawn slab top, which made
// the two coplanar across the whole compound — textbook z-fighting, and it
// read in game as the ground flickering between green and sand as the camera
// moved. 120 mm of clearance also absorbs the difference between the analytic
// terrain function and the triangulated mesh that approximates it.
const PAD_HEIGHT = 1.88;

/** Attached to meshes that are not bricks (terrain), so raycasts resolve them. */
export interface SurfaceUserData {
  surface: SurfaceKind;
  actorId?: number;
  soft?: boolean;
  indoors?: boolean;
}

/** Where the map choice is remembered between loads. */
const MAP_KEY = 'bm.map';

/**
 * Which map to build.
 *
 * Levels are generated rather than loaded, so switching means rebuilding the
 * world — the navmesh, cover graph, doors and every actor. That is a page
 * reload, not a runtime swap, and pretending otherwise would mean tearing all
 * of it down mid-frame.
 *
 * The choice is read from `localStorage` first and `?map=` second. The URL is
 * what the capture tools use, but a published build runs inside an iframe
 * whose address bar the player cannot reach, so a query parameter is not a
 * control anyone can actually operate — the stored value is what the in-game
 * picker writes.
 *
 * Every access is guarded: `localStorage` throws outright in some embeddings
 * rather than merely returning null.
 */
export function readMapChoice(): 'villa' | 'quay' {
  if (typeof location !== 'undefined') {
    const q = new URLSearchParams(location.search).get('map');
    if (q === 'quay' || q === 'villa') return q;
  }
  try {
    const v = localStorage.getItem(MAP_KEY);
    if (v === 'quay' || v === 'villa') return v;
  } catch {
    // Private browsing, blocked site data, or a thumbnail capture.
  }
  return 'villa';
}

/** Remember a map choice for the next load. Safe to call anywhere. */
export function writeMapChoice(id: 'villa' | 'quay'): void {
  try {
    localStorage.setItem(MAP_KEY, id);
  } catch {
    // Nothing to do — the reload will simply come back on the default map.
  }
}

export class WorldSystem implements System, IWorldQuery {
  readonly id = 'world';
  readonly order = 14;
  readonly budgetMs = 2;

  readonly extent = {
    minX: -TERRAIN_SIZE / 2, maxX: TERRAIN_SIZE / 2,
    minZ: -TERRAIN_SIZE / 2, maxZ: TERRAIN_SIZE / 2,
  };

  // Not readonly: switching maps replaces both wholesale. Resetting a
  // brickyard and a navmesh in place would mean clearing a dozen typed arrays
  // and every acceleration structure built over them, and getting one of them
  // wrong leaves stale geometry that only shows up as a raycast hitting a
  // building that is no longer there.
  yard = new Brickyard(8192);
  nav = new Navigation();
  doors!: DoorRegistry;

  root = new THREE.Group();
  private noise = new Noise2D('black-meridian-terrain');
  private rng = new Rng('world');
  private terrainMesh!: THREE.Mesh;

  /**
   * Which map to build. See `readMapChoice`.
   */
  mapId: 'villa' | 'quay' = readMapChoice();

  /** The built site — approaches, landmarks and garrison anchors. */
  site!: SiteInstance;

  /** Light fixtures authored by the site, read by InteriorLights at its init. */
  authoredLights: NonNullable<SiteBuildResult['lights']> = [];
  /** Extra meshes (actors, props added by other teams) tested after bricks. */
  private extraColliders: THREE.Mesh[] = [];
  private extraRaycaster = new THREE.Raycaster();
  private interiors: THREE.Box3[] = [];
  /** Bound once so the collision hot path doesn't allocate a closure per call. */
  private terrainFn = (x: number, z: number): number => this.sampleTerrain(x, z);
  /** Mission insertion points out in the approach terrain. */
  insertions: Array<{ id: string; x: number; z: number; label: string }> = [];

  buildStats = {
    bricks: 0, drawCalls: 0, triangles: 0, rooms: 0, doors: 0,
    navNodes: 0, coverPoints: 0, buildMs: 0,
  };

  init(_ctx: EngineContext): void {
    const render = services.get('render');
    render.scene.add(this.root);
    this.buildMap(this.mapId);
    services.register('world', this);
    services.register('nav', this.nav);
  }

  /**
   * Build (or rebuild) a map.
   *
   * Separated from `init` so the map picker can switch without reloading the
   * page. A reload is the obvious implementation and it does not work: the
   * published build runs inside an artifact iframe, and reloading that frame
   * fails outright — the player gets "couldn't load artifact" instead of a
   * level. So the world tears itself down and builds again in place.
   */
  buildMap(mapId: 'villa' | 'quay'): void {
    const t0 = performance.now();
    this.mapId = mapId;

    // Reseed. The generator's RNG carries its state forward, so building a
    // second map and then switching back produced a *different* villa —
    // measurably: 1985 bricks the first time, 2004 the second. A level that
    // is not the same level twice cannot be learned, and it makes every
    // before/after capture a comparison of two different buildings.
    this.rng = new Rng(`world:${mapId}`);
    this.noise = new Noise2D('black-meridian-terrain');

    this.buildTerrain();

    // --- author the site --------------------------------------------------
    const builder = new SiteBuilder(this.yard, this.rng);
    let result: SiteBuildResult;
    if (this.mapId === 'quay') {
      result = buildQuay(builder, this.rng, this.terrainFn);
      this.insertions = result.site.approaches.map((a: ApproachRoute) => ({
        id: a.id, x: a.x, z: a.z, label: a.name,
      }));
    } else {
      result = buildVilla(builder, this.rng);
      // The surrounding land: access road, checkpoint, terraces, arroyo and
      // outbuildings. Without it the compound's flanking approaches have
      // nowhere to start from, and there is no standoff to scout the place.
      const outskirts = buildOutskirts(builder, this.rng, this.terrainFn);
      this.insertions = outskirts.insertions;
    }
    this.site = result.site;
    // Authored fixtures, handed to the interior lighting system once it is up.
    this.authoredLights = result.lights ?? [];
    // Last chance to notice that something has been built across a doorway.
    // Runs before `finalize` so the BVH is built from the corrected flags.
    builder.clearDoorways();

    this.yard.finalize();

    this.root.add(this.yard.buildMeshes());

    this.doors = new DoorRegistry(this.yard, builder.doorRigs);

    // --- navigation -------------------------------------------------------
    const site = result.site;
    const grid = new NavGrid({
      // Extend past the compound so patrols can work the checkpoint and the
      // orchard rows rather than stopping dead at the wall.
      minX: site.coreMinX - 30, maxX: site.coreMaxX + 30,
      minZ: site.coreMinZ - 30, maxZ: site.coreMaxZ + 70,
      minY: site.minY - 4, maxY: site.maxY,
    });
    grid.build(this.yard, (x, z) => this.sampleTerrain(x, z), result.rooms, result.navLinks);
    this.nav.addGrid(grid);
    this.nav.setRooms(
      result.rooms,
      builder.doors.map((d) => ({ id: d.id, roomA: d.roomA, roomB: d.roomB })),
    );
    this.nav.buildCover(this.yard);

    // Interior volumes for isIndoors(), taken straight from authored rooms.
    for (const r of result.rooms) {
      if (!r.indoors) continue;
      this.interiors.push(new THREE.Box3(
        new THREE.Vector3(r.minX, r.minY, r.minZ),
        new THREE.Vector3(r.maxX, r.maxY, r.maxZ),
      ));
    }

    const ys = this.yard.stats;
    const ns = this.nav.stats;
    this.buildStats = {
      bricks: this.yard.count,
      drawCalls: ys.meshes,
      triangles: ys.triangles,
      rooms: result.rooms.length,
      doors: builder.doors.length,
      navNodes: ns.nodes,
      coverPoints: ns.coverPoints,
      buildMs: Math.round(performance.now() - t0),
    };
    console.info(
      `[world] ${this.site.name} — ${this.buildStats.bricks} bricks · ` +
      `${this.buildStats.drawCalls} draws · ` +
      `${(this.buildStats.triangles / 1000).toFixed(1)}k tris · ${this.buildStats.rooms} rooms · ` +
      `${this.buildStats.doors} doors · ${this.buildStats.navNodes} nav nodes · ` +
      `${this.buildStats.coverPoints} cover · ${this.buildStats.buildMs}ms`,
    );
  }

  /**
   * Throw the current level away.
   *
   * Every GPU resource is disposed by hand. Dropping the references and
   * trusting the garbage collector does not free VRAM — a few map switches
   * would accumulate hundreds of megabytes of orphaned buffers, and on a
   * modest GPU that ends the session with a context loss rather than a leak
   * anyone notices in time.
   */
  teardown(): void {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[];
      // Brick materials belong to the brickyard, which disposes them below.
      // The terrain builds its own each time, so it has to be freed here or it
      // leaks a material and its compiled program per switch.
      if (Array.isArray(mat)) return;
      if (mat && m.name === 'terrain') mat.dispose();
    });
    this.root.clear();

    // The brickyard owns its InstancedMeshes and its material set, and only it
    // can free them. Traversing `root` and calling geometry.dispose() misses
    // InstancedMesh.dispose() — which is what releases instanceMatrix and
    // instanceColor — and misses the materials entirely. That was roughly
    // 620 KB of instance attributes plus a whole program set leaked on every
    // map switch, and the next map then recompiled all of it.
    this.yard.dispose();
    this.yard = new Brickyard(8192);
    this.nav = new Navigation();
    this.doors = undefined as unknown as DoorRegistry;
    // Points at a mesh whose geometry has just been freed.
    this.terrainMesh = undefined as unknown as THREE.Mesh;
    this.interiors.length = 0;
    this.insertions.length = 0;
    this.authoredLights = [];
    this.extraColliders.length = 0;

    // The navigation service is a different object now, so anything holding
    // the old one — the AI, chiefly — would path against a deleted level.
    services.register('nav', this.nav);
  }

  // ---------------------------------------------------------------------

  update(dt: number, _ctx: EngineContext): void {
    // Door animation. This was lost when `init` was refactored into
    // `buildMap`, and the failure was completely silent: doors still toggled,
    // still reported themselves open, still emitted their events — the leaf
    // simply never moved out of the doorway. Every door on both maps was
    // affected and nothing caught it, because every piece of state a test
    // would check said the door had opened.
    // Guarded: `teardown` leaves this undefined until `buildMap` runs, and a
    // frame slipping between the two would throw here and take the whole
    // engine loop with it.
    this.doors?.update(dt);
  }

  /**
   * Analytic terrain. Gameplay and mesh both read this, so they always agree.
   * A flat pad is carved under the site — a compound built across rolling
   * ground reads as accidental, and stairs/doorways need a level datum.
   */
  private sampleTerrain(x: number, z: number): number {
    const s = 0.0022;
    let h = this.noise.fbm(x * s, z * s, 5, 2.1, 0.5) * 26;
    h += this.noise.ridged(x * s * 2.4 + 100, z * s * 2.4 - 40, 3, 2.3, 0.5) * 9;

    // Blend to the pad with a smooth shoulder so the edge reads as graded
    // ground rather than a cliff. Distance is to the pad RECTANGLE, so the
    // shoulder follows the site's own shape instead of bulging into the
    // approach at the corners and cutting it short along the long axis.
    // Nearest of the site's pad rectangles wins, so overlapping pads (the
    // compound and the road corridor that leaves it) join without a seam.
    const rects = SITE_PAD[this.mapId] ?? SITE_PAD.villa;
    let d = Infinity;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      const dx = Math.max(r.x0 - x, 0, x - r.x1);
      const dz = Math.max(r.z0 - z, 0, z - r.z1);
      const dd = Math.hypot(dx, dz);
      if (dd < d) d = dd;
      if (d === 0) break;
    }
    const t = 1 - clamp(d / PAD_BLEND, 0, 1);
    const pad = t * t * (3 - 2 * t);
    return lerp(h, PAD_HEIGHT, pad);
  }

  groundHeight(x: number, z: number): number | null {
    if (x < this.extent.minX || x > this.extent.maxX || z < this.extent.minZ || z > this.extent.maxZ) {
      return null;
    }
    return this.sampleTerrain(x, z);
  }

  private buildTerrain(): void {
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.sampleTerrain(x, z);
      pos.setY(i, y);

      // Vertex colour instead of texture: arid scrub varying to bare rock,
      // with a drier, paler band across the graded pad.
      const arid = clamp(0.5 + this.noise.sample(x * 0.011, z * 0.011) * 0.5, 0, 1);
      const rock = clamp((y - 13) / 15, 0, 1);
      const grain = this.noise.sample(x * 0.13, z * 0.13) * 0.03;
      c.setHSL(
        lerp(0.105, 0.14, arid),
        lerp(0.26, 0.13, rock),
        lerp(0.29, 0.42, rock * 0.55 + arid * 0.25) + grain,
      );
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    // UVs run 0..1 across 640 m, so the repeat has to do all the work. Two
    // scales: a coarse map breaking up the large forms and a fine one that
    // only resolves close to the player.
    const detail = surfaceTexture('dirt', 1);
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.96, metalness: 0, flatShading: true,
      map: detail,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uCoarse = { value: TERRAIN_SIZE / 26 };
      shader.uniforms.uFine = { value: TERRAIN_SIZE / 2.2 };
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uCoarse;
          uniform float uFine;`)
        .replace('#include <map_fragment>', `
          #ifdef USE_MAP
            // Two octaves at very different scales. One alone either tiles
            // visibly across the whole map or vanishes beyond ten metres.
            // Doubled so the average texel is a no-op — a greyscale map
            // averages 0.5 and multiplying by it straight halves the terrain.
            vec3 coarse = texture2D(map, vMapUv * uCoarse).rgb * 2.0;
            vec3 fine   = texture2D(map, vMapUv * uFine).rgb * 2.0;
            diffuseColor.rgb *= mix(vec3(1.0), coarse, 0.34)
                              * mix(vec3(1.0), fine, 0.20);
          #endif`);
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    mesh.userData = { surface: 'dirt' } satisfies SurfaceUserData;
    this.terrainMesh = mesh;
    this.root.add(mesh);
  }

  // ---------------------------------------------------------------------
  // Collider registration for other teams (characters, dynamic props)
  // ---------------------------------------------------------------------

  addCollider(mesh: THREE.Mesh, surface: SurfaceKind, opts?: { soft?: boolean; indoors?: boolean; actorId?: number }): void {
    mesh.userData = { surface, ...opts } satisfies SurfaceUserData;
    this.extraColliders.push(mesh);
  }

  removeCollider(mesh: THREE.Mesh): void {
    const i = this.extraColliders.indexOf(mesh);
    if (i >= 0) this.extraColliders.splice(i, 1);
  }

  // ---------------------------------------------------------------------
  // Queries — hot path, no allocation beyond the returned hits
  // ---------------------------------------------------------------------

  private dirN = new THREE.Vector3();

  raycast(origin: THREE.Vector3, direction: THREE.Vector3, opts: RaycastOptions = {}): RayHit | null {
    const maxDistance = opts.maxDistance ?? 500;
    this.dirN.copy(direction).normalize();

    let best: RayHit | null = null;

    // --- bricks -----------------------------------------------------------
    const brick = this.yard.raycast(
      origin.x, origin.y, origin.z,
      this.dirN.x, this.dirN.y, this.dirN.z,
      maxDistance,
    );
    if (brick >= 0) {
      const t = this.yard.lastT;
      best = {
        point: new THREE.Vector3(
          origin.x + this.dirN.x * t,
          origin.y + this.dirN.y * t,
          origin.z + this.dirN.z * t,
        ),
        normal: new THREE.Vector3(this.yard.lastNx, this.yard.lastNy, this.yard.lastNz),
        distance: t,
        surface: this.yard.surfaceOf(brick),
        actorId: -1,
        object: null,
        opaque: (this.yard.flags[brick] & BF.SOFT) === 0,
      };
    }

    // --- terrain ----------------------------------------------------------
    const terrainT = this.raycastTerrain(origin, this.dirN, best ? best.distance : maxDistance);
    if (terrainT >= 0 && (!best || terrainT < best.distance)) {
      const p = new THREE.Vector3(
        origin.x + this.dirN.x * terrainT,
        origin.y + this.dirN.y * terrainT,
        origin.z + this.dirN.z * terrainT,
      );
      best = {
        point: p,
        normal: this.terrainNormal(p.x, p.z),
        distance: terrainT,
        surface: 'dirt',
        actorId: -1,
        object: this.terrainMesh,
        opaque: true,
      };
    }

    // --- other meshes (actors) -------------------------------------------
    if (!opts.staticOnly && this.extraColliders.length) {
      const hit = this.raycastExtras(origin, this.dirN, best ? best.distance : maxDistance, opts);
      if (hit && (!best || hit.distance < best.distance)) best = hit;
    }

    return best;
  }

  raycastAll(origin: THREE.Vector3, direction: THREE.Vector3, opts: RaycastOptions = {}): RayHit[] {
    const maxDistance = opts.maxDistance ?? 500;
    this.dirN.copy(direction).normalize();
    const out: RayHit[] = [];

    this.yard.raycastAll(
      origin.x, origin.y, origin.z,
      this.dirN.x, this.dirN.y, this.dirN.z,
      maxDistance,
      (brick, t, nx, ny, nz) => {
        const flags = this.yard.flags[brick];
        out.push({
          point: new THREE.Vector3(
            origin.x + this.dirN.x * t, origin.y + this.dirN.y * t, origin.z + this.dirN.z * t,
          ),
          normal: new THREE.Vector3(nx, ny, nz),
          distance: t,
          surface: this.yard.surfaceOf(brick),
          actorId: -1,
          object: null,
          opaque: (flags & BF.SOFT) === 0,
        });
      },
    );

    const terrainT = this.raycastTerrain(origin, this.dirN, maxDistance);
    if (terrainT >= 0) {
      const p = new THREE.Vector3(
        origin.x + this.dirN.x * terrainT,
        origin.y + this.dirN.y * terrainT,
        origin.z + this.dirN.z * terrainT,
      );
      out.push({
        point: p, normal: this.terrainNormal(p.x, p.z), distance: terrainT,
        surface: 'dirt', actorId: -1, object: this.terrainMesh, opaque: true,
      });
    }

    if (!opts.staticOnly && this.extraColliders.length) {
      const hit = this.raycastExtras(origin, this.dirN, maxDistance, opts);
      if (hit) out.push(hit);
    }

    out.sort((a, b) => a.distance - b.distance);
    return out;
  }

  private raycastExtras(
    origin: THREE.Vector3, dir: THREE.Vector3, maxDistance: number, opts: RaycastOptions,
  ): RayHit | null {
    this.extraRaycaster.set(origin, dir);
    this.extraRaycaster.far = maxDistance;
    this.extraRaycaster.near = 0;
    const raw = this.extraRaycaster.intersectObjects(this.extraColliders, false);
    for (const h of raw) {
      const ud = (h.object.userData ?? {}) as SurfaceUserData;
      if (ud.actorId !== undefined && opts.ignoreActors?.includes(ud.actorId)) continue;
      return {
        point: h.point.clone(),
        normal: h.normal ? h.normal.clone() : new THREE.Vector3(0, 1, 0),
        distance: h.distance,
        surface: ud.surface ?? 'flesh',
        actorId: ud.actorId ?? -1,
        object: h.object,
        opaque: ud.soft !== true,
      };
    }
    return null;
  }

  /**
   * Marches the analytic heightfield. Terrain is smooth and mostly below the
   * ray, so a coarse march with a bisection refinement beats meshing it into
   * the BVH — and it stays exact against `sampleTerrain`.
   */
  private raycastTerrain(origin: THREE.Vector3, dir: THREE.Vector3, maxDistance: number): number {
    if (Math.abs(dir.y) < 1e-6 && origin.y > 60) return -1;
    const step = 1.5;
    let prevT = 0;
    let prevDiff = origin.y - this.sampleTerrain(origin.x, origin.z);
    if (prevDiff < 0) return -1; // started underground; treat as no hit

    for (let t = step; t <= maxDistance; t += step) {
      const x = origin.x + dir.x * t;
      const y = origin.y + dir.y * t;
      const z = origin.z + dir.z * t;
      const diff = y - this.sampleTerrain(x, z);
      if (diff <= 0) {
        // Bisect between the last two samples for a tight crossing point.
        let lo = prevT, hi = t, loD = prevDiff;
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) * 0.5;
          const md = (origin.y + dir.y * mid) - this.sampleTerrain(origin.x + dir.x * mid, origin.z + dir.z * mid);
          if ((md <= 0) === (loD <= 0)) { lo = mid; loD = md; } else { hi = mid; }
        }
        return (lo + hi) * 0.5;
      }
      prevT = t;
      prevDiff = diff;
    }
    return -1;
  }

  private terrainNormal(x: number, z: number): THREE.Vector3 {
    const e = 0.6;
    const hL = this.sampleTerrain(x - e, z);
    const hR = this.sampleTerrain(x + e, z);
    const hD = this.sampleTerrain(x, z - e);
    const hU = this.sampleTerrain(x, z + e);
    return new THREE.Vector3(hL - hR, 2 * e, hD - hU).normalize();
  }

  private losDir = new THREE.Vector3();

  lineOfSight(from: THREE.Vector3, to: THREE.Vector3, ignoreActors?: readonly number[]): boolean {
    this.losDir.copy(to).sub(from);
    const dist = this.losDir.length();
    if (dist < 1e-3) return true;
    this.losDir.multiplyScalar(1 / dist);
    const maxT = dist - 0.05;

    // Opaque bricks only — glass and foliage don't block sight.
    const brick = this.yard.raycast(
      from.x, from.y, from.z,
      this.losDir.x, this.losDir.y, this.losDir.z,
      maxT,
      (b) => (this.yard.flags[b] & BF.SOFT) === 0,
    );
    if (brick >= 0) return false;

    if (this.raycastTerrain(from, this.losDir, maxT) >= 0) return false;

    if (this.extraColliders.length) {
      const hit = this.raycastExtras(from, this.losDir, maxT, { ignoreActors });
      if (hit && hit.opaque) return false;
    }
    return true;
  }

  surfaceAt(point: THREE.Vector3): SurfaceKind {
    // Look just under the feet; fall back to terrain when standing on ground.
    const brick = this.yard.raycast(point.x, point.y + 0.4, point.z, 0, -1, 0, 1.4);
    if (brick >= 0) return this.yard.surfaceOf(brick);
    return 'dirt';
  }

  surfaceProps(kind: SurfaceKind): SurfaceProperties {
    return SURFACE_TABLE[kind] ?? SURFACE_TABLE.concrete;
  }

  overlapSphere(center: THREE.Vector3, radius: number): THREE.Object3D[] {
    // Bricks are not Object3Ds. Callers that need geometry should use
    // `overlapBricks`; this returns only the registered extra meshes so the
    // contract stays honest rather than fabricating objects.
    const out: THREE.Object3D[] = [];
    const box = new THREE.Box3();
    for (const m of this.extraColliders) {
      box.setFromObject(m);
      if (box.distanceToPoint(center) <= radius) out.push(m);
    }
    return out;
  }

  /**
   * Move a character capsule through the world, resolving against bricks and
   * terrain. This is the only correct way to move an actor: `overlapSphere`
   * does not see brick geometry, so anything relying on it walks through walls.
   */
  moveCharacter(
    x: number, y: number, z: number,
    dx: number, dy: number, dz: number,
    shape: CharacterShape,
  ): MoveResult {
    return moveCharacter(this.yard, this.terrainFn, x, y, z, dx, dy, dz, shape);
  }

  /** Floor height under a point: terrain, or a brick top standing above it. */
  floorAt(x: number, z: number, fromY: number, searchDown = 3, searchUp = 0.5): number {
    const terrain = this.sampleTerrain(x, z);
    const brick = brickGroundAt(this.yard, x, z, fromY - searchDown, fromY + searchUp);
    return Math.max(terrain, brick === -Infinity ? -Infinity : brick);
  }

  /** Brick ids overlapping a sphere — the fast path for movement and blasts. */
  overlapBricks(center: THREE.Vector3, radius: number, visit: (brick: number) => void): void {
    this.yard.queryBox(
      center.x - radius, center.y - radius, center.z - radius,
      center.x + radius, center.y + radius, center.z + radius,
      visit,
    );
  }

  isIndoors(point: THREE.Vector3): boolean {
    for (const b of this.interiors) {
      if (b.containsPoint(point)) return true;
    }
    return false;
  }

  dispose(): void {
    this.yard.dispose();
    this.root.clear();
    this.extraColliders.length = 0;
  }
}
