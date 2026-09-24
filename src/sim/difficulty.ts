/**
 * How hard the city is to run, chosen once when it is founded.
 *
 * Every lever here is one the game already has -- the starting treasury, the
 * founding grant, what things cost to build and to run, what taxes bring in,
 * how long a young town is spared everything but its utilities, and how fast
 * the career climbs. A difficulty is those numbers moved together, which is
 * why each card on the setup screen can list exactly what it changes.
 *
 * `RULES` is the one in force. It is module state, like the sim config, set
 * when a city is founded or loaded and read by the systems that need it; the
 * city carries its id in the save so a hard city stays hard.
 */

export type DifficultyId = 'relaxed' | 'standard' | 'hard';

export interface Rules {
  id: DifficultyId;
  label: string;
  tagline: string;
  blurb: string;
  /** Starting treasury. */
  funds: number;
  /** The founding grant: weekly at founding, tapering to nothing at `grantUntil` residents. */
  grantWeekly: number;
  grantUntil: number;
  /** Multipliers on construction prices, service upkeep and tax income. */
  build: number;
  upkeep: number;
  income: number;
  /** Residents below which only power, water and sewage are complained about. */
  quiet: number;
  /** Multiplier on experience earned. */
  xp: number;
}

export const DIFFICULTIES: readonly Rules[] = [
  {
    id: 'relaxed', label: 'Relaxed', tagline: 'Build first, balance later',
    blurb: 'A generous treasury, cheaper building and a founding grant that lasts. '
      + 'For players who want to shape a city without watching the books.',
    funds: 600000, grantWeekly: 18000, grantUntil: 4000,
    build: 0.8, upkeep: 0.8, income: 1.1, quiet: 4000, xp: 1.3,
  },
  {
    id: 'standard', label: 'Standard', tagline: 'The city as it was designed',
    blurb: 'Enough to found a town and make its first real decisions. Taxes, '
      + 'services and growth have to be kept in step.',
    funds: 300000, grantWeekly: 10000, grantUntil: 1800,
    build: 1, upkeep: 1, income: 1, quiet: 2000, xp: 1,
  },
  {
    id: 'hard', label: 'Hard', tagline: 'Every coin is spoken for',
    blurb: 'A thin treasury, dear construction, a short grant and residents who '
      + 'complain early. For players who like the budget to fight back.',
    funds: 180000, grantWeekly: 4000, grantUntil: 900,
    build: 1.2, upkeep: 1.2, income: 0.9, quiet: 1000, xp: 0.85,
  },
];

const byId = (id: string): Rules =>
  DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];

/** The rules in force. Standard until a city says otherwise. */
export const RULES: Rules = { ...byId('standard') };

/** Puts a difficulty in force. Unknown ids fall back to standard. */
export function useDifficulty(id: string): Rules {
  Object.assign(RULES, byId(id));
  return RULES;
}

/** What a difficulty changes, as the lines its card lists. */
export function describe(r: Rules): string[] {
  const pct = (m: number, what: string): string =>
    m === 1 ? `Standard ${what}` : `${m < 1 ? '' : '+'}${Math.round((m - 1) * 100)}% ${what}`;
  const money = (n: number): string => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`);
  return [
    `Starting treasury ${money(r.funds)}`,
    `Founding grant ${money(r.grantWeekly)}/wk, until ${r.grantUntil.toLocaleString()} residents`,
    pct(r.build, 'construction costs'),
    pct(r.upkeep, 'service upkeep'),
    pct(r.income, 'tax income'),
    `Only utility complaints until ${r.quiet.toLocaleString()} residents`,
    r.xp === 1 ? 'Standard progression' : `${r.xp > 1 ? 'Faster' : 'Slower'} progression (${Math.round(r.xp * 100)}% xp)`,
  ];
}
