/**
 * Mods: named changes to the rules a city is played under.
 *
 * A mod is data, never code. It multiplies the numbers the game already
 * balances against -- what things cost to build and to run, what taxes bring
 * in, how fast people arrive, how fast the career climbs, the starting
 * treasury -- and it may open everything from the start. That is enough to
 * make a sandbox, a speedrun or a punishing economy, and it is safe to paste
 * one in from anywhere: a mod file that is anything but these numbers is
 * refused, and every number is clamped to a range the simulation can carry.
 *
 * Which mods are on is kept in this browser, across cities. They are applied
 * when a city is founded or loaded -- to the rules through `useDifficulty`,
 * and to the world (land and unlocks) through `applyWorldMods` -- so turning
 * one on or off takes effect the next time a city opens.
 */

import type { Rules } from './difficulty';
import { setRulesModifier } from './difficulty';
import { TECH } from './tech';
import { ASSETS } from '../assets/registry';
import { PLOTS } from './plots';
import type { World } from './world';

/** The multipliers a mod may set. Each defaults to 1. */
export const MOD_KNOBS = ['funds', 'build', 'upkeep', 'income', 'growth', 'xp'] as const;
export type ModKnob = typeof MOD_KNOBS[number];

export const KNOB_LABEL: Record<ModKnob, string> = {
  funds: 'Starting treasury', build: 'Construction costs', upkeep: 'Running costs',
  income: 'Tax income', growth: 'Arrivals', xp: 'Experience',
};
/** How far a mod may push each knob. */
const KNOB_RANGE: Record<ModKnob, [number, number]> = {
  funds: [0.1, 100], build: [0.05, 5], upkeep: [0.05, 5], income: [0.1, 5], growth: [0.25, 4], xp: [0.1, 10],
};

export interface ModDef {
  id: string;
  name: string;
  author: string;
  description: string;
  effects: Partial<Record<ModKnob, number>>;
  /** Every level, building and landmark open, and all the land bought. */
  unlockAll?: boolean;
  builtin?: boolean;
}

export const BUILTIN_MODS: readonly ModDef[] = [
  { id: 'tycoon', name: 'Tycoon', author: 'Arcus', builtin: true,
    description: 'Found every city with ten times the treasury.', effects: { funds: 10 } },
  { id: 'public-works', name: 'Public Works', author: 'Arcus', builtin: true,
    description: 'Half-price construction for roads, zones, services and landmarks.', effects: { build: 0.5 } },
  { id: 'lean', name: 'Lean Government', author: 'Arcus', builtin: true,
    description: 'Services and roads cost 40% less to run.', effects: { upkeep: 0.6 } },
  { id: 'boom', name: 'Boom Economy', author: 'Arcus', builtin: true,
    description: 'Taxes bring in half as much again.', effects: { income: 1.5 } },
  { id: 'boomtown', name: 'Boomtown', author: 'Arcus', builtin: true,
    description: 'Twice as many people want to move in.', effects: { growth: 2 } },
  { id: 'fast-track', name: 'Fast Track', author: 'Arcus', builtin: true,
    description: 'Level up two and a half times as fast.', effects: { xp: 2.5 } },
  { id: 'master-planner', name: 'Master Planner', author: 'Arcus', builtin: true,
    description: 'Every level, building and landmark open from the first day, and all the land yours.',
    effects: {}, unlockAll: true },
  { id: 'austerity', name: 'Austerity', author: 'Arcus', builtin: true,
    description: 'A hard economy: taxes down a quarter, running costs up a quarter, 30% more experience for the trouble.',
    effects: { income: 0.75, upkeep: 1.25, xp: 1.3 } },
];

/** Mods to try from the Browse tab: added to the player's own list, then theirs to edit. */
export const PRESET_MODS: readonly ModDef[] = [
  { id: 'preset-sandbox', name: 'Sandbox', author: 'Arcus', description: 'Money is no object and everything is open. Build for the look of it.',
    effects: { funds: 100, build: 0.1, upkeep: 0.2 }, unlockAll: true },
  { id: 'preset-iron-mayor', name: 'Iron Mayor', author: 'Arcus', description: 'Thin taxes, heavy bills, slow arrivals. Every service has to earn its keep.',
    effects: { income: 0.6, upkeep: 1.5, growth: 0.8, xp: 1.5 } },
  { id: 'preset-speedrun', name: 'Speedrun', author: 'Arcus', description: 'Levels four times as fast and people arriving in crowds.',
    effects: { xp: 4, growth: 1.5 } },
  { id: 'preset-gilded-age', name: 'Gilded Age', author: 'Arcus', description: 'Double the takings and double the bills: big numbers, same knife edge.',
    effects: { income: 2, upkeep: 2, build: 1.5 } },
  { id: 'preset-frontier', name: 'Frontier Town', author: 'Arcus', description: 'A shoestring start and cheap land to build on.',
    effects: { funds: 0.4, build: 0.6, growth: 1.25 } },
];

const KEY = 'civitas.mods.v1';
const MAX_CUSTOM = 24;

interface Stored { enabled: string[]; custom: ModDef[] }

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return { enabled: [], custom: [] };
    const v = JSON.parse(raw) as Partial<Stored>;
    const custom = Array.isArray(v.custom)
      ? v.custom.map((m) => validate(m)).filter((m): m is ModDef => typeof m !== 'string') : [];
    const enabled = Array.isArray(v.enabled) ? v.enabled.filter((x): x is string => typeof x === 'string') : [];
    return { enabled, custom: custom.slice(0, MAX_CUSTOM) };
  } catch {
    return { enabled: [], custom: [] };
  }
}

function write(s: Stored): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private window: mods last the session */ }
}

let state: Stored = read();

/** Every mod the player has: the built-in ones, then their own. */
export function allMods(): ModDef[] { return [...BUILTIN_MODS, ...state.custom]; }
export function isEnabled(id: string): boolean { return state.enabled.includes(id); }
export function enabledMods(): ModDef[] { return allMods().filter((m) => isEnabled(m.id)); }

export function setEnabled(id: string, on: boolean): void {
  const has = state.enabled.includes(id);
  if (on && !has) state.enabled.push(id);
  if (!on && has) state.enabled = state.enabled.filter((x) => x !== id);
  write(state);
}

/** Adds (or replaces, by id) one of the player's own mods. Returns an error, or null. */
export function saveCustom(mod: ModDef): string | null {
  const v = validate(mod);
  if (typeof v === 'string') return v;
  if (BUILTIN_MODS.some((b) => b.id === v.id)) return 'That id belongs to a built-in mod.';
  const at = state.custom.findIndex((m) => m.id === v.id);
  if (at >= 0) state.custom[at] = v;
  else {
    if (state.custom.length >= MAX_CUSTOM) return `You can keep up to ${MAX_CUSTOM} mods of your own.`;
    state.custom.push(v);
  }
  write(state);
  return null;
}

export function removeCustom(id: string): void {
  state.custom = state.custom.filter((m) => m.id !== id);
  state.enabled = state.enabled.filter((x) => x !== id);
  write(state);
}

/** A mod file as text, to copy and share. */
export function exportMod(m: ModDef): string {
  const out: Record<string, unknown> = { name: m.name, author: m.author, description: m.description, effects: m.effects };
  if (m.unlockAll) out.unlockAll = true;
  return JSON.stringify(out, null, 2);
}

/** Reads a mod file. Returns the mod, or what is wrong with it. */
export function importMod(text: string): ModDef | string {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return 'That is not a mod file: it is not valid JSON.'; }
  if (raw === null || typeof raw !== 'object') return 'A mod file is a JSON object.';
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name : '';
  return validate({ ...o, id: typeof o.id === 'string' ? o.id : slug(name) } as unknown as ModDef);
}

function slug(name: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
  return `custom-${s || 'mod'}`;
}

/** Cleans a mod down to exactly what the game will apply, or says why it cannot. */
function validate(m: unknown): ModDef | string {
  if (m === null || typeof m !== 'object') return 'A mod is an object.';
  const o = m as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name.trim().slice(0, 40) : '';
  if (name === '') return 'A mod needs a name.';
  const id = typeof o.id === 'string' && /^[a-z0-9-]{1,48}$/.test(o.id) ? o.id : slug(name);
  const effects: Partial<Record<ModKnob, number>> = {};
  const e = (o.effects ?? {}) as Record<string, unknown>;
  if (typeof e !== 'object') return 'A mod\'s effects are an object of multipliers.';
  for (const k of MOD_KNOBS) {
    const v = e[k];
    if (v === undefined) continue;
    if (typeof v !== 'number' || !Number.isFinite(v)) return `The ${k} multiplier must be a number.`;
    const [lo, hi] = KNOB_RANGE[k];
    effects[k] = Math.max(lo, Math.min(hi, v));
  }
  const unlockAll = o.unlockAll === true;
  if (Object.keys(effects).length === 0 && !unlockAll) return 'A mod has to change something.';
  return {
    id, name,
    author: typeof o.author === 'string' && o.author.trim() !== '' ? o.author.trim().slice(0, 32) : 'You',
    description: typeof o.description === 'string' ? o.description.trim().slice(0, 200) : '',
    effects, ...(unlockAll ? { unlockAll: true } : {}),
  };
}

/** The product of every enabled mod's multiplier for one knob. */
export function knob(k: ModKnob): number {
  let v = 1;
  for (const m of enabledMods()) v *= m.effects[k] ?? 1;
  const [lo, hi] = KNOB_RANGE[k];
  return Math.max(lo * lo, Math.min(hi * hi, v));
}

/** Whether any enabled mod opens everything. */
export function unlockAll(): boolean { return enabledMods().some((m) => m.unlockAll === true); }

/** What the enabled mods do to a world as it opens: the land and the unlocks. */
export function applyWorldMods(world: World): void {
  if (!unlockAll()) return;
  for (let i = 0; i < PLOTS * PLOTS; i++) world.land.take(i);
  world.progress.openEverything(TECH.map((n) => n.id),
    ASSETS.filter((a) => a.signature === true).map((a) => a.id));
}

// The rules pass through here whenever a city is founded or loaded.
setRulesModifier((r: Rules) => {
  r.funds *= knob('funds');
  r.build *= knob('build');
  r.upkeep *= knob('upkeep');
  r.income *= knob('income');
  r.growth *= knob('growth');
  r.xp *= knob('xp');
});

/** Re-reads the stored mods: for another tab having changed them. */
export function reloadMods(): void { state = read(); }
