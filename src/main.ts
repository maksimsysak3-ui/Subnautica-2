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
import { WorldSystem, writeMapChoice } from './world/world-system';
import { ActorRegistry } from './actors/actor-registry';
import { PlayerSystem } from './player/player-system';
import { InputSystem } from './player/input-system';
import { Ballistics } from './weapons/ballistics';
import { WeaponRuntime } from './weapons/weapon-system';
import { ActorBodies } from './actors/actor-bodies';
import { Viewmodel } from './weaponmodels/viewmodel';
import { CombatFx } from './fx/combat-fx';
import { Hud } from './ui/hud';
import { Menu } from './ui/menu';
import { InteriorLights } from './lighting/interior-lights';
import { WeaponLight } from './lighting/weapon-light';
import { MissionSystem } from './missions/mission-system';
import { EnemyAi } from './ai/enemy-ai';
import { garrison } from './ai/garrison';
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

  progress(0.76, 'switching on the lights');
  engine.add(new InteriorLights());
  engine.add(new WeaponLight());

  progress(0.77, 'drafting the tasking');
  const missions = new MissionSystem();
  engine.add(missions);

  progress(0.78, 'briefing the opposition');
  const ai = new EnemyAi();
  engine.add(ai);

  progress(0.79, 'raising the menu');
  const menu = new Menu();
  engine.add(menu);

  progress(0.8, 'binding controls');
  const input = new InputSystem(canvas);
  engine.add(input);

  progress(0.85, 'starting systems');
  await engine.init();

  // After init, because the garrison needs the world's floor query and the
  // actor registry, both of which only exist once their systems are up.
  const world = services.get('world') as unknown as {
    floorAt(x: number, z: number, from: number): number;
    mapId: 'villa' | 'quay';
    site: { name: string };
  };
  const actorReg = engine.get('actors') as unknown as Parameters<typeof garrison>[1];
  const placed = garrison(
    world.mapId, actorReg, ai, (x, z) => world.floorAt(x, z, 40),
  );
  console.info(`[garrison] ${world.site.name}: ${placed} hostiles on station`);

  // Tasking. A map with people on it and nothing to do is a sandbox.
  //
  // `templateId` is what the deploy screen passes: the player read a briefing
  // and pressed the button under it, so they get that mission. Without one the
  // seed picks, which is what boot and the tests want.
  const beginMission = (mapId: 'villa' | 'quay', templateId?: string): void => {
    const def = missions.generate(Date.now() & 0xffff, { region: mapId, templateId });
    void missions.start(def, 'front');
    console.info(`[mission] ${def.codename} — ${def.objectives.length} objectives`);
  };
  beginMission(world.mapId);

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

  // --- map picker ---------------------------------------------------------
  //
  // Switches in place. Reloading the page is the obvious implementation and it
  // does not work here: the published build runs inside an artifact iframe,
  // and reloading that frame fails outright — the player gets "couldn't load
  // artifact" where the level should be. So the level is torn down and rebuilt
  // without any navigation at all.
  //
  // Order matters. Actors have to go before the world, because their colliders
  // live in the world's collider list and disposing that list first would
  // leave `despawn` unregistering from a list that no longer exists.
  const worldSys = services.get('world') as unknown as {
    mapId: 'villa' | 'quay';
    buildMap(id: 'villa' | 'quay'): void;
    teardown(): void;
    floorAt(x: number, z: number, from: number): number;
    site: { name: string };
  };

  let switching = false;
  const switchMap = (id: 'villa' | 'quay', templateId?: string): void => {
    if (switching || id === worldSys.mapId) {
      // Same map, different tasking: no rebuild, just re-brief. Tearing the
      // level down to change which objectives are on it would throw away a
      // second of work for nothing.
      if (!switching && templateId) beginMission(id, templateId);
      return;
    }
    switching = true;
    const t0 = performance.now();
    try {
      engine.setPaused(true);

      const bodies = engine.get('actorBodies') as unknown as { clearAll(): void } | undefined;
      const registry = engine.get('actors') as unknown as
        { clear(): void } & Parameters<typeof garrison>[1];
      bodies?.clearAll();
      registry.clear();
      ai.reset();

      worldSys.teardown();
      worldSys.buildMap(id);
      writeMapChoice(id);

      // The player re-registers as actor 0 and lands on the new map's own
      // insertion point. Doing this through the controller rather than by
      // writing a position keeps the eye/feet split and the spawn logic in one
      // place.
      player.respawn();

      (engine.get('interiorLights') as unknown as { reload(): void } | undefined)?.reload();
      garrison(id, registry, ai, (x, z) => worldSys.floorAt(x, z, 40));
      beginMission(id, templateId);

      console.info(`[map] switched to ${worldSys.site.name} in ${Math.round(performance.now() - t0)}ms`);
      bus.emit('ui:notify', { text: worldSys.site.name, kind: 'info' });
    } finally {
      // Not an unconditional resume: the deploy screen rebuilds the level while
      // it is still on top, and handing the sim back under an open menu would
      // let the garrison walk around behind the briefing.
      engine.setPaused(menu.isOpen);
      switching = false;
    }

    for (const b of Array.from(document.querySelectorAll<HTMLElement>('.mapbtn'))) {
      b.classList.toggle('on', b.dataset.map === id);
    }
  };

  for (const btn of Array.from(document.querySelectorAll<HTMLElement>('.mapbtn'))) {
    const id = btn.dataset.map as 'villa' | 'quay';
    btn.classList.toggle('on', id === worldSys.mapId);
    btn.addEventListener('click', (e) => {
      // The overlay's own click handler starts the game; a map button must not
      // also do that, or picking a map drops you straight into the old level
      // for the frame before the new one exists.
      e.stopPropagation();
      switchMap(id);
    });
  }

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

  // --- the menu ------------------------------------------------------------
  //
  // Escape is the only key a browser will not let a game keep to itself: in
  // real pointer lock the engine never sees it, the lock just drops. So the
  // menu opens on the *release* rather than on the key — `pointerlockchange`
  // below routes into `openMenu`, and the keydown path covers soft capture and
  // the case where control was never taken in the first place.
  const openMenu = (): void => {
    if (menu.isOpen) return;
    input.setSoftCapture(false);
    if (document.pointerLockElement) document.exitPointerLock();
    overlay?.classList.add('hidden');
    engine.setPaused(true);
    menu.open('deploy');
  };

  const closeMenu = (): void => {
    if (!menu.isOpen) return;
    menu.close();
  };

  // The menu closing is the resume: unpause, and take the cursor back. The
  // click that dismissed it is a user activation, which is exactly what
  // `requestPointerLock` needs, so this is the most reliable moment in the
  // whole session to get true lock.
  bus.on('ui:screenChanged', ({ screen }) => {
    if (screen !== 'game') return;
    engine.setPaused(false);
    engage();
  });

  menu.hooks = {
    deploy: (site, missionId) => switchMap(site, missionId),
    setWeapon: (slot, specId) => { weapons.setSlotWeapon(slot, specId); },
    setSkin: (slot, skinId) => { weapons.setSkin(slot, skinId); },
    settings: {
      get sensitivity() { return input.sensitivity; },
      set sensitivity(v: number) { input.sensitivity = v; },
      get invertY() { return input.invertY; },
      set invertY(v: boolean) { input.invertY = v; },
      get fov() { return render.baseFov; },
      set fov(v: number) {
        render.baseFov = v;
        // Write the camera directly as well.
        //
        // The player controller is what normally damps `camera.fov` toward
        // `baseFov`, and it is order 10 — which the engine does not run while
        // paused. So dragging the field-of-view slider with the menu open
        // changed a number and nothing on screen, which reads as a broken
        // control. This makes it live; the controller takes over on resume.
        render.camera.fov = v;
        render.camera.updateProjectionMatrix();
      },
      apply() { /* every setter writes straight through to a live system. */ },
    },
  };

  document.getElementById('open-menu')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openMenu();
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

  // Escape toggles the menu, in both capture modes and in neither.
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (menu.isOpen) closeMenu();
    else openMenu();
  });
  document.addEventListener('pointerlockchange', () => {
    // Chromium swallows the Escape that exits pointer lock, so this is the
    // only signal that the player asked for the cursor back. Ignore the drop
    // that happens because we ourselves released it to show the menu.
    if (document.pointerLockElement === canvas) return;
    if (menu.isOpen || !input.engaged || input.usingSoftCapture) return;
    openMenu();
  });

  // Expose for debugging from the devtools console.
  (window as unknown as { engine: Engine; bus: typeof bus; services: typeof services }).engine = engine;
  (window as unknown as { bus: typeof bus }).bus = bus;
  (window as unknown as { services: typeof services }).services = services;
}

boot().catch(fatal);
