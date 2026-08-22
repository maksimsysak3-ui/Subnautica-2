/**
 * Enemy AI.
 *
 * OWNED BY: AI.
 *
 * ## The design goal
 * Ready or Not's opposition is frightening because it is *unpredictable but
 * fair*: it reacts to what it can actually perceive, it uses the building, and
 * it breaks. It is not frightening because it has perfect aim. Everything here
 * follows from that:
 *
 *  - **Perception is earned.** An enemy knows only what it has seen through a
 *    real line-of-sight test or heard through a real sound event. There is no
 *    reading of the player's position.
 *  - **Reaction costs time.** Seeing a target starts a reaction timer scaled by
 *    skill and alertness. A surprised guard is genuinely slow.
 *  - **Fire is disciplined.** Bursts with pauses, aim that converges over time
 *    rather than snapping, and dispersion that starts wide.
 *  - **Morale is real.** Losing squadmates, taking fire and being flanked all
 *    push toward breaking, and a broken enemy runs or surrenders.
 *
 * ## The budget
 * Pathfinding measured 45 ms per request, which is far too expensive to let
 * every actor ask whenever it likes — twenty enemies re-pathing on the same
 * frame would be a one-second hitch. So path requests go through a queue with a
 * hard per-frame cap, and an actor that wants a path but cannot have one yet
 * keeps moving on its last one. Nothing stalls waiting for the planner.
 *
 * Perception is likewise staggered: each actor senses on its own phase at about
 * 6 Hz, so the raycast cost is spread rather than spiking every frame.
 */

import * as THREE from 'three';
import type { System, EngineContext } from '../core/engine';
import { bus } from '../core/events';
import { services, type CoverPoint } from '../core/contracts';

/** Structural point type — contracts keeps its own copy internal. */
type Vec3 = { x: number; y: number; z: number };
import type { Actor, ActorRegistry } from '../actors/actor-registry';
import { Rng, clamp, clamp01, lerp, damp } from '../core/math';
import { STANCE_HEIGHT, type StanceKey } from '../actors/humanoid';

export type AiState =
  | 'idle' | 'patrol' | 'alert' | 'search' | 'engage' | 'reposition' | 'flee' | 'surrender';

/** How much of a full alert an event is worth. */
const ALERT_GUNSHOT = 0.85;
const ALERT_FOOTSTEP = 0.30;
const ALERT_DOOR = 0.45;
const ALERT_BODY = 0.70;

/** Per-frame ceiling on path requests across ALL actors. */
/** Path solves per second of simulated time — two per frame at 60 Hz. */
const PATHS_PER_SECOND = 120;
/** Never bank more than this, so a long stall cannot buy a burst of solves. */
const PATH_CREDIT_CAP = 4;

export interface Brain {
  state: AiState;
  /** 0..1. Rises with evidence, decays with quiet. */
  alertness: number;
  /** 0..1. Falls with damage, losses and being flanked. */
  morale: number;
  /** Seconds until the actor may fire after acquiring a target. */
  reaction: number;
  /** Current aim error in radians; converges while a target is held. */
  aimError: number;
  /** Seconds of continuous sight on the target. */
  sightTime: number;
  /** Seconds since the target was last seen. */
  lostFor: number;
  /** Rounds left in the current burst. */
  burst: number;
  /** Seconds until the next shot may be fired. */
  fireCooldown: number;
  /** Seconds until the burst may resume. */
  burstPause: number;
  targetId: number;
  /** Where the actor believes the target is. Not necessarily where it is. */
  believedPos: THREE.Vector3 | null;
  /** Current path, in world space, and how far along it we are. */
  path: THREE.Vector3[];
  pathIndex: number;
  /** Seconds until this actor is allowed to ask for a new path. */
  repathIn: number;
  goal: THREE.Vector3 | null;
  cover: CoverPoint | null;
  /** Seconds since this cover was claimed — cover goes stale as threats move. */
  coverAge: number;
  /** Patrol route and current leg. */
  route: THREE.Vector3[];
  routeIndex: number;
  /** Perception phase, so actors do not all sense on the same frame. */
  senseIn: number;
  /** Seconds spent in the current state — drives timeouts. */
  stateAge: number;
  /** Seconds the actor stays put after arriving at a search point. */
  dwell: number;
  peeking: boolean;
  /** Current ground speed, m/s. Damped toward the state's target. */
  speed: number;
  /** Per-actor speed multiplier, so a squad does not move as one organism. */
  speedBias: number;
  /** True once this actor has arrived at cover and gone down behind it. */
  settled: boolean;
  /** Seconds of blind fire left at the last known position. */
  suppressFor: number;
  /** Seconds before this actor may work another door. */
  doorCooldown: number;
  /** Seconds until the next up/down transition behind cover. */
  peekIn: number;
  /** A door this actor opened and should shut behind it, or -1. */
  doorBehind: number;
  /** Seconds until that happens. */
  doorCloseIn: number;
}

/** Scratch aim point, so aimed fire and area fire share one code path. */
const _aimPoint = new THREE.Vector3();

function newBrain(rng: Rng, route: THREE.Vector3[]): Brain {
  return {
    state: route.length > 1 ? 'patrol' : 'idle',
    alertness: 0, morale: 1, reaction: 0, aimError: 0.16,
    sightTime: 0, lostFor: 99, burst: 0, fireCooldown: 0, burstPause: 0,
    targetId: -1, believedPos: null,
    path: [], pathIndex: 0, repathIn: 0, goal: null, cover: null, coverAge: 0,
    route, routeIndex: 0,
    senseIn: rng.range(0, 0.17),
    stateAge: 0, dwell: 0, peeking: false,
    speed: 0, speedBias: rng.range(0.88, 1.12), settled: false, suppressFor: 0,
    doorCooldown: 0, peekIn: 0, doorBehind: -1, doorCloseIn: 0,
  };
}

export class EnemyAi implements System {
  readonly id = 'ai';
  readonly order = 20;
  readonly initOrder = 70;
  readonly budgetMs = 2.5;

  private rng = new Rng(0x5eed_a1);
  private actors!: ActorRegistry;
  private pathQueue: number[] = [];
  /** Fractional path-solve credits, accrued at PATHS_PER_SECOND. */
  private pathCredits = PATH_CREDIT_CAP;
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpDir = new THREE.Vector3();

  /** This step's intended horizontal velocity, published to the actor. */
  private moveX = 0;
  private moveZ = 0;

  /** Diagnostics, read by tests and the capture director. */
  readonly stats = { thinking: 0, engaging: 0, pathsThisFrame: 0, pathMsAvg: 0, fallbackPaths: 0 };
  private pathMs: number[] = [];

  init(ctx: EngineContext): void {
    this.actors = ctx.engine.require<ActorRegistry>('actors');

    // Sound. An enemy that reacts to gunfire it could not possibly have heard
    // is the single most immersion-breaking thing an AI can do, so every one
    // of these is range-checked against where the sound actually happened.
    bus.on('weapon:fired', (e) => {
      this.hear(e.muzzle as Vec3, ALERT_GUNSHOT, 90, e.suppressed ? 0.30 : 1);
    });
    bus.on('door:opened', (e) => {
      const world = services.tryGet('world') as unknown as
        { doors?: { get(id: number): { x: number; y: number; z: number } | undefined } } | undefined;
      const d = world?.doors?.get(e.doorId);
      if (d) this.hear({ x: d.x, y: d.y, z: d.z }, ALERT_DOOR, 22, e.fast ? 2.2 : 1);
    });
    bus.on('actor:killed', (e) => {
      const dead = this.actors.get(e.actorId);
      if (!dead) return;
      this.hear(dead.position, ALERT_BODY, 30, 1);
      // Losing someone costs everyone nearby their nerve.
      for (const a of this.actors.all) {
        const b = a.brain as Brain | null;
        // Only their OWN side. Iterating everyone demoralised the shooter's
        // allies too, which is latent today because all AI are one faction and
        // would be very wrong the moment they are not.
        if (!b || !a.alive || a.faction !== dead.faction) continue;
        const d = this.dist(a.position, dead.position);
        if (d < 40) b.morale -= lerp(0.34, 0.08, clamp01(d / 40));
      }
    });
  }

  /**
   * Forget everything — used when the level is torn down.
   *
   * Brains live on the actors, so clearing the registry takes them with it;
   * what has to be cleared here is the path queue, which otherwise still holds
   * ids that now belong to actors on a different map.
   */
  reset(): void {
    this.pathQueue.length = 0;
    this.pathMs.length = 0;
    this.stats.thinking = 0;
    this.stats.engaging = 0;
    this.stats.fallbackPaths = 0;
  }

  /** Register an actor with the AI and give it a patrol route. */
  attach(actor: Actor, route: THREE.Vector3[] = []): void {
    actor.brain = newBrain(this.rng, route);
  }

  /**
   * Heading as an angle.
   *
   * `Actor` carries a forward *vector*, not a yaw, because everything
   * downstream of it (rendering, aiming, cover) wants a direction. Steering is
   * far easier to reason about in radians, so the AI converts at the boundary
   * rather than doing trigonometry on vectors throughout.
   */
  private facingOf(a: Actor): number {
    return Math.atan2(a.forward.x, a.forward.z);
  }

  private setFacing(a: Actor, yaw: number): void {
    a.forward.set(Math.sin(yaw), 0, Math.cos(yaw));
    a.aimDirection.set(Math.sin(yaw), 0, Math.cos(yaw));
  }

  private dist(a: Vec3, b: Vec3): number {
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  /**
   * Propagate a sound. `loudness` scales the audible radius, so a suppressed
   * shot carries a third as far and a kicked door carries twice as far.
   */
  private hear(at: Vec3, weight: number, radius: number, loudness: number): void {
    const r = radius * loudness;
    for (const a of this.actors.all) {
      const b = a.brain as Brain | null;
      if (!b || !a.alive || a.faction === 'player') continue;
      const d = this.dist(a.position, at);
      if (d > r) continue;
      // Falls off with distance rather than being a hard radius: a distant
      // shot should make a guard curious, not send him sprinting.
      const strength = weight * (1 - d / r);
      b.alertness = clamp01(b.alertness + strength);
      if (b.alertness > 0.45 && b.state !== 'engage') {
        b.believedPos = new THREE.Vector3(at.x, at.y, at.z);
        this.setState(b, b.alertness > 0.8 ? 'search' : 'alert');
      }
    }
  }

  /** Is anyone still standing nearby? Being alone is most of losing your nerve. */
  private hasNearbyAlly(a: Actor, radius: number): boolean {
    const r2 = radius * radius;
    for (const o of this.actors.all) {
      if (o.id === a.id || !o.alive || o.faction !== a.faction) continue;
      const dx = o.position.x - a.position.x;
      const dz = o.position.z - a.position.z;
      if (dx * dx + dz * dz <= r2) return true;
    }
    return false;
  }

  private setState(b: Brain, s: AiState): void {
    if (b.state === s) return;
    b.state = s;
    b.stateAge = 0;
    // You cannot crouch-walk to the next piece of cover. Leaving `settled`
    // set would also stop the next arrival from re-crouching.
    if (s !== 'engage') b.settled = false;
    // A state change invalidates the plan that belonged to the old state.
    if (s !== 'engage') b.peeking = false;
    b.repathIn = 0;
    // Release cover on any state change except the move TO it.
    //
    // `b.cover` used to be assigned in one place and cleared nowhere, and
    // doEngage only calls seekCover when it is null — so an actor took cover
    // exactly once per mission and then fought standing in the open forever,
    // while permanently reserving that node against everyone else.
    if (s !== 'reposition' && s !== 'engage') this.releaseCover(b);
  }

  private releaseCover(b: Brain): void {
    if (b.cover) b.cover.claimedBy = -1;
    b.cover = null;
  }

  fixedUpdate(step: number, _ctx: EngineContext): void {
    this.stats.pathsThisFrame = 0;
    this.stats.thinking = 0;
    this.stats.engaging = 0;
    this.pathQueue.length = 0;

    const player = this.actors.get(0);
    for (const a of this.actors.all) {
      const b = a.brain as Brain | null;
      if (!b || !a.alive || a.faction === 'player') continue;
      this.stats.thinking++;
      this.think(a, b, player ?? null, step);
      if (b.state === 'engage') this.stats.engaging++;
    }

    // Serve the path queue, closest-need first, up to the frame's budget.
    //
    // The budget is per rendered FRAME, and this method is a fixed step: the
    // engine runs up to five of those in one frame, so spending the whole
    // budget here spent it five times over and a bad frame could pay for ten
    // path solves at once. `update` refills it, once, per frame.
    // Budget in SOLVES PER SECOND, accrued on the fixed clock.
    //
    // Per-fixed-step let a catch-up frame pay for ten solves at once.
    // Per-rendered-frame fixed that and created the opposite problem: it cut
    // throughput in half at 30 fps and to a fifth in a five-step frame — the
    // AI repathed least often exactly when the machine was already struggling
    // and the actors most needed to keep up. A credit that accrues with time
    // is independent of both.
    this.pathCredits = Math.min(PATH_CREDIT_CAP, this.pathCredits + step * PATHS_PER_SECOND);
    this.pathQueue.sort((x, y) => (this.pathUrgency(y) - this.pathUrgency(x)));
    for (const id of this.pathQueue) {
      if (this.pathCredits < 1) break;
      const a = this.actors.get(id);
      const b = a?.brain as Brain | null;
      if (a && b && b.goal) { this.repath(a, b); this.pathCredits -= 1; }
    }
  }

  /**
   * Who gets the path solve when more actors want one than the budget allows.
   *
   * The queue used to be served in actor-id order despite a comment claiming
   * "closest-need first", so low-numbered guards won every contested step and
   * a high-numbered one under fire could wait indefinitely.
   */
  private pathUrgency(id: number): number {
    const b = this.actors.get(id)?.brain as Brain | null;
    if (!b) return -1;
    return b.state === 'engage' || b.state === 'reposition' ? 3
      : b.state === 'flee' ? 2
      : b.state === 'search' ? 1 : 0;
  }

  // -----------------------------------------------------------------------
  // Per-actor reasoning
  // -----------------------------------------------------------------------

  private think(a: Actor, b: Brain, player: Actor | null, step: number): void {
    b.stateAge += step;
    b.senseIn -= step;
    b.repathIn = Math.max(0, b.repathIn - step);
    b.fireCooldown = Math.max(0, b.fireCooldown - step);
    b.burstPause = Math.max(0, b.burstPause - step);
    b.doorCooldown = Math.max(0, b.doorCooldown - step);
    b.lostFor += step;

    // Shut the door behind you — but only if nothing is happening. Nobody
    // closes a door in a firefight, and the player has to be able to tell the
    // difference between "a guard walked through here" and "a guard is coming
    // back through here".
    if (b.doorBehind >= 0) {
      b.doorCloseIn -= step;
      if (b.state === 'engage' || b.state === 'reposition' || b.state === 'flee') {
        b.doorBehind = -1;
      } else if (b.doorCloseIn <= 0) {
        const w = services.tryGet('world') as unknown as
          { doors?: { close(id: number, by?: number): boolean } } | undefined;
        w?.doors?.close(b.doorBehind, a.id);
        b.doorBehind = -1;
      }
    }

    // Alertness bleeds off, but never all the way back to oblivious once the
    // actor has real evidence — a guard who saw a body does not forget it.
    const floor = b.believedPos ? 0.22 : 0;
    b.alertness = Math.max(floor, b.alertness - step * 0.045);

    // Suppression: being shot at degrades everything.
    if (a.suppressedFor > 0) {
      b.aimError += step * 0.9;
      b.morale -= step * 0.10;
    }
    // Pain and injury cost nerve continuously.
    b.morale = clamp01(b.morale - step * a.pain * 0.06);

    // ...and nerve comes BACK. Every write to morale used to be a
    // subtraction, and suppression alone costs 0.10/s, so about nine seconds
    // of cumulative suppression broke any enemy in the game regardless of
    // skill or how the fight was going. Spraying at a wall routed the
    // garrison. Recovery is gated on actually being safe: not suppressed, not
    // badly hurt, and not alone.
    if (a.suppressedFor <= 0 && a.pain < 0.35 && this.hasNearbyAlly(a, 15)) {
      b.morale = clamp01(b.morale + step * 0.035);
    }

    if (b.senseIn <= 0) {
      b.senseIn = 0.17;
      this.sense(a, b, player);
    }

    switch (b.state) {
      case 'idle':      this.doIdle(a, b, step); break;
      case 'patrol':    this.doPatrol(a, b, step); break;
      case 'alert':     this.doAlert(a, b, step); break;
      case 'search':    this.doSearch(a, b, step); break;
      case 'engage':    this.doEngage(a, b, player, step); break;
      case 'reposition':this.doReposition(a, b, step); break;
      case 'flee':      this.doFlee(a, b, step); break;
      case 'surrender': break;
    }

    if (b.state !== 'surrender' && b.state !== 'flee') {
      // Breaking point. Not a cliff: a shaken enemy fights worse for a while
      // before it goes, which is what makes suppression worth doing.
      if (b.morale <= 0.12) {
        const surrendered = a.pain > 0.5 || b.morale <= 0.02;
        this.setState(b, surrendered ? 'surrender' : 'flee');
        if (surrendered) {
          // The registry has to know, or `hostilesNear` keeps returning this
          // actor as a live threat and nothing that queries it — targeting,
          // mission completion, the HUD — ever learns they gave up.
          this.actors.surrender?.(a);
          a.velocity.set(0, 0, 0);
        }
        bus.emit('ai:broke', { actorId: a.id, surrendered });
      }
    }

    if (b.state !== 'surrender') this.advance(a, b, step);
  }

  /**
   * Vision.
   *
   * A cone plus a real occlusion test, with the cone widening as alertness
   * rises — a switched-on guard scans, a bored one stares ahead. Distance
   * limits fall off with light level so night actually matters.
   */
  private sense(a: Actor, b: Brain, player: Actor | null): void {
    if (!player || !player.alive) return;
    const world = services.tryGet('world');
    if (!world) return;

    const env = services.tryGet('environment') as unknown as
      { time?: { ambientLightLevel: number } } | undefined;
    const light = clamp01(env?.time?.ambientLightLevel ?? 1);

    // A lit weapon torch is the loudest thing the player carries.
    //
    // Without this the torch would be free: perfect visibility at night at no
    // cost, which is not a decision. With it, switching on roughly doubles the
    // range you can be picked up from in the dark and narrows the reaction
    // window — and, because it scales with how DARK it is, the same torch
    // costs you almost nothing at dusk and gives you away completely at 0200.
    const torch = services.tryGet('weaponLight')?.exposure ?? 0;
    const lit = light + torch * (1 - light) * 0.85;

    const maxRange = lerp(26, 95, lit) * lerp(0.75, 1.15, a.skill);
    const d = this.dist(a.position, player.position);
    if (d > maxRange) { this.loseSight(b); return; }

    // Facing cone. Half-angle from 42 degrees relaxed to 78 alert.
    this.tmpDir.set(
      player.position.x - a.position.x, 0, player.position.z - a.position.z,
    ).normalize();
    const facing = this.tmpA.set(a.forward.x, 0, a.forward.z).normalize();
    const cosLimit = Math.cos(lerp(0.73, 1.36, b.alertness));
    if (facing.dot(this.tmpDir) < cosLimit) { this.loseSight(b); return; }

    // Occlusion. Two samples, and NEITHER of them is the target's feet.
    //
    // `Actor.position` is at the feet, so a ray aimed there runs straight into
    // the floor over any distance — measured false at nine metres of open
    // ground with the guard staring right at the player. Sampling the head and
    // the chest also means a target behind a low wall is still spotted by the
    // head, which is the behaviour a player expects when they peek.
    // From the shared table, not a fourth set of hardcoded numbers. This line
    // used to carry its own 0.32 / 0.62, which agreed with neither the
    // renderer nor the hit-region maths.
    const stanceScale = (STANCE_HEIGHT[player.stance as StanceKey] ?? STANCE_HEIGHT.stand)
      / STANCE_HEIGHT.stand;
    this.tmpA.set(a.position.x, a.position.y + 1.55, a.position.z);
    const head = this.tmpB.set(
      player.position.x, player.position.y + 1.62 * stanceScale, player.position.z,
    );
    let visible = world.lineOfSight(this.tmpA, head, [a.id, 0]);
    if (!visible) {
      const chest = this.tmpB.set(
        player.position.x, player.position.y + 1.05 * stanceScale, player.position.z,
      );
      visible = world.lineOfSight(this.tmpA, chest, [a.id, 0]);
    }
    if (!visible) { this.loseSight(b); return; }

    // Seen. Crouching and going slowly buy real time before detection.
    b.lostFor = 0;
    b.targetId = player.id;
    b.believedPos = (b.believedPos ?? new THREE.Vector3()).copy(player.position as THREE.Vector3);
    b.sightTime += 0.17;
    b.alertness = clamp01(b.alertness + 0.34);

    if (b.state !== 'engage') {
      // Reaction time: 0.75 s for a novice caught cold, 0.18 s for a switched-on
      // veteran. This window is the entire reward for moving first — and a
      // torch beam sweeping a wall hands most of it back.
      b.reaction = lerp(0.75, 0.18, clamp01(a.skill * 0.6 + b.alertness * 0.4 + torch * 0.35));
      b.aimError = lerp(0.19, 0.07, a.skill);
      this.setState(b, 'engage');
      bus.emit('ai:spotted', { actorId: a.id, targetId: player.id });
    }
  }

  private loseSight(b: Brain): void {
    b.sightTime = 0;
  }

  // --- states ------------------------------------------------------------

  private doIdle(a: Actor, b: Brain, step: number): void {
    // Look around slowly so an idle guard is not a statue.
    this.setFacing(a, this.facingOf(a) + Math.sin(b.stateAge * 0.4) * step * 0.35);
  }

  private doPatrol(a: Actor, b: Brain, step: number): void {
    if (b.route.length < 2) { this.setState(b, 'idle'); return; }
    if (b.dwell > 0) {
      b.dwell -= step;
      this.setFacing(a, this.facingOf(a) + Math.sin(b.stateAge) * step * 0.5);
      return;
    }
    const target = b.route[b.routeIndex];
    if (!b.goal || this.dist(b.goal, target) > 0.5) this.want(a, b, target);
    if (this.dist(a.position, target) < 1.6) {
      b.routeIndex = (b.routeIndex + 1) % b.route.length;
      b.dwell = this.rng.range(1.5, 4.5);
      b.goal = null;
    } else if (b.stateAge > 26) {
      // Stuck. Give up on this leg rather than grinding into a wall for the
      // rest of the mission.
      b.routeIndex = (b.routeIndex + 1) % b.route.length;
      b.goal = null;
      b.stateAge = 0;
    }
  }

  private doAlert(a: Actor, b: Brain, step: number): void {
    // Turn toward whatever was heard and hold, rather than charging it. This
    // is the beat that lets a player who made one noise recover.
    if (b.believedPos) {
      const want = Math.atan2(b.believedPos.x - a.position.x, b.believedPos.z - a.position.z);
      this.setFacing(a, this.turnToward(this.facingOf(a), want, step * 2.6));
    }
    if (b.stateAge > lerp(4.5, 1.6, b.alertness)) {
      this.setState(b, b.alertness > 0.55 ? 'search' : 'patrol');
    }
  }

  private doSearch(a: Actor, b: Brain, step: number): void {
    const nav = services.tryGet('nav');
    if (!b.believedPos || !nav) { this.setState(b, 'patrol'); return; }

    if (b.dwell > 0) {
      b.dwell -= step;
      this.setFacing(a, this.facingOf(a) + step * 1.4);   // sweep before moving on
      return;
    }
    if (!b.goal) {
      // Search outward from the last known position, not at it — the player
      // has moved, and walking to the exact spot is what makes an AI look
      // scripted.
      const spread = Math.min(16, 4 + b.stateAge * 1.2);
      b.goal = nav.randomPointNear(b.believedPos, spread) as THREE.Vector3 | null
        ?? b.believedPos.clone();
      this.want(a, b, b.goal);
    } else if (this.dist(a.position, b.goal) < 1.8) {
      b.goal = null;
      b.dwell = this.rng.range(1.2, 2.8);
    }
    // Give up eventually and go back to work.
    if (b.stateAge > 34) {
      b.believedPos = null;
      this.setState(b, b.route.length > 1 ? 'patrol' : 'idle');
    }
  }

  private doEngage(a: Actor, b: Brain, player: Actor | null, step: number): void {
    if (!player || !player.alive) { this.setState(b, 'patrol'); return; }
    const hasSight = b.lostFor < 0.35;

    if (b.believedPos) {
      const want = Math.atan2(b.believedPos.x - a.position.x, b.believedPos.z - a.position.z);
      this.setFacing(a, this.turnToward(this.facingOf(a), want, step * lerp(3.2, 7.5, a.skill)));
    }

    if (!hasSight) {
      // Lost sight — but not the fight.
      //
      // This used to return immediately, so the instant you broke line of
      // sight every gun on the map went quiet and stayed quiet. That is what
      // makes peeking free, and free peeking is most of what "the AI is
      // braindead" actually means. Real opposition keeps rounds going into
      // the doorway you disappeared through for a few seconds, which is what
      // makes you pay for the angle you just took.
      // The budget is in SECONDS OF ELAPSED TIME, so it has to be spent every
      // step. Decrementing it only on the steps that fired meant a 3-round
      // burst cost 0.05 s of a 2 s budget per 0.7-2.2 s of real time — the
      // variable would have taken a minute or two to run out and was doing
      // nothing at all.
      b.suppressFor = Math.max(0, b.suppressFor - step);
      if (b.believedPos && b.suppressFor > 0 && b.reaction <= 0
        && b.fireCooldown <= 0 && b.burstPause <= 0) {
        // Wide, because they genuinely cannot see the target. This is area
        // fire, not marksmanship.
        this.shootAt(a, b, b.believedPos, b.aimError * 3.4 + 0.05);
      }
      if (b.lostFor > lerp(3.5, 1.4, 1 - b.alertness)) this.setState(b, 'search');
      return;
    }
    // Sight regained: bank a few seconds of area fire for the next time it
    // goes away.
    b.suppressFor = lerp(1.4, 3.2, a.skill);

    b.reaction = Math.max(0, b.reaction - step);
    // Aim converges the longer the target is held, down to a skill floor.
    const floor = lerp(0.055, 0.012, a.skill);
    b.aimError = Math.max(floor, damp(b.aimError, floor, 1.6, step));

    // Get down behind the cover we came here for.
    //
    // Cover was verified at 1.0 m and then occupied standing, firing from
    // 1.5 m — half a metre above the height that qualified it as cover in the
    // first place, so every enemy "in cover" was fully exposed and the whole
    // cover system bought them nothing.
    if (b.cover && !b.settled && this.dist(a.position, b.cover.position) < 1.4) {
      b.settled = true;
      this.actors.setStance(a, 'crouch');
      b.peekIn = this.rng.range(0.5, 1.3);
    }

    // ...and then POP UP TO SHOOT.
    //
    // Crouching behind cover fixed being exposed and created something worse:
    // a crouched muzzle sits at feet + 1.09, cover is only accepted when the
    // threat cannot see feet + 1.00, and the cover graph actively PREFERS
    // taller cover — so every round an enemy in good cover fired went into the
    // crate in front of it. `hit.actorId` was never the player, so no damage,
    // and the impact was nowhere near them, so not even suppression. Enemies
    // who successfully took cover became completely harmless, which is exactly
    // backwards.
    //
    // So cover is a cycle, not a posture: down behind it, up to fire a burst,
    // down again. That is what real fire-and-movement looks like, it gives the
    // player a rhythm to read and a window to shoot into, and it is the only
    // way "took cover" and "is dangerous" are both true.
    if (b.settled) {
      b.peekIn -= step;
      if (b.peekIn <= 0) {
        if (a.stance === 'crouch') {
          // Up for a burst.
          this.actors.setStance(a, 'stand');
          b.peekIn = this.rng.range(0.9, 1.8);
        } else {
          this.actors.setStance(a, 'crouch');
          b.peekIn = this.rng.range(0.7, 1.6);
        }
      }
      b.peeking = a.stance !== 'crouch';
    }

    // Re-evaluate cover when it stops being cover, not on a stopwatch.
    //
    // A flat 4.5 s timer meant an actor abandoned perfectly good cover on
    // schedule, walked to another node, and came back — visibly commuting
    // rather than fighting, on a cycle you could set a watch by. Now the test
    // is the thing that actually matters: can the threat see me here?
    b.coverAge += step;
    if (b.cover && b.coverAge > 1.5 && this.coverCompromised(a, b)) {
      this.releaseCover(b);
      b.settled = false;
      b.coverAge = 0;
    }
    if (!b.cover && b.stateAge > 0.6) this.seekCover(a, b);

    // Fire only when the MUZZLE has the shot, not when the eyes do.
    //
    // Perception looks from feet + 1.55 and the weapon fires from feet +
    // 1.5 * stance — so a crouched actor could see over its cover and not
    // shoot over it. Checking the actual firing line means an enemy holds
    // fire while it is down and takes the shot when it comes up, which is
    // both correct and what makes the peek cycle above legible.
    if (b.reaction <= 0 && b.fireCooldown <= 0 && b.burstPause <= 0 && this.muzzleClear(a, player)) {
      this.shoot(a, b, player);
    }
  }

  /** Can this actor's weapon, at its current stance, actually see the target? */
  private muzzleClear(a: Actor, target: Actor): boolean {
    const world = services.tryGet('world');
    if (!world) return false;
    const own = (STANCE_HEIGHT[a.stance as StanceKey] ?? STANCE_HEIGHT.stand)
      / STANCE_HEIGHT.stand;
    const theirs = (STANCE_HEIGHT[target.stance as StanceKey] ?? STANCE_HEIGHT.stand)
      / STANCE_HEIGHT.stand;
    this.tmpA.set(a.position.x, a.position.y + 1.5 * own, a.position.z);
    this.tmpB.set(target.position.x, target.position.y + 1.05 * theirs, target.position.z);
    return world.lineOfSight(this.tmpA, this.tmpB, [a.id, 0]);
  }

  /**
   * Push open an unlocked door directly ahead.
   *
   * Deliberately cheap and deliberately dumb: a proximity test and a facing
   * test, at most one door per actor per step. Anything cleverer (queuing,
   * stacking, holding a door for the actor behind) belongs in squad
   * behaviour, and none of that matters while the answer to "can they follow
   * me through here" is still no.
   */
  private tryDoor(a: Actor, b: Brain, sx: number, sz: number): void {
    if (b.doorCooldown > 0) return;
    const world = services.tryGet('world') as unknown as {
      doors?: {
        nearest(p: THREE.Vector3, r?: number): {
          id: number; locked?: boolean; openAmount: number; yaw: number;
        } | null;
        open(id: number, by?: number, fast?: boolean): boolean;
        close(id: number, by?: number): boolean;
      };
    };
    const doors = world?.doors;
    if (!doors) return;
    // Look a stride ahead, not at our own feet.
    this.tmpB.set(a.position.x + sx * 0.9, a.position.y + 0.9, a.position.z + sz * 0.9);
    const d = doors.nearest(this.tmpB, 1.0);
    if (!d || d.locked || d.openAmount > 0.5) return;

    // Only a door we are actually going THROUGH.
    //
    // A 1.1 m probe with a 1.5 m radius reached 2.6 m and had no facing test,
    // so a patrolling guard shouldered open every door within two and a half
    // metres of its route whether or not it was heading for one. Over a few
    // minutes every unlocked door on the map ended up standing open, which
    // destroys the player's main stealth tool — and a door the player shut in
    // a pursuer's face was reopened 1.2 s later, on a loop, forever.
    //
    // The test: our travel direction has to be within about 50 degrees of the
    // doorway's own normal. The stored `yaw` is the WALL's, so the normal is
    // perpendicular to it.
    const dnx = Math.sin(d.yaw), dnz = Math.cos(d.yaw);
    if (Math.abs(sx * dnx + sz * dnz) < 0.64) return;

    doors.open(d.id, a.id, b.state === 'engage' || b.state === 'reposition');
    b.doorCooldown = 1.6;
    // Remember it, so an actor that is not fighting closes it behind itself.
    b.doorBehind = d.id;
    b.doorCloseIn = 2.4;
  }

  /** True when the believed threat position can see this actor's chest. */
  private coverCompromised(a: Actor, b: Brain): boolean {
    const world = services.tryGet('world');
    if (!world || !b.believedPos) return false;
    this.tmpA.set(a.position.x, a.position.y + 1.0, a.position.z);
    this.tmpB.set(b.believedPos.x, b.believedPos.y + 1.5, b.believedPos.z);
    return world.lineOfSight(this.tmpA, this.tmpB, [a.id, 0]);
  }

  private doReposition(a: Actor, b: Brain, step: number): void {
    // Shoot on the move.
    //
    // This state contained no fire at all, and an engaged actor enters it
    // within 0.6 s of first contact and stays 1.5-2.5 s — so a third of every
    // engagement was spent watching enemies jog silently between bits of
    // cover. Moving fire is inaccurate fire, and it should be: the point is
    // that the player is under pressure the whole way, not that it hits.
    if (b.believedPos && b.reaction <= 0 && b.fireCooldown <= 0 && b.burstPause <= 0
      && b.lostFor < 1.2 && b.speed > 0.5) {
      this.shootAt(a, b, b.believedPos, b.aimError * 2.6 + 0.03);
    }

    if (!b.goal || this.dist(a.position, b.goal) < 1.2) {
      b.goal = null;
      this.setState(b, b.believedPos ? 'engage' : 'search');
    } else if (b.stateAge > 8) {
      this.setState(b, 'engage');
    }
  }

  private doFlee(a: Actor, b: Brain, _step: number): void {
    const nav = services.tryGet('nav');
    if (!b.goal && nav && b.believedPos) {
      // Away from the threat, as far as the navmesh allows.
      this.tmpDir.set(a.position.x - b.believedPos.x, 0, a.position.z - b.believedPos.z).normalize();
      this.tmpA.set(
        a.position.x + this.tmpDir.x * 28, a.position.y, a.position.z + this.tmpDir.z * 28,
      );
      b.goal = nav.nearestNavPoint(this.tmpA, 14) as THREE.Vector3 | null;
      if (b.goal) this.want(a, b, b.goal);
    }
    if (b.goal && this.dist(a.position, b.goal) < 2) b.goal = null;

    // Fleeing has to END. This state contained no setState at all, and the
    // morale check that could have escalated it skips actors already fleeing,
    // so a routed enemy ran in a straight line forever and then stood
    // motionless once the navmesh ran out.
    if (b.stateAge > 9) {
      if (a.pain > 0.4 || b.morale <= 0.02) {
        this.setState(b, 'surrender');
        this.actors.surrender?.(a);
        bus.emit('ai:broke', { actorId: a.id, surrendered: true });
      } else {
        // Rallied. Comes back shaken, not restored.
        b.morale = 0.35;
        b.believedPos = null;
        this.setState(b, b.route.length > 1 ? 'patrol' : 'idle');
      }
    }
  }

  // --- combat ------------------------------------------------------------

  /**
   * Fire one round at the target.
   *
   * Enemies do not run the player's full weapon simulation — twenty actors
   * doing sub-stepped ballistics would cost more than everything else in the
   * frame combined. They fire a single hitscan with an error cone, which is
   * indistinguishable at these ranges and about a hundredth of the cost.
   */
  private shoot(a: Actor, b: Brain, target: Actor): void {
    const world = services.tryGet('world');
    if (!world || !b.believedPos) return;

    // Fresh burst?
    if (b.burst <= 0) b.burst = 2 + Math.floor(this.rng.range(0, 3));

    // Aim centre-of-mass, not at the feet — and account for STANCE.
    //
    // `sense()` scaled for stance and `shoot()` did not, so against a prone
    // player whose chest is at 0.34 m the AI aimed a flat 1.05 m: 0.71 m high,
    // which at 20 m is 1.37 sigma off before dispersion even applies. Lying
    // down made the player effectively immune at every range.
    const stance = (STANCE_HEIGHT[target.stance as StanceKey] ?? STANCE_HEIGHT.stand)
      / STANCE_HEIGHT.stand;
    _aimPoint.set(
      target.position.x,
      target.position.y + 1.05 * stance,
      target.position.z,
    );
    this.shootAt(a, b, _aimPoint, null, target);
  }

  /**
   * Put rounds through a point in the world.
   *
   * Split out of `shoot` so that fire at a *believed* position — moving fire
   * and area fire into a doorway the target just vanished through — goes
   * through exactly the same muzzle, the same suppression accounting and the
   * same burst discipline as aimed fire, rather than being a second
   * implementation that drifts.
   */
  private shootAt(
    a: Actor, b: Brain, at: THREE.Vector3, spreadOverride: number | null, target?: Actor,
  ): void {
    const world = services.tryGet('world');
    if (!world) return;
    if (b.burst <= 0) b.burst = 2 + Math.floor(this.rng.range(0, 3));

    // The muzzle sits where THIS actor's shoulder actually is. Firing from a
    // flat 1.5 m while crouched behind a 1.1 m wall put every round through
    // the cover the actor was hiding behind — and told the player the cover
    // was worthless, because from their side it looked like it was.
    const own = (STANCE_HEIGHT[a.stance as StanceKey] ?? STANCE_HEIGHT.stand)
      / STANCE_HEIGHT.stand;
    this.tmpA.set(a.position.x, a.position.y + 1.5 * own, a.position.z);

    this.tmpDir.set(at.x - this.tmpA.x, at.y - this.tmpA.y, at.z - this.tmpA.z);
    const range = this.tmpDir.length();
    this.tmpDir.normalize();

    // Error grows with range, with the actor's pain, and while suppressed.
    const spread = (spreadOverride ?? b.aimError)
      * (1 + a.pain * 1.4)
      * (1 + Math.min(1.5, a.suppressedFor * 0.5))
      * lerp(0.8, 1.5, clamp01(range / 60));
    this.tmpDir.x += this.rng.gaussian() * spread;
    this.tmpDir.y += this.rng.gaussian() * spread * 0.75;
    this.tmpDir.z += this.rng.gaussian() * spread;
    this.tmpDir.normalize();

    const hit = world.raycast(this.tmpA, this.tmpDir, { maxDistance: 140, ignoreActors: [a.id] });
    bus.emit('ai:fired', {
      actorId: a.id,
      from: this.tmpA.clone(),
      dir: this.tmpDir.clone(),
      hit: hit ? hit.point.clone() : null,
    });

    // `target` is only supplied by aimed fire. Gating the damage on it meant a
    // round from moving fire or from area fire could strike the player dead
    // centre and do nothing at all — the tracer hit, the hitmarker did not,
    // and the two behaviours the last pass added to stop enemies being
    // harmless were themselves harmless.
    const victim = target ?? this.actors.get(0);
    if (hit?.actorId === 0 && victim) {
      // The region comes from WHERE THE ROUND LANDED, not from a dice roll.
      //
      // This used to trace the ray, confirm the hit, and then roll for the
      // region independently — so an enemy who hit your boot had an 11% chance
      // of scoring a headshot, and a head hit is unconditionally lethal
      // (16-27 damage times the 4.2 head multiplier against a 35 HP head
      // limb). That was a hidden 8% per-second instant-death roll with no
      // relationship to the geometry and no way for the player to influence
      // it by taking cover correctly.
      const region = this.actors.regionForHit(victim, hit.point, this.tmpDir);
      this.actors.applyDamage(
        0, this.rng.range(16, 27), 'ballistic', region, a.id, this.tmpDir.clone(),
      );
    } else {
      // A miss that lands near the player still suppresses. This is what makes
      // an enemy dangerous even when it cannot shoot straight — and it is the
      // entire point of the area fire that now comes through here.
      const miss = hit && victim ? this.dist(hit.point, victim.position) : 99;
      if (miss < 3.5) bus.emit('actor:suppressed', { actorId: 0, seconds: 0.9 });
    }

    // Cyclic rate and burst discipline.
    b.burst--;
    b.fireCooldown = this.rng.range(0.085, 0.115);
    if (b.burst <= 0) {
      b.burstPause = lerp(1.35, 0.42, a.skill) * this.rng.range(0.75, 1.4);
    }
  }

  /**
   * Find cover that actually blocks.
   *
   * The cover graph scores candidates by whether their outward normal points
   * at the threat, which is a good proxy but not a guarantee — it will happily
   * return a spot with clean line of sight to the shooter. Verifying with a
   * real occlusion test is cheap here because there are only a handful of
   * candidates, and it is the difference between an enemy taking cover and an
   * enemy standing next to cover.
   */
  private seekCover(a: Actor, b: Brain): void {
    const nav = services.tryGet('nav');
    const world = services.tryGet('world');
    if (!nav || !world || !b.believedPos) return;

    const candidates = nav.findCover(a.position, b.believedPos, 16);
    this.tmpB.set(b.believedPos.x, b.believedPos.y + 1.5, b.believedPos.z);
    for (const c of candidates) {
      if (c.claimedBy >= 0 && c.claimedBy !== a.id) continue;
      // Chest height at the cover position: if the threat can see that, it is
      // not cover.
      this.tmpA.set(c.position.x, c.position.y + 1.0, c.position.z);
      if (world.lineOfSight(this.tmpA, this.tmpB, [a.id, 0])) continue;
      this.releaseCover(b);
      c.claimedBy = a.id;
      b.cover = c;
      b.coverAge = 0;
      b.goal = new THREE.Vector3(c.position.x, c.position.y, c.position.z);
      this.want(a, b, b.goal);
      this.setState(b, 'reposition');
      return;
    }
  }

  // --- movement ----------------------------------------------------------

  /** Ask for a path to `to`, subject to the frame budget. */
  private want(a: Actor, b: Brain, to: Vec3): void {
    b.goal = (b.goal ?? new THREE.Vector3()).set(to.x, to.y, to.z);
    // Queue whenever there is no usable path, even during the re-path
    // cooldown. Returning early here set a goal without ever asking for a
    // route, and doPatrol then saw `dist(goal, target) === 0` and never asked
    // again — leaving the actor with a goal, an empty path and no way to get
    // one, standing motionless until the 26-second stuck timer fired.
    const stranded = b.path.length <= b.pathIndex;
    if (b.repathIn > 0 && !stranded) return;
    if (!this.pathQueue.includes(a.id)) this.pathQueue.push(a.id);
  }

  private repath(a: Actor, b: Brain): void {
    const nav = services.tryGet('nav');
    if (!nav || !b.goal) return;
    const t0 = performance.now();
    const path = nav.findPath(a.position, b.goal, 0.36);
    const ms = performance.now() - t0;
    this.pathMs.push(ms);
    if (this.pathMs.length > 60) this.pathMs.shift();
    this.stats.pathMsAvg = this.pathMs.reduce((s, v) => s + v, 0) / this.pathMs.length;
    this.stats.pathsThisFrame++;

    if (path.valid && path.points.length > 0) {
      b.path = path.points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    } else {
      // No route on the navmesh. Walk straight at the goal anyway: the
      // collision solver slides along walls, so the worst case is an actor
      // that scrapes a corner, and the alternative is one that stands
      // perfectly still forever. Posts near the map edge and on terraces are
      // routinely off-mesh, and standing still is what they were all doing.
      b.path = [new THREE.Vector3(b.goal.x, b.goal.y, b.goal.z)];
      this.stats.fallbackPaths++;
    }
    b.pathIndex = 0;
    // Re-plan on a timer rather than every frame. Chasing a moving target with
    // a fresh path every tick is both expensive and visibly jittery.
    b.repathIn = b.state === 'engage' ? 0.9 : 2.2;
  }

  /** Walk the current path. */
  private advance(a: Actor, b: Brain, step: number): void {
    const world = services.tryGet('world');
    if (!world) return;

    this.moveX = 0;
    this.moveZ = 0;

    // Retire every waypoint we are already past, in one go, and keep moving.
    //
    // This used to increment the index and then RETURN without moving, which
    // put a one-fixed-step dead stop at every single waypoint — and since the
    // navmesh is a 0.4 m grid, a corner is several waypoints in a row. The
    // result was exactly the stutter that reads as "braindead movement".
    while (b.path.length > b.pathIndex
      && Math.hypot(b.path[b.pathIndex].x - a.position.x, b.path[b.pathIndex].z - a.position.z) < 0.55) {
      b.pathIndex++;
    }

    if (b.path.length > b.pathIndex) {
      const node = b.path[b.pathIndex];
      const dx = node.x - a.position.x;
      const dz = node.z - a.position.z;
      const d = Math.max(1e-4, Math.hypot(dx, dz));

      // Steer at a blend of this waypoint and the next, so a corner is taken
      // as an arc rather than as two straight runs joined by a pivot.
      let sx = dx / d;
      let sz = dz / d;
      const next = b.path[b.pathIndex + 1];
      if (next) {
        const nx = next.x - a.position.x;
        const nz = next.z - a.position.z;
        const nd = Math.max(1e-4, Math.hypot(nx, nz));
        // Weight the lookahead in only as the current node gets close.
        const w = clamp01((2.4 - d) / 2.0) * 0.55;
        sx = sx * (1 - w) + (nx / nd) * w;
        sz = sz * (1 - w) + (nz / nd) * w;
        const sl = Math.max(1e-4, Math.hypot(sx, sz));
        sx /= sl; sz /= sl;
      }

      // Target speed for the state, then the actor's own bias, then two
      // brakes: wounded people are slower, and so is anyone about to arrive.
      let target = b.state === 'engage' || b.state === 'reposition' ? 4.4
        : b.state === 'flee' ? 5.2
        : b.state === 'search' ? 2.6
        : 1.5;
      target *= b.speedBias;
      target *= lerp(1, 0.55, clamp01(a.pain));
      // Only the LAST leg brakes for arrival; braking at an intermediate
      // waypoint is what made every path look like a series of hops.
      if (!next) target *= lerp(0.35, 1, clamp01(d / 2.2));

      // Accelerate and decelerate. Standing starts were instantaneous: 0 to
      // 4.4 m/s inside one 16 ms step, which no animation can cover and no
      // human does.
      const accel = target > b.speed ? 9 : 13;
      b.speed = damp(b.speed, target, accel, step);

      // Nobody crouch-walks between pieces of cover.
      if (b.speed > 0.7 && a.stance === 'crouch' && !b.settled) {
        this.actors.setStance(a, 'stand');
      }

      // Open the door you are walking into.
      //
      // The AI never touched a door. Every interior route it could path along
      // was one the player could shut behind them, and closing a door
      // genuinely ended a pursuit — which is a fine tactic in a stealth game
      // and a terrible bug in a firefight. Locked doors are still locked; this
      // only pushes open what a person would push open, and only when the
      // actor is actually moving at it.
      this.tryDoor(a, b, sx, sz);

      const vx = sx * b.speed;
      const vz = sz * b.speed;
      this.moveX = vx;
      this.moveZ = vz;

      const move = world.moveCharacter(
        a.position.x, a.position.y, a.position.z,
        vx * step, -9.81 * step * 0.5, vz * step,
        { radius: 0.36, height: 1.75, stepHeight: 0.42, minGroundNormalY: 0.55 },
      );
      a.position.set(move.x, move.y, move.z);

      // Face the direction of travel unless engaged, where the target wins.
      if (b.state !== 'engage') {
        this.setFacing(a, this.turnToward(this.facingOf(a), Math.atan2(sx, sz), step * 5));
      }
    } else {
      b.speed = damp(b.speed, 0, 13, step);
      // Not walking — settle onto whatever is directly underfoot.
      //
      // The search starts just below the actor rather than from the ground, so
      // a guard posted on a catwalk stays on the catwalk. Searching from the
      // bottom found the slab five metres below and teleported every elevated
      // post down to the warehouse floor, quietly deleting the vertical layer
      // the map is built around.
      const floor = world.floorAt(a.position.x, a.position.z, a.position.y + 0.4, 1.2, 0.5);
      if (Number.isFinite(floor)) a.position.y = floor;
    }
    // Velocity is what the rest of the game reads — footstep noise, the body
    // animator, and suppression all key off it.
    //
    // This used to read x and z from itself and call setLength, and nothing
    // ever gave an AI actor a direction, so setLength on a zero vector
    // returned zero: every enemy's velocity was exactly (0,0,0) for the whole
    // mission no matter how fast it was running. Enemies were completely
    // silent and the animator saw a map full of statues.
    a.velocity.set(this.moveX, 0, this.moveZ);
  }

  private turnToward(from: number, to: number, maxStep: number): number {
    let d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return from + clamp(d, -maxStep, maxStep);
  }
}
