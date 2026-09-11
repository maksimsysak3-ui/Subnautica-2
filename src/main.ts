/**
 * Boot.
 *
 * Milestone 0, step 1: prove the whole path -- device acquisition, canvas
 * configuration, bind groups, instanced draw, depth buffer, resize, device
 * loss recovery, and the instrumentation overlay -- before any game code
 * exists to hide a problem in.
 */

import { Gpu, GpuInitError } from './gfx/device';
import { Renderer } from './gfx/renderer';
import { Camera } from './gfx/camera';
import { Controls } from './input/controls';
import { BuildTools } from './ui/build-tools';
import { Stats } from './ui/stats';
import { fatal } from './ui/fatal';
import {
  configureSim, LITE, startingWorld, warmTerrain, baseHeightAt, writeAutosave,
} from './sim';
import { Menu } from './ui/menu';
import { Benchmark, formatResults } from './bench';
import { log, mountConsole } from './util/log';

const MAX_RECOVERY_ATTEMPTS = 3;

// Tells the watchdog in index.html that the bundle actually executed. If this
// never runs, the watchdog goes and works out why.
declare global {
  interface Window { __citysimBooted?: boolean; __citysim?: { camera: Camera } }
}
window.__citysimBooted = true;

function status(text: string): void {
  const el = document.getElementById('boot-status');
  if (el) el.textContent = text;
}

/**
 * Hands the browser a frame, and does not depend on getting one.
 *
 * `requestAnimationFrame` is the right way to let a loader draw between steps
 * and the wrong thing to *wait* on: a browser does not run animation frames
 * for a page it is not showing, so a tab opened in the background or an iframe
 * that has not been scrolled into view never fires one. Awaiting rAF there
 * waits forever, and the game sits on its loading screen for good.
 *
 * So the frame is raced against a timer. Visible, the timer never wins and the
 * loader paints between every step; hidden, the timer carries the build to the
 * end and the game is ready when the page finally is.
 */
function breathe(): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const go = (): void => { if (!done) { done = true; resolve(); } };
    requestAnimationFrame(go);
    setTimeout(go, 60);
  });
}

async function boot(): Promise<void> {
  const overlay = document.getElementById('overlay');
  const canvas = document.getElementById('gpu-canvas');
  if (!overlay || !(canvas instanceof HTMLCanvasElement)) {
    fatal('internal', 'index.html is missing #gpu-canvas or #overlay');
    return;
  }

  mountConsole(overlay);

  // ?lite builds a small world. Used by the deployment test, and a way out for
  // anyone whose machine cannot hold the full one.
  const query = new URLSearchParams(location.search);
  if (query.has('lite')) {
    configureSim(LITE);
    log.info('boot', 'lite world: reduced city and terrain');
  }

  log.info('boot', `citysim starting, ua=${navigator.userAgent}`);
  log.info(
    'boot',
    `crossOriginIsolated=${crossOriginIsolated} sharedArrayBuffer=${typeof SharedArrayBuffer !== 'undefined'}`,
  );
  if (!crossOriginIsolated) {
    // Expected for now. The service worker that grants isolation on GitHub
    // Pages is parked in src/workers/ until worker threads need it -- see the
    // note at the top of that file.
    log.info('boot', 'not cross-origin isolated (expected): SharedArrayBuffer unavailable');
  }

  status('requesting GPU…');
  let gpu: Gpu;
  try {
    gpu = await Gpu.create(canvas);
  } catch (err) {
    if (err instanceof GpuInitError) {
      log.error('boot', `${err.kind}: ${err.message}`);
      fatal(err.kind, err.message);
    } else {
      log.error('boot', String(err));
      fatal('internal', err instanceof Error ? (err.stack ?? err.message) : String(err));
    }
    return;
  }

  status('building the city…');
  const stats = new Stats(overlay);
  stats.set('isolated', crossOriginIsolated ? 'yes' : 'no');
  // Down until play starts. It is built here because the frame loop wants it
  // from the first frame, and an empty bordered box in the corner of a loading
  // screen is the game's plumbing on show.
  stats.visible = false;

  const camera = new Camera();
  const controls = new Controls(canvas, camera);
  // A handle on the camera for tooling.
  //
  // `tools/city-shot.mjs` drives this to take the store-page screenshots, and
  // it is the only way to get a repeatable frame out of the real game rather
  // than a picture of assets lined up on a grid. Read-write on purpose and
  // harmless: it exposes the view, not the simulation.
  window.__citysim = { camera };
  const renderer = new Renderer(gpu, camera, stats);

  // The menu goes up before the world is built, not after, so the facets have
  // something to light up in time with -- and so the first thing on screen is
  // the game's own face rather than a blank canvas with a word on it.
  //
  // The scene runs behind it throughout. A menu that paints a picture of a
  // city is showing you something the game is not; this one is the game,
  // turning slowly, with the panel over the top.
  let cinematic = true;
  // Declared before the menu because the menu shows and hides it, and built
  // after the world because it reads the grid.
  let tools: BuildTools | null = null;
  /** The name a loaded save came in under, applied once the tools exist. */
  let loaded: string | null = null;
  const menu = new Menu(overlay, {
    onNew: () => { renderer.useWorld(startingWorld(renderer.world.grid)); renderer.rebuild(); },
    onLoad: (world, name) => {
      renderer.useWorld(world);
      renderer.rebuild();
      loaded = name;
    },
    world: () => renderer.world,
    cinematic: (on) => {
      cinematic = on;
      // The toolbar and the budget readout belong to the game, not to the
      // menu. Anything of the game's that stays up behind the title reads as
      // the menu being drawn on top of a half-started session.
      if (tools !== null) tools.visible = !on;
      stats.visible = !on;
      // A full day in about two minutes while the menu is up, and back to the
      // game's own pace on the way in. Sitting on the menu should be worth
      // doing; sitting in the game at that speed would be unplayable.
      renderer.clockRate = on ? 12 : 1;
    },
  });
  document.getElementById('boot')?.classList.add('done');

  // Built in steps with a frame between them, because a single synchronous
  // build hands the browser one long block and the loader never draws -- the
  // player watches a frozen page and is told nothing. Each await yields.
  // The build, in steps, with a frame between each.
  //
  // What is *not* here is the fix for the hang. An earlier version built a
  // whole generated city behind the menu for the look of it, and that is
  // several seconds of one unbreakable block on a fast machine and a locked
  // page on a slow one -- the loader froze on "raising the skyline" and never
  // came back. Nothing about a menu is worth that.
  //
  // The menu now stands over the site the game actually starts on, which costs
  // about a tenth of a second to build, so there is no long block to break up
  // and nothing to stall on.
  const steps: Array<[string, () => void]> = [
    // Measuring the ground is its own step because it is half the work: four
    // hundred thousand corners of noise, which otherwise lands inside the city
    // build and makes one long block out of two shorter ones.
    ['reading the land', () => warmTerrain(baseHeightAt)],
    ['raising the ground', () => renderer.build()],
    ['opening', () => { /* the last facet lands on a finished world */ }],
  ];

  // Whatever happens below, the menu becomes usable. A loading screen with no
  // way off it is the one failure a player cannot work around.
  const rescue = setTimeout(() => {
    log.warn('boot', 'world build overran; opening the menu anyway');
    menu.ready();
  }, 45000);
  try {
    for (let i = 0; i < steps.length; i++) {
      menu.progress(i / steps.length, steps[i][0]);
      await breathe();
      steps[i][1]();
    }
    clearTimeout(rescue);
  } catch (err) {
    clearTimeout(rescue);
    // A build that throws used to leave the menu sitting there half-lit with
    // no buttons and nothing said -- which looks exactly like a hang.
    log.error('boot', `world build failed: ${String(err)}`);
    fatal('internal', String(err));
    return;
  }
  menu.ready();

  // The menu's camera: over the empty site, turning slowly, with the day
  // running across it.
  //
  // The land is the background and the menu is a caption on it, so the shot
  // wants to be calm rather than dramatic: high enough to take in the river
  // and the hills, slow enough that nothing demands attention, and moving
  // through the hours so the light is never twice the same.
  camera.distance = 1100;
  camera.pitch = 0.55;
  camera.yaw = 0.7;
  camera.focus[0] = 0;
  camera.focus[2] = 0;
  renderer.timeOfDay = 0.30;

  // The build tools take the left button while one is selected; the camera
  // keeps the right button and the wheel throughout, so the player never has
  // to put a tool down to look somewhere else.
  tools = new BuildTools(canvas, camera, renderer, overlay);
  controls.buildActive = () => tools?.active ?? false;
  if (loaded !== null) tools.cityName = loaded;
  autosave(renderer, tools);

  // A lost device invalidates every GPU object. Rebuild from scratch rather
  // than leaving the player with a dead canvas.
  let attempts = 0;
  gpu.onLost(async (info) => {
    renderer.teardown();
    if (info.reason === 'destroyed') return;
    if (++attempts > MAX_RECOVERY_ATTEMPTS) {
      fatal('device-lost', `${info.message}\n\ngave up after ${MAX_RECOVERY_ATTEMPTS} attempts`);
      return;
    }
    status('recovering GPU…');
    try {
      await gpu.recover();
      renderer.build();
      renderer.start((dt) => controls.update(dt));
      status('');
      document.getElementById('boot')?.classList.add('done');
    } catch (err) {
      fatal('device-lost', String(err));
    }
  });

  // Do not burn frames on a backgrounded tab.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) renderer.stop();
    else renderer.start();
  });

  // ?bench flies a fixed route and prints a table. See src/bench.ts.
  const benchmark = new URLSearchParams(location.search).has('bench')
    ? new Benchmark(camera, renderer, (results) => {
        const table = formatResults(results, renderer.buildingCount);
        for (const line of table.split('\n')) log.info('bench', line);
        showBenchResults(table);
      })
    : null;

  renderer.start((dt) => {
    // Hands the camera back the moment the menu is gone, and never fights the
    // player for it: the orbit only runs while nobody else is driving.
    if (cinematic) {
      camera.yaw += dt * 0.022;
      camera.update();
    }
    controls.update(dt);
    benchmark?.update(dt);
  });
  canvas.focus();
  document.getElementById('boot')?.classList.add('done');
  log.info('boot', 'running — drag to pan, right-drag to orbit, wheel to zoom');
}

/**
 * The rolling save.
 *
 * A city builder's one unrecoverable mistake is closing the tab, and a save
 * system that only writes when asked hands that mistake to the player. This
 * writes whenever the city has changed and the moment has passed -- and again
 * when the page goes away, which is the case that actually loses work: a tab
 * closed, a phone switched away from, a browser deciding to discard a
 * background page.
 *
 * `visibilitychange` rather than `beforeunload`, because a page on a phone is
 * frequently discarded without ever firing unload, and because a sandboxed
 * frame is not guaranteed to get one either. It is keyed on the renderer's
 * revision so an idle city is not rewritten every minute for nothing.
 */
function autosave(renderer: Renderer, tools: BuildTools): void {
  const EVERY = 45000;
  let written = renderer.revision;
  const keep = (): void => {
    if (renderer.revision === written) return;
    written = renderer.revision;
    writeAutosave(renderer.world, tools.cityName);
  };
  setInterval(keep, EVERY);
  // Not `keep`: on the way out, write whatever is there rather than checking
  // whether it is worth it.
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') keep();
  });
  addEventListener('pagehide', keep);
}

/** Puts the benchmark table on screen, and one click away from the clipboard. */
function showBenchResults(table: string): void {
  const el = document.createElement('pre');
  el.textContent = table + '\n\n(click to copy)';
  el.style.cssText = [
    'position:fixed', 'left:50%', 'top:50%', 'transform:translate(-50%,-50%)',
    'padding:18px 22px', 'background:rgba(6,9,13,.94)',
    'border:1px solid rgba(98,212,255,.22)', 'border-radius:4px',
    'font:12px/1.6 var(--mono)', 'color:#c9d4e3', 'z-index:30',
    'cursor:pointer', 'white-space:pre', 'max-width:92vw', 'overflow:auto',
  ].join(';');
  el.addEventListener('click', () => {
    void navigator.clipboard?.writeText(table);
    el.remove();
  });
  document.body.appendChild(el);
}

addEventListener('error', (e) => log.error('window', `${e.message} @ ${e.filename}:${e.lineno}`));
addEventListener('unhandledrejection', (e) => log.error('window', `unhandled rejection: ${String(e.reason)}`));

boot().catch((err: unknown) => {
  // Nothing above this catches, and an unhandled rejection here is a blank
  // page with the reason only in the console.
  log.error('boot', String(err));
  fatal('internal', String(err));
});
