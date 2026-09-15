/**
 * Junctions: who goes, who waits, and why.
 *
 * Everything about traffic that a player actually notices happens here. A road
 * with cars on it looks fine whatever the model; a junction with cars at it is
 * where a city builder is either convincing or absurd, and the absurd version --
 * cars driving through each other, or one side road starving the main road, or a
 * green light nobody obeys -- is what people mean when they say the traffic is
 * broken.
 *
 * Three ideas, and the first is the one that makes the rest cheap.
 *
 * WHETHER TWO MOVEMENTS CONFLICT is geometry, not a table. Draw the junction as a
 * circle with each arm at its own angle. A movement is then a chord across that
 * circle, from the arm it comes in on to the arm it leaves by -- and two chords
 * cross exactly when their four endpoints interleave around the rim. That is four
 * comparisons and it is *exact*: a right turn and the straight beside it do not
 * conflict, a left turn and the opposing straight do, and nobody had to enumerate
 * the cases. Two more rules finish it: movements arriving on the same arm are a
 * queue and never conflict, and movements leaving by the same arm always do,
 * because that is a merge.
 *
 * THE BOX is a short list of who is currently inside the junction, with what they
 * are doing. A vehicle may enter when nothing in the box conflicts with it. That
 * is the whole of collision avoidance at a junction and it is what a roundabout
 * is: yield to whoever is already going round.
 *
 * PRIORITY decides who gets to *try* when several could. Signals at busy
 * crossroads, with opposing arms green together. Give way everywhere else: the
 * minor arm waits for a gap, which falls out of the box without any extra rule --
 * a vehicle on the main road is in the box more often, so the side road waits.
 *
 * What is deliberately not here: a geometric roundabout with an island. The
 * control type exists and behaves correctly, because a roundabout is exactly the
 * box rule with no signals, but there is no roundabout for the player to draw yet,
 * so it is assigned to the junctions that behave like one rather than to ones the
 * player has asked for.
 */

import { Turn } from './lanes';
import type { LaneGraph } from './lanes';

/** How a junction decides who goes. */
export const Control = {
  /** Two arms, or one: there is nothing to decide. */
  FREE: 0,
  /** Minor arms give way to major ones. Most junctions in a city. */
  GIVE_WAY: 1,
  /** Signals, with opposing arms green together. */
  SIGNALS: 2,
  /** Everybody yields to whoever is already in the box. */
  ROUNDABOUT: 3,
} as const;
export const CONTROL_NAMES = ['free', 'give way', 'signals', 'roundabout'] as const;

/** A junction with this many arms of arterial rank or better gets signals. */
const SIGNAL_MAJOR_ARMS = 2;
/** And this many arms in total. */
const SIGNAL_ARMS = 3;
/** Arms, all major, at which an uncontrolled junction behaves as a roundabout. */
const ROUNDABOUT_ARMS = 4;

/**
 * Signal timing, in seconds.
 *
 * Vehicle-actuated, not fixed-time, and the difference is not subtle. A fixed
 * twenty-four second green on a grid whose blocks are a hundred metres long means a
 * driver spends more time at lights than moving -- half the city's traffic was
 * stationary at any moment on a network that was barely a tenth full, which reads
 * as a broken simulation even though every individual vehicle was behaving.
 *
 * So a green lasts as long as there is somebody waiting on it, between a floor and
 * a ceiling, and a phase with nobody on it is skipped entirely. A side road with one
 * car gets eight seconds; an arterial with a queue gets its full thirty; a phase
 * with nothing waiting costs nothing at all. That is what a real junction does, and
 * it is also the cheapest thing to compute, because the question "is anybody
 * waiting" is a flag the driving model sets anyway.
 */
const MIN_GREEN = 7;
const MAX_GREEN = 30;
const AMBER_SECONDS = 3;
const ALL_RED_SECONDS = 1;

/** The most vehicles that can be inside one junction at once. */
const BOX = 8;

/** Signal states, for the vehicle asking and for drawing them later. */
export const Light = { RED: 0, AMBER: 1, GREEN: 2 } as const;

const TAU = Math.PI * 2;
const norm = (a: number): number => {
  let x = a % TAU;
  if (x < 0) x += TAU;
  return x;
};

/**
 * Whether two movements cross.
 *
 * Angles are where each arm lies as seen from the middle of the junction: `in` is
 * the direction the vehicle came from, `out` the direction it is going. Chords
 * cross when their endpoints interleave, which is what the two arc tests below
 * establish -- one endpoint of the second chord inside the first chord's arc and
 * the other outside it.
 */
export function crosses(in1: number, out1: number, in2: number, out2: number): boolean {
  // Same approach: a queue, not a conflict. Tested first because it is the common
  // case at any junction with a queue on it.
  if (Math.abs(norm(in1 - in2)) < 1e-4) return false;
  // Same exit: a merge, which always conflicts.
  if (Math.abs(norm(out1 - out2)) < 1e-4) return true;
  const span = norm(out1 - in1);
  const a = norm(in2 - in1);
  const b = norm(out2 - in1);
  const insideA = a > 0 && a < span;
  const insideB = b > 0 && b < span;
  return insideA !== insideB;
}

/**
 * The junctions of a network.
 *
 * Built once per lane graph and thrown away with it. Arms, angles, control type
 * and signal phases are all derived; the only mutable state is who is in each box
 * and when the signals last changed, which is what a tick advances.
 */
export class Junctions {
  readonly count: number;
  /** What decides who goes, per node. */
  readonly control: Uint8Array;
  /** Arms, and how many of those are arterial or better. */
  readonly arms: Uint8Array;
  readonly majorArms: Uint8Array;
  /** Phases in the signal cycle, per node. Zero where there are no signals. */
  readonly phases: Uint8Array;
  /**
   * Which phase each incoming lane belongs to.
   *
   * Per lane rather than per arm, because a lane is what a vehicle knows about and
   * turning an arm back into a lane at every red light would mean a search.
   */
  readonly lanePhase: Uint8Array;
  /** Where each lane's arm lies, and where it leads: radians. */
  readonly laneIn: Float32Array;
  readonly laneOut: Float32Array;
  /** The rank of the road each incoming lane belongs to, for giving way. */
  readonly laneRank: Uint8Array;
  /** The highest rank arriving at each node, which is who has priority. */
  readonly nodeRank: Uint8Array;

  /**
   * Who is in each junction: BOX slots per node, -1 where empty.
   *
   * Keyed by the vehicle, not by the lane it came in on. Two vehicles from the same
   * arm may legitimately be in the box together -- a platoon crossing on one green
   * is exactly that, and the conflict rule says so -- and a lane-keyed slot then has
   * two owners, so releasing one releases the other's reservation as well.
   */
  private readonly boxWho: Int32Array;
  private readonly boxIn: Float32Array;
  private readonly boxOut: Float32Array;
  /** The tick each occupant leaves by, so a stalled vehicle cannot hold the box. */
  private readonly boxUntil: Int32Array;
  /** The rank of the road each occupant came in on, for giving way. */
  private readonly boxRank: Uint8Array;
  /** How many slots are used, so the scan stops early. */
  private readonly boxUsed: Uint8Array;

  /** Offset into the signal cycle, per node, so the city is not synchronised. */
  private readonly signalOffset: Float32Array;
  /** The phase each signalised node is showing, and when that state began. */
  private readonly phaseNow: Uint8Array;
  private readonly phaseSince: Float32Array;
  /** 0 green, 1 amber, 2 all-red before the next phase. */
  private readonly phaseState: Uint8Array;
  /** Incoming lanes per signalised node, for asking who is waiting. */
  private readonly armStart: Int32Array;
  private armLane: Int32Array;

  /** Counts, for the readout. */
  readonly byControl = new Int32Array(4);

  constructor(readonly g: LaneGraph, nodeCount: number) {
    this.count = nodeCount;
    const n = nodeCount;
    this.control = new Uint8Array(n);
    this.arms = new Uint8Array(n);
    this.majorArms = new Uint8Array(n);
    this.phases = new Uint8Array(n);
    this.nodeRank = new Uint8Array(n);
    this.signalOffset = new Float32Array(n);
    this.phaseNow = new Uint8Array(n);
    this.phaseSince = new Float32Array(n);
    this.phaseState = new Uint8Array(n);
    this.armStart = new Int32Array(n + 1);
    this.armLane = new Int32Array(0);
    this.boxWho = new Int32Array(n * BOX).fill(-1);
    this.boxIn = new Float32Array(n * BOX);
    this.boxOut = new Float32Array(n * BOX);
    this.boxUntil = new Int32Array(n * BOX);
    this.boxRank = new Uint8Array(n * BOX);
    this.boxUsed = new Uint8Array(n);

    const lanes = g.count;
    this.lanePhase = new Uint8Array(lanes);
    this.laneIn = new Float32Array(lanes);
    this.laneOut = new Float32Array(lanes);
    this.laneRank = new Uint8Array(lanes);

    this.measureArms();
    this.assignControl();
    this.assignPhases();
    this.indexArms();
    for (let i = 0; i < n; i++) this.byControl[this.control[i]]++;
  }

  /**
   * Where every lane's arm lies at the node it arrives at, and how many arms
   * each node has.
   *
   * The angle a vehicle arrives *from* is the reverse of the direction it was
   * travelling -- which is why the exit tangent is negated. Getting that backwards
   * makes every conflict test wrong by a hundred and eighty degrees, and the
   * symptom is a junction where the opposing straights block each other and the
   * left turns do not.
   */
  private measureArms(): void {
    const g = this.g;
    // An arm is a distinct arrival angle. Counted by bucketing angles into
    // sixteenths of a turn, which merges the several lanes of one road into one
    // arm without any comparison against a tolerance.
    const seen = new Set<number>();
    for (let l = 0; l < g.count; l++) {
      this.laneIn[l] = norm(Math.atan2(-g.etz[l], -g.etx[l]));
      this.laneOut[l] = norm(Math.atan2(g.itz[l], g.itx[l]));
      this.laneRank[l] = g.rank[l];
    }
    for (let l = 0; l < g.count; l++) {
      const node = g.to[l];
      if (node < 0 || node >= this.count) continue;
      const bucket = node * 16 + (((this.laneIn[l] / TAU) * 16) | 0);
      if (!seen.has(bucket)) {
        seen.add(bucket);
        this.arms[node]++;
        if (g.rank[l] >= 2) this.majorArms[node]++;
      }
      if (g.rank[l] > this.nodeRank[node]) this.nodeRank[node] = g.rank[l];
    }
    // Outgoing arms count too: a T junction has three arms whichever way the
    // one-way streets happen to run.
    const seenOut = new Set<number>();
    for (let l = 0; l < g.count; l++) {
      const node = g.from[l];
      if (node < 0 || node >= this.count) continue;
      const out = norm(Math.atan2(g.itz[l], g.itx[l]));
      const bucket = node * 16 + (((out / TAU) * 16) | 0);
      if (seenOut.has(bucket) || seen.has(bucket)) continue;
      seenOut.add(bucket);
      this.arms[node]++;
      if (g.rank[l] >= 2) this.majorArms[node]++;
    }
  }

  private assignControl(): void {
    for (let n = 0; n < this.count; n++) {
      const arms = this.arms[n];
      if (arms < 3) { this.control[n] = Control.FREE; continue; }
      if (this.majorArms[n] >= SIGNAL_MAJOR_ARMS && arms >= SIGNAL_ARMS) {
        this.control[n] = Control.SIGNALS;
        continue;
      }
      // A large uncontrolled junction of major roads behaves as a roundabout,
      // which is the honest thing to call it: everybody yields to the circulating
      // traffic and nobody has a green light.
      if (arms >= ROUNDABOUT_ARMS && this.majorArms[n] === arms) {
        this.control[n] = Control.ROUNDABOUT;
        continue;
      }
      this.control[n] = Control.GIVE_WAY;
    }
  }

  /**
   * Groups each signalised junction's arms into phases.
   *
   * Opposing arms go together, which is what every real signal does and what makes
   * a crossroads two phases rather than four. Greedy: take the arms in order of
   * angle and pair each unassigned one with whichever unassigned arm is nearest to
   * directly opposite it. A T junction comes out as the main road together and the
   * side road alone, without that case being written down anywhere.
   */
  private assignPhases(): void {
    const g = this.g;
    // Incoming lanes per node, gathered once.
    const byNode: number[][] = Array.from({ length: this.count }, () => []);
    for (let l = 0; l < g.count; l++) {
      const node = g.to[l];
      if (node >= 0 && node < this.count) byNode[node].push(l);
    }
    const angles: number[] = [];
    const armLanes: number[][] = [];
    for (let n = 0; n < this.count; n++) {
      if (this.control[n] !== Control.SIGNALS) continue;
      // Distinct arrival angles, and the lanes on each.
      angles.length = 0; armLanes.length = 0;
      for (const l of byNode[n]) {
        const a = this.laneIn[l];
        let arm = -1;
        for (let k = 0; k < angles.length; k++) {
          if (Math.abs(norm(angles[k] - a + Math.PI) - Math.PI) < 0.25) { arm = k; break; }
        }
        if (arm < 0) { arm = angles.length; angles.push(a); armLanes.push([]); }
        armLanes[arm].push(l);
      }
      if (angles.length < 2) { this.control[n] = Control.GIVE_WAY; continue; }

      const order = angles.map((_, i) => i).sort((a, b) => angles[a] - angles[b]);
      const phaseOf = new Int8Array(angles.length).fill(-1);
      let phase = 0;
      for (const i of order) {
        if (phaseOf[i] >= 0) continue;
        phaseOf[i] = phase;
        // Whichever unassigned arm is nearest to opposite.
        let best = -1, bestErr = Infinity;
        for (const j of order) {
          if (j === i || phaseOf[j] >= 0) continue;
          const err = Math.abs(norm(angles[j] - angles[i] + Math.PI) - Math.PI);
          if (err < bestErr) { bestErr = err; best = j; }
        }
        // Only pair arms that really are roughly opposite; a fork is not a pair.
        if (best >= 0 && bestErr < 0.7) phaseOf[best] = phase;
        phase++;
      }
      this.phases[n] = phase;
      for (let arm = 0; arm < armLanes.length; arm++) {
        for (const l of armLanes[arm]) this.lanePhase[l] = Math.max(0, phaseOf[arm]);
      }
      // A stable offset so the city's signals do not all start in step, which both
      // looks wrong and makes every junction release its queue on the same tick.
      let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
      h ^= h >>> 13;
      this.signalOffset[n] = ((h >>> 0) % 1000) / 1000;
      this.phaseNow[n] = ((h >>> 8) % phase);
      this.phaseSince[n] = -this.signalOffset[n] * MAX_GREEN;
    }
  }

  /** Every incoming lane of every node, as a compressed sparse row. */
  private indexArms(): void {
    const g = this.g;
    const counts = this.armStart;
    for (let l = 0; l < g.count; l++) {
      const node = g.to[l];
      if (node >= 0 && node < this.count) counts[node + 1]++;
    }
    for (let n = 0; n < this.count; n++) counts[n + 1] += counts[n];
    const lanes = new Int32Array(counts[this.count]);
    const at = counts.slice(0, this.count);
    for (let l = 0; l < g.count; l++) {
      const node = g.to[l];
      if (node >= 0 && node < this.count) lanes[at[node]++] = l;
    }
    this.armLane = lanes;
  }

  // ---- signals -----------------------------------------------------------

  /** Which phase a node is showing. */
  phaseAt(node: number): number { return this.phaseNow[node]; }

  /** The light an incoming lane sees. */
  lightFor(lane: number, node: number, _seconds: number): number {
    if (this.control[node] !== Control.SIGNALS) return Light.GREEN;
    if (this.phases[node] <= 1) return Light.GREEN;
    if (this.lanePhase[lane] !== this.phaseNow[node]) return Light.RED;
    const state = this.phaseState[node];
    return state === 0 ? Light.GREEN : state === 1 ? Light.AMBER : Light.RED;
  }

  /**
   * Advances every signal.
   *
   * `waiting` says whether anybody is at the line on a given lane, which the driving
   * model already knows. A green is held while its own phase has demand and dropped
   * as soon as another phase has some and it does not -- so a junction with traffic
   * on one arm only never turns red at all, and one with queues everywhere cycles at
   * its floor. Called a few times a second; there is nothing to do for a node that
   * is not signalised, which is most of them.
   */
  step(seconds: number, waiting: Uint8Array): void {
    for (let n = 0; n < this.count; n++) {
      if (this.control[n] !== Control.SIGNALS) continue;
      const phases = this.phases[n];
      if (phases <= 1) continue;
      const held = seconds - this.phaseSince[n];
      const state = this.phaseState[n];

      if (state === 1) {                                   // amber
        if (held >= AMBER_SECONDS) { this.phaseState[n] = 2; this.phaseSince[n] = seconds; }
        continue;
      }
      if (state === 2) {                                   // all red
        if (held < ALL_RED_SECONDS) continue;
        // On to the next phase that has anybody on it, or simply the next one.
        let pick = -1;
        for (let k = 1; k <= phases; k++) {
          const p = (this.phaseNow[n] + k) % phases;
          if (this.demand(n, p, waiting)) { pick = p; break; }
        }
        this.phaseNow[n] = pick >= 0 ? pick : (this.phaseNow[n] + 1) % phases;
        this.phaseState[n] = 0;
        this.phaseSince[n] = seconds;
        continue;
      }
      // Green. Held while it is wanted and nobody else is waiting, up to the cap.
      if (held < MIN_GREEN) continue;
      const mine = this.demand(n, this.phaseNow[n], waiting);
      let others = false;
      for (let k = 1; k < phases && !others; k++) {
        others = this.demand(n, (this.phaseNow[n] + k) % phases, waiting);
      }
      if ((!mine && others) || held >= MAX_GREEN) {
        this.phaseState[n] = 1;
        this.phaseSince[n] = seconds;
      }
    }
  }

  /** Whether anybody is waiting at the line on a phase of a node. */
  private demand(node: number, phase: number, waiting: Uint8Array): boolean {
    const from = this.armStart[node], to = this.armStart[node + 1];
    for (let i = from; i < to; i++) {
      const lane = this.armLane[i];
      if (this.lanePhase[lane] === phase && waiting[lane] !== 0) return true;
    }
    return false;
  }

  // ---- the box -----------------------------------------------------------

  /** Drops any occupant whose crossing time is up. */
  private sweep(node: number, tick: number): void {
    if (this.boxUsed[node] === 0) return;
    const base = node * BOX;
    let used = 0;
    for (let i = 0; i < BOX; i++) {
      const at = base + i;
      if (this.boxWho[at] < 0) continue;
      if (this.boxUntil[at] <= tick) { this.boxWho[at] = -1; continue; }
      used++;
    }
    this.boxUsed[node] = used;
  }

  /**
   * Whether a vehicle may enter the junction, and takes its slot if so.
   *
   * `priority` is for emergency vehicles: they take a slot whatever is in the box,
   * because the alternative is an ambulance in a queue, and everything else in the
   * box is expected to be stopping for them anyway.
   */
  enter(node: number, who: number, inAngle: number, outAngle: number,
    rank: number, tick: number, holdTicks: number, priority = false): boolean {
    if (node < 0 || node >= this.count) return true;
    this.sweep(node, tick);
    const base = node * BOX;
    let free = -1;
    for (let i = 0; i < BOX; i++) {
      const at = base + i;
      if (this.boxWho[at] < 0) { if (free < 0) free = at; continue; }
      if (priority) continue;
      if (crosses(inAngle, outAngle, this.boxIn[at], this.boxOut[at])) return false;
    }
    if (free < 0) return priority;             // full: only priority forces through
    this.boxWho[free] = who;
    this.boxIn[free] = inAngle;
    this.boxOut[free] = outAngle;
    this.boxRank[free] = rank;
    this.boxUntil[free] = tick + Math.max(1, holdTicks);
    this.boxUsed[node]++;
    return true;
  }

  /**
   * Whether the junction is closed to a movement, without reserving anything.
   *
   * The distinction between asking and taking is the whole of the fix for a
   * junction that throttles itself. A vehicle starts watching the junction fifty
   * metres out, so that it can slow down for a red light rather than arrive at one
   * at full speed -- but if watching also *took* a slot, every vehicle would hold
   * the junction for the five seconds it spent approaching, and a busy crossroads
   * would pass one car at a time. So the approach asks, and only the vehicle at the
   * line takes.
   */
  closedTo(node: number, lane: number, inAngle: number, outAngle: number,
    rank: number, turn: number, tick: number, seconds: number,
    priority = false): boolean {
    if (node < 0 || node >= this.count) return false;
    if (priority) return false;
    if (this.control[node] === Control.SIGNALS
      && this.lightFor(lane, node, seconds) === Light.RED) return true;
    this.sweep(node, tick);
    if (this.boxUsed[node] === 0) return false;
    const yielding = this.mustYield(lane, node, turn);
    const base = node * BOX;
    for (let i = 0; i < BOX; i++) {
      const at = base + i;
      if (this.boxWho[at] < 0) continue;
      if (crosses(inAngle, outAngle, this.boxIn[at], this.boxOut[at])) return true;
      // Giving way is more than not colliding: it means waiting for a gap. So a
      // vehicle that has to give way also waits for anything from a better road,
      // even where their paths would not have crossed. Without this a side road
      // simply merges into the main road whenever the geometry allows, which is
      // what makes an uncontrolled junction feel as though nobody has right of way.
      if (yielding && this.boxRank[at] > rank) return true;
    }
    return false;
  }

  /**
   * Keeps a slot alive while its vehicle is still on its way through.
   *
   * The hold has a backstop so that a vehicle which stalls inside a junction cannot
   * block it forever -- but a vehicle that is merely *slow* must not have its slot
   * taken while it is still committed to crossing, or something conflicting is let
   * in behind it and the two meet in the middle. So a vehicle that still holds a
   * reservation renews it every tick, and the backstop only ever fires on one that
   * has stopped reporting in at all.
   */
  refresh(node: number, who: number, tick: number, holdTicks: number): void {
    if (node < 0 || node >= this.count) return;
    const base = node * BOX;
    for (let i = 0; i < BOX; i++) {
      const at = base + i;
      if (this.boxWho[at] === who) { this.boxUntil[at] = tick + holdTicks; return; }
    }
  }

  /** Lets go of a slot early, when a vehicle is clear of the junction. */
  leave(node: number, who: number): void {
    if (node < 0 || node >= this.count) return;
    const base = node * BOX;
    for (let i = 0; i < BOX; i++) {
      const at = base + i;
      if (this.boxWho[at] === who) {
        this.boxWho[at] = -1;
        if (this.boxUsed[node] > 0) this.boxUsed[node]--;
        return;
      }
    }
  }

  /** How many vehicles are in a junction, for the readout and the tests. */
  occupancy(node: number, tick: number): number {
    this.sweep(node, tick);
    return this.boxUsed[node];
  }

  /**
   * Whether an incoming lane must give way before entering.
   *
   * At a give-way junction the rule is rank: a vehicle on a road of lower rank
   * than the best road at the junction waits for a gap. Equal rank is first come,
   * first served, which the box already provides. A turn across traffic gives way
   * even on the major road, which is what makes a right-of-way junction work at
   * all -- without it a queue of left-turners blocks the main road behind them and
   * the junction deadlocks against itself.
   */
  mustYield(lane: number, node: number, turn: number): boolean {
    switch (this.control[node]) {
      case Control.FREE: return false;
      case Control.ROUNDABOUT: return true;
      case Control.SIGNALS:
        // On green, only the turn across oncoming traffic gives way.
        return turn === Turn.LEFT || turn === Turn.U;
      default:
        if (this.laneRank[lane] < this.nodeRank[node]) return true;
        return turn === Turn.LEFT || turn === Turn.U;
    }
  }

  bytes(): number {
    return this.control.byteLength + this.arms.byteLength + this.majorArms.byteLength
      + this.phases.byteLength + this.lanePhase.byteLength
      + this.laneIn.byteLength + this.laneOut.byteLength + this.laneRank.byteLength
      + this.nodeRank.byteLength + this.signalOffset.byteLength
      + this.phaseNow.byteLength + this.phaseSince.byteLength
      + this.phaseState.byteLength + this.armStart.byteLength + this.armLane.byteLength
      + this.boxWho.byteLength + this.boxIn.byteLength + this.boxOut.byteLength
      + this.boxUntil.byteLength + this.boxRank.byteLength + this.boxUsed.byteLength;
  }

  get report(): string {
    return CONTROL_NAMES.map((name, i) => `${name} ${this.byControl[i]}`).join(', ');
  }
}
