/**
 * Actor registry — the single source of truth for every living thing in the
 * mission, player included.
 *
 * OWNED BY: Integration. Consumed by AI, tactical behaviour, character models,
 * audio and UI. Behaviour lives in src/ai/ and src/tactics/; this file owns
 * *state* and the damage model only. Do not put decision-making here.
 *
 * Design intent: damage is localised and consequential. There is no health
 * regeneration and no hitpoint sponge. A torso hit from a rifle round should
 * end most fights, which is what makes caution the correct strategy — the
 * Ground Branch / Ready or Not contract with the player.
 */

import * as THREE from 'three';
import type { System, EngineContext } from '../core/engine';
import { bus, type Faction, type HitRegion, type DamageType, type Alertness, type StanceId } from '../core/events';
import { services, type IActorRegistry, type ActorState } from '../core/contracts';
import { clamp, clamp01, Rng } from '../core/math';

/** Per-region damage multipliers. Armour is handled separately. */
const REGION_MULTIPLIER: Record<HitRegion, number> = {
  head: 4.2,
  neck: 3.0,
  thorax: 1.0,
  stomach: 0.85,
  arm_l: 0.55,
  arm_r: 0.55,
  leg_l: 0.6,
  leg_r: 0.6,
};

/** Health pool per region. Destroying a vital region is lethal. */
const REGION_HEALTH: Record<HitRegion, number> = {
  head: 35,
  neck: 30,
  thorax: 85,
  stomach: 70,
  arm_l: 60,
  arm_r: 60,
  leg_l: 65,
  leg_r: 65,
};

const VITAL_REGIONS: HitRegion[] = ['head', 'neck', 'thorax'];

/** Vertical bands used to resolve a hit height into a body region. */
const REGION_BANDS: Array<{ region: HitRegion; minY: number; maxY: number }> = [
  { region: 'head', minY: 1.56, maxY: 1.85 },
  { region: 'neck', minY: 1.48, maxY: 1.56 },
  { region: 'thorax', minY: 1.10, maxY: 1.48 },
  { region: 'stomach', minY: 0.88, maxY: 1.10 },
  { region: 'leg_l', minY: 0.0, maxY: 0.88 },
];

export interface ArmourPiece {
  id: string;
  name: string;
  /** Regions this piece covers. */
  covers: HitRegion[];
  /** Class 1..6, compared against the round's penetration value. */
  armourClass: number;
  /** Remaining durability points; degrades as it stops rounds. */
  durability: number;
  maxDurability: number;
  /** 0..1 fraction of energy converted to blunt trauma when stopped. */
  bluntTransfer: number;
  massKg: number;
}

export interface LimbState {
  health: number;
  maxHealth: number;
  /** ml/s of blood loss from this limb. */
  bleeding: number;
  /** True once health hits zero — permanent for the mission. */
  destroyed: boolean;
  fractured: boolean;
}

export interface Actor extends ActorState {
  limbs: Record<HitRegion, LimbState>;
  armour: ArmourPiece[];
  /** Total blood volume remaining, ml. Death at zero. */
  blood: number;
  maxBlood: number;
  /** 0..1 pain level; degrades aim and movement. */
  pain: number;
  /** Seconds remaining of flashbang/concussion effect. */
  stunned: number;
  /** Set when the actor is unconscious but not dead — can be arrested. */
  unconscious: boolean;
  /** Visual representation, owned by the character-models team. */
  view: THREE.Object3D | null;
  /** Where the actor last saw or heard a threat. */
  lastKnownThreat: THREE.Vector3 | null;
  /** Free-form slot for the AI team's blackboard; nothing here reads it. */
  brain: unknown;
  /** Time since spawn, seconds. */
  age: number;
  /** Accuracy skill 0..1 — archetype-driven, used by the AI's shooting. */
  skill: number;
  /** Seconds this actor has been continuously suppressed. */
  suppressedFor: number;
}

export interface ActorSpawnOptions {
  faction: Faction;
  archetype: string;
  position: THREE.Vector3;
  facing?: number;
  health?: number;
  skill?: number;
  morale?: number;
  armour?: ArmourPiece[];
  weaponId?: string | null;
  isPlayer?: boolean;
}

function makeLimbs(): Record<HitRegion, LimbState> {
  const out = {} as Record<HitRegion, LimbState>;
  for (const region of Object.keys(REGION_HEALTH) as HitRegion[]) {
    out[region] = {
      health: REGION_HEALTH[region],
      maxHealth: REGION_HEALTH[region],
      bleeding: 0,
      destroyed: false,
      fractured: false,
    };
  }
  return out;
}

export class ActorRegistry implements System, IActorRegistry {
  readonly id = 'actors';
  readonly order = 18;
  readonly budgetMs = 1.5;

  private actors = new Map<number, Actor>();
  private list: Actor[] = [];
  private nextId = 1;
  private rng = new Rng('actors');
  playerId = 0;

  init(_ctx: EngineContext): void {
    services.register('actors', this);
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  spawn(opts: ActorSpawnOptions): Actor {
    const id = opts.isPlayer ? 0 : this.nextId++;
    const facing = opts.facing ?? 0;
    const actor: Actor = {
      id,
      faction: opts.faction,
      archetype: opts.archetype,
      alive: true,
      downed: false,
      surrendered: false,
      health: opts.health ?? 100,
      maxHealth: opts.health ?? 100,
      stance: 'stand',
      alertness: 'unaware',
      eye: opts.position.clone().setY(opts.position.y + 1.68),
      position: opts.position.clone(),
      forward: new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing)),
      aimDirection: new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing)),
      velocity: new THREE.Vector3(),
      suppression: 0,
      morale: opts.morale ?? 1,
      weaponId: opts.weaponId ?? null,
      tagged: false,
      limbs: makeLimbs(),
      armour: opts.armour ?? [],
      blood: 5000,
      maxBlood: 5000,
      pain: 0,
      stunned: 0,
      unconscious: false,
      view: null,
      lastKnownThreat: null,
      brain: null,
      age: 0,
      skill: opts.skill ?? 0.5,
      suppressedFor: 0,
    };
    if (opts.isPlayer) this.playerId = 0;
    this.actors.set(id, actor);
    this.list.push(actor);
    bus.emit('actor:spawned', {
      actorId: id,
      faction: actor.faction,
      archetype: actor.archetype,
      position: actor.position.clone(),
    });
    return actor;
  }

  despawn(id: number): void {
    const a = this.actors.get(id);
    if (!a) return;
    this.actors.delete(id);
    const i = this.list.indexOf(a);
    if (i >= 0) this.list.splice(i, 1);
    a.view?.parent?.remove(a.view);
  }

  clear(): void {
    for (const a of this.list) a.view?.parent?.remove(a.view);
    this.actors.clear();
    this.list.length = 0;
    this.nextId = 1;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  get(id: number): Actor | undefined {
    return this.actors.get(id);
  }

  get all(): readonly Actor[] {
    return this.list;
  }

  byFaction(f: Faction): Actor[] {
    return this.list.filter((a) => a.alive && a.faction === f);
  }

  /** Factions that will shoot each other. Civilians are hostile to nobody. */
  areHostile(a: Faction, b: Faction): boolean {
    if (a === b) return false;
    if (a === 'civilian' || b === 'civilian') return false;
    if (a === 'player' || b === 'player') return true;
    // Criminal factions tolerate each other unless the mission says otherwise.
    return false;
  }

  hostilesNear(position: THREE.Vector3, faction: Faction, radius: number): Actor[] {
    const r2 = radius * radius;
    const out: Actor[] = [];
    for (const a of this.list) {
      if (!a.alive || a.downed || a.surrendered) continue;
      if (!this.areHostile(faction, a.faction)) continue;
      if (a.position.distanceToSquared(position) <= r2) out.push(a);
    }
    out.sort((x, y) => x.position.distanceToSquared(position) - y.position.distanceToSquared(position));
    return out;
  }

  /** Resolve a world-space hit point on an actor into a body region. */
  regionForHit(actor: Actor, worldPoint: THREE.Vector3, hitDirection?: THREE.Vector3): HitRegion {
    const stanceScale = actor.stance === 'crouch' ? 0.66 : actor.stance === 'prone' ? 0.22 : 1;
    const local = (worldPoint.y - actor.position.y) / Math.max(0.2, stanceScale);
    for (const band of REGION_BANDS) {
      if (local >= band.minY && local < band.maxY) {
        if (band.region === 'leg_l') {
          // Split legs by which side of the body plane the hit landed on.
          const right = new THREE.Vector3().crossVectors(actor.forward, new THREE.Vector3(0, 1, 0));
          const off = worldPoint.clone().sub(actor.position).dot(right);
          return off >= 0 ? 'leg_r' : 'leg_l';
        }
        return band.region;
      }
    }
    // Above the head band — grazing shot, treat as a miss on the arm.
    if (local >= 1.85) return 'head';
    // Arms sit alongside the thorax; a fraction of torso-height hits catch them.
    if (hitDirection && this.rng.bool(0.18)) {
      const right = new THREE.Vector3().crossVectors(actor.forward, new THREE.Vector3(0, 1, 0));
      return worldPoint.clone().sub(actor.position).dot(right) >= 0 ? 'arm_r' : 'arm_l';
    }
    return 'thorax';
  }

  armourFor(actor: Actor, region: HitRegion): ArmourPiece | null {
    for (const p of actor.armour) {
      if (p.durability > 0 && p.covers.includes(region)) return p;
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Damage
  // -----------------------------------------------------------------------

  applyDamage(
    actorId: number,
    amount: number,
    type: DamageType,
    region: HitRegion,
    sourceId: number,
    direction?: THREE.Vector3,
  ): void {
    const a = this.actors.get(actorId);
    if (!a || !a.alive) return;

    const limb = a.limbs[region];
    const scaled = amount * REGION_MULTIPLIER[region];

    limb.health = Math.max(0, limb.health - scaled);
    a.health = Math.max(0, a.health - scaled * 0.55);

    // Bleeding scales with wound severity and is the real long-term threat.
    if (type === 'ballistic' || type === 'fragmentation') {
      const severity = clamp01(scaled / 60);
      limb.bleeding += severity * (VITAL_REGIONS.includes(region) ? 4.5 : 2.2);
      if (severity > 0.55 && (region === 'leg_l' || region === 'leg_r' || region === 'arm_l' || region === 'arm_r')) {
        limb.fractured = true;
      }
    }

    a.pain = clamp01(a.pain + scaled / 90);
    a.morale = clamp01(a.morale - scaled / 140);

    if (limb.health <= 0 && !limb.destroyed) {
      limb.destroyed = true;
      // Losing a vital region is fatal; losing a limb is survivable but severe.
      if (VITAL_REGIONS.includes(region)) {
        this.kill(a, sourceId, region === 'head');
        return;
      }
      limb.bleeding += 6;
      a.pain = 1;
    }

    bus.emit('actor:damaged', { actorId, amount: scaled, type, region, sourceId });

    if (a.id === this.playerId) {
      bus.emit('player:healthChanged', { health: a.health, max: a.maxHealth });
    }

    if (a.health <= 0) {
      this.kill(a, sourceId, region === 'head');
      return;
    }

    // Heavy trauma can drop an actor unconscious rather than killing them,
    // which is what makes non-lethal play and arrests possible.
    if (!a.downed && a.health < 22 && this.rng.bool(0.45)) {
      this.down(a, sourceId);
    }

    // Taking fire is the main driver of surrender for low-morale factions.
    if (!a.surrendered && a.morale < 0.22 && a.faction !== 'player' && this.rng.bool(0.3)) {
      this.surrender(a);
    }
  }

  down(a: Actor, sourceId: number): void {
    if (a.downed || !a.alive) return;
    a.downed = true;
    a.unconscious = true;
    a.stance = 'prone';
    bus.emit('actor:downed', { actorId: a.id, sourceId, headshot: false });
  }

  surrender(a: Actor): void {
    if (a.surrendered || !a.alive) return;
    a.surrendered = true;
    a.alertness = 'alerted';
    bus.emit('actor:surrendered', { actorId: a.id });
  }

  arrest(a: Actor): void {
    if (!a.alive) return;
    a.surrendered = true;
    a.downed = true;
    bus.emit('actor:arrested', { actorId: a.id });
  }

  kill(a: Actor, sourceId: number, headshot: boolean): void {
    if (!a.alive) return;
    a.alive = false;
    a.downed = true;
    a.health = 0;
    const src = this.actors.get(sourceId);
    const distance = src ? src.position.distanceTo(a.position) : 0;
    bus.emit('actor:killed', { actorId: a.id, sourceId, headshot, distance });
    if (a.id === this.playerId) {
      bus.emit('player:died', { cause: headshot ? 'headshot' : 'wounds' });
    }
  }

  setAlertness(a: Actor, to: Alertness, cause: string): void {
    if (a.alertness === to) return;
    const from = a.alertness;
    a.alertness = to;
    bus.emit('actor:alertnessChanged', { actorId: a.id, from, to, cause });
  }

  setStance(a: Actor, s: StanceId): void {
    a.stance = s;
  }

  /** Applied by ballistics when rounds pass close by. */
  addSuppression(a: Actor, amount: number): void {
    a.suppression = clamp01(a.suppression + amount);
  }

  // -----------------------------------------------------------------------
  // Per-step simulation: bleeding, pain recovery, suppression decay
  // -----------------------------------------------------------------------

  fixedUpdate(step: number, _ctx: EngineContext): void {
    for (let i = 0; i < this.list.length; i++) {
      const a = this.list[i];
      a.age += step;

      if (!a.alive) continue;

      // Bleeding drains blood volume; enough of it kills.
      let bleedRate = 0;
      for (const region of Object.keys(a.limbs) as HitRegion[]) {
        const l = a.limbs[region];
        if (l.bleeding > 0) {
          bleedRate += l.bleeding;
          // Clotting slowly reduces light bleeding but never heavy bleeding.
          if (l.bleeding < 2) l.bleeding = Math.max(0, l.bleeding - step * 0.05);
        }
      }
      if (bleedRate > 0) {
        a.blood = Math.max(0, a.blood - bleedRate * step * 4);
        // Blood loss degrades health continuously — untreated wounds kill.
        const lossFraction = 1 - a.blood / a.maxBlood;
        if (lossFraction > 0.3) {
          a.health = Math.max(0, a.health - step * (lossFraction - 0.3) * 12);
          if (a.id === this.playerId) {
            bus.post('player:healthChanged', { health: a.health, max: a.maxHealth });
          }
        }
        if (a.blood <= 0 || a.health <= 0) {
          this.kill(a, -1, false);
          continue;
        }
      }

      // Pain fades; suppression fades faster once rounds stop landing.
      a.pain = Math.max(0, a.pain - step * 0.08);
      if (a.suppression > 0) {
        a.suppressedFor += step;
        a.suppression = Math.max(0, a.suppression - step * 0.55);
      } else {
        a.suppressedFor = 0;
      }
      if (a.stunned > 0) a.stunned = Math.max(0, a.stunned - step);

      // Eye position tracks stance so perception and shooting agree with the
      // rendered pose.
      const eyeH = a.stance === 'prone' ? 0.34 : a.stance === 'crouch' ? 1.12 : 1.68;
      a.eye.set(a.position.x, a.position.y + eyeH, a.position.z);
    }
  }

  /** Aggregate accuracy penalty from wounds, pain and suppression. */
  aimPenalty(a: Actor): number {
    const armWound = 1 - Math.min(a.limbs.arm_l.health / a.limbs.arm_l.maxHealth, a.limbs.arm_r.health / a.limbs.arm_r.maxHealth);
    return clamp01(a.pain * 0.5 + a.suppression * 0.6 + armWound * 0.5 + (a.stunned > 0 ? 0.8 : 0));
  }

  /** Movement speed multiplier from leg wounds and pain. */
  mobility(a: Actor): number {
    const legs = Math.min(a.limbs.leg_l.health / a.limbs.leg_l.maxHealth, a.limbs.leg_r.health / a.limbs.leg_r.maxHealth);
    const fractured = a.limbs.leg_l.fractured || a.limbs.leg_r.fractured;
    return clamp(legs * (fractured ? 0.45 : 1) * (1 - a.pain * 0.3), 0.15, 1);
  }

  /** Stop bleeding on one limb — used by the medical/gear system. */
  applyTourniquet(a: Actor, region: HitRegion): void {
    a.limbs[region].bleeding = 0;
  }

  heal(a: Actor, amount: number): void {
    a.health = Math.min(a.maxHealth, a.health + amount);
    if (a.id === this.playerId) {
      bus.emit('player:healthChanged', { health: a.health, max: a.maxHealth });
    }
  }
}
