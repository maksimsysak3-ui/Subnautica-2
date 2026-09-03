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
import { THEMES, THEME_ORDER, THEME_KEY } from '../themes';
import { roofOver, punched, banded, doorway, veranda, compound, crown } from '../themed-parts';
import type { Theme, ThemeProfile } from '../themes';
import {
  awning, balconies, band, backyard, bollards, entrance, fasciaSign, fireEscape, kerb,
  parapet, planter, railing, ribbon, ring, roofClutter, shopfront,
} from '../parts';
import type { Wall } from '../parts';

// ------------------------------------------------------------- low density

/** A detached family house: the plan every suburb is mostly made of. */
function house(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 10.4, d = 9.2, floors = T.id === 'farming' ? 2 : 2;
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
    m.box([gx0, 0, gz0], [gx1, T.floorH * 0.95, gz1], T.id === 'farming' ? MAT.TIMBER : T.wall, { roof: T.cover });
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
  const floors = T.id === 'farming' ? 4 : 5;
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

/** A bungalow: everything on one floor, so it is all roof and eaves. */
function bungalow(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 13.6, d = 8.6;
  const x = w / 2, z = d / 2;
  const wall = T.floorH + 0.4;

  m.box([-x, 0, -z], [x, wall, z], T.wall, { roof: T.cover });
  m.box([-x - 0.1, 0, -z - 0.1], [x + 0.1, 0.55, z + 0.1], T.base);
  const top = roofOver(m, T, -x, -z, x, z, wall, { along: 'x', dormers: medium ? 2 : 0 });

  if (medium) {
    // A projecting bay at one end and a carport at the other: on a single
    // storey the plan is the only thing that can break the box.
    m.box([-x + 0.8, 0, z], [-x + 4.4, wall - 0.3, z + 1.6], T.wall, { roof: T.cover });
    roofOver(m, T, -x + 0.8, z, -x + 4.4, z + 1.6, wall - 0.3, { along: 'x' });
    m.box([x - 0.2, wall - 0.5, -z + 0.6], [x + 5.4, wall - 0.1, z - 0.6], T.trim);
    for (const pz of [-z + 0.9, z - 0.9]) {
      m.box([x + 4.9, 0, pz - 0.13], [x + 5.2, wall - 0.5, pz + 0.13], T.trim);
    }
    if (T.chimney) {
      m.box([-1.0, wall * 0.5, -0.7], [0.1, top + 0.9, 0.4], T.base);
      m.box([-1.18, top + 0.9, -0.88], [0.28, top + 1.14, 0.58], T.trim);
    }
    if (T.veranda) veranda(m, T, -x + 4.8, x - 1.0, z, 2.0, wall - 0.2);
  }
  if (fine) {
    punched(m, T, { axis: 'z', sign: 1, plane: z }, -x + 5.0, x - 0.8, { floors: 1, base: 1.0 });
    punched(m, T, { axis: 'z', sign: 1, plane: z + 1.6 }, -x + 1.1, -x + 4.1, { floors: 1, base: 0.95 });
    punched(m, T, { axis: 'z', sign: -1, plane: -z }, -x + 0.9, x - 0.9, { floors: 1, base: 1.0 });
    for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
      punched(m, T, { axis: 'x', sign, plane }, -z + 1.0, z - 1.0, { floors: 1, base: 1.0 });
    }
    doorway(m, T, { axis: 'z', sign: 1, plane: z }, -x + 4.7);
    backyard(m, -x, -z - 6.0, x, -z - 0.4, seed);
  }
  return m;
}

/** A villa: a detached house with a wing and a garden wall to the street. */
function villa(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 11.0, d = 10.0, wing = 5.0;
  const x = w / 2, z = d / 2;
  const floors = 2;
  const wall = floors * T.floorH + 0.5;

  m.box([-x, 0, -z], [x, wall, z], T.wall, { roof: T.cover });
  m.box([x - 0.4, 0, -z + 1.0], [x + wing, wall - T.floorH * 0.55, z - 1.6], T.wall, { roof: T.cover });
  m.box([-x - 0.14, 0, -z - 0.14], [x + 0.14, 1.05, z + 0.14], T.base);
  const top = roofOver(m, T, -x, -z, x, z, wall, { along: 'z', dormers: medium ? 2 : 0 });
  roofOver(m, T, x - 0.4, -z + 1.0, x + wing, z - 1.6, wall - T.floorH * 0.55, { along: 'x' });

  if (medium) {
    band(m, -x, -z, x, z, T.floorH + 0.3, 0.24, 0.12, T.trim);
    // Quoins at the corners: a villa is a house with its corners emphasised.
    for (const [px, sx] of [[-x, 1], [x, -1]] as const) {
      for (let i = 0; i < 7; i++) {
        const y = 0.9 + i * ((wall - 1.2) / 7);
        const a = px, b = px + sx * (i % 2 === 0 ? 0.62 : 0.42);
        m.box([Math.min(a, b), y, z - 0.02], [Math.max(a, b), y + 0.3, z + 0.16], T.base);
      }
    }
    if (T.chimney) {
      m.box([-x + 1.2, wall - 0.4, -0.9], [-x + 2.3, top + 1.3, 0.5], T.base);
      m.box([-x + 1.0, top + 1.3, -1.1], [-x + 2.5, top + 1.56, 0.7], T.trim);
    }
    // Garden wall and gate piers to the street.
    for (const [a, b] of [[-x - 1.4, -1.9], [1.9, x + wing]] as const) {
      m.box([a, 0, z + 4.2], [b, 1.15, z + 4.45], T.base);
    }
    for (const px of [-2.1, 2.1]) m.box([px - 0.28, 0, z + 4.1], [px + 0.28, 1.85, z + 4.55], T.base);
  }
  if (fine) {
    punched(m, T, { axis: 'z', sign: 1, plane: z }, -x + 0.9, x - 0.9, { floors, base: 1.15 });
    punched(m, T, { axis: 'z', sign: -1, plane: -z }, -x + 0.9, x - 0.9, { floors, base: 1.15 });
    punched(m, T, { axis: 'x', sign: -1, plane: -x }, -z + 1.0, z - 1.0, { floors, base: 1.15 });
    punched(m, T, { axis: 'z', sign: 1, plane: z - 1.6 }, x + 0.4, x + wing - 0.6, { floors: 1, base: 1.15 });
    punched(m, T, { axis: 'x', sign: 1, plane: x + wing }, -z + 1.6, z - 2.2, { floors: 1, base: 1.15 });
    doorway(m, T, { axis: 'z', sign: 1, plane: z }, 0, true);
    if (T.veranda) veranda(m, T, -x + 1.0, x - 1.0, z, 2.2, T.floorH + 0.1);
    for (const px of [-3.6, 3.6]) planter(m, px, z + 2.4, 0.85, 0.55);
    backyard(m, -x, -z - 6.5, x + wing, -z - 0.5, seed);
  }
  return m;
}

/** Maisonettes: two-storey flats stacked, each with its own front door. */
function maisonette(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 22.0, d = 12.0, units = 4;
  const x = w / 2, z = d / 2;
  const floors = 4;
  const wall = floors * T.floorH + 0.5;

  m.box([-x, 0, -z], [x, wall, z], T.wall, { roof: T.cover });
  m.box([-x - 0.12, 0, -z - 0.12], [x + 0.12, 0.9, z + 0.12], T.base);
  roofOver(m, T, -x, -z, x, z, wall, { along: 'x', dormers: medium ? 3 : 0 });

  if (medium) {
    // The stair to the upper maisonettes is inside, in a projecting bay with
    // its own window, rather than a concrete flight bolted to the front. The
    // external version read as scaffolding across the whole elevation.
    for (let i = 0; i < units / 2; i++) {
      const cx = -x + ((i + 0.5) / (units / 2)) * w;
      m.box([cx - 1.4, 0, z], [cx + 1.4, wall - 0.8, z + 1.1], T.wall, { roof: T.cover });
      roofOver(m, T, cx - 1.4, z, cx + 1.4, z + 1.1, wall - 0.8, { along: 'x' });
    }
    band(m, -x, -z, x, z, T.floorH * 2, 0.26, 0.13, T.trim);
    if (T.chimney) {
      for (const cx of [-w * 0.25, w * 0.25]) m.box([cx - 0.6, wall - 0.4, -1.0], [cx + 0.6, wall + 2.2, 0.4], T.base);
    }
  }
  if (fine) {
    for (let i = 0; i < units; i++) {
      const a = -x + (i / units) * w + 0.5;
      const b = -x + ((i + 1) / units) * w - 0.5;
      punched(m, T, { axis: 'z', sign: 1, plane: z }, a, b, { floors, base: 1.1 });
      doorway(m, T, { axis: 'z', sign: 1, plane: z }, a + 1.1);
    }
    for (let i = 0; i < units / 2; i++) {
      const cx = -x + ((i + 0.5) / (units / 2)) * w;
      // The common door into the stair bay, and the stair window stacked over
      // it, which is how a maisonette block reads from the street.
      doorway(m, T, { axis: 'z', sign: 1, plane: z + 1.1 }, cx);
      for (let f = 1; f < floors; f++) {
        m.opening({ axis: 'z', sign: 1, plane: z + 1.1, u0: cx - 0.7, u1: cx + 0.7,
          y0: f * T.floorH + 0.9, y1: f * T.floorH + 2.3, glass: MAT.GLASS, frame: 0.1, proud: 0.07 });
      }
    }
    punched(m, T, { axis: 'z', sign: -1, plane: -z }, -x + 1.0, x - 1.0, { floors, base: 1.1 });
    for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
      punched(m, T, { axis: 'x', sign, plane }, -z + 1.2, z - 1.2, { floors, base: 1.1 });
    }
    kerb(m, -x - 1.0, z + 3.0, x + 1.0, z + 4.0);
    backyard(m, -x, -z - 7.0, x, -z - 0.5, seed);
  }
  return m;
}

/**
 * A cruciform tower: four wings off a central core.
 *
 * The plan most real point blocks use, and for a reason -- every flat gets two
 * outside walls and daylight from two directions, and the re-entrant corners
 * give the tower a silhouette that changes as you walk round it. A square
 * prism has one silhouette from every angle, which is why the twin-tower and
 * stepped blocks it replaces read as massing studies rather than buildings.
 */
function cross(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const arm = 21.0, wide = 9.0;
  const half = arm / 2, hw = wide / 2;
  const floors = 13;
  const podium = T.floorH * 1.4;
  const wall = podium + floors * T.floorH;

  m.box([-half - 1.0, 0, -half - 1.0], [half + 1.0, podium, half + 1.0], T.base, { roof: MAT.ROOF });
  // The two arms, crossed. Drawn as two slabs rather than a plus-shaped prism
  // because their overlap is the core and wants no seam through it.
  m.box([-half, podium, -hw], [half, wall, hw], T.wall, { roof: T.cover });
  m.box([-hw, podium, -half], [hw, wall, half], T.wall, { roof: T.cover });
  const top = Math.max(
    crown(m, T, -half, -hw, half, hw, wall, seed),
    crown(m, T, -hw, -half, hw, half, wall, seed + 11),
  );

  if (medium) {
    band(m, -half - 1.0, -half - 1.0, half + 1.0, half + 1.0, podium, 0.42, 0.2, T.trim);
    parapet(m, -half - 1.0, -half - 1.0, half + 1.0, half + 1.0, podium, 0.95, 0.16, T.base);
    // A pier in each of the four re-entrant corners, carried the full height:
    // this is what stops the crossing reading as two slabs that met by chance.
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      m.box([Math.min(sx * hw, sx * (hw + 0.7)), podium, Math.min(sz * hw, sz * (hw + 0.7))],
            [Math.max(sx * hw, sx * (hw + 0.7)), top - 0.6, Math.max(sz * hw, sz * (hw + 0.7))], T.base);
    }
    if (T.balcony !== 'none') {
      // Two of the four re-entrant faces, not all four: a balcony is fifty
      // triangles a floor and a cruciform tower has twelve elevations.
      for (const [axis, sign, plane, u0, u1] of [
        ['z', 1, hw, hw + 1.0, half - 1.0], ['z', -1, -hw, -half + 1.0, -hw - 1.0],
      ] as const) {
        balconies(m, { axis, sign, plane }, u0, u1,
          { floors, floorH: T.floorH, base: podium + 0.5, bays: 1, depth: 1.5,
            solid: T.balcony === 'solid' });
      }
    }
  }
  if (fine) {
    // Each arm's end and both flanks, so all twelve outside faces are glazed.
    for (const [a, b, wl] of [
      [-hw + 0.9, hw - 0.9, { axis: 'x', sign: 1, plane: half } as Wall],
      [-hw + 0.9, hw - 0.9, { axis: 'x', sign: -1, plane: -half } as Wall],
      [-hw + 0.9, hw - 0.9, { axis: 'z', sign: 1, plane: half } as Wall],
      [-hw + 0.9, hw - 0.9, { axis: 'z', sign: -1, plane: -half } as Wall],
      [-half + 1.0, -hw - 0.8, { axis: 'z', sign: 1, plane: hw } as Wall],
      [hw + 0.8, half - 1.0, { axis: 'z', sign: 1, plane: hw } as Wall],
      [-half + 1.0, -hw - 0.8, { axis: 'z', sign: -1, plane: -hw } as Wall],
      [hw + 0.8, half - 1.0, { axis: 'z', sign: -1, plane: -hw } as Wall],
      [-half + 1.0, -hw - 0.8, { axis: 'x', sign: 1, plane: hw } as Wall],
      [hw + 0.8, half - 1.0, { axis: 'x', sign: 1, plane: hw } as Wall],
      [-half + 1.0, -hw - 0.8, { axis: 'x', sign: -1, plane: -hw } as Wall],
      [hw + 0.8, half - 1.0, { axis: 'x', sign: -1, plane: -hw } as Wall],
    ] as const) {
      // Every other floor on the flanks. Twelve fully glazed elevations is
      // more than twice the budget for one building.
      if (T.ribbon) banded(m, T, wl, a, b, floors, podium);
      else punched(m, T, wl, a, b, { floors, base: podium + 0.9 });
    }
    doorway(m, T, { axis: 'z', sign: 1, plane: half + 1.0 }, 0, true);
    ribbon(m, { axis: 'z', sign: 1, plane: half + 1.0 }, -half, -2.6, 1.2, podium - 0.9, { mullions: 6 });
    ribbon(m, { axis: 'z', sign: 1, plane: half + 1.0 }, 2.6, half, 1.2, podium - 0.9, { mullions: 6 });
    kerb(m, -half - 3.0, half + 2.6, half + 3.0, half + 3.8);
    bollards(m, { axis: 'z', sign: 1, plane: half + 1.0 }, -half, half, 2.2, 8);
  }
  return m;
}

/**
 * A dense street block: eight storeys round a courtyard, shops on the corner.
 *
 * The most common form of genuinely high-density housing anywhere, and the
 * one the library did not have -- a wall of building along the pavement with
 * the block's own green space hidden behind it, rather than an object standing
 * on a plot with space all round.
 */
function urban(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 30.0, d = 26.0, range = 11.0;
  const x = w / 2, z = d / 2;
  const floors = 8;
  const ground = T.floorH + 1.2;
  const wall = ground + floors * T.floorH;

  // Four ranges round a court, the front one a storey taller.
  const put = (x0: number, z0: number, x1: number, z1: number, h: number): void => {
    m.box([x0, 0, z0], [x1, ground, z1], T.base, { roof: MAT.ROOF });
    m.box([x0, ground, z0], [x1, h, z1], T.wall, { roof: T.cover });
  };
  put(-x, z - range, x, z, wall + T.floorH);
  put(-x, -z, x, -z + range, wall);
  put(-x, -z + range, -x + range, z - range, wall);
  put(x - range, -z + range, x, z - range, wall);
  crown(m, T, -x, z - range, x, z, wall + T.floorH, seed);
  crown(m, T, -x, -z, x, -z + range, wall, seed + 7);
  crown(m, T, -x, -z + range, -x + range, z - range, wall, seed + 13);
  crown(m, T, x - range, -z + range, x, z - range, wall, seed + 19);

  if (medium) {
    band(m, -x, -z, x, z, ground, 0.4, 0.22, T.trim);
    // The courtyard: planted, with the block's own trees in it.
    m.painted(TINT.GREEN, () =>
      m.box([-x + range, 0.01, -z + range], [x - range, 0.08, z - range], MAT.TRIM));
    m.box([-1.6, 0.02, -z + range], [1.6, 0.09, z - range], MAT.GROUND);
    for (let i = 0; i < 4; i++) {
      const px = -4.0 + (i % 2) * 8.0, pz = -3.0 + Math.floor(i / 2) * 6.0;
      m.painted(TINT.WOOD, () => m.cylinder(px, pz, 0.18, 0.08, 2.2, 6, MAT.TIMBER));
      m.painted(TINT.GREEN, () => {
        m.cone(px, pz, 1.8, 1.2, 2.0, 4.6, 8, MAT.TRIM);
        m.cone(px, pz, 1.3, 0.0, 4.2, 6.4, 8, MAT.TRIM);
      });
    }
    // The carriage arch through the front range into the court.
    m.box([-2.6, 0, z - range - 0.2], [2.6, ground + 0.3, z + 0.2], T.base);
    if (T.balcony !== 'none') {
      balconies(m, { axis: 'z', sign: 1, plane: z }, -x + 1.4, -3.4,
        { floors: floors - 1, floorH: T.floorH, base: ground + T.floorH + 0.4, bays: 3,
          depth: 1.4, solid: T.balcony === 'solid' });
      balconies(m, { axis: 'z', sign: 1, plane: z }, 3.4, x - 1.4,
        { floors: floors - 1, floorH: T.floorH, base: ground + T.floorH + 0.4, bays: 3,
          depth: 1.4, solid: T.balcony === 'solid' });
    }
  }
  if (fine) {
    // Shops along the whole street frontage, flats above.
    for (let i = 0; i < 4; i++) {
      const a = -x + (i / 4) * w + 0.7, b = -x + ((i + 1) / 4) * w - 0.7;
      if (a < -3.0 || a > 3.0) {
        shopfront(m, { axis: 'z', sign: 1, plane: z }, a, Math.min(b, -3.2) > a ? Math.min(b, -3.2) : b,
          { bays: 3, doorBay: 1, head: ground - 0.9, fascia: 0.85 });
      }
    }
    punched(m, T, { axis: 'z', sign: 1, plane: z }, -x + 1.0, x - 1.0, { floors: floors + 1, base: ground + 0.9 });
    punched(m, T, { axis: 'z', sign: -1, plane: -z }, -x + 1.0, x - 1.0, { floors, base: ground + 0.9 });
    for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
      punched(m, T, { axis: 'x', sign, plane }, -z + 1.0, z - 1.0, { floors, base: ground + 0.9 });
    }
    // The court elevations, plainer than the street.
    punched(m, T, { axis: 'z', sign: -1, plane: z - range }, -x + range + 1.0, x - range - 1.0,
      { floors, base: ground + 0.9 });
    punched(m, T, { axis: 'z', sign: 1, plane: -z + range }, -x + range + 1.0, x - range - 1.0,
      { floors, base: ground + 0.9 });
    doorway(m, T, { axis: 'z', sign: 1, plane: z }, -x + 3.4, true);
    kerb(m, -x - 1.2, z + 1.6, x + 1.2, z + 2.8);
    bollards(m, { axis: 'z', sign: 1, plane: z }, -x + 1.0, x - 1.0, 2.0, 9);
    roofClutter(m, -x + 2, z - range + 2, x - 2, z - 2, wall + T.floorH, seed, 0.5);
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
  { key: 'bungalow', name: 'Bungalow', build: bungalow, footprint: [3, 3], households: 1 },
  { key: 'villa', name: 'Villa', build: villa, footprint: [3, 3], households: 1 },
];

const MID: Plan[] = [
  { key: 'walkup', name: 'Walk-up', build: walkup, footprint: [3, 3], households: 20 },
  { key: 'corner', name: 'Corner block', build: corner, footprint: [3, 3], households: 24 },
  { key: 'gallery', name: 'Gallery block', build: gallery, footprint: [4, 3], households: 25 },
  { key: 'perimeter', name: 'Perimeter block', build: perimeter, footprint: [3, 3], households: 30 },
  { key: 'shoptop', name: 'Flats over shops', build: shoptop, footprint: [3, 3], households: 16 },
  { key: 'maisonette', name: 'Maisonettes', build: maisonette, footprint: [3, 4], households: 16 },
];

/** Five tall plans, all five in every theme. */
const HIGH: Plan[] = [
  { key: 'point', name: 'Point block', build: point, footprint: [4, 4], households: 56 },
  { key: 'slab', name: 'Slab block', build: slab, footprint: [4, 3], households: 72 },
  { key: 'cross', name: 'Cruciform tower', build: cross, footprint: [4, 4], households: 90 },
  { key: 'urban', name: 'Street block', build: urban, footprint: [4, 4], households: 120 },
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

export const HOUSING: AssetDef[] = [
  ...THEME_ORDER.flatMap((theme) => [
    ...defs(theme, 'low', LOW),
    ...defs(theme, 'medium', MID),
    ...defs(theme, 'high', HIGH),
  ]),
  // Row housing is a supplement rather than a full theme: three low and three
  // medium, all of them plans where a terrace is what the street is made of.
  // There is no tall row house, which is why it stops at medium.
  ...defs('row', 'low', [LOW[1], LOW[2], LOW[0]]),
  ...defs('row', 'medium', [MID[0], MID[2], MID[4]]),
];
