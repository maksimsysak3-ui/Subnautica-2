/**
 * Ships: what a port, a ferry terminal and a fishing harbour send out.
 *
 * Scenery in the same sense the ambient traffic is -- the money a container
 * terminal makes is the economy's, see `tradeBoost` -- but a port with nothing
 * moving at it is a picture of a port, not one. So each berth gets a sea lane,
 * found by walking out from the building over open water, and its vessels run
 * that lane on the simulation's clock: alongside, out to sea, a while beyond
 * the horizon, and back. They stop when the game is paused because the clock
 * does.
 */

import { standingWaterAt } from '../land';
import type { Places } from './places';
import { ASSETS } from '../../assets/registry';

export type Vessel = 'ship' | 'tug' | 'trawler' | 'ferryBoat';

export interface Voyage {
  vessel: Vessel;
  /** The berth and the far end of the lane, in metres, and the water level. */
  ax: number; az: number; bx: number; bz: number; level: number;
  /** Seconds for the whole round, and where in it this one starts. */
  period: number; phase: number;
  /** Metres to one side of the lane, so two vessels on it do not overlap. */
  side: number;
}

/** What each kind of harbour sends out, and how often it comes round. */
const FLEET: Record<string, Array<{ vessel: Vessel; period: number; side: number }>> = {
  'svc.transport.docks': [
    { vessel: 'ship', period: 260, side: 0 },
    { vessel: 'ship', period: 300, side: 34 },
    { vessel: 'tug', period: 140, side: -26 },
  ],
  'svc.transport.ferry': [{ vessel: 'ferryBoat', period: 150, side: 0 }],
  'spec.hq.fish': [
    { vessel: 'trawler', period: 180, side: -18 },
    { vessel: 'trawler', period: 220, side: 18 },
  ],
};

/** How far a lane may run out to sea, and the least worth sailing. */
const LANE_MAX = 1800;
const LANE_MIN = 220;

export class Shipping {
  voyages: Voyage[] = [];

  /** Re-plans every lane from the harbours standing now. Cheap: a few buildings. */
  plan(places: Places): void {
    const out: Voyage[] = [];
    const c = places.col;
    for (let id = 0; id < places.count; id++) {
      if (places.live[id] === 0) continue;
      const fleet = FLEET[ASSETS[c.proto[id]]?.id ?? ''];
      if (fleet === undefined) continue;
      const lane = seaLane(c.x[id], c.z[id]);
      if (lane === null) continue;
      fleet.forEach((f, k) => out.push({
        vessel: f.vessel, ...lane, period: f.period, side: f.side,
        phase: ((id * 0.618 + k * 0.37) % 1) * f.period,
      }));
    }
    this.voyages = out;
  }

  /**
   * Where a voyage is at `seconds`: x, z, heading, and whether it is out of
   * sight past the end of its lane. Written into `into` to allocate nothing.
   */
  at(v: Voyage, seconds: number, into: Float32Array): boolean {
    const t = (((seconds + v.phase) % v.period) + v.period) % v.period / v.period;
    // Alongside, out, beyond the horizon, back in.
    const ALONG = 0.18, OUT = 0.44, AWAY = 0.6;
    let f: number, outward: boolean;
    if (t < ALONG) { f = 0; outward = true; }
    else if (t < OUT) { f = ease((t - ALONG) / (OUT - ALONG)); outward = true; }
    else if (t < AWAY) { return false; }
    else { f = 1 - ease((t - AWAY) / (1 - AWAY)); outward = false; }
    const dx = v.bx - v.ax, dz = v.bz - v.az;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len, uz = dz / len;
    // Starboard side of the lane going out, so outbound and inbound pass.
    const s = v.side + (outward ? 0 : 12);
    into[0] = v.ax + dx * f + uz * s;
    into[1] = v.az + dz * f - ux * s;
    into[2] = outward ? Math.atan2(uz, ux) : Math.atan2(-uz, -ux);
    into[3] = v.level;
    return true;
  }
}

const ease = (t: number): number => t * t * (3 - 2 * t);

/**
 * The nearest open water to a building and the longest straight run out over
 * it, or null for a harbour built nowhere near the sea.
 */
function seaLane(x: number, z: number): { ax: number; az: number; bx: number; bz: number; level: number } | null {
  let best: { ax: number; az: number; bx: number; bz: number; level: number } | null = null;
  let bestLen = 0;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const ux = Math.cos(a), uz = Math.sin(a);
    // The berth: the first water within a couple of hundred metres.
    let start = -1;
    for (let r = 20; r <= 240; r += 10) {
      if (standingWaterAt(x + ux * r, z + uz * r) !== null) { start = r; break; }
    }
    if (start < 0) continue;
    // Then out while it stays water.
    let r = start + 30;
    while (r < start + LANE_MAX && standingWaterAt(x + ux * r, z + uz * r) !== null) r += 30;
    const len = r - 30 - start;
    if (len > bestLen) {
      bestLen = len;
      const level = standingWaterAt(x + ux * start, z + uz * start) ?? 0;
      best = { ax: x + ux * (start + 25), az: z + uz * (start + 25), bx: x + ux * (r - 60), bz: z + uz * (r - 60), level };
    }
  }
  return bestLen >= LANE_MIN ? best : null;
}
