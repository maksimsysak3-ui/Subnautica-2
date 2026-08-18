/**
 * Ground-truth-style ambient occlusion (GTAO) from the depth buffer.
 *
 * OWNED BY: Graphics team.
 *
 * Why this pass exists, and why it is first in the chain: low-poly geometry has
 * no small-scale detail, so nothing in the raster tells you that a crate is
 * *touching* the ground rather than floating above it. Contact shadowing is the
 * single cue that fixes that, and it is the difference between "untextured
 * primitives" and "objects in a place".
 *
 * Why GTAO rather than classic hemisphere SSAO: hemisphere SSAO estimates a
 * ratio of occluded samples, which is not the quantity the rendering equation
 * wants and famously grey-washes flat surfaces. GTAO integrates the actual
 * cosine-weighted visibility arc between the two horizon angles in a slice, so
 * unoccluded planes stay at 1.0 and corners darken by the right amount. With
 * only 2-4 slices it is noisy, which is exactly what interleaved-gradient
 * sample rotation plus the bilateral blur plus TAA are for.
 *
 * Normals are reconstructed from depth rather than read from a G-buffer: the
 * world renders forward with `MeshStandardMaterial`, there is no normal target,
 * and flat-shaded low-poly geometry reconstructs almost perfectly anyway.
 *
 * Runs at half resolution, blurs bilaterally in two 1D passes, then applies at
 * full resolution.
 */

import * as THREE from 'three';
import type { PostPass, IRenderContext } from '../../core/contracts';
import { frame, type PostContext } from '../../render/frame-state';
import { FullScreenQuad, GLSL_LIB, makeTarget, writeAndSwap } from './common';

const AO_FRAG = /* glsl */ `
${GLSL_LIB}

in vec2 vUv;
out vec4 outColor;

uniform sampler2D tDepth;
uniform mat4  uInvProjection;
uniform vec2  uResolution;    // AO target resolution
uniform vec2  uTexel;
uniform float uProjY;         // projectionMatrix[1][1] = 1/tan(fovY/2)
uniform float uNear;
uniform float uFar;
uniform float uRadius;        // metres
uniform float uMaxPixels;
uniform float uIntensity;
uniform float uPower;
uniform float uThickness;
uniform float uFrameIndex;

vec3 viewAt(vec2 uv) {
  float d = texture(tDepth, uv).x;
  return viewPosition(uv, d, uInvProjection);
}

/**
 * Jimenez's closed form for the visibility integral over a slice arc.
 * h1/h2 are the two horizon angles, n the projected-normal angle.
 */
float integrateArc(float h1, float h2, float n, float cosN, float sinN) {
  return 0.25 * (-cos(2.0 * h1 - n) + cosN + 2.0 * h1 * sinN)
       + 0.25 * (-cos(2.0 * h2 - n) + cosN + 2.0 * h2 * sinN);
}

void main() {
  float depth = texture(tDepth, vUv).x;

  // Sky: no geometry, no occlusion. Also carry linear depth in .g for the
  // bilateral blur that follows.
  if (depth >= 0.999999) {
    outColor = vec4(1.0, uFar, 0.0, 1.0);
    return;
  }

  vec3 P = viewPosition(vUv, depth, uInvProjection);
  vec3 V = normalize(-P);

  // --- normal from depth, picking the closer of the forward/backward
  // difference on each axis so silhouettes don't smear across the edge.
  vec3 pl = viewAt(vUv - vec2(uTexel.x, 0.0));
  vec3 pr = viewAt(vUv + vec2(uTexel.x, 0.0));
  vec3 pd = viewAt(vUv - vec2(0.0, uTexel.y));
  vec3 pu = viewAt(vUv + vec2(0.0, uTexel.y));
  vec3 dx = abs(pr.z - P.z) < abs(P.z - pl.z) ? (pr - P) : (P - pl);
  vec3 dy = abs(pu.z - P.z) < abs(P.z - pd.z) ? (pu - P) : (P - pd);
  vec3 N = normalize(cross(dx, dy));

  vec2 pixel = vUv * uResolution;
  float rot = igNoise(pixel + uFrameIndex * 7.0);
  float ofs = fract(igNoise(pixel * 1.37 + uFrameIndex * 3.0) + uFrameIndex * 0.6180339887);

  // World radius projected to pixels, clamped so near-field pixels don't blow
  // the sampling budget and far pixels still get a usable footprint.
  float pixelRadius = clamp(uRadius * (0.5 * uResolution.y * uProjY) / max(0.05, -P.z), 3.0, uMaxPixels);
  float stepPixels = pixelRadius / float(AO_STEPS);
  float radius2 = uRadius * uRadius;

  float visibility = 0.0;

  for (int s = 0; s < AO_SLICES; s++) {
    float phi = (float(s) + rot) * (PI / float(AO_SLICES));
    vec2 dir = vec2(cos(phi), sin(phi));

    vec3 sliceDir = vec3(dir, 0.0);
    vec3 axis = cross(sliceDir, V);
    float axisLen = length(axis);
    if (axisLen < 1e-5) continue;
    axis /= axisLen;

    vec3 projN = N - axis * dot(N, axis);
    float projNLen = length(projN);
    if (projNLen < 1e-4) continue;
    vec3 projNn = projN / projNLen;

    // In-slice tangent aligned with +dir, so angle signs line up with the
    // direction we march.
    vec3 orthoDir = normalize(sliceDir - V * dot(sliceDir, V));

    float cosN = clamp(dot(projNn, V), -1.0, 1.0);
    float n = sign(dot(projNn, orthoDir)) * acos(cosN);
    float cosn = cos(n);
    float sinn = sin(n);

    float cosH[2];
    cosH[0] = -1.0;
    cosH[1] = -1.0;

    for (int side = 0; side < 2; side++) {
      float sgn = side == 0 ? -1.0 : 1.0;
      float best = -1.0;
      for (int i = 0; i < AO_STEPS; i++) {
        float t = (float(i) + ofs + 0.5) * stepPixels;
        vec2 suv = vUv + sgn * dir * t * uTexel;
        if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) break;

        vec3 sP = viewAt(suv);
        vec3 D = sP - P;
        float dist2 = dot(D, D);
        if (dist2 < 1e-7) continue;
        float invLen = inversesqrt(dist2);
        float c = dot(D, V) * invLen;

        // Range check: occluders past the radius fade out instead of popping,
        // and the thickness heuristic stops a thin foreground object from
        // occluding as if it were an infinite slab.
        float falloff = clamp((radius2 - dist2) / max(1e-4, radius2 * uThickness), 0.0, 1.0);
        best = max(best, mix(-1.0, c, falloff));
      }
      cosH[side] = best;
    }

    float h1 = n + max(-acos(clamp(cosH[0], -1.0, 1.0)) - n, -HALF_PI);
    float h2 = n + min( acos(clamp(cosH[1], -1.0, 1.0)) - n,  HALF_PI);

    visibility += projNLen * integrateArc(h1, h2, n, cosn, sinn);
  }

  float ao = clamp(visibility / float(AO_SLICES), 0.0, 1.0);
  ao = pow(ao, uPower);
  ao = mix(1.0, ao, uIntensity);

  outColor = vec4(ao, linearDepth(depth, uNear, uFar), 0.0, 1.0);
}
`;

const BLUR_FRAG = /* glsl */ `
${GLSL_LIB}

in vec2 vUv;
out vec4 outColor;

uniform sampler2D tAo;
uniform vec2 uTexel;
uniform vec2 uDirection;
uniform float uDepthSigma;

void main() {
  vec2 center = texture(tAo, vUv).rg;
  float sum = center.r;
  float wsum = 1.0;

  // Depth-aware 9-tap. Weighting by relative depth keeps the AO from bleeding
  // across silhouettes, which is what makes half-res AO acceptable.
  for (int i = 1; i <= 4; i++) {
    float w = exp(-float(i * i) * 0.14);
    vec2 off = uDirection * uTexel * float(i);

    vec2 a = texture(tAo, vUv + off).rg;
    vec2 b = texture(tAo, vUv - off).rg;

    float wa = w * exp(-abs(a.g - center.g) / (uDepthSigma * max(1.0, center.g * 0.05)));
    float wb = w * exp(-abs(b.g - center.g) / (uDepthSigma * max(1.0, center.g * 0.05)));

    sum += a.r * wa + b.r * wb;
    wsum += wa + wb;
  }

  outColor = vec4(sum / wsum, center.g, 0.0, 1.0);
}
`;

const APPLY_FRAG = /* glsl */ `
${GLSL_LIB}

in vec2 vUv;
out vec4 outColor;

uniform sampler2D tColor;
uniform sampler2D tAo;
uniform sampler2D tDepth;
uniform vec3  uCavityTint;
uniform float uStrength;
uniform float uBrightKnee;
uniform float uBrightSoft;
uniform float uDebug;

void main() {
  vec4 src = texture(tColor, vUv);
  float ao = texture(tAo, vUv).r;

  if (uDebug > 0.5) {
    outColor = vec4(vec3(ao), 1.0);
    return;
  }

  // AO occludes *ambient* light. We only have the composited result, so
  // approximate: strongly lit pixels are dominated by the sun term and should
  // keep more of their brightness, shadowed pixels are nearly all sky ambient
  // and take the full occlusion.
  float lum = luminance(src.rgb);
  float direct = smoothstep(uBrightKnee, uBrightKnee + uBrightSoft, lum);
  float a = mix(1.0, ao, uStrength * mix(1.0, 0.4, direct));

  // Tinting the occluded end cool rather than black reads as sky-light
  // rejection instead of a dirt smudge.
  outColor = vec4(src.rgb * mix(uCavityTint, vec3(1.0), a), src.a);
}
`;

export interface SsaoOptions {
  radius: number;
  intensity: number;
  power: number;
  strength: number;
}

export class SsaoPass implements PostPass {
  readonly id = 'ssao';
  readonly order = 10;
  enabled = true;

  /** Show raw AO instead of the composited result. */
  debug = false;

  radius = 1.5;
  intensity = 1.0;
  power = 1.6;
  strength = 1.0;

  private aoTarget: THREE.WebGLRenderTarget | null = null;
  private blurTarget: THREE.WebGLRenderTarget | null = null;
  private ao: FullScreenQuad;
  private blur: FullScreenQuad;
  private apply: FullScreenQuad;
  private quality = -1;
  private width = 1;
  private height = 1;

  constructor() {
    this.ao = new FullScreenQuad(
      AO_FRAG,
      {
        tDepth: { value: null },
        uInvProjection: { value: new THREE.Matrix4() },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uTexel: { value: new THREE.Vector2(1, 1) },
        uProjY: { value: 1 },
        uNear: { value: 0.05 },
        uFar: { value: 4000 },
        uRadius: { value: 1.5 },
        uMaxPixels: { value: 64 },
        uIntensity: { value: 1 },
        uPower: { value: 1.6 },
        uThickness: { value: 0.6 },
        uFrameIndex: { value: 0 },
      },
      { AO_SLICES: 3, AO_STEPS: 5 },
    );

    this.blur = new FullScreenQuad(BLUR_FRAG, {
      tAo: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uDirection: { value: new THREE.Vector2(1, 0) },
      uDepthSigma: { value: 0.7 },
    });

    this.apply = new FullScreenQuad(APPLY_FRAG, {
      tColor: { value: null },
      tAo: { value: null },
      tDepth: { value: null },
      uCavityTint: { value: new THREE.Color(0.09, 0.11, 0.15) },
      uStrength: { value: 1.0 },
      uBrightKnee: { value: 0.35 },
      uBrightSoft: { value: 1.1 },
      uDebug: { value: 0 },
    });
  }

  resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    this.rebuild();
  }

  private rebuild(): void {
    const scale = 0.5;
    const w = Math.max(1, Math.floor(this.width * scale));
    const h = Math.max(1, Math.floor(this.height * scale));
    if (this.aoTarget && this.aoTarget.width === w && this.aoTarget.height === h) return;
    this.aoTarget?.dispose();
    this.blurTarget?.dispose();
    this.aoTarget = makeTarget(w, h);
    this.blurTarget = makeTarget(w, h);
  }

  private applyQuality(q: number): void {
    if (q === this.quality) return;
    this.quality = q;
    const slices = [2, 2, 3, 4][q] ?? 3;
    const steps = [4, 5, 6, 6][q] ?? 5;
    this.ao.setDefines({ AO_SLICES: slices, AO_STEPS: steps });
    this.ao.uniforms.uMaxPixels.value = [40, 56, 72, 96][q] ?? 72;
  }

  render(ictx: IRenderContext, _dt: number): void {
    const ctx = ictx as PostContext;
    if (!this.aoTarget || !this.blurTarget) this.rebuild();
    const aoT = this.aoTarget!;
    const blurT = this.blurTarget!;
    this.applyQuality(ctx.quality);

    const r = ctx.renderer;
    const depth = ctx.sceneTarget.depthTexture;
    if (!depth) return;

    // --- AO ---------------------------------------------------------------
    const u = this.ao.uniforms;
    u.tDepth.value = depth;
    (u.uInvProjection.value as THREE.Matrix4).copy(frame.invProjection);
    (u.uResolution.value as THREE.Vector2).set(aoT.width, aoT.height);
    (u.uTexel.value as THREE.Vector2).set(1 / aoT.width, 1 / aoT.height);
    u.uProjY.value = 1 / Math.tan(frame.fovY * 0.5);
    u.uNear.value = frame.near;
    u.uFar.value = frame.far;
    u.uRadius.value = this.radius;
    u.uIntensity.value = this.intensity;
    u.uPower.value = this.power;
    u.uFrameIndex.value = frame.index % 64;
    this.ao.render(r, aoT);

    // --- bilateral blur, two 1D passes ------------------------------------
    const b = this.blur.uniforms;
    (b.uTexel.value as THREE.Vector2).set(1 / aoT.width, 1 / aoT.height);
    b.tAo.value = aoT.texture;
    (b.uDirection.value as THREE.Vector2).set(1, 0);
    this.blur.render(r, blurT);

    b.tAo.value = blurT.texture;
    (b.uDirection.value as THREE.Vector2).set(0, 1);
    this.blur.render(r, aoT);

    frame.aoTexture = aoT.texture;

    // --- composite --------------------------------------------------------
    const a = this.apply.uniforms;
    a.tColor.value = frame.current;
    a.tAo.value = aoT.texture;
    a.tDepth.value = depth;
    a.uStrength.value = this.strength;
    a.uDebug.value = this.debug ? 1 : 0;
    writeAndSwap(ctx, this.apply);
  }

  dispose(): void {
    this.aoTarget?.dispose();
    this.blurTarget?.dispose();
    this.ao.dispose();
    this.blur.dispose();
    this.apply.dispose();
  }
}
