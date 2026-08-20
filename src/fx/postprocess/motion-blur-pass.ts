/**
 * Camera motion blur.
 *
 * OWNED BY: Graphics team.
 *
 * Velocity comes from depth reprojection rather than a velocity buffer: the
 * world is static geometry, so the only thing moving is the camera, and the
 * camera's contribution is exactly recoverable from depth plus last frame's
 * view-projection. Object motion blur would need a velocity target and a second
 * scene pass; that trade is not worth it for the amount of the frame that is
 * ever a moving object.
 *
 * The blur is a straight line integral along the per-pixel velocity, with taps
 * rejected when their depth is much further than the centre. Without that
 * rejection the background smears *over* a near silhouette during a fast turn,
 * which is the single most recognisable motion blur artefact.
 *
 * Shutter is expressed as a fraction of a frame — 0.5 is a 180-degree shutter,
 * the film convention, and it is deliberately conservative. In a shooter the
 * player is turning to acquire a target; blurring so hard they cannot see it is
 * a gameplay bug, not a look.
 */

import * as THREE from 'three';
import type { PostPass, IRenderContext } from '../../core/contracts';
import { frame, type PostContext } from '../../render/frame-state';
import { FullScreenQuad, GLSL_LIB, writeAndSwap } from './common';

const BLUR_FRAG = /* glsl */ `
${GLSL_LIB}

in vec2 vUv;
out vec4 outColor;

uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform float uNear;
uniform float uFar;
uniform mat4  uInvViewProjection;
uniform mat4  uPrevViewProjection;
uniform vec2  uTexel;
uniform float uShutter;
uniform float uMaxVelocity;
uniform float uDepthReject;

void main() {
  float depth = texture(tDepth, vUv).x;
  vec3 world = worldPosition(vUv, depth, uInvViewProjection);
  vec4 prevClip = uPrevViewProjection * vec4(world, 1.0);

  vec3 centre = texture(tColor, vUv).rgb;
  if (prevClip.w <= 1e-5) { outColor = vec4(centre, 1.0); return; }

  vec2 prevUv = (prevClip.xy / prevClip.w) * 0.5 + 0.5;
  vec2 velocity = (vUv - prevUv) * uShutter;

  float speed = length(velocity / uTexel);
  if (speed < 1.5) { outColor = vec4(centre, 1.0); return; }
  if (speed > uMaxVelocity) velocity *= uMaxVelocity / speed;

  float centreDepth = linearDepth(depth, uNear, uFar);

  vec3 sum = centre;
  float wsum = 1.0;
  float jitter = igNoise(gl_FragCoord.xy) - 0.5;

  for (int i = 1; i <= MB_TAPS; i++) {
    float t = (float(i) + jitter) / float(MB_TAPS);
    for (int s = 0; s < 2; s++) {
      vec2 uv = vUv + velocity * t * (s == 0 ? -1.0 : 1.0);
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) continue;
      float sd = linearDepth(texture(tDepth, uv).x, 0.05, 4000.0);
      // Reject taps that sit far behind the centre — background must not
      // smear across a foreground silhouette.
      float w = (1.0 - t) * (sd > centreDepth * uDepthReject ? 0.15 : 1.0);
      sum += texture(tColor, uv).rgb * w;
      wsum += w;
    }
  }

  outColor = vec4(sum / wsum, 1.0);
}
`;

export class MotionBlurPass implements PostPass {
  readonly id = 'motionBlur';
  readonly order = 40;
  enabled = true;

  /** Fraction of the frame interval the shutter is open. 0.5 = 180 degrees. */
  shutter = 0.5;
  /** Hard cap on smear length, in pixels. */
  maxVelocity = 32;
  depthReject = 1.35;

  private quad: FullScreenQuad;
  private quality = -1;

  constructor() {
    this.quad = new FullScreenQuad(
      BLUR_FRAG,
      {
        tColor: { value: null },
        tDepth: { value: null },
        uInvViewProjection: { value: new THREE.Matrix4() },
        uPrevViewProjection: { value: new THREE.Matrix4() },
        uTexel: { value: new THREE.Vector2() },
        uShutter: { value: 0.5 },
        uMaxVelocity: { value: 32 },
        uDepthReject: { value: 1.35 },
      },
      { MB_TAPS: 4 },
    );
  }

  render(ictx: IRenderContext, _dt: number): void {
    const ctx = ictx as PostContext;

    // Nothing moved — skip the whole pass rather than pay for a no-op blur.
    if (frame.cameraDelta < 0.002 && frame.cameraTurn < 0.0012) return;
    if (frame.resetHistory) return;

    if (ctx.quality !== this.quality) {
      this.quality = ctx.quality;
      this.quad.setDefines({ MB_TAPS: ctx.quality >= 3 ? 6 : 4 });
    }

    const u = this.quad.uniforms;
    u.tColor.value = frame.current ?? ctx.sceneTarget.texture;
    u.tDepth.value = ctx.sceneTarget.depthTexture;
    (u.uInvViewProjection.value as THREE.Matrix4).copy(frame.invViewProjection);
    (u.uPrevViewProjection.value as THREE.Matrix4).copy(frame.prevViewProjection);
    (u.uTexel.value as THREE.Vector2).set(1 / frame.width, 1 / frame.height);
    u.uShutter.value = this.shutter;
    u.uMaxVelocity.value = this.maxVelocity;
    u.uDepthReject.value = this.depthReject;

    writeAndSwap(ctx, this.quad);
  }

  dispose(): void {
    this.quad.dispose();
  }
}
