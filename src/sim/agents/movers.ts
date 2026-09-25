/**
 * What is on the roads and the pavements, as instances the renderer can draw.
 *
 * The traffic model has driven real cars down real lanes since the day it was
 * written, and the citizens have walked real routes at real speeds -- and none
 * of it has ever been drawn. The city looked empty while a hundred thousand
 * journeys a day went through it. This is the missing half: one pass a frame
 * that reads where the simulation has put everything and writes the rows the
 * culler already knows how to draw.
 *
 * It owns nothing. It is a projection of two tables, so there is no state to
 * get out of step, nothing to reconcile when a road is bulldozed under a car,
 * and no cost at all on a frame nobody is looking at.
 *
 * THE BUDGET. Every mover is a real one -- nothing here invents traffic -- but
 * not every one is drawn: the vehicles nearest the camera fill the seats first,
 * and the rest keep driving undrawn, exactly as they did when none of them were
 * drawn at all. That is what keeps a metropolis at sixty frames.
 */

import type { PlumeView } from './plumes';
import type { Traffic } from './driving';
import { Kind } from './driving';
import type { Routine } from './routine';
import type { Junctions } from './junctions';
import { Control, Light } from './junctions';
import { Mode } from './routine';
import type { People } from './people';
import type { LaneGraph } from './lanes';
import { DRIVE_SIDE, placeAlong, deckAt } from './lanes';
import type { Shipping } from './shipping';
import type { Flights } from './flights';
import type { TransitNet } from './transit';
import type { PathStore } from './router';
import { INSTANCE_FLOATS } from '../city';
import { MOVER_IDS, FRAME_RESERVE, MOVER_FLIP } from '../../assets/generators/movers';
import { SITE_IDS } from '../../assets/generators/construction';
import type { SiteView } from './growth';
import type { FireView, IncidentView } from './dispatch';
import { Need } from './dispatch';
import type { Strollers } from './strollers';
import { ASSET_INDEX } from '../inventory';
import { ASSETS } from '../../assets/registry';

/** Which prototype draws each vehicle kind, by `Kind`. */
const CAR_LIVERIES = ['car', 'car2', 'car3', 'car4'] as const;

/** Height above the road surface each mover's origin sits at. */
const RIDE = 0.05;

/**
 * How much sooner a mover earns its full mesh than a building of the same
 * height would. See the detail bias in `cull.wgsl`.
 */
const LOD_BIAS = 5;

export interface MoverCounts {
  vehicles: number;
  people: number;
  /** Signal heads and signs drawn at junctions. */
  signals: number;
  /** Plots drawn as building sites. */
  sites: number;
  /** Movers the budget could not seat. They are still simulated. */
  dropped: number;
}

export class Movers {
  /** Prototype index per seat name, resolved once. */
  private readonly proto: Record<string, number> = {};
  /** How many of each prototype may be drawn at once. */
  private readonly room: Record<string, number> = {};
  /**
   * The bounding box the culler sizes each mover by: half-extents and height.
   *
   * Taken from the model rather than assumed, because the culler drops anything
   * under a few pixels tall and works out the level of detail from the same
   * number -- so a car that claims to be three and a half metres tall is drawn
   * at a distance a car cannot be seen at, in the wrong mesh.
   */
  private readonly box: Record<string, [number, number, number]> = {};
  /** Which seats are modelled facing backwards. See `MOVER_FLIP`. */
  private readonly flip: Record<string, boolean> = {};
  private readonly used = new Map<number, number>();
  /**
   * The heading each vehicle was last drawn at, so it can turn rather than snap.
   *
   * The heading is read as a finite difference between two points on the path a
   * metre or so apart, which is right almost everywhere and wrong exactly where
   * it matters: at the ends of a lane the track is converging into the junction
   * on a smoothstep, so the two samples can sit on very different parts of that
   * curve and the angle between them swings. Over a few frames that reads as a
   * car shivering as it approaches every junction.
   *
   * So the drawn heading chases the computed one at a rate a car can actually
   * turn at. It is one float per row and it is the difference between traffic
   * that drives and traffic that wobbles.
   */
  private yaw = new Float32Array(0);
  /** Lanes that end at a controlled junction, and the graph they belong to. */
  private arms: number[] = [];
  private armsAt = -1;
  readonly counts: MoverCounts =
    { vehicles: 0, people: 0, signals: 0, sites: 0, dropped: 0 };

  constructor() {
    // The movers and the building sites are the same kind of thing here: a
    // prototype whose instances are written fresh every frame from live state.
    for (const [seat, id] of Object.entries({ ...MOVER_IDS, ...SITE_IDS })) {
      const p = ASSET_INDEX.get(id);
      if (p === undefined) continue;
      this.proto[seat] = p;
      this.room[seat] = FRAME_RESERVE[id] ?? 0;
      const def = ASSETS[p];
      const half = Math.max(1.2, ((def?.footprint[0] ?? 1) * 8) / 2);
      this.box[seat] = [half, half, Math.max(0.9, def?.height ?? 2)];
      this.flip[seat] = MOVER_FLIP[id] === true;
    }
  }

  /**
   * A point on the network, `along` metres into `lane` and carrying on past its
   * end onto whatever the vehicle is taking next.
   *
   * Two things come out of this that the old straight-line reading could not
   * give. A vehicle no longer piles up against the end of its lane while the
   * model decides -- it is drawn onto the next lane the moment it has run out
   * of this one, which is what stopped the pause-and-jump at every junction.
   * And because the lane offset tapers to nothing at both ends, the path it
   * traces through the node is a curve from one lane's track to the next one's:
   * a turn, rather than a slide.
   */
  private placeOn(lanes: LaneGraph, lane: number, along: number, next: number,
    paths: PathStore, route: number, step: number, shift: number): [number, number] {
    let on = lane;
    let at = along;
    // At most two lanes forward: a tenth of a second at any speed a city road
    // allows cannot cross more than that, and a loop that trusts the data to
    // terminate is a loop that hangs when the data is wrong.
    for (let hop = 0; hop < 2; hop++) {
      const len = Math.max(0.001, lanes.length[on]);
      if (at <= len) break;
      const onward = next >= 0 && next < lanes.count
        ? next : paths.at(route, step + hop + 1);
      if (onward < 0 || onward >= lanes.count) { at = len; break; }
      at -= len;
      on = onward;
      next = -1;
    }
    const len = Math.max(0.001, lanes.length[on]);
    at = Math.max(0, Math.min(at, len));
    placeAlong(lanes, on, at, this.acrossAt(lanes, on, at, len) + shift, this.pt);
    return [this.pt[0], this.pt[1]];
  }

  /** Scratch for `placeAlong`, so the frame loop allocates nothing. */
  private readonly pt = new Float32Array(4);
  private readonly pt2 = new Float32Array(4);

  /**
   * Where a pedestrian is: on the footway, `side` of the lane's direction.
   *
   * The last few metres of a lane are its junction, and walking the footway
   * offset straight through that would put them in the middle of the crossing
   * and then jump them to the next arm's pavement. Instead, over the junction
   * they walk from where their footway ends to where the next one starts: round
   * the corner, or over the crossing -- whichever the turn is.
   */
  private footwayAt(lanes: LaneGraph, lane: number, along: number, side: number,
    next: number): Float32Array {
    const len = Math.max(0.001, lanes.length[lane]);
    const off = lanes.footway[lanes.link[lane]] * side;
    const stop = Math.min(len * 0.5, Math.max(0.5, lanes.stopBack[lane]));
    if (along <= len - stop || next < 0 || next >= lanes.count) {
      placeAlong(lanes, lane, Math.min(along, len - stop), off, this.pt);
      return this.pt;
    }
    placeAlong(lanes, lane, len - stop, off, this.pt);
    const nlen = Math.max(0.001, lanes.length[next]);
    const start = Math.min(nlen * 0.5, Math.max(0.5, lanes.startBack[next]));
    placeAlong(lanes, next, start, lanes.footway[lanes.link[next]] * side, this.pt2);
    const t = Math.min(1, (along - (len - stop)) / stop);
    const dx = this.pt2[0] - this.pt[0], dz = this.pt2[1] - this.pt[1];
    const d = Math.hypot(dx, dz);
    this.pt[0] += dx * t; this.pt[1] += dz * t;
    if (d > 0.01) { this.pt[2] = dx / d; this.pt[3] = dz / d; }
    return this.pt;
  }

  /**
   * How far across the carriageway a lane's own track is, in metres.
   *
   * Signed along the right-hand normal of the direction of travel, so a lane on
   * the other side of the road comes out negative and the two sides separate.
   * Kerbside is index zero, so it sits furthest from the centre line.
   *
   * Held all the way to the stop line, and converged only across the junction
   * itself. A lane runs node centre to node centre, so the last few metres of
   * it are inside the paving of the crossroads -- that, and only that, is where
   * two lanes have to become one track and fan out again on the far side, which
   * is what a turn looks like from above.
   *
   * It used to converge over a fixed nine metres at each end, which starts well
   * before the junction on any road: a car queueing at a light drifted into the
   * middle of the carriageway while it waited, and pulled back out again as it
   * left. That drift is the slide the junctions read as. Tapering over the
   * junction's own size instead means a car holds its lane right up to the
   * line, and only moves across while it is genuinely crossing.
   */
  private acrossAt(lanes: LaneGraph, lane: number, along: number,
    len: number): number {
    const link = lanes.link[lane], dir = lanes.dir[lane];
    const from = lanes.linkStart[link * 2 + dir];
    const to = lanes.linkEnd[link * 2 + dir];
    const n = Math.max(1, to - from);
    const across = (n - 0.5 - lanes.index[lane]) * LANE_METRES * DRIVE_SIDE;
    const out = Math.max(0.5, lanes.stopBack[lane]);
    const into = Math.max(0.5, lanes.startBack[lane]);
    const t = Math.max(0, Math.min(1,
      Math.min(along / into, (len - along) / out)));
    // Smoothstepped, so the track leaves and rejoins its lane tangentially
    // rather than with a corner at the stop line.
    return across * t * t * (3 - 2 * t);
  }

  /**
   * Eases a vehicle's drawn heading towards where it is actually pointing.
   *
   * Shortest way round, so a car crossing the back of the compass turns the way
   * it is going rather than the long way about. The rate is a real one: a car
   * at junction speed takes about a second to swing ninety degrees, and letting
   * it snap instead is what made every approach look like a flinch.
   */
  private turnTowards(v: number, want: number): number {
    if (this.yaw.length <= v) {
      const grown = new Float32Array(Math.max(v + 1, this.yaw.length * 2, 256));
      grown.set(this.yaw);
      grown.fill(want, this.yaw.length);
      this.yaw = grown;
    }
    const was = this.yaw[v];
    let d = want - was;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    // A big step is a new vehicle in a recycled row, or one that has just
    // crossed a junction onto a road going another way: take it whole rather
    // than sweeping the long arc round to it.
    const next = Math.abs(d) > TURN_SNAP ? want : was + d * TURN_RATE;
    this.yaw[v] = next;
    return next;
  }

  /** Whether the library actually holds the mover prototypes. */
  get ready(): boolean { return this.proto.car !== undefined; }

  /**
   * Writes one frame's worth of instances into `out`.
   *
   * Returns how many were written. The caller hands the same array back every
   * frame; nothing here allocates.
   */
  fill(out: Float32Array, cap: number, traffic: Traffic, routine: Routine,
    people: People, lanes: LaneGraph, paths: PathStore, junctions: Junctions,
    sites: SiteView | undefined,
    blazes: FireView | undefined,
    strollers: Strollers | undefined,
    ground: (x: number, z: number) => number,
    eyeX: number, eyeZ: number, lead = 0, incidents?: IncidentView,
    plumes?: PlumeView, seconds = 0, shipping?: Shipping, flights?: Flights,
    transit?: TransitNet): number {
    this.counts.vehicles = 0;
    this.counts.people = 0;
    this.counts.sites = 0;
    this.counts.dropped = 0;
    this.used.clear();
    if (!this.ready) return 0;

    let n = 0;
    const write = (seat: string, x: number, z: number, yaw: number, lift: number): boolean => {
      const proto = this.proto[seat];
      if (proto === undefined) return false;
      // Per-prototype room, because the visibility list is sliced per prototype
      // at load: a bucket handed more than its slice would run into the next
      // one's, and the culler has no bounds check by design.
      const taken = this.used.get(proto) ?? 0;
      if (taken >= (this.room[seat] ?? 0) || n >= cap) { this.counts.dropped++; return false; }
      this.used.set(proto, taken + 1);
      const k = n * INSTANCE_FLOATS;
      out[k] = x; out[k + 1] = z; out[k + 2] = ground(x, z) + lift;
      out[k + 3] = yaw;
      // Half-extents and height are the culler's bounding box, from the model.
      const box = this.box[seat];
      out[k + 4] = box[0]; out[k + 5] = box[1]; out[k + 6] = box[2];
      out[k + 7] = proto;
      // No stretch, not a ghost, and a detail bias: see the cull.
      out[k + 8] = 1; out[k + 9] = 0; out[k + 10] = -LOD_BIAS; out[k + 11] = 0;
      n++;
      return true;
    };

    // ---- vehicles -------------------------------------------------------
    const t = traffic.table;
    const c = t.col;
    for (let v = 0; v < t.bound; v++) {
      if (t.live[v] === 0) continue;
      const lane = c.lane[v];
      if (lane < 0 || lane >= lanes.count) continue;
      const bx = lanes.bx[lane], bz = lanes.bz[lane];
      const dx = eyeX - bx, dz = eyeZ - bz;
      if (dx * dx + dz * dz > DRAW_REACH * DRAW_REACH) continue;

      // Where it is now, and where it will be in a moment. Two points on the
      // same path: the second is what the vehicle is steering towards, so a
      // car turning a corner is drawn turning rather than sliding round it
      // still facing the way it came.
      const at = c.along[v] + c.speed[v] * lead;
      // What is left of the last lane change, unwound the same way the model
      // unwinds it -- so the car is drawn pulling across rather than arriving.
      const shift = c.shift[v];
      const here = this.placeOn(lanes, lane, at,
        c.next[v], paths, c.route[v], c.step[v], shift);
      // The point it is steering towards, a metre or so on. Its share of the
      // change is what it will have unwound by the time it gets there, which is
      // what tilts the body into the manoeuvre instead of sliding it sideways.
      const ahead = shift === 0 ? 0
        : Math.max(0, Math.abs(shift) - LANE_SHIFT_SPEED
          * (LOOK_AHEAD / Math.max(2, c.speed[v]))) * Math.sign(shift);
      const next = this.placeOn(lanes, lane, at + LOOK_AHEAD,
        c.next[v], paths, c.route[v], c.step[v], ahead);
      const seat = seatOf(c.kind[v], v, c.role[v]);
      let yaw = Math.atan2(next[1] - here[1], next[0] - here[0]);
      if (this.flip[seat] === true) yaw += Math.PI;
      // On a viaduct, the deck's height rather than the ground's.
      const deck = deckAt(lanes, lane, at);
      const lift = Number.isNaN(deck) ? RIDE : deck - ground(here[0], here[1]) + RIDE;
      write(seat, here[0], here[1], this.turnTowards(v, yaw), lift);
      this.counts.vehicles++;
    }

    // ---- people ---------------------------------------------------------
    //
    // The travellers the routine is already moving individually: they have a
    // position because something has been integrating it, and until now that
    // position was used for nothing but the load on a lane.
    const pc = people.citizens.col;
    const moved = routine.moved;
    for (let i = 0; i < moved; i++) {
      const id = routine.mover(i);
      if (id < 0) continue;
      const mode = pc.mode[id];
      if (mode !== Mode.WALK && mode !== Mode.BIKE) continue;
      const lane0 = paths.at(pc.route[id], pc.step[id]);
      let x = pc.x[id], z = pc.z[id];
      let yaw = 0, up = 0;
      if (lane0 >= 0 && lane0 < lanes.count) {
        // On the footway on their own side, carried forward the way the
        // vehicles are, and following the road as drawn: a citizen walking up
        // the middle of the carriageway is worse than not drawing them at all.
        const p = this.footwayAt(lanes, lane0, pc.along[id] + WALK_SPEED * lead,
          DRIVE_SIDE, paths.at(pc.route[id], pc.step[id] + 1));
        x = p[0]; z = p[1];
        yaw = Math.atan2(p[3], p[2]);
        const deck = deckAt(lanes, lane0, pc.along[id]);
        if (!Number.isNaN(deck)) up = deck - ground(x, z);
      }
      const dx = eyeX - x, dz = eyeZ - z;
      if (dx * dx + dz * dz > WALK_REACH * WALK_REACH) continue;
      const seat = mode === Mode.BIKE ? 'cyclist'
        : walkSeat(id, pc.along[id] + WALK_SPEED * lead);
      if (write(seat, x, z, yaw, up)) {
        this.counts.people++;
      }
    }

    // ---- the people on the pavements ------------------------------------
    //
    // Not travellers: see `strollers.ts`. Drawn through the same seat and the
    // same kerb offset as a real walker, because from the camera there is no
    // difference between somebody walking to work and somebody walking.
    if (strollers !== undefined) {
      for (let i = 0; i < strollers.count; i++) {
        const lane = strollers.laneOf(i);
        if (lane < 0 || lane >= lanes.count) continue;
        const at = strollers.alongOf(i) + WALK_SPEED * lead;
        const p = this.footwayAt(lanes, lane, at, strollers.sideOf(i) * DRIVE_SIDE,
          strollers.nextOf(i));
        const x = p[0], z = p[1];
        const dx = eyeX - x, dz = eyeZ - z;
        if (dx * dx + dz * dz > WALK_REACH * WALK_REACH) continue;
        const deck = deckAt(lanes, lane, at);
        const up = Number.isNaN(deck) ? 0 : deck - ground(x, z);
        if (write(walkSeat(i * 7 + 3, at), x, z, Math.atan2(p[3], p[2]), up)) this.counts.people++;
      }
    }

    // ---- what the junctions are telling them ----------------------------
    //
    // The model has controlled its junctions since it was written -- signals
    // with actuated phases, give way on the minor arms, a stop at the smallest
    // -- and none of it was visible, so a car braking at an empty crossroads
    // looked like a car braking for nothing. The furniture is drawn from the
    // same state the drivers read, so a red light on screen is the red light
    // the car in front of it is stopping for.
    this.counts.signals = 0;
    // The arms worth drawing furniture on, worked out once per road network
    // rather than per frame. A metropolis has a hundred thousand lanes and a
    // frame that walks all of them to find the four hundred with a signal on
    // them is a frame that spends more time looking than drawing.
    if (this.armsAt !== lanes.count || this.arms.length === 0) {
      this.arms = [];
      for (let lane = 0; lane < lanes.count; lane++) {
        const node = lanes.to[lane];
        if (node < 0) continue;
        const control = junctions.control[node];
        if (control === Control.SIGNALS || control === Control.GIVE_WAY) this.arms.push(lane);
      }
      this.armsAt = lanes.count;
    }
    for (const lane of this.arms) {
      const node = lanes.to[lane];
      const control = junctions.control[node];
      const bx = lanes.bx[lane], bz = lanes.bz[lane];
      const dx = eyeX - bx, dz = eyeZ - bz;
      if (dx * dx + dz * dz > SIGN_REACH * SIGN_REACH) continue;

      let seat: string;
      if (control === Control.SIGNALS) {
        const light = junctions.lightFor(lane, node, 0);
        seat = light === Light.GREEN ? 'signalGreen'
          : light === Light.AMBER ? 'signalAmber' : 'signalRed';
      } else {
        // Only the arms that actually have to give way: the major arms run
        // through, and a sign on those would be a lie about the model.
        if (junctions.laneRank[lane] >= junctions.nodeRank[node]) continue;
        seat = lanes.rank[lane] === 0 ? 'stop' : 'giveway';
      }

      // At the stop line, on the kerb, facing the traffic it is talking to.
      //
      // A lane ends at the junction's own node, which is the middle of the box
      // -- so backing off a fixed three metres put every signal head in the
      // middle of the crossroads. What has to be cleared is half the junction,
      // and the junction is as wide as the widest road through it: a lane is
      // about three and a half metres, so the carriageway either side of the
      // node is that times however many lanes the link carries.
      const ax = lanes.ax[lane], az = lanes.az[lane];
      const len = Math.max(0.001, lanes.length[lane]);
      const ux = (bx - ax) / len, uz = (bz - az) / len;
      const link = lanes.link[lane], dir = lanes.dir[lane];
      const across = lanes.linkEnd[link * 2 + dir] - lanes.linkStart[link * 2 + dir];
      const halfRoad = Math.max(3.6, across * LANE_METRES);
      const back = Math.min(len * 0.45, halfRoad + 2.6);
      // On the kerb of the side its own traffic is on, which is the side the
      // vehicles it is talking to can see it from.
      const side = (halfRoad + 1.4) * DRIVE_SIDE;
      const x = bx - ux * back + uz * side;
      const z = bz - uz * back - ux * side;
      if (write(seat, x, z, Math.atan2(-uz, -ux), 0)) this.counts.signals++;
    }

    // ---- what is being built --------------------------------------------
    //
    // The plots growth has released and not yet handed to the spawner. This is
    // the whole of the construction stage on screen: a hoarded pad the moment
    // the land is released, a frame partway through, and a crane over it for as
    // long as it is open. Three instances a plot, off a list of a hundred --
    // nothing here walks the map.
    if (sites !== undefined) {
      for (let i = 0; i < sites.count; i++) {
        const x = sites.x[i], z = sites.z[i];
        const dx = eyeX - x, dz = eyeZ - z;
        const d2 = dx * dx + dz * dz;
        if (d2 > SITE_REACH * SITE_REACH) continue;
        const seed = sites.seed[i];
        // Quarter turns, so the cabin, the skip and the spoil are not in the
        // same corner of every plot in the street. A square pad, so a quarter
        // turn keeps it on its ground.
        const yaw = ((seed >>> 3) & 3) * (Math.PI / 2);
        if (write('pad', x, z, yaw, 0)) this.counts.sites++;
        const p = sites.progress[i];
        if (p > FRAME_AT) write('frame', x, z, ((seed >>> 5) & 3) * (Math.PI / 2), 0);
        if (p > CRANE_AT && d2 < CRANE_REACH * CRANE_REACH) {
          // In a corner of the plot with the jib swung over it, which is where
          // a tower crane goes and what it is doing.
          const r = Math.max(4, sites.half[i] - 6);
          const cx = ((seed >>> 9) & 1) === 0 ? r : -r;
          const cz = ((seed >>> 11) & 1) === 0 ? r : -r;
          // Slewed off dead-centre by a little, per plot, so a district under
          // construction is not a row of cranes all pointing the same way.
          const skew = (((seed >>> 13) & 63) / 64 - 0.5) * 1.1;
          write('crane', x + cx, z + cz, Math.atan2(-cz, -cx) + skew, 0);
        }
      }
    }

    // The suspect at a break-in: out of the door and away down the pavement
    // until the police arrive, then standing where they were caught. Drawn
    // with the pedestrians' own model on their own kerb line, so it is a person
    // in the street rather than a symbol -- the marker overhead says who.
    if (incidents !== undefined) {
      for (let i = 0; i < incidents.count; i++) {
        if (incidents.kind[i] !== Need.CRIME) continue;
        const lane = incidents.lane[i];
        if (lane < 0 || lane >= lanes.count) continue;
        const l = Math.max(0.001, lanes.length[lane]);
        const caught = incidents.state[i] === 2;
        // A tick is a tenth of a second at speed one: a third of a metre a
        // tick is a sprint, for as far as the street goes.
        const at = caught ? l * 0.5 : Math.min(l, l * 0.5 + (incidents.age[i] + lead * 10) * 0.35);
        const p = this.footwayAt(lanes, lane, at, DRIVE_SIDE, -1);
        const x = p[0], z = p[1], ux = p[2], uz = p[3];
        const dx = eyeX - x, dz = eyeZ - z;
        if (dx * dx + dz * dz > WALK_REACH * WALK_REACH) continue;
        // Caught, they face the road where the patrol car is; running, away.
        const yaw = caught ? Math.atan2(-ux, uz) : Math.atan2(uz, ux);
        if (write(caught ? 'walker' : walkSeat(i, at * 1.6), x, z, yaw, 0)) this.counts.people++;
      }
    }

    // Ships on their lanes, riding the water rather than the ground under it.
    if (shipping !== undefined) {
      const at = this.pt;
      for (const v of shipping.voyages) {
        if (!shipping.at(v, seconds, at)) continue;
        const dx = eyeX - at[0], dz = eyeZ - at[1];
        if (dx * dx + dz * dz > SHIP_REACH * SHIP_REACH) continue;
        if (write(v.vessel, at[0], at[1], at[2], at[3] - ground(at[0], at[1]))) this.counts.vehicles++;
      }
    }

    // The people waiting at the stops, in a line along the kerb facing the
    // road, fewer and fewer while a bus stands there and they get on.
    if (transit !== undefined) {
      transit.eachStop(seconds, (lane, along, waiting) => {
        if (lane < 0 || lane >= lanes.count || waiting <= 0) return;
        for (let k = 0; k < waiting; k++) {
          const p = this.footwayAt(lanes, lane, along - 2 + k * 0.95, DRIVE_SIDE, -1);
          const dx = eyeX - p[0], dz = eyeZ - p[1];
          if (dx * dx + dz * dz > WALK_REACH * WALK_REACH) return;
          // Facing the road: a quarter turn from the kerb's direction.
          const yaw = Math.atan2(p[3], p[2]) + (DRIVE_SIDE > 0 ? Math.PI / 2 : -Math.PI / 2);
          if (write(walkSeat(lane * 13 + k, 0.4 * (k & 1)), p[0] - p[3] * 0.4 * (k % 2), p[1] + p[2] * 0.4 * (k % 2), yaw, 0)) this.counts.people++;
        }
      });
    }

    // Aircraft: on the apron at the airport's own level, in the air above it
    // -- and never through a hill on the way.
    if (flights !== undefined && flights.count > 0) {
      flights.each(seconds, (kind, x, z, yaw, alt, padX, padZ) => {
        const dx = eyeX - x, dz = eyeZ - z;
        if (dx * dx + dz * dz > PLANE_REACH * PLANE_REACH) return;
        const g = ground(x, z);
        const y = ground(padX, padZ) + alt;
        const lift = alt > 1 ? Math.max(25, y - g) : y - g;
        if (write(kind, x, z, yaw, lift)) this.counts.vehicles++;
      });
    }

    // What is on fire. One instance a building, spun and lifted by the clock so
    // the column writhes rather than standing there like a monument -- there is
    // no particle system behind this and it does not need one.
    if (blazes !== undefined) {
      for (let i = 0; i < blazes.count; i++) {
        const x = blazes.x[i], z = blazes.z[i];
        const dx = eyeX - x, dz = eyeZ - z;
        if (dx * dx + dz * dz > FIRE_REACH * FIRE_REACH) continue;
        const seed = blazes.seed[i];
        // Two columns a fire, turning at different rates and in different
        // directions, which is what stops a plume reading as one solid object
        // rotating. The lift is a slow breath on top of it.
        const phase = (seed >>> 7 & 1023) / 1023 * Math.PI * 2;
        const beat = lead + blazes.age[i] * 0.21;
        const up = blazes.lift[i];
        write('blaze', x, z, phase + beat * 0.55, up + Math.sin(beat * 1.7) * 0.35);
        write('blaze', x, z, phase - beat * 0.38 + 2.1,
          up + 1.2 + Math.sin(beat * 1.1 + 2) * 0.5);
      }
    }

    // Chimneys. Two columns a stack, both turned to the one wind the whole
    // city shares -- plumes leaning every which way is the tell of a model --
    // and each breathing on its own phase. The wind itself veers slowly, over
    // minutes, so a player who watches for a while sees the weather move.
    if (plumes !== undefined && plumes.count > 0) {
      // The simulation's own seconds, not the wall clock: a paused city holds
      // its smoke still, and a frame drawn twice without a tick is the same frame.
      const t = seconds;
      const wind = 0.9 + Math.sin(t / 170) * 0.55;
      const seats = ['smoke', 'steam', 'steamBig'];
      for (let i = 0; i < plumes.count; i++) {
        const x = plumes.x[i], z = plumes.z[i];
        const dx = eyeX - x, dz = eyeZ - z;
        if (dx * dx + dz * dz > PLUME_REACH * PLUME_REACH) continue;
        const seat = seats[plumes.kind[i]] ?? 'smoke';
        const ph = plumes.seed[i];
        const up = plumes.y[i] - ground(x, z);
        write(seat, x, z, wind + Math.sin(t * 0.37 + ph) * 0.16, up + Math.sin(t * 0.9 + ph) * 0.25);
        write(seat, x, z, wind + 0.22 + Math.sin(t * 0.23 + ph * 1.7) * 0.2,
          up + 1.6 + Math.sin(t * 0.6 + ph * 2.3) * 0.6);
      }
    }

    return n;
  }
}

/** Metres from the camera within which a chimney plume is worth drawing. A
 * stack is landmark-sized, and its smoke is how industry is found from afar. */
const PLUME_REACH = 2600;

/** Metres from the camera within which a fire is worth drawing. Further than
 * anything else that moves: a column of smoke is the one thing in this city a
 * player should be able to see from the other side of it. */
const FIRE_REACH = 2400;

/** Metres from the camera within which a vehicle is worth drawing. */
const DRAW_REACH = 900;
/** And a person, who is a tenth the size and not worth a pixel beyond this. */
const WALK_REACH = 820;
/** Ships are big and slow; they are worth drawing a long way out. */
const SHIP_REACH = 3200;
/** And aircraft further still: they are what the eye goes to in a sky. */
const PLANE_REACH = 6000;
/** Junction furniture, which only matters where the player can see a junction. */
const SIGN_REACH = 520;
/** A hoarded plot is forty metres across and worth drawing well beyond a car. */
const SITE_REACH = 1200;
/** A crane is thirty-eight metres tall, so it is worth drawing further still. */
const CRANE_REACH = 1800;
/** How far into a build the frame appears above the hoarding. */
const FRAME_AT = 0.42;
/** And how soon the crane goes up, which is before anything else happens. */
const CRANE_AT = 0.06;
/** How far ahead the heading is read from, in metres. */
const LOOK_AHEAD = 1.2;
/** Share of the remaining turn a vehicle makes each frame. */
const TURN_RATE = 0.22;
/** Beyond this much of a change, it is a different heading, not a turn. */
const TURN_SNAP = 1.9;
/** Metres a second on foot, for carrying a walker between ticks. */
const WALK_SPEED = 1.35;
/** How wide one lane is, for working out where a road's kerb is. */
const LANE_METRES = 3.5;
/** How fast a lane change is drawn sideways. Matches the model's own unwind. */
const LANE_SHIFT_SPEED = 2.3;
/** How far beyond the kerbside lane the footway is. */

/** Which seat a vehicle is drawn in. */
function seatOf(kind: number, v: number, role = 0): string {
  if (kind === Kind.BUS) return 'bus';
  // What it was sent for decides what it is -- on the way out with priority,
  // and on the way home as ordinary traffic, when its kind is a car's.
  if (role === Need.FIRE + 1) return 'fire';
  if (role === Need.CRIME + 1) return 'police';
  if (role === Need.MEDICAL + 1) return 'ambulance';
  if (role === Need.RUBBISH + 1) return 'refuse';
  if (kind === Kind.LORRY) return (v & 1) === 0 ? 'lorry' : 'refuse';
  if (kind === Kind.EMERGENCY) {
    // Ambient emergency traffic, sent by nobody: any of the three.
    const pick = v % 3;
    return pick === 0 ? 'fire' : pick === 1 ? 'ambulance' : 'police';
  }
  // Ordinary cars take a livery off their row, so a street is not one model
  // repeated -- and the same vehicle keeps the same one for its whole journey
  // because the row is what it is drawn from.
  const liveries = CAR_LIVERIES.length;
  return (v % 7) === 0 ? 'taxi' : CAR_LIVERIES[v % liveries];
}

/**
 * Which figure a pedestrian is drawn as: one of the four people, in whichever
 * half of their stride the distance they have walked puts them. Two poses a
 * pace apart, changed by the metre rather than by the clock, is a walk cycle
 * whose feet keep time with how fast the figure is actually going.
 */
function walkSeat(who: number, walked: number): string {
  const v = Math.imul(who, 0x9e3779b1) >>> 30;
  const pose = Math.floor(walked / 0.78 + v * 0.5) & 1;
  return WALK_SEATS[v * 2 + pose];
}
const WALK_SEATS = ['walker', 'walk0b', 'walk1a', 'walk1b', 'walk2a', 'walk2b', 'walk3a', 'walk3b'];
