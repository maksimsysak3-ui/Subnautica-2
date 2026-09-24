/**
 * The other half of a high street, and the workaday end of an office district.
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
 *
 * Three offices too, for the same reason and a worse one: `office|medium` held
 * two plans, so one pair of buildings in every two along a mid-rise office
 * street was a matching pair. A courtyard block, an L wrapping a corner and a
 * terrace of small units are three different *plans* rather than three
 * elevations of a rectangle, which is what the bucket was short of.
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
import { parkedVehicle } from './vehicles';

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
    // The stock: two rows nose-out to the street, one to a bay, the front row
    // full and the back row with the gaps where the week's sales were -- and
    // clear of the bin store in the back corner.
    const bay = (w - 3.2) / 6;
    const rows = [-z + back + 4.6, z - 4.4];
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < 6; i++) {
        if (r === 0 && i >= 4) continue;
        const k = seed * 17 + r * 7 + i;
        if (r === 0 && ((k * 2654435761) >>> 0) % 100 < 35) continue;
        parkedVehicle(m, k, -x + 1.6 + (i + 0.5) * bay, rows[r], 1, 'car');
      }
    }
    // Bunting along the front, the one thing every forecourt dealer has.
    m.painted(TINT.METAL_DARK, () => {
      for (const px of [-x + 0.6, x - 5.0]) m.pipe([px, 0.12, z - 1.2], [px, 4.2, z - 1.2], 0.07, MAT.TRIM, 6);
      m.pipe([-x + 0.6, 4.1, z - 1.2], [x - 5.0, 4.1, z - 1.2], 0.02, MAT.TRIM, 3);
    });
    m.painted(TINT.BRAND, () => {
      for (let fx = -x + 1.4; fx < x - 5.4; fx += 1.1) {
        m.box([fx - 0.22, 3.55, z - 1.23], [fx + 0.22, 4.08, z - 1.17], MAT.TRIM);
      }
    });
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
    // Cars in for work, waiting in front of the doors.
    for (let i = 0; i < 2; i++) {
      parkedVehicle(m, _seed * 11 + i, -x + 1.6 + (i * 2 + 1) * ((w - office - 3.2) / 4) - 1.0,
        z - d * 0.30 + 2.5, 1, i === 1 ? 'van' : 'car');
    }
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


// -------------------------------------------------------------------- office

/**
 * An office round a courtyard.
 *
 * The one office plan that is not a solid block, and from the camera this game
 * is played at that is the whole difference: a hole in the middle, a planted
 * court at the bottom of it, and glazing looking both ways. Four ranges rather
 * than one, so the roofline has corners in it.
 */
export function courtyardOffice(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const [w, d] = plotOf(T, 30.0, 27.0);
  const x = w / 2, z = d / 2;
  const floors = storeysOf(T, 4);
  const base = T.floorH * 1.4;
  const wall = base + (floors - 1) * T.floorH;
  const range = Math.min(w, d) * 0.26;        // depth of each range
  const cx0 = -x + range, cz0 = -z + range, cx1 = x - range, cz1 = z - range;

  // Four ranges, drawn as four boxes rather than as a ring with a hole: the
  // mesh is additive, so a hole has to be left rather than cut.
  m.box([-x, 0, -z], [x, wall, cz0], T.wall, { roof: T.cover });
  m.box([-x, 0, cz1], [x, wall, z], T.wall, { roof: T.cover });
  m.box([-x, 0, cz0], [cx0, wall, cz1], T.wall, { roof: T.cover });
  m.box([cx1, 0, cz0], [x, wall, cz1], T.wall, { roof: T.cover });
  // The court floor, and the way in through the street range.
  m.box([cx0, 0, cz0], [cx1, 0.12, cz1], MAT.CONCRETE);
  m.box([-3.0, 0, cz1 - 0.2], [3.0, base, z + 0.1], T.base, { roof: MAT.ROOF });

  if (medium) {
    band(m, -x, -z, x, z, base, 0.42, 0.26, T.trim);
    parapet(m, -x, -z, x, z, wall, 0.95, 0.24, T.base);
    // The inside faces of the court get their own parapet, which is what makes
    // the hole read as a court rather than as a slot.
    parapet(m, cx0, cz0, cx1, cz1, wall, 0.7, -0.18, T.base);
    roofClutter(m, -x + 1.6, -z + 1.6, x - 1.6, cz0 - 1.0, wall, seed, 0.7);
    for (const [px, pz] of [[cx0 + 2.2, cz0 + 2.2], [cx1 - 2.2, cz0 + 2.2],
      [cx0 + 2.2, cz1 - 2.2], [cx1 - 2.2, cz1 - 2.2]] as const) {
      planter(m, px, pz, 1.2, 0.6);
    }
    for (const px of [cx0 + 5.4, cx1 - 5.4]) tree(m, px, (cz0 + cz1) / 2, 5.2, 1.9);
  }
  if (fine) {
    // Outside and inside both glazed, which is the point of the plan.
    for (const wl of [
      { axis: 'z', sign: 1, plane: z } as Wall, { axis: 'z', sign: -1, plane: -z } as Wall,
      { axis: 'x', sign: 1, plane: x } as Wall, { axis: 'x', sign: -1, plane: -x } as Wall,
    ]) {
      const [u0, u1] = wl.axis === 'x' ? [-z + 1.0, z - 1.0] : [-x + 1.0, x - 1.0];
      punched(m, T, wl, u0, u1, { floors, base: 0.9 });
    }
    for (const wl of [
      { axis: 'z', sign: -1, plane: cz1 } as Wall, { axis: 'z', sign: 1, plane: cz0 } as Wall,
      { axis: 'x', sign: -1, plane: cx1 } as Wall, { axis: 'x', sign: 1, plane: cx0 } as Wall,
    ]) {
      const [u0, u1] = wl.axis === 'x' ? [cz0 + 1.0, cz1 - 1.0] : [cx0 + 1.0, cx1 - 1.0];
      ribbon(m, wl, u0, u1, base + 0.7, wall - 1.0, { mullions: 7 });
    }
    entrance(m, { axis: 'z', sign: 1, plane: z + 0.1 }, 0,
      { width: 3.0, height: 3.2, double: true, glazed: true, canopy: 2.0 });
    frontage(m, -x, x, z + 0.55, seed, { planters: 3, bollards: 8 });
    kerb(m, -x - 0.8, z + 0.5, x + 0.8, z + 1.4);
  }
  return m;
}

/**
 * An office on a corner, with a lower wing.
 *
 * An L, and the crook of the L is a yard. Two masses of different heights
 * meeting at a right angle is the cheapest way to make a building read as
 * having been added to over time, which is what most real offices of this size
 * look like and what a single extruded rectangle never does.
 */
export function annexeOffice(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const [w, d] = plotOf(T, 30.0, 21.0);
  const x = w / 2, z = d / 2;
  const tall = storeysOf(T, 5), low = storeysOf(T, 2);
  const base = T.floorH * 1.4;
  const head = base + (tall - 1) * T.floorH;
  const wingHead = base + (low - 1) * T.floorH;
  const armX = w * 0.44;                     // where the tall block ends

  m.box([-x, 0, -z], [-x + armX, head, z], T.wall, { roof: T.cover });
  m.box([-x + armX, 0, -z], [x, wingHead, -z + d * 0.62], T.wall, { roof: T.cover });
  if (T.roof !== 'flat') {
    roofOver(m, T, -x, -z, -x + armX, z, head, { along: 'z' });
    roofOver(m, T, -x + armX, -z, x, -z + d * 0.62, wingHead, { along: 'x' });
  }
  // The stair, expressed on the inside corner, taller than both.
  m.box([-x + armX - 2.6, 0, -z + d * 0.62 - 0.6], [-x + armX + 0.6, head + 2.4, -z + d * 0.62 + 2.6],
    T.base, { roof: MAT.ROOF });

  if (medium) {
    band(m, -x, -z, -x + armX, z, base, 0.42, 0.26, T.trim);
    if (T.roof === 'flat') {
      parapet(m, -x, -z, -x + armX, z, head, 0.9, 0.22, T.base);
      parapet(m, -x + armX, -z, x, -z + d * 0.62, wingHead, 0.8, 0.2, T.base);
    }
    parapet(m, -x + armX - 2.6, -z + d * 0.62 - 0.6, -x + armX + 0.6, -z + d * 0.62 + 2.6,
      head + 2.4, 0.7, 0.16, T.base);
    roofClutter(m, -x + 1.6, -z + 1.6, -x + armX - 1.6, z - 1.6, head, seed, 0.6);
    // The yard in the crook, with its bays marked and a hedge to the street.
    m.box([-x + armX + 0.8, 0, -z + d * 0.62 + 0.4], [x - 0.6, 0.12, z - 0.6], MAT.CONCRETE);
    hedge(m, -x + armX + 0.8, z - 0.9, x - 0.6, z - 0.3, 0.8);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 4; i++) {
        const px = -x + armX + 2.4 + i * ((w - armX - 4.0) / 3);
        m.box([px - 0.06, 0.12, -z + d * 0.62 + 1.2], [px + 0.06, 0.15, z - 1.4], MAT.TRIM);
      }
    });
  }
  if (fine) {
    for (const wl of [
      { axis: 'z', sign: 1, plane: z } as Wall, { axis: 'x', sign: -1, plane: -x } as Wall,
      { axis: 'z', sign: -1, plane: -z } as Wall,
    ]) {
      const [u0, u1] = wl.axis === 'x' ? [-z + 1.0, z - 1.0] : [-x + 1.0, -x + armX - 1.0];
      punched(m, T, wl, u0, u1, { floors: tall, base: 0.9 });
    }
    punched(m, T, { axis: 'z', sign: -1, plane: -z }, -x + armX + 1.0, x - 1.0,
      { floors: low, base: 0.9 });
    punched(m, T, { axis: 'x', sign: 1, plane: x }, -z + 1.0, -z + d * 0.62 - 1.0,
      { floors: low, base: 0.9 });
    ribbon(m, { axis: 'z', sign: 1, plane: -z + d * 0.62 }, -x + armX + 1.2, x - 1.2,
      1.0, wingHead - 1.0, { mullions: 6 });
    entrance(m, { axis: 'z', sign: 1, plane: z }, -x + armX * 0.5,
      { width: 2.8, height: 3.0, double: true, glazed: true, canopy: 1.8 });
    serviceYard(m, x - 7.0, x - 1.0, -z + d * 0.62 + 0.8, seed,
      { totem: false, flag: false, cycles: true, bins: true });
    kerb(m, -x - 0.8, z + 0.5, x + 0.8, z + 1.4);
  }
  return m;
}

/**
 * A terrace of small business units.
 *
 * Six shells with a roller door and a personnel door each, a shallow pitch
 * over the lot, and a strip of parking in front. The bottom of the office
 * market, which every real business park is made of, and the thing the library
 * had nothing between a studio and a campus for.
 */
export function unitTerrace(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const [w, d] = plotOf(T, 30.0, 22.0);
  const x = w / 2, z = d / 2;
  const UNITS = 6;
  const eaves = 5.4;
  const depth = d * 0.52;

  m.box([-x, 0, -z], [x, 0.1, z], MAT.CONCRETE);
  m.box([-x, 0.1, -z], [x, eaves, -z + depth], MAT.SHED_WALL, { roof: MAT.ROOF });
  if (T.roof === 'flat') {
    parapet(m, -x, -z, x, -z + depth, eaves, 0.6, 0.2, MAT.METAL);
  } else {
    roofOver(m, T, -x, -z, x, -z + depth, eaves, { along: 'x' });
  }

  if (medium) {
    // The party walls, standing proud, which is what makes six units read as
    // six units rather than as one long shed.
    for (let i = 1; i < UNITS; i++) {
      const px = -x + (i / UNITS) * w;
      m.box([px - 0.22, 0.1, -z], [px + 0.22, eaves + 0.5, -z + depth + 0.36], T.base);
    }
    band(m, -x, -z, x, -z + depth, eaves - 1.4, 0.34, 0.24, MAT.METAL);
    // The parking strip.
    m.painted(TINT.NONE, () => {
      for (let i = 0; i <= UNITS * 2; i++) {
        const px = -x + 0.8 + (i / (UNITS * 2)) * (w - 1.6);
        m.box([px - 0.06, 0.1, -z + depth + 1.6], [px + 0.06, 0.13, z - 1.2], MAT.TRIM);
      }
    });
    hedge(m, -x, z - 1.0, x, z - 0.4, 0.7);
    roofClutter(m, -x + 2.0, -z + 1.6, x - 2.0, -z + depth - 1.6, eaves, seed, 0.4);
  }
  if (fine) {
    for (let i = 0; i < UNITS; i++) {
      const c = -x + ((i + 0.5) / UNITS) * w;
      const bay = w / UNITS;
      m.painted(TINT.METAL_DARK, () => {
        m.box([c - bay * 0.28, 0.1, -z + depth - 0.06], [c + bay * 0.28, 3.8, -z + depth + 0.14],
          MAT.METAL);
        for (let k = 0; k < 9; k++) {
          m.box([c - bay * 0.28, 0.4 + k * 0.38, -z + depth + 0.14],
            [c + bay * 0.28, 0.54 + k * 0.38, -z + depth + 0.2], MAT.TRIM);
        }
      });
      entrance(m, { axis: 'z', sign: 1, plane: -z + depth }, c + bay * 0.36,
        { width: 1.0, height: 2.2, fanlight: false });
      m.opening({ axis: 'z', sign: 1, plane: -z + depth, u0: c + bay * 0.3, u1: c + bay * 0.42,
        y0: 3.0, y1: 4.4, glass: MAT.PANE, frame: 0.1, proud: 0.06 });
    }
    louvres(m, { axis: 'x', sign: 1, plane: x }, -z + 1.2, -z + 4.0, 3.4, 4.6, 0.3);
    bollards(m, { axis: 'z', sign: 1, plane: z }, -x + 1.0, x - 1.0, 1.4, 7);
    kerb(m, -x - 0.8, z + 0.6, x + 0.8, z + 1.6);
  }
  return m;
}
