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

import { Gpu } from './gfx/device';
import { Camera } from './gfx/camera';
import { Renderer } from './gfx/renderer';
import { Stats } from './ui/stats';
import { BuildTools } from './ui/build-tools';
import { configureSim, LITE, paint, demolish, zoneCode, defaultWorld } from './sim';

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
   * Clear a square of the map, draw a road into the empty land and zone one
   * side of it, then rebuild -- the player's own workflow, so a picture can
   * show whether it produced a street or a mess.
   */
  edit?: boolean;
  /** Photograph the map the game actually opens on, rather than a built city. */
  empty?: boolean;
  lite: boolean;
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
export async function probeRebuild(width: number, height: number):
Promise<{ before: Record<string, string>; after: Record<string, string> }> {
  configureSim(LITE);
  const gpu = await Gpu.headless(width, height);
  const camera = new Camera();
  const stats = new Stats(document.createElement('div'));
  const renderer = new Renderer(gpu, camera, stats);
  renderer.clockRunning = false;
  // The game opens on empty land now. What is being measured here is a
  // rebuild of a city, so one is put on the map first.
  renderer.useWorld(defaultWorld(renderer.world.grid));
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
  return { before, after: stats.snapshot() };
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
      return h.title.startsWith(label) || (h.textContent ?? '').trim().startsWith(label);
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
      return h.title.startsWith(label) || (h.textContent ?? '').trim().startsWith(label);
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
  // A photograph of empty land is a photograph of nothing, so unless the
  // caller asked for the starting map it gets the generated city.
  if (req.empty !== true) renderer.useWorld(defaultWorld(renderer.world.grid));
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
