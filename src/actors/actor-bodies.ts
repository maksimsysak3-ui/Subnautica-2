/**
 * Minimal actor bodies.
 *
 * OWNED BY: Integration, on loan to the character-models team.
 *
 * This is deliberately crude: segmented low-poly boxes, not a rigged mesh. It
 * exists so that bullets have something to hit and the damage model can be
 * exercised end to end. The character team replaces `build()` with real
 * geometry; everything else here — the collider registration, the per-region
 * hit resolution, the faction palette — is the contract they inherit.
 *
 * The important part is that each body part is registered with the world as a
 * collider tagged with its `actorId`, so `world.raycast` resolves a hit on a
 * person the same way it resolves a hit on a wall, and ballistics needs no
 * special case for people.
 */

import * as THREE from 'three';
import type { System, EngineContext } from '../core/engine';
import { bus, type Faction } from '../core/events';
import { services } from '../core/contracts';
import type { ActorRegistry, Actor } from './actor-registry';

/** Silhouette palette. Civilians must never read as combatants at a glance. */
const FACTION_COLORS: Record<Faction, { body: number; gear: number; head: number }> = {
  player:    { body: 0x3d4a3a, gear: 0x2a2f2c, head: 0xa88b6d },
  cartel:    { body: 0x6d4a3a, gear: 0x241f1c, head: 0x9c7a58 },
  insurgent: { body: 0x5a5340, gear: 0x33302a, head: 0x8f7052 },
  pmc:       { body: 0x39423f, gear: 0x1e2422, head: 0xa38668 },
  syndicate: { body: 0x2f3644, gear: 0x191d24, head: 0x9d7f60 },
  militia:   { body: 0x53573c, gear: 0x2c2e22, head: 0x8a6c4f },
  // Bright, unarmoured, no rig. This is a life-or-death read.
  civilian:  { body: 0xb9b0a2, gear: 0xc9c2b4, head: 0xa88b6d },
};

interface Part {
  mesh: THREE.Mesh;
  /** Offset from the actor's feet, at standing scale. */
  y: number;
  height: number;
}

interface Body {
  group: THREE.Group;
  parts: Part[];
  actor: Actor;
}

export class ActorBodies implements System {
  readonly id = 'actorBodies';
  readonly order = 32;
  readonly initOrder = 50;
  readonly budgetMs = 1;

  private bodies = new Map<number, Body>();
  private root = new THREE.Group();
  private materials = new Map<number, THREE.MeshStandardMaterial>();

  init(_ctx: EngineContext): void {
    const render = services.get('render');
    render.scene.add(this.root);

    // Bodies appear and disappear with actors rather than being polled.
    bus.on('actor:spawned', ({ actorId }) => this.build(actorId));
    bus.on('actor:killed', ({ actorId }) => this.onDown(actorId));
    bus.on('actor:downed', ({ actorId }) => this.onDown(actorId));
  }

  private mat(color: number): THREE.MeshStandardMaterial {
    let m = this.materials.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, flatShading: true });
      this.materials.set(color, m);
    }
    return m;
  }

  private build(actorId: number): void {
    const actors = services.tryGet('actors') as unknown as ActorRegistry | undefined;
    const actor = actors?.get(actorId);
    // The player has no visible body; a first-person camera sits inside it.
    if (!actor || actorId === 0) return;

    const world = services.get('world') as unknown as {
      addCollider(m: THREE.Mesh, s: string, o?: { actorId?: number }): void;
      removeCollider(m: THREE.Mesh): void;
    };

    const c = FACTION_COLORS[actor.faction] ?? FACTION_COLORS.militia;
    const group = new THREE.Group();
    const parts: Part[] = [];

    const add = (w: number, h: number, d: number, y: number, color: number): void => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat(color));
      mesh.castShadow = true;
      mesh.position.y = y + h / 2;
      group.add(mesh);
      parts.push({ mesh, y, height: h });
      // Tagged with the actor id so a raycast resolves it as a person.
      world.addCollider(mesh, 'flesh', { actorId });
    };

    // Rough human proportions: 1.78 m, shoulders at 1.45, head from 1.58.
    add(0.34, 0.42, 0.22, 0.02, c.gear);   // hips
    add(0.44, 0.52, 0.26, 0.90, c.body);   // torso + rig bulk
    add(0.20, 0.24, 0.22, 1.56, c.head);   // head
    add(0.13, 0.62, 0.15, 0.02, c.gear);   // legs are one block for now
    // Arms sit slightly proud of the torso so the silhouette isn't a slab.
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 0.13), this.mat(c.body));
    armL.position.set(-0.28, 1.16, 0);
    armL.castShadow = true;
    group.add(armL);
    world.addCollider(armL, 'flesh', { actorId });
    parts.push({ mesh: armL, y: 0.9, height: 0.5 });

    const armR = armL.clone();
    armR.position.x = 0.28;
    group.add(armR);
    world.addCollider(armR, 'flesh', { actorId });
    parts.push({ mesh: armR, y: 0.9, height: 0.5 });

    this.root.add(group);
    actor.view = group;
    const body: Body = { group, parts, actor };
    this.bodies.set(actorId, body);
    // Place it immediately. Waiting for the next update() left every freshly
    // spawned actor's colliders sitting at the world origin, so shots aimed at
    // where the actor visibly was passed straight through.
    this.place(body, actor);
  }

  private onDown(actorId: number): void {
    const b = this.bodies.get(actorId);
    if (!b) return;
    // Fall over. Crude, but it reads instantly at distance, which is what
    // matters for confirming a kill.
    b.group.rotation.x = -Math.PI / 2 + 0.1;
  }

  private place(b: Body, a: Actor): void {
    b.group.position.copy(a.position);
    if (a.alive && !a.downed) {
      // Stance is expressed as a vertical squash, so a crouching enemy is a
      // genuinely smaller target rather than a shorter-looking one.
      const scale = a.stance === 'prone' ? 0.28 : a.stance === 'crouch' ? 0.66 : 1;
      b.group.scale.set(1, scale, 1);
      b.group.rotation.y = Math.atan2(a.forward.x, a.forward.z);
    }
    // Colliders are raycast in world space, so the transform has to be live
    // before anything queries them — not at the renderer's convenience.
    b.group.updateMatrixWorld(true);
  }

  update(_dt: number, _ctx: EngineContext): void {
    const actors = services.tryGet('actors');
    if (!actors) return;

    for (const [id, b] of this.bodies) {
      const a = actors.get(id);
      if (!a) continue;
      this.place(b, a as Actor);
    }
  }

  despawn(actorId: number): void {
    const b = this.bodies.get(actorId);
    if (!b) return;
    const world = services.get('world') as unknown as { removeCollider(m: THREE.Mesh): void };
    for (const p of b.parts) world.removeCollider(p.mesh);
    this.root.remove(b.group);
    this.bodies.delete(actorId);
  }

  dispose(): void {
    for (const id of [...this.bodies.keys()]) this.despawn(id);
    this.root.clear();
  }
}
