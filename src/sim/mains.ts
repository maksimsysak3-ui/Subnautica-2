/**
 * The mains: the power, water and sewage that come with a road.
 *
 * A street carries its services. Draw a road and the mains go in with it; build
 * beside that road and you are on them. There is no pipe tool, and there was one
 * for exactly as long as it took to find out that laying three lines down every
 * street you had already drawn is not a decision, it is a chore -- the player has
 * said where the city goes by drawing the road, and asking them to say it three
 * more times adds nothing to the game.
 *
 * This still exists, and is still a separate network per utility, for two reasons.
 * One: the *supply* is what the player manages, and supply is per network -- two
 * districts joined by road share a grid and a district cut off from the pumps has
 * no water, which is a real thing for a city to be and needs somewhere to live.
 * Two: the mains are drawn, one line down each street in its own colour, and a
 * player looking at the power map wants to see where the grid actually reaches.
 *
 * CELLS, NOT LINKS. A main is a bit per eight-metre cell, in the same grid the
 * roads rasterise themselves into. Remembering which road *links* carry which
 * utility breaks the first time somebody draws a road across another one, because
 * the crossing splits a link in two and renumbers everything after it. Cells do not
 * move when the network is edited.
 *
 * WHAT A MAIN REACHES. The street, and a band either side of it, so the houses set
 * back behind a verge are on it and the middle of a block is not.
 *
 * COST. One byte a cell for what is laid, and one network id per cell per utility
 * for what it reaches. Rebuilding is three flood fills and three ring expansions
 * over the grid, which is a couple of milliseconds on the largest map and happens
 * when the roads change rather than on a tick.
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
 * Five, and measured the short way round the corner as well as straight back, so
 * about forty metres in any direction -- a deep plot. A house behind a verge, a
 * pavement and a front garden is on the main; the middle of a block is not, which
 * is what keeps a block's interior worth a road of its own.
 */
const REACH_CELLS = 5;

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
   * Puts the mains wherever the roads are, and nowhere else.
   *
   * Called after every road edit. Assignment rather than a union, so a demolished
   * street takes its services with it -- a union would leave a grid running down a
   * road that is no longer there, feeding buildings that have no frontage.
   *
   * Returns whether anything moved, so a caller can skip the flood fill on the
   * edits that changed no road cells at all, which is most zoning.
   */
  followRoads(net: RoadGraph): boolean {
    const all = Main.POWER | Main.WATER | Main.SEWAGE;
    const n = Math.min(this.bits.length, net.cls.length);
    let moved = false;
    for (let at = 0; at < n; at++) {
      const want = net.cls[at] !== 0 ? all : 0;
      if (this.bits[at] === want) continue;
      this.bits[at] = want;
      moved = true;
    }
    if (moved) this.rebuild();
    return moved;
  }

  /** The old name, kept because a loaded save calls it. */
  layEverywhere(net: RoadGraph): void { this.followRoads(net); }

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
  /**
   * Bumped by every rebuild, so the frame can tell the simulation that the pipes
   * moved.
   *
   * The road graph has had one of these all along and the mains did not, which
   * was a real hole rather than an omission: the utilities are rewired when the
   * roads change, so a player who bulldozed a water main and nothing else kept
   * their water until they happened to touch a road. The supply is a property of
   * the network, and the network is this.
   */
  version = 0;

  rebuild(): void {
    this.version++;
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
          const w = x > 0, e = x + 1 < g, n = z > 0, sth = z + 1 < g;
          tail = this.push(at - 1, w, id, kind, reach, q, tail);
          tail = this.push(at + 1, e, id, kind, reach, q, tail);
          tail = this.push(at - g, n, id, kind, reach, q, tail);
          tail = this.push(at + g, sth, id, kind, reach, q, tail);
          // And the corners. A road drawn at an angle rasterises as a staircase,
          // and where one meets a straight street the two can touch only
          // diagonally -- so a four-connected fill called them separate grids,
          // and a city joined by a diagonal street had two of everything.
          tail = this.push(at - g - 1, n && w, id, kind, reach, q, tail);
          tail = this.push(at - g + 1, n && e, id, kind, reach, q, tail);
          tail = this.push(at + g - 1, sth && w, id, kind, reach, q, tail);
          tail = this.push(at + g + 1, sth && e, id, kind, reach, q, tail);
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
          const w = x > 0, e = x + 1 < g, n = z > 0, sth = z + 1 < g;
          // Eight ways out, so the band is a square rather than a diamond and the
          // house on the corner of a plot is served like the one in the middle of
          // the frontage.
          const step = (to: number, ok: boolean): void => {
            if (!ok || reach[to] >= 0) return;
            reach[to] = id;
            q[tail++] = to;
          };
          step(at - 1, w); step(at + 1, e); step(at - g, n); step(at + g, sth);
          step(at - g - 1, n && w); step(at - g + 1, n && e);
          step(at + g - 1, sth && w); step(at + g + 1, sth && e);
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
