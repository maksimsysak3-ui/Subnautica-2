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

import { IndustryCard } from './ui/industry-card';
import { resourcePicker } from './ui/resource-picker';
import { resourceById } from './sim/resources';
import type { ResourceId } from './sim/resources';
import { Plumes } from './sim/agents/plumes';
import { rampFor } from './ui/access';
import { FirstSteps } from './ui/first-steps';
import { ScenarioCard } from './ui/scenario-card';
import { checkScenario, scenarioById } from './sim/scenarios';
import { fanfare } from './ui/sound';
import { Simulation, View, VIEWS, VIEW_GRID, surfaceAt, money, PANEL_ONLY } from './sim';
import { catchmentOf } from './sim/agents/services';
import { LOAN_OFFERS, MAX_LOANS, loanPayment } from './sim/budget';
import { checkAchievements } from './sim/achievements';
import { Alerts } from './ui/alerts';
import type { Alert } from './ui/alerts';
import type { LevelUp } from './sim/progress';
import type { CityMood, WeatherRead } from './ui/cititok';
import type { Sky } from './sim/weather';
import { skyOf, labelOf, glyphOf, temperature } from './sim/weather';
import { MOVER_BUDGET } from './assets/generators/movers';
import { ASSETS } from './assets/registry';
import { Use } from './sim/agents/lanes';
import { INSTANCE_FLOATS } from './sim';
import { Inspect } from './ui/inspect';
import { TechTree } from './ui/tech-tree';
import { LevelUpCard } from './ui/levelup';
import { Settings } from './ui/settings';
import { Cititok } from './ui/cititok';
import { Computer } from './ui/computer';
import { TechWheel } from './ui/tech-wheel';
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
import { Cheers } from './ui/cheers';
import { TaxPanel } from './ui/tax-panel';
import { PolicyPanel } from './ui/policy-panel';
import { LinesPanel } from './ui/lines-panel';
import type { DemandReading } from './ui/demand-bars';
import { log } from './util/log';
import { CityHall } from './ui/city-hall';
import { StatsApp, type StatsRead } from './ui/stats-app';
import { DistrictLabels } from './ui/district-labels';
import { DISTRICT_COLOURS } from './sim/districts';
import type { DistrictStats } from './sim/agents/economy';
import { BRANCH_STYLE } from './ui/zones';
import { BRANCHES } from './assets/types';
import type { AssetDef } from './assets/types';

/** The coverage map a service building is judged on, or none. */
function coverageView(def: AssetDef): number {
  if (def.zone !== 'service') return View.NONE;
  if (def.id.startsWith('svc.waste.')) return View.RUBBISH;
  switch (def.branch) {
    case 'power': return View.POWER;
    case 'water': return View.WATER;
    case 'sewage': return View.SEWAGE;
    case 'fire': return View.FIRE;
    case 'police': return View.POLICE;
    case 'health': return View.HEALTH;
    case 'education': return View.EDUCATION;
    case 'parks': return View.PARKS;
    case 'transport': return View.TRANSPORT;
    default: return View.NONE;
  }
}
import { Purpose } from './sim/agents/places';
import { STAGE_NAMES, EDU_NAMES } from './sim/agents/people';
import { MODE_NAMES } from './sim/agents/routine';
import { RESOURCES } from './sim/resources';
import { cellHectares } from './sim/industry';
import { MAX_TIER, TIER_PRICE, nextWing } from './sim/world';
import type { Lot } from './sim/world';
import { TIER_CAPACITY, TIER_REACH, TIER_OUTPUT, TIER_UPKEEP } from './sim/agents/places';
import { assetById } from './assets/registry';
import type { Inspection } from './sim/agents/sim';
import { buildingPrice } from './sim/costs';
import { IncidentMarkers } from './ui/incidents';
import { Need } from './sim/agents/dispatch';
import { siren, rumble } from './ui/sound';
import { valleyAt } from './sim';
import type { DisasterCity, Strike, Warning } from './sim/disasters';
import type { EventCity, Venue } from './sim/events';
import { eventById } from './sim/events';
import { branchLevel } from './sim/tech';
import { RULES } from './sim/difficulty';
import type { Issues, Phase } from './sim/politics';
import type { CouncilCity } from './sim/council';
import { BLOCS, billById, petitionById, projectById } from './sim/council';
import type { DeskApp } from './ui/computer';
import type { NewsDesk, NewsTone } from './sim/news';
import { Gripe } from './sim';
import { TICKS_PER_DAY, SECONDS_PER_DAY } from './sim/agents/calendar';
import { CITY_DAY_SECONDS } from './gfx/renderer';

/** The hour a new city's first day starts at. */
const START_HOUR = 7;

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
  private readonly cheers: Cheers;
  private readonly tax: TaxPanel;
  private readonly policies: PolicyPanel;
  private readonly lines: LinesPanel;
  /** The notices in the corner, and what the last one was about. */
  private readonly alerts: Alerts;
  /** The phone's politics app, and what the voters see when they look at the city. */
  private readonly hall: CityHall;
  private readonly statsApp: StatsApp;
  private readonly districtLabels: DistrictLabels;
  /** Fires, break-ins and medical calls, marked over the map. */
  private readonly incidents: IncidentMarkers;
  private issues: Issues | null = null;
  /** Whether an information view has been opened, for the guide. */
  private viewed = false;
  private issuesAt = -1e9;
  /**
   * One frame's worth of moving instances, reused.
   *
   * Allocated once at the budget rather than per frame: this is written sixty
   * times a second and a fresh two-hundred-kilobyte array each time is a
   * garbage collection every few seconds, which is a stutter you can see.
   */
  /** The industry section of the building card, and which headquarters it shows. */
  private readonly industryCard = new IndustryCard(() => this.renderer.world.industry,
    (hq) => { this.closeInspect(); this.onRedrawArea?.(hq); });
  private cardHq = -1;
  private cardAt = 0;
  /** Hands an industry headquarters back to the area tool. Set by main. */
  onRedrawArea: ((hq: number) => void) | null = null;
  /** Which resource the resources view paints; kept across new cities. */
  private resourcePick: ResourceId = 'fertile';
  /** Smoke and steam over the chimneys, rescanned when the city changes. */
  private readonly plumes = new Plumes();
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
  /** The City Hall computer: council, paper, voters, petitions, stats, elections. */
  readonly computer: Computer;
  /** Hold Tab: every device and desk, a flick away. */
  readonly wheel: TechWheel;
  /** Saving, which the build tools own; set by the page. */
  onSave: (() => void) | null = null;
  /**
   * Where the city's name is read from. A function, not a copy: the name
   * changes on founding, on load and when a save renames it, and a copy taken
   * at boot is how the phone went on saying Salford after all three.
   */
  nameSource: () => string = () => 'the city';
  get cityName(): string { return this.nameSource(); }
  set cityName(name: string) { this.nameSource = () => name; }
  /**
   * The player's time control, in multiples of real time.
   *
   * Passed straight to the simulation, so pausing pauses the city rather than
   * only the sun, and ten times speed is ten times as much city.
   */
  set speed(rate: number) {
    this.rate = rate;
    if (this.sim !== null) this.sim.speed = rate;
  }
  private rate = 1;
  /** What the picture settings were last applied as. */
  private moverShare = 1;
  /** Where that building is, so the card can be kept in step with the city. */
  private selected: [number, number] | null = null;
  /** The economy event count as of the last check, so each one is told once. */
  private eventsSeen = 0;
  /** Whether each utility was short the last time it was looked at. */
  private wasShort = [false, false, false];
  /** Consecutive looks each utility has spent on the other side of the line. */
  private shortRun = [0, 0, 0];
  /** Whether the player was told about the shortfall now in progress. */
  private toldShort = [false, false, false];
  /** Consecutive looks with homes standing and no supply of each at all. */
  private noneRun = [0, 0, 0];
  private steps: FirstSteps;
  private challenge: ScenarioCard;
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
    private readonly ui: HTMLElement,
  ) {
    this.info = new InfoViews(ui, (view, meta) => this.onView(view, meta));
    this.bars = new DemandBars(ui);
    // The graded height, not the raw terrain: a bubble belongs over the building,
    // and the building stands on ground the city cut flat for it.
    this.thoughts = new Thoughts(ui, surfaceAt);
    this.cheers = new Cheers(ui, surfaceAt);
    this.incidents = new IncidentMarkers(ui, surfaceAt, (x, z) => this.lookAt(x, z));
    this.districtLabels = new DistrictLabels(ui, surfaceAt);
    // The tax controls live inside the budget view's card, which is the only
    // place a rate and the bill it moves can be looked at together.
    this.tax = new TaxPanel();
    this.info.mount(View.BUDGET, this.tax.root);
    this.policies = new PolicyPanel();
    this.info.mount(View.BUDGET, this.policies.root);
    // The resources view's picker: which resource the map is painted in.
    this.info.mount(View.RESOURCES, resourcePicker((id) => {
      const r = resourceById(id);
      const entry = VIEWS.find((v) => v.id === View.RESOURCES);
      if (entry !== undefined) {
        entry.ramp = [...r.ramp];
        entry.legend = r.blurb;
      }
      this.resourcePick = id;
      if (this.sim !== null) this.sim.views.resource = id;
      this.info.redraw();
    }));
    // And the lines, under the transport view -- which is where a player goes to
    // ask how people get about, and therefore where the answer belongs.
    this.alerts = new Alerts(ui);
    this.alerts.onPush = (a) => this.toPaper(a);
    this.steps = new FirstSteps(ui);
    this.challenge = new ScenarioCard(ui);
    this.inspect = new Inspect(ui, () => { this.selected = null; this.renderer.mark = null; });
    this.tech = new TechTree(ui, () => renderer.world.progress, () => this.onUnlock());
    // The goals board reads the city rather than a copy of it.
    this.tech.readGoal = (id) => {
      const goal = GOALS.find((g) => g.id === id);
      if (goal === undefined || this.sim === null) return [0, 1];
      return goal.progress(this.sim, this.renderer.world);
    };
    this.levelCard = new LevelUpCard(ui);
    this.hall = new CityHall({
      politics: () => (this.sim === null ? null : this.renderer.world.politics),
      issues: () => this.issues,
      population: () => this.sim?.people.population ?? 0,
      day: () => this.gameDay(),
      balance: () => this.renderer.world.budget.balance,
      rally: () => this.rally(),
    });
    this.statsApp = new StatsApp(() => this.statsRead());
    this.cititok = new Cititok(ui, () => this.mood(), () => this.forecast());
    this.computer = new Computer(ui, {
      world: () => this.renderer.world,
      live: () => this.running && this.sim !== null,
      cityName: () => this.cityName,
      day: () => this.gameDay(),
      population: () => this.sim?.people.population ?? 0,
      happiness: () => this.sim?.people.happiness ?? 0,
      net: () => this.sim?.economy.report.net ?? 0,
      ledger: () => this.sim?.economy.report ?? null,
      dispatch: () => this.sim?.dispatch.stats ?? null,
      tourism: () => this.sim?.economy.tourism ?? null,
      eventCity: () => (this.sim === null ? null : this.eventCity(this.sim)),
      bookEvent: (id) => this.bookEvent(id),
    }, this.hall, this.statsApp);
    this.wheel = new TechWheel(ui, [
      { label: 'Phone', device: 'phone', hint: 'The city feed and the weather', run: () => this.cititok.show() },
      { label: 'Computer', device: 'computer', hint: 'City Hall: council, news, industry, stats', run: () => this.computer.show() },
    ]);
    this.settings = new Settings(ui, {
      apply: (v) => {
        const q = renderer.quality;
        q.shadows = v.shadows;
        q.bloom = v.bloom;
        q.antialias = v.antialias;
        q.vignette = v.vignette ? 1 : 0;
        q.grass = v.grass;
        q.ao = v.ao ? 1 : 0;
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
    renderer.onCity = (city, net, roads, pipes) => {
      this.plumes.use(city);
      this.reconcile(city, net, roads, pipes);
    };
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
    if (this.stormHeld && this.renderer.weather.pinned === LiveCity.STORM_SKY) this.renderer.weather.release();
    this.stormHeld = false;
    this.shakeLeft = 0;
    this.shakeAt = [0, 0];
    this.fresh = true;
    this.founded = false;
    this.seenPetitions.clear();
    this.seenDivision = '';
    this.seenProtest = 0;
    this.seenProjects = -1;
    this.columnDay = -1;
    this.council = null;
    this.steps.reset();
    this.wasShort = [false, false, false];
    this.shortRun = [0, 0, 0];
    this.toldShort = [false, false, false];
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
    // A headquarters carries its industry: what it makes and where it goes.
    this.cardHq = -1;
    if (found.asset.startsWith('spec.hq.')) {
      const ind = this.renderer.world.industry;
      const grid = this.renderer.world.grid;
      const hq = ind.hqs.findIndex((h) => {
        const [cx, cz] = ind.centre(h, grid);
        return Math.abs(cx - found.x) < 30 && Math.abs(cz - found.z) < 30;
      });
      if (hq >= 0) {
        this.cardHq = hq;
        this.industryCard.show(hq);
        this.inspect.attach(this.industryCard.root);
      }
    }
    // A processing plant says what it is taking and what that is worth.
    if (found.asset.startsWith('spec.plant.')) this.inspect.attach(this.plantSection(found));
    // A service building can be upgraded: the section says what the next tier
    // buys and what it costs, and builds it.
    if (found.branch !== undefined && !found.asset.startsWith('spec.')) {
      const lot = this.lotAt(found);
      if (lot !== undefined) this.inspect.attach(this.upgradeSection(lot, found));
    }
    // The selection, on the ground under the building, drawn by the same
    // mechanism the tools mark what they are about to affect with.
    const half = Math.max(found.footprint[0], found.footprint[1]) * 4 + 2;
    this.renderer.mark = {
      rect: [found.x - half, found.z - half, found.x + half, found.z + half],
      tint: [0.38, 0.83, 1.0],
    };
  }

  /** Builds a tier onto a lot. Wired by main to the build tools, which pay and rebuild. */
  onUpgrade: ((lot: Lot) => string | null) | null = null;

  private plantSection(found: Inspection): HTMLElement {
    const world = this.renderer.world;
    const plants = world.lots.filter((l) => l.id.startsWith('spec.plant.'));
    const half = world.grid / 2;
    const i = plants.findIndex((l) => Math.abs((l.gx - half + l.w / 2) * 8 - found.x) < 6
      && Math.abs((l.gz - half + l.d / 2) * 8 - found.z) < 6);
    const rep = world.industry.plantReports[i];
    const kind = found.asset.slice('spec.plant.'.length);
    const info = RESOURCES.find((r) => r.id === kind);
    const box = document.createElement('div');
    box.className = 'mr-upg';
    const head = document.createElement('div');
    head.className = 'mr-upg-head';
    head.textContent = `Processing ${info?.product.toLowerCase() ?? kind}`;
    box.appendChild(head);
    const row = (k: string, v: string): void => {
      const r = document.createElement('div');
      r.className = 'mr-st-row';
      const a = document.createElement('span'); a.textContent = k;
      const b = document.createElement('b'); b.textContent = v;
      r.append(a, b);
      box.appendChild(r);
    };
    if (rep === undefined) {
      row('Taking', 'starts next week');
    } else {
      row('Taking a week', `${Math.round(rep.taken)} of ${Math.round(rep.capacity * rep.staffing)} units`);
      row('Adds a week', money(Math.round(rep.income)));
    }
    const fed = world.industry.hqs.some((h) => h.kind === kind && h.exportShare < 1);
    if (!fed) {
      const note = document.createElement('div');
      note.className = 'mr-upg-note';
      note.textContent = world.industry.hqs.some((h) => h.kind === kind)
        ? 'Its headquarters ships everything out. Move its slider towards supply the city to feed this plant.'
        : `No ${info?.name.toLowerCase() ?? kind} headquarters supplies it yet.`;
      box.appendChild(note);
    }
    return box;
  }

  /** The placed lot a building on the map stands on. */
  private lotAt(found: Inspection): Lot | undefined {
    const world = this.renderer.world;
    const half = world.grid / 2;
    return world.lots.find((l) => l.id === found.asset && l.wingOf === undefined
      && Math.abs((l.gx - half + l.w / 2) * 8 - found.x) < 6
      && Math.abs((l.gz - half + l.d / 2) * 8 - found.z) < 6);
  }

  private upgradeSection(lot: Lot, found: Inspection): HTMLElement {
    const world = this.renderer.world;
    const tier = lot.tier ?? 0;
    const box = document.createElement('div');
    box.className = 'mr-upg';
    const head = document.createElement('div');
    head.className = 'mr-upg-head';
    const title = document.createElement('span');
    title.textContent = ['Standard', 'Extended', 'Flagship'][tier];
    const pips = document.createElement('span');
    pips.className = 'mr-upg-pips';
    for (let i = 1; i <= MAX_TIER; i++) {
      const p = document.createElement('i');
      if (i <= tier) p.className = 'is-on';
      pips.appendChild(p);
    }
    head.append(title, pips);
    box.appendChild(head);
    const def = assetById(lot.id);
    const utility = found.branch === 'power' || found.branch === 'water' || found.branch === 'sewage';
    if (tier >= MAX_TIER || def === undefined) {
      const done = document.createElement('div');
      done.className = 'mr-upg-note';
      done.textContent = utility
        ? `Fully upgraded: ${Math.round(TIER_OUTPUT * MAX_TIER * 100)}% more output than it was built with.`
        : 'Fully upgraded: twice the capacity it was built with, and further reach.';
      box.appendChild(done);
      return box;
    }
    const perks = document.createElement('div');
    perks.className = 'mr-upg-perks';
    const perk = (text: string, bad = false): void => {
      const p = document.createElement('span');
      p.textContent = text;
      if (bad) p.className = 'is-cost';
      perks.appendChild(p);
    };
    if (utility) perk(`+${Math.round(TIER_OUTPUT * 100)}% output`);
    else { perk(`+${Math.round(TIER_CAPACITY * 100)}% capacity`); perk(`+${Math.round(TIER_REACH * 100)}% reach`); }
    perk(`+${Math.round(TIER_UPKEEP * 100)}% upkeep`, true);
    box.appendChild(perks);
    const next = nextWing(world, lot);
    const price = Math.round(buildingPrice(def) * TIER_PRICE[tier + 1]);
    const btn = document.createElement('button');
    btn.className = 'mr-upg-btn';
    btn.textContent = `${tier === 0 ? 'Build an extension wing' : 'Make it a flagship'} · ${money(price)}`;
    if (next.why !== null) {
      btn.disabled = true;
      const why = document.createElement('div');
      why.className = 'mr-upg-note';
      why.textContent = `Needs a free strip two cells deep beside it: ${next.why.replace(/^no room beside it: ?/, '')}.`;
      box.append(btn, why);
      return box;
    }
    btn.addEventListener('click', () => {
      if (this.onUpgrade?.(lot) !== null) return;
      this.sim?.applyTiers();
      const again = this.sim?.inspect(found.x, found.z) ?? null;
      if (again !== null) {
        this.inspect.show(again);
        this.inspect.attach(this.upgradeSection(lot, again));
      }
    });
    box.appendChild(btn);
    return box;
  }

  /**
   * Shows the districts on the map, the one being edited bright in its own
   * colour. Called by the district tool on every pick and every stroke.
   */
  showDistricts(focus: number): void {
    const D = this.renderer.world.districts;
    const d = D.byId(focus);
    const entry = VIEWS.find((v) => v.id === View.DISTRICTS);
    if (entry !== undefined) {
      entry.ramp = ['#2a3340', '#5a6a80', d === undefined ? '#e06a7a' : DISTRICT_COLOURS[d.colour % DISTRICT_COLOURS.length]];
      entry.legend = d === undefined ? 'Erasing: drag over a district to take the ground out of it.'
        : `${d.name} is bright; the other districts are dim.`;
    }
    if (this.sim !== null) {
      this.sim.views.districts = D;
      this.sim.views.districtFocus = focus;
    }
    this.info.open(View.DISTRICTS);
    // Rebuilt now rather than on the view's next beat: a stroke of paint should
    // show the moment it lands.
    this.sim?.show(View.DISTRICTS);
    this.uploaded = -1;
    this.info.redraw();
  }

  /** A district's figures from the last settle. */
  districtStats(id: number): DistrictStats | undefined { return this.sim?.economy.districtStats.get(id); }

  /** The view the placement tool opened, so it is the only one it closes. */
  private autoView: number = View.NONE;
  /** The catchment of the service in hand, painted round its ghost. */
  private previewReach: { good: number; worst: number } | null = null;
  /** Where the catchment was last painted, so it is repainted only when it moves. */
  private previewKey = '';
  private previewGrid: Uint8Array | null = null;

  /**
   * The coverage map for a service while it is in hand, as every city builder
   * shows it: where the city's fire cover already reaches is where a new
   * station is wasted. Opened for a service with a map, closed again when the
   * tool is put down -- but never over a view the player opened themselves.
   */
  previewCoverage(def: AssetDef | null): void {
    const view = def === null ? View.NONE : coverageView(def);
    const ours = this.autoView !== View.NONE && this.info.view === this.autoView;
    if (view === View.NONE) {
      if (ours) this.info.open(View.NONE);
      this.autoView = View.NONE;
      return;
    }
    if (this.info.view !== View.NONE && !ours) return;
    this.autoView = view;
    const reach = def?.branch === undefined ? undefined : catchmentOf(def.branch);
    this.previewReach = reach !== undefined && reach.worst > 0 ? reach : null;
    this.previewKey = '';
    this.info.open(view);
  }

  /**
   * A coverage grid with one more catchment on it, centred on a point: full
   * within \`good\` metres, fading to nothing at \`worst\`, as the service
   * model stamps them. Painted over open ground too -- the disc is what shows
   * how far the thing reaches.
   */
  private withCatchment(src: Uint8Array, at: readonly [number, number],
    reach: { good: number; worst: number }): Uint8Array {
    const n = VIEW_GRID;
    if (this.previewGrid === null || this.previewGrid.length !== src.length) this.previewGrid = new Uint8Array(src.length);
    const out = this.previewGrid;
    out.set(src);
    // Eight-metre cells: the extent the overlay is drawn over.
    const extent = this.renderer.world.grid * 8;
    const cell = extent / n;
    const i0 = Math.max(0, Math.floor((at[0] - reach.worst + extent / 2) / cell));
    const i1 = Math.min(n - 1, Math.ceil((at[0] + reach.worst + extent / 2) / cell));
    const j0 = Math.max(0, Math.floor((at[1] - reach.worst + extent / 2) / cell));
    const j1 = Math.min(n - 1, Math.ceil((at[1] + reach.worst + extent / 2) / cell));
    for (let j = j0; j <= j1; j++) {
      const z = -extent / 2 + (j + 0.5) * cell;
      for (let i = i0; i <= i1; i++) {
        const x = -extent / 2 + (i + 0.5) * cell;
        const d = Math.hypot(x - at[0], z - at[1]);
        if (d >= reach.worst) continue;
        const t = d <= reach.good ? 1 : 1 - (d - reach.good) / (reach.worst - reach.good);
        const k = j * n + i;
        out[k] = Math.max(out[k], Math.max(1, Math.round(255 * t)));
      }
    }
    return out;
  }

  /**
   * Runs a junction the player's way; see \`Simulation.setJunction\`. Null with
   * no city running.
   */
  setJunction(node: number, want: number): number | null {
    return this.sim === null ? null : this.sim.setJunction(this.renderer.world.net, node, want);
  }

  /** How a junction is run now and how many arms it has, or null. */
  junctionAt(node: number): { control: number; arms: number } | null {
    const j = this.sim?.junctions;
    if (j === undefined || node < 0 || node >= j.count) return null;
    return { control: j.control[node], arms: j.armsAt(node) };
  }

  /** Opens the resources view on one resource, as the area tool does. */
  showResource(id: ResourceId): void {
    const r = resourceById(id);
    const entry = VIEWS.find((v) => v.id === View.RESOURCES);
    if (entry !== undefined) { entry.ramp = [...r.ramp]; entry.legend = r.blurb; }
    this.resourcePick = id;
    if (this.sim !== null) this.sim.views.resource = id;
    this.info.open(View.RESOURCES);
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
  /**
   * Moves the first people in. A new city gets its founding households; a
   * loaded one is refilled to the population it was saved with, so a city of
   * twenty thousand is not reloaded as a village of thirty families waiting
   * for migration to notice it.
   */
  private foundCity(sim: Simulation): void {
    const target = this.renderer.world.residents;
    if (target <= 0) { sim.found(FOUNDING); return; }
    for (let guard = 0; guard < 2000 && sim.people.population < target; guard++) {
      const before = sim.people.population;
      sim.found(25);
      // No homes left to put anybody in: the rest arrive by migration.
      if (sim.people.population === before) break;
    }
  }

  /** The city's clock for the sky and the calendar, or null with no city running. */
  dayClock(): { fraction: number; day: number } | null {
    if (this.sim === null || !this.running) return null;
    return { fraction: this.sim.clock.fraction, day: this.sim.clock.day };
  }

  /** Whether the sky is being held stormy for a disaster, by this and nothing else. */
  private stormHeld = false;
  private static readonly STORM_SKY = 0.97;

  /** The camera shake still owed by an earthquake, in seconds, and the offset last applied. */
  private shakeLeft = 0;
  private shakeAt: [number, number] = [0, 0];

  /** What a disaster reads off the city: the building table, fire cover and the river. */
  private disasterCity(sim: Simulation): DisasterCity {
    const p = sim.places, c = p.col;
    const fire = BRANCHES.indexOf('fire');
    return {
      population: sim.people.population,
      count: p.count,
      live: (i) => p.live[i] !== 0,
      service: (i) => c.purpose[i] === Purpose.SERVICE,
      x: (i) => c.x[i], z: (i) => c.z[i],
      health: c.health,
      cover: (i) => (fire < 0 ? 0 : sim.services.at(i, fire)),
      riverside: (x, z) => { const v = valleyAt(x, z); return v !== null && !v.bed; },
      ignite: (i) => sim.dispatch.ignite(i),
    };
  }

  /** What an event reads off the city: its size, its visitors and its venues. */
  eventCity(sim: Simulation): EventCity {
    const p = sim.places, c = p.col;
    return {
      population: sim.people.population,
      // The city's own draw, without today's event -- which the economy only
      // counts in at its next settle, so the two may briefly disagree.
      visitors: Math.max(0, sim.economy.tourism.visitors - sim.economy.eventVisitors),
      venues: (re) => {
        const out: Venue[] = [];
        for (let id = 0; id < p.count; id++) {
          if (p.live[id] === 0 || c.purpose[id] !== Purpose.SERVICE) continue;
          const def = ASSETS[c.proto[id]];
          if (def !== undefined && re.test(def.id)) out.push({ id, x: c.x[id], z: c.z[id], name: def.name });
        }
        return out;
      },
    };
  }

  /** The event on the calendar: the crowds it sends, the visitors, the mood, and the gate. */
  private eventOn = '';
  private cityEvents(sim: Simulation): void {
    const world = this.renderer.world;
    const ev = world.events;
    const day = this.gameDay();
    if (ev.booked?.venue === -2) ev.relink(this.eventCity(sim));
    const got = ev.update(day, world.budget, world.news);
    if (got?.finished !== undefined) {
      const def = eventById(got.finished.id);
      this.alerts.push({ title: `${def?.name ?? 'Event'}: ${got.finished.crowd.toLocaleString()} came`, tone: 'good', tag: 'event-done',
        body: 'A day the city will talk about for a while: everybody a little happier for a few days.',
        figure: `+${money(got.finished.takings)}` });
    }
    const on = ev.live(day);
    sim.places.event = on !== null && on.venue >= 0 ? { venue: on.venue, share: 0.6, pull: 30 } : null;
    sim.economy.eventVisitors = ev.visitors(day);
    sim.people.civicMood = world.council.mood + ev.mood(day) + (on !== null ? 2 : 0);
    const key = on === null ? '' : `${on.id}@${on.from}`;
    if (key !== this.eventOn) {
      this.eventOn = key;
      if (on !== null) {
        const def = eventById(on.id);
        this.alerts.push({ title: `${def?.name ?? 'Event'} today`, tone: 'good', tag: 'event-on',
          body: `${on.crowd.toLocaleString()} expected ${on.venue < 0 ? 'across the city' : `at ${on.where}`}. Expect the roads in to be busy.`,
          ...(on.venue >= 0 ? { go: () => this.lookAt(on.x, on.z) } : {}) });
      }
    }
  }

  /** Books an event from the computer. Why not, or null. */
  bookEvent(id: string): string | null {
    const sim = this.sim;
    if (sim === null) return 'No city running';
    const world = this.renderer.world;
    return world.events.book(id, this.gameDay(), this.eventCity(sim), world.budget, world.news);
  }

  /** The challenge, if the city was founded with one: ticks, and the end of it. */
  private scenario(sim: Simulation): void {
    const world = this.renderer.world;
    const st = world.scenario;
    const day = this.gameDay();
    this.challenge.update(sim, world, day);
    if (st === null) return;
    const got = checkScenario(st, sim, world, day);
    if (got === null) return;
    const def = scenarioById(st.id);
    const name = def?.name ?? 'Challenge';
    for (const title of got.met) {
      if (got.ended === 'won') break;
      this.alerts.push({ title: `${name}: ${title}`, body: 'One objective met. Keep it while you finish the rest.', tone: 'good', tag: `scenario-met-${title}` });
    }
    if (got.ended === 'won') {
      fanfare();
      const took = Math.max(1, Math.round((day - st.from) / 28 * 12));
      this.alerts.push({ title: `${name} complete`, tone: 'good', tag: 'scenario-end',
        body: `Every objective met, in ${took} month${took === 1 ? '' : 's'}. The city is yours to carry on with.` });
      world.news.print(day, 'city', 'good', `${this.cityName} meets its challenge`, `${def?.blurb ?? ''} Done, with time to spare.`);
    } else if (got.ended === 'lost') {
      this.alerts.push({ title: `${name}: time is up`, tone: 'bad', tag: 'scenario-end',
        body: 'The deadline passed with objectives still open. Carry on in free play, or found a new city to try again.' });
      world.news.print(day, 'city', 'bad', `${this.cityName} misses its deadline`, `${def?.blurb ?? ''} The time ran out.`);
    }
  }

  /** Sets one off now: for the tests, and for a player who wants to see what the defences are worth. */
  forceDisaster(kind: 'storm' | 'flood' | 'quake'): boolean {
    const sim = this.sim;
    if (sim === null) return false;
    const world = this.renderer.world;
    const s = world.disasters.force(kind, this.gameDay(), this.disasterCity(sim), world.policies.effects, world.budget, world.news);
    if (s !== null) this.disasterStruck(s);
    return s !== null;
  }

  /** Storms, floods and earthquakes: forecast, strike, and what the player is told. */
  private disasters(sim: Simulation, dt: number): void {
    const world = this.renderer.world;
    const got = world.disasters.update(this.gameDay(), this.disasterCity(sim), world.policies.effects, world.budget, world.news);
    if (got?.warned !== undefined) this.disasterWarned(got.warned);
    if (got?.struck !== undefined) this.disasterStruck(got.struck);
    // The sky, for a storm or a flood: black and pouring from a few hours
    // before it arrives until a few after, so the forecast can be seen coming.
    // Never over a sky the player has pinned themselves.
    const day = this.gameDay();
    const w = world.disasters.warning, last = world.disasters.history[0];
    const stormy = (w !== null && w.kind !== 'quake' && day >= w.at - 0.3)
      || (last !== undefined && last.kind !== 'quake' && day - last.day < 0.35 && day >= last.day);
    const sky = this.renderer.weather;
    if (stormy && !this.stormHeld && sky.pinned === null) { sky.set(LiveCity.STORM_SKY); this.stormHeld = true; }
    else if (!stormy && this.stormHeld) {
      if (sky.pinned === LiveCity.STORM_SKY) sky.release();
      this.stormHeld = false;
    }
    // The shake: an offset on the camera's focus, taken back off before the
    // next one goes on, so the camera ends where it started.
    if (this.shakeLeft > 0 || this.shakeAt[0] !== 0 || this.shakeAt[1] !== 0) {
      this.camera.focus[0] -= this.shakeAt[0];
      this.camera.focus[2] -= this.shakeAt[1];
      this.shakeLeft = Math.max(0, this.shakeLeft - dt);
      const amp = Math.min(1, this.shakeLeft / 1.5) * Math.min(6, this.camera.distance * 0.012);
      this.shakeAt = this.shakeLeft > 0 ? [(Math.random() - 0.5) * 2 * amp, (Math.random() - 0.5) * 2 * amp] : [0, 0];
      this.camera.focus[0] += this.shakeAt[0];
      this.camera.focus[2] += this.shakeAt[1];
    }
  }

  private disasterWarned(w: Warning): void {
    const flood = w.kind === 'flood';
    this.alerts.push({
      title: flood ? 'Flood warning' : 'Storm warning', tone: 'warn', tag: `disaster-warn-${w.kind}`,
      body: flood
        ? 'The river will break its banks within a day. Buildings on the banks will be damaged: the Flood risk view shows which. Flood defences (a council project) stop most of it.'
        : 'A severe storm crosses the city within a day. Fire cover limits the damage; an emergency plan (a council project) limits it more.',
      go: () => this.lookAt(w.x, w.z),
    });
  }

  private disasterStruck(s: Strike): void {
    const what = s.kind === 'quake' ? `Earthquake, magnitude ${s.magnitude}` : s.kind === 'flood' ? 'Flood' : 'Storm damage';
    this.alerts.push({
      title: what, tone: 'bad', tag: `disaster-${s.kind}-${s.day}`,
      body: s.hit === 0 ? 'No serious damage.'
        : `${s.hit} building${s.hit === 1 ? '' : 's'} damaged${s.ruined > 0 ? `, ${s.ruined} lost` : ''}. Well-served streets recover in days; neglected ones are cleared.`,
      ...(s.bill > 0 ? { figure: `−${money(s.bill)}` } : {}),
      go: () => this.lookAt(s.x, s.z),
    });
    if (s.kind === 'quake') { this.shakeLeft = 2.6; rumble(); }
  }

  /** Brings the camera to a spot on the map, close enough to see what is there. */
  lookAt(x: number, z: number): void {
    this.camera.focus[0] = x;
    this.camera.focus[2] = z;
    this.camera.distance = Math.min(this.camera.distance, 360);
  }

  /**
   * Emergencies: which ones the city is exposed to yet, and what the player
   * is told about the ones that happen.
   *
   * A kind of emergency starts when the service that answers it can be built
   * (fire at level 2, and so on): a city is not handed a problem it has no
   * means to answer. A new one near the camera sounds a siren as the crew
   * leaves; any new one is a card that takes the camera there, and a building
   * lost for want of an answer is a card that says so.
   */
  private emergencies(sim: Simulation): void {
    const level = this.renderer.world.progress.level;
    const d = sim.dispatch;
    // And not in a hamlet. Half the quiet-complaints population (1,000 on
    // Standard) is where a town can carry a fire station's running cost; a
    // house fire in a village of a hundred is a building lost to a service
    // nobody could yet afford.
    const town = sim.people.population >= RULES.quiet * 0.5;
    d.exposed[Need.FIRE] = town && level >= branchLevel('fire');
    d.exposed[Need.CRIME] = town && level >= branchLevel('police');
    d.exposed[Need.MEDICAL] = town && level >= branchLevel('health');
    const words: Record<number, { raised: string; missed: string; answered: string }> = {
      [Need.FIRE]: { raised: 'Fire', missed: 'Building lost to fire', answered: 'Fire under control' },
      [Need.CRIME]: { raised: 'Break-in', missed: 'Burglar got away', answered: 'Suspect arrested' },
      [Need.MEDICAL]: { raised: 'Medical emergency', missed: 'Patient lost', answered: 'Paramedics arrived' },
    };
    const ex = this.camera.focus[0], ez = this.camera.focus[2];
    for (const h of d.takeHappenings()) {
      const w = words[h.kind];
      if (w === undefined) continue;
      const x = sim.places.col.x[h.place], z = sim.places.col.z[h.place];
      const where = sim.inspect(x, z, 6)?.name ?? 'the city';
      const go = (): void => this.lookAt(x, z);
      const icon = h.kind === Need.FIRE ? 'fire' : h.kind === Need.CRIME ? 'police' : 'health';
      if (h.what === 'raised') {
        const dist = Math.hypot(x - ex, z - ez);
        siren(Math.max(0, 1 - dist / 1400), Math.max(-1, Math.min(1, (x - ex) / 600)));
        this.alerts.push({
          title: w.raised, body: `At ${where}.`,
          tone: 'warn', tag: `incident-${h.kind}`, go, icon,
        });
      } else if (h.what === 'missed') {
        this.alerts.push({
          title: w.missed, body: `At ${where} -- nobody got there in time. More `
            + `${h.kind === Need.FIRE ? 'fire stations' : h.kind === Need.CRIME ? 'police' : 'clinics'} would help.`,
          tone: 'bad', tag: `incident-miss-${h.kind}`, go, icon,
        });
      } else if (h.kind === Need.CRIME) {
        this.alerts.push({ title: w.answered, body: `At ${where}.`, tone: 'good',
          tag: `incident-${h.kind}`, go, icon });
      }
    }
  }

  /** Game days since founding, with the fraction of today. */
  private gameDay(): number {
    return this.sim === null ? 0 : this.sim.clock.tick / TICKS_PER_DAY;
  }

  /**
   * The election calendar, stepped every frame so the count on election night
   * runs smoothly; the city is re-read for it once a second.
   */
  private politics(sim: Simulation, dt: number, now: number): void {
    if (this.issues === null || now - this.issuesAt > 1000) {
      this.issues = this.readIssues(sim);
      this.council = this.readCouncil(sim, this.issues);
      this.issuesAt = now;
    }
    const world = this.renderer.world;
    const pol = world.politics;
    const was = pol.phase;
    pol.update(this.gameDay(), dt, this.issues, world.policies, world.budget);
    if (pol.phase !== was) this.politicsMoved(was, pol.phase);
    if (this.council !== null) {
      const wasOpen = world.council.open;
      if (world.council.update(this.gameDay(), this.council, world.policies, world.budget, world.news)) {
        this.councilNotices(wasOpen);
      }
      sim.people.civicMood = world.council.mood;
      this.columnist(this.council);
    }
  }

  /** What the council has done since the last look, as far as it needs saying. */
  private seenPetitions = new Set<string>();
  private seenDivision = '';
  private seenProtest = 0;

  private councilNotices(wasOpen: boolean): void {
    const c = this.renderer.world.council;
    const open = (app: DeskApp) => () => this.computer.show(app);
    if (!wasOpen && c.open) {
      this.alerts.push({
        title: 'The town council sits', icon: 'government', tone: 'good', tag: 'council-open',
        body: `${c.seatCount} councillors, ${c.seats[0]} of them yours. Bills, voters and petitions are on the City Hall computer (P).`,
        go: open('council'),
      });
    }
    for (const p of c.inbox) {
      const key = `${p.id}@${p.day}`;
      if (this.seenPetitions.has(key)) continue;
      this.seenPetitions.add(key);
      const def = petitionById(p.id);
      if (def === undefined) continue;
      this.alerts.push({
        title: `Petition: ${def.title}`, icon: 'post', tone: 'info', tag: `petition-${p.id}`,
        body: `From ${BLOCS.find((b) => b.id === def.from)?.name ?? 'residents'}. Answer it within six days (P, Inbox).`,
        go: open('inbox'),
      });
    }
    const d = c.record[0];
    const key = d === undefined ? '' : `${d.id}@${d.day}`;
    // The first division ever alerts; one already on the record when a save
    // loads does not.
    if (d !== undefined && key !== this.seenDivision && (this.seenDivision !== '' || c.record.length === 1)) {
      const name = billById(d.id)?.name ?? d.id;
      this.alerts.push({
        title: d.passed ? (d.repeal ? 'Law repealed' : 'Bill passed') : 'Bill defeated',
        body: `${d.repeal ? 'Repeal of the ' : 'The '}${name}.`, icon: 'government',
        tone: d.passed ? 'good' : 'bad', tag: 'division', figure: `${d.ayes}–${d.noes}`,
        go: open('council'),
      });
    }
    this.seenDivision = key;
    let mask = 0;
    for (let b = 0; b < c.protesting.length; b++) if (c.protesting[b] === 1) mask |= 1 << b;
    const started = mask & ~this.seenProtest;
    for (let b = 0; b < c.protesting.length; b++) {
      if ((started & (1 << b)) === 0) continue;
      const strike = BLOCS[b].id === 'workers';
      this.alerts.push({
        title: strike ? 'General strike' : `${BLOCS[b].name} protest`, icon: 'alert', tone: 'bad', tag: `protest-${b}`,
        body: strike ? 'Works and shops are short-handed until the workers are won back. See Voters (P).'
          : `Their approval has collapsed. See what they care about in Voters (P).`,
        go: open('voters'),
      });
    }
    this.seenProtest = mask;
    if (c.finished.length > this.seenProjects && this.seenProjects >= 0) {
      const def = projectById(c.finished[c.finished.length - 1]);
      if (def !== undefined) {
        this.alerts.push({ title: `${def.name} completed`, body: def.says.join('. ') + '.', icon: 'develop',
          tone: 'good', tag: 'project', go: open('projects') });
      }
    }
    this.seenProjects = c.finished.length;
  }
  private seenProjects = -1;

  /** What the council reads of the city, refreshed with the voters' issues. */
  private council: CouncilCity | null = null;
  /** The day the paper last ran a column of its own. */
  private columnDay = -1;

  /**
   * The paper's own column, every few days: the thing the city is talking
   * about, which is whichever of its problems is worst -- or, when nothing is
   * wrong, what is going right.
   */
  private columnist(c: CouncilCity): void {
    const day = Math.floor(this.gameDay());
    if (c.population < 150 || day - this.columnDay < 3) return;
    this.columnDay = day;
    const news = this.renderer.world.news;
    const pct = (x: number): string => `${Math.round(x * 100)}%`;
    const worries: Array<[number, NewsDesk, string, string]> = [
      [c.unemployment * 3, 'people', 'Jobless queues lengthen',
        `${pct(c.unemployment)} of those who can work cannot find it. Zone for jobs, or train people for the ones there are.`],
      [(1 - c.flowing) * 1.2, 'transport', 'Commuters fume as traffic crawls',
        `Only ${pct(c.flowing)} of the city's traffic is moving freely. Readers ask for buses, trams and a second way across town.`],
      [c.crime * 8, 'safety', 'Crime worries grow',
        'Residents in several streets say they no longer feel safe after dark. Police cover is thin.'],
      [c.health * 8, 'people', 'Waiting rooms overflow',
        'Clinics are turning patients away. Families ask where the next hospital is.'],
      [c.schooling * 7, 'people', 'Parents demand more school places',
        'Classrooms are full and some children travel across the city to find a desk.'],
      [c.rubbish * 8, 'city', 'Bins go uncollected',
        'Rubbish is piling up on the pavements. More trucks, or a landfill closer in, say residents.'],
      [c.utilities * 10, 'city', 'Taps and sockets run dry',
        'Parts of the city are short of power or water. Businesses say they cannot plan.'],
      [c.net < 0 ? 0.5 : 0, 'economy', 'City spends more than it earns',
        `The treasury is losing ${money(Math.round(-c.net))} a week. Economists warn of cuts or rate rises to come.`],
    ];
    worries.sort((a, b) => b[0] - a[0]);
    const [w, desk, head, body] = worries[0];
    if (w > 0.12) news.print(day, desk, 'bad', head, body, `column-${head}`, 9);
    else if (c.happiness > 0.7) {
      news.print(day, 'people', 'good', 'A city in good spirits',
        `${pct(c.happiness)} of residents say they are happy here. Newcomers keep arriving.`, 'column-happy', 12);
    } else if (c.net > 0) {
      news.print(day, 'economy', 'good', 'Treasury in the black',
        `The city is taking in ${money(Math.round(c.net))} a week more than it spends.`, 'column-net', 12);
    }
  }

  /**
   * A service just placed: the homes round it cheer. The complaint-driven
   * faces only rise from buildings that were already unhappy about that
   * service, so a school opened before anyone asked for one went unmarked --
   * and opening a school is a thing a city is glad of either way.
   */
  serviceCheer(x: number, z: number): void {
    const sim = this.sim;
    if (sim === null) return;
    const homes = sim.places.byPurpose[Purpose.HOME];
    const c = sim.places.col;
    const near: Array<{ x: number; z: number }> = [];
    const R = 520;
    for (let i = 0; i < homes.size; i++) {
      const p = homes.member(i);
      if (sim.places.live[p] === 0 || c.living[p] === 0) continue;
      const dx = c.x[p] - x, dz = c.z[p] - z;
      if (dx * dx + dz * dz < R * R) near.push({ x: c.x[p], z: c.z[p] });
    }
    // Nearest first, so the ripple spreads out from the new building.
    near.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    this.cheers.add(near.slice(0, 40), this.camera, performance.now());
  }

  /** A notice that is news goes in the paper too. */
  private toPaper(a: Alert): void {
    const tag = a.tag ?? '';
    const tone: NewsTone = a.tone === 'good' ? 'good' : a.tone === 'bad' || a.tone === 'warn' ? 'bad' : 'flat';
    let desk: NewsDesk | null = null;
    let key: string | undefined;
    let quiet = 7;
    if (tag.startsWith('util-') || tag === 'condemned' || tag === 'failing' || tag === 'raised') desk = 'city';
    else if (tag === 'treasury' || tag.startsWith('loan-')) desk = 'economy';
    else if (tag.startsWith('hotspot-')) desk = 'transport';
    else if (tag === 'election') desk = 'politics';
    else if (tag.startsWith('incident-miss-')) { desk = 'safety'; key = tag; quiet = 2; }
    else if (tag === '' && (a.title === 'Windfall' || a.title === 'Setback')) desk = 'economy';
    if (desk === null) return;
    this.renderer.world.news.print(this.gameDay(), desk, tone, a.title, a.body, key, quiet);
  }

  private politicsMoved(was: Phase, now: Phase): void {
    const pol = this.renderer.world.politics;
    if (now === 'campaign') {
      this.alerts.push({
        title: pol.elections === 0 ? 'City Hall is open' : 'Election called',
        body: 'Three candidates are standing for mayor, one of them yours. Open the City Hall '
          + 'computer (P) to write your platform before polling day.',
        tone: 'good', tag: 'election', icon: 'government',
      });
    } else if (now === 'count') {
      this.alerts.push({ title: 'Polls have closed', body: 'The count is under way. Watch it on the City Hall computer (P).',
        tone: 'good', tag: 'election', icon: 'government' });
    } else if (now === 'term' && was === 'count' && pol.mayor !== null) {
      const m = pol.mayor;
      if (m.player) {
        // Winning is worth something beyond the mandate: the city's career
        // moves on, and a star is the currency that buys what comes next.
        this.renderer.world.progress.stars += 1;
        this.onProgress?.();
      }
      this.alerts.push({
        title: m.player ? `${m.name} is mayor` : `${m.name} (${m.party}) wins`,
        body: m.player ? 'Your platform is now city policy for the term.'
          : 'Their pledges are now pinned city policy until the next election.',
        tone: m.player ? 'good' : 'bad', tag: 'election', icon: 'government',
        ...(m.player ? { figure: '+1 star' } : {}),
      });
    }
  }

  /** What the voters make of the city. */
  private readIssues(sim: Simulation): Issues {
    const t = sim.complaints.tally;
    let total = 0;
    for (let g = 0; g < t.length; g++) total += t[g];
    total = Math.max(1, total);
    const share = (g: number): number => t[g] / total;
    const r = sim.economy.report;
    const taxed = r.residential + r.commercial + r.industrial + r.office;
    return {
      population: sim.people.population,
      happiness: sim.people.happiness,
      net: r.net,
      resTax: sim.budget.rates[0],
      rubbish: share(Gripe.RUBBISH),
      crime: share(Gripe.CRIME),
      health: share(Gripe.SICK),
      schooling: share(Gripe.SCHOOL) + share(Gripe.UNEDUCATED),
      transport: share(Gripe.NO_TRANSPORT),
      utilities: share(Gripe.POWER) + share(Gripe.WATER) + share(Gripe.SEWAGE),
      trade: share(Gripe.NO_CUSTOMERS),
      industry: taxed > 0 ? r.industrial / taxed : 0,
      flowing: this.renderer.summary.flowing,
      ...(this.renderer.world.council.open ? { approval: this.renderer.world.council.overall } : {}),
    };
  }

  /** The issues, and what else the council's blocs are sized and swayed by. */
  private readCouncil(sim: Simulation, issues: Issues): CouncilCity {
    const people = sim.people, pop = Math.max(1, people.population);
    const staffed = sim.places.staffed;
    const jobs = Math.max(1, staffed[Purpose.SHOP] + staffed[Purpose.OFFICE] + staffed[Purpose.WORKS] + staffed[Purpose.SERVICE]);
    const senior = STAGE_NAMES.findIndex((n) => /senior|retire/i.test(n));
    return {
      ...issues,
      unemployment: people.unemployment,
      seniors: senior >= 0 ? people.byStage[senior] / pop : 0.12,
      students: people.students / pop,
      offices: staffed[Purpose.OFFICE] / jobs,
      comTax: sim.budget.rates[1],
      indTax: sim.budget.rates[2],
    };
  }

  /** The player's candidate holds a rally, paid for out of the treasury. */
  private rally(): boolean {
    const world = this.renderer.world;
    const pol = world.politics;
    const day = this.gameDay();
    if (!pol.canRally(day)) return false;
    if (!world.budget.spend(pol.rallyCost(this.sim?.people.population ?? 0))) return false;
    return pol.rally(day);
  }

  /** Everything the Stats app shows, read from the running simulation. */
  private statsRead(): StatsRead | null {
    const sim = this.sim;
    if (sim === null) return null;
    const world = this.renderer.world;
    const places = sim.places, people = sim.people;
    const staffed = places.staffed;
    const load = sim.routine.load;
    let congested = 0, worst = 0;
    for (let l = 0; l < load.length; l++) {
      if (load[l] > 1) congested++;
      if (load[l] > worst) worst = load[l];
    }
    const ind = world.industry;
    const ha = cellHectares();
    const eco = sim.economy;
    return {
      city: this.cityName,
      ledger: eco.report,
      history: world.history,
      current: world.history.current(eco.report, sim.vitals()),
      balance: world.budget.balance,
      rates: Array.from(world.budget.rates),
      bases: {
        residents: people.population, shopJobs: staffed[Purpose.SHOP],
        worksJobs: staffed[Purpose.WORKS], officeJobs: staffed[Purpose.OFFICE],
      },
      branches: BRANCHES.map((b, i) => ({
        name: BRANCH_STYLE[b].label, colour: BRANCH_STYLE[b].base,
        upkeep: eco.servicesByBranch[i], count: eco.buildingsByBranch[i],
      })),
      buildings: [...eco.upkeepByProto].map(([proto, v]) => {
        const def = ASSETS[proto];
        const style = def?.branch !== undefined ? BRANCH_STYLE[def.branch] : undefined;
        return { name: def?.name ?? 'Building', colour: style?.base ?? '#8a8a8f', count: v.count, total: v.total };
      }),
      people: {
        population: people.population, households: people.households.size,
        employed: people.employed, students: people.students,
        unemployment: people.unemployment, happiness: people.happiness,
        births: people.births, deaths: people.deaths,
        arrived: sim.migration.arrived, departed: sim.migration.departed,
        jobs: places.jobCapacity,
        stages: STAGE_NAMES.map((n, i) => [n, people.byStage[i]] as [string, number]),
        edu: EDU_NAMES.map((n, i) => [n === 'none' ? 'no schooling' : n, people.byEdu[i]] as [string, number]),
      },
      travel: {
        modes: MODE_NAMES.map((n, i) => [n, sim.routine.stats.byMode[i]] as [string, number]),
        meanMinutes: sim.routine.stats.meanMinutes,
        speed: sim.traffic.stats.meanSpeed * 3.6,
        driving: sim.traffic.stats.driving, stopped: sim.traffic.stats.stopped,
        worstLoad: worst, congested, lanes: load.length,
        riders: Math.round(sim.transit.report.ridersPerDay ?? 0),
        crossTown: sim.routine.drawShare(),
      },
      plants: ind.plantReports.map((p) => {
        const info = RESOURCES.find((r) => r.id === p.kind);
        const def = assetById(`spec.plant.${p.kind}`);
        return { name: def?.name ?? p.kind, colour: info?.ramp[1] ?? '#b8841f', taken: p.taken,
          capacity: p.capacity, income: p.income, staffing: p.staffing };
      }),
      industry: ind.hqs.map((h, i) => {
        const rep = ind.reports[i];
        const info = RESOURCES.find((r) => r.id === h.kind);
        return {
          name: `${info?.product ?? h.kind}`, colour: info?.ramp[1] ?? '#b8841f',
          income: rep?.income ?? 0, units: rep?.units ?? 0, shipped: rep?.shipped ?? 0,
          local: rep?.local ?? 0, staffing: rep?.staffing ?? 0,
          hectares: (rep?.cells ?? 0) * ha, remaining: rep?.remaining ?? 1,
        };
      }),
      loans: world.budget.loans.map((l) => ({
        name: LOAN_OFFERS[l.kind]?.name ?? 'Loan', owed: l.owed, payment: l.payment, weeksLeft: l.weeksLeft,
      })),
      offers: LOAN_OFFERS.map((o) => ({ ...o, payment: loanPayment(o.amount, o.annual / 52, o.weeks) })),
      maxLoans: MAX_LOANS,
      borrow: (kind) => {
        const ok = world.budget.borrow(kind);
        if (ok) {
          this.alerts.push({ title: 'Loan taken', body: `${LOAN_OFFERS[kind].name}: ${money(LOAN_OFFERS[kind].amount)} paid into the treasury.`,
            tone: 'info', icon: 'money', tag: `loan-${Date.now()}` });
          this.onProgress?.();
        }
        return ok;
      },
      repay: (i) => {
        const ok = world.budget.repay(i);
        if (ok) this.onProgress?.();
        return ok;
      },
    };
  }

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

  /**
   * What the phone's weather app shows.
   *
   * The sky, and six game hours of it read ahead. The forecast is not a second
   * model: `Weather.ahead` samples the same noise field the sky is drawn from
   * at a later phase, so what the app promises is what arrives.
   *
   * Temperature and wind are derived here rather than simulated, because the
   * model does not hold either and pretending otherwise would be inventing a
   * number and calling it a reading. They are stated functions of what it does
   * hold: a daily swing that a lid of cloud flattens and cools, and a wind that
   * rises with the front. Consistent, legible, and honest about what they are.
   */
  private forecast(): WeatherRead | null {
    const r = this.renderer;
    if (!this.running) return null;
    const w = r.weather;
    const hour = r.timeOfDay * 24;
    // The same temperature the bar shows: one function of the season, the
    // hour and the sky, in sim/weather.ts.
    const at = (h: number, sky: Sky): number => temperature(r.calendarDay, h, sky);
    const outlook: WeatherRead['outlook'] = [];
    for (let h = 1; h <= 6; h++) {
      // An hour of the sun's slow day is several hours of the weather's.
      const sky = skyOf(w.ahead((h / 24) * (CITY_DAY_SECONDS / SECONDS_PER_DAY)));
      outlook.push({
        hour: hour + h, sky, label: labelOf(sky), glyph: glyphOf(sky),
        temp: at(hour + h, sky),
      });
    }
    return {
      now: w.sky, label: w.label, glyph: w.glyph, hour,
      temp: at(hour, w.sky),
      // Still air on a settled day, and a gale at the front of a storm.
      wind: 5 + w.front * 42,
      city: this.cityName,
      outlook,
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
  /** When achievements were last checked. */
  private lastAchieve = 0;

  celebrate(levels: LevelUp[]): void {
    // The card promises the payout "to the treasury", so this is where it goes:
    // every level crossed, however it was earned, passes through here once.
    const budget = this.renderer.world.budget;
    for (const l of levels) {
      budget.credit(l.cash);
      this.levelCard.push(l);
      this.renderer.world.news.print(this.gameDay(), 'city', 'good', `${this.cityName} is now a ${l.name.toLowerCase()}`,
        `The city has reached level ${l.level}. The regional office sent ${money(l.cash)} to mark it.`);
    }
    this.tech.refresh();
    this.onProgress?.();
  }

  /** How many people live in the city, or zero before there is one. */
  get population(): number { return this.sim?.people.population ?? 0; }
  /** How the city feels, 0 to 1, for the score. */
  get happiness(): number { return this.sim?.people.happiness ?? 0.6; }
  get inDebt(): boolean { return this.renderer.world.budget.balance < 0; }

  /** Whether the game is being played, as opposed to sitting on the menu. */
  set playing(on: boolean) {
    this.running = on;
    this.info.visible = on;
    this.bars.visible = on;
    this.thoughts.visible = on;
    this.incidents.visible = on;
    this.alerts.visible = on;
    this.steps.visible = on;
    this.challenge.visible = on;
    this.cititok.visible = on;
    this.computer.visible = on;
    this.wheel.visible = on;
    if (!on) { this.alerts.clear(); this.closeInspect(); }
    if (on && this.sim !== null && !this.founded) {
      this.foundCity(this.sim);
      this.founded = true;
    }
  }

  private reconcile(city: City, net: RoadGraph, roads: boolean, pipes: boolean): void {
    if (this.fresh || this.sim === null) {
      this.fresh = false;
      this.sim = new Simulation(city, net, 0x1b0b0, this.renderer.world);
      this.sim.views.resource = this.resourcePick;
      // Founded in the morning. The clock counts from midnight, and a new
      // city that opens in the dark is a poor first look at it.
      // A loaded city carries on from its own date, so anything dated in days
      // (an election, a term) keeps it.
      const saved = this.renderer.world.clock;
      this.sim.clock.tick = saved > 0 ? saved : Math.round((START_HOUR / 24) * TICKS_PER_DAY);
      this.sim.speed = this.rate;
      this.tax.bind(this.sim.budget);
      this.policies.bind(this.sim.policies);
      const sim = this.sim;
      this.lines.bind(() => ({ transit: this.renderer.world.transit, net: sim.transit }));
      this.uploaded = -1;
      if (this.running && !this.founded) {
        this.foundCity(this.sim);
        this.founded = true;
      }
      log.info('sim', `simulation built over ${city.count.toLocaleString()} buildings`);
      return;
    }
    // Order matters: the lane graph has to exist in its new shape before the
    // places are re-pointed at it, and `roadsChanged` is what rebuilds it.
    if (roads) this.sim.roadsChanged(net, this.renderer.world);
    // A mains edit that moved no road still has to be wired up, or the supply
    // the player just cut off is still flowing.
    else if (pipes) this.sim.mainsChanged();
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
    if (this.cardHq >= 0 && this.inspect.open && now - this.cardAt > 700) {
      this.cardAt = now;
      this.industryCard.paint();
    }
    const sim = this.sim;
    if (sim === null || !this.running) return;

    // The movement budget goes where the player is looking, not to whichever
    // citizens happen to be first in the table.
    sim.look(this.camera.focus[0], this.camera.focus[2]);
    sim.advance(dt, now);
    this.politics(sim, dt, now);
    this.disasters(sim, dt);
    this.cityEvents(sim);

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
    this.plumes.refresh(now);
    this.renderer.setMovers(this.moverRows,
      sim.drawMovers(this.moverRows, Math.round(MOVER_BUDGET * this.moverShare),
        eye[0], eye[2], surfaceAt, this.plumes));

    const view = this.info.view;
    if (view !== View.NONE && !PANEL_ONLY.has(view)) {
      const meta = sim.views.built === view ? this.info.meta(view) : null;
      // Uploaded when the simulation has rebuilt it, which it does on its own
      // schedule -- so an open view is live without the frame asking for one.
      // The service in hand, painted where it would reach: the map says what
      // the city has, and this says what the click would add to it.
      const at = view === this.autoView && this.previewReach !== null ? this.renderer.ghostAt : null;
      const key = at === null ? '' : `${Math.round(at[0] / 8)},${Math.round(at[1] / 8)}`;
      if (meta !== null && (sim.views.version !== this.uploaded || key !== this.previewKey)) {
        this.uploaded = sim.views.version;
        this.previewKey = key;
        const grid = at === null || this.previewReach === null ? sim.viewGrid
          : this.withCatchment(sim.viewGrid, at, this.previewReach);
        this.renderer.setOverlay(grid, meta.look, rampFor(meta.ramp));
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
    //
    // In CSS pixels, which is what the markers are laid out in -- not the
    // camera's viewport, which is the canvas in device pixels at whatever
    // resolution the frame-rate governor has chosen. On a high-density screen,
    // or once the governor turned the resolution down, every marker was
    // scaled towards the top-left corner, away from the building it was for.
    const cw = this.ui.clientWidth || window.innerWidth;
    const ch = this.ui.clientHeight || window.innerHeight;
    this.thoughts.refresh(now, this.camera, cw, ch, sim.complaints.list);
    // And the ones just put right: a face over each, and a cheer.
    this.cheers.add(sim.complaints.takeCheers(), this.camera, now);
    this.cheers.update(now, this.camera, cw, ch);
    this.incidents.refresh(now, this.camera, cw, ch, sim.dispatch.incidents);
    this.districtLabels.refresh(now, this.camera, cw, ch, this.renderer.world.districts);

    // The sliders follow the budget rather than owning it, so a loaded save shows
    // the rates it was saved with.
    if (this.info.view === View.BUDGET) {
      this.tax.refresh();
      this.policies.refresh(this.sim?.economy.report.policies ?? 0);
    }
    if (this.info.view === View.TRANSPORT) this.lines.refresh();

    if (now - this.readoutAt >= READOUT_MS) {
      this.readoutAt = now;
      this.stats.set('citizens', sim.people.population.toLocaleString());
      this.stats.set('when', sim.clock.label);
      // Money, always on screen. A city builder where the balance is two clicks
      // away is a city builder where the player finds out they are bankrupt two
      // clicks late.
      // What a save needs from the running city. See `World.clock`.
      this.renderer.world.clock = sim.clock.tick;
      this.renderer.world.residents = sim.people.population;
      const bal = Math.round(sim.budget.balance);
      const net = Math.round(sim.economy.report.net);
      // The bar reads these rather than counting buildings for itself.
      this.renderer.summary.citizens = sim.people.population;
      this.renderer.summary.net = net;
      this.renderer.summary.hasSim = true;
      const ts = sim.traffic.stats;
      this.renderer.summary.driving = ts.driving;
      this.renderer.summary.kph = ts.meanSpeed * 3.6;
      this.renderer.summary.flowing = ts.driving > 0
        ? 1 - ts.stopped / ts.driving : 1;
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
          title: 'Goal met', body: goal.title, tone: 'good', icon: 'develop',
          figure: `+${goal.xp} xp`, tag: `goal-${goal.id}`,
        });
      }
      // Achievements, on a slower beat: some of them walk every lot.
      if (now - this.lastAchieve > 3000) {
        this.lastAchieve = now;
        for (const got of checkAchievements(sim, this.renderer.world)) {
          this.alerts.push({
            title: 'Achievement unlocked', body: `${got.title} -- ${got.note}`, tone: 'good', icon: 'signature',
            figure: got.tier, tag: `ach-${got.id}`,
          });
        }
      }
      this.announce(sim);
      this.emergencies(sim);
      // An information view counts as read once it has been opened.
      if (this.info.view !== View.NONE) this.viewed = true;
      this.steps.update(sim, now, { world: this.renderer.world, viewed: this.viewed });
      this.scenario(sim);
      // The open card, refreshed on the same beat as everything else: a
      // building whose power has just come back should say so while the player
      // is still looking at it.
      const at = this.selected;
      if (at !== null) {
        const again = sim.inspect(at[0], at[1]);
        if (again === null) this.closeInspect(); else this.inspect.show(again);
      }
    }
    // A building whose condition has moved since it was last drawn. Outside the
    // tick, like everything else that touches the renderer from here.
    const wear = this.sim?.takeWear();
    if (wear !== null && wear !== undefined) this.renderer.refreshCity(wear);
    this.alerts.update(now);
    this.cititok.update(now);
    this.computer.update(now);
    this.wheel.badge(this.renderer.world.council.inbox.length);
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
    this.watchHotspots(sim);
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
    const NAMED: Array<{ u: number; name: string; fix: string; first: string }> = [
      { u: Util.POWER, name: 'Power', fix: 'Build another plant or a wind farm.', first: 'a wind turbine or a small plant' },
      { u: Util.WATER, name: 'Water', fix: 'Add a pumping station on the river.', first: 'a pumping station on the river' },
      { u: Util.SEWAGE, name: 'Sewage', fix: 'Add a treatment works downstream.', first: 'a treatment works downstream' },
    ];
    const homes = sim.places.homeCapacity;
    // A new town usually has none of the three, and three red cards for one
    // situation buried the checklist that already says what to build. So the
    // ones found missing on the same look share a card.
    const missing: typeof NAMED = [];
    for (const n of NAMED) {
      const margin = util.margin[n.u];
      // No supply at all while people are living here. The line below skips a
      // utility the city has not started, which is right for an empty map and
      // wrong the moment there are houses: without this, a new town's homes
      // were condemned for want of power and water and nothing ever said why.
      if (margin <= 0 && homes > 0 && !this.toldShort[n.u]) {
        if (++this.noneRun[n.u] < 4) continue;
        this.toldShort[n.u] = true;
        this.wasShort[n.u] = true;
        missing.push(n);
        continue;
      }
      this.noneRun[n.u] = 0;
      const short = margin < 0.995;
      // A state has to hold for a few looks before it is news. Supply wobbles
      // around the line while a network settles -- on a new city every one of
      // the three used to announce a shortfall and a restoration inside the
      // first second -- and a notice about nothing teaches a player to ignore
      // the one that matters.
      if (short !== this.wasShort[n.u]) {
        this.shortRun[n.u]++;
        if (this.shortRun[n.u] < 4) continue;
      }
      this.shortRun[n.u] = 0;
      if (short === this.wasShort[n.u]) continue;
      this.wasShort[n.u] = short;
      // Nothing to report about a utility the city has not started yet: a town
      // with no pumps is not a town with a water crisis.
      if (margin <= 0) continue;
      // And nothing restored that nobody was told had failed.
      if (!short && !this.toldShort[n.u]) continue;
      this.toldShort[n.u] = short;
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
    if (missing.length > 0) {
      const names = missing.map((n) => n.name.toLowerCase());
      const list = names.length === 1 ? names[0]
        : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
      this.alerts.push({
        title: `No ${list} yet`,
        body: `The homes here will be abandoned within a week without `
          + `${names.length === 1 ? 'it' : 'them'}. Build ${missing.map((n) => n.first).join('; ')}.`,
        tone: 'bad',
        tag: missing.length === 1 ? `util-${missing[0].u}` : 'util-none',
        figure: '0%',
      });
    }

    // What is happening to the buildings themselves. Three notices, and each of
    // them is a change the player can go and look at: a quarter starting to
    // fail, a quarter lost, and a quarter that has grown into something better.
    // They are the visible half of the lifecycle model -- without them a
    // district dies quietly off screen, which is the one way a consequence can
    // be both real and useless.
    const life = sim.life;
    if (life !== undefined) {
      const been = life.drain();
      if (been.condemned > 0) {
        this.alerts.push({
          title: been.condemned === 1 ? 'A plot condemned' : 'Plots condemned',
          body: 'Buildings that ran out of supply and services have been cleared. '
            + 'The empty land drags the street down until the city rebuilds on it.',
          tone: 'bad', tag: 'condemned',
          figure: String(been.condemned),
        });
      } else if (been.failing > 0) {
        this.alerts.push({
          title: 'Buildings failing',
          body: 'Their condition is falling. Open the land value view to see what '
            + 'the quarter is short of, before they are condemned.',
          tone: 'warn', tag: 'failing',
          figure: String(been.failing),
        });
      }
      if (been.raised > 0 && been.condemned === 0) {
        this.alerts.push({
          title: 'The district is growing into it',
          body: 'The land is worth more than it was, so what the city builds there '
            + 'is worth more too.',
          tone: 'good', tag: 'raised',
          figure: `${been.raised} plots`,
        });
      }
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

  /** When the jams round each attraction were last looked for, and which are known. */
  private hotspotAt = 0;
  private readonly jammedAt = new Set<number>();

  /**
   * The roads into a place people travel to, once they cannot cope.
   *
   * This is the traffic game: a stadium or a cathedral pulls a stream of trips
   * across the city, the stream converges on the few roads that reach it, and
   * those back up. The player is told where, and the fix is theirs -- a second
   * way in, a wider road, a one-way loop, a bus line to the door.
   */
  private watchHotspots(sim: Simulation): void {
    const now = performance.now();
    if (now - this.hotspotAt < 15000) return;
    this.hotspotAt = now;
    const places = sim.places, load = sim.routine.load, g = sim.lanes;
    for (const p of [...places.appeal.keys()]) {
      if (places.live[p] === 0) continue;
      const x = places.col.x[p], z = places.col.z[p];
      let worst = 0, sum = 0, n = 0;
      for (let l = 0; l < Math.min(g.count, load.length); l++) {
        if ((g.use[l] & Use.CAR) === 0) continue;
        const dx = (g.ax[l] + g.bx[l]) * 0.5 - x, dz = (g.az[l] + g.bz[l]) * 0.5 - z;
        if (dx * dx + dz * dz > 260 * 260) continue;
        const v = load[l];
        if (v > worst) worst = v;
        sum += v; n++;
      }
      const mean = n === 0 ? 0 : sum / n;
      const jammed = worst > 0.95 && mean > 0.45;
      const was = this.jammedAt.has(p);
      if (jammed === was) continue;
      if (jammed) this.jammedAt.add(p); else this.jammedAt.delete(p);
      const name = ASSETS[places.col.proto[p]]?.name ?? 'the attraction';
      this.alerts.push({
        title: jammed ? `Gridlock at the ${name.toLowerCase()}` : `Traffic moving at the ${name.toLowerCase()}`,
        body: jammed
          ? 'Crowds are converging on it and the roads in cannot take them. Add a second '
            + 'way in, widen the approach, or run a bus line to the door.'
          : 'The roads into it are coping again.',
        tone: jammed ? 'bad' : 'good', icon: 'transport', tag: `hotspot-${p}`,
        figure: `${Math.round(worst * 100)}%`,
        go: () => this.lookAt(x, z),
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
      this.uploaded = this.sim.views.version;
      this.renderer.setOverlay(this.sim.viewGrid, meta.look, rampFor(meta.ramp));
    }
  }
}
