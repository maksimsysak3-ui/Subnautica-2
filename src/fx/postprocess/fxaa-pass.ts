/**
 * FXAA — the Low quality tier's substitute for TAA.
 *
 * OWNED BY: Graphics team.
 *
 * On the Low tier the projection is not jittered and there is no history
 * buffer, so a spatial filter is all that is available. This is Lottes' FXAA
 * with a bounded edge search: find the local luma gradient, walk along the edge
 * until the contrast ends, and offset the sample toward the darker side by how
 * far along the edge this pixel sits.
 *
 * It runs on HDR colour, so luma is taken through a Reinhard weight first —
 * FXAA's thresholds are all calibrated against a 0..1 signal, and feeding it
 * raw radiance makes every bright edge look like a hard edge.
 */

import * as THREE from 'three';
import type { PostPass, IRenderContext } from '../../core/contracts';
import { frame, type PostContext } from '../../render/frame-state';
import { FullScreenQuad, GLSL_LIB, writeAndSwap } from './common';

const FXAA_FRAG = /* glsl */ `
${GLSL_LIB}

in vec2 vUv;
out vec4 outColor;

uniform sampler2D tColor;
uniform vec2 uTexel;
uniform float uEdgeThreshold;
uniform float uEdgeThresholdMin;
uniform float uSubpixel;

float lumaAt(vec2 uv) {
  return sqrt(luminance(tonemapWeight(max(texture(tColor, uv).rgb, vec3(0.0)))));
}

void main() {
  vec3 rgbM = texture(tColor, vUv).rgb;
  float lM = sqrt(luminance(tonemapWeight(max(rgbM, vec3(0.0)))));
  float lN = lumaAt(vUv + vec2(0.0, -uTexel.y));
  float lS = lumaAt(vUv + vec2(0.0,  uTexel.y));
  float lE = lumaAt(vUv + vec2( uTexel.x, 0.0));
  float lW = lumaAt(vUv + vec2(-uTexel.x, 0.0));

  float lMin = min(lM, min(min(lN, lS), min(lE, lW)));
  float lMax = max(lM, max(max(lN, lS), max(lE, lW)));
  float range = lMax - lMin;

  if (range < max(uEdgeThresholdMin, lMax * uEdgeThreshold)) {
    outColor = vec4(rgbM, 1.0);
    return;
  }

  float lNW = lumaAt(vUv + vec2(-uTexel.x, -uTexel.y));
  float lNE = lumaAt(vUv + vec2( uTexel.x, -uTexel.y));
  float lSW = lumaAt(vUv + vec2(-uTexel.x,  uTexel.y));
  float lSE = lumaAt(vUv + vec2( uTexel.x,  uTexel.y));

  float edgeH = abs(lNW + lNE - 2.0 * lN) * 2.0 + abs(lW + lE - 2.0 * lM) * 4.0 + abs(lSW + lSE - 2.0 * lS) * 2.0;
  float edgeV = abs(lNW + lSW - 2.0 * lW) * 2.0 + abs(lN + lS - 2.0 * lM) * 4.0 + abs(lNE + lSE - 2.0 * lE) * 2.0;
  bool horizontal = edgeH >= edgeV;

  float luma1 = horizontal ? lN : lW;
  float luma2 = horizontal ? lS : lE;
  float grad1 = abs(luma1 - lM);
  float grad2 = abs(luma2 - lM);
  bool is1 = grad1 >= grad2;

  float stepLength = horizontal ? uTexel.y : uTexel.x;
  if (is1) stepLength = -stepLength;
  float lumaLocalAvg = 0.5 * ((is1 ? luma1 : luma2) + lM);

  vec2 currentUv = vUv;
  if (horizontal) currentUv.y += stepLength * 0.5;
  else            currentUv.x += stepLength * 0.5;

  vec2 offset = horizontal ? vec2(uTexel.x, 0.0) : vec2(0.0, uTexel.y);
  vec2 uv1 = currentUv - offset;
  vec2 uv2 = currentUv + offset;
  float lumaEnd1 = lumaAt(uv1) - lumaLocalAvg;
  float lumaEnd2 = lumaAt(uv2) - lumaLocalAvg;
  float gradScaled = 0.25 * max(grad1, grad2);
  bool reached1 = abs(lumaEnd1) >= gradScaled;
  bool reached2 = abs(lumaEnd2) >= gradScaled;

  // Bounded search — 8 steps with growing stride covers a ~24px edge, which is
  // plenty at the resolutions the Low tier runs at.
  const float QUALITY[8] = float[8](1.0, 1.0, 1.0, 1.0, 1.5, 2.0, 2.0, 4.0);
  for (int i = 0; i < 8; i++) {
    if (reached1 && reached2) break;
    if (!reached1) { uv1 -= offset * QUALITY[i]; lumaEnd1 = lumaAt(uv1) - lumaLocalAvg; reached1 = abs(lumaEnd1) >= gradScaled; }
    if (!reached2) { uv2 += offset * QUALITY[i]; lumaEnd2 = lumaAt(uv2) - lumaLocalAvg; reached2 = abs(lumaEnd2) >= gradScaled; }
  }

  float dist1 = horizontal ? (vUv.x - uv1.x) : (vUv.y - uv1.y);
  float dist2 = horizontal ? (uv2.x - vUv.x) : (uv2.y - vUv.y);
  bool nearer1 = dist1 < dist2;
  float distFinal = min(dist1, dist2);
  float edgeLength = dist1 + dist2;
  float pixelOffset = -distFinal / max(edgeLength, 1e-5) + 0.5;

  bool lumaCentreSmaller = lM < lumaLocalAvg;
  bool correct = ((nearer1 ? lumaEnd1 : lumaEnd2) < 0.0) != lumaCentreSmaller;
  float finalOffset = correct ? pixelOffset : 0.0;

  // Sub-pixel term: catches the single-pixel features the edge search misses.
  float avg = (1.0 / 12.0) * (2.0 * (lN + lS + lE + lW) + lNW + lNE + lSW + lSE);
  float subPixel = clamp(abs(avg - lM) / max(range, 1e-5), 0.0, 1.0);
  subPixel = (-2.0 * subPixel + 3.0) * subPixel * subPixel;
  finalOffset = max(finalOffset, subPixel * subPixel * uSubpixel);

  vec2 finalUv = vUv;
  if (horizontal) finalUv.y += finalOffset * stepLength;
  else            finalUv.x += finalOffset * stepLength;

  outColor = vec4(texture(tColor, finalUv).rgb, 1.0);
}
`;

export class FxaaPass implements PostPass {
  readonly id = 'fxaa';
  readonly order = 90;
  enabled = false;

  private quad: FullScreenQuad;

  constructor() {
    this.quad = new FullScreenQuad(FXAA_FRAG, {
      tColor: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uEdgeThreshold: { value: 0.125 },
      uEdgeThresholdMin: { value: 0.0312 },
      uSubpixel: { value: 0.75 },
    });
  }

  render(ictx: IRenderContext, _dt: number): void {
    const ctx = ictx as PostContext;
    const u = this.quad.uniforms;
    u.tColor.value = frame.current ?? ctx.sceneTarget.texture;
    (u.uTexel.value as THREE.Vector2).set(1 / frame.width, 1 / frame.height);
    writeAndSwap(ctx, this.quad);
  }

  dispose(): void {
    this.quad.dispose();
  }
}
