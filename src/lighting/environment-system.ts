/**
 * Environment — time of day, sun/moon, sky, and the weather state machine.
 *
 * OWNED BY: Lighting team (sun/sky/exposure) + Weather team (precipitation,
 * wind, fog density). Both write into the same WeatherState/TimeOfDayState so
 * downstream consumers (AI vision, audio occlusion, VFX) read one source.
 */

import * as THREE from 'three';
import type { System, EngineContext } from '../core/engine';
import { bus } from '../core/events';
import {
  services,
  type IEnvironment,
  type WeatherState,
  type TimeOfDayState,
  type WeatherKind,
} from '../core/contracts';
import { clamp01, damp, lerp, smoothstep, TAU, Rng } from '../core/math';
import { Sky } from '../render/sky';

/** Half-width of the sun's shadow frustum, metres. Covers the playable site. */
const SHADOW_EXTENT = 120;
/** How far up the sun light sits from its target. Only affects the frustum. */
const SUN_DISTANCE = 400;

interface WeatherProfile {
  cloudCover: number;
  precipitation: number;
  fogDensity: number;
  windSpeed: number;
  soundOcclusion: number;
  visibilityFactor: number;
  /** Multiplies direct sun intensity. */
  sunAttenuation: number;
  /** Tints ambient toward this colour. */
  ambientTint: THREE.Color;
}

const WEATHER_PROFILES: Record<WeatherKind, WeatherProfile> = {
  clear:        { cloudCover: 0.08, precipitation: 0,    fogDensity: 0.004, windSpeed: 2,  soundOcclusion: 0.0,  visibilityFactor: 1.0,  sunAttenuation: 1.0,  ambientTint: new THREE.Color(0x8fb6d9) },
  overcast:     { cloudCover: 0.85, precipitation: 0,    fogDensity: 0.011, windSpeed: 5,  soundOcclusion: 0.08, visibilityFactor: 0.88, sunAttenuation: 0.42, ambientTint: new THREE.Color(0x9aa8b4) },
  fog:          { cloudCover: 0.55, precipitation: 0,    fogDensity: 0.052, windSpeed: 1,  soundOcclusion: 0.22, visibilityFactor: 0.42, sunAttenuation: 0.30, ambientTint: new THREE.Color(0xa8b2ba) },
  lightRain:    { cloudCover: 0.78, precipitation: 0.35, fogDensity: 0.018, windSpeed: 6,  soundOcclusion: 0.28, visibilityFactor: 0.76, sunAttenuation: 0.34, ambientTint: new THREE.Color(0x8d9aa6) },
  heavyRain:    { cloudCover: 0.95, precipitation: 0.85, fogDensity: 0.030, windSpeed: 11, soundOcclusion: 0.46, visibilityFactor: 0.58, sunAttenuation: 0.20, ambientTint: new THREE.Color(0x76838f) },
  thunderstorm: { cloudCover: 1.0,  precipitation: 1.0,  fogDensity: 0.034, windSpeed: 16, soundOcclusion: 0.52, visibilityFactor: 0.50, sunAttenuation: 0.14, ambientTint: new THREE.Color(0x646f7c) },
  sandstorm:    { cloudCover: 0.7,  precipitation: 0,    fogDensity: 0.075, windSpeed: 19, soundOcclusion: 0.40, visibilityFactor: 0.30, sunAttenuation: 0.22, ambientTint: new THREE.Color(0xc9a271) },
  snow:         { cloudCover: 0.9,  precipitation: 0.6,  fogDensity: 0.026, windSpeed: 7,  soundOcclusion: 0.34, visibilityFactor: 0.62, sunAttenuation: 0.30, ambientTint: new THREE.Color(0xb9c6d4) },
  smoke:        { cloudCover: 0.6,  precipitation: 0,    fogDensity: 0.090, windSpeed: 3,  soundOcclusion: 0.30, visibilityFactor: 0.26, sunAttenuation: 0.25, ambientTint: new THREE.Color(0x8a8378) },
};

export class EnvironmentSystem implements System, IEnvironment {
  readonly id = 'environment';
  readonly order = 12;
  readonly budgetMs = 1.5;

  readonly weather: WeatherState = {
    kind: 'clear',
    blend: 1,
    cloudCover: 0.08,
    precipitation: 0,
    fogDensity: 0.004,
    windDirection: 0.9,
    windSpeed: 2,
    temperature: 24,
    soundOcclusion: 0,
    visibilityFactor: 1,
    lightningActive: false,
  };

  readonly time: TimeOfDayState = {
    hour: 17.5,
    timeScale: 60,
    sunElevation: 0.5,
    sunAzimuth: 2.1,
    moonPhase: 0.3,
    ambientLightLevel: 1,
    isNight: false,
  };

  /** Latitude of the fictional region, in radians — shapes the sun arc. */
  private latitude = 14.2 * (Math.PI / 180);

  sun!: THREE.DirectionalLight;
  moon!: THREE.DirectionalLight;
  ambient!: THREE.HemisphereLight;
  private targetProfile: WeatherProfile = WEATHER_PROFILES.clear;
  private transitionRate = 0.2;
  private prevKind: WeatherKind = 'clear';
  private rng = new Rng('weather');
  private lightningCooldown = 6;
  private lightningFlash = 0;
  private sky!: Sky;
  /** Scratch vectors — updateCelestial runs every frame. */
  private sunDir = new THREE.Vector3();
  private moonDir = new THREE.Vector3();
  private hazeColor = new THREE.Color();
  private shadowTarget = new THREE.Vector3();

  init(_ctx: EngineContext): void {
    const render = services.get('render');
    const scene = render.scene;

    this.sun = new THREE.DirectionalLight(0xffe9c9, 3.0);
    this.sun.castShadow = true;
    // Resolution follows the quality preset rather than being fixed — at a
    // 240 m frustum a 2048 map is only ~12 cm per texel, which is where the
    // acne banding across open terrain was coming from.
    const shadowRes = (render as unknown as { preset?: { shadowMapSize: number } }).preset?.shadowMapSize ?? 2048;
    this.sun.shadow.mapSize.set(shadowRes, shadowRes);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 900;
    const s = SHADOW_EXTENT;
    this.sun.shadow.camera.left = -s;
    this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s;
    this.sun.shadow.camera.bottom = -s;
    // Normal-offset bias does the heavy lifting: it shifts the sample along
    // the surface normal, which kills acne on near-flat ground lit at a
    // grazing angle without the peter-panning that a large depth bias causes.
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.09 * (2048 / shadowRes);
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.moon = new THREE.DirectionalLight(0x9ab4d8, 0.0);
    this.moon.castShadow = false;
    scene.add(this.moon);
    scene.add(this.moon.target);

    this.ambient = new THREE.HemisphereLight(0x9dc3e6, 0x3c342c, 0.7);
    scene.add(this.ambient);

    // No scene.fog. Aerial perspective is owned by the atmosphere post pass,
    // which does it with real height falloff and sun inscatter. three's
    // FogExp2 applies in the material shader, so keeping both stacked two
    // independent fogs and greyed the whole frame out.

    this.sky = new Sky();
    scene.add(this.sky.mesh);

    services.register('environment', this);
    this.updateCelestial(0);
  }

  setWeather(kind: WeatherKind, transitionSeconds = 20): void {
    if (kind === this.weather.kind) return;
    this.prevKind = this.weather.kind;
    bus.emit('weather:changed', { from: this.weather.kind, to: kind });
    this.weather.kind = kind;
    this.weather.blend = 0;
    this.targetProfile = WEATHER_PROFILES[kind];
    this.transitionRate = 1 / Math.max(0.5, transitionSeconds);
  }

  /** Snap instantly — used by the capture harness and mission start. */
  forceWeather(kind: WeatherKind): void {
    this.prevKind = kind;
    this.weather.kind = kind;
    this.weather.blend = 1;
    this.targetProfile = WEATHER_PROFILES[kind];
    const p = this.targetProfile;
    this.weather.cloudCover = p.cloudCover;
    this.weather.precipitation = p.precipitation;
    this.weather.fogDensity = p.fogDensity;
    this.weather.windSpeed = p.windSpeed;
    this.weather.soundOcclusion = p.soundOcclusion;
    this.weather.visibilityFactor = p.visibilityFactor;
    this.updateCelestial(0);
  }

  setHour(hour: number): void {
    const prev = Math.floor(this.time.hour);
    this.time.hour = ((hour % 24) + 24) % 24;
    if (Math.floor(this.time.hour) !== prev) {
      bus.emit('time:hourChanged', { hour: Math.floor(this.time.hour) });
    }
    this.updateCelestial(0);
  }

  setTimeScale(scale: number): void {
    this.time.timeScale = Math.max(0, scale);
  }

  lightLevelAt(p: THREE.Vector3): number {
    // Base sky light, reduced indoors. Lamp contribution is added by the
    // lighting team via registerLocalLight().
    let level = this.time.ambientLightLevel;
    const world = services.tryGet('world');
    if (world?.isIndoors(p)) level *= 0.35;
    let lamp = 0;
    for (const l of this.localLights) {
      const d = l.position.distanceTo(p);
      if (d < l.radius) lamp += l.intensity * (1 - d / l.radius) ** 2;
    }
    return clamp01(level + lamp);
  }

  private localLights: Array<{ position: THREE.Vector3; radius: number; intensity: number }> = [];

  /** Lighting team registers lamps here so AI vision agrees with what's drawn. */
  registerLocalLight(position: THREE.Vector3, radius: number, intensity: number): void {
    this.localLights.push({ position, radius, intensity });
  }
  clearLocalLights(): void {
    this.localLights.length = 0;
  }

  update(dt: number, _ctx: EngineContext): void {
    // --- advance clock ----------------------------------------------------
    if (this.time.timeScale > 0) {
      const prevHour = Math.floor(this.time.hour);
      this.time.hour = (this.time.hour + (dt * this.time.timeScale) / 3600) % 24;
      if (Math.floor(this.time.hour) !== prevHour) {
        bus.emit('time:hourChanged', { hour: Math.floor(this.time.hour) });
      }
    }

    // --- blend weather ----------------------------------------------------
    if (this.weather.blend < 1) {
      this.weather.blend = Math.min(1, this.weather.blend + dt * this.transitionRate);
    }
    const from = WEATHER_PROFILES[this.prevKind];
    const to = this.targetProfile;
    const t = smoothstep(0, 1, this.weather.blend);
    this.weather.cloudCover = lerp(from.cloudCover, to.cloudCover, t);
    this.weather.precipitation = lerp(from.precipitation, to.precipitation, t);
    this.weather.fogDensity = lerp(from.fogDensity, to.fogDensity, t);
    this.weather.soundOcclusion = lerp(from.soundOcclusion, to.soundOcclusion, t);
    this.weather.visibilityFactor = lerp(from.visibilityFactor, to.visibilityFactor, t);

    // Wind meanders rather than holding a constant value.
    const targetWind = lerp(from.windSpeed, to.windSpeed, t);
    this.weather.windSpeed = damp(this.weather.windSpeed, targetWind * (0.8 + 0.4 * Math.sin(this.time.hour * 0.7)), 0.4, dt);
    this.weather.windDirection += Math.sin(performance.now() * 0.00003) * dt * 0.05;

    this.updateLightning(dt);
    this.updateCelestial(dt);
  }

  private updateLightning(dt: number): void {
    const stormy = this.weather.kind === 'thunderstorm' && this.weather.blend > 0.3;
    this.lightningFlash = Math.max(0, this.lightningFlash - dt * 6);
    this.weather.lightningActive = this.lightningFlash > 0.01;
    if (!stormy) return;
    this.lightningCooldown -= dt;
    if (this.lightningCooldown <= 0) {
      this.lightningCooldown = this.rng.range(4, 14);
      this.lightningFlash = this.rng.range(0.6, 1.4);
      bus.post('audio:oneShot', { id: 'thunder', volume: this.rng.range(0.6, 1) });
    }
  }

  private updateCelestial(dt: number): void {
    const t = this.time;
    // Hour angle: solar noon at 12:00.
    const hourAngle = ((t.hour - 12) / 24) * TAU;
    const declination = 0.21 * Math.sin((t.hour / 24) * TAU * 0.0027 + 1.2); // slow seasonal drift
    const sinEl =
      Math.sin(this.latitude) * Math.sin(declination) +
      Math.cos(this.latitude) * Math.cos(declination) * Math.cos(hourAngle);
    t.sunElevation = Math.asin(clamp01((sinEl + 1) / 2) * 2 - 1);
    t.sunAzimuth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(this.latitude) - Math.tan(declination) * Math.cos(this.latitude)) + Math.PI;

    const el = t.sunElevation;
    t.isNight = el < -0.06;

    // Daylight factor with a soft civil-twilight shoulder.
    const day = smoothstep(-0.18, 0.12, el);
    const profile = this.targetProfile;
    t.ambientLightLevel = clamp01(day * lerp(0.55, 1, 1 - this.weather.cloudCover) + (t.isNight ? 0.06 + 0.06 * t.moonPhase : 0));

    // Sun direction, then place the light relative to a shadow target that
    // follows the camera. A directional light fixed at the world origin only
    // shadows a box around the origin — geometry outside it samples past the
    // edge of the shadow map and comes back fully shadowed, which is why the
    // buildings were rendering black.
    const cosEl = Math.cos(el);
    this.sunDir.set(
      Math.sin(t.sunAzimuth) * cosEl,
      Math.sin(el),
      Math.cos(t.sunAzimuth) * cosEl,
    );

    const camPos = (services.get('render') as unknown as { camera: THREE.Camera }).camera.position;
    // Snap the shadow target to the shadow-map texel grid so shadows don't
    // crawl as the camera moves.
    const texel = (SHADOW_EXTENT * 2) / this.sun.shadow.mapSize.x;
    this.shadowTarget.set(
      Math.round(camPos.x / texel) * texel,
      Math.round(camPos.y / texel) * texel,
      Math.round(camPos.z / texel) * texel,
    );
    this.sun.target.position.copy(this.shadowTarget);
    this.sun.target.updateMatrixWorld();
    this.sun.position.copy(this.shadowTarget).addScaledVector(this.sunDir, SUN_DISTANCE);

    // Colour temperature ramps warm at low elevation — the golden-hour look.
    const warm = 1 - smoothstep(-0.05, 0.45, el);
    const sunColor = new THREE.Color().setHSL(
      lerp(0.11, 0.08, warm),
      lerp(0.25, 0.72, warm),
      lerp(0.72, 0.56, warm),
    );
    const sunIntensity = day * 3.4 * profile.sunAttenuation * lerp(1, 0.55, this.weather.cloudCover);
    this.sun.color.copy(sunColor);
    this.sun.intensity = sunIntensity + this.lightningFlash * 6;

    // Moon takes over below the horizon.
    this.moonDir.copy(this.sunDir).negate();
    this.moonDir.y = Math.abs(this.moonDir.y) * 0.75 + 0.25;
    this.moonDir.normalize();
    this.moon.target.position.copy(this.shadowTarget);
    this.moon.target.updateMatrixWorld();
    this.moon.position.copy(this.shadowTarget).addScaledVector(this.moonDir, SUN_DISTANCE);
    this.moon.intensity = t.isNight ? 0.14 + 0.2 * t.moonPhase : 0;

    // Hemisphere ambient follows sky colour and weather tint.
    const skyTop = new THREE.Color().setHSL(0.58, lerp(0.15, 0.55, day), lerp(0.06, 0.62, day));
    skyTop.lerp(profile.ambientTint, this.weather.cloudCover * 0.7);
    // Ground bounce is warm and gets stronger over bright terrain — this is the
    // light that keeps shadowed walls readable.
    const ground = new THREE.Color().setHSL(0.09, 0.30, lerp(0.04, 0.34, day));
    this.ambient.color.copy(skyTop);
    this.ambient.groundColor.copy(ground);
    // Skylight is a *large* fraction of total illumination, especially at low
    // sun angles and under cloud. The previous value left every surface facing
    // away from the sun crushed to black, which read as broken rather than
    // dramatic. Overcast pushes it higher still: the whole sky becomes the
    // light source.
    this.ambient.intensity =
      lerp(0.30, 2.15, day) * lerp(1, 1.45, this.weather.cloudCover) +
      this.lightningFlash * 1.5;

    // Drive the atmosphere pass from weather so fog density, sky colour and
    // the sky dome's horizon haze all move together.
    const post = (services.get('render') as unknown as {
      post?: { atmosphere: { heightDensity: number; distanceDensity: number; skyAmount: number } };
    }).post;
    if (post) {
      const a = post.atmosphere;
      a.heightDensity = damp(a.heightDensity, this.weather.fogDensity * 0.55, 1.5, dt || 0.016);
      a.distanceDensity = damp(a.distanceDensity, this.weather.fogDensity * 0.045, 1.5, dt || 0.016);
      a.skyAmount = lerp(0.06, 0.22, this.weather.cloudCover);
    }

    // Exposure is NOT set here any more. The post chain's auto-exposure pass
    // meters the actual rendered frame and adapts, which handles day/night far
    // better than a curve fitted to sun elevation — and two systems both
    // writing exposure fought each other.
    const renderCtx = services.get('render') as unknown as {
      renderer: THREE.WebGLRenderer;
      camera: THREE.Camera;
    };

    // --- drive the sky dome ----------------------------------------------
    // Haze colour is the fog colour, so the horizon and the scene agree.
    this.hazeColor.copy(skyTop).lerp(new THREE.Color(0x0a0f16), 1 - day);
    this.sky.update(
      dt || 0.016,
      renderCtx.camera.position,
      this.sunDir,
      this.moonDir,
      el,
      {
        moonPhase: t.moonPhase,
        cloudCover: this.weather.cloudCover,
        fogDensity: this.weather.fogDensity,
        hazeColor: this.hazeColor,
        lightningFlash: this.lightningFlash,
      },
    );
  }
}
