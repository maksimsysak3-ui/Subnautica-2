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
import { Alerts } from './ui/alerts';
import type { LevelUp } from './sim/progress';
import type { CityMood } from './ui/cititok';
import { MOVER_BUDGET } from './assets/generators/movers';
import { INSTANCE_FLOATS } from './sim';
import { Inspect } from './ui/inspect';
import { TechTree } from './ui/tech-tree';
import { LevelUpCard } from './ui/levelup';
import { Settings } from './ui/settings';
import { Cititok } from './ui/cititok';
import { GRIPE_INFO } from './sim';
import { landmarksForLevel } from './sim/tech';
import { GOALS } from './sim/goals';
import { ping } from './ui/sound';
import { Util } from './sim/agents/utilities';
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
  /** The notices in the corner, and what the last one was about. */
  private readonly alerts: Alerts;
  /**
   * One frame's worth of moving instances, reused.
   *
   * Allocated once at the budget rather than per frame: this is written sixty
   * times a second and a fresh two-hundred-kilobyte array each time is a
   * garbage collection every few seconds, which is a stutter you can see.
   */
  private readonly moverRows =
    new Float32Array(MOVER_BUDGET * INSTANCE_FLOATS) as Float32Array<ArrayBuffer>;
  /** The card for whatever building was last clicked. */
  private readonly inspect: Inspect;
  /** The development tree, the level card and the settings. */
  readonly tech: TechTree;
  readonly levelCard: LevelUpCard;
  readonly settings: Settings;
  /** The phone the city posts from. */
  readonly cititok: Cititok;
  /** What the city is called, for the feed. Set by whoever owns the bar. */
  cityName = 'the city';
  /** What the picture settings were last applied as. */
  private moverShare = 1;
  /** Where that building is, so the card can be kept in step with the city. */
  private selected: [number, number] | null = null;
  /** The economy event count as of the last check, so each one is told once. */
  private eventsSeen = 0;
  /** Whether each utility was short the last time it was looked at. */
  private wasShort = [false, false, false];
  private wasOverdrawn = false;
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
    this.alerts = new Alerts(ui);
    this.inspect = new Inspect(ui, () => { this.selected = null; this.renderer.mark = null; });
    this.tech = new TechTree(ui, renderer.world.progress, () => this.onUnlock());
    // The goals board reads the city rather than a copy of it.
    this.tech.readGoal = (id) => {
      const goal = GOALS.find((g) => g.id === id);
      if (goal === undefined || this.sim === null) return [0, 1];
      return goal.progress(this.sim, this.renderer.world);
    };
    this.levelCard = new LevelUpCard(ui);
    this.cititok = new Cititok(ui, () => this.mood());
    this.settings = new Settings(ui, {
      apply: (v) => {
        const q = renderer.quality;
        q.shadows = v.shadows;
        q.bloom = v.bloom;
        q.antialias = v.antialias;
        q.vignette = v.vignette ? 1 : 0;
        q.grass = v.grass;
        q.autoScale = v.autoScale;
        renderer.shadowPixels = v.shadowPixels;
        if (!v.autoScale) renderer.setRenderScale(v.renderScale);
        this.moverShare = v.movers;
        this.thoughts.visible = this.running && v.bubbles;
        this.alerts.visible = this.running && v.notices;
        renderer.quality.weather = v.weather;
      },
    });
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

  /**
   * A tap on the map with no tool in hand.
   *
   * Wired to `BuildTools.onInspect` by whoever owns both. Tapping a building
   * opens its card; tapping bare ground, or the same building again, closes it.
   */
  tap(at: [number, number] | null): void {
    if (at === null || this.sim === null) { this.closeInspect(); return; }
    const found = this.sim.inspect(at[0], at[1]);
    if (found === null) { this.closeInspect(); return; }
    if (this.inspect.open && this.inspect.place === found.place) {
      this.closeInspect();
      return;
    }
    this.selected = [at[0], at[1]];
    this.inspect.show(found);
    // The selection, on the ground under the building, drawn by the same
    // mechanism the tools mark what they are about to affect with.
    const half = Math.max(found.footprint[0], found.footprint[1]) * 4 + 2;
    this.renderer.mark = {
      rect: [found.x - half, found.z - half, found.x + half, found.z + half],
      tint: [0.38, 0.83, 1.0],
    };
  }

  private closeInspect(): void {
    this.selected = null;
    this.renderer.mark = null;
    if (this.inspect.open) this.inspect.close();
  }

  /**
   * What the city would post about, as one reading.
   *
   * Everything here is already on a panel somewhere. What the feed does is say
   * it in the voice of somebody it is happening to, which is the register a
   * city builder never uses.
   */
  private mood(): CityMood | null {
    const sim = this.sim;
    if (sim === null) return null;
    // The complaint the most buildings share, which is the one a city would
    // actually be talking about.
    let worst = '', count = 0;
    const tally = sim.complaints.tally;
    for (let g = 0; g < tally.length; g++) {
      if (tally[g] <= count) continue;
      count = tally[g];
      worst = GRIPE_INFO[g]?.title ?? '';
    }
    const u = sim.utilities.report;
    return {
      population: sim.people.population,
      happiness: sim.people.happiness,
      worstGripe: count > 0 ? worst : '',
      gripeCount: count,
      speed: sim.traffic.stats.meanSpeed * 3.6,
      driving: sim.traffic.stats.driving,
      net: sim.economy.report.net,
      power: u.served[Util.POWER],
      water: u.served[Util.WATER],
      riders: sim.transit.report.ridersPerDay,
      city: this.cityName,
      level: this.renderer.world.progress.level,
    };
  }

  /** A development node was bought: the drawers and the bar have to catch up. */
  private onUnlock(): void {
    ping();
    this.onProgress?.();
  }

  /** Set by whoever owns the bar, so it can repaint its star count. */
  onProgress: (() => void) | null = null;

  /** Shows the cards for levels the city has just crossed. */
  celebrate(levels: LevelUp[]): void {
    for (const l of levels) this.levelCard.push(l);
    this.tech.refresh();
    this.onProgress?.();
  }

  /** How many people live in the city, or zero before there is one. */
  get population(): number { return this.sim?.people.population ?? 0; }

  /** Whether the game is being played, as opposed to sitting on the menu. */
  set playing(on: boolean) {
    this.running = on;
    this.info.visible = on;
    this.bars.visible = on;
    this.thoughts.visible = on;
    this.alerts.visible = on;
    this.cititok.visible = on;
    if (!on) { this.alerts.clear(); this.closeInspect(); }
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

    // Everything that is moving, into the tail of the instance buffer. Every
    // frame, because a car that is drawn where it was four frames ago is a car
    // that teleports -- and it is one pass over two tables, which is cheaper
    // than deciding whether to do it.
    const eye = this.camera.eye;
    this.renderer.setMovers(this.moverRows,
      sim.drawMovers(this.moverRows, Math.round(MOVER_BUDGET * this.moverShare),
        eye[0], eye[2], heightAt));

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
      // The bar reads these rather than counting buildings for itself.
      this.renderer.summary.citizens = sim.people.population;
      this.renderer.summary.net = net;
      this.renderer.summary.hasSim = true;
      this.stats.set('money', `${bal < 0 ? '−' : ''}${money(Math.abs(bal))}`
        + `|${net < 0 ? '−' : '+'}${money(Math.abs(net))} a week`);
      // Milliseconds of simulation per second of real time, summed over the
      // systems. The honest number: a per-tick figure hides that the expensive
      // systems are the ones that run rarely.
      let ms = 0;
      for (const v of sim.scheduler.cost.values()) ms += v;
      this.stats.set('sim', `${ms.toFixed(1)} ms/s`);
      // The passive drip: experience for everybody who has moved in since the
      // last look. A working city earns while the player watches it work.
      const p = this.renderer.world.progress;
      const earned = p.forCitizens(sim.people.population);
      if (earned > 0) {
        this.celebrate(p.add(earned, 'people', landmarksForLevel));
      }
      // Goals: a reading off the city rather than a counter kept beside it, so
      // one cannot drift out of step with what the city actually is.
      for (const goal of GOALS) {
        if (p.done.has(goal.id)) continue;
        const [now2, need] = goal.progress(sim, this.renderer.world);
        if (now2 < need) continue;
        p.done.add(goal.id);
        this.celebrate(p.add(goal.xp, 'objective', landmarksForLevel));
        this.alerts.push({
          title: 'Goal met', body: goal.title, tone: 'good',
          figure: `+${goal.xp} xp`, tag: `goal-${goal.id}`,
        });
      }
      this.announce(sim);
      // The open card, refreshed on the same beat as everything else: a
      // building whose power has just come back should say so while the player
      // is still looking at it.
      const at = this.selected;
      if (at !== null) {
        const again = sim.inspect(at[0], at[1]);
        if (again === null) this.closeInspect(); else this.inspect.show(again);
      }
    }
    this.alerts.update(now);
    this.cititok.update(now);
  }

  /**
   * What the city has to say for itself since the last look.
   *
   * Everything here is a change of state rather than a state: a city that is
   * short of power says so once and then stops, and says so again when it is
   * fixed. A notice that repeats while nothing has changed is a notice a player
   * learns to ignore, which costs the mechanism it was meant to explain.
   */
  private announce(sim: Simulation): void {
    const eco = sim.economy.report;
    if (eco.eventSerial !== this.eventsSeen) {
      this.eventsSeen = eco.eventSerial;
      const up = eco.eventValue >= 0;
      this.alerts.push({
        title: up ? 'Windfall' : 'Setback',
        body: eco.event,
        tone: up ? 'good' : 'warn',
        figure: `${up ? '+' : '−'}${money(Math.abs(eco.eventValue))}`,
      });
    }

    // The utilities, which are the failures a player cannot see from the camera:
    // a browned-out district looks exactly like a district.
    const util = sim.utilities.report;
    const NAMED: Array<{ u: number; name: string; fix: string }> = [
      { u: Util.POWER, name: 'Power', fix: 'Build another plant or a wind farm.' },
      { u: Util.WATER, name: 'Water', fix: 'Add a pumping station on the river.' },
      { u: Util.SEWAGE, name: 'Sewage', fix: 'Add a treatment works downstream.' },
    ];
    for (const n of NAMED) {
      const margin = util.margin[n.u];
      const short = margin < 0.995;
      if (short === this.wasShort[n.u]) continue;
      this.wasShort[n.u] = short;
      // Nothing to report about a utility the city has not started yet: a town
      // with no pumps is not a town with a water crisis.
      if (margin <= 0) continue;
      this.alerts.push({
        title: short ? `${n.name} shortfall` : `${n.name} restored`,
        body: short
          ? `The network is supplying ${Math.round(margin * 100)}% of what the city `
            + `is drawing. ${n.fix}`
          : `Supply is ahead of demand again.`,
        tone: short ? 'bad' : 'good',
        tag: `util-${n.u}`,
        figure: `${Math.round(margin * 100)}%`,
      });
    }

    const overdrawn = sim.budget.balance < 0;
    if (overdrawn !== this.wasOverdrawn) {
      this.wasOverdrawn = overdrawn;
      this.alerts.push({
        title: overdrawn ? 'In the red' : 'Back in the black',
        body: overdrawn
          ? 'The city is running on its overdraft. Raise a rate or cut a service '
            + 'before growth stops.'
          : 'The treasury is positive again.',
        tone: overdrawn ? 'bad' : 'good',
        tag: 'treasury',
        figure: money(Math.abs(Math.round(sim.budget.balance))),
      });
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
