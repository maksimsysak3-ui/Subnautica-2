/**
 * Projectile simulation.
 *
 * OWNED BY: Weapon systems.
 *
 * Bullets are simulated, not hitscanned. That single decision is what makes
 * range a skill rather than a number: a round takes time to arrive, drops on
 * the way, and loses the energy it needs to defeat armour or a wall. A player
 * who learns to lead a moving target and hold over at distance is doing
 * something real.
 *
 * Each projectile advances in sub-steps and raycasts along each sub-step, so a
 * 900 m/s round cannot tunnel through a 20 cm wall between frames — a failure
 * mode that would quietly make cover meaningless.
 *
 * ## The drag model
 * Deceleration is `v² / (BC · C)`. That is the standard quadratic-drag form
 * with the ballistic coefficient absorbing mass, diameter and drag shape. With
 * C ≈ 7500 it reproduces real retained-velocity curves closely: a 7.62×51 match
 * load leaves at 838 m/s and arrives at 300 m doing a little under 700, which
 * is what the actual round does.
 *
 * ## Penetration
 * A round must do work to cross a material: `density × thickness × area`,
 * scaled by how absorbent the material is. If the round's kinetic energy
 * exceeds that work it continues at reduced velocity, and whatever is behind
 * the wall is still in danger. This is why `SurfaceProperties` carries real
 * densities — drywall and concrete behave differently because they *are*
 * different, not because of a lookup table of outcomes.
 */

import * as THREE from 'three';
import type { System, EngineContext } from '../core/engine';
import { bus, type HitRegion } from '../core/events';
import { services, type AmmoSpec, type RayHit } from '../core/contracts';
import { Rng, clamp01 } from '../core/math';
import { CALIBER_MAP, boreArea } from './calibers';
import { isSubsonic } from './ammo';

/** Tunes the drag model to real retained-velocity curves. */
const DRAG_C = 7500;
/** Joules of work per (kg/m³ · m · m²) of material crossed. */
const PEN_WORK = 0.55;
/** A round slower than this has stopped being dangerous. */
const MIN_VELOCITY = 45;
/** Metres of travel per collision sub-step. Below a wall's thickness. */
const SUBSTEP_M = 0.9;
/** How close a round must pass an actor to suppress them. */
const SUPPRESS_RADIUS = 1.6;

export interface Projectile {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  /** Metres travelled — used for drop-off displays and stat tracking. */
  distance: number;
  massKg: number;
  bc: number;
  ammo: AmmoSpec;
  shooterId: number;
  /** Rounds lose penetration as they slow and deform. */
  penetration: number;
  /** Seconds alive; projectiles are reclaimed after a timeout. */
  age: number;
  /** Surfaces already crossed, so a wall is not penetrated twice. */
  hitsRemaining: number;
  tracer: boolean;
}

const MAX_PROJECTILES = 256;
const GRAVITY = -9.81;

// Module-scope scratch. Ballistics runs every fixed step for every round in
// flight; allocating here would churn the GC during sustained fire.
const _step = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _next = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _toActor = new THREE.Vector3();
const _closest = new THREE.Vector3();

export class Ballistics implements System {
  readonly id = 'ballistics';
  readonly order = 16;
  readonly budgetMs = 2;

  private pool: Projectile[] = [];
  private rng = new Rng('ballistics');

  /** Live rounds, for the VFX team's tracer rendering. */
  get active(): readonly Projectile[] {
    return this.pool.filter((p) => p.active);
  }

  stats = { fired: 0, impacts: 0, penetrations: 0, ricochets: 0, actorHits: 0 };

  constructor() {
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      this.pool.push({
        active: false,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        distance: 0, massKg: 0, bc: 0.2,
        ammo: null as unknown as AmmoSpec,
        shooterId: -1, penetration: 1, age: 0, hitsRemaining: 4, tracer: false,
      });
    }
  }

  /**
   * Launch a round. `direction` should already carry dispersion — the weapon
   * decides where the barrel is pointing, ballistics decides what happens next.
   */
  fire(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    ammo: AmmoSpec,
    muzzleVelocity: number,
    shooterId: number,
  ): Projectile | null {
    const p = this.pool.find((q) => !q.active);
    if (!p) return null; // pool exhausted; dropping a round beats stalling

    p.active = true;
    p.position.copy(origin);
    p.velocity.copy(direction).normalize().multiplyScalar(muzzleVelocity);
    p.distance = 0;
    p.age = 0;
    p.massKg = ammo.massG / 1000;
    p.bc = Math.max(0.02, ammo.bc);
    p.ammo = ammo;
    p.shooterId = shooterId;
    p.penetration = ammo.penetration;
    p.hitsRemaining = 4;
    p.tracer = ammo.tracer > 0;
    this.stats.fired++;
    return p;
  }

  fixedUpdate(step: number, _ctx: EngineContext): void {
    const world = services.tryGet('world');
    if (!world) return;

    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      p.age += step;
      if (p.age > 6) {
        p.active = false;
        continue;
      }

      const speed = p.velocity.length();
      if (speed < MIN_VELOCITY) {
        p.active = false;
        continue;
      }

      // --- drag + gravity over this step ---------------------------------
      // Quadratic drag: deceleration scales with v², which is why a round
      // sheds most of its speed early and then coasts.
      const decel = (speed * speed) / (p.bc * DRAG_C);
      const newSpeed = Math.max(MIN_VELOCITY, speed - decel * step);
      _dir.copy(p.velocity).multiplyScalar(1 / speed);
      p.velocity.copy(_dir).multiplyScalar(newSpeed);
      p.velocity.y += GRAVITY * step;

      _step.copy(p.velocity).multiplyScalar(step);
      const stepLen = _step.length();
      if (stepLen < 1e-5) continue;

      // --- march in sub-steps so thin geometry can't be tunnelled ---------
      const subs = Math.max(1, Math.ceil(stepLen / SUBSTEP_M));
      const subLen = stepLen / subs;
      _dir.copy(_step).multiplyScalar(1 / stepLen);

      for (let s = 0; s < subs && p.active; s++) {
        _next.copy(p.position).addScaledVector(_dir, subLen);
        this.suppressNear(p, subLen);

        const hit = world.raycast(p.position, _dir, {
          maxDistance: subLen,
          ignoreActors: [p.shooterId],
        });

        if (!hit) {
          p.position.copy(_next);
          p.distance += subLen;
          continue;
        }

        p.position.copy(hit.point);
        p.distance += hit.distance;
        this.resolveHit(p, hit, world);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Impact resolution
  // -----------------------------------------------------------------------

  private resolveHit(p: Projectile, hit: RayHit, world: ReturnType<typeof services.get<'world'>>): void {
    const speed = p.velocity.length();
    const energyJ = 0.5 * p.massKg * speed * speed;

    if (hit.actorId >= 0) {
      this.hitActor(p, hit, energyJ);
      return;
    }

    this.stats.impacts++;
    _normal.copy(hit.normal);
    // Cosine of the angle between the round's path and the surface normal.
    // Near 0 means a grazing hit, which is where ricochets happen.
    const cosIncidence = Math.abs(_dir.dot(_normal));
    const props = world.surfaceProps(hit.surface);

    // --- ricochet -------------------------------------------------------
    // Shallow angle, hard surface, and enough speed left to skip.
    const ricochetChance = props.ricochetBias * (1 - cosIncidence) ** 3 * clamp01(speed / 400);
    if (p.hitsRemaining > 0 && this.rng.next() < ricochetChance) {
      this.stats.ricochets++;
      p.velocity.reflect(_normal).multiplyScalar(0.55 + this.rng.range(0, 0.2));
      // A deflected round tumbles: it loses most of its ability to penetrate.
      p.penetration = Math.max(1, p.penetration - 2);
      p.hitsRemaining--;
      p.position.addScaledVector(_normal, 0.02);
      bus.post('bullet:impact', {
        position: hit.point.clone(), normal: hit.normal.clone(), surface: hit.surface,
        energyJ, penetrated: false, ricochet: true, shooterId: p.shooterId,
      });
      return;
    }

    // --- penetration ----------------------------------------------------
    const cal = CALIBER_MAP.get(p.ammo.caliber);
    const area = cal ? boreArea(cal) : 2.5e-5;
    // Work to cross the material. A steeper angle means a longer path through
    // it, which is why corner shots through a wall are harder than square ones.
    const pathLength = props.thickness / Math.max(0.15, cosIncidence);

    // Bullet construction matters as much as energy. A hardened penetrator
    // holds together and keeps its cross-section; a soft expanding bullet
    // deforms on contact and starts shovelling material. Without this term,
    // wall penetration is decided purely by energy, so an AP load and a JHP
    // load of the same weight defeat cover identically — which is exactly
    // backwards, and one of the differences Tarkov players actually feel.
    const construction =
      (0.55 + p.ammo.penetration * 0.15) *      // hardened core resists upset
      (1 - p.ammo.fragmentation * 0.45);        // frangible rounds come apart

    const workJ =
      (props.density * pathLength * area * PEN_WORK * (1 + props.absorption * 4) * 1000)
      / Math.max(0.25, construction);

    if (props.penetrable && energyJ > workJ && p.hitsRemaining > 0) {
      this.stats.penetrations++;
      const remaining = energyJ - workJ;
      const newSpeed = Math.sqrt((2 * remaining) / p.massKg);
      p.velocity.copy(_dir).multiplyScalar(newSpeed);
      // Spalling and deformation: the round exits deflected and blunted.
      const spread = (1 - clamp01(newSpeed / speed)) * 0.09;
      p.velocity.x += this.rng.gaussian(0, spread) * newSpeed;
      p.velocity.y += this.rng.gaussian(0, spread) * newSpeed;
      p.velocity.z += this.rng.gaussian(0, spread) * newSpeed;
      p.penetration = Math.max(1, p.penetration - 1);
      p.hitsRemaining--;
      // Step past the surface so the next raycast doesn't hit it again.
      p.position.addScaledVector(_dir, pathLength + 0.02);

      bus.post('bullet:impact', {
        position: hit.point.clone(), normal: hit.normal.clone(), surface: hit.surface,
        energyJ, penetrated: true, ricochet: false, shooterId: p.shooterId,
      });
      return;
    }

    // --- stopped --------------------------------------------------------
    p.active = false;
    bus.post('bullet:impact', {
      position: hit.point.clone(), normal: hit.normal.clone(), surface: hit.surface,
      energyJ, penetrated: false, ricochet: false, shooterId: p.shooterId,
    });
  }

  private hitActor(p: Projectile, hit: RayHit, energyJ: number): void {
    const actors = services.tryGet('actors');
    if (!actors) {
      p.active = false;
      return;
    }
    this.stats.actorHits++;

    const region: HitRegion = hit.region ?? 'thorax';
    const registry = actors as unknown as {
      get(id: number): unknown;
      regionForHit?(a: unknown, point: THREE.Vector3, dir: THREE.Vector3): HitRegion;
      armourFor?(a: unknown, r: HitRegion): { armourClass: number; durability: number; bluntTransfer: number } | null;
    };
    const actor = registry.get(hit.actorId);
    const resolvedRegion = actor && registry.regionForHit
      ? registry.regionForHit(actor, hit.point, _dir)
      : region;

    // --- armour ---------------------------------------------------------
    const plate = actor && registry.armourFor ? registry.armourFor(actor, resolvedRegion) : null;
    let penetratedArmor = true;
    let damage = p.ammo.damage;

    if (plate && plate.durability > 0) {
      // Class-vs-class with a soft edge: a round one class under still gets
      // through some of the time, and one class over is not a guarantee.
      const margin = p.penetration - plate.armourClass;
      const chance = clamp01(0.5 + margin * 0.32);
      penetratedArmor = this.rng.next() < chance;

      if (!penetratedArmor) {
        // Stopped, but the energy still arrives as blunt trauma.
        damage = p.ammo.damage * plate.bluntTransfer * 0.4;
        plate.durability = Math.max(0, plate.durability - energyJ / 260);
      } else {
        // Getting through costs the round some of its effect.
        damage *= 0.78;
        plate.durability = Math.max(0, plate.durability - energyJ / 520);
      }
    }

    // Fragmenting rounds do more to tissue but only once they are inside.
    if (penetratedArmor && p.ammo.fragmentation > 0.5) {
      damage *= 1 + (p.ammo.fragmentation - 0.5) * 0.7;
    }

    // Energy falls off with range; a round arriving slow does less.
    const speedFactor = clamp01(p.velocity.length() / Math.max(1, p.ammo.muzzleVelocity));
    damage *= 0.45 + 0.55 * speedFactor;

    bus.post('bullet:hitActor', {
      actorId: hit.actorId,
      region: resolvedRegion,
      energyJ,
      penetratedArmor,
      shooterId: p.shooterId,
      position: hit.point.clone(),
      direction: _dir.clone(),
    });

    (actors as unknown as {
      applyDamage(id: number, amount: number, type: string, region: HitRegion, src: number, dir?: THREE.Vector3): void;
    }).applyDamage(hit.actorId, damage, 'ballistic', resolvedRegion, p.shooterId, _dir.clone());

    // Rifle rounds carry on through a body; pistol rounds usually do not.
    if (energyJ > 1400 && p.hitsRemaining > 0) {
      p.hitsRemaining--;
      p.velocity.multiplyScalar(0.45);
      p.penetration = Math.max(1, p.penetration - 2);
      p.position.addScaledVector(_dir, 0.35);
    } else {
      p.active = false;
    }
  }

  /**
   * Rounds passing close to an actor suppress them, and a supersonic round
   * makes a crack the audio team turns into a near-miss.
   */
  private suppressNear(p: Projectile, subLen: number): void {
    const actors = services.tryGet('actors');
    if (!actors) return;
    const supersonic = !isSubsonic(p.ammo) && p.velocity.length() > 343;

    for (const a of actors.all) {
      if (!a.alive || a.id === p.shooterId) continue;
      _toActor.copy(a.eye).sub(p.position);
      const along = _toActor.dot(_dir);
      if (along < 0 || along > subLen) continue;
      _closest.copy(p.position).addScaledVector(_dir, along);
      const miss = _closest.distanceTo(a.eye);
      if (miss > SUPPRESS_RADIUS) continue;

      const intensity = 1 - miss / SUPPRESS_RADIUS;
      (actors as unknown as { addSuppression?(a: unknown, amount: number): void })
        .addSuppression?.(a, intensity * 0.55);

      if (supersonic && a.id === actors.playerId) {
        bus.post('bullet:crack', { position: _closest.clone(), distanceFromEar: miss });
      }
    }
  }

  /** Drop everything in flight — used on mission end and respawn. */
  clear(): void {
    for (const p of this.pool) p.active = false;
  }
}
