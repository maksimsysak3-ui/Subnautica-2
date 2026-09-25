/**
 * Aircraft at the city's airports.
 *
 * Scenery the way the ships are: the money an airport makes is the economy's
 * (`tradeBoost`, and the visitors it pulls as an attraction), and what flies is
 * the picture of it. Each airport lands one airliner down the strip in front of
 * its stands, rolls it out onto the free stand, turns it round and flies it out
 * the other way; and two widebodies pass over on their way in and out, high
 * enough to be traffic rather than an event. All on the simulation clock, so a
 * paused city holds its aircraft in the air.
 *
 * Positions are in the terminal model's own frame and turned with its lot, so
 * an airport placed any way round flies the right way off its apron.
 */

import type { World } from '../world';

export type Aircraft = 'plane' | 'widebody';

interface Airport { cx: number; cz: number; q: number; phase: number }

/** The strip and the stand, in the terminal model's metres: see `airTerminal`. */
const STRIP_Z = 94, WEST = -134, EAST = 134, STAND_X = -32, STAND_Z = 56;
/** Seconds for a landing, a turn-round and a take-off. */
const PERIOD = 300;
/** Seconds for an overflight to cross, and how far out it is drawn. */
const OVER_PERIOD = 90, OVER_REACH = 5200, OVER_ALT = 900;

export class Flights {
  private airports: Airport[] = [];

  /** Re-reads the airports from the world's lots. */
  plan(world: World): void {
    const half = world.grid / 2;
    this.airports = world.lots.filter((l) => l.id === 'svc.transport.airport').map((l, i) => ({
      cx: (l.gx - half + l.w / 2) * 8, cz: (l.gz - half + l.d / 2) * 8, q: ((l.yaw % 4) + 4) % 4,
      phase: i * 97,
    }));
  }

  get count(): number { return this.airports.length; }

  /**
   * Every aircraft in the sky or on the ground now, handed to `draw` as world
   * x, z, heading and height above the airport.
   */
  each(seconds: number, draw: (kind: Aircraft, x: number, z: number, yaw: number, alt: number, padX: number, padZ: number) => void): void {
    for (const a of this.airports) {
      const t = (((seconds + a.phase) % PERIOD) + PERIOD) % PERIOD / PERIOD;
      const p = landing(t);
      const [x, z] = this.toWorld(a, p[0], p[1]);
      const [hx, hz] = this.toWorld(a, p[0] + Math.cos(p[2]), p[1] + Math.sin(p[2]));
      draw('plane', x, z, Math.atan2(hz - z, hx - x), p[3], a.cx, a.cz);
      // Two widebodies crossing high over the field, one each way.
      for (let k = 0; k < 2; k++) {
        const u = (((seconds + a.phase * 1.7 + k * 41) % OVER_PERIOD) + OVER_PERIOD) % OVER_PERIOD / OVER_PERIOD;
        const ang = (k === 0 ? 0.55 : 2.35) + a.q * 0.3;
        const d = (u * 2 - 1) * OVER_REACH;
        const ox = a.cx + Math.cos(ang) * d, oz = a.cz + Math.sin(ang) * d;
        // Descending on the way in, climbing on the way out.
        const alt = OVER_ALT * (0.55 + 0.45 * Math.abs(u * 2 - 1));
        draw('widebody', ox, oz, ang, alt, a.cx, a.cz);
      }
    }
  }

  /** The terminal model's frame to the world, by the lot's quarter turns. */
  private toWorld(a: Airport, x: number, z: number): [number, number] {
    switch (a.q) {
      case 1: return [a.cx - z, a.cz + x];
      case 2: return [a.cx - x, a.cz - z];
      case 3: return [a.cx + z, a.cz - x];
      default: return [a.cx + x, a.cz + z];
    }
  }
}

/** Where the landing airliner is at `t` of its cycle: model x, z, heading, height. */
function landing(t: number): [number, number, number, number] {
  const lerp = (a: number, b: number, f: number): number => a + (b - a) * f;
  const out = (f: number): number => 1 - (1 - f) * (1 - f);
  const inn = (f: number): number => f * f;
  const seg = (a: number, b: number): number => Math.max(0, Math.min(1, (t - a) / (b - a)));
  const EAST_HDG = 0, SOUTH = -Math.PI / 2;
  if (t < 0.30) {
    // Final approach from the west, down a three-degree slope.
    const f = seg(0, 0.30);
    return [lerp(WEST - 3600, WEST, f), STRIP_Z, EAST_HDG, lerp(190, 0, f)];
  }
  if (t < 0.38) return [lerp(WEST, STAND_X, out(seg(0.30, 0.38))), STRIP_Z, EAST_HDG, 0];
  if (t < 0.42) return [STAND_X, lerp(STRIP_Z, STAND_Z, seg(0.38, 0.42)), SOUTH, 0];
  if (t < 0.62) return [STAND_X, STAND_Z, SOUTH, 0];
  // Pushed back, nose still to the terminal.
  if (t < 0.66) return [STAND_X, lerp(STAND_Z, STRIP_Z, seg(0.62, 0.66)), SOUTH, 0];
  if (t < 0.74) return [lerp(STAND_X, EAST, inn(seg(0.66, 0.74))), STRIP_Z, EAST_HDG, 0];
  // Rotate and climb out to the east.
  const f = seg(0.74, 1);
  return [lerp(EAST, EAST + 4200, f), STRIP_Z, EAST_HDG, 420 * f * f + 60 * f];
}
