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

import type { Traffic } from './driving';
import { Kind } from './driving';
import type { Routine } from './routine';
import type { Junctions } from './junctions';
import { Control, Light } from './junctions';
import { Mode } from './routine';
import type { People } from './people';
import type { LaneGraph } from './lanes';
import { DRIVE_SIDE } from './lanes';
import type { PathStore } from './router';
import { INSTANCE_FLOATS } from '../city';
import { MOVER_IDS, MOVER_RESERVE } from '../../assets/generators/movers';
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
  private readonly used = new Map<number, number>();
  /** Lanes that end at a controlled junction, and the graph they belong to. */
  private arms: number[] = [];
  private armsAt = -1;
  readonly counts: MoverCounts = { vehicles: 0, people: 0, signals: 0, dropped: 0 };

  constructor() {
    for (const [seat, id] of Object.entries(MOVER_IDS)) {
      const p = ASSET_INDEX.get(id);
      if (p === undefined) continue;
      this.proto[seat] = p;
      this.room[seat] = MOVER_RESERVE[id] ?? 0;
      const def = ASSETS[p];
      const half = Math.max(1.2, ((def?.footprint[0] ?? 1) * 8) / 2);
      this.box[seat] = [half, half, Math.max(0.9, def?.height ?? 2)];
    }
  }

  /**
   * How far across the carriageway a lane's own track is, in metres.
   *
   * Signed along the right-hand normal of the direction of travel, so a lane on
   * the other side of the road comes out negative and the two sides separate.
   * Kerbside is index zero, so it sits furthest from the centre line.
   *
   * Tapered to nothing at both ends of the lane: a junction is a single node in
   * the graph, and a vehicle that kept its full offset up to the line would
   * jump across the road as it changed lanes at the node. Converging into the
   * middle and fanning out again is what a turn looks like from above, and it
   * costs one clamp.
   */
  private acrossAt(lanes: LaneGraph, lane: number, along: number,
    len: number): number {
    const link = lanes.link[lane], dir = lanes.dir[lane];
    const from = lanes.linkStart[link * 2 + dir];
    const to = lanes.linkEnd[link * 2 + dir];
    const n = Math.max(1, to - from);
    const across = (n - 0.5 - lanes.index[lane]) * LANE_METRES * DRIVE_SIDE;
    const taper = Math.min(1, Math.min(along, len - along) / TAPER_METRES);
    return across * Math.max(0, taper);
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
    ground: (x: number, z: number) => number,
    eyeX: number, eyeZ: number, lead = 0): number {
    this.counts.vehicles = 0;
    this.counts.people = 0;
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
      out[k + 8] = 1; out[k + 9] = 0; out[k + 10] = LOD_BIAS; out[k + 11] = 0;
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
      const ax = lanes.ax[lane], az = lanes.az[lane];
      const bx = lanes.bx[lane], bz = lanes.bz[lane];
      const len = Math.max(0.001, lanes.length[lane]);
      // Where it is *now*, not where it was when the model last stepped. The
      // driving model runs at ten hertz and the screen redraws at sixty, so a
      // position read straight off the table moves in six-frame steps -- which
      // is exactly the stutter that makes traffic look like it is dragging.
      // Carrying it forward at its own speed costs one multiply and is right
      // to within the acceleration over a tenth of a second.
      const along = Math.min(Math.max(c.along[v] + c.speed[v] * lead, 0), len);
      const s = along / len;
      // Across the carriageway, into this lane's own track. The lane graph
      // gives every lane of a link the same centreline -- which is all the
      // routing model ever needed -- so without this, four lanes of an avenue
      // are four columns of cars in the same track, two of them driving through
      // the other two the wrong way.
      const off = this.acrossAt(lanes, lane, along, len);
      const ux = (bx - ax) / len, uz = (bz - az) / len;
      const x = ax + (bx - ax) * s + uz * off;
      const z = az + (bz - az) * s - ux * off;
      const dx = eyeX - x, dz = eyeZ - z;
      if (dx * dx + dz * dz > DRAW_REACH * DRAW_REACH) continue;
      // The heading. The imported bodies are modelled with the nose towards -x: the cabin
      // of every saloon in the pack sits a metre and a bit towards +x, and a
      // cabin is behind a bonnet. So the heading is the direction of travel
      // turned half a turn, and without it every car in the city drives
      // backwards down the road it is on.
      const yaw = Math.atan2(bz - az, bx - ax) + Math.PI;
      write(seatOf(c.kind[v], v), x, z, yaw, RIDE);
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
      if (lane0 >= 0 && lane0 < lanes.count) {
        // The same carry-forward the vehicles get, along the lane they are on,
        // and out onto the pavement: a citizen walking up the middle of the
        // carriageway is the one thing worse than not drawing them at all.
        const l = Math.max(0.001, lanes.length[lane0]);
        const ux = (lanes.bx[lane0] - lanes.ax[lane0]) / l;
        const uz = (lanes.bz[lane0] - lanes.az[lane0]) / l;
        const step = WALK_SPEED * lead;
        x += ux * step;
        z += uz * step;
        const kerb = this.acrossAt(lanes, lane0, l * 0.5, l) + PAVEMENT * DRIVE_SIDE;
        x += uz * kerb;
        z -= ux * kerb;
      }
      const dx = eyeX - x, dz = eyeZ - z;
      if (dx * dx + dz * dz > WALK_REACH * WALK_REACH) continue;
      // Heading from where they are going, which the route's own lane says.
      // A person facing the wrong way down the street they are walking along
      // is the one thing that reads as broken from any distance at all.
      let yaw = 0;
      if (lane0 >= 0 && lane0 < lanes.count) {
        yaw = Math.atan2(lanes.bz[lane0] - lanes.az[lane0],
          lanes.bx[lane0] - lanes.ax[lane0]);
      }
      if (write(mode === Mode.BIKE ? 'cyclist' : 'walker', x, z, yaw, 0)) {
        this.counts.people++;
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

    return n;
  }
}

/** Metres from the camera within which a vehicle is worth drawing. */
const DRAW_REACH = 900;
/** And a person, who is a tenth the size and not worth a pixel beyond this. */
const WALK_REACH = 420;
/** Junction furniture, which only matters where the player can see a junction. */
const SIGN_REACH = 520;
/** Metres a second on foot, for carrying a walker between ticks. */
const WALK_SPEED = 1.35;
/** How wide one lane is, for working out where a road's kerb is. */
const LANE_METRES = 3.5;
/** Over how many metres a lane's offset fades into the junction at each end. */
const TAPER_METRES = 9;
/** How far beyond the kerbside lane the footway is. */
const PAVEMENT = 2.6;

/** Which seat a vehicle is drawn in. */
function seatOf(kind: number, v: number): string {
  if (kind === Kind.BUS) return 'bus';
  if (kind === Kind.LORRY) return (v & 1) === 0 ? 'lorry' : 'refuse';
  if (kind === Kind.EMERGENCY) {
    const pick = v % 3;
    return pick === 0 ? 'fire' : pick === 1 ? 'ambulance' : 'police';
  }
  // Ordinary cars take a livery off their row, so a street is not one model
  // repeated -- and the same vehicle keeps the same one for its whole journey
  // because the row is what it is drawn from.
  const liveries = CAR_LIVERIES.length;
  return (v % 7) === 0 ? 'taxi' : CAR_LIVERIES[v % liveries];
}
