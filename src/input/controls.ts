/**
 * Camera controls.
 *
 * The feel targets are the ones every city builder converges on:
 *   - drag the ground and it stays under the cursor (no scaled-delta panning)
 *   - the wheel zooms toward what the cursor is over, not the screen centre
 *   - keyboard works without touching the mouse
 *
 * "Grab the ground" panning and zoom-to-cursor are the same primitive twice:
 * find where the cursor hits y = 0 before and after the change, then shift the
 * focus by the difference. It costs one ray-plane intersection and it is the
 * single biggest difference between a camera that feels right and one that
 * feels cheap.
 */

import { ACCESS } from '../ui/access';
import type { Camera } from '../gfx/camera';
import type { Vec3 } from '../math/m4';
import { clamp } from '../math/m4';
import { LIMITS } from '../gfx/camera';

const ORBIT_SPEED = 0.006;         // radians per pixel
const KEY_PAN_SPEED = 1.4;         // metres per second, per unit of camera distance
const KEY_ORBIT_SPEED = 1.6;       // radians per second
const KEY_ZOOM_SPEED = 1.9;        // factor per second
const WHEEL_ZOOM = 0.0016;         // per wheel delta unit

type Mode = 'none' | 'pan' | 'orbit';

export class Controls {
  private mode: Mode = 'none';
  private pointers = new Map<number, { x: number; y: number }>();
  private lastX = 0;
  private lastY = 0;
  private pinchDistance = 0;
  private keys = new Set<string>();

  private grabPoint: Vec3 = [0, 0, 0];
  private a: Vec3 = [0, 0, 0];
  private disposers: Array<() => void> = [];

  /**
   * Asked before the camera takes a left drag.
   *
   * A build tool and the camera both want the left button, and the tool wins
   * while one is selected. Asked rather than told, because the tool's own
   * state changes on every click of the toolbar and a copy here would be one
   * more thing to keep in step.
   */
  buildActive: () => boolean = () => false;

  // ---- weight -------------------------------------------------------------
  //
  // A camera that moves exactly as far as the input and stops dead is correct
  // and feels like a spreadsheet. Three things give it weight: the wheel sets a
  // target the distance eases towards (keeping the point under the cursor
  // pinned the whole way), a drag that is let go of carries on and slows, and
  // so does an orbit. None of it changes where anything ends up; only how it
  // gets there.
  private zoomTarget: number | null = null;
  /** What `camera.distance` was last set to here, to notice anyone else moving it. */
  private zoomSet = 0;
  private zoomAt: [number, number] = [0, 0];
  private zoomAnchor: Vec3 = [0, 0, 0];
  private zoomAnchored = false;
  /** Pan momentum, metres per second, and orbit momentum, radians per second. */
  private panVel: [number, number] = [0, 0];
  private spinVel: [number, number] = [0, 0];
  private lastMove = 0;
  private c: Vec3 = [0, 0, 0];

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: Camera,
  ) {
    this.on(canvas, 'pointerdown', this.onPointerDown as EventListener);
    this.on(canvas, 'pointermove', this.onPointerMove as EventListener);
    this.on(canvas, 'pointerup', this.onPointerUp as EventListener);
    this.on(canvas, 'pointercancel', this.onPointerUp as EventListener);
    this.on(canvas, 'wheel', this.onWheel as EventListener, { passive: false });
    this.on(canvas, 'contextmenu', (e) => e.preventDefault());
    this.on(window, 'keydown', this.onKeyDown as EventListener);
    this.on(window, 'keyup', this.onKeyUp as EventListener);
    this.on(window, 'blur', () => this.keys.clear());
  }

  private on(
    target: EventTarget,
    type: string,
    fn: EventListener,
    opts?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, fn, opts);
    this.disposers.push(() => target.removeEventListener(type, fn, opts));
  }

  // ---- pointer ---------------------------------------------------------

  private ndc(clientX: number, clientY: number): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [
      ((clientX - r.left) / Math.max(r.width, 1)) * 2 - 1,
      1 - ((clientY - r.top) / Math.max(r.height, 1)) * 2,
    ];
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.canvas.setPointerCapture(e.pointerId);
    this.panVel = [0, 0];
    this.spinVel = [0, 0];
    this.zoomTarget = null;
    this.lastMove = performance.now();
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.canvas.focus();

    if (this.pointers.size === 2) {
      this.mode = 'none';
      this.pinchDistance = this.pointerSpread();
      return;
    }

    // Right button, middle button, or a modifier orbits; plain left drag pans,
    // unless a build tool has taken it.
    const orbit = e.button === 1 || e.button === 2 || e.shiftKey || e.altKey;
    if (!orbit && this.buildActive()) { this.mode = 'none'; return; }
    this.mode = orbit ? 'orbit' : 'pan';
    this.lastX = e.clientX;
    this.lastY = e.clientY;

    if (this.mode === 'pan') {
      const [nx, ny] = this.ndc(e.clientX, e.clientY);
      const hit = this.camera.groundPointAt(nx, ny, this.grabPoint);
      if (!hit) this.mode = 'none';   // grabbed the sky
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;

    if (this.pointers.size === 2) {
      const spread = this.pointerSpread();
      if (this.pinchDistance > 0 && spread > 0) {
        this.camera.zoomBy(clamp(this.pinchDistance / spread, 0.5, 2));
        this.camera.update();
      }
      this.pinchDistance = spread;
      return;
    }

    if (this.mode === 'orbit') {
      const dYaw = -(e.clientX - this.lastX) * ORBIT_SPEED;
      const dPitch = (e.clientY - this.lastY) * ORBIT_SPEED;
      this.track(this.spinVel, dYaw, dPitch);
      this.camera.yaw += dYaw;
      this.camera.pitch += dPitch;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.camera.update();
      return;
    }

    if (this.mode === 'pan') {
      // Move the focus so the ground point grabbed on pointerdown ends up back
      // under the cursor. Recomputed against the live matrices each move, so it
      // stays exact however far the drag goes.
      const [nx, ny] = this.ndc(e.clientX, e.clientY);
      const now = this.camera.groundPointAt(nx, ny, this.a);
      if (!now) return;
      const dx = this.grabPoint[0] - now[0], dz = this.grabPoint[2] - now[2];
      this.track(this.panVel, dx, dz);
      this.camera.focus[0] += dx;
      this.camera.focus[2] += dz;
      this.camera.update();
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    if (this.pointers.size < 2) this.pinchDistance = 0;
    if (this.pointers.size === 0) {
      // A drag that stopped before it was let go of is a placement, not a
      // fling: only carry on if the pointer was still moving at release.
      if (performance.now() - this.lastMove > 60) {
        this.panVel = [0, 0];
        this.spinVel = [0, 0];
      }
      this.mode = 'none';
    }
  };

  /** Folds one pointer step into a smoothed velocity. */
  private track(v: [number, number], dx: number, dy: number): void {
    const now = performance.now();
    const dt = Math.max(0.004, Math.min(0.1, (now - this.lastMove) / 1000));
    this.lastMove = now;
    const k = 0.35;
    v[0] = v[0] * (1 - k) + (dx / dt) * k;
    v[1] = v[1] * (1 - k) + (dy / dt) * k;
  }

  private pointerSpread(): number {
    const it = this.pointers.values();
    const p1 = it.next().value;
    const p2 = it.next().value;
    if (!p1 || !p2) return 0;
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  // ---- wheel -----------------------------------------------------------

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const [nx, ny] = this.ndc(e.clientX, e.clientY);
    const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    const cam = this.camera;
    const from = this.zoomTarget ?? cam.distance;
    this.zoomTarget = clamp(from * Math.exp(delta * WHEEL_ZOOM), LIMITS.minDistance, LIMITS.maxDistance);
    this.zoomSet = cam.distance;
    this.zoomAt = [nx, ny];
    // The ground under the cursor now is the ground that stays under it.
    this.zoomAnchored = cam.groundPointAt(nx, ny, this.zoomAnchor) !== null;
    this.panVel = [0, 0];
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey) return;
    this.keys.add(e.key.toLowerCase());
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };

  /** Applies held keys. Called once per frame with the frame's delta. */
  update(dt: number): boolean {
    const eased = this.ease(dt);
    if (this.keys.size === 0) return eased;
    const k = this.keys;
    const cam = this.camera;
    let moved = eased;

    // Pan speed scales with zoom: crossing the screen takes the same time
    // whether you are looking at one block or the whole city.
    const pan = KEY_PAN_SPEED * cam.distance * dt;
    let right = 0;
    let forward = 0;
    if (k.has('a') || k.has('arrowleft')) right -= pan;
    if (k.has('d') || k.has('arrowright')) right += pan;
    if (k.has('w') || k.has('arrowup')) forward += pan;
    if (k.has('s') || k.has('arrowdown')) forward -= pan;
    if (right || forward) { cam.panBy(right, forward); moved = true; }

    if (k.has('q')) { cam.yaw += KEY_ORBIT_SPEED * dt; moved = true; }
    if (k.has('e')) { cam.yaw -= KEY_ORBIT_SPEED * dt; moved = true; }
    if (k.has('r')) { cam.pitch += KEY_ORBIT_SPEED * dt; moved = true; }
    if (k.has('f')) { cam.pitch -= KEY_ORBIT_SPEED * dt; moved = true; }
    if (k.has('=') || k.has('+')) { cam.zoomBy(Math.exp(-KEY_ZOOM_SPEED * dt)); moved = true; }
    if (k.has('-') || k.has('_')) { cam.zoomBy(Math.exp(KEY_ZOOM_SPEED * dt)); moved = true; }

    if (moved) cam.update();
    return moved;
  }

  /** Zoom easing and momentum. Returns whether the camera moved. */
  private ease(dt: number): boolean {
    const cam = this.camera;
    let moved = false;
    if (this.zoomTarget !== null) {
      // Someone else moved the camera -- a tool, the menu, a script -- and
      // they win.
      if (Math.abs(cam.distance - this.zoomSet) > 1e-3) { this.zoomTarget = null; }
      else {
        const k = 1 - Math.exp(-dt * 12);
        let next = cam.distance + (this.zoomTarget - cam.distance) * k;
        if (Math.abs(next - this.zoomTarget) < this.zoomTarget * 0.002) {
          next = this.zoomTarget;
          this.zoomTarget = null;
        }
        cam.distance = next;
        cam.update();
        if (this.zoomAnchored) {
          const after = cam.groundPointAt(this.zoomAt[0], this.zoomAt[1], this.c);
          if (after) {
            cam.focus[0] += this.zoomAnchor[0] - after[0];
            cam.focus[2] += this.zoomAnchor[2] - after[2];
            cam.update();
          }
        }
        this.zoomSet = cam.distance;
        moved = true;
      }
    }
    if (this.mode === 'none') {
      // Reduce motion: the camera stops where the hand lets go.
      const decay = ACCESS.reduceMotion ? 0 : Math.exp(-dt * 5.5);
      const [vx, vz] = this.panVel;
      if (Math.abs(vx) + Math.abs(vz) > cam.distance * 0.01) {
        cam.focus[0] += vx * dt;
        cam.focus[2] += vz * dt;
        this.panVel[0] *= decay;
        this.panVel[1] *= decay;
        cam.update();
        moved = true;
      } else this.panVel = [0, 0];
      const [sy, sp] = this.spinVel;
      if (Math.abs(sy) + Math.abs(sp) > 0.02) {
        cam.yaw += sy * dt;
        cam.pitch += sp * dt;
        this.spinVel[0] *= decay;
        this.spinVel[1] *= decay;
        cam.update();
        moved = true;
      } else this.spinVel = [0, 0];
    }
    return moved;
  }

  dispose(): void {
    for (const d of this.disposers) d();
    this.disposers = [];
  }
}
