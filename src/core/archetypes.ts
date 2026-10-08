// Player archetypes and their skill trees.
//
// Every non-lineman, non-specialist has an archetype that fits how he plays (five or
// more per position). Each archetype has a three-level tree of rating upgrades:
//   Level 1  a short line of small upgrades; finishing it makes him at least a Star
//   Level 2  a longer line of bigger upgrades; finishing it makes him a Superstar
//   Level 3  two branches of large upgrades; finishing both makes him an X-Factor
// Skill points come from the player's own goals: single-game milestones and season
// targets for his position. You choose where they go.
import type { Attrs, Dev, League, Player, Pos, StatLine } from './types';
import { overall, XFACTORS } from './ratings';
import { news } from './season';

type A = keyof Attrs;
export interface Arch { name: string; desc: string; attrs: A[] }
/** The six attributes listed first matter most to the archetype; they feed its tree. */
export const ARCHETYPES: Partial<Record<Pos, Arch[]>> = {
  QB: [
    { name: 'Field General', desc: 'Reads the whole field and puts it where only his man can get it.', attrs: ['AWR', 'MAC', 'SAC', 'TUP', 'DAC', 'THP'] },
    { name: 'Gunslinger', desc: 'Every window is open if the ball gets there fast enough.', attrs: ['THP', 'DAC', 'MAC', 'TUP', 'TOR', 'AWR'] },
    { name: 'Scrambler', desc: 'Breaks the pocket and turns broken plays into chunk gains.', attrs: ['SPD', 'ACC', 'TOR', 'ELU', 'AGI', 'SAC'] },
    { name: 'Improviser', desc: 'Extends plays and makes throws from every arm angle.', attrs: ['TOR', 'TUP', 'AGI', 'AWR', 'SAC', 'MAC'] },
    { name: 'Pocket Surgeon', desc: 'Short and intermediate precision, never rattled by pressure.', attrs: ['SAC', 'MAC', 'TUP', 'AWR', 'THP', 'DAC'] },
  ],
  RB: [
    { name: 'Power Back', desc: 'Falls forward and punishes tacklers who meet him square.', attrs: ['TRK', 'BTK', 'STR', 'CAR', 'BCV', 'ACC'] },
    { name: 'Elusive Back', desc: 'Makes the first man miss, then the second.', attrs: ['ELU', 'AGI', 'ACC', 'BCV', 'SPD', 'CAR'] },
    { name: 'Receiving Back', desc: 'A route runner out of the backfield who wins on third down.', attrs: ['CTH', 'RTE', 'AGI', 'ELU', 'CIT', 'SPD'] },
    { name: 'Home Run Hitter', desc: 'One crease and he is gone.', attrs: ['SPD', 'ACC', 'BCV', 'ELU', 'CAR', 'AGI'] },
    { name: 'Workhorse', desc: 'Thirty carries, no fumbles, still strong in the fourth.', attrs: ['CAR', 'BCV', 'STA', 'BTK', 'TRK', 'AWR'] },
  ],
  FB: [
    { name: 'Lead Blocker', desc: 'Clears the hole for the back behind him.', attrs: ['RBK', 'IBL', 'STR', 'AWR', 'PBK', 'TGH'] },
    { name: 'Short-Yardage Hammer', desc: 'Gets the one yard when everyone knows it is coming.', attrs: ['TRK', 'STR', 'CAR', 'BTK', 'ACC', 'RBK'] },
    { name: 'Receiving Fullback', desc: 'Leaks into the flat and keeps chains moving.', attrs: ['CTH', 'RTE', 'CIT', 'ACC', 'AGI', 'AWR'] },
    { name: 'H-Back', desc: 'Moves around the formation as blocker and outlet.', attrs: ['RBK', 'CTH', 'PBK', 'AGI', 'AWR', 'CIT'] },
    { name: 'Core Special Teamer', desc: 'First one down on every kick.', attrs: ['SPD', 'TAK', 'PUR', 'TGH', 'STR', 'HIT'] },
  ],
  WR: [
    { name: 'Deep Threat', desc: 'Takes the top off the defense.', attrs: ['SPD', 'ACC', 'SPC', 'RLS', 'RTE', 'CTH'] },
    { name: 'Route Technician', desc: 'Separation on every break, every route in the tree.', attrs: ['RTE', 'AGI', 'CTH', 'RLS', 'AWR', 'ACC'] },
    { name: 'Physical Possession', desc: 'Wins in traffic and on the boundary.', attrs: ['CIT', 'STR', 'CTH', 'SPC', 'RLS', 'JMP'] },
    { name: 'Slot Weapon', desc: 'Quick out of his breaks inside and dangerous after the catch.', attrs: ['AGI', 'ACC', 'RTE', 'ELU', 'CTH', 'BCV'] },
    { name: 'Playmaker', desc: 'Every catch is a chance to score.', attrs: ['ELU', 'BCV', 'SPD', 'BTK', 'CTH', 'AGI'] },
  ],
  TE: [
    { name: 'Vertical Threat', desc: 'Stretches the seam like a big receiver.', attrs: ['SPD', 'RTE', 'CTH', 'SPC', 'ACC', 'RLS'] },
    { name: 'Possession', desc: 'Sure hands on third down and in the red zone.', attrs: ['CTH', 'CIT', 'RTE', 'AWR', 'SPC', 'STR'] },
    { name: 'Blocking', desc: 'An extra tackle in the run game.', attrs: ['RBK', 'PBK', 'IBL', 'STR', 'AWR', 'TGH'] },
    { name: 'Move Tight End', desc: 'Lines up anywhere and wins mismatches.', attrs: ['RTE', 'AGI', 'CTH', 'RLS', 'SPD', 'ACC'] },
    { name: 'Red Zone Target', desc: 'Box out, high point, six points.', attrs: ['SPC', 'CIT', 'JMP', 'STR', 'CTH', 'AWR'] },
  ],
  EDGE: [
    { name: 'Speed Rusher', desc: 'Bends the edge before the tackle sets.', attrs: ['FMV', 'SPD', 'ACC', 'AGI', 'BSH', 'PUR'] },
    { name: 'Power Rusher', desc: 'Long-arms tackles into the quarterback.', attrs: ['PMV', 'STR', 'BSH', 'ACC', 'TAK', 'HIT'] },
    { name: 'Run Stopper', desc: 'Sets the edge and spills everything inside.', attrs: ['BSH', 'TAK', 'STR', 'PRC', 'PUR', 'PMV'] },
    { name: 'Hybrid Rusher', desc: 'A counter for every move.', attrs: ['FMV', 'PMV', 'ACC', 'BSH', 'STR', 'AWR'] },
    { name: 'Closer', desc: 'Finishes the sack and takes the ball with it.', attrs: ['PUR', 'HIT', 'TAK', 'ACC', 'FMV', 'SPD'] },
  ],
  DT: [
    { name: 'Nose Anchor', desc: 'Eats double teams so linebackers run free.', attrs: ['STR', 'BSH', 'TGH', 'AWR', 'PMV', 'TAK'] },
    { name: 'Interior Rusher', desc: 'Pressure up the middle where quarterbacks hate it most.', attrs: ['PMV', 'FMV', 'ACC', 'STR', 'BSH', 'PUR'] },
    { name: 'Penetrator', desc: 'One gap, first step, in the backfield.', attrs: ['ACC', 'FMV', 'AGI', 'PUR', 'BSH', 'TAK'] },
    { name: 'Run Plugger', desc: 'Nothing gets through his gap.', attrs: ['BSH', 'TAK', 'STR', 'PRC', 'AWR', 'HIT'] },
    { name: 'Power Bull', desc: 'Walks guards back into the pocket.', attrs: ['PMV', 'STR', 'TGH', 'BSH', 'HIT', 'ACC'] },
  ],
  LB: [
    { name: 'Field General', desc: 'Sets the defense and is always where the ball is.', attrs: ['PRC', 'AWR', 'TAK', 'PUR', 'ZCV', 'BSH'] },
    { name: 'Coverage Linebacker', desc: 'Runs with backs and tight ends.', attrs: ['ZCV', 'MCV', 'SPD', 'PRC', 'AGI', 'CTH'] },
    { name: 'Run Stopper', desc: 'Downhill, sheds, tackles.', attrs: ['TAK', 'BSH', 'HIT', 'STR', 'PRC', 'PUR'] },
    { name: 'Pass Rush Linebacker', desc: 'The blitz that never gets picked up.', attrs: ['FMV', 'PMV', 'ACC', 'SPD', 'BSH', 'PUR'] },
    { name: 'Sideline Hunter', desc: 'Range to make tackles sideline to sideline.', attrs: ['SPD', 'PUR', 'ACC', 'TAK', 'AGI', 'HIT'] },
  ],
  CB: [
    { name: 'Lockdown', desc: 'Travels with the No. 1 and takes him away.', attrs: ['MCV', 'SPD', 'PRS', 'AGI', 'PRC', 'ACC'] },
    { name: 'Zone Hawk', desc: 'Reads the quarterback and jumps routes.', attrs: ['ZCV', 'PRC', 'CTH', 'AWR', 'SPD', 'JMP'] },
    { name: 'Slot Corner', desc: 'Quick feet inside against shifty receivers.', attrs: ['AGI', 'ZCV', 'MCV', 'ACC', 'TAK', 'PRC'] },
    { name: 'Press Corner', desc: 'Disrupts timing at the line.', attrs: ['PRS', 'STR', 'MCV', 'AGI', 'SPD', 'HIT'] },
    { name: 'Ballhawk', desc: 'Interceptions change games.', attrs: ['CTH', 'ZCV', 'JMP', 'PRC', 'SPD', 'SPC'] },
  ],
  S: [
    { name: 'Centerfielder', desc: 'Nothing gets over his head.', attrs: ['ZCV', 'SPD', 'PRC', 'CTH', 'AWR', 'ACC'] },
    { name: 'Box Safety', desc: 'An extra linebacker against the run.', attrs: ['TAK', 'HIT', 'BSH', 'PUR', 'PRC', 'STR'] },
    { name: 'Hybrid', desc: 'Covers tight ends, fills against the run, blitzes.', attrs: ['MCV', 'ZCV', 'TAK', 'PRC', 'SPD', 'HIT'] },
    { name: 'Ballhawk', desc: 'Reads, breaks, takes it away.', attrs: ['CTH', 'ZCV', 'PRC', 'JMP', 'SPD', 'SPC'] },
    { name: 'Enforcer', desc: 'Receivers hear him coming.', attrs: ['HIT', 'TAK', 'PUR', 'STR', 'SPD', 'PRC'] },
  ],
};
export const hasTree = (pos: Pos) => !!ARCHETYPES[pos];

/** How well a player fits an archetype: weighted on its attribute list. */
export function fit(p: Player, a: Arch) { return a.attrs.reduce((s, k, i) => s + p.attrs[k] * (6 - i), 0) / 21; }
export function bestArch(p: Player): Arch | undefined { return (ARCHETYPES[p.pos] ?? []).slice().sort((x, y) => fit(p, y) - fit(p, x))[0]; }

export interface Node { id: string; level: 1 | 2 | 3; branch: 'main' | 'A' | 'B'; i: number; attr: A; amt: number; cost: number }
/** The tree for an archetype, built from its attribute list. */
export function treeFor(a: Arch): Node[] {
  const P = a.attrs, out: Node[] = [];
  [[0, 2], [1, 2], [2, 2], [3, 2], [0, 2]].forEach(([k, amt], i) => out.push({ id: `1-${i}`, level: 1, branch: 'main', i, attr: P[k], amt, cost: 1 }));
  [[0, 3], [1, 3], [2, 3], [4, 2], [3, 3], [5, 2], [1, 3], [0, 3]].forEach(([k, amt], i) => out.push({ id: `2-${i}`, level: 2, branch: 'main', i, attr: P[k], amt, cost: 2 }));
  [0, 2, 4, 0, 2, 4].forEach((k, i) => out.push({ id: `3A-${i}`, level: 3, branch: 'A', i, attr: P[k], amt: i === 5 ? 5 : 3, cost: 3 }));
  [1, 3, 5, 1, 3, 5].forEach((k, i) => out.push({ id: `3B-${i}`, level: 3, branch: 'B', i, attr: P[k], amt: i === 5 ? 5 : 3, cost: 3 }));
  return out;
}
export const BRANCH_NAME = (a: Arch, b: 'A' | 'B') => (b === 'A' ? `${a.attrs[0]} · ${a.attrs[2]} · ${a.attrs[4]}` : `${a.attrs[1]} · ${a.attrs[3]} · ${a.attrs[5]}`);

export interface Tree { arch: string; sp: number; owned: string[]; earned: string[]; /** Spend points automatically as they come in. */ auto?: boolean }
type PT = Player & { tree?: Tree };
/** The player's tree state, created on first look with a starting allowance. */
export function treeOf(p: Player): Tree | undefined {
  const q = p as PT;
  if (!hasTree(p.pos)) return undefined;
  if (!q.tree) { q.arch = bestArch(p)!.name; } if (!q.tree) q.tree = { arch: q.arch, sp: 2 + (p.ovr >= 85 ? 2 : 0) + (p.age <= 24 ? 1 : 0), owned: [], earned: [] };
  return q.tree;
}
export const archOf = (p: Player) => (ARCHETYPES[p.pos] ?? []).find(a => a.name === treeOf(p)?.arch) ?? bestArch(p);
export const levelDone = (p: Player, lvl: 1 | 2 | 3) => { const a = archOf(p), t = treeOf(p); return !!a && !!t && treeFor(a).filter(n => n.level === lvl).every(n => t.owned.includes(n.id)); };
const DEV_RANK: Dev[] = ['Normal', 'Star', 'Superstar', 'X-Factor'];

/** Overall needed to open each level: the tree rewards players who are already good. */
export const LEVEL_OVR: Record<1 | 2 | 3, number> = { 1: 0, 2: 75, 3: 82 };
export function canBuy(p: Player, n: Node): 'owned' | 'ok' | 'locked' | 'points' | 'ovr' {
  const t = treeOf(p)!; const a = archOf(p)!;
  if (t.owned.includes(n.id)) return 'owned';
  if (n.level > 1 && !levelDone(p, (n.level - 1) as 1 | 2)) return 'locked';
  if (p.ovr < LEVEL_OVR[n.level]) return 'ovr';
  const prev = treeFor(a).find(m => m.level === n.level && m.branch === n.branch && m.i === n.i - 1);
  if (prev && !t.owned.includes(prev.id)) return 'locked';
  return t.sp >= n.cost ? 'ok' : 'points';
}

/** Spend points on a node: raise the rating, re-rate him, and promote his development when a level is finished. */
export function buy(league: League, p: Player, n: Node): { ovr: number; dev?: Dev } | null {
  if (canBuy(p, n) !== 'ok') return null;
  const t = treeOf(p)!;
  t.sp -= n.cost; t.owned.push(n.id);
  p.attrs[n.attr] = Math.min(99, p.attrs[n.attr] + n.amt);
  const before = p.ovr;
  p.ovr = overall(p.pos, p.attrs);
  p.pot = Math.max(p.pot, p.ovr);
  let dev: Dev | undefined;
  const target: Dev | undefined = levelDone(p, 3) ? 'X-Factor' : levelDone(p, 2) ? 'Superstar' : levelDone(p, 1) ? 'Star' : undefined;
  if (target && DEV_RANK.indexOf(target) > DEV_RANK.indexOf(p.dev)) {
    p.dev = target; dev = target;
    if (target === 'X-Factor' && !p.xf) p.xf = XFACTORS[p.pos] ?? XFACTORS.ANY;
    news(league, 'milestone', `${p.fn} ${p.ln} is now a ${target}${target === 'X-Factor' ? ` (${p.xf})` : ''} after mastering the ${t.arch} tree.`, [p.team], { pid: p.id, big: true });
  }
  return { ovr: p.ovr - before, dev };
}

/** The order auto-spend buys in: finish Level 1, then Level 2, then both Level 3 trees side by side. */
function autoOrder(a: Arch): Node[] {
  const ns = treeFor(a);
  const l3 = ns.filter(n => n.level === 3).sort((x, y) => x.i - y.i || (x.branch < y.branch ? -1 : 1));
  return [...ns.filter(n => n.level === 1), ...ns.filter(n => n.level === 2), ...l3];
}
/** Spend everything he can afford, in tree order. Returns the nodes bought and any promotion. */
export function autoSpend(league: League, p: Player): { bought: Node[]; dev?: Dev } {
  const a = archOf(p), t = treeOf(p);
  const res: { bought: Node[]; dev?: Dev } = { bought: [] };
  if (!a || !t) return res;
  for (let guard = 0; guard < 40; guard++) {
    const n = autoOrder(a).find(x => canBuy(p, x) === 'ok');
    if (!n) break;
    const r = buy(league, p, n); if (!r) break;
    res.bought.push(n); if (r.dev) res.dev = r.dev;
  }
  return res;
}
/** Is auto-spend on for this player (his own switch, or the team-wide one)? */
export const autoOn = (league: League, p: Player) => !!treeOf(p)?.auto || !!(league as League & { autoSkill?: boolean }).autoSkill;
export function setTeamAuto(league: League, on: boolean) { (league as League & { autoSkill?: boolean }).autoSkill = on; }

/** Goals a player chases this season: season targets in three tiers, plus single-game milestones. */
export interface Goal { id: string; label: string; cur: number; target: number; sp: number; game?: boolean }
const S = (s: StatLine | undefined, k: keyof StatLine) => (s?.[k] as number) ?? 0;
export function goalsFor(p: Player, season: number): Goal[] {
  const s = p.stats[season];
  const tiers = (key: keyof StatLine, label: string, t: [number, number, number]) => t.map((target, i) => ({ id: `${season}-${key}-${i}`, label: `${target.toLocaleString()} ${label}`, cur: S(s, key), target, sp: i + 1 }));
  const g = (id: string, label: string, sp = 1): Goal => ({ id, label, cur: 0, target: 1, sp, game: true });
  switch (p.pos) {
    case 'QB': return [...tiers('py', 'passing yards', [1500, 3000, 4500]), ...tiers('ptd', 'passing TDs', [10, 22, 35]), g('300', '300-yard passing game'), g('3td', '3 touchdown passes in a game', 2)];
    case 'RB': case 'FB': return [...tiers('ry', 'rushing yards', [400, 800, 1300]), ...tiers('rtd', 'rushing TDs', [4, 8, 14]), g('100r', '100-yard rushing game'), g('2td', '2 touchdowns in a game', 2)];
    case 'WR': return [...tiers('recy', 'receiving yards', [400, 900, 1300]), ...tiers('rectd', 'receiving TDs', [3, 7, 11]), g('100y', '100-yard receiving game'), g('2td', '2 touchdowns in a game', 2)];
    case 'TE': return [...tiers('recy', 'receiving yards', [300, 650, 1000]), ...tiers('rectd', 'receiving TDs', [2, 5, 9]), g('80y', '80-yard receiving game'), g('2td', '2 touchdowns in a game', 2)];
    case 'EDGE': case 'DT': return [...tiers('dsk', 'sacks', [3, 7, 12]), ...tiers('tfl', 'tackles for loss', [4, 9, 15]), g('2sk', '2 sacks in a game'), g('ff', 'Forced fumble', 1)];
    case 'LB': return [...tiers('tkl', 'tackles', [40, 85, 130]), ...tiers('dsk', 'sacks', [1, 3, 6]), g('10t', '10 tackles in a game'), g('int', 'Interception', 2)];
    case 'CB': case 'S': return [...tiers('dint', 'interceptions', [1, 3, 6]), ...tiers('pd', 'passes defended', [4, 9, 15]), g('int', 'Interception in a game', 2), g('2pd', '2 passes defended in a game')];
  }
  return [];
}

/** After each week: pay out skill points for goals the user's players reached. Returns what was earned. */
export function awardSkillPoints(league: League, gameBoxes: Record<string, Partial<StatLine>>[]): { p: Player; sp: number; why: string }[] {
  const out: { p: Player; sp: number; why: string }[] = [];
  for (const p of Object.values(league.players)) {
    if (p.team !== league.user || !hasTree(p.pos)) continue;
    const t = treeOf(p)!;
    const raw = gameBoxes.map(b => b[p.id]).find(Boolean);
    const box = raw ? new Proxy(raw, { get: (o, k) => (o as Record<string, number>)[k as string] ?? 0 }) as StatLine : undefined;
    for (const goal of goalsFor(p, league.season)) {
      let hit = false, key = goal.id;
      if (goal.game) {
        if (!box) continue;
        key = `${league.season}-${league.week}-${goal.id}`;
        hit = goal.id === '300' ? box.py >= 300 : goal.id === '3td' ? box.ptd >= 3 : goal.id === '100r' ? box.ry >= 100 : goal.id === '100y' ? box.recy >= 100 : goal.id === '80y' ? box.recy >= 80
          : goal.id === '2td' ? box.rtd + box.rectd >= 2 : goal.id === '2sk' ? box.dsk >= 2 : goal.id === 'ff' ? box.ff >= 1 : goal.id === '10t' ? box.tkl >= 10 : goal.id === 'int' ? box.dint >= 1 : goal.id === '2pd' ? box.pd >= 2 : false;
      } else hit = goal.cur >= goal.target;
      if (hit && !t.earned.includes(key)) { t.earned.push(key); t.sp += goal.sp; out.push({ p, sp: goal.sp, why: goal.label }); }
    }
    if (t.earned.length > 300) t.earned.splice(0, t.earned.length - 300);
    if (t.sp > 0 && autoOn(league, p)) {
      const spent = autoSpend(league, p);
      if (spent.bought.length) out.push({ p, sp: 0, why: `auto-spent on ${spent.bought.map(n => `+${n.amt} ${n.attr}`).join(', ')}${spent.dev ? ` (now ${spent.dev})` : ''}` });
    }
  }
  return out;
}
