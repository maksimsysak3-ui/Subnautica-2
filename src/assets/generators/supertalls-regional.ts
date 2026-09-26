/**
 * The regional office signatures, rebuilt as real modern skyscrapers.
 *
 * Each theme's tower and headquarters slot keeps its id and its lot, so a
 * saved city loads onto the new building, but what stands on the lot is now a
 * tall building of the kind that city would actually commission: a diagrid
 * bullet and a triangular tower of sky gardens in the European city, bundled
 * steel tubes in the American one, a stack of flared modules and a prism of
 * braced quarters in the East Asian one, and on the plains a braced tapering
 * tower and a pencil-thin residential-height office with its floors opened up
 * to the wind.
 *
 * Same kit as the supertalls: lofted rings, panes that follow them, plant
 * floors, and a lit crown at most.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { Material, Vec3 } from '../mesh';
import { cap, flags, forecourt, loft, plan, scaled } from './signature-parts';
import type { Ring } from './signature-parts';
import { entrance, kerb } from '../parts';
import { tree } from './landscape';
import {
  grow, litCrown, plantFloor, podium, shaft, shift, shrink, soffit, square,
} from './supertalls';

type P2 = [number, number];

/** Both windings of a triangle: for faces seen from either side. */
function tri2(m: MeshBuilder, a: Vec3, b: Vec3, c: Vec3, mat: Material): void {
  m.tri(a, b, c, mat);
  m.tri(a, c, b, mat);
}

// ============================================================== european

/**
 * A bullet of glass on a circular plan, swelling out from the pavement to its
 * widest a third of the way up and drawing in to a glass dome, wrapped in a
 * steel diagrid of two opposed spirals -- the frame is the structure, so there
 * are no columns inside and none needed at the corners it does not have.
 */
export function lanternTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const n = fine ? 36 : medium ? 24 : 12;
  const R = 13.8, y0 = 0.2, floors = 40, fh = 4.1, top = y0 + floors * fh;
  const radius = (t: number): number => R * (0.8 + 0.32 * Math.sin(Math.PI * Math.min(1, t * 1.1)));
  const circle = plan(1, 1, 1, n);
  const at = (t: number): Ring => scaled(circle, radius(t));

  if (fine) forecourt(m, -35, -31, 35, 31, 8101, { trees: 6, lamps: 8, people: 14, benches: 4 });
  shaft(m, lod, at, y0, top, floors, 2.6);
  // The dome: the last rings closing over a glass lantern.
  const rTop = radius(1);
  const domeSteps = fine ? 6 : 3;
  for (let k = 0; k < domeSteps; k++) {
    const u0 = k / domeSteps, u1 = (k + 1) / domeSteps;
    const r0 = rTop * Math.cos(u0 * Math.PI * 0.45), r1 = rTop * Math.cos(u1 * Math.PI * 0.45);
    const ya = top + Math.sin(u0 * Math.PI * 0.45) * 14, yb = top + Math.sin(u1 * Math.PI * 0.45) * 14;
    loft(m, scaled(circle, r0), scaled(circle, r1), ya, yb, MAT.GLASS);
  }
  const lastR = rTop * Math.cos(Math.PI * 0.45);
  cap(m, scaled(circle, lastR), top + 14, MAT.GLASS);
  // The diagrid: two sets of spirals, one each way.
  if (medium) {
    const helices = fine ? 18 : 12, segs = fine ? 14 : 6, sides = fine ? 4 : 3;
    m.painted(TINT.NONE, () => {
      for (const dir of [1, -1]) {
        for (let h = 0; h < helices; h++) {
          const a0 = (h / helices) * Math.PI * 2;
          const p = (t: number): Vec3 => {
            const a = a0 + dir * t * Math.PI * 1.2, r = radius(t) + 0.3;
            return [Math.cos(a) * r, y0 + t * (top - y0), Math.sin(a) * r];
          };
          for (let s = 0; s < segs; s++) m.pipe(p(s / segs), p((s + 1) / segs), 0.28, MAT.TRIM, sides);
        }
      }
    });
    // Hoops where the spirals cross, every sixth floor.
    for (let f = 6; f < floors; f += 6) {
      const t = f / floors;
      plantFloor(m, at(t), y0 + t * (top - y0) - 0.25, 0.5);
    }
  }
  if (fine) {
    entrance(m, { axis: 'z', sign: 1, plane: radius(0) }, 0,
      { width: 5.0, height: 5.0, double: true, glazed: true, canopy: 3.6 });
    kerb(m, -35, 31.2, 35, 32.0);
  }
  return m;
}

/**
 * A triangular tower of three office wings round a full-height atrium, with a
 * concrete core at each corner, and every twelve floors one wing gives four
 * storeys over to a garden open to the sky -- a different wing each time, so
 * the gardens climb the tower in a spiral and every office looks onto one.
 */
export function skyGardenTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const R = 30, y0 = 16, fh = 4.0, zones = 4, zoneFloors = 12, extra = 6;
  const floors = zones * zoneFloors + extra, top = y0 + floors * fh;
  const corner = (j: number): P2 => {
    const a = Math.PI / 2 + (j * 2 * Math.PI) / 3;
    return [Math.cos(a) * R, Math.sin(a) * R];
  };

  if (fine) forecourt(m, -56, -44, 56, 44, 8202, { trees: 12, lamps: 12, people: 16, benches: 6 });
  podium(m, lod, plan(46, 36, 0.6, 36), y0, 36.2);

  const slab = (j: number, depth: number, inset: number): Ring => {
    const mid = Math.PI / 2 + (j * 2 * Math.PI) / 3 + Math.PI / 3;
    const d = R / 2 - inset - depth;
    return shift(scaled(square(18, depth), 1, 1, mid + Math.PI / 2), d * Math.cos(mid), d * Math.sin(mid));
  };
  for (let j = 0; j < 3; j++) {
    const outer = slab(j, 5, 0);
    for (let z = 0; z <= zones; z++) {
      const f0 = z * zoneFloors;
      const count = z < zones ? zoneFloors : extra;
      const yb = y0 + f0 * fh;
      const garden = z < zones && z % 3 === j;
      const office = garden ? count - 4 : count;
      shaft(m, lod, () => outer, yb, yb + office * fh, office, 3.0);
      if (!garden) continue;
      // The garden: a glass wall set back to the atrium side, trees on the
      // floor, the next zone's floor plate overhead.
      const gy = yb + office * fh, gTop = gy + 4 * fh;
      cap(m, outer, gy, MAT.ROOF);
      const back = slab(j, 1.2, 7.6);
      loft(m, back, back, gy, gTop, MAT.GLASS);
      soffit(m, outer, gTop, MAT.CONCRETE);
      if (fine) {
        const mid = Math.PI / 2 + (j * 2 * Math.PI) / 3 + Math.PI / 3;
        const d = R / 2 - 3.5;
        for (const along of [-11, 0, 11]) {
          const tx = Math.cos(mid) * d - Math.sin(mid) * along;
          const tz = Math.sin(mid) * d + Math.cos(mid) * along;
          tree(m, tx, tz, 9.0, 2.6);
        }
      }
    }
    cap(m, outer, top, MAT.ROOF);
    if (medium) plantFloor(m, outer, top - 3, 3);
  }
  // The corner cores, rising past the roof.
  for (let j = 0; j < 3; j++) {
    const [cx, cz] = corner(j);
    const core = shift(plan(5.2, 5.2, 0.6, fine ? 16 : 8), cx * 0.84, cz * 0.84);
    loft(m, core, core, y0, top + 14, MAT.CONCRETE);
    cap(m, core, top + 14, MAT.ROOF);
    if (medium) litCrown(m, core, top + 10, 1.4);
  }
  // The atrium's glass roof.
  const atrium: Ring = [0, 1, 2].map((j) => { const [x, z] = corner(j); return [x * 0.32, z * 0.32] as P2; });
  cap(m, atrium, top - 0.5, MAT.GLASS);
  return m;
}

// ============================================================== american

/**
 * Nine square steel tubes bundled three by three, each stopping at its own
 * height -- the framed-tube idea that made the first hundred-storey towers
 * possible -- so the silhouette steps down in a spiral of setbacks, with
 * black louvred plant floors banding the tubes that pass them.
 */
export function bundledTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 4.6, pitch = 9.2, y0 = 9, fh = 3.9;
  const heights = [
    [50, 90, 66],
    [66, 108, 90],
    [50, 66, 50],
  ];

  if (fine) forecourt(m, -35, -31, 35, 31, 8303, { trees: 6, lamps: 8, people: 14, benches: 4 });
  const lobbyRing = square(14.2, 14.2);
  loft(m, lobbyRing, lobbyRing, 0.1, y0, fine ? MAT.SHOPFRONT : MAT.GLASS);
  m.painted(TINT.METAL_DARK, () => {
    const g = grow(lobbyRing, 0.6);
    loft(m, g, g, y0 - 1.2, y0, MAT.METAL);
  });
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const floors = heights[r][c];
      const cx = (c - 1) * pitch, cz = (r - 1) * pitch;
      const tube = square(w, w, cx, cz);
      const top = y0 + floors * fh;
      shaft(m, lod, () => tube, y0, top, floors, 3.0);
      cap(m, tube, top, MAT.ROOF);
      if (medium) {
        for (const f of [30, 64, 88]) if (f < floors) plantFloor(m, tube, y0 + f * fh - 1, 4);
        plantFloor(m, tube, top - 4, 4);
        // Black mullions up the corners: the tube is a frame of steel.
        m.painted(TINT.METAL_DARK, () => {
          for (const [x, z] of tube) m.box([x - 0.35, y0, z - 0.35], [x + 0.35, top, z + 0.35], MAT.METAL);
        });
      }
      if (floors === 108 && medium) {
        m.painted(TINT.METAL_DARK, () => m.box([cx - 3, top, cz - 3], [cx + 3, top + 7, cz + 3], MAT.METAL));
      }
    }
  }
  if (fine) {
    entrance(m, { axis: 'z', sign: 1, plane: 14.2 }, 0,
      { width: 6.0, height: 6.6, double: true, glazed: true, canopy: 4.0 });
    kerb(m, -35, 31.2, 35, 32.0);
    flags(m, -12, 12, 20, 0.2, 5, 8);
  }
  return m;
}

// ================================================================= asian

/**
 * A tapering base of twenty-four floors and then eight modules of eight floors
 * each, every module flaring outward as it rises like the segments of a
 * bamboo stem, with a ledge at every joint, and a stepped crown lit at the top.
 */
export function moduleTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const n = fine ? 20 : medium ? 16 : 8;
  const body = plan(18, 18, 0.14, n);
  const fh = 4.2, y0 = 12;

  if (fine) forecourt(m, -39, -35, 39, 35, 8404, { trees: 8, lamps: 8, people: 14, benches: 4 });
  podium(m, lod, plan(30, 28, 0.35, 32), y0, 28.2);
  let y = y0;
  const baseFloors = 24;
  shaft(m, lod, (t) => scaled(body, 1 - 0.22 * t), y, y + baseFloors * fh, baseFloors, 3.0);
  y += baseFloors * fh;
  for (let k = 0; k < 8; k++) {
    const floors = 8, h = floors * fh;
    const ledge = grow(scaled(body, 0.78), 0.8);
    m.painted(TINT.METAL_DARK, () => loft(m, ledge, ledge, y - 0.5, y, MAT.METAL));
    cap(m, ledge, y, MAT.TRIM);
    soffit(m, ledge, y - 0.5, MAT.METAL);
    shaft(m, lod, (t) => scaled(body, 0.72 + 0.12 * t), y, y + h, floors, 3.0);
    y += h;
  }
  const lastRing = scaled(body, 0.84);
  cap(m, lastRing, y, MAT.ROOF);
  // The crown: three tiers, each a little narrower, the top one lit.
  for (const [k, floors] of [[0.56, 5], [0.42, 4], [0.28, 3]] as const) {
    const ring = scaled(body, k);
    shaft(m, lod, () => ring, y, y + floors * fh, floors, 2.6);
    cap(m, ring, y + floors * fh, MAT.ROOF);
    y += floors * fh;
  }
  if (medium) litCrown(m, scaled(body, 0.28), y - 3 * fh, 3 * fh - 0.5);
  return m;
}

/**
 * A square split along its diagonals into four triangular quarters that stop
 * at four heights, each finished with a sloping glass roof rising to the
 * centre, and the whole frame braced with great white X's across every face
 * -- the bracing is the structure, and it is what the tower is known by.
 */
export function prismTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const H = 20, y0 = 14, fh = 4.0;
  const P: P2[] = [[H, -H], [H, H], [-H, H], [-H, -H]];
  const floors = [40, 30, 56, 72];

  if (fine) forecourt(m, -52, -39, 52, 39, 8505, { trees: 10, lamps: 10, people: 16, benches: 6 });
  podium(m, lod, plan(50, 30, 0.3, 32), y0, 30.4);
  const tops: number[] = [];
  for (let q = 0; q < 4; q++) {
    const a = P[q], b = P[(q + 1) % 4];
    const ring: Ring = [[0, 0], a, b];
    const top = y0 + floors[q] * fh;
    tops.push(top);
    shaft(m, lod, () => ring, y0, top, floors[q], 3.2);
    // The sloping roof, rising to the centre, and the gables it leaves.
    const rise = 22;
    tri2(m, [a[0], top, a[1]], [b[0], top, b[1]], [0, top + rise, 0], MAT.GLASS);
    tri2(m, [0, top, 0], [a[0], top, a[1]], [0, top + rise, 0], MAT.GLASS);
    tri2(m, [b[0], top, b[1]], [0, top, 0], [0, top + rise, 0], MAT.GLASS);
  }
  // The bracing: across each outer face, an X to every twelve floors.
  if (medium) {
    const r = fine ? 0.55 : 0.8, sides = fine ? 6 : 4;
    m.painted(TINT.NONE, () => {
      for (let q = 0; q < 4; q++) {
        const a = P[q], b = P[(q + 1) % 4];
        const nx = (a[0] + b[0]) / (2 * H) * 0.5, nz = (a[1] + b[1]) / (2 * H) * 0.5;
        const top = tops[q];
        const bay = 12 * fh;
        for (let y = y0; y + bay <= top + 0.1; y += bay) {
          const A: Vec3 = [a[0] + nx, y, a[1] + nz], B: Vec3 = [b[0] + nx, y + bay, b[1] + nz];
          const C: Vec3 = [b[0] + nx, y, b[1] + nz], D: Vec3 = [a[0] + nx, y + bay, a[1] + nz];
          m.pipe(A, B, r, MAT.TRIM, sides);
          m.pipe(C, D, r, MAT.TRIM, sides);
          m.pipe(D, B, r, MAT.TRIM, sides);
        }
      }
      // Corner columns, up to the taller of the two quarters beside each.
      for (let q = 0; q < 4; q++) {
        const c = P[q];
        const top = Math.max(tops[q], tops[(q + 3) % 4]);
        m.pipe([c[0], y0, c[1]], [c[0], top, c[1]], r * 1.4, MAT.TRIM, sides);
      }
    });
    litCrown(m, [[0, -1.5], [1.5, 0], [0, 1.5], [-1.5, 0]] as Ring, Math.max(...tops) + 22, 0.1);
  }
  return m;
}

// =============================================================== farming

/**
 * A rectangular tower tapering all the way up, braced on every face by five
 * storeys-high X's of dark steel, with the corner columns leaning in with it
 * -- the braced tube, which put a hundred floors on the plains' soft ground
 * with half the steel of a frame.
 */
export function bracedTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const y0 = 12, floors = 90, fh = 3.8, top = y0 + floors * fh;
  const at = (t: number): Ring => square(24 - 9 * t, 15 - 5.5 * t);

  if (fine) forecourt(m, -60, -44, 60, 44, 8606, { trees: 12, lamps: 12, people: 18, benches: 6 });
  podium(m, lod, plan(34, 24, 0.3, 32), y0, 24.4);
  shaft(m, lod, at, y0, top, floors, 3.0);
  cap(m, at(1), top, MAT.ROOF);
  if (medium) {
    plantFloor(m, at(1), top - 6, 6);
    litCrown(m, at(1), top - 2, 1.5);
    const r = fine ? 0.75 : 1.0, sides = fine ? 6 : 4;
    const tiers = 5;
    const corner = (t: number, k: number): Vec3 => {
      const ring = grow(at(t), 0.9);
      return [ring[k][0], y0 + t * (top - y0), ring[k][1]];
    };
    m.painted(TINT.METAL_DARK, () => {
      for (let k = 0; k < 4; k++) {
        const j = (k + 1) % 4;
        for (let s = 0; s < tiers; s++) {
          const t0 = s / tiers, t1 = (s + 1) / tiers;
          m.pipe(corner(t0, k), corner(t1, j), r, MAT.METAL, sides);
          m.pipe(corner(t0, j), corner(t1, k), r, MAT.METAL, sides);
          m.pipe(corner(t1, k), corner(t1, j), r * 0.8, MAT.METAL, sides);
        }
        m.pipe(corner(0, k), corner(1, k), r * 1.3, MAT.METAL, sides);
      }
    });
  }
  return m;
}

/**
 * A pencil: a twenty-eight metre square carried four hundred metres up, its
 * facade a plain grid of concrete frame and big square windows, and every
 * twelve floors two storeys left open to the wind so it does not sway. A low
 * glazed office building beside it holds the street.
 */
export function pencilTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hw = 14, fh = 4.4, seg = 12, gap = 2, segments = 7;
  const cx = 16;
  const body = square(hw, hw, cx, 0);

  if (fine) forecourt(m, -56, -38.8, 56, 38.8, 8707, { trees: 12, lamps: 12, people: 16, benches: 6 });
  // The base building, to the west.
  const base = square(16, 26, -34, 0);
  shaft(m, lod, () => base, 0.1, 26, 6, 3.2);
  cap(m, base, 26, MAT.ROOF);
  if (medium) plantFloor(m, base, 24, 2);

  let y = 0.1;
  for (let s = 0; s < segments; s++) {
    const h = seg * fh;
    // Concrete frame behind the panes, so the grid shows white.
    loft(m, body, body, y, y + h, fine ? MAT.CONCRETE : MAT.GLASS);
    if (fine) {
      // Panes: one big square per bay, set in the frame.
      for (let f = 0; f < seg; f++) {
        const fy = y + f * fh;
        for (let e = 0; e < 4; e++) {
          const a = body[e], b = body[(e + 1) % 4];
          const ex = b[0] - a[0], ez = b[1] - a[1], len = Math.hypot(ex, ez);
          const nx = (ez / len) * 0.05, nz = (-ex / len) * 0.05;
          const bays = 6;
          for (let k = 0; k < bays; k++) {
            const s0 = (k + 0.1) / bays, s1 = (k + 0.9) / bays;
            const p = (u: number, yy: number): Vec3 => [a[0] + ex * u + nx, yy, a[1] + ez * u + nz];
            m.quadUV(p(s0, fy + 0.5), p(s0, fy + fh - 0.4), p(s1, fy + fh - 0.4), p(s1, fy + 0.5),
              [[0, 0], [0, 1], [1, 1], [1, 0]], MAT.PANE);
          }
        }
      }
    }
    y += h;
    if (s === segments - 1) break;
    // The open floors: the core and the four corner columns, nothing else.
    cap(m, body, y, MAT.CONCRETE);
    const core = square(6, 6, cx, 0);
    loft(m, core, core, y, y + gap * fh, MAT.CONCRETE);
    for (const [x, z] of body) {
      const ix = x - Math.sign(x - cx) * 1.2, iz = z - Math.sign(z) * 1.2;
      m.box([Math.min(x, ix), y, Math.min(z, iz)], [Math.max(x, ix), y + gap * fh, Math.max(z, iz)], MAT.CONCRETE);
    }
    soffit(m, body, y + gap * fh, MAT.CONCRETE);
    y += gap * fh;
  }
  cap(m, body, y, MAT.ROOF);
  if (medium) {
    // The parapet, open at the top: the frame carried past the roof.
    loft(m, body, body, y, y + 8, MAT.CONCRETE);
    loft(m, shrink(body, 0.95), shrink(body, 0.95), y, y + 8, MAT.CONCRETE, true);
  }
  if (fine) {
    entrance(m, { axis: 'z', sign: 1, plane: hw }, cx, { width: 5.0, height: 6.0, double: true, glazed: true, canopy: 3.6 });
    kerb(m, -56, 39.0, 56, 39.8);
  }
  return m;
}
