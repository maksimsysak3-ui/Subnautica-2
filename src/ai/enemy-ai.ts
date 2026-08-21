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
import { STANCE_SCALE } from '../actors/humanoid';

export type AiState =
  | 'idle' | 'patrol' | 'alert' | 'search' | 'engage' | 'reposition' | 'flee' | 'surrender';

/** How much of a full alert an event is worth. */
const ALERT_GUNSHOT = 0.85;
const ALERT_FOOTSTEP = 0.30;
const ALERT_DOOR = 0.45;
const ALERT_BODY = 0.70;

/** Per-frame ceiling on path requests across ALL actors. */
const PATH_BUDGET_PER_FRAME = 2;

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
}

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
    for (const id of this.pathQueue.slice(0, PATH_BUDGET_PER_FRAME)) {
      const a = this.actors.get(id);
      const b = a?.brain as Brain | null;
      if (a && b && b.goal) this.repath(a, b);
    }
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
    b.lostFor += step;

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

    const maxRange = lerp(26, 95, light) * lerp(0.75, 1.15, a.skill);
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
    const stanceScale = player.stance === 'prone' ? 0.32 : player.stance === 'crouch' ? 0.62 : 1;
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
      // veteran. This window is the entire reward for moving first.
      b.reaction = lerp(0.75, 0.18, a.skill * 0.6 + b.alertness * 0.4);
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
      // Lost them. Hold the angle briefly — enemies that instantly break
      // contact are exploitable, and ones that never do are unfair.
      if (b.lostFor > lerp(3.5, 1.4, 1 - b.alertness)) this.setState(b, 'search');
      return;
    }

    b.reaction = Math.max(0, b.reaction - step);
    // Aim converges the longer the target is held, down to a skill floor.
    const floor = lerp(0.055, 0.012, a.skill);
    b.aimError = Math.max(floor, damp(b.aimError, floor, 1.6, step));

    // Take cover if we are in the open, and re-evaluate periodically: a
    // position that was cover when you took it stops being cover the moment
    // the threat moves, which is exactly what a flanking player is doing.
    b.coverAge += step;
    if (b.cover && b.coverAge > 4.5) {
      this.releaseCover(b);
      b.coverAge = 0;
    }
    if (!b.cover && b.stateAge > 0.6) this.seekCover(a, b);

    if (b.reaction <= 0 && b.fireCooldown <= 0 && b.burstPause <= 0) {
      this.shoot(a, b, player);
    }
  }

  private doReposition(a: Actor, b: Brain, step: number): void {
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

    this.tmpA.set(a.position.x, a.position.y + 1.5, a.position.z);
    // Aim centre-of-mass, not at the feet — and account for STANCE.
    //
    // `sense()` scaled for stance and `shoot()` did not, so against a prone
    // player whose chest is at 0.34 m the AI aimed a flat 1.05 m: 0.71 m high,
    // which at 20 m is 1.37 sigma off before dispersion even applies. Lying
    // down made the player effectively immune at every range.
    const stance = STANCE_SCALE[target.stance] ?? 1;
    this.tmpDir.set(
      target.position.x - this.tmpA.x,
      target.position.y + 1.05 * stance - this.tmpA.y,
      target.position.z - this.tmpA.z,
    );
    const range = this.tmpDir.length();
    this.tmpDir.normalize();

    // Error grows with range, with the actor's pain, and while suppressed.
    const spread = b.aimError
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

    if (hit?.actorId === 0) {
      // The region comes from WHERE THE ROUND LANDED, not from a dice roll.
      //
      // This used to trace the ray, confirm the hit, and then roll for the
      // region independently — so an enemy who hit your boot had an 11% chance
      // of scoring a headshot, and a head hit is unconditionally lethal
      // (16-27 damage times the 4.2 head multiplier against a 35 HP head
      // limb). That was a hidden 8% per-second instant-death roll with no
      // relationship to the geometry and no way for the player to influence
      // it by taking cover correctly.
      const region = this.actors.regionForHit(target, hit.point, this.tmpDir);
      this.actors.applyDamage(
        0, this.rng.range(16, 27), 'ballistic', region, a.id, this.tmpDir.clone(),
      );
    } else {
      // A miss that lands near the player still suppresses. This is what makes
      // an enemy dangerous even when it cannot shoot straight.
      const miss = hit ? this.dist(hit.point, target.position) : 99;
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

    let speed = 0;
    this.moveX = 0;
    this.moveZ = 0;
    if (b.path.length > b.pathIndex) {
      const node = b.path[b.pathIndex];
      const dx = node.x - a.position.x;
      const dz = node.z - a.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.55) {
        b.pathIndex++;
      } else {
        speed = b.state === 'engage' || b.state === 'reposition' ? 4.4
          : b.state === 'flee' ? 5.2
          : b.state === 'search' ? 2.6
          : 1.5;
        const inv = 1 / d;
        const vx = dx * inv * speed;
        const vz = dz * inv * speed;

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
          this.setFacing(a, this.turnToward(this.facingOf(a), Math.atan2(dx, dz), step * 5));
        }
      }
    } else {
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
