/**
 * The weather.
 *
 * A city that is always sunny is a diorama. What makes a place feel like a
 * place is that it is sometimes under a flat grey lid with the lights on at
 * three in the afternoon, and that the roads shine for half an hour after the
 * rain stops.
 *
 * The whole model is one number -- how unsettled the air is -- read from a
 * slowly moving noise field on the clock, with the four things the renderer
 * actually needs derived from it. That is deliberate: cover, fog, rain and
 * wetness are not independent in the world and should not be independent here,
 * because the combinations that would produce -- driving rain under a clear
 * sky, fog on a bright windy afternoon -- are the ones that look broken.
 *
 * The one thing that does not follow the front is the wetness, which lags it.
 * Ground stays wet after a shower, and that lag is most of what makes rain read
 * as weather rather than as a particle effect switching off.
 */

import { fbm } from './hash';

export interface Sky {
  /** Cloud cover, 0 open sky to 1 solid overcast. */
  cover: number;
  /** Air between the eye and everything else, 0 to 1. */
  fog: number;
  /** How hard it is raining, 0 to 1. */
  rain: number;
  /** How wet the ground is, 0 to 1. Lags the rain. */
  wet: number;
}

/**
 * How long a front takes to pass, in days.
 *
 * Two and a half, so a player who sits through one in-game day sees the sky
 * change without it flickering between conditions inside an afternoon -- which
 * is what a period near one gave: weather as a strobe.
 */
const FRONT_DAYS = 2.5;

/** Dries in about four in-game hours from soaking to dry. */
const DRY_RATE = 1 / (4 / 24);

export class Weather {
  readonly sky: Sky = { cover: 0.12, fog: 0.05, rain: 0, wet: 0 };

  /**
   * Where in the cycle the weather is, independent of the clock.
   *
   * Its own phase rather than a function of `timeOfDay`, because the day wraps
   * every eight minutes and weather that wrapped with it would repeat exactly:
   * the same shower at the same hour, for ever.
   */
  private phase = 0.37;

  /**
   * A condition held fixed, or null to let the cycle run.
   *
   * Pinned rather than "set the phase to this number": the phase feeds a noise
   * field, so setting it to 0.9 does not give stormy weather, it gives whatever
   * the noise says at 0.9. A tool asking for a storm wants a storm.
   */
  private forced: number | null = null;

  /**
   * Holds a condition and settles the ground to match, for a tool that wants a
   * repeatable frame, or for a player who would rather it just stopped.
   */
  set(front: number): void {
    this.forced = Math.min(1, Math.max(0, front));
    this.derive();
    this.sky.wet = this.sky.rain > 0.05 ? 1 : 0;
  }

  /** Hands the sky back to the cycle. */
  release(): void {
    this.forced = null;
  }

  /** The unsettledness right now, 0 fine to 1 stormy. Public for the readout. */
  get front(): number {
    if (this.forced !== null) return this.forced;
    // Two octaves at the same scale a day is measured in, offset so it is not
    // symmetric about noon. `fbm` is 0..1 and clusters around the middle, so
    // this is stretched to reach both ends -- otherwise the sky lived
    // permanently in a mild overcast and nothing ever properly cleared.
    const raw = fbm(this.phase * 1.0, 11.7, 2, 4471);
    return Math.min(1, Math.max(0, (raw - 0.34) * 2.35));
  }

  /**
   * Advances by `dt` seconds of game time.
   *
   * `dayLength` is how many real seconds one in-game day takes, so the weather
   * runs on the same clock as the sun -- including the twelvefold speed-up
   * behind the menu, where a front passing is exactly what makes that shot
   * worth sitting through.
   */
  advance(dt: number, dayLength: number): void {
    this.phase += dt / (dayLength * FRONT_DAYS);
    this.derive();
    // The lag. Wet rises with the rain and falls on its own.
    const target = Math.min(1, this.sky.rain * 2.4);
    if (target > this.sky.wet) {
      this.sky.wet = Math.min(target, this.sky.wet + (dt / dayLength) * DRY_RATE * 3.5);
    } else {
      this.sky.wet = Math.max(0, this.sky.wet - (dt / dayLength) * DRY_RATE);
    }
  }

  private derive(): void {
    const f = this.front;
    // Cover comes first and comes early: it is overcast well before it rains.
    this.sky.cover = Math.min(1, f * 1.35);
    // Rain needs the sky to be properly shut. Below that it is just a grey day,
    // which is most grey days.
    this.sky.rain = Math.max(0, (f - 0.58) / 0.42) ** 1.4;
    // Fog is the other end of the same scale, not the same end. It sits in
    // still settled air, so it belongs to the calm side -- and it is cut once
    // the rain arrives, because rain clears the air rather than thickening it.
    const still = Math.max(0, 1 - f / 0.34);
    this.sky.fog = Math.min(1, still * 0.55 * (1 - this.sky.rain));
  }

  /** What to call this, for the bar. */
  get label(): string {
    const s = this.sky;
    if (s.rain > 0.55) return 'Heavy rain';
    if (s.rain > 0.12) return 'Rain';
    if (s.fog > 0.3) return 'Fog';
    if (s.cover > 0.75) return 'Overcast';
    if (s.cover > 0.35) return 'Cloudy';
    if (s.cover > 0.12) return 'Fair';
    return 'Clear';
  }

  /** A glyph for it, so the bar reads at a glance rather than by reading. */
  get glyph(): string {
    const s = this.sky;
    if (s.rain > 0.55) return '☔';
    if (s.rain > 0.12) return '☂';
    if (s.fog > 0.3) return '≈';
    if (s.cover > 0.75) return '☁';
    if (s.cover > 0.35) return '⛅';
    return '☀';
  }
}
