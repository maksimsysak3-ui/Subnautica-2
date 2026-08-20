/**
 * First-person viewmodel.
 *
 * OWNED BY: Weapon models / Animation.
 *
 * Puts the equipped weapon in the player's hands and moves it. This renders in
 * the render system's separate `viewScene` with a cleared depth buffer, which
 * is how shooters keep the weapon from clipping into walls, and with its own
 * narrower-FOV camera so the weapon isn't stretched at the screen edges.
 *
 * ## Aiming down sights
 * ADS is not a camera zoom with a gun glued to the middle. The weapon is moved
 * so its **sight point lands on the camera axis** — the model reports where its
 * aiming axis is (`WeaponModel.sightPoint`) and this offsets the whole weapon by
 * the negative of that. That is why swapping a red dot for a 5-25× scope keeps
 * the reticle centred without any per-optic tuning: the geometry says where to
 * put it.
 *
 * ## What moves it
 *  - **Sway** — low-frequency drift from breathing and muscle tremor.
 *  - **Bob** — footstep cadence, scaled by speed, killed when aiming.
 *  - **Lag** — the weapon trails the camera when you turn, then catches up.
 *    This one does most of the work in making a weapon feel like it has mass.
 *  - **Recoil** — kick and rotation read from the weapon runtime.
 */

import * as THREE from 'three';
import type { System, EngineContext } from '../core/engine';
import { bus } from '../core/events';
import { services, type AttachmentSlot, type AttachmentSpec } from '../core/contracts';
import { damp, lerp, clamp01 } from '../core/math';
import { buildWeapon, type WeaponModel } from './weapon-mesh';

/**
 * Where the weapon sits when not aiming, in view space.
 *
 * Distance is the whole framing decision. The model is authored at true scale —
 * a carbine really is about 800 mm — so parking it 30 cm from the eye makes it
 * fill half the screen. Real shooters hold the grip roughly 45–55 cm out, and
 * the weapon should occupy the lower-right third of frame, not dominate it.
 */
// The model's origin is at the trigger, so the receiver and optic sit just
// behind it — pushing the whole weapon forward keeps the optic off the right
// edge of frame and puts the barrel where the eye expects it.
const HIP_POS = new THREE.Vector3(0.098, -0.088, -0.34);
/**
 * Yaw is positive so the muzzle swings slightly LEFT while the stock stays
 * right. Pointed dead ahead the barrel hides behind its own receiver and the
 * weapon reads as a stubby block; the small angle is what gives the
 * three-quarter view every shooter uses.
 */
const HIP_ROT = new THREE.Euler(0.012, 0.115, 0.018);
/** Extra offset while sprinting — weapon carried low and across the body. */
const SPRINT_POS = new THREE.Vector3(0.13, -0.20, -0.30);
const SPRINT_ROT = new THREE.Euler(-0.34, -0.62, 0.28);

/**
 * Viewmodel scale.
 *
 * Every first-person shooter shrinks the weapon, and the reason is geometric,
 * not artistic: a real rifle's buttstock is against your shoulder, which is
 * *behind* your eye. Rendered at true scale from a true position you would see
 * the back of the stock filling the screen and almost none of the weapon.
 * Shrinking it and pulling it in puts the whole profile — receiver, optic,
 * handguard, muzzle — in frame while keeping the sight line honest.
 */
const VIEW_SCALE = 0.62;

export interface ViewmodelHost {
  stance: string;
  adsProgress: number;
  speed: number;
  stamina: number;
  maxStamina: number;
  yaw: number;
  pitch: number;
}

export class Viewmodel implements System {
  readonly id = 'viewmodel';
  readonly order = 34;
  readonly initOrder = 55;
  readonly budgetMs = 0.6;

  host: ViewmodelHost | null = null;

  private root = new THREE.Group();
  private model: WeaponModel | null = null;
  private currentKey = '';

  private swayTime = 0;
  private bobPhase = 0;
  private lagYaw = 0;
  private lagPitch = 0;
  private prevYaw = 0;
  private prevPitch = 0;
  private kick = 0;
  private lastAmmo = -1;

  private pos = new THREE.Vector3();
  private rot = new THREE.Euler();

  init(_ctx: EngineContext): void {
    const render = services.get('render');
    render.viewScene.add(this.root);

    // The viewmodel scene has no lights of its own — without these the weapon
    // renders pure black, exactly as the world geometry did before its
    // materials were fixed.
    //
    // These are deliberately hot. Auto-exposure meters the *world*, and in
    // bright daylight it stops down far enough that a correctly-lit weapon
    // reads as a silhouette. Every shooter over-lights the viewmodel for this
    // reason: the gun is the one object that must stay legible in every
    // lighting condition, because the player is looking at it constantly.
    const key = new THREE.DirectionalLight(0xfff2e2, 6.5);
    key.position.set(-0.5, 1.0, 0.6);
    render.viewScene.add(key);

    const fill = new THREE.DirectionalLight(0xa8bed6, 3.0);
    fill.position.set(1.0, -0.15, 0.35);
    render.viewScene.add(fill);

    // Rim from behind picks the silhouette off a bright background.
    const rim = new THREE.DirectionalLight(0xcfe0ff, 3.6);
    rim.position.set(0.25, 0.35, -1.0);
    render.viewScene.add(rim);

    render.viewScene.add(new THREE.AmbientLight(0x6a7480, 2.4));

    // Rebuild whenever the weapon or its attachments change.
    bus.on('weapon:equipped', () => this.rebuild());
    bus.on('weapon:attachmentChanged', () => this.rebuild());
    bus.on('weapon:fired', () => { this.kick += 1; });
  }

  private rebuild(): void {
    const runtime = services.tryGet('weapons');
    const engine = (window as unknown as { engine?: { get(id: string): unknown } }).engine;
    const rt = engine?.get('weaponRuntime') as unknown as {
      equipped: { specId: string; attachments: Partial<Record<AttachmentSlot, string>> } | null;
    } | undefined;
    const inst = rt?.equipped;
    if (!runtime || !inst) return;

    const spec = runtime.specs.get(inst.specId);
    if (!spec) return;

    // Cheap identity so a redundant event doesn't rebuild the mesh.
    const key = inst.specId + '|' + Object.values(inst.attachments).join(',');
    if (key === this.currentKey) return;
    this.currentKey = key;

    const resolved: Partial<Record<AttachmentSlot, AttachmentSpec | undefined>> = {};
    for (const slot of Object.keys(inst.attachments) as AttachmentSlot[]) {
      const id = inst.attachments[slot];
      if (id) resolved[slot] = runtime.attachments.get(id);
    }

    this.root.clear();
    this.model = buildWeapon(spec, resolved);
    this.model.group.scale.setScalar(VIEW_SCALE);
    this.root.add(this.model.group);
    console.info(`[viewmodel] ${spec.name} — ${this.model.triangles} tris`);
  }

  update(dt: number, _ctx: EngineContext): void {
    if (!this.model) {
      this.rebuild();
      if (!this.model) return;
    }
    const host = this.host;
    if (!host) return;

    const render = services.get('render') as unknown as { viewCamera: THREE.PerspectiveCamera };
    const ads = host.adsProgress;

    this.swayTime += dt;
    this.kick = Math.max(0, this.kick - dt * 7);

    // --- lag: the weapon trails the camera, then catches up ---------------
    // This is the single biggest contributor to a weapon feeling heavy.
    const dYaw = host.yaw - this.prevYaw;
    const dPitch = host.pitch - this.prevPitch;
    this.prevYaw = host.yaw;
    this.prevPitch = host.pitch;
    const lagScale = lerp(1, 0.28, ads);
    this.lagYaw = damp(this.lagYaw + dYaw * 0.55 * lagScale, 0, 9, dt);
    this.lagPitch = damp(this.lagPitch + dPitch * 0.45 * lagScale, 0, 9, dt);
    this.lagYaw = THREE.MathUtils.clamp(this.lagYaw, -0.14, 0.14);
    this.lagPitch = THREE.MathUtils.clamp(this.lagPitch, -0.11, 0.11);

    // --- bob: footstep cadence -------------------------------------------
    const moving = clamp01(host.speed / 4);
    this.bobPhase += dt * (5.5 + host.speed * 1.15);
    const bobAmt = moving * lerp(1, 0.12, ads) * 0.022;
    const bobX = Math.sin(this.bobPhase) * bobAmt;
    const bobY = Math.abs(Math.cos(this.bobPhase)) * bobAmt * 0.8;

    // --- sway: breathing and tremor --------------------------------------
    const exhaustion = 1 - clamp01(host.stamina / Math.max(1, host.maxStamina));
    const swayAmt = lerp(0.010, 0.0022, ads) * (1 + exhaustion * 1.6);
    const swayX = Math.sin(this.swayTime * 0.9) * swayAmt;
    const swayY = Math.cos(this.swayTime * 1.31) * swayAmt * 0.7;

    // --- base pose --------------------------------------------------------
    const sprinting = host.speed > 5 && ads < 0.05;
    const baseP = sprinting ? SPRINT_POS : HIP_POS;
    const baseR = sprinting ? SPRINT_ROT : HIP_ROT;

    // ADS target: move the weapon so its own sight point sits on the camera
    // axis. Reading the offset off the model is what makes any optic centre
    // correctly with no per-optic tuning.
    // Sight point onto the camera axis. Scaled by the same factor as the mesh,
    // otherwise the optic sits off-centre by exactly the scale error.
    const sight = this.model.sightPoint;
    const adsP = new THREE.Vector3(
      -sight.x * VIEW_SCALE,
      -sight.y * VIEW_SCALE,
      -0.17,
    );

    this.pos.set(
      lerp(baseP.x, adsP.x, ads) + bobX + swayX + this.lagYaw * 0.30,
      lerp(baseP.y, adsP.y, ads) + bobY + swayY - this.lagPitch * 0.24,
      lerp(baseP.z, adsP.z, ads) - this.kick * 0.030,
    );

    this.rot.set(
      lerp(baseR.x, 0, ads) - this.lagPitch * 0.9 + this.kick * 0.05,
      lerp(baseR.y, 0, ads) + this.lagYaw * 1.1,
      lerp(baseR.z, 0, ads) + this.lagYaw * 0.5,
    );

    this.root.position.copy(this.pos);
    this.root.rotation.copy(this.rot);

    // Narrow the view FOV with magnification so a scope actually magnifies the
    // sight picture rather than just filling more of the screen.
    const runtime = (window as unknown as { engine?: { get(id: string): unknown } }).engine
      ?.get('weaponRuntime') as unknown as { equipped: { stats: { magnification: number } } | null } | undefined;
    const mag = runtime?.equipped?.stats.magnification ?? 1;
    const targetFov = lerp(55, 55 / Math.max(1, mag * 0.55), ads);
    const cam = render.viewCamera;
    if (Math.abs(cam.fov - targetFov) > 0.05) {
      cam.fov = damp(cam.fov, targetFov, 12, dt);
      cam.updateProjectionMatrix();
    }
  }

  /** World-space muzzle position, for flash and tracer spawning. */
  muzzleWorld(out: THREE.Vector3): THREE.Vector3 {
    if (!this.model) return out.set(0, 0, 0);
    return out.copy(this.model.muzzleTip).applyMatrix4(this.root.matrixWorld);
  }

  dispose(): void {
    this.root.clear();
  }
}
