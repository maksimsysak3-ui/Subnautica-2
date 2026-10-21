import type { KitPattern } from '../data/clubs';

export type Pos = 'GK' | 'RB' | 'LB' | 'CB' | 'CDM' | 'CM' | 'CAM' | 'RM' | 'LM' | 'RW' | 'LW' | 'ST';
export const POSITIONS: Pos[] = ['GK', 'RB', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'RM', 'LM', 'RW', 'LW', 'ST'];

/** Detailed attributes, in this fixed order. */
export const ATTRS = [
  'Acceleration', 'Sprint Speed',
  'Finishing', 'Shot Power', 'Long Shots', 'Positioning', 'Volleys', 'Penalties',
  'Vision', 'Crossing', 'Short Passing', 'Long Passing', 'Curve', 'FK Accuracy',
  'Dribbling', 'Agility', 'Balance', 'Ball Control', 'Composure', 'Reactions',
  'Interceptions', 'Heading Acc.', 'Def. Awareness', 'Stand Tackle', 'Slide Tackle',
  'Jumping', 'Stamina', 'Strength', 'Aggression',
  'GK Diving', 'GK Handling', 'GK Kicking', 'GK Positioning', 'GK Reflexes',
] as const;
export const A = {
  acc: 0, spd: 1, fin: 2, shp: 3, lon: 4, pos: 5, vol: 6, pen: 7,
  vis: 8, cro: 9, spa: 10, lpa: 11, cur: 12, fka: 13,
  dri: 14, agi: 15, bal: 16, bc: 17, com: 18, rea: 19,
  int: 20, hea: 21, def: 22, sta: 23, sli: 24,
  jum: 25, stm: 26, str: 27, agg: 28,
  gkd: 29, gkh: 30, gkk: 31, gkp: 32, gkr: 33,
} as const;
/** Attribute index groups for the six card stats. */
export const GROUPS: Record<'PAC' | 'SHO' | 'PAS' | 'DRI' | 'DEF' | 'PHY', number[]> = {
  PAC: [0, 1], SHO: [2, 3, 4, 5, 6, 7], PAS: [8, 9, 10, 11, 12, 13],
  DRI: [14, 15, 16, 17, 18, 19], DEF: [20, 21, 22, 23, 24], PHY: [25, 26, 27, 28],
};

export interface SeasonStats { apps: number; starts: number; mins: number; goals: number; assists: number; yellows: number; reds: number; cleanSheets: number; ratingSum: number; motm: number; xg: number; shots: number; passes: number; tackles: number; saves: number }
export const emptyStats = (): SeasonStats => ({ apps: 0, starts: 0, mins: 0, goals: 0, assists: 0, yellows: 0, reds: 0, cleanSheets: 0, ratingSum: 0, motm: 0, xg: 0, shots: 0, passes: 0, tackles: 0, saves: 0 });

export interface CareerRow { season: number; club: string; apps: number; goals: number; assists: number; rating: number; ovr: number }

export interface Player {
  id: number;
  name: string;
  nat: string;
  pos: Pos;
  alt: Pos[];
  born: number;
  club: string | null;
  attrs: number[];
  ovr: number;
  pot: number;
  foot: 'R' | 'L';
  wf: number; sm: number;
  height: number;
  num: number;
  wage: number;           // € per week
  contract: number;       // final season of the deal (e.g. 2028 = expires summer 2028)
  release?: number;       // release clause €
  morale: number;         // 0-100
  fitness: number;        // 0-100 match condition
  sharp: number;          // 0-100 match sharpness
  form: number;           // rolling average match rating
  inj?: { name: string; days: number };
  ban: number;            // matches suspended
  yel: number;            // league yellow accumulation
  real: boolean;
  traits: string[];
  role?: 'Key' | 'First' | 'Rotation' | 'Prospect' | 'Backup';
  listed?: boolean;
  loan?: { from: string; until: number };
  scouted?: boolean;
  s: SeasonStats;          // current season, all competitions
  cs: Record<string, [number, number, number]>; // per competition: apps, goals, assists
  career: CareerRow[];
  valueHist: number[];
  retiring?: boolean;
  moved?: number;          // season*1000+day of the last transfer
  youth?: boolean;
  devFocus?: 'PAC' | 'SHO' | 'PAS' | 'DRI' | 'DEF' | 'PHY';
}

export type Mentality = -2 | -1 | 0 | 1 | 2;
export interface Tactic {
  formation: string;
  /** player id per formation slot (11) */
  lineup: number[];
  bench: number[];
  roles: string[];
  mentality: Mentality;
  pressing: number;   // 0..100
  line: number;       // defensive line height 0..100
  width: number;      // 0..100
  tempo: number;      // 0..100
  directness: number; // 0..100 (short to long)
  counter: boolean;
  offside: boolean;
  timeWaste: boolean;
  captain?: number; pens?: number; fks?: number; corners?: number;
}

export interface Club {
  id: string;
  name: string;
  short: string;
  country: string;
  league: string;
  rep: number;
  c1: string; c2: string; a1: string; a2: string; kit: KitPattern; shorts?: string; socks?: string;
  stadium: string; cap: number;
  logo: string;
  budget: number;      // transfer funds €
  wageBudget: number;  // weekly €
  balance: number;     // club bank €
  squad: number[];
  tactic: Tactic;
  youth: number;       // academy quality 1-10
  facilities: number;  // training facilities 1-10
  fans: number;        // supporter happiness 0-100
  form: string[];      // last results W/D/L
  fin: { tv: number; gate: number; prize: number; merch: number; transfersIn: number; transfersOut: number; wages: number };
  tier: 1 | 2 | 0;     // 0 = rest of world, not in a simulated league
  strength?: number;   // abstract strength for clubs without full squads
  trophies: { name: string; season: number }[];
}

export interface MatchEvent { min: number; type: 'goal' | 'pen' | 'og' | 'yellow' | 'red' | 'sub' | 'inj' | 'miss' | 'save' | 'var'; side: 0 | 1; pid: number; pid2?: number; text?: string }
export interface MatchStats { poss: [number, number]; shots: [number, number]; sot: [number, number]; xg: [number, number]; passes: [number, number]; passAcc: [number, number]; corners: [number, number]; fouls: [number, number]; offsides: [number, number]; yellows: [number, number]; reds: [number, number]; tackles: [number, number]; saves: [number, number] }
export interface MatchResult {
  hg: number; ag: number;
  pens?: [number, number];
  et?: boolean;
  events: MatchEvent[];
  stats: MatchStats;
  ratings: Record<number, number>;
  motm: number;
  lineups: [number[], number[]];
  att?: number;
}

export interface Fixture {
  id: number;
  comp: string;        // competition id
  stage: string;       // 'MD 5', 'Round of 16 · Leg 1', 'Final'...
  day: number;         // days since 1 July of the season's start year
  home: string; away: string;
  res?: MatchResult;
  tie?: number;        // knockout tie id
  leg?: 1 | 2;
  neutral?: boolean;
}

export interface Tie { id: number; comp: string; round: string; a: string; b: string; legs: 1 | 2; winner?: string; fx: number[] }

export interface Competition {
  id: string;
  name: string;
  short: string;
  kind: 'league' | 'cup' | 'europe';
  country?: string;
  teams: string[];
  logo?: string;
  color: string;
  ties: Tie[];
  /** europe: current phase */
  phase?: 'league' | 'playoff' | 'r16' | 'qf' | 'sf' | 'final' | 'done';
  winner?: string;
}

export interface NewsItem { id: number; day: number; season: number; kind: 'match' | 'transfer' | 'board' | 'injury' | 'offer' | 'squad' | 'award' | 'info' | 'contract' | 'media'; title: string; body: string; read?: boolean; club?: string; pid?: number; offerId?: number }

export interface Offer {
  id: number;
  pid: number;
  from: string;      // buying club
  to: string;        // selling club
  fee: number;
  loan?: boolean;
  status: 'pending' | 'accepted' | 'rejected' | 'countered' | 'done' | 'withdrawn';
  counter?: number;
  day: number;
  userBuying: boolean;
}

export interface TransferRecord { season: number; day: number; pid: number; name: string; from: string; to: string; fee: number; loan?: boolean; free?: boolean }

export interface World {
  version: number;
  seed: number;
  season: number;           // start year, e.g. 2026 for 2026-27
  day: number;
  user: string;             // club id
  manager: string;
  clubs: Record<string, Club>;
  players: Record<number, Player>;
  nextPid: number;
  comps: Record<string, Competition>;
  fixtures: Fixture[];
  nextFx: number;
  news: NewsItem[];
  nextNews: number;
  offers: Offer[];
  nextOffer: number;
  transfers: TransferRecord[];
  freeAgents: number[];
  board: { confidence: number; objective: string; objectiveRank: number; cupTarget: string; warnings: number };
  history: { season: number; champions: Record<string, string>; cups: Record<string, string>; ballon?: number; userFinish?: number; userComp?: string }[];
  shortlist: number[];
  awards: { season: number; title: string; pid?: number; name?: string; club?: string; value?: string }[];
  training: { focus: string; intensity: number };
  sacked?: boolean;
  lastResultFx?: number;
  settings: { speed: number; sound: boolean; cinematics: boolean; autoSim?: boolean };
}
