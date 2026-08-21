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
import { buildOutskirts } from './sites/outskirts';
import { BF } from './types';
import { SURFACE_TABLE } from './surfaces';
import { moveCharacter, brickGroundAt, type CharacterShape, type MoveResult } from './collision';

const TERRAIN_SIZE = 640;
const TERRAIN_SEGMENTS = 192;

/** Radius of the level pad the site is built on, metres. */
const PAD_RADIUS = 118;
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

export class WorldSystem implements System, IWorldQuery {
  readonly id = 'world';
  readonly order = 14;
  readonly budgetMs = 2;

  readonly extent = {
    minX: -TERRAIN_SIZE / 2, maxX: TERRAIN_SIZE / 2,
    minZ: -TERRAIN_SIZE / 2, maxZ: TERRAIN_SIZE / 2,
  };

  readonly yard = new Brickyard(8192);
  readonly nav = new Navigation();
  doors!: DoorRegistry;

  root = new THREE.Group();
  private noise = new Noise2D('black-meridian-terrain');
  private rng = new Rng('world');
  private terrainMesh!: THREE.Mesh;
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
    const t0 = performance.now();
    const render = services.get('render');
    render.scene.add(this.root);

    this.buildTerrain();

    // --- author the site --------------------------------------------------
    const builder = new SiteBuilder(this.yard, this.rng);
    const result = buildVilla(builder, this.rng);
    // The surrounding land: access road, checkpoint, terraces, arroyo and
    // outbuildings. Without it the compound's flanking approaches have nowhere
    // to start from, and there is no standoff to scout the place.
    const outskirts = buildOutskirts(builder, this.rng, this.terrainFn);
    this.insertions = outskirts.insertions;
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
      `[world] ${this.buildStats.bricks} bricks · ${this.buildStats.drawCalls} draws · ` +
      `${(this.buildStats.triangles / 1000).toFixed(1)}k tris · ${this.buildStats.rooms} rooms · ` +
      `${this.buildStats.doors} doors · ${this.buildStats.navNodes} nav nodes · ` +
      `${this.buildStats.coverPoints} cover · ${this.buildStats.buildMs}ms`,
    );

    services.register('world', this);
    services.register('nav', this.nav);
  }

  update(dt: number, _ctx: EngineContext): void {
    this.doors.update(dt);
  }

  // ---------------------------------------------------------------------
  // Terrain
  // ---------------------------------------------------------------------

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
    // ground rather than a cliff.
    const d = Math.hypot(x, z);
    const t = 1 - clamp((d - PAD_RADIUS) / 110, 0, 1);
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
