/**
 * Typed event bus. Every cross-system message goes through here so that
 * teams never need direct references to each other's modules.
 *
 * Rule for contributors: if system A needs to tell system B something,
 * add an event here rather than importing B into A.
 */

import type { Vector3 } from 'three';

export type DamageType = 'ballistic' | 'fragmentation' | 'blunt' | 'burn' | 'fall';
export type HitRegion = 'head' | 'neck' | 'thorax' | 'stomach' | 'arm_l' | 'arm_r' | 'leg_l' | 'leg_r';
export type Faction = 'player' | 'cartel' | 'insurgent' | 'pmc' | 'syndicate' | 'militia' | 'civilian';
export type Alertness = 'unaware' | 'curious' | 'suspicious' | 'searching' | 'alerted' | 'engaged';
export type StanceId = 'stand' | 'crouch' | 'prone';

export interface GameEvents {
  // --- lifecycle -----------------------------------------------------------
  'game:boot': { at: number };
  'game:started': { missionId: string; seed: number };
  'game:paused': { paused: boolean };
  'game:ended': { success: boolean; reason: string };
  'game:tick': { dt: number; elapsed: number };

  // --- weapons -------------------------------------------------------------
  'weapon:fired': {
    weaponId: string; muzzle: Vector3; direction: Vector3;
    suppressed: boolean; loudnessMeters: number; shooterId: number;
  };
  'weapon:dryfire': { weaponId: string };
  'weapon:reloadStart': { weaponId: string; tactical: boolean; durationMs: number };
  'weapon:reloadEnd': { weaponId: string; roundsLoaded: number };
  'weapon:jammed': { weaponId: string; cause: string };
  'weapon:cleared': { weaponId: string };
  'weapon:fireModeChanged': { weaponId: string; mode: string };
  'weapon:equipped': { weaponId: string; slot: string };
  'weapon:attachmentChanged': { weaponId: string; slot: string; attachmentId: string | null };
  'weapon:shellEject': { position: Vector3; velocity: Vector3; caliber: string };

  // --- ballistics ----------------------------------------------------------
  'bullet:impact': {
    position: Vector3; normal: Vector3; surface: string;
    energyJ: number; penetrated: boolean; ricochet: boolean; shooterId: number;
  };
  'bullet:hitActor': {
    actorId: number; region: HitRegion; energyJ: number; penetratedArmor: boolean;
    shooterId: number; position: Vector3; direction: Vector3;
  };
  'bullet:crack': { position: Vector3; distanceFromEar: number };

  // --- actors --------------------------------------------------------------
  'actor:spawned': { actorId: number; faction: Faction; archetype: string; position: Vector3 };
  'actor:damaged': { actorId: number; amount: number; type: DamageType; region: HitRegion; sourceId: number };
  'actor:downed': { actorId: number; sourceId: number; headshot: boolean };
  'actor:killed': { actorId: number; sourceId: number; headshot: boolean; distance: number };
  'actor:surrendered': { actorId: number };
  'actor:arrested': { actorId: number };
  'actor:alertnessChanged': { actorId: number; from: Alertness; to: Alertness; cause: string };
  'actor:footstep': { actorId: number; position: Vector3; surface: string; loudnessMeters: number };
  'actor:vocalized': { actorId: number; line: string; category: string };
  'actor:suppressed': { actorId: number; seconds: number };

  // --- AI ------------------------------------------------------------------
  'ai:spotted': { actorId: number; targetId: number };
  'ai:fired': {
    actorId: number;
    from: Vector3;
    dir: Vector3;
    hit: Vector3 | null;
  };
  'ai:broke': { actorId: number; surrendered: boolean };

  // --- player --------------------------------------------------------------
  'player:stanceChanged': { from: StanceId; to: StanceId };
  /** `noise` is 0..1, for whatever ends up listening for footfalls. */
  'player:jumped': { noise: number };
  'player:leanChanged': { amount: number };
  'player:adsChanged': { aiming: boolean };
  'player:healthChanged': { health: number; max: number };
  'player:bleedingChanged': { limbs: string[] };
  'player:staminaChanged': { stamina: number; max: number };
  'player:died': { cause: string };

  // --- perception / stealth ------------------------------------------------
  'sound:emitted': { position: Vector3; loudnessMeters: number; kind: string; sourceId: number };
  'stealth:detectionChanged': { level: number; byActorId: number };
  'stealth:blown': { position: Vector3; cause: string };
  'body:discovered': { actorId: number; byActorId: number };

  // --- gadgets -------------------------------------------------------------
  'drone:launched': { droneId: number };
  'drone:recalled': { droneId: number };
  'drone:tagged': { actorId: number; byDroneId: number };
  'breach:started': { doorId: number; method: string };
  'breach:completed': { doorId: number; method: string; position: Vector3 };
  'grenade:thrown': { kind: string; position: Vector3; velocity: Vector3 };
  'grenade:detonated': { kind: string; position: Vector3; radius: number };
  'flashbang:affected': { actorId: number; intensity: number };

  // --- doors / world -------------------------------------------------------
  'door:opened': { doorId: number; fast: boolean; byActorId: number };
  'door:closed': { doorId: number; byActorId: number };
  'door:locked': { doorId: number };

  // --- missions ------------------------------------------------------------
  'mission:generated': { missionId: string; seed: number; name: string };
  'mission:objectiveUpdated': { objectiveId: string; state: string; progress: number };
  'mission:objectiveCompleted': { objectiveId: string };
  'mission:phaseChanged': { phase: string };
  'mission:completed': { missionId: string; success: boolean; stats: Record<string, number> };

  // --- progression ---------------------------------------------------------
  'xp:awarded': { amount: number; reason: string };
  'skill:leveled': { skillId: string; level: number };
  'gear:unlocked': { itemId: string };
  'reputation:changed': { faction: Faction; delta: number; total: number };

  // --- weather / time ------------------------------------------------------
  'weather:changed': { from: string; to: string };
  'time:hourChanged': { hour: number };

  // --- ui ------------------------------------------------------------------
  'ui:screenChanged': { screen: string };
  'ui:notify': { text: string; kind: 'info' | 'warn' | 'success' | 'danger' };
  'ui:objectiveMarker': { id: string; position: Vector3; label: string; visible: boolean };
  'ui:hitmarker': { lethal: boolean; armor: boolean };

  // --- audio ---------------------------------------------------------------
  'audio:oneShot': { id: string; position?: Vector3; volume?: number; pitch?: number };
  'audio:music': { cue: string; intensity: number };

  // --- perf ----------------------------------------------------------------
  'perf:budgetExceeded': { system: string; ms: number };
}

export type EventName = keyof GameEvents;
type Handler<K extends EventName> = (payload: GameEvents[K]) => void;

export class EventBus {
  private handlers = new Map<EventName, Set<Handler<never>>>();
  private queue: Array<{ name: EventName; payload: unknown }> = [];
  /** Set true to log every event — useful when debugging a system in isolation. */
  debug = false;

  on<K extends EventName>(name: K, fn: Handler<K>): () => void {
    let set = this.handlers.get(name);
    if (!set) {
      set = new Set();
      this.handlers.set(name, set);
    }
    set.add(fn as Handler<never>);
    return () => this.off(name, fn);
  }

  once<K extends EventName>(name: K, fn: Handler<K>): () => void {
    const off = this.on(name, ((p: GameEvents[K]) => {
      off();
      fn(p);
    }) as Handler<K>);
    return off;
  }

  off<K extends EventName>(name: K, fn: Handler<K>): void {
    this.handlers.get(name)?.delete(fn as Handler<never>);
  }

  /** Fire immediately, synchronously. */
  emit<K extends EventName>(name: K, payload: GameEvents[K]): void {
    if (this.debug) console.debug('[evt]', name, payload);
    const set = this.handlers.get(name);
    if (!set) return;
    for (const fn of set) {
      try {
        (fn as Handler<K>)(payload);
      } catch (err) {
        console.error(`[EventBus] handler for "${name}" threw:`, err);
      }
    }
  }

  /** Defer until the next `flush()` — avoids re-entrancy during physics steps. */
  post<K extends EventName>(name: K, payload: GameEvents[K]): void {
    this.queue.push({ name, payload });
  }

  flush(): void {
    if (this.queue.length === 0) return;
    const batch = this.queue;
    this.queue = [];
    for (const { name, payload } of batch) {
      this.emit(name, payload as never);
    }
  }

  clear(): void {
    this.handlers.clear();
    this.queue.length = 0;
  }
}

/** Global bus. Systems import this directly. */
export const bus = new EventBus();
