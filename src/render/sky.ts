/**
 * Atmospheric sky.
 *
 * OWNED BY: Graphics team.
 *
 * A sky dome driven by an analytic Rayleigh/Mie scattering model, blended into
 * a night sky with stars and a moon. This is drawn first with depth writes off,
 * so it costs one full-screen worth of fragment work and nothing else.
 *
 * Why analytic rather than raymarched: the sky is background-only, it has to
 * look right at every hour of a 24h cycle, and a closed-form model gives us
 * stable, artefact-free horizons at sunset — which is where raymarched
 * single-scattering usually falls apart without expensive step counts.
 *
 * The model is Preetham-style luminance with a physically-motivated extinction
 * term, extended with:
 *   - a proper night branch (moon, stars, airglow) cross-faded through twilight
 *   - horizon haze coupled to the weather system's fog density
 *   - a sun disc with limb darkening, so it reads as a body rather than a dot
 */

import * as THREE from 'three';
import { clamp01, smoothstep } from '../core/math';

const SKY_VERT = /* glsl */ `
varying vec3 vWorldDir;

void main() {
  // Direction from the camera to this vertex, in world space. The dome is
  // recentred on the camera every frame, so this is a pure view direction.
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldDir = worldPos.xyz - cameraPosition;

  // Project with translation removed so the dome can never clip the far plane.
  mat4 viewNoTranslate = viewMatrix;
  viewNoTranslate[3].xyz = vec3(0.0);
  vec4 clip = projectionMatrix * viewNoTranslate * vec4(worldPos.xyz - cameraPosition, 1.0);
  // Force w so the sky always sits exactly at the far plane.
  gl_Position = clip.xyww;
}
`;

const SKY_FRAG = /* glsl */ `
precision highp float;

varying vec3 vWorldDir;

uniform vec3  uSunDirection;
uniform vec3  uMoonDirection;
uniform float uSunIntensity;
uniform float uTurbidity;
uniform float uRayleigh;
uniform float uMieCoefficient;
uniform float uMieDirectionalG;
uniform float uMoonPhase;
uniform float uNightBlend;     // 0 = full day, 1 = full night
uniform float uSkyScale;       // brings Preetham luminance into scene radiance units
uniform float uNightExposure;  // night branch is authored dim; lifted separately
uniform float uHorizonHaze;    // coupled to weather fog density
uniform vec3  uHazeColor;
uniform float uCloudCover;
uniform float uLightningFlash;
uniform float uTime;

const float PI = 3.141592653589793;

// Wavelength-dependent Rayleigh scattering at sea level (m^-1), for
// 680/550/450nm. These are the reason sunsets go red: blue is scattered out of
// the direct path first.
const vec3 RAYLEIGH_TOTAL = vec3(5.804542996e-6, 1.356986864e-5, 3.310940309e-5);
const vec3 MIE_K = vec3(0.686, 0.678, 0.666);
const float MIE_V = 4.0;
const float MIE_CONST = 2.399963229728653e-19;

// Zenith angle attenuation — how much atmosphere the light travels through.
const float CUTOFF_ANGLE = 1.6110731556870734;
const float STEEPNESS = 1.5;
const float SUN_ANGULAR_DIAMETER = 0.0093;   // radians, ~0.53 degrees
const float MOON_ANGULAR_DIAMETER = 0.0092;

float sunIntensityAt(float zenithAngleCos) {
  zenithAngleCos = clamp(zenithAngleCos, -1.0, 1.0);
  return uSunIntensity * max(0.0, 1.0 - pow(2.718281828, -((CUTOFF_ANGLE - acos(zenithAngleCos)) / STEEPNESS)));
}

vec3 totalMie(float T) {
  float c = (0.2 * T) * 10e-18;
  return 0.434 * c * MIE_CONST * pow((2.0 * PI) / vec3(680e-9, 550e-9, 450e-9), vec3(MIE_V - 2.0)) * MIE_K;
}

float rayleighPhase(float cosTheta) {
  return (3.0 / (16.0 * PI)) * (1.0 + pow(cosTheta, 2.0));
}

float henyeyGreenstein(float cosTheta, float g) {
  float g2 = g * g;
  return (1.0 / (4.0 * PI)) * ((1.0 - g2) / pow(max(1e-4, 1.0 - 2.0 * g * cosTheta + g2), 1.5));
}

// --- cheap value-noise stack, used for stars and cloud banding ---------------
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * valueNoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

// Starfield: quantise the direction into cells and light a few of them, with
// per-star colour temperature and a slow twinkle.
vec3 stars(vec3 dir) {
  // Equirectangular cells give even density without pole clustering artefacts
  // being too obvious at the zenith.
  vec2 uv = vec2(atan(dir.z, dir.x) / (2.0 * PI) + 0.5, acos(clamp(dir.y, -1.0, 1.0)) / PI);
  vec2 cell = uv * vec2(900.0, 450.0);
  vec2 id = floor(cell);
  vec2 f = fract(cell) - 0.5;

  float h = hash21(id);
  if (h < 0.982) return vec3(0.0);

  // Position the star randomly within its cell so the grid never shows.
  vec2 offset = vec2(hash21(id + 7.1), hash21(id + 13.7)) - 0.5;
  float d = length(f - offset * 0.6);

  float brightness = pow(hash21(id + 3.3), 6.0);
  float twinkle = 0.75 + 0.25 * sin(uTime * (1.5 + hash21(id + 91.0) * 3.0) + h * 30.0);
  float star = smoothstep(0.055, 0.0, d) * brightness * twinkle;

  // Colour temperature: most stars read white-blue, a few warm.
  float temp = hash21(id + 51.0);
  vec3 tint = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.82, 0.65), pow(temp, 2.5));
  return star * tint * 3.0;
}

void main() {
  vec3 dir = normalize(vWorldDir);
  // Keep the maths stable below the horizon by mirroring rather than clamping.
  vec3 up = vec3(0.0, 1.0, 0.0);

  float sunE = sunIntensityAt(dot(uSunDirection, up));
  float rayleighCoeff = uRayleigh - (1.0 - clamp(dot(uSunDirection, up) + 1.0, 0.0, 1.0));

  vec3 betaR = RAYLEIGH_TOTAL * max(0.0, rayleighCoeff);
  vec3 betaM = totalMie(uTurbidity) * uMieCoefficient;

  // Optical depth along the view ray.
  float zenithAngle = acos(max(0.0, dot(up, dir)));
  float denom = cos(zenithAngle) + 0.15 * pow(max(1e-3, 93.885 - ((zenithAngle * 180.0) / PI)), -1.253);
  float sR = 8.4e3 / denom;
  float sM = 1.25e3 / denom;

  vec3 Fex = exp(-(betaR * sR + betaM * sM));

  float cosTheta = dot(dir, uSunDirection);
  float rPhase = rayleighPhase(cosTheta * 0.5 + 0.5);
  vec3 betaRTheta = betaR * rPhase;
  float mPhase = henyeyGreenstein(cosTheta, uMieDirectionalG);
  vec3 betaMTheta = betaM * mPhase;

  vec3 Lin = pow(
    sunE * ((betaRTheta + betaMTheta) / max(vec3(1e-9), betaR + betaM)) * (1.0 - Fex),
    vec3(1.5)
  );
  Lin *= mix(
    vec3(1.0),
    pow(sunE * ((betaRTheta + betaMTheta) / max(vec3(1e-9), betaR + betaM)) * Fex, vec3(0.5)),
    clamp(pow(1.0 - dot(up, uSunDirection), 5.0), 0.0, 1.0)
  );

  // Night sky: airglow gradient + stars + moon.
  vec3 nightZenith = vec3(0.004, 0.008, 0.020);
  vec3 nightHorizon = vec3(0.020, 0.028, 0.045);
  vec3 night = mix(nightHorizon, nightZenith, smoothstep(0.0, 0.45, dir.y));
  night += stars(dir) * smoothstep(0.02, 0.25, dir.y) * 0.9;

  // Moon disc with a phase terminator.
  float moonCos = dot(dir, uMoonDirection);
  float moonAngle = acos(clamp(moonCos, -1.0, 1.0));
  float moonDisc = 1.0 - smoothstep(MOON_ANGULAR_DIAMETER * 0.9, MOON_ANGULAR_DIAMETER * 1.15, moonAngle);
  if (moonDisc > 0.0) {
    // Fake the phase by darkening one side of the disc.
    vec3 moonRight = normalize(cross(uMoonDirection, up));
    float acrossDisc = dot(normalize(dir - uMoonDirection * moonCos), moonRight);
    float phaseEdge = (uMoonPhase * 2.0 - 1.0);
    float lit = smoothstep(phaseEdge - 0.25, phaseEdge + 0.25, acrossDisc);
    // Subtle maria so it isn't a flat white circle.
    float maria = 0.82 + 0.18 * fbm(dir.xz * 220.0);
    night += moonDisc * lit * maria * vec3(1.15, 1.12, 1.0) * 2.2;
  }
  // Moon glow halo.
  night += vec3(0.5, 0.55, 0.7) * pow(max(0.0, moonCos), 900.0) * 0.6;
  night += vec3(0.18, 0.22, 0.34) * pow(max(0.0, moonCos), 24.0) * 0.03 * uMoonPhase;

  // Sun disc with limb darkening — a flat disc reads as a decal, the falloff
  // is what makes it look like a star.
  float sunAngle = acos(clamp(cosTheta, -1.0, 1.0));
  float sunDisc = 1.0 - smoothstep(SUN_ANGULAR_DIAMETER * 0.92, SUN_ANGULAR_DIAMETER * 1.08, sunAngle);
  float limb = sqrt(max(0.0, 1.0 - pow(sunAngle / (SUN_ANGULAR_DIAMETER * 1.08), 2.0)));
  vec3 sunColor = vec3(1.0, 0.94, 0.86) * (0.35 + 0.65 * limb);

  vec3 day = Lin + sunDisc * sunColor * sunE * 0.9 * Fex;
  // Forward-scattering bloom around the sun, strongest at low elevation.
  day += Fex * sunE * 0.00028 * pow(max(0.0, cosTheta), 220.0);

  // Preetham luminance is authored in cd/m^2-like units that run into the
  // hundreds; the rest of the scene sits around 1.0. Without this the sky
  // clips to white and everything below the horizon reads as a silhouette.
  day *= uSkyScale;
  night *= uNightExposure;

  vec3 color = mix(day, night, uNightBlend);

  // Cloud banding — cheap, but it stops the sky reading as an empty gradient.
  if (uCloudCover > 0.01) {
    vec2 cloudUv = dir.xz / max(0.08, abs(dir.y) + 0.12);
    float c = fbm(cloudUv * 0.6 + vec2(uTime * 0.004, uTime * 0.002));
    float coverage = smoothstep(1.0 - uCloudCover, 1.05 - uCloudCover * 0.65, c);
    coverage *= smoothstep(0.0, 0.18, dir.y);
    vec3 cloudLit = mix(vec3(0.30, 0.33, 0.38), vec3(1.0, 0.96, 0.90), clamp(dot(uSunDirection, up) + 0.35, 0.0, 1.0));
    cloudLit = mix(cloudLit * 0.25, cloudLit, 1.0 - uNightBlend);
    color = mix(color, cloudLit * (0.55 + 0.45 * c), coverage * 0.85);
  }

  // Horizon haze ties the sky to the scene fog so distant geometry dissolves
  // into the sky rather than ending at a visible line.
  float hazeAmount = uHorizonHaze * (1.0 - smoothstep(-0.02, 0.30, dir.y));
  color = mix(color, uHazeColor, clamp(hazeAmount, 0.0, 0.92));

  color += vec3(0.9, 0.93, 1.0) * uLightningFlash * 0.5;

  // Output linear HDR — the tonemapper downstream owns the final look.
  gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
}
`;

export interface SkyParams {
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  sunIntensity: number;
}

export class Sky {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private elapsed = 0;

  constructor(radius = 1500) {
    const geometry = new THREE.SphereGeometry(radius, 32, 20);
    this.material = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
      uniforms: {
        uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
        uMoonDirection: { value: new THREE.Vector3(0, -1, 0) },
        uSunIntensity: { value: 1000 },
        uTurbidity: { value: 3.2 },
        uRayleigh: { value: 2.2 },
        uMieCoefficient: { value: 0.005 },
        uMieDirectionalG: { value: 0.80 },
        uMoonPhase: { value: 0.4 },
        uNightBlend: { value: 0 },
        uSkyScale: { value: 0.0035 },
        uNightExposure: { value: 2.4 },
        uHorizonHaze: { value: 0.25 },
        uHazeColor: { value: new THREE.Color(0.62, 0.70, 0.78) },
        uCloudCover: { value: 0.1 },
        uLightningFlash: { value: 0 },
        uTime: { value: 0 },
      },
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.name = 'sky';
    this.mesh.frustumCulled = false;
    // Draw before everything else, with depth writes off.
    this.mesh.renderOrder = -1000;
    this.mesh.matrixAutoUpdate = false;
  }

  /**
   * @param sunDirection unit vector pointing *toward* the sun
   * @param sunElevation radians above the horizon (negative below)
   */
  update(
    dt: number,
    cameraPosition: THREE.Vector3,
    sunDirection: THREE.Vector3,
    moonDirection: THREE.Vector3,
    sunElevation: number,
    opts: {
      moonPhase: number;
      cloudCover: number;
      fogDensity: number;
      hazeColor: THREE.Color;
      lightningFlash: number;
    },
  ): void {
    this.elapsed += dt;
    const u = this.material.uniforms;

    u.uSunDirection.value.copy(sunDirection);
    u.uMoonDirection.value.copy(moonDirection);
    u.uTime.value = this.elapsed;
    u.uMoonPhase.value = opts.moonPhase;
    u.uCloudCover.value = opts.cloudCover;
    u.uLightningFlash.value = opts.lightningFlash;

    // Night cross-fade spans civil twilight, so dusk has a long readable ramp
    // rather than snapping from day to night.
    u.uNightBlend.value = 1 - smoothstep(-0.16, 0.06, sunElevation);

    // Turbidity climbs with cloud cover — hazier air, wider sun halo.
    u.uTurbidity.value = 2.4 + opts.cloudCover * 6.5;
    // Rayleigh drops slightly at sunset to deepen the reds.
    u.uRayleigh.value = 1.4 + smoothstep(-0.1, 0.5, sunElevation) * 1.6;
    u.uMieCoefficient.value = 0.0042 + opts.cloudCover * 0.006;
    u.uMieDirectionalG.value = 0.76 + opts.cloudCover * 0.06;

    // Sun luminance in the units the Preetham term expects.
    u.uSunIntensity.value = 1000;

    // Tie horizon haze to the scene's fog so the two never disagree.
    u.uHorizonHaze.value = clamp01(0.10 + opts.fogDensity * 9.0);
    u.uHazeColor.value.copy(opts.hazeColor);

    // Follow the camera; the dome is effectively at infinity.
    this.mesh.position.copy(cameraPosition);
    this.mesh.updateMatrix();
    this.mesh.updateMatrixWorld(true);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
