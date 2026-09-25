/**
 * More of what a working city is made of: the building types an industrial
 * estate and a shopping street were missing.
 *
 * Six industrial plans across five themes meant a player saw the same six
 * silhouettes in every estate on the map. These are the ones every real estate
 * has and the list did not: a north-light factory, a container depot, a
 * recycling yard, a food factory -- and, for the shops, a retail park and a
 * row of restaurants with their tables out. Built to the same conventions as
 * trade.ts: centred on the lot, front to +z, the theme deciding the walls.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { ThemeProfile } from '../themes';
import {
  band, boxSign, entrance, fasciaSign, louvres, parapet, planter, pylonSign,
  ribbon, roofClutter, shopfront, awning, windowGrid,
} from '../parts';
import { parkedVehicle } from './vehicles';
import { tree } from './landscape';
import { container, stockpile, drum } from './freight';
import { excavator, lorry, loader, fence, paintedAs } from './machines';

// ---------------------------------------------------------------- industrial

/**
 * A north-light factory: the sawtooth roof that says factory from anywhere,
 * glazed on its steep faces, over a long brick or clad shed with a two-storey
 * office block across its front and a chimney at the back.
 */
export function factory(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const x = 14.5, zb = -18.0, zf = 8.0, h = 7.0;
  const brick = T.id === 'modern' || T.id === 'asian' ? MAT.SHED_WALL : MAT.BRICK;
  m.box([-x, 0, zb], [x, h, zf], brick, { roof: MAT.ROOF });
  // The sawtooth: teeth across the shed, each a steep glazed north face and a
  // long sloped back.
  const teeth = 5, span = (zf - zb) / teeth, rise = 3.2;
  for (let i = 0; i < teeth; i++) {
    const z0 = zb + i * span, z1 = z0 + span;
    m.quad([-x, h, z1], [x, h, z1], [x, h + rise, z0 + 0.3], [-x, h + rise, z0 + 0.3], MAT.ROOF);
    m.quad([-x, h, z0 + 0.3], [x, h, z0 + 0.3], [x, h + rise, z0 + 0.3], [-x, h + rise, z0 + 0.3], MAT.GLASS);
    for (const s of [-1, 1] as const) {
      m.quad([s * x, h, z1], [s * x, h, z0 + 0.3], [s * x, h + rise, z0 + 0.3], [s * x, h, z1], brick);
    }
  }
  // The office across the front, in the theme's own wall.
  m.box([-x, 0, zf], [x - 8.0, 7.6, zf + 6.0], T.wall, { roof: MAT.ROOF });
  parapet(m, -x, zf, x - 8.0, zf + 6.0, 7.6, 0.7, 0.16, T.base);
  // The chimney at the back corner, banded.
  m.cylinder(x - 3.0, zb + 3.0, 1.0, 0, h + 16.0, 10, MAT.BRICK);
  m.cylinder(x - 3.0, zb + 3.0, 1.2, h + 15.0, h + 16.4, 10, MAT.METAL);
  m.emit(x - 3.0, h + 16.4, zb + 3.0);
  if (medium) {
    band(m, -x, zf, x - 8.0, zf + 6.0, 3.6, 0.3, 0.14, T.trim);
    m.painted(TINT.BRAND, () => band(m, -x, zb, x, zf, h - 1.0, 0.7, 0.12, MAT.TRIM));
    // The loading yard beside the office.
    m.box([x - 8.0, 0.01, zf], [x, 0.07, zf + 12.0], MAT.CONCRETE);
  }
  if (fine) {
    windowGrid(m, { axis: 'z', sign: 1, plane: zf + 6.0 }, -x + 1.0, x - 9.0,
      { floors: 2, floorH: 3.4, base: 0.6, count: 7, width: 1.8, height: 1.6 });
    entrance(m, { axis: 'z', sign: 1, plane: zf + 6.0 }, -x + 5.0, { width: 2.0, height: 2.6, double: true, glazed: true });
    boxSign(m, { axis: 'z', sign: 1, plane: zf + 6.0 }, -x + 8.0, -x + 17.0, 6.6, 7.4);
    m.painted(TINT.METAL_DARK, () => m.opening({ axis: 'z', sign: 1, plane: zf, u0: x - 7.0, u1: x - 1.6,
      y0: 0.2, y1: 5.2, glass: MAT.TRIM, frame: 0.18, proud: 0.1 }));
    for (let i = 0; i < 3; i++) {
      const lz = zb + 3.0 + i * 8.0;
      louvres(m, { axis: 'x', sign: 1, plane: x }, lz, lz + 3.0, 3.6, 5.2, 3);
    }
    paintedAs(TINT.BRAND, () => lorry(m, x - 4.3, zf + 7.4, 1, 'box', false));
    for (let i = 0; i < 4; i++) parkedVehicle(m, seed * 5 + i, -x + 2.4 + i * 3.0, zf + 9.5, 1, 'car');
    roofClutter(m, -x + 2, zf + 1, x - 10, zf + 5, 7.6, seed, 0.6);
  }
  return m;
}

/**
 * A container depot: boxes stacked two and three high in coloured rows, a
 * reach stacker working them, a gatehouse and barrier, and a lorry leaving
 * with one on its trailer.
 */
export function depot(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const x = 19.0, z = 19.0;
  m.box([-x, 0.01, -z], [x, 0.08, z], MAT.CONCRETE);
  // The stacks: four rows, heights varying by the seed so no two depots match.
  const rows = [-14.0, -8.4, 1.2, 6.8];
  rows.forEach((rz, r) => {
    for (let c = 0; c < 2; c++) {
      const cx = -10.0 + c * 13.4;
      const tall = 1 + Math.floor(((seed * 13 + r * 7 + c * 3) % 9) / 3);
      for (let k = 0; k < (medium ? tall : 1); k++) {
        container(m, cx, 0.08 + k * 2.59, rz, true, seed * 31 + r * 11 + c * 5 + k, false, !fine);
      }
    }
  });
  // The office and gatehouse on the street edge.
  m.box([x - 10.0, 0, z - 6.0], [x - 1.0, 3.2, z - 1.0], T.wall, { roof: MAT.ROOF });
  parapet(m, x - 10.0, z - 6.0, x - 1.0, z - 1.0, 3.2, 0.5, 0.14, T.base);
  if (medium) {
    // Lane markings between the rows.
    m.painted(TINT.SIGN_LIT, () => {
      for (const rz of [-4.0, 11.2]) m.box([-x + 1.0, 0.08, rz - 0.08], [x - 12.0, 0.095, rz + 0.08], MAT.TRIM);
    });
    fence(m, [-x, 0, -z], [x, 0, -z], !fine);
    fence(m, [-x, 0, -z], [-x, 0, z], !fine);
    fence(m, [x, 0, -z], [x, 0, z - 7.0], !fine);
  }
  if (fine) {
    windowGrid(m, { axis: 'z', sign: 1, plane: z - 1.0 }, x - 9.4, x - 1.6,
      { floors: 1, floorH: 3.0, base: 0.9, count: 3, width: 1.6, height: 1.3 });
    entrance(m, { axis: 'z', sign: 1, plane: z - 1.0 }, x - 2.6, { width: 1.0, height: 2.2 });
    // The barrier at the gate.
    m.painted(TINT.ACCENT, () => m.box([-x + 2.0, 1.0, z - 0.3], [x - 12.0, 1.12, z - 0.18], MAT.PAINT));
    // A reach stacker working the far row, and a lorry with a box going out.
    paintedAs(TINT.ACCENT, () => loader(m, -3.0, -4.0, 0, false));
    paintedAs(TINT.BRAND, () => lorry(m, 4.0, 12.0, 0, 'box', false));
    container(m, 3.2, 1.1, 12.0, false, seed * 3 + 1);
    pylonSign(m, x - 3.0, z - 8.0, 5.0, 2.0);
  }
  return m;
}

/**
 * A recycling yard: an open-fronted sorting shed on its portal frame, heaps of
 * metal, glass and timber in their bays, a grab working the heaps, skips in a
 * line and a weighbridge at the gate.
 */
export function recycling(lod: number, T: ThemeProfile, _seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const x = 15.0, z = 15.0;
  m.box([-x, 0.01, -z], [x, 0.08, z], MAT.CONCRETE);
  // The shed: a steel frame roofed and clad on three sides, open to the yard.
  const sh = 9.0, sz0 = -z + 0.5, sz1 = -z + 12.0;
  m.box([-x + 0.5, 0, sz0], [x - 0.5, sh, sz0 + 0.3], MAT.SHED_WALL);
  for (const s of [-1, 1] as const) m.box([s * (x - 0.5) - 0.15, 0, sz0], [s * (x - 0.5) + 0.15, sh, sz1], MAT.SHED_WALL);
  m.quad([-x, sh, sz1 + 0.4], [x, sh, sz1 + 0.4], [x, sh + 1.4, sz0], [-x, sh + 1.4, sz0], MAT.ROOF);
  m.painted(TINT.METAL_DARK, () => {
    for (let px = -x + 0.5; px <= x - 0.5; px += 5.8) m.box([px - 0.2, 0, sz1 - 0.2], [px + 0.2, sh, sz1 + 0.2], MAT.TRIM);
  });
  // The heaps, in concrete-walled bays across the yard.
  stockpile(m, -9.0, 1.0, 8.0, 7.0, 2.6, TINT.METAL_DARK);
  stockpile(m, 0.0, 1.0, 8.0, 7.0, 2.2, TINT.WOOD);
  if (medium) stockpile(m, 9.0, 1.0, 8.0, 7.0, 1.8, TINT.GREEN_DARK);
  // Office and weighbridge by the gate.
  m.box([-x + 1.0, 0, z - 5.5], [-x + 8.0, 3.0, z - 1.0], T.wall, { roof: MAT.ROOF });
  if (medium) {
    m.painted(TINT.METAL_DARK, () => m.box([-2.0, 0.08, z - 7.0], [6.0, 0.3, z - 3.0], MAT.METAL));
    fence(m, [-x, 0, -z], [-x, 0, z], !fine);
    fence(m, [x, 0, -z], [x, 0, z], !fine);
  }
  if (fine) {
    windowGrid(m, { axis: 'z', sign: 1, plane: z - 1.0 }, -x + 1.6, -x + 7.4,
      { floors: 1, floorH: 3.0, base: 0.9, count: 2, width: 1.5, height: 1.2 });
    // Skips in a row along the side, in their hire firm's colour.
    m.painted(TINT.ACCENT, () => {
      for (let i = 0; i < 4; i++) {
        const sz = -1.0 + i * 3.4;
        m.box([x - 3.6, 0.08, sz], [x - 1.2, 1.3, sz + 2.2], MAT.PAINT);
      }
    });
    // The grab on its tracks, and a tipper at the weighbridge.
    paintedAs(TINT.ACCENT, () => excavator(m, -4.5, -5.0, 1, false));
    paintedAs(TINT.BRAND, () => lorry(m, 2.0, z - 5.0, 0, 'tipper', false));
    for (let i = 0; i < 6; i++) drum(m, -x + 2.0 + i * 1.0, -z + 13.0, 0.08, i % 2 === 0 ? TINT.ACCENT : TINT.BRAND);
    boxSign(m, { axis: 'z', sign: 1, plane: z - 1.0 }, -x + 1.4, -x + 7.6, 3.1, 3.9);
  }
  return m;
}

/**
 * A food factory: clean white or theme-clad production hall with its coloured
 * band, a row of stainless silos with their walkway, air handling on the roof,
 * a glazed stair tower and a tanker at the intake.
 */
export function foodworks(lod: number, _T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const x0 = -19.0, x1 = 9.0, z0 = -15.0, z1 = 11.0, h = 11.0;
  m.box([x0, 0, z0], [x1, h, z1], MAT.SHED_WALL, { roof: MAT.ROOF });
  parapet(m, x0, z0, x1, z1, h, 0.9, 0.2, MAT.METAL);
  // The stair tower, glazed, taller than the hall.
  m.box([x0 + 2.0, 0, z1], [x0 + 6.0, h + 3.4, z1 + 3.6], MAT.GLASS, { roof: MAT.ROOF });
  // Four stainless silos down the side, with the walkway over them.
  for (let i = 0; i < 4; i++) {
    const cz = z0 + 3.5 + i * 5.6;
    m.cylinder(x1 + 5.0, cz, 2.3, 1.8, h + 5.0, 14, MAT.METAL);
    m.cone(x1 + 5.0, cz, 2.3, 0.4, 1.8, 0.2, 14, MAT.METAL);
    m.cone(x1 + 5.0, cz, 2.3, 0.6, h + 5.0, h + 6.4, 14, MAT.METAL);
  }
  if (medium) {
    m.painted(TINT.BRAND, () => band(m, x0, z0, x1, z1, h - 2.6, 1.4, 0.12, MAT.TRIM));
    m.painted(TINT.METAL_DARK, () => {
      m.box([x1 + 2.4, h + 6.4, z0 + 1.0], [x1 + 7.6, h + 6.6, z0 + 22.0], MAT.TRIM);
      m.pipe([x1, h - 1.0, z0 + 6.0], [x1 + 3.0, h - 1.0, z0 + 6.0], 0.3, MAT.METAL, 8);
    });
    // Air handling units on the roof, in a line.
    for (let i = 0; i < 4; i++) {
      m.box([x0 + 5.0 + i * 6.0, h, z0 + 4.0], [x0 + 9.0 + i * 6.0, h + 2.0, z0 + 7.0], MAT.METAL, { roof: MAT.METAL });
    }
    m.box([x0, 0.01, z1], [x1 + 9.0, 0.07, z1 + 8.0], MAT.CONCRETE);
  }
  if (fine) {
    ribbon(m, { axis: 'z', sign: 1, plane: z1 }, x0 + 7.0, x1 - 1.0, 4.4, 6.2, { mullions: 8 });
    entrance(m, { axis: 'z', sign: 1, plane: z1 + 3.6 }, x0 + 4.0, { width: 1.8, height: 2.6, double: true, glazed: true });
    boxSign(m, { axis: 'z', sign: 1, plane: z1 }, x0 + 8.0, x0 + 20.0, 7.4, 8.6);
    m.painted(TINT.METAL_DARK, () => m.opening({ axis: 'x', sign: 1, plane: x1, u0: z1 - 6.0, u1: z1 - 1.6,
      y0: 0.16, y1: 4.6, glass: MAT.TRIM, frame: 0.16, proud: 0.1 }));
    paintedAs(TINT.NONE, () => lorry(m, x1 + 5.0, z1 + 4.0, 0, 'tank', false));
    for (let i = 0; i < 5; i++) parkedVehicle(m, seed * 3 + i, x0 + 8.0 + i * 3.0, z1 + 5.0, 1, 'car');
  }
  return m;
}

// ---------------------------------------------------------------- commercial

/**
 * A retail park: a terrace of big-box units under one long fascia, each with
 * its own brand panel, a car park in front with its bays, trolley shelters and
 * trees, and a pylon sign at the entrance.
 */
export function retailPark(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const x = 22.0, zb = -18.0, zf = -2.0, h = 8.5;
  m.box([-x, 0, zb], [x, h, zf], T.id === 'modern' ? MAT.SHED_WALL : T.wall, { roof: MAT.ROOF });
  parapet(m, -x, zb, x, zf, h, 1.2, 0.22, T.base);
  // The car park.
  m.box([-x, 0.01, zf], [x, 0.07, 18.0], MAT.CONCRETE);
  const units = 4, uw = (2 * x) / units;
  if (medium) {
    m.painted(TINT.SIGN_LIT, () => {
      for (let i = 0; i <= 14; i++) {
        const bx = -x + 1.0 + i * 3.0;
        for (const bz of [4.0, 12.0]) m.box([bx - 0.06, 0.07, bz - 2.4], [bx + 0.06, 0.08, bz + 2.4], MAT.TRIM);
      }
    });
    // The canopy along the front, the thing every retail park has.
    m.painted(TINT.ACCENT, () => m.box([-x, 5.2, zf], [x, 5.6, zf + 3.0], MAT.PAINT));
    m.painted(TINT.METAL_DARK, () => {
      for (let px = -x + 2.0; px <= x - 2.0; px += 5.5) m.cylinder(px, zf + 2.8, 0.12, 0, 5.2, 6, MAT.METAL);
    });
  }
  if (fine) {
    for (let i = 0; i < units; i++) {
      const u0 = -x + i * uw + 0.6, u1 = u0 + uw - 1.2;
      shopfront(m, { axis: 'z', sign: 1, plane: zf }, u0 + 1.0, u1 - 1.0, { head: 4.6 });
      m.keyed(seed * 17 + i * 5, () => fasciaSign(m, { axis: 'z', sign: 1, plane: zf }, u0 + 1.5, u1 - 1.5, 6.2, 7.8));
    }
    for (let i = 0; i < 12; i++) {
      if ((i * 7 + seed) % 3 === 0) continue;
      parkedVehicle(m, seed * 11 + i, -x + 2.5 + (i % 6) * 6.0 + (i < 6 ? 0 : 3.0), i < 6 ? 4.0 : 12.0, 1, 'car');
    }
    for (const tx of [-x + 1.5, 0, x - 1.5]) tree(m, tx, 16.5, 6.0, 1.6);
    m.painted(TINT.METAL_DARK, () => m.box([6.0, 0.07, 7.6], [9.0, 2.2, 8.4], MAT.TRIM));
    pylonSign(m, x - 2.0, 16.0, 9.0, 2.4);
  }
  return m;
}

/**
 * A restaurant row: three or four small restaurants in a two-storey terrace,
 * each with its awning and its tables out on the pavement under parasols,
 * planters between them and lights strung over the terrace.
 */
export function restaurantRow(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const x = 11.0, zb = -8.0, zf = 3.0, h = 7.4;
  m.box([-x, 0, zb], [x, h, zf], T.wall, { roof: MAT.ROOF });
  parapet(m, -x, zb, x, zf, h, 0.8, 0.16, T.trim);
  m.box([-x, 0.01, zf], [x, 0.07, zf + 8.0], MAT.CONCRETE);
  const units = 3, uw = (2 * x) / units;
  if (medium) band(m, -x, zb, x, zf, 3.8, 0.3, 0.14, T.trim);
  if (fine) {
    windowGrid(m, { axis: 'z', sign: 1, plane: zf }, -x + 0.8, x - 0.8,
      { floors: 1, floorH: 3.4, base: 4.2, count: 9, width: 1.2, height: 1.6 });
    for (let i = 0; i < units; i++) {
      const u0 = -x + i * uw + 0.4, u1 = u0 + uw - 0.8;
      shopfront(m, { axis: 'z', sign: 1, plane: zf }, u0 + 0.3, u1 - 0.3, { head: 3.3 });
      m.keyed(seed * 13 + i * 7, () => {
        awning(m, { axis: 'z', sign: 1, plane: zf }, u0 + 0.4, u1 - 0.4, 3.5, 2.2);
        fasciaSign(m, { axis: 'z', sign: 1, plane: zf }, u0 + 0.8, u1 - 0.8, 3.7, 4.1);
      });
      // Tables and parasols on the terrace.
      for (let t = 0; t < 2; t++) {
        const tx = u0 + 1.6 + t * (uw - 4.0) / 1.0 * 0.6, tz = zf + 4.4 + (t % 2) * 1.8;
        m.cylinder(tx, tz, 0.45, 0.7, 0.76, 8, MAT.METAL);
        m.cylinder(tx, tz, 0.04, 0, 2.4, 5, MAT.METAL);
        m.painted(i % 2 === 0 ? TINT.ACCENT : TINT.BRAND, () => m.cone(tx, tz, 1.4, 0.05, 2.2, 2.6, 8, MAT.PAINT));
        for (const s of [-1, 1] as const) m.box([tx + s * 0.7 - 0.2, 0, tz - 0.2], [tx + s * 0.7 + 0.2, 0.45, tz + 0.2], MAT.METAL);
      }
    }
    for (const px of [-x + 0.8, -x / 3, x / 3, x - 0.8]) planter(m, px, zf + 7.2, 0.6, 0.7);
    // Festoon lights over the terrace, a string between the planters.
    m.painted(TINT.SIGN_LIT, () => {
      for (let i = 0; i < 12; i++) {
        const lx = -x + 1.0 + i * ((2 * x - 2) / 11);
        m.box([lx - 0.08, 3.0 - Math.sin((i / 11) * Math.PI) * 0.4, zf + 6.0], [lx + 0.08, 3.16 - Math.sin((i / 11) * Math.PI) * 0.4, zf + 6.16], MAT.PAINT);
      }
    });
    entrance(m, { axis: 'x', sign: 1, plane: x }, zb + 3.0, { width: 1.0, height: 2.2 });
  }
  return m;
}

// ------------------------------------------------------------------ services

/**
 * A community centre: a single-storey hall with a clerestory over it, a glazed
 * foyer and cafe, a veranda along the garden side, a notice board, bike racks
 * and a small car park -- the building a neighbourhood actually meets in.
 */
export function communityCentre(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const x = 14.0, z = 11.0;
  m.box([-x, 0.0005, -z], [x, 0.08, z], MAT.CONCRETE);
  // The hall, brick, with its clerestory lantern.
  m.box([-12.0, 0.08, -9.0], [4.0, 6.2, 3.0], MAT.BRICK, { roof: MAT.ROOF });
  m.box([-10.0, 6.2, -7.0], [2.0, 8.0, 1.0], MAT.GLASS, { roof: MAT.ROOF });
  parapet(m, -12.0, -9.0, 4.0, 3.0, 6.2, 0.5, 0.16, MAT.STONE);
  // The foyer and cafe, glazed, lower, at the front corner.
  m.box([4.0, 0.08, -4.0], [12.0, 4.0, 5.0], MAT.GLASS, { roof: MAT.ROOF });
  m.box([3.6, 4.0, -4.4], [12.4, 4.4, 5.4], MAT.STONE);
  if (medium) {
    // The veranda on posts along the garden side, and the garden itself.
    m.painted(TINT.WOOD, () => {
      m.box([-12.0, 3.2, 3.0], [4.0, 3.4, 5.6], MAT.PAINT);
      for (let px = -11.6; px <= 3.6; px += 3.8) m.box([px - 0.1, 0.08, 5.3], [px + 0.1, 3.2, 5.5], MAT.PAINT);
    });
    m.painted(TINT.GREEN, () => m.box([-13.5, 0.08, 6.0], [3.0, 0.14, 10.5], MAT.GROUND));
  }
  if (fine) {
    windowGrid(m, { axis: 'z', sign: -1, plane: -9.0 }, -11.4, 3.4, { floors: 1, floorH: 5.0, base: 1.4, count: 6, width: 1.6, height: 2.6 });
    entrance(m, { axis: 'z', sign: 1, plane: 5.0 }, 8.0, { width: 2.2, height: 2.6, double: true, glazed: true });
    boxSign(m, { axis: 'z', sign: 1, plane: 5.4 }, 4.6, 11.4, 3.3, 3.9);
    for (const tx of [-11.0, -5.0, 1.0]) tree(m, tx, 9.0, 5.5, 1.6);
    // Picnic benches in the garden, bike racks by the door.
    m.painted(TINT.WOOD, () => {
      for (const bx of [-8.0, -3.0]) {
        m.box([bx - 1.0, 0.7, 7.2], [bx + 1.0, 0.78, 8.0], MAT.PAINT);
        for (const s of [-1, 1] as const) m.box([bx - 1.0, 0.42, 7.6 + s * 0.7 - 0.15], [bx + 1.0, 0.48, 7.6 + s * 0.7 + 0.15], MAT.PAINT);
      }
    });
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 5; i++) m.box([5.0 + i * 0.8, 0.08, 6.4], [5.06 + i * 0.8, 0.9, 7.4], MAT.TRIM);
    });
    for (let i = 0; i < 3; i++) parkedVehicle(m, 71 + i, 7.0 + i * 3.0, -8.0, 1, 'car');
  }
  return m;
}

/**
 * A skate park and youth club: a sunken concrete bowl, a half-pipe, a line of
 * rails and ledges, the club's single-storey hut in bright cladding with a
 * mural band, floodlights on masts and a fence round it all.
 */
export function skatePark(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const x = 12.0, z = 12.0;
  m.box([-x, 0.0005, -z], [x, 0.1, z], MAT.CONCRETE);
  // The half-pipe: two curved walls and a flat, built as stepped slabs.
  for (let i = 0; i < 6; i++) {
    const t = i / 5, rise = 2.6 * (1 - Math.cos(t * Math.PI / 2));
    for (const s of [-1, 1] as const) {
      const xx = s * (9.0 - t * 3.2);
      m.box([Math.min(xx, xx - s * 0.7), 0.1, -10.5], [Math.max(xx, xx - s * 0.7), 0.1 + rise + 0.12, -3.5], MAT.CONCRETE);
    }
  }
  // Coping rails on its lips.
  m.painted(TINT.METAL_DARK, () => {
    for (const s of [-1, 1] as const) m.pipe([s * 9.0, 2.82, -10.5], [s * 9.0, 2.82, -3.5], 0.06, MAT.METAL, 6);
  });
  // The club hut.
  m.painted(TINT.ACCENT, () => m.box([3.0, 0.1, 3.0], [11.0, 3.4, 10.5], MAT.PAINT, { roof: MAT.ROOF }));
  if (medium) {
    // A mural band round the hut, and the bowl sunk into the slab.
    m.painted(TINT.BRAND, () => band(m, 3.0, 3.0, 11.0, 10.5, 1.2, 1.2, 0.06, MAT.PAINT));
    m.box([-10.0, 0.1, 2.0], [-2.0, 0.16, 10.0], MAT.STONE);
    m.box([-9.0, 0.16, 3.0], [-3.0, 0.2, 9.0], MAT.CONCRETE);
    fence(m, [-x, 0, -z], [x, 0, -z], !fine);
    fence(m, [-x, 0, -z], [-x, 0, z], !fine);
    fence(m, [x, 0, -z], [x, 0, z], !fine);
  }
  if (fine) {
    // Ledges and a flat rail across the street section.
    m.box([-1.5, 0.1, -1.0], [1.5, 0.55, 0.0], MAT.CONCRETE);
    m.painted(TINT.METAL_DARK, () => {
      m.pipe([-2.0, 0.7, 1.5], [2.5, 0.7, 1.5], 0.05, MAT.METAL, 6);
      for (const px of [-1.8, 2.3]) m.box([px - 0.04, 0.1, 1.46], [px + 0.04, 0.7, 1.54], MAT.METAL);
      // Floodlight masts at the corners.
      for (const [fx, fz] of [[-11.0, -11.0], [11.0, -11.0], [-11.0, 11.0]] as const) {
        m.cylinder(fx, fz, 0.12, 0.1, 8.0, 6, MAT.METAL);
        m.box([fx - 0.5, 8.0, fz - 0.3], [fx + 0.5, 8.5, fz + 0.3], MAT.TRIM);
      }
    });
    windowGrid(m, { axis: 'x', sign: -1, plane: 3.0 }, 4.0, 9.5, { floors: 1, floorH: 3.0, base: 0.9, count: 3, width: 1.3, height: 1.2 });
    entrance(m, { axis: 'z', sign: 1, plane: 10.5 }, 7.0, { width: 1.2, height: 2.2 });
    boxSign(m, { axis: 'z', sign: 1, plane: 10.5 }, 4.0, 10.0, 2.5, 3.1);
    for (const px of [-4.0, 0.0]) planter(m, px, 10.8, 0.6, 0.5);
  }
  return m;
}
