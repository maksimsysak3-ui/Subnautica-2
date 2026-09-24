/**
 * Industry specialisations: the headquarters a player places, and the props
 * that fill the harvest area they draw beside it.
 *
 * One headquarters per natural resource, each readable from above as its trade
 * -- a farmstead with a Dutch barn and silos, a sawmill with its log yard and
 * loader crane, a pithead with its winding tower and spoil tip, an oil terminal
 * with its tank farm and flare, a quarry works with its crusher and graded
 * stockpiles, a fish quay with a boat up on the slip. Each is worked by its own
 * machines (machines.ts), not by whatever the car pack had.
 *
 * The props are what a drawn area is covered in: fields in four states of the
 * year, felling plots and standing timber, terraced mine tips, pumpjacks,
 * quarry faces and trawlers. They are repeated across hundreds of cells, so
 * they stay light and put their triangles where the eye goes.
 *
 * None of these are stock. The spawner never grows one; they are placed by the
 * industry tools and by the city build inside a drawn area (see
 * `sim/industry.ts`), which is why their ids share the `spec.` prefix the
 * inventory keeps out of the zoned buckets. Not `ind.`: that is the zoned
 * industrial stock's.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { Vec3 } from '../mesh';
import type { AssetDef, Brand } from '../types';
import { band, boxSign, entrance, louvres, parapet, ribbon } from '../parts';
import { barrelVault, conveyor, lattice, pipeRack, silo } from './signature-parts';
import { figure } from './vehicles';
import { tree } from './landscape';
import {
  combine, excavator, fence, forwarder, haulTruck, loader, lorry, paintedAs, tractor, trailer,
} from './machines';

const job = (jobs: number, upkeep: number, pollution = 0): AssetDef['sim'] => ({
  jobs, powerKW: jobs * 6, waterM3: jobs * 1.2, garbagePerWeek: jobs * 18, pollution, upkeep,
});
const none: AssetDef['sim'] = { powerKW: 0, waterM3: 0, garbagePerWeek: 0, pollution: 0, upkeep: 0 };

// --------------------------------------------------------------- shared parts

/** A small office on the front of the lot, glazed to the road, with its sign. */
function office(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number, h: number,
  fine: boolean, medium: boolean): void {
  m.box([x0, 0.1, z0], [x1, h, z1], MAT.CLADDING, { roof: MAT.ROOF });
  if (medium) parapet(m, x0, z0, x1, z1, h, 0.6, 0.18, MAT.TRIM);
  if (fine) {
    ribbon(m, { axis: 'z', sign: 1, plane: z1 }, x0 + 0.8, x1 - 0.8, 1.2, h - 1.0, { mullions: 6 });
    entrance(m, { axis: 'z', sign: 1, plane: z1 }, (x0 + x1) / 2, { width: 2.2, height: 2.6, glazed: true });
    boxSign(m, { axis: 'z', sign: 1, plane: z1 }, x0 + 0.6, x0 + 4.6, h - 0.9, h - 0.1);
  }
}

/** A hedge: a run of overlapping clumps of uneven height, not a green box. */
function hedge(m: MeshBuilder, a: Vec3, b: Vec3, seed: number, lite: boolean): void {
  const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const n = Math.max(2, Math.round(len / (lite ? 4.5 : 2.6)));
  m.painted(TINT.GREEN_DARK, () => {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t;
      const r = 1.1 + (Math.sin(seed + i * 2.7) * 0.5 + 0.5) * 0.7;
      const h = 1.3 + (Math.sin(seed * 1.7 + i * 1.3) * 0.5 + 0.5) * 1.1;
      m.cone(x, z, r, r * 0.55, 0.05, h, lite ? 5 : 7, MAT.FOLIAGE);
    }
  });
}

/** Round bales, lying on their sides along a line. */
function bales(m: MeshBuilder, x: number, z: number, n: number, lite: boolean): void {
  m.painted(TINT.BRAND, () => {
    for (let i = 0; i < n; i++) {
      m.pipe([x + i * 1.9, 0.72, z - 0.6], [x + i * 1.9, 0.72, z + 0.6], 0.72, MAT.TIMBER, lite ? 7 : 11);
    }
  });
}

/** A heap: a low cone with a flattened top. */
function heap(m: MeshBuilder, x: number, z: number, r: number, h: number, sides: number): void {
  m.cone(x, z, r, r * 0.18, 0.05, h, sides, MAT.GROUND);
}

/**
 * A ramp: a band of haul road climbing round a tip from one height to another.
 * Quads along an arc, so it reads as a road on the slope, not a slab through it.
 */
function ramp(m: MeshBuilder, r0: number, r1: number, y0: number, y1: number, a0: number, a1: number,
  w: number, steps: number): void {
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps, t1 = (i + 1) / steps;
    const at = (t: number, off: number): Vec3 => {
      const a = a0 + (a1 - a0) * t, r = r0 + (r1 - r0) * t + off;
      return [Math.cos(a) * r, y0 + (y1 - y0) * t + 0.12, Math.sin(a) * r];
    };
    m.quad(at(t0, 0), at(t1, 0), at(t1, w), at(t0, w), MAT.GROUND);
  }
}

// ------------------------------------------------------------ the pumpjack

/** A nodding-donkey pumpjack, at its full mechanism: used by the prop and the oil HQ. */
function pumpjack(m: MeshBuilder, cx: number, cz: number, turns: number, lite: boolean): void {
  m.placed(cx, cz, turns, () => {
    // Skid and gearbox.
    m.painted(TINT.METAL_DARK, () => {
      m.box([-4.6, 0.15, -1.0], [3.6, 0.45, 1.0], MAT.METAL);
      m.box([-4.0, 0.45, -0.7], [-2.6, 1.9, 0.7], MAT.METAL);
      // Samson post: an A-frame of four legs to the pivot.
      for (const [lx, lz] of [[-0.9, -1.0], [-0.9, 1.0], [0.9, -1.0], [0.9, 1.0]] as const) {
        m.pipe([lx, 0.45, lz], [0, 5.3, 0], 0.13, MAT.METAL, lite ? 4 : 6);
      }
    });
    m.painted(TINT.BRAND, () => {
      // The walking beam, and the horse's head curving down at the well end.
      m.box([-3.9, 5.2, -0.32], [4.3, 5.85, 0.32], MAT.PAINT);
      m.box([4.2, 4.5, -0.42], [4.75, 6.3, 0.42], MAT.PAINT);
      m.box([4.7, 3.7, -0.42], [5.05, 5.6, 0.42], MAT.PAINT);
      if (!lite) m.box([4.35, 6.2, -0.42], [4.8, 6.55, 0.42], MAT.PAINT);
      // Pitman arms from the beam's tail down to the cranks.
      for (const s of [-1, 1] as const) m.pipe([-3.7, 5.25, s * 0.45], [-3.3, 1.35, s * 0.95], 0.09, MAT.PAINT, 4);
    });
    m.painted(TINT.ACCENT, () => {
      // Crank arms and their counterweights, either side of the gearbox.
      for (const s of [-1, 1] as const) m.box([-4.3, 0.6, s * 0.85 - 0.12], [-2.4, 1.9, s * 0.85 + 0.12], MAT.PAINT);
    });
    // The bridle down to the polished rod, and the wellhead.
    m.painted(TINT.METAL_DARK, () => {
      m.pipe([5.0, 3.7, 0], [5.0, 1.4, 0], 0.05, MAT.METAL, 4);
      m.cylinder(5.0, 0, 0.32, 0.15, 1.4, lite ? 6 : 10, MAT.METAL);
      if (!lite) {
        m.pipe([5.0, 0.9, 0], [5.0, 0.9, 1.8], 0.12, MAT.METAL, 6);
        m.pipe([5.0, 0.35, 1.8], [5.0, 0.35, 7.0], 0.12, MAT.METAL, 6);
        m.box([-5.9, 0.15, -0.6], [-4.7, 1.2, 0.6], MAT.METAL);         // the motor
      }
    });
    if (!lite) m.painted(TINT.ACCENT, () => m.pipe([5.0, 1.15, -0.35], [5.0, 1.15, 0.35], 0.22, MAT.PAINT, 8));
  });
}

// --------------------------------------------------------------- the trawler

/** Half-beam and deck height along a trawler's length, stern to bow. */
const HULL: Array<[number, number, number]> = [
  [-7.0, 2.2, 1.7], [-4.5, 2.5, 1.6], [0.0, 2.55, 1.6], [3.0, 2.3, 1.8],
  [5.0, 1.6, 2.1], [6.5, 0.8, 2.5], [7.6, 0.05, 2.8],
];

/** A stern trawler at the waterline, facing +x. Used by the prop and the fish quay's slip. */
function trawler(m: MeshBuilder, cx: number, cz: number, turns: number, lite: boolean, lift = 0): void {
  m.placed(cx, cz, turns, () => {
    const y = (v: number): number => v + lift;
    // The hull, lofted between stations: a red boot-top to 0.4 m, dark above.
    const side = (lo: number, hi: number, tint: number): void => {
      m.painted(tint as never, () => {
        for (let i = 0; i + 1 < HULL.length; i++) {
          const [x0, b0, d0] = HULL[i], [x1, b1, d1] = HULL[i + 1];
          const top0 = Math.min(d0, hi), top1 = Math.min(d1, hi);
          const k0 = (h: number): number => b0 * (0.78 + 0.22 * Math.min(1, h / d0));
          const k1 = (h: number): number => b1 * (0.78 + 0.22 * Math.min(1, h / d1));
          for (const s of [-1, 1] as const) {
            const a: Vec3 = [x0, y(lo), s * k0(lo)], b: Vec3 = [x1, y(lo), s * k1(lo)];
            const c: Vec3 = [x1, y(top1), s * k1(top1)], d: Vec3 = [x0, y(top0), s * k0(top0)];
            if (s > 0) m.quad(a, b, c, d, MAT.PAINT); else m.quad(b, a, d, c, MAT.PAINT);
          }
        }
      });
    };
    side(0, 0.4, TINT.ACCENT);
    side(0.4, 3, TINT.BRAND);
    // The deck and the transom.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i + 1 < HULL.length; i++) {
        const [x0, b0, d0] = HULL[i], [x1, b1, d1] = HULL[i + 1];
        m.quad([x0, y(d0), b0], [x1, y(d1), b1], [x1, y(d1), -b1], [x0, y(d0), -b0], MAT.TIMBER);
      }
    });
    m.painted(TINT.BRAND, () => m.quad([-7, y(0), -2.2 * 0.78], [-7, y(0), 2.2 * 0.78],
      [-7, y(1.7), 2.2], [-7, y(1.7), -2.2], MAT.PAINT));
    // Wheelhouse forward of midships: white, glazed all round, a mast over it.
    m.painted(TINT.STEAM, () => {
      m.box([0.4, y(1.6), -1.8], [3.4, y(3.6), 1.8], MAT.PAINT);
      m.box([0.8, y(3.6), -1.4], [3.0, y(5.0), 1.4], MAT.PAINT);
    });
    m.box([2.95, y(4.0), -1.35], [3.06, y(4.75), 1.35], MAT.CAR_GLASS);
    m.box([0.85, y(4.0), 1.36], [2.95, y(4.7), 1.44], MAT.CAR_GLASS);
    m.box([0.85, y(4.0), -1.44], [2.95, y(4.7), -1.36], MAT.CAR_GLASS);
    m.painted(TINT.METAL_DARK, () => {
      m.pipe([1.8, y(5.0), 0], [1.8, y(9.0), 0], 0.1, MAT.METAL, 5);
      m.box([1.2, y(7.6), -0.9], [2.4, y(7.75), 0.9], MAT.METAL);
      // The stern gantry, the net drum under it and the trawl doors.
      for (const s of [-1, 1] as const) m.pipe([-6.6, y(1.7), s * 1.8], [-6.2, y(6.2), s * 1.5], 0.14, MAT.METAL, 5);
      m.pipe([-6.2, y(6.2), -1.5], [-6.2, y(6.2), 1.5], 0.14, MAT.METAL, 5);
    });
    if (!lite) {
      m.painted(TINT.GREEN_DARK, () => m.pipe([-4.4, y(2.4), -1.4], [-4.4, y(2.4), 1.4], 0.62, MAT.FOLIAGE, 10));
      m.painted(TINT.ACCENT, () => {
        for (const s of [-1, 1] as const) m.box([-5.9, y(2.0), s * 2.35 - 0.1], [-4.6, y(3.3), s * 2.35 + 0.1], MAT.PAINT);
      });
      // Rails round the foredeck.
      m.painted(TINT.STEAM, () => {
        for (const s of [-1, 1] as const) m.pipe([3.4, y(2.9), s * 2.0], [6.6, y(3.3), s * 0.75], 0.04, MAT.METAL, 4);
      });
    }
  });
}

// ------------------------------------------------------------ headquarters

function farmHq(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2, lite = !fine;
  const x = 24, z = 20;
  // A farmyard is earth and gravel, with concrete only where the machines stand.
  m.painted(TINT.WOOD, () => m.box([-x, 0.0005, -z], [x, 0.08, z], MAT.GROUND));
  m.box([-6, 0.08, -18], [23, 0.14, 4], MAT.CONCRETE);
  // The farmhouse, stone under a tiled roof, facing the lane.
  m.box([-22, 0.1, 7], [-9, 6.6, 16], MAT.STONE);
  m.gable([-22.3, 6.6, 6.7], [-8.7, 6.6, 16.3], 4.0, 'x', MAT.ROOF_TILE, MAT.STONE);
  m.box([-19, 6.6, 10.4], [-18, 10.2, 11.4], MAT.BRICK);
  // The Dutch barn: a steel frame under a curved roof, open-sided, full of hay.
  barrelVault(m, -4, -18, 14, -6, 7.5, 2.6, medium ? 8 : 4, medium ? { ribs: 5, glass: MAT.METAL } : { glass: MAT.METAL });
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i <= (medium ? 4 : 2); i++) {
      const px = -4 + i * (18 / (medium ? 4 : 2));
      for (const pz of [-17.8, -6.2]) m.box([px - 0.15, 0.1, pz - 0.15], [px + 0.15, 7.6, pz + 0.15], MAT.METAL);
    }
  });
  if (medium) {
    m.painted(TINT.BRAND, () => {
      for (let r = 0; r < 3; r++) {
        for (let i = 0; i < 6; i++) {
          m.box([-3 + i * 2.9, 0.1 + r * 1.3, -17], [-0.3 + i * 2.9, 1.35 + r * 1.3, -7], MAT.TIMBER);
        }
      }
    });
  }
  // Grain silos, the landmark of a farm from any distance.
  silo(m, 19.5, 9, 3.0, 0.1, 15, { cone: 2.2, ribs: medium ? 6 : 0, tint: TINT.STEAM });
  silo(m, 19.5, 15.6, 3.0, 0.1, 15, { cone: 2.2, ribs: medium ? 6 : 0, tint: TINT.STEAM });
  if (medium) {
    // The old stone barn across the yard, doors to the concrete.
    m.box([-22, 0.1, -16], [-9, 6, -4], MAT.STONE);
    m.gable([-22.3, 6, -16.3], [-8.7, 6, -3.7], 3.6, 'x', MAT.ROOF_TILE, MAT.STONE);
    m.painted(TINT.DOOR, () => m.box([-18, 0.1, -3.9], [-13, 4.6, -3.7], MAT.TIMBER));
    // The auger from the dryer to the silos.
    m.painted(TINT.METAL_DARK, () => m.pipe([14, 1.5, 12], [19.5, 15.8, 12.3], 0.25, MAT.METAL, 6));
  }
  if (fine) {
    // Windows and a porch on the house.
    for (let i = 0; i < 4; i++) {
      const wx = -20.8 + i * 3.1;
      m.box([wx, 1.4, 15.98], [wx + 1.2, 2.9, 16.08], MAT.PANE);
      m.box([wx, 4.0, 15.98], [wx + 1.2, 5.3, 16.08], MAT.PANE);
    }
    m.painted(TINT.DOOR, () => m.box([-15.6, 0.1, 15.95], [-14.4, 2.4, 16.1], MAT.TIMBER));
    m.box([-16.6, 2.6, 16], [-13.4, 2.8, 17.6], MAT.ROOF_TILE);
    fence(m, [-23.5, 0, 18.5], [-6, 0, 18.5]);
    fence(m, [-23.5, 0, 6], [-23.5, 0, 18.5]);
    for (let i = 0; i < 4; i++) tree(m, -3 + i * 4, 16.5, 6.5, 2.0);
    bales(m, 2, 7.5, 4, false);
  }
  paintedAs(TINT.GREEN, () => {
    if (medium) tractor(m, 8, -2, 0, lite);
    if (fine) {
      trailer(m, 2.6, -2, 0, 'grain', false);
      combine(m, 16, -12, 1, false);
    }
  });
  return m;
}

function forestHq(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2, lite = !fine;
  const x = 24, z = 20;
  m.painted(TINT.WOOD, () => m.box([-x, 0.0005, -z], [x, 0.08, z], MAT.GROUND));
  m.box([-6, 0.08, -18], [23, 0.14, 18], MAT.CONCRETE);
  // The sawmill: a long timber-clad shed over the saw line, open at one end.
  m.box([-4, 0.1, -17], [20, 8, -5], MAT.TIMBER);
  m.gable([-4.4, 8, -17.4], [20.4, 8, -4.6], 3.4, 'x', MAT.METAL, MAT.TIMBER);
  // The kiln: a block with its vents.
  m.box([10, 0.1, 0], [20, 7, 8], MAT.CLADDING, { roof: MAT.METAL });
  office(m, 10, 11, 20, 18, 5.5, fine, medium);
  // The log yard: trunks in long stacks, the thing that says sawmill.
  const stack = (cx: number, cz: number, rows: number, len: number): void => {
    m.painted(TINT.WOOD, () => {
      for (let r = 0; r < rows; r++) {
        for (let i = 0; i < rows - r + 3; i++) {
          const pz = cz - (rows + 2) * 0.45 + i * 0.9 + r * 0.45;
          const py = 0.5 + r * 0.82;
          m.pipe([cx - len / 2, py, pz], [cx + len / 2, py, pz], 0.46, MAT.BARK, medium ? 7 : 5);
        }
      }
    });
  };
  stack(-15, -12, medium ? 4 : 2, 13);
  stack(-15, -2, medium ? 4 : 2, 13);
  if (medium) stack(-15, 8, 3, 13);
  if (medium) {
    // The log loader: a knuckle-boom crane on a pedestal between the stacks.
    m.painted(TINT.BRAND, () => {
      m.cylinder(-6, 3, 0.8, 0.1, 5.5, 10, MAT.PAINT);
      m.pipe([-6, 5.5, 3], [-11, 9, 3], 0.32, MAT.PAINT, 4);
      m.pipe([-11, 9, 3], [-14, 3.5, 3], 0.24, MAT.PAINT, 4);
    });
    m.painted(TINT.METAL_DARK, () => m.box([-14.6, 2.2, 2.2], [-13.4, 3.5, 3.8], MAT.METAL));
    // Sawdust: a cyclone and a chip bin, and the conveyor to them.
    silo(m, -1, 12, 2.4, 0.1, 10, { cone: 1.8, tint: TINT.METAL_DARK });
    conveyor(m, [2, 4, -5], [-1, 9.6, 10.5]);
  }
  if (fine) {
    // Sawn timber on bearers, in stickered packs.
    m.painted(TINT.WOOD, () => {
      for (let i = 0; i < 5; i++) {
        for (let k = 0; k < 3; k++) m.box([-4 + i * 2.8, 0.1 + k * 0.8, 10 + (i % 2) * 0.4], [-1.6 + i * 2.8, 0.8 + k * 0.8, 16], MAT.TIMBER);
      }
    });
    louvres(m, { axis: 'x', sign: 1, plane: 20 }, 1, 7, 3, 6, 0.4);
    for (let i = 0; i < 4; i++) tree(m, -22 + i * 3.4, 17.5, 9, 2.4);
  }
  if (medium) forwarder(m, 3, -1, 2, true, lite);
  if (fine) lorry(m, 16, -1.5, 2, 'logs', false);
  return m;
}

function oreHq(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2, lite = !fine;
  const x = 24, z = 20;
  m.painted(TINT.ACCENT, () => m.box([-x, 0.0005, -z], [x, 0.08, z], MAT.GROUND));
  m.box([-24, 0.08, 4], [24, 0.14, 20], MAT.CONCRETE);
  // The winding tower: a lattice headframe with its sheave wheels, the
  // silhouette every mining town has on its badge.
  lattice(m, -12, -8, 4.2, 1.6, 0.1, 27, medium ? 7 : 4);
  m.painted(TINT.BRAND, () => {
    m.pipe([-12, 25.5, -10.3], [-12, 25.5, -9.6], 2.4, MAT.PAINT, medium ? 16 : 8);
    m.pipe([-12, 25.5, -6.4], [-12, 25.5, -5.7], 2.4, MAT.PAINT, medium ? 16 : 8);
  });
  // The winding house, the headframe's ropes running up to it.
  m.box([-2, 0.1, -14], [8, 10, -3], MAT.BRICK);
  m.gable([-2.3, 10, -14.3], [8.3, 10, -2.7], 2.6, 'z', MAT.ROOF, MAT.BRICK);
  // The processing plant and the ore bin over the lorry bay.
  m.box([12, 0.1, -18], [23, 15, -4], MAT.SHED_WALL, { roof: MAT.METAL });
  m.box([13, 7, 0], [21, 12, 7], MAT.METAL);
  m.painted(TINT.METAL_DARK, () => {
    for (const [lx, lz] of [[13.4, 0.4], [20.6, 0.4], [13.4, 6.6], [20.6, 6.6]] as const) {
      m.box([lx - 0.25, 0.1, lz - 0.25], [lx + 0.25, 7, lz + 0.25], MAT.TRIM);
    }
    if (medium) {
      for (const s of [-1, 1] as const) m.pipe([-12, 25.5, -8 + s * 1.9], [-1, 7, -8 + s * 0.6], 0.04, MAT.METAL, 3);
    }
  });
  office(m, -22, 9, -12, 17, 6, fine, medium);
  // The spoil tip at the back of the site, in two benches.
  m.painted(TINT.ACCENT, () => {
    m.cone(-18, -14, 6, 4.4, 0.05, 3.5, medium ? 10 : 6, MAT.GROUND);
    m.cone(-18, -14, 4.4, 1.2, 3.5, 6.2, medium ? 10 : 6, MAT.GROUND);
  });
  if (medium) {
    conveyor(m, [8, 4, -8], [15, 12.5, 3]);
    band(m, 12, -18, 23, -4, 11, 0.6, 0.2, MAT.TRIM);
    m.painted(TINT.BRAND, () => m.box([-2.1, 8, -2.95], [8.1, 9, -2.8], MAT.CLADDING));
  }
  if (fine) {
    louvres(m, { axis: 'x', sign: 1, plane: 23 }, -16, -6, 6, 12, 0.4);
    for (let i = 0; i < 2; i++) figure(m, 7171 + i, -6 + i * 2, 6, 0, { stride: 0.1 });
  }
  if (medium) haulTruck(m, 17, 3.6, 1, true, lite);
  if (fine) excavator(m, -6, -16, 0, false);
  return m;
}

function oilHq(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2, lite = !fine;
  const x = 24, z = 20;
  m.box([-x, 0.0005, -z], [x, 0.1, z], MAT.CONCRETE);
  // The tank farm: white tanks with the company band, in a bund.
  const tanks: Array<[number, number, number]> = [[-15, -9, 6], [-2, -9, 6], [-15, 5, 5], [-3, 5, 5]];
  m.box([-22, 0.1, -16.5], [5, 1.0, 11.5], MAT.CONCRETE);
  m.painted(TINT.WOOD, () => m.box([-21.4, 1.0, -15.9], [4.4, 1.06, 10.9], MAT.GROUND));
  for (const [cx, cz, r] of tanks) {
    m.painted(TINT.STEAM, () => {
      m.cylinder(cx, cz, r, 1.0, 10, medium ? 22 : 12, MAT.PAINT, false);
      m.cone(cx, cz, r, r * 0.2, 10, 11.1, medium ? 22 : 12, MAT.PAINT);
    });
    if (medium) {
      m.painted(TINT.BRAND, () => m.cylinder(cx, cz, r + 0.04, 7.6, 8.8, 22, MAT.PAINT, false));
      // The spiral stair, as a raking band up the tank's side.
      m.painted(TINT.METAL_DARK, () => m.pipe([cx + r * 0.7, 1.0, cz + r * 0.72], [cx - r * 0.2, 10, cz + r + 0.1], 0.18, MAT.TRIM, 4));
    }
  }
  // The pumping station, the manifold, and the flare stack.
  m.box([9, 0.1, -17], [22, 7, -5], MAT.SHED_WALL, { roof: MAT.METAL });
  m.painted(TINT.METAL_DARK, () => {
    m.cylinder(21, 9, 0.7, 0.1, 24, 8, MAT.METAL, true);
    if (medium) lattice(m, 21, 9, 1.4, 0.8, 0.1, 22, 5);
  });
  m.painted(TINT.SIGN_LIT, () => m.cone(21, 9, 0.8, 0.2, 24, 25.4, 8, MAT.LAMP));
  m.emit(21, 25.4, 9);
  office(m, 9, 12, 17, 18, 5.5, fine, medium);
  if (medium) {
    pipeRack(m, -20, 9, -3.5, 3.6, 4, 7);
    m.painted(TINT.METAL_DARK, () => {
      for (const [cx, cz] of tanks) m.pipe([cx, 1.6, cz], [cx, 1.6, -3.5], 0.3, MAT.METAL, 6);
    });
    pumpjack(m, 14, 0, 0, lite);
  }
  if (fine) {
    lorry(m, -8, 16, 0, 'tank', false);
    lorry(m, 3, 16, 0, 'tank', false);
  }
  return m;
}

function stoneHq(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2, lite = !fine;
  const x = 24, z = 20;
  m.painted(TINT.SMOKE, () => m.box([-x, 0.0005, -z], [x, 0.08, z], MAT.GROUND));
  m.box([-24, 0.08, 6], [24, 0.14, 20], MAT.CONCRETE);
  // The primary crusher: a tall shed on a steel gantry, a hopper on top.
  m.box([-10, 0.1, -17], [2, 12, -6], MAT.SHED_WALL, { roof: MAT.METAL });
  m.box([-8, 12, -15], [0, 17, -8], MAT.SHED_WALL, { roof: MAT.METAL });
  m.painted(TINT.BRAND, () => m.cone(-4, -11.5, 3.4, 1.4, 17, 20.5, 4, MAT.PAINT));
  // Graded stockpiles: three sizes, each a tipped cone under its conveyor.
  const pile = (px: number, pz: number, r: number, h: number): void => {
    m.painted(TINT.SMOKE, () => heap(m, px, pz, r, h, medium ? 14 : 7));
  };
  pile(14, -12, 7, 8.5);
  pile(15, 1, 5.8, 7);
  pile(-18, -9, 5.4, 6.2);
  if (medium) {
    conveyor(m, [2, 10, -11], [12, 8.5, -12]);
    conveyor(m, [0, 10, -6], [13, 7.2, 1]);
    conveyor(m, [-10, 10, -11], [-16, 6.4, -9]);
    // The screening plant: a steel frame with its decks, between the piles.
    lattice(m, 7, -3, 1.4, 1.2, 0.1, 7, 3);
  }
  office(m, -22, 9, -12, 17, 5.5, fine, medium);
  if (fine) {
    // Dressed blocks waiting for the masons, and the weighbridge.
    m.painted(TINT.SMOKE, () => {
      for (let i = 0; i < 9; i++) {
        const bx = -8 + (i % 3) * 2.6, by = 0.1 + Math.floor(i / 3) * 1.25;
        m.box([bx, by, 8.5], [bx + 2.3, by + 1.15, 10.6], MAT.STONE);
      }
    });
    m.painted(TINT.METAL_DARK, () => m.box([2, 0.14, 12], [16, 0.35, 15.2], MAT.METAL));
    lorry(m, 9, 13.6, 0, 'tipper', false);
  }
  if (medium) loader(m, 7, 6, 2, lite);
  return m;
}

function fishHq(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2, lite = !fine;
  const x = 24, z = 20;
  m.box([-x, 0.0005, -z], [x, 0.1, z], MAT.CONCRETE);
  // The sea wall along the back, where the quay meets the water.
  m.box([-x, 0.1, -z], [x, 1.0, -z + 1.4], MAT.STONE);
  // The fish market: a long hall with rooflights down its ridge.
  m.box([-21, 0.1, -12], [4, 7, 2], MAT.CLADDING);
  m.gable([-21.3, 7, -12.3], [4.3, 7, 2.3], 2.2, 'x', MAT.METAL, MAT.CLADDING);
  // The ice plant and cold store.
  m.painted(TINT.STEAM, () => m.box([8, 0.1, -14], [22, 9, -2], MAT.PAINT, { roof: MAT.METAL }));
  office(m, 9, 7, 19, 16, 6, fine, medium);
  // A boat up on the slip for the winter, on its cradle.
  trawler(m, -8, 12, 0, lite, 1.2);
  m.painted(TINT.METAL_DARK, () => {
    for (const bx of [-13, -8, -3]) m.box([bx - 0.3, 0.1, 10.2], [bx + 0.3, 1.25, 13.8], MAT.METAL);
  });
  if (medium) {
    m.painted(TINT.BRAND, () => m.box([-21.1, 5, 2.05], [4.1, 6.3, 2.4], MAT.CLADDING));
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 8; i++) m.cylinder(-20 + i * 6, -18.9, 0.35, 1.0, 1.7, 8, MAT.METAL);
      // A jib crane on the quay edge.
      m.pipe([6, 1.0, -17], [6, 9, -17], 0.3, MAT.METAL, 6);
      m.pipe([6, 8.6, -17], [6, 8.6, -22.5 + 3], 0.18, MAT.METAL, 4);
    });
  }
  if (fine) {
    // Crates on the quay, nets drying on their racks, people at work.
    m.painted(TINT.ACCENT, () => {
      for (let i = 0; i < 12; i++) {
        const cx = -17 + (i % 6) * 2.1, cy = 0.1 + Math.floor(i / 6) * 0.95;
        m.box([cx, cy, -16.4], [cx + 1.85, cy + 0.85, -14.8], MAT.PAINT);
      }
    });
    m.painted(TINT.GREEN_DARK, () => m.box([-20, 1.0, -9 + 13], [-12, 3.2, -8.8 + 13], MAT.FOLIAGE));
    for (let i = 0; i < 4; i++) figure(m, 7251 + i, -4 + i * 2.6, -15.5, 0, { stride: 0.1 });
    lorry(m, 0, 17, 0, 'box', false);
  }
  return m;
}

// ------------------------------------------------------------------ props

/** Wheat standing ripe: gold, with tramlines, a headland and a hedge. */
function wheatProp(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const medium = lod < 2, fine = lod < 1;
  const h = 12;
  m.painted(TINT.GREEN, () => m.box([-h, 0.0005, -h], [h, 0.06, h], MAT.GROUND));
  // The crop in three lands between two tramlines, each at its own height so
  // the light breaks across the field.
  m.painted(TINT.BRAND, () => {
    const lands: Array<[number, number, number]> = [[-10.5, -4.0, 0.92], [-3.4, 3.4, 0.98], [4.0, 10.5, 0.9]];
    for (const [z0, z1, top] of lands) m.box([-10.5, 0.06, z0], [10.5, top, z1], MAT.GROUND);
  });
  if (medium) hedge(m, [-h + 2, 0, h - 2], [h - 2, 0, h - 2], 3.1, !fine);
  if (fine) {
    hedge(m, [h - 2, 0, -h + 2], [h - 2, 0, h - 3.5], 5.3, false);
    tree(m, 8.6, 8.4, 9, 2.8);
  }
  return m;
}

/** A crop half cut: stubble one side, standing wheat the other, the combine between. */
function harvestProp(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const medium = lod < 2, fine = lod < 1;
  const h = 12;
  m.painted(TINT.GREEN, () => m.box([-h, 0.0005, -h], [h, 0.06, h], MAT.GROUND));
  m.painted(TINT.BRAND, () => {
    m.box([-10.5, 0.06, -10.5], [10.5, 0.16, -1.5], MAT.GROUND);      // stubble
    m.box([-10.5, 0.06, 1.8], [10.5, 0.95, 10.5], MAT.GROUND);        // standing
  });
  if (medium) {
    // Swaths of straw in lines across the stubble.
    m.painted(TINT.BRAND, () => {
      for (let i = 0; i < 3; i++) m.box([-10, 0.16, -9 + i * 3], [10, 0.4, -8.2 + i * 3], MAT.FOLIAGE);
    });
    hedge(m, [-h + 2, 0, h - 2], [h - 2, 0, h - 2], 7.7, !fine);
  }
  paintedAs(TINT.GREEN_DARK, () => {
    if (medium) combine(m, -2, 0.2, 0, true);
    if (fine) {
      tractor(m, 5, -4.2, 2, true);
      trailer(m, 10, -4.2, 2, 'grain', true);
    }
  });
  return m;
}

/** Vegetables in drilled rows on brown soil, an irrigation boom over them. */
function rowsProp(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const medium = lod < 2, fine = lod < 1;
  const h = 12;
  m.painted(TINT.WOOD, () => m.box([-h, 0.0005, -h], [h, 0.07, h], MAT.GROUND));
  const rows = medium ? 11 : 5;
  for (let i = 0; i < rows; i++) {
    const rz = -10.4 + (i + 0.5) * (20.8 / rows);
    const segs = fine ? 3 : 1;
    for (let k = 0; k < segs; k++) {
      const x0 = -10.5 + (k * 21) / segs, x1 = -10.5 + ((k + 1) * 21) / segs - (fine ? 0.4 : 0);
      m.painted((k + i) % 2 === 0 ? TINT.GREEN : TINT.GREEN_DARK, () => {
        m.box([x0, 0.07, rz - 0.42], [x1, 0.42 + ((i * 7 + k * 3) % 4) * 0.05, rz + 0.42], MAT.FOLIAGE);
      });
    }
  }
  if (fine) {
    // A linear irrigation boom on A-frame towers.
    m.painted(TINT.METAL_DARK, () => {
      m.pipe([-11, 3.0, 1.1], [11, 3.0, 1.1], 0.12, MAT.METAL, 5);
      for (const tx of [-10, -3.4, 3.4, 10]) {
        m.pipe([tx, 0.1, 0.1], [tx, 3.0, 1.1], 0.07, MAT.METAL, 4);
        m.pipe([tx, 0.1, 2.1], [tx, 3.0, 1.1], 0.07, MAT.METAL, 4);
      }
    });
    hedge(m, [-h + 2, 0, -h + 2], [h - 2, 0, -h + 2], 9.1, false);
  }
  return m;
}

/** A ploughed field after harvest: furrows, and round bales waiting to go in. */
function ploughProp(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const medium = lod < 2, fine = lod < 1;
  const h = 12;
  m.painted(TINT.WOOD, () => {
    m.box([-h, 0.0005, -h], [h, 0.07, h], MAT.GROUND);
    const n = medium ? 18 : 6;
    for (let i = 0; i < n; i++) {
      const rx = -10.6 + (i + 0.5) * (21.2 / n);
      m.box([rx - 0.28, 0.07, -10.8], [rx + 0.28, 0.24, 10.8], MAT.GROUND);
    }
  });
  if (medium) {
    bales(m, -7, 6.5, 4, !fine);
    hedge(m, [-h + 2, 0, -h + 2], [-h + 2, 0, h - 2], 11.3, !fine);
  }
  if (fine) {
    bales(m, -3, -5, 3, false);
    tree(m, -8.4, -8.4, 10, 3.1);
  }
  return m;
}

/** A felling plot: stumps and brash where a stand came down, trees left standing, a forwarder loading. */
function fellingProp(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const medium = lod < 2, fine = lod < 1;
  const h = 12;
  m.painted(TINT.WOOD, () => m.box([-h, 0.0005, -h], [h, 0.06, h], MAT.GROUND));
  // The standing edge of the forest on two sides.
  const stand: Array<[number, number, number]> = [
    [-8.4, -8.2, 13], [-4.6, -8.8, 14], [-0.8, -8.3, 12.5], [3.0, -8.8, 13.5], [7, -8.4, 12],
    [-8.8, -4.0, 12.5], [-8.6, 0, 13.5], [-8.9, 4.2, 12], [-8.5, 8.2, 13],
  ];
  for (const [cx, cz, th] of stand.slice(0, medium ? stand.length : 4)) tree(m, cx, cz, th, th * 0.24);
  if (medium) {
    // Brash in windrows where the harvester worked, and stumps.
    m.painted(TINT.GREEN_DARK, () => {
      for (let i = 0; i < 3; i++) m.box([-5 + i * 5, 0.06, -4], [-2 + i * 5, 0.55, 8], MAT.FOLIAGE);
    });
    m.painted(TINT.WOOD, () => {
      for (const [sx, sz] of [[-6, -2], [-1, 1], [4, -3], [8, 3], [0, 7], [-5, 6], [6, 8]] as const) {
        m.cylinder(sx, sz, 0.42, 0.06, 0.55, 6, MAT.BARK);
      }
    });
  }
  if (fine) {
    // Replanting in rows at the far corner, and the logs stacked by the track.
    for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) tree(m, 5 + i * 2.2, 8 + k * 2.2, 1.8, 0.6);
    m.painted(TINT.WOOD, () => {
      for (let r = 0; r < 2; r++) {
        for (let i = 0; i < 5 - r; i++) m.pipe([7 + i * 0.9 + r * 0.45, 0.5 + r * 0.82, -6], [7 + i * 0.9 + r * 0.45, 0.5 + r * 0.82, 1], 0.44, MAT.BARK, 6);
      }
    });
  }
  if (medium) forwarder(m, 1, -5.8, 0, true, true);
  return m;
}

/** A terraced tip at an open-cast mine: benches, a haul road round it, machines at work. */
function mineProp(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const medium = lod < 2, fine = lod < 1;
  const h = 12;
  const sides = medium ? 12 : 7;
  m.painted(TINT.ACCENT, () => {
    m.box([-h, 0.0005, -h], [h, 0.08, h], MAT.GROUND);
    // Three benches: ore-stained rock over grey, stepping in as they climb.
    m.cone(0, 0, 10.6, 9.3, 0.05, 2.4, sides, MAT.GROUND);
    m.cylinder(0, 0, 9.3, 2.35, 2.45, sides, MAT.GROUND, true);
  });
  m.painted(TINT.SMOKE, () => {
    m.cone(0, 0, 7.7, 6.4, 2.4, 4.6, sides, MAT.STONE);
    m.cylinder(0, 0, 6.4, 4.55, 4.65, sides, MAT.STONE, true);
  });
  m.painted(TINT.ACCENT, () => {
    m.cone(0, 0, 4.9, 3.4, 4.6, 6.6, sides, MAT.GROUND);
    m.cylinder(0, 0, 3.4, 6.55, 6.65, sides, MAT.GROUND, true);
  });
  if (medium) {
    // The haul road climbing round the tip.
    m.painted(TINT.WOOD, () => {
      ramp(m, 10.4, 9.2, 0.05, 2.4, -2.8, -1.3, 1.8, fine ? 8 : 4);
      ramp(m, 7.6, 6.3, 2.4, 4.6, -0.6, 0.9, 1.6, fine ? 8 : 4);
    });
    excavator(m, 7.2, 8.4, 3, true);
  }
  if (fine) haulTruck(m, -7.4, 8.6, 0, true, true);
  return m;
}

/** A pumpjack on its gravel pad. */
function pumpjackProp(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  m.painted(TINT.SMOKE, () => m.box([-7.5, 0.0005, -5.5], [7.5, 0.15, 5.5], MAT.GROUND));
  pumpjack(m, 0, 0, 0, !fine);
  if (fine) {
    m.painted(TINT.METAL_DARK, () => {
      for (const [px, pz] of [[-7, -5], [7, -5], [-7, 5], [7, 5]] as const) {
        m.box([px - 0.06, 0.15, pz - 0.06], [px + 0.06, 1.4, pz + 0.06], MAT.METAL);
      }
      for (const [a, b] of [[[-7, -5], [7, -5]], [[-7, 5], [7, 5]], [[-7, -5], [-7, 5]], [[7, -5], [7, 5]]] as const) {
        m.pipe([a[0], 1.2, a[1]], [b[0], 1.2, b[1]], 0.03, MAT.METAL, 3);
      }
    });
  }
  return m;
}

/** A quarry face: stepped benches of cut rock, rubble at the foot, the machines. */
function quarryProp(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const medium = lod < 2, fine = lod < 1;
  const h = 12;
  m.painted(TINT.SMOKE, () => m.box([-h, 0.0005, -h], [h, 0.1, h], MAT.GROUND));
  {
    // Three benches along the back, each broken into blocks of their own height
    // so the top edge is jagged the way a worked face is.
    const benches: Array<[number, number, number]> = [[-11, -7.5, 8.5], [-7.5, -4.5, 5.8], [-4.5, -1.8, 3.2]];
    const cut = medium ? 6 : 2;
    benches.forEach(([z0, z1, top], k) => {
      for (let i = 0; i < cut; i++) {
        const x0 = -11 + (i * 22) / cut, x1 = -11 + ((i + 1) * 22) / cut;
        const t = top + Math.sin(i * 2.3 + k) * 0.7;
        // Alternate beds of dark and pale rock: the banding is what makes a cut
        // face read as geology rather than a stack of crates.
        m.painted((i + k) % 2 === 0 ? TINT.ACCENT : TINT.NONE, () => m.box([x0, 0.1, z0], [x1, t, z1], MAT.STONE));
      }
    });
    if (medium) {
      for (const [rx, rz, r] of [[-7, 1, 2.2], [3, 0.5, 1.7], [8, 1.5, 2.0]] as const) m.cone(rx, rz, r, r * 0.18, 0.05, r * 0.8, 7, MAT.STONE);
    }
  }
  if (medium) excavator(m, -3, 3.5, 1, true);
  if (fine) {
    haulTruck(m, 6, 7.5, 0, true, true);
    m.painted(TINT.NONE, () => {
      for (let i = 0; i < 4; i++) m.box([-10 + i * 2.5, 0.1, 8], [-8.1 + i * 2.5, 1.3, 10], MAT.STONE);
    });
  }
  return m;
}

/** A trawler on its fishing ground. Stood on the water, not the ground. */
function boatProp(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  trawler(m, 0, 0, 0, lod >= 1);
  return m;
}

// ------------------------------------------------------------------ table

const brand = (name: string, colour: [number, number, number], accent: [number, number, number]):
Brand => ({ name, colour, accent, sign: 'box' });

const HQ = (id: string, name: string, build: (lod: number) => MeshBuilder, jobs: number,
  upkeep: number, pollution: number, colour: [number, number, number],
  accent: [number, number, number], note: string): AssetDef => ({
  id: `spec.hq.${id}`, name, zone: 'industrial', density: 'none', variant: 'sculpted',
  footprint: [6, 5], height: 20, sim: job(jobs, upkeep, pollution),
  brand: brand(name, colour, accent), note, build,
});

const PROP = (id: string, name: string, build: (lod: number) => MeshBuilder, foot: number,
  colour: [number, number, number], accent: [number, number, number], note: string): AssetDef => ({
  id: `spec.prop.${id}`, name, zone: 'industrial', density: 'none', variant: 'sculpted',
  footprint: [foot, foot], height: 6, sim: none,
  brand: brand(name, colour, accent), note, build,
});

const WHEAT: [number, number, number] = [0.66, 0.46, 0.13];
const HAUL_YELLOW: [number, number, number] = [0.92, 0.66, 0.12];
const ORE_EARTH: [number, number, number] = [0.40, 0.22, 0.12];

export const INDUSTRY: AssetDef[] = [
  HQ('fertile', 'Farm headquarters', farmHq, 40, 900, 2, [0.80, 0.66, 0.36], [0.64, 0.16, 0.12],
    'A stone farmhouse and barn round a farmyard, a steel Dutch barn full of hay, twin silos with their auger, a tractor, trailer and combine.'),
  HQ('forest', 'Forestry headquarters', forestHq, 50, 1100, 6, [0.86, 0.56, 0.12], [0.30, 0.22, 0.14],
    'A timber-clad sawmill, a kiln, three stacks of logs with a knuckle-boom loader between them, packs of sawn timber, a forwarder and a log lorry.'),
  HQ('ore', 'Mining headquarters', oreHq, 70, 1500, 18, HAUL_YELLOW, ORE_EARTH,
    'A lattice winding tower with its sheaves and ropes to the winding house, a processing plant, an ore bin over the lorry bay, a spoil tip, a haul truck and an excavator.'),
  HQ('oil', 'Oil headquarters', oilHq, 60, 1700, 22, [0.86, 0.36, 0.12], [0.94, 0.72, 0.16],
    'Four white tanks in a bund with stairs and company bands, a pipe rack, a pumping station, a pumpjack, a lit flare stack and two tankers.'),
  HQ('stone', 'Quarry headquarters', stoneHq, 50, 1100, 14, HAUL_YELLOW, [0.34, 0.34, 0.36],
    'A crusher on a gantry with its hopper, conveyors to three graded stockpiles, a screening frame, dressed blocks, a weighbridge, a loader and a tipper.'),
  HQ('fish', 'Fishing headquarters', fishHq, 45, 1000, 4, [0.12, 0.24, 0.40], [0.72, 0.16, 0.12],
    'A quay with its sea wall and bollards, a fish market under a pitched roof, an ice plant, a jib crane, a trawler up on the slip, crates, nets and a reefer lorry.'),
  PROP('fertile', 'Wheat field', wheatProp, 3, WHEAT, [0.64, 0.16, 0.12],
    'Ripe wheat in three lands between tramlines, a headland and a hedge with a tree in it.'),
  PROP('fertile.harvest', 'Harvest', harvestProp, 3, WHEAT, [0.64, 0.16, 0.12],
    'Stubble and straw swaths one side, standing wheat the other, a combine at the cut and a tractor and trailer beside it.'),
  PROP('fertile.rows', 'Vegetable rows', rowsProp, 3, [0.24, 0.44, 0.18], [0.64, 0.16, 0.12],
    'Drilled rows of vegetables on brown soil under a linear irrigation boom.'),
  PROP('fertile.plough', 'Ploughed field', ploughProp, 3, [0.80, 0.70, 0.42], [0.64, 0.16, 0.12],
    'Furrows after harvest, round bales waiting to go in, a hedge and a tree.'),
  PROP('forest', 'Felling plot', fellingProp, 3, [0.86, 0.56, 0.12], [0.30, 0.22, 0.14],
    'The standing edge of the forest, stumps and brash windrows, replanting, a log stack and a loaded forwarder.'),
  PROP('ore', 'Mine tip', mineProp, 3, HAUL_YELLOW, ORE_EARTH,
    'Three benches of ore-stained and grey rock with a haul road round them, an excavator on top and a haul truck at the foot.'),
  PROP('oil', 'Pumpjack', pumpjackProp, 2, [0.16, 0.26, 0.42], [0.94, 0.72, 0.16],
    'A nodding-donkey pumpjack with its samson post, cranks and counterweights, wellhead and flowline, fenced on a gravel pad.'),
  PROP('stone', 'Quarry face', quarryProp, 3, HAUL_YELLOW, [0.34, 0.34, 0.36],
    'Three jagged benches of cut rock, rubble at the foot, an excavator, a haul truck and blocks.'),
  PROP('fish', 'Trawler', boatProp, 2, [0.12, 0.24, 0.40], [0.72, 0.16, 0.12],
    'A stern trawler with a lofted hull and red boot-top, a glazed wheelhouse, mast, gantry, net drum and trawl doors.'),
];

/** The props a harvest area of each resource is covered in, and how often each appears. */
export const AREA_PROPS: Record<string, Array<[string, number]>> = {
  fertile: [['spec.prop.fertile', 4], ['spec.prop.fertile.rows', 3],
    ['spec.prop.fertile.plough', 2], ['spec.prop.fertile.harvest', 1]],
  forest: [['spec.prop.forest', 1]],
  ore: [['spec.prop.ore', 1]],
  oil: [['spec.prop.oil', 1]],
  stone: [['spec.prop.stone', 1]],
  fish: [['spec.prop.fish', 1]],
};
