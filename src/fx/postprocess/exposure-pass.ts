/**
 * Auto exposure — log-average luminance with temporal adaptation.
 *
 * OWNED BY: Graphics team.
 *
 * A 24-hour cycle plus interiors means the scene's radiance range spans several
 * orders of magnitude. A fixed exposure either blows out noon or loses night, so
 * the grade has to be metered rather than authored.
 *
 * Implementation: render log-luminance into a 64x64 target, box-reduce
 * 64 -> 16 -> 4 -> 1, then blend the 1x1 result into a persistent 1x1 target
 * with an exponential time constant. Log-average (geometric mean) rather than
 * arithmetic mean because a small very bright region — a sun disc, a muzzle
 * flash — must not stop the eye down; that is precisely the failure everyone
 * recognises as "cheap auto exposure".
 *
 * Adaptation is asymmetric: eyes and camera irises close faster than they open,
 * so brightening is slower than darkening. It is also centre-weighted, because
 * what the player is looking at should drive the exposure, not the sky in the
 * top corner.
 */

import * as THREE from 'three';
import type { PostPass, IRenderContext } from '../../core/contracts';
import { frame, type PostContext } from '../../render/frame-state';
import { FullScreenQuad, GLSL_LIB, makeTarget } from './common';

const LUM_FRAG = /* glsl */ `
${GLSL_LIB}

in vec2 vUv;
out vec4 outColor;

uniform sampler2D tColor;
uniform float uMinLum;
uniform float uMaxLum;
uniform float uCenterWeight;

void main() {
  vec3 c = texture(tColor, vUv).rgb;
  float l = clamp(luminance(max(c, vec3(0.0))), uMinLum, uMaxLum);

  // Centre weighting: a smooth radial falloff, never zero so a bright sky still
  // contributes something.
  vec2 d = vUv - 0.5;
  float w = mix(1.0, exp(-dot(d, d) * 3.5), uCenterWeight);

  outColor = vec4(log(l) * w, w, 0.0, 1.0);
}
`;

const REDUCE_FRAG = /* glsl */ `
${GLSL_LIB}

in vec2 vUv;
out vec4 outColor;

uniform sampler2D tSrc;
uniform vec2 uTexel;

void main() {
  vec2 sum = vec2(0.0);
  for (int y = 0; y < 4; y++) {
    for (int x = 0; x < 4; x++) {
      vec2 o = (vec2(float(x), float(y)) - 1.5) * uTexel;
      sum += texture(tSrc, vUv + o).rg;
    }
  }
  outColor = vec4(sum / 16.0, 0.0, 1.0);
}
`;

const ADAPT_FRAG = /* glsl */ `
${GLSL_LIB}

in vec2 vUv;
out vec4 outColor;

uniform sampler2D tCurrent;
uniform sampler2D tPrev;
uniform float uDt;
uniform float uSpeedUp;
uniform float uSpeedDown;
uniform float uKey;
uniform float uMinExposure;
uniform float uMaxExposure;
uniform float uReset;

void main() {
  vec2 acc = texture(tCurrent, vec2(0.5)).rg;
  float target = exp(acc.r / max(acc.g, 1e-5));

  float prev = texture(tPrev, vec2(0.5)).g;
  if (uReset > 0.5 || prev <= 0.0) prev = target;

  // Asymmetric: opening up (scene got darker) is the slow direction.
  // A brighter scene means the iris must close, which is the fast direction;
  // adapting to darkness is the slow one. These were swapped, so stepping out
  // of a building stayed blown out for about two seconds.
  float rate = target > prev ? uSpeedUp : uSpeedDown;
  float adapted = mix(prev, target, 1.0 - exp(-uDt * rate));

  float exposure = clamp(uKey / max(adapted, 1e-4), uMinExposure, uMaxExposure);
  outColor = vec4(exposure, adapted, 0.0, 1.0);
}
`;

export class ExposurePass implements PostPass {
  readonly id = 'exposure';
  readonly order = 60;
  enabled = true;

  /** Middle-grey target. Higher = brighter image. */
  key = 0.17;
  minExposure = 0.06;
  maxExposure = 6.5;
  /** e-folds per second when the scene brightens / darkens. */
  speedUp = 2.4;
  speedDown = 1.1;
  centerWeight = 0.85;

  private lum: THREE.WebGLRenderTarget;
  private reduce16: THREE.WebGLRenderTarget;
  private reduce4: THREE.WebGLRenderTarget;
  private reduce1: THREE.WebGLRenderTarget;
  private adaptA: THREE.WebGLRenderTarget;
  private adaptB: THREE.WebGLRenderTarget;

  private lumQuad: FullScreenQuad;
  private reduceQuad: FullScreenQuad;
  private adaptQuad: FullScreenQuad;
  private primed = false;

  constructor() {
    const opts = { type: THREE.FloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.lum = makeTarget(64, 64, opts);
    this.reduce16 = makeTarget(16, 16, opts);
    this.reduce4 = makeTarget(4, 4, opts);
    this.reduce1 = makeTarget(1, 1, opts);
    this.adaptA = makeTarget(1, 1, opts);
    this.adaptB = makeTarget(1, 1, opts);

    this.lumQuad = new FullScreenQuad(LUM_FRAG, {
      tColor: { value: null },
      // A floor on the metered luminance matters more than it looks: an
      // unlit wall filling half the frame has a log-luminance of -7, which
      // would drag a geometric mean into opening the iris four stops and
      // blowing out everything the sun touches.
      uMinLum: { value: 0.010 },
      // Clamp the metering ceiling well below sky luminance. The sky is the
      // brightest thing in almost every outdoor frame; letting it into the
      // log-average unclamped drags exposure down until the ground goes black,
      // which is the classic "correctly exposed sky, silhouetted world" bug.
      uMaxLum: { value: 6 },
      uCenterWeight: { value: 0.75 },
    });

    this.reduceQuad = new FullScreenQuad(REDUCE_FRAG, {
      tSrc: { value: null },
      uTexel: { value: new THREE.Vector2() },
    });

    this.adaptQuad = new FullScreenQuad(ADAPT_FRAG, {
      tCurrent: { value: null },
      tPrev: { value: null },
      uDt: { value: 1 / 60 },
      uSpeedUp: { value: 2.4 },
      uSpeedDown: { value: 1.1 },
      uKey: { value: 0.10 },
      uMinExposure: { value: 0.06 },
      uMaxExposure: { value: 5 },
      uReset: { value: 1 },
    });
  }

  render(ictx: IRenderContext, dt: number): void {
    const ctx = ictx as PostContext;
    const r = ctx.renderer;
    const src = frame.current ?? ctx.sceneTarget.texture;

    this.lumQuad.uniforms.tColor.value = src;
    this.lumQuad.uniforms.uCenterWeight.value = this.centerWeight;
    this.lumQuad.render(r, this.lum);

    const ru = this.reduceQuad.uniforms;
    ru.tSrc.value = this.lum.texture;
    (ru.uTexel.value as THREE.Vector2).set(1 / 64, 1 / 64);
    this.reduceQuad.render(r, this.reduce16);

    ru.tSrc.value = this.reduce16.texture;
    (ru.uTexel.value as THREE.Vector2).set(1 / 16, 1 / 16);
    this.reduceQuad.render(r, this.reduce4);

    ru.tSrc.value = this.reduce4.texture;
    (ru.uTexel.value as THREE.Vector2).set(1 / 4, 1 / 4);
    this.reduceQuad.render(r, this.reduce1);

    const au = this.adaptQuad.uniforms;
    au.tCurrent.value = this.reduce1.texture;
    au.tPrev.value = this.adaptA.texture;
    au.uDt.value = Math.min(0.1, Math.max(1e-4, dt));
    au.uSpeedUp.value = this.speedUp;
    au.uSpeedDown.value = this.speedDown;
    au.uKey.value = this.key;
    au.uMinExposure.value = this.minExposure;
    au.uMaxExposure.value = this.maxExposure;
    au.uReset.value = !this.primed || frame.resetHistory ? 1 : 0;
    this.adaptQuad.render(r, this.adaptB);
    this.primed = true;

    const t = this.adaptA;
    this.adaptA = this.adaptB;
    this.adaptB = t;

    frame.exposureTexture = this.adaptA.texture;
  }

  dispose(): void {
    this.lum.dispose();
    this.reduce16.dispose();
    this.reduce4.dispose();
    this.reduce1.dispose();
    this.adaptA.dispose();
    this.adaptB.dispose();
    this.lumQuad.dispose();
    this.reduceQuad.dispose();
    this.adaptQuad.dispose();
    frame.exposureTexture = null;
  }
}
