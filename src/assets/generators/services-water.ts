/**
 * More of the plant a city runs on: water, drainage, and the sheds behind them.
 *
 * The library was thin exactly where a player looks first. Water had four
 * buildings and drainage had two, so the first hour of a game offered a pump,
 * a tower and a works, and every city ended up with the same three things in
 * the same three places. These are the rest of that branch -- the filtration
 * works a city puts in when the river is dirty, the desalination hall it puts
 * in when there is no river, the borehole for a district on its own, the
 * pumping station that lifts sewage over a hill, and the reed lagoon that
 * polishes what comes out of the works.
 *
 * Built to the same rule as everything else in `services-utility.ts`: process
 * plant with a door in it. Drums, berms, gantries, pipe runs and one room
 * where somebody sits. No brick, no tiles, no pitched domestic roofs.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import { band, kerb, louvres, parapet, portal, railing, ribbon, roofClutter,
  serviceYard } from '../parts';
import { parkedVehicle } from './vehicles';

const util = (jobs: number, upkeep: number, power: number, water: number): AssetDef['sim'] => ({
  jobs, powerKW: power, waterM3: water, garbagePerWeek: jobs * 6, pollution: 0, upkeep,
});

const WATER: AssetDef['brand'] = { name: 'Water', colour: [0.16, 0.52, 0.62], accent: [0.70, 0.72, 0.74], sign: 'box' };

/** A rectangular tank sunk into a kerbed slab, with a walkway round it. */
function tank(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number,
  wall: number, deep: number, lod: number): void {
  const t = 0.34;
  m.box([x0, 0, z0], [x1, wall, z1], MAT.CONCRETE);
  // The water, set down inside the walls, so the tank reads as a tank rather
  // than as a block.
  m.painted(TINT.NONE, () => {
    m.box([x0 + t, wall - deep, z0 + t], [x1 - t, wall - deep + 0.08, z1 - t], MAT.WATER);
  });
  if (lod < 1) railing(m, x0 + 0.2, x1 - 0.2, z1 - 0.2, wall, 1.05, 1.8);
}

/**
 * A palisade fence round the site, with a gate on the road side.
 *
 * Every one of these is a compound rather than a building, and a compound
 * without a fence reads as a model sitting on grass. It is also most of what
 * gives them their triangles: a pale every twenty centimetres over a sixty
 * metre perimeter is the texture you actually see from the camera's height.
 */
function fence(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number,
  lod: number, gate: [number, number] | null = null): void {
  const H = 2.3;
  const step = lod < 1 ? 0.26 : lod < 2 ? 0.7 : 1.6;
  m.painted(TINT.METAL_DARK, () => {
    const run = (ax: number, az: number, bx: number, bz: number): void => {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(2, Math.round(len / step));
      const ux = (bx - ax) / n, uz = (bz - az) / n;
      for (let i = 0; i <= n; i++) {
        const px = ax + ux * i, pz = az + uz * i;
        if (gate !== null && pz < z0 + 0.4 && px > gate[0] && px < gate[1]) continue;
        m.box([px - 0.035, 0, pz - 0.035], [px + 0.035, H, pz + 0.035], MAT.TRIM);
      }
      // Two rails, which is what holds the pales and what the eye follows.
      for (const y of [0.45, H - 0.35]) {
        const cx0 = Math.min(ax, bx), cx1 = Math.max(ax, bx);
        const cz0 = Math.min(az, bz), cz1 = Math.max(az, bz);
        m.box([cx0 - 0.04, y, cz0 - 0.04], [cx1 + 0.04, y + 0.09, cz1 + 0.04], MAT.TRIM);
      }
    };
    run(x0, z0, x1, z0);
    run(x0, z1, x1, z1);
    run(x0, z0, x0, z1);
    run(x1, z0, x1, z1);
    if (gate !== null) {
      for (const px of gate) {
        m.box([px - 0.12, 0, z0 - 0.12], [px + 0.12, H + 0.5, z0 + 0.12], MAT.TRIM);
      }
    }
  });
}

/** A caged ladder up the side of a tank, which every tank has. */
function ladder(m: MeshBuilder, x: number, z: number, from: number, to: number,
  lod: number): void {
  m.painted(TINT.METAL_DARK, () => {
    for (const off of [-0.22, 0.22]) {
      m.box([x - 0.03, from, z + off - 0.03], [x + 0.03, to, z + off + 0.03], MAT.TRIM);
    }
    const rungs = Math.max(2, Math.round((to - from) / (lod < 1 ? 0.3 : 0.9)));
    for (let i = 0; i <= rungs; i++) {
      const y = from + ((to - from) * i) / rungs;
      m.box([x - 0.03, y, z - 0.24], [x + 0.03, y + 0.05, z + 0.24], MAT.TRIM);
    }
    if (lod < 1) {
      // The hoop cage, which is the bit that says "industrial" from a distance.
      for (let i = 0; i < Math.max(1, Math.round((to - from) / 0.8)); i++) {
        const y = from + 1.6 + i * 0.8;
        if (y > to) break;
        m.cylinder(x + 0.3, z, 0.36, y, y + 0.05, 8, MAT.TRIM);
      }
    }
  });
}

/** A run of pipe on stools, which is what ties a works together. */
function pipeRun(m: MeshBuilder, x0: number, x1: number, z: number, y: number,
  radius = 0.26): void {
  m.painted(TINT.METAL_DARK, () => {
    m.pipe([x0, y, z], [x1, y, z], radius, MAT.METAL, 6);
    const stools = Math.max(2, Math.round((x1 - x0) / 4.5));
    for (let i = 0; i <= stools; i++) {
      const px = x0 + ((x1 - x0) * i) / stools;
      m.box([px - 0.14, 0, z - 0.14], [px + 0.14, y - radius, z + 0.14], MAT.CONCRETE);
    }
  });
}

/** The one room where somebody sits: a glazed control block. */
function controlBlock(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number,
  h: number, lod: number): void {
  m.box([x0, 0, z0], [x1, h, z1], MAT.CONCRETE, { roof: MAT.ROOF });
  parapet(m, x0, z0, x1, z1, h, 0.7, 0.16, MAT.CONCRETE);
  if (lod < 2) {
    ribbon(m, { axis: 'z', sign: 1, plane: z1 }, x0 + 0.7, x1 - 0.7, 1.1, 2.5, { head: true });
    ribbon(m, { axis: 'x', sign: 1, plane: x1 }, z0 + 0.7, z1 - 0.7, 1.1, 2.5, { head: true });
  }
  if (lod < 1) {
    m.painted(TINT.DOOR, () => {
      m.box([x0 + 1.0, 0, z1 - 0.06], [x0 + 2.1, 2.3, z1 + 0.1], MAT.TRIM);
    });
  }
}

// ---------------------------------------------------------------- water

/** Filtration works: rapid gravity filters, a clear-water tank and a hall. */
function filtration(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const X = 23, Z = 19;
  kerb(m, -X, -Z, X, Z);

  // Two banks of four filter beds, each a walled cell with water in it.
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 4; i++) {
      const x0 = -X + 1.6 + i * 5.2;
      const z0 = row === 0 ? -Z + 2.0 : -Z + 10.4;
      tank(m, x0, z0, x0 + 4.4, z0 + 7.0, 2.2, 1.5, lod);
    }
    if (lod < 2) {
      pipeRun(m, -X + 1.2, X - 7.0, row === 0 ? -Z + 1.3 : -Z + 9.7, 2.9, 0.3);
    }
  }

  // The hall the filters are run from, and the clear-water tank behind it.
  controlBlock(m, X - 6.4, -Z + 2.0, X - 1.4, -Z + 9.4, 6.6, lod);
  m.painted(TINT.METAL_DARK, () => {
    m.cylinder(X - 4.0, -Z + 14.4, 3.2, 0, 7.4, lod >= 1 ? 8 : 16, MAT.METAL);
    m.cylinder(X - 4.0, -Z + 14.4, 3.4, 7.4, 7.8, lod >= 1 ? 8 : 16, MAT.TRIM);
  });
  if (lod < 1) {
    railing(m, X - 7.2, X - 0.8, -Z + 11.0, 7.8, 1.05, 1.6);
    roofClutter(m, X - 6.2, -Z + 2.6, X - 1.8, -Z + 8.8, 6.6, 7, 0.8);
    parkedVehicle(m, 11, -X + 4.0, Z - 3.2, 0, 'truck');
    serviceYard(m, -X + 2, X - 2, Z - 4.4, 31, { totem: true, flag: false });
  }
  ladder(m, X - 7.4, -Z + 14.4, 0, 7.8, lod);
  fence(m, -X, -Z, X, Z, lod, [-4, 4]);
  return m;
}

/** Desalination: an intake, a membrane hall, and a brine outfall. */
function desalination(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const X = 21, Z = 15;
  kerb(m, -X, -Z, X, Z);

  // The hall: a long ribbed shed, because that is what a membrane rack lives in.
  const hx0 = -X + 2.4, hx1 = X - 8.0, hz0 = -Z + 3.0, hz1 = Z - 3.0;
  m.box([hx0, 0, hz0], [hx1, 11.5, hz1], MAT.CLADDING, { roof: MAT.ROOF });
  band(m, hx0, hz0, hx1, hz1, 11.2, 0.5, 0.22, MAT.TRIM);
  if (lod < 2) {
    louvres(m, { axis: 'z', sign: 1, plane: hz1 }, hx0 + 1.5, hx1 - 1.5, 6.6, 10.4);
    ribbon(m, { axis: 'z', sign: 1, plane: hz1 }, hx0 + 2.0, hx1 - 2.0, 2.0, 4.2, { head: true });
  }
  // Pressure vessels along the flank, which is the only thing that says what
  // the shed is for.
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i < 6; i++) {
      const x = hx0 + 2.6 + i * ((hx1 - hx0 - 5.2) / 5);
      m.cylinder(x, hz0 - 1.5, 0.55, 1.2, 7.4, lod >= 1 ? 6 : 10, MAT.METAL);
    }
    pipeRun(m, hx0, hx1, hz0 - 1.5, 8.2, 0.34);
  });

  // Intake and brine tanks on the seaward end.
  for (let i = 0; i < 2; i++) {
    m.painted(TINT.METAL_DARK, () => {
      m.cylinder(X - 4.6, -Z + 4.5 + i * 8.2, 3.0, 0, 6.2, lod >= 1 ? 8 : 16, MAT.METAL);
      m.cylinder(X - 4.6, -Z + 4.5 + i * 8.2, 3.2, 6.2, 6.6, lod >= 1 ? 8 : 16, MAT.TRIM);
    });
  }
  if (lod < 2) pipeRun(m, hx1, X - 7.4, 0, 5.0, 0.4);
  if (lod < 1) {
    controlBlock(m, hx0 + 1.0, hz1 + 0.4, hx0 + 6.4, Z - 0.6, 5.0, lod);
    serviceYard(m, -X + 2, X - 10, -Z + 1.2, 17, { flag: true });
  }
  for (let i = 0; i < 2; i++) ladder(m, X - 8.0, -Z + 4.5 + i * 8.2, 0, 6.6, lod);
  fence(m, -X, -Z, X, Z, lod, [-3, 3]);
  return m;
}

/** A borehole: a wellhead kiosk, a small tank and a hardstanding. */
function borehole(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const X = 7.5, Z = 7.5;
  kerb(m, -X, -Z, X, Z);
  controlBlock(m, -3.4, -2.6, 1.4, 2.2, 4.0, lod);
  m.painted(TINT.METAL_DARK, () => {
    // The wellhead itself: a capped shaft with a valve tree on it.
    m.cylinder(3.6, -1.0, 0.55, 0, 1.4, lod >= 1 ? 6 : 12, MAT.METAL);
    m.box([3.1, 1.4, -1.5], [4.1, 2.1, -0.5], MAT.TRIM);
    m.pipe([3.6, 1.8, -1.0], [3.6, 1.8, 3.2], 0.2, MAT.METAL, 6);
    m.cylinder(3.6, 4.2, 1.6, 0, 4.6, lod >= 1 ? 8 : 14, MAT.METAL);
    m.cylinder(3.6, 4.2, 1.75, 4.6, 4.9, lod >= 1 ? 8 : 14, MAT.TRIM);
  });
  ladder(m, 2.0, 4.2, 0, 4.9, lod);
  fence(m, -X, -Z, X, Z, lod, [-1.6, 1.6]);
  return m;
}

// ---------------------------------------------------------------- drainage

/** A sewage pumping station: a wet well, screens and a kiosk. */
function sewagePump(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const X = 9.5, Z = 8.0;
  kerb(m, -X, -Z, X, Z);

  // The wet well, which is a lid at ground level and a davit over it.
  m.box([-X + 1.4, 0, -Z + 1.4], [-X + 7.4, 0.9, -Z + 6.6], MAT.CONCRETE);
  m.painted(TINT.METAL_DARK, () => {
    m.box([-X + 2.4, 0.9, -Z + 2.4], [-X + 6.4, 1.05, -Z + 5.6], MAT.PLATE);
    m.cylinder(-X + 1.9, -Z + 2.0, 0.11, 0.9, 4.2, 6, MAT.TRIM);
    m.pipe([-X + 1.9, 4.0, -Z + 2.0], [-X + 4.4, 4.0, -Z + 2.0], 0.1, MAT.TRIM, 5);
  });
  controlBlock(m, 0.6, -Z + 1.6, 6.6, -Z + 6.4, 4.4, lod);
  // The screen chamber and the rising main leaving the site.
  m.box([-1.4, 0, Z - 5.2], [4.2, 2.6, Z - 1.4], MAT.CONCRETE, { roof: MAT.PLATE });
  if (lod < 2) {
    pipeRun(m, -X + 4.4, 6.0, Z - 3.3, 1.9, 0.3);
    louvres(m, { axis: 'z', sign: 1, plane: Z - 1.4 }, -0.8, 3.6, 0.9, 2.2);
  }
  if (lod < 1) serviceYard(m, -X + 2, X - 2, Z - 0.8, 7, { totem: false, flag: false });
  ladder(m, -X + 7.6, -Z + 4.0, 0, 2.6, lod);
  fence(m, -X, -Z, X, Z, lod, [-2, 2]);
  return m;
}

/** Reed lagoons: berms, standing water and a sampling hut. */
function lagoon(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const X = 19, Z = 14;
  kerb(m, -X, -Z, X, Z);
  for (let i = 0; i < 3; i++) {
    const x0 = -X + 1.6 + i * 11.4;
    const x1 = x0 + 9.6;
    // The berm: a low bank round each cell, which is the whole silhouette.
    m.painted(TINT.GREEN_DARK, () => {
      m.box([x0 - 0.9, 0, -Z + 1.6], [x1 + 0.9, 1.5, Z - 1.6], MAT.GROUND);
    });
    m.painted(TINT.NONE, () => {
      m.box([x0, 0.6, -Z + 2.5], [x1, 0.72, Z - 2.5], MAT.WATER);
    });
    // Reeds, as short blades standing in it. Only close up: at any distance
    // they are a texture on the water, and the water already has one.
    if (lod < 1) {
      m.painted(TINT.GREEN, () => {
        for (let k = 0; k < 26; k++) {
          const rx = x0 + 0.6 + ((k * 37) % 90) / 10;
          const rz = -Z + 3.2 + ((k * 53) % 200) / 10;
          m.box([rx - 0.05, 0.6, rz - 0.05], [rx + 0.05, 1.5 + (k % 5) * 0.1, rz + 0.05],
            MAT.FOLIAGE);
        }
      });
    }
    if (lod < 2) pipeRun(m, x0 - 1.2, x0 + 1.4, -Z + 2.0, 1.9, 0.22);
  }
  if (lod < 1) {
    controlBlock(m, X - 6.0, Z - 5.6, X - 1.6, Z - 1.6, 3.6, lod);
    railing(m, -X + 1.0, X - 7.0, Z - 1.0, 0.14, 1.2, 2.6);
  }
  fence(m, -X, -Z, X, Z, lod, [-3, 3]);
  return m;
}

// ---------------------------------------------------------------- the rest

/** A parcel hub: a dock wall of roller shutters and a sortation shed. */
function parcelHub(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const X = 17, Z = 13;
  kerb(m, -X, -Z, X, Z);
  const x0 = -X + 2.0, x1 = X - 2.0, z0 = -Z + 4.0, z1 = Z - 2.5;
  m.box([x0, 0, z0], [x1, 9.2, z1], MAT.CLADDING, { roof: MAT.ROOF });
  band(m, x0, z0, x1, z1, 8.9, 0.5, 0.2, MAT.TRIM);
  // The dock: a raised apron and a row of shutters, which is what a parcel
  // building actually is.
  m.box([x0 - 1.2, 0, z0 - 1.6], [x1 + 1.2, 1.15, z0], MAT.CONCRETE);
  m.painted(TINT.BRAND_DARK, () => {
    for (let i = 0; i < 7; i++) {
      const dx = x0 + 1.4 + i * ((x1 - x0 - 2.8) / 6);
      m.box([dx - 1.3, 1.15, z0 - 0.08], [dx + 1.3, 4.3, z0 + 0.12], MAT.TRIM);
    }
  });
  if (lod < 2) {
    ribbon(m, { axis: 'z', sign: 1, plane: z1 }, x0 + 1.6, x1 - 1.6, 5.2, 7.2, { head: true });
    portal(m, x0 + 1.0, x1 - 1.0, z0 - 3.4, 5.6, 3.2, 3);
  }
  if (lod < 1) {
    roofClutter(m, x0 + 1.5, z0 + 1.5, x1 - 1.5, z1 - 1.5, 9.2, 21, 1.1);
    parkedVehicle(m, 4, -6.0, z0 - 5.6, 0, 'van');
    parkedVehicle(m, 9, 0.5, z0 - 5.6, 0, 'van');
    parkedVehicle(m, 2, 7.0, z0 - 5.6, 0, 'truck');
    serviceYard(m, -X + 2, X - 2, -Z + 1.0, 44, { totem: true, flag: true });
  }
  railing(m, x0 - 1.0, x1 + 1.0, z0 - 1.6, 1.15, 1.1, 2.0);
  fence(m, -X, -Z, X, Z, lod, [-5, 5]);
  return m;
}

/** A walk-in centre: a small clinic with its own drop-off. */
function walkIn(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const X = 11, Z = 9;
  kerb(m, -X, -Z, X, Z);
  const x0 = -X + 1.8, x1 = X - 1.8, z0 = -Z + 3.4, z1 = Z - 2.0;
  m.box([x0, 0, z0], [x1, 8.0, z1], MAT.RENDER, { roof: MAT.ROOF });
  parapet(m, x0, z0, x1, z1, 8.0, 0.8, 0.18, MAT.CONCRETE);
  if (lod < 2) {
    for (let f = 0; f < 2; f++) {
      ribbon(m, { axis: 'z', sign: 1, plane: z1 }, x0 + 1.2, x1 - 1.2,
        1.2 + f * 3.3, 2.9 + f * 3.3, { head: true });
    }
    // The canopy over the door, which is the one thing every clinic has.
    m.box([-3.2, 3.1, z1], [3.2, 3.5, z1 + 2.6], MAT.CONCRETE);
    m.painted(TINT.METAL_DARK, () => {
      m.cylinder(-3.0, z1 + 2.3, 0.09, 0, 3.1, 6, MAT.TRIM);
      m.cylinder(3.0, z1 + 2.3, 0.09, 0, 3.1, 6, MAT.TRIM);
    });
  }
  if (lod < 1) {
    m.painted(TINT.DOOR, () => m.box([-1.6, 0, z1 - 0.08], [1.6, 2.6, z1 + 0.12], MAT.GLASS));
    roofClutter(m, x0 + 1.2, z0 + 1.2, x1 - 1.2, z1 - 1.2, 8.0, 5, 0.7);
    parkedVehicle(m, 6, 6.4, z1 + 1.2, 0, 'car');
    serviceYard(m, -X + 2, X - 2, -Z + 1.2, 12, { flag: false });
  }
  fence(m, -X, -Z, X, Z, lod, [-3.5, 3.5]);
  return m;
}

/** A tram depot: a shed over stanled tracks, with a maintenance bay. */
function tramDepot(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const X = 18, Z = 14;
  kerb(m, -X, -Z, X, Z);
  const x0 = -X + 1.6, x1 = X - 1.6, z0 = -Z + 2.4, z1 = Z - 4.0;
  // An open-sided portal shed: the roof and the frame, nothing else.
  m.box([x0, 8.4, z0], [x1, 9.2, z1], MAT.ROOF);
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i < 6; i++) {
      const px = x0 + 0.6 + i * ((x1 - x0 - 1.2) / 5);
      for (const pz of [z0 + 0.6, z1 - 0.6]) {
        m.box([px - 0.22, 0, pz - 0.22], [px + 0.22, 8.4, pz + 0.22], MAT.TRIM);
      }
    }
  });
  // Four roads of track under it, and the pits between the rails.
  m.painted(TINT.METAL_DARK, () => {
    for (let t = 0; t < 4; t++) {
      const tz = z0 + 2.0 + t * ((z1 - z0 - 4.0) / 3);
      for (const off of [-0.72, 0.72]) {
        m.box([x0 + 0.4, 0.05, tz + off - 0.06], [x1 - 0.4, 0.2, tz + off + 0.06], MAT.METAL);
      }
      m.box([x0 + 2.0, 0, tz - 0.6], [x0 + 9.0, 0.06, tz + 0.6], MAT.CONCRETE);
    }
  });
  // The overhead line, which is what makes it a tram depot rather than a shed.
  m.painted(TINT.METAL_DARK, () => {
    for (let t = 0; t < 4; t++) {
      const tz = z0 + 2.0 + t * ((z1 - z0 - 4.0) / 3);
      m.pipe([x0 + 0.5, 6.2, tz], [x1 - 0.5, 6.2, tz], 0.04, MAT.TRIM, 4);
    }
  });
  controlBlock(m, X - 7.4, z1 + 0.6, X - 1.6, Z - 0.8, 6.0, lod);
  if (lod < 1) {
    roofClutter(m, x0 + 2, z0 + 2, x1 - 2, z1 - 2, 9.2, 9, 0.6);
    serviceYard(m, -X + 2, X - 9, Z - 1.0, 63, { totem: true, flag: false });
  }
  fence(m, -X, -Z, X, Z, lod, [-6, 6]);
  return m;
}

export const MORE_UTILITY: AssetDef[] = [
  { id: 'svc.water.filtration', name: 'Filtration works', zone: 'service', branch: 'water', density: 'none', variant: 'sculpted', footprint: [6, 5], height: 7.8, brand: WATER, sim: util(26, 520, 340, 0), note: 'Eight rapid gravity filter beds in two banks, a clear-water tank and the hall they are run from.', build: filtration },
  { id: 'svc.water.desal', name: 'Desalination plant', zone: 'service', branch: 'water', density: 'none', variant: 'sculpted', footprint: [6, 4], height: 11.5, brand: WATER, sim: util(34, 900, 1400, 0), note: 'A membrane hall with pressure vessels down its flank, intake and brine tanks, and a pipe bridge to the shore.', build: desalination },
  { id: 'svc.water.borehole', name: 'Borehole', zone: 'service', branch: 'water', density: 'none', variant: 'sculpted', footprint: [2, 2], height: 4.9, brand: WATER, sim: util(2, 70, 90, 0), note: 'A capped wellhead with its valve tree, a kiosk and a small tank: water for a district on its own.', build: borehole },
  { id: 'svc.sewage.pump', name: 'Sewage pumping station', zone: 'service', branch: 'sewage', density: 'none', variant: 'sculpted', footprint: [3, 3], height: 4.4, brand: WATER, sim: util(6, 160, 210, 0), note: 'A wet well with a davit over it, a screen chamber and the rising main leaving the site.', build: sewagePump },
  { id: 'svc.sewage.lagoon', name: 'Reed lagoons', zone: 'service', branch: 'sewage', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 3.6, brand: WATER, sim: util(8, 190, 60, 0), note: 'Three bermed cells of standing water planted with reed, and the hut the samples are taken from.', build: lagoon },
  { id: 'svc.post.parcel', name: 'Parcel hub', zone: 'service', branch: 'post', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 9.2, brand: { name: 'Post', colour: [0.62, 0.42, 0.10], accent: [0.84, 0.84, 0.86], sign: 'box' }, sim: util(70, 420, 180, 40), note: 'A sortation shed behind a dock wall of seven roller shutters, with the vans backed onto it.', build: parcelHub },
  { id: 'svc.health.walkin', name: 'Walk-in centre', zone: 'service', branch: 'health', density: 'none', variant: 'sculpted', footprint: [3, 3], height: 8.0, brand: { name: 'Health', colour: [0.66, 0.20, 0.32], accent: [0.90, 0.90, 0.92], sign: 'box' }, sim: util(24, 380, 190, 70), note: 'Two floors of consulting rooms behind a ribbon window, with the canopy and the drop-off every clinic has.', build: walkIn },
  { id: 'svc.transport.tram', name: 'Tram depot', zone: 'service', branch: 'transport', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 9.2, brand: { name: 'Transit', colour: [0.18, 0.52, 0.40], accent: [0.72, 0.66, 0.24], sign: 'box' }, sim: util(40, 340, 260, 40), note: 'An open portal shed over four roads of track with pits between the rails, overhead line, and the office at the end.', build: tramDepot },
];
