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
import type { CharacterShape } from '../core/contracts';
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
  /** Edge-triggered: open/close a door, use a switch, pick something up. */
  use: boolean;
}

export function emptyInput(): PlayerInput {
  return {
    moveX: 0, moveZ: 0, lookX: 0, lookY: 0,
    sprint: false, walk: false, jump: false, crouch: false, prone: false,
    lean: 0, aim: false, fire: false, reload: false, use: false,
  };
}

/** The slice of the registry's `Actor` the controller writes to. */
interface PlayerActorView {
  position: THREE.Vector3;
  forward: THREE.Vector3;
  velocity: THREE.Vector3;
  eye: THREE.Vector3;
  stance: string;
  alive: boolean;
  health: number;
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
  /**
   * Spawn point.
   *
   * Overwritten in init() from the site's own insertion routes, so a new map
   * does not need this constant edited — a hardcoded villa spawn on the quay
   * would put the player 90 m outside the fence, in the water.
   */
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
    this.respawn();
  }

  /**
   * Place the player at the current site's front approach and register them as
   * actor 0.
   *
   * Also called on a map switch, which is why it is separate from `init`: the
   * registry has been cleared by then, so the player has to re-register or the
   * AI has nothing to perceive and enemy fire has nothing to hit.
   */
  respawn(): void {
    const world = services.get('world') as unknown as {
      groundHeight(x: number, z: number): number | null;
      floorAt?(x: number, z: number, fromY: number): number;
      site?: { approaches?: Array<{ kind: string; x: number; y: number; z: number; toX: number; toZ: number }> };
    };

    // Start at the site's front approach, whichever map was built. A hardcoded
    // villa spawn on the quay would put the player 90 m outside the fence, in
    // the water.
    const site = world.site;
    const front = site?.approaches?.find((a) => a.kind === 'front') ?? site?.approaches?.[0];
    if (front) {
      this.position.set(front.x, front.y + this.eyeHeight, front.z);
      this.yaw = Math.atan2(front.toX - front.x, front.toZ - front.z);
      this.pitch = -0.02;
    }
    this.velocity.set(0, 0, 0);
    this.stance = 'stand';

    const floor = world.floorAt
      ? world.floorAt(this.position.x, this.position.z, this.position.y)
      : world.groundHeight(this.position.x, this.position.z);
    if (floor !== null && floor !== undefined && Number.isFinite(floor)) {
      this.position.y = floor + this.eyeHeight;
    }

    // Register the player as actor 0.
    //
    // Spawning is not on the read-only IActorRegistry contract — that
    // interface is deliberately a query surface. The concrete registry owns
    // creation, so the cast is where the boundary genuinely is.
    //
    // Without this the entire opposition is inert: the AI looks up
    // `actors.get(0)` to find something to perceive, and enemy fire calls
    // `applyDamage(0, ...)`. With no actor there, everything compiles and runs
    // and the game has no threat in it at all.
    const actors = services.tryGet('actors') as unknown as {
      spawn(o: Record<string, unknown>): PlayerActorView;
    } | undefined;
    if (actors) {
      this.actor = actors.spawn({
        faction: 'player',
        archetype: 'operator',
        position: this.position.clone(),
        facing: this.yaw,
        health: 100,
        skill: 1,
        isPlayer: true,
      });
      this.publishActor();
    }
  }

  /** The registry entry for the player. Damage and perception go through it. */
  actor: PlayerActorView | null = null;

  /**
   * Publish the player's transform into the actor registry.
   *
   * The controller owns the transform; the registry is a view of it. Copying
   * rather than sharing keeps that one-directional — if the registry held the
   * same Vector3 instance, anything that wrote to it would silently teleport
   * the player.
   */
  private publishActor(): void {
    const a = this.actor;
    if (!a) return;
    // Registry position is at the FEET, like every other actor; `position`
    // here is the eye.
    a.position.set(this.position.x, this.position.y - this.eyeHeight, this.position.z);
    a.eye.copy(this.position);
    a.forward.copy(this.forward);
    a.velocity.copy(this.velocity);
    a.stance = this.stance;
  }

  setControlsEnabled(v: boolean): void {
    this.controlsEnabled = v;
  }

  /**
   * Recoil/animation systems push transient camera offsets through here.
   *
   * Dropped while controls are disabled. These are cleared at the end of
   * `update()`, which early-returns when the capture director or a cutscene
   * owns the camera — so they accumulated as an unbounded random walk and the
   * first frame after control returned applied the whole sum at once, as a
   * single-frame snap of arbitrary size.
   */
  addCameraOffset(pos: THREE.Vector3, rot: THREE.Euler): void {
    if (!this.controlsEnabled) return;
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

    // --- jump -------------------------------------------------------------
    // 4.7 m/s gives about 1.13 m of clearance — over a waist-high wall, onto a
    // truck bed, onto a low roof edge. The first pass at 3.3 m/s cleared only
    // 0.55 m, which is kerb height and felt like the jump was not working.
    // Standing only: you cannot hop out of a crouch or off your belly, so
    // stance stays a real commitment.
    if (inp.jump) {
      inp.jump = false;
      if (this.grounded && this.stanceTarget === 'stand' && this.stamina > 12) {
        this.velocity.y = 4.7;
        this.grounded = false;
        this.stamina -= 9;
        bus.emit('player:jumped', { noise: 0.35 });
      }
    }

    // --- gravity + collision ---------------------------------------------
    this.velocity.y -= 9.81 * step;

    // `position.y` is the EYE height; the collider works in feet space.
    const feetY = this.position.y - this.eyeHeight;
    const shape: CharacterShape = {
      radius: this.stanceTarget === 'prone' ? 0.5 : 0.32,
      height: this.eyeHeight + 0.12,
      // Prone can't climb; standing clears a stair tread or a kerb.
      stepHeight: this.stanceTarget === 'prone' ? 0.06 : 0.46,
      minGroundNormalY: 0.55,
    };

    // Where the move would have ended with nothing in the way. The difference
    // between this and where it actually ended is the collision push, which is
    // the only reliable way to recover the contact normal.
    const wantX = this.position.x + this.velocity.x * step;
    const wantZ = this.position.z + this.velocity.z * step;

    const move = world.moveCharacter(
      this.position.x, feetY, this.position.z,
      this.velocity.x * step, this.velocity.y * step, this.velocity.z * step,
      shape,
    );

    this.position.set(move.x, move.y + this.eyeHeight, move.z);
    this.grounded = move.grounded;
    if (move.grounded && this.velocity.y < 0) this.velocity.y = 0;

    // Cancel only the velocity component driving INTO the surface and keep
    // what runs along it, so the player slides along a wall instead of being
    // glued to it. Scaling total velocity on every step of contact compounded
    // to roughly a quarter of walking speed, which is the opposite of the
    // corner-slicing the reference titles are built around.
    if (move.hitWall) {
      const bx = move.x - wantX;
      const bz = move.z - wantZ;
      const blen = Math.hypot(bx, bz);
      if (blen > 1e-5) {
        const nx = bx / blen;
        const nz = bz / blen;
        const into = this.velocity.x * nx + this.velocity.z * nz;
        if (into < 0) {
          this.velocity.x -= nx * into;
          this.velocity.z -= nz * into;
        }
      }
    }

    // --- stamina ---------------------------------------------------------
    if (wantsSprint) {
      this.stamina = Math.max(0, this.stamina - step * (14 + encumbrance * 12));
    } else {
      const rate = this.stanceTarget === 'stand' && this.speed < 0.5 ? 16 : 7;
      this.stamina = Math.min(this.maxStamina, this.stamina + step * rate);
    }

    // --- lean ------------------------------------------------------------
    this.publishActor();

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

    // --- interaction -----------------------------------------------------
    if (inp.use) {
      inp.use = false;
      this.tryInteract();
    }

    // --- derived ---------------------------------------------------------
    this.speed = Math.hypot(this.velocity.x, this.velocity.z);
    const stanceQuiet = this.stanceTarget === 'prone' ? 0.25 : this.stanceTarget === 'crouch' ? 0.5 : 1;
    const surface = world.surfaceProps(world.surfaceAt(this.position));
    this.noiseLevel = clamp01((this.speed / 6) * stanceQuiet * surface.footstepLoudness * (inp.walk ? 0.4 : 1));
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
    // Clamp the RENDERED pitch, not just the aim pitch.
    //
    // `fixedUpdate` clamps `this.pitch` to +-1.45 rad, but recoil was added
    // here afterwards with no limit of its own. Standing hip-fire on full auto
    // with the starting carbine accumulates about 8 degrees of climb against
    // 6.9 degrees of headroom — so looking up and holding the trigger pushed
    // the camera past 90 degrees, at which point the roll below flips the
    // horizon and yaw inverts.
    cam.rotateX(clamp(this.pitch + this.cameraRotOffset.x, -1.5, 1.5));
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

  /**
   * Reach for whatever is in front of the operator. Doors are the only
   * interactable so far; the gear team adds the rest through the same hook.
   */
  private tryInteract(): void {
    const world = services.get('world') as unknown as {
      doors?: {
        nearest(p: THREE.Vector3, radius?: number): { id: number; locked?: boolean } | null;
        toggle(id: number, byActorId?: number, fast?: boolean): boolean;
      };
    };
    const doors = world.doors;
    if (!doors) return;
    // Reach from a point slightly ahead of the chest, so you open the door you
    // are facing rather than one behind you.
    const reach = this.position.clone()
      .addScaledVector(this.forward, 0.9)
      .setY(this.position.y - 0.5);
    const door = doors.nearest(reach, 2.0);
    if (door) doors.toggle(door.id, 0, false);
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
