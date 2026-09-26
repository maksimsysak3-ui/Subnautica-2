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

/**
 * How many of the game's money units one of the balance's units is.
 *
 * The economy was designed and balanced in small numbers -- a town of six
 * hundred grossing fifty thousand a week -- and the balance between income,
 * upkeep and prices is what matters, not the scale. But a city builder's money
 * is read at the scale the genre set: a treasury of about a million to found a
 * town on, and a million a week in once it is a couple of thousand people. So every figure the player sees and pays
 * is this many times the designed one: income, prices, grants, the treasury.
 */
export const CURRENCY = 8;
/**
 * And upkeep a third heavier again than that, so a grown town's running costs
 * are a real weight against its takings -- about two fifths of them, where
 * they were under a third -- and a service is a decision, not a formality.
 */
export const UPKEEP_WEIGHT = 1.3;
/**
 * And building a good deal cheaper than the designed prices against that
 * income: a city should be limited by what it can run, not by what it can
 * put down. Upkeep is a share of the designed price, not this one -- see
 * costs.ts -- so halving what a clinic costs to buy does not halve what it
 * costs to staff.
 */
export const BUILD_WEIGHT = 0.5;

/** The designed rules, before the currency scale. */
const DESIGNED: readonly Rules[] = [
  {
    id: 'relaxed', label: 'Relaxed', tagline: 'Build first, balance later',
    blurb: 'A generous treasury, cheaper building and a founding grant that lasts. '
      + 'For players who want to shape a city without watching the books.',
    funds: 190000, grantWeekly: 18000, grantUntil: 4000,
    build: 0.8, upkeep: 0.8, income: 1.1, quiet: 4000, xp: 1.3,
  },
  {
    id: 'standard', label: 'Standard', tagline: 'The city as it was designed',
    blurb: 'Enough to found a town and make its first real decisions. Taxes, '
      + 'services and growth have to be kept in step.',
    funds: 125000, grantWeekly: 14000, grantUntil: 2500,
    build: 1, upkeep: 1, income: 1, quiet: 2000, xp: 1,
  },
  {
    id: 'hard', label: 'Hard', tagline: 'Every coin is spoken for',
    blurb: 'A thin treasury, dear construction, a short grant and residents who '
      + 'complain early. For players who like the budget to fight back.',
    funds: 100000, grantWeekly: 9500, grantUntil: 1500,
    build: 1.15, upkeep: 1.15, income: 0.95, quiet: 1000, xp: 0.85,
  },
];

export const DIFFICULTIES: readonly Rules[] = DESIGNED.map((r) => ({
  ...r,
  funds: r.funds * CURRENCY,
  grantWeekly: r.grantWeekly * CURRENCY,
  build: r.build * CURRENCY * BUILD_WEIGHT,
  upkeep: r.upkeep * CURRENCY * UPKEEP_WEIGHT,
  income: r.income * CURRENCY,
}));

const byId = (id: string): Rules =>
  DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];

/*
 * The numbers above were set against tools/long-game.mjs, a bot that plays each
 * difficulty from bare ground. Hard at 180k could not afford the power and
 * water every town needs and still zone a street, so it never had a resident;
 * Standard took two hours of play to reach a thousand. See that tool's output
 * for the current curves.
 */

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
