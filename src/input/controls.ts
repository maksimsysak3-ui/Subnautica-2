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

import type { Camera } from '../gfx/camera';
import type { Vec3 } from '../math/m4';
import { clamp } from '../math/m4';

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
  private b: Vec3 = [0, 0, 0];
  private disposers: Array<() => void> = [];

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
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.canvas.focus();

    if (this.pointers.size === 2) {
      this.mode = 'none';
      this.pinchDistance = this.pointerSpread();
      return;
    }

    // Right button, middle button, or a modifier orbits; plain left drag pans.
    const orbit = e.button === 1 || e.button === 2 || e.shiftKey || e.altKey;
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
      this.camera.yaw -= (e.clientX - this.lastX) * ORBIT_SPEED;
      this.camera.pitch += (e.clientY - this.lastY) * ORBIT_SPEED;
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
      this.camera.focus[0] += this.grabPoint[0] - now[0];
      this.camera.focus[2] += this.grabPoint[2] - now[2];
      this.camera.update();
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    if (this.pointers.size < 2) this.pinchDistance = 0;
    if (this.pointers.size === 0) this.mode = 'none';
  };

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

    // Line-mode wheels report ~3 lines where pixel-mode reports ~100px.
    const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;

    const before = this.camera.groundPointAt(nx, ny, this.a);
    this.camera.zoomBy(Math.exp(delta * WHEEL_ZOOM));
    this.camera.update();
    const after = this.camera.groundPointAt(nx, ny, this.b);

    if (before && after) {
      this.camera.focus[0] += before[0] - after[0];
      this.camera.focus[2] += before[2] - after[2];
      this.camera.update();
    }
  };

  // ---- keyboard --------------------------------------------------------

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey) return;
    this.keys.add(e.key.toLowerCase());
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };

  /** Applies held keys. Called once per frame with the frame's delta. */
  update(dt: number): boolean {
    if (this.keys.size === 0) return false;
    const k = this.keys;
    const cam = this.camera;
    let moved = false;

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

  dispose(): void {
    for (const d of this.disposers) d();
    this.disposers = [];
  }
}
