/**
 * The work on an industry's harvest area: tractors and combines on a farm,
 * forwarders in a forest, haul trucks across a mine, and people on foot among
 * them.
 *
 * Scenery in the sense the ships and the aircraft are -- what an area yields is
 * the industry model's -- but an area with nothing moving on it is a coloured
 * patch, and the player asked for the land to be worked. So each area is cut
 * into passes the way a field is actually worked: parallel runs sixteen metres
 * apart across the drawn polygon, and each vehicle drives them in turn, up one
 * and down the next. On the simulation's clock, so a paused city holds still.
 */

import type { World } from '../world';
import { paintPoly, WORKED_KIND } from '../worked';

/** One pass across an area: its two ends, in metres. */
interface Run { ax: number; az: number; bx: number; bz: number; len: number }

interface Area {
  kind: string;
  runs: Run[];
  /** Seconds at the start of each run in the cycle, and the whole cycle. */
  starts: number[];
  cycle: number;
  vehicles: number;
  walkers: number;
}

/** Metres between passes, and the least worth driving. */
const PASS = 16;
const MIN_RUN = 32;
/** Working speeds, metres a second: a combine cutting, a truck hauling, a person walking. */
const SPEED: Record<string, number> = { fertile: 3.2, forest: 2.6, ore: 5.5, stone: 5.0, oil: 4.0 };
const WALK = 1.1;
/** What drives each kind of land, in turn. */
const FLEET: Record<string, readonly string[]> = {
  fertile: ['combine', 'tractor', 'tractor'],
  forest: ['forwarder'],
  ore: ['haul'],
  stone: ['haul'],
  oil: ['lorry'],
};

const CELL = 8;

export class AreaWork {
  private areas: Area[] = [];

  /** Re-reads the areas from the world. A few thousand cells; runs on a road or area change. */
  plan(world: World): void {
    const g = world.grid, half = g / 2;
    const out: Area[] = [];
    world.industry.hqs.forEach((hq, h) => {
      if (WORKED_KIND[hq.kind] === undefined || hq.area.length < 6) return;
      const mask = new Uint8Array(g * g);
      paintPoly(mask, g, hq.area, 1);
      // Passes run along whichever way the area is longer, so a long strip is
      // worked end to end rather than across its width.
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let k = 0; k + 1 < hq.area.length; k += 2) {
        x0 = Math.min(x0, hq.area[k]); x1 = Math.max(x1, hq.area[k]);
        z0 = Math.min(z0, hq.area[k + 1]); z1 = Math.max(z1, hq.area[k + 1]);
      }
      const alongX = x1 - x0 >= z1 - z0;
      const at = (a: number, b: number): number => (alongX ? b * g + a : a * g + b);
      const runs: Run[] = [];
      const step = PASS / CELL;
      let cells = 0;
      for (let i = 0; i < mask.length; i++) cells += mask[i];
      for (let b = 0; b < g; b += step) {
        let start = -1;
        for (let a = 0; a <= g; a++) {
          const on = a < g && mask[at(a, b)] === 1;
          if (on && start < 0) start = a;
          if (!on && start >= 0) {
            const len = (a - start) * CELL;
            if (len >= MIN_RUN) {
              const p0 = (start - half + 0.5) * CELL + 4, p1 = (a - half - 0.5) * CELL - 4;
              const q = (b - half + 0.5) * CELL;
              runs.push(alongX
                ? { ax: p0, az: q, bx: p1, bz: q, len: p1 - p0 }
                : { ax: q, az: p0, bx: q, bz: p1, len: p1 - p0 });
            }
            start = -1;
          }
        }
      }
      if (runs.length === 0) return;
      const speed = SPEED[hq.kind] ?? 3;
      const starts: number[] = [];
      let t = 0;
      for (const r of runs) { starts.push(t); t += r.len / speed; }
      // One vehicle per ten hectares or so, at least two, at most eight.
      const ha = (cells * CELL * CELL) / 10000;
      out.push({
        kind: hq.kind, runs, starts, cycle: t,
        vehicles: Math.max(2, Math.min(8, Math.round(ha / 10))),
        walkers: Math.max(2, Math.min(10, Math.round(ha / 7))) + (h % 2),
      });
    });
    this.areas = out;
  }

  get count(): number { return this.areas.length; }

  /**
   * Everything working the areas now, handed to `draw` as a seat, world x, z
   * and heading. A person comes as seat 'walker' with who they are and how far
   * they have walked, so the caller can pick the figure and the stride the way
   * the pavement's are picked.
   */
  each(seconds: number, draw: (seat: string, x: number, z: number, yaw: number, who: number, walked: number) => void): void {
    for (let n = 0; n < this.areas.length; n++) {
      const a = this.areas[n];
      const fleet = FLEET[a.kind] ?? ['tractor'];
      const speed = SPEED[a.kind] ?? 3;
      for (let k = 0; k < a.vehicles; k++) {
        const p = this.where(a, seconds + (k / a.vehicles) * a.cycle + n * 13.7);
        draw(fleet[k % fleet.length], p[0], p[1], p[2], -1, 0);
      }
      // People on foot, along the passes at a walk: the gang behind the
      // machines, the forester marking trees, the surveyor on the bench.
      for (let k = 0; k < a.walkers; k++) {
        const t = seconds * (WALK / speed) + (k / a.walkers) * a.cycle + n * 29.3 + k * 3.1;
        const p = this.where(a, t);
        // A few metres off the pass, so a person is beside the work, not in it.
        const off = ((k % 3) - 1) * 5;
        draw('walker', p[0] - Math.sin(p[2]) * off, p[1] + Math.cos(p[2]) * off, p[2], k + n * 17, seconds * WALK + k);
      }
    }
  }

  /** Where a thing working an area is at `t` seconds into its cycle: x, z, heading. */
  private readonly out: [number, number, number] = [0, 0, 0];
  private where(a: Area, t: number): [number, number, number] {
    const c = ((t % a.cycle) + a.cycle) % a.cycle;
    // The run it is on: the last start at or before now.
    let lo = 0, hi = a.starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (a.starts[mid] <= c) lo = mid; else hi = mid - 1;
    }
    const r = a.runs[lo];
    const next = lo + 1 < a.starts.length ? a.starts[lo + 1] : a.cycle;
    let f = (c - a.starts[lo]) / Math.max(1e-6, next - a.starts[lo]);
    // Up one pass and back down the next.
    const back = (lo & 1) === 1;
    if (back) f = 1 - f;
    const x = r.ax + (r.bx - r.ax) * f, z = r.az + (r.bz - r.az) * f;
    const dx = (r.bx - r.ax) * (back ? -1 : 1), dz = (r.bz - r.az) * (back ? -1 : 1);
    this.out[0] = x; this.out[1] = z; this.out[2] = Math.atan2(dz, dx);
    return this.out;
  }
}
