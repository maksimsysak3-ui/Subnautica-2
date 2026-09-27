/**
 * Blueprint buildings: the everyday architecture of a city, designed by the
 * player.
 *
 * The tower blueprints make skyscrapers. This makes everything else a street
 * is built of -- a detached house, a terrace, a block of flats, a corner shop,
 * a warehouse, a works, a civic hall -- from choices a builder would recognise:
 * the plan (a plain block, an L, a U, a T, a courtyard), the storeys, the walls
 * (brick, render, stone, timber boarding, concrete, sheet metal, glass), the
 * windows (sash, casement, arched, ribbon, industrial, shopfront), the roof
 * (gable, hip, mansard, gambrel, lean-to, sawtooth, flat) and the details
 * (dormers, chimneys, a porch, shutters, balconies, awnings, loading docks, a
 * cornice, a front garden).
 *
 * Fourteen themes set all of it at once -- Victorian, Georgian, Parisian,
 * Dutch, Art Deco, Brutalist, Soviet, Modernist, Mediterranean, Scandinavian,
 * Craftsman, Colonial, Japanese, Industrial -- and the generator rolls a new
 * building inside a theme, so a player can design one by hand, start from a
 * style, or ask for a street's worth.
 *
 * Data, cleaned to what can be built, like the towers: a mod carries it as
 * JSON and nothing in it can make a mesh the renderer cannot draw.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { Material } from '../mesh';
import { chimneyStack, entrance, parapet, roofClutter } from '../parts';
import type { Wall } from '../parts';

export const BB_TYPES = ['house', 'townhouses', 'apartments', 'shop', 'warehouse', 'factory', 'civic'] as const;
export const BB_PLANS = ['rect', 'L', 'U', 'T', 'courtyard'] as const;
export const BB_ROOFS = ['gable', 'hip', 'mansard', 'gambrel', 'shed', 'sawtooth', 'flat'] as const;
export const BB_WALLS = ['brick', 'render', 'stone', 'timber', 'concrete', 'metal', 'glass'] as const;
export const BB_WINDOWS = ['sash', 'casement', 'arched', 'ribbon', 'industrial', 'shopfront'] as const;
export const BB_THEMES = ['victorian', 'georgian', 'parisian', 'dutch', 'artdeco', 'brutalist', 'soviet',
  'modernist', 'mediterranean', 'scandinavian', 'craftsman', 'colonial', 'japanese', 'industrial',
  'tudor', 'cottage', 'brownstone', 'chicago', 'ranch', 'alpine', 'adobe', 'suburban'] as const;

export type BuildingType = typeof BB_TYPES[number];
export type BuildingTheme = typeof BB_THEMES[number];

export interface BuildingPlan {
  type: BuildingType;
  plan: typeof BB_PLANS[number];
  storeys: number;
  floorHeight: number;
  roof: typeof BB_ROOFS[number];
  /** Roof rise as a share of the span it covers: 0.15 shallow to 0.9 steep. */
  pitch: number;
  walls: typeof BB_WALLS[number];
  windows: typeof BB_WINDOWS[number];
  /** #rrggbb: painted walls (render, timber, metal), shutters' contrast. */
  wallColour: string;
  /** #rrggbb: the roof, awnings, shutters, doors. */
  roofColour: string;
  dormers: boolean;
  chimneys: number;
  porch: boolean;
  shutters: boolean;
  balconies: boolean;
  awning: boolean;
  docks: boolean;
  cornice: boolean;
  garden: boolean;
  /** Upper tiers stepping in from the street, 0 to 3: a wedding cake. Six storeys up only. */
  setbacks: number;
  /** Two-storey bay windows on the street front. */
  bays: boolean;
  /** Only a label: which style it was drawn in, for the studio's picker. */
  theme: BuildingTheme | 'custom';
}

export const DEFAULT_BUILDING: BuildingPlan = {
  type: 'townhouses', plan: 'rect', storeys: 3, floorHeight: 3.2, roof: 'gable', pitch: 0.5,
  walls: 'brick', windows: 'sash', wallColour: '#e9dcc4', roofColour: '#4f5560',
  dormers: true, chimneys: 2, porch: true, shutters: false, balconies: false, awning: false,
  docks: false, cornice: true, garden: false, setbacks: 0, bays: false, theme: 'victorian',
};

const clampN = (v: unknown, lo: number, hi: number, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T =>
  (typeof v === 'string' && (list as readonly string[]).includes(v) ? v as T : d);
const hexOr = (v: unknown, d: string): string =>
  typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : d;

export function cleanBuilding(raw: unknown): BuildingPlan {
  const o = (raw !== null && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_BUILDING;
  return {
    type: oneOf(o.type, BB_TYPES, d.type),
    plan: oneOf(o.plan, BB_PLANS, d.plan),
    storeys: Math.round(clampN(o.storeys, 1, 14, d.storeys)),
    floorHeight: clampN(o.floorHeight, 2.8, 6, d.floorHeight),
    roof: oneOf(o.roof, BB_ROOFS, d.roof),
    pitch: clampN(o.pitch, 0.15, 0.9, d.pitch),
    walls: oneOf(o.walls, BB_WALLS, d.walls),
    windows: oneOf(o.windows, BB_WINDOWS, d.windows),
    wallColour: hexOr(o.wallColour, d.wallColour),
    roofColour: hexOr(o.roofColour, d.roofColour),
    dormers: o.dormers === true,
    chimneys: Math.round(clampN(o.chimneys, 0, 4, 0)),
    porch: o.porch === true,
    shutters: o.shutters === true,
    balconies: o.balconies === true,
    awning: o.awning === true,
    docks: o.docks === true,
    cornice: o.cornice === true,
    garden: o.garden === true,
    setbacks: Math.round(clampN(o.setbacks, 0, 3, 0)),
    bays: o.bays === true,
    theme: oneOf(o.theme, [...BB_THEMES, 'custom'] as const, 'custom'),
  };
}

// ---- themes ----------------------------------------------------------------------

interface ThemeSpec {
  label: string;
  types: readonly BuildingType[];
  plans: readonly BuildingPlan['plan'][];
  storeys: [number, number];
  floorHeight: number;
  roofs: readonly BuildingPlan['roof'][];
  pitch: [number, number];
  walls: readonly BuildingPlan['walls'][];
  windows: readonly BuildingPlan['windows'][];
  wallColours: readonly string[];
  roofColours: readonly string[];
  /** Chance of each detail, 0 to 1. */
  dormers: number; chimneys: number; porch: number; shutters: number; balconies: number;
  awning: number; docks: number; cornice: number; garden: number;
  /** Setbacks drawn from this range, for tall buildings; absent, none. */
  setbacks?: [number, number];
  /** Chance of bay windows on a house, terrace or block. */
  bays?: number;
}

export const THEMES: Record<BuildingTheme, ThemeSpec> = {
  victorian: { label: 'Victorian', types: ['house', 'townhouses', 'shop'], plans: ['rect', 'L', 'T'], storeys: [2, 4], floorHeight: 3.3,
    roofs: ['gable', 'hip'], pitch: [0.55, 0.85], walls: ['brick', 'brick', 'render'], windows: ['sash', 'arched'],
    wallColours: ['#e8dcc6', '#d9c7a4', '#c9b79a'], roofColours: ['#4a4f58', '#5b4a44', '#3f454d'],
    dormers: 0.5, chimneys: 0.95, porch: 0.7, shutters: 0.1, balconies: 0.1, awning: 0.3, docks: 0, cornice: 0.5, garden: 0.6, bays: 0.7 },
  georgian: { label: 'Georgian', types: ['townhouses', 'house', 'civic'], plans: ['rect', 'U'], storeys: [3, 4], floorHeight: 3.4,
    roofs: ['hip', 'flat'], pitch: [0.3, 0.45], walls: ['brick', 'render', 'stone'], windows: ['sash'],
    wallColours: ['#efe6d4', '#e6dcc8', '#f2ede2'], roofColours: ['#4a4f58', '#3f454d'],
    dormers: 0.4, chimneys: 0.9, porch: 0.6, shutters: 0, balconies: 0.1, awning: 0, docks: 0, cornice: 0.9, garden: 0.4 },
  parisian: { label: 'Parisian', types: ['apartments', 'shop'], plans: ['rect', 'courtyard', 'L'], storeys: [5, 7], floorHeight: 3.3,
    roofs: ['mansard'], pitch: [0.5, 0.7], walls: ['stone'], windows: ['arched', 'sash'],
    wallColours: ['#e9dfc9', '#efe7d6'], roofColours: ['#5b636e', '#4a525c'],
    dormers: 0.95, chimneys: 0.7, porch: 0, shutters: 0.2, balconies: 0.95, awning: 0.6, docks: 0, cornice: 1, garden: 0 },
  dutch: { label: 'Dutch', types: ['townhouses', 'shop'], plans: ['rect'], storeys: [3, 5], floorHeight: 3.1,
    roofs: ['gable'], pitch: [0.8, 0.9], walls: ['brick'], windows: ['sash'],
    wallColours: ['#ffffff', '#f3efe6'], roofColours: ['#5e3a2e', '#3d3f44'],
    dormers: 0.3, chimneys: 0.5, porch: 0, shutters: 0.3, balconies: 0, awning: 0.3, docks: 0, cornice: 0.3, garden: 0 },
  artdeco: { label: 'Art Deco', types: ['apartments', 'civic', 'shop'], plans: ['rect', 'U', 'T'], storeys: [4, 9], floorHeight: 3.4,
    roofs: ['flat'], pitch: [0.2, 0.3], walls: ['render', 'stone'], windows: ['ribbon', 'sash'],
    wallColours: ['#efe3c7', '#e6d8b5', '#dcd3c2'], roofColours: ['#b8913f', '#2f5e5a', '#8a4b3a'],
    dormers: 0, chimneys: 0, porch: 0.3, shutters: 0, balconies: 0.3, awning: 0.3, docks: 0, cornice: 0.95, garden: 0, setbacks: [1, 3] },
  brutalist: { label: 'Brutalist', types: ['apartments', 'civic'], plans: ['rect', 'L', 'U', 'courtyard'], storeys: [5, 12], floorHeight: 3.2,
    roofs: ['flat'], pitch: [0.2, 0.3], walls: ['concrete'], windows: ['ribbon', 'industrial'],
    wallColours: ['#b5b1a8'], roofColours: ['#6f6c66'],
    dormers: 0, chimneys: 0, porch: 0, shutters: 0, balconies: 0.6, awning: 0, docks: 0, cornice: 0.2, garden: 0, setbacks: [0, 1] },
  soviet: { label: 'Soviet', types: ['apartments'], plans: ['rect', 'L'], storeys: [5, 9], floorHeight: 2.8,
    roofs: ['flat'], pitch: [0.2, 0.3], walls: ['concrete', 'render'], windows: ['casement'],
    wallColours: ['#d8d2c4', '#cfd3d8', '#e3d9c6'], roofColours: ['#6a6660'],
    dormers: 0, chimneys: 0, porch: 0, shutters: 0, balconies: 0.9, awning: 0, docks: 0, cornice: 0, garden: 0.2 },
  modernist: { label: 'Modernist', types: ['house', 'apartments', 'civic'], plans: ['rect', 'L'], storeys: [1, 5], floorHeight: 3.2,
    roofs: ['flat', 'shed'], pitch: [0.15, 0.25], walls: ['render', 'glass', 'concrete'], windows: ['ribbon'],
    wallColours: ['#f4f4f1', '#eceae4'], roofColours: ['#3b3e44', '#7a7f86'],
    dormers: 0, chimneys: 0.1, porch: 0.2, shutters: 0, balconies: 0.4, awning: 0, docks: 0, cornice: 0, garden: 0.6 },
  mediterranean: { label: 'Mediterranean', types: ['house', 'apartments', 'shop'], plans: ['rect', 'L', 'U', 'courtyard'], storeys: [1, 4], floorHeight: 3.1,
    roofs: ['hip', 'gable', 'flat'], pitch: [0.2, 0.35], walls: ['render'], windows: ['casement', 'arched'],
    wallColours: ['#f6f1e6', '#f0dcb4', '#e9c9a0', '#f4e3cf'], roofColours: ['#b5552f', '#c0643a', '#a44b2a'],
    dormers: 0, chimneys: 0.2, porch: 0.3, shutters: 0.9, balconies: 0.7, awning: 0.3, docks: 0, cornice: 0.2, garden: 0.5 },
  scandinavian: { label: 'Scandinavian', types: ['house', 'townhouses'], plans: ['rect', 'L'], storeys: [1, 3], floorHeight: 3.0,
    roofs: ['gable'], pitch: [0.6, 0.85], walls: ['timber'], windows: ['casement'],
    wallColours: ['#8e2f25', '#e0b547', '#f1ede4', '#3e5a6e'], roofColours: ['#2f3236', '#41352f'],
    dormers: 0.3, chimneys: 0.6, porch: 0.5, shutters: 0, balconies: 0.1, awning: 0, docks: 0, cornice: 0, garden: 0.8 },
  craftsman: { label: 'Craftsman', types: ['house'], plans: ['rect', 'L'], storeys: [1, 2], floorHeight: 3.0,
    roofs: ['gable', 'hip'], pitch: [0.3, 0.45], walls: ['timber', 'stone'], windows: ['casement'],
    wallColours: ['#7c8a6a', '#a07b54', '#c9b28a', '#5f6f78'], roofColours: ['#4a3c32', '#3a3a3a'],
    dormers: 0.4, chimneys: 0.8, porch: 0.95, shutters: 0, balconies: 0, awning: 0, docks: 0, cornice: 0, garden: 0.9 },
  colonial: { label: 'Colonial', types: ['house', 'civic'], plans: ['rect', 'T'], storeys: [2, 3], floorHeight: 3.1,
    roofs: ['gable', 'gambrel', 'hip'], pitch: [0.5, 0.7], walls: ['timber', 'brick'], windows: ['sash'],
    wallColours: ['#f5f3ec', '#e8e3d6', '#c8d3d6'], roofColours: ['#3b3f45', '#4a3a33'],
    dormers: 0.7, chimneys: 0.9, porch: 0.8, shutters: 0.9, balconies: 0, awning: 0, docks: 0, cornice: 0.4, garden: 0.8 },
  japanese: { label: 'Japanese', types: ['house', 'shop', 'civic'], plans: ['rect', 'L', 'courtyard'], storeys: [1, 2], floorHeight: 3.0,
    roofs: ['hip', 'gable'], pitch: [0.45, 0.6], walls: ['timber', 'render'], windows: ['casement'],
    wallColours: ['#5b4636', '#efe9dc', '#3e3a36'], roofColours: ['#2e3033', '#3b4a52'],
    dormers: 0, chimneys: 0, porch: 0.7, shutters: 0, balconies: 0.2, awning: 0.2, docks: 0, cornice: 0, garden: 0.9 },
  industrial: { label: 'Industrial', types: ['warehouse', 'factory'], plans: ['rect', 'L', 'T'], storeys: [1, 3], floorHeight: 5,
    roofs: ['sawtooth', 'gable', 'flat'], pitch: [0.2, 0.35], walls: ['brick', 'metal', 'concrete'], windows: ['industrial'],
    wallColours: ['#8b4a38', '#7a8a96', '#a8a49a', '#4c6b5e'], roofColours: ['#5d646c', '#43484f'],
    dormers: 0, chimneys: 0.4, porch: 0, shutters: 0, balconies: 0, awning: 0, docks: 0.9, cornice: 0.2, garden: 0 },
  // Everyday styles: the streets most towns are actually made of.
  tudor: { label: 'Tudor', types: ['house', 'shop', 'townhouses'], plans: ['rect', 'L', 'T'], storeys: [2, 3], floorHeight: 3.0,
    roofs: ['gable'], pitch: [0.8, 0.95], walls: ['render', 'brick'], windows: ['casement'],
    wallColours: ['#f1ead8', '#e9dfc4', '#efe4cc'], roofColours: ['#4a3b33', '#5a463a', '#3d3a38'],
    dormers: 0.5, chimneys: 1, porch: 0.5, shutters: 0, balconies: 0, awning: 0.2, docks: 0, cornice: 0, garden: 0.8, bays: 0.4 },
  cottage: { label: 'English cottage', types: ['house'], plans: ['rect', 'L'], storeys: [1, 2], floorHeight: 2.9,
    roofs: ['gable', 'hip'], pitch: [0.75, 0.95], walls: ['stone', 'render'], windows: ['casement'],
    wallColours: ['#f3eee2', '#e8e0cc', '#dfe3da'], roofColours: ['#5c5347', '#4a4f58', '#7a5a3e'],
    dormers: 0.6, chimneys: 1, porch: 0.6, shutters: 0.2, balconies: 0, awning: 0, docks: 0, cornice: 0, garden: 1 },
  brownstone: { label: 'Brownstone', types: ['townhouses', 'apartments', 'shop'], plans: ['rect'], storeys: [3, 5], floorHeight: 3.4,
    roofs: ['flat'], pitch: [0.2, 0.3], walls: ['render'], windows: ['sash', 'arched'],
    wallColours: ['#6b4232', '#5e3a2c', '#76503c'], roofColours: ['#3a3533', '#2f3a3a'],
    dormers: 0, chimneys: 0.4, porch: 0.9, shutters: 0, balconies: 0, awning: 0.3, docks: 0, cornice: 1, garden: 0.3, bays: 0.5 },
  chicago: { label: 'Chicago school', types: ['apartments', 'civic', 'shop'], plans: ['rect', 'L', 'U'], storeys: [8, 14], floorHeight: 3.6,
    roofs: ['flat'], pitch: [0.2, 0.3], walls: ['brick', 'stone'], windows: ['sash', 'industrial'],
    wallColours: ['#a4644a', '#b88a6a', '#d8cbb2', '#8e5140'], roofColours: ['#3c3a38', '#5a4a3a'],
    dormers: 0, chimneys: 0, porch: 0.3, shutters: 0, balconies: 0, awning: 0.4, docks: 0, cornice: 1, garden: 0, setbacks: [0, 2] },
  ranch: { label: 'Ranch', types: ['house'], plans: ['rect', 'L'], storeys: [1, 1], floorHeight: 2.9,
    roofs: ['hip', 'gable'], pitch: [0.2, 0.32], walls: ['brick', 'timber'], windows: ['casement', 'sash'],
    wallColours: ['#d9cdb8', '#b9c4c9', '#e6dcc9', '#a9b39a'], roofColours: ['#4b4a48', '#5d4d40', '#3e4247'],
    dormers: 0, chimneys: 0.6, porch: 0.5, shutters: 0.5, balconies: 0, awning: 0, docks: 0, cornice: 0, garden: 1 },
  alpine: { label: 'Alpine chalet', types: ['house', 'shop', 'apartments'], plans: ['rect', 'L'], storeys: [2, 4], floorHeight: 3.0,
    roofs: ['gable'], pitch: [0.35, 0.5], walls: ['timber', 'render'], windows: ['casement'],
    wallColours: ['#6b4a32', '#7d5638', '#f3eee4'], roofColours: ['#3b3632', '#4a3d34'],
    dormers: 0, chimneys: 0.6, porch: 0.3, shutters: 0.7, balconies: 0.95, awning: 0.1, docks: 0, cornice: 0, garden: 0.6 },
  adobe: { label: 'Adobe', types: ['house', 'shop', 'civic'], plans: ['rect', 'L', 'U', 'courtyard'], storeys: [1, 2], floorHeight: 3.0,
    roofs: ['flat'], pitch: [0.2, 0.3], walls: ['render'], windows: ['casement', 'arched'],
    wallColours: ['#c98f5e', '#d7a878', '#bf7f55', '#e0b98e'], roofColours: ['#6b4a36', '#2f5e5a', '#7a3f2e'],
    dormers: 0, chimneys: 0.2, porch: 0.6, shutters: 0.2, balconies: 0.2, awning: 0.3, docks: 0, cornice: 0.3, garden: 0.5 },
  suburban: { label: 'Suburban', types: ['house', 'townhouses'], plans: ['rect', 'L'], storeys: [2, 2], floorHeight: 2.9,
    roofs: ['gable', 'hip'], pitch: [0.38, 0.55], walls: ['timber', 'brick'], windows: ['sash', 'casement'],
    wallColours: ['#e8e4da', '#c9d6dc', '#d8d0bc', '#b8c7b0', '#efe3c4'], roofColours: ['#46484b', '#57504a', '#3b4047'],
    dormers: 0.3, chimneys: 0.4, porch: 0.6, shutters: 0.6, balconies: 0, awning: 0, docks: 0, cornice: 0, garden: 1, bays: 0.3 },
};

/** A seeded generator, so the same seed gives the same building. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** What a theme would make: every choice drawn from its lists and chances. */
export function generateBuilding(seed: number, theme?: BuildingTheme, type?: BuildingType): {
  plan: BuildingPlan; width: number; depth: number;
} {
  const r = rng(seed);
  const any = <T>(l: readonly T[]): T => l[Math.floor(r() * l.length) % l.length];
  const th = theme ?? any(BB_THEMES);
  const t = THEMES[th];
  const kind = type ?? any(t.types);
  const chance = (p: number): boolean => r() < p;
  const [s0, s1] = t.storeys;
  let storeys = s0 + Math.floor(r() * (s1 - s0 + 1));
  if (kind === 'house') storeys = Math.min(storeys, 3);
  if (kind === 'warehouse' || kind === 'factory') storeys = Math.min(storeys, 3);
  const industrial = kind === 'warehouse' || kind === 'factory';
  const plan = cleanBuilding({
    type: kind, plan: kind === 'house' || kind === 'townhouses' ? any(t.plans.filter((p) => p !== 'courtyard' && p !== 'U').concat(['rect'])) : any(t.plans),
    storeys, floorHeight: industrial ? 5 : t.floorHeight + (r() - 0.5) * 0.2,
    roof: any(t.roofs), pitch: t.pitch[0] + r() * (t.pitch[1] - t.pitch[0]),
    walls: any(t.walls), windows: kind === 'shop' && r() < 0.8 ? 'shopfront' : any(t.windows),
    wallColour: any(t.wallColours), roofColour: any(t.roofColours),
    dormers: chance(t.dormers), chimneys: chance(t.chimneys) ? 1 + Math.floor(r() * 3) : 0,
    porch: chance(t.porch), shutters: chance(t.shutters), balconies: chance(t.balconies),
    awning: kind === 'shop' ? chance(0.7) : chance(t.awning), docks: industrial && chance(Math.max(0.6, t.docks)),
    cornice: chance(t.cornice), garden: kind === 'house' || kind === 'townhouses' ? chance(t.garden) : false,
    setbacks: t.setbacks !== undefined && storeys >= 6 ? t.setbacks[0] + Math.floor(r() * (t.setbacks[1] - t.setbacks[0] + 1)) : 0,
    bays: (kind === 'house' || kind === 'townhouses' || kind === 'apartments') && chance(t.bays ?? 0),
    theme: th,
  });
  // A lot the type fits: a house is small, a works is big.
  const size: Record<BuildingType, [number, number, number, number]> = {
    house: [2, 3, 3, 4], townhouses: [4, 7, 3, 4], apartments: [4, 8, 4, 7], shop: [2, 4, 3, 4],
    warehouse: [5, 9, 5, 9], factory: [6, 10, 6, 10], civic: [4, 8, 4, 7],
  };
  const [w0, w1, d0, d1] = size[kind];
  return { plan, width: w0 + Math.floor(r() * (w1 - w0 + 1)), depth: d0 + Math.floor(r() * (d1 - d0 + 1)) };
}

/** A theme's look on an existing plan, keeping its type and lot. */
export function applyTheme(p: BuildingPlan, theme: BuildingTheme, seed: number): BuildingPlan {
  const g = generateBuilding(seed, theme, THEMES[theme].types.includes(p.type) ? p.type : undefined);
  return g.plan;
}

// ---- the use it is put to -----------------------------------------------------------

export function zoneOf(type: BuildingType): 'residential' | 'commercial' | 'industrial' | 'office' {
  return type === 'shop' ? 'commercial' : type === 'warehouse' || type === 'factory' ? 'industrial'
    : type === 'civic' ? 'office' : 'residential';
}

type Rect = [number, number, number, number];

/** The wings of the plan, as rectangles in metres from the lot's centre. */
export function wings(p: BuildingPlan, width: number, depth: number): Rect[] {
  const lx = width * 4, lz = depth * 4;
  // A house stands back from the pavement behind its garden; everything else
  // builds to a narrow margin.
  // Room in front for what hangs off the front wall -- a portico, loading
  // docks, an awning, a porch -- and round the sides for balconies, so the
  // whole of the building stays on its lot.
  const reachOut = p.type === 'civic' ? 3.4 : (p.type === 'warehouse' || p.type === 'factory') && p.docks ? 2.8
    : p.type === 'shop' || p.windows === 'shopfront' ? 2.2 : p.porch ? 2.8 : p.balconies ? 1.4 : p.bays ? 1.1 : 0;
  const front = Math.max(p.type === 'house' ? 3.5 : p.garden ? 2.5 : 1.2, 0.4 + reachOut);
  const side = p.balconies ? 2.4 : 1.2;
  const ax = lx - side, z0 = -lz + side, z1 = lz - front;
  const W = ax * 2, D = z1 - z0;
  const bar = (d: number): number => Math.max(6.5, Math.min(12, d));
  switch (p.plan) {
    case 'L': {
      if (W < 16 || D < 16) break;
      const t = bar(D * 0.45), s = bar(W * 0.42);
      return [[-ax, z0, ax, z0 + t], [-ax, z0 + t, -ax + s, z1]];
    }
    case 'U': {
      if (W < 22 || D < 16) break;
      const t = bar(D * 0.4), s = bar(W * 0.3);
      return [[-ax, z0, ax, z0 + t], [-ax, z0 + t, -ax + s, z1], [ax - s, z0 + t, ax, z1]];
    }
    case 'T': {
      if (W < 16 || D < 16) break;
      const t = bar(D * 0.42), s = bar(W * 0.4);
      return [[-ax, z1 - t, ax, z1], [-s / 2, z0, s / 2, z1 - t]];
    }
    case 'courtyard': {
      if (W < 24 || D < 24) break;
      const t = bar(Math.min(W, D) * 0.28);
      return [[-ax, z0, ax, z0 + t], [-ax, z1 - t, ax, z1], [-ax, z0 + t, -ax + t, z1 - t], [ax - t, z0 + t, ax, z1 - t]];
    }
    default: break;
  }
  return [[-ax, z0, ax, z1]];
}

function areaOf(r: Rect): number { return (r[2] - r[0]) * (r[3] - r[1]); }

/** How far each setback steps in, all round. */
const SETBACK = 2.2;

/**
 * A wing in tiers, bottom up: the base to about half the height, then each
 * setback a storey band further in. A tier that would come out narrower than
 * a room stops the stepping, and its floors go to the tier below.
 */
export function tiers(p: BuildingPlan, r: Rect): Array<{ r: Rect; f0: number; f1: number }> {
  const n = p.storeys >= 6 ? p.setbacks : 0;
  if (n === 0) return [{ r, f0: 0, f1: p.storeys }];
  const base = Math.ceil(p.storeys * 0.55);
  const out = [{ r, f0: 0, f1: base }];
  const rest = p.storeys - base;
  for (let k = 1; k <= n; k++) {
    const f0 = base + Math.round(((k - 1) / n) * rest), f1 = base + Math.round((k / n) * rest);
    const d = SETBACK * k;
    const t: Rect = [r[0] + d, r[1] + d, r[2] - d, r[3] - d];
    if (f1 <= f0) continue;
    if (t[2] - t[0] < 6 || t[3] - t[1] < 6) { out[out.length - 1].f1 = p.storeys; break; }
    out.push({ r: t, f0, f1 });
  }
  out[out.length - 1].f1 = p.storeys;
  return out;
}

export function buildingCapacity(p: BuildingPlan, width: number, depth: number): { homes: number; jobs: number; height: number } {
  const rs = wings(p, width, depth);
  const floor = rs.reduce((a, r) => a + tiers(p, r).reduce((b, t) => b + areaOf(t.r) * (t.f1 - t.f0), 0), 0);
  const height = p.storeys * p.floorHeight + roofRise(p, Math.min(...wings(p, width, depth).map((r) => Math.min(r[2] - r[0], r[3] - r[1]))));
  switch (p.type) {
    case 'house': return { homes: 1, jobs: 0, height };
    case 'townhouses': return { homes: Math.max(2, Math.round(width * 8 / 6.5)) * Math.max(1, Math.round(p.storeys / 3)), jobs: 0, height };
    case 'apartments': return { homes: Math.max(2, Math.round(floor / 78)), jobs: 0, height };
    case 'shop': return { homes: 0, jobs: Math.max(2, Math.round(floor / 40)), height };
    case 'warehouse': return { homes: 0, jobs: Math.max(4, Math.round(floor / 110)), height };
    case 'factory': return { homes: 0, jobs: Math.max(6, Math.round(floor / 70)), height };
    default: return { homes: 0, jobs: Math.max(4, Math.round(floor / 36)), height };
  }
}

function roofRise(p: BuildingPlan, span: number): number {
  switch (p.roof) {
    case 'flat': return 1;
    case 'sawtooth': return Math.min(4, span * 0.3);
    case 'shed': return span * p.pitch * 0.5;
    default: return Math.min(14, span * 0.5 * p.pitch);
  }
}

// ---- the mesh ---------------------------------------------------------------------------

type V3 = [number, number, number];

/** A quad wound to face `out`, whatever order its corners came in. */
function face(m: MeshBuilder, a: V3, b: V3, c: V3, d: V3, mat: Material, out: V3): void {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  if (nx * out[0] + ny * out[1] + nz * out[2] >= 0) m.quad(a, b, c, d, mat);
  else m.quad(d, c, b, a, mat);
}

function tri(m: MeshBuilder, a: V3, b: V3, c: V3, mat: Material, out: V3): void {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  if (nx * out[0] + ny * out[1] + nz * out[2] >= 0) m.tri(a, b, c, mat);
  else m.tri(c, b, a, mat);
}

/**
 * A roof over one wing, in a frame where the ridge runs along `u`.
 *
 * `P(u, y, v)` turns frame coordinates into the lot's; a wing deeper than it is
 * wide is turned a quarter so the ridge always runs along its length.
 */
function roof(m: MeshBuilder, p: BuildingPlan, r: Rect, eaves: number, lod: number, wallMat: Material): { ridge: number; top: number } {
  const [x0, z0, x1, z1] = r;
  const alongX = x1 - x0 >= z1 - z0;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const o = p.roof === 'flat' ? 0 : 0.45;
  const L = (alongX ? (x1 - x0) : (z1 - z0)) / 2 + o;
  const S = (alongX ? (z1 - z0) : (x1 - x0)) / 2 + o;
  const P = (u: number, y: number, v: number): V3 => (alongX ? [cx + u, y, cz + v] : [cx + v, y, cz - u]);
  const Out = (u: number, y: number, v: number): V3 => (alongX ? [u, y, v] : [v, y, -u]);
  const y = eaves;
  const rise = roofRise(p, S * 2);
  const tile = MAT.ROOF_TILE;
  const paint = (body: () => void): void => m.painted(TINT.ACCENT, body);
  switch (p.roof) {
    case 'flat': {
      m.box([x0, y, z0], [x1, y + 0.2, z1], MAT.ROOF);
      parapet(m, x0, z0, x1, z1, y + 0.2, p.cornice ? 1.0 : 0.6, 0.2, p.walls === 'concrete' ? MAT.CONCRETE : MAT.TRIM);
      // Plant and hatches, well inside the parapet: the helper lets a unit
      // overhang the box it is given by a metre or two.
      if (lod < 1 && x1 - x0 > 10 && z1 - z0 > 10) {
        roofClutter(m, x0 + 3, z0 + 3, x1 - 3, z1 - 3, y + 0.2, Math.round(cx * 7 + cz * 13), 0.6);
      }
      return { ridge: y + 0.2, top: y + 1.2 };
    }
    case 'gable': {
      const h = rise;
      paint(() => {
        face(m, P(-L, y, S), P(L, y, S), P(L, y + h, 0), P(-L, y + h, 0), tile, Out(0, 1, 1));
        face(m, P(L, y, -S), P(-L, y, -S), P(-L, y + h, 0), P(L, y + h, 0), tile, Out(0, 1, -1));
      });
      const e = L - o;
      tri(m, P(e, y, S - o), P(e, y, -S + o), P(e, y + h * ((S - o) / S), 0), wallMat, Out(1, 0, 0));
      tri(m, P(-e, y, -S + o), P(-e, y, S - o), P(-e, y + h * ((S - o) / S), 0), wallMat, Out(-1, 0, 0));
      return { ridge: y + h, top: y + h };
    }
    case 'hip': {
      const h = rise;
      const rl = Math.max(0, L - S);
      paint(() => {
        face(m, P(-L, y, S), P(L, y, S), P(rl, y + h, 0), P(-rl, y + h, 0), tile, Out(0, 1, 1));
        face(m, P(L, y, -S), P(-L, y, -S), P(-rl, y + h, 0), P(rl, y + h, 0), tile, Out(0, 1, -1));
        tri(m, P(L, y, S), P(L, y, -S), P(rl, y + h, 0), tile, Out(1, 1, 0));
        tri(m, P(-L, y, -S), P(-L, y, S), P(-rl, y + h, 0), tile, Out(-1, 1, 0));
      });
      return { ridge: y + h, top: y + h };
    }
    case 'mansard': {
      const h = Math.max(2.6, Math.min(4.2, rise));
      const d = Math.min(S * 0.3, 1.6);
      const y1 = y + h;
      paint(() => {
        face(m, P(-L, y, S), P(L, y, S), P(L - d, y1, S - d), P(-L + d, y1, S - d), tile, Out(0, 0.4, 1));
        face(m, P(L, y, -S), P(-L, y, -S), P(-L + d, y1, -S + d), P(L - d, y1, -S + d), tile, Out(0, 0.4, -1));
        face(m, P(L, y, S), P(L, y, -S), P(L - d, y1, -S + d), P(L - d, y1, S - d), tile, Out(1, 0.4, 0));
        face(m, P(-L, y, -S), P(-L, y, S), P(-L + d, y1, S - d), P(-L + d, y1, -S + d), tile, Out(-1, 0.4, 0));
      });
      face(m, P(-L + d, y1, S - d), P(L - d, y1, S - d), P(L - d, y1, -S + d), P(-L + d, y1, -S + d), MAT.ROOF, Out(0, 1, 0));
      return { ridge: y1, top: y1 };
    }
    case 'gambrel': {
      const h = rise * 1.1;
      const v1 = S * 0.55, y1 = y + h * 0.62;
      paint(() => {
        face(m, P(-L, y, S), P(L, y, S), P(L, y1, v1), P(-L, y1, v1), tile, Out(0, 0.3, 1));
        face(m, P(-L, y1, v1), P(L, y1, v1), P(L, y + h, 0), P(-L, y + h, 0), tile, Out(0, 1, 1));
        face(m, P(L, y, -S), P(-L, y, -S), P(-L, y1, -v1), P(L, y1, -v1), tile, Out(0, 0.3, -1));
        face(m, P(L, y1, -v1), P(-L, y1, -v1), P(-L, y + h, 0), P(L, y + h, 0), tile, Out(0, 1, -1));
      });
      for (const sgn of [1, -1]) {
        const e = sgn * (L - o);
        const out = Out(sgn, 0, 0);
        const so = S - o;
        tri(m, P(e, y, so), P(e, y, -so), P(e, y1, -v1 * (so / S)), wallMat, out);
        tri(m, P(e, y, so), P(e, y1, -v1 * (so / S)), P(e, y + h * (so / S), 0), wallMat, out);
        tri(m, P(e, y, so), P(e, y + h * (so / S), 0), P(e, y1, v1 * (so / S)), wallMat, out);
      }
      return { ridge: y + h, top: y + h };
    }
    case 'shed': {
      const h = rise;
      paint(() => face(m, P(-L, y, S), P(L, y, S), P(L, y + h, -S), P(-L, y + h, -S), tile, Out(0, 1, 0.5)));
      const e = L - o, so = S - o;
      face(m, P(e, y, -so), P(-e, y, -so), P(-e, y + h * ((S + so) / (2 * S)), -so), P(e, y + h * ((S + so) / (2 * S)), -so), wallMat, Out(0, 0, -1));
      tri(m, P(e, y, so), P(e, y, -so), P(e, y + h * ((S + so) / (2 * S)), -so), wallMat, Out(1, 0, 0));
      tri(m, P(-e, y, -so), P(-e, y, so), P(-e, y + h * ((S + so) / (2 * S)), -so), wallMat, Out(-1, 0, 0));
      return { ridge: y + h, top: y + h };
    }
    case 'sawtooth': {
      // Teeth across the span, each a slope and a north light of glass.
      const h = Math.max(2, rise);
      const n = Math.max(2, Math.round((S * 2) / 7));
      const step = (S * 2) / n;
      for (let i = 0; i < n; i++) {
        const va = -S + i * step, vb = va + step;
        paint(() => face(m, P(-L, y, va), P(L, y, va), P(L, y + h, vb), P(-L, y + h, vb), MAT.METAL, Out(0, 1, -0.4)));
        face(m, P(L, y, vb), P(-L, y, vb), P(-L, y + h, vb), P(L, y + h, vb), MAT.GLASS, Out(0, 0, 1));
        tri(m, P(L, y, va), P(L, y, vb), P(L, y + h, vb), wallMat, Out(1, 0, 0));
        tri(m, P(-L, y, vb), P(-L, y, va), P(-L, y + h, vb), wallMat, Out(-1, 0, 0));
      }
      return { ridge: y + h, top: y + h };
    }
  }
}

function wallMaterial(p: BuildingPlan): { mat: Material; painted: boolean } {
  switch (p.walls) {
    case 'brick': return { mat: MAT.BRICK, painted: false };
    case 'stone': return { mat: MAT.STONE, painted: false };
    case 'concrete': return { mat: MAT.CONCRETE, painted: false };
    case 'glass': return { mat: MAT.GLASS, painted: false };
    case 'timber': return { mat: MAT.TIMBER, painted: true };
    case 'metal': return { mat: MAT.METAL, painted: true };
    default: return { mat: MAT.PLASTER, painted: true };
  }
}

/** Whether a point is inside any of the wings: a face that looks into another wing has no windows. */
function covered(rs: readonly Rect[], x: number, z: number): boolean {
  return rs.some(([a, b, c, d]) => x > a + 0.05 && x < c - 0.05 && z > b + 0.05 && z < d - 0.05);
}

export function buildingMesh(p: BuildingPlan, width: number, depth: number, lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const rs = wings(p, width, depth);
  const fh = p.floorHeight;
  const H = p.storeys * fh;
  const { mat: wallMat, painted } = wallMaterial(p);
  const fine = lod < 1, medium = lod < 2;
  const lz = depth * 4;
  const walls = (body: () => void): void => { if (painted) m.painted(TINT.BRAND, body); else body(); };

  // A plinth, the walls tier by tier, and the storey bands. Every tier but
  // the top one ends in a terrace: a roof slab and a parapet round it.
  const tiered = rs.map((r) => tiers(p, r));
  for (const ts of tiered) {
    const [x0, z0, x1, z1] = ts[0].r;
    m.box([x0 - 0.12, 0, z0 - 0.12], [x1 + 0.12, 0.45, z1 + 0.12], p.walls === 'metal' ? MAT.CONCRETE : MAT.STONE);
    ts.forEach((t, k) => {
      const [a0, b0, a1, b1] = t.r;
      const y0 = t.f0 === 0 ? 0.45 : t.f0 * fh, y1 = t.f1 * fh;
      walls(() => m.box([a0, y0, b0], [a1, y1, b1], wallMat, { roof: MAT.ROOF }));
      const last = k === ts.length - 1;
      if (!last) {
        m.box([a0, y1, b0], [a1, y1 + 0.15, b1], MAT.ROOF);
        if (medium) parapet(m, a0, b0, a1, b1, y1 + 0.15, 0.9, 0.2, p.walls === 'concrete' ? MAT.CONCRETE : MAT.TRIM);
      } else if (p.cornice && medium) {
        m.box([a0 - 0.3, y1 - 0.35, b0 - 0.3], [a1 + 0.3, y1, b1 + 0.3], MAT.TRIM);
      }
    });
    if (p.cornice && medium && p.storeys > 2 && fine) m.box([x0 - 0.12, fh - 0.15, z0 - 0.12], [x1 + 0.12, fh + 0.05, z1 + 0.12], MAT.TRIM);
  }

  // Windows, doors and what hangs off the walls, face by face.
  if (medium) {
    for (let wi = 0; wi < rs.length; wi++) for (const t of tiered[wi]) {
      const [x0, z0, x1, z1] = t.r;
      // Faces are hidden by another wing at the same height: its tier holding these floors.
      const beside = tiered.map((ts) => (ts.find((u) => u.f0 <= t.f0 && u.f1 > t.f0) ?? ts[ts.length - 1]).r);
      const facesOf: Array<{ w: Wall; u0: number; u1: number; front: boolean; mid: [number, number] }> = [
        // `axis` is the way a wall faces (see parts.ts), and u runs along it.
        { w: { axis: 'z', sign: 1, plane: z1 }, u0: x0, u1: x1, front: true, mid: [(x0 + x1) / 2, z1 + 0.5] },
        { w: { axis: 'z', sign: -1, plane: z0 }, u0: x0, u1: x1, front: false, mid: [(x0 + x1) / 2, z0 - 0.5] },
        { w: { axis: 'x', sign: 1, plane: x1 }, u0: z0, u1: z1, front: false, mid: [x1 + 0.5, (z0 + z1) / 2] },
        { w: { axis: 'x', sign: -1, plane: x0 }, u0: z0, u1: z1, front: false, mid: [x0 - 0.5, (z0 + z1) / 2] },
      ];
      for (const f of facesOf) {
        if (covered(beside, f.mid[0], f.mid[1])) continue;
        dressFace(m, p, f.w, f.u0 + 0.8, f.u1 - 0.8, t.f0 === 0 && f.front && f.w.plane >= lz - 6, fine, t.f0, t.f1);
      }
    }
  }

  // The roofs, and what stands on them.
  let ridge = H;
  for (let wi = 0; wi < rs.length; wi++) {
    // The roof, dormers and chimneys stand on the top tier.
    const r = tiered[wi][tiered[wi].length - 1].r;
    const got = roof(m, p, r, H, lod, wallMat);
    ridge = Math.max(ridge, got.ridge);
    const [x0, z0, x1, z1] = r;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (p.dormers && fine && (p.roof === 'gable' || p.roof === 'mansard' || p.roof === 'gambrel' || p.roof === 'hip')) {
      dormers(m, p, r, H, got.top);
    }
    if (p.chimneys > 0 && medium) {
      const alongX = x1 - x0 >= z1 - z0;
      for (let i = 0; i < p.chimneys; i++) {
        const t = p.chimneys === 1 ? 0.3 : -0.38 + (i / (p.chimneys - 1)) * 0.76;
        const x = alongX ? cx + t * (x1 - x0) : cx + (x1 - x0) * 0.18;
        const z = alongX ? cz + (z1 - z0) * 0.18 : cz + t * (z1 - z0);
        chimneyStack(m, x, z, H, Math.max(H + 1.5, got.top + 1.2), p.type === 'factory' ? 1.6 : 1.0);
      }
    }
    if (p.type === 'factory' && medium && wi === 0) {
      // A works chimney: tall, round, brick, at the back corner.
      m.cylinder(x1 - 2.2, z0 + 2.2, 1.3, 0, Math.max(H + 14, ridge + 10), fine ? 12 : 8, MAT.BRICK);
      m.cylinder(x1 - 2.2, z0 + 2.2, 1.5, Math.max(H + 14, ridge + 10) - 0.8, Math.max(H + 14, ridge + 10), fine ? 12 : 8, MAT.TRIM);
    }
  }

  // The ground in front: a garden with a hedge, or a yard for the lorries.
  if (p.garden && medium) {
    const front = rs.reduce((a, r) => Math.max(a, r[3]), -Infinity);
    const lx = width * 4;
    m.painted(TINT.GREEN, () => {
      m.box([-lx + 0.4, 0, lz - 0.9], [-1.2, 0.9, lz - 0.3], MAT.FOLIAGE);
      m.box([1.2, 0, lz - 0.9], [lx - 0.4, 0.9, lz - 0.3], MAT.FOLIAGE);
    });
    if (front < lz - 2) m.box([-0.9, 0, front], [0.9, 0.06, lz - 0.2], MAT.STONE);
  }
  return m;
}

/** Windows, a door and whatever the style hangs on one outside face. */
function dressFace(m: MeshBuilder, p: BuildingPlan, w: Wall, u0: number, u1: number, street: boolean, fine: boolean,
  fromFloor = 0, toFloor = p.storeys): void {
  const len = u1 - u0;
  if (len < 2) return;
  const fh = p.floorHeight;
  const glassWall = p.walls === 'glass';
  const shopFloor = street && (p.type === 'shop' || p.windows === 'shopfront');
  const industrial = p.type === 'warehouse' || p.type === 'factory';

  // Ground floor on the street: a shopfront, loading doors, a portico, or the door.
  if (shopFloor) {
    const at = (a: number, b: number, y0: number, y1: number, d0: number, d1: number, mat: Material): void => place(m, w, a, b, y0, y1, d0, d1, mat);
    at(u0, u1, 0.45, Math.min(fh - 0.3, 3.4), -0.05, 0.08, MAT.SHOPFRONT);
    at(u0 - 0.2, u1 + 0.2, Math.min(fh - 0.3, 3.4), Math.min(fh - 0.3, 3.4) + 0.5, 0, 0.18, MAT.TRIM);
    if (p.awning) m.painted(TINT.AWNING, () => at(u0, u1, Math.min(fh - 0.3, 3.4) - 0.1, Math.min(fh - 0.3, 3.4) + 0.12, 0, 1.6, MAT.PAINT));
  } else if (street && industrial && p.docks) {
    const n = Math.max(1, Math.floor(len / 7));
    for (let i = 0; i < n; i++) {
      const c = u0 + (i + 0.5) * (len / n);
      place(m, w, c - 2, c + 2, 0.45, 4.6, 0, 0.1, MAT.METAL);
      place(m, w, c - 2.4, c + 2.4, 0, 1.2, 0, 2.2, MAT.CONCRETE);
      m.painted(TINT.ACCENT, () => place(m, w, c - 2.6, c + 2.6, 4.9, 5.1, 0, 2.4, MAT.PAINT));
    }
  } else if (street && p.type === 'civic' && fine) {
    // A portico: columns carrying a pediment across the middle of the front.
    const span = Math.min(len * 0.6, 16);
    const c = (u0 + u1) / 2;
    const n = Math.max(4, Math.round(span / 2.6));
    const top = Math.min(p.storeys, 2) * fh;
    for (let i = 0; i <= n; i++) {
      const u = c - span / 2 + (i / n) * span;
      const [x, z] = w.axis === 'z' ? [u, w.plane + w.sign * 2.2] : [w.plane + w.sign * 2.2, u];
      m.cylinder(x, z, 0.38, 0.45, top, 10, MAT.STONE);
    }
    place(m, w, c - span / 2 - 0.5, c + span / 2 + 0.5, top, top + 0.8, 0, 3, MAT.STONE);
    entrance(m, w, c, { width: 2.4, height: Math.min(4, top - 0.6), double: true, steps: 3 });
  } else if (street) {
    entrance(m, w, (u0 + u1) / 2, { width: 1.1, height: 2.3, canopy: p.porch ? 1.6 : 0, steps: 2 });
    if (p.porch && fine) {
      const c = (u0 + u1) / 2;
      for (const du of [-1.4, 1.4]) {
        const [x, z] = w.axis === 'z' ? [c + du, w.plane + w.sign * 2.2] : [w.plane + w.sign * 2.2, c + du];
        m.box([x - 0.12, 0.45, z - 0.12], [x + 0.12, 2.9, z + 0.12], MAT.TRIM);
      }
      m.painted(TINT.ACCENT, () => place(m, w, c - 1.8, c + 1.8, 2.9, 3.1, 0, 2.5, MAT.PAINT));
    }
  }
  if (glassWall) return;

  // The windows, storey by storey.
  const style = p.windows === 'shopfront' ? 'sash' : p.windows;
  const dims: Record<string, [number, number, number]> = {
    sash: [0.95, 1.6, 2.6], casement: [1.2, 1.3, 2.8], arched: [1.05, 1.9, 3.0], ribbon: [0, 1.2, 0], industrial: [2.4, 2.1, 4.4],
  };
  const [ww, wh, pitch] = dims[style];
  const first = Math.max(fromFloor, shopFloor || (street && industrial && p.docks) ? 1 : 0);
  // Bay windows: two storeys of glass stood out from the street front, one
  // each side of the door on a wide front, one on a narrow one.
  const bays: number[] = [];
  if (street && p.bays && !shopFloor && !industrial && len >= 5) {
    const c = (u0 + u1) / 2;
    if (len >= 9) bays.push(c - len * 0.28, c + len * 0.28); else bays.push(c + Math.min(2.4, len * 0.3));
    const top = Math.min(2, p.storeys) * fh;
    for (const b of bays) {
      // In the walls' own material, so it reads as part of the house.
      const { mat, painted } = wallMaterial(p);
      if (painted) m.painted(TINT.BRAND, () => place(m, w, b - 1.3, b + 1.3, 0.45, top, 0, 0.9, mat));
      else place(m, w, b - 1.3, b + 1.3, 0.45, top, 0, 0.9, mat);
      for (let f = 0; f < Math.min(2, p.storeys); f++) {
        const y0 = f * fh + 0.45 + 0.6;
        place(m, w, b - 1.0, b + 1.0, y0, y0 + Math.min(1.8, fh - 1.2), 0.9, 0.96, MAT.PANE);
      }
      m.painted(TINT.ACCENT, () => place(m, w, b - 1.45, b + 1.45, top, top + 0.25, 0, 1.05, MAT.PAINT));
    }
  }
  for (let f = first; f < toFloor; f++) {
    const y0 = f * fh + 0.45 + Math.max(0.6, (fh - wh) * 0.45);
    if (style === 'ribbon') {
      place(m, w, u0, u1, y0, y0 + wh, -0.02, 0.06, MAT.PANE);
      if (fine) place(m, w, u0, u1, y0 - 0.12, y0, 0, 0.12, MAT.TRIM);
      continue;
    }
    const count = Math.max(1, Math.floor(len / pitch));
    const gap = len / count;
    for (let i = 0; i < count; i++) {
      const c = u0 + (i + 0.5) * gap;
      if (street && f === 0 && !industrial && Math.abs(c - (u0 + u1) / 2) < 1.4) continue;
      if (f < 2 && bays.some((b) => Math.abs(c - b) < 1.5)) continue;
      place(m, w, c - ww / 2, c + ww / 2, y0, y0 + wh, -0.02, 0.06, MAT.PANE);
      if (fine) {
        place(m, w, c - ww / 2 - 0.1, c + ww / 2 + 0.1, y0 - 0.14, y0, 0, 0.14, MAT.TRIM);
        if (style === 'arched') place(m, w, c - 0.18, c + 0.18, y0 + wh, y0 + wh + 0.35, 0, 0.12, MAT.TRIM);
        if (p.shutters) {
          m.painted(TINT.ACCENT, () => {
            place(m, w, c - ww / 2 - 0.55, c - ww / 2 - 0.08, y0, y0 + wh, 0, 0.08, MAT.PAINT);
            place(m, w, c + ww / 2 + 0.08, c + ww / 2 + 0.55, y0, y0 + wh, 0, 0.08, MAT.PAINT);
          });
        }
      }
      if (p.balconies && f > 0 && fine && (i % 2 === 0 || p.theme === 'soviet' || p.theme === 'parisian')) {
        place(m, w, c - ww / 2 - 0.4, c + ww / 2 + 0.4, f * fh + 0.45 - 0.12, f * fh + 0.45, 0, 1.1, MAT.CONCRETE);
        m.painted(TINT.METAL_DARK, () => place(m, w, c - ww / 2 - 0.4, c + ww / 2 + 0.4, f * fh + 0.45, f * fh + 1.45, 1.0, 1.1, MAT.PAINT));
      }
    }
  }
}

/** A box on a wall: `u` along it, `y` up it, `d` out from its face. */
function place(m: MeshBuilder, w: Wall, u0: number, u1: number, y0: number, y1: number, d0: number, d1: number, mat: Material): void {
  const p0 = w.plane + w.sign * d0, p1 = w.plane + w.sign * d1;
  const lo = Math.min(p0, p1), hi = Math.max(p0, p1);
  // A wall facing x runs along z, and one facing z runs along x.
  if (w.axis === 'x') m.box([lo, y0, Math.min(u0, u1)], [hi, y1, Math.max(u0, u1)], mat);
  else m.box([Math.min(u0, u1), y0, lo], [Math.max(u0, u1), y1, hi], mat);
}

/** Dormers along the front slope of a pitched roof. */
function dormers(m: MeshBuilder, p: BuildingPlan, r: Rect, eaves: number, top: number): void {
  const [x0, z0, x1, z1] = r;
  if (x1 - x0 < z1 - z0) return;
  const n = Math.max(1, Math.floor((x1 - x0 - 2) / 4.5));
  const zFront = z1 - 1.4;
  const y = eaves + Math.min(0.9, (top - eaves) * 0.3);
  const h = Math.min(1.6, Math.max(1.1, (top - eaves) * 0.45));
  for (let i = 0; i < n; i++) {
    const cx = x0 + (i + 0.5) * ((x1 - x0) / n);
    m.box([cx - 0.85, eaves, zFront - 1.6], [cx + 0.85, y + h, zFront], MAT.TRIM);
    m.box([cx - 0.55, y + 0.15, zFront - 0.02], [cx + 0.55, y + h - 0.2, zFront + 0.05], MAT.PANE);
    m.painted(TINT.ACCENT, () => m.gable([cx - 1.0, y + h, zFront - 1.7], [cx + 1.0, y + h, zFront + 0.2], 0.7, 'z', MAT.ROOF_TILE, MAT.TRIM));
  }
  void p;
}

// ---- the elevation -----------------------------------------------------------------------

const WALL_FILL: Record<BuildingPlan['walls'], string> = {
  brick: '#9c5238', render: '', stone: '#cfc2a4', timber: '', concrete: '#b5b1a8', metal: '', glass: '#3a5068',
};

/** The building's front, to scale: walls, the roof's profile, the windows. */
export function buildingSvg(p: BuildingPlan, width: number, depth: number, size: number): string {
  const rs = wings(p, width, depth);
  const x0 = Math.min(...rs.map((r) => r[0])), x1 = Math.max(...rs.map((r) => r[2]));
  const W = x1 - x0;
  const H = p.storeys * p.floorHeight;
  const rise = roofRise(p, Math.min(...rs.map((r) => Math.min(r[2] - r[0], r[3] - r[1]))));
  const total = H + rise + (p.type === 'factory' ? 14 : 0);
  const s = 86 / Math.max(W, total);
  const X = (x: number): number => 50 + x * s, Y = (y: number): number => 94 - y * s;
  const fill = WALL_FILL[p.walls] || p.wallColour;
  const out: string[] = [`<line x1="4" y1="94" x2="96" y2="94" stroke="#85858a" stroke-width="1"/>`];
  out.push(`<rect x="${X(x0)}" y="${Y(H)}" width="${W * s}" height="${H * s}" fill="${fill}"/>`);
  const rc = p.roofColour;
  switch (p.roof) {
    case 'gable': case 'gambrel': case 'hip':
      out.push(`<polygon points="${X(x0 - 0.4)},${Y(H)} ${X(x1 + 0.4)},${Y(H)} ${X(p.roof === 'hip' ? x1 - Math.min(W / 2, rise) : (x0 + x1) / 2)},${Y(H + rise)} ${X(p.roof === 'hip' ? x0 + Math.min(W / 2, rise) : (x0 + x1) / 2)},${Y(H + rise)}" fill="${rc}"/>`);
      break;
    case 'mansard':
      out.push(`<polygon points="${X(x0)},${Y(H)} ${X(x1)},${Y(H)} ${X(x1 - 1.4)},${Y(H + Math.min(4, rise))} ${X(x0 + 1.4)},${Y(H + Math.min(4, rise))}" fill="${rc}"/>`);
      break;
    case 'shed':
      out.push(`<polygon points="${X(x0)},${Y(H)} ${X(x1)},${Y(H)} ${X(x1)},${Y(H + rise)}" fill="${rc}"/>`);
      break;
    case 'sawtooth': {
      const n = Math.max(2, Math.round(W / 7));
      for (let i = 0; i < n; i++) {
        const a = x0 + (i / n) * W, b = x0 + ((i + 1) / n) * W;
        out.push(`<polygon points="${X(a)},${Y(H)} ${X(b)},${Y(H)} ${X(b)},${Y(H + rise)}" fill="${rc}"/>`);
      }
      break;
    }
    default: out.push(`<rect x="${X(x0)}" y="${Y(H + 1)}" width="${W * s}" height="${s}" fill="#6a6a6e"/>`);
  }
  if (p.type === 'factory') out.push(`<rect x="${X(x1 - 3.5)}" y="${Y(total)}" width="${2.6 * s}" height="${(total - H) * s}" fill="#8b4a38"/>`);
  if (p.walls !== 'glass') {
    for (let f = 0; f < p.storeys; f++) {
      const y = f * p.floorHeight + p.floorHeight * 0.35;
      if (p.windows === 'ribbon') {
        out.push(`<rect x="${X(x0 + 0.8)}" y="${Y(y + 1.2)}" width="${(W - 1.6) * s}" height="${1.2 * s}" fill="#2c3b4a"/>`);
        continue;
      }
      const n = Math.max(1, Math.floor(W / 2.8));
      for (let i = 0; i < n; i++) {
        const c = x0 + (i + 0.5) * (W / n);
        out.push(`<rect x="${X(c - 0.5)}" y="${Y(y + 1.5)}" width="${s}" height="${1.5 * s}" fill="#2c3b4a"/>`);
      }
    }
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${out.join('')}</svg>`;
}
