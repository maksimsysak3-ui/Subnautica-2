/**
 * Boot sequence.
 *
 * Ownership note: this file is the integration point. Teams add their system
 * module and register it here. Keep registration order aligned with
 * System.order so dependency resolution stays obvious.
 */

import { Engine } from './core/engine';
import { bus } from './core/events';
import { services } from './core/contracts';
import { installAutomation } from './core/automation';
import { RenderSystem } from './render/render-system';
import { EnvironmentSystem } from './lighting/environment-system';
import { WorldSystem } from './world/world-system';
import { ActorRegistry } from './actors/actor-registry';
import { PlayerSystem } from './player/player-system';
import { InputSystem } from './player/input-system';
import { Ballistics } from './weapons/ballistics';
import { WeaponRuntime } from './weapons/weapon-system';
import { ActorBodies } from './actors/actor-bodies';
import { CaptureDirector } from './core/capture-director';

const bootEl = document.getElementById('boot')!;
const barEl = document.getElementById('boot-bar')!;
const statusEl = document.getElementById('boot-status')!;

function progress(pct: number, label: string): void {
  barEl.style.width = `${Math.round(pct * 100)}%`;
  statusEl.textContent = label.toUpperCase();
}

function fatal(err: unknown): void {
  const el = document.getElementById('fatal')!;
  const msg = document.getElementById('fatal-msg')!;
  el.style.display = 'grid';
  msg.textContent = err instanceof Error ? `${err.message}\n\n${err.stack ?? ''}` : String(err);
  console.error('[boot] fatal', err);
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const engine = new Engine();

  progress(0.05, 'creating render context');
  const render = new RenderSystem(canvas);
  engine.add(render);

  progress(0.2, 'building environment');
  engine.add(new EnvironmentSystem());

  progress(0.4, 'generating world');
  engine.add(new WorldSystem());

  progress(0.6, 'registering actors');
  engine.add(new ActorRegistry());

  progress(0.65, 'loading ballistics');
  engine.add(new Ballistics());

  progress(0.7, 'spawning operator');
  const player = new PlayerSystem();
  engine.add(player);

  progress(0.75, 'issuing weapons');
  const weapons = new WeaponRuntime();
  // The runtime reads stance, stamina and ADS from the controller and pushes
  // recoil back through its additive camera channel, so the controller keeps
  // sole ownership of the transform. Injected rather than imported to keep the
  // dependency one-directional.
  weapons.player = player;
  engine.add(weapons);
  engine.add(new ActorBodies());

  progress(0.8, 'binding controls');
  const input = new InputSystem(canvas);
  engine.add(input);

  progress(0.85, 'starting systems');
  await engine.init();

  const director = new CaptureDirector(engine);
  installAutomation(engine, director);

  progress(1, 'ready');
  engine.start();

  // Fade the boot screen once we've actually presented a frame.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bootEl.classList.add('hidden');
      setTimeout(() => bootEl.remove(), 700);
    });
  });

  // Pointer lock can only be requested from a user gesture — and some
  // embeddings (a sandboxed iframe without allow="pointer-lock") refuse it
  // outright. The overlay therefore dismisses on click regardless of whether
  // the lock succeeds; otherwise a refused lock leaves the player staring at
  // an overlay that appears to do nothing.
  const overlay = document.getElementById('click-to-play');
  const modeHint = document.getElementById('mode-hint');
  const engage = (): void => {
    overlay?.classList.add('hidden');
    input.requestLock();
  };
  overlay?.addEventListener('click', engage);
  canvas.addEventListener('click', () => {
    if (document.pointerLockElement !== canvas) engage();
  });

  input.onControlModeChange = (mode) => {
    if (!modeHint) return;
    modeHint.textContent =
      mode === 'drag'
        ? 'DRAG TO LOOK — this view cannot capture the cursor'
        : 'ESC TO RELEASE CURSOR';
    modeHint.classList.remove('hidden');
  };

  // Escape exits pointer lock; bring the overlay back so the player can
  // re-engage, but only when the lock was actually being used.
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas && !input.usingDragLook && input.engaged) {
      overlay?.classList.remove('hidden');
    }
  });

  // Expose for debugging from the devtools console.
  (window as unknown as { engine: Engine; bus: typeof bus; services: typeof services }).engine = engine;
  (window as unknown as { bus: typeof bus }).bus = bus;
  (window as unknown as { services: typeof services }).services = services;
}

boot().catch(fatal);
