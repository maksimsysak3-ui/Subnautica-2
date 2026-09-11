/**
 * Signature commerce: the six places a city goes rather than shops at.
 *
 * The commercial ladder in `trade.ts` is parades, supermarkets and retail
 * sheds -- the buildings that fill a high street. These are the ones a high
 * street is built around: the covered arcade, the department store on the
 * corner, the market hall, the mall, the grand hotel, the picture house. Each
 * is a public interior with a roof over it, and the roof is the design: a
 * barrel vault, a dome, a saw-tooth, a glazed street. That is the one thing
 * none of the stock commercial assets has, and it is why a city with these in
 * it reads as a city rather than a retail park.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import { THEME_ORDER } from '../themes';
import type { Theme } from '../themes';
import {
  barrelVault, campanile, curtain, flags, forecourt, loft, marquee,
  pierWall, plan, porteCochere, sawtooth, scaled, shelf,
} from './signature-parts';
import {
  awning, band, bladeSign, entrance, parapet, planter, railing,
  roofClutter, shopfront,
} from '../parts';
import { hedge, bench, tree } from './landscape';
import { figure } from './vehicles';

// ----------------------------------------------------------------- 1. arcade

/**
 * A nineteenth-century shopping arcade: two ranges either side of a glazed
 * street, with a stone screen at each end.
 *
 * The oldest covered retail there is and still the best-looking: the shops are
 * ordinary, the roof is the building. Drawn as a real interior -- you can see
 * down the arcade through both screens -- because a vault with a solid wall
 * under it is just a shed with a curved lid.
 */
function arcade(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 40.0, hz = 15.0, aisle = 6.5, floorH = 4.2;
  const top = 0.9 + 3 * floorH;

  forecourt(m, -48, -26, 48, 26, 1607, { trees: 5, lamps: 6, people: 9, benches: 3 });
  m.box([-hx, 0.1, -hz], [hx, 0.5, hz], MAT.STONE);

  for (const s of [-1, 1]) {
    const z0 = s > 0 ? aisle : -hz, z1 = s > 0 ? hz : -aisle;
    m.box([-hx, 0.5, z0], [hx, top, z1], MAT.STONE, { roof: MAT.ROOF });
    if (medium) {
      // Street elevation: shops below, two floors of stone above with a
      // cornice. Arcade elevation: the same shops facing in.
      shopfront(m, { axis: 'z', sign: s as 1 | -1, plane: s > 0 ? hz : -hz }, -hx + 2, hx - 2,
        { bays: 12, head: 4.4, fascia: 1.0 });
      shopfront(m, { axis: 'z', sign: -s as 1 | -1, plane: s > 0 ? aisle : -aisle }, -hx + 4, hx - 4,
        { bays: 10, head: 3.9, fascia: 0.9 });
      for (let f = 1; f < 3; f++) {
        for (const [sign, pz] of [[s as 1 | -1, s > 0 ? hz : -hz], [-s as 1 | -1, s > 0 ? aisle : -aisle]] as const) {
          m.windowRow({
            axis: 'z', sign, plane: pz, from: -hx + 3, to: hx - 3,
            y0: 0.9 + f * floorH + 0.7, y1: 0.9 + (f + 1) * floorH - 0.7,
            count: 11, width: 1.9, glass: MAT.PANE, frame: 0.13, proud: 0.08,
          });
        }
      }
      band(m, -hx, z0, hx, z1, top - 1.2, 1.2, 0.65, MAT.STONE);
    }
    if (fine) {
      parapet(m, -hx, z0, hx, z1, top, 1.1, 0.3, MAT.STONE);
      for (let i = 0; i < 6; i++) {
        awning(m, { axis: 'z', sign: s as 1 | -1, plane: s > 0 ? hz : -hz },
          -hx + 4 + i * 12, -hx + 12 + i * 12, 3.5, 1.8);
      }
      bladeSign(m, { axis: 'z', sign: s as 1 | -1, plane: s > 0 ? hz : -hz }, -12 * s, 4.9, 8.2, 1.6);
    }
  }

  // The vault over the aisle, and the two end screens under it.
  if (medium) barrelVault(m, -hx, -aisle, hx, aisle, top - 1.0, 7.5, 9, { ribs: 9 });
  for (const s of [-1, 1]) {
    m.box([s * hx - s * 1.2, 0.5, -aisle - 1.4], [s * hx, top + 4.0, aisle + 1.4], MAT.STONE);
    if (medium) {
      // The screen: a big arched opening with a keystone and a lit clock.
      m.box([s * hx - s * 1.4, 8.6, -aisle + 0.6], [s * hx + s * 0.2, top + 3.4, aisle - 0.6], MAT.GLASS);
      m.painted(TINT.NONE, () => {
        for (const pz of [-aisle - 0.2, aisle + 0.2]) {
          m.box([s * hx - s * 1.6, 0.5, pz - 0.9], [s * hx + s * 0.4, top + 4.6, pz + 0.9], MAT.STONE);
        }
        m.box([s * hx - s * 1.6, top + 4.0, -aisle - 1.6], [s * hx + s * 0.4, top + 5.4, aisle + 1.6], MAT.STONE);
      });
      m.painted(TINT.SIGN_LIT, () => {
        m.cylinder(s * hx + s * 0.42, 0, 1.7, top + 4.8, top + 5.0, 12, MAT.PLATE, true);
      });
    }
    if (fine) {
      entrance(m, { axis: 'x', sign: s as 1 | -1, plane: s * hx }, 0,
        { width: 5.0, height: 6.6, double: true, glazed: true, fanlight: true });
    }
  }
  if (fine) {
    // The arcade floor: paving, planters, benches and people in it.
    m.painted(TINT.NONE, () => m.box([-hx + 1, 0.5, -aisle + 0.4], [hx - 1, 0.62, aisle - 0.4], MAT.STONE));
    for (let i = 0; i < 5; i++) planter(m, -30 + i * 15, 0, 1.2, 0.6);
    for (let i = 0; i < 4; i++) bench(m, -26 + i * 17, 3.4, 0);
    for (let i = 0; i < 10; i++) {
      figure(m, 3100 + i * 17, -34 + i * 7.5, -3.0 + (i % 3) * 2.4, i % 2 ? 0 : Math.PI, { stride: 0.22 });
    }
  }
  if (medium) {
    // The campanile over the entrance.
    //
    // An arcade is a hundred metres of two-storey shopfront and a glass roof,
    // which is a lovely thing to walk down and completely invisible from the
    // next street. Every real one of these has a tower on the corner where it
    // meets the street, and that is what makes it a place people navigate by
    // rather than a building people are surprised to find.
    campanile(m, -hx + 7.0, hz - 6.0, 4.2, 34.0, MAT.STONE,
      { belfry: 7.0, cap: 'dome', clock: true, tint: TINT.NONE });
  }
  return m;
}

// ------------------------------------------------------------ 2. the emporium

/**
 * A department store on a corner, with a dome over the corner and a clock in
 * it.
 *
 * The corner is the whole design. A department store occupies a block end, and
 * the way it announces itself is by rounding that corner, running the shop
 * windows all the way round it, and putting the tallest thing it has directly
 * over the junction. Everything else is a well-behaved stone box.
 */
function emporium(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 30.0, hz = 24.0, floorH = 4.6, floors = 5;
  const top = 1.0 + floors * floorH;
  const N = 20;

  forecourt(m, -38, -32, 38, 32, 4801, { trees: 4, lamps: 6, people: 10, benches: 2 });
  // The mass, with the corner cut off and a drum standing in the notch.
  m.box([-hx, 0.1, -hz], [hx, top, hz], MAT.STONE, { roof: MAT.ROOF });
  const drum = plan(11.0, 11.0, 1.0, N);
  const cx = hx - 7.5, cz = hz - 7.5;
  m.placed(cx, cz, 0, () => {
    loft(m, drum, drum, 0.1, top + 3.0, MAT.STONE);
  });

  if (medium) {
    shopfront(m, { axis: 'z', sign: 1, plane: hz }, -hx + 2, hx - 16, { bays: 8, head: 5.4, fascia: 1.4 });
    shopfront(m, { axis: 'z', sign: -1, plane: -hz }, -hx + 2, hx - 2, { bays: 10, head: 5.4, fascia: 1.4 });
    shopfront(m, { axis: 'x', sign: -1, plane: -hx }, -hz + 2, hz - 2, { bays: 8, head: 5.4, fascia: 1.4 });
    shopfront(m, { axis: 'x', sign: 1, plane: hx }, -hz + 2, hz - 16, { bays: 6, head: 5.4, fascia: 1.4 });
    for (let f = 1; f < floors; f++) {
      const y = 1.0 + f * floorH;
      for (const [axis, sign, pln, a, b, n] of [
        ['z', 1, hz, -hx + 3, hx - 16, 7],
        ['z', -1, -hz, -hx + 3, hx - 3, 9],
        ['x', -1, -hx, -hz + 3, hz - 3, 7],
        ['x', 1, hx, -hz + 3, hz - 16, 5],
      ] as const) {
        m.windowRow({
          axis, sign, plane: pln, from: a, to: b, y0: y + 0.8, y1: y + floorH - 0.9,
          count: n, width: 2.4, glass: MAT.PANE, frame: 0.15, proud: 0.09,
        });
      }
    }
    band(m, -hx, -hz, hx, hz, top - 1.4, 1.4, 0.8, MAT.STONE);
    // The corner: shop window all the way round the drum, then stone above.
    m.placed(cx, cz, 0, () => {
      loft(m, scaled(drum, 1.01), scaled(drum, 1.01), 0.9, 6.4, MAT.SHOPFRONT);
      m.painted(TINT.BRAND, () => shelf(m, scaled(drum, 1.0), scaled(drum, 1.08), 6.4, 7.9, MAT.CLADDING));
      for (let f = 1; f < floors; f++) {
        loft(m, scaled(drum, 1.005), scaled(drum, 1.005),
          1.0 + f * floorH + 0.8, 1.0 + (f + 1) * floorH - 0.9, MAT.PANE);
      }
      shelf(m, scaled(drum, 1.0), scaled(drum, 1.1), top - 1.4, top, MAT.STONE);
      // The dome, as three stacked cones, with a lantern and a flag on it.
      m.cone(0, 0, 11.2, 9.0, top + 3.0, top + 7.0, N, MAT.ROOF_TILE);
      m.cone(0, 0, 9.0, 4.4, top + 7.0, top + 12.5, N, MAT.ROOF_TILE);
      m.cone(0, 0, 4.4, 0.0, top + 12.5, top + 16.0, N, MAT.ROOF_TILE);
      m.painted(TINT.SIGN_LIT, () => {
        // The clock face, on the drum under the dome.
        for (const [ax, az] of [[1, 0], [0, 1]] as const) {
          m.cylinder(ax * 11.2, az * 11.2, 2.6, top - 6.6, top - 6.4, 12, MAT.PLATE, true);
        }
      });
      m.painted(TINT.METAL_DARK, () => m.cylinder(0, 0, 0.16, top + 16.0, top + 22.0, 5, MAT.TRIM, false));
      m.painted(TINT.ACCENT, () => m.box([0.12, top + 18.4, -0.03], [2.4, top + 21.4, 0.03], MAT.TRIM));
    });
  }
  if (fine) {
    parapet(m, -hx, -hz, hx, hz, top, 1.2, 0.35, MAT.STONE);
    roofClutter(m, -hx + 3, -hz + 3, hx - 18, hz - 18, top, 55, 0.7);
    for (let i = 0; i < 7; i++) {
      awning(m, { axis: 'z', sign: -1, plane: -hz }, -hx + 3 + i * 8, -hx + 9 + i * 8, 4.4, 2.0);
    }
    marquee(m, -hx + 4, hx - 18, hz + 0.4, 1, top - 8.0, 2.6);
    porteCochere(m, -12, -2, hz + 0.5, 5.0, 6.4, 3);
    flags(m, -hx + 4, hx - 18, hz + 1.4, top, 5, 7.0);
  }
  return m;
}

// ------------------------------------------------------------- 3. market hall

/**
 * A market hall: one saw-tooth-roofed volume on brick arcading, with the
 * stalls inside visible through it.
 *
 * The only building in the library whose roof is the north-light saw-tooth,
 * which is worth a landmark on its own: nothing else has that profile and it
 * is legible from directly above, which is where this game is played from.
 */
function marketHall(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 34.0, hz = 22.0, wall = 11.5;

  forecourt(m, -42, -32, 42, 32, 6203, { trees: 4, lamps: 6, people: 11, benches: 4 });
  m.box([-hx, 0.1, -hz], [hx, 0.7, hz], MAT.STONE);
  // The arcading: piers with deep openings between them on all four sides, so
  // the market is open to the street it stands on.
  const piers = 11, pz = 7;
  m.box([-hx, 0.7, -hz], [hx, wall, hz], MAT.BRICK, { roof: MAT.ROOF });
  m.box([-hx + 1.6, 0.7, -hz + 1.6], [hx - 1.6, wall - 1.4, hz - 1.6], MAT.DARK_TRIM);
  if (medium) {
    for (let i = 0; i <= piers; i++) {
      const x = -hx + (i / piers) * hx * 2;
      m.box([x - 1.5, 0.7, -hz - 0.3], [x + 1.5, wall + 0.4, -hz + 1.8], MAT.BRICK);
      m.box([x - 1.5, 0.7, hz - 1.8], [x + 1.5, wall + 0.4, hz + 0.3], MAT.BRICK);
    }
    for (let i = 0; i <= pz; i++) {
      const z = -hz + (i / pz) * hz * 2;
      m.box([-hx - 0.3, 0.7, z - 1.5], [-hx + 1.8, wall + 0.4, z + 1.5], MAT.BRICK);
      m.box([hx - 1.8, 0.7, z - 1.5], [hx + 0.3, wall + 0.4, z + 1.5], MAT.BRICK);
    }
    // A stone impost and a segmental head over every bay.
    band(m, -hx, -hz, hx, hz, 7.4, 0.35, 0.42, MAT.STONE);
    band(m, -hx, -hz, hx, hz, wall - 0.9, 0.9, 0.55, MAT.STONE);
  }
  if (medium) {
    sawtooth(m, -hx + 0.5, -hz + 0.5, hx - 0.5, hz - 0.5, wall + 0.4, 6, 4.6, MAT.METAL);
    // A brick gable wall wrapping the saw-tooth at both ends, so it reads as
    // a roof on a building rather than a comb balanced on one.
    for (const s of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const w = (hz * 2 - 1) / 6;
        const a = -hz + 0.5 + i * w;
        const px = s * (hx - 0.2);
        const A: [number, number, number] = [px, wall + 0.4, a];
        const B: [number, number, number] = [px, wall + 5.0, a + w * 0.75];
        const C: [number, number, number] = [px, wall + 0.4, a + w];
        if (s > 0) m.tri(A, B, C, MAT.BRICK); else m.tri(C, B, A, MAT.BRICK);
      }
      m.box([s * (hx - 0.5), wall - 0.6, -hz], [s * (hx + 0.1), wall + 1.2, hz], MAT.BRICK);
    }
  }
  if (fine) {
    // The stalls: two rows of canopied tables down the hall.
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < 7; i++) {
        const x = -28 + i * 9.4, z = r === 0 ? -9.0 : 9.0;
        m.painted(TINT.METAL_DARK, () => {
          for (const sx of [-3.4, 3.4]) for (const sz of [-2.4, 2.4]) {
            m.cylinder(x + sx, z + sz, 0.08, 0.7, 3.0, 4, MAT.TRIM, false);
          }
        });
        m.painted(i % 3 === 0 ? TINT.BRAND : i % 3 === 1 ? TINT.ACCENT : TINT.AWNING, () => {
          m.box([x - 3.8, 3.0, z - 2.8], [x + 3.8, 3.35, z + 2.8], MAT.TRIM);
        });
        m.painted(TINT.WOOD, () => m.box([x - 3.2, 0.7, z - 1.1], [x + 3.2, 1.55, z + 1.1], MAT.TIMBER));
        m.painted(TINT.NONE, () => m.box([x - 3.0, 1.55, z - 1.0], [x + 3.0, 1.85, z + 1.0], MAT.TIMBER));
      }
    }
    for (let i = 0; i < 12; i++) {
      figure(m, 4400 + i * 13, -30 + i * 5.4, (i % 3 - 1) * 5.0, i % 2 ? 1.2 : 4.4, { stride: 0.22 });
    }
    for (const s of [-1, 1]) {
      marquee(m, s * 18 - 8, s * 18 + 8, hz + 0.4, 1, wall + 0.6, 2.2);
    }
    for (let i = 0; i < 4; i++) planter(m, -24 + i * 16, hz + 4.0, 1.4, 0.6);
  }
  if (medium) {
    // The market cross: the tower every market square is laid out around.
    campanile(m, 0, hz + 9.0, 3.2, 26.0, MAT.STONE,
      { belfry: 5.6, cap: 'pyramid', clock: true, tint: TINT.NONE });
  }
  return m;
}

// ---------------------------------------------------------------- 4. the mall

/**
 * A shopping centre: two retail wings either side of a glazed mall, with a
 * rotunda where they cross and a deck of parking behind.
 *
 * The suburban one, and it needs the car park to be honest -- a mall without
 * one is a high street. The parking is a real deck with ramps and cars on it
 * rather than a painted rectangle, because from above it is half the building.
 */
function shoppingMall(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 46.0, hz = 20.0, wing = 13.0, wall = 12.5;

  forecourt(m, -56, -46, 56, 30, 7109, { trees: 6, lamps: 8, people: 10, benches: 3 });
  m.box([-hx, 0.1, -hz], [hx, 0.6, hz], MAT.CONCRETE);
  for (const s of [-1, 1]) {
    const z0 = s > 0 ? hz - wing : -hz, z1 = s > 0 ? hz : -hz + wing;
    m.box([-hx, 0.6, z0], [hx, wall, z1], MAT.CLADDING, { roof: MAT.ROOF });
    if (medium) {
      m.box([-hx - 0.4, 0.6, z0 - (s > 0 ? 0 : 0.4)], [hx + 0.4, 6.0, z1 + (s > 0 ? 0.4 : 0)], MAT.STONE);
      shopfront(m, { axis: 'z', sign: -s as 1 | -1, plane: s > 0 ? hz - wing : -hz + wing },
        -hx + 4, hx - 4, { bays: 12, head: 5.0, fascia: 1.2 });
      m.painted(TINT.BRAND, () => {
        m.box([-hx - 0.5, wall - 2.2, s > 0 ? hz - 0.1 : -hz - 0.5],
              [hx + 0.5, wall, s > 0 ? hz + 0.5 : -hz + 0.1], MAT.CLADDING);
      });
      // Upper deck of the mall, seen through the vault: a balcony each side.
      m.box([-hx + 3, 6.2, s > 0 ? hz - wing - 4.5 : -hz + wing],
            [hx - 3, 6.6, s > 0 ? hz - wing : -hz + wing + 4.5], MAT.CONCRETE, { skipBottom: false });
      railing(m, -hx + 3, hx - 3, s > 0 ? hz - wing - 4.5 : -hz + wing + 4.5, 6.6, 1.1, 2.2);
      shopfront(m, { axis: 'z', sign: -s as 1 | -1, plane: s > 0 ? hz - wing : -hz + wing },
        -hx + 5, hx - 5, { bays: 10, head: 4.4, fascia: 1.0, sill: 0 });
    }
    if (fine) parapet(m, -hx, z0, hx, z1, wall, 1.0, 0.3, MAT.CONCRETE);
  }
  if (medium) {
    barrelVault(m, -hx, -(hz - wing), hx, hz - wing, wall - 3.0, 6.0, 8, { ribs: 10 });
    // The rotunda over the crossing.
    const N = 18;
    const drum = plan(14.0, 14.0, 1.0, N);
    loft(m, drum, drum, 0.6, wall + 4.0, MAT.GLASS);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < N; i++) {
        const p = drum[i];
        m.pipe([p[0], 0.6, p[1]], [p[0], wall + 4.0, p[1]], 0.28, MAT.TRIM, 4);
      }
      shelf(m, scaled(drum, 0.98), scaled(drum, 1.06), wall + 4.0, wall + 5.0, MAT.TRIM);
    });
    m.cone(0, 0, 14.6, 2.0, wall + 5.0, wall + 13.0, N, MAT.GLASS);
    m.painted(TINT.SIGN_LIT, () => m.cylinder(0, 0, 2.2, wall + 13.0, wall + 15.4, 10, MAT.PLATE, true));
  }
  if (fine) {
    // The car deck: two levels on columns, with a ramp up the side.
    for (let lvl = 0; lvl < 2; lvl++) {
      const y = 0.6 + lvl * 3.6;
      m.box([-hx + 6, y, -hz - 24], [hx - 6, y + 0.5, -hz - 1.5], MAT.CONCRETE, { skipBottom: false });
      m.painted(TINT.NONE, () => {
        for (let i = 0; i < 26; i++) {
          const x = -hx + 7 + i * 2.9;
          m.box([x - 0.07, y + 0.5, -hz - 23], [x + 0.07, y + 0.52, -hz - 18], MAT.PLATE);
          m.box([x - 0.07, y + 0.5, -hz - 12], [x + 0.07, y + 0.52, -hz - 7], MAT.PLATE);
        }
      });
      railing(m, -hx + 6, hx - 6, -hz - 24, y + 0.5, 1.0, 2.6);
      m.painted(TINT.METAL_DARK, () => {
        for (let i = 0; i <= 8; i++) {
          const x = -hx + 6 + (i / 8) * (hx * 2 - 12);
          for (const z of [-hz - 22, -hz - 4]) m.cylinder(x, z, 0.28, 0.1, y, 6, MAT.TRIM, false);
        }
      });
    }
    porteCochere(m, -11, 11, hz + 0.6, 6.5, 6.6, 4);
    marquee(m, -20, 20, hz + 0.8, 1, wall + 0.4, 3.0);
    flags(m, -34, 34, hz + 5.0, 0.2, 6, 9.0);
    for (let i = 0; i < 4; i++) hedge(m, -40 + i * 24, hz + 9.0, -28 + i * 24, hz + 10.2, 0.9);
  }
  return m;
}

// ----------------------------------------------------------------- 5. a hotel

/**
 * A grand hotel: a stone base, a brick shaft, a mansard, and a canopy over the
 * door with flags over that.
 *
 * The one building type where the entrance is the whole front. Nine tenths of
 * what makes a hotel look like a hotel happens in the bottom eight metres --
 * the canopy, the drum lamps, the doorman's island, the flags -- and it is all
 * at the scale a player is closest to.
 */
function grandHotel(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 24.0, hz = 17.0, floorH = 3.4, floors = 14;
  const base = 8.0;
  const top = base + floors * floorH;

  forecourt(m, -34, -30, 34, 30, 3313, { trees: 5, lamps: 6, people: 8, benches: 2 });
  m.box([-hx - 1.2, 0.1, -hz - 1.2], [hx + 1.2, base, hz + 1.2], MAT.STONE, { roof: MAT.ROOF });
  if (medium) {
    for (const [axis, sign, pln, a, b, n] of [
      ['z', 1, hz + 1.2, -hx + 3, hx - 3, 6],
      ['z', -1, -hz - 1.2, -hx + 3, hx - 3, 7],
      ['x', -1, -hx - 1.2, -hz + 3, hz - 3, 5],
      ['x', 1, hx + 1.2, -hz + 3, hz - 3, 5],
    ] as const) {
      m.windowRow({
        axis, sign, plane: pln, from: a, to: b, y0: 1.4, y1: 6.2,
        count: n, width: 3.0, glass: MAT.SHOPFRONT, frame: 0.2, proud: 0.1,
      });
    }
    band(m, -hx - 1.2, -hz - 1.2, hx + 1.2, hz + 1.2, base - 1.0, 1.0, 0.6, MAT.STONE);
  }
  pierWall(m, -hx, -hz, hx, hz, base, floors, floorH, MAT.BRICK,
    { bays: 8, glass: MAT.PANE, windows: fine, depth: 0.22 });
  if (medium) {
    band(m, -hx, -hz, hx, hz, top, 1.3, 0.85, MAT.STONE);
    // A mansard with dormers, which is the roof this building type has.
    m.cone(0, 0, 1.0, 0.72, top + 1.3, top + 7.0, 4, MAT.ROOF_TILE);
    m.box([-hx * 0.72, top + 7.0, -hz * 0.72], [hx * 0.72, top + 8.0, hz * 0.72], MAT.ROOF);
  }
  if (fine) {
    // Dormers in the mansard.
    for (let i = 0; i < 7; i++) {
      const x = -hx + 4 + i * ((hx * 2 - 8) / 6);
      for (const sz of [-1, 1]) {
        const z = sz * (hz - 1.6);
        m.box([x - 1.1, top + 1.3, z - 0.6], [x + 1.1, top + 4.2, z + 0.6], MAT.ROOF_TILE);
        m.opening({
          axis: 'z', sign: sz as 1 | -1, plane: z + sz * 0.6, u0: x - 0.75, u1: x + 0.75,
          y0: top + 1.9, y1: top + 3.7, glass: MAT.PANE, frame: 0.1, proud: 0.06,
        });
      }
    }
    parapet(m, -hx * 0.72, -hz * 0.72, hx * 0.72, hz * 0.72, top + 8.0, 0.8, 0.25, MAT.TRIM);
    roofClutter(m, -hx * 0.6, -hz * 0.6, hx * 0.6, hz * 0.6, top + 8.0, 91, 0.5);
    // The entrance: canopy, revolving door, a lit name over it, flags above.
    porteCochere(m, -10, 10, hz + 1.4, 7.0, 6.0, 4);
    entrance(m, { axis: 'z', sign: 1, plane: hz + 1.2 }, 0,
      { width: 4.2, height: 4.4, double: true, glazed: true, fanlight: true });
    marquee(m, -13, 13, hz + 1.6, 1, base + 0.2, 2.4);
    flags(m, -16, 16, hz + 8.8, 6.0, 5, 7.5);
    m.painted(TINT.METAL_DARK, () => {
      for (const sx of [-11.5, 11.5]) {
        m.cylinder(sx, hz + 4.0, 0.22, 0.1, 4.2, 8, MAT.TRIM, false);
        m.box([sx - 0.5, 4.2, hz + 3.5], [sx + 0.5, 5.2, hz + 4.5], MAT.LAMP);
      }
    });
    for (let i = 0; i < 6; i++) figure(m, 5200 + i * 11, -8 + i * 3.4, hz + 6.5, Math.PI, { stride: 0.2 });
  }
  return m;
}

// ---------------------------------------------------------------- 6. a cinema

/**
 * A picture house: a blank auditorium box behind a tall lit fin and a marquee.
 *
 * Almost the whole building is a windowless volume, which is the design
 * problem and also the opportunity -- everything is spent on the twelve metres
 * of frontage, and the fin carries the name up above the roofline where it can
 * be read down the street.
 */
function pictureHouse(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 26.0, hz = 21.0;

  forecourt(m, -34, -30, 34, 30, 2707, { trees: 4, lamps: 6, people: 9, benches: 2 });
  // The auditoria: a stepped box, tall at the screen end, low over the foyer.
  m.box([-hx, 0.1, -hz], [hx, 20.0, hz - 9.0], MAT.CLADDING, { roof: MAT.ROOF });
  m.box([-hx, 0.1, hz - 9.5], [hx, 9.5, hz], MAT.STONE, { roof: MAT.ROOF });
  if (medium) {
    // The rake of the auditorium expressed on both flanks: three stepped
    // buttresses, which is the one honest clue to what is inside.
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        m.box([s * hx - s * 0.1, 0.1, -hz + 2.0 + i * 6.5],
              [s * hx + s * 1.3, 20.0 - i * 3.6, -hz + 6.0 + i * 6.5], MAT.CONCRETE);
      }
    }
    band(m, -hx, -hz, hx, hz - 9.0, 19.0, 1.0, 0.5, MAT.CONCRETE);
    // The foyer, glazed the full width.
    curtain(m, -hx + 1.5, hz - 9.3, hx - 1.5, hz - 0.2, 0.6, 2, 4.2, { mullions: 2.8 });
  }
  if (fine) {
    parapet(m, -hx, -hz, hx, hz - 9.0, 20.0, 1.0, 0.3, MAT.CONCRETE);
    roofClutter(m, -hx + 3, -hz + 3, hx - 3, hz - 12, 20.0, 37, 0.9);
    // The marquee: a deep lit canopy with a sign band under it and bulbs round
    // the edge.
    m.painted(TINT.BRAND, () => {
      m.box([-16.5, 5.6, hz - 0.2], [16.5, 8.4, hz + 5.6], MAT.CLADDING, { skipBottom: false });
    });
    m.painted(TINT.SIGN_LIT, () => {
      for (const [a, b, p, sg] of [[-16, 16, hz + 5.62, 1], [-16, 16, hz - 0.22, -1]] as const) {
        if (sg > 0) m.signFace([a, 6.2, p], [b, 6.2, p], [b, 7.9, p], [a, 7.9, p], MAT.TRIM);
        else m.signFace([b, 6.2, p], [a, 6.2, p], [a, 7.9, p], [b, 7.9, p], MAT.TRIM);
      }
      for (let i = 0; i < 22; i++) {
        const x = -16 + (i / 21) * 32;
        m.box([x - 0.22, 5.3, hz + 5.4], [x + 0.22, 5.7, hz + 5.8], MAT.LAMP);
      }
    });
    m.painted(TINT.METAL_DARK, () => {
      for (const sx of [-15.5, 15.5]) m.pipe([sx, 8.3, hz + 5.2], [sx, 13.0, hz + 0.2], 0.12, MAT.TRIM, 4);
    });
    // The fin: a tower of sign standing above the parapet.
    m.painted(TINT.BRAND, () => m.box([-2.6, 5.6, hz + 1.0], [2.6, 31.0, hz + 2.6], MAT.CLADDING));
    m.painted(TINT.SIGN_LIT, () => {
      for (const [sx, sg] of [[2.62, 1], [-2.62, -1]] as const) {
        if (sg > 0) m.signFace([sx, 10.0, hz + 2.5], [sx, 10.0, hz + 1.1], [sx, 30.0, hz + 1.1], [sx, 30.0, hz + 2.5], MAT.TRIM);
        else m.signFace([sx, 10.0, hz + 1.1], [sx, 10.0, hz + 2.5], [sx, 30.0, hz + 2.5], [sx, 30.0, hz + 1.1], MAT.TRIM);
      }
      m.box([-1.6, 31.0, hz + 1.2], [1.6, 33.4, hz + 2.4], MAT.PLATE);
    });
    // Poster cases either side of the doors, and the box office island.
    for (const sx of [-11, -7, 7, 11]) {
      m.painted(TINT.METAL_DARK, () => m.box([sx - 1.4, 1.2, hz - 0.35], [sx + 1.4, 4.4, hz - 0.15], MAT.TRIM));
      m.painted(TINT.ACCENT, () => m.box([sx - 1.2, 1.4, hz - 0.42], [sx + 1.2, 4.2, hz - 0.34], MAT.TRIM));
    }
    m.box([-2.4, 0.6, hz + 2.6], [2.4, 3.2, hz + 4.4], MAT.GLASS);
    m.painted(TINT.BRAND_DARK, () => {
      m.box([-2.6, 0.5, hz + 2.5], [2.6, 1.3, hz + 4.5], MAT.TRIM);
      m.box([-2.6, 3.2, hz + 2.5], [2.6, 3.6, hz + 4.5], MAT.TRIM);
    });
    entrance(m, { axis: 'z', sign: 1, plane: hz }, -5.2,
      { width: 2.4, height: 3.2, double: true, glazed: true, fanlight: false });
    entrance(m, { axis: 'z', sign: 1, plane: hz }, 5.2,
      { width: 2.4, height: 3.2, double: true, glazed: true, fanlight: false });
    for (let i = 0; i < 8; i++) figure(m, 6100 + i * 19, -12 + i * 3.6, hz + 7.5, Math.PI, { stride: 0.24 });
  }
  return m;
}

// ---------------------------------------------------------- 7. night market

/**
 * A night market: two shophouse ranges over a street roofed in awning and
 * lantern.
 *
 * The East Asian answer to the arcade, and structurally its opposite -- there
 * is no vault, because the roof is a hundred separate stall canopies strung
 * between the two sides. What holds it together is the signage: every unit
 * hangs its own board across the street, and the street reads as a ceiling of
 * them.
 */
function nightMarket(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 42.0, hz = 17.0, aisle = 7.0, floorH = 3.6, floors = 4;
  const top = 0.6 + floors * floorH;

  forecourt(m, -50, -28, 50, 28, 9109, { trees: 3, lamps: 6, people: 12, benches: 2 });
  m.box([-hx, 0.1, -hz], [hx, 0.5, hz], MAT.CONCRETE);

  const units = 12, w = (hx * 2) / units;
  for (const s of [-1, 1]) {
    const z0 = s > 0 ? aisle : -hz, z1 = s > 0 ? hz : -aisle;
    m.box([-hx, 0.5, z0], [hx, top, z1], MAT.PLASTER, { roof: MAT.ROOF });
    if (medium) {
      for (let i = 0; i < units; i++) {
        const x0 = -hx + i * w, x1 = x0 + w;
        shopfront(m, { axis: 'z', sign: -s as 1 | -1, plane: s > 0 ? aisle : -aisle }, x0 + 0.5, x1 - 0.5,
          { bays: 2, head: 3.4, fascia: 0.8 });
        // A party pier past the parapet, which is what gives these terraces
        // their comb silhouette.
        m.box([x1 - 0.22, 0.5, z0 - 0.2], [x1 + 0.22, top + 1.4, z1 + 0.2], MAT.TILE);
      }
      band(m, -hx, z0, hx, z1, top - 0.6, 0.6, 0.4, MAT.TRIM);
      parapet(m, -hx, z0, hx, z1, top, 1.2, 0.3, MAT.TILE);
      shopfront(m, { axis: 'z', sign: s as 1 | -1, plane: s > 0 ? hz : -hz }, -hx + 1, hx - 1,
        { bays: 14, head: 3.8, fascia: 0.9 });
    }
    if (fine) {
      for (let i = 0; i < units; i++) {
        const x0 = -hx + i * w;
        for (let f = 1; f < floors; f++) {
          const y = 0.6 + f * floorH;
          const pz = s > 0 ? aisle : -aisle;
          m.box([x0 + 0.8, y + 0.6, pz - 0.12], [x0 + w - 0.8, y + floorH - 0.8, pz + 0.12], MAT.PANE);
          m.painted(TINT.METAL_DARK, () => {
            m.box([x0 + 0.9, y + 0.15, pz + s * 0.1], [x0 + 1.9, y + 0.8, pz + s * 0.75], MAT.TRIM);
          });
        }
        // The signboard hung out across the street, and its bracket.
        m.painted(i % 3 === 0 ? TINT.BRAND : i % 3 === 1 ? TINT.ACCENT : TINT.SIGN_LIT, () => {
          m.box([x0 + 0.6, top - 4.4, s * (aisle - 1.9)], [x0 + w - 0.6, top - 1.4, s * (aisle - 1.5)], MAT.CLADDING);
        });
        m.painted(TINT.METAL_DARK, () => {
          m.pipe([x0 + w / 2, top - 1.2, s * aisle], [x0 + w / 2, top - 4.0, s * (aisle - 1.7)], 0.07, MAT.TRIM, 4);
        });
      }
      roofClutter(m, -hx + 2, z0 + 1.5, hx - 2, z1 - 1.5, top, 71 + s, 1.0);
    }
  }
  if (fine) {
    // The street: stall canopies staggered down it, lanterns strung over, and
    // a crowd between them.
    for (let i = 0; i < 9; i++) {
      const x = -hx + 4.5 + i * 9.4;
      const s = i % 2 === 0 ? -1 : 1;
      m.painted(TINT.METAL_DARK, () => {
        for (const sx of [-2.6, 2.6]) for (const sz of [-1.8, 1.8]) {
          m.cylinder(x + sx, s * 3.2 + sz, 0.07, 0.5, 2.9, 4, MAT.TRIM, false);
        }
      });
      m.painted(i % 3 === 0 ? TINT.AWNING : i % 3 === 1 ? TINT.BRAND : TINT.ACCENT, () => {
        m.box([x - 3.1, 2.9, s * 3.2 - 2.3], [x + 3.1, 3.25, s * 3.2 + 2.3], MAT.TRIM);
      });
      m.painted(TINT.WOOD, () => m.box([x - 2.4, 0.5, s * 3.2 - 0.9], [x + 2.4, 1.4, s * 3.2 + 0.9], MAT.TIMBER));
      m.painted(TINT.NONE, () => m.box([x - 2.2, 1.4, s * 3.2 - 0.8], [x + 2.2, 1.75, s * 3.2 + 0.8], MAT.TIMBER));
    }
    m.painted(TINT.SIGN_LIT, () => {
      for (let i = 0; i < 22; i++) {
        const x = -hx + 2 + i * 3.8;
        m.cylinder(x, 0, 0.42, 6.6, 7.5, 8, MAT.PLATE, true);
      }
    });
    m.painted(TINT.METAL_DARK, () => {
      for (const pz of [-1.2, 1.2]) m.pipe([-hx, 7.5, pz], [hx, 7.5, pz], 0.05, MAT.TRIM, 4);
    });
    for (let i = 0; i < 14; i++) {
      figure(m, 7300 + i * 11, -38 + i * 5.6, (i % 3 - 1) * 2.2, i % 2 ? 1.4 : 4.6, { stride: 0.24 });
    }
    for (const s of [-1, 1]) {
      marquee(m, -12, 12, s * hz + s * 0.3, s as 1 | -1, top - 5.0, 2.6);
    }
  }
  return m;
}

// --------------------------------------------------------- 8. the leisure box

/**
 * A modern leisure block: cinema, food and a gym stacked behind one glass
 * wall, with the escalators and the media screen on the outside.
 *
 * The out-of-town multiplex, and the honest form for it: a big windowless
 * volume with everything that moves pushed onto the front. The escalator run
 * up the glazed face is what makes it read from the car park, and the media
 * wall is the only genuinely twenty-first-century thing in the library.
 */
function leisureBox(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 34.0, hz = 26.0;

  forecourt(m, -44, -40, 44, 34, 3907, { trees: 5, lamps: 8, people: 10, benches: 3 });
  // The auditoria block, stepped so the rake is visible from outside.
  // Concrete rather than cladding. CLADDING is the one material allowed a
  // saturated colour, and forty metres of it is a highlighter pen: the
  // auditorium is the quiet mass and the colour belongs on the front.
  m.box([-hx, 0.1, -hz], [hx, 22.0, hz - 11.0], MAT.CONCRETE, { roof: MAT.ROOF });
  m.box([-hx, 0.1, -hz], [hx, 15.0, -hz + 7.0], MAT.CONCRETE);
  if (medium) {
    // The glazed front, the escalator run and the deck it lands on.
    curtain(m, -hx + 1.0, hz - 11.4, hx - 1.0, hz - 0.6, 0.5, 4, 4.6, { mullions: 3.6 });
    m.painted(TINT.METAL_DARK, () => {
      m.box([-hx + 0.4, 19.0, hz - 12.0], [hx - 0.4, 20.2, hz + 0.6], MAT.TRIM, { skipBottom: false });
      for (let i = 0; i <= 8; i++) {
        const x = -hx + 1 + (i / 8) * (hx * 2 - 2);
        m.cylinder(x, hz - 0.4, 0.22, 0.1, 19.0, 6, MAT.TRIM, false);
      }
      // Two escalator runs crossing the glass.
      for (const k of [0, 1]) {
        const y0 = 0.9 + k * 4.6, y1 = y0 + 4.6;
        const a: [number, number, number] = [k === 0 ? -18 : 18, y0, hz - 1.6];
        const b: [number, number, number] = [k === 0 ? 2 : -2, y1, hz - 1.6];
        m.pipe(a, b, 0.9, MAT.TRIM, 4);
        m.pipe([a[0], a[1] + 1.2, a[2] - 0.9], [b[0], b[1] + 1.2, b[2] - 0.9], 0.08, MAT.TRIM, 4);
      }
      m.box([-hx + 1.5, 5.4, hz - 5.4], [hx - 1.5, 5.7, hz - 1.0], MAT.TRIM, { skipBottom: false });
      m.box([-hx + 1.5, 10.0, hz - 5.4], [hx - 1.5, 10.3, hz - 1.0], MAT.TRIM, { skipBottom: false });
    });
  }
  if (medium) {
    // The halo. The building is named after it and did not have one: a lit
    // ring twenty metres across standing over the roof on four masts, which
    // is the only part of this that anybody will describe to anybody else.
    const R = 19.0, SEG = 24, ry = 33.0;
    m.painted(TINT.SIGN_LIT, () => {
      for (let i = 0; i < SEG; i++) {
        const a = (i / SEG) * Math.PI * 2, b = ((i + 1) / SEG) * Math.PI * 2;
        m.pipe([Math.cos(a) * R, ry, Math.sin(a) * R - 5.0],
               [Math.cos(b) * R, ry, Math.sin(b) * R - 5.0], 0.85, MAT.PLATE, 5);
      }
    });
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        m.cylinder(Math.cos(a) * R, Math.sin(a) * R - 5.0, 0.42, 22.0, ry, 6, MAT.TRIM, false);
      }
    });
    // The two flanks, which were forty metres of blank concrete each. A
    // multiplex has its plant and its fire escapes down the side, so that is
    // what goes there -- ribbed bays with a stair tower standing off each one.
    for (const sx of [-1, 1] as const) {
      m.painted(TINT.METAL_DARK, () => {
        for (let i = 0; i < 7; i++) {
          const z = -hz + 2.5 + i * 2.1;
          m.box([sx * hx - sx * 0.1, 2.0, z - 0.45], [sx * hx + sx * 0.55, 21.0, z + 0.45], MAT.TRIM);
        }
      });
      m.box([sx * hx - sx * 0.2, 0.1, -hz + 17.0], [sx * hx + sx * 3.4, 24.5, -hz + 24.0],
        MAT.CONCRETE, { roof: MAT.ROOF });
      m.box([sx * hx + sx * 0.6, 1.4, -hz + 18.2], [sx * hx + sx * 3.5, 22.6, -hz + 22.8], MAT.GLASS);
    }
    // The back: the loading yard elevation, banded rather than bare.
    m.painted(TINT.BRAND, () => m.box([-hx + 4, 15.5, -hz - 0.5], [hx - 4, 18.5, -hz + 0.2], MAT.CLADDING));
  }
  if (fine) {
    parapet(m, -hx, -hz, hx, hz - 11.0, 22.0, 1.1, 0.3, MAT.CONCRETE);
    roofClutter(m, -hx + 3, -hz + 3, hx - 3, hz - 14, 22.0, 39, 1.0);
    // The media wall: a grid of lit panels above the entrance.
    m.painted(TINT.BRAND, () => m.box([-20, 20.2, hz - 1.6], [20, 30.0, hz - 0.4], MAT.CLADDING));
    m.painted(TINT.SIGN_LIT, () => {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 5; c++) {
          m.box([-18.6 + c * 7.4, 21.0 + r * 2.9, hz - 0.42], [-12.8 + c * 7.4, 23.4 + r * 2.9, hz - 0.3], MAT.PLATE);
        }
      }
    });
    marquee(m, -14, 14, hz + 0.2, 1, 6.2, 2.4);
    porteCochere(m, -13, 13, hz + 0.6, 7.0, 6.0, 5);
    // A row of poster totems along the frontage.
    for (const sx of [-26, -20, 20, 26]) {
      m.painted(TINT.METAL_DARK, () => m.box([sx - 1.4, 0.2, hz + 6.0], [sx + 1.4, 4.6, hz + 6.5], MAT.TRIM));
      m.painted(TINT.ACCENT, () => m.box([sx - 1.2, 0.5, hz + 5.9], [sx + 1.2, 4.3, hz + 6.02], MAT.PLATE));
    }
    flags(m, -30, 30, hz + 10.0, 0.2, 7, 9.0);
    for (let i = 0; i < 8; i++) figure(m, 9200 + i * 13, -14 + i * 4.0, hz + 8.0, Math.PI, { stride: 0.24 });
    for (let i = 0; i < 4; i++) hedge(m, -34 + i * 20, hz + 12.5, -22 + i * 20, hz + 13.6, 0.9);
  }
  return m;
}

// -------------------------------------------------------- 9. the sign tower

/**
 * An entertainment tower: ten floors of karaoke, restaurants and arcades,
 * every one of them advertising itself down the outside.
 *
 * The building is a plain slab and is meant to be -- what you look at is the
 * signage, and the signage is the programme made visible: one board per floor
 * per corner, stacked, lit, and stepping out over the pavement. Nothing else
 * in the library gets its identity so completely from what is bolted to it.
 */
function signTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 15.0, hz = 13.0, floorH = 4.2, floors = 11;
  const top = 5.6 + floors * floorH;

  forecourt(m, -26, -24, 26, 24, 6421, { trees: 3, lamps: 6, people: 11, benches: 2 });
  m.box([-hx - 2, 0.1, -hz - 2], [hx + 2, 5.6, hz + 2], MAT.TILE, { roof: MAT.ROOF });
  m.box([-hx, 5.6, -hz], [hx, top, hz], MAT.PLASTER, { roof: MAT.ROOF });
  if (medium) {
    shopfront(m, { axis: 'z', sign: 1, plane: hz + 2 }, -hx, hx, { bays: 5, head: 4.6, fascia: 1.2 });
    shopfront(m, { axis: 'x', sign: 1, plane: hx + 2 }, -hz, hz, { bays: 4, head: 4.6, fascia: 1.2 });
    for (let f = 0; f < floors; f++) {
      const y = 5.6 + f * floorH;
      for (const [axis, sign, pln, a, b] of [
        ['z', 1, hz, -hx + 1.5, hx - 1.5], ['z', -1, -hz, -hx + 1.5, hx - 1.5],
        ['x', 1, hx, -hz + 1.5, hz - 1.5], ['x', -1, -hx, -hz + 1.5, hz - 1.5],
      ] as const) {
        m.windowRow({
          axis, sign, plane: pln, from: a, to: b, y0: y + 0.8, y1: y + floorH - 1.0,
          count: 3, width: 2.6, glass: MAT.PANE, frame: 0.1, proud: 0.05,
        });
      }
    }
    parapet(m, -hx, -hz, hx, hz, top, 1.2, 0.3, MAT.TILE);
  }
  if (fine) {
    // The stacked signage.
    //
    // A board across the whole of both elevations on every floor, in brand,
    // accent and lit white by turns, is not a sign tower -- it is a barcode.
    // Eleven of them made the building two colours from a distance and nothing
    // else, which is exactly what it looked like on the palette: red and yellow
    // stripes with no building behind them.
    //
    // What the real thing is: separate boards of different widths, hung with
    // gaps between them and gaps between floors, most of them lit white with
    // the house colours as the minority. So the wall reads as a wall, the signs
    // read as signs, and the tower is recognisable rather than loud.
    const panels = (f: number, face: 'z' | 'x'): void => {
      const seed = f * 7 + (face === 'z' ? 0 : 3);
      const y = 5.6 + f * floorH + 0.9;
      const h = floorH - 2.9;
      const span = face === 'z' ? hx - 1.0 : hz - 1.0;
      // Two or three boards across the face, at widths that do not agree.
      const cuts = seed % 3 === 0 ? [0.00, 0.46, 0.54, 1.00]
        : seed % 3 === 1 ? [0.00, 0.30, 0.38, 0.74, 0.82, 1.00]
          : [0.06, 0.52, 0.60, 0.94];
      for (let i = 0; i < cuts.length; i += 2) {
        const roll = (seed * 13 + i * 5) % 9;
        if (roll === 0) continue;                     // a gap where a tenant left
        const t = roll < 6 ? TINT.SIGN_LIT : roll < 8 ? TINT.ACCENT : TINT.BRAND;
        const u0 = -span + cuts[i] * span * 2, u1 = -span + cuts[i + 1] * span * 2;
        m.painted(t, () => {
          if (face === 'z') m.box([u0, y, hz + 0.1], [u1, y + h, hz + 1.3], MAT.CLADDING);
          else m.box([hx + 0.1, y, u0], [hx + 1.3, y + h, u1], MAT.CLADDING);
        });
      }
    };
    for (let f = 0; f < floors; f++) {
      panels(f, 'z');
      // Every other floor on the return elevation, so the two faces are not
      // the same building twice.
      if (f % 2 === 0) panels(f, 'x');
    }
    // A vertical blade on the corner, taller than the building. It carries the
    // brand colour -- one element rather than the whole facade, which is what
    // makes it read as the building's own.
    m.painted(TINT.BRAND, () => m.box([hx - 0.4, 6.0, hz - 0.4], [hx + 2.6, top + 9.0, hz + 2.6], MAT.CLADDING));
    m.painted(TINT.SIGN_LIT, () => {
      m.box([hx + 2.62, 8.0, hz - 0.2], [hx + 2.72, top + 8.0, hz + 2.4], MAT.PLATE);
      m.box([hx - 0.2, 8.0, hz + 2.62], [hx + 2.4, top + 8.0, hz + 2.72], MAT.PLATE);
    });
    // A roof garden with a pergola and a lit crown box.
    m.painted(TINT.GREEN, () => m.box([-hx + 2, top, -hz + 2], [hx - 2, top + 0.5, hz - 2], MAT.TRIM));
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 5; i++) {
        const x = -hx + 3 + (i / 5) * (hx * 2 - 6);
        m.cylinder(x, 0, 0.11, top + 0.5, top + 3.2, 4, MAT.TRIM, false);
        m.box([x - 0.1, top + 3.2, -hz + 3], [x + 0.1, top + 3.4, hz - 3], MAT.TRIM);
      }
    });
    roofClutter(m, -hx + 3, -hz + 3, hx - 3, -2, top, 87, 0.6);
    for (let i = 0; i < 9; i++) figure(m, 8800 + i * 11, -12 + i * 3.2, hz + 4.4, Math.PI, { stride: 0.24 });
  }
  return m;
}

// ------------------------------------------------------- 10. the coaching inn

/**
 * A country inn round its own yard, with a brewery tap and a cart shed.
 *
 * The rural theme's one real destination building. The yard is the point --
 * it is what a coaching inn is, an entrance arch into a court with the
 * stables on one side and the tap room on the other -- and it is the only
 * commercial plan in the library where the parking is a paddock.
 */
function coachingInn(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const floorH = 3.0;
  const hx = 26.0, hz = 20.0, depth = 9.5;
  const top = 0.7 + 3 * floorH;

  forecourt(m, -36, -30, 36, 30, 4409, { trees: 7, lamps: 5, people: 7, benches: 4 });
  m.box([-hx + depth, 0.1, -hz + depth], [hx - depth, 0.24, hz - depth], MAT.GROUND);

  const ranges: Array<[number, number, number, number, number]> = [
    [-hx, hz - depth, hx, hz, top],
    [-hx, -hz, hx, -hz + depth, top - floorH],
    [-hx, -hz + depth, -hx + depth, hz - depth, top - floorH],
    [hx - depth, -hz + depth, hx, hz - depth, top - floorH],
  ];
  for (const [x0, z0, x1, z1, h] of ranges) {
    m.box([x0, 0.1, z0], [x1, 0.7, z1], MAT.STONE);
    m.box([x0, 0.7, z0], [x1, h, z1], MAT.PLASTER);
    if (medium) {
      m.gable([x0 - 0.4, h, z0 - 0.4], [x1 + 0.4, h, z1 + 0.4],
        Math.min(x1 - x0, z1 - z0) * 0.55, x1 - x0 >= z1 - z0 ? 'x' : 'z', MAT.ROOF_TILE, MAT.PLASTER);
      // Exposed timber framing, which is the whole of this theme's identity.
      m.painted(TINT.WOOD, () => {
        for (const [pz, sgn] of [[z0 - 0.06, -1], [z1 + 0.06, 1]] as const) {
          if (z1 - z0 > x1 - x0) break;
          void sgn;
          for (let i = 0; i <= Math.round((x1 - x0) / 3.2); i++) {
            const x = x0 + (i / Math.max(1, Math.round((x1 - x0) / 3.2))) * (x1 - x0);
            m.box([x - 0.16, 0.7, pz - 0.06], [x + 0.16, h, pz + 0.06], MAT.TIMBER);
          }
          for (const y of [0.7 + floorH, 0.7 + floorH * 2]) {
            if (y > h) continue;
            m.box([x0, y - 0.14, pz - 0.06], [x1, y + 0.14, pz + 0.06], MAT.TIMBER);
          }
        }
      });
    }
  }
  if (fine) {
    for (let f = 0; f < 3; f++) {
      const y = 0.7 + f * floorH;
      m.windowRow({
        axis: 'z', sign: 1, plane: hz, from: -hx + 2, to: hx - 2, y0: y + 0.7, y1: y + 2.1,
        count: 9, width: 1.2, glass: MAT.PANE, frame: 0.14, proud: 0.08,
      });
      if (f < 2) {
        m.windowRow({
          axis: 'z', sign: -1, plane: -hz, from: -hx + 2, to: hx - 2, y0: y + 0.7, y1: y + 2.1,
          count: 9, width: 1.2, glass: MAT.PANE, frame: 0.14, proud: 0.08,
        });
      }
    }
    // The arch through the south range, and the inn sign hanging beside it.
    m.box([-3.4, 0.12, -hz - 0.3], [3.4, 4.6, -hz + depth + 0.3], MAT.DARK_TRIM);
    m.painted(TINT.NONE, () => {
      for (const s of [-1, 1]) m.box([s * 3.4, 0.1, -hz - 0.4], [s * 4.4, 5.4, -hz + depth + 0.4], MAT.STONE);
      m.box([-4.4, 4.6, -hz - 0.4], [4.4, 5.4, -hz + depth + 0.4], MAT.STONE);
    });
    bladeSign(m, { axis: 'z', sign: -1, plane: -hz }, -7.5, 3.6, 6.4, 2.2);
    entrance(m, { axis: 'z', sign: 1, plane: hz }, 0,
      { width: 1.6, height: 2.5, double: false, glazed: false, fanlight: true });
    // The yard: cart shed, water trough, barrels, benches and a chestnut tree.
    m.painted(TINT.WOOD, () => {
      for (let i = 0; i < 4; i++) m.cylinder(-11 + i * 2.0, 4.0, 0.55, 0.24, 1.35, 8, MAT.TIMBER, true);
      m.box([6.0, 0.24, -2.0], [7.4, 1.0, 2.0], MAT.TIMBER);
    });
    for (let i = 0; i < 4; i++) bench(m, -6 + i * 5, -3.0, 0);
    tree(m, 11, 4.0, 8.5, 3.0);
    // The brewery tap: a small gabled block with a vent cowl, off the yard.
    m.box([-hx - 9.0, 0.1, -4.0], [-hx - 0.5, 7.4, 8.0], MAT.STONE);
    m.gable([-hx - 9.4, 7.4, -4.4], [-hx - 0.1, 7.4, 8.4], 4.4, 'z', MAT.ROOF_TILE, MAT.STONE);
    m.painted(TINT.METAL_DARK, () => {
      m.cylinder(-hx - 4.7, 2.0, 1.0, 11.8, 14.4, 8, MAT.METAL, false);
      m.cone(-hx - 4.7, 2.0, 1.2, 0.3, 14.4, 16.2, 8, MAT.METAL);
    });
    for (const sx of [-30, 24]) tree(m, sx, hz + 6.0, 9.5, 3.4);
    hedge(m, -hx, hz + 9.0, hx, hz + 10.2, 1.0);
    for (let i = 0; i < 5; i++) figure(m, 6900 + i * 13, -8 + i * 4.4, 0.0, 1.0 * i, { stride: 0.2 });
    flags(m, -3, 3, hz + 2.0, top + 1.0, 1, 5.5);
  }
  return m;
}

// ====================================================================== table

const trade = (jobs: number, upkeep: number, power: number): AssetDef['sim'] => ({
  jobs, powerKW: power, waterM3: jobs * 0.5, garbagePerWeek: jobs * 12,
  pollution: 1, upkeep,
});

/**
 * Two archetypes in each theme: the covered retail hall, and the anchor.
 *
 * A hall is the place a district shops in the round -- an arcade, a store, a
 * mall, a market, a night street -- and an anchor is the one thing people
 * make an evening of. Both exist everywhere and look nothing alike from one
 * region to the next, which is exactly what a signature building is for.
 */
interface Row {
  key: string; name: string; foot: [number, number]; jobs: number;
  upkeep: number; power: number; colour: [number, number, number];
  accent: [number, number, number]; note: string;
  build: (lod: number) => MeshBuilder;
}

const HALL: Record<Theme, Row> = {
  modern: {
    key: 'hall', name: 'Northgate Centre', foot: [14, 12], jobs: 420, upkeep: 1280, power: 2200,
    colour: [0.16, 0.34, 0.46], accent: [0.74, 0.58, 0.20],
    note: 'Two retail wings either side of a ninety-metre glazed mall with balconies at first floor, a glazed rotunda over the crossing, a canopied drop-off and two decks of marked-out parking behind.',
    build: shoppingMall,
  },
  european: {
    key: 'hall', name: 'Fenwick Arcade', foot: [12, 7], jobs: 150, upkeep: 520, power: 640,
    colour: [0.32, 0.22, 0.28], accent: [0.66, 0.58, 0.36],
    note: 'Two three-storey stone ranges either side of a glazed barrel-vaulted street, shops facing both ways, arched screens with a lit clock at each end, and the arcade floor paved, planted and occupied.',
    build: arcade,
  },
  american: {
    key: 'hall', name: 'Halvard & Co', foot: [10, 9], jobs: 320, upkeep: 940, power: 1500,
    colour: [0.26, 0.18, 0.30], accent: [0.70, 0.60, 0.26],
    note: 'A five-storey stone department store turning the corner on a glazed drum, with shop windows the whole way round it, a clock in the drum and a three-stage dome and flagpole over the junction.',
    build: emporium,
  },
  asian: {
    key: 'hall', name: 'Lantern Night Market', foot: [13, 8], jobs: 260, upkeep: 610, power: 900,
    colour: [0.46, 0.14, 0.18], accent: [0.76, 0.58, 0.16],
    note: 'Twelve shophouse units either side of a street roofed in nothing but signage: a board hung out from every unit, twenty-two lanterns strung down the middle, nine stall canopies and a crowd under them.',
    build: nightMarket,
  },
  farming: {
    key: 'hall', name: 'Greyfriars Market', foot: [11, 9], jobs: 180, upkeep: 460, power: 720,
    colour: [0.40, 0.24, 0.14], accent: [0.66, 0.62, 0.44],
    note: 'A brick market hall on open arcading under a six-bay north-light saw-tooth roof, with fourteen canopied stalls and a crowd inside it.',
    build: marketHall,
  },
  row: {
    key: 'hall', name: '', foot: [1, 1], jobs: 0, upkeep: 0, power: 0,
    colour: [0, 0, 0], accent: [0, 0, 0], note: '', build: marketHall,
  },
};

const ANCHOR: Record<Theme, Row> = {
  modern: {
    key: 'anchor', name: 'The Halo', foot: [12, 11], jobs: 180, upkeep: 700, power: 1600,
    colour: [0.18, 0.26, 0.40], accent: [0.72, 0.50, 0.16],
    note: 'A stepped auditorium block behind a four-storey glazed front with two crossing escalator runs in it, a fifteen-panel media wall over the entrance, poster totems and a canopied drop-off.',
    build: leisureBox,
  },
  european: {
    key: 'anchor', name: 'The Aldermoor', foot: [9, 8], jobs: 240, upkeep: 880, power: 1400,
    colour: [0.22, 0.16, 0.26], accent: [0.70, 0.58, 0.28],
    note: 'A fourteen-storey brick hotel on a stone base with a dormered mansard, a canopied drop-off on columns, drum lamps either side of the door and five flags over it.',
    build: grandHotel,
  },
  american: {
    key: 'anchor', name: 'The Rialto', foot: [9, 9], jobs: 90, upkeep: 420, power: 900,
    // A cinema blade is red, not plum. The original leaned purple and the fin
    // is twenty-five metres of it.
    colour: [0.44, 0.11, 0.13], accent: [0.70, 0.57, 0.22],
    note: 'A stepped windowless auditorium block with the rake expressed in buttresses down both flanks, a glazed foyer, a bulb-edged marquee over the doors and a thirty-metre lit fin carrying the name above the parapet.',
    build: pictureHouse,
  },
  asian: {
    key: 'anchor', name: 'Golden Crane Tower', foot: [7, 6], jobs: 210, upkeep: 760, power: 1500,
    // Lacquer red and old gold, both taken down: the shader lifts a brand
    // colour a long way and the pair as first written came back off the
    // building as pink and canary.
    colour: [0.32, 0.10, 0.12], accent: [0.62, 0.48, 0.16],
    note: 'Eleven floors of karaoke, restaurants and arcades over a shop podium, every floor advertising itself on a lit board across two elevations, a corner blade nine metres above the parapet, and a pergola garden on the roof.',
    build: signTower,
  },
  farming: {
    key: 'anchor', name: 'The Wheatsheaf', foot: [10, 9], jobs: 70, upkeep: 300, power: 460,
    colour: [0.34, 0.22, 0.14], accent: [0.64, 0.56, 0.34],
    note: 'A timber-framed coaching inn round its own yard: an arch through the south range under a hanging sign, cart shed, barrels, a water trough and a brewery tap with a vent cowl beside it.',
    build: coachingInn,
  },
  row: {
    key: 'anchor', name: '', foot: [1, 1], jobs: 0, upkeep: 0, power: 0,
    colour: [0, 0, 0], accent: [0, 0, 0], note: '', build: coachingInn,
  },
};

export const SIGNATURE_COMMERCIAL: AssetDef[] = THEME_ORDER.flatMap((t) =>
  [HALL[t], ANCHOR[t]].map((r): AssetDef => ({
    id: `sig.com.${t}.${r.key}`,
    name: r.name,
    zone: 'commercial',
    density: 'high',
    variant: 'sculpted',
    theme: t,
    signature: true,
    footprint: r.foot,
    height: 0,
    brand: { name: r.name, colour: r.colour, accent: r.accent, sign: 'box' },
    sim: trade(r.jobs, r.upkeep, r.power),
    note: r.note,
    build: r.build,
  })));
