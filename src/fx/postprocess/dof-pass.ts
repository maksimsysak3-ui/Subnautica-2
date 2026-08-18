/**
 * Depth of field — shallow focus while aiming.
 *
 * OWNED BY: Graphics team.
 *
 * Gameplay-motivated rather than simulation-motivated: a real rifle optic has
 * enormous depth of field, but shooters throw the background out of focus when
 * you shoulder the weapon because it collapses the frame onto the target. It is
 * a *readability* effect wearing a lens's clothes, so it is driven by
 * `frame.ads` and disabled entirely at zero.
 *
 * Gather rather than scatter: each pixel samples a disc whose radius is its own
 * circle of confusion, weighting each tap by whether that tap's CoC is large
 * enough to have reached here. That is the standard approximation and it gets
 * the important case right — a sharp foreground does not bleed onto a blurred
 * background, but a blurred background does bleed over a sharp edge.
 *
 * Samples are placed on a golden-angle spiral, which fills a disc far more
 * evenly than concentric rings at low tap counts and does not produce the
 * rosette pattern rings give you.
 */

import * as THREE from 'three';
import type { PostPass, IRenderContext } from '../../core/contracts';
import { frame, type PostContext } from '../../render/frame-state';
import { FullScreenQuad, GLSL_LIB, writeAndSwap } from './common';

const DOF_FRAG = /* glsl */ `
${GLSL_LIB}

in vec2 vUv;
out vec4 outColor;

uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2  uTexel;
uniform float uNear;
uniform float uFar;
uniform float uFocusDistance;
uniform float uFocusRange;
uniform float uMaxCoc;      // in pixels
uniform float uAmount;

const float GOLDEN = 2.39996323;

float cocAt(float depth) {
  float d = linearDepth(depth, uNear, uFar);
  // Signed CoC: negative in front of the focal plane, positive behind. Only the
  // magnitude drives the blur, but the sign is what makes near/far falloff
  // asymmetric, which is how real optics behave.
  float c = (d - uFocusDistance) / max(d, 1e-3);
  c = c / max(uFocusRange, 1e-3);
  return clamp(c, -1.0, 1.0);
}

void main() {
  vec3 centre = texture(tColor, vUv).rgb;
  float centreCoc = cocAt(texture(tDepth, vUv).x);
  float radius = abs(centreCoc) * uMaxCoc * uAmount;

  if (radius < 0.75) { outColor = vec4(centre, 1.0); return; }

  float rot = igNoise(gl_FragCoord.xy) * 6.2831853;
  vec3 sum = centre;
  float wsum = 1.0;

  for (int i = 1; i <= DOF_TAPS; i++) {
    float fi = float(i);
    float a = fi * GOLDEN + rot;
    float r = sqrt(fi / float(DOF_TAPS)) * radius;
    vec2 uv = vUv + vec2(cos(a), sin(a)) * r * uTexel;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) continue;

    float sCoc = cocAt(texture(tDepth, uv).x);
    float sRadius = abs(sCoc) * uMaxCoc * uAmount;
    // A tap only contributes if its own CoC is wide enough to have spread this
    // far — otherwise a sharp foreground would leak onto the blurred plate.
    float w = clamp((sRadius - r) * 0.5 + 1.0, 0.0, 1.0);
    // Never pull an in-focus foreground into a defocused background.
    if (sCoc < 0.0 && centreCoc > 0.0) w *= 0.25;

    sum += texture(tColor, uv).rgb * w;
    wsum += w;
  }

  outColor = vec4(sum / wsum, 1.0);
}
`;

export class DofPass implements PostPass {
  readonly id = 'dof';
  readonly order = 50;
  enabled = true;

  /** Metres. Overridden per frame from the ADS state when > 0. */
  focusDistance = 30;
  focusRange = 0.55;
  maxCoc = 14;
  /** Overall strength; scaled by ADS progress. */
  amount = 1.0;

  private quad: FullScreenQuad;
  private quality = -1;

  constructor() {
    this.quad = new FullScreenQuad(
      DOF_FRAG,
      {
        tColor: { value: null },
        tDepth: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uNear: { value: 0.05 },
        uFar: { value: 4000 },
        uFocusDistance: { value: 30 },
        uFocusRange: { value: 0.55 },
        uMaxCoc: { value: 14 },
        uAmount: { value: 1 },
      },
      { DOF_TAPS: 12 },
    );
  }

  render(ictx: IRenderContext, _dt: number): void {
    const ctx = ictx as PostContext;
    const ads = frame.ads;
    if (ads < 0.02) return;

    if (ctx.quality !== this.quality) {
      this.quality = ctx.quality;
      this.quad.setDefines({ DOF_TAPS: ctx.quality >= 3 ? 20 : 12 });
    }

    const u = this.quad.uniforms;
    u.tColor.value = frame.current ?? ctx.sceneTarget.texture;
    u.tDepth.value = ctx.sceneTarget.depthTexture;
    (u.uTexel.value as THREE.Vector2).set(1 / frame.width, 1 / frame.height);
    u.uNear.value = frame.near;
    u.uFar.value = frame.far;
    u.uFocusDistance.value = this.focusDistance;
    u.uFocusRange.value = this.focusRange;
    u.uMaxCoc.value = this.maxCoc;
    u.uAmount.value = this.amount * ads;

    writeAndSwap(ctx, this.quad);
  }

  dispose(): void {
    this.quad.dispose();
  }
}
