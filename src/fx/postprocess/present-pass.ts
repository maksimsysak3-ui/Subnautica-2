/**
 * Present — the only pass that writes to the default framebuffer, and the only
 * place linear scene radiance becomes display-referred pixels.
 *
 * OWNED BY: Graphics team.
 *
 * The render system looks specifically for a pass with `id: 'present'`; if one
 * is enabled it skips its fallback blit. Everything up to here works in linear
 * HDR with no tone mapping, because a `RawShaderMaterial` gets none of three's
 * automatic output conversion. That is deliberate — a single, explicit transfer
 * function is far easier to reason about than three's implicit one, and it lets
 * the grade sit in the right place relative to bloom and exposure.
 *
 * Order of operations, and why:
 *   1. CAS sharpen, in a Reinhard-weighted space so it cannot ring on
 *      highlights. Sharpening before tone mapping keeps the kernel linear.
 *   2. Chromatic aberration, sampled radially. Applied pre-tonemap so the
 *      fringe rolls off with the highlight instead of clipping.
 *   3. Bloom add, then auto-exposure. Exposure last of the linear steps so the
 *      bloom threshold stays exposure-relative.
 *   4. White balance and a gentle split-tone (teal shadow / warm highlight) in
 *      linear, where a colour shift behaves like a light, not a paint layer.
 *   5. ACES RRT+ODT (Stephen Hill's fit) to display linear.
 *   6. Lift/gamma/gain, contrast pivot, saturation — display-referred trims.
 *   7. Vignette, film grain that scales with darkness, sRGB encode, ordered
 *      dither to kill 8-bit banding in the sky gradient.
 *
 * The restraint rule: every trim here is single-digit percent. It should read
 * as a print, not a filter.
 */

import * as THREE from 'three';
import type { PostPass, IRenderContext } from '../../core/contracts';
import { frame, type PostContext } from '../../render/frame-state';
import { FullScreenQuad, GLSL_LIB } from './common';

const PRESENT_FRAG = /* glsl */ `
${GLSL_LIB}

in vec2 vUv;
out vec4 outColor;

uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform sampler2D tExposure;

uniform vec2  uTexel;
uniform float uTime;
uniform float uFrameIndex;

uniform float uSharpen;
uniform float uAberration;
uniform float uBloomStrength;
uniform float uHasBloom;
uniform float uHasExposure;
uniform float uExposure;

uniform vec3  uWhiteBalance;
uniform vec3  uShadowTint;
uniform vec3  uHighlightTint;
uniform float uSplitBalance;

uniform vec3  uLift;
uniform vec3  uGamma;
uniform vec3  uGain;
uniform float uContrast;
uniform float uSaturation;

uniform float uVignette;
uniform float uVignetteRound;
uniform float uGrain;
uniform float uAspect;

// --- ACES (Stephen Hill fit) ----------------------------------------------
const mat3 ACES_IN = mat3(
  0.59719, 0.07600, 0.02840,
  0.35458, 0.90834, 0.13383,
  0.04823, 0.01566, 0.83777);
const mat3 ACES_OUT = mat3(
   1.60475, -0.10208, -0.00327,
  -0.53108,  1.10813, -0.07276,
  -0.07367, -0.00605,  1.07602);

vec3 rrtOdtFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}

vec3 acesFitted(vec3 c) {
  c = ACES_IN * c;
  c = rrtOdtFit(c);
  c = ACES_OUT * c;
  return clamp(c, 0.0, 1.0);
}

/**
 * FidelityFX CAS, adaptive-sharpen core. Operating on tone-weighted colour
 * bounds the kernel so a 200x highlight cannot produce a black halo.
 */
vec3 casSharpen(vec2 uv, out vec3 rawCenter) {
  vec3 c = texture(tColor, uv).rgb;
  rawCenter = c;
  if (uSharpen <= 0.0001) return c;

  vec3 n = texture(tColor, uv + vec2(0.0,  uTexel.y)).rgb;
  vec3 s = texture(tColor, uv - vec2(0.0,  uTexel.y)).rgb;
  vec3 e = texture(tColor, uv + vec2(uTexel.x, 0.0)).rgb;
  vec3 w = texture(tColor, uv - vec2(uTexel.x, 0.0)).rgb;

  vec3 tc = tonemapWeight(c);
  vec3 tn = tonemapWeight(n), ts = tonemapWeight(s);
  vec3 te = tonemapWeight(e), tw = tonemapWeight(w);

  vec3 mn = min(tc, min(min(tn, ts), min(te, tw)));
  vec3 mx = max(tc, max(max(tn, ts), max(te, tw)));

  // Local contrast drives the amount: flat regions are left alone (no noise
  // amplification), edges get the full kernel.
  vec3 amp = sqrt(clamp(min(mn, max(vec3(0.0), 1.0 - mx)) / max(mx, vec3(1e-4)), 0.0, 1.0));
  vec3 wgt = -amp * uSharpen * 0.2;

  vec3 res = (tn + ts + te + tw) * wgt + tc;
  res /= (4.0 * wgt + 1.0);
  return tonemapUnweight(max(res, vec3(0.0)));
}

void main() {
  vec2 uv = vUv;

  vec3 raw;
  vec3 color = casSharpen(uv, raw);

  // --- chromatic aberration: radial, zero at centre, quadratic to the edge.
  if (uAberration > 0.0001) {
    vec2 d = uv - 0.5;
    float r2 = dot(d, d) * 4.0;
    vec2 off = d * r2 * uAberration * 0.01;
    float cr = texture(tColor, clamp(uv + off, vec2(0.0), vec2(1.0))).r;
    float cb = texture(tColor, clamp(uv - off, vec2(0.0), vec2(1.0))).b;
    float k = clamp(r2, 0.0, 1.0);
    color.r = mix(color.r, cr, k);
    color.b = mix(color.b, cb, k);
  }

  // --- bloom -------------------------------------------------------------
  if (uHasBloom > 0.5) {
    color += texture(tBloom, uv).rgb * uBloomStrength;
  }

  // --- exposure ----------------------------------------------------------
  float exposure = uExposure;
  if (uHasExposure > 0.5) {
    exposure *= texture(tExposure, vec2(0.5)).r;
  }
  color *= exposure;

  // --- linear-domain grade ------------------------------------------------
  color *= uWhiteBalance;

  // Split tone. Weight by a soft luminance ramp so midtones stay neutral —
  // this is what reads as "graded" rather than "tinted".
  float lum = luminance(color);
  float shadowW = 1.0 - smoothstep(0.0, uSplitBalance, lum);
  float highW = smoothstep(uSplitBalance, uSplitBalance * 4.0, lum);
  color *= mix(vec3(1.0), uShadowTint, shadowW * 0.5);
  color *= mix(vec3(1.0), uHighlightTint, highW * 0.5);

  // --- tone map -----------------------------------------------------------
  color = acesFitted(max(color, vec3(0.0)));

  // --- display-referred trims ---------------------------------------------
  color = color * uGain + uLift * (1.0 - color);
  color = pow(max(color, vec3(0.0)), uGamma);
  color = clamp((color - 0.18) * uContrast + 0.18, 0.0, 1.0);

  float g = luminance(color);
  color = clamp(mix(vec3(g), color, uSaturation), 0.0, 1.0);

  // --- vignette -----------------------------------------------------------
  vec2 vd = (uv - 0.5) * vec2(mix(1.0, uAspect, uVignetteRound), 1.0);
  float vig = 1.0 - uVignette * smoothstep(0.30, 0.78, length(vd));
  color *= vig;

  // --- grain: heavier in the dark, where a real sensor's noise floor lives --
  if (uGrain > 0.0001) {
    float n = igNoise(uv * uTexel.x * 0.0 + gl_FragCoord.xy + uFrameIndex * 13.7) - 0.5;
    float darkness = 1.0 - smoothstep(0.02, 0.55, luminance(color));
    color += n * uGrain * (0.25 + 0.75 * darkness);
  }

  color = linearToSrgb(max(color, vec3(0.0)));

  // Ordered-ish dither before the 8-bit backbuffer. Without this the sky
  // gradient bands visibly at any tone curve worth having.
  color += (hash12(gl_FragCoord.xy + uFrameIndex * 0.017) - 0.5) / 255.0;

  outColor = vec4(color, 1.0);
}
`;

/** Named grade presets — the game picks one, artists can tweak in place. */
export interface GradeSettings {
  whiteBalance: THREE.Vector3;
  shadowTint: THREE.Vector3;
  highlightTint: THREE.Vector3;
  splitBalance: number;
  lift: THREE.Vector3;
  gamma: THREE.Vector3;
  gain: THREE.Vector3;
  contrast: number;
  saturation: number;
}

export class PresentPass implements PostPass {
  readonly id = 'present';
  readonly order = 1000;
  enabled = true;

  /** Manual exposure multiplier, folded in on top of auto exposure. */
  exposure = 1.0;
  bloomStrength = 1.0;
  sharpen = 0.6;
  aberration = 0.0;
  vignette = 0.34;
  grain = 0.018;

  private quad: FullScreenQuad;

  constructor() {
    this.quad = new FullScreenQuad(PRESENT_FRAG, {
      tColor: { value: null },
      tBloom: { value: null },
      tExposure: { value: null },
      uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
      uTime: { value: 0 },
      uFrameIndex: { value: 0 },
      uSharpen: { value: 0.6 },
      uAberration: { value: 0 },
      uBloomStrength: { value: 1 },
      uHasBloom: { value: 0 },
      uHasExposure: { value: 0 },
      uExposure: { value: 1 },

      // Very slightly cool overall — the genre's "clinical optics" feel.
      uWhiteBalance: { value: new THREE.Vector3(0.985, 0.998, 1.022) },
      // Teal shadows, warm highlights. Both within ~6% of neutral.
      uShadowTint: { value: new THREE.Vector3(0.90, 1.01, 1.09) },
      uHighlightTint: { value: new THREE.Vector3(1.06, 1.005, 0.945) },
      uSplitBalance: { value: 0.22 },

      uLift: { value: new THREE.Vector3(0.012, 0.016, 0.024) },
      uGamma: { value: new THREE.Vector3(1.0, 1.0, 1.005) },
      uGain: { value: new THREE.Vector3(1.02, 1.005, 0.99) },
      uContrast: { value: 1.1 },
      uSaturation: { value: 0.9 },

      uVignette: { value: 0.34 },
      uVignetteRound: { value: 0.7 },
      uGrain: { value: 0.018 },
      uAspect: { value: 16 / 9 },
    });
  }

  /** Replace the whole look in one call. */
  setGrade(g: Partial<GradeSettings>): void {
    const u = this.quad.uniforms;
    if (g.whiteBalance) (u.uWhiteBalance.value as THREE.Vector3).copy(g.whiteBalance);
    if (g.shadowTint) (u.uShadowTint.value as THREE.Vector3).copy(g.shadowTint);
    if (g.highlightTint) (u.uHighlightTint.value as THREE.Vector3).copy(g.highlightTint);
    if (g.splitBalance !== undefined) u.uSplitBalance.value = g.splitBalance;
    if (g.lift) (u.uLift.value as THREE.Vector3).copy(g.lift);
    if (g.gamma) (u.uGamma.value as THREE.Vector3).copy(g.gamma);
    if (g.gain) (u.uGain.value as THREE.Vector3).copy(g.gain);
    if (g.contrast !== undefined) u.uContrast.value = g.contrast;
    if (g.saturation !== undefined) u.uSaturation.value = g.saturation;
  }

  render(ictx: IRenderContext, _dt: number): void {
    const ctx = ictx as PostContext;
    const u = this.quad.uniforms;

    u.tColor.value = frame.current ?? ctx.sceneTarget.texture;
    u.tBloom.value = frame.bloomTexture;
    u.tExposure.value = frame.exposureTexture;
    u.uHasBloom.value = frame.bloomTexture ? 1 : 0;
    u.uHasExposure.value = frame.exposureTexture ? 1 : 0;
    u.uExposure.value = this.exposure;
    u.uBloomStrength.value = this.bloomStrength;

    (u.uTexel.value as THREE.Vector2).set(1 / frame.width, 1 / frame.height);
    u.uTime.value = frame.time;
    u.uFrameIndex.value = frame.index % 1024;
    u.uAspect.value = frame.width / Math.max(1, frame.height);

    // Quality gating: the fine trims are the first things to go.
    const q = ctx.quality;
    u.uSharpen.value = q >= 1 ? this.sharpen : 0;
    u.uAberration.value = q >= 2 ? this.aberration : 0;
    u.uGrain.value = q >= 1 ? this.grain : 0;
    u.uVignette.value = this.vignette;

    this.quad.render(ctx.renderer, null);
  }

  dispose(): void {
    this.quad.dispose();
  }
}
