// Facilities: six buildings per team, each rated 1-5 (3 is league average). The owner
// funds upgrades every offseason, more when the team wins and the city is behind it.
// Every team has them and they all count, so a good campus is a real edge and a bad one
// a real handicap. AI teams invest too.
import type { League } from './types';
import { Rng, clamp, hash } from './rng';
import { standings, mail, news } from './season';
import { fans } from './media';

export type FacilityId = 'training' | 'medical' | 'strength' | 'film' | 'stadium' | 'scouting';
const avg = (f: (l: number) => string) => (l: number) => (l === 3 ? 'League average' : f(l));
export const FACILITIES: { id: FacilityId; name: string; blurb: string; effect: (lvl: number) => string }[] = [
  { id: 'training', name: 'Training Center', blurb: 'Practice fields, indoor facility and position rooms.', effect: avg(l => `${pct((l - 3) * 0.04)} player XP`) },
  { id: 'medical', name: 'Medical Center', blurb: 'Team doctors, imaging and rehab pools.', effect: avg(l => `${pct(-(l - 3) * 0.07)} time out with injuries · ${pct(-(l - 3) * 0.03)} in-game injuries`) },
  { id: 'strength', name: 'Strength Lab', blurb: 'Weight room, sports science and recovery tech.', effect: avg(l => `${sign((l - 3) * 2)} weekly condition recovery`) },
  { id: 'film', name: 'Film Room', blurb: 'Video, analytics and the coordinators\' war rooms.', effect: avg(l => `${sign((l - 3) * 0.25, 2)} to every rating on game day`) },
  { id: 'stadium', name: 'Stadium Experience', blurb: 'Video board, sound, seating and concourses.', effect: avg(l => `${sign((l - 3) * 0.2, 1)} home-field edge · ${sign((l - 3) * 0.3, 1)} fan support a week`) },
  { id: 'scouting', name: 'Scouting Department', blurb: 'Area scouts, data and the draft room.', effect: avg(l => `${sign((l - 3) * 40)} scouting points each offseason`) },
];
const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}%`;
const sign = (v: number, d = 0) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`;
/** Cost to go from `lvl` to `lvl + 1`. */
export const upgradeCost = (lvl: number) => [0, 15, 28, 45, 70][lvl] * 1_000_000;

interface State { levels: Record<string, Record<FacilityId, number>>; funds: number; season: number }
export function facilityState(L: League): State {
  const S = L as League & { facilities?: State };
  if (S.facilities) return S.facilities;
  const rng = new Rng(hash(`fac-${L.seed}`));
  const levels: State['levels'] = {};
  for (const t of Object.keys(L.teams)) {
    const l = {} as Record<FacilityId, number>;
    for (const f of FACILITIES) l[f.id] = clamp(Math.round(rng.normal(3, 0.8)), 1, 5);
    levels[t] = l;
  }
  S.facilities = { levels, funds: 40_000_000, season: L.season };
  return S.facilities;
}
export const facility = (L: League, team: string, id: FacilityId) => facilityState(L).levels[team]?.[id] ?? 3;

// ---- effects (centred on level 3) --------------------------------------------------------------
export const facilityXpMult = (L: League, team: string) => 1 + (facility(L, team, 'training') - 3) * 0.04;
export const facilityHeal = (L: League, team: string) => 1 - (facility(L, team, 'medical') - 3) * 0.07;
export const facilityInjuryShield = (L: League, team: string) => (facility(L, team, 'medical') - 3) * 0.03;
export const facilityRecovery = (L: League, team: string) => (facility(L, team, 'strength') - 3) * 2;
export const facilityGameDay = (L: League, team: string) => (facility(L, team, 'film') - 3) * 0.25;
export const facilityHomeEdge = (L: League, team: string) => (facility(L, team, 'stadium') - 3) * 0.2;
export const facilityFans = (L: League) => (facility(L, L.user, 'stadium') - 3) * 0.3;
export const facilityScouting = (L: League) => (facility(L, L.user, 'scouting') - 3) * 40;

export type UpgradeResult = { ok: true } | { ok: false; reason: string };
export function upgrade(L: League, id: FacilityId): UpgradeResult {
  const s = facilityState(L), lvl = facility(L, L.user, id);
  if (lvl >= 5) return { ok: false, reason: 'Already state of the art.' };
  const cost = upgradeCost(lvl);
  if (cost > s.funds) return { ok: false, reason: `Not enough in the facilities budget (${(cost / 1e6).toFixed(0)}M needed).` };
  s.funds -= cost; s.levels[L.user][id] = lvl + 1;
  const f = FACILITIES.find(x => x.id === id)!;
  news(L, 'league', `The ${L.teams[L.user].nick} unveiled an upgraded ${f.name.toLowerCase()} (level ${lvl + 1}).`, [L.user]);
  return { ok: true };
}

/** The new league year: the owner funds the user's budget; AI teams build and their buildings age. */
export function facilitiesOffseason(L: League, prevSeason: number) {
  const s = facilityState(L);
  const rng = new Rng(hash(`facoff-${L.seed}-${prevSeason}`));
  const st = standings(L, prevSeason)[L.user];
  const gp = st ? st.w + st.l + st.t : 0;
  const grant = Math.round((20_000_000 + (gp ? st.w / gp : 0.5) * 30_000_000 + fans(L) * 200_000 + L.security * 100_000) / 1e6) * 1e6;
  s.funds += grant; s.season = L.season;
  mail(L, 'Owner', 'Facilities budget', `For the new league year I'm putting $${(grant / 1e6).toFixed(0)}M into our facilities budget. You have $${(s.funds / 1e6).toFixed(0)}M to spend. Coach Central → Facilities.`);
  for (const t of Object.keys(L.teams)) {
    if (t === L.user) continue;
    const l = s.levels[t];
    if (rng.chance(0.35)) { const f = rng.pick(FACILITIES).id; l[f] = Math.min(5, l[f] + 1); }
    if (rng.chance(0.25)) { const f = rng.pick(FACILITIES).id; l[f] = Math.max(1, l[f] - 1); }   // buildings age
  }
}
