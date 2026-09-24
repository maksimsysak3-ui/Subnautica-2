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
 * Just over a day: a game day is ninety seconds, so a front comes through
 * about every two minutes and a player who watches for five sees the sky do
 * several different things. Two and a half days of front was defensible and
 * meant a session could pass entirely under one flat sky, which is not what
 * weather is for -- and much below one is a strobe.
 */
const FRONT_DAYS = 1.2;

/** Dries in about four in-game hours from soaking to dry. */
const DRY_RATE = 1 / (4 / 24);

/**
 * The sky a given front produces.
 *
 * Pulled out of the class so a forecast is the same function as the weather:
 * the phone's outlook samples the noise field a few hours ahead and runs it
 * through this, so what it promises is exactly what will arrive rather than a
 * second model that agrees with the first most of the time.
 */
export function skyOf(front: number): Sky {
  const f = Math.min(1, Math.max(0, front));
  // Cover comes first and comes early: it is overcast well before it rains.
  const cover = Math.min(1, f * 1.35);
  // Rain needs the sky to be properly shut. Below that it is just a grey day,
  // which is most grey days.
  const rain = Math.max(0, (f - 0.66) / 0.34) ** 1.25;
  // Fog is the other end of the same scale, not the same end. It sits in still
  // settled air, so it belongs to the calm side -- and it is cut once the rain
  // arrives, because rain clears the air rather than thickening it.
  //
  // A band, not a ramp. The ramp this replaced put the most fog on the
  // *clearest* front -- 0.55 at a front of zero -- so every fine day in the
  // game was a hazy one, and the far half of every view dissolved into grey.
  // Fog is its own weather: settled air just short of cloud, now and then.
  const still = Math.exp(-(((f - 0.2) / 0.07) ** 2));
  const fog = Math.min(1, still * 0.6 * (1 - rain));
  return { cover, fog, rain, wet: rain > 0.05 ? 1 : 0 };
}

/** What to call a sky. */
export function labelOf(s: Sky): string {
  if (s.rain > 0.55) return 'Heavy rain';
  if (s.rain > 0.12) return 'Rain';
  if (s.fog > 0.3) return 'Fog';
  if (s.cover > 0.75) return 'Overcast';
  if (s.cover > 0.35) return 'Cloudy';
  if (s.cover > 0.12) return 'Fair';
  return 'Clear';
}

/**
 * The pictogram for it, by name (see ui/glyphs.ts), so a readout scans at a
 * glance. A name rather than a character: the weather symbols in fonts render
 * as colour emoji on most systems, in whatever style the platform likes.
 */
export function glyphOf(s: Sky): string {
  if (s.rain > 0.55) return 'storm';
  if (s.rain > 0.12) return 'rain';
  if (s.fog > 0.3) return 'fog';
  if (s.cover > 0.75) return 'cloud';
  if (s.cover > 0.35) return 'partly';
  return 'sun';
}

export class Weather {
  readonly sky: Sky = { cover: 0.12, fog: 0.05, rain: 0, wet: 0 };

  /**
   * Where in the cycle the weather is, independent of the clock.
   *
   * Its own phase rather than a function of `timeOfDay`, because the day wraps
   * every eight minutes and weather that wrapped with it would repeat exactly:
   * the same shower at the same hour, for ever.
   */
  private phase = Weather.clearStart();

  /**
   * Where in the weather's cycle a new game begins: the first stretch of it
   * that stays clear for a day and a half.
   *
   * The first minutes of a city builder are spent looking at empty land and
   * deciding where the first road goes. Opening that under fog -- which the
   * old fixed starting phase did -- hides the river and the hills the whole
   * decision is about, and makes a poor first impression of the game besides.
   * The cycle is deterministic, so this is too.
   */
  private static clearStart(): number {
    const span = 1.5 / FRONT_DAYS;
    for (let p = 0; p < 40; p += 0.01) {
      let clear = true;
      for (let t = 0; t <= span; t += span / 8) {
        const raw = fbm(p + t, 11.7, 2, 4471);
        if ((raw - 0.31) * 2.4 > 0.08) { clear = false; break; }
      }
      if (clear) return p;
    }
    return 0.37;
  }

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
    return this.frontAt(this.phase);
  }

  /**
   * The front `days` of game time from now.
   *
   * The whole model is a noise field read on a phase, and the phase is a linear
   * function of the clock -- so the weather an hour from now is not a guess, it
   * is the same lookup at a different argument. That is what makes a forecast
   * in this game honest: it is the sky that will actually be there.
   *
   * A pinned sky forecasts itself, because that is what pinning means.
   */
  ahead(days: number): number {
    if (this.forced !== null) return this.forced;
    return this.frontAt(this.phase + days / FRONT_DAYS);
  }

  private frontAt(phase: number): number {
    if (this.forced !== null) return this.forced;
    // Two octaves at the same scale a day is measured in, offset so it is not
    // symmetric about noon. `fbm` is 0..1 and clusters around the middle, so
    // this is stretched to reach both ends -- otherwise the sky lived
    // permanently in a mild overcast and nothing ever properly cleared.
    const raw = fbm(phase, 11.7, 2, 4471);
    // Shifted down and stretched, and then measured rather than guessed at.
    // The old window opened at 0.34 with a gain of 2.35 and `fbm` clusters so
    // tightly around its middle that the top of the range -- where rain lives
    // -- was reached about once an hour of play. Over forty thousand samples
    // this one gives roughly: cloudy 28%, fog 22%, overcast 16%, rain 12%,
    // heavy rain 13%, fair 9%. A sky that does something.
    return Math.min(1, Math.max(0, (raw - 0.31) * 2.4));
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
    // The wetness is the one thing that is not a function of the front: it
    // lags, and `advance` owns it. Everything else is.
    const next = skyOf(this.front);
    this.sky.cover = next.cover;
    this.sky.rain = next.rain;
    this.sky.fog = next.fog;
  }

  /** What to call this, for the bar. */
  get label(): string { return labelOf(this.sky); }

  /** A glyph for it, so the bar reads at a glance rather than by reading. */
  get glyph(): string { return glyphOf(this.sky); }
}

/**
 * Days of the sun's calendar in a year: four seasons of seven. The calendar
 * counts the slow days the sky shows, not the simulation's, so the seasons
 * turn within a session (about an hour and a half each at speed 1). It starts
 * in spring, in March.
 */
export const DAYS_PER_YEAR = 28;

/** Month of a game day, 0 January to 11 December. Day 0 is the first of March. */
export function monthOf(day: number): number {
  const doy = ((day % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR;
  return (2 + Math.floor((doy * 12) / DAYS_PER_YEAR)) % 12;
}

/** Calendar year of a game day; the city is founded in 2027. */
export function yearOf(day: number): number {
  return 2027 + Math.floor((day + (2 * DAYS_PER_YEAR) / 12) / DAYS_PER_YEAR);
}

/** Season of a month, 0 winter, 1 spring, 2 summer, 3 autumn. */
export function seasonOfMonth(month: number): number {
  return Math.floor(((month + 1) % 12) / 3);
}

/** Each season's typical overnight low and afternoon high, in Celsius. */
const CLIMATE = [
  { low: -1, high: 5 }, { low: 6, high: 15 }, { low: 14, high: 26 }, { low: 5, high: 14 },
];

/**
 * The temperature, as one function the bar and the phone both read.
 *
 * Not simulated -- the model holds no heat -- but a stated function of what it
 * does hold: the season's range, coldest before dawn and warmest mid-afternoon,
 * with cloud flattening the swing and cooling the day, and rain a little more.
 */
export function temperature(day: number, hour: number, sky: Sky): number {
  const c = CLIMATE[seasonOfMonth(monthOf(day + Math.floor(hour / 24)))];
  const mid = (c.low + c.high) / 2;
  const half = ((c.high - c.low) / 2) * (1 - 0.45 * sky.cover);
  return mid + half * Math.cos(((hour - 15) / 24) * Math.PI * 2) - 2 * sky.cover - 1.5 * sky.rain;
}
