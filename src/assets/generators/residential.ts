/**
 * Housing, low through high density, in both variants.
 *
 * The shaded ones are near-bare massing: a box, a roof, a parapet. Everything
 * that reads as a window, a brick course or a balcony band is drawn by the
 * facade shader from world position. The sculpted ones model the same features
 * as geometry, so the two can be compared directly at the same footprint.
 */

import { MAT, MeshBuilder } from '../mesh';
import { CELL } from '../types';
import type { AssetDef } from '../types';
import { hash2 } from '../../sim/hash';

// ---------------------------------------------------------------- low density

/** Ridge height for a given span, at a roughly 38-degree pitch. */
const pitch = (span: number): number => span * 0.39;

function lowShaded(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const medium = lod < 2;
  // Deeper than it is wide, which is what a house is and a cube is not. The
  // first attempt was 9 x 9.6 and read as a brick warehouse.
  const w = 7.6, d = 10.4, wall = 5.3;
  const x = w / 2, z = d / 2;
  const ridge = pitch(w);

  // HOUSE_WALL draws its own openings; the sculpted house models them instead
  // and uses plain BRICK, or the two would overlap.
  m.box([-x, 0, -z], [x, wall, z], MAT.HOUSE_WALL, { roof: MAT.TRIM });
  m.gable([-x, wall, -z], [x, wall, z], ridge, 'z', MAT.TILE, MAT.HOUSE_WALL);

  if (medium) {
    // Eaves. A roof that stops flush with the wall reads as a lid; forty
    // centimetres of overhang and the shadow under it reads as a house.
    m.box([-x - 0.42, wall - 0.3, -z - 0.42], [x + 0.42, wall, z + 0.42], MAT.TRIM);
    // Chimney, and a porch canopy over the door.
    m.box([x - 2.6, wall + 1.4, -1.1], [x - 1.5, wall + ridge + 1.6, 0.2], MAT.BRICK);
    m.box([-1.5, 2.55, z], [1.5, 2.85, z + 1.25], MAT.TRIM);
    m.box([-1.35, 0, z + 0.95], [-1.05, 2.55, z + 1.2], MAT.TRIM);
    m.box([1.05, 0, z + 0.95], [1.35, 2.55, z + 1.2], MAT.TRIM);
    m.box([-1.7, 0, z], [1.7, 0.16, z + 1.5], MAT.TRIM);
  }
  return m;
}

function lowSculpted(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  // Three tiers. `fine` is window frames, balusters and gutters -- gone by
  // 80 m. `medium` is the massing-scale geometry that still reads at distance:
  // the front wing, the garage, the eaves, the dormer. Regenerating at lower
  // detail beats decimating, because the generator knows which is which and a
  // decimator has to guess.
  const fine = lod < 1;
  const medium = lod < 2;

  const w = 7.4, d = 9.8, wall = 5.4;
  const x = w / 2, z = d / 2;
  const ridge = pitch(w);

  // Main volume, ridge running front to back.
  m.box([-x, 0, -z], [x, wall, z], MAT.BRICK, { roof: MAT.TRIM });
  m.gable([-x, wall, -z], [x, wall, z], ridge, 'z', MAT.TILE, MAT.BRICK);

  // Front wing, gabled across the main ridge. A cross gable is the single
  // cheapest thing that stops a detached house looking like a shed: it breaks
  // the silhouette and gives the front elevation a centre.
  const ww = 4.3, wd = 3.1;
  const wx0 = -ww / 2, wx1 = ww / 2;
  const wz0 = z - 0.2, wz1 = z + wd;
  if (medium) {
    m.box([wx0, 0, wz0], [wx1, wall - 0.5, wz1], MAT.BRICK, { roof: MAT.TRIM });
    m.gable([wx0, wall - 0.5, wz0], [wx1, wall - 0.5, wz1], pitch(ww), 'x', MAT.TILE, MAT.BRICK);

    // Garage, set back and lower so it stays subordinate.
    const gx0 = x - 0.3, gx1 = x + 4.7;
    m.box([gx0, 0, -z + 1.4], [gx1, 3.1, z - 1.6], MAT.BRICK, { roof: MAT.TRIM });
    m.gable([gx0, 3.1, -z + 1.4], [gx1, 3.1, z - 1.6], 1.5, 'z', MAT.TILE, MAT.BRICK);

    // Eaves on all three roofs.
    m.box([-x - 0.42, wall - 0.3, -z - 0.42], [x + 0.42, wall, z + 0.42], MAT.TRIM);
    m.box([wx0 - 0.36, wall - 0.8, wz0], [wx1 + 0.36, wall - 0.5, wz1 + 0.36], MAT.TRIM);
    m.box([gx0, 2.82, -z + 1.05], [gx1 + 0.3, 3.1, z - 1.25], MAT.TRIM);

    // Dormer in the main roof slope, and the chimney.
    m.box([-x - 0.05, wall + 0.4, -1.6], [-x + 1.5, wall + 2.0, 0.1], MAT.BRICK);
    m.gable([-x - 0.2, wall + 2.0, -1.75], [-x + 1.65, wall + 2.0, 0.25], 0.7, 'z', MAT.TILE, MAT.BRICK);
    m.box([x - 2.3, wall + 1.2, -2.4], [x - 1.2, wall + ridge + 1.8, -1.1], MAT.BRICK);
    m.box([x - 2.5, wall + ridge + 1.8, -2.6], [x - 1.0, wall + ridge + 2.1, -0.9], MAT.TRIM);
  }

  if (fine) {
    // Porch: canopy, posts, balusters, steps. Individually pointless,
    // collectively the difference between a front door and a hole in a wall.
    m.box([wx1 + 0.1, 0, wz1 - 2.4], [wx1 + 3.4, 0.16, wz1], MAT.TRIM);
    m.box([wx1 + 0.1, 2.6, wz1 - 2.6], [wx1 + 3.6, 2.92, wz1 + 0.25], MAT.TRIM);
    for (const px of [wx1 + 0.45, wx1 + 3.1]) {
      m.box([px - 0.14, 0.16, wz1 - 0.4], [px + 0.14, 2.6, wz1 - 0.12], MAT.TRIM);
    }
    for (let i = 0; i < 8; i++) {
      const bx = wx1 + 0.5 + (i / 7) * 2.55;
      m.box([bx - 0.04, 0.16, wz1 - 0.32], [bx + 0.04, 0.98, wz1 - 0.2], MAT.TRIM);
    }
    m.box([wx1 + 0.35, 0.98, wz1 - 0.38], [wx1 + 3.25, 1.1, wz1 - 0.14], MAT.TRIM);
    // Two shallow steps. Their tread sits at zero, not below it: geometry
    // under the ground plane is invisible and shows up as a warning.
    for (let i = 0; i < 2; i++) {
      const y = 0.16 - i * 0.07;
      m.box([wx1 + 0.5, 0.0001, wz1 + 0.05 + i * 0.24], [wx1 + 2.4, y, wz1 + 0.29 + i * 0.24], MAT.TRIM);
    }

    // Front door, in the porch.
    m.opening({ axis: 'z', sign: 1, plane: wz1, u0: wx1 + 1.1, u1: wx1 + 2.1, y0: 0.16, y1: 2.3, glass: MAT.TRIM, frame: 0.13, proud: 0.09 });

    // Bay window on the front wing.
    m.box([wx0 + 0.5, 0.3, wz1], [wx1 - 0.5, 2.9, wz1 + 0.5], MAT.BRICK, { roof: MAT.TRIM });
    m.opening({ axis: 'z', sign: 1, plane: wz1 + 0.5, u0: wx0 + 0.75, u1: wx1 - 0.75, y0: 0.75, y1: 2.55, glass: MAT.GLASS, frame: 0.1, proud: 0.07 });
    m.windowRow({ axis: 'z', sign: 1, plane: wz1, from: wx0, to: wx1, y0: 3.3, y1: 4.7, count: 1, width: 1.5, glass: MAT.GLASS, frame: 0.1, proud: 0.07 });

    // Windows on every other elevation.
    for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
      m.windowRow({ axis: 'x', sign, plane, from: -z + 1.2, to: z - 1.2, y0: 1.2, y1: 2.7, count: 2, width: 1.2, glass: MAT.GLASS, frame: 0.09, proud: 0.06 });
      m.windowRow({ axis: 'x', sign, plane, from: -z + 1.2, to: z - 1.2, y0: 3.4, y1: 4.8, count: 2, width: 1.2, glass: MAT.GLASS, frame: 0.09, proud: 0.06 });
    }
    m.windowRow({ axis: 'z', sign: -1, plane: -z, from: -x + 1.0, to: x - 1.0, y0: 1.3, y1: 2.8, count: 2, width: 1.3, glass: MAT.GLASS, frame: 0.09, proud: 0.06 });
    m.windowRow({ axis: 'z', sign: -1, plane: -z, from: -x + 1.0, to: x - 1.0, y0: 3.5, y1: 4.9, count: 2, width: 1.3, glass: MAT.GLASS, frame: 0.09, proud: 0.06 });
    // Dormer window.
    m.opening({ axis: 'z', sign: 1, plane: 0.1, u0: -x + 0.35, u1: -x + 1.1, y0: wall + 0.85, y1: wall + 1.8, glass: MAT.GLASS, frame: 0.08, proud: 0.05 });
    // Garage door.
    m.opening({ axis: 'z', sign: 1, plane: z - 1.6, u0: x + 0.4, u1: x + 4.0, y0: 0.15, y1: 2.5, glass: MAT.TRIM, frame: 0.12, proud: 0.09 });

    // Gutter along both eaves, and downpipes at the corners.
    m.box([-x - 0.42, wall - 0.44, z + 0.24], [x + 0.42, wall - 0.3, z + 0.42], MAT.TRIM);
    m.box([-x - 0.42, wall - 0.44, -z - 0.42], [x + 0.42, wall - 0.3, -z - 0.24], MAT.TRIM);
    for (const px of [-x - 0.3, x + 0.16]) {
      m.box([px, 0, z + 0.26], [px + 0.14, wall - 0.44, z + 0.4], MAT.TRIM);
    }
  }
  return m;
}

// ------------------------------------------------------------- medium density

function mediumShaded(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const w = CELL * 2 - 1.6, d = CELL * 2 - 2.4, h = 15.5;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], MAT.HOUSING, { roof: MAT.ROOF });
  if (lod < 2) {
    // Parapet: a lip around the roof. Without it a flat-roofed block reads as
    // a solid extruded rectangle, which is the giveaway of a placeholder.
    m.box([-x - 0.16, h, -z - 0.16], [x + 0.16, h + 0.8, z + 0.16], MAT.TRIM);
  }
  return m;
}

function mediumSculpted(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = CELL * 2 - 1.6, d = CELL * 2 - 2.4;
  const floors = 5, floorH = 3.1;
  const h = floors * floorH;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], MAT.HOUSING, { roof: MAT.ROOF });
  m.box([-x - 0.18, h, -z - 0.18], [x + 0.18, h + 0.9, z + 0.18], MAT.TRIM);

  // Ground floor in a different material, set back slightly. Almost every
  // apartment block has this and it is the cheapest way to stop a facade
  // running uninterrupted into the pavement.
  m.box([-x - 0.22, 0, -z - 0.22], [x + 0.22, 3.4, z + 0.22], MAT.BRICK, { roof: MAT.TRIM });

  if (medium) {
    // Balconies: a slab and a railing per bay, per floor. This is the feature
    // that costs the triangles and does the most for the read.
    const bays = 4;
    for (let f = 1; f < floors; f++) {
      const y = 3.4 + (f - 1) * floorH + 0.1;
      for (let b = 0; b < bays; b++) {
        const cx = -x + ((b + 0.5) / bays) * w;
        for (const [zz, dir] of [[z, 1], [-z, -1]] as const) {
          const depth = 1.25 * dir;
          m.box([cx - 1.4, y, Math.min(zz, zz + depth)], [cx + 1.4, y + 0.16, Math.max(zz, zz + depth)], MAT.TRIM);
          // Railing as a solid panel: at any distance a modelled balustrade is
          // a shimmering mess, and a panel is one box.
          const rz = zz + depth;
          m.box([cx - 1.4, y + 0.16, Math.min(rz, rz - 0.1 * dir)], [cx + 1.4, y + 1.16, Math.max(rz, rz - 0.1 * dir)], MAT.TRIM);
        }
      }
    }

    // Stair core breaking the roofline, and rooftop plant.
    m.box([-1.6, h, -1.4], [1.6, h + 3.0, 1.4], MAT.BRICK, { roof: MAT.ROOF });
    m.box([x - 3.6, h + 0.9, -2.2], [x - 1.4, h + 2.1, 0.6], MAT.METAL);
  }

  if (fine) {
    // Windows: one row per floor on all four elevations, skipping where the
    // balconies already occupy the wall.
    for (let f = 0; f < floors; f++) {
      const y0 = 3.4 + (f - 1) * floorH + 0.9;
      if (f === 0) continue;
      for (const [sign, plane] of [[1, z], [-1, -z]] as const) {
        m.windowRow({ axis: 'z', sign, plane, from: -x + 0.8, to: x - 0.8, y0, y1: y0 + 1.5, count: 3, width: 1.15, glass: MAT.GLASS, frame: 0.08, proud: 0.06 });
      }
      for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
        m.windowRow({ axis: 'x', sign, plane, from: -z + 0.8, to: z - 0.8, y0, y1: y0 + 1.5, count: 2, width: 1.25, glass: MAT.GLASS, frame: 0.08, proud: 0.06 });
      }
    }
    // Shopfront-scale glazing at street level.
    for (const [sign, plane] of [[1, z], [-1, -z]] as const) {
      m.windowRow({ axis: 'z', sign, plane, from: -x + 0.9, to: x - 0.9, y0: 0.9, y1: 2.9, count: 3, width: 1.7, glass: MAT.SHOPFRONT, frame: 0.1, proud: 0.07 });
    }

  }
  return m;
}

// --------------------------------------------------------------- high density

function highShaded(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const w = CELL * 3 - 2.4, d = CELL * 3 - 2.4;
  const x = w / 2, z = d / 2;
  const podium = 9, tower = 62;

  m.box([-x, 0, -z], [x, podium, z], MAT.HOUSING, { roof: MAT.ROOF });
  // Setback: the tower is narrower than its podium. One extra box, and it is
  // the difference between a tower and an extruded lot.
  const tx = x * 0.72, tz = z * 0.72;
  m.box([-tx, podium, -tz], [tx, tower, tz], MAT.HOUSING, { roof: MAT.ROOF });
  if (lod < 2) {
    m.box([-tx - 0.2, tower, -tz - 0.2], [tx + 0.2, tower + 1.1, tz + 0.2], MAT.TRIM);
  }
  return m;
}

function highSculpted(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = CELL * 3 - 2.4, d = CELL * 3 - 2.4;
  const x = w / 2, z = d / 2;
  const podium = 9.5;
  const floors = 19, floorH = 3.05;
  const top = podium + floors * floorH;
  const tx = x * 0.70, tz = z * 0.70;

  m.box([-x, 0, -z], [x, podium, z], MAT.BRICK, { roof: MAT.ROOF });
  m.box([-x - 0.25, podium, -z - 0.25], [x + 0.25, podium + 0.7, z + 0.25], MAT.TRIM);
  m.box([-tx, podium, -tz], [tx, top, tz], MAT.HOUSING, { roof: MAT.ROOF });

  if (medium) {
    // Vertical fins between bays, running the full height. They catch the sun
    // edge-on and give a tower its vertical grain -- the thing a flat glass box
    // is missing.
    const bays = 5;
    for (let b = 0; b <= bays; b++) {
      const t = b / bays;
      const cx = -tx + t * tx * 2;
      const cz = -tz + t * tz * 2;
      m.box([cx - 0.16, podium, tz], [cx + 0.16, top, tz + 0.34], MAT.TRIM);
      m.box([cx - 0.16, podium, -tz - 0.34], [cx + 0.16, top, -tz], MAT.TRIM);
      m.box([tx, podium, cz - 0.16], [tx + 0.34, top, cz + 0.16], MAT.TRIM);
      m.box([-tx - 0.34, podium, cz - 0.16], [-tx, top, cz + 0.16], MAT.TRIM);
    }

    // Balcony band every third floor, so the tower has horizontal rhythm too.
    for (let f = 2; f < floors; f += 3) {
      const y = podium + f * floorH;
      m.box([-tx - 0.9, y, -tz - 0.9], [tx + 0.9, y + 0.18, tz + 0.9], MAT.TRIM);
      m.box([-tx - 0.9, y + 0.18, tz + 0.78], [tx + 0.9, y + 1.1, tz + 0.9], MAT.TRIM);
      m.box([-tx - 0.9, y + 0.18, -tz - 0.9], [tx + 0.9, y + 1.1, -tz - 0.78], MAT.TRIM);
    }

    // Crown: parapet, mechanical penthouse, mast. Silhouette, so it stays to
    // medium.
    m.box([-tx - 0.3, top, -tz - 0.3], [tx + 0.3, top + 1.4, tz + 0.3], MAT.TRIM);
    m.box([-tx * 0.55, top, -tz * 0.55], [tx * 0.55, top + 4.2, tz * 0.55], MAT.METAL, { roof: MAT.ROOF });
    m.box([-0.22, top + 4.2, -0.22], [0.22, top + 11, 0.22], MAT.TRIM);
  }

  if (fine) {
    // One continuous glazing band per floor per elevation, rather than
    // individual windows. At 19 floors, three bays a side would be 228
    // openings and four times the triangle budget for detail the fins already
    // supply -- towers read by their vertical grain, not their window count.
    for (let f = 0; f < floors; f++) {
      const y0 = podium + f * floorH + 0.85;
      const y1 = y0 + 1.55;
      for (const [sign, plane] of [[1, tz], [-1, -tz]] as const) {
        m.opening({ axis: 'z', sign, plane, u0: -tx + 0.75, u1: tx - 0.75, y0, y1, glass: MAT.GLASS, frame: 0.09, proud: 0.05 });
      }
      for (const [sign, plane] of [[1, tx], [-1, -tx]] as const) {
        m.opening({ axis: 'x', sign, plane, u0: -tz + 0.75, u1: tz - 0.75, y0, y1, glass: MAT.GLASS, frame: 0.09, proud: 0.05 });
      }
    }
    // Podium glazing.
    for (const [sign, plane] of [[1, z], [-1, -z]] as const) {
      m.windowRow({ axis: 'z', sign, plane, from: -x + 1.0, to: x - 1.0, y0: 1.0, y1: 3.6, count: 4, width: 2.2, glass: MAT.SHOPFRONT, frame: 0.11, proud: 0.08 });
    }

  }
  return m;
}

// ------------------------------------------------------------------- exports

const power = (households: number): number => households * 1.6;

export const RESIDENTIAL: AssetDef[] = [
  {
    id: 'res.low.shaded', name: 'Detached house', zone: 'residential', density: 'low',
    variant: 'shaded', footprint: [2, 2], height: 9.7,
    sim: { households: 1, powerKW: power(1), waterM3: 0.6, garbagePerWeek: 12, pollution: 0, upkeep: 6 },
    note: 'Box, gable, chimney. Brick coursework, windows and door are all shader.',
    build: lowShaded,
  },
  {
    id: 'res.low.sculpted', name: 'Detached house, modelled', zone: 'residential', density: 'low',
    variant: 'sculpted', footprint: [2, 2], height: 10.4,
    sim: { households: 1, powerKW: power(1), waterM3: 0.6, garbagePerWeek: 12, pollution: 0, upkeep: 7 },
    note: 'Garage wing, eaves, porch, dormers, window reveals — the same house with the detail built.',
    build: lowSculpted,
  },
  {
    id: 'res.mid.shaded', name: 'Apartment block', zone: 'residential', density: 'medium',
    variant: 'shaded', footprint: [2, 2], height: 16.3,
    sim: { households: 24, powerKW: power(24), waterM3: 14, garbagePerWeek: 260, pollution: 1, upkeep: 48 },
    note: 'Slab and a parapet. Every window and floor line is drawn by the shader.',
    build: mediumShaded,
  },
  {
    id: 'res.mid.sculpted', name: 'Apartment block, balconied', zone: 'residential', density: 'medium',
    variant: 'sculpted', footprint: [2, 2], height: 18.5,
    sim: { households: 24, powerKW: power(24), waterM3: 14, garbagePerWeek: 260, pollution: 1, upkeep: 54 },
    note: 'Balconies on all four elevations, a masonry base, stair core and roof plant.',
    build: mediumSculpted,
  },
  {
    id: 'res.high.shaded', name: 'Residential tower', zone: 'residential', density: 'high',
    variant: 'shaded', footprint: [3, 3], height: 63,
    sim: { households: 180, powerKW: power(180), waterM3: 96, garbagePerWeek: 1900, pollution: 2, upkeep: 340 },
    note: 'Podium, setback, tower, parapet. Four boxes.',
    build: highShaded,
  },
  {
    id: 'res.high.sculpted', name: 'Residential tower, finned', zone: 'residential', density: 'high',
    variant: 'sculpted', footprint: [3, 3], height: 79,
    sim: { households: 180, powerKW: power(180), waterM3: 96, garbagePerWeek: 1900, pollution: 2, upkeep: 380 },
    note: 'Vertical fins the full height, balcony bands every third floor, crown and mast.',
    build: highSculpted,
  },
];

/** Kept for per-asset jitter once these are placed in the world. */
export const assetJitter = (id: string, salt: number): number =>
  hash2(id.length, id.charCodeAt(0) + id.charCodeAt(id.length - 1), salt);
