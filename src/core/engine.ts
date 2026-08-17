/**
 * Engine loop and system registry.
 *
 * Two update channels:
 *   - fixedUpdate(step)  runs at a locked 60 Hz for anything simulation-critical
 *                        (ballistics, AI decisions, physics). Deterministic.
 *   - update(dt)         runs once per rendered frame for presentation
 *                        (animation blending, camera, audio, UI).
 *
 * Systems declare a `budgetMs`; the profiler flags any that overrun so the
 * performance team has hard data rather than guesses.
 */

import { bus } from './events';

export const FIXED_STEP = 1 / 60;
const MAX_FRAME_DT = 0.25; // never simulate more than 250ms in one frame

export interface System {
  /** Stable identifier, also used by the profiler. */
  readonly id: string;
  /** Lower runs first. Convention: 0 input, 10 sim, 20 gameplay, 30 anim, 40 audio, 50 ui, 60 render. */
  readonly order: number;
  /**
   * Initialisation order, when it differs from update order. A system can need
   * a service at startup that it runs *before* each frame — the player
   * controller updates first but depends on the world existing. Defaults to
   * `order`.
   */
  readonly initOrder?: number;
  /** Soft per-frame budget in ms; exceeded budgets are reported. */
  readonly budgetMs?: number;
  init?(ctx: EngineContext): void | Promise<void>;
  fixedUpdate?(step: number, ctx: EngineContext): void;
  update?(dt: number, ctx: EngineContext): void;
  /** Called after all updates, immediately before the renderer draws. */
  lateUpdate?(dt: number, ctx: EngineContext): void;
  dispose?(): void;
}

export interface EngineContext {
  engine: Engine;
  /** Wall-clock seconds since boot, excluding paused time. */
  elapsed: number;
  /** Interpolation alpha between the last two fixed steps, for smooth rendering. */
  alpha: number;
  paused: boolean;
  /** Simulation speed multiplier — used by the slow-motion kill cam. */
  timeScale: number;
}

export interface SystemTiming {
  id: string;
  lastMs: number;
  avgMs: number;
  peakMs: number;
  budgetMs: number;
}

export class Engine {
  private systems: System[] = [];
  private byId = new Map<string, System>();
  private accumulator = 0;
  private lastTime = 0;
  private rafHandle = 0;
  private running = false;
  private timings = new Map<string, SystemTiming>();
  private frameCount = 0;

  readonly ctx: EngineContext = {
    engine: this,
    elapsed: 0,
    alpha: 0,
    paused: false,
    timeScale: 1,
  };

  /** Rolling frame time in ms, smoothed. */
  frameMs = 16.6;
  /** Frames per second, smoothed. */
  fps = 60;

  add(system: System): this {
    if (this.byId.has(system.id)) {
      throw new Error(`[Engine] duplicate system id "${system.id}"`);
    }
    this.systems.push(system);
    this.byId.set(system.id, system);
    this.systems.sort((a, b) => a.order - b.order);
    this.timings.set(system.id, {
      id: system.id,
      lastMs: 0,
      avgMs: 0,
      peakMs: 0,
      budgetMs: system.budgetMs ?? 4,
    });
    return this;
  }

  get<T extends System>(id: string): T | undefined {
    return this.byId.get(id) as T | undefined;
  }

  /** Throws if the system is missing — use when a dependency is mandatory. */
  require<T extends System>(id: string): T {
    const s = this.byId.get(id);
    if (!s) throw new Error(`[Engine] required system "${id}" is not registered`);
    return s as T;
  }

  async init(): Promise<void> {
    const initSequence = [...this.systems].sort(
      (a, b) => (a.initOrder ?? a.order) - (b.initOrder ?? b.order),
    );
    for (const s of initSequence) {
      if (s.init) await s.init(this.ctx);
    }
    bus.emit('game:boot', { at: performance.now() });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const loop = (now: number): void => {
      if (!this.running) return;
      this.rafHandle = requestAnimationFrame(loop);
      this.frame(now);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.rafHandle) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = 0;
  }

  setPaused(paused: boolean): void {
    if (this.ctx.paused === paused) return;
    this.ctx.paused = paused;
    bus.emit('game:paused', { paused });
  }

  /** Drive one frame manually — used by the headless screenshot harness. */
  frame(now: number): void {
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT;
    if (dt < 0) dt = 0;

    // Smoothed perf counters (always measured, even while paused).
    this.frameMs += (dt * 1000 - this.frameMs) * 0.1;
    this.fps = 1000 / Math.max(0.001, this.frameMs);
    this.frameCount++;

    if (this.ctx.paused) {
      // Still run UI so menus animate while the sim is frozen.
      this.runPhase('update', 0, (s) => s.order >= 50);
      this.runPhase('lateUpdate', 0, (s) => s.order >= 50);
      bus.flush();
      return;
    }

    const scaled = dt * this.ctx.timeScale;
    this.ctx.elapsed += scaled;

    this.accumulator += scaled;
    let steps = 0;
    while (this.accumulator >= FIXED_STEP && steps < 5) {
      this.runPhase('fixedUpdate', FIXED_STEP);
      bus.flush();
      this.accumulator -= FIXED_STEP;
      steps++;
    }
    // If we blew the step budget, drop the remainder rather than spiralling.
    if (steps === 5) this.accumulator = 0;
    this.ctx.alpha = this.accumulator / FIXED_STEP;

    this.runPhase('update', scaled);
    bus.flush();
    this.runPhase('lateUpdate', scaled);
    bus.flush();

    bus.emit('game:tick', { dt: scaled, elapsed: this.ctx.elapsed });
  }

  private runPhase(
    phase: 'fixedUpdate' | 'update' | 'lateUpdate',
    dt: number,
    filter?: (s: System) => boolean,
  ): void {
    for (let i = 0; i < this.systems.length; i++) {
      const s = this.systems[i];
      const fn = s[phase];
      if (!fn) continue;
      if (filter && !filter(s)) continue;
      const t0 = performance.now();
      try {
        fn.call(s, dt, this.ctx);
      } catch (err) {
        console.error(`[Engine] ${s.id}.${phase} threw:`, err);
      }
      if (phase !== 'fixedUpdate') {
        const ms = performance.now() - t0;
        const t = this.timings.get(s.id)!;
        t.lastMs = ms;
        t.avgMs += (ms - t.avgMs) * 0.05;
        if (ms > t.peakMs) t.peakMs = ms;
        if (ms > t.budgetMs && this.frameCount > 120 && this.frameCount % 60 === 0) {
          bus.post('perf:budgetExceeded', { system: s.id, ms });
        }
      }
    }
  }

  getTimings(): SystemTiming[] {
    return [...this.timings.values()].sort((a, b) => b.avgMs - a.avgMs);
  }

  resetPeaks(): void {
    for (const t of this.timings.values()) t.peakMs = 0;
  }

  dispose(): void {
    this.stop();
    for (const s of this.systems) s.dispose?.();
    this.systems.length = 0;
    this.byId.clear();
  }
}
