// Team playbooks. No two staffs install the same offense or speak the same language: every team
// gets its own starting book (which concepts it carries, weighted by its scheme) and its own
// terminology (what it calls its formations and plays). Under the names, the concepts are the
// shared library, so the sim, the play art and the field all work off the same definitions.
import type { OffCall } from '../sim/game';
import type { Team } from '../core/types';
import type { OffScheme } from '../core/types';
import { OFF_LIB, OFF_SETS, DEF_LIB, type LibOff, type LibDef } from './plays';
import { PLAY_ART, PLAY_ALIGN, DEF_ART } from './playart';
import { simHooks } from '../sim/game';

export interface TeamPlay extends LibOff { /** The library concept underneath the team's name for it. */ base: string }
export interface TeamIdentity { key: string; scheme: OffScheme; lingo: Lingo; label: string }
type Lingo = 'numbers' | 'words' | 'codes' | 'tags';

const hash = (s: string) => { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return x >>> 0; };
function rng(seed: number) { let a = seed || 1; return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return ((a >>> 0) % 100000) / 100000; }; }
const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];

// What each staff calls each formation.
const SET_NAMES: Record<string, string[]> = {
  Shotgun: ['Trey', 'Trips', 'Rex', 'Trio', 'Tiger', 'Trojan', 'Spread', 'Tank'],
  'Gun Doubles': ['Deuce', 'Twins', 'Doubles', 'Dbl', 'Box', 'Spread Even'],
  Singleback: ['Ace', 'Heavy', 'Kong', 'Ugly', 'Jumbo Ace', 'Tiger Ace'],
  'I-Form': ['Pro', 'Ice', 'Brown', 'Red', 'Power I', 'Tight I'],
  Pistol: ['Pistol', 'Pony', 'Dart', 'Colt', 'Gun Pony'],
  Empty: ['Empty', 'Zero', 'Ghost', 'Spread 5', 'Nada'],
  'Gun Bunch': ['Bunch', 'Stack', 'Cluster', 'Tight Trips', 'Knot'],
  'Pistol Wing': ['Wing', 'Flex', 'Wing Pony', 'Tiger Wing', 'Hip'],
  'Goal Line': ['Jumbo', 'Bear', 'Hippo', 'Goal', 'Heavy Jumbo'],
};
// Real-world-style aliases for each concept; a staff picks one.
const ALIASES: Record<string, string[]> = {
  'Inside Zone': ['Tex', 'Zone', 'Ice', 'Inside', 'Zorro'], 'Outside Zone': ['Stretch', 'Wide', 'Reach', 'Mustang', 'Zeke'],
  'QB Keep': ['Q Power', 'Keep', 'Q Lead', 'Rocket Q'], 'Quick Slants': ['Slant', 'Rattler', 'Arrowhead', 'Snake'], 'Curl Flat': ['Curl', 'Hook', 'Curl Out', 'Hitch Flat'],
  Dig: ['Square', 'Dig', 'Bench In', 'Drag Dig'], 'Four Verticals': ['All Go', 'Verts', 'Seattle', 'Streak'], Screen: ['Slip', 'Swing Screen', 'Jailbreak', 'Middle Screen'],
  Mesh: ['Mesh', 'Rub', 'Shallow Cross', 'Drive Mesh'], Smash: ['Smash', 'China', 'Hi-Lo', 'Corner Hitch'], Stick: ['Stick', 'Nod', 'Y Stick', 'Sticks'],
  'Corner Post': ['Sluggo', 'Corner Post', 'Pivot Post', 'Whip Post'], 'Bubble Screen': ['Bubble', 'Now', 'Rocket', 'Flash'], 'HB Draw': ['Draw', 'Delay', 'Trey Draw', 'Fake'],
  'HB Wheel': ['Wheel', 'Rail', 'Ferris', 'Arrow'], Spacing: ['Spacing', 'Five Hook', 'Space', 'Even'], Levels: ['Levels', 'Ladder', 'Tier', 'Stairs'],
  'Slot Fade': ['Fade', 'Seam Fade', 'Back Shoulder', 'Nine'], Power: ['Power', 'Duo Power', 'Gap', 'Boss'], Counter: ['Counter', 'GT', 'Gut', 'Trey Counter'],
  'Y-Cross': ['Y Cross', 'Over', 'Burst', 'Cross'], 'PA Boot': ['Boot', 'Waggle', 'Naked', 'Keeper'], 'TE Seam': ['Seams', 'Bender', 'Y Seam', 'Pole'],
  Iso: ['Iso', 'Blast', 'Lead', 'Ram'], Toss: ['Toss', 'Pitch', 'Sweep', 'Flip'], 'PA Deep Post': ['Shot Post', 'Max Post', 'Bomb', 'Deep Post'],
  'Read Option': ['Zone Read', 'Read', 'Give Keep', 'Option'], 'Jet Sweep': ['Jet', 'Fly', 'Speed', 'Orbit'], 'RPO Slant': ['Glance', 'Bang', 'Pop', 'RPO'],
  'Empty Mesh': ['Empty Rub', 'Zero Mesh', 'Spread Mesh'], 'Empty Verts': ['Five Go', 'All Streak', 'Vert Five'], 'QB Sneak': ['Sneak', 'Wedge', 'Push'],
  'Goal Line Power': ['Bully', 'Goal Power', 'Hammer'], 'PA Flat': ['Pop Flat', 'Sneak Flat', 'Fake Dive'], Snag: ['Snag', 'Spot', 'Tri', 'Sit'],
  'Y-Option': ['Y Option', 'Choice', 'Y Iso', 'Win'], Drive: ['Drive', 'Under', 'Shallow', 'Tosser'], Sail: ['Sail', 'Rail Sail', 'Bow', 'Three Level'],
  Mills: ['Mills', 'Pin', 'Post Dig', 'Dagger Post'], 'Tunnel Screen': ['Tunnel', 'Funnel', 'Slip In', 'Burn'], 'Shovel Option': ['Shovel', 'Shuffle', 'Flip In'],
  Duo: ['Duo', 'Double', 'Deuce', 'Dart'], Trap: ['Trap', 'Wham', 'Mouse', 'Kick'], Hank: ['Hank', 'Curls', 'Ohio', 'Hooks'],
  'Double Post': ['Double Post', 'Twin Post', 'Bang Bang', 'Poles'], Dagger: ['Dagger', 'Seam Dig', 'Scat', 'Knife'], 'RB Swing': ['Swing', 'Flare', 'Bolt', 'Banana'],
  'Bunch Flood': ['Flood', 'Bunch Sail', 'Spot Flood', 'Wave'], 'Bunch Snag': ['Bunch Snag', 'Triangle', 'Pick'], 'Bunch Screen': ['Wall', 'Bunch Now', 'Picket'],
  'Bunch Verticals': ['Bunch Go', 'Stack Verts', 'Burst Go'], 'Inverted Veer': ['Veer', 'Inverted', 'Power Read', 'Q Veer'], 'Speed Option': ['Speed Op', 'Load', 'Pitch Read', 'Arc'],
  'Bubble RPO': ['Bubble Read', 'Zone Bubble', 'Tag Now'], 'Pin Pull Sweep': ['Pin Pull', 'Crack Toss', 'Pull Sweep', 'Buck'], 'Wing Counter': ['Wing Counter', 'Counter Bash', 'Hip Counter'],
  'Wing Leak': ['Leak', 'Throwback', 'Waggle Leak'], Texas: ['Texas', 'Angle', 'Option Back', 'Tex Angle'], Scissors: ['Scissors', 'Switch', 'X Post', 'Post Corner'],
  Yankee: ['Yankee', 'Max Cross', 'Double Cross', 'Shot Cross'], 'Lead Draw': ['Lead Draw', 'Fullback Draw', 'Iso Draw'],
  'Shallow Cross': ['Shallow', 'Drag', 'X Cross', 'Under Dig'], 'Out and Up': ['Out Up', 'Sluggo Out', 'Hitch Go', 'Double Move'], 'Post Wheel': ['Post Wheel', 'Wheel Post', 'Rail Post', 'Ferris Post'],
  'Curl Seam': ['Curl Seam', 'Hooks Seams', 'Ohio Seam', 'Bend Curl'], 'Flanker Drive': ['Z Drive', 'Flanker Cross', 'Z Under', 'Drive Z'], 'Trips Slant': ['Trips Slant', 'Bunch Glance', 'Point Slant', 'Stack Slant'],
};
// Code-word staffs name plays after things, not concepts.
const CODES = ['Bandit', 'Cobra', 'Laser', 'Moose', 'Pirate', 'Dakota', 'Camaro', 'Raven', 'Tulsa', 'Comet', 'Viper', 'Hondo', 'Maverick', 'Bingo', 'Atlas', 'Rodeo', 'Gator', 'Saber',
  'Neon', 'Ranger', 'Tango', 'Bronco', 'Ozzie', 'Jersey', 'Rocket', 'Tahoe', 'Vegas', 'Dixie', 'Yukon', 'Falcon', 'Mojo', 'Cajun', 'Tundra', 'Blitzen', 'Echo', 'Gunner',
  'Hatchet', 'Juno', 'Kodiak', 'Lasso', 'Mako', 'Nitro', 'Orbit', 'Polar', 'Quake', 'Rebel', 'Sonic', 'Turbo', 'Utah', 'Vandal', 'Wizard', 'Zulu', 'Apache', 'Boston', 'Chevy', 'Denver'];

// How much each scheme likes each formation.
const SET_TASTE: Record<OffScheme, Record<string, number>> = {
  Spread: { Shotgun: 3, 'Gun Doubles': 3, Empty: 2, 'Gun Bunch': 2, Pistol: 2.5, 'Pistol Wing': 0.6, Singleback: 0.5, 'I-Form': 0.2, 'Goal Line': 1 },
  'West Coast': { Shotgun: 2, 'Gun Doubles': 1.5, Singleback: 2.5, 'I-Form': 1.5, 'Gun Bunch': 2, Pistol: 0.8, Empty: 1, 'Pistol Wing': 1, 'Goal Line': 1 },
  'Power Run': { 'I-Form': 3, Singleback: 2.5, 'Pistol Wing': 2.5, 'Goal Line': 1.5, Shotgun: 1, Pistol: 1.2, 'Gun Doubles': 0.6, 'Gun Bunch': 0.6, Empty: 0.2 },
  'Wide Zone': { Singleback: 3, Pistol: 2.5, 'Pistol Wing': 2.5, 'I-Form': 1.8, Shotgun: 1.2, 'Gun Bunch': 1, 'Gun Doubles': 0.8, Empty: 0.4, 'Goal Line': 1 },
  Vertical: { Shotgun: 2.5, 'Gun Doubles': 2.5, Empty: 2, Singleback: 1.5, 'I-Form': 1.2, 'Gun Bunch': 1.5, Pistol: 0.8, 'Pistol Wing': 0.6, 'Goal Line': 1 },
};
type Bucket = 'inside' | 'outside' | 'qb' | 'screen' | 'quick' | 'short' | 'medium' | 'deep';
const bucketOf = (c: OffCall): Bucket => (c.kind === 'run' ? c.run ?? 'inside' : (c.depth ?? 'short')) as Bucket;
// How many of each a scheme carries (about 30 plays, plus goal line).
const QUOTA: Record<OffScheme, Record<Bucket, number>> = {
  Spread: { inside: 4, outside: 3, qb: 3, screen: 4, quick: 4, short: 4, medium: 4, deep: 3 },
  'West Coast': { inside: 4, outside: 3, qb: 1, screen: 3, quick: 5, short: 6, medium: 4, deep: 2 },
  'Power Run': { inside: 6, outside: 4, qb: 1, screen: 2, quick: 3, short: 3, medium: 3, deep: 3 },
  'Wide Zone': { inside: 4, outside: 5, qb: 1, screen: 2, quick: 3, short: 4, medium: 4, deep: 3 },
  Vertical: { inside: 4, outside: 2, qb: 1, screen: 3, quick: 3, short: 3, medium: 5, deep: 6 },
};
const LINGO_LABEL: Record<Lingo, string> = { numbers: 'Numbered system', words: 'Concept words', codes: 'Code words', tags: 'Formation + tag' };

/** A team's offensive identity: its scheme and how its staff talks. */
export function identity(key: string, scheme: OffScheme): TeamIdentity {
  const lingo = (['numbers', 'words', 'codes', 'tags'] as Lingo[])[hash(`${key}:lingo`) % 4];
  return { key, scheme, lingo, label: `${scheme} · ${LINGO_LABEL[lingo]}` };
}

/** The team-specific name of a concept. */
function nameFor(id: TeamIdentity, p: LibOff, r: () => number, usedCodes: Set<string>, dir: string): string {
  const set = pick(r, SET_NAMES[p.set] ?? [p.set]);
  const alias = pick(r, ALIASES[p.name] ?? [p.name]);
  const c = p.call, run = c.kind === 'run';
  switch (id.lingo) {
    case 'numbers': {
      // Runs: back and hole (odd left, even right). Passes: a protection series and the concept.
      const hole = run ? `${c.run === 'qb' ? 1 : 2 + Math.floor(r() * 2)}${c.run === 'outside' ? (dir === 'Rt' ? 8 : 9) : (dir === 'Rt' ? pick(r, [2, 4, 6]) : pick(r, [1, 3, 5]))}` : pick(r, ['50', '60', '70', '90', '96', '200', '300']);
      return `${set} ${dir} ${hole} ${alias}`;
    }
    case 'codes': {
      // A code word for the tag, the concept after it ("Trips Cobra Mesh").
      let code = pick(r, CODES);
      for (let i = 0; usedCodes.has(code) && i < 20; i++) code = pick(r, CODES);
      usedCodes.add(code);
      return `${set} ${code} ${alias}`;
    }
    case 'tags': return `${set} ${dir} ${pick(r, ['X', 'Z', 'Y', 'H', 'F'])} ${alias}`;
    default: return `${set} ${alias}`;
  }
}

const cache = new Map<string, TeamPlay[]>();
/** Every registered team play by its name, so a call can be resolved from any screen. */
export const TEAM_PLAYS = new Map<string, TeamPlay>();

/** A team's starting offensive playbook: its concepts, in its own words. */
export function teamBook(key: string, scheme: OffScheme): TeamPlay[] {
  const ck = `${key}|${scheme}`;
  const hit = cache.get(ck);
  if (hit) return hit;
  const id = identity(key, scheme), r = rng(hash(ck));
  const taste = SET_TASTE[scheme], quota = QUOTA[scheme];
  // Weighted pick within each bucket, favoring the scheme's formations, with a team-specific twist.
  const chosen: LibOff[] = [];
  const pool = OFF_LIB.filter(p => p.set !== 'Goal Line' && !p.extra);
  for (const b of Object.keys(quota) as Bucket[]) {
    let cands = pool.filter(p => bucketOf(p.call) === b).map(p => ({ p, w: (taste[p.set] ?? 1) * (0.35 + r()) }));
    for (let n = 0; n < quota[b] && cands.length; n++) {
      const tot = cands.reduce((s, x) => s + x.w, 0); let t = r() * tot, i = 0;
      while (i < cands.length - 1 && (t -= cands[i].w) > 0) i++;
      chosen.push(cands[i].p); cands = cands.filter((_, j) => j !== i);
    }
  }
  chosen.push(...OFF_LIB.filter(p => p.set === 'Goal Line'));
  const used = new Set<string>();
  const register = (p: LibOff, r: () => number, extra = false) => {
    let name = nameFor(id, p, r, used, r() < 0.5 ? 'Rt' : 'Lt');
    // Names are global (the field draws art by name), so two teams can't share one for different concepts.
    for (let i = 2; TEAM_PLAYS.has(name) && TEAM_PLAYS.get(name)!.base !== p.name; i++) name = `${name.replace(/ \d+$/, '')} ${i}`;
    const tp: TeamPlay = { ...p, name, base: p.name, call: { ...p.call, name }, extra };
    TEAM_PLAYS.set(name, tp);
    if (PLAY_ART[p.name]) PLAY_ART[name] = PLAY_ART[p.name];
    if (PLAY_ART[`PA ${p.name}`]) PLAY_ART[`PA ${name}`] = PLAY_ART[`PA ${p.name}`];
    const al = PLAY_ALIGN[p.name] ?? (p.set !== 'Shotgun' ? OFF_SETS[p.set]?.align : undefined);
    if (al) PLAY_ALIGN[name] = al;
    return tp;
  };
  const book = chosen.map(p => register(p, r));
  // The second install: five more pass concepts from what the book doesn't already carry, picked
  // by scheme taste with their own seed, so the original book (and its names) stays as it was.
  const r2 = rng(hash(`${ck}|install2`));
  const have = new Set(chosen.map(p => p.name));
  let extra = OFF_LIB.filter(p => p.call.kind === 'pass' && p.set !== 'Goal Line' && !have.has(p.name)).map(p => ({ p, w: (taste[p.set] ?? 1) * (0.35 + r2()) * (p.extra ? 1.6 : 1) }));
  for (let n = 0; n < 5 && extra.length; n++) {
    const tot = extra.reduce((s, x) => s + x.w, 0); let t = r2() * tot, i = 0;
    while (i < extra.length - 1 && (t -= extra[i].w) > 0) i++;
    book.push(register(extra[i].p, r2, true));
    extra = extra.filter((_, j) => j !== i);
  }
  cache.set(ck, book);
  return book;
}

/** The AI's call, dressed as a real play from its own book: same kind and depth, the team's concept. */
export function fromBook(key: string, scheme: OffScheme, want: OffCall, r: () => number): OffCall {
  if (want.kind !== 'run' && want.kind !== 'pass') return want;
  const book = teamBook(key, scheme);
  const b = bucketOf(want);
  const opts = book.filter(p => p.set !== 'Goal Line' && bucketOf(p.call) === b);
  if (!opts.length) return want;
  const p = opts[Math.floor(r() * opts.length)];
  const pa = !!want.pa && want.kind === 'pass' && want.depth !== 'screen';
  return { ...p.call, pa: pa || p.call.pa, name: pa && !p.call.pa ? `PA ${p.name}` : p.name };
}

/** The book key and scheme for a team (pro or college). */
export const bookOf = (t: Team) => teamBook(`${t.abbr}:${t.name}`, t.coach.off);
simHooks.teamCall = (t, c, r) => fromBook(`${t.abbr}:${t.name}`, t.coach.off, c, r);

// ---- defense: the same idea, each staff names its fronts and coverages its own way ----------
const FRONT_NAMES: Record<string, string[]> = { Base: ['Over', 'Under', 'Okie', 'Stack', 'Even', 'Tite'], Nickel: ['Nickel', 'Star', 'Raider', 'Nickel Mint', 'Spur'], Dime: ['Dime', 'Dollar', 'Penny', 'Quarter'], 'Goal Line': ['Bear', 'Goal', 'Jumbo D', 'Hammer'] };
const COVER_ALIASES: Record<string, string[]> = {
  'Cover 2': ['Cloud', 'Hard Two', 'Squat', 'Two Sky'], 'Cover 3': ['Buzz', 'Thirds', 'Sky 3', 'Rip 3'], 'Cover 4': ['Quarters', 'Match 4', 'Palms', 'Blue'],
  'Cover 1 Man': ['Robber', 'Rat', 'Man Free', 'Lurk'], 'Cover 1 Blitz': ['Fire Man', 'Will Go', 'Sam Bomb', 'Ed Fire'], 'Cover 0 Blitz': ['Zero', 'All Out', 'Cash Zero', 'Bingo'],
  Prevent: ['Prevent', 'Deep Wall', 'Umbrella'], 'Tampa 2': ['Tampa', 'Mike Pole', 'Deep Hole'], 'Cover 3 Sky': ['Sky', 'Rolldown', 'Sky Buzz'], 'Mike Blitz': ['Mike Plug', 'A Gap Mug', 'Mike Shoot'],
  'Cover 3 Fire Zone': ['Fire Zone', 'Zone Pressure', 'Sting'], 'Cover 6': ['Quarter Half', 'Six', 'Cover Six'], 'Cover 2 Man': ['Two Man', 'Trail Two', 'Man Under'],
  'Dime Cover 4': ['Dime Quarters', 'Dollar Palms', 'Penny Four'], 'Dime Blitz': ['Nickel Edge', 'Dime Fire', 'Corner Cat'], 'Goal Line 0': ['Goal Zero', 'Stuff', 'Wall Zero'], 'Goal Line Zone': ['Goal Squeeze', 'Red Zone', 'Plaster'],
  'Double A Gap': ['Double Mug', 'A Gap Fire', 'Twin Plug'], 'Base Fire Zone': ['Will Fire', 'Edge Sting', 'Fire Three'], 'Zero Pressure': ['Cash Six', 'Zero Max', 'Jailbreak'], Overload: ['Overload', 'Strong Fire', 'Flood Blitz'],
};
export interface TeamDef extends LibDef { base: string }
const dcache = new Map<string, TeamDef[]>();
export const TEAM_DEFS = new Map<string, TeamDef>();
/** A team's defensive call sheet: every library call, named the staff's way. */
export function teamDefBook(t: Team): TeamDef[] {
  const key = `${t.abbr}:${t.name}|${t.coach.def}`;
  const hit = dcache.get(key); if (hit) return hit;
  const r = rng(hash(key));
  const fronts: Record<string, string> = {};
  for (const [k, v] of Object.entries(FRONT_NAMES)) fronts[k] = pick(r, v);
  // Blitz-heavy staffs list pressure first, zone staffs their coverages.
  const order = DEF_LIB.filter(p => !p.extra).sort((a, b) => (t.coach.def === 'Blitz' ? Number(b.call.blitz) - Number(a.call.blitz) : t.coach.def === 'Two-High' || t.coach.def === 'Cover 3' ? Number(a.call.blitz) - Number(b.call.blitz) : 0) || r() - 0.5);
  const r2 = rng(hash(`${key}|install2`));
  const book = [...order.map(p => [p, r] as const), ...DEF_LIB.filter(p => p.extra).map(p => [p, r2] as const)].map(([p, r]) => {
    const name = `${fronts[p.set] ?? p.set} ${pick(r, COVER_ALIASES[p.name] ?? [p.name])}`;
    if (DEF_ART[p.name]) DEF_ART[name] = DEF_ART[p.name];
    const td: TeamDef = { ...p, name, base: p.name, call: { ...p.call, name } };
    TEAM_DEFS.set(name, td);
    return td;
  });
  dcache.set(key, book);
  return book;
}
