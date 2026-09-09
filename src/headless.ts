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
import { configureSim, LITE, paint, zoneCode } from './sim';

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
  renderer.world.net.add(4, (g >> 1) + 1, g - 5, (g >> 1) + 1, 'avenue');
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
  // Straight down over the middle of the map, so a screen point maps to a cell
  // without depending on the terrain.
  camera.setViewport(800, 450);
  camera.focus[0] = 0; camera.focus[2] = 0;
  camera.pitch = 1.2;
  camera.distance = 400;
  camera.update();

  const tools = new BuildTools(canvas, camera, renderer, overlay);
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
  const press = (title: string): void => {
    const b = Array.from(overlay.querySelectorAll('button'))
      .find((el) => (el as HTMLElement).title.startsWith(title));
    (b as HTMLElement | undefined)?.click();
  };

  press('Avenue');
  const picked = tools.active;
  drag('road', 120, 120, 640, 130);

  press('Residential');
  drag('zone', 200, 200, 420, 340);

  return {
    roadCellsBefore, roadCellsAfter: count(world.net.cls),
    zonedBefore, zonedAfter: count(world.zones), picked,
  };
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
  renderer.build();

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
