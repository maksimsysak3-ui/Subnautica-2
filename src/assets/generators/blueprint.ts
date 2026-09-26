/**
 * Blueprints: buildings a player designs, turned into real models.
 *
 * A blueprint is a list of decisions -- how many towers stand on the lot and
 * how they are joined, each tower's plan and footprint, how many storeys, how
 * it narrows and turns, what its skin is made of, the sections stacked on top
 * of it, what it stands on and how it meets the sky -- and this file builds
 * from it the same kind of mesh the game's own towers are: lofted rings, panes
 * that follow them, slab edges, fins, plant floors, a crown. It is how a mod
 * adds a building without shipping code: the mod is the blueprint, and the
 * blueprint is data, clamped here to what the renderer and the lot can carry.
 *
 * Every field added since the first version is optional in what it reads, so
 * a blueprint saved before sections and layouts existed still builds exactly
 * as it did.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { Material } from '../mesh';
import type { AssetDef } from '../types';
import { cap, loft, plan, scaled } from './signature-parts';
import type { Ring } from './signature-parts';
import { glaze, plate } from './towers';
import { centroid, grow, litCrown, plantFloor, shaft, shrink, soffit, square, triPlan } from './supertalls';
import { skinShaft, terraceTree } from './supertalls-unique';
import { entrance } from '../parts';

export const BP_SHAPES = ['box', 'rounded', 'round', 'triangle', 'chamfered', 'hex', 'cross'] as const;
export const BP_FACADES = ['glass', 'frame', 'stone', 'brick', 'concrete'] as const;
export const BP_CROWNS = ['flat', 'raked', 'dome', 'stepped', 'lantern', 'garden', 'spire',
  'pyramid', 'pitched', 'helipad', 'antenna', 'halo'] as const;
export const BP_ZONES = ['office', 'commercial', 'residential'] as const;
export const BP_LAYOUTS = ['single', 'twin', 'trio'] as const;
export const BP_PODIUMS = ['glass', 'arcade', 'shops', 'stone'] as const;
/** Upper sections a tower may carry. */
export const MAX_SECTIONS = 3;

type Shape = typeof BP_SHAPES[number];
type Facade = typeof BP_FACADES[number];

/** A section stacked on top of the tower below it: a setback, a turned box, a slimmer shaft. */
export interface Section {
  floors: number;
  shape: Shape;
  /** Its size as a fraction of the top of what it stands on. */
  scale: number;
  taper: number;
  twist: number;
  facade: Facade;
  /** Where it sits on what is below, -1 to 1 across the room there is. */
  shiftX: number;
  shiftZ: number;
  balconies: boolean;
}

export interface Blueprint {
  name: string;
  zone: typeof BP_ZONES[number];
  /** Footprint in cells, 8 m each. */
  width: number;
  depth: number;
  /** One tower, two joined by a sky bridge, or three. */
  layout: typeof BP_LAYOUTS[number];
  floors: number;
  floorHeight: number;
  shape: Shape;
  /** Width at the top as a fraction of the bottom. */
  taper: number;
  /** Radians the plan turns over the whole height. */
  twist: number;
  facade: Facade;
  /** #rrggbb: the frame, the stone, the lit crown. */
  colour: string;
  /** #rrggbb: domes, halos, awnings, fins. */
  accent: string;
  crown: typeof BP_CROWNS[number];
  /** Storeys of podium under the tower, 0 for none. */
  podium: number;
  podiumStyle: typeof BP_PODIUMS[number];
  balconies: boolean;
  /** Vertical fins standing off the facade. */
  fins: boolean;
  /** A louvred plant floor every this many storeys, 0 for none. */
  bands: number;
  lit: boolean;
  sections: Section[];
}

export const DEFAULT_SECTION: Section = {
  floors: 12, shape: 'box', scale: 0.7, taper: 1, twist: 0, facade: 'glass', shiftX: 0, shiftZ: 0, balconies: false,
};

export const DEFAULT_BLUEPRINT: Blueprint = {
  name: 'My Tower', zone: 'office', width: 6, depth: 6, layout: 'single', floors: 36, floorHeight: 3.8,
  shape: 'rounded', taper: 0.8, twist: 0.3, facade: 'glass', colour: '#c9a45c', accent: '#e8e2d4', crown: 'raked',
  podium: 3, podiumStyle: 'glass', balconies: false, fins: false, bands: 12, lit: true, sections: [],
};

const clampN = (v: unknown, lo: number, hi: number, dflt: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt;
const oneOf = <T extends string>(v: unknown, list: readonly T[], dflt: T): T =>
  (typeof v === 'string' && (list as readonly string[]).includes(v) ? v as T : dflt);
const hexOr = (v: unknown, dflt: string): string =>
  typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : dflt;

export function cleanSection(raw: unknown): Section {
  const o = (raw !== null && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SECTION;
  return {
    floors: Math.round(clampN(o.floors, 1, 60, d.floors)),
    shape: oneOf(o.shape, BP_SHAPES, d.shape),
    scale: clampN(o.scale, 0.3, 1, d.scale),
    taper: clampN(o.taper, 0.45, 1, d.taper),
    twist: clampN(o.twist, -1.6, 1.6, d.twist),
    facade: oneOf(o.facade, BP_FACADES, d.facade),
    shiftX: clampN(o.shiftX, -1, 1, 0),
    shiftZ: clampN(o.shiftZ, -1, 1, 0),
    balconies: o.balconies === true,
  };
}

/** Cleans anything into a buildable blueprint: every number in range, every choice a real one. */
export function cleanBlueprint(raw: unknown): Blueprint {
  const o = (raw !== null && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_BLUEPRINT;
  return {
    name: typeof o.name === 'string' && o.name.trim() !== '' ? o.name.trim().slice(0, 40) : d.name,
    zone: oneOf(o.zone, BP_ZONES, d.zone),
    width: Math.round(clampN(o.width, 3, 12, d.width)),
    depth: Math.round(clampN(o.depth, 3, 12, d.depth)),
    layout: oneOf(o.layout, BP_LAYOUTS, 'single'),
    floors: Math.round(clampN(o.floors, 3, 90, d.floors)),
    floorHeight: clampN(o.floorHeight, 3, 5, d.floorHeight),
    shape: oneOf(o.shape, BP_SHAPES, d.shape),
    taper: clampN(o.taper, 0.45, 1, d.taper),
    twist: clampN(o.twist, -1.6, 1.6, d.twist),
    facade: oneOf(o.facade, BP_FACADES, d.facade),
    colour: hexOr(o.colour, d.colour),
    accent: hexOr(o.accent, d.accent),
    crown: oneOf(o.crown, BP_CROWNS, d.crown),
    podium: Math.round(clampN(o.podium, 0, 6, d.podium)),
    podiumStyle: oneOf(o.podiumStyle, BP_PODIUMS, 'glass'),
    balconies: o.balconies === true,
    fins: o.fins === true,
    bands: Math.round(clampN(o.bands, 0, 30, d.bands)),
    lit: o.lit !== false,
    sections: Array.isArray(o.sections) ? o.sections.slice(0, MAX_SECTIONS).map(cleanSection) : [],
  };
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** The half-extents of the space the towers stand in: inside the podium if there is one. */
function extents(bp: Blueprint): { hx: number; hz: number; lotX: number; lotZ: number } {
  const lotX = bp.width * 4, lotZ = bp.depth * 4;
  const inset = bp.podium > 0 ? 0.76 : 1;
  return { hx: (lotX - 2.2) * inset, hz: (lotZ - 2.2) * inset, lotX, lotZ };
}

/** Where each tower stands and how much room it has, in metres from the lot's centre. */
interface Stand { x: number; z: number; hx: number; hz: number; floors: number }

function stands(bp: Blueprint): Stand[] {
  const { hx, hz } = extents(bp);
  const gap = 2.5;
  const alongX = hx >= hz;
  const long = alongX ? hx : hz, short = alongX ? hz : hx;
  const count = bp.layout === 'trio' ? 3 : bp.layout === 'twin' ? 2 : 1;
  // Towers narrower than this are posts, not towers: fall back to fewer.
  for (let n = count; n > 1; n--) {
    const half = (long - gap * (n - 1) / 2) / n;
    if (half < 4.5) continue;
    const out: Stand[] = [];
    for (let i = 0; i < n; i++) {
      const c = -long + half + i * (half * 2 + gap);
      // Of three, the middle one is the tall one.
      const floors = n === 3 && i !== 1 ? Math.max(3, Math.round(bp.floors * 0.62)) : bp.floors;
      out.push(alongX ? { x: c, z: 0, hx: half, hz: short, floors } : { x: 0, z: c, hx: short, hz: half, floors });
    }
    return out;
  }
  return [{ x: 0, z: 0, hx, hz, floors: bp.floors }];
}

function basePlan(shape: Shape, hx: number, hz: number, lod: number, coarse = 0): Ring {
  const n = lod < 1 ? [24, 16, 12, 10][coarse] : lod < 2 ? [16, 12, 10, 8][coarse] : 10;
  switch (shape) {
    case 'box': return square(hx, hz);
    case 'rounded': return plan(hx, hz, 0.55, n);
    case 'round': { const r = Math.min(hx, hz); return plan(r, r, 1, n); }
    case 'triangle': {
      const r = Math.min(hx, hz) * 1.05;
      return triPlan(r, r * 0.3, lod < 1 ? 6 : 3);
    }
    case 'chamfered': {
      const c = Math.min(hx, hz) * 0.32;
      return [[hx, -hz + c], [hx, hz - c], [hx - c, hz], [-hx + c, hz], [-hx, hz - c], [-hx, -hz + c], [-hx + c, -hz], [hx - c, -hz]];
    }
    case 'hex': {
      const out: Ring = [];
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i / 6) * Math.PI * 2 + Math.PI / 6;
        out.push([Math.cos(a) * hx, Math.sin(a) * hz]);
      }
      return out;
    }
    case 'cross': {
      const a = hx * 0.36, b = hz * 0.36;
      return [[hx, -b], [hx, b], [a, b], [a, hz], [-a, hz], [-a, b], [-hx, b], [-hx, -b], [-a, -b], [-a, -hz], [a, -hz], [a, -b]];
    }
  }
}

/** The largest half-extents a ring reaches, about the origin. */
function reach(r: Ring): [number, number] {
  let ex = 0, ez = 0;
  for (const [x, z] of r) { ex = Math.max(ex, Math.abs(x)); ez = Math.max(ez, Math.abs(z)); }
  return [ex, ez];
}

/**
 * The plan, shrunk if it has to be to stay inside `limX` by `limZ` all the way
 * up: a long plan that turns swings its corners out past its room on the way.
 */
function fitted(base: Ring, taper: number, twist: number, limX: number, limZ: number, out: number): Ring {
  let f = 1;
  for (let k = 0; k <= 12; k++) {
    const t = k / 12;
    const [ex, ez] = reach(scaled(base, 1 - (1 - taper) * t, 1 - (1 - taper) * t, twist * t));
    f = Math.min(f, (limX - out) / Math.max(1e-6, ex), (limZ - out) / Math.max(1e-6, ez));
  }
  return f < 1 ? scaled(base, Math.max(0.05, f)) : base;
}

function perimeter(r: Ring): number {
  let p = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length];
    p += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return p;
}

function area(r: Ring): number {
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

/** One stretch of shaft: a ring function, where it starts and stops, and what it is clad in. */
interface Piece {
  at: (t: number) => Ring;
  y0: number;
  y1: number;
  floors: number;
  facade: Facade;
  balconies: boolean;
  /** Where its frame sits, from the lot's centre. */
  ox: number;
  oz: number;
}

/** Every shaft piece of every tower, laid out: what both the mesh and the capacity read. */
function layout(bp: Blueprint, lod: number, coarse = 0, fit = 1): { pieces: Piece[][]; y0: number } {
  const fh = bp.floorHeight;
  const y0 = bp.podium > 0 ? bp.podium * fh : fh * 1.5;
  const out = (bp.balconies ? 1.3 : 0.4) + (bp.fins ? 0.9 : 0);
  const towers: Piece[][] = [];
  for (const st of stands(bp)) {
    const base = fitted(basePlan(bp.shape, st.hx * fit, st.hz * fit, lod, coarse), bp.taper, bp.twist, st.hx * fit + 0.6, st.hz * fit + 0.6, out);
    const floors = bp.crown === 'stepped' && bp.sections.length === 0 ? Math.max(3, Math.round(st.floors * 0.8)) : st.floors;
    const at0 = (t: number): Ring => scaled(base, 1 - (1 - bp.taper) * t, 1 - (1 - bp.taper) * t, bp.twist * t);
    const pieces: Piece[] = [{
      at: at0, y0, y1: Math.max(y0 + fh, y0 + floors * fh), floors,
      facade: bp.facade, balconies: bp.balconies, ox: st.x, oz: st.z,
    }];
    for (const s of bp.sections) {
      const below = pieces[pieces.length - 1];
      const [ex, ez] = reach(below.at(1));
      const plan0 = basePlan(s.shape, ex * s.scale, ez * s.scale, lod, coarse);
      const pl = fitted(plan0, s.taper, s.twist, ex, ez, (s.balconies ? 1.3 : 0.2) + (bp.fins ? 0.9 : 0));
      const [sx, sz] = reach(pl);
      const at = (t: number): Ring => scaled(pl, 1 - (1 - s.taper) * t, 1 - (1 - s.taper) * t, s.twist * t);
      pieces.push({
        at, y0: below.y1, y1: below.y1 + s.floors * fh, floors: s.floors, facade: s.facade, balconies: s.balconies,
        ox: below.ox + s.shiftX * Math.max(0, ex - sx), oz: below.oz + s.shiftZ * Math.max(0, ez - sz),
      });
    }
    towers.push(pieces);
  }
  return { pieces: towers, y0 };
}

/** The most triangles a blueprint may come to at full detail: the landmark ceiling, with room to spare. */
const BUDGET = 24000;

/**
 * The mesh a blueprint describes, inside the triangle budget.
 *
 * Three towers with three sections each, balconies and fins is a lot of
 * building, and the detail that suits one slim tower would put it far over
 * what a landmark may cost. So it is built, counted, and if it is over, built
 * again coarser -- fewer sides to a round plan, wider window bays, balconies
 * every other floor -- until it fits. One tower never needs a second pass.
 */
export function blueprintMesh(raw: Blueprint, lod: number): MeshBuilder {
  const bp = cleanBlueprint(raw);
  // First, the fit: fins, balconies and crowns stand proud of the plan, and a
  // turned plan swings its corners about, so the towers are drawn in until the
  // whole of the building is on its lot.
  const lx = bp.width * 4 - 0.25, lz = bp.depth * 4 - 0.25;
  let fit = 1;
  let m = build(bp, lod, 0, fit);
  for (let k = 0; k < 6; k++) {
    const b = m.bounds();
    const over = Math.max(b.max[0] / lx, -b.min[0] / lx, b.max[2] / lz, -b.min[2] / lz);
    if (over <= 1) break;
    fit *= 0.97 / over;
    m = build(bp, lod, 0, fit);
  }
  let c = 0;
  for (c = 1; c <= 3 && lod < 2 && m.build({ occlusion: false }).indices.length / 3 > BUDGET / (lod < 1 ? 1 : 3); c++) {
    m = build(bp, lod, c, fit);
  }
  // Still over at the coarsest: the medium level stands in for the full one.
  // Only the most extreme designs -- three towers of ninety storeys, three
  // sections each -- ever get here.
  if (lod < 1 && m.build({ occlusion: false }).indices.length / 3 > BUDGET) m = build(bp, 1, 1, fit);
  return m;
}

function build(bp: Blueprint, lod: number, coarse: number, fit = 1): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const { lotX, lotZ } = extents(bp);
  const fh = bp.floorHeight;
  const { pieces: towers } = layout(bp, lod, coarse, fit);

  podium(m, bp, fine, lotX, lotZ);

  // Panes kept to a budget: the more building there is, the wider the bays,
  // rather than a hundred thousand triangles.
  let work = 0;
  for (const t of towers) for (const p of t) work += perimeter(p.at(0)) * p.floors;
  const bay = Math.max(3.0, work / 6500) * [1, 1.6, 2.4, 3.4][coarse];
  const many = towers.length + towers[0].length > 3 || coarse > 1;

  for (const pieces of towers) {
    const first = pieces[0];
    if (bp.podium === 0) {
      // A lobby of glass at the foot of each shaft.
      m.placed(first.ox, first.oz, 0, () => {
        const b = first.at(0);
        const lob = shrink(b, 0.92);
        loft(m, lob, lob, 0.1, first.y0, fine ? MAT.SHOPFRONT : MAT.GLASS);
        soffit(m, b, first.y0, MAT.CONCRETE);
      });
    }
    pieces.forEach((p, i) => {
      m.placed(p.ox, p.oz, 0, () => {
        if (p.facade === 'glass') shaft(m, lod, p.at, p.y0, p.y1, p.floors, bay);
        else if (p.facade === 'frame') skinShaft(m, lod, p.at, p.y0, p.y1, p.floors, bay, TINT.BRAND);
        else massShaft(m, lod, p.at, p.y0, p.y1, p.floors, bay, facadeMat(p.facade));
        if (p.balconies && medium) {
          const step = (fine ? (p.floors > 50 ? 2 : 1) : 3) * (many ? 2 : 1) * (coarse > 2 ? 2 : 1);
          for (let f = 1; f < p.floors; f += step) {
            const t = f / p.floors;
            plate(m, p.at(t), grow(p.at(t), 1.25), p.y0 + f * fh - 0.22, 0.22, MAT.TRIM, MAT.TRIM);
          }
        }
        if (i === 0 && bp.bands > 0 && medium) {
          for (let f = bp.bands; f < p.floors - 1; f += bp.bands) plantFloor(m, p.at(f / p.floors), p.y0 + f * fh - 1.0, 2.0);
        }
        if (bp.fins && medium && coarse < 3) fins(m, p, fine && coarse < 2);
        if (i < pieces.length - 1) {
          // The roof of this stretch, round the foot of the next.
          cap(m, p.at(1), p.y1, MAT.ROOF);
          if (medium) plantFloor(m, grow(p.at(1), -0.2), p.y1, 0.9);
        } else {
          crown(m, bp, lod, p.at, p.y0, p.y1, fh, p.facade);
        }
      });
    });
  }

  // A sky bridge between each pair of towers, a little over half way up the shorter.
  if (towers.length > 1) {
    for (let i = 0; i < towers.length - 1; i++) {
      const a = towers[i][0], b = towers[i + 1][0];
      const y = a.y0 + (Math.min(a.y1, b.y1) - a.y0) * 0.55;
      const alongX = Math.abs(b.ox - a.ox) > Math.abs(b.oz - a.oz);
      const w = 3.2, h = fh * 2;
      const x0 = Math.min(a.ox, b.ox), x1 = Math.max(a.ox, b.ox);
      const z0 = Math.min(a.oz, b.oz), z1 = Math.max(a.oz, b.oz);
      const min: [number, number, number] = alongX ? [x0, y, -w] : [-w, y, z0];
      const max: [number, number, number] = alongX ? [x1, y + h, w] : [w, y + h, z1];
      m.box(min, max, MAT.GLASS);
      m.box([min[0] - (alongX ? 0 : 0.3), y - 0.5, min[2] - (alongX ? 0.3 : 0)],
        [max[0] + (alongX ? 0 : 0.3), y, max[2] + (alongX ? 0.3 : 0)], MAT.TRIM);
      if (bp.lit && medium) m.painted(TINT.SIGN_LIT, () => m.box([min[0], y + h, min[2]], [max[0], y + h + 0.3, max[2]], MAT.PAINT));
    }
  }
  return m;
}

/** What the building stands on: a glass base, a colonnade, shops under awnings, or stone. */
function podium(m: MeshBuilder, bp: Blueprint, fine: boolean, lotX: number, lotZ: number): void {
  if (bp.podium === 0) return;
  const ph = bp.podium * bp.floorHeight;
  const pr = square(lotX - 2.2, lotZ - 2.2);
  const glassH = Math.min(ph, 6.5);
  const upper = podiumMat(bp.facade);
  switch (bp.podiumStyle) {
    case 'glass':
      loft(m, pr, pr, 0.1, glassH, fine ? MAT.SHOPFRONT : MAT.GLASS);
      if (ph > glassH) loft(m, grow(pr, 0.3), grow(pr, 0.3), glassH, ph, upper);
      soffit(m, grow(pr, 0.3), glassH, MAT.CONCRETE);
      break;
    case 'stone':
      loft(m, pr, pr, 0.1, ph, MAT.STONE);
      if (fine) glaze(m, () => pr, 0.1, ph, Math.max(1, bp.podium), 3.4);
      m.box([-(lotX - 2.2) - 0.3, 0, -(lotZ - 2.2) - 0.3], [lotX - 2.2 + 0.3, 0.9, lotZ - 2.2 + 0.3], MAT.STONE);
      break;
    case 'arcade': {
      // The wall set back behind a row of columns carrying the floors above.
      const inner = square(lotX - 4.4, lotZ - 4.4);
      loft(m, inner, inner, 0.1, glassH, fine ? MAT.SHOPFRONT : MAT.GLASS);
      soffit(m, pr, glassH, MAT.CONCRETE);
      if (ph > glassH) loft(m, pr, pr, glassH, ph, upper);
      const hx = lotX - 2.6, hz = lotZ - 2.6;
      const nx = Math.max(2, Math.round(hx / 2.4)), nz = Math.max(2, Math.round(hz / 2.4));
      const seg = fine ? 8 : 5;
      for (let i = 0; i <= nx; i++) {
        const x = -hx + (i / nx) * hx * 2;
        m.cylinder(x, hz, 0.42, 0.1, glassH, seg, MAT.STONE);
        m.cylinder(x, -hz, 0.42, 0.1, glassH, seg, MAT.STONE);
      }
      for (let j = 1; j < nz; j++) {
        const z = -hz + (j / nz) * hz * 2;
        m.cylinder(hx, z, 0.42, 0.1, glassH, seg, MAT.STONE);
        m.cylinder(-hx, z, 0.42, 0.1, glassH, seg, MAT.STONE);
      }
      break;
    }
    case 'shops': {
      loft(m, pr, pr, 0.1, glassH, MAT.SHOPFRONT);
      if (ph > glassH) loft(m, grow(pr, 0.2), grow(pr, 0.2), glassH, ph, upper);
      soffit(m, grow(pr, 0.2), glassH, MAT.CONCRETE);
      // Awnings in the accent colour along every side, one a shop.
      const hx = lotX - 2.2, hz = lotZ - 2.2, y = Math.min(glassH - 0.4, 3.6);
      m.painted(TINT.AWNING, () => {
        const run = (len: number, put: (a: number, b: number) => void): void => {
          const n = Math.max(1, Math.round(len * 2 / 6));
          for (let i = 0; i < n; i++) {
            const a = -len + (i / n) * len * 2 + 0.4, b = -len + ((i + 1) / n) * len * 2 - 0.4;
            put(a, b);
          }
        };
        run(hx, (a, b) => { m.box([a, y, hz], [b, y + 0.25, hz + 1.5], MAT.PAINT); m.box([a, y, -hz - 1.5], [b, y + 0.25, -hz], MAT.PAINT); });
        run(hz, (a, b) => { m.box([hx, y, a], [hx + 1.5, y + 0.25, b], MAT.PAINT); m.box([-hx - 1.5, y, a], [-hx, y + 0.25, b], MAT.PAINT); });
      });
      break;
    }
  }
  cap(m, grow(pr, 0.3), ph, MAT.ROOF);
  if (fine) entrance(m, { axis: 'z', sign: 1, plane: lotZ - 2.2 }, 0, { width: 5.0, height: Math.min(glassH - 0.6, 5.0), double: true, glazed: true, canopy: 1.2 });
}

/** Vertical fins standing off the facade, following the tower as it turns and narrows. */
function fins(m: MeshBuilder, p: Piece, fine: boolean): void {
  const ring0 = p.at(0);
  const n = ring0.length;
  const every = Math.max(1, Math.round(n / (fine ? 12 : 8)));
  const steps = fine ? 8 : 3;
  m.painted(TINT.ACCENT, () => {
    for (let i = 0; i < n; i += every) {
      for (let k = 0; k < steps; k++) {
        const t0 = k / steps, t1 = (k + 1) / steps;
        const r0 = p.at(t0), r1 = p.at(t1);
        const [c0x, c0z] = centroid(r0), [c1x, c1z] = centroid(r1);
        const a = r0[i], b = r1[i];
        const la = Math.hypot(a[0] - c0x, a[1] - c0z) || 1, lb = Math.hypot(b[0] - c1x, b[1] - c1z) || 1;
        const oa: [number, number] = [a[0] + ((a[0] - c0x) / la) * 0.9, a[1] + ((a[1] - c0z) / la) * 0.9];
        const ob: [number, number] = [b[0] + ((b[0] - c1x) / lb) * 0.9, b[1] + ((b[1] - c1z) / lb) * 0.9];
        const ya = p.y0 + t0 * (p.y1 - p.y0), yb = p.y0 + t1 * (p.y1 - p.y0);
        m.quad([a[0], ya, a[1]], [oa[0], ya, oa[1]], [ob[0], yb, ob[1]], [b[0], yb, b[1]], MAT.PAINT);
        m.quad([b[0], yb, b[1]], [ob[0], yb, ob[1]], [oa[0], ya, oa[1]], [a[0], ya, a[1]], MAT.PAINT);
      }
    }
  });
}

function facadeMat(f: Facade): Material {
  return f === 'stone' ? MAT.STONE : f === 'brick' ? MAT.BRICK : MAT.CONCRETE;
}
function podiumMat(f: Facade): Material {
  return f === 'brick' ? MAT.BRICK : f === 'concrete' ? MAT.CONCRETE : MAT.STONE;
}

/** A solid facade -- stone, brick, concrete -- with real windows set into it up close. */
function massShaft(m: MeshBuilder, lod: number, at: (t: number) => Ring, y0: number, y1: number,
  floors: number, bay: number, mat: Material): void {
  const fine = lod < 1, medium = lod < 2;
  const steps = fine ? Math.max(1, Math.ceil(floors / 3)) : medium ? Math.max(1, Math.ceil(floors / 8)) : 1;
  for (let k = 0; k < steps; k++) {
    const t0 = k / steps, t1 = (k + 1) / steps;
    loft(m, at(t0), at(t1), y0 + t0 * (y1 - y0), y0 + t1 * (y1 - y0), mat);
  }
  if (fine) glaze(m, at, y0, y1, floors, Math.max(bay, 3.4));
}

/** Both faces of a quad, for thin things seen from either side. */
function twoSided(m: MeshBuilder, a: [number, number, number], b: [number, number, number],
  c: [number, number, number], d: [number, number, number], mat: Material): void {
  m.quad(a, b, c, d, mat);
  m.quad(d, c, b, a, mat);
}

function crown(m: MeshBuilder, bp: Blueprint, lod: number, at: (t: number) => Ring,
  y0: number, top: number, fh: number, facade: Facade): void {
  const fine = lod < 1, medium = lod < 2;
  const last = at(1);
  let span = 0;
  for (const [x, z] of last) span = Math.max(span, Math.hypot(x, z));
  const [ex, ez] = reach(last);
  switch (bp.crown) {
    case 'flat':
      cap(m, last, top, MAT.ROOF);
      if (medium) plantFloor(m, last, top, 1.4);
      break;
    case 'raked': {
      const rake = Math.min(18, span * 0.55);
      let xmax = 0;
      for (const [x] of last) xmax = Math.max(xmax, Math.abs(x));
      const yAt = (x: number): number => top + rake * (0.5 + x / (xmax * 2));
      const n = last.length;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        m.quad([last[i][0], top, last[i][1]], [last[i][0], yAt(last[i][0]), last[i][1]],
          [last[j][0], yAt(last[j][0]), last[j][1]], [last[j][0], top, last[j][1]], fine ? MAT.DARK_TRIM : MAT.GLASS);
        m.tri([0, top + rake * 0.5, 0], [last[j][0], yAt(last[j][0]), last[j][1]],
          [last[i][0], yAt(last[i][0]), last[i][1]], MAT.DARK_TRIM);
      }
      if (bp.lit && medium) litCrown(m, last, top - 1.2, 1.0);
      return;
    }
    case 'dome': {
      cap(m, last, top, MAT.ROOF);
      const steps = fine ? 7 : 4;
      const ring = shrink(last, 0.82);
      let prev = ring, py = top;
      m.painted(TINT.ACCENT, () => {
        for (let k = 1; k <= steps; k++) {
          const a = (k / steps) * Math.PI * 0.5;
          const next = shrink(ring, Math.max(0.04, Math.cos(a)));
          const ny = top + Math.sin(a) * span * 0.55;
          loft(m, prev, next, py, ny, MAT.PAINT);
          prev = next; py = ny;
        }
        cap(m, prev, py, MAT.PAINT);
      });
      if (bp.lit && medium) litCrown(m, ring, top, 0.8);
      return;
    }
    case 'stepped': {
      const extra = Math.max(2, bp.floors - Math.round(bp.floors * 0.8));
      let y = top;
      cap(m, last, top, MAT.ROOF);
      for (const k of [0.74, 0.5]) {
        const r = shrink(last, k);
        const h = Math.ceil(extra / 2) * fh;
        if (facade === 'glass') shaft(m, lod, () => r, y, y + h, Math.ceil(extra / 2), 3.0);
        else massShaft(m, lod, () => r, y, y + h, Math.ceil(extra / 2), 3.4, facadeMat(facade === 'frame' ? 'concrete' : facade));
        cap(m, r, y + h, MAT.ROOF);
        y += h;
      }
      if (bp.lit && medium) litCrown(m, shrink(last, 0.5), y - 1.2, 1.0);
      return;
    }
    case 'lantern': {
      cap(m, last, top, MAT.ROOF);
      const inner = shrink(last, 0.7), tip = shrink(last, 0.28);
      loft(m, inner, tip, top, top + Math.min(24, span * 0.9), MAT.GLASS);
      m.painted(TINT.SIGN_LIT, () => cap(m, tip, top + Math.min(24, span * 0.9), MAT.PAINT));
      return;
    }
    case 'garden': {
      cap(m, last, top, MAT.ROOF);
      const rail = grow(last, 0.1);
      loft(m, rail, rail, top, top + 1.1, MAT.GLASS);
      if (fine) {
        const inner = shrink(last, 0.62);
        for (let i = 0; i < inner.length; i += 2) terraceTree(m, inner[i][0], top, inner[i][1], 5 + ((i * 7) % 3), 1.8);
      }
      m.painted(TINT.GREEN_DARK, () => cap(m, shrink(last, 0.9), top + 0.05, MAT.FOLIAGE));
      break;
    }
    case 'spire':
      cap(m, last, top, MAT.ROOF);
      if (medium) plantFloor(m, shrink(last, 0.6), top, fh);
      m.cone(0, 0, Math.max(1.2, span * 0.14), 0, top + fh, top + fh + Math.min(70, (top - y0) * 0.28), fine ? 10 : 6, MAT.METAL);
      break;
    case 'pyramid': {
      cap(m, last, top, MAT.ROOF);
      const h = Math.min(40, span * 0.95);
      loft(m, last, shrink(last, 0.04), top, top + h, fine ? MAT.GLASS : MAT.DARK_TRIM);
      cap(m, shrink(last, 0.04), top + h, MAT.METAL);
      break;
    }
    case 'pitched': {
      cap(m, last, top, MAT.ROOF);
      const alongX = ex >= ez;
      const h = Math.min(14, (alongX ? ez : ex) * 0.75);
      const wall = facade === 'glass' || facade === 'frame' ? MAT.CONCRETE : facadeMat(facade);
      if (alongX) {
        twoSided(m, [-ex, top, -ez], [ex, top, -ez], [ex, top + h, 0], [-ex, top + h, 0], MAT.ROOF_TILE);
        twoSided(m, [ex, top, ez], [-ex, top, ez], [-ex, top + h, 0], [ex, top + h, 0], MAT.ROOF_TILE);
        m.tri([ex, top, -ez], [ex, top, ez], [ex, top + h, 0], wall);
        m.tri([ex, top, ez], [ex, top, -ez], [ex, top + h, 0], wall);
        m.tri([-ex, top, ez], [-ex, top, -ez], [-ex, top + h, 0], wall);
        m.tri([-ex, top, -ez], [-ex, top, ez], [-ex, top + h, 0], wall);
      } else {
        twoSided(m, [-ex, top, -ez], [-ex, top, ez], [0, top + h, ez], [0, top + h, -ez], MAT.ROOF_TILE);
        twoSided(m, [ex, top, ez], [ex, top, -ez], [0, top + h, -ez], [0, top + h, ez], MAT.ROOF_TILE);
        m.tri([-ex, top, ez], [ex, top, ez], [0, top + h, ez], wall);
        m.tri([ex, top, ez], [-ex, top, ez], [0, top + h, ez], wall);
        m.tri([ex, top, -ez], [-ex, top, -ez], [0, top + h, -ez], wall);
        m.tri([-ex, top, -ez], [ex, top, -ez], [0, top + h, -ez], wall);
      }
      return;
    }
    case 'helipad': {
      cap(m, last, top, MAT.ROOF);
      if (medium) plantFloor(m, shrink(last, 0.7), top, 1.2);
      const r = Math.max(3, Math.min(10, Math.min(ex, ez) * 0.85));
      const seg = fine ? 20 : 10;
      for (const [px, pz] of [[0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]]) {
        m.cylinder(px * r, pz * r, 0.3, top, top + 2.4, 6, MAT.METAL);
      }
      m.cylinder(0, 0, r, top + 2.4, top + 2.8, seg, MAT.CONCRETE);
      m.painted(TINT.ACCENT, () => {
        m.box([-r * 0.35, top + 2.8, -0.35], [r * 0.35, top + 2.85, 0.35], MAT.PAINT);
        m.box([-r * 0.35, top + 2.8, -r * 0.4], [-r * 0.2, top + 2.85, r * 0.4], MAT.PAINT);
        m.box([r * 0.2, top + 2.8, -r * 0.4], [r * 0.35, top + 2.85, r * 0.4], MAT.PAINT);
      });
      if (bp.lit && medium) litCrown(m, plan(r, r, 1, seg), top + 2.4, 0.4);
      return;
    }
    case 'antenna': {
      cap(m, last, top, MAT.ROOF);
      if (medium) plantFloor(m, shrink(last, 0.6), top, fh);
      const h = Math.min(60, (top - y0) * 0.22) + 8;
      m.cylinder(0, 0, 0.7, top + fh, top + fh + h, fine ? 8 : 5, MAT.METAL);
      m.cylinder(ex * 0.35, 0, 0.35, top + fh, top + fh + h * 0.45, 5, MAT.METAL);
      m.cylinder(-ex * 0.35, ez * 0.2, 0.35, top + fh, top + fh + h * 0.3, 5, MAT.METAL);
      m.painted(TINT.SIGN_LIT, () => m.box([-0.6, top + fh + h, -0.6], [0.6, top + fh + h + 1.2, 0.6], MAT.PAINT));
      break;
    }
    case 'halo': {
      cap(m, last, top, MAT.ROOF);
      const ring = shrink(last, 0.86);
      const y = top + Math.min(10, span * 0.3) + 2;
      for (let i = 0; i < ring.length; i += Math.max(1, Math.floor(ring.length / 4))) {
        m.cylinder(ring[i][0] * 0.98, ring[i][1] * 0.98, 0.25, top, y, 5, MAT.METAL);
      }
      m.painted(bp.lit ? TINT.SIGN_LIT : TINT.ACCENT, () => {
        loft(m, ring, ring, y, y + 1.2, MAT.PAINT);
        loft(m, ring, ring, y, y + 1.2, MAT.PAINT, true);
      });
      return;
    }
  }
  if (bp.lit && medium) litCrown(m, last, top - 1.2, 1.0);
}

/** What a blueprint holds, for the tile and the stats line. */
export function blueprintCapacity(raw: Blueprint): { homes: number; jobs: number; height: number } {
  const bp = cleanBlueprint(raw);
  const { pieces: towers } = layout(bp, 2);
  let floorArea = bp.podium > 0 ? bp.width * 8 * bp.depth * 8 * bp.podium * 0.8 : 0;
  let height = 0;
  for (const t of towers) {
    for (const p of t) {
      floorArea += (area(p.at(0)) + area(p.at(1))) / 2 * p.floors;
      height = Math.max(height, p.y1);
    }
  }
  if (bp.zone === 'residential') return { homes: Math.max(4, Math.round(floorArea / 120)), jobs: 0, height };
  return { homes: 0, jobs: Math.max(10, Math.round(floorArea / (bp.zone === 'office' ? 22 : 45))), height };
}

/** A blueprint as a placeable building. `mod` is the id of the mod that carries it. */
export function blueprintAsset(raw: Blueprint, mod: string, key: string): AssetDef {
  const bp = cleanBlueprint(raw);
  const cap = blueprintCapacity(bp);
  const colour = rgb(bp.colour);
  const accent = rgb(bp.accent);
  const people = cap.homes + cap.jobs;
  const storeys = bp.floors + bp.sections.reduce((s, x) => s + x.floors, 0);
  const towers = bp.layout === 'single' ? '' : bp.layout === 'twin' ? 'Twin towers, ' : 'Three towers, ';
  return {
    id: `mod.${mod}.${key}`,
    name: bp.name,
    zone: bp.zone,
    density: 'high',
    variant: 'sculpted',
    theme: 'modern',
    signature: true,
    mod,
    footprint: [bp.width, bp.depth],
    height: 0,
    brand: { name: bp.name, colour, accent, sign: 'box' },
    sim: {
      ...(cap.homes > 0 ? { households: cap.homes } : { jobs: cap.jobs }),
      powerKW: people * 2.6, waterM3: people * 0.3, garbagePerWeek: people * 5,
      pollution: 0, upkeep: Math.round(people * 0.7),
    },
    note: `${towers}${storeys} storeys, ${Math.round(cap.height)} m, ${cap.homes > 0 ? `${cap.homes} homes` : `${cap.jobs} jobs`}. A blueprint from a mod.`,
    iconSvg: blueprintSvg(bp, 52),
    build: (lod: number) => blueprintMesh(bp, lod),
  };
}

const FACADE_FILL: Record<Blueprint['facade'], string> = {
  glass: '#30455c', frame: '', stone: '#cbbd9f', brick: '#a0523a', concrete: '#b9b9b2',
};

/**
 * The blueprint as an elevation: the podium, the shaft narrowing, a line at
 * each plant floor, and the crown, to scale and standing on a ground line.
 */
export function blueprintSvg(raw: Blueprint, size: number): string {
  const bp = cleanBlueprint(raw);
  const { hx, lotX } = extents(bp);
  const podH = bp.podium * bp.floorHeight;
  const floors = bp.crown === 'stepped' ? Math.round(bp.floors * 0.8) : bp.floors;
  const shaftH = floors * bp.floorHeight + (bp.podium === 0 ? bp.floorHeight * 1.5 : 0);
  const crownH = bp.crown === 'spire' ? Math.min(70, shaftH * 0.28) + bp.floorHeight
    : bp.crown === 'raked' ? Math.min(18, hx * 0.55) : bp.crown === 'dome' ? hx * 0.5
      : bp.crown === 'lantern' ? Math.min(24, hx * 0.9) : bp.crown === 'stepped' ? (bp.floors - floors) * bp.floorHeight : 2;
  const total = podH + shaftH + crownH;
  const W = Math.max(lotX * 2, total * 0.55);
  const s = 88 / Math.max(W, total);
  const cx = 50, gy = 94;
  const X = (x: number): number => cx + x * s, Y = (y: number): number => gy - y * s;
  const fill = bp.facade === 'frame' ? bp.colour : FACADE_FILL[bp.facade];
  const parts: string[] = [];
  parts.push(`<line x1="4" y1="${gy}" x2="96" y2="${gy}" stroke="#6d8098" stroke-width="1"/>`);
  if (podH > 0) {
    parts.push(`<rect x="${X(-lotX + 2)}" y="${Y(podH)}" width="${(lotX - 2) * 2 * s}" height="${podH * s}" fill="#8d97a3"/>`);
  }
  const b0 = hx, b1 = hx * bp.taper;
  const y0 = podH, y1 = podH + shaftH;
  parts.push(`<polygon points="${X(-b0)},${Y(y0)} ${X(b0)},${Y(y0)} ${X(b1)},${Y(y1)} ${X(-b1)},${Y(y1)}" fill="${fill}"/>`);
  // Floor lines, a few of them, so the height reads.
  const lines = Math.min(24, floors);
  for (let k = 1; k < lines; k++) {
    const t = k / lines, y = y0 + t * shaftH, w = b0 + (b1 - b0) * t;
    parts.push(`<line x1="${X(-w)}" y1="${Y(y)}" x2="${X(w)}" y2="${Y(y)}" stroke="rgba(255,255,255,.18)" stroke-width="0.6"/>`);
  }
  if (bp.bands > 0) {
    for (let f = bp.bands; f < floors; f += bp.bands) {
      const t = f / floors, y = y0 + t * shaftH, w = b0 + (b1 - b0) * t;
      parts.push(`<rect x="${X(-w)}" y="${Y(y) - 1}" width="${w * 2 * s}" height="2" fill="#1b2027"/>`);
    }
  }
  const lit = bp.lit ? bp.colour : '#9aa6b4';
  switch (bp.crown) {
    case 'raked': parts.push(`<polygon points="${X(-b1)},${Y(y1)} ${X(b1)},${Y(y1)} ${X(b1)},${Y(y1 + crownH)}" fill="#20262e"/>`); break;
    case 'dome': parts.push(`<path d="M${X(-b1 * 0.82)},${Y(y1)} A${b1 * 0.82 * s},${crownH * s} 0 0 1 ${X(b1 * 0.82)},${Y(y1)} Z" fill="${lit}"/>`); break;
    case 'spire': parts.push(`<polygon points="${X(-b1 * 0.14)},${Y(y1)} ${X(b1 * 0.14)},${Y(y1)} ${X(0)},${Y(y1 + crownH)}" fill="#9aa6b4"/>`); break;
    case 'lantern': parts.push(`<polygon points="${X(-b1 * 0.7)},${Y(y1)} ${X(b1 * 0.7)},${Y(y1)} ${X(b1 * 0.28)},${Y(y1 + crownH)} ${X(-b1 * 0.28)},${Y(y1 + crownH)}" fill="#5d7690"/>`
      + `<rect x="${X(-b1 * 0.28)}" y="${Y(y1 + crownH) - 1}" width="${b1 * 0.56 * s}" height="2" fill="${lit}"/>`); break;
    case 'stepped': {
      const h = crownH / 2;
      parts.push(`<rect x="${X(-b1 * 0.74)}" y="${Y(y1 + h)}" width="${b1 * 1.48 * s}" height="${h * s}" fill="${fill}"/>`);
      parts.push(`<rect x="${X(-b1 * 0.5)}" y="${Y(y1 + crownH)}" width="${b1 * s}" height="${h * s}" fill="${fill}"/>`);
      break;
    }
    case 'garden': parts.push(`<ellipse cx="${X(-b1 * 0.4)}" cy="${Y(y1 + 2)}" rx="${b1 * 0.25 * s}" ry="${3 * s}" fill="#4f8a4a"/><ellipse cx="${X(b1 * 0.3)}" cy="${Y(y1 + 2)}" rx="${b1 * 0.2 * s}" ry="${2.5 * s}" fill="#4f8a4a"/>`); break;
    default: break;
  }
  if (bp.lit && bp.crown !== 'lantern') parts.push(`<rect x="${X(-b1)}" y="${Y(y1) - 0.2}" width="${b1 * 2 * s}" height="1.4" fill="${bp.colour}"/>`);
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}
