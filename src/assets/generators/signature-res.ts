/**
 * Signature housing: the eight residential buildings a city is known by.
 *
 * Not the top of the density ladder -- that is `housing.ts`, and its job is to
 * be repeated. These are the ones there is one of: the twin towers on the
 * skyline, the terraced ziggurat everybody photographs, the warehouse the
 * waterfront was rebuilt around. A spawner places at most one of each, and it
 * places it where it will be seen.
 *
 * Each is written to a different structural idea rather than a different size,
 * because size is the one thing that does not distinguish a landmark: two
 * hundred metres of glass looks like two hundred metres of glass. What reads
 * from a kilometre away is the silhouette, and from the street it is the base.
 * So every one of these has an answer to both.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import {
  balconyStack, barrelVault, crownStack, curtain, forecourt, flags, loft, pierWall,
  plan, porteCochere, scaled, shelf, cap,
} from './signature-parts';
import { band, parapet, planter, railing, roofClutter, shopfront, entrance } from '../parts';
import { tree, hedge } from './landscape';
import { figure } from './vehicles';

// --------------------------------------------------------------- 1. the twins

/**
 * Two slender towers on one podium, tied by a sky bridge.
 *
 * The pair is the point: a single tower of the same floor area is a stick, and
 * two of three-quarters the width read as a gateway from every direction but
 * one. The bridge is what makes them one building rather than two, and it is
 * placed two-thirds up, where it is clear of the podium and still under the
 * crowns.
 */
function twinTowers(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const floorH = 3.3, floors = 34;
  const hx = 9.5, hz = 12.0, gap = 17.0;

  forecourt(m, -46, -34, 46, 34, 4211, { trees: 6, lamps: 6, people: 8, benches: 3 });

  // The podium: two storeys of frontage the towers stand on, so the ground
  // floor belongs to the street rather than to the towers.
  m.box([-40, 0.1, -20], [40, 8.6, 20], MAT.CONCRETE, { roof: MAT.ROOF });
  if (medium) {
    for (const [sign, pz] of [[1, 20], [-1, -20]] as const) {
      shopfront(m, { axis: 'z', sign, plane: pz }, -36, 36, { bays: 12, head: 4.4, fascia: 1.1 });
    }
    band(m, -40, -20, 40, 20, 8.0, 0.7, 0.35, MAT.TRIM);
    m.box([-38, 5.0, -20.4], [38, 7.8, 20.4], MAT.GLASS);
  }
  parapet(m, -40, -20, 40, 20, 8.6, 1.0, 0.25, MAT.CONCRETE);
  if (fine) roofClutter(m, -34, -16, 34, 16, 8.6, 77, 0.5);

  for (const s of [-1, 1]) {
    const cx = s * (gap / 2 + hx);
    m.box([cx - hx, 8.6, -hz], [cx + hx, 8.6 + floors * floorH, hz], MAT.GLASS);
    if (medium) {
      curtain(m, cx - hx, -hz, cx + hx, hz, 8.6, floors, floorH, { mullions: 3.0 });
      // The service core expressed as a solid slab on the inner face: the one
      // move that stops a glass tower being a fish tank.
      m.box([cx - hx * 0.34, 8.6, -hz - 0.5], [cx + hx * 0.34, 8.6 + floors * floorH + 2.4, -hz + 0.4], MAT.CLADDING);
      m.painted(TINT.BRAND, () => {
        m.box([cx - hx * 0.3, 8.6, -hz - 0.62], [cx + hx * 0.3, 8.6 + floors * floorH, -hz - 0.52], MAT.CLADDING);
      });
    }
    if (fine) {
      balconyStack(m, cx - hx + 0.6, cx + hx - 0.6, hz, 1, 12.0, floors - 3, floorH,
        { depth: 1.5, bays: 3 });
    }
    m.placed(cx, 0, 0, () => {
      crownStack(m, hx, hz, 8.6 + floors * floorH, 3, MAT.CLADDING,
        { mast: s > 0 ? 16 : 11, taper: 0.82 });
    });
  }
  if (medium) {
    // The sky bridge.
    const y = 8.6 + floors * floorH * 0.66;
    m.box([-gap / 2 - 1, y, -5.5], [gap / 2 + 1, y + 7.2, 5.5], MAT.GLASS);
    m.painted(TINT.METAL_DARK, () => {
      m.box([-gap / 2 - 1.3, y - 0.7, -5.9], [gap / 2 + 1.3, y, 5.9], MAT.TRIM, { skipBottom: false });
      m.box([-gap / 2 - 1.3, y + 7.2, -5.9], [gap / 2 + 1.3, y + 7.9, 5.9], MAT.TRIM);
      for (let i = 0; i <= 5; i++) {
        const x = -gap / 2 + (i / 5) * gap;
        m.box([x - 0.13, y, -5.95], [x + 0.13, y + 7.2, -5.85], MAT.TRIM);
        m.box([x - 0.13, y, 5.85], [x + 0.13, y + 7.2, 5.95], MAT.TRIM);
      }
    });
  }
  if (fine) {
    porteCochere(m, -9, 9, 20.4, 6.5, 5.6, 4);
    flags(m, -34, -14, 22.5, 0.2, 4, 8.0);
    for (const s of [-1, 1]) planter(m, s * 26, 24.0, 2.2, 0.7);
  }
  return m;
}

// ------------------------------------------------------------ 2. the terraces

/**
 * A planted ziggurat: every floor set back from the one below, all four sides.
 *
 * The whole building is one rule applied nineteen times, and it produces the
 * only residential silhouette that is unmistakable in plan, in elevation and
 * from the air. The setback is what makes it work as housing too: each flat
 * gets the roof of the one below as a garden, so the mass is green rather
 * than glazed.
 */
function terraceGardens(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const floors = 19, floorH = 3.4;
  const hx0 = 30.0, hz0 = 24.0, step = 1.15;

  forecourt(m, -40, -34, 40, 34, 913, { trees: 7, lamps: 6, people: 7, benches: 3 });
  m.box([-hx0 - 2, 0.1, -hz0 - 2], [hx0 + 2, 5.4, hz0 + 2], MAT.CONCRETE, { roof: MAT.ROOF });
  if (medium) {
    for (const [sign, pz] of [[1, hz0 + 2], [-1, -hz0 - 2]] as const) {
      shopfront(m, { axis: 'z', sign, plane: pz }, -hx0 + 2, hx0 - 2, { bays: 9, head: 4.0 });
    }
  }

  for (let f = 0; f < floors; f++) {
    const hx = hx0 - f * step, hz = hz0 - f * step;
    const y = 5.4 + f * floorH;
    m.box([-hx, y, -hz], [hx, y + floorH, hz], MAT.CONCRETE, { roof: MAT.ROOF });
    if (medium) {
      // The slab edge oversails, and the glazing sits behind it. That order is
      // what gives the stack its horizontal shadow lines.
      m.box([-hx - 0.55, y + floorH - 0.42, -hz - 0.55], [hx + 0.55, y + floorH, hz + 0.55], MAT.CONCRETE);
    }
    if (fine) {
      for (const [sign, pz] of [[1, hz], [-1, -hz]] as const) {
        m.windowRow({
          axis: 'z', sign, plane: pz, from: -hx + 1.2, to: hx - 1.2,
          y0: y + 0.5, y1: y + floorH - 0.65, count: Math.max(3, Math.round(hx / 3.4)),
          width: 2.5, glass: MAT.PANE, frame: 0.1, proud: 0.06,
        });
      }
      for (const [sign, px] of [[1, hx], [-1, -hx]] as const) {
        m.windowRow({
          axis: 'x', sign, plane: px, from: -hz + 1.2, to: hz - 1.2,
          y0: y + 0.5, y1: y + floorH - 0.65, count: Math.max(2, Math.round(hz / 3.6)),
          width: 2.5, glass: MAT.PANE, frame: 0.1, proud: 0.06,
        });
      }
    }
    if (fine && f > 0) {
      // The terrace that the setback leaves: planting along its front edge and
      // a glass balustrade round it.
      const px = hx0 - (f - 1) * step, pz = hz0 - (f - 1) * step;
      m.painted(TINT.GREEN, () => {
        m.box([-px + 0.2, y, pz - step + 0.15], [px - 0.2, y + 0.85, pz - 0.2], MAT.TRIM);
        m.box([-px + 0.2, y, -pz + 0.2], [px - 0.2, y + 0.85, -pz + step - 0.15], MAT.TRIM);
        m.box([-px + 0.2, y, -pz + step], [-px + step - 0.15, y + 0.85, pz - step], MAT.TRIM);
        m.box([px - step + 0.15, y, -pz + step], [px - 0.2, y + 0.85, pz - step], MAT.TRIM);
      });
      m.box([-px, y, pz - 0.1], [px, y + 1.05, pz], MAT.GLASS);
      m.box([-px, y, -pz], [px, y + 1.05, -pz + 0.1], MAT.GLASS);
    }
  }
  const topY = 5.4 + floors * floorH;
  const hxT = hx0 - floors * step;
  if (medium) {
    m.painted(TINT.GREEN, () => m.box([-hxT + 1, topY, -hz0 + floors * step + 1], [hxT - 1, topY + 0.5, hz0 - floors * step - 1], MAT.TRIM));
    parapet(m, -hxT, -(hz0 - floors * step), hxT, hz0 - floors * step, topY, 1.05, 0.3, MAT.CONCRETE);
    roofClutter(m, -hxT + 1.5, -(hz0 - floors * step) + 1.5, hxT - 1.5, hz0 - floors * step - 1.5, topY, 61, 0.6);
  }
  if (fine) {
    for (const s of [-1, 1]) tree(m, s * 24, 30, 8.0, 2.8);
    flags(m, -12, 12, 27.0, 0.2, 3, 7.0);
  }
  return m;
}

// ---------------------------------------------------------------- 3. the wave

/**
 * A slab whose balconies swell and shrink floor by floor.
 *
 * Structurally an ordinary point-access block; what makes it a landmark is a
 * single sine term in the balcony depth, which turns a flat elevation into a
 * surface that changes with the light and the angle. The cost is nothing: the
 * balconies were going to be drawn anyway.
 */
function waveBlock(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const floors = 26, floorH = 3.3;
  const hx = 26.0, hz = 10.0;

  forecourt(m, -36, -26, 36, 26, 3307, { trees: 5, lamps: 5, people: 6, benches: 2 });
  m.box([-hx - 3, 0.1, -hz - 5], [hx + 3, 6.2, hz + 5], MAT.CONCRETE, { roof: MAT.ROOF });
  if (medium) {
    for (const [sign, pz] of [[1, hz + 5], [-1, -hz - 5]] as const) {
      shopfront(m, { axis: 'z', sign, plane: pz }, -hx, hx, { bays: 8, head: 4.2 });
    }
    band(m, -hx - 3, -hz - 5, hx + 3, hz + 5, 5.7, 0.6, 0.3, MAT.TRIM);
  }

  const top = 6.2 + floors * floorH;
  m.box([-hx, 6.2, -hz], [hx, top, hz], MAT.HOUSING);
  if (medium) {
    curtain(m, -hx, -hz, hx, hz, 6.2, floors, floorH, { spandrel: MAT.HOUSING, mullions: 4.4 });
    // The core, on the ends, in solid render: two book-ends the wave runs
    // between.
    for (const s of [-1, 1]) {
      m.box([s * hx - s * 3.2, 6.2, -hz - 0.5], [s * hx + s * 0.4, top + 3.0, hz + 0.5], MAT.RENDER);
      // A single full-height slot in each core, and a stack of landing windows
      // beside it. Twenty metres by a hundred of blank render is the one thing
      // that would sink this elevation, and the stair is what a core has.
      m.box([s * hx - s * 3.4, 8.0, -2.2], [s * hx + s * 0.6, top - 1.0, 2.2], MAT.GLASS);
      m.painted(TINT.METAL_DARK, () => {
        for (let f = 1; f < floors; f += 2) {
          m.box([s * hx - s * 3.5, 6.2 + f * floorH - 0.2, -2.4],
                [s * hx + s * 0.7, 6.2 + f * floorH + 0.15, 2.4], MAT.TRIM);
        }
      });
      for (let f = 1; f < floors; f += 2) {
        for (const pz of [-hz + 1.4, hz - 1.4]) {
          m.opening({
            axis: 'x', sign: s as 1 | -1, plane: s * hx + s * 0.4,
            u0: pz - 1.1, u1: pz + 1.1,
            y0: 6.2 + f * floorH + 0.6, y1: 6.2 + (f + 1) * floorH - 0.5,
            glass: MAT.PANE, frame: 0.1, proud: 0.07,
          });
        }
      }
    }
  }
  if (fine) {
    for (const [sign, pz] of [[1, hz], [-1, -hz]] as const) {
      balconyStack(m, -hx + 3.6, hx - 3.6, pz, sign, 9.5, floors - 2, floorH,
        { depth: 3.2, wave: sign > 0 ? 1 : 1.5, bays: 5 });
    }
  }
  if (medium) {
    parapet(m, -hx, -hz, hx, hz, top, 1.1, 0.32, MAT.RENDER);
    roofClutter(m, -hx + 4, -hz + 2, hx - 4, hz - 2, top, 43, 0.7);
    m.painted(TINT.BRAND, () => m.box([-hx - 0.2, top + 1.1, -hz - 0.2], [hx + 0.2, top + 1.9, hz + 0.2], MAT.CLADDING));
  }
  if (fine) {
    porteCochere(m, -7, 7, hz + 5.4, 5.0, 5.0, 3);
    for (const s of [-1, 1]) hedge(m, s * 20 - 5, hz + 12, s * 20 + 5, hz + 13.2, 1.0);
  }
  return m;
}

// ------------------------------------------------------------- 4. the mansions

/**
 * A pre-war mansion block: brick, deep piers, setbacks and a stone crown.
 *
 * The whole point is that it is masonry. Everything else on this list is a
 * frame with a skin hung off it, and next to them a wall that carries itself
 * -- piers three-quarters of a metre deep, windows punched into it, a base in
 * stone and a cornice at the top -- reads as a completely different kind of
 * building, which is exactly what a city with one of these looks like.
 */
function mansionBlock(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const floorH = 3.5;
  const hx = 22.0, hz = 16.0;

  forecourt(m, -34, -28, 34, 28, 7717, { trees: 6, lamps: 5, people: 6, benches: 2 });
  // A stone base, then the brick shaft, then two setbacks and a lantern.
  m.box([-hx - 0.8, 0.1, -hz - 0.8], [hx + 0.8, 7.4, hz + 0.8], MAT.STONE, { roof: MAT.ROOF });
  if (medium) {
    for (const [sign, pz] of [[1, hz + 0.8], [-1, -hz - 0.8]] as const) {
      m.windowRow({
        axis: 'z', sign, plane: pz, from: -hx + 2, to: hx - 2, y0: 1.0, y1: 5.6,
        count: 7, width: 2.6, glass: MAT.SHOPFRONT, frame: 0.16, proud: 0.08,
      });
    }
    band(m, -hx - 0.8, -hz - 0.8, hx + 0.8, hz + 0.8, 7.0, 0.75, 0.45, MAT.STONE);
  }
  if (fine) {
    entrance(m, { axis: 'z', sign: 1, plane: hz + 0.8 }, 0,
      { width: 3.4, height: 4.6, double: true, glazed: true, fanlight: true });
    porteCochere(m, -5, 5, hz + 1.2, 4.2, 5.4, 2);
  }

  pierWall(m, -hx, -hz, hx, hz, 7.4, 11, floorH, MAT.BRICK,
    { bays: 6, glass: MAT.PANE, windows: fine });
  let y = 7.4 + 11 * floorH;
  if (medium) band(m, -hx, -hz, hx, hz, y, 0.9, 0.7, MAT.STONE);
  y += 0.9;
  // Two setbacks, each losing a bay.
  for (const [sx, sz, n] of [[0.78, 0.72, 4], [0.54, 0.48, 3]] as const) {
    pierWall(m, -hx * sx, -hz * sz, hx * sx, hz * sz, y, n, floorH, MAT.BRICK,
      { bays: Math.max(2, Math.round(hx * sx / 4.2)), glass: MAT.PANE, windows: fine });
    y += n * floorH;
    if (medium) band(m, -hx * sx, -hz * sz, hx * sx, hz * sz, y, 0.7, 0.55, MAT.STONE);
    y += 0.7;
    if (fine) railing(m, -hx * sx, hx * sx, hz * sz + 0.5, y - 0.7, 0.95, 1.8);
  }
  if (medium) {
    // The lantern: stone drum, a colonnade round it, a lit cap.
    m.cylinder(0, 0, 6.2, y, y + 7.5, 12, MAT.STONE, false);
    m.painted(TINT.NONE, () => {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        m.cylinder(Math.cos(a) * 7.0, Math.sin(a) * 7.0, 0.44, y, y + 6.6, 6, MAT.STONE, false);
      }
    });
    m.cone(0, 0, 7.6, 0.0, y + 7.5, y + 15.0, 12, MAT.ROOF_TILE);
    m.painted(TINT.SIGN_LIT, () => m.cylinder(0, 0, 1.0, y + 15.0, y + 17.6, 8, MAT.PLATE, true));
  }
  if (fine) {
    parapet(m, -hx * 0.54, -hz * 0.48, hx * 0.54, hz * 0.48, y, 1.0, 0.3, MAT.STONE);
    for (const s of [-1, 1]) tree(m, s * 26, 22, 7.5, 2.6);
    flags(m, -16, 16, 19.0, 8.0, 3, 6.5);
  }
  return m;
}

// ------------------------------------------------------------ 5. the courtyard

/**
 * A perimeter block round a planted courtyard, entered through a gatehouse.
 *
 * The European move: the building is the street wall and the good side faces
 * in. What makes it a landmark rather than a big block of flats is that the
 * courtyard is public -- you can see through the arch from the street to the
 * trees, and that view is the whole design.
 */
function courtyardBlock(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const floorH = 3.3, floors = 7;
  const hx = 32.0, hz = 24.0, depth = 11.0;
  const top = 1.0 + floors * floorH;

  forecourt(m, -39, -31, 39, 31, 5501, { trees: 4, lamps: 6, people: 8, benches: 2 });
  // The courtyard floor, planted, with the ranges round it.
  m.box([-hx + depth, 0.1, -hz + depth], [hx - depth, 0.24, hz - depth], MAT.GROUND);
  const ranges: Array<[number, number, number, number]> = [
    [-hx, -hz, hx, -hz + depth], [-hx, hz - depth, hx, hz],
    [-hx, -hz + depth, -hx + depth, hz - depth], [hx - depth, -hz + depth, hx, hz - depth],
  ];
  for (const [x0, z0, x1, z1] of ranges) {
    m.box([x0, 0.1, z0], [x1, top, z1], MAT.BRICK, { roof: MAT.ROOF });
    if (medium) {
      m.box([x0 - 0.25, 0.1, z0 - 0.25], [x1 + 0.25, 1.9, z1 + 0.25], MAT.STONE);
      band(m, x0, z0, x1, z1, top - 0.9, 0.9, 0.5, MAT.STONE);
    }
    if (fine) parapet(m, x0, z0, x1, z1, top, 1.0, 0.28, MAT.STONE);
  }
  if (fine) {
    // Windows on both faces of every range.
    const punch = (axis: 'x' | 'z', sign: 1 | -1, plane: number, a: number, b: number): void => {
      for (let f = 0; f < floors; f++) {
        m.windowRow({
          axis, sign, plane, from: a, to: b, y0: 1.9 + f * floorH + 0.55, y1: 1.9 + f * floorH + 2.55,
          count: Math.max(3, Math.round((b - a) / 4.0)), width: 1.7,
          glass: MAT.PANE, frame: 0.12, proud: 0.07,
        });
      }
    };
    punch('z', -1, -hz - 0.25, -hx + 2, hx - 2);
    punch('z', 1, hz + 0.25, -hx + 2, hx - 2);
    punch('x', -1, -hx - 0.25, -hz + 2, hz - 2);
    punch('x', 1, hx + 0.25, -hz + 2, hz - 2);
    punch('z', 1, -hz + depth, -hx + depth + 2, hx - depth - 2);
    punch('z', -1, hz - depth, -hx + depth + 2, hx - depth - 2);
  }
  if (fine) {
    // The gatehouse: an arch through the south range, taller than the rest.
    m.box([-7.5, top, -hz], [7.5, top + 4.6, -hz + depth], MAT.BRICK, { roof: MAT.ROOF });
    m.box([-8.4, top + 4.0, -hz - 0.4], [8.4, top + 5.4, -hz + depth + 0.4], MAT.STONE);
    m.cone(0, -hz + depth / 2, 6.0, 0.0, top + 5.4, top + 12.0, 8, MAT.ROOF_TILE);
    // The opening itself, as a dark recess between two stone jambs.
    m.box([-3.6, 0.12, -hz - 0.3], [3.6, 6.4, -hz + depth + 0.3], MAT.DARK_TRIM);
    for (const s of [-1, 1]) {
      m.box([s * 3.6, 0.1, -hz - 0.4], [s * 4.6, 7.2, -hz + depth + 0.4], MAT.STONE);
    }
    m.box([-4.6, 6.4, -hz - 0.4], [4.6, 7.2, -hz + depth + 0.4], MAT.STONE);
    for (let i = 0; i < 6; i++) {
      const x = -20 + i * 8;
      if (Math.abs(x) < 8) continue;
      shopfront(m, { axis: 'z', sign: -1, plane: -hz - 0.25 }, x - 3.4, x + 3.4, { bays: 2, head: 3.9 });
    }
    // The courtyard: trees, hedges, benches, a fountain kerb.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) tree(m, sx * 12, sz * 8, 8.5, 3.0);
    hedge(m, -16, -11, 16, -10, 0.8);
    hedge(m, -16, 10, 16, 11, 0.8);
    m.painted(TINT.NONE, () => m.cylinder(0, 0, 3.4, 0.24, 0.9, 12, MAT.STONE, true));
    m.painted(TINT.GREEN, () => m.cylinder(0, 0, 3.0, 0.7, 0.86, 12, MAT.TRIM, true));
    for (let i = 0; i < 6; i++) figure(m, 220 + i * 9, -14 + i * 5.5, 4.0, 0.4 * i, { stride: 0.2 });
  }
  return m;
}

// ------------------------------------------------------------- 6. the stacks

/**
 * Cantilevered modules stacked off two cores.
 *
 * Every flat is a box, every box is offset from the one under it, and the
 * silhouette is the sum of those offsets -- so the building has no elevation
 * at all, only corners. It is the one shape here that reads as clearly from
 * directly above as from the street, which is worth having in a game played
 * from above.
 */
function stackedBoxes(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const unit = 7.4, uz = 8.0, floorH = 3.5;
  const rows = 12;

  forecourt(m, -34, -28, 34, 28, 8123, { trees: 6, lamps: 5, people: 7, benches: 3 });
  m.box([-26, 0.1, -18], [26, 4.6, 18], MAT.CONCRETE, { roof: MAT.ROOF });
  if (medium) {
    for (const [sign, pz] of [[1, 18], [-1, -18]] as const) {
      shopfront(m, { axis: 'z', sign, plane: pz }, -22, 22, { bays: 7, head: 3.8 });
    }
  }
  // Two cores, which is what the modules actually hang off.
  for (const s of [-1, 1]) {
    m.box([s * 15 - 3.2, 0.1, -4.4], [s * 15 + 3.2, 4.6 + rows * floorH + 3.0, 4.4], MAT.CONCRETE);
    if (medium) {
      m.box([s * 15 - 2.4, 5.0, -4.6], [s * 15 + 2.4, 4.6 + rows * floorH, -4.3], MAT.GLASS);
      m.painted(TINT.METAL_DARK, () => {
        for (let f = 1; f < rows; f++) {
          m.box([s * 15 - 3.4, 4.6 + f * floorH - 0.2, -4.7], [s * 15 + 3.4, 4.6 + f * floorH + 0.1, 4.7], MAT.TRIM);
        }
      });
    }
  }
  // The modules. Deterministic offsets, so the same building comes back every
  // time, and mirrored about the middle so it does not lean.
  for (let f = 0; f < rows; f++) {
    const y = 4.6 + f * floorH;
    const n = f % 3 === 0 ? 4 : f % 3 === 1 ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const off = ((f * 7 + i * 5) % 5) - 2;
      const cx = (i - (n - 1) / 2) * (unit + 1.2) + off * 0.9;
      const cz = ((f + i) % 3 - 1) * 2.4;
      if (Math.abs(cx) < 12.5 && Math.abs(cx) > 6.5) continue;
      m.box([cx - unit / 2, y, cz - uz / 2], [cx + unit / 2, y + floorH - 0.25, cz + uz / 2],
        MAT.CLADDING, { roof: MAT.ROOF, skipBottom: false });
      if (medium) {
        m.painted(TINT.METAL_DARK, () => {
          m.box([cx - unit / 2 - 0.14, y - 0.14, cz - uz / 2 - 0.14],
                [cx + unit / 2 + 0.14, y + 0.1, cz + uz / 2 + 0.14], MAT.TRIM);
        });
        for (const [sign, pz] of [[1, cz + uz / 2], [-1, cz - uz / 2]] as const) {
          m.opening({
            axis: 'z', sign, plane: pz, u0: cx - unit / 2 + 0.8, u1: cx + unit / 2 - 0.8,
            y0: y + 0.7, y1: y + floorH - 0.75, glass: MAT.PANE, frame: 0.1, proud: 0.06,
          });
        }
      }
      if (fine && (f + i) % 2 === 0) {
        m.box([cx - unit / 2, y, cz + uz / 2], [cx + unit / 2, y + 0.14, cz + uz / 2 + 1.8],
          MAT.CONCRETE, { skipBottom: false });
        m.box([cx - unit / 2, y + 0.14, cz + uz / 2 + 1.7], [cx + unit / 2, y + 1.2, cz + uz / 2 + 1.8], MAT.GLASS);
        m.painted(TINT.GREEN, () => {
          m.box([cx - unit / 2 + 0.3, y + 0.14, cz + uz / 2 + 0.3], [cx - unit / 2 + 1.5, y + 0.9, cz + uz / 2 + 1.5], MAT.TRIM);
        });
      }
    }
  }
  if (medium) {
    for (const s of [-1, 1]) {
      parapet(m, s * 15 - 3.2, -4.4, s * 15 + 3.2, 4.4, 4.6 + rows * floorH + 3.0, 0.9, 0.25, MAT.CONCRETE);
      roofClutter(m, s * 15 - 2.6, -3.8, s * 15 + 2.6, 3.8, 4.6 + rows * floorH + 3.0, 29 + s, 0.4);
    }
  }
  return m;
}

// -------------------------------------------------------------- 7. the wharf

/**
 * A warehouse turned into flats, with its gantries kept.
 *
 * Loading doors glazed floor to ceiling, the wall crane left in place over
 * each bay, a new storey in glass and steel set back on top. The interest is
 * the join: the old building is brick with cast-iron heads and the new one is
 * frameless, and the whole thing only works because neither pretends to be
 * the other.
 */
function wharfLofts(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 34.0, hz = 13.0, floorH = 3.9, floors = 6;
  const top = 0.9 + floors * floorH;

  forecourt(m, -42, -26, 42, 26, 2609, { trees: 4, lamps: 6, people: 6, benches: 3 });
  m.box([-hx, 0.1, -hz], [hx, 0.9, hz], MAT.STONE);
  m.box([-hx, 0.9, -hz], [hx, top, hz], MAT.BRICK, { roof: MAT.ROOF });

  const bays = 9;
  if (fine) {
    // The loading bays: a full-height glazed slot in every bay, with a brick
    // pier between, which is the warehouse's own rhythm kept.
    for (const [sign, pz] of [[1, hz], [-1, -hz]] as const) {
      for (let i = 0; i < bays; i++) {
        const c = -hx + ((i + 0.5) / bays) * hx * 2;
        for (let f = 0; f < floors; f++) {
          m.opening({
            axis: 'z', sign, plane: pz, u0: c - 2.3, u1: c + 2.3,
            y0: 0.9 + f * floorH + 0.35, y1: 0.9 + (f + 1) * floorH - 0.45,
            glass: f === 0 ? MAT.SHOPFRONT : MAT.PANE, frame: 0.14, proud: 0.09,
          });
        }
        // The segmental brick head over each opening, as a stepped course.
        m.painted(TINT.NONE, () => {
          for (let f = 0; f < floors; f++) {
            const y = 0.9 + (f + 1) * floorH - 0.45;
            m.box([c - 2.6, y, pz - 0.16], [c + 2.6, y + 0.34, pz + 0.16], MAT.STONE);
          }
        });
      }
    }
    for (const [sign, px] of [[1, hx], [-1, -hx]] as const) {
      for (let f = 0; f < floors; f++) {
        m.windowRow({
          axis: 'x', sign, plane: px, from: -hz + 2, to: hz - 2,
          y0: 0.9 + f * floorH + 0.5, y1: 0.9 + (f + 1) * floorH - 0.6,
          count: 3, width: 2.0, glass: MAT.PANE, frame: 0.12, proud: 0.08,
        });
      }
    }
    band(m, -hx, -hz, hx, hz, top - 1.0, 1.0, 0.55, MAT.STONE);
  }
  if (fine) {
    // The wall cranes, one per third bay, left over the loading slot.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 1; i < bays; i += 3) {
        const c = -hx + ((i + 0.5) / bays) * hx * 2;
        m.box([c - 0.34, top - 3.2, hz], [c + 0.34, top - 2.4, hz + 3.4], MAT.TRIM);
        m.box([c - 0.5, top - 4.2, hz - 0.3], [c + 0.5, top - 2.4, hz + 0.4], MAT.TRIM);
        m.pipe([c, top - 2.6, hz + 3.2], [c, top - 6.4, hz + 3.2], 0.05, MAT.TRIM, 4);
        m.box([c - 0.35, top - 7.0, hz + 2.85], [c + 0.35, top - 6.4, hz + 3.55], MAT.TRIM);
      }
    });
  }
  // The new storeys: glass, set back, on a steel frame.
  if (medium) {
    curtain(m, -hx + 3.5, -hz + 2.5, hx - 3.5, hz - 2.5, top + 0.5, 2, 3.6,
      { mullions: 3.4 });
    m.painted(TINT.METAL_DARK, () => {
      m.box([-hx + 3.2, top + 0.5 + 7.2, -hz + 2.2], [hx - 3.2, top + 1.5 + 7.2, hz - 2.2], MAT.TRIM);
    });
    parapet(m, -hx, -hz, hx, hz, top, 0.95, 0.3, MAT.STONE);
    roofClutter(m, -hx + 2, -hz + 1, -hx + 12, hz - 1, top, 83, 0.5);
  }
  if (fine) {
    for (let i = 0; i < 3; i++) planter(m, -20 + i * 20, hz + 4.4, 1.6, 0.65);
    hedge(m, -hx, hz + 7.5, hx, hz + 8.6, 0.9);
    flags(m, -10, 10, -hz - 4.5, 0.2, 3, 7.0);
  }
  return m;
}

// -------------------------------------------------------------- 8. the spire

/**
 * A super-slim residential spire: a needle with a tuned mass damper on top.
 *
 * The proportion is the whole building -- twelve metres across and two hundred
 * and thirty tall -- and it only stands up in a game because everything round
 * it is eight-metre cells. It is drawn as a tapering ring rather than a stack
 * of boxes so the taper is continuous, and the top forty metres are open
 * structure, which is what real ones do to let the wind through.
 */
function residentialSpire(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const N = 16, floorH = 3.6, floors = 52;
  const base = plan(7.6, 8.6, 0.22, N);

  forecourt(m, -28, -26, 28, 26, 9601, { trees: 5, lamps: 5, people: 6, benches: 2 });
  m.box([-16, 0.1, -14], [16, 9.0, 14], MAT.STONE, { roof: MAT.ROOF });
  if (medium) {
    for (const [sign, pz] of [[1, 14], [-1, -14]] as const) {
      shopfront(m, { axis: 'z', sign, plane: pz }, -13, 13, { bays: 5, head: 5.2, fascia: 1.2 });
    }
    band(m, -16, -14, 16, 14, 8.2, 0.8, 0.4, MAT.STONE);
  }

  // The shaft, as a loft between rings that shrink with height.
  const at = (f: number): number => 1.0 - 0.30 * (f / floors) * (f / floors);
  for (let f = 0; f < floors; f++) {
    const a = scaled(base, at(f)), b = scaled(base, at(f + 1));
    const y0 = 9.0 + f * floorH, y1 = y0 + floorH;
    loft(m, a, b, y0, y1, MAT.GLASS);
    if (medium) {
      // A slab band at every floor and a deep reveal every sixth: the reveals
      // are the amenity floors, and they break the shaft into sections you can
      // read the height of.
      const deep = f % 6 === 0;
      const r = scaled(base, at(f) * (deep ? 1.06 : 1.03));
      shelf(m, scaled(base, at(f) * 0.99), r, y0 - 0.02, y0 + (deep ? 0.85 : 0.42), MAT.CONCRETE);
      if (deep && fine) {
        loft(m, scaled(base, at(f) * 0.99), scaled(base, at(f) * 0.99), y0 + 0.85, y0 + 2.0, MAT.DARK_TRIM);
      }
    }
  }
  const topY = 9.0 + floors * floorH;
  const topR = scaled(base, at(floors));
  if (medium) {
    // The open crown: two storeys of frame with nothing in them, then a cap.
    shelf(m, scaled(topR, 0.99), scaled(topR, 1.08), topY, topY + 1.0, MAT.CONCRETE);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < N; i += 2) {
        const p = topR[i];
        m.pipe([p[0], topY + 1.0, p[1]], [p[0], topY + 15.0, p[1]], 0.28, MAT.TRIM, 4);
      }
      for (const y of [topY + 5.0, topY + 10.0, topY + 15.0]) {
        shelf(m, scaled(topR, 0.94), scaled(topR, 1.02), y, y + 0.5, MAT.TRIM);
      }
    });
    cap(m, scaled(topR, 1.02), topY + 15.5, MAT.ROOF);
    m.painted(TINT.SIGN_LIT, () => {
      m.box([-1.4, topY + 15.5, -1.4], [1.4, topY + 18.0, 1.4], MAT.PLATE);
    });
    m.painted(TINT.METAL_DARK, () => {
      m.cylinder(0, 0, 0.3, topY + 18.0, topY + 30.0, 6, MAT.TRIM, false);
      m.cylinder(0, 0, 0.14, topY + 30.0, topY + 40.0, 5, MAT.TRIM, false);
    });
  }
  if (fine) {
    porteCochere(m, -6, 6, 14.4, 5.0, 6.2, 3);
    barrelVault(m, -13, 15.0, 13, 24.0, 5.0, 3.4, 8, { ribs: 5 });
    for (const s of [-1, 1]) tree(m, s * 20, 18, 7.0, 2.4);
  }
  return m;
}

// ====================================================================== table

const homes = (n: number, upkeep: number): AssetDef['sim'] => ({
  households: n, powerKW: 4.6 * n, waterM3: 0.9 * n,
  garbagePerWeek: 16 * n, pollution: 1, upkeep,
});

export const SIGNATURE_RESIDENTIAL: AssetDef[] = [
  {
    id: 'sig.res.twin', name: 'Meridian Towers', zone: 'residential', density: 'high',
    variant: 'sculpted', theme: 'modern', signature: true, footprint: [13, 10], height: 0,
    brand: { name: 'Meridian', colour: [0.18, 0.32, 0.46], accent: [0.72, 0.60, 0.28], sign: 'box' },
    sim: homes(430, 1180),
    note: 'Two thirty-four storey glass shafts on a two-storey retail podium, tied at the twenty-second floor by a glazed sky bridge; expressed cores on the inner faces, balconies on the outer, and a mast on the taller crown.',
    build: twinTowers,
  },
  {
    id: 'sig.res.terraces', name: 'Terrace Gardens', zone: 'residential', density: 'high',
    variant: 'sculpted', theme: 'modern', signature: true, footprint: [10, 9], height: 0,
    brand: { name: 'Terrace Gardens', colour: [0.22, 0.38, 0.26], accent: [0.70, 0.62, 0.36], sign: 'box' },
    sim: homes(310, 900),
    note: 'A nineteen-storey ziggurat set back on all four sides at every floor, each setback planted and glazed to the deck, over a retail base.',
    build: terraceGardens,
  },
  {
    id: 'sig.res.wave', name: 'The Wave', zone: 'residential', density: 'high',
    variant: 'sculpted', theme: 'modern', signature: true, footprint: [10, 8], height: 0,
    brand: { name: 'The Wave', colour: [0.16, 0.36, 0.50], accent: [0.74, 0.68, 0.40], sign: 'box' },
    sim: homes(280, 820),
    note: 'A twenty-six storey slab whose balcony depth follows a sine floor by floor, so the elevation swells and thins; solid render cores at both ends and a shopfront base.',
    build: waveBlock,
  },
  {
    id: 'sig.res.mansions', name: 'Ashfield Mansions', zone: 'residential', density: 'high',
    variant: 'sculpted', theme: 'american', signature: true, footprint: [9, 7], height: 0,
    brand: { name: 'Ashfield', colour: [0.36, 0.20, 0.18], accent: [0.66, 0.58, 0.34], sign: 'box' },
    sim: homes(190, 640),
    note: 'Pre-war masonry: a stone base, eleven storeys of deep brick piers with punched windows, two setbacks with roof terraces, and a colonnaded stone lantern under a lead cap.',
    build: mansionBlock,
  },
  {
    id: 'sig.res.court', name: 'Cloister Court', zone: 'residential', density: 'medium',
    variant: 'sculpted', theme: 'european', signature: true, footprint: [10, 8], height: 0,
    brand: { name: 'Cloister Court', colour: [0.30, 0.24, 0.20], accent: [0.64, 0.58, 0.40], sign: 'fascia' },
    sim: homes(160, 520),
    note: 'A seven-storey perimeter block round a planted courtyard, entered through a gatehouse arch under a spired pavilion, with shops in the street elevation.',
    build: courtyardBlock,
  },
  {
    id: 'sig.res.stacks', name: 'The Stacks', zone: 'residential', density: 'high',
    variant: 'sculpted', theme: 'modern', signature: true, footprint: [9, 8], height: 0,
    brand: { name: 'The Stacks', colour: [0.42, 0.34, 0.22], accent: [0.30, 0.46, 0.52], sign: 'box' },
    sim: homes(150, 560),
    note: 'Twelve rows of cantilevered modules hung off two concrete cores, every box offset from the one below so the building has corners instead of elevations; planted roof terraces on half of them.',
    build: stackedBoxes,
  },
  {
    id: 'sig.res.wharf', name: 'Wharf Lofts', zone: 'residential', density: 'medium',
    variant: 'sculpted', theme: 'european', signature: true, footprint: [11, 7], height: 0,
    brand: { name: 'Wharf Lofts', colour: [0.38, 0.26, 0.18], accent: [0.56, 0.58, 0.60], sign: 'fascia' },
    sim: homes(120, 430),
    note: 'A six-storey brick warehouse converted: loading slots glazed floor to ceiling under segmental heads, the wall cranes left over every third bay, and two set-back storeys of glass and steel added on top.',
    build: wharfLofts,
  },
  {
    id: 'sig.res.spire', name: 'Solstice Point', zone: 'residential', density: 'high',
    variant: 'sculpted', theme: 'modern', signature: true, footprint: [7, 7], height: 0,
    brand: { name: 'Solstice', colour: [0.20, 0.24, 0.34], accent: [0.74, 0.64, 0.30], sign: 'box' },
    sim: homes(210, 940),
    note: 'A twelve-metre-wide residential needle: fifty-two storeys on a continuously tapering plan, a deep amenity reveal every sixth floor, forty metres of open structural crown and a mast on top of that.',
    build: residentialSpire,
  },
];
