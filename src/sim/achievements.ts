/**
 * Achievements: what a player has done across every city they have run.
 *
 * Goals belong to one city and pay experience into it. Achievements belong to
 * the player -- they are kept in this browser, not in a save -- so a new city
 * is never starting from nothing: there is always something on the list the
 * last one did not manage. Each is a reading off the running city, like the
 * goals, checked on the same slow beat.
 *
 * Tiers are for the list's order and colour, not for scoring: bronze is what a
 * first city does, gold is what a player has to set out to do.
 */

import type { Simulation } from './agents/sim';
import type { World } from './world';
import { Util } from './agents/utilities';
import { assetById } from '../assets/registry';
import { enabledMods } from './mods';

export type Tier = 'bronze' | 'silver' | 'gold';

export interface Achievement {
  id: string;
  title: string;
  note: string;
  tier: Tier;
  /** Where the city stands and what it needs. */
  progress(sim: Simulation, world: World): [number, number];
}

function landmarks(world: World): number {
  let n = 0;
  for (const lot of world.lots) if (assetById(lot.id)?.signature === true) n++;
  return n;
}
function services(world: World): number {
  let n = 0;
  for (const lot of world.lots) if (assetById(lot.id)?.zone === 'service') n++;
  return n;
}
function filled(sim: Simulation): number {
  let n = 0;
  for (const s of sim.places.staffed) n += s;
  return n;
}
const flag = (ok: boolean): [number, number] => [ok ? 1 : 0, 1];

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'pop.250', title: 'Village', tier: 'bronze', note: 'Reach 250 residents.',
    progress: (s) => [s.people.population, 250] },
  { id: 'pop.1000', title: 'Market Town', tier: 'bronze', note: 'Reach 1,000 residents.',
    progress: (s) => [s.people.population, 1000] },
  { id: 'pop.5000', title: 'City Charter', tier: 'silver', note: 'Reach 5,000 residents.',
    progress: (s) => [s.people.population, 5000] },
  { id: 'pop.15000', title: 'Metropolis', tier: 'gold', note: 'Reach 15,000 residents.',
    progress: (s) => [s.people.population, 15000] },
  { id: 'pop.40000', title: 'Megacity', tier: 'gold', note: 'Reach 40,000 residents.',
    progress: (s) => [s.people.population, 40000] },
  { id: 'level.5', title: 'Rising Star', tier: 'bronze', note: 'Reach level 5.',
    progress: (_s, w) => [w.progress.level, 5] },
  { id: 'level.10', title: 'Renowned', tier: 'silver', note: 'Reach level 10.',
    progress: (_s, w) => [w.progress.level, 10] },
  { id: 'jobs.2000', title: 'Working Town', tier: 'bronze', note: 'Fill 2,000 jobs.',
    progress: (s) => [filled(s), 2000] },
  { id: 'jobs.10000', title: 'Engine of the Region', tier: 'gold', note: 'Fill 10,000 jobs.',
    progress: (s) => [filled(s), 10000] },
  { id: 'money.10m', title: 'Deep Pockets', tier: 'silver', note: 'Hold 10 million in the treasury.',
    progress: (_s, w) => [Math.max(0, w.budget.balance), 10_000_000] },
  { id: 'money.week', title: 'Money Machine', tier: 'gold', note: 'Run a million a week in the black.',
    progress: (s) => [Math.max(0, s.economy.report.net), 1_000_000] },
  { id: 'tax.haven', title: 'Tax Haven', tier: 'silver', note: 'Every tax at 5% or less, 1,000 residents, and still in the black.',
    progress: (s, w) => flag(s.people.population >= 1000 && s.economy.report.net > 0
      && Array.from(w.budget.rates).every((r) => r <= 0.05 + 1e-6)) },
  { id: 'loan.first', title: 'Leveraged', tier: 'bronze', note: 'Take out a loan from the regional bank.',
    progress: (_s, w) => flag(w.budget.loans.length > 0) },
  { id: 'landmark.1', title: 'Point of Pride', tier: 'bronze', note: 'Build a landmark.',
    progress: (_s, w) => [landmarks(w), 1] },
  { id: 'landmark.5', title: 'Skyline', tier: 'silver', note: 'Build five landmarks in one city.',
    progress: (_s, w) => [landmarks(w), 5] },
  { id: 'landmark.12', title: 'Collector', tier: 'gold', note: 'Build twelve landmarks in one city.',
    progress: (_s, w) => [landmarks(w), 12] },
  { id: 'services.25', title: 'Public Servant', tier: 'silver', note: 'Run 25 service buildings.',
    progress: (_s, w) => [services(w), 25] },
  { id: 'utilities.all', title: 'Fully Served', tier: 'silver', note: 'Power and water for every home, with 5,000 residents.',
    progress: (s) => flag(s.people.population >= 5000
      && s.utilities.report.served[Util.POWER] >= 0.999 && s.utilities.report.served[Util.WATER] >= 0.999) },
  { id: 'happy.85', title: 'Beloved Mayor', tier: 'gold', note: 'Happiness at 85% or more with 3,000 residents.',
    progress: (s) => flag(s.people.population >= 3000 && s.people.happiness >= 0.85) },
  { id: 'transit.1000', title: 'All Aboard', tier: 'bronze', note: '1,000 transit riders a week.',
    progress: (s) => [Math.round(s.transit.report.ridersPerDay * 7), 1000] },
  { id: 'transit.10000', title: 'Transit City', tier: 'gold', note: '10,000 transit riders a week.',
    progress: (s) => [Math.round(s.transit.report.ridersPerDay * 7), 10000] },
  { id: 'traffic.free', title: 'Free Flow', tier: 'gold', note: 'Average over 40 km/h with 1,500 vehicles on the road.',
    progress: (s) => flag(s.traffic.stats.driving >= 1500 && s.traffic.stats.meanSpeed * 3.6 >= 40) },
  { id: 'districts.3', title: 'Neighbourhoods', tier: 'bronze', note: 'Paint three districts.',
    progress: (_s, w) => [w.districts.list.length, 3] },
  { id: 'industry.3', title: 'Industrialist', tier: 'silver', note: 'Run three industry headquarters.',
    progress: (_s, w) => [w.industry.hqs.length, 3] },
  { id: 'mods.on', title: 'Tinkerer', tier: 'bronze', note: 'Play a city with a mod switched on.',
    progress: (s) => flag(s.people.population > 0 && enabledMods().length > 0) },
];

const KEY = 'civitas.achievements.v1';

function read(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown;
    if (v === null || typeof v !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [k, t] of Object.entries(v)) if (typeof t === 'number') out[k] = t;
    return out;
  } catch {
    return {};
  }
}

let earned = read();

/** When an achievement was earned, or null. */
export function earnedAt(id: string): number | null { return earned[id] ?? null; }
export function earnedCount(): number { return ACHIEVEMENTS.filter((a) => earned[a.id] !== undefined).length; }

/**
 * Checks the running city and returns anything newly earned. Cheap: every
 * test is a handful of reads, and the lot counts only walk the lots once each.
 */
export function checkAchievements(sim: Simulation, world: World): Achievement[] {
  const fresh: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (earned[a.id] !== undefined) continue;
    const [now, need] = a.progress(sim, world);
    if (now < need) continue;
    earned[a.id] = Date.now();
    fresh.push(a);
  }
  if (fresh.length > 0) {
    try { localStorage.setItem(KEY, JSON.stringify(earned)); } catch { /* kept for the session */ }
  }
  return fresh;
}

/** Re-reads the stored list, for a screen opened after another tab earned some. */
export function reloadAchievements(): void { earned = read(); }
