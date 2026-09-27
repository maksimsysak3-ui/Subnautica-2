/**
 * Scenarios: a city founded with a job to do, and a deadline to do it by.
 *
 * Free play asks nothing; a scenario asks for something specific -- a tourist
 * town, a green city, a boom town on a shoestring -- and gives the player a
 * few years to get there. Every objective is a reading off the city, exactly
 * like the goals, so a loaded save shows the truth and nothing can drift.
 *
 * Winning is a moment, not an ending: the city carries on in free play. So is
 * losing: the deadline passes, the paper says so, and the player can keep the
 * city and finish the job late for no credit, or found another.
 */

import type { Simulation } from './agents/sim';
import type { World } from './world';
import type { DisasterLevel } from './disasters';
import { DAYS_PER_YEAR } from './weather';

export interface Objective {
  title: string;
  /** Where the city is, and what it needs. */
  progress(sim: Simulation, world: World): [number, number];
  /** How to show the numbers: a count, a share, or money. */
  unit?: 'count' | 'share' | 'money';
}

export interface ScenarioDef {
  id: string;
  name: string;
  /** Two sentences for the founding screen. */
  blurb: string;
  /** Game days to do it in. */
  days: number;
  /** A multiplier on the founding treasury. */
  funds?: number;
  /** Disasters, if the scenario insists; absent, the player's choice stands. */
  disasters?: DisasterLevel;
  objectives: readonly Objective[];
}

const pop = (n: number): Objective => ({ title: `${n.toLocaleString()} residents`, progress: (s) => [s.people.population, n] });
const happy = (x: number): Objective => ({
  title: `${Math.round(x * 100)}% happiness`, unit: 'share', progress: (s) => [s.people.happiness, x],
});
const project = (id: string, name: string): Objective => ({
  title: name, progress: (_s, w) => [w.council.finished.includes(id) ? 1 : 0, 1],
});

export const SCENARIOS: readonly ScenarioDef[] = [
  {
    id: 'boomtown', name: 'Boomtown',
    blurb: 'Word is out and everybody is coming. Reach twelve thousand residents in three years, and keep them happy enough to stay.',
    days: DAYS_PER_YEAR * 3,
    objectives: [pop(12000), happy(0.6)],
  },
  {
    id: 'tourist', name: 'Tourist Trap',
    blurb: 'The region wants a destination. Draw fifteen hundred visitors a day within four years: something to see, somewhere to stay, and a way to get here.',
    days: DAYS_PER_YEAR * 4,
    objectives: [
      { title: '1,500 visitors a day', progress: (s) => [s.economy.tourism.visitors, 1500] },
      { title: '1,000 hotel beds', progress: (s) => [s.economy.tourism.beds, 1000] },
      pop(6000),
    ],
  },
  {
    id: 'floodplain', name: 'Floodplain',
    blurb: 'A river town where the water comes over the banks most years. Grow to five thousand and get the flood defences built before the river decides for you.',
    days: DAYS_PER_YEAR * 3,
    disasters: 'often',
    objectives: [pop(5000), project('floodDefences', 'River Flood Defences built'), project('emergencyPlan', 'City Emergency Plan in place')],
  },
  {
    id: 'shoestring', name: 'Shoestring',
    blurb: 'Founded on a third of the usual treasury. Reach four thousand residents and a million in the bank, without the overdraft to lean on for long.',
    days: DAYS_PER_YEAR * 3,
    funds: 0.35,
    objectives: [pop(4000), { title: '1M in the bank', unit: 'money', progress: (_s, w) => [w.budget.balance, 1e6] }],
  },
  {
    id: 'green', name: 'Green City',
    blurb: 'A city that breathes. Eight thousand residents, seventy per cent of them happy, on a renewable grid and a clean river.',
    days: DAYS_PER_YEAR * 5,
    objectives: [pop(8000), happy(0.7), project('renewables', 'Renewable Grid built'), project('cleanRiver', 'Clean River Programme done')],
  },
  {
    id: 'metropolis', name: 'Metropolis',
    blurb: 'The big one. Forty thousand residents in eight years, with disasters as they come.',
    days: DAYS_PER_YEAR * 8,
    disasters: 'normal',
    objectives: [pop(40000), happy(0.55)],
  },
];

export function scenarioById(id: string): ScenarioDef | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

/** Where a city's scenario stands. Saved with the world. */
export interface ScenarioState {
  id: string;
  /** Game day it was founded on, and the one it ends on. */
  from: number;
  until: number;
  status: 'running' | 'won' | 'lost';
  /** Which objectives have been met, by index: they stay met once they are. */
  met: boolean[];
  /** Day it was won or lost. */
  endedOn?: number;
}

export function startScenario(def: ScenarioDef, day: number): ScenarioState {
  return { id: def.id, from: day, until: day + def.days, status: 'running', met: def.objectives.map(() => false) };
}

export interface ScenarioNews {
  /** Objectives met on this look, by title. */
  met: string[];
  ended?: 'won' | 'lost';
}

/**
 * Reads the city against the scenario, once a look.
 *
 * An objective, once met, stays met: a scenario that asks for 70% happiness
 * and a population that dips below it the week after is still a scenario the
 * player finished, provided they had it at the same time as the rest. So the
 * win is checked on the current readings, all at once, and the ticks are a
 * record of progress.
 */
export function checkScenario(state: ScenarioState, sim: Simulation, world: World, day: number): ScenarioNews | null {
  if (state.status !== 'running') return null;
  const def = scenarioById(state.id);
  if (def === undefined) return null;
  const now = def.objectives.map((o) => { const [have, need] = o.progress(sim, world); return have >= need; });
  const met: string[] = [];
  now.forEach((ok, i) => { if (ok && !state.met[i]) { state.met[i] = true; met.push(def.objectives[i].title); } });
  if (now.every((x) => x)) {
    state.status = 'won';
    state.endedOn = day;
    return { met, ended: 'won' };
  }
  if (day >= state.until) {
    state.status = 'lost';
    state.endedOn = day;
    return { met, ended: 'lost' };
  }
  return met.length > 0 ? { met } : null;
}

export function restoreScenario(raw: unknown): ScenarioState | null {
  if (raw === null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const def = typeof o.id === 'string' ? scenarioById(o.id) : undefined;
  if (def === undefined || typeof o.from !== 'number' || typeof o.until !== 'number') return null;
  const status = o.status === 'won' || o.status === 'lost' ? o.status : 'running';
  const met = def.objectives.map((_, i) => Array.isArray(o.met) && o.met[i] === true);
  return { id: def.id, from: o.from, until: o.until, status, met, ...(typeof o.endedOn === 'number' ? { endedOn: o.endedOn } : {}) };
}
