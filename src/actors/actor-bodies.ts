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
import {
  buildHumanoid, STANCE_HEIGHT, type HumanoidColors, type StanceKey,
} from './humanoid';

/**
 * Silhouette palette. Civilians must never read as combatants at a glance.
 *
 * Every value here is deliberately lifted. The previous palette rendered
 * bodies at luma 0.06-0.09 against asphalt at 0.117 — a 1.3:1 contrast ratio,
 * which is why the lower half of every figure disappeared into the ground.
 * `accent` is the shoulder band that breaks the figure up horizontally, and it
 * is the brightest thing on an actor by design.
 */
const FACTION_COLORS: Record<Faction, HumanoidColors> = {
  player:    { body: 0x55634f, gear: 0x3d453f, head: 0xb5987a, accent: 0x77836a },
  cartel:    { body: 0x8a6250, gear: 0x3b322c, head: 0xac8a66, accent: 0xa87f5e },
  insurgent: { body: 0x766c53, gear: 0x474338, head: 0x9f7f5e, accent: 0x8f8563 },
  pmc:       { body: 0x4e5a55, gear: 0x333c39, head: 0xb39a7e, accent: 0x6d7a74 },
  syndicate: { body: 0x454e60, gear: 0x2b3240, head: 0xad8f6d, accent: 0x5f6b80 },
  militia:   { body: 0x6d7252, gear: 0x424536, head: 0x9a7c5c, accent: 0x878c63 },
  // Bright, unarmoured, no rig. This is a life-or-death read.
  civilian:  { body: 0xc6bdaf, gear: 0xd4cdc0, head: 0xb5987a, accent: 0xd8d2c6 },
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
  /** The merged visible mesh. Absent for the player, who has none. */
  visual?: THREE.Mesh;
  /** Which stance the current geometry was built for. */
  stance?: StanceKey;
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

    // Anything spawned BEFORE this system initialised never fired an event we
    // were listening for. The player is exactly that case — the controller
    // registers itself as actor 0 at initOrder 30 and this runs at 50 — and
    // the consequence was silent and total: no hit volume, so every enemy
    // raycast passed through the player and the opposition could not do damage
    // at all. Sweeping the registry at startup makes the wiring independent of
    // who initialises first.
    const existing = services.tryGet('actors');
    if (existing) for (const a of existing.all) this.build(a.id);
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

  /**
   * An invisible hit volume for the player.
   *
   * One box rather than the per-limb rig the AI-visible actors get: incoming
   * fire picks its hit region statistically anyway, and a first-person player
   * has no visible limbs for a precise volume to correspond to. It lives in
   * the world's extra-collider list, which the custom raycaster walks
   * directly, so `visible = false` costs it nothing.
   */
  private buildPlayerHitVolume(actorId: number): void {
    const world = services.get('world') as unknown as {
      addCollider(m: THREE.Mesh, s: string, o?: { actorId?: number }): void;
    };
    const actors = services.tryGet('actors') as unknown as ActorRegistry | undefined;
    const actor = actors?.get(actorId) as Actor | undefined;
    if (!actor) return;

    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 1.75, 0.40),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    mesh.name = 'player:hitbox';
    mesh.visible = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    // Registry position is at the feet, so the box is raised to straddle them.
    mesh.position.y = 0.875;
    group.add(mesh);
    world.addCollider(mesh, 'flesh', { actorId });

    const body: Body = { group, parts: [{ mesh, y: 0, height: 1.75 }], actor };
    this.bodies.set(actorId, body);
    this.place(body, actor);
  }

  private build(actorId: number): void {
    const actors = services.tryGet('actors') as unknown as ActorRegistry | undefined;
    const actor = actors?.get(actorId);
    if (!actor) return;
    // The player gets no visible body — a first-person camera sits inside it —
    // but it still needs something to be SHOT. Without a collider tagged with
    // actor 0, every enemy raycast passes straight through the player and the
    // opposition is harmless no matter how well it aims.
    if (actorId === 0) { this.buildPlayerHitVolume(actorId); return; }

    const world = services.get('world') as unknown as {
      addCollider(m: THREE.Mesh, s: string, o?: { actorId?: number }): void;
      removeCollider(m: THREE.Mesh): void;
    };

    const c = FACTION_COLORS[actor.faction] ?? FACTION_COLORS.militia;
    const group = new THREE.Group();

    // The visible body: one merged, vertex-coloured geometry, one draw call.
    // The previous version used six separate meshes per actor, which at
    // thirteen hostiles was 78 draw calls — 31% of the whole frame — for 72
    // triangles each. This is 240 triangles in one draw.
    const visual = new THREE.Mesh(
      this.geometryFor(actor.faction, 'stand'), this.bodyMaterial());
    visual.castShadow = true;
    visual.receiveShadow = true;
    group.add(visual);

    // Colliders are SEPARATE from the visible mesh and deliberately coarse.
    //
    // Raycasting merged geometry means walking 240 triangles per shot per
    // actor; three boxes give the same answer for what the damage model
    // actually asks — which band was hit — at a fortieth of the cost. Their
    // bands line up with the hit regions in actor-registry so a shot that
    // looks like a headshot scores as one.
    const parts: Part[] = [];
    const collider = (w: number, h: number, d: number, y: number, z = 0): void => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      mesh.visible = false;
      mesh.position.set(0, y + h / 2, z);
      group.add(mesh);
      parts.push({ mesh, y, height: h });
      world.addCollider(mesh, 'flesh', { actorId });
    };
    collider(0.26, 0.30, 0.26, 1.49);   // head + helmet + neck
    collider(0.50, 0.62, 0.34, 0.87);   // torso, shoulders and arms
    collider(0.30, 0.87, 0.24, 0.00);   // legs and pelvis

    this.root.add(group);
    actor.view = group;
    const body: Body = { group, parts, actor, visual, stance: 'stand' };
    this.bodies.set(actorId, body);
    // Place it immediately. Waiting for the next update() left every freshly
    // spawned actor's colliders sitting at the world origin, so shots aimed at
    // where the actor visibly was passed straight through.
    this.place(body, actor);
  }

  /**
   * One shared material for every actor.
   *
   * Colour is a vertex attribute, so factions differ without differing
   * materials — which is what lets thirteen actors share one program and, with
   * merged geometry, one draw call each.
   */
  private sharedBody: THREE.MeshStandardMaterial | null = null;
  private bodyMaterial(): THREE.MeshStandardMaterial {
    if (!this.sharedBody) {
      this.sharedBody = new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.88, metalness: 0.03, flatShading: true,
      });
    }
    return this.sharedBody;
  }

  private onDown(actorId: number): void {
    const b = this.bodies.get(actorId);
    if (!b) return;
    // Fall over, hinged at the hip rather than at the ankles.
    //
    // Rotating the group — whose origin is at the FEET — swept the whole body
    // 1.8 m through the air about the ankle line, clipping any wall within
    // 1.8 m, and because the rotation is about world X every corpse on the map
    // ended up pointing world -Z regardless of which way it had been facing.
    // Rotating the visual mesh instead keeps the fall in the actor's own
    // frame, so a body falls the way it was standing.
    if (b.visual) {
      b.visual.rotation.x = -Math.PI / 2 + 0.12;
      b.visual.position.y = 0.28;
      b.visual.position.z = -0.55;
    }
    // Colliders drop to a prone band so a downed actor can still be shot, and
    // so nobody is hit by a hitbox standing where the body no longer is.
    for (const p of b.parts) p.mesh.position.y = 0.22;
    b.group.updateMatrixWorld(true);
  }

  private place(b: Body, a: Actor): void {
    b.group.position.copy(a.position);
    if (!a.alive || a.downed) {
      b.group.updateMatrixWorld(true);
      return;
    }

    b.group.rotation.set(0, Math.atan2(a.forward.x, a.forward.z), 0);

    // Stance swaps GEOMETRY. It does not scale and it does not translate.
    //
    // The previous implementation assigned `visual.scale.y` twice and the
    // second assignment cancelled the first, so crouch applied no squash at
    // all — only a 266 mm downward translation. A crouching actor was a
    // full-height standing figure with its boots below the concrete, 20% too
    // tall for a crouch. Prone scaled to 0.28 and dropped 0.563, which put
    // every vertex of a prone actor beneath the floor plane: prone actors were
    // completely invisible.
    const stance = (a.stance in STANCE_HEIGHT ? a.stance : 'stand') as StanceKey;
    if (b.visual && b.stance !== stance) {
      b.stance = stance;
      // No dispose: geometries are shared out of the cache.
      b.visual.geometry = this.geometryFor(a.faction, stance);
    }

    // Colliders track the posed height, so what you can hit is what you see.
    const h = STANCE_HEIGHT[stance];
    const f = h / STANCE_HEIGHT.stand;
    for (const p of b.parts) p.mesh.position.y = (p.y + p.height / 2) * f;

    b.group.updateMatrixWorld(true);
  }

  /**
   * Geometry cache, keyed by faction and stance.
   *
   * `buildHumanoid` was being called once per actor, so thirteen hostiles of
   * the same faction allocated thirteen byte-identical geometries. There are
   * seven factions and three stances, so twenty-one is the true upper bound
   * and most sessions touch four or five.
   */
  private geoCache = new Map<string, THREE.BufferGeometry>();
  private geometryFor(faction: Faction, stance: StanceKey): THREE.BufferGeometry {
    const key = `${faction}|${stance}`;
    let g = this.geoCache.get(key);
    if (!g) {
      g = buildHumanoid(FACTION_COLORS[faction] ?? FACTION_COLORS.militia, stance);
      this.geoCache.set(key, g);
    }
    return g;
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

  /**
   * Drop every body, disposing GPU resources.
   *
   * `despawn` only unregisters the collider and detaches the group — which is
   * right for one actor dying mid-mission, because the geometry is about to be
   * reused. On a map switch nothing is reused, so the merged humanoid
   * geometries have to be freed by hand or every switch leaks one per actor.
   */
  clearAll(): void {
    for (const [, b] of this.bodies) {
      // Not b.visual.geometry — that is shared out of geoCache and belongs to
      // it. Disposing it here would blank every other actor of the faction.
      for (const p of b.parts) p.mesh.geometry.dispose();
    }
    for (const id of [...this.bodies.keys()]) this.despawn(id);
    this.root.clear();
  }

  dispose(): void {
    this.clearAll();
  }
}
