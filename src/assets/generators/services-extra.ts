/**
 * A second building for each of the nine service branches.
 *
 * Three or four buildings per branch was enough to prove the vocabulary and
 * not enough to build a city with: a district gets one fire station and one
 * school and then repeats them. These nine are deliberately the *other* kind
 * of thing each branch owns -- the training ground rather than the station,
 * the pumping station rather than the works, the lido rather than the park --
 * so a district can have two of a branch without having the same building
 * twice.
 *
 * Same rule as the rest of the services: no brick, no tiles, no house wall, no
 * pitched domestic roof. The asset test fails any service asset that uses one.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import { parkedVehicle } from './vehicles';
import type { Vec3 } from '../mesh';
import type { Wall } from '../parts';
import {
  band, boxSign, dressRoof, entrance, fins, kerb, louvres, parapet,
  railing, ribbon, roofClutter, serviceYard,
} from '../parts';

// -------------------------------------------------------------- shared parts

/** A stack of ribbon windows, one per floor. The service glazing idiom. */
function ribbonStack(m: MeshBuilder, w: Wall, u0: number, u1: number, o: {
  floors: number; floorH: number; base: number; height: number;
}): void {
  for (let f = 0; f < o.floors; f++) {
    ribbon(m, w, u0, u1, o.base + f * o.floorH, o.base + f * o.floorH + o.height,
      { mullions: Math.max(2, Math.round((u1 - u0) / 2.4)) });
  }
}

/** A caged ladder up the side of something. */
function ladder(m: MeshBuilder, cx: number, cz: number, y0: number, y1: number): void {
  m.painted(TINT.METAL_DARK, () => {
    for (const dz of [-0.28, 0.28]) {
      m.box([cx - 0.05, y0, cz + dz - 0.04], [cx + 0.05, y1, cz + dz + 0.04], MAT.TRIM);
    }
    for (let y = y0 + 0.3; y < y1; y += 0.35) {
      m.box([cx - 0.04, y, cz - 0.28], [cx + 0.04, y + 0.05, cz + 0.28], MAT.TRIM);
    }
    // The hoop cage, which is the thing that makes it read as industrial
    // access rather than as a garden ladder leaning on a wall.
    for (let y = y0 + 2.4; y < y1; y += 0.9) {
      m.box([cx + 0.1, y, cz - 0.42], [cx + 0.72, y + 0.07, cz + 0.42], MAT.TRIM);
      for (const dz of [-0.42, 0.36]) {
        m.box([cx + 0.64, y, cz + dz], [cx + 0.72, y + 0.07, cz + dz + 0.06], MAT.TRIM);
      }
    }
  });
}

/** A run of large-bore pipe with flanges at the joints. */
function pipeRun(m: MeshBuilder, a: [number, number, number], b: [number, number, number],
  r: number, flanges = 3): void {
  m.pipe(a, b, r, MAT.METAL);
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 1; i <= flanges; i++) {
      const t = i / (flanges + 1);
      const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      m.box([p[0] - (a[0] === b[0] ? r * 1.3 : 0.06), p[1] - r * 1.3, p[2] - (a[2] === b[2] ? r * 1.3 : 0.06)],
            [p[0] + (a[0] === b[0] ? r * 1.3 : 0.06), p[1] + r * 1.3, p[2] + (a[2] === b[2] ? r * 1.3 : 0.06)],
        MAT.TRIM);
    }
  });
}

/** A mast with a platform of aerials on top. */
function mast(m: MeshBuilder, cx: number, cz: number, h: number): void {
  m.painted(TINT.METAL_DARK, () => {
    const r = 0.55;
    for (const [dx, dz] of [[-r, -r], [r, -r], [-r, r], [r, r]] as const) {
      m.box([cx + dx - 0.07, 0, cz + dz - 0.07], [cx + dx + 0.07, h, cz + dz + 0.07], MAT.TRIM);
    }
    for (let y = 1.0; y < h; y += 1.6) {
      m.box([cx - r - 0.07, y, cz - r - 0.07], [cx + r + 0.07, y + 0.09, cz + r + 0.07], MAT.TRIM);
    }
    m.box([cx - 1.1, h, cz - 1.1], [cx + 1.1, h + 0.12, cz + 1.1], MAT.TRIM);
    for (const [dx, dz] of [[-0.8, 0], [0.8, 0], [0, -0.8], [0, 0.8]] as const) {
      m.box([cx + dx - 0.12, h + 0.12, cz + dz - 0.12], [cx + dx + 0.12, h + 1.9, cz + dz + 0.12], MAT.TRIM);
    }
  });
  m.painted(TINT.SIGN_LIT, () => m.box([cx - 0.18, h + 1.9, cz - 0.18], [cx + 0.18, h + 2.2, cz + 0.18], MAT.TRIM));
}

// ==================================================================== safety

/** Fire training ground: a burn house, a drill tower and a hydrant yard. */
function fireTraining(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 22.0, z = 18.0;

  m.box([-x, 0.0005, -z], [x, 0.1, z], MAT.CONCRETE);
  // Burn house: a scorched concrete shell with openings and no glazing at all.
  m.box([-x + 3.0, 0.1, -z + 3.0], [-x + 15.0, 8.4, -z + 12.0], MAT.CONCRETE, { roof: MAT.ROOF });
  // Drill tower: five floors of open balconies to jump and abseil from.
  m.box([x - 9.0, 0.1, -z + 3.0], [x - 2.0, 19.0, -z + 10.0], MAT.CONCRETE, { roof: MAT.ROOF });

  if (medium) {
    parapet(m, -x + 3.0, -z + 3.0, -x + 15.0, -z + 12.0, 8.4, 1.0, 0.3);
    parapet(m, x - 9.0, -z + 3.0, x - 2.0, -z + 10.0, 19.0, 1.4, 0.34);
    for (let f = 1; f <= 4; f++) {
      const y = f * 3.8;
      m.box([x - 9.6, y - 0.24, -z + 2.4], [x - 1.4, y, -z + 10.6], MAT.CONCRETE);
      railing(m, x - 9.6, x - 1.4, -z + 10.6, y, 1.1, 1.3);
      railing(m, x - 9.6, x - 1.4, -z + 2.4, y, 1.1, 1.3);
    }
    ladder(m, x - 1.6, -z + 6.5, 0.1, 19.0);
    // Rig: a car and a tank to practise on, in the middle of the yard.
    m.painted(TINT.METAL_DARK, () => {
      m.box([-3.0, 0.1, z - 9.0], [1.6, 1.5, z - 6.4], MAT.TRIM);
      m.box([-2.0, 1.5, z - 8.8], [0.6, 2.4, z - 6.6], MAT.TRIM);
      for (const [cx, cz] of [[-2.4, z - 8.6], [1.0, z - 8.6], [-2.4, z - 6.8], [1.0, z - 6.8]] as const) {
        m.cylinder(cx, cz, 0.42, 0.1, 0.9, 10, MAT.TRIM, true);
      }
    });
    m.cylinder(7.0, z - 7.0, 2.0, 0.1, 4.6, 14, MAT.METAL, false);
    m.cone(7.0, z - 7.0, 2.0, 0.6, 4.6, 5.8, 14, MAT.METAL);
  }
  if (fine) {
    // Openings in the burn house: square holes, no frames, deliberately blind.
    for (const [wall, u0, u1, n] of [
      [{ axis: 'z', sign: 1, plane: -z + 12.0 } as Wall, -x + 4.0, -x + 14.0, 3],
      [{ axis: 'x', sign: -1, plane: -x + 3.0 } as Wall, -z + 4.0, -z + 11.0, 2],
    ] as const) {
      for (let f = 0; f < 2; f++) {
        for (let i = 0; i < n; i++) {
          const c = u0 + ((i + 0.5) / n) * (u1 - u0);
          m.opening({ axis: wall.axis, sign: wall.sign, plane: wall.plane,
            u0: c - 0.8, u1: c + 0.8, y0: 1.2 + f * 3.8, y1: 3.4 + f * 3.8,
            glass: MAT.CONCRETE, frame: 0.22, proud: 0.1 });
        }
      }
    }
    // Hose drying rack, hydrants and a hard-standing grid.
    m.painted(TINT.METAL_DARK, () => {
      for (const cx of [-8.0, -4.0]) {
        m.box([cx - 0.12, 0.1, z - 3.4], [cx + 0.12, 9.0, z - 3.16], MAT.TRIM);
      }
      m.box([-8.2, 8.8, z - 3.4], [-3.8, 9.0, z - 3.16], MAT.TRIM);
      for (let i = 0; i < 5; i++) {
        const cx = -13.0 + i * 6.0;
        m.cylinder(cx, z - 1.4, 0.16, 0.1, 0.85, 8, MAT.TRIM, true);
        m.box([cx - 0.34, 0.55, z - 1.55], [cx + 0.34, 0.75, z - 1.25], MAT.TRIM);
      }
    });
    ribbonStack(m, { axis: 'z', sign: 1, plane: -z + 10.0 }, x - 8.0, x - 3.0,
      { floors: 1, floorH: 4, base: 1.4, height: 1.6 });
    entrance(m, { axis: 'z', sign: 1, plane: -z + 10.0 }, x - 5.5,
      { width: 1.6, height: 2.6, double: true, steps: 1 });
    boxSign(m, { axis: 'z', sign: 1, plane: -z + 12.0 }, -x + 5.0, -x + 13.0, 6.0, 7.4);
    serviceYard(m, -x + 3.0, -x + 15.0, z - 12.0, 1301, { flag: true, bins: false });
    kerb(m, -x, z, x, z + 0.4);
  }
  dressRoof(m, lod, 1303, { density: 0.5 });
  return m;
}

/** Traffic control: a mast farm over a low operations block and vehicle bays. */
function trafficUnit(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 20.0, z = 16.0;
  const w = 26.0, d = 13.0, floors = 2, floorH = 4.0;
  const h = floors * floorH;

  m.box([-x, 0.0005, -z], [x, 0.1, z], MAT.CONCRETE);
  m.box([-w / 2, 0.1, -z + 2.0], [w / 2, h, -z + 2.0 + d], MAT.CLADDING, { roof: MAT.ROOF });

  if (medium) {
    parapet(m, -w / 2, -z + 2.0, w / 2, -z + 2.0 + d, h, 1.0, 0.32);
    band(m, -w / 2, -z + 2.0, w / 2, -z + 2.0 + d, floorH - 0.5, 0.5, 0.24, MAT.CONCRETE);
    // Two masts and a dish gantry: this branch watches the whole road network.
    mast(m, -w / 2 + 2.5, -z + 4.5, 22.0);
    mast(m, w / 2 - 2.5, -z + 4.5, 16.0);
    // Covered bays for the patrol cars, off the far end.
    m.box([-x + 2.0, 0.1, z - 9.0], [x - 2.0, 4.4, z - 8.2], MAT.CONCRETE);
    m.box([-x + 2.4, 4.4, z - 9.4], [x - 2.4, 4.9, z - 1.4], MAT.METAL);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 5; i++) {
        const px = -x + 2.4 + i * ((2 * x - 4.8) / 5);
        m.box([px - 0.16, 0.1, z - 2.0], [px + 0.16, 4.4, z - 1.4], MAT.TRIM);
      }
    });
  }
  if (fine) {
    for (const [wall, u0, u1] of [
      [{ axis: 'z', sign: 1, plane: -z + 2.0 + d } as Wall, -w / 2 + 1.0, w / 2 - 1.0],
      [{ axis: 'z', sign: -1, plane: -z + 2.0 } as Wall, -w / 2 + 1.0, w / 2 - 1.0],
    ] as const) {
      ribbonStack(m, wall, u0, u1, { floors, floorH, base: 1.4, height: 2.2 });
    }
    fins(m, { axis: 'z', sign: 1, plane: -z + 2.0 + d }, -w / 2 + 1.0, w / 2 - 1.0, 0.1, h - 0.5, 9, 0.42);
    entrance(m, { axis: 'z', sign: 1, plane: -z + 2.0 + d }, 0,
      { width: 2.6, height: 3.2, double: true, glazed: true, canopy: 2.4 });
    boxSign(m, { axis: 'z', sign: 1, plane: -z + 2.0 + d }, -4.4, 4.4, h - 2.0, h - 0.8);
    // Patrol cars under the canopy, each its own colour off its own key.
    for (let i = 0; i < 4; i++) {
      const cx = -x + 5.0 + i * 6.5;
      parkedVehicle(m, 3200 + i * 17, cx, z - 5.4, 3, 'car');
      m.painted(TINT.SIGN_LIT, () =>
        m.box([cx - 0.9, 1.52, z - 5.9], [cx + 0.9, 1.72, z - 5.4], MAT.TRIM));
    }
    railing(m, -x, x, z, 0.1, 2.0, 1.6);
    // Gantry over the approach carrying two matrix signs: this unit's job.
    m.painted(TINT.METAL_DARK, () => {
      for (const sx of [-1, 1] as const) {
        for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]] as const) {
          m.box([sx * 12.0 + dx - 0.08, 0.1, 6.0 + dz - 0.08],
                [sx * 12.0 + dx + 0.08, 6.6, 6.0 + dz + 0.08], MAT.TRIM);
        }
      }
      for (let i = 0; i <= 8; i++) {
        const px = -12.0 + i * 3.0;
        m.box([px - 0.09, 6.6, 5.6], [px + 0.09, 7.4, 6.4], MAT.TRIM);
      }
      m.box([-12.4, 7.4, 5.5], [12.4, 7.7, 6.5], MAT.TRIM);
      m.box([-12.4, 6.4, 5.5], [12.4, 6.6, 6.5], MAT.TRIM);
    });
    for (const cx of [-6.0, 6.0]) {
      m.painted(TINT.METAL_DARK, () => m.box([cx - 3.2, 4.6, 5.7], [cx + 3.2, 6.5, 6.3], MAT.TRIM));
      m.painted(TINT.SIGN_LIT, () => m.box([cx - 3.0, 4.8, 5.62], [cx + 3.0, 6.3, 5.72], MAT.TRIM));
    }
    // Cones and bollards stacked in the yard, and lane markings on the apron.
    m.painted(TINT.ACCENT, () => {
      for (let i = 0; i < 12; i++) {
        m.cone(-x + 4.0 + (i % 6) * 0.8, -z + 15.0 + Math.floor(i / 6) * 0.9, 0.28, 0.06,
          0.1, 0.85, 6, MAT.TRIM);
      }
      for (let i = 0; i < 5; i++) {
        const px = -x + 5.0 + i * 6.5;
        m.box([px - 0.08, 0.1, z - 8.0], [px + 0.08, 0.13, z - 2.4], MAT.TRIM);
      }
    });
    serviceYard(m, -w / 2, w / 2, -z + 2.0 + d, 1311, { flag: true });
    kerb(m, -x, z, x, z + 0.4);
  }
  dressRoof(m, lod, 1313);
  return m;
}

// ==================================================================== health

/** Pathology lab: a blind clad box on a plant deck, with a flue bank. */
function pathologyLab(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 20.0, z = 15.0;
  const w = 28.0, d = 18.0, floors = 3, floorH = 4.2;
  const h = floors * floorH;

  m.box([-w / 2, 0, -d / 2], [w / 2, 1.6, d / 2], MAT.CONCRETE);
  m.box([-w / 2 + 0.8, 1.6, -d / 2 + 0.8], [w / 2 - 0.8, h, d / 2 - 0.8], MAT.CLADDING,
    { roof: MAT.ROOF });

  if (medium) {
    parapet(m, -w / 2 + 0.8, -d / 2 + 0.8, w / 2 - 0.8, d / 2 - 0.8, h, 1.2, 0.34);
    for (let f = 1; f < floors; f++) {
      band(m, -w / 2 + 0.8, -d / 2 + 0.8, w / 2 - 0.8, d / 2 - 0.8, 1.6 + f * floorH - 0.5,
        0.5, 0.26, MAT.CONCRETE);
    }
    // Flue bank: a lab is defined by what it has to vent.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 6; i++) {
        const cx = -6.0 + i * 2.4;
        m.cylinder(cx, -d / 2 + 4.0, 0.34, h, h + 5.0 - (i % 2) * 1.2, 8, MAT.TRIM, false);
      }
      m.box([-6.8, h, -d / 2 + 3.0], [6.8, h + 1.4, -d / 2 + 5.0], MAT.TRIM);
    });
    // Louvred plant enclosure on the roof.
    m.box([2.0, h, 0.0], [11.0, h + 3.4, 6.0], MAT.METAL);
    louvres(m, { axis: 'z', sign: 1, plane: 6.0 }, 2.4, 10.6, h + 0.4, h + 3.0, 0.34);
    louvres(m, { axis: 'x', sign: 1, plane: 11.0 }, 0.4, 5.6, h + 0.4, h + 3.0, 0.34);
  }
  if (fine) {
    // Narrow ribbon slots only: a lab does not want daylight in most of it.
    for (const [wall, u0, u1] of [
      [{ axis: 'z', sign: 1, plane: d / 2 - 0.8 } as Wall, -w / 2 + 2.0, w / 2 - 2.0],
      [{ axis: 'z', sign: -1, plane: -d / 2 + 0.8 } as Wall, -w / 2 + 2.0, w / 2 - 2.0],
      [{ axis: 'x', sign: 1, plane: w / 2 - 0.8 } as Wall, -d / 2 + 2.0, d / 2 - 2.0],
    ] as const) {
      for (let f = 0; f < floors; f++) {
        ribbon(m, wall, u0, u1, 1.6 + f * floorH + 2.3, 1.6 + f * floorH + 3.3, { mullions: 9 });
      }
    }
    fins(m, { axis: 'z', sign: 1, plane: d / 2 - 0.8 }, -w / 2 + 2.0, w / 2 - 2.0, 1.6, h - 0.6, 10, 0.5);
    // Entrance: a glazed slot cut into the plinth, under a deep cantilever.
    m.box([-5.4, 0, d / 2 - 0.8], [5.4, 4.6, d / 2 + 2.2], MAT.GLASS, { roof: MAT.TRIM });
    m.box([-6.4, 4.6, d / 2 - 1.4], [6.4, 5.3, d / 2 + 3.4], MAT.CONCRETE);
    entrance(m, { axis: 'z', sign: 1, plane: d / 2 + 2.2 }, 0,
      { width: 3.0, height: 3.2, double: true, glazed: true, steps: 1 });
    boxSign(m, { axis: 'z', sign: 1, plane: d / 2 + 2.2 }, -4.6, 4.6, 3.6, 4.5);
    // Gas cylinder store and a bunded tank at the back, both caged.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 8; i++) {
        m.cylinder(-11.0 + i * 0.7, -d / 2 - 2.4, 0.22, 0, 1.5, 8, MAT.TRIM, true);
      }
      for (let i = 0; i <= 10; i++) {
        const px = -12.0 + i * 0.75;
        m.box([px - 0.05, 0, -d / 2 - 3.4], [px + 0.05, 2.2, -d / 2 - 3.3], MAT.TRIM);
      }
      m.box([-12.0, 2.1, -d / 2 - 3.4], [-4.5, 2.2, -d / 2 - 1.4], MAT.TRIM);
    });
    serviceYard(m, -w / 2, -2.0, -d / 2 - 4.0, 1321, { flag: false });
    kerb(m, -x, z, x, z + 0.4);
  }
  dressRoof(m, lod, 1323, { density: 0.7 });
  return m;
}

// ================================================================= education

/** Nursery: a single-storey ring of rooms round a covered play yard. */
function nursery(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 17.0, z = 13.0;
  const wall = 3.6;

  m.box([-x, 0.0005, -z], [x, 0.06, z], MAT.CONCRETE);
  // An L of rooms, with the yard in the crook of it.
  m.box([-x + 1.0, 0.06, -z + 1.0], [x - 1.0, wall, -z + 8.0], MAT.CLADDING);
  m.box([-x + 1.0, 0.06, -z + 8.0], [-x + 8.0, wall, z - 1.0], MAT.CLADDING);

  if (medium) {
    // A single folded roof plane over both wings, rather than a flat lid.
    m.quad([-x + 1.0, wall + 1.9, -z + 0.6], [x - 1.0, wall + 1.9, -z + 0.6],
           [x - 1.0, wall + 0.3, -z + 8.6], [-x + 1.0, wall + 0.3, -z + 8.6], MAT.METAL);
    m.quad([-x + 0.6, wall + 1.9, -z + 8.0], [-x + 0.6, wall + 0.3, z - 1.0],
           [-x + 8.4, wall + 0.3, z - 1.0], [-x + 8.4, wall + 1.9, -z + 8.0], MAT.METAL);
    m.box([-x + 0.6, wall + 1.75, -z + 0.2], [x - 0.6, wall + 2.0, -z + 1.0], MAT.CONCRETE);
    // The covered play deck: a canopy on bright posts, which is the whole idea.
    m.box([-x + 8.0, 2.9, -z + 8.0], [x - 3.0, 3.2, z - 4.0], MAT.METAL);
    m.painted(TINT.ACCENT, () => {
      for (let i = 0; i < 4; i++) {
        const px = -x + 10.0 + i * 5.0;
        m.box([px - 0.14, 0.06, z - 4.4], [px + 0.14, 2.9, z - 4.12], MAT.TRIM);
      }
    });
    m.painted(TINT.GREEN, () =>
      m.box([-x + 9.0, 0.06, z - 3.6], [x - 2.0, 0.16, z - 1.2], MAT.TRIM));
  }
  if (fine) {
    // Big low windows: a nursery's glazing starts at knee height.
    ribbon(m, { axis: 'z', sign: 1, plane: -z + 8.0 }, -x + 2.0, x - 9.0, 0.6, 2.6, { mullions: 12 });
    ribbon(m, { axis: 'z', sign: -1, plane: -z + 1.0 }, -x + 2.0, x - 2.0, 0.9, 2.4, { mullions: 16 });
    ribbon(m, { axis: 'x', sign: 1, plane: -x + 8.0 }, -z + 9.0, z - 2.0, 0.6, 2.6, { mullions: 10 });
    ribbon(m, { axis: 'x', sign: -1, plane: -x + 1.0 }, -z + 9.0, z - 2.0, 0.9, 2.3, { mullions: 9 });
    entrance(m, { axis: 'z', sign: 1, plane: -z + 8.0 }, x - 5.0,
      { width: 1.8, height: 2.4, double: true, glazed: true, canopy: 2.0 });
    boxSign(m, { axis: 'z', sign: 1, plane: -z + 8.0 }, x - 8.6, x - 2.6, 2.9, 3.5);
    // Play equipment under the canopy, and a fenced boundary with a gate.
    m.painted(TINT.ACCENT, () => {
      m.box([-2.0, 0.16, z - 3.2], [2.6, 0.5, z - 2.0], MAT.TRIM);
      for (const cx of [4.0, 6.4]) m.box([cx - 0.5, 0.16, z - 3.0], [cx + 0.5, 1.1, z - 2.2], MAT.TRIM);
    });
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 18; i++) {
        const t = i / 18;
        const px = -x + 0.5 + t * (2 * x - 1.0);
        if (px > -4.0 && px < -0.5) continue;
        m.box([px - 0.05, 0.06, z - 0.6], [px + 0.05, 1.5, z - 0.5], MAT.TRIM);
      }
      m.box([-x + 0.5, 1.4, z - 0.62], [x - 0.5, 1.5, z - 0.48], MAT.TRIM);
      // Wheeled bin store and a buggy shelter by the door.
      m.box([x - 8.0, 0.06, -z + 8.4], [x - 4.4, 2.2, -z + 10.2], MAT.TRIM);
      // Buggy racks under it.
      for (let i = 0; i < 5; i++) {
        const px = x - 7.6 + i * 0.8;
        m.box([px - 0.04, 0.06, -z + 8.8], [px + 0.04, 0.8, -z + 8.88], MAT.TRIM);
        m.box([px - 0.04, 0.74, -z + 8.8], [px + 0.04, 0.8, -z + 9.8], MAT.TRIM);
      }
    });
    // Rooflights along the ridge of the folded plane.
    for (let i = 0; i < 5; i++) {
      const px = -x + 4.0 + i * 5.5;
      m.painted(TINT.METAL_DARK, () =>
        m.box([px - 1.1, wall + 1.86, -z + 1.4], [px + 1.1, wall + 2.06, -z + 3.0], MAT.TRIM));
      m.box([px - 1.0, wall + 2.04, -z + 1.5], [px + 1.0, wall + 2.2, -z + 2.9], MAT.GLASS);
    }
    // Sandpit, planters and a painted track on the yard.
    m.painted(TINT.WOOD, () => {
      for (const [a, b] of [[-1.6, 1.6]] as const) {
        m.box([a - 2.4, 0.06, z - 8.6], [b + 2.4, 0.5, z - 8.2], MAT.TRIM);
        m.box([a - 2.4, 0.06, z - 5.8], [b + 2.4, 0.5, z - 5.4], MAT.TRIM);
        m.box([a - 2.4, 0.06, z - 8.6], [a - 2.0, 0.5, z - 5.4], MAT.TRIM);
        m.box([b + 2.0, 0.06, z - 8.6], [b + 2.4, 0.5, z - 5.4], MAT.TRIM);
      }
      for (let i = 0; i < 4; i++) {
        const px = -x + 10.0 + i * 3.0;
        m.box([px, 0.06, -z + 10.5], [px + 1.4, 0.7, -z + 11.9], MAT.TRIM);
      }
    });
    m.painted(TINT.GREEN, () => {
      for (let i = 0; i < 4; i++) {
        const px = -x + 10.2 + i * 3.0;
        m.box([px, 0.7, -z + 10.7], [px + 1.0, 1.15, -z + 11.7], MAT.TRIM);
      }
      // A hedge along the garden edge, which is what actually screens a
      // nursery yard from the street.
      for (let i = 0; i < 16; i++) {
        const px = -x + 1.4 + i * 2.0;
        m.box([px, 0.06, z - 2.3], [px + 1.7, 1.3 + (i % 3) * 0.12, z - 1.1], MAT.TRIM);
      }
    });
    m.painted(TINT.ACCENT, () => {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        m.box([8.0 + Math.cos(a) * 4.6 - 0.35, 0.16, z - 6.0 + Math.sin(a) * 3.0 - 0.35],
              [8.0 + Math.cos(a) * 4.6 + 0.35, 0.19, z - 6.0 + Math.sin(a) * 3.0 + 0.35], MAT.TRIM);
      }
    });
    // A second fenced side, a bin store and a low retaining edge to the garden.
    m.painted(TINT.METAL_DARK, () => {
      for (const sx of [-1, 1] as const) {
        for (let i = 0; i <= 12; i++) {
          const pz = -z + 1.0 + (i / 12) * (2 * z - 2.0);
          m.box([sx * (x - 0.6) - 0.05, 0.06, pz - 0.05], [sx * (x - 0.6) + 0.05, 1.5, pz + 0.05],
            MAT.TRIM);
        }
        m.box([sx * (x - 0.62), 1.4, -z + 1.0], [sx * (x - 0.58), 1.5, z - 0.5], MAT.TRIM);
      }
    });
    for (let i = 0; i < 6; i++) {
      const px = -x + 10.0 + i * 2.2;
      m.box([px, 0.06, z - 10.4], [px + 1.6, 0.36, z - 9.0], MAT.CONCRETE);
    }
    m.painted(TINT.ACCENT, () => {
      // Sun sail posts over the sandpit.
      for (const [px, pz] of [[-4.4, z - 9.0], [4.4, z - 9.0], [-4.4, z - 5.0], [4.4, z - 5.0]] as const) {
        m.box([px - 0.12, 0.06, pz - 0.12], [px + 0.12, 3.4, pz + 0.12], MAT.TRIM);
      }
      m.box([-4.6, 3.3, z - 9.2], [4.6, 3.46, z - 4.8], MAT.TRIM);
      // Trellis battens across the play deck, so the canopy is not a slab.
      for (let i = 0; i < 14; i++) {
        const px = -x + 8.6 + i * 1.9;
        m.box([px - 0.07, 3.2, -z + 8.2], [px + 0.07, 3.32, z - 4.2], MAT.TRIM);
      }
    });
    m.painted(TINT.WOOD, () => {
      // A row of storage lockers along the back of the yard.
      for (let i = 0; i < 6; i++) {
        const px = -x + 9.5 + i * 2.1;
        m.box([px, 0.06, -z + 12.6], [px + 1.8, 1.9, -z + 13.8], MAT.TRIM);
        m.box([px - 0.08, 1.9, -z + 12.5], [px + 1.88, 2.06, -z + 13.9], MAT.TRIM);
      }
    });
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

// ===================================================================== water

/** Pumping station: a valve hall over a wet well, with exposed pipework. */
function pumpingStation(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 18.0, z = 15.0;
  const w = 20.0, d = 14.0, hall = 9.0;

  m.box([-x, 0.0005, -z], [x, 0.1, z], MAT.CONCRETE);
  m.box([-w / 2, 0.1, -d / 2], [w / 2, hall, d / 2], MAT.CONCRETE, { roof: MAT.ROOF });
  // Wet well: a big drum half out of the ground beside the hall.
  m.cylinder(x - 6.0, 4.0, 4.4, 0.1, 3.4, 18, MAT.CONCRETE, true);
  m.cylinder(x - 6.0, 4.0, 4.7, 3.4, 4.0, 18, MAT.CONCRETE, true);

  if (medium) {
    parapet(m, -w / 2, -d / 2, w / 2, d / 2, hall, 1.1, 0.34);
    band(m, -w / 2, -d / 2, w / 2, d / 2, 2.2, 0.6, 0.28, MAT.CONCRETE);
    // The pipework, which is the point of the building.
    for (const pz of [-3.4, 0.0, 3.4]) {
      pipeRun(m, [w / 2, 2.4, pz], [x - 8.4, 2.4, pz], 0.42, 3);
      m.pipe([x - 8.4, 2.4, pz], [x - 8.4, 4.4, pz], 0.42, MAT.METAL);
      // A second, smaller main below the first, with its own isolating valve.
      pipeRun(m, [w / 2, 1.1, pz + 0.9], [x - 9.6, 1.1, pz + 0.9], 0.22, 2);
      m.painted(TINT.METAL_DARK, () => {
        m.box([x - 10.0, 0.8, pz + 0.6], [x - 9.4, 1.7, pz + 1.2], MAT.TRIM);
        m.cylinder(x - 9.7, pz + 0.9, 0.34, 1.7, 1.82, 10, MAT.TRIM, true);
      });
    }
    pipeRun(m, [x - 8.4, 4.4, -3.4], [x - 8.4, 4.4, 3.4], 0.42, 2);
    // Valve wheels on risers off the main run.
    m.painted(TINT.METAL_DARK, () => {
      for (const pz of [-3.4, 0.0, 3.4]) {
        m.cylinder(x - 11.0, pz, 0.16, 2.8, 4.0, 8, MAT.TRIM, false);
        m.cylinder(x - 11.0, pz, 0.62, 4.0, 4.14, 12, MAT.TRIM, true);
      }
    });
    railing(m, x - 10.4, x - 1.6, 8.4, 4.0, 1.1, 1.4);
    ladder(m, x - 10.6, 4.0, 0.1, 4.0);
  }
  if (fine) {
    // High clerestory only: a valve hall is lit from above the pipework.
    for (const [sign, plane] of [[1, d / 2], [-1, -d / 2]] as const) {
      ribbon(m, { axis: 'z', sign, plane }, -w / 2 + 1.4, w / 2 - 1.4, hall - 2.6, hall - 0.9,
        { mullions: 7 });
    }
    ribbon(m, { axis: 'x', sign: -1, plane: -w / 2 }, -d / 2 + 1.4, d / 2 - 1.4, hall - 2.6, hall - 0.9,
      { mullions: 5 });
    // A single big access door, sized for a pump.
    m.opening({ axis: 'z', sign: 1, plane: d / 2, u0: -3.0, u1: 3.0, y0: 0.3, y1: 5.0,
      glass: MAT.METAL, frame: 0.3, proud: 0.14 });
    entrance(m, { axis: 'z', sign: 1, plane: d / 2 }, w / 2 - 3.0,
      { width: 1.4, height: 2.4, double: true, steps: 1 });
    boxSign(m, { axis: 'z', sign: 1, plane: d / 2 }, -4.6, 4.6, 5.6, 6.8);
    louvres(m, { axis: 'z', sign: 1, plane: d / 2 }, -8.4, -4.4, 2.6, 4.8, 0.3);
    // Surge vessel and a small transformer compound.
    m.cylinder(-x + 5.0, -z + 5.0, 1.3, 0.1, 6.2, 12, MAT.METAL, false);
    m.cone(-x + 5.0, -z + 5.0, 1.3, 0.3, 6.2, 7.2, 12, MAT.METAL);
    m.box([-x + 2.0, 0.1, z - 7.0], [-x + 8.0, 3.0, z - 2.0], MAT.METAL);
    louvres(m, { axis: 'z', sign: 1, plane: z - 2.0 }, -x + 2.6, -x + 7.4, 0.5, 2.6, 0.3);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        m.box([-x + t * 2 * x - 0.05, 0.1, z - 0.6], [-x + t * 2 * x + 0.05, 2.2, z - 0.5], MAT.TRIM);
      }
      m.box([-x, 2.1, z - 0.62], [x, 2.2, z - 0.48], MAT.TRIM);
    });
    // Access gallery over the wet well, and a run of small-bore pipework and
    // valves down the hall's flank -- the detail that makes it read as plant.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 8; i++) {
        const px = x - 10.6 + i * 1.1;
        m.box([px - 0.07, 0.1, 8.2], [px + 0.07, 4.0, 8.34], MAT.TRIM);
      }
      for (const y of [1.4, 2.8]) {
        m.box([-w / 2 - 0.34, y, -d / 2 + 1.0], [-w / 2 - 0.2, y + 0.14, d / 2 - 1.0], MAT.TRIM);
        for (let i = 0; i < 5; i++) {
          const pz = -d / 2 + 2.0 + i * 2.4;
          m.box([-w / 2 - 0.44, y - 0.2, pz - 0.2], [-w / 2 - 0.1, y + 0.34, pz + 0.2], MAT.TRIM);
        }
      }
      for (let i = 0; i < 4; i++) {
        const pz = -d / 2 + 2.6 + i * 3.0;
        m.cylinder(-w / 2 - 0.7, pz, 0.42, 1.6, 1.74, 10, MAT.TRIM, true);
        m.cylinder(-w / 2 - 0.7, pz, 0.09, 1.4, 1.7, 6, MAT.TRIM, false);
      }
      // Sample kiosk and a flow meter chamber on the apron.
      m.box([-x + 11.0, 0.1, z - 5.0], [-x + 13.4, 2.4, z - 2.6], MAT.TRIM);
      m.box([-4.0, 0.1, z - 5.0], [1.0, 0.4, z - 2.0], MAT.TRIM);
      for (let i = 0; i < 4; i++) {
        m.box([-3.6 + i * 1.2, 0.4, z - 4.6], [-3.0 + i * 1.2, 0.55, z - 2.4], MAT.TRIM);
      }
    });
    kerb(m, -x, z, x, z + 0.4);
  }
  dressRoof(m, lod, 1333, { density: 0.6 });
  return m;
}

// ===================================================================== power

/** Wind: three turbines on a compound with a substation and a spares yard. */
function windFarm(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 24.0, z = 20.0;

  m.painted(TINT.GREEN, () => m.box([-x, 0.0005, -z], [x, 0.08, z], MAT.TRIM));

  /** One turbine: tapered tower, nacelle, hub and three blades. */
  const turbine = (cx: number, cz: number, h: number, spin: number): void => {
    m.cylinder(cx, cz, 2.2, 0, 0.7, 14, MAT.CONCRETE, true);
    m.cone(cx, cz, 1.5, 0.85, 0.7, h, 14, MAT.CONCRETE);
    // Section flanges up the tower: a smooth cone reads as a traffic bollard.
    for (let k = 1; k <= 4; k++) {
      const t = k / 5;
      const r = 1.5 + (0.85 - 1.5) * t;
      m.cylinder(cx, cz, r + 0.12, 0.7 + t * (h - 0.7), 0.7 + t * (h - 0.7) + 0.22, 14,
        MAT.CONCRETE, true);
    }
    // Nacelle, offset off the tower head the way a real one is.
    m.box([cx - 1.0, h, cz - 3.4], [cx + 1.0, h + 1.9, cz + 1.6], MAT.METAL);
    m.cone(cx, cz + 1.6, 1.0, 0.5, h + 0.4, h + 1.5, 10, MAT.METAL);
    m.cylinder(cx, cz + 2.6, 0.75, h + 0.5, h + 1.4, 10, MAT.METAL, true);
    if (!medium) return;
    for (let b = 0; b < 3; b++) {
      const a = spin + (b / 3) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      // Each blade is a solid tapered section, not a pair of quads back to
      // back: a plate has no edge, so from anywhere near end-on a blade
      // vanished into a line.
      const len = h * 0.46;
      for (let k = 0; k < 7; k++) {
        const t0 = k / 7, t1 = (k + 1) / 7;
        const r0 = 1.2 + t0 * len, r1 = 1.2 + t1 * len;
        const c0 = 1.5 * (1 - t0 * 0.8), c1 = 1.5 * (1 - t1 * 0.8);
        const th0 = 0.24 * (1 - t0 * 0.75), th1 = 0.24 * (1 - t1 * 0.75);
        const y0 = h + 0.95 + sa * r0, y1 = h + 0.95 + sa * r1;
        const px0 = cx + ca * r0, px1 = cx + ca * r1;
        const z0 = cz + 2.7, z1 = cz + 2.7;
        // Six faces per segment, built from the two end sections.
        const A: Vec3 = [px0, y0, z0], B: Vec3 = [px1, y1, z1];
        m.quad([A[0], A[1], A[2] - th0], [B[0], B[1], B[2] - th1],
               [B[0], B[1], B[2] + c1], [A[0], A[1], A[2] + c0], MAT.METAL);
        m.quad([A[0] + 0.02, A[1] - 0.02, A[2] + c0], [B[0] + 0.02, B[1] - 0.02, B[2] + c1],
               [B[0] + 0.02, B[1] - 0.02, B[2] - th1], [A[0] + 0.02, A[1] - 0.02, A[2] - th0],
          MAT.METAL);
        // Leading and trailing edges, which is where the thickness shows.
        m.quad([A[0], A[1], A[2] + c0], [B[0], B[1], B[2] + c1],
               [B[0] + 0.02, B[1] - 0.02, B[2] + c1], [A[0] + 0.02, A[1] - 0.02, A[2] + c0],
          MAT.METAL);
        m.quad([A[0] + 0.02, A[1] - 0.02, A[2] - th0], [B[0] + 0.02, B[1] - 0.02, B[2] - th1],
               [B[0], B[1], B[2] - th1], [A[0], A[1], A[2] - th0], MAT.METAL);
      }
    }
  };

  turbine(-14.0, -6.0, 34.0, 0.4);
  turbine(2.0, 4.0, 40.0, 1.9);
  turbine(15.0, -8.0, 30.0, 3.1);
  turbine(-6.0, -16.0, 26.0, 2.4);

  if (medium) {
    // Access tracks, so three towers are not standing in an empty field.
    for (const [cx, cz] of [[-14.0, -6.0], [2.0, 4.0], [15.0, -8.0], [-6.0, -16.0]] as const) {
      m.box([Math.min(cx - 1.6, -1.6), 0.08, Math.min(cz, z - 4.0)],
            [Math.max(cx + 1.6, 1.6), 0.14, Math.max(cz, z - 4.0)], MAT.GROUND);
      // Hardstanding pad and four crane outrigger points at every base.
      m.box([cx - 4.0, 0.08, cz - 4.0], [cx + 4.0, 0.16, cz + 4.0], MAT.GROUND);
      m.painted(TINT.METAL_DARK, () => {
        for (const [dx, dz] of [[-3.2, -3.2], [3.2, -3.2], [-3.2, 3.2], [3.2, 3.2]] as const) {
          m.box([cx + dx - 0.45, 0.16, cz + dz - 0.45], [cx + dx + 0.45, 0.3, cz + dz + 0.45], MAT.TRIM);
        }
      });
    }
    m.box([-x + 2.0, 0.08, z - 5.4], [x - 2.0, 0.14, z - 2.6], MAT.GROUND);
    // Substation compound: transformer, bushings, and the fence round it.
    m.box([-x + 4.0, 0.08, z - 10.0], [-x + 12.0, 4.2, z - 6.0], MAT.METAL);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 3; i++) {
        m.cylinder(-x + 5.6 + i * 2.4, z - 8.0, 0.34, 4.2, 6.4, 8, MAT.TRIM, false);
        m.cylinder(-x + 5.6 + i * 2.4, z - 8.0, 0.7, 6.4, 6.8, 10, MAT.TRIM, true);
      }
    });
  }
  if (fine) {
    // Door and ladder at the base of each tower: they are entered, not sealed.
    for (const [cx, cz] of [[-14.0, -6.0], [2.0, 4.0], [15.0, -8.0], [-6.0, -16.0]] as const) {
      m.painted(TINT.METAL_DARK, () =>
        m.box([cx - 0.5, 0.7, cz + 1.35], [cx + 0.5, 2.5, cz + 1.55], MAT.TRIM));
      m.painted(TINT.SIGN_LIT, () =>
        m.box([cx - 0.35, 2.8, cz + 1.4], [cx + 0.35, 3.3, cz + 1.52], MAT.TRIM));
    }
    louvres(m, { axis: 'z', sign: 1, plane: z - 6.0 }, -x + 4.6, -x + 11.4, 0.6, 3.6, 0.3);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 12; i++) {
        const px = -x + 3.0 + i * 0.85;
        m.box([px - 0.05, 0.08, z - 11.0], [px + 0.05, 2.4, z - 10.9], MAT.TRIM);
        m.box([px - 0.05, 0.08, z - 5.1], [px + 0.05, 2.4, z - 5.0], MAT.TRIM);
      }
      m.box([-x + 3.0, 2.3, z - 11.0], [-x + 13.0, 2.4, z - 10.9], MAT.TRIM);
      m.box([-x + 3.0, 2.3, z - 5.1], [-x + 13.0, 2.4, z - 5.0], MAT.TRIM);
      // Spare blade on trestles: the yard has to hold one somewhere.
      for (const px of [4.0, 12.0]) m.box([px - 0.6, 0.08, z - 4.0], [px + 0.6, 1.2, z - 2.6], MAT.TRIM);
      // Anemometer mast, and a cable trench running back to the substation.
      m.cylinder(-2.0, -z + 4.0, 0.1, 0.08, 14.0, 6, MAT.TRIM, false);
      for (let y = 2.0; y < 14.0; y += 2.0) {
        m.box([-2.5, y, -z + 3.9], [-1.5, y + 0.08, -z + 4.1], MAT.TRIM);
      }
      m.box([-2.9, 14.0, -z + 3.85], [-1.1, 14.14, -z + 4.15], MAT.TRIM);
      for (const [cx, cz] of [[-14.0, -6.0], [2.0, 4.0], [15.0, -8.0]] as const) {
        m.box([Math.min(cx, -x + 8.0), 0.08, Math.min(cz, z - 8.0) ],
              [Math.max(cx, -x + 8.0) , 0.2, Math.min(cz, z - 8.0) + 0.34], MAT.TRIM);
      }
      // Site cabin and a spares container.
      m.box([-x + 15.0, 0.08, z - 6.0], [-x + 21.0, 2.9, z - 3.4], MAT.TRIM);
      for (let i = 0; i < 10; i++) {
        m.box([-x + 15.2 + i * 0.58, 0.08, z - 3.5], [-x + 15.5 + i * 0.58, 2.9, z - 3.4], MAT.TRIM);
      }
    });
    m.box([3.0, 1.2, z - 3.8], [13.0, 1.9, z - 2.8], MAT.METAL);
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

// ================================================================= transport

/** Ferry terminal: a quay, a linkspan and a glazed passenger hall. */
function ferryTerminal(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 26.0, z = 19.0;
  const w = 26.0, d = 13.0, hall = 8.4;

  // The quay: a deck on the land side, water beyond it.
  m.box([-x, 0.0005, -z], [x, 1.6, 2.0], MAT.CONCRETE);
  m.box([-x, 0.0005, 2.0], [x, 0.2, z], MAT.GLASS);
  m.box([-w / 2, 1.6, -z + 3.0], [w / 2, hall, -z + 3.0 + d], MAT.CLADDING, { roof: MAT.ROOF });

  if (medium) {
    parapet(m, -w / 2, -z + 3.0, w / 2, -z + 3.0 + d, hall, 0.9, 0.3);
    // Linkspan: a hinged ramp off the quay, on a counterweight frame.
    m.box([-5.0, 1.6, 2.0], [5.0, 1.9, 9.0], MAT.METAL);
    m.painted(TINT.METAL_DARK, () => {
      for (const sx of [-1, 1] as const) {
        m.box([sx * 5.4 - 0.16, 1.6, 1.6], [sx * 5.4 + 0.16, 11.0, 2.0], MAT.TRIM);
        m.box([sx * 5.4 - 0.16, 10.6, 1.6], [sx * 5.4 + 0.16, 11.0, 8.0], MAT.TRIM);
        for (const pz of [4.0, 6.5, 9.0]) {
          m.box([sx * 5.2 - 0.09, 1.9, pz - 0.09], [sx * 5.2 + 0.09, 2.9, pz + 0.09], MAT.TRIM);
        }
        m.box([sx * 5.2 - 0.1, 2.8, 1.9], [sx * 5.2 + 0.1, 2.9, 9.1], MAT.TRIM);
      }
      m.box([-6.0, 10.6, 6.0], [6.0, 11.4, 8.0], MAT.TRIM);
    });
    // Bollards and fenders along the quay edge.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 9; i++) {
        const px = -x + 3.0 + i * 6.0;
        m.cylinder(px, 1.2, 0.34, 1.6, 2.4, 8, MAT.TRIM, true);
        m.cylinder(px, 1.2, 0.46, 2.4, 2.6, 8, MAT.TRIM, true);
        m.box([px - 0.6, 0.2, 1.9], [px + 0.6, 1.5, 2.2], MAT.TRIM);
      }
    });
  }
  if (fine) {
    // The hall is mostly glass on the quay side: it is a waiting room.
    ribbon(m, { axis: 'z', sign: 1, plane: -z + 3.0 + d }, -w / 2 + 1.2, w / 2 - 1.2, 2.6, 6.6,
      { mullions: 11 });
    ribbon(m, { axis: 'z', sign: -1, plane: -z + 3.0 }, -w / 2 + 1.2, w / 2 - 1.2, 3.2, 5.8,
      { mullions: 9 });
    fins(m, { axis: 'z', sign: 1, plane: -z + 3.0 + d }, -w / 2 + 1.2, w / 2 - 1.2, 1.6, hall - 0.5,
      11, 0.4);
    entrance(m, { axis: 'z', sign: 1, plane: -z + 3.0 + d }, 0,
      { width: 3.2, height: 3.4, double: true, glazed: true, canopy: 3.0 });
    boxSign(m, { axis: 'z', sign: 1, plane: -z + 3.0 + d }, -5.4, 5.4, 6.8, 8.0);
    // Canopy from the hall down to the linkspan, on masts.
    m.box([-6.4, 6.0, -z + 3.0 + d], [6.4, 6.5, 2.4], MAT.METAL);
    m.painted(TINT.METAL_DARK, () => {
      for (const sx of [-1, 1] as const) {
        for (const pz of [-2.0, 1.6]) {
          m.box([sx * 6.0 - 0.13, 1.6, pz - 0.13], [sx * 6.0 + 0.13, 6.0, pz + 0.13], MAT.TRIM);
        }
      }
      // Mooring lines and a lit navigation beacon at the quay head.
      m.cylinder(x - 3.0, 4.0, 0.22, 1.6, 7.4, 8, MAT.TRIM, false);
    });
    m.painted(TINT.SIGN_LIT, () =>
      m.box([x - 3.4, 7.4, 3.6], [x - 2.6, 8.1, 4.4], MAT.TRIM));
    railing(m, -x, x, 1.9, 1.6, 1.15, 1.5);
    serviceYard(m, -w / 2, w / 2, -z + 3.0, 1351, { flag: true, bins: false });
    // Marshalling lanes, a ticket kiosk and a rank of benches on the quay.
    m.painted(TINT.ACCENT, () => {
      for (let i = 0; i < 5; i++) {
        const px = -x + 4.0 + i * 11.0;
        m.box([px - 0.09, 1.6, -z + 3.0 + d], [px + 0.09, 1.64, 0.0], MAT.TRIM);
      }
    });
    m.painted(TINT.METAL_DARK, () => {
      m.box([-x + 3.0, 1.6, -1.4], [-x + 6.4, 4.4, 1.4], MAT.TRIM);
      for (const px of [10.0, 14.0, 18.0]) {
        m.box([px - 1.2, 2.0, -1.0], [px + 1.2, 2.12, -0.4], MAT.TRIM);
        m.box([px - 1.2, 2.12, -1.0], [px + 1.2, 2.7, -0.9], MAT.TRIM);
        for (const dx of [-1.0, 1.0]) {
          m.box([px + dx - 0.07, 1.6, -0.9], [px + dx + 0.07, 2.0, -0.5], MAT.TRIM);
        }
      }
      // Life rings and a rescue ladder set into the quay wall.
      for (let i = 0; i < 4; i++) {
        m.cylinder(-18.0 + i * 12.0, 1.6, 0.42, 2.1, 2.24, 10, MAT.TRIM, true);
      }
    });
    m.box([-x + 3.2, 4.4, -1.6], [-x + 6.6, 4.66, 1.6], MAT.CONCRETE);
    ribbon(m, { axis: 'z', sign: 1, plane: -x + 6.4 }, -1.0, 1.0, 2.6, 3.8);
    kerb(m, -x, -z, x, -z + 0.4);
  }
  dressRoof(m, lod, 1353, { density: 0.6 });
  return m;
}

// ================================================================ government

/** City archive: a blind stone vault on a glazed reading base. */
function archive(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 18.0, z = 15.0;
  const w = 26.0, d = 18.0, base = 5.6, vault = 15.0;
  const h = base + vault;

  m.box([-w / 2 + 1.6, 0, -d / 2 + 1.6], [w / 2 - 1.6, base, d / 2 - 1.6], MAT.GLASS);
  // The vault oversails the base on all four sides: records above, people below.
  m.box([-w / 2, base, -d / 2], [w / 2, h, d / 2], MAT.STONE, { roof: MAT.ROOF });

  if (medium) {
    m.box([-w / 2 - 0.5, base - 0.8, -d / 2 - 0.5], [w / 2 + 0.5, base, d / 2 + 0.5], MAT.STONE);
    parapet(m, -w / 2, -d / 2, w / 2, d / 2, h, 1.5, 0.42);
    // Shallow pilasters the full height of the vault, and nothing else on it.
    for (let i = 0; i <= 9; i++) {
      const px = -w / 2 + (i / 9) * w;
      m.box([px - 0.42, base, d / 2 - 0.28], [px + 0.42, h, d / 2 + 0.28], MAT.STONE);
      m.box([px - 0.42, base, -d / 2 - 0.28], [px + 0.42, h, -d / 2 + 0.28], MAT.STONE);
    }
    for (let i = 0; i <= 6; i++) {
      const pz = -d / 2 + (i / 6) * d;
      m.box([w / 2 - 0.28, base, pz - 0.42], [w / 2 + 0.28, h, pz + 0.42], MAT.STONE);
      m.box([-w / 2 - 0.28, base, pz - 0.42], [-w / 2 + 0.28, h, pz + 0.42], MAT.STONE);
    }
    // Plant screen on the roof: an archive is climate control with a door.
    m.box([-7.0, h, -4.0], [7.0, h + 3.0, 4.0], MAT.METAL);
    louvres(m, { axis: 'z', sign: 1, plane: 4.0 }, -6.4, 6.4, h + 0.4, h + 2.6, 0.32);
    louvres(m, { axis: 'z', sign: -1, plane: -4.0 }, -6.4, 6.4, h + 0.4, h + 2.6, 0.32);
    roofClutter(m, -w / 2 + 3, d / 2 - 7, w / 2 - 3, d / 2 - 2, h, 1361, 0.6);
  }
  if (fine) {
    // Two narrow slots per bay, the only openings the vault gets.
    for (const [sign, plane] of [[1, d / 2], [-1, -d / 2]] as const) {
      for (let i = 0; i < 9; i++) {
        const c = -w / 2 + ((i + 0.5) / 9) * w;
        m.opening({ axis: 'z', sign, plane, u0: c - 0.28, u1: c + 0.28,
          y0: base + 2.6, y1: h - 2.6, glass: MAT.GLASS, frame: 0.18, proud: 0.08 });
      }
    }
    // Reading room: full-height glazing between the base's own columns.
    for (const [sign, plane] of [[1, d / 2 - 1.6], [-1, -d / 2 + 1.6]] as const) {
      ribbon(m, { axis: 'z', sign, plane }, -w / 2 + 2.6, w / 2 - 2.6, 0.9, base - 0.8,
        { mullions: 10 });
    }
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 5; i++) {
        const px = -w / 2 + 2.0 + i * ((w - 4.0) / 5);
        for (const pz of [d / 2 - 1.6, -d / 2 + 1.6]) {
          m.box([px - 0.24, 0, pz - 0.24], [px + 0.24, base, pz + 0.24], MAT.TRIM);
        }
      }
    });
    entrance(m, { axis: 'z', sign: 1, plane: d / 2 - 1.6 }, 0,
      { width: 3.0, height: 3.2, double: true, glazed: true, steps: 2 });
    boxSign(m, { axis: 'z', sign: 1, plane: d / 2 }, -6.0, 6.0, base + 0.6, base + 2.0);
    // Reading tables visible through the glass.
    m.painted(TINT.WOOD, () => {
      for (let i = 0; i < 4; i++) {
        m.box([-9.0 + i * 5.0, 0, -3.0], [-6.0 + i * 5.0, 0.78, 3.0], MAT.TRIM);
      }
    });
    serviceYard(m, -w / 2, w / 2, -d / 2 - 1.0, 1363, { flag: true });
    railing(m, -x + 1.0, x - 1.0, z - 1.0, 0, 1.1, 1.5);
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

// ===================================================================== parks

/** Lido: an open-air pool, a terrace of cabins and a diving platform. */
function lido(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 24.0, z = 18.0;

  m.box([-x, 0.0005, -z], [x, 0.12, z], MAT.CONCRETE);
  // The pool: a sunk tank of water with a tiled surround.
  m.box([-15.0, 0.12, -8.0], [11.0, 0.2, 7.0], MAT.STONE);
  m.box([-14.4, 0.14, -7.4], [10.4, 0.6, 6.4], MAT.GLASS);
  // Changing terrace: a long single-storey range of cabins with a flat roof.
  m.box([-x + 2.0, 0.12, -z + 1.0], [x - 2.0, 3.8, -z + 6.0], MAT.CONCRETE, { roof: MAT.ROOF });

  if (medium) {
    parapet(m, -x + 2.0, -z + 1.0, x - 2.0, -z + 6.0, 3.8, 0.7, 0.26);
    // Colonnade along the front of the cabins.
    m.painted(TINT.ACCENT, () => {
      for (let i = 0; i <= 12; i++) {
        const px = -x + 3.0 + i * ((2 * x - 6.0) / 12);
        m.box([px - 0.26, 0.12, -z + 5.6], [px + 0.26, 3.4, -z + 6.2], MAT.TRIM);
      }
    });
    m.box([-x + 2.4, 3.4, -z + 5.2], [x - 2.4, 3.8, -z + 6.6], MAT.CONCRETE);
    // Diving platform: three levels on a single spine.
    m.box([13.0, 0.12, -3.0], [15.4, 9.0, 1.0], MAT.CONCRETE);
    for (const [y, reach] of [[3.0, 2.4], [5.6, 2.0], [8.6, 1.6]] as const) {
      m.box([13.0 - reach, y - 0.28, -2.6], [13.0, y, 0.6], MAT.CONCRETE);
      railing(m, 13.0 - reach, 13.0, 0.6, y, 1.0, 1.0);
      railing(m, 13.0 - reach, 13.0, -2.6, y, 1.0, 1.0);
    }
    ladder(m, 15.5, -1.0, 0.12, 9.0);
  }
  if (fine) {
    // Cabin doors: a long run of them, which is what a lido terrace is.
    for (let i = 0; i < 11; i++) {
      const c = -x + 4.0 + i * ((2 * x - 8.0) / 10);
      m.opening({ axis: 'z', sign: 1, plane: -z + 6.0, u0: c - 0.5, u1: c + 0.5,
        y0: 0.2, y1: 2.4, glass: MAT.TIMBER, frame: 0.14, proud: 0.07 });
    }
    ribbon(m, { axis: 'z', sign: -1, plane: -z + 1.0 }, -x + 3.0, x - 3.0, 2.6, 3.3, { mullions: 12 });
    entrance(m, { axis: 'z', sign: -1, plane: -z + 1.0 }, 0,
      { width: 2.4, height: 2.8, double: true, glazed: true, canopy: 2.0 });
    boxSign(m, { axis: 'z', sign: -1, plane: -z + 1.0 }, -4.0, 4.0, 3.9, 4.9);
    // Lane ropes on the water, and a rank of sun loungers on the deck.
    m.painted(TINT.ACCENT, () => {
      for (let i = 1; i < 6; i++) {
        const pz = -7.4 + i * (13.8 / 6);
        m.box([-14.4, 0.58, pz - 0.07], [10.4, 0.66, pz + 0.07], MAT.TRIM);
      }
    });
    m.painted(TINT.WOOD, () => {
      for (let i = 0; i < 7; i++) {
        const px = -14.0 + i * 3.6;
        m.box([px, 0.32, 8.4], [px + 0.7, 0.44, 10.4], MAT.TRIM);
        m.box([px, 0.44, 9.9], [px + 0.7, 1.0, 10.3], MAT.TRIM);
      }
    });
    // Lifeguard chair and the fence round the whole site.
    m.painted(TINT.METAL_DARK, () => {
      for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]] as const) {
        m.box([-17.0 + dx - 0.07, 0.12, -0.5 + dz - 0.07], [-17.0 + dx + 0.07, 2.6, -0.5 + dz + 0.07],
          MAT.TRIM);
      }
      m.box([-17.8, 2.6, -1.3], [-16.2, 2.8, 0.3], MAT.TRIM);
      m.box([-17.8, 2.8, -1.3], [-16.2, 3.6, -1.1], MAT.TRIM);
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const px = -x + 0.6 + t * (2 * x - 1.2);
        m.box([px - 0.05, 0.12, z - 0.8], [px + 0.05, 2.0, z - 0.7], MAT.TRIM);
      }
      m.box([-x + 0.6, 1.9, z - 0.82], [x - 0.6, 2.0, z - 0.68], MAT.TRIM);
      // Handrails into the water at four points, and a starting block rank.
      for (let i = 0; i < 4; i++) {
        const pz = -6.0 + i * 4.0;
        for (const dz of [-0.4, 0.4]) {
          m.box([-14.9, 0.2, pz + dz - 0.05], [-14.2, 1.2, pz + dz + 0.05], MAT.TRIM);
        }
        m.box([-14.9, 1.1, pz - 0.45], [-14.2, 1.2, pz + 0.45], MAT.TRIM);
      }
    });
    for (let i = 0; i < 6; i++) {
      const pz = -6.4 + i * 2.6;
      m.box([10.4, 0.2, pz - 0.55], [11.4, 0.85, pz + 0.55], MAT.CONCRETE);
      m.painted(TINT.METAL_DARK, () =>
        m.box([10.5, 0.85, pz - 0.5], [11.3, 0.95, pz + 0.5], MAT.TRIM));
    }
    // Paddling pool and a plant room behind the terrace.
    m.box([-21.0, 0.12, 9.0], [-13.0, 0.2, 15.0], MAT.STONE);
    m.box([-20.5, 0.14, 9.5], [-13.5, 0.42, 14.5], MAT.GLASS);
    m.box([x - 12.0, 0.12, 9.0], [x - 4.0, 3.4, 14.0], MAT.CONCRETE, { roof: MAT.ROOF });
    louvres(m, { axis: 'z', sign: 1, plane: 14.0 }, x - 11.4, x - 4.6, 0.6, 2.8, 0.3);
    parapet(m, x - 12.0, 9.0, x - 4.0, 14.0, 3.4, 0.6, 0.22);
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}


// ======================================================================= parks
//
// Five parks. A park is mostly ground and planting, which makes it the one
// category where the temptation is to place a green rectangle and stop -- so
// each of these is built round one structure with a silhouette (a pergola, a
// boathouse, a bowl, a range of sheds, a bandstand) and the planting is
// arranged by it rather than scattered over it.

/** A tree: a trunk and two stacked crowns, which is enough at city scale. */
function tree(m: MeshBuilder, cx: number, cz: number, h: number, r: number): void {
  m.painted(TINT.WOOD, () => m.cylinder(cx, cz, r * 0.16, 0, h * 0.42, 6, MAT.TIMBER));
  m.painted(TINT.GREEN, () => {
    m.cone(cx, cz, r, r * 0.75, h * 0.34, h * 0.72, 8, MAT.TRIM);
    m.cone(cx, cz, r * 0.78, 0.0, h * 0.66, h, 8, MAT.TRIM);
  });
}

/** A bench: two ends and a slatted seat and back. */
function bench(m: MeshBuilder, cx: number, cz: number, turns: number): void {
  m.placed(cx, cz, turns, () => {
    m.painted(TINT.METAL_DARK, () => {
      for (const sx of [-0.8, 0.8]) {
        m.box([sx - 0.06, 0, -0.24], [sx + 0.06, 0.44, 0.24], MAT.TRIM);
        m.box([sx - 0.06, 0.44, -0.24], [sx + 0.06, 0.92, -0.14], MAT.TRIM);
      }
    });
    m.painted(TINT.WOOD, () => {
      for (const pz of [-0.22, -0.04, 0.14]) m.box([-0.9, 0.44, pz], [0.9, 0.5, pz + 0.14], MAT.TIMBER);
      for (const py of [0.58, 0.74]) m.box([-0.9, py, -0.22], [0.9, py + 0.13, -0.15], MAT.TIMBER);
    });
  });
}

/** A clipped hedge run. */
function hedge(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number, h = 0.9): void {
  m.painted(TINT.GREEN, () => m.box([x0, 0.04, z0], [x1, h, z1], MAT.TRIM));
}

/** Formal garden: a parterre round a fountain, with a pergola on the axis. */
function formalGarden(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const x = 22.0, z = 18.0;

  m.painted(TINT.GREEN, () => m.box([-x, 0.001, -z], [x, 0.06, z], MAT.TRIM));
  // Gravel walks: a cross axis and a perimeter, which is what makes it formal.
  m.box([-x, 0.02, -1.6], [x, 0.08, 1.6], MAT.GROUND);
  m.box([-1.6, 0.02, -z], [1.6, 0.08, z], MAT.GROUND);
  m.box([-x, 0.02, -z], [x, 0.08, -z + 1.4], MAT.GROUND);
  m.box([-x, 0.02, z - 1.4], [x, 0.08, z], MAT.GROUND);

  // Fountain on the crossing: basin, bowl and a jet.
  m.cylinder(0, 0, 3.4, 0.08, 0.62, 16, MAT.STONE);
  m.cylinder(0, 0, 3.0, 0.5, 0.56, 16, MAT.GLASS);
  m.cylinder(0, 0, 0.55, 0.56, 1.5, 12, MAT.STONE);
  m.cone(0, 0, 1.5, 0.3, 1.5, 2.1, 12, MAT.STONE);
  m.cylinder(0, 0, 0.14, 2.1, 3.1, 8, MAT.GLASS);

  if (medium) {
    // Pergola across the far end: the one piece of structure in the garden.
    const py = 3.2;
    for (const sz of [-1, 1] as const) {
      for (let i = 0; i <= 7; i++) {
        const px = -10.5 + i * 3.0;
        m.cylinder(px, sz * (z - 4.5), 0.28, 0, py, 10, MAT.STONE);
      }
      m.box([-11.0, py, sz * (z - 4.5) - 0.22], [11.0, py + 0.34, sz * (z - 4.5) + 0.22], MAT.TIMBER);
    }
    m.painted(TINT.WOOD, () => {
      for (let i = 0; i <= 14; i++) {
        const px = -11.0 + i * (22.0 / 14);
        m.box([px - 0.09, py + 0.34, -(z - 4.9)], [px + 0.09, py + 0.5, z - 4.1], MAT.TIMBER);
      }
    });
    // Parterre: four quarters of clipped box round the fountain.
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        const ax = sx * 5.0, az = sz * 5.0, bx = sx * 13.0, bz = sz * 12.0;
        hedge(m, Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.min(az, bz) + 0.5);
        hedge(m, Math.min(ax, bx), Math.max(az, bz) - 0.5, Math.max(ax, bx), Math.max(az, bz));
        hedge(m, Math.min(ax, bx), Math.min(az, bz), Math.min(ax, bx) + 0.5, Math.max(az, bz));
        hedge(m, Math.max(ax, bx) - 0.5, Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz));
      }
    }
  }
  if (fine) {
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        // Bedding inside each quarter, and a standard tree at its centre.
        m.painted(TINT.ACCENT, () => m.box([sx * 6.4, 0.06, sz * 6.4], [sx * 11.6, 0.34, sz * 10.6], MAT.TRIM));
        tree(m, sx * 9.0, sz * 8.5, 6.4, 2.0);
        tree(m, sx * 17.0, sz * 12.0, 8.0, 2.6);
        tree(m, sx * 17.5, sz * 4.0, 6.8, 2.2);
        // Clipped cones down the quarter's edge, which is what a parterre has
        // instead of shrubs: four a side, alternating height.
        for (let k = 0; k < 4; k++) {
          const px = sx * (6.2 + k * 1.9), pz = sz * 5.6;
          m.painted(TINT.GREEN, () => m.cone(px, pz, 0.55, 0.05, 0.06, 1.5 + (k % 2) * 0.5, 8, MAT.TRIM));
          m.painted(TINT.GREEN, () => m.cone(px, sz * 11.4, 0.5, 0.05, 0.06, 1.3 + (k % 2) * 0.4, 8, MAT.TRIM));
        }
      }
    }
    for (const sz of [-1, 1] as const) {
      bench(m, -6.0, sz * 2.6, sz > 0 ? 0 : 2);
      bench(m, 6.0, sz * 2.6, sz > 0 ? 0 : 2);
    }
    // Urns on plinths down the main walk.
    for (const px of [-14.0, -7.0, 7.0, 14.0]) {
      for (const sz of [-1, 1] as const) {
        m.box([px - 0.5, 0.08, sz * 2.4 - 0.5], [px + 0.5, 0.9, sz * 2.4 + 0.5], MAT.STONE);
        m.cone(px, sz * 2.4, 0.28, 0.55, 0.9, 1.5, 10, MAT.STONE);
        m.painted(TINT.GREEN, () => m.cone(px, sz * 2.4, 0.5, 0.3, 1.5, 2.0, 8, MAT.TRIM));
      }
    }
    boxSign(m, { axis: 'z', sign: 1, plane: z }, -3.0, 3.0, 1.4, 2.2);
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

/** Boating lake: water, an island, a jetty and a boathouse. */
function boatingLake(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const x = 26.0, z = 20.0;

  m.painted(TINT.GREEN, () => m.box([-x, 0.001, -z], [x, 0.07, z], MAT.TRIM));
  // The lake: a sunken basin with a stone edge, not a blue rectangle laid on
  // the grass -- the edge is what stops water reading as a painted panel.
  const lx = 20.0, lz = 13.0;
  m.box([-lx - 0.6, 0, -lz - 0.6], [lx + 0.6, 0.34, lz + 0.6], MAT.STONE);
  m.box([-lx, 0, -lz], [lx, 0.2, lz], MAT.GLASS);
  // Island with three trees.
  m.painted(TINT.GREEN, () => m.cone(4.0, -1.0, 3.4, 2.6, 0.2, 0.7, 12, MAT.TRIM));

  if (medium) {
    // Boathouse on the near shore, open to the water.
    const bx0 = -16.0, bx1 = -7.0, bz0 = lz + 0.6, bz1 = lz + 7.0;
    m.box([bx0, 0, bz0], [bx1, 3.6, bz1], MAT.TIMBER);
    m.gable([bx0 - 0.5, 3.6, bz0 - 0.5], [bx1 + 0.5, 3.6, bz1 + 0.5], 2.2, 'x', MAT.METAL, MAT.TIMBER);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 4; i++) {
        const px = bx0 + (i / 4) * (bx1 - bx0);
        m.box([px - 0.1, 0, bz0 - 0.1], [px + 0.1, 3.6, bz0 + 0.1], MAT.TRIM);
      }
    });
    // Jetty out over the water on piles.
    m.box([-2.0, 0.34, lz - 5.0], [2.0, 0.52, lz + 0.6], MAT.TIMBER);
    m.painted(TINT.WOOD, () => {
      for (const px of [-1.8, 1.8]) {
        for (const pz of [lz - 4.6, lz - 2.4, lz - 0.2]) m.cylinder(px, pz, 0.14, 0, 0.34, 6, MAT.TIMBER);
      }
    });
    railing(m, -2.0, 2.0, lz - 5.0, 0.52, 0.95, 1.2);
    // A humpback footbridge to the island.
    for (let i = 0; i < 8; i++) {
      const t0 = i / 8, t1 = (i + 1) / 8;
      const az = -lz - 0.6 + t0 * 9.0, bz = -lz - 0.6 + t1 * 9.0;
      const ay = 0.34 + Math.sin(t0 * Math.PI) * 1.5, by = 0.34 + Math.sin(t1 * Math.PI) * 1.5;
      m.quad([-1.4, ay, az], [1.4, ay, az], [1.4, by, bz], [-1.4, by, bz], MAT.TIMBER);
      m.quad([-1.4, ay - 0.22, az], [-1.4, by - 0.22, bz], [-1.4, by, bz], [-1.4, ay, az], MAT.TIMBER);
      m.quad([1.4, by - 0.22, bz], [1.4, ay - 0.22, az], [1.4, ay, az], [1.4, by, bz], MAT.TIMBER);
    }
  }
  if (fine) {
    // Rowing boats drawn up at the jetty.
    m.painted(TINT.ACCENT, () => {
      for (let i = 0; i < 4; i++) {
        const pz = lz - 4.6 + (i % 2) * 2.2;
        const px = i < 2 ? -3.4 : 3.4;
        m.box([px - 0.7, 0.2, pz - 0.36], [px + 0.7, 0.52, pz + 0.36], MAT.TIMBER);
        m.box([px - 0.55, 0.44, pz - 0.26], [px + 0.55, 0.5, pz + 0.26], MAT.TIMBER);
      }
    });
    for (const [tx, tz] of [[4.0, -1.6], [2.2, -0.4], [5.6, 0.2]] as const) tree(m, tx, tz, 6.0, 1.9);
    for (let i = 0; i < 6; i++) {
      tree(m, -x + 3.5 + i * 9.5, -z + 3.0, 7.4, 2.4);
    }
    for (const px of [-10.0, 0.0, 10.0]) bench(m, px, lz + 3.0, 2);
    for (const px of [-14.0, 14.0]) bench(m, px, -lz - 3.0, 0);
    for (let i = 0; i < 5; i++) tree(m, -x + 5.0 + i * 11.0, z - 3.2, 7.0, 2.3);
    for (const sx of [-1, 1] as const) {
      for (let i = 0; i < 3; i++) tree(m, sx * (x - 3.0), -8.0 + i * 8.0, 6.4, 2.1);
    }
    // Reeds along the far bank, and a pair of waterfowl on the water.
    m.painted(TINT.GREEN, () => {
      for (let i = 0; i < 22; i++) {
        const px = -lx + 1.0 + i * (2 * lx - 2.0) / 21;
        m.cone(px, -lz + 0.9, 0.28, 0.05, 0.2, 1.2 + (i % 3) * 0.25, 5, MAT.TRIM);
      }
    });
    m.painted(TINT.METAL_DARK, () => {
      for (const [px, pz] of [[-6.0, 3.0], [-5.0, 4.2]] as const) {
        m.box([px - 0.28, 0.2, pz - 0.16], [px + 0.28, 0.42, pz + 0.16], MAT.TRIM);
        m.box([px + 0.16, 0.42, pz - 0.07], [px + 0.34, 0.66, pz + 0.07], MAT.TRIM);
      }
    });
    // Lamp columns round the walk.
    for (const [px, pz] of [[-16.0, lz + 2.0], [0.0, lz + 2.0], [16.0, lz + 2.0]] as const) {
      m.painted(TINT.METAL_DARK, () => m.pipe([px, 0.07, pz], [px, 4.2, pz], 0.09, MAT.TRIM, 6));
      m.painted(TINT.SIGN_LIT, () => m.box([px - 0.3, 4.2, pz - 0.3], [px + 0.3, 4.5, pz + 0.3], MAT.TRIM));
    }
    entrance(m, { axis: 'z', sign: 1, plane: lz + 7.0 }, -11.5, { width: 1.2, height: 2.2 });
    boxSign(m, { axis: 'z', sign: 1, plane: lz + 7.0 }, -15.0, -8.0, 3.8, 4.6);
    // Railing round the water, which every municipal lake has.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 30; i++) {
        const px = -lx + (i / 30) * 2 * lx;
        for (const pz of [lz + 0.5, -lz - 0.5] as const) {
          m.box([px - 0.05, 0.34, pz - 0.05], [px + 0.05, 1.2, pz + 0.05], MAT.TRIM);
        }
      }
      for (const pz of [lz + 0.5, -lz - 0.5] as const) {
        m.box([-lx, 1.06, pz - 0.04], [lx, 1.16, pz + 0.04], MAT.TRIM);
      }
    });
    kerb(m, -x, z - 0.4, x, z);
  }
  return m;
}

/** Skate park: a concrete bowl, ramps and rails, floodlit and fenced. */
function skatePark(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const x = 20.0, z = 15.0;

  m.box([-x, 0.001, -z], [x, 0.1, z], MAT.CONCRETE);
  // The bowl, built up rather than dug in: a ring berm whose inside face
  // dishes down to the flat. Sinking it put two metres of concrete below
  // ground, which nothing in this library is allowed to do -- the terrain is
  // not carved, so anything under zero is simply lost.
  const bowlR = 9.0, bowlH = 2.8, cx = -7.0;
  for (let i = 0; i < 6; i++) {
    const t0 = i / 6, t1 = (i + 1) / 6;
    // Outside: a straight batter. Inside: a quarter-circle transition.
    const ro0 = bowlR + 1.6 - t0 * 0.9, ro1 = bowlR + 1.6 - t1 * 0.9;
    const y0 = 0.1 + t0 * bowlH, y1 = 0.1 + t1 * bowlH;
    m.cone(cx, 0, ro0, ro1, y0, y1, 20, MAT.CONCRETE);
    const ri0 = bowlR - Math.cos(t0 * Math.PI * 0.5) * 3.2;
    const ri1 = bowlR - Math.cos(t1 * Math.PI * 0.5) * 3.2;
    const iy0 = 0.1 + Math.sin(t0 * Math.PI * 0.5) * bowlH;
    const iy1 = 0.1 + Math.sin(t1 * Math.PI * 0.5) * bowlH;
    m.cone(cx, 0, ri1, ri0, iy1, iy0, 20, MAT.CONCRETE);
  }
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i < 20; i++) {
      const a0 = (i / 20) * Math.PI * 2, a1 = ((i + 1) / 20) * Math.PI * 2;
      m.pipe([cx + Math.cos(a0) * bowlR, 0.1 + bowlH, Math.sin(a0) * bowlR],
             [cx + Math.cos(a1) * bowlR, 0.1 + bowlH, Math.sin(a1) * bowlR], 0.07, MAT.TRIM, 5);
    }
  });

  if (medium) {
    // Quarter pipe against the back, built as a curved ramp.
    for (let i = 0; i < 8; i++) {
      const t0 = i / 8, t1 = (i + 1) / 8;
      const y0 = Math.sin(t0 * Math.PI * 0.5) * 2.6, y1 = Math.sin(t1 * Math.PI * 0.5) * 2.6;
      const z0 = -z + 2.0 + (1 - Math.cos(t0 * Math.PI * 0.5)) * 3.4;
      const z1 = -z + 2.0 + (1 - Math.cos(t1 * Math.PI * 0.5)) * 3.4;
      m.quad([4.0, y1, z1], [16.0, y1, z1], [16.0, y0, z0], [4.0, y0, z0], MAT.CONCRETE);
    }
    m.painted(TINT.METAL_DARK, () => m.pipe([4.0, 2.7, -z + 2.0], [16.0, 2.7, -z + 2.0], 0.08, MAT.TRIM, 8));
    // A funbox with rails and a set of steps.
    m.box([4.0, 0.1, 3.0], [11.0, 0.9, 8.0], MAT.CONCRETE);
    m.cone(7.5, 5.5, 4.0, 3.5, 0.9, 0.96, 4, MAT.CONCRETE);
    m.painted(TINT.METAL_DARK, () => {
      m.pipe([3.4, 0.95, 4.2], [11.6, 0.95, 4.2], 0.07, MAT.TRIM, 8);
      m.pipe([3.4, 0.5, 7.0], [11.6, 0.95, 7.0], 0.07, MAT.TRIM, 8);
      for (const px of [4.2, 10.8]) m.pipe([px, 0.1, 4.2], [px, 0.95, 4.2], 0.05, MAT.TRIM, 6);
    });
    // Fence round the lot.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 20; i++) {
        const px = -x + (i / 20) * (2 * x);
        for (const pz of [-z, z] as const) m.box([px - 0.06, 0.1, pz - 0.06], [px + 0.06, 2.4, pz + 0.06], MAT.TRIM);
      }
      for (const pz of [-z, z] as const) m.box([-x, 2.2, pz - 0.04], [x, 2.32, pz + 0.04], MAT.TRIM);
    });
  }
  if (fine) {
    m.painted(TINT.METAL_DARK, () => {
      // Floodlights on two columns.
      for (const px of [-x + 3.0, x - 3.0]) {
        m.pipe([px, 0.1, -z + 1.2], [px, 8.4, -z + 1.2], 0.16, MAT.TRIM, 8);
        m.box([px - 1.4, 8.4, -z + 0.9], [px + 1.4, 8.8, -z + 1.5], MAT.TRIM);
      }
      // A grind rail and a kerb block on the flat.
      m.pipe([-16.0, 0.5, 7.0], [-2.0, 0.5, 7.0], 0.07, MAT.TRIM, 8);
      for (const px of [-15.4, -8.6, -2.6]) m.pipe([px, 0.1, 7.0], [px, 0.5, 7.0], 0.05, MAT.TRIM, 6);
    });
    m.box([-17.0, 0.1, -6.0], [-13.0, 0.5, -4.0], MAT.CONCRETE);
    for (const px of [-14.0, 0.0, 14.0]) bench(m, px, z - 2.0, 2);
    for (let i = 0; i < 4; i++) tree(m, -x + 4.0 + i * 10.0, z - 4.4, 6.6, 2.2);
    // A spine ramp and a bank on the open side, plus a run of coping.
    for (let i = 0; i < 6; i++) {
      const t0 = i / 6, t1 = (i + 1) / 6;
      const y0 = Math.sin(t0 * Math.PI * 0.5) * 1.6, y1 = Math.sin(t1 * Math.PI * 0.5) * 1.6;
      const z0 = 9.0 - (1 - Math.cos(t0 * Math.PI * 0.5)) * 2.6;
      const z1 = 9.0 - (1 - Math.cos(t1 * Math.PI * 0.5)) * 2.6;
      m.quad([-17.0, y0, z0], [-4.0, y0, z0], [-4.0, y1, z1], [-17.0, y1, z1], MAT.CONCRETE);
      m.quad([-17.0, y1, z1], [-4.0, y1, z1], [-4.0, y1, z1 + 1.2], [-17.0, y1, z1 + 1.2], MAT.CONCRETE);
    }
    m.painted(TINT.METAL_DARK, () => {
      m.pipe([-17.0, 1.7, 6.4], [-4.0, 1.7, 6.4], 0.07, MAT.TRIM, 8);
      for (let i = 0; i < 6; i++) {
        const px = 5.0 + i * 1.9;
        m.pipe([px, 0.1, -6.0], [px, 1.1, -6.0], 0.05, MAT.TRIM, 6);
        m.pipe([px, 1.1, -6.0], [px, 1.1, -3.4], 0.05, MAT.TRIM, 6);
      }
    });
    boxSign(m, { axis: 'z', sign: 1, plane: z }, -3.4, 3.4, 1.4, 2.3);
    kerb(m, -x, z + 0.4, x, z + 0.8);
  }
  return m;
}

/** Allotments: plots, sheds, cold frames and a standpipe. */
function allotments(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const x = 22.0, z = 16.0;
  const cols = 5, rows = 2;

  m.painted(TINT.GREEN, () => m.box([-x, 0.001, -z], [x, 0.05, z], MAT.TRIM));
  m.box([-x, 0.02, -1.2], [x, 0.09, 1.2], MAT.GROUND);

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const cx = -x + 2.6 + c * ((2 * x - 5.2) / (cols - 1));
      const cz = r === 0 ? -8.0 : 8.0;
      // Beds: four raised rows per plot, in soil rather than grass.
      for (let b = 0; b < 4; b++) {
        const bz = cz - 4.4 + b * 2.4;
        m.box([cx - 3.0, 0.05, bz], [cx + 3.0, 0.34, bz + 1.5], MAT.GROUND);
        m.painted(TINT.WOOD, () => {
          m.box([cx - 3.05, 0.05, bz - 0.05], [cx + 3.05, 0.4, bz + 0.06], MAT.TIMBER);
          m.box([cx - 3.05, 0.05, bz + 1.44], [cx + 3.05, 0.4, bz + 1.55], MAT.TIMBER);
        });
        if (medium && b % 2 === 0) {
          m.painted(TINT.GREEN, () => {
            for (let k = 0; k < 5; k++) {
              m.cone(cx - 2.4 + k * 1.2, bz + 0.75, 0.34, 0.1, 0.34, 1.1, 6, MAT.TRIM);
            }
          });
        }
      }
    }
  }

  if (medium) {
    for (let c = 0; c < cols; c++) {
      const cx = -x + 2.6 + c * ((2 * x - 5.2) / (cols - 1));
      for (const cz of [-13.4, 13.4]) {
        // A shed per plot, each turned a little differently.
        m.painted(TINT.WOOD, () => m.box([cx - 1.2, 0, cz - 1.0], [cx + 1.2, 2.0, cz + 1.0], MAT.TIMBER));
        m.box([cx - 1.35, 2.0, cz - 1.15], [cx + 1.35, 2.16, cz + 1.15], MAT.METAL);
        m.gable([cx - 1.35, 2.16, cz - 1.15], [cx + 1.35, 2.16, cz + 1.15], 0.7, 'x', MAT.METAL, MAT.TIMBER);
        // Water butt beside it.
        m.painted(TINT.METAL_DARK, () => m.cylinder(cx + 1.7, cz + 0.4, 0.42, 0, 1.2, 10, MAT.TRIM));
      }
    }
    // Cold frames along the centre walk.
    for (let i = 0; i < 6; i++) {
      const px = -18.0 + i * 7.0;
      m.box([px - 1.6, 0.05, -0.9], [px + 1.6, 0.5, 0.9], MAT.TIMBER);
      m.quad([px - 1.6, 0.5, 0.9], [px + 1.6, 0.5, 0.9], [px + 1.6, 0.95, -0.9], [px - 1.6, 0.95, -0.9], MAT.GLASS);
    }
  }
  if (fine) {
    // Standpipe and trough at the entrance, and canes on the plots.
    m.painted(TINT.METAL_DARK, () => {
      m.pipe([-x + 2.0, 0, 0], [-x + 2.0, 1.3, 0], 0.09, MAT.TRIM, 6);
      m.pipe([-x + 2.0, 1.3, 0], [-x + 2.0, 1.3, 0.7], 0.07, MAT.TRIM, 6);
      for (let c = 0; c < cols; c++) {
        const cx = -x + 2.6 + c * ((2 * x - 5.2) / (cols - 1));
        for (const cz of [-6.0, 6.0]) {
          for (let k = 0; k < 5; k++) {
            m.pipe([cx - 1.6 + k * 0.8, 0.34, cz - 0.6], [cx - 1.2 + k * 0.8, 2.1, cz], 0.03, MAT.TRIM, 4);
          }
        }
      }
    });
    m.box([-x + 1.2, 0.05, -0.9], [-x + 2.8, 0.5, 0.9], MAT.STONE);
    // Fence and a gate on the road side.
    m.painted(TINT.WOOD, () => {
      for (let i = 0; i <= 22; i++) {
        const px = -x + (i / 22) * (2 * x);
        m.box([px - 0.06, 0, z - 0.06], [px + 0.06, 1.3, z + 0.06], MAT.TIMBER);
      }
      m.box([-x, 1.1, z - 0.04], [x, 1.22, z + 0.04], MAT.TIMBER);
    });
    for (let i = 0; i < 3; i++) tree(m, -x + 6.0 + i * 15.0, -z + 1.6, 6.0, 2.0);
    boxSign(m, { axis: 'z', sign: 1, plane: z }, -3.0, 3.0, 1.4, 2.2);
    kerb(m, -x, z + 0.4, x, z + 0.8);
  }
  return m;
}

/** A green with a bandstand, a path circuit, trees and a drinking fountain. */
function bandstandGreen(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const x = 20.0, z = 18.0;

  m.painted(TINT.GREEN, () => m.box([-x, 0.001, -z], [x, 0.06, z], MAT.TRIM));
  // Path circuit: an oval walk, drawn as a ring of paving.
  for (let i = 0; i < 28; i++) {
    const a0 = (i / 28) * Math.PI * 2, a1 = ((i + 1) / 28) * Math.PI * 2;
    const r0 = 12.5, r1 = 14.5;
    m.quad([Math.cos(a0) * r0, 0.07, Math.sin(a0) * r0 * 0.8],
           [Math.cos(a1) * r0, 0.07, Math.sin(a1) * r0 * 0.8],
           [Math.cos(a1) * r1, 0.07, Math.sin(a1) * r1 * 0.8],
           [Math.cos(a0) * r1, 0.07, Math.sin(a0) * r1 * 0.8], MAT.GROUND);
  }

  // The bandstand: an octagonal stone platform, cast columns, a tiered roof
  // and a finial. This is the whole reason the park has a centre.
  m.cylinder(0, 0, 5.2, 0, 0.9, 8, MAT.STONE);
  m.cylinder(0, 0, 4.6, 0.9, 1.0, 8, MAT.CONCRETE);
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      m.cylinder(Math.cos(a) * 4.2, Math.sin(a) * 4.2, 0.17, 1.0, 4.2, 8, MAT.TRIM);
    }
  });
  m.cone(0, 0, 5.4, 3.4, 4.2, 5.4, 8, MAT.METAL);
  m.cone(0, 0, 3.4, 0.0, 5.4, 7.2, 8, MAT.METAL);
  m.cylinder(0, 0, 0.16, 7.2, 8.2, 6, MAT.METAL);

  if (medium) {
    // Steps up to the platform, and a balustrade round the rest of it.
    for (let i = 0; i < 3; i++) {
      m.box([-1.8, 0.9 - (i + 1) * 0.3, 5.0 + i * 0.5], [1.8, 0.9 - i * 0.3, 5.6 + i * 0.5], MAT.STONE);
    }
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 8; i++) {
        const a0 = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const a1 = ((i + 1) / 8) * Math.PI * 2 + Math.PI / 8;
        const p0: Vec3 = [Math.cos(a0) * 4.2, 1.9, Math.sin(a0) * 4.2];
        const p1: Vec3 = [Math.cos(a1) * 4.2, 1.9, Math.sin(a1) * 4.2];
        if (Math.abs(a0 - Math.PI / 2) < 0.5) continue;
        m.pipe(p0, p1, 0.06, MAT.TRIM, 5);
        m.pipe([p0[0], 1.0, p0[2]], [p0[0], 1.9, p0[2]], 0.04, MAT.TRIM, 5);
      }
      // Frieze under the eaves.
      for (let i = 0; i < 8; i++) {
        const a0 = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const a1 = ((i + 1) / 8) * Math.PI * 2 + Math.PI / 8;
        m.pipe([Math.cos(a0) * 4.2, 4.0, Math.sin(a0) * 4.2],
               [Math.cos(a1) * 4.2, 4.0, Math.sin(a1) * 4.2], 0.08, MAT.TRIM, 5);
      }
    });
  }
  if (fine) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      tree(m, Math.cos(a) * 17.0, Math.sin(a) * 14.5, 7.6 + (i % 3) * 0.8, 2.5);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      bench(m, Math.cos(a) * 11.0, Math.sin(a) * 9.0, i < 3 ? 0 : 2);
    }
    // Drinking fountain and a litter bin on the walk.
    m.cylinder(-13.5, 2.0, 0.4, 0.07, 0.95, 10, MAT.STONE);
    m.cylinder(-13.5, 2.0, 0.5, 0.95, 1.1, 10, MAT.STONE);
    m.painted(TINT.METAL_DARK, () => {
      m.cylinder(13.5, -2.0, 0.35, 0.07, 0.95, 10, MAT.TRIM);
      m.cylinder(13.5, -2.0, 0.4, 0.95, 1.05, 10, MAT.TRIM);
    });
    // A second, outer ring of trees, and lamp columns on the walk.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      tree(m, Math.cos(a) * 9.5, Math.sin(a) * 7.6, 5.4, 1.8);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.15;
      const px = Math.cos(a) * 13.5, pz = Math.sin(a) * 11.0;
      m.painted(TINT.METAL_DARK, () => m.pipe([px, 0.07, pz], [px, 4.0, pz], 0.09, MAT.TRIM, 6));
      m.painted(TINT.SIGN_LIT, () => m.box([px - 0.28, 4.0, pz - 0.28], [px + 0.28, 4.32, pz + 0.28], MAT.TRIM));
    }
    boxSign(m, { axis: 'z', sign: 1, plane: z }, -3.2, 3.2, 1.4, 2.3);
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

// ==================================================================== table

const civ = (jobs: number, upkeep: number, power: number, water: number): AssetDef['sim'] => ({
  jobs, powerKW: power, waterM3: water, garbagePerWeek: jobs * 9, pollution: 0, upkeep,
});

export const EXTRA_SERVICES: AssetDef[] = [
  { id: 'svc.fire.training', name: 'Fire training ground', zone: 'service', branch: 'fire', density: 'none', variant: 'sculpted', footprint: [6, 5], height: 19.0, brand: { name: 'Fire Training', colour: [0.56, 0.16, 0.12], accent: [0.72, 0.62, 0.20], sign: 'box' }, sim: civ(28, 300, 120, 180), note: 'Concrete burn house with blind openings, five-storey drill tower with jump balconies, hose rack and hydrant run.', build: fireTraining },
  { id: 'svc.police.traffic', name: 'Traffic control unit', zone: 'service', branch: 'police', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 24.0, brand: { name: 'Traffic', colour: [0.14, 0.26, 0.50], accent: [0.72, 0.66, 0.24], sign: 'box' }, sim: civ(55, 420, 260, 60), note: 'Finned operations block under two lattice masts, covered bays with four liveried patrol cars.', build: trafficUnit },
  { id: 'svc.health.lab', name: 'Pathology lab', zone: 'service', branch: 'health', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 18.0, brand: { name: 'Pathology', colour: [0.20, 0.34, 0.40], accent: [0.66, 0.70, 0.72], sign: 'box' }, sim: civ(90, 620, 480, 300), note: 'Near-blind clad box on a stone plinth, flue bank, louvred roof plant, caged gas store.', build: pathologyLab },
  { id: 'svc.edu.nursery', name: 'Nursery', zone: 'service', branch: 'education', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 6.0, brand: { name: 'Nursery', colour: [0.42, 0.30, 0.56], accent: [0.74, 0.52, 0.18], sign: 'box' }, sim: civ(14, 150, 60, 50), note: 'Single-storey L under one folded roof plane, knee-height glazing, covered play deck on bright posts.', build: nursery },
  { id: 'svc.water.valvehouse', name: 'Valve house', zone: 'service', branch: 'water', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 9.0, brand: { name: 'Water', colour: [0.14, 0.36, 0.50], accent: [0.66, 0.68, 0.70], sign: 'box' }, sim: civ(10, 260, 640, 40), note: 'Valve hall with high clerestory, three flanged mains out to an open wet well, hand wheels and a surge vessel.', build: pumpingStation },
  { id: 'svc.power.wind', name: 'Wind turbines', zone: 'service', branch: 'power', density: 'none', variant: 'sculpted', footprint: [7, 5], height: 60.0, brand: { name: 'Wind', colour: [0.62, 0.64, 0.66], accent: [0.72, 0.60, 0.16], sign: 'none' }, sim: civ(4, 240, 0, 0), note: 'Three tapered towers of unequal height with twisted tapering blades, access tracks, substation compound.', build: windFarm },
  { id: 'svc.transport.ferry', name: 'Ferry terminal', zone: 'service', branch: 'transport', density: 'none', variant: 'sculpted', footprint: [7, 5], height: 11.4, brand: { name: 'Ferries', colour: [0.16, 0.44, 0.44], accent: [0.72, 0.62, 0.22], sign: 'box' }, sim: civ(34, 340, 130, 70), note: 'Quay with bollards and fenders, counterweighted linkspan, glazed passenger hall under a mast-hung canopy.', build: ferryTerminal },
  { id: 'svc.gov.archive', name: 'City archive', zone: 'service', branch: 'government', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 23.6, brand: { name: 'Archive', colour: [0.44, 0.38, 0.24], accent: [0.66, 0.60, 0.34], sign: 'box' }, sim: civ(30, 400, 320, 40), note: 'Blind stone vault oversailing a glazed reading base on columns, pilastered all round, roof plant screen.', build: archive },
  { id: 'svc.parks.garden', name: 'Formal garden', zone: 'service', branch: 'parks', density: 'none', variant: 'sculpted', footprint: [6, 5], height: 4.0, brand: { name: 'Garden', colour: [0.24, 0.46, 0.26], accent: [0.68, 0.60, 0.34], sign: 'box' }, sim: civ(6, 130, 20, 220), note: 'Parterre of clipped box round a tiered fountain, pergola across the far end, urns down the main walk.', build: formalGarden },
  { id: 'svc.parks.lake', name: 'Boating lake', zone: 'service', branch: 'parks', density: 'none', variant: 'sculpted', footprint: [7, 6], height: 6.0, brand: { name: 'Lake', colour: [0.18, 0.42, 0.52], accent: [0.62, 0.56, 0.32], sign: 'box' }, sim: civ(8, 180, 30, 60), note: 'Stone-edged basin with a planted island, timber boathouse, jetty on piles and a humpback footbridge.', build: boatingLake },
  { id: 'svc.parks.skate', name: 'Skate park', zone: 'service', branch: 'parks', density: 'none', variant: 'sculpted', footprint: [6, 5], height: 9.0, brand: { name: 'Skate', colour: [0.28, 0.30, 0.34], accent: [0.72, 0.52, 0.16], sign: 'box' }, sim: civ(3, 110, 40, 10), note: 'Stepped concrete bowl, curved quarter pipe, funbox with rails and steps, floodlights and a mesh fence.', build: skatePark },
  { id: 'svc.parks.allotments', name: 'Allotments', zone: 'service', branch: 'parks', density: 'none', variant: 'sculpted', footprint: [6, 5], height: 3.0, brand: { name: 'Allotments', colour: [0.30, 0.42, 0.20], accent: [0.62, 0.50, 0.28], sign: 'box' }, sim: civ(2, 60, 5, 180), note: 'Ten plots of raised beds with timber sheds and water butts, cold frames down the centre walk, standpipe.', build: allotments },
  { id: 'svc.parks.bandstand', name: 'Bandstand green', zone: 'service', branch: 'parks', density: 'none', variant: 'sculpted', footprint: [5, 5], height: 8.2, brand: { name: 'Green', colour: [0.26, 0.44, 0.28], accent: [0.66, 0.58, 0.30], sign: 'box' }, sim: civ(4, 90, 25, 90), note: 'Octagonal bandstand on a stone platform with cast columns and a tiered roof, oval walk, benches and trees.', build: bandstandGreen },
  { id: 'svc.parks.lido', name: 'Lido', zone: 'service', branch: 'parks', density: 'none', variant: 'sculpted', footprint: [6, 5], height: 9.6, brand: { name: 'Lido', colour: [0.18, 0.48, 0.52], accent: [0.72, 0.60, 0.24], sign: 'box' }, sim: civ(16, 220, 90, 400), note: 'Open-air pool with lane ropes, colonnaded terrace of changing cabins, three-level diving platform.', build: lido },
];
