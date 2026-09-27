/**
 * Natural disasters: storms, floods and earthquakes.
 *
 * Rare, and never in a village: a town of a few hundred has enough to learn
 * without the ground moving under it. Once a city is established, every so
 * often something happens to it that nobody chose -- and what it costs is
 * decided by what the player built beforehand.
 *
 * A disaster does its damage through the one thing every building already
 * has: its health. A building knocked down below the lifecycle's line is
 * condemned and cleared by the lifecycle, exactly as neglect would clear it;
 * one only shaken is left failing and climbs back as fast as its street
 * deserves. So a well-served city recovers from a storm in days and a
 * neglected one does not, which is the lesson, and there is no second
 * damage model to keep in step with the first.
 *
 * What the player can do about it:
 *   - fire cover: crews on the scene in minutes save buildings a quake or a
 *     storm would otherwise lose;
 *   - the council's projects: flood defences, a seismic building code and an
 *     emergency plan each take a share off one kind of damage for good;
 *   - not building on the river's banks, which is where floods go.
 *
 * Storms and floods are forecast a day ahead; an earthquake is not.
 */

import type { Budget } from './budget';
import type { Effects } from './policies';
import type { Newsroom } from './news';

export type DisasterKind = 'storm' | 'flood' | 'quake';

/** How often, chosen when the city is founded. */
export const DISASTER_LEVELS = ['off', 'rare', 'normal', 'often'] as const;
export type DisasterLevel = typeof DISASTER_LEVELS[number];

/** Mean game days between disasters at each level. 28 days is a year. */
const MEAN_DAYS: Record<DisasterLevel, number> = { off: Infinity, rare: 84, normal: 42, often: 21 };

/** Residents below which nothing happens: a village has enough to learn. */
export const DISASTER_POPULATION = 1500;

/** Days of calm after a disaster, however unlucky the dice. */
const RESPITE = 10;

/** A building's health is 0 to 255; at or below this the lifecycle clears it. */
const RUIN = 12;

/** What one point of damage (a whole building's worth) costs to put right, in display money. */
const REPAIR_PER_BUILDING = 6000;

export interface Warning {
  kind: DisasterKind;
  /** The game day it strikes. */
  at: number;
  x: number;
  z: number;
  /** Metres: the reach of the damage. */
  radius: number;
  /** Direction of a storm's track, radians. */
  heading: number;
  /** 0 to 1: how bad it will be. */
  severity: number;
}

export interface Strike {
  kind: DisasterKind;
  day: number;
  x: number;
  z: number;
  radius: number;
  /** Buildings damaged, and those past saving. */
  hit: number;
  ruined: number;
  /** What the repairs cost the treasury. */
  bill: number;
  /** Fires the quake or the storm started. */
  fires: number;
  /** Richter, for a quake; otherwise 0. */
  magnitude: number;
}

/** What a disaster needs to know about the city, read off the simulation. */
export interface DisasterCity {
  population: number;
  /** Buildings in the table, some of them empty slots. */
  count: number;
  live(i: number): boolean;
  /** Service buildings are the city's own and are not damaged: see the note in `strike`. */
  service(i: number): boolean;
  x(i: number): number;
  z(i: number): number;
  /** Health 0 to 255, read and written in place. */
  health: Uint8Array;
  /** How well the fire service reaches this building, 0 to 1. */
  cover(i: number): number;
  /** Whether a point is on the river's banks, where a flood reaches. */
  riverside(x: number, z: number): boolean;
  /** Sets a building alight through the dispatch model. */
  ignite(i: number): void;
}

export interface DisasterNews {
  warned?: Warning;
  struck?: Strike;
}

const LABEL: Record<DisasterKind, string> = { storm: 'storm', flood: 'flood', quake: 'earthquake' };

/** A seeded generator with its state in the save, so a reload does not reroll the weather. */
function next(state: { s: number }): number {
  state.s = (state.s + 0x6d2b79f5) >>> 0;
  let t = state.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export class Disasters {
  level: DisasterLevel = 'rare';
  warning: Warning | null = null;
  /** Most recent first. */
  history: Strike[] = [];
  private calmUntil = 0;
  private stepped: number | null = null;
  private readonly rng: { s: number };

  /** Each city its own dice, kept in the save: two cities do not share a schedule. */
  constructor(seed = (Math.random() * 0x100000000) >>> 0) {
    this.rng = { s: seed >>> 0 };
  }

  /**
   * Steps the calendar to `day`. Returns what happened, if anything did.
   * Rolls once per whole game day, so the rate is the same at every speed.
   */
  update(day: number, city: DisasterCity, effects: Effects, budget: Budget, news: Newsroom): DisasterNews | null {
    let out: DisasterNews | null = null;
    // A forecast storm arrives whatever the population does in the meantime.
    if (this.warning !== null && day >= this.warning.at) {
      const w = this.warning;
      this.warning = null;
      out = { struck: this.strike(w, day, city, effects, budget, news) };
    }
    const whole = Math.floor(day);
    if (this.stepped === null) { this.stepped = whole; return out; }
    if (whole <= this.stepped) return out;
    const days = Math.min(7, whole - this.stepped);
    this.stepped = whole;
    if (this.level === 'off' || city.population < DISASTER_POPULATION) return out;
    if (this.warning !== null || day < this.calmUntil) return out;
    const chance = 1 - Math.exp(-days / MEAN_DAYS[this.level]);
    if (next(this.rng) >= chance) return out;
    const w = this.plan(day, city);
    if (w === null) return out;
    if (w.kind === 'quake') return { ...out, struck: this.strike(w, day, city, effects, budget, news) };
    this.warning = w;
    news.print(day, 'city', 'bad', w.kind === 'flood' ? 'Flood warning for the river' : 'Storm warning',
      w.kind === 'flood'
        ? 'Heavy rain upstream. The river is expected to break its banks within a day; homes and works along it are at risk.'
        : 'A severe storm is forecast to cross the city within a day. Crews are on standby.');
    return { ...out, warned: w };
  }

  /** Forces one now, for the tests and the headless fixtures. */
  force(kind: DisasterKind, day: number, city: DisasterCity, effects: Effects, budget: Budget, news: Newsroom): Strike | null {
    const w = this.plan(day, city, kind);
    return w === null ? null : this.strike(w, day, city, effects, budget, news);
  }

  /** What is coming, and where: a disaster aimed at somewhere people live. */
  private plan(day: number, city: DisasterCity, only?: DisasterKind): Warning | null {
    const r = (): number => next(this.rng);
    // Somewhere built up: a random standing building, a few tries.
    const pickBuilding = (want?: (i: number) => boolean): number => {
      for (let tries = 0; tries < 80; tries++) {
        const i = Math.floor(r() * city.count);
        if (!city.live(i) || city.service(i)) continue;
        if (want !== undefined && !want(i)) continue;
        return i;
      }
      return -1;
    };
    const wet = pickBuilding((i) => city.riverside(city.x(i), city.z(i)));
    let kind: DisasterKind = only ?? 'storm';
    if (only === undefined) {
      const roll = r();
      kind = roll < 0.45 ? 'storm' : roll < 0.75 && wet >= 0 ? 'flood' : 'quake';
    }
    const at = kind === 'flood' ? wet : pickBuilding();
    if (at < 0) return null;
    const severity = 0.35 + 0.65 * r() * r();
    return {
      kind, at: day + (kind === 'quake' ? 0 : 1), x: city.x(at), z: city.z(at),
      radius: kind === 'quake' ? 300 + 260 * severity : kind === 'flood' ? 650 : 110,
      heading: r() * Math.PI * 2, severity,
    };
  }

  /**
   * The damage, building by building.
   *
   * Service buildings are left standing: a fire station knocked flat by the
   * quake it is meant to answer is realistic and no fun at all, and the
   * lifecycle does not look after the city's own buildings, so one damaged
   * here would stay damaged for ever.
   */
  private strike(w: Warning, day: number, city: DisasterCity, effects: Effects, budget: Budget, news: Newsroom): Strike {
    const r = (): number => next(this.rng);
    const mult = w.kind === 'quake' ? effects.quakeDamage : w.kind === 'flood' ? effects.floodDamage : effects.stormDamage;
    const hx = Math.cos(w.heading), hz = Math.sin(w.heading);
    const STORM_LENGTH = 900;
    let hit = 0, ruined = 0, damage = 0;
    const burning: number[] = [];
    for (let i = 0; i < city.count; i++) {
      if (!city.live(i) || city.service(i)) continue;
      const dx = city.x(i) - w.x, dz = city.z(i) - w.z;
      let d = 0;
      if (w.kind === 'quake') {
        const dist = Math.hypot(dx, dz);
        if (dist >= w.radius) continue;
        d = (0.45 + 0.75 * w.severity) * Math.pow(1 - dist / w.radius, 1.3) * (1 - 0.4 * city.cover(i));
        if (dist < w.radius * 0.35 && r() < 0.04 * w.severity) burning.push(i);
      } else if (w.kind === 'storm') {
        // A track: along the heading, some way either side of it.
        const along = dx * hx + dz * hz;
        const across = Math.abs(-dx * hz + dz * hx);
        if (Math.abs(along) > STORM_LENGTH / 2 || across > w.radius) continue;
        d = (0.3 + 0.5 * w.severity) * (1 - across / w.radius) * (0.6 + 0.4 * r()) * (1 - 0.25 * city.cover(i));
        if (r() < 0.004) burning.push(i);
      } else {
        if (Math.hypot(dx, dz) > w.radius || !city.riverside(city.x(i), city.z(i))) continue;
        d = (0.4 + 0.5 * w.severity) * (0.75 + 0.25 * r());
      }
      d *= mult;
      if (d < 0.03) continue;
      const before = city.health[i];
      const after = Math.max(0, Math.round(before - d * 255));
      city.health[i] = after;
      hit++;
      damage += (before - after) / 255;
      if (after <= RUIN) ruined++;
    }
    let fires = 0;
    for (const i of burning.slice(0, 4)) { city.ignite(i); fires++; }
    const bill = Math.round(damage * REPAIR_PER_BUILDING / 100) * 100;
    budget.charge(bill);
    const magnitude = w.kind === 'quake' ? Math.round((4.6 + 2.3 * w.severity) * 10) / 10 : 0;
    const s: Strike = { kind: w.kind, day, x: w.x, z: w.z, radius: w.radius, hit, ruined, bill, fires, magnitude };
    this.history.unshift(s);
    if (this.history.length > 12) this.history.length = 12;
    this.calmUntil = day + RESPITE;
    const head = w.kind === 'quake' ? `Magnitude ${magnitude} earthquake shakes the city`
      : w.kind === 'flood' ? 'River bursts its banks' : 'Storm tears across the city';
    const cost = bill >= 1e6 ? `${(bill / 1e6).toFixed(1)}M` : `${Math.round(bill / 1000)}k`;
    news.print(day, 'city', 'bad', head,
      hit === 0 ? `The ${LABEL[w.kind]} passed without serious damage.`
        : `${hit} building${hit === 1 ? '' : 's'} damaged${ruined > 0 ? `, ${ruined} beyond repair` : ''}. `
          + `Repairs will cost the city ${cost}.${fires > 0 ? ` ${fires} fire${fires === 1 ? '' : 's'} broke out.` : ''}`);
    return s;
  }

  saved(): unknown {
    return { level: this.level, warning: this.warning, history: this.history, calmUntil: this.calmUntil, rng: this.rng.s };
  }

  restore(raw: unknown): void {
    if (raw === null || typeof raw !== 'object') return;
    const o = raw as Record<string, unknown>;
    if (typeof o.level === 'string' && (DISASTER_LEVELS as readonly string[]).includes(o.level)) this.level = o.level as DisasterLevel;
    const w = o.warning as Warning | null | undefined;
    this.warning = w !== null && typeof w === 'object' && typeof w.at === 'number' && typeof w.x === 'number'
      && (w.kind === 'storm' || w.kind === 'flood' || w.kind === 'quake') ? { ...w } : null;
    this.history = Array.isArray(o.history)
      ? (o.history as Strike[]).filter((s) => s !== null && typeof s === 'object' && typeof s.day === 'number').slice(0, 12)
      : [];
    this.calmUntil = typeof o.calmUntil === 'number' ? o.calmUntil : 0;
    if (typeof o.rng === 'number') this.rng.s = o.rng >>> 0;
    this.stepped = null;
  }
}
