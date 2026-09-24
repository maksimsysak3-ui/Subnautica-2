/**
 * Fragmentation grenades — for both sides.
 *
 * OWNED BY: Weapons / FX.
 *
 * ## Why the AI needed these
 * Without a way to reach behind cover, the correct play against every enemy
 * in the game was to find a wall and wait: they would suppress it, they would
 * peek at it, and they could never make you leave. A grenade is the answer
 * every reference title gives, and it is what turns "hold this corner
 * forever" into a decision with a clock on it. The player gets them too, on G,
 * three per deployment, because the same problem exists in reverse.
 *
 * ## What it does
 *  - real ballistic arc, bounces off the ground and off walls with loss
 *  - 3.2 s fuse from the throw, not from landing — a cooked throw is a
 *    decision, a long throw gives the target time
 *  - damage falls off with distance and is blocked by anything solid between
 *    the blast and the target's chest, so cover still matters
 *  - it is loud: every AI in earshot hears it
 *  - the only camera shake in the game that is allowed to be big, because it
 *    is the only event that should feel violent in the player's own body
 *
 * One point light, created once and never added or removed, does the flash —
 * changing the scene's light count recompiles every material in the level.
 */

import * as THREE from 'three';
import type { System, EngineContext } from '../core/engine';
import { services } from '../core/contracts';
import { bus } from '../core/events';

const FUSE = 3.2;
const RADIUS = 8.5;
const LETHAL = 3.0;
const GRAVITY = 9.81;
const MAX_LIVE = 8;

interface Live {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fuse: number;
  owner: number;
  resting: boolean;
}

interface Blast {
  mesh: THREE.Mesh;
  age: number;
}

export class Grenades implements System {
  readonly id = 'grenades';
  readonly order = 22;
  readonly initOrder = 78;
  readonly budgetMs = 0.3;

  /** How many the player is carrying. */
  playerCount = 3;

  private live: Live[] = [];
  private blasts: Blast[] = [];
  private geo = new THREE.IcosahedronGeometry(0.07, 0);
  private mat = new THREE.MeshStandardMaterial({ color: 0x3b4a32, roughness: 0.7, metalness: 0.2 });
  private blastGeo = new THREE.IcosahedronGeometry(1, 1);
  private flash!: THREE.PointLight;
  private flashLevel = 0;
  /** Accumulated view shake, radians. Decays every frame. */
  private shake = 0;
  private scene!: THREE.Scene;
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();

  init(_ctx: EngineContext): void {
    this.scene = services.get('render').scene;
    services.register('grenades', this);
    this.flash = new THREE.PointLight(0xffc680, 0, 40, 2);
    this.flash.castShadow = false;
    this.scene.add(this.flash);
  }

  /** Throw one. Returns false if too many are already in the air. */
  throw(from: THREE.Vector3, velocity: THREE.Vector3, owner: number, cooked = 0): boolean {
    if (this.live.length >= MAX_LIVE) return false;
    const mesh = new THREE.Mesh(this.geo, this.mat);
    mesh.castShadow = true;
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.live.push({ mesh, pos: from.clone(), vel: velocity.clone(), fuse: FUSE - cooked, owner, resting: false });
    bus.emit('grenade:thrown', { kind: 'frag', position: from.clone(), velocity: velocity.clone() });
    return true;
  }

  /**
   * Solve the throw velocity that lands at `target` from `from`, at a fixed
   * launch angle. Used by the AI; accurate to where they THINK you are, which
   * is not always where you are.
   */
  static lob(from: THREE.Vector3, target: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    const dx = target.x - from.x, dz = target.z - from.z;
    const d = Math.max(1, Math.hypot(dx, dz));
    const dy = target.y - from.y;
    const angle = 0.72;
    const c = Math.cos(angle), t = Math.tan(angle);
    const denom = 2 * c * c * (d * t - dy);
    const v = denom > 0.01 ? Math.sqrt((GRAVITY * d * d) / denom) : 12;
    const vh = Math.min(22, v) * c;
    return out.set((dx / d) * vh, Math.min(22, v) * Math.sin(angle), (dz / d) * vh);
  }

  /** The player's throw, from the camera, along the look direction. */
  playerThrow(): void {
    if (this.playerCount <= 0) {
      bus.emit('ui:notify', { text: 'NO GRENADES', kind: 'warn' });
      return;
    }
    const cam = services.get('render').camera;
    cam.getWorldDirection(this.tmp);
    this.tmp2.copy(cam.position).addScaledVector(this.tmp, 0.5);
    const v = this.tmp.clone().multiplyScalar(15).add(new THREE.Vector3(0, 3.2, 0));
    if (this.throw(this.tmp2, v, 0)) {
      this.playerCount--;
      bus.emit('ui:notify', { text: `FRAG OUT · ${this.playerCount} LEFT`, kind: 'warn' });
    }
  }

  /** Called on a map switch. */
  reset(): void {
    for (const g of this.live) this.scene.remove(g.mesh);
    for (const b of this.blasts) this.scene.remove(b.mesh);
    this.live.length = 0;
    this.blasts.length = 0;
    this.playerCount = 3;
    this.flashLevel = 0;
    this.flash.intensity = 0;
  }

  fixedUpdate(step: number, _ctx: EngineContext): void {
    const world = services.tryGet('world');
    if (!world) return;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const g = this.live[i];
      g.fuse -= step;
      if (!g.resting) {
        g.vel.y -= GRAVITY * step;
        // Walls: raycast the step and reflect off whatever is in the way.
        const len = g.vel.length() * step;
        if (len > 1e-4) {
          this.tmp.copy(g.vel).normalize();
          const hit = world.raycast(g.pos, this.tmp, { maxDistance: len + 0.08, ignoreActors: [] });
          if (hit && hit.normal) {
            const n = hit.normal;
            const vn = g.vel.dot(n as THREE.Vector3);
            g.vel.addScaledVector(n as THREE.Vector3, -2 * vn).multiplyScalar(0.42);
            g.pos.copy(hit.point).addScaledVector(n as THREE.Vector3, 0.08);
          } else {
            g.pos.addScaledVector(g.vel, step);
          }
        }
        const floor = (world as unknown as { floorAt(x: number, z: number, from: number): number })
          .floorAt(g.pos.x, g.pos.z, g.pos.y + 0.5);
        if (Number.isFinite(floor) && g.pos.y < floor + 0.07) {
          g.pos.y = floor + 0.07;
          if (Math.abs(g.vel.y) < 1.2) {
            g.vel.multiplyScalar(0.72);
            g.vel.y = 0;
            if (g.vel.lengthSq() < 0.05) g.resting = true;
          } else {
            g.vel.y = -g.vel.y * 0.34;
            g.vel.x *= 0.6; g.vel.z *= 0.6;
          }
        }
      }
      g.mesh.position.copy(g.pos);
      if (g.fuse <= 0) {
        this.detonate(g);
        this.scene.remove(g.mesh);
        this.live.splice(i, 1);
      }
    }
  }

  private detonate(g: Live): void {
    const world = services.tryGet('world');
    const actors = services.tryGet('actors') as unknown as {
      all: Iterable<{ id: number; alive: boolean; position: THREE.Vector3; stance: string }>;
      applyDamage(id: number, amount: number, type: string, region: string, source: number, dir: THREE.Vector3): void;
    } | undefined;

    const at = g.pos.clone();
    bus.emit('grenade:detonated', { kind: 'frag', position: at.clone(), radius: RADIUS });
    bus.emit('sound:emitted', { position: at.clone(), loudnessMeters: 140, kind: 'explosion', sourceId: g.owner });
    bus.emit('audio:oneShot', { id: 'explosion', position: at.clone(), volume: 1 });

    if (actors && world) {
      this.tmp.copy(at); this.tmp.y += 0.4;
      for (const a of actors.all) {
        if (!a.alive) continue;
        const chest = this.tmp2.set(a.position.x, a.position.y + (a.stance === 'prone' ? 0.25 : a.stance === 'crouch' ? 0.8 : 1.1), a.position.z);
        const d = chest.distanceTo(this.tmp);
        if (d > RADIUS) continue;
        // Anything solid between the blast and the chest stops it. Cover is
        // still cover — the grenade's job is to make you leave it, not to
        // make it worthless.
        if (!world.lineOfSight(this.tmp, chest, [a.id])) continue;
        const k = d < LETHAL ? 1 : 1 - (d - LETHAL) / (RADIUS - LETHAL);
        const dmg = 30 + 110 * k * k;
        const dir = chest.clone().sub(this.tmp).normalize();
        actors.applyDamage(a.id, dmg, 'fragmentation', d < 2 ? 'thorax' : 'stomach', g.owner, dir);
      }
    }

    // Flash and fireball.
    const mesh = new THREE.Mesh(this.blastGeo, new THREE.MeshBasicMaterial({
      color: 0xffc070, transparent: true, opacity: 1, depthWrite: false,
    }));
    mesh.position.copy(at);
    mesh.scale.setScalar(0.3);
    this.scene.add(mesh);
    this.blasts.push({ mesh, age: 0 });
    this.flash.position.copy(at).y += 0.6;
    this.flashLevel = 1;

    // Shake scaled by how close the player is.
    const cam = services.get('render').camera;
    const pd = cam.position.distanceTo(at);
    this.shake = Math.max(this.shake, Math.max(0, 1 - pd / 28) * 0.045);
  }

  update(dt: number, _ctx: EngineContext): void {
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i];
      b.age += dt;
      const t = b.age / 0.45;
      b.mesh.scale.setScalar(0.3 + t * 3.6);
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - t);
      (b.mesh.material as THREE.MeshBasicMaterial).color.setHSL(0.08, 1, 0.65 - t * 0.5);
      if (t >= 1) {
        this.scene.remove(b.mesh);
        (b.mesh.material as THREE.Material).dispose();
        this.blasts.splice(i, 1);
      }
    }
    this.flashLevel = Math.max(0, this.flashLevel - dt * 5.5);
    this.flash.intensity = this.flashLevel * this.flashLevel * 900;

    if (this.shake > 1e-4) {
      const engine = (window as unknown as { engine?: { get(id: string): unknown } }).engine;
      const player = engine?.get('player') as { addCameraOffset?(p: THREE.Vector3, r: THREE.Euler): void } | undefined;
      const s = this.shake;
      player?.addCameraOffset?.(new THREE.Vector3(0, 0, 0),
        new THREE.Euler((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s * 0.6));
      this.shake *= Math.exp(-dt * 7);
    }
  }
}
