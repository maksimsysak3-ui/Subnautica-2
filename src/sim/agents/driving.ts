/**
 * Driving: vehicles that follow each other, wait at junctions, and change lanes.
 *
 * WHY THIS IS SEPARATE FROM THE JOURNEYS, which is not a shortcut but arithmetic.
 * A game day is ninety real seconds and nine hundred ticks, so one tick is
 * ninety-six *game* seconds. A car at fifty kilometres an hour covers thirteen
 * hundred metres in one of those -- three hundred car lengths -- and crosses the
 * whole city in under three ticks. No following model works at that step; none can,
 * because the thing being modelled is a four-metre gap. Making it work would mean
 * game time running at about real time, which is a day every two and a half hours,
 * and that is not a city builder.
 *
 * So the two halves of traffic run on two clocks and do two different jobs, and
 * every city builder with a compressed day is built this way whether it says so or
 * not. The flow model in `routine.ts` runs on game time and answers the questions
 * the simulation needs: how long a journey takes, how loaded each road is, what the
 * router should avoid. This runs on real time and answers the question the *player*
 * asks, which is whether the streets look like streets.
 *
 * The link between them is density. Vehicles are spawned in proportion to the lane
 * load the flow model computed, near wherever the player is looking, so a road the
 * simulation thinks is jammed is a road with a queue on it -- and a road it thinks
 * is empty is empty. What the vehicles do once they are there is entirely real:
 * they follow each other, they wait at lights, they give way, they change lanes
 * when they are stuck. They are a *sample of the traffic*, not somebody's
 * particular car, and nothing about watching one can tell the difference.
 *
 * THE QUEUE IS THE DATA STRUCTURE. Vehicles on a lane are a doubly linked list
 * ordered by how far along they are, because that order is stable: car-following
 * stops anybody overtaking within a lane, so a vehicle that joins at the back
 * stays at the back until it leaves. So "who is in front of me" -- the question
 * the whole model is built on, asked once per vehicle per tick -- is one array
 * read, and joining or leaving is a constant-time relink. The alternative, sorting
 * or searching a lane's vehicles each tick, is what makes this kind of model
 * expensive for no reason.
 *
 * THE FOLLOWING MODEL is the intelligent driver model: a free-road term that
 * accelerates towards the speed limit and an interaction term that brakes for a
 * gap that is closing. It is the standard choice and it earns it -- it produces
 * stop-and-go waves, it never collides if the parameters are sane, and every
 * parameter in it is something a person can picture: how hard I accelerate, how
 * hard I am willing to brake, how many seconds of headway I keep, how close I will
 * sit at a standstill.
 *
 * DRIVER PERSONALITIES are those parameters, not a separate behaviour tree. A
 * pushy driver keeps a second of headway and exceeds the limit; a cautious one
 * keeps two and a half and does not. That difference alone produces overtaking
 * pressure, uneven queue discharge and the odd near-miss at a give-way, which is
 * most of what makes traffic look alive.
 *
 * A JUNCTION IS A WALL until it lets you through. Rather than a separate state
 * machine for stopping, an unavailable junction is fed to the same following model
 * as a stationary obstacle at the stop line -- so a vehicle approaching a red
 * light decelerates on exactly the curve it would use behind a stopped car, and
 * the light turning green removes the obstacle. One model, no transitions to get
 * wrong.
 */

import { Table } from './store';
import { Rng } from './rand';
import { Junctions, Control, Light } from './junctions';
import type { LaneGraph } from './lanes';
import { TICK_HZ } from './tick';

/** How a person drives. */
export const Driver = { CAUTIOUS: 0, AVERAGE: 1, PUSHY: 2 } as const;
export const DRIVER_NAMES = ['cautious', 'average', 'pushy'] as const;

/** What is being driven. */
export const Kind = { CAR: 0, BUS: 1, LORRY: 2, EMERGENCY: 3 } as const;
export const KIND_NAMES = ['car', 'bus', 'lorry', 'emergency'] as const;

/** Metres. Bumper to bumper. */
const LENGTH = [4.4, 12.0, 10.5, 5.6];

interface Style {
  /** Metres a second a second, accelerating. */
  accel: number;
  /** Comfortable deceleration. Braking harder than this is an emergency. */
  brake: number;
  /** Seconds of headway kept at speed. The single most important number here. */
  headway: number;
  /** Metres left at a standstill. */
  gap: number;
  /** What they do with a speed limit. */
  limit: number;
}

const STYLE: Style[] = [];
STYLE[Driver.CAUTIOUS] = { accel: 1.1, brake: 1.8, headway: 2.4, gap: 2.6, limit: 0.92 };
STYLE[Driver.AVERAGE] = { accel: 1.6, brake: 2.4, headway: 1.6, gap: 2.1, limit: 1.0 };
STYLE[Driver.PUSHY] = { accel: 2.4, brake: 3.2, headway: 1.0, gap: 1.5, limit: 1.14 };

/** How the city's drivers are distributed. */
const MIX = [0.26, 0.56, 0.18];

/** The hardest anybody brakes, for a light that changed or a car that stopped. */
const EMERGENCY_BRAKE = 7.0;

/**
 * Metres before a junction at which a vehicle starts watching it, and the distance
 * at which it commits.
 *
 * Two distances, not one, and the difference matters a great deal. Watching from
 * fifty metres is what lets a vehicle slow for a red light instead of arriving at
 * one at speed. Committing -- taking a slot in the junction -- happens at the line,
 * because a vehicle that reserved the junction fifty metres out would hold it for
 * the five seconds it took to get there, and a busy crossroads would pass one car
 * at a time.
 */
const LOOK_AHEAD = 55;
const COMMIT_METRES = 9;
/** Metres from the line at which a vehicle registers as demand at a signal. */
const WAITING_METRES = 30;

/**
 * Ticks a junction slot is held if the vehicle never reports clear of it.
 *
 * A backstop against a vehicle that stalls inside a junction, not an estimate of
 * how long crossing takes -- the slot is given back the moment the vehicle is
 * through, which is what makes "while it holds a slot, it is in the junction" a
 * guarantee rather than an approximation. Ten seconds is far longer than any
 * crossing and short enough that a stall clears before anybody notices.
 */
const BOX_HOLD_TICKS = 10 * TICK_HZ;

/**
 * Below this, a vehicle counts as stopped.
 *
 * Used for the waiting counter and for lane changing. Not zero, because a vehicle
 * creeping at a tenth of a metre a second is stopped as far as anybody watching is
 * concerned, and treating it as moving means a queue that never reports itself.
 */
const CRAWL = 0.4;

/** Ticks of being stopped before a driver looks for another lane. */
const PATIENCE_TICKS = 12;

/** Lane changes considered per tick, across the whole city. */
const LANE_CHANGES_PER_TICK = 64;

/**
 * How much of the flow model's density is put on the road.
 *
 * `nearbyLoad` is already a count of vehicles -- load times lane length over nine
 * metres -- so this is a straight fraction of it, and a fraction rather than all of
 * it because a lane at capacity bumper to bumper is a car park, not traffic. Two
 * thirds reads as a busy street.
 */
const VEHICLES_PER_LOAD = 0.66;

/**
 * Load every road is treated as having, however empty.
 *
 * Without it a city whose flow model says every road is clear has no cars on it at
 * all, which reads as a ghost town rather than as free-flowing traffic. A small
 * floor puts a believable trickle everywhere and leaves the *differences* between
 * roads intact, which is what the density is for.
 */
const IDLE_LOAD = 0.06;

const SCHEMA = {
  /** The citizen this is carrying, or -1 for a vehicle the city owns. */
  owner: Int32Array,
  kind: Uint8Array,
  driver: Uint8Array,
  /** Where it is: the lane, and how far along it the front bumper is. */
  lane: Int32Array,
  along: Float32Array,
  speed: Float32Array,
  /** Metres. Copied from the kind so the inner loop never indexes a table. */
  length: Float32Array,
  /**
   * The route being driven and how far along it, or -1 to wander.
   *
   * Ambient traffic wanders: at each junction it picks a way on, weighted towards
   * bigger and emptier roads, which is indistinguishable from watching cars with
   * destinations and costs the router nothing at all. A bus or a fire engine has a
   * real route, and drives it with the same model.
   */
  route: Int32Array,
  step: Uint16Array,
  /** The queue on this lane: towards the front, and towards the back. */
  ahead: Int32Array,
  behind: Int32Array,
  /** Ticks spent stopped, for patience and for the readout. */
  stopped: Uint16Array,
  /** The junction slot being held, or -1. */
  inBox: Int32Array,
  /** Set when the vehicle has been cleared to cross the junction ahead. */
  cleared: Uint8Array,
  /**
   * The lane decided on for the junction ahead, or -1 for undecided.
   *
   * Remembered rather than re-asked, because a wandering driver's choice is a random
   * draw: asking twice gives two different answers, so the vehicle reserved the
   * junction for one movement and then made a different one -- and the conflict rule
   * was then protecting a movement nobody performed.
   */
  next: Int32Array,
  /**
   * The dispatch request this vehicle is answering, as a handle, or -1.
   *
   * A handle rather than a row, so a vehicle still driving to a fire that was
   * closed under it -- the building demolished, the call timed out -- finds nothing
   * there instead of finding whoever took the row. `owner` could have carried it as
   * a negative number and that is exactly the sort of encoding that is obvious for
   * a week and a bug for a year.
   */
  job: Int32Array,
} as const;

/** What the traffic did, for the readout. */
export interface TrafficStats {
  /** Vehicles on the road. */
  driving: number;
  /** Spawned and finished since founding. */
  spawned: number;
  finished: number;
  /** Refused because the budget was full. */
  refused: number;
  /** Vehicles stopped right now, and the worst wait seen. */
  stopped: number;
  worstWaitSeconds: number;
  /** Lane changes made. */
  changes: number;
  /** Times a vehicle had to brake harder than comfortable. */
  hardBrakes: number;
  /** Mean speed of everything moving, metres a second. */
  meanSpeed: number;
  /** Vehicles removed because they could go no further. */
  abandoned: number;
}

export class Traffic {
  readonly table = new Table(SCHEMA, 2048);
  private readonly rng: Rng;
  /** The queue on each lane: nearest the end, and nearest the start. */
  private laneHead: Int32Array;
  private laneTail: Int32Array;
  /** How many vehicles are on each lane, for the readout and for lane changes. */
  private laneCount: Int32Array;
  /**
   * Whether somebody is at the line on each lane, for the signals to read.
   *
   * The demand signal that makes a junction vehicle-actuated, and it costs nothing:
   * the driving model already works out how far each vehicle is from the end of its
   * lane, so this is one byte written while it is there.
   */
  readonly waiting: Uint8Array;

  /** Vehicles that reached the end of their route, for the caller to deal with. */
  readonly arrived: number[] = [];
  /** Vehicles that could go no further and were taken off the road. */
  readonly stuck: number[] = [];

  readonly stats: TrafficStats = {
    driving: 0, spawned: 0, finished: 0, refused: 0, stopped: 0,
    worstWaitSeconds: 0, changes: 0, hardBrakes: 0, meanSpeed: 0, abandoned: 0,
  };

  constructor(readonly g: LaneGraph, readonly junctions: Junctions,
    readonly budget: number, seed = 0xd214e) {
    this.rng = new Rng(seed);
    this.laneHead = new Int32Array(g.count).fill(-1);
    this.laneTail = new Int32Array(g.count).fill(-1);
    this.laneCount = new Int32Array(g.count);
    this.waiting = new Uint8Array(g.count);
  }

  get count(): number { return this.table.size; }
  get col(): typeof this.table.col { return this.table.col; }
  get bound(): number { return this.table.bound; }
  get live(): Uint8Array { return this.table.live; }

  /** A driver drawn from the city's mix. */
  drawDriver(): number {
    const r = this.rng.next();
    return r < MIX[0] ? Driver.CAUTIOUS : r < MIX[0] + MIX[1] ? Driver.AVERAGE : Driver.PUSHY;
  }

  /**
   * Puts a vehicle on the road at the start of a lane, or refuses.
   *
   * Refused when the budget is full or when there is no room at the kerb. Refusing
   * is the correct answer to both: a vehicle that cannot be fitted in is a
   * traveller who is resolved the cheap way instead, and forcing one in on top of
   * another is the one thing this model must never do.
   */
  spawn(owner: number, kind: number, driver: number,
    lane: number, route: number, step: number): number {
    if (this.table.size >= this.budget) { this.stats.refused++; return -1; }
    if (lane < 0 || lane >= this.g.count) { this.stats.refused++; return -1; }
    const len = LENGTH[kind];
    const style = STYLE[driver];
    // Room at the back of the lane's queue.
    const last = this.laneTail[lane];
    if (last >= 0) {
      const c = this.table.col;
      if (c.along[last] - c.length[last] < len + style.gap) {
        this.stats.refused++;
        return -1;
      }
    }
    const v = this.table.add();
    const c = this.table.col;
    c.owner[v] = owner;
    c.kind[v] = kind;
    c.driver[v] = driver;
    c.lane[v] = lane;
    c.along[v] = 0;
    // Joining at the speed of whatever is already there, up to the limit, so a
    // vehicle does not appear at forty miles an hour inside a stationary queue.
    c.speed[v] = last >= 0 ? Math.min(c.speed[last], this.g.speed[lane]) : this.g.speed[lane] * 0.4;
    c.length[v] = len;
    c.route[v] = route;
    c.step[v] = step;
    c.stopped[v] = 0;
    c.inBox[v] = -1;
    c.cleared[v] = 0;
    c.next[v] = -1;
    c.job[v] = -1;
    this.link(v, lane);
    this.stats.spawned++;
    return v;
  }

  /** Takes a vehicle off the road. */
  despawn(v: number): void {
    if (this.table.live[v] === 0) return;
    const c = this.table.col;
    this.unlink(v);
    if (c.inBox[v] >= 0) this.junctions.leave(c.inBox[v], v);
    this.table.remove(v);
  }

  // ---- the queue ---------------------------------------------------------

  /** Adds a vehicle to the back of a lane's queue. */
  private link(v: number, lane: number): void {
    const c = this.table.col;
    const last = this.laneTail[lane];
    c.ahead[v] = last;
    c.behind[v] = -1;
    if (last >= 0) c.behind[last] = v; else this.laneHead[lane] = v;
    this.laneTail[lane] = v;
    this.laneCount[lane]++;
  }

  /**
   * Puts a vehicle into a lane's queue at the right place for where it is.
   *
   * Walked from the back towards the front until somebody is at least as far along
   * as this vehicle -- that one is its leader, and whatever was behind that one is
   * now behind this. It is worth spelling out because getting the direction wrong
   * produces a list that is *nearly* sorted: the model then reads the wrong vehicle
   * as its leader, follows a car that is actually behind it, and drives straight
   * through the one in front. Nine overlaps in a minute, and no error anywhere.
   */
  private linkAt(v: number, lane: number, along: number): void {
    const c = this.table.col;
    let front = this.laneTail[lane];
    while (front >= 0 && c.along[front] < along) front = c.ahead[front];
    const behind = front >= 0 ? c.behind[front] : this.laneHead[lane];
    c.ahead[v] = front;
    c.behind[v] = behind;
    if (front >= 0) c.behind[front] = v; else this.laneHead[lane] = v;
    if (behind >= 0) c.ahead[behind] = v; else this.laneTail[lane] = v;
    this.laneCount[lane]++;
  }

  /**
   * Takes a vehicle out of its lane's queue.
   *
   * `ahead` of -1 means this vehicle *is* the head, so the head becomes whatever was
   * behind it; `behind` of -1 means it is the tail. Having those two the wrong way
   * round leaves `laneHead` pointing at a vehicle that has gone -- and since the row
   * gets reused, at whatever vehicle takes its place, which closes the list into a
   * ring. The walk over a lane's queue then never ends.
   */
  private unlink(v: number): void {
    const c = this.table.col;
    const lane = c.lane[v];
    const a = c.ahead[v], b = c.behind[v];
    if (a >= 0) c.behind[a] = b; else this.laneHead[lane] = b;
    if (b >= 0) c.ahead[b] = a; else this.laneTail[lane] = a;
    c.ahead[v] = -1; c.behind[v] = -1;
    if (this.laneCount[lane] > 0) this.laneCount[lane]--;
  }

  // ---- driving -----------------------------------------------------------

  /**
   * One step of the model, for every vehicle.
   *
   * Walked from the front of each queue backwards would be tidier; walked over the
   * table is faster, because the table is one contiguous run and the queues are
   * pointer-chases. The order does not matter: every vehicle reads the position its
   * leader had at the start of the tick, which is the standard way to integrate
   * this and avoids the follower seeing a leader that has already moved.
   */
  drive(dt: number, tick: number, seconds: number): void {
    const c = this.table.col;
    const live = this.table.live;
    const bound = this.table.bound;
    const g = this.g;

    let moving = 0, speedSum = 0, stoppedNow = 0;
    let changesLeft = LANE_CHANGES_PER_TICK;
    this.waiting.fill(0);
    this.arrived.length = 0;
    this.stuck.length = 0;

    for (let v = 0; v < bound; v++) {
      if (live[v] === 0) continue;
      const lane = c.lane[v];
      const style = STYLE[c.driver[v]];
      const v0 = Math.max(2, g.speed[lane] * style.limit);
      const speed = c.speed[v];
      const laneLength = g.length[lane];

      // What is in the way: the vehicle in front on this lane, or the junction at
      // the end of it, or nothing.
      let gap = Infinity, closing = 0;
      const leader = c.ahead[v];
      if (leader >= 0) {
        gap = c.along[leader] - c.length[leader] - c.along[v];
        closing = speed - c.speed[leader];
      }

      // The junction. Only worth asking about once inside looking distance, which
      // keeps the signal lookup off almost every vehicle on almost every tick.
      const toEnd = laneLength - c.along[v];
      // Already cleared: keep the reservation alive. A slow vehicle that lost its
      // slot mid-crossing is how two conflicting movements end up in one junction.
      if (c.cleared[v] === 1 && c.inBox[v] >= 0) {
        this.junctions.refresh(c.inBox[v], v, tick, BOX_HOLD_TICKS);
      }
      if (toEnd < LOOK_AHEAD && c.cleared[v] === 0) {
        const node = g.to[lane];
        const next = this.decide(v);
        if (next === -1) {
          // Journey's end: the destination is the far end of this lane, so treat
          // the end as a stopping point and finish when it is reached.
          if (toEnd < gap) { gap = toEnd; closing = speed; }
        } else if (next < 0) {
          // No continuation at all -- the route is void. Stop, and be taken off.
          if (toEnd < gap) { gap = toEnd; closing = speed; }
          this.stuck.push(v);
        } else {
          // Tell the signals somebody is here. Written before asking about the
          // light, so a junction sees the demand on the same tick it is created --
          // otherwise a lone car at a red light waits a tick longer than it has to,
          // every time, which at a hundred junctions is visible.
          if (toEnd < WAITING_METRES) this.waiting[lane] = 1;
          // Only the vehicle at the front of its lane's queue may take a slot in
          // the junction. Anybody behind it cannot reach the line anyway, and a
          // reservation it cannot use is held until the backstop expires -- at
          // which point something conflicting is admitted while it is still
          // sitting there. That was the whole of the conflict problem.
          const atFront = leader < 0;
          const shut = (toEnd < COMMIT_METRES && atFront)
            ? !this.commit(v, lane, node, next, tick, seconds)
            : this.watching(v, lane, node, next, tick, seconds);
          if (shut) {
            // A closed junction is an obstacle at the stop line, fed to the same
            // model as a stopped car. No separate braking law, no transitions.
            const stop = Math.max(0, toEnd - 1.5);
            if (stop < gap) { gap = stop; closing = speed; }
          } else if (toEnd < COMMIT_METRES && leader < 0) {
            c.cleared[v] = 1;
          }
        }
      }

      // The intelligent driver model.
      const free = 1 - Math.pow(speed / v0, 4);
      let accel = style.accel * free;
      if (gap < Infinity) {
        const want = style.gap + Math.max(0,
          speed * style.headway + (speed * closing) / (2 * Math.sqrt(style.accel * style.brake)));
        // A gap that has gone negative or tiny means something went wrong upstream;
        // clamping it keeps the term finite instead of producing an infinite brake
        // and a vehicle that teleports backwards.
        const s = Math.max(0.35, gap);
        accel = style.accel * (free - (want / s) * (want / s));
      }
      if (accel < -EMERGENCY_BRAKE) {
        accel = -EMERGENCY_BRAKE;
        // Only a vehicle that was actually moving has had to brake hard. A queue
        // inching forward against a red light produces the same number from the
        // model every tick, and counting those makes the figure meaningless.
        if (speed > 1.5) this.stats.hardBrakes++;
      }

      let next = speed + accel * dt;
      if (next < 0) next = 0;
      if (next > v0 * 1.05) next = v0 * 1.05;
      // Never drive into the thing in front, whatever the model says -- and when
      // the step is clamped, the speed has to be clamped with it. Leaving the speed
      // at what the model wanted while the vehicle moved five centimetres makes the
      // next tick see a car doing ten metres a second five centimetres from an
      // obstacle, which is an emergency stop, every tick, for the whole queue. It
      // reported as seventeen thousand hard brakes a minute and it was arithmetic,
      // not traffic.
      const want = next * dt;
      const travel = Math.min(want, Math.max(0, gap - 0.05));
      c.speed[v] = travel < want ? travel / dt : next;
      c.along[v] += travel;

      if (c.speed[v] < CRAWL) {
        c.stopped[v] = Math.min(0xffff, c.stopped[v] + 1);
        stoppedNow++;
        const waited = c.stopped[v] / TICK_HZ;
        if (waited > this.stats.worstWaitSeconds) this.stats.worstWaitSeconds = waited;
      } else {
        c.stopped[v] = 0;
        moving++;
        speedSum += c.speed[v];
      }

      // Over the line: on to the next lane, or done.
      if (c.along[v] >= laneLength - 0.01 && c.cleared[v] === 1) {
        const to = c.next[v];
        if (to < 0) { this.arrived.push(v); continue; }
        // The last word on room, checked at the moment of moving rather than at the
        // moment of deciding. Between the two a vehicle can have joined the far lane
        // and left no space, and hopping anyway means two vehicles in one place --
        // which the clamp inside `hop` can only soften, not prevent, because the
        // position it would need is off the back of the lane.
        if (!this.roomBeyond(v, to)) {
          c.along[v] = laneLength - 0.01;
          c.speed[v] = 0;
          continue;
        }
        this.hop(v, to, c.along[v] - laneLength);
        continue;
      }
      if (c.along[v] >= laneLength - 0.01 && c.cleared[v] === 0) {
        // Arrived at the stop line without clearance: hold exactly there.
        c.along[v] = laneLength - 0.01;
        c.speed[v] = 0;
      }

      // Stuck for a while: is the lane beside this one moving?
      if (c.stopped[v] > PATIENCE_TICKS && changesLeft > 0) {
        changesLeft--;
        if (this.tryChange(v, lane)) this.stats.changes++;
      }
    }

    const st = this.stats;
    st.driving = this.table.size;
    st.stopped = stoppedNow;
    st.meanSpeed = moving > 0 ? speedSum / moving : 0;
  }

  /**
   * Whether a vehicle may cross the junction at the end of its lane.
   *
   * Four questions in the order that rejects most cheaply: is the light against me,
   * do I have to give way at all, is there room on the other side, and is the
   * junction clear of anything my path crosses. The third matters more than it
   * looks -- a vehicle that enters a junction it cannot leave is how a grid
   * gridlocks permanently, and no amount of signal timing recovers from it.
   */
  private watching(v: number, lane: number, node: number, nextLane: number,
    tick: number, seconds: number): boolean {
    const c = this.table.col;
    const jn = this.junctions;
    const priority = c.kind[v] === Kind.EMERGENCY;
    if (!priority && jn.control[node] === Control.SIGNALS) {
      const light = jn.lightFor(lane, node, seconds);
      if (light === Light.RED) return true;
      if (light === Light.AMBER && !this.committed(v, lane)) return true;
    }
    if (!this.roomBeyond(v, nextLane)) return true;
    return jn.closedTo(node, lane, jn.laneIn[lane], jn.laneOut[nextLane],
      jn.laneRank[lane], this.turnTo(lane, nextLane), tick, seconds, priority);
  }

  /**
   * Takes a slot in the junction, or refuses.
   *
   * The same four questions as watching it from a distance, then the reservation.
   * The slot is held until the vehicle reports clear of the junction in `hop`, with
   * a ten-second backstop for a vehicle that stalls inside one -- so while a
   * vehicle holds a slot it really is in the junction, which is what the conflict
   * rule needs to be true to mean anything.
   */
  private commit(v: number, lane: number, node: number, nextLane: number,
    tick: number, seconds: number): boolean {
    const c = this.table.col;
    const jn = this.junctions;
    const priority = c.kind[v] === Kind.EMERGENCY;
    if (this.watching(v, lane, node, nextLane, tick, seconds)) return false;
    const ok = jn.enter(node, v, jn.laneIn[lane], jn.laneOut[nextLane],
      jn.laneRank[lane], tick, BOX_HOLD_TICKS, priority);
    if (ok) c.inBox[v] = node;
    return ok;
  }

  /** Whether a vehicle is already too close to stop for an amber. */
  private committed(v: number, lane: number): boolean {
    const c = this.table.col;
    const toEnd = this.g.length[lane] - c.along[v];
    const style = STYLE[c.driver[v]];
    return toEnd <= (c.speed[v] * c.speed[v]) / (2 * style.brake) + 1;
  }

  /**
   * Whether there is room on the far side of the junction.
   *
   * Without this a junction fills with vehicles that cannot leave it and nothing in
   * the district ever moves again -- the failure that no amount of signal timing
   * recovers from, because the blockage is inside the junction itself.
   */
  private roomBeyond(v: number, nextLane: number): boolean {
    const c = this.table.col;
    const waiting = this.laneTail[nextLane];
    if (waiting < 0) return true;
    const room = c.along[waiting] - c.length[waiting];
    return room >= c.length[v] + STYLE[c.driver[v]].gap;
  }

  /** Which way a movement turns. */
  private turnTo(lane: number, nextLane: number): number {
    const g = this.g;
    for (let e = g.edgeStart[lane]; e < g.edgeEnd[lane]; e++) {
      if (g.edgeTo[e] === nextLane) return g.edgeTurn[e];
    }
    return 0;
  }

  /** Moves a vehicle onto the next lane of its route. */
  private hop(v: number, to: number, overshoot: number): void {
    const c = this.table.col;
    // Out of the junction, so the slot goes back at once. The ten-second backstop
    // exists only for a vehicle that never gets here.
    if (c.inBox[v] >= 0) { this.junctions.leave(c.inBox[v], v); c.inBox[v] = -1; }
    this.unlink(v);
    c.lane[v] = to;
    c.along[v] = Math.min(overshoot, Math.max(0, this.g.length[to] - 0.02));
    c.step[v]++;
    c.cleared[v] = 0;
    c.next[v] = -1;
    // Into the right place in the new lane's queue rather than at the back: a
    // vehicle entering partway along a lane can be ahead of somebody already on it.
    this.linkAt(v, to, c.along[v]);
    // And do not drive through whatever is already there.
    const leader = c.ahead[v];
    if (leader >= 0) {
      const room = c.along[leader] - c.length[leader] - c.along[v];
      if (room < 0.2) {
        c.along[v] = Math.max(0, c.along[leader] - c.length[leader] - 0.5);
        c.speed[v] = Math.min(c.speed[v], c.speed[leader]);
      }
    }
  }

  /**
   * Tries to move a stopped vehicle into the lane beside it.
   *
   * Three conditions, and the second is the one that keeps the route valid: there
   * has to be a lane beside this one going the same way, that lane has to be able
   * to make the same next movement, and there has to be a gap in it. Because lanes
   * here run the whole length of a link and the route names the lane, a change that
   * broke the second condition would put the vehicle on a road it cannot turn off.
   */
  private tryChange(v: number, lane: number): boolean {
    const c = this.table.col;
    const g = this.g;
    const link = g.link[lane], dir = g.dir[lane];
    const from = g.linkStart[link * 2 + dir], to = g.linkEnd[link * 2 + dir];
    if (to - from < 2) return false;                   // only one lane this way
    const next = c.next[v];
    const along = c.along[v];
    const style = STYLE[c.driver[v]];

    for (let other = from; other < to; other++) {
      if (other === lane) continue;
      // Must still be able to make the movement the route needs.
      if (next >= 0) {
        let ok = false;
        for (let e = g.edgeStart[other]; e < g.edgeEnd[other]; e++) {
          if (g.edgeTo[e] === next) { ok = true; break; }
        }
        if (!ok) continue;
      }
      // A gap at this position: nobody's body overlapping where this vehicle
      // would be, with room to breathe at both ends.
      let clear = true;
      for (let u = this.laneTail[other]; u >= 0; u = c.ahead[u]) {
        const front = c.along[u], back = front - c.length[u];
        if (back > along + style.gap) break;            // sorted: nothing closer
        if (front > along - c.length[v] - style.gap && back < along + style.gap) {
          clear = false;
          break;
        }
      }
      if (!clear) continue;
      this.unlink(v);
      c.lane[v] = other;
      c.cleared[v] = 0;
      c.next[v] = -1;
      c.stopped[v] = 0;
      this.linkAt(v, other, along);
      return true;
    }
    return false;
  }

  /**
   * Which lane a vehicle goes on to at the junction ahead.
   *
   * -1 means the journey ends here; -2 means there is nowhere legal to go, which
   * happens to a wanderer at a one-way dead end and to a routed vehicle whose route
   * has gone stale.
   *
   * A wanderer is weighted towards the bigger road and away from the busy one,
   * which is what produces believable flows without anybody having a destination:
   * traffic pours down arterials, trickles into side streets, and thins out where
   * the roads are already full. The reverse of where it came from is avoided unless
   * it is the only way, so nobody does laps of one block.
   */
  /** The lane decided on for the junction ahead, choosing once and remembering. */
  private decide(v: number): number {
    const c = this.table.col;
    if (c.next[v] !== -1) return c.next[v];
    const chosen = this.nextLane(v);
    c.next[v] = chosen;
    return chosen;
  }

  private nextLane(v: number): number {
    const c = this.table.col;
    const g = this.g;
    const lane = c.lane[v];
    const route = c.route[v];
    if (route >= 0) {
      // A routed vehicle: the caller keeps `routeLane` in step with the step index.
      const want = this.routeLane(v);
      return want;
    }
    const start = g.edgeStart[lane], end = g.edgeEnd[lane];
    if (end <= start) return -2;
    const link = g.link[lane];
    let total = 0;
    let candidates = 0;
    for (let e = start; e < end; e++) {
      const o = g.edgeTo[e];
      if ((g.use[o] & this.use) === 0) continue;
      if (g.link[o] === link) continue;                 // no turning back
      total += this.appeal(o);
      candidates++;
    }
    if (candidates === 0) {
      // A dead end: the U-turn is the only thing on offer, and taking it is right.
      for (let e = start; e < end; e++) {
        const o = g.edgeTo[e];
        if ((g.use[o] & this.use) !== 0) return o;
      }
      return -2;
    }
    let pick = this.rng.next() * total;
    for (let e = start; e < end; e++) {
      const o = g.edgeTo[e];
      if ((g.use[o] & this.use) === 0) continue;
      if (g.link[o] === link) continue;
      pick -= this.appeal(o);
      if (pick <= 0) return o;
    }
    return -2;
  }

  /** How attractive a lane is to a wandering driver. */
  private appeal(lane: number): number {
    const rank = this.g.rank[lane];
    const load = this.load === null ? 0 : this.load[lane];
    return (0.35 + rank) / (1 + load * 2.5);
  }

  /** The lane a routed vehicle wants next, or -1 at the end, -2 if void. */
  private routeLane(v: number): number {
    const c = this.table.col;
    if (this.paths === null) return -2;
    const route = c.route[v];
    const n = this.paths.length(route);
    if (n === 0) return -2;
    const at = c.step[v] + 1;
    if (at >= n) return -1;
    return this.paths.at(route, at);
  }

  /** What the vehicles admit, and the load they steer by. */
  private use = 1;                               // Use.CAR
  private load: Float32Array | null = null;
  private paths: { length(h: number): number; at(h: number, i: number): number } | null = null;

  /** Tells the traffic where the congestion is, and where the routes live. */
  informedBy(load: Float32Array,
    paths: { length(h: number): number; at(h: number, i: number): number }): void {
    this.load = load;
    this.paths = paths;
  }

  // ---- how many, and where -----------------------------------------------

  /** Where the player is looking, and how far out vehicles are worth having. */
  focusX = 0;
  focusZ = 0;
  reach = 1400;
  /** Lanes within reach of the focus, and the focus they were gathered for. */
  private nearby: Int32Array = new Int32Array(0);
  private nearbyLoad = 0;
  private gatheredAt = [Infinity, Infinity];

  /**
   * Brings the number of vehicles on the road into line with the congestion.
   *
   * The target is the load the flow model computed on the lanes the player can see,
   * turned into vehicles: a lane at full capacity holds a vehicle every nine metres
   * and one at a tenth of capacity holds a tenth as many. So the density on screen
   * is the density the simulation believes in, and a player who fixes a jam sees
   * the queue disperse.
   *
   * Spawning is spread over ticks rather than done all at once, because a hundred
   * vehicles appearing on the same tick is both a visible pop and a spike.
   */
  populate(perTick = 24): void {
    if (this.load === null) return;
    const moved = (this.focusX - this.gatheredAt[0]) ** 2
      + (this.focusZ - this.gatheredAt[1]) ** 2;
    if (moved > (this.reach * 0.25) ** 2) this.gather();
    if (this.nearby.length === 0) return;

    const c = this.table.col;
    // Off the road: anything that has wandered out of view. Done first so its
    // place can be taken this tick.
    const far = (this.reach * 1.6) ** 2;
    for (let v = 0; v < this.table.bound; v++) {
      if (this.table.live[v] === 0) continue;
      if (c.route[v] >= 0) continue;                   // routed vehicles stay
      const lane = c.lane[v];
      const dx = this.g.bx[lane] - this.focusX, dz = this.g.bz[lane] - this.focusZ;
      if (dx * dx + dz * dz > far) this.despawn(v);
    }

    const want = Math.min(this.budget, Math.round(this.nearbyLoad * VEHICLES_PER_LOAD));
    let room = Math.min(perTick, want - this.wandering());
    if (room <= 0) return;
    const load = this.load;
    while (room-- > 0) {
      // A lane chosen in proportion to how loaded it is, so vehicles appear where
      // the traffic is rather than evenly over the map.
      let pick = this.rng.next() * this.nearbyLoad;
      let lane = this.nearby[0];
      for (let i = 0; i < this.nearby.length; i++) {
        const l = this.nearby[i];
        pick -= (load[l] + IDLE_LOAD) * this.g.length[l] / 9;
        if (pick <= 0) { lane = l; break; }
      }
      this.spawn(-1, this.drawKind(), this.drawDriver(), lane, -1, 0);
    }
  }

  /** Wandering vehicles, as against ones on a route. */
  private wandering(): number {
    const c = this.table.col;
    let n = 0;
    for (let v = 0; v < this.table.bound; v++) {
      if (this.table.live[v] === 1 && c.route[v] < 0) n++;
    }
    return n;
  }

  /** What is on the roads: mostly cars, some vans, the odd lorry. */
  private drawKind(): number {
    const r = this.rng.next();
    return r < 0.88 ? Kind.CAR : r < 0.96 ? Kind.LORRY : Kind.BUS;
  }

  /** Collects the lanes near the focus, and their total load. */
  private gather(): void {
    const g = this.g;
    const out: number[] = [];
    const r2 = this.reach * this.reach;
    let total = 0;
    for (let l = 0; l < g.count; l++) {
      if ((g.use[l] & this.use) === 0) continue;
      const dx = g.bx[l] - this.focusX, dz = g.bz[l] - this.focusZ;
      if (dx * dx + dz * dz > r2) continue;
      out.push(l);
      // Vehicles, not load: a lane at capacity holds one every nine metres, so a
      // long road at a given load holds proportionally more than a short one.
      // Summing load alone gave a city of two hundred lanes forty cars.
      total += ((this.load === null ? 0 : this.load[l]) + IDLE_LOAD) * g.length[l] / 9;
    }
    this.nearby = new Int32Array(out);
    this.nearbyLoad = total;
    this.gatheredAt = [this.focusX, this.focusZ];
  }

  // ---- reading -----------------------------------------------------------

  /** Where a vehicle is, and which way it is pointing. */
  place(v: number, out: Float32Array): void {
    const c = this.table.col;
    const g = this.g;
    const lane = c.lane[v];
    const t = g.length[lane] > 0 ? c.along[v] / g.length[lane] : 0;
    out[0] = g.ax[lane] + (g.bx[lane] - g.ax[lane]) * t;
    out[1] = g.az[lane] + (g.bz[lane] - g.az[lane]) * t;
    out[2] = Math.atan2(g.bx[lane] - g.ax[lane], g.bz[lane] - g.az[lane]);
  }

  /** Vehicles on a lane, for the tests. */
  onLane(lane: number): number { return this.laneCount[lane]; }

  /**
   * The queue on a lane, front first, for the tests.
   *
   * Bounded by the lane's own count plus a little, so a list that has closed into a
   * ring comes back as a walk that is longer than the count -- which the tests
   * assert on -- rather than as a loop that never returns.
   */
  queueOf(lane: number, out: number[]): number {
    const c = this.table.col;
    out.length = 0;
    const cap = this.laneCount[lane] + 4;
    for (let u = this.laneHead[lane]; u >= 0 && out.length < cap; u = c.behind[u]) {
      out.push(u);
    }
    return out.length;
  }

  /**
   * The network changed: every lane index is void, so every vehicle is.
   *
   * There is nothing to salvage. A vehicle's lane, its route and its place in a
   * queue all name lanes that have been renumbered, and a vehicle left on the old
   * numbering drives into whatever now happens to be there.
   */
  rebind(g: LaneGraph): void {
    for (let v = 0; v < this.table.bound; v++) {
      if (this.table.live[v] === 1) this.table.remove(v);
    }
    (this as { g: LaneGraph }).g = g;
    this.laneHead = new Int32Array(g.count).fill(-1);
    this.laneTail = new Int32Array(g.count).fill(-1);
    this.laneCount = new Int32Array(g.count);
    (this as { waiting: Uint8Array }).waiting = new Uint8Array(g.count);
  }

  bytes(): number {
    return this.table.bytes() + this.laneHead.byteLength
      + this.laneTail.byteLength + this.laneCount.byteLength + this.waiting.byteLength;
  }
}

/** The lengths and styles, exported so the tests and the renderer agree. */
export { LENGTH as VEHICLE_LENGTH, STYLE as DRIVER_STYLE };
