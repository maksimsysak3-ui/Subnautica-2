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
  railing, ring, roofClutter, windowGrid,
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
    m.box([sx * x - sx * 4.0, 0, -z - 0.3], [sx * x, h + 0.9, z + 0.3], MAT.CLADDING, { roof: MAT.ROOF });
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
    frontage(m, -x, x, z + 2.4, 303, { planters: 2, bollards: 6, depth: 2.6 });
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
    frontage(m, -x, x, z, 313, { planters: 3, bollards: 7 });
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

  m.box([-x, 0, -z], [x, podium, z], MAT.STONE, { roof: MAT.ROOF });
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
    frontage(m, -x, x, z, 333, { planters: 3, bollards: 9, depth: 3.0 });
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
    frontage(m, -x, x, z + 2.4, 343, { planters: 2, bollards: 7 });
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

// -------------------------------------------------------------- deco tower

/**
 * A pre-war office tower: masonry, setbacks, and vertical piers running the
 * full height. The office set was otherwise all post-1960 glass, and a
 * downtown with no older stock in it looks like a business park.
 */
function decoTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 11.0, z = 10.0;
  const ground = 6.2, floorH = 3.5;
  // Three stages, each stepping in: the massing rule these were designed to.
  const stages: Array<[number, number, number]> = [
    [ground, ground + 8 * floorH, 1.0],
    [ground + 8 * floorH, ground + 14 * floorH, 0.78],
    [ground + 14 * floorH, ground + 18 * floorH, 0.56],
  ];
  const top = stages[2][1];

  m.box([-x, 0, -z], [x, ground, z], MAT.STONE, { roof: MAT.TRIM });
  for (const [y0, y1, sc] of stages) {
    m.box([-x * sc, y0, -z * sc], [x * sc, y1, z * sc], MAT.BRICK, { roof: MAT.ROOF });
  }

  if (medium) {
    band(m, -x, -z, x, z, ground, 0.7, 0.4);
    for (const [, y1, sc] of stages) {
      band(m, -x * sc, -z * sc, x * sc, z * sc, y1, 1.0, 0.42);
      parapet(m, -x * sc, -z * sc, x * sc, z * sc, y1 + 1.0, 0.7, 0.2);
    }
    // Piers between every window bay, run the full height of each stage.
    for (const [y0, y1, sc] of stages) {
      const bays = Math.max(3, Math.round((x * sc * 2) / 2.6));
      for (let i = 0; i <= bays; i++) {
        const px = -x * sc + (i / bays) * x * sc * 2;
        for (const sz of [-1, 1] as const) {
          m.box([px - 0.2, y0, sz * z * sc], [px + 0.2, y1, sz * z * sc + sz * 0.3], MAT.CONCRETE);
        }
      }
      const dbays = Math.max(3, Math.round((z * sc * 2) / 2.6));
      for (let i = 0; i <= dbays; i++) {
        const pz = -z * sc + (i / dbays) * z * sc * 2;
        for (const sx of [-1, 1] as const) {
          m.box([Math.min(sx * x * sc, sx * x * sc + sx * 0.3), y0, pz - 0.2],
                [Math.max(sx * x * sc, sx * x * sc + sx * 0.3), y1, pz + 0.2], MAT.CONCRETE);
        }
      }
    }
    // Stepped crown and a mast, the reason anyone looks up at one of these.
    for (let i = 0; i < 3; i++) {
      const sc = 0.4 - i * 0.1;
      m.box([-x * sc, top + 1.7 + i * 1.4, -z * sc], [x * sc, top + 3.1 + i * 1.4, z * sc],
        MAT.CONCRETE, { roof: MAT.ROOF });
    }
    m.box([-0.18, top + 7.3, -0.18], [0.18, top + 13.5, 0.18], MAT.TRIM);
    roofClutter(m, -x * 0.5, -z * 0.5, x * 0.5, z * 0.5, top + 1.0, 341, 0.5);
  }
  if (fine) {
    for (const [y0, y1, sc] of stages) {
      const n = Math.round((y1 - y0) / floorH);
      for (let f = 0; f < n; f++) {
        const y = y0 + f * floorH + 0.75;
        for (const [axis, sign, plane, half] of [
          ['z', 1, z * sc, x * sc], ['z', -1, -z * sc, x * sc],
          ['x', 1, x * sc, z * sc], ['x', -1, -x * sc, z * sc],
        ] as const) {
          m.opening({ axis, sign, plane, u0: -half + 0.6, u1: half - 0.6, y0: y, y1: y + 2.0,
            glass: MAT.GLASS, frame: 0.1, proud: 0.05 });
        }
      }
    }
    // Deep stone-framed entrance: three storeys of it, as they always were.
    m.box([-3.6, 0, z], [3.6, ground - 0.4, z + 0.5], MAT.STONE, { roof: MAT.TRIM });
    m.opening({ axis: 'z', sign: 1, plane: z + 0.5, u0: -2.6, u1: 2.6, y0: 3.4, y1: ground - 0.9,
      glass: MAT.GLASS, frame: 0.14, proud: 0.06 });
    entrance(m, { axis: 'z', sign: 1, plane: z + 0.5 }, 0,
      { width: 2.6, height: 3.0, double: true, steps: 2 });
    m.windowRow({ axis: 'z', sign: 1, plane: z, from: -x + 1.0, to: -4.2, y0: 1.2, y1: 4.6,
      count: 2, width: 2.0, glass: MAT.SHOPFRONT, frame: 0.12, proud: 0.07 });
    m.windowRow({ axis: 'z', sign: 1, plane: z, from: 4.2, to: x - 1.0, y0: 1.2, y1: 4.6,
      count: 2, width: 2.0, glass: MAT.SHOPFRONT, frame: 0.12, proud: 0.07 });
    boxSign(m, { axis: 'z', sign: 1, plane: z + 0.5 }, -2.4, 2.4, ground - 0.85, ground - 0.1);
    frontage(m, -x, x, z + 0.5, 343, { planters: 2, bollards: 8, depth: 2.4 });
  }
  return m;
}

// ------------------------------------------------------------- tech campus

/**
 * A low, wide campus building: two glazed wings around a planted courtyard,
 * with a bridge between them. Offices need a low-density option that is not
 * just a smaller tower -- this is where a city puts the jobs it zoned on the
 * edge of town.
 */
function techCampus(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 17.0, z = 13.0;
  const floors = 3, floorH = 3.8;
  const h = floors * floorH;
  const wing = 9.0;

  // Two wings joined by a link block at the back.
  for (const sx of [-1, 1] as const) {
    m.box([Math.min(sx * x, sx * x - sx * wing), 0, -z],
          [Math.max(sx * x, sx * x - sx * wing), h, z], MAT.GLASS, { roof: MAT.ROOF });
  }
  m.box([-x + wing, 0, -z], [x - wing, h, -z + 7.0], MAT.PLASTER, { roof: MAT.ROOF });

  if (medium) {
    for (const sx of [-1, 1] as const) {
      const a = Math.min(sx * x, sx * x - sx * wing);
      const b = Math.max(sx * x, sx * x - sx * wing);
      for (let f = 1; f <= floors; f++) band(m, a, -z, b, z, f * floorH - 0.5, 0.5, 0.28);
      parapet(m, a, -z, b, z, h, 1.0, 0.3);
    }
    parapet(m, -x + wing, -z, x - wing, -z + 7.0, h, 1.0, 0.3);
    // Bridge across the court at first floor: the campus signature.
    m.box([-x + wing, floorH + 0.4, 1.5], [x - wing, floorH + 3.6, 5.0], MAT.GLASS, { roof: MAT.TRIM });
    m.box([-x + wing - 0.3, floorH + 0.1, 1.2], [x - wing + 0.3, floorH + 0.5, 5.3], MAT.CONCRETE);
    roofClutter(m, -x + 1.5, -z + 1.5, -x + wing - 1.5, z - 1.5, h, 351, 1.0);
    roofClutter(m, x - wing + 1.5, -z + 1.5, x - 1.5, z - 1.5, h, 353, 1.0);
    // Planted courtyard between the wings.
    m.painted(TINT.GREEN, () => {
      m.box([-x + wing + 0.5, 0.001, -z + 7.5], [x - wing - 0.5, 0.14, z - 1.0], MAT.TRIM);
    });
  }
  if (fine) {
    for (const sx of [-1, 1] as const) {
      const outer = sx * x;
      const inner = sx * x - sx * wing;
      for (let f = 0; f < floors; f++) {
        const y = f * floorH + 0.9;
        m.opening({ axis: 'x', sign: sx, plane: outer, u0: -z + 0.9, u1: z - 0.9, y0: y, y1: y + 2.2,
          glass: MAT.GLASS, frame: 0.1, proud: 0.06 });
        m.opening({ axis: 'x', sign: (-sx) as 1 | -1, plane: inner, u0: -z + 7.6, u1: z - 0.9,
          y0: y, y1: y + 2.2, glass: MAT.GLASS, frame: 0.1, proud: 0.06 });
        for (const sz of [1, -1] as const) {
          m.opening({ axis: 'z', sign: sz, plane: sz * z,
            u0: Math.min(outer, inner) + 0.9, u1: Math.max(outer, inner) - 0.9,
            y0: y, y1: y + 2.2, glass: MAT.GLASS, frame: 0.1, proud: 0.06 });
        }
      }
      planter(m, sx * 3.0, z - 7.5, 1.1, 0.6);
    }
    windowGrid(m, { axis: 'z', sign: -1, plane: -z }, -x + wing + 0.8, x - wing - 0.8,
      { floors, floorH, base: 1.1, count: 4, width: 1.8, height: 2.0, sill: false });
    // Two entrances, one per wing, facing the court.
    for (const sx of [-1, 1] as const) {
      entrance(m, { axis: 'z', sign: 1, plane: z }, sx * (x - wing / 2),
        { width: 2.4, height: 3.0, double: true, glazed: true, canopy: 2.2 });
    }
    fasciaSign(m, { axis: 'z', sign: 1, plane: z }, -x + 1.2, -x + 7.0, h - 1.6, h - 0.5);
    frontage(m, -x, x, z, 357, { planters: 0, bollards: 10, depth: 2.4 });
  }
  return m;
}

// --------------------------------------------------------------- courtyard

/** A perimeter office block round a glazed atrium, four storeys all round. */
function atriumBlock(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 15.0, z = 12.0, t = 7.0;
  const floors = 4, floorH = 3.7;
  const h = floors * floorH;

  // Four wings round a hole. Modelling the hole is what makes it read.
  m.box([-x, 0, -z], [x, h, -z + t], MAT.PLASTER, { roof: MAT.ROOF });
  m.box([-x, 0, z - t], [x, h, z], MAT.PLASTER, { roof: MAT.ROOF });
  m.box([-x, 0, -z + t], [-x + t, h, z - t], MAT.PLASTER, { roof: MAT.ROOF });
  m.box([x - t, 0, -z + t], [x, h, z - t], MAT.PLASTER, { roof: MAT.ROOF });
  // Glazed roof over the court.
  m.box([-x + t, h - 1.4, -z + t], [x - t, h - 1.0, z - t], MAT.GLASS);

  if (medium) {
    parapet(m, -x, -z, x, z, h, 1.0, 0.3);
    for (let f = 1; f <= floors; f++) band(m, -x, -z, x, z, f * floorH - 0.45, 0.45, 0.22);
    // Ridge bars across the atrium glazing.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 5; i++) {
        const px = -x + t + (i / 5) * (x - t) * 2;
        m.box([px - 0.09, h - 1.05, -z + t], [px + 0.09, h - 0.7, z - t], MAT.TRIM);
      }
    });
    m.box([-x - 1.2, -0.0, -z - 1.2], [x + 1.2, 0.42, z + 1.2], MAT.CONCRETE);
    roofClutter(m, -x + 1.5, -z + 1.5, x - 1.5, -z + t - 1.5, h, 361, 1.0);
  }
  if (fine) {
    for (const [axis, sign, plane, u0, u1, n] of [
      ['z', 1, z, -x + 1.0, x - 1.0, 7],
      ['z', -1, -z, -x + 1.0, x - 1.0, 7],
      ['x', 1, x, -z + 1.0, z - 1.0, 5],
      ['x', -1, -x, -z + 1.0, z - 1.0, 5],
      // And the same again onto the court.
      ['z', -1, z - t, -x + t + 0.8, x - t - 0.8, 4],
      ['z', 1, -z + t, -x + t + 0.8, x - t - 0.8, 4],
      ['x', -1, x - t, -z + t + 0.8, z - t - 0.8, 3],
      ['x', 1, -x + t, -z + t + 0.8, z - t - 0.8, 3],
    ] as const) {
      windowGrid(m, { axis, sign, plane }, u0, u1,
        { floors, floorH, base: 1.1, count: n, width: 2.0, height: 2.3, sill: false });
    }
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0,
      { width: 3.2, height: 3.2, double: true, glazed: true, canopy: 2.6 });
    m.windowRow({ axis: 'z', sign: 1, plane: z, from: -x + 1.2, to: -2.6, y0: 0.8, y1: 3.4,
      count: 4, width: 2.4, glass: MAT.SHOPFRONT, frame: 0.11, proud: 0.07 });
    m.windowRow({ axis: 'z', sign: 1, plane: z, from: 2.6, to: x - 1.2, y0: 0.8, y1: 3.4,
      count: 4, width: 2.4, glass: MAT.SHOPFRONT, frame: 0.11, proud: 0.07 });
    boxSign(m, { axis: 'z', sign: 1, plane: z }, -3.6, 3.6, 4.2, 5.4);
    frontage(m, -x, x, z + 1.2, 363, { planters: 3, bollards: 10, depth: 2.4 });
  }
  return m;
}

// ----------------------------------------------------------------- studio

/** A converted-look creative studio: brick base, clad upper, sawtooth roof. */
function studio(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 24.0, d = 15.0;
  const lower = 4.4, upper = 4.0;
  const h = lower + upper;
  const x = w / 2, z = d / 2;
  const teeth = 4;

  m.box([-x, 0, -z], [x, lower, z], MAT.BRICK);
  m.box([-x, lower, -z], [x, h, z], MAT.CLADDING, { roof: MAT.TRIM });

  if (medium) {
    band(m, -x, -z, x, z, lower, 0.4, 0.3);
    // Sawtooth roof. The teeth divide the depth, not the width: each is a
    // slope rising to a vertical glazed face that looks north, and it is that
    // repeated profile against the sky that names the building type.
    const step = (z * 2) / teeth;
    for (let i = 0; i < teeth; i++) {
      const z0 = -z + i * step;
      const z1 = z0 + step;
      m.quad([-x, h, z1], [x, h, z1], [x, h + 2.2, z0 + 0.22], [-x, h + 2.2, z0 + 0.22], MAT.ROOF);
      m.box([-x, h, z0], [x, h + 2.2, z0 + 0.22], MAT.GLASS);
      m.box([-x - 0.12, h + 2.1, z0 - 0.12], [x + 0.12, h + 2.4, z0 + 0.34], MAT.TRIM);
      m.painted(TINT.METAL_DARK, () => {
        for (const sx of [-1, 1] as const) {
          m.quad([sx * x, h, z1], [sx * x, h + 2.2, z0 + 0.22], [sx * x, h + 2.2, z0],
                 [sx * x, h, z0], MAT.TRIM);
        }
      });
    }
    m.box([-x - 0.35, h - 0.3, -z - 0.35], [x + 0.35, h, z + 0.35], MAT.TRIM);
    roofClutter(m, -x + 3, -z + 3, x - 3, z - 3, h, 371, 0.6);
  }
  if (fine) {
    // Big industrial-style openings to the brick base.
    for (const [axis, sign, plane, u0, u1, n] of [
      ['z', 1, z, -x + 1.0, x - 5.6, 4],
      ['z', -1, -z, -x + 1.0, x - 1.0, 5],
      ['x', 1, x, -z + 1.2, z - 1.2, 3],
      ['x', -1, -x, -z + 1.2, z - 1.2, 3],
    ] as const) {
      m.windowRow({ axis, sign, plane, from: u0, to: u1, y0: 1.1, y1: 3.7,
        count: n, width: 2.2, glass: MAT.GLASS, frame: 0.16, proud: 0.07 });
    }
    // Ribbon window right round the clad upper storey.
    for (const [axis, sign, plane, u0, u1] of [
      ['z', 1, z, -x + 0.8, x - 0.8], ['z', -1, -z, -x + 0.8, x - 0.8],
      ['x', 1, x, -z + 0.8, z - 0.8], ['x', -1, -x, -z + 0.8, z - 0.8],
    ] as const) {
      m.opening({ axis, sign, plane, u0, u1, y0: lower + 1.0, y1: lower + 3.0,
        glass: MAT.GLASS, frame: 0.13, proud: 0.06 });
    }
    entrance(m, { axis: 'z', sign: 1, plane: z }, x - 3.2,
      { width: 2.2, height: 2.9, double: true, glazed: true, canopy: 1.8 });
    fasciaSign(m, { axis: 'z', sign: 1, plane: z }, x - 7.2, x - 1.2, lower + 3.4, lower + 4.4);
    frontage(m, -x, x, z, 373, { planters: 3, bollards: 9 });
  }
  return m;
}

// ------------------------------------------------------------- civic office

/** Council offices: stone base, a colonnade, a flag and a wide flight of steps. */
function civicOffice(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 26.0, d = 16.0;
  const base = 5.8;
  const floors = 3, floorH = 4.0;
  const h = base + floors * floorH;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], MAT.STONE, { roof: MAT.ROOF });
  // Centre bay stepped forward and up.
  m.box([-6.0, 0, z - 0.3], [6.0, h + 2.6, z + 1.6], MAT.STONE, { roof: MAT.ROOF });

  if (medium) {
    band(m, -x, -z, x, z, base, 0.7, 0.4);
    band(m, -x, -z, x, z, h - 1.2, 0.8, 0.5);
    parapet(m, -x, -z, x, z, h, 1.2, 0.3);
    parapet(m, -6.0, z - 0.3, 6.0, z + 1.6, h + 2.6, 1.0, 0.36);
    // Colonnade across the centre bay.
    for (let i = 0; i < 6; i++) {
      const cx = -5.0 + i * 2.0;
      m.cylinder(cx, z + 2.6, 0.42, base + 0.3, h - 1.6, 10, MAT.STONE, false);
      m.box([cx - 0.58, h - 1.6, z + 2.0], [cx + 0.58, h - 1.2, z + 3.2], MAT.STONE);
      m.box([cx - 0.58, base, z + 2.0], [cx + 0.58, base + 0.3, z + 3.2], MAT.STONE);
    }
    m.box([-6.2, h - 1.2, z + 1.6], [6.2, h - 0.7, z + 3.4], MAT.STONE);
    // Flag on the roof, and the wide flight of steps at the front.
    m.painted(TINT.METAL_DARK, () => m.box([-0.12, h + 3.6, z + 0.5], [0.12, h + 10.0, z + 0.74], MAT.TRIM));
    m.painted(TINT.ACCENT, () => m.box([0.12, h + 7.8, z + 0.56], [2.6, h + 9.6, z + 0.66], MAT.TRIM));
    for (let i = 0; i < 7; i++) {
      m.box([-8.0, i * 0.17, z + 3.4 + i * 0.34], [8.0, (i + 1) * 0.17, z + 6.0], MAT.STONE);
    }
    roofClutter(m, -x + 3, -z + 2, x - 3, z - 4, h, 381, 0.5);
  }
  if (fine) {
    // Tall arched-feeling windows, deep reveals, on all four sides.
    for (const [axis, sign, plane, u0, u1, n] of [
      ['z', 1, z, -x + 1.4, -7.0, 3], ['z', 1, z, 7.0, x - 1.4, 3],
      ['z', -1, -z, -x + 1.4, x - 1.4, 8],
      ['x', 1, x, -z + 1.4, z - 1.4, 5],
      ['x', -1, -x, -z + 1.4, z - 1.4, 5],
    ] as const) {
      windowGrid(m, { axis, sign, plane }, u0, u1,
        { floors, floorH, base: base + 1.0, count: n, width: 1.5, height: 2.6 });
    }
    windowGrid(m, { axis: 'z', sign: 1, plane: z }, -x + 1.4, -7.0,
      { floors: 1, floorH, base: 1.4, count: 3, width: 1.5, height: 2.6 });
    windowGrid(m, { axis: 'z', sign: 1, plane: z }, 7.0, x - 1.4,
      { floors: 1, floorH, base: 1.4, count: 3, width: 1.5, height: 2.6 });
    for (let f = 0; f < floors; f++) {
      m.opening({ axis: 'z', sign: 1, plane: z + 1.6, u0: -4.6, u1: 4.6,
        y0: base + f * floorH + 0.9, y1: base + f * floorH + 3.1,
        glass: MAT.GLASS, frame: 0.16, proud: 0.07 });
    }
    entrance(m, { axis: 'z', sign: 1, plane: z + 1.6 }, 0,
      { width: 3.4, height: 4.0, double: true, steps: 2 });
    boxSign(m, { axis: 'z', sign: 1, plane: z + 1.6 }, -3.0, 3.0, base + 0.1, base + 0.9);
    railing(m, -8.0, 8.0, z + 6.0, 0, 1.0, 1.6);
    frontage(m, -x, x, z + 6.0, 383, { planters: 4, bollards: 10, depth: 2.4 });
  }
  return m;
}

// ------------------------------------------------------------ curtain slab

/** A 1960s curtain-wall slab on a recessed base: the office nobody photographs. */
function curtainSlab(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 30.0, d = 13.0;
  const base = 5.0;
  const floors = 12, floorH = 3.4;
  const h = base + floors * floorH;
  const x = w / 2, z = d / 2;

  // The slab overhangs a recessed, glazed ground floor -- the whole idea.
  m.box([-x + 1.6, 0, -z + 1.4], [x - 1.6, base, z - 1.4], MAT.CONCRETE, { roof: MAT.TRIM });
  m.box([-x, base, -z], [x, h, z], MAT.GLASS, { roof: MAT.ROOF });

  if (medium) {
    m.box([-x - 0.5, base - 0.6, -z - 0.5], [x + 0.5, base, z + 0.5], MAT.CONCRETE);
    // Spandrel band at every floor, and a mullion every 1.8 m.
    for (let f = 1; f <= floors; f++) {
      band(m, -x, -z, x, z, base + f * floorH - 1.1, 1.1, 0.14, MAT.PLASTER);
    }
    const bays = Math.round(w / 1.8);
    for (let i = 0; i <= bays; i++) {
      const px = -x + (i / bays) * w;
      m.box([px - 0.08, base, z - 0.02], [px + 0.08, h, z + 0.16], MAT.TRIM);
      m.box([px - 0.08, base, -z - 0.16], [px + 0.08, h, -z + 0.02], MAT.TRIM);
    }
    for (const sx of [-1, 1] as const) {
      // Solid end walls: a slab glazed on all four sides reads as a fish tank.
      m.box([Math.min(sx * x, sx * x - sx * 0.5), base, -z - 0.1],
            [Math.max(sx * x, sx * x - sx * 0.5), h + 1.6, z + 0.1], MAT.CONCRETE, { roof: MAT.ROOF });
    }
    parapet(m, -x, -z, x, z, h, 1.0, 0.26);
    m.box([-4.0, h + 1.0, -3.0], [4.0, h + 4.2, 3.0], MAT.CONCRETE, { roof: MAT.ROOF });
    roofClutter(m, -x + 5, -z + 2, x - 5, z - 2, h, 391, 1.2);
  }
  if (fine) {
    for (let f = 0; f < floors; f++) {
      const y = base + f * floorH + 0.3;
      for (const [sign, plane] of [[1, z], [-1, -z]] as const) {
        m.opening({ axis: 'z', sign, plane, u0: -x + 0.7, u1: x - 0.7, y0: y, y1: y + floorH - 1.4,
          glass: MAT.GLASS, frame: 0.09, proud: 0.05 });
      }
    }
    for (const [sign, plane] of [[1, z - 1.4], [-1, -z + 1.4]] as const) {
      m.windowRow({ axis: 'z', sign, plane, from: -x + 2.2, to: x - 2.2, y0: 0.7, y1: 4.2,
        count: 8, width: 2.6, glass: MAT.SHOPFRONT, frame: 0.11, proud: 0.07 });
    }
    entrance(m, { axis: 'z', sign: 1, plane: z - 1.4 }, 0,
      { width: 3.2, height: 3.2, double: true, glazed: true, canopy: 1.6 });
    // Columns holding the overhang up, which is the point of the recess.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 7; i++) {
        const px = -x + 2.2 + i * 4.3;
        m.box([px - 0.22, 0, z - 0.6], [px + 0.22, base - 0.6, z - 0.16], MAT.TRIM);
      }
    });
    boxSign(m, { axis: 'z', sign: 1, plane: z - 1.4 }, -4.0, 4.0, 4.3, 5.3);
    frontage(m, -x, x, z, 393, { planters: 4, bollards: 12, depth: 2.4 });
  }
  return m;
}

// ------------------------------------------------------------- data centre

/** Almost blind, all plant: the building type a modern city cannot do without. */
function dataCentre(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 28.0, d = 20.0, h = 12.0;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], MAT.CLADDING, { roof: MAT.TRIM });
  m.box([-x - 0.3, 0, -z - 0.3], [x + 0.3, 2.4, z + 0.3], MAT.CONCRETE);

  if (medium) {
    for (let y = 4.2; y < h - 0.5; y += 3.0) band(m, -x, -z, x, z, y, 0.16, 0.1, MAT.PLASTER);
    m.box([-x - 0.5, h - 0.6, -z - 0.5], [x + 0.5, h, z + 0.5], MAT.TRIM);
    // Cooling on the roof, in a screened compound: the silhouette of the type.
    m.painted(TINT.METAL_DARK, () => {
      m.box([-x + 2.0, h, -z + 2.0], [x - 2.0, h + 0.3, z - 2.0], MAT.TRIM);
      for (let i = 0; i < 6; i++) {
        const cx = -x + 3.4 + i * 3.8;
        m.box([cx, h + 0.3, -z + 3.0], [cx + 3.0, h + 2.4, z - 3.0], MAT.TRIM);
        for (let j = 0; j < 3; j++) {
          m.cylinder(cx + 1.5, -z + 4.6 + j * 4.0, 1.1, h + 2.4, h + 3.0, 10, MAT.TRIM);
        }
      }
      for (let i = 0; i <= 12; i++) {
        const px = -x + 1.6 + i * (w - 3.2) / 12;
        m.box([px - 0.07, h + 0.3, -z + 1.6], [px + 0.07, h + 3.4, -z + 1.74], MAT.TRIM);
        m.box([px - 0.07, h + 0.3, z - 1.74], [px + 0.07, h + 3.4, z - 1.6], MAT.TRIM);
      }
    });
    // Generator yard and transformers alongside.
    m.box([x, 0.001, -z + 2.0], [x + 6.0, 0.12, z - 2.0], MAT.CONCRETE);
    for (let i = 0; i < 3; i++) {
      m.box([x + 1.0, 0.12, -z + 3.2 + i * 4.6], [x + 4.4, 3.0, -z + 6.4 + i * 4.6], MAT.METAL);
    }
    roofClutter(m, -x + 1, -z + 0.8, x - 1, -z + 1.6, h, 401, 0.4);
  }
  if (fine) {
    // Glazed entrance corner is the only opening in the whole envelope.
    m.box([-x, 0, z - 0.2], [-x + 8.0, 5.4, z + 2.4], MAT.GLASS, { roof: MAT.TRIM });
    parapet(m, -x, z - 0.2, -x + 8.0, z + 2.4, 5.4, 0.7, 0.24);
    m.windowRow({ axis: 'z', sign: 1, plane: z + 2.4, from: -x + 0.6, to: -x + 7.4, y0: 0.8, y1: 4.2,
      count: 3, width: 2.0, glass: MAT.SHOPFRONT, frame: 0.12, proud: 0.07 });
    entrance(m, { axis: 'x', sign: -1, plane: -x }, z + 1.1,
      { width: 1.8, height: 2.6, double: true, glazed: true, canopy: 1.6 });
    boxSign(m, { axis: 'z', sign: 1, plane: z + 2.4 }, -x + 1.6, -x + 6.4, 4.4, 5.3);
    // Louvre bands where the air comes in, and a personnel door on the flank.
    m.painted(TINT.METAL_DARK, () => {
      for (const [sign, plane] of [[1, z], [-1, -z]] as const) {
        for (let i = 0; i < 5; i++) {
          const a = -x + 9.5 + i * 3.6;
          for (let j = 0; j < 5; j++) {
            m.box([a, 3.0 + j * 0.34, plane - (sign > 0 ? 0.0 : 0.16)],
                  [a + 2.6, 3.24 + j * 0.34, plane + (sign > 0 ? 0.16 : 0.0)], MAT.TRIM);
          }
        }
      }
    });
    entrance(m, { axis: 'z', sign: -1, plane: -z }, 0, { width: 1.4, height: 2.3, double: true });
    // Security fence round the generator yard.
    railing(m, x, x + 6.0, z - 2.0, 0, 2.2, 1.6);
    kerb(m, -x, z + 2.4, x + 6.0, z + 2.8);
  }
  return m;
}

export const OFFICE: AssetDef[] = [
  { id: 'off.park', name: 'Business park unit', zone: 'office', density: 'low', variant: 'sculpted', footprint: [4, 3], height: 8.5, brand: BRANDS.engineering, sim: desk(45, 70), note: 'Two storeys with brick end bays, glazed entrance box, car park bays.', build: parkUnit },
  { id: 'off.midrise', name: 'Mid-rise offices', zone: 'office', density: 'medium', variant: 'sculpted', footprint: [2, 3], height: 28, brand: BRANDS.legal, sim: desk(160, 190), note: 'Expressed floor bands, glazed lobby, canopy over a double entrance.', build: midRise },
  { id: 'off.hq', name: 'Corporate headquarters', zone: 'office', density: 'high', variant: 'sculpted', footprint: [4, 5], height: 51, brand: BRANDS.consultancy, sim: desk(420, 430), note: 'Glass slab between two solid cores, podium, forecourt with planting.', build: corporateHQ },
  { id: 'off.tower', name: 'Office tower', zone: 'office', density: 'high', variant: 'sculpted', footprint: [3, 4], height: 112, brand: BRANDS.software, sim: desk(900, 820), note: 'Full-height corner mullions, crown and mast, deep glazed base.', build: officeTower },
  { id: 'off.conversion', name: 'Warehouse conversion', zone: 'office', density: 'medium', variant: 'sculpted', footprint: [3, 3], height: 20, brand: BRANDS.media, sim: desk(110, 130), note: 'Old brick warehouse, tall industrial openings, glazed rooftop extension.', build: conversion },
  { id: 'off.deco', name: 'Deco office tower', zone: 'office', density: 'high', variant: 'sculpted', footprint: [3, 4], height: 87.0, brand: BRANDS.sports, sim: desk(560, 520), note: 'Masonry tower in three setback stages, piers the full height, stepped crown and mast.', build: decoTower },
  { id: 'off.campus', name: 'Tech campus', zone: 'office', density: 'low', variant: 'sculpted', footprint: [5, 4], height: 12.4, brand: BRANDS.pharma, sim: desk(180, 210), note: 'Two glazed wings around a planted court, linked by a first-floor bridge.', build: techCampus },
  { id: 'off.atrium', name: 'Atrium block', zone: 'office', density: 'medium', variant: 'sculpted', footprint: [4, 4], height: 14.8, brand: BRANDS.travel, sim: desk(220, 240), note: 'Four wings round a glazed courtyard, expressed floor bands, glazed lobby.', build: atriumBlock },
  { id: 'off.studio', name: 'Creative studio', zone: 'office', density: 'low', variant: 'sculpted', footprint: [4, 3], height: 11.0, brand: BRANDS.studioco, sim: desk(70, 90), note: 'Brick base with tall industrial openings, clad upper storey, sawtooth north light.', build: studio },
  { id: 'off.civic', name: 'Civic offices', zone: 'office', density: 'medium', variant: 'sculpted', footprint: [4, 4], height: 20.4, brand: BRANDS.architects, sim: desk(200, 130), note: 'Stone block with a columned centre bay, wide flight of steps, flag on the roof.', build: civicOffice },
  { id: 'off.slab', name: 'Curtain-wall slab', zone: 'office', density: 'high', variant: 'sculpted', footprint: [4, 3], height: 47.4, brand: BRANDS.electronics, sim: desk(480, 460), note: 'Glazed slab overhanging a recessed ground floor on columns, solid end walls.', build: curtainSlab },
  { id: 'off.data', name: 'Data centre', zone: 'office', density: 'medium', variant: 'sculpted', footprint: [5, 4], height: 15.4, brand: BRANDS.hosting, sim: desk(40, 900), note: 'Blind clad envelope, louvre bands, screened cooling compound and a generator yard.', build: dataCentre },
];

void ring;
