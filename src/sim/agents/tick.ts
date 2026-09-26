/**
 * The simulation clock, and how work is spread across it.
 *
 * Two ideas, and the second is what makes a hundred thousand citizens
 * affordable.
 *
 * First: the simulation runs on its own fixed step, not on the frame. A frame
 * is however long the GPU took and varies with what is on screen; a simulation
 * whose step varies with that is one where traffic behaves differently when
 * you look at it. So the clock accumulates real time and spends it in fixed
 * ticks, and a slow frame costs a few ticks of catch-up rather than a
 * different simulation.
 *
 * Second, and this is the whole trick: almost nothing needs to run every tick.
 * A car deciding whether to brake does. A citizen deciding whether to be
 * hungry does not -- once every few seconds is indistinguishable, and there
 * are a hundred thousand of them. So each system declares how often it wants
 * to run, and its entities are spread evenly across that period by id, so a
 * system on a sixty-four tick period does a sixty-fourth of its work each tick
 * rather than all of it every sixty-fourth. The load is flat instead of
 * spiky, which matters more than the total: a frame that takes four
 * milliseconds sixty-three times and two hundred once is a stutter, and the
 * average says everything is fine.
 *
 * The spreading is a mask rather than a modulo because the period is always a
 * power of two, and this test runs once per entity per tick over every table
 * in the game.
 */

/** Ticks a second. Ten is enough for driving and cheap enough for the rest. */
export const TICK_HZ = 10;
export const TICK_SECONDS = 1 / TICK_HZ;

/**
 * The most ticks that may be run to catch up in one frame.
 *
 * Without a cap, a tab that was in the background for a minute comes back and
 * tries to simulate six hundred ticks in one frame, which takes long enough
 * that the next frame is also behind, and the simulation never catches up --
 * the spiral of death. Time is simply lost instead, which for a city builder
 * is the right answer: nobody minds that the city did not age while the laptop
 * was shut.
 */
const MAX_CATCH_UP = 6;

/**
 * How often a system runs, as a power-of-two number of ticks.
 *
 * Named rather than numeric at the call site, because "every 64 ticks" says
 * nothing and `Rate.SLOW` says what it is for.
 */
export const Rate = {
  /** Every tick: 10 Hz. Driving, and anything with a collision in it. */
  REALTIME: 1,
  /** 5 Hz. Vehicle routing, junction signals. */
  FAST: 2,
  /** ~1.25 Hz. Service dispatch, transit stops. */
  BRISK: 8,
  /** ~0.3 Hz. Citizen needs and decisions. */
  STEADY: 32,
  /** ~0.08 Hz. Building occupancy, service coverage. */
  SLOW: 128,
  /** ~0.02 Hz. Economy, demand, growth. */
  GLACIAL: 512,
} as const;

export type RateValue = typeof Rate[keyof typeof Rate];

/**
 * Whether an entity is due this tick, given a rate.
 *
 * `id & (rate - 1)` is the entity's slot in the cycle and `tick & (rate - 1)`
 * is the slot the cycle is on. Equal means due. For rate 1 both are zero and
 * everything is due, which is the fast path and costs one compare.
 */
export const due = (id: number, tick: number, rate: number): boolean =>
  (id & (rate - 1)) === (tick & (rate - 1));

/**
 * The range of a table one pass should walk this tick.
 *
 * An alternative to testing `due` per entity: because the mask is on the low
 * bits of the id, the due entities are every `rate`-th row starting at the
 * tick's slot. A pass can walk with that stride and never test anything, which
 * turns a branch per row into no branch at all. Worth it for the big tables.
 */
export const slice = (tick: number, rate: number):
{ start: number; stride: number } =>
  ({ start: tick & (rate - 1), stride: rate });

export interface System {
  readonly name: string;
  readonly rate: RateValue;
  /** Runs one tick of this system. `tick` is the global tick count. */
  run(tick: number, dt: number): void;
  /**
   * Which tick of its cycle it runs on, where the name's hash would put it
   * somewhere unlucky. The six systems on every other tick all hashed to the
   * same one, so that tick carried every one of them and the other nothing:
   * the spikes the life test counted were that pile-up, not the collector.
   */
  readonly phase?: number;
}

/**
 * Runs the systems, keeps the time, and measures where it went.
 *
 * The measurement is not optional instrumentation. A simulation this size is
 * a budget, and a budget nobody can see is a budget nobody keeps: the first
 * question about any slowdown is which system ate the tick, and that has to be
 * answerable without attaching a profiler.
 */
/**
 * A stable offset for a system, from its name.
 *
 * Without one, every slow system fires on the same tick: a tick number
 * divisible by 512 is divisible by 32 and by 8 and by 2, so tick 512 runs the
 * lot at once and the frame it lands on is the worst frame of the minute. The
 * offset spreads them, and it is derived from the name rather than from the
 * order systems were added, so the spread does not change when one is inserted.
 */
function phaseOf(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h;
}

export class Scheduler {
  private readonly systems: System[] = [];
  private readonly phase: number[] = [];
  /**
   * Seconds accumulated towards the next tick.
   *
   * Read by anything that draws what the simulation moves: the model steps ten
   * times a second and the screen redraws sixty, so a position taken straight
   * off the table steps six times and then waits, which reads as a stutter on
   * every vehicle in the city. Handed out so the drawing can carry a vehicle
   * forward to where it is *now*.
   */
  get sinceTick(): number { return this.carry; }
  private carry = 0;
  tick = 0;
  /** Milliseconds spent in each system over the last second, by name. */
  readonly cost = new Map<string, number>();
  private costAt = 0;
  private readonly acc = new Map<string, number>();
  /** Ticks dropped to the catch-up cap since the last readout. */
  dropped = 0;

  add(system: System): void {
    this.systems.push(system);
    this.phase.push(system.phase ?? phaseOf(system.name));
    this.acc.set(system.name, 0);
  }

  /**
   * Spends `seconds` of real time.
   *
   * `speed` is the player's time control -- pausing is speed zero, and it
   * stops the accumulator rather than the loop, so unpausing does not release
   * a flood of owed ticks.
   */
  advance(seconds: number, speed: number, now: number): void {
    if (speed <= 0) return;
    this.carry += seconds * speed;
    let ran = 0;
    while (this.carry >= TICK_SECONDS) {
      if (ran >= MAX_CATCH_UP) {
        // Behind, and catching up would make it worse. Drop the debt.
        const lost = Math.floor(this.carry / TICK_SECONDS);
        this.dropped += lost;
        this.carry = 0;
        break;
      }
      this.carry -= TICK_SECONDS;
      this.step(now);
      ran++;
    }
    if (now - this.costAt >= 1000) {
      this.cost.clear();
      for (const [k, v] of this.acc) { this.cost.set(k, v); this.acc.set(k, 0); }
      this.costAt = now;
    }
  }

  private step(now: number): void {
    const t = this.tick++;
    for (let i = 0; i < this.systems.length; i++) {
      const s = this.systems[i];
      // The system's own rate gates the whole system; entity-level spreading
      // happens inside it. A system on FAST still runs every other tick as a
      // whole, because the work it does is not always per-entity.
      if (s.rate > 1 && ((t + this.phase[i]) & (s.rate - 1)) !== 0) continue;
      const at = performance.now();
      s.run(t, TICK_SECONDS * s.rate);
      this.acc.set(s.name, (this.acc.get(s.name) ?? 0) + (performance.now() - at));
    }
    void now;
  }

  /** The systems, for a readout. */
  get names(): string[] { return this.systems.map((s) => s.name); }
}
