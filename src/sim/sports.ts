/**
 * The city's own professional team.
 *
 * A stadium stands empty between concerts. A team fills it every other game
 * day, and a team is a story a player follows: a name, a sport, a squad of
 * people with names and numbers, a league table, a run of form, a derby, a
 * title. The city pays the wages and the club pays the city back at the gate,
 * so a winning side is a real income and a losing one is a real bill.
 *
 * One team per city, and only once there is somewhere for it to play: a
 * stadium or an arena. The league is a handful of rival clubs from elsewhere,
 * each with a strength that drifts from season to season.
 */

import type { Budget } from './budget';
import type { Newsroom } from './news';

export interface SportDef {
  id: string;
  name: string;
  /** Players on the books, and how many play at once. */
  squad: number;
  lineup: number;
  positions: string[];
  /** Whether a game can end level. */
  draws: boolean;
  /** Typical score per side, and its spread. */
  score: number;
  spread: number;
  /** Which venue kinds suit it, most suited first. */
  venues: string[];
}

export const SPORTS: readonly SportDef[] = [
  { id: 'football', name: 'Football', squad: 20, lineup: 11, positions: ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD'], draws: true, score: 1.4, spread: 1.2, venues: ['svc.parks.soccer', 'svc.parks.stadium'] },
  { id: 'american', name: 'American football', squad: 26, lineup: 11, positions: ['QB', 'RB', 'WR', 'WR', 'TE', 'OL', 'OL', 'DL', 'LB', 'CB', 'S'], draws: false, score: 22, spread: 9, venues: ['svc.parks.gridiron', 'svc.parks.stadium'] },
  { id: 'basketball', name: 'Basketball', squad: 13, lineup: 5, positions: ['PG', 'SG', 'SF', 'PF', 'C'], draws: false, score: 104, spread: 11, venues: ['svc.parks.arena', 'svc.parks.hall'] },
  { id: 'hockey', name: 'Ice hockey', squad: 22, lineup: 6, positions: ['G', 'D', 'D', 'LW', 'C', 'RW'], draws: false, score: 3, spread: 1.6, venues: ['svc.parks.arena'] },
  { id: 'baseball', name: 'Baseball', squad: 24, lineup: 9, positions: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'], draws: false, score: 4.5, spread: 2.6, venues: ['svc.parks.stadium'] },
  { id: 'rugby', name: 'Rugby', squad: 26, lineup: 15, positions: ['PR', 'HK', 'PR', 'LK', 'LK', 'FL', 'FL', 'N8', 'SH', 'FH', 'WG', 'CE', 'CE', 'WG', 'FB'], draws: true, score: 21, spread: 8, venues: ['svc.parks.stadium', 'svc.parks.soccer'] },
];

export function sportById(id: string): SportDef | undefined { return SPORTS.find((s) => s.id === id); }

/** Seats, by venue: what a home game can sell at most. */
export const VENUE_SEATS: Record<string, number> = {
  'svc.parks.stadium': 32000, 'svc.parks.soccer': 41000, 'svc.parks.gridiron': 60000,
  'svc.parks.arena': 17000, 'svc.parks.hall': 4500,
};

export interface Player {
  name: string;
  pos: string;
  number: number;
  age: number;
  /** 40 to 99. */
  rating: number;
  /** Per game day the squad is paid for. */
  wage: number;
  /** Goals, points or runs this season. */
  scored: number;
  played: number;
}

export interface Rival { name: string; strength: number; w: number; d: number; l: number; pf: number; pa: number }

export interface Game {
  day: number;
  opponent: string;
  home: boolean;
  us: number;
  them: number;
  crowd: number;
  gate: number;
  /** Who scored most for us, if anyone. */
  star: string;
}

export interface Team {
  name: string;
  sport: string;
  colour: string;
  founded: number;
  season: number;
  roster: Player[];
  /** This season's league record. */
  w: number; d: number; l: number; pf: number; pa: number;
  /** All-time. */
  titles: number;
  bestFinish: number;
  /** 0 to 1: how much of the city follows the team. */
  support: number;
  ticket: number;
  games: Game[];
  rivals: Rival[];
  /** Round within the season and the day of the next game. */
  round: number;
  next: number;
  /** Venue asset the team plays at. */
  venue: string;
  /** Scouted players the club could sign. */
  market: Player[];
  /** Past seasons, newest first. */
  history: Array<{ season: number; finish: number; w: number; d: number; l: number }>;
}

/** Game days between fixtures. */
const EVERY = 2;
/** Clubs in the league, including ours. */
const LEAGUE = 8;
/** What founding a club costs. */
export const FOUNDING_COST = 250000;
/** Signing fee per rating point over 50. */
const FEE_PER_POINT = 2600;

const FIRST = ['Alex', 'Sam', 'Jordan', 'Chris', 'Mika', 'Luca', 'Theo', 'Ravi', 'Kai', 'Noah', 'Eli', 'Omar', 'Jonas', 'Mateo', 'Ivan', 'Dario', 'Felix', 'Hugo', 'Leo', 'Marco', 'Nico', 'Oscar', 'Pavel', 'Quinn', 'Rafa', 'Sven', 'Tomas', 'Yusuf', 'Zane', 'Aaron', 'Ben', 'Callum', 'Dev', 'Emil', 'Finn', 'Gabe', 'Harry', 'Isaac', 'Jack', 'Kofi'];
const LAST = ['Adler', 'Barros', 'Chen', 'Dubois', 'Eriksen', 'Fischer', 'Garcia', 'Hart', 'Ivanov', 'Jensen', 'Kowalski', 'Lindqvist', 'Moreau', 'Novak', 'Okafor', 'Petrov', 'Quint', 'Rossi', 'Silva', 'Tanaka', 'Umar', 'Vance', 'Weber', 'Xu', 'Young', 'Zeller', 'Brooks', 'Castell', 'Doyle', 'Ferreira', 'Grant', 'Hale', 'Ito', 'Keane', 'Lopez', 'Marsh', 'Nash', 'Otto', 'Price', 'Reyes'];
const TOWNS = ['Harrow Bay', 'Kestrel Falls', 'Norwick', 'Oldbridge', 'Port Linden', 'Redmoor', 'Saltmere', 'Thornby', 'Westvale', 'Ashford', 'Brackwater', 'Coldharbour'];
const NICKS = ['United', 'City', 'Rovers', 'Athletic', 'Wanderers', 'Kings', 'Hawks', 'Falcons', 'Titans', 'Rangers', 'Mariners', 'Comets'];

/** A small deterministic generator, so a save replays the same league. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

export class Sports {
  team: Team | null = null;
  private rand = rng(0x5eab);

  /**
   * Why a club cannot be founded, or null if it can. `venues` is the ids of
   * the sports venues the city has built.
   */
  refuse(sport: string, venues: string[], budget: Budget): string | null {
    if (this.team !== null) return 'the city already has a team';
    const def = sportById(sport);
    if (def === undefined) return 'pick a sport';
    if (venues.length === 0) return 'build a stadium or an arena first';
    if (!def.venues.some((v) => venues.includes(v))) {
      return `${def.name.toLowerCase()} needs a ${def.venues.map(venueName).join(' or ')}`;
    }
    if (!budget.affords(FOUNDING_COST)) return `founding a club costs ${Math.round(FOUNDING_COST / 1000)}k`;
    return null;
  }

  /** Founds the club: a squad, a league and a fixture list. */
  found(name: string, sport: string, colour: string, venues: string[], day: number,
    budget: Budget, news: Newsroom): string | null {
    const why = this.refuse(sport, venues, budget);
    if (why !== null) return why;
    const def = sportById(sport)!;
    budget.spend(FOUNDING_COST);
    this.rand = rng(Math.floor(day * 977) + name.length * 131 + 7);
    const venue = def.venues.find((v) => venues.includes(v))!;
    const roster: Player[] = [];
    const used = new Set<number>();
    for (let i = 0; i < def.squad; i++) roster.push(this.player(def, def.positions[i % def.positions.length], 52, 14, used));
    const rivals: Rival[] = [];
    const towns = [...TOWNS].sort(() => this.rand() - 0.5);
    for (let i = 0; i < LEAGUE - 1; i++) {
      rivals.push({ name: `${towns[i]} ${NICKS[Math.floor(this.rand() * NICKS.length)]}`, strength: 50 + this.rand() * 20, w: 0, d: 0, l: 0, pf: 0, pa: 0 });
    }
    this.team = {
      name: name.trim() || 'City', sport, colour, founded: day, season: 1, roster,
      w: 0, d: 0, l: 0, pf: 0, pa: 0, titles: 0, bestFinish: 0, support: 0.08, ticket: 18,
      games: [], rivals, round: 0, next: Math.floor(day) + 1, venue, market: [], history: [],
    };
    this.scout();
    news.print(day, 'people', 'good', `${this.team.name} founded`,
      `The city has a ${def.name.toLowerCase()} club. ${roster.length} players signed; the first game is tomorrow.`);
    return null;
  }

  private player(def: SportDef, pos: string, base: number, spread: number, used: Set<number>): Player {
    let number = 1 + Math.floor(this.rand() * 98);
    while (used.has(number)) number = number % 99 + 1;
    used.add(number);
    const rating = Math.round(Math.max(40, Math.min(92, base + (this.rand() - 0.5) * 2 * spread)));
    return {
      name: `${FIRST[Math.floor(this.rand() * FIRST.length)]} ${LAST[Math.floor(this.rand() * LAST.length)]}`,
      pos, number, age: 19 + Math.floor(this.rand() * 14), rating,
      wage: Math.round(80 + (rating - 40) ** 2 * 2.2), scored: 0, played: 0,
    };
    void def;
  }

  /** Refreshes the players the club could sign. */
  scout(): void {
    const t = this.team;
    if (t === null) return;
    const def = sportById(t.sport)!;
    const used = new Set(t.roster.map((p) => p.number));
    t.market = [];
    for (let i = 0; i < 6; i++) {
      t.market.push(this.player(def, def.positions[Math.floor(this.rand() * def.positions.length)], 58 + t.season * 1.5, 16, used));
    }
  }

  /**
   * What the club's form does to the city's mood, in the same points the
   * council and events use: a winning run lifts the whole town a little, a
   * losing one takes the shine off, a title lingers.
   */
  mood(): number {
    const t = this.team;
    if (t === null) return 0;
    const last = t.games.slice(0, 5);
    if (last.length === 0) return 0;
    const won = last.filter((g) => g.us > g.them).length, lost = last.filter((g) => g.us < g.them).length;
    return (won - lost) * 0.5 * (0.5 + t.support) + Math.min(2, t.titles) * 0.5;
  }

  /** What signing a player costs up front. */
  fee(p: Player): number { return Math.max(0, p.rating - 50) * FEE_PER_POINT; }

  sign(index: number, budget: Budget): string | null {
    const t = this.team;
    if (t === null) return 'no team';
    const p = t.market[index];
    if (p === undefined) return 'that player has gone elsewhere';
    const def = sportById(t.sport)!;
    if (t.roster.length >= def.squad + 6) return 'the squad is full: release somebody first';
    if (!budget.spend(this.fee(p))) return 'the club cannot afford the fee';
    t.roster.push(p);
    t.market.splice(index, 1);
    return null;
  }

  release(index: number): string | null {
    const t = this.team;
    if (t === null) return 'no team';
    const def = sportById(t.sport)!;
    if (t.roster.length <= def.lineup) return `a ${def.name.toLowerCase()} side needs at least ${def.lineup}`;
    t.roster.splice(index, 1);
    return null;
  }

  setTicket(price: number): void {
    if (this.team !== null) this.team.ticket = Math.max(5, Math.min(120, Math.round(price)));
  }

  /** The strength of the side that takes the field: its best players. */
  strength(): number {
    const t = this.team;
    if (t === null) return 0;
    const def = sportById(t.sport)!;
    const best = t.roster.map((p) => p.rating).sort((a, b) => b - a).slice(0, def.lineup);
    return best.reduce((a, b) => a + b, 0) / Math.max(1, best.length);
  }

  /** The wage bill per fixture. */
  wages(): number {
    return this.team === null ? 0 : this.team.roster.reduce((a, p) => a + p.wage, 0);
  }

  /** The league table, ours included, best first. */
  table(): Array<{ name: string; us: boolean; w: number; d: number; l: number; pf: number; pa: number; pts: number }> {
    const t = this.team;
    if (t === null) return [];
    const row = (name: string, us: boolean, r: { w: number; d: number; l: number; pf: number; pa: number }) =>
      ({ name, us, w: r.w, d: r.d, l: r.l, pf: r.pf, pa: r.pa, pts: r.w * 3 + r.d });
    return [row(t.name, true, t), ...t.rivals.map((r) => row(r.name, false, r))]
      .sort((a, b) => b.pts - a.pts || (b.pf - b.pa) - (a.pf - a.pa));
  }

  /** Games in a season: everybody home and away. */
  get rounds(): number { return (LEAGUE - 1) * 2; }

  /** Whether today is a home fixture, for the crowds. */
  homeToday(day: number): boolean {
    const t = this.team;
    return t !== null && Math.floor(day) === t.next && t.round % 2 === 0;
  }

  /**
   * Plays any fixture that is due. `population` sets the catchment; `training`
   * is whether the city has a training ground. Returns the game if one was played.
   */
  update(day: number, population: number, training: boolean, budget: Budget, news: Newsroom): Game | null {
    const t = this.team;
    if (t === null || day < t.next) return null;
    const def = sportById(t.sport)!;
    const opp = t.rivals[t.round % t.rivals.length];
    const home = t.round % 2 === 0;
    const ours = this.strength() + (home ? 3 : 0);
    const edge = (ours - opp.strength) / 10;
    const score = (bias: number): number => Math.max(0, Math.round(def.score * (1 + bias * 0.25) + (this.rand() - 0.5) * 2 * def.spread));
    let us = score(edge), them = score(-edge);
    if (!def.draws && us === them) { if (this.rand() < 1 / (1 + Math.exp(-edge))) us++; else them++; }

    // Results.
    if (us > them) { t.w++; opp.l++; } else if (us < them) { t.l++; opp.w++; } else { t.d++; opp.d++; }
    t.pf += us; t.pa += them; opp.pf += them; opp.pa += us;
    // The rest of the league plays too, so the table moves.
    for (let i = 0; i < t.rivals.length; i += 2) {
      const a = t.rivals[i], b = t.rivals[(i + 1 + t.round) % t.rivals.length];
      if (a === b || a === opp || b === opp) continue;
      const e = (a.strength - b.strength) / 10;
      const sa = score(e), sb = score(-e);
      a.pf += sa; a.pa += sb; b.pf += sb; b.pa += sa;
      if (sa > sb || (!def.draws && sa === sb && this.rand() < 0.5)) { a.w++; b.l++; } else if (sb > sa || !def.draws) { b.w++; a.l++; } else { a.d++; b.d++; }
    }

    // Who scored: spread across the side, weighted by rating and attack.
    let star = '';
    if (us > 0) {
      const side = t.roster.slice().sort((a, b) => b.rating - a.rating).slice(0, def.lineup);
      for (const p of side) p.played++;
      const tally = new Map<Player, number>();
      const shares = Math.min(us, 40);
      for (let k = 0; k < shares; k++) {
        const p = side[Math.floor(this.rand() * this.rand() * side.length)];
        tally.set(p, (tally.get(p) ?? 0) + 1);
      }
      const per = us / shares;
      let top = 0;
      for (const [p, n] of tally) { p.scored += Math.round(n * per); if (n > top) { top = n; star = p.name; } }
    }

    // The gate and the wages.
    const form = t.games.slice(0, 5).filter((g) => g.us > g.them).length / 5;
    t.support = Math.max(0.03, Math.min(0.6, t.support + (us > them ? 0.012 : us < them ? -0.008 : 0.002) + (training ? 0.002 : 0)));
    const seats = VENUE_SEATS[t.venue] ?? 20000;
    const priceFactor = Math.max(0.2, Math.min(1.4, 30 / (t.ticket + 12)));
    const want = population * t.support * (0.5 + form) * priceFactor + 800;
    const crowd = home ? Math.round(Math.min(seats, want)) : 0;
    const gate = Math.round(crowd * t.ticket);
    const broadcast = Math.round(4000 + t.support * 60000);
    budget.credit(gate + broadcast);
    budget.charge(this.wages());

    // Players grow, and the best of them grow faster with a training ground.
    for (const p of t.roster) {
      const grow = p.age < 25 ? 0.18 : p.age < 30 ? 0.05 : -0.12;
      p.rating = Math.max(40, Math.min(99, p.rating + grow + (training ? 0.08 : 0) + (this.rand() - 0.5) * 0.1));
    }

    const game: Game = { day: Math.floor(day), opponent: opp.name, home, us, them, crowd, gate, star };
    t.games.unshift(game);
    if (t.games.length > 20) t.games.length = 20;
    t.round++;
    t.next = Math.floor(day) + EVERY;
    const word = us > them ? 'beat' : us < them ? 'lost to' : 'drew with';
    news.print(day, 'people', us > them ? 'good' : us < them ? 'bad' : 'flat',
      `${t.name} ${us}–${them} ${opp.name}`,
      `${t.name} ${word} ${opp.name} ${home ? `at home in front of ${crowd.toLocaleString()}` : 'away'}${star !== '' ? `; ${star} the pick of the side` : ''}.`);

    if (t.round >= this.rounds) this.endSeason(day, budget, news);
    return game;
  }

  private endSeason(day: number, budget: Budget, news: Newsroom): void {
    const t = this.team!;
    const finish = this.table().findIndex((r) => r.us) + 1;
    t.history.unshift({ season: t.season, finish, w: t.w, d: t.d, l: t.l });
    if (t.history.length > 20) t.history.length = 20;
    if (t.bestFinish === 0 || finish < t.bestFinish) t.bestFinish = finish;
    if (finish === 1) {
      t.titles++;
      t.support = Math.min(0.6, t.support + 0.08);
      budget.credit(400000);
      news.print(day, 'people', 'good', `${t.name} are champions`,
        `Season ${t.season} ends with the title: ${t.w} wins. The prize money comes to the city, and so do the crowds.`);
    } else {
      news.print(day, 'people', finish <= 3 ? 'good' : 'flat', `${t.name} finish ${ordinal(finish)}`,
        `Season ${t.season} is over: ${t.w} won, ${t.d} drawn, ${t.l} lost.`);
    }
    // A new season: records cleared, rivals change, the squad ages a year.
    t.season++;
    t.round = 0;
    t.w = t.d = t.l = t.pf = t.pa = 0;
    for (const r of t.rivals) { r.w = r.d = r.l = r.pf = r.pa = 0; r.strength = Math.max(45, Math.min(88, r.strength + (this.rand() - 0.45) * 6)); }
    for (const p of t.roster) { p.age++; p.scored = 0; p.played = 0; }
    this.scout();
  }

  saved(): unknown { return this.team; }

  restore(raw: unknown): void {
    this.team = null;
    if (raw === null || typeof raw !== 'object') return;
    const o = raw as Team;
    if (typeof o.name !== 'string' || sportById(o.sport) === undefined || !Array.isArray(o.roster)) return;
    this.team = { ...o, market: Array.isArray(o.market) ? o.market : [], history: Array.isArray(o.history) ? o.history : [], games: Array.isArray(o.games) ? o.games : [] };
    this.rand = rng(Math.floor(o.next * 131) + o.round);
  }
}

export function venueName(id: string): string {
  return ({ 'svc.parks.stadium': 'stadium', 'svc.parks.soccer': 'soccer stadium', 'svc.parks.gridiron': 'football stadium', 'svc.parks.arena': 'ice arena', 'svc.parks.hall': 'sports hall' } as Record<string, string>)[id] ?? 'venue';
}

export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${s}`;
}

/** Every venue a team could play at. */
export const TEAM_VENUES = Object.keys(VENUE_SEATS);
