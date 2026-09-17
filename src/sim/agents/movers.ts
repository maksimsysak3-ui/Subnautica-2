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
import { Mode } from './routine';
import type { People } from './people';
import type { LaneGraph } from './lanes';
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
  readonly counts: MoverCounts = { vehicles: 0, people: 0, dropped: 0 };

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

  /** Whether the library actually holds the mover prototypes. */
  get ready(): boolean { return this.proto.car !== undefined; }

  /**
   * Writes one frame's worth of instances into `out`.
   *
   * Returns how many were written. The caller hands the same array back every
   * frame; nothing here allocates.
   */
  fill(out: Float32Array, cap: number, traffic: Traffic, routine: Routine,
    people: People, lanes: LaneGraph, paths: PathStore,
    ground: (x: number, z: number) => number,
    eyeX: number, eyeZ: number): number {
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
      const along = Math.min(Math.max(c.along[v], 0), len);
      const s = along / len;
      const x = ax + (bx - ax) * s;
      const z = az + (bz - az) * s;
      const dx = eyeX - x, dz = eyeZ - z;
      if (dx * dx + dz * dz > DRAW_REACH * DRAW_REACH) continue;
      const yaw = Math.atan2(bz - az, bx - ax);
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
      const x = pc.x[id], z = pc.z[id];
      const dx = eyeX - x, dz = eyeZ - z;
      if (dx * dx + dz * dz > WALK_REACH * WALK_REACH) continue;
      // Heading from where they are going, which the route's own lane says.
      // A person facing the wrong way down the street they are walking along
      // is the one thing that reads as broken from any distance at all.
      const lane = paths.at(pc.route[id], pc.step[id]);
      let yaw = 0;
      if (lane >= 0 && lane < lanes.count) {
        yaw = Math.atan2(lanes.bz[lane] - lanes.az[lane], lanes.bx[lane] - lanes.ax[lane]);
      }
      if (write(mode === Mode.BIKE ? 'cyclist' : 'walker', x, z, yaw, 0)) {
        this.counts.people++;
      }
    }

    return n;
  }
}

/** Metres from the camera within which a vehicle is worth drawing. */
const DRAW_REACH = 900;
/** And a person, who is a tenth the size and not worth a pixel beyond this. */
const WALK_REACH = 420;

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
