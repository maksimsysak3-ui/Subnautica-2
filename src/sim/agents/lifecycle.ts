/**
 * Buildings getting better, and buildings dying.
 *
 * Everything else in this simulation moves. People are born, take jobs, ride
 * buses and die; traffic jams and clears; the treasury rises and falls. The one
 * thing that never changed was the city itself. A plot came up, a building
 * landed on it, and that building stood there unaltered for the rest of the
 * game however well or badly the player looked after it. There was a `health`
 * column on every building, a fire could knock it down, and *nothing read it*.
 * A district you starved of water looked exactly like one you had lavished
 * parks on. That is the difference between a city builder and a model railway.
 *
 * So, two loops, and they are the same loop in opposite directions.
 *
 * UP. A building that is supplied, served, occupied and standing on land people
 * want gains health. When a whole cell's worth of land has been worth having
 * for long enough, its tier goes up, and the spawner puts something grander
 * there next time that block is built -- so a street the player improves grows
 * into it. See `World.tier`.
 *
 * DOWN. A building with no power, no water, filthy air or no customers loses
 * health. Below `DERELICT_AT` it starts telling the player so, through the
 * gripe the complaints model already had and which until now was a promise the
 * game never kept: "this building is failing and will be abandoned". Left
 * alone, it is. The plot is condemned and cleared, and while it stands empty it
 * drags its neighbours' land value down -- which is how one dead block becomes
 * a dead quarter if it is ignored, and why fixing the first one matters.
 *
 * AND BACK. Blight is not permanent. When the land under a cleared plot is fit
 * again -- supply restored, air clean enough, the street worth something -- the
 * cell is un-condemned and handed back to the growth model as unreleased land,
 * so the city has to earn it again and then rebuilds on it. A player who fixes
 * a slum watches it come back.
 *
 * WHAT THIS DOES NOT DO. It does not move anybody out. It writes to the world
 * and hands out a rectangle; the frame rebuilds that rectangle, the spawner
 * emits nothing on the condemned cells, and the reconciliation that already
 * exists for demolition fires the workers and rehouses the households. One path
 * for "a building is no longer there" rather than two that can disagree.
 *
 * COST. A slice of the buildings each visit for the health integration, in the
 * same shape as every other table walk here, and a bounded cursor over the
 * zoning grid for the tiering. Neither is allowed to grow with the map.
 */

import type { Places } from './places';
import { Purpose } from './places';
import type { Ground } from './ground';
import type { Services } from './services';
import type { Utilities } from './utilities';
import { Util } from './utilities';
import type { World } from '../world';
import { zoneOf } from '../world';
import { Main } from '../mains';
import { TIERS } from '../inventory';
import { BRANCHES } from '../../assets/types';
import { ASSETS } from '../../assets/registry';
import { expectedOf, QUIET_UNTIL } from './services';
import { Policies, NO_POLICIES } from '../policies';

/**
 * How much the air over a building matters to it, by what the building is.
 *
 * Indexed by `Purpose`: home, shop, office, works, service.
 */
const AIR_MATTERS = [0.30, 0.16, 0.16, 0, 0];

/** A building at or below this is visibly failing, and says so. */
export const DERELICT_AT = 70;
/** And at or below this it is past saving. */
const CONDEMN_AT = 12;

/**
 * How fast health moves, in points of 255 per game day.
 *
 * Deliberately slow, and deliberately not symmetric. A building takes about a
 * game week to fall from healthy to condemned with nothing supplied, which is
 * ten real minutes at normal speed -- long enough that the player gets the
 * gripe, the thought bubble and a good look at the map before anything is lost,
 * and short enough that ignoring a district has a consequence inside one
 * session. Recovery is faster than decline because a game that punishes harder
 * than it rewards is a game nobody finishes a city in.
 */
const FALL_PER_DAY = 34;
const RISE_PER_DAY = 52;

/** Branches a home expects once the city is big enough to have them. */
const CARED: { branch: number; weight: number }[] = [
  { branch: BRANCHES.indexOf('fire'), weight: 1.0 },
  { branch: BRANCHES.indexOf('health'), weight: 1.0 },
  { branch: BRANCHES.indexOf('police'), weight: 0.8 },
  { branch: BRANCHES.indexOf('education'), weight: 0.6 },
];

/**
 * Land value a cell has to hold to carry each tier, and to keep it.
 *
 * Two numbers per step, not one. A single threshold on a field that breathes
 * means the block on the line rebuilds itself every few seconds, for ever, at
 * the cost of a full rebuild of that rectangle each time -- the flicker is
 * visible and the cost is not small. The gap between them is the hysteresis,
 * and it is wide on purpose: a quarter has to get properly better to climb, and
 * properly worse to fall back.
 */
const TIER_UP = [0, 0.52, 0.72];
const TIER_DOWN = [0, 0.40, 0.58];

/**
 * How long, in game days, a cell has to deserve its next tier before it gets it.
 *
 * Land value moves when a park opens or a lorry route changes, and a city where
 * every block rebuilds itself the instant a bus stop appears is a city that is
 * never still. Half a game day is forty-five seconds at normal speed.
 */
const TIER_PATIENCE = 0.5;

/** And how long a condemned plot stays condemned once the land is fit again. */
const BLIGHT_PATIENCE = 1.0;

/**
 * The land value a cleared plot needs before the city will build on it again.
 *
 * Low, and deliberately below the bar for the first tier: this is "somebody
 * would put something here", not "this is a good address". A quarter that has
 * been cleared has to be habitable again, not fashionable.
 */
const FIT_TO_BUILD = 0.25;

/**
 * Cells the tier cursor looks at per visit.
 *
 * A bounded walk rather than a sweep, for the reason the growth model walks
 * too: this runs on a timer over a grid that can be half a million cells, and
 * the honest way to stay cheap on a big map is to go round it more slowly
 * rather than to do less on a small one.
 */
const CELLS_PER_VISIT = 6000;

/** Cells the rectangle handed to the renderer may span. */
const MAX_DIRTY = 40;

export interface Lifecycle {
  /** Buildings that crossed into failing since the last readout. */
  failing: number;
  /** Plots condemned and cleared since the last readout. */
  condemned: number;
  /** Cells whose tier went up, and down. */
  raised: number;
  lowered: number;
}

export class BuildingLife {
  /** The ordinances in force. Only one of them reaches here: the height limit. */
  private policies: Policies = NO_POLICIES;

  /** Points at the city's policies. Called whenever the world is replaced. */
  governedBy(policies: Policies): void { this.policies = policies; }

  /** What has happened since the last `drain`, for the alerts. */
  readonly tally: Lifecycle = { failing: 0, condemned: 0, raised: 0, lowered: 0 };
  /**
   * And since the city was founded, for the panel.
   *
   * Two counters rather than one, because the alerts want "what just happened"
   * and the panel wants "what has this city been through", and a single counter
   * can only answer one of them.
   */
  readonly total: Lifecycle = { failing: 0, condemned: 0, raised: 0, lowered: 0 };

  /** How long each cell has deserved a change, in game days. Sparse by nature. */
  private readonly patience: Float32Array;
  /** Where the tier cursor got to. */
  private cursor = 0;
  private dirty: { gx: number; gz: number; w: number; d: number } | null = null;

  /** Buildings currently below `DERELICT_AT`, for the readout. */
  ailing = 0;
  /** Cells currently condemned. */
  ruins = 0;

  constructor(
    private readonly world: World,
    private readonly places: Places,
    private readonly ground: Ground,
    private readonly services: Services,
    private readonly utilities: Utilities,
    private readonly population: () => number,
  ) {
    this.patience = new Float32Array(world.grid * world.grid);
  }

  /**
   * The rectangle of cells whose buildings changed, and clears it.
   *
   * Same contract as the growth model's: asked from outside the tick, because
   * acting on it rebuilds the city and rebuilding the city re-enters the
   * simulation.
   */
  take(): { gx: number; gz: number; w: number; d: number } | null {
    const d = this.dirty;
    this.dirty = null;
    return d;
  }

  /**
   * Moves every building in a slice towards the health its situation deserves.
   *
   * `start` and `stride` are the usual slice: one visit covers one building in
   * `stride`, so the whole city is covered every `stride` visits and a city of
   * thirty thousand costs a visit what a village does.
   */
  settle(start: number, stride: number, days: number): void {
    const p = this.places;
    const c = p.col;
    const g = this.ground;
    const u = this.utilities;
    const s = this.services;
    const pop = this.population();
    const fall = FALL_PER_DAY * days;
    const rise = RISE_PER_DAY * days;
    let ailing = 0;
    for (let id = start; id < p.count; id += stride) {
      if (p.live[id] === 0) continue;
      const purpose = c.purpose[id];
      // A service building is the city's own, and the city does not let its own
      // fire station rot for want of a fire station. They are kept out of this
      // entirely, exactly as the complaints model keeps them out of its market
      // gripes -- and for the same reason: nothing here names something the
      // player can go and do about a hospital.
      if (purpose === Purpose.SERVICE) continue;

      const want = this.deserved(id, purpose, pop, g, u, s);
      const h = c.health[id];
      const target = want * 255;
      const step = target > h ? rise : fall;
      const next = h + Math.sign(target - h) * Math.min(Math.abs(target - h), step);
      const was = h;
      c.health[id] = next < 0 ? 0 : next > 255 ? 255 : Math.round(next);
      if (was >= DERELICT_AT && c.health[id] < DERELICT_AT) {
        this.tally.failing++;
        this.total.failing++;
      }
      if (c.health[id] < DERELICT_AT) ailing++;
      if (c.health[id] <= CONDEMN_AT) this.condemn(id);
    }
    // A slice's count, scaled back up: counting only the slice would report a
    // third of the truth on a third of the visits.
    if (start === 0) this.ailing = ailing * stride;
  }

  /**
   * The health this building's situation deserves, 0 to 1.
   *
   * Everything in here is something the player can change. Nothing in here is a
   * fact about the building -- a terraced house and a tower block in the same
   * street deserve the same, because the street is what the player is playing
   * with.
   */
  private deserved(id: number, purpose: number, pop: number,
    g: Ground, u: Utilities, s: Services): number {
    const c = this.places.col;
    // Supply first and hardest. A building with no water is not a building with
    // a slightly lower score; it is a building people leave.
    const power = u.at(id, Util.POWER);
    const water = u.at(id, Util.WATER);
    const drains = u.at(id, Util.SEWAGE);
    // Rubbish is not held against a building until the town is big enough to
    // be told about it: a failing that is never explained is a trap.
    const bins = pop < QUIET_UNTIL ? 1 : u.at(id, Util.GARBAGE);
    const essentials = Math.min(power, water);

    // Everything that is not power and water: whether the drains and the bins
    // work, what the street is worth, whether anybody is in it.
    let comfort = 0.30 + 0.22 * drains + 0.12 * bins;

    // Services, but only the ones a city this size is expected to have. A
    // village with no hospital is a village, not a slum.
    let care = 0, careWeight = 0;
    for (const k of CARED) {
      if (k.branch < 0) continue;
      if (!expectedOf(BRANCHES[k.branch], pop)) continue;
      care += k.weight * s.at(id, k.branch);
      careWeight += k.weight;
    }
    if (careWeight > 0) comfort += 0.22 * (care / careWeight) - 0.11;

    // What the neighbourhood is worth, which folds in the parks, the air and
    // the noise without counting any of them twice.
    comfort += 0.24 * g.valueOf(id);

    // Empty is its own kind of decay. A shop with no customers and a block with
    // no tenants both board up, and both should, because the alternative is a
    // city that keeps buildings the market does not want.
    if (purpose === Purpose.HOME) {
      const homes = c.homes[id];
      if (homes > 0) comfort += 0.16 * (c.living[id] / homes) - 0.08;
    } else {
      const jobs = c.jobs[id];
      if (jobs > 0) comfort += 0.16 * (c.working[id] / jobs) - 0.08;
    }
    if (comfort < 0) comfort = 0; else if (comfort > 1) comfort = 1;

    // And supply, as a multiplier over all of it rather than a term in it.
    //
    // This is the one thing in the model that is not a matter of degree. A
    // building with no water is not a slightly worse building; it is a building
    // people leave, however good the street is otherwise -- and as a term it
    // was one: a cut-off district settled at a comfortable thirteen per cent
    // and stood there for ever instead of being condemned.
    let v = essentials * (0.40 + 0.60 * comfort);
    // The air, last, because a works can poison a street that everything else
    // about it is holding up -- and weighted by who is breathing it. A foundry
    // standing in its own smoke is a foundry; the terraces downwind of it are
    // the problem, and without this split an industrial quarter condemned
    // itself, which is neither true nor any use to the player.
    v -= AIR_MATTERS[purpose] * g.pollutionOf(id);
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  /** Condemns the plot a building stands on. */
  private condemn(id: number): void {
    const c = this.places.col;
    const w = this.world;
    const grid = w.grid;
    const half = (grid * 8) / 2;
    const gx = ((c.x[id] + half) / 8) | 0;
    const gz = ((c.z[id] + half) / 8) | 0;
    if (gx < 0 || gz < 0 || gx >= grid || gz >= grid) return;
    if (w.blight[gz * grid + gx] !== 0) return;
    // The footprint, not the centre cell: half a condemned building left
    // standing is worse than either outcome.
    const def = ASSETS[c.proto[id]];
    const r = def === undefined ? 2
      : Math.max(1, Math.ceil(Math.max(def.footprint[0], def.footprint[1]) / 2));
    let any = false;
    for (let z = Math.max(0, gz - r); z <= Math.min(grid - 1, gz + r); z++) {
      for (let x = Math.max(0, gx - r); x <= Math.min(grid - 1, gx + r); x++) {
        const at = z * grid + x;
        if (w.zones[at] === 0 || w.blight[at] !== 0) continue;
        w.blight[at] = 1;
        this.patience[at] = 0;
        any = true;
      }
    }
    if (!any) return;
    this.tally.condemned++;
    this.total.condemned++;
    this.mark(gx - r, gz - r, r * 2 + 1, r * 2 + 1);
  }

  /**
   * Walks the zoning grid, raising and lowering tiers and lifting blight.
   *
   * One bounded run of cells per visit, wrapping round. Everything it changes
   * goes into one rectangle, and it stops as soon as that rectangle would get
   * too big to rebuild cheaply -- the rest is picked up next time round.
   */
  survey(days: number): void {
    const w = this.world;
    const grid = w.grid;
    const total = grid * grid;
    const g = this.ground;
    const half = (grid * 8) / 2;
    let looked = 0;
    while (looked < CELLS_PER_VISIT) {
      const at = this.cursor;
      this.cursor = (this.cursor + 1) % total;
      looked++;
      const code = w.zones[at];
      if (code === 0) continue;
      const gx = at % grid, gz = (at / grid) | 0;
      const value = g.valueAt(gx * 8 - half + 4, gz * 8 - half + 4);

      if (w.blight[at] !== 0) {
        // Fit to build on again, which is not the same question as "is this
        // land desirable". Asking for desirability was a death spiral with no
        // exit: a cleared plot has no buildings, so it has no density and no
        // supply reading, so its land value can never climb to the bar that
        // would let something be built to raise it. The honest condition is the
        // one the growth model already uses to decide whether a cell can be
        // built on at all -- is there a power main in the street -- plus air
        // that is not actually poisonous.
        const served = w.mains.netAt(gx * 8 - half + 4, gz * 8 - half + 4,
          Main.POWER) >= 0;
        if (served && g.pollutionAt(gx * 8 - half + 4, gz * 8 - half + 4) < 0.6
          && value >= FIT_TO_BUILD) {
          this.patience[at] += days;
          if (this.patience[at] >= BLIGHT_PATIENCE) {
            w.blight[at] = 0;
            this.patience[at] = 0;
            // Back to unreleased, so the city pays for it again rather than
            // getting a free district the moment the water comes back on.
            w.grown[at] = 0;
            w.tier[at] = 0;
          }
        } else {
          this.patience[at] = 0;
        }
        continue;
      }
      if (zoneOf(code) === null) continue;

      const tier = w.tier[at];
      // The height limit, where a lot decides what it is worth building.
      //
      // It caps the tier rather than refusing the growth, so a district under
      // the order fills up with the mid-rise it is allowed instead of standing
      // empty -- and a lot already above the cap comes down a tier the next
      // time it is rebuilt, which is how a real one takes effect.
      const cap = Math.min(TIERS - 1, this.policies.effects.tierCap);
      const up = tier + 1 <= cap && value >= TIER_UP[tier + 1];
      const down = tier > 0 && (tier > cap || value < TIER_DOWN[tier]);
      if (!up && !down) { this.patience[at] = 0; continue; }
      this.patience[at] += days;
      if (this.patience[at] < TIER_PATIENCE) continue;
      this.patience[at] = 0;
      w.tier[at] = up ? tier + 1 : tier - 1;
      if (up) { this.tally.raised++; this.total.raised++; }
      else { this.tally.lowered++; this.total.lowered++; }
      // A tier is a property of a cell but a building spans several, so the
      // rectangle is grown to the block rather than the cell: rebuilding one
      // cell of a six-cell frontage rebuilds the same building it already had.
      if (!this.mark(gx - 2, gz - 2, 5, 5)) break;
    }
  }

  /** Counts what is standing derelict, for the panels. */
  get derelicts(): number { return this.ruins; }

  /**
   * Unions a rectangle into the one waiting to be taken.
   *
   * False once it is as large as a rebuild should be, which is the caller's
   * signal to stop for this visit.
   */
  private mark(gx: number, gz: number, w: number, d: number): boolean {
    const cur = this.dirty;
    if (cur === null) {
      this.dirty = { gx, gz, w, d };
      return true;
    }
    const x0 = Math.min(cur.gx, gx), z0 = Math.min(cur.gz, gz);
    const x1 = Math.max(cur.gx + cur.w, gx + w), z1 = Math.max(cur.gz + cur.d, gz + d);
    cur.gx = x0; cur.gz = z0; cur.w = x1 - x0; cur.d = z1 - z0;
    return cur.w <= MAX_DIRTY && cur.d <= MAX_DIRTY;
  }

  /** Tallies since the last read, and resets them. */
  drain(): Lifecycle {
    const out = { ...this.tally };
    this.tally.failing = 0;
    this.tally.condemned = 0;
    this.tally.raised = 0;
    this.tally.lowered = 0;
    return out;
  }

  bytes(): number { return this.patience.byteLength; }
}

