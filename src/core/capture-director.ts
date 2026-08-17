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

interface ShotDef {
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
