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
import { Stats } from './ui/stats';
import { fatal } from './ui/fatal';
import { configureSim, LITE } from './sim';
import { Benchmark, formatResults } from './bench';
import { log, mountConsole } from './util/log';

const MAX_RECOVERY_ATTEMPTS = 3;

// Tells the watchdog in index.html that the bundle actually executed. If this
// never runs, the watchdog goes and works out why.
declare global {
  interface Window { __citysimBooted?: boolean }
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
  const renderer = new Renderer(gpu, camera, stats);
  renderer.build();

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
