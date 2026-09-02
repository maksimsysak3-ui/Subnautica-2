/**
 * Housing: twenty buildings across three densities.
 *
 * Variety here matters more than in any other category, because housing is
 * most of a city by area. Two prototypes repeated across a district is the
 * single most obvious tell that a builder is a prototype, and the fix is more
 * buildings rather than more triangles per building.
 *
 * Each density shares a vocabulary -- pitched roofs and eaves at the low end,
 * balconies and parapets in the middle, setbacks and fins at the top -- so a
 * street reads as one place while no two buildings match.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import { CELL } from '../types';
import type { AssetDef } from '../types';
import { BRANDS } from '../brands';
import {
  awning, balconies, band, bollards, fasciaSign, fireEscape, kerb, parapet, planter,
  backyard, entrance, frontage, railing, ring, roofClutter, shopfront, windowGrid,
} from '../parts';

/** Ridge height for a span, at roughly a 38-degree pitch. */
const pitch = (span: number): number => span * 0.39;

/** Eaves: a thin overhanging slab. A roof flush with the wall reads as a lid. */
function eaves(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number, y: number, out = 0.42, depth = 0.3): void {
  m.box([x0 - out, y - depth, z0 - out], [x1 + out, y, z1 + out], MAT.TRIM);
}

function chimney(m: MeshBuilder, cx: number, cz: number, base: number, top: number, w = 1.1): void {
  m.box([cx - w / 2, base, cz - w / 2], [cx + w / 2, top, cz + w / 2], MAT.BRICK);
  m.box([cx - w / 2 - 0.14, top, cz - w / 2 - 0.14], [cx + w / 2 + 0.14, top + 0.24, cz + w / 2 + 0.14], MAT.TRIM);
}

function gutters(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number, y: number, out = 0.42): void {
  m.box([x0 - out, y - 0.14, z1 + out - 0.18], [x1 + out, y, z1 + out], MAT.TRIM);
  m.box([x0 - out, y - 0.14, z0 - out], [x1 + out, y, z0 - out + 0.18], MAT.TRIM);
  for (const px of [x0 - out + 0.02, x1 + out - 0.16]) {
    m.box([px, 0, z1 + out - 0.16], [px + 0.14, y - 0.14, z1 + out - 0.02], MAT.TRIM);
  }
}

// ============================================================== low density

function detachedHouse(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 7.4, d = 9.8, wall = 5.4;
  const x = w / 2, z = d / 2;
  const ridge = pitch(w);
  const ww = 4.3, wd = 3.1;
  const wx0 = -ww / 2, wx1 = ww / 2, wz0 = z - 0.2, wz1 = z + wd;

  m.box([-x, 0, -z], [x, wall, z], MAT.BRICK, { roof: MAT.TRIM });
  m.gable([-x, wall, -z], [x, wall, z], ridge, 'z', MAT.ROOF_TILE, MAT.BRICK);

  if (medium) {
    // Cross gable at the front: the cheapest thing that stops a detached house
    // reading as a shed, because it breaks the silhouette and gives the front
    // elevation a centre.
    m.box([wx0, 0, wz0], [wx1, wall - 0.5, wz1], MAT.BRICK, { roof: MAT.TRIM });
    m.gable([wx0, wall - 0.5, wz0], [wx1, wall - 0.5, wz1], pitch(ww), 'x', MAT.ROOF_TILE, MAT.BRICK);
    const gx0 = x - 0.3, gx1 = x + 4.7;
    m.box([gx0, 0, -z + 1.4], [gx1, 3.1, z - 1.6], MAT.BRICK, { roof: MAT.TRIM });
    m.gable([gx0, 3.1, -z + 1.4], [gx1, 3.1, z - 1.6], 1.5, 'z', MAT.ROOF_TILE, MAT.BRICK);
    eaves(m, -x, -z, x, z, wall);
    eaves(m, wx0, wz0, wx1, wz1, wall - 0.5, 0.36);
    eaves(m, gx0, -z + 1.4, gx1, z - 1.6, 3.1, 0.3);
    m.box([-x - 0.05, wall + 0.4, -1.6], [-x + 1.5, wall + 2.0, 0.1], MAT.BRICK);
    m.gable([-x - 0.2, wall + 2.0, -1.75], [-x + 1.65, wall + 2.0, 0.25], 0.7, 'z', MAT.ROOF_TILE, MAT.BRICK);
    chimney(m, x - 1.75, -1.75, wall + 1.2, wall + ridge + 1.8);
  }
  if (fine) {
    gutters(m, -x, -z, x, z, wall);
    // Porch: it sits in the notch between the cross gable and the right-hand
    // corner, and the front door goes on the main wall behind it. The door
    // used to be centred at wx1 + 1.6, which is past the corner of the wing it
    // was nailed to -- so it hung in mid-air, attached to nothing.
    const p0 = wx1 + 0.15;
    const p1 = x - 0.1;
    const pc = (p0 + p1) / 2;
    m.box([p0, 0, z], [p1, 0.16, z + 2.2], MAT.CONCRETE);
    m.box([p0 - 0.25, 2.6, z - 0.1], [p1 + 0.25, 2.92, z + 2.45], MAT.TRIM);
    m.gable([p0 - 0.25, 2.92, z - 0.1], [p1 + 0.25, 2.92, z + 2.45], 0.6, 'x', MAT.ROOF_TILE, MAT.TRIM);
    for (const px of [p0 + 0.2, p1 - 0.2]) {
      m.box([px - 0.11, 0.16, z + 1.85], [px + 0.11, 2.6, z + 2.07], MAT.TRIM);
    }
    // Balustrade down the open side of the porch.
    for (let i = 0; i < 6; i++) {
      const bz = z + 0.5 + (i / 5) * 1.5;
      m.box([p1 - 0.16, 0.16, bz - 0.04], [p1 - 0.06, 0.98, bz + 0.04], MAT.TRIM);
    }
    m.box([p1 - 0.2, 0.98, z + 0.4], [p1 - 0.02, 1.1, z + 2.1], MAT.TRIM);
    entrance(m, { axis: 'z', sign: 1, plane: z }, pc,
      { width: 1.05, height: 2.15, fanlight: true, steps: 1 });
    m.box([wx0 + 0.5, 0.3, wz1], [wx1 - 0.5, 2.9, wz1 + 0.5], MAT.BRICK, { roof: MAT.TRIM });
    m.opening({ axis: 'z', sign: 1, plane: wz1 + 0.5, u0: wx0 + 0.75, u1: wx1 - 0.75, y0: 0.75, y1: 2.55, glass: MAT.GLASS, frame: 0.1, proud: 0.07 });
    m.windowRow({ axis: 'z', sign: 1, plane: wz1, from: wx0, to: wx1, y0: 3.3, y1: 4.7, count: 1, width: 1.5, glass: MAT.GLASS, frame: 0.1, proud: 0.07 });
    for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
      windowGrid(m, { axis: 'x', sign, plane }, -z + 1.2, z - 1.2,
        { floors: 2, floorH: 2.2, base: 1.2, count: 2, width: 1.2, height: 1.5, sill: false });
    }
    windowGrid(m, { axis: 'z', sign: -1, plane: -z }, -x + 1.0, x - 1.0,
      { floors: 2, floorH: 2.2, base: 1.3, count: 2, width: 1.3, height: 1.5, sill: false });
    // A shutter, not a front door, so it keeps the plain form.
    m.painted(TINT.METAL_DARK, () =>
      m.opening({ axis: 'z', sign: 1, plane: z - 1.6, u0: x + 0.4, u1: x + 4.0, y0: 0.15, y1: 2.5, glass: MAT.TRIM, frame: 0.12, proud: 0.09 }));
    backyard(m, -x - 1.0, -z - 8.5, x + 4.7, -z - 0.3, 2);
  }
  return m;
}

function bungalow(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 12.0, d = 8.0, wall = 3.0;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, wall, z], MAT.PLASTER, { roof: MAT.TRIM });
  m.gable([-x, wall, -z], [x, wall, z], pitch(d), 'x', MAT.ROOF_TILE, MAT.PLASTER);

  if (medium) {
    eaves(m, -x, -z, x, z, wall, 0.55);
    chimney(m, -2.0, 0, wall + 1.0, wall + pitch(d) + 1.2, 0.9);
    // Carport: a flat canopy on posts rather than a garage.
    m.box([x, 2.6, -z + 0.8], [x + 4.4, 2.9, z - 0.8], MAT.TRIM);
    for (const pz of [-z + 1.4, z - 1.4]) {
      m.box([x + 3.9, 0, pz - 0.14], [x + 4.2, 2.6, pz + 0.14], MAT.TRIM);
    }
  }
  if (fine) {
    gutters(m, -x, -z, x, z, wall, 0.55);
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0, { width: 1.05, steps: 1, canopy: 1.1 });
    for (const [sign, plane] of [[1, z], [-1, -z]] as const) {
      m.windowRow({ axis: 'z', sign, plane, from: -x + 0.9, to: x - 0.9, y0: 1.0, y1: 2.4,
        count: 4, width: 1.5, glass: MAT.GLASS, frame: 0.09, proud: 0.06 });
    }
    m.windowRow({ axis: 'x', sign: -1, plane: -x, from: -z + 1.0, to: z - 1.0, y0: 1.0, y1: 2.4,
      count: 2, width: 1.2, glass: MAT.GLASS, frame: 0.09, proud: 0.06 });
    frontage(m, -x, x + 4.4, z, 5, { planters: 3, bollards: 6 });
    railing(m, -x + 0.4, -1.6, z + 1.0, 0);
    railing(m, 1.6, x - 0.4, z + 1.0, 0);
    // Garden shed, a path, and a rear window run.
    m.painted(TINT.WOOD, () => {
      m.box([-x + 0.6, 0, -z - 3.4], [-x + 3.2, 2.1, -z - 1.0], MAT.TRIM);
    });
    m.gable([-x + 0.5, 2.1, -z - 3.5], [-x + 3.3, 2.1, -z - 0.9], 0.7, 'x', MAT.ROOF_TILE, MAT.TRIM);
    m.box([-1.4, 0.002, z + 1.0], [1.4, 0.06, z + 3.4], MAT.CONCRETE);
    m.windowRow({ axis: 'x', sign: 1, plane: x, from: -z + 1.0, to: z - 1.0, y0: 1.0, y1: 2.4,
      count: 2, width: 1.2, glass: MAT.GLASS, frame: 0.09, proud: 0.06 });
    backyard(m, -x - 0.5, -z - 8.0, x + 4.4, -z - 0.3, 5);
  }
  return m;
}

function duplex(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 13.5, d = 8.6, wall = 5.6;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, wall, z], MAT.BRICK, { roof: MAT.TRIM });
  m.gable([-x, wall, -z], [x, wall, z], pitch(d), 'x', MAT.ROOF_TILE, MAT.BRICK);

  if (medium) {
    eaves(m, -x, -z, x, z, wall);
    // Two mirrored porches: the whole point of the type is that it is a pair.
    for (const sx of [-1, 1]) {
      const cx = sx * 3.2;
      m.box([cx - 1.5, 0, z], [cx + 1.5, 0.16, z + 1.4], MAT.CONCRETE);
      m.box([cx - 1.7, 2.5, z], [cx + 1.7, 2.82, z + 1.6], MAT.TRIM);
      for (const px of [cx - 1.35, cx + 1.35]) {
        m.box([px - 0.12, 0.16, z + 1.15], [px + 0.12, 2.5, z + 1.4], MAT.TRIM);
      }
    }
    chimney(m, 0, 0, wall + 1.0, wall + pitch(d) + 1.4, 1.3);
  }
  if (fine) {
    gutters(m, -x, -z, x, z, wall);
    for (const sx of [-1, 1]) {
      const cx = sx * 3.2;
      entrance(m, { axis: 'z', sign: 1, plane: z }, cx, { width: 1.0, steps: 1 });
      m.opening({ axis: 'z', sign: 1, plane: z, u0: cx - 2.9, u1: cx - 1.6, y0: 1.0, y1: 2.4, glass: MAT.GLASS, frame: 0.09, proud: 0.06 });
      m.opening({ axis: 'z', sign: 1, plane: z, u0: cx - 1.0, u1: cx + 1.0, y0: 3.4, y1: 4.8, glass: MAT.GLASS, frame: 0.09, proud: 0.06 });
    }
    windowGrid(m, { axis: 'z', sign: -1, plane: -z }, -x + 1.0, x - 1.0,
      { floors: 2, floorH: 2.3, base: 1.2, count: 4, width: 1.1, height: 1.5, sill: false });
    for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
      windowGrid(m, { axis: 'x', sign, plane }, -z + 1.2, z - 1.2,
        { floors: 2, floorH: 2.3, base: 1.2, count: 1, width: 1.1, height: 1.5, sill: false });
    }
    frontage(m, -x, x, z, 9, { planters: 2, bollards: 5 });
    backyard(m, -x, -z - 8.0, x, -z - 0.3, 9);
    for (const sx of [-1, 1]) railing(m, sx * 3.2 - 1.5, sx * 3.2 + 1.5, z + 1.4, 0.16, 0.9);
  }
  return m;
}

function townhouseRow(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const units = 4;
  const uw = 5.0, d = 9.0, wall = 8.4;
  const w = units * uw;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, wall, z], MAT.BRICK, { roof: MAT.ROOF });

  if (medium) {
    // Party walls carried up through the roof, which is what makes a terrace
    // read as separate houses rather than one long block.
    for (let i = 0; i <= units; i++) {
      const px = -x + i * uw;
      m.box([px - 0.22, 0, -z - 0.1], [px + 0.22, wall + 0.9, z + 0.35], MAT.BRICK);
    }
    band(m, -x, -z, x, z, wall, 0.5, 0.3);
    for (let i = 0; i < units; i++) {
      const cx = -x + (i + 0.5) * uw;
      m.box([cx - 1.1, 0, z], [cx + 1.1, 0.32, z + 1.1], MAT.CONCRETE);
      m.box([cx - 1.3, 2.6, z], [cx + 1.3, 2.9, z + 1.3], MAT.TRIM);
    }
    roofClutter(m, -x + 1, -z + 1, x - 1, z - 1, wall + 0.5, 13, 0.5);
  }
  if (fine) {
    for (let i = 0; i < units; i++) {
      const cx = -x + (i + 0.5) * uw;
      entrance(m, { axis: 'z', sign: 1, plane: z }, cx, { width: 1.1, steps: 2 });
      m.opening({ axis: 'z', sign: 1, plane: z, u0: cx - 2.0, u1: cx - 0.85, y0: 0.9, y1: 2.4, glass: MAT.GLASS, frame: 0.09, proud: 0.06 });
      for (let f = 1; f < 3; f++) {
        const y = 0.9 + f * 2.7;
        m.opening({ axis: 'z', sign: 1, plane: z, u0: cx - 1.9, u1: cx - 0.5, y0: y, y1: y + 1.5, glass: MAT.GLASS, frame: 0.09, proud: 0.06 });
        m.opening({ axis: 'z', sign: 1, plane: z, u0: cx + 0.5, u1: cx + 1.9, y0: y, y1: y + 1.5, glass: MAT.GLASS, frame: 0.09, proud: 0.06 });
      }
      m.opening({ axis: 'z', sign: -1, plane: -z, u0: cx - 1.6, u1: cx + 1.6, y0: 1.0, y1: 2.5, glass: MAT.GLASS, frame: 0.09, proud: 0.06 });
    }
    for (let i = 0; i < units; i++) {
    }
    // One long garden behind the row, divided by the party fences.
    backyard(m, -x, -z - 8.0, x, -z - 0.3, 13);
  }
  return m;
}

function cottage(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 6.6, d = 8.2, wall = 4.4;
  const x = w / 2, z = d / 2;
  const ridge = pitch(w) * 1.25;

  m.box([-x, 0, -z], [x, wall, z], MAT.PLASTER, { roof: MAT.TRIM });
  m.gable([-x, wall, -z], [x, wall, z], ridge, 'z', MAT.ROOF_TILE, MAT.PLASTER);

  if (medium) {
    eaves(m, -x, -z, x, z, wall, 0.5);
    chimney(m, 0, -z + 1.2, wall + 1.4, wall + ridge + 1.6, 1.0);
    // Lean-to along one side, and a low garden wall.
    m.box([x, 0, -1.6], [x + 2.6, 2.4, 2.6], MAT.PLASTER, { roof: MAT.TRIM });
    m.quad([x, 2.45, 2.6], [x + 2.6, 2.05, 2.6], [x + 2.6, 2.05, -1.6], [x, 2.45, -1.6], MAT.ROOF_TILE);
    m.box([-x - 1.6, 0.001, z + 2.2], [x + 2.8, 0.7, z + 2.45], MAT.BRICK);
  }
  if (fine) {
    gutters(m, -x, -z, x, z, wall, 0.5);
    entrance(m, { axis: 'z', sign: 1, plane: z }, -1.22, { width: 1.0, height: 2.05, steps: 1 });
    m.opening({ axis: 'z', sign: 1, plane: z, u0: 0.2, u1: 1.9, y0: 1.0, y1: 2.3, glass: MAT.GLASS, frame: 0.1, proud: 0.07 });
    m.windowRow({ axis: 'z', sign: 1, plane: z, from: -x + 0.7, to: x - 0.7, y0: 2.9, y1: 4.0,
      count: 2, width: 1.1, glass: MAT.GLASS, frame: 0.09, proud: 0.06 });
    m.windowRow({ axis: 'x', sign: -1, plane: -x, from: -z + 1.0, to: z - 1.0, y0: 1.1, y1: 2.4,
      count: 2, width: 1.0, glass: MAT.GLASS, frame: 0.09, proud: 0.06 });
    frontage(m, -x - 1.6, x + 2.8, z + 0.8, 17, { planters: 3, bollards: 4, depth: 2.0 });
    railing(m, -x - 1.5, x + 2.7, z + 2.6, 0.7, 0.6, 0.9);
    // Chimney pots, and a water butt against the lean-to.
    for (const px of [-0.35, 0.35]) {
      m.cylinder(px, -z + 1.2, 0.16, wall + ridge + 1.6, wall + ridge + 2.1, 8, MAT.TRIM);
    }
    m.painted(TINT.GREEN, () => m.cylinder(x + 2.9, 2.0, 0.42, 0, 1.3, 10, MAT.TRIM));
    // Porch hood over the door, a log store, and window boxes.
    m.box([-2.2, 2.3, z], [-0.25, 2.6, z + 0.9], MAT.TRIM);
    for (const px of [-2.1, -0.35]) {
      m.box([px - 0.07, 0, z + 0.72], [px + 0.07, 2.3, z + 0.86], MAT.TRIM);
    }
    m.painted(TINT.WOOD, () => {
      for (let i = 0; i < 8; i++) {
        m.cylinder(-x - 0.9 + (i % 4) * 0.34, -z + 1.2 + Math.floor(i / 4) * 0.34, 0.15, 0, 1.1, 6, MAT.TRIM, false);
      }
    });
    m.painted(TINT.GREEN, () => {
      m.box([0.2, 0.85, z], [1.9, 1.15, z + 0.28], MAT.TRIM);
    });
    m.windowRow({ axis: 'x', sign: 1, plane: x, from: -z + 1.2, to: z - 1.2, y0: 1.1, y1: 2.4,
      count: 2, width: 1.0, glass: MAT.GLASS, frame: 0.09, proud: 0.06 });
    backyard(m, -x - 1.4, -z - 7.6, x + 2.8, -z - 0.3, 17);
  }
  return m;
}

function largeHouse(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 9.6, d = 11.0, wall = 6.2;
  const x = w / 2, z = d / 2;
  const ridge = pitch(w);

  m.box([-x, 0, -z], [x, wall, z], MAT.BRICK, { roof: MAT.TRIM });
  m.gable([-x, wall, -z], [x, wall, z], ridge, 'z', MAT.ROOF_TILE, MAT.BRICK);

  if (medium) {
    // Two-storey projecting wing plus a full-width porch: the massing of a
    // larger family house rather than a scaled-up small one.
    m.box([-x, 0, z - 0.4], [-x + 4.2, wall - 0.3, z + 3.0], MAT.BRICK, { roof: MAT.TRIM });
    m.gable([-x, wall - 0.3, z - 0.4], [-x + 4.2, wall - 0.3, z + 3.0], pitch(4.2), 'x', MAT.ROOF_TILE, MAT.BRICK);
    eaves(m, -x, -z, x, z, wall);
    eaves(m, -x, z - 0.4, -x + 4.2, z + 3.0, wall - 0.3, 0.36);
    m.box([-x + 4.2, 3.3, z], [x, 3.62, z + 2.4], MAT.TRIM);
    for (const px of [-x + 4.6, x - 0.5]) {
      m.box([px - 0.16, 0, z + 2.0], [px + 0.16, 3.3, z + 2.32], MAT.TRIM);
    }
    m.box([-x + 4.2, 0, z], [x, 0.2, z + 2.4], MAT.CONCRETE);
    chimney(m, x - 1.6, -2.0, wall + 1.2, wall + ridge + 2.0, 1.2);
    chimney(m, -x + 1.4, -z + 1.4, wall + 1.0, wall + ridge + 1.2, 0.9);
  }
  if (fine) {
    gutters(m, -x, -z, x, z, wall);
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0.95, { width: 1.35, double: true, steps: 1 });
    m.opening({ axis: 'z', sign: 1, plane: z + 3.0, u0: -x + 0.6, u1: -x + 3.6, y0: 0.9, y1: 2.7, glass: MAT.GLASS, frame: 0.11, proud: 0.07 });
    m.opening({ axis: 'z', sign: 1, plane: z + 3.0, u0: -x + 0.9, u1: -x + 3.3, y0: 3.9, y1: 5.3, glass: MAT.GLASS, frame: 0.1, proud: 0.07 });
    m.windowRow({ axis: 'z', sign: 1, plane: z, from: -x + 4.6, to: x - 0.6, y0: 3.9, y1: 5.3,
      count: 2, width: 1.2, glass: MAT.GLASS, frame: 0.1, proud: 0.07 });
    for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
      windowGrid(m, { axis: 'x', sign, plane }, -z + 1.2, z - 1.2,
        { floors: 2, floorH: 2.7, base: 1.3, count: 3, width: 1.1, height: 1.6, sill: false });
    }
    windowGrid(m, { axis: 'z', sign: -1, plane: -z }, -x + 1.0, x - 1.0,
      { floors: 2, floorH: 2.7, base: 1.3, count: 3, width: 1.1, height: 1.6, sill: false });
    planter(m, -x + 1.0, z + 3.6, 0.6);
    backyard(m, -x, -z - 9.0, x, -z - 0.3, 29);
  }
  return m;
}

// =========================================================== medium density

function walkUp(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = CELL * 2 - 1.6, d = CELL * 2 - 2.4;
  const floors = 5, floorH = 3.1;
  const h = floors * floorH;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], MAT.PLASTER, { roof: MAT.ROOF });
  m.box([-x - 0.22, 0, -z - 0.22], [x + 0.22, 3.4, z + 0.22], MAT.BRICK, { roof: MAT.TRIM });

  if (medium) {
    parapet(m, -x, -z, x, z, h, 0.9, 0.2);
    balconies(m, { axis: 'z', sign: 1, plane: z }, -x + 0.4, x - 0.4,
      { floors: floors - 1, floorH, base: 3.5, bays: 3, depth: 1.25, solid: false });
    balconies(m, { axis: 'z', sign: -1, plane: -z }, -x + 0.4, x - 0.4,
      { floors: floors - 1, floorH, base: 3.5, bays: 3, depth: 1.25, solid: false });
    m.box([-1.6, h, -1.4], [1.6, h + 3.0, 1.4], MAT.BRICK, { roof: MAT.ROOF });
    roofClutter(m, -x + 1, -z + 1, x - 1, z - 1, h, 101, 0.9);
  }
  if (fine) {
    for (const [axis, sign, plane, half] of [
      ['z', 1, z, x], ['z', -1, -z, x], ['x', 1, x, z], ['x', -1, -x, z],
    ] as const) {
      windowGrid(m, { axis, sign, plane }, -half + 0.8, half - 0.8,
        { floors: floors - 1, floorH, base: 4.3, count: axis === 'z' ? 3 : 2, width: 1.15, height: 1.5 });
    }
    entrance(m, { axis: 'z', sign: 1, plane: z + 0.22 }, 0,
      { width: 1.5, double: true, steps: 2, canopy: 1.5 });
  }
  return m;
}

function tenement(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 16.0, d = 12.0;
  const floors = 5, floorH = 3.2, ground = 4.0;
  const h = ground + floors * floorH;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], MAT.BRICK, { roof: MAT.ROOF });

  if (medium) {
    // String course per floor and a heavy cornice: an old brick tenement is
    // all horizontal lines.
    for (let f = 1; f <= floors; f++) band(m, -x, -z, x, z, ground + f * floorH - 0.3, 0.3, 0.14);
    band(m, -x, -z, x, z, h - 0.6, 0.6, 0.45);
    parapet(m, -x, -z, x, z, h, 1.1, 0.24);
    band(m, -x, -z, x, z, ground - 0.25, 0.5, 0.22);
    roofClutter(m, -x + 1.2, -z + 1.2, x - 1.2, z - 1.2, h, 111, 1.0);
  }
  if (fine) {
    // Shop run stops short of the corner so the flats above get their own
    // street door. A block of flats whose only door is the shop's is the
    // single most common thing missing from these models.
    shopfront(m, { axis: 'z', sign: 1, plane: z }, -x + 0.6, x - 3.6,
      { bays: 4, doorBay: 1, head: 3.5 });
    entrance(m, { axis: 'z', sign: 1, plane: z }, x - 2.0,
      { width: 1.5, height: 2.5, fanlight: true, steps: 2, canopy: 1.2 });
    awning(m, { axis: 'z', sign: 1, plane: z }, -x + 0.7, -1.4, 3.3, 1.5);
    fasciaSign(m, { axis: 'z', sign: 1, plane: z }, 0.5, 6.0, 2.95, 3.6);
    for (const [axis, sign, plane, half, n] of [
      ['z', 1, z, x, 5], ['z', -1, -z, x, 5], ['x', 1, x, z, 3], ['x', -1, -x, z, 3],
    ] as const) {
      windowGrid(m, { axis, sign, plane }, -half + 0.8, half - 0.8,
        { floors, floorH, base: ground + 0.85, count: n, width: 1.05, height: 1.85 });
    }
    fireEscape(m, { axis: 'x', sign: -1, plane: -x }, -3.0, ground + 0.5, floors - 1, floorH, 3.4);
    bollards(m, { axis: 'z', sign: 1, plane: z }, -x + 1, x - 1, 1.6, 6);
  }
  return m;
}

function courtyardBlock(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 22.0, d = 18.0;
  const floors = 4, floorH = 3.1, h = floors * floorH + 0.8;
  const x = w / 2, z = d / 2;
  const t = 6.5;   // wing depth

  // Three wings around an open court. The court is the whole idea, so it has
  // to be modelled rather than implied.
  m.box([-x, 0, -z], [x, h, -z + t], MAT.PLASTER, { roof: MAT.ROOF });
  m.box([-x, 0, -z + t], [-x + t, h, z], MAT.PLASTER, { roof: MAT.ROOF });
  m.box([x - t, 0, -z + t], [x, h, z], MAT.PLASTER, { roof: MAT.ROOF });

  if (medium) {
    parapet(m, -x, -z, x, -z + t, h, 0.8, 0.2);
    parapet(m, -x, -z + t, -x + t, z, h, 0.8, 0.2);
    parapet(m, x - t, -z + t, x, z, h, 0.8, 0.2);
    m.box([-x, 0, -z], [x, 3.2, -z + t], MAT.BRICK, { roof: MAT.TRIM });
    balconies(m, { axis: 'z', sign: 1, plane: -z + t }, -x + t + 0.5, x - t - 0.5,
      { floors: floors - 1, floorH, base: 3.6, bays: 3, depth: 1.2, solid: false });
    roofClutter(m, -x + 1, -z + 1, x - 1, -z + t - 1, h, 121, 0.8);
    // Courtyard planting and paving.
    m.box([-x + t, 0.0001, -z + t], [x - t, 0.1, z], MAT.CONCRETE);
  }
  if (fine) {
    for (const [axis, sign, plane, u0, u1, n] of [
      ['z', 1, -z + t, -x + t + 0.6, x - t - 0.6, 4],
      ['z', -1, -z, -x + 0.8, x - 0.8, 7],
      ['x', 1, x, -z + t + 0.6, z - 0.6, 3],
      ['x', -1, -x, -z + t + 0.6, z - 0.6, 3],
    ] as const) {
      windowGrid(m, { axis, sign, plane }, u0, u1,
        { floors, floorH, base: 3.9, count: n, width: 1.1, height: 1.6 });
    }
    // The courtyard elevations and the wing ends were blank -- which is most
    // of what you see of this building, since the court is the whole idea.
    for (const sx of [-1, 1] as const) {
      // Inner face of each wing, looking across the court.
      windowGrid(m, { axis: 'x', sign: (-sx) as 1 | -1, plane: sx * (x - t) }, -z + t + 0.6, z - 0.6,
        { floors, floorH, base: 3.9, count: 3, width: 1.1, height: 1.6 });
      // Wing end, facing the street across the open side.
      windowGrid(m, { axis: 'z', sign: 1, plane: z }, sx * (x - t / 2) - 2.0, sx * (x - t / 2) + 2.0,
        { floors, floorH, base: 3.9, count: 2, width: 1.1, height: 1.6 });
      // Outer flank alongside the front wing.
      windowGrid(m, { axis: 'x', sign: sx, plane: sx * x }, -z + 1.0, -z + t - 0.6,
        { floors, floorH, base: 3.9, count: 2, width: 1.1, height: 1.6 });
      // Ground floor: the brick base had nothing in it at all.
      windowGrid(m, { axis: 'x', sign: (-sx) as 1 | -1, plane: sx * (x - t) }, -z + t + 0.8, z - 0.8,
        { floors: 1, floorH, base: 1.1, count: 3, width: 1.1, height: 1.5 });
      windowGrid(m, { axis: 'x', sign: sx, plane: sx * x }, -z + t + 0.8, z - 0.8,
        { floors: 1, floorH, base: 1.1, count: 3, width: 1.1, height: 1.5 });
    }
    windowGrid(m, { axis: 'z', sign: -1, plane: -z }, -x + 1.0, -3.0,
      { floors: 1, floorH, base: 1.1, count: 3, width: 1.1, height: 1.5 });
    windowGrid(m, { axis: 'z', sign: -1, plane: -z }, 3.0, x - 1.0,
      { floors: 1, floorH, base: 1.1, count: 3, width: 1.1, height: 1.5 });
    windowGrid(m, { axis: 'z', sign: 1, plane: -z + t }, -x + t + 0.8, x - t - 0.8,
      { floors: 1, floorH, base: 1.1, count: 3, width: 1.1, height: 1.5 });
    entrance(m, { axis: 'z', sign: -1, plane: -z }, 0,
      { width: 1.8, double: true, steps: 1, canopy: 1.5 });
    // Second door off the court, which is how you actually reach the wings.
    entrance(m, { axis: 'z', sign: 1, plane: -z + t }, 0,
      { width: 1.8, height: 2.4, double: true, glazed: true, canopy: 1.4 });
  }
  return m;
}

function mixedUse(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 18.0, d = 13.0;
  const ground = 4.6, floors = 4, floorH = 3.15;
  const h = ground + floors * floorH;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], MAT.PLASTER, { roof: MAT.ROOF });
  m.box([-x - 0.2, 0, -z - 0.2], [x + 0.2, ground, z + 0.2], MAT.CONCRETE, { roof: MAT.TRIM });

  if (medium) {
    parapet(m, -x, -z, x, z, h, 1.0, 0.22);
    band(m, -x, -z, x, z, ground, 0.35, 0.3);
    balconies(m, { axis: 'z', sign: 1, plane: z }, -x + 0.6, x - 0.6,
      { floors, floorH, base: ground + 0.4, bays: 4, depth: 1.35, solid: false });
    roofClutter(m, -x + 1.2, -z + 1.2, x - 1.2, z - 1.2, h, 131, 1.0);
  }
  if (fine) {
    // Two shop units at the base -- the reason this type exists.
    shopfront(m, { axis: 'z', sign: 1, plane: z + 0.2 }, -x + 0.6, -0.4, { bays: 3, doorBay: 1, head: 3.7 });
    shopfront(m, { axis: 'z', sign: 1, plane: z + 0.2 }, 0.4, x - 0.6, { bays: 3, doorBay: 1, head: 3.7 });
    fasciaSign(m, { axis: 'z', sign: 1, plane: z + 0.2 }, -x + 1.6, -1.4, 3.05, 3.75);
    awning(m, { axis: 'z', sign: 1, plane: z + 0.2 }, 0.5, x - 0.7, 3.9, 1.5);
    // Including the front, which the balconies sit on. It had none, so they
    // looked bolted to a blank wall.
    for (const [axis, sign, plane, half, n, wide] of [
      ['z', 1, z, x, 4, 1.7], ['z', -1, -z, x, 6, 1.1],
      ['x', 1, x, z, 4, 1.1], ['x', -1, -x, z, 4, 1.1],
    ] as const) {
      windowGrid(m, { axis, sign, plane }, -half + 0.8, half - 0.8,
        { floors, floorH, base: ground + 0.9, count: n, width: wide, height: 1.7 });
    }
    // A balcony door per bay, which is what a balcony is reached through.
    for (let f = 0; f < floors; f++) {
      const y = ground + 0.4 + f * floorH;
      for (let b = 0; b < 4; b++) {
        const cx = -x + ((b + 0.5) / 4) * (x * 2);
        m.opening({ axis: 'z', sign: 1, plane: z, u0: cx - 0.45, u1: cx + 0.45,
          y0: y + 0.2, y1: y + 2.35, glass: MAT.GLASS, frame: 0.09, proud: 0.06 });
      }
    }
    bollards(m, { axis: 'z', sign: 1, plane: z }, -x + 1, x - 1, 2.0, 7);
  }
  return m;
}

function slabBlock(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 26.0, d = 11.0;
  const floors = 6, floorH = 2.95, h = floors * floorH;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], MAT.CONCRETE, { roof: MAT.ROOF });

  if (medium) {
    parapet(m, -x, -z, x, z, h, 0.75, 0.2);
    // Access deck along the back: the defining feature of the type.
    for (let f = 1; f < floors; f++) {
      const y = f * floorH;
      m.box([-x, y, -z - 1.5], [x, y + 0.18, -z], MAT.CONCRETE);
      m.painted(TINT.METAL_DARK, () => m.box([-x, y + 0.18, -z - 1.5], [x, y + 1.05, -z - 1.38], MAT.TRIM));
    }
    // Stair towers at each end.
    for (const sx of [-1, 1]) {
      m.box([sx * x - sx * 3.0, 0, -z - 1.6], [sx * x, h + 1.6, -z + 0.2], MAT.CONCRETE, { roof: MAT.ROOF });
    }
    roofClutter(m, -x + 2, -z + 1, x - 2, z - 1, h, 141, 1.1);
  }
  if (fine) {
    windowGrid(m, { axis: 'z', sign: 1, plane: z }, -x + 0.8, x - 0.8,
      { floors, floorH, base: 0.85, count: 9, width: 1.6, height: 1.7 });
    windowGrid(m, { axis: 'z', sign: -1, plane: -z }, -x + 3.4, x - 3.4,
      { floors, floorH, base: 0.85, count: 6, width: 1.0, height: 1.5 });
    // Balcony per bay on the sunny side.
    balconies(m, { axis: 'z', sign: 1, plane: z }, -x + 0.6, x - 0.6,
      { floors, floorH, base: 0.6, bays: 6, depth: 1.15, solid: true });
    for (const sx of [-1, 1]) {
      windowGrid(m, { axis: 'x', sign: sx as 1 | -1, plane: sx * x }, -z + 0.8, z - 0.8,
        { floors, floorH, base: 0.9, count: 1, width: 1.0, height: 1.4, sill: false });
    }
    // The block had no way into it at all. Two entrances at the feet of the
    // stair towers, which is where a deck-access block's doors actually are.
    for (const sx of [-1, 1]) {
      entrance(m, { axis: 'z', sign: -1, plane: -z - 1.6 }, sx * (x - 1.5),
        { width: 1.6, double: true, canopy: 1.4 });
    }
    frontage(m, -x, x, z, 261, { planters: 2, bollards: 8, depth: 2.4 });
  }
  return m;
}

function cornerBlock(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 15.0, d = 15.0;
  const ground = 4.2, floors = 4, floorH = 3.2;
  const h = ground + floors * floorH;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], MAT.BRICK, { roof: MAT.ROOF });
  // Chamfered corner, which is what a corner block is for.
  m.box([x - 3.4, 0, z - 3.4], [x + 0.4, h, z + 0.4], MAT.PLASTER, { roof: MAT.ROOF });

  if (medium) {
    parapet(m, -x, -z, x, z, h, 1.0, 0.24);
    band(m, x - 3.4, z - 3.4, x + 0.4, z + 0.4, h, 1.6, 0.4);
    for (let f = 1; f <= floors; f++) band(m, -x, -z, x, z, ground + f * floorH - 0.28, 0.28, 0.14);
    band(m, -x, -z, x, z, ground - 0.2, 0.42, 0.2);
    roofClutter(m, -x + 1.2, -z + 1.2, x - 1.2, z - 1.2, h, 151, 0.9);
  }
  if (fine) {
    shopfront(m, { axis: 'z', sign: 1, plane: z }, -x + 3.0, x - 4.2, { bays: 3, doorBay: 1, head: 3.6 });
    entrance(m, { axis: 'z', sign: 1, plane: z }, -x + 1.6,
      { width: 1.4, height: 2.5, fanlight: true, steps: 2, canopy: 1.1 });
    shopfront(m, { axis: 'x', sign: 1, plane: x }, -z + 0.6, z - 4.2, { bays: 3, doorBay: 1, head: 3.6 });
    shopfront(m, { axis: 'z', sign: 1, plane: z + 0.4 }, x - 3.2, x + 0.2, { bays: 1, doorBay: 0, head: 3.6 });
    awning(m, { axis: 'z', sign: 1, plane: z }, -x + 0.7, -1.0, 3.4, 1.5);
    for (const [axis, sign, plane, half, n] of [
      ['z', 1, z, x, 4], ['x', 1, x, z, 4], ['z', -1, -z, x, 5], ['x', -1, -x, z, 5],
    ] as const) {
      windowGrid(m, { axis, sign, plane }, -half + 0.9, half - 4.4,
        { floors, floorH, base: ground + 0.85, count: n, width: 1.05, height: 1.75 });
    }
    windowGrid(m, { axis: 'z', sign: 1, plane: z + 0.4 }, x - 3.0, x + 0.2,
      { floors, floorH, base: ground + 0.85, count: 1, width: 2.2, height: 1.75 });
    bollards(m, { axis: 'z', sign: 1, plane: z }, -x + 1, x - 1, 1.6, 6);
  }
  return m;
}

// ============================================================= high density

function pointTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = CELL * 3 - 2.4, x = w / 2, z = w / 2;
  const podium = 9.5;
  const floors = 19, floorH = 3.05;
  const top = podium + floors * floorH;
  const tx = x * 0.70, tz = z * 0.70;

  m.box([-x, 0, -z], [x, podium, z], MAT.BRICK, { roof: MAT.ROOF });
  band(m, -x, -z, x, z, podium, 0.7, 0.25);
  m.box([-tx, podium, -tz], [tx, top, tz], MAT.PLASTER, { roof: MAT.ROOF });

  if (medium) {
    const bays = 5;
    for (let b = 0; b <= bays; b++) {
      const t = b / bays;
      const cx = -tx + t * tx * 2;
      const cz = -tz + t * tz * 2;
      m.box([cx - 0.16, podium, tz], [cx + 0.16, top, tz + 0.34], MAT.TRIM);
      m.box([cx - 0.16, podium, -tz - 0.34], [cx + 0.16, top, -tz], MAT.TRIM);
      m.box([tx, podium, cz - 0.16], [tx + 0.34, top, cz + 0.16], MAT.TRIM);
      m.box([-tx - 0.34, podium, cz - 0.16], [-tx, top, cz + 0.16], MAT.TRIM);
    }
    for (let f = 2; f < floors; f += 3) {
      const y = podium + f * floorH;
      band(m, -tx, -tz, tx, tz, y, 0.18, 0.9);
      m.painted(TINT.METAL_DARK, () => {
        m.box([-tx - 0.9, y + 0.18, tz + 0.78], [tx + 0.9, y + 1.1, tz + 0.9], MAT.TRIM);
        m.box([-tx - 0.9, y + 0.18, -tz - 0.9], [tx + 0.9, y + 1.1, -tz - 0.78], MAT.TRIM);
      });
    }
    parapet(m, -tx, -tz, tx, tz, top, 1.4, 0.3);
    m.box([-tx * 0.55, top, -tz * 0.55], [tx * 0.55, top + 4.2, tz * 0.55], MAT.METAL, { roof: MAT.ROOF });
    m.box([-0.22, top + 4.2, -0.22], [0.22, top + 11, 0.22], MAT.TRIM);
    roofClutter(m, -tx + 1, -tz + 1, tx - 1, tz - 1, top, 161, 0.6);
  }
  if (fine) {
    for (let f = 0; f < floors; f++) {
      const y0 = podium + f * floorH + 0.85;
      for (const [axis, sign, plane, half] of [
        ['z', 1, tz, tx], ['z', -1, -tz, tx], ['x', 1, tx, tz], ['x', -1, -tx, tz],
      ] as const) {
        m.opening({ axis, sign, plane, u0: -half + 0.75, u1: half - 0.75, y0, y1: y0 + 1.55,
          glass: MAT.GLASS, frame: 0.09, proud: 0.05 });
      }
    }
    shopfront(m, { axis: 'z', sign: 1, plane: z }, -x + 1.0, -1.6,
      { bays: 2, doorBay: 0, head: 4.4, brandFascia: false });
    shopfront(m, { axis: 'z', sign: 1, plane: z }, 4.0, x - 1.0,
      { bays: 2, doorBay: 1, head: 4.4, brandFascia: false });
    // Residents' lobby between the two shop runs.
    entrance(m, { axis: 'z', sign: 1, plane: z }, 1.2,
      { width: 2.6, height: 3.2, double: true, canopy: 1.9 });
    bollards(m, { axis: 'z', sign: 1, plane: z }, -x + 1, x - 1, 1.8, 7);
  }
  return m;
}

function slabTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 26.0, d = 13.0;
  const floors = 16, floorH = 3.0, base = 5.0;
  const h = base + floors * floorH;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, base, z], MAT.CONCRETE, { roof: MAT.TRIM });
  m.box([-x + 1.0, base, -z + 0.6], [x - 1.0, h, z - 0.6], MAT.PLASTER, { roof: MAT.ROOF });

  if (medium) {
    // Vertical circulation cores expressed on the ends, which is what stops a
    // slab reading as a wall.
    for (const sx of [-1, 1]) {
      m.box([sx * (x - 1.0) - sx * 3.2, base, -z + 0.4], [sx * (x - 1.0), h + 2.4, z - 0.4], MAT.CONCRETE, { roof: MAT.ROOF });
    }
    parapet(m, -x + 1.0, -z + 0.6, x - 1.0, z - 0.6, h, 1.0, 0.24);
    balconies(m, { axis: 'z', sign: 1, plane: z - 0.6 }, -x + 4.6, x - 4.6,
      { floors, floorH, base: base + 0.5, bays: 5, depth: 1.4, solid: true });
    roofClutter(m, -x + 5, -z + 1, x - 5, z - 1, h, 171, 1.2);
  }
  if (fine) {
    windowGrid(m, { axis: 'z', sign: 1, plane: z - 0.6 }, -x + 4.4, x - 4.4,
      { floors, floorH, base: base + 1.1, count: 3, width: 2.6, height: 1.5, sill: false });
    windowGrid(m, { axis: 'z', sign: -1, plane: -z + 0.6 }, -x + 4.4, x - 4.4,
      { floors, floorH, base: base + 1.1, count: 3, width: 2.6, height: 1.5, sill: false });
    for (const sx of [-1, 1]) {
      windowGrid(m, { axis: 'x', sign: sx as 1 | -1, plane: sx * (x - 1.0) }, -z + 1.2, z - 1.2,
        { floors, floorH, base: base + 1.1, count: 1, width: 1.1, height: 1.4, sill: false });
    }
    shopfront(m, { axis: 'z', sign: 1, plane: z }, -x + 2.0, -2.4,
      { bays: 3, doorBay: 1, head: 4.2, brandFascia: false });
    shopfront(m, { axis: 'z', sign: 1, plane: z }, 2.4, x - 2.0,
      { bays: 3, doorBay: 1, head: 4.2, brandFascia: false });
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0,
      { width: 2.6, height: 3.0, double: true, canopy: 2.1 });
  }
  return m;
}

function glassTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 10.5, z = 9.0;
  const podium = 7.0;
  const floors = 22, floorH = 3.2;
  const top = podium + floors * floorH;

  m.box([-x, 0, -z], [x, podium, z], MAT.CONCRETE, { roof: MAT.ROOF });
  // Three stacked setbacks. A tower that steps reads as much taller than a
  // straight extrusion of the same height.
  const stages: Array<[number, number, number, number]> = [
    [podium, podium + floors * 0.45 * floorH, 0.86, 0.86],
    [podium + floors * 0.45 * floorH, podium + floors * 0.78 * floorH, 0.70, 0.70],
    [podium + floors * 0.78 * floorH, top, 0.54, 0.54],
  ];
  for (const [y0, y1, sx, sz] of stages) {
    m.box([-x * sx, y0, -z * sz], [x * sx, y1, z * sz], MAT.GLASS, { roof: MAT.ROOF });
  }

  if (medium) {
    for (const [, y1, sx, sz] of stages) {
      band(m, -x * sx, -z * sz, x * sx, z * sz, y1, 0.9, 0.35);
    }
    band(m, -x, -z, x, z, podium, 0.8, 0.4);
    m.box([-x * 0.28, top + 0.9, -z * 0.28], [x * 0.28, top + 5.4, z * 0.28], MAT.METAL, { roof: MAT.ROOF });
    m.box([-0.2, top + 5.4, -0.2], [0.2, top + 13.0, 0.2], MAT.TRIM);
    roofClutter(m, -x * 0.5, -z * 0.5, x * 0.5, z * 0.5, top + 0.9, 181, 0.5);
  }
  if (fine) {
    for (const [y0, y1, sx, sz] of stages) {
      const n = Math.max(1, Math.round((y1 - y0) / floorH));
      for (let f = 0; f < n; f++) {
        const y = y0 + f * floorH + 0.4;
        for (const [axis, sign, plane, half] of [
          ['z', 1, z * sz, x * sx], ['z', -1, -z * sz, x * sx],
          ['x', 1, x * sx, z * sz], ['x', -1, -x * sx, z * sz],
        ] as const) {
          m.opening({ axis, sign, plane, u0: -half + 0.5, u1: half - 0.5, y0: y, y1: y + floorH - 1.0,
            glass: MAT.GLASS, frame: 0.07, proud: 0.05 });
        }
      }
    }
    shopfront(m, { axis: 'z', sign: 1, plane: z }, -x + 1.2, -2.2,
      { bays: 3, doorBay: 1, head: 5.2, brandFascia: false });
    shopfront(m, { axis: 'z', sign: 1, plane: z }, 2.2, x - 1.2,
      { bays: 3, doorBay: 1, head: 5.2, brandFascia: false });
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0,
      { width: 2.8, height: 3.4, double: true, canopy: 2.6 });
  }
  return m;
}

function terracedTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 11.0, z = 10.0;
  const floors = 15, floorH = 3.1;

  // Each floor steps back on one side, giving every flat a roof terrace.
  for (let f = 0; f < floors; f++) {
    const y = f * floorH;
    const back = z - (f / floors) * (z * 0.55);
    m.box([-x, y, -z], [x, y + floorH, back], MAT.PLASTER, { roof: MAT.ROOF });
    if (medium && f > 0) {
      m.painted(TINT.METAL_DARK, () => {
        m.box([-x, y, back - 0.12, ], [x, y + 1.05, back], MAT.TRIM);
      });
      if (f % 2 === 0) {
        m.painted(TINT.GREEN, () => m.box([-x + 1.0, y, back + 0.4], [x - 1.0, y + 0.5, back + 1.6], MAT.TRIM));
      }
    }
  }

  if (medium) {
    for (const sx of [-1, 1]) {
      m.box([sx * x - sx * 2.6, 0, -z], [sx * x, floors * floorH + 2.2, -z + 4.0], MAT.CONCRETE, { roof: MAT.ROOF });
    }
    roofClutter(m, -x + 3, -z + 1, x - 3, -z + 3.5, floors * floorH + 2.2, 191, 0.8);
  }
  if (fine) {
    for (let f = 0; f < floors; f++) {
      const y = f * floorH + 0.9;
      const back = z - (f / floors) * (z * 0.55);
      m.opening({ axis: 'z', sign: 1, plane: back, u0: -x + 0.8, u1: x - 0.8, y0: y, y1: y + 1.9,
        glass: MAT.GLASS, frame: 0.08, proud: 0.05 });
      m.opening({ axis: 'z', sign: -1, plane: -z, u0: -x + 3.2, u1: x - 3.2, y0: y, y1: y + 1.5,
        glass: MAT.GLASS, frame: 0.08, proud: 0.05 });
    }
    // Flank windows. Without these the side elevations are eleven storeys of
    // blank render, which is what they looked like.
    for (let f = 0; f < floors; f++) {
      const y = f * floorH + 0.9;
      const back = z - (f / floors) * (z * 0.55);
      for (const sx of [-1, 1] as const) {
        m.opening({ axis: 'x', sign: sx, plane: sx * x, u0: -z + 4.4, u1: back - 0.8,
          y0: y, y1: y + 1.6, glass: MAT.GLASS, frame: 0.08, proud: 0.05 });
      }
    }
    // Entrance at the back, between the two circulation cores -- the stepped
    // front is all terraces, so there is nowhere to put a door there.
    entrance(m, { axis: 'z', sign: -1, plane: -z }, 0,
      { width: 2.4, height: 3.0, double: true, canopy: 2.2 });
    windowGrid(m, { axis: 'z', sign: -1, plane: -z }, -x + 3.2, x - 3.2,
      { floors: 1, floorH: 3, base: 3.6, count: 3, width: 1.2, height: 1.4 });
  }
  return m;
}

function twinPodium(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 13.0, z = 11.0;
  const podium = 8.0;
  const floors = 14, floorH = 3.05;
  const top = podium + floors * floorH;
  const tw = 5.2, td = 6.4;

  m.box([-x, 0, -z], [x, podium, z], MAT.CONCRETE, { roof: MAT.ROOF });
  for (const sx of [-1, 1]) {
    m.box([sx * 6.4 - tw, podium, -td], [sx * 6.4 + tw, top, td], MAT.PLASTER, { roof: MAT.ROOF });
  }

  if (medium) {
    parapet(m, -x, -z, x, z, podium, 1.0, 0.3);
    for (const sx of [-1, 1]) {
      parapet(m, sx * 6.4 - tw, -td, sx * 6.4 + tw, td, top, 1.2, 0.28);
      balconies(m, { axis: 'z', sign: 1, plane: td }, sx * 6.4 - tw + 0.4, sx * 6.4 + tw - 0.4,
        { floors, floorH, base: podium + 0.5, bays: 2, depth: 1.3, solid: false });
    }
    // The podium roof is a shared deck.
    m.painted(TINT.GREEN, () => {
      m.box([-x + 1.5, podium, td + 1.5], [x - 1.5, podium + 0.45, z - 1.5], MAT.TRIM);
    });
    roofClutter(m, -x + 2, -z + 1.5, x - 2, -td - 1.5, podium, 205, 0.7);
  }
  if (fine) {
    for (const sx of [-1, 1]) {
      for (const [axis, sign, plane, half] of [
        ['z', 1, td, tw], ['z', -1, -td, tw], ['x', 1, sx * 6.4 + tw, td], ['x', -1, sx * 6.4 - tw, td],
      ] as const) {
        const p = axis === 'z' ? plane : plane;
        const centre = axis === 'z' ? sx * 6.4 : 0;
        windowGrid(m, { axis, sign, plane: p }, centre - half + 0.6, centre + half - 0.6,
          { floors, floorH, base: podium + 1.0, count: 1, width: half * 1.5, height: 1.6, sill: false });
      }
    }
    shopfront(m, { axis: 'z', sign: 1, plane: z }, -x + 1.5, -3.0,
      { bays: 3, doorBay: 1, head: 4.6, brandFascia: false });
    shopfront(m, { axis: 'z', sign: 1, plane: z }, 3.0, x - 1.5,
      { bays: 3, doorBay: 1, head: 4.6, brandFascia: false });
    // One lobby serving both towers, centred under the deck.
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0,
      { width: 3.0, height: 3.2, double: true, canopy: 2.8 });
    bollards(m, { axis: 'z', sign: 1, plane: z }, -x + 1, x - 1, 1.8, 8);
  }
  return m;
}

// ------------------------------------------------------- semi-detached pair

/**
 * A semi: two houses sharing one party wall, each with a driveway and a small
 * front garden. The commonest house in most cities and, until now, missing.
 */
function semiDetached(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 13.0, d = 8.6, wall = 5.6;
  const x = w / 2, z = d / 2;
  const ridge = pitch(d);

  m.box([-x, 0, -z], [x, wall, z], MAT.HOUSE_WALL);
  m.gable([-x, wall, -z], [x, wall, z], ridge, 'x', MAT.ROOF_TILE, MAT.HOUSE_WALL);
  // Party wall carried up through the ridge, which is what makes it read as
  // two houses rather than one wide one.
  m.box([-0.22, 0, -z - 0.1], [0.22, wall + ridge + 0.35, z + 0.1], MAT.BRICK);

  if (medium) {
    eaves(m, -x, -z, x, z, wall + 0.05);
    gutters(m, -x, -z, x, z, wall + 0.05);
    chimney(m, 0, 0, wall + ridge - 1.2, wall + ridge + 1.6, 1.2);
    // Two bay windows, one per house.
    for (const sx of [-1, 1] as const) {
      const cx = sx * 3.2;
      m.box([cx - 1.5, 0, z], [cx + 1.5, 3.0, z + 0.9], MAT.HOUSE_WALL, { roof: MAT.ROOF });
      m.box([cx - 1.7, 3.0, z - 0.1], [cx + 1.7, 3.25, z + 1.1], MAT.TRIM);
    }
    // Brick plinth: houses do not start at the grass.
    m.box([-x - 0.14, 0, -z - 0.14], [x + 0.14, 0.55, z + 0.14], MAT.BRICK);
  }
  if (fine) {
    for (const sx of [-1, 1] as const) {
      const cx = sx * 3.2;
      m.windowRow({ axis: 'z', sign: 1, plane: z + 0.9, from: cx - 1.4, to: cx + 1.4,
        y0: 0.9, y1: 2.5, count: 3, width: 0.85, glass: MAT.GLASS, frame: 0.09, proud: 0.06 });
      windowGrid(m, { axis: 'z', sign: 1, plane: z }, cx - 1.5, cx + 1.5,
        { floors: 1, floorH: 3, base: 3.7, count: 2, width: 0.95, height: 1.4 });
      windowGrid(m, { axis: 'z', sign: -1, plane: -z }, cx - 2.2, cx + 2.2,
        { floors: 2, floorH: 2.9, base: 0.95, count: 2, width: 1.0, height: 1.35 });
      windowGrid(m, { axis: 'x', sign: sx, plane: sx * x }, -z + 1.4, z - 1.4,
        { floors: 2, floorH: 2.9, base: 1.0, count: 1, width: 0.85, height: 1.3 });
      // Front door in the inner corner of each half, under a small hood.
      entrance(m, { axis: 'z', sign: 1, plane: z }, sx * 0.95,
        { width: 1.0, height: 2.1, fanlight: true, steps: 1, canopy: 1.1 });
      // Driveway and a low wall to the pavement.
      m.box([sx * 4.4 - 1.4, 0.002, z + 0.9], [sx * 4.4 + 1.4, 0.06, z + 5.4], MAT.CONCRETE);
      m.box([sx * 6.1, 0, z + 1.0], [sx * 6.1 + sx * 0.3, 0.7, z + 5.4], MAT.BRICK);
    }
    backyard(m, -x, -z - 8.4, x, -z - 0.2, 623);
    kerb(m, -x - 1.0, z + 5.4, x + 1.0, z + 5.8);
  }
  return m;
}

// -------------------------------------------------------------- deco block

/**
 * An inter-war mansion block: brick, banded, symmetrical, with a stone-framed
 * entrance in the middle. Nothing else in the middle band has this weight, so
 * it stops medium-density streets reading as one rendered box after another.
 */
function decoBlock(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 21.0, d = 14.0;
  const floors = 5, floorH = 3.15, ground = 3.9;
  const h = ground + floors * floorH;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], MAT.BRICK, { roof: MAT.ROOF });
  // Projecting end bays and a taller centre: the composition is the point.
  for (const sx of [-1, 1] as const) {
    m.box([sx * x - sx * 4.6, 0, z - 0.2], [sx * x, h + 1.4, z + 1.4], MAT.BRICK, { roof: MAT.ROOF });
  }
  m.box([-3.2, 0, z - 0.2], [3.2, h + 2.6, z + 1.0], MAT.PLASTER, { roof: MAT.ROOF });

  if (medium) {
    band(m, -x, -z, x, z, ground - 0.3, 0.55, 0.26);
    for (let f = 1; f <= floors; f++) band(m, -x, -z, x, z, ground + f * floorH - 0.32, 0.32, 0.15);
    parapet(m, -x, -z, x, z, h, 1.0, 0.26);
    for (const sx of [-1, 1] as const) {
      parapet(m, sx * x - sx * 4.6, z - 0.2, sx * x, z + 1.4, h + 1.4, 0.8, 0.3);
    }
    parapet(m, -3.2, z - 0.2, 3.2, z + 1.0, h + 2.6, 0.9, 0.34);
    // Stepped crown over the centre bay, the deco signature.
    for (let i = 0; i < 3; i++) {
      const t = 3.2 - i * 0.75;
      m.box([-t, h + 3.5 + i * 0.55, z - 0.1], [t, h + 4.05 + i * 0.55, z + 0.9], MAT.PLASTER);
    }
    roofClutter(m, -x + 2, -z + 2, x - 2, z - 3, h, 631, 0.8);
  }
  if (fine) {
    for (const sx of [-1, 1] as const) {
      windowGrid(m, { axis: 'z', sign: 1, plane: z + 1.4 }, Math.min(sx * x - sx * 4.0, sx * x - sx * 0.7), Math.max(sx * x - sx * 4.0, sx * x - sx * 0.7),
        { floors, floorH, base: ground + 0.85, count: 2, width: 1.15, height: 1.85 });
    }
    windowGrid(m, { axis: 'z', sign: 1, plane: z }, -x + 5.2, -3.6,
      { floors, floorH, base: ground + 0.85, count: 2, width: 1.15, height: 1.85 });
    windowGrid(m, { axis: 'z', sign: 1, plane: z }, 3.6, x - 5.2,
      { floors, floorH, base: ground + 0.85, count: 2, width: 1.15, height: 1.85 });
    // Tall stair window over the door, which is where the eye goes.
    for (let f = 0; f < floors; f++) {
      m.opening({ axis: 'z', sign: 1, plane: z + 1.0, u0: -1.9, u1: 1.9,
        y0: ground + f * floorH + 0.7, y1: ground + f * floorH + 2.5,
        glass: MAT.GLASS, frame: 0.12, proud: 0.06 });
    }
    windowGrid(m, { axis: 'z', sign: -1, plane: -z }, -x + 1.0, x - 1.0,
      { floors, floorH, base: ground + 0.85, count: 6, width: 1.15, height: 1.8 });
    for (const sx of [-1, 1] as const) {
      windowGrid(m, { axis: 'x', sign: sx, plane: sx * x }, -z + 1.2, z - 1.2,
        { floors, floorH, base: ground + 0.85, count: 4, width: 1.1, height: 1.8 });
    }
    entrance(m, { axis: 'z', sign: 1, plane: z + 1.0 }, 0,
      { width: 2.4, height: 3.0, double: true, steps: 3, canopy: 1.8 });
    frontage(m, -x, x, z + 1.4, 633, { planters: 2, bollards: 7, depth: 2.4 });
  }
  return m;
}

// ------------------------------------------------------------- estate tower

/**
 * A brick estate tower with a concrete frame expressed on the outside and
 * balconies on every flat. The high-density set was all glass and render; a
 * real skyline has a few of these, and they age differently to the rest.
 */
function estateTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 10.0, z = 9.5;
  const podium = 4.6;
  const floors = 16, floorH = 2.95;
  const top = podium + floors * floorH;

  m.box([-x, 0, -z], [x, podium, z], MAT.CONCRETE, { roof: MAT.TRIM });
  m.box([-x + 0.6, podium, -z + 0.6], [x - 0.6, top, z - 0.6], MAT.BRICK, { roof: MAT.ROOF });
  // Service core standing proud on the back, carried above the roof.
  m.box([-3.4, 0, -z - 2.6], [3.4, top + 3.6, -z + 0.8], MAT.CONCRETE, { roof: MAT.ROOF });

  if (medium) {
    // Concrete frame: a slab edge at every floor and a pier at every corner.
    for (let f = 0; f <= floors; f++) {
      band(m, -x + 0.6, -z + 0.6, x - 0.6, z - 0.6, podium + f * floorH, 0.35, 0.35, MAT.CONCRETE);
    }
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        m.box([Math.min(sx * (x - 0.6) - sx * 1.1, sx * (x - 0.6) + sx * 0.35), podium,
               Math.min(sz * (z - 0.6) - sz * 1.1, sz * (z - 0.6) + sz * 0.35)],
              [Math.max(sx * (x - 0.6) - sx * 1.1, sx * (x - 0.6) + sx * 0.35), top + 0.9,
               Math.max(sz * (z - 0.6) - sz * 1.1, sz * (z - 0.6) + sz * 0.35)], MAT.CONCRETE);
      }
    }
    parapet(m, -x + 0.6, -z + 0.6, x - 0.6, z - 0.6, top, 1.1, 0.3);
    balconies(m, { axis: 'z', sign: 1, plane: z - 0.6 }, -x + 1.8, x - 1.8,
      { floors, floorH, base: podium + 0.35, bays: 2, depth: 1.5, solid: true });
    roofClutter(m, -x + 2, -z + 2, x - 2, z - 2, top, 641, 0.7);
    // Drying-green podium roof, which is what these have instead of a garden.
    m.painted(TINT.GREEN, () => {
      m.box([-x + 1.2, podium, 1.0], [x - 1.2, podium + 0.4, z - 1.2], MAT.TRIM);
    });
  }
  if (fine) {
    for (const [axis, sign, plane, half, n] of [
      ['z', 1, z - 0.6, x - 0.6, 2], ['z', -1, -z + 0.6, x - 0.6, 2],
      ['x', 1, x - 0.6, z - 0.6, 3], ['x', -1, -x + 0.6, z - 0.6, 3],
    ] as const) {
      windowGrid(m, { axis, sign, plane }, -half + 1.4, half - 1.4,
        { floors, floorH, base: podium + 0.95, count: n, width: 1.5, height: 1.55, sill: false });
    }
    // Stair lights up the core, and the entrance at its foot.
    for (let f = 1; f < floors + 1; f++) {
      m.opening({ axis: 'x', sign: 1, plane: 3.4, u0: -z - 2.2, u1: -z + 0.4,
        y0: podium + f * floorH - 1.6, y1: podium + f * floorH - 0.3,
        glass: MAT.GLASS, frame: 0.1, proud: 0.05 });
    }
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0,
      { width: 2.4, height: 2.8, double: true, glazed: true, canopy: 2.2 });
    m.windowRow({ axis: 'z', sign: 1, plane: z, from: -x + 1.2, to: -2.2, y0: 1.0, y1: 3.2,
      count: 2, width: 2.0, glass: MAT.GLASS, frame: 0.1, proud: 0.06 });
    m.windowRow({ axis: 'z', sign: 1, plane: z, from: 2.2, to: x - 1.2, y0: 1.0, y1: 3.2,
      count: 2, width: 2.0, glass: MAT.GLASS, frame: 0.1, proud: 0.06 });
    frontage(m, -x, x, z, 643, { planters: 2, bollards: 7 });
  }
  return m;
}

// ==================================================================== table

const power = (households: number): number => households * 1.6;
const home = (h: number): AssetDef['sim'] => ({
  households: h, powerKW: power(h), waterM3: h * 0.55, garbagePerWeek: h * 11,
  pollution: h > 40 ? 2 : 0, upkeep: Math.round(h * 2.1) + 5,
});

export const RESIDENTIAL: AssetDef[] = [
  { id: 'res.low.detached', name: 'Detached house', zone: 'residential', density: 'low', variant: 'sculpted', footprint: [2, 4], height: 10.4, sim: home(1), note: 'Cross gable, garage wing, dormer, porch with balusters, bay window.', build: detachedHouse },
  { id: 'res.low.bungalow', name: 'Bungalow', zone: 'residential', density: 'low', variant: 'sculpted', footprint: [3, 3], height: 6.2, sim: home(1), note: 'Single storey under a wide low roof, deep eaves, carport on posts.', build: bungalow },
  { id: 'res.low.duplex', name: 'Duplex', zone: 'residential', density: 'low', variant: 'sculpted', footprint: [3, 3], height: 9.0, sim: home(2), note: 'A mirrored pair under one roof, two porches, shared central chimney.', build: duplex },
  { id: 'res.low.terrace', name: 'Terrace of four', zone: 'residential', density: 'low', variant: 'sculpted', footprint: [3, 3], height: 9.4, sim: home(4), note: 'Party walls carried through the roof so it reads as four houses, not one block.', build: townhouseRow },
  { id: 'res.low.cottage', name: 'Cottage', zone: 'residential', density: 'low', variant: 'sculpted', footprint: [2, 3], height: 8.0, sim: home(1), note: 'Steep roof, lean-to along one side, garden wall, two trees.', build: cottage },
  { id: 'res.low.large', name: 'Large family house', zone: 'residential', density: 'low', variant: 'sculpted', footprint: [2, 4], height: 11.0, sim: home(1), note: 'Two-storey projecting wing, full-width porch, two chimneys.', build: largeHouse },

  { id: 'res.low.semi', name: 'Semi-detached pair', zone: 'residential', density: 'low', variant: 'sculpted', footprint: [2, 4], height: 9.5, sim: home(2), note: 'Two houses under one roof, party wall through the ridge, bay windows, driveways, back gardens.', build: semiDetached },
  { id: 'res.mid.walkup', name: 'Walk-up flats', zone: 'residential', density: 'medium', variant: 'sculpted', footprint: [3, 3], height: 18.5, sim: home(24), note: 'Masonry base, balconies front and back, stair core over the roofline.', build: walkUp },
  { id: 'res.mid.tenement', name: 'Tenement', zone: 'residential', density: 'medium', brand: BRANDS.bakery, variant: 'sculpted', footprint: [3, 2], height: 21.1, sim: home(30), note: 'Shop at street level, string course per floor, heavy cornice, fire escape.', build: tenement },
  { id: 'res.mid.courtyard', name: 'Courtyard block', zone: 'residential', density: 'medium', variant: 'sculpted', footprint: [3, 3], height: 13.2, sim: home(36), note: 'Three wings round a planted court, balconies facing in.', build: courtyardBlock },
  { id: 'res.mid.mixed', name: 'Flats over shops', zone: 'residential', density: 'medium', brand: BRANDS.grocer, variant: 'sculpted', footprint: [3, 3], height: 17.2, sim: home(28), note: 'Two retail units at the base, four floors of flats with balconies over.', build: mixedUse },
  { id: 'res.mid.slab', name: 'Deck-access block', zone: 'residential', density: 'medium', variant: 'sculpted', footprint: [4, 2], height: 17.7, sim: home(48), note: 'Open access decks along the back, stair towers at both ends.', build: slabBlock },
  { id: 'res.mid.corner', name: 'Corner block', zone: 'residential', density: 'medium', variant: 'sculpted', footprint: [2, 3], height: 18.0, sim: home(26), note: 'Chamfered corner with its own shopfront, string courses, awning.', build: cornerBlock },

  { id: 'res.mid.deco', name: 'Mansion block', zone: 'residential', density: 'medium', variant: 'sculpted', footprint: [3, 3], height: 25.0, sim: home(24), note: 'Inter-war brick block: projecting end bays, stepped centre crown, stone entrance, tall stair window.', build: decoBlock },
  { id: 'res.high.point', name: 'Point tower', zone: 'residential', density: 'high', variant: 'sculpted', footprint: [3, 3], height: 79, sim: home(180), note: 'Podium and setback, vertical fins full height, balcony band every third floor.', build: pointTower },
  { id: 'res.high.slab', name: 'Slab tower', zone: 'residential', density: 'high', variant: 'sculpted', footprint: [4, 2], height: 55, sim: home(190), note: 'Expressed cores at both ends, solid balconies across the sunny elevation.', build: slabTower },
  { id: 'res.high.glass', name: 'Stepped glass tower', zone: 'residential', density: 'high', variant: 'sculpted', footprint: [3, 3], height: 91, sim: home(210), note: 'Three setbacks with a slab band at each, crown and mast.', build: glassTower },
  { id: 'res.high.terraced', name: 'Terraced tower', zone: 'residential', density: 'high', variant: 'sculpted', footprint: [3, 3], height: 49, sim: home(120), note: 'Every floor steps back, so every flat gets a planted terrace.', build: terracedTower },
  { id: 'res.high.twin', name: 'Twin towers on a podium', zone: 'residential', density: 'high', variant: 'sculpted', footprint: [4, 4], height: 51, sim: home(200), note: 'Two towers off a shared podium with a planted deck between them.', build: twinPodium },
  { id: 'res.high.estate', name: 'Estate tower', zone: 'residential', density: 'high', variant: 'sculpted', footprint: [3, 4], height: 56.1, sim: home(64), note: 'Brick infill in an expressed concrete frame, balconies both sides, stair core carried above the roof.', build: estateTower },
];

void ring;
