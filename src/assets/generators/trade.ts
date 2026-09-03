/**
 * Shops, offices and works, organised by the same five themes as housing.
 *
 * A district is not made of housing alone. A European street with a North
 * American strip mall on the corner reads wrong in the same way a European
 * street with a ranch house on it does, so the other three zoned categories
 * get the same treatment: five plans each, built five times over in the five
 * themes, with the theme deciding material, roof, rhythm and ornament.
 *
 * The plans are chosen to be the ones every city actually has, rather than
 * the ones that are fun to model: a corner shop, a parade, a market, a big
 * box, an hotel; a studio, a mid-rise, a tower, a campus, a conversion; a
 * workshop, a shed, a works, a yard, a mill.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import { idSeed } from '../types';
import type { AssetDef, Density, Zone } from '../types';
import { THEMES, THEME_ORDER, THEME_KEY } from '../themes';
import type { Theme, ThemeProfile } from '../themes';
import {
  roofOver, punched, banded, doorway, crown, plotOf, storeysOf, topMass,
} from '../themed-parts';
import { BRANDS } from '../brands';
import type { Brand } from '../types';
import { hash2 } from '../../sim/hash';
import {
  awning, band, bladeSign, bollards, boxSign, entrance, fasciaSign, fins, frontage, kerb,
  louvres, parapet, planter, portal, pylonSign, railing, ribbon, roofClutter,
  serviceYard, shopfront, windowGrid,
} from '../parts';
import type { Wall } from '../parts';
import { parkedVehicle } from './vehicles';

// -------------------------------------------------------------- commercial

/** A corner shop with the shopkeeper's flat over it. */
function cornerShop(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const [w, d] = plotOf(T, 12.0, 10.5);
  const shop = 4.0;
  const x = w / 2, z = d / 2;
  const wall = shop + 2 * T.floorH;

  m.box([-x, 0, -z], [x, shop, z], T.base, { roof: T.cover });
  m.box([-x, shop, -z], [x, wall, z], T.wall, { roof: T.cover });
  roofOver(m, T, -x, -z, x, z, wall, { along: 'x', dormers: medium ? 2 : 0 });

  if (medium) {
    band(m, -x, -z, x, z, shop, 0.36, 0.2, T.trim);
    if (T.chimney) m.box([x - 2.0, wall - 0.4, -1.0], [x - 1.0, wall + 2.6, 0.2], T.base);
    awning(m, { axis: 'z', sign: 1, plane: z }, -x + 0.8, x - 0.8, shop - 1.1, 1.5);
  }
  if (fine) {
    shopfront(m, { axis: 'z', sign: 1, plane: z }, -x + 0.6, x - 0.6,
      { bays: 3, doorBay: 2, head: shop - 0.9, fascia: 0.9 });
    fasciaSign(m, { axis: 'z', sign: 1, plane: z }, -x + 1.4, x - 1.4, shop - 0.85, shop - 0.15);
    bladeSign(m, { axis: 'x', sign: 1, plane: x }, -z + 2.6, shop - 2.2, shop - 0.4);
    punched(m, T, { axis: 'z', sign: 1, plane: z }, -x + 0.8, x - 0.8, { floors: 2, base: shop + 0.9 });
    for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
      punched(m, T, { axis: 'x', sign, plane }, -z + 1.0, z - 1.0, { floors: 2, base: shop + 0.9 });
    }
    doorway(m, T, { axis: 'x', sign: -1, plane: -x }, -z + 2.2);
    frontage(m, -x, x, z, seed, { planters: 2, bollards: 4, bin: true });
  }
  return m;
}

/** A parade: four units under one roof, which is how a suburb shops. */
function parade(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const [w, d] = plotOf(T, 27.0, 13.0);
  const shop = 4.4, units = 4;
  const x = w / 2, z = d / 2;
  const wall = shop + T.floorH * (T.id === 'modern' ? 1 : 2);

  m.box([-x, 0, -z], [x, shop, z], T.base, { roof: T.cover });
  m.box([-x + 0.4, shop, -z], [x - 0.4, wall, z], T.wall, { roof: T.cover });
  roofOver(m, T, -x + 0.4, -z, x - 0.4, z, wall, { along: 'x' });

  if (medium) {
    band(m, -x, -z, x, z, shop, 0.42, 0.24, T.trim);
    // Colonnade: what a parade is, and what keeps the rain off the fronts.
    m.box([-x, shop - 1.2, z], [x, shop - 0.7, z + 3.0], T.base);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= units; i++) {
        const px = -x + (i / units) * w;
        m.box([px - 0.2, 0, z + 2.5], [px + 0.2, shop - 1.2, z + 2.9], MAT.TRIM);
      }
    });
    kerb(m, -x, z + 3.0, x, z + 4.4);
  }
  if (fine) {
    for (let i = 0; i < units; i++) {
      const a = -x + (i / units) * w + 0.6;
      const b = -x + ((i + 1) / units) * w - 0.6;
      shopfront(m, { axis: 'z', sign: 1, plane: z }, a, b,
        { bays: 3, doorBay: i % 3, head: shop - 1.5, fascia: 0.9 });
      fasciaSign(m, { axis: 'z', sign: 1, plane: z }, a + 0.8, b - 0.8, shop - 1.45, shop - 0.75);
      if (i % 2 === 0) awning(m, { axis: 'z', sign: 1, plane: z }, a + 0.3, b - 0.3, shop - 1.6, 1.2);
    }
    punched(m, T, { axis: 'z', sign: 1, plane: z }, -x + 1.2, x - 1.2,
      { floors: T.id === 'modern' ? 1 : 2, base: shop + 0.9 });
    punched(m, T, { axis: 'z', sign: -1, plane: -z }, -x + 1.2, x - 1.2,
      { floors: T.id === 'modern' ? 1 : 2, base: shop + 0.9 });
    for (let i = 0; i < units; i++) {
      const u = -x + ((i + 0.5) / units) * w;
      m.opening({ axis: 'z', sign: -1, plane: -z, u0: u - 0.55, u1: u + 0.55, y0: 0.16, y1: 2.3,
        glass: MAT.TRIM, frame: 0.1, proud: 0.07 });
    }
    serviceYard(m, -x, x, -z - 8.0, seed, { bins: true, cycles: true });
    bollards(m, { axis: 'z', sign: 1, plane: z }, -x + 1.0, x - 1.0, 3.6, 8);
  }
  return m;
}

/** A covered market: one hall, a lantern roof, stalls inside. */
function market(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const [w, d] = plotOf(T, 26.0, 19.0);
  const x = w / 2, z = d / 2;
  const eave = 7.6;

  // Arcaded base, open at the ends: the hall is the building.
  m.box([-x, 0, -z], [x, 0.5, z], T.base);
  for (const [sign, plane] of [[1, z], [-1, -z]] as const) {
    m.box([-x, 0.5, plane - sign * 0.55], [x, eave, plane], T.wall);
    void sign;
  }
  for (const px of [-x, x - 0.55]) m.box([px, 0.5, -z], [px + 0.55, eave, z], T.wall);
  const top = roofOver(m, T, -x, -z, x, z, eave, { along: 'x' });

  if (medium) {
    // Lantern along the ridge, which is how a market hall is daylit.
    const ly = T.roof === 'flat' ? eave + 0.2 : eave + (top - eave) * 0.55;
    m.box([-x + 4.0, ly, -2.2], [x - 4.0, ly + 1.6, 2.2], MAT.GLASS);
    m.box([-x + 4.2, ly + 1.6, -2.4], [x - 4.2, ly + 1.9, 2.4], T.cover);
    // Piers between the arches.
    for (let i = 0; i <= 6; i++) {
      const px = -x + (i / 6) * w;
      for (const pz of [-z, z - 0.7]) m.box([px - 0.45, 0, pz], [px + 0.45, eave, pz + 0.7], T.base);
    }
    // Stalls inside, read through the arches.
    for (let i = 0; i < 6; i++) {
      const cx = -x + 3.0 + (i % 3) * 8.0;
      const cz = -z + 5.0 + Math.floor(i / 3) * 9.0;
      m.painted(i % 2 === 0 ? TINT.AWNING : TINT.BRAND, () =>
        m.box([cx - 2.2, 2.3, cz - 1.5], [cx + 2.2, 2.6, cz + 1.5], MAT.TRIM));
      m.box([cx - 2.0, 0, cz - 1.3], [cx + 2.0, 0.9, cz + 1.3], MAT.TRIM);
      m.painted(TINT.METAL_DARK, () => {
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          m.box([cx + sx * 2.1 - 0.05, 0, cz + sz * 1.4 - 0.05],
                [cx + sx * 2.1 + 0.05, 2.3, cz + sz * 1.4 + 0.05], MAT.TRIM);
        }
      });
    }
  }
  if (fine) {
    for (let i = 0; i < 6; i++) {
      const a = -x + (i / 6) * w + 0.6, b = -x + ((i + 1) / 6) * w - 0.6;
      for (const [sign, plane] of [[1, z], [-1, -z]] as const) {
        m.opening({ axis: 'z', sign, plane, u0: a, u1: b, y0: 0.6, y1: eave - 1.4,
          glass: MAT.SHOPFRONT, frame: 0.16, proud: 0.1 });
      }
    }
    boxSign(m, { axis: 'z', sign: 1, plane: z }, -6.0, 6.0, eave - 1.2, eave - 0.2);
    entrance(m, { axis: 'x', sign: 1, plane: x }, 0, { width: 3.0, height: 3.4, double: true, glazed: true });
    frontage(m, -x, x, z + 0.6, seed, { planters: 3, bollards: 8 });
    roofClutter(m, -x + 3, -z + 3, x - 3, z - 3, eave, seed, 0.3);
  }
  return m;
}

/** The big box: one shed, one sign, a car park in front of it. */
function bigBox(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const [w, d] = plotOf(T, 30.0, 22.0);
  const h = 9.0;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], T.wall, { roof: MAT.ROOF });
  // The entrance block, brought forward and taller: the only articulation a
  // box like this ever gets, and without it the thing is a crate.
  m.box([-8.0, 0, z], [2.0, h + 2.2, z + 3.4], T.base, { roof: MAT.ROOF });
  parapet(m, -x, -z, x, z, h, 1.2, 0.3, T.base);
  parapet(m, -8.0, z, 2.0, z + 3.4, h + 2.2, 1.0, 0.24, T.base);

  if (medium) {
    band(m, -x, -z, x, z, 4.6, 0.5, 0.26, T.trim);
    if (T.id === 'asian' || T.id === 'farming' || T.id === 'european') {
      // A tiled canopy over the front, which is what stops the box reading as
      // a North American one in the other three themes.
      roofOver(m, T, -8.4, z, 2.4, z + 3.6, h + 2.2);
    }
    // Trolley bays and lighting columns in the car park.
    m.painted(TINT.METAL_DARK, () => {
      for (const cx of [-x + 6.0, x - 6.0]) {
        m.pipe([cx, 0, z + 12.0], [cx, 7.2, z + 12.0], 0.14, MAT.TRIM, 6);
        m.box([cx - 1.5, 7.0, z + 11.8], [cx + 1.5, 7.3, z + 12.2], MAT.TRIM);
      }
    });
    m.box([-x, 0.01, z + 4.0], [x, 0.07, z + 15.0], MAT.GROUND);
  }
  if (fine) {
    for (let i = 0; i < 3; i++) {
      m.opening({ axis: 'z', sign: 1, plane: z + 3.4, u0: -7.2 + i * 3.0, u1: -5.0 + i * 3.0,
        y0: 0.2, y1: 3.6, glass: MAT.SHOPFRONT, frame: 0.14, proud: 0.09 });
    }
    entrance(m, { axis: 'z', sign: 1, plane: z + 3.4 }, 1.0,
      { width: 2.6, height: 3.4, double: true, glazed: true });
    boxSign(m, { axis: 'z', sign: 1, plane: z + 3.4 }, -6.4, 0.4, h - 1.6, h + 0.6);
    pylonSign(m, x - 3.0, z + 13.0, 7.5, 2.8);
    // Cars in the car park: the thing that makes a retail park read as one.
    for (let i = 0; i < 8; i++) {
      const cx = -x + 3.2 + (i % 4) * 7.0;
      const cz = z + 6.5 + Math.floor(i / 4) * 5.4;
      parkedVehicle(m, seed * 31 + i, cx, cz, 0, i === 3 ? 'van' : 'car');
    }
    portal(m, -x + 2.0, -x + 8.0, -z, 4.4, 0);
    serviceYard(m, -x, x - 8.0, -z - 9.0, seed, { bins: true, totem: true });
    roofClutter(m, -x + 3, -z + 3, x - 3, z - 3, h, seed, 1.1);
  }
  return m;
}

/** Somewhere to stay: a hotel, a motel or an inn, depending on the theme. */
function lodging(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const motel = T.id === 'american';
  const [w, d] = plotOf(T, motel ? 28.0 : 20.0, motel ? 12.0 : 16.0);
  const x = w / 2, z = d / 2;
  const floors = storeysOf(T, motel ? 2 : 6);
  const ground = T.floorH + 0.8;
  const wall = ground + floors * T.floorH;

  m.box([-x, 0, -z], [x, ground, z], T.base, { roof: T.cover });
  m.box([-x, ground, -z], [x, wall, z], T.wall, { roof: T.cover });
  const top = roofOver(m, T, -x, -z, x, z, wall, { along: 'x', dormers: medium ? 3 : 0 });

  if (medium) {
    band(m, -x, -z, x, z, ground, 0.4, 0.24, T.trim);
    // Porte-cochere over the entrance, which every hotel has and no shop does.
    m.box([-3.6, ground - 0.6, z], [3.6, ground - 0.2, z + 4.2], T.base);
    m.painted(TINT.METAL_DARK, () => {
      for (const px of [-3.2, 3.2]) m.pipe([px, 0, z + 3.8], [px, ground - 0.6, z + 3.8], 0.16, MAT.TRIM, 8);
    });
    if (motel) {
      // Deck access along the front: the motel in one move.
      m.box([-x, T.floorH + 0.6, z], [x, T.floorH + 0.8, z + 1.8], MAT.CONCRETE);
      railing(m, -x, x, z + 1.7, T.floorH + 0.8, 1.05, 1.5);
      m.painted(TINT.METAL_DARK, () => {
        for (let i = 0; i <= 6; i++) {
          const px = -x + (i / 6) * w;
          m.pipe([px, 0, z + 1.7], [px, T.floorH + 0.6, z + 1.7], 0.09, MAT.TRIM, 6);
        }
      });
    } else if (T.balcony !== 'none') {
      for (let f = 1; f < floors; f++) {
        const y = ground + f * T.floorH;
        m.box([-x - 0.9, y - 0.16, -z - 0.9], [x + 0.9, y, z + 0.9], MAT.CONCRETE);
        railing(m, -x - 0.85, x + 0.85, z + 0.85, y, 1.0, 1.6);
      }
    }
    if (T.chimney) m.box([-x + 2.0, wall - 0.4, -1.0], [-x + 3.2, top + 1.4, 0.4], T.base);
  }
  if (fine) {
    punched(m, T, { axis: 'z', sign: 1, plane: z }, -x + 1.0, x - 1.0, { floors, base: ground + 0.9 });
    punched(m, T, { axis: 'z', sign: -1, plane: -z }, -x + 1.0, x - 1.0, { floors, base: ground + 0.9 });
    for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
      punched(m, T, { axis: 'x', sign, plane }, -z + 1.0, z - 1.0, { floors, base: ground + 0.9 });
    }
    if (motel) {
      for (let i = 0; i < 6; i++) {
        entrance(m, { axis: 'z', sign: 1, plane: z }, -x + 2.4 + i * 4.6, { width: 1.0, height: 2.1 });
      }
    }
    ribbon(m, { axis: 'z', sign: 1, plane: z }, -x + 1.2, -4.4, 1.2, ground - 0.9, { mullions: 4 });
    ribbon(m, { axis: 'z', sign: 1, plane: z }, 4.4, x - 1.2, 1.2, ground - 0.9, { mullions: 4 });
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0, { width: 2.8, height: 3.0, double: true, glazed: true });
    boxSign(m, { axis: 'z', sign: 1, plane: z }, -4.0, 4.0, ground + 0.1, ground + 1.1);
    parkedVehicle(m, seed + 5, x - 4.0, z + 6.0, 0, 'car');
    parkedVehicle(m, seed + 9, x - 10.0, z + 6.0, 0, 'car');
    frontage(m, -x, x, z + 4.6, seed, { planters: 2, bollards: 6 });
  }
  return m;
}

// ------------------------------------------------------------------ office

/** A studio: two storeys of small suites over a lobby. */
function studio(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const [w, d] = plotOf(T, 18.0, 13.0);
  const x = w / 2, z = d / 2;
  const floors = storeysOf(T, 3);
  const wall = floors * T.floorH + 0.5;

  m.box([-x, 0, -z], [x, wall, z], T.wall, { roof: T.cover });
  m.box([-x - 0.3, 0, -z - 0.3], [x + 0.3, 1.0, z + 0.3], T.base);
  roofOver(m, T, -x, -z, x, z, wall, { along: 'x' });

  if (medium) {
    band(m, -x, -z, x, z, T.floorH + 0.2, 0.3, 0.16, T.trim);
    // Glazed stair, expressed on the front: a small office's one gesture.
    m.box([-2.6, 0, z], [2.6, wall + 0.6, z + 1.6], T.base, { roof: MAT.ROOF });
    parapet(m, -2.6, z, 2.6, z + 1.6, wall + 0.6, 0.7, 0.14, T.base);
    if (T.id === 'modern') fins(m, { axis: 'z', sign: 1, plane: z }, -x + 0.8, -3.0, 1.2, wall - 0.6, 6);
  }
  if (fine) {
    for (const wl of [{ axis: 'z', sign: 1, plane: z } as Wall, { axis: 'z', sign: -1, plane: -z } as Wall]) {
      if (T.ribbon) banded(m, T, wl, -x + 0.9, x - 0.9, floors, 0);
      else punched(m, T, wl, -x + 0.9, x - 0.9, { floors, base: 1.0 });
    }
    for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
      punched(m, T, { axis: 'x', sign, plane }, -z + 1.0, z - 1.0, { floors, base: 1.0 });
    }
    for (let f = 0; f < floors; f++) {
      m.opening({ axis: 'z', sign: 1, plane: z + 1.6, u0: -2.0, u1: 2.0,
        y0: f * T.floorH + 0.7, y1: f * T.floorH + 2.6, glass: MAT.GLASS, frame: 0.12, proud: 0.08 });
    }
    doorway(m, T, { axis: 'z', sign: 1, plane: z + 1.6 }, 0, true);
    boxSign(m, { axis: 'z', sign: 1, plane: z + 1.6 }, -2.2, 2.2, wall + 0.7, wall + 1.5);
    frontage(m, -x, x, z + 2.0, seed, { planters: 3, bollards: 5 });
    roofClutter(m, -x + 2, -z + 2, x - 2, z - 2, wall, seed, 0.5);
  }
  return m;
}

/** A mid-rise: the building most of a city's work happens in. */
function midrise(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const [w, d] = plotOf(T, 24.0, 17.0);
  const x = w / 2, z = d / 2;
  const floors = storeysOf(T, 7);
  const ground = T.floorH + 1.4;
  const wall = ground + floors * T.floorH;

  m.box([-x, 0, -z], [x, ground, z], T.base, { roof: MAT.ROOF });
  m.box([-x + 0.5, ground, -z + 0.5], [x - 0.5, wall, z - 0.5], T.wall, { roof: T.cover });
  crown(m, T, -x + 0.5, -z + 0.5, x - 0.5, z - 0.5, wall, seed);

  if (medium) {
    band(m, -x, -z, x, z, ground, 0.5, 0.28, T.trim);
    parapet(m, -x, -z, x, z, ground, 1.0, 0.2, T.base);
    if (T.id === 'modern') {
      for (const wl of [{ axis: 'z', sign: 1, plane: z - 0.5 } as Wall, { axis: 'z', sign: -1, plane: -z + 0.5 } as Wall]) {
        fins(m, wl, -x + 1.4, x - 1.4, ground, wall - 0.4, 9);
      }
    }
  }
  if (fine) {
    for (const wl of [
      { axis: 'z', sign: 1, plane: z - 0.5 } as Wall, { axis: 'z', sign: -1, plane: -z + 0.5 } as Wall,
      { axis: 'x', sign: 1, plane: x - 0.5 } as Wall, { axis: 'x', sign: -1, plane: -x + 0.5 } as Wall,
    ]) {
      const [u0, u1] = wl.axis === 'x' ? [-z + 1.4, z - 1.4] : [-x + 1.4, x - 1.4];
      if (T.ribbon) banded(m, T, wl, u0, u1, floors, ground);
      else punched(m, T, wl, u0, u1, { floors, base: ground + 0.9 });
    }
    ribbon(m, { axis: 'z', sign: 1, plane: z }, -x + 1.0, -3.4, 1.2, ground - 1.0, { mullions: 5 });
    ribbon(m, { axis: 'z', sign: 1, plane: z }, 3.4, x - 1.0, 1.2, ground - 1.0, { mullions: 5 });
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0, { width: 3.0, height: 3.2, double: true, glazed: true, canopy: 2.4 });
    boxSign(m, { axis: 'z', sign: 1, plane: z }, -3.0, 3.0, ground - 0.9, ground - 0.1);
    frontage(m, -x, x, z + 1.2, seed, { planters: 3, bollards: 7 });
  }
  return m;
}

/** A tower: a core, a floorplate and a crown, repeated. */
function tower(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const [w, d] = plotOf(T, 20.0, 18.0);
  const x = w / 2, z = d / 2;
  const floors = storeysOf(T, 18);
  const ground = T.floorH * 1.8;
  const wall = ground + floors * T.floorH;

  m.box([-x - 2.0, 0, -z - 2.0], [x + 2.0, ground, z + 2.0], T.base, { roof: MAT.ROOF });
  m.box([-x, ground, -z], [x, wall, z], T.wall, { roof: T.cover });
  // The theme decides the top: a setback terrace, a plant room and tanks, or
  // a roof straight off the wall head.
  crown(m, T, -x, -z, x, z, topMass(m, T, -x, -z, x, z, wall), seed);

  if (medium) {
    band(m, -x - 2.0, -z - 2.0, x + 2.0, z + 2.0, ground, 0.55, 0.3, T.trim);
    parapet(m, -x - 2.0, -z - 2.0, x + 2.0, z + 2.0, ground, 1.1, 0.22, T.base);
    // Corner piers up the full height, so the shaft is not a plain prism.
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      m.box([sx > 0 ? x - 0.9 : -x, ground, sz > 0 ? z - 0.9 : -z],
            [sx > 0 ? x + 0.4 : -x + 0.9, wall + 0.4, sz > 0 ? z + 0.4 : -z + 0.9], T.base);
    }
  }
  if (fine) {
    for (const wl of [
      { axis: 'z', sign: 1, plane: z } as Wall, { axis: 'z', sign: -1, plane: -z } as Wall,
      { axis: 'x', sign: 1, plane: x } as Wall, { axis: 'x', sign: -1, plane: -x } as Wall,
    ]) {
      const [u0, u1] = wl.axis === 'x' ? [-z + 1.2, z - 1.2] : [-x + 1.2, x - 1.2];
      if (T.ribbon) banded(m, T, wl, u0, u1, floors, ground);
      else punched(m, T, wl, u0, u1, { floors, base: ground + 0.9 });
    }
    for (const [sign, plane] of [[1, z + 2.0], [-1, -z - 2.0]] as const) {
      ribbon(m, { axis: 'z', sign, plane }, -x - 1.0, x + 1.0, 1.4, ground - 1.2, { mullions: 8 });
    }
    entrance(m, { axis: 'z', sign: 1, plane: z + 2.0 }, 0, { width: 3.4, height: 3.6, double: true, glazed: true, canopy: 3.0 });
    boxSign(m, { axis: 'z', sign: 1, plane: z + 2.0 }, -3.4, 3.4, ground - 1.1, ground - 0.2);
    frontage(m, -x - 2.0, x + 2.0, z + 2.6, seed, { planters: 4, bollards: 9 });
  }
  return m;
}

/** A campus: low pavilions round a planted court. */
function campus(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const arm = 26.0, depth = 10.0;
  const half = arm / 2;
  const floors = storeysOf(T, 2);
  const wall = floors * T.floorH + 0.6;

  // Two bars and a link, round three sides of a court.
  m.box([-half, 0, -half], [half, wall, -half + depth], T.wall, { roof: T.cover });
  m.box([-half, 0, half - depth], [half, wall, half], T.wall, { roof: T.cover });
  m.box([-half, 0, -half + depth], [-half + 7.0, wall - T.floorH, half - depth], T.base, { roof: MAT.ROOF });
  roofOver(m, T, -half, -half, half, -half + depth, wall, { along: 'x' });
  roofOver(m, T, -half, half - depth, half, half, wall, { along: 'x' });

  if (medium) {
    band(m, -half, -half, half, -half + depth, T.floorH + 0.2, 0.3, 0.15, T.trim);
    band(m, -half, half - depth, half, half, T.floorH + 0.2, 0.3, 0.15, T.trim);
    parapet(m, -half, -half + depth, -half + 7.0, half - depth, wall - T.floorH, 0.8, 0.16, T.base);
    m.painted(TINT.GREEN, () => m.box([-half + 7.4, 0.01, -half + depth + 0.6], [half - 0.6, 0.08, half - depth - 0.6], MAT.TRIM));
    for (let i = 0; i < 4; i++) planter(m, -half + 11.0 + i * 4.6, 0, 1.1, 0.6);
  }
  if (fine) {
    // Three of the four long elevations; the fourth faces the next plot.
    for (const [zPlane, sign] of [[-half, -1], [half - depth, -1], [half, 1]] as const) {
      const wl: Wall = { axis: 'z', sign, plane: zPlane };
      if (T.ribbon) banded(m, T, wl, -half + 1.2, half - 1.2, floors, 0);
      else punched(m, T, wl, -half + 1.2, half - 1.2, { floors, base: 1.1 });
    }
    for (let f = 0; f < floors - 1; f++) {
      m.opening({ axis: 'x', sign: -1, plane: -half, u0: -half + depth + 1.0, u1: half - depth - 1.0,
        y0: f * T.floorH + 1.0, y1: f * T.floorH + 2.6, glass: MAT.GLASS, frame: 0.12, proud: 0.08 });
    }
    entrance(m, { axis: 'x', sign: -1, plane: -half }, 0, { width: 3.0, height: 3.2, double: true, glazed: true, canopy: 2.6 });
    for (let i = 0; i < 3; i++) parkedVehicle(m, seed * 13 + i, -half + 4.0 + i * 7.0, half + 4.0, 0, 'car');
    frontage(m, -half, half, half + 0.8, seed, { planters: 2, bollards: 6 });
    roofClutter(m, -half + 3, -half + 2, half - 3, -half + depth - 2, wall, seed, 0.4);
  }
  return m;
}

/** A conversion: offices in an older shell, with the shell left showing. */
function conversion(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const [w, d] = plotOf(T, 22.0, 15.0);
  const x = w / 2, z = d / 2;
  const floors = storeysOf(T, 5);
  const wall = floors * T.floorH + 1.2;

  m.box([-x, 0, -z], [x, wall, z], T.wall, { roof: T.cover });
  // A glazed storey added on top, set back: the conversion's giveaway.
  m.box([-x + 2.0, wall, -z + 2.0], [x - 2.0, wall + T.floorH, z - 2.0], MAT.CLADDING, { roof: MAT.ROOF });
  parapet(m, -x, -z, x, z, wall, 0.9, 0.22, T.base);
  parapet(m, -x + 2.0, -z + 2.0, x - 2.0, z - 2.0, wall + T.floorH, 0.7, 0.14, MAT.TRIM);

  if (medium) {
    band(m, -x, -z, x, z, T.floorH + 0.4, 0.34, 0.18, T.trim);
    band(m, -x, -z, x, z, wall - 0.9, 0.4, 0.22, T.trim);
    // Pilasters between bays, which is what an old shell always has.
    for (let i = 0; i <= 5; i++) {
      const px = -x + (i / 5) * w;
      m.box([px - 0.4, 0, z], [px + 0.4, wall - 0.6, z + 0.24], T.base);
    }
    roofClutter(m, -x + 2, -z + 2, x - 2, z - 2, wall, seed, 0.6);
  }
  if (fine) {
    for (let i = 0; i < 5; i++) {
      const a = -x + (i / 5) * w + 0.7, b = -x + ((i + 1) / 5) * w - 0.7;
      punched(m, T, { axis: 'z', sign: 1, plane: z }, a, b, { floors, base: T.floorH + 1.0, skipGround: false });
    }
    punched(m, T, { axis: 'z', sign: -1, plane: -z }, -x + 1.0, x - 1.0, { floors, base: T.floorH + 1.0 });
    for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
      punched(m, T, { axis: 'x', sign, plane }, -z + 1.0, z - 1.0, { floors, base: T.floorH + 1.0 });
    }
    for (const [sign, plane] of [[1, z - 2.0], [-1, -z + 2.0]] as const) {
      ribbon(m, { axis: 'z', sign, plane }, -x + 2.6, x - 2.6, wall + 0.8, wall + T.floorH - 0.5, { mullions: 7 });
    }
    shopfront(m, { axis: 'z', sign: 1, plane: z }, -x + 1.0, -2.4, { bays: 3, doorBay: 1, head: T.floorH, fascia: 0.8 });
    entrance(m, { axis: 'z', sign: 1, plane: z }, 4.0, { width: 2.6, height: 3.0, double: true, glazed: true });
    boxSign(m, { axis: 'z', sign: 1, plane: z }, 1.6, 6.4, T.floorH + 0.5, T.floorH + 1.3);
    frontage(m, -x, x, z + 0.4, seed, { planters: 2, bollards: 6 });
  }
  return m;
}

// -------------------------------------------------------------- industrial

/** A workshop: one bay, a roller shutter, a yard. */
function workshop(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const [w, d] = plotOf(T, 16.0, 12.0);
  const h = 6.0;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], T.id === 'modern' ? MAT.SHED_WALL : T.wall, { roof: MAT.ROOF });
  roofOver(m, T, -x, -z, x, z, h, { along: 'x' });
  // Office end, lower and in the theme's own material.
  m.box([x - 5.0, 0, z], [x, 3.4, z + 4.0], T.base, { roof: MAT.ROOF });
  parapet(m, x - 5.0, z, x, z + 4.0, 3.4, 0.6, 0.14, T.base);

  if (medium) {
    band(m, -x, -z, x, z, 3.2, 0.28, 0.14, T.trim);
    m.painted(TINT.METAL_DARK, () => {
      m.box([-x - 0.2, h - 0.9, z - 0.1], [x - 5.2, h - 0.5, z + 1.7], MAT.TRIM);
      for (const px of [-x + 1.0, -6.0, x - 6.0]) {
        m.pipe([px, h - 0.9, z + 1.5], [px, h - 2.6, z + 0.1], 0.07, MAT.TRIM, 5);
      }
    });
    m.box([-x, 0.01, z + 1.8], [x, 0.07, z + 9.0], MAT.GROUND);
  }
  if (fine) {
    m.painted(TINT.METAL_DARK, () => m.opening({ axis: 'z', sign: 1, plane: z, u0: -x + 1.4, u1: -x + 6.4,
      y0: 0.16, y1: 4.4, glass: MAT.TRIM, frame: 0.16, proud: 0.1 }));
    louvres(m, { axis: 'z', sign: 1, plane: z }, -x + 7.4, x - 6.0, 3.8, 5.4, 5);
    windowGrid(m, { axis: 'z', sign: 1, plane: z + 4.0 }, x - 4.6, x - 0.4,
      { floors: 1, floorH: 3.0, base: 1.1, count: 2, width: 1.4, height: 1.5 });
    entrance(m, { axis: 'z', sign: 1, plane: z + 4.0 }, x - 2.5, { width: 1.1, height: 2.2, steps: 1 });
    for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
      windowGrid(m, { axis: 'x', sign, plane }, -z + 1.4, z - 1.4,
        { floors: 1, floorH: 3.0, base: 3.4, count: 3, width: 1.6, height: 1.2 });
    }
    boxSign(m, { axis: 'z', sign: 1, plane: z + 4.0 }, x - 4.6, x - 0.6, 3.5, 4.3);
    parkedVehicle(m, seed + 3, -3.0, z + 5.6, 0, 'van');
    serviceYard(m, -x, x, z + 9.0, seed, { bins: true, cycles: true });
  }
  return m;
}

/** A distribution shed: the biggest, simplest thing a city builds. */
function shed(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 32.0, d = 22.0, h = 11.0;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], MAT.SHED_WALL, { roof: MAT.ROOF });
  if (T.roof === 'flat') parapet(m, -x, -z, x, z, h, 1.0, 0.24, MAT.METAL);
  else roofOver(m, T, -x, -z, x, z, h, { along: 'x' });
  // Office corner in the theme's material, so the shed is placed somewhere.
  m.box([-x, 0, z - 1.0], [-x + 11.0, 7.4, z + 3.0], T.wall, { roof: MAT.ROOF });
  parapet(m, -x, z - 1.0, -x + 11.0, z + 3.0, 7.4, 0.8, 0.18, T.base);

  if (medium) {
    // Profiled cladding, expressed as ribs: what a shed actually looks like.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 10; i++) {
        const px = -x + (i / 10) * w;
        m.box([px - 0.1, 0, -z - 0.14], [px + 0.1, h, -z], MAT.TRIM);
      }
    });
    band(m, -x, -z, x, z, 4.2, 0.34, 0.16, T.trim);
    // Dock apron and levellers.
    m.box([-x + 11.0, 0, z], [x, 1.2, z + 3.4], MAT.CONCRETE);
    m.box([-x + 8.0, 0.01, z + 3.4], [x + 2.0, 0.07, z + 16.0], MAT.GROUND);
  }
  if (fine) {
    for (let i = 0; i < 5; i++) {
      const cx = -x + 13.5 + i * 3.6;
      m.painted(TINT.METAL_DARK, () => m.opening({ axis: 'z', sign: 1, plane: z, u0: cx - 1.4, u1: cx + 1.4,
        y0: 1.3, y1: 4.6, glass: MAT.TRIM, frame: 0.14, proud: 0.09 }));
      m.box([cx - 1.7, 4.6, z], [cx + 1.7, 5.2, z + 1.3], MAT.METAL);
    }
    ribbon(m, { axis: 'z', sign: 1, plane: z + 3.0 }, -x + 0.8, -x + 10.2, 1.2, 3.0, { mullions: 5 });
    ribbon(m, { axis: 'z', sign: 1, plane: z + 3.0 }, -x + 0.8, -x + 10.2, 4.2, 6.0, { mullions: 5 });
    entrance(m, { axis: 'z', sign: 1, plane: z + 3.0 }, -x + 5.5, { width: 2.4, height: 3.0, double: true, glazed: true });
    boxSign(m, { axis: 'z', sign: 1, plane: z + 3.0 }, -x + 1.6, -x + 9.4, 6.4, 7.3);
    louvres(m, { axis: 'x', sign: -1, plane: -x }, -z + 2.0, z - 6.0, 7.0, 9.4, 8);
    for (let i = 0; i < 3; i++) parkedVehicle(m, seed * 7 + i, -x + 6.0 + i * 9.0, z + 9.5, 0, 'truck');
    roofClutter(m, -x + 3, -z + 3, x - 3, z - 3, h, seed, 0.8);
  }
  return m;
}

/** A works: process plant, silos and a stack. */
function works(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 26.0, d = 20.0, h = 13.0;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x - 9.0, h, z], T.id === 'farming' ? MAT.BRICK : MAT.SHED_WALL, { roof: MAT.ROOF });
  parapet(m, -x, -z, x - 9.0, z, h, 1.0, 0.22, T.base);
  // Silos: the silhouette that says works rather than warehouse.
  for (let i = 0; i < 3; i++) {
    const cx = x - 6.4 + (i % 2) * 5.0;
    const cz = -z + 4.4 + i * 4.6;
    m.cylinder(cx, cz, 2.2, 0, h + 3.0, 12, MAT.METAL);
    m.cone(cx, cz, 2.2, 0.7, h + 3.0, h + 4.6, 12, MAT.METAL);
    m.box([cx - 0.5, h + 4.6, cz - 0.5], [cx + 0.5, h + 5.4, cz + 0.5], MAT.METAL);
  }
  // Stack.
  m.cylinder(-x + 3.6, -z + 3.6, 1.15, 0, h + 12.0, 10, T.id === 'farming' ? MAT.BRICK : MAT.CONCRETE);
  m.cylinder(-x + 3.6, -z + 3.6, 1.3, h + 11.0, h + 12.4, 10, MAT.METAL);

  if (medium) {
    m.painted(TINT.METAL_DARK, () => {
      // Pipe bridge between the plant and the silos, and a walkway round them.
      for (const py of [h * 0.55, h * 0.78]) {
        m.pipe([x - 9.0, py, -z + 6.0], [x - 4.0, py, -z + 6.0], 0.26, MAT.TRIM, 8);
        m.pipe([x - 9.0, py + 0.5, -z + 6.0], [x - 4.0, py + 0.5, -z + 6.0], 0.2, MAT.TRIM, 8);
      }
      for (let i = 0; i < 3; i++) {
        const cx = x - 6.4 + (i % 2) * 5.0, cz = -z + 4.4 + i * 4.6;
        m.cylinder(cx, cz, 2.5, h + 1.4, h + 1.55, 12, MAT.TRIM);
      }
    });
    band(m, -x, -z, x - 9.0, z, 4.6, 0.34, 0.16, T.trim);
    m.box([-x, 0.01, z], [x, 0.07, z + 10.0], MAT.GROUND);
  }
  if (fine) {
    louvres(m, { axis: 'z', sign: 1, plane: z }, -x + 1.6, x - 10.6, 5.4, 8.2, 8);
    louvres(m, { axis: 'z', sign: 1, plane: z }, -x + 1.6, x - 10.6, 9.0, 11.8, 8);
    m.painted(TINT.METAL_DARK, () => m.opening({ axis: 'z', sign: 1, plane: z, u0: -x + 3.0, u1: -x + 8.0,
      y0: 0.16, y1: 4.4, glass: MAT.TRIM, frame: 0.16, proud: 0.1 }));
    entrance(m, { axis: 'z', sign: 1, plane: z }, x - 12.0, { width: 1.2, height: 2.3, steps: 1 });
    for (const [sign, plane] of [[-1, -x], [1, x - 9.0]] as const) {
      louvres(m, { axis: 'x', sign, plane }, -z + 2.0, z - 2.0, 5.4, 8.2, 7);
    }
    parkedVehicle(m, seed + 11, -x + 8.0, z + 5.0, 0, 'truck');
    serviceYard(m, -x, x, z + 10.0, seed, { bins: true, totem: true });
    roofClutter(m, -x + 3, -z + 3, x - 12, z - 3, h, seed, 1.0);
  }
  return m;
}

/** A yard: open storage under a gantry, with a small office. */
function yard(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 30.0, d = 20.0;
  const x = w / 2, z = d / 2;

  m.box([-x, 0.01, -z], [x, 0.08, z], MAT.GROUND);
  // Office and store along one edge, so the lot is not only ground.
  m.box([-x, 0, -z], [-x + 9.0, 6.4, -z + 8.0], T.wall, { roof: MAT.ROOF });
  roofOver(m, T, -x, -z, -x + 9.0, -z + 8.0, 6.4, { along: 'z' });
  m.box([x - 12.0, 0, -z], [x, 7.6, -z + 7.0], MAT.SHED_WALL, { roof: MAT.ROOF });
  parapet(m, x - 12.0, -z, x, -z + 7.0, 7.6, 0.7, 0.16, T.base);

  if (medium) {
    // Gantry crane over the yard: two legs, a beam, a trolley.
    m.painted(TINT.METAL_DARK, () => {
      for (const px of [-x + 3.0, x - 3.0]) {
        m.pipe([px, 0, z - 4.0], [px, 9.4, z - 4.0], 0.3, MAT.TRIM, 6);
        m.pipe([px, 0, z - 11.0], [px, 9.4, z - 11.0], 0.3, MAT.TRIM, 6);
        m.box([px - 0.4, 9.4, z - 11.4], [px + 0.4, 10.0, z - 3.6], MAT.TRIM);
      }
      m.box([-x + 2.4, 10.0, z - 8.4], [x - 2.4, 10.9, z - 6.6], MAT.METAL);
      m.box([-2.0, 9.1, z - 8.6], [2.0, 10.0, z - 6.4], MAT.METAL);
    });
    // Stacks of material, which is what the yard is for.
    for (let i = 0; i < 7; i++) {
      const cx = -x + 6.0 + (i % 4) * 6.2;
      const cz = -z + 11.0 + Math.floor(i / 4) * 6.0;
      const hgt = 1.2 + hash2(i, 3, seed) * 2.6;
      m.painted(i % 3 === 0 ? TINT.WOOD : TINT.METAL_DARK, () =>
        m.box([cx - 2.2, 0.08, cz - 1.6], [cx + 2.2, hgt, cz + 1.6], i % 3 === 0 ? MAT.TIMBER : MAT.METAL));
    }
    // Perimeter fence.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 14; i++) {
        const px = -x + (i / 14) * w;
        m.box([px - 0.06, 0, z - 0.06], [px + 0.06, 2.4, z + 0.06], MAT.TRIM);
      }
      m.box([-x, 2.2, z - 0.03], [x, 2.32, z + 0.03], MAT.TRIM);
    });
  }
  if (fine) {
    windowGrid(m, { axis: 'z', sign: 1, plane: -z + 8.0 }, -x + 0.8, -x + 8.2,
      { floors: 2, floorH: 3.0, base: 1.1, count: 2, width: 1.4, height: 1.5 });
    entrance(m, { axis: 'z', sign: 1, plane: -z + 8.0 }, -x + 4.5, { width: 1.2, height: 2.3, steps: 1 });
    boxSign(m, { axis: 'z', sign: 1, plane: -z + 8.0 }, -x + 1.2, -x + 7.8, 6.5, 7.4);
    m.painted(TINT.METAL_DARK, () => m.opening({ axis: 'z', sign: 1, plane: -z + 7.0, u0: x - 10.0, u1: x - 4.0,
      y0: 0.2, y1: 5.0, glass: MAT.TRIM, frame: 0.18, proud: 0.1 }));
    for (let i = 0; i < 2; i++) parkedVehicle(m, seed * 5 + i, -x + 13.0 + i * 8.0, -z + 3.4, 0, 'truck');
    parkedVehicle(m, seed + 21, -x + 4.5, -z + 12.0, 0, 'van');
  }
  return m;
}

/** A mill: floors of production stacked, the way industry was built. */
function mill(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 24.0, d = 14.0;
  const x = w / 2, z = d / 2;
  const floors = storeysOf(T, 5);
  const floorH = 3.6;
  const wall = floors * floorH + 1.0;

  m.box([-x, 0, -z], [x, wall, z], T.id === 'modern' ? MAT.CLADDING : MAT.BRICK, { roof: MAT.ROOF });
  // Stair and hoist tower, taller than the block: the mill's landmark.
  m.box([-2.6, 0, z - 0.4], [2.6, wall + 5.0, z + 3.0], T.id === 'modern' ? MAT.CONCRETE : MAT.BRICK, { roof: MAT.ROOF });
  parapet(m, -2.6, z - 0.4, 2.6, z + 3.0, wall + 5.0, 0.9, 0.2, T.base);
  if (T.roof === 'flat') parapet(m, -x, -z, x, z, wall, 1.1, 0.24, T.base);
  else roofOver(m, T, -x, -z, x, z, wall, { along: 'x' });

  if (medium) {
    band(m, -x, -z, x, z, floorH + 0.5, 0.32, 0.18, T.trim);
    band(m, -x, -z, x, z, wall - 0.8, 0.42, 0.24, T.trim);
    // Pilasters between the window bays, which is how a mill is built.
    for (let i = 0; i <= 6; i++) {
      const px = -x + (i / 6) * w;
      for (const [pz, s] of [[z, 1], [-z, -1]] as const) {
        m.box([px - 0.35, 0, pz + (s > 0 ? 0 : -0.22)], [px + 0.35, wall - 0.9, pz + (s > 0 ? 0.22 : 0)], T.base);
      }
    }
    if (T.id !== 'modern') {
      m.cylinder(-x - 2.6, -z + 3.0, 1.05, 0, wall + 9.0, 10, MAT.BRICK);
      m.cylinder(-x - 2.6, -z + 3.0, 1.2, wall + 8.2, wall + 9.4, 10, MAT.BRICK);
    }
    m.painted(TINT.METAL_DARK, () => {
      m.box([-1.2, wall + 5.0, z + 1.0], [1.2, wall + 6.6, z + 2.6], MAT.TRIM);
      m.pipe([0, wall + 6.6, z + 1.8], [0, wall + 6.6, z + 4.4], 0.12, MAT.TRIM, 6);
    });
  }
  if (fine) {
    for (let i = 0; i < 6; i++) {
      const a = -x + (i / 6) * w + 0.55, b = -x + ((i + 1) / 6) * w - 0.55;
      for (const [sign, plane] of [[1, z], [-1, -z]] as const) {
        for (let f = 0; f < floors; f++) {
          m.opening({ axis: 'z', sign, plane, u0: a, u1: b,
            y0: f * floorH + 1.0, y1: f * floorH + 3.1, glass: MAT.GLASS, frame: 0.12, proud: 0.08 });
        }
      }
    }
    for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
      windowGrid(m, { axis: 'x', sign, plane }, -z + 1.2, z - 1.2,
        { floors, floorH, base: 1.0, count: 2, width: 1.5, height: 2.1 });
    }
    entrance(m, { axis: 'z', sign: 1, plane: z + 3.0 }, 0, { width: 2.4, height: 3.0, double: true, steps: 2 });
    boxSign(m, { axis: 'z', sign: 1, plane: z + 3.0 }, -2.2, 2.2, wall + 1.6, wall + 3.0);
    for (let f = 1; f < 4; f++) {
      m.opening({ axis: 'z', sign: 1, plane: z + 3.0, u0: -1.6, u1: 1.6,
        y0: f * floorH + 1.2, y1: f * floorH + 3.0, glass: MAT.GLASS, frame: 0.12, proud: 0.08 });
    }
    parkedVehicle(m, seed + 17, x - 5.0, -z - 4.0, 0, 'truck');
    serviceYard(m, -x, x, -z - 8.0, seed, { bins: true, cycles: true });
  }
  return m;
}

// ------------------------------------------------------------------- table

type Plan = {
  key: string;
  name: string;
  build: (lod: number, T: ThemeProfile, seed: number) => MeshBuilder;
  footprint: [number, number];
  density: Density;
  jobs: number;
  brand?: string;
};

const SHOPS: Plan[] = [
  { key: 'shop', name: 'Corner shop', build: cornerShop, footprint: [2, 2], density: 'low', jobs: 6, brand: 'grocer' },
  { key: 'parade', name: 'Parade', build: parade, footprint: [4, 4], density: 'medium', jobs: 30, brand: 'hardware' },
  { key: 'market', name: 'Market hall', build: market, footprint: [4, 4], density: 'medium', jobs: 44, brand: 'deli' },
  { key: 'store', name: 'Superstore', build: bigBox, footprint: [4, 7], density: 'high', jobs: 90, brand: 'supermarket' },
  { key: 'lodging', name: 'Hotel', build: lodging, footprint: [4, 4], density: 'high', jobs: 52, brand: 'travel' },
];

const OFFICES: Plan[] = [
  { key: 'studio', name: 'Studio', build: studio, footprint: [3, 3], density: 'low', jobs: 40 },
  { key: 'midrise', name: 'Mid-rise', build: midrise, footprint: [4, 3], density: 'medium', jobs: 180 },
  { key: 'tower', name: 'Tower', build: tower, footprint: [4, 4], density: 'high', jobs: 520 },
  { key: 'campus', name: 'Campus', build: campus, footprint: [4, 5], density: 'low', jobs: 150 },
  { key: 'conversion', name: 'Conversion', build: conversion, footprint: [3, 3], density: 'medium', jobs: 120 },
];

const WORKS: Plan[] = [
  { key: 'workshop', name: 'Workshop', build: workshop, footprint: [3, 5], density: 'none', jobs: 14 },
  { key: 'shed', name: 'Distribution shed', build: shed, footprint: [5, 7], density: 'none', jobs: 40 },
  { key: 'works', name: 'Works', build: works, footprint: [4, 6], density: 'none', jobs: 70 },
  { key: 'yard', name: 'Storage yard', build: yard, footprint: [4, 3], density: 'none', jobs: 18 },
  { key: 'mill', name: 'Mill', build: mill, footprint: [4, 4], density: 'none', jobs: 110 },
];

function sim(zone: Zone, jobs: number): AssetDef['sim'] {
  if (zone === 'industrial') {
    return { jobs, powerKW: jobs * 9, waterM3: jobs * 1.6, garbagePerWeek: jobs * 26, pollution: Math.round(jobs / 6), upkeep: jobs * 2.2 };
  }
  if (zone === 'office') {
    return { jobs, powerKW: jobs * 2.4, waterM3: jobs * 0.22, garbagePerWeek: jobs * 3.4, pollution: 0, upkeep: jobs * 0.9 };
  }
  return { jobs, powerKW: jobs * 3.4, waterM3: jobs * 0.5, garbagePerWeek: jobs * 9, pollution: 1, upkeep: jobs * 1.3 };
}

function defs(zone: Zone, prefix: string, theme: Theme, plans: Plan[]): AssetDef[] {
  const T = THEMES[theme];
  const key = THEME_KEY[theme];
  return plans.map((p) => {
    const id = `${prefix}.${key}.${p.key}`;
    const seed = Math.round(idSeed(id));
    const brand: Brand | undefined = p.brand === undefined ? undefined : BRANDS[p.brand];
    return {
      id,
      name: `${T.label} ${p.name.toLowerCase()}`,
      zone,
      theme,
      density: p.density,
      variant: 'sculpted' as const,
      footprint: p.footprint,
      height: 0,
      sim: sim(zone, p.jobs),
      note: `${p.name} in the ${T.label.toLowerCase()} vocabulary.`,
      ...(brand === undefined ? {} : { brand }),
      build: (lod: number) => p.build(lod, T, seed),
    };
  });
}

export const COMMERCE: AssetDef[] = THEME_ORDER.flatMap((t) => defs('commercial', 'com', t, SHOPS));
export const WORKPLACES: AssetDef[] = THEME_ORDER.flatMap((t) => defs('office', 'off', t, OFFICES));
export const MAKING: AssetDef[] = THEME_ORDER.flatMap((t) => defs('industrial', 'ind', t, WORKS));
