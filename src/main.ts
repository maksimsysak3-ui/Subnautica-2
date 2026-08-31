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
import { Stats } from './ui/stats';
import { fatal } from './ui/fatal';
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

  status('building pipelines…');
  const stats = new Stats(overlay);
  stats.set('isolated', crossOriginIsolated ? 'yes' : 'no');

  const renderer = new Renderer(gpu, stats);
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
      renderer.start();
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

  renderer.start();
  document.getElementById('boot')?.classList.add('done');
  log.info('boot', 'running');
}

addEventListener('error', (e) => log.error('window', `${e.message} @ ${e.filename}:${e.lineno}`));
addEventListener('unhandledrejection', (e) => log.error('window', `unhandled rejection: ${String(e.reason)}`));

void boot();
