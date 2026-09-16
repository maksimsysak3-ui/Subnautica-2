/**
 * The mains: power lines, water pipes and sewers, laid by hand along the streets.
 *
 * Until now a road carried every utility the moment it was built, which is one
 * decision fewer for the player and one fewer thing for a city to be wrong about.
 * It is also not how any of this works. A district can have roads and no water; a
 * water plant can be built and left unconnected; the cheap route for a trunk main
 * and the cheap route for a road are not the same route. So each utility now has
 * its own network, the player lays it, and a building is served when a main of that
 * kind reaches it.
 *
 * CELLS, NOT LINKS. A main is stored as a bit per eight-metre cell, in the same
 * grid the roads rasterise themselves into and the zoning works on. The obvious
 * alternative -- remember which road links carry which utility -- breaks the first
 * time somebody draws a road across another one, because the crossing splits a link
 * in two and renumbers everything after it. Cells do not move when the network is
 * edited, which makes them the only stable thing to hang this on.
 *
 * WHAT A MAIN REACHES. Laying is constrained to road cells: a pipe follows the
 * street, which is both how it is done and what makes the drag tool obvious to use.
 * Buildings do not sit on the street, so each network is then grown outward a few
 * cells into a service band, and a building is connected when its own cell is in
 * one. That band is why "click and drag along the road" is all the player has to do
 * -- the houses either side connect themselves, which is the part of the real job
 * nobody wants to simulate.
 *
 * COST. One byte a cell for what is laid, and one network id per cell per utility
 * for what it reaches. Rebuilding is three flood fills and three ring expansions
 * over the grid, which is a couple of milliseconds on the largest map and happens
 * when the player edits something rather than on a tick.
 */

import type { RoadGraph } from './roadgraph';

/** The three things that run in the ground. Rubbish goes by lorry. */
export const Main = { POWER: 1, WATER: 2, SEWAGE: 4 } as const;
export type MainKind = typeof Main[keyof typeof Main];

/** In the order they appear in the palette. */
export const MAIN_KINDS: MainKind[] = [Main.POWER, Main.WATER, Main.SEWAGE];
export const MAIN_NAMES: Record<number, string> = {
  [Main.POWER]: 'power', [Main.WATER]: 'water', [Main.SEWAGE]: 'sewage',
};

/**
 * What each one is drawn in.
 *
 * The same three the underground views use, so a pipe the player is laying is the
 * colour the map will show it in afterwards.
 */
export const MAIN_COLOURS: Record<number, string> = {
  [Main.POWER]: '#f0c24a', [Main.WATER]: '#4fa8e8', [Main.SEWAGE]: '#7fbf6a',
};

/** Metres per cell. The same grid as the roads and the zoning. */
const CELL = 8;

/**
 * Cells a main reaches either side of the street it is laid in.
 *
 * Six -- about fifty metres, which is a deep plot. A house behind a verge, a
 * pavement and a front garden connects; the middle of a block does not. Any larger
 * and one pipe down one street would serve the street behind it, which would make
 * the whole business of laying them pointless.
 */
const REACH_CELLS = 6;

/** Cells either side of the drag that get the main, so a wide road fills. */
const BRUSH = 1;

/**
 * Cells from where a drag begins that may take a main with no road under them.
 *
 * The spur out of a plant. A power station stands off the street with its own
 * forecourt, and the player's move is to start at its terminal and drag to the
 * road -- so the first few cells have to take a line across open ground or that
 * move does nothing at all and the plant stays dark next to a full grid.
 */
const SPUR_CELLS = 10;

export interface MainsReport {
  /** Cells carrying each kind. */
  laid: Record<number, number>;
  /** Separate networks of each kind. More than one is usually a mistake. */
  networks: Record<number, number>;
}

export class Mains {
  /** Which utilities are laid in each cell, as a bitmask. */
  readonly bits: Uint8Array;
  /**
   * The network at each cell, per kind, or -1.
   *
   * Includes the service band, so asking whether a building is connected is one
   * array read rather than a search of the streets around it.
   */
  private readonly reach: Int32Array[] = [];
  /** Networks of each kind, in the same order as `MAIN_KINDS`. */
  private readonly counts: number[] = [];
  /** Scratch for the flood fill, kept so an edit allocates nothing. */
  private readonly queue: Int32Array;

  readonly report: MainsReport = { laid: {}, networks: {} };
  /** Set when bits have changed and the networks have not caught up. */
  private dirty = false;

  constructor(readonly grid: number) {
    const n = grid * grid;
    this.bits = new Uint8Array(n);
    for (let i = 0; i < MAIN_KINDS.length; i++) {
      this.reach.push(new Int32Array(n).fill(-1));
      this.counts.push(0);
    }
    this.queue = new Int32Array(n);
  }

  /** The cell a world position falls in, or -1 off the map. */
  cellAt(x: number, z: number): number {
    const half = this.grid / 2;
    const gx = Math.floor(x / CELL + half);
    const gz = Math.floor(z / CELL + half);
    if (gx < 0 || gz < 0 || gx >= this.grid || gz >= this.grid) return -1;
    return gz * this.grid + gx;
  }

  /** Whether a kind is laid in the cell under a world position. */
  laidAt(x: number, z: number, kind: number): boolean {
    const at = this.cellAt(x, z);
    return at >= 0 && (this.bits[at] & kind) !== 0;
  }

  /**
   * The network of a kind serving a world position, or -1.
   *
   * What every building asks. Includes the service band, so a house four cells off
   * the street the pipe is in answers the same as the street itself.
   */
  netAt(x: number, z: number, kind: number): number {
    const k = MAIN_KINDS.indexOf(kind as MainKind);
    if (k < 0) return -1;
    const at = this.cellAt(x, z);
    return at < 0 ? -1 : this.reach[k][at];
  }

  /** How many separate networks of a kind there are. */
  networksOf(kind: number): number {
    const k = MAIN_KINDS.indexOf(kind as MainKind);
    return k < 0 ? 0 : this.counts[k];
  }

  /**
   * Lays or lifts a main along the road between two points.
   *
   * Only road cells take it, which is the rule that makes the tool feel like a tool
   * rather than a paintbrush: the drag can wander off the kerb and the main still
   * follows the street. Returns how many cells changed, so the caller can tell
   * whether the drag did anything and charge for it.
   */
  lay(net: RoadGraph, x0: number, z0: number, x1: number, z1: number,
    kind: number, on: boolean, spur = false, defer = false): number {
    const half = this.grid / 2;
    const ax = x0 / CELL + half, az = z0 / CELL + half;
    const bx = x1 / CELL + half, bz = z1 / CELL + half;
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) * 2));
    let changed = 0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = Math.floor(ax + (bx - ax) * t);
      const cz = Math.floor(az + (bz - az) * t);
      for (let dz = -BRUSH; dz <= BRUSH; dz++) {
        for (let dx = -BRUSH; dx <= BRUSH; dx++) {
          const gx = cx + dx, gz = cz + dz;
          if (gx < 0 || gz < 0 || gx >= this.grid || gz >= this.grid) continue;
          const at = gz * this.grid + gx;
          // A pipe goes in the street, except for the spur out of wherever the
          // drag began. Lifting one is not fussy about either -- a player pulling
          // up a main after demolishing the road it was under should not be told
          // there is nothing there.
          if (on && net.cls[at] === 0) {
            if (!spur || Math.hypot(gx - ax, gz - az) > SPUR_CELLS) continue;
          }
          const was = (this.bits[at] & kind) !== 0;
          if (was === on) continue;
          if (on) this.bits[at] |= kind; else this.bits[at] &= ~kind;
          changed++;
        }
      }
    }
    if (changed > 0) {
      // Deferred while the pointer is still down. The networks are three flood
      // fills over the whole grid and the tool lays a cell every frame, so doing
      // them per frame would turn a drag across a district into a slideshow. The
      // bits are right immediately, which is what the drawn line reads; the
      // networks catch up when the button comes up.
      if (defer) this.dirty = true; else this.rebuild();
    }
    return changed;
  }

  /**
   * Brings the networks up to date if a deferred edit left them behind.
   *
   * Returns whether it had to, so a caller can tell whether anything downstream
   * needs telling.
   */
  settle(): boolean {
    if (!this.dirty) return false;
    this.rebuild();
    return true;
  }

  /**
   * Lays a kind on every road cell there is.
   *
   * For a city that arrives already built -- the generated demo, and any save from
   * before mains existed. Those cities were built under the rule that a road
   * carried everything, and loading one into a game where it does not would cut the
   * power off in every building at once, which is not a migration, it is a bug
   * report.
   */
  layEverywhere(net: RoadGraph, kinds: number[] = MAIN_KINDS): void {
    let any = false;
    for (let at = 0; at < this.bits.length && at < net.cls.length; at++) {
      if (net.cls[at] === 0) continue;
      for (const k of kinds) this.bits[at] |= k;
      any = true;
    }
    if (any) this.rebuild();
  }

  /** Forgets everything laid. */
  clear(): void {
    this.bits.fill(0);
    this.rebuild();
  }

  /**
   * Recomputes every network and its service band.
   *
   * A flood fill per kind over the cells carrying it, then a bounded expansion
   * outward so the buildings either side of the street join the network the street
   * carries. The expansion is a breadth-first walk from every main cell at once,
   * stopped after `REACH_CELLS` rings -- which is a distance transform in the only
   * form this needs, and costs one pass rather than one search per building.
   */
  rebuild(): void {
    this.dirty = false;
    const g = this.grid;
    const n = g * g;
    const q = this.queue;
    for (let k = 0; k < MAIN_KINDS.length; k++) {
      const kind = MAIN_KINDS[k];
      const reach = this.reach[k];
      reach.fill(-1);
      let count = 0;
      let laid = 0;

      // The networks themselves.
      for (let start = 0; start < n; start++) {
        if ((this.bits[start] & kind) === 0 || reach[start] >= 0) continue;
        const id = count++;
        let head = 0, tail = 0;
        q[tail++] = start;
        reach[start] = id;
        while (head < tail) {
          const at = q[head++];
          laid++;
          const x = at % g, z = (at / g) | 0;
          tail = this.push(at - 1, x > 0, id, kind, reach, q, tail);
          tail = this.push(at + 1, x + 1 < g, id, kind, reach, q, tail);
          tail = this.push(at - g, z > 0, id, kind, reach, q, tail);
          tail = this.push(at + g, z + 1 < g, id, kind, reach, q, tail);
        }
      }

      // And the band either side of them, which is what the houses connect to.
      let head = 0, tail = 0;
      for (let at = 0; at < n; at++) if (reach[at] >= 0) q[tail++] = at;
      for (let ring = 0; ring < REACH_CELLS; ring++) {
        const end = tail;
        while (head < end) {
          const at = q[head++];
          const id = reach[at];
          const x = at % g, z = (at / g) | 0;
          if (x > 0 && reach[at - 1] < 0) { reach[at - 1] = id; q[tail++] = at - 1; }
          if (x + 1 < g && reach[at + 1] < 0) { reach[at + 1] = id; q[tail++] = at + 1; }
          if (z > 0 && reach[at - g] < 0) { reach[at - g] = id; q[tail++] = at - g; }
          if (z + 1 < g && reach[at + g] < 0) { reach[at + g] = id; q[tail++] = at + g; }
        }
      }

      this.counts[k] = count;
      this.report.laid[kind] = laid;
      this.report.networks[kind] = count;
    }
  }

  /** One neighbour of the flood fill. Returns the new tail. */
  private push(at: number, inside: boolean, id: number, kind: number,
    reach: Int32Array, q: Int32Array, tail: number): number {
    if (!inside || reach[at] >= 0 || (this.bits[at] & kind) === 0) return tail;
    reach[at] = id;
    q[tail] = at;
    return tail + 1;
  }

  /** Serialised as one byte a cell, which is what it is. */
  save(): Uint8Array { return this.bits; }

  /** Restores a saved grid, ignoring one from a differently sized map. */
  load(bits: Uint8Array): boolean {
    if (bits.length !== this.bits.length) return false;
    this.bits.set(bits);
    this.rebuild();
    return true;
  }

  bytes(): number {
    let n = this.bits.byteLength + this.queue.byteLength;
    for (const r of this.reach) n += r.byteLength;
    return n;
  }
}
