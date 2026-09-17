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

import { Simulation, View, heightAt, money, PANEL_ONLY } from './sim';
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
import { DemandBars } from './ui/demand-bars';
import { Thoughts } from './ui/thoughts';
import { TaxPanel } from './ui/tax-panel';
import { LinesPanel } from './ui/lines-panel';
import type { DemandReading } from './ui/demand-bars';
import { log } from './util/log';

/** How often the readout's city rows are rewritten, in milliseconds. */
const READOUT_MS = 500;

/**
 * Households the city starts with.
 *
 * Not zero. A brand new city with a road and no inhabitants has nothing for the
 * migration model to work from -- appeal is judged by people who live there --
 * and the player's first ten minutes would be spent waiting to find out whether
 * anything works at all.
 *
 * Thirty rather than eight, which is the difference between a hamlet and a
 * hamlet that is visibly alive. Eight households put nobody on the roads and
 * filled three houses, so the first thing a player saw after zoning a street was
 * a street of empty buildings; thirty fill the first block, take jobs, and start
 * commuting -- which is the machine this game is, running, in the first minute.
 */
const FOUNDING = 30;

export class LiveCity {
  private sim: Simulation | null = null;
  readonly info: InfoViews;
  private readonly bars: DemandBars;
  private readonly thoughts: Thoughts;
  private readonly tax: TaxPanel;
  private readonly lines: LinesPanel;
  /** The `builtAt` of the grid currently on the GPU, so it is uploaded once. */
  private uploaded = -1;
  private readoutAt = -1;
  /** The transit plan the renderer is currently drawing, or -1 for none. */
  private transitAt = -1;
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
    this.bars = new DemandBars(ui);
    // The graded height, not the raw terrain: a bubble belongs over the building,
    // and the building stands on ground the city cut flat for it.
    this.thoughts = new Thoughts(ui, heightAt);
    // The tax controls live inside the budget view's card, which is the only
    // place a rate and the bill it moves can be looked at together.
    this.tax = new TaxPanel();
    this.info.mount(View.BUDGET, this.tax.root);
    // And the lines, under the transport view -- which is where a player goes to
    // ask how people get about, and therefore where the answer belongs.
    this.lines = new LinesPanel();
    this.info.mount(View.TRANSPORT, this.lines.root);
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
    this.bars.visible = on;
    this.thoughts.visible = on;
    if (on && this.sim !== null && !this.founded) {
      this.sim.found(FOUNDING);
      this.founded = true;
    }
  }

  private reconcile(city: City, net: RoadGraph, roads: boolean): void {
    if (this.fresh || this.sim === null) {
      this.fresh = false;
      this.sim = new Simulation(city, net, 0x1b0b0, this.renderer.world);
      this.tax.bind(this.sim.budget);
      const sim = this.sim;
      this.lines.bind(() => ({ transit: this.renderer.world.transit, net: sim.transit }));
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
    if (roads) this.sim.roadsChanged(net, this.renderer.world);
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

    // Land the city has just grown into. Taken here rather than called back from
    // inside the tick on purpose: rebuilding re-enters this object through
    // `Renderer.onCity`, and doing that partway through a tick would reconcile the
    // places while the systems that had not run yet still held the old ones.
    const grew = sim.grew();
    if (grew !== null) this.renderer.rebuild(grew);

    const view = this.info.view;
    if (view !== View.NONE && !PANEL_ONLY.has(view)) {
      const meta = sim.views.built === view ? this.info.meta(view) : null;
      // Uploaded when the simulation has rebuilt it, which it does on its own
      // schedule -- so an open view is live without the frame asking for one.
      if (meta !== null && sim.views.builtAt !== this.uploaded) {
        this.uploaded = sim.views.builtAt;
        this.renderer.setOverlay(sim.viewGrid, meta.look, meta.ramp);
      }
      this.info.refresh(now, (): Stat[] => sim.viewStats);
    } else if (view !== View.NONE) {
      this.info.refresh(now, (): Stat[] => sim.viewStats);
    }

    // What the city is short of, and how much painted land is waiting on it.
    this.bars.refresh(now, (): DemandReading | null => ({
      want: sim.demand.want,
      waiting: sim.growth?.report.waiting ?? 0,
      released: sim.growth?.report.released ?? 0,
    }));

    // The bus and tram lines, whenever anything is asking to see them and the
    // simulation has worked them out again. Pushed rather than pulled because
    // only the simulation can turn a list of stops into the roads between them.
    if (this.renderer.wantTransit) {
      if (sim.transit.shapeVersion !== this.transitAt) {
        this.transitAt = sim.transit.shapeVersion;
        this.renderer.setTransit(sim.transit.shape());
      }
    } else if (this.transitAt !== -1) {
      this.transitAt = -1;
      this.renderer.setTransit(null);
    }

    // What the buildings are complaining about, over the buildings. Projected
    // here rather than drawn by the renderer: a dozen icons that have to be
    // clickable are interface, and the artwork is the same artwork as the button
    // the player has to press to fix it.
    this.thoughts.refresh(now, this.camera, this.camera.width, this.camera.height,
      sim.complaints.list);

    // The sliders follow the budget rather than owning it, so a loaded save shows
    // the rates it was saved with.
    if (this.info.view === View.BUDGET) this.tax.refresh();
    if (this.info.view === View.TRANSPORT) this.lines.refresh();

    if (now - this.readoutAt >= READOUT_MS) {
      this.readoutAt = now;
      this.stats.set('citizens', sim.people.population.toLocaleString());
      this.stats.set('when', sim.clock.label);
      // Money, always on screen. A city builder where the balance is two clicks
      // away is a city builder where the player finds out they are bankrupt two
      // clicks late.
      const bal = Math.round(sim.budget.balance);
      const net = Math.round(sim.economy.report.net);
      this.stats.set('money', `${bal < 0 ? '−' : ''}${money(Math.abs(bal))}`
        + `|${net < 0 ? '−' : '+'}${money(Math.abs(net))} a week`);
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
    // The transport view draws the lines on the map as well as listing them. A
    // coverage map of stations with the routes invisible answers half the
    // question a player opened it with.
    this.renderer.askTransit('view', view === View.TRANSPORT);
    // A view that is not a map paints nothing. Not even an empty wash: the
    // surface mode drains the ground towards grey wherever it has no reading,
    // which is right for a coverage map with gaps in it and wrong for a budget,
    // where the whole map is a gap.
    if (meta === null || PANEL_ONLY.has(view)) {
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
