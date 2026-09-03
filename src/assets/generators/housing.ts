/**
 * Housing, organised by theme.
 *
 * Five themes, three densities, five buildings in each: seventy-five houses
 * and blocks that are all built from the same fifteen plans. That sounds like
 * a recipe for repetition and is the opposite of one -- the plan decides the
 * massing, and the theme decides everything you actually look at: the wall
 * material, the roof shape and pitch, the eaves, the window proportion and
 * rhythm, the shutters or the grilles, the porch or the balcony. A European
 * terrace and a North American row have the same footprint and nothing else
 * in common.
 *
 * Organising it this way is also what makes a district read as a place. The
 * spawner picks a theme for an area and then picks freely inside it, so every
 * street is varied and no street is incoherent.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import { idSeed } from '../types';
import type { AssetDef, Density } from '../types';
import { THEMES, THEME_ORDER, THEME_KEY, hip, mansard, dormer, brackets } from '../themes';
import type { Theme, ThemeProfile } from '../themes';
import {
  awning, balconies, band, backyard, bollards, entrance, fasciaSign, fireEscape, kerb,
  parapet, planter, railing, ribbon, ring, roofClutter, shopfront, windowGrid,
} from '../parts';
import type { Wall } from '../parts';

// ------------------------------------------------------------------ pieces

/** The roof the theme calls for, over a footprint. */
function roofOver(m: MeshBuilder, T: ThemeProfile, x0: number, z0: number, x1: number, z1: number,
                  y: number, opts: { dormers?: number; along?: 'x' | 'z' } = {}): number {
  const w = x1 - x0, d = z1 - z0;
  const e = T.eave;
  const ax0 = x0 - e, az0 = z0 - e, ax1 = x1 + e, az1 = z1 + e;
  const span = Math.min(w, d) + e * 2;
  const along = opts.along ?? (w >= d ? 'x' : 'z');

  if (T.roof === 'flat') {
    m.box([ax0, y, az0], [ax1, y + 0.12, az1], T.cover);
    parapet(m, ax0, az0, ax1, az1, y + 0.12, 0.8, 0.14, T.wall);
    return y + 0.92;
  }
  // Eaves: a thin overhanging slab. A roof flush with the wall reads as a lid.
  m.box([ax0, y - 0.26, az0], [ax1, y, az1], T.trim);
  if (T.roof === 'hip') {
    const h = span * T.pitch;
    hip(m, ax0, az0, ax1, az1, y, h, T.cover);
    if (e > 0.5) brackets(m, x0, z0, x1, z1, y, e);
    return y + h;
  }
  if (T.roof === 'mansard') {
    const h = span * T.pitch;
    mansard(m, ax0, az0, ax1, az1, y, h, T.cover, T.wall);
    return y + h;
  }
  const h = span * T.pitch;
  m.gable([ax0, y, az0], [ax1, y, az1], h, along, T.cover, T.wall);
  const n = opts.dormers ?? 0;
  for (let i = 0; i < n; i++) {
    const cx = x0 + ((i + 0.5) / n) * w;
    if (along === 'x') dormer(m, cx, az1 - Math.min(d, w) * 0.22, 1, y + h * 0.34, T);
  }
  return y + h;
}

/**
 * Windows in the theme's rhythm, with whatever the theme hangs beside them.
 *
 * The shutter and the grille are the cheapest tells in the library: the same
 * wall with the same holes in it reads as Provence or as Kowloon depending on
 * which of the two it gets.
 */
function punched(m: MeshBuilder, T: ThemeProfile, w: Wall, u0: number, u1: number,
                 o: { floors: number; base: number; skipGround?: boolean }): void {
  const span = u1 - u0;
  const count = Math.max(1, Math.round((span / 6) * T.rhythm));
  const first = o.skipGround ? 1 : 0;
  // A framed opening is four boxes and forty-odd triangles. That is right for
  // a house and ruinous for a sixteen-storey block: the same wall would cost
  // more than the whole building's budget. Above a few dozen openings the
  // frame becomes a continuous lintel and cill per storey -- which is what a
  // repetitive facade actually looks like anyway -- and the glass a quad.
  const lite = (o.floors - first) * count > 22;
  for (let f = first; f < o.floors; f++) {
    const y0 = o.base + f * T.floorH;
    if (!lite) {
      windowGrid(m, w, u0, u1, {
        floors: 1, floorH: T.floorH, base: y0, count,
        width: T.winW, height: T.winH, sill: true,
      });
    } else {
      const d0 = w.plane + w.sign * 0.012;
      for (let i = 0; i < count; i++) {
        const c = u0 + ((i + 0.5) / count) * span;
        const a = c - T.winW / 2, b = c + T.winW / 2;
        if (w.axis === 'x') {
          if (w.sign > 0) m.signFace([d0, y0, b], [d0, y0, a], [d0, y0 + T.winH, a], [d0, y0 + T.winH, b], MAT.PANE);
          else m.signFace([d0, y0, a], [d0, y0, b], [d0, y0 + T.winH, b], [d0, y0 + T.winH, a], MAT.PANE);
        } else if (w.sign > 0) {
          m.signFace([a, y0, d0], [b, y0, d0], [b, y0 + T.winH, d0], [a, y0 + T.winH, d0], MAT.PANE);
        } else {
          m.signFace([b, y0, d0], [a, y0, d0], [a, y0 + T.winH, d0], [b, y0 + T.winH, d0], MAT.PANE);
        }
      }
      // Continuous cill and lintel, standing proud so they cast the reveal.
      const p0 = w.plane + w.sign * 0.02, p1 = w.plane + w.sign * 0.15;
      const lo = Math.min(p0, p1), hi = Math.max(p0, p1);
      for (const [ya, yb] of [[y0 - 0.14, y0], [y0 + T.winH, y0 + T.winH + 0.16]] as const) {
        if (w.axis === 'x') m.box([lo, ya, u0], [hi, yb, u1], T.trim);
        else m.box([u0, ya, lo], [u1, yb, hi], T.trim);
      }
    }
    // Shutters and grilles are detail for the lower storeys; nobody reads one
    // at the sixteenth floor and every one of them costs ten triangles.
    if ((!T.shutters && !T.grille) || (lite && f > first + 2) || o.base > 10) continue;
    for (let i = 0; i < count; i++) {
      const c = u0 + ((i + 0.5) / count) * span;
      if (T.shutters) {
        m.painted(TINT.DOOR, () => {
          for (const s of [-1, 1]) {
            const a = c + s * (T.winW / 2 + 0.14);
            const b = a + s * T.winW * 0.5;
            const [lo, hi] = [Math.min(a, b), Math.max(a, b)];
            if (w.axis === 'x') m.box([w.plane + w.sign * 0.02, y0, lo], [w.plane + w.sign * 0.13, y0 + T.winH, hi], MAT.TRIM);
            else m.box([lo, y0, w.plane + w.sign * 0.02], [hi, y0 + T.winH, w.plane + w.sign * 0.13], MAT.TRIM);
          }
        });
      } else {
        // Security grille: five bars across the opening, proud of the glass.
        m.painted(TINT.METAL_DARK, () => {
          for (let k = 0; k < 5; k++) {
            const p = c - T.winW / 2 + ((k + 0.5) / 5) * T.winW;
            if (w.axis === 'x') m.box([w.plane + w.sign * 0.08, y0 + 0.05, p - 0.03], [w.plane + w.sign * 0.14, y0 + T.winH - 0.05, p + 0.03], MAT.TRIM);
            else m.box([p - 0.03, y0 + 0.05, w.plane + w.sign * 0.08], [p + 0.03, y0 + T.winH - 0.05, w.plane + w.sign * 0.14], MAT.TRIM);
          }
        });
      }
    }
  }
}

/**
 * Glazing bands, for the themes and densities that take ribbon windows.
 *
 * Drawn rather than framed. A framed ribbon is four boxes plus a mullion box
 * every 1.8m, which on a fourteen-storey tower with four elevations is more
 * triangles than the rest of the building put together. A quad of glass, a
 * spandrel below it and three mullions read the same from anywhere the game
 * is played from.
 */
function banded(m: MeshBuilder, T: ThemeProfile, w: Wall, u0: number, u1: number,
                floors: number, base: number): void {
  const p = w.plane + w.sign * 0.02;
  const lo = Math.min(p, w.plane + w.sign * 0.16), hi = Math.max(p, w.plane + w.sign * 0.16);
  const mull = Math.max(2, Math.min(5, Math.round((u1 - u0) / 3.4)));
  for (let f = 0; f < floors; f++) {
    const y0 = base + f * T.floorH + 0.8;
    const y1 = base + (f + 1) * T.floorH - 0.42;
    const g = w.plane + w.sign * 0.05;
    if (w.axis === 'x') {
      if (w.sign > 0) m.signFace([g, y0, u1], [g, y0, u0], [g, y1, u0], [g, y1, u1], MAT.PANE);
      else m.signFace([g, y0, u0], [g, y0, u1], [g, y1, u1], [g, y1, u0], MAT.PANE);
      m.box([lo, y1, u0 - 0.1], [hi, base + (f + 1) * T.floorH + 0.8, u1 + 0.1], T.trim);
      for (let i = 1; i < mull; i++) {
        const pu = u0 + (i / mull) * (u1 - u0);
        m.box([lo, y0, pu - 0.06], [hi, y1, pu + 0.06], T.trim);
      }
    } else {
      if (w.sign > 0) m.signFace([u0, y0, g], [u1, y0, g], [u1, y1, g], [u0, y1, g], MAT.PANE);
      else m.signFace([u1, y0, g], [u0, y0, g], [u0, y1, g], [u1, y1, g], MAT.PANE);
      m.box([u0 - 0.1, y1, lo], [u1 + 0.1, base + (f + 1) * T.floorH + 0.8, hi], T.trim);
      for (let i = 1; i < mull; i++) {
        const pu = u0 + (i / mull) * (u1 - u0);
        m.box([pu - 0.06, y0, lo], [pu + 0.06, y1, hi], T.trim);
      }
    }
  }
}

/** Whatever the theme puts at the front door. */
function doorway(m: MeshBuilder, T: ThemeProfile, w: Wall, centre: number, grand = false): void {
  entrance(m, w, centre, {
    width: grand ? 2.4 : 1.15, height: grand ? 2.9 : 2.25, double: grand,
    fanlight: T.id === 'european' || T.id === 'heritage',
    glazed: T.id === 'modern' || grand,
    steps: T.id === 'american' ? 3 : T.id === 'european' ? 2 : 1,
    ...(T.id === 'modern' || T.id === 'asian' ? { canopy: 1.6 } : {}),
  });
}

/** A veranda across a front, which is the North American tell. */
function veranda(m: MeshBuilder, T: ThemeProfile, x0: number, x1: number, z: number, depth: number, y: number): void {
  m.box([x0, 0.02, z], [x1, 0.42, z + depth], MAT.CONCRETE);
  m.box([x0 - 0.2, y, z - 0.1], [x1 + 0.2, y + 0.28, z + depth + 0.2], T.trim);
  m.gable([x0 - 0.2, y + 0.28, z - 0.1], [x1 + 0.2, y + 0.28, z + depth + 0.2], 0.5, 'x', T.cover, T.trim);
  const n = Math.max(2, Math.round((x1 - x0) / 2.6));
  for (let i = 0; i <= n; i++) {
    const px = x0 + (i / n) * (x1 - x0);
    m.box([px - 0.11, 0.42, z + depth - 0.32], [px + 0.11, y, z + depth - 0.1], T.trim);
  }
  railing(m, x0 + 0.2, x1 - 0.2, z + depth - 0.2, 0.42, 0.95, 1.2);
}

/** A boundary wall with a gate, which is what makes a compound a compound. */
function compound(m: MeshBuilder, T: ThemeProfile, x0: number, z0: number, x1: number, z1: number, h: number): void {
  const gx0 = (x0 + x1) / 2 - 1.6, gx1 = (x0 + x1) / 2 + 1.6;
  const wall = (a: number, b: number, c: number, d: number): void => m.box([a, 0, c], [b, h, d], T.base);
  wall(x0, gx0, z1 - 0.22, z1);
  wall(gx1, x1, z1 - 0.22, z1);
  wall(x0, x1, z0, z0 + 0.22);
  wall(x0, x0 + 0.22, z0, z1);
  wall(x1 - 0.22, x1, z0, z1);
  ring(m, x0, z0, x1, z1, h, 0.12, 0.07, T.trim);
  // Gate piers and leaves.
  for (const px of [gx0, gx1]) m.box([px - 0.3, 0, z1 - 0.34], [px + 0.3, h + 0.5, z1 + 0.12], T.base);
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i < 9; i++) {
      const px = gx0 + 0.35 + (i / 8) * (gx1 - gx0 - 0.7);
      m.box([px - 0.045, 0.05, z1 - 0.12], [px + 0.045, h * 0.92, z1 - 0.04], MAT.TRIM);
    }
    m.box([gx0 + 0.3, h * 0.86, z1 - 0.12], [gx1 - 0.3, h * 0.92, z1 - 0.04], MAT.TRIM);
  });
}

/** The crown a tall block gets, which differs by theme as much as its base. */
function crown(m: MeshBuilder, T: ThemeProfile, x0: number, z0: number, x1: number, z1: number,
               y: number, seed: number): number {
  switch (T.id) {
    case 'european': {
      const h = Math.min(x1 - x0, z1 - z0) * 0.26;
      mansard(m, x0, z0, x1, z1, y, h, T.cover, T.wall);
      return y + h;
    }
    case 'asian': {
      // A hipped cap on a set-back attic storey: the Asian residential tower
      // crown, and the reason those skylines are not flat.
      const i = Math.min(x1 - x0, z1 - z0) * 0.14;
      m.box([x0 + i, y, z0 + i], [x1 - i, y + 2.6, z1 - i], T.wall, { roof: T.cover });
      const h = Math.min(x1 - x0, z1 - z0) * 0.2;
      hip(m, x0 + i - 0.7, z0 + i - 0.7, x1 - i + 0.7, z1 - i + 0.7, y + 2.6, h, T.cover);
      parapet(m, x0, z0, x1, z1, y, 1.0, 0.14, T.wall);
      return y + 2.6 + h;
    }
    case 'heritage': {
      const h = Math.min(x1 - x0, z1 - z0) * 0.34;
      m.gable([x0, y, z0], [x1, y, z1], h, x1 - x0 >= z1 - z0 ? 'x' : 'z', T.cover, T.wall);
      return y + h;
    }
    case 'american': {
      parapet(m, x0, z0, x1, z1, y, 1.1, 0.2, T.base);
      // Water tank on a frame, the New York roofscape in one object.
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      m.painted(TINT.WOOD, () => m.cylinder(cx, cz, 1.7, y + 2.6, y + 6.0, 10, MAT.TIMBER));
      m.cone(cx, cz, 1.7, 0, y + 6.0, y + 7.1, 10, T.cover);
      m.painted(TINT.METAL_DARK, () => {
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          m.pipe([cx + sx * 1.3, y, cz + sz * 1.3], [cx + sx * 1.3, y + 2.6, cz + sz * 1.3], 0.09, MAT.TRIM, 5);
        }
      });
      roofClutter(m, x0 + 1.5, z0 + 1.5, x1 - 1.5, z1 - 1.5, y, seed, 0.7);
      return y + 7.1;
    }
    default: {
      // Modern: a set-back plant enclosure behind a slim parapet.
      parapet(m, x0, z0, x1, z1, y, 1.05, 0.12, T.trim);
      const i = Math.min(x1 - x0, z1 - z0) * 0.2;
      m.box([x0 + i, y, z0 + i], [x1 - i, y + 3.0, z1 - i], MAT.CLADDING, { roof: MAT.ROOF });
      ring(m, x0 + i, z0 + i, x1 - i, z1 - i, y + 3.0, 0.14, 0.1, T.trim);
      roofClutter(m, x0 + 1.4, z0 + 1.4, x1 - 1.4, z1 - 1.4, y, seed, 0.8);
      return y + 3.0;
    }
  }
}

// ------------------------------------------------------------- low density

/** A detached family house: the plan every suburb is mostly made of. */
function house(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 10.4, d = 9.2, floors = T.id === 'heritage' ? 2 : 2;
  const x = w / 2, z = d / 2;
  const wall = floors * T.floorH + 0.4;

  m.box([-x, 0, -z], [x, wall, z], T.wall, { roof: T.cover });
  m.box([-x - 0.08, 0, -z - 0.08], [x + 0.08, 0.75, z + 0.08], T.base);
  const top = roofOver(m, T, -x, -z, x, z, wall, { dormers: medium ? 2 : 0, along: 'x' });

  if (medium) {
    // A projecting wing at one end, so the front elevation has a centre.
    const px0 = -x + 0.6, px1 = -x + 4.6;
    m.box([px0, 0, z], [px1, wall - 0.6, z + 2.4], T.wall, { roof: T.cover });
    roofOver(m, T, px0, z, px1, z + 2.4, wall - 0.6, { along: 'z' });
    if (T.chimney) {
      m.box([x - 2.2, wall * 0.4, -z - 0.35], [x - 1.1, top + 0.9, -z + 0.5], T.base);
      m.box([x - 2.35, top + 0.9, -z - 0.5], [x - 0.95, top + 1.15, -z + 0.65], T.trim);
    }
    if (T.veranda) veranda(m, T, px1 + 0.3, x - 0.4, z, 2.2, 3.0);
  }
  if (fine) {
    for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
      punched(m, T, { axis: 'x', sign, plane }, -z + 1.0, z - 1.0, { floors, base: 1.1 });
    }
    punched(m, T, { axis: 'z', sign: -1, plane: -z }, -x + 1.0, x - 1.0, { floors, base: 1.1 });
    punched(m, T, { axis: 'z', sign: 1, plane: z }, -x + 5.4, x - 0.8, { floors, base: 1.1, skipGround: true });
    doorway(m, T, { axis: 'z', sign: 1, plane: z }, x - 2.6);
    if (T.grille) {
      // Split units on brackets: what an Asian house has instead of a chimney.
      m.painted(TINT.METAL_DARK, () => {
        for (const py of [T.floorH + 0.4, T.floorH * 2 - 0.6]) {
          m.box([x + 0.02, py, -1.2], [x + 0.72, py + 0.62, 0.1], MAT.TRIM);
        }
      });
    }
    backyard(m, -x - 0.8, -z - 7.5, x + 0.8, -z - 0.4, seed);
  }
  return m;
}

/** A row: three houses under one roof, which is how a street is made. */
function row(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const units = 3, unitW = 4.6, d = 8.4;
  const w = units * unitW;
  const x = w / 2, z = d / 2;
  const floors = T.id === 'modern' ? 3 : 2;
  const wall = floors * T.floorH + 0.4;

  m.box([-x, 0, -z], [x, wall, z], T.wall, { roof: T.cover });
  m.box([-x - 0.1, 0, -z - 0.1], [x + 0.1, 0.9, z + 0.1], T.base);
  const top = roofOver(m, T, -x, -z, x, z, wall, { dormers: medium ? units : 0, along: 'x' });

  if (medium) {
    // Party walls carried up through the roof, which is what stops a row
    // reading as one long shed.
    for (let i = 1; i < units; i++) {
      const px = -x + i * unitW;
      m.box([px - 0.22, 0, -z - 0.35], [px + 0.22, top - 0.3, z + 0.35], T.base);
      if (T.chimney) m.box([px - 0.5, top - 0.3, -0.7], [px + 0.5, top + 1.2, 0.7], T.base);
    }
    if (T.veranda) veranda(m, T, -x + 0.3, x - 0.3, z, 2.0, 3.0);
    band(m, -x, -z, x, z, T.floorH + 0.2, 0.22, 0.09, T.trim);
  }
  if (fine) {
    for (let i = 0; i < units; i++) {
      const a = -x + i * unitW, b = a + unitW;
      punched(m, T, { axis: 'z', sign: 1, plane: z }, a + 0.5, b - 0.5,
        { floors, base: 1.0, skipGround: true });
      punched(m, T, { axis: 'z', sign: 1, plane: z }, a + 0.5, a + unitW * 0.55, { floors: 1, base: 1.0 });
      doorway(m, T, { axis: 'z', sign: 1, plane: z }, b - 1.2);
      punched(m, T, { axis: 'z', sign: -1, plane: -z }, a + 0.5, b - 0.5, { floors, base: 1.1 });
    }
    for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
      punched(m, T, { axis: 'x', sign, plane }, -z + 1.4, z - 1.4, { floors: 1, base: T.floorH + 1.0 });
    }
    backyard(m, -x, -z - 6.5, x, -z - 0.4, seed);
  }
  return m;
}

/** A pair under one roof, mirrored about the party wall. */
function duplex(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 12.6, d = 9.0;
  const x = w / 2, z = d / 2;
  const floors = 2;
  const wall = floors * T.floorH + 0.4;

  m.box([-x, 0, -z], [x, wall, z], T.wall, { roof: T.cover });
  m.box([-x - 0.09, 0, -z - 0.09], [x + 0.09, 0.8, z + 0.09], T.base);
  const top = roofOver(m, T, -x, -z, x, z, wall, { along: 'x' });

  if (medium) {
    // Two gabled bays facing the street, one per house.
    for (const s of [-1, 1]) {
      const cx = s * w * 0.24;
      m.box([cx - 1.9, 0, z], [cx + 1.9, wall - 0.5, z + 2.0], T.wall, { roof: T.cover });
      roofOver(m, T, cx - 1.9, z, cx + 1.9, z + 2.0, wall - 0.5, { along: 'z' });
    }
    if (T.chimney) {
      m.box([-0.7, wall * 0.5, -0.8], [0.7, top + 1.1, 0.8], T.base);
      m.box([-0.9, top + 1.1, -1.0], [0.9, top + 1.35, 1.0], T.trim);
    }
    m.box([-0.16, 0, -z - 0.3], [0.16, top - 0.4, z + 2.2], T.base);
  }
  if (fine) {
    for (const s of [-1, 1] as const) {
      const cx = s * w * 0.24;
      punched(m, T, { axis: 'z', sign: 1, plane: z + 2.0 }, cx - 1.6, cx + 1.6, { floors, base: 1.05 });
      doorway(m, T, { axis: 'z', sign: 1, plane: z }, s * (w * 0.24 + 3.2));
      punched(m, T, { axis: 'z', sign: -1, plane: -z }, cx - 2.4, cx + 2.4, { floors, base: 1.1 });
    }
    for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
      punched(m, T, { axis: 'x', sign, plane }, -z + 1.2, z - 1.2, { floors, base: 1.1 });
    }
    if (T.veranda) veranda(m, T, -2.6, 2.6, z, 1.8, 2.9);
    backyard(m, -x, -z - 6.0, x, -z - 0.4, seed);
  }
  return m;
}

/** Rooms round a court behind a wall: the plan half the world builds. */
function court(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 14.0, d = 13.0;
  const x = w / 2, z = d / 2;
  const floors = T.id === 'modern' ? 2 : 1;
  const wall = floors * T.floorH + 0.5;
  const wingD = 4.6;

  // Three wings round an open side.
  m.box([-x, 0, -z], [x, wall, -z + wingD], T.wall, { roof: T.cover });
  m.box([-x, 0, -z + wingD], [-x + wingD, wall - 0.4, z - 3.0], T.wall, { roof: T.cover });
  m.box([x - wingD, 0, -z + wingD], [x, wall - 0.4, z - 3.0], T.wall, { roof: T.cover });
  roofOver(m, T, -x, -z, x, -z + wingD, wall, { along: 'x' });
  roofOver(m, T, -x, -z + wingD, -x + wingD, z - 3.0, wall - 0.4, { along: 'z' });
  roofOver(m, T, x - wingD, -z + wingD, x, z - 3.0, wall - 0.4, { along: 'z' });

  if (medium) {
    compound(m, T, -x, -z, x, z, 2.3);
    // Paving and a planting bed in the court.
    m.box([-x + wingD, 0.01, -z + wingD], [x - wingD, 0.09, z - 0.6], T.base);
    m.painted(TINT.GREEN, () => m.box([-1.6, 0.09, -1.4], [1.6, 0.5, 1.4], MAT.TRIM));
    ring(m, -1.7, -1.5, 1.7, 1.5, 0, 0.42, 0.06, T.base);
  }
  if (fine) {
    punched(m, T, { axis: 'z', sign: 1, plane: -z + wingD }, -x + 1.2, x - 1.2, { floors, base: 1.0 });
    punched(m, T, { axis: 'x', sign: 1, plane: -x + wingD }, -z + wingD + 0.8, z - 3.6, { floors, base: 1.0 });
    punched(m, T, { axis: 'x', sign: -1, plane: x - wingD }, -z + wingD + 0.8, z - 3.6, { floors, base: 1.0 });
    punched(m, T, { axis: 'z', sign: -1, plane: -z }, -x + 1.2, x - 1.2, { floors, base: 1.2 });
    doorway(m, T, { axis: 'z', sign: 1, plane: -z + wingD }, 0, true);
    if (T.grille) {
      m.painted(TINT.METAL_DARK, () => {
        for (let i = 0; i < 3; i++) {
          m.box([-3.0 + i * 3.0, wall - 0.4, -z + wingD + 0.1], [-2.3 + i * 3.0, wall + 0.2, -z + wingD + 0.8], MAT.TRIM);
        }
      });
    }
    planter(m, -x + wingD + 1.4, z - 2.0, 0.8, 0.55);
    planter(m, x - wingD - 1.4, z - 2.0, 0.8, 0.55);
    backyard(m, -x, -z - 5.0, x, -z - 0.5, seed);
  }
  return m;
}

/** A small house with an outbuilding: the smallest thing a lot can hold. */
function cottage(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 8.2, d = 7.4;
  const x = w / 2, z = d / 2;
  const wall = T.floorH * 1.6 + 0.3;

  m.box([-x, 0, -z], [x, wall, z], T.wall, { roof: T.cover });
  m.box([-x - 0.08, 0, -z - 0.08], [x + 0.08, 0.65, z + 0.08], T.base);
  const top = roofOver(m, T, -x, -z, x, z, wall, { dormers: medium ? 2 : 0, along: 'x' });

  if (medium) {
    // Outbuilding: a garage in the new themes, a barn in the old ones.
    const gx0 = x + 1.0, gx1 = x + 7.0, gz0 = -z + 0.6, gz1 = -z + 6.4;
    m.box([gx0, 0, gz0], [gx1, T.floorH * 0.95, gz1], T.id === 'heritage' ? MAT.TIMBER : T.wall, { roof: T.cover });
    roofOver(m, T, gx0, gz0, gx1, gz1, T.floorH * 0.95, { along: 'z' });
    if (T.chimney) {
      m.box([-x + 0.9, wall * 0.4, -0.6], [-x + 1.9, top + 1.0, 0.6], T.base);
      m.box([-x + 0.72, top + 1.0, -0.78], [-x + 2.08, top + 1.24, 0.78], T.trim);
    }
  }
  if (fine) {
    const gx0 = x + 1.0, gx1 = x + 7.0;
    m.painted(TINT.WOOD, () => m.opening({ axis: 'z', sign: 1, plane: -z + 6.4, u0: gx0 + 0.7, u1: gx1 - 0.7,
      y0: 0.16, y1: 2.3, glass: MAT.TRIM, frame: 0.12, proud: 0.08 }));
    punched(m, T, { axis: 'z', sign: 1, plane: z }, -x + 0.8, x - 2.6, { floors: 2, base: 0.95 });
    punched(m, T, { axis: 'z', sign: -1, plane: -z }, -x + 0.8, x - 0.8, { floors: 2, base: 0.95 });
    punched(m, T, { axis: 'x', sign: -1, plane: -x }, -z + 1.0, z - 1.0, { floors: 1, base: 0.95 });
    doorway(m, T, { axis: 'z', sign: 1, plane: z }, x - 1.5);
    if (T.veranda) veranda(m, T, -x + 0.4, x - 3.0, z, 1.8, 2.7);
    backyard(m, -x, -z - 5.5, x, -z - 0.4, seed);
  }
  return m;
}

// ---------------------------------------------------------- medium density

/** A walk-up block: stair entries, no lift, four or five storeys. */
function walkup(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 21.0, d = 13.0;
  const x = w / 2, z = d / 2;
  const floors = T.id === 'heritage' ? 4 : 5;
  const wall = floors * T.floorH + 0.6;
  const cores = 2;

  m.box([-x, 0, -z], [x, wall, z], T.wall, { roof: T.cover });
  m.box([-x - 0.12, 0, -z - 0.12], [x + 0.12, T.floorH + 0.2, z + 0.12], T.base);
  const top = roofOver(m, T, -x, -z, x, z, wall, { dormers: medium ? 3 : 0, along: 'x' });

  if (medium) {
    band(m, -x, -z, x, z, T.floorH + 0.2, 0.26, 0.11, T.trim);
    band(m, -x, -z, x, z, wall - 0.5, 0.34, 0.16, T.trim);
    for (let i = 0; i < cores; i++) {
      const cx = -x + ((i + 0.5) / cores) * w;
      // Entrance bay, brought forward so each stair reads on the elevation.
      m.box([cx - 2.1, 0, z], [cx + 2.1, wall - 1.4, z + 1.1], T.base, { roof: T.cover });
      if (T.chimney) m.box([cx - 0.7, top - 0.4, -1.0], [cx + 0.7, top + 1.3, 1.0], T.base);
    }
    if (T.balcony !== 'none') {
      balconies(m, { axis: 'z', sign: -1, plane: -z }, -x + 1.2, x - 1.2,
        { floors: floors - 1, floorH: T.floorH, base: T.floorH + 1.1, bays: 4, depth: 1.5,
          solid: T.balcony === 'solid' });
    }
  }
  if (fine) {
    for (let i = 0; i < cores; i++) {
      const cx = -x + ((i + 0.5) / cores) * w;
      doorway(m, T, { axis: 'z', sign: 1, plane: z + 1.1 }, cx, true);
      // Stair window stacked over the door: the tell of a walk-up.
      for (let f = 1; f < floors; f++) {
        m.opening({ axis: 'z', sign: 1, plane: z + 1.1, u0: cx - 0.8, u1: cx + 0.8,
          y0: f * T.floorH + 0.9, y1: f * T.floorH + 2.3, glass: MAT.GLASS, frame: 0.1, proud: 0.07 });
      }
    }
    for (const [a, b] of [[-x + 1.0, -x + w * 0.2], [-x + w * 0.3, -x + w * 0.45],
                          [-x + w * 0.55, -x + w * 0.7], [-x + w * 0.8, x - 1.0]] as const) {
      punched(m, T, { axis: 'z', sign: 1, plane: z }, a, b, { floors, base: 1.1 });
    }
    for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
      punched(m, T, { axis: 'x', sign, plane }, -z + 1.2, z - 1.2, { floors, base: 1.1 });
    }
    punched(m, T, { axis: 'z', sign: -1, plane: -z }, -x + 1.2, x - 1.2, { floors: 1, base: 1.1 });
    kerb(m, -x - 1.0, z + 1.6, x + 1.0, z + 2.6);
    bollards(m, { axis: 'z', sign: 1, plane: z }, -x + 1.0, x - 1.0, 2.0, 7);
    roofClutter(m, -x + 2, -z + 2, x - 2, z - 2, wall, seed, 0.5);
  }
  return m;
}

/** A corner block: two wings meeting at a turned corner. */
function corner(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const arm = 20.0, depth = 11.0;
  const floors = 5;
  const wall = floors * T.floorH + 0.6;
  const x0 = -arm / 2, z0 = -arm / 2;

  // Two wings in an L, and a taller turret where they meet.
  m.box([x0, 0, z0], [x0 + arm, wall, z0 + depth], T.wall, { roof: T.cover });
  m.box([x0, 0, z0 + depth], [x0 + depth, wall, z0 + arm], T.wall, { roof: T.cover });
  m.box([x0 - 0.4, 0, z0 - 0.4], [x0 + depth + 0.4, wall + 2.4, z0 + depth + 0.4], T.wall, { roof: T.cover });
  roofOver(m, T, x0 + depth, z0, x0 + arm, z0 + depth, wall, { along: 'x' });
  roofOver(m, T, x0, z0 + depth, x0 + depth, z0 + arm, wall, { along: 'z' });
  const top = roofOver(m, T, x0 - 0.4, z0 - 0.4, x0 + depth + 0.4, z0 + depth + 0.4, wall + 2.4);

  if (medium) {
    band(m, x0, z0, x0 + arm, z0 + depth, T.floorH + 0.2, 0.26, 0.12, T.trim);
    band(m, x0, z0 + depth, x0 + depth, z0 + arm, T.floorH + 0.2, 0.26, 0.12, T.trim);
    if (T.chimney) {
      m.box([x0 + arm - 3.0, wall - 0.6, z0 + 3.0], [x0 + arm - 1.8, top - 1.0, z0 + 4.4], T.base);
    }
    if (T.balcony !== 'none') {
      balconies(m, { axis: 'z', sign: -1, plane: z0 }, x0 + depth + 1.0, x0 + arm - 1.0,
        { floors: floors - 1, floorH: T.floorH, base: T.floorH + 1.2, bays: 3, depth: 1.4,
          solid: T.balcony === 'solid' });
    }
  }
  if (fine) {
    // Ground floor is shops on the corner, flats above: how corners are used.
    shopfront(m, { axis: 'z', sign: -1, plane: z0 - 0.4 }, x0 + 0.4, x0 + depth - 0.4,
      { bays: 2, doorBay: 1, head: T.floorH - 0.2, fascia: 0.8 });
    doorway(m, T, { axis: 'x', sign: -1, plane: x0 }, z0 + arm - 3.0, true);
    for (const [ax, bx] of [[x0 + depth + 0.6, x0 + arm - 0.6]] as const) {
      punched(m, T, { axis: 'z', sign: -1, plane: z0 }, ax, bx, { floors, base: 1.2, skipGround: true });
      punched(m, T, { axis: 'z', sign: 1, plane: z0 + depth }, ax, bx, { floors, base: 1.2 });
    }
    punched(m, T, { axis: 'x', sign: -1, plane: x0 }, z0 + depth + 0.6, z0 + arm - 0.6, { floors, base: 1.2, skipGround: true });
    punched(m, T, { axis: 'x', sign: 1, plane: x0 + depth }, z0 + depth + 0.6, z0 + arm - 0.6, { floors, base: 1.2 });
    for (let f = 1; f < floors; f++) {
      m.opening({ axis: 'z', sign: -1, plane: z0 - 0.4, u0: x0 + 1.2, u1: x0 + depth - 1.2,
        y0: f * T.floorH + 1.0, y1: f * T.floorH + 2.5, glass: MAT.GLASS, frame: 0.12, proud: 0.08 });
    }
    kerb(m, x0 - 1.6, z0 - 2.0, x0 + arm, z0 - 0.9);
    roofClutter(m, x0 + depth + 1.5, z0 + 1.5, x0 + arm - 1.5, z0 + depth - 1.5, wall, seed, 0.5);
  }
  return m;
}

/** Deck access: flats reached off an open gallery, which is the whole facade. */
function gallery(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 23.0, d = 11.0;
  const x = w / 2, z = d / 2;
  const floors = 5;
  const wall = floors * T.floorH + 0.5;

  m.box([-x, 0, -z], [x, wall, z], T.wall, { roof: T.cover });
  m.box([-x - 0.12, 0, -z - 0.12], [x + 0.12, T.floorH + 0.1, z + 0.12], T.base);
  roofOver(m, T, -x, -z, x, z, wall, { along: 'x' });

  if (medium) {
    // The gallery itself: a slab per floor on brackets, with a balustrade.
    for (let f = 1; f < floors; f++) {
      const y = f * T.floorH;
      m.box([-x, y - 0.22, -z - 1.6], [x, y, -z], MAT.CONCRETE);
      railing(m, -x, x, -z - 1.5, y, 1.1, 1.6);
    }
    // Stair tower at one end, expressed as a solid.
    m.box([x - 0.4, 0, -z - 2.2], [x + 3.4, wall + 1.6, -z + 2.2], T.base, { roof: MAT.ROOF });
    parapet(m, x - 0.4, -z - 2.2, x + 3.4, -z + 2.2, wall + 1.6, 0.8, 0.14, T.base);
    if (T.balcony !== 'none') {
      balconies(m, { axis: 'z', sign: 1, plane: z }, -x + 1.2, x - 1.2,
        { floors: floors - 1, floorH: T.floorH, base: T.floorH + 1.0, bays: 5, depth: 1.6,
          solid: T.balcony === 'solid' });
    }
  }
  if (fine) {
    for (let f = 1; f < floors; f++) {
      const y = f * T.floorH;
      // Front doors and kitchen windows alternating along the gallery.
      for (let i = 0; i < 5; i++) {
        const cx = -x + ((i + 0.5) / 5) * w;
        entrance(m, { axis: 'z', sign: -1, plane: -z }, cx - 1.0, { width: 0.95, height: 2.1 });
        m.opening({ axis: 'z', sign: -1, plane: -z, u0: cx + 0.3, u1: cx + 1.8,
          y0: y + 0.95, y1: y + 2.2, glass: MAT.GLASS, frame: 0.1, proud: 0.07 });
      }
    }
    punched(m, T, { axis: 'z', sign: 1, plane: z }, -x + 1.0, x - 1.0, { floors, base: 1.0 });
    punched(m, T, { axis: 'x', sign: -1, plane: -x }, -z + 1.0, z - 1.0, { floors, base: 1.0 });
    for (let f = 0; f < floors; f++) {
      m.opening({ axis: 'x', sign: 1, plane: x + 3.4, u0: -z - 1.4, u1: -z + 1.4,
        y0: f * T.floorH + 1.0, y1: f * T.floorH + 2.4, glass: MAT.GLASS, frame: 0.12, proud: 0.08 });
    }
    doorway(m, T, { axis: 'z', sign: 1, plane: z }, -x + 3.0, true);
    kerb(m, -x - 1.0, z + 1.4, x + 1.0, z + 2.4);
    roofClutter(m, -x + 2, -z + 2, x - 2, z - 2, wall, seed, 0.6);
  }
  return m;
}

/** A block round a courtyard, entered through an arch. */
function perimeter(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 22.0, d = 18.0, wing = 8.0;
  const x = w / 2, z = d / 2;
  const floors = 5;
  const wall = floors * T.floorH + 0.5;

  // Three ranges round a court open to the back.
  m.box([-x, 0, z - wing], [x, wall, z], T.wall, { roof: T.cover });
  m.box([-x, 0, -z], [-x + wing, wall, z - wing], T.wall, { roof: T.cover });
  m.box([x - wing, 0, -z], [x, wall, z - wing], T.wall, { roof: T.cover });
  roofOver(m, T, -x, z - wing, x, z, wall, { along: 'x', dormers: medium ? 4 : 0 });
  roofOver(m, T, -x, -z, -x + wing, z - wing, wall, { along: 'z' });
  roofOver(m, T, x - wing, -z, x, z - wing, wall, { along: 'z' });

  if (medium) {
    band(m, -x, z - wing, x, z, T.floorH + 0.2, 0.28, 0.13, T.trim);
    // Carriage arch through the front range.
    m.box([-2.4, 0, z - wing - 0.2], [2.4, T.floorH + 0.4, z + 0.2], T.base);
    m.painted(TINT.METAL_DARK, () => {
      m.box([-2.0, 0.1, z - 0.06], [-1.86, T.floorH - 0.1, z + 0.06], MAT.TRIM);
      m.box([1.86, 0.1, z - 0.06], [2.0, T.floorH - 0.1, z + 0.06], MAT.TRIM);
    });
    m.box([-2.0, 0.02, z - wing], [2.0, 0.1, z + 0.3], MAT.CONCRETE);
    m.painted(TINT.GREEN, () => m.box([-x + wing, 0.01, -z + 1.0], [x - wing, 0.07, z - wing - 1.0], MAT.TRIM));
    if (T.chimney) {
      for (const cx of [-x + wing * 0.5, x - wing * 0.5]) {
        m.box([cx - 0.6, wall - 0.4, -z + 2.0], [cx + 0.6, wall + 2.2, -z + 3.2], T.base);
      }
    }
  }
  if (fine) {
    punched(m, T, { axis: 'z', sign: 1, plane: z }, -x + 1.0, -3.2, { floors, base: 1.2 });
    punched(m, T, { axis: 'z', sign: 1, plane: z }, 3.2, x - 1.0, { floors, base: 1.2 });
    for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
      punched(m, T, { axis: 'x', sign, plane }, -z + 1.0, z - 1.0, { floors, base: 1.2 });
    }
    punched(m, T, { axis: 'x', sign: 1, plane: -x + wing }, -z + 1.0, z - wing - 1.0, { floors, base: 1.2 });
    punched(m, T, { axis: 'x', sign: -1, plane: x - wing }, -z + 1.0, z - wing - 1.0, { floors, base: 1.2 });
    punched(m, T, { axis: 'z', sign: -1, plane: z - wing }, -x + wing + 1.0, x - wing - 1.0, { floors, base: 1.2 });
    doorway(m, T, { axis: 'x', sign: 1, plane: -x + wing }, 0, true);
    if (T.balcony !== 'none') {
      balconies(m, { axis: 'z', sign: 1, plane: z }, -x + 2.0, -3.6,
        { floors: 3, floorH: T.floorH, base: T.floorH * 2 + 1.0, bays: 2, depth: 1.3, solid: T.balcony === 'solid' });
    }
    kerb(m, -x - 1.0, z + 1.2, x + 1.0, z + 2.2);
    roofClutter(m, -x + wing + 1, -z + 1.5, x - wing - 1, z - wing - 1.5, 0.4, seed, 0.4);
  }
  return m;
}

/** Shops below, flats above: the block that makes a high street. */
function shoptop(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 21.4, d = 12.0;
  const x = w / 2, z = d / 2;
  const floors = 4;
  const shop = 4.2;
  const wall = shop + floors * T.floorH;
  const units = 3;

  m.box([-x, 0, -z], [x, shop, z], T.base, { roof: T.cover });
  m.box([-x + 0.3, shop, -z], [x - 0.3, wall, z], T.wall, { roof: T.cover });
  roofOver(m, T, -x + 0.3, -z, x - 0.3, z, wall, { along: 'x', dormers: medium ? 3 : 0 });

  if (medium) {
    band(m, -x, -z, x, z, shop, 0.4, 0.22, T.trim);
    m.box([-x - 0.3, shop - 1.0, z], [x + 0.3, shop - 0.6, z + 1.7], T.trim);
    if (T.balcony !== 'none') {
      balconies(m, { axis: 'z', sign: 1, plane: z }, -x + 1.6, x - 1.6,
        { floors: floors - 1, floorH: T.floorH, base: shop + T.floorH + 0.6, bays: 4, depth: 1.4,
          solid: T.balcony === 'solid' });
    }
    if (T.chimney) m.box([-1.0, wall - 0.5, -1.0], [1.0, wall + 2.4, 0.6], T.base);
  }
  if (fine) {
    for (let i = 0; i < units; i++) {
      const a = -x + (i / units) * w + 0.6;
      const b = -x + ((i + 1) / units) * w - 0.6;
      shopfront(m, { axis: 'z', sign: 1, plane: z }, a, b,
        { bays: 3, doorBay: i % 3, head: shop - 0.9, fascia: 0.85 });
      fasciaSign(m, { axis: 'z', sign: 1, plane: z }, a + 0.8, b - 0.8, shop - 0.85, shop - 0.15);
      if (i % 2 === 1) awning(m, { axis: 'z', sign: 1, plane: z }, a + 0.4, b - 0.4, shop - 1.2, 1.3);
    }
    punched(m, T, { axis: 'z', sign: 1, plane: z }, -x + 1.2, x - 1.2, { floors, base: shop + 0.9 });
    punched(m, T, { axis: 'z', sign: -1, plane: -z }, -x + 1.2, x - 1.2, { floors, base: shop + 0.9 });
    for (const [sign, plane] of [[1, x - 0.3], [-1, -x + 0.3]] as const) {
      punched(m, T, { axis: 'x', sign, plane }, -z + 1.2, z - 1.2, { floors, base: shop + 0.9 });
    }
    // Service doors and bins round the back.
    for (let i = 0; i < units; i++) {
      const u = -x + ((i + 0.5) / units) * w;
      m.opening({ axis: 'z', sign: -1, plane: -z, u0: u - 0.55, u1: u + 0.55, y0: 0.1, y1: 2.3,
        glass: MAT.TRIM, frame: 0.1, proud: 0.07 });
    }
    kerb(m, -x - 1.2, z + 1.8, x + 1.2, z + 3.0);
    bollards(m, { axis: 'z', sign: 1, plane: z }, -x + 1.0, x - 1.0, 2.4, 8);
    roofClutter(m, -x + 2, -z + 2, x - 2, z - 2, shop, seed, 0.5);
  }
  return m;
}

// ------------------------------------------------------------ high density

/** Facade treatment for a tall block: ribbon glazing or punched holes. */
function tallSkin(m: MeshBuilder, T: ThemeProfile, x0: number, z0: number, x1: number, z1: number,
                  floors: number, base: number): void {
  const walls: Wall[] = [
    { axis: 'z', sign: 1, plane: z1 }, { axis: 'z', sign: -1, plane: z0 },
    { axis: 'x', sign: 1, plane: x1 }, { axis: 'x', sign: -1, plane: x0 },
  ];
  for (const w of walls) {
    const [u0, u1] = w.axis === 'x' ? [z0 + 0.9, z1 - 0.9] : [x0 + 0.9, x1 - 0.9];
    if (T.ribbon) banded(m, T, w, u0, u1, floors, base);
    else punched(m, T, w, u0, u1, { floors, base: base + 0.9 });
  }
}

/** A point block: one core, four flats a floor, seen from every side. */
function point(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 19.0, d = 17.0;
  const x = w / 2, z = d / 2;
  const floors = 14;
  const podium = T.floorH * 1.4;
  const wall = podium + floors * T.floorH;

  m.box([-x - 1.4, 0, -z - 1.4], [x + 1.4, podium, z + 1.4], T.base, { roof: MAT.ROOF });
  m.box([-x, podium, -z], [x, wall, z], T.wall, { roof: T.cover });
  const top = crown(m, T, -x, -z, x, z, wall, seed);

  if (medium) {
    band(m, -x - 1.4, -z - 1.4, x + 1.4, z + 1.4, podium, 0.4, 0.2, T.trim);
    // Vertical fin at each corner: what stops a tower being a cardboard box.
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      m.box([sx > 0 ? x - 0.6 : -x, podium, sz > 0 ? z - 0.6 : -z],
            [sx > 0 ? x + 0.34 : -x + 0.6, top - 0.5, sz > 0 ? z + 0.34 : -z + 0.6], T.base);
    }
    if (T.balcony !== 'none') {
      for (const [sign, plane, u0, u1] of [[1, z, -x + 1.4, x - 1.4], [-1, -z, -x + 1.4, x - 1.4]] as const) {
        balconies(m, { axis: 'z', sign, plane }, u0, u1,
          { floors, floorH: T.floorH, base: podium + 0.4, bays: 3, depth: 1.5, solid: T.balcony === 'solid' });
      }
    }
    parapet(m, -x - 1.4, -z - 1.4, x + 1.4, z + 1.4, podium, 0.9, 0.16, T.base);
  }
  if (fine) {
    tallSkin(m, T, -x, -z, x, z, floors, podium);
    doorway(m, T, { axis: 'z', sign: 1, plane: z + 1.4 }, 0, true);
    for (const [sign, plane] of [[1, z + 1.4], [-1, -z - 1.4]] as const) {
      ribbon(m, { axis: 'z', sign, plane }, -x + 1.0, x - 1.0, 1.1, podium - 0.9, { mullions: 7 });
    }
    kerb(m, -x - 3.0, z + 2.6, x + 3.0, z + 3.8);
    bollards(m, { axis: 'z', sign: 1, plane: z + 1.4 }, -x, x, 2.2, 8);
  }
  return m;
}

/** A slab block: one long face, a stack of the same flat. */
function slab(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 26.0, d = 13.0;
  const x = w / 2, z = d / 2;
  const floors = 12;
  const podium = T.floorH * 1.3;
  const wall = podium + floors * T.floorH;

  m.box([-x, 0, -z - 1.2], [x, podium, z + 1.2], T.base, { roof: MAT.ROOF });
  m.box([-x, podium, -z], [x, wall, z], T.wall, { roof: T.cover });
  const top = crown(m, T, -x, -z, x, z, wall, seed);

  if (medium) {
    band(m, -x, -z - 1.2, x, z + 1.2, podium, 0.42, 0.2, T.trim);
    // Two service cores expressed as blank towers, breaking the long face.
    for (const cx of [-w * 0.24, w * 0.24]) {
      m.box([cx - 2.2, 0, -z - 1.4], [cx + 2.2, top - 1.6, -z + 0.6], T.base, { roof: MAT.ROOF });
      parapet(m, cx - 2.2, -z - 1.4, cx + 2.2, -z + 0.6, top - 1.6, 0.8, 0.14, T.base);
    }
    if (T.balcony !== 'none') {
      balconies(m, { axis: 'z', sign: 1, plane: z }, -x + 1.2, x - 1.2,
        { floors, floorH: T.floorH, base: podium + 0.5, bays: 6, depth: 1.5, solid: T.balcony === 'solid' });
    }
    parapet(m, -x, -z - 1.2, x, z + 1.2, podium, 0.9, 0.16, T.base);
  }
  if (fine) {
    tallSkin(m, T, -x, -z, x, z, floors, podium);
    doorway(m, T, { axis: 'z', sign: 1, plane: z + 1.2 }, 0, true);
    ribbon(m, { axis: 'z', sign: 1, plane: z + 1.2 }, -x + 1.2, -2.6, 1.1, podium - 0.9, { mullions: 6 });
    ribbon(m, { axis: 'z', sign: 1, plane: z + 1.2 }, 2.6, x - 1.2, 1.1, podium - 0.9, { mullions: 6 });
    for (const cx of [-w * 0.24, w * 0.24]) {
      for (let f = 1; f < floors; f += 2) {
        m.opening({ axis: 'z', sign: -1, plane: -z - 1.4, u0: cx - 1.2, u1: cx + 1.2,
          y0: podium + f * T.floorH + 0.8, y1: podium + f * T.floorH + 2.0,
          glass: MAT.GLASS, frame: 0.11, proud: 0.07 });
      }
    }
    kerb(m, -x - 1.4, z + 2.6, x + 1.4, z + 3.8);
  }
  return m;
}

/** Twin towers on a shared podium, which is how a dense scheme is built. */
function twin(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const pw = 27.0, pd = 20.0;
  const px = pw / 2, pz = pd / 2;
  const podium = T.floorH * 2.1;
  const tw = 10.6, td = 11.0;
  const floors = [11, 15];

  m.box([-px, 0, -pz], [px, podium, pz], T.base, { roof: MAT.ROOF });
  const cxs = [-pw * 0.24, pw * 0.24];
  let highest = podium;
  cxs.forEach((cx, i) => {
    const wall = podium + floors[i] * T.floorH;
    m.box([cx - tw / 2, podium, -td / 2], [cx + tw / 2, wall, td / 2], T.wall, { roof: T.cover });
    highest = Math.max(highest, crown(m, T, cx - tw / 2, -td / 2, cx + tw / 2, td / 2, wall, seed + i * 17));
  });

  if (medium) {
    band(m, -px, -pz, px, pz, podium, 0.45, 0.22, T.trim);
    parapet(m, -px, -pz, px, pz, podium, 1.0, 0.18, T.base);
    // Podium roof is the scheme's garden, which is what a podium is for.
    m.painted(TINT.GREEN, () => m.box([-px + 1.4, podium, -pz + 1.4], [px - 1.4, podium + 0.12, pz - 1.4], MAT.TRIM));
    for (let i = 0; i < 6; i++) {
      planter(m, -px + 2.6 + (i % 3) * 6.0, -pz + 3.0 + Math.floor(i / 3) * (pd - 6.0), 1.0, 0.6);
    }
    if (T.balcony !== 'none') {
      cxs.forEach((cx, i) => {
        balconies(m, { axis: 'z', sign: 1, plane: td / 2 }, cx - tw / 2 + 0.8, cx + tw / 2 - 0.8,
          { floors: floors[i], floorH: T.floorH, base: podium + 0.5, bays: 2, depth: 1.5,
            solid: T.balcony === 'solid' });
      });
    }
  }
  if (fine) {
    cxs.forEach((cx, i) => {
      tallSkin(m, T, cx - tw / 2, -td / 2, cx + tw / 2, td / 2, floors[i], podium);
    });
    for (let i = 0; i < 4; i++) {
      const a = -px + 1.4 + i * ((pw - 2.8) / 4);
      shopfront(m, { axis: 'z', sign: 1, plane: pz }, a + 0.4, a + (pw - 2.8) / 4 - 0.4,
        { bays: 3, doorBay: 1, head: T.floorH * 1.5, fascia: 0.9 });
    }
    doorway(m, T, { axis: 'z', sign: -1, plane: -pz }, 0, true);
    ribbon(m, { axis: 'z', sign: -1, plane: -pz }, -px + 1.4, -3.0, T.floorH * 1.6, podium - 0.7, { mullions: 6 });
    ribbon(m, { axis: 'z', sign: -1, plane: -pz }, 3.0, px - 1.4, T.floorH * 1.6, podium - 0.7, { mullions: 6 });
    kerb(m, -px - 1.2, pz + 1.6, px + 1.2, pz + 2.8);
  }
  return m;
}

/** A stepped block: each setback is a terrace, which is why it is stepped. */
function stepped(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const tiers = [
    { w: 25.0, d: 19.0, floors: 4 },
    { w: 20.0, d: 15.0, floors: 4 },
    { w: 14.0, d: 11.0, floors: 4 },
  ];
  let y = 0;
  const tops: number[] = [];
  for (const t of tiers) {
    const h = t.floors * T.floorH;
    m.box([-t.w / 2, y, -t.d / 2], [t.w / 2, y + h, t.d / 2], y === 0 ? T.base : T.wall, { roof: T.cover });
    y += h;
    tops.push(y);
  }
  const last = tiers[tiers.length - 1];
  const top = crown(m, T, -last.w / 2, -last.d / 2, last.w / 2, last.d / 2, y, seed);

  if (medium) {
    tiers.forEach((_t, i) => {
      if (i === 0) return;
      const prev = tiers[i - 1];
      const py = tops[i - 1];
      // The terrace left by the setback, with a balustrade and planting.
      m.box([-prev.w / 2, py, -prev.d / 2], [prev.w / 2, py + 0.14, prev.d / 2], MAT.CONCRETE);
      m.painted(TINT.GREEN, () => {
        m.box([-prev.w / 2 + 0.5, py + 0.14, prev.d / 2 - 2.2], [prev.w / 2 - 0.5, py + 0.5, prev.d / 2 - 0.6], MAT.TRIM);
      });
      railing(m, -prev.w / 2 + 0.3, prev.w / 2 - 0.3, prev.d / 2 - 0.35, py + 0.14, 1.05, 1.5);
      railing(m, -prev.w / 2 + 0.3, prev.w / 2 - 0.3, -prev.d / 2 + 0.35, py + 0.14, 1.05, 1.5);
    });
    band(m, -tiers[0].w / 2, -tiers[0].d / 2, tiers[0].w / 2, tiers[0].d / 2, T.floorH + 0.2, 0.3, 0.14, T.trim);
    if (T.chimney) m.box([-1.0, top - 1.0, -1.0], [1.0, top + 2.0, 0.6], T.base);
  }
  if (fine) {
    let base = 0;
    tiers.forEach((t: { w: number; d: number; floors: number }) => {
      tallSkin(m, T, -t.w / 2, -t.d / 2, t.w / 2, t.d / 2, t.floors, base);
      base += t.floors * T.floorH;
    });
    doorway(m, T, { axis: 'z', sign: 1, plane: tiers[0].d / 2 }, 0, true);
    kerb(m, -tiers[0].w / 2 - 1.0, tiers[0].d / 2 + 1.6, tiers[0].w / 2 + 1.0, tiers[0].d / 2 + 2.8);
    bollards(m, { axis: 'z', sign: 1, plane: tiers[0].d / 2 }, -8, 8, 2.0, 6);
  }
  return m;
}

/** A tower with its core outside the envelope, expressed as a shaft. */
function cored(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 17.0, d = 15.0;
  const x = w / 2, z = d / 2;
  const floors = 16;
  const podium = T.floorH * 1.5;
  const wall = podium + floors * T.floorH;

  m.box([-x - 1.0, 0, -z - 1.0], [x + 1.0, podium, z + 1.0], T.base, { roof: MAT.ROOF });
  m.box([-x, podium, -z], [x, wall, z], T.wall, { roof: T.cover });
  // The core: a blind shaft up one flank, taller than the block it serves.
  const core: [number, number, number, number] = [x - 0.6, -4.2, x + 3.6, 4.2];
  m.box([core[0], 0, core[1]], [core[2], wall + 3.2, core[3]], T.base, { roof: MAT.ROOF });
  parapet(m, core[0], core[1], core[2], core[3], wall + 3.2, 0.9, 0.16, T.base);
  crown(m, T, -x, -z, x, z, wall, seed);

  if (medium) {
    band(m, -x - 1.0, -z - 1.0, x + 1.0, z + 1.0, podium, 0.42, 0.2, T.trim);
    parapet(m, -x - 1.0, -z - 1.0, x + 1.0, z + 1.0, podium, 0.9, 0.16, T.base);
    // Ribs up the blank flank, so the core is not a plain slab either.
    for (let i = 0; i < 5; i++) {
      const pz = core[1] + 0.5 + (i / 4) * (core[3] - core[1] - 1.0);
      m.box([core[2], podium, pz - 0.13], [core[2] + 0.26, wall + 2.6, pz + 0.13], T.trim);
    }
    if (T.balcony !== 'none') {
      balconies(m, { axis: 'x', sign: -1, plane: -x }, -z + 1.2, z - 1.2,
        { floors, floorH: T.floorH, base: podium + 0.5, bays: 2, depth: 1.5, solid: T.balcony === 'solid' });
    }
    m.painted(TINT.METAL_DARK, () => {
      for (let f = 2; f < floors; f += 4) {
        m.box([core[0] - 0.1, podium + f * T.floorH, core[1] + 1.0],
              [core[0] + 0.1, podium + f * T.floorH + 0.9, core[3] - 1.0], MAT.TRIM);
      }
    });
  }
  if (fine) {
    for (const wl of [
      { axis: 'z', sign: 1, plane: z } as Wall, { axis: 'z', sign: -1, plane: -z } as Wall,
      { axis: 'x', sign: -1, plane: -x } as Wall,
    ]) {
      const [u0, u1] = wl.axis === 'x' ? [-z + 0.9, z - 0.9] : [-x + 0.9, x - 0.9];
      if (T.ribbon) banded(m, T, wl, u0, u1, floors, podium);
      else punched(m, T, wl, u0, u1, { floors, base: podium + 0.9 });
    }
    doorway(m, T, { axis: 'z', sign: 1, plane: z + 1.0 }, -2.0, true);
    ribbon(m, { axis: 'z', sign: 1, plane: z + 1.0 }, -x + 1.0, x - 1.0, 1.2, podium - 0.8, { mullions: 7 });
    fireEscape(m, { axis: 'z', sign: -1, plane: -z }, 0, podium, 5, T.floorH * 2, 2.2);
    kerb(m, -x - 2.4, z + 2.0, x + 2.4, z + 3.2);
  }
  return m;
}

// ------------------------------------------------------------------- table

type Plan = {
  key: string;
  name: string;
  build: (lod: number, T: ThemeProfile, seed: number) => MeshBuilder;
  footprint: [number, number];
  households: number;
};

const LOW: Plan[] = [
  { key: 'house', name: 'House', build: house, footprint: [2, 3], households: 1 },
  { key: 'row', name: 'Row', build: row, footprint: [2, 3], households: 3 },
  { key: 'duplex', name: 'Duplex', build: duplex, footprint: [2, 3], households: 2 },
  { key: 'court', name: 'Courtyard house', build: court, footprint: [2, 3], households: 2 },
  { key: 'cottage', name: 'Cottage', build: cottage, footprint: [3, 3], households: 1 },
];

const MID: Plan[] = [
  { key: 'walkup', name: 'Walk-up', build: walkup, footprint: [3, 3], households: 20 },
  { key: 'corner', name: 'Corner block', build: corner, footprint: [3, 3], households: 24 },
  { key: 'gallery', name: 'Gallery block', build: gallery, footprint: [4, 3], households: 25 },
  { key: 'perimeter', name: 'Perimeter block', build: perimeter, footprint: [3, 3], households: 30 },
  { key: 'shoptop', name: 'Flats over shops', build: shoptop, footprint: [3, 3], households: 16 },
];

/**
 * Five tall plans, three to a theme.
 *
 * Rotating which three keeps every theme's high-density trio distinct from
 * its neighbours' without inventing fifteen tower plans, and every plan still
 * gets built in three different themes.
 */
const HIGH: Plan[] = [
  { key: 'point', name: 'Point block', build: point, footprint: [4, 4], households: 56 },
  { key: 'slab', name: 'Slab block', build: slab, footprint: [4, 3], households: 72 },
  { key: 'twin', name: 'Twin towers', build: twin, footprint: [4, 4], households: 96 },
  { key: 'stepped', name: 'Stepped block', build: stepped, footprint: [4, 4], households: 78 },
  { key: 'cored', name: 'Cored tower', build: cored, footprint: [4, 3], households: 64 },
];

const SIM = {
  low: (n: number) => ({ households: n, powerKW: 6 * n, waterM3: 1.1 * n, garbagePerWeek: 22 * n, pollution: 0, upkeep: 5 * n }),
  medium: (n: number) => ({ households: n, powerKW: 5 * n, waterM3: 0.95 * n, garbagePerWeek: 18 * n, pollution: 1, upkeep: 3.4 * n }),
  high: (n: number) => ({ households: n, powerKW: 4.4 * n, waterM3: 0.85 * n, garbagePerWeek: 15 * n, pollution: 1, upkeep: 2.8 * n }),
};

function defs(theme: Theme, density: Density, plans: Plan[]): AssetDef[] {
  const T = THEMES[theme];
  const key = THEME_KEY[theme];
  const short = density === 'medium' ? 'mid' : density;
  return plans.map((p) => {
    const id = `res.${key}.${short}.${p.key}`;
    const seed = Math.round(idSeed(id));
    const sim = SIM[density === 'medium' ? 'medium' : density === 'high' ? 'high' : 'low'](p.households);
    return {
      id,
      name: `${T.label} ${p.name.toLowerCase()}`,
      zone: 'residential' as const,
      theme,
      density,
      variant: 'sculpted' as const,
      footprint: p.footprint,
      height: 0,
      sim,
      note: `${p.name} in the ${T.label.toLowerCase()} vocabulary: ${T.roof} roof, ${T.shutters ? 'shuttered' : T.grille ? 'grilled' : 'plain'} openings.`,
      build: (lod: number) => p.build(lod, T, seed),
    };
  });
}

export const HOUSING: AssetDef[] = THEME_ORDER.flatMap((theme, i) => [
  ...defs(theme, 'low', LOW),
  ...defs(theme, 'medium', MID),
  ...defs(theme, 'high', [HIGH[i % 5], HIGH[(i + 1) % 5], HIGH[(i + 2) % 5]]),
]);
