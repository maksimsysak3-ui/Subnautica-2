/**
 * The build tools: drawing roads, painting zones, and clearing ground.
 *
 * The whole of the interaction is one idea repeated. A drag is two cells --
 * where it started and where the cursor is now -- and every tool is a function
 * of those two cells. A road runs between them, a zone paints the rectangle
 * they span, the bulldozer clears it. While the drag is live the same two
 * cells are handed to the renderer as a mark on the ground, so what the player
 * is about to do is drawn before it happens rather than described in a
 * status bar.
 *
 * Committing is a rebuild of the whole city, which at this map size is a
 * fraction of a second. That is fine on release and would not be fine on every
 * pointer move, which is exactly why the preview is a mark on the ground and
 * not a rebuild.
 */

import { RESOURCES, resourceById } from '../sim/resources';
import type { ResourceId } from '../sim/resources';
import { HECTARE_COST, MAX_HECTARES, REACH, cellHectares } from '../sim/industry';
import { MAP } from '../sim/maps';
import { industryProto, modBuildings } from '../sim/inventory';
import { RULES, CURRENCY } from '../sim/difficulty';
import { monthOf, yearOf, seasonOfMonth, temperature } from '../sim/weather';
import { log } from '../util/log';
import { thud, brush, crunch, deny } from './sound';
import type { Renderer } from '../gfx/renderer';
import type { Camera } from '../gfx/camera';
import type { Vec3 } from '../math/m4';
import { heightAt, baseHeightAt, previewRoad } from '../sim';
import { paint, demolish, zoneCode, lotFits, placeLot, ZONES, DENSITIES } from '../sim';
import { nextWing, upgradeLot, wingOfLot, TIER_PRICE } from '../sim/world';
import { PROCESS_CAP, PROCESS_VALUE } from '../sim/industry';
import { DISTRICT_COLOURS, DISTRICT_POLICIES } from '../sim/districts';
import type { DistrictStats } from '../sim/agents/economy';
import type { Lot } from '../sim/world';
import { services, signatures, ASSET_INDEX, stock } from '../sim';
import { assetById } from '../assets/registry';

import type { RoadClass, Proto } from '../sim';
import { ROAD_SPECS, ROAD_ORDER, ELEVATIONS } from '../sim';
import { ZONE_STYLE } from './zones';
import { SKIN, css, key as keyStyle, setKey, tip } from './skin';
import { NODE_OF_ASSET, branchLevel } from '../sim/tech';
import { lockBadge } from './skin';
import { glyph } from './glyphs';
import { glyph as pictogram } from './glyphs';
import { landmarksForLevel } from '../sim/tech';
import type { LevelUp } from '../sim/progress';
import { levelName, DENSITY_LEVEL, LEVEL_NAMES, zoneNeeds } from '../sim/progress';
import { confirm as confirmSound, deny as denySound } from './sound';
import { assetIcon, zoneSpecimen, hasSpecimen } from './icons';
import { modelIconHtml } from './model-view';
import { plotAt, plotSpan, plotBounds, plotCells, PLOTS, ownsAt } from '../sim';
import { OVERDRAFT } from '../sim';
import type { Dirty } from '../sim';
import { ALL_THEMES, THEMES } from '../assets/themes';
import type { Theme } from '../assets/themes';
import { saveFromGame } from './menu';
import { buildingPrice, roadPrice, zonePrice, money } from '../sim';
import { BRANCHES } from '../assets/types';
import { TRANSIT_SPEC, MIN_FLEET, MAX_FLEET } from '../sim';
import type { Branch, Density, Zone } from '../assets/types';
import type { IconZone } from './zones';

/** Metres per zoning cell. */
const CELL = 8;
/** A viaduct's price against the same road on the ground, per metre. */
const VIADUCT_PRICE = 2.5;

// The bar's own palette. Cool slate rather than black, because the bar sits
// over grass and sky all day and a true black panel reads as a hole cut in the
// picture rather than as a thing lying on top of it.
const PANEL = 'rgba(19,26,36,.90)';
const WELL = 'rgba(10,15,22,.62)';
const EDGE = 'rgba(120,160,200,.14)';

/** What a city is called before anyone names it. */
const DEFAULT_NAME = 'Salford';

/**
 * Makes a player's text safe to put in innerHTML.
 *
 * The city's name is typed by a player and then written into markup beside a
 * coloured glyph. Anything a player can type into a field that ends up in
 * innerHTML has to come back out as text, whatever else it looked like.
 */
function escapeText(s: string): string {
  return s.replace(/[&<>"]/g, (c) => (
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'));
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** How each season is shown on the bar. Its climate is in sim/weather.ts. */
const SEASONS = [
  { name: 'Winter', glyph: 'snow', tint: '#8fc7ff' },
  { name: 'Spring', glyph: 'flower', tint: '#8fe0a8' },
  { name: 'Summer', glyph: 'sun', tint: '#ffd166' },
  { name: 'Autumn', glyph: 'leaf', tint: '#e8a35a' },
];

type Tool =
  | { kind: 'look' }
  | { kind: 'road'; cls: RoadClass }
  | { kind: 'curve'; cls: RoadClass }
  | { kind: 'upgrade'; cls: RoadClass }
  /** `theme` undefined means whatever the district around it grows. */
  | { kind: 'zone'; zone: Zone; density: Density; theme?: Theme }
  | { kind: 'place'; proto: Proto }
  | { kind: 'clear' }
  /** Buying land: an overhead view of the plot grid, one click a plot. */
  | { kind: 'transit'; line: number }
  /** Drawing an industry headquarters' harvest area, as a polygon. */
  | { kind: 'area'; hq: number }
  /** Painting a district, or erasing districts with id 0. */
  | { kind: 'district'; id: number }
  | { kind: 'land' };

/** How long after a click its second half still counts as a double-click. */
const DOUBLE = 450;

/** The level industry opens at: a town with some people to work in it. */
const INDUSTRY_LEVEL = 3;

const TOOL_TINT: Record<string, [number, number, number]> = {
  look: [0.6, 0.7, 0.8],
  road: [0.72, 0.76, 0.82],
  curve: [0.72, 0.76, 0.82],
  place: [0.45, 0.86, 0.62],
  clear: [0.95, 0.42, 0.30],
  land: [0.55, 0.86, 1.0],
};

/**
 * What each branch is called on the bar, and the colour it answers to.
 *
 * Eleven branches is too many to tell apart by icon alone at toolbar size, and
 * a colour per branch is what lets the eye go straight to the one it wants --
 * the same job the zone colours already do.
 */
const BRANCH_STYLE: Record<Branch, { label: string; colour: string }> = {
  fire: { label: 'Fire', colour: '#f0704e' },
  police: { label: 'Police', colour: '#5a9cf0' },
  health: { label: 'Health', colour: '#e8637f' },
  education: { label: 'Schools', colour: '#e0b048' },
  water: { label: 'Water', colour: '#3fb9c8' },
  sewage: { label: 'Sewage', colour: '#6f9c56' },
  power: { label: 'Power', colour: '#e5d14a' },
  transport: { label: 'Transport', colour: '#8f7ce8' },
  government: { label: 'Civic', colour: '#c8ccd6' },
  parks: { label: 'Parks', colour: '#63c96a' },
  deathcare: { label: 'Deathcare', colour: '#9aa6b8' },
  post: { label: 'Post', colour: '#d98f5a' },
};

/** The zones a landmark can belong to, in the order their tabs read. */
const SIGNATURE_ZONES = ['residential', 'commercial', 'office', 'industrial'] as const;
/** A zone's tab, or the tab of buildings the enabled mods added. */
type SignatureZone = (typeof SIGNATURE_ZONES)[number] | 'mods';

/** Every one-of-a-kind building, smallest first, across all four zones. */
const SIGNATURES: Proto[] = ZONES
  .flatMap((z) => [...signatures(z)])
  .sort((a, b) => a.w * a.d - b.w * b.d);

const BY_BRANCH = new Map<Branch, Proto[]>();
for (const p of services) {
  const b = p.def.branch;
  if (b === undefined) continue;
  const list = BY_BRANCH.get(b);
  if (list) list.push(p); else BY_BRANCH.set(b, [p]);
}
// Smallest first: a player opening the parks drawer is far more likely to want
// a playground than the ice arena, and the cheap ones being first is the order
// every city builder has settled on.
for (const list of BY_BRANCH.values()) list.sort((a, b) => a.w * a.d - b.w * b.d);

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export class BuildTools {
  private tool: Tool = { kind: 'look' };
  private from: [number, number] | null = null;
  /** Every cell the pointer passed through during a drag, for the curve. */
  private path: Array<[number, number]> = [];
  private to: [number, number] = [0, 0];
  private disposers: Array<() => void> = [];
  private scratch: Vec3 = [0, 0, 0];
  private status: HTMLElement;

  // The curve tool is clicked, not dragged, so it carries its own little state
  // machine: where the run starts, the point it has been told to bend through,
  // and what the last click did -- which is what lets a double-click undo the
  // click that was its own first half.
  private curveA: [number, number] | null = null;
  private curveVia: [number, number] | null = null;
  private curveStage: 'none' | 'start' | 'via' | 'laid' = 'none';

  /**
   * The stops of the line being laid, in metres, x and z interleaved.
   *
   * Empty between lines. It is the whole state of the transit tool: a line is a
   * list of stops, and the routes between them are the simulation's business.
   */
  private stops: number[] = [];
  private curveAt = 0;
  /** Which of the two road tools the class buttons select. */
  private roadMode: 'road' | 'curve' | 'upgrade' = 'road';
  /**
   * How high new road is laid, as an index into ELEVATIONS: nought on the
   * ground. Kept across picks of the road tool, the way a height setting in
   * any builder is -- a player laying a flyover lays several spans of it.
   */
  private elevation = 0;
  /** What a metre of road costs at the height it is being laid. */
  private roadCost(cls: RoadClass): number {
    // A viaduct is a structure: piers, a deck and parapets on top of the road.
    return roadPrice(cls) * (this.elevation > 0 ? VIADUCT_PRICE : 1);
  }
  /** Quarter turns the next placed building is rotated by. */
  private placeYaw = 0;
  /** The open service drawer, if one is open. */
  private drawer: HTMLElement | null = null;
  /** The column the drawer, the status line and the bar stack in. */
  private foot!: HTMLElement;
  private readClock!: HTMLElement;
  private readSeason!: HTMLElement;
  private readPeople!: HTMLElement;
  private readName!: HTMLElement;
  private readWeather!: HTMLElement;
  private name = DEFAULT_NAME;
  private readMoney!: HTMLElement;
  /** The four speed keys, and which one is down. */
  private speedButtons: HTMLElement[] = [];
  /** The unspent-star count on the level dial. */
  private starChip: HTMLElement | null = null;
  /** The level cell in the status row. */
  private readLevel!: HTMLElement;
  /** Republishes the bar's height to the panels that dock above it. */
  private measureFoot: (() => void) | null = null;
  /**
   * Asked what is at a point on the map, in metres, when the player taps it
   * with no tool in hand. Null when the tap landed off the map.
   *
   * The tools know where a click landed and nothing else; only the simulation
   * knows what is standing there. So the click is handed over rather than
   * answered here.
   */
  onInspect: ((at: [number, number] | null) => void) | null = null;
  /** Levels crossed by something the player just built. */
  onLevels: ((levels: LevelUp[]) => void) | null = null;
  /** Something changed about the city's career: repaint whatever shows it. */
  onProgress: (() => void) | null = null;
  /** The player's time control, in multiples of real time. 0 is paused. */
  onSpeed: ((rate: number) => void) | null = null;
  /** The development tree and the settings, which the bar has buttons for. */
  onTech: (() => void) | null = null;
  onSettings: (() => void) | null = null;
  private speed = 1;
  private lastSpeed = 1;
  private ticked = 0;
  private raf = 0;
  /** Which zone the zoning drawer is showing. Remembered between openings. */
  private sigTab: SignatureZone = 'residential';
  private zoneTab: IconZone = 'residential';

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: Camera,
    private renderer: Renderer,
    parent: HTMLElement,
  ) {
    this.status = document.createElement('div');
    // One column pinned to the bottom: the open drawer, the status line, then
    // the bar. Stacked in normal flow rather than each positioned on its own,
    // because the bar wraps to as many rows as the screen needs and anything
    // positioned a fixed distance above it lands on top of it when it does.
    this.foot = document.createElement('div');
    this.foot.style.cssText = [
      'position:absolute', 'left:50%', 'bottom:12px', 'transform:translateX(-50%)',
      'display:flex', 'flex-direction:column', 'align-items:center', 'gap:6px',
      'width:100%', 'z-index:5', 'pointer-events:none',
    ].join(';');
    this.foot.appendChild(this.status);
    this.foot.appendChild(this.buildBar());
    parent.appendChild(this.foot);
    // How tall the bar is, published to the rest of the interface.
    //
    // The bar wraps to as many rows as the screen is narrow, so its height is
    // not a constant anybody can hard-code -- and everything docked to the
    // bottom corners (the demand bars, the view rail) was sitting on top of it
    // at every width where it took a second row. One custom property, measured,
    // and each of those panels reserves it.
    const measure = (): void => {
      const h = this.foot.style.display === 'none' ? 0 : this.foot.offsetHeight;
      document.documentElement.style.setProperty('--hud-foot', `${h + 14}px`);
    };
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(measure).observe(this.foot);
    }
    measure();
    this.measureFoot = measure;
    // Out of sight until the menu lets go. The bar is built at boot so it is
    // ready the instant play starts, and a toolbar sitting behind a main menu
    // is clutter over the one thing the menu is there to show.
    this.visible = false;
    this.styleStatus();

    this.on(canvas, 'pointerdown', this.onDown as EventListener);
    this.on(canvas, 'pointermove', this.onMove as EventListener);
    this.on(canvas, 'pointerup', this.onUp as EventListener);
    this.on(canvas, 'pointercancel', this.onCancel as EventListener);
    this.on(canvas, 'dblclick', this.onDouble as EventListener);
    this.on(window, 'keydown', this.onKey as EventListener);
  }

  /** True while a build tool owns the pointer, so the camera leaves it alone. */
  get active(): boolean {
    return this.shown && this.tool.kind !== 'look';
  }

  private shown = true;

  /** Shows or hides the whole bar, and with it the tools' hold on the pointer. */
  set visible(on: boolean) {
    this.shown = on;
    this.foot.style.display = on ? 'flex' : 'none';
    this.measureFoot?.();
    if (on) return;
    this.closeDrawer();
    this.from = null;
    this.curveA = null;
    this.curveVia = null;
    this.curveStage = 'none';
    if (this.tool.kind === 'land') this.enterLand(false);
    this.tool = { kind: 'look' };
    this.renderer.mark = null;
    this.renderer.setRoadPreview(null);
    this.renderer.setGhost(null);
    this.renderer.building = false;
  }

  /**
   * What the city is called.
   *
   * It used to be a constant, which meant naming a save did not name the city:
   * a player typed "Brighton", reloaded, and was back in Salford with
   * Brighton's roads. The name is part of the city, so it lives here and the
   * save carries it both ways.
   */
  get cityName(): string { return this.name; }

  set cityName(next: string) {
    const clean = next.trim().slice(0, 48);
    this.name = clean === '' ? DEFAULT_NAME : clean;
    this.paintName();
  }

  private paintName(): void {
    fill(this.readName, `<span style="color:${SKIN.good}">\u25c6</span>`
      + `<span style="letter-spacing:.06em">${escapeText(this.name)}</span>`);
  }

  /** Opens the save panel, and takes the name the player types as the city's. */
  save(): void {
    saveFromGame(this.renderer.world, this.name, (t) => this.say(t),
      (named) => { this.cityName = named; });
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    for (const d of this.disposers) d();
    this.disposers = [];
  }

  private on(t: EventTarget, type: string, fn: EventListener,
    opts?: AddEventListenerOptions): void {
    t.addEventListener(type, fn, opts);
    this.disposers.push(() => t.removeEventListener(type, fn, opts));
  }

  // ---- picking ---------------------------------------------------------

  /**
   * The cell under the cursor.
   *
   * The camera's own ray-plane intersection, then two refinements against the
   * heightfield: the first hit is against a plane at the focus height, which
   * is metres out on a hillside, and each refinement moves the plane to the
   * ground it just found. Two is enough at any camera angle the game allows --
   * a third moves the answer by less than a cell.
   */
  private pick(clientX: number, clientY: number): [number, number] | null {
    const r = this.canvas.getBoundingClientRect();
    const nx = ((clientX - r.left) / Math.max(r.width, 1)) * 2 - 1;
    const ny = 1 - ((clientY - r.top) / Math.max(r.height, 1)) * 2;
    const hit = this.camera.groundPointAt(nx, ny);
    if (!hit) return null;
    for (let i = 0; i < 2; i++) {
      const y = heightAt(hit[0], hit[2]);
      const next = this.camera.groundPointAt(nx, ny, this.scratch, y);
      if (!next) break;
      hit[0] = next[0]; hit[2] = next[2];
    }
    const half = this.renderer.world.grid / 2;
    const gx = Math.floor(hit[0] / CELL + half);
    const gz = Math.floor(hit[2] / CELL + half);
    if (gx < 0 || gz < 0 || gx >= this.renderer.world.grid || gz >= this.renderer.world.grid) {
      return null;
    }
    return [gx, gz];
  }

  // ---- pointer ---------------------------------------------------------

  /**
   * Where a click with no tool in hand began, and when.
   *
   * With the look tool up the pointer belongs to the camera, so a click on a
   * building has to be told apart from the start of a pan: same button, same
   * place, and the only difference is whether it moved. A few pixels and a
   * third of a second is the threshold every map in the world uses.
   */
  private tapAt: [number, number, number] | null = null;

  private onDown = (e: PointerEvent): void => {
    if (this.shown && !this.active && e.button === 0) {
      this.tapAt = [e.clientX, e.clientY, performance.now()];
    }
    if (!this.active || e.button !== 0) return;
    // A move recorded before the button went down describes the state before
    // this gesture; letting it land afterwards would push a pre-drag cell into
    // the path the curve is measured from.
    this.movedTo = null;
    const cell = this.pick(e.clientX, e.clientY);
    if (!cell) return;
    e.stopPropagation();
    if (this.tool.kind === 'land') { this.buyLand(cell); return; }
    if (this.tool.kind === 'curve') { this.curveClick(cell); return; }
    if (this.tool.kind === 'transit') { this.transitClick(cell); return; }
    if (this.tool.kind === 'area') { this.areaClick(cell); return; }
    if (this.tool.kind === 'place') { this.dropLot(cell); return; }
    this.from = cell;
    this.to = cell;
    this.path = [cell];
    this.showMark();
  };

  /**
   * The pointer moved. Records where, and does the work once a frame.
   *
   * A mouse reports at its own rate, which is a hundred and twenty-five times
   * a second on the cheapest one and a thousand on a gaming one -- several to
   * a dozen reports per rendered frame. Every one of them was raycasting into
   * the terrain and then rebuilding the whole previewed road, or refitting a
   * building and re-surveying its four corners. All but the last were thrown
   * away by the next report before anything drew them, so the cost bought
   * nothing at all: it just made the frame that happened to contain eight of
   * them take eight times as long as its neighbours, which is precisely the
   * stutter a player feels while dragging a road out.
   *
   * So the handler now does the two things that have to happen synchronously
   * -- taking the event away from the camera, and remembering the position --
   * and everything else runs once, on the next frame, from the last position
   * seen. The pointer is sampled at the frame rate because the frame rate is
   * the rate at which anything can be shown.
   */
  private onMove = (e: PointerEvent): void => {
    if (!this.active) return;
    // Held back from the camera here rather than in the deferred half: by the
    // time a frame callback runs, the camera has already panned.
    if (this.from) e.stopPropagation();
    this.movedTo = [e.clientX, e.clientY];
    if (this.moveQueued) return;
    this.moveQueued = true;
    requestAnimationFrame(this.applyMove);
  };

  /** Where the pointer last was, in client pixels, or null if it has not moved. */
  private movedTo: [number, number] | null = null;
  private moveQueued = false;

  /**
   * Runs a pending move now.
   *
   * A button going down or up has to act on where the pointer *is*, not on
   * where it was when the last frame drew: a drag quick enough to start and
   * finish inside one frame would otherwise commit from a stale position, or
   * from no position at all, and lay nothing.
   */
  private flushMove(): void {
    if (this.movedTo !== null) this.applyMove();
  }

  private applyMove = (): void => {
    this.moveQueued = false;
    const at = this.movedTo;
    this.movedTo = null;
    if (at === null || !this.active) return;
    const cell = this.pick(at[0], at[1]);
    if (!cell) return;
    this.to = cell;
    if (this.tool.kind === 'land') { this.hoverLand(cell); return; }
    if (this.from) {
      const last = this.path[this.path.length - 1];
      if (last === undefined || last[0] !== cell[0] || last[1] !== cell[1]) {
        this.path.push(cell);
        if (this.path.length > 512) this.path.shift();
      }
    }
    this.showMark();
  };

  /**
   * How far the drag bowed away from a straight line, in metres.
   *
   * This is the whole of the curve tool. A player who wants a straight road
   * drags in a straight line and gets one; a player who sweeps the pointer
   * round a corner gets a road that follows the sweep. There is no mode to
   * enter and no modifier to hold, and the shape you drew is the shape you
   * get -- which is the only part of a curve tool anyone actually wants.
   *
   * The measure is the signed area between the drag's path and its chord,
   * divided by the chord: the mean offset, which is exactly what a quadratic's
   * control point wants scaled by two.
   */
  private bend(): number {
    if (this.path.length < 3 || this.from === null) return 0;
    const a = this.path[0], b = this.path[this.path.length - 1];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < 2) return 0;
    // Left of the direction of travel is positive, matching RoadGraph.add.
    const nx = -dz / len, nz = dx / len;
    let sum = 0;
    for (const p of this.path) sum += (p[0] - a[0]) * nx + (p[1] - a[1]) * nz;
    const mean = sum / this.path.length;
    // Twice the mean offset puts the control point where the curve passes
    // through the path; below a cell of bow it is a straight, because nobody
    // drags in a perfectly straight line and a road that wobbles is worse
    // than one that does not curve.
    return Math.abs(mean) < 0.9 ? 0 : mean * 2 * CELL;
  }

  private onUp = (e: PointerEvent): void => {
    // A tap on the map with no tool in hand asks what is there.
    const tap = this.tapAt;
    this.tapAt = null;
    if (tap !== null && this.onInspect !== null && !this.active) {
      const moved = Math.hypot(e.clientX - tap[0], e.clientY - tap[1]);
      if (moved < 5 && performance.now() - tap[2] < 400) {
        const cell = this.pick(e.clientX, e.clientY);
        const half = this.renderer.world.grid / 2;
        this.onInspect(cell === null ? null
          : [(cell[0] - half + 0.5) * CELL, (cell[1] - half + 0.5) * CELL]);
      }
    }
    this.flushMove();
    if (this.tool.kind === 'curve' || this.tool.kind === 'place'
      || this.tool.kind === 'land') return;
    if (!this.from) return;
    e.stopPropagation();
    const from = this.from;
    this.from = null;
    this.renderer.setRoadPreview(null);
    this.commit(from, this.to);
    this.showMark();
  };

  private onCancel = (): void => {
    this.movedTo = null;
    this.from = null;
    this.renderer.mark = null;
    this.renderer.setRoadPreview(null);
  };

  private onKey = (e: KeyboardEvent): void => {
    // Time, from the keyboard. Space is the pause every game uses; the number
    // row picks a speed outright. Neither fires while something is being typed
    // into -- the save panel takes a city name, and a space in it is a space.
    const typing = (e.target as HTMLElement | null)?.tagName === 'INPUT';
    if (!typing && e.key === ' ' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      this.togglePause();
      return;
    }
    if (!typing && e.key >= '1' && e.key <= '4' && !e.ctrlKey && !e.metaKey) {
      this.setSpeed(Number(e.key) - 1);
      return;
    }
    // The two panels that are not tools: what the city can learn, and how the
    // game is set up.
    if (!typing && (e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey) {
      this.onTech?.();
      return;
    }
    if (!typing && (e.key === 'o' || e.key === 'O') && !e.ctrlKey && !e.metaKey) {
      this.onSettings?.();
      return;
    }
    // Ctrl+S, because that is the key everyone already presses and the browser
    // otherwise answers it by offering to save the page's HTML.
    if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (this.shown) this.save();
      return;
    }
    // Rotate what is about to be placed. A footprint is rarely square and the
    // whole reason a lot refuses to fit is usually that it is the wrong way
    // round, so this is the first thing a player reaches for.
    if ((e.key === 'r' || e.key === 'R') && this.tool.kind === 'place') {
      this.placeYaw = (this.placeYaw + 1) % 4;
      this.showMark();
      this.say(this.describe(this.tool));
      return;
    }
    // Enter finishes the line. Clicking the first stop again does the same, and
    // both exist because a loop that closes on itself is the common case and a
    // loop whose first stop is under a building is not clickable.
    if ((e.key === 'Backspace' || e.key === 'Delete') && this.tool.kind === 'transit'
      && this.stops.length > 0) {
      e.preventDefault();
      this.stops.length -= 2;
      this.showMark();
      this.say(this.stops.length === 0 ? 'back to the start'
        : `${this.stops.length / 2} stops`);
      return;
    }
    if (this.tool.kind === 'area') {
      if ((e.key === 'Backspace' || e.key === 'Delete') && this.areaPts.length > 0) {
        e.preventDefault();
        this.areaPts.length -= 2;
        this.showMark();
        return;
      }
      if (e.key === 'Enter' && this.areaPts.length >= 6) {
        e.preventDefault();
        this.closeArea();
        return;
      }
      if (e.key === 'Escape' && this.areaPts.length > 0) {
        e.preventDefault();
        this.areaPts = [];
        this.showMark();
        this.say('area abandoned — click to start again, or Escape to put the tool away');
        return;
      }
    }
    if (this.lineKey(e)) { e.preventDefault(); return; }
    // Page Up and Page Down raise and lower the road being laid.
    if ((e.key === 'PageUp' || e.key === 'PageDown')
      && (this.tool.kind === 'road' || this.tool.kind === 'curve')) {
      e.preventDefault();
      this.setElevation(this.elevation + (e.key === 'PageUp' ? 1 : -1));
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && this.tool.kind === 'transit'
      && this.stops.length >= 4) {
      e.preventDefault();
      this.closeLine();
      return;
    }
    if (e.key !== 'Escape') return;
    if (this.drawer !== null) { this.closeDrawer(); return; }
    // A half-drawn road first, then the tool. Escape while dragging one has to
    // stop the road before it stops anything else, or the one thing a player
    // presses it for is the one thing it will not do.
    if (this.from !== null) {
      this.from = null;
      this.renderer.setRoadPreview(null);
      this.showMark();
      this.say('cancelled');
      return;
    }
    // The first Escape drops a half-drawn run, the second puts the tool away.
    // Losing the tool as well would mean re-selecting it after every misclick.
    if (this.curveStage !== 'none') { this.endRun(); return; }
    if (this.stops.length > 0) { this.dropLine(); return; }
    this.from = null;
    this.select({ kind: 'look' });
  };

  // ---- the transit tool ------------------------------------------------

  /**
   * One click of a transit line.
   *
   * Each click is a stop. The first click on an existing line's stop, with
   * nothing being drawn, picks that line up instead -- which is how a player
   * deletes one or puts another bus on it, and is the only thing a click on an
   * existing stop could sensibly mean.
   *
   * Stops snap to the nearest road, because a stop is a place a bus pulls in at
   * and a bus cannot pull in where there is no road. A click in a field says so
   * rather than silently placing a stop nothing will ever serve.
   */
  private transitClick(cell: [number, number]): void {
    const t = this.tool;
    if (t.kind !== 'transit') return;
    const world = this.renderer.world;
    const half = world.grid / 2;
    const x = (cell[0] - half + 0.5) * CELL, z = (cell[1] - half + 0.5) * CELL;

    if (this.stops.length === 0) {
      const hit = world.transit.nearest(x, z, 70);
      if (hit !== null) { this.pickLine(hit.line.id); return; }
    }

    // Closing the loop: clicking the first stop again, near enough.
    if (this.stops.length >= 4) {
      const dx = this.stops[0] - x, dz = this.stops[1] - z;
      if (dx * dx + dz * dz < 60 * 60) { this.closeLine(); return; }
    }

    const on = this.snapToRoad(cell);
    if (on === null) {
      this.say('a stop has to be on a road — click a street');
      return;
    }
    this.stops.push(on[0], on[1]);
    this.renderer.setTransitDraft(Float32Array.from(this.stops),
      TRANSIT_SPEC[t.line].colour);
    const n = this.stops.length / 2;
    this.say(n < 2
      ? `${TRANSIT_SPEC[t.line].name} stop 1 — click along the route, Enter to finish`
      : `${n} stops — Enter to finish the loop, Escape to start again`);
  }

  /** The centre of the nearest road cell to a click, in metres, or null. */
  private snapToRoad(cell: [number, number]): [number, number] | null {
    const world = this.renderer.world;
    const half = world.grid / 2;
    // Outwards a ring at a time, so the nearest road wins rather than whichever
    // the scan reached first.
    for (let r = 0; r <= 4; r++) {
      let best: [number, number] | null = null;
      let bestD = Infinity;
      for (let j = -r; j <= r; j++) {
        for (let i = -r; i <= r; i++) {
          if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
          const gx = cell[0] + i, gz = cell[1] + j;
          if (gx < 0 || gz < 0 || gx >= world.grid || gz >= world.grid) continue;
          if (!world.net.has(gx, gz)) continue;
          const d = i * i + j * j;
          if (d < bestD) { bestD = d; best = [gx, gz]; }
        }
      }
      if (best !== null) {
        return [(best[0] - half + 0.5) * CELL, (best[1] - half + 0.5) * CELL];
      }
    }
    return null;
  }

  /** Turns the stops being drawn into a line. */
  private closeLine(): void {
    const t = this.tool;
    if (t.kind !== 'transit' || this.stops.length < 4) return;
    // A line costs its stops: shelters, poles and, for a tram, the rails under
    // them. The fleet is a standing order rather than a purchase -- it turns up
    // every week on the budget, which is where a service belongs.
    const spec = TRANSIT_SPEC[t.line];
    const cost = (this.stops.length / 2) * (t.line === 0 ? 2600 : 14000) * RULES.build;
    if (!this.afford(cost, `a ${spec.name.toLowerCase()} line`)) return;
    const line = this.renderer.world.transit.add(t.line, this.stops);
    this.stops = [];
    this.renderer.setTransitDraft(null);
    if (line === null) { this.say('a line needs at least two stops'); return; }
    this.say(`${TRANSIT_SPEC[t.line].name} line ${line.id} laid — `
      + `${line.stops.length / 2} stops, ${line.fleet} vehicles, `
      + `${money(TRANSIT_SPEC[t.line].weekly * line.fleet)} a week to run. `
      + 'The transport view lists every line.');
  }

  /** Throws away the line being drawn. */
  private dropLine(): void {
    this.stops = [];
    this.renderer.setTransitDraft(null);
    this.say('line abandoned');
  }

  /**
   * A click on an existing line's stop.
   *
   * The fleet and the bin, which are the only two things there are to do to a
   * line once it exists. Driven from the status line rather than from a panel of
   * its own: the answer is one number and one button, and a modal for that is
   * more interface than the thing it is about.
   */
  private pickLine(id: number): void {
    const world = this.renderer.world;
    const line = world.transit.lines.find((l) => l.id === id);
    if (line === undefined) return;
    this.heldLine = id;
    const spec = TRANSIT_SPEC[line.kind];
    this.say(`${spec.name} line ${id}: ${line.stops.length / 2} stops, `
      + `${line.fleet} vehicles — [ and ] change the fleet. `
      + 'The transport view lists every line, with buttons.');
  }

  /** The line the player last clicked a stop of, for the keyboard shortcuts. */
  private heldLine = -1;

  /** Sets the height new road is laid at, and says so. */
  private setElevation(i: number): void {
    this.elevation = Math.max(0, Math.min(ELEVATIONS.length - 1, i));
    const m = ELEVATIONS[this.elevation];
    this.say(m === 0 ? 'laying road on the ground'
      : `laying a viaduct ${m} m up — Page Up / Page Down to change. `
        + 'Start it on a street to ramp up from it; cross a road to pass over it.');
  }

  /** `[`, `]` and Delete, while a line is picked up. */
  private lineKey(e: KeyboardEvent): boolean {
    if (this.tool.kind !== 'transit' || this.heldLine < 0) return false;
    const world = this.renderer.world;
    const line = world.transit.lines.find((l) => l.id === this.heldLine);
    if (line === undefined) { this.heldLine = -1; return false; }
    const spec = TRANSIT_SPEC[line.kind];
    if (e.key === '[' || e.key === ']') {
      const want = line.fleet + (e.key === ']' ? 1 : -1);
      world.transit.setFleet(line.id, want);
      this.say(`${spec.name} line ${line.id}: ${line.fleet} vehicles `
        + `(${MIN_FLEET}–${MAX_FLEET})`);
      return true;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      world.transit.remove(line.id);
      this.heldLine = -1;
      this.say(`${spec.name} line ${line.id} removed`);
      return true;
    }
    return false;
  }

  // ---- the curve tool --------------------------------------------------

  /**
   * One click of a curved run.
   *
   * Three clicks lay a segment: where it starts, a point it must pass through,
   * and where it ends. The middle click is the whole tool -- the player points
   * at where they want the road to bow and the road bows there, with no
   * control points and no handles to drag.
   *
   * The end of a segment is the start of the next one, so a run of connected
   * roads is a run of clicks. That is not a convenience: a road laid as a
   * separate stroke that merely finishes near the last one leaves two nodes a
   * few metres apart and a visible break, and chaining is what stops that
   * happening by accident.
   */
  /** Starts drawing a headquarters' area, from its card. */
  drawArea(hq: number): void {
    this.visible = true;
    this.select({ kind: 'area', hq });
  }

  /** The points of the area being drawn: x, z, x, z ... in metres. */
  private areaPts: number[] = [];

  private cellMetres(cell: [number, number]): [number, number] {
    const half = this.renderer.world.grid / 2;
    return [(cell[0] - half + 0.5) * CELL, (cell[1] - half + 0.5) * CELL];
  }

  private areaClick(cell: [number, number]): void {
    const t = this.tool;
    if (t.kind !== 'area') return;
    const world = this.renderer.world;
    const h = world.industry.hqs[t.hq];
    if (h === undefined) { this.select({ kind: 'look' }); return; }
    const [x, z] = this.cellMetres(cell);
    // Closing the shape: a click back on the first point.
    if (this.areaPts.length >= 6) {
      const dx = this.areaPts[0] - x, dz = this.areaPts[1] - z;
      if (dx * dx + dz * dz < 36 * 36) { this.closeArea(); return; }
    }
    const [cx, cz] = world.industry.centre(h, world.grid);
    if (Math.hypot(x - cx, z - cz) > REACH) {
      denySound();
      this.say(`too far — an area has to stay within ${REACH} m of its headquarters`);
      return;
    }
    this.areaPts.push(x, z);
    this.showMark();
  }

  /** Finishes the area being drawn: checks it, charges for it and hands it over. */
  private closeArea(): void {
    const t = this.tool;
    if (t.kind !== 'area' || this.areaPts.length < 6) return;
    const world = this.renderer.world;
    const ind = world.industry;
    const h = ind.hqs[t.hq];
    if (h === undefined) return;
    const ha = ind.raster(this.areaPts, h.kind).length * cellHectares();
    const what = resourceById(h.kind);
    if (ha < 0.8) {
      denySound();
      this.say(h.kind === 'fish' ? 'a fishing ground has to be drawn over water'
        : `that area is too small — draw round more ${what.name.toLowerCase()}`);
      return;
    }
    if (ha > MAX_HECTARES) {
      denySound();
      this.say(`that area is ${ha.toFixed(0)} ha — the most one headquarters can work is ${MAX_HECTARES} ha`);
      return;
    }
    const cost = Math.round(ha * HECTARE_COST * RULES.build);
    if (!this.afford(cost, 'the harvest area')) return;
    const was = h.area;
    ind.setArea(t.hq, this.areaPts.slice());
    this.areaPts = [];
    this.renderer.setWorkedDraft(null, '');
    this.renderer.setTransitDraft(null);
    // Rebuild what the old area and the new one cover, together.
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const poly of [was, h.area]) {
      for (let k = 0; k + 1 < poly.length; k += 2) {
        x0 = Math.min(x0, poly[k]); x1 = Math.max(x1, poly[k]);
        z0 = Math.min(z0, poly[k + 1]); z1 = Math.max(z1, poly[k + 1]);
      }
    }
    const half = world.grid / 2;
    const gx = Math.floor(x0 / CELL + half) - 4, gz = Math.floor(z0 / CELL + half) - 4;
    this.rebuild({ gx, gz, w: Math.ceil((x1 - x0) / CELL) + 8, d: Math.ceil((z1 - z0) / CELL) + 8 });
    confirmSound();
    this.select({ kind: 'look' });
    this.say(`${what.product.toLowerCase()} area drawn — ${ha.toFixed(1)} ha. Staff the headquarters `
      + 'and it starts to produce; click it to see what it makes and where it goes.');
    this.onProgress?.();
  }

  /** The industry drawer: one headquarters per natural resource. */
  private openIndustryDrawer(): void {
    const accent = '#e0a24a';
    const panel = this.drawerPanel('industry', accent);
    panel.style.gridTemplateColumns = 'repeat(auto-fill,minmax(150px,1fr))';
    const rich = MAP.richness;
    for (const r of RESOURCES) {
      const p = industryProto(`spec.hq.${r.id}`);
      if (p === undefined) continue;
      const on = rich[r.id];
      const here = on >= 1.6 ? 'plentiful here' : on >= 1 ? 'good here' : on > 0.3 ? 'some here' : on > 0 ? 'scarce here' : 'none on this map';
      panel.appendChild(this.tile(p.id, p.def.name.replace(' headquarters', ''), here,
        buildingPrice(p.def), r.ramp[2],
        `${r.product}: ${r.blurb} Place the headquarters, then draw the area it works.`,
        () => this.select({ kind: 'place', proto: p })));
    }
    // The second link: plants that turn what the headquarters supply the city
    // into goods worth more than twice as much.
    const head = document.createElement('div');
    head.className = 'mr-section-label';
    head.style.gridColumn = '1 / -1';
    head.textContent = 'Processing — worth 2.2× the raw material';
    panel.appendChild(head);
    const hqs = this.renderer.world.industry.hqs;
    for (const r of RESOURCES) {
      const p = industryProto(`spec.plant.${r.id}`);
      if (p === undefined) continue;
      const fed = hqs.some((h) => h.kind === r.id);
      const hq = (industryProto(`spec.hq.${r.id}`)?.def.name ?? r.name).replace(' headquarters', '').toLowerCase();
      panel.appendChild(this.tile(p.id, p.def.name, fed ? `takes ${r.product.toLowerCase()}` : `needs ${/^[aeiou]/.test(hq) ? 'an' : 'a'} ${hq} HQ`,
        buildingPrice(p.def), r.ramp[2],
        `Turns up to ${PROCESS_CAP} units of ${r.product.toLowerCase()} a week into goods worth ${PROCESS_VALUE}× the export price. `
          + 'It takes what a headquarters of its kind supplies the city, so set that headquarters to supply rather than ship.',
        () => this.select({ kind: 'place', proto: p })));
    }
    this.mount(panel, 'industry');
  }

  /** Told when districts change or one is picked, so the map can show it. */
  onDistricts: ((focus: number) => void) | null = null;
  /** Asked for a district's figures from the last settle. */
  districtStats: ((id: number) => DistrictStats | undefined) | null = null;

  /**
   * The districts drawer: a new district, an eraser, and a card for each
   * district with its figures and its policy switches.
   */
  openDistrictDrawer(): void {
    const accent = '#e0a24a';
    const panel = this.drawerPanel('districts', accent);
    panel.style.gridTemplateColumns = 'repeat(auto-fill,minmax(250px,1fr))';
    const D = this.renderer.world.districts;
    const head = document.createElement('div');
    head.className = 'mr-dist-head';
    const make = document.createElement('button');
    make.className = 'mr-dist-new';
    make.textContent = 'New district';
    make.addEventListener('click', () => {
      const d = D.add();
      if (d === null) return;
      this.select({ kind: 'district', id: d.id });
      this.onDistricts?.(d.id);
    });
    const erase = document.createElement('button');
    erase.className = 'mr-dist-erase';
    erase.textContent = 'Erase';
    erase.addEventListener('click', () => this.select({ kind: 'district', id: 0 }));
    const note = document.createElement('span');
    note.className = 'mr-dist-note';
    note.textContent = D.list.length === 0
      ? 'Paint a district, then give it policies. Each is a trade: better takings for a weekly fee per building.'
      : `${D.list.length} district${D.list.length === 1 ? '' : 's'} — click one to paint more of it`;
    head.append(make, erase, note);
    head.style.gridColumn = '1 / -1';
    panel.appendChild(head);
    for (const d of D.list) {
      const colour = DISTRICT_COLOURS[d.colour % DISTRICT_COLOURS.length];
      const card = document.createElement('div');
      card.className = 'mr-dist';
      card.style.setProperty('--tone', colour);
      const title = document.createElement('div');
      title.className = 'mr-dist-title';
      const sw = document.createElement('span');
      sw.className = 'mr-dist-sw';
      const name = document.createElement('input');
      name.className = 'mr-dist-name';
      name.value = d.name;
      name.maxLength = 32;
      name.setAttribute('aria-label', 'District name');
      name.addEventListener('change', () => { D.rename(d.id, name.value); this.onDistricts?.(d.id); });
      name.addEventListener('keydown', (e) => e.stopPropagation());
      const paint = document.createElement('button');
      paint.className = 'mr-dist-paint';
      paint.textContent = 'Paint';
      paint.addEventListener('click', () => { this.select({ kind: 'district', id: d.id }); this.onDistricts?.(d.id); });
      title.append(sw, name, paint);
      const st = this.districtStats?.(d.id);
      const facts = document.createElement('div');
      facts.className = 'mr-dist-facts';
      facts.textContent = st === undefined ? 'Nothing built in it yet'
        : `${st.buildings} buildings · ${st.households} households · ${st.jobs} jobs`
          + (st.cost > 0 ? ` · policies ${money(Math.round(st.cost))}/wk` : '');
      const chips = document.createElement('div');
      chips.className = 'mr-dist-chips';
      for (const p of DISTRICT_POLICIES) {
        const c = document.createElement('button');
        c.className = 'mr-dist-chip';
        const on = d.policies.includes(p.id);
        c.classList.toggle('is-on', on);
        c.setAttribute('aria-pressed', String(on));
        c.textContent = p.name;
        tip(c, `${p.blurb}${p.perBuilding > 0 ? ` Costs ${money(p.perBuilding * CURRENCY)} a week per building.` : ''}`);
        c.addEventListener('click', () => {
          D.toggle(d.id, p.id);
          this.onDistricts?.(d.id);
          this.openDistrictDrawer();
        });
        chips.appendChild(c);
      }
      card.append(title, facts, chips);
      panel.appendChild(card);
    }
    this.mount(panel, 'districts');
  }

  private curveClick(cell: [number, number]): void {
    this.curveAt = performance.now();
    if (this.curveA === null) {
      this.curveA = cell;
      this.curveVia = null;
      this.curveStage = 'start';
      this.say('click where it should bend, then where it ends — double-click to finish');
    } else if (this.curveVia === null) {
      this.curveVia = cell;
      this.curveStage = 'via';
      this.say('click where it ends — double-click to finish');
    } else if (this.lay(this.curveA, cell, this.curveVia)) {
      this.curveA = cell;
      this.curveVia = null;
      this.curveStage = 'laid';
    } else {
      this.say('too short to be a road — click further away');
      return;
    }
    this.showMark();
  }

  /**
   * A double-click ends the run, laying whatever is still pending.
   *
   * The first half of a double-click has already been through `curveClick`, so
   * this has to undo it: after a `via` click the player meant a straight to
   * there, and after a segment was laid they meant nothing more at all.
   */
  private onDouble = (e: MouseEvent): void => {
    if (this.tool.kind !== 'curve') return;
    e.preventDefault();
    e.stopPropagation();
    const fresh = performance.now() - this.curveAt < DOUBLE;
    const cell = this.pick(e.clientX, e.clientY);
    if (fresh && this.curveStage === 'via' && this.curveA !== null && this.curveVia !== null) {
      this.lay(this.curveA, this.curveVia, null);
    } else if (!fresh && cell !== null && this.curveA !== null) {
      this.lay(this.curveA, cell, this.curveVia);
    }
    this.endRun();
  };

  private endRun(): void {
    this.curveA = null;
    this.curveVia = null;
    this.curveStage = 'none';
    this.renderer.setRoadPreview(null);
    this.renderer.mark = null;
    this.say(this.describe(this.tool));
  }

  // ---- placing one building -------------------------------------------

  /**
   * Puts the selected building down, centred on the cursor.
   *
   * Centred, not cornered: the player is pointing at where they want the
   * building, and a lot that grows away to the south-east of the pointer
   * cannot be placed against anything by eye.
   */
  // ---- land -----------------------------------------------------------

  /** The camera as it was before the land tool lifted it, to put it back. */
  private beforeLand: { distance: number; pitch: number } | null = null;

  /**
   * Lifts the camera to where the whole map is legible, and puts it back after.
   *
   * The plot grid is six hundred metres a side. From the height a player builds
   * at, one plot fills the screen and the grid is a line in the middle
   * distance; the decision the tool exists for -- which way should the city
   * grow -- cannot be made from there. So the tool takes the camera up, and
   * gives it back exactly where it was, because a tool that leaves you
   * somewhere else is a tool you stop using.
   */
  private enterLand(on: boolean): void {
    const cam = this.camera;
    if (on) {
      if (this.beforeLand === null) {
        this.beforeLand = { distance: cam.distance, pitch: cam.pitch };
      }
      cam.distance = Math.max(cam.distance, plotSpan(this.renderer.world.grid) * 6.4);
      cam.pitch = 1.18;
      cam.update();
      this.renderer.landView = 1;
      return;
    }
    this.renderer.landView = 0;
    this.renderer.hotPlot = -1;
    const was = this.beforeLand;
    this.beforeLand = null;
    if (was === null) return;
    cam.distance = was.distance;
    cam.pitch = was.pitch;
    cam.update();
  }

  /** Lights the plot under the pointer and says what it would cost. */
  private hoverLand(cell: [number, number]): void {
    const world = this.renderer.world;
    const plot = plotAt(world.grid, cell[0], cell[1]);
    this.renderer.hotPlot = plot;
    this.renderer.mark = null;
    if (plot < 0) { this.say('outside the map'); return; }
    if (world.land.owns(plot)) { this.say('you own this land'); return; }
    if (!world.land.canBuy(plot)) {
      this.say('not for sale — a city has to grow out from itself, so only land '
        + 'touching what you own can be bought');
      return;
    }
    this.say(`click to buy this plot — ${money(world.land.price())}`);
  }

  /**
   * Buys the plot under the pointer.
   *
   * The city is rebuilt afterwards because zoning already painted on the plot
   * -- which a player can do before they own it, and often will, having
   * decided what a quarter is for before they can afford it -- comes up the
   * moment the land is theirs.
   */
  private buyLand(cell: [number, number]): void {
    const world = this.renderer.world;
    const plot = plotAt(world.grid, cell[0], cell[1]);
    if (plot < 0 || world.land.owns(plot)) return;
    if (!world.land.canBuy(plot)) {
      this.say('that plot does not touch land you own');
      return;
    }
    const paid = world.land.price();
    if (!this.afford(paid, 'that plot')) return;
    world.land.take(plot);
    this.say(`bought for ${money(paid)} — ${world.land.count} plots, `
      + `next ${money(world.land.price())}`);
    const [bx0, bz0, bx1, bz1] = plotBounds(world.grid, plot);
    this.rebuild(this.box(bx0, bz0, bx1, bz1, 0));
  }

  private dropLot(cell: [number, number]): void {
    const t = this.tool;
    if (t.kind !== 'place') return;
    const world = this.renderer.world;
    const [gx, gz] = this.lotOrigin(cell, t.proto);
    // Checked before it is paid for, so a refusal about the ground does not take
    // the money with it.
    const fit = lotFits(world, t.proto.id, gx, gz, this.placeYaw, baseHeightAt);
    if (fit.why !== null) {
      this.say(`cannot place the ${t.proto.def.name.toLowerCase()}: ${fit.why}`);
      return;
    }
    if (!this.unlocked(t.proto.id)) {
      const branch = NODE_OF_ASSET.get(t.proto.id)?.branch;
      if (branch !== undefined && !this.branchOpen(branch)) {
        this.sayLocked(`The ${t.proto.def.name.toLowerCase()}`, branch);
        return;
      }
      denySound();
      this.say(`the ${t.proto.def.name.toLowerCase()} is not unlocked yet `
        + '\u2014 spend stars on it: click the level dial, or press T');
      return;
    }
    if (!this.afford(buildingPrice(t.proto.def), t.proto.def.name)) return;
    const why = placeLot(world, t.proto.id, gx, gz, this.placeYaw, baseHeightAt);
    if (why !== null) { this.say(`cannot place the ${t.proto.def.name.toLowerCase()}: ${why}`); return; }
    // The whole of what it took: its footprint, and the grounds a landmark
    // reserves around itself, which reach well past it.
    const placed = world.lots[world.lots.length - 1];
    const [w, d] = this.placeYaw % 2 === 0
      ? [t.proto.w, t.proto.d] : [t.proto.d, t.proto.w];
    let x0 = gx, z0 = gz, x1 = gx + w, z1 = gz + d;
    if (placed?.grounds !== undefined) {
      x0 = Math.min(x0, placed.grounds[0]);
      z0 = Math.min(z0, placed.grounds[1]);
      x1 = Math.max(x1, placed.grounds[0] + placed.grounds[2]);
      z1 = Math.max(z1, placed.grounds[1] + placed.grounds[3]);
    }
    this.rebuild({ gx: x0 - 2, gz: z0 - 2, w: x1 - x0 + 4, d: z1 - z0 + 4 });
    // An industry headquarters is the start of something: it goes on the
    // register, and the tool moves straight on to drawing the area it works.
    if (t.proto.id.startsWith('spec.hq.')) {
      const kind = t.proto.id.slice('spec.hq.'.length) as ResourceId;
      const hq = world.industry.add({ kind, gx, gz, w, d, area: [], exportShare: 1 });
      confirmSound();
      this.earn(buildingPrice(t.proto.def), false);
      this.renderer.setGhost(null);
      this.select({ kind: 'area', hq });
      return;
    }
    // What it was worth. A landmark is worth a great deal more than a bus
    // shelter, which is the whole reason the player is saving up for one.
    confirmSound();
    this.earn(buildingPrice(t.proto.def), t.proto.def.signature === true && t.proto.def.mod === undefined);
    // The real building now stands where the ghost was, and two copies of it in
    // the same place is what "it is stuck there" looks like. The next pointer
    // move puts a fresh ghost up for the next one.
    this.renderer.setGhost(null);
    this.showMark();
  }

  /** The lot's north-west corner for a building centred on `cell`. */
  private lotOrigin(cell: [number, number], p: Proto): [number, number] {
    const [w, d] = this.placeYaw % 2 === 0 ? [p.w, p.d] : [p.d, p.w];
    return [cell[0] - (w >> 1), cell[1] - (d >> 1)];
  }

  // ---- what a drag means ----------------------------------------------

  /**
   * The ground a drag covers.
   *
   * A road is a line and everything else is a rectangle, but both are drawn
   * the same way: a road's mark is the band it will actually occupy, which is
   * what makes it obvious before releasing that a four-cell avenue is wider
   * than the three-cell street beside it.
   */
  private area(a: [number, number], b: [number, number]):
    { gx: number; gz: number; w: number; d: number } {
    if (this.tool.kind === 'road' || this.tool.kind === 'curve') {
      const width = this.roadWidth();
      // The leg the road will take: the longer axis first, the same choice
      // RoadNet makes, so the mark is the road.
      const horizontal = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
      const side = (c: number): number => c - (width >> 1);
      if (horizontal) {
        return {
          gx: Math.min(a[0], b[0]), gz: side(a[1]),
          w: Math.abs(b[0] - a[0]) + 1, d: width,
        };
      }
      return {
        gx: side(a[0]), gz: Math.min(a[1], b[1]),
        w: width, d: Math.abs(b[1] - a[1]) + 1,
      };
    }
    return {
      gx: Math.min(a[0], b[0]), gz: Math.min(a[1], b[1]),
      w: Math.abs(b[0] - a[0]) + 1, d: Math.abs(b[1] - a[1]) + 1,
    };
  }

  private roadWidth(): number {
    return this.tool.kind === 'road' || this.tool.kind === 'curve'
      ? Math.max(2, Math.round((ROAD_SPECS[this.tool.cls].edge * 2) / CELL))
      : 3;
  }

  /** A cell's centre, in metres. */
  private metres(c: [number, number]): [number, number] {
    const half = this.renderer.world.grid / 2;
    return [(c[0] - half + 0.5) * CELL, (c[1] - half + 0.5) * CELL];
  }

  private showMark(): void {
    // The terrain draws its zoning grid only while a tool is in hand, and this
    // is the one place every tool change and every pointer move passes through.
    this.renderer.building = this.active;
    if (!this.active) {
      this.renderer.mark = null;
      this.renderer.setRoadPreview(null);
      // And the placement ghost, which this used to leave standing. Putting the
      // tool away cleared the footprint and the road preview and left the
      // building itself hanging over the map with nothing to dismiss it --
      // Escape included, because Escape's last act is to select the look tool
      // and arrive here.
      this.renderer.setGhost(null);
      return;
    }
    if (this.tool.kind === 'transit') {
      // The line being drawn, with a rubber band from the last stop to wherever
      // the pointer is -- snapped to the street it would actually sit on.
      // Without it the tool was a series of clicks into a void: nothing moved
      // between them, so there was no way to see where the next stop would land
      // or whether it had found a road at all.
      this.renderer.mark = null;
      this.renderer.setRoadPreview(null);
      this.renderer.setGhost(null);
      const on = this.to === null ? null : this.snapToRoad(this.to);
      const draft = on === null ? this.stops : [...this.stops, on[0], on[1]];
      this.renderer.setTransitDraft(
        draft.length >= 2 ? Float32Array.from(draft) : null,
        TRANSIT_SPEC[this.tool.line].colour);
      // And what it would cost, so the decision is made before the click.
      if (this.stops.length >= 2) {
        const n = draft.length / 2;
        const each = (this.tool.line === 0 ? 2600 : 14000) * RULES.build;
        this.say(`${this.stops.length / 2} stops — `
          + `${money(n * each)} so far, Enter to close the loop, `
          + `Backspace to take one back`);
      } else if (on === null) {
        this.say('a stop has to be on a road — hover a street');
      }
      return;
    }
    if (this.tool.kind === 'area') {
      this.renderer.mark = null;
      this.renderer.setRoadPreview(null);
      this.renderer.setGhost(null);
      const h = this.renderer.world.industry.hqs[this.tool.hq];
      const colour = h === undefined ? '#f4b54a' : resourceById(h.kind).ramp[2];
      const hover = this.to === null ? [] : this.cellMetres(this.to);
      const draft = [...this.areaPts, ...hover];
      // Closed back to the first point once it is a shape, so the outline is
      // the area it will be rather than a line that stops.
      if (draft.length >= 6) draft.push(draft[0], draft[1]);
      this.renderer.setTransitDraft(draft.length >= 4 ? Float32Array.from(draft) : null, colour);
      // And the land it will become, filled in under the outline: the player
      // sees the field they are drawing rather than a line round nothing.
      if (h !== undefined) this.renderer.setWorkedDraft(draft.length >= 8 ? draft : null, h.kind);
      if (h !== undefined && draft.length >= 8) {
        const ha = this.renderer.world.industry.raster(draft, h.kind).length * cellHectares();
        this.say(`${ha.toFixed(1)} ha — ${money(Math.round(ha * HECTARE_COST * RULES.build))} `
          + `${ha > MAX_HECTARES ? `(over the ${MAX_HECTARES} ha limit) ` : ''}`
          + '— Enter to finish, Backspace to take a point back');
      }
      return;
    }
    if (this.tool.kind === 'land') {
      // The land tool has its own overlay, drawn across the whole map by the
      // terrain shader. A cell-sized rectangle under the pointer as well would
      // be a second, smaller answer to the same question.
      this.renderer.mark = null;
      this.renderer.setRoadPreview(null);
      this.renderer.setGhost(null);
      return;
    }
    if (this.tool.kind === 'place') {
      // The building itself, standing where it would stand, over a footprint
      // that says green or red. The footprint answers "does it fit"; the
      // model answers everything else -- how tall it is against its
      // neighbours, which way its front faces, whether it suits the gap.
      this.renderer.setRoadPreview(null);
      const p = this.tool.proto;
      const [gx, gz] = this.lotOrigin(this.to, p);
      const fit = lotFits(this.renderer.world, p.id, gx, gz, this.placeYaw, baseHeightAt);
      const half = this.renderer.world.grid / 2;
      const x0 = (gx - half) * CELL, z0 = (gz - half) * CELL;
      const x1 = x0 + fit.w * CELL, z1 = z0 + fit.d * CELL;
      this.renderer.mark = {
        rect: [x0, z0, x1, z1],
        tint: fit.why === null ? [0.35, 0.92, 0.55] : [0.95, 0.32, 0.28],
      };
      const index = ASSET_INDEX.get(p.id);
      if (index === undefined) { this.renderer.setGhost(null); return; }
      // Its own corners, averaged, so the ghost stands on the ground it would
      // be graded onto rather than hovering over the slope it is crossing.
      let sum = 0;
      for (const [i, j] of [[0, 0], [fit.w, 0], [0, fit.d], [fit.w, fit.d]]) {
        sum += baseHeightAt((gx + i - half) * CELL, (gz + j - half) * CELL);
      }
      this.renderer.setGhost({
        proto: index, x: (x0 + x1) / 2, z: (z0 + z1) / 2, y: sum / 4 - 0.25,
        yaw: this.placeYaw * (Math.PI / 2),
        halfX: (fit.w * CELL) / 2 + 0.8, halfZ: (fit.d * CELL) / 2 + 0.8,
        height: p.height * 1.2 + 3,
      });
      return;
    }
    this.renderer.setGhost(null);
    if (this.tool.kind === 'curve') {
      this.renderer.mark = null;
      if (this.curveA === null) { this.renderer.setRoadPreview(null); return; }
      this.renderer.setRoadPreview(this.preview(this.curveA, this.to, this.curveVia, 0));
      return;
    }
    const a = this.from ?? this.to;
    if (this.tool.kind === 'road') {
      // A road previews as the road. The rectangle below cannot show a curve,
      // and was half a cell off from where the road actually lands.
      this.renderer.mark = null;
      if (this.from === null) { this.renderer.setRoadPreview(null); return; }
      this.renderer.setRoadPreview(this.preview(a, this.to, null, this.bend()));
      return;
    }
    this.renderer.setRoadPreview(null);
    const r = this.area(a, this.to);
    const half = this.renderer.world.grid / 2;
    this.renderer.mark = {
      rect: [
        (r.gx - half) * CELL, (r.gz - half) * CELL,
        (r.gx + r.w - half) * CELL, (r.gz + r.d - half) * CELL,
      ],
      tint: this.tint(),
    };
  }

  private tint(): [number, number, number] {
    if (this.tool.kind === 'zone') return hexToRgb(ZONE_STYLE[this.tool.zone as IconZone].base);
    if (this.tool.kind === 'district') {
      const d = this.renderer.world.districts.byId(this.tool.id);
      return d === undefined ? [0.9, 0.45, 0.4] : hexToRgb(DISTRICT_COLOURS[d.colour % DISTRICT_COLOURS.length]);
    }
    return TOOL_TINT[this.tool.kind] ?? TOOL_TINT.look;
  }

  /**
   * The road a pair of cells would make, as geometry, or null if it is too
   * short to be one. The endpoints are snapped exactly the way committing
   * snaps them, or the preview would be a road the player does not get.
   */
  private preview(a: [number, number], b: [number, number],
    via: [number, number] | null, bend: number) {
    const t = this.tool;
    if (t.kind !== 'road' && t.kind !== 'curve') return null;
    const world = this.renderer.world;
    const [ax, az] = world.net.snapPoint(...this.metres(a));
    const [bx, bz] = world.net.snapPoint(...this.metres(b));
    // Asked as a pass-through point rather than a bend, because the graph may
    // bend the road further than asked to leave a junction along its tangent,
    // and the preview's own one-link graph cannot know about that junction.
    const mid = world.net.midpointOf(ax, az, bx, bz, bend,
      via === null ? null : this.metres(via));
    const free = ELEVATIONS[this.elevation];
    return previewRoad(world.grid, ax, az, bx, bz, t.cls, 0, baseHeightAt, mid,
      world.net.elevNear(ax, az, free), world.net.elevNear(bx, bz, free));
  }

  /**
   * Lays one road, and clears the zoning it lands on.
   *
   * Only the zoning goes. What must *not* go is the roads it runs across:
   * crossing one builds a junction, and clearing the band first deleted every
   * road the new one met. The graph finds its own crossings.
   */
  private lay(a: [number, number], b: [number, number],
    via: [number, number] | null, bend = 0): boolean {
    const t = this.tool;
    if (t.kind !== 'road' && t.kind !== 'curve') return false;
    const world = this.renderer.world;
    const [ax, az] = this.metres(a);
    const [bx, bz] = this.metres(b);
    // Shorter than a junction is wide is not a road, and the graph would drop
    // it anyway -- but not before this had cleared the zoning and rebuilt.
    if (Math.hypot(bx - ax, bz - az) < 12) return false;
    // Both ends on land you own. Testing the ends rather than every cell of the
    // run is deliberate: a road that starts and finishes on your land but clips
    // the corner of a plot you have not bought is not the thing anyone means by
    // building on someone else's land, and refusing it would be a rule about
    // geometry rather than about the city.
    if (!ownsAt(world.land, world.grid, ax, az)
      || !ownsAt(world.land, world.grid, bx, bz)) {
      this.say('you do not own that land — buy it with the land tool');
      return false;
    }
    // Ending on the bend point means the bend point was the first half of a
    // double-click, and what the player asked for is a straight run to there.
    if (via !== null && Math.abs(via[0] - b[0]) <= 1 && Math.abs(via[1] - b[1]) <= 1) {
      via = null;
    }
    // Priced on the chord plus the bow, which is what the road will actually be.
    const metres = Math.hypot(bx - ax, bz - az) + Math.abs(bend) * 0.8;
    const label = this.elevation > 0
      ? `${ROAD_SPECS[t.cls].label} viaduct` : ROAD_SPECS[t.cls].label;
    if (!this.afford(metres * this.roadCost(t.cls), label)) return false;
    this.clearUnder(a, b, via, bend);
    world.net.add(ax, az, bx, bz, t.cls, bend, via === null ? null : this.metres(via),
      ELEVATIONS[this.elevation]);
    // The chord and the bend both, since a curve leaves the straight line
    // between its ends by as much as the player pulled it.
    const swing = Math.abs(bend) + 8;
    this.rebuild(this.box(
      Math.min(ax, bx) - swing, Math.min(az, bz) - swing,
      Math.max(ax, bx) + swing, Math.max(az, bz) + swing, 3));
    thud();
    return true;
  }

  /**
   * Clears the zoning under a road, following the road.
   *
   * A straight is a rectangle, but a curve is not, and clearing a curve's
   * bounding box would strip the zoning from whole blocks the road never
   * touches. So the same quadratic the graph will build is walked in cell
   * space and a carriageway-width square cleared at each step.
   */
  private clearUnder(a: [number, number], b: [number, number],
    via: [number, number] | null, bend: number): void {
    const world = this.renderer.world;
    const w = this.roadWidth();
    const off = w >> 1;
    let cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2;
    if (via !== null) {
      cx = 2 * via[0] - cx;
      cz = 2 * via[1] - cz;
    } else if (bend !== 0) {
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const n = Math.hypot(dx, dz) || 1;
      cx += (-dz / n) * (bend / CELL);
      cz += (dx / n) * (bend / CELL);
    }
    const steps = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.5));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      const x = u * u * a[0] + 2 * u * t * cx + t * t * b[0];
      const z = u * u * a[1] + 2 * u * t * cz + t * t * b[1];
      paint(world, Math.round(x) - off, Math.round(z) - off, w, w, 0);
    }
  }

  /**
   * Rebuilds the city, telling it what the edit touched.
   *
   * Without a rectangle the whole city is made again, which on a five-kilometre
   * map is most of a second. Every edit here knows where it happened, so every
   * one of them says so.
   */
  private rebuild(dirty?: Dirty): void {
    const started = performance.now();
    this.renderer.rebuild(dirty);
    // To the log, not the status line: said there it overwrote whatever the
    // edit had just told the player -- "zoned 12 cells, 3 off a road" -- with
    // a timing only a developer wants.
    log.info('tools', `rebuilt in ${(performance.now() - started).toFixed(0)} ms`);
  }

  /** The cells a rectangle of world metres covers, with a margin. */
  private box(x0: number, z0: number, x1: number, z1: number, pad = 2): Dirty {
    const half = this.renderer.world.grid / 2;
    const c = (m: number): number => Math.floor(m / CELL + half);
    const gx = Math.min(c(x0), c(x1)) - pad, gz = Math.min(c(z0), c(z1)) - pad;
    return {
      gx, gz,
      w: Math.abs(c(x1) - c(x0)) + 1 + pad * 2,
      d: Math.abs(c(z1) - c(z0)) + 1 + pad * 2,
    };
  }

  private commit(a: [number, number], b: [number, number]): void {
    const world = this.renderer.world;
    const t = this.tool;
    const r = this.area(a, b);
    if (t.kind === 'road') {
      this.lay(a, b, null, this.bend());
      return;
    } else if (t.kind === 'upgrade') {
      // Converting rather than building. The rectangle the drag swept, in
      // metres, against the links' own curves rather than their bounding
      // boxes -- see RoadGraph.upgrade.
      const half = world.grid / 2;
      const changed = world.net.upgrade(
        (r.gx - half) * CELL, (r.gz - half) * CELL,
        (r.gx + r.w - half) * CELL, (r.gz + r.d - half) * CELL, t.cls);
      if (changed === 0) { this.say('drag over a road to convert it'); return; }
      // Every link the drag caught, and the ground around all of them: a
      // wider road takes cells the buildings beside it were standing on, so
      // this is a full rebuild rather than a rectangle.
      this.renderer.rebuild();
      this.showMark();
      this.say(`${changed} road${changed === 1 ? '' : 's'} converted to `
        + ROAD_SPECS[t.cls].label.toLowerCase());
      return;
    } else if (t.kind === 'zone') {
      // The drawer greys out a density the city has not reached, but the tool
      // can also be held from before a save was loaded, so the rule lives here
      // too -- on the action, where it cannot be got round.
      const needs = zoneNeeds(t.zone, t.density);
      if (world.progress.level < needs) {
        this.say(`${t.zone} ${t.density} opens at level ${needs}, ${levelName(needs)}`);
        return;
      }
      // Clipped to the land the city owns, plot by plot, rather than refused
      // whole. A brush dragged along a street that runs over a plot boundary
      // used to do nothing at all and say so, which is the kind of refusal a
      // player reads as the tool being broken.
      const size = plotCells(world.grid);
      const parts: Array<[number, number, number, number]> = [];
      let unowned = 0;
      const p0x = Math.max(0, Math.floor(r.gx / size));
      const p1x = Math.min(PLOTS - 1, Math.floor((r.gx + r.w - 1) / size));
      const p0z = Math.max(0, Math.floor(r.gz / size));
      const p1z = Math.min(PLOTS - 1, Math.floor((r.gz + r.d - 1) / size));
      for (let pz = p0z; pz <= p1z; pz++) {
        for (let px = p0x; px <= p1x; px++) {
          const x0 = Math.max(r.gx, px * size), x1 = Math.min(r.gx + r.w, (px + 1) * size);
          const z0 = Math.max(r.gz, pz * size), z1 = Math.min(r.gz + r.d, (pz + 1) * size);
          if (x1 <= x0 || z1 <= z0) continue;
          if (world.land.owns(pz * PLOTS + px)) parts.push([x0, z0, x1 - x0, z1 - z0]);
          else unowned += (x1 - x0) * (z1 - z0);
        }
      }
      if (parts.length === 0) {
        this.say('you do not own that land \u2014 buy it with the land tool');
        return;
      }
      // Charged for what the brush will actually take, which is the cells that
      // are not already this zone, not already a road, and within reach of one.
      const code = zoneCode(t.zone, t.density, t.theme);
      let fresh = 0;
      // Cells out of reach of a road, which take no paint: counted so the
      // player is told why a drag across a field left only a strip.
      let offRoad = 0;
      for (const [px, pz, pw, pd] of parts) {
        for (let j = 0; j < pd; j++) {
          for (let i = 0; i < pw; i++) {
            const gx = px + i, gz = pz + j;
            if (gx < 0 || gz < 0 || gx >= world.grid || gz >= world.grid) continue;
            if (world.net.has(gx, gz)) continue;
            if (!world.net.nearRoad(gx, gz)) { offRoad++; continue; }
            if (world.zones[gz * world.grid + gx] === code) continue;
            fresh++;
          }
        }
      }
      if (fresh > 0 && !this.afford(fresh * zonePrice(t.zone, t.density),
        `${fresh} cells of ${t.zone}`)) return;
      for (const [px, pz, pw, pd] of parts) paint(world, px, pz, pw, pd, code);
      if (fresh > 0) brush();
      const unownedNote = unowned > 0 ? ', the rest is on land you do not own yet' : '';
      if (fresh === 0 && offRoad > 0) {
        this.say('nothing zoned \u2014 every cell there is out of reach of a road. '
          + 'Zoning has to touch a street.');
      } else if (fresh > 0) {
        this.say(`zoned ${fresh} cells of ${t.zone}`
          + (offRoad > 0 ? `, ${offRoad} skipped for being off a road` : '')
          + unownedNote
          + ' \u2014 building starts within a few seconds');
      } else if (unowned > 0) {
        this.say('you do not own that land \u2014 buy it with the land tool');
      }
    } else if (t.kind === 'district') {
      const D = world.districts;
      const n = D.paint(r.gx, r.gz, r.w, r.d, t.id);
      const d = D.byId(t.id);
      if (n > 0) this.say(d === undefined ? `${n} cells taken out of their districts` : `${d.name}: ${n} cells painted`);
      this.onDistricts?.(t.id);
      return;
    } else if (t.kind === 'clear') {
      // Bulldozing rebuilds the whole city, and that is the right trade.
      //
      // It is the one edit that takes things away rather than adding them:
      // roads vanish, which means the corridor raster has to be drawn again
      // from nothing anyway, and ground that was claimed by a landmark is
      // suddenly free for anything within thirty-five cells of it. Working out
      // exactly how far that reaches is possible and it saves a fraction of a
      // second on an action a player takes a handful of times an hour, at the
      // cost of being the one path in here that is only approximately right.
      // A fraction back for what was standing there: scrap and salvage, not a
      // refund. Enough that a misclick is not punished and far too little to
      // make demolition a business.
      let back = 0;
      for (const lot of world.lots) {
        if (lot.gx + lot.w <= r.gx || lot.gx >= r.gx + r.w) continue;
        if (lot.gz + lot.d <= r.gz || lot.gz >= r.gz + r.d) continue;
        const def = assetById(lot.id);
        if (def !== undefined) back += buildingPrice(def) * 0.3;
      }
      demolish(world, r.gx, r.gz, r.w, r.d);
      crunch();
      this.refund(back);
      if (back > 0) this.say(`cleared — ${money(Math.round(back))} in salvage`);
      this.rebuild();
      return;
    } else {
      return;
    }
    this.rebuild({ gx: r.gx - 2, gz: r.gz - 2, w: r.w + 4, d: r.d + 4 });
  }

  // ---- the bar ---------------------------------------------------------

  private select(tool: Tool): void {
    // A zone the city has not reached yet cannot be picked up at all -- not
    // picked up and then refused on the first drag, which is what a locked
    // tile that still selected the brush did.
    if (tool.kind === 'zone') {
      const needs = zoneNeeds(tool.zone, tool.density);
      if (this.renderer.world.progress.level < needs) {
        denySound();
        this.say(`${tool.density} ${tool.zone} opens at level ${needs}, ${levelName(needs)}`);
        return;
      }
    }
    // Transit lines are the transport branch, and open with it.
    if (tool.kind === 'transit' && !this.branchOpen('transport')) {
      this.sayLocked('Public transport', 'transport');
      return;
    }
    // The land tool owns the camera while it is up, so entering and leaving it
    // is part of selecting it rather than something the caller remembers.
    if ((tool.kind === 'land') !== (this.tool.kind === 'land')) {
      this.enterLand(tool.kind === 'land');
    }
    this.tool = tool;
    // Anything the last tool was showing goes with it.
    this.renderer.showDots(0);
    if (tool.kind !== 'place') this.renderer.setGhost(null);
    if (tool.kind !== 'transit' && this.stops.length > 0) this.dropLine();
    this.renderer.askTransit('tool', tool.kind === 'transit');
    if (tool.kind !== 'transit' && tool.kind !== 'area') this.renderer.setTransitDraft(null);
    if (tool.kind !== 'area') {
      if (this.areaPts.length > 0) this.renderer.setWorkedDraft(null, '');
      this.areaPts = [];
    }
    // Drawing an area opens the resources view on what it will harvest, so the
    // player draws over the ground they can see is rich rather than guessing.
    if (tool.kind === 'area') {
      const h = this.renderer.world.industry.hqs[tool.hq];
      if (h !== undefined) this.onIndustryView?.(h.kind);
    }
    this.from = null;
    this.curveA = null;
    this.curveVia = null;
    this.curveStage = 'none';
    if (tool.kind === 'road' || tool.kind === 'curve' || tool.kind === 'upgrade') {
      this.roadMode = tool.kind;
    }
    // Picking a tool is the earliest the game can know what is about to be
    // built, and generating a building is the most expensive thing it does. So
    // the renderer starts making them now, a few per second, while the player
    // is still moving the cursor -- rather than inside the rebuild that follows
    // the click, which is where it used to stop the frame for a fifth of a
    // second.
    if (tool.kind === 'place') {
      this.renderer.warmAssets([tool.proto.id]);
    } else if (tool.kind === 'zone') {
      this.renderer.warmAssets(
        stock(tool.zone, tool.density, tool.theme ?? 'modern').map((p) => p.id));
    }
    this.closeDrawer();
    this.showMark();
    for (const el of this.buttons) {
      el.dataset.on = el.dataset.tool === this.key(tool) ? '1' : '';
    }
    this.canvas.style.cursor = tool.kind === 'look' ? '' : 'crosshair';
    this.say(this.describe(tool));
  }

  private key(t: Tool): string {
    // Both road tools answer to the same class button; which of the two it
    // selects is the mode button beside them.
    if (t.kind === 'road' || t.kind === 'curve') return `road:${t.cls}`;
    if (t.kind === 'zone') return `zone:${t.zone}:${t.density}:${t.theme ?? 'any'}`;
    if (t.kind === 'place') return `place:${t.proto.id}`;
    if (t.kind === 'transit') return `transit:${t.line}`;
    if (t.kind === 'area') return `area:${t.hq}`;
    if (t.kind === 'district') return 'district';
    return t.kind;
  }

  private describe(t: Tool): string {
    if (t.kind === 'look') return 'drag to pan, right-drag to orbit, wheel to zoom';
    if (t.kind === 'transit') {
      return `click along the streets to drop ${TRANSIT_SPEC[t.line].name.toLowerCase()} `
        + 'stops, Enter to close the loop — click an existing stop to change '
        + 'its line';
    }
    if (t.kind === 'road') {
      const up = ELEVATIONS[this.elevation];
      return `drag to lay a ${ROAD_SPECS[t.cls].label}${up > 0 ? ` viaduct ${up} m up` : ''} `
        + `(${money(this.roadCost(t.cls))}/m) — `
        + (up > 0 ? 'crosses over roads below; PgUp/PgDn height'
          : 'sweep the drag to curve it; it will cross and join what is there; PgUp to raise');
    }
    if (t.kind === 'curve') {
      return `click to start a ${ROAD_SPECS[t.cls].label}, click where it bends, `
        + 'click where it ends — double-click to finish the run';
    }
    if (t.kind === 'upgrade') {
      return `drag over roads to convert them to a ${ROAD_SPECS[t.cls].label.toLowerCase()} `
        + '— whole roads at a time, and the buildings along them stay';
    }
    if (t.kind === 'place') {
      const [w, d] = this.placeYaw % 2 === 0 ? [t.proto.w, t.proto.d] : [t.proto.d, t.proto.w];
      return `click to place the ${t.proto.def.name.toLowerCase()} `
        + `— ${money(buildingPrice(t.proto.def))}, ${w}\u00d7${d} cells `
        + `(${w * 8}\u00d7${d * 8} m) — R rotates`;
    }
    if (t.kind === 'area') {
      const h = this.renderer.world.industry.hqs[t.hq];
      const what = h === undefined ? 'the' : resourceById(h.kind).name.toLowerCase();
      return `click round the ${what} to work, Enter or click the first point to finish `
        + `— within ${REACH} m of the headquarters, Backspace takes a point back`;
    }
    if (t.kind === 'land') {
      const land = this.renderer.world.land;
      return `click a dashed plot to buy it — ${land.count} owned, `
        + `next ${money(land.price())}`;
    }
    if (t.kind === 'district') {
      const d = this.renderer.world.districts.byId(t.id);
      return d === undefined ? 'drag to erase districts' : `drag to paint ${d.name} — any shape, one rectangle at a time`;
    }
    if (t.kind === 'zone') {
      const style = t.theme === undefined ? '' : ` in the ${THEMES[t.theme].label} style`;
      return `drag to zone ${t.density} ${t.zone}${style} `
        + (zonePrice(t.zone, t.density) > 0 ? `(${money(zonePrice(t.zone, t.density))} a cell)` : '(free)');
    }
    return 'drag to clear roads and zoning';
  }

  private buttons: HTMLElement[] = [];
  /** Told which resource an area is being drawn for, so the map can show it. */
  onIndustryView: ((kind: ResourceId) => void) | null = null;
  /** Bar buttons that open with a branch, so their locks follow the level. */
  private gated: Array<{ b: HTMLElement; branch: string }> = [];

  /** Whether the city is big enough to run a branch yet. */
  private branchOpen(branch: string): boolean {
    return this.renderer.world.progress.level >= branchLevel(branch);
  }

  /** Says why a branch is shut, with the level and its name. */
  private sayLocked(what: string, branch: string): void {
    const at = branchLevel(branch);
    denySound();
    this.say(`${what} opens at level ${at} \u2014 ${levelName(at).toLowerCase()}. `
      + `The city is level ${this.renderer.world.progress.level}.`);
  }

  /** Greys out and badges every bar button whose branch is not open yet. */
  private paintLocks(): void {
    for (const { b, branch } of this.gated) {
      const open = this.branchOpen(branch);
      b.classList.toggle('is-locked', !open);
      b.setAttribute('aria-disabled', open ? 'false' : 'true');
      const old = b.querySelector('[data-lock]');
      if (open) { old?.remove(); continue; }
      if (old === null) b.appendChild(lockBadge(branchLevel(branch)));
    }
  }

  private buildBar(): HTMLElement {
    // The shell: one dark slab with a tool row above a status row, the way a
    // city builder's bar is always laid out. What a player reaches for is on
    // top where the pointer already is; what they only read sits below it.
    const bar = document.createElement('div');
    bar.style.cssText = [
      'display:flex', 'flex-direction:column', 'gap:0',
      'width:max-content', 'max-width:calc(100vw - 20px)', 'border-radius:16px',
      'overflow:hidden',
      `background:${PANEL}`, `border:1px solid ${EDGE}`,
      'box-shadow:0 10px 34px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.05)',
      'backdrop-filter:blur(14px)', 'z-index:5',
      // The overlay it lives in is click-through so the camera can be dragged
      // anywhere; the bar itself has to take its own clicks back.
      'pointer-events:auto',
    ].join(';');

    const tools = document.createElement('div');
    tools.style.cssText = [
      'display:flex', 'flex-wrap:wrap', 'align-items:center',
      'justify-content:center', 'row-gap:4px', 'padding:6px 4px',
    ].join(';');

    const group = (): HTMLElement => {
      const g = document.createElement('div');
      g.className = 'mr-group';
      return g;
    };
    /**
     * Every button on the bar is this shape: a square the size of a fingertip,
     * holding a picture and nothing else, in its category's colour.
     *
     * Labels were tried and they made the bar four hundred pixels tall --
     * twenty-seven buttons each carrying a word wrap onto six rows, and six
     * rows of toolbar is a menu, not a bar. The name lives in the tooltip and
     * in the status line under the cursor instead, which is where every
     * builder puts it. How it looks at rest, hovered, chosen and locked is in
     * the stylesheet (theme.ts), so no code here paints a state by hand.
     */
    const chip = (el: HTMLElement, colour: string, picture?: string | HTMLElement): void => {
      el.className = 'mr-tile';
      el.style.setProperty('--accent', colour);
      if (typeof picture === 'string') el.innerHTML = picture;
      else if (picture !== undefined) el.appendChild(picture);
    };

    const add = (parent: HTMLElement, make: Tool | (() => Tool), label: string,
      icon: string, colour: string): void => {
      const pick = typeof make === 'function' ? make : (): Tool => make;
      const b = document.createElement('button');
      b.dataset.tool = this.key(pick());
      tip(b, label);
      chip(b, colour, icon);
      b.addEventListener('click', () => this.select(pick()));
      parent.appendChild(b);
      this.buttons.push(b);
    };

    const look = group();
    add(look, { kind: 'look' }, 'Look around — drag to pan, right-drag to orbit',
      glyph('look'), '#a9bcd2');
    tools.appendChild(look);

    // Roads, zones and signatures each collapse to one icon. Eight road
    // classes, five zones and a dozen landmarks spread along the bar is a
    // bar you scan; one icon each is a bar you read.
    const roads = group();
    {
      const b = document.createElement('button');
      b.dataset.branch = 'roads';
      tip(b, 'Roads \u2014 eight classes, straight or curved');
      chip(b, '#c9d3de', glyph('road'));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.drawer?.dataset.branch === 'roads') { this.closeDrawer(); return; }
        this.openRoadDrawer();
      });
      roads.appendChild(b);
      this.buttons.push(b);
    }
    tools.appendChild(roads);

    // One button per zone, cycling density on repeated clicks: four buttons
    // and a modifier beats twelve buttons, and density is the thing a player
    // changes least often.
    // Zones and services are the same idea on the bar: one flat icon for the
    // category, and the things you can actually place behind it. The bar is
    // what you choose *between*; the drawer is what you choose.
    const zones = group();
    {
      const b = document.createElement('button');
      b.dataset.branch = 'zones';
      tip(b, 'Zoning \u2014 residential, commercial, industrial, office, parks');
      chip(b, ZONE_STYLE.residential.light, zoneSwatch());
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.drawer?.dataset.branch === 'zones') { this.closeDrawer(); return; }
        this.openZoneDrawer(this.zoneTab);
      });
      zones.appendChild(b);
      this.buttons.push(b);
    }

    tools.appendChild(zones);

    // Landmarks. There is exactly one of each in a city, which is what makes
    // them worth a category of their own rather than a corner of services.
    const marks = group();
    {
      const b = document.createElement('button');
      b.dataset.branch = 'signature';
      tip(b, `Landmarks \u2014 ${SIGNATURES.length} one-of-a-kind buildings`);
      chip(b, '#ffd166', glyph('signature'));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.drawer?.dataset.branch === 'signature') { this.closeDrawer(); return; }
        this.openSignatureDrawer();
      });
      marks.appendChild(b);
      this.buttons.push(b);
    }
    tools.appendChild(marks);

    // Industry: a headquarters per natural resource, and the area it works.
    const industry = group();
    {
      const b = document.createElement('button');
      b.dataset.branch = 'industry';
      tip(b, 'Industry \u2014 farms, forestry, mines, oil, quarries and fishing');
      chip(b, '#e0a24a', glyph('resources'));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const level = this.renderer.world.progress.level;
        if (level < INDUSTRY_LEVEL) {
          denySound();
          this.say(`industry opens at level ${INDUSTRY_LEVEL} — the city is level ${level}`);
          return;
        }
        if (this.drawer?.dataset.branch === 'industry') { this.closeDrawer(); return; }
        this.openIndustryDrawer();
      });
      industry.appendChild(b);
      this.buttons.push(b);
    }
    tools.appendChild(industry);

    // Eleven branches, each a drawer of buildings. A flat list of eighty-nine
    // buttons is not a palette, and the branch is how a player thinks about it
    // anyway: they do not want "the 4x4 one", they want a fire station.
    const civic = group();
    for (const branch of BRANCHES) {
      const list = BY_BRANCH.get(branch);
      if (list === undefined || list.length === 0) continue;
      const style = BRANCH_STYLE[branch];
      const b = document.createElement('button');
      b.dataset.branch = branch;
      tip(b, `${style.label} \u2014 ${list.length} buildings`);
      chip(b, style.colour, glyph(branch));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this.branchOpen(branch)) { this.sayLocked(style.label, branch); return; }
        if (this.drawer?.dataset.branch === branch) { this.closeDrawer(); return; }
        this.openDrawer(branch, list, bar);
      });
      civic.appendChild(b);
      this.buttons.push(b);
      this.gated.push({ b, branch });
    }
    tools.appendChild(civic);

    // Public transport. One button per kind, beside the civic buildings,
    // because a bus route is a service the city runs rather than a road.
    const transit = group();
    for (let k = 0; k < TRANSIT_SPEC.length; k++) {
      const spec = TRANSIT_SPEC[k];
      add(transit, { kind: 'transit', line: k },
        `${spec.name} line — click along the streets to drop stops, `
        + 'Enter to close the loop',
        glyph(k === 0 ? 'bus' : 'tram'), spec.colour);
    }
    for (const b of Array.from(transit.children) as HTMLElement[]) {
      this.gated.push({ b, branch: 'transport' });
    }
    tools.appendChild(transit);

    const clear = group();
    // "Buy land", not "Land": the landmarks button is two along and starts with
    // the same four letters, and a player scanning tooltips should not have to
    // read to the dash to tell them apart.
    add(clear, { kind: 'land' },
      'Buy land — lift the camera and buy the ground your city grows onto',
      glyph('land'), '#8fd4ff');
    {
      const b = document.createElement('button');
      b.dataset.branch = 'districts';
      tip(b, 'Districts — paint named quarters and give them policies');
      chip(b, '#e0a24a', glyph('district'));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.drawer?.dataset.branch === 'districts') { this.closeDrawer(); return; }
        this.openDistrictDrawer();
      });
      clear.appendChild(b);
      this.buttons.push(b);
    }
    add(clear, { kind: 'clear' }, 'Bulldoze — drag to clear roads and zoning',
      glyph('clear'), '#f0906e');
    tools.appendChild(clear);

    // Saving sits on the bar rather than behind a menu, because a city
    // builder's one unrecoverable mistake is closing the tab.
    const keep = group();
    {
      const b = document.createElement('button');
      tip(b, 'Save this city to this browser', 'Ctrl+S');
      chip(b, '#8fe0a8', glyph('save'));
      b.addEventListener('click', () => this.save());
      keep.appendChild(b);
    }
    // No development key on the bar: the level ring on the status strip opens
    // the tree, and so does T. A second way in on the toolbar was clutter.
    {
      const b = document.createElement('button');
      chip(b, SKIN.dim, glyph('settings'));
      tip(b, 'Settings', 'O');
      b.addEventListener('click', () => this.onSettings?.());
      keep.appendChild(b);
    }
    tools.appendChild(keep);

    bar.appendChild(tools);
    bar.appendChild(this.buildStatusRow());
    this.paintLocks();
    return bar;
  }

  /**
   * The row under the tools: what the city is, rather than what you can do.
   *
   * Everything on it is real. The clock is the one the sun runs on, the
   * season and temperature follow it round the year, and the population is
   * counted from the buildings actually standing -- so it is zero on the first
   * frame and climbs as districts fill, which is the whole feedback loop a
   * city builder runs on.
   */
  private buildStatusRow(): HTMLElement {
    const row = document.createElement('div');
    css(row, [
      'display:flex', 'align-items:center', 'gap:6px', 'height:44px',
      'padding:0 7px', `background:${WELL}`,
      `border-top:1px solid ${SKIN.edge}`,
      `font:500 12px/1 ${SKIN.mono}`, `color:${SKIN.text}`,
    ]);

    /**
     * One reading: a dim tracked caption over the figure it belongs to.
     *
     * The row used to be a line of equal-weight chips, and a line where the
     * clock, the temperature and the population all look the same is a line
     * nobody reads -- the eye has nothing to catch on. A caption above each
     * value gives every reading a shape, and the values themselves are the only
     * bright thing on the bar.
     */
    const cell = (caption: string): HTMLElement => {
      const d = document.createElement('div');
      d.className = 'mr-cell';
      const cap = document.createElement('div');
      css(cap, ['font:600 11.5px/1 var(--label)', 'letter-spacing:.16em', 'text-transform:uppercase',
        `color:${SKIN.faint}`]);
      cap.textContent = caption;
      const val = document.createElement('div');
      css(val, ['display:flex', 'align-items:center', 'gap:6px', 'font:600 14px/1 var(--ui)',
        `color:${SKIN.bright}`, 'font-variant-numeric:tabular-nums']);
      d.append(cap, val);
      return d;
    };
    // The readings split into what time it is, what the city is, and what
    // it has, with the slack between the last two.
    const spacer = (): HTMLElement => {
      const r = document.createElement('div');
      css(r, ['flex:1', 'min-width:4px']);
      return r;
    };

    // Speed, as four keys of the same family as every other button in the game.
    // The clock is the renderer's own, so pausing here pauses the sun, the lit
    // windows and the shadows together -- there is only one clock.
    const speeds = document.createElement('div');
    css(speeds, ['display:flex', 'gap:4px', 'padding:0 6px 0 2px']);
    // Drawn rather than typed. The pause and play characters render in whatever
    // the browser has for them, at whatever weight it feels like, and next to
    // sixteen hand-drawn tool icons that reads as a font error.
    const play = (n: number): string => {
      const w = 5, gap = 1.4, total = n * w + (n - 1) * gap;
      let d = '';
      for (let i = 0; i < n; i++) {
        const x = 8 - total / 2 + i * (w + gap);
        d += `M${x} 4.4L${x + w} 8L${x} 11.6Z`;
      }
      return `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">`
        + `<path d="${d}"/></svg>`;
    };
    const marks = [
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">'
        + '<rect x="4.6" y="4.2" width="2.6" height="7.6" rx="1"/>'
        + '<rect x="8.8" y="4.2" width="2.6" height="7.6" rx="1"/></svg>',
      play(1), play(2), play(3),
    ];
    const names = ['Pause', 'Play', 'Fast', 'Fastest'];
    const buttons: HTMLElement[] = SPEEDS.map((rate, i) => {
      const b = document.createElement('button');
      b.innerHTML = marks[i];
      b.dataset.speed = String(i);
      keyStyle(b, i === 0 ? SKIN.warn : SKIN.accent, 30);
      b.style.width = `${30 + i * 4}px`;
      tip(b, i === 0 ? 'Pause the city' : `${names[i]} \u2014 ${rate}\u00d7 time`,
        i === 0 ? 'Space' : String(i + 1));
      b.addEventListener('click', () => this.setSpeed(i));
      speeds.appendChild(b);
      return b;
    });
    this.speedButtons = buttons;
    row.appendChild(speeds);

    this.readClock = cell('time');
    row.appendChild(this.readClock);
    this.readSeason = cell('season');
    row.appendChild(this.readSeason);
    // The weather, beside the season and the temperature it belongs with. It
    // changes the light enough that a player who has not noticed the sky needs
    // somewhere to read why the city went grey.
    this.readWeather = cell('sky');
    row.appendChild(this.readWeather);

    // The city and what lives in it, together. The population used to sit at
    // the far right beside the money, a whole bar away from the name of the
    // place it belongs to -- which is the one number a player checks against
    // the one word that identifies their city.
    this.readName = cell('city');
    row.appendChild(this.readName);
    this.readPeople = cell('people');
    row.appendChild(this.readPeople);
    row.appendChild(spacer());
    this.readLevel = this.levelDial();
    row.appendChild(this.readLevel);
    this.paintName();
    this.readMoney = cell('treasury');
    row.appendChild(this.readMoney);

    this.setSpeed(1);
    this.tick();
    return row;
  }

  /**
   * Sets the game speed, from the bar or from the keyboard.
   *
   * Pausing remembers what it was paused from, so Space toggles back to the
   * speed the player was actually running at rather than always to one -- a
   * detail nobody notices until it is missing and every pause costs two clicks.
   */
  /**
   * The city's level as a dial: the number inside a ring that fills as the
   * next level comes closer, and the name beside it. It is a button, because
   * the level is what the development tree spends, and the one place a player
   * looks to see how far along the city is should take them to what it buys.
   */
  private levelDial(): HTMLElement {
    const b = document.createElement('button');
    b.className = 'mr-cell mr-dial';
    tip(b, 'Development \u2014 what the city can build next', 'T');
    const r = 12;
    b.innerHTML = `<span class="mr-dial-ring"><svg width="30" height="30" viewBox="0 0 30 30">`
      + `<circle cx="15" cy="15" r="${r}" fill="rgba(244,181,74,.10)" stroke="rgba(255,255,255,.1)"`
      + ` stroke-width="2.6"/>`
      + `<circle data-arc cx="15" cy="15" r="${r}" fill="none" stroke="${SKIN.warn}"`
      + ` stroke-width="2.6" stroke-linecap="round" stroke-dasharray="${DIAL}"`
      + ` stroke-dashoffset="${DIAL}" transform="rotate(-90 15 15)"/></svg>`
      + `<b data-num>1</b></span>`
      + `<span class="mr-dial-text"><b data-name></b><i data-next></i></span>`;
    b.addEventListener('click', () => this.onTech?.());
    // The unspent stars, on the dial that opens the tree they are spent in.
    b.style.position = 'relative';
    const chip = document.createElement('span');
    chip.style.cssText = [
      'position:absolute', 'top:-5px', 'left:22px', 'min-width:17px', 'height:17px',
      'padding:0 4px', 'border-radius:9px', 'display:none', 'place-items:center',
      `background:${SKIN.warn}`, 'color:#1a1206', 'font:800 10px/1 var(--ui, system-ui, sans-serif)',
      'box-shadow:0 0 0 2px rgba(10,15,22,.9)', 'pointer-events:none',
    ].join(';');
    b.appendChild(chip);
    this.starChip = chip;
    return b;
  }



  /** Repaints everything that shows the city's career. */
  paintProgress(): void {
    this.paintLocks();
    const p = this.renderer.world.progress;
    if (this.starChip !== null) {
      this.starChip.textContent = `${p.stars}`;
      this.starChip.style.display = p.stars > 0 ? 'grid' : 'none';
    }
    if (this.readLevel !== undefined) {
      const top = p.level >= LEVEL_NAMES.length;
      const done = top ? 1 : Math.max(0, Math.min(1, p.intoLevel / Math.max(1, p.levelSpan)));
      const arc = this.readLevel.querySelector<SVGCircleElement>('[data-arc]');
      arc?.setAttribute('stroke-dashoffset', `${(DIAL * (1 - done)).toFixed(2)}`);
      const num = this.readLevel.querySelector<HTMLElement>('[data-num]');
      if (num !== null) num.textContent = `${p.level}`;
      const name = this.readLevel.querySelector<HTMLElement>('[data-name]');
      if (name !== null) name.textContent = levelName(p.level);
      const next = this.readLevel.querySelector<HTMLElement>('[data-next]');
      if (next !== null) {
        next.textContent = p.stars > 0
          ? `${p.stars} star${p.stars === 1 ? '' : 's'} to spend`
          : top ? 'Top level' : `${Math.round(done * 100)}% to level ${p.level + 1}`;
      }
    }
  }

  private setSpeed(i: number): void {
    const n = Math.max(0, Math.min(SPEEDS.length - 1, i));
    if (n > 0) this.lastSpeed = n;
    this.speed = n;
    this.renderer.clockRunning = SPEEDS[n] > 0;
    this.renderer.clockRate = SPEEDS[n];
    // And the city itself. The bar used to move only the sun: pausing left the
    // simulation running and ten times speed left it at one, so the clock in
    // the corner raced while the city did exactly what it had been doing. The
    // player's time control is one number and everything reads it.
    this.onSpeed?.(SPEEDS[n]);
    for (let k = 0; k < this.speedButtons.length; k++) {
      setKey(this.speedButtons[k], k === 0 ? SKIN.warn : SKIN.accent, k === n);
    }
  }

  /** Space: pause, or go back to the speed that was running. */
  private togglePause(): void {
    this.setSpeed(this.speed === 0 ? this.lastSpeed : 0);
  }

  /**
   * Refreshes the readouts. Cheap, and only the text nodes that changed.
   *
   * Driven off requestAnimationFrame rather than a timer so it stops with the
   * tab, and throttled to four a second because nobody reads a clock faster
   * than that and the string building is not free.
   */
  private tick = (): void => {
    const now = performance.now();
    if (now - this.ticked > 240) {
      this.ticked = now;
      const t = this.renderer.timeOfDay;
      const hh = Math.floor(t * 24), mm = Math.floor((t * 24 % 1) * 60);
      // The calendar is the city's: a year is four 28-day seasons, starting
      // in spring (March), so the months, the season and the year all follow
      // the simulated days -- they stop on pause and race at ten times.
      const day = this.renderer.calendarDay;
      const month = monthOf(day);
      const year = yearOf(day);
      const season = SEASONS[seasonOfMonth(month)];
      const temp = Math.round(temperature(day, t * 24, this.renderer.weather.sky));
      fill(this.readClock,
        `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
        + `<span style="color:${SKIN.dim};font-size:12px">`
        + `${MONTHS[month]} ${year}</span>`);
      fill(this.readSeason, `<span style="display:flex;color:${season.tint}">${glyph(season.glyph, 15)}</span>`
        + `${temp}\u00b0C<span style="color:${SKIN.dim};font-size:12px">`
        + `${season.name}</span>`);
      const w = this.renderer.weather;
      fill(this.readWeather, `<span style="display:flex;color:${SKIN.accent}">${glyph(w.glyph, 15)}</span>`
        + `<span style="font-size:11px">${w.label}</span>`);

      // People: what the simulation counts once it is running, and the capacity
      // the standing buildings hold before it is.
      const s = this.renderer.summary;
      const people = s.hasSim ? s.citizens : s.people;
      fill(this.readPeople, `${people.toLocaleString()}`
        + `<span style="color:${SKIN.dim};font-size:12px">`
        + `${s.buildings.toLocaleString()} building${s.buildings === 1 ? '' : 's'}</span>`);

      // And the money, at the end of the bar the player spends it from. The
      // weekly line under it is the one that decides whether the city lives:
      // a balance falling by nine thousand a week is a balance with a date on
      // it, and the colour says so before the number is read.
      this.paintProgress();
      const bal = Math.round(this.renderer.world.budget.balance);
      const net = Math.round(s.net);
      const tone = bal < 0 ? SKIN.bad : net < 0 ? SKIN.warn : SKIN.good;
      fill(this.readMoney,
        `<span style="color:${tone}">\u25cf</span>`
        + `${bal < 0 ? '\u2212' : ''}${money(Math.abs(bal))}`
        + (s.hasSim
          ? `<span style="color:${net < 0 ? SKIN.bad : SKIN.dim};font-size:12px">`
            + `${net < 0 ? '\u2212' : '+'}${money(Math.abs(net))}/wk</span>`
          : ''));
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  /**
   * The drawer of one branch's buildings.
   *
   * Each entry is the building itself -- rendered through the game's own
   * shader, see tools/icon-sheet.mjs -- above its name and its footprint in
   * cells. The footprint is on the button because it is the single fact that
   * decides whether the thing will fit where the player is looking, and
   * finding that out by clicking is the frustrating way to find it out.
   */
  private openDrawer(branch: Branch, list: Proto[], bar: HTMLElement): void {
    const style = BRANCH_STYLE[branch];
    const panel = this.drawerPanel(branch, style.colour);

    for (const p of list) {
      panel.appendChild(this.tile(p.id, p.def.name, `${p.w}\u00d7${p.d}`,
        buildingPrice(p.def), style.colour, p.def.note,
        () => this.select({ kind: 'place', proto: p })));
    }
    void bar;
    this.mount(panel, branch);
  }

  /**
   * One thing you can place: its picture, its name, its size and its price.
   *
   * The price is the point. Without one the drawer is a list of shapes and
   * every choice in it is free, which is not a choice.
   */
  private tile(id: string | null, name: string, size: string, cost: number,
    accent: string, note: string, onPick: () => void,
    glyph?: string, per = '', badge = '', locked = false): HTMLElement {
    const b = document.createElement('button');
    b.title = note;
    if (badge !== '') b.style.position = 'relative';
    const rest = ['border:1px solid rgba(255,255,255,.06)', `background:${WELL}`];
    b.style.cssText = [
      'display:flex', 'flex-direction:column', 'align-items:center', 'gap:2px',
      'padding:7px 4px', 'border-radius:10px', ...rest,
      'color:#c8d4e4', 'cursor:pointer',
      'font:600 12px/1.3 var(--ui, system-ui, sans-serif)', 'text-align:center',
    ].join(';');
    if (glyph !== undefined) {
      const g = document.createElement('span');
      g.innerHTML = glyph;
      g.style.cssText = `${GLYPH};height:52px;align-items:center`;
      b.appendChild(g);
    } else if (id !== null && id !== '') {
      b.appendChild(assetIcon(id, 52));
    } else {
      const g = document.createElement('span');
      g.style.cssText = `display:block;width:52px;height:52px;border-radius:10px;`
        + `background:${accent}33;border:1px solid ${accent}66`;
      b.appendChild(g);
    }
    const label = document.createElement('span');
    label.textContent = name;
    const meta = document.createElement('span');
    // The price, and nothing else. The footprint used to sit beside it as
    // "4x3", which is a number a player has to convert into a picture -- and
    // the picture is already right there above it, drawn to scale.
    void size;
    meta.innerHTML = `<span style="color:#8fe0a8;font-variant-numeric:tabular-nums">`
      + `${cost === 0 ? 'Free' : money(cost)}</span>`
      + (per === '' || cost === 0 ? '' : `<span style="opacity:.45"> ${per}</span>`);
    b.append(label, meta);
    // The theme's abbreviation, in a black block on the picture.
    //
    // Six tiles of low-density housing differ by what they are made of, which
    // a 52-pixel picture shows but does not name. The block names it without
    // taking a line of the tile, and it reads at a glance once a player has
    // learned three of them -- which is the whole job of an abbreviation.
    if (badge !== '') {
      const tag = document.createElement('span');
      tag.textContent = badge;
      tag.style.cssText = [
        'position:absolute', 'left:5px', 'top:5px', 'padding:1px 4px',
        'border-radius:4px', 'background:rgba(0,0,0,.82)', 'color:#e8f0fa',
        'font:700 10.5px/1.5 var(--ui, system-ui, sans-serif)', 'letter-spacing:.08em',
        'pointer-events:none',
      ].join(';');
      b.appendChild(tag);
    }
    b.addEventListener('mouseenter', () => {
      b.style.borderColor = `${accent}99`;
      b.style.background = 'rgba(255,255,255,.05)';
    });
    b.addEventListener('mouseleave', () => {
      b.style.borderColor = 'rgba(255,255,255,.06)';
      b.style.background = WELL;
    });
    // Locked: the tile still shows what it is -- a player has to be able to see
    // what they are working towards -- but it is drawn as a silhouette with a
    // padlock on it, and clicking it says where it is unlocked rather than
    // quietly doing nothing.
    // A tile locked by the city's level rather than by the development tree.
    // Same treatment -- a player has to be able to see what they are working
    // towards -- and the click says where it opens.
    if (locked) {
      b.style.filter = 'grayscale(1)';
      b.style.opacity = '0.55';
      b.style.position = 'relative';
      const pad = document.createElement('span');
      pad.innerHTML = pictogram('lock', 14);
      pad.style.color = 'var(--amber)';
      pad.style.cssText = [
        'position:absolute', 'right:6px', 'top:6px', 'font-size:12px',
        'pointer-events:none', 'filter:grayscale(0)', 'opacity:.9',
      ].join(';');
      b.appendChild(pad);
    }
    if (id !== null && id !== '' && !this.unlocked(id)) {
      b.style.filter = 'grayscale(1)';
      b.style.opacity = '0.55';
      b.style.position = 'relative';
      const lock = document.createElement('span');
      lock.innerHTML = pictogram('lock', 14);
      lock.style.color = 'var(--amber)';
      lock.style.cssText = [
        'position:absolute', 'right:6px', 'top:6px', 'font-size:12px',
        'pointer-events:none', 'filter:grayscale(0)', 'opacity:.9',
      ].join(';');
      b.appendChild(lock);
      const node = NODE_OF_ASSET.get(id);
      b.addEventListener('click', () => {
        denySound();
        this.say(assetById(id)?.signature === true
          ? `${name} is a landmark \u2014 reach the level that hands it over`
          : `${name} needs \u2605 ${node?.cost ?? 1} in Development`);
      });
      return b;
    }
    b.addEventListener('click', onPick);
    return b;
  }

  /**
   * The road classes, as a drawer.
   *
   * The drag/curve choice lives here too, at the top, because it belongs to
   * the road you are about to draw rather than to the bar.
   */
  private openRoadDrawer(): void {
    const accent = ZONE_STYLE.road.base;
    const panel = this.drawerPanel('roads', accent);
    panel.style.gridTemplateColumns = 'repeat(auto-fill,minmax(108px,1fr))';
    panel.appendChild(this.tabs([
      { key: 'road', label: 'Straight & dragged', on: this.roadMode === 'road' },
      { key: 'curve', label: 'Curved', on: this.roadMode === 'curve' },
      { key: 'upgrade', label: 'Upgrade', on: this.roadMode === 'upgrade' },
    ], accent, (key) => {
      this.roadMode = key as 'road' | 'curve' | 'upgrade';
      this.openRoadDrawer();
    }));
    if (this.roadMode !== 'upgrade') {
      // How high it goes. A road drawn out of a street at a height ramps up
      // from the street; one drawn across another at a height passes over it.
      panel.appendChild(this.tabs(ELEVATIONS.map((m, i) => ({
        key: String(i), label: m === 0 ? 'Ground' : `Viaduct ${m} m`, on: i === this.elevation,
      })), accent, (key) => { this.setElevation(Number(key)); this.openRoadDrawer(); }));
    }
    for (const cls of ROAD_ORDER) {
      const spec = ROAD_SPECS[cls];
      const lanes = spec.oneWay ? spec.lanes : spec.lanes * 2;
      const up = this.roadMode === 'upgrade';
      panel.appendChild(this.tile(null, spec.label,
        `${lanes} lane${lanes === 1 ? '' : 's'}`, up ? roadPrice(cls) : this.roadCost(cls), accent,
        up ? `Convert what you drag over to a ${spec.label.toLowerCase()}`
          : `${spec.label} — ${Math.round(spec.edge * 2)} m of corridor`,
        () => this.select({ kind: this.roadMode, cls }),
        roadGlyph(cls, 48), 'a metre'));
    }
    this.mount(panel, 'roads');
  }

  /**
   * Every landmark there is only one of, by what it is.
   *
   * Forty-five of them in one scrolling list is a catalogue, and looking for
   * the concert hall meant reading past nine apartment blocks and a dozen
   * factories. They are already sorted into the four zones by the registry --
   * the drawer just has to say so, and put a tab on each.
   */
  private openSignatureDrawer(zone: SignatureZone = this.sigTab): void {
    this.sigTab = zone;
    const accent = '#ffd166';
    const panel = this.drawerPanel('signature', accent);
    const tabs: { key: string; label: string; on: boolean }[] = SIGNATURE_ZONES.map((z) => ({
      key: z, label: ZONE_STYLE[z].label, on: z === zone,
    }));
    if (modBuildings.length > 0) tabs.push({ key: 'mods', label: `Mods \u00b7 ${modBuildings.length}`, on: zone === 'mods' });
    panel.appendChild(this.tabs(tabs, accent, (key) => this.openSignatureDrawer(key as SignatureZone)));
    if (zone === 'mods') {
      for (const p of modBuildings) {
        panel.appendChild(this.tile(p.id, p.def.name, `${p.w}\u00d7${p.d}`,
          buildingPrice(p.def), accent, `${p.def.note ?? ''} From a mod: always open, and it raises land value around it.`.trim(),
          () => this.select({ kind: 'place', proto: p }), modelIconHtml(p.def, 52)));
      }
    }
    for (const p of SIGNATURES) {
      if (p.def.zone !== zone) continue;
      panel.appendChild(this.tile(p.id, p.def.name, `${p.w}\u00d7${p.d}`,
        buildingPrice(p.def), accent,
        `${p.def.note ?? ''} Landmark: raises land value for about 300 m around it${p.def.zone === 'residential' ? '' : ' and draws visitors'}.`.trim(),
        () => this.select({ kind: 'place', proto: p })));
    }
    this.mount(panel, 'signature');
  }

  /** A row of tabs across the top of a drawer. */
  private tabs(items: readonly { key: string; label: string; on: boolean }[],
    accent: string, onPick: (key: string) => void): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = [
      'grid-column:1/-1', 'display:flex', 'flex-wrap:wrap', 'gap:4px',
      'padding-bottom:8px', 'margin-bottom:2px',
      'border-bottom:1px solid rgba(255,255,255,.07)',
    ].join(';');
    for (const it of items) {
      const t = document.createElement('button');
      t.textContent = it.label;
      t.style.cssText = [
        'height:28px', 'padding:0 12px', 'border-radius:8px', 'cursor:pointer',
        `border:1px solid ${it.on ? accent + '99' : 'rgba(255,255,255,.07)'}`,
        `background:${it.on ? accent + '26' : 'rgba(255,255,255,.03)'}`,
        `color:${it.on ? '#eef4fb' : '#9fb2c9'}`,
        'font:600 11px/1 var(--ui, system-ui, sans-serif)',
      ].join(';');
      t.addEventListener('click', (e) => { e.stopPropagation(); onPick(it.key); });
      row.appendChild(t);
    }
    return row;
  }

  /** Puts a finished drawer on screen and lights its category. */
  private mount(panel: HTMLElement, key: string): void {
    this.foot.insertBefore(panel, this.foot.firstChild);
    this.drawer = panel;
    for (const el of this.buttons) {
      if (el.dataset.branch === key) el.classList.add('is-open');
    }
  }

  /** The shell every drawer sits in. */
  private drawerPanel(key: string, accent: string): HTMLElement {
    this.closeDrawer();
    const panel = document.createElement('div');
    panel.dataset.branch = key;
    panel.style.cssText = [
      'display:grid', 'grid-template-columns:repeat(auto-fill,minmax(96px,1fr))',
      'gap:5px', 'padding:10px', 'border-radius:14px', 'width:min(1100px,94vw)',
      'max-height:46vh', 'overflow-y:auto',
      `background:${PANEL}`, `border:1px solid ${accent}55`,
      'box-shadow:0 10px 34px rgba(0,0,0,.5)',
      'backdrop-filter:blur(14px)', 'z-index:6', 'pointer-events:auto',
    ].join(';');
    panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    return panel;
  }

  /**
   * One zone, as three densities of what actually grows there -- in each of
   * the regional styles that builds it.
   *
   * Three tiles reading "low residential", "medium residential", "high
   * residential" name a category three times. But low-density residential is
   * not one thing: it is a European brick street, an American timber suburb,
   * an Asian render-and-tile block, a farming hamlet or a modern estate, and
   * which one you get was decided by where on the map you happened to paint.
   * That is a fine default and a bad only option, so the theme is a tile now.
   *
   * The first tile of each band is still the default -- let the district
   * decide -- because a player who does not care should not have to choose,
   * and a city where every quarter was chosen deliberately looks designed
   * rather than grown.
   */
  private openZoneDrawer(zone: IconZone): void {
    this.zoneTab = zone;
    const style = ZONE_STYLE[zone];
    const accent = style.base;
    const panel = this.drawerPanel('zones', accent);
    panel.appendChild(this.tabs(ZONES.map((z) => ({
      key: z, label: ZONE_STYLE[z as IconZone].label, on: z === zone,
    })), accent, (key) => this.openZoneDrawer(key as IconZone)));

    // Parkland builds nothing, so it has nothing to show six ways.
    const themed = zone !== 'nature' && zone !== 'road' && zone !== 'service';
    for (const density of DENSITIES) {
      const price = zonePrice(zone as Zone, density);
      // Medium and high density arrive with the city, and so do offices. See
      // `zoneNeeds`.
      const needs = zoneNeeds(zone, density);
      const open = this.renderer.world.progress.level >= needs;
      if (themed) panel.appendChild(this.band(`${density} ${style.label}`));
      panel.appendChild(this.tile(zoneSpecimen(zone, density),
        themed ? 'Whichever' : `${density} ${zone}`, 'per cell', price, accent,
        `${style.blurb} Zoned for ${density} density, in whatever style the`
        + ' district around it is growing in.',
        open
          ? () => this.select({ kind: 'zone', zone: zone as Zone, density })
          : () => {
            denySound();
            this.say(zone === 'office' && needs > (DENSITY_LEVEL[density] ?? 1)
              ? `offices open at level ${needs}, ${levelName(needs)}`
              : `${density} density opens at level ${needs}`);
          },
        undefined, '', themed ? 'ANY' : '', !open));
      if (!themed) continue;
      for (const theme of ALL_THEMES) {
        if (!hasSpecimen(zone, density, theme)) continue;
        const profile = THEMES[theme];
        panel.appendChild(this.tile(zoneSpecimen(zone, density, theme),
          profile.label, 'per cell', price, accent,
          `${style.blurb} Zoned for ${density} density in the ${profile.label} style.`,
          open
            ? () => this.select({ kind: 'zone', zone: zone as Zone, density, theme })
            : () => { denySound(); this.say(`opens at level ${needs}, ${levelName(needs)}`); },
          undefined, '', profile.badge, !open));
      }
    }
    this.mount(panel, 'zones');
  }

  /** A full-width heading inside a drawer's grid. */
  private band(label: string): HTMLElement {
    const el = document.createElement('div');
    el.textContent = label;
    el.style.cssText = [
      'grid-column:1/-1', 'padding:8px 2px 2px', 'color:#7f93ab',
      'font:700 11px/1.2 var(--ui, system-ui, sans-serif)',
      'letter-spacing:.14em', 'text-transform:uppercase',
    ].join(';');
    return el;
  }

  private closeDrawer(): void {
    this.drawer?.remove();
    this.drawer = null;
    // And take the open-drawer highlight off whichever category had it.
    // Without this, opening a second drawer left the first one still lit and
    // the bar claimed two categories were open at once.
    for (const el of this.buttons) {
      el.classList.remove('is-open');
    }
  }

  private styleStatus(): void {
    this.status.className = 'mr-hint';
    this.say(this.describe(this.tool));
  }

  private say(text: string): void {
    this.status.textContent = text;
  }

  /**
   * Pays for something, or says why not.
   *
   * Every tool goes through here, because a price that nothing checks is a
   * label. The refusal names the figure and the shortfall: "you cannot afford
   * this" is a dead end, and "24k, and you are 9k short" is a plan.
   */
  /**
   * Whether the city has learned to build this.
   *
   * Zoning and roads are never gated -- a city builder that will not let you
   * draw a street is not a city builder -- so this only ever refuses a service
   * building or a landmark, and it says which panel opens it.
   */
  private unlocked(id: string): boolean {
    const p = this.renderer.world.progress;
    const def = assetById(id);
    if (def === undefined) return true;
    // A mod's buildings are the player's own content: open from the start.
    if (def.mod !== undefined) return true;
    if (def.signature === true) return p.earned.has(id);
    const node = NODE_OF_ASSET.get(id);
    if (node === undefined) return true;
    if (p.level < branchLevel(node.branch)) return false;
    return node.free || p.has(node.id);
  }

  /** Books experience for something the player built, and shows any level. */
  private earn(price: number, signature: boolean): void {
    const p = this.renderer.world.progress;
    const levels = p.add(p.forBuilding(price, signature),
      signature ? 'landmark' : 'build', landmarksForLevel);
    if (levels.length > 0) this.onLevels?.(levels);
    this.onProgress?.();
  }

  private afford(cost: number, what: string): boolean {
    const budget = this.renderer.world.budget;
    if (budget.spend(cost)) return true;
    deny();
    const short = cost - (budget.balance + OVERDRAFT);
    this.say(`${what} costs ${money(Math.round(cost))} — `
      + `${money(Math.round(short))} more than the city can borrow`);
    return false;
  }

  /**
   * Upgrades a placed service building by one tier: pays, builds the wing,
   * rebuilds the ground round it. Returns null, or why not -- which has also
   * been said to the player.
   */
  upgrade(lot: Lot): string | null {
    const world = this.renderer.world;
    const def = assetById(lot.id);
    if (def === undefined) return 'no such building';
    const next = nextWing(world, lot);
    if (next.why !== null) { deny(); this.say(`cannot upgrade the ${def.name.toLowerCase()}: ${next.why}`); return next.why; }
    const tier = (lot.tier ?? 0) + 1;
    if (!this.afford(buildingPrice(def) * TIER_PRICE[tier], `Upgrading the ${def.name.toLowerCase()}`)) return 'cannot afford it';
    const why = upgradeLot(world, lot);
    if (why !== null) { this.refund(buildingPrice(def) * TIER_PRICE[tier]); this.say(why); return why; }
    confirmSound();
    const wing = wingOfLot(world, lot);
    const x0 = Math.min(lot.gx, wing?.gx ?? lot.gx), z0 = Math.min(lot.gz, wing?.gz ?? lot.gz);
    const x1 = Math.max(lot.gx + lot.w, (wing?.gx ?? 0) + (wing?.w ?? 0));
    const z1 = Math.max(lot.gz + lot.d, (wing?.gz ?? 0) + (wing?.d ?? 0));
    this.rebuild({ gx: x0 - 2, gz: z0 - 2, w: x1 - x0 + 4, d: z1 - z0 + 4 });
    this.say(`the ${def.name.toLowerCase()} is ${tier === 1 ? 'extended' : 'now a flagship'}`);
    return null;
  }

  /** Gives money back, for an edit that undoes a purchase. */
  private refund(amount: number): void {
    this.renderer.world.budget.credit(Math.max(0, Math.round(amount)));
  }
}

/**
 * One road class, drawn as what it is: a section through it.
 *
 * Eight road buttons carrying the same picture of a road tell a player
 * nothing. This draws the carriageway to scale against the widest class, with
 * a divider per lane, a reservation where there is one and rails where there
 * is a tram -- so the difference between a lane and a dual carriageway is the
 * thing you can see, which is exactly the difference you are choosing.
 */
function roadGlyph(cls: RoadClass, size = 28): string {
  const spec = ROAD_SPECS[cls];
  const widest = Math.max(...ROAD_ORDER.map((c) => ROAD_SPECS[c].half));
  // Tarmac dark against the bar and the paint bright on it, which is the way
  // round a road actually is. The first attempt drew the carriageway in the
  // button's own colour at a fifth opacity and every class came out as the
  // same grey smudge.
  const w = 7 + (spec.half / widest) * 15;
  const x0 = 14 - w / 2;
  // The surface, because widths alone stopped telling these apart once there
  // were nineteen of them: a four-metre gravel track and a four-metre setted
  // alley are the same rectangle until the fill says which is which.
  const FILL: Record<string, string> = {
    tarmac: '#11161d', gravel: '#2b2620', setts: '#232630', concrete: '#2c2e2c',
  };
  const parts: string[] = [
    `<rect x="${x0.toFixed(2)}" y="3" width="${w.toFixed(2)}" height="22" rx="1.5"`
    + ` fill="${FILL[spec.surface] ?? FILL.tarmac}" stroke="currentColor"`
    + ' stroke-opacity=".45" stroke-width="1"/>',
  ];
  if (spec.surface === 'setts') {
    // Courses across the way, which is how setts are laid and the quickest
    // read there is that this is not tarmac.
    for (let y = 5.5; y < 24; y += 2.6) {
      parts.push(`<line x1="${x0.toFixed(2)}" y1="${y.toFixed(1)}"`
        + ` x2="${(x0 + w).toFixed(2)}" y2="${y.toFixed(1)}"`
        + ' stroke="#9fb0c6" stroke-opacity=".28" stroke-width=".7"/>');
    }
  } else if (spec.surface === 'gravel') {
    for (let i = 0; i < 14; i++) {
      const gx = x0 + ((i * 7 + 3) % 10) / 10 * w;
      const gy = 4.5 + ((i * 13 + 5) % 19);
      parts.push(`<circle cx="${gx.toFixed(2)}" cy="${gy.toFixed(1)}" r=".55"`
        + ' fill="#b7a487" fill-opacity=".45"/>');
    }
  } else if (spec.surface === 'concrete') {
    for (let y = 8; y < 24; y += 6) {
      parts.push(`<line x1="${x0.toFixed(2)}" y1="${y}" x2="${(x0 + w).toFixed(2)}" y2="${y}"`
        + ' stroke="#9fb0c6" stroke-opacity=".34" stroke-width=".9"/>');
    }
  }
  // Cycle tracks, in the colour a real one is surfaced.
  if (spec.cycle > 0) {
    const cw = Math.max(1.4, (spec.cycle * 2 / spec.half) * w * 0.5);
    for (const side of [-1, 1]) {
      const cx = 14 + side * (w / 2 - cw / 2);
      parts.push(`<rect x="${(cx - cw / 2).toFixed(2)}" y="3.6" width="${cw.toFixed(2)}"`
        + ' height="20.8" fill="#c2503a" fill-opacity=".62"/>');
    }
  }
  const each = w / (spec.oneWay ? spec.lanes : spec.lanes * 2);
  for (let i = 1; i < (spec.oneWay ? spec.lanes : spec.lanes * 2); i++) {
    const mid = !spec.oneWay && i === spec.lanes;
    if (mid && spec.median) continue;
    const x = (x0 + i * each).toFixed(2);
    parts.push(`<line x1="${x}" y1="4.5" x2="${x}" y2="23.5" stroke="#e8eef6"`
      + ` stroke-opacity="${mid ? '.95' : '.62'}" stroke-width="${mid ? 1.2 : 1}"`
      + ` ${mid ? '' : 'stroke-dasharray="2.6 2.6"'}/>`);
  }
  // The reservation, and the arrow that says a street runs one way.
  if (spec.median) {
    parts.push('<rect x="13" y="4" width="2" height="20" rx="1" fill="#8fe3ff" fill-opacity=".85"/>');
  }
  if (spec.oneWay) {
    parts.push('<path d="M14 20 L14 8 M11.4 10.6 L14 8 L16.6 10.6" stroke="#ffd166"'
      + ' stroke-opacity=".95" stroke-width="1.3" fill="none" stroke-linecap="round"/>');
  }
  if (spec.tram) {
    for (const x of [14 - w / 5, 14 + w / 5]) {
      parts.push(`<line x1="${x.toFixed(2)}" y1="4" x2="${x.toFixed(2)}" y2="24"`
        + ' stroke="#8fe3ff" stroke-opacity=".95" stroke-width="1.5"/>');
    }
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 28 28" fill="none">`
    + `${parts.join('')}</svg>`;
}

/**
 * How a glyph sits on its tile: floating a little above it.
 *
 * A drop shadow under a flat icon is the cheapest depth cue there is, and on a
 * lit tile it is the one that sells the whole thing -- without it the icon is
 * printed on the key rather than standing on it.
 */
/**
 * The speeds on the bar, as multiples of real time.
 *
 * Three and ten rather than two and four: a game day is ninety seconds, so a
 * player who wants to watch a district fill wants an order of magnitude, not a
 * nudge. Zero is a pause, and it is first because that is where every game puts
 * it and where the hand goes.
 */
const SPEEDS = [0, 1, 3, 10] as const;

/** Circumference of the level dial's ring, radius 12. */
const DIAL = 2 * Math.PI * 12;

const GLYPH = 'display:flex;filter:drop-shadow(0 1.5px 1.5px rgba(0,0,0,.55))';

/**
 * Writes into a status cell's value row.
 *
 * Every cell on the bar is a caption over a value, so everything that updates
 * one is writing into its second child. One function, because this was four
 * copies of `children[1] as HTMLElement` and the fifth would have been wrong.
 */
function fill(cell: HTMLElement, html: string): void {
  const row = cell.children[1] as HTMLElement | undefined;
  if (row !== undefined) row.innerHTML = html;
}

/**
 * The zoning icon: the four zones as one square, quartered.
 *
 * A category icon has to say what is behind it, and what is behind this one is
 * four colours the player is going to spend the rest of the game reading off
 * the map. Showing them together on the button is the cheapest possible
 * legend, and it is always in the same place.
 */
function zoneSwatch(): HTMLElement {
  const el = document.createElement('span');
  el.className = 'mr-swatch';
  const quads: IconZone[] = ['residential', 'commercial', 'industrial', 'office'];
  el.style.cssText = [
    'display:grid', 'grid-template-columns:1fr 1fr', 'grid-template-rows:1fr 1fr',
    'gap:2px', 'width:22px', 'height:22px',
  ].join(';');
  for (const z of quads) {
    const q = document.createElement('i');
    const c = ZONE_STYLE[z].base;
    q.style.cssText = `display:block;border-radius:2.5px;background:`
      + `linear-gradient(160deg,${ZONE_STYLE[z].light},${c});`
      + `box-shadow:inset 0 1px 0 rgba(255,255,255,.35)`;
    el.appendChild(q);
  }
  return el;
}

