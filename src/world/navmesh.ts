/**
 * Walkable-surface extraction and pathfinding.
 *
 * The navmesh is derived from the *same bricks* the renderer and the collision
 * system use, so it can never disagree with what the player can see or walk on.
 *
 *   1. Rasterise every nav-relevant brick into per-cell solid spans, using the
 *      exact `topAt` of the primitive (so wedges ramp and cylinders are round).
 *   2. Merge spans per cell; the top of each merged span is a floor candidate.
 *   3. Keep candidates with enough headroom for a standing agent. Multi-storey
 *      buildings drop out of this for free: a cell under the first floor and a
 *      cell on top of it are two different nodes in the same column.
 *   4. Connect neighbours within a step height. Stairs connect because the
 *      steps really are 0.19 m apart; doorways connect because door leaves are
 *      flagged NO_NAV and never rasterised.
 *   5. Compute a clearance field so `agentRadius` can be honoured without
 *      rebuilding anything.
 */

import { Rng } from '../core/math';
import { Brickyard } from './brickyard';
import { BF } from './types';
import type { RoomSpec, NavLink } from './types';

export const CELL = 0.4;
const AGENT_HEIGHT = 1.85;
const MAX_STEP = 0.46;
/** Ignore floor candidates below this thickness of clear space. */
const MAX_SPANS_PER_CELL = 12;

export interface NavGridBounds {
  minX: number; maxX: number; minZ: number; maxZ: number;
  minY: number; maxY: number;
}

export class NavGrid {
  readonly minX: number;
  readonly minZ: number;
  readonly nx: number;
  readonly nz: number;
  readonly maxX: number;
  readonly maxZ: number;

  /** Nodes, ordered by cell so a cell's nodes are contiguous. */
  nodeY!: Float32Array;
  nodeCell!: Int32Array;
  nodeRoom!: Int16Array;
  nodeClearance!: Float32Array;
  nodeCount = 0;

  private cellStart!: Int32Array;
  private cellCount!: Uint8Array;

  /** Authored links (ladders) as node-index pairs with a cost penalty. */
  linkFrom: Int32Array = new Int32Array(0);
  linkTo: Int32Array = new Int32Array(0);
  linkCost: Float32Array = new Float32Array(0);
  private linkStart!: Int32Array;
  private linkCountArr!: Int32Array;

  // A* scratch, sized once.
  private gScore!: Float32Array;
  private fScore!: Float32Array;
  private cameFrom!: Int32Array;
  private stamp!: Int32Array;
  private closedStamp!: Int32Array;
  private heap!: Int32Array;
  private heapSize = 0;
  private stampCounter = 0;

  buildMs = 0;

  constructor(readonly bounds: NavGridBounds) {
    this.minX = bounds.minX;
    this.minZ = bounds.minZ;
    this.maxX = bounds.maxX;
    this.maxZ = bounds.maxZ;
    this.nx = Math.ceil((bounds.maxX - bounds.minX) / CELL);
    this.nz = Math.ceil((bounds.maxZ - bounds.minZ) / CELL);
  }

  contains(x: number, z: number): boolean {
    return x >= this.minX && x < this.maxX && z >= this.minZ && z < this.maxZ;
  }

  cellOf(x: number, z: number): number {
    const i = Math.floor((x - this.minX) / CELL);
    const j = Math.floor((z - this.minZ) / CELL);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return -1;
    return j * this.nx + i;
  }

  cellCenterX(cell: number): number {
    return this.minX + ((cell % this.nx) + 0.5) * CELL;
  }

  cellCenterZ(cell: number): number {
    return this.minZ + (Math.floor(cell / this.nx) + 0.5) * CELL;
  }

  // -------------------------------------------------------------------------
  // Build
  // -------------------------------------------------------------------------

  build(
    yard: Brickyard,
    groundHeight: (x: number, z: number) => number,
    rooms: RoomSpec[],
    links: NavLink[],
  ): void {
    const t0 = Date.now();
    const nCells = this.nx * this.nz;

    // --- pass 1: count spans per cell ---------------------------------------
    const counts = new Int32Array(nCells + 1);
    const stampCell = (cell: number): void => { counts[cell]++; };
    this.forEachBrickCell(yard, (cell) => stampCell(cell));
    for (let c = 0; c < nCells; c++) counts[c]++; // terrain span

    // --- prefix sum ---------------------------------------------------------
    const start = new Int32Array(nCells + 1);
    let acc = 0;
    for (let c = 0; c < nCells; c++) { start[c] = acc; acc += counts[c]; }
    start[nCells] = acc;

    const spanLo = new Float32Array(acc);
    const spanHi = new Float32Array(acc);
    const spanWalk = new Uint8Array(acc);
    const cursor = start.slice(0, nCells);

    // Terrain first.
    for (let c = 0; c < nCells; c++) {
      const h = groundHeight(this.cellCenterX(c), this.cellCenterZ(c));
      const k = cursor[c]++;
      spanLo[k] = -1000;
      spanHi[k] = h;
      spanWalk[k] = 1;
    }
    // Then bricks.
    this.forEachBrickCell(yard, (cell, brick, top) => {
      const k = cursor[cell]++;
      spanLo[k] = yard.py[brick] - yard.hy[brick];
      spanHi[k] = top;
      spanWalk[k] = (yard.flags[brick] & BF.NO_WALK) ? 0 : 1;
    });

    // --- pass 2: merge spans, emit nodes ------------------------------------
    const nodeY: number[] = [];
    const nodeCell: number[] = [];
    this.cellStart = new Int32Array(nCells);
    this.cellCount = new Uint8Array(nCells);

    const lo = new Float64Array(MAX_SPANS_PER_CELL * 4);
    const hi = new Float64Array(MAX_SPANS_PER_CELL * 4);
    const wk = new Uint8Array(MAX_SPANS_PER_CELL * 4);

    for (let c = 0; c < nCells; c++) {
      const s = start[c];
      const e = start[c + 1];
      let n = 0;
      for (let i = s; i < e && n < lo.length; i++) {
        // Insertion sort by bottom as we copy — counts per cell are tiny.
        let j = n++;
        const l = spanLo[i], h = spanHi[i], w = spanWalk[i];
        while (j > 0 && lo[j - 1] > l) { lo[j] = lo[j - 1]; hi[j] = hi[j - 1]; wk[j] = wk[j - 1]; j--; }
        lo[j] = l; hi[j] = h; wk[j] = w;
      }
      // Merge overlapping/touching spans.
      let m = 0;
      for (let i = 0; i < n; i++) {
        if (m > 0 && lo[i] <= hi[m - 1] + 0.02) {
          if (hi[i] > hi[m - 1]) { hi[m - 1] = hi[i]; wk[m - 1] = wk[i]; }
        } else {
          lo[m] = lo[i]; hi[m] = hi[i]; wk[m] = wk[i];
          m++;
        }
      }
      this.cellStart[c] = nodeY.length;
      let emitted = 0;
      for (let i = 0; i < m; i++) {
        if (!wk[i]) continue;
        const headroom = i + 1 < m ? lo[i + 1] - hi[i] : Infinity;
        if (headroom < AGENT_HEIGHT) continue;
        if (emitted >= 255) break;
        nodeY.push(hi[i]);
        nodeCell.push(c);
        emitted++;
      }
      this.cellCount[c] = emitted;
    }

    this.nodeCount = nodeY.length;
    this.nodeY = Float32Array.from(nodeY);
    this.nodeCell = Int32Array.from(nodeCell);
    this.nodeRoom = new Int16Array(this.nodeCount).fill(-1);
    this.nodeClearance = new Float32Array(this.nodeCount);

    this.computeClearance();
    this.assignRooms(rooms);
    this.buildLinks(links);

    this.gScore = new Float32Array(this.nodeCount);
    this.fScore = new Float32Array(this.nodeCount);
    this.cameFrom = new Int32Array(this.nodeCount);
    this.stamp = new Int32Array(this.nodeCount);
    this.closedStamp = new Int32Array(this.nodeCount);
    this.heap = new Int32Array(Math.max(64, this.nodeCount));
    this.buildMs = Date.now() - t0;
  }

  /** Visits every (cell, brick, top) pair a nav-relevant brick covers. */
  private forEachBrickCell(
    yard: Brickyard,
    visit: (cell: number, brick: number, top: number) => void,
  ): void {
    for (let b = 0; b < yard.count; b++) {
      const f = yard.flags[b];
      if (f & (BF.NO_NAV | BF.DOOR)) continue;
      const o = b * 6;
      const ax = yard.aabb[o], az = yard.aabb[o + 2];
      const bx = yard.aabb[o + 3], bz = yard.aabb[o + 5];
      if (bx < this.minX || ax > this.maxX || bz < this.minZ || az > this.maxZ) continue;
      let i0 = Math.floor((ax - this.minX) / CELL);
      let i1 = Math.floor((bx - this.minX) / CELL);
      let j0 = Math.floor((az - this.minZ) / CELL);
      let j1 = Math.floor((bz - this.minZ) / CELL);
      if (i0 < 0) i0 = 0;
      if (j0 < 0) j0 = 0;
      if (i1 >= this.nx) i1 = this.nx - 1;
      if (j1 >= this.nz) j1 = this.nz - 1;
      for (let j = j0; j <= j1; j++) {
        const cz = this.minZ + (j + 0.5) * CELL;
        for (let i = i0; i <= i1; i++) {
          const cx = this.minX + (i + 0.5) * CELL;
          const top = yard.topAt(b, cx, cz);
          if (top === -Infinity) continue;
          visit(j * this.nx + i, b, top);
        }
      }
    }
  }

  /**
   * Distance (in metres) from every node to the nearest edge of walkable
   * space. Multi-source BFS on the node graph, seeded from nodes that have a
   * missing orthogonal neighbour.
   */
  private computeClearance(): void {
    const dist = this.nodeClearance;
    dist.fill(Infinity);
    const queue = new Int32Array(this.nodeCount);
    let qh = 0, qt = 0;
    for (let n = 0; n < this.nodeCount; n++) {
      if (this.isBorder(n)) { dist[n] = 0; queue[qt++] = n; }
    }
    while (qh < qt) {
      const n = queue[qh++];
      const d = dist[n] + CELL;
      const cell = this.nodeCell[n];
      const i = cell % this.nx;
      const j = (cell / this.nx) | 0;
      for (let k = 0; k < 4; k++) {
        const ni = i + ORTHO[k * 2];
        const nj = j + ORTHO[k * 2 + 1];
        if (ni < 0 || nj < 0 || ni >= this.nx || nj >= this.nz) continue;
        const nc = nj * this.nx + ni;
        const s = this.cellStart[nc];
        const cnt = this.cellCount[nc];
        for (let m = 0; m < cnt; m++) {
          const nn = s + m;
          if (Math.abs(this.nodeY[nn] - this.nodeY[n]) > MAX_STEP) continue;
          if (d < dist[nn]) { dist[nn] = d; if (qt < queue.length) queue[qt++] = nn; }
        }
      }
    }
    for (let n = 0; n < this.nodeCount; n++) if (!isFinite(dist[n])) dist[n] = 8;
  }

  private isBorder(n: number): boolean {
    const cell = this.nodeCell[n];
    const i = cell % this.nx;
    const j = (cell / this.nx) | 0;
    const y = this.nodeY[n];
    for (let k = 0; k < 4; k++) {
      const ni = i + ORTHO[k * 2];
      const nj = j + ORTHO[k * 2 + 1];
      if (ni < 0 || nj < 0 || ni >= this.nx || nj >= this.nz) return true;
      const nc = nj * this.nx + ni;
      const s = this.cellStart[nc];
      const cnt = this.cellCount[nc];
      let ok = false;
      for (let m = 0; m < cnt; m++) {
        if (Math.abs(this.nodeY[s + m] - y) <= MAX_STEP) { ok = true; break; }
      }
      if (!ok) return true;
    }
    return false;
  }

  private assignRooms(rooms: RoomSpec[]): void {
    for (let r = 0; r < rooms.length; r++) {
      const room = rooms[r];
      let i0 = Math.floor((room.minX - this.minX) / CELL);
      let i1 = Math.floor((room.maxX - this.minX) / CELL);
      let j0 = Math.floor((room.minZ - this.minZ) / CELL);
      let j1 = Math.floor((room.maxZ - this.minZ) / CELL);
      if (i1 < 0 || j1 < 0 || i0 >= this.nx || j0 >= this.nz) continue;
      if (i0 < 0) i0 = 0;
      if (j0 < 0) j0 = 0;
      if (i1 >= this.nx) i1 = this.nx - 1;
      if (j1 >= this.nz) j1 = this.nz - 1;
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const c = j * this.nx + i;
          const s = this.cellStart[c];
          for (let m = 0; m < this.cellCount[c]; m++) {
            const n = s + m;
            const y = this.nodeY[n];
            if (y >= room.minY - 0.45 && y <= room.maxY - 0.4) this.nodeRoom[n] = r;
          }
        }
      }
    }
  }

  private buildLinks(links: NavLink[]): void {
    const from: number[] = [];
    const to: number[] = [];
    const cost: number[] = [];
    for (const l of links) {
      const a = this.nodeAt(l.ax, l.ay, l.az, 1.2);
      const b = this.nodeAt(l.bx, l.by, l.bz, 1.2);
      if (a < 0 || b < 0) continue;
      const d = Math.abs(l.by - l.ay) + l.penalty;
      from.push(a); to.push(b); cost.push(d);
      if (l.bidirectional) { from.push(b); to.push(a); cost.push(d); }
    }
    // Bucket by source node for O(1) lookup during A*.
    this.linkStart = new Int32Array(this.nodeCount + 1);
    for (const f of from) this.linkStart[f + 1]++;
    for (let i = 1; i <= this.nodeCount; i++) this.linkStart[i] += this.linkStart[i - 1];
    this.linkCountArr = new Int32Array(this.nodeCount);
    this.linkFrom = new Int32Array(from.length);
    this.linkTo = new Int32Array(from.length);
    this.linkCost = new Float32Array(from.length);
    for (let k = 0; k < from.length; k++) {
      const f = from[k];
      const idx = this.linkStart[f] + this.linkCountArr[f]++;
      this.linkFrom[idx] = f;
      this.linkTo[idx] = to[k];
      this.linkCost[idx] = cost[k];
    }
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  /** Node in the column at (x,z) closest to `y`, within `tolerance`. */
  nodeAt(x: number, y: number, z: number, tolerance = 1.0): number {
    const c = this.cellOf(x, z);
    if (c < 0) return -1;
    const s = this.cellStart[c];
    let best = -1;
    let bestD = tolerance;
    for (let m = 0; m < this.cellCount[c]; m++) {
      const d = Math.abs(this.nodeY[s + m] - y);
      if (d < bestD) { bestD = d; best = s + m; }
    }
    return best;
  }

  /** Nearest node by expanding ring search. */
  nearest(x: number, y: number, z: number, maxRadius = 6, minClearance = 0): number {
    const ci = Math.floor((x - this.minX) / CELL);
    const cj = Math.floor((z - this.minZ) / CELL);
    const maxR = Math.ceil(maxRadius / CELL);
    let best = -1;
    let bestScore = Infinity;
    for (let r = 0; r <= maxR; r++) {
      let found = false;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (r > 0 && Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = ci + di, j = cj + dj;
          if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) continue;
          const c = j * this.nx + i;
          const s = this.cellStart[c];
          for (let m = 0; m < this.cellCount[c]; m++) {
            const n = s + m;
            if (this.nodeClearance[n] < minClearance) continue;
            const dx = this.cellCenterX(c) - x;
            const dz = this.cellCenterZ(c) - z;
            const dy = (this.nodeY[n] - y) * 2.5;
            const score = dx * dx + dy * dy + dz * dz;
            if (score < bestScore) { bestScore = score; best = n; found = true; }
          }
        }
      }
      // One extra ring after the first hit so we do not settle for a corner.
      if (found) break;
    }
    return best;
  }

  roomOf(n: number): number {
    return n >= 0 && n < this.nodeCount ? this.nodeRoom[n] : -1;
  }

  positionOf(n: number, out: { x: number; y: number; z: number }): void {
    const c = this.nodeCell[n];
    out.x = this.cellCenterX(c);
    out.y = this.nodeY[n];
    out.z = this.cellCenterZ(c);
  }

  // -------------------------------------------------------------------------
  // A*
  // -------------------------------------------------------------------------

  /** Returns the node path (start→goal) or null. Reused scratch, no allocation. */
  findPath(startNode: number, goalNode: number, agentRadius: number, out: number[]): boolean {
    out.length = 0;
    if (startNode < 0 || goalNode < 0) return false;
    if (startNode === goalNode) { out.push(startNode); return true; }

    const stampId = ++this.stampCounter;
    this.heapSize = 0;
    this.gScore[startNode] = 0;
    this.stamp[startNode] = stampId;
    this.cameFrom[startNode] = -1;
    this.fScore[startNode] = this.heuristic(startNode, goalNode);
    this.heapPush(startNode);

    const gx = this.cellCenterX(this.nodeCell[goalNode]);
    const gz = this.cellCenterZ(this.nodeCell[goalNode]);
    const gy = this.nodeY[goalNode];
    void gx; void gz; void gy;

    let guard = 0;
    const maxExpansions = 200000;
    while (this.heapSize > 0 && guard++ < maxExpansions) {
      const cur = this.heapPop();
      if (cur === goalNode) {
        let n = cur;
        while (n >= 0) { out.push(n); n = this.cameFrom[n]; }
        out.reverse();
        return true;
      }
      if (this.closedStamp[cur] === stampId) continue;
      this.closedStamp[cur] = stampId;

      const cell = this.nodeCell[cur];
      const i = cell % this.nx;
      const j = (cell / this.nx) | 0;
      const cy = this.nodeY[cur];

      for (let k = 0; k < 8; k++) {
        const di = NEIGH[k * 2];
        const dj = NEIGH[k * 2 + 1];
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= this.nx || nj >= this.nz) continue;
        // No corner cutting: a diagonal needs both orthogonal cells passable.
        if (di !== 0 && dj !== 0) {
          if (!this.columnHasNear(j * this.nx + ni, cy, agentRadius)) continue;
          if (!this.columnHasNear(nj * this.nx + i, cy, agentRadius)) continue;
        }
        const nc = nj * this.nx + ni;
        const s = this.cellStart[nc];
        for (let m = 0; m < this.cellCount[nc]; m++) {
          const nn = s + m;
          const dy = this.nodeY[nn] - cy;
          if (Math.abs(dy) > MAX_STEP) continue;
          if (this.nodeClearance[nn] < agentRadius) continue;
          const step = (di !== 0 && dj !== 0 ? 1.4142 : 1) * CELL + Math.abs(dy) * 2.0;
          this.relax(cur, nn, step, goalNode, stampId);
        }
      }
      // Authored links (ladders).
      const ls = this.linkStart[cur];
      const le = this.linkStart[cur] + this.linkCountArr[cur];
      for (let k = ls; k < le; k++) {
        this.relax(cur, this.linkTo[k], this.linkCost[k], goalNode, stampId);
      }
    }
    return false;
  }

  private relax(cur: number, nn: number, step: number, goalNode: number, stampId: number): void {
    const tentative = this.gScore[cur] + step;
    if (this.stamp[nn] !== stampId) {
      this.stamp[nn] = stampId;
      this.gScore[nn] = Infinity;
      this.cameFrom[nn] = -1;
    }
    if (tentative < this.gScore[nn]) {
      this.gScore[nn] = tentative;
      this.cameFrom[nn] = cur;
      this.fScore[nn] = tentative + this.heuristic(nn, goalNode);
      this.heapPush(nn);
    }
  }

  private columnHasNear(cell: number, y: number, agentRadius: number): boolean {
    const s = this.cellStart[cell];
    for (let m = 0; m < this.cellCount[cell]; m++) {
      const n = s + m;
      if (Math.abs(this.nodeY[n] - y) <= MAX_STEP && this.nodeClearance[n] >= agentRadius) return true;
    }
    return false;
  }

  private heuristic(a: number, b: number): number {
    const ca = this.nodeCell[a], cb = this.nodeCell[b];
    const dx = (ca % this.nx) - (cb % this.nx);
    const dz = ((ca / this.nx) | 0) - ((cb / this.nx) | 0);
    const dy = this.nodeY[a] - this.nodeY[b];
    return Math.hypot(dx * CELL, dz * CELL) + Math.abs(dy) * 1.4;
  }

  private heapPush(n: number): void {
    if (this.heapSize >= this.heap.length) {
      const bigger = new Int32Array(this.heap.length * 2);
      bigger.set(this.heap);
      this.heap = bigger;
    }
    let i = this.heapSize++;
    this.heap[i] = n;
    const f = this.fScore;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (f[this.heap[parent]] <= f[this.heap[i]]) break;
      const t = this.heap[parent]; this.heap[parent] = this.heap[i]; this.heap[i] = t;
      i = parent;
    }
  }

  private heapPop(): number {
    const top = this.heap[0];
    this.heap[0] = this.heap[--this.heapSize];
    const f = this.fScore;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let smallest = i;
      if (l < this.heapSize && f[this.heap[l]] < f[this.heap[smallest]]) smallest = l;
      if (r < this.heapSize && f[this.heap[r]] < f[this.heap[smallest]]) smallest = r;
      if (smallest === i) break;
      const t = this.heap[smallest]; this.heap[smallest] = this.heap[i]; this.heap[i] = t;
      i = smallest;
    }
    return top;
  }

  /**
   * Straightens a node path by dropping waypoints that a straight walk can
   * bridge. Keeps corners where the floor height changes (stairs) so agents do
   * not shortcut through a stairwell wall.
   */
  smooth(nodes: number[], agentRadius: number, out: number[]): void {
    out.length = 0;
    if (nodes.length === 0) return;
    let anchor = 0;
    out.push(nodes[0]);
    for (let i = 2; i < nodes.length; i++) {
      if (!this.walkableLine(nodes[anchor], nodes[i], agentRadius)) {
        anchor = i - 1;
        out.push(nodes[anchor]);
      }
    }
    out.push(nodes[nodes.length - 1]);
  }

  private walkableLine(a: number, b: number, agentRadius: number): boolean {
    const ax = this.cellCenterX(this.nodeCell[a]), az = this.cellCenterZ(this.nodeCell[a]);
    const bx = this.cellCenterX(this.nodeCell[b]), bz = this.cellCenterZ(this.nodeCell[b]);
    const ay = this.nodeY[a], by = this.nodeY[b];
    const dist = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.ceil(dist / (CELL * 0.75)));
    let prevY = ay;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const yGuess = ay + (by - ay) * t;
      const c = this.cellOf(x, z);
      if (c < 0) return false;
      const st = this.cellStart[c];
      let ok = false;
      for (let m = 0; m < this.cellCount[c]; m++) {
        const n = st + m;
        if (this.nodeClearance[n] < agentRadius) continue;
        if (Math.abs(this.nodeY[n] - yGuess) > 0.6) continue;
        if (Math.abs(this.nodeY[n] - prevY) > MAX_STEP) continue;
        prevY = this.nodeY[n];
        ok = true;
        break;
      }
      if (!ok) return false;
    }
    return true;
  }

  /** A random walkable node within `radius` of a point. */
  randomNear(x: number, y: number, z: number, radius: number, rng: Rng, agentRadius = 0.35): number {
    const r = Math.ceil(radius / CELL);
    const ci = Math.floor((x - this.minX) / CELL);
    const cj = Math.floor((z - this.minZ) / CELL);
    for (let attempt = 0; attempt < 48; attempt++) {
      const i = ci + rng.int(-r, r + 1);
      const j = cj + rng.int(-r, r + 1);
      if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) continue;
      const c = j * this.nx + i;
      const cnt = this.cellCount[c];
      if (cnt === 0) continue;
      const n = this.cellStart[c] + rng.int(0, cnt);
      if (this.nodeClearance[n] < agentRadius) continue;
      if (Math.abs(this.nodeY[n] - y) > 6) continue;
      return n;
    }
    return -1;
  }

  stats(): { cells: number; nodes: number; links: number; buildMs: number } {
    return {
      cells: this.nx * this.nz,
      nodes: this.nodeCount,
      links: this.linkTo.length,
      buildMs: this.buildMs,
    };
  }
}

const ORTHO = new Int8Array([1, 0, -1, 0, 0, 1, 0, -1]);
const NEIGH = new Int8Array([1, 0, -1, 0, 0, 1, 0, -1, 1, 1, 1, -1, -1, 1, -1, -1]);
