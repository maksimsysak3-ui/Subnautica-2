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
import { Viewmodel } from './weaponmodels/viewmodel';
import { CombatFx } from './fx/combat-fx';
import { Hud } from './ui/hud';
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
  const ballistics = new Ballistics();
  engine.add(ballistics);

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

  const viewmodel = new Viewmodel();
  viewmodel.host = player;
  engine.add(viewmodel);

  const fx = new CombatFx();
  // The muzzle flash lives in the viewmodel scene, so it needs the weapon's
  // own muzzle position rather than a world-space guess.
  fx.muzzleProvider = (out) => viewmodel.muzzleLocal(out);
  fx.projectileSource = () => ballistics.active;
  engine.add(fx);

  // The HUD is the only thing that tells the player a door is a door. It
  // reads state and never writes any, so injection keeps the dependency
  // pointing one way.
  const hud = new Hud();
  hud.player = player;
  hud.weapons = weapons;
  engine.add(hud);

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

  // ## Taking control
  //
  // Real pointer lock is what everyone wants: the cursor vanishes, the mouse
  // turns the view, Escape gives it back. But Chromium refuses
  // `requestPointerLock` inside a **cross-origin iframe** — measured, with and
  // without `allow="pointer-lock"` — and a published artifact runs in exactly
  // that configuration.
  //
  // So the game asks for the real thing on every click, and if it does not
  // arrive, falls into soft capture: cursor hidden, continuous mousemove look
  // with no button held, and a turn-rate push near the window edges to make up
  // for the cursor running out of room. The player gets mouse look either way.
  //
  // Going fullscreen materially improves the odds of the real lock, so the
  // overlay offers it.
  const overlay = document.getElementById('click-to-play');
  const modeHint = document.getElementById('mode-hint');
  const fsButton = document.getElementById('go-fullscreen');

  const engage = (): void => {
    overlay?.classList.add('hidden');
    input.requestLock();
    // If the lock does not land shortly, capture the cursor visually instead.
    window.setTimeout(() => {
      if (document.pointerLockElement !== canvas) input.setSoftCapture(true);
    }, 700);
  };
  overlay?.addEventListener('click', engage);
  canvas.addEventListener('click', () => {
    if (document.pointerLockElement !== canvas) engage();
  });

  fsButton?.addEventListener('click', (e) => {
    e.stopPropagation();
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const req = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
    // Fullscreen first, then the lock — asking in that order is what gives the
    // frame the activation pointer lock wants.
    Promise.resolve(req?.()).catch(() => undefined).finally(() => {
      overlay?.classList.add('hidden');
      window.setTimeout(engage, 120);
    });
  });

  input.onControlModeChange = (mode) => {
    if (!modeHint) return;
    if (mode === 'locked') {
      modeHint.textContent = 'ESC TO RELEASE CURSOR';
    } else if (mode === 'soft') {
      modeHint.textContent = 'MOUSE LOOK ACTIVE — ESC TO RELEASE · FULLSCREEN FOR TRUE CURSOR LOCK';
    } else {
      modeHint.textContent = 'CLICK TO TAKE CONTROL';
    }
    modeHint.classList.remove('hidden');
  };

  // Escape releases whichever capture is active and brings the overlay back.
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (input.usingSoftCapture) {
      input.setSoftCapture(false);
      overlay?.classList.remove('hidden');
    }
  });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas && input.engaged && !input.usingSoftCapture) {
      overlay?.classList.remove('hidden');
    }
  });

  // Expose for debugging from the devtools console.
  (window as unknown as { engine: Engine; bus: typeof bus; services: typeof services }).engine = engine;
  (window as unknown as { bus: typeof bus }).bus = bus;
  (window as unknown as { services: typeof services }).services = services;
}

boot().catch(fatal);
