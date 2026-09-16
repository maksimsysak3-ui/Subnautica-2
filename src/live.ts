/**
 * The living city: the simulation, running, kept in step with what is on screen.
 *
 * Everything the simulation needs to be a game rather than a library is here --
 * when it is created, what tells it a road moved, what spends its time, and what
 * puts its readings on the map. It is deliberately the only place that knows both
 * about `Simulation` and about the renderer, so neither has to know about the
 * other.
 *
 * THE SIMULATION IS CREATED FROM THE RENDERER'S CITY, NOT BESIDE IT. There is
 * exactly one city, and the version the player is looking at is the one the
 * renderer built -- so the simulation is handed that, through `Renderer.onCity`,
 * which fires for a new game, a loaded save, a device recovery and every edit
 * alike. A simulation built from its own copy of the world would agree with the
 * screen right up until the first difference, and then never again.
 *
 * TIME. The simulation is paused while the menu is up and runs at the player's
 * speed otherwise. `advance` takes real seconds and does its own fixed-rate
 * stepping with a catch-up cap, so a frame that took a quarter of a second
 * because the browser went away does not become a quarter of a second of
 * simulation arriving in one lump.
 */

import { Simulation, View } from './sim';
import { Main } from './sim/mains';

/** Which utility's connection markers each view turns on. */
const DOT_FOR_VIEW: Record<number, number> = {
  [View.POWER]: Main.POWER, [View.WATER]: Main.WATER, [View.SEWAGE]: Main.SEWAGE,
};
import type { City, RoadGraph, ViewInfo, Stat } from './sim';
import type { Renderer } from './gfx/renderer';
import type { Camera } from './gfx/camera';
import type { Stats } from './ui/stats';
import { InfoViews } from './ui/info-views';
import { log } from './util/log';

/** How often the readout's city rows are rewritten, in milliseconds. */
const READOUT_MS = 500;

/**
 * Households the city starts with.
 *
 * Not zero. A brand new city with a road and no inhabitants has nothing for the
 * migration model to work from -- appeal is judged by people who live there --
 * and the player's first ten minutes would be spent waiting to find out whether
 * anything works at all. Eight households is a hamlet, which is what the first
 * junction and the first few houses actually are.
 */
const FOUNDING = 8;

export class LiveCity {
  private sim: Simulation | null = null;
  readonly info: InfoViews;
  /** The `builtAt` of the grid currently on the GPU, so it is uploaded once. */
  private uploaded = -1;
  private readoutAt = -1;
  private founded = false;
  private running = false;
  /** Set when the next city notification is a different world entirely. */
  private fresh = true;

  constructor(
    private renderer: Renderer,
    private camera: Camera,
    private stats: Stats,
    ui: HTMLElement,
  ) {
    this.info = new InfoViews(ui, (view, meta) => this.onView(view, meta));
    renderer.onCity = (city, net, roads) => this.reconcile(city, net, roads);
  }

  /**
   * The world was replaced -- a new game, or a save loaded.
   *
   * The next notification builds a new simulation rather than reconciling the
   * standing one against it: a city of forty thousand people cannot be patched
   * into a different city, and trying would leave every one of them living in a
   * building that is not theirs.
   */
  reset(): void {
    this.fresh = true;
    this.founded = false;
  }

  /** How many people live in the city, or zero before there is one. */
  get population(): number { return this.sim?.people.population ?? 0; }

  /** Whether the game is being played, as opposed to sitting on the menu. */
  set playing(on: boolean) {
    this.running = on;
    this.info.visible = on;
    if (on && this.sim !== null && !this.founded) {
      this.sim.found(FOUNDING);
      this.founded = true;
    }
  }

  private reconcile(city: City, net: RoadGraph, roads: boolean): void {
    if (this.fresh || this.sim === null) {
      this.fresh = false;
      this.sim = new Simulation(city, net, 0x1b0b0, this.renderer.world.mains);
      this.uploaded = -1;
      if (this.running && !this.founded) {
        this.sim.found(FOUNDING);
        this.founded = true;
      }
      log.info('sim', `simulation built over ${city.count.toLocaleString()} buildings`);
      return;
    }
    // Order matters: the lane graph has to exist in its new shape before the
    // places are re-pointed at it, and `roadsChanged` is what rebuilds it.
    if (roads) this.sim.roadsChanged(net, this.renderer.world.mains);
    this.sim.buildingsChanged(city);
    // The grid named lanes that no longer exist, or buildings that do not.
    this.uploaded = -1;
  }

  /**
   * Spends a frame.
   *
   * @param dt real seconds since the last frame.
   * @param now `performance.now()`, for the panel's own throttling.
   */
  update(dt: number, now: number): void {
    const sim = this.sim;
    if (sim === null || !this.running) return;

    // The movement budget goes where the player is looking, not to whichever
    // citizens happen to be first in the table.
    sim.look(this.camera.focus[0], this.camera.focus[2]);
    sim.advance(dt, now);

    const view = this.info.view;
    if (view !== View.NONE) {
      const meta = sim.views.built === view ? this.info.meta(view) : null;
      // Uploaded when the simulation has rebuilt it, which it does on its own
      // schedule -- so an open view is live without the frame asking for one.
      if (meta !== null && sim.views.builtAt !== this.uploaded) {
        this.uploaded = sim.views.builtAt;
        this.renderer.setOverlay(sim.viewGrid, meta.look, meta.ramp);
      }
      this.info.refresh(now, (): Stat[] => sim.viewStats);
    }

    if (now - this.readoutAt >= READOUT_MS) {
      this.readoutAt = now;
      this.stats.set('citizens', sim.people.population.toLocaleString());
      // Milliseconds of simulation per second of real time, summed over the
      // systems. The honest number: a per-tick figure hides that the expensive
      // systems are the ones that run rarely.
      let ms = 0;
      for (const v of sim.scheduler.cost.values()) ms += v;
      this.stats.set('sim', `${ms.toFixed(1)} ms/s`);
    }
  }

  private onView(view: number, meta: ViewInfo | null): void {
    this.sim?.show(view);
    this.uploaded = -1;
    if (meta === null) {
      this.renderer.hideOverlay();
      this.renderer.showDots(0);
      return;
    }
    // An underground view is about a main, so it shows where the mains reach and
    // which buildings are on them -- the same two questions the pipe tool answers,
    // asked from the map instead of from the palette.
    this.renderer.showDots(DOT_FOR_VIEW[view] ?? 0);
    // Shown at once rather than on the next rebuild: `show` built the grid, and
    // a view that takes most of a second to appear reads as a dropped click.
    if (this.sim !== null) {
      this.uploaded = this.sim.views.builtAt;
      this.renderer.setOverlay(this.sim.viewGrid, meta.look, meta.ramp);
    }
  }
}
