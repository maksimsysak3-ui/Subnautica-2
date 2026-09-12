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

import type { Renderer } from '../gfx/renderer';
import type { Camera } from '../gfx/camera';
import type { Vec3 } from '../math/m4';
import { heightAt, baseHeightAt, previewRoad } from '../sim';
import { paint, demolish, zoneCode, lotFits, placeLot, ZONES, DENSITIES } from '../sim';
import { services, signatures, ASSET_INDEX } from '../sim';

import type { RoadClass, Proto } from '../sim';
import { ROAD_SPECS, ROAD_ORDER } from '../sim';
import { ZONE_STYLE, zoneIcon } from './zones';
import { assetIcon, zoneSpecimen, hasSpecimen } from './icons';
import { plotAt, plotSpan, plotBounds, ownsCells, ownsAt } from '../sim';
import type { Dirty } from '../sim';
import { ALL_THEMES, THEMES } from '../assets/themes';
import type { Theme } from '../assets/themes';
import { saveFromGame } from './menu';
import { buildingPrice, roadPrice, zonePrice, money } from '../sim';
import { BRANCHES } from '../assets/types';
import type { Branch, Density, Zone } from '../assets/types';
import type { IconZone } from './zones';

/** Metres per zoning cell. */
const CELL = 8;

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
/** Season by quarter, with the day's temperature range it swings between. */
const SEASONS = [
  { name: 'Winter', glyph: '❄', tint: '#8fc7ff', low: -1, high: 5 },
  { name: 'Spring', glyph: '❀', tint: '#8fe0a8', low: 6, high: 15 },
  { name: 'Summer', glyph: '☀', tint: '#ffd166', low: 14, high: 26 },
  { name: 'Autumn', glyph: '☂', tint: '#e8a35a', low: 5, high: 14 },
];

type Tool =
  | { kind: 'look' }
  | { kind: 'road'; cls: RoadClass }
  | { kind: 'curve'; cls: RoadClass }
  /** `theme` undefined means whatever the district around it grows. */
  | { kind: 'zone'; zone: Zone; density: Density; theme?: Theme }
  | { kind: 'place'; proto: Proto }
  | { kind: 'clear' }
  /** Buying land: an overhead view of the plot grid, one click a plot. */
  | { kind: 'land' };

/** How long after a click its second half still counts as a double-click. */
const DOUBLE = 450;

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
  power: { label: 'Power', colour: '#e5d14a' },
  transport: { label: 'Transport', colour: '#8f7ce8' },
  government: { label: 'Civic', colour: '#c8ccd6' },
  parks: { label: 'Parks', colour: '#63c96a' },
  deathcare: { label: 'Deathcare', colour: '#9aa6b8' },
  post: { label: 'Post', colour: '#d98f5a' },
};

/** The zones a landmark can belong to, in the order their tabs read. */
const SIGNATURE_ZONES = ['residential', 'commercial', 'office', 'industrial'] as const;
type SignatureZone = (typeof SIGNATURE_ZONES)[number];

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
  private curveAt = 0;
  /** Which of the two road tools the class buttons select. */
  private roadMode: 'road' | 'curve' = 'road';
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
    this.readName.innerHTML = '<span style="color:#7fd4a8">\u25c6</span>'
      + `<span style="color:#dbe6f3;letter-spacing:.06em">${escapeText(this.name)}</span>`;
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

  private onDown = (e: PointerEvent): void => {
    if (!this.active || e.button !== 0) return;
    const cell = this.pick(e.clientX, e.clientY);
    if (!cell) return;
    e.stopPropagation();
    if (this.tool.kind === 'land') { this.buyLand(cell); return; }
    if (this.tool.kind === 'curve') { this.curveClick(cell); return; }
    if (this.tool.kind === 'place') { this.dropLot(cell); return; }
    this.from = cell;
    this.to = cell;
    this.path = [cell];
    this.showMark();
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.active) return;
    const cell = this.pick(e.clientX, e.clientY);
    if (!cell) return;
    this.to = cell;
    if (this.tool.kind === 'land') { this.hoverLand(cell); return; }
    if (this.from) {
      e.stopPropagation();
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
    this.from = null;
    this.renderer.mark = null;
    this.renderer.setRoadPreview(null);
  };

  private onKey = (e: KeyboardEvent): void => {
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
    this.from = null;
    this.select({ kind: 'look' });
  };

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
    const why = placeLot(world, t.proto.id, gx, gz, this.placeYaw, baseHeightAt);
    if (why !== null) { this.say(`cannot place the ${t.proto.def.name.toLowerCase()}: ${why}`); return; }
    const [w, d] = this.placeYaw % 2 === 0
      ? [t.proto.w, t.proto.d] : [t.proto.d, t.proto.w];
    this.rebuild({ gx: gx - 2, gz: gz - 2, w: w + 4, d: d + 4 });
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
    return previewRoad(world.grid, ax, az, bx, bz, t.cls, 0, baseHeightAt, mid);
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
    this.clearUnder(a, b, via, bend);
    world.net.add(ax, az, bx, bz, t.cls, bend, via === null ? null : this.metres(via));
    // The chord and the bend both, since a curve leaves the straight line
    // between its ends by as much as the player pulled it.
    const swing = Math.abs(bend) + 8;
    this.rebuild(this.box(
      Math.min(ax, bx) - swing, Math.min(az, bz) - swing,
      Math.max(ax, bx) + swing, Math.max(az, bz) + swing, 3));
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
    this.say(`rebuilt in ${(performance.now() - started).toFixed(0)} ms`);
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
    } else if (t.kind === 'zone') {
      if (!ownsCells(world.land, world.grid, r.gx, r.gz, r.w, r.d)) {
        this.say('you do not own all of that land — buy it with the land tool');
        return;
      }
      paint(world, r.gx, r.gz, r.w, r.d, zoneCode(t.zone, t.density, t.theme));
    } else if (t.kind === 'clear') {
      demolish(world, r.gx, r.gz, r.w, r.d);
    } else {
      return;
    }
    this.rebuild({ gx: r.gx - 2, gz: r.gz - 2, w: r.w + 4, d: r.d + 4 });
  }

  // ---- the bar ---------------------------------------------------------

  private select(tool: Tool): void {
    // The land tool owns the camera while it is up, so entering and leaving it
    // is part of selecting it rather than something the caller remembers.
    if ((tool.kind === 'land') !== (this.tool.kind === 'land')) {
      this.enterLand(tool.kind === 'land');
    }
    this.tool = tool;
    this.from = null;
    this.curveA = null;
    this.curveVia = null;
    this.curveStage = 'none';
    if (tool.kind === 'road' || tool.kind === 'curve') this.roadMode = tool.kind;
    this.closeDrawer();
    this.showMark();
    // Selected reads as pressed in: the light moves to the bottom, the
    // shadow goes inside, and the tile sits a pixel low. Nothing else on a
    // physical panel looks like that, so it is unmistakable at a glance.
    for (const el of this.buttons) {
      const on = el.dataset.tool === this.key(tool);
      el.dataset.on = on ? '1' : '';
      el.style.transform = on ? 'translateY(1px)' : 'translateY(0)';
      el.style.borderColor = on ? 'rgba(120,214,255,.5)' : 'rgba(255,255,255,.07)';
      el.style.background = on
        ? 'linear-gradient(177deg,rgba(60,150,190,.34),rgba(98,212,255,.14))'
        : 'linear-gradient(177deg,rgba(255,255,255,.085),rgba(255,255,255,.012) 46%,'
          + 'rgba(0,0,0,.20))';
      el.style.boxShadow = on
        ? 'inset 0 2px 6px rgba(0,0,0,.55), inset 0 -1px 0 rgba(255,255,255,.14),'
          + '0 0 12px rgba(98,212,255,.25)'
        : 'inset 0 1px 0 rgba(255,255,255,.16), inset 0 -1px 0 rgba(0,0,0,.42),'
          + '0 2px 4px rgba(0,0,0,.42)';
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
    return t.kind;
  }

  private describe(t: Tool): string {
    if (t.kind === 'look') return 'drag to pan, right-drag to orbit, wheel to zoom';
    if (t.kind === 'road') {
      return `drag to lay a ${ROAD_SPECS[t.cls].label} (${money(roadPrice(t.cls))}/m) `
        + '— sweep the drag to curve it; it will cross and join what is there';
    }
    if (t.kind === 'curve') {
      return `click to start a ${ROAD_SPECS[t.cls].label}, click where it bends, `
        + 'click where it ends — double-click to finish the run';
    }
    if (t.kind === 'place') {
      const [w, d] = this.placeYaw % 2 === 0 ? [t.proto.w, t.proto.d] : [t.proto.d, t.proto.w];
      return `click to place the ${t.proto.def.name.toLowerCase()} `
        + `— ${money(buildingPrice(t.proto.def))}, ${w}\u00d7${d} cells `
        + `(${w * 8}\u00d7${d * 8} m) — R rotates`;
    }
    if (t.kind === 'land') {
      const land = this.renderer.world.land;
      return `click a dashed plot to buy it — ${land.count} owned, `
        + `next ${money(land.price())}`;
    }
    if (t.kind === 'zone') {
      const style = t.theme === undefined ? '' : ` in the ${THEMES[t.theme].label} style`;
      return `drag to zone ${t.density} ${t.zone}${style} `
        + `(${money(zonePrice(t.zone, t.density))} a cell)`;
    }
    return 'drag to clear roads and zoning';
  }

  private buttons: HTMLElement[] = [];

  private buildBar(): HTMLElement {
    // The shell: one dark slab with a tool row above a status row, the way a
    // city builder's bar is always laid out. What a player reaches for is on
    // top where the pointer already is; what they only read sits below it.
    const bar = document.createElement('div');
    bar.style.cssText = [
      'display:flex', 'flex-direction:column', 'gap:0',
      'width:calc(100vw - 20px)', 'border-radius:14px', 'overflow:hidden',
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
      'justify-content:center', 'gap:6px', 'padding:7px 9px',
    ].join(';');

    const group = (): HTMLElement => {
      // Each group is its own recessed pill, which is what separates roads
      // from zones from services without a row of hairlines doing it.
      const g = document.createElement('div');
      g.style.cssText = [
        'display:flex', 'flex-wrap:wrap', 'justify-content:center', 'gap:3px',
        'padding:3px', 'border-radius:11px', `background:${WELL}`,
        'border:1px solid rgba(255,255,255,.045)',
      ].join(';');
      return g;
    };
    /**
     * Every button on the bar is this shape: a square the size of a fingertip,
     * holding a picture and nothing else.
     *
     * Labels were the first attempt and they made the bar four hundred pixels
     * tall -- twenty-seven buttons each carrying a word wrap onto six rows,
     * and six rows of toolbar is a menu, not a bar. The name lives in the
     * tooltip and in the status line under the cursor instead, which is where
     * every builder puts it.
     */
    const chip = (el: HTMLElement, colour: string): void => {
      // A key, not a square. The depth is three cheap tricks stacked: a
      // top-lit gradient so the face is brighter where a light above it would
      // catch, a hairline highlight along the top edge and a dark one along
      // the bottom, and a drop shadow under the whole thing. Together those
      // are what the eye reads as a raised object -- and pressing it moves it
      // down a pixel and shortens the shadow, which is the other half.
      el.style.cssText = [
        'display:flex', 'align-items:center', 'justify-content:center',
        'width:42px', 'height:42px', 'padding:0', 'border-radius:11px',
        'border:1px solid rgba(255,255,255,.07)',
        'background:linear-gradient(177deg,rgba(255,255,255,.085),rgba(255,255,255,.012) 46%,'
          + 'rgba(0,0,0,.20))',
        'box-shadow:inset 0 1px 0 rgba(255,255,255,.16),'
          + 'inset 0 -1px 0 rgba(0,0,0,.42), 0 2px 4px rgba(0,0,0,.42)',
        `color:${colour}`, 'cursor:pointer', 'position:relative',
        'font:600 10px/1 var(--ui, system-ui, sans-serif)',
        'transition:transform .1s, box-shadow .1s, background .12s, border-color .12s',
      ].join(';');
      // The glyph sits above the face rather than being printed on it.
      el.style.setProperty('--lift', '0px');
      const raise = (on: boolean): void => {
        if (el.dataset.on) return;
        el.style.transform = on ? 'translateY(-1px)' : 'translateY(0)';
        el.style.boxShadow = on
          ? 'inset 0 1px 0 rgba(255,255,255,.22), inset 0 -1px 0 rgba(0,0,0,.42),'
            + `0 4px 8px rgba(0,0,0,.5), 0 0 0 1px ${colour}33`
          : 'inset 0 1px 0 rgba(255,255,255,.16), inset 0 -1px 0 rgba(0,0,0,.42),'
            + '0 2px 4px rgba(0,0,0,.42)';
      };
      el.addEventListener('pointerenter', () => raise(true));
      el.addEventListener('pointerleave', () => raise(false));
      el.addEventListener('pointerdown', () => {
        el.style.transform = 'translateY(1px)';
        el.style.boxShadow = 'inset 0 2px 5px rgba(0,0,0,.55)';
      });
      el.addEventListener('pointerup', () => raise(true));
    };

    const add = (parent: HTMLElement, make: Tool | (() => Tool), label: string,
      icon: string, colour: string): void => {
      const pick = typeof make === 'function' ? make : (): Tool => make;
      const b = document.createElement('button');
      b.dataset.tool = this.key(pick());
      b.title = label;
      b.innerHTML = icon;
      chip(b, colour);
      b.addEventListener('click', () => this.select(pick()));
      parent.appendChild(b);
      this.buttons.push(b);
    };

    const look = group();
    add(look, { kind: 'look' }, 'Look around — drag to pan, right-drag to orbit',
      svgHand(), '#8fa3bd');
    tools.appendChild(look);

    // Roads, zones and signatures each collapse to one icon. Eight road
    // classes, five zones and a dozen landmarks spread along the bar is a
    // bar you scan; one icon each is a bar you read.
    const roads = group();
    {
      const b = document.createElement('button');
      b.dataset.branch = 'roads';
      b.title = 'Roads — eight classes, straight or curved';
      chip(b, ZONE_STYLE.road.light);
      const glyph = document.createElement('span');
      glyph.innerHTML = zoneIcon('road', 26);
      glyph.style.cssText = GLYPH;
      b.appendChild(glyph);
      b.appendChild(underline(ZONE_STYLE.road.base));
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
      b.title = 'Zoning — residential, commercial, industrial, office, parks';
      chip(b, ZONE_STYLE.residential.light);
      b.appendChild(zoneSwatch());
      b.appendChild(underline(ZONE_STYLE.residential.base));
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
      b.title = `Landmarks — ${SIGNATURES.length} one-of-a-kind buildings`;
      chip(b, '#ffd166');
      const glyph = document.createElement('span');
      glyph.innerHTML = svgStar();
      glyph.style.cssText = GLYPH;
      b.appendChild(glyph);
      b.appendChild(underline('#ffd166'));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.drawer?.dataset.branch === 'signature') { this.closeDrawer(); return; }
        this.openSignatureDrawer();
      });
      marks.appendChild(b);
      this.buttons.push(b);
    }
    tools.appendChild(marks);

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
      b.title = `${style.label} — ${list.length} buildings`;
      chip(b, style.colour);
      const glyph = document.createElement('span');
      glyph.innerHTML = zoneIcon(branch, 26);
      glyph.style.cssText = GLYPH;
      b.appendChild(glyph);
      b.appendChild(underline(style.colour));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.drawer?.dataset.branch === branch) { this.closeDrawer(); return; }
        this.openDrawer(branch, list, bar);
      });
      civic.appendChild(b);
      this.buttons.push(b);
    }
    tools.appendChild(civic);

    const clear = group();
    // "Buy land", not "Land": the landmarks button is two along and starts with
    // the same four letters, and a player scanning tooltips should not have to
    // read to the dash to tell them apart.
    add(clear, { kind: 'land' },
      'Buy land — lift the camera and buy the ground your city grows onto',
      svgPlot(), '#8fd4ff');
    add(clear, { kind: 'clear' }, 'Bulldoze — drag to clear roads and zoning',
      svgCross(), '#f08a6e');
    tools.appendChild(clear);

    // Saving sits on the bar rather than behind a menu, because a city
    // builder's one unrecoverable mistake is closing the tab.
    const keep = group();
    {
      const b = document.createElement('button');
      b.title = 'Save this city to this browser';
      chip(b, '#8fe0a8');
      const glyph = document.createElement('span');
      glyph.innerHTML = svgSave();
      glyph.style.cssText = GLYPH;
      b.appendChild(glyph);
      b.addEventListener('click', () => this.save());
      keep.appendChild(b);
    }
    tools.appendChild(keep);

    bar.appendChild(tools);
    bar.appendChild(this.buildStatusRow());
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
    row.style.cssText = [
      'display:flex', 'align-items:center', 'gap:0', 'height:36px',
      'padding:0 6px', `background:${WELL}`,
      'border-top:1px solid rgba(255,255,255,.05)',
      'font:600 11px/1 var(--ui, system-ui, sans-serif)', 'color:#93a3b8',
    ].join(';');

    const cell = (html: string, wide = false): HTMLElement => {
      const d = document.createElement('div');
      d.style.cssText = [
        'display:flex', 'align-items:center', 'gap:7px', 'padding:0 12px',
        'height:22px', wide ? 'flex:1' : '', 'white-space:nowrap',
      ].filter(Boolean).join(';');
      d.innerHTML = html;
      return d;
    };
    const rule = (): HTMLElement => {
      const r = document.createElement('div');
      r.style.cssText = 'width:1px;height:16px;background:rgba(255,255,255,.07)';
      return r;
    };

    // Speed. The clock is the renderer's own, so pausing here pauses the sun,
    // the lit windows and the shadows together -- there is only one clock.
    const speeds = document.createElement('div');
    speeds.style.cssText = 'display:flex;gap:2px;padding:0 4px';
    const rates = [0, 1, 3, 10];
    const marks = ['❚❚', '▶', '▶▶', '▶▶▶'];
    const pick = (i: number): void => {
      this.renderer.clockRunning = rates[i] > 0;
      this.renderer.clockRate = rates[i];
      for (let k = 0; k < buttons.length; k++) {
        const on = k === i;
        buttons[k].style.background = on ? 'rgba(98,212,255,.16)' : 'transparent';
        buttons[k].style.color = on ? '#8fe3ff' : '#61738a';
      }
    };
    const buttons: HTMLElement[] = rates.map((_, i) => {
      const b = document.createElement('button');
      b.textContent = marks[i];
      b.title = i === 0 ? 'Pause' : `Speed ${i}`;
      b.style.cssText = [
        'height:24px', 'min-width:30px', 'padding:0 7px', 'border-radius:7px',
        'border:0', 'background:transparent', 'color:#61738a', 'cursor:pointer',
        'font:11px/1 var(--ui, system-ui, sans-serif)',
      ].join(';');
      b.addEventListener('click', () => pick(i));
      speeds.appendChild(b);
      return b;
    });
    row.appendChild(speeds);
    row.appendChild(rule());

    this.readClock = cell('<span style="color:#dbe6f3">--:--</span><span>—</span>');
    row.appendChild(this.readClock);
    row.appendChild(rule());
    this.readSeason = cell('');
    row.appendChild(this.readSeason);
    row.appendChild(rule());
    // The weather, beside the season and the temperature it belongs with. It
    // changes the light enough that a player who has not noticed the sky needs
    // somewhere to read why the city went grey.
    this.readWeather = cell('');
    row.appendChild(this.readWeather);
    row.appendChild(rule());

    // The city and what lives in it, together. The population used to sit at
    // the far right beside the money, a whole bar away from the name of the
    // place it belongs to -- which is the one number a player checks against
    // the one word that identifies their city.
    this.readPeople = cell('');
    const named = document.createElement('div');
    named.style.cssText = 'display:flex;align-items:center;gap:0;flex:1';
    this.readName = cell('');
    named.appendChild(this.readName);
    named.appendChild(this.readPeople);
    this.paintName();
    row.appendChild(named);
    this.readMoney = cell('<span style="color:#7fd4a8">●</span>'
      + '<span style="color:#dbe6f3">∞</span>');
    row.appendChild(rule());
    row.appendChild(this.readMoney);

    pick(1);
    this.tick();
    return row;
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
      // The year turns once per real hour, so a session passes through the
      // seasons rather than sitting in one.
      const doy = (now / 3600000) % 1;
      const month = Math.floor(doy * 12);
      const season = SEASONS[Math.floor(((month + 1) % 12) / 3)];
      const temp = Math.round(season.low + (season.high - season.low)
        * (0.5 - 0.5 * Math.cos(t * Math.PI * 2 - Math.PI)));
      this.readClock.innerHTML =
        `<span style="color:#dbe6f3;font-variant-numeric:tabular-nums">`
        + `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</span>`
        + `<span>${MONTHS[month]} ${2027 + Math.floor(now / 3600000)}</span>`;
      this.readSeason.innerHTML = `<span style="color:${season.tint}">${season.glyph}</span>`
        + `<span style="color:#dbe6f3;font-variant-numeric:tabular-nums">${temp}°C</span>`
        + `<span>${season.name}</span>`;
      const w = this.renderer.weather;
      this.readWeather.innerHTML = `<span style="color:#a8c8e8">${w.glyph}</span>`
        + `<span style="color:#dbe6f3">${w.label}</span>`;
      const s = this.renderer.summary;
      this.readPeople.innerHTML = '<span style="color:#8fb8e8">☗</span>'
        + `<span style="color:#dbe6f3;font-variant-numeric:tabular-nums">`
        + `${s.people.toLocaleString()}</span>`
        + `<span style="opacity:.7">${s.buildings.toLocaleString()} bldg</span>`;
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
    this.mount(panel, branch, style.colour);
  }

  /**
   * One thing you can place: its picture, its name, its size and its price.
   *
   * The price is the point. Without one the drawer is a list of shapes and
   * every choice in it is free, which is not a choice.
   */
  private tile(id: string | null, name: string, size: string, cost: number,
    accent: string, note: string, onPick: () => void,
    glyph?: string, per = '', badge = ''): HTMLElement {
    const b = document.createElement('button');
    b.title = note;
    if (badge !== '') b.style.position = 'relative';
    const rest = ['border:1px solid rgba(255,255,255,.06)', `background:${WELL}`];
    b.style.cssText = [
      'display:flex', 'flex-direction:column', 'align-items:center', 'gap:2px',
      'padding:7px 4px', 'border-radius:10px', ...rest,
      'color:#c8d4e4', 'cursor:pointer',
      'font:600 10px/1.3 var(--ui, system-ui, sans-serif)', 'text-align:center',
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
      + `${money(cost)}</span>`
      + (per === '' ? '' : `<span style="opacity:.45"> ${per}</span>`);
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
        'font:700 8px/1.5 var(--ui, system-ui, sans-serif)', 'letter-spacing:.08em',
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
    ], accent, (key) => {
      this.roadMode = key as 'road' | 'curve';
      this.openRoadDrawer();
    }));
    for (const cls of ROAD_ORDER) {
      const spec = ROAD_SPECS[cls];
      const lanes = spec.oneWay ? spec.lanes : spec.lanes * 2;
      panel.appendChild(this.tile(null, spec.label,
        `${lanes} lane${lanes === 1 ? '' : 's'}`, roadPrice(cls), accent,
        `${spec.label} — ${Math.round(spec.edge * 2)} m of corridor`,
        () => this.select({ kind: this.roadMode, cls }),
        roadGlyph(cls, 48), 'a metre'));
    }
    this.mount(panel, 'roads', accent);
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
    panel.appendChild(this.tabs(SIGNATURE_ZONES.map((z) => ({
      key: z, label: ZONE_STYLE[z].label, on: z === zone,
    })), accent, (key) => this.openSignatureDrawer(key as SignatureZone)));
    for (const p of SIGNATURES) {
      if (p.def.zone !== zone) continue;
      panel.appendChild(this.tile(p.id, p.def.name, `${p.w}\u00d7${p.d}`,
        buildingPrice(p.def), accent, p.def.note,
        () => this.select({ kind: 'place', proto: p })));
    }
    this.mount(panel, 'signature', accent);
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
  private mount(panel: HTMLElement, key: string, accent: string): void {
    this.foot.insertBefore(panel, this.foot.firstChild);
    this.drawer = panel;
    for (const el of this.buttons) {
      if (el.dataset.branch === key) el.style.borderColor = `${accent}aa`;
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
      if (themed) panel.appendChild(this.band(`${density} ${style.label}`));
      panel.appendChild(this.tile(zoneSpecimen(zone, density),
        themed ? 'Whichever' : `${density} ${zone}`, 'per cell', price, accent,
        `${style.blurb} Zoned for ${density} density, in whatever style the`
        + ' district around it is growing in.',
        () => this.select({ kind: 'zone', zone: zone as Zone, density }),
        undefined, '', themed ? 'ANY' : ''));
      if (!themed) continue;
      for (const theme of ALL_THEMES) {
        if (!hasSpecimen(zone, density, theme)) continue;
        const profile = THEMES[theme];
        panel.appendChild(this.tile(zoneSpecimen(zone, density, theme),
          profile.label, 'per cell', price, accent,
          `${style.blurb} Zoned for ${density} density in the ${profile.label} style.`,
          () => this.select({ kind: 'zone', zone: zone as Zone, density, theme }),
          undefined, '', profile.badge));
      }
    }
    this.mount(panel, 'zones', accent);
  }

  /** A full-width heading inside a drawer's grid. */
  private band(label: string): HTMLElement {
    const el = document.createElement('div');
    el.textContent = label;
    el.style.cssText = [
      'grid-column:1/-1', 'padding:8px 2px 2px', 'color:#7f93ab',
      'font:700 9px/1.2 var(--ui, system-ui, sans-serif)',
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
      if (el.dataset.branch !== undefined && !el.dataset.on) {
        el.style.borderColor = 'rgba(255,255,255,.07)';
      }
    }
  }

  private styleStatus(): void {
    this.status.style.cssText = [
      'padding:5px 12px', 'border-radius:9px', `background:${PANEL}`,
      `border:1px solid ${EDGE}`, 'color:#9fb2c9',
      'font:500 11px/1.4 var(--ui, system-ui, sans-serif)',
      'pointer-events:none', 'white-space:nowrap', 'backdrop-filter:blur(10px)',
    ].join(';');
    this.say(this.describe(this.tool));
  }

  private say(text: string): void {
    this.status.textContent = text;
  }
}

function svgHand(): string {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="1.6"><path d="M7 12V6.5a1.5 1.5 0 0 1 3 0V11m0-.5V5a1.5 1.5 0 0 1 3 0v6m0-.5'
    + 'V6.5a1.5 1.5 0 0 1 3 0V13m0-1.5a1.5 1.5 0 0 1 3 0V16a5 5 0 0 1-5 5h-1.5a6 6 0 0 1-5.2-3L7 15"'
    + '/></svg>';
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
  const parts: string[] = [
    `<rect x="${x0.toFixed(2)}" y="3" width="${w.toFixed(2)}" height="22" rx="1.5"`
    + ' fill="#11161d" stroke="currentColor" stroke-opacity=".45" stroke-width="1"/>',
  ];
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
const GLYPH = 'display:flex;filter:drop-shadow(0 1.5px 1.5px rgba(0,0,0,.55))';

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
  const quads: IconZone[] = ['residential', 'commercial', 'industrial', 'office'];
  el.style.cssText = [
    'display:grid', 'grid-template-columns:1fr 1fr', 'grid-template-rows:1fr 1fr',
    'gap:2px', 'width:24px', 'height:24px',
    'filter:drop-shadow(0 1.5px 1.5px rgba(0,0,0,.55))',
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

/**
 * The land tool's glyph: an empty plot.
 *
 * A clear box in dashed outline with one solid corner, because what the tool
 * does is turn a dashed square into a solid one. Nothing else on the bar is an
 * outline, so it reads as "land" rather than as another building.
 */
function svgPlot(): string {
  return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"'
    + ' stroke="currentColor" stroke-width="1.7" stroke-linecap="round">'
    + '<path d="M4 7.5 L12 3.5 L20 7.5 L12 11.5 Z" stroke-dasharray="2.6 2.2"/>'
    + '<path d="M4 7.5 L4 15 L12 19 L12 11.5" stroke-dasharray="2.6 2.2"/>'
    + '<path d="M20 7.5 L20 15 L12 19" stroke-opacity=".95"/>'
    + '<path d="M12 11.5 L12 19" stroke-opacity=".5"/>'
    + '</svg>';
}

function svgStar(): string {
  return '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">'
    + '<path d="M12 2.6l2.7 5.9 6.4.7-4.8 4.3 1.3 6.3L12 16.6 6.4 19.8l1.3-6.3L2.9 9.2l6.4-.7z"/>'
    + '</svg>';
}

/** The colour bar under a category icon, which is how the bar is read. */
function underline(colour: string): HTMLElement {
  const el = document.createElement('span');
  el.style.cssText = [
    'position:absolute', 'left:50%', 'bottom:4px', 'transform:translateX(-50%)',
    'width:18px', 'height:2px', 'border-radius:2px', 'pointer-events:none',
    `background:${colour}`, `box-shadow:0 0 7px ${colour}aa`,
  ].join(';');
  return el;
}

function svgSave(): string {
  return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h10L20 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z"/>'
    + '<path d="M8 4v5h7V4"/><path d="M7.5 20v-6h9v6"/></svg>';
}

function svgCross(): string {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="1.8"><path d="M5 5l14 14M19 5L5 19"/></svg>';
}
