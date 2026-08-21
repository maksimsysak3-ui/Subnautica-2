/**
 * Combat visual effects.
 *
 * OWNED BY: VFX.
 *
 * Firing a weapon has to *look* like something happened. Without this the
 * player pulls a trigger, an invisible projectile leaves an invisible barrel,
 * and something takes damage somewhere off screen — which reads as the gun
 * being broken even when the simulation underneath is exactly right.
 *
 * Everything here is pooled and driven by the event bus, so no gameplay system
 * has to know that VFX exists:
 *
 *   weapon:fired       → muzzle flash + light + smoke puff
 *   weapon:shellEject  → tumbling brass
 *   bullet:impact      → surface-appropriate spark/dust burst + a decal
 *   bullet:hitActor    → blood mist
 *
 * The muzzle flash is drawn in the **viewmodel scene**, not the world, so it
 * sits at the weapon's own muzzle and can't be occluded by world geometry.
 * Everything else lives in the world.
 */

import * as THREE from 'three';
import type { System, EngineContext } from '../core/engine';
import { bus } from '../core/events';
import { services } from '../core/contracts';
import { Rng, clamp01 } from '../core/math';

const MAX_TRACERS = 64;
const MAX_PARTICLES = 512;
const MAX_DECALS = 96;
const MAX_SHELLS = 32;

/** Impact colour and behaviour per surface — a hit should read as its material. */
const IMPACT: Record<string, { color: number; sparks: number; dust: number; dustColor: number }> = {
  concrete: { color: 0xbfb6a6, sparks: 2,  dust: 10, dustColor: 0xb8ad9b },
  metal:    { color: 0xffd68a, sparks: 14, dust: 2,  dustColor: 0x8a8a8a },
  wood:     { color: 0x8a6540, sparks: 1,  dust: 8,  dustColor: 0x7a5a38 },
  drywall:  { color: 0xe8e4dc, sparks: 0,  dust: 14, dustColor: 0xe4e0d6 },
  glass:    { color: 0xcfe6f0, sparks: 6,  dust: 6,  dustColor: 0xbcd8e6 },
  dirt:     { color: 0x8a6f4e, sparks: 0,  dust: 14, dustColor: 0x7d6446 },
  sand:     { color: 0xc9b98a, sparks: 0,  dust: 16, dustColor: 0xc4b087 },
  gravel:   { color: 0x9a9186, sparks: 1,  dust: 12, dustColor: 0x8e857a },
  grass:    { color: 0x5d6b3e, sparks: 0,  dust: 8,  dustColor: 0x54613a },
  foliage:  { color: 0x4c6236, sparks: 0,  dust: 6,  dustColor: 0x44582f },
  flesh:    { color: 0x8c1f1f, sparks: 0,  dust: 10, dustColor: 0x7a1a1a },
  tile:     { color: 0xd6cec2, sparks: 3,  dust: 9,  dustColor: 0xcac2b6 },
  water:    { color: 0x9fc4d8, sparks: 0,  dust: 12, dustColor: 0x8fb4c8 },
};

function impactFor(surface: string): { color: number; sparks: number; dust: number; dustColor: number } {
  return IMPACT[surface] ?? IMPACT.concrete;
}

interface Tracer {
  active: boolean;
  from: THREE.Vector3;
  to: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface Particle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
  drag: number;
  color: THREE.Color;
}

interface Shell {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  rot: THREE.Euler;
  life: number;
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

export class CombatFx implements System {
  readonly id = 'combatFx';
  readonly order = 44;
  readonly initOrder = 58;
  readonly budgetMs = 1.5;

  private rng = new Rng('combat-fx');

  private tracers: Tracer[] = [];
  private tracerMesh!: THREE.InstancedMesh;

  private particles: Particle[] = [];
  private particleMesh!: THREE.InstancedMesh;

  private decals: THREE.Mesh[] = [];
  private decalIndex = 0;

  private shells: Shell[] = [];
  private shellMesh!: THREE.InstancedMesh;

  private flash!: THREE.Mesh;
  private flashLight!: THREE.PointLight;
  private flashLife = 0;
  private worldFlashLight!: THREE.PointLight;

  /** Set by main.ts so the flash can follow the weapon's own muzzle. */
  muzzleProvider: ((out: THREE.Vector3) => THREE.Vector3) | null = null;
  /**
   * Live projectiles, injected rather than imported so VFX has no dependency
   * on the weapons module. Every round in flight draws a short streak behind
   * itself — without it a shot is completely invisible between muzzle and
   * impact, which is most of why firing felt like nothing was happening.
   */
  projectileSource: (() => ReadonlyArray<{ position: THREE.Vector3; velocity: THREE.Vector3; tracer: boolean }>) | null = null;
  private lastSeen = new WeakMap<object, THREE.Vector3>();

  init(_ctx: EngineContext): void {
    const render = services.get('render');
    const scene = render.scene;

    // --- tracers ---------------------------------------------------------
    // A thin stretched box per round; instanced so a machine gun burst is one
    // draw call.
    const tracerGeo = new THREE.BoxGeometry(1, 1, 1);
    const tracerMat = new THREE.MeshBasicMaterial({
      color: 0xffd08a, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    this.tracerMesh = new THREE.InstancedMesh(tracerGeo, tracerMat, MAX_TRACERS);
    this.tracerMesh.name = 'fx:tracers';
    this.tracerMesh.frustumCulled = false;
    this.tracerMesh.count = 0;
    this.tracerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.tracerMesh);
    for (let i = 0; i < MAX_TRACERS; i++) {
      this.tracers.push({ active: false, from: new THREE.Vector3(), to: new THREE.Vector3(), life: 0, maxLife: 0.06 });
    }

    // --- particles -------------------------------------------------------
    const partGeo = new THREE.BoxGeometry(1, 1, 1);
    const partMat = new THREE.MeshBasicMaterial({
      vertexColors: false, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false,
    });
    this.particleMesh = new THREE.InstancedMesh(partGeo, partMat, MAX_PARTICLES);
    this.particleMesh.name = 'fx:particles';
    this.particleMesh.frustumCulled = false;
    this.particleMesh.count = 0;
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3);
    scene.add(this.particleMesh);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        life: 0, maxLife: 1, size: 0.03, gravity: -9.81, drag: 2, color: new THREE.Color(),
      });
    }

    // --- shell casings ---------------------------------------------------
    const shellGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.022, 6);
    const shellMat = new THREE.MeshStandardMaterial({ color: 0xb08d4a, roughness: 0.35, metalness: 0.85 });
    this.shellMesh = new THREE.InstancedMesh(shellGeo, shellMat, MAX_SHELLS);
    this.shellMesh.name = 'fx:shells';
    this.shellMesh.frustumCulled = false;
    this.shellMesh.count = 0;
    this.shellMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.shellMesh);
    for (let i = 0; i < MAX_SHELLS; i++) {
      this.shells.push({
        active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        spin: new THREE.Vector3(), rot: new THREE.Euler(), life: 0,
      });
    }

    // --- decals ----------------------------------------------------------
    // A ring buffer of small quads. Cheap, and it means a wall you have shot
    // stays shot, which matters a great deal for reading a firefight.
    const decalGeo = new THREE.PlaneGeometry(0.09, 0.09);
    for (let i = 0; i < MAX_DECALS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x101012, transparent: true, opacity: 0, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -4, toneMapped: false,
      });
      const m = new THREE.Mesh(decalGeo, mat);
      m.name = 'fx:decal';
      m.visible = false;
      m.frustumCulled = true;
      scene.add(m);
      this.decals.push(m);
    }

    // --- muzzle flash ----------------------------------------------------
    // Drawn in the VIEWMODEL scene so it sits at the weapon's own muzzle and
    // is never occluded by the world.
    const flashGeo = new THREE.PlaneGeometry(0.16, 0.16);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffd9a0, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false,
      side: THREE.DoubleSide,
    });
    this.flash = new THREE.Mesh(flashGeo, flashMat);
    this.flash.name = 'fx:muzzleFlash';
    this.flash.visible = false;
    this.flash.frustumCulled = false;
    this.flash.renderOrder = 500;
    render.viewScene.add(this.flash);

    this.flashLight = new THREE.PointLight(0xffc078, 0, 2.5);
    render.viewScene.add(this.flashLight);

    // A second light in the world so the flash actually lights the room.
    this.worldFlashLight = new THREE.PointLight(0xffbb66, 0, 14);
    scene.add(this.worldFlashLight);

    // --- wiring ----------------------------------------------------------
    bus.on('weapon:fired', (e) => this.onFired(e.muzzle, e.direction, e.suppressed));
    bus.on('weapon:shellEject', (e) => this.onShell(e.position, e.velocity));
    bus.on('bullet:impact', (e) => this.onImpact(e.position, e.normal, e.surface, e.energyJ));
    bus.on('bullet:hitActor', (e) => this.onFlesh(e.position, e.direction));
  }

  // -----------------------------------------------------------------------
  // Spawners
  // -----------------------------------------------------------------------

  private onFired(muzzle: THREE.Vector3, direction: THREE.Vector3, suppressed: boolean): void {
    // Flash intensity: a can turns a fireball into a glow.
    const scale = suppressed ? 0.32 : 1;
    this.flashLife = suppressed ? 0.030 : 0.055;
    this.flash.visible = true;
    this.flash.scale.setScalar(scale * this.rng.range(0.8, 1.25));
    this.flash.rotation.z = this.rng.range(0, Math.PI * 2);

    (this.flashLight as THREE.PointLight).intensity = suppressed ? 1.2 : 5.0;
    this.worldFlashLight.position.copy(muzzle);
    this.worldFlashLight.intensity = suppressed ? 2 : 9;

    // Muzzle smoke — a couple of slow puffs that drift and expand.
    const puffs = suppressed ? 4 : 2;
    for (let i = 0; i < puffs; i++) {
      this.spawnParticle(
        muzzle,
        _v.copy(direction).multiplyScalar(this.rng.range(0.6, 1.8))
          .addScaledVector(UP, this.rng.range(0.1, 0.5))
          .add(_v2.set(this.rng.range(-0.3, 0.3), 0, this.rng.range(-0.3, 0.3))),
        this.rng.range(0.35, 0.7), this.rng.range(0.05, 0.11),
        0x9a9a92, -0.4, 2.6,
      );
    }
  }

  private onShell(position: THREE.Vector3, velocity: THREE.Vector3): void {
    const s = this.shells.find((q) => !q.active);
    if (!s) return;
    s.active = true;
    s.pos.copy(position);
    s.vel.copy(velocity);
    s.spin.set(this.rng.range(-18, 18), this.rng.range(-18, 18), this.rng.range(-24, 24));
    s.rot.set(0, 0, 0);
    s.life = 2.2;
  }

  private onImpact(position: THREE.Vector3, normal: THREE.Vector3, surface: string, energyJ: number): void {
    const def = impactFor(surface);
    const power = clamp01(energyJ / 1800);

    // Sparks fly along the reflection; dust puffs out along the normal.
    const sparkCount = Math.round(def.sparks * (0.5 + power));
    for (let i = 0; i < sparkCount; i++) {
      _v.copy(normal).multiplyScalar(this.rng.range(1.5, 4.5))
        .add(_v2.set(this.rng.range(-2, 2), this.rng.range(-0.5, 2), this.rng.range(-2, 2)));
      this.spawnParticle(position, _v, this.rng.range(0.15, 0.45), this.rng.range(0.006, 0.014),
        def.color, -14, 1.4);
    }

    const dustCount = Math.round(def.dust * (0.4 + power));
    for (let i = 0; i < dustCount; i++) {
      _v.copy(normal).multiplyScalar(this.rng.range(0.5, 2.2))
        .add(_v2.set(this.rng.range(-1, 1), this.rng.range(-0.2, 1.2), this.rng.range(-1, 1)));
      this.spawnParticle(position, _v, this.rng.range(0.3, 0.75), this.rng.range(0.02, 0.055),
        def.dustColor, -1.6, 3.2);
    }

    if (surface !== 'flesh' && surface !== 'water') {
      this.placeDecal(position, normal, 0.05 + power * 0.06);
    }
  }

  private onFlesh(position: THREE.Vector3, direction: THREE.Vector3): void {
    for (let i = 0; i < 10; i++) {
      _v.copy(direction).multiplyScalar(this.rng.range(0.8, 3.0))
        .add(_v2.set(this.rng.range(-1, 1), this.rng.range(-0.3, 1.2), this.rng.range(-1, 1)));
      this.spawnParticle(position, _v, this.rng.range(0.25, 0.6), this.rng.range(0.012, 0.032),
        0x8c1f1f, -7, 2.2);
    }
  }

  /** Public so ballistics can draw a tracer for a round in flight. */
  addTracer(from: THREE.Vector3, to: THREE.Vector3, life = 0.055): void {
    const t = this.tracers.find((q) => !q.active);
    if (!t) return;
    t.active = true;
    t.from.copy(from);
    t.to.copy(to);
    t.life = life;
    t.maxLife = life;
  }

  private spawnParticle(
    pos: THREE.Vector3, vel: THREE.Vector3, life: number, size: number,
    color: number, gravity: number, drag: number,
  ): void {
    const p = this.particles.find((q) => !q.active);
    if (!p) return;
    p.active = true;
    p.pos.copy(pos);
    p.vel.copy(vel);
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.gravity = gravity;
    p.drag = drag;
    p.color.setHex(color);
  }

  private placeDecal(position: THREE.Vector3, normal: THREE.Vector3, size: number): void {
    const d = this.decals[this.decalIndex];
    this.decalIndex = (this.decalIndex + 1) % this.decals.length;
    d.visible = true;
    // Lift off the surface so it doesn't z-fight the wall it is on.
    d.position.copy(position).addScaledVector(normal, 0.006);
    d.lookAt(_v.copy(d.position).add(normal));
    d.scale.setScalar(size / 0.09);
    d.rotateZ(this.rng.range(0, Math.PI * 2));
    (d.material as THREE.MeshBasicMaterial).opacity = 0.85;
  }

  // -----------------------------------------------------------------------
  // Simulation
  // -----------------------------------------------------------------------

  update(dt: number, _ctx: EngineContext): void {
    this.streakProjectiles();
    this.updateFlash(dt);
    this.updateTracers(dt);
    this.updateParticles(dt);
    this.updateShells(dt);
    this.updateDecals(dt);
  }

  private updateFlash(dt: number): void {
    if (this.flashLife <= 0) {
      if (this.flash.visible) {
        this.flash.visible = false;
        this.flashLight.intensity = 0;
        this.worldFlashLight.intensity = 0;
      }
      return;
    }
    this.flashLife -= dt;
    const t = clamp01(this.flashLife / 0.055);
    (this.flash.material as THREE.MeshBasicMaterial).opacity = t;
    this.flashLight.intensity *= 0.55;
    this.worldFlashLight.intensity *= 0.55;

    // Park the flash at the weapon's muzzle in viewmodel space.
    if (this.muzzleProvider) {
      const render = services.get('render') as unknown as { viewCamera: THREE.Camera };
      this.muzzleProvider(_v);
      this.flash.position.copy(_v);
      this.flash.quaternion.copy(render.viewCamera.quaternion);
      this.flashLight.position.copy(_v);
    }
    if (this.flashLife <= 0) {
      this.flash.visible = false;
      this.flashLight.intensity = 0;
      this.worldFlashLight.intensity = 0;
    }
  }

  /**
   * Draw a streak behind every round in flight.
   *
   * Non-tracer rounds get a short, dim streak rather than nothing: real
   * supersonic rounds do leave a visible disturbance up close, and more
   * importantly the player needs *some* confirmation that a bullet left the
   * barrel and went where they pointed.
   */
  private streakProjectiles(): void {
    if (!this.projectileSource) return;
    for (const p of this.projectileSource()) {
      const prev = this.lastSeen.get(p);
      if (prev && prev.distanceToSquared(p.position) > 1e-6) {
        this.addTracer(prev, p.position, p.tracer ? 0.075 : 0.032);
      }
      if (prev) prev.copy(p.position);
      else this.lastSeen.set(p, p.position.clone());
    }
  }

  private updateTracers(dt: number): void {
    let n = 0;
    for (const t of this.tracers) {
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) { t.active = false; continue; }

      // Stretch a unit box between the two points and orient it along the path.
      _v.copy(t.to).sub(t.from);
      const len = _v.length();
      if (len < 1e-4) { t.active = false; continue; }
      _v.multiplyScalar(1 / len);
      _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _v);
      const fade = t.life / t.maxLife;
      _scale.set(0.018 * fade + 0.004, 0.018 * fade + 0.004, len);
      _v2.copy(t.from).addScaledVector(_v, len / 2);
      _m.compose(_v2, _q, _scale);
      this.tracerMesh.setMatrixAt(n++, _m);
    }
    this.tracerMesh.count = n;
    if (n > 0) this.tracerMesh.instanceMatrix.needsUpdate = true;
  }

  private updateParticles(dt: number): void {
    let n = 0;
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }

      p.vel.y += p.gravity * dt;
      p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.pos.addScaledVector(p.vel, dt);

      const t = p.life / p.maxLife;
      // Dust grows as it dissipates; sparks shrink as they cool.
      const grow = p.gravity > -5 ? (2 - t) : t;
      const s = p.size * grow;
      _scale.set(s, s, s);
      _m.compose(p.pos, _q.identity(), _scale);
      this.particleMesh.setMatrixAt(n, _m);
      _color.copy(p.color).multiplyScalar(0.4 + t * 0.6);
      this.particleMesh.setColorAt(n, _color);
      n++;
    }
    this.particleMesh.count = n;
    if (n > 0) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  private updateShells(dt: number): void {
    const world = services.tryGet('world');
    let n = 0;
    for (const s of this.shells) {
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) { s.active = false; continue; }

      s.vel.y -= 9.81 * dt;
      s.pos.addScaledVector(s.vel, dt);
      s.rot.x += s.spin.x * dt;
      s.rot.y += s.spin.y * dt;
      s.rot.z += s.spin.z * dt;

      // Settle on the ground rather than falling through the world.
      const floor = world?.groundHeight(s.pos.x, s.pos.z);
      if (floor !== null && floor !== undefined && s.pos.y < floor + 0.008) {
        s.pos.y = floor + 0.008;
        s.vel.set(s.vel.x * 0.3, Math.abs(s.vel.y) * 0.22, s.vel.z * 0.3);
        s.spin.multiplyScalar(0.4);
      }

      _q.setFromEuler(s.rot);
      _m.compose(s.pos, _q, _scale.set(1, 1, 1));
      this.shellMesh.setMatrixAt(n++, _m);
    }
    this.shellMesh.count = n;
    if (n > 0) this.shellMesh.instanceMatrix.needsUpdate = true;
  }

  private updateDecals(dt: number): void {
    // Decals fade slowly so a long firefight doesn't fill a wall with black.
    for (const d of this.decals) {
      if (!d.visible) continue;
      const mat = d.material as THREE.MeshBasicMaterial;
      mat.opacity -= dt * 0.012;
      if (mat.opacity <= 0) d.visible = false;
    }
  }

  dispose(): void {
    this.tracerMesh.dispose();
    this.particleMesh.dispose();
    this.shellMesh.dispose();
    for (const d of this.decals) (d.material as THREE.Material).dispose();
  }
}
