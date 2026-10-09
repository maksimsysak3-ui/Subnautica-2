export type Pos = 'QB' | 'RB' | 'FB' | 'WR' | 'TE' | 'OT' | 'G' | 'C' | 'EDGE' | 'DT' | 'LB' | 'CB' | 'S' | 'K' | 'P' | 'LS';
export type Dev = 'Normal' | 'Star' | 'Superstar' | 'X-Factor';
export type Status = 'ACT' | 'PS' | 'IR' | 'FA' | 'RET' | 'PROSPECT';

/** Madden-style rating keys. */
export type Attr =
  | 'SPD' | 'ACC' | 'AGI' | 'STR' | 'JMP' | 'STA' | 'INJ' | 'TGH' | 'AWR'
  | 'CAR' | 'BCV' | 'BTK' | 'TRK' | 'ELU'
  | 'CTH' | 'CIT' | 'SPC' | 'RTE' | 'RLS'
  | 'THP' | 'SAC' | 'MAC' | 'DAC' | 'TUP' | 'TOR'
  | 'PBK' | 'RBK' | 'IBL'
  | 'TAK' | 'HIT' | 'PUR' | 'PRC' | 'BSH' | 'PMV' | 'FMV' | 'MCV' | 'ZCV' | 'PRS'
  | 'KPW' | 'KAC' | 'RET';
export type Attrs = Record<Attr, number>;

/** `v` marks a void year: proration only, the player is not under contract. */
export interface ContractYear { s: number; base: number; bonus: number; gtd: number; v?: boolean }
export interface Contract {
  years: ContractYear[];
  rookie?: boolean;
  tag?: boolean;
  /** Fifth-year option still open (first-round rookie deals). */
  option?: boolean;
}

export interface StatLine {
  gp: number; gs: number;
  pa: number; pc: number; py: number; ptd: number; pint: number; sk: number; sky: number; plng: number;
  ra: number; ry: number; rtd: number; rlng: number; fum: number; fuml: number;
  tgt: number; rec: number; recy: number; rectd: number; reclng: number; drop: number;
  tkl: number; tfl: number; dsk: number; qbh: number; dint: number; pd: number; ff: number; fr: number; dtd: number;
  fgm: number; fga: number; fglng: number; xpm: number; xpa: number;
  pun: number; puny: number; kr: number; kry: number; pr: number; pry: number; rettd: number;
  pancake: number; sacka: number;
}

export interface Injury { type: string; weeks: number; season?: boolean }

export type Motivation = 'Highest Offer' | 'Contender' | 'Scheme Fit' | 'Starting Role' | 'Big Market' | 'Warm Weather' | 'Loyalty' | 'Winning Culture';

export interface Player {
  id: string;
  fn: string; ln: string;
  pos: Pos;
  team: string; // team abbr or 'FA'
  status: Status;
  num: number;
  age: number;
  born: number; // season of birth year approx (for aging)
  ht: number; wt: number;
  col: string;
  exp: number;
  hs?: string;
  draft: { year: number; round: number; pick: number; team: string };
  attrs: Attrs;
  ovr: number;
  pot: number;
  dev: Dev;
  arch: string;
  abil: string[];
  xf?: string;
  contract: Contract;
  stats: Record<number, StatLine>;
  post: Record<number, StatLine>;
  injury?: Injury;
  cond: number; // wear & tear 0..100
  morale: number;
  xp: number;
  traits: { work: number; cons: number; clutch: number; ego: number; prone: number };
  motiv: Motivation[];
  awards: string[];
  face: number;
  /** Scouting for prospects: 0 hidden .. 3 fully known (user team only). */
  scout?: number;
  combine?: { forty: number; bench: number; vert: number; broad: number; cone: number; shuttle: number };
  proj?: number; // consensus big-board rank
  hof?: boolean;
  /** College logo URL (real prospects). */
  colLogo?: string;
  /** Hidden season form: breakout (+) or dud (-) year, in rating points. */
  sform?: number;
  /** Archetype skill tree (user's players). */
  tree?: { arch: string; sp: number; owned: string[]; earned: string[] };
  trend?: number;
  retiredSeason?: number;
}

/** A user-drawn play: routes per skill player in yards (x downfield, y across), one primary read. */
export interface CustomPlay { name: string; type: 'pass' | 'run'; routes: { who: 'X' | 'Z' | 'S' | 'TE' | 'RB' | 'QB'; pts: [number, number][]; primary?: boolean; block?: boolean }[] }

export interface Pick { id: string; season: number; round: number; orig: string; owner: string; no?: number }

export interface Coach {
  name: string;
  off: OffScheme; def: DefScheme;
  aggr: number; // 0..1 fourth-down / two-point aggressiveness
  rating: number; // 0..99
  age: number;
}
export type OffScheme = 'West Coast' | 'Vertical' | 'Wide Zone' | 'Power Run' | 'Spread';
export type DefScheme = '4-3 Over' | '3-4 Two-Gap' | 'Cover 3' | 'Two-High' | 'Blitz';

export interface Team {
  abbr: string; name: string; nick: string; conf: 'AFC' | 'NFC'; div: string;
  colors: string[]; logo: string; logoAlt: string; wordmark: string;
  stadium: string; roof: string; surface: string;
  coach: Coach;
  depth: Partial<Record<Pos, string[]>>;
  dead: Record<number, number>;
  rollover: number;
  mode: 'contend' | 'balanced' | 'rebuild';
  plan: GamePlan;
  market: number; // 1 small .. 3 big
  warm: boolean;
  tradition: number; // 0..1
}

export interface GamePlan {
  off: 'Balanced' | 'Run Heavy' | 'Pass Heavy' | 'Vertical' | 'Ball Control';
  def: 'Balanced' | 'Stop the Run' | 'Stop the Pass' | 'Blitz Heavy' | 'Prevent';
  practice: 'Light' | 'Normal' | 'Intense';
}

export interface GameResult {
  hs: number; as: number; ot: boolean;
  box?: BoxScore;
  /** The user's games keep their top plays for the highlight reel. */
  hl?: import('../sim/game').PlayEvent[];
}
export interface BoxScore {
  teams: [TeamBox, TeamBox]; // [away, home]
  quarters: [number[], number[]];
  scoring: { q: number; clock: number; team: string; text: string }[];
  players: Record<string, Partial<StatLine>>;
  pog?: string;
}
export interface TeamBox { yds: number; pyds: number; ryds: number; fd: number; to: number; pen: number; peny: number; top: number; plays: number; third: [number, number]; sacks: number }

export interface Game {
  id: string;
  season: number; week: number; // playoffs: 19 WC, 20 DIV, 21 CONF, 22 SB
  away: string; home: string;
  day?: string; time?: string; neutral?: string;
  result?: GameResult;
}

export type Phase = 'preseason' | 'regular' | 'playoffs' | 'resign' | 'freeagency' | 'draft' | 'camp';

export interface NewsItem { id: number; season: number; week: number; kind: 'trade' | 'sign' | 'injury' | 'game' | 'award' | 'draft' | 'release' | 'milestone' | 'league' | 'coach'; text: string; teams: string[]; pid?: string; big?: boolean }
export interface InboxItem { id: number; season: number; week: number; from: string; subject: string; body: string; read: boolean; action?: { kind: 'trade'; offer: TradeOffer } }

export interface TradeOffer { from: string; to: string; give: { players: string[]; picks: string[] }; get: { players: string[]; picks: string[] } }

export interface SeasonAwards { season: number; mvp?: string; opoy?: string; dpoy?: string; oroy?: string; droy?: string; coy?: string; allPro: string[]; champion?: string; runnerUp?: string; sbMvp?: string }

export interface FaState { day: number; offers: Record<string, { team: string; apy: number; years: number; gtd: number; bonus?: number; voids?: number; day: number }[]> }

export interface CoachTree { points: number; xp: number; level: number; unlocked: string[] }

export interface League {
  version: number;
  id: string;
  name: string;
  season: number;
  week: number;
  phase: Phase;
  user: string;
  gm: string;
  teams: Record<string, Team>;
  players: Record<string, Player>;
  games: Game[];
  picks: Pick[];
  news: NewsItem[];
  inbox: InboxItem[];
  awards: SeasonAwards[];
  history: { season: number; standings: Record<string, [number, number, number]> }[];
  cap: Record<number, number>;
  fa?: FaState;
  /** Contract talks in progress, by player id (see negotiate.ts). */
  talks?: Record<string, import('./negotiate').Talk>;
  draft?: { order: string[]; cursor: number; done: boolean };
  seed: number;
  counter: number;
  coachTree: CoachTree;
  scoutPoints: number;
  security: number; // owner job security 0..100
  fired?: boolean;
  records: Record<string, { v: number; pid: string; season: number }>;
  difficulty: 'Rookie' | 'Pro' | 'All-Madden';
  /** Injury frequency slider (default Normal). */
  injuryLevel?: 'Low' | 'Normal' | 'Realistic';
  tradeDeadlineWeek: number;
  /** Mean OVR of each position's starters at league creation; the scale is held to it. */
  baseline?: Partial<Record<Pos, number[]>>;
  /** Players the user has put on the trade block. */
  block?: string[];
  /** Plays the user drew in the play designer. */
  customPlays?: CustomPlay[];
}
