/**
 * Interior lighting.
 *
 * OWNED BY: Lighting.
 *
 * ## Why this exists
 * Until now the only lights in the project were the sun, the moon and a
 * hemisphere ambient. That is fine outdoors and catastrophic indoors: a room
 * with a roof on it receives no sun, so every interior rendered as one flat
 * ambient-blue value with no contrast, no shape and no sense of depth. The
 * villa's doorways read as black holes and the warehouse read as a fog bank.
 *
 * No amount of material work fixes that. A surface with one light on it has
 * one value, and the eye reads shape from *variation*.
 *
 * ## The budget problem
 * `MeshStandardMaterial` evaluates every light in the scene for every fragment,
 * and three.js recompiles shaders when the light count changes. A hundred lamp
 * fixtures would be both slow and a compile storm.
 *
 * So fixtures are **authored data**, not lights. A small pool of real lights —
 * eight by default — is reassigned each frame to the nearest active fixtures.
 * The player sees lit rooms wherever they are, the shader sees a constant
 * light count, and the cost is one sort over a few hundred points.
 */

import * as THREE from 'three';
import type { System, EngineContext } from '../core/engine';
import { services } from '../core/contracts';
import { lerp, clamp01 } from '../core/math';

export interface Fixture {
  position: THREE.Vector3;
  color: number;
  /** Peak intensity when fully on. */
  intensity: number;
  distance: number;
  /**
   * True for lights that are on during the day too — a windowless cold store
   * or a warehouse floor is lit around the clock, and that is exactly where
   * the lighting matters most.
   */
  alwaysOn: boolean;
}

/** Real lights in the scene. Kept small: every one costs every fragment. */
const POOL_SIZE = 8;

export class InteriorLights implements System {
  readonly id = 'interiorLights';
  readonly order = 16;
  readonly initOrder = 74;
  readonly budgetMs = 0.5;

  private fixtures: Fixture[] = [];
  private pool: THREE.PointLight[] = [];
  private scored: Array<{ f: Fixture; d2: number }> = [];
  private eye = new THREE.Vector3();

  /** Diagnostics. */
  readonly stats = { fixtures: 0, active: 0 };

  init(_ctx: EngineContext): void {
    const scene = services.get('render').scene;

    // Pull the site's authored fixtures. World builds at order 14 and this
    // runs at 74, so they are always there by now.
    const world = services.tryGet('world') as unknown as {
      authoredLights?: Array<{
        position: { x: number; y: number; z: number };
        color: number; intensity: number; distance: number; alwaysOn: boolean;
      }>;
    } | undefined;
    for (const f of world?.authoredLights ?? []) {
      this.add({
        position: new THREE.Vector3(f.position.x, f.position.y, f.position.z),
        color: f.color, intensity: f.intensity, distance: f.distance, alwaysOn: f.alwaysOn,
      });
    }
    console.info(`[lights] ${this.fixtures.length} interior fixtures`);

    for (let i = 0; i < POOL_SIZE; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 1);
      l.name = `interior:${i}`;
      // Shadow-casting point lights are six render passes each. At eight
      // lights that is 48 passes a frame, which is not a trade worth making
      // for a low-poly game — the value contrast is doing the work here, not
      // the shadow.
      l.castShadow = false;
      l.visible = false;
      scene.add(l);
      this.pool.push(l);
    }
  }

  /** Re-read the current site's fixtures. Called after a map switch. */
  reload(): void {
    this.clear();
    const world = services.tryGet('world') as unknown as {
      authoredLights?: Array<{
        position: { x: number; y: number; z: number };
        color: number; intensity: number; distance: number; alwaysOn: boolean;
      }>;
    } | undefined;
    for (const f of world?.authoredLights ?? []) {
      this.add({
        position: new THREE.Vector3(f.position.x, f.position.y, f.position.z),
        color: f.color, intensity: f.intensity, distance: f.distance, alwaysOn: f.alwaysOn,
      });
    }
    // Anything still lit from the old level would hang in mid-air over the new
    // one until the pool happened to reassign it.
    for (const l of this.pool) { l.visible = false; l.intensity = 0; }
  }

  /** Authored by the site builders. */
  add(f: Fixture): void {
    this.fixtures.push(f);
    this.stats.fixtures = this.fixtures.length;
  }

  addMany(list: Fixture[]): void {
    for (const f of list) this.add(f);
  }

  clear(): void {
    this.fixtures.length = 0;
    this.stats.fixtures = 0;
  }

  update(_dt: number, _ctx: EngineContext): void {
    if (this.fixtures.length === 0) return;
    const render = services.get('render');
    this.eye.copy(render.camera.position);

    // Night, or a dark day, turns everything on; bright noon leaves only the
    // fixtures that are on regardless.
    const env = services.tryGet('environment') as unknown as
      { time?: { ambientLightLevel: number } } | undefined;
    const day = clamp01(env?.time?.ambientLightLevel ?? 1);
    const nightGain = lerp(1.0, 0.35, day);

    this.scored.length = 0;
    for (const f of this.fixtures) {
      if (!f.alwaysOn && day > 0.55) continue;
      const d2 = this.eye.distanceToSquared(f.position);
      // Beyond its own reach a fixture contributes nothing, so it is not worth
      // a slot even if it is the nearest thing.
      if (d2 > (f.distance + 6) * (f.distance + 6)) continue;
      this.scored.push({ f, d2 });
    }
    this.scored.sort((a, b) => a.d2 - b.d2);

    const n = Math.min(POOL_SIZE, this.scored.length);
    for (let i = 0; i < POOL_SIZE; i++) {
      const l = this.pool[i];
      if (i >= n) { l.visible = false; l.intensity = 0; continue; }
      const { f } = this.scored[i];
      l.visible = true;
      l.position.copy(f.position);
      l.color.setHex(f.color);
      l.distance = f.distance;
      l.decay = 2;
      l.intensity = f.intensity * (f.alwaysOn ? 1 : nightGain);
    }
    this.stats.active = n;
  }

  dispose(): void {
    for (const l of this.pool) l.removeFromParent();
    this.pool.length = 0;
  }
}
