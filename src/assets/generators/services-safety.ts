/**
 * Emergency services: fire, police, healthcare.
 *
 * These are not zoned. The player places them one at a time, pays for them
 * every week, and goes looking for a specific one in a list -- so unlike a
 * shop or a block of flats, each has to be recognisable on its own rather
 * than as a member of a category. That changes what the triangles buy: the
 * budget goes into the one feature that names the building (a drill tower, a
 * bay of shutters, an ambulance canopy, a rooftop helipad) before it goes
 * anywhere near window frames.
 *
 * Budget is 2,400 to 12,000 -- higher at both ends than a zoned building,
 * because there is only ever one or two of each on the map.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import type { Tint } from '../mesh';
import type { Wall } from '../parts';
import {
  band, bollards, boxSign, dressRoof, entrance, fins, frontage, kerb, parapet,
  louvres, portal, railing, ribbon, roofClutter, serviceYard,
} from '../parts';

// -------------------------------------------------------------- shared parts

/**
 * A stack of ribbon windows, one per floor.
 *
 * The service equivalent of windowGrid. Same floors and the same head height,
 * but each floor is one continuous run of glass with mullions across it rather
 * than a row of separate holes -- which is the single strongest signal that a
 * building is civic and not domestic.
 */
function ribbonStack(m: MeshBuilder, w: Wall, u0: number, u1: number, o: {
  floors: number; floorH: number; base: number; height: number;
}): void {
  for (let f = 0; f < o.floors; f++) {
    const y = o.base + f * o.floorH;
    ribbon(m, w, u0, u1, y, y + o.height, { head: f === o.floors - 1 });
  }
}

/**
 * A run of appliance bay doors: piers, shutters with their ribs, and a lintel.
 *
 * Fire and ambulance stations are read entirely by this. It is the single
 * most valuable part in the file.
 */
function bayDoors(m: MeshBuilder, x0: number, x1: number, z: number, bays: number,
                  h = 4.4, tint: Tint = TINT.BRAND): void {
  const span = (x1 - x0) / bays;
  for (let i = 0; i <= bays; i++) {
    const px = x0 + i * span;
    m.box([px - 0.42, 0, z - 0.2], [px + 0.42, h + 0.55, z + 0.42], MAT.CONCRETE);
  }
  for (let i = 0; i < bays; i++) {
    const a = x0 + i * span + 0.5;
    const b = x0 + (i + 1) * span - 0.5;
    m.painted(TINT.METAL_DARK, () => {
      m.box([a, 0, z + 0.16], [b, h, z + 0.3], MAT.TRIM);
      for (let g = 1; g < 10; g++) {
        m.box([a, g * (h / 10), z + 0.3], [b, g * (h / 10) + 0.09, z + 0.36], MAT.TRIM);
      }
    });
    // Vision panel across the top of each shutter.
    m.opening({ axis: 'z', sign: 1, plane: z + 0.36, u0: a + 0.25, u1: b - 0.25,
      y0: h - 0.85, y1: h - 0.25, glass: MAT.GLASS, frame: 0.08, proud: 0.05 });
  }
  m.painted(tint, () => m.box([x0 - 0.5, h + 0.55, z - 0.25], [x1 + 0.5, h + 1.25, z + 0.5], MAT.TRIM));
  // Apron: the concrete a fire engine actually stands on.
  m.box([x0 - 0.8, 0.001, z + 0.5], [x1 + 0.8, 0.1, z + 9.0], MAT.CONCRETE);
  for (let i = 0; i < bays; i++) {
    const c = x0 + (i + 0.5) * span;
    m.box([c - 0.07, 0.004, z + 1.2], [c + 0.07, 0.02, z + 8.4], MAT.TRIM);
  }
}

/** Hose-drying and training tower: the fire silhouette. */
function drillTower(m: MeshBuilder, cx: number, cz: number, w: number, h: number): void {
  const r = w / 2;
  m.box([cx - r, 0, cz - r], [cx + r, h, cz + r], MAT.CONCRETE, { roof: MAT.TRIM });
  parapet(m, cx - r, cz - r, cx + r, cz + r, h, 1.1, 0.28);
  // Open training bays up two faces: a solid tower reads as a lift shaft.
  const floors = Math.floor(h / 3.2);
  for (let f = 1; f < floors; f++) {
    const y = f * 3.2;
    for (const [axis, sign, plane] of [
      ['z', 1, cz + r], ['x', 1, cx + r],
    ] as const) {
      m.painted(TINT.METAL_DARK, () => {
        m.opening({ axis, sign, plane, u0: -r + 0.55 + (axis === 'z' ? cx : cz),
          u1: r - 0.55 + (axis === 'z' ? cx : cz), y0: y + 0.4, y1: y + 2.5,
          glass: MAT.TRIM, frame: 0.16, proud: 0.08 });
        // Guard rail across each opening.
        if (axis === 'z') m.box([cx - r + 0.4, y + 0.4, plane + 0.02], [cx + r - 0.4, y + 1.4, plane + 0.14], MAT.TRIM);
        else m.box([plane + 0.02, y + 0.4, cz - r + 0.4], [plane + 0.14, y + 1.4, cz + r - 0.4], MAT.TRIM);
      });
    }
  }
  m.painted(TINT.METAL_DARK, () => {
    m.box([cx - 0.1, h + 1.1, cz - 0.1], [cx + 0.1, h + 4.4, cz + 0.1], MAT.TRIM);
  });
}

/** Blue lamp over a door: eight triangles, and it says police on its own. */
function policeLamp(m: MeshBuilder, cx: number, y: number, z: number): void {
  m.painted(TINT.METAL_DARK, () => {
    m.box([cx - 0.34, y + 0.62, z], [cx + 0.34, y + 0.78, z + 0.34], MAT.TRIM);
  });
  m.painted(TINT.SIGN_LIT, () => {
    m.box([cx - 0.28, y, z + 0.02], [cx + 0.28, y + 0.62, z + 0.3], MAT.TRIM);
  });
}

/** A short mast with a dish and an aerial, for anything that dispatches. */
function mast(m: MeshBuilder, cx: number, base: number, cz: number, h: number): void {
  m.painted(TINT.METAL_DARK, () => {
    for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]] as const) {
      m.box([cx + dx - 0.06, base, cz + dz - 0.06], [cx + dx + 0.06, base + h, cz + dz + 0.06], MAT.TRIM);
    }
    for (let i = 0; i < 6; i++) {
      const y = base + (i + 0.5) * (h / 6);
      m.box([cx - 0.36, y, cz - 0.36], [cx + 0.36, y + 0.08, cz + 0.36], MAT.TRIM);
    }
    m.box([cx - 0.05, base + h, cz - 0.05], [cx + 0.05, base + h + 2.4, cz + 0.05], MAT.TRIM);
    m.box([cx + 0.3, base + h * 0.7, cz - 0.5], [cx + 0.45, base + h * 0.7 + 1.0, cz + 0.5], MAT.TRIM);
  });
}

/**
 * A parked appliance: chassis, body, cab, wheels and a light bar.
 *
 * Worth its ~120 triangles twice over. A fire station with nothing on the
 * apron reads as a warehouse with red paint; put one engine on it and the
 * building explains itself before you have read the sign.
 */
function vehicle(m: MeshBuilder, cx: number, cz: number, len: number, wide: number,
                 body: Tint, light = true): void {
  const hl = len / 2, hw = wide / 2;
  m.painted(body, () => {
    m.box([cx - hw, 0.42, cz - hl], [cx + hw, 2.35, cz + hl * 0.35], MAT.TRIM);
    m.box([cx - hw * 0.94, 0.42, cz + hl * 0.35], [cx + hw * 0.94, 2.05, cz + hl], MAT.TRIM);
  });
  // Windscreen and cab side glass.
  m.opening({ axis: 'z', sign: 1, plane: cz + hl, u0: cx - hw * 0.8, u1: cx + hw * 0.8,
    y0: 1.35, y1: 1.95, glass: MAT.GLASS, frame: 0.07, proud: 0.04 });
  for (const sx of [-1, 1] as const) {
    m.opening({ axis: 'x', sign: sx, plane: cx + sx * hw * 0.95, u0: cz + hl * 0.4, u1: cz + hl * 0.9,
      y0: 1.35, y1: 1.95, glass: MAT.GLASS, frame: 0.07, proud: 0.04 });
  }
  m.painted(TINT.METAL_DARK, () => {
    // Lockers down the body side, and the wheels.
    for (let i = 0; i < 3; i++) {
      const pz = cz - hl + 0.5 + i * (len * 0.42) / 3;
      for (const sx of [-1, 1] as const) {
        m.box([cx + sx * hw, 0.7, pz], [cx + sx * (hw + 0.06), 1.8, pz + (len * 0.36) / 3], MAT.TRIM);
      }
    }
    for (const pz of [cz - hl * 0.6, cz + hl * 0.62]) {
      for (const sx of [-1, 1] as const) {
        m.box([cx + sx * (hw - 0.12), 0.06, pz - 0.42], [cx + sx * (hw + 0.06), 0.92, pz + 0.42], MAT.TRIM);
      }
    }
    m.box([cx - hw * 0.9, 0.24, cz - hl], [cx + hw * 0.9, 0.44, cz + hl], MAT.TRIM);
  });
  if (light) {
    m.painted(TINT.SIGN_LIT, () => {
      m.box([cx - hw * 0.8, 2.05, cz + hl * 0.5], [cx + hw * 0.8, 2.24, cz + hl * 0.85], MAT.TRIM);
    });
  }
}

/** Hose reels and a hydrant board: wall furniture for an appliance bay. */
function bayKit(m: MeshBuilder, x0: number, x1: number, z: number): void {
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i < 3; i++) {
      const cx = x0 + (i + 0.5) * (x1 - x0) / 3;
      m.cylinder(cx, z + 0.55, 0.42, 1.1, 1.6, 10, MAT.TRIM);
      m.box([cx - 0.06, 0, z + 0.5], [cx + 0.06, 1.1, z + 0.62], MAT.TRIM);
    }
  });
  m.painted(TINT.BRAND, () => m.box([x1 + 0.2, 1.0, z + 0.04], [x1 + 0.9, 1.8, z + 0.12], MAT.TRIM));
}

// ==================================================================== fire

/** Three-bay neighbourhood station with a drill tower behind it. */
function fireStation(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 24.0, d = 16.0;
  const x = w / 2, z = d / 2;
  const bayH = 5.6, officeH = 7.2;

  m.box([-x, 0, -z], [x - 6.0, bayH, z], MAT.CONCRETE, { roof: MAT.TRIM });
  m.box([x - 6.0, 0, -z], [x, officeH, z], MAT.CLADDING, { roof: MAT.ROOF });

  if (medium) {
    parapet(m, -x, -z, x - 6.0, z, bayH, 0.9, 0.3);
    parapet(m, x - 6.0, -z, x, z, officeH, 0.8, 0.28);
    band(m, x - 6.0, -z, x, z, 3.6, 0.35, 0.2);
    drillTower(m, -x + 3.2, -z - 4.2, 5.0, 15.5);
    roofClutter(m, -x + 2, -z + 2, x - 8, z - 2, bayH, 901, 0.8);
  }
  if (fine) {
    bayDoors(m, -x + 1.2, x - 7.4, z, 3, 4.6);
    // Watch room and offices in the tall end.
    for (let f = 0; f < 2; f++) {
      m.windowRow({ axis: 'z', sign: 1, plane: z, from: x - 5.4, to: x - 0.6,
        y0: 1.1 + f * 3.6, y1: 3.0 + f * 3.6, count: 2, width: 1.7,
        glass: MAT.GLASS, frame: 0.11, proud: 0.06 });
    }
    ribbonStack(m, { axis: 'x', sign: 1, plane: x }, -z + 1.2, z - 1.2,
      { floors: 2, floorH: 3.6, base: 1.1, height: 1.9 });
    ribbonStack(m, { axis: 'z', sign: -1, plane: -z }, -x + 1.2, x - 1.2,
      { floors: 1, floorH: 3.2, base: 2.4, height: 1.5 });
    entrance(m, { axis: 'z', sign: 1, plane: z }, x - 3.0,
      { width: 1.9, height: 2.6, double: true, glazed: true, canopy: 1.8 });
    boxSign(m, { axis: 'z', sign: 1, plane: z }, x - 5.4, x - 0.6, officeH - 1.5, officeH - 0.4);
    mast(m, x - 3.0, officeH, -z + 3.0, 5.0);
    frontage(m, x - 6.0, x, z, 903, { planters: 2, bollards: 4, depth: 2.2 });
    // One appliance out on the apron, and the kit that lives on the bay wall.
    vehicle(m, -x + 4.6, z + 4.6, 7.4, 2.6, TINT.BRAND);
    bayKit(m, -x + 1.2, x - 7.4, z + 0.42);
    m.painted(TINT.METAL_DARK, () => {
      m.box([-x + 0.6, 0, -z - 7.2], [-x + 0.9, 9.0, -z - 6.9], MAT.TRIM);
    });
    serviceYard(m, x - 6.0, x, z, 905, { flag: true });
    kerb(m, -x - 1.0, z + 9.0, x, z + 9.4);
  }
  dressRoof(m, lod, 3343);
  return m;
}

/** An older two-bay fire house: brick, arched openings, a hose tower. */
function fireHouse(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 15.0, d = 13.0;
  const x = w / 2, z = d / 2;
  const ground = 5.0, upper = 3.6;
  const h = ground + upper;

  // Flat roof behind a heavy cornice, not a pitched domestic one: with tiles
  // and eaves this read as a large house with garage doors in it.
  m.box([-x, 0, -z], [x, h, z], MAT.CLADDING, { roof: MAT.ROOF });
  m.box([-x - 0.3, 0, -z - 0.3], [x + 0.3, 1.5, z + 0.3], MAT.STONE);

  if (medium) {
    band(m, -x, -z, x, z, h - 1.1, 1.1, 0.5, MAT.STONE);
    parapet(m, -x, -z, x, z, h, 1.3, 0.34);
    band(m, -x, -z, x, z, ground - 0.25, 0.45, 0.26);
    // Hose tower on the back corner, taller than the ridge.
    m.box([x - 3.6, 0, -z - 0.4], [x, h + 5.0, -z + 3.2], MAT.CONCRETE, { roof: MAT.ROOF });
    parapet(m, x - 3.6, -z - 0.4, x, -z + 3.2, h + 5.0, 0.8, 0.26);
    roofClutter(m, -x + 2, -z + 4, x - 5, z - 2, h + 2.4, 911, 0.4);
  }
  if (fine) {
    bayDoors(m, -x + 1.0, x - 1.0, z, 2, 4.2);
    ribbonStack(m, { axis: 'z', sign: 1, plane: z }, -x + 1.0, x - 1.0,
      { floors: 1, floorH: upper, base: ground + 1.2, height: 1.8 });
    ribbonStack(m, { axis: 'z', sign: -1, plane: -z }, -x + 1.0, x - 4.4,
      { floors: 2, floorH: 4.2, base: 1.2, height: 1.6 });
    for (const sx of [-1, 1] as const) {
      ribbonStack(m, { axis: 'x', sign: sx, plane: sx * x }, -z + 1.4, z - 1.4,
      { floors: 2, floorH: 4.2, base: 1.2, height: 1.6 });
    }
    // Stair lights up the hose tower.
    for (let f = 0; f < 4; f++) {
      m.opening({ axis: 'x', sign: 1, plane: x, u0: -z + 0.4, u1: -z + 2.4,
        y0: 2.0 + f * 3.2, y1: 3.4 + f * 3.2, glass: MAT.GLASS, frame: 0.11, proud: 0.06 });
    }
    entrance(m, { axis: 'x', sign: -1, plane: -x }, 0, { width: 1.2, height: 2.4, steps: 2, canopy: 1.3 });
    boxSign(m, { axis: 'z', sign: 1, plane: z }, -3.6, 3.6, ground + 0.3, ground + 1.0);
    vehicle(m, -3.2, z + 4.4, 6.8, 2.5, TINT.BRAND);
    bayKit(m, -x + 1.0, x - 1.0, z + 0.42);
    // Stone name panel over the bays, and a lamp each side of the door.
    m.painted(TINT.BRAND_DARK, () =>
      m.box([-4.4, ground + 1.1, z - 0.05], [4.4, ground + 1.9, z + 0.22], MAT.STONE));
    m.painted(TINT.SIGN_LIT, () => {
      for (const px of [-5.2, 5.2]) {
        m.box([px - 0.2, ground + 0.6, z + 0.02], [px + 0.2, ground + 1.3, z + 0.26], MAT.TRIM);
      }
    });
    serviceYard(m, -x, x, z + 9.0, 913, { totem: true, flag: true });
    // Deep-set mess room windows in a stone surround, and roof plant behind
    // the cornice.
    for (const dx of [-4.4, 0.0, 4.4]) {
      m.painted(TINT.BRAND_DARK, () => {
        m.box([dx - 1.15, ground + 0.9, z - 0.05], [dx + 1.15, ground + 3.1, z + 0.22], MAT.STONE);
      });
      m.opening({ axis: 'z', sign: 1, plane: z + 0.22, u0: dx - 0.9, u1: dx + 0.9,
        y0: ground + 1.15, y1: ground + 2.85, glass: MAT.GLASS, frame: 0.1, proud: 0.06 });
    }
    roofClutter(m, -x + 2, -z + 2, x - 5, z - 2, h, 915, 1.1);
    m.painted(TINT.METAL_DARK, () => {
      for (const px of [-4.0, 4.0]) {
        m.box([px - 0.09, 0, -z - 3.4], [px + 0.09, 4.6, -z - 3.22], MAT.TRIM);
      }
      for (let i = 0; i < 4; i++) {
        m.box([-4.0, 3.4 + i * 0.35, -z - 3.38], [4.0, 3.46 + i * 0.35, -z - 3.26], MAT.TRIM);
      }
    });
    bollards(m, { axis: 'z', sign: 1, plane: z }, -x + 1.0, x - 1.0, 8.4, 7);
  }
  return m;
}

/** Fire headquarters: six bays, a training tower and a floor of offices. */
function fireHQ(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 40.0, d = 20.0;
  const x = w / 2, z = d / 2;
  const bayH = 6.2, officeH = 12.0;

  m.box([-x, 0, -z], [x, bayH, z], MAT.CONCRETE, { roof: MAT.TRIM });
  m.box([-x, bayH, -z], [x - 10.0, officeH, z - 2.0], MAT.CLADDING, { roof: MAT.ROOF });
  m.box([x - 10.0, 0, -z], [x, officeH + 3.0, z], MAT.CONCRETE, { roof: MAT.ROOF });

  if (medium) {
    parapet(m, -x, -z, x - 10.0, z - 2.0, officeH, 1.0, 0.32);
    parapet(m, x - 10.0, -z, x, z, officeH + 3.0, 1.0, 0.32);
    band(m, -x, -z, x, z, bayH, 0.5, 0.36);
    drillTower(m, x - 5.0, -z - 6.5, 6.4, 22.0);
    roofClutter(m, -x + 3, -z + 3, x - 12, z - 5, officeH, 921, 1.1);
    // Muster yard behind the appliance bays.
    m.box([-x, 0.001, z], [x - 10.0, 0.1, z + 12.0], MAT.CONCRETE);
  }
  if (fine) {
    bayDoors(m, -x + 1.5, x - 11.5, z, 6, 5.2);
    for (let f = 0; f < 2; f++) {
      m.opening({ axis: 'z', sign: 1, plane: z - 2.0, u0: -x + 1.0, u1: x - 11.0,
        y0: bayH + 0.9 + f * 2.6, y1: bayH + 2.6 + f * 2.6,
        glass: MAT.GLASS, frame: 0.12, proud: 0.06 });
    }
    ribbonStack(m, { axis: 'z', sign: 1, plane: z }, x - 9.2, x - 0.8,
      { floors: 4, floorH: 3.4, base: 1.2, height: 2.0 });
    ribbonStack(m, { axis: 'x', sign: 1, plane: x }, -z + 1.2, z - 1.2,
      { floors: 4, floorH: 3.4, base: 1.2, height: 2.0 });
    ribbonStack(m, { axis: 'z', sign: -1, plane: -z }, -x + 1.5, x - 11.5,
      { floors: 1, floorH: 3, base: 3.0, height: 1.5 });
    entrance(m, { axis: 'z', sign: 1, plane: z }, x - 5.0,
      { width: 2.6, height: 3.2, double: true, glazed: true, canopy: 2.4 });
    boxSign(m, { axis: 'z', sign: 1, plane: z }, x - 8.4, x - 1.6, officeH + 1.0, officeH + 2.4);
    mast(m, -x + 3.0, officeH, -z + 3.0, 7.0);
    frontage(m, x - 10.0, x, z, 923, { planters: 3, bollards: 6, depth: 2.4 });
    kerb(m, -x, z + 12.0, x, z + 12.4);
  }
  dressRoof(m, lod, 3350);
  return m;
}

/** Air rescue base: a hangar, an apron pad and a windsock. */
function airRescue(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 20.0, z = 17.0;
  const hangarW = 20.0, hangarD = 15.0, hangarH = 9.0;
  const hx = -x + hangarW / 2 + 1.0, hz = -z + hangarD / 2 + 1.0;

  m.box([hx - hangarW / 2, 0, hz - hangarD / 2], [hx + hangarW / 2, hangarH, hz + hangarD / 2],
    MAT.CLADDING, { roof: MAT.TRIM });

  if (medium) {
    // Barrel-ish roof, faked with three flat facets. Cheaper than a curve and
    // reads the same at any distance a player uses.
    const seg: Array<[number, number, number]> = [[-1.0, 0.0, 1.2], [-0.34, 1.2, 1.9], [0.34, 1.9, 1.2]];
    for (const [t0, y0, y1] of seg) {
      const a = hx + t0 * hangarW / 2;
      const b = hx + (t0 + 0.66) * hangarW / 2;
      m.quad([a, hangarH + y0, hz + hangarD / 2], [b, hangarH + y1, hz + hangarD / 2],
             [b, hangarH + y1, hz - hangarD / 2], [a, hangarH + y0, hz - hangarD / 2], MAT.METAL);
    }
    for (const [t0, y0, y1] of seg) {
      const a = hx - t0 * hangarW / 2;
      const b = hx - (t0 + 0.66) * hangarW / 2;
      m.quad([b, hangarH + y1, hz + hangarD / 2], [a, hangarH + y0, hz + hangarD / 2],
             [a, hangarH + y0, hz - hangarD / 2], [b, hangarH + y1, hz - hangarD / 2], MAT.METAL);
    }
    // Crew block on the end.
    m.box([hx + hangarW / 2, 0, hz - hangarD / 2], [x - 0.5, 6.6, hz + 2.0], MAT.CLADDING, { roof: MAT.ROOF });
    parapet(m, hx + hangarW / 2, hz - hangarD / 2, x - 0.5, hz + 2.0, 6.6, 0.7, 0.24);
    roofClutter(m, hx + hangarW / 2 + 1, hz - hangarD / 2 + 1, x - 1.5, hz + 1, 6.6, 931, 0.6);
  }
  if (fine) {
    // Hangar door: full width, in leaves.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 6; i++) {
        const a = hx - hangarW / 2 + 0.6 + i * (hangarW - 1.2) / 6;
        const b = a + (hangarW - 1.2) / 6 - 0.14;
        m.box([a, 0, hz + hangarD / 2 + 0.02], [b, 6.8, hz + hangarD / 2 + 0.18], MAT.TRIM);
      }
    });
    m.painted(TINT.BRAND, () =>
      m.box([hx - hangarW / 2 - 0.3, 6.9, hz + hangarD / 2 - 0.2],
            [hx + hangarW / 2 + 0.3, 7.9, hz + hangarD / 2 + 0.45], MAT.TRIM));
    // Landing pad: circle of paint plus perimeter lights.
    const px = 4.0, pz = z - 8.0;
    m.box([px - 8.0, 0.001, pz - 8.0], [px + 8.0, 0.08, pz + 8.0], MAT.CONCRETE);
    m.painted(TINT.SIGN_LIT, () => {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        m.box([px + Math.cos(a) * 7.0 - 0.16, 0.08, pz + Math.sin(a) * 7.0 - 0.16],
              [px + Math.cos(a) * 7.0 + 0.16, 0.32, pz + Math.sin(a) * 7.0 + 0.16], MAT.TRIM);
      }
    });
    m.painted(TINT.BRAND, () => {
      m.box([px - 2.4, 0.09, pz - 0.5], [px + 2.4, 0.11, pz + 0.5], MAT.TRIM);
      m.box([px - 0.5, 0.09, pz - 2.4], [px + 0.5, 0.11, pz + 2.4], MAT.TRIM);
    });
    // Windsock on a pole, and the crew block's windows.
    m.painted(TINT.METAL_DARK, () => m.box([-x + 1.5, 0, z - 2.0], [-x + 1.8, 8.0, z - 1.7], MAT.TRIM));
    m.painted(TINT.BRAND, () => {
      m.cone(-x + 1.65, z - 1.85, 0.7, 0.3, 7.0, 8.0, 8, MAT.TRIM);
    });
    ribbonStack(m, { axis: 'z', sign: 1, plane: hz + 2.0 }, hx + hangarW / 2 + 0.6, x - 1.1,
      { floors: 2, floorH: 3.2, base: 1.0, height: 1.6 });
    entrance(m, { axis: 'z', sign: 1, plane: hz + 2.0 }, hx + hangarW / 2 + 2.0,
      { width: 1.4, height: 2.4, double: true, glazed: true, canopy: 1.4 });
    // Fuel bowser, a ground-power unit and the fence round the pad.
    m.painted(TINT.BRAND, () => {
      m.cylinder(px - 9.4, pz + 3.0, 1.1, 0.5, 3.4, 12, MAT.METAL);
      m.box([px - 10.5, 0, pz + 1.8], [px - 8.3, 0.5, pz + 4.2], MAT.CONCRETE);
    });
    m.painted(TINT.METAL_DARK, () => {
      m.box([px - 9.7, 0.5, pz + 4.2], [px - 9.1, 2.4, pz + 4.6], MAT.TRIM);
      m.box([px + 8.4, 0, pz - 2.0], [px + 10.0, 1.4, pz + 0.6], MAT.TRIM);
      for (let i = 0; i <= 22; i++) {
        const a = -x + i * (2 * x / 22);
        m.box([a - 0.06, 0, z - 0.06], [a + 0.06, 2.4, z + 0.06], MAT.TRIM);
      }
      m.box([-x, 2.25, z - 0.08], [x, 2.35, z + 0.08], MAT.TRIM);
    });
    // Roof plant and rooflights on the hangar.
    for (let i = 0; i < 4; i++) {
      const rx = hx - hangarW / 2 + 2.5 + i * (hangarW - 5.0) / 3;
      m.box([rx - 1.2, hangarH + 1.86, hz - 3.0], [rx + 1.2, hangarH + 1.96, hz + 3.0], MAT.GLASS);
    }
    roofClutter(m, hx - 6, hz - 5, hx + 6, hz + 5, hangarH + 1.9, 933, 0.5);
    vehicle(m, -x + 6.0, z - 3.0, 5.4, 2.2, TINT.ACCENT, false);
    serviceYard(m, hx - hangarW / 2, hx + hangarW / 2, hz + hangarD / 2 + 9.0, 935, {});
    // A standby tender at the pad edge, which every air base keeps manned.
    vehicle(m, px - 11.0, pz - 4.0, 6.4, 2.5, TINT.BRAND);
    // Portal ribs across the hangar's open end, floodlight masts round the
    // pad, and the taxi line joining the two.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 6; i++) {
        const rx = hx - hangarW / 2 + i * hangarW / 6;
        m.box([rx - 0.12, 0, hz + hangarD / 2 + 0.18], [rx + 0.12, 7.9, hz + hangarD / 2 + 0.38], MAT.TRIM);
      }
      m.box([hx - hangarW / 2, 7.7, hz + hangarD / 2 + 0.18],
            [hx + hangarW / 2, 7.9, hz + hangarD / 2 + 0.38], MAT.TRIM);
      for (const [mx, mz] of [[px - 9.5, pz - 8.5], [px + 9.5, pz - 8.5], [px + 9.5, pz + 8.5]] as const) {
        m.box([mx - 0.16, 0, mz - 0.16], [mx + 0.16, 10.0, mz + 0.16], MAT.TRIM);
        m.box([mx - 1.2, 10.0, mz - 0.45], [mx + 1.2, 10.45, mz + 0.45], MAT.TRIM);
      }
    });
    m.painted(TINT.ACCENT, () => {
      m.box([px - 0.25, 0.085, hz + hangarD / 2 + 0.5], [px + 0.25, 0.1, pz - 7.0], MAT.TRIM);
    });
    // A second helicopter on the pad, and the maintenance stands beside it.
    // A base with an empty pad reads as a car park with a circle painted on it.
    m.painted(TINT.BRAND, () => {
      m.box([px - 1.1, 1.3, pz - 3.6], [px + 1.1, 2.9, pz + 2.4], MAT.TRIM);
      m.cone(px, pz + 3.4, 0.9, 0.28, 1.6, 2.6, 10, MAT.TRIM);
      m.box([px - 0.42, 1.9, pz + 2.4], [px + 0.42, 2.5, pz + 5.6], MAT.TRIM);
      m.box([px - 0.16, 2.4, pz + 5.2], [px + 0.16, 3.5, pz + 5.6], MAT.TRIM);
    });
    m.opening({ axis: 'z', sign: -1, plane: pz - 3.6, u0: px - 0.95, u1: px + 0.95,
      y0: 1.7, y1: 2.7, glass: MAT.GLASS, frame: 0.08, proud: 0.05 });
    m.painted(TINT.METAL_DARK, () => {
      // Rotor head, blades and skids.
      m.cylinder(px, pz - 0.6, 0.22, 2.9, 3.3, 8, MAT.TRIM);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        m.box([px + Math.cos(a) * 0.2 - 0.16, 3.22, pz - 0.6 + Math.sin(a) * 0.2 - 0.16],
              [px + Math.cos(a) * 5.2 + 0.16, 3.34, pz - 0.6 + Math.sin(a) * 5.2 + 0.16], MAT.TRIM);
      }
      for (const sx of [-1.15, 1.15]) {
        m.box([px + sx - 0.07, 0.12, pz - 3.2], [px + sx + 0.07, 0.24, pz + 2.0], MAT.TRIM);
        for (const sz of [pz - 2.6, pz + 1.4]) {
          m.box([px + sx * 0.5 - 0.06, 0.24, sz - 0.06], [px + sx - 0.02, 1.3, sz + 0.06], MAT.TRIM);
        }
      }
      // Two work stands.
      for (const sx of [-6.2, 6.2]) {
        m.box([px + sx - 0.9, 0, pz + 5.0], [px + sx + 0.9, 0.12, pz + 6.4], MAT.TRIM);
        m.box([px + sx - 0.9, 1.6, pz + 5.0], [px + sx + 0.9, 1.75, pz + 6.4], MAT.TRIM);
        for (const [ox, oz] of [[-0.8, 5.1], [0.7, 5.1], [-0.8, 6.2], [0.7, 6.2]] as const) {
          m.box([px + sx + ox - 0.06, 0.12, pz + oz], [px + sx + ox + 0.06, 1.6, pz + oz + 0.12], MAT.TRIM);
        }
      }
    });
    kerb(m, -x, z, x, z + 0.4);
  }
  dressRoof(m, lod, 3357);
  return m;
}

// ================================================================== police

/** A small neighbourhood post: one storey, a counter and a lamp. */
function policePost(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 13.0, d = 10.0, h = 4.4;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], MAT.STONE, { roof: MAT.ROOF });
  m.box([-x + 2.0, 0, z - 0.2], [x - 2.0, h + 1.2, z + 1.6], MAT.CLADDING, { roof: MAT.TRIM });

  if (medium) {
    parapet(m, -x, -z, x, z, h, 0.8, 0.28);
    parapet(m, -x + 2.0, z - 0.2, x - 2.0, z + 1.6, h + 1.2, 0.6, 0.3);
    band(m, -x, -z, x, z, 0.9, 0.3, 0.2);
    roofClutter(m, -x + 1.5, -z + 1.5, x - 1.5, z - 2.5, h, 941, 0.8);
    // Two parking bays alongside.
    m.box([-x - 6.0, 0.001, -z], [-x, 0.08, z], MAT.CONCRETE);
  }
  if (fine) {
    m.windowRow({ axis: 'z', sign: 1, plane: z + 1.6, from: -x + 2.6, to: x - 2.6,
      y0: 1.0, y1: 3.2, count: 3, width: 1.6, glass: MAT.SHOPFRONT, frame: 0.12, proud: 0.07 });
    entrance(m, { axis: 'z', sign: 1, plane: z + 1.6 }, -x + 3.6,
      { width: 1.4, height: 2.4, double: true, glazed: true, steps: 1 });
    policeLamp(m, -x + 3.6, 2.7, z + 1.62);
    ribbonStack(m, { axis: 'x', sign: 1, plane: x }, -z + 1.2, z - 1.2,
      { floors: 1, floorH: 3, base: 1.6, height: 1.5 });
    ribbonStack(m, { axis: 'z', sign: -1, plane: -z }, -x + 1.2, x - 1.2,
      { floors: 1, floorH: 3, base: 1.6, height: 1.5 });
    boxSign(m, { axis: 'z', sign: 1, plane: z + 1.6 }, -2.4, 2.4, 3.6, 4.7);
    // Bars on the rear windows: the detail that says this is not an office.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 16; i++) {
        const px = -x + 1.6 + i * (w - 3.2) / 16;
        m.box([px - 0.04, 1.6, -z - 0.14], [px + 0.04, 3.1, -z - 0.06], MAT.TRIM);
      }
    });
    for (let i = 0; i < 3; i++) {
      m.box([-x - 5.4 + i * 1.9, 0.004, -z + 0.8], [-x - 5.34 + i * 1.9, 0.02, z - 0.8], MAT.TRIM);
    }
    frontage(m, -x, x, z + 1.6, 943, { planters: 2, bollards: 6, depth: 2.2 });
    // Two patrol cars on the bays, a notice board and a security camera.
    vehicle(m, -x - 4.4, -1.4, 4.6, 2.0, TINT.ACCENT, true);
    vehicle(m, -x - 2.2, 2.2, 4.6, 2.0, TINT.ACCENT, true);
    m.painted(TINT.METAL_DARK, () => {
      m.box([x - 2.6, 1.1, z + 1.62], [x - 1.0, 2.3, z + 1.72], MAT.TRIM);
      m.box([-x + 0.6, h + 1.0, z + 1.2], [-x + 0.78, h + 2.6, z + 1.38], MAT.TRIM);
      m.box([-x + 0.4, h + 2.4, z + 1.0], [-x + 1.0, h + 2.7, z + 1.9], MAT.TRIM);
    });
    m.painted(TINT.BRAND, () =>
      m.box([-x + 2.2, h + 1.2, z + 1.4], [x - 2.2, h + 1.9, z + 1.75], MAT.TRIM));
    serviceYard(m, -x, x, z + 1.6, 945, { flag: false });
    // Staff cars on the far bays.
    vehicle(m, -x - 4.4, -4.4, 4.4, 1.9, TINT.METAL_DARK, false);
    vehicle(m, -x - 2.2, -0.6, 4.4, 1.9, TINT.WOOD, false);
    // Single-storey custody wing at the back, and the fence round the bays.
    m.box([-x + 1.0, 0, -z - 5.0], [x - 3.0, 3.4, -z], MAT.CONCRETE, { roof: MAT.ROOF });
    parapet(m, -x + 1.0, -z - 5.0, x - 3.0, -z, 3.4, 0.55, 0.24);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 4; i++) {
        const cx = -x + 2.6 + i * 2.4;
        m.opening({ axis: 'z', sign: -1, plane: -z - 5.0, u0: cx - 0.3, u1: cx + 0.3,
          y0: 2.0, y1: 2.9, glass: MAT.GLASS, frame: 0.14, proud: 0.07 });
      }
      for (let i = 0; i <= 8; i++) {
        const pz = -z + i * (d / 8);
        m.box([-x - 6.1, 0, pz - 0.05], [-x - 5.95, 2.2, pz + 0.05], MAT.TRIM);
      }
      m.box([-x - 6.1, 2.05, -z], [-x - 5.95, 2.15, z], MAT.TRIM);
    });
    roofClutter(m, -x + 1.5, -z - 4.5, x - 3.5, -z - 0.5, 3.4, 947, 0.9);
    // Public counter inside the glazed bay: a desk, a screen and a bench, which
    // is what the glass is there to show.
    m.painted(TINT.WOOD, () => {
      m.box([-x + 3.0, 0.9, z + 0.2], [x - 4.0, 1.05, z + 0.9], MAT.TRIM);
    });
    m.painted(TINT.METAL_DARK, () => {
      m.box([-x + 3.0, 0, z + 0.3], [x - 4.0, 0.9, z + 0.8], MAT.TRIM);
      m.box([-x + 3.4, 1.05, z + 0.35], [x - 4.4, 2.4, z + 0.45], MAT.TRIM);
      for (const px2 of [x - 3.2, x - 1.6]) {
        m.box([px2 - 0.6, 0.42, z + 0.4], [px2 + 0.6, 0.52, z + 1.0], MAT.TRIM);
        for (const oz of [z + 0.45, z + 0.9]) {
          m.box([px2 - 0.55, 0, oz], [px2 - 0.45, 0.42, oz + 0.1], MAT.TRIM);
          m.box([px2 + 0.45, 0, oz], [px2 + 0.55, 0.42, oz + 0.1], MAT.TRIM);
        }
      }
    });
  }
  return m;
}

/** A precinct station: two storeys, a yard behind a wall, a lit mast. */
function policeStation(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 24.0, d = 16.0;
  const x = w / 2, z = d / 2;
  const floors = 3, floorH = 3.5, ground = 4.2;
  const h = ground + (floors - 1) * floorH;

  m.box([-x, 0, -z], [x, h, z], MAT.PLASTER, { roof: MAT.ROOF });
  m.box([-x, 0, -z], [x, ground - 0.4, z], MAT.STONE);
  // Entrance bay standing forward and up.
  m.box([-5.0, 0, z - 0.3], [1.0, h + 2.0, z + 2.0], MAT.CLADDING, { roof: MAT.ROOF });

  if (medium) {
    parapet(m, -x, -z, x, z, h, 1.0, 0.3);
    parapet(m, -5.0, z - 0.3, 1.0, z + 2.0, h + 2.0, 0.8, 0.3);
    for (let f = 1; f < floors; f++) band(m, -x, -z, x, z, ground + (f - 1) * floorH, 0.4, 0.22);
    mast(m, x - 3.0, h, -z + 3.0, 6.5);
    roofClutter(m, -x + 2, -z + 2, x - 5, z - 3, h, 951, 1.0);
    // Secure yard: wall, gate piers, vehicle bays.
    m.box([-x - 9.0, 0, -z], [-x, 2.8, -z + 0.4], MAT.CONCRETE);
    m.box([-x - 9.4, 0, -z], [-x - 9.0, 2.8, z], MAT.CONCRETE);
    m.box([-x - 9.0, 0.001, -z + 0.4], [-x, 0.1, z], MAT.CONCRETE);
  }
  if (fine) {
    for (const [axis, sign, plane, u0, u1, n] of [
      ['z', 1, z, 1.6, x - 1.0, 4],
      ['z', -1, -z, -x + 1.0, x - 1.0, 7],
      ['x', 1, x, -z + 1.0, z - 1.0, 4],
      ['x', -1, -x, -z + 1.0, z - 1.0, 4],
    ] as const) {
      ribbonStack(m, { axis, sign, plane }, u0, u1,
        { floors: floors - 1, floorH, base: ground + 0.9, height: 2.0 });
      void n;
    }
    ribbonStack(m, { axis: 'z', sign: 1, plane: z }, -x + 1.0, -5.6,
      { floors: floors - 1, floorH, base: ground + 0.9, height: 2.0 });
    for (let f = 0; f < floors; f++) {
      m.opening({ axis: 'z', sign: 1, plane: z + 2.0, u0: -4.4, u1: 0.4,
        y0: 0.9 + f * 3.7, y1: 3.1 + f * 3.7, glass: MAT.GLASS, frame: 0.13, proud: 0.07 });
    }
    // Fins across the front, and a portal frame over the entrance bay: the
    // two gestures a civic building makes that a house never does.
    fins(m, { axis: 'z', sign: 1, plane: z }, 1.6, x - 1.0, ground, h - 0.2, 7, 0.5);
    portal(m, -5.0, 1.0, z + 2.0, h + 2.0, 2.0, 2);
    // Horizontal brise-soleil over each ribbon, and the stair expressed as a
    // half-drum on the flank -- civic massing, not a bigger house.
    m.painted(TINT.METAL_DARK, () => {
      for (let f = 1; f < floors; f++) {
        const y = ground + (f - 1) * floorH + 2.4;
        for (let i = 0; i < 4; i++) {
          m.box([1.6, y + i * 0.16, z + 0.5], [x - 1.0, y + i * 0.16 + 0.07, z + 1.1], MAT.TRIM);
        }
      }
    });
    m.cylinder(-x, 0, 2.6, 0, h + 1.6, 14, MAT.CONCRETE, false);
    for (let f = 0; f < floors; f++) {
      m.opening({ axis: 'x', sign: -1, plane: -x - 2.6, u0: -1.6, u1: 1.6,
        y0: 1.0 + f * floorH, y1: 2.9 + f * floorH, glass: MAT.GLASS, frame: 0.12, proud: 0.06 });
    }
    parapet(m, -x - 2.6, -2.6, -x + 2.6, 2.6, h + 1.6, 0.9, 0.3);
    entrance(m, { axis: 'z', sign: 1, plane: z + 2.0 }, -2.0,
      { width: 2.4, height: 3.0, double: true, glazed: true, steps: 2, canopy: 2.2 });
    policeLamp(m, -2.0, 3.5, z + 2.02);
    boxSign(m, { axis: 'z', sign: 1, plane: z + 2.0 }, -4.4, 0.4, h + 0.4, h + 1.6);
    // Barred cell windows on the ground floor of the flank.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 20; i++) {
        const pz = -z + 1.0 + i * (d - 2.0) / 20;
        m.box([-x - 0.14, 2.2, pz - 0.04], [-x - 0.06, 3.4, pz + 0.04], MAT.TRIM);
      }
      // Gate to the yard.
      for (let i = 0; i <= 10; i++) {
        m.box([-x - 8.9 + i * 0.86, 0, -z + 0.06], [-x - 8.82 + i * 0.86, 2.4, -z + 0.18], MAT.TRIM);
      }
    });
    frontage(m, -x, x, z, 953, { planters: 3, bollards: 8, depth: 2.4 });
  }
  return m;
}

/** Police headquarters: a glazed tower on a stone base. */
function policeHQ(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 13.0, z = 11.0;
  const podium = 7.5;
  const floors = 9, floorH = 3.6;
  const top = podium + floors * floorH;

  m.box([-x, 0, -z], [x, podium, z], MAT.STONE, { roof: MAT.ROOF });
  m.box([-x + 2.0, podium, -z + 1.5], [x - 2.0, top, z - 1.5], MAT.GLASS, { roof: MAT.ROOF });

  if (medium) {
    band(m, -x, -z, x, z, podium, 0.8, 0.45);
    parapet(m, -x + 2.0, -z + 1.5, x - 2.0, z - 1.5, top, 1.2, 0.34);
    // Solid service core standing proud of the glass on the back.
    m.box([-3.2, 0, -z - 1.2], [3.2, top + 4.0, -z + 2.5], MAT.CONCRETE, { roof: MAT.ROOF });
    for (let f = 1; f <= floors; f++) {
      band(m, -x + 2.0, -z + 1.5, x - 2.0, z - 1.5, podium + f * floorH - 0.5, 0.5, 0.2, MAT.PLASTER);
    }
    mast(m, 0, top + 4.0, -z + 0.7, 6.0);
    roofClutter(m, -x + 3, -z + 3, x - 3, z - 3, top, 961, 0.8);
  }
  if (fine) {
    for (let f = 0; f < floors; f++) {
      const y = podium + f * floorH + 0.55;
      for (const [axis, sign, plane, half] of [
        ['z', 1, z - 1.5, x - 2.0], ['z', -1, -z + 1.5, x - 2.0],
        ['x', 1, x - 2.0, z - 1.5], ['x', -1, -x + 2.0, z - 1.5],
      ] as const) {
        m.opening({ axis, sign, plane, u0: -half + 0.8, u1: half - 0.8, y0: y, y1: y + 2.4,
          glass: MAT.GLASS, frame: 0.1, proud: 0.05 });
      }
    }
    m.windowRow({ axis: 'z', sign: 1, plane: z, from: -x + 1.2, to: -3.0, y0: 1.4, y1: 5.4,
      count: 3, width: 2.2, glass: MAT.SHOPFRONT, frame: 0.13, proud: 0.07 });
    m.windowRow({ axis: 'z', sign: 1, plane: z, from: 3.0, to: x - 1.2, y0: 1.4, y1: 5.4,
      count: 3, width: 2.2, glass: MAT.SHOPFRONT, frame: 0.13, proud: 0.07 });
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0,
      { width: 3.0, height: 3.4, double: true, glazed: true, steps: 3, canopy: 2.8 });
    policeLamp(m, 0, 4.0, z + 0.02);
    boxSign(m, { axis: 'z', sign: 1, plane: z }, -3.4, 3.4, 5.8, 7.0);
    for (let f = 0; f < floors + 2; f++) {
      m.opening({ axis: 'x', sign: 1, plane: 3.2, u0: -z - 0.8, u1: -z + 2.1,
        y0: f * floorH + 1.0, y1: f * floorH + 2.4, glass: MAT.GLASS, frame: 0.1, proud: 0.05 });
    }
    frontage(m, -x, x, z, 963, { planters: 4, bollards: 9, depth: 2.6 });
  }
  return m;
}

/** Detention centre: a blank block inside a walled compound with towers. */
function detention(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 22.0, z = 17.0;
  const bw = 26.0, bd = 14.0, bh = 11.0;

  m.box([-bw / 2, 0, -bd / 2 - 1.0], [bw / 2, bh, bd / 2 - 1.0], MAT.CONCRETE, { roof: MAT.TRIM });

  if (medium) {
    parapet(m, -bw / 2, -bd / 2 - 1.0, bw / 2, bd / 2 - 1.0, bh, 1.2, 0.3);
    for (let y = 3.4; y < bh - 1.0; y += 3.4) {
      band(m, -bw / 2, -bd / 2 - 1.0, bw / 2, bd / 2 - 1.0, y, 0.3, 0.18, MAT.PLASTER);
    }
    // Perimeter wall with watch towers on two corners.
    for (const [a, b] of [
      [[-x, -z], [x, -z]], [[-x, z], [x, z]],
    ] as const) {
      m.box([a[0], 0, a[1] - 0.35], [b[0], 4.2, b[1] + 0.35], MAT.CONCRETE);
    }
    for (const sx of [-1, 1] as const) {
      m.box([sx * x - sx * 0.35, 0, -z], [sx * x + sx * 0.35, 4.2, z], MAT.CONCRETE);
      const tx = sx * (x - 1.2);
      m.box([tx - 1.5, 0, z - 3.0], [tx + 1.5, 8.5, z], MAT.CONCRETE, { roof: MAT.TRIM });
      m.box([tx - 2.1, 8.5, z - 3.6], [tx + 2.1, 10.6, z + 0.6], MAT.GLASS, { roof: MAT.TRIM });
      m.box([tx - 2.4, 10.6, z - 3.9], [tx + 2.4, 11.1, z + 0.9], MAT.CONCRETE);
    }
    m.box([-x, 0.001, -z], [x, 0.08, z], MAT.CONCRETE);
    roofClutter(m, -bw / 2 + 2, -bd / 2 + 1, bw / 2 - 2, bd / 2 - 3, bh, 971, 0.7);
  }
  if (fine) {
    // Cell windows: narrow slots, barred, in a strict grid.
    for (let f = 0; f < 3; f++) {
      for (const [sign, plane] of [[1, bd / 2 - 1.0], [-1, -bd / 2 - 1.0]] as const) {
        for (let i = 0; i < 11; i++) {
          const cx = -bw / 2 + 1.4 + i * (bw - 2.8) / 10;
          m.opening({ axis: 'z', sign, plane, u0: cx - 0.28, u1: cx + 0.28,
            y0: 1.6 + f * 3.4, y1: 3.2 + f * 3.4, glass: MAT.GLASS, frame: 0.14, proud: 0.07 });
        }
      }
    }
    m.painted(TINT.METAL_DARK, () => {
      // Razor coil along the top of the wall, faked as a run of small boxes.
      for (let i = 0; i < 40; i++) {
        const px = -x + i * (2 * x / 40);
        m.box([px, 4.2, -z - 0.1], [px + 0.5, 4.75, -z + 0.1], MAT.TRIM);
        m.box([px, 4.2, z - 0.1], [px + 0.5, 4.75, z + 0.1], MAT.TRIM);
      }
      // Gate.
      for (let i = 0; i <= 12; i++) {
        m.box([-3.6 + i * 0.6, 0, z - 0.1], [-3.52 + i * 0.6, 3.6, z + 0.1], MAT.TRIM);
      }
    });
    // Entrance block outside the wall.
    m.box([-6.0, 0, z + 0.35], [-2.0, 4.0, z + 5.0], MAT.CONCRETE, { roof: MAT.ROOF });
    parapet(m, -6.0, z + 0.35, -2.0, z + 5.0, 4.0, 0.6, 0.24);
    entrance(m, { axis: 'z', sign: 1, plane: z + 5.0 }, -4.0,
      { width: 1.6, height: 2.5, double: true, glazed: true, canopy: 1.5 });
    ribbonStack(m, { axis: 'x', sign: -1, plane: -6.0 }, z + 1.0, z + 4.4,
      { floors: 1, floorH: 3, base: 1.4, height: 1.4 });
    boxSign(m, { axis: 'z', sign: 1, plane: z + 5.0 }, -5.4, -2.6, 2.9, 3.8);
    for (const sx of [-1, 1] as const) mast(m, sx * (x - 1.2), 11.1, z - 1.5, 3.0);
    kerb(m, -x - 1.0, z + 5.0, x + 1.0, z + 5.4);
  }
  return m;
}

// ============================================================== healthcare

/** A local clinic: two storeys, a glazed waiting room, a drop-off bay. */
function clinic(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 22.0, d = 14.0;
  const x = w / 2, z = d / 2;
  const floors = 2, floorH = 3.8;
  const h = floors * floorH;

  m.box([-x, 0, -z], [x, h, z], MAT.PLASTER, { roof: MAT.ROOF });
  m.box([-x + 1.5, 0, z - 0.3], [-x + 9.0, h - 0.4, z + 3.0], MAT.GLASS, { roof: MAT.TRIM });

  if (medium) {
    parapet(m, -x, -z, x, z, h, 0.9, 0.3);
    parapet(m, -x + 1.5, z - 0.3, -x + 9.0, z + 3.0, h - 0.4, 0.6, 0.28);
    band(m, -x, -z, x, z, floorH - 0.4, 0.4, 0.22);
    // Ambulance canopy along the far end.
    m.box([x - 10.0, 4.0, z], [x, 4.5, z + 5.0], MAT.CONCRETE);
    m.painted(TINT.METAL_DARK, () => {
      for (const px of [x - 9.2, x - 0.8]) {
        m.box([px - 0.16, 0, z + 4.3], [px + 0.16, 4.0, z + 4.62], MAT.TRIM);
      }
    });
    m.box([x - 10.0, 0.001, z], [x, 0.08, z + 5.4], MAT.CONCRETE);
    roofClutter(m, -x + 2, -z + 2, x - 2, z - 2, h, 981, 1.1);
  }
  if (fine) {
    for (let f = 0; f < 2; f++) {
      m.opening({ axis: 'z', sign: 1, plane: z + 3.0, u0: -x + 2.2, u1: -x + 8.3,
        y0: 0.8 + f * 3.8, y1: 3.2 + f * 3.8, glass: MAT.GLASS, frame: 0.13, proud: 0.07 });
    }
    for (const [axis, sign, plane, u0, u1, n] of [
      ['z', 1, z, -x + 10.0, x - 1.0, 4],
      ['z', -1, -z, -x + 1.0, x - 1.0, 7],
      ['x', 1, x, -z + 1.0, z - 1.0, 4],
      ['x', -1, -x, -z + 1.0, z - 1.0, 4],
    ] as const) {
      ribbonStack(m, { axis, sign, plane }, u0, u1,
        { floors, floorH, base: 1.1, height: 2.0 });
      void n;
    }
    fins(m, { axis: 'z', sign: 1, plane: z }, -x + 10.0, x - 1.0, 0.6, h - 0.3, 6, 0.42);
    // Louvred plant screen on the roof and a glazed link to the ambulance bay:
    // the two things a clinic has that a house does not.
    louvres(m, { axis: 'z', sign: 1, plane: z }, -x + 11.0, x - 2.0, h + 0.2, h + 1.9);
    louvres(m, { axis: 'x', sign: 1, plane: x }, -z + 2.0, z - 2.0, h + 0.2, h + 1.9);
    m.box([-x + 10.8, h, -z + 1.6], [x - 1.8, h + 0.2, z - 1.6], MAT.CONCRETE);
    m.box([x - 10.6, 0, z + 0.2], [x - 9.4, 4.2, z + 5.0], MAT.CLADDING, { roof: MAT.TRIM });
    m.box([x - 9.4, 2.4, z + 0.6], [x - 0.6, 4.2, z + 4.6], MAT.GLASS, { roof: MAT.TRIM });
    ribbon(m, { axis: 'z', sign: 1, plane: z + 4.6 }, x - 9.0, x - 1.0, 2.8, 3.9,
      { sill: false, head: false });
    // Waiting-room seating behind the glass, and a triage bay marking.
    m.painted(TINT.METAL_DARK, () => {
      for (let r = 0; r < 3; r++) {
        const rz = z + 0.9 + r * 0.9;
        m.box([-x + 2.6, 0.42, rz], [-x + 7.6, 0.52, rz + 0.5], MAT.TRIM);
        m.box([-x + 2.6, 0.52, rz], [-x + 7.6, 1.15, rz + 0.12], MAT.TRIM);
        for (const px of [-x + 2.8, -x + 7.3]) {
          m.box([px, 0, rz + 0.05], [px + 0.1, 0.42, rz + 0.4], MAT.TRIM);
        }
      }
    });
    entrance(m, { axis: 'z', sign: 1, plane: z + 3.0 }, -x + 5.2,
      { width: 2.4, height: 2.9, double: true, glazed: true, canopy: 2.0 });
    // The cross, on the parapet where it can be seen from the road.
    m.painted(TINT.BRAND, () => {
      m.box([x - 4.6, h + 0.2, z - 0.1], [x - 1.4, h + 1.0, z + 0.3], MAT.TRIM);
      m.box([x - 3.6, h - 0.4, z - 0.1], [x - 2.4, h + 1.8, z + 0.3], MAT.TRIM);
    });
    boxSign(m, { axis: 'z', sign: 1, plane: z + 3.0 }, -x + 2.4, -x + 8.0, h - 1.6, h - 0.6);
    frontage(m, -x, x - 10.5, z + 3.0, 983, { planters: 3, bollards: 7, depth: 2.4 });
    // An ambulance under the canopy, a cycle rack and a drop-off bay marking.
    vehicle(m, x - 5.0, z + 2.6, 5.6, 2.3, TINT.ACCENT, true);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 5; i++) {
        const cx = -x + 11.5 + i * 0.7;
        m.box([cx - 0.05, 0, z + 3.4], [cx + 0.05, 0.85, z + 4.3], MAT.TRIM);
      }
      m.box([-x + 11.4, 0.75, z + 3.4], [-x + 14.6, 0.85, z + 3.5], MAT.TRIM);
    });
    m.box([x - 9.4, 0.02, z + 0.6], [x - 9.3, 0.06, z + 5.2], MAT.TRIM);
    m.box([x - 0.6, 0.02, z + 0.6], [x - 0.5, 0.06, z + 5.2], MAT.TRIM);
    serviceYard(m, -x, x - 10.5, z + 3.0, 985, { cycles: false });
    kerb(m, x - 10.0, z + 5.4, x, z + 5.8);
  }
  return m;
}

/** A general hospital: ward slab on a podium, ambulance bay, helipad. */
function hospital(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 20.0, z = 15.0;
  const podium = 8.0;
  const floors = 8, floorH = 3.6;
  const top = podium + floors * floorH;
  const wx = 13.0, wz = 8.0;

  m.box([-x, 0, -z], [x, podium, z], MAT.CONCRETE, { roof: MAT.TRIM });
  m.box([-wx, podium, -wz], [wx, top, wz], MAT.PLASTER, { roof: MAT.ROOF });

  if (medium) {
    band(m, -x, -z, x, z, podium, 0.8, 0.5);
    for (let f = 1; f <= floors; f++) band(m, -wx, -wz, wx, wz, podium + f * floorH - 0.55, 0.55, 0.26);
    parapet(m, -wx, -wz, wx, wz, top, 1.2, 0.34);
    // Service cores at both ends of the ward slab.
    for (const sx of [-1, 1] as const) {
      m.box([sx * wx - sx * 2.4, podium, -wz - 0.6], [sx * wx + sx * 0.6, top + 3.2, wz + 0.6],
        MAT.CLADDING, { roof: MAT.ROOF });
    }
    // Helipad on the podium roof, clear of the slab.
    const hx = 0, hz = z - 4.0;
    m.box([hx - 6.0, podium, hz - 3.4], [hx + 6.0, podium + 0.35, hz + 3.4], MAT.CONCRETE);
    m.painted(TINT.SIGN_LIT, () => {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        m.box([hx + Math.cos(a) * 5.2 - 0.14, podium + 0.35, hz + Math.sin(a) * 3.0 - 0.14],
              [hx + Math.cos(a) * 5.2 + 0.14, podium + 0.6, hz + Math.sin(a) * 3.0 + 0.14], MAT.TRIM);
      }
    });
    roofClutter(m, -wx + 2, -wz + 2, wx - 2, wz - 2, top, 991, 1.4);
    // Ambulance canopy at the podium's flank.
    m.box([-x - 6.5, 5.0, -z + 2.0], [-x, 5.5, -z + 12.0], MAT.CONCRETE);
    m.painted(TINT.METAL_DARK, () => {
      for (const pz of [-z + 3.0, -z + 11.0]) {
        m.box([-x - 5.9, 0, pz - 0.18], [-x - 5.6, 5.0, pz + 0.18], MAT.TRIM);
      }
    });
    m.box([-x - 6.5, 0.001, -z + 2.0], [-x, 0.1, -z + 12.4], MAT.CONCRETE);
  }
  if (fine) {
    for (let f = 0; f < floors; f++) {
      const y = podium + f * floorH + 0.9;
      for (const [axis, sign, plane, half, n] of [
        ['z', 1, wz, wx, 6], ['z', -1, -wz, wx, 6],
        ['x', 1, wx, wz, 4], ['x', -1, -wx, wz, 4],
      ] as const) {
        m.windowRow({ axis, sign, plane, from: -half + 3.0, to: half - 3.0, y0: y, y1: y + 1.9,
          count: n, width: 1.6, glass: MAT.GLASS, frame: 0.1, proud: 0.06 });
      }
    }
    // Podium: a glazed concourse to the street, solid everywhere else.
    for (let f = 0; f < 2; f++) {
      m.windowRow({ axis: 'z', sign: 1, plane: z, from: -x + 1.5, to: x - 1.5,
        y0: 1.0 + f * 3.4, y1: 3.4 + f * 3.4, count: 8, width: 2.6,
        glass: f === 0 ? MAT.SHOPFRONT : MAT.GLASS, frame: 0.12, proud: 0.07 });
    }
    ribbonStack(m, { axis: 'x', sign: 1, plane: x }, -z + 1.5, z - 1.5,
      { floors: 2, floorH: 3.6, base: 1.2, height: 2.0 });
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0,
      { width: 4.0, height: 3.4, double: true, glazed: true, canopy: 3.2 });
    boxSign(m, { axis: 'z', sign: 1, plane: z }, -5.0, 5.0, podium - 1.6, podium - 0.3);
    // The cross, big, on the ward slab's end wall.
    m.painted(TINT.BRAND, () => {
      m.box([wx + 0.6, top - 8.0, -2.6], [wx + 0.8, top - 5.4, 2.6], MAT.TRIM);
      m.box([wx + 0.6, top - 7.3, -0.9], [wx + 0.8, top - 2.8, 0.9], MAT.TRIM);
    });
    // Ambulance bay doors under the canopy.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 2; i++) {
        const pz = -z + 4.0 + i * 4.0;
        m.box([-x - 0.02, 0, pz], [-x + 0.16, 4.2, pz + 3.0], MAT.TRIM);
      }
    });
    frontage(m, -x, x, z, 993, { planters: 4, bollards: 12, depth: 2.6 });
  }
  dressRoof(m, lod, 3364);
  return m;
}

/** Ambulance depot: four bays, a mess block and a wash apron. */
function ambulanceDepot(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 26.0, d = 14.0;
  const x = w / 2, z = d / 2;
  const bayH = 5.0, blockH = 7.0;

  m.box([-x, 0, -z], [x - 7.0, bayH, z], MAT.CLADDING, { roof: MAT.TRIM });
  m.box([x - 7.0, 0, -z], [x, blockH, z], MAT.CLADDING, { roof: MAT.ROOF });

  if (medium) {
    parapet(m, -x, -z, x - 7.0, z, bayH, 0.8, 0.28);
    parapet(m, x - 7.0, -z, x, z, blockH, 0.8, 0.26);
    band(m, x - 7.0, -z, x, z, 3.5, 0.35, 0.2);
    roofClutter(m, -x + 2, -z + 2, x - 9, z - 2, bayH, 1001, 0.9);
    // Wash bay and its drain channel.
    m.box([-x, 0.001, z + 9.0], [x, 0.1, z + 14.0], MAT.CONCRETE);
    m.box([-x, 0.02, z + 11.4], [x, 0.06, z + 11.8], MAT.TRIM);
  }
  if (fine) {
    bayDoors(m, -x + 1.2, x - 8.2, z, 4, 4.2, TINT.ACCENT);
    for (let f = 0; f < 2; f++) {
      m.windowRow({ axis: 'z', sign: 1, plane: z, from: x - 6.4, to: x - 0.6,
        y0: 1.1 + f * 3.5, y1: 3.0 + f * 3.5, count: 2, width: 1.9,
        glass: MAT.GLASS, frame: 0.11, proud: 0.06 });
    }
    ribbonStack(m, { axis: 'x', sign: 1, plane: x }, -z + 1.2, z - 1.2,
      { floors: 2, floorH: 3.5, base: 1.1, height: 1.8 });
    ribbonStack(m, { axis: 'z', sign: -1, plane: -z }, -x + 1.2, x - 1.2,
      { floors: 1, floorH: 3, base: 2.6, height: 1.4 });
    entrance(m, { axis: 'z', sign: 1, plane: z }, x - 3.5,
      { width: 1.6, height: 2.5, double: true, glazed: true, canopy: 1.6 });
    boxSign(m, { axis: 'z', sign: 1, plane: z }, x - 6.4, x - 0.6, blockH - 1.6, blockH - 0.5);
    m.painted(TINT.BRAND, () => {
      m.box([-x + 3.0, bayH + 1.3, z - 0.1], [-x + 6.4, bayH + 2.1, z + 0.3], MAT.TRIM);
      m.box([-x + 4.1, bayH + 0.5, z - 0.1], [-x + 5.3, bayH + 2.9, z + 0.3], MAT.TRIM);
    });
    // Two ambulances out, a charging post per bay and a fuel island.
    vehicle(m, -x + 4.5, z + 4.4, 5.8, 2.3, TINT.ACCENT, true);
    vehicle(m, -x + 11.5, z + 4.4, 5.8, 2.3, TINT.ACCENT, true);
    bayKit(m, -x + 1.2, x - 8.2, z + 0.42);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 4; i++) {
        const cx = -x + 2.4 + i * 4.3;
        m.box([cx - 0.18, 0, z + 8.2], [cx + 0.18, 1.4, z + 8.5], MAT.TRIM);
        m.box([cx - 0.26, 1.4, z + 8.15], [cx + 0.26, 1.75, z + 8.55], MAT.TRIM);
      }
      m.box([x - 4.0, 0, z + 11.0], [x - 2.4, 0.6, z + 13.0], MAT.TRIM);
      m.box([x - 3.6, 0.6, z + 11.4], [x - 2.8, 2.4, z + 12.6], MAT.TRIM);
    });
    serviceYard(m, -x, x, z + 14.0, 1005, { flag: false });
    kerb(m, -x, z + 14.0, x, z + 14.4);
  }
  dressRoof(m, lod, 3371);
  return m;
}

/** A residential care home: domestic scale, long wings, a garden room. */
function careHome(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 18.0, z = 13.0;
  const wall = 6.4, t = 8.0;

  // An L of two-storey wings round a sheltered garden.
  m.box([-x, 0, -z], [x, wall, -z + t], MAT.CLADDING, { roof: MAT.ROOF });
  m.box([-x, 0, -z + t], [-x + t, wall, z], MAT.CLADDING, { roof: MAT.ROOF });
  // Stone only to the ground storey, clad above: the modern care-home
  // vocabulary. Pitched tiles and chimneys made this a very large cottage.
  m.box([-x - 0.15, 0, -z - 0.15], [x + 0.15, 3.4, -z + t + 0.15], MAT.STONE);
  m.box([-x - 0.15, 0, -z + t], [-x + t + 0.15, 3.4, z + 0.15], MAT.STONE);

  if (medium) {
    parapet(m, -x, -z, x, -z + t, wall, 0.9, 0.32);
    parapet(m, -x, -z + t, -x + t, z, wall, 0.9, 0.32);
    band(m, -x, -z, x, -z + t, 3.4, 0.35, 0.24);
    band(m, -x, -z + t, -x + t, z, 3.4, 0.35, 0.24);
    roofClutter(m, -x + 2, -z + 2, x - 2, -z + t - 2, wall, 1013, 1.0);
    // Garden room in the crook of the L: glazed, single storey.
    m.box([-x + t, 0, -z + t], [-x + t + 9.0, 3.4, -z + t + 6.0], MAT.GLASS, { roof: MAT.TRIM });
    m.gable([-x + t, 3.4, -z + t], [-x + t + 9.0, 3.4, -z + t + 6.0], 1.2, 'x', MAT.GLASS, MAT.GLASS);
    m.painted(TINT.GREEN, () => {
      m.box([-x + t + 1.0, 0.001, -z + t + 7.0], [x - 1.0, 0.1, z - 1.0], MAT.TRIM);
    });
  }
  if (fine) {
    for (const [axis, sign, plane, u0, u1] of [
      ['z', 1, -z + t, -x + t + 9.5, x - 0.9, 4],
      ['z', -1, -z, -x + 0.9, x - 0.9, 8],
      ['x', 1, x, -z + 0.9, -z + t - 0.9, 3],
      ['x', 1, -x + t, -z + t + 6.5, z - 0.9, 2],
      ['x', -1, -x, -z + 0.9, z - 0.9, 8],
    ] as const) {
      ribbonStack(m, { axis, sign, plane }, u0, u1,
      { floors: 2, floorH: 3.2, base: 1.0, height: 1.7 });
    }
    m.windowRow({ axis: 'z', sign: 1, plane: -z + t + 6.0, from: -x + t + 0.8, to: -x + t + 8.2,
      y0: 0.7, y1: 2.9, count: 4, width: 1.5, glass: MAT.GLASS, frame: 0.11, proud: 0.06 });
    entrance(m, { axis: 'z', sign: 1, plane: -z + t }, x - 4.0,
      { width: 1.8, height: 2.5, double: true, glazed: true, steps: 1, canopy: 2.0 });
    boxSign(m, { axis: 'z', sign: 1, plane: -z + t }, x - 6.6, x - 1.4, 3.2, 4.1);
    // Handrail down the ramp to the door.
    // Stair drum in the crook of the L, and a covered walk to the garden -- a
    // care home is circulation before it is anything else.
    m.cylinder(-x + t, -z + t, 3.2, 0, wall + 1.8, 14, MAT.CLADDING, false);
    for (let f = 0; f < 2; f++) {
      m.opening({ axis: 'x', sign: 1, plane: -x + t + 3.2, u0: -z + t - 2.2, u1: -z + t + 2.2,
        y0: 1.0 + f * 3.2, y1: 2.9 + f * 3.2, glass: MAT.GLASS, frame: 0.12, proud: 0.06 });
    }
    parapet(m, -x + t - 3.2, -z + t - 3.2, -x + t + 3.2, -z + t + 3.2, wall + 1.8, 0.8, 0.3);
    m.painted(TINT.METAL_DARK, () => {
      m.box([-x + t + 3.4, 2.9, -z + t + 6.4], [x - 6.0, 3.1, -z + t + 8.2], MAT.TRIM);
      // Balconies to the upper rooms on the garden side.
      for (let i = 0; i < 4; i++) {
        const px = -x + t + 10.0 + i * 5.0;
        m.box([px - 1.8, 3.3, -z + t], [px + 1.8, 3.45, -z + t + 1.5], MAT.TRIM);
        m.box([px - 1.85, 3.45, -z + t + 1.35], [px + 1.85, 4.35, -z + t + 1.5], MAT.TRIM);
        for (let k = 0; k < 6; k++) {
          const bx = px - 1.7 + k * 0.68;
          m.box([bx - 0.04, 3.45, -z + t + 1.38], [bx + 0.04, 4.35, -z + t + 1.47], MAT.TRIM);
        }
      }
      for (let i = 0; i < 5; i++) {
        const px = -x + t + 4.4 + i * 4.0;
        m.box([px - 0.09, 0, -z + t + 7.9], [px + 0.09, 2.9, -z + t + 8.1], MAT.TRIM);
      }
    });
    railing(m, x - 8.0, x - 2.0, -z + t + 2.4, 0, 0.95, 1.2);
    m.box([x - 8.4, 0.002, -z + t], [x - 1.6, 0.08, -z + t + 2.6], MAT.CONCRETE);
    frontage(m, -x + t + 10.0, x, -z + t + 2.6, 1011, { planters: 3, bollards: 6, depth: 2.2 });
  }
  dressRoof(m, lod, 3378);
  return m;
}

// ==================================================================== table

const svc = (jobs: number, upkeep: number, power: number, water: number): AssetDef['sim'] => ({
  jobs, powerKW: power, waterM3: water, garbagePerWeek: jobs * 8, pollution: 0, upkeep,
});

export const SAFETY: AssetDef[] = [
  { id: 'svc.fire.station', name: 'Fire station', zone: 'service', branch: 'fire', density: 'none', variant: 'sculpted', footprint: [4, 5], height: 15.5, brand: { name: 'Fire', colour: [0.66, 0.16, 0.12], accent: [0.72, 0.72, 0.70], sign: 'box' }, sim: svc(30, 180, 60, 30), note: 'Three appliance bays under a brand band, clad watch tower, drill tower behind.', build: fireStation },
  { id: 'svc.fire.house', name: 'Fire house', zone: 'service', branch: 'fire', density: 'none', variant: 'sculpted', footprint: [3, 5], height: 13.6, brand: { name: 'Fire', colour: [0.62, 0.18, 0.14], accent: [0.70, 0.70, 0.68], sign: 'box' }, sim: svc(18, 110, 40, 20), note: 'Older two-bay house in brick, pitched roof, hose tower on the back corner.', build: fireHouse },
  { id: 'svc.fire.hq', name: 'Fire headquarters', zone: 'service', branch: 'fire', density: 'none', variant: 'sculpted', footprint: [5, 6], height: 22.0, brand: { name: 'Fire HQ', colour: [0.66, 0.16, 0.12], accent: [0.72, 0.72, 0.70], sign: 'box' }, sim: svc(80, 420, 160, 70), note: 'Six bays, a floor of offices over them, a 22 m training tower and a muster yard.', build: fireHQ },
  { id: 'svc.fire.air', name: 'Air rescue base', zone: 'service', branch: 'fire', density: 'none', variant: 'sculpted', footprint: [5, 5], height: 11.0, brand: { name: 'Air Rescue', colour: [0.66, 0.20, 0.12], accent: [0.70, 0.70, 0.68], sign: 'box' }, sim: svc(24, 380, 120, 25), note: 'Barrel-roofed hangar with a full-width door, marked landing pad, windsock, crew block.', build: airRescue },

  { id: 'svc.police.post', name: 'Police post', zone: 'service', branch: 'police', density: 'none', variant: 'sculpted', footprint: [3, 3], height: 5.6, brand: { name: 'Police', colour: [0.16, 0.26, 0.50], accent: [0.72, 0.72, 0.74], sign: 'box' }, sim: svc(12, 80, 30, 12), note: 'One storey with a glazed counter bay, blue lamp over the door, barred rear windows.', build: policePost },
  { id: 'svc.police.station', name: 'Police station', zone: 'service', branch: 'police', density: 'none', variant: 'sculpted', footprint: [6, 4], height: 13.2, brand: { name: 'Police', colour: [0.16, 0.26, 0.50], accent: [0.72, 0.72, 0.74], sign: 'box' }, sim: svc(45, 260, 90, 35), note: 'Three storeys on a stone base, clad entrance bay, secure yard behind a wall and a gate.', build: policeStation },
  { id: 'svc.police.hq', name: 'Police headquarters', zone: 'service', branch: 'police', density: 'none', variant: 'sculpted', footprint: [4, 4], height: 44.0, brand: { name: 'Police HQ', colour: [0.14, 0.24, 0.48], accent: [0.70, 0.70, 0.74], sign: 'box' }, sim: svc(140, 640, 300, 90), note: 'Glazed tower on a stone podium, service core carried above the roof, mast.', build: policeHQ },
  { id: 'svc.police.detention', name: 'Detention centre', zone: 'service', branch: 'police', density: 'none', variant: 'sculpted', footprint: [6, 6], height: 11.1, brand: { name: 'Detention', colour: [0.20, 0.24, 0.32], accent: [0.62, 0.62, 0.64], sign: 'box' }, sim: svc(60, 480, 140, 120), note: 'Blank cell block with slot windows inside a walled compound, two watch towers, a gate.', build: detention },

  { id: 'svc.health.clinic', name: 'Clinic', zone: 'service', branch: 'health', density: 'none', variant: 'sculpted', footprint: [4, 4], height: 8.5, brand: { name: 'Clinic', colour: [0.66, 0.22, 0.30], accent: [0.72, 0.72, 0.72], sign: 'box' }, sim: svc(35, 200, 90, 60), note: 'Two storeys with a glazed waiting room, ambulance canopy on posts, parapet cross.', build: clinic },
  { id: 'svc.health.hospital', name: 'General hospital', zone: 'service', branch: 'health', density: 'none', variant: 'sculpted', footprint: [7, 5], height: 40.0, brand: { name: 'Hospital', colour: [0.66, 0.22, 0.30], accent: [0.74, 0.74, 0.74], sign: 'box' }, sim: svc(320, 1400, 700, 520), note: 'Ward slab with end cores on a glazed podium, helipad on the podium roof, ambulance bay.', build: hospital },
  { id: 'svc.health.ambulance', name: 'Ambulance depot', zone: 'service', branch: 'health', density: 'none', variant: 'sculpted', footprint: [4, 6], height: 7.6, brand: { name: 'Ambulance', colour: [0.64, 0.24, 0.30], accent: [0.28, 0.62, 0.42], sign: 'box' }, sim: svc(28, 190, 70, 45), note: 'Four bays with vision panels, mess block, wash apron with a drain channel.', build: ambulanceDepot },
  { id: 'svc.health.care', name: 'Care home', zone: 'service', branch: 'health', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 10.6, brand: { name: 'Care Home', colour: [0.52, 0.28, 0.36], accent: [0.66, 0.62, 0.48], sign: 'box' }, sim: svc(40, 240, 80, 90), note: 'Two brick wings round a sheltered garden, glazed garden room, ramp and handrail.', build: careHome },
];
