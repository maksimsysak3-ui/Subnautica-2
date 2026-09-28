/**
 * City events: a match, a concert, a festival in the square, a marathon.
 *
 * Booked from the City Hall computer a day ahead, paid for up front, and run
 * for a day at a venue the city has built. While one is on, a large share of
 * the city's days out go to the venue -- so the crowds are real people on the
 * real roads, and a stadium with one road in has the jam to show for it --
 * visitors come from outside, and the gate takes money. Afterwards the city
 * is in a better mood for a few days, which is what the council and the
 * voters notice.
 *
 * One at a time, and each kind not again for a while: a city that holds a
 * festival every day holds none.
 */

import type { Budget } from './budget';
import type { Newsroom } from './news';

export interface EventDef {
  id: string;
  name: string;
  blurb: string;
  /** Asset ids that can host it; null for one the whole city is the venue for. */
  venue: RegExp | null;
  /** What the venue is called in the listing when there is none yet. */
  needs: string;
  /** Up front, display money. */
  cost: number;
  /** Tickets, display money a head. */
  ticket: number;
  /** Mood points for everybody while it lasts, and the days it lasts. */
  mood: number;
  moodDays: number;
  /** Share of the city that turns up, before visitors; and a cap on the gate. */
  turnout: number;
  capacity: number;
  minPop: number;
  /** Days before this kind can be booked again. */
  cooldown: number;
}

export const EVENTS: readonly EventDef[] = [
  {
    id: 'match', name: 'Match day', needs: 'a stadium, arena or sports ground',
    blurb: 'The home side at the stadium. The whole city talks about it, and half of it tries to drive there.',
    venue: /^svc\.parks\.(stadium|arena|gridiron|soccer|sports)$/,
    cost: 60000, ticket: 30, mood: 3, moodDays: 3, turnout: 0.2, capacity: 30000, minPop: 1500, cooldown: 5,
  },
  {
    id: 'concert', name: 'Open-air concert', needs: 'a concert hall, stadium or square',
    blurb: 'A headline act for a night. Draws from across the region, and the hotels fill.',
    venue: /^svc\.(gov\.concert|parks\.(stadium|arena|square|bandstand))$/,
    cost: 90000, ticket: 45, mood: 4, moodDays: 4, turnout: 0.12, capacity: 40000, minPop: 3000, cooldown: 10,
  },
  {
    id: 'festival', name: 'Summer festival', needs: 'a square, garden, lake or lido',
    blurb: 'Food stalls, bands and fairground rides in the park. Cheap, cheerful, and everybody comes.',
    venue: /^svc\.parks\.(square|garden|lake|lido|bandstand|glasshouse)$/,
    cost: 35000, ticket: 6, mood: 3, moodDays: 5, turnout: 0.35, capacity: 60000, minPop: 800, cooldown: 12,
  },
  {
    id: 'exhibition', name: 'Blockbuster exhibition', needs: 'a museum or gallery',
    blurb: 'A touring collection for a week of queues. The visitors stay the night; the gift shop does well.',
    venue: /^svc\.gov\.(museum|gallery)$/,
    cost: 70000, ticket: 20, mood: 2, moodDays: 7, turnout: 0.08, capacity: 20000, minPop: 2500, cooldown: 14,
  },
  {
    id: 'marathon', name: 'City marathon', needs: 'nothing but streets',
    blurb: 'Twenty-six miles through every district, with bands on the corners. The roads are shut, and nobody minds.',
    venue: null,
    cost: 50000, ticket: 12, mood: 3, moodDays: 3, turnout: 0.06, capacity: 30000, minPop: 5000, cooldown: 20,
  },
];

export function eventById(id: string): EventDef | undefined {
  return EVENTS.find((e) => e.id === id);
}

/** A place something can be held. */
export interface Venue { id: number; x: number; z: number; name: string }

/** What booking and running an event reads off the city. */
export interface EventCity {
  population: number;
  /** Visitors a day already, who make up part of any crowd. */
  visitors: number;
  /** Every building an event could be held at. */
  venues(re: RegExp): Venue[];
}

export interface Running {
  id: string;
  /**
   * Building index of the venue; -1 for the whole city; -2 when restored from a
   * save and not yet found again (indices do not survive one: see `relink`).
   */
  venue: number;
  x: number;
  z: number;
  where: string;
  from: number;
  until: number;
  /** Expected at the gate. */
  crowd: number;
}

export interface Held { id: string; day: number; crowd: number; takings: number }

export interface EventNews {
  started?: Running;
  finished?: Held;
}

/** A day of anything is the day after it is booked, all of the next day. */
const LEAD = 0.5, LENGTH = 1;

export class CityEvents {
  booked: Running | null = null;
  history: Held[] = [];
  /** Last day each kind was held, for the cooldown. */
  private last: Record<string, number> = {};
  /** Mood owed, and until when. */
  private moodPoints = 0;
  private moodUntil = 0;

  /** Why an event cannot be booked now, or null if it can. */
  refuse(def: EventDef, day: number, city: EventCity, budget: Budget): string | null {
    if (this.booked !== null) return `${eventById(this.booked.id)?.name ?? 'An event'} is already on the calendar`;
    if (city.population < def.minPop) return `Needs ${def.minPop.toLocaleString()} residents`;
    const last = this.last[def.id];
    if (last !== undefined && day - last < def.cooldown) return `Again in ${Math.ceil(def.cooldown - (day - last))} days`;
    if (def.venue !== null && city.venues(def.venue).length === 0) return `Needs ${def.needs}`;
    // A party is not what the overdraft is for: the money has to be there.
    if (budget.balance < def.cost) return 'The treasury cannot cover it';
    return null;
  }

  /** How many would come, before the gate caps it. */
  crowdFor(def: EventDef, city: EventCity): number {
    return Math.round(Math.min(def.capacity, city.population * def.turnout + Math.max(0, city.visitors) * 0.6 + 200));
  }

  /** Books one for tomorrow at the city's best venue for it. Returns why not, or null. */
  book(id: string, day: number, city: EventCity, budget: Budget, news: Newsroom): string | null {
    const def = eventById(id);
    if (def === undefined) return 'No such event';
    const why = this.refuse(def, day, city, budget);
    if (why !== null) return why;
    const spots = def.venue === null ? [] : city.venues(def.venue);
    // The first match in the table is as good as any: a stadium is a stadium.
    const v = spots[0];
    budget.spend(def.cost);
    this.booked = {
      id, venue: v?.id ?? -1, x: v?.x ?? 0, z: v?.z ?? 0, where: v?.name ?? 'across the city',
      from: day + LEAD, until: day + LEAD + LENGTH, crowd: this.crowdFor(def, city),
    };
    news.print(day, 'people', 'good', `${def.name} announced`,
      `${def.blurb} Tomorrow, ${v === undefined ? 'across the city' : `at ${v.name}`}. Tickets on sale now.`);
    return null;
  }

  /** Whether one is on now, and where: what the routine sends people to. */
  live(day: number): Running | null {
    const b = this.booked;
    return b !== null && day >= b.from && day < b.until ? b : null;
  }

  /** Visitors from outside, for the day it is on. */
  visitors(day: number): number {
    const r = this.live(day);
    return r === null ? 0 : Math.round(r.crowd * 0.4);
  }

  /** Mood points it gives the city, while they last. */
  mood(day: number): number {
    return day < this.moodUntil ? this.moodPoints : 0;
  }

  update(day: number, budget: Budget, news: Newsroom): EventNews | null {
    const b = this.booked;
    if (b === null) return null;
    const def = eventById(b.id);
    if (def === undefined) { this.booked = null; return null; }
    if (day >= b.until) {
      // Over: the gate is counted, and the mood lingers.
      this.booked = null;
      const takings = Math.round(b.crowd * def.ticket);
      budget.credit(takings);
      this.last[def.id] = day;
      this.moodPoints = def.mood;
      this.moodUntil = day + def.moodDays;
      const held: Held = { id: def.id, day, crowd: b.crowd, takings };
      this.history.unshift(held);
      if (this.history.length > 12) this.history.length = 12;
      news.print(day, 'people', 'good', `${b.crowd.toLocaleString()} at the ${def.name.toLowerCase()}`,
        `${def.name} ${b.where === 'across the city' ? 'across the city' : `at ${b.where}`}: a day to remember. The gate took ${Math.round(takings / 1000)}k.`);
      return { finished: held };
    }
    return null;
  }

  /** Finds a restored booking's venue again, by where it stood. */
  relink(city: EventCity): void {
    const b = this.booked;
    if (b === null || b.venue !== -2) return;
    const def = eventById(b.id);
    if (def?.venue == null) { b.venue = -1; return; }
    let best = -1, bestD = Infinity;
    for (const v of city.venues(def.venue)) {
      const d = Math.hypot(v.x - b.x, v.z - b.z);
      if (d < bestD) { bestD = d; best = v.id; }
    }
    b.venue = best;
  }

  saved(): unknown {
    return { history: this.history, last: this.last, moodPoints: this.moodPoints, moodUntil: this.moodUntil, booked: this.booked };
  }

  restore(raw: unknown): void {
    if (raw === null || typeof raw !== 'object') return;
    const o = raw as Record<string, unknown>;
    this.history = Array.isArray(o.history)
      ? (o.history as Held[]).filter((h) => h !== null && typeof h === 'object' && typeof h.day === 'number' && eventById(h.id) !== undefined).slice(0, 12)
      : [];
    this.last = {};
    if (o.last !== null && typeof o.last === 'object') {
      for (const [k, v] of Object.entries(o.last as Record<string, unknown>)) if (typeof v === 'number' && eventById(k) !== undefined) this.last[k] = v;
    }
    this.moodPoints = typeof o.moodPoints === 'number' ? o.moodPoints : 0;
    this.moodUntil = typeof o.moodUntil === 'number' ? o.moodUntil : 0;
    // A booking keeps its place and time; the venue is found again by position.
    const b = o.booked as Running | null | undefined;
    this.booked = b !== null && typeof b === 'object' && eventById(b.id) !== undefined
      && typeof b.from === 'number' && typeof b.until === 'number' && typeof b.x === 'number' && typeof b.z === 'number'
      ? { ...b, venue: b.venue === -1 ? -1 : -2, crowd: Math.max(0, Number(b.crowd) || 0), where: String(b.where ?? 'the venue') }
      : null;
  }
}
