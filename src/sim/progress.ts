/**
 * The city's career: experience, levels, stars, and what they have bought.
 *
 * A city builder without progression is a sandbox, and a sandbox is a game you
 * stop playing the moment you have seen it work. What this adds is a reason to
 * keep going and a shape to the first hour: you start with the three services
 * a town cannot live without, and everything else -- the hospital, the
 * university, the nuclear plant, the landmarks -- is earned.
 *
 * TWO CURRENCIES, EARNED DIFFERENTLY, SPENT DIFFERENTLY.
 *
 *   EXPERIENCE is earned by playing: a little for every building placed, a
 *   little for every citizen who moves in, a lot for a landmark and a lot for
 *   finishing an objective. It buys levels, and a level pays out in money and
 *   stars and hands over the next landmarks.
 *
 *   STARS are spent in the development tree, one node at a time. They are the
 *   scarce one: a level is worth two or three, and the tree holds far more than
 *   a city will ever earn, so what a player unlocks is a choice about the kind
 *   of city they are building.
 *
 * Everything here is state of the city, so it saves and loads with it.
 */

/** Experience for one building the player places, per thousand it cost. */
const XP_PER_THOUSAND = 1.4;
/** And a flat amount, so a bus stop is still worth putting down. */
const XP_PER_BUILDING = 12;
/** For a landmark: the big, deliberate, expensive placement. */
const XP_PER_SIGNATURE = 900;
/** Per citizen who moves in. The passive drip that rewards a working city. */
const XP_PER_CITIZEN = 6;

/**
 * What each level costs, cumulatively.
 *
 * Roughly quadratic: the first few come quickly, because the first ten minutes
 * of a city builder have to feel like progress, and the later ones take a real
 * city to reach. Level twenty is a metropolis.
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return Math.round(600 * n + 210 * n * n);
}

/** Stars paid out on reaching a level. */
export function starsForLevel(level: number): number {
  if (level <= 1) return 3;
  return level % 3 === 0 ? 3 : 2;
}

/** Money paid out on reaching a level, which scales with what it costs to run. */
export function cashForLevel(level: number): number {
  return Math.round((40000 + 26000 * (level - 1)) / 1000) * 1000;
}

/** The name of each level, which is the only flattery in the game. */
export const LEVEL_NAMES = [
  'Site office', 'Hamlet', 'Village', 'Small town', 'Market town',
  'Boom town', 'Large town', 'Small city', 'City', 'Big city',
  'Regional hub', 'Metropolis', 'Great city', 'Capital', 'Megalopolis',
];

export function levelName(level: number): string {
  return LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length) - 1] ?? 'Megalopolis';
}

/** What happened when experience was added. */
export interface LevelUp {
  level: number;
  name: string;
  cash: number;
  stars: number;
  /** Asset ids this level handed over, if any. */
  unlocked: string[];
}

/** Where experience came from, for the readout and for the notice. */
export type XpSource = 'build' | 'landmark' | 'people' | 'objective';

export class Progress {
  xp = 0;
  level = 1;
  /** Stars earned and not yet spent. */
  stars = starsForLevel(1);
  /** Nodes of the development tree that have been bought. */
  readonly bought = new Set<string>();
  /** Assets unlocked by reaching a level rather than by spending a star. */
  readonly earned = new Set<string>();
  /** Goals the city has finished, so each pays once. */
  readonly done = new Set<string>();
  /** Experience by source, for the panel. */
  readonly bySource: Record<XpSource, number> = {
    build: 0, landmark: 0, people: 0, objective: 0,
  };
  /** Citizens already paid for, so the drip is on arrivals and not on the total. */
  private paidCitizens = 0;

  /** Experience still needed for the next level, and the span of this one. */
  get intoLevel(): number { return this.xp - xpForLevel(this.level); }
  get levelSpan(): number { return xpForLevel(this.level + 1) - xpForLevel(this.level); }
  get toNext(): number { return Math.max(0, xpForLevel(this.level + 1) - this.xp); }

  /**
   * Adds experience and returns every level it crossed.
   *
   * Several at once is possible and is not a special case: a player who places
   * a stadium at the right moment can take two levels on one click, and each
   * one pays out.
   */
  add(amount: number, source: XpSource, unlocksAt?: (level: number) => string[]): LevelUp[] {
    if (amount <= 0) return [];
    this.xp += amount;
    this.bySource[source] += amount;
    const levels: LevelUp[] = [];
    while (this.xp >= xpForLevel(this.level + 1)) {
      this.level++;
      const stars = starsForLevel(this.level);
      const cash = cashForLevel(this.level);
      this.stars += stars;
      const unlocked = unlocksAt?.(this.level) ?? [];
      for (const id of unlocked) this.earned.add(id);
      levels.push({ level: this.level, name: levelName(this.level), cash, stars, unlocked });
    }
    return levels;
  }

  /** Experience for a building the player paid for. */
  forBuilding(price: number, signature: boolean): number {
    return signature
      ? XP_PER_SIGNATURE + Math.round(price / 1000)
      : XP_PER_BUILDING + Math.round((price / 1000) * XP_PER_THOUSAND);
  }

  /**
   * Experience for the people who have arrived since this was last asked.
   *
   * Passive, and on the increase rather than on the count: a city of ten
   * thousand should not earn ten thousand citizens' worth of experience every
   * time somebody looks at it.
   */
  forCitizens(population: number): number {
    if (population <= this.paidCitizens) {
      // A city that shrinks does not refund, but it does re-earn what it
      // regains: the mark moves down with it.
      this.paidCitizens = population;
      return 0;
    }
    const gained = population - this.paidCitizens;
    this.paidCitizens = population;
    return gained * XP_PER_CITIZEN;
  }

  /** Whether a node has been bought. */
  has(node: string): boolean { return this.bought.has(node); }

  /** Buys a node, if there are stars for it. */
  buy(node: string, cost: number): boolean {
    if (this.bought.has(node) || this.stars < cost) return false;
    this.stars -= cost;
    this.bought.add(node);
    return true;
  }

  /**
   * Opens everything.
   *
   * For the probes and the screenshot tools, which are photographing a city
   * that was generated rather than played and have no career to have earned it
   * with -- and for a sandbox, if one is ever offered.
   */
  openEverything(nodes: string[], assets: string[]): void {
    for (const id of nodes) this.bought.add(id);
    for (const id of assets) this.earned.add(id);
  }

  /** The whole state, for the save file. */
  save(): unknown {
    return {
      xp: this.xp, level: this.level, stars: this.stars,
      bought: [...this.bought], earned: [...this.earned], done: [...this.done],
      paid: this.paidCitizens, by: this.bySource,
    };
  }

  restore(raw: unknown): void {
    const o = raw as Partial<{
      xp: number; level: number; stars: number; bought: string[];
      earned: string[]; done: string[]; paid: number; by: Record<string, number>;
    }> | null;
    if (o === null || typeof o !== 'object') return;
    this.xp = Number(o.xp) || 0;
    this.level = Math.max(1, Number(o.level) || 1);
    this.stars = Math.max(0, Number(o.stars) || 0);
    this.paidCitizens = Math.max(0, Number(o.paid) || 0);
    this.bought.clear();
    for (const id of o.bought ?? []) this.bought.add(String(id));
    this.earned.clear();
    for (const id of o.earned ?? []) this.earned.add(String(id));
    this.done.clear();
    for (const id of o.done ?? []) this.done.add(String(id));
    for (const k of Object.keys(this.bySource) as XpSource[]) {
      this.bySource[k] = Number(o.by?.[k]) || 0;
    }
  }
}
