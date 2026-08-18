/**
 * Player controller — movement, stance, lean, camera.
 *
 * OWNED BY: Player/Movement team. Animation team drives the viewmodel from the
 * state exposed here; do not move the camera from anim code, feed offsets in
 * through `addCameraOffset` so ownership stays single-threaded.
 *
 * Movement model targets the Ground Branch end of the spectrum: momentum,
 * stance transitions that cost time, and weapon weight that visibly slows you.
 */

import * as THREE from 'three';
import type { System, EngineContext } from '../core/engine';
import { bus, type StanceId } from '../core/events';
import { services } from '../core/contracts';
import { clamp, clamp01, damp, lerp, moveTowards, smoothstep } from '../core/math';

const EYE_HEIGHT: Record<StanceId, number> = { stand: 1.68, crouch: 1.12, prone: 0.36 };
const STANCE_SPEED: Record<StanceId, number> = { stand: 1.0, crouch: 0.52, prone: 0.22 };
/** Seconds to transition between stances — deliberately not instant. */
const STANCE_TIME: Record<string, number> = {
  'stand>crouch': 0.28, 'crouch>stand': 0.32,
  'crouch>prone': 0.62, 'prone>crouch': 0.78,
  'stand>prone': 0.85, 'prone>stand': 1.05,
};

export interface PlayerInput {
  moveX: number;   // -1..1 strafe
  moveZ: number;   // -1..1 forward
  lookX: number;   // radians delta this frame
  lookY: number;
  sprint: boolean;
  walk: boolean;   // deliberate slow, quiet movement
  jump: boolean;
  crouch: boolean;
  prone: boolean;
  lean: number;    // -1..1
  aim: boolean;
  fire: boolean;
  reload: boolean;
}

export function emptyInput(): PlayerInput {
  return {
    moveX: 0, moveZ: 0, lookX: 0, lookY: 0,
    sprint: false, walk: false, jump: false, crouch: false, prone: false,
    lean: 0, aim: false, fire: false, reload: false,
  };
}

export class PlayerSystem implements System {
  readonly id = 'player';
  readonly order = 10;
  /** Updates before the world but needs it to exist for the ground snap. */
  readonly initOrder = 30;
  readonly budgetMs = 1;

  readonly input: PlayerInput = emptyInput();

  // Spawn on the approach outside the compound wall, facing the gate — the
  // first thing the player sees should be the objective, not their own back.
  position = new THREE.Vector3(6, 3, 96);
  velocity = new THREE.Vector3();
  /** Yaw/pitch in radians. Yaw 0 looks down -Z, toward the site centre. */
  yaw = 0.06;
  pitch = -0.02;

  stance: StanceId = 'stand';
  private stanceTarget: StanceId = 'stand';
  private stanceProgress = 1;
  private stanceDuration = 0.3;
  private eyeHeight = EYE_HEIGHT.stand;

  lean = 0;
  private leanTarget = 0;

  aiming = false;
  private adsAmount = 0;

  grounded = true;
  stamina = 100;
  maxStamina = 100;
  health = 100;
  maxHealth = 100;

  /** Total carried mass in kg — set by the loadout system. */
  carriedMassKg = 12;

  /** Additive camera offsets contributed by recoil, breathing, footstep sway. */
  private cameraOffset = new THREE.Vector3();
  private cameraRotOffset = new THREE.Euler();

  /** Speed the player is actually moving, for animation and audio. */
  speed = 0;
  /** 0..1 how loud the player currently is — feeds AI hearing. */
  noiseLevel = 0;

  private controlsEnabled = true;

  init(_ctx: EngineContext): void {
    const world = services.get('world');
    const g = world.groundHeight(this.position.x, this.position.z);
    if (g !== null) this.position.y = g + this.eyeHeight;
  }

  setControlsEnabled(v: boolean): void {
    this.controlsEnabled = v;
  }

  /** Recoil/animation systems push transient camera offsets through here. */
  addCameraOffset(pos: THREE.Vector3, rot: THREE.Euler): void {
    this.cameraOffset.add(pos);
    this.cameraRotOffset.x += rot.x;
    this.cameraRotOffset.y += rot.y;
    this.cameraRotOffset.z += rot.z;
  }

  requestStance(s: StanceId): void {
    if (s === this.stanceTarget) return;
    const key = `${this.stance}>${s}`;
    this.stanceDuration = STANCE_TIME[key] ?? 0.4;
    this.stanceProgress = 0;
    const from = this.stance;
    this.stanceTarget = s;
    bus.emit('player:stanceChanged', { from, to: s });
  }

  fixedUpdate(step: number, _ctx: EngineContext): void {
    if (!this.controlsEnabled) return;
    const world = services.get('world');
    const inp = this.input;

    // --- look ------------------------------------------------------------
    this.yaw -= inp.lookX;
    this.pitch = clamp(this.pitch - inp.lookY, -1.45, 1.45);
    inp.lookX = 0;
    inp.lookY = 0;

    // --- stance ----------------------------------------------------------
    if (this.stanceProgress < 1) {
      this.stanceProgress = Math.min(1, this.stanceProgress + step / this.stanceDuration);
      if (this.stanceProgress >= 1) this.stance = this.stanceTarget;
    }
    const targetEye = EYE_HEIGHT[this.stanceTarget];
    const fromEye = EYE_HEIGHT[this.stance];
    this.eyeHeight = lerp(fromEye, targetEye, smoothstep(0, 1, this.stanceProgress));

    // --- movement --------------------------------------------------------
    // Encumbrance: every kg past 20 costs speed, matching the "weight matters"
    // feel of the reference titles rather than a flat sprint toggle.
    const encumbrance = clamp01((this.carriedMassKg - 20) / 30);
    const baseSpeed = 3.55 * lerp(1, 0.68, encumbrance);
    let target = baseSpeed * STANCE_SPEED[this.stanceTarget];

    const wantsSprint = inp.sprint && inp.moveZ > 0.3 && this.stanceTarget === 'stand' && this.stamina > 5 && !this.aiming;
    if (wantsSprint) target *= 1.72;
    else if (inp.walk) target *= 0.45;
    if (this.aiming) target *= 0.62;

    // Strafing and backpedalling are slower — no omnidirectional sprinting.
    const dirLocal = new THREE.Vector3(inp.moveX, 0, -inp.moveZ);
    if (dirLocal.lengthSq() > 1) dirLocal.normalize();
    if (inp.moveZ < 0) target *= 0.72;
    if (Math.abs(inp.moveX) > 0.5 && Math.abs(inp.moveZ) < 0.3) target *= 0.82;

    const wish = dirLocal.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw).multiplyScalar(target);

    // Ground acceleration with real inertia so direction changes have weight.
    const accel = this.grounded ? (wantsSprint ? 9 : 13) : 2.2;
    this.velocity.x = damp(this.velocity.x, wish.x, accel, step);
    this.velocity.z = damp(this.velocity.z, wish.z, accel, step);

    // Gravity + ground clamp.
    this.velocity.y -= 9.81 * step;
    const next = this.position.clone().addScaledVector(this.velocity, step);
    this.resolveCollisions(next, world);

    const ground = world.groundHeight(next.x, next.z);
    if (ground !== null) {
      const floor = ground + this.eyeHeight;
      if (next.y <= floor) {
        next.y = floor;
        this.velocity.y = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
    }
    this.position.copy(next);

    // --- stamina ---------------------------------------------------------
    if (wantsSprint) {
      this.stamina = Math.max(0, this.stamina - step * (14 + encumbrance * 12));
    } else {
      const rate = this.stanceTarget === 'stand' && this.speed < 0.5 ? 16 : 7;
      this.stamina = Math.min(this.maxStamina, this.stamina + step * rate);
    }

    // --- lean ------------------------------------------------------------
    this.leanTarget = this.stanceTarget === 'prone' ? 0 : clamp(inp.lean, -1, 1);
    const prevLean = this.lean;
    this.lean = moveTowards(this.lean, this.leanTarget, step * 4.2);
    if (Math.abs(this.lean - prevLean) > 0.001) {
      bus.post('player:leanChanged', { amount: this.lean });
    }

    // --- aim -------------------------------------------------------------
    const wasAiming = this.aiming;
    this.aiming = inp.aim && !wantsSprint;
    if (this.aiming !== wasAiming) bus.emit('player:adsChanged', { aiming: this.aiming });
    this.adsAmount = damp(this.adsAmount, this.aiming ? 1 : 0, 12, step);

    // --- derived ---------------------------------------------------------
    this.speed = Math.hypot(this.velocity.x, this.velocity.z);
    const stanceQuiet = this.stanceTarget === 'prone' ? 0.25 : this.stanceTarget === 'crouch' ? 0.5 : 1;
    const surface = world.surfaceProps(world.surfaceAt(this.position));
    this.noiseLevel = clamp01((this.speed / 6) * stanceQuiet * surface.footstepLoudness * (inp.walk ? 0.4 : 1));
  }

  /** Cheap capsule-vs-AABB pushout against level geometry. */
  private resolveCollisions(next: THREE.Vector3, world: ReturnType<typeof services.get<'world'>>): void {
    const radius = this.stanceTarget === 'prone' ? 0.55 : 0.34;
    const probeY = next.y - this.eyeHeight + 0.9;
    const center = new THREE.Vector3(next.x, probeY, next.z);
    const objs = world.overlapSphere(center, radius + 0.6);
    const box = new THREE.Box3();
    const closest = new THREE.Vector3();
    for (const o of objs) {
      if (!(o as THREE.Mesh).isMesh) continue;
      if (o.name === 'terrain') continue;
      box.setFromObject(o);
      if (box.max.y < next.y - this.eyeHeight + 0.25) continue; // step over low kerbs
      closest.copy(center).clamp(box.min, box.max);
      const d = closest.distanceTo(center);
      if (d < radius && d > 1e-5) {
        const push = center.clone().sub(closest).normalize().multiplyScalar(radius - d);
        next.x += push.x;
        next.z += push.z;
        center.set(next.x, probeY, next.z);
      }
    }
  }

  update(dt: number, _ctx: EngineContext): void {
    // When controls are disabled the camera belongs to someone else (the
    // capture director, a cutscene, the planning map). Writing to it here
    // would silently override them — which is exactly what made every
    // captured "shot" render from the player spawn instead of its own camera.
    if (!this.controlsEnabled) return;

    const render = services.get('render') as unknown as {
      camera: THREE.PerspectiveCamera;
      baseFov: number;
    };
    const cam = render.camera;

    // Lean translates AND rolls the camera — peeking exposes less of you.
    const leanOffset = new THREE.Vector3(this.lean * 0.42, -Math.abs(this.lean) * 0.06, 0)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    cam.position.copy(this.position).add(leanOffset).add(this.cameraOffset);
    cam.rotation.set(0, 0, 0);
    cam.rotateY(this.yaw + this.cameraRotOffset.y);
    cam.rotateX(this.pitch + this.cameraRotOffset.x);
    cam.rotateZ(-this.lean * 0.14 + this.cameraRotOffset.z);

    // FOV narrows with magnification when aiming.
    const targetFov = lerp(render.baseFov, render.baseFov * 0.62, this.adsAmount);
    if (Math.abs(cam.fov - targetFov) > 0.01) {
      cam.fov = damp(cam.fov, targetFov, 14, dt);
      cam.updateProjectionMatrix();
    }

    // Offsets are per-frame contributions; clear after consuming.
    this.cameraOffset.set(0, 0, 0);
    this.cameraRotOffset.set(0, 0, 0);
  }

  get adsProgress(): number {
    return this.adsAmount;
  }

  get eye(): THREE.Vector3 {
    return this.position;
  }

  get forward(): THREE.Vector3 {
    return new THREE.Vector3(0, 0, -1)
      .applyAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
  }
}
