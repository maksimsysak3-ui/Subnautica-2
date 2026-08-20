/**
 * Capture director — named, deterministic camera/state setups for the critic
 * screenshot pipeline.
 *
 * Every shot pins seed, time of day, weather, camera and quality so two runs
 * are byte-comparable except for what actually changed. Teams add shots that
 * showcase their system; critics grade the frames.
 */

import * as THREE from 'three';
import type { Engine } from './engine';
import { services } from './contracts';
import type { WeatherKind } from './contracts';

export interface ShotMeta {
  label: string;
  hour: number;
  weather: string;
  quality: string;
  system: string;
}

export interface ShotDef {
  name: string;
  label: string;
  system: string;
  hour: number;
  weather: WeatherKind;
  /** Camera position and look-at target in world space. */
  pos: [number, number, number];
  look: [number, number, number];
  fov?: number;
  quality?: number;
  /** Optional extra setup (spawn actors, equip a weapon, open a menu). */
  apply?: () => void;
}

export class CaptureDirector {
  private shots = new Map<string, ShotDef>();

  constructor(private engine: Engine) {
    this.registerDefaults();
  }

  /** Teams register their own showcase shots. */
  register(def: ShotDef): void {
    this.shots.set(def.name, def);
  }

  listShots(): string[] {
    return [...this.shots.keys()];
  }

  setup(name: string): ShotMeta | null {
    const shot = this.shots.get(name);
    if (!shot) return null;

    const render = services.get('render') as unknown as {
      camera: THREE.PerspectiveCamera;
      quality: number;
      preset: { name: string };
    };
    const env = services.get('environment') as unknown as {
      setHour(h: number): void;
      forceWeather(k: WeatherKind): void;
      setTimeScale(s: number): void;
    };

    if (shot.quality !== undefined) render.quality = shot.quality;
    env.setTimeScale(0); // freeze the clock so the shot is reproducible
    env.setHour(shot.hour);
    env.forceWeather(shot.weather);

    const player = this.engine.get('player') as unknown as
      | { setControlsEnabled(v: boolean): void; position: THREE.Vector3 }
      | undefined;
    player?.setControlsEnabled(false);

    const cam = render.camera;
    cam.position.set(...shot.pos);
    cam.lookAt(new THREE.Vector3(...shot.look));
    if (shot.fov) {
      cam.fov = shot.fov;
      cam.updateProjectionMatrix();
    }

    shot.apply?.();

    return {
      label: shot.label,
      hour: shot.hour,
      weather: shot.weather,
      quality: render.preset?.name ?? String(render.quality),
      system: shot.system,
    };
  }

  setQuality(tier: number): void {
    const render = services.get('render') as unknown as { quality: number };
    render.quality = tier;
  }

  /** Teleport the player onto the floor at (x,z), facing `yaw`. */
  placePlayer(x: number, z: number, yaw: number): { x: number; y: number; z: number } | null {
    const player = this.engine.get('player') as unknown as {
      position: THREE.Vector3; yaw: number; velocity: THREE.Vector3;
      setControlsEnabled(v: boolean): void;
      eyeHeightNow: number;
    } | undefined;
    if (!player) return null;
    const world = services.get('world');
    const floor = world.floorAt(x, z, 40);
    player.setControlsEnabled(true);
    player.position.set(x, (Number.isFinite(floor) ? floor : 0) + 1.68, z);
    player.velocity.set(0, 0, 0);
    player.yaw = yaw;
    return { x: player.position.x, y: player.position.y, z: player.position.z };
  }

  /**
   * Runs the player controller for `frames` fixed steps with the given input.
   * `insideGeometry` is the assertion that matters: a character that ends a
   * move inside a solid brick means collision is not working.
   */
  drivePlayer(
    input: Partial<Record<'moveX' | 'moveZ' | 'sprint' | 'crouch', number | boolean>>,
    frames: number,
  ): { x: number; y: number; z: number; grounded: boolean; insideGeometry: boolean } | null {
    const player = this.engine.get('player') as unknown as {
      position: THREE.Vector3; grounded: boolean;
      input: Record<string, unknown>;
      fixedUpdate(step: number, ctx: unknown): void;
    } | undefined;
    if (!player) return null;

    Object.assign(player.input, input);
    for (let i = 0; i < frames; i++) {
      player.fixedUpdate(1 / 60, this.engine.ctx);
    }
    Object.assign(player.input, { moveX: 0, moveZ: 0, sprint: false });

    const world = services.get('world') as unknown as {
      yard?: { count: number; containsPoint(i: number, x: number, y: number, z: number): boolean };
      overlapBricks?(c: THREE.Vector3, r: number, visit: (b: number) => void): void;
    };
    let inside = false;
    const chest = player.position.clone();
    chest.y -= 0.6;
    if (world.overlapBricks && world.yard) {
      const yard = world.yard;
      world.overlapBricks(chest, 0.4, (b) => {
        if (!inside && yard.containsPoint(b, chest.x, chest.y, chest.z)) inside = true;
      });
    }

    return {
      x: +player.position.x.toFixed(3),
      y: +player.position.y.toFixed(3),
      z: +player.position.z.toFixed(3),
      grounded: player.grounded,
      insideGeometry: inside,
    };
  }

  // -----------------------------------------------------------------------
  // Weapon test harness
  // -----------------------------------------------------------------------

  spawnTarget(x: number, y: number, z: number, faction = 'cartel'): number {
    const actors = services.get('actors') as unknown as {
      spawn(o: Record<string, unknown>): { id: number };
    };
    const world = services.get('world');
    const floor = world.floorAt(x, z, y + 20);
    const a = actors.spawn({
      faction,
      archetype: 'test-target',
      position: new THREE.Vector3(x, Number.isFinite(floor) ? floor : y, z),
      health: 100,
    });
    return a.id;
  }

  /**
   * Fire one round on a flat trajectory and sample it as it passes a range.
   *
   * Measuring at a *range* rather than after a fixed number of steps is the
   * whole point: flight time, drop and retained velocity are only meaningful
   * against a distance. The first version of this ran the round to its 6-second
   * timeout and reported the same numbers for every range, which said nothing.
   */
  ballisticProfile(rangeM: number): {
    muzzle: number; flightSeconds: number; dropMetres: number; impactSpeed: number; reached: boolean;
  } {
    const engine = this.engine;
    const ballistics = engine.get('ballistics') as unknown as {
      fire(o: THREE.Vector3, d: THREE.Vector3, ammo: unknown, v: number, id: number): unknown;
      fixedUpdate(s: number, c: unknown): void;
      clear(): void;
    };
    const runtime = engine.get('weaponRuntime') as unknown as {
      equipped: { stats: { muzzleVelocity: number }; ammoId: string } | null;
    };
    const weapons = services.get('weapons');
    const inst = runtime.equipped;
    const ammo = inst ? weapons.ammo.get(inst.ammoId) : undefined;
    if (!inst || !ammo) {
      return { muzzle: 0, flightSeconds: 0, dropMetres: 0, impactSpeed: 0, reached: false };
    }

    ballistics.clear();
    // High above the map, fired dead level, so nothing is in the way and the
    // only thing bending the path is gravity and drag.
    const origin = new THREE.Vector3(0, 400, 0);
    const dir = new THREE.Vector3(1, 0, 0);
    const p = ballistics.fire(origin, dir, ammo, inst.stats.muzzleVelocity, -1) as
      { active: boolean; position: THREE.Vector3; velocity: THREE.Vector3; age: number } | null;
    if (!p) return { muzzle: 0, flightSeconds: 0, dropMetres: 0, impactSpeed: 0, reached: false };

    const step = 1 / 240; // fine step so the sample lands close to the range
    let reached = false;
    for (let i = 0; i < 20000 && p.active; i++) {
      ballistics.fixedUpdate(step, engine.ctx);
      if (p.position.x - origin.x >= rangeM) { reached = true; break; }
    }

    return {
      muzzle: Math.round(inst.stats.muzzleVelocity),
      flightSeconds: Math.round(p.age * 1000) / 1000,
      // Fired level, so the drop is simply how far below the muzzle it is.
      dropMetres: Math.round((origin.y - p.position.y) * 1000) / 1000,
      impactSpeed: Math.round(p.velocity.length()),
      reached,
    };
  }

  /** Fire a burst at a point and report what the simulation actually did. */
  fireAt(x: number, y: number, z: number, rounds: number): {
    fired: number; impacts: number; actorHits: number; penetrations: number; ricochets: number;
    flightSeconds: number; dropMetres: number; impactSpeed: number;
  } {
    const engine = this.engine;
    const ballistics = engine.get('ballistics') as unknown as {
      stats: { fired: number; impacts: number; penetrations: number; ricochets: number; actorHits: number };
      fire(o: THREE.Vector3, d: THREE.Vector3, ammo: unknown, v: number, id: number): unknown;
      clear(): void;
    };
    const runtime = engine.get('weaponRuntime') as unknown as {
      equipped: { stats: { muzzleVelocity: number }; ammoId: string } | null;
    };
    const render = services.get('render') as unknown as { camera: THREE.PerspectiveCamera };
    const weapons = services.get('weapons');

    ballistics.clear();
    const before = { ...ballistics.stats };

    const target = new THREE.Vector3(x, y, z);
    const origin = render.camera.position.clone();
    const dir = target.clone().sub(origin).normalize();

    const inst = runtime.equipped;
    const ammo = inst ? weapons.ammo.get(inst.ammoId) : undefined;
    if (!inst || !ammo) {
      return { fired: 0, impacts: 0, actorHits: 0, penetrations: 0, ricochets: 0,
               flightSeconds: 0, dropMetres: 0, impactSpeed: 0 };
    }

    // Fire a single tracked round first so flight time and drop can be measured
    // without the burst's dispersion confusing the reading.
    const tracked = ballistics.fire(origin, dir, ammo, inst.stats.muzzleVelocity, -1) as
      { active: boolean; position: THREE.Vector3; velocity: THREE.Vector3; age: number } | null;

    let flightSeconds = 0;
    let dropMetres = 0;
    let impactSpeed = 0;
    if (tracked) {
      const aimLine = origin.clone();
      const step = 1 / 60;
      for (let i = 0; i < 600 && tracked.active; i++) {
        (engine.get('ballistics') as unknown as { fixedUpdate(s: number, c: unknown): void })
          .fixedUpdate(step, engine.ctx);
      }
      flightSeconds = tracked.age;
      // Vertical difference between where the round ended up and the straight
      // line it was launched along — this is bullet drop.
      const travelled = tracked.position.distanceTo(origin);
      const straight = aimLine.clone().addScaledVector(dir, travelled);
      dropMetres = straight.y - tracked.position.y;
      impactSpeed = tracked.velocity.length();
    }

    for (let i = 0; i < rounds; i++) {
      ballistics.fire(origin, dir, ammo, inst.stats.muzzleVelocity, -1);
    }
    for (let i = 0; i < 600; i++) {
      (engine.get('ballistics') as unknown as { fixedUpdate(s: number, c: unknown): void })
        .fixedUpdate(1 / 60, engine.ctx);
    }

    const s = ballistics.stats;
    return {
      fired: s.fired - before.fired,
      impacts: s.impacts - before.impacts,
      actorHits: s.actorHits - before.actorHits,
      penetrations: s.penetrations - before.penetrations,
      ricochets: s.ricochets - before.ricochets,
      flightSeconds: Math.round(flightSeconds * 1000) / 1000,
      dropMetres: Math.round(dropMetres * 1000) / 1000,
      impactSpeed: Math.round(impactSpeed),
    };
  }


  equipWeapon(specId: string, attachments?: Record<string, string>, ammoId?: string): unknown {
    const runtime = this.engine.get('weaponRuntime') as unknown as {
      weapons: { createInstance(id: string, a?: unknown, m?: string): unknown };
      equip(inst: unknown): void;
      reserve: Map<string, number>;
      equipped: { ammoId: string; stats: unknown } | null;
    };
    const inst = runtime.weapons.createInstance(specId, attachments as never, ammoId);
    runtime.equip(inst);
    runtime.reserve.set(runtime.equipped!.ammoId, 300);
    return runtime.equipped?.stats;
  }

  weaponState(): unknown {
    const runtime = this.engine.get('weaponRuntime') as unknown as {
      equipped: unknown; fireMode: string; ammoCount: unknown;
    };
    return { fireMode: runtime.fireMode, ammo: runtime.ammoCount, equipped: runtime.equipped };
  }

  setPass(id: string, enabled: boolean): boolean {
    const render = services.get('render') as unknown as {
      getPass?(id: string): { enabled: boolean } | undefined;
    };
    const pass = render.getPass?.(id);
    if (!pass) return false;
    pass.enabled = enabled;
    return true;
  }

  listPasses(): Array<{ id: string; order: number; enabled: boolean }> {
    const render = services.get('render') as unknown as {
      passes?: ReadonlyArray<{ id: string; order: number; enabled: boolean }>;
    };
    return (render.passes ?? []).map((p) => ({ id: p.id, order: p.order, enabled: p.enabled }));
  }

  renderStats(): { drawCalls: number; triangles: number } {
    const render = services.get('render') as unknown as {
      stats?(): { drawCalls: number; triangles: number };
    };
    return render.stats ? render.stats() : { drawCalls: 0, triangles: 0 };
  }

  private registerDefaults(): void {
    // Baseline environment coverage — every lighting condition the critics
    // grade against the reference titles.
    const overlook: [number, number, number] = [72, 26, 78];
    const centre: [number, number, number] = [0, 4, 0];

    this.register({ name: 'env-golden-hour', label: 'District overlook, golden hour', system: 'lighting',
      hour: 17.6, weather: 'clear', quality: 3, pos: overlook, look: centre });
    this.register({ name: 'env-harsh-noon', label: 'District overlook, harsh noon', system: 'lighting',
      hour: 12.2, weather: 'clear', quality: 3, pos: overlook, look: centre });
    this.register({ name: 'env-blue-hour', label: 'District overlook, blue hour', system: 'lighting',
      hour: 19.3, weather: 'clear', quality: 3, pos: overlook, look: centre });
    this.register({ name: 'env-night', label: 'District overlook, night', system: 'lighting',
      hour: 1.5, weather: 'clear', quality: 3, pos: overlook, look: centre });
    this.register({ name: 'env-fog-dawn', label: 'Volumetric fog at dawn', system: 'weather',
      hour: 6.1, weather: 'fog', quality: 3, pos: [48, 12, 52], look: [0, 3, 0] });
    this.register({ name: 'env-heavy-rain', label: 'Heavy rain, overcast', system: 'weather',
      hour: 15.0, weather: 'heavyRain', quality: 3, pos: [40, 9, 44], look: [0, 3, 0] });
    this.register({ name: 'env-sandstorm', label: 'Sandstorm', system: 'weather',
      hour: 14.0, weather: 'sandstorm', quality: 3, pos: [38, 8, 40], look: [0, 3, 0] });

    this.register({ name: 'site-overview', label: 'Casa Verdugo and its approaches, from the south-east',
      system: 'world', hour: 9.4, weather: 'clear', quality: 3,
      pos: [210, 118, 250], look: [-10, 0, 10], fov: 52 });
    this.register({ name: 'site-approach', label: 'Access road toward the compound',
      system: 'world', hour: 7.8, weather: 'clear', quality: 3,
      pos: [4, 6.5, 170], look: [0, 4, 60], fov: 62 });
    this.register({ name: 'env-street-level', label: 'Street level, eye height', system: 'world',
      hour: 16.4, weather: 'clear', quality: 3, pos: [10, 3.6, 34], look: [-6, 2.4, -10] });
    this.register({ name: 'env-interior', label: 'Building interior', system: 'world',
      hour: 13.0, weather: 'clear', quality: 3, pos: [2, 3.4, 22], look: [-14, 2.2, 6] });
  }
}
