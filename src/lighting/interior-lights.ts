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
import { clamp01, smoothstep } from '../core/math';

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
/**
 * How many real lights exist.
 *
 * Eight was enough when only the quay authored fixtures. The villa's light
 * plan adds one per interior room plus the exterior hero fixtures, and a
 * compound where you can stand and see four rooms and a courtyard at once
 * needs more than eight of them live. Twelve unshadowed point lights is still
 * a single forward pass; the cost is uniform slots, not draw calls.
 */
const POOL_SIZE = 12;

export class InteriorLights implements System {
  readonly id = 'interiorLights';
  readonly order = 16;
  readonly initOrder = 74;
  readonly budgetMs = 0.5;

  private fixtures: Fixture[] = [];
  private pool: THREE.PointLight[] = [];
  private scored: Array<{ f: Fixture; d2: number }> = [];
  /** Which fixture each pool slot is currently bound to. */
  private bound: Array<Fixture | null> = [];
  /** 0..1 fade level per slot, so reassignment is a ramp rather than a cut. */
  private level: number[] = [];
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
      // Added visible and never hidden — see the note in update().
      l.visible = true;
      l.distance = 0.01;
      scene.add(l);
      this.pool.push(l);
      this.bound.push(null);
      this.level.push(0);
    }
  }

  /** Re-read the current site's fixtures. Called after a map switch. */
  reload(): void {
    this.clear();
    this.bound.fill(null);
    this.level.fill(0);
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
    // one until the pool happened to reassign it. Intensity, not visibility —
    // hiding a light changes the scene's light count and recompiles every
    // shader in it.
    for (const l of this.pool) { l.intensity = 0; l.distance = 0.01; }
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

  update(dt: number, _ctx: EngineContext): void {
    if (this.fixtures.length === 0) return;
    const render = services.get('render');
    this.eye.copy(render.camera.position);

    // Night, or a dark day, turns everything on; bright noon leaves only the
    // fixtures that are on regardless.
    const env = services.tryGet('environment') as unknown as
      { time?: { ambientLightLevel: number } } | undefined;
    const day = clamp01(env?.time?.ambientLightLevel ?? 1);
    // Smooth, not a cliff. `day > 0.55 ? skip : lerp(1, 0.35, day)` brought
    // every exterior fixture into the candidate set in the SAME frame at 64%
    // intensity — the whole street- and yard-lighting rig snapped on together
    // at dusk. This fades them up over minutes of game time instead.
    const nightGain = smoothstep(0.70, 0.40, day);

    this.scored.length = 0;
    for (const f of this.fixtures) {
      if (!f.alwaysOn && nightGain < 0.02) continue;
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
      const bound = this.bound[i];
      const cand = i < n ? this.scored[i].f : null;

      // Hysteresis. Slots used to be rebound to the i-th nearest fixture every
      // frame with no threshold, so in the warehouse — where fourteen high
      // bays compete for eight slots — a light teleported and a full-intensity
      // source appeared or vanished in a single frame every few metres of
      // walking. Only swap for a challenger that is meaningfully closer, and
      // only once the outgoing light has faded out.
      if (cand !== bound) {
        const challengerBetter = !bound || !cand
          || this.eye.distanceToSquared(cand.position)
             < 0.64 * this.eye.distanceToSquared(bound.position);
        if (challengerBetter && this.level[i] <= 0.02) {
          this.bound[i] = cand;
          this.level[i] = 0;
        }
      }

      const f = this.bound[i];
      const want = f && this.scored.some((sc) => sc.f === f) ? 1 : 0;
      // Ramp rather than cut, so a reassignment is a fade and not a pop.
      this.level[i] += Math.sign(want - this.level[i]) * Math.min(dt * 6, Math.abs(want - this.level[i]));

      if (!f) {
        // NEVER toggle `visible`. An invisible light is skipped by
        // projectObject, which changes numPointLights, which changes the
        // program cache key, which recompiles EVERY material in the scene.
        // Walking from the yard into the warehouse took the count 0 -> 8 and
        // cost eight full recompiles, each a multi-frame hitch.
        l.intensity = 0;
        l.distance = 0.01;
        continue;
      }
      l.position.copy(f.position);
      l.color.setHex(f.color);
      l.distance = f.distance;
      l.decay = 2;
      l.intensity = f.intensity * (f.alwaysOn ? 1 : nightGain) * this.level[i];
    }
    this.stats.active = n;
  }

  dispose(): void {
    for (const l of this.pool) l.removeFromParent();
    this.pool.length = 0;
  }
}
