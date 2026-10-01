/**
 * Nine more of the small civic buildings a real town is made of: a volunteer
 * fire station, mounted police stables, a dental practice, a village school,
 * a post kiosk, a registry office, and three places to play -- basketball,
 * a picnic meadow and mini golf.
 *
 * Built from the same kit and the same edge dressing as `services-civic3`,
 * so they sit beside the rest of the catalogue as neighbours.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import { tree, bench, hedge } from './landscape';
import { parkedVehicle } from './vehicles';
import { fence, lamp, dressing } from './services-civic3';

/** A row of glazing on one face of a block, at one floor. */
function windows(m: MeshBuilder, x0: number, x1: number, z: number, y: number,
  n: number, w: number, h: number): void {
  const step = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const cx = x0 + step * (i + 0.5);
    m.box([cx - w / 2, y, z - 0.05], [cx + w / 2, y + h, z + 0.02], MAT.GLASS);
  }
}

// ----------------------------------------------------- volunteer fire station

function volunteerFire(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const X = 15.5, Z = 15.5;
  m.box([-X, 0.001, -Z], [X, 0.1, Z], MAT.CONCRETE);
  // A two-bay appliance house with the crew room alongside and a drill tower.
  m.box([-12, 0, -12], [4, 6.4, 2], MAT.CLADDING, { roof: MAT.ROOF });
  m.box([4, 0, -12], [12, 4.6, -2], MAT.RENDER, { roof: MAT.ROOF });
  m.painted(TINT.BRAND, () => {
    for (const x of [-8, -1]) m.box([x - 2.6, 0, 1.95], [x + 2.6, 4.6, 2.05], MAT.TRIM);
    m.box([-12.2, 6.4, -12.2], [4.2, 7.0, 2.2], MAT.TRIM);
  });
  windows(m, 4.5, 11.5, -1.95, 1.2, 3, 1.4, 1.6);
  m.box([7, 0, -11], [10, 12.5, -8], MAT.CONCRETE, { roof: MAT.METAL });
  m.painted(TINT.ACCENT, () => m.box([6.9, 11.5, -11.1], [10.1, 12.5, -7.9], MAT.TRIM));
  // The apron, painted keep-clear, and a siren mast.
  m.painted(TINT.ACCENT, () => {
    for (let k = 0; k < 6; k++) m.box([-11 + k * 2.4, 0.1, 6], [-10 + k * 2.4, 0.12, 9], MAT.TRIM);
  });
  m.painted(TINT.METAL_DARK, () => m.cylinder(12, 10, 0.12, 0, 9, 10, MAT.METAL));
  m.cylinder(12, 10, 0.35, 9, 9.6, 10, MAT.METAL);
  if (fine) {
    parkedVehicle(m, 501, 8, 8, 0, 'van');
    parkedVehicle(m, 502, 2, 12, 1);
    for (const [x, z] of [[-14, 4], [14, 4], [-14, -14]]) lamp(m, x, z);
    dressing(m, X, Z, 5);
  }
  return m;
}

// ------------------------------------------------------- mounted police

function mountedPolice(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const X = 23.5, Z = 15.5;
  m.painted(TINT.GREEN, () => m.box([-X, 0.001, -Z], [X, 0.05, Z], MAT.TRIM));
  // The stable range: a long timber block under a pitched roof, stall doors.
  m.box([-21, 0, -13], [5, 4.2, -5], MAT.TIMBER, { roof: MAT.ROOF });
  m.gable([-21.4, 4.2, -13.4], [5.4, 4.2, -4.6], 2.6, 'x', MAT.ROOF, MAT.TIMBER);
  m.painted(TINT.BRAND, () => {
    for (let i = 0; i < 8; i++) m.box([-19.6 + i * 3.1, 0, -4.98], [-18.0 + i * 3.1, 2.4, -4.9], MAT.TRIM);
  });
  // The office: a two-storey block in the force's colours.
  m.box([7, 0, -13], [16, 7.0, -5], MAT.RENDER, { roof: MAT.ROOF });
  windows(m, 7.5, 15.5, -4.95, 1.0, 4, 1.2, 1.5);
  windows(m, 7.5, 15.5, -4.95, 4.4, 4, 1.2, 1.5);
  m.painted(TINT.BRAND, () => m.box([7, 6.6, -13.1], [16, 7.0, -4.9], MAT.TRIM));
  // A sand arena with a post-and-rail fence, and hay under a lean-to.
  m.box([-20, 0.05, -1], [4, 0.09, 13], MAT.GROUND);
  m.painted(TINT.WOOD, () => fence(m, -20, -1, 4, 13, 1.3, fine ? 2 : 6, MAT.TIMBER));
  m.painted(TINT.ACCENT, () => {
    for (let i = 0; i < 6; i++) m.cylinder(8 + (i % 3) * 1.6, 2 + Math.floor(i / 3) * 1.6, 0.7, 0, 1.2, 10, MAT.TRIM);
  });
  m.box([6.5, 2.6, 0.5], [13.5, 2.8, 5.5], MAT.METAL);
  if (fine) {
    for (const [x, z] of [[6.5, 0.5], [13.5, 0.5], [6.5, 5.5], [13.5, 5.5]]) {
      m.painted(TINT.WOOD, () => m.box([x - 0.1, 0, z - 0.1], [x + 0.1, 2.6, z + 0.1], MAT.TIMBER));
    }
    parkedVehicle(m, 511, 18, 9, 0, 'van');
    parkedVehicle(m, 512, 18, 4, 0);
    dressing(m, X, Z, 7);
  }
  return m;
}

// ----------------------------------------------------- dental practice

function dental(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const X = 11.5, Z = 11.5;
  m.box([-X, 0.001, -Z], [X, 0.1, Z], MAT.CONCRETE);
  m.box([-9, 0, -9], [6, 7.4, 1], MAT.RENDER, { roof: MAT.ROOF });
  // A glazed ground floor behind a canopy, two rows of windows above.
  m.box([-8.5, 0.3, 1.0], [5.5, 3.0, 1.06], MAT.GLASS);
  windows(m, -8.5, 5.5, 1.06, 4.2, 5, 1.6, 1.8);
  m.painted(TINT.BRAND, () => {
    m.box([-9.4, 3.1, 1], [6.4, 3.4, 3.4], MAT.TRIM);
    m.box([-5, 6.0, 1.06], [2, 7.0, 1.14], MAT.TRIM);
  });
  m.painted(TINT.METAL_DARK, () => {
    m.cylinder(-9.2, 3.2, 0.08, 0, 3.1, 8, MAT.METAL);
    m.cylinder(6.2, 3.2, 0.08, 0, 3.1, 8, MAT.METAL);
  });
  hedge(m, -10.5, 5, -2, 5.8, 0.9);
  if (fine) {
    for (let i = 0; i < 4; i++) parkedVehicle(m, 520 + i, 8.5, -8 + i * 4.2, 1);
    bench(m, 2, 6.5, 0);
    for (const [x, z] of [[-10, 9], [3, 9]]) lamp(m, x, z, 3.8);
    dressing(m, X, Z, 4);
  }
  return m;
}

// ----------------------------------------------------- village school

function villageSchool(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const X = 19.5, Z = 15.5;
  m.painted(TINT.GREEN, () => m.box([-X, 0.001, -Z], [X, 0.05, Z], MAT.TRIM));
  // A long single-storey schoolhouse in stone under a steep roof, bell turret.
  m.box([-16, 0, -13], [10, 4.6, -5], MAT.STONE);
  m.gable([-16.3, 4.6, -13.3], [10.3, 4.6, -4.7], 3.4, 'x', MAT.ROOF, MAT.STONE);
  windows(m, -15.5, 9.5, -4.95, 1.2, 7, 1.6, 2.4);
  m.box([-4, 8.0, -10], [-2, 10.4, -8], MAT.TIMBER);
  m.cone(-3, -9, 1.6, 0.05, 10.4, 12.2, 4, MAT.ROOF);
  // The porch and the playground: tarmac, a hopscotch, a climbing frame.
  m.box([-1, 0, -5], [3, 3.2, -2.5], MAT.STONE, { roof: MAT.ROOF });
  m.box([-16, 0.05, -1], [10, 0.08, 13], MAT.CONCRETE);
  m.painted(TINT.ACCENT, () => {
    for (let k = 0; k < 6; k++) m.box([-12, 0.08, 1 + k * 1.1], [-11, 0.09, 1.9 + k * 1.1], MAT.TRIM);
    m.box([-6, 0.08, 4], [2, 0.09, 4.1], MAT.TRIM);
  });
  if (medium) {
    m.painted(TINT.BRAND, () => {
      for (const [x, z] of [[4, 6], [8, 6], [4, 10], [8, 10]]) m.cylinder(x, z, 0.08, 0, 2.4, 6, MAT.METAL);
      m.box([3.8, 2.3, 5.8], [8.2, 2.45, 10.2], MAT.TRIM);
      m.box([3.8, 1.2, 5.8], [8.2, 1.3, 10.2], MAT.TRIM);
    });
  }
  m.painted(TINT.METAL_DARK, () => fence(m, -17, -1.5, 11, 14, 1.2, fine ? 1.6 : 5));
  if (fine) {
    bench(m, -8, 12, 2); bench(m, -2, 12, 2);
    tree(m, 15, -10, 8, 3.0); tree(m, 15, 4, 7.5, 2.8); tree(m, -18, -9, 7, 2.6);
    bench(m, 13, -2, 3); lamp(m, -17, -2); lamp(m, 12, -2);
    dressing(m, X, Z, 7);
  }
  return m;
}

// ----------------------------------------------------- post kiosk

function postKiosk(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const X = 7.5, Z = 7.5;
  m.box([-X, 0.001, -Z], [X, 0.12, Z], MAT.STONE);
  // A small round-cornered kiosk in post-office red, with a counter window.
  m.painted(TINT.BRAND, () => {
    m.box([-3, 0.12, -3.2], [3, 3.0, 1], MAT.TRIM, { roof: MAT.METAL });
    m.box([-3.3, 3.0, -3.5], [3.3, 3.3, 1.3], MAT.TRIM);
    // Pillar boxes at the front, and the parcel lockers along the side.
    m.cylinder(-4.5, 4.5, 0.32, 0.12, 1.4, 14, MAT.TRIM);
    m.cylinder(4.5, 4.5, 0.32, 0.12, 1.4, 14, MAT.TRIM);
  });
  m.cone(-4.5, 4.5, 0.34, 0.2, 1.4, 1.6, 14, MAT.METAL);
  m.cone(4.5, 4.5, 0.34, 0.2, 1.4, 1.6, 14, MAT.METAL);
  m.box([-2.2, 1.1, 1.0], [2.2, 2.4, 1.06], MAT.GLASS);
  m.painted(TINT.ACCENT, () => m.box([-2.2, 2.55, 1.06], [2.2, 2.85, 1.12], MAT.TRIM));
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i < 5; i++) m.box([3.6, 0.12, -3 + i * 0.8], [4.4, 2.2, -2.3 + i * 0.8], MAT.METAL);
  });
  if (fine) {
    bench(m, -5, -1, 1); bench(m, 0, -5.5, 0);
    lamp(m, -6, -6); lamp(m, 6, -6); lamp(m, -6, 6);
    tree(m, -5.5, -5, 6, 2.0); tree(m, 5.5, 6, 5.5, 1.8); tree(m, 6, -2, 5.2, 1.7);
    // A bike rack of hoops beside the lockers, and round planters at the door.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 6; i++) {
        const z = -5 + i * 0.9;
        m.pipe([5.6, 0.1, z], [5.6, 0.85, z], 0.035, MAT.METAL, 8);
        m.pipe([5.6, 0.85, z], [6.6, 0.85, z], 0.035, MAT.METAL, 8);
        m.pipe([6.6, 0.85, z], [6.6, 0.1, z], 0.035, MAT.METAL, 8);
      }
    });
    for (const x of [-2.4, 2.4]) {
      m.cylinder(x, 2.4, 0.5, 0.12, 0.6, 16, MAT.STONE);
      m.painted(TINT.GREEN, () => m.cone(x, 2.4, 0.5, 0.1, 0.6, 1.4, 12, MAT.FOLIAGE));
    }
    // A notice board and a newspaper stand by the counter.
    m.painted(TINT.WOOD, () => {
      m.box([-4.2, 0.12, -1.6], [-4.0, 1.8, -0.4], MAT.TIMBER);
      m.box([-4.25, 0.9, -1.7], [-4.15, 1.7, -0.3], MAT.TRIM);
    });
    for (let k = 0; k < 3; k++) m.box([-1.6 + k * 1.1, 0.12, 1.6], [-0.8 + k * 1.1, 1.0 - k * 0.15, 2.2], MAT.METAL);
    tree(m, -6, 2.5, 5.0, 1.6); tree(m, 2, 6.2, 5.0, 1.6); bench(m, -2.5, 5.5, 2);
    dressing(m, X, Z, 5);
  }
  return m;
}

// ----------------------------------------------------- registry office

function registry(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const X = 15.5, Z = 15.5;
  m.painted(TINT.GREEN, () => m.box([-X, 0.001, -Z], [X, 0.05, Z], MAT.TRIM));
  // A stone civic building with a columned portico up a flight of steps.
  m.box([-12, 0, -13], [12, 9.5, -2], MAT.STONE, { roof: MAT.ROOF });
  m.box([-12.4, 9.5, -13.4], [12.4, 10.3, -1.6], MAT.STONE);
  windows(m, -11.5, 11.5, -1.95, 1.4, 6, 1.4, 2.6);
  windows(m, -11.5, 11.5, -1.95, 5.6, 6, 1.4, 2.2);
  for (let k = 0; k < 4; k++) m.box([-5 - k * 0.3, 0, -2 + k * 0.5], [5 + k * 0.3, 0.9 - k * 0.22, -1.5 + k * 0.5], MAT.STONE);
  for (let i = 0; i < 6; i++) m.cylinder(-4.5 + i * 1.8, 0.2, 0.32, 0.9, 7.6, 12, MAT.STONE);
  m.box([-5.2, 7.6, -2], [5.2, 8.4, 0.9], MAT.STONE);
  m.gable([-5.2, 8.4, -2], [5.2, 8.4, 0.9], 1.6, 'x', MAT.STONE, MAT.STONE);
  // Flags, and a formal garden in front: lawn panels, a path, clipped hedges.
  for (const x of [-9, 9]) {
    m.painted(TINT.METAL_DARK, () => m.cylinder(x, 3, 0.07, 0, 9, 8, MAT.METAL));
    m.painted(TINT.BRAND, () => m.box([x, 7.6, 2.95], [x + 1.8, 8.8, 3.05], MAT.TRIM));
  }
  m.box([-1.4, 0.05, 1], [1.4, 0.09, 15], MAT.STONE);
  hedge(m, -12, 6, -2.5, 6.8, 0.8); hedge(m, 2.5, 6, 12, 6.8, 0.8);
  if (fine) {
    bench(m, -6, 10, 0); bench(m, 6, 10, 0); bench(m, -9, 10, 0); bench(m, 9, 10, 0);
    for (const [x, z] of [[-3, 4], [3, 4], [-3, 12], [3, 12]]) lamp(m, x, z, 3.6);
    tree(m, -13, -1, 7, 2.6); tree(m, 13, -1, 7, 2.6);
    dressing(m, X, Z, 6);
  }
  return m;
}

// ------------------------------------------------- basketball courts

function basketball(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const X = 15.5, Z = 11.5;
  m.box([-X, 0.001, -Z], [X, 0.08, Z], MAT.CONCRETE);
  for (const cx of [-7.5, 7.5]) {
    m.painted(TINT.BRAND, () => m.box([cx - 7, 0.08, -10], [cx + 7, 0.1, 10], MAT.TRIM));
    m.painted(TINT.ACCENT, () => {
      m.box([cx - 2.4, 0.1, -10], [cx + 2.4, 0.11, -5], MAT.TRIM);
      m.box([cx - 2.4, 0.1, 5], [cx + 2.4, 0.11, 10], MAT.TRIM);
    });
    m.box([cx - 7, 0.1, -0.05], [cx + 7, 0.115, 0.05], MAT.TRIM);
    m.cylinder(cx, 0, 1.8, 0.1, 0.112, 20, MAT.TRIM, true);
    for (const z of [-9.4, 9.4]) {
      const s = Math.sign(z);
      m.painted(TINT.METAL_DARK, () => m.cylinder(cx, z + s * 0.6, 0.1, 0, 3.4, 8, MAT.METAL));
      m.box([cx - 0.9, 2.9, z - 0.04], [cx + 0.9, 4.0, z + 0.04], MAT.TRIM);
      m.painted(TINT.AWNING, () => m.cylinder(cx, z - s * 0.4, 0.24, 3.05, 3.1, 12, MAT.TRIM, false));
    }
  }
  m.painted(TINT.METAL_DARK, () => fence(m, -15, -11, 15, 11, 3.0, fine ? 2 : 6));
  if (fine) {
    for (const x of [-12, -4, 4, 12]) bench(m, x, 10.4, 2);
    for (const [x, z] of [[-14.6, -10.6], [14.6, -10.6], [-14.6, 10.6], [14.6, 10.6]]) lamp(m, x, z, 6.5);
    dressing(m, X, Z, 5);
  }
  return m;
}

// ------------------------------------------------- picnic meadow

function picnicMeadow(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const X = 19.5, Z = 15.5;
  m.painted(TINT.GREEN, () => m.box([-X, 0.001, -Z], [X, 0.05, Z], MAT.TRIM));
  m.box([-18, 0.05, -1], [18, 0.08, 1], MAT.GROUND);
  // An open timber shelter with a long table under it, and a barbecue stand.
  m.painted(TINT.WOOD, () => {
    for (const [x, z] of [[-6, -10], [6, -10], [-6, -4], [6, -4]]) m.box([x - 0.15, 0, z - 0.15], [x + 0.15, 3.2, z + 0.15], MAT.TIMBER);
    m.box([-4, 0.7, -7.6], [4, 0.8, -6.4], MAT.TIMBER);
  });
  m.gable([-6.6, 3.2, -10.6], [6.6, 3.2, -3.4], 1.8, 'x', MAT.ROOF, MAT.TIMBER);
  m.box([9, 0, -8], [10.6, 0.9, -6.8], MAT.STONE);
  m.painted(TINT.METAL_DARK, () => m.box([9.1, 0.9, -7.9], [10.5, 1.0, -6.9], MAT.METAL));
  // Picnic tables scattered over the grass, each with its two benches.
  const tables: Array<[number, number, number]> = [[-14, 6, 0], [-8, 10, 1], [-2, 5, 0], [5, 11, 1], [11, 6, 0], [15, 11, 1], [-15, -10, 1], [14, -11, 0]];
  m.painted(TINT.WOOD, () => {
    for (const [x, z, t] of tables) {
      m.placed(x, z, t, () => {
        m.box([-1, 0.72, -0.4], [1, 0.8, 0.4], MAT.TIMBER);
        m.box([-1, 0.42, -0.85], [1, 0.48, -0.6], MAT.TIMBER);
        m.box([-1, 0.42, 0.6], [1, 0.48, 0.85], MAT.TIMBER);
        for (const sx of [-0.8, 0.8]) m.box([sx - 0.06, 0, -0.75], [sx + 0.06, 0.72, 0.75], MAT.TIMBER);
      });
    }
  });
  tree(m, -10, -2.5, 9, 3.4); tree(m, 8, 2.5, 8.5, 3.2); tree(m, 17, -3, 8, 3.0); tree(m, -17, 2, 8, 3.0);
  if (fine) {
    tree(m, 0, 13, 7, 2.6); tree(m, -12, 13, 7.5, 2.8); tree(m, 2, -12, 7.5, 2.8);
    for (const [x, z] of [[-18, -1.6], [-9, -1.6], [0, -1.6], [9, -1.6], [18, -1.6]]) lamp(m, x, z, 3.8);
    m.painted(TINT.METAL_DARK, () => { for (const [x, z] of [[-4, 2], [12, 2], [-12, -4]]) m.cylinder(x, z, 0.3, 0, 0.9, 12, MAT.METAL); });
    dressing(m, X, Z, 7);
  }
  return m;
}

// ------------------------------------------------- mini golf

function miniGolf(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const X = 15.5, Z = 15.5;
  m.box([-X, 0.001, -Z], [X, 0.08, Z], MAT.CONCRETE);
  // Nine short holes: felt lanes in a timber kerb, some with a dog-leg.
  const holes: Array<[number, number, number, number]> = [
    [-13, -13, -3, -11], [1, -13, 13, -11], [-13, -8, -8, 2], [-5, -8, 5, -6],
    [8, -8, 13, 2], [-5, -3, 5, -1], [-13, 5, -3, 7], [1, 5, 13, 7], [-13, 10, 13, 12],
  ];
  for (const [x0, z0, x1, z1] of holes) {
    m.painted(TINT.WOOD, () => m.box([x0 - 0.25, 0.08, z0 - 0.25], [x1 + 0.25, 0.32, z1 + 0.25], MAT.TIMBER));
    m.painted(TINT.GREEN, () => m.box([x0, 0.08, z0], [x1, 0.34, z1], MAT.TRIM));
    m.cylinder(x1 - 0.8, (z0 + z1) / 2, 0.1, 0.34, 0.35, 8, MAT.DARK_TRIM, true);
    m.painted(TINT.AWNING, () => m.cylinder(x1 - 0.8, (z0 + z1) / 2, 0.02, 0.34, 1.0, 4, MAT.TRIM));
  }
  // The obstacles: a little windmill, a loop, a castle gate.
  if (medium) {
    m.painted(TINT.ACCENT, () => {
      m.cone(0, 1.6, 1.0, 0.7, 0.34, 2.6, 8, MAT.TRIM);
      m.box([-0.05, 1.6, 0.6], [0.05, 3.8, 0.7], MAT.TRIM);
      m.box([-1.1, 2.65, 0.6], [1.1, 2.75, 0.7], MAT.TRIM);
    });
    m.cone(0, 1.6, 0.75, 0.05, 2.6, 3.4, 8, MAT.ROOF);
    m.painted(TINT.BRAND, () => {
      m.box([-11, 0.34, 6.6], [-10.2, 1.6, 7.4], MAT.TRIM);
      m.box([-8.8, 0.34, 6.6], [-8, 1.6, 7.4], MAT.TRIM);
      m.box([-11, 1.6, 6.6], [-8, 2.0, 7.4], MAT.TRIM);
    });
  }
  // The kiosk where the putters are handed out.
  m.box([10, 0, 13], [14.5, 2.8, 15], MAT.TIMBER, { roof: MAT.ROOF });
  m.painted(TINT.BRAND, () => m.box([9.8, 2.8, 12.8], [14.7, 3.0, 15.2], MAT.TRIM));
  if (fine) {
    bench(m, 6, 14, 2); bench(m, 0, 14, 2); bench(m, -6, 14, 2);
    for (const [x, z] of [[-14.6, -14.6], [14.6, -14.6], [-14.6, 14.6], [0, -14.6], [-14.6, 0], [14.6, 0]]) lamp(m, x, z, 4);
    tree(m, -14, 3, 6, 2.2); tree(m, 14, 4, 6, 2.2);
    dressing(m, X, Z, 6);
  }
  return m;
}

const civ = (jobs: number, upkeep: number, power: number, water: number): AssetDef['sim'] => ({
  jobs, powerKW: power, waterM3: water, garbagePerWeek: jobs * 9, pollution: 0, upkeep,
});

export const CIVIC_FOUR: AssetDef[] = [
  { id: 'svc.fire.volunteer', name: 'Volunteer fire station', zone: 'service', branch: 'fire', density: 'none', variant: 'sculpted', footprint: [4, 4], height: 12.5, brand: { name: 'Fire', colour: [0.74, 0.12, 0.10], accent: [0.92, 0.80, 0.22], sign: 'box' }, sim: civ(8, 130, 25, 20), note: 'Two appliance bays and a crew room, a small drill tower and a siren mast. Cheap cover for a village.', build: volunteerFire },
  { id: 'svc.police.mounted', name: 'Mounted police stables', zone: 'service', branch: 'police', density: 'none', variant: 'sculpted', footprint: [6, 4], height: 7.0, brand: { name: 'Mounted Police', colour: [0.14, 0.24, 0.48], accent: [0.80, 0.70, 0.36], sign: 'box' }, sim: civ(30, 360, 90, 120), note: 'A timber stable range, a two-storey office, a sand arena behind a post-and-rail fence and hay under a lean-to.', build: mountedPolice },
  { id: 'svc.health.dental', name: 'Dental practice', zone: 'service', branch: 'health', density: 'none', variant: 'sculpted', footprint: [3, 3], height: 7.4, brand: { name: 'Dental', colour: [0.22, 0.56, 0.62], accent: [0.92, 0.94, 0.94], sign: 'box' }, sim: civ(10, 140, 35, 30), note: 'A two-storey practice with a glazed waiting room under a canopy, and parking at the side.', build: dental },
  { id: 'svc.edu.school', name: 'Village school', zone: 'service', branch: 'education', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 12.2, brand: { name: 'School', colour: [0.38, 0.28, 0.54], accent: [0.86, 0.72, 0.22], sign: 'none' }, sim: civ(14, 170, 50, 50), note: 'A stone schoolhouse under a steep roof with a bell turret, a porch, and a fenced playground with a climbing frame.', build: villageSchool },
  { id: 'svc.post.kiosk', name: 'Post kiosk', zone: 'service', branch: 'post', density: 'none', variant: 'sculpted', footprint: [2, 2], height: 3.3, brand: { name: 'Post', colour: [0.70, 0.12, 0.10], accent: [0.92, 0.82, 0.24], sign: 'none' }, sim: civ(3, 50, 8, 2), note: 'A red counter kiosk with two pillar boxes and a bank of parcel lockers.', build: postKiosk },
  { id: 'svc.gov.registry', name: 'Registry office', zone: 'service', branch: 'government', density: 'none', variant: 'sculpted', footprint: [4, 4], height: 10.3, brand: { name: 'Registry', colour: [0.30, 0.22, 0.44], accent: [0.80, 0.68, 0.30], sign: 'none' }, sim: civ(26, 260, 80, 40), note: 'A stone civic building with a six-column portico up a flight of steps, two flags and a formal garden. Births, marriages and deaths.', build: registry },
  { id: 'svc.parks.basketball', name: 'Basketball courts', zone: 'service', branch: 'parks', density: 'none', variant: 'sculpted', footprint: [4, 3], height: 4.0, brand: { name: 'Courts', colour: [0.72, 0.34, 0.16], accent: [0.92, 0.92, 0.88], sign: 'none' }, sim: civ(1, 50, 15, 4), note: 'Two outdoor courts with their keys, centre circles and hoops, inside a tall fence with floodlights.', build: basketball },
  { id: 'svc.parks.picnic', name: 'Picnic meadow', zone: 'service', branch: 'parks', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 5.0, brand: { name: 'Meadow', colour: [0.30, 0.48, 0.24], accent: [0.62, 0.44, 0.22], sign: 'none' }, sim: civ(1, 40, 4, 8), note: 'Open grass with picnic tables under big trees, a timber shelter with a long table and a barbecue stand.', build: picnicMeadow },
  { id: 'svc.parks.minigolf', name: 'Mini golf', zone: 'service', branch: 'parks', density: 'none', variant: 'sculpted', footprint: [4, 4], height: 3.8, brand: { name: 'Mini Golf', colour: [0.20, 0.40, 0.66], accent: [0.92, 0.52, 0.18], sign: 'none' }, sim: civ(4, 90, 12, 10), note: 'Nine felt holes in timber kerbs with a windmill and a castle gate, and a kiosk handing out putters.', build: miniGolf },
];
