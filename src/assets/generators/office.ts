/**
 * Offices, as their own zone.
 *
 * Offices were sitting in commercial, which is wrong for a city builder: they
 * demand different things (transport rather than footfall), produce different
 * jobs, and look nothing like a shop. Splitting them out also gives the
 * skyline somewhere to grow that is not housing.
 *
 * The set runs from a two-storey business park unit to a curtain-walled tower,
 * because a city needs the cheap ones far more often than the landmark.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import { CELL } from '../types';
import type { AssetDef } from '../types';
import { BRANDS } from '../brands';
import {
  band, boxSign, entrance, fasciaSign, frontage, kerb, parapet, planter,
  railing, ring, roofClutter, tree, windowGrid,
} from '../parts';

// ------------------------------------------------------------- park unit

function parkUnit(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 22.0, d = 13.0;
  const x = w / 2, z = d / 2;
  const floors = 2, floorH = 3.8;
  const h = floors * floorH;

  m.box([-x, 0, -z], [x, h, z], MAT.PLASTER, { roof: MAT.ROOF });
  // Brick end bays: the standard business-park move to break up a long block.
  for (const sx of [-1, 1]) {
    m.box([sx * x - sx * 4.0, 0, -z - 0.3], [sx * x, h + 0.9, z + 0.3], MAT.BRICK, { roof: MAT.ROOF });
  }

  if (medium) {
    parapet(m, -x, -z, x, z, h, 0.8, 0.22);
    band(m, -x + 4.0, -z, x - 4.0, z, floorH - 0.35, 0.35, 0.16);
    // Entrance box standing forward of the facade.
    m.box([-2.8, 0, z], [2.8, 4.4, z + 2.2], MAT.GLASS, { roof: MAT.TRIM });
    m.box([-3.0, 4.4, z - 0.2], [3.0, 4.9, z + 2.4], MAT.CONCRETE);
    roofClutter(m, -x + 5, -z + 1.5, x - 5, z - 1.5, h, 301, 1.0);
  }
  if (fine) {
    for (const [axis, sign, plane, u0, u1, n] of [
      ['z', 1, z, -x + 4.6, x - 4.6, 5],
      ['z', -1, -z, -x + 4.6, x - 4.6, 5],
      ['x', 1, x, -z + 1.0, z - 1.0, 3],
      ['x', -1, -x, -z + 1.0, z - 1.0, 3],
    ] as const) {
      windowGrid(m, { axis, sign, plane }, u0, u1,
        { floors, floorH, base: 1.1, count: n, width: 1.9, height: 2.0 });
    }
    entrance(m, { axis: 'z', sign: 1, plane: z + 2.2 }, 0, { width: 2.0, double: true, canopy: 1.4 });
    fasciaSign(m, { axis: 'z', sign: 1, plane: z + 0.3 }, -x + 4.6, -x + 10.0, 4.9, 5.7);
    frontage(m, -x, x, z + 2.4, 303, { trees: 3, planters: 2, bollards: 6, depth: 2.6 });
    // Car park bays down one side.
    for (let i = 0; i < 6; i++) {
      const pz = -z + 1.5 + i * 2.4;
      m.box([x + 0.6, 0.002, pz], [x + 5.6, 0.02, pz + 0.08], MAT.TRIM);
    }
    kerb(m, x + 0.4, -z, x + 0.6, z);
  }
  return m;
}

// ---------------------------------------------------------------- mid-rise

function midRise(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = CELL * 2 - 1.0, d = CELL * 2 - 2.0;
  const x = w / 2, z = d / 2;
  const ground = 5.2;
  const floors = 6, floorH = 3.7;
  const top = ground + floors * floorH;

  m.box([-x, 0, -z], [x, ground, z], MAT.CONCRETE, { roof: MAT.TRIM });
  m.box([-x, ground, -z], [x, top, z], MAT.PLASTER, { roof: MAT.ROOF });

  if (medium) {
    // Deep reveals expressed as piers between windows, floor by floor.
    for (let f = 1; f <= floors; f++) band(m, -x, -z, x, z, ground + f * floorH - 0.55, 0.55, 0.2);
    parapet(m, -x, -z, x, z, top, 1.2, 0.3);
    m.box([-x - 1.0, ground - 0.9, -z - 1.0], [x + 1.0, ground - 0.5, z + 1.0], MAT.CONCRETE);
    roofClutter(m, -x + 1.5, -z + 1.5, x - 1.5, z - 1.5, top, 311, 1.2);
  }
  if (fine) {
    for (const [axis, sign, plane, half, n] of [
      ['z', 1, z, x, 4], ['z', -1, -z, x, 4], ['x', 1, x, z, 3], ['x', -1, -x, z, 3],
    ] as const) {
      windowGrid(m, { axis, sign, plane }, -half + 0.8, half - 0.8,
        { floors, floorH, base: ground + 0.9, count: n, width: 2.0, height: 2.3, sill: false });
    }
    // Ground floor is glazed lobby, not shop.
    for (const [axis, sign, plane, half] of [['z', 1, z, x], ['x', 1, x, z]] as const) {
      m.windowRow({ axis, sign, plane, from: -half + 0.9, to: half - 0.9, y0: 0.6, y1: 4.4,
        count: 4, width: 2.4, glass: MAT.SHOPFRONT, frame: 0.1, proud: 0.07 });
    }
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0, { width: 2.4, double: true, canopy: 2.0 });
    boxSign(m, { axis: 'z', sign: 1, plane: z }, -2.2, 2.2, ground + 0.5, ground + 1.5);
    frontage(m, -x, x, z, 313, { trees: 3, planters: 3, bollards: 7 });
  }
  return m;
}

// ------------------------------------------------------------ corporate HQ

function corporateHQ(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 13.0, z = 11.0;
  const podium = 6.5;
  const floors = 11, floorH = 3.9;
  const top = podium + floors * floorH;
  const tx = x * 0.72, tz = z * 0.72;

  m.box([-x, 0, -z], [x, podium, z], MAT.CONCRETE, { roof: MAT.ROOF });
  m.box([-tx, podium, -tz], [tx, top, tz], MAT.GLASS, { roof: MAT.ROOF });

  if (medium) {
    band(m, -x, -z, x, z, podium, 1.0, 0.4);
    // Two solid service cores flanking the glass, the classic HQ composition.
    for (const sx of [-1, 1]) {
      m.box([sx * tx - sx * 2.2, podium, -tz - 0.6], [sx * tx + sx * 0.6, top + 2.6, tz + 0.6],
        MAT.CONCRETE, { roof: MAT.ROOF });
    }
    for (let f = 1; f <= floors; f++) band(m, -tx, -tz, tx, tz, podium + f * floorH - 0.4, 0.4, 0.16);
    parapet(m, -tx, -tz, tx, tz, top, 1.4, 0.35);
    roofClutter(m, -tx + 2, -tz + 2, tx - 2, tz - 2, top, 321, 0.9);
    // Forecourt with a low wall and planting.
    m.box([-x, 0.001, z], [x, 0.12, z + 6.0], MAT.CONCRETE);
    m.box([-x, 0.12, z + 5.4], [x, 0.75, z + 6.0], MAT.CONCRETE);
  }
  if (fine) {
    for (let f = 0; f < floors; f++) {
      const y = podium + f * floorH + 0.55;
      for (const [axis, sign, plane, half] of [
        ['z', 1, tz, tx], ['z', -1, -tz, tx], ['x', 1, tx, tz], ['x', -1, -tx, tz],
      ] as const) {
        m.opening({ axis, sign, plane, u0: -half + 0.7, u1: half - 0.7, y0: y, y1: y + floorH - 1.25,
          glass: MAT.GLASS, frame: 0.08, proud: 0.05 });
      }
    }
    // Slim stair-light slots up each core: a blank slab that tall reads as
    // unfinished concrete rather than a building.
    for (const sx of [-1, 1] as const) {
      const cx = sx * tx - sx * 1.1;
      for (let f = 0; f < floors; f++) {
        const y = podium + f * floorH + 0.7;
        m.opening({ axis: 'z', sign: 1, plane: tz + 0.6, u0: cx - 0.5, u1: cx + 0.5, y0: y, y1: y + 2.1,
          glass: MAT.GLASS, frame: 0.1, proud: 0.05 });
        // And on the outer face, which is the elevation you see from the street.
        m.opening({ axis: 'x', sign: sx, plane: sx * (tx + 0.6), u0: -tz + 1.0, u1: tz - 1.0,
          y0: y + 0.2, y1: y + 1.9, glass: MAT.GLASS, frame: 0.1, proud: 0.05 });
      }
    }
    m.windowRow({ axis: 'z', sign: 1, plane: z, from: -x + 1.2, to: x - 1.2, y0: 0.8, y1: 5.6,
      count: 5, width: 3.2, glass: MAT.SHOPFRONT, frame: 0.12, proud: 0.08 });
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0, { width: 3.2, height: 3.2, double: true, canopy: 3.0 });
    boxSign(m, { axis: 'z', sign: 1, plane: z }, -3.4, 3.4, podium + 0.2, podium + 1.3);
    for (const px of [-8.0, 8.0]) planter(m, px, z + 3.0, 1.1, 0.7);
    for (const px of [-4.0, 4.0]) tree(m, px, z + 3.2, 6.4, px + 40);
    railing(m, -x, x, z + 6.0, 0.12, 1.0, 1.6);
  }
  return m;
}

// ------------------------------------------------------------- glass tower

function officeTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 11.5, z = 10.5;
  const podium = 8.0;
  const floors = 24, floorH = 3.75;
  const top = podium + floors * floorH;

  m.box([-x, 0, -z], [x, podium, z], MAT.CONCRETE, { roof: MAT.ROOF });
  m.box([-x * 0.88, podium, -z * 0.88], [x * 0.88, top, z * 0.88], MAT.GLASS, { roof: MAT.ROOF });

  if (medium) {
    band(m, -x, -z, x, z, podium, 1.1, 0.45);
    // Corner mullions carried the full height: the vertical emphasis that
    // stops a glass box reading as a fridge.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        m.box([sx * x * 0.88 - sx * 0.35, podium, sz * z * 0.88 - sz * 0.35],
              [sx * x * 0.88 + sx * 0.3, top + 2.0, sz * z * 0.88 + sz * 0.3], MAT.CONCRETE);
      }
    }
    parapet(m, -x * 0.88, -z * 0.88, x * 0.88, z * 0.88, top, 1.6, 0.3);
    m.box([-x * 0.4, top + 1.6, -z * 0.4], [x * 0.4, top + 6.0, z * 0.4], MAT.METAL, { roof: MAT.ROOF });
    m.box([-0.22, top + 6.0, -0.22], [0.22, top + 14.0, 0.22], MAT.TRIM);
    roofClutter(m, -x * 0.6, -z * 0.6, x * 0.6, z * 0.6, top + 1.6, 331, 0.7);
  }
  if (fine) {
    for (let f = 0; f < floors; f++) {
      const y = podium + f * floorH + 0.5;
      for (const [axis, sign, plane, half] of [
        ['z', 1, z * 0.88, x * 0.88], ['z', -1, -z * 0.88, x * 0.88],
        ['x', 1, x * 0.88, z * 0.88], ['x', -1, -x * 0.88, z * 0.88],
      ] as const) {
        m.opening({ axis, sign, plane, u0: -half + 0.6, u1: half - 0.6, y0: y, y1: y + floorH - 1.2,
          glass: MAT.GLASS, frame: 0.07, proud: 0.05 });
      }
    }
    m.windowRow({ axis: 'z', sign: 1, plane: z, from: -x + 1.0, to: x - 1.0, y0: 0.9, y1: 7.0,
      count: 5, width: 3.0, glass: MAT.SHOPFRONT, frame: 0.12, proud: 0.08 });
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0, { width: 3.6, height: 3.6, double: true, canopy: 3.4 });
    frontage(m, -x, x, z, 333, { trees: 4, planters: 3, bollards: 9, depth: 3.0 });
  }
  return m;
}

// ------------------------------------------------------------- conversion

function conversion(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 18.0, d = 12.5;
  const x = w / 2, z = d / 2;
  const floors = 4, floorH = 4.1;
  const h = floors * floorH;

  // An old warehouse turned into offices: brick, big industrial openings, a
  // glazed roof extension. Every city has these and none of them look new.
  m.box([-x, 0, -z], [x, h, z], MAT.BRICK, { roof: MAT.ROOF });

  if (medium) {
    band(m, -x, -z, x, z, h - 0.7, 0.7, 0.42);
    parapet(m, -x, -z, x, z, h, 0.9, 0.2);
    for (let f = 1; f < floors; f++) band(m, -x, -z, x, z, f * floorH - 0.25, 0.25, 0.14);
    // Rooftop extension, set back and glazed.
    m.box([-x + 2.5, h, -z + 2.5], [x - 2.5, h + 3.4, z - 2.5], MAT.GLASS, { roof: MAT.ROOF });
    parapet(m, -x + 2.5, -z + 2.5, x - 2.5, z - 2.5, h + 3.4, 0.5, 0.25);
    roofClutter(m, -x + 1, -z + 1, -x + 2.2, z - 1, h, 341, 0.8);
    // Loading bay turned into the entrance, with the old canopy kept.
    m.box([-3.6, 4.2, z], [3.6, 4.6, z + 2.4], MAT.METAL);
    m.painted(TINT.METAL_DARK, () => {
      for (const px of [-3.2, 3.2]) m.box([px - 0.12, 0, z + 2.1], [px + 0.12, 4.2, z + 2.34], MAT.TRIM);
    });
  }
  if (fine) {
    // Tall industrial windows with a heavy central mullion.
    for (const [axis, sign, plane, half, n] of [
      ['z', 1, z, x, 5], ['z', -1, -z, x, 5], ['x', 1, x, z, 3], ['x', -1, -x, z, 3],
    ] as const) {
      windowGrid(m, { axis, sign, plane }, -half + 0.9, half - 0.9,
        { floors, floorH, base: 1.0, count: n, width: 2.1, height: 2.6 });
    }
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0, { width: 2.6, height: 3.0, double: true });
    fasciaSign(m, { axis: 'z', sign: 1, plane: z }, -5.5, -1.5, 4.8, 5.6);
    frontage(m, -x, x, z + 2.4, 343, { trees: 3, planters: 2, bollards: 7 });
    // Fire escape on the flank, kept from the warehouse.
    m.painted(TINT.METAL_DARK, () => {
      for (let f = 1; f < floors; f++) {
        const y = f * floorH;
        m.box([-x - 1.6, y, -2.0], [-x, y + 0.1, 1.6], MAT.TRIM);
        m.box([-x - 1.6, y + 0.1, -2.0], [-x - 1.48, y + 1.0, 1.6], MAT.TRIM);
      }
      m.box([-x - 1.55, 0, -2.0], [-x - 1.43, h, -1.88], MAT.TRIM);
      m.box([-x - 1.55, 0, 1.48], [-x - 1.43, h, 1.6], MAT.TRIM);
    });
  }
  return m;
}

// -------------------------------------------------------------------- table

const desk = (jobs: number, upkeep: number): AssetDef['sim'] => ({
  jobs, powerKW: jobs * 1.9, waterM3: jobs * 0.14, garbagePerWeek: jobs * 3.4,
  pollution: 1, upkeep,
});

export const OFFICE: AssetDef[] = [
  { id: 'off.park', name: 'Business park unit', zone: 'office', density: 'low', variant: 'sculpted', footprint: [4, 3], height: 8.5, brand: BRANDS.electronics, sim: desk(45, 70), note: 'Two storeys with brick end bays, glazed entrance box, car park bays.', build: parkUnit },
  { id: 'off.midrise', name: 'Mid-rise offices', zone: 'office', density: 'medium', variant: 'sculpted', footprint: [2, 3], height: 28, brand: BRANDS.bank, sim: desk(160, 190), note: 'Expressed floor bands, glazed lobby, canopy over a double entrance.', build: midRise },
  { id: 'off.hq', name: 'Corporate headquarters', zone: 'office', density: 'high', variant: 'sculpted', footprint: [4, 5], height: 51, brand: BRANDS.bank, sim: desk(420, 430), note: 'Glass slab between two solid cores, podium, forecourt with planting.', build: corporateHQ },
  { id: 'off.tower', name: 'Office tower', zone: 'office', density: 'high', variant: 'sculpted', footprint: [3, 4], height: 112, brand: BRANDS.electronics, sim: desk(900, 820), note: 'Full-height corner mullions, crown and mast, deep glazed base.', build: officeTower },
  { id: 'off.conversion', name: 'Warehouse conversion', zone: 'office', density: 'medium', variant: 'sculpted', footprint: [3, 3], height: 20, brand: BRANDS.bookshop, sim: desk(110, 130), note: 'Old brick warehouse, tall industrial openings, glazed rooftop extension.', build: conversion },
];

void ring;
