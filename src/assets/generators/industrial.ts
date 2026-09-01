/**
 * Industry: a distribution shed, and a processing plant.
 *
 * Industrial buildings are the clearest case for the two variants. A warehouse
 * genuinely is a corrugated box, and the shaded version is close to honest at
 * any distance -- what it needs is doors and a roofline, not detail. A plant is
 * nothing but silhouette: silos, a stack, sawtooth glazing, a pipe rack. No
 * amount of facade shading substitutes for that, and the whole point of a
 * sculpted variant is having somewhere to put it.
 *
 * Both sit on a 4x3 lot with the building to one side and a yard beside it,
 * which is what an industrial plot actually looks like -- and which leaves
 * room for the plant's equipment without overflowing the lot.
 */

import { MAT, MeshBuilder } from '../mesh';
import { CELL } from '../types';
import type { AssetDef } from '../types';

const LOT_X = CELL * 4;    // 32 m
const LOT_Z = CELL * 3;    // 24 m

// -------------------------------------------------------------------- shed

function shaded(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const medium = lod < 2;
  const w = 25.0, d = 17.0, wall = 9.2, ridge = 2.6;
  const x = w / 2, z = d / 2;
  const cz = -1.5;                      // shed sits back, yard in front

  m.box([-x, 0, cz - z], [x, wall, cz + z], MAT.SHED_WALL, { roof: MAT.TRIM });
  m.gable([-x, wall, cz - z], [x, wall, cz + z], ridge, 'x', MAT.METAL, MAT.SHED_WALL);

  if (medium) {
    // Eaves and a ridge cap. Two boxes, and without them the roof reads as a
    // fold in the wall rather than as a roof sitting on it.
    m.box([-x - 0.45, wall - 0.35, cz - z - 0.45], [x + 0.45, wall, cz + z + 0.45], MAT.TRIM);
    m.box([-x, wall + ridge - 0.18, cz - 0.35], [x, wall + ridge + 0.2, cz + 0.35], MAT.TRIM);

    // Three roller shutters and a canopy: the front of every distribution shed.
    for (let i = 0; i < 3; i++) {
      const bx = -x + 4.6 + i * 7.4;
      m.box([bx - 2.2, 0, cz + z - 0.05], [bx + 2.2, 5.0, cz + z + 0.16], MAT.TRIM);
      m.box([bx - 2.4, 5.0, cz + z - 0.05], [bx + 2.4, 5.35, cz + z + 0.3], MAT.TRIM);
    }
    m.box([-x + 0.6, 6.4, cz + z], [x - 0.6, 6.75, cz + z + 2.6], MAT.METAL);

    // Personnel door, and a raised loading apron.
    m.box([x - 3.4, 0, cz + z - 0.05], [x - 2.2, 2.4, cz + z + 0.14], MAT.TRIM);
    m.box([-x + 0.8, 0, cz + z], [x - 0.8, 1.15, cz + z + 2.4], MAT.TRIM);

    // Two roof extracts.
    m.cylinder(-5.0, cz, 0.7, wall + ridge - 0.4, wall + ridge + 1.3, 10, MAT.METAL);
    m.cylinder(5.0, cz, 0.7, wall + ridge - 0.4, wall + ridge + 1.3, 10, MAT.METAL);
  }
  return m;
}

// ------------------------------------------------------------------- plant

function sculpted(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;

  // Main shed on the left of the lot, process block behind it, yard to the
  // right holding the silos, stack and pipe rack.
  const sw = 17.0, sd = 13.0, wall = 10.5;
  const sx = -LOT_X / 2 + sw / 2 + 1.0;      // shed centre
  const sz = 0.4;
  const x0 = sx - sw / 2, x1 = sx + sw / 2;
  const z0 = sz - sd / 2, z1 = sz + sd / 2;

  m.box([x0, 0, z0], [x1, wall, z1], MAT.METAL, { roof: MAT.ROOF });

  if (medium) {
    // Sawtooth roof: north-facing glazing over a shed, the signature
    // industrial roofline and the reason a plant reads as a plant from above.
    const teeth = 5;
    const step = sw / teeth;
    const rise = 3.4;
    for (let i = 0; i < teeth; i++) {
      const a = x0 + i * step;
      const b = a + step;
      m.quad([a, wall, z1], [b, wall, z1], [b, wall + rise, z0], [a, wall + rise, z0], MAT.METAL);
      m.quad([a, wall, z0], [a, wall + rise, z0], [b, wall + rise, z0], [b, wall, z0], MAT.GLASS);
      m.tri([a, wall, z1], [a, wall + rise, z0], [a, wall, z0], MAT.METAL);
      m.tri([b, wall, z1], [b, wall, z0], [b, wall + rise, z0], MAT.METAL);
    }

    // Taller process block behind the shed, where the plant is actually tall.
    m.box([x1 - 5.0, 0, z0 - 5.6], [x1 + 3.2, 17.5, z0 + 0.4], MAT.METAL, { roof: MAT.ROOF });
    m.box([x1 - 5.3, 17.5, z0 - 5.9], [x1 + 3.5, 18.3, z0 + 0.7], MAT.TRIM);

    // Silos: three, graded. A row of identical cylinders reads as a mistake;
    // different diameters and heights read as a plant.
    const silo = (cx: number, cz: number, r: number, h: number): void => {
      m.cylinder(cx, cz, r * 1.06, 0, 1.1, 14, MAT.TRIM);        // plinth
      m.cylinder(cx, cz, r, 1.1, h, 16, MAT.METAL, false);
      m.cone(cx, cz, r, r * 0.34, h, h + r * 0.8, 16, MAT.METAL);
      m.cylinder(cx, cz, r * 0.34, h + r * 0.8, h + r * 1.1, 10, MAT.TRIM);
    };
    silo(7.0, -4.0, 2.5, 15.0);
    silo(7.0, 2.6, 2.0, 12.0);
    silo(12.4, -1.2, 1.6, 9.5);

    // Stack, with banding.
    m.cylinder(13.2, -7.6, 1.15, 0, 23.0, 12, MAT.TRIM, false);
    for (const y of [7.0, 13.0, 19.0]) {
      m.cylinder(13.2, -7.6, 1.3, y, y + 0.55, 12, MAT.METAL, false);
    }

    // Loading dock and canopy on the front of the shed.
    m.box([x0 + 1.0, 0, z1], [x1 - 1.0, 1.2, z1 + 2.0], MAT.TRIM);
    for (let i = 0; i < 2; i++) {
      const bx = x0 + 4.6 + i * 7.0;
      m.box([bx - 2.0, 1.2, z1 - 0.1], [bx + 2.0, 5.6, z1 + 0.12], MAT.TRIM);
    }
    m.box([x0 + 0.6, 6.2, z1], [x1 - 0.6, 6.55, z1 + 2.4], MAT.METAL);

    // Single-storey control office against the shed's gable end.
    m.box([x0 - 0.4, 0, z1 - 6.4], [x0 + 4.6, 4.0, z1 - 1.4], MAT.BRICK, { roof: MAT.ROOF });
    m.box([x0 - 0.7, 4.0, z1 - 6.7], [x0 + 4.9, 4.45, z1 - 1.1], MAT.TRIM);
  }

  if (fine) {
    // Clerestory strip windows along the shed's long walls.
    for (const [sign, plane] of [[1, z1], [-1, z0]] as const) {
      m.windowRow({ axis: 'z', sign, plane, from: x0 + 1.2, to: x1 - 1.2, y0: 6.8, y1: 8.6, count: 5, width: 2.1, glass: MAT.GLASS, frame: 0.09, proud: 0.06 });
    }
    m.opening({ axis: 'z', sign: 1, plane: z1 - 1.4, u0: x0 + 1.6, u1: x0 + 2.6, y0: 0.1, y1: 2.3, glass: MAT.TRIM, frame: 0.1, proud: 0.07 });
    // Office windows.
    m.windowRow({ axis: 'z', sign: 1, plane: z1 - 1.4, from: x0 + 3.0, to: x0 + 4.4, y0: 1.2, y1: 2.7, count: 1, width: 1.2, glass: MAT.GLASS, frame: 0.09, proud: 0.06 });
    m.windowRow({ axis: 'x', sign: -1, plane: x0 - 0.4, from: z1 - 5.8, to: z1 - 2.0, y0: 1.2, y1: 2.7, count: 3, width: 0.9, glass: MAT.GLASS, frame: 0.09, proud: 0.06 });

    // Pipe rack: portal frames carrying three runs across the yard. More than
    // anything else, this is what makes a cluster of tanks look connected
    // rather than parked.
    for (let i = 0; i < 4; i++) {
      const px = 1.0 + i * 3.6;
      m.box([px - 0.18, 0, -6.6], [px + 0.18, 6.4, -6.24], MAT.TRIM);
      m.box([px - 0.18, 0, -1.0], [px + 0.18, 6.4, -0.64], MAT.TRIM);
      m.box([px - 0.24, 6.4, -6.7], [px + 0.24, 6.9, -0.54], MAT.TRIM);
    }
    for (const pz of [-5.6, -4.2, -2.4]) {
      m.pipe([0.4, 6.9, pz], [14.0, 6.9, pz], 0.22, MAT.METAL);
    }
    // Risers from the rack up to the silos.
    m.pipe([7.0, 6.9, -4.0], [7.0, 14.0, -4.0], 0.2, MAT.METAL);
    m.pipe([7.0, 6.9, 2.6], [7.0, 11.4, 2.6], 0.2, MAT.METAL);

    // Access stair up the process block: stringers, treads, landing rail.
    for (let i = 0; i < 14; i++) {
      const y = 1.0 + i * 1.15;
      m.box([x1 + 3.2, y, z0 - 5.2 + i * 0.32], [x1 + 4.6, y + 0.12, z0 - 4.6 + i * 0.32], MAT.TRIM);
    }
    m.box([x1 + 3.1, 0.8, z0 - 5.4], [x1 + 3.3, 17.4, z0 - 0.6], MAT.TRIM);
    m.box([x1 + 4.5, 0.8, z0 - 5.4], [x1 + 4.7, 17.4, z0 - 0.6], MAT.TRIM);

    // Ladder and railed platform on the tallest silo.
    for (let i = 0; i < 16; i++) {
      const y = 1.4 + i * 0.85;
      m.box([9.3, y, -4.2], [9.9, y + 0.09, -3.8], MAT.TRIM);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      m.box([7.0 + Math.cos(a) * 2.7 - 0.06, 15.0, -4.0 + Math.sin(a) * 2.7 - 0.06],
            [7.0 + Math.cos(a) * 2.7 + 0.06, 16.1, -4.0 + Math.sin(a) * 2.7 + 0.06], MAT.TRIM);
    }
    m.cylinder(7.0, -4.0, 2.76, 15.0, 15.12, 14, MAT.TRIM, false);

    // Roof extracts on the sawtooth.
    for (let i = 0; i < 3; i++) {
      m.cylinder(x0 + 3.4 + i * 4.6, sz + 3.0, 0.6, wall + 3.4, wall + 4.7, 10, MAT.METAL);
    }
  }
  return m;
}

export const INDUSTRIAL: AssetDef[] = [
  {
    id: 'ind.shaded', name: 'Distribution shed', zone: 'industrial', density: 'none',
    variant: 'shaded', footprint: [4, 3], height: 13.1,
    sim: { jobs: 40, powerKW: 130, waterM3: 8, garbagePerWeek: 300, pollution: 8, upkeep: 90 },
    note: 'Shed, shutters, canopy, apron. Corrugation and the clerestory band are shader.',
    build: shaded,
  },
  {
    id: 'ind.sculpted', name: 'Processing plant', zone: 'industrial', density: 'none',
    variant: 'sculpted', footprint: [4, 3], height: 23,
    sim: { jobs: 40, powerKW: 130, waterM3: 8, garbagePerWeek: 300, pollution: 14, upkeep: 105 },
    note: 'Sawtooth shed, process block, three silos, banded stack, pipe rack, access stairs, dock.',
    build: sculpted,
  },
];

void LOT_Z;
