/**
 * Commercial: fourteen businesses, not two buildings.
 *
 * The point of the category is variety at street level. A city where every
 * shop is the same shop is the thing that makes a builder look cheap, and the
 * fix is not more triangles per building -- it is more buildings, each with a
 * different frontage, sign, awning and colour. The brand system does most of
 * that work: the same shopfront part makes a grocer and a diner because the
 * fascia, awning and door are painted from an index.
 *
 * Brands are fictional. Real chains' names and marks are trademarks, and what
 * a city needs is a recognisable kind of place, not a specific one.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import { BRANDS } from '../brands';
import {
  awning, band, bladeSign, bollards, boxSign, fasciaSign, fireEscape,
  chimneyStack, eavesBand, entrance, frontage, kerb, parapet, planter, pylonSign, railing, ring,
  roofClutter, shopfront,
  windowGrid,
} from '../parts';

// -------------------------------------------------------------- corner shop

function cornerShop(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 13.0, d = 11.0;
  const x = w / 2, z = d / 2;
  const ground = 4.2, floors = 2, floorH = 3.2;
  const top = ground + floors * floorH;

  m.box([-x, 0, -z], [x, top, z], MAT.BRICK, { roof: MAT.ROOF });

  if (medium) {
    parapet(m, -x, -z, x, z, top, 1.0, 0.22);
    band(m, -x, -z, x, z, ground - 0.15, 0.4, 0.16);
    roofClutter(m, -x + 1, -z + 1, x - 1, z - 1, top, 3, 0.8);
  }
  if (fine) {
    shopfront(m, { axis: 'z', sign: 1, plane: z }, -x + 0.6, x - 0.6, { bays: 4, doorBay: 1, head: 3.6 });
    shopfront(m, { axis: 'x', sign: 1, plane: x }, -z + 0.8, z - 2.4, { bays: 3, doorBay: 3, head: 3.6 });
    awning(m, { axis: 'z', sign: 1, plane: z }, -x + 0.7, -0.4, 3.0, 1.6);
    bladeSign(m, { axis: 'z', sign: 1, plane: z }, x - 2.0, 4.6, 6.3, 1.4);
    fasciaSign(m, { axis: 'z', sign: 1, plane: z }, -x + 1.2, x - 3.4, 3.05, 3.85);
    fasciaSign(m, { axis: 'x', sign: 1, plane: x }, -z + 1.4, z - 3.6, 3.05, 3.85);
    windowGrid(m, { axis: 'z', sign: 1, plane: z }, -x + 1.0, x - 1.0,
      { floors, floorH, base: ground + 0.9, count: 3, width: 1.3, height: 1.8 });
    windowGrid(m, { axis: 'x', sign: 1, plane: x }, -z + 1.0, z - 1.0,
      { floors, floorH, base: ground + 0.9, count: 3, width: 1.2, height: 1.8 });
    windowGrid(m, { axis: 'x', sign: -1, plane: -x }, -z + 1.0, z - 1.0,
      { floors, floorH, base: ground + 0.9, count: 2, width: 1.2, height: 1.8 });
    bollards(m, { axis: 'z', sign: 1, plane: z }, -x + 1, x - 1, 1.5, 5);
    planter(m, x - 1.6, z + 1.9, 0.7);
  }
  return m;
}

// --------------------------------------------------------------------- diner

function diner(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 15.0, d = 8.4;
  const x = w / 2, z = d / 2;
  const h = 4.4;

  m.box([-x, 0, -z], [x, h, z], MAT.PLASTER, { roof: MAT.ROOF });
  // A low band of dark brick under the glazing, the way a roadside diner sits.
  m.painted(TINT.BRAND_DARK, () => m.box([-x - 0.12, 0, -z - 0.12], [x + 0.12, 1.0, z + 0.12], MAT.TRIM));

  if (medium) {
    // Deep eaves all round: the signature of the type.
    m.painted(TINT.BRAND, () => ring(m, -x, -z, x, z, h - 0.6, 0.6, 1.1));
    m.box([-x - 1.1, h - 0.72, -z - 1.1], [x + 1.1, h - 0.6, z + 1.1], MAT.CONCRETE);
    parapet(m, -x, -z, x, z, h, 0.5, 0.2);
    roofClutter(m, -x + 1, -z + 1, x - 1, z - 1, h + 0.5, 11, 0.7);
    pylonSign(m, x - 2.2, z + 4.4, 8.5, 2.4);
  }
  if (fine) {
    // Continuous glazing, which is what you look through from a booth, broken
    // in the middle for the way in.
    for (const [from, to, n] of [[-x + 0.8, -1.5, 3], [1.5, x - 0.8, 3]] as const) {
      m.windowRow({ axis: 'z', sign: 1, plane: z, from, to, y0: 1.05, y1: 3.5,
        count: n, width: 1.55, glass: MAT.SHOPFRONT, frame: 0.09, proud: 0.07 });
    }
    m.windowRow({ axis: 'z', sign: -1, plane: -z, from: -x + 0.8, to: x - 0.8, y0: 1.05, y1: 3.5,
      count: 7, width: 1.55, glass: MAT.SHOPFRONT, frame: 0.09, proud: 0.07 });
    m.windowRow({ axis: 'x', sign: 1, plane: x, from: -z + 0.8, to: z - 0.8, y0: 1.05, y1: 3.5,
      count: 3, width: 1.5, glass: MAT.SHOPFRONT, frame: 0.09, proud: 0.07 });
    fasciaSign(m, { axis: 'z', sign: 1, plane: z }, -4.5, 4.5, h - 0.45, h - 0.05);
    // Entrance: a glazed door under a canopy on two posts. This was a solid
    // brand-coloured slab across the front, which read as a wall, not a porch.
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0,
      { width: 2.2, height: 2.5, double: true, glazed: true, canopy: 1.9 });
    m.painted(TINT.METAL_DARK, () => {
      for (const px of [-1.7, 1.7]) {
        m.box([px - 0.07, 0, z + 1.7], [px + 0.07, 3.45, z + 1.84], MAT.TRIM);
      }
    });
    m.box([-2.0, 0, z + 0.1], [2.0, 0.14, z + 1.9], MAT.CONCRETE);
    bladeSign(m, { axis: 'x', sign: 1, plane: x }, 0, 2.4, 4.2, 1.5);
    bollards(m, { axis: 'z', sign: 1, plane: z }, -x + 1, x - 1, 2.4, 6);
  }
  return m;
}

// ---------------------------------------------------------------- drive-thru

function driveThru(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 14.0, d = 11.0;
  const x = w / 2, z = d / 2;
  const cx = -3.0;                    // building sits left, lane wraps right
  const h = 5.0;

  m.box([cx - x / 2, 0, -z], [cx + x / 2, h, z], MAT.PLASTER, { roof: MAT.ROOF });

  if (medium) {
    // The mansard-ish brand band that every one of these has.
    m.painted(TINT.BRAND, () => ring(m, cx - x / 2, -z, cx + x / 2, z, h - 1.5, 1.9, 0.5));
    roofClutter(m, cx - x / 2 + 1, -z + 1, cx + x / 2 - 1, z - 1, h + 0.4, 21, 1.1);

    // Drive-through canopy on posts, over the lane.
    const lx = cx + x / 2 + 1.2;
    m.box([lx, 3.4, -z + 1.0], [lx + 5.4, 3.8, z - 1.0], MAT.CONCRETE);
    m.painted(TINT.METAL_DARK, () => {
      for (const pz of [-z + 1.6, z - 1.6]) {
        m.box([lx + 4.6, 0, pz - 0.16], [lx + 4.9, 3.4, pz + 0.16], MAT.TRIM);
      }
    });
    // Lane surface and kerbs.
    kerb(m, lx - 0.4, -z, lx + 5.6, z);
    pylonSign(m, cx - x / 2 - 2.6, z - 1.5, 9.5, 2.6);
  }
  if (fine) {
    shopfront(m, { axis: 'z', sign: 1, plane: z }, cx - x / 2 + 0.7, cx + x / 2 - 0.7,
      { bays: 4, doorBay: 0, head: 3.5 });
    fasciaSign(m, { axis: 'z', sign: 1, plane: z }, cx - 3.0, cx + 3.0, h - 1.15, h - 0.15);
    fasciaSign(m, { axis: 'x', sign: -1, plane: cx - x / 2 }, -2.6, 2.6, h - 1.15, h - 0.15);
    // Order window and menu board on the lane side.
    const lane = { axis: 'x' as const, sign: 1 as const, plane: cx + x / 2 };
    m.windowRow({ axis: 'x', sign: 1, plane: cx + x / 2, from: -1.2, to: 1.2, y0: 1.5, y1: 2.8,
      count: 1, width: 1.6, glass: MAT.SHOPFRONT, frame: 0.1, proud: 0.07 });
    boxSign(m, lane, -3.6, -1.6, 1.6, 3.2);
    frontage(m, cx - x / 2, cx + x / 2, z, 4, { planters: 2, bollards: 5 });
    // Order point: speaker post, menu canopy and a bin by the lane.
    m.painted(TINT.METAL_DARK, () => {
      m.box([cx + x / 2 + 5.0, 0, -1.4], [cx + x / 2 + 5.3, 1.5, -1.1], MAT.TRIM);
      m.box([cx + x / 2 + 4.6, 1.5, -1.7], [cx + x / 2 + 5.7, 2.6, -0.8], MAT.TRIM);
    });
    railing(m, cx - x / 2, cx + x / 2 - 2.0, z + 2.2, 0, 0.95, 1.2);
    // Outdoor seating under the eaves, and a lane-side kerb line.
    m.painted(TINT.METAL_DARK, () => {
      for (const tx of [cx - 4.2, cx + 0.6]) {
        m.cylinder(tx, z + 1.2, 0.13, 0, 0.72, 6, MAT.TRIM, false);
        m.cylinder(tx, z + 1.2, 0.58, 0.72, 0.78, 10, MAT.TRIM);
        for (const ox of [-0.95, 0.95]) {
          m.box([tx + ox - 0.2, 0, z + 1.0], [tx + ox + 0.2, 0.44, z + 1.4], MAT.TRIM);
          m.box([tx + ox - 0.2, 0.44, z + 1.22], [tx + ox + 0.2, 0.92, z + 1.4], MAT.TRIM);
        }
      }
    });
    for (let i = 0; i < 8; i++) {
      m.box([cx + x / 2 + 1.4 + i * 0.7, 0.002, -z + 0.6], [cx + x / 2 + 1.8 + i * 0.7, 0.02, -z + 0.9], MAT.TRIM);
    }
    windowGrid(m, { axis: 'x', sign: -1, plane: cx - x / 2 }, -z + 1.0, z - 1.0,
      { floors: 1, floorH: 3, base: 1.6, count: 3, width: 1.1, height: 1.5 });
  }
  return m;
}

// ---------------------------------------------------------------- coffee bar

function coffeeBar(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 9.5, d = 8.0;
  const x = w / 2, z = d / 2;
  const h = 4.0;

  m.box([-x, 0, -z], [x, h, z], MAT.BRICK, { roof: MAT.ROOF });

  if (medium) {
    parapet(m, -x, -z, x, z, h, 0.7, 0.2);
    roofClutter(m, -x + 0.8, -z + 0.8, x - 0.8, z - 0.8, h, 31, 0.6);
    // Terrace: a raised deck with a low wall around it.
    m.box([-x, 0.0001, z], [x, 0.16, z + 3.6], MAT.CONCRETE);
    m.box([-x, 0.16, z + 3.4], [x, 0.75, z + 3.6], MAT.BRICK);
  }
  if (fine) {
    shopfront(m, { axis: 'z', sign: 1, plane: z }, -x + 0.5, x - 0.5, { bays: 3, doorBay: 2, head: 3.3 });
    awning(m, { axis: 'z', sign: 1, plane: z }, -x + 0.6, x - 0.6, 3.5, 1.8);
    bladeSign(m, { axis: 'z', sign: 1, plane: z }, -x + 1.2, 3.0, 4.4, 1.3);
    // Tables: a top and a pedestal, twice.
    m.painted(TINT.METAL_DARK, () => {
      for (const tx of [-2.4, 1.4]) {
        m.cylinder(tx, z + 1.9, 0.14, 0.16, 0.72, 6, MAT.TRIM, false);
        m.cylinder(tx, z + 1.9, 0.62, 0.72, 0.78, 10, MAT.TRIM);
        for (const [ox, oz] of [[-1.0, 0], [1.0, 0]] as const) {
          m.box([tx + ox - 0.22, 0.16, z + 1.9 + oz - 0.22], [tx + ox + 0.22, 0.46, z + 1.9 + oz + 0.22], MAT.TRIM);
          m.box([tx + ox - 0.22, 0.46, z + 1.9 + oz + 0.1], [tx + ox + 0.22, 0.95, z + 1.9 + oz + 0.22], MAT.TRIM);
        }
      }
    });
    frontage(m, -x, x, z + 3.6, 31, { planters: 3, bollards: 5, depth: 1.8 });
    railing(m, -x, x, z + 3.5, 0.16, 0.9, 1.1);
    for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
      windowGrid(m, { axis: 'x', sign, plane }, -z + 1.0, z - 1.0,
        { floors: 1, floorH: 3, base: 1.4, count: 2, width: 1.2, height: 1.7 });
    }
    windowGrid(m, { axis: 'z', sign: -1, plane: -z }, -x + 1.0, x - 1.0,
      { floors: 1, floorH: 3, base: 1.4, count: 2, width: 1.2, height: 1.5 });
  }
  return m;
}

// ---------------------------------------------------------------- strip mall

function stripMall(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 28.0, d = 12.0;
  const x = w / 2, z = d / 2;
  const h = 5.2;
  const units = 4;

  m.box([-x, 0, -z], [x, h, z], MAT.CONCRETE, { roof: MAT.ROOF });

  if (medium) {
    parapet(m, -x, -z, x, z, h, 1.1, 0.25);
    roofClutter(m, -x + 1.5, -z + 1.5, x - 1.5, z - 1.5, h, 41, 1.2);
    // Colonnade along the front, which is what a strip mall is.
    m.box([-x, 3.6, z], [x, 4.1, z + 3.0], MAT.CONCRETE);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= units; i++) {
        const px = -x + (i / units) * w;
        m.box([px - 0.18, 0, z + 2.5], [px + 0.18, 3.6, z + 2.86], MAT.TRIM);
      }
    });
    kerb(m, -x, z + 3.0, x, z + 4.2);
  }
  if (fine) {
    // Each unit gets its own frontage. The fascia is one colour per building
    // for now; per-unit brands need per-instance tint, which arrives with the
    // pack format.
    for (let i = 0; i < units; i++) {
      const a = -x + (i / units) * w + 0.5;
      const b = -x + ((i + 1) / units) * w - 0.5;
      shopfront(m, { axis: 'z', sign: 1, plane: z }, a, b,
        { bays: 3, doorBay: i % 3, head: 3.4, fascia: 1.0 });
      fasciaSign(m, { axis: 'z', sign: 1, plane: z }, a + 1.0, b - 1.0, 3.05, 3.75);
      if (i % 2 === 0) awning(m, { axis: 'z', sign: 1, plane: z }, a + 0.3, b - 0.3, 4.4, 1.4);
    }
    // Service doors round the back.
    for (let i = 0; i < units; i++) {
      const u = -x + ((i + 0.5) / units) * w;
      m.opening({ axis: 'z', sign: -1, plane: -z, u0: u - 0.55, u1: u + 0.55, y0: 0.1, y1: 2.3,
        glass: MAT.TRIM, frame: 0.1, proud: 0.07 });
    }
  }
  return m;
}

// --------------------------------------------------------------- supermarket

function supermarket(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 30.0, d = 20.0;
  const x = w / 2, z = d / 2;
  const h = 8.0;

  m.box([-x, 0, -z], [x, h, z], MAT.CONCRETE, { roof: MAT.ROOF });

  if (medium) {
    parapet(m, -x, -z, x, z, h, 1.4, 0.3);
    // A raised brand band over the entrance, so the box has a front.
    m.painted(TINT.BRAND, () => m.box([-8.5, h, z - 0.4], [8.5, h + 2.6, z + 0.4], MAT.TRIM));
    roofClutter(m, -x + 2, -z + 2, x - 2, z - 2, h, 51, 1.6);
    // Entrance canopy.
    m.box([-9.0, 4.6, z], [9.0, 5.2, z + 4.5], MAT.CONCRETE);
    m.painted(TINT.METAL_DARK, () => {
      for (const px of [-8.2, -2.8, 2.8, 8.2]) {
        m.box([px - 0.2, 0, z + 4.0], [px + 0.2, 4.6, z + 4.4], MAT.TRIM);
      }
    });
    kerb(m, -x, z + 4.5, x, z + 6.0);
  }
  if (fine) {
    // Full-height entrance glazing, then blank wall either side -- exactly how
    // these are built, and the contrast is what makes the entrance read.
    m.windowRow({ axis: 'z', sign: 1, plane: z, from: -8.0, to: 8.0, y0: 0.5, y1: 4.4,
      count: 6, width: 2.3, glass: MAT.SHOPFRONT, frame: 0.11, proud: 0.08 });
    fasciaSign(m, { axis: 'z', sign: 1, plane: z }, -6.5, 6.5, h + 0.6, h + 2.1);
    boxSign(m, { axis: 'x', sign: 1, plane: x }, -3.0, 3.0, 5.4, 6.8);
    // Trolley bay.
    m.painted(TINT.METAL_DARK, () => {
      m.box([x - 7.0, 0, z + 5.0], [x - 2.0, 2.4, z + 5.2], MAT.TRIM);
      m.box([x - 7.0, 2.2, z + 5.0], [x - 2.0, 2.4, z + 7.4], MAT.TRIM);
      m.box([x - 7.0, 0, z + 7.2], [x - 2.0, 2.4, z + 7.4], MAT.TRIM);
    });
    // Goods-in dock at the back.
    m.box([-x + 2.0, 0, -z - 2.4], [-x + 12.0, 1.2, -z], MAT.CONCRETE);
    for (let i = 0; i < 2; i++) {
      const u = -x + 4.0 + i * 5.0;
      m.painted(TINT.METAL_DARK, () =>
        m.box([u - 1.8, 1.2, -z - 0.14], [u + 1.8, 5.0, -z + 0.02], MAT.TRIM));
    }
    frontage(m, -x, x, z + 6.0, 51, { planters: 4, bollards: 9, depth: 2.4 });
    // Parking bays marked out on the forecourt.
    for (let i = 0; i < 10; i++) {
      const px = -x + 1.5 + i * 2.9;
      m.box([px - 0.06, 0.002, z + 9.0], [px + 0.06, 0.02, z + 13.5], MAT.TRIM);
    }
    // Side elevation gets openings too, so the box is not blank on three sides.
    for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
      windowGrid(m, { axis: 'x', sign, plane }, -z + 2.0, z - 2.0,
        { floors: 1, floorH: 3, base: 5.4, count: 4, width: 1.4, height: 1.2 });
    }
  }
  return m;
}

// ------------------------------------------------------------- office block

function officeBlock(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 15.0, d = 14.0;
  const x = w / 2, z = d / 2;
  const ground = 5.0;
  const floors = 7, floorH = 3.6;
  const top = ground + floors * floorH;

  m.box([-x + 0.5, 0, -z + 0.5], [x - 0.5, ground, z - 0.5], MAT.SHOPFRONT, { roof: MAT.TRIM });
  m.box([-x, ground, -z], [x, top, z], MAT.GLASS, { roof: MAT.ROOF });

  if (medium) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        m.box([sx * x - sx * 0.55, 0, sz * z - sz * 0.55], [sx * x, ground, sz * z], MAT.CONCRETE);
      }
    }
    m.box([-x - 0.9, ground - 0.7, -z - 0.9], [x + 0.9, ground - 0.42, z + 0.9], MAT.CONCRETE);
    for (let f = 1; f <= floors; f++) {
      band(m, -x, -z, x, z, ground + f * floorH - 0.5, 0.5, 0.14);
    }
    band(m, -x, -z, x, z, top, 1.4, 0.45);
    roofClutter(m, -x + 2, -z + 2, x - 2, z - 2, top + 1.4, 61, 1.3);
  }
  if (fine) {
    for (const [axis, sign, plane, half] of [
      ['z', 1, z, x], ['z', -1, -z, x], ['x', 1, x, z], ['x', -1, -x, z],
    ] as const) {
      for (let f = 0; f < floors; f++) {
        const y0 = ground + f * floorH + 0.35;
        m.windowRow({ axis, sign, plane, from: -half + 0.6, to: half - 0.6,
          y0, y1: y0 + floorH - 1.05, count: 2, width: half * 0.85, glass: MAT.GLASS, frame: 0.07, proud: 0.05 });
      }
    }
    shopfront(m, { axis: 'z', sign: 1, plane: z - 0.5 }, -x + 1.4, x - 1.4,
      { bays: 4, doorBay: 1, head: 4.2, brandFascia: false });
    boxSign(m, { axis: 'z', sign: 1, plane: z }, -2.4, 2.4, ground + 0.4, ground + 1.4);
    bollards(m, { axis: 'z', sign: 1, plane: z }, -x + 1, x - 1, 1.8, 6);
  }
  return m;
}

// ---------------------------------------------------------------- boutique

function boutique(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 9.0, d = 12.5;
  const x = w / 2, z = d / 2;
  const ground = 4.4, floors = 3, floorH = 3.3;
  const top = ground + floors * floorH;

  m.box([-x, 0, -z], [x, top, z], MAT.BRICK, { roof: MAT.ROOF });

  if (medium) {
    // Heavy cornice and a string course per floor: a narrow old commercial
    // building is all horizontal lines.
    band(m, -x, -z, x, z, top - 0.55, 0.55, 0.42);
    parapet(m, -x, -z, x, z, top, 1.2, 0.24);
    for (let f = 1; f < floors; f++) {
      band(m, -x, -z, x, z, ground + f * floorH - 0.28, 0.28, 0.16);
    }
    band(m, -x, -z, x, z, ground - 0.2, 0.45, 0.22);
    roofClutter(m, -x + 0.8, -z + 0.8, x - 0.8, z - 0.8, top, 71, 0.7);
  }
  if (fine) {
    shopfront(m, { axis: 'z', sign: 1, plane: z }, -x + 0.5, x - 0.5, { bays: 2, doorBay: 1, head: 3.7 });
    awning(m, { axis: 'z', sign: 1, plane: z }, -x + 0.6, 0.6, 3.6, 1.5);
    bladeSign(m, { axis: 'z', sign: 1, plane: z }, x - 1.3, 4.7, 6.4, 1.2);
    // Bay windows stacked up the front, with their own little roofs.
    for (let f = 0; f < floors; f++) {
      const y = ground + f * floorH + 0.5;
      m.box([-2.4, y, z], [2.4, y + 2.2, z + 0.6], MAT.BRICK);
      m.box([-2.6, y + 2.2, z], [2.6, y + 2.45, z + 0.75], MAT.TRIM);
      m.opening({ axis: 'z', sign: 1, plane: z + 0.6, u0: -2.1, u1: 2.1, y0: y + 0.35, y1: y + 1.95,
        glass: MAT.GLASS, frame: 0.09, proud: 0.06 });
    }
    windowGrid(m, { axis: 'x', sign: 1, plane: x }, -z + 1.0, z - 1.0,
      { floors, floorH, base: ground + 0.8, count: 3, width: 1.1, height: 1.9 });
    fireEscape(m, { axis: 'x', sign: -1, plane: -x }, -2.4, ground + 0.4, floors, floorH, 3.0);
  }
  return m;
}

// -------------------------------------------------------------------- table

export const COMMERCIAL: AssetDef[] = [
  {
    id: 'com.corner_shop', name: 'Corner shop', zone: 'commercial', density: 'low',
    variant: 'sculpted', footprint: [2, 2], height: 11.7, brand: BRANDS.grocer,
    sim: { jobs: 12, powerKW: 34, waterM3: 3, garbagePerWeek: 70, pollution: 1, upkeep: 26 },
    note: 'Two-storey brick shop with flats over, wrapping shopfront, awning and blade sign.',
    build: cornerShop,
  },
  {
    id: 'com.diner', name: 'Roadside diner', zone: 'commercial', density: 'low',
    variant: 'sculpted', footprint: [3, 3], height: 8.5, brand: BRANDS.diner,
    sim: { jobs: 16, powerKW: 52, waterM3: 8, garbagePerWeek: 140, pollution: 2, upkeep: 34 },
    note: 'Low glazed box under deep brand eaves, entrance porch, pylon sign by the kerb.',
    build: diner,
  },
  {
    id: 'com.drivethru', name: 'Drive-through', zone: 'commercial', density: 'low',
    variant: 'sculpted', footprint: [3, 2], height: 9.5, brand: BRANDS.burger,
    sim: { jobs: 22, powerKW: 68, waterM3: 10, garbagePerWeek: 210, pollution: 3, upkeep: 40 },
    note: 'Brand band, wrapped lane under a canopy, order window, menu board and pylon.',
    build: driveThru,
  },
  {
    id: 'com.coffee', name: 'Coffee bar', zone: 'commercial', density: 'low',
    variant: 'sculpted', footprint: [2, 3], height: 4.7, brand: BRANDS.coffee,
    sim: { jobs: 8, powerKW: 26, waterM3: 4, garbagePerWeek: 60, pollution: 1, upkeep: 18 },
    note: 'Single storey with a terrace: tables, planters, awning and a hanging sign.',
    build: coffeeBar,
  },
  {
    id: 'com.strip', name: 'Strip of units', zone: 'commercial', density: 'medium',
    variant: 'sculpted', footprint: [4, 3], height: 6.3, brand: BRANDS.hardware,
    sim: { jobs: 34, powerKW: 96, waterM3: 9, garbagePerWeek: 260, pollution: 2, upkeep: 62 },
    note: 'Four units under one roof behind a colonnade, each with its own fascia and door.',
    build: stripMall,
  },
  {
    id: 'com.supermarket', name: 'Supermarket', zone: 'commercial', density: 'medium',
    variant: 'sculpted', footprint: [5, 6], height: 10.6, brand: BRANDS.supermarket,
    sim: { jobs: 70, powerKW: 240, waterM3: 26, garbagePerWeek: 700, pollution: 4, upkeep: 130 },
    note: 'Big box done properly: raised brand band, entrance canopy, trolley bay, goods-in dock.',
    build: supermarket,
  },
  {
    id: 'off.retailbase', name: 'Offices over retail', zone: 'office', density: 'high',
    variant: 'sculpted', footprint: [2, 3], height: 32.6, brand: BRANDS.insurer,
    sim: { jobs: 180, powerKW: 320, waterM3: 30, garbagePerWeek: 620, pollution: 2, upkeep: 210 },
    note: 'Curtain wall on a recessed retail base, spandrel band per floor, cornice, roof plant.',
    build: officeBlock,
  },
  {
    id: 'com.boutique', name: 'Boutique block', zone: 'commercial', density: 'medium',
    variant: 'sculpted', footprint: [2, 2], height: 15.6, brand: BRANDS.clothes,
    sim: { jobs: 20, powerKW: 48, waterM3: 5, garbagePerWeek: 110, pollution: 1, upkeep: 44 },
    note: 'Narrow three-storey with stacked bay windows, heavy cornice and a fire escape.',
    build: boutique,
  },
];

// ------------------------------------------------------------- gas station

function gasStation(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  // Kiosk at the back, forecourt in front. The canopy is the building.
  const kw = 11.0, kd = 7.0, kh = 4.2;
  const kz = -8.0;
  const x = kw / 2;

  m.box([-x, 0, kz - kd / 2], [x, kh, kz + kd / 2], MAT.PLASTER, { roof: MAT.ROOF });

  if (medium) {
    m.painted(TINT.BRAND, () => ring(m, -x, kz - kd / 2, x, kz + kd / 2, kh - 0.9, 1.2, 0.3));
    roofClutter(m, -x + 1, kz - kd / 2 + 1, x - 1, kz + kd / 2 - 1, kh + 0.3, 81, 0.6);

    // Forecourt canopy: the silhouette of the type. Deck, fascia, four columns.
    const cw = 15.0, cd = 10.0, ch = 5.6;
    m.box([-cw / 2, ch, -cd / 2 + 2.0], [cw / 2, ch + 0.5, cd / 2 + 2.0], MAT.CONCRETE);
    m.painted(TINT.BRAND, () => ring(m, -cw / 2, -cd / 2 + 2.0, cw / 2, cd / 2 + 2.0, ch + 0.5, 0.85, 0.22));
    m.painted(TINT.METAL_DARK, () => {
      for (const px of [-cw / 2 + 1.6, cw / 2 - 1.6]) {
        for (const pz of [-cd / 2 + 3.4, cd / 2 + 0.6]) {
          m.box([px - 0.3, 0, pz - 0.3], [px + 0.3, ch, pz + 0.3], MAT.TRIM);
        }
      }
    });
    // Pump islands under it.
    for (const px of [-3.4, 3.4]) {
      m.box([px - 1.6, 0.0001, -1.2], [px + 1.6, 0.18, 3.6], MAT.CONCRETE);
      for (const pz of [0.0, 2.4]) {
        m.box([px - 0.42, 0.18, pz - 0.34], [px + 0.42, 1.75, pz + 0.34], MAT.PLASTER);
        m.painted(TINT.BRAND, () =>
          m.box([px - 0.46, 1.5, pz - 0.38], [px + 0.46, 1.78, pz + 0.38], MAT.TRIM));
        m.painted(TINT.METAL_DARK, () =>
          m.box([px - 0.5, 0.9, pz - 0.4], [px - 0.42, 1.4, pz + 0.4], MAT.TRIM));
      }
    }
    pylonSign(m, -x - 2.6, 6.0, 9.0, 2.4);
  }
  if (fine) {
    shopfront(m, { axis: 'z', sign: 1, plane: kz + kd / 2 }, -x + 0.6, x - 0.6,
      { bays: 3, doorBay: 1, head: 3.2 });
    fasciaSign(m, { axis: 'z', sign: 1, plane: kz + kd / 2 }, -3.2, 3.2, kh - 0.75, kh - 0.05);
    boxSign(m, { axis: 'z', sign: 1, plane: 12.0 }, -4.0, 4.0, 6.4, 7.4);
    bollards(m, { axis: 'z', sign: 1, plane: kz + kd / 2 }, -x, x, 1.2, 5);
    // Air-and-water point, and a bin.
    m.painted(TINT.BRAND, () => m.box([x - 1.4, 0, kz + 5.0], [x - 0.6, 1.3, kz + 5.8], MAT.TRIM));
    frontage(m, -x, x, kz + kd / 2 + 1.0, 81, { planters: 2, bollards: 4, depth: 1.8 });
    windowGrid(m, { axis: 'x', sign: 1, plane: x }, kz - kd / 2 + 1.0, kz + kd / 2 - 1.0,
      { floors: 1, floorH: 3, base: 1.6, count: 2, width: 1.1, height: 1.5 });
    windowGrid(m, { axis: 'x', sign: -1, plane: -x }, kz - kd / 2 + 1.0, kz + kd / 2 - 1.0,
      { floors: 1, floorH: 3, base: 1.6, count: 2, width: 1.1, height: 1.5 });
    // Air line, a bin and a stack of screenwash by the kiosk door.
    m.painted(TINT.METAL_DARK, () => {
      m.box([-x + 0.6, 0, kz + 5.0], [-x + 1.4, 1.1, kz + 5.8], MAT.TRIM);
      for (let i = 0; i < 3; i++) {
        m.box([-x + 2.0, i * 0.42, kz + 4.6], [-x + 3.4, 0.4 + i * 0.42, kz + 5.6], MAT.TRIM);
      }
    });
  }
  return m;
}

// ---------------------------------------------------------------- pharmacy

function pharmacy(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 16.0, d = 12.0;
  const x = w / 2, z = d / 2;
  const h = 5.4;

  m.box([-x, 0, -z], [x, h, z], MAT.PLASTER, { roof: MAT.ROOF });
  // A rendered pilaster at each end, which is how these single-storey units
  // get a front instead of being a rectangle of glass.
  for (const sx of [-1, 1]) {
    m.box([sx * x - sx * 1.2, 0, z - 0.35], [sx * x, h + 0.6, z + 0.45], MAT.CONCRETE);
  }

  if (medium) {
    parapet(m, -x, -z, x, z, h, 1.1, 0.26);
    m.painted(TINT.BRAND, () => m.box([-x + 1.2, h, z - 0.2], [x - 1.2, h + 1.5, z + 0.5], MAT.TRIM));
    roofClutter(m, -x + 1.5, -z + 1.5, x - 1.5, z - 1.5, h, 91, 1.0);
    // Canopy over the door.
    m.box([-3.4, 3.9, z], [3.4, 4.3, z + 2.2], MAT.CONCRETE);
  }
  if (fine) {
    shopfront(m, { axis: 'z', sign: 1, plane: z }, -x + 1.4, x - 1.4,
      { bays: 5, doorBay: 2, head: 3.8 });
    fasciaSign(m, { axis: 'z', sign: 1, plane: z + 0.45 }, -5.0, 5.0, h + 0.25, h + 1.25);
    // The cross. One shape, and everyone knows what the shop is.
    m.painted(TINT.SIGN_LIT, () => {
      m.box([x - 3.4, 3.0, z + 0.5], [x - 1.6, 3.6, z + 0.62], MAT.TRIM);
      m.box([x - 2.85, 2.45, z + 0.5], [x - 2.15, 4.15, z + 0.62], MAT.TRIM);
    });
    windowGrid(m, { axis: 'x', sign: 1, plane: x }, -z + 1.2, z - 1.2,
      { floors: 1, floorH: 3, base: 2.2, count: 3, width: 1.1, height: 1.5 });
    bollards(m, { axis: 'z', sign: 1, plane: z }, -x + 1, x - 1, 1.7, 7);
    frontage(m, -x, x, z + 0.5, 91, { planters: 3, bollards: 7, depth: 2.4 });
    windowGrid(m, { axis: 'x', sign: -1, plane: -x }, -z + 1.2, z - 1.2,
      { floors: 1, floorH: 3, base: 2.2, count: 3, width: 1.1, height: 1.5 });
    windowGrid(m, { axis: 'z', sign: -1, plane: -z }, -x + 1.5, x - 1.5,
      { floors: 1, floorH: 3, base: 2.2, count: 4, width: 1.1, height: 1.5 });
    railing(m, -x + 0.5, x - 0.5, z + 2.6, 0, 0.95, 1.3);
  }
  return m;
}

COMMERCIAL.push(
  {
    id: 'com.gas', name: 'Filling station', zone: 'commercial', density: 'low',
    variant: 'sculpted', footprint: [3, 3], height: 9.0, brand: BRANDS.motors,
    sim: { jobs: 10, powerKW: 60, waterM3: 3, garbagePerWeek: 90, pollution: 9, upkeep: 44 },
    note: 'Forecourt canopy on columns, two pump islands, kiosk with shopfront, pylon by the road.',
    build: gasStation,
  },
  {
    id: 'com.pharmacy', name: 'Pharmacy', zone: 'commercial', density: 'low',
    variant: 'sculpted', footprint: [3, 3], height: 6.9, brand: BRANDS.pharmacy,
    sim: { jobs: 14, powerKW: 40, waterM3: 4, garbagePerWeek: 80, pollution: 1, upkeep: 30 },
    note: 'Single-storey unit between rendered pilasters, entrance canopy, lit cross.',
    build: pharmacy,
  },
);

// --------------------------------------------------------------- bank branch

/**
 * A high-street bank: masonry, a columned entrance and small deep windows.
 * Retail is mostly glass, so the category needs one building that reads as
 * solid or every commercial street looks like the same shopfront repeated.
 */
function bankBranch(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 15.0, d = 12.0;
  const x = w / 2, z = d / 2;
  const ground = 4.6, upper = 3.6;
  const h = ground + upper * 2;

  m.box([-x, 0, -z], [x, h, z], MAT.PLASTER, { roof: MAT.ROOF });
  // Rusticated stone base, stopping short of the corners.
  m.box([-x - 0.25, 0, -z - 0.25], [x + 0.25, ground, z + 0.25], MAT.STONE);

  if (medium) {
    parapet(m, -x, -z, x, z, h, 1.4, 0.4);
    band(m, -x, -z, x, z, ground, 0.5, 0.35);
    band(m, -x, -z, x, z, h - 1.5, 0.45, 0.3);
    // Portico: an entablature carried on columns, so it has to be a beam and
    // a pediment -- not the solid block this was, which just walled off the
    // door it was supposed to shelter.
    m.box([-3.6, ground + 0.4, z + 0.25], [3.6, ground + 1.0, z + 2.7], MAT.STONE, { roof: MAT.TRIM });
    m.box([-3.9, ground + 1.0, z + 0.25], [3.9, ground + 1.35, z + 2.9], MAT.STONE, { roof: MAT.TRIM });
    m.gable([-3.9, ground + 1.35, z + 0.25], [3.9, ground + 1.35, z + 2.9], 1.1, 'z',
      MAT.ROOF_TILE, MAT.STONE);
    roofClutter(m, -x + 2, -z + 2, x - 2, z - 2, h, 401, 0.6);
  }
  if (fine) {
    for (const cx of [-2.9, -1.0, 1.0, 2.9]) {
      m.cylinder(cx, z + 1.7, 0.34, 0, ground + 0.4, 8, MAT.STONE);
      m.box([cx - 0.45, ground + 0.4, z + 1.25], [cx + 0.45, ground + 0.9, z + 2.15], MAT.STONE);
    }
    entrance(m, { axis: 'z', sign: 1, plane: z + 0.25 }, 0, {
      width: 2.2, height: 2.9, double: true, fanlight: true, steps: 3,
    });
    // Deep-set windows either side of the portico, then two upper floors.
    for (const u of [[-x + 1.2, -4.2], [4.2, x - 1.2]] as const) {
      m.windowRow({ axis: 'z', sign: 1, plane: z + 0.25, from: u[0], to: u[1], y0: 1.5, y1: 3.9,
        count: 2, width: 1.5, glass: MAT.GLASS, frame: 0.14, proud: 0.05 });
    }
    for (const [axis, sign, plane, u0, u1, n] of [
      ['z', 1, z, -x + 1.0, x - 1.0, 5],
      ['z', -1, -z, -x + 1.0, x - 1.0, 5],
      ['x', 1, x, -z + 1.0, z - 1.0, 4],
      ['x', -1, -x, -z + 1.0, z - 1.0, 4],
    ] as const) {
      windowGrid(m, { axis, sign, plane }, u0, u1,
        { floors: 2, floorH: upper, base: ground + 0.9, count: n, width: 1.3, height: 2.2 });
    }
    boxSign(m, { axis: 'z', sign: 1, plane: z + 0.25 }, -3.2, 3.2, ground + 1.1, ground + 2.3);
    frontage(m, -x, x, z + 2.5, 403, { planters: 2, bollards: 6, depth: 2.4 });
  }
  return m;
}

// ---------------------------------------------------------------------- gym

/** A leisure box: blank clad walls up high, glazed and busy at street level. */
function gym(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 20.0, d = 15.0;
  const x = w / 2, z = d / 2;
  const h = 9.4;

  m.box([-x, 0, -z], [x, h, z], MAT.CLADDING, { roof: MAT.ROOF });
  // Brand-coloured blade wall running up one end, the usual gym signature.
  m.painted(TINT.ACCENT, () => m.box([x - 2.2, 0, -z - 0.3], [x + 0.3, h + 1.8, z + 0.3], MAT.TRIM));

  if (medium) {
    parapet(m, -x, -z, x, z, h, 1.0, 0.28);
    // Horizontal cladding joints: what stops a big blank wall reading as card.
    for (const y of [3.0, 5.4, 7.8]) band(m, -x, -z, x, z, y, 0.14, 0.1, MAT.CLADDING);
    m.box([-x, 4.6, z], [x - 3.2, 5.2, z + 1.6], MAT.CONCRETE);
    roofClutter(m, -x + 2, -z + 2, x - 2, z - 2, h, 411, 1.4);
  }
  if (fine) {
    // Double-height glazing to the street: treadmills in the window.
    m.windowRow({ axis: 'z', sign: 1, plane: z, from: -x + 0.8, to: x - 3.6, y0: 0.7, y1: 4.5,
      count: 5, width: 2.6, glass: MAT.SHOPFRONT, frame: 0.12, proud: 0.07 });
    m.windowRow({ axis: 'z', sign: 1, plane: z, from: -x + 0.8, to: x - 3.6, y0: 5.4, y1: 8.4,
      count: 5, width: 2.6, glass: MAT.GLASS, frame: 0.1, proud: 0.06 });
    windowGrid(m, { axis: 'x', sign: -1, plane: -x }, -z + 1.2, z - 1.2,
      { floors: 2, floorH: 3.6, base: 1.4, count: 4, width: 1.4, height: 2.4, sill: false });
    entrance(m, { axis: 'z', sign: 1, plane: z }, -x + 4.0, { width: 2.4, height: 2.9, double: true, canopy: 1.8 });
    fasciaSign(m, { axis: 'z', sign: 1, plane: z }, x - 12.0, x - 4.0, 6.2, 7.4);
    bladeSign(m, { axis: 'x', sign: 1, plane: x + 0.3 }, 2.0, 5.0, 8.4, 1.5);
    frontage(m, -x, x, z, 413, { planters: 2, bollards: 8 });
  }
  return m;
}

// -------------------------------------------------------------- market hall

/**
 * Covered market: a brick hall under a pitched roof, tall arched openings
 * down the front, and stalls with striped canopies out on the pavement.
 */
function marketHall(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 24.0, d = 16.0;
  const x = w / 2, z = d / 2;
  const eave = 6.4;
  const bays = 5;

  m.box([-x, 0, -z], [x, eave, z], MAT.BRICK);
  m.gable([-x, eave, -z], [x, eave, z], 3.8, 'x', MAT.ROOF, MAT.BRICK);
  // Stone plinth: markets are old buildings and old buildings have a base.
  m.box([-x - 0.25, 0, -z - 0.25], [x + 0.25, 1.1, z + 0.25], MAT.CONCRETE);

  if (medium) {
    band(m, -x, -z, x, z, eave - 0.7, 0.5, 0.32);
    // Piers between the openings, carried a little above the eaves band.
    for (let i = 0; i <= bays; i++) {
      const px = -x + (i / bays) * w;
      for (const sz of [-1, 1] as const) {
        m.box([px - 0.55, 0, sz * z - 0.35], [px + 0.55, eave - 0.05, sz * z + 0.35], MAT.CONCRETE);
      }
    }
    // Corner pilasters only -- a full-width slab here buries the brick gable.
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        m.box([sx * x - sx * 0.6, 0, sz * z - sz * 0.6], [sx * x + sx * 0.3, eave + 0.25, sz * z + sz * 0.3],
          MAT.CONCRETE);
      }
      m.box([sx * x - sx * 0.25, 0, -z + 0.6], [sx * x + sx * 0.25, eave + 0.1, z - 0.6], MAT.CONCRETE);
    }
    roofClutter(m, -x + 3, -z + 4.5, x - 3, z - 4.5, eave + 2.6, 421, 0.4);
  }
  if (fine) {
    // Tall openings between the piers: glazed at the top, market doors below.
    for (const sz of [1, -1] as const) {
      const plane = sz * z;
      for (let i = 0; i < bays; i++) {
        const a = -x + (i / bays) * w + 0.75;
        const b = -x + ((i + 1) / bays) * w - 0.75;
        m.opening({ axis: 'z', sign: sz, plane, u0: a, u1: b, y0: 1.4, y1: 4.0,
          glass: MAT.SHOPFRONT, frame: 0.12, proud: 0.07 });
        m.opening({ axis: 'z', sign: sz, plane, u0: a + 0.3, u1: b - 0.3, y0: 4.5, y1: eave - 0.9,
          glass: MAT.GLASS, frame: 0.1, proud: 0.06 });
      }
    }
    // Gable-end roundel windows, the detail that makes it read as a hall.
    for (const sx of [-1, 1] as const) {
      windowGrid(m, { axis: 'x', sign: sx, plane: sx * x }, -z + 1.4, z - 1.4,
        { floors: 1, floorH: 3, base: 1.8, count: 3, width: 1.6, height: 2.6 });
      m.opening({ axis: 'x', sign: sx, plane: sx * x, u0: -1.4, u1: 1.4, y0: eave + 0.7, y1: eave + 2.4,
        glass: MAT.GLASS, frame: 0.14, proud: 0.06 });
    }
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0, { width: 3.2, height: 3.6, double: true, canopy: 2.2, steps: 2 });
    fasciaSign(m, { axis: 'z', sign: 1, plane: z }, -5.0, 5.0, eave - 2.2, eave - 1.0);
    // Stalls on the pavement, striped canopies over trestle tables.
    for (let i = 0; i < 4; i++) {
      const cx = -x + 3.0 + i * 5.4;
      const sz = z + 3.4;
      m.painted(TINT.AWNING, () => m.box([cx - 1.6, 2.4, sz - 1.3], [cx + 1.6, 2.62, sz + 1.3], MAT.TRIM));
      for (const px of [cx - 1.45, cx + 1.45]) {
        for (const pz of [sz - 1.15, sz + 1.15]) {
          m.box([px - 0.05, 0, pz - 0.05], [px + 0.05, 2.4, pz + 0.05], MAT.METAL);
        }
      }
      m.painted(TINT.WOOD, () => m.box([cx - 1.5, 0.85, sz - 0.5], [cx + 1.5, 0.95, sz + 0.7], MAT.TRIM));
      m.box([cx - 1.4, 0, sz - 0.45], [cx + 1.4, 0.85, sz + 0.6], MAT.TRIM);
    }
    frontage(m, -x, x, z + 4.8, 423, { planters: 2, bollards: 9, depth: 2.2 });
  }
  return m;
}

COMMERCIAL.push(
  {
    id: 'com.bank', name: 'Bank branch', zone: 'commercial', density: 'medium',
    variant: 'sculpted', footprint: [2, 3], height: 11.8, brand: BRANDS.bank,
    sim: { jobs: 22, powerKW: 55, waterM3: 5, garbagePerWeek: 70, pollution: 1, upkeep: 52 },
    note: 'Stone base, columned portico over the door, small deep windows on two upper floors.',
    build: bankBranch,
  },
  {
    id: 'com.gym', name: 'Gym', zone: 'commercial', density: 'medium',
    variant: 'sculpted', footprint: [3, 3], height: 11.2, brand: BRANDS.gym,
    sim: { jobs: 18, powerKW: 95, waterM3: 22, garbagePerWeek: 110, pollution: 2, upkeep: 46 },
    note: 'Clad box with a brand blade wall, double-height glazing to the street.',
    build: gym,
  },
  {
    id: 'com.market', name: 'Market hall', zone: 'commercial', density: 'medium',
    variant: 'sculpted', footprint: [3, 4], height: 9.4, brand: BRANDS.butcher,
    sim: { jobs: 40, powerKW: 70, waterM3: 18, garbagePerWeek: 260, pollution: 3, upkeep: 58 },
    note: 'Brick hall under a pitched roof, tall arched openings between piers, stalls out on the pavement.',
    build: marketHall,
  },
);

// ------------------------------------------------------------------ cinema

/**
 * A cinema: a blank auditorium box behind a tall glazed foyer with a canopy
 * and a poster wall. Almost all of the type's character is in the front three
 * metres, which is exactly where a city builder's camera spends its time.
 */
function cinema(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 26.0, d = 22.0;
  const x = w / 2, z = d / 2;
  const hall = 13.0, foyer = 8.4, foyerD = 5.0;

  m.box([-x, 0, -z], [x, hall, z - foyerD], MAT.PLASTER, { roof: MAT.ROOF });
  m.box([-x + 1.0, 0, z - foyerD], [x - 1.0, foyer, z], MAT.CLADDING, { roof: MAT.ROOF });

  if (medium) {
    parapet(m, -x, -z, x, z - foyerD, hall, 1.4, 0.35);
    parapet(m, -x + 1.0, z - foyerD, x - 1.0, z, foyer, 1.0, 0.3);
    // Fly-tower fin over the middle of the auditorium.
    m.box([-4.0, hall, -z + 4.0], [4.0, hall + 3.2, z - foyerD - 4.0], MAT.PLASTER, { roof: MAT.ROOF });
    // Marquee canopy: deep, lit underneath, the single thing that says cinema.
    m.painted(TINT.BRAND, () => {
      m.box([-x + 0.6, foyer - 2.6, z], [x - 0.6, foyer - 1.9, z + 3.2], MAT.TRIM);
    });
    m.painted(TINT.SIGN_LIT, () => {
      m.box([-x + 0.8, foyer - 2.75, z + 0.2], [x - 0.8, foyer - 2.6, z + 3.0], MAT.TRIM);
    });
    roofClutter(m, -x + 2, -z + 2, -4.6, z - foyerD - 2, hall, 701, 0.7);
  }
  if (fine) {
    // Full-height glazed foyer.
    for (let f = 0; f < 2; f++) {
      m.windowRow({ axis: 'z', sign: 1, plane: z, from: -x + 2.0, to: -2.6,
        y0: 0.7 + f * 3.5, y1: 3.4 + f * 3.5, count: 3, width: 2.4,
        glass: f === 0 ? MAT.SHOPFRONT : MAT.GLASS, frame: 0.1, proud: 0.06 });
      m.windowRow({ axis: 'z', sign: 1, plane: z, from: 2.6, to: x - 2.0,
        y0: 0.7 + f * 3.5, y1: 3.4 + f * 3.5, count: 3, width: 2.4,
        glass: f === 0 ? MAT.SHOPFRONT : MAT.GLASS, frame: 0.1, proud: 0.06 });
    }
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0,
      { width: 3.4, height: 3.0, double: true, glazed: true });
    fasciaSign(m, { axis: 'z', sign: 1, plane: z }, -6.0, 6.0, foyer - 1.7, foyer - 0.4);
    // Poster cases either side of the doors, and a vertical blade up the flank.
    for (const px of [-4.6, 4.6]) {
      m.painted(TINT.BRAND_DARK, () => {
        m.box([px - 0.9, 1.0, z + 0.02], [px + 0.9, 3.4, z + 0.16], MAT.TRIM);
      });
      m.opening({ axis: 'z', sign: 1, plane: z + 0.16, u0: px - 0.75, u1: px + 0.75,
        y0: 1.15, y1: 3.25, glass: MAT.GLASS, frame: 0.07, proud: 0.05 });
    }
    bladeSign(m, { axis: 'x', sign: 1, plane: x }, z - 2.6, foyer - 0.5, hall + 2.4, 1.6);
    frontage(m, -x, x, z + 3.2, 703, { planters: 2, bollards: 9, depth: 2.6 });
  }
  return m;
}

// ------------------------------------------------------------------- hotel

/** A city hotel: glazed lobby under a porte-cochere, banded bedroom floors. */
function hotel(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 22.0, d = 15.0;
  const ground = 5.4;
  const floors = 8, floorH = 3.15;
  const top = ground + floors * floorH;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, ground, z], MAT.CONCRETE, { roof: MAT.TRIM });
  m.box([-x + 0.8, ground, -z + 0.6], [x - 0.8, top, z - 0.6], MAT.PLASTER, { roof: MAT.ROOF });

  if (medium) {
    band(m, -x, -z, x, z, ground, 0.8, 0.45);
    // Bedroom floors expressed as bands, with a recessed spandrel between.
    for (let f = 1; f <= floors; f++) {
      band(m, -x + 0.8, -z + 0.6, x - 0.8, z - 0.6, ground + f * floorH - 0.45, 0.45, 0.25);
    }
    parapet(m, -x + 0.8, -z + 0.6, x - 0.8, z - 0.6, top, 1.3, 0.34);
    // Porte-cochere: a canopy on two columns over the drop-off.
    m.box([-5.4, ground - 1.6, z], [5.4, ground - 1.0, z + 5.0], MAT.CONCRETE);
    m.painted(TINT.METAL_DARK, () => {
      for (const px of [-4.6, 4.6]) {
        m.box([px - 0.28, 0, z + 3.9], [px + 0.28, ground - 1.6, z + 4.5], MAT.TRIM);
      }
    });
    m.box([-x, 0.001, z], [x, 0.1, z + 5.6], MAT.CONCRETE);
    roofClutter(m, -x + 2, -z + 2, x - 2, z - 2, top, 711, 1.0);
  }
  if (fine) {
    for (const [axis, sign, plane, half, n] of [
      ['z', 1, z - 0.6, x - 0.8, 6], ['z', -1, -z + 0.6, x - 0.8, 6],
      ['x', 1, x - 0.8, z - 0.6, 4], ['x', -1, -x + 0.8, z - 0.6, 4],
    ] as const) {
      windowGrid(m, { axis, sign, plane }, -half + 1.0, half - 1.0,
        { floors, floorH, base: ground + 0.9, count: n, width: 1.6, height: 1.9, sill: false });
    }
    // Lobby glazing, broken for the revolving-door bay.
    for (const [from, to] of [[-x + 1.2, -2.4], [2.4, x - 1.2]] as const) {
      m.windowRow({ axis: 'z', sign: 1, plane: z, from, to, y0: 0.6, y1: 4.6,
        count: 3, width: 2.4, glass: MAT.SHOPFRONT, frame: 0.11, proud: 0.07 });
    }
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0,
      { width: 2.8, height: 3.2, double: true, glazed: true });
    boxSign(m, { axis: 'z', sign: 1, plane: z }, -3.6, 3.6, ground + 0.3, ground + 1.6);
    bladeSign(m, { axis: 'x', sign: -1, plane: -x }, 3.0, ground + 1.0, ground + 6.0, 1.4);
    for (const px of [-8.0, 8.0]) planter(m, px, z + 2.2, 0.9, 0.65);
    frontage(m, -x, x, z + 5.6, 713, { planters: 0, bollards: 8, depth: 2.2 });
  }
  return m;
}

COMMERCIAL.push(
  {
    id: 'com.cinema', name: 'Cinema', zone: 'commercial', density: 'medium',
    variant: 'sculpted', footprint: [4, 5], height: 16.2, brand: BRANDS.cinema,
    sim: { jobs: 26, powerKW: 130, waterM3: 12, garbagePerWeek: 220, pollution: 2, upkeep: 74 },
    note: 'Blank auditorium behind a two-storey glazed foyer, lit marquee canopy, poster cases.',
    build: cinema,
  },
  {
    id: 'com.hotel', name: 'Hotel', zone: 'commercial', density: 'high',
    variant: 'sculpted', footprint: [3, 4], height: 34.5, brand: BRANDS.hotel,
    sim: { jobs: 55, powerKW: 210, waterM3: 90, garbagePerWeek: 380, pollution: 2, upkeep: 130 },
    note: 'Banded bedroom floors over a glazed lobby, porte-cochere on columns, blade sign.',
    build: hotel,
  },
);

// ------------------------------------------------------------- garden centre

/** Glasshouse and a sales barn behind a yard of stock. */
function gardenCentre(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 17.0, z = 13.0;
  const barnW = 16.0, barnD = 11.0, barnH = 5.6;
  const bx = -x + barnW / 2 + 1.0, bz = -z + barnD / 2 + 1.0;

  m.box([bx - barnW / 2, 0, bz - barnD / 2], [bx + barnW / 2, barnH, bz + barnD / 2],
    MAT.TIMBER, { roof: MAT.TRIM });
  m.gable([bx - barnW / 2, barnH, bz - barnD / 2], [bx + barnW / 2, barnH, bz + barnD / 2],
    2.6, 'x', MAT.ROOF_TILE, MAT.TIMBER);

  if (medium) {
    eavesBand(m, bx - barnW / 2, bz - barnD / 2, bx + barnW / 2, bz + barnD / 2, barnH);
    // Glasshouse alongside: a ridge on posts, glazed to the ground.
    const gx0 = bx + barnW / 2 + 2.0;
    m.box([gx0, 0, bz - barnD / 2], [x - 0.5, 3.8, bz + barnD / 2], MAT.GLASS, { roof: MAT.TRIM });
    m.gable([gx0, 3.8, bz - barnD / 2], [x - 0.5, 3.8, bz + barnD / 2], 1.5, 'z', MAT.GLASS, MAT.GLASS);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 5; i++) {
        const pz = bz - barnD / 2 + (i / 5) * barnD;
        m.box([gx0 - 0.08, 0, pz - 0.08], [x - 0.42, 0.16, pz + 0.08], MAT.TRIM);
        m.box([gx0, 0, pz - 0.08], [gx0 + 0.16, 5.3, pz + 0.08], MAT.TRIM);
        m.box([x - 0.66, 0, pz - 0.08], [x - 0.5, 5.3, pz + 0.08], MAT.TRIM);
      }
    });
    roofClutter(m, bx - 5, bz - 3, bx + 5, bz + 3, barnH + 2.6, 731, 0.3);
  }
  if (fine) {
    shopfront(m, { axis: 'z', sign: 1, plane: bz + barnD / 2 }, bx - 6.5, bx + 6.5,
      { bays: 4, doorBay: 1, head: 3.6 });
    fasciaSign(m, { axis: 'z', sign: 1, plane: bz + barnD / 2 }, bx - 5.0, bx + 2.0, 3.0, 4.0);
    // Benches of stock in the yard: trays on trestles, in rows.
    for (let r = 0; r < 3; r++) {
      const rz = z - 9.0 + r * 3.0;
      for (let i = 0; i < 4; i++) {
        const cx = -x + 3.0 + i * 6.0;
        m.painted(TINT.METAL_DARK, () => {
          m.box([cx - 1.6, 0.72, rz - 0.7], [cx + 1.6, 0.8, rz + 0.7], MAT.TRIM);
          for (const px of [cx - 1.4, cx + 1.4]) {
            m.box([px - 0.05, 0, rz - 0.6], [px + 0.05, 0.72, rz - 0.5], MAT.TRIM);
            m.box([px - 0.05, 0, rz + 0.5], [px + 0.05, 0.72, rz + 0.6], MAT.TRIM);
          }
        });
        m.painted(TINT.GREEN, () => m.box([cx - 1.5, 0.8, rz - 0.62], [cx + 1.5, 1.25, rz + 0.62], MAT.TRIM));
      }
    }
    railing(m, -x, x, z, 0, 1.4, 1.8);
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

// ------------------------------------------------------------------- pub

/** A corner pub: brick, a hanging sign, a lantern and a paved terrace. */
function pub(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 14.0, d = 11.0;
  const ground = 4.2, upper = 3.2;
  const h = ground + upper;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], MAT.BRICK);
  m.gable([-x, h, -z], [x, h, z], 2.4, 'x', MAT.ROOF_TILE, MAT.BRICK);
  // Painted ground floor, which is what a pub actually looks like.
  m.painted(TINT.BRAND_DARK, () =>
    m.box([-x - 0.14, 0, -z - 0.14], [x + 0.14, ground - 0.2, z + 0.14], MAT.PLASTER));

  if (medium) {
    eavesBand(m, -x, -z, x, z, h);
    chimneyStack(m, -x + 1.8, 0, h + 1.4, h + 3.8, 1.2);
    chimneyStack(m, x - 1.8, 0, h + 1.4, h + 3.6, 1.2);
    band(m, -x, -z, x, z, ground - 0.2, 0.4, 0.24);
    // Terrace out front, with a low wall round it.
    m.box([-x, 0.001, z], [x, 0.1, z + 4.2], MAT.CONCRETE);
    m.box([-x, 0.1, z + 4.0], [x, 0.75, z + 4.2], MAT.BRICK);
  }
  if (fine) {
    // Big ground-floor windows with small panes, and a corner door.
    for (const [from, to, n] of [[-x + 0.9, -2.2, 2], [2.2, x - 0.9, 2]] as const) {
      m.windowRow({ axis: 'z', sign: 1, plane: z, from, to, y0: 1.05, y1: 3.2,
        count: n, width: 1.6, glass: MAT.GLASS, frame: 0.14, proud: 0.07 });
    }
    m.windowRow({ axis: 'x', sign: 1, plane: x, from: -z + 1.0, to: z - 1.0, y0: 1.05, y1: 3.2,
      count: 3, width: 1.5, glass: MAT.GLASS, frame: 0.14, proud: 0.07 });
    windowGrid(m, { axis: 'z', sign: 1, plane: z }, -x + 0.9, x - 0.9,
      { floors: 1, floorH: upper, base: ground + 0.7, count: 4, width: 1.0, height: 1.5 });
    windowGrid(m, { axis: 'z', sign: -1, plane: -z }, -x + 0.9, x - 0.9,
      { floors: 2, floorH: 3.6, base: 1.2, count: 4, width: 1.0, height: 1.4 });
    for (const sx of [-1, 1] as const) {
      windowGrid(m, { axis: 'x', sign: sx, plane: sx * x }, -z + 1.2, z - 1.2,
        { floors: 1, floorH: upper, base: ground + 0.7, count: 3, width: 1.0, height: 1.4 });
    }
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0,
      { width: 1.5, height: 2.5, double: true, fanlight: true, steps: 1 });
    // Hanging sign on a bracket, and a lantern over the door.
    bladeSign(m, { axis: 'z', sign: 1, plane: z }, -x + 2.4, ground - 1.6, ground + 0.6, 1.5);
    m.painted(TINT.SIGN_LIT, () => m.box([-0.28, 3.1, z + 0.02], [0.28, 3.7, z + 0.34], MAT.TRIM));
    fasciaSign(m, { axis: 'z', sign: 1, plane: z }, -4.6, 4.6, ground - 1.5, ground - 0.5);
    // Benches and parasols on the terrace.
    for (const px of [-4.4, 4.4]) {
      m.painted(TINT.WOOD, () => {
        m.box([px - 1.3, 0.72, z + 1.4], [px + 1.3, 0.8, z + 2.4], MAT.TRIM);
        for (const bz of [z + 1.1, z + 2.7]) {
          m.box([px - 1.3, 0.42, bz - 0.16], [px + 1.3, 0.5, bz + 0.16], MAT.TRIM);
        }
      });
      m.painted(TINT.METAL_DARK, () => {
        m.box([px - 0.06, 0, z + 1.85], [px + 0.06, 2.6, z + 1.97], MAT.TRIM);
      });
      m.painted(TINT.AWNING, () =>
        m.cone(px, z + 1.91, 1.7, 0.1, 2.3, 2.85, 8, MAT.TRIM));
    }
    frontage(m, -x, x, z + 4.2, 741, { planters: 2, bollards: 7, depth: 2.2 });
  }
  return m;
}

// ------------------------------------------------------------ car showroom

/** Glass box on a forecourt, with cars on the apron and a service bay behind. */
function showroom(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 22.0, d = 14.0;
  const x = w / 2, z = d / 2;
  const hall = 6.8, service = 5.6;

  m.box([-x, 0, -z + 5.0], [x, hall, z], MAT.GLASS, { roof: MAT.ROOF });
  m.box([-x, 0, -z], [x, service, -z + 5.0], MAT.CLADDING, { roof: MAT.TRIM });

  if (medium) {
    // Deep fascia wrapping the glass: the one gesture every showroom makes.
    m.painted(TINT.BRAND, () => ring(m, -x, -z + 5.0, x, z, hall - 1.2, 1.5, 0.55));
    m.box([-x - 0.6, hall, -z + 4.6], [x + 0.6, hall + 0.35, z + 0.6], MAT.CONCRETE);
    parapet(m, -x, -z, x, -z + 5.0, service, 0.7, 0.24);
    // Curved-ish corner: a chamfer is enough at this scale.
    m.box([x - 0.4, 0, z - 3.4], [x + 0.5, hall, z + 0.4], MAT.GLASS);
    roofClutter(m, -x + 2, -z + 1, x - 2, -z + 4, service, 751, 0.8);
  }
  if (fine) {
    for (const [axis, sign, plane, u0, u1, n] of [
      ['z', 1, z, -x + 0.6, x - 0.6, 6],
      ['x', 1, x, -z + 5.6, z - 0.6, 3],
      ['x', -1, -x, -z + 5.6, z - 0.6, 3],
    ] as const) {
      m.windowRow({ axis, sign, plane, from: u0, to: u1, y0: 0.5, y1: hall - 1.4,
        count: n, width: 2.6, glass: MAT.SHOPFRONT, frame: 0.13, proud: 0.07 });
    }
    entrance(m, { axis: 'z', sign: 1, plane: z }, -3.0,
      { width: 2.4, height: 3.0, double: true, glazed: true });
    fasciaSign(m, { axis: 'z', sign: 1, plane: z }, 1.5, 9.0, hall - 0.9, hall + 0.1);
    // Service shutters on the flank.
    m.painted(TINT.METAL_DARK, () => {
      for (const cz of [-z + 1.6, -z + 3.6]) {
        m.box([-x - 0.02, 0, cz - 0.8], [-x + 0.14, 4.2, cz + 0.8], MAT.TRIM);
      }
    });
    // Cars on the apron: a body, a cabin and four wheels each.
    for (let i = 0; i < 5; i++) {
      const cx = -x + 2.4 + i * 4.4;
      const cz = z + 3.6;
      m.painted(i % 2 === 0 ? TINT.ACCENT : TINT.METAL_DARK, () => {
        m.box([cx - 0.85, 0.32, cz - 2.0], [cx + 0.85, 1.0, cz + 2.0], MAT.TRIM);
        m.box([cx - 0.78, 1.0, cz - 0.9], [cx + 0.78, 1.48, cz + 1.1], MAT.TRIM);
      });
      m.painted(TINT.METAL_DARK, () => {
        for (const wz of [cz - 1.35, cz + 1.35]) {
          for (const wx of [cx - 0.86, cx + 0.72]) {
            m.box([wx, 0.06, wz - 0.28], [wx + 0.14, 0.62, wz + 0.28], MAT.TRIM);
          }
        }
      });
      m.box([cx - 1.5, 0.002, cz - 2.4], [cx - 1.44, 0.02, cz + 2.4], MAT.TRIM);
    }
    m.box([-x, 0.001, z], [x, 0.08, z + 6.4], MAT.CONCRETE);
    kerb(m, -x, z + 6.4, x, z + 6.8);
  }
  return m;
}

// ------------------------------------------------------------ shopping mall

/** A mall: blank clad box, a glazed entrance drum, and a big car park apron. */
function mall(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 42.0, d = 26.0, h = 11.5;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], MAT.CLADDING, { roof: MAT.TRIM });
  // Entrance pavilion pushed forward, taller than the box behind it.
  m.box([-7.0, 0, z - 0.5], [7.0, h + 2.6, z + 5.0], MAT.GLASS, { roof: MAT.ROOF });

  if (medium) {
    parapet(m, -x, -z, x, z, h, 1.4, 0.4);
    parapet(m, -7.0, z - 0.5, 7.0, z + 5.0, h + 2.6, 1.2, 0.4);
    // Banded courses and a brick-faced base, so the box is not one flat plane.
    for (const y of [4.0, 7.4]) band(m, -x, -z, x, z, y, 0.5, 0.26, MAT.PLASTER);
    m.box([-x - 0.2, 0, -z - 0.2], [x + 0.2, 2.6, z + 0.2], MAT.BRICK);
    roofClutter(m, -x + 3, -z + 3, x - 3, z - 3, h, 761, 1.6);
    // Service yard and dock on the blind end.
    m.box([-x - 5.5, 0.001, -z], [-x, 0.1, z - 6.0], MAT.CONCRETE);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 2; i++) {
        const cz = -z + 3.0 + i * 4.5;
        m.box([-x - 0.16, 0, cz - 1.7], [-x + 0.02, 4.4, cz + 1.7], MAT.TRIM);
      }
    });
    m.box([-x - 3.0, 0.001, -z + 1.0], [-x, 1.2, -z + 12.0], MAT.CONCRETE);
  }
  if (fine) {
    for (let f = 0; f < 2; f++) {
      m.windowRow({ axis: 'z', sign: 1, plane: z + 5.0, from: -6.2, to: 6.2,
        y0: 1.0 + f * 4.6, y1: 5.0 + f * 4.6, count: 4, width: 2.8,
        glass: f === 0 ? MAT.SHOPFRONT : MAT.GLASS, frame: 0.12, proud: 0.07 });
    }
    entrance(m, { axis: 'z', sign: 1, plane: z + 5.0 }, 0,
      { width: 4.0, height: 3.4, double: true, glazed: true, canopy: 3.0 });
    boxSign(m, { axis: 'z', sign: 1, plane: z + 5.0 }, -4.4, 4.4, h + 0.6, h + 2.2);
    // A run of glazing along the front where the units face out.
    for (const [from, to] of [[-x + 2.0, -8.5], [8.5, x - 2.0]] as const) {
      m.windowRow({ axis: 'z', sign: 1, plane: z, from, to, y0: 0.7, y1: 3.6,
        count: 5, width: 2.6, glass: MAT.SHOPFRONT, frame: 0.11, proud: 0.07 });
    }
    fasciaSign(m, { axis: 'z', sign: 1, plane: z }, -x + 3.0, -x + 11.0, 4.2, 5.4);
    fasciaSign(m, { axis: 'z', sign: 1, plane: z }, x - 11.0, x - 3.0, 4.2, 5.4);
    // Car park: bay markings and a lighting column per aisle.
    m.box([-x, 0.001, z + 5.0], [x, 0.06, z + 17.0], MAT.CONCRETE);
    for (let i = 0; i < 16; i++) {
      const px = -x + 1.5 + i * 2.7;
      m.box([px - 0.06, 0.004, z + 5.6], [px + 0.06, 0.02, z + 10.4], MAT.TRIM);
      m.box([px - 0.06, 0.004, z + 11.6], [px + 0.06, 0.02, z + 16.4], MAT.TRIM);
    }
    m.painted(TINT.METAL_DARK, () => {
      for (const px of [-14.0, 0.0, 14.0]) {
        m.box([px - 0.14, 0, z + 10.9], [px + 0.14, 8.0, z + 11.1], MAT.TRIM);
        m.box([px - 1.1, 8.0, z + 10.7], [px + 1.1, 8.35, z + 11.3], MAT.TRIM);
      }
    });
    kerb(m, -x, z + 17.0, x, z + 17.4);
  }
  return m;
}

// ------------------------------------------------------------ takeaway row

/** Three narrow takeaway units in a row, each with its own sign and colour. */
function takeawayRow(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const units = 3;
  const uw = 5.0;
  const w = units * uw, d = 8.0, h = 4.6;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], MAT.PLASTER, { roof: MAT.ROOF });

  if (medium) {
    parapet(m, -x, -z, x, z, h, 0.9, 0.3);
    // Each unit gets its own parapet height, which is what makes a row of
    // small units read as several businesses rather than one long shed.
    for (let i = 0; i < units; i++) {
      const a = -x + i * uw;
      const b = a + uw;
      const bump = 0.5 + (i % 2) * 0.55;
      m.box([a + 0.1, h, z - 0.6], [b - 0.1, h + 0.9 + bump, z + 0.35], MAT.PLASTER);
    }
    roofClutter(m, -x + 1, -z + 1, x - 1, z - 2, h, 771, 1.4);
  }
  if (fine) {
    for (let i = 0; i < units; i++) {
      const a = -x + i * uw + 0.3;
      const b = -x + (i + 1) * uw - 0.3;
      shopfront(m, { axis: 'z', sign: 1, plane: z }, a, b,
        { bays: 2, doorBay: 1, head: 3.3, fascia: 0.8, brandFascia: i === 0 });
      if (i === 0) fasciaSign(m, { axis: 'z', sign: 1, plane: z }, a + 0.3, b - 0.3, 2.62, 3.32);
      if (i === 1) boxSign(m, { axis: 'z', sign: 1, plane: z }, a + 0.5, b - 0.5, 3.7, 4.7);
      if (i === 2) bladeSign(m, { axis: 'z', sign: 1, plane: z }, b - 0.6, 2.6, 4.4, 1.2);
      // Extract duct up the back of each unit: takeaways all have one.
      m.painted(TINT.METAL_DARK, () => {
        const cx = (a + b) / 2;
        m.box([cx - 0.4, 1.0, -z - 0.55], [cx + 0.4, h + 1.6, -z], MAT.TRIM);
        m.box([cx - 0.55, h + 1.6, -z - 0.7], [cx + 0.55, h + 1.9, -z + 0.1], MAT.TRIM);
      });
    }
    windowGrid(m, { axis: 'x', sign: 1, plane: x }, -z + 1.2, z - 1.2,
      { floors: 1, floorH: 3, base: 1.6, count: 2, width: 0.9, height: 1.2 });
    frontage(m, -x, x, z, 773, { planters: 2, bollards: 7, depth: 2.2 });
    // Bin store round the side, because these always have one.
    m.painted(TINT.METAL_DARK, () => {
      m.box([-x - 2.6, 0, -z + 1.0], [-x - 0.2, 1.4, -z + 3.4], MAT.TRIM);
      m.box([-x - 2.75, 1.4, -z + 0.85], [-x - 0.05, 1.55, -z + 3.55], MAT.TRIM);
    });
  }
  return m;
}

// ----------------------------------------------------------------- clinic

/** A small health centre: brick and render, a canopy, a clear front door. */
function clinic(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 20.0, d = 13.0;
  const floors = 2, floorH = 3.6;
  const h = floors * floorH;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], MAT.BRICK, { roof: MAT.ROOF });
  // Rendered stair bay, taller, off centre.
  m.box([-x + 2.0, 0, z - 0.3], [-x + 6.4, h + 1.8, z + 1.4], MAT.PLASTER, { roof: MAT.ROOF });

  if (medium) {
    parapet(m, -x, -z, x, z, h, 0.9, 0.28);
    parapet(m, -x + 2.0, z - 0.3, -x + 6.4, z + 1.4, h + 1.8, 0.8, 0.3);
    band(m, -x, -z, x, z, floorH - 0.4, 0.4, 0.2);
    // Deep canopy across the entrance.
    m.box([-1.0, h - 3.5, z], [9.0, h - 3.1, z + 2.6], MAT.CONCRETE);
    m.painted(TINT.METAL_DARK, () => {
      for (const px of [0.2, 7.8]) m.box([px - 0.12, 0, z + 2.2], [px + 0.12, h - 3.5, z + 2.44], MAT.TRIM);
    });
    roofClutter(m, -x + 2, -z + 2, x - 2, z - 2, h, 781, 1.0);
  }
  if (fine) {
    for (const [axis, sign, plane, u0, u1, n] of [
      ['z', 1, z, -x + 7.0, x - 0.9, 4],
      ['z', -1, -z, -x + 0.9, x - 0.9, 6],
      ['x', 1, x, -z + 1.0, z - 1.0, 3],
      ['x', -1, -x, -z + 1.0, z - 1.0, 3],
    ] as const) {
      windowGrid(m, { axis, sign, plane }, u0, u1,
        { floors, floorH, base: 1.1, count: n, width: 1.6, height: 2.0 });
    }
    for (let f = 0; f < floors; f++) {
      m.opening({ axis: 'z', sign: 1, plane: z + 1.4, u0: -x + 2.6, u1: -x + 5.8,
        y0: f * floorH + 0.8, y1: f * floorH + 2.9, glass: MAT.GLASS, frame: 0.12, proud: 0.06 });
    }
    m.windowRow({ axis: 'z', sign: 1, plane: z, from: -1.0, to: 3.2, y0: 0.7, y1: 3.0,
      count: 2, width: 1.9, glass: MAT.SHOPFRONT, frame: 0.11, proud: 0.07 });
    entrance(m, { axis: 'z', sign: 1, plane: z }, 5.6,
      { width: 2.4, height: 2.8, double: true, glazed: true, steps: 1 });
    boxSign(m, { axis: 'z', sign: 1, plane: z }, 1.6, 8.4, h - 2.9, h - 1.8);
    frontage(m, -x, x, z + 2.6, 783, { planters: 3, bollards: 8, depth: 2.4 });
  }
  return m;
}

// ------------------------------------------------------------- florist row

/** A pair of small specialist shops under one pitched roof, with awnings. */
function specialistPair(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 12.0, d = 9.0;
  const ground = 3.8, upper = 3.0;
  const h = ground + upper;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], MAT.PLASTER, { roof: MAT.ROOF });
  m.gable([-x, h, -z], [x, h, z], 2.2, 'x', MAT.ROOF_TILE, MAT.PLASTER);

  if (medium) {
    eavesBand(m, -x, -z, x, z, h);
    chimneyStack(m, 0, 0, h + 1.2, h + 3.2, 1.0);
    band(m, -x, -z, x, z, ground - 0.3, 0.35, 0.2);
    m.box([-0.16, 0, z - 0.1], [0.16, h + 2.4, z + 0.2], MAT.BRICK);
  }
  if (fine) {
    for (const sx of [-1, 1] as const) {
      const a = sx < 0 ? -x + 0.4 : 0.4;
      const b = sx < 0 ? -0.4 : x - 0.4;
      shopfront(m, { axis: 'z', sign: 1, plane: z }, a, b,
        { bays: 2, doorBay: sx < 0 ? 1 : 0, head: 3.2, fascia: 0.7, brandFascia: sx < 0 });
      awning(m, { axis: 'z', sign: 1, plane: z }, a + 0.2, b - 0.2, 3.0, 1.4);
      windowGrid(m, { axis: 'z', sign: 1, plane: z }, a, b,
        { floors: 1, floorH: upper, base: ground + 0.7, count: 2, width: 1.0, height: 1.6 });
      windowGrid(m, { axis: 'x', sign: sx, plane: sx * x }, -z + 1.2, z - 1.2,
        { floors: 1, floorH: upper, base: ground + 0.7, count: 2, width: 0.9, height: 1.4 });
    }
    windowGrid(m, { axis: 'z', sign: -1, plane: -z }, -x + 0.9, x - 0.9,
      { floors: 2, floorH: 3.5, base: 1.1, count: 4, width: 1.0, height: 1.4 });
    fasciaSign(m, { axis: 'z', sign: 1, plane: z }, -x + 0.7, -0.7, 2.52, 3.18);
    bladeSign(m, { axis: 'z', sign: 1, plane: z }, x - 1.2, 3.6, 5.2, 1.2);
    // Buckets of stock on the pavement outside the left-hand unit.
    for (let i = 0; i < 4; i++) {
      const cx = -x + 1.2 + i * 1.1;
      m.painted(TINT.METAL_DARK, () => m.cylinder(cx, z + 1.1, 0.28, 0, 0.55, 8, MAT.TRIM));
      m.painted(TINT.GREEN, () => m.cone(cx, z + 1.1, 0.34, 0.1, 0.55, 1.25, 7, MAT.TRIM));
    }
    frontage(m, -x, x, z, 791, { planters: 0, bollards: 6, depth: 2.2 });
  }
  return m;
}

// -------------------------------------------------------------- night club

/** A blank-walled club with a lit entrance: all the detail is at the door. */
function nightclub(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 18.0, d = 16.0, h = 9.0;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], MAT.BRICK, { roof: MAT.ROOF });
  m.painted(TINT.BRAND_DARK, () =>
    m.box([-x - 0.16, 0, -z - 0.16], [x + 0.16, 3.4, z + 0.16], MAT.PLASTER));

  if (medium) {
    parapet(m, -x, -z, x, z, h, 1.2, 0.34);
    band(m, -x, -z, x, z, 3.4, 0.4, 0.26);
    // Entrance bay standing forward, with a lit canopy across it.
    m.box([-4.0, 0, z], [4.0, 6.4, z + 1.6], MAT.CLADDING, { roof: MAT.TRIM });
    m.painted(TINT.SIGN_LIT, () => m.box([-4.4, 4.4, z + 1.6], [4.4, 4.9, z + 3.6], MAT.TRIM));
    m.painted(TINT.METAL_DARK, () => {
      for (const px of [-4.0, 4.0]) m.box([px - 0.12, 0, z + 3.2], [px + 0.12, 4.4, z + 3.44], MAT.TRIM);
    });
    roofClutter(m, -x + 2, -z + 2, x - 2, z - 3, h, 801, 1.5);
  }
  if (fine) {
    entrance(m, { axis: 'z', sign: 1, plane: z + 1.6 }, 0,
      { width: 3.0, height: 3.0, double: true, glazed: true });
    boxSign(m, { axis: 'z', sign: 1, plane: z + 1.6 }, -3.2, 3.2, 4.9, 6.1);
    // High-level slot windows only: a club does not want daylight.
    for (const [axis, sign, plane, u0, u1] of [
      ['x', 1, x, -z + 1.5, z - 1.5], ['x', -1, -x, -z + 1.5, z - 1.5],
      ['z', -1, -z, -x + 1.5, x - 1.5],
    ] as const) {
      m.opening({ axis, sign, plane, u0, u1, y0: h - 2.2, y1: h - 1.4,
        glass: MAT.GLASS, frame: 0.12, proud: 0.06 });
    }
    // Queue rail and a fire escape door on the flank.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 6; i++) {
        const px = -6.0 + i * 2.0;
        m.box([px - 0.05, 0, z + 4.4], [px + 0.05, 1.0, z + 4.5], MAT.TRIM);
      }
      m.box([-6.0, 0.92, z + 4.38], [6.0, 1.0, z + 4.52], MAT.TRIM);
    });
    entrance(m, { axis: 'x', sign: -1, plane: -x }, 3.0, { width: 1.4, height: 2.2, double: true });
    // Plant on the roof and the ductwork feeding it, plus a fire escape stair
    // down the blind flank: a club is mostly machinery and exits.
    m.painted(TINT.METAL_DARK, () => {
      m.box([-5.0, h, -z + 3.0], [5.0, h + 2.4, -z + 8.0], MAT.TRIM);
      for (const px of [-3.4, 0.0, 3.4]) {
        m.cylinder(px, -z + 5.5, 0.9, h + 2.4, h + 3.6, 10, MAT.TRIM);
      }
      m.box([x - 0.9, 3.6, -z + 4.0], [x + 0.7, h, -z + 5.6], MAT.TRIM);
      for (let f = 1; f <= 2; f++) {
        const y = 2.6 + f * 2.6;
        m.box([x, y - 0.16, -z + 7.0], [x + 1.9, y, -z + 10.4], MAT.TRIM);
        m.box([x + 1.75, y, -z + 7.0], [x + 1.9, y + 1.05, -z + 10.4], MAT.TRIM);
        for (let i = 0; i < 8; i++) {
          m.box([x + 0.3, y - 2.6 + i * 0.32, -z + 10.4], [x + 1.6, y - 2.52 + i * 0.32, -z + 10.6], MAT.TRIM);
        }
      }
    });
    // Poster boards flanking the entrance bay.
    for (const px of [-5.6, 5.6]) {
      m.painted(TINT.BRAND_DARK, () => m.box([px - 1.0, 1.2, z + 0.02], [px + 1.0, 3.4, z + 0.18], MAT.TRIM));
      m.opening({ axis: 'z', sign: 1, plane: z + 0.18, u0: px - 0.85, u1: px + 0.85,
        y0: 1.35, y1: 3.25, glass: MAT.GLASS, frame: 0.07, proud: 0.05 });
    }
    frontage(m, -x, x, z + 4.5, 803, { planters: 2, bollards: 6, depth: 2.0 });
  }
  return m;
}

COMMERCIAL.push(
  {
    id: 'com.garden', name: 'Garden centre', zone: 'commercial', density: 'low',
    variant: 'sculpted', footprint: [5, 4], height: 8.2, brand: BRANDS.garden,
    sim: { jobs: 16, powerKW: 45, waterM3: 30, garbagePerWeek: 120, pollution: 1, upkeep: 38 },
    note: 'Timber sales barn beside a glasshouse, benches of stock in a railed yard.',
    build: gardenCentre,
  },
  {
    id: 'com.pub', name: 'Public house', zone: 'commercial', density: 'low',
    variant: 'sculpted', footprint: [3, 3], height: 9.8, brand: BRANDS.brewery,
    sim: { jobs: 15, powerKW: 50, waterM3: 24, garbagePerWeek: 200, pollution: 2, upkeep: 42 },
    note: 'Painted brick ground floor, two chimneys, hanging sign, terrace with parasols.',
    build: pub,
  },
  {
    id: 'com.showroom', name: 'Car showroom', zone: 'commercial', density: 'low',
    variant: 'sculpted', footprint: [4, 4], height: 7.2, brand: BRANDS.furniture,
    sim: { jobs: 20, powerKW: 80, waterM3: 14, garbagePerWeek: 90, pollution: 3, upkeep: 60 },
    note: 'Glass hall under a deep brand fascia, service bays behind, cars on the apron.',
    build: showroom,
  },
  {
    id: 'com.mall', name: 'Shopping mall', zone: 'commercial', density: 'high',
    variant: 'sculpted', footprint: [7, 8], height: 15.5, brand: BRANDS.toyshop,
    sim: { jobs: 180, powerKW: 460, waterM3: 120, garbagePerWeek: 1400, pollution: 5, upkeep: 280 },
    note: 'Clad box with a glazed entrance pavilion, shopfronts to the street, car park and service dock.',
    build: mall,
  },
  {
    id: 'com.takeaway', name: 'Takeaway row', zone: 'commercial', density: 'low',
    variant: 'sculpted', footprint: [3, 2], height: 6.6, brand: BRANDS.noodle,
    sim: { jobs: 12, powerKW: 55, waterM3: 14, garbagePerWeek: 190, pollution: 4, upkeep: 26 },
    note: 'Three narrow units, each with its own parapet, sign type and extract duct.',
    build: takeawayRow,
  },
  {
    id: 'com.clinic', name: 'Health centre', zone: 'commercial', density: 'medium',
    variant: 'sculpted', footprint: [3, 3], height: 9.0, brand: BRANDS.optician,
    sim: { jobs: 30, powerKW: 90, waterM3: 26, garbagePerWeek: 130, pollution: 1, upkeep: 88 },
    note: 'Brick block with a rendered stair bay, deep entrance canopy on posts.',
    build: clinic,
  },
  {
    id: 'com.specialist', name: 'Specialist shops', zone: 'commercial', density: 'low',
    variant: 'sculpted', footprint: [2, 2], height: 9.0, brand: BRANDS.bookshop,
    sim: { jobs: 9, powerKW: 30, waterM3: 5, garbagePerWeek: 60, pollution: 0, upkeep: 24 },
    note: 'Two small shops under one pitched roof, awnings, stock out on the pavement.',
    build: specialistPair,
  },
  {
    id: 'com.club', name: 'Night club', zone: 'commercial', density: 'medium',
    variant: 'sculpted', footprint: [3, 4], height: 10.2, brand: BRANDS.music,
    sim: { jobs: 24, powerKW: 150, waterM3: 20, garbagePerWeek: 280, pollution: 6, upkeep: 70 },
    note: 'Blank brick walls, high slot windows, lit entrance bay and a queue rail.',
    build: nightclub,
  },
);
