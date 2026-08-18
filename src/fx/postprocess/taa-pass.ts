/**
 * Temporal anti-aliasing.
 *
 * OWNED BY: Graphics team.
 *
 * Low-poly art lives or dies on its silhouettes, and a hard silhouette against
 * a bright sky is the worst case for spatial AA — FXAA smears it, MSAA costs a
 * multiple of the whole frame. TAA distributes the samples over time instead:
 * the render system jitters the projection matrix by a Halton(2,3) offset each
 * frame, and this pass integrates those sub-pixel positions into a history
 * buffer. Eight frames of Halton is effectively 8x supersampling, for the cost
 * of one resolve.
 *
 * The two things that make or break a TAA:
 *
 *  1. **Reprojection.** There is no velocity buffer here — the world is static
 *     geometry and a camera — so history UVs come from depth: unproject with
 *     this frame's *jittered* inverse view-projection (which is what the depth
 *     buffer was rendered with), then project with last frame's unjittered
 *     view-projection. Depth is dilated to the closest neighbour in a 5-tap
 *     cross first, so silhouettes take the foreground's motion and don't leave
 *     a smear of background history along their edge.
 *
 *  2. **Neighbourhood clamping.** History that disagrees with this frame's
 *     local colour distribution is wrong (disocclusion, a moving object, a
 *     shadow that moved). Variance clipping in YCoCg — an AABB from the mean
 *     and standard deviation of the 3x3 neighbourhood, rather than its raw
 *     min/max — is markedly tighter, which is what keeps ghosting down without
 *     reintroducing the flicker that the whole pass exists to remove.
 *
 * Both the current sample and the history are blended in a tone-mapped weight
 * space so a single bright sample cannot dominate the exponential average.
 */

import * as THREE from 'three';
import type { PostPass, IRenderContext } from '../../core/contracts';
import { frame, type PostContext } from '../../render/frame-state';
import { FullScreenQuad, GLSL_LIB, makeTarget } from './common';

const TAA_FRAG = /* glsl */ `
${GLSL_LIB}

in vec2 vUv;
out vec4 outColor;

uniform sampler2D tColor;
uniform sampler2D tHistory;
uniform sampler2D tDepth;

uniform mat4  uInvViewProjection;
uniform mat4  uPrevViewProjection;
uniform vec2  uTexel;
uniform float uFeedback;
uniform float uClampScale;
uniform float uReset;
uniform float uMotionScale;

void main() {
  vec3 current = texture(tColor, vUv).rgb;

  if (uReset > 0.5) {
    outColor = vec4(current, 1.0);
    return;
  }

  // --- depth dilation: take the nearest of a 5-tap cross ------------------
  float d = texture(tDepth, vUv).x;
  vec2 dilatedUv = vUv;
  {
    vec2 o = uTexel;
    vec2 offs[4] = vec2[4](vec2(-o.x, -o.y), vec2(o.x, -o.y), vec2(-o.x, o.y), vec2(o.x, o.y));
    for (int i = 0; i < 4; i++) {
      float dd = texture(tDepth, vUv + offs[i]).x;
      if (dd < d) { d = dd; dilatedUv = vUv + offs[i]; }
    }
  }

  // --- reprojection -------------------------------------------------------
  vec3 world = worldPosition(dilatedUv, d, uInvViewProjection);
  vec4 prevClip = uPrevViewProjection * vec4(world, 1.0);
  vec2 prevUv = vUv;
  float valid = 0.0;
  if (prevClip.w > 1e-5) {
    prevUv = (prevClip.xy / prevClip.w) * 0.5 + 0.5;
    valid = 1.0;
  }
  vec2 velocity = prevUv - dilatedUv;

  if (valid < 0.5 || any(lessThan(prevUv, vec2(0.0))) || any(greaterThan(prevUv, vec2(1.0)))) {
    outColor = vec4(current, 1.0);
    return;
  }

  // --- neighbourhood statistics in YCoCg ----------------------------------
  vec3 m1 = vec3(0.0);
  vec3 m2 = vec3(0.0);
  vec3 nmin = vec3(1e9);
  vec3 nmax = vec3(-1e9);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec3 c = rgbToYCoCg(tonemapWeight(max(texture(tColor, vUv + vec2(float(x), float(y)) * uTexel).rgb, vec3(0.0))));
      m1 += c;
      m2 += c * c;
      nmin = min(nmin, c);
      nmax = max(nmax, c);
    }
  }
  vec3 mean = m1 / 9.0;
  vec3 sigma = sqrt(max(vec3(0.0), m2 / 9.0 - mean * mean));

  // Wider box while the camera is moving fast — reprojection error is larger
  // and an over-tight clamp just throws the history away every frame.
  float scale = uClampScale * (1.0 + clamp(length(velocity) * uMotionScale, 0.0, 2.0));
  vec3 boxMin = max(nmin, mean - sigma * scale);
  vec3 boxMax = min(nmax, mean + sigma * scale);

  vec3 hist = rgbToYCoCg(tonemapWeight(max(texture(tHistory, prevUv).rgb, vec3(0.0))));
  vec3 cur = rgbToYCoCg(tonemapWeight(max(current, vec3(0.0))));

  // Clip toward the current sample along the ray rather than clamping per
  // channel — clamping shifts hue, clipping preserves it.
  vec3 centre = 0.5 * (boxMax + boxMin);
  vec3 extent = max(0.5 * (boxMax - boxMin), vec3(1e-5));
  vec3 ray = hist - centre;
  vec3 unit = ray / extent;
  float maxUnit = max(abs(unit.x), max(abs(unit.y), abs(unit.z)));
  if (maxUnit > 1.0) hist = centre + ray / maxUnit;

  // Reject a little more history the faster the image is moving.
  float feedback = uFeedback * (1.0 - clamp(length(velocity) * uMotionScale * 0.5, 0.0, 0.35));
  vec3 resolved = mix(cur, hist, feedback);

  outColor = vec4(tonemapUnweight(yCoCgToRgb(resolved)), 1.0);
}
`;

export class TaaPass implements PostPass {
  readonly id = 'taa';
  readonly order = 30;
  enabled = true;

  /** How much history survives each frame. 0.92 ~= an 12-frame average. */
  feedback = 0.92;
  /** Standard deviations of the neighbourhood the history may occupy. */
  clampScale = 1.35;
  motionScale = 60.0;

  private historyA: THREE.WebGLRenderTarget | null = null;
  private historyB: THREE.WebGLRenderTarget | null = null;
  private quad: FullScreenQuad;
  private primed = false;

  constructor() {
    this.quad = new FullScreenQuad(TAA_FRAG, {
      tColor: { value: null },
      tHistory: { value: null },
      tDepth: { value: null },
      uInvViewProjection: { value: new THREE.Matrix4() },
      uPrevViewProjection: { value: new THREE.Matrix4() },
      uTexel: { value: new THREE.Vector2() },
      uFeedback: { value: 0.92 },
      uClampScale: { value: 1.35 },
      uReset: { value: 1 },
      uMotionScale: { value: 60 },
    });
  }

  resize(w: number, h: number): void {
    this.historyA?.dispose();
    this.historyB?.dispose();
    this.historyA = makeTarget(w, h);
    this.historyB = makeTarget(w, h);
    this.primed = false;
  }

  render(ictx: IRenderContext, _dt: number): void {
    const ctx = ictx as PostContext;
    if (!this.historyA || !this.historyB) this.resize(frame.width, frame.height);
    const read = this.historyA!;
    const write = this.historyB!;

    const u = this.quad.uniforms;
    u.tColor.value = frame.current ?? ctx.sceneTarget.texture;
    u.tHistory.value = read.texture;
    u.tDepth.value = ctx.sceneTarget.depthTexture;
    (u.uInvViewProjection.value as THREE.Matrix4).copy(frame.invViewProjection);
    (u.uPrevViewProjection.value as THREE.Matrix4).copy(frame.prevViewProjection);
    (u.uTexel.value as THREE.Vector2).set(1 / frame.width, 1 / frame.height);
    u.uFeedback.value = this.feedback;
    u.uClampScale.value = this.clampScale;
    u.uMotionScale.value = this.motionScale;
    u.uReset.value = !this.primed || frame.resetHistory ? 1 : 0;

    this.quad.render(ctx.renderer, write);
    this.primed = true;

    this.historyA = write;
    this.historyB = read;
    frame.current = write.texture;
  }

  dispose(): void {
    this.historyA?.dispose();
    this.historyB?.dispose();
    this.quad.dispose();
  }
}
