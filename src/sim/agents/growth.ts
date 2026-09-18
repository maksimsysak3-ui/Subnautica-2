/**
 * Growth: zoned land turns into buildings as the city earns them.
 *
 * Painting a zone used to fill it. Every cell the player painted had a building on
 * it by the next frame, which is a level editor rather than a game -- the
 * population, the jobs and the demand were all being computed against a city the
 * player had not built, and there was nothing to wait for and nothing to get
 * wrong. The simulation had everything needed to fix that and was not wired to it.
 *
 * HOW IT WORKS. Zoning marks land. A cell is only *released* for building when the
 * demand for its zone is positive and the city has grown enough to pay for it, and
 * the spawner will not put anything on a cell that has not been released. So a
 * painted district fills in over game days, in the order it is reached, and stops
 * when the demand does.
 *
 * WHY A MASK AND NOT A QUEUE. The spawner is a deterministic function of the world
 * -- the same zoning always produces the same city, which is what makes an edit
 * able to rebuild one rectangle instead of everything. A queue of "buildings to
 * place" would break that. One byte per cell keeps it: `makeCity` still just reads
 * the world, and the world now says which of its zoned cells have come up yet.
 *
 * RELEASED IN PATCHES, not cells. A building spans several cells and the spawner
 * lays out a whole frontage at a time, so releasing single cells would produce
 * half-buildings and ragged streets. A patch is a few cells square, which is one
 * or two buildings, which is what a city gains at a time.
 *
 * WHERE. A walking cursor that skips what does not qualify, not a sort -- a sort
 * over a four hundred thousand cell grid on a timer is exactly the kind of thing
 * that turns up in a profile later. The cursor only moves while there is budget to
 * spend, so the cost of this is bounded by what the city can afford to build
 * rather than by the size of the map.
 *
 * NOTHING IS CALLED BACK. Releasing a patch means the city has to be built again
 * over it, and doing that from inside the tick would re-enter the simulation
 * through the renderer while the scheduler is halfway through its systems. So the
 * rectangle is *recorded*, and whoever owns the frame takes it when the tick is
 * over -- see `take`.
 */

import { Demand, WANTS } from './demand';
import type { World } from '../world';
import { zoneIndexOf, ZONES } from '../world';
import { Main } from '../mains';
import { OVERDRAFT } from '../budget';

/** Cells across one released patch. One or two buildings' worth. */
const PATCH = 5;


/**
 * Patches a city of a thousand people releases in a game day at full demand.
 *
 * Scaled by the population, because a village gaining ten houses a day is a boom
 * and a city of a hundred thousand gaining ten is stagnant. The floor is what lets
 * a brand new city start at all: with nobody in it, a share of nothing is nothing.
 *
 * A game day is ninety real seconds, so the floor is a patch every four and a half
 * seconds -- fast enough that a player who has just painted their first street
 * watches it fill, slow enough that they watch it rather than miss it.
 */
const PATCHES_PER_THOUSAND_DAY = 30;
const PATCHES_PER_DAY_FLOOR = 24;

/**
 * The founding rush: how much faster the very first plots come up, and for how
 * long.
 *
 * A city builder has to show a player the machine working inside the first
 * minute. At the ordinary rate the first street took two game days to fill,
 * which is three real minutes of watching an empty rectangle and wondering
 * whether the click registered -- and a player who cannot tell whether the game
 * is running has no way to learn anything else about it.
 *
 * It is also true, which is why it is this and not a cheat: the first plots of a
 * new town go up on speculation, all at once, before there is any demand to
 * speak of. Nine hundred cells is a block or two. After that the city pays its
 * own way.
 */
const FOUNDING_CELLS = 900;
const FOUNDING_RUSH = 5;
/**
 * And only while the town really is new. A loaded save has released no cells of
 * its own, so cells alone would hand a hundred-thousand-person city a fivefold
 * boom the moment it was opened.
 */
const FOUNDING_POP = 500;

/**
 * How many waiting cells the survey writes down at once.
 *
 * Sixty-five thousand is a hundred and sixty patches of frontage, which is more
 * than a city releases in several minutes -- and the rest is picked up by the
 * next survey. Two hundred and sixty kilobytes, once.
 */
const PENDING_CAP = 65536;

/** Demand below this grows nothing. Above it, growth scales with how far above. */
const THRESHOLD = 0.02;

/**
 * Patches one visit may release, however rich the city is.
 *
 * Not a budget -- a locality rule. Everything released in a visit is rebuilt as
 * one rectangle, and a metropolis earning a hundred patches a visit would scatter
 * them over the whole map and turn every three seconds into a full rebuild. Two
 * dozen is six hundred cells, which is a large block and a local one.
 */
const MAX_PER_VISIT = 24;

/**
 * The most unspent growth that can pile up, as visits' worth.
 *
 * Without a cap, a player who plays for ten minutes without zoning anything builds
 * up two hundred patches of credit, and the moment they paint a street the whole
 * lot lands at once. A city is allowed to have a couple of plots ready to go; it
 * is not allowed to have a decade of them. Expressed as a multiple of what this
 * visit earned rather than as a constant, because a constant that is a fortnight's
 * growth for a village is three seconds of it for a city.
 */
const CARRY_VISITS = 2;
/** And a floor, so a village can always have one plot ready. */
const MIN_CARRY = 2;

/**
 * How much a zone that answers to no market wants to be built.
 *
 * Parks and nature are not a market: a player who paints one has already decided
 * they want it, and waiting for demand would be waiting forever. So they sit at a
 * constant appetite and take their share of the city's growth alongside everything
 * else, which is exactly what a park is -- something the city builds instead of
 * building something else.
 */
const PARK_APPETITE = 1;

/**
 * The zone indices, in `ZONES` order, that are also `Want` indices.
 *
 * They are the same four in the same order, which is not a coincidence worth
 * relying on silently -- so it is asserted here, once, and everything below can
 * then use one index for both.
 */
const MARKET_ZONES = WANTS;
if (ZONES[0] !== 'residential' || ZONES[1] !== 'commercial'
  || ZONES[2] !== 'industrial' || ZONES[3] !== 'office') {
  throw new Error('growth: ZONES no longer lines up with Want');
}

export interface GrowthReport {
  /** Patches released since founding, and cells with them. */
  patches: number;
  cells: number;
  /** Zoned cells still waiting, and zoned cells released. As of the last survey. */
  waiting: number;
  released: number;
  /** Waiting cells per zone, in `ZONES` order. The budget follows it. */
  waitingByZone: Int32Array;
  /** Fractional patches carried between visits, so slow growth still happens. */
  owed: number;
}

export class Growth {
  /**
   * Fractional patches carried over, per zone, so a tenth of a patch a day is not
   * zero -- and so one zone cannot spend the whole city's growth.
   *
   * The second half is the important one and was learned the hard way. With a
   * single pot, whichever zone the cursor reached first took everything: a town of
   * six people opened its first day with a warehouse holding four hundred jobs,
   * because the industrial estate happened to sit earlier in the scan than the
   * houses. Each zone now earns its own share of the day, in proportion to how
   * much the city wants it, and can spend nothing else.
   */
  private readonly owed = new Float64Array(ZONES.length);
  /**
   * Where the land that is waiting actually is, from the last survey.
   *
   * Capped: a city can have more zoned land waiting than is worth keeping a
   * list of, and the cap costs nothing -- what is left over is picked up by the
   * next survey, once the cells in front of it have been released.
   */
  private pending = new Int32Array(0);
  private pendingCount = 0;
  private pendingAt = 0;

  /** The rectangle released since the last `take`, in cells, or null. */
  private dirty: { gx: number; gz: number; w: number; d: number } | null = null;
  /**
   * The `world.painted` counter as of the last survey, or -1 for never.
   *
   * The day's growth is shared out only among zones with land waiting, so a
   * visit has to know what is waiting before it can hand anything out. Freshly
   * painted ground would otherwise wait for the survey's slow timer while the
   * day went to zones that are already built out.
   */
  private surveyed = -1;

  readonly report: GrowthReport = {
    patches: 0, cells: 0, waiting: 0, released: 0, owed: 0,
    waitingByZone: new Int32Array(ZONES.length),
  };

  constructor(
    private world: World,
    private demand: Demand,
    private population: () => number,
  ) {}

  /**
   * Whether the city can pay for what it is about to build.
   *
   * A building is a road, a connection and a place in the queue for every
   * service the city runs, and a treasury scraping the bottom of its overdraft
   * cannot underwrite any of it. So a bankrupt city stops growing -- which is
   * the consequence that makes money matter, and is far better than the
   * alternative of a city that grows itself into a deeper hole while the player
   * watches.
   */
  private solvent(): boolean {
    const b = this.world.budget;
    return b.balance > -OVERDRAFT * 0.8;
  }

  /** The world was replaced. */
  rebind(world: World): void {
    this.world = world;
    this.owed.fill(0);
    this.dirty = null;
    this.surveyed = -1;
  }

  /**
   * The rectangle of cells released since this was last asked, and clears it.
   *
   * Taken from outside the tick, deliberately: rebuilding the city re-enters the
   * simulation, and doing that from inside a scheduled system would do it while
   * the scheduler is partway through the tick's other systems.
   */
  take(): { gx: number; gz: number; w: number; d: number } | null {
    const d = this.dirty;
    this.dirty = null;
    return d;
  }

  /**
   * Releases what the city has earned.
   *
   * @param days game days since the last visit.
   */
  grow(days: number): void {
    if (days <= 0) return;
    if (!this.solvent()) {
      // The carry goes with it. A city that spends a fortnight broke should not
      // build a fortnight's worth of houses the moment it is not.
      this.owed.fill(0);
      this.report.owed = 0;
      return;
    }
    if (this.surveyed !== this.world.painted) this.survey();
    const world = this.world;
    const grown = world.grown;
    const zones = world.zones;
    const g = world.grid;
    const cells = g * g;

    const pop = this.population();
    const rush = this.report.cells < FOUNDING_CELLS && pop < FOUNDING_POP
      ? FOUNDING_RUSH : 1;
    const rate = Math.max(PATCHES_PER_DAY_FLOOR,
      (pop / 1000) * PATCHES_PER_THOUSAND_DAY) * rush;
    const earned = rate * days;

    // The day's growth, shared out by how much the city wants each zone. A zone
    // the city does not want earns nothing and loses what it was carrying, so a
    // market that turns while a patch is half paid for does not then build it
    // anyway three seconds later.
    const want = this.demand.want;
    const owed = this.owed;
    // Shared out only among the zones that have land waiting for it. A city
    // with no industrial land and a full industrial bar used to give industry a
    // quarter of the week's building, which went nowhere and came out of the
    // housing that had people queueing for it -- so the first street filled at a
    // quarter speed because of a demand for warehouses nobody had zoned.
    const wanting = this.report.waitingByZone;
    let appetite = 0;
    for (let z = 0; z < owed.length; z++) {
      if (wanting[z] === 0) { owed[z] = 0; continue; }
      const w = z < MARKET_ZONES ? want[z] : PARK_APPETITE;
      appetite += w > THRESHOLD ? w : 0;
    }
    const cap = Math.max(MIN_CARRY, earned * CARRY_VISITS);
    let ready = 0;
    for (let z = 0; z < owed.length; z++) {
      const w = z < MARKET_ZONES ? want[z] : PARK_APPETITE;
      if (wanting[z] === 0 || w <= THRESHOLD || appetite <= 0) { owed[z] = 0; continue; }
      owed[z] = Math.min(cap, owed[z] + earned * (w / appetite));
      if (owed[z] >= 1) ready++;
    }
    let total = 0;
    for (let z = 0; z < owed.length; z++) total += owed[z];
    this.report.owed = total;
    if (ready === 0) return;

    let looked = 0;
    let gx0 = g, gz0 = g, gx1 = -1, gz1 = -1;
    let patches = 0, took = 0;

    // Over the cells that are actually waiting, not over the map.
    //
    // This was a cursor walking all four hundred thousand cells of the grid,
    // twenty thousand a visit, releasing whatever zoned land it happened to
    // pass. On the small worlds the tests use -- eight thousand cells -- that
    // sweeps the whole map every visit and looks instantaneous. On the world
    // the game actually runs, a player who zoned a block had to wait for the
    // cursor to travel to it: half a sweep on average, which is ten visits and
    // most of a minute, and a full sweep if they zoned just behind it. That is
    // the "I zone and nothing happens" this has been chased through three
    // times, and it never reproduced because every probe ran on a small map.
    //
    // The survey already walks the whole grid on a slow timer to count what is
    // waiting. It now writes down where, so this walks a list of candidates
    // instead of the map, and a freshly painted street is found on the first
    // visit after it is painted whatever the map's size.
    const pending = this.pending;
    const n = this.pendingCount;
    if (n === 0) return;
    while (ready > 0 && patches < MAX_PER_VISIT && looked < n) {
      const at = pending[this.pendingAt];
      this.pendingAt = this.pendingAt + 1 < n ? this.pendingAt + 1 : 0;
      looked++;
      if (at < 0 || at >= cells) continue;
      if (grown[at] !== 0) continue;
      const zi = zoneIndexOf(zones[at]);
      if (zi < 0 || owed[zi] < 1) continue;

      const x = at % g, z = (at / g) | 0;
      // Land nothing reaches waits. Power is the proxy for "the city is actually
      // here": the mains follow the roads, so a cell that power reaches is a cell
      // beside a street -- which is the real condition for a building, and is
      // already computed for every cell on the map.
      if (!this.servedAt(x, z)) continue;

      const pw = Math.min(PATCH, g - x), pd = Math.min(PATCH, g - z);
      let got = 0;
      for (let j = 0; j < pd; j++) {
        const row = (z + j) * g;
        for (let i = 0; i < pw; i++) {
          if (grown[row + x + i] !== 0) continue;
          grown[row + x + i] = 1;
          got++;
        }
      }
      if (got === 0) continue;
      patches++;
      took += got;
      if (wanting[zi] > got) wanting[zi] -= got; else wanting[zi] = 0;
      owed[zi] -= 1;
      if (owed[zi] < 1) ready--;
      if (x < gx0) gx0 = x;
      if (z < gz0) gz0 = z;
      if (x + pw > gx1) gx1 = x + pw;
      if (z + pd > gz1) gz1 = z + pd;
    }

    this.report.patches += patches;
    this.report.cells += took;
    total = 0;
    for (let z = 0; z < owed.length; z++) total += owed[z];
    this.report.owed = total;
    // Kept in step between surveys. The survey is a whole-map pass on a slow
    // timer, and a queue length that only moves every thirteen seconds reads as
    // frozen next to the buildings it is counting.
    this.report.released += took;
    this.report.waiting = Math.max(0, this.report.waiting - took);
    if (patches === 0) return;

    // One rectangle for everything released this visit, grown by the margin the
    // spawner builds back from a kerb so the frontage either side of the new
    // ground is laid out again with it. The cursor walks the grid in order, so a
    // visit's patches are neighbours and the rectangle stays tight.
    this.mark(gx0 - 3, gz0 - 3, gx1 - gx0 + 6, gz1 - gz0 + 6);
  }

  /** Unions a rectangle into the one waiting to be taken. */
  private mark(gx: number, gz: number, w: number, d: number): void {
    const cur = this.dirty;
    if (cur === null) {
      this.dirty = { gx, gz, w, d };
      return;
    }
    const x0 = Math.min(cur.gx, gx), z0 = Math.min(cur.gz, gz);
    const x1 = Math.max(cur.gx + cur.w, gx + w), z1 = Math.max(cur.gz + cur.d, gz + d);
    cur.gx = x0; cur.gz = z0; cur.w = x1 - x0; cur.d = z1 - z0;
  }

  /**
   * Is this cell somewhere a building could actually live.
   *
   * The utility model answers it: the mains follow the roads, so asking whether
   * power reaches a cell is asking whether there is a street near it.
   */
  private servedAt(gx: number, gz: number): boolean {
    const world = this.world;
    const half = world.grid / 2;
    const x = (gx - half) * 8 + 4, z = (gz - half) * 8 + 4;
    return world.mains.netAt(x, z, Main.POWER) >= 0;
  }

  /**
   * Counts what is waiting against what has come up, for the readout.
   *
   * A whole-map pass, so it is called on a slow timer and never from a tick that
   * is doing anything else.
   */
  survey(): void {
    const world = this.world;
    const zones = world.zones, grown = world.grown;
    const byZone = this.report.waitingByZone;
    byZone.fill(0);
    if (this.pending.length === 0) this.pending = new Int32Array(PENDING_CAP);
    const pending = this.pending;
    let held = 0;
    let waiting = 0, released = 0;
    for (let at = 0; at < zones.length; at++) {
      if (zones[at] === 0) continue;
      if (grown[at] !== 0) { released++; continue; }
      waiting++;
      if (held < PENDING_CAP) pending[held++] = at;
      const z = zoneIndexOf(zones[at]);
      if (z >= 0) byZone[z]++;
    }
    this.pendingCount = held;
    this.pendingAt = 0;
    this.report.waiting = waiting;
    this.report.released = released;
    this.surveyed = this.world.painted;
  }
}
