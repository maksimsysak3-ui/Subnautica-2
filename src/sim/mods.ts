/**
 * Mods: things the game does not have until a mod brings them.
 *
 * Three kinds. A pack adds hand-made buildings the base game has none of --
 * the Wonders. A buildings mod adds towers drawn in the Blueprint Studio: a
 * handful of numbers (plan, storeys, taper, twist, facade, crown) that the
 * blueprint generator turns into a full model, so a mod file is small, safe
 * to paste in from anywhere and still makes something nobody else has. A tool
 * adds a way of playing: Photo Mode, Sky Control.
 *
 * A mod is data, never code. A blueprint that is anything but its known
 * fields is cleaned down to them, and every number is clamped to a range the
 * generator can build.
 *
 * Which mods are on is kept in this browser. The buildings join the asset
 * library as it loads -- the renderer builds its geometry from that list once
 * -- so switching a building mod on or off takes a reload, which the Mods
 * screen offers. A city holding a mod building whose mod is off keeps the lot
 * and draws nothing on it, and draws it again when the mod comes back.
 *
 * This module must not import the registry: the registry imports it.
 */

import type { AssetDef } from '../assets/types';
import { MAT, TINT } from '../assets/mesh';
import { WONDERS } from '../assets/generators/wonders';
import { MONUMENTS } from '../assets/generators/monuments';
import { housingFor } from '../assets/generators/housing';
import { tradeFor } from '../assets/generators/trade';
import { THEMES, REGION_THEMES, type RegionTheme } from '../assets/themes';
import { blueprintAsset, cleanBlueprint, type Blueprint, type Section } from '../assets/generators/blueprint';

export type ModKind = 'pack' | 'buildings' | 'tool';
export type ModTool = 'photo' | 'sky' | 'timelapse';

export interface ModDef {
  id: string;
  name: string;
  author: string;
  description: string;
  kind: ModKind;
  builtin?: boolean;
  /** A buildings mod's towers. */
  buildings?: Blueprint[];
  /** A tool mod's tool. */
  tool?: ModTool;
}

/** Up to this many towers in one mod, and this many mods of the player's own. */
export const MAX_BUILDINGS = 8;
const MAX_CUSTOM = 24;

const bp = (b: Omit<Partial<Blueprint>, 'sections'> & { sections?: Partial<Section>[] }): Blueprint => cleanBlueprint(b);

/** The Skyline Kit's towers, and the blueprints the Browse tab offers. */
const SKYLINE_KIT: Blueprint[] = [
  bp({ name: 'Helix One', zone: 'office', width: 7, depth: 7, floors: 64, shape: 'rounded', taper: 0.72,
    twist: 1.2, facade: 'glass', colour: '#5fb8d8', crown: 'raked', podium: 3, bands: 16, lit: true }),
  bp({ name: 'Brass Needle', zone: 'office', width: 6, depth: 6, floors: 78, shape: 'chamfered', taper: 0.5,
    twist: 0, facade: 'frame', colour: '#c9a45c', crown: 'spire', podium: 4, bands: 12, lit: true }),
  bp({ name: 'Garden Terraces', zone: 'residential', width: 8, depth: 7, floors: 32, shape: 'box', taper: 0.85,
    twist: 0.25, facade: 'concrete', colour: '#7fae6a', crown: 'garden', podium: 2, balconies: true, bands: 8, lit: false }),
  bp({ name: 'Old Exchange', zone: 'commercial', width: 9, depth: 8, floors: 14, floorHeight: 4.6, shape: 'box',
    taper: 1, twist: 0, facade: 'stone', colour: '#b58a4a', crown: 'dome', podium: 3, bands: 0, lit: true }),
  bp({ name: 'Red Row Lofts', zone: 'residential', width: 8, depth: 5, floors: 12, shape: 'box', taper: 1,
    twist: 0, facade: 'brick', colour: '#3c4a5c', crown: 'stepped', podium: 1, balconies: true, bands: 0, lit: false }),
  bp({ name: 'Prism Hall', zone: 'commercial', width: 9, depth: 9, floors: 22, shape: 'triangle', taper: 0.8,
    twist: 0.5, facade: 'glass', colour: '#d86fb5', crown: 'lantern', podium: 3, bands: 6, lit: true }),
];

export const BUILTIN_MODS: readonly ModDef[] = [
  { id: 'wonders', name: 'Wonders of the World', author: 'Arcus', builtin: true, kind: 'pack',
    description: 'An arena of three arcaded tiers, a stepped sun pyramid, a wrought-iron lattice tower and a ninety-metre observation wheel. In the Landmarks drawer under Mods.' },
  { id: 'monuments', name: 'Grand Monuments', author: 'Arcus', builtin: true, kind: 'pack',
    description: 'A triumphal arch, a red-and-white lighthouse, a five-tier pagoda, a domed observatory and an old windmill.' },
  { id: 'skyline-kit', name: 'Skyline Kit', author: 'Arcus', builtin: true, kind: 'buildings', buildings: SKYLINE_KIT,
    description: 'Six blueprint towers: a twisting glass helix, a brass needle, garden terraces, a domed exchange, brick lofts and a triangular prism hall.' },
  { id: 'photo-mode', name: 'Photo Mode', author: 'Arcus', builtin: true, kind: 'tool', tool: 'photo',
    description: 'Hides the interface, frames the city in a letterbox and slowly circles the camera. A button in the corner of the city; Escape to leave.' },
  { id: 'sky-control', name: 'Sky Control', author: 'Arcus', builtin: true, kind: 'tool', tool: 'sky',
    description: 'Set the hour and the weather by hand: hold the city at golden hour, or bring in a storm.' },
  { id: 'timelapse', name: 'Time-lapse', author: 'Arcus', builtin: true, kind: 'tool', tool: 'timelapse',
    description: 'Runs the sky forty times as fast while the city keeps its own pace: dawn to dusk to dawn in under a minute.' },
];

/**
 * The paint a region's plaster walls come in, where it has one. South America
 * in strong warm colours and the odd blue; the Mediterranean mostly whitewash
 * with pastels. The other regions build in their own materials.
 */
const PAINTED: Partial<Record<RegionTheme, [number, number, number][]>> = {
  latin: [[0.78, 0.36, 0.26], [0.86, 0.66, 0.24], [0.26, 0.50, 0.64], [0.40, 0.62, 0.40],
    [0.80, 0.46, 0.52], [0.90, 0.80, 0.52], [0.56, 0.34, 0.56], [0.92, 0.88, 0.80]],
  mediterranean: [[0.90, 0.89, 0.85], [0.88, 0.85, 0.78], [0.92, 0.82, 0.64], [0.82, 0.86, 0.90],
    [0.90, 0.89, 0.85], [0.86, 0.74, 0.62]],
};

/** What each region pack says about itself. */
const REGION_BLURB: Record<RegionTheme, string> = {
  russian: 'Prefabricated panel blocks with glazed-in balconies, carved-shutter wooden houses under tin roofs, and works to match.',
  latin: 'Painted render and flat roof terraces, tall windows behind iron grilles, a shop at the foot of every block.',
  mediterranean: 'Whitewash under terracotta hipped roofs, green shutters and iron balconies over narrow streets.',
  nordic: 'Timber boarding on stone footings, steep dark roofs, big plain windows and loggias cut into the blocks.',
  arabian: 'Sand-coloured render and stone, parapeted flat roofs, screened windows and deep shaded balconies.',
};

/**
 * Region packs: a whole regional style for every zone -- homes at all three
 * densities, shops, offices and works -- grown by the city like any other
 * stock. Pick the style in the zoning drawer once the pack is on.
 */
export const REGION_PACKS: readonly ModDef[] = REGION_THEMES.map((t) => ({
  id: `region-${t}`, name: `${THEMES[t].label} Region`, author: 'Arcus', builtin: true, kind: 'pack' as const,
  description: `${REGION_BLURB[t]} Zone in the ${THEMES[t].label} style from the zoning drawer.`,
}));

const regionCache = new Map<string, AssetDef[]>();

/** The buildings a pack mod carries. */
export function packAssets(id: string): AssetDef[] {
  if (id === 'wonders') return WONDERS;
  if (id === 'monuments') return MONUMENTS;
  const theme = REGION_THEMES.find((t) => id === `region-${t}`);
  if (theme === undefined) return [];
  let hit = regionCache.get(id);
  if (hit === undefined) {
    const paints = PAINTED[theme];
    hit = [...housingFor(theme), ...tradeFor(theme)].map((d, i): AssetDef => {
      if (paints === undefined || d.brand !== undefined) return { ...d, mod: id };
      // Painted render: each building its own colour from the region's
      // palette, on its plaster walls only -- windows, roofs and trim keep
      // their own materials.
      const colour = paints[(i * 7 + d.id.length) % paints.length];
      const build = d.build;
      return {
        ...d, mod: id,
        brand: { name: d.name, colour, accent: [0.92, 0.90, 0.86], sign: 'none' },
        build: (lod: number) => {
          const m = build(lod);
          m.retint(MAT.PLASTER, TINT.BRAND);
          return m;
        },
      };
    });
    regionCache.set(id, hit);
  }
  return hit;
}

/** Blueprints to try from the Browse tab: each one becomes a mod of the player's own, theirs to edit. */
export const PRESET_BLUEPRINTS: readonly Blueprint[] = [
  ...SKYLINE_KIT,
  bp({ name: 'Obsidian Spire', zone: 'office', width: 6, depth: 6, floors: 90, shape: 'round', taper: 0.45,
    twist: 0, facade: 'frame', colour: '#2a2f38', crown: 'spire', podium: 5, bands: 18, lit: true }),
  bp({ name: 'Coral Twist', zone: 'residential', width: 6, depth: 6, floors: 48, shape: 'round', taper: 0.9,
    twist: 1.6, facade: 'concrete', colour: '#e07a5f', crown: 'flat', podium: 2, balconies: true, bands: 0, lit: false }),
  bp({ name: 'Twin Gates', zone: 'office', width: 10, depth: 6, layout: 'twin', floors: 58, shape: 'chamfered', taper: 0.85,
    twist: 0, facade: 'glass', colour: '#7fb6d9', accent: '#d9e4ec', crown: 'antenna', podium: 3, podiumStyle: 'arcade', fins: true, bands: 14, lit: true }),
  bp({ name: 'Wedding Cake', zone: 'office', width: 9, depth: 9, floors: 30, floorHeight: 4, shape: 'box', taper: 1, twist: 0,
    facade: 'stone', colour: '#d4b27a', accent: '#b8893e', crown: 'spire', podium: 2, podiumStyle: 'stone', bands: 0, lit: true,
    sections: [{ floors: 16, shape: 'box', scale: 0.78, taper: 1, facade: 'stone' }, { floors: 12, shape: 'box', scale: 0.72, taper: 1, facade: 'stone' },
      { floors: 8, shape: 'chamfered', scale: 0.7, taper: 0.9, facade: 'stone' }] }),
  bp({ name: 'Stacked Boxes', zone: 'residential', width: 8, depth: 8, floors: 14, shape: 'box', taper: 1, twist: 0, facade: 'concrete',
    colour: '#e0a458', accent: '#4f6d7a', crown: 'garden', podium: 1, podiumStyle: 'shops', balconies: true, bands: 0, lit: false,
    sections: [{ floors: 10, shape: 'box', scale: 0.8, twist: 0.4, facade: 'glass', shiftX: 0.8 },
      { floors: 10, shape: 'box', scale: 0.85, twist: -0.3, facade: 'concrete', shiftX: -0.8, balconies: true }] }),
  bp({ name: 'Trinity Place', zone: 'office', width: 12, depth: 7, layout: 'trio', floors: 70, shape: 'round', taper: 0.7, twist: 0.4,
    facade: 'frame', colour: '#c9a45c', accent: '#f4e3b5', crown: 'halo', podium: 4, podiumStyle: 'glass', bands: 10, lit: true }),
  bp({ name: 'Harbour Loft', zone: 'residential', width: 7, depth: 5, floors: 7, floorHeight: 3.4, shape: 'box', taper: 1, twist: 0,
    facade: 'brick', colour: '#8a3b2b', accent: '#2f3e46', crown: 'pitched', podium: 1, podiumStyle: 'shops', balconies: true, bands: 0, lit: false }),
  bp({ name: 'Civic Rotunda', zone: 'commercial', width: 10, depth: 10, floors: 8, floorHeight: 5, shape: 'round',
    taper: 1, twist: 0, facade: 'stone', colour: '#6f8fa8', crown: 'dome', podium: 2, bands: 0, lit: true }),
];

const KEY = 'civitas.mods.v2';

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

/**
 * What was switched on when the page loaded: what the asset library actually
 * holds. The Mods screen compares against it to say a reload is due.
 */
const loaded = new Set(state.enabled);
/** Mods whose buildings were edited since the page loaded. */
const edited = new Set<string>();

/** Every mod the player has: the built-in ones, then their own. */
export function allMods(): ModDef[] { return [...BUILTIN_MODS, ...REGION_PACKS, ...state.custom]; }
export function isEnabled(id: string): boolean { return state.enabled.includes(id); }
export function enabledMods(): ModDef[] { return allMods().filter((m) => isEnabled(m.id)); }

export function setEnabled(id: string, on: boolean): void {
  const has = state.enabled.includes(id);
  if (on && !has) state.enabled.push(id);
  if (!on && has) state.enabled = state.enabled.filter((x) => x !== id);
  write(state);
}

/** Whether a mod that adds buildings has changed since the page loaded. */
export function reloadNeeded(): boolean {
  for (const m of allMods()) {
    if (m.kind === 'tool') continue;
    if (isEnabled(m.id) !== loaded.has(m.id)) return true;
    if (isEnabled(m.id) && edited.has(m.id)) return true;
  }
  return false;
}

/** Adds (or replaces, by id) one of the player's own mods. Returns an error, or null. */
export function saveCustom(mod: ModDef): string | null {
  const v = validate(mod);
  if (typeof v === 'string') return v;
  if (BUILTIN_MODS.some((b) => b.id === v.id) || REGION_PACKS.some((b) => b.id === v.id)) return 'That id belongs to a built-in mod.';
  const at = state.custom.findIndex((m) => m.id === v.id);
  if (at >= 0) {
    state.custom[at] = v;
    edited.add(v.id);
  } else {
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

/** A free id for a new mod named `name`. */
export function freshId(name: string): string {
  const base = slug(name);
  const taken = new Set(allMods().map((m) => m.id));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** A mod file as text, to copy and share. */
export function exportMod(m: ModDef): string {
  return JSON.stringify({ name: m.name, author: m.author, description: m.description, buildings: m.buildings ?? [] }, null, 2);
}

/** Reads a mod file. Returns the mod, or what is wrong with it. */
export function importMod(text: string): ModDef | string {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return 'That is not a mod file: it is not valid JSON.'; }
  if (raw === null || typeof raw !== 'object') return 'A mod file is a JSON object.';
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name : '';
  return validate({ ...o, kind: 'buildings', id: freshId(name) });
}

function slug(name: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
  return `custom-${s || 'mod'}`;
}

/**
 * Cleans one of the player's mods down to exactly what the game will build,
 * or says why it cannot. Only buildings mods can be the player's own: packs
 * and tools are code, and code does not come in through a text box.
 */
function validate(m: unknown): ModDef | string {
  if (m === null || typeof m !== 'object') return 'A mod is an object.';
  const o = m as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name.trim().slice(0, 40) : '';
  if (name === '') return 'A mod needs a name.';
  if (!Array.isArray(o.buildings) || o.buildings.length === 0) return 'A mod needs at least one building.';
  if (o.buildings.some((b) => b === null || typeof b !== 'object')) return 'Each building is a blueprint object.';
  const buildings = o.buildings.slice(0, MAX_BUILDINGS).map((b) => cleanBlueprint(b));
  const id = typeof o.id === 'string' && /^custom-[a-z0-9-]{1,48}$/.test(o.id) ? o.id : slug(name);
  return {
    id, name, kind: 'buildings', buildings,
    author: typeof o.author === 'string' && o.author.trim() !== '' ? o.author.trim().slice(0, 32) : 'You',
    description: typeof o.description === 'string' ? o.description.trim().slice(0, 200) : '',
  };
}

/** The buildings every enabled mod adds, for the asset library. */
export function modAssets(): AssetDef[] {
  const out: AssetDef[] = [];
  for (const m of enabledMods()) {
    if (m.kind === 'pack') out.push(...packAssets(m.id));
    if (m.kind === 'buildings') {
      (m.buildings ?? []).forEach((b, i) => out.push(blueprintAsset(b, m.id, `b${i}`)));
    }
  }
  return out;
}

/** Whether a tool mod is on. */
export function toolOn(tool: ModTool): boolean {
  return enabledMods().some((m) => m.kind === 'tool' && m.tool === tool);
}

/** Re-reads the stored mods: for another tab having changed them. */
export function reloadMods(): void { state = read(); }
