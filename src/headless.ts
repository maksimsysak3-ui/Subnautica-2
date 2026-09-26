/**
 * The real renderer, off screen, for tools.
 *
 * Not part of the game. It exists because the only honest picture of the city
 * is one the game's own frame loop drew, and the software rasteriser the
 * tools run under takes the canvas presentation path down within a second of
 * boot. So this builds the same Renderer against a texture instead of a
 * window, drives it by hand, and hands back pixels.
 *
 * Bundled separately and loaded into a blank page by tools/city-shot.mjs.
 */

/**
 * What a control is called.
 *
 * The interface names its buttons with `aria-label` rather than `title`, so the
 * game can draw its own tooltip instead of the browser's; the probes here press
 * buttons by name and have to ask the same question the same way.
 */
function named(el: HTMLElement): string {
  return el.getAttribute('aria-label') ?? el.title;
}

import { ASSET_INDEX } from './sim/inventory';
import { nextWing } from './sim/world';
import { resourceFields, RES_GRID } from './sim/resources';
import { industryProto } from './sim/inventory';
import { lotFits, placeLot } from './sim/world';
import { useMap } from './sim/maps';
import { CALM } from './sim/politics';
import { installTheme } from './ui/theme';
import { Gpu } from './gfx/device';
import { startingWorld } from './sim/world';
import { TECH, landmarksForLevel } from './sim/tech';
import { ASSETS } from './assets/registry';
import type { Progress } from './sim/progress';
import type { Alerts } from './ui/alerts';
import { Camera } from './gfx/camera';
import { Renderer } from './gfx/renderer';
import { Stats } from './ui/stats';
import { BuildTools } from './ui/build-tools';
import {
  configureSim, LITE, simConfig, paint, demolish, zoneCode, defaultWorld, PLOTS,
  emptyWorld, makeCity, clearStanding, clearWild, clearGrading, clearRoadMesh,
  INSTANCE_FLOATS, previewRoad, baseHeightAt, GRIPE_INFO, Purpose, VIEWS,
} from './sim';
import type { Dirty, Simulation } from './sim';
import { LiveCity } from './live';
import { Main } from './sim/mains';

export interface ShotRequest {
  width: number;
  height: number;
  yaw: number;
  pitch: number;
  distance: number;
  focus: [number, number];
  /** Frames to run before reading back. The overlay's counts lag by one. */
  frames: number;
  /** Where in the day to freeze the sun: 0 and 1 midnight, 0.5 noon. */
  hour: number;
  /**
   * Where in the weather cycle to freeze the sky: 0 settled, 1 stormy.
   *
   * Pinned for the same reason the hour is. The weather runs on the clock, and
   * a picture taken on whatever the clock happened to be doing is a picture
   * that differs between runs of the same shot.
   */
  front?: number;
  /** The season to show, as seasonLook() returns it: + autumn, - snow. */
  season?: number;
  /**
   * Clear a square of the map, draw a road into the empty land and zone one
   * side of it, then rebuild -- the player's own workflow, so a picture can
   * show whether it produced a street or a mess.
   */
  edit?: boolean;
  /** Photograph the map the game actually opens on, rather than a built city. */
  empty?: boolean;
  /** Which starting map to stand the shot on. See sim/maps.ts. */
  map?: string;
  /**
   * An industry to photograph: a headquarters on the richest free ground for
   * this resource, with a harvest area drawn round it, and the camera on it.
   */
  industry?: string;
  lite: boolean;
  /** Draw the land grid, as the land tool does. */
  land?: boolean;
  /**
   * Open an information view by name, e.g. "Traffic" or "Power", and photograph
   * the map with it up.
   *
   * The only way to look at a heatmap. Its correctness can be asserted -- and is,
   * in `probeViews` -- but whether it is legible over a real city at a real camera
   * distance is a question about a picture.
   */
  view?: string;
}

export interface Shot {
  /** Tightly packed RGBA, top row first. */
  pixels: Uint8Array;
  /** What the stats overlay would have said. */
  stats: Record<string, string>;
}

/**
 * Builds a city, edits it, rebuilds, and reports what changed.
 *
 * The rebuild path is the one thing in the renderer that cannot be checked by
 * looking at a screenshot: a placement that silently fails to take, or a
 * rebuild that leaves a stale buffer bound, both produce a perfectly ordinary
 * frame. So the test is what the numbers did.
 */

/**
 * Hands a probe the whole map.
 *
 * Land is bought a plot at a time in the game, and every probe below is testing
 * something else -- the road tool, the curve tool, the rebuild path -- against a
 * map far bigger than the four plots a city starts with. Buying the map up
 * front keeps each test about the one thing it is named for.
 */
function grantAll(world: { land: { take: (p: number) => void }; progress?: Progress }): void {
  for (let i = 0; i < PLOTS * PLOTS; i++) world.land.take(i);
  // And the development tree, which a generated city never played its way
  // through: a probe photographing a hospital should not be told the city has
  // not unlocked hospitals.
  world.progress?.openEverything(TECH.map((n) => n.id),
    ASSETS.filter((a) => a.signature === true).map((a) => a.id));
}

export async function probeRebuild(width: number, height: number):
Promise<{ before: Record<string, string>; after: Record<string, string>;
  cost: Record<string, number>; first: Record<string, number>; edits: number[]; meshes: number[];
  queued: number; warmed: number }> {
  configureSim(LITE);
  const gpu = await Gpu.headless(width, height);
  const camera = new Camera();
  const stats = new Stats(document.createElement('div'));
  const renderer = new Renderer(gpu, camera, stats);
  renderer.clockRunning = false;
  // The game opens on empty land now. What is being measured here is a
  // rebuild of a city, so one is put on the map first.
  renderer.useWorld(defaultWorld(renderer.world.grid));
  grantAll(renderer.world);
  renderer.build();
  camera.distance = 300;
  camera.update();
  renderer.frameForTools(performance.now());
  await gpu.device.queue.onSubmittedWorkDone();
  const before = stats.snapshot();

  // A road across the middle of an unzoned quarter, and a block of housing
  // beside it. Both have to change the city, and the road has to cross what
  // is already there and grow the junctions itself.
  const g = renderer.world.grid;
  renderer.world.net.addCells(4, (g >> 1) + 1, g - 5, (g >> 1) + 1, 'dual');
  paint(renderer.world, 6, (g >> 1) + 6, 12, 12, zoneCode('residential', 'high'));
  renderer.rebuild();
  renderer.frameForTools(performance.now());
  await gpu.device.queue.onSubmittedWorkDone();
  const first = { ...renderer.cost };

  // What a player actually feels: the wall time of one more edit, several
  // times over. A single sample is dominated by whatever the first one warmed
  // up, and the complaint is about the steady state.
  // What the warming queue holds after that first rebuild, and how far the
  // edits below get without generating anything. This is the whole point of the
  // queue: the spikes in `edits` were a building being generated inside the
  // rebuild an edit triggers, and a player sits through plenty of frames
  // between one edit and the next for the queue to be worked through.
  const queued = renderer.warmList.length;
  let warmed = 0;
  while (renderer.warmNext()) warmed++;

  const edits: number[] = [];
  const meshes: number[] = [];
  for (let i = 0; i < 12; i++) {
    renderer.world.net.addCells(10 + i * 3, 6, 10 + i * 3, g - 6, 'street');
    const t = performance.now();
    renderer.rebuild();
    edits.push(Math.round(performance.now() - t));
    meshes.push(renderer.cost.newMeshes);
  }
  // The steady state, not the first one: the first rebuild after a build is
  // still baking prototypes the edit introduced, and what a player feels is
  // the fiftieth road they draw rather than the first.
  return { before, after: stats.snapshot(), cost: { ...renderer.cost }, first, edits, meshes,
    queued, warmed };
}

/**
 * Drives the build tools the way a player does, and reports what changed.
 *
 * Everything about a tool that can go wrong goes wrong silently: a pick that
 * lands on the wrong cell, a drag the camera swallowed, a commit that edits
 * the world but never rebuilds. None of it shows in a frame. So this puts a
 * canvas on the page, dispatches real pointer events at real screen
 * coordinates, and checks the world underneath.
 */
export async function probeTools(): Promise<{
  roadCellsBefore: number; roadCellsAfter: number;
  zonedBefore: number; zonedAfter: number; picked: boolean;
  lotsBefore: number; lotsAfter: number; drawerSize: number;
  zoneTiles: number; zoneBadges: string; sigTabs: number; sigTiles: number;
}> {
  configureSim(LITE);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;left:0;top:0;width:800px;height:450px';
  document.body.appendChild(canvas);
  const overlay = document.createElement('div');
  document.body.appendChild(overlay);

  const gpu = await Gpu.headless(800, 450);
  const camera = new Camera();
  const stats = new Stats(document.createElement('div'));
  const renderer = new Renderer(gpu, camera, stats);
  renderer.clockRunning = false;
  renderer.useWorld(defaultWorld(renderer.world.grid));
  grantAll(renderer.world);
  renderer.build();
  // Straight down over the middle of the map, so a screen point maps to a cell
  // without depending on the terrain.
  camera.setViewport(800, 450);
  camera.focus[0] = 0; camera.focus[2] = 0;
  camera.pitch = 1.2;
  camera.distance = 400;
  camera.update();

  const tools = new BuildTools(canvas, camera, renderer, overlay);
  // The bar is built hidden, because at boot the main menu is over it. This
  // probe is testing the game rather than the menu, so it starts where a
  // player starts: in play, with the toolbar up.
  tools.visible = true;
  const world = renderer.world;
  const count = (a: Uint8Array): number => {
    let n = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== 0) n++;
    return n;
  };
  const roadCellsBefore = count(world.net.cls);
  const zonedBefore = count(world.zones);

  const drag = (kind: string, x0: number, y0: number, x1: number, y1: number): void => {
    const opts = { bubbles: true, clientX: 0, clientY: 0, button: 0, pointerId: 1 };
    canvas.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: x0, clientY: y0 }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: x1, clientY: y1 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: x1, clientY: y1 }));
    void kind;
  };

  // The toolbar buttons are the only way in, which is the point: this tests
  // what a player can reach, not an internal method.
  // Matched on the tooltip or on the face of the button, because the bar uses
  // one and the drawers' tabs and tiles use the other -- and a probe that can
  // only reach half the controls is not testing what a player can reach.
  const press = (label: string): void => {
    const b = Array.from(overlay.querySelectorAll('button')).find((el) => {
      const h = el as HTMLElement;
      return named(h).startsWith(label) || (h.textContent ?? '').trim().startsWith(label);
    });
    (b as HTMLElement | undefined)?.click();
  };

  press('Roads');
  press('Avenue');
  const picked = tools.active;
  drag('road', 120, 120, 640, 130);

  press('Zoning');
  press('medium residential');
  drag('zone', 200, 200, 420, 340);

  // And a service, placed from its drawer -- the other half of the palette,
  // and the only one whose buttons are built on demand rather than at boot.
  const lotsBefore = world.lots.length;
  press('Parks');
  const drawer = Array.from(overlay.querySelectorAll('div'))
    .find((el) => (el as HTMLElement).dataset.branch !== undefined);
  const tiles = drawer ? Array.from(drawer.querySelectorAll('button')) : [];
  const tile = tiles.find((el) => (el.textContent ?? '').includes('Playground')) ?? tiles[0];
  (tile as HTMLElement | undefined)?.click();
  // Swept, because a single point lands on a carriageway about as often as not
  // and a playground must not go on one. What is being tested is that placing
  // works at all, not that any particular pixel is buildable.
  const clickAt = (x: number, y: number): void => {
    const o = { bubbles: true, clientX: x, clientY: y, button: 0, pointerId: 1 };
    canvas.dispatchEvent(new PointerEvent('pointermove', o));
    canvas.dispatchEvent(new PointerEvent('pointerdown', o));
    canvas.dispatchEvent(new PointerEvent('pointerup', o));
  };
  for (let y = 180; y <= 340 && world.lots.length === lotsBefore; y += 20) {
    for (let x = 200; x <= 620 && world.lots.length === lotsBefore; x += 20) clickAt(x, y);
  }

  // What the two rebuilt drawers actually hold.
  //
  // Both are grids built from data, and both have been wrong in ways a
  // screenshot would show and a smoke test would not: a zone drawer with one
  // tile per density rather than one per style, and a landmark list with every
  // zone in it at once. These count what is on screen.
  const openDrawer = (): HTMLElement | undefined => Array.from(overlay.querySelectorAll('div'))
    .find((el) => (el as HTMLElement).dataset.branch !== undefined) as HTMLElement | undefined;
  press('Zoning');
  const zonePanel = openDrawer();
  const zoneButtons = zonePanel ? Array.from(zonePanel.querySelectorAll('button')) : [];
  // A badge is the small black block on a tile; the tabs across the top carry
  // none, so this counts the styles on offer.
  const badges = zoneButtons
    .map((b) => Array.from(b.querySelectorAll('span'))
      .find((sp) => (sp as HTMLElement).style.position === 'absolute'))
    .filter((sp): sp is HTMLSpanElement => sp !== undefined)
    .map((sp) => sp.textContent ?? '');

  press('Landmarks');
  const sigPanel = openDrawer();
  const sigButtons = sigPanel ? Array.from(sigPanel.querySelectorAll('button')) : [];
  // The tab row is the panel's first child; everything after it is a tile.
  const sigTabRow = sigPanel?.firstElementChild;
  const sigTabs = sigTabRow ? sigTabRow.querySelectorAll('button').length : 0;

  return {
    roadCellsBefore, roadCellsAfter: count(world.net.cls),
    zonedBefore, zonedAfter: count(world.zones), picked,
    lotsBefore, lotsAfter: world.lots.length, drawerSize: tiles.length,
    zoneTiles: zoneButtons.length,
    zoneBadges: [...new Set(badges)].join(','),
    sigTabs, sigTiles: sigButtons.length - sigTabs,
  };
}

/**
 * Watches a freshly zoned block come up out of the ground.
 *
 * The growth is a vertex-shader effect keyed on a per-instance birth time, so
 * it is invisible to every other test here: the instance count is right, the
 * buffers are right, and the buildings could still be flat on the floor or
 * standing full height the instant they appear. What this measures is how much
 * of the frame is lit geometry at three moments after the edit -- which has to
 * climb, and has to stop climbing.
 */
export async function probeGrowth(width: number, height: number):
Promise<{ lit: number[]; debug: number[]; count: number }> {
  configureSim(LITE);
  const gpu = await Gpu.headless(width, height);
  const camera = new Camera();
  const stats = new Stats(document.createElement('div'));
  const renderer = new Renderer(gpu, camera, stats);
  renderer.clockRunning = false;
  grantAll(renderer.world);
  renderer.build();
  camera.setViewport(width, height);
  camera.focus[0] = 0; camera.focus[2] = 0;
  camera.pitch = 0.22; camera.distance = 240; camera.yaw = 0.62;
  camera.update();

  // A street, and housing zoned along it. Nothing stands here before this.
  const g = renderer.world.grid;
  renderer.world.net.addCells(4, g >> 1, g - 5, g >> 1, 'street');
  paint(renderer.world, 6, (g >> 1) + 3, g - 12, 10, zoneCode('residential', 'high'));
  // Released, because this probe is about the shader and not about the economy.
  // Zoned land now waits for the city to earn it -- which takes game days and a
  // running simulation -- and without this the block the probe is watching never
  // comes up at all, so it measured a frame in which nothing happened and passed.
  renderer.world.grown.fill(1);
  renderer.rebuild();

  const lit: number[] = [];
  const debug: number[] = [];
  let first: Uint8Array | null = null;
  // The shader reads performance.now(); the frames are taken far enough apart
  // that the curve has visibly moved between them.
  for (const wait of [0, 900, 2600]) {
    const until = performance.now() + wait;
    while (performance.now() < until) { /* the clock is the input */ }
    renderer.frameForTools(performance.now());
    await gpu.device.queue.onSubmittedWorkDone();
    const px = await gpu.readPixels();
    // How much of the frame differs from the first one.
    //
    // Not a count of lit pixels: thirty houses coming up in a valley full of
    // trees move that figure by less than a tenth of a per cent, which is
    // indistinguishable from nothing. What is unambiguous is whether the
    // picture changed at all, and by how much -- the scene is otherwise frozen,
    // so every pixel that moved, moved because a building grew.
    if (first === null) {
      first = px.slice();
      lit.push(0);
    } else {
      let moved = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (Math.abs(px[i] - first[i]) + Math.abs(px[i + 1] - first[i + 1])
          + Math.abs(px[i + 2] - first[i + 2]) > 12) moved++;
      }
      lit.push(Math.round((moved / (px.length / 4)) * 1000) / 10);
    }
    debug.push(Math.round(performance.now() / 100) / 10);
  }
  return { lit, debug, count: renderer.summary.buildings };
}

/**
 * Does rebuilding only the changed part give the same city as rebuilding it all?
 *
 * The whole safety of the incremental path rests on this, and nothing else here
 * can see it: an incremental rebuild that quietly loses a street of houses
 * produces a perfectly ordinary frame with a street of houses missing.
 *
 * `makeCity` is deterministic, which makes a rebuild from nothing a perfect
 * oracle. After each edit the incremental result is compared against one, and
 * what comes back is how far apart they are.
 */
export function probeIncremental(): { worst: number; sizes: string; roads: string } {
  configureSim(LITE);
  const g = simConfig.cityGrid;
  const key = (d: Float32Array, i: number): string => {
    const o = i * INSTANCE_FLOATS;
    return `${Math.round(d[o])},${Math.round(d[o + 1])},${d[o + 7]}`;
  };
  const setOf = (c: { data: Float32Array; count: number }): Set<string> => {
    const out = new Set<string>();
    for (let i = 0; i < c.count; i++) out.add(key(c.data, i));
    return out;
  };

  const w = emptyWorld(g);
  for (let p = 0; p < PLOTS * PLOTS; p++) w.land.take(p);
  for (let i = -3; i <= 3; i++) {
    const t = (i / 3) * (g * 0.36) * 8;
    w.net.add(t, -g * 3, t, g * 3, 'street');
    w.net.add(-g * 3, t, g * 3, t, 'street');
  }
  paint(w, 4, 4, g - 8, g - 8, zoneCode('residential', 'medium'));
  clearStanding(); clearWild(); clearGrading();
  makeCity(w);

  /**
   * A fingerprint of the road mesh.
   *
   * Every kerb, marking, junction polygon and grading pin in the city, as four
   * numbers. The point of caching the road mesh piece by piece is that the
   * pieces nobody touched come back identical, and "identical" has to mean
   * bit-for-bit or the roads drift a little further from the truth with every
   * road drawn. A count alone would miss a vertex in the wrong place, so the
   * sum goes in too -- scaled and truncated, because a float sum over a hundred
   * thousand vertices loses its low bits to rounding and would report a
   * difference that is not there.
   */
  const fingerprint = (m: { vertices: Float32Array; indices: Uint32Array;
    pins: Array<{ gx: number; gz: number; y: number }> }): string => {
    let v = 0;
    for (let i = 0; i < m.vertices.length; i++) v += Math.round(m.vertices[i] * 64);
    let x = 0;
    for (let i = 0; i < m.indices.length; i++) x += m.indices[i];
    let p = 0;
    for (const q of m.pins) p += q.gx * 7919 + q.gz * 104729 + Math.round(q.y * 64);
    return `${m.vertices.length}:${m.indices.length}:${m.pins.length}:${v}:${x}:${p}`;
  };

  let worst = 0;
  let sizes = '';
  let roads = 'same';
  const edits: Array<() => Dirty> = [
    () => { w.net.add(-40, -260, -40, 260, 'street');
      return { gx: (g >> 1) - 8, gz: 4, w: 16, d: g - 8 }; },
    () => { const r = { gx: 10, gz: 10, w: 18, d: 18 };
      paint(w, r.gx, r.gz, r.w, r.d, zoneCode('commercial', 'high')); return r; },
    // A road drawn onto the end of another, which is what chaining does and
    // where the junction radii at the shared node change under both.
    () => { w.net.add(-40, 260, 240, 400, 'avenue');
      return { gx: (g >> 1) - 12, gz: (g >> 1) + 20, w: 44, d: 26 }; },
    // And a landmark, whose grounds reach well past its own footprint.
    () => { const r = { gx: 30, gz: g - 34, w: 10, d: 10 };
      paint(w, r.gx, r.gz, r.w, r.d, zoneCode('industrial', 'high'));
      return { gx: r.gx - 2, gz: r.gz - 2, w: r.w + 4, d: r.d + 4 }; },
  ];
  for (const edit of edits) {
    const dirty = edit();
    clearGrading();
    const partial = makeCity(w, dirty);
    const incRoads = fingerprint(partial.roads);
    const inc = setOf(partial);
    clearStanding(); clearWild(); clearRoadMesh(); clearGrading();
    const whole = makeCity(w);
    if (fingerprint(whole.roads) !== incRoads) {
      roads = `differ: ${incRoads} vs ${fingerprint(whole.roads)}`;
    }
    const ref = setOf(whole);
    // Put the incremental city back, so the next edit runs on what the game
    // would actually be holding.
    clearGrading(); makeCity(w);
    let apart = 0;
    for (const k of ref) if (!inc.has(k)) apart++;
    for (const k of inc) if (!ref.has(k)) apart++;
    worst = Math.max(worst, (apart / Math.max(1, ref.size)) * 100);
    sizes += `${inc.size}/${ref.size} `;
  }
  // And the drag preview, which builds a one-link graph of its own on every
  // pointer move. If that were allowed into the caches it would replace the
  // city's road pieces with its own, and the next real rebuild would find
  // nothing kept -- once per frame, for the length of a drag.
  clearGrading();
  const before = makeCity(w, { gx: 4, gz: 4, w: 8, d: 8 });
  const beforeRoads = fingerprint(before.roads);
  for (let i = 0; i < 4; i++) {
    previewRoad(g, -100 + i * 20, -100, 200, 240, 'street', 0, baseHeightAt);
  }
  clearGrading();
  const after = makeCity(w, { gx: 4, gz: 4, w: 8, d: 8 });
  if (fingerprint(after.roads) !== beforeRoads) {
    roads = 'the drag preview changed the city\u2019s own road mesh';
  }

  clearStanding();
  return { worst: Math.round(worst * 100) / 100, sizes: sizes.trim(), roads };
}

/**
 * Buys land through the toolbar, the way a player does.
 *
 * Nothing else here can see this: the plots are drawn by the terrain shader
 * from a bitmask, and a screenshot of a grid says nothing about whether
 * clicking one of its squares buys anything. What is being asked is whether the
 * tool takes the pointer, whether a click on a plot next to your own takes it,
 * and whether zoning off your land is refused.
 */
export async function probeLand(): Promise<{
  owned: number; after: number; zonedOffLand: number; camera: number;
}> {
  configureSim(LITE);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;left:0;top:0;width:800px;height:450px';
  document.body.appendChild(canvas);
  const overlay = document.createElement('div');
  document.body.appendChild(overlay);

  const gpu = await Gpu.headless(800, 450);
  const camera = new Camera();
  const stats = new Stats(document.createElement('div'));
  const renderer = new Renderer(gpu, camera, stats);
  renderer.clockRunning = false;
  renderer.build();
  camera.setViewport(800, 450);
  camera.focus[0] = 0; camera.focus[2] = 0;
  camera.pitch = 1.2; camera.distance = 400; camera.update();

  const tools = new BuildTools(canvas, camera, renderer, overlay);
  tools.visible = true;
  const world = renderer.world;
  const owned = world.land.count;

  const press = (label: string): void => {
    const b = Array.from(overlay.querySelectorAll('button')).find((el) => {
      const h = el as HTMLElement;
      return named(h).startsWith(label) || (h.textContent ?? '').trim().startsWith(label);
    });
    (b as HTMLElement | undefined)?.click();
  };
  const clickAt = (x: number, y: number): void => {
    const o = { bubbles: true, clientX: x, clientY: y, button: 0, pointerId: 1 };
    canvas.dispatchEvent(new PointerEvent('pointermove', o));
    canvas.dispatchEvent(new PointerEvent('pointerdown', o));
    canvas.dispatchEvent(new PointerEvent('pointerup', o));
  };

  press('Buy land');
  const lifted = camera.distance;
  // Sweep: somewhere in this arc is a plot touching the four you start with.
  for (let y = 60; y <= 400 && world.land.count === owned; y += 24) {
    for (let x = 40; x <= 760 && world.land.count === owned; x += 24) clickAt(x, y);
  }
  const after = world.land.count;

  // And zoning beyond the frontier, which must not take. The far corner of the
  // map is as far from the middle four plots as the map goes.
  press('Zoning');
  press('medium residential');
  const before = (() => { let n = 0; for (const z of world.zones) if (z !== 0) n++; return n; })();
  const drag = (x0: number, y0: number, x1: number, y1: number): void => {
    const o = { bubbles: true, button: 0, pointerId: 1 };
    canvas.dispatchEvent(new PointerEvent('pointerdown', { ...o, clientX: x0, clientY: y0 }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { ...o, clientX: x1, clientY: y1 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { ...o, clientX: x1, clientY: y1 }));
  };
  // A long drag from one screen corner to the other crosses the frontier, so
  // this is the case that matters: it must be refused whole, not clipped.
  drag(20, 20, 120, 90);
  let now = 0;
  for (const z of world.zones) if (z !== 0) now++;

  tools.dispose();
  return { owned, after, zonedOffLand: now - before, camera: Math.round(lifted) };
}

/**
 * Lays a curved run through the toolbar, and reports what the graph got.
 *
 * The two things a player complains about here are invisible in a frame: a
 * road that comes out straight when they asked for a bend, and a run of
 * segments that ends up as separate roads with a break between them. Both are
 * questions about the graph, so this asks the graph -- over a cleared map, so
 * the counts are exact rather than relative to whatever the generator built.
 */
export async function probeCurve(): Promise<{
  links: number; nodes: number; deadEnds: number; bowed: number; longest: number;
}> {
  configureSim(LITE);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;left:0;top:0;width:800px;height:450px';
  document.body.appendChild(canvas);
  const overlay = document.createElement('div');
  document.body.appendChild(overlay);

  const gpu = await Gpu.headless(800, 450);
  const camera = new Camera();
  const stats = new Stats(document.createElement('div'));
  const renderer = new Renderer(gpu, camera, stats);
  renderer.clockRunning = false;
  grantAll(renderer.world);
  renderer.build();
  camera.setViewport(800, 450);
  camera.focus[0] = 0; camera.focus[2] = 0;
  camera.pitch = 1.2;
  camera.distance = 400;
  camera.update();

  const world = renderer.world;
  demolish(world, 0, 0, world.grid, world.grid);
  renderer.rebuild();

  const tools = new BuildTools(canvas, camera, renderer, overlay);
  tools.visible = true;   // as above: the probe plays the game, not the menu
  // Matched on the tooltip or on the face of the button, because the bar uses
  // one and the drawers' tabs and tiles use the other -- and a probe that can
  // only reach half the controls is not testing what a player can reach.
  const press = (label: string): void => {
    const b = Array.from(overlay.querySelectorAll('button')).find((el) => {
      const h = el as HTMLElement;
      return named(h).startsWith(label) || (h.textContent ?? '').trim().startsWith(label);
    });
    (b as HTMLElement | undefined)?.click();
  };
  const opts = { bubbles: true, button: 0, pointerId: 1 };
  const click = (x: number, y: number): void => {
    canvas.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: x, clientY: y }));
    canvas.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: x, clientY: y }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: x, clientY: y }));
  };

  press('Roads');
  press('Curved');
  press('Avenue');
  void tools;

  // Two segments, chained: start, bend, end -- then bend, end again. If the
  // chain works the second run starts where the first ended and the middle
  // node has two arms rather than two nodes having one each.
  click(180, 300);
  click(330, 190);
  click(420, 300);
  click(540, 190);
  click(640, 300);
  canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 640, clientY: 300 }));

  let deadEnds = 0, nodes = 0;
  const arms = new Int32Array(world.net.nodes.length);
  for (const l of world.net.links) { arms[l.a]++; arms[l.b]++; }
  // Only nodes something is attached to. Clearing the map leaves the nodes of
  // what was there behind with nothing joined to them, and they are not part
  // of the question being asked.
  for (let i = 0; i < arms.length; i++) {
    if (arms[i] > 0) nodes++;
    if (arms[i] === 1) deadEnds++;
  }

  // How far each link's control point sits off its own chord: zero is a
  // straight, and a bend the player clicked out is tens of metres.
  let bowed = 0, longest = 0;
  for (const l of world.net.links) {
    const a = world.net.nodes[l.a], b = world.net.nodes[l.b];
    const off = Math.hypot(l.cx - (a.x + b.x) / 2, l.cz - (a.z + b.z) / 2);
    if (off > 4) bowed++;
    longest = Math.max(longest, off);
  }
  return { links: world.net.links.length, nodes, deadEnds, bowed, longest };
}

/**
 * The upgrade tool: convert a road that is already there, without losing it.
 *
 * The thing this has to prove is that the road survives and only its class
 * changes -- the failure mode is a tool that bulldozes and rebuilds, which
 * takes the buildings along the road with it and renumbers the graph.
 */
export async function probeUpgrade(): Promise<{
  before: string; after: string; links: number; kept: number; widened: boolean;
}> {
  configureSim(LITE);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;left:0;top:0;width:800px;height:450px';
  document.body.appendChild(canvas);
  const overlay = document.createElement('div');
  document.body.appendChild(overlay);

  const gpu = await Gpu.headless(800, 450);
  const camera = new Camera();
  const stats = new Stats(document.createElement('div'));
  const renderer = new Renderer(gpu, camera, stats);
  renderer.clockRunning = false;
  grantAll(renderer.world);
  renderer.build();
  camera.setViewport(800, 450);
  camera.focus[0] = 0; camera.focus[2] = 0;
  camera.pitch = 1.2;
  camera.distance = 400;
  camera.update();

  const world = renderer.world;
  demolish(world, 0, 0, world.grid, world.grid);
  const g = world.grid, c = g >> 1;
  world.net.addCells(c - 18, c, c + 18, c, 'street');
  renderer.rebuild();

  const before = world.net.links[0].cls;
  const links = world.net.links.length;
  const ids = world.net.links.map((l) => l.id).join(',');
  const cells = world.net.cls.reduce((n, v) => n + (v !== 0 ? 1 : 0), 0);

  const tools = new BuildTools(canvas, camera, renderer, overlay);
  tools.visible = true;
  const press = (label: string): void => {
    const b = Array.from(overlay.querySelectorAll('button')).find((el) => {
      const h = el as HTMLElement;
      return named(h).startsWith(label) || (h.textContent ?? '').trim().startsWith(label);
    });
    (b as HTMLElement | undefined)?.click();
  };
  press('Roads');
  press('Upgrade');
  press('Avenue');
  void tools;

  // A drag straight down the middle of the screen, where the road is.
  const opts = { bubbles: true, button: 0, pointerId: 1 };
  canvas.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: 250, clientY: 225 }));
  canvas.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: 250, clientY: 225 }));
  canvas.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: 550, clientY: 232 }));
  canvas.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: 550, clientY: 232 }));

  const after = world.net.links[0]?.cls ?? 'gone';
  const kept = world.net.links.map((l) => l.id).join(',') === ids ? links : 0;
  const now = world.net.cls.reduce((n, v) => n + (v !== 0 ? 1 : 0), 0);
  return { before, after, links: world.net.links.length, kept, widened: now > cells };
}

export async function shoot(req: ShotRequest): Promise<Shot> {
  if (req.lite) configureSim(LITE);
  if (req.map !== undefined && req.map !== '') useMap(req.map);

  const gpu = await Gpu.headless(req.width, req.height);
  const camera = new Camera();
  // The overlay writes into a detached element: nothing here has a document
  // to speak of, and the numbers are read out of the map afterwards.
  const host = document.createElement('div');
  const stats = new Stats(host);
  const renderer = new Renderer(gpu, camera, stats);
  // A picture wants a fixed hour, or two runs of the same shot differ.
  renderer.clockRunning = false;
  renderer.timeOfDay = req.hour;
  renderer.weather.set(req.front ?? 0.08);
  if (req.season !== undefined) renderer.seasonHeld = req.season;
  // A photograph of empty land is a photograph of nothing, so unless the
  // caller asked for the starting map it gets the generated city.
  renderer.useWorld(req.empty === true ? startingWorld(renderer.world.grid) : defaultWorld(renderer.world.grid));
  // A photograph is of a city, not of a land-buying decision: the shot tools
  // get the whole map so the picture shows what the generator makes of it.
  if (req.empty !== true) grantAll(renderer.world);
  if (req.land === true) { renderer.landView = 1; renderer.hotPlot = 28; }
  renderer.build();

  if (req.edit === true) {
    const w = renderer.world;
    const g = w.grid;
    const c = g >> 1;
    // Clear a quarter of the map back to open ground, then build into it.
    demolish(w, c - 22, c - 22, 44, 44);
    // One avenue and two streets off it, drawn as a player would: each ends
    // on the avenue rather than being aligned to anything.
    // A boulevard sweeping across the cleared ground, two streets curving off
    // it, and one straight -- the shapes a player draws, and the ones the
    // tiled network could not make at all.
    w.net.addCells(c - 20, c - 6, c + 20, c - 6, 'dual', 90);
    w.net.addCells(c - 12, c - 6, c - 12, c + 16, 'street', -40);
    w.net.addCells(c + 6, c - 6, c + 6, c + 14, 'street', 30);
    w.net.addCells(c - 12, c + 10, c + 6, c + 10, 'street');
    // A run of the newer classes side by side, so a shot of this scene shows
    // the surfaces against each other rather than one at a time.
    w.net.addCells(c - 20, c + 16, c + 20, c + 16, 'boulevard');
    w.net.addCells(c - 20, c + 22, c + 20, c + 22, 'pedestrian');
    w.net.addCells(c - 20, c + 26, c + 20, c + 26, 'track');
    w.net.addCells(c - 20, c + 30, c + 20, c + 30, 'industrial');
    w.net.addCells(c - 20, c + 34, c + 20, c + 34, 'cycleStreet');
    // A tight curve continued by a much wider class, which is the join that
    // was reported as "not connected properly": two arms, very different
    // widths, arriving at an angle.
    w.net.addCells(c - 30, c - 30, c - 14, c - 18, 'street', 70);
    w.net.addCells(c - 14, c - 18, c + 4, c - 30, 'motorway', -60);
    paint(w, c - 20, c - 20, 40, 12, zoneCode('commercial', 'high'));
    paint(w, c - 20, c - 2, 40, 26, zoneCode('residential', 'medium'));
    renderer.rebuild();
  }

  let focus: [number, number] = [req.focus[0], req.focus[1]];
  if (req.industry !== undefined && req.industry !== '') {
    const kind = req.industry as 'fertile';
    const w = renderer.world;
    w.land.lo = 0xffffffff; w.land.hi = 0xffffffff;
    const f = resourceFields();
    const half = w.grid / 2, cellM = f.extent / RES_GRID;
    // The richest ground a headquarters fits beside: score each cell by the
    // resource in a disc round it, so the area lands on a field, not a speck.
    let best = -1, bestV = 0;
    const R = 7;
    for (let j = R; j < RES_GRID - R; j += 2) {
      for (let i = R; i < RES_GRID - R; i += 2) {
        let v = 0;
        for (let dj = -R; dj <= R; dj += 2) for (let di = -R; di <= R; di += 2) v += f.amount[kind][(j + dj) * RES_GRID + i + di];
        if (v > bestV) { bestV = v; best = j * RES_GRID + i; }
      }
    }
    const x = -f.extent / 2 + ((best % RES_GRID) + 0.5) * cellM;
    const z = -f.extent / 2 + (Math.floor(best / RES_GRID) + 0.5) * cellM;
    const rad = 300;
    let lot: [number, number] | null = null;
    for (let r = 0; r < 60 && lot === null; r++) {
      for (let t = 0; t < 12 && lot === null; t++) {
        const a = (t / 12) * Math.PI * 2;
        const gx = Math.round((x + Math.cos(a) * r * 8) / 8 + half) - 3;
        const gz = Math.round((z + Math.sin(a) * r * 8) / 8 + half) - 2;
        if (lotFits(w, `spec.hq.${kind}`, gx, gz, 0).why === null) lot = [gx, gz];
      }
    }
    if (lot !== null) {
      placeLot(w, `spec.hq.${kind}`, lot[0], lot[1], 0);
      const hq = w.industry.add({ kind, gx: lot[0], gz: lot[1], w: 6, d: 5, area: [], exportShare: 1 });
      const poly: number[] = [];
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        const rr = rad * (0.8 + 0.25 * Math.sin(k * 2.1));
        poly.push(x + Math.cos(a) * rr, z + Math.sin(a) * rr);
      }
      w.industry.setArea(hq, poly);
      renderer.rebuild();
      focus = [x, z];
    }
  }

  camera.yaw = req.yaw;
  camera.pitch = req.pitch;
  camera.distance = req.distance;
  camera.focus[0] = focus[0];
  camera.focus[2] = focus[1];
  camera.update();

  // An information view, if one was asked for. Built after the camera so the
  // simulation spends its first ticks on what the shot is pointed at.
  let live: LiveCity | null = null;
  if (req.view !== undefined && req.view !== '') {
    live = new LiveCity(renderer, camera, stats, host);
    // The renderer is already built, so the notification that creates the
    // simulation has been and gone. One more rebuild hands it the city.
    renderer.rebuild();
    live.playing = true;
    for (let i = 0; i < 120; i++) live.update(1 / 30, performance.now());
    const b = Array.from(host.querySelectorAll('button'))
      .find((el) => named(el) === req.view);
    if (b === undefined) throw new Error(`no such view: ${req.view}`);
    // The launcher first: the rail is hidden until it is pressed, and a click on
    // a hidden button still lands, which would make a typo here look like a pass.
    const launcher = Array.from(host.querySelectorAll('button'))
      .find((el) => named(el) === 'Information views');
    launcher?.click();
    b.click();
    live.update(1 / 30, performance.now());
  }

  // Driven by hand rather than by requestAnimationFrame: a tool wants a known
  // number of frames, and wants to know when they are done.
  for (let i = 0; i < req.frames; i++) {
    camera.update();
    renderer.frameForTools(performance.now());
    await gpu.device.queue.onSubmittedWorkDone();
  }

  const pixels = await gpu.readPixels();
  return { pixels, stats: stats.snapshot() };
}

/**
 * The information views, driven through the interface, asserted on the pixels.
 *
 * There are three ways this can be broken and a screenshot shows none of them.
 * The panel can go up with no icons, because a glyph key does not match. The
 * click can reach the simulation and never reach the GPU, because the uniform was
 * written to a buffer nothing samples. And the shader can sample it and change
 * nothing, because the bind group went to the wrong index -- which WebGPU is
 * perfectly happy with as long as nothing reads it.
 *
 * So the probe clicks the launcher, clicks a view, and compares the frame with
 * the frame before it. A view that is working moves a large fraction of the
 * picture towards the colours of its own ramp; an underground view makes the
 * picture darker. Both are claims about the pixels, which is the only level at
 * which "the heatmap shows" is a true or false statement.
 */
export async function probeViews(): Promise<{
  icons: number; railHidden: boolean; railShown: boolean;
  title: string; rows: number; bars: number;
  /** Mean brightness of the frame, per stage. */
  plain: number; traffic: number; buried: number;
  /** Share of pixels that changed by more than a rounding error. */
  trafficMoved: number; buriedMoved: number;
  closed: boolean; closedBack: number;
  population: number; views: string[];
  budgetRows: number; taxSliders: number; fundSliders: number; rateMoved: boolean; budgetPainted: number;
}> {
  configureSim(LITE);
  const ui = document.createElement('div');
  document.body.appendChild(ui);

  const gpu = await Gpu.headless(320, 180);
  const camera = new Camera();
  const stats = new Stats(document.createElement('div'));
  const renderer = new Renderer(gpu, camera, stats);
  renderer.clockRunning = false;
  renderer.timeOfDay = 0.42;
  renderer.weather.set(0.05);
  const live = new LiveCity(renderer, camera, stats, ui);
  renderer.useWorld(defaultWorld(renderer.world.grid));
  grantAll(renderer.world);
  renderer.build();
  live.playing = true;

  camera.yaw = 0.6; camera.pitch = 0.62; camera.distance = 520;
  camera.focus[0] = 0; camera.focus[2] = 0;
  camera.update();

  // Enough simulated time for the utilities to settle and somebody to be on the
  // road, so the views have something to say.
  for (let i = 0; i < 90; i++) live.update(1 / 30, performance.now());

  const frame = async (): Promise<Uint8Array> => {
    camera.update();
    renderer.frameForTools(performance.now());
    await gpu.device.queue.onSubmittedWorkDone();
    return gpu.readPixels();
  };
  const mean = (px: Uint8Array): number => {
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += px[i] + px[i + 1] + px[i + 2];
    return sum / (px.length / 4) / 3;
  };
  const moved = (a: Uint8Array, b: Uint8Array): number => {
    let n = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1])
        + Math.abs(a[i + 2] - b[i + 2]) > 12) n++;
    }
    return n / (a.length / 4);
  };

  const plainPx = await frame();
  // Hidden rather than absent: the buttons are built once and the rail is shown
  // and hidden, so counting elements would say it was open from the start.
  const shown = (part: string): boolean => {
    const el = ui.querySelector(`[data-panel="${part}"]`);
    return el instanceof HTMLElement && el.style.display !== 'none';
  };
  const railHidden = !shown('view-rail');

  const press = (label: string): boolean => {
    const b = Array.from(ui.querySelectorAll('button'))
      .find((el) => named(el) === label);
    if (b === undefined) return false;
    b.click();
    return true;
  };
  press('Information views');
  // Scoped to the rail rather than to the whole interface layer. The thought
  // bubbles are buttons too and they live in the same layer, so counting every
  // button in it counted the city's complaints as information views.
  const rail = ui.querySelector('[data-panel="view-rail"]');
  const icons = rail === null ? 0 : rail.querySelectorAll('button').length;
  const railShown = shown('view-rail');
  const views = rail === null ? []
    : Array.from(rail.querySelectorAll('button')).map((b) => named(b as HTMLElement));

  press('Traffic');
  live.update(1 / 30, performance.now());
  const trafficPx = await frame();
  const title = (ui.textContent ?? '').slice(0, 7);
  // A row is a label, a value and a track; a bar is a track that is showing.
  const rows = ui.querySelectorAll('[data-stat]').length;
  let bars = 0;
  for (const t of Array.from(ui.querySelectorAll('[data-bar]'))) {
    if ((t as HTMLElement).style.display !== 'none') bars++;
  }

  press('Power');
  live.update(1 / 30, performance.now());
  const buriedPx = await frame();

  // Closing puts the map back. Not "roughly back": the same uniform is zeroed,
  // so the frame has to return to what it was within the noise of one frame.
  press('Power');
  const backPx = await frame();
  const closed = !shown('view-stats');
  // Two ticks passed between the first frame and this one, and the traffic
  // moved in them. Two more with nothing open measure how much of the frame
  // that is on its own, so what is left over is the view, not the cars.
  live.update(1 / 30, performance.now());
  live.update(1 / 30, performance.now());
  const settledPx = await frame();
  const moving = moved(backPx, settledPx);

  // The budget, which is the one view that is not a map: it paints nothing and
  // it carries controls. Both halves are checked, because a tax slider that does
  // not move the rate is a slider, and a rate that does not move the panel above
  // it is a number in a different room.
  // The same tick with nothing opened, first: how much of the frame a tick of
  // traffic moves on its own. A city with more on its roads moves more of it,
  // and without this the check measured the traffic rather than the panel.
  live.update(1 / 30, performance.now());
  const idlePx = await frame();
  const noise = moved(backPx, idlePx);
  press('Budget');
  live.update(1 / 30, performance.now());
  const budgetRows = ui.querySelectorAll('[data-stat]').length;
  const taxPanel = ui.querySelector('[data-panel="tax"]');
  const sliders = taxPanel === null ? []
    : Array.from(taxPanel.querySelectorAll('[data-tax] input[type=range]')) as HTMLInputElement[];
  const fundSliders = taxPanel === null ? 0 : taxPanel.querySelectorAll('[data-fund] input[type=range]').length;
  const sim = (live as unknown as { sim: Simulation }).sim;
  const wasRate = sim.budget.rates[0];
  if (sliders[0] !== undefined) {
    sliders[0].value = '0.2';
    sliders[0].dispatchEvent(new Event('input', { bubbles: true }));
  }
  const nowRate = sim.budget.rates[0];
  const budgetPx = await frame();
  press('Budget');

  return {
    icons, railHidden, railShown, title, rows, bars,
    plain: mean(plainPx), traffic: mean(trafficPx), buried: mean(buriedPx),
    trafficMoved: moved(plainPx, trafficPx), buriedMoved: moved(plainPx, buriedPx),
    closed, closedBack: Math.max(0, moved(plainPx, backPx) - moving),
    population: live.population, views,
    budgetRows, taxSliders: sliders.length, fundSliders,
    rateMoved: Math.abs(nowRate - wasRate) > 0.01,
    // A budget is not a place: opening it must leave the map exactly as it was.
    // Against the frame just before it opened, not the first one: three updates
    // of traffic and smoke moving is not the budget painting anything, and
    // measured from the start it sat on the threshold and failed by chance.
    budgetPainted: Math.max(0, moved(idlePx, budgetPx) - noise),
  };
}

/**
 * A frame with an information view open, for looking at.
 *
 * Not a test -- a camera. The views are judged by eye and there is no other way
 * to judge them, so this exists to put one in front of one.
 */
/**
 * The whole interface over the whole game, for looking at.
 *
 * Every other probe here presses something and reports a number. This one
 * presses nothing: it builds the game the way a player gets it -- the bar, the
 * readouts, the demand, a notice or two in the corner -- and hands back the
 * frame so the interface can be judged the only way an interface can be, which
 * is by looking at it.
 */
/**
 * A fresh game, zoned the way a player zones it.
 *
 * The one path nothing else here covers: the real starting world, the real
 * tool, the real live city, and time passing. Every other growth probe either
 * paints the zone array by hand or releases the mask outright, so a failure
 * anywhere between the brush and the buildings would go unseen.
 */
export async function probeZoning(): Promise<Record<string, number | string>> {
  configureSim(LITE);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;left:0;top:0;width:900px;height:520px';
  document.body.appendChild(canvas);
  const ui = document.createElement('div');
  document.body.appendChild(ui);

  const gpu = await Gpu.headless(900, 520);
  const camera = new Camera();
  const stats = new Stats(ui);
  const renderer = new Renderer(gpu, camera, stats);
  renderer.clockRunning = false;
  // The world a new game starts on: one road in, nothing built, and a mask that
  // has to be earned.
  renderer.useWorld(startingWorld(renderer.world.grid));
  // Deliberately NOT granting the whole map: a new game owns a few plots, and
  // what a player actually does is zone near the road they were given.
  renderer.build();
  const live = new LiveCity(renderer, camera, stats, ui);
  const tools = new BuildTools(canvas, camera, renderer, ui);
  tools.visible = true;
  live.playing = true;
  camera.setViewport(900, 520);
  camera.pitch = 1.2; camera.distance = 300;
  camera.update();

  const world = renderer.world;
  const g = world.grid, half = g / 2;
  // Beside the road the game starts with.
  let seed: [number, number] | null = null;
  for (let z = 10; z < g - 10 && seed === null; z++) {
    for (let x = 10; x < g - 10; x++) {
      if (world.net.has(x, z)) { seed = [x, z]; break; }
    }
  }
  if (seed === null) return { error: 'no starting road' };
  const before = world.lots.length;

  // Zoned through the tool's own path.
  paint(world, seed[0] + 1, seed[1] - 8, 10, 17, zoneCode('residential', 'low'));
  renderer.rebuild();

  const count = (a: Uint8Array): number => {
    let n = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== 0) n++;
    return n;
  };
  const painted = count(world.zones);

  // Two game days of play, driven the way the frame loop drives it.
  const start = performance.now();
  for (let i = 0; i < 1800; i++) live.update(1 / 20, start + i * 50);

  let released = 0;
  for (let i = 0; i < world.grown.length; i++) {
    if (world.zones[i] !== 0 && world.grown[i] !== 0) released++;
  }
  const sim = (live as unknown as { sim: Simulation }).sim;
  return {
    painted, released,
    homes: sim.places.homeCapacity,
    population: sim.people.population,
    buildings: renderer.summary.buildings,
    lotsBefore: before,
    want: [...sim.demand.want].map((v) => v.toFixed(2)).join(','),
    owed: Math.round(sim.growth?.report.owed ?? 0),
    served: world.mains.netAt((seed[0] + 3 - half) * 8, (seed[1] - half) * 8, 1),
  };
}

/**
 * The zone tool, pressed the way a player presses it.
 *
 * Reports what the drawer offered, what the tool became, and what the drag did
 * to the ground -- which is the chain that has to hold for zoning to work at
 * all, and the one place a change to a button can silently break the game.
 */
export async function probeZoneTool(): Promise<Record<string, unknown>> {
  configureSim(LITE);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;left:0;top:0;width:800px;height:450px';
  document.body.appendChild(canvas);
  const overlay = document.createElement('div');
  document.body.appendChild(overlay);

  const gpu = await Gpu.headless(800, 450);
  const camera = new Camera();
  const stats = new Stats(document.createElement('div'));
  const renderer = new Renderer(gpu, camera, stats);
  renderer.clockRunning = false;
  renderer.useWorld(startingWorld(renderer.world.grid));
  grantAll(renderer.world);
  renderer.build();
  const live = new LiveCity(renderer, camera, stats, overlay);
  const tools = new BuildTools(canvas, camera, renderer, overlay);
  tools.visible = true;
  live.playing = true;
  camera.setViewport(800, 450);
  camera.pitch = 1.2; camera.distance = 380;
  // Over the road the game starts with, so the drag lands beside it.
  const world = renderer.world;
  const g = world.grid, half = g / 2;
  let seed: [number, number] | null = null;
  for (let z = 10; z < g - 10 && seed === null; z++) {
    for (let x = 10; x < g - 10; x++) if (world.net.has(x, z)) { seed = [x, z]; break; }
  }
  if (seed !== null) {
    camera.focus[0] = (seed[0] - half) * 8 + 4;
    camera.focus[2] = (seed[1] - half) * 8 + 4;
  }
  camera.update();

  const press = (label: string): boolean => {
    const b = Array.from(overlay.querySelectorAll('button')).find((el) => {
      const h = el as HTMLElement;
      return named(h).startsWith(label) || (h.textContent ?? '').trim().startsWith(label);
    });
    (b as HTMLElement | undefined)?.click();
    return b !== undefined;
  };
  const kindOf = (): string =>
    (tools as unknown as { tool: { kind: string } }).tool.kind;

  const openedZones = press('Zoning');
  const tiles = Array.from(overlay.querySelectorAll('button'))
    .map((b) => (b.textContent ?? '').trim())
    .filter((t) => t.length > 0)
    .slice(0, 40);
  // The drawer lists the zones as tabs and the themes as tiles, so a player
  // picks Residential and then a theme -- which is what this does.
  press('Residential');
  const pickedTile = press('Whichever');
  const kindAfterTile = kindOf();

  const count = (a: Uint8Array): number => {
    let n = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== 0) n++;
    return n;
  };
  const zonedBefore = count(world.zones);
  const roadBefore = count(world.net.cls);

  const opts = { bubbles: true, clientX: 0, clientY: 0, button: 0, pointerId: 1 };
  canvas.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: 360, clientY: 200 }));
  canvas.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: 470, clientY: 280 }));
  canvas.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: 470, clientY: 280 }));

  const zonedAfter = count(world.zones);
  const roadAfter = count(world.net.cls);

  // And then time, so the ground it zoned can come up.
  const start = performance.now();
  for (let i = 0; i < 1200; i++) live.update(1 / 20, start + i * 50);
  const sim = (live as unknown as { sim: Simulation | null }).sim;
  let released = 0;
  for (let i = 0; i < world.grown.length; i++) {
    if (world.zones[i] !== 0 && world.grown[i] !== 0) released++;
  }

  return {
    openedZones, pickedTile, kindAfterTile, active: tools.active,
    zonedBefore, zonedAfter, roadBefore, roadAfter, released,
    homes: sim?.places.homeCapacity ?? -1,
    population: sim?.people.population ?? -1,
    tiles: tiles.join(' | '),
  };
}

export async function probeHud(width: number, height: number, hour = 0.36, dist = 520,
  panel = ''):
Promise<{ pixels: number[]; movers: string }> {
  configureSim(LITE);
  // The stylesheet the menu installs in the game, so the HUD is photographed
  // as a player sees it.
  installTheme();
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `position:absolute;left:0;top:0;width:${width}px;height:${height}px`;
  document.body.appendChild(canvas);
  const ui = document.createElement('div');
  ui.style.cssText = `position:relative;width:${width}px;height:${height}px`;
  document.body.appendChild(ui);

  const gpu = await Gpu.headless(width, height);
  const camera = new Camera();
  const stats = new Stats(ui);
  const renderer = new Renderer(gpu, camera, stats);
  renderer.clockRunning = false;
  renderer.timeOfDay = hour;
  renderer.weather.set(0.06);
  const live = new LiveCity(renderer, camera, stats, ui);
  renderer.useWorld(defaultWorld(renderer.world.grid));
  grantAll(renderer.world);
  renderer.build();
  const tools = new BuildTools(canvas, camera, renderer, ui);
  tools.visible = true;
  live.playing = true;
  camera.setViewport(width, height);
  const view = (globalThis as unknown as { HUD_VIEW?: [number, number] }).HUD_VIEW;
  camera.yaw = view ? view[0] : 0.62; camera.pitch = view ? view[1] : 0.46; camera.distance = dist;
  // Where to point it. Zero is the middle of the map, which is downtown; a
  // probe judging suburban ground has to be able to go and look at some.
  const aim = (globalThis as unknown as { HUD_AIM?: [number, number] }).HUD_AIM;
  camera.focus[0] = aim ? aim[0] : 0;
  camera.focus[2] = aim ? aim[1] : 0;
  camera.update();

  const sim = (live as unknown as { sim: Simulation }).sim;
  const pl = sim.places;
  // Staffed for the look of it -- except for the accounts, where phantom staff
  // would be phantom taxpayers and the figures would be fiction.
  if (!panel.startsWith('stats')) {
    for (let id = 0; id < pl.count; id++) {
      if (pl.live[id] === 0) continue;
      for (let k = pl.col.working[id]; k < pl.col.jobs[id]; k++) pl.hire(id);
    }
  }
  // A city with people in it: the founding rush alone leaves fifty-odd
  // citizens in three thousand buildings, and a street with nobody on it
  // proves nothing about whether the streets have anybody on them.
  sim.found(900);
  // A day of simulation without a frame in it, so the citizens have jobs to go
  // to and are somewhere between home and work when the picture is taken.
  sim.step(900);
  // And stopped in the morning rush: at four in the morning a correct city has
  // nobody on its pavements, and a picture of that proves nothing.
  for (let i = 0; i < 900 && (sim.clock.minute < 8 * 60 || sim.clock.minute > 9 * 60); i++) {
    sim.step(1);
  }
  for (let i = 0; i < 30; i++) live.update(1 / 20, performance.now() + i * 50);
  // For identifying what is in a shot: the lots nearest the camera's focus.
  if ((window as unknown as { __lots?: boolean }).__lots === true) {
    const w = renderer.world, g = w.grid / 2;
    const near = w.lots.map((l) => ({ id: l.id, d: Math.hypot((l.gx + l.w / 2 - g) * 8 - camera.focus[0],
      (l.gz + l.d / 2 - g) * 8 - camera.focus[2]) }))
      .sort((a, b) => a.d - b.d).slice(0, 12);
    console.log('LOTS ' + near.map((n) => `${n.id}@${Math.round(n.d)}`).join(' '));
  }

  const alerts = (live as unknown as { alerts: Alerts }).alerts;
  alerts.push({
    title: 'Windfall', tone: 'good', figure: '+18k',
    text: '', body: 'A trade fair came to town — the exhibitors paid for the pitch.',
  } as never);
  alerts.push({
    title: 'Power shortfall', tone: 'bad', figure: '86%', tag: 'util-0',
    body: 'The network is supplying 86% of what the city is drawing. '
      + 'Build another plant or a wind farm.',
  } as never);

  // And a building clicked, because the card over the city is half of what the
  // interface is for.
  const col = pl.col;
  let pick = -1;
  for (let id = 0; id < pl.count; id++) {
    if (pl.live[id] !== 0 && col.homes[id] > 0) { pick = id; break; }
  }
  if (pick >= 0) live.tap([col.x[pick], col.z[pick]]);

  // A panel, for photographing one: the development tree, the settings, or the
  // card a city gets when it levels up.
  // A city that has been played for a day has almost certainly levelled up
  // while the probe was not looking, and its card would be over whatever this
  // is photographing.
  if (panel !== 'level') live.levelCard.dismissAll();
  if (panel === 'fire') {
    // Half a dozen buildings alight near the camera, for photographing what a
    // fire looks like. Raised through the dispatch model's own door rather than
    // by drawing smoke somewhere: what is on screen is what the model has open,
    // and an engine is on its way to every one of them.
    const open = (sim.dispatch as unknown as {
      open(kind: number, place: number): void }).open.bind(sim.dispatch);
    let lit = 0;
    for (let id = 0; id < pl.count && lit < 6; id++) {
      if (pl.live[id] === 0) continue;
      if (pl.col.purpose[id] === Purpose.SERVICE) continue;
      const dx = pl.col.x[id], dz = pl.col.z[id];
      if (dx * dx + dz * dz > 260 * 260) continue;
      if ((id % 7) !== 0) continue;
      open(0, id);
      if (lit === 0) {
        // Aimed at the first one, so the picture is of a fire rather than of
        // the city a fire happens to be somewhere in.
        camera.focus[0] = dx;
        camera.focus[2] = dz;
        camera.update();
      }
      lit++;
    }
    // A handful of frames and no more. A fire's patience is eleven game
    // minutes, which is seven ticks -- so a probe that played on for five real
    // seconds photographed a city where every one of them had already been put
    // out or run out of time.
    for (let i = 0; i < 8; i++) live.update(1 / 60, performance.now() + i * 16);
    live.tap(null);
    live.levelCard.dismissAll();
    console.log(`fire: lit ${lit}, blazes ${sim.dispatch.blazes.count}, `
      + `calls ${sim.dispatch.count}`);
  } else if (panel === 'decay') {
    // A quarter nobody is looking after, for photographing what that looks
    // like. The mains come up -- which is what bulldozing the network amounts
    // to -- and the city is played on until the buildings have lost condition.
    // Nothing here reaches past the model: the wear is the wear the lifecycle
    // model worked out, drawn by the shader that draws everything else.
    const world = renderer.world;
    world.mains.bits.fill(0);
    world.mains.rebuild();
    sim.mainsChanged();
    live.speed = 8;
    for (let i = 0; i < 1400; i++) live.update(0.1, performance.now() + i * 100);
    live.speed = 1;
    live.tap(null);
    live.levelCard.dismissAll();
  } else if (panel === 'incidents') {
    // A fire, a break-in and a medical call at the three buildings nearest
    // the middle of the view, then a few seconds of play so the crews set off.
    const pc = sim.places.col;
    const fx = camera.focus[0], fz = camera.focus[2];
    const near: number[] = [];
    for (let p = 0; p < sim.places.count; p++) {
      if (sim.places.live[p] === 0) continue;
      near.push(p);
    }
    near.sort((a, b) => Math.hypot(pc.x[a] - fx, pc.z[a] - fz) - Math.hypot(pc.x[b] - fx, pc.z[b] - fz));
    const open = (sim.dispatch as unknown as { open(k: number, p: number): void }).open.bind(sim.dispatch);
    open(0, near[2]);
    open(1, near[9]);
    open(2, near[16]);
    for (let i = 0; i < 60; i++) live.update(1 / 20, performance.now() + i * 50);
    const iv = sim.dispatch.incidents;
    const shown = document.querySelectorAll('.mr-incident').length;
    console.log(`incidents ${iv.count} kinds ${Array.from(iv.kind.slice(0, iv.count))}`
      + ` states ${Array.from(iv.state.slice(0, iv.count))} markers ${shown}`);
  } else if (panel === 'policies') {
    // The budget view with the ordinance list open, which is the one panel in
    // the game that cannot be photographed by pointing the camera at a city.
    // Two of them are turned on so the card shows both states of a row and the
    // bill at the top of the list has a number in it.
    sim.policies.set(0, true);
    sim.policies.set(4, true);
    // Pressed rather than called, so what is photographed is what a player
    // would get: the launcher, then the budget button on the rail.
    const press = (name: string): void => {
      const all = Array.from(document.querySelectorAll('button'));
      (all.find((b) => b.getAttribute('aria-label') === name) as
        HTMLButtonElement | undefined)?.click();
    };
    press('Information views');
    press('Budget');
    for (let i = 0; i < 12; i++) live.update(1 / 20, performance.now() + 20000 + i * 50);
    (document.querySelector('[data-action="policies-toggle"]') as
      HTMLElement | null)?.click();
    live.update(1 / 20, performance.now() + 21000);
  } else if (panel === 'tech') {
    renderer.world.progress.stars = 6;
    live.tech.show();
  } else if (panel === 'settings') {
    live.settings.show();
  } else if (panel === 'cititok') {
    live.cityName = 'Salford';
    live.cititok.show();
  } else if (panel.startsWith('hall')) {
    // City Hall at each stage of the political year, staged directly on the
    // election model: the LITE city is far too small to hold one of its own.
    live.cityName = 'Salford';
    const w = renderer.world;
    const pol = w.politics;
    const c = { ...CALM, population: 6200, rubbish: 0.12, resTax: 0.12, crime: 0.05 };
    pol.update(1, 0.016, c, w.policies, w.budget);
    pol.setPledges(1, ['recycling', 'taxCut', 'watch']);
    let d = 2;
    for (; d < 9; d++) pol.update(d + 0.5, 0.016, c, w.policies, w.budget);
    if (panel !== 'hall-campaign') {
      for (; pol.phase === 'campaign' && d < 40; d++) pol.update(d + 0.5, 0.016, c, w.policies, w.budget);
      pol.update(d, panel === 'hall-count' ? 9 : 99, c, w.policies, w.budget);
    }
    live.cititok.show();
    live.cititok.showApp('hall');
  } else if (panel === 'sites') {
    // A district under construction, for photographing the stage between
    // zoning and buildings. Handing the released mask back means every zoned
    // cell is waiting again, so the next few seconds of growth open sites all
    // over the city -- which is exactly what a player who has just painted a
    // district sees.
    const world = renderer.world;
    world.grown.fill(0);
    world.painted++;
    sim.growth?.rebind(world);
    live.tap(null);
    // Played at the fast speed, because the whole map has just been handed back
    // and a mature city releases about a patch every three seconds at ordinary
    // pace -- which over a photographable stretch is four plots scattered over
    // four hundred thousand cells. `update` is the game's own frame, so the
    // growth is taken and the city rebuilt exactly as it is in play.
    live.speed = 8;
    for (let i = 0; i < 300; i++) live.update(0.1, performance.now() + i * 100);
    live.speed = 1;
    // Aimed at a plot that is actually being built, so the shot is of the
    // thing rather than of the city it happens to be in.
    const open = sim.growth?.sites;
    if (open !== undefined && open.count > 0) {
      let best = 0;
      for (let i = 1; i < open.count; i++) {
        if (open.progress[i] > open.progress[best]) best = i;
      }
      camera.focus[0] = open.x[best];
      camera.focus[2] = open.z[best];
      camera.update();
      for (let i = 0; i < 10; i++) live.update(1 / 60, performance.now() + i * 16);
    }
  } else if (panel.startsWith('upgrade')) {
    // A service building upgraded through the card's own path, once or twice,
    // then clicked and framed: the wing, the card, the pips.
    const world = renderer.world;
    live.onUpgrade = (lot) => tools.upgrade(lot);
    world.budget.balance = 5e6;
    const times = panel.startsWith('upgrade-1') ? 1 : panel.startsWith('upgrade-0') ? 0 : 2;
    const half = world.grid / 2;
    let done: typeof world.lots[number] | undefined;
    for (const lot of world.lots) {
      if (!lot.id.startsWith('svc.') || lot.w * lot.d > 60) continue;
      if (nextWing(world, lot).why !== null) continue;
      let ok = true;
      for (let i = 0; i < times && ok; i++) ok = tools.upgrade(lot) === null;
      if (ok) { done = lot; break; }
    }
    if (done === undefined) {
      const why = new Map<string, number>();
      for (const lot of world.lots) {
        if (!lot.id.startsWith('svc.')) continue;
        const r = nextWing(world, lot).why ?? 'ok';
        why.set(r, (why.get(r) ?? 0) + 1);
      }
      console.log(`no upgradable lot: ${JSON.stringify([...why])}`);
    }
    // Standing, not rising: a new building grows out of the ground over two
    // seconds of wall clock, which a probe's synthetic frames never reach.
    if (done !== undefined) {
      const r = renderer as unknown as { settled: boolean; settleCity(): void };
      r.settleCity(); r.settled = true; renderer.rebuild();
    }
    if (done !== undefined) {
      for (let i = 0; i < 40; i++) live.update(1 / 20, performance.now() + i * 50);
      sim.applyTiers();
      const x = (done.gx - half + done.w / 2) * 8, z = (done.gz - half + done.d / 2) * 8;
      camera.focus[0] = x; camera.focus[2] = z; camera.distance = dist; camera.update();
      live.tap(null);
      live.tap([x, z]);
      const wg = world.lots.find((l) => l.wingOf?.[0] === done!.gx && l.wingOf?.[1] === done!.gz);
      if (wg !== undefined) {
        const wx = (wg.gx - half + wg.w / 2) * 8, wz = (wg.gz - half + wg.d / 2) * 8;
        const hit = sim.inspect(wx, wz);
        const rc = (renderer as unknown as { city: { count: number; data: Float32Array; population: number[] } }).city;
        const wi = ASSET_INDEX.get(wg.id) ?? -1;
        let hits = 0, where = '';
        for (let i = 0; i < rc.count; i++) if ((rc.data[i * 12 + 7] | 0) === wi) { hits++; where = `${rc.data[i * 12].toFixed(0)},${rc.data[i * 12 + 1].toFixed(0)} y${rc.data[i * 12 + 2].toFixed(1)} h${rc.data[i*12+6].toFixed(1)}`; }
        console.log(`wing proto ${wi} instances ${hits} at ${where}, population ${rc.population[wi]}`);
        console.log(`at the wing ${wx},${wz}: ${hit?.asset} ${hit?.x},${hit?.z}; works at ${x},${z}`);
      }
      console.log(`upgraded ${done.id} ${done.gx},${done.gz} ${done.w}x${done.d} to tier ${done.tier ?? 0}; wing ${wg?.id} at ${wg?.gx},${wg?.gz} ${wg?.w}x${wg?.d} yaw ${wg?.yaw}`);
    }
  } else if (panel === 'districts') {
    const world = renderer.world;
    const D = world.districts;
    const c = world.grid >> 1;
    const a = D.add();
    if (a !== null) D.paint(c - 30, c - 24, 30, 26, a.id);
    const b = D.add();
    if (b !== null) D.paint(c + 2, c - 18, 26, 30, b.id);
    if (a !== null && b !== null) {
      D.toggle(a.id, 'tourism');
      D.toggle(b.id, 'tech');
      D.toggle(b.id, 'garden');
    }
    tools.onDistricts = (f) => live.showDistricts(f);
    tools.districtStats = (id) => live.districtStats(id);
    for (let i = 0; i < 60; i++) live.update(1 / 20, performance.now() + i * 50);
    live.tap(null);
    tools.openDistrictDrawer();
    live.showDistricts(a?.id ?? 0);
    live.update(1 / 20, performance.now() + 4000);
  } else if (panel === 'transit') {
    // A bus line round the middle of the city, run on the game's own clock
    // until its buses are out and dwelling, and framed on a stop.
    const world = renderer.world;
    const nodes = world.net.nodes.filter((n) => Math.hypot(n.x, n.z) > 120 && Math.hypot(n.x, n.z) < 420);
    const pick: number[] = [];
    for (let k = 0; k < 5; k++) {
      const want = (k / 5) * Math.PI * 2;
      let best = nodes[0], bestD = Infinity;
      for (const n of nodes) {
        const d = Math.abs(((Math.atan2(n.z, n.x) - want + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (d < bestD) { bestD = d; best = n; }
      }
      if (best !== undefined) pick.push(best.x, best.z);
    }
    world.transit.add(0, pick, 6);
    live.speed = 1;
    for (let i = 0; i < 600; i++) live.update(1 / 20, performance.now() + i * 50);
    camera.focus[0] = pick[0]; camera.focus[2] = pick[1]; camera.update();
    console.log(`line of ${pick.length / 2} stops; ${sim.transit.report.vehicles} vehicles`);
  } else if (panel === 'airport') {
    const world = renderer.world;
    const half = world.grid / 2;
    const ap = world.lots.find((l) => l.id === 'svc.transport.airport');
    console.log(ap === undefined ? 'no airport in this city' : `airport at ${ap.gx},${ap.gz} yaw ${ap.yaw}`);
    if (ap !== undefined) {
      for (let i = 0; i < 40; i++) live.update(1 / 20, performance.now() + i * 50);
      const aim = (globalThis as unknown as { HUD_AIM?: [number, number] }).HUD_AIM;
      camera.focus[0] = aim?.[0] ?? (ap.gx - half + ap.w / 2) * 8;
      camera.focus[2] = aim?.[1] ?? (ap.gz - half + ap.d / 2) * 8;
      camera.update();
    }
  } else if (panel.startsWith('stats')) {
    // The accounts after a few months of the LITE city, run on the simulation's
    // own clock so the history is what the game records rather than staged.
    live.cityName = 'Salford';
    for (let i = 0; i < 24; i++) sim.step(900);
    live.cititok.show();
    live.cititok.showApp('stats');
    const tab = panel.split('-')[1] ?? 'overview';
    (document.querySelector(`.mr-st-tab[data-tab="${tab}"]`) as HTMLElement | null)?.click();
    if (panel.endsWith('-end')) {
      const body = document.querySelector('.mr-st-body');
      if (body !== null) body.scrollTop = body.scrollHeight;
    }
  } else if (panel === 'weather') {
    live.cityName = 'Salford';
    live.cititok.show();
    // The phone's second app, opened the same way its dock button opens it.
    live.cititok.showApp('weather');
  } else if (panel === 'industry-drawer') {
    renderer.world.progress.level = 5;
    (ui.querySelector('[data-branch="industry"]') as HTMLElement | null)?.click();
  } else if (panel === 'industry') {
    // A farm on the richest free farmland near the edge of the built city, its
    // area drawn round it through the tool's own click path, a few weeks run,
    // and its card opened.
    const w = renderer.world;
    const t = tools as unknown as {
      select(tool: unknown): void; dropLot(c: [number, number]): void;
      areaClick(c: [number, number]): void; closeArea(): void;
    };
    const f = resourceFields();
    const g = w.grid, half = g / 2, cellM = f.extent / RES_GRID;
    let best: [number, number] | null = null, bestV = 0;
    for (let k = 0; k < f.amount.fertile.length; k++) {
      const v = f.amount.fertile[k];
      if (v <= bestV) continue;
      const x = -f.extent / 2 + ((k % RES_GRID) + 0.5) * cellM;
      const z = -f.extent / 2 + (Math.floor(k / RES_GRID) + 0.5) * cellM;
      const gx = Math.round(x / 8 + half), gz = Math.round(z / 8 + half);
      if (lotFits(w, 'spec.hq.fertile', gx - 3, gz - 2, 0).why !== null) continue;
      bestV = v; best = [gx, gz];
    }
    if (best !== null) {
      w.budget.credit(500000);
      const p = industryProto('spec.hq.fertile');
      t.select({ kind: 'place', proto: p });
      t.dropLot(best);
      const R = 22;
      for (const [dx, dz] of [[-R, -R], [R, -R], [R + 6, R], [0, R + 10], [-R, R]]) {
        t.areaClick([best[0] + dx, best[1] + dz]);
      }
      t.closeArea();
      for (let id = 0; id < pl.count; id++) {
        if (pl.live[id] === 0) continue;
        for (let k = pl.col.working[id]; k < pl.col.jobs[id]; k++) pl.hire(id);
      }
      sim.step(600);
      const x = (best[0] - half) * 8, z = (best[1] - half) * 8;
      camera.focus[0] = x + 60; camera.focus[2] = z + 40;
      camera.distance = 560; camera.pitch = 0.62;
      camera.update();
      for (let i = 0; i < 10; i++) live.update(1 / 20, performance.now() + i * 50);
      live.tap([x, z]);
    }
  } else if (panel === 'level') {
    live.levelCard.push({
      level: 6, name: 'Boom town', cash: 170000, stars: 3,
      unlocked: landmarksForLevel(6),
    });
  }

  camera.update();
  renderer.frameForTools(performance.now());
  await gpu.device.queue.onSubmittedWorkDone();
  const m = sim.moverCounts;
  return {
    pixels: Array.from(await gpu.readPixels()),
    movers: `${m.vehicles} vehicles, ${m.people} on foot, ${m.dropped} unseated; `
      + `traffic ${sim.traffic.count}, moving ${sim.routine.moved}, `
      + `in flight ${sim.routine.stats.travelling}, `
      + `by mode ${Array.from(sim.routine.stats.byMode).join('/')}, `
      + `pop ${sim.people.population}`,
  };
}

export async function probeViewShot(width: number, height: number, view: number):
Promise<{ pixels: number[]; name: string }> {
  configureSim(LITE);
  const ui = document.createElement('div');
  ui.style.cssText = `position:relative;width:${width}px;height:${height}px`;
  document.body.appendChild(ui);

  const gpu = await Gpu.headless(width, height);
  const camera = new Camera();
  const stats = new Stats(ui);
  const renderer = new Renderer(gpu, camera, stats);
  renderer.clockRunning = false;
  renderer.timeOfDay = 0.4;
  renderer.weather.set(0.04);
  const live = new LiveCity(renderer, camera, stats, ui);
  renderer.useWorld(defaultWorld(renderer.world.grid));
  grantAll(renderer.world);
  renderer.build();
  live.playing = true;
  camera.setViewport(width, height);
  camera.yaw = 0.62; camera.pitch = 0.5; camera.distance = 620;
  camera.focus[0] = 0; camera.focus[2] = 0;
  camera.update();

  const sim = (live as unknown as { sim: Simulation }).sim;
  const pl = sim.places;
  for (let id = 0; id < pl.count; id++) {
    if (pl.live[id] === 0) continue;
    for (let k = pl.col.working[id]; k < pl.col.jobs[id]; k++) pl.hire(id);
  }
  for (let i = 0; i < 200; i++) live.update(1 / 20, performance.now() + i * 50);

  // A city played for a few simulated minutes has levelled up at least once,
  // and the card that celebrates it would be over whatever this is
  // photographing.
  live.levelCard.dismissAll();
  const press = (label: string): void => {
    const b = Array.from(ui.querySelectorAll('button')).find((el) => named(el) === label);
    b?.click();
  };
  press('Information views');
  const info = VIEWS.find((v) => v.id === view);
  if (info !== undefined) press(info.name);
  for (let i = 0; i < 12; i++) live.update(1 / 20, performance.now() + 20000 + i * 50);
  live.levelCard.dismissAll();

  camera.update();
  renderer.frameForTools(performance.now());
  await gpu.device.queue.onSubmittedWorkDone();
  const px = await gpu.readPixels();
  return { pixels: Array.from(px), name: info?.name ?? 'none' };
}

/**
 * The thought bubbles, over a real city, in a real camera.
 *
 * The simulation's own test proves which gripe a building has. What this proves
 * is the half between that and the player, which fails silently: a projection
 * with the wrong sign puts every bubble behind the camera on screen mirrored, a
 * layer the browser has not laid out projects everything to the top-left corner,
 * and an icon table with a missing key draws a blank circle. None of those throw.
 */
export async function probeThoughts(width: number, height: number): Promise<{
  complaints: number; shown: number; inside: number; distinct: string[];
  behind: number; cardOpen: boolean; cardTitle: string; cardFix: boolean;
  closed: boolean; tally: Record<string, number>;
  /** What it says once the mains are no longer the answer to everything. */
  next: Record<string, number>; nextShown: number; nextDistinct: string[];
  /** Complaints in a small, supplied town with no services: should be none. */
  quiet: number; quietTown: boolean;
}> {
  configureSim(LITE);
  const ui = document.createElement('div');
  ui.style.cssText = `position:relative;width:${width}px;height:${height}px`;
  document.body.appendChild(ui);

  const gpu = await Gpu.headless(width, height);
  const camera = new Camera();
  const stats = new Stats(document.createElement('div'));
  const renderer = new Renderer(gpu, camera, stats);
  renderer.clockRunning = false;
  const live = new LiveCity(renderer, camera, stats, ui);
  renderer.useWorld(defaultWorld(renderer.world.grid));
  grantAll(renderer.world);
  renderer.build();
  live.playing = true;

  camera.setViewport(width, height);
  camera.yaw = 0.6; camera.pitch = 0.42; camera.distance = 300;
  camera.focus[0] = 0; camera.focus[2] = 0;
  camera.update();

  const sim = (live as unknown as { sim: Simulation }).sim;
  // Staffed by hand. A power station makes nothing until somebody turns up to
  // run it, and a city founded eight households ago has nobody to send -- so a
  // probe that only waited would photograph a blackout and call it a feature.
  // What is being tested here is the bubbles, not how long a city takes to hire.
  const pl = sim.places;
  for (let id = 0; id < pl.count; id++) {
    if (pl.live[id] === 0 || pl.col.purpose[id] !== Purpose.SERVICE) continue;
    for (let k = pl.col.working[id]; k < pl.col.jobs[id]; k++) pl.hire(id);
  }

  // Long enough for the utility pass to settle, the coverage to go round every
  // branch, and the gripe sweep to get round the whole table more than once.
  for (let i = 0; i < 400; i++) live.update(1 / 20, performance.now() + i * 50);

  // A small town with its supply sorted and not one service built says
  // nothing: until it is a real town, power, water and drains are all anyone
  // complains about.
  for (let u = 0; u < 3; u++) sim.utilities.have[u].fill(255);
  for (const reach of sim.services.reach) reach.fill(0);
  for (let i = 0; i < 12; i++) sim.complaints.survey();
  let quiet = 0;
  for (let g = 0; g < sim.complaints.tally.length; g++) quiet += sim.complaints.tally[g];
  const quietTown = sim.people.population < sim.complaints.quietUntil;
  // The rest is about how complaints are shown, so it runs as a town big
  // enough to have all of them.
  sim.complaints.quietUntil = 0;

  // And then the supply is cut, by hand, for the first reading.
  //
  // The gripes are strictly ordered: a building with no water has one problem
  // and it is the water. So a city that is short of a utility exercises exactly
  // one row of the table, and a city that is not exercises a different row --
  // and which of the two this probe was photographing used to depend on whether
  // the generated city happened to have been dealt a sewage works out of the
  // bag it draws its services from. Now it is decided here: cut off first,
  // supplied after, and the two readings are the two halves of the table by
  // construction rather than by luck.
  for (let u = 0; u < 3; u++) sim.utilities.have[u].fill(0);
  for (const reach of sim.services.reach) reach.fill(0);
  for (let i = 0; i < 12; i++) sim.complaints.survey();
  live.update(1 / 20, performance.now() + 30000);
  const list = sim.complaints.list;
  const tally: Record<string, number> = {};
  for (const [g, info] of Object.entries(GRIPE_INFO)) {
    const n = sim.complaints.tally[Number(g)];
    if (n > 0) tally[info.title] = n;
  }

  const bubbles = Array.from(ui.querySelectorAll('[data-bubble]'))
    .filter((b) => b instanceof HTMLElement && b.style.display !== 'none') as HTMLElement[];
  let inside = 0;
  const distinct = new Set<string>();
  for (const b of bubbles) {
    const x = parseFloat(b.style.left), y = parseFloat(b.style.top);
    if (x >= 0 && x <= width && y >= 0 && y <= height) inside++;
    distinct.add(b.title);
  }

  // Nothing behind the camera. The whole city is in front of it at this angle,
  // so the honest test is the count of bubbles whose world point is behind --
  // which the projection is supposed to drop.
  const m = camera.viewProj;
  let behind = 0;
  for (const c of list) {
    const w = m[3] * c.x + m[11] * c.z + m[15];
    if (w <= 0) behind++;
  }

  const card = ui.querySelector('[data-panel="thought-card"]');
  const open = (): boolean => card instanceof HTMLElement && card.style.display !== 'none';
  bubbles[0]?.click();
  const cardOpen = open();
  const cardText = card?.textContent ?? '';
  const cardTitle = bubbles[0]?.title ?? '';
  const cardFix = cardText.length > cardTitle.length + 10;
  bubbles[0]?.click();
  const closed = !open();

  // And now the second reading. The gripes are strictly ordered -- a building
  // with no water has one problem and it is the water -- so a city short of a
  // utility exercises exactly one row of the table however many rows there are.
  // Granting the mains and the coverage is not a fix to the city; it is the only
  // way to ask what it would say next, and what it says next is the half of the
  // table the first reading can never reach.
  for (let u = 0; u < 3; u++) sim.utilities.have[u].fill(255);
  for (const reach of sim.services.reach) reach.fill(1);
  for (let i = 0; i < 12; i++) sim.complaints.survey();
  live.update(1 / 20, performance.now() + 60000);
  const next: Record<string, number> = {};
  for (const [g, info] of Object.entries(GRIPE_INFO)) {
    const n = sim.complaints.tally[Number(g)];
    if (n > 0) next[info.title] = n;
  }
  const after = Array.from(ui.querySelectorAll('[data-bubble]'))
    .filter((b) => b instanceof HTMLElement && b.style.display !== 'none') as HTMLElement[];
  const nextDistinct = [...new Set(after.map((b) => b.title))];

  return {
    complaints: list.length, shown: bubbles.length, inside,
    distinct: [...distinct], behind, cardOpen, cardTitle, cardFix, closed, tally,
    next, nextShown: after.length, nextDistinct, quiet, quietTown,
  };
}

/**
 * A building placed beside a road is fed, without the player doing anything else.
 *
 * The one thing this has to prove is the one thing a screenshot cannot: draw a
 * road, put a house on it, and the house has power, water and a sewer. There is no
 * pipe tool -- a street carries its services -- so the whole feature is that this
 * happens by itself, and the whole failure mode is that it silently does not.
 *
 * It also checks the other half of "by itself": that demolishing the road takes the
 * services with it, because a rule that only ever adds is not a rule.
 */
export async function probeMains(): Promise<{
  /** Controls left over from the pipe tool. Must be none. */
  onBar: string[];
  /** Whether each utility reaches a house beside a road the player drew. */
  fed: Record<string, boolean>;
  /** And whether it reached before the road existed. */
  fedBefore: Record<string, boolean>;
  /** Still fed after the road is bulldozed. Must be false. */
  fedAfter: Record<string, boolean>;
  /** Pixels of main in the frame, so "drawn" stays a claim about the picture. */
  drawn: { yellow: number; pixels: number };
  error?: string;
}> {
  configureSim(LITE);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;left:0;top:0;width:800px;height:450px';
  document.body.appendChild(canvas);
  const overlay = document.createElement('div');
  document.body.appendChild(overlay);

  const gpu = await Gpu.headless(800, 450);
  const camera = new Camera();
  const stats = new Stats(document.createElement('div'));
  const renderer = new Renderer(gpu, camera, stats);
  renderer.clockRunning = false;
  renderer.timeOfDay = 0.42;
  const world = emptyWorld(renderer.world.grid);
  renderer.useWorld(world);
  grantAll(renderer.world);
  renderer.build();

  camera.setViewport(800, 450);
  camera.focus[0] = 0; camera.focus[2] = 0;
  camera.pitch = 0.9; camera.distance = 380; camera.yaw = 0.2;
  camera.update();

  const tools = new BuildTools(canvas, camera, renderer, overlay);
  tools.visible = true;
  const onBar = Array.from(overlay.querySelectorAll('button'))
    .map((b) => named(b as HTMLElement)).filter((t) => /drag along a road|main|sewer|power line/i.test(t));

  const mains = renderer.world.mains;
  const reading = (): Record<string, boolean> => ({
    power: mains.netAt(0, 40, Main.POWER) >= 0,
    water: mains.netAt(0, 40, Main.WATER) >= 0,
    sewage: mains.netAt(0, 40, Main.SEWAGE) >= 0,
  });

  const fedBefore = reading();

  // The player draws a road. Nothing else.
  const g = renderer.world.grid;
  const half = g / 2;
  renderer.world.net.addCells(6, half, g - 6, half, 'avenue');
  renderer.rebuild();
  const fed = reading();

  camera.update();
  renderer.frameForTools(performance.now());
  await gpu.device.queue.onSubmittedWorkDone();
  // The mains are drawn while a utility view is up, which is when a player looks
  // at them; the marker code and the line code share that switch.
  renderer.showDots(Main.POWER);
  renderer.frameForTools(performance.now());
  await gpu.device.queue.onSubmittedWorkDone();
  const px = await gpu.readPixels();
  let yellow = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i] > 120 && px[i + 1] > 90 && px[i + 2] < px[i + 1] - 25) yellow++;
  }

  // And the road goes away again.
  demolish(renderer.world, 0, 0, g, g);
  renderer.rebuild();
  const fedAfter = reading();

  return { onBar, fed, fedBefore, fedAfter, drawn: { yellow, pixels: px.length / 4 } };
}
