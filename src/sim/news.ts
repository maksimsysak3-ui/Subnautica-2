/**
 * The Herald: what the city's paper printed, and when.
 *
 * Everything that happens to the city already raises an alert, and an alert
 * is gone in eight seconds. The paper is the record -- the council's votes,
 * the elections, the storms and the windfalls, the week the buses stopped --
 * kept so a player coming back to a city can read what it has been through,
 * and written in the paper's voice rather than the dashboard's.
 *
 * World state, saved with the city, capped so a long game does not grow its
 * save without end.
 */

export type NewsDesk = 'politics' | 'economy' | 'city' | 'safety' | 'transport' | 'people';
export type NewsTone = 'good' | 'bad' | 'flat';

export interface Story {
  /** Game day it ran, with the fraction. */
  day: number;
  desk: NewsDesk;
  tone: NewsTone;
  head: string;
  body: string;
}

/** Stories kept. A little over a season of a busy city. */
const KEEP = 80;

export class Newsroom {
  stories: Story[] = [];
  /** Bumped on every story, so readouts know to repaint. */
  version = 0;
  /** Heads printed recently, so the same story is not run twice in a week. */
  private recent = new Map<string, number>();

  /**
   * Runs a story. `key`, when given, holds back a repeat of the same story
   * for `quiet` days: a traffic column every morning is not news.
   */
  print(day: number, desk: NewsDesk, tone: NewsTone, head: string, body: string,
    key?: string, quiet = 7): boolean {
    if (key !== undefined) {
      const last = this.recent.get(key);
      if (last !== undefined && day - last < quiet) return false;
      this.recent.set(key, day);
    }
    // Newest first, by the day it ran rather than the order it was filed in.
    const at = this.stories.findIndex((st) => st.day <= day);
    this.stories.splice(at < 0 ? this.stories.length : at, 0, { day, desk, tone, head, body });
    if (this.stories.length > KEEP) this.stories.length = KEEP;
    this.version++;
    return true;
  }

  /** The most recent `n`, newest first. */
  latest(n: number): readonly Story[] {
    return this.stories.slice(0, n);
  }

  saved(): unknown {
    return { stories: this.stories, recent: [...this.recent] };
  }

  restore(raw: unknown): void {
    const r = (raw ?? {}) as { stories?: unknown; recent?: unknown };
    const ok = (s: unknown): s is Story => typeof s === 'object' && s !== null
      && typeof (s as Story).head === 'string' && typeof (s as Story).day === 'number';
    this.stories = Array.isArray(r.stories) ? r.stories.filter(ok).slice(0, KEEP) : [];
    this.recent = new Map(Array.isArray(r.recent)
      ? (r.recent as unknown[]).filter((e): e is [string, number] => Array.isArray(e)
        && typeof e[0] === 'string' && typeof e[1] === 'number')
      : []);
    this.version++;
  }
}
