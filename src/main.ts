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

  progress(0.7, 'spawning operator');
  engine.add(new PlayerSystem());

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

  // Expose for debugging from the devtools console.
  (window as unknown as { engine: Engine; bus: typeof bus; services: typeof services }).engine = engine;
  (window as unknown as { bus: typeof bus }).bus = bus;
  (window as unknown as { services: typeof services }).services = services;
}

boot().catch(fatal);
