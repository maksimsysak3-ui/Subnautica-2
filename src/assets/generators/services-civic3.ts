/**
 * Six more civic buildings: the everyday kind a real town has and the game
 * did not -- somewhere to play tennis, walk the dog, sit by a fountain, buy
 * from a market stall, learn a trade, and get back on your feet after an
 * illness.
 *
 * Each is footprint-true at eight metres a cell and built from the same
 * kit as the rest of the service catalogue, so they sit in a street of its
 * neighbours without looking imported.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { Material } from '../mesh';
import type { AssetDef } from '../types';
import { tree, bench, hedge } from './landscape';
import { parkedVehicle } from './vehicles';

/** A ring of fence posts with a top rail, round a rectangle. */
function fence(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number,
  h: number, step: number, mat: Material = MAT.METAL): void {
  const run = (ax: number, az: number, bx: number, bz: number): void => {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i <= n; i++) {
      const x = ax + ((bx - ax) * i) / n, z = az + ((bz - az) * i) / n;
      m.box([x - 0.05, 0, z - 0.05], [x + 0.05, h, z + 0.05], mat);
    }
    m.box([Math.min(ax, bx) - 0.04, h - 0.08, Math.min(az, bz) - 0.04],
      [Math.max(ax, bx) + 0.04, h, Math.max(az, bz) + 0.04], mat);
  };
  run(x0, z0, x1, z0); run(x1, z0, x1, z1); run(x1, z1, x0, z1); run(x0, z1, x0, z0);
}

/**
 * The edge of a civic plot at full detail: a row of trees, lamps between them
 * and bollards along the frontage. What separates a model from a diagram.
 */
function dressing(m: MeshBuilder, X: number, Z: number, trees: number): void {
  for (let i = 0; i < trees; i++) {
    const x = -X + 2.5 + (i * (2 * X - 5)) / Math.max(1, trees - 1);
    tree(m, x, Z - 1.6, 6.5 + (i % 3) * 0.8, 2.2 + (i % 2) * 0.4);
    if (i + 1 < trees) lamp(m, x + (2 * X - 5) / Math.max(1, trees - 1) / 2, Z - 1.2);
  }
  m.painted(TINT.METAL_DARK, () => {
    for (let x = -X + 1.5; x <= X - 1.5; x += 2.2) m.cylinder(x, -Z + 0.6, 0.11, 0, 0.9, 8, MAT.METAL);
  });
}

/** A lamp column. */
function lamp(m: MeshBuilder, x: number, z: number, h = 4.2): void {
  m.painted(TINT.METAL_DARK, () => {
    m.cylinder(x, z, 0.12, 0, 0.5, 10, MAT.METAL);
    m.cylinder(x, z, 0.07, 0.5, h, 10, MAT.METAL);
  });
  m.cylinder(x, z, 0.2, h, h + 0.35, 10, MAT.LAMP);
}

// ---------------------------------------------------------------- tennis club

function tennis(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const X = 19, Z = 15;
  m.painted(TINT.GREEN_DARK, () => m.box([-X, 0.001, -Z], [X, 0.05, Z], MAT.TRIM));
  // Two hard courts side by side, each 11 by 24 metres with its run-off.
  for (const cx of [-7, 7]) {
    m.painted(TINT.BRAND, () => m.box([cx - 6.2, 0.05, -12.5], [cx + 6.2, 0.08, 12.5], MAT.TRIM));
    m.painted(TINT.ACCENT, () => m.box([cx - 5.5, 0.08, -11.9], [cx + 5.5, 0.09, 11.9], MAT.TRIM));
    // The lines: baselines, sidelines, service lines and the centre line.
    const line = (x0: number, z0: number, x1: number, z1: number): void =>
      m.box([x0, 0.09, z0], [x1, 0.1, z1], MAT.TRIM);
    line(cx - 5.5, -11.9, cx + 5.5, -11.8); line(cx - 5.5, 11.8, cx + 5.5, 11.9);
    line(cx - 5.5, -11.9, cx - 5.4, 11.9); line(cx + 5.4, -11.9, cx + 5.5, 11.9);
    line(cx - 4.1, -11.9, cx - 4.0, 11.9); line(cx + 4.0, -11.9, cx + 4.1, 11.9);
    line(cx - 4.1, -6.45, cx + 4.1, -6.35); line(cx - 4.1, 6.35, cx + 4.1, 6.45);
    line(cx - 0.05, -6.4, cx + 0.05, 6.4);
    // The net on its two posts.
    m.painted(TINT.METAL_DARK, () => {
      m.cylinder(cx - 6.0, 0, 0.06, 0, 1.07, 6, MAT.METAL);
      m.cylinder(cx + 6.0, 0, 0.06, 0, 1.07, 6, MAT.METAL);
      m.box([cx - 6.0, 0.15, -0.02], [cx + 6.0, 0.95, 0.02], MAT.DARK_TRIM);
    });
    m.box([cx - 6.0, 0.92, -0.04], [cx + 6.0, 1.0, 0.04], MAT.TRIM);
  }
  // High wire fence round the pair, the way every club has it.
  m.painted(TINT.METAL_DARK, () => fence(m, -13.6, -13, 13.6, 13, 3.4, fine ? 2.5 : 5));
  // The pavilion on the open side: a low timber clubhouse with a veranda.
  m.box([14.2, 0, -6], [18.6, 3.2, 6], MAT.RENDER, { roof: MAT.ROOF });
  m.painted(TINT.WOOD, () => {
    m.box([13.6, 3.2, -6.4], [19.0, 3.4, 6.4], MAT.TIMBER);
    for (const z of [-5.6, -1.8, 1.8, 5.6]) m.box([13.7, 0, z - 0.1], [13.9, 3.2, z + 0.1], MAT.TIMBER);
  });
  m.box([14.15, 0.6, -4.5], [14.2, 2.4, 4.5], MAT.GLASS);
  if (fine) {
    bench(m, 15.5, -9, 1); bench(m, 15.5, 9, 1); tree(m, 16.5, -12.5, 7, 2.6); tree(m, 16.5, 12.5, 7.5, 2.8);
    // Floodlight masts at the corners, an umpire's chair at each net, and a
    // stepped bench of seats along the far side.
    for (const [x, z] of [[-13.4, -12.8], [13.4, -12.8], [-13.4, 12.8], [13.4, 12.8]]) {
      m.painted(TINT.METAL_DARK, () => m.cylinder(x, z, 0.14, 0, 9, 10, MAT.METAL));
      m.box([x - 0.7, 9, z - 0.25], [x + 0.7, 9.6, z + 0.25], MAT.LAMP);
    }
    for (const cx of [-7, 7]) {
      m.painted(TINT.BRAND, () => {
        for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) {
          m.cylinder(cx - 6.9 + dx, dz, 0.04, 0, 1.8, 6, MAT.METAL);
        }
        m.box([cx - 7.3, 1.8, -0.4], [cx - 6.5, 1.9, 0.4], MAT.TRIM);
        m.box([cx - 7.3, 1.9, -0.4], [cx - 7.2, 2.5, 0.4], MAT.TRIM);
      });
    }
    m.painted(TINT.WOOD, () => {
      for (let k = 0; k < 3; k++) m.box([-13, 0, -14.4 + k * 0.45], [13, 0.45 + k * 0.4, -14.0 + k * 0.45], MAT.TIMBER);
    });
    dressing(m, X, Z, 6);
  }
  return m;
}

// ------------------------------------------------------------------- dog park

function dogPark(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const X = 15.5, Z = 15.5;
  m.painted(TINT.GREEN, () => m.box([-X, 0.001, -Z], [X, 0.05, Z], MAT.TRIM));
  // A gravel path in a loop, and the double-gated entrance.
  m.box([-12, 0.05, -12], [12, 0.08, -10.6], MAT.GROUND);
  m.box([-12, 0.05, 10.6], [12, 0.08, 12], MAT.GROUND);
  m.box([-12, 0.05, -12], [-10.6, 0.08, 12], MAT.GROUND);
  m.box([10.6, 0.05, -12], [12, 0.08, 12], MAT.GROUND);
  m.painted(TINT.WOOD, () => fence(m, -14.6, -14.6, 14.6, 14.6, 1.25, fine ? 1.6 : 4, MAT.TIMBER));
  m.box([-1.2, 0, 14.6], [1.2, 1.4, 15.4], MAT.METAL);
  // The agility course in the middle: hurdles, a tunnel, weave poles, an A-frame.
  m.painted(TINT.ACCENT, () => {
    for (const x of [-6, -3, 0]) {
      m.box([x - 0.05, 0, -4.2], [x + 0.05, 0.9, -4.1], MAT.TRIM);
      m.box([x - 0.05, 0, -2.6], [x + 0.05, 0.9, -2.5], MAT.TRIM);
      m.box([x - 0.06, 0.55, -4.2], [x + 0.06, 0.62, -2.5], MAT.TRIM);
    }
    m.cylinder(5, -3.3, 0.06, 0, 0.9, 5, MAT.TRIM);
    for (let k = 0; k < 6; k++) m.cylinder(-6 + k * 1.1, 4, 0.04, 0, 1.0, 5, MAT.TRIM);
  });
  if (medium) {
    m.painted(TINT.BRAND, () => {
      for (let k = 0; k < 5; k++) m.cylinder(5 + k * 0.9 - 1.8, 3.6, 0.55, 0.05, 1.05, 10, MAT.TRIM, false);
    });
    m.painted(TINT.WOOD, () => {
      m.quad([2.4, 0, -5.5], [2.4, 0, -1.5], [3.6, 1.6, -1.5], [3.6, 1.6, -5.5], MAT.TIMBER);
      m.quad([3.6, 1.6, -5.5], [3.6, 1.6, -1.5], [4.8, 0, -1.5], [4.8, 0, -5.5], MAT.TIMBER);
    });
  }
  // Shade and somewhere to sit, a water fountain and a bin.
  tree(m, -9, -9, 8, 3.0); tree(m, 9, 9, 7.5, 2.8); tree(m, 9, -8.5, 6.5, 2.4);
  if (fine) {
    bench(m, -9, 8.5, 0); bench(m, -5, 8.5, 0);
    m.painted(TINT.METAL_DARK, () => m.cylinder(-12.8, 0, 0.25, 0, 1.0, 8, MAT.METAL));
    m.box([-13.0, 0, 6], [-12.4, 0.9, 6.6], MAT.METAL);
    tree(m, -9, 2, 7, 2.6); tree(m, 9, 0, 6.8, 2.5);
    for (const [x, z] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) lamp(m, x, z, 3.8);
    dressing(m, X, Z, 5);
  }
  return m;
}

// ------------------------------------------------------------- fountain plaza

function fountainPlaza(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const X = 15.5, Z = 15.5;
  m.box([-X, 0.001, -Z], [X, 0.12, Z], MAT.STONE);
  // A border of darker setts, and the cross of paths in a lighter stone.
  m.box([-X, 0.12, -Z], [X, 0.14, -Z + 1.2], MAT.CONCRETE);
  m.box([-X, 0.12, Z - 1.2], [X, 0.14, Z], MAT.CONCRETE);
  // The fountain: a low round basin, water in it, two tiers and a finial.
  m.cylinder(0, 0, 5.2, 0.12, 0.65, 24, MAT.STONE);
  m.cylinder(0, 0, 4.8, 0.12, 0.6, 24, MAT.WATER);
  m.cylinder(0, 0, 0.6, 0.6, 2.0, 10, MAT.STONE);
  m.cone(0, 0, 0.7, 2.2, 2.0, 2.3, 16, MAT.STONE);
  m.cylinder(0, 0, 2.0, 2.15, 2.3, 16, MAT.WATER, true);
  m.cylinder(0, 0, 0.3, 2.3, 3.2, 8, MAT.STONE);
  m.cone(0, 0, 0.35, 1.0, 3.2, 3.45, 12, MAT.STONE);
  m.cylinder(0, 0, 0.18, 3.45, 4.2, 6, MAT.STONE);
  // Planters at the four corners with a tree in each, benches facing in.
  for (const [x, z] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) {
    m.box([x - 2, 0.12, z - 2], [x + 2, 0.7, z + 2], MAT.STONE);
    m.painted(TINT.GREEN, () => m.box([x - 1.8, 0.7, z - 1.8], [x + 1.8, 0.75, z + 1.8], MAT.TRIM));
    tree(m, x, z, 8.5, 3.0);
  }
  if (fine) {
    bench(m, 0, -8, 0); bench(m, 0, 8, 2); bench(m, -8, 0, 1); bench(m, 8, 0, 3);
    for (const [x, z] of [[-6, -13], [6, -13], [-6, 13], [6, 13], [-13, -6], [-13, 6], [13, -6], [13, 6]]) lamp(m, x, z);
    bench(m, -4, -8, 0); bench(m, 4, -8, 0); bench(m, -4, 8, 2); bench(m, 4, 8, 2);
    // A ring of bollards round the basin.
    m.painted(TINT.METAL_DARK, () => {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        m.cylinder(Math.cos(a) * 6.4, Math.sin(a) * 6.4, 0.12, 0.12, 0.85, 8, MAT.METAL);
      }
    });
    dressing(m, X, Z, 4);
  }
  return m;
}

// --------------------------------------------------------------- market hall

function marketHall(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const X = 19.5, Z = 15.5;
  m.box([-X, 0.001, -Z], [X, 0.12, Z], MAT.STONE);
  // An open iron-and-glass hall on columns: the roof is the building.
  const hx = 14, hz = 9;
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i <= 6; i++) {
      const x = -hx + (i * 2 * hx) / 6;
      m.cylinder(x, -hz, 0.22, 0.12, 6.0, 8, MAT.METAL);
      m.cylinder(x, hz, 0.22, 0.12, 6.0, 8, MAT.METAL);
    }
    m.box([-hx - 0.3, 5.8, -hz - 0.3], [hx + 0.3, 6.3, hz + 0.3], MAT.METAL);
  });
  m.gable([-hx - 0.6, 6.3, -hz - 0.8], [hx + 0.6, 6.3, hz + 0.8], 4.2, 'x', MAT.GLASS, MAT.METAL);
  // A clerestory lantern along the ridge.
  if (medium) m.box([-hx + 1, 10.5, -0.9], [hx - 1, 11.4, 0.9], MAT.GLASS, { roof: MAT.METAL });
  // Rows of stalls under it, each with a striped awning.
  for (const z of [-5, 0.5, 6]) {
    for (let i = 0; i < 6; i++) {
      const x = -11.5 + i * 4.6;
      m.painted(TINT.WOOD, () => m.box([x - 1.6, 0.12, z - 0.9], [x + 1.6, 1.0, z + 0.9], MAT.TIMBER));
      m.painted(i % 2 === 0 ? TINT.BRAND : TINT.AWNING,
        () => m.box([x - 1.8, 2.3, z - 1.2], [x + 1.8, 2.42, z + 1.2], MAT.TRIM));
      if (fine) {
        m.painted(TINT.METAL_DARK, () => {
          m.cylinder(x - 1.7, z - 1.1, 0.04, 0.12, 2.3, 4, MAT.METAL);
          m.cylinder(x + 1.7, z - 1.1, 0.04, 0.12, 2.3, 4, MAT.METAL);
        });
        m.painted(i % 3 === 0 ? TINT.GREEN : TINT.ACCENT,
          () => m.box([x - 1.4, 1.0, z - 0.7], [x + 1.4, 1.15, z + 0.7], MAT.TRIM));
      }
    }
  }
  if (fine) {
    tree(m, -17, -13, 7, 2.6); tree(m, 17, 13, 7, 2.6); bench(m, 17, -12, 3); bench(m, -17, 12, 1);
    // Glazed gable ends with a ring of glazing bars, and lamps at the corners.
    m.painted(TINT.METAL_DARK, () => {
      for (const x of [-hx - 0.6, hx + 0.6]) {
        for (let k = -4; k <= 4; k++) m.box([x - 0.05, 6.3, k * 2 - 0.05], [x + 0.05, 6.3 + 4.2 * (1 - Math.abs(k) / 4.6), k * 2 + 0.05], MAT.METAL);
      }
    });
    for (const [x, z] of [[-18, -14], [18, -14], [-18, 14], [18, 14], [0, -14], [0, 14]]) lamp(m, x, z);
    dressing(m, X, Z, 6);
  }
  return m;
}

// ------------------------------------------------------- technical college

function technicalCollege(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const X = 27.5, Z = 19.5;
  m.box([-X, 0.001, -Z], [X, 0.1, Z], MAT.CONCRETE);
  // The teaching block: three storeys of brick with a glazed stair at the end.
  m.box([-24, 0, -16], [6, 11.4, -4], MAT.CONCRETE, { roof: MAT.ROOF });
  for (let f = 0; f < 3; f++) {
    const y = 1.0 + f * 3.6;
    m.box([-23.5, y, -16.05], [5.5, y + 1.9, -16.0], MAT.GLASS);
    m.box([-23.5, y, -4.0], [5.5, y + 1.9, -3.95], MAT.GLASS);
  }
  m.box([6, 0, -15], [10, 13, -5], MAT.GLASS, { roof: MAT.METAL });
  m.painted(TINT.BRAND, () => m.box([-24.2, 11.4, -16.2], [6.2, 12.0, -3.8], MAT.TRIM));
  // The workshops: a long shed under a sawtooth roof, big doors for vehicles.
  m.box([-24, 0, 1], [14, 6.5, 16], MAT.CLADDING);
  if (medium) {
    for (let i = 0; i < 6; i++) {
      const x0 = -24 + i * (38 / 6), x1 = x0 + 38 / 6;
      m.quad([x0, 6.5, 1], [x0, 6.5, 16], [x1, 9.0, 16], [x1, 9.0, 1], MAT.ROOF);
      m.quad([x1, 9.0, 1], [x1, 9.0, 16], [x1, 6.5, 16], [x1, 6.5, 1], MAT.GLASS);
    }
  } else {
    m.box([-24, 6.5, 1], [14, 8.0, 16], MAT.ROOF);
  }
  m.painted(TINT.ACCENT, () => {
    for (const x of [-18, -8, 2]) m.box([x - 2.2, 0, 0.95], [x + 2.2, 4.4, 1.0], MAT.TRIM);
  });
  // A sign on the block, and the car park.
  m.painted(TINT.BRAND, () => m.box([-14, 9.2, -16.3], [-2, 10.6, -16.1], MAT.TRIM));
  if (fine) {
    for (let i = 0; i < 6; i++) parkedVehicle(m, 300 + i, 18 + (i % 2) * 5, -14 + Math.floor(i / 2) * 5, 0);
    tree(m, 22, 10, 7, 2.6); tree(m, 22, 16, 7.5, 2.8);
    dressing(m, X, Z, 7);
  }
  return m;
}

// --------------------------------------------------------- rehab centre

function rehabCentre(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const X = 23.5, Z = 15.5;
  m.painted(TINT.GREEN, () => m.box([-X, 0.001, -Z], [X, 0.05, Z], MAT.TRIM));
  // An L of two-storey wards in pale render, round a sheltered garden.
  m.box([-21, 0, -13], [6, 7.2, -5], MAT.RENDER, { roof: MAT.ROOF });
  m.box([-21, 0, -5], [-13, 7.2, 13], MAT.RENDER, { roof: MAT.ROOF });
  for (const y of [1.0, 4.6]) {
    for (let i = 0; i < 9; i++) m.box([-19.5 + i * 2.8, y, -5.05], [-18.1 + i * 2.8, y + 1.5, -5.0], MAT.GLASS);
    for (let i = 0; i < 6; i++) m.box([-13.05, y, -3.5 + i * 2.8], [-13.0, y + 1.5, -2.1 + i * 2.8], MAT.GLASS);
  }
  // A glazed atrium at the knee of the L, the entrance canopy, the cross.
  m.box([-13, 0, -5], [-7, 8.6, 1], MAT.GLASS, { roof: MAT.METAL });
  m.painted(TINT.BRAND, () => {
    m.box([4, 3.0, -15], [9, 3.3, -12], MAT.TRIM);
    m.box([0.5, 5.3, -13.25], [3.5, 6.3, -13.15], MAT.TRIM);
    m.box([1.5, 4.3, -13.25], [2.5, 7.3, -13.15], MAT.TRIM);
  });
  // The garden: paths, a pergola, hedges and benches, for walking again.
  m.box([-12, 0.05, 2], [18, 0.09, 3.4], MAT.GROUND);
  m.box([2, 0.05, -4], [3.4, 0.09, 13], MAT.GROUND);
  hedge(m, -12, 12, 18, 12.8, 1.0); hedge(m, 18, -4, 18.8, 12.8, 1.0);
  m.painted(TINT.WOOD, () => {
    for (let i = 0; i < 5; i++) {
      const x = 6 + i * 2.4;
      m.box([x - 0.1, 0, 7.4], [x + 0.1, 2.6, 7.6], MAT.TIMBER);
      m.box([x - 0.1, 0, 10.4], [x + 0.1, 2.6, 10.6], MAT.TIMBER);
      m.box([x - 0.12, 2.6, 7.2], [x + 0.12, 2.75, 10.8], MAT.TIMBER);
    }
  });
  tree(m, -6, 8, 7.5, 2.8); tree(m, 14, -8, 8, 3.0);
  if (fine) {
    bench(m, -2, 6, 0); bench(m, 8, 2.7, 2); parkedVehicle(m, 410, 12, -12, 0, 'van');
    for (const [x, z] of [[-4, 4], [14, 4], [-4, 12], [14, 12]]) lamp(m, x, z, 3.6);
    tree(m, 16, 8, 6.5, 2.4); tree(m, -2, 12, 6.8, 2.5);
    dressing(m, X, Z, 6);
  }
  return m;
}

const civ = (jobs: number, upkeep: number, power: number, water: number): AssetDef['sim'] => ({
  jobs, powerKW: power, waterM3: water, garbagePerWeek: jobs * 9, pollution: 0, upkeep,
});

export const CIVIC_THREE: AssetDef[] = [
  { id: 'svc.parks.tennis', name: 'Tennis club', zone: 'service', branch: 'parks', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 4.0, brand: { name: 'Tennis', colour: [0.20, 0.36, 0.56], accent: [0.30, 0.52, 0.34], sign: 'none' }, sim: civ(4, 110, 20, 15), note: 'Two hard courts inside a high wire fence, nets and lines, and a timber pavilion with a veranda.', build: tennis },
  { id: 'svc.parks.dogs', name: 'Dog park', zone: 'service', branch: 'parks', density: 'none', variant: 'sculpted', footprint: [4, 4], height: 3.0, brand: { name: 'Dog park', colour: [0.24, 0.42, 0.62], accent: [0.86, 0.62, 0.16], sign: 'none' }, sim: civ(1, 45, 2, 6), note: 'A fenced field with a gravel loop, an agility course of hurdles, tunnel, weave poles and A-frame, shade trees and a water fountain.', build: dogPark },
  { id: 'svc.parks.fountain', name: 'Fountain plaza', zone: 'service', branch: 'parks', density: 'none', variant: 'sculpted', footprint: [4, 4], height: 4.2, brand: { name: 'Plaza', colour: [0.58, 0.54, 0.46], accent: [0.30, 0.44, 0.58], sign: 'none' }, sim: civ(2, 80, 15, 40), note: 'A stone square around a two-tier fountain, with planted corners, benches facing in and lamps.', build: fountainPlaza },
  { id: 'svc.parks.market', name: 'Market hall', zone: 'service', branch: 'parks', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 11.4, brand: { name: 'Market', colour: [0.62, 0.20, 0.18], accent: [0.86, 0.80, 0.62], sign: 'none' }, sim: civ(24, 160, 60, 30), note: 'An open iron-and-glass hall on columns with a clerestory lantern, and three rows of stalls under striped awnings.', build: marketHall },
  { id: 'svc.edu.technical', name: 'Technical college', zone: 'service', branch: 'education', density: 'none', variant: 'sculpted', footprint: [7, 5], height: 13.0, brand: { name: 'Technical College', colour: [0.18, 0.34, 0.52], accent: [0.86, 0.56, 0.14], sign: 'box' }, sim: civ(140, 1300, 520, 260), note: 'A three-storey teaching block with a glazed stair, and long workshops under a sawtooth roof with vehicle doors. Teaches to college level.', build: technicalCollege },
  { id: 'svc.health.rehab', name: 'Rehabilitation centre', zone: 'service', branch: 'health', density: 'none', variant: 'sculpted', footprint: [6, 4], height: 8.6, brand: { name: 'Rehabilitation', colour: [0.18, 0.52, 0.48], accent: [0.84, 0.84, 0.80], sign: 'box' }, sim: civ(70, 620, 260, 180), note: 'Two-storey wards in an L round a sheltered garden with a pergola, a glazed atrium at the corner and an ambulance bay.', build: rehabCentre },
];
