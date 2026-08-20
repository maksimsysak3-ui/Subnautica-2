/**
 * Recoil, sway and weapon handling.
 *
 * OWNED BY: Weapon systems.
 *
 * ## Why the pattern is deterministic
 * The single most important decision in this file: **recoil follows a fixed
 * per-weapon pattern with only a small random component.** Tarkov, CS and
 * Modern Warfare all do this, and it is why their gunplay rewards practice —
 * a player who has fired a weapon a hundred times knows the gun will climb and
 * then walk left, and can pull against it. Pure randomness cannot be learned,
 * so it converts skill into luck and makes every automatic weapon feel the
 * same: bad.
 *
 * The pattern is generated from the weapon id, so every weapon has its own
 * signature climb that is stable across sessions and consistent for every
 * player.
 *
 * ## Two separate things move
 * Real recoil moves the *weapon* and the *shooter* differently, and games that
 * conflate them feel wrong:
 *
 *  - **Visual kick** — the weapon jumps in the hands and settles back. Large,
 *    fast, fully recovered. This is what you see.
 *  - **Aim displacement** — the muzzle ends up somewhere new. Smaller, and only
 *    partially recovered, so sustained fire genuinely walks off target.
 *
 * Recovering aim displacement *completely* would mean a held trigger never
 * leaves the target, which removes the reason to fire in bursts.
 */

import * as THREE from 'three';
import { Rng, clamp01, damp, lerp } from '../core/math';
import type { ResolvedWeaponStats } from '../core/contracts';

/** One shot's worth of pattern, in degrees. */
export interface RecoilStep {
  vertical: number;
  horizontal: number;
}

/**
 * Builds a weapon's signature recoil pattern.
 *
 * The shape follows what real automatic fire does: a hard vertical climb for
 * the first few rounds while the shooter is still absorbing the impulse, then
 * a flattening as the climb hits the shooter's resistance, with a lateral walk
 * that settles into a consistent direction. The direction of that walk is the
 * weapon's fingerprint.
 */
export function buildPattern(weaponId: string, length = 40): RecoilStep[] {
  const rng = new Rng(`recoil:${weaponId}`);
  const steps: RecoilStep[] = [];

  // Each weapon drifts one way. Which way is arbitrary but fixed.
  const drift = rng.bool() ? 1 : -1;
  const driftOnset = rng.int(3, 7);
  const driftStrength = rng.range(0.35, 0.85);
  const wobblePeriod = rng.range(5, 11);
  const wobbleAmount = rng.range(0.15, 0.4);

  for (let i = 0; i < length; i++) {
    // Vertical: steep at first, asymptotic after. 1 - e^-x shaped, inverted so
    // the *increment* shrinks — the muzzle keeps rising but ever more slowly.
    const climbFalloff = Math.exp(-i / 6);
    const vertical = 0.55 + 0.45 * climbFalloff;

    // Horizontal: nothing for the first few rounds, then a consistent walk
    // with a slow wobble on top so the pattern is learnable but not a ruler.
    const engaged = clamp01((i - driftOnset) / 4);
    const horizontal =
      engaged * drift * driftStrength +
      Math.sin((i / wobblePeriod) * Math.PI * 2) * wobbleAmount;

    steps.push({ vertical, horizontal });
  }
  return steps;
}

export interface RecoilInputs {
  /** 0..1 — aiming down sights steadies the weapon considerably. */
  aiming: number;
  /** 0..1 stance steadiness: prone 1, crouch 0.6, standing 0.25. */
  braced: number;
  /** 0..1 remaining stamina. Breathing hard makes the weapon wander. */
  stamina: number;
  /** True while the player is holding their breath. */
  holdingBreath: boolean;
  /** Player movement speed in m/s. */
  speed: number;
}

/**
 * Per-weapon recoil state. One of these lives on the equipped weapon; AI
 * shooters get their own so their fire walks off target the same way.
 */
export class RecoilState {
  /** Index into the pattern — reset when the trigger is released long enough. */
  shotIndex = 0;
  /** Aim displacement actually accumulated, degrees. */
  aimPitch = 0;
  aimYaw = 0;
  /** Visual kick applied to the viewmodel/camera, degrees. */
  visualPitch = 0;
  visualYaw = 0;
  visualRoll = 0;
  /** Backward push of the weapon, metres. */
  visualPunch = 0;

  private pattern: RecoilStep[];
  private sinceLastShot = 0;
  private rng: Rng;
  /** Free-running clock for sway; independent of frame rate. */
  private swayTime = 0;

  constructor(weaponId: string, seed = weaponId) {
    this.pattern = buildPattern(weaponId);
    this.rng = new Rng(`recoilstate:${seed}`);
  }

  /** Swap the pattern when the weapon changes. */
  setWeapon(weaponId: string): void {
    this.pattern = buildPattern(weaponId);
    this.reset();
  }

  reset(): void {
    this.shotIndex = 0;
    this.aimPitch = 0;
    this.aimYaw = 0;
  }

  /**
   * Apply one shot.
   *
   * @param stats resolved weapon stats after attachments
   * @param inputs stance, aim and stamina context
   */
  onShot(stats: ResolvedWeaponStats, inputs: RecoilInputs): void {
    const step = this.pattern[Math.min(this.shotIndex, this.pattern.length - 1)];
    this.shotIndex++;
    this.sinceLastShot = 0;

    // Stance and grip scale the whole impulse. A braced prone shooter with a
    // heavy weapon eats far more of it than someone standing.
    const control =
      lerp(1.0, 0.62, inputs.aiming) *
      lerp(1.0, 0.55, inputs.braced) *
      lerp(1.15, 1.0, clamp01(inputs.stamina));

    // Ergonomics is the handling budget: a heavy, awkward weapon recovers
    // slower and kicks harder for the same cartridge.
    const ergFactor = lerp(1.25, 0.82, clamp01(stats.ergonomics / 100));

    const v = step.vertical * stats.verticalRecoil * control * ergFactor;
    const h = step.horizontal * stats.horizontalRecoil * control * ergFactor;

    // Small random component so two magazines are not pixel-identical, but
    // small enough that the pattern still dominates and stays learnable.
    const jitterV = this.rng.gaussian(0, v * 0.11);
    const jitterH = this.rng.gaussian(0, Math.abs(h) * 0.16 + v * 0.05);

    // Aim displacement: what actually moves the point of impact.
    this.aimPitch += v + jitterV;
    this.aimYaw += h + jitterH;

    // Visual kick: larger and fully recovered, so it reads without lying about
    // where the rounds are going.
    this.visualPitch += (v + jitterV) * 1.9;
    this.visualYaw += (h + jitterH) * 1.5;
    this.visualRoll += (h + jitterH) * 0.8 + this.rng.range(-0.15, 0.15) * v;
    this.visualPunch += 0.006 * stats.verticalRecoil * control;
  }

  /**
   * Advance recovery and sway.
   * Returns the total angular offset to apply to aim this frame, in radians.
   */
  update(dt: number, stats: ResolvedWeaponStats, inputs: RecoilInputs, out: { pitch: number; yaw: number; roll: number; punch: number }): void {
    this.sinceLastShot += dt;
    this.swayTime += dt;

    // The pattern resets once the shooter has had time to re-settle. Too short
    // and burst fire is free; too long and a second engagement starts halfway
    // up the climb.
    if (this.sinceLastShot > 0.45) {
      const settle = clamp01((this.sinceLastShot - 0.45) / 0.5);
      this.shotIndex = Math.round(lerp(this.shotIndex, 0, settle));
    }

    const recovery = stats.recoilRecovery * lerp(0.7, 1.3, clamp01(stats.ergonomics / 100));

    // Visual kick returns fully — this is the weapon settling in the hands.
    this.visualPitch = damp(this.visualPitch, 0, recovery * 9, dt);
    this.visualYaw = damp(this.visualYaw, 0, recovery * 8, dt);
    this.visualRoll = damp(this.visualRoll, 0, recovery * 7, dt);
    this.visualPunch = damp(this.visualPunch, 0, recovery * 11, dt);

    // Aim displacement recovers only PARTWAY. Recovering it fully would mean a
    // held trigger never leaves the target and bursts would have no advantage.
    const aimRecovery = recovery * 2.6;
    this.aimPitch = damp(this.aimPitch, this.aimPitch * 0.35, aimRecovery, dt);
    this.aimYaw = damp(this.aimYaw, this.aimYaw * 0.5, aimRecovery, dt);

    // --- sway -----------------------------------------------------------
    // Breathing and muscle tremor. Amplitude rises as stamina falls and drops
    // sharply when aiming or braced.
    const exhaustion = 1 - clamp01(inputs.stamina);
    const moving = clamp01(inputs.speed / 4);
    let swayAmp = stats.swayAmplitude
      * lerp(1.0, 0.35, inputs.aiming)
      * lerp(1.0, 0.45, inputs.braced)
      * (1 + exhaustion * 1.8)
      * (1 + moving * 1.4);

    // Breath hold flattens sway almost completely — the reason to use it.
    if (inputs.holdingBreath) swayAmp *= 0.12;

    const f = stats.swayFrequency * (1 + exhaustion * 0.6);
    // Two incommensurate frequencies per axis so the path is a slow Lissajous
    // rather than a visible circle.
    const swayPitch = (Math.sin(this.swayTime * f) * 0.6 + Math.sin(this.swayTime * f * 2.31 + 1.1) * 0.4) * swayAmp;
    const swayYaw = (Math.cos(this.swayTime * f * 0.83) * 0.6 + Math.cos(this.swayTime * f * 1.77 + 2.4) * 0.4) * swayAmp;

    out.pitch = (this.aimPitch + this.visualPitch + swayPitch) * DEG;
    out.yaw = (this.aimYaw + this.visualYaw + swayYaw) * DEG;
    out.roll = this.visualRoll * DEG;
    out.punch = this.visualPunch;
  }

  /** Where the shots are actually going right now, in radians. */
  get aimOffset(): { pitch: number; yaw: number } {
    return { pitch: this.aimPitch * DEG, yaw: this.aimYaw * DEG };
  }
}

const DEG = Math.PI / 180;

/**
 * Cone of fire in radians, combining mechanical accuracy with everything the
 * shooter is doing wrong.
 *
 * Deliberately small compared to most shooters: at rest a decent carbine should
 * put rounds where the sights are, and misses should come from recoil, sway and
 * the shooter — not from a random cone that fires the round somewhere the
 * player never aimed. Invisible dispersion is the fastest way to make gunplay
 * feel unfair.
 */
export function currentSpread(
  stats: ResolvedWeaponStats,
  inputs: RecoilInputs,
  heat: number,
  woundPenalty: number,
): number {
  const MOA = (1 / 60) * DEG;
  let moa = stats.spreadMoa;

  moa *= lerp(2.6, 1.0, inputs.aiming);
  moa *= lerp(1.5, 0.85, inputs.braced);
  moa *= 1 + clamp01(inputs.speed / 5) * 2.2;
  moa *= 1 + (1 - clamp01(inputs.stamina)) * 0.9;
  // A hot barrel walks: mirage and thermal drift are real and they punish
  // dumping magazines through a light barrel.
  moa *= 1 + clamp01(heat) * 1.4;
  moa *= 1 + woundPenalty * 2.5;

  return moa * MOA;
}

/** Applies dispersion to a firing direction. */
export function applyDispersion(
  direction: THREE.Vector3,
  spreadRad: number,
  rng: Rng,
  out: THREE.Vector3,
): THREE.Vector3 {
  out.copy(direction).normalize();
  if (spreadRad <= 0) return out;

  // Uniform on a disc, then tilted onto the aim axis — a Gaussian here would
  // concentrate too hard at the centre and make the cone feel tighter than it
  // measures.
  const [dx, dy] = rng.onDisc();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  right.crossVectors(out, up);
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  right.normalize();
  up.crossVectors(right, out).normalize();

  out.addScaledVector(right, Math.tan(spreadRad) * dx);
  out.addScaledVector(up, Math.tan(spreadRad) * dy);
  return out.normalize();
}
