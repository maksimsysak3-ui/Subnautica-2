/**
 * Atmospheric perspective — exponential height fog with sun in-scattering.
 *
 * OWNED BY: Graphics team. Reads (never writes) the lighting team's
 * `scene.fog` and sun light so the two can never disagree about the haze.
 *
 * The scene already renders `FogExp2` per-material, which is a pure function of
 * distance. That is not what air does. Air is stratified: haze pools in the low
 * ground, thins with altitude, and glows when you look toward the sun. Those
 * three things are what make a landscape read as *deep* rather than merely
 * faded, and none of them are expressible in a distance-only fog.
 *
 * So this pass adds, on top of the existing distance fog:
 *
 *  - **Height fog**, evaluated with the closed-form integral of an
 *    exponentially-decaying density along the view ray. Analytic rather than
 *    ray-marched because it is exact, costs a handful of ALU, and does not
 *    band.
 *  - **Sun in-scattering**, a Henyey-Greenstein-ish forward lobe that warms and
 *    brightens the haze toward the sun. This is the single cheapest thing that
 *    makes golden hour look like golden hour.
 *  - **Aerial desaturation**, a slow pull toward the fog chroma with distance.
 *    Distant objects lose contrast before they lose luminance; skipping this is
 *    why "fogged" scenes often still look flat.
 *
 * Sky pixels get the height-fog term too, integrated to a long distance, so the
 * horizon band agrees with the terrain that meets it.
 */

import * as THREE from 'three';
import type { PostPass, IRenderContext } from '../../core/contracts';
import { services } from '../../core/contracts';
import { frame, type PostContext } from '../../render/frame-state';
import { FullScreenQuad, GLSL_LIB, writeAndSwap } from './common';

const FOG_FRAG = /* glsl */ `
${GLSL_LIB}

in vec2 vUv;
out vec4 outColor;

uniform sampler2D tColor;
uniform sampler2D tDepth;

uniform mat4  uInvViewProjection;
uniform vec3  uCameraPosition;
uniform vec3  uSunDirection;
uniform vec3  uFogColor;
uniform vec3  uSunFogColor;
uniform float uNear;
uniform float uFar;

uniform float uHeightDensity;
uniform float uHeightFalloff;
uniform float uFogBaseHeight;
uniform float uDistanceDensity;
uniform float uInscatterStrength;
uniform float uInscatterAnisotropy;
uniform float uSkyDistance;
uniform float uSkyAmount;
uniform float uDesaturation;
uniform float uDesaturationRange;
uniform float uMaxFog;

/**
 * Closed-form optical depth of an exponentially-stratified medium along a ray.
 *   rho(y) = D * exp(-k * (y - y0))
 *   tau    = integral_0^L rho(C.y + t*dir.y) dt
 */
float heightFogOpticalDepth(vec3 origin, vec3 dir, float dist) {
  float k = uHeightFalloff;
  float baseline = uHeightDensity * exp(-k * (origin.y - uFogBaseHeight));
  baseline = clamp(baseline, 0.0, 64.0);
  float dy = dir.y;
  float kd = k * dy;
  if (abs(kd) < 1e-4) return baseline * dist;
  return baseline * (1.0 - exp(-kd * dist)) / kd;
}

/** Henyey-Greenstein: the forward-scattering lobe that makes haze glow. */
float henyeyGreenstein(float cosTheta, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(max(1.0 + g2 - 2.0 * g * cosTheta, 1e-4), 1.5));
}

void main() {
  vec3 color = texture(tColor, vUv).rgb;
  float depth = texture(tDepth, vUv).x;
  bool isSky = depth >= 0.999999;

  vec3 world = worldPosition(vUv, min(depth, 0.9999), uInvViewProjection);
  vec3 toPoint = world - uCameraPosition;
  float dist = length(toPoint);
  vec3 dir = dist > 1e-4 ? toPoint / dist : vec3(0.0, 0.0, -1.0);
  if (isSky) dist = uSkyDistance;

  float tau = heightFogOpticalDepth(uCameraPosition, dir, dist);
  if (!isSky) tau += uDistanceDensity * dist;
  if (isSky) tau *= uSkyAmount;

  float fog = clamp(1.0 - exp(-max(tau, 0.0)), 0.0, uMaxFog);

  // In-scattering: forward lobe toward the sun, tapered off below the horizon
  // so night fog does not glow at a sun that has set.
  float cosTheta = dot(dir, uSunDirection);
  float phase = henyeyGreenstein(cosTheta, uInscatterAnisotropy);
  float sunUp = clamp(uSunDirection.y * 4.0 + 0.2, 0.0, 1.0);
  vec3 fogColor = uFogColor + uSunFogColor * (phase * uInscatterStrength * sunUp);

  color = mix(color, fogColor, fog);

  // Aerial desaturation — contrast goes before luminance does.
  if (!isSky && uDesaturation > 0.0) {
    float t = clamp(dist / uDesaturationRange, 0.0, 1.0);
    float g = luminance(color);
    color = mix(color, vec3(g) * (uFogColor / max(luminance(uFogColor), 1e-4)), t * uDesaturation);
  }

  outColor = vec4(color, 1.0);
}
`;

const _sunDir = new THREE.Vector3(0, 1, 0);
const _fogColor = new THREE.Color(0.6, 0.7, 0.8);
const _sunColor = new THREE.Color(1, 0.85, 0.65);

export class AtmospherePass implements PostPass {
  readonly id = 'atmosphere';
  readonly order = 20;
  enabled = true;

  /** Density at `baseHeight`, per metre. */
  heightDensity = 0.030;
  /** e-folds per metre of altitude. 1/12m ~= haze thins over a 3-storey block. */
  heightFalloff = 0.085;
  baseHeight = 0.0;
  /** Extra distance fog on top of the scene's own FogExp2. */
  distanceDensity = 0.0009;
  inscatterStrength = 2.2;
  inscatterAnisotropy = 0.72;
  skyDistance = 900;
  skyAmount = 0.55;
  desaturation = 0.35;
  desaturationRange = 400;
  maxFog = 0.94;

  private quad: FullScreenQuad;
  private sunLight: THREE.DirectionalLight | null = null;

  constructor() {
    this.quad = new FullScreenQuad(FOG_FRAG, {
      tColor: { value: null },
      tDepth: { value: null },
      uInvViewProjection: { value: new THREE.Matrix4() },
      uCameraPosition: { value: new THREE.Vector3() },
      uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
      uFogColor: { value: new THREE.Vector3(0.6, 0.7, 0.8) },
      uSunFogColor: { value: new THREE.Vector3(1, 0.85, 0.6) },
      uNear: { value: 0.05 },
      uFar: { value: 4000 },
      uHeightDensity: { value: 0.03 },
      uHeightFalloff: { value: 0.085 },
      uFogBaseHeight: { value: 0 },
      uDistanceDensity: { value: 0.0009 },
      uInscatterStrength: { value: 2.2 },
      uInscatterAnisotropy: { value: 0.72 },
      uSkyDistance: { value: 900 },
      uSkyAmount: { value: 0.55 },
      uDesaturation: { value: 0.35 },
      uDesaturationRange: { value: 400 },
      uMaxFog: { value: 0.94 },
    });
  }

  /** The sun is the lighting team's; we only read its transform and colour. */
  private findSun(scene: THREE.Scene): THREE.DirectionalLight | null {
    if (this.sunLight && this.sunLight.parent) return this.sunLight;
    let best: THREE.DirectionalLight | null = null;
    scene.traverse((o) => {
      const l = o as THREE.DirectionalLight;
      if (l.isDirectionalLight && (best === null || l.intensity > best.intensity)) best = l;
    });
    this.sunLight = best;
    return best;
  }

  render(ictx: IRenderContext, _dt: number): void {
    const ctx = ictx as PostContext;
    const u = this.quad.uniforms;

    // --- sun direction: prefer the environment contract, fall back to the
    // brightest directional light in the scene.
    const env = services.tryGet('environment');
    if (env) {
      const el = env.time.sunElevation;
      const az = env.time.sunAzimuth;
      _sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
    } else {
      const sun = this.findSun(ctx.scene);
      if (sun) {
        _sunDir.copy(sun.position).sub(sun.target.position).normalize();
      }
    }

    const sun = this.findSun(ctx.scene);
    if (sun) _sunColor.copy(sun.color);

    const fog = ctx.scene.fog;
    if (fog) _fogColor.copy(fog.color);

    (u.uSunDirection.value as THREE.Vector3).copy(_sunDir);
    (u.uFogColor.value as THREE.Vector3).set(_fogColor.r, _fogColor.g, _fogColor.b);
    (u.uSunFogColor.value as THREE.Vector3).set(_sunColor.r, _sunColor.g, _sunColor.b);

    u.tColor.value = frame.current ?? ctx.sceneTarget.texture;
    u.tDepth.value = ctx.sceneTarget.depthTexture;
    (u.uInvViewProjection.value as THREE.Matrix4).copy(frame.invViewProjection);
    (u.uCameraPosition.value as THREE.Vector3).copy(frame.cameraPosition);
    u.uNear.value = frame.near;
    u.uFar.value = frame.far;
    u.uHeightDensity.value = this.heightDensity;
    u.uHeightFalloff.value = this.heightFalloff;
    u.uFogBaseHeight.value = this.baseHeight;
    u.uDistanceDensity.value = this.distanceDensity;
    u.uInscatterStrength.value = this.inscatterStrength;
    u.uInscatterAnisotropy.value = this.inscatterAnisotropy;
    u.uSkyDistance.value = this.skyDistance;
    u.uSkyAmount.value = this.skyAmount;
    u.uDesaturation.value = ctx.quality >= 1 ? this.desaturation : 0;
    u.uDesaturationRange.value = this.desaturationRange;
    u.uMaxFog.value = this.maxFog;

    writeAndSwap(ctx, this.quad);
  }

  dispose(): void {
    this.quad.dispose();
  }
}
