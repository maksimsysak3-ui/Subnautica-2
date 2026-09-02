/**
 * Industry: six sites.
 *
 * Industrial buildings are silhouette more than facade -- silos, stacks,
 * gantries, sawtooth glazing. Where a house is judged on its front door, a
 * plant is judged from three hundred metres away, so the triangles go into
 * things that break the outline rather than into window frames.
 *
 * All six sit on a lot with the building to one side and a yard beside it,
 * which is what an industrial plot looks like and what leaves room for the
 * equipment that makes the type readable.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import { CELL } from '../types';
import type { AssetDef } from '../types';
import { band, entrance, frontage, kerb, parapet, ring, roofClutter, tree, windowGrid } from '../parts';

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
    tree(m, -x - 2.0, cz + z + 9.0, 5.2, 241);
    tree(m, x + 2.0, cz + z + 9.0, 5.0, 243);
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
    frontage(m, -x, x, z, 251, { trees: 2, planters: 1, bollards: 5, depth: 2.6 });
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
    m.painted(TINT.METAL_DARK, () => {
      m.box([4.0, 0, 3.88], [9.0, 6.0, 4.06], MAT.TRIM);
      // Perimeter fence along two sides.
      for (let i = 0; i < 16; i++) {
        const px = -17.0 + i * 2.3;
        m.box([px - 0.08, 0, 10.4], [px + 0.08, 2.4, 10.56], MAT.TRIM);
      }
      m.box([-17.2, 2.2, 10.4], [18.4, 2.35, 10.56], MAT.TRIM);
    });
    tree(m, -16.5, -8.0, 5.0, 231);
    tree(m, 18.5, 8.0, 4.6, 233);
    frontage(m, -17.0, 2.0, 10.6, 261, { trees: 3, planters: 2, bollards: 6, depth: 2.2 });
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

// -------------------------------------------------------------------- table

const job = (jobs: number, pollution: number, upkeep: number): AssetDef['sim'] => ({
  jobs, powerKW: jobs * 3.2, waterM3: jobs * 0.2, garbagePerWeek: jobs * 7.5, pollution, upkeep,
});

export const INDUSTRIAL: AssetDef[] = [
  { id: 'ind.shed', name: 'Distribution shed', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [4, 5], height: 13.1, sim: job(40, 8, 90), note: 'Shed, three shutters, canopy and loading apron. Corrugation is shader.', build: distributionShed },
  { id: 'ind.workshop', name: 'Workshop unit', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [3, 4], height: 9.5, sim: job(18, 5, 44), note: 'Brick office end against a metal workshop, two roller doors, canopy.', build: workshop },
  { id: 'ind.plant', name: 'Processing plant', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [4, 3], height: 23, sim: job(40, 14, 105), note: 'Sawtooth shed, process block, three silos, banded stack, pipe rack, dock.', build: processingPlant },
  { id: 'ind.tanks', name: 'Tank farm', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 16, sim: job(12, 18, 80), note: 'Four tanks in a bund with spiral stairs, pump house, stack, pipe rack.', build: tankFarm },
  { id: 'ind.foundry', name: 'Heavy works', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 32, sim: job(60, 22, 150), note: 'One tall bay with a crane rail and roof monitor, two stacks, annexe, dock.', build: foundry },
  { id: 'ind.recycling', name: 'Recycling yard', zone: 'industrial', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 10, sim: job(24, 12, 70), note: 'Open yard: storage bays with heaps, sorting shed, conveyor, weighbridge.', build: recyclingYard },
];

void ring;
