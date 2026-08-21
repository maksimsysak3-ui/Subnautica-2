/**
 * Missions.
 *
 * OWNED BY: Mission design.
 *
 * ## What was missing
 * Everything up to here built a place and filled it with people who will shoot
 * you. That is a sandbox, not a game — you spawn, you can kill, and nothing
 * ever tells you that you have done anything. The difference between this and
 * Ready or Not is not fidelity, it is that Ready or Not gives you a reason to
 * open a door and a way to be wrong about it.
 *
 * ## The three things a mission has to do
 *
 *  1. **Tell you what you came for**, before you go in, in terms you can act
 *     on. "Secure the intel in the villa office" is a plan; "kill 12 enemies"
 *     is a chore.
 *  2. **React while you are inside.** An objective that only resolves at the
 *     end is a checklist. Objectives here fire off the same event bus the
 *     world already uses, so clearing a room, opening a safe or being spotted
 *     all move the mission immediately.
 *  3. **End, and say why.** Success, failure, and — the one most games skip —
 *     a *partial* result. Extracting with the intel but having tripped the
 *     alarm is a different outcome from doing it clean, and the debrief has to
 *     say so or there is no reason to ever do it clean.
 *
 * ## Objectives are data, not code
 * Every objective kind resolves through one `reportProgress` path fed by bus
 * events. Adding "destroy the generators" is a data entry, not a new system,
 * which is what makes hundreds of missions plausible rather than aspirational.
 */

import * as THREE from 'three';
import type { System, EngineContext } from '../core/engine';
import { bus } from '../core/events';
import {
  services,
  type IMissionSystem,
  type MissionDefinition,
  type Objective,
  type ObjectiveKind,
} from '../core/contracts';
import { Rng } from '../core/math';
import { MISSIONS, type MissionTemplate } from './catalogue';

export type MissionOutcome = 'success' | 'partial' | 'failure' | 'aborted';

export interface MissionResult {
  outcome: MissionOutcome;
  reason: string;
  /** Seconds from insertion. */
  elapsed: number;
  objectivesComplete: number;
  objectivesTotal: number;
  stats: Record<string, number>;
}

export class MissionSystem implements System, IMissionSystem {
  readonly id = 'missions';
  readonly order = 8;
  readonly initOrder = 78;
  readonly budgetMs = 0.4;

  current: MissionDefinition | null = null;
  objectives: Objective[] = [];
  result: MissionResult | null = null;

  /**
   * Live tally. Everything the debrief and the scoring read comes from here,
   * and every entry is written by a bus event rather than by a system reaching
   * in — so a mission cannot silently disagree with what happened.
   */
  readonly stats: Record<string, number> = {
    kills: 0, headshots: 0, civiliansKilled: 0, alerts: 0,
    shotsFired: 0, shotsHit: 0, damageTaken: 0, doorsBreached: 0,
    surrenders: 0, elapsed: 0,
  };

  private started = false;
  private rng = new Rng('missions');
  private template: MissionTemplate | null = null;

  init(_ctx: EngineContext): void {
    services.register('missions', this);

    bus.on('actor:killed', (e) => {
      const a = services.tryGet('actors')?.get(e.actorId);
      if (!a) return;
      if (a.faction === 'player') return;
      if (a.faction === 'civilian') {
        this.stats.civiliansKilled++;
        this.check('civilianKilled', a.position);
        return;
      }
      this.stats.kills++;
      if (e.headshot) this.stats.headshots++;
      this.check('kill', a.position, a.archetype);
    });

    bus.on('actor:surrendered', () => { this.stats.surrenders++; });
    bus.on('weapon:fired', () => { this.stats.shotsFired++; });
    bus.on('bullet:hitActor', () => { this.stats.shotsHit++; });
    // A kicked or breached door is the loud entry, and the debrief should say
    // how many you made.
    bus.on('door:opened', (e) => { if (e.fast) this.stats.doorsBreached++; });
    bus.on('ai:spotted', () => {
      // Only the FIRST sighting is an alert. Counting every enemy that sees
      // you once the shooting starts turns a stealth score into a body count.
      if (this.stats.alerts === 0) {
        this.stats.alerts++;
        bus.emit('ui:notify', { text: 'YOU HAVE BEEN SEEN', kind: 'warn' });
      }
    });
    bus.on('actor:damaged', (e) => {
      if (e.actorId === 0) this.stats.damageTaken += e.amount;
    });
    bus.on('door:opened', (e) => {
      const d = (services.tryGet('world') as unknown as {
        doors?: { get(id: number): { x: number; y: number; z: number } | undefined };
      } | undefined)?.doors?.get(e.doorId);
      if (d) this.check('door', new THREE.Vector3(d.x, d.y, d.z));
    });
  }

  /**
   * Build a mission for a map.
   *
   * `seed` picks among the templates that fit the site, so the same seed on
   * the same map is always the same mission — a mission you cannot replay is
   * a mission you cannot learn.
   */
  generate(seed: number, opts?: { difficulty?: number; region?: string; kind?: ObjectiveKind }): MissionDefinition {
    const site = opts?.region ?? 'villa';
    const pool = MISSIONS.filter((m) => m.siteId === site);
    const rng = new Rng(`mission:${site}:${seed}`);
    const t = pool.length ? pool[Math.floor(rng.next() * pool.length) % pool.length] : MISSIONS[0];
    this.template = t;

    const objectives: Objective[] = t.objectives.map((o, i) => ({
      id: o.id,
      kind: o.kind,
      label: o.label,
      description: o.description,
      optional: o.optional ?? false,
      hidden: o.hidden ?? false,
      state: (o.dependsOn?.length ?? 0) === 0 ? 'active' : 'pending',
      progress: 0,
      required: o.required ?? 1,
      position: o.at ? new THREE.Vector3(o.at[0], o.at[1], o.at[2]) : undefined,
      dependsOn: o.dependsOn ?? [],
      // Not on the contract, but the resolver needs it.
      ...( { radius: o.radius ?? 6, archetype: o.archetype } as object),
    })) as Objective[];

    const def: MissionDefinition = {
      id: `${t.id}:${seed}`,
      seed,
      name: t.name,
      codename: t.codename,
      region: site,
      siteId: site,
      faction: 'cartel',
      difficulty: opts?.difficulty ?? t.difficulty,
      objectives,
      weather: 'clear',
      hour: t.hour,
      approaches: [],
      briefing: t.briefing,
      intel: t.intel,
      enemyCount: 0,
      civilianCount: 0,
      rewards: t.rewards,
      modifiers: [],
    };
    return def;
  }

  async start(def: MissionDefinition, _approachId: string): Promise<void> {
    this.current = def;
    this.objectives = def.objectives;
    this.result = null;
    this.started = true;
    for (const k of Object.keys(this.stats)) this.stats[k] = 0;

    const env = services.tryGet('environment') as unknown as
      { setTimeOfDay?(h: number): void } | undefined;
    env?.setTimeOfDay?.(def.hour);

    bus.emit('mission:started', { missionId: def.id, seed: def.seed, codename: def.codename });
    bus.emit('ui:notify', { text: def.codename, kind: 'info' });
  }

  abort(reason: string): void {
    this.finish('aborted', reason);
  }

  reportProgress(objectiveId: string, delta: number): void {
    const o = this.objectives.find((x) => x.id === objectiveId);
    if (!o || o.state !== 'active') return;
    o.progress = Math.min(o.required, o.progress + delta);
    if (o.progress >= o.required) this.complete(o);
  }

  // -----------------------------------------------------------------------
  // Resolution
  // -----------------------------------------------------------------------

  /**
   * One event, every objective kind.
   *
   * Objectives ask "did this event happen, near enough to me, of the right
   * sort" and nothing else. That is what keeps adding a mission a data entry.
   */
  private check(event: string, at?: THREE.Vector3, tag?: string): void {
    if (!this.started || this.result) return;
    for (const o of this.objectives) {
      if (o.state !== 'active') continue;
      const spec = o as Objective & { radius?: number; archetype?: string };
      const inRange = !o.position || !at
        || at.distanceTo(o.position) <= (spec.radius ?? 6);

      switch (o.kind) {
        case 'eliminate':
          if (event === 'kill' && inRange) this.reportProgress(o.id, 1);
          break;
        case 'eliminateHVT':
          if (event === 'kill' && tag === (spec.archetype ?? 'bodyguard')) {
            this.reportProgress(o.id, 1);
          }
          break;
        case 'clear':
          // A room is clear when nothing hostile is left alive inside it.
          if (event === 'kill' && inRange && this.hostilesNear(o.position!, spec.radius ?? 12) === 0) {
            this.reportProgress(o.id, o.required);
          }
          break;
        case 'secureIntel':
        case 'sabotage':
        case 'destroy':
        case 'plant':
        case 'defuse':
        case 'tag':
          // Reached by standing on it — handled in fixedUpdate, not here.
          break;
        case 'survive':
          break;
        default:
          break;
      }

      if (event === 'civilianKilled' && !o.optional && o.kind !== 'survive') {
        // Not a per-objective failure; the mission-level rule below handles it.
      }
    }
  }

  private hostilesNear(p: THREE.Vector3, r: number): number {
    const actors = services.tryGet('actors');
    if (!actors) return 0;
    let n = 0;
    for (const a of actors.all) {
      if (!a.alive || a.faction === 'player' || a.faction === 'civilian') continue;
      if (a.surrendered) continue;
      const dx = a.position.x - p.x, dy = a.position.y - p.y, dz = a.position.z - p.z;
      if (dx * dx + dy * dy + dz * dz <= r * r) n++;
    }
    return n;
  }

  private complete(o: Objective): void {
    o.state = 'complete';
    bus.emit('mission:objectiveCompleted', { objectiveId: o.id });
    bus.emit('ui:notify', { text: `${o.label} — COMPLETE`, kind: 'success' });

    // Activate anything that was waiting on it, and reveal hidden follow-ups.
    for (const next of this.objectives) {
      if (next.state !== 'pending') continue;
      if (next.dependsOn.every((d) =>
        this.objectives.find((x) => x.id === d)?.state === 'complete')) {
        next.state = 'active';
        next.hidden = false;
        bus.emit('ui:notify', { text: `NEW TASK — ${next.label}`, kind: 'info' });
      }
    }
    this.evaluate();
  }

  private evaluate(): void {
    if (this.result) return;
    const required = this.objectives.filter((o) => !o.optional);
    if (required.every((o) => o.state === 'complete')) {
      const bonus = this.objectives.filter((o) => o.optional && o.state === 'complete').length;
      const clean = this.stats.alerts === 0 && this.stats.civiliansKilled === 0;
      this.finish(
        clean ? 'success' : 'partial',
        clean
          ? 'All tasks complete. Nobody knew you were there.'
          : this.stats.civiliansKilled > 0
            ? `All tasks complete, but ${this.stats.civiliansKilled} non-combatant${this.stats.civiliansKilled > 1 ? 's' : ''} died.`
            : 'All tasks complete. The alarm went up.',
        bonus,
      );
    }
  }

  private finish(outcome: MissionOutcome, reason: string, _bonus = 0): void {
    if (this.result) return;
    this.started = false;
    this.result = {
      outcome, reason,
      elapsed: this.stats.elapsed,
      objectivesComplete: this.objectives.filter((o) => o.state === 'complete').length,
      objectivesTotal: this.objectives.length,
      stats: { ...this.stats },
    };
    bus.emit('mission:ended', { outcome, reason });
  }

  fixedUpdate(step: number, _ctx: EngineContext): void {
    if (!this.started || this.result) return;
    this.stats.elapsed += step;

    const player = services.tryGet('actors')?.get(0);
    if (!player) return;

    // Death ends it. Nothing else in the game currently does.
    if (!player.alive) {
      this.finish('failure', 'Operator killed in action.');
      return;
    }

    // Position-based objectives: reached by standing on them.
    for (const o of this.objectives) {
      if (o.state !== 'active' || !o.position) continue;
      const spec = o as Objective & { radius?: number };
      const holdKinds: ObjectiveKind[] = [
        'secureIntel', 'sabotage', 'destroy', 'plant', 'defuse', 'tag', 'extract', 'recon',
      ];
      if (!holdKinds.includes(o.kind)) continue;

      const d = player.position.distanceTo(o.position);
      if (d > (spec.radius ?? 3)) continue;

      // Extraction is gated on the rest of the mission, or you could simply
      // walk to the pickup and call it a win.
      if (o.kind === 'extract') {
        const outstanding = this.objectives.filter(
          (x) => !x.optional && x.id !== o.id && x.state !== 'complete');
        if (outstanding.length > 0) continue;
      }
      this.reportProgress(o.id, o.required);
    }
  }
}
