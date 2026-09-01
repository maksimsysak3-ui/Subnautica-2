/**
 * Commercial: a retail-over-office block, in both variants.
 *
 * Commercial buildings differ from housing mostly in their ground floor --
 * continuous shopfront glazing rather than punched windows -- and in having
 * continuous glass above rather than a grid of openings. Both are materials
 * the facade shader already knows.
 */

import { MAT, MeshBuilder } from '../mesh';
import { CELL } from '../types';
import type { AssetDef } from '../types';

function shaded(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const w = CELL * 2 - 1.4, d = CELL * 2 - 2.0;
  const x = w / 2, z = d / 2;
  const ground = 4.6, h = 24;

  m.box([-x, 0, -z], [x, ground, z], MAT.SHOPFRONT, { roof: MAT.TRIM });
  m.box([-x, ground, -z], [x, h, z], MAT.GLASS, { roof: MAT.ROOF });
  if (lod < 2) {
    m.box([-x - 0.2, h, -z - 0.2], [x + 0.2, h + 1.0, z + 0.2], MAT.TRIM);
  }
  return m;
}

function sculpted(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  // Silhouette-scale geometry survives to medium; glazing bays are fine only.
  const fine = lod < 1;
  const medium = lod < 2;
  const w = CELL * 2 - 1.4, d = CELL * 2 - 2.0;
  const x = w / 2, z = d / 2;
  const ground = 5.0;
  const floors = 7, floorH = 3.6;
  const h = ground + floors * floorH;

  // Shopfront set back behind the frame above, which is what puts a shop in
  // shadow and reads as a building standing on columns rather than on glass.
  m.box([-x + 0.5, 0, -z + 0.5], [x - 0.5, ground, z - 0.5], MAT.SHOPFRONT, { roof: MAT.TRIM });
  m.box([-x, ground, -z], [x, h, z], MAT.GLASS, { roof: MAT.ROOF });

  if (medium) {
    // Corner columns carrying the mass above the recessed shopfront.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        m.box([sx * x - sx * 0.55, 0, sz * z - sz * 0.55], [sx * x, ground, sz * z], MAT.TRIM);
      }
    }

    // Canopy over the pavement.
    m.box([-x - 0.9, ground - 0.7, -z - 0.9], [x + 0.9, ground - 0.42, z + 0.9], MAT.TRIM);

    // Spandrel bands between floors: a shallow ledge at every slab line. This
    // is the horizontal counterpart to the tower fins -- it stops the glass
    // reading as one undifferentiated sheet.
    for (let f = 1; f <= floors; f++) {
      const y = ground + f * floorH - 0.5;
      m.box([-x - 0.14, y, -z - 0.14], [x + 0.14, y + 0.5, z + 0.14], MAT.TRIM);
    }

    // Cornice and rooftop plant.
    m.box([-x - 0.42, h, -z - 0.42], [x + 0.42, h + 1.3, z + 0.42], MAT.TRIM);
    m.box([-2.6, h, -1.9], [1.4, h + 2.6, 1.9], MAT.METAL, { roof: MAT.ROOF });
    m.box([2.0, h, -2.4], [4.2, h + 1.2, -0.2], MAT.METAL);
    m.cylinder(3.0, 1.8, 0.85, h, h + 1.9, 10, MAT.METAL);
  }

  if (fine) {
    // Glazing bay per floor, all four elevations.
    for (let f = 0; f < floors; f++) {
      const y0 = ground + f * floorH + 0.35;
      const y1 = y0 + floorH - 1.05;
      for (const [sign, plane] of [[1, z], [-1, -z]] as const) {
        m.windowRow({ axis: 'z', sign, plane, from: -x + 0.6, to: x - 0.6, y0, y1, count: 2, width: 4.6, glass: MAT.GLASS, frame: 0.07, proud: 0.05 });
      }
      for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
        m.windowRow({ axis: 'x', sign, plane, from: -z + 0.6, to: z - 0.6, y0, y1, count: 2, width: 4.0, glass: MAT.GLASS, frame: 0.07, proud: 0.05 });
      }
    }
    // Shopfront bays at street level, taller and undivided.
    for (const [sign, plane] of [[1, z - 0.5], [-1, -z + 0.5]] as const) {
      m.windowRow({ axis: 'z', sign, plane, from: -x + 1.2, to: x - 1.2, y0: 0.7, y1: 4.1, count: 3, width: 3.0, glass: MAT.SHOPFRONT, frame: 0.12, proud: 0.08 });
    }

  }
  return m;
}

export const COMMERCIAL: AssetDef[] = [
  {
    id: 'com.shaded', name: 'Retail and offices', zone: 'commercial', density: 'medium',
    variant: 'shaded', footprint: [2, 2], height: 25,
    sim: { jobs: 90, powerKW: 210, waterM3: 22, garbagePerWeek: 480, pollution: 2, upkeep: 160 },
    note: 'Two boxes: shopfront base, glass above. Mullions and signage are shader.',
    build: shaded,
  },
  {
    id: 'com.sculpted', name: 'Retail and offices, articulated', zone: 'commercial', density: 'medium',
    variant: 'sculpted', footprint: [2, 2], height: 31,
    sim: { jobs: 90, powerKW: 210, waterM3: 22, garbagePerWeek: 480, pollution: 2, upkeep: 175 },
    note: 'Recessed shopfront on columns, pavement canopy, spandrel band per floor, cornice, roof plant.',
    build: sculpted,
  },
];
