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

import { Gpu } from './gfx/device';
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
  /**
   * Clear a square of the map, draw a road into the empty land and zone one
   * side of it, then rebuild -- the player's own workflow, so a picture can
   * show whether it produced a street or a mess.
   */
  edit?: boolean;
  /** Photograph the map the game actually opens on, rather than a built city. */
  empty?: boolean;
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
function grantAll(world: { land: { take: (p: number) => void } }): void {
  for (let i = 0; i < PLOTS * PLOTS; i++) world.land.take(i);
}

export async function probeRebuild(width: number, height: number):
Promise<{ before: Record<string, string>; after: Record<string, string>;
  cost: Record<string, number>; first: Record<string, number>; edits: number[]; meshes: number[] }> {
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
  return { before, after: stats.snapshot(), cost: { ...renderer.cost }, first, edits, meshes };
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
  // A photograph of empty land is a photograph of nothing, so unless the
  // caller asked for the starting map it gets the generated city.
  if (req.empty !== true) renderer.useWorld(defaultWorld(renderer.world.grid));
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

  camera.yaw = req.yaw;
  camera.pitch = req.pitch;
  camera.distance = req.distance;
  camera.focus[0] = req.focus[0];
  camera.focus[2] = req.focus[1];
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
  budgetRows: number; taxSliders: number; rateMoved: boolean; budgetPainted: number;
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

  // The budget, which is the one view that is not a map: it paints nothing and
  // it carries controls. Both halves are checked, because a tax slider that does
  // not move the rate is a slider, and a rate that does not move the panel above
  // it is a number in a different room.
  press('Budget');
  live.update(1 / 30, performance.now());
  const budgetRows = ui.querySelectorAll('[data-stat]').length;
  const taxPanel = ui.querySelector('[data-panel="tax"]');
  const sliders = taxPanel === null ? []
    : Array.from(taxPanel.querySelectorAll('input[type=range]')) as HTMLInputElement[];
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
    closed, closedBack: moved(plainPx, backPx),
    population: live.population, views,
    budgetRows, taxSliders: sliders.length,
    rateMoved: Math.abs(nowRate - wasRate) > 0.01,
    // A budget is not a place: opening it must leave the map exactly as it was.
    budgetPainted: moved(plainPx, budgetPx),
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
export async function probeHud(width: number, height: number, hour = 0.36):
Promise<{ pixels: number[] }> {
  configureSim(LITE);
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
  camera.yaw = 0.62; camera.pitch = 0.46; camera.distance = 520;
  camera.focus[0] = 0; camera.focus[2] = 0;
  camera.update();

  const sim = (live as unknown as { sim: Simulation }).sim;
  const pl = sim.places;
  for (let id = 0; id < pl.count; id++) {
    if (pl.live[id] === 0) continue;
    for (let k = pl.col.working[id]; k < pl.col.jobs[id]; k++) pl.hire(id);
  }
  for (let i = 0; i < 160; i++) live.update(1 / 20, performance.now() + i * 50);

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

  camera.update();
  renderer.frameForTools(performance.now());
  await gpu.device.queue.onSubmittedWorkDone();
  return { pixels: Array.from(await gpu.readPixels()) };
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

  const press = (label: string): void => {
    const b = Array.from(ui.querySelectorAll('button')).find((el) => named(el) === label);
    b?.click();
  };
  press('Information views');
  const info = VIEWS.find((v) => v.id === view);
  if (info !== undefined) press(info.name);
  for (let i = 0; i < 12; i++) live.update(1 / 20, performance.now() + 20000 + i * 50);

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
    next, nextShown: after.length, nextDistinct,
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
