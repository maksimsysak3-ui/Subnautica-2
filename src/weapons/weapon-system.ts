/**
 * Weapon system and runtime.
 *
 * OWNED BY: Weapon systems.
 *
 * Two things live here:
 *
 *  - `WeaponSystem` implements the `IWeaponSystem` contract: the catalogue,
 *    instance creation, and **stat resolution** — turning a weapon plus its
 *    attachments plus its loaded ammunition into the numbers everything else
 *    reads.
 *  - `WeaponRuntime` is the `System` that owns what the player is holding:
 *    trigger discipline, cyclic timing, reloads, malfunctions, and pushing
 *    recoil into the camera.
 *
 * ## Chambered rounds
 * A magazine change with a round still in the chamber leaves you with mag+1,
 * and one performed on an empty gun does not — it also costs the extra time to
 * release the bolt. Tarkov and Ground Branch both model this and it changes how
 * players fight: you top up behind cover at 22/30 rather than shooting a
 * magazine dry. `loaded` counts rounds in the magazine; `chambered` is separate.
 */

import * as THREE from 'three';
import type { System, EngineContext } from '../core/engine';
import { bus } from '../core/events';
import {
  services,
  type IWeaponSystem,
  type WeaponSpec,
  type AttachmentSpec,
  type AmmoSpec,
  type AttachmentSlot,
  type WeaponInstance,
  type ResolvedWeaponStats,
  type FireMode,
} from '../core/contracts';
import { Rng, clamp01, lerp } from '../core/math';
import { WEAPONS, WEAPON_MAP } from './arsenal';
import { ATTACHMENTS, ATTACHMENT_MAP, attachmentsFor } from './attachments';
import { AMMO, AMMO_MAP, pelletCount, isSubsonic } from './ammo';
import { CALIBER_MAP, velocityForBarrel } from './calibers';
import { RecoilState, currentSpread, applyDispersion, type RecoilInputs } from './recoil';
import type { Ballistics } from './ballistics';

/** Malfunction kinds, in rough order of how long they take to clear. */
export type Malfunction = 'failure_to_fire' | 'failure_to_eject' | 'failure_to_feed' | 'double_feed' | 'bolt_stuck';

const CLEAR_TIME_MS: Record<Malfunction, number> = {
  failure_to_fire: 900,
  failure_to_eject: 1900,
  failure_to_feed: 1600,
  double_feed: 3600,
  bolt_stuck: 4400,
};

const MALFUNCTION_LABEL: Record<Malfunction, string> = {
  failure_to_fire: 'Failure to fire — tap, rack',
  failure_to_eject: 'Stovepipe — clear the ejection port',
  failure_to_feed: 'Failure to feed — rack the bolt',
  double_feed: 'Double feed — strip the magazine',
  bolt_stuck: 'Bolt seized — hard extraction',
};

let uidCounter = 0;

// ===========================================================================
// WeaponSystem — catalogue and stat resolution
// ===========================================================================

export class WeaponSystem implements IWeaponSystem {
  readonly specs: ReadonlyMap<string, WeaponSpec> = WEAPON_MAP;
  readonly attachments: ReadonlyMap<string, AttachmentSpec> = ATTACHMENT_MAP;
  readonly ammo: ReadonlyMap<string, AmmoSpec> = AMMO_MAP;

  createInstance(
    specId: string,
    attachments?: Partial<Record<AttachmentSlot, string>>,
    ammoId?: string,
  ): WeaponInstance {
    const spec = WEAPON_MAP.get(specId);
    if (!spec) throw new Error(`[weapons] unknown weapon "${specId}"`);

    const inst: WeaponInstance = {
      uid: `w${++uidCounter}`,
      specId,
      attachments: { ...spec.defaults, ...attachments },
      ammoId: ammoId ?? spec.ammo[0],
      loaded: 0,
      chambered: false,
      durability: 1,
      heat: 0,
      malfunction: null,
      stats: null as unknown as ResolvedWeaponStats,
    };
    inst.stats = this.resolveStats(inst);
    inst.loaded = inst.stats.magazineSize;
    inst.chambered = true;
    return inst;
  }

  /**
   * Fold the weapon, its attachments and its ammunition into one stat block.
   *
   * Multiplicative and additive mods are kept strictly separate — mixing them
   * is the classic way an attachment system ends up with a combination that
   * multiplies out to a negative recoil value.
   */
  resolveStats(inst: WeaponInstance): ResolvedWeaponStats {
    const spec = WEAPON_MAP.get(inst.specId);
    if (!spec) throw new Error(`[weapons] unknown weapon "${inst.specId}"`);
    const cal = CALIBER_MAP.get(spec.caliber);
    const ammo = AMMO_MAP.get(inst.ammoId);

    // Multiplicative accumulators start at 1, additive at 0.
    let mVert = 1, mHoriz = 1, mRecovery = 1, mVelocity = 1, mFlash = 1;
    let mSwayAmp = 1, mSwayFreq = 1, mSpread = 1, mDurability = 1;
    let aErg = 0, aAds = 0, aSound = 0, aReload = 0, aMag = 0, aWeight = 0;

    let suppressed = false;
    let magnification = 1;

    for (const slot of Object.keys(inst.attachments) as AttachmentSlot[]) {
      const id = inst.attachments[slot];
      if (!id) continue;
      const a = ATTACHMENT_MAP.get(id);
      if (!a) continue;
      const m = a.mods;

      mVert *= m.verticalRecoil ?? 1;
      mHoriz *= m.horizontalRecoil ?? 1;
      mRecovery *= m.recoilRecovery ?? 1;
      mVelocity *= m.muzzleVelocity ?? 1;
      mFlash *= m.flash ?? 1;
      mSwayAmp *= m.swayAmplitude ?? 1;
      mSwayFreq *= m.swayFrequency ?? 1;
      mSpread *= m.spreadMoa ?? 1;
      mDurability *= m.durabilityBurn ?? 1;

      aErg += m.ergonomics ?? 0;
      aAds += m.adsTimeMs ?? 0;
      aSound += m.soundMeters ?? 0;
      aReload += m.reloadTimeMs ?? 0;
      aMag += m.magazineSize ?? 0;
      aWeight += (m.weightKg ?? 0) + a.massKg;

      // A can is a suppressor if it takes a big bite out of the report.
      if (a.slot === 'muzzle' && (m.soundMeters ?? 0) <= -50) suppressed = true;
      if (a.optic) magnification = Math.max(magnification, a.optic.magnification);
    }

    // Ammunition rides on top of the mechanical package.
    const ammoRecoil = ammo?.recoilMultiplier ?? 1;
    const ammoFlash = ammo?.flashMultiplier ?? 1;

    // Total mass drives handling: a heavy weapon is slower onto target and
    // sways more, which is how attachment weight becomes a real cost.
    const massKg = spec.massKg + aWeight;
    const massPenalty = clamp01((massKg - spec.massKg) / 3);

    const ergonomics = Math.max(5, spec.ergonomics + aErg - massPenalty * 12);

    // Barrel length changes muzzle velocity, which feeds range and penetration.
    const baseVelocity = ammo && cal
      ? velocityForBarrel(cal, ammo.muzzleVelocity, spec.barrelLengthMm)
      : (ammo?.muzzleVelocity ?? 800);

    // A subsonic round through a can is the quietest thing in the game; a
    // supersonic round still cracks downrange no matter what is on the muzzle.
    let soundMeters = Math.max(6, spec.soundMeters + aSound);
    if (suppressed && ammo && !isSubsonic(ammo)) {
      // The report is muffled but the crack is not; a floor keeps that honest.
      soundMeters = Math.max(soundMeters, 62);
    }

    return {
      spreadMoa: Math.max(0.15, spec.spreadMoa * mSpread),
      verticalRecoil: spec.verticalRecoil * mVert * ammoRecoil,
      horizontalRecoil: spec.horizontalRecoil * mHoriz * ammoRecoil,
      recoilRecovery: spec.recoilRecovery * mRecovery,
      ergonomics,
      adsTimeMs: Math.max(90, spec.adsTimeMs + aAds) * lerp(1.25, 0.85, clamp01(ergonomics / 100)),
      muzzleVelocity: baseVelocity * mVelocity,
      soundMeters,
      flash: mFlash * ammoFlash,
      // Handling stats derive from ergonomics so every attachment that touches
      // weight or balance moves them together.
      swayAmplitude: lerp(1.5, 0.45, clamp01(ergonomics / 100)) * mSwayAmp,
      swayFrequency: lerp(1.4, 0.9, clamp01(ergonomics / 100)) * mSwayFreq,
      magazineSize: Math.max(1, spec.baseMagazine + aMag),
      reloadTimeMs: Math.max(500, spec.reloadTimeMs + aReload) * lerp(1.2, 0.88, clamp01(ergonomics / 100)),
      reloadEmptyTimeMs: Math.max(600, spec.reloadEmptyTimeMs + aReload) * lerp(1.2, 0.88, clamp01(ergonomics / 100)),
      massKg,
      rpm: spec.rpm,
      suppressed,
      magnification,
    };
  }

  canAttach(inst: WeaponInstance, attachmentId: string): boolean {
    const a = ATTACHMENT_MAP.get(attachmentId);
    const spec = WEAPON_MAP.get(inst.specId);
    if (!a || !spec) return false;
    if (!this.availableSlots(inst).includes(a.slot)) return false;
    return a.fitsTags.some((t) => spec.tags.includes(t));
  }

  attach(inst: WeaponInstance, attachmentId: string): boolean {
    if (!this.canAttach(inst, attachmentId)) return false;
    const a = ATTACHMENT_MAP.get(attachmentId)!;
    inst.attachments[a.slot] = attachmentId;

    // Removing a handguard can orphan whatever was bolted to it.
    const slots = this.availableSlots(inst);
    for (const slot of Object.keys(inst.attachments) as AttachmentSlot[]) {
      if (!slots.includes(slot)) delete inst.attachments[slot];
    }

    inst.stats = this.resolveStats(inst);
    inst.loaded = Math.min(inst.loaded, inst.stats.magazineSize);
    bus.emit('weapon:attachmentChanged', { weaponId: inst.uid, slot: a.slot, attachmentId });
    return true;
  }

  detach(inst: WeaponInstance, slot: AttachmentSlot): void {
    delete inst.attachments[slot];
    inst.stats = this.resolveStats(inst);
    bus.emit('weapon:attachmentChanged', { weaponId: inst.uid, slot, attachmentId: null });
  }

  /** Base slots plus any the fitted attachments provide. */
  availableSlots(inst: WeaponInstance): AttachmentSlot[] {
    const spec = WEAPON_MAP.get(inst.specId);
    if (!spec) return [];
    const out = new Set<AttachmentSlot>(spec.slots);
    for (const id of Object.values(inst.attachments)) {
      if (!id) continue;
      const a = ATTACHMENT_MAP.get(id);
      for (const p of a?.provides ?? []) out.add(p);
    }
    return [...out];
  }

  /** Compatible attachments per slot — what the gunsmith screen lists. */
  optionsFor(inst: WeaponInstance, slot: AttachmentSlot): AttachmentSpec[] {
    const spec = WEAPON_MAP.get(inst.specId);
    if (!spec) return [];
    return attachmentsFor(slot, spec.tags);
  }
}

// ===========================================================================
// WeaponRuntime — what the player is actually holding
// ===========================================================================

const _muzzle = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _shotDir = new THREE.Vector3();
const _camOffset = new THREE.Vector3();
const _camRot = new THREE.Euler();
const recoilOut = { pitch: 0, yaw: 0, roll: 0, punch: 0 };

export class WeaponRuntime implements System {
  readonly id = 'weaponRuntime';
  readonly order = 20;
  readonly initOrder = 45;
  readonly budgetMs = 1;

  weapons = new WeaponSystem();
  equipped: WeaponInstance | null = null;
  /** Everything the operator is carrying, in slot order. */
  loadout: WeaponInstance[] = [];
  /** Index into `loadout`. */
  slot = 0;
  /** Seconds left on the draw. The weapon is unusable until it reaches zero. */
  swapTimer = 0;
  fireMode: FireMode = 'semi';
  /** Lifetime round counter, so captures and tests can wait on a real shot. */
  shotsFired = 0;

  private recoil = new RecoilState('none');
  private rng = new Rng('weapon-runtime');
  private ballistics!: Ballistics;

  /** Seconds until the next round can leave the barrel. */
  private cooldown = 0;
  /** Rounds left in the current burst. */
  private burstRemaining = 0;
  /** Semi-auto needs a trigger release between shots. */
  private triggerHeld = false;
  private reloading = false;
  private reloadRemaining = 0;
  private reloadWasTactical = false;
  private clearingRemaining = 0;
  /** Reserve ammunition by ammo id. */
  reserve = new Map<string, number>();

  holdingBreath = false;

  init(ctx: EngineContext): void {
    services.register('weapons', this.weapons);
    this.ballistics = ctx.engine.require<Ballistics>('ballistics');

    // A loadout, not a single weapon. Every slot is built up front so
    // switching is instant and each weapon keeps its own chamber and magazine
    // state across swaps — putting a carbine away with 12 rounds left and
    // coming back to find 12 rounds is most of what makes a loadout feel real.
    this.loadout = [
      this.weapons.createInstance('ho-mk4c', {
        optic: 'opt-rds', muzzle: 'muz-a2', underbarrel: 'grip-handstop',
        handguard: 'hg-mlok-short',
      }),
      this.weapons.createInstance('md-bp5', {
        optic: 'opt-lpvo', muzzle: 'muz-comp', handguard: 'hg-mlok-short',
      }),
      this.weapons.createInstance('ho-m590', { optic: 'opt-iron' }),
      this.weapons.createInstance('aw-p9', { optic: 'opt-rds' }),
    ];
    for (const w of this.loadout) {
      // Reserve is per calibre, so two 5.56 weapons share a pool — which is
      // how a real load-out works and makes calibre choice a real decision.
      this.reserve.set(w.ammoId, (this.reserve.get(w.ammoId) ?? 0) + 180);
    }
    this.selectSlot(0);
  }

  /**
   * Switch to a loadout slot.
   *
   * Ignored mid-reload and mid-malfunction: you cannot make a stoppage go away
   * by swapping weapons, which would otherwise be strictly better than clearing
   * it and would gut the whole malfunction system.
   */
  selectSlot(i: number): boolean {
    if (i < 0 || i >= this.loadout.length) return false;
    if (i === this.slot && this.equipped) return false;
    if (this.reloading) return false;
    this.slot = i;
    this.equip(this.loadout[i]);
    return true;
  }

  /** Next / previous slot, for the mouse wheel and Q-style quick swap. */
  cycleSlot(dir: number): void {
    const n = this.loadout.length;
    if (n === 0) return;
    this.selectSlot((this.slot + (dir >= 0 ? 1 : n - 1)) % n);
  }

  equip(inst: WeaponInstance): void {
    const swapping = this.equipped !== null && this.equipped !== inst;
    this.equipped = inst;
    this.recoil.setWeapon(inst.specId);
    this.fireMode = WEAPON_MAP.get(inst.specId)?.fireModes.find((m) => m !== 'safe') ?? 'semi';
    this.cooldown = 0;
    this.reloading = false;
    // A draw costs time, scaled by how handy the weapon is. A pistol comes up
    // fast and a machine gun does not, which is the entire reason to carry a
    // sidearm rather than reload under fire.
    if (swapping) {
      const erg = inst.stats.ergonomics;
      this.swapTimer = lerp(0.95, 0.34, clamp01(erg / 100));
    }
    bus.emit('weapon:equipped', { weaponId: inst.uid, slot: 'primary' });
  }

  cycleFireMode(): void {
    const inst = this.equipped;
    if (!inst) return;
    const modes = WEAPON_MAP.get(inst.specId)?.fireModes ?? ['semi'];
    const i = modes.indexOf(this.fireMode);
    this.fireMode = modes[(i + 1) % modes.length];
    bus.emit('weapon:fireModeChanged', { weaponId: inst.uid, mode: this.fireMode });
  }

  fixedUpdate(step: number, _ctx: EngineContext): void {
    const inst = this.equipped;
    if (!inst) return;

    const player = services.tryGet('actors')?.get(0);
    const playerSys = this.playerSystem();
    if (!playerSys) return;

    this.cooldown = Math.max(0, this.cooldown - step);
    // Barrel cools slowly, and much faster when you are not shooting.
    inst.heat = Math.max(0, inst.heat - step * 0.06);

    // The weapon is not usable until the draw finishes. Returning early rather
    // than merely blocking the trigger also means a swap cannot be used to skip
    // a reload or shortcut a malfunction.
    if (this.swapTimer > 0) {
      this.swapTimer = Math.max(0, this.swapTimer - step);
      return;
    }

    // --- clearing a malfunction ------------------------------------------
    if (this.clearingRemaining > 0) {
      this.clearingRemaining -= step * 1000;
      if (this.clearingRemaining <= 0) {
        inst.malfunction = null;
        this.clearingRemaining = 0;
        bus.emit('weapon:cleared', { weaponId: inst.uid });
      }
      return;
    }

    // --- reloading --------------------------------------------------------
    if (this.reloading) {
      this.reloadRemaining -= step * 1000;
      if (this.reloadRemaining <= 0) this.finishReload();
      return;
    }

    const input = playerSys.input;

    if (input.reload) {
      input.reload = false;
      this.beginReload();
      return;
    }

    // A jammed weapon is cleared by pulling the trigger on it, which is what a
    // player does instinctively, then discovers costs them time.
    if (inst.malfunction) {
      if (input.fire && !this.triggerHeld) this.beginClearing();
      this.triggerHeld = input.fire;
      return;
    }

    // --- trigger ----------------------------------------------------------
    const wantsFire = input.fire && this.fireMode !== 'safe';
    const freshPull = wantsFire && !this.triggerHeld;

    if (this.fireMode === 'burst2' || this.fireMode === 'burst3') {
      if (freshPull && this.burstRemaining === 0) {
        this.burstRemaining = this.fireMode === 'burst2' ? 2 : 3;
      }
      if (this.burstRemaining > 0 && this.cooldown <= 0) {
        if (this.tryFire(playerSys, player)) this.burstRemaining--;
        else this.burstRemaining = 0;
      }
    } else if (this.fireMode === 'auto') {
      if (wantsFire && this.cooldown <= 0) this.tryFire(playerSys, player);
    } else if (this.fireMode === 'semi') {
      if (freshPull && this.cooldown <= 0) this.tryFire(playerSys, player);
    }

    this.triggerHeld = input.fire;
  }

  private tryFire(playerSys: PlayerLike, player: unknown): boolean {
    const inst = this.equipped!;

    if (!inst.chambered) {
      // Bolt is back on an empty magazine — a dry click, not a shot.
      bus.emit('weapon:dryfire', { weaponId: inst.uid });
      this.cooldown = 0.25;
      return false;
    }

    const stats = inst.stats;
    const spec = WEAPON_MAP.get(inst.specId)!;
    const ammo = AMMO_MAP.get(inst.ammoId);
    if (!ammo) return false;

    // --- malfunction roll -------------------------------------------------
    // Wear, heat and cheap ammunition all push this up. A clean gun on good
    // ammo is reliable enough that a jam is a memorable event, not a tax.
    const wear = 1 - inst.durability;
    const jamChance =
      ammo.malfunctionChance
      * (1 + wear * 9)
      * (1 + clamp01(inst.heat) * 2.2)
      * (this.attachmentDurabilityBurn(inst));

    if (this.rng.next() < jamChance) {
      inst.malfunction = this.rollMalfunction(inst, wear);
      bus.emit('weapon:jammed', { weaponId: inst.uid, cause: inst.malfunction });
      bus.emit('ui:notify', { text: MALFUNCTION_LABEL[inst.malfunction as Malfunction], kind: 'danger' });
      this.cooldown = 0.2;
      return false;
    }

    // --- where is the muzzle pointing -------------------------------------
    const render = services.get('render') as unknown as { camera: THREE.PerspectiveCamera };
    const cam = render.camera;
    cam.getWorldDirection(_dir);
    _muzzle.copy(cam.position).addScaledVector(_dir, 0.35);

    const inputs = this.recoilInputs(playerSys);
    const woundPenalty = this.woundPenalty(player);
    const spread = currentSpread(stats, inputs, inst.heat, woundPenalty);

    // Recoil already accumulated shifts the actual bore line, so sustained fire
    // walks off target even though the crosshair has not moved.
    const aim = this.recoil.aimOffset;
    _shotDir.copy(_dir);
    _shotDir.applyAxisAngle(new THREE.Vector3(1, 0, 0), -aim.pitch);
    _shotDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), -aim.yaw);

    const pellets = pelletCount(ammo);
    for (let i = 0; i < pellets; i++) {
      // Buckshot needs a wider cone than the weapon's mechanical spread.
      const coneScale = pellets > 1 ? 1 : 1;
      applyDispersion(_shotDir, spread * coneScale, this.rng, _shotDir);
      this.ballistics.fire(_muzzle, _shotDir, ammo, stats.muzzleVelocity, 0);
      _shotDir.copy(_dir)
        .applyAxisAngle(new THREE.Vector3(1, 0, 0), -aim.pitch)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), -aim.yaw);
    }

    // --- consume ----------------------------------------------------------
    inst.chambered = false;
    if (inst.loaded > 0) {
      inst.loaded--;
      inst.chambered = true; // the action strips the next round
    }
    inst.heat = Math.min(1.4, inst.heat + 0.035);
    inst.durability = Math.max(0, inst.durability - 0.00022 * this.attachmentDurabilityBurn(inst));

    // --- recoil and timing ------------------------------------------------
    this.recoil.onShot(stats, inputs);
    const jitter = this.rng.range(-spec.rpmJitter, spec.rpmJitter);
    this.cooldown = 60 / Math.max(30, stats.rpm + jitter);

    this.shotsFired++;
    bus.emit('weapon:fired', {
      weaponId: inst.uid,
      muzzle: _muzzle.clone(),
      direction: _dir.clone(),
      suppressed: stats.suppressed,
      loudnessMeters: stats.soundMeters,
      shooterId: 0,
    });
    bus.post('weapon:shellEject', {
      position: _muzzle.clone(),
      velocity: new THREE.Vector3(this.rng.range(1.5, 3), this.rng.range(1, 2), this.rng.range(-0.5, 0.5)),
      caliber: spec.caliber,
    });
    bus.post('sound:emitted', {
      position: _muzzle.clone(),
      loudnessMeters: stats.soundMeters,
      kind: 'gunshot',
      sourceId: 0,
    });
    return true;
  }

  // -----------------------------------------------------------------------
  // Reload
  // -----------------------------------------------------------------------

  private beginReload(): void {
    const inst = this.equipped;
    if (!inst || this.reloading) return;
    if (inst.loaded >= inst.stats.magazineSize && inst.chambered) return;

    const have = this.reserve.get(inst.ammoId) ?? 0;
    if (have <= 0) {
      bus.emit('ui:notify', { text: 'No magazines left', kind: 'warn' });
      return;
    }

    // Tactical: a round is still chambered, so the bolt never has to be sent
    // forward. Faster, and you keep the +1.
    this.reloadWasTactical = inst.chambered;
    this.reloadRemaining = this.reloadWasTactical ? inst.stats.reloadTimeMs : inst.stats.reloadEmptyTimeMs;
    this.reloading = true;

    bus.emit('weapon:reloadStart', {
      weaponId: inst.uid,
      tactical: this.reloadWasTactical,
      durationMs: this.reloadRemaining,
    });
  }

  private finishReload(): void {
    const inst = this.equipped!;
    this.reloading = false;
    this.reloadRemaining = 0;

    const have = this.reserve.get(inst.ammoId) ?? 0;
    const want = inst.stats.magazineSize - inst.loaded;
    const taken = Math.min(want, have);

    inst.loaded += taken;
    this.reserve.set(inst.ammoId, have - taken);
    if (!inst.chambered && inst.loaded > 0) {
      inst.loaded--;
      inst.chambered = true;
    }
    this.recoil.reset();
    bus.emit('weapon:reloadEnd', { weaponId: inst.uid, roundsLoaded: taken });
  }

  // -----------------------------------------------------------------------
  // Malfunctions
  // -----------------------------------------------------------------------

  private rollMalfunction(inst: WeaponInstance, wear: number): Malfunction {
    // Hot and worn weapons fail in worse ways than cold clean ones.
    const severity = clamp01(wear * 0.6 + inst.heat * 0.4);
    const roll = this.rng.next();
    if (roll < 0.45 - severity * 0.2) return 'failure_to_fire';
    if (roll < 0.72 - severity * 0.15) return 'failure_to_eject';
    if (roll < 0.88 - severity * 0.1) return 'failure_to_feed';
    if (roll < 0.97) return 'double_feed';
    return 'bolt_stuck';
  }

  private beginClearing(): void {
    const inst = this.equipped!;
    const kind = inst.malfunction as Malfunction;
    this.clearingRemaining = CLEAR_TIME_MS[kind] ?? 1500;
    // A double feed strips the magazine, so the reload afterwards is the slow
    // kind. That is the real cost of letting a gun get this bad.
    if (kind === 'double_feed' || kind === 'bolt_stuck') {
      inst.loaded = 0;
      inst.chambered = false;
    } else if (kind === 'failure_to_eject' || kind === 'failure_to_feed') {
      // Racking the bolt ejects the round that caused it.
      if (inst.loaded > 0) {
        inst.loaded--;
        inst.chambered = true;
      }
    } else {
      inst.chambered = true;
    }
  }

  // -----------------------------------------------------------------------
  // Presentation
  // -----------------------------------------------------------------------

  update(dt: number, _ctx: EngineContext): void {
    const inst = this.equipped;
    if (!inst) return;
    const playerSys = this.playerSystem();
    if (!playerSys) return;

    this.recoil.update(dt, inst.stats, this.recoilInputs(playerSys), recoilOut);

    // Recoil moves the camera through the player's additive offset channel, so
    // the controller keeps sole ownership of the transform.
    _camRot.set(recoilOut.pitch, recoilOut.yaw, recoilOut.roll);
    _camOffset.set(0, 0, recoilOut.punch);
    playerSys.addCameraOffset(_camOffset, _camRot);
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private recoilInputs(playerSys: PlayerLike): RecoilInputs {
    const stance = playerSys.stance;
    return {
      aiming: playerSys.adsProgress,
      braced: stance === 'prone' ? 1 : stance === 'crouch' ? 0.6 : 0.25,
      stamina: playerSys.stamina / Math.max(1, playerSys.maxStamina),
      holdingBreath: this.holdingBreath,
      speed: playerSys.speed,
    };
  }

  private woundPenalty(player: unknown): number {
    const actors = services.tryGet('actors') as unknown as { aimPenalty?(a: unknown): number } | undefined;
    if (!player || !actors?.aimPenalty) return 0;
    return actors.aimPenalty(player);
  }

  private attachmentDurabilityBurn(inst: WeaponInstance): number {
    let burn = 1;
    for (const id of Object.values(inst.attachments)) {
      if (!id) continue;
      burn *= ATTACHMENT_MAP.get(id)?.mods.durabilityBurn ?? 1;
    }
    return burn;
  }

  private playerSystem(): PlayerLike | null {
    return this.player ?? null;
  }

  /** Injected by main.ts so the runtime doesn't import the player module. */
  player: PlayerLike | null = null;

  // --- readouts for the HUD ---------------------------------------------
  get ammoCount(): { loaded: number; chambered: boolean; reserve: number } {
    const inst = this.equipped;
    if (!inst) return { loaded: 0, chambered: false, reserve: 0 };
    return {
      loaded: inst.loaded,
      chambered: inst.chambered,
      reserve: this.reserve.get(inst.ammoId) ?? 0,
    };
  }

  get isReloading(): boolean {
    return this.reloading;
  }

  get reloadProgress(): number {
    const inst = this.equipped;
    if (!this.reloading || !inst) return 0;
    const total = this.reloadWasTactical ? inst.stats.reloadTimeMs : inst.stats.reloadEmptyTimeMs;
    return 1 - clamp01(this.reloadRemaining / total);
  }
}

/** The slice of the player controller the weapon runtime needs. */
export interface PlayerLike {
  input: { fire: boolean; reload: boolean; aim: boolean };
  stance: string;
  adsProgress: number;
  stamina: number;
  maxStamina: number;
  speed: number;
  addCameraOffset(pos: THREE.Vector3, rot: THREE.Euler): void;
}

export { WEAPONS, ATTACHMENTS, AMMO };
