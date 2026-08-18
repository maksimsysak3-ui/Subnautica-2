/**
 * INavigation implementation.
 *
 * Wraps one NavGrid per site plus the cover graph and the room table. Every
 * public method is allocation-light: paths reuse scratch buffers and only the
 * returned Vector3s are new.
 */

import * as THREE from 'three';
import type { CoverPoint, INavigation, NavPath, RoomInfo } from '../core/contracts';
import { Rng } from '../core/math';
import { NavGrid } from './navmesh';
import { CoverGraph } from './cover';
import type { RoomSpec } from './types';
import type { DoorRegistry } from './doors';

const DEFAULT_RADIUS = 0.36;

export class Navigation implements INavigation {
  readonly rooms: RoomInfo[] = [];
  private grids: NavGrid[] = [];
  private cover = new CoverGraph();
  private rng = new Rng('nav');
  private pathScratch: number[] = [];
  private smoothScratch: number[] = [];
  private tmp = { x: 0, y: 0, z: 0 };

  /** Populated after `build`. */
  stats = { nodes: 0, cells: 0, links: 0, coverPoints: 0, navBuildMs: 0, coverBuildMs: 0 };

  constructor(private doors: DoorRegistry | null = null) {}

  addGrid(g: NavGrid): void {
    this.grids.push(g);
  }

  /** Converts authored room specs into the public RoomInfo table. */
  setRooms(specs: RoomSpec[], doorLinks: Array<{ id: number; roomA: number; roomB: number }>): void {
    this.rooms.length = 0;
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      this.rooms.push({
        id: i,
        name: s.name,
        center: new THREE.Vector3((s.minX + s.maxX) / 2, s.minY + 1.6, (s.minZ + s.maxZ) / 2),
        min: new THREE.Vector3(s.minX, s.minY, s.minZ),
        max: new THREE.Vector3(s.maxX, s.maxY, s.maxZ),
        doorIds: [],
        neighbors: [],
        indoors: s.indoors,
        buildingId: s.buildingId,
      });
    }
    for (const d of doorLinks) {
      const a = this.rooms[d.roomA];
      const b = this.rooms[d.roomB];
      if (a) {
        a.doorIds.push(d.id);
        if (b && !a.neighbors.includes(d.roomB)) a.neighbors.push(d.roomB);
      }
      if (b) {
        b.doorIds.push(d.id);
        if (a && !b.neighbors.includes(d.roomA)) b.neighbors.push(d.roomA);
      }
    }
  }

  buildCover(yard: import('./brickyard').Brickyard): void {
    this.cover.build(yard, this.grids);
    let nodes = 0, cells = 0, links = 0, ms = 0;
    for (const g of this.grids) {
      const s = g.stats();
      nodes += s.nodes; cells += s.cells; links += s.links; ms += s.buildMs;
    }
    this.stats = {
      nodes, cells, links,
      coverPoints: this.cover.points.length,
      navBuildMs: ms,
      coverBuildMs: this.cover.stats.buildMs,
    };
  }

  get coverStats() {
    return this.cover.stats;
  }

  private gridAt(x: number, z: number): NavGrid | null {
    for (const g of this.grids) if (g.contains(x, z)) return g;
    return null;
  }

  // -------------------------------------------------------------------------
  // INavigation
  // -------------------------------------------------------------------------

  findPath(from: THREE.Vector3, to: THREE.Vector3, agentRadius = DEFAULT_RADIUS): NavPath {
    const g = this.gridAt(from.x, from.z);
    const g2 = this.gridAt(to.x, to.z);
    if (!g || g !== g2) return { points: [], valid: false, cost: 0 };

    const start = g.nearest(from.x, from.y, from.z, 5, agentRadius);
    const goal = g.nearest(to.x, to.y, to.z, 6, agentRadius);
    if (start < 0 || goal < 0) return { points: [], valid: false, cost: 0 };

    if (!g.findPath(start, goal, agentRadius, this.pathScratch)) {
      return { points: [], valid: false, cost: 0 };
    }
    g.smooth(this.pathScratch, agentRadius, this.smoothScratch);

    const points: THREE.Vector3[] = [];
    let cost = 0;
    let prev: THREE.Vector3 | null = null;
    for (const n of this.smoothScratch) {
      g.positionOf(n, this.tmp);
      const v = new THREE.Vector3(this.tmp.x, this.tmp.y, this.tmp.z);
      if (prev) cost += v.distanceTo(prev);
      points.push(v);
      prev = v;
    }
    // Anchor the ends on the real request so agents do not snap to cell centres.
    if (points.length > 0) {
      points[points.length - 1] = new THREE.Vector3(to.x, points[points.length - 1].y, to.z);
    }
    return { points, valid: points.length > 0, cost };
  }

  nearestNavPoint(p: THREE.Vector3, maxRadius = 6): THREE.Vector3 | null {
    const g = this.gridAt(p.x, p.z);
    if (!g) return null;
    const n = g.nearest(p.x, p.y, p.z, maxRadius, 0);
    if (n < 0) return null;
    g.positionOf(n, this.tmp);
    return new THREE.Vector3(this.tmp.x, this.tmp.y, this.tmp.z);
  }

  isOnNavMesh(p: THREE.Vector3): boolean {
    const g = this.gridAt(p.x, p.z);
    if (!g) return false;
    return g.nodeAt(p.x, p.y, p.z, 0.6) >= 0;
  }

  findCover(near: THREE.Vector3, threatFrom: THREE.Vector3, radius = 14): CoverPoint[] {
    return this.cover.query(near, threatFrom, radius);
  }

  randomPointNear(p: THREE.Vector3, radius: number): THREE.Vector3 | null {
    const g = this.gridAt(p.x, p.z);
    if (!g) return null;
    const n = g.randomNear(p.x, p.y, p.z, radius, this.rng);
    if (n < 0) return null;
    g.positionOf(n, this.tmp);
    return new THREE.Vector3(this.tmp.x, this.tmp.y, this.tmp.z);
  }

  roomAt(p: THREE.Vector3): RoomInfo | null {
    // Prefer the navmesh's per-node room (exact, respects floors), then fall
    // back to a volume test for points off the mesh (mid-air, on furniture).
    const g = this.gridAt(p.x, p.z);
    if (g) {
      const n = g.nodeAt(p.x, p.y, p.z, 2.2);
      if (n >= 0) {
        const r = g.roomOf(n);
        if (r >= 0) return this.rooms[r];
      }
    }
    let best: RoomInfo | null = null;
    let bestVol = Infinity;
    for (const r of this.rooms) {
      if (p.x < r.min.x || p.x > r.max.x) continue;
      if (p.z < r.min.z || p.z > r.max.z) continue;
      if (p.y < r.min.y - 0.6 || p.y > r.max.y + 0.4) continue;
      const vol = (r.max.x - r.min.x) * (r.max.z - r.min.z);
      if (vol < bestVol) { bestVol = vol; best = r; }
    }
    return best;
  }

  /** True when the point is inside any indoor room volume. */
  isIndoors(x: number, y: number, z: number): boolean {
    for (const r of this.rooms) {
      if (!r.indoors) continue;
      if (x < r.min.x || x > r.max.x) continue;
      if (z < r.min.z || z > r.max.z) continue;
      if (y < r.min.y - 0.4 || y > r.max.y + 0.6) continue;
      return true;
    }
    return false;
  }

  /** Doors bordering the room containing `p` — used by clearing behaviour. */
  doorsNear(p: THREE.Vector3): number[] {
    const r = this.roomAt(p);
    if (!r) return [];
    void this.doors;
    return r.doorIds;
  }
}
