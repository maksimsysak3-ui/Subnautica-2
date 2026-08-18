/**
 * Cover graph.
 *
 * Bad cover data makes good AI look stupid, so this is derived from real
 * geometry rather than hand-placed markers: every vertical face of every
 * cover-eligible brick is sampled, and a cover point is emitted wherever an
 * agent standing next to that face would actually be shielded.
 *
 * Each point records the direction it protects *from*, how much of the body it
 * covers, and whether the agent can lean out — and which side to lean, which
 * is what stops AI popping out into the open on the wrong side.
 */

import * as THREE from 'three';
import type { CoverPoint } from '../core/contracts';
import { Brickyard } from './brickyard';
import { BF, SHAPE_BOX } from './types';
import { NavGrid } from './navmesh';

const STANDING = 1.75;
const CROUCH = 1.05;
/** How far out from the face the agent stands. */
const STANDOFF = 0.55;
/** Spacing of samples along a face. */
const SAMPLE = 1.1;

export interface CoverBuildStats {
  points: number;
  full: number;
  low: number;
  peekable: number;
  buildMs: number;
}

/** Spatial hash cell size in metres for cover lookups. */
const BUCKET = 4;

export class CoverGraph {
  readonly points: CoverPoint[] = [];
  stats: CoverBuildStats = { points: 0, full: 0, low: 0, peekable: 0, buildMs: 0 };

  /** Spatial hash for radius queries, keyed by 4 m cells. */
  private hash = new Map<number, number[]>();

  build(yard: Brickyard, grids: NavGrid[]): void {
    const t0 = Date.now();
    this.points.length = 0;
    const seen = new Set<number>();

    for (let b = 0; b < yard.count; b++) {
      const f = yard.flags[b];
      if (f & (BF.NO_COVER | BF.DOOR | BF.NO_NAV | BF.SOFT)) continue;
      if (yard.shape[b] !== SHAPE_BOX) continue;
      const hy = yard.hy[b];
      if (hy < 0.28) continue;                    // too thin to hide behind
      const top = yard.py[b] + hy;
      const bottom = yard.py[b] - hy;
      const hx = yard.hx[b], hz = yard.hz[b];
      if (hx < 0.2 && hz < 0.2) continue;          // posts and railings
      if (hx * hz > 260) continue;                 // ground slabs

      const c = yard.cosY[b], s = yard.sinY[b];
      // Four faces in local space: +x, -x, +z, -z.
      for (let face = 0; face < 4; face++) {
        const alongX = face >= 2;
        const halfLen = alongX ? hx : hz;
        const depth = alongX ? hz : hx;
        if (halfLen < 0.3) continue;
        const sign = face % 2 === 0 ? 1 : -1;
        // Outward normal in local space.
        const nlx = alongX ? 0 : sign;
        const nlz = alongX ? sign : 0;
        // World normal.
        const nx = c * nlx + s * nlz;
        const nz = -s * nlx + c * nlz;
        // Tangent along the face.
        const tlx = alongX ? 1 : 0;
        const tlz = alongX ? 0 : 1;
        const tx = c * tlx + s * tlz;
        const tz = -s * tlx + c * tlz;

        const n = Math.max(1, Math.round((halfLen * 2) / SAMPLE));
        for (let k = 0; k < n; k++) {
          const along = ((k + 0.5) / n - 0.5) * halfLen * 2;
          const fx = yard.px[b] + nx * (depth + STANDOFF) + tx * along;
          const fz = yard.pz[b] + nz * (depth + STANDOFF) + tz * along;

          // Must be somewhere an agent can actually stand.
          let node = -1;
          let grid: NavGrid | null = null;
          for (const g of grids) {
            if (!g.contains(fx, fz)) continue;
            const nd = g.nodeAt(fx, bottom + 0.2, fz, Math.max(0.9, hy));
            if (nd >= 0) { node = nd; grid = g; break; }
          }
          if (node < 0 || !grid) continue;
          const footY = grid.nodeY[node];
          if (grid.nodeClearance[node] < 0.34) continue;
          const shield = top - footY;
          if (shield < 0.55 || shield > 3.2) continue;
          // The cover has to be in front of the agent, not under their feet.
          if (bottom > footY + 0.6) continue;

          const key = coverKey(fx, footY, fz, nx, nz);
          if (seen.has(key)) continue;
          seen.add(key);

          // Peekability: an agent can lean out if the face ends within reach.
          const distToEndA = halfLen - along;
          const distToEndB = halfLen + along;
          const nearEnd = Math.min(distToEndA, distToEndB);
          const peekable = nearEnd < 1.4 || shield < CROUCH + 0.35;
          let peekSide = 0;
          if (nearEnd < 1.4) peekSide = distToEndA < distToEndB ? 1 : -1;

          this.points.push({
            position: new THREE.Vector3(fx, footY, fz),
            facing: new THREE.Vector3(nx, 0, nz),
            height: Math.min(1, Math.max(0, (shield - CROUCH) / (STANDING - CROUCH))),
            peekable,
            peekSide,
            claimedBy: -1,
          });
        }
      }
    }

    this.rebuildHash();
    this.stats = {
      points: this.points.length,
      full: this.points.filter((p) => p.height >= 0.75).length,
      low: this.points.filter((p) => p.height < 0.4).length,
      peekable: this.points.filter((p) => p.peekable).length,
      buildMs: Date.now() - t0,
    };
  }

  private rebuildHash(): void {
    this.hash.clear();
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      const k = bucketKey(p.position.x, p.position.z);
      let list = this.hash.get(k);
      if (!list) { list = []; this.hash.set(k, list); }
      list.push(i);
    }
  }

  /**
   * Cover near `near` that protects from `threatFrom`, best first.
   * Score rewards facing the threat, being close, and full-height cover.
   */
  query(near: THREE.Vector3, threatFrom: THREE.Vector3, radius: number, limit = 12): CoverPoint[] {
    const tdx = threatFrom.x - near.x;
    const tdz = threatFrom.z - near.z;
    const tl = Math.hypot(tdx, tdz) || 1;
    const tx = tdx / tl, tz = tdz / tl;

    const r = Math.ceil(radius / BUCKET);
    const bi = Math.floor(near.x / BUCKET);
    const bj = Math.floor(near.z / BUCKET);
    const scored: Array<{ p: CoverPoint; s: number }> = [];
    const r2 = radius * radius;

    for (let j = -r; j <= r; j++) {
      for (let i = -r; i <= r; i++) {
        const list = this.hash.get(((bi + i) & 0xffff) | (((bj + j) & 0xffff) << 16));
        if (!list) continue;
        for (const idx of list) {
          const p = this.points[idx];
          const dx = p.position.x - near.x;
          const dy = p.position.y - near.y;
          const dz = p.position.z - near.z;
          if (Math.abs(dy) > 3.5) continue;
          const d2 = dx * dx + dz * dz;
          if (d2 > r2) continue;
          // Cover faces the threat when its outward normal points at it.
          const align = p.facing.x * tx + p.facing.z * tz;
          if (align < 0.15) continue;
          const s = align * 2.2 + p.height * 1.1 - Math.sqrt(d2) / radius + (p.peekable ? 0.35 : 0)
            - (p.claimedBy >= 0 ? 2.5 : 0);
          scored.push({ p, s });
        }
      }
    }
    scored.sort((a, b) => b.s - a.s);
    return scored.slice(0, limit).map((e) => e.p);
  }
}

function bucketKey(x: number, z: number): number {
  const i = Math.floor(x / BUCKET) & 0xffff;
  const j = Math.floor(z / BUCKET) & 0xffff;
  return i | (j << 16);
}

/** Quantised dedup key: 0.7 m in XZ, 1 m in Y, 8 facing octants. */
function coverKey(x: number, y: number, z: number, nx: number, nz: number): number {
  const qx = Math.round(x / 0.7) & 0x3ff;
  const qz = Math.round(z / 0.7) & 0x3ff;
  const qy = Math.round(y) & 0x3f;
  const oct = (Math.round((Math.atan2(nz, nx) / Math.PI) * 4) + 8) & 7;
  return qx | (qz << 10) | (qy << 20) | (oct << 26);
}
