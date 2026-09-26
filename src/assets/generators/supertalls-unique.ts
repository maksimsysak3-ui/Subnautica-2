/**
 * Five towers that are nothing like each other, and nothing like a dark glass
 * needle either.
 *
 * Each takes a real building type whose identity is its colour and its
 * massing rather than its height: twin residential towers dressed in staggered
 * balconies and trees; a white-framed wedge sloping back from a plaza it holds
 * up on columns, with a yellow core behind; three pairs of white slabs under a
 * long park in the sky; a wide slab whose white balconies ripple like water;
 * and a stone block with a silver diagrid tower rising out of it.
 *
 * Colour comes from the building's own brand palette: a tinted surface is
 * painted, not patterned, so a frame can be white or a core yellow, and the
 * panes in front of it still carry their rooms.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { Tint, Vec3 } from '../mesh';
import { cap, forecourt, loft, plan } from './signature-parts';
import type { Ring } from './signature-parts';
import { entrance, kerb } from '../parts';
import { glaze, plate } from './towers';
import { arcadiaTower, grow, helionTower, podium, shaft, shift, soffit, square } from './supertalls';
import type { AssetDef } from '../types';

type P2 = [number, number];

/**
 * A shaft whose frame is painted: the panes sit in a coloured body up close,
 * and further off, where there are no panes, bands of the colour every second
 * floor over the curtain-wall pattern keep the tower its colour.
 */
export function skinShaft(m: MeshBuilder, lod: number, ringAt: (t: number) => Ring, y0: number, y1: number,
  floors: number, bay: number, skin: Tint): void {
  const fine = lod < 1, medium = lod < 2;
  const steps = fine ? Math.max(1, Math.ceil(floors / 2))
    : medium ? Math.max(1, Math.ceil(floors / 6)) : Math.max(1, Math.ceil(floors / 18));
  for (let k = 0; k < steps; k++) {
    const t0 = k / steps, t1 = (k + 1) / steps;
    const ya = y0 + t0 * (y1 - y0), yb = y0 + t1 * (y1 - y0);
    if (fine) m.painted(skin, () => loft(m, ringAt(t0), ringAt(t1), ya, yb, MAT.PAINT));
    else loft(m, ringAt(t0), ringAt(t1), ya, yb, MAT.GLASS);
  }
  if (fine) glaze(m, ringAt, y0, y1, floors, bay);
  else if (medium) {
    for (let f = 2; f < floors; f += 2) {
      const t = f / floors, y = y0 + t * (y1 - y0);
      const r = grow(ringAt(t), 0.08);
      m.painted(skin, () => loft(m, r, r, y - 0.5, y + 0.4, MAT.PAINT));
    }
  }
}

/** A small tree standing on a terrace at height `y`. */
export function terraceTree(m: MeshBuilder, x: number, y: number, z: number, h: number, r: number): void {
  m.painted(TINT.WOOD, () => m.cylinder(x, z, r * 0.16, y, y + h * 0.42, 5, MAT.TIMBER));
  m.painted(TINT.GREEN, () => {
    m.cone(x, z, r, r * 0.72, y + h * 0.3, y + h * 0.74, 7, MAT.TRIM);
    m.cone(x, z, r * 0.76, 0.0, y + h * 0.64, y + h, 7, MAT.TRIM);
  });
}

/** A repeatable 0..1 from integers, so a balcony pattern is the same every build. */
function hash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// ================================================================ towers

/**
 * Two residential towers dressed in trees: every floor has deep balconies on
 * every face, staggered from the floor below so each tree has open sky above
 * it, each with a concrete planter along its edge. Dark slate-brown frames,
 * pale balconies, and more green on the facade than in most parks.
 */
export function verdantTowers(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const fh = 3.6, y0 = 8;
  const towers = [
    { cx: -17, cz: -2, hx: 13, hz: 11, floors: 34 },
    { cx: 19, cz: 4, hx: 11, hz: 10, floors: 26 },
  ];

  if (fine) forecourt(m, -44, -44, 44, 44, 9101, { trees: 12, lamps: 10, people: 16, benches: 6 });
  podium(m, lod, plan(40, 30, 0.4, 32), y0, 30.4);
  towers.forEach(({ cx, cz, hx, hz, floors }, n) => {
    const ring = square(hx, hz, cx, cz);
    const top = y0 + floors * fh;
    skinShaft(m, lod, () => ring, y0, top, floors, 3.0, TINT.BRAND);
    cap(m, ring, top, MAT.ROOF);
    if (!medium) return;
    const step = fine ? 1 : 2, depth = 2.4;
    for (let f = 1; f < floors; f += step) {
      const y = y0 + f * fh;
      for (let e = 0; e < 4; e++) {
        const along = e % 2 === 0 ? hx : hz;
        const u0 = hash(f + n * 97, e) * 0.45, len = 0.35 + hash(e + 11, f) * 0.2;
        const a = -along + u0 * 2 * along, b = a + len * 2 * along;
        const s = e < 2 ? 1 : -1;
        // Faces: 0 = +z, 1 = +x, 2 = -z, 3 = -x.
        const slab = (d0: number, d1: number, ya: number, yb: number): void => {
          if (e % 2 === 0) {
            const z = cz + s * hz;
            m.box([cx + a, ya, Math.min(z + s * d0, z + s * d1)], [cx + b, yb, Math.max(z + s * d0, z + s * d1)], MAT.CONCRETE);
          } else {
            const x = cx + s * hx;
            m.box([Math.min(x + s * d0, x + s * d1), ya, cz + a], [Math.max(x + s * d0, x + s * d1), yb, cz + b], MAT.CONCRETE);
          }
        };
        slab(0, depth, y - 0.3, y);
        slab(depth - 0.6, depth, y, y + 0.9);
        if (fine && (f + e) % 2 === 0) {
          const mid = (a + b) / 2, out = depth - 1.2;
          const [tx, tz] = e % 2 === 0 ? [cx + mid, cz + s * (hz + out)] : [cx + s * (hx + out), cz + mid];
          terraceTree(m, tx, y + 0.9, tz, 3.2 + hash(f, e) * 1.6, 1.1);
        }
      }
    }
  });
  if (fine) kerb(m, -44, 42.4, 44, 43.2);
  return m;
}

/**
 * A wedge: its front face slopes back all the way up so the tower thins to a
 * blade at the roof, carried on a white megaframe braced down both sides,
 * lifted off the ground over a seven-storey public plaza, with its core --
 * lifts in glass shafts, steel stairs -- standing outside at the back in
 * yellow.
 */
export function slopeTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const y0 = 26, floors = 46, fh = 4.1, top = y0 + floors * fh;
  const hx = 15, back = -12;
  const zf = (t: number): number => 12 - 17 * t;
  const ring = (t: number): Ring => [[hx, back], [hx, zf(t)], [-hx, zf(t)], [-hx, back]];

  if (fine) forecourt(m, -35, -31, 35, 31, 9202, { trees: 6, lamps: 8, people: 20, benches: 6 });
  // The plaza under the tower: white columns, a small glass lobby.
  m.painted(TINT.NONE, () => {
    for (const x of [-hx, -5, 5, hx]) {
      for (const z of [back, zf(0)]) m.box([x - 0.8, 0.1, z - 0.8], [x + 0.8, y0, z + 0.8], MAT.TRIM);
    }
    const beam = grow(ring(0), 0.7);
    loft(m, beam, beam, y0 - 2.2, y0, MAT.TRIM);
  });
  const lobby = square(9, 4.5, 0, -6);
  loft(m, lobby, lobby, 0.1, 7, fine ? MAT.SHOPFRONT : MAT.GLASS);
  cap(m, lobby, 7, MAT.ROOF);
  soffit(m, ring(0), y0 - 2.2, MAT.CONCRETE);

  shaft(m, lod, ring, y0, top, floors, 3.0);
  cap(m, ring(1), top, MAT.ROOF);

  // The megaframe: down both sides, and across the sloping face.
  if (medium) {
    const r = fine ? 0.7 : 0.9, sides = fine ? 6 : 4;
    const bay = 7, tiers = Math.ceil(floors / bay);
    m.painted(TINT.NONE, () => {
      for (const side of [-1, 1]) {
        const x = side * (hx + 0.7);
        for (let k = 0; k < tiers; k++) {
          const ta = (k * bay) / floors, tb = Math.min(1, ((k + 1) * bay) / floors);
          const ya = y0 + ta * (top - y0), yb = y0 + tb * (top - y0);
          const A: Vec3 = [x, ya, back], B: Vec3 = [x, ya, zf(ta)];
          const C: Vec3 = [x, yb, back], D: Vec3 = [x, yb, zf(tb)];
          m.pipe(A, C, r, MAT.TRIM, sides);
          m.pipe(B, D, r, MAT.TRIM, sides);
          m.pipe(A, B, r * 0.8, MAT.TRIM, sides);
          m.pipe(A, D, r * 0.8, MAT.TRIM, sides);
        }
      }
      for (let k = 1; k * bay < floors; k++) {
        const t = (k * bay) / floors, y = y0 + t * (top - y0);
        m.pipe([-hx - 0.7, y, zf(t) + 0.6], [hx + 0.7, y, zf(t) + 0.6], r * 0.7, MAT.TRIM, sides);
      }
    });
  }
  // The core at the back, in yellow, with its lifts in glass.
  const core = square(8, 3.2, 0, back - 3.4);
  m.painted(TINT.BRAND, () => {
    loft(m, core, core, 0.1, top + 12, MAT.PAINT);
    cap(m, core, top + 12, MAT.PAINT);
  });
  if (medium) {
    for (const x of [-5, 0, 5]) m.box([x - 1.5, 2, back - 7.4], [x + 1.5, top + 8, back - 6.6], MAT.GLASS);
    m.painted(TINT.METAL_DARK, () => {
      for (const x of [-10.5, 10.5]) m.box([x - 2, 0.1, back - 6], [x + 2, top + 4, back - 1], MAT.METAL);
    });
  }
  if (fine) kerb(m, -35, 31.2, 35, 32.0);
  return m;
}

/**
 * Three towers, each a pair of white slabs -- one straight, one leaning in to
 * meet it -- under a single park three hundred metres long laid across all
 * three roofs and cantilevered off the end: a pool along one side, trees along
 * the other, glass balustrade all round.
 */
export function skypark(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const y0 = 10, floors = 50, fh = 3.9, top = y0 + floors * fh;
  const cz = -4;

  if (fine) forecourt(m, -56, -38.8, 56, 38.8, 9303, { trees: 12, lamps: 12, people: 20, benches: 6 });
  // The podium in front: a long glass mall under a white roof.
  const mall = shift(plan(48, 9, 0.6, fine ? 32 : 16), 0, 24);
  loft(m, mall, mall, 0.1, y0, fine ? MAT.SHOPFRONT : MAT.GLASS);
  m.painted(TINT.BRAND, () => cap(m, grow(mall, 0.8), y0, MAT.PAINT));
  soffit(m, grow(mall, 0.8), y0 - 0.05, MAT.CONCRETE);
  if (fine) entrance(m, { axis: 'z', sign: 1, plane: 33 }, 0, { width: 6, height: 6.5, double: true, glazed: true });

  for (const c of [-36, 0, 36]) {
    const west = square(4.2, 17, c - 5.2, cz);
    skinShaft(m, lod, () => west, 0.1, top, floors, 3.4, TINT.BRAND);
    cap(m, west, top, MAT.ROOF);
    const east = (t: number): Ring => square(4.2, 17, c + 9.5 - 4.3 * t, cz);
    skinShaft(m, lod, east, 0.1, top, floors, 3.4, TINT.BRAND);
    cap(m, east(1), top, MAT.ROOF);
  }
  // The park.
  const deck = shift(plan(55, 7.5, 0.3, fine ? 32 : 16), 0.5, cz);
  m.painted(TINT.BRAND, () => loft(m, deck, deck, top, top + 6, MAT.PAINT));
  soffit(m, deck, top, MAT.CONCRETE);
  cap(m, deck, top + 6, MAT.ROOF);
  if (medium) {
    loft(m, deck, deck, top + 6, top + 7.2, MAT.GLASS);
    m.box([-42, top + 6, cz + 1.2], [42, top + 6.25, cz + 5.4], MAT.WATER);
    m.painted(TINT.WOOD, () => m.box([-44, top + 6, cz + 0.4], [44, top + 6.12, cz + 1.2], MAT.TIMBER));
  }
  if (fine) for (let x = -46; x <= 48; x += 8) terraceTree(m, x, top + 6, cz - 4, 5.5, 2.0);
  return m;
}

/**
 * A wide residential slab wrapped in balconies of different depths on every
 * floor, so the white slab edges swell and pull back across the facade like
 * water, leaving still pools of glass where they pull back furthest.
 */
export function rippleTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const y0 = 10, floors = 62, fh = 3.3, top = y0 + floors * fh;
  const hx = 18, hz = 11;

  if (fine) forecourt(m, -44, -39, 44, 39, 9404, { trees: 10, lamps: 10, people: 16, benches: 6 });
  podium(m, lod, plan(30, 24, 0.4, 32), y0, 24.4);
  const body = square(hx, hz);
  shaft(m, lod, () => body, y0, top, floors, 3.0);
  cap(m, body, top, MAT.ROOF);
  if (!medium) return m;

  // The perimeter walked counter-clockwise from the (+x, -z) corner, a point
  // every couple of metres, each with the outward direction of its face.
  const per = fine ? 3.4 : 5.8;
  const corners: P2[] = [[hx, -hz], [hx, hz], [-hx, hz], [-hx, -hz]];
  const pts: Array<{ p: P2; n: P2; s: number }> = [];
  let walked = 0;
  for (let e = 0; e < 4; e++) {
    const a = corners[e], b = corners[(e + 1) % 4];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = (b[1] - a[1]) / len, nz = -(b[0] - a[0]) / len;
    const count = Math.max(2, Math.round(len / per));
    for (let i = 0; i < count; i++) {
      const u = i / count;
      const p: P2 = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
      // At a corner, push out along the diagonal so the plate stays square.
      const prev = corners[(e + 3) % 4];
      const pl = Math.hypot(a[0] - prev[0], a[1] - prev[1]);
      const n: P2 = i === 0 ? [nx + (a[1] - prev[1]) / pl, nz - (a[0] - prev[0]) / pl] : [nx, nz];
      pts.push({ p, n, s: walked + u * len });
    }
    walked += len;
  }
  const inner: P2[] = pts.map(({ p }) => p);
  m.painted(TINT.NONE, () => {
    for (let f = 1; f < floors; f += fine ? 1 : 2) {
      const y = y0 + f * fh;
      const outer: P2[] = pts.map(({ p, n, s }) => {
        const w = Math.sin(s * 0.105 + 2.2 * Math.sin(f * 0.13) + f * 0.04);
        const d = 0.25 + 2.3 * Math.pow(Math.max(0, w), 0.8);
        return [p[0] + n[0] * d, p[1] + n[1] * d];
      });
      plate(m, inner, outer, y - 0.24, 0.24, MAT.TRIM, MAT.TRIM);
    }
  });
  return m;
}

/**
 * A six-storey stone block of piers and tall windows, the base of an older
 * building kept whole, with a silver diagrid tower rising out of the middle of
 * it: every face a lattice of triangles four storeys tall, nothing vertical in
 * the frame at all.
 */
export function diagridPlaza(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const baseH = 30, floors = 42, fh = 4.0;
  const tx = 18, tz = 15, tcz = -4;
  const top = baseH + floors * fh;

  if (fine) forecourt(m, -56, -38.8, 56, 38.8, 9505, { trees: 12, lamps: 12, people: 18, benches: 6 });
  // The stone base.
  const base = square(34, 26);
  loft(m, base, base, 0.1, 6, fine ? MAT.SHOPFRONT : MAT.GLASS);
  loft(m, base, base, 6, baseH, MAT.STONE);
  soffit(m, grow(base, 0.4), 6, MAT.STONE);
  const cornice = grow(base, 0.9);
  loft(m, cornice, cornice, baseH - 1.6, baseH, MAT.STONE);
  cap(m, cornice, baseH, MAT.ROOF);
  if (medium) {
    // Piers every six metres and a tall window in each bay, walked along the
    // ring's edges the way the glazing is, so every face winds outward.
    m.painted(TINT.NONE, () => {
      for (let e = 0; e < 4; e++) {
        const a = base[e], b = base[(e + 1) % 4];
        const ex = b[0] - a[0], ez = b[1] - a[1], len = Math.hypot(ex, ez);
        const nx = ez / len, nz = -ex / len;
        const count = Math.round(len / 6);
        const at = (u: number, y: number, out: number): Vec3 =>
          [a[0] + ex * u + nx * out, y, a[1] + ez * u + nz * out];
        for (let i = 0; i <= count; i++) {
          const u = i / count, c = at(u, 0, 0);
          const tx0 = Math.abs(nx) > 0.5 ? 0.4 : 0.6, tz0 = Math.abs(nx) > 0.5 ? 0.6 : 0.4;
          m.box([c[0] - tx0, 6, c[2] - tz0], [c[0] + tx0, baseH - 1.6, c[2] + tz0], MAT.STONE);
          if (fine && i < count) {
            const u0 = u + 1.0 / len, u1 = (i + 1) / count - 1.0 / len;
            m.quadUV(at(u0, 8, 0.05), at(u0, 25, 0.05), at(u1, 25, 0.05), at(u1, 8, 0.05),
              [[0, 0], [0, 1], [1, 1], [1, 0]], MAT.PANE);
          }
        }
      }
    });
  }
  // The tower.
  const tower = square(tx, tz, 0, tcz);
  shaft(m, lod, () => tower, baseH, top, floors, 3.0);
  cap(m, tower, top, MAT.ROOF);
  if (medium) {
    const r = fine ? 0.5 : 0.7, sides = fine ? 6 : 4, tier = 4 * fh;
    const tiers = Math.floor((top - baseH) / tier);
    const ring = grow(tower, 0.9);
    m.painted(TINT.NONE, () => {
      for (let e = 0; e < 4; e++) {
        const a = ring[e], b = ring[(e + 1) % 4];
        const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const n = Math.max(2, Math.round(width / 9));
        const at = (u: number, y: number): Vec3 => [a[0] + (b[0] - a[0]) * u, y, a[1] + (b[1] - a[1]) * u];
        for (let j = 0; j < tiers; j++) {
          const ya = baseH + j * tier, yb = ya + tier;
          const off = (j % 2) * 0.5 / n;
          for (let k = -1; k <= n; k++) {
            const u0 = k / n + off, u1 = u0 + 0.5 / n, u2 = u0 + 1 / n;
            if (u0 >= 0 && u1 <= 1) m.pipe(at(u0, ya), at(u1, yb), r, MAT.TRIM, sides);
            if (u1 >= 0 && u2 <= 1) m.pipe(at(u1, yb), at(u2, ya), r, MAT.TRIM, sides);
          }
        }
      }
      for (let j = 1; j <= tiers; j++) {
        const y = baseH + j * tier;
        loft(m, ring, ring, y - 0.3, y + 0.3, MAT.TRIM);
      }
    });
  }
  if (fine) {
    entrance(m, { axis: 'z', sign: 1, plane: 26 }, 0, { width: 7, height: 5.5, double: true, glazed: true, canopy: 4 });
    kerb(m, -56, 39.0, 56, 39.8);
  }
  return m;
}

// ====================================================================== table

const desks = (jobs: number, upkeep: number, power: number): AssetDef['sim'] => ({
  jobs, powerKW: power, waterM3: jobs * 0.32, garbagePerWeek: jobs * 7,
  pollution: 0, upkeep,
});

interface Row {
  key: string; name: string; foot: [number, number]; jobs: number;
  upkeep: number; power: number; colour: [number, number, number];
  accent: [number, number, number]; note: string;
  build: (lod: number) => MeshBuilder;
}

const ROWS: Row[] = [
  {
    key: 'meridian', name: 'Verdant Towers', foot: [11, 11], jobs: 3400, upkeep: 4300, power: 6400,
    colour: [0.40, 0.35, 0.30], accent: [0.86, 0.84, 0.80],
    note: 'Two residential towers of thirty-four and twenty-six storeys in slate-brown frames, every floor ringed with deep staggered balconies, each with a planter and a tree, so the facades are more green than glass.',
    build: verdantTowers,
  },
  {
    key: 'arcadia', name: 'Arcadia Tower', foot: [12, 12], jobs: 3600, upkeep: 4500, power: 6800,
    colour: [0.86, 0.80, 0.66], accent: [0.34, 0.30, 0.26],
    note: 'Three glass wings round a hexagonal core in a Y, stepping back in turn so the setbacks spiral up eighty-one storeys, then the core alone in three narrowing drums to a glass crown.',
    build: arcadiaTower,
  },
  {
    key: 'helion', name: 'Helion Tower', foot: [12, 12], jobs: 3500, upkeep: 4400, power: 6600,
    colour: [0.70, 0.86, 0.90], accent: [0.26, 0.34, 0.40],
    note: 'A rounded triangle of eighty-four storeys turning a third of a circle as it narrows, in zones divided by louvred plant floors, with its glass skin carried on past the roof as an open crown.',
    build: helionTower,
  },
  {
    key: 'castellan', name: 'Skypark', foot: [14, 10], jobs: 4200, upkeep: 5200, power: 7800,
    colour: [0.88, 0.88, 0.86], accent: [0.30, 0.50, 0.62],
    note: 'Three towers of white slabs, one straight and one leaning in to meet it, under a single park laid across all three roofs and cantilevered off the end, with a pool along one side and trees along the other.',
    build: skypark,
  },
  {
    key: 'shard', name: 'Ripple Tower', foot: [11, 10], jobs: 2800, upkeep: 3600, power: 5400,
    colour: [0.30, 0.62, 0.66], accent: [0.92, 0.92, 0.90],
    note: 'A wide sixty-two storey slab wrapped in white balconies of changing depth, swelling and pulling back floor by floor so the facade ripples like water, with still pools of glass where they pull back furthest.',
    build: rippleTower,
  },
];

export const SUPERTALLS: AssetDef[] = ROWS.map((r): AssetDef => ({
  id: `sig.off.sky.${r.key}`,
  name: r.name,
  zone: 'office',
  density: 'high',
  variant: 'sculpted',
  theme: 'modern',
  signature: true,
  footprint: r.foot,
  height: 0,
  brand: { name: r.name, colour: r.colour, accent: r.accent, sign: 'box' },
  sim: desks(r.jobs, r.upkeep, r.power),
  note: r.note,
  build: r.build,
}));
