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
import { paint, demolish, zoneCode, ZONES, DENSITIES } from '../sim';
import type { RoadClass } from '../sim';
import { ROAD_SPECS, ROAD_ORDER } from '../sim';
import { ZONE_STYLE, zoneIcon } from './zones';
import type { Density, Zone } from '../assets/types';
import type { IconZone } from './zones';

/** Metres per zoning cell. */
const CELL = 8;

type Tool =
  | { kind: 'look' }
  | { kind: 'road'; cls: RoadClass }
  | { kind: 'zone'; zone: Zone; density: Density }
  | { kind: 'clear' };

const TOOL_TINT: Record<string, [number, number, number]> = {
  look: [0.6, 0.7, 0.8],
  road: [0.72, 0.76, 0.82],
  clear: [0.95, 0.42, 0.30],
};

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

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: Camera,
    private renderer: Renderer,
    parent: HTMLElement,
  ) {
    this.status = document.createElement('div');
    parent.appendChild(this.buildBar());
    parent.appendChild(this.status);
    this.styleStatus();

    this.on(canvas, 'pointerdown', this.onDown as EventListener);
    this.on(canvas, 'pointermove', this.onMove as EventListener);
    this.on(canvas, 'pointerup', this.onUp as EventListener);
    this.on(canvas, 'pointercancel', this.onCancel as EventListener);
    this.on(window, 'keydown', this.onKey as EventListener);
  }

  /** True while a build tool owns the pointer, so the camera leaves it alone. */
  get active(): boolean {
    return this.tool.kind !== 'look';
  }

  dispose(): void {
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
    if (e.key === 'Escape') {
      this.from = null;
      this.select({ kind: 'look' });
    }
  };

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
    if (this.tool.kind === 'road') {
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
    return this.tool.kind === 'road'
      ? Math.max(2, Math.round((ROAD_SPECS[this.tool.cls].edge * 2) / CELL))
      : 3;
  }

  private showMark(): void {
    if (!this.active) {
      this.renderer.mark = null;
      this.renderer.setRoadPreview(null);
      return;
    }
    const a = this.from ?? this.to;
    if (this.tool.kind === 'road') {
      // A road previews as the road. The rectangle below cannot show a curve,
      // and was half a cell off from where the road actually lands.
      this.renderer.mark = null;
      if (this.from === null) { this.renderer.setRoadPreview(null); return; }
      const world = this.renderer.world;
      const half = world.grid / 2;
      const at = (c: [number, number]): [number, number] =>
        world.net.snapPoint((c[0] - half + 0.5) * CELL, (c[1] - half + 0.5) * CELL);
      const [ax, az] = at(a);
      const [bx, bz] = at(this.to);
      this.renderer.setRoadPreview(
        previewRoad(world.grid, ax, az, bx, bz, this.tool.cls, this.bend(), baseHeightAt));
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

  private commit(a: [number, number], b: [number, number]): void {
    const world = this.renderer.world;
    const t = this.tool;
    const r = this.area(a, b);
    if (t.kind === 'road') {
      // Only the zoning under the new carriageway goes -- zoning there would
      // grow houses in the road. What must *not* go is the roads it runs
      // across: crossing one builds a junction, and clearing the band first
      // deleted every road the new one met. The graph finds its own crossings.
      paint(world, r.gx, r.gz, r.w, r.d, 0);
      const half = world.grid / 2;
      world.net.add((a[0] - half + 0.5) * CELL, (a[1] - half + 0.5) * CELL,
        (b[0] - half + 0.5) * CELL, (b[1] - half + 0.5) * CELL, t.cls, this.bend());
    } else if (t.kind === 'zone') {
      paint(world, r.gx, r.gz, r.w, r.d, zoneCode(t.zone, t.density));
    } else if (t.kind === 'clear') {
      demolish(world, r.gx, r.gz, r.w, r.d);
    } else {
      return;
    }
    const started = performance.now();
    this.renderer.rebuild();
    this.say(`rebuilt in ${(performance.now() - started).toFixed(0)} ms`);
  }

  // ---- the bar ---------------------------------------------------------

  private select(tool: Tool): void {
    this.tool = tool;
    this.from = null;
    this.showMark();
    for (const el of this.buttons) {
      el.dataset.on = el.dataset.tool === this.key(tool) ? '1' : '';
      el.style.borderColor = el.dataset.on ? 'rgba(98,212,255,.75)' : 'rgba(255,255,255,.10)';
      el.style.background = el.dataset.on ? 'rgba(98,212,255,.16)' : 'rgba(10,14,20,.72)';
    }
    this.canvas.style.cursor = tool.kind === 'look' ? '' : 'crosshair';
    this.say(this.describe(tool));
  }

  private key(t: Tool): string {
    if (t.kind === 'road') return `road:${t.cls}`;
    if (t.kind === 'zone') return `zone:${t.zone}:${t.density}`;
    return t.kind;
  }

  private describe(t: Tool): string {
    if (t.kind === 'look') return 'drag to pan, right-drag to orbit, wheel to zoom';
    if (t.kind === 'road') {
      return `drag to lay a ${ROAD_SPECS[t.cls].label} — sweep the drag to curve it; `
        + 'it will cross and join what is there';
    }
    if (t.kind === 'zone') return `drag to zone ${t.density} ${t.zone}`;
    return 'drag to clear roads and zoning';
  }

  private buttons: HTMLElement[] = [];

  private buildBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.style.cssText = [
      'position:absolute', 'left:50%', 'bottom:14px', 'transform:translateX(-50%)',
      'display:flex', 'gap:6px', 'padding:6px', 'border-radius:6px',
      'background:rgba(6,9,13,.78)', 'border:1px solid rgba(98,212,255,.16)',
      'backdrop-filter:blur(6px)', 'z-index:5',
      // The overlay it lives in is click-through so the camera can be dragged
      // anywhere; the bar itself has to take its own clicks back.
      'pointer-events:auto',
    ].join(';');

    const group = (): HTMLElement => {
      const g = document.createElement('div');
      g.style.cssText = 'display:flex;gap:4px';
      return g;
    };
    const sep = (): HTMLElement => {
      const s = document.createElement('div');
      s.style.cssText = 'width:1px;margin:4px 3px;background:rgba(255,255,255,.10)';
      return s;
    };

    const add = (parent: HTMLElement, tool: Tool, label: string, icon: string,
      colour: string): void => {
      const b = document.createElement('button');
      b.dataset.tool = this.key(tool);
      b.title = label;
      b.innerHTML = icon;
      b.style.cssText = [
        'display:flex', 'align-items:center', 'gap:6px', 'padding:6px 9px',
        'border-radius:4px', 'border:1px solid rgba(255,255,255,.10)',
        'background:rgba(10,14,20,.72)', `color:${colour}`, 'cursor:pointer',
        'font:11px/1 var(--mono, ui-monospace, monospace)', 'letter-spacing:.03em',
      ].join(';');
      b.addEventListener('click', () => this.select(tool));
      parent.appendChild(b);
      this.buttons.push(b);
    };

    const look = group();
    add(look, { kind: 'look' }, 'Look around', svgHand(), '#8fa3bd');
    bar.appendChild(look);
    bar.appendChild(sep());

    const roads = group();
    for (const cls of ROAD_ORDER) {
      add(roads, { kind: 'road', cls }, `${cls[0].toUpperCase()}${cls.slice(1)}`,
        `${zoneIcon('road', 18)}<span>${ROAD_SPECS[cls].label}</span>`, ZONE_STYLE.road.light);
    }
    bar.appendChild(roads);
    bar.appendChild(sep());

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
      b.innerHTML = `${zoneIcon(zone as IconZone, 18)}<span>${DENSITIES[level]}</span>`;
      b.style.cssText = [
        'display:flex', 'align-items:center', 'gap:6px', 'padding:6px 9px',
        'border-radius:4px', 'border:1px solid rgba(255,255,255,.10)',
        'background:rgba(10,14,20,.72)', `color:${style.light}`, 'cursor:pointer',
        'font:11px/1 var(--mono, ui-monospace, monospace)', 'letter-spacing:.03em',
      ].join(';');
      b.addEventListener('click', () => {
        if (this.tool.kind === 'zone' && this.tool.zone === zone) {
          level = (level + 1) % DENSITIES.length;
        }
        b.innerHTML = `${zoneIcon(zone as IconZone, 18)}<span>${DENSITIES[level]}</span>`;
        b.dataset.tool = this.key(tool());
        this.select(tool());
      });
      zones.appendChild(b);
      this.buttons.push(b);
    }
    bar.appendChild(zones);
    bar.appendChild(sep());

    const clear = group();
    add(clear, { kind: 'clear' }, 'Clear', `${svgCross()}<span>clear</span>`, '#e8836e');
    bar.appendChild(clear);
    return bar;
  }

  private styleStatus(): void {
    this.status.style.cssText = [
      'position:absolute', 'left:50%', 'bottom:60px', 'transform:translateX(-50%)',
      'padding:4px 10px', 'border-radius:3px', 'background:rgba(6,9,13,.7)',
      'color:#8fa3bd', 'font:11px/1.5 var(--mono, ui-monospace, monospace)',
      'pointer-events:none', 'white-space:nowrap', 'z-index:5',
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

function svgCross(): string {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="1.8"><path d="M5 5l14 14M19 5L5 19"/></svg>';
}
