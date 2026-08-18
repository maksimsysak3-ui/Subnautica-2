/**
 * Bloom — thresholded, energy-conserving mip pyramid.
 *
 * OWNED BY: Graphics team.
 *
 * The dual-filter pyramid (Jimenez, "Next Generation Post Processing in Call of
 * Duty: Advanced Warfare"): a 13-tap partial-Karis-average downsample chain and
 * a 9-tap tent upsample chain. The reason for the pyramid rather than a single
 * wide Gaussian is that real lens glare has energy at every scale — a tight
 * core, a broad halo — and a pyramid gives you that shape for a handful of
 * tiny draws instead of one enormous kernel.
 *
 * The threshold is *exposure-relative*: a highlight only blooms if it is bright
 * relative to what the eye has adapted to. A fixed threshold would make the
 * whole night scene bloom the moment auto exposure opened up.
 *
 * Restraint: the threshold sits above diffuse white on purpose. Sky, sun disc,
 * specular hits and muzzle flashes bloom. Lit concrete does not.
 */

import * as THREE from 'three';
import type { PostPass, IRenderContext } from '../../core/contracts';
import { frame, type PostContext } from '../../render/frame-state';
import { FullScreenQuad, GLSL_LIB, makeTarget } from './common';

const PREFILTER_FRAG = /* glsl */ `
${GLSL_LIB}

in vec2 vUv;
out vec4 outColor;

uniform sampler2D tColor;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uKnee;
uniform sampler2D tExposure;
uniform float uHasExposure;
uniform float uExposure;
uniform float uClamp;

vec3 prefilter(vec3 c, float exposure) {
  // Threshold in adapted (exposure-relative) units, then return to scene units
  // so the composite can add before exposure is applied.
  c = min(c * exposure, vec3(uClamp));
  float br = maxc(c);
  float soft = br - uThreshold + uKnee;
  soft = clamp(soft, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-5);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-5);
  return c * contrib / max(exposure, 1e-4);
}

void main() {
  float exposure = uExposure;
  if (uHasExposure > 0.5) exposure *= texture(tExposure, vec2(0.5)).r;

  // 4-tap box at the half-res sample points keeps the first mip stable.
  vec3 a = texture(tColor, vUv + vec2(-uTexel.x, -uTexel.y)).rgb;
  vec3 b = texture(tColor, vUv + vec2( uTexel.x, -uTexel.y)).rgb;
  vec3 c = texture(tColor, vUv + vec2(-uTexel.x,  uTexel.y)).rgb;
  vec3 d = texture(tColor, vUv + vec2( uTexel.x,  uTexel.y)).rgb;

  // Karis average: weight each tap by 1/(1+luma) before summing so a single
  // fireflying pixel cannot dominate the mip.
  float wa = 1.0 / (1.0 + luminance(a));
  float wb = 1.0 / (1.0 + luminance(b));
  float wc = 1.0 / (1.0 + luminance(c));
  float wd = 1.0 / (1.0 + luminance(d));
  vec3 sum = (a * wa + b * wb + c * wc + d * wd) / max(1e-5, wa + wb + wc + wd);

  outColor = vec4(prefilter(max(sum, vec3(0.0)), exposure), 1.0);
}
`;

const DOWN_FRAG = /* glsl */ `
${GLSL_LIB}

in vec2 vUv;
out vec4 outColor;

uniform sampler2D tSrc;
uniform vec2 uTexel;

void main() {
  vec2 t = uTexel;
  vec3 a = texture(tSrc, vUv + vec2(-2.0 * t.x,  2.0 * t.y)).rgb;
  vec3 b = texture(tSrc, vUv + vec2( 0.0,        2.0 * t.y)).rgb;
  vec3 c = texture(tSrc, vUv + vec2( 2.0 * t.x,  2.0 * t.y)).rgb;
  vec3 d = texture(tSrc, vUv + vec2(-2.0 * t.x,  0.0)).rgb;
  vec3 e = texture(tSrc, vUv).rgb;
  vec3 f = texture(tSrc, vUv + vec2( 2.0 * t.x,  0.0)).rgb;
  vec3 g = texture(tSrc, vUv + vec2(-2.0 * t.x, -2.0 * t.y)).rgb;
  vec3 h = texture(tSrc, vUv + vec2( 0.0,       -2.0 * t.y)).rgb;
  vec3 i = texture(tSrc, vUv + vec2( 2.0 * t.x, -2.0 * t.y)).rgb;
  vec3 j = texture(tSrc, vUv + vec2(-t.x,  t.y)).rgb;
  vec3 k = texture(tSrc, vUv + vec2( t.x,  t.y)).rgb;
  vec3 l = texture(tSrc, vUv + vec2(-t.x, -t.y)).rgb;
  vec3 m = texture(tSrc, vUv + vec2( t.x, -t.y)).rgb;

  vec3 res = e * 0.125;
  res += (a + c + g + i) * 0.03125;
  res += (b + d + f + h) * 0.0625;
  res += (j + k + l + m) * 0.125;

  outColor = vec4(res, 1.0);
}
`;

const UP_FRAG = /* glsl */ `
${GLSL_LIB}

in vec2 vUv;
out vec4 outColor;

uniform sampler2D tLower;   // smaller mip, being spread
uniform sampler2D tHigher;  // same-size mip from the down chain
uniform vec2 uTexel;
uniform float uRadius;
uniform float uMix;

void main() {
  vec2 t = uTexel * uRadius;

  // 3x3 tent — the filter that makes the pyramid look like glass instead of
  // like a stack of boxes.
  vec3 s = texture(tLower, vUv + vec2(-t.x,  t.y)).rgb
         + texture(tLower, vUv + vec2( 0.0,  t.y)).rgb * 2.0
         + texture(tLower, vUv + vec2( t.x,  t.y)).rgb
         + texture(tLower, vUv + vec2(-t.x,  0.0)).rgb * 2.0
         + texture(tLower, vUv).rgb * 4.0
         + texture(tLower, vUv + vec2( t.x,  0.0)).rgb * 2.0
         + texture(tLower, vUv + vec2(-t.x, -t.y)).rgb
         + texture(tLower, vUv + vec2( 0.0, -t.y)).rgb * 2.0
         + texture(tLower, vUv + vec2( t.x, -t.y)).rgb;
  s *= 1.0 / 16.0;

  vec3 base = texture(tHigher, vUv).rgb;
  // Lerp rather than add: total energy stays put as it climbs the pyramid,
  // which is what stops bloom from turning into a white-out at high strength.
  outColor = vec4(mix(base, s, uMix), 1.0);
}
`;

export class BloomPass implements PostPass {
  readonly id = 'bloom';
  readonly order = 70;
  enabled = true;

  /** Exposure-relative brightness where bloom starts. 1.0 = diffuse white. */
  threshold = 1.0;
  knee = 0.6;
  /** Firefly clamp in adapted units. */
  clamp = 40.0;
  radius = 1.0;
  /** Blend of the lower mip into each level while climbing back up. */
  mix = 0.6;

  private down: THREE.WebGLRenderTarget[] = [];
  private up: THREE.WebGLRenderTarget[] = [];
  private prefilterQuad: FullScreenQuad;
  private downQuad: FullScreenQuad;
  private upQuad: FullScreenQuad;
  private width = 1;
  private height = 1;

  constructor() {
    this.prefilterQuad = new FullScreenQuad(PREFILTER_FRAG, {
      tColor: { value: null },
      tExposure: { value: null },
      uHasExposure: { value: 0 },
      uTexel: { value: new THREE.Vector2() },
      uThreshold: { value: 1.0 },
      uKnee: { value: 0.6 },
      uExposure: { value: 1 },
      uClamp: { value: 40 },
    });
    this.downQuad = new FullScreenQuad(DOWN_FRAG, {
      tSrc: { value: null },
      uTexel: { value: new THREE.Vector2() },
    });
    this.upQuad = new FullScreenQuad(UP_FRAG, {
      tLower: { value: null },
      tHigher: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uRadius: { value: 1 },
      uMix: { value: 0.6 },
    });
  }

  resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    this.rebuild();
  }

  private rebuild(): void {
    for (const t of this.down) t.dispose();
    for (const t of this.up) t.dispose();
    this.down = [];
    this.up = [];

    let w = Math.max(1, Math.floor(this.width / 2));
    let h = Math.max(1, Math.floor(this.height / 2));
    const levels = Math.max(2, Math.min(6, Math.floor(Math.log2(Math.min(w, h))) - 1));
    for (let i = 0; i < levels; i++) {
      this.down.push(makeTarget(w, h));
      // One upsample target per level except the smallest, which is the seed.
      if (i < levels - 1) this.up.push(makeTarget(w, h));
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
    }
  }

  render(ictx: IRenderContext, _dt: number): void {
    const ctx = ictx as PostContext;
    if (this.down.length === 0) this.rebuild();
    if (this.down.length < 2) return;

    const r = ctx.renderer;
    const src = frame.current ?? ctx.sceneTarget.texture;

    // --- prefilter into mip 0 ---------------------------------------------
    const p = this.prefilterQuad.uniforms;
    p.tColor.value = src;
    (p.uTexel.value as THREE.Vector2).set(1 / frame.width, 1 / frame.height);
    p.uThreshold.value = this.threshold;
    p.uKnee.value = this.knee;
    p.uClamp.value = this.clamp;
    p.tExposure.value = frame.exposureTexture;
    p.uHasExposure.value = frame.exposureTexture ? 1 : 0;
    p.uExposure.value = frame.exposure;
    this.prefilterQuad.render(r, this.down[0]);

    // --- downsample chain --------------------------------------------------
    const d = this.downQuad.uniforms;
    for (let i = 1; i < this.down.length; i++) {
      d.tSrc.value = this.down[i - 1].texture;
      (d.uTexel.value as THREE.Vector2).set(1 / this.down[i - 1].width, 1 / this.down[i - 1].height);
      this.downQuad.render(r, this.down[i]);
    }

    // --- upsample chain ----------------------------------------------------
    const u = this.upQuad.uniforms;
    u.uRadius.value = this.radius;
    u.uMix.value = this.mix;
    let lower = this.down[this.down.length - 1].texture;
    for (let i = this.down.length - 2; i >= 0; i--) {
      const dst = this.up[i];
      u.tLower.value = lower;
      u.tHigher.value = this.down[i].texture;
      (u.uTexel.value as THREE.Vector2).set(1 / dst.width, 1 / dst.height);
      this.upQuad.render(r, dst);
      lower = dst.texture;
    }

    frame.bloomTexture = lower;
  }

  dispose(): void {
    for (const t of this.down) t.dispose();
    for (const t of this.up) t.dispose();
    this.prefilterQuad.dispose();
    this.downQuad.dispose();
    this.upQuad.dispose();
    frame.bloomTexture = null;
  }
}
