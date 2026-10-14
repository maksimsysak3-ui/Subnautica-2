// Stadium pulse: how loud a building is. Every stadium has a baseline (its reputation, the
// roof, the team's own investment in it), ranked against the rest of the league. In a game
// the pulse moves with the home crowd: big plays, stops, sacks and takeaways send it up;
// the visitors scoring takes the air out of it. A rocking building makes the road offence
// jump early more often and play a little worse.
import type { League } from '../core/types';

const LOUD: Record<string, number> = {
  SEA: 96, KC: 95, NO: 91, MIN: 91, BUF: 90, PHI: 89, DET: 88, GB: 86, BAL: 86, DEN: 85, PIT: 85, CIN: 81, CLE: 82, NE: 80, SF: 80, DAL: 80, CHI: 80,
  IND: 79, ATL: 78, HOU: 78, TEN: 77, TB: 76, LV: 76, MIA: 75, NYG: 74, NYJ: 74, ARI: 74, CAR: 74, WAS: 73, JAX: 72, LAR: 72, LAC: 68,
};

/** The building's baseline loudness, 40..99. Teams can carry their own (college programs do). */
export function crowdBase(L: League, abbr: string): number {
  const t = L.teams[abbr] as League['teams'][string] & { crowd?: number };
  if (!t) return 70;
  if (t.crowd != null) return t.crowd;
  let v = LOUD[abbr] ?? 76;
  if (t.roof === 'dome' || t.roof === 'closed') v += 1.5;
  const stadiumLevel = (L as unknown as { facilities?: Record<string, { stadium?: number }> }).facilities?.[abbr]?.stadium ?? 0;
  v += stadiumLevel * 1.5;
  return Math.max(40, Math.min(99, Math.round(v)));
}
/** "#3 of 32 in the NFL" (or the team's own label, e.g. a college ranking). */
export function crowdRank(L: League, abbr: string): { rank: number; of: number; label: string } {
  const t = L.teams[abbr] as League['teams'][string] & { crowdRank?: { rank: number; of: number; label: string } };
  if (t?.crowdRank) return t.crowdRank;
  const all = Object.keys(L.teams).map(a => [a, crowdBase(L, a)] as const).sort((a, b) => b[1] - a[1]);
  const rank = all.findIndex(x => x[0] === abbr) + 1;
  return { rank, of: all.length, label: `#${rank} of ${all.length} in the NFL` };
}
export const pulseLabel = (v: number) => (v >= 90 ? 'Deafening' : v >= 78 ? 'Rocking' : v >= 62 ? 'Loud' : v >= 45 ? 'Buzzing' : 'Quiet');
