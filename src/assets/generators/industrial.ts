/**
 * Industry: eleven sites.
 *
 * Industrial buildings are silhouette more than facade -- silos, stacks,
 * gantries, sawtooth glazing. Where a house is judged on its front door, a
 * plant is judged from three hundred metres away, so the triangles go into
 * things that break the outline rather than into window frames.
 *
 * They all sit on a lot with the building to one side and a yard beside it,
 * which is what an industrial plot looks like and what leaves room for the
 * equipment that makes the type readable.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import { CELL } from '../types';
import type { AssetDef } from '../types';
import {
  band, eavesBand, entrance, frontage, kerb, parapet, ring, roofClutter, windowGrid,
} from '../parts';

/** Vertical silo with a plinth, a conical top and a vent. */
function silo(m: MeshBuilder, cx: number, cz: number, r: number, h: number): void {
  m.cylinder(cx, cz, r * 1.06, 0, 1.1, 14, MAT.TRIM);
  m.cylinder(cx, cz, r, 1.1, h, 16, MAT.METAL, false);
  m.cone(cx, cz, r, r * 0.34, h, h + r * 0.8, 16, MAT.METAL);
  m.cylinder(cx, cz, r * 0.34, h + r * 0.8, h + r * 1.1, 10, MAT.TRIM);
}

/** Banded stack. */
function stack(m: MeshBuilder, cx: number, cz: number, r: number, h: number): void {
  m.cylinder(cx, cz, r, 0, h, 12, MAT.TRIM, false);
  for (let i = 1; i <= 3; i++) {
    const y = (i / 4) * h;
    m.cylinder(cx, cz, r * 1.15, y, y + 0.5, 12, MAT.METAL, false);
  }
}

/** Portal frames carrying pipe runs across a yard. */
function pipeRack(m: MeshBuilder, x0: number, x1: number, z0: number, z1: number, y: number, runs = 3): void {
  m.painted(TINT.METAL_DARK, () => {
    const frames = Math.max(2, Math.round((x1 - x0) / 3.6));
    for (let i = 0; i <= frames; i++) {
      const px = x0 + (i / frames) * (x1 - x0);
      m.box([px - 0.18, 0, z0], [px + 0.18, y, z0 + 0.36], MAT.TRIM);
      m.box([px - 0.18, 0, z1 - 0.36], [px + 0.18, y, z1], MAT.TRIM);
      m.box([px - 0.24, y, z0 - 0.1], [px + 0.24, y + 0.5, z1 + 0.1], MAT.TRIM);
    }
  });
  for (let r = 0; r < runs; r++) {
    const pz = z0 + ((r + 1) / (runs + 1)) * (z1 - z0);
    m.pipe([x0, y + 0.5, pz], [x1, y + 0.5, pz], 0.22, MAT.METAL);
  }
}

/** Loading dock: raised apron, shutters, canopy. */
function dock(m: MeshBuilder, x0: number, x1: number, z: number, bays: number, height = 5.2): void {
  m.box([x0, 0.001, z], [x1, 1.2, z + 2.4], MAT.CONCRETE);
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i < bays; i++) {
      const cx = x0 + ((i + 0.5) / bays) * (x1 - x0);
      m.box([cx - 1.7, 1.2, z - 0.14], [cx + 1.7, height, z + 0.02], MAT.TRIM);
    }
  });
  m.box([x0 - 0.4, height + 0.9, z], [x1 + 0.4, height + 1.25, z + 2.8], MAT.METAL);
}

// ------------------------------------------------------------------- sheds

function distributionShed(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const medium = lod < 2;
  const w = 25.0, d = 17.0, wall = 9.2, ridge = 2.6;
  const x = w / 2, z = d / 2, cz = -1.5;

  m.box([-x, 0, cz - z], [x, wall, cz + z], MAT.SHED_WALL, { roof: MAT.TRIM });
  m.gable([-x, wall, cz - z], [x, wall, cz + z], ridge, 'x', MAT.METAL, MAT.SHED_WALL);

  if (medium) {
    m.box([-x - 0.45, wall - 0.35, cz - z - 0.45], [x + 0.45, wall, cz + z + 0.45], MAT.TRIM);
    m.box([-x, wall + ridge - 0.18, cz - 0.35], [x, wall + ridge + 0.2, cz + 0.35], MAT.TRIM);
    dock(m, -x + 1.5, x - 1.5, cz + z, 3, 5.0);
    m.painted(TINT.METAL_DARK, () => m.box([x - 3.4, 0, cz + z - 0.05], [x - 2.2, 2.4, cz + z + 0.14], MAT.TRIM));
    for (const vx of [-9.0, -5.0, 0.0, 5.0, 9.0]) {
      m.cylinder(vx, cz, 0.7, wall + ridge - 0.4, wall + ridge + 1.3, 10, MAT.METAL);
    }
    kerb(m, -x, cz + z + 3.2, x, cz + z + 4.4);
    // Roof lights along both slopes.
    for (let i = 0; i < 6; i++) {
      const px = -x + 2.4 + i * 3.5;
      m.box([px, wall + 1.0, cz - z + 2.0], [px + 2.2, wall + 1.35, cz - 1.0], MAT.GLASS);
      m.box([px, wall + 1.0, cz + 1.0], [px + 2.2, wall + 1.35, cz + z - 2.0], MAT.GLASS);
    }
    // Yard: marked bays, a fence along the front, and the office windows.
    for (let i = 0; i < 8; i++) {
      const px = -x + 2.0 + i * 3.0;
      m.box([px - 0.07, 0.002, cz + z + 4.6], [px + 0.07, 0.02, cz + z + 11.0], MAT.TRIM);
    }
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 14; i++) {
        const px = -x - 1.0 + i * 2.0;
        m.box([px - 0.07, 0, cz + z + 11.4], [px + 0.07, 2.2, cz + z + 11.55], MAT.TRIM);
      }
      m.box([-x - 1.1, 2.05, cz + z + 11.4], [x + 1.1, 2.2, cz + z + 11.55], MAT.TRIM);
    });
    windowGrid(m, { axis: 'x', sign: -1, plane: -x }, cz - z + 1.5, cz + z - 1.5,
      { floors: 2, floorH: 3.0, base: 2.0, count: 3, width: 1.2, height: 1.4 });
    windowGrid(m, { axis: 'z', sign: 1, plane: cz + z }, x - 8.0, x - 4.0,
      { floors: 1, floorH: 3, base: 5.6, count: 2, width: 1.2, height: 1.3 });
    // Personnel door beside the shutters, and the sprinkler tank and caged
    // ladder every shed of this size carries on its blind end.
    entrance(m, { axis: 'z', sign: 1, plane: cz + z }, x - 6.0,
      { width: 1.1, height: 2.2, canopy: 1.3 });
    m.cylinder(x - 3.4, cz - z - 2.6, 1.9, 0, 7.4, 12, MAT.METAL);
    m.cone(x - 3.4, cz - z - 2.6, 1.9, 0.4, 7.4, 8.4, 12, MAT.METAL);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 16; i++) {
        m.box([x - 5.6, 0.4 + i * 0.42, cz - z - 2.9], [x - 5.2, 0.47 + i * 0.42, cz - z - 2.3], MAT.TRIM);
      }
      m.box([x - 5.65, 0, cz - z - 2.95], [x - 5.55, 7.4, cz - z - 2.85], MAT.TRIM);
      m.box([x - 5.25, 0, cz - z - 2.35], [x - 5.15, 7.4, cz - z - 2.25], MAT.TRIM);
      m.pipe([x - 3.4, 0.5, cz - z - 0.7], [x - 3.4, 0.5, cz - z + 0.6], 0.16, MAT.TRIM);
    });
  }
  return m;
}

function workshop(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 18.0, d = 12.0, wall = 6.4;
  const x = w / 2, z = d / 2;

  // Brick office end, metal workshop behind: how small industrial units are
  // actually built, and the material change gives the box a front.
  m.box([-x, 0, -z], [-x + 6.0, wall - 1.4, z], MAT.BRICK, { roof: MAT.ROOF });
  m.box([-x + 6.0, 0, -z], [x, wall, z], MAT.SHED_WALL, { roof: MAT.TRIM });
  m.gable([-x + 6.0, wall, -z], [x, wall, z], 1.8, 'x', MAT.METAL, MAT.SHED_WALL);

  if (medium) {
    parapet(m, -x, -z, -x + 6.0, z, wall - 1.4, 0.6, 0.2);
    m.box([-x + 5.6, wall - 0.3, -z - 0.4], [x + 0.4, wall, z + 0.4], MAT.TRIM);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 2; i++) {
        const cx = -x + 8.6 + i * 5.4;
        m.box([cx - 2.1, 0, z - 0.12], [cx + 2.1, 4.4, z + 0.06], MAT.TRIM);
      }
    });
    m.box([-x + 6.0, 5.0, z], [x, 5.35, z + 2.0], MAT.METAL);
    roofClutter(m, -x + 7, -z + 1.5, x - 1.5, z - 1.5, wall + 1.8, 211, 0.5);
  }
  if (fine) {
    windowGrid(m, { axis: 'z', sign: 1, plane: z }, -x + 0.6, -x + 5.4,
      { floors: 2, floorH: 2.4, base: 1.3, count: 2, width: 1.1, height: 1.4 });
    entrance(m, { axis: 'x', sign: -1, plane: -x }, -0.5, { width: 1.05, steps: 1, canopy: 1.2 });
    // Pallets and a stillage stacked against the yard wall: what a workshop
    // actually has outside it.
    m.painted(TINT.WOOD, () => {
      for (let i = 0; i < 3; i++) {
        for (let k = 0; k < 4; k++) {
          m.box([-x + 2.0 + i * 1.5, k * 0.16, z + 1.0], [-x + 3.2 + i * 1.5, 0.1 + k * 0.16, z + 2.2], MAT.TRIM);
        }
      }
    });
    m.painted(TINT.METAL_DARK, () => {
      m.box([-x + 6.4, 0, z + 1.0], [-x + 8.4, 1.5, z + 2.4], MAT.TRIM);
      for (const px of [-x + 6.5, -x + 8.3]) {
        m.box([px - 0.05, 1.5, z + 1.05], [px + 0.05, 2.3, z + 2.35], MAT.TRIM);
      }
      m.box([-x + 6.4, 2.25, z + 1.0], [-x + 8.4, 2.35, z + 2.4], MAT.TRIM);
    });
    frontage(m, -x, x, z, 251, { planters: 1, bollards: 5, depth: 2.6 });
    windowGrid(m, { axis: 'x', sign: -1, plane: -x }, -z + 1.2, z - 1.2,
      { floors: 2, floorH: 2.4, base: 1.3, count: 2, width: 1.1, height: 1.4 });
    windowGrid(m, { axis: 'z', sign: -1, plane: -z }, -x + 0.8, -x + 5.6,
      { floors: 2, floorH: 2.4, base: 1.3, count: 2, width: 1.1, height: 1.4 });
    // Palletised stock in the yard, and a fence.
    m.painted(TINT.WOOD, () => {
      for (let i = 0; i < 4; i++) {
        const px = -x + 4.0 + (i % 2) * 2.6;
        const pz = z + 3.4 + Math.floor(i / 2) * 1.6;
        m.box([px, 0, pz], [px + 1.9, 1.1 + (i % 3) * 0.4, pz + 1.2], MAT.TRIM);
      }
    });
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 8; i++) {
        const px = -x + i * 2.6;
        m.box([px - 0.07, 0, z + 6.4], [px + 0.07, 2.2, z + 6.55], MAT.TRIM);
      }
      m.box([-x - 0.1, 2.05, z + 6.4], [x + 0.1, 2.2, z + 6.55], MAT.TRIM);
    });
  }
  return m;
}

// --------------------------------------------------------------- processing

function processingPlant(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const sw = 17.0, sd = 13.0, wall = 10.5;
  const sx = -CELL * 2 + sw / 2 + 1.0, sz = 0.4;
  const x0 = sx - sw / 2, x1 = sx + sw / 2;
  const z0 = sz - sd / 2, z1 = sz + sd / 2;

  m.box([x0, 0, z0], [x1, wall, z1], MAT.METAL, { roof: MAT.ROOF });

  if (medium) {
    const teeth = 5, step = sw / teeth, rise = 3.4;
    for (let i = 0; i < teeth; i++) {
      const a = x0 + i * step, b = a + step;
      m.quad([a, wall, z1], [b, wall, z1], [b, wall + rise, z0], [a, wall + rise, z0], MAT.METAL);
      m.quad([a, wall, z0], [a, wall + rise, z0], [b, wall + rise, z0], [b, wall, z0], MAT.GLASS);
      m.tri([a, wall, z1], [a, wall + rise, z0], [a, wall, z0], MAT.METAL);
      m.tri([b, wall, z1], [b, wall, z0], [b, wall + rise, z0], MAT.METAL);
    }
    m.box([x1 - 5.0, 0, z0 - 5.6], [x1 + 3.2, 17.5, z0 + 0.4], MAT.METAL, { roof: MAT.ROOF });
    band(m, x1 - 5.0, z0 - 5.6, x1 + 3.2, z0 + 0.4, 17.5, 0.8, 0.3);
    silo(m, 7.0, -4.0, 2.5, 15.0);
    silo(m, 7.0, 2.6, 2.0, 12.0);
    silo(m, 12.4, -1.2, 1.6, 9.5);
    stack(m, 13.2, -7.6, 1.15, 23.0);
    dock(m, x0 + 1.0, x1 - 1.0, z1, 2, 5.6);
    m.box([x0 - 0.4, 0, z1 - 6.4], [x0 + 4.6, 4.0, z1 - 1.4], MAT.BRICK, { roof: MAT.ROOF });
    parapet(m, x0 - 0.4, z1 - 6.4, x0 + 4.6, z1 - 1.4, 4.0, 0.45, 0.3);
  }
  if (fine) {
    for (const [sign, plane] of [[1, z1], [-1, z0]] as const) {
      m.windowRow({ axis: 'z', sign, plane, from: x0 + 1.2, to: x1 - 1.2, y0: 6.8, y1: 8.6,
        count: 5, width: 2.1, glass: MAT.GLASS, frame: 0.09, proud: 0.06 });
    }
    windowGrid(m, { axis: 'x', sign: -1, plane: x0 - 0.4 }, z1 - 5.8, z1 - 2.0,
      { floors: 1, floorH: 3, base: 1.2, count: 3, width: 0.9, height: 1.5 });
    pipeRack(m, 1.0, 14.0, -6.6, -1.0, 6.4);
    m.pipe([7.0, 6.9, -4.0], [7.0, 14.0, -4.0], 0.2, MAT.METAL);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 14; i++) {
        const y = 1.0 + i * 1.15;
        m.box([x1 + 3.2, y, z0 - 5.2 + i * 0.32], [x1 + 4.6, y + 0.12, z0 - 4.6 + i * 0.32], MAT.TRIM);
      }
      m.box([x1 + 3.1, 0.8, z0 - 5.4], [x1 + 3.3, 17.4, z0 - 0.6], MAT.TRIM);
      m.box([x1 + 4.5, 0.8, z0 - 5.4], [x1 + 4.7, 17.4, z0 - 0.6], MAT.TRIM);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        m.box([7.0 + Math.cos(a) * 2.7 - 0.06, 15.0, -4.0 + Math.sin(a) * 2.7 - 0.06],
              [7.0 + Math.cos(a) * 2.7 + 0.06, 16.1, -4.0 + Math.sin(a) * 2.7 + 0.06], MAT.TRIM);
      }
    });
    m.cylinder(7.0, -4.0, 2.76, 15.0, 15.12, 14, MAT.TRIM, false);
    for (let i = 0; i < 3; i++) {
      m.cylinder(x0 + 3.4 + i * 4.6, sz + 3.0, 0.6, wall + 3.4, wall + 4.7, 10, MAT.METAL);
    }
  }
  return m;
}

function tankFarm(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;

  // Almost no building: four tanks in a bund, a pump house and a pipe rack.
  // The type is worth having precisely because it is not a shed.
  const tanks: Array<[number, number, number, number]> = [
    [-8.0, -4.0, 4.6, 11.0], [2.0, -4.5, 5.4, 13.0],
    [-7.0, 6.0, 3.6, 8.5], [3.5, 6.5, 3.0, 7.0],
  ];
  for (const [cx, cz, r, h] of tanks) {
    m.cylinder(cx, cz, r, 0, h, 18, MAT.METAL, false);
    m.cone(cx, cz, r, r * 0.15, h, h + r * 0.22, 18, MAT.METAL);
    band(m, cx - r, cz - r, cx + r, cz + r, 0, 0.6, 0.08);
  }

  if (medium) {
    // Bund wall: the low containment kerb around a tank farm.
    m.box([-13.5, 0.001, -10.0], [9.5, 1.5, 11.5], MAT.CONCRETE);
    m.box([-13.0, 0.4, -9.5], [9.0, 1.6, 11.0], MAT.CONCRETE);
    for (const [cx, cz, r, h] of tanks) {
      // Spiral stair as a stack of short treads round the tank.
      m.painted(TINT.METAL_DARK, () => {
        for (let i = 0; i < 22; i++) {
          const a = (i / 22) * Math.PI * 1.7;
          const y = 0.6 + (i / 22) * (h - 0.9);
          m.box([cx + Math.cos(a) * r - 0.5, y, cz + Math.sin(a) * r - 0.5],
                [cx + Math.cos(a) * r + 0.5, y + 0.1, cz + Math.sin(a) * r + 0.5], MAT.TRIM);
        }
      });
    }
    m.box([11.5, 0, -8.0], [17.0, 4.6, -1.0], MAT.BRICK, { roof: MAT.ROOF });
    parapet(m, 11.5, -8.0, 17.0, -1.0, 4.6, 0.5, 0.24);
    stack(m, 15.5, 4.0, 0.9, 16.0);
  }
  if (fine) {
    pipeRack(m, -12.0, 16.0, 12.0, 15.0, 5.4, 4);
    for (const [cx, cz, r, h] of tanks) {
      m.pipe([cx, h * 0.5, cz + r], [cx, h * 0.5, 13.5], 0.24, MAT.METAL);
      m.pipe([cx, h * 0.5, 13.5], [cx, 5.9, 13.5], 0.24, MAT.METAL);
      void r;
    }
    windowGrid(m, { axis: 'z', sign: -1, plane: -8.0 }, 12.2, 16.3,
      { floors: 1, floorH: 3, base: 1.4, count: 2, width: 1.0, height: 1.4 });
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 6; i++) {
        m.box([-13.0 + i * 3.8, 0, 12.6], [-11.8 + i * 3.8, 1.1, 13.8], MAT.TRIM);
      }
    });
  }
  return m;
}

function foundry(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 26.0, d = 16.0, wall = 15.0;
  const x = w / 2, z = d / 2;

  // One tall bay with a crane rail, which is what heavy industry looks like
  // from outside: very tall, very few windows, a lot of stack.
  m.box([-x, 0, -z], [x, wall, z], MAT.SHED_WALL, { roof: MAT.TRIM });
  m.gable([-x, wall, -z], [x, wall, z], 3.2, 'x', MAT.METAL, MAT.SHED_WALL);

  if (medium) {
    m.box([-x - 0.5, wall - 0.4, -z - 0.5], [x + 0.5, wall, z + 0.5], MAT.TRIM);
    // Roof monitor along the ridge, for venting heat.
    m.box([-x + 2.0, wall + 3.2, -2.2], [x - 2.0, wall + 5.0, 2.2], MAT.METAL, { roof: MAT.ROOF });
    m.box([-x + 1.8, wall + 5.0, -2.5], [x - 1.8, wall + 5.4, 2.5], MAT.TRIM);
    stack(m, x - 3.0, -z - 3.5, 1.5, 30.0);
    stack(m, x - 7.0, -z - 3.5, 1.1, 24.0);
    // Lower annexe.
    m.box([-x - 7.0, 0, -z + 2.0], [-x, 7.0, z - 2.0], MAT.METAL, { roof: MAT.ROOF });
    parapet(m, -x - 7.0, -z + 2.0, -x, z - 2.0, 7.0, 0.6, 0.25);
    dock(m, -x + 3.0, x - 3.0, z, 3, 6.5);
  }
  if (fine) {
    // Gantry rail on brackets down both long walls.
    m.painted(TINT.METAL_DARK, () => {
      for (const [sign, plane] of [[1, z], [-1, -z]] as const) {
        for (let i = 0; i < 9; i++) {
          const cx = -x + 1.5 + i * 3.1;
          m.box([cx - 0.2, 9.5, plane - sign * 0.9], [cx + 0.2, 10.4, plane], MAT.TRIM);
        }
      }
    });
    for (const [sign, plane] of [[1, z], [-1, -z]] as const) {
      m.windowRow({ axis: 'z', sign, plane, from: -x + 1.5, to: x - 1.5, y0: 11.0, y1: 13.2,
        count: 7, width: 2.2, glass: MAT.GLASS, frame: 0.1, proud: 0.07 });
    }
    m.painted(TINT.METAL_DARK, () => {
      m.box([-x - 7.0, 0, z - 2.6], [-x - 2.0, 4.6, z - 2.44], MAT.TRIM);
    });
    pipeRack(m, -x - 6.0, -x - 1.0, -z + 1.0, z - 1.0, 8.0, 2);
  }
  return m;
}

function recyclingYard(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;

  // An open yard: three-sided storage bays, a sorting shed, a conveyor and a
  // weighbridge. Mostly ground plane, which makes it a useful contrast to the
  // sheds either side of it in a district.
  const bw = 6.0, bd = 7.0, bh = 3.6;
  for (let i = 0; i < 3; i++) {
    const cx = -14.0 + i * (bw + 0.4);
    m.box([cx, 0, -10.0], [cx + bw, bh, -10.0 + 0.5], MAT.CONCRETE);
    m.box([cx, 0, -10.0], [cx + 0.5, bh, -10.0 + bd], MAT.CONCRETE);
    m.box([cx + bw - 0.5, 0, -10.0], [cx + bw, bh, -10.0 + bd], MAT.CONCRETE);
    if (medium) {
      // What is in the bay: a heap, as a squat pyramid.
      m.painted(i === 1 ? TINT.WOOD : TINT.METAL_DARK, () => {
        m.cone(cx + bw / 2, -10.0 + bd * 0.55, 2.4, 0.3, 0.001, 2.6 + i * 0.4, 6, MAT.TRIM);
      });
    }
  }

  m.box([4.0, 0, -6.0], [18.0, 8.0, 4.0], MAT.SHED_WALL, { roof: MAT.TRIM });
  m.gable([4.0, 8.0, -6.0], [18.0, 8.0, 4.0], 2.0, 'x', MAT.METAL, MAT.SHED_WALL);

  if (medium) {
    m.box([3.6, 7.7, -6.4], [18.4, 8.0, 4.4], MAT.TRIM);
    // Conveyor from the yard into the shed, on legs.
    m.painted(TINT.METAL_DARK, () => {
      m.box([-4.0, 2.0, 6.0], [4.5, 2.9, 7.4], MAT.TRIM);
      m.box([-4.0, 2.9, 6.0], [4.5, 3.05, 6.15], MAT.TRIM);
      m.box([-4.0, 2.9, 7.25], [4.5, 3.05, 7.4], MAT.TRIM);
      for (const px of [-3.4, 0.0, 3.6]) {
        m.box([px - 0.16, 0, 6.3], [px + 0.16, 2.0, 6.62], MAT.TRIM);
        m.box([px - 0.16, 0, 6.9], [px + 0.16, 2.0, 7.22], MAT.TRIM);
      }
    });
    // Weighbridge and its cabin.
    m.box([-16.0, 0.001, 4.0], [-6.0, 0.22, 9.0], MAT.CONCRETE);
    m.box([-5.2, 0, 5.4], [-2.6, 3.2, 8.0], MAT.BRICK, { roof: MAT.ROOF });
    parapet(m, -5.2, 5.4, -2.6, 8.0, 3.2, 0.4, 0.22);
    roofClutter(m, 5, -5, 17, 3, 10.0, 221, 0.6);
  }
  if (fine) {
    windowGrid(m, { axis: 'z', sign: 1, plane: 8.0 }, -5.0, -2.8,
      { floors: 1, floorH: 3, base: 1.3, count: 1, width: 1.6, height: 1.3 });
    entrance(m, { axis: 'x', sign: 1, plane: -2.6 }, 6.7, { width: 1.0, height: 2.1, steps: 1 });
    // Skips waiting to be tipped: a yard's real content, and a shape nothing
    // else in the set has.
    for (let i = 0; i < 3; i++) {
      const sx = -16.0 + i * 4.6;
      m.painted(TINT.BRAND_DARK, () => {
        m.quad([sx, 0, -8.0], [sx + 3.8, 0, -8.0], [sx + 3.8, 1.7, -8.9], [sx, 1.7, -8.9], MAT.TRIM);
        m.quad([sx + 3.8, 0, -5.4], [sx, 0, -5.4], [sx, 1.7, -4.5], [sx + 3.8, 1.7, -4.5], MAT.TRIM);
        m.box([sx, 0, -8.0], [sx + 0.16, 1.7, -4.5], MAT.TRIM);
        m.box([sx + 3.64, 0, -8.0], [sx + 3.8, 1.7, -4.5], MAT.TRIM);
        m.box([sx, 0, -8.0], [sx + 3.8, 0.16, -4.5], MAT.TRIM);
      });
    }
    // Baled material stacked against the shed.
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 2; j++) {
        const bx = 5.0 + i * 3.0;
        m.box([bx, j * 1.35, 5.2], [bx + 2.6, 1.25 + j * 1.35, 7.6], MAT.GROUND);
        m.painted(TINT.METAL_DARK, () => {
          m.box([bx + 0.6, j * 1.35, 5.15], [bx + 0.72, 1.25 + j * 1.35, 7.65], MAT.TRIM);
          m.box([bx + 1.9, j * 1.35, 5.15], [bx + 2.02, 1.25 + j * 1.35, 7.65], MAT.TRIM);
        });
      }
    }
    m.painted(TINT.METAL_DARK, () => {
      m.box([4.0, 0, 3.88], [9.0, 6.0, 4.06], MAT.TRIM);
      // Perimeter fence along two sides.
      for (let i = 0; i < 16; i++) {
        const px = -17.0 + i * 2.3;
        m.box([px - 0.08, 0, 10.4], [px + 0.08, 2.4, 10.56], MAT.TRIM);
      }
      m.box([-17.2, 2.2, 10.4], [18.4, 2.35, 10.56], MAT.TRIM);
    });
    frontage(m, -17.0, 2.0, 10.6, 261, { planters: 2, bollards: 6, depth: 2.2 });
    // Skips waiting to be emptied, and a stack of baled material.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 3; i++) {
        const px = -16.0 + i * 4.4;
        m.box([px, 0, 0.5], [px + 3.4, 1.5, 2.6], MAT.TRIM);
        m.box([px + 0.1, 1.5, 0.6], [px + 3.3, 1.62, 2.5], MAT.TRIM);
      }
    });
    m.painted(TINT.WOOD, () => {
      for (let i = 0; i < 6; i++) {
        m.box([-16.0 + (i % 3) * 1.9, Math.floor(i / 3) * 1.3, -4.0],
              [-14.4 + (i % 3) * 1.9, 1.2 + Math.floor(i / 3) * 1.3, -2.2], MAT.TRIM);
      }
    });
    windowGrid(m, { axis: 'z', sign: -1, plane: -6.0 }, 5.0, 17.0,
      { floors: 1, floorH: 3, base: 5.2, count: 4, width: 1.3, height: 1.4 });
  }
  return m;
}

// ------------------------------------------------------------- cold storage

/**
 * Cold store. A near-windowless insulated box, which sounds like nothing to
 * model until you notice what makes one recognisable: the refrigeration deck
 * on the roof, the insulated dock seals, and the trailers waiting at them.
 */
function coldStore(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 26.0, d = 18.0, h = 14.5;
  const x = w / 2, z = d / 2, cz = -1.0;

  m.box([-x, 0, cz - z], [x, h, cz + z], MAT.CLADDING, { roof: MAT.TRIM });
  // Insulated panels are laid in horizontal courses and it shows.
  if (medium) {
    for (let y = 2.4; y < h - 1.0; y += 2.4) {
      band(m, -x, cz - z, x, cz + z, y, 0.1, 0.08, MAT.METAL);
    }
    m.box([-x - 0.4, h - 0.5, cz - z - 0.4], [x + 0.4, h, cz + z + 0.4], MAT.TRIM);
    // Refrigeration deck: condensers in a row behind a screen.
    m.box([-x + 2.0, h, cz - 5.0], [x - 2.0, h + 0.35, cz + 3.0], MAT.CONCRETE);
    for (let i = 0; i < 5; i++) {
      const px = -x + 3.2 + i * 4.2;
      m.box([px, h + 0.35, cz - 4.2], [px + 3.0, h + 2.1, cz + 2.0], MAT.METAL);
      m.painted(TINT.METAL_DARK, () => {
        m.box([px + 0.2, h + 2.1, cz - 4.0], [px + 2.8, h + 2.3, cz + 1.8], MAT.TRIM);
      });
    }
    m.painted(TINT.METAL_DARK, () => {
      m.box([-x + 1.6, h + 0.35, cz - 5.2], [x - 1.6, h + 2.6, cz - 5.05], MAT.TRIM);
    });
    dock(m, -x + 2.0, x - 6.0, cz + z, 4, 5.4);
    roofClutter(m, -x + 3, cz + 4, x - 3, cz + z - 2, h, 511, 0.5);
  }
  if (fine) {
    // Office corner: the only part of a cold store with any glass in it.
    m.box([x - 6.5, 0, cz + z - 0.2], [x, 6.6, cz + z + 5.2], MAT.PLASTER, { roof: MAT.ROOF });
    parapet(m, x - 6.5, cz + z - 0.2, x, cz + z + 5.2, 6.6, 0.7, 0.2);
    windowGrid(m, { axis: 'z', sign: 1, plane: cz + z + 5.2 }, x - 5.9, x - 0.6,
      { floors: 2, floorH: 3.2, base: 1.3, count: 3, width: 1.3, height: 1.7 });
    windowGrid(m, { axis: 'x', sign: 1, plane: x }, cz + z + 0.4, cz + z + 4.6,
      { floors: 2, floorH: 3.2, base: 1.3, count: 2, width: 1.3, height: 1.7 });
    entrance(m, { axis: 'z', sign: 1, plane: cz + z + 5.2 }, x - 3.2,
      { width: 1.8, height: 2.4, double: true, glazed: true, canopy: 1.6 });
    // Trailers parked on the apron, which is half of what the site looks like.
    for (const tx of [-x + 5.0, -x + 11.5]) {
      m.box([tx - 1.3, 1.15, cz + z + 2.6], [tx + 1.3, 4.4, cz + z + 11.0], MAT.SHED_WALL);
      m.painted(TINT.METAL_DARK, () => {
        m.box([tx - 1.2, 0.45, cz + z + 9.6], [tx + 1.2, 1.15, cz + z + 10.6], MAT.TRIM);
        for (const wz of [cz + z + 4.0, cz + z + 5.2]) {
          m.box([tx - 1.35, 0.0, wz], [tx + 1.35, 0.95, wz + 0.5], MAT.TRIM);
        }
      });
    }
    // Dock bumpers and wheel stops: small, and their absence is what makes an
    // apron look like a car park.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 4; i++) {
        const bx = -x + 3.4 + i * ((x - 6.0) - (-x + 2.0)) / 4;
        for (const dx of [-1.9, 1.9]) {
          m.box([bx + dx - 0.16, 0.75, cz + z], [bx + dx + 0.16, 1.15, cz + z + 0.22], MAT.TRIM);
        }
      }
      for (const tx of [-x + 5.0, -x + 11.5]) {
        m.box([tx - 1.4, 0, cz + z + 11.4], [tx + 1.4, 0.22, cz + z + 11.7], MAT.TRIM);
      }
    });
    kerb(m, -x, cz + z + 12.0, x, cz + z + 12.4);
  }
  return m;
}

// ---------------------------------------------------------- batching plant

/** Concrete batching plant: aggregate bays, a hopper tower, a mixer bay. */
function batchingPlant(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 19.0, z = 14.0;

  // Aggregate bays: three-sided concrete pens with heaps in them.
  for (let i = 0; i < 3; i++) {
    const bx = -x + 1.5 + i * 6.4;
    m.box([bx, 0, -z + 1.5], [bx + 0.5, 3.4, -z + 8.5], MAT.CONCRETE);
    m.box([bx, 0, -z + 1.5], [bx + 5.9, 3.4, -z + 2.0], MAT.CONCRETE);
    if (medium) {
      m.cone(bx + 3.0, -z + 5.4, 2.6, 0.2, 0.02, 2.6 + i * 0.3, 10, MAT.GROUND);
    }
  }
  m.box([x - 6.5, 0, -z + 1.5], [x - 0.5, 3.4, -z + 2.0], MAT.CONCRETE);

  // Hopper tower: the silhouette of the whole type.
  const tx = 5.0, tz = 2.0;
  m.painted(TINT.METAL_DARK, () => {
    for (const dx of [-3.2, 3.2]) {
      for (const dz of [-3.0, 3.0]) {
        m.box([tx + dx - 0.22, 0, tz + dz - 0.22], [tx + dx + 0.22, 15.5, tz + dz + 0.22], MAT.TRIM);
      }
    }
  });
  m.box([tx - 3.6, 9.0, tz - 3.4], [tx + 3.6, 15.5, tz + 3.4], MAT.METAL, { roof: MAT.TRIM });
  m.cone(tx, tz, 3.4, 1.2, 6.4, 9.0, 12, MAT.METAL);
  m.cylinder(tx, tz, 1.2, 4.6, 6.4, 10, MAT.METAL, false);

  if (medium) {
    silo(m, tx + 7.6, tz - 1.0, 2.2, 14.0);
    silo(m, tx + 12.2, tz - 1.0, 2.2, 14.0);
    // Conveyor from the bays up to the hopper: the diagonal that ties it all
    // together, and the reason the plant reads as machinery not sheds.
    m.painted(TINT.METAL_DARK, () => {
      m.pipe([-x + 4.0, 1.2, -z + 5.4], [tx - 2.4, 12.2, tz - 1.0], 0.75, MAT.TRIM);
      m.pipe([tx + 7.6, 14.6, tz - 1.0], [tx + 1.6, 15.8, tz], 0.4, MAT.TRIM);
      m.pipe([tx + 12.2, 14.6, tz - 1.0], [tx + 2.0, 15.6, tz + 0.6], 0.4, MAT.TRIM);
    });
    m.box([tx - 4.4, 0.001, tz - 5.0], [tx + 4.4, 0.12, tz + 5.0], MAT.CONCRETE);
    parapet(m, tx - 3.6, tz - 3.4, tx + 3.6, tz + 3.4, 15.5, 0.9, 0.25);
  }
  if (fine) {
    // Site office in a portacabin, and the weighbridge every plant has.
    m.box([-x + 1.0, 0.25, z - 7.5], [-x + 8.0, 3.4, z - 4.0], MAT.SHED_WALL, { roof: MAT.TRIM });
    m.box([-x + 0.7, 0, z - 7.8], [-x + 8.3, 0.25, z - 3.7], MAT.CONCRETE);
    windowGrid(m, { axis: 'z', sign: 1, plane: z - 4.0 }, -x + 1.6, -x + 7.4,
      { floors: 1, floorH: 3, base: 1.35, count: 3, width: 1.1, height: 1.3 });
    entrance(m, { axis: 'x', sign: 1, plane: -x + 8.0 }, z - 6.6,
      { width: 1.0, height: 2.1, steps: 2 });
    m.box([2.0, 0.001, z - 6.0], [12.0, 0.16, z - 2.4], MAT.CONCRETE);
    m.painted(TINT.METAL_DARK, () => {
      m.box([1.8, 0, z - 6.2], [2.0, 1.1, z - 2.2], MAT.TRIM);
      m.box([12.0, 0, z - 6.2], [12.2, 1.1, z - 2.2], MAT.TRIM);
    });
    // Access platform and ladder up the tower: the detail that makes a
    // hopper frame look climbable rather than extruded.
    m.painted(TINT.METAL_DARK, () => {
      for (const py of [9.0, 12.2]) {
        m.box([tx - 4.0, py, tz - 3.8], [tx + 4.0, py + 0.1, tz + 3.8], MAT.TRIM);
        for (let i = 0; i <= 8; i++) {
          const rx = tx - 4.0 + (i / 8) * 8.0;
          m.box([rx - 0.05, py, tz + 3.7], [rx + 0.05, py + 1.05, tz + 3.8], MAT.TRIM);
          m.box([rx - 0.05, py, tz - 3.8], [rx + 0.05, py + 1.05, tz - 3.7], MAT.TRIM);
        }
        m.box([tx - 4.0, py + 1.0, tz + 3.7], [tx + 4.0, py + 1.08, tz + 3.8], MAT.TRIM);
        m.box([tx - 4.0, py + 1.0, tz - 3.8], [tx + 4.0, py + 1.08, tz - 3.7], MAT.TRIM);
      }
      for (let i = 0; i < 18; i++) {
        const ry = 0.6 + i * 0.8;
        m.box([tx - 4.3, ry, tz - 0.35], [tx - 3.9, ry + 0.07, tz + 0.35], MAT.TRIM);
      }
      m.box([tx - 4.35, 0, tz - 0.42], [tx - 4.25, 15.5, tz - 0.32], MAT.TRIM);
      m.box([tx - 4.35, 0, tz + 0.32], [tx - 4.25, 15.5, tz + 0.42], MAT.TRIM);
    });
    kerb(m, -x, z - 0.4, x, z);
  }
  return m;
}

// --------------------------------------------------------------- bus depot

/** Vehicle depot: an open-fronted maintenance shed, fuel island and offices. */
function depot(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 30.0, d = 14.0, wall = 8.0;
  const x = w / 2, z = d / 2, cz = -4.0;
  const bays = 4;

  m.box([-x, 0, cz - z], [x, wall, cz + z], MAT.SHED_WALL, { roof: MAT.TRIM });
  m.gable([-x, wall, cz - z], [x, wall, cz + z], 2.0, 'x', MAT.METAL, MAT.SHED_WALL);

  if (medium) {
    m.box([-x - 0.4, wall - 0.3, cz - z - 0.4], [x + 0.4, wall, cz + z + 0.4], MAT.TRIM);
    // Open bays: piers between full-height doors, so it reads as a workshop
    // rather than a warehouse.
    for (let i = 0; i <= bays; i++) {
      const px = -x + (i / bays) * w;
      m.box([px - 0.6, 0, cz + z - 0.1], [px + 0.6, wall, cz + z + 0.5], MAT.CONCRETE);
    }
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < bays; i++) {
        const a = -x + (i / bays) * w + 0.7;
        const b = -x + ((i + 1) / bays) * w - 0.7;
        m.box([a, 0, cz + z - 0.02], [b, 5.6, cz + z + 0.14], MAT.TRIM);
        for (let g = 1; g < 6; g++) {
          m.box([a, g * 0.92, cz + z + 0.14], [b, g * 0.92 + 0.09, cz + z + 0.2], MAT.TRIM);
        }
      }
    });
    roofClutter(m, -x + 3, cz - z + 2, x - 3, cz + z - 2, wall + 2.0, 521, 0.5);
  }
  if (fine) {
    // Fuel island under a canopy, and the apron the buses stand on.
    m.box([-x, 0.001, cz + z + 0.5], [x, 0.1, z], MAT.CONCRETE);
    m.box([-x + 3.0, 4.6, z - 6.6], [-x + 12.0, 5.0, z - 2.0], MAT.CONCRETE);
    m.painted(TINT.METAL_DARK, () => {
      for (const px of [-x + 4.2, -x + 10.8]) {
        m.box([px - 0.2, 0, z - 4.6], [px + 0.2, 4.6, z - 4.2], MAT.TRIM);
      }
      for (const px of [-x + 5.6, -x + 9.4]) {
        m.box([px - 0.5, 0.2, z - 4.9], [px + 0.5, 1.9, z - 4.1], MAT.TRIM);
      }
    });
    m.box([-x + 3.4, 0.1, z - 5.2], [-x + 11.6, 0.32, z - 3.6], MAT.CONCRETE);
    // Two-storey office block on the end, with a stair door.
    m.box([x - 9.0, 0, cz - z], [x, 7.2, cz - z + 8.0], MAT.PLASTER, { roof: MAT.ROOF });
    parapet(m, x - 9.0, cz - z, x, cz - z + 8.0, 7.2, 0.8, 0.22);
    for (const [axis, sign, plane, u0, u1, n] of [
      ['x', 1, x, cz - z + 0.7, cz - z + 7.3, 3],
      ['z', -1, cz - z, x - 8.4, x - 0.6, 4],
    ] as const) {
      windowGrid(m, { axis, sign, plane }, u0, u1,
        { floors: 2, floorH: 3.3, base: 1.2, count: n, width: 1.3, height: 1.8 });
    }
    entrance(m, { axis: 'x', sign: 1, plane: x }, cz - z + 4.0,
      { width: 1.6, height: 2.4, double: true, glazed: true, canopy: 1.5 });
    kerb(m, -x, z - 0.4, x, z);
  }
  return m;
}

// -------------------------------------------------------------- timber yard

/** Sawmill: open-sided drying sheds, stacked timber, a cyclone and a log deck. */
function timberYard(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 19.0, z = 15.0;
  const millW = 15.0, millD = 12.0, millH = 8.5;
  const mx = -x + millW / 2 + 1.5, mz = -z + millD / 2 + 1.5;

  m.box([mx - millW / 2, 0, mz - millD / 2], [mx + millW / 2, millH, mz + millD / 2],
    MAT.SHED_WALL, { roof: MAT.TRIM });
  m.gable([mx - millW / 2, millH, mz - millD / 2], [mx + millW / 2, millH, mz + millD / 2],
    2.2, 'x', MAT.METAL, MAT.SHED_WALL);

  if (medium) {
    // Cyclone and ducting: what a sawmill has instead of a chimney.
    m.cylinder(mx + millW / 2 + 2.2, mz, 1.5, 0, 9.5, 12, MAT.METAL, false);
    m.cone(mx + millW / 2 + 2.2, mz, 1.5, 0.5, 9.5, 12.5, 12, MAT.METAL);
    m.cylinder(mx + millW / 2 + 2.2, mz, 0.5, 12.5, 13.4, 8, MAT.TRIM);
    m.painted(TINT.METAL_DARK, () => {
      m.pipe([mx + millW / 2, 7.4, mz], [mx + millW / 2 + 2.2, 8.6, mz], 0.55, MAT.TRIM);
    });
    m.box([mx - millW / 2 - 0.35, millH - 0.3, mz - millD / 2 - 0.35],
      [mx + millW / 2 + 0.35, millH, mz + millD / 2 + 0.35], MAT.TRIM);
    // Open drying sheds: a roof on posts over stacked boards.
    for (let s = 0; s < 2; s++) {
      const sz0 = z - 11.0 + s * 5.6;
      m.box([-x + 2.0, 5.0, sz0], [x - 2.0, 5.4, sz0 + 4.4], MAT.METAL);
      m.painted(TINT.METAL_DARK, () => {
        for (let i = 0; i <= 5; i++) {
          const px = -x + 2.4 + (i / 5) * (2 * x - 5.2);
          m.box([px - 0.16, 0, sz0 + 0.3], [px + 0.16, 5.0, sz0 + 0.62], MAT.TRIM);
          m.box([px - 0.16, 0, sz0 + 3.8], [px + 0.16, 5.0, sz0 + 4.12], MAT.TRIM);
        }
      });
    }
  }
  if (fine) {
    // Timber stacks: banded boxes with a gap between courses.
    for (let s = 0; s < 2; s++) {
      const sz0 = z - 10.6 + s * 5.6;
      for (let i = 0; i < 5; i++) {
        const px = -x + 3.4 + i * 6.6;
        m.painted(TINT.WOOD, () => {
          for (let c = 0; c < 4; c++) {
            m.box([px, 0.2 + c * 1.05, sz0 + 0.4], [px + 5.2, 1.1 + c * 1.05, sz0 + 3.4], MAT.TRIM);
          }
        });
      }
    }
    // Log deck beside the mill.
    for (let i = 0; i < 3; i++) {
      const ly = 0.55 + i * 0.95;
      const off = i * 0.55;
      for (let j = 0; j < 4 - i; j++) {
        m.painted(TINT.WOOD, () => {
          m.pipe([mx + millW / 2 + 5.0, ly, -z + 2.4 + off + j * 1.1],
            [mx + millW / 2 + 12.5, ly, -z + 2.4 + off + j * 1.1], 0.5, MAT.TRIM);
        });
      }
    }
    windowGrid(m, { axis: 'z', sign: 1, plane: mz + millD / 2 }, mx - millW / 2 + 1.0, mx + millW / 2 - 1.0,
      { floors: 1, floorH: 3, base: 5.2, count: 5, width: 1.4, height: 1.6 });
    entrance(m, { axis: 'z', sign: 1, plane: mz + millD / 2 }, mx - 3.0,
      { width: 1.2, height: 2.3, canopy: 1.3 });
    m.painted(TINT.METAL_DARK, () => {
      m.box([mx + 1.0, 0, mz + millD / 2 - 0.02], [mx + 6.4, 5.2, mz + millD / 2 + 0.14], MAT.TRIM);
    });
    kerb(m, -x, z - 0.4, x, z);
  }
  return m;
}

// ------------------------------------------------------------ clean assembly

/**
 * A modern assembly plant: the tidy end of industry. Glazed office frontage,
 * a long production hall behind, and none of the smoke -- a city needs one of
 * these to zone next to housing without the neighbours rioting.
 */
function assemblyPlant(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 30.0, d = 20.0;
  const x = w / 2, z = d / 2;
  const hallH = 10.0, officeH = 7.4, officeD = 6.0;

  m.box([-x, 0, -z], [x, hallH, z - officeD], MAT.SHED_WALL, { roof: MAT.TRIM });
  m.box([-x + 1.5, 0, z - officeD], [x - 1.5, officeH, z], MAT.CLADDING, { roof: MAT.ROOF });

  if (medium) {
    m.box([-x - 0.4, hallH - 0.4, -z - 0.4], [x + 0.4, hallH, z - officeD + 0.4], MAT.TRIM);
    parapet(m, -x + 1.5, z - officeD, x - 1.5, z, officeH, 0.9, 0.26);
    // Roof monitors down the hall: north light, and a strong silhouette.
    for (let i = 0; i < 3; i++) {
      const cx = -x + 5.0 + i * 8.0;
      m.box([cx, hallH, -z + 2.5], [cx + 5.0, hallH + 1.8, z - officeD - 2.5], MAT.METAL);
      m.box([cx - 0.3, hallH + 1.8, -z + 2.2], [cx + 5.3, hallH + 2.05, z - officeD - 2.2], MAT.TRIM);
    }
    band(m, -x + 1.5, z - officeD, x - 1.5, z, officeH - 3.7, 0.3, 0.18);
    roofClutter(m, -x + 2, -z + 1.5, x - 2, -z + 4.0, hallH, 531, 0.7);
    dock(m, -x + 2.0, -x + 11.0, -z, 2, 5.2);
  }
  if (fine) {
    // Continuous glazing to the office, plus the ribbon on the hall's flank.
    for (let f = 0; f < 2; f++) {
      m.windowRow({ axis: 'z', sign: 1, plane: z, from: -x + 2.4, to: x - 2.4,
        y0: 1.0 + f * 3.7, y1: 3.3 + f * 3.7, count: 7, width: 2.6,
        glass: f === 0 ? MAT.SHOPFRONT : MAT.GLASS, frame: 0.1, proud: 0.06 });
    }
    for (const sx of [-1, 1] as const) {
      m.opening({ axis: 'x', sign: sx, plane: sx * x, u0: -z + 2.0, u1: z - officeD - 2.0,
        y0: 6.4, y1: 8.4, glass: MAT.GLASS, frame: 0.12, proud: 0.06 });
    }
    for (let i = 0; i < 3; i++) {
      const cx = -x + 5.0 + i * 8.0;
      for (const sz of [1, -1] as const) {
        m.opening({ axis: 'z', sign: sz, plane: sz === 1 ? z - officeD - 2.5 : -z + 2.5,
          u0: cx + 0.4, u1: cx + 4.6, y0: hallH + 0.35, y1: hallH + 1.6,
          glass: MAT.GLASS, frame: 0.1, proud: 0.06 });
      }
    }
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0,
      { width: 3.0, height: 3.0, double: true, glazed: true, canopy: 2.6 });
    frontage(m, -x + 1.5, x - 1.5, z, 533, { planters: 2, bollards: 8, depth: 2.6 });
  }
  return m;
}

// -------------------------------------------------------------- craft units

/** A terrace of small starter units: six roller doors under one long roof. */
function craftUnits(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const units = 6;
  const uw = 5.4;
  const w = units * uw, d = 12.0, wall = 5.4;
  const x = w / 2, z = d / 2, cz = -2.0;

  m.box([-x, 0, cz - z], [x, wall, cz + z], MAT.SHED_WALL, { roof: MAT.TRIM });
  m.gable([-x, wall, cz - z], [x, wall, cz + z], 1.6, 'x', MAT.METAL, MAT.SHED_WALL);
  // Brick to the bottom two metres: what stops a shed looking like foil.
  m.box([-x - 0.12, 0, cz - z - 0.12], [x + 0.12, 2.0, cz + z + 0.12], MAT.BRICK);

  if (medium) {
    m.box([-x - 0.4, wall - 0.3, cz - z - 0.4], [x + 0.4, wall, cz + z + 0.4], MAT.TRIM);
    // A pier between every unit, carried up past the eaves.
    for (let i = 0; i <= units; i++) {
      const px = -x + i * uw;
      m.box([px - 0.35, 0, cz + z - 0.1], [px + 0.35, wall + 0.5, cz + z + 0.4], MAT.BRICK);
    }
    m.box([-x, wall + 1.5, cz - 0.3], [x, wall + 1.75, cz + 0.3], MAT.TRIM);
    roofClutter(m, -x + 2, cz - z + 2, x - 2, cz + z - 2, wall + 1.6, 811, 0.5);
  }
  if (fine) {
    for (let i = 0; i < units; i++) {
      const a = -x + i * uw + 0.5;
      const b = -x + (i + 1) * uw - 0.5;
      // Roller shutter and a personnel door per unit.
      m.painted(TINT.METAL_DARK, () => {
        m.box([a, 0, cz + z + 0.38], [b - 1.5, 3.6, cz + z + 0.52], MAT.TRIM);
        for (let g = 1; g < 9; g++) {
          m.box([a, g * 0.4, cz + z + 0.52], [b - 1.5, g * 0.4 + 0.08, cz + z + 0.58], MAT.TRIM);
        }
      });
      entrance(m, { axis: 'z', sign: 1, plane: cz + z + 0.4 }, b - 0.8,
        { width: 0.95, height: 2.1 });
      m.opening({ axis: 'z', sign: 1, plane: cz + z + 0.4, u0: b - 1.3, u1: b - 0.3,
        y0: 3.9, y1: 4.9, glass: MAT.GLASS, frame: 0.1, proud: 0.05 });
    }
    // Marked parking in front and a fence at the back.
    for (let i = 0; i < units * 2; i++) {
      const px = -x + 1.2 + i * 2.7;
      m.box([px - 0.06, 0.002, cz + z + 1.0], [px + 0.06, 0.02, cz + z + 6.0], MAT.TRIM);
    }
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 18; i++) {
        const px = -x + i * (w / 18);
        m.box([px - 0.06, 0, cz - z - 1.8], [px + 0.06, 2.1, cz - z - 1.68], MAT.TRIM);
      }
      m.box([-x, 1.95, cz - z - 1.82], [x, 2.05, cz - z - 1.66], MAT.TRIM);
    });
    kerb(m, -x, cz + z + 6.0, x, cz + z + 6.4);
  }
  return m;
}

// ------------------------------------------------------------- grain store

/** Silos and a tall intake house: the tallest thing on any industrial edge. */
function grainStore(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 17.0, z = 13.0;
  const siloH = 22.0, r = 3.1;

  // A row of six silos, paired, on a shared plinth.
  m.box([-13.5, 0, -4.0], [13.5, 1.4, 4.0], MAT.CONCRETE);
  for (let i = 0; i < 6; i++) {
    const cx = -11.0 + i * 4.4;
    m.cylinder(cx, 0, r, 1.4, siloH, 16, MAT.CONCRETE, false);
    m.cone(cx, 0, r, r * 0.25, siloH, siloH + 1.9, 16, MAT.METAL);
  }
  // Intake house at one end, taller than the silos.
  m.box([x - 7.0, 0, -5.5], [x, siloH + 7.0, 5.5], MAT.SHED_WALL, { roof: MAT.TRIM });

  if (medium) {
    m.box([x - 7.4, siloH + 6.4, -5.9], [x + 0.4, siloH + 7.0, 5.9], MAT.TRIM);
    // Conveyor gallery along the tops, and the leg feeding it.
    m.box([-13.5, siloH + 2.2, -1.5], [x - 6.0, siloH + 3.8, 1.5], MAT.METAL);
    m.painted(TINT.METAL_DARK, () => {
      m.box([-13.5, siloH + 3.8, -1.7], [x - 6.0, siloH + 4.9, -1.5], MAT.TRIM);
      m.box([-13.5, siloH + 3.8, 1.5], [x - 6.0, siloH + 4.9, 1.7], MAT.TRIM);
      // Caged ladder up the intake house.
      m.box([x - 7.15, 0, -2.2], [x - 7.05, siloH + 6.4, -2.1], MAT.TRIM);
      m.box([x - 7.15, 0, -1.5], [x - 7.05, siloH + 6.4, -1.4], MAT.TRIM);
      for (let i = 0; i < 40; i++) {
        m.box([x - 7.2, 0.6 + i * 0.7, -2.2], [x - 7.0, 0.68 + i * 0.7, -1.4], MAT.TRIM);
      }
    });
    // Tipping shed over the intake pit.
    m.box([-x + 1.0, 0, z - 8.0], [-x + 12.0, 6.2, z - 1.0], MAT.SHED_WALL, { roof: MAT.TRIM });
    m.gable([-x + 1.0, 6.2, z - 8.0], [-x + 12.0, 6.2, z - 1.0], 1.8, 'x', MAT.METAL, MAT.SHED_WALL);
    m.box([-x + 4.0, 0.001, z - 7.6], [-x + 9.0, 0.14, z - 1.4], MAT.CONCRETE);
  }
  if (fine) {
    windowGrid(m, { axis: 'z', sign: 1, plane: 5.5 }, x - 6.2, x - 0.8,
      { floors: 4, floorH: 5.5, base: 2.4, count: 2, width: 1.2, height: 1.5 });
    entrance(m, { axis: 'z', sign: 1, plane: 5.5 }, x - 3.5, { width: 1.1, height: 2.2, canopy: 1.2 });
    // Ring beams and access hatches on the silos.
    for (let i = 0; i < 6; i++) {
      const cx = -11.0 + i * 4.4;
      for (const y of [8.0, 15.0]) {
        m.cylinder(cx, 0, r + 0.12, y, y + 0.3, 16, MAT.CONCRETE, false);
      }
      m.painted(TINT.METAL_DARK, () => {
        m.box([cx - 0.45, 1.4, r - 0.05], [cx + 0.45, 2.6, r + 0.14], MAT.TRIM);
      });
    }
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 8; i++) {
        const px = -13.5 + i * 3.4;
        m.box([px - 0.09, siloH + 1.9, -0.09], [px + 0.09, siloH + 2.2, 0.09], MAT.TRIM);
      }
    });
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

// ------------------------------------------------------------- print works

/** A press hall with a paper store and a glazed office range at the front. */
function printWorks(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 30.0, d = 19.0;
  const x = w / 2, z = d / 2;
  const hall = 11.0, office = 7.0, officeD = 6.5;

  m.box([-x, 0, -z], [x, hall, z - officeD], MAT.BRICK, { roof: MAT.TRIM });
  m.box([-x, 0, z - officeD], [x - 8.0, office, z], MAT.PLASTER, { roof: MAT.ROOF });
  // Paper store: a taller windowless block at one end.
  m.box([x - 8.0, 0, z - officeD], [x, hall + 2.5, z], MAT.CONCRETE, { roof: MAT.TRIM });

  if (medium) {
    m.box([-x - 0.4, hall - 0.4, -z - 0.4], [x + 0.4, hall, z - officeD + 0.4], MAT.TRIM);
    parapet(m, -x, z - officeD, x - 8.0, z, office, 0.8, 0.26);
    parapet(m, x - 8.0, z - officeD, x, z, hall + 2.5, 1.0, 0.3);
    band(m, -x, z - officeD, x - 8.0, z, office - 3.5, 0.35, 0.2);
    // Roof monitors over the press hall.
    for (let i = 0; i < 3; i++) {
      const cx = -x + 4.0 + i * 9.0;
      m.box([cx, hall, -z + 3.0], [cx + 6.0, hall + 1.6, z - officeD - 3.0], MAT.METAL);
      m.box([cx - 0.25, hall + 1.6, -z + 2.75], [cx + 6.25, hall + 1.9, z - officeD - 2.75], MAT.TRIM);
    }
    roofClutter(m, -x + 2, -z + 1, x - 2, -z + 2.5, hall, 821, 0.8);
  }
  if (fine) {
    // Tall segmental-feeling windows down the press hall flanks.
    for (const sx of [-1, 1] as const) {
      m.windowRow({ axis: 'x', sign: sx, plane: sx * x, from: -z + 1.4, to: z - officeD - 1.4,
        y0: 2.4, y1: 8.4, count: 3, width: 2.2, glass: MAT.GLASS, frame: 0.18, proud: 0.07 });
    }
    m.windowRow({ axis: 'z', sign: -1, plane: -z, from: -x + 1.4, to: x - 1.4,
      y0: 2.4, y1: 8.4, count: 5, width: 2.2, glass: MAT.GLASS, frame: 0.18, proud: 0.07 });
    for (let i = 0; i < 3; i++) {
      const cx = -x + 4.0 + i * 9.0;
      for (const sz of [1, -1] as const) {
        m.opening({ axis: 'z', sign: sz, plane: sz === 1 ? z - officeD - 3.0 : -z + 3.0,
          u0: cx + 0.4, u1: cx + 5.6, y0: hall + 0.3, y1: hall + 1.4,
          glass: MAT.GLASS, frame: 0.1, proud: 0.06 });
      }
    }
    // Office range: two ribbons of glazing and a proper front door.
    for (let f = 0; f < 2; f++) {
      m.windowRow({ axis: 'z', sign: 1, plane: z, from: -x + 1.0, to: x - 12.5,
        y0: 1.0 + f * 3.4, y1: 3.1 + f * 3.4, count: 5, width: 2.4,
        glass: f === 0 ? MAT.SHOPFRONT : MAT.GLASS, frame: 0.11, proud: 0.06 });
    }
    entrance(m, { axis: 'z', sign: 1, plane: z }, x - 10.6,
      { width: 2.2, height: 2.9, double: true, glazed: true, canopy: 2.0 });
    // Loading shutters on the paper store.
    m.painted(TINT.METAL_DARK, () => {
      for (const cx of [x - 6.0, x - 2.4]) {
        m.box([cx - 1.5, 0, z - 0.02], [cx + 1.5, 5.0, z + 0.16], MAT.TRIM);
      }
    });
    m.box([x - 8.0, 0.001, z], [x, 1.2, z + 3.0], MAT.CONCRETE);
    frontage(m, -x, x - 8.5, z, 823, { planters: 2, bollards: 8, depth: 2.4 });
  }
  return m;
}

// ------------------------------------------------------------- water works

/** Circular clarifier tanks, a filter house and a control block. */
function waterWorks(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 20.0, z = 15.0;

  // Two clarifiers: shallow drums with a bridge across each.
  for (const cx of [-11.0, 2.0]) {
    m.cylinder(cx, -4.0, 6.4, 0, 3.2, 20, MAT.CONCRETE, false);
    m.cylinder(cx, -4.0, 6.0, 0, 3.05, 20, MAT.GLASS);
    m.cylinder(cx, -4.0, 1.1, 3.05, 5.4, 10, MAT.CONCRETE);
  }
  // Filter house.
  m.box([x - 11.0, 0, z - 9.0], [x, 7.4, z], MAT.BRICK, { roof: MAT.TRIM });

  if (medium) {
    for (const cx of [-11.0, 2.0]) {
      m.cylinder(cx, -4.0, 6.5, 3.0, 3.35, 20, MAT.TRIM, false);
      // The rotating bridge: a beam from the centre to the rim, with a rail.
      m.painted(TINT.METAL_DARK, () => {
        m.box([cx - 6.5, 3.3, -4.35], [cx + 6.5, 3.75, -3.65], MAT.TRIM);
        m.box([cx - 6.5, 3.75, -4.5], [cx + 6.5, 4.7, -4.38], MAT.TRIM);
        m.box([cx - 6.5, 3.75, -3.62], [cx + 6.5, 4.7, -3.5], MAT.TRIM);
      });
    }
    m.gable([x - 11.0, 7.4, z - 9.0], [x, 7.4, z], 2.2, 'x', MAT.ROOF_TILE, MAT.BRICK);
    parapet(m, x - 11.0, z - 9.0, x, z, 7.4, 0.5, 0.24);
    // Pipe gallery linking the tanks to the filter house.
    pipeRack(m, -17.0, x - 11.5, 4.0, 7.0, 3.2, 3);
    // Control block.
    m.box([-x + 1.0, 0, z - 7.0], [-x + 10.0, 5.6, z], MAT.PLASTER, { roof: MAT.ROOF });
    parapet(m, -x + 1.0, z - 7.0, -x + 10.0, z, 5.6, 0.7, 0.24);
    roofClutter(m, x - 10, z - 8, x - 1, z - 1, 9.6, 831, 0.4);
  }
  if (fine) {
    windowGrid(m, { axis: 'z', sign: 1, plane: z }, x - 10.2, x - 0.8,
      { floors: 1, floorH: 4, base: 2.6, count: 4, width: 1.3, height: 2.6 });
    windowGrid(m, { axis: 'z', sign: 1, plane: z }, -x + 1.8, -x + 9.2,
      { floors: 2, floorH: 2.8, base: 0.9, count: 3, width: 1.2, height: 1.4 });
    entrance(m, { axis: 'z', sign: 1, plane: z }, -x + 5.5, { width: 1.2, height: 2.3, canopy: 1.3 });
    entrance(m, { axis: 'x', sign: -1, plane: x - 11.0 }, z - 4.5, { width: 1.4, height: 2.4, double: true });
    // Penstock valves and handwheels on the tank rims.
    m.painted(TINT.METAL_DARK, () => {
      for (const cx of [-11.0, 2.0]) {
        for (const dz of [-9.6, 1.6]) {
          m.box([cx - 0.5, 3.35, dz - 0.5], [cx + 0.5, 4.1, dz + 0.5], MAT.TRIM);
          m.cylinder(cx, dz, 0.42, 4.1, 4.24, 10, MAT.TRIM);
        }
      }
    });
    // Perimeter fence: a water works is always fenced.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 20; i++) {
        const px = -x + i * (2 * x / 20);
        m.box([px - 0.06, 0, -z + 0.4], [px + 0.06, 2.2, -z + 0.52], MAT.TRIM);
      }
      m.box([-x, 2.05, -z + 0.38], [x, 2.15, -z + 0.54], MAT.TRIM);
    });
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

// ------------------------------------------------------------ container yard

/** Stacked containers, a reach stacker's aisle and a gate office. */
function containerYard(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 20.0, z = 15.0;

  m.box([-x, 0.0005, -z], [x, 0.1, z], MAT.CONCRETE);
  // Three stacks of containers, three high, in rows.
  for (let r = 0; r < 3; r++) {
    const rz = -z + 3.0 + r * 5.2;
    for (let i = 0; i < 5; i++) {
      const cx = -x + 3.0 + i * 6.6;
      const high = (i + r) % 3 === 0 ? 3 : 2;
      for (let k = 0; k < high; k++) {
        m.painted(k % 2 === 0 ? TINT.BRAND_DARK : TINT.METAL_DARK, () => {
          m.box([cx - 3.0, 0.1 + k * 2.6, rz - 1.2], [cx + 3.0, 2.6 + k * 2.6, rz + 1.2], MAT.METAL);
        });
      }
    }
  }

  if (medium) {
    // Gate office and the barrier, which is what makes it a yard not a heap.
    m.box([x - 6.0, 0, z - 5.0], [x - 1.0, 4.4, z - 1.0], MAT.SHED_WALL, { roof: MAT.TRIM });
    parapet(m, x - 6.0, z - 5.0, x - 1.0, z - 1.0, 4.4, 0.5, 0.22);
    m.painted(TINT.METAL_DARK, () => {
      m.box([x - 7.2, 0, z - 3.2], [x - 6.8, 1.4, z - 2.8], MAT.TRIM);
      m.box([x - 13.0, 1.05, z - 3.1], [x - 6.8, 1.25, z - 2.9], MAT.TRIM);
      // Lighting masts round the yard.
      for (const [px, pz] of [[-x + 2.0, -z + 1.5], [x - 2.0, -z + 1.5], [-x + 2.0, z - 1.5]] as const) {
        m.box([px - 0.18, 0, pz - 0.18], [px + 0.18, 14.0, pz + 0.18], MAT.TRIM);
        m.box([px - 1.4, 14.0, pz - 0.5], [px + 1.4, 14.5, pz + 0.5], MAT.TRIM);
      }
    });
  }
  if (fine) {
    windowGrid(m, { axis: 'z', sign: 1, plane: z - 1.0 }, x - 5.4, x - 1.6,
      { floors: 1, floorH: 3, base: 1.5, count: 2, width: 1.2, height: 1.4 });
    entrance(m, { axis: 'x', sign: -1, plane: x - 6.0 }, z - 3.0, { width: 1.0, height: 2.1, steps: 1 });
    // Door ends: the corrugation and locking bars that name a container.
    for (let r = 0; r < 3; r++) {
      const rz = -z + 3.0 + r * 5.2;
      for (let i = 0; i < 5; i++) {
        const cx = -x + 3.0 + i * 6.6;
        const high = (i + r) % 3 === 0 ? 3 : 2;
        for (let k = 0; k < high; k++) {
          m.painted(TINT.METAL_DARK, () => {
            for (const bx of [cx + 2.2, cx + 2.8]) {
              m.box([bx - 0.06, 0.2 + k * 2.6, rz + 1.2], [bx + 0.06, 2.5 + k * 2.6, rz + 1.3], MAT.TRIM);
            }
            m.box([cx - 3.05, 0.1 + k * 2.6, rz - 1.25], [cx - 2.95, 2.6 + k * 2.6, rz + 1.25], MAT.TRIM);
          });
        }
      }
    }
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 22; i++) {
        const px = -x + i * (2 * x / 22);
        m.box([px - 0.06, 0, -z - 0.5], [px + 0.06, 2.6, -z - 0.38], MAT.TRIM);
      }
      m.box([-x, 2.45, -z - 0.52], [x, 2.55, -z - 0.36], MAT.TRIM);
    });
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

// ------------------------------------------------------------- brick kiln

/** An old brickworks: a kiln with a tall chimney and open drying sheds. */
function brickWorks(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 19.0, z = 14.0;
  const kilnW = 18.0, kilnD = 12.0, kilnH = 7.0;
  const kx = -x + kilnW / 2 + 1.5, kz = -z + kilnD / 2 + 1.5;

  m.box([kx - kilnW / 2, 0, kz - kilnD / 2], [kx + kilnW / 2, kilnH, kz + kilnD / 2], MAT.BRICK);
  m.gable([kx - kilnW / 2, kilnH, kz - kilnD / 2], [kx + kilnW / 2, kilnH, kz + kilnD / 2],
    2.4, 'x', MAT.ROOF_TILE, MAT.BRICK);
  stack(m, kx + kilnW / 2 + 3.4, kz, 1.7, 30.0);

  if (medium) {
    eavesBand(m, kx - kilnW / 2, kz - kilnD / 2, kx + kilnW / 2, kz + kilnD / 2, kilnH);
    // Buttresses down both flanks: a kiln is a heavy thing and it shows.
    for (let i = 0; i < 6; i++) {
      const px = kx - kilnW / 2 + 1.6 + i * 3.0;
      for (const sz of [-1, 1] as const) {
        m.box([px - 0.5, 0, sz * (kz + kilnD / 2) - sz * 0.0],
              [px + 0.5, kilnH - 1.2, sz * (kz + kilnD / 2) + sz * 0.7], MAT.BRICK);
      }
    }
    // Open drying sheds along the yard.
    for (let s = 0; s < 2; s++) {
      const sz0 = z - 10.0 + s * 5.0;
      m.box([-x + 2.0, 4.2, sz0], [x - 2.0, 4.55, sz0 + 3.6], MAT.METAL);
      m.painted(TINT.METAL_DARK, () => {
        for (let i = 0; i <= 6; i++) {
          const px = -x + 2.4 + (i / 6) * (2 * x - 4.8);
          m.box([px - 0.14, 0, sz0 + 0.25], [px + 0.14, 4.2, sz0 + 0.53], MAT.TRIM);
          m.box([px - 0.14, 0, sz0 + 3.05], [px + 0.14, 4.2, sz0 + 3.33], MAT.TRIM);
        }
      });
    }
  }
  if (fine) {
    // Kiln arches: the row of openings the type is known for.
    for (let i = 0; i < 5; i++) {
      const px = kx - kilnW / 2 + 2.6 + i * 3.4;
      for (const sz of [1, -1] as const) {
        m.painted(TINT.METAL_DARK, () => {
          m.opening({ axis: 'z', sign: sz, plane: sz * (kz + sz * kilnD / 2),
            u0: px - 1.0, u1: px + 1.0, y0: 0.26, y1: 2.9,
            glass: MAT.TRIM, frame: 0.22, proud: 0.09 });
        });
      }
    }
    windowGrid(m, { axis: 'x', sign: -1, plane: kx - kilnW / 2 }, kz - kilnD / 2 + 1.4, kz + kilnD / 2 - 1.4,
      { floors: 1, floorH: 3, base: 4.2, count: 3, width: 1.2, height: 1.5 });
    entrance(m, { axis: 'x', sign: -1, plane: kx - kilnW / 2 }, kz, { width: 1.1, height: 2.3 });
    // Stacked bricks under the drying sheds.
    for (let s = 0; s < 2; s++) {
      const sz0 = z - 9.6 + s * 5.0;
      for (let i = 0; i < 6; i++) {
        const px = -x + 3.2 + i * 5.6;
        m.painted(TINT.BRAND_DARK, () => {
          for (let k = 0; k < 3; k++) {
            m.box([px, 0.1 + k * 1.2, sz0 + 0.5], [px + 4.0, 1.15 + k * 1.2, sz0 + 2.7], MAT.BRICK);
          }
        });
      }
    }
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

// ------------------------------------------------------------- bottling hall

/** A food-and-drink plant: a tall process block, tanks outside, a canning hall. */
function bottlingPlant(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 19.0, z = 15.0;
  const hallW = 26.0, hallD = 14.0, hallH = 9.0;
  const hx = -x + hallW / 2 + 1.0, hz = z - hallD / 2 - 1.0;

  m.box([hx - hallW / 2, 0, hz - hallD / 2], [hx + hallW / 2, hallH, hz + hallD / 2],
    MAT.CLADDING, { roof: MAT.TRIM });
  // Process block: taller, narrower, at the back.
  m.box([-4.0, 0, -z + 1.0], [8.0, 17.0, -z + 11.0], MAT.SHED_WALL, { roof: MAT.TRIM });

  if (medium) {
    m.box([hx - hallW / 2 - 0.4, hallH - 0.4, hz - hallD / 2 - 0.4],
          [hx + hallW / 2 + 0.4, hallH, hz + hallD / 2 + 0.4], MAT.TRIM);
    m.box([-4.4, 16.5, -z + 0.6], [8.4, 17.0, -z + 11.4], MAT.TRIM);
    for (let y = 3.0; y < 16.0; y += 3.2) band(m, -4.0, -z + 1.0, 8.0, -z + 11.0, y, 0.14, 0.1, MAT.METAL);
    // Four stainless vessels outside, linked by pipework.
    for (let i = 0; i < 4; i++) {
      const cx = -16.0 + i * 4.2;
      m.cylinder(cx, -z + 5.5, 1.7, 1.0, 11.0, 14, MAT.METAL, false);
      m.cone(cx, -z + 5.5, 1.7, 0.4, 11.0, 12.4, 14, MAT.METAL);
      m.cone(cx, -z + 5.5, 0.5, 1.7, 0.0, 1.0, 12, MAT.METAL);
      m.painted(TINT.METAL_DARK, () => {
        for (const a of [0.6, 2.6, 4.6]) {
          m.box([cx + Math.cos(a) * 1.6 - 0.09, 0, -z + 5.5 + Math.sin(a) * 1.6 - 0.09],
                [cx + Math.cos(a) * 1.6 + 0.09, 1.2, -z + 5.5 + Math.sin(a) * 1.6 + 0.09], MAT.TRIM);
        }
      });
    }
    pipeRack(m, -17.0, -4.5, -z + 3.5, -z + 7.5, 6.0, 3);
    roofClutter(m, hx - 8, hz - 4, hx + 8, hz + 4, hallH, 841, 1.2);
  }
  if (fine) {
    // Ribbon glazing along the canning hall, and the loading dock.
    for (const [axis, sign, plane, u0, u1] of [
      ['z', 1, hz + hallD / 2, hx - hallW / 2 + 1.0, hx + hallW / 2 - 8.0],
      ['x', -1, hx - hallW / 2, hz - hallD / 2 + 1.2, hz + hallD / 2 - 1.2],
    ] as const) {
      m.opening({ axis, sign, plane, u0, u1, y0: 4.2, y1: 6.6,
        glass: MAT.GLASS, frame: 0.12, proud: 0.06 });
    }
    m.windowRow({ axis: 'z', sign: 1, plane: hz + hallD / 2, from: hx - hallW / 2 + 1.0,
      to: hx + hallW / 2 - 8.0, y0: 1.0, y1: 3.2, count: 5, width: 2.2,
      glass: MAT.SHOPFRONT, frame: 0.11, proud: 0.06 });
    entrance(m, { axis: 'z', sign: 1, plane: hz + hallD / 2 }, hx - hallW / 2 + 3.0,
      { width: 1.8, height: 2.5, double: true, glazed: true, canopy: 1.6 });
    dock(m, hx + hallW / 2 - 7.0, hx + hallW / 2 - 0.5, hz + hallD / 2, 2, 5.0);
    windowGrid(m, { axis: 'z', sign: -1, plane: -z + 1.0 }, -3.0, 7.0,
      { floors: 4, floorH: 3.6, base: 2.0, count: 3, width: 1.1, height: 1.4 });
    m.painted(TINT.METAL_DARK, () => {
      m.pipe([8.0, 12.0, -z + 6.0], [14.0, 12.0, -z + 6.0], 0.34, MAT.TRIM);
      m.box([13.6, 0, -z + 5.6], [14.4, 12.4, -z + 6.4], MAT.TRIM);
    });
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

// -------------------------------------------------------------------- table

const job = (jobs: number, pollution: number, upkeep: number): AssetDef['sim'] => ({
  jobs, powerKW: jobs * 3.2, waterM3: jobs * 0.2, garbagePerWeek: jobs * 7.5, pollution, upkeep,
});


// ------------------------------------------------------------- two more

/** Chemical works: process columns in a pipe-racked yard, and a flare. */
function chemicalWorks(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 24.0, z = 19.0;

  m.box([-x, 0.0005, -z], [x, 0.1, z], MAT.CONCRETE);
  // Four distillation columns of different heights on a common plinth. Height
  // variation is the whole silhouette here -- four equal columns read as silos.
  const cols: Array<[number, number, number]> = [
    [-14.0, 2.1, 26.0], [-8.0, 1.6, 19.0], [-1.5, 2.4, 31.0], [4.5, 1.4, 15.0],
  ];
  m.box([-17.0, 0.1, -6.0], [7.5, 1.5, 2.0], MAT.CONCRETE);
  for (const [cx, r, h] of cols) {
    m.cylinder(cx, -2.0, r, 1.5, h, 14, MAT.METAL, false);
    m.cone(cx, -2.0, r, 0.0, h, h + r * 0.9, 14, MAT.METAL);
  }

  if (medium) {
    // Ring beams and platforms up each column, plus a caged ladder.
    m.painted(TINT.METAL_DARK, () => {
      for (const [cx, r, h] of cols) {
        for (let y = 6.0; y < h; y += 6.0) {
          m.cylinder(cx, -2.0, r + 0.9, y, y + 0.16, 14, MAT.TRIM, true);
          m.cylinder(cx, -2.0, r + 0.9, y + 0.16, y + 1.15, 14, MAT.TRIM, false);
        }
        m.box([cx - 0.4, 1.5, -2.0 - r - 0.55], [cx + 0.4, h, -2.0 - r - 0.15], MAT.TRIM);
      }
    });
    // The rack that ties it together, and a reactor block behind.
    pipeRack(m, -18.0, 12.0, 3.0, 6.4, 6.0, 4);
    m.box([9.0, 0.1, -8.0], [x - 2.0, 11.0, 0.0], MAT.CLADDING, { roof: MAT.ROOF });
    parapet(m, 9.0, -8.0, x - 2.0, 0.0, 11.0, 0.9, 0.3);
    // Flare stack: a works like this always has one, and it reads at any range.
    stack(m, x - 5.0, z - 5.0, 1.0, 30.0);
    m.painted(TINT.ACCENT, () =>
      m.cone(x - 5.0, z - 5.0, 1.3, 0.3, 30.0, 33.0, 10, MAT.TRIM));
    m.box([-x + 2.0, 0.1, z - 9.0], [-x + 12.0, 7.4, z - 1.0], MAT.SHED_WALL, { roof: MAT.TRIM });
  }
  if (fine) {
    // Pipe runs down from the columns into the rack.
    for (const [cx, r] of cols) {
      m.pipe([cx + r, 5.4, -2.0], [cx + r, 5.4, 4.4], 0.24, MAT.METAL);
      m.pipe([cx, 1.6, -2.0 - r], [cx, 1.6, -5.6], 0.2, MAT.METAL);
    }
    m.pipe([-18.0, 6.5, 4.0], [-18.0, 2.0, 4.0], 0.24, MAT.METAL);
    // Bunded storage: two horizontal bullets on saddles.
    for (const pz of [-z + 4.0, -z + 9.0]) {
      m.pipe([-x + 4.0, 2.6, pz], [-x + 16.0, 2.6, pz], 1.7, MAT.METAL);
      for (const px of [-x + 6.0, -x + 14.0]) {
        m.box([px - 0.7, 0.1, pz - 1.6], [px + 0.7, 2.6, pz + 1.6], MAT.CONCRETE);
      }
    }
    m.box([-x + 2.0, 0.1, -z + 1.5], [-x + 18.0, 1.1, -z + 11.5], MAT.CONCRETE);
    // Control room, and the fence that a plant like this is always inside.
    windowGrid(m, { axis: 'z', sign: 1, plane: z - 1.0 }, -x + 3.0, -x + 11.0,
      { floors: 2, floorH: 3.4, base: 1.4, count: 3, width: 1.4, height: 1.5 });
    entrance(m, { axis: 'z', sign: 1, plane: z - 1.0 }, -x + 3.4,
      { width: 1.4, height: 2.4, double: true, steps: 1 });
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 26; i++) {
        const t = i / 26;
        m.box([-x + t * 2 * x - 0.06, 0.1, z - 0.5], [-x + t * 2 * x + 0.06, 2.4, z - 0.38], MAT.TRIM);
      }
      m.box([-x, 2.25, z - 0.52], [x, 2.35, z - 0.36], MAT.TRIM);
    });
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

/** Machine shop: a tall bay under an external gantry crane, and a steel yard. */
function machineShop(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 22.0, z = 18.0;
  const w = 26.0, d = 18.0, wall = 12.0;

  m.box([-x, 0.0005, -z], [x, 0.1, z], MAT.CONCRETE);
  m.box([-w / 2, 0.1, -z + 2.0], [w / 2, wall, -z + 2.0 + d], MAT.SHED_WALL, { roof: MAT.TRIM });
  m.gable([-w / 2, wall, -z + 2.0], [w / 2, wall, -z + 2.0 + d], 2.4, 'x', MAT.METAL, MAT.SHED_WALL);

  if (medium) {
    eavesBand(m, -w / 2, -z + 2.0, w / 2, -z + 2.0 + d, wall, 0.45, 0.32);
    // Roof monitor: a machine shop needs its light from above.
    m.box([-w / 2 + 3.0, wall + 1.5, -z + 6.0], [w / 2 - 3.0, wall + 3.0, -z + 14.0], MAT.GLASS);
    m.box([-w / 2 + 2.6, wall + 3.0, -z + 5.6], [w / 2 - 2.6, wall + 3.4, -z + 14.4], MAT.METAL);
    // The gantry: a portal crane on rails across the open yard, which is the
    // one silhouette no other industrial asset in the set has.
    const gy = 10.0;
    m.painted(TINT.METAL_DARK, () => {
      for (const px of [-14.0, 10.0]) {
        for (const pz of [z - 12.0, z - 4.0]) {
          m.box([px - 0.55, 0.1, pz - 0.55], [px + 0.55, gy, pz + 0.55], MAT.TRIM);
        }
        // Braced legs.
        m.quad([px - 0.5, 1.0, z - 11.5], [px + 0.5, 1.0, z - 11.5],
               [px + 0.5, gy - 1.0, z - 4.5], [px - 0.5, gy - 1.0, z - 4.5], MAT.TRIM);
      }
      m.box([-15.4, gy, z - 12.6], [11.4, gy + 1.5, z - 11.4], MAT.TRIM);
      m.box([-15.4, gy, z - 4.6], [11.4, gy + 1.5, z - 3.4], MAT.TRIM);
      // Rails on the ground under it.
      for (const pz of [z - 12.0, z - 4.0]) {
        m.box([-x + 1.0, 0.1, pz - 0.2], [x - 1.0, 0.24, pz + 0.2], MAT.TRIM);
      }
      // The trolley and hook block.
      m.box([-4.0, gy + 1.5, z - 12.8], [0.4, gy + 2.6, z - 3.2], MAT.TRIM);
      m.box([-2.6, gy - 3.4, z - 8.6], [-1.0, gy, z - 7.0], MAT.TRIM);
    });
  }
  if (fine) {
    // A very tall door: the shop is sized by what has to come through it.
    m.opening({ axis: 'z', sign: 1, plane: -z + 2.0 + d, u0: -6.0, u1: 2.0,
      y0: 0.3, y1: 8.0, glass: MAT.METAL, frame: 0.28, proud: 0.14 });
    windowGrid(m, { axis: 'z', sign: 1, plane: -z + 2.0 + d }, 3.0, w / 2 - 1.0,
      { floors: 2, floorH: 4.0, base: 2.2, count: 3, width: 1.6, height: 1.8 });
    windowGrid(m, { axis: 'x', sign: 1, plane: w / 2 }, -z + 3.5, -z + 16.5,
      { floors: 1, floorH: 4, base: 8.4, count: 6, width: 1.5, height: 2.2 });
    windowGrid(m, { axis: 'x', sign: -1, plane: -w / 2 }, -z + 3.5, -z + 16.5,
      { floors: 1, floorH: 4, base: 8.4, count: 6, width: 1.5, height: 2.2 });
    entrance(m, { axis: 'z', sign: 1, plane: -z + 2.0 + d }, w / 2 - 3.0,
      { width: 1.3, height: 2.4, double: true, canopy: 1.6, steps: 1 });
    // Steel stock in the yard, racked and stacked: what the crane is lifting.
    m.painted(TINT.METAL_DARK, () => {
      for (let r = 0; r < 4; r++) {
        for (let i = 0; i < 4 - r; i++) {
          const px = -12.0 + r * 0.85 + i * 1.7;
          m.pipe([px, 0.9 + r * 1.5, z - 11.0], [px, 0.9 + r * 1.5, z - 5.0], 0.8, MAT.METAL);
        }
      }
      for (const pz of [z - 11.4, z - 4.6]) {
        m.box([-13.4, 0.1, pz - 0.3], [-3.0, 0.4, pz + 0.3], MAT.TRIM);
      }
      // Plate stacks on timbers.
      for (let i = 0; i < 3; i++) {
        m.box([2.0, 0.1 + i * 0.5, z - 11.0], [9.0, 0.5 + i * 0.5, z - 6.0], MAT.TRIM);
      }
    });
    frontage(m, -x, x, z, 727, { planters: 0, bollards: 6, depth: 0.6 });
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

export const INDUSTRIAL: AssetDef[] = [
  { id: 'ind.chemical', name: 'Chemical works', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [6, 5], height: 33.0, sim: job(45, 26, 190), note: 'Four distillation columns of unequal height with ring platforms, pipe rack, bullet tanks, flare.', build: chemicalWorks },
  { id: 'ind.machine', name: 'Machine shop', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [6, 5], height: 15.4, sim: job(55, 12, 130), note: 'Tall bay with a roof monitor and an eight-metre door, external gantry crane on rails over a steel yard.', build: machineShop },
  { id: 'ind.shed', name: 'Distribution shed', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [4, 5], height: 13.1, sim: job(40, 8, 90), note: 'Shed, three shutters, canopy and loading apron. Corrugation is shader.', build: distributionShed },
  { id: 'ind.workshop', name: 'Workshop unit', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [3, 4], height: 9.5, sim: job(18, 5, 44), note: 'Brick office end against a metal workshop, two roller doors, canopy.', build: workshop },
  { id: 'ind.plant', name: 'Processing plant', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [4, 3], height: 23, sim: job(40, 14, 105), note: 'Sawtooth shed, process block, three silos, banded stack, pipe rack, dock.', build: processingPlant },
  { id: 'ind.tanks', name: 'Tank farm', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 16, sim: job(12, 18, 80), note: 'Four tanks in a bund with spiral stairs, pump house, stack, pipe rack.', build: tankFarm },
  { id: 'ind.foundry', name: 'Heavy works', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 32, sim: job(60, 22, 150), note: 'One tall bay with a crane rail and roof monitor, two stacks, annexe, dock.', build: foundry },
  { id: 'ind.cold', name: 'Cold store', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [4, 6], height: 16.9, sim: job(30, 6, 110), note: 'Insulated box, condenser deck on the roof, four dock seals, trailers on the apron.', build: coldStore },
  { id: 'ind.batching', name: 'Batching plant', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 16.4, sim: job(16, 16, 85), note: 'Aggregate bays, hopper tower on a frame, two cement silos, conveyor, weighbridge.', build: batchingPlant },
  { id: 'ind.depot', name: 'Vehicle depot', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [4, 4], height: 10.0, sim: job(34, 9, 95), note: 'Four-bay maintenance shed with roller doors, fuel island, two-storey office.', build: depot },
  { id: 'ind.timber', name: 'Timber yard', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 13.4, sim: job(26, 11, 78), note: 'Sawmill with a cyclone, open drying sheds, stacked boards and a log deck.', build: timberYard },
  { id: 'ind.assembly', name: 'Assembly plant', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [4, 4], height: 12.1, sim: job(70, 4, 130), note: 'Glazed office frontage, production hall with roof monitors, two loading bays.', build: assemblyPlant },
  { id: 'ind.recycling', name: 'Recycling yard', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 10, sim: job(24, 12, 70), note: 'Open yard: storage bays with heaps, sorting shed, conveyor, weighbridge.', build: recyclingYard },
  { id: 'ind.craft', name: 'Craft units', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [5, 3], height: 7.0, sim: job(22, 4, 48), note: 'Six starter units under one roof, brick to two metres, a roller door and a door each.', build: craftUnits },
  { id: 'ind.grain', name: 'Grain store', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 29.0, sim: job(14, 7, 72), note: 'Six silos with a conveyor gallery over, intake house taller than the lot, tipping shed.', build: grainStore },
  { id: 'ind.print', name: 'Print works', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [4, 3], height: 13.5, sim: job(48, 9, 100), note: 'Brick press hall with roof monitors, glazed office range, windowless paper store.', build: printWorks },
  { id: 'ind.water', name: 'Water works', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 9.6, sim: job(12, 3, 120), note: 'Two clarifiers with rotating bridges, filter house, control block, pipe gallery.', build: waterWorks },
  { id: 'ind.container', name: 'Container yard', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 14.5, sim: job(20, 10, 66), note: 'Containers stacked two and three high, gate office and barrier, lighting masts.', build: containerYard },
  { id: 'ind.brick', name: 'Brick works', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 30.0, sim: job(30, 17, 84), note: 'Buttressed kiln with a row of arches, tall banded chimney, open drying sheds.', build: brickWorks },
  { id: 'ind.bottling', name: 'Bottling plant', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 17.0, sim: job(56, 8, 118), note: 'Clad canning hall with a dock, tall process block, four stainless vessels on a pipe rack.', build: bottlingPlant },
];

void ring;
