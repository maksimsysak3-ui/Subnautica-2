/**
 * Utilities: water and sewage, electricity, transport.
 *
 * The least house-like buildings in the library, and deliberately so. These
 * are process plant with a door in it: drums, gantries, louvre banks, ribbed
 * halls, pipe runs and masts. Where the emergency services still have a front
 * elevation to compose, most of these have none at all -- the silhouette is
 * the whole read, from a long way off, and the only glazing is the one room
 * where somebody actually sits.
 *
 * No brick, no tiles, no pitched domestic roofs: the asset test fails a
 * service asset that uses any of them.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import type { Material } from '../mesh';
import { parkedVehicle } from './vehicles';
import type { Wall } from '../parts';
import {
  band, boxSign, dressRoof, entrance, fins, kerb, louvres, parapet, portal, railing,
  ribbon, roofClutter, serviceYard,
} from '../parts';

// -------------------------------------------------------------- shared parts

/** A stack of ribbon windows, one per floor. */
function ribbonStack(m: MeshBuilder, w: Wall, u0: number, u1: number, o: {
  floors: number; floorH: number; base: number; height: number;
}): void {
  for (let f = 0; f < o.floors; f++) {
    const y = o.base + f * o.floorH;
    ribbon(m, w, u0, u1, y, y + o.height, { head: f === o.floors - 1 });
  }
}

/**
 * A drum with a walkway round the top and a ladder up one side.
 *
 * Tanks, digesters, silos and cooling towers all come back to this, and the
 * handrail is what stops it reading as a bollard scaled up.
 */
function tank(m: MeshBuilder, cx: number, cz: number, r: number, h: number,
              mat: Material = MAT.METAL): void {
  m.cylinder(cx, cz, r * 1.06, 0, 0.8, 16, MAT.CONCRETE);
  m.cylinder(cx, cz, r, 0.8, h, 18, mat, false);
  m.cylinder(cx, cz, r * 1.03, h, h + 0.3, 18, MAT.CONCRETE, false);
  m.cone(cx, cz, r, r * 0.2, h + 0.3, h + r * 0.45, 18, MAT.METAL);
  // Ring beams, a walkway rail and a caged ladder.
  for (const y of [h * 0.35, h * 0.7]) {
    m.cylinder(cx, cz, r + 0.08, y, y + 0.22, 18, MAT.CONCRETE, false);
  }
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      m.box([cx + Math.cos(a) * (r + 0.35) - 0.05, h + 0.3, cz + Math.sin(a) * (r + 0.35) - 0.05],
            [cx + Math.cos(a) * (r + 0.35) + 0.05, h + 1.3, cz + Math.sin(a) * (r + 0.35) + 0.05],
            MAT.TRIM);
    }
    m.cylinder(cx, cz, r + 0.4, h + 1.2, h + 1.32, 18, MAT.TRIM, false);
    const n = Math.max(6, Math.floor(h / 0.62));
    for (let i = 0; i < n; i++) {
      m.box([cx - 0.35, 0.9 + i * 0.62, cz + r], [cx + 0.35, 0.97 + i * 0.62, cz + r + 0.1], MAT.TRIM);
    }
    for (const dx of [-0.38, 0.38]) {
      m.box([cx + dx - 0.05, 0.8, cz + r], [cx + dx + 0.05, h + 1.3, cz + r + 0.1], MAT.TRIM);
    }
  });
}

/** A lattice mast: four legs, cross bracing, a crossarm. */
function lattice(m: MeshBuilder, cx: number, cz: number, w: number, h: number, arm = 0): void {
  const r = w / 2;
  m.painted(TINT.METAL_DARK, () => {
    for (const [dx, dz] of [[-r, -r], [r, -r], [-r, r], [r, r]] as const) {
      m.box([cx + dx - 0.09, 0, cz + dz - 0.09], [cx + dx + 0.09, h, cz + dz + 0.09], MAT.TRIM);
    }
    const rungs = Math.max(4, Math.floor(h / 1.6));
    for (let i = 1; i < rungs; i++) {
      const y = (i / rungs) * h;
      m.box([cx - r, y, cz - r - 0.05], [cx + r, y + 0.09, cz - r + 0.05], MAT.TRIM);
      m.box([cx - r, y, cz + r - 0.05], [cx + r, y + 0.09, cz + r + 0.05], MAT.TRIM);
      m.box([cx - r - 0.05, y, cz - r], [cx - r + 0.05, y + 0.09, cz + r], MAT.TRIM);
      m.box([cx + r - 0.05, y, cz - r], [cx + r + 0.05, y + 0.09, cz + r], MAT.TRIM);
    }
    if (arm > 0) {
      m.box([cx - arm / 2, h - 1.2, cz - 0.14], [cx + arm / 2, h - 0.95, cz + 0.14], MAT.TRIM);
      m.box([cx - arm / 2 * 0.7, h - 2.6, cz - 0.14], [cx + arm / 2 * 0.7, h - 2.35, cz + 0.14], MAT.TRIM);
      for (const t of [-1, -0.5, 0.5, 1]) {
        m.box([cx + t * arm / 2 - 0.07, h - 1.9, cz - 0.07], [cx + t * arm / 2 + 0.07, h - 1.2, cz + 0.07], MAT.TRIM);
      }
    }
  });
}

/** A control building: the one glazed room on an otherwise blind site. */
function controlBlock(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number,
                      h: number, seed: number): void {
  m.box([x0, 0, z0], [x1, h, z1], MAT.CLADDING, { roof: MAT.TRIM });
  m.box([x0 - 0.2, 0, z0 - 0.2], [x1 + 0.2, 1.1, z1 + 0.2], MAT.CONCRETE);
  parapet(m, x0, z0, x1, z1, h, 0.8, 0.3);
  // Two ribbons if it is tall enough for two floors, one otherwise.
  const floors = h > 6.0 ? 2 : 1;
  ribbonStack(m, { axis: 'z', sign: 1, plane: z1 }, x0 + 0.9, x1 - 0.9,
    { floors, floorH: 3.4, base: 1.5, height: 1.9 });
  ribbonStack(m, { axis: 'x', sign: 1, plane: x1 }, z0 + 0.9, z1 - 0.9,
    { floors, floorH: 3.4, base: 1.5, height: 1.9 });
  entrance(m, { axis: 'z', sign: 1, plane: z1 }, x0 + 2.0,
    { width: 1.4, height: 2.4, double: true, glazed: true, canopy: 1.6 });
  roofClutter(m, x0 + 1, z0 + 1, x1 - 1, z1 - 1, h, seed, 1.0);
}

// ============================================================ water & sewage

/** Pumping station: a ribbed hall over the pumps, a surge tank, a wet well. */
function pumpStation(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 17.0, z = 13.0;
  const hallW = 20.0, hallD = 12.0, hallH = 8.5;
  const hx = -x + hallW / 2 + 1.0, hz = -1.0;

  m.box([hx - hallW / 2, 0, hz - hallD / 2], [hx + hallW / 2, hallH, hz + hallD / 2],
    MAT.CONCRETE, { roof: MAT.TRIM });

  if (medium) {
    // Ribbed wall: a pier every 2.4 m the whole way round. A pump hall is a
    // structure with a skin on it, not a facade.
    for (let i = 0; i <= 8; i++) {
      const px = hx - hallW / 2 + (i / 8) * hallW;
      m.box([px - 0.28, 0, hz - hallD / 2 - 0.32], [px + 0.28, hallH + 0.7, hz + hallD / 2 + 0.32],
        MAT.CONCRETE);
    }
    m.box([hx - hallW / 2 - 0.5, hallH + 0.7, hz - hallD / 2 - 0.5],
          [hx + hallW / 2 + 0.5, hallH + 1.2, hz + hallD / 2 + 0.5], MAT.CONCRETE);
    tank(m, x - 5.0, z - 6.0, 4.2, 11.0);
    tank(m, x - 5.0, z - 15.0, 3.0, 8.0, MAT.CONCRETE);
    roofClutter(m, hx - 6, hz - 3, hx + 6, hz + 3, hallH + 1.2, 1101, 0.7);
  }
  if (fine) {
    // Clerestory only: a pump hall is lit from high up, never at eye level.
    for (const sz of [1, -1] as const) {
      ribbon(m, { axis: 'z', sign: sz, plane: hz + sz * hallD / 2 }, hx - hallW / 2 + 1.4,
        hx + hallW / 2 - 1.4, hallH - 2.6, hallH - 0.8);
    }
    louvres(m, { axis: 'x', sign: -1, plane: hx - hallW / 2 }, hz - 4.0, hz + 4.0, 2.0, 6.4);
    entrance(m, { axis: 'z', sign: 1, plane: hz + hallD / 2 }, hx - 6.0,
      { width: 1.5, height: 2.5, double: true, glazed: true, canopy: 1.6 });
    // The wet well: a sunken slab with a hatch and a lifting davit over it.
    m.box([-x + 2.0, 0.001, z - 5.0], [-x + 9.0, 0.14, z - 0.5], MAT.CONCRETE);
    m.painted(TINT.METAL_DARK, () => {
      m.box([-x + 4.0, 0.14, z - 3.8], [-x + 6.8, 0.35, z - 1.6], MAT.TRIM);
      m.box([-x + 3.2, 0, z - 2.9], [-x + 3.5, 3.4, z - 2.6], MAT.TRIM);
      m.box([-x + 3.2, 3.1, z - 2.9], [-x + 6.0, 3.4, z - 2.6], MAT.TRIM);
      m.box([-x + 5.7, 1.4, z - 2.85], [-x + 5.85, 3.1, z - 2.65], MAT.TRIM);
      // Suction and delivery mains running to the hall.
      m.pipe([-x + 5.4, 1.1, z - 2.7], [hx - hallW / 2 - 0.2, 1.1, z - 2.7], 0.42, MAT.TRIM);
      m.pipe([x - 5.0, 3.2, z - 6.0], [hx + hallW / 2 + 0.2, 3.2, z - 6.0], 0.5, MAT.TRIM);
    });
    boxSign(m, { axis: 'z', sign: 1, plane: hz + hallD / 2 }, hx - 3.0, hx + 3.0, hallH - 0.5, hallH + 0.5);
    // Valve gallery alongside the hall, a switchroom, and the horizontal
    // surge vessel on saddles that every pumping station has somewhere.
    m.box([hx - hallW / 2, 0, hz + hallD / 2], [hx + 2.0, 4.0, hz + hallD / 2 + 5.0],
      MAT.CONCRETE, { roof: MAT.TRIM });
    parapet(m, hx - hallW / 2, hz + hallD / 2, hx + 2.0, hz + hallD / 2 + 5.0, 4.0, 0.6, 0.26);
    louvres(m, { axis: 'z', sign: 1, plane: hz + hallD / 2 + 5.0 }, hx - 8.0, hx - 2.0, 1.0, 3.2);
    ribbon(m, { axis: 'z', sign: 1, plane: hz + hallD / 2 + 5.0 }, hx - 1.0, hx + 1.4, 1.4, 2.8);
    m.painted(TINT.METAL_DARK, () => {
      m.cylinder(x - 12.0, -8.0, 1.5, 2.2, 2.4, 14, MAT.TRIM, false);
      for (const px of [x - 15.5, x - 8.5]) {
        m.box([px - 1.7, 0, -8.9], [px - 0.9, 2.2, -7.1], MAT.TRIM);
        m.box([px + 0.9, 0, -8.9], [px + 1.7, 2.2, -7.1], MAT.TRIM);
      }
      m.pipe([x - 12.0, 2.4, -8.0], [x - 5.0, 2.4, -8.0], 0.4, MAT.TRIM);
      m.pipe([x - 5.0, 2.4, -8.0], [x - 5.0, 2.4, z - 10.0], 0.4, MAT.TRIM);
    });
    m.cylinder(x - 12.0, -8.0, 1.4, 2.4, 9.0, 14, MAT.METAL, false);
    m.cone(x - 12.0, -8.0, 1.4, 0.5, 9.0, 10.2, 14, MAT.METAL);
    serviceYard(m, hx - hallW / 2, hx + hallW / 2, z - 0.3, 1103, { cycles: false });
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

/** Water tower: a bowl on a shaft. The most recognisable object in the set. */
function waterTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const shaft = 22.0, r = 7.0;

  // Shaft, then a flared bowl: two cones back to back with a cylinder between.
  m.cylinder(0, 0, 2.6, 0, shaft, 16, MAT.CONCRETE, false);
  m.cone(0, 0, 2.6, r, shaft, shaft + 4.5, 20, MAT.CONCRETE);
  m.cylinder(0, 0, r, shaft + 4.5, shaft + 9.5, 20, MAT.CONCRETE, false);
  m.cone(0, 0, r, r * 0.55, shaft + 9.5, shaft + 11.6, 20, MAT.METAL);

  if (medium) {
    m.cylinder(0, 0, 3.4, 0, 1.6, 16, MAT.CONCRETE);
    m.cylinder(0, 0, r + 0.25, shaft + 4.3, shaft + 4.9, 20, MAT.CONCRETE, false);
    m.cylinder(0, 0, r + 0.25, shaft + 9.0, shaft + 9.6, 20, MAT.CONCRETE, false);
    // Walkway round the bowl.
    m.painted(TINT.METAL_DARK, () => {
      m.cylinder(0, 0, r + 1.1, shaft + 4.7, shaft + 4.9, 20, MAT.TRIM, false);
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        m.box([Math.cos(a) * (r + 1.05) - 0.05, shaft + 4.9, Math.sin(a) * (r + 1.05) - 0.05],
              [Math.cos(a) * (r + 1.05) + 0.05, shaft + 6.0, Math.sin(a) * (r + 1.05) + 0.05], MAT.TRIM);
      }
      m.cylinder(0, 0, r + 1.1, shaft + 5.9, shaft + 6.02, 20, MAT.TRIM, false);
    });
  }
  if (fine) {
    m.painted(TINT.METAL_DARK, () => {
      // Caged ladder the full height of the shaft.
      const n = Math.floor(shaft / 0.6);
      for (let i = 1; i < n; i++) {
        m.box([-0.36, 1.6 + i * 0.6, 2.6], [0.36, 1.68 + i * 0.6, 2.72], MAT.TRIM);
      }
      for (const dx of [-0.4, 0.4]) {
        m.box([dx - 0.05, 1.6, 2.6], [dx + 0.05, shaft + 4.9, 2.75], MAT.TRIM);
      }
      for (let i = 0; i < 7; i++) {
        m.cylinder(0, 2.72, 0.85, 3.0 + i * 2.6, 3.12 + i * 2.6, 12, MAT.TRIM, false);
      }
      // Riser and overflow down the outside.
      m.box([2.5, 0, -0.35], [2.9, shaft + 4.5, 0.35], MAT.TRIM);
      // Aircraft warning light and an aerial on the crown.
      m.box([-0.1, shaft + 11.6, -0.1], [0.1, shaft + 14.5, 0.1], MAT.TRIM);
    });
    m.painted(TINT.SIGN_LIT, () =>
      m.box([-0.28, shaft + 11.6, -0.28], [0.28, shaft + 12.1, 0.28], MAT.TRIM));
    // Valve house at the foot, and the compound round it.
    controlBlock(m, -9.5, 3.0, -3.5, 8.0, 3.6, 1111);
    // Manifold at the foot: inlet, outlet, washout and a meter chamber.
    m.painted(TINT.METAL_DARK, () => {
      for (const [ox, oz] of [[-4.2, 1.6], [4.2, 1.6], [0.0, 5.2]] as const) {
        m.pipe([ox * 0.35, 1.2, oz * 0.35], [ox, 1.2, oz], 0.36, MAT.TRIM);
        m.box([ox - 0.5, 1.2, oz - 0.5], [ox + 0.5, 2.1, oz + 0.5], MAT.TRIM);
        m.cylinder(ox, oz, 0.42, 2.1, 2.24, 10, MAT.TRIM);
        m.box([ox - 0.7, 0, oz - 0.7], [ox + 0.7, 0.3, oz + 0.7], MAT.CONCRETE);
      }
      // Intermediate landings on the shaft ladder.
      for (const y of [8.0, 15.0]) {
        m.cylinder(0, 0, 3.4, y, y + 0.14, 14, MAT.TRIM, false);
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          m.box([Math.cos(a) * 3.3 - 0.05, y + 0.14, Math.sin(a) * 3.3 - 0.05],
                [Math.cos(a) * 3.3 + 0.05, y + 1.1, Math.sin(a) * 3.3 + 0.05], MAT.TRIM);
        }
        m.cylinder(0, 0, 3.4, y + 1.0, y + 1.12, 14, MAT.TRIM, false);
      }
      // Two kiosks in the compound: chlorination and telemetry.
      // Standby generator and its fuel tank in the compound.
      m.box([-10.6, 0, -8.4], [-5.4, 3.0, -4.6], MAT.TRIM);
      m.box([-10.8, 3.0, -8.6], [-5.2, 3.3, -4.4], MAT.TRIM);
      for (let i = 0; i < 8; i++) {
        m.box([-10.6, 0.6 + i * 0.28, -4.62], [-5.4, 0.78 + i * 0.28, -4.5], MAT.TRIM);
      }
      m.cylinder(-3.6, -6.4, 1.1, 0.6, 3.6, 12, MAT.TRIM, false);
      for (const oz of [-7.2, -5.6]) m.box([-4.9, 0, oz - 0.4], [-2.3, 0.6, oz + 0.4], MAT.TRIM);
      for (const cx of [5.0, 8.6]) {
        m.box([cx, 0, -8.0], [cx + 2.6, 2.6, -5.4], MAT.TRIM);
        m.box([cx - 0.15, 2.6, -8.15], [cx + 2.75, 2.85, -5.25], MAT.TRIM);
      }
    });
    railing(m, -12.0, 12.0, 12.0, 0, 2.2, 1.7);
    kerb(m, -12.0, 12.0, 12.0, 12.4);
  }
  return m;
}

/** Sewage treatment works: circular tanks, an aeration lane, a sludge drum. */
function treatmentWorks(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 22.0, z = 17.0;

  // Two clarifiers with rotating bridges, and a rectangular aeration lane.
  for (const cx of [-13.0, 1.0] as const) {
    m.cylinder(cx, -6.0, 7.0, 0, 3.6, 22, MAT.CONCRETE, false);
    m.cylinder(cx, -6.0, 6.6, 0.2, 3.4, 22, MAT.GLASS);
    m.cylinder(cx, -6.0, 1.3, 3.4, 6.2, 12, MAT.CONCRETE);
  }
  m.box([-x + 2.0, 0, z - 11.0], [x - 9.0, 3.4, z - 2.0], MAT.CONCRETE);
  m.box([-x + 2.6, 0.3, z - 10.4], [x - 9.6, 3.2, z - 2.6], MAT.GLASS);

  if (medium) {
    for (const cx of [-13.0, 1.0] as const) {
      m.cylinder(cx, -6.0, 7.15, 3.35, 3.75, 22, MAT.TRIM, false);
      // The rotating bridge: a truss from the centre column to the rim.
      m.painted(TINT.METAL_DARK, () => {
        m.box([cx - 7.2, 3.7, -6.4], [cx + 7.2, 4.2, -5.6], MAT.TRIM);
        m.box([cx - 7.2, 4.2, -6.55], [cx + 7.2, 5.2, -6.42], MAT.TRIM);
        m.box([cx - 7.2, 4.2, -5.58], [cx + 7.2, 5.2, -5.45], MAT.TRIM);
        for (let i = 0; i <= 8; i++) {
          const px = cx - 7.2 + i * 1.8;
          m.box([px - 0.05, 4.2, -6.55], [px + 0.05, 5.2, -5.45], MAT.TRIM);
        }
      });
    }
    // Cross walls in the aeration lane, and the diffuser grid below them.
    for (let i = 1; i < 5; i++) {
      const px = -x + 2.0 + i * ((x - 11.0) / 5);
      m.box([px - 0.3, 0, z - 11.0], [px + 0.3, 3.6, z - 2.0], MAT.CONCRETE);
    }
    tank(m, x - 5.0, -2.0, 4.0, 13.0);
    roofClutter(m, -x + 3, z - 10.0, -x + 9, z - 3.0, 3.6, 1121, 0.3);
  }
  if (fine) {
    controlBlock(m, -8.0, z - 8.5, -0.5, z - 1.0, 4.4, 1123);
    m.painted(TINT.METAL_DARK, () => {
      // Handrail round the aeration lane.
      for (let i = 0; i <= 24; i++) {
        const px = -x + 2.0 + i * ((x - 11.0) / 24);
        for (const pz of [z - 11.0, z - 2.0]) {
          m.box([px - 0.05, 3.4, pz - 0.05], [px + 0.05, 4.5, pz + 0.05], MAT.TRIM);
        }
      }
      for (const pz of [z - 11.0, z - 2.0]) {
        m.box([-x + 2.0, 4.4, pz - 0.06], [x - 9.0, 4.5, pz + 0.06], MAT.TRIM);
      }
      // Inlet screens and the pipe bridge feeding the clarifiers.
      m.pipe([-x + 1.0, 2.2, z - 6.5], [-13.0, 2.2, z - 6.5], 0.55, MAT.TRIM);
      m.pipe([-13.0, 2.2, z - 6.5], [-13.0, 2.2, 1.0], 0.55, MAT.TRIM);
      m.pipe([-13.0, 2.2, -1.0], [1.0, 2.2, -1.0], 0.45, MAT.TRIM);
      for (const cx of [-13.0, 1.0] as const) {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          m.box([cx + Math.cos(a) * 7.0 - 0.2, 3.6, -6.0 + Math.sin(a) * 7.0 - 0.2],
                [cx + Math.cos(a) * 7.0 + 0.2, 4.4, -6.0 + Math.sin(a) * 7.0 + 0.2], MAT.TRIM);
        }
      }
    });
    railing(m, -x, x, z, 0, 2.2, 1.8);
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

/** Service reservoir: a covered bank with vent stacks and an access kiosk. */
function reservoir(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 20.0, z = 15.0;
  const h = 5.5;

  // A buried tank reads as a grassed mound with a concrete edge: the top slab
  // is the whole building, and the vents are what tell you it is one.
  m.box([-x + 1.0, 0, -z + 1.0], [x - 1.0, h, z - 3.0], MAT.CONCRETE);
  m.painted(TINT.GREEN, () =>
    m.box([-x + 1.6, h, -z + 1.6], [x - 1.6, h + 0.5, z - 3.6], MAT.TRIM));

  if (medium) {
    band(m, -x + 1.0, -z + 1.0, x - 1.0, z - 3.0, h - 0.9, 0.9, 0.4);
    // Buttresses round the tank wall.
    for (let i = 0; i <= 10; i++) {
      const px = -x + 1.0 + (i / 10) * (2 * x - 2.0);
      m.box([px - 0.35, 0, z - 3.4], [px + 0.35, h - 0.4, z - 3.0], MAT.CONCRETE);
      m.box([px - 0.35, 0, -z + 0.6], [px + 0.35, h - 0.4, -z + 1.0], MAT.CONCRETE);
    }
    for (let i = 0; i <= 6; i++) {
      const pz = -z + 1.0 + (i / 6) * (2 * z - 4.0);
      m.box([x - 1.4, 0, pz - 0.35], [x - 1.0, h - 0.4, pz + 0.35], MAT.CONCRETE);
      m.box([-x + 1.0, 0, pz - 0.35], [-x + 1.4, h - 0.4, pz + 0.35], MAT.CONCRETE);
    }
  }
  if (fine) {
    // Vent stacks and access hatches across the deck.
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 2; j++) {
        const vx = -x + 6.0 + i * 8.0;
        const vz = -z + 5.0 + j * 8.0;
        m.cylinder(vx, vz, 0.75, h + 0.5, h + 3.2, 12, MAT.METAL);
        m.cone(vx, vz, 1.05, 0.35, h + 3.2, h + 4.0, 12, MAT.METAL);
        m.painted(TINT.METAL_DARK, () => {
          m.box([vx - 1.2, h + 0.5, vz + 1.6], [vx + 1.2, h + 0.72, vz + 3.4], MAT.TRIM);
          for (let k = 0; k <= 6; k++) {
            const px = vx - 1.15 + k * 0.38;
            m.box([px - 0.04, h + 0.72, vz + 1.6], [px + 0.04, h + 1.6, vz + 1.7], MAT.TRIM);
          }
          m.box([vx - 1.2, h + 1.5, vz + 1.58], [vx + 1.2, h + 1.6, vz + 1.72], MAT.TRIM);
        });
      }
    }
    controlBlock(m, -6.0, z - 2.8, 1.0, z + 1.6, 4.0, 1131);
    m.painted(TINT.METAL_DARK, () => {
      m.pipe([1.4, 2.4, z - 0.6], [x - 1.2, 2.4, z - 0.6], 0.48, MAT.TRIM);
      m.box([x - 1.6, 1.6, z - 1.1], [x - 0.6, 3.2, z - 0.1], MAT.TRIM);
    });
    // Inlet chamber with penstocks, and steps up the embankment.
    m.box([-x + 2.0, 0, z - 2.4], [-x + 8.0, 3.0, z + 0.6], MAT.CONCRETE, { roof: MAT.TRIM });
    louvres(m, { axis: 'z', sign: 1, plane: z + 0.6 }, -x + 3.0, -x + 7.0, 1.0, 2.4);
    m.painted(TINT.METAL_DARK, () => {
      for (const cx of [-x + 3.6, -x + 6.4]) {
        m.box([cx - 0.5, 3.0, z - 1.6], [cx + 0.5, 3.9, z - 0.2], MAT.TRIM);
        m.cylinder(cx, z - 0.9, 0.44, 3.9, 4.04, 10, MAT.TRIM);
      }
      for (let i = 0; i < 9; i++) {
        m.box([x - 8.0, i * (h / 9), z - 3.0 - i * 0.34],
              [x - 4.0, (i + 1) * (h / 9), z - 2.7 - i * 0.34], MAT.TRIM);
      }
      for (const px of [x - 8.1, x - 3.9]) {
        m.box([px - 0.05, 0.9, z - 6.2], [px + 0.05, h + 1.0, z - 2.7], MAT.TRIM);
      }
    });
    railing(m, -x, x, z + 1.8, 0, 2.0, 1.7);
    kerb(m, -x, z + 1.8, x, z + 2.2);
  }
  return m;
}

// ================================================================ electricity

/** Substation: transformer bays under a gantry, inside a fenced compound. */
function substation(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 20.0, z = 15.0;

  m.box([-x, 0.0005, -z], [x, 0.1, z], MAT.CONCRETE);
  // Three transformer bays: a drum on a bund with a radiator bank each side.
  for (let i = 0; i < 3; i++) {
    const cx = -12.0 + i * 8.5;
    m.box([cx - 3.4, 0.1, -8.0], [cx + 3.4, 0.85, -1.0], MAT.CONCRETE);
    m.cylinder(cx, -4.5, 2.1, 0.85, 5.4, 14, MAT.METAL, false);
    m.cylinder(cx, -4.5, 2.2, 5.4, 5.9, 14, MAT.CONCRETE);
    m.painted(TINT.METAL_DARK, () => {
      for (const sx of [-1, 1] as const) {
        for (let k = 0; k < 7; k++) {
          m.box([cx + sx * 2.2, 1.4, -6.4 + k * 0.55],
                [cx + sx * 3.2, 5.0, -6.15 + k * 0.55], MAT.TRIM);
        }
      }
    });
    // Bushings on top: three per transformer, and they name the object.
    for (const t of [-1.1, 0, 1.1]) {
      m.cone(cx + t, -4.5, 0.42, 0.2, 5.9, 8.2, 10, MAT.GLASS);
      m.cylinder(cx + t, -4.5, 0.22, 8.2, 8.6, 8, MAT.METAL);
    }
  }

  if (medium) {
    // Gantry across the compound with strung conductors.
    for (const cx of [-x + 3.0, x - 3.0] as const) lattice(m, cx, 4.0, 1.8, 13.0);
    m.painted(TINT.METAL_DARK, () => {
      for (const y of [10.4, 12.2]) {
        m.box([-x + 2.1, y, 3.9], [x - 2.1, y + 0.22, 4.1], MAT.TRIM);
      }
      for (const t of [-0.6, 0, 0.6]) {
        m.box([-x + 2.4 + (t + 1) * 0.9, 9.0, 3.95], [x - 2.4 + (t + 1) * 0.9, 9.12, 4.05], MAT.TRIM);
      }
    });
    // Isolator stacks between the bays.
    for (let i = 0; i < 4; i++) {
      const cx = -16.0 + i * 8.5;
      for (const t of [-1.0, 0, 1.0]) {
        m.cylinder(cx + t, 1.5, 0.16, 0.1, 3.4, 8, MAT.CONCRETE);
        m.cone(cx + t, 1.5, 0.34, 0.16, 3.4, 5.0, 8, MAT.GLASS);
      }
      m.box([cx - 1.5, 0.1, 1.1], [cx + 1.5, 0.5, 1.9], MAT.CONCRETE);
    }
  }
  if (fine) {
    controlBlock(m, -8.0, z - 8.0, 1.0, z - 1.0, 4.6, 1141);
    louvres(m, { axis: 'x', sign: 1, plane: 1.0 }, z - 7.0, z - 2.0, 1.2, 3.4);
    m.painted(TINT.METAL_DARK, () => {
      // Cable trench covers and the earth mat tails.
      for (let i = 0; i < 3; i++) {
        const cx = -12.0 + i * 8.5;
        m.box([cx - 0.6, 0.1, -1.0], [cx + 0.6, 0.24, z - 8.0], MAT.TRIM);
      }
      // Palisade fence with a warning sign.
      for (let i = 0; i <= 30; i++) {
        const px = -x + i * (2 * x / 30);
        m.box([px - 0.06, 0, -z - 0.06], [px + 0.06, 2.6, -z + 0.06], MAT.TRIM);
        m.box([px - 0.06, 0, z - 0.06], [px + 0.06, 2.6, z + 0.06], MAT.TRIM);
      }
      for (const pz of [-z, z] as const) m.box([-x, 2.45, pz - 0.08], [x, 2.55, pz + 0.08], MAT.TRIM);
    });
    m.painted(TINT.SIGN_LIT, () => m.box([-2.4, 1.4, z - 0.16], [-0.6, 2.3, z + 0.02], MAT.TRIM));
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

/** Gas turbine plant: a ribbed hall, two stacks and an air intake bank. */
function gasPlant(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 22.0, z = 17.0;
  const hallW = 30.0, hallD = 16.0, hallH = 15.0;
  const hz = -3.0;

  m.box([-hallW / 2, 0, hz - hallD / 2], [hallW / 2, hallH, hz + hallD / 2], MAT.CLADDING,
    { roof: MAT.TRIM });

  if (medium) {
    // Ribs the full height, and a deep eaves fascia.
    for (let i = 0; i <= 12; i++) {
      const px = -hallW / 2 + (i / 12) * hallW;
      m.box([px - 0.22, 0, hz - hallD / 2 - 0.3], [px + 0.22, hallH + 0.4, hz + hallD / 2 + 0.3],
        MAT.CONCRETE);
    }
    m.box([-hallW / 2 - 0.7, hallH + 0.4, hz - hallD / 2 - 0.7],
          [hallW / 2 + 0.7, hallH + 1.1, hz + hallD / 2 + 0.7], MAT.CONCRETE);
    // Two stacks with banded liners.
    for (const cx of [-7.0, 7.0] as const) {
      m.cylinder(cx, hz - hallD / 2 - 4.5, 2.0, 0, 34.0, 16, MAT.CONCRETE, false);
      for (let i = 1; i <= 5; i++) {
        m.cylinder(cx, hz - hallD / 2 - 4.5, 2.2, i * 5.6, i * 5.6 + 0.5, 16, MAT.METAL, false);
      }
      m.cylinder(cx, hz - hallD / 2 - 4.5, 2.25, 34.0, 34.6, 16, MAT.METAL, false);
      m.painted(TINT.SIGN_LIT, () =>
        m.box([cx - 0.3, 34.6, hz - hallD / 2 - 4.8], [cx + 0.3, 35.2, hz - hallD / 2 - 4.2], MAT.TRIM));
    }
    tank(m, x - 5.5, z - 6.0, 4.0, 10.0);
  }
  if (fine) {
    // Air intake bank: the whole of one flank, and the only "windows" it has.
    louvres(m, { axis: 'x', sign: -1, plane: -hallW / 2 }, hz - 6.0, hz + 6.0, 5.0, 13.0, 0.5);
    louvres(m, { axis: 'z', sign: 1, plane: hz + hallD / 2 }, -12.0, -2.0, 6.0, 12.0, 0.5);
    ribbon(m, { axis: 'z', sign: 1, plane: hz + hallD / 2 }, 1.0, 13.0, 2.0, 4.4);
    entrance(m, { axis: 'z', sign: 1, plane: hz + hallD / 2 }, 3.0,
      { width: 1.6, height: 2.6, double: true, glazed: true, canopy: 1.8 });
    // Roller shutter for turbine changes.
    m.painted(TINT.METAL_DARK, () => {
      m.box([-13.0, 0, hz + hallD / 2 + 0.02], [-3.0, 6.4, hz + hallD / 2 + 0.2], MAT.TRIM);
      for (let g = 1; g < 12; g++) {
        m.box([-13.0, g * 0.52, hz + hallD / 2 + 0.2], [-3.0, g * 0.52 + 0.1, hz + hallD / 2 + 0.26], MAT.TRIM);
      }
      // Fuel gas line on stools into the hall.
      m.pipe([x - 5.5, 4.0, z - 6.0], [x - 5.5, 4.0, hz], 0.42, MAT.TRIM);
      m.pipe([x - 5.5, 4.0, hz], [hallW / 2 + 0.3, 4.0, hz], 0.42, MAT.TRIM);
      for (let i = 0; i < 4; i++) {
        m.box([x - 5.9, 0, hz + i * 3.4], [x - 5.1, 3.6, hz + i * 3.4 + 0.7], MAT.TRIM);
      }
    });
    lattice(m, -x + 3.0, z - 3.0, 1.6, 16.0, 7.0);
    controlBlock(m, -x + 6.0, z - 7.0, -x + 15.0, z - 1.0, 5.0, 1151);
    boxSign(m, { axis: 'z', sign: 1, plane: hz + hallD / 2 }, 4.0, 12.0, hallH - 2.4, hallH - 1.0);
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

/** Solar array: rows of tilted panels, an inverter house and a fenced field. */
function solarFarm(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 22.0, z = 17.0;
  const rows = 6, perRow = 5;

  m.painted(TINT.GREEN, () => m.box([-x, 0.0005, -z], [x, 0.06, z - 5.0], MAT.TRIM));

  // Panel tables: a tilted plane on two legs, repeated. The tilt is the whole
  // silhouette, so it is modelled rather than implied.
  for (let r = 0; r < rows; r++) {
    const rz = -z + 2.2 + r * 3.6;
    for (let i = 0; i < perRow; i++) {
      const cx = -x + 4.5 + i * 8.6;
      const w = 7.6;
      m.painted(TINT.METAL_DARK, () => {
        m.quad([cx - w / 2, 1.05, rz - 1.3], [cx + w / 2, 1.05, rz - 1.3],
               [cx + w / 2, 2.45, rz + 1.3], [cx - w / 2, 2.45, rz + 1.3], MAT.GLASS);
        m.quad([cx - w / 2, 2.40, rz + 1.3], [cx + w / 2, 2.40, rz + 1.3],
               [cx + w / 2, 1.00, rz - 1.3], [cx - w / 2, 1.00, rz - 1.3], MAT.TRIM);
      });
      if (medium) {
        m.painted(TINT.METAL_DARK, () => {
          for (const px of [cx - w / 2 + 0.9, cx + w / 2 - 0.9]) {
            m.box([px - 0.08, 0, rz - 0.9], [px + 0.08, 1.15, rz - 0.7], MAT.TRIM);
            m.box([px - 0.08, 0, rz + 0.7], [px + 0.08, 2.3, rz + 0.9], MAT.TRIM);
          }
          m.box([cx - w / 2, 1.02, rz - 0.1], [cx + w / 2, 1.18, rz + 0.1], MAT.TRIM);
        });
      }
      if (fine) {
        // Cell grid across each panel: three strings of six.
        m.painted(TINT.METAL_DARK, () => {
          for (let k = 1; k < 6; k++) {
            const t = k / 6;
            m.quad([cx - w / 2 + t * w - 0.03, 1.05, rz - 1.3], [cx - w / 2 + t * w + 0.03, 1.05, rz - 1.3],
                   [cx - w / 2 + t * w + 0.03, 2.46, rz + 1.31], [cx - w / 2 + t * w - 0.03, 2.46, rz + 1.31],
                   MAT.TRIM);
          }
        });
      }
    }
  }

  if (medium) {
    controlBlock(m, -6.0, z - 4.6, 2.0, z - 0.4, 4.0, 1161);
    for (let i = 0; i < 3; i++) {
      const cx = -16.0 + i * 12.0;
      m.box([cx - 1.4, 0, z - 4.2], [cx + 1.4, 2.6, z - 2.0], MAT.CLADDING, { roof: MAT.TRIM });
      m.box([cx - 1.55, 2.6, z - 4.35], [cx + 1.55, 2.85, z - 1.85], MAT.CONCRETE);
    }
  }
  if (fine) {
    for (let i = 0; i < 3; i++) {
      const cx = -16.0 + i * 12.0;
      louvres(m, { axis: 'z', sign: 1, plane: z - 2.0 }, cx - 1.1, cx + 1.1, 0.6, 2.2, 0.26);
    }
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 34; i++) {
        const px = -x + i * (2 * x / 34);
        m.box([px - 0.05, 0, -z - 0.05], [px + 0.05, 2.2, -z + 0.05], MAT.TRIM);
      }
      m.box([-x, 2.05, -z - 0.07], [x, 2.15, -z + 0.07], MAT.TRIM);
      for (let i = 0; i <= 16; i++) {
        const pz = -z + i * ((2 * z - 5.0) / 16);
        for (const sx of [-x, x] as const) {
          m.box([sx - 0.05, 0, pz - 0.05], [sx + 0.05, 2.2, pz + 0.05], MAT.TRIM);
        }
      }
    });
    kerb(m, -x, z, x, z + 0.4);
  }
  dressRoof(m, lod, 3385);
  return m;
}

// ================================================================== transport

/** Bus depot: a portal-framed shed over the stands, with a fuel and wash lane. */
function busDepot(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 22.0, z = 17.0;
  const bays = 5;
  const shedW = 34.0, shedD = 15.0, shedH = 7.5;
  const sz = -4.0;

  // Open-sided shed: portal frames and a roof, no walls on the long sides.
  m.box([-shedW / 2, shedH, sz - shedD / 2 - 0.6], [shedW / 2, shedH + 0.6, sz + shedD / 2 + 0.6],
    MAT.METAL);
  m.box([-shedW / 2 - 0.6, 0, sz - shedD / 2 - 0.6], [-shedW / 2, shedH + 0.6, sz + shedD / 2 + 0.6],
    MAT.CLADDING);
  m.box([shedW / 2, 0, sz - shedD / 2 - 0.6], [shedW / 2 + 0.6, shedH + 0.6, sz + shedD / 2 + 0.6],
    MAT.CLADDING);
  m.box([-shedW / 2, 0, sz - shedD / 2 - 0.6], [shedW / 2, shedH, sz - shedD / 2], MAT.CLADDING);

  if (medium) {
    for (let i = 0; i <= bays; i++) {
      const px = -shedW / 2 + (i / bays) * shedW;
      m.box([px - 0.26, 0, sz + shedD / 2 - 0.26], [px + 0.26, shedH, sz + shedD / 2 + 0.26],
        MAT.CONCRETE);
      m.box([px - 0.3, shedH - 0.5, sz - shedD / 2], [px + 0.3, shedH, sz + shedD / 2 + 0.3],
        MAT.CONCRETE);
    }
    m.box([-shedW / 2, 0.001, sz + shedD / 2], [shedW / 2, 0.1, z], MAT.CONCRETE);
    roofClutter(m, -shedW / 2 + 3, sz - 5, shedW / 2 - 3, sz + 5, shedH + 0.6, 1171, 0.5);
  }
  if (fine) {
    // Rooflights down the shed, and a bus in each of two bays.
    for (let i = 0; i < bays; i++) {
      const a = -shedW / 2 + (i / bays) * shedW + 1.0;
      const b = -shedW / 2 + ((i + 1) / bays) * shedW - 1.0;
      m.box([a, shedH + 0.58, sz - 3.5], [b, shedH + 0.66, sz + 3.5], MAT.GLASS);
      m.box([(a + b) / 2 - 0.06, 0.004, sz + shedD / 2 + 0.5], [(a + b) / 2 + 0.06, 0.02, z - 1.0], MAT.TRIM);
    }
    // Buses on the stands. They were painted slabs on four smaller slabs and
    // hovered half a metre off the yard; this is the real body, wheels down.
    for (let i = 0; i < 2; i++) {
      parkedVehicle(m, 3300 + i * 23, [-13.0, -6.2][i], sz, 1, 'bus');
    }
    controlBlock(m, shedW / 2 + 1.0, sz - 4.0, x - 0.5, sz + 5.0, 6.4, 1173);
    // Workshop annex behind the shed: pits, roller doors, an overhead crane
    // rail. A depot is a garage before it is a shelter.
    m.box([-shedW / 2, 0, sz - shedD / 2 - 12.0], [-shedW / 2 + 16.0, 8.0, sz - shedD / 2 - 0.6],
      MAT.CLADDING, { roof: MAT.TRIM });
    parapet(m, -shedW / 2, sz - shedD / 2 - 12.0, -shedW / 2 + 16.0, sz - shedD / 2 - 0.6, 8.0, 0.8, 0.3);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 3; i++) {
        const a = -shedW / 2 + 1.2 + i * 5.0;
        m.box([a, 0, sz - shedD / 2 - 0.62], [a + 3.6, 5.2, sz - shedD / 2 - 0.46], MAT.TRIM);
        for (let g = 1; g < 10; g++) {
          m.box([a, g * 0.5, sz - shedD / 2 - 0.46], [a + 3.6, g * 0.5 + 0.09, sz - shedD / 2 - 0.4], MAT.TRIM);
        }
      }
      m.box([-shedW / 2 + 0.4, 6.4, sz - shedD / 2 - 6.5], [-shedW / 2 + 15.6, 6.8, sz - shedD / 2 - 6.1], MAT.TRIM);
    });
    ribbon(m, { axis: 'x', sign: -1, plane: -shedW / 2 }, sz - shedD / 2 - 11.0,
      sz - shedD / 2 - 1.6, 5.6, 7.2);
    for (const cx of [0.6, 7.4] as const) {
      m.painted(TINT.BRAND, () => m.box([cx - 1.35, 0.5, sz - 6.0], [cx + 1.35, 3.3, sz + 6.0], MAT.TRIM));
      ribbon(m, { axis: 'x', sign: 1, plane: cx + 1.35 }, sz - 5.4, sz + 4.0, 1.7, 2.7,
        { sill: false, head: false });
    }
    // Two more buses on the far stands, and the stores block.
    for (const cx of [-13.0, 7.4] as const) {
      m.painted(TINT.ACCENT, () =>
        m.box([cx - 1.35, 0.5, z - 11.0], [cx + 1.35, 3.3, z - 1.0], MAT.TRIM));
      ribbon(m, { axis: 'x', sign: 1, plane: cx + 1.35 }, z - 10.4, z - 3.0, 1.7, 2.7,
        { sill: false, head: false });
      ribbon(m, { axis: 'x', sign: -1, plane: cx - 1.35 }, z - 10.4, z - 3.0, 1.7, 2.7,
        { sill: false, head: false });
    }
    // Stores and mess block on the far end of the shed.
    m.box([shedW / 2 + 1.0, 0, sz - shedD / 2], [x - 0.5, 4.6, sz - 5.0], MAT.CLADDING, { roof: MAT.TRIM });
    parapet(m, shedW / 2 + 1.0, sz - shedD / 2, x - 0.5, sz - 5.0, 4.6, 0.6, 0.26);
    ribbon(m, { axis: 'x', sign: 1, plane: x - 0.5 }, sz - shedD / 2 + 0.8, sz - 5.8, 1.3, 3.0);
    louvres(m, { axis: 'z', sign: -1, plane: sz - shedD / 2 }, shedW / 2 + 2.0, x - 1.5, 1.2, 3.4);
    serviceYard(m, -shedW / 2, shedW / 2, z - 1.0, 1175, { cycles: false });
    kerb(m, -x, z, x, z + 0.4);
  }
  dressRoof(m, lod, 3392);
  return m;
}

/** Bus station: island platforms under a long cantilevered canopy. */
function busStation(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 22.0, z = 15.0;
  const canopyH = 6.0;

  m.box([-x, 0.0005, -z], [x, 0.1, z], MAT.CONCRETE);
  // Two island platforms.
  for (const pz of [-6.5, 3.5] as const) {
    m.box([-x + 3.0, 0.1, pz - 1.6], [x - 6.0, 0.36, pz + 1.6], MAT.CONCRETE);
    m.painted(TINT.SIGN_LIT, () =>
      m.box([-x + 3.0, 0.34, pz - 1.62], [x - 6.0, 0.38, pz - 1.42], MAT.TRIM));
  }

  if (medium) {
    // One canopy spanning both, on a single row of columns down the middle.
    m.box([-x + 1.5, canopyH, -9.5], [x - 4.5, canopyH + 0.55, 6.5], MAT.METAL);
    m.box([-x + 1.2, canopyH + 0.55, -9.8], [x - 4.2, canopyH + 0.8, 6.8], MAT.CONCRETE);
    for (let i = 0; i < 6; i++) {
      const px = -x + 4.0 + i * 6.4;
      m.cylinder(px, -1.5, 0.34, 0.36, canopyH, 12, MAT.CONCRETE);
      // Branching arms, which is what makes a canopy read as a station.
      m.painted(TINT.METAL_DARK, () => {
        m.box([px - 0.16, canopyH - 1.6, -8.4], [px + 0.16, canopyH, 5.4], MAT.TRIM);
        m.box([px - 1.6, canopyH - 0.9, -1.7], [px + 1.6, canopyH, -1.3], MAT.TRIM);
      });
    }
  }
  if (fine) {
    // Shelters on the platforms, and departure screens on the columns.
    for (const pz of [-6.5, 3.5] as const) {
      for (let i = 0; i < 4; i++) {
        const cx = -x + 6.0 + i * 8.0;
        m.box([cx - 2.4, 2.6, pz - 1.4], [cx + 2.4, 2.78, pz + 1.4], MAT.METAL);
        m.box([cx - 2.4, 0.36, pz - 1.45], [cx + 2.4, 2.6, pz - 1.3], MAT.GLASS);
        m.painted(TINT.METAL_DARK, () => {
          for (const px of [cx - 2.3, cx + 2.3]) {
            m.box([px - 0.06, 0.36, pz - 1.45], [px + 0.06, 2.6, pz - 1.28], MAT.TRIM);
          }
          m.box([cx - 1.8, 0.76, pz - 1.05], [cx + 1.8, 0.9, pz - 0.35], MAT.TRIM);
          for (const px of [cx - 1.7, cx + 1.7]) {
            m.box([px, 0.36, pz - 1.0], [px + 0.1, 0.76, pz - 0.4], MAT.TRIM);
          }
        });
      }
      m.painted(TINT.SIGN_LIT, () => {
        for (let i = 0; i < 4; i++) {
          const cx = -x + 6.0 + i * 8.0;
          m.box([cx - 0.9, 2.9, pz - 0.12], [cx + 0.9, 3.7, pz + 0.12], MAT.TRIM);
        }
      });
    }
    // Concourse building at one end: glazed, with the ticket hall in it.
    m.box([x - 5.5, 0, -10.0], [x - 0.5, 6.8, 4.0], MAT.CLADDING, { roof: MAT.TRIM });
    parapet(m, x - 5.5, -10.0, x - 0.5, 4.0, 6.8, 0.9, 0.3);
    ribbon(m, { axis: 'x', sign: -1, plane: x - 5.5 }, -9.0, 3.0, 1.2, 4.6);
    fins(m, { axis: 'x', sign: -1, plane: x - 5.5 }, -9.0, 3.0, 0.4, 6.5, 6, 0.4);
    entrance(m, { axis: 'x', sign: -1, plane: x - 5.5 }, -3.0,
      { width: 2.4, height: 3.0, double: true, glazed: true });
    boxSign(m, { axis: 'x', sign: -1, plane: x - 5.5 }, -8.0, -2.0, 5.4, 6.5);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 10; i++) {
        m.box([-x + 2.4, 0.004, -12.0 + i * 2.6], [x - 6.0, 0.02, -11.4 + i * 2.6], MAT.TRIM);
      }
    });
    // Footbridge across the stands with a lift core at each end: the piece
    // that makes an interchange rather than a row of stops.
    m.box([-x + 6.0, 5.4, -12.0], [-x + 9.0, 6.1, 7.0], MAT.CONCRETE);
    m.box([-x + 6.0, 6.1, -12.0], [-x + 9.0, 8.4, -11.7], MAT.GLASS);
    m.box([-x + 6.0, 6.1, 6.7], [-x + 9.0, 8.4, 7.0], MAT.GLASS);
    m.box([-x + 6.0, 8.4, -12.2], [-x + 9.0, 8.8, 7.2], MAT.METAL);
    for (const pz of [-12.0, 7.0] as const) {
      m.box([-x + 5.4, 0, pz - 1.8], [-x + 9.6, 8.8, pz + 1.8], MAT.CLADDING, { roof: MAT.TRIM });
      ribbon(m, { axis: 'x', sign: -1, plane: -x + 5.4 }, pz - 1.2, pz + 1.2, 1.4, 6.4,
        { sill: false });
      parapet(m, -x + 5.4, pz - 1.8, -x + 9.6, pz + 1.8, 8.8, 0.7, 0.3);
    }
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 12; i++) {
        const pz = -11.6 + i * 1.55;
        m.box([-x + 5.9, 6.1, pz - 0.05], [-x + 6.05, 8.4, pz + 0.05], MAT.TRIM);
        m.box([-x + 8.95, 6.1, pz - 0.05], [-x + 9.1, 8.4, pz + 0.05], MAT.TRIM);
      }
    });
    // Two more shelters and the taxi rank canopy at the far end.
    for (const pz of [-6.5, 3.5] as const) {
      for (const cx of [x - 12.0, x - 8.0] as const) {
        m.box([cx - 1.8, 2.6, pz - 1.4], [cx + 1.8, 2.78, pz + 1.4], MAT.METAL);
        m.box([cx - 1.8, 0.36, pz - 1.45], [cx + 1.8, 2.6, pz - 1.3], MAT.GLASS);
      }
    }
    portal(m, -x + 2.0, -x + 11.0, -z + 1.0, 4.4, 3.2, 2);
    // Stand markings and bollards along the apron edge.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 8; i++) {
        const px = -x + 4.0 + i * 4.6;
        m.box([px - 0.16, 0.1, -z + 2.4], [px + 0.16, 1.0, -z + 2.72], MAT.TRIM);
        m.box([px - 0.2, 1.0, -z + 2.36], [px + 0.2, 1.12, -z + 2.76], MAT.TRIM);
      }
    });
    serviceYard(m, -x, -x + 14.0, z - 2.0, 1181, { flag: false, cycles: true });
    kerb(m, -x, z, x, z + 0.4);
  }
  dressRoof(m, lod, 3399);
  return m;
}

/** Metro entrance: a glazed drum over the stair, and a vent shaft beside it. */
function metroEntrance(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 12.0, z = 10.0;

  m.box([-x, 0.0005, -z], [x, 0.1, z], MAT.CONCRETE);
  // The drum: a glazed cylinder with a flat disc roof cantilevered past it.
  m.cylinder(-2.0, 0, 4.2, 0.1, 5.2, 20, MAT.GLASS, false);
  m.cylinder(-2.0, 0, 5.4, 5.2, 5.75, 22, MAT.CONCRETE);
  m.cylinder(-2.0, 0, 1.1, 5.75, 7.4, 12, MAT.METAL);

  if (medium) {
    m.cylinder(-2.0, 0, 4.35, 0.1, 1.0, 20, MAT.CONCRETE, false);
    m.cylinder(-2.0, 0, 4.35, 4.9, 5.2, 20, MAT.CONCRETE, false);
    // Mullions round the drum.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        m.box([-2.0 + Math.cos(a) * 4.28 - 0.07, 1.0, Math.sin(a) * 4.28 - 0.07],
              [-2.0 + Math.cos(a) * 4.28 + 0.07, 4.9, Math.sin(a) * 4.28 + 0.07], MAT.TRIM);
      }
    });
    // Vent shaft: a louvred box, deliberately blunt beside the drum.
    m.box([x - 5.5, 0, -4.0], [x - 1.0, 6.4, 0.5], MAT.CONCRETE, { roof: MAT.TRIM });
    m.box([x - 5.8, 6.4, -4.3], [x - 0.7, 6.9, 0.8], MAT.CONCRETE);
  }
  if (fine) {
    // The stair down, seen through the glass: treads and a balustrade.
    m.painted(TINT.METAL_DARK, () => {
      // Stair up to a landing rather than down into a hole: the mesh sits on
      // the ground plane, and anything below it is geometry nobody can see.
      for (let i = 0; i < 9; i++) {
        m.box([-4.6 + i * 0.62, 0.1, -1.8], [-4.0 + i * 0.62, 0.28 + i * 0.17, 1.8], MAT.TRIM);
      }
      m.box([-4.8, 0.3, -2.0], [1.4, 1.9, -1.85], MAT.TRIM);
      m.box([-4.8, 0.3, 1.85], [1.4, 1.9, 2.0], MAT.TRIM);
      m.box([0.8, 0.1, -1.9], [2.4, 1.75, 1.9], MAT.TRIM);
    });
    louvres(m, { axis: 'z', sign: 1, plane: x - 1.0 }, -3.4, -0.1, 1.6, 5.6);
    louvres(m, { axis: 'z', sign: -1, plane: x - 5.5 }, -3.4, -0.1, 1.6, 5.6);
    louvres(m, { axis: 'x', sign: -1, plane: x - 5.5 }, -3.4, -0.1, 1.6, 5.6);
    // Fan cowl on the shaft head, which is what the shaft is for.
    m.cylinder(x - 3.25, -1.75, 1.5, 6.9, 8.4, 14, MAT.METAL, false);
    m.cone(x - 3.25, -1.75, 1.9, 0.6, 8.4, 9.4, 14, MAT.METAL);
    louvres(m, { axis: 'x', sign: 1, plane: x - 1.0 }, -3.4, -0.1, 1.6, 5.6);
    // Totem with the network mark, and a map board.
    m.painted(TINT.METAL_DARK, () => m.box([-8.0, 0, 1.4], [-7.7, 4.2, 1.7], MAT.TRIM));
    m.painted(TINT.BRAND, () => m.box([-8.9, 2.6, 1.3], [-6.8, 4.6, 1.8], MAT.TRIM));
    m.painted(TINT.SIGN_LIT, () =>
      m.signFace([-8.75, 2.8, 1.82], [-6.95, 2.8, 1.82], [-6.95, 4.4, 1.82], [-8.75, 4.4, 1.82], MAT.TRIM));
    m.painted(TINT.METAL_DARK, () => {
      m.box([2.6, 0, 4.4], [5.4, 2.4, 4.6], MAT.TRIM);
      m.box([2.7, 0.7, 4.35], [5.3, 2.1, 4.42], MAT.GLASS);
    });
    // Lift shaft beside the drum, and a second stair down to the far side --
    // a metro entrance is two ways in and a machine, never one door.
    m.box([-x + 1.5, 0, -6.0], [-x + 5.1, 8.2, -2.4], MAT.CLADDING, { roof: MAT.TRIM });
    parapet(m, -x + 1.5, -6.0, -x + 5.1, -2.4, 8.2, 0.7, 0.3);
    ribbon(m, { axis: 'z', sign: 1, plane: -2.4 }, -x + 2.2, -x + 4.4, 1.2, 6.6, { sill: false });
    entrance(m, { axis: 'z', sign: 1, plane: -2.4 }, -x + 3.3,
      { width: 1.6, height: 2.4, double: true, glazed: true });
    m.painted(TINT.METAL_DARK, () => {
      m.box([-x + 1.2, 8.2, -6.3], [-x + 5.4, 8.9, -2.1], MAT.TRIM);
      // Second stair, railed, going down at the back of the plot.
      for (let i = 0; i < 8; i++) {
        m.box([3.0, 0.1, -8.6 + i * 0.55], [7.4, 0.28 + i * 0.16, -8.15 + i * 0.55], MAT.TRIM);
      }
      for (const px of [2.9, 7.5]) {
        m.box([px - 0.06, 0.3, -8.8], [px + 0.06, 1.6, -3.9], MAT.TRIM);
      }
      // Cycle shelter.
      m.box([5.0, 2.3, 3.0], [10.4, 2.5, 6.0], MAT.TRIM);
      for (const [px, pz] of [[5.3, 5.6], [10.1, 5.6]] as const) {
        m.box([px - 0.08, 0, pz - 0.08], [px + 0.08, 2.3, pz + 0.08], MAT.TRIM);
      }
      for (let i = 0; i < 5; i++) {
        const hx2 = 5.6 + i * 1.1;
        m.box([hx2 - 0.05, 0, 3.6], [hx2 + 0.05, 0.85, 3.7], MAT.TRIM);
        m.box([hx2 - 0.05, 0, 5.0], [hx2 + 0.05, 0.85, 5.1], MAT.TRIM);
        m.box([hx2 - 0.05, 0.77, 3.6], [hx2 + 0.05, 0.85, 5.1], MAT.TRIM);
      }
    });
    // Ticket machines and a bench under the disc roof, which is the whole
    // point of a cantilever that size.
    m.painted(TINT.METAL_DARK, () => {
      for (const a of [2.1, 2.9]) {
        const mx = -2.0 + Math.cos(a) * 3.1, mz = Math.sin(a) * 3.1;
        m.box([mx - 0.45, 0.1, mz - 0.3], [mx + 0.45, 1.7, mz + 0.3], MAT.TRIM);
        m.box([mx - 0.36, 1.05, mz + 0.28], [mx + 0.36, 1.55, mz + 0.4], MAT.TRIM);
      }
      m.box([-5.4, 0.5, 2.6], [-1.4, 0.62, 3.2], MAT.TRIM);
      m.box([-5.4, 0.62, 2.58], [-1.4, 1.3, 2.72], MAT.TRIM);
      for (const px of [-5.1, -1.7]) m.box([px, 0.1, 2.65], [px + 0.12, 0.5, 3.15], MAT.TRIM);
    });
    // Balustrade round the stair well and a line of bollards to the kerb.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        m.box([-2.0 + Math.cos(a) * 5.6 - 0.06, 0.1, Math.sin(a) * 5.6 - 0.06],
              [-2.0 + Math.cos(a) * 5.6 + 0.06, 1.05, Math.sin(a) * 5.6 + 0.06], MAT.TRIM);
      }
      m.cylinder(-2.0, 0, 5.6, 0.95, 1.06, 14, MAT.TRIM, false);
      for (let i = 0; i < 6; i++) {
        m.cylinder(-9.0 + i * 3.4, z - 2.2, 0.16, 0, 0.95, 8, MAT.TRIM);
      }
    });
    railing(m, -x + 1.0, x - 1.0, z - 1.0, 0, 1.05, 1.4);
    kerb(m, -x, z, x, z + 0.4);
  }
  dressRoof(m, lod, 3406);
  return m;
}

/** Rail station: a glazed train shed on trusses over two platforms. */
function railStation(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 24.0, z = 18.0;
  const shedW = 40.0, shedD = 20.0, eave = 9.0, rise = 4.0;
  const sz = -2.0;

  m.box([-x, 0.0005, -z], [x, 0.1, z], MAT.CONCRETE);
  // Two platforms with a track slot between them.
  for (const pz of [sz - 6.5, sz + 6.5] as const) {
    m.box([-shedW / 2 + 1.0, 0.1, pz - 2.4], [shedW / 2 - 1.0, 1.0, pz + 2.4], MAT.CONCRETE);
    m.painted(TINT.SIGN_LIT, () =>
      m.box([-shedW / 2 + 1.0, 0.98, pz - 2.42], [shedW / 2 - 1.0, 1.02, pz - 2.2], MAT.TRIM));
  }
  m.painted(TINT.METAL_DARK, () => {
    for (const rx of [-0.72, 0.72]) {
      m.box([-shedW / 2, 0.1, sz + rx - 0.07], [shedW / 2, 0.24, sz + rx + 0.07], MAT.TRIM);
    }
  });

  if (medium) {
    // Train shed: a shallow pitched glazed roof on lattice trusses.
    m.gable([-shedW / 2, eave, sz - shedD / 2], [shedW / 2, eave, sz + shedD / 2], rise, 'x',
      MAT.GLASS, MAT.CLADDING);
    for (let i = 0; i <= 8; i++) {
      const px = -shedW / 2 + (i / 8) * shedW;
      m.box([px - 0.3, 0.1, sz - shedD / 2], [px + 0.3, eave, sz - shedD / 2 + 0.6], MAT.CONCRETE);
      m.box([px - 0.3, 0.1, sz + shedD / 2 - 0.6], [px + 0.3, eave, sz + shedD / 2], MAT.CONCRETE);
      m.painted(TINT.METAL_DARK, () => {
        m.box([px - 0.18, eave - 0.9, sz - shedD / 2], [px + 0.18, eave, sz + shedD / 2], MAT.TRIM);
        for (let k = 0; k < 9; k++) {
          const t = k / 8;
          const py = eave + (0.5 - Math.abs(t - 0.5)) * rise * 2;
          m.box([px - 0.14, py - 0.5, sz - shedD / 2 + t * shedD - 0.14],
                [px + 0.14, py, sz - shedD / 2 + t * shedD + 0.14], MAT.TRIM);
        }
      });
    }
  }
  if (fine) {
    // Concourse across one end: glazed, finned, with the clock over the doors.
    m.box([-x + 1.0, 0, sz + shedD / 2], [x - 1.0, 8.0, z - 1.0], MAT.CLADDING, { roof: MAT.TRIM });
    parapet(m, -x + 1.0, sz + shedD / 2, x - 1.0, z - 1.0, 8.0, 1.0, 0.34);
    ribbon(m, { axis: 'z', sign: 1, plane: z - 1.0 }, -x + 2.4, x - 2.4, 1.4, 5.4, { mullions: 14 });
    fins(m, { axis: 'z', sign: 1, plane: z - 1.0 }, -x + 2.4, x - 2.4, 0.4, 7.6, 12, 0.5);
    portal(m, -6.0, 6.0, z - 1.0, 8.0, 2.6, 2);
    entrance(m, { axis: 'z', sign: 1, plane: z - 1.0 }, 0,
      { width: 4.0, height: 3.4, double: true, glazed: true });
    m.painted(TINT.SIGN_LIT, () => {
      m.cylinder(0, z - 0.85, 1.05, 0, 0.12, 16, MAT.TRIM);
      m.box([-1.05, 5.9, z - 0.98], [1.05, 6.0, z - 0.82], MAT.TRIM);
    });
    m.painted(TINT.METAL_DARK, () => {
      m.cylinder(0, z - 0.9, 1.15, 5.85, 6.05, 18, MAT.TRIM, false);
      // Departure boards over the platform ends.
      for (const pz of [sz - 6.5, sz + 6.5] as const) {
        m.box([-3.0, 3.4, pz - 0.14], [3.0, 4.6, pz + 0.14], MAT.TRIM);
      }
    });
    boxSign(m, { axis: 'z', sign: 1, plane: z - 1.0 }, -7.0, 7.0, 6.4, 7.7);
    // Platform furniture: benches and lamp columns.
    m.painted(TINT.METAL_DARK, () => {
      for (const pz of [sz - 6.5, sz + 6.5] as const) {
        for (let i = 0; i < 5; i++) {
          const cx = -shedW / 2 + 5.0 + i * 7.5;
          m.box([cx - 1.3, 1.4, pz - 0.3], [cx + 1.3, 1.5, pz + 0.3], MAT.TRIM);
          m.box([cx - 1.3, 1.5, pz - 0.32], [cx + 1.3, 2.1, pz - 0.2], MAT.TRIM);
          m.box([cx - 0.1, 1.0, pz - 1.9], [cx + 0.1, 4.6, pz - 1.7], MAT.TRIM);
          m.box([cx - 0.7, 4.5, pz - 2.0], [cx + 0.7, 4.7, pz - 1.6], MAT.TRIM);
        }
      }
    });
    serviceYard(m, -x + 1.0, x - 1.0, z - 1.0, 1191, { flag: false });
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

// ==================================================================== table

const util = (jobs: number, upkeep: number, power: number, water: number): AssetDef['sim'] => ({
  jobs, powerKW: power, waterM3: water, garbagePerWeek: jobs * 6, pollution: 0, upkeep,
});

export const UTILITY: AssetDef[] = [
  { id: 'svc.water.pump', name: 'Pumping station', zone: 'service', branch: 'water', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 11.0, brand: { name: 'Water', colour: [0.16, 0.52, 0.62], accent: [0.70, 0.72, 0.74], sign: 'box' }, sim: util(10, 210, 420, 0), note: 'Ribbed pump hall lit only by a clerestory, surge tank, wet well with a davit, mains on stools.', build: pumpStation },
  { id: 'svc.water.tower', name: 'Water tower', zone: 'service', branch: 'water', density: 'none', variant: 'sculpted', footprint: [3, 3], height: 36.6, brand: { name: 'Water', colour: [0.16, 0.52, 0.62], accent: [0.70, 0.72, 0.74], sign: 'box' }, sim: util(3, 90, 40, 0), note: 'Flared bowl on a shaft with a walkway and a caged ladder. The tallest thing in the branch.', build: waterTower },
  { id: 'svc.water.treatment', name: 'Treatment works', zone: 'service', branch: 'water', density: 'none', variant: 'sculpted', footprint: [6, 5], height: 13.0, brand: { name: 'Water', colour: [0.16, 0.52, 0.62], accent: [0.70, 0.72, 0.74], sign: 'box' }, sim: util(22, 420, 300, 0), note: 'Two clarifiers with rotating bridges, a baffled aeration lane, sludge tank and pipe bridge.', build: treatmentWorks },
  { id: 'svc.water.reservoir', name: 'Service reservoir', zone: 'service', branch: 'water', density: 'none', variant: 'sculpted', footprint: [5, 5], height: 9.5, brand: { name: 'Water', colour: [0.16, 0.52, 0.62], accent: [0.70, 0.72, 0.74], sign: 'box' }, sim: util(4, 130, 60, 0), note: 'Buttressed covered tank under a grassed deck, eight vent stacks with hatch rails, valve house.', build: reservoir },

  { id: 'svc.power.substation', name: 'Substation', zone: 'service', branch: 'power', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 13.0, brand: { name: 'Grid', colour: [0.62, 0.46, 0.12], accent: [0.72, 0.72, 0.70], sign: 'box' }, sim: util(6, 180, 0, 0), note: 'Three transformer bays with radiator banks and bushings, lattice gantry, palisade compound.', build: substation },
  { id: 'svc.power.gas', name: 'Gas turbine plant', zone: 'service', branch: 'power', density: 'none', variant: 'sculpted', footprint: [6, 5], height: 35.2, brand: { name: 'Power', colour: [0.62, 0.46, 0.12], accent: [0.72, 0.72, 0.70], sign: 'box' }, sim: util(40, 900, 0, 40), note: 'Ribbed turbine hall with a full-flank air intake, two banded stacks, fuel line on stools.', build: gasPlant },
  { id: 'svc.power.solar', name: 'Solar array', zone: 'service', branch: 'power', density: 'none', variant: 'sculpted', footprint: [6, 5], height: 4.0, brand: { name: 'Solar', colour: [0.62, 0.46, 0.12], accent: [0.70, 0.72, 0.74], sign: 'box' }, sim: util(4, 160, 0, 0), note: 'Thirty tilted panel tables on legs, three inverter kiosks, a fenced field.', build: solarFarm },

  { id: 'svc.transport.depot', name: 'Bus depot', zone: 'service', branch: 'transport', density: 'none', variant: 'sculpted', footprint: [6, 6], height: 8.1, brand: { name: 'Transit', colour: [0.18, 0.52, 0.40], accent: [0.72, 0.66, 0.24], sign: 'box' }, sim: util(48, 320, 130, 60), note: 'Open-sided portal shed over five stands with rooflights, fuel island and a wash lane.', build: busDepot },
  { id: 'svc.transport.station', name: 'Bus station', zone: 'service', branch: 'transport', density: 'none', variant: 'sculpted', footprint: [6, 4], height: 8.0, brand: { name: 'Transit', colour: [0.18, 0.52, 0.40], accent: [0.72, 0.66, 0.24], sign: 'box' }, sim: util(24, 260, 90, 30), note: 'Two island platforms under one branching canopy, glazed shelters, finned concourse.', build: busStation },
  { id: 'svc.transport.metro', name: 'Metro entrance', zone: 'service', branch: 'transport', density: 'none', variant: 'sculpted', footprint: [3, 3], height: 7.4, brand: { name: 'Metro', colour: [0.18, 0.52, 0.40], accent: [0.72, 0.66, 0.24], sign: 'box' }, sim: util(8, 190, 220, 10), note: 'Glazed drum over the stair with a cantilevered disc roof, louvred vent shaft, totem.', build: metroEntrance },
  { id: 'svc.transport.rail', name: 'Rail station', zone: 'service', branch: 'transport', density: 'none', variant: 'sculpted', footprint: [6, 5], height: 13.0, brand: { name: 'Rail', colour: [0.18, 0.52, 0.40], accent: [0.72, 0.66, 0.24], sign: 'box' }, sim: util(60, 620, 340, 80), note: 'Glazed train shed on lattice trusses over two platforms, finned concourse with a clock.', build: railStation },
];
