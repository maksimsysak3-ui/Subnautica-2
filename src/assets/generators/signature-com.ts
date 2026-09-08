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
import {
  barrelVault, curtain, flags, forecourt, loft, marquee,
  pierWall, plan, porteCochere, sawtooth, scaled, shelf,
} from './signature-parts';
import {
  awning, band, bladeSign, entrance, parapet, planter, railing,
  roofClutter, shopfront,
} from '../parts';
import { hedge, bench } from './landscape';
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

// ====================================================================== table

const trade = (jobs: number, upkeep: number, power: number): AssetDef['sim'] => ({
  jobs, powerKW: power, waterM3: jobs * 0.5, garbagePerWeek: jobs * 12,
  pollution: 1, upkeep,
});

export const SIGNATURE_COMMERCIAL: AssetDef[] = [
  {
    id: 'sig.com.arcade', name: 'Fenwick Arcade', zone: 'commercial', density: 'medium',
    variant: 'sculpted', theme: 'european', signature: true, footprint: [12, 7], height: 0,
    brand: { name: 'Fenwick Arcade', colour: [0.32, 0.22, 0.28], accent: [0.66, 0.58, 0.36], sign: 'blade' },
    sim: trade(150, 520, 640),
    note: 'Two three-storey stone ranges either side of a glazed barrel-vaulted street, shops facing both ways, arched screens with a lit clock at each end, and the arcade floor paved, planted and occupied.',
    build: arcade,
  },
  {
    id: 'sig.com.emporium', name: 'Halvard & Co', zone: 'commercial', density: 'high',
    variant: 'sculpted', theme: 'european', signature: true, footprint: [10, 9], height: 0,
    brand: { name: 'Halvard & Co', colour: [0.26, 0.18, 0.30], accent: [0.70, 0.60, 0.26], sign: 'fascia' },
    sim: trade(320, 940, 1500),
    note: 'A five-storey stone department store turning the corner on a glazed drum, with shop windows the whole way round it, a clock in the drum and a three-stage dome and flagpole over the junction.',
    build: emporium,
  },
  {
    id: 'sig.com.market', name: 'Greyfriars Market', zone: 'commercial', density: 'medium',
    variant: 'sculpted', theme: 'european', signature: true, footprint: [11, 9], height: 0,
    brand: { name: 'Greyfriars Market', colour: [0.40, 0.24, 0.14], accent: [0.66, 0.62, 0.44], sign: 'fascia' },
    sim: trade(180, 460, 720),
    note: 'A brick market hall on open arcading under a six-bay north-light saw-tooth roof, with fourteen canopied stalls and a crowd inside it.',
    build: marketHall,
  },
  {
    id: 'sig.com.mall', name: 'Northgate Centre', zone: 'commercial', density: 'high',
    variant: 'sculpted', theme: 'modern', signature: true, footprint: [14, 12], height: 0,
    brand: { name: 'Northgate', colour: [0.16, 0.34, 0.46], accent: [0.74, 0.58, 0.20], sign: 'box' },
    sim: trade(420, 1280, 2200),
    note: 'Two retail wings either side of a ninety-metre glazed mall with balconies at first floor, a glazed rotunda over the crossing, a canopied drop-off and two decks of marked-out parking behind.',
    build: shoppingMall,
  },
  {
    id: 'sig.com.hotel', name: 'The Aldermoor', zone: 'commercial', density: 'high',
    variant: 'sculpted', theme: 'american', signature: true, footprint: [9, 8], height: 0,
    brand: { name: 'The Aldermoor', colour: [0.22, 0.16, 0.26], accent: [0.70, 0.58, 0.28], sign: 'box' },
    sim: trade(240, 880, 1400),
    note: 'A fourteen-storey brick hotel on a stone base with a dormered mansard, a canopied drop-off on columns, drum lamps either side of the door and five flags over it.',
    build: grandHotel,
  },
  {
    id: 'sig.com.cinema', name: 'The Rialto', zone: 'commercial', density: 'medium',
    variant: 'sculpted', theme: 'american', signature: true, footprint: [9, 9], height: 0,
    brand: { name: 'The Rialto', colour: [0.38, 0.12, 0.22], accent: [0.76, 0.62, 0.22], sign: 'pylon' },
    sim: trade(90, 420, 900),
    note: 'A stepped windowless auditorium block with the rake expressed in buttresses down both flanks, a glazed foyer, a bulb-edged marquee over the doors and a thirty-metre lit fin carrying the name above the parapet.',
    build: pictureHouse,
  },
];
