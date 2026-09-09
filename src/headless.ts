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
