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
import { configureSim, LITE, startingWorld, defaultWorld } from './sim';
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
  const menu = new Menu(overlay, {
    onNew: () => { renderer.useWorld(startingWorld(renderer.world.grid)); renderer.rebuild(); },
    onLoad: (world) => { renderer.useWorld(world); renderer.rebuild(); },
    world: () => renderer.world,
    cinematic: (on) => { cinematic = on; },
  });
  document.getElementById('boot')?.classList.add('done');

  // Built in steps with a frame between them, because a single synchronous
  // build hands the browser one long block and the loader never draws -- the
  // player watches a frozen page and is told nothing. Each await yields.
  const steps: Array<[string, () => void]> = [
    ['reading the land', () => { /* terrain is built inside build() below */ }],
    ['cutting the river', () => { /* likewise; these two name what is happening */ }],
    // The menu stands over a built city rather than over the empty site the
    // game starts on. A skyline is the picture; a field is a field.
    ['raising the skyline', () => {
      renderer.useWorld(defaultWorld(renderer.world.grid));
      renderer.build();
    }],
    ['planting', () => { /* the build above did it; the beat is for the eye */ }],
    ['bringing the road in', () => { /* the starting world is already on the map */ }],
    ['opening', () => { /* nothing left; the last facet lands on a finished world */ }],
  ];
  for (let i = 0; i < steps.length; i++) {
    menu.progress(i / steps.length, steps[i][0]);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    steps[i][1]();
  }
  menu.progress(1, '');
  menu.ready();

  // The menu's camera: elevated, looking out across the city to a horizon,
  // at golden hour.
  //
  // Three attempts got here. Level with the ground (6.6 degrees) put a wall of
  // foreground grass across the bottom half and no city in it. Steeply down
  // (54 degrees) gave rooftops edge to edge -- dense, but with no sky, no
  // horizon and no depth, so it read as a texture rather than a place. This
  // sits between them: high enough to see the city spread away and low enough
  // to keep sky in the top of the frame, which is where the depth comes from.
  //
  // The hour matters as much as the angle. A low sun rakes across the fronts
  // of the buildings instead of lighting their roofs, the shadows run long
  // enough to describe the street grid, and the aerial-perspective term in the
  // shaders does the rest -- the far side of the city goes hazy on its own.
  camera.distance = 760;
  camera.pitch = 0.44;
  camera.yaw = 0.62;
  camera.focus[0] = -120;
  camera.focus[2] = 40;
  renderer.timeOfDay = 0.762;

  // The build tools take the left button while one is selected; the camera
  // keeps the right button and the wheel throughout, so the player never has
  // to put a tool down to look somewhere else.
  const tools = new BuildTools(canvas, camera, renderer, overlay);
  controls.buildActive = () => tools.active;

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
      camera.yaw += dt * 0.035;
      camera.update();
    }
    controls.update(dt);
    benchmark?.update(dt);
  });
  canvas.focus();
  document.getElementById('boot')?.classList.add('done');
  log.info('boot', 'running — drag to pan, right-drag to orbit, wheel to zoom');
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

void boot();
