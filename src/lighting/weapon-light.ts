/**
 * Weapon light.
 *
 * OWNED BY: Lighting.
 *
 * ## Why this is not optional
 * Half the missions in the catalogue are set between dusk and 0400, and until
 * now the only thing lighting a night approach was the sky, a handful of
 * authored interior fixtures and whatever the moon happened to be doing. That
 * is not "dark and tense", it is unplayable: you cannot clear a room you
 * cannot see, and a stealth game where the stealth option is "wait for
 * daylight" has one option.
 *
 * Every reference title solves it the same way — a light on the weapon,
 * toggled, that you have to decide whether to use. That decision is the
 * point. A lit torch is the loudest thing you own: it is visible from a very
 * long way off, it announces exactly where you are looking, and here it
 * genuinely does make the opposition see you sooner.
 *
 * ## The shape of the light
 * A real weapon light is not a cone of even brightness. It is a hot centre
 * spot for identification at distance and a much dimmer, much wider spill so
 * you can still see your feet and the doorway either side of you. Two
 * spotlights, one inside the other, is the cheapest honest way to get that,
 * and the difference between one cone and two is most of what makes a torch
 * feel like a torch rather than a projector.
 *
 * ## One rule this file obeys absolutely
 * The lights are created ONCE and never added to or removed from the scene,
 * and never have `visible` toggled. Three.js keys its program cache partly on
 * the number of lights of each type in the scene; changing that count
 * recompiles every material in the level. Toggling the torch would have cost a
 * full shader rebuild — a multi-second freeze — every single press. Off is
 * `intensity = 0`.
 */

import * as THREE from 'three';
import type { System, EngineContext } from '../core/engine';
import { services } from '../core/contracts';
import { bus } from '../core/events';
import { clamp01, damp } from '../core/math';

/** Hot centre: narrow, bright, and what you identify a target with. */
const SPOT_ANGLE = 0.19;        // ~11 degrees half-angle
const SPOT_INTENSITY = 46;
const SPOT_RANGE = 62;

/** Spill: wide and weak, so your own feet and the doorway edges are visible. */
const FLOOD_ANGLE = 0.62;       // ~36 degrees half-angle
const FLOOD_INTENSITY = 9;
const FLOOD_RANGE = 26;

const COLOR = 0xf2f6ff;         // slightly cold, like every real LED torch

export class WeaponLight implements System {
  readonly id = 'weaponLight';
  readonly order = 18;
  /** After render (so the scene exists) and after the player. */
  readonly initOrder = 76;
  readonly budgetMs = 0.2;

  /** True when the player has the torch switched on. */
  on = false;

  private spot!: THREE.SpotLight;
  private flood!: THREE.SpotLight;
  private target!: THREE.Object3D;
  /** Smoothed level, so the torch fades rather than pops. */
  private level = 0;
  /** Smoothed position/aim, so the beam lags the muzzle very slightly. */
  private aim = new THREE.Vector3(0, 0, -1);
  private dir = new THREE.Vector3();
  private origin = new THREE.Vector3();

  init(_ctx: EngineContext): void {
    const scene = services.get('render').scene;
    // Registered so perception can ask how exposed the player is without
    // importing this module — the AI must not depend on the lighting team.
    services.register('weaponLight', this);

    // A single shared target object both cones point at.
    this.target = new THREE.Object3D();
    scene.add(this.target);

    this.spot = new THREE.SpotLight(COLOR, 0, SPOT_RANGE, SPOT_ANGLE, 0.45, 1.4);
    // Shadows on the hot spot only. One spot shadow is one extra pass; two
    // would be two, and the spill cone is too weak for its shadow to read.
    // Without any shadow at all the beam shines straight through walls, which
    // is worse than having no torch.
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(1024, 1024);
    this.spot.shadow.camera.near = 0.4;
    this.spot.shadow.camera.far = SPOT_RANGE;
    this.spot.shadow.bias = -0.0016;
    this.spot.shadow.normalBias = 0.03;
    this.spot.target = this.target;
    scene.add(this.spot);

    this.flood = new THREE.SpotLight(COLOR, 0, FLOOD_RANGE, FLOOD_ANGLE, 0.9, 1.6);
    this.flood.castShadow = false;
    this.flood.target = this.target;
    scene.add(this.flood);

    // Both lights are in the scene from now until the page closes. See the
    // note at the top of this file about why that matters.
  }

  toggle(): void {
    this.on = !this.on;
    bus.emit('ui:notify', {
      text: this.on ? 'TORCH ON' : 'TORCH OFF',
      kind: this.on ? 'warn' : 'info',
    });
    bus.emit('audio:oneShot', { id: 'switch', volume: 0.35 });
  }

  update(dt: number, _ctx: EngineContext): void {
    const render = services.get('render');
    const cam = render.camera;

    this.level = damp(this.level, this.on ? 1 : 0, 22, dt);
    const lit = this.level > 0.002;

    // Below the visible threshold, park the intensities at zero and stop.
    // The lights stay in the scene either way.
    if (!lit) {
      this.spot.intensity = 0;
      this.flood.intensity = 0;
      return;
    }

    cam.getWorldDirection(this.dir);

    // The emitter sits where the light actually is: on the weapon, below and
    // right of the eye. Putting it at the eye makes the beam look painted onto
    // the screen; offsetting it means the beam's edge moves against the world
    // as you turn, which is the cue that sells it as a physical object.
    this.origin.copy(cam.position);
    const right = _right.copy(this.dir).cross(_up).normalize();
    this.origin.addScaledVector(right, 0.14);
    this.origin.addScaledVector(_up, -0.11);
    this.origin.addScaledVector(this.dir, 0.30);

    // The beam trails the aim very slightly — a torch clamped to a rail moves
    // with the weapon, and the weapon lags the camera.
    this.aim.lerp(this.dir, clamp01(dt * 26));
    this.aim.normalize();

    this.spot.position.copy(this.origin);
    this.flood.position.copy(this.origin);
    this.target.position.copy(this.origin).addScaledVector(this.aim, 12);

    // Fall off with the ambient level: a torch in daylight is nearly
    // invisible, and letting it wash out a noon scene would look wrong AND
    // hide the fact that it does nothing useful then.
    const env = services.tryGet('environment') as unknown as
      { time?: { ambientLightLevel: number } } | undefined;
    const day = clamp01(env?.time?.ambientLightLevel ?? 1);
    const useful = 1 - 0.72 * day;

    this.spot.intensity = SPOT_INTENSITY * this.level * useful;
    this.flood.intensity = FLOOD_INTENSITY * this.level * useful;
  }

  /**
   * How visible the operator is because of the torch, 0..1.
   *
   * Read by perception. A lit torch at night is the single loudest thing the
   * player carries and the AI has to treat it that way, or the decision to use
   * it is not a decision.
   */
  get exposure(): number {
    return this.level;
  }

  dispose(): void {
    this.spot?.parent?.remove(this.spot);
    this.flood?.parent?.remove(this.flood);
    this.target?.parent?.remove(this.target);
  }
}

const _up = new THREE.Vector3(0, 1, 0);
const _right = new THREE.Vector3();
