/**
 * Per-frame render state shared between the render system and the post chain.
 *
 * OWNED BY: Graphics team.
 *
 * The `PostPass` contract only hands passes an `IRenderContext`, but a modern
 * post stack needs more than that: TAA needs the jitter that was baked into the
 * projection matrix, motion blur needs last frame's view-projection, auto
 * exposure needs to publish a 1x1 luminance texture that the composite pass
 * reads. Rather than widen the cross-team contract (and force every other team
 * to care), the graphics team keeps that data in one module-scoped record.
 *
 * Nothing outside `src/render/` and `src/fx/` should read this.
 */

import * as THREE from 'three';
import type { IRenderContext } from '../core/contracts';

/**
 * Structural view of `RenderSystem` that post passes need. Declared here rather
 * than imported so `src/fx/postprocess/*` never has to import the render system
 * module (which would form an import cycle).
 */
export interface PostContext extends IRenderContext {
  /** HDR scene colour + depth, written by the world/viewmodel passes. */
  sceneTarget: THREE.WebGLRenderTarget;
  /** Ping-pong colour targets. `frame.current` says which one is live. */
  postA: THREE.WebGLRenderTarget;
  postB: THREE.WebGLRenderTarget;
  swap(): void;
}

export interface FrameState {
  /** Monotonic frame counter — drives jitter sequences and grain. */
  index: number;
  /** Seconds since the previous rendered frame. */
  dt: number;
  /** Wall-clock seconds since boot, for animated noise. */
  time: number;

  /** Sub-pixel projection jitter applied this frame, in pixels. */
  jitter: THREE.Vector2;
  /** Same jitter expressed in clip space (2/w, 2/h scaled). */
  jitterClip: THREE.Vector2;

  /** Unjittered view-projection for this frame. */
  viewProjection: THREE.Matrix4;
  /** Unjittered view-projection from the previous frame (motion vectors). */
  prevViewProjection: THREE.Matrix4;
  /** Inverse of the *jittered* view-projection — matches the depth buffer. */
  invViewProjection: THREE.Matrix4;
  /** Inverse projection only, for view-space reconstruction (SSAO). */
  invProjection: THREE.Matrix4;
  /** World→view matrix for this frame. */
  viewMatrix: THREE.Matrix4;

  cameraPosition: THREE.Vector3;
  prevCameraPosition: THREE.Vector3;
  near: number;
  far: number;
  /** Vertical field of view in radians. */
  fovY: number;

  /** True on the first frame after a resize / teleport — history is invalid. */
  resetHistory: boolean;
  /** How far the camera translated since last frame, in metres. */
  cameraDelta: number;
  /** Angular camera movement since last frame, in radians. */
  cameraTurn: number;

  /** Render-target dimensions in pixels (post chain works at this size). */
  width: number;
  height: number;

  /** 1x1 R16F-ish target holding adapted scene luminance. */
  exposureTexture: THREE.Texture | null;
  /** Scalar mirror of the above for CPU-side decisions (one frame stale). */
  exposure: number;
  /**
   * Haze colour for the current conditions, published by the environment.
   * The atmosphere pass used to read `scene.fog`, but fog was consolidated
   * into the post chain and `scene.fog` is now never assigned — so the pass
   * held its initialiser forever and washed night frames daylight blue.
   */
  fogColor: THREE.Color;
  /** Bloom result, sampled by the composite pass. */
  bloomTexture: THREE.Texture | null;
  /** Ambient-occlusion factor, sampled by the composite/debug passes. */
  aoTexture: THREE.Texture | null;

  /** Live colour texture flowing through the post chain. */
  current: THREE.Texture | null;

  /** Fullscreen triangle shared by every pass. */
  geometry: THREE.BufferGeometry | null;

  /** 0..1 aim-down-sight progress, published by the render system. */
  ads: number;
}

export const frame: FrameState = {
  index: 0,
  dt: 1 / 60,
  time: 0,

  jitter: new THREE.Vector2(),
  jitterClip: new THREE.Vector2(),

  viewProjection: new THREE.Matrix4(),
  prevViewProjection: new THREE.Matrix4(),
  invViewProjection: new THREE.Matrix4(),
  invProjection: new THREE.Matrix4(),
  viewMatrix: new THREE.Matrix4(),

  cameraPosition: new THREE.Vector3(),
  prevCameraPosition: new THREE.Vector3(),
  near: 0.05,
  far: 4000,
  fovY: 1.3,

  resetHistory: true,
  cameraDelta: 0,
  cameraTurn: 0,

  width: 1,
  height: 1,

  exposureTexture: null,
  exposure: 1,
  fogColor: new THREE.Color(0.6, 0.7, 0.8),
  bloomTexture: null,
  aoTexture: null,

  current: null,

  geometry: null,

  ads: 0,
};

/**
 * Halton low-discrepancy sequence — the standard TAA jitter generator. Gives
 * far better coverage than random sampling at the 8/16 sample counts we use.
 */
export function halton(index: number, base: number): number {
  let result = 0;
  let f = 1 / base;
  let i = index;
  while (i > 0) {
    result += f * (i % base);
    i = Math.floor(i / base);
    f /= base;
  }
  return result;
}

/** Pre-baked Halton(2,3) jitter offsets in [-0.5, 0.5]. */
export const JITTER_SEQUENCE: THREE.Vector2[] = (() => {
  const out: THREE.Vector2[] = [];
  for (let i = 1; i <= 16; i++) {
    out.push(new THREE.Vector2(halton(i, 2) - 0.5, halton(i, 3) - 0.5));
  }
  return out;
})();
