/**
 * The other half of a high street.
 *
 * Commercial was the thinnest zone in the library and the one a player builds
 * most of: three low plans and three medium, so a mile of frontage was the
 * corner shop, the pub, the filling station, the parade, the market hall and
 * the cafe, over and over. A real high street has the things people actually
 * go to it for -- somewhere to bank, somewhere to buy a car, somewhere to get
 * one mended, somewhere to buy a plant -- and none of them look like a shop
 * with a flat over it.
 *
 * Four plans, each in all five themes. Chosen the same way the tall ones were:
 * for shape rather than for style. A bank turns a corner on a stone base; a
 * showroom is a glass box with a forecourt of cars; a garage is a shed with
 * three roller doors and a yard; a garden centre is a glasshouse with an
 * outdoor sales area beside it. Put any two of them next to each other and
 * they are different objects before you have read a sign.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { ThemeProfile } from '../themes';
import { plotOf, punched, roofOver, storeysOf } from '../themed-parts';
import {
  awning, band, bollards, entrance, fasciaSign, frontage, kerb, louvres,
  parapet, planter, pylonSign, railing, ribbon, roofClutter, serviceYard,
  shopfront,
} from '../parts';
import type { Wall } from '../parts';
import { hedge, tree } from './landscape';
import { barrelVault } from './signature-parts';

/**
 * A bank on a corner.
 *
 * The one commercial building that is deliberately heavy: a stone base, deep
 * piers, small high windows and a door you go up steps to, because the whole
 * point of the architecture is to look like somewhere money is safe. It is
 * also the only thing on a high street that turns a corner properly, which is
 * what makes it read from two streets at once.
 */
export function bank(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const [w, d] = plotOf(T, 21.0, 21.0);
  const x = w / 2, z = d / 2;
  const floors = storeysOf(T, 3);
  const plinth = 1.3;
  const banking = T.floorH * 1.7;
  const wall = banking + (floors - 1) * T.floorH;
  // The chamfer: the corner is cut back and the door goes in it, which is what
  // a corner bank is and what a square box on the same plot is not.
  const cut = Math.min(w, d) * 0.26;

  m.box([-x, 0, -z], [x, plinth, z], MAT.STONE);
  m.box([-x, plinth, -z], [x, wall, z], T.wall, { roof: T.cover });
  // The chamfer is cut by adding a prism across it in the base material, since
  // additive geometry cannot take a corner off -- so the corner is simply
  // rebuilt as its own face, standing a little proud.
  m.box([x - cut, 0, z - cut], [x + 0.12, wall + 0.3, z + 0.12], MAT.STONE);
  roofOver(m, T, -x, -z, x, z, wall, { along: 'x' });

  if (medium) {
    band(m, -x, -z, x, z, plinth, 0.34, 0.22, MAT.STONE);
    band(m, -x, -z, x, z, banking, 0.5, 0.3, MAT.STONE);
    parapet(m, -x, -z, x, z, wall, 1.0, 0.28, MAT.STONE);
    // The piers, which are what make it read as masonry rather than as render.
    for (const wl of [
      { axis: 'z', sign: 1, plane: z } as Wall, { axis: 'x', sign: 1, plane: x } as Wall,
    ]) {
      const [u0, u1] = wl.axis === 'x' ? [-z + 0.6, z - cut - 0.4] : [-x + 0.6, x - cut - 0.4];
      const bays = Math.max(3, Math.round((u1 - u0) / 3.4));
      for (let i = 0; i <= bays; i++) {
        const u = u0 + (i / bays) * (u1 - u0);
        if (wl.axis === 'x') m.box([x - 0.12, plinth, u - 0.45], [x + 0.42, wall, u + 0.45], MAT.STONE);
        else m.box([u - 0.45, plinth, z - 0.12], [u + 0.45, wall, z + 0.42], MAT.STONE);
      }
    }
    // A clock over the door, which every one of these has.
    m.painted(TINT.SIGN_LIT, () => {
      const cx = x - cut / 2, cz = z - cut / 2;
      m.cylinder(cx + 0.3, cz + 0.3, 1.0, banking + 0.9, banking + 1.1, 14, MAT.PLATE);
    });
    roofClutter(m, -x + 2, -z + 2, x - 2, z - 2, wall, seed, 0.5);
  }
  if (fine) {
    // Tall banking-hall windows at the bottom and small offices above.
    for (const wl of [
      { axis: 'z', sign: 1, plane: z } as Wall, { axis: 'x', sign: 1, plane: x } as Wall,
      { axis: 'z', sign: -1, plane: -z } as Wall, { axis: 'x', sign: -1, plane: -x } as Wall,
    ]) {
      const front = wl.sign > 0;
      const [u0, u1] = wl.axis === 'x'
        ? [-z + 1.2, front ? z - cut - 0.8 : z - 1.2]
        : [-x + 1.2, front ? x - cut - 0.8 : x - 1.2];
      if (u1 - u0 < 2.4) continue;
      if (front) ribbon(m, wl, u0, u1, plinth + 0.8, banking - 0.9, { mullions: 5 });
      punched(m, T, wl, u0, u1, { floors: floors - 1, base: banking + 0.9 });
    }
    // The door, in the chamfer, up two steps, under its own hood.
    const cx = x - cut / 2, cz = z - cut / 2;
    m.box([cx - 2.2, 0, cz + 0.12], [cx + 2.2, plinth, cz + 2.0], MAT.STONE);
    entrance(m, { axis: 'z', sign: 1, plane: cz + 0.12 }, cx,
      { width: 2.6, height: 3.2, double: true, glazed: true, steps: 3, canopy: 1.6 });
    bollards(m, { axis: 'z', sign: 1, plane: z }, -x + 1.0, x - cut, 1.4, 5);
    kerb(m, -x - 0.8, z + 0.6, x + 0.8, z + 1.5);
  }
  return m;
}

/**
 * A car showroom.
 *
 * A glazed box with a forecourt, and the forecourt is most of it: a building
 * whose product is parked outside it reads differently from every other kind
 * of shop, and the library had nothing with an apron of hardstanding in front
 * of a wall of glass.
 */
export function showroom(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const [w, d] = plotOf(T, 30.0, 25.0);
  const x = w / 2, z = d / 2;
  const hall = T.floorH * 2.2;
  const back = d * 0.42;                      // depth of the workshop range

  // The apron, and the showroom standing at the back of it.
  m.box([-x, 0, -z], [x, 0.12, z], MAT.CONCRETE);
  m.box([-x, 0.12, -z], [x, hall, -z + back], T.wall, { roof: MAT.ROOF });
  m.box([-x, 0.12, -z + back], [x * 0.34, hall * 0.82, -z + back + 1.2], T.base,
    { roof: MAT.ROOF });

  if (medium) {
    parapet(m, -x, -z, x, -z + back, hall, 0.9, 0.24, T.base);
    // The brand band across the head of the glass, which is the one saturated
    // thing on any of these.
    m.painted(TINT.BRAND, () => {
      m.box([-x - 0.1, hall - 1.5, -z + back - 0.1], [x + 0.1, hall - 0.2, -z + back + 0.5],
        MAT.CLADDING);
    });
    // Bays marked out on the apron, and the cars that would stand in them.
    m.painted(TINT.NONE, () => {
      for (let i = 0; i < 7; i++) {
        const px = -x + 1.6 + (i / 6) * (w - 3.2);
        m.box([px - 0.08, 0.12, -z + back + 1.8], [px + 0.08, 0.14, z - 1.4], MAT.TRIM);
      }
    });
    roofClutter(m, -x + 2, -z + 2, x - 2, -z + back - 2, hall, seed, 0.6);
    pylonSign(m, x - 2.6, z - 2.2, 7.5, 2.6);
    hedge(m, -x, z - 1.0, x, z - 0.2, 0.7);
  }
  if (fine) {
    // The whole front elevation is glass, floor to head, with the mullions
    // standing proud: that is the entire architecture of one of these.
    ribbon(m, { axis: 'z', sign: 1, plane: -z + back }, -x + 0.6, x - 0.6, 0.6, hall - 1.6,
      { mullions: 12 });
    entrance(m, { axis: 'z', sign: 1, plane: -z + back + 1.2 }, x * 0.17,
      { width: 3.2, height: 3.0, double: true, glazed: true, canopy: 2.2 });
    fasciaSign(m, { axis: 'z', sign: 1, plane: -z + back }, -x + 4.0, -x + 12.0,
      hall - 1.4, hall - 0.4);
    // The workshop behind, with its roller shutters on the side elevation.
    for (let i = 0; i < 3; i++) {
      const u = -z + 2.0 + i * ((back - 4.0) / 2);
      m.painted(TINT.METAL_DARK, () => {
        m.box([-x - 0.14, 0.12, u - 1.5], [-x + 0.06, 4.0, u + 1.5], MAT.METAL);
        for (let k = 0; k < 8; k++) {
          m.box([-x - 0.2, 0.4 + k * 0.45, u - 1.5], [-x - 0.1, 0.55 + k * 0.45, u + 1.5], MAT.TRIM);
        }
      });
    }
    serviceYard(m, x - 9.0, x - 1.0, -z + back + 0.6, seed,
      { totem: false, flag: false, cycles: false, bins: true });
    kerb(m, -x - 1.0, z + 0.6, x + 1.0, z + 1.6);
  }
  return m;
}

/**
 * A motor repair garage.
 *
 * Three roller doors, a yard, a car lift and a pile of tyres. The smallest of
 * the four and the one that most obviously is not a shop: a working building
 * on a commercial street, which every real one has and none of the library's
 * commercial stock was.
 */
export function garage(lod: number, T: ThemeProfile, _seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const [w, d] = plotOf(T, 21.0, 20.0);
  const x = w / 2, z = d / 2;
  const eaves = 4.6;
  const office = w * 0.30;

  m.box([-x, 0, -z], [x, 0.12, z], MAT.CONCRETE);
  // The workshop: a shed with a shallow roof, and the office beside it.
  m.box([-x, 0.12, -z], [x - office, eaves, z - d * 0.30], MAT.SHED_WALL, { roof: MAT.ROOF });
  m.box([x - office, 0.12, -z], [x, eaves * 0.74, z - d * 0.30], T.base, { roof: T.cover });
  if (T.roof !== 'flat') {
    roofOver(m, T, x - office, -z, x, z - d * 0.30, eaves * 0.74, { along: 'z' });
  }

  if (medium) {
    band(m, -x, -z, x - office, z - d * 0.30, eaves, 0.4, 0.26, MAT.METAL);
    parapet(m, -x, -z, x - office, z - d * 0.30, eaves, 0.55, 0.2, MAT.METAL);
    // The fascia sign across the shed, and a hoist in the yard.
    m.painted(TINT.BRAND, () => {
      m.box([-x - 0.1, eaves - 1.7, z - d * 0.30 - 0.1],
        [x - office + 0.1, eaves - 0.5, z - d * 0.30 + 0.45], MAT.CLADDING);
    });
    m.painted(TINT.METAL_DARK, () => {
      const hx = x - office * 0.5, hz = z - 2.6;
      m.cylinder(hx, hz, 0.22, 0.12, 2.6, 8, MAT.TRIM, false);
      m.box([hx - 1.6, 2.6, hz - 0.9], [hx + 1.6, 2.9, hz + 0.9], MAT.TRIM);
    });
    hedge(m, -x, z - 0.9, -x + w * 0.4, z - 0.2, 0.8);
  }
  if (fine) {
    // Three roller doors, which is what the front of one of these is.
    for (let i = 0; i < 3; i++) {
      const u = -x + 1.6 + i * ((w - office - 3.2) / 2);
      m.painted(TINT.METAL_DARK, () => {
        m.box([u - 1.6, 0.12, z - d * 0.30 - 0.06], [u + 1.6, 3.9, z - d * 0.30 + 0.14], MAT.METAL);
        for (let k = 0; k < 9; k++) {
          m.box([u - 1.6, 0.4 + k * 0.4, z - d * 0.30 + 0.14],
            [u + 1.6, 0.56 + k * 0.4, z - d * 0.30 + 0.2], MAT.TRIM);
        }
      });
    }
    shopfront(m, { axis: 'z', sign: 1, plane: z - d * 0.30 }, x - office + 0.6, x - 0.6,
      { bays: 2, doorBay: 1, head: 2.9, fascia: 0.7 });
    louvres(m, { axis: 'x', sign: 1, plane: x }, -z + 1.2, -z + 5.0, 2.4, 3.8, 0.34);
    // The yard: a stack of tyres, a skip and an oil drum or two.
    m.painted(TINT.METAL_DARK, () => {
      for (let k = 0; k < 5; k++) {
        m.cylinder(-x + 2.4, z - 2.4, 0.62, 0.12 + k * 0.24, 0.32 + k * 0.24, 10, MAT.TYRE);
      }
      m.box([x - office - 4.6, 0.12, z - 3.4], [x - office - 1.2, 1.5, z - 1.0], MAT.METAL);
      for (const cx of [x - office - 5.6, x - office - 6.4]) {
        m.cylinder(cx, z - 2.2, 0.32, 0.12, 1.0, 10, MAT.METAL);
      }
    });
    bollards(m, { axis: 'z', sign: 1, plane: z }, -x + 1.0, x - 1.0, 1.0, 5);
    kerb(m, -x - 1.0, z + 0.6, x + 1.0, z + 1.6);
  }
  return m;
}

/**
 * A garden centre.
 *
 * A glasshouse and an outdoor sales yard, and the yard is half the plot --
 * the only commercial building in the library whose business is conducted
 * mostly out of doors. From above, which is the view that matters, it is a
 * vault and a field of benches rather than a roof.
 */
export function gardenCentre(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const [w, d] = plotOf(T, 30.0, 27.0);
  const x = w / 2, z = d / 2;
  const glassW = w * 0.52;
  const eaves = 3.6;

  m.box([-x, 0, -z], [x, 0.1, z], MAT.CONCRETE);
  // The glasshouse: a low wall, then glass, under a barrel vault.
  m.box([-x, 0.1, -z], [-x + glassW, 1.0, z], T.base);
  m.box([-x + 0.2, 1.0, -z + 0.2], [-x + glassW - 0.2, eaves, z - 0.2], MAT.GLASS);
  barrelVault(m, -x + 0.1, -z, -x + glassW - 0.1, z, eaves, (z * 2) * 0.22,
    medium ? 9 : 5, { ribs: medium ? Math.round(d / 4) : 3 });
  m.roofDressed = true;
  // The shop block at the far end of the glasshouse, which is where the till is.
  m.box([-x + glassW, 0.1, -z], [-x + glassW + w * 0.16, eaves + 1.2, -z + d * 0.46],
    T.wall, { roof: T.cover });
  if (T.roof !== 'flat') {
    roofOver(m, T, -x + glassW, -z, -x + glassW + w * 0.16, -z + d * 0.46, eaves + 1.2,
      { along: 'z' });
  } else {
    parapet(m, -x + glassW, -z, -x + glassW + w * 0.16, -z + d * 0.46, eaves + 1.2,
      0.8, 0.22, T.base);
  }

  if (medium) {
    // The outdoor sales area: benches of stock in rows, under a pergola run.
    const yx0 = -x + glassW + w * 0.19, yx1 = x - 1.2;
    for (let i = 0; i < 5; i++) {
      const cz = -z + 2.4 + (i / 4) * (d - 5.6);
      m.box([yx0, 0.1, cz - 0.7], [yx1, 0.72, cz + 0.7], MAT.CONCRETE);
      m.painted(TINT.GREEN, () => {
        m.box([yx0 + 0.2, 0.72, cz - 0.55], [yx1 - 0.2, 1.24, cz + 0.55], MAT.TRIM);
      });
    }
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 4; i++) {
        const px = yx0 + (i / 4) * (yx1 - yx0);
        for (const pz of [-z + 1.2, z - 1.2]) {
          m.cylinder(px, pz, 0.12, 0.1, 3.0, 6, MAT.TRIM, false);
        }
        m.box([px - 0.1, 3.0, -z + 1.2], [px + 0.1, 3.16, z - 1.2], MAT.TRIM);
      }
    });
    band(m, -x, -z, -x + glassW, z, 1.0, 0.3, 0.2, T.trim);
  }
  if (fine) {
    entrance(m, { axis: 'z', sign: 1, plane: z }, -x + glassW * 0.5,
      { width: 3.4, height: 3.0, double: true, glazed: true, canopy: 2.0 });
    fasciaSign(m, { axis: 'z', sign: 1, plane: -x + glassW + w * 0.16 > 0 ? z : z },
      -x + glassW * 0.2, -x + glassW * 0.8, 2.4, 3.3);
    awning(m, { axis: 'z', sign: 1, plane: -x + glassW + w * 0.16 }, -z + 0.8, -z + d * 0.40,
      eaves - 0.6, 1.6);
    // A few trees for sale in the corner, and the trolley bay.
    for (let i = 0; i < 3; i++) tree(m, x - 3.0, -z + 3.0 + i * 3.2, 3.4, 1.3);
    for (let i = 0; i < 3; i++) planter(m, -x + glassW * 0.3 + i * 2.4, z - 1.6, 0.7, 0.6);
    railing(m, x - 7.0, x - 1.4, -z + 1.0, 0.1, 1.0);
    frontage(m, -x, -x + glassW, z + 0.5, seed, { planters: 0, bollards: 6 });
    kerb(m, -x - 0.8, z + 0.6, x + 0.8, z + 1.5);
  }
  return m;
}

