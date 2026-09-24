/**
 * Public transport, running.
 *
 * The player owns a loop of stops -- see `sim/transit.ts`. Everything here is
 * derived from that and from the roads: the route the vehicles take between two
 * stops, how long the loop takes to drive, how often one comes, what a journey
 * on it would cost a citizen, and how full it is.
 *
 * FOUR THINGS HAVE TO BE TRUE for this to be transport rather than decoration.
 *
 *   1. THE VEHICLES ARE REAL VEHICLES. They are spawned into the same traffic
 *      model as everything else, on the same lanes, obeying the same signals and
 *      queueing behind the same cars. A bus lane full of buses is therefore a
 *      bus lane full of buses, and a line drawn down a jammed street is slow --
 *      which is the whole reason a player would move it.
 *
 *   2. THE TIMETABLE COMES OUT OF THAT. Headway is the loop's driving time
 *      divided by the fleet, so putting on another bus really does halve the
 *      wait, and a loop that gets stuck in traffic really does thin out.
 *
 *   3. SOMEBODY DECIDES TO USE IT, on the numbers. Mode choice asks this for a
 *      real journey -- the walk to the nearest stop, half a headway of waiting,
 *      the ride between two stops of one line at that line's own speed, and the
 *      walk off the other end -- and takes it or does not. No line near both
 *      ends means no answer, which means nobody catches a bus that does not go
 *      where they are going.
 *
 *   4. IT FILLS UP. Riders are counted against the capacity the fleet actually
 *      provides, and a line over its capacity makes people wait longer, which
 *      makes the journey cost more, which sends some of them back to their cars.
 *      Without that last loop a single bus carries a city.
 *
 * ONE LINE PER JOURNEY. No transfers: a rider needs one line that passes near
 * both ends. That is a real limit and it is stated rather than hidden -- an
 * interchange model wants a graph over stops and a search over it, which is a
 * thing to build when the lines are dense enough to be worth changing between.
 *
 * COST. The routes are solved when a line or a road changes, not per tick. The
 * per-tick work is keeping the vehicles topped up, which is bounded by the
 * fleets the player has paid for. `journey` is asked once per trip decision and
 * is two lookups in a stop grid plus arithmetic.
 */

import { Transit, TRANSIT_SPEC } from '../transit';
import type { TransitLine } from '../transit';
import { Router } from './router';
import { NO_PATH } from './path';
import { Layer } from './path';
import { Traffic, Kind, Driver } from './driving';
import type { LaneGraph, LaneIndex } from './lanes';
import { nearestLane, Use } from './lanes';
import { Places } from './places';

/** Metres a second somebody walks to and from a stop. */
const WALK_SPEED = 1.35;

/** How far off the kerb a stop may be and still find a lane to sit on. */
const STOP_REACH = 140;

/**
 * Metres a cell of the stop lookup grid.
 *
 * About the distance somebody will walk to a bus stop, so a lookup is the cell
 * the traveller is in and its eight neighbours and nothing further -- which is
 * what keeps a question asked once per trip from being a scan over every stop in
 * the city.
 */
const STOP_CELL = 200;

/**
 * The longest a rider will wait, in seconds, however thin the service.
 *
 * Not a fudge: past about twenty minutes people stop treating a service as a
 * service and start treating it as not existing, and a model without this hands
 * a two-hour headway to somebody as a merely expensive option rather than as no
 * option at all.
 */
const WAIT_CAP = 1200;

/** Seconds added to every transit journey: finding the stop, the stairs, luck. */
const FAFF = 90;

/**
 * Metres a rider will walk between two lines' stops to change. Changing is
 * what turns separate lines into a network: without it a bus and a tram that
 * cross in the middle of town carry nobody from one side to the other.
 */
const TRANSFER_WALK = 200;

/**
 * How much over capacity a line has to be before it hurts, and how much.
 *
 * A vehicle at nine-tenths full is a full vehicle as far as anybody standing on
 * it is concerned, so crowding starts to bite before the arithmetic says it is
 * full -- and once it is genuinely over, the wait grows in proportion, because
 * what actually happens is that you watch one go past.
 */
const CROWD_FROM = 0.85;
const CROWD_BITE = 2.2;

/** Vehicles put on or taken off per visit, so a new line fills in rather than pops. */
const FLEET_PER_VISIT = 3;

interface Running {
  line: TransitLine;
  /** The whole loop as one lane path, or NO_PATH if the roads do not join up. */
  route: number;
  /** Seconds to drive the loop once, free-flow. */
  loopSeconds: number;
  /** Metres round the loop. */
  loopMetres: number;
  /** Seconds from the first stop to each stop, going round. */
  atStop: Float64Array;
  /** The lane each stop sits on, or -1. */
  stopLane: Int32Array;
  /** Whether each stop is actually on the route. */
  served: Uint8Array;
  /** Stops the roads could not reach, which the player is told about. */
  skipped: number;
  /** Vehicles currently out on it. */
  out: number[];
  /** Riders who boarded in the last day, and the day before, for the readout. */
  riding: number;
  ridersPerDay: number;
}

/** One line, as the renderer wants it. */
export interface TransitShape {
  id: number;
  kind: number;
  colour: string;
  /** The centreline of the route, x and z interleaved. Empty for a broken line. */
  points: Float32Array;
  /** The stops, x and z interleaved. */
  stops: Float32Array;
  /** One byte per stop: whether the route actually calls there. */
  served: Uint8Array;
  /** Whether the roads join up. A broken line is drawn as its stops alone. */
  works: boolean;
}

export interface TransitReport {
  lines: number;
  vehicles: number;
  /** Riders a day across the whole network. */
  ridersPerDay: number;
  /** Lines whose roads do not join up, which is a thing to tell the player. */
  broken: number;
  /** Mean load against capacity, 0 to 1 and beyond. */
  load: number;
  /** What the fleet costs to run a week. */
  weekly: number;
}

export class TransitNet {
  private runs: Running[] = [];
  private plannedAt = -1;
  /** Stop lookup: cell -> [run index, stop index] pairs, packed. */
  private grid = new Map<number, number[]>();
  private gx0 = 0;
  private gz0 = 0;

  readonly report: TransitReport = {
    lines: 0, vehicles: 0, ridersPerDay: 0, broken: 0, load: 0, weekly: 0,
  };

  constructor(
    private transit: Transit,
    private places: Places,
    private router: Router,
    private g: LaneGraph,
    private index: LaneIndex,
    private traffic: Traffic,
  ) {
    void this.places;
  }

  /** The world, the lanes or both were replaced. */
  rebind(transit: Transit, g: LaneGraph, index: LaneIndex, traffic: Traffic): void {
    this.transit = transit;
    this.g = g;
    this.index = index;
    this.traffic = traffic;
    // Every route named lanes that no longer exist and every vehicle is gone
    // with the traffic model, so the next visit works the whole thing out again.
    for (const r of this.runs) { r.out.length = 0; this.release(r); }
    this.runs = [];
    this.plannedAt = -1;
  }

  private release(r: Running): void {
    if (r.route !== NO_PATH) this.router.release(r.route);
    r.route = NO_PATH;
  }

  /**
   * Works the lines out again, if anything has changed.
   *
   * Everything expensive is here and it only runs on an edit: a route per leg of
   * every line, which is a handful of searches the router does immediately rather
   * than through its per-tick budget -- this is an edit, and an edit is allowed
   * to cost what an edit costs.
   */
  plan(): void {
    if (this.plannedAt === this.transit.version) return;
    this.plannedAt = this.transit.version;

    // Vehicles first: they hold route handles into paths that are about to go.
    for (const r of this.runs) {
      for (const v of r.out) this.traffic.despawn(v);
      r.out.length = 0;
      this.release(r);
    }
    const before = new Map<number, Running>();
    for (const r of this.runs) before.set(r.line.id, r);
    this.runs = [];

    let broken = 0;
    for (const line of this.transit.lines) {
      const run = this.build(line, before.get(line.id));
      if (run.route === NO_PATH) broken++;
      this.runs.push(run);
    }
    this.report.lines = this.runs.length;
    this.report.broken = broken;
    this.buildGrid();
    this.buildTransfers();
  }

  /**
   * Where each pair of lines comes close enough to change between, found once
   * when the lines change: for a pair, the closest two stops within a short
   * walk. Lines are few (a city has tens, not thousands), so the pairwise pass
   * is small, and a journey then asks a map rather than searching.
   */
  private transfers = new Map<number, [number, number, number]>();
  private buildTransfers(): void {
    this.transfers.clear();
    for (let a = 0; a < this.runs.length; a++) {
      const ra = this.runs[a];
      if (ra.route === NO_PATH) continue;
      for (let b = 0; b < this.runs.length; b++) {
        if (a === b) continue;
        const rb = this.runs[b];
        if (rb.route === NO_PATH) continue;
        let best: [number, number, number] | null = null;
        for (let i = 0; i < ra.served.length; i++) {
          if (ra.served[i] === 0) continue;
          for (let j = 0; j < rb.served.length; j++) {
            if (rb.served[j] === 0) continue;
            const d = Math.hypot(ra.line.stops[i * 2] - rb.line.stops[j * 2],
              ra.line.stops[i * 2 + 1] - rb.line.stops[j * 2 + 1]);
            if (d <= TRANSFER_WALK && (best === null || d < best[2])) best = [i, j, d];
          }
        }
        if (best !== null) this.transfers.set(a * 4096 + b, best);
      }
    }
  }

  /**
   * Every stop a working line calls at, as x, z and how far people will walk
   * to it -- for the coverage model, so a street a bus serves counts as served.
   */
  stopDiscs(out: number[]): void {
    out.length = 0;
    for (const r of this.runs) {
      if (r.route === NO_PATH) continue;
      const walk = TRANSIT_SPEC[r.line.kind].walk;
      for (let i = 0; i < r.served.length; i++) {
        if (r.served[i] === 0) continue;
        out.push(r.line.stops[i * 2], r.line.stops[i * 2 + 1], walk);
      }
    }
  }

  /**
   * One line's loop, as a single lane path.
   *
   * Concatenated rather than driven leg by leg, because a vehicle that arrives
   * and is respawned at every stop leaves the queue it was in and rejoins at the
   * back of the next one -- which on a busy street reads as a bus teleporting
   * past the traffic. One path means one vehicle drives the whole loop the way a
   * bus actually does, and the stops are positions along it.
   */
  private build(line: TransitLine, was: Running | undefined): Running {
    const g = this.g;
    const stops = line.stops.length / 2;
    const stopLane = new Int32Array(stops).fill(-1);
    for (let i = 0; i < stops; i++) {
      stopLane[i] = nearestLane(g, this.index, line.stops[i * 2], line.stops[i * 2 + 1],
        Use.BUS, STOP_REACH);
    }
    const run: Running = {
      line, route: NO_PATH, loopSeconds: 0, loopMetres: 0,
      atStop: new Float64Array(stops), served: new Uint8Array(stops), stopLane,
      skipped: 0, out: [], riding: 0, ridersPerDay: was?.ridersPerDay ?? 0,
    };

    // The first stop a vehicle can actually reach. Everything is relative to it,
    // including the loop that closes back onto it.
    let first = -1;
    for (let i = 0; i < stops; i++) if (stopLane[i] >= 0) { first = i; break; }
    if (first < 0) { run.skipped = stops; return run; }

    // A stop the roads cannot reach is dropped from the route rather than taken
    // as a reason to abandon the line. One stop on the wrong side of a
    // demolished street should cost the player that stop, not the service --
    // and the stop still draws, hollow, so they can see which one it was.
    const lanes: number[] = [];
    let seconds = 0, metres = 0;
    let prev = first;
    run.served[first] = 1;
    run.atStop[first] = 0;

    const leg = (from: number, to: number): boolean => {
      if (from === to) return true;
      const h = this.router.solveNow(Layer.BUS, from, to);
      if (h === NO_PATH) return false;
      const path = this.router.paths.view(h);
      for (let k = lanes.length === 0 ? 0 : 1; k < path.length; k++) {
        const lane = path[k];
        lanes.push(lane);
        seconds += g.free[lane];
        metres += g.length[lane];
      }
      this.router.release(h);
      return true;
    };

    const dwell = TRANSIT_SPEC[line.kind].dwell;
    for (let n = 1; n <= stops; n++) {
      const i = (first + n) % stops;
      const closing = n === stops;
      if (!closing && stopLane[i] < 0) { run.skipped++; continue; }
      if (!leg(stopLane[prev], stopLane[i])) {
        if (closing) return run;          // it cannot get home; it is not a loop
        run.skipped++;
        continue;
      }
      seconds += dwell;
      if (closing) break;
      run.served[i] = 1;
      run.atStop[i] = seconds;
      prev = i;
    }
    if (lanes.length < 2) return run;

    run.route = this.router.paths.alloc(Int32Array.from(lanes), lanes.length);
    run.loopSeconds = Math.max(1, seconds);
    run.loopMetres = metres;
    return run;
  }

  /** The stop lookup, rebuilt whenever the lines are. */
  private buildGrid(): void {
    this.grid.clear();
    let x0 = Infinity, z0 = Infinity;
    for (const r of this.runs) {
      for (let i = 0; i < r.line.stops.length; i += 2) {
        x0 = Math.min(x0, r.line.stops[i]);
        z0 = Math.min(z0, r.line.stops[i + 1]);
      }
    }
    if (!Number.isFinite(x0)) { this.gx0 = 0; this.gz0 = 0; return; }
    this.gx0 = x0; this.gz0 = z0;
    for (let ri = 0; ri < this.runs.length; ri++) {
      const r = this.runs[ri];
      if (r.route === NO_PATH) continue;
      for (let i = 0; i < r.line.stops.length; i += 2) {
        if (r.served[i / 2] === 0) continue;
        const key = this.cellKey(r.line.stops[i], r.line.stops[i + 1]);
        let bucket = this.grid.get(key);
        if (bucket === undefined) { bucket = []; this.grid.set(key, bucket); }
        bucket.push(ri, i / 2);
      }
    }
  }

  private cellKey(x: number, z: number): number {
    const cx = Math.floor((x - this.gx0) / STOP_CELL);
    const cz = Math.floor((z - this.gz0) / STOP_CELL);
    // Packed, biased so negatives are fine. A map key, not an array index.
    return (cz + 4096) * 8192 + (cx + 4096);
  }

  /**
   * The nearest stop to a point, per line, within that line's walking distance.
   *
   * Written into `out` as [run, stop, metres] triples so the caller can compare
   * the two ends without allocating -- this is asked twice for every trip
   * decision the city makes, which is a few hundred a tick.
   */
  private stopsNear(x: number, z: number, out: number[]): void {
    out.length = 0;
    const cx = Math.floor((x - this.gx0) / STOP_CELL);
    const cz = Math.floor((z - this.gz0) / STOP_CELL);
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const bucket = this.grid.get((cz + j + 4096) * 8192 + (cx + i + 4096));
        if (bucket === undefined) continue;
        for (let k = 0; k < bucket.length; k += 2) {
          const ri = bucket[k], si = bucket[k + 1];
          const r = this.runs[ri];
          const dx = r.line.stops[si * 2] - x, dz = r.line.stops[si * 2 + 1] - z;
          const d = Math.hypot(dx, dz);
          if (d > TRANSIT_SPEC[r.line.kind].walk) continue;
          // One stop per line, the nearest. Two stops of the same line in range
          // is common at a corner and the further one is never the answer.
          let seen = -1;
          for (let q = 0; q < out.length; q += 3) if (out[q] === ri) { seen = q; break; }
          if (seen < 0) { out.push(ri, si, d); continue; }
          if (d < out[seen + 2]) { out[seen + 1] = si; out[seen + 2] = d; }
        }
      }
    }
  }

  private readonly fromStops: number[] = [];
  private readonly toStops: number[] = [];

  /**
   * What a journey by public transport would take, in seconds, or -1.
   *
   * The real thing: walk, wait, ride, walk. The wait is half a headway because
   * somebody who does not read a timetable arrives at a random moment, plus
   * whatever crowding is adding -- a line over its capacity is a line you watch
   * one go past on.
   */
  journey(ax: number, az: number, bx: number, bz: number): number {
    if (this.runs.length === 0) return -1;
    const from = this.fromStops, to = this.toStops;
    this.stopsNear(ax, az, from);
    if (from.length === 0) return -1;
    this.stopsNear(bx, bz, to);
    if (to.length === 0) return -1;

    let best = -1;
    for (let i = 0; i < from.length; i += 3) {
      const ri = from[i];
      for (let k = 0; k < to.length; k += 3) {
        if (to[k] !== ri) continue;
        const r = this.runs[ri];
        const a = from[i + 1], b = to[k + 1];
        if (a === b) continue;                    // the same stop is a walk
        const ride = this.rideSeconds(r, a, b);
        if (ride < 0) continue;
        const seconds = (from[i + 2] + to[k + 2]) / WALK_SPEED
          + this.waitSeconds(r) + ride + FAFF;
        if (best < 0 || seconds < best) best = seconds;
      }
    }
    // And with one change, where no single line does it faster.
    if (this.transfers.size > 0) {
      for (let i = 0; i < from.length; i += 3) {
        const ra = from[i];
        for (let k = 0; k < to.length; k += 3) {
          const rb = to[k];
          if (rb === ra) continue;
          const t = this.transfers.get(ra * 4096 + rb);
          if (t === undefined) continue;
          const first = this.rideSeconds(this.runs[ra], from[i + 1], t[0]);
          const second = this.rideSeconds(this.runs[rb], t[1], to[k + 1]);
          if (first < 0 || second < 0) continue;
          const seconds = (from[i + 2] + t[2] + to[k + 2]) / WALK_SPEED
            + this.waitSeconds(this.runs[ra]) + first
            + this.waitSeconds(this.runs[rb]) + second + FAFF * 1.6;
          if (best < 0 || seconds < best) best = seconds;
        }
      }
    }
    return best;
  }

  /**
   * Whether any line stops within walking distance of a point.
   *
   * Not the same question as `journey`, which is about a trip: this is "does the
   * bus come here", which is what a building is asking when it complains about
   * being hard to get to.
   */
  reaches(x: number, z: number): boolean {
    if (this.runs.length === 0) return false;
    this.stopsNear(x, z, this.fromStops);
    return this.fromStops.length > 0;
  }

  /** Seconds between two stops of a line, going the way the vehicles go. */
  private rideSeconds(r: Running, a: number, b: number): number {
    if (r.route === NO_PATH) return -1;
    const d = r.atStop[b] - r.atStop[a];
    return d >= 0 ? d : d + r.loopSeconds;
  }

  /** Half a headway, plus what the crowding adds. */
  private waitSeconds(r: Running): number {
    const headway = r.loopSeconds / Math.max(1, r.line.fleet);
    const cap = TRANSIT_SPEC[r.line.kind].capacity * r.line.fleet;
    // Riders a day against what the fleet can carry in a day. Loops a day times
    // the capacity of each, which is the honest measure of a line's throughput.
    const loopsPerDay = (24 * 3600) / r.loopSeconds;
    const canCarry = Math.max(1, cap * loopsPerDay * 0.35);
    const load = r.ridersPerDay / canCarry;
    const crowd = load > CROWD_FROM ? 1 + (load - CROWD_FROM) * CROWD_BITE : 1;
    return Math.min(WAIT_CAP, (headway / 2) * crowd);
  }

  /**
   * Somebody got on.
   *
   * Counted per line, because crowding is a property of a line rather than of a
   * network: a packed tram and an empty bus in the same city are two different
   * journeys, and averaging them would tell the player neither.
   */
  board(ax: number, az: number, bx: number, bz: number): void {
    const from = this.fromStops, to = this.toStops;
    this.stopsNear(ax, az, from);
    if (from.length === 0) return;
    this.stopsNear(bx, bz, to);
    for (let i = 0; i < from.length; i += 3) {
      for (let k = 0; k < to.length; k += 3) {
        if (to[k] !== from[i]) continue;
        this.runs[from[i]].riding++;
        return;
      }
    }
  }

  /**
   * Keeps the fleets on the road.
   *
   * A few a visit rather than all of them, because a player who puts twenty
   * trams on a line should not get twenty trams in one tick -- and because a
   * spawn can be refused when there is no room at the kerb, which is the traffic
   * model's answer and the right one.
   */
  run(): void {
    this.plan();
    let vehicles = 0, weekly = 0, load = 0, lines = 0;
    let budget = FLEET_PER_VISIT;
    for (const r of this.runs) {
      // Anything that finished the loop goes round again. Cheaper than watching
      // the arrival list: a vehicle that is gone from the table is gone.
      for (let i = r.out.length - 1; i >= 0; i--) {
        if (this.traffic.table.live[r.out[i]] === 0) r.out.splice(i, 1);
      }
      const spec = TRANSIT_SPEC[r.line.kind];
      weekly += spec.weekly * r.line.fleet;
      if (r.route === NO_PATH) continue;
      lines++;
      vehicles += r.out.length;
      const cap = Math.max(1, spec.capacity * r.line.fleet
        * ((24 * 3600) / r.loopSeconds) * 0.35);
      load += r.ridersPerDay / cap;
      while (r.out.length < r.line.fleet && budget > 0) {
        budget--;
        const lane = this.g.count > 0 ? this.router.paths.at(r.route, 0) : -1;
        if (lane < 0) break;
        this.router.paths.retain(r.route);
        const v = this.traffic.spawn(-1, r.line.kind === 0 ? Kind.BUS : Kind.BUS,
          Driver.AVERAGE, lane, r.route, 0);
        if (v < 0) { this.router.paths.release(r.route); break; }
        r.out.push(v);
      }
    }
    this.report.vehicles = vehicles;
    this.report.weekly = weekly;
    this.report.load = lines > 0 ? load / lines : 0;
  }

  /**
   * Rolls the day's ridership over.
   *
   * A day at a time rather than a running average, because the number the player
   * reads is "riders a day" and a smoothed one would disagree with the figure on
   * the panel beside it.
   */
  endOfDay(): void {
    let total = 0;
    for (const r of this.runs) {
      r.ridersPerDay = r.riding;
      total += r.riding;
      r.riding = 0;
    }
    this.report.ridersPerDay = total;
  }

  /** Riders a day on one line, for the panel. */
  ridersOf(id: number): number {
    const r = this.runs.find((q) => q.line.id === id);
    return r === undefined ? 0 : r.ridersPerDay;
  }

  /** Whether a line's roads join up, for the panel and for the tool's warning. */
  worksOf(id: number): boolean {
    const r = this.runs.find((q) => q.line.id === id);
    return r !== undefined && r.route !== NO_PATH;
  }

  /**
   * The lines as something that can be drawn: the road they actually run on.
   *
   * The chord between two stops is not the route -- it cuts across blocks, over
   * the river and through buildings -- so what comes out is the centreline of
   * every lane the vehicles drive, in order. Asked for only when a line or a road
   * changes, which is when the mesh is rebuilt anyway.
   */
  shape(): TransitShape[] {
    const g = this.g;
    const out: TransitShape[] = [];
    for (const r of this.runs) {
      const spec = TRANSIT_SPEC[r.line.kind];
      if (r.route === NO_PATH) {
        // A broken line is still drawn, as the stops on their own. A player who
        // has just put one down needs to see where it went, and an empty map is
        // indistinguishable from the click having missed.
        out.push({
          id: r.line.id, kind: r.line.kind, colour: spec.colour,
          points: new Float32Array(0), stops: Float32Array.from(r.line.stops),
          served: r.served.slice(), works: false,
        });
        continue;
      }
      const path = this.router.paths.view(r.route);
      const points = new Float32Array((path.length + 1) * 2);
      for (let i = 0; i < path.length; i++) {
        points[i * 2] = g.ax[path[i]];
        points[i * 2 + 1] = g.az[path[i]];
      }
      const last = path[path.length - 1];
      points[path.length * 2] = g.bx[last];
      points[path.length * 2 + 1] = g.bz[last];
      out.push({
        id: r.line.id, kind: r.line.kind, colour: spec.colour,
        points, stops: Float32Array.from(r.line.stops),
        served: r.served.slice(), works: true,
      });
    }
    return out;
  }

  /** Bumped whenever `shape` would return something different. */
  get shapeVersion(): number { return this.plannedAt; }

  /** Stops of a line the roads cannot reach, for the tool's warning. */
  skippedOf(id: number): number {
    const r = this.runs.find((q) => q.line.id === id);
    return r === undefined ? 0 : r.skipped;
  }

  bytes(): number {
    let n = 0;
    for (const r of this.runs) n += r.atStop.byteLength + r.stopLane.byteLength + 64;
    return n + this.grid.size * 48;
  }
}
