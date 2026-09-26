/**
 * Blueprints: buildings a player designs, turned into real models.
 *
 * A blueprint is a short list of decisions -- a plan shape and footprint, how
 * many storeys, how the tower narrows and turns, what its facade is made of,
 * what colour, what it stands on and how it meets the sky -- and this file
 * builds from it the same kind of mesh the game's own towers are: lofted rings,
 * panes that follow them, slab edges, plant floors, a crown. It is how a mod
 * adds a building without shipping code: the mod is the blueprint, and the
 * blueprint is data, clamped here to what the renderer and the lot can carry.
 *
 * The same blueprint also draws itself as an elevation, in SVG, for the
 * studio's preview and for the building's tile in the drawer.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { Material } from '../mesh';
import type { AssetDef } from '../types';
import { cap, loft, plan, scaled } from './signature-parts';
import type { Ring } from './signature-parts';
import { glaze, plate } from './towers';
import { grow, litCrown, plantFloor, shaft, shrink, soffit, square, triPlan } from './supertalls';
import { skinShaft, terraceTree } from './supertalls-unique';
import { entrance } from '../parts';

export const BP_SHAPES = ['box', 'rounded', 'round', 'triangle', 'chamfered'] as const;
export const BP_FACADES = ['glass', 'frame', 'stone', 'brick', 'concrete'] as const;
export const BP_CROWNS = ['flat', 'raked', 'dome', 'stepped', 'lantern', 'garden', 'spire'] as const;
export const BP_ZONES = ['office', 'commercial', 'residential'] as const;

export interface Blueprint {
  name: string;
  zone: typeof BP_ZONES[number];
  /** Footprint in cells, 8 m each. */
  width: number;
  depth: number;
  floors: number;
  floorHeight: number;
  shape: typeof BP_SHAPES[number];
  /** Width at the top as a fraction of the bottom. */
  taper: number;
  /** Radians the plan turns over the whole height. */
  twist: number;
  facade: typeof BP_FACADES[number];
  /** #rrggbb: the frame, the stone, the lit crown. */
  colour: string;
  crown: typeof BP_CROWNS[number];
  /** Storeys of podium under the tower, 0 for none. */
  podium: number;
  balconies: boolean;
  /** A louvred plant floor every this many storeys, 0 for none. */
  bands: number;
  lit: boolean;
}

export const DEFAULT_BLUEPRINT: Blueprint = {
  name: 'My Tower', zone: 'office', width: 6, depth: 6, floors: 36, floorHeight: 3.8,
  shape: 'rounded', taper: 0.8, twist: 0.3, facade: 'glass', colour: '#c9a45c', crown: 'raked',
  podium: 3, balconies: false, bands: 12, lit: true,
};

const clampN = (v: unknown, lo: number, hi: number, dflt: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt;
const oneOf = <T extends string>(v: unknown, list: readonly T[], dflt: T): T =>
  (typeof v === 'string' && (list as readonly string[]).includes(v) ? v as T : dflt);

/** Cleans anything into a buildable blueprint: every number in range, every choice a real one. */
export function cleanBlueprint(raw: unknown): Blueprint {
  const o = (raw !== null && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_BLUEPRINT;
  const colour = typeof o.colour === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.colour) ? o.colour.toLowerCase() : d.colour;
  return {
    name: typeof o.name === 'string' && o.name.trim() !== '' ? o.name.trim().slice(0, 40) : d.name,
    zone: oneOf(o.zone, BP_ZONES, d.zone),
    width: Math.round(clampN(o.width, 3, 12, d.width)),
    depth: Math.round(clampN(o.depth, 3, 12, d.depth)),
    floors: Math.round(clampN(o.floors, 3, 90, d.floors)),
    floorHeight: clampN(o.floorHeight, 3, 5, d.floorHeight),
    shape: oneOf(o.shape, BP_SHAPES, d.shape),
    taper: clampN(o.taper, 0.45, 1, d.taper),
    twist: clampN(o.twist, -1.6, 1.6, d.twist),
    facade: oneOf(o.facade, BP_FACADES, d.facade),
    colour,
    crown: oneOf(o.crown, BP_CROWNS, d.crown),
    podium: Math.round(clampN(o.podium, 0, 6, d.podium)),
    balconies: o.balconies === true,
    bands: Math.round(clampN(o.bands, 0, 30, d.bands)),
    lit: o.lit !== false,
  };
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** The half-extents of the tower's plan, inside its podium if it has one. */
function extents(bp: Blueprint): { hx: number; hz: number; lotX: number; lotZ: number } {
  const lotX = bp.width * 4, lotZ = bp.depth * 4;
  const inset = bp.podium > 0 ? 0.76 : 1;
  return { hx: (lotX - 2.2) * inset, hz: (lotZ - 2.2) * inset, lotX, lotZ };
}

function basePlan(bp: Blueprint, hx: number, hz: number, lod: number): Ring {
  const n = lod < 1 ? 24 : lod < 2 ? 16 : 10;
  switch (bp.shape) {
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
  }
}

/**
 * The plan, shrunk if it has to be to stay on its lot all the way up: a long
 * plan that turns swings its corners out past the footprint on the way.
 */
function fitted(bp: Blueprint, base: Ring, lotX: number, lotZ: number): Ring {
  const out = bp.balconies ? 1.3 : 0.4;
  let f = 1;
  for (let k = 0; k <= 12; k++) {
    const t = k / 12;
    const r = scaled(base, 1 - (1 - bp.taper) * t, 1 - (1 - bp.taper) * t, bp.twist * t);
    let ex = 0, ez = 0;
    for (const [x, z] of r) { ex = Math.max(ex, Math.abs(x)); ez = Math.max(ez, Math.abs(z)); }
    f = Math.min(f, (lotX - 0.3 - out) / Math.max(1e-6, ex), (lotZ - 0.3 - out) / Math.max(1e-6, ez));
  }
  return f < 1 ? scaled(base, f) : base;
}

function perimeter(r: Ring): number {
  let p = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length];
    p += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return p;
}

/** The mesh a blueprint describes. */
export function blueprintMesh(bp: Blueprint, lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const { hx, hz, lotX, lotZ } = extents(bp);
  const fh = bp.floorHeight;

  // The podium: glass at the street, the facade's material above, a door.
  let y0 = 0.1;
  if (bp.podium > 0) {
    const ph = bp.podium * fh;
    const pr = square(lotX - 2.2, lotZ - 2.2);
    const glassH = Math.min(ph, 6.5);
    loft(m, pr, pr, 0.1, glassH, fine ? MAT.SHOPFRONT : MAT.GLASS);
    if (ph > glassH) loft(m, grow(pr, 0.3), grow(pr, 0.3), glassH, ph, podiumMat(bp));
    soffit(m, grow(pr, 0.3), glassH, MAT.CONCRETE);
    cap(m, grow(pr, 0.3), ph, MAT.ROOF);
    if (fine) entrance(m, { axis: 'z', sign: 1, plane: lotZ - 2.2 }, 0, { width: 5.0, height: Math.min(glassH - 0.6, 5.0), double: true, glazed: true, canopy: 1.8 });
    y0 = ph;
  }

  const base = fitted(bp, basePlan(bp, hx, hz, lod), lotX, lotZ);
  const at = (t: number): Ring => scaled(base, 1 - (1 - bp.taper) * t, 1 - (1 - bp.taper) * t, bp.twist * t);
  const floors = bp.crown === 'stepped' ? Math.max(3, Math.round(bp.floors * 0.8)) : bp.floors;
  const top = y0 + floors * fh;
  // Panes kept to a budget: a wide, tall tower gets wider bays rather than
  // a hundred thousand triangles.
  const bay = Math.max(3.0, (perimeter(base) * floors) / 7000);
  if (bp.podium === 0) {
    // A lobby of glass at the foot of the shaft.
    const lob = shrink(base, 0.92);
    loft(m, lob, lob, 0.1, fh * 1.5, fine ? MAT.SHOPFRONT : MAT.GLASS);
    soffit(m, base, fh * 1.5, MAT.CONCRETE);
    y0 = fh * 1.5;
  }
  const shaftTop = Math.max(y0 + fh, top);
  if (bp.facade === 'glass') shaft(m, lod, at, y0, shaftTop, floors, bay);
  else if (bp.facade === 'frame') skinShaft(m, lod, at, y0, shaftTop, floors, bay, TINT.BRAND);
  else massShaft(m, lod, at, y0, shaftTop, floors, bay, facadeMat(bp));

  // Balconies: a slab edge standing out on every floor or every other.
  if (bp.balconies && medium) {
    const step = fine ? (floors > 50 ? 2 : 1) : 3;
    m.painted(TINT.NONE, () => {
      for (let f = 1; f < floors; f += step) {
        const t = f / floors;
        plate(m, at(t), grow(at(t), 1.25), y0 + f * fh - 0.22, 0.22, MAT.TRIM, MAT.TRIM);
      }
    });
  }
  // Plant floors.
  if (bp.bands > 0 && medium) {
    for (let f = bp.bands; f < floors - 1; f += bp.bands) {
      const t = f / floors;
      plantFloor(m, at(t), y0 + f * fh - 1.0, 2.0);
    }
  }
  crown(m, bp, lod, at, y0, shaftTop, fh);
  return m;
}

function facadeMat(bp: Blueprint): Material {
  return bp.facade === 'stone' ? MAT.STONE : bp.facade === 'brick' ? MAT.BRICK : MAT.CONCRETE;
}
function podiumMat(bp: Blueprint): Material {
  return bp.facade === 'brick' ? MAT.BRICK : bp.facade === 'concrete' ? MAT.CONCRETE : MAT.STONE;
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

function crown(m: MeshBuilder, bp: Blueprint, lod: number, at: (t: number) => Ring,
  y0: number, top: number, fh: number): void {
  const fine = lod < 1, medium = lod < 2;
  const last = at(1);
  let span = 0;
  for (const [x, z] of last) span = Math.max(span, Math.hypot(x, z));
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
        if (bp.facade === 'glass') shaft(m, lod, () => r, y, y + h, Math.ceil(extra / 2), 3.0);
        else massShaft(m, lod, () => r, y, y + h, Math.ceil(extra / 2), 3.4, facadeMat(bp));
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
  }
  if (bp.lit && medium) litCrown(m, last, top - 1.2, 1.0);
}

/** What a blueprint holds, for the tile and the stats line. */
export function blueprintCapacity(bp: Blueprint): { homes: number; jobs: number; height: number } {
  const { hx, hz } = extents(bp);
  const area = (hx * 2) * (hz * 2) * (1 + bp.taper) / 2;
  const floorArea = area * bp.floors + (bp.podium > 0 ? bp.width * 8 * bp.depth * 8 * bp.podium : 0);
  const height = bp.podium * bp.floorHeight + bp.floors * bp.floorHeight;
  if (bp.zone === 'residential') return { homes: Math.max(4, Math.round(floorArea / 120)), jobs: 0, height };
  return { homes: 0, jobs: Math.max(10, Math.round(floorArea / (bp.zone === 'office' ? 22 : 45))), height };
}

/** A blueprint as a placeable building. `mod` is the id of the mod that carries it. */
export function blueprintAsset(bp: Blueprint, mod: string, key: string): AssetDef {
  const cap = blueprintCapacity(bp);
  const colour = rgb(bp.colour);
  const accent: [number, number, number] = [colour[0] * 0.55 + 0.2, colour[1] * 0.55 + 0.2, colour[2] * 0.55 + 0.2];
  const people = cap.homes + cap.jobs;
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
    note: `${bp.floors} storeys, ${Math.round(cap.height)} m, ${cap.homes > 0 ? `${cap.homes} homes` : `${cap.jobs} jobs`}. A blueprint from a mod.`,
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
