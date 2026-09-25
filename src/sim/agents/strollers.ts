/**
 * Ambient pedestrians: the people on a pavement who are not going anywhere.
 *
 * The routine model moves every citizen on a real trip between real buildings,
 * and it is right -- but a game day here is ninety seconds, and a trip is a few
 * of them, so at any given instant a city of a thousand has about four people
 * between doors. Four. The streets were empty, and no amount of drawing the
 * commuters harder was going to change that, because the commuters genuinely
 * are not out there.
 *
 * Nor are they in a real city. Stand on a high street and almost nobody you can
 * see is partway through a journey a transport model would recognise: they are
 * going to the shop, standing outside it, walking the dog, waiting. That is what
 * this is -- the same thing the ambient traffic is, and kept honest the same
 * way. It reads nothing, it decides nothing, it appears in no statistic. The
 * population figure, the jobs, the trips and the loads on the roads are all the
 * real model's and none of them are touched here. Turn it off and the city
 * behaves identically; it simply looks abandoned.
 *
 * How many there are does follow the city: a district with nobody living or
 * working in it gets nobody on its pavements, which is what makes an empty
 * quarter read as empty rather than as a film set.
 */

import type { LaneGraph } from './lanes';
import { DRIVE_SIDE, Turn, Use } from './lanes';
import { Rng } from './rand';

/** Metres a second on foot. The same figure the real walkers use. */
const SPEED = 1.35;

/**
 * How many residents and workers there are per person on the pavement.
 *
 * A busy street is not a crowd: one figure per twenty is enough that a high
 * street looks used and a suburb looks quiet, and few enough that they never
 * become the thing you notice.
 */
const PER_STROLLER = 9;

/** However busy it gets, no more than this many at once. */
const MAX_STROLLERS = 1600;

/** How many may be created or retired in one visit, so a crowd fades in. */
const CHURN = 24;

export class Strollers {
  /** Where each one is: a lane, and how far along it. */
  private readonly lane: Int32Array;
  private readonly along: Float32Array;
  /** A little variation, so they do not move as one block. */
  private readonly pace: Float32Array;
  /**
   * Which footway: +1 the one on the right of the lane's direction, -1 the
   * left. Both sides of a street are walked, in both directions.
   */
  private readonly side: Int8Array;
  /**
   * The lane they will turn onto at the end of this one, chosen on arrival so
   * the drawing can walk them across the corner instead of snapping them there.
   */
  private readonly next: Int32Array;
  private live = 0;

  /** Where the player is looking, and how far out a figure is worth having. */
  focusX = 0;
  focusZ = 0;
  reach = 900;

  private readonly rng = new Rng(0x57a11);
  private lanesNear: Int32Array = new Int32Array(0);
  private nearCount = 0;
  private gatheredAt = [Infinity, Infinity];

  constructor(private g: LaneGraph) {
    this.lane = new Int32Array(MAX_STROLLERS).fill(-1);
    this.along = new Float32Array(MAX_STROLLERS);
    this.pace = new Float32Array(MAX_STROLLERS);
    this.side = new Int8Array(MAX_STROLLERS);
    this.next = new Int32Array(MAX_STROLLERS).fill(-1);
  }

  /** The road network was rebuilt: everything on it is invalid. */
  rebind(g: LaneGraph): void {
    this.g = g;
    this.live = 0;
    this.lane.fill(-1);
    this.nearCount = 0;
    this.gatheredAt = [Infinity, Infinity];
  }

  get count(): number { return this.live; }
  laneOf(i: number): number { return this.lane[i]; }
  alongOf(i: number): number { return this.along[i]; }
  sideOf(i: number): number { return this.side[i]; }
  nextOf(i: number): number { return this.next[i]; }

  /**
   * Walks everybody on by `dt` seconds, and turns them at the end of a lane.
   *
   * A pedestrian at a junction takes any arm that leaves it, including the one
   * they arrived on -- people turn round, and a footway network that forbade it
   * would send everybody round the same block for ever.
   */
  step(dt: number): void {
    const g = this.g;
    for (let i = 0; i < this.live; i++) {
      const lane = this.lane[i];
      if (lane < 0 || lane >= g.count) { this.retire(i--); continue; }
      this.along[i] += SPEED * this.pace[i] * dt;
      const len = g.length[lane];
      if (this.along[i] < len) continue;
      // Off the end: on to the arm chosen when they arrived, and pick the one
      // after it. The corner between the two was walked in the last metres of
      // this lane, so they join the next one past its own junction.
      const next = this.next[i];
      if (next < 0 || next >= g.count) { this.retire(i--); continue; }
      this.lane[i] = next;
      this.along[i] = Math.min(g.length[next] * 0.5, Math.max(0.5, g.startBack[next]));
      this.next[i] = this.pick(next, this.side[i]);
    }
  }

  /**
   * An arm leaving the end of `lane` that people walk on, or -1.
   *
   */
  private pick(lane: number, side: number): number {
    const g = this.g;
    const from = g.edgeStart[lane], to = g.edgeEnd[lane];
    if (to <= from) return -1;
    // Straight on over the crossing, or round the corner on their own side of
    // the street. Anything else is a diagonal through the middle of the
    // junction, which nobody walks; turning back is the fallback for a dead end.
    const own = side * DRIVE_SIDE > 0 ? Turn.RIGHT : Turn.LEFT;
    let back = -1, n = 0, pickN = -1;
    for (let e = from; e < to; e++) {
      const cand = g.edgeTo[e];
      if (cand < 0 || cand >= g.count || (g.use[cand] & Use.FOOT) === 0) continue;
      const turn = g.edgeTurn[e];
      if (turn === Turn.U) { back = cand; continue; }
      if (turn !== Turn.STRAIGHT && turn !== own) continue;
      // Reservoir pick, so every allowed arm is equally likely.
      n++;
      if (this.rng.next() * n < 1) pickN = cand;
    }
    return pickN >= 0 ? pickN : back;
  }

  /** Swap-removes one. */
  private retire(i: number): void {
    const last = this.live - 1;
    if (i !== last) {
      this.lane[i] = this.lane[last];
      this.along[i] = this.along[last];
      this.pace[i] = this.pace[last];
      this.side[i] = this.side[last];
      this.next[i] = this.next[last];
    }
    this.lane[last] = -1;
    this.live = last;
  }

  /**
   * Brings the number of people on the street into line with how many the city
   * has, near where the player is looking.
   *
   * @param nearby how many residents and workers are within reach.
   */
  populate(nearby: number): void {
    const g = this.g;
    if (g.count === 0) return;
    const moved = (this.focusX - this.gatheredAt[0]) ** 2
      + (this.focusZ - this.gatheredAt[1]) ** 2;
    if (moved > (this.reach * 0.25) ** 2 || this.nearCount === 0) this.gather();
    if (this.nearCount === 0) return;

    // Anyone who has wandered out of view goes first, so their place can be
    // taken by somebody in it.
    const far = (this.reach * 1.5) ** 2;
    let dropped = 0;
    for (let i = 0; i < this.live && dropped < CHURN; i++) {
      const lane = this.lane[i];
      const dx = g.bx[lane] - this.focusX, dz = g.bz[lane] - this.focusZ;
      if (dx * dx + dz * dz > far) { this.retire(i--); dropped++; }
    }

    const want = Math.min(MAX_STROLLERS, Math.round(nearby / PER_STROLLER));
    let room = Math.min(CHURN, want - this.live);
    while (room-- > 0 && this.live < MAX_STROLLERS) {
      const lane = this.lanesNear[(this.rng.next() * this.nearCount) | 0];
      const i = this.live++;
      this.lane[i] = lane;
      this.along[i] = this.rng.next() * g.length[lane];
      // Nobody walks at exactly the same speed as the person in front.
      this.pace[i] = 0.78 + this.rng.next() * 0.44;
      this.side[i] = this.rng.next() < 0.5 ? 1 : -1;
      this.next[i] = this.pick(lane, this.side[i]);
    }
  }

  /** The lanes people could be walking on, near the focus. */
  private gather(): void {
    const g = this.g;
    const out: number[] = [];
    const r2 = this.reach * this.reach;
    for (let l = 0; l < g.count; l++) {
      if ((g.use[l] & Use.FOOT) === 0) continue;
      const dx = (g.ax[l] + g.bx[l]) * 0.5 - this.focusX;
      const dz = (g.az[l] + g.bz[l]) * 0.5 - this.focusZ;
      if (dx * dx + dz * dz <= r2) out.push(l);
    }
    this.lanesNear = Int32Array.from(out);
    this.nearCount = out.length;
    this.gatheredAt = [this.focusX, this.focusZ];
  }
}
