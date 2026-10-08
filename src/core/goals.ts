// Season objectives from the owner, and the league's weekly Players of the Week.
// The owner sets four goals scaled to how good the roster is (a contender is asked
// for the division, a rebuilder for progress); they are tracked on the hub and paid
// out at the end of the regular season in job security and coach XP. Players of the
// Week go league-wide; when one is yours he gets a morale lift and a skill point.
import type { League, Player, StatLine } from './types';
import { clamp } from './rng';
import { teamRatings } from './league';
import { standings, news, mail, weekGames, REG_WEEKS, levelCoach } from './season';
import { fans } from './media';
import { treeOf } from './archetypes';

export interface OwnerGoal { id: 'wins' | 'tier' | 'offense' | 'fans'; label: string; target: number; reward: number }
interface GoalState { season: number; list: OwnerGoal[]; settled?: boolean }
const store = (L: League) => L as League & { ownerGoals?: GoalState };

/** This season's goals, set the first time they are asked for in the regular season. */
export function ownerGoals(L: League): GoalState | undefined {
  const s = store(L);
  if (s.ownerGoals?.season === L.season) return s.ownerGoals;
  if (L.phase !== 'regular' && L.phase !== 'preseason') return s.ownerGoals?.season === L.season ? s.ownerGoals : undefined;
  const exp = 4 + (teamRatings(L, L.user).ovr - 70) * 0.6;
  const wins = clamp(Math.round(exp), 4, 13);
  const tier: OwnerGoal = exp >= 9.5 ? { id: 'tier', label: 'Win the division', target: 1, reward: 8 }
    : exp >= 7 ? { id: 'tier', label: 'Make the playoffs', target: 1, reward: 8 }
    : { id: 'tier', label: 'Win 3 division games', target: 3, reward: 6 };
  const off = exp >= 9 ? 8 : exp >= 6.5 ? 14 : 20;
  s.ownerGoals = { season: L.season, list: [
    { id: 'wins', label: `Win ${wins} games`, target: wins, reward: 8 },
    tier,
    { id: 'offense', label: `Top-${off} scoring offense`, target: off, reward: 5 },
    { id: 'fans', label: 'Fan support of 65+', target: 65, reward: 4 },
  ] };
  return s.ownerGoals;
}

/** Where each goal stands right now: current value, and whether it is met. */
export function goalProgress(L: League, g: OwnerGoal): { cur: number; met: boolean; text: string } {
  const st = standings(L), me = st[L.user];
  if (g.id === 'wins') return { cur: me.w, met: me.w >= g.target, text: `${me.w} / ${g.target}` };
  if (g.id === 'fans') { const f = Math.round(fans(L)); return { cur: f, met: f >= g.target, text: `${f} / ${g.target}` }; }
  if (g.id === 'offense') {
    const ppg = (a: string) => { const s = st[a]; const gp = s.w + s.l + s.t; return gp ? s.pf / gp : 0; };
    const rank = Object.keys(L.teams).sort((a, b) => ppg(b) - ppg(a)).indexOf(L.user) + 1;
    return { cur: rank, met: rank <= g.target, text: `#${rank} (${ppg(L.user).toFixed(1)} ppg)` };
  }
  // Tier: division title / playoff spot / division wins.
  if (g.target === 3) return { cur: me.div[0], met: me.div[0] >= 3, text: `${me.div[0]} / 3` };
  const t = L.teams[L.user];
  const div = Object.values(st).filter(x => L.teams[x.abbr].conf === t.conf && L.teams[x.abbr].div === t.div).sort((a, b) => b.pct - a.pct || b.w - a.w);
  const conf = Object.values(st).filter(x => L.teams[x.abbr].conf === t.conf).sort((a, b) => b.pct - a.pct || b.w - a.w);
  if (g.label.startsWith('Win the division')) { const r = div.findIndex(x => x.abbr === L.user) + 1; return { cur: r, met: r === 1, text: r === 1 ? '1st in division' : `${r}${['', 'st', 'nd', 'rd', 'th'][r]} in division` }; }
  const r = conf.findIndex(x => x.abbr === L.user) + 1;
  return { cur: r, met: r <= 7, text: `#${r} in the ${t.conf}` };
}

/** End of the regular season: pay out (or charge) each goal. */
export function settleOwnerGoals(L: League) {
  const s = ownerGoals(L);
  if (!s || s.settled) return;
  s.settled = true;
  const lines: string[] = []; let delta = 0, xp = 0;
  for (const g of s.list) {
    const p = goalProgress(L, g);
    const d = p.met ? g.reward : -Math.round(g.reward * 0.6);
    delta += d; if (p.met) xp += 120;
    lines.push(`${p.met ? 'MET' : 'MISSED'}: ${g.label} (${p.text}) ${d > 0 ? '+' : ''}${d} security`);
  }
  L.security = clamp(L.security + delta, 0, 100);
  L.coachTree.xp += xp;
  levelCoach(L);
  const met = s.list.filter(g => goalProgress(L, g).met).length;
  mail(L, 'Owner', `Season goals: ${met} of ${s.list.length} met`, lines.join('\n'));
}

// ---- Players of the Week -------------------------------------------------------------
const offScore = (l: Partial<StatLine>) => (l.py ?? 0) * 0.04 + (l.ptd ?? 0) * 4 - (l.pint ?? 0) * 3 + ((l.ry ?? 0) + (l.recy ?? 0)) * 0.1 + ((l.rtd ?? 0) + (l.rectd ?? 0)) * 6 - (l.fuml ?? 0) * 3;
const defScore = (l: Partial<StatLine>) => (l.dsk ?? 0) * 4 + (l.dint ?? 0) * 5 + (l.ff ?? 0) * 3 + (l.fr ?? 0) * 2 + (l.tkl ?? 0) * 0.5 + (l.tfl ?? 0) * 1.5 + (l.pd ?? 0) * 1.2 + (l.dtd ?? 0) * 6;

/** After the week's games: name the Offensive and Defensive Players of the Week. */
export function playersOfTheWeek(L: League) {
  if (L.phase !== 'regular' || L.week > REG_WEEKS) return;
  const lines: [Player, Partial<StatLine>][] = [];
  for (const g of weekGames(L)) for (const [id, l] of Object.entries(g.result?.box?.players ?? {})) { const p = L.players[id]; if (p) lines.push([p, l]); }
  if (!lines.length) return;
  const pick = (f: (l: Partial<StatLine>) => number) => lines.slice().sort((a, b) => f(b[1]) - f(a[1]))[0];
  const why = (l: Partial<StatLine>, off: boolean) => off
    ? [(l.py ?? 0) >= 150 && `${l.py} pass yds, ${l.ptd ?? 0} TD`, (l.ry ?? 0) >= 60 && `${l.ry} rush yds`, (l.recy ?? 0) >= 60 && `${l.recy} rec yds`, ((l.rtd ?? 0) + (l.rectd ?? 0)) > 0 && `${(l.rtd ?? 0) + (l.rectd ?? 0)} TD`].filter(Boolean).join(', ')
    : [(l.dsk ?? 0) > 0 && `${l.dsk} sacks`, (l.dint ?? 0) > 0 && `${l.dint} INT`, (l.ff ?? 0) > 0 && `${l.ff} FF`, `${l.tkl ?? 0} tackles`].filter(Boolean).join(', ');
  for (const [label, [p, l], off] of [['Offensive', pick(offScore), true], ['Defensive', pick(defScore), false]] as const) {
    news(L, 'award', `Week ${L.week} ${label} Player of the Week: ${p.fn} ${p.ln} (${p.team}) · ${why(l, off)}.`, [p.team], { pid: p.id, big: p.team === L.user });
    (p as Player & { potw?: number }).potw = ((p as Player & { potw?: number }).potw ?? 0) + 1;
    if (p.team === L.user) {
      p.morale = clamp(p.morale + 5, 0, 100);
      const t = treeOf(p); if (t) t.sp += 1;
      mail(L, 'League Office', `${p.ln} is ${label} Player of the Week`, `${p.fn} ${p.ln} earned ${label} Player of the Week honors (${why(l, off)}). Morale +5${t ? ' and +1 archetype skill point' : ''}.`);
    }
  }
}
