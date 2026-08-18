/**
 * Brickyard — the single store every world consumer reads from.
 *
 * Bricks live in parallel typed arrays. Render builds one InstancedMesh per
 * (material, shape); collision does exact OBB / wedge / cylinder tests behind
 * the BVH; navigation rasterises the same boxes into solid spans; cover reads
 * the same faces. Nothing can drift out of sync because nothing is duplicated.
 */

import * as THREE from 'three';
import type { SurfaceKind } from '../core/contracts';
import { BF, SHAPE_BOX, SHAPE_CYL, SHAPE_WEDGE, type BrickDef } from './types';
import { MATERIALS, TINT_NEUTRAL, buildThreeMaterials, unpackTint } from './palette';
import { Bvh } from './bvh';

export const SURFACE_LIST: SurfaceKind[] = [
  'concrete', 'metal', 'wood', 'drywall', 'glass', 'dirt', 'sand', 'gravel',
  'grass', 'water', 'foliage', 'flesh', 'ceramic', 'rubber', 'plastic',
  'fabric', 'tile', 'snow', 'mud',
];
const SURFACE_INDEX: Record<string, number> = {};
SURFACE_LIST.forEach((s, i) => { SURFACE_INDEX[s] = i; });

export interface BrickHit {
  brick: number;
  t: number;
  nx: number; ny: number; nz: number;
}

const CYL_R = 0.9239; // apothem-ish radius for the 8-gon, keeps collision inside the mesh

export class Brickyard {
  count = 0;
  private cap = 0;

  px!: Float32Array; py!: Float32Array; pz!: Float32Array;
  hx!: Float32Array; hy!: Float32Array; hz!: Float32Array;
  yaw!: Float32Array; cosY!: Float32Array; sinY!: Float32Array;
  shape!: Uint8Array; surf!: Uint8Array; mat!: Uint8Array;
  tint!: Uint32Array; flags!: Uint16Array;
  building!: Int16Array; room!: Int16Array; door!: Int16Array;
  /** 6 floats per brick: world AABB. */
  aabb!: Float32Array;

  /** Static (non-door) primitives, indexed into `staticIds`. */
  readonly bvh = new Bvh();
  private staticIds: Int32Array = new Int32Array(0);
  private staticAabb: Float32Array = new Float32Array(0);
  /** Door bricks, tested linearly — a few dozen at most and they move. */
  private dynamicIds: number[] = [];

  /** brickIndex → packed (group << 20 | instance), -1 if not rendered. */
  private instanceSlot!: Int32Array;

  constructor(initialCapacity = 4096) {
    this.grow(initialCapacity);
  }

  private grow(cap: number): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const copy = (old: any, next: any): any => {
      if (old) next.set(old.subarray(0, Math.min(old.length, next.length)));
      return next;
    };
    this.px = copy(this.px, new Float32Array(cap));
    this.py = copy(this.py, new Float32Array(cap));
    this.pz = copy(this.pz, new Float32Array(cap));
    this.hx = copy(this.hx, new Float32Array(cap));
    this.hy = copy(this.hy, new Float32Array(cap));
    this.hz = copy(this.hz, new Float32Array(cap));
    this.yaw = copy(this.yaw, new Float32Array(cap));
    this.cosY = copy(this.cosY, new Float32Array(cap));
    this.sinY = copy(this.sinY, new Float32Array(cap));
    this.shape = copy(this.shape, new Uint8Array(cap));
    this.surf = copy(this.surf, new Uint8Array(cap));
    this.mat = copy(this.mat, new Uint8Array(cap));
    this.tint = copy(this.tint, new Uint32Array(cap));
    this.flags = copy(this.flags, new Uint16Array(cap));
    this.building = copy(this.building, new Int16Array(cap));
    this.room = copy(this.room, new Int16Array(cap));
    this.door = copy(this.door, new Int16Array(cap));
    this.aabb = copy(this.aabb, new Float32Array(cap * 6));
    this.cap = cap;
  }

  add(d: BrickDef): number {
    if (this.count >= this.cap) this.grow(this.cap * 2);
    const i = this.count++;
    this.px[i] = d.x; this.py[i] = d.y; this.pz[i] = d.z;
    this.hx[i] = Math.max(1e-4, d.hx);
    this.hy[i] = Math.max(1e-4, d.hy);
    this.hz[i] = Math.max(1e-4, d.hz);
    const y = d.yaw ?? 0;
    this.yaw[i] = y;
    this.cosY[i] = Math.cos(y);
    this.sinY[i] = Math.sin(y);
    this.shape[i] = d.shape ?? SHAPE_BOX;
    this.surf[i] = SURFACE_INDEX[d.surface] ?? 0;
    this.mat[i] = d.mat;
    this.tint[i] = d.tint ?? TINT_NEUTRAL;
    this.flags[i] = d.flags ?? 0;
    this.building[i] = d.building ?? -1;
    this.room[i] = d.room ?? -1;
    this.door[i] = d.door ?? -1;
    this.updateAabb(i);
    return i;
  }

  updateAabb(i: number): void {
    const c = Math.abs(this.cosY[i]);
    const s = Math.abs(this.sinY[i]);
    const ex = this.hx[i] * c + this.hz[i] * s;
    const ez = this.hx[i] * s + this.hz[i] * c;
    const o = i * 6;
    this.aabb[o] = this.px[i] - ex;
    this.aabb[o + 1] = this.py[i] - this.hy[i];
    this.aabb[o + 2] = this.pz[i] - ez;
    this.aabb[o + 3] = this.px[i] + ex;
    this.aabb[o + 4] = this.py[i] + this.hy[i];
    this.aabb[o + 5] = this.pz[i] + ez;
  }

  surfaceOf(i: number): SurfaceKind {
    return SURFACE_LIST[this.surf[i]];
  }

  /** Moves a door brick and refreshes its AABB + render instance. */
  setTransform(i: number, x: number, y: number, z: number, yaw: number): void {
    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    this.yaw[i] = yaw;
    this.cosY[i] = Math.cos(yaw);
    this.sinY[i] = Math.sin(yaw);
    this.updateAabb(i);
    this.refreshInstance(i);
  }

  // -------------------------------------------------------------------------
  // Acceleration structure
  // -------------------------------------------------------------------------

  finalize(): void {
    const staticIdx: number[] = [];
    this.dynamicIds.length = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.flags[i] & BF.DOOR) this.dynamicIds.push(i);
      else staticIdx.push(i);
    }
    this.staticIds = new Int32Array(staticIdx);
    this.staticAabb = new Float32Array(staticIdx.length * 6);
    for (let k = 0; k < staticIdx.length; k++) {
      this.staticAabb.set(this.aabb.subarray(staticIdx[k] * 6, staticIdx[k] * 6 + 6), k * 6);
    }
    this.bvh.build(this.staticAabb, staticIdx.length);
  }

  get dynamicCount(): number {
    return this.dynamicIds.length;
  }

  // -------------------------------------------------------------------------
  // Exact primitive intersection
  // -------------------------------------------------------------------------

  /**
   * Ray against one brick. Returns entry distance or -1.
   * Normal is written into `_n` (module scratch) to stay allocation-free.
   */
  hitBrick(
    i: number,
    ox: number, oy: number, oz: number,
    dx: number, dy: number, dz: number,
    maxT: number,
  ): number {
    const c = this.cosY[i];
    const s = this.sinY[i];
    const rx = ox - this.px[i];
    const ry = oy - this.py[i];
    const rz = oz - this.pz[i];
    // world → local (inverse yaw)
    const lox = c * rx - s * rz;
    const loz = s * rx + c * rz;
    const ldx = c * dx - s * dz;
    const ldz = s * dx + c * dz;
    const sh = this.shape[i];

    if (sh === SHAPE_CYL) return this.hitCylinder(i, lox, ry, loz, ldx, dy, ldz, maxT, c, s);

    let tmin = 0;
    let tmax = maxT;
    let axis = -1;
    let sgn = 1;

    // X slab
    let inv = 1 / (ldx || 1e-12);
    let t0 = (-this.hx[i] - lox) * inv;
    let t1 = (this.hx[i] - lox) * inv;
    let sg = -1;
    if (t0 > t1) { const t = t0; t0 = t1; t1 = t; sg = 1; }
    if (t0 > tmin) { tmin = t0; axis = 0; sgn = sg; }
    if (t1 < tmax) tmax = t1;
    if (tmax < tmin) return -1;

    // Y slab
    inv = 1 / (dy || 1e-12);
    t0 = (-this.hy[i] - ry) * inv;
    t1 = (this.hy[i] - ry) * inv;
    sg = -1;
    if (t0 > t1) { const t = t0; t0 = t1; t1 = t; sg = 1; }
    if (t0 > tmin) { tmin = t0; axis = 1; sgn = sg; }
    if (t1 < tmax) tmax = t1;
    if (tmax < tmin) return -1;

    // Z slab
    inv = 1 / (ldz || 1e-12);
    t0 = (-this.hz[i] - loz) * inv;
    t1 = (this.hz[i] - loz) * inv;
    sg = -1;
    if (t0 > t1) { const t = t0; t0 = t1; t1 = t; sg = 1; }
    if (t0 > tmin) { tmin = t0; axis = 2; sgn = sg; }
    if (t1 < tmax) tmax = t1;
    if (tmax < tmin) return -1;

    let nlx = 0, nly = 0, nlz = 0;
    if (sh === SHAPE_WEDGE) {
      // Extra half-space: y + (hy/hz) * z <= 0
      const k = this.hy[i] / this.hz[i];
      const dist = ry + k * loz;
      const rate = dy + k * ldz;
      if (rate > 1e-9) {
        const th = -dist / rate;
        if (th < tmax) tmax = th;
        else if (dist > 0) return -1;
      } else if (rate < -1e-9) {
        const th = -dist / rate;
        if (th > tmin) { tmin = th; axis = 3; sgn = 1; }
      } else if (dist > 0) {
        return -1;
      }
      if (tmax < tmin) return -1;
      if (axis === 3) {
        const inv2 = 1 / Math.hypot(1, k);
        nly = inv2; nlz = k * inv2;
      }
    }
    if (tmin < 0 || tmin > maxT) return -1;

    if (axis === 0) nlx = sgn;
    else if (axis === 1) nly = sgn;
    else if (axis === 2) nlz = sgn;

    _nx = c * nlx + s * nlz;
    _ny = nly;
    _nz = -s * nlx + c * nlz;
    return tmin;
  }

  private hitCylinder(
    i: number,
    lox: number, ry: number, loz: number,
    ldx: number, dy: number, ldz: number,
    maxT: number, c: number, s: number,
  ): number {
    const rx = this.hx[i] * CYL_R;
    const rz = this.hz[i] * CYL_R;
    // Scale to a unit circle so elliptical columns still work.
    const ax = lox / rx, az = loz / rz;
    const bx = ldx / rx, bz = ldz / rz;
    const A = bx * bx + bz * bz;
    let tmin = 0, tmax = maxT;
    let side = false;
    if (A > 1e-12) {
      const B = 2 * (ax * bx + az * bz);
      const C = ax * ax + az * az - 1;
      const disc = B * B - 4 * A * C;
      if (disc < 0) return -1;
      const sq = Math.sqrt(disc);
      const t0 = (-B - sq) / (2 * A);
      const t1 = (-B + sq) / (2 * A);
      if (t0 > tmin) { tmin = t0; side = true; }
      if (t1 < tmax) tmax = t1;
      if (tmax < tmin) return -1;
    } else if (ax * ax + az * az > 1) {
      return -1;
    }
    const inv = 1 / (dy || 1e-12);
    let t0 = (-this.hy[i] - ry) * inv;
    let t1 = (this.hy[i] - ry) * inv;
    let sg = -1;
    if (t0 > t1) { const t = t0; t0 = t1; t1 = t; sg = 1; }
    let cap = false;
    if (t0 > tmin) { tmin = t0; cap = true; side = false; }
    if (t1 < tmax) tmax = t1;
    if (tmax < tmin || tmin < 0 || tmin > maxT) return -1;

    let nlx = 0, nly = 0, nlz = 0;
    if (cap) {
      nly = sg;
    } else if (side) {
      nlx = (lox + ldx * tmin) / rx;
      nlz = (loz + ldz * tmin) / rz;
      const l = Math.hypot(nlx, nlz) || 1;
      nlx /= l; nlz /= l;
    } else {
      nly = 1;
    }
    _nx = c * nlx + s * nlz;
    _ny = nly;
    _nz = -s * nlx + c * nlz;
    return tmin;
  }

  /** Is the world point inside brick `i`? */
  containsPoint(i: number, x: number, y: number, z: number): boolean {
    if (y < this.py[i] - this.hy[i] || y > this.py[i] + this.hy[i]) return false;
    const c = this.cosY[i];
    const s = this.sinY[i];
    const rx = x - this.px[i];
    const rz = z - this.pz[i];
    const lx = c * rx - s * rz;
    const lz = s * rx + c * rz;
    if (this.shape[i] === SHAPE_CYL) {
      const a = lx / (this.hx[i] * CYL_R);
      const b = lz / (this.hz[i] * CYL_R);
      return a * a + b * b <= 1;
    }
    if (Math.abs(lx) > this.hx[i] || Math.abs(lz) > this.hz[i]) return false;
    if (this.shape[i] === SHAPE_WEDGE) {
      return (y - this.py[i]) + (this.hy[i] / this.hz[i]) * lz <= 0;
    }
    return true;
  }

  /** Height of the brick's top surface at an XZ point, or -Infinity if outside. */
  topAt(i: number, x: number, z: number): number {
    const c = this.cosY[i];
    const s = this.sinY[i];
    const rx = x - this.px[i];
    const rz = z - this.pz[i];
    const lx = c * rx - s * rz;
    const lz = s * rx + c * rz;
    if (this.shape[i] === SHAPE_CYL) {
      const a = lx / (this.hx[i] * CYL_R);
      const b = lz / (this.hz[i] * CYL_R);
      if (a * a + b * b > 1) return -Infinity;
      return this.py[i] + this.hy[i];
    }
    if (Math.abs(lx) > this.hx[i] || Math.abs(lz) > this.hz[i]) return -Infinity;
    if (this.shape[i] === SHAPE_WEDGE) {
      return this.py[i] - (this.hy[i] / this.hz[i]) * lz;
    }
    return this.py[i] + this.hy[i];
  }

  // -------------------------------------------------------------------------
  // Broadphase queries
  // -------------------------------------------------------------------------

  /**
   * Nearest static hit along a ray. `accept` filters candidates (soft surfaces,
   * doors, etc). Returns -1 or the brick index; distance in `lastT`,
   * normal in `lastNormal*`.
   */
  lastT = -1;
  lastNx = 0; lastNy = 1; lastNz = 0;

  raycast(
    ox: number, oy: number, oz: number,
    dx: number, dy: number, dz: number,
    maxT: number,
    accept?: (brick: number) => boolean,
  ): number {
    let bestT = maxT;
    let best = -1;
    let bnx = 0, bny = 1, bnz = 0;
    const ids = this.staticIds;
    const prim = this.bvh.raycast(ox, oy, oz, dx, dy, dz, maxT, (p, limit) => {
      const b = ids[p];
      if (accept && !accept(b)) return -1;
      const t = this.hitBrick(b, ox, oy, oz, dx, dy, dz, limit);
      if (t >= 0 && t < bestT) {
        bestT = t; best = b; bnx = _nx; bny = _ny; bnz = _nz;
      }
      return t;
    });
    void prim;
    // Doors are dynamic; a couple of dozen linear tests is cheaper than
    // rebuilding the tree whenever a leaf swings.
    for (let k = 0; k < this.dynamicIds.length; k++) {
      const b = this.dynamicIds[k];
      if (accept && !accept(b)) continue;
      const t = this.hitBrick(b, ox, oy, oz, dx, dy, dz, bestT);
      if (t >= 0 && t < bestT) {
        bestT = t; best = b; bnx = _nx; bny = _ny; bnz = _nz;
      }
    }
    this.lastT = best >= 0 ? bestT : -1;
    this.lastNx = bnx; this.lastNy = bny; this.lastNz = bnz;
    return best;
  }

  /** Every brick along the segment, unsorted, delivered to `visit`. */
  raycastAll(
    ox: number, oy: number, oz: number,
    dx: number, dy: number, dz: number,
    maxT: number,
    visit: (brick: number, t: number, nx: number, ny: number, nz: number) => void,
  ): void {
    const ids = this.staticIds;
    this.bvh.raycastCandidates(ox, oy, oz, dx, dy, dz, maxT, (p) => {
      const b = ids[p];
      const t = this.hitBrick(b, ox, oy, oz, dx, dy, dz, maxT);
      if (t >= 0) visit(b, t, _nx, _ny, _nz);
    });
    for (let k = 0; k < this.dynamicIds.length; k++) {
      const b = this.dynamicIds[k];
      const t = this.hitBrick(b, ox, oy, oz, dx, dy, dz, maxT);
      if (t >= 0) visit(b, t, _nx, _ny, _nz);
    }
  }

  queryBox(
    minx: number, miny: number, minz: number,
    maxx: number, maxy: number, maxz: number,
    visit: (brick: number) => void,
  ): void {
    const ids = this.staticIds;
    this.bvh.queryBox(minx, miny, minz, maxx, maxy, maxz, (p) => visit(ids[p]));
    for (let k = 0; k < this.dynamicIds.length; k++) {
      const b = this.dynamicIds[k];
      const o = b * 6;
      if (this.aabb[o] > maxx || this.aabb[o + 3] < minx) continue;
      if (this.aabb[o + 1] > maxy || this.aabb[o + 4] < miny) continue;
      if (this.aabb[o + 2] > maxz || this.aabb[o + 5] < minz) continue;
      visit(b);
    }
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  private meshes: THREE.InstancedMesh[] = [];
  private materials: THREE.MeshStandardMaterial[] = [];
  private geometries: THREE.BufferGeometry[] = [];

  /** Draw-call and triangle totals for the perf report. */
  stats = { meshes: 0, instances: 0, triangles: 0 };

  buildMeshes(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'brickyard';
    this.materials = buildThreeMaterials();
    const geos = [unitBox(), unitWedge(), unitCylinder()];
    this.geometries = geos;

    // Bucket brick indices by (material, shape).
    const buckets = new Map<number, number[]>();
    for (let i = 0; i < this.count; i++) {
      if (this.flags[i] & BF.INVISIBLE) continue;
      const key = this.mat[i] * 4 + this.shape[i];
      let list = buckets.get(key);
      if (!list) { list = []; buckets.set(key, list); }
      list.push(i);
    }

    this.instanceSlot = new Int32Array(this.count).fill(-1);
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const col = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);

    let groupIndex = 0;
    const keys = [...buckets.keys()].sort((a, b) => a - b);
    for (const key of keys) {
      const list = buckets.get(key)!;
      const matIdx = Math.floor(key / 4);
      const shp = key % 4;
      const def = MATERIALS[matIdx];
      const geo = geos[shp];
      const mesh = new THREE.InstancedMesh(geo, this.materials[matIdx], list.length);
      mesh.name = `bricks:${matIdx}:${shp}`;
      mesh.castShadow = !def.noShadow;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

      for (let k = 0; k < list.length; k++) {
        const i = list[k];
        pos.set(this.px[i], this.py[i], this.pz[i]);
        q.setFromAxisAngle(up, this.yaw[i]);
        scl.set(this.hx[i] * 2, this.hy[i] * 2, this.hz[i] * 2);
        mtx.compose(pos, q, scl);
        mesh.setMatrixAt(k, mtx);
        unpackTint(this.tint[i], col);
        mesh.setColorAt(k, col);
        this.instanceSlot[i] = (groupIndex << 20) | k;
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      group.add(mesh);
      this.meshes.push(mesh);
      this.stats.triangles += (geo.getAttribute('position').count / 3) * list.length;
      this.stats.instances += list.length;
      groupIndex++;
    }
    this.stats.meshes = this.meshes.length;
    return group;
  }

  private _mtx = new THREE.Matrix4();
  private _q = new THREE.Quaternion();
  private _pos = new THREE.Vector3();
  private _scl = new THREE.Vector3();
  private _up = new THREE.Vector3(0, 1, 0);

  /** Pushes a brick's current transform into its InstancedMesh slot. */
  refreshInstance(i: number): void {
    if (!this.instanceSlot) return;
    const slot = this.instanceSlot[i];
    if (slot < 0) return;
    const mesh = this.meshes[slot >>> 20];
    const k = slot & 0xfffff;
    this._pos.set(this.px[i], this.py[i], this.pz[i]);
    this._q.setFromAxisAngle(this._up, this.yaw[i]);
    this._scl.set(this.hx[i] * 2, this.hy[i] * 2, this.hz[i] * 2);
    this._mtx.compose(this._pos, this._q, this._scl);
    mesh.setMatrixAt(k, this._mtx);
    mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    for (const m of this.meshes) m.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.meshes.length = 0;
  }
}

// Module scratch for the last computed normal — avoids per-hit allocation.
let _nx = 0, _ny = 1, _nz = 0;
export function lastNormal(): [number, number, number] {
  return [_nx, _ny, _nz];
}

// ---------------------------------------------------------------------------
// Unit geometry (all shapes are 1×1×1 and scaled per instance)
// ---------------------------------------------------------------------------

function unitBox(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.deleteAttribute('uv');
  return g.toNonIndexed();
}

/** Right-triangular prism: full height at -z, zero at +z. */
function unitWedge(): THREE.BufferGeometry {
  const a = 0.5;
  // Cross-section (z,y): A(-a, a)  B(-a,-a)  C(a,-a)
  const tri = [
    [-a, a], [-a, -a], [a, -a],
  ];
  const verts: number[] = [];
  const push = (x: number, y: number, z: number): void => { verts.push(x, y, z); };
  // Two end caps
  push(-a, tri[0][1], tri[0][0]); push(-a, tri[1][1], tri[1][0]); push(-a, tri[2][1], tri[2][0]);
  push(a, tri[0][1], tri[0][0]); push(a, tri[2][1], tri[2][0]); push(a, tri[1][1], tri[1][0]);
  // Three quads around the prism
  const quad = (i: number, j: number): void => {
    const [z0, y0] = tri[i];
    const [z1, y1] = tri[j];
    push(-a, y0, z0); push(a, y0, z0); push(a, y1, z1);
    push(-a, y0, z0); push(a, y1, z1); push(-a, y1, z1);
  };
  quad(0, 1); quad(1, 2); quad(2, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.computeVertexNormals();
  return g;
}

function unitCylinder(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1, false);
  g.deleteAttribute('uv');
  return g.toNonIndexed();
}

export { SHAPE_BOX, SHAPE_WEDGE, SHAPE_CYL };
