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
import { services } from '../sim';
import type { RoadClass, Proto } from '../sim';
import { ROAD_SPECS, ROAD_ORDER } from '../sim';
import { ZONE_STYLE, zoneIcon } from './zones';
import { assetIcon, zoneSpecimen } from './icons';
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

const CITY_NAME = 'Salford';
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
  | { kind: 'zone'; zone: Zone; density: Density }
  | { kind: 'place'; proto: Proto }
  | { kind: 'clear' };

/** How long after a click its second half still counts as a double-click. */
const DOUBLE = 450;

const TOOL_TINT: Record<string, [number, number, number]> = {
  look: [0.6, 0.7, 0.8],
  road: [0.72, 0.76, 0.82],
  curve: [0.72, 0.76, 0.82],
  place: [0.45, 0.86, 0.62],
  clear: [0.95, 0.42, 0.30],
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
  private readMoney!: HTMLElement;
  private ticked = 0;
  private raf = 0;

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
      'z-index:5', 'pointer-events:none',
    ].join(';');
    this.foot.appendChild(this.status);
    this.foot.appendChild(this.buildBar());
    parent.appendChild(this.foot);
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
    return this.tool.kind !== 'look';
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
    if (this.tool.kind === 'curve' || this.tool.kind === 'place') return;
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
  private dropLot(cell: [number, number]): void {
    const t = this.tool;
    if (t.kind !== 'place') return;
    const world = this.renderer.world;
    const [gx, gz] = this.lotOrigin(cell, t.proto);
    const why = placeLot(world, t.proto.id, gx, gz, this.placeYaw, baseHeightAt);
    if (why !== null) { this.say(`cannot place the ${t.proto.def.name.toLowerCase()}: ${why}`); return; }
    this.rebuild();
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
    if (this.tool.kind === 'place') {
      // The footprint where it would land, green if it fits and red if it does
      // not. Answering before the click is the whole point: a player should
      // never have to click to find out that a road is in the way.
      this.renderer.setRoadPreview(null);
      const p = this.tool.proto;
      const [gx, gz] = this.lotOrigin(this.to, p);
      const fit = lotFits(this.renderer.world, p.id, gx, gz, this.placeYaw, baseHeightAt);
      const half = this.renderer.world.grid / 2;
      this.renderer.mark = {
        rect: [
          (gx - half) * CELL, (gz - half) * CELL,
          (gx + fit.w - half) * CELL, (gz + fit.d - half) * CELL,
        ],
        tint: fit.why === null ? [0.35, 0.92, 0.55] : [0.95, 0.32, 0.28],
      };
      return;
    }
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
    // Ending on the bend point means the bend point was the first half of a
    // double-click, and what the player asked for is a straight run to there.
    if (via !== null && Math.abs(via[0] - b[0]) <= 1 && Math.abs(via[1] - b[1]) <= 1) {
      via = null;
    }
    this.clearUnder(a, b, via, bend);
    world.net.add(ax, az, bx, bz, t.cls, bend, via === null ? null : this.metres(via));
    this.rebuild();
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

  private rebuild(): void {
    const started = performance.now();
    this.renderer.rebuild();
    this.say(`rebuilt in ${(performance.now() - started).toFixed(0)} ms`);
  }

  private commit(a: [number, number], b: [number, number]): void {
    const world = this.renderer.world;
    const t = this.tool;
    const r = this.area(a, b);
    if (t.kind === 'road') {
      this.lay(a, b, null, this.bend());
      return;
    } else if (t.kind === 'zone') {
      paint(world, r.gx, r.gz, r.w, r.d, zoneCode(t.zone, t.density));
    } else if (t.kind === 'clear') {
      demolish(world, r.gx, r.gz, r.w, r.d);
    } else {
      return;
    }
    this.rebuild();
  }

  // ---- the bar ---------------------------------------------------------

  private select(tool: Tool): void {
    this.tool = tool;
    this.from = null;
    this.curveA = null;
    this.curveVia = null;
    this.curveStage = 'none';
    if (tool.kind === 'road' || tool.kind === 'curve') this.roadMode = tool.kind;
    this.closeDrawer();
    this.showMark();
    for (const el of this.buttons) {
      el.dataset.on = el.dataset.tool === this.key(tool) ? '1' : '';
      el.style.borderColor = el.dataset.on ? 'rgba(120,214,255,.55)' : 'transparent';
      el.style.background = el.dataset.on ? 'rgba(98,212,255,.15)' : 'transparent';
      el.style.boxShadow = el.dataset.on ? '0 0 0 1px rgba(98,212,255,.12) inset' : 'none';
    }
    this.canvas.style.cursor = tool.kind === 'look' ? '' : 'crosshair';
    this.say(this.describe(tool));
  }

  private key(t: Tool): string {
    // Both road tools answer to the same class button; which of the two it
    // selects is the mode button beside them.
    if (t.kind === 'road' || t.kind === 'curve') return `road:${t.cls}`;
    if (t.kind === 'zone') return `zone:${t.zone}:${t.density}`;
    if (t.kind === 'place') return `place:${t.proto.id}`;
    return t.kind;
  }

  private describe(t: Tool): string {
    if (t.kind === 'look') return 'drag to pan, right-drag to orbit, wheel to zoom';
    if (t.kind === 'road') {
      return `drag to lay a ${ROAD_SPECS[t.cls].label} — sweep the drag to curve it; `
        + 'it will cross and join what is there';
    }
    if (t.kind === 'curve') {
      return `click to start a ${ROAD_SPECS[t.cls].label}, click where it bends, `
        + 'click where it ends — double-click to finish the run';
    }
    if (t.kind === 'place') {
      const [w, d] = this.placeYaw % 2 === 0 ? [t.proto.w, t.proto.d] : [t.proto.d, t.proto.w];
      return `click to place the ${t.proto.def.name.toLowerCase()} `
        + `(${w}x${d} cells, ${w * 8}x${d * 8} m) — R rotates`;
    }
    if (t.kind === 'zone') return `drag to zone ${t.density} ${t.zone}`;
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
      'max-width:min(1280px,96vw)', 'border-radius:14px', 'overflow:hidden',
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
      'justify-content:center', 'gap:5px', 'padding:8px 10px',
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
    /** Every button on the bar is this shape; only its contents differ. */
    const chip = (el: HTMLElement, colour: string): void => {
      el.style.cssText = [
        'display:flex', 'align-items:center', 'gap:6px',
        'height:34px', 'padding:0 10px', 'border-radius:9px',
        'border:1px solid transparent', 'background:transparent',
        `color:${colour}`, 'cursor:pointer', 'white-space:nowrap',
        'font:600 11px/1 var(--ui, system-ui, sans-serif)', 'letter-spacing:.02em',
        'transition:background .12s, border-color .12s',
      ].join(';');
      el.addEventListener('pointerenter', () => {
        if (!el.dataset.on) el.style.background = 'rgba(255,255,255,.06)';
      });
      el.addEventListener('pointerleave', () => {
        if (!el.dataset.on) el.style.background = 'transparent';
      });
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
    add(look, { kind: 'look' }, 'Look around', svgHand(), '#8fa3bd');
    tools.appendChild(look);

    // How a road is drawn is a property of the drawing, not of the road, so
    // it is one button beside the classes rather than a second copy of all of
    // them. Drag sweeps a shape; curve clicks one out three points at a time.
    const mode = document.createElement('button');
    const paintMode = (): void => {
      const curving = this.roadMode === 'curve';
      mode.innerHTML = `${curving ? svgCurve() : svgStraight()}`
        + `<span>${curving ? 'curve' : 'drag'}</span>`;
      mode.title = curving
        ? 'Curved roads — click, click the bend, click the end'
        : 'Dragged roads — sweep the drag to bow the road';
    };
    chip(mode, ZONE_STYLE.road.light);
    mode.addEventListener('click', () => {
      this.roadMode = this.roadMode === 'curve' ? 'road' : 'curve';
      paintMode();
      const cls = this.tool.kind === 'road' || this.tool.kind === 'curve'
        ? this.tool.cls : ROAD_ORDER[0];
      this.select({ kind: this.roadMode, cls });
    });
    paintMode();

    const roads = group();
    roads.appendChild(mode);
    for (const cls of ROAD_ORDER) {
      add(roads, (): Tool => ({ kind: this.roadMode, cls }),
        `${cls[0].toUpperCase()}${cls.slice(1)}`,
        `${zoneIcon('road', 18)}<span>${ROAD_SPECS[cls].label}</span>`, ZONE_STYLE.road.light);
    }
    tools.appendChild(roads);

    // One button per zone, cycling density on repeated clicks: four buttons
    // and a modifier beats twelve buttons, and density is the thing a player
    // changes least often.
    const zones = group();
    for (const zone of ZONES) {
      const style = ZONE_STYLE[zone as IconZone];
      const b = document.createElement('button');
      let level = 0;
      const tool = (): Tool => ({ kind: 'zone', zone, density: DENSITIES[level] });
      b.dataset.tool = this.key(tool());
      b.title = `${style.label} — click again for higher density`;
      // The zone's own glyph beside a specimen of what grows there: the glyph
      // says which zone, the building says what it will look like, and neither
      // says both.
      const face = (): void => {
        b.replaceChildren();
        const glyph = document.createElement('span');
        glyph.innerHTML = zoneIcon(zone as IconZone, 16);
        glyph.style.cssText = 'display:flex';
        b.appendChild(glyph);
        const rep = zoneSpecimen(zone, DENSITIES[level]);
        if (rep !== null) b.appendChild(assetIcon(rep, 26));
        const tag = document.createElement('span');
        tag.textContent = DENSITIES[level];
        b.appendChild(tag);
      };
      face();
      chip(b, style.light);
      b.addEventListener('click', () => {
        if (this.tool.kind === 'zone' && this.tool.zone === zone) {
          level = (level + 1) % DENSITIES.length;
        }
        face();
        b.dataset.tool = this.key(tool());
        this.select(tool());
      });
      zones.appendChild(b);
      this.buttons.push(b);
    }
    tools.appendChild(zones);

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
      // A dot in the branch's colour and the name. Eleven of these read as a
      // palette; eleven grey glyphs read as a toolbar nobody wants to learn.
      b.innerHTML = `<span style="width:9px;height:9px;border-radius:50%;`
        + `background:${style.colour};box-shadow:0 0 8px ${style.colour}88"></span>`
        + `<span>${style.label.toLowerCase()}</span>`;
      chip(b, '#c6d2e2');
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
    add(clear, { kind: 'clear' }, 'Clear', `${svgCross()}<span>clear</span>`, '#f08a6e');
    tools.appendChild(clear);

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

    row.appendChild(cell('<span style="color:#7fd4a8">◆</span>'
      + `<span style="color:#dbe6f3;letter-spacing:.06em">${CITY_NAME}</span>`, true));

    this.readPeople = cell('');
    row.appendChild(rule());
    row.appendChild(this.readPeople);
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
    this.closeDrawer();
    const style = BRANCH_STYLE[branch];
    const panel = document.createElement('div');
    panel.dataset.branch = branch;
    panel.style.cssText = [
      'display:grid', 'grid-template-columns:repeat(auto-fill,minmax(92px,1fr))',
      'gap:5px', 'padding:10px', 'border-radius:14px', 'width:min(860px,94vw)',
      'max-height:46vh', 'overflow-y:auto',
      `background:${PANEL}`, `border:1px solid ${style.colour}55`,
      'box-shadow:0 10px 34px rgba(0,0,0,.5)',
      'backdrop-filter:blur(14px)', 'z-index:6', 'pointer-events:auto',
    ].join(';');
    // Clicks inside the drawer must not reach the bar's own dismissal.
    panel.addEventListener('pointerdown', (e) => e.stopPropagation());

    for (const p of list) {
      const b = document.createElement('button');
      b.title = p.def.note;
      b.style.cssText = [
        'display:flex', 'flex-direction:column', 'align-items:center', 'gap:3px',
        'padding:7px 4px', 'border-radius:10px', 'border:1px solid rgba(255,255,255,.06)',
        `background:${WELL}`, 'color:#c8d4e4', 'cursor:pointer',
        'font:600 10px/1.3 var(--ui, system-ui, sans-serif)', 'text-align:center',
      ].join(';');
      b.appendChild(assetIcon(p.id, 52));
      const name = document.createElement('span');
      name.textContent = p.def.name;
      const size = document.createElement('span');
      size.textContent = `${p.w}x${p.d}`;
      size.style.cssText = `color:${style.colour};opacity:.75`;
      b.append(name, size);
      b.addEventListener('mouseenter', () => {
        b.style.borderColor = `${style.colour}99`;
        b.style.background = 'rgba(255,255,255,.05)';
      });
      b.addEventListener('mouseleave', () => {
        b.style.borderColor = 'rgba(255,255,255,.06)';
        b.style.background = WELL;
      });
      b.addEventListener('click', () => this.select({ kind: 'place', proto: p }));
      panel.appendChild(b);
    }
    void bar;
    this.foot.insertBefore(panel, this.foot.firstChild);
    this.drawer = panel;
    for (const el of this.buttons) {
      if (el.dataset.branch === branch) el.style.borderColor = `${style.colour}aa`;
    }
  }

  private closeDrawer(): void {
    this.drawer?.remove();
    this.drawer = null;
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

function svgStraight(): string {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="1.6"><path d="M4 20L20 4"/><circle cx="4" cy="20" r="2" fill="currentColor"'
    + ' stroke="none"/><circle cx="20" cy="4" r="2" fill="currentColor" stroke="none"/></svg>';
}

function svgCurve(): string {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="1.6"><path d="M4 20Q4 6 20 6"/><circle cx="4" cy="20" r="2"'
    + ' fill="currentColor" stroke="none"/><circle cx="20" cy="6" r="2" fill="currentColor"'
    + ' stroke="none"/><circle cx="5.5" cy="7.5" r="1.6" fill="none"/></svg>';
}

function svgCross(): string {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="1.8"><path d="M5 5l14 14M19 5L5 19"/></svg>';
}
