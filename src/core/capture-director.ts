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
      passes?: Array<{ id: string; order: number; enabled: boolean }>;
    };
    return (render.passes ?? []).map((p) => ({ id: p.id, order: p.order, enabled: p.enabled }));
  }

  renderStats(): { drawCalls: number; triangles: number } {
    const render = services.get('render') as unknown as {
      stats(): { drawCalls: number; triangles: number };
    };
    return render.stats ? render.stats() : { drawCalls: 0, triangles: 0 };
  }

  private registerDefaults(): void {
    // Baseline environment coverage — every lighting condition the critics
    // grade against the reference titles.
    this.register({
      name: 'env-golden-hour',
      label: 'District overlook, golden hour',
      system: 'lighting',
      hour: 17.6, weather: 'clear', quality: 3,
      pos: [72, 26, 78], look: [0, 4, 0],
    });
    this.register({
      name: 'env-harsh-noon',
      label: 'District overlook, harsh noon',
      system: 'lighting',
      hour: 12.2, weather: 'clear', quality: 3,
      pos: [72, 26, 78], look: [0, 4, 0],
    });
    this.register({
      name: 'env-blue-hour',
      label: 'District overlook, blue hour',
      system: 'lighting',
      hour: 19.3, weather: 'clear', quality: 3,
      pos: [72, 26, 78], look: [0, 4, 0],
    });
    this.register({
      name: 'env-night',
      label: 'District overlook, night',
      system: 'lighting',
      hour: 1.5, weather: 'clear', quality: 3,
      pos: [72, 26, 78], look: [0, 4, 0],
    });
    this.register({
      name: 'env-fog-dawn',
      label: 'Volumetric fog at dawn',
      system: 'weather',
      hour: 6.1, weather: 'fog', quality: 3,
      pos: [48, 12, 52], look: [0, 3, 0],
    });
    this.register({
      name: 'env-heavy-rain',
      label: 'Heavy rain, overcast',
      system: 'weather',
      hour: 15.0, weather: 'heavyRain', quality: 3,
      pos: [40, 9, 44], look: [0, 3, 0],
    });
    this.register({
      name: 'env-sandstorm',
      label: 'Sandstorm',
      system: 'weather',
      hour: 14.0, weather: 'sandstorm', quality: 3,
      pos: [38, 8, 40], look: [0, 3, 0],
    });
    this.register({
      name: 'site-overview',
      label: 'Casa Verdugo and its approaches, from the south-east',
      system: 'world',
      hour: 9.4, weather: 'clear', quality: 3,
      pos: [210, 118, 250], look: [-10, 0, 10], fov: 52,
    });
    this.register({
      name: 'site-approach',
      label: 'Access road toward the compound',
      system: 'world',
      hour: 7.8, weather: 'clear', quality: 3,
      pos: [4, 6.5, 170], look: [0, 4, 60], fov: 62,
    });
    this.register({
      name: 'env-street-level',
      label: 'Street level, eye height',
      system: 'world',
      hour: 16.4, weather: 'clear', quality: 3,
      pos: [10, 3.6, 34], look: [-6, 2.4, -10],
    });
    this.register({
      name: 'env-interior',
      label: 'Building interior',
      system: 'world',
      hour: 13.0, weather: 'clear', quality: 3,
      pos: [2, 3.4, 22], look: [-14, 2.2, 6],
    });
  }
}
