/**
 * City Hall: who runs the city, and what they promised to do with it.
 *
 * A town of five thousand starts holding elections. Three candidates stand,
 * one of them the player's own, each on a platform of up to three pledges --
 * and the pledges are the city's real ordinances (or a cap on the residential
 * tax), so a platform is not flavour text: whoever wins, their pledges are
 * switched on and pinned for the whole term. Backing the winner is how the
 * player keeps their hands on the levers; losing means governing a city whose
 * council has already decided some things for it. That is the twist, and it
 * costs nothing to model because the ordinances already do everything.
 *
 * WHY PEOPLE VOTE THE WAY THEY DO. From the city they are living in. Each
 * pledge is weighed against the city's actual problems -- rubbish piling up
 * makes recycling popular, a jammed ring road makes free buses popular, a high
 * residential rate makes a tax cut popular -- and the sitting mayor wears the
 * city's mood, for better or worse. A player who wants a pledge to win makes
 * the problem it answers visible; a player who fixes the problem takes the
 * wind out of a rival running on it.
 *
 * WHAT IS STORED. The phase, the calendar, the candidates, the momentum each
 * has built, and the poll history -- everything the next day needs. Nothing
 * derived from the city is stored; it is read fresh through `Issues`.
 */

import { POLICIES } from './policies';
import type { Policies } from './policies';
import type { Budget } from './budget';

/** Residents at which City Hall opens and the first campaign starts. */
export const ELECTION_POPULATION = 5000;
/** Game days from the start of a campaign to polling day. */
export const CAMPAIGN_DAYS = 12;
/** Game days a mayor serves before the next campaign. */
export const TERM_DAYS = 56;
/** Real seconds the count takes on election night. */
export const COUNT_SECONDS = 16;
/** The residential rate a tax-cut mandate holds the city under. */
export const TAX_CUT_CEILING = 0.07;
/** Approval below this for a week forces a recall election. */
export const RECALL_APPROVAL = 0.22;

/** What the city looks like to a voter. All shares are 0 to 1. */
export interface Issues {
  population: number;
  happiness: number;
  /** The week's bottom line. */
  net: number;
  /** The residential tax rate, as a fraction. */
  resTax: number;
  /** Shares of buildings with each complaint. */
  rubbish: number;
  crime: number;
  health: number;
  schooling: number;
  transport: number;
  utilities: number;
  /** Shops short of customers. */
  trade: number;
  /** Share of jobs that are industrial. */
  industry: number;
  /** Share of traffic that is moving. */
  flowing: number;
}

export const CALM: Issues = {
  population: 0, happiness: 0.6, net: 0, resTax: 0.09,
  rubbish: 0, crime: 0, health: 0, schooling: 0, transport: 0, utilities: 0,
  trade: 0, industry: 0, flowing: 1,
};

export interface Pledge {
  /** An ordinance id, or 'taxCut'. */
  id: string;
  name: string;
  /** What voters hear. */
  pitch: string;
  /** How much this pledge wins votes in this city, roughly -0.2 to 0.6. */
  appeal: (c: Issues) => number;
}

const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

export const PLEDGES: readonly Pledge[] = [
  { id: 'taxCut', name: 'Cut the house tax', pitch: 'Residential tax held at 7% or below',
    appeal: (c) => clamp((c.resTax - 0.065) * 7, -0.05, 0.5) + 0.04 },
  { id: 'recycling', name: 'Kerbside recycling', pitch: 'Sorted bins at every door',
    appeal: (c) => 0.03 + c.rubbish * 3 },
  { id: 'metering', name: 'Water meters', pitch: 'Pay for what you use',
    appeal: (c) => (c.net < 0 ? 0.1 : 0.02) - 0.02 },
  { id: 'smokeControl', name: 'Clean air', pitch: 'Filters on every works',
    appeal: (c) => 0.04 + c.industry * 0.55 },
  { id: 'freeTransit', name: 'Free buses', pitch: 'No fare on any line',
    appeal: (c) => 0.06 + c.transport * 2.5 + (1 - c.flowing) * 0.35 },
  { id: 'parking', name: 'Parking charges', pitch: 'Make drivers pay their way',
    appeal: (c) => (1 - c.flowing) * 0.3 - 0.12 },
  { id: 'businessRelief', name: 'High street relief', pitch: 'Rates relief for shops',
    appeal: (c) => 0.05 + c.trade * 2 },
  { id: 'adultEducation', name: 'Evening classes', pitch: 'Every school open at night',
    appeal: (c) => 0.04 + c.schooling * 2.5 },
  { id: 'watch', name: 'Safer streets', pitch: 'A watch on every street',
    appeal: (c) => 0.03 + c.crime * 3 },
  { id: 'greenCorridors', name: 'Green corridors', pitch: 'Trees through every quarter',
    appeal: (c) => 0.08 + (1 - c.happiness) * 0.2 },
  { id: 'heightLimit', name: 'Height limit', pitch: 'No towers on our skyline',
    appeal: (c) => 0.02 + (c.population > 40000 ? 0.08 : 0) },
];

export function pledgeById(id: string): Pledge | undefined {
  return PLEDGES.find((p) => p.id === id);
}

interface Party {
  name: string;
  colour: string;
  /** Pledges this party reaches for first. */
  leans: readonly string[];
  slogan: string;
}

const PARTIES: readonly Party[] = [
  { name: 'Green Streets', colour: '#5cc98a', leans: ['greenCorridors', 'smokeControl', 'freeTransit', 'recycling'],
    slogan: 'A city you can breathe in' },
  { name: 'Prosper', colour: '#f2b544', leans: ['taxCut', 'businessRelief', 'parking', 'metering'],
    slogan: 'Keep more of what you earn' },
  { name: 'Civic Union', colour: '#6fa8ff', leans: ['watch', 'adultEducation', 'recycling', 'metering'],
    slogan: 'Safe, schooled and sorted' },
  { name: 'Heritage', colour: '#c98bdb', leans: ['heightLimit', 'greenCorridors', 'watch', 'taxCut'],
    slogan: 'The town we grew up in' },
  { name: 'Movement', colour: '#ff7a6b', leans: ['freeTransit', 'adultEducation', 'businessRelief', 'watch'],
    slogan: 'Everybody gets there' },
];

/** The player's own ticket. */
const PLAYER_PARTY: Party = {
  name: 'Your ticket', colour: '#6fd3ff', leans: [], slogan: 'Built by the people who built it',
};

/**
 * First names in two pools, so the portrait drawn for a name suits it: the
 * face's seed carries which pool the name came from (see `portraits.ts`).
 */
const FIRST_A = ['Ada', 'Priya', 'Grace', 'Helena', 'Rosa', 'Maeve', 'Leila', 'Sanna', 'Nadia', 'Ines'];
const FIRST_B = ['Marcus', 'Tomas', 'Idris', 'Jun', 'Kofi', 'Anton', 'Owen', 'Felix', 'Dev', 'Callum'];
const LAST = ['Okafor', 'Lindqvist', 'Marsh', 'Adeyemi', 'Brennan', 'Castell', 'Novak', 'Hale',
  'Moreau', 'Fairweather', 'Quint', 'Osei', 'Varga', 'Pryce', 'Takahashi', 'Doyle', 'Arden'];

export interface Candidate {
  id: number;
  name: string;
  party: string;
  colour: string;
  slogan: string;
  /** Seed for the portrait. */
  face: number;
  pledges: string[];
  player: boolean;
  /** Campaign momentum: rallies, debates, scandals. Decays toward zero. */
  momentum: number;
}

export type Phase = 'closed' | 'campaign' | 'count' | 'term';

export interface Headline { day: number; text: string; tone: 'good' | 'bad' | 'flat' }

/** A small seeded generator, stored so a reload continues the same story. */
function next(state: { rng: number }): number {
  let t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export class Politics {
  phase: Phase = 'closed';
  /** The game day the current phase ends: polling day, or the end of the term. */
  until = 0;
  candidates: Candidate[] = [];
  /** The latest poll, per candidate, summing to 1. */
  poll: number[] = [];
  /** One poll per campaign day, for the trend line. */
  history: number[][] = [];
  /** The count: final shares, and how far through it the night is, 0 to 1. */
  result: number[] = [];
  counted = 0;
  /** Who holds office, as a candidate id, and whether that is the player's. */
  mayor: Candidate | null = null;
  approval = 0.5;
  /** Consecutive days under the recall line. */
  lowDays = 0;
  elections = 0;
  headlines: Headline[] = [];
  /** Day of the player's last rally, for the cooldown. */
  lastRally = -99;
  rng = 0x51f15e;
  /** Bumped on every visible change, so the app knows to repaint. */
  version = 0;
  private lastDay = -1;
  /** Candidate ids, so a returning mayor keeps theirs. */
  private nextId = 1;

  /** The player's candidate in the current race, if there is one. */
  get yours(): Candidate | null {
    return this.candidates.find((c) => c.player) ?? null;
  }

  /** Days until polling day or the end of the term. */
  daysLeft(day: number): number {
    return Math.max(0, Math.ceil(this.until - day));
  }

  /** What a rally costs, which scales with the city it is held in. */
  rallyCost(population: number): number {
    return Math.round((6000 + population * 1.2) / 500) * 500;
  }

  canRally(day: number): boolean {
    return this.phase === 'campaign' && day - this.lastRally >= 2;
  }

  /**
   * The player's candidate holds a rally. Paid for by the caller; a rally
   * gives a lift that fades over a few days, so it is a timing decision.
   */
  rally(day: number): boolean {
    const you = this.yours;
    if (you === null || !this.canRally(day)) return false;
    this.lastRally = day;
    you.momentum += 0.16;
    this.say(day, `${you.name} packs out the square. The crowd is still singing.`, 'good');
    return true;
  }

  /**
   * Sets one of the player's pledges. Changing course late costs a little:
   * a platform rewritten the week of the vote reads as a U-turn.
   */
  setPledges(day: number, ids: string[]): void {
    const you = this.yours;
    if (you === null || this.phase !== 'campaign') return;
    const clean = [...new Set(ids.filter((id) => pledgeById(id) !== undefined))].slice(0, 3);
    if (clean.join() === you.pledges.join()) return;
    const late = this.until - day < CAMPAIGN_DAYS / 2;
    if (late && you.pledges.length > 0) {
      you.momentum -= 0.04;
      this.say(day, `${you.name} rewrites the manifesto. Rivals call it a U-turn.`, 'bad');
    }
    you.pledges = clean;
    this.version++;
  }

  /**
   * One step. `day` is fractional game days, `dt` real seconds since the last
   * call. Returns true when something visible changed.
   */
  update(day: number, dt: number, city: Issues, policies: Policies, budget: Budget): boolean {
    let changed = false;
    const today = Math.floor(day);

    if (this.phase === 'closed') {
      if (city.population >= ELECTION_POPULATION) {
        this.startCampaign(day, city, CAMPAIGN_DAYS);
        changed = true;
      }
    } else if (this.phase === 'campaign') {
      if (today !== this.lastDay) {
        this.daily(today, city);
        changed = true;
      }
      if (day >= this.until) {
        this.startCount(day, city);
        changed = true;
      }
    } else if (this.phase === 'count') {
      this.counted = Math.min(1, this.counted + dt / COUNT_SECONDS);
      changed = true;
      if (this.counted >= 1) this.startTerm(day, policies, budget);
    } else if (this.phase === 'term') {
      if (today !== this.lastDay) {
        this.termDay(today, city);
        changed = true;
      }
      if (day >= this.until) {
        this.endTerm(policies, budget);
        this.startCampaign(day, city, CAMPAIGN_DAYS);
        changed = true;
      } else if (this.lowDays >= 7) {
        this.say(today, 'Recall petition passes. The city goes back to the polls early.', 'bad');
        this.endTerm(policies, budget);
        this.startCampaign(day, city, Math.round(CAMPAIGN_DAYS / 2));
        changed = true;
      }
    }
    this.lastDay = today;
    if (changed) this.version++;
    return changed;
  }

  /** Shares each candidate would take if the vote were today. */
  standing(city: Issues): number[] {
    const scores = this.candidates.map((c) => {
      let s = c.momentum;
      for (const id of c.pledges) s += pledgeById(id)?.appeal(city) ?? 0;
      // An empty platform is not neutral: a candidate who promises nothing is
      // a candidate nobody turns out for.
      s -= (3 - c.pledges.length) * 0.05;
      if (this.mayor !== null && c.id === this.mayor.id) s += (city.happiness - 0.55) * 1.3;
      return s;
    });
    const top = Math.max(...scores);
    const w = scores.map((s) => Math.exp((s - top) * 4.2));
    const sum = w.reduce((a, b) => a + b, 0);
    return w.map((x) => x / sum);
  }

  private startCampaign(day: number, city: Issues, days: number): void {
    this.phase = 'campaign';
    this.until = Math.floor(day) + days;
    this.history = [];
    this.result = [];
    this.counted = 0;
    this.lastRally = -99;
    const previous = this.mayor;
    const racers: Candidate[] = [];
    // The player's ticket, keeping its face and pledges if it ran before.
    const yours = this.candidates.find((c) => c.player);
    racers.push(yours !== undefined
      ? { ...yours, momentum: 0 }
      : this.candidate(PLAYER_PARTY, true, []));
    // A mayor who is not the player's stands again on their record.
    if (previous !== null && !previous.player) racers.push({ ...previous, momentum: 0.05 });
    const used = new Set(racers.map((c) => c.party));
    const pool = PARTIES.filter((p) => !used.has(p.name));
    while (racers.length < 3 && pool.length > 0) {
      const party = pool.splice(Math.floor(next(this) * pool.length), 1)[0];
      racers.push(this.candidate(party, false, this.platform(party, city)));
    }
    this.candidates = racers;
    this.poll = this.standing(city);
    this.history.push(this.poll.slice());
    const n = this.elections === 0 ? 'The city’s first election' : 'A new campaign';
    this.say(Math.floor(day), `${n} is under way. Polling day in ${days} days.`, 'flat');
  }

  /** Picks a rival's three pledges: its party's leanings, sharpest first. */
  private platform(party: Party, city: Issues): string[] {
    const ranked = party.leans
      .map((id) => ({ id, a: (pledgeById(id)?.appeal(city) ?? 0) + next(this) * 0.08 }))
      .sort((x, y) => y.a - x.a);
    return ranked.slice(0, 3).map((r) => r.id);
  }

  private candidate(party: Party, player: boolean, pledges: string[]): Candidate {
    const a = next(this) < 0.5;
    const pool = a ? FIRST_A : FIRST_B;
    const name = `${pool[Math.floor(next(this) * pool.length)]} `
      + `${LAST[Math.floor(next(this) * LAST.length)]}`;
    // Even faces for the first pool, odd for the second.
    const face = Math.floor(next(this) * 5e8) * 2 + (a ? 0 : 1);
    return {
      id: this.nextId++, name, party: party.name, colour: party.colour, slogan: party.slogan,
      face, pledges, player, momentum: 0,
    };
  }

  private daily(day: number, city: Issues): void {
    for (const c of this.candidates) c.momentum *= 0.82;
    // One thing happens on most days of a campaign.
    const roll = next(this);
    const rivals = this.candidates.filter((c) => !c.player);
    if (rivals.length > 0 && roll < 0.22) {
      const c = rivals[Math.floor(next(this) * rivals.length)];
      c.momentum += 0.1;
      this.say(day, `${c.name} (${c.party}) wins the local radio debate.`, 'flat');
    } else if (rivals.length > 0 && roll < 0.34) {
      const c = rivals[Math.floor(next(this) * rivals.length)];
      c.momentum -= 0.14;
      this.say(day, `Expenses row dogs ${c.name}. ${c.party} says it is a smear.`, 'good');
    } else if (roll < 0.44) {
      const you = this.yours;
      if (you !== null) {
        you.momentum -= 0.07;
        this.say(day, `A leaflet typo has ${you.name} promising "free busses". It trends.`, 'bad');
      }
    }
    const fresh = this.standing(city);
    // Polls move toward the truth, not onto it: a real one has a lag.
    this.poll = this.poll.length === fresh.length
      ? this.poll.map((p, i) => p * 0.45 + fresh[i] * 0.55)
      : fresh;
    const sum = this.poll.reduce((a, b) => a + b, 0);
    this.poll = this.poll.map((p) => p / sum);
    this.history.push(this.poll.slice());
    if (this.history.length > 40) this.history.shift();
  }

  private startCount(day: number, city: Issues): void {
    const base = this.standing(city);
    // The night itself: turnout and late deciders add a little noise, which
    // is what keeps a two-point lead from being a certainty.
    const noisy = base.map((s) => Math.max(0.01, s * (0.92 + next(this) * 0.16)));
    const sum = noisy.reduce((a, b) => a + b, 0);
    this.result = noisy.map((s) => s / sum);
    this.phase = 'count';
    this.counted = 0;
    this.say(Math.floor(day), 'Polls close. The count begins at the civic hall.', 'flat');
  }

  private startTerm(day: number, policies: Policies, budget: Budget): void {
    let win = 0;
    for (let i = 1; i < this.result.length; i++) if (this.result[i] > this.result[win]) win = i;
    const mayor = this.candidates[win];
    this.mayor = { ...mayor, momentum: 0 };
    this.phase = 'term';
    this.until = Math.floor(day) + TERM_DAYS;
    this.approval = 0.62;
    this.lowDays = 0;
    this.elections++;
    this.enact(mayor.pledges, policies, budget);
    const pct = Math.round(this.result[win] * 100);
    this.say(Math.floor(day), mayor.player
      ? `${mayor.name} wins with ${pct}% and takes the chain of office. Your platform is law.`
      : `${mayor.name} (${mayor.party}) wins with ${pct}%. Their pledges are now city policy.`,
    mayor.player ? 'good' : 'bad');
  }

  private termDay(day: number, city: Issues): void {
    // Approval follows the city's mood, slowly, and a budget in the red drags.
    const target = clamp(city.happiness * 0.9 + (city.net < 0 ? -0.08 : 0.04), 0, 1);
    this.approval += (target - this.approval) * 0.18;
    this.lowDays = this.approval < RECALL_APPROVAL ? this.lowDays + 1 : 0;
    if (this.lowDays === 3) this.say(day, 'A recall petition is circulating. It needs a week.', 'bad');
  }

  /** Switches a platform on and pins it for the term. */
  private enact(pledges: string[], policies: Policies, budget: Budget): void {
    for (const id of pledges) {
      if (id === 'taxCut') {
        budget.cap(0, TAX_CUT_CEILING);
        continue;
      }
      const i = POLICIES.findIndex((p) => p.id === id);
      if (i < 0) continue;
      policies.set(i, true);
      policies.pin(i, true);
    }
  }

  /** Lifts the term's pins. What was switched on stays on; it is the player's again. */
  private endTerm(policies: Policies, budget: Budget): void {
    policies.unpinAll();
    budget.cap(0, Infinity);
  }

  private say(day: number, text: string, tone: Headline['tone']): void {
    this.headlines.unshift({ day, text, tone });
    if (this.headlines.length > 12) this.headlines.length = 12;
  }

  /** Applies a loaded term's mandate to a freshly loaded city. */
  reapply(policies: Policies, budget: Budget): void {
    if (this.phase === 'term' && this.mayor !== null) this.enact(this.mayor.pledges, policies, budget);
  }

  saved(): unknown {
    return {
      phase: this.phase, until: this.until, candidates: this.candidates, poll: this.poll,
      history: this.history, result: this.result, counted: this.counted, mayor: this.mayor,
      approval: this.approval, lowDays: this.lowDays, elections: this.elections,
      headlines: this.headlines, lastRally: this.lastRally, rng: this.rng, nextId: this.nextId,
    };
  }

  restore(raw: unknown): void {
    if (typeof raw !== 'object' || raw === null) return;
    const r = raw as Record<string, unknown>;
    const phases: Phase[] = ['closed', 'campaign', 'count', 'term'];
    if (typeof r.phase === 'string' && phases.includes(r.phase as Phase)) this.phase = r.phase as Phase;
    const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
    this.until = num(r.until, 0);
    this.counted = num(r.counted, 0);
    this.approval = num(r.approval, 0.5);
    this.lowDays = num(r.lowDays, 0);
    this.elections = num(r.elections, 0);
    this.lastRally = num(r.lastRally, -99);
    this.rng = num(r.rng, this.rng) >>> 0;
    this.nextId = num(r.nextId, 1);
    const isCand = (c: unknown): c is Candidate => typeof c === 'object' && c !== null
      && typeof (c as Candidate).name === 'string' && Array.isArray((c as Candidate).pledges);
    this.candidates = Array.isArray(r.candidates) ? r.candidates.filter(isCand) : [];
    this.mayor = isCand(r.mayor) ? r.mayor : null;
    const nums = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : []);
    this.poll = nums(r.poll);
    this.result = nums(r.result);
    this.history = Array.isArray(r.history) ? r.history.map(nums) : [];
    this.headlines = Array.isArray(r.headlines) ? r.headlines.filter(
      (h): h is Headline => typeof h === 'object' && h !== null && typeof (h as Headline).text === 'string') : [];
    // A save taken mid-count resumes the count rather than skipping it.
    if (this.phase === 'count' && this.result.length !== this.candidates.length) this.phase = 'closed';
    this.version++;
  }
}
