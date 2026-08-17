/**
 * World — terrain, buildings, props, and the spatial queries everything else
 * depends on (raycast, line of sight, ground height, surface lookup).
 *
 * OWNED BY: World design team. Environmental art team owns envart/ and adds
 * dressing through `addProp`/`addFoliage`. Keep IWorldQuery cheap — the AI
 * calls lineOfSight thousands of times per second.
 */

import * as THREE from 'three';
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

const SURFACE_TABLE: Record<SurfaceKind, SurfaceProperties> = {
  concrete: { kind: 'concrete', density: 2400, absorption: 0.42, ricochetBias: 0.55, footstepLoudness: 1.0, penetrable: true, thickness: 0.20 },
  metal:    { kind: 'metal',    density: 7800, absorption: 0.68, ricochetBias: 0.80, footstepLoudness: 1.25, penetrable: true, thickness: 0.006 },
  wood:     { kind: 'wood',     density: 650,  absorption: 0.16, ricochetBias: 0.18, footstepLoudness: 0.95, penetrable: true, thickness: 0.04 },
  drywall:  { kind: 'drywall',  density: 800,  absorption: 0.07, ricochetBias: 0.05, footstepLoudness: 0.9,  penetrable: true, thickness: 0.012 },
  glass:    { kind: 'glass',    density: 2500, absorption: 0.05, ricochetBias: 0.02, footstepLoudness: 1.1,  penetrable: true, thickness: 0.006 },
  dirt:     { kind: 'dirt',     density: 1600, absorption: 0.35, ricochetBias: 0.10, footstepLoudness: 0.7,  penetrable: true, thickness: 0.5 },
  sand:     { kind: 'sand',     density: 1500, absorption: 0.40, ricochetBias: 0.06, footstepLoudness: 0.55, penetrable: true, thickness: 0.5 },
  gravel:   { kind: 'gravel',   density: 1700, absorption: 0.38, ricochetBias: 0.22, footstepLoudness: 1.3,  penetrable: true, thickness: 0.3 },
  grass:    { kind: 'grass',    density: 1400, absorption: 0.30, ricochetBias: 0.08, footstepLoudness: 0.6,  penetrable: true, thickness: 0.4 },
  water:    { kind: 'water',    density: 1000, absorption: 0.55, ricochetBias: 0.35, footstepLoudness: 1.4,  penetrable: true, thickness: 1.0 },
  foliage:  { kind: 'foliage',  density: 200,  absorption: 0.02, ricochetBias: 0.0,  footstepLoudness: 0.85, penetrable: true, thickness: 0.3 },
  flesh:    { kind: 'flesh',    density: 1050, absorption: 0.28, ricochetBias: 0.0,  footstepLoudness: 0.5,  penetrable: true, thickness: 0.25 },
  ceramic:  { kind: 'ceramic',  density: 3800, absorption: 0.72, ricochetBias: 0.12, footstepLoudness: 1.1,  penetrable: true, thickness: 0.012 },
  rubber:   { kind: 'rubber',   density: 1100, absorption: 0.22, ricochetBias: 0.05, footstepLoudness: 0.45, penetrable: true, thickness: 0.02 },
  plastic:  { kind: 'plastic',  density: 950,  absorption: 0.10, ricochetBias: 0.08, footstepLoudness: 0.8,  penetrable: true, thickness: 0.01 },
  fabric:   { kind: 'fabric',   density: 300,  absorption: 0.04, ricochetBias: 0.0,  footstepLoudness: 0.35, penetrable: true, thickness: 0.02 },
  tile:     { kind: 'tile',     density: 2200, absorption: 0.30, ricochetBias: 0.30, footstepLoudness: 1.35, penetrable: true, thickness: 0.02 },
  snow:     { kind: 'snow',     density: 400,  absorption: 0.25, ricochetBias: 0.02, footstepLoudness: 0.4,  penetrable: true, thickness: 0.3 },
  mud:      { kind: 'mud',      density: 1800, absorption: 0.45, ricochetBias: 0.03, footstepLoudness: 0.65, penetrable: true, thickness: 0.4 },
};

/** Attached to every mesh so raycasts can resolve material behaviour. */
export interface SurfaceUserData {
  surface: SurfaceKind;
  actorId?: number;
  /** Foliage and glass don't block AI line of sight. */
  soft?: boolean;
  indoors?: boolean;
}

const TERRAIN_SIZE = 640;
const TERRAIN_SEGMENTS = 192;

export class WorldSystem implements System, IWorldQuery {
  readonly id = 'world';
  readonly order = 14;
  readonly budgetMs = 2;

  readonly extent = { minX: -TERRAIN_SIZE / 2, maxX: TERRAIN_SIZE / 2, minZ: -TERRAIN_SIZE / 2, maxZ: TERRAIN_SIZE / 2 };

  /** Everything raycastable. Kept flat for speed. */
  private colliders: THREE.Mesh[] = [];
  private raycaster = new THREE.Raycaster();
  private heightField!: Float32Array;
  private noise = new Noise2D('black-meridian-terrain');
  private rng = new Rng('world');
  root = new THREE.Group();
  /** Axis-aligned interior volumes used by isIndoors(). */
  private interiors: THREE.Box3[] = [];

  init(_ctx: EngineContext): void {
    const render = services.get('render');
    render.scene.add(this.root);

    this.buildHeightField();
    this.buildTerrain();
    this.buildDistrict();

    services.register('world', this);
  }

  // ---------------------------------------------------------------------
  // Terrain
  // ---------------------------------------------------------------------

  private buildHeightField(): void {
    const n = TERRAIN_SEGMENTS + 1;
    this.heightField = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = (i / TERRAIN_SEGMENTS - 0.5) * TERRAIN_SIZE;
        const z = (j / TERRAIN_SEGMENTS - 0.5) * TERRAIN_SIZE;
        this.heightField[j * n + i] = this.sampleTerrain(x, z);
      }
    }
  }

  /** Analytic terrain so gameplay and mesh always agree. */
  private sampleTerrain(x: number, z: number): number {
    const s = 0.0022;
    let h = this.noise.fbm(x * s, z * s, 5, 2.1, 0.5) * 26;
    h += this.noise.ridged(x * s * 2.4 + 100, z * s * 2.4 - 40, 3, 2.3, 0.5) * 9;
    // Flatten a plateau in the centre so the settlement sits on level ground.
    const d = Math.hypot(x, z);
    const flat = 1 - clamp((d - 55) / 90, 0, 1);
    h = lerp(h, 2.0, flat * flat * (3 - 2 * flat));
    return h;
  }

  groundHeight(x: number, z: number): number | null {
    if (x < this.extent.minX || x > this.extent.maxX || z < this.extent.minZ || z > this.extent.maxZ) return null;
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
      // Low-poly art direction: colour comes from vertex data, not textures.
      const arid = clamp(0.5 + this.noise.sample(x * 0.01, z * 0.01) * 0.5, 0, 1);
      const rock = clamp((y - 14) / 16, 0, 1);
      c.setHSL(lerp(0.11, 0.18, arid), lerp(0.30, 0.16, rock), lerp(0.30, 0.44, rock * 0.6 + arid * 0.2));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.0,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.userData = { surface: 'dirt' } satisfies SurfaceUserData;
    mesh.name = 'terrain';
    this.root.add(mesh);
    this.colliders.push(mesh);
  }

  // ---------------------------------------------------------------------
  // Buildings — a compact starter district. World team expands this into the
  // full site library with interiors, multiple floors, and breachable doors.
  // ---------------------------------------------------------------------

  private buildDistrict(): void {
    const rng = this.rng;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xb9ac96, roughness: 0.92, metalness: 0, flatShading: true });
    const wallMat2 = new THREE.MeshStandardMaterial({ color: 0x9b8f7c, roughness: 0.94, metalness: 0, flatShading: true });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x6d6257, roughness: 0.88, metalness: 0.05, flatShading: true });

    const placed: THREE.Box3[] = [];
    for (let i = 0; i < 26; i++) {
      let attempt = 0;
      let box: THREE.Box3 | null = null;
      let w = 0, d = 0, h = 0, cx = 0, cz = 0;
      while (attempt++ < 30) {
        const ang = rng.range(0, Math.PI * 2);
        const rad = rng.range(14, 82);
        cx = Math.cos(ang) * rad;
        cz = Math.sin(ang) * rad;
        w = rng.range(7, 18);
        d = rng.range(7, 16);
        h = rng.pickWeighted([3.4, 6.6, 9.2], [0.5, 0.35, 0.15]);
        const test = new THREE.Box3(
          new THREE.Vector3(cx - w / 2 - 3, 0, cz - d / 2 - 3),
          new THREE.Vector3(cx + w / 2 + 3, h, cz + d / 2 + 3),
        );
        if (!placed.some((p) => p.intersectsBox(test))) {
          box = test;
          break;
        }
      }
      if (!box) continue;
      placed.push(box);

      const ground = this.sampleTerrain(cx, cz);
      const g = new THREE.Group();
      g.position.set(cx, ground, cz);
      g.rotation.y = rng.range(0, Math.PI * 2) * (rng.bool(0.5) ? 0 : 1);

      const t = 0.28; // wall thickness
      const mat = rng.bool(0.5) ? wallMat : wallMat2;

      // Four walls with a doorway gap on one side.
      const doorSide = rng.int(0, 4);
      const mk = (sx: number, sy: number, sz: number, px: number, py: number, pz: number, m: THREE.Material, surface: SurfaceKind): void => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
        mesh.position.set(px, py, pz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { surface, indoors: true } satisfies SurfaceUserData;
        g.add(mesh);
        this.colliders.push(mesh);
      };

      const doorW = 1.4;
      for (let side = 0; side < 4; side++) {
        const horizontal = side % 2 === 0;
        const len = horizontal ? w : d;
        const px = horizontal ? 0 : (side === 1 ? w / 2 : -w / 2);
        const pz = horizontal ? (side === 0 ? d / 2 : -d / 2) : 0;
        if (side === doorSide) {
          const seg = (len - doorW) / 2;
          for (const s of [-1, 1]) {
            const off = s * (doorW / 2 + seg / 2);
            mk(
              horizontal ? seg : t,
              h,
              horizontal ? t : seg,
              horizontal ? off : px,
              h / 2,
              horizontal ? pz : off,
              mat,
              'concrete',
            );
          }
          // Lintel above the doorway.
          mk(horizontal ? doorW : t, h - 2.1, horizontal ? t : doorW, px, 2.1 + (h - 2.1) / 2, pz, mat, 'concrete');
        } else {
          mk(horizontal ? len : t, h, horizontal ? t : len, px, h / 2, pz, mat, 'concrete');
          // Punch a window band — readability matters more than realism here.
          if (rng.bool(0.65)) {
            const winMat = new THREE.MeshStandardMaterial({
              color: 0x1a2630, roughness: 0.15, metalness: 0.6,
              transparent: true, opacity: 0.55,
            });
            const wm = new THREE.Mesh(
              new THREE.BoxGeometry(horizontal ? len * 0.45 : t * 0.5, 1.0, horizontal ? t * 0.5 : len * 0.45),
              winMat,
            );
            wm.position.set(px, 1.75, pz);
            wm.userData = { surface: 'glass', soft: true } satisfies SurfaceUserData;
            g.add(wm);
            this.colliders.push(wm);
          }
        }
      }

      // Roof + parapet — gives rooftops the player can actually use.
      mk(w, 0.24, d, 0, h, 0, roofMat, 'concrete');
      if (rng.bool(0.6)) {
        for (let side = 0; side < 4; side++) {
          const horizontal = side % 2 === 0;
          const len = horizontal ? w : d;
          mk(
            horizontal ? len : 0.2, 0.7, horizontal ? 0.2 : len,
            horizontal ? 0 : (side === 1 ? w / 2 : -w / 2),
            h + 0.47,
            horizontal ? (side === 0 ? d / 2 : -d / 2) : 0,
            roofMat, 'concrete',
          );
        }
      }

      this.root.add(g);
      g.updateMatrixWorld(true);
      const interior = new THREE.Box3(
        new THREE.Vector3(cx - w / 2, ground, cz - d / 2),
        new THREE.Vector3(cx + w / 2, ground + h, cz + d / 2),
      );
      this.interiors.push(interior);
    }

    // Perimeter walls and a few shipping containers for hard cover.
    const containerMats = [0x2f5d54, 0x7a3b32, 0x8a7a3c, 0x35506e].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.35, flatShading: true }),
    );
    for (let i = 0; i < 22; i++) {
      const ang = rng.range(0, Math.PI * 2);
      const rad = rng.range(20, 95);
      const cx = Math.cos(ang) * rad;
      const cz = Math.sin(ang) * rad;
      const y = this.sampleTerrain(cx, cz);
      const stack = rng.int(1, 3);
      for (let s = 0; s < stack; s++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(6.06, 2.59, 2.44), rng.pick(containerMats));
        m.position.set(cx, y + 1.3 + s * 2.62, cz);
        m.rotation.y = rng.range(0, Math.PI * 2);
        m.castShadow = true;
        m.receiveShadow = true;
        m.userData = { surface: 'metal' } satisfies SurfaceUserData;
        this.root.add(m);
        this.colliders.push(m);
      }
    }

    // Low sandbag/jersey barriers — the readable cover language of the game.
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x8f8574, roughness: 0.95, flatShading: true });
    for (let i = 0; i < 40; i++) {
      const ang = rng.range(0, Math.PI * 2);
      const rad = rng.range(12, 100);
      const cx = Math.cos(ang) * rad;
      const cz = Math.sin(ang) * rad;
      const y = this.sampleTerrain(cx, cz);
      const m = new THREE.Mesh(new THREE.BoxGeometry(rng.range(2.2, 4.0), 1.1, 0.6), barrierMat);
      m.position.set(cx, y + 0.55, cz);
      m.rotation.y = rng.range(0, Math.PI * 2);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData = { surface: 'concrete' } satisfies SurfaceUserData;
      this.root.add(m);
      this.colliders.push(m);
    }
  }

  /** Environmental art / world teams add geometry through this so colliders stay in sync. */
  addCollider(mesh: THREE.Mesh, surface: SurfaceKind, opts?: { soft?: boolean; indoors?: boolean }): void {
    mesh.userData = { surface, ...opts } satisfies SurfaceUserData;
    this.colliders.push(mesh);
  }

  removeCollider(mesh: THREE.Mesh): void {
    const i = this.colliders.indexOf(mesh);
    if (i >= 0) this.colliders.splice(i, 1);
  }

  // ---------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------

  private tmpDir = new THREE.Vector3();

  raycast(origin: THREE.Vector3, direction: THREE.Vector3, opts: RaycastOptions = {}): RayHit | null {
    const hits = this.raycastAll(origin, direction, opts);
    return hits.length ? hits[0] : null;
  }

  raycastAll(origin: THREE.Vector3, direction: THREE.Vector3, opts: RaycastOptions = {}): RayHit[] {
    this.tmpDir.copy(direction).normalize();
    this.raycaster.set(origin, this.tmpDir);
    this.raycaster.far = opts.maxDistance ?? 500;
    this.raycaster.near = 0;
    const raw = this.raycaster.intersectObjects(this.colliders, false);
    const out: RayHit[] = [];
    for (const h of raw) {
      const ud = (h.object.userData ?? {}) as SurfaceUserData;
      const soft = ud.soft === true;
      if (soft && !opts.includeSoft && ud.surface === 'foliage') continue;
      if (ud.actorId !== undefined) {
        if (opts.staticOnly) continue;
        if (opts.ignoreActors?.includes(ud.actorId)) continue;
      }
      out.push({
        point: h.point.clone(),
        normal: h.normal ? h.normal.clone() : new THREE.Vector3(0, 1, 0),
        distance: h.distance,
        surface: ud.surface ?? 'concrete',
        actorId: ud.actorId ?? -1,
        object: h.object,
        opaque: !soft,
      });
    }
    return out;
  }

  private losFrom = new THREE.Vector3();
  private losDir = new THREE.Vector3();

  lineOfSight(from: THREE.Vector3, to: THREE.Vector3, ignoreActors?: readonly number[]): boolean {
    this.losFrom.copy(from);
    this.losDir.copy(to).sub(from);
    const dist = this.losDir.length();
    if (dist < 0.001) return true;
    this.losDir.multiplyScalar(1 / dist);
    const hits = this.raycastAll(this.losFrom, this.losDir, {
      maxDistance: dist - 0.05,
      ignoreActors,
    });
    return !hits.some((h) => h.opaque);
  }

  surfaceAt(point: THREE.Vector3): SurfaceKind {
    const down = new THREE.Vector3(0, -1, 0);
    const origin = point.clone().setY(point.y + 0.6);
    const hit = this.raycast(origin, down, { maxDistance: 2.0, staticOnly: true });
    return hit?.surface ?? 'dirt';
  }

  surfaceProps(kind: SurfaceKind): SurfaceProperties {
    return SURFACE_TABLE[kind] ?? SURFACE_TABLE.concrete;
  }

  overlapSphere(center: THREE.Vector3, radius: number): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    const box = new THREE.Box3();
    for (const m of this.colliders) {
      box.setFromObject(m);
      if (box.distanceToPoint(center) <= radius) out.push(m);
    }
    return out;
  }

  isIndoors(point: THREE.Vector3): boolean {
    for (const b of this.interiors) {
      if (b.containsPoint(point)) return true;
    }
    return false;
  }

  dispose(): void {
    this.colliders.length = 0;
    this.root.clear();
  }
}
