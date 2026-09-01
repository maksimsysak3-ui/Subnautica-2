/**
 * The city-builder camera: an orbit rig locked to a focus point on the ground.
 *
 * Not a free-flying camera. Every city builder uses this because it keeps the
 * horizon level and the ground always in view, and because "where am I looking"
 * reduces to a single point on the map -- which is what saves, what the
 * minimap draws, and what decides which agents get promoted to full simulation
 * later.
 *
 * State is (focus, distance, yaw, pitch). Everything else is derived.
 */

import { clamp, invert, lookAt, mat4, multiply, perspective, transformPoint } from '../math/m4';
import type { Mat4, Vec3 } from '../math/m4';

const FOV_Y = (50 * Math.PI) / 180;
const UP: Vec3 = [0, 1, 0];

export const LIMITS = {
  minDistance: 8,
  maxDistance: 3400,
  minPitch: (12 * Math.PI) / 180,   // never quite horizontal: the far plane would swallow the world
  maxPitch: (88 * Math.PI) / 180,   // never quite top-down: gimbal-flip territory
  extent: 2900,                     // focus stays inside +/- this, just inside the terrain edge
};

export class Camera {
  focus: Vec3 = [0, 0, 0];
  distance = 120;
  yaw = Math.PI * 0.25;
  pitch = (45 * Math.PI) / 180;

  near = 0.5;
  far = 6000;

  /**
   * Terrain height lookup. Set once terrain exists, so the focus point rides
   * the ground instead of the y = 0 plane -- without it, orbiting over a hill
   * swings the view underground.
   */
  groundHeight: ((x: number, z: number) => number) | null = null;

  /** How far the focus may travel from the origin. Set from the terrain size. */
  extent = LIMITS.extent;

  readonly view = mat4();
  readonly proj = mat4();
  readonly viewProj = mat4();
  readonly invViewProj = mat4();
  readonly eye: Vec3 = [0, 0, 0];

  private aspect = 1;
  private scratch: Vec3 = [0, 0, 0];

  setViewport(width: number, height: number): void {
    this.aspect = width / Math.max(height, 1);
  }

  /** Recomputes the derived matrices. Call once per frame, after input. */
  update(): void {
    this.pitch = clamp(this.pitch, LIMITS.minPitch, LIMITS.maxPitch);
    this.distance = clamp(this.distance, LIMITS.minDistance, LIMITS.maxDistance);
    this.focus[0] = clamp(this.focus[0], -this.extent, this.extent);
    this.focus[2] = clamp(this.focus[2], -this.extent, this.extent);
    this.focus[1] = this.groundHeight ? this.groundHeight(this.focus[0], this.focus[2]) : 0;

    const cosPitch = Math.cos(this.pitch);
    this.eye[0] = this.focus[0] + this.distance * cosPitch * Math.sin(this.yaw);
    this.eye[1] = this.focus[1] + this.distance * Math.sin(this.pitch);
    this.eye[2] = this.focus[2] + this.distance * cosPitch * Math.cos(this.yaw);

    // Near/far track the zoom level. A fixed near plane of 0.5 with a far of
    // 6000 burns most of the depth buffer's precision on distance nobody is
    // looking at; scaling with distance keeps z-fighting away from buildings.
    this.near = Math.max(0.25, this.distance * 0.01);
    this.far = this.distance * 12 + 2000;

    lookAt(this.view, this.eye, this.focus, UP);
    perspective(this.proj, FOV_Y, this.aspect, this.near, this.far);
    multiply(this.viewProj, this.proj, this.view);
    invert(this.invViewProj, this.viewProj);
  }

  /**
   * Where a screen position lands on the ground.
   *
   * Intersects the horizontal plane through the focus point rather than the
   * terrain itself. Marching the ray against the heightfield would be exact,
   * but this is one intersection instead of dozens per pointer move and the
   * error is invisible while dragging near what you are looking at. Placement
   * tools that need the true surface will march; panning and zooming do not.
   *
   * Returns null when the ray points at the sky.
   */
  groundPointAt(ndcX: number, ndcY: number, out: Vec3 = [0, 0, 0]): Vec3 | null {
    const nearPt = transformPoint(this.scratch, this.invViewProj, ndcX, ndcY, 0);
    const nx = nearPt[0], ny = nearPt[1], nz = nearPt[2];
    const farPt = transformPoint(this.scratch, this.invViewProj, ndcX, ndcY, 1);

    const planeY = this.focus[1];
    const dy = farPt[1] - ny;
    if (Math.abs(dy) < 1e-6) return null;      // ray parallel to the ground
    const t = (planeY - ny) / dy;
    if (t < 0 || t > 1) return null;           // plane is behind the camera

    out[0] = nx + (farPt[0] - nx) * t;
    out[1] = planeY;
    out[2] = nz + (farPt[2] - nz) * t;
    return out;
  }

  /** Pans in the camera's own ground-plane frame, so drag direction matches the view. */
  panBy(right: number, forward: number): void {
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    this.focus[0] += right * c - forward * s;
    this.focus[2] += -right * s - forward * c;
  }

  /** Multiplicative zoom, so each notch feels the same at every distance. */
  zoomBy(factor: number): void {
    this.distance = clamp(this.distance * factor, LIMITS.minDistance, LIMITS.maxDistance);
  }

  get viewProjMatrix(): Mat4 {
    return this.viewProj;
  }
}
