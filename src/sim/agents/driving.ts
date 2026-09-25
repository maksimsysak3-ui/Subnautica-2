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
import { DRIVE_SIDE } from './lanes';
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

/**
 * How close to what the player is looking at a vehicle may be conjured.
 *
 * Far enough that the appearance itself is off the side of the frame at a
 * normal working zoom, and near enough that the roads in view still fill up
 * within a few seconds of the camera arriving.
 */
const HIDE_SPAWN = 260;

/**
 * Lane changes considered per tick, across the whole city.
 *
 * This is a backstop, not a throttle, and the difference matters. It used to be
 * spent on every vehicle that felt like moving over -- including the half of
 * them on single-lane streets, where there is nowhere to move to, and the fifth
 * of them inside the last few metres of a lane, where a change is refused
 * anyway. A city's worth of those exhausted the budget in the first few hundred
 * rows of the table every tick, and the vehicles after them -- always the same
 * ones, because the table is walked in order -- never got a turn at all. That is
 * measurable: on a two-lane arterial carrying nine vehicles in one lane and none
 * in the other, the budget was gone ninety-six per cent of the times a driver on
 * it wanted to move over. The lane stayed empty for the whole run.
 *
 * The cheap disqualifications now happen before the budget is touched, which
 * leaves it at roughly a quarter spent on a busy map -- so it bounds the worst
 * case without deciding the ordinary one.
 */
const LANE_CHANGES_PER_TICK = 192;

/**
 * How many fewer vehicles a lane must hold before a driver moves over for it.
 *
 * The lane a routed vehicle is on is the one its route named, and the router
 * names the same lane of a link every time -- so a dual carriageway carried its
 * whole flow in one lane while the one beside it ran empty, which is what the
 * player has been looking at. Drivers now even the carriageway out themselves:
 * two is enough of a difference to be worth the manoeuvre and not so little
 * that a pair of vehicles swap lanes with each other for ever.
 */
const LANE_SLACK = 2;

/**
 * Metres of daylight past its own length a driver wants beyond a junction
 * before entering it, when they have only just arrived.
 */
const ROOM_CLEARANCE = 1;

/** Ticks of waiting at a line over which that requirement decays to its floor. */
const NUDGE_TICKS = 120;

/**
 * The daylight an impatient driver settles for, in metres.
 *
 * It shrinks the wanted gap; it never shrinks the room needed to get clear of
 * the junction, which is physical and is the whole point of the rule.
 */
const ROOM_FLOOR = 0.2;

/**
 * Ticks a driver settles for after changing lane before considering another.
 *
 * Six seconds. A lane change is a manoeuvre, not a continuous optimisation, and
 * anything much shorter reads from above as a car weaving.
 */
const CHANGE_COOLDOWN = 60;

/** How long a lane change takes, for judging the gap it needs. */
const CHANGE_SECONDS = 1.5;

/** Ticks at a blocked exit after which a wandering driver tries another way. */
const REROUTE_TICKS = 300;

/**
 * The share of the fleet that may be standing still before the spawner stops
 * adding to it and starts letting the oldest standing ones go.
 *
 * Half. A city with half its visible traffic queueing is a city with a traffic
 * problem the player can see; a city with nine tenths of it queueing for ever is
 * a broken model.
 */
const JAM_SHARE = 0.5;

/**
 * Service vehicles out per depot the city has, and how many may leave at once.
 *
 * Under one each: a station has a fleet and most of it is at the station most
 * of the time, which is why the building has a yard.
 */
const DEPOT_SHARE = 0.55;
const DEPOT_PER_TICK = 2;

/** Lorries on the road per working industry yard. */
const FREIGHT_PER_YARD = 3;

/** Ticks a wandering vehicle must have been stationary to be retired. */
const STALE_TICKS = 600;

/** And how many may go per visit, so a jam drains rather than blinking out. */
const RETIRE_PER_TICK = 3;

/**
 * Ticks between a vehicle reporting its journey over and the road taking it
 * away, if its owner has not.
 *
 * Two seconds: long enough that the dispatcher and the transit model, which run
 * on their own slower beats, always get first refusal on their own vehicles.
 */
const RETIRE_GRACE = 20;

/** How close to its stopping point a vehicle counts as having arrived. */
const ARRIVE_METRES = 2.5;

/**
 * How wide one lane is, for the width of a change. Matches the drawing's own.
 */
const LANE_METRES = 3.5;

/**
 * How fast a lane change is drawn, in metres a second sideways.
 *
 * Three and a half metres in about a second and a half, which is an unhurried
 * pull across with an indicator on rather than a swerve.
 */
const LANE_SHIFT_SPEED = 2.3;

/**
 * How much of the flow model's density is put on the road.
 *
 * `nearbyLoad` is load times lane length over nine metres, and load is measured
 * against a lane's practical capacity -- a car every twenty-two metres, see
 * `CAPACITY_METRES` -- so a lane at 100 per cent is drawn with a car every twenty
 * metres or so, a busy street, and one at two hundred as a queue.
 */
const VEHICLES_PER_LOAD = 0.45;

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
   * Metres of lateral offset still to unwind from a lane change, signed.
   *
   * A lane change is instant in the model -- the vehicle is on one lane, then
   * it is on the next -- and that is right: the queues, the gap test and the
   * conflict rule all want a vehicle to be on exactly one lane. But the picture
   * does not want it to arrive there instantly, and the picture is what the
   * player has. A car that changes lane three and a half metres in one frame
   * reads as a teleport, which is precisely what it looks like, and the more
   * the carriageway evens itself out the more of them there are.
   *
   * So the change carries a debt: the offset the vehicle *had* relative to the
   * lane it is now on. The drawing adds it, and it unwinds over about a second
   * and a half -- so what is drawn is a car pulling across while the model has
   * it firmly in one lane the whole time.
   */
  shift: Float32Array,
  /**
   * The tick of the last lane change, for the cooldown after one.
   *
   * Without it a driver reconsiders every eighth of a second for ever, and two
   * lanes that differ by the slack trade the same vehicle back and forth: it
   * moves right because the right lane is two shorter, which makes the left two
   * shorter, so it moves back. On screen that is a car weaving down a straight
   * road, which is exactly what it looked like.
   */
  changedAt: Int32Array,
  /**
   * The tick this vehicle reported that its journey was over, or -1.
   *
   * Reporting is not removal, and for most of this model's life nothing did the
   * removing. `arrived` and `stuck` are read by the dispatcher, which reaps its
   * own engines and bins, and by the transit model, which reaps its buses -- and
   * by nobody at all for the ordinary car with a citizen in it. So every
   * commuter's car drove to work, stopped at the end of the lane it had arrived
   * on, and stayed there for the rest of the game.
   *
   * That is the whole of the gridlock. A parked car at the end of a lane is a
   * car in the last few metres before a junction, which is exactly where the
   * room to cross it is measured -- so each finished trip permanently shut one
   * more approach, and the city ratcheted from ninety-five per cent of its
   * traffic moving to under one per cent over about forty-five game minutes,
   * with no way back. Everything that looked like bad junction behaviour was
   * vehicles queueing behind cars that had finished driving hours ago.
   *
   * So the road now clears up after itself, on a short grace period: whoever
   * owns the vehicle gets a moment to reap it their own way, and anything still
   * sitting there afterwards is taken off.
   */
  doneAt: Int32Array,
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
  /**
   * What a service vehicle was sent for, as the dispatch need plus one; zero
   * for everything else. The model drawn follows it, so a fire gets an engine
   * and a burglary a patrol car rather than whichever the row number picked.
   */
  role: Uint8Array,
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
  /**
   * A rolling counter, so the discretionary lane change is spread over the
   * fleet rather than asked of every vehicle every tick: a thirty-second of
   * them consider it on any given tick, which is every vehicle about every
   * three seconds of real time.
   */
  private tickParity = 0;
  /** The tick being driven, for the code below `drive` that needs the clock. */
  private now = 0;
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
    lane: number, route: number, step: number, at = 0): number {
    if (this.table.size >= this.budget) { this.stats.refused++; return -1; }
    if (lane < 0 || lane >= this.g.count) { this.stats.refused++; return -1; }
    const len = LENGTH[kind];
    const style = STYLE[driver];
    // Ambient traffic joins the emptiest lane going the same way: a vehicle
    // appearing at the mouth of a link has reserved nothing and committed to
    // nothing, so this is the one place a lane is simply a choice.
    if (route < 0) lane = this.emptiest(lane);
    // Where on the lane. A routed vehicle always starts at the mouth, because
    // its route says so; an ambient one may be dropped anywhere the lane is
    // clear.
    const laneLen = this.g.length[lane];
    const where = Math.max(0, Math.min(at, laneLen - 0.5));
    // Room where it is going: nothing overlapping it, with a gap at both ends.
    const c0 = this.table.col;
    for (let u = this.laneTail[lane]; u >= 0; u = c0.ahead[u]) {
      const front = c0.along[u], back = front - c0.length[u];
      if (back > where + style.gap + len) break;
      if (front > where - len - style.gap && back < where + style.gap) {
        this.stats.refused++;
        return -1;
      }
    }
    const v = this.table.add();
    const c = this.table.col;
    c.owner[v] = owner;
    c.kind[v] = kind;
    c.doneAt[v] = -1;
    c.shift[v] = 0;
    c.changedAt[v] = -CHANGE_COOLDOWN;
    c.driver[v] = driver;
    // Ambient traffic joins the emptiest lane going its way. Nothing is
    // reserved yet and the vehicle is at the mouth of the lane, so this is the
    // one place a lane can simply be chosen.
    c.lane[v] = lane;
    c.along[v] = where;
    // Joining at the speed of whatever is already there, up to the limit, so a
    // vehicle does not appear at forty miles an hour inside a stationary queue.
    const ahead = this.leaderAt(lane, where);
    c.speed[v] = ahead >= 0
      ? Math.min(c.speed[ahead], this.g.speed[lane]) : this.g.speed[lane] * 0.75;
    c.length[v] = len;
    c.route[v] = route;
    c.step[v] = step;
    c.stopped[v] = 0;
    c.inBox[v] = -1;
    c.cleared[v] = 0;
    c.next[v] = -1;
    c.job[v] = -1;
    c.role[v] = 0;
    this.linkAt(v, lane, where);
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

  /** Whatever is immediately in front of a position on a lane, or -1. */
  private leaderAt(lane: number, along: number): number {
    const c = this.table.col;
    let best = -1;
    for (let u = this.laneTail[lane]; u >= 0; u = c.ahead[u]) {
      if (c.along[u] > along) { best = u; break; }
    }
    return best;
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

    this.now = tick;
    let moving = 0, speedSum = 0, stoppedNow = 0;
    let changesLeft = LANE_CHANGES_PER_TICK;
    this.waiting.fill(0);
    this.arrived.length = 0;
    this.stuck.length = 0;

    for (let v = 0; v < bound; v++) {
      if (live[v] === 0) continue;
      // Finished, and nobody came for it. See `doneAt`.
      if (c.doneAt[v] >= 0 && tick - c.doneAt[v] > RETIRE_GRACE) {
        this.despawn(v);
        this.stats.abandoned++;
        continue;
      }
      const lane = c.lane[v];
      const style = STYLE[c.driver[v]];
      const v0 = Math.max(2, g.speed[lane] * style.limit);
      const speed = c.speed[v];
      const laneLength = g.length[lane];
      // Where it started the tick. Nothing below may put it behind this: a
      // vehicle that moves backwards drives through whoever is behind it, and
      // the stop line is a place to stop, not a place to be dragged to.
      const along0 = c.along[v];
      // The carriageway this lane belongs to, read once: the lane-change
      // decision below needs it, and so does the test for whether there is a
      // decision to make at all.
      const laneSlot = g.link[lane] * 2 + g.dir[lane];
      const laneFrom = g.linkStart[laneSlot], laneEnd = g.linkEnd[laneSlot];

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
      //
      // Two distances, and keeping them apart is the whole of this. `toEnd` is
      // to the node, which is the middle of the junction and where the lane
      // hands over to the next one. `toLine` is to the stop line, which is
      // outside the paving and is where a vehicle that is not allowed through
      // actually waits. They used to be the same number, so every car held for a
      // light or a give way was held at the centre of the crossroads -- which is
      // what made junctions read as cars stopping inside them, sitting there,
      // and then sliding out across them.
      const toEnd = laneLength - c.along[v];
      const toLine = toEnd - g.stopBack[lane];
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
          // And it IS reached here, at the stopping point, rather than by
          // running off the end of the lane. The only place a vehicle was ever
          // reported as arrived is the hop below, which needs `along` to pass
          // the lane's length -- and a vehicle whose journey ends is held a
          // little short of exactly that, so it never passed, was never
          // reported, and was never taken off the road. Five hundred cars
          // spawned in a game and not one of them ever finished: they drove to
          // work and then stood at the kerb for ever, each one holding the last
          // few metres of a lane, which is precisely the ground the junction
          // beyond it measures before letting anybody across.
          if (toLine < ARRIVE_METRES && speed < CRAWL && c.doneAt[v] < 0) {
            this.arrived.push(v);
            c.doneAt[v] = tick;
          }
        } else if (next < 0) {
          // No continuation at all -- the route is void. Stop, and be taken off.
          if (toEnd < gap) { gap = toEnd; closing = speed; }
          this.stuck.push(v);
          if (c.doneAt[v] < 0) c.doneAt[v] = tick;
        } else {
          // Tell the signals somebody is here. Written before asking about the
          // light, so a junction sees the demand on the same tick it is created --
          // otherwise a lone car at a red light waits a tick longer than it has to,
          // every time, which at a hundred junctions is visible.
          if (toLine < WAITING_METRES) this.waiting[lane] = 1;
          // Only the vehicle at the front of its lane's queue may take a slot in
          // the junction. Anybody behind it cannot reach the line anyway, and a
          // reservation it cannot use is held until the backstop expires -- at
          // which point something conflicting is admitted while it is still
          // sitting there. That was the whole of the conflict problem.
          const atFront = leader < 0;
          const shut = (toLine < COMMIT_METRES && atFront)
            ? !this.commit(v, lane, node, next, tick, seconds)
            : this.watching(v, lane, node, next, tick, seconds);
          if (shut) {
            // A closed junction is an obstacle at the stop line, fed to the same
            // model as a stopped car. No separate braking law, no transitions.
            const stop = Math.max(0, toLine);
            if (stop < gap) { gap = stop; closing = speed; }
          } else if (toLine < COMMIT_METRES && leader < 0) {
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

      // Long enough at a blocked exit, and a wandering driver picks another
      // one. This is the last thing standing between the model and a permanent
      // ring of blocked junctions: every other rule here is local, and a ring is
      // not a local property -- A waits on B waits on C waits on A, all three
      // correct, none of them able to give. A driver who has sat at the mouth of
      // a jammed side street for half a minute goes a different way, and
      // `nextLane` already weights its draw against how loaded a lane is, so the
      // way they go is the way that is moving.
      //
      // Only wanderers: a vehicle on a route has somewhere to be, and sending it
      // down a road its route does not name is how a route goes void.
      if (c.route[v] < 0 && c.next[v] >= 0 && c.inBox[v] < 0 && c.cleared[v] === 0
        && c.stopped[v] > REROUTE_TICKS && (v & 7) === (this.tickParity & 7)) {
        c.next[v] = -1;
        // Half the wait, so it reconsiders again if the new way is no better but
        // does not thrash at every tick.
        c.stopped[v] = (REROUTE_TICKS >> 1) as number;
      }

      // Unwind whatever of the last lane change is still outstanding. Linear
      // rather than exponential: a manoeuvre that takes a fixed time and then is
      // over looks like a car changing lane, and one that decays forever leaves
      // every vehicle permanently a few centimetres off its own lane.
      if (c.shift[v] !== 0) {
        const step = LANE_SHIFT_SPEED * dt;
        c.shift[v] = c.shift[v] > 0
          ? Math.max(0, c.shift[v] - step) : Math.min(0, c.shift[v] + step);
      }

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
        if (to < 0) {
          this.arrived.push(v);
          if (c.doneAt[v] < 0) c.doneAt[v] = tick;
          continue;
        }
        // The last word on room, checked at the moment of moving rather than at the
        // moment of deciding. Between the two a vehicle can have joined the far lane
        // and left no space, and hopping anyway means two vehicles in one place --
        // which the clamp inside `hop` can only soften, not prevent, because the
        // position it would need is off the back of the lane.
        if (!this.roomBeyond(v, to)) {
          // Blocked on the far side, having already been cleared to cross: it
          // holds where it is. It must NOT be pushed back to the stop line --
          // that is a vehicle moving backwards by the width of the junction in
          // one tick, which is a teleport, and it is the one this used to do
          // (invisibly, when the set-back was a centimetre).
          c.along[v] = Math.max(along0, Math.min(c.along[v], laneLength));
          c.speed[v] = 0;
          continue;
        }
        this.hop(v, to, c.along[v] - laneLength);
        continue;
      }
      if (c.cleared[v] === 0 && c.along[v] > laneLength - g.stopBack[lane]) {
        // Arrived at the stop line without clearance: hold there, which is
        // outside the junction rather than in the middle of it. Never behind
        // where it already was -- a vehicle already past the line when its
        // clearance lapsed stays where it is and waits, because hauling it back
        // to the line is a car reversing into the one behind it.
        const line = Math.max(0, laneLength - g.stopBack[lane]);
        c.along[v] = Math.max(along0, line);
        c.speed[v] = 0;
      }

      // Is a lane change even on the table? Two comparisons, before anything
      // is spent: there has to be another lane going this way, and there has to
      // be enough road left to make the manoeuvre in. Both are refusals
      // `tryChange` makes anyway -- the point of making them here is that they
      // happen before the budget is touched.
      const ways = laneEnd - laneFrom;
      if (ways > 1 && laneLength - c.along[v] >= 12
        && c.inBox[v] < 0 && c.cleared[v] === 0
        // Not while the last one is still being made, and not straight after
        // it: a manoeuvre takes time and a driver settles before judging again.
        && c.shift[v] === 0 && tick - c.changedAt[v] >= CHANGE_COOLDOWN) {
        // Three reasons to move over, in the order they matter. Stuck behind
        // something for a while. Held below the limit on a lane that has
        // company. Or -- the common one, and the one that actually fills a
        // carriageway -- simply being in the busier lane of a road that is not
        // congested at all. Each is rate-limited on the vehicle's own index
        // against a rolling counter, so the work is spread over ticks instead
        // of every driver on the map reconsidering at once.
        const stuck = c.stopped[v] > PATIENCE_TICKS;
        const slow = (v & 15) === (this.tickParity & 15)
          && c.speed[v] < this.g.speed[lane] * 0.75;
        const lopsided = (v & 7) === (this.tickParity & 7)
          && this.thinner(lane, laneFrom, laneEnd);
        if ((stuck || slow || lopsided) && changesLeft > 0) {
          changesLeft--;
          // A driver who is stuck or held up will take any lane that is no
          // fuller than the one they are in. A driver who is merely in the
          // busier lane of a clear road wants a properly emptier one, or the
          // two lanes trade vehicles back and forth for ever without either
          // getting shorter.
          const slack = stuck || slow ? 0 : LANE_SLACK;
          if (this.tryChange(v, lane, laneFrom, laneEnd, slack)) this.stats.changes++;
        }
      }
    }

    const st = this.stats;
    this.tickParity++;
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
   * Without this a junction fills with vehicles that cannot leave it and nothing
   * in the district ever moves again -- the failure that no amount of signal
   * timing recovers from, because the blockage is inside the junction itself.
   *
   * WHAT IT ASKS FOR SHRINKS THE LONGER YOU HAVE WAITED, and that is not a
   * fudge: it is the only thing standing between this model and permanent
   * gridlock, and its absence was permanent gridlock.
   *
   * The rule used to demand the vehicle's length plus the driver's *comfort*
   * gap -- the standstill distance they like to keep on the open road -- before
   * anyone could enter a junction. Nobody needs to be comfortable to cross a
   * crossroads; they need to fit. And because the room can only appear when the
   * car ahead moves, and that car is in a queue whose own head is asking the
   * same question of the next junction round the block, the whole thing closes
   * into a ring of vehicles each waiting on the next. Measured on a city of five
   * hundred: sixty-one of seventy queue heads stuck, every one of them short by
   * between one and five metres, some for twenty-five minutes, and not one
   * journey completed in a minute of simulation. A quarter of every refusal to
   * cross anywhere in the city was this test.
   *
   * Real junctions do not do that, and the reason is impatience: a driver who
   * has been sitting at a line for half a minute takes a gap they would not have
   * looked at when they arrived. So the requirement decays from "my length and a
   * metre" to "most of my length" over about twelve seconds of waiting. Any ring
   * has some slack somewhere, whoever has the most gives first, and the whole
   * thing unwinds -- which is exactly how a real one unwinds.
   */
  private roomBeyond(v: number, nextLane: number): boolean {
    const c = this.table.col;
    const waiting = this.laneTail[nextLane];
    if (waiting < 0) return true;
    const room = c.along[waiting] - c.length[waiting];
    // Room enough to be COMPLETELY out of the junction, not merely to have a
    // nose on the far side. A lane begins at the node, which is the middle of
    // the box, so a vehicle is only clear of it once its tail has passed the
    // far stop line -- and until then it is parked across the crossroads with
    // its back end in everybody's way.
    //
    // Getting this wrong is what seized the city solid, and it seized slowly
    // enough to look like congestion. A vehicle let into a junction it could not
    // clear stopped straddling it. The next vehicle behind then measured the
    // room to that one's tail and got a NEGATIVE number -- the blocker was
    // behind the start of the lane -- which no amount of waiting can satisfy, so
    // that junction was shut forever. Each one that happened took an arm out of
    // the network permanently: ninety-five per cent of vehicles moving at the
    // first minute, seventy per cent by the third, one per cent by the
    // forty-fifth, and never a recovery. Every jam a player has ever seen in
    // this game was this.
    const clear = this.g.startBack[nextLane] + c.length[v];
    // On top of that, the daylight a driver wants -- which is the part that is
    // allowed to shrink as they wait, because a driver at a line for half a
    // minute takes a gap they would not have looked at when they arrived.
    const patience = Math.min(1, c.stopped[v] / NUDGE_TICKS);
    return room >= clear + ROOM_CLEARANCE * (1 - patience) + ROOM_FLOOR * patience;
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
    // Deliberately NOT spread across the parallel lanes here. The vehicle has
    // just crossed a junction on a reservation for one specific movement, and
    // arriving on a different lane than the one it was cleared for is exactly
    // the case the conflict rule exists to prevent -- it showed up immediately
    // as two conflicting movements in a box at once. Spreading happens on the
    // open road instead, through the ordinary lane change, which checks both
    // the route and the gap.
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
   * The emptiest lane parallel to `lane`.
   *
   * Cheap and deliberately approximate: it counts what is on each lane rather
   * than looking for a gap, because a vehicle joining at the mouth of a lane has
   * the whole lane in front of it and the following model sorts out the rest.
   * Only ambient traffic uses it -- a routed vehicle's lane is part of its route.
   */
  private emptiest(lane: number): number {
    const g = this.g;
    const link = g.link[lane], dir = g.dir[lane];
    const from = g.linkStart[link * 2 + dir], to = g.linkEnd[link * 2 + dir];
    if (to - from < 2) return lane;
    let best = lane;
    let bestCount = this.laneCount[lane];
    for (let other = from; other < to; other++) {
      if (other === lane || this.laneCount[other] >= bestCount) continue;
      best = other;
      bestCount = this.laneCount[other];
    }
    return best;
  }

  /**
   * Whether a lane parallel to this one is carrying meaningfully less.
   *
   * The cheap half of the lane-change decision: a count comparison over the two
   * or three lanes of one carriageway, which is what every driver on a
   * multi-lane road runs through this many times a second. The expensive half
   * -- can I still make my turn, and is there a gap -- only runs when this says
   * there is something to move over for.
   */
  private thinner(lane: number, from: number, to: number): boolean {
    const mine = this.laneCount[lane];
    if (mine === 0) return false;
    for (let other = from; other < to; other++) {
      if (other !== lane && this.laneCount[other] + LANE_SLACK <= mine) return true;
    }
    return false;
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
  private tryChange(v: number, lane: number, from: number, to: number,
    slack: number): boolean {
    const c = this.table.col;
    const g = this.g;
    // Not once the junction ahead has been asked about. A vehicle that has been
    // cleared, or is already in the box, has a reservation for one specific
    // movement -- and arriving at the line on a different lane performs a
    // different one, which is precisely what the conflict rule exists to stop.
    // It showed up the moment discretionary changes were added: eighty-eight
    // pairs of conflicting movements in one run.
    if (c.inBox[v] >= 0 || c.cleared[v] === 1) return false;
    // Nor within the last few metres, where the decision is about to be made
    // and the queue the vehicle would join has no room to react.
    if (g.length[lane] - c.along[v] < 12) return false;
    if (to - from < 2) return false;                   // only one lane this way
    // The movement that has to survive the change. `c.next` is only filled in
    // once a vehicle is close enough to the junction to have decided, so a
    // routed vehicle's next lane is read straight off its route instead --
    // otherwise a change made early in a link is unchecked, and the vehicle
    // arrives at the line in a lane with no edge to the lane its route names.
    // That is a route silently going void, which is a vehicle deleted mid
    // journey, and it is invisible until the trip counts are compared.
    let next = c.next[v];
    if (next === -1 && c.route[v] >= 0) {
      const want = this.routeLane(v);
      if (want >= 0) next = want;
    }
    const along = c.along[v];
    const style = STYLE[c.driver[v]];

    // The emptiest lane that will take it, not the first one that will: moving
    // into the next lane along when the one past it is empty is how a three
    // lane road ends up using two.
    let best = -1;
    let bestCount = this.laneCount[lane] - slack + 1;
    for (let other = from; other < to; other++) {
      if (other === lane) continue;
      if (this.laneCount[other] >= bestCount) continue;
      // Must still be able to make the movement the route needs.
      if (next >= 0) {
        let ok = false;
        for (let e = g.edgeStart[other]; e < g.edgeEnd[other]; e++) {
          if (g.edgeTo[e] === next) { ok = true; break; }
        }
        if (!ok) continue;
      }
      // A gap at this position, judged over the whole manoeuvre rather than at
      // the instant it starts. A change takes about a second and a half, and a
      // vehicle coming up the target lane closes on the space in that time --
      // so the room asked for behind grows with how much faster it is going.
      // Checking only the instant is how a car ends up being drawn through one
      // that was a length back when it indicated.
      let clear = true;
      const nose = along + style.gap;
      for (let u = this.laneTail[other]; u >= 0; u = c.ahead[u]) {
        const front = c.along[u], back = front - c.length[u];
        if (back > nose) break;                         // sorted: nothing closer
        const closing = Math.max(0, c.speed[u] - c.speed[v]) * CHANGE_SECONDS;
        const tailRoom = c.length[v] + style.gap + closing;
        if (front > along - tailRoom && back < nose) { clear = false; break; }
      }
      if (!clear) continue;
      best = other;
      bestCount = this.laneCount[other];
    }
    if (best < 0) return false;
    c.changedAt[v] = this.now;
    // The lateral distance being covered, carried as a debt the drawing unwinds.
    // Signed the same way the drawing signs a lane's own offset, so adding it to
    // the new lane's offset gives exactly the old lane's -- the car is drawn
    // where it was, and moves across from there.
    c.shift[v] += (best - lane) * LANE_METRES * DRIVE_SIDE;
    this.unlink(v);
    c.lane[v] = best;
    c.cleared[v] = 0;
    c.next[v] = -1;
    c.stopped[v] = 0;
    this.linkAt(v, best, along);
    return true;
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
    // The target follows the load as it changes, not as it was when the camera
    // last moved: a city growing under a still camera used to keep the traffic
    // it had the moment the player stopped panning, however big it got.
    this.nearbyLoad = this.loadNear();

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

    // How much of the fleet is actually moving. Ambient traffic exists to show
    // the player the density the model believes in -- and a stationary car shows
    // them nothing except that the road is full, which one look at the queue
    // already told them.
    //
    // This is also the only way the system can come back DOWN. Everything else
    // here is a local rule, and local rules cannot undo a jam that has closed
    // into a ring: measured on this city, the fleet held about three quarters of
    // itself moving indefinitely at three hundred and seventy vehicles, and
    // collapsed to under a tenth within an hour once the target pushed it to the
    // cap of four hundred and ninety. Nothing brought it back, because nothing
    // could: the spawner kept the number topped up and the model had no way to
    // let any of them go.
    const jam = this.stats.driving > 0
      ? this.stats.stopped / this.stats.driving : 0;
    if (jam > JAM_SHARE) {
      // Retire the wanderers that have been standing longest. They are scenery,
      // not journeys -- nobody is inside one waiting to arrive -- and in the
      // world they stand for, a driver facing a jam this old went another way an
      // hour ago. Rate-limited, so a jam drains rather than vanishing.
      let freed = 0;
      for (let v = 0; v < this.table.bound && freed < RETIRE_PER_TICK; v++) {
        if (this.table.live[v] === 0 || c.route[v] >= 0) continue;
        if (c.stopped[v] < STALE_TICKS) continue;
        this.despawn(v);
        freed++;
      }
      return;
    }
    const want = Math.min(this.budget, Math.round(this.nearbyLoad * VEHICLES_PER_LOAD));
    let room = Math.min(perTick, want - this.wandering());
    // No early return when the road is full: the depots and yards below still send theirs.
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
      // Not in the middle of the picture. A vehicle appearing out of nothing at
      // the start of a road the player is looking at is the single most obvious
      // thing traffic can do wrong, and it is what "they teleport in and drive
      // down the road" is: the spawner was choosing the busiest lane near the
      // camera and putting a car at its mouth. Vehicles now appear at the far
      // end of what is loaded, where the frame does not reach.
      const sx = (this.g.ax[lane] + this.g.bx[lane]) * 0.5;
      const sz = (this.g.az[lane] + this.g.bz[lane]) * 0.5;
      const dx = sx - this.focusX, dz = sz - this.focusZ;
      if (dx * dx + dz * dz < HIDE_SPAWN * HIDE_SPAWN) continue;
      // And along the lane rather than at its start, so a road that comes into
      // view is already carrying traffic instead of filling up from one end.
      this.spawn(-1, this.drawKind(), this.drawDriver(), lane, -1, 0,
        this.rng.next() * this.g.length[lane]);
    }

    // And some of it out of the depots. Unlike the traffic above this one is
    // allowed to appear in view, because appearing at the kerb outside a fire
    // station is not a vehicle materialising on an empty road -- it is a
    // vehicle leaving a building that owns vehicles, which is what it looks
    // like and what it is standing for.
    if (this.serviceCount > 0) {
      let fleet = Math.min(DEPOT_PER_TICK,
        Math.round(this.serviceCount * DEPOT_SHARE) - this.serving());
      while (fleet-- > 0) {
        const lane = this.serviceLanes[(this.rng.next() * this.serviceCount) | 0];
        if (lane < 0 || lane >= this.g.count) continue;
        const r = this.rng.next();
        const kind = r < 0.42 ? Kind.LORRY : r < 0.78 ? Kind.EMERGENCY : Kind.BUS;
        this.spawn(-1, kind, this.drawDriver(), lane, -1, 0, 1.5);
      }
    }

    // Freight out of the yards: a few lorries each, leaving the gate.
    const yards = this.freightLanes.length;
    if (yards > 0 && this.lorries() < yards * FREIGHT_PER_YARD) {
      const lane = this.freightLanes[(this.rng.next() * yards) | 0];
      if (lane >= 0 && lane < this.g.count) this.spawn(-1, Kind.LORRY, this.drawDriver(), lane, -1, 0, 1.5);
    }
  }

  /**
   * Lanes that a service building fronts on to, for the traffic that comes out
   * of one.
   *
   * A city's service fleet is mostly not answering a call. A bin round, a
   * patrol, a bus on its layover, a works van going between depots: these are
   * out all day, and they are most of what makes a city's services look like
   * they exist rather than like entries in a panel. The dispatcher models the
   * calls, correctly and rarely -- a fire is one building-day in two thousand
   * six hundred -- and a city that has built its fire station and its depot
   * should not have to wait for a disaster to see anything come out of them.
   *
   * So a share of the ambient traffic is sourced from the stations rather than
   * from the road, and wears a service body. It is scenery, exactly as the rest
   * of the ambient traffic is: it answers nothing, it is counted in nothing,
   * and a call still sends a real vehicle on a real route.
   */
  private serviceLanes: Int32Array = new Int32Array(0);
  private serviceCount = 0;

  /** Told by the simulation, on a slow beat: where the depots are. */
  depotsAre(lanes: Int32Array, count: number): void {
    this.serviceLanes = lanes;
    this.serviceCount = count;
  }

  /** Industry yards, for the freight lorries that come out of them. */
  private freightLanes: Int32Array = new Int32Array(0);

  /** Told by the simulation, on a slow beat: where the working industry is. */
  freightFrom(lanes: Int32Array): void { this.freightLanes = lanes; }

  /** Lorries wandering the network, whoever sent them. */
  private lorries(): number {
    const c = this.table.col;
    let n = 0;
    for (let v = 0; v < this.table.bound; v++) {
      if (this.table.live[v] === 1 && c.route[v] < 0 && c.kind[v] === Kind.LORRY) n++;
    }
    return n;
  }

  /** Ambient service vehicles currently out, as against ordinary traffic. */
  private serving(): number {
    const c = this.table.col;
    let n = 0;
    for (let v = 0; v < this.table.bound; v++) {
      if (this.table.live[v] === 0 || c.route[v] >= 0) continue;
      if (c.kind[v] !== Kind.CAR) n++;
    }
    return n;
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

  /** Vehicles' worth of load on the gathered lanes, right now. */
  private loadNear(): number {
    const load = this.load;
    let total = 0;
    for (let i = 0; i < this.nearby.length; i++) {
      const l = this.nearby[i];
      total += ((load === null ? 0 : load[l]) + IDLE_LOAD) * this.g.length[l] / 9;
    }
    return total;
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
