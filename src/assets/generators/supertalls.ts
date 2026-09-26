/**
 * Supertalls: five landmark skyscrapers of the kind real skylines are built
 * around, the lofting kit the office signatures share, and the glass tower
 * that replaced the zoned spire tower.
 *
 * Each one is a real structural and planning idea carried the whole height,
 * because that is what makes the famous ones read from across a city: a square
 * whose corners are chamfered into eight triangles until the top is the base
 * turned forty-five degrees; a Y of three wings stepping back in a spiral; a
 * rounded triangle that twists as it narrows, split into zones by plant floors,
 * with its skin carried up past the roof as a crown; a pair of star-plan
 * towers setting back in tiers with a bridge between them; and a cluster of
 * glass shards leaning in until they part at the top.
 *
 * No science fiction: dark glass hung pane by pane, plant floors behind
 * louvres, stone and glass podiums with a door you can find, and at most a lit
 * crown. A plan is a ring of points, a shaft is rings at heights, and glazing
 * follows the rings however they lean or turn. Every level of detail is the
 * same form with fewer rings.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { Material } from '../mesh';
import type { AssetDef } from '../types';
import type { ThemeProfile } from '../themes';
import { storeysOf } from '../themed-parts';
import { cap, flags, forecourt, loft, plan, porteCochere, scaled } from './signature-parts';
import type { Ring } from './signature-parts';
import { glaze, glassShaft } from './towers';
import { entrance, kerb } from '../parts';

type P2 = [number, number];

// ---------------------------------------------------------------- the kit

export const shift = (r: Ring, dx: number, dz: number): Ring => r.map(([x, z]) => [x + dx, z + dz] as P2);

export function centroid(r: Ring): P2 {
  let x = 0, z = 0;
  for (const p of r) { x += p[0]; z += p[1]; }
  return [x / r.length, z / r.length];
}

/** Every point pushed away from the ring's own centre by `d` metres. */
export function grow(r: Ring, d: number): Ring {
  const [cx, cz] = centroid(r);
  return r.map(([x, z]) => {
    const l = Math.hypot(x - cx, z - cz) || 1;
    return [x + ((x - cx) / l) * d, z + ((z - cz) / l) * d] as P2;
  });
}

/** A plan scaled about its own centre rather than the origin. */
export function shrink(r: Ring, k: number): Ring {
  const [cx, cz] = centroid(r);
  return r.map(([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k] as P2);
}

/**
 * A glass shaft through the plans `ringAt` gives from 0 to 1: a dark body with
 * real panes up close, the curtain-wall pattern further off.
 */
export function shaft(m: MeshBuilder, lod: number, ringAt: (t: number) => Ring, y0: number, y1: number,
  floors: number, bay: number): void {
  const fine = lod < 1, medium = lod < 2;
  const steps = fine ? Math.max(1, Math.ceil(floors / 2))
    : medium ? Math.max(1, Math.ceil(floors / 6)) : Math.max(1, Math.ceil(floors / 18));
  for (let k = 0; k < steps; k++) {
    const t0 = k / steps, t1 = (k + 1) / steps;
    loft(m, ringAt(t0), ringAt(t1), y0 + t0 * (y1 - y0), y0 + t1 * (y1 - y0), fine ? MAT.DARK_TRIM : MAT.GLASS);
  }
  if (fine) glaze(m, ringAt, y0, y1, floors, bay);
}

/**
 * A plant floor: louvres standing a little proud of the glass. The horizontal
 * break every dozen floors that tells the eye a tall building is built in
 * zones, and how tall each one is.
 */
export function plantFloor(m: MeshBuilder, r: Ring, y: number, h: number): void {
  const g = grow(r, 0.35);
  m.painted(TINT.METAL_DARK, () => loft(m, g, g, y, y + h, MAT.METAL));
  cap(m, g, y + h, MAT.TRIM);
}

/** A crown lit from within: the one light a real tower puts on at night. */
export function litCrown(m: MeshBuilder, r: Ring, y: number, h: number): void {
  const g = grow(r, 0.15);
  m.painted(TINT.SIGN_LIT, () => loft(m, g, g, y, y + h, MAT.PAINT));
}

/** A lid facing down: a soffit, seen from the street. */
export function soffit(m: MeshBuilder, r: Ring, y: number, mat: Material): void {
  const [cx, cz] = centroid(r);
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length];
    m.tri([cx, y, cz], [a[0], y, a[1]], [b[0], y, b[1]], mat);
  }
}

/** A podium: glass at the street, stone above, a roof, the door on +Z at `front`. */
export function podium(m: MeshBuilder, lod: number, r: Ring, h: number, front: number): void {
  const fine = lod < 1;
  const glassH = Math.min(h - 2, 9);
  loft(m, r, r, 0.1, glassH, fine ? MAT.SHOPFRONT : MAT.GLASS);
  const stone = grow(r, 0.4);
  loft(m, stone, stone, glassH, h, MAT.STONE);
  soffit(m, stone, glassH, MAT.STONE);
  cap(m, stone, h, MAT.ROOF);
  if (fine) {
    entrance(m, { axis: 'z', sign: 1, plane: front }, 0,
      { width: 6.0, height: Math.min(glassH - 0.8, 7.0), double: true, glazed: true, canopy: 4.0 });
    porteCochere(m, -9, 9, front + 0.4, 6.0, Math.min(glassH - 0.5, 6.8), 4);
  }
}

/** A square as a ring: four corners, counter-clockwise, about (cx, cz). */
export function square(hx: number, hz: number, cx = 0, cz = 0): Ring {
  return [[cx + hx, cz - hz], [cx + hx, cz + hz], [cx - hx, cz + hz], [cx - hx, cz - hz]];
}

/** A triangle with rounded corners, counter-clockwise, one corner towards -Z. */
export function triPlan(R: number, cr: number, seg: number): Ring {
  const out: Ring = [];
  for (let k = 0; k < 3; k++) {
    const th = -Math.PI / 6 + (k * 2 * Math.PI) / 3;
    const cx = Math.cos(th) * (R - 2 * cr), cz = Math.sin(th) * (R - 2 * cr);
    for (let i = 0; i <= seg; i++) {
      const a = th - Math.PI / 3 + (i / seg) * ((2 * Math.PI) / 3);
      out.push([cx + Math.cos(a) * cr, cz + Math.sin(a) * cr]);
    }
  }
  return out;
}

/** Two squares turned against each other with the inner corners filled round: an eight-point star. */
export function starPlan(R: number, n: number): Ring {
  const out: Ring = [];
  const sq = (b: number): number => R / Math.max(Math.abs(Math.cos(b)), Math.abs(Math.sin(b)));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = Math.min(R * 1.36, Math.max(sq(a), sq(a - Math.PI / 4), R * 1.13));
    out.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return out;
}

// ------------------------------------------------------------- the towers

/**
 * A square tower whose corners are cut back as it rises: every face is a
 * triangle, eight of them, so the base square becomes the same square turned
 * forty-five degrees at the roof and the middle floors are a perfect octagon.
 * On a square podium of stone fins, with a glass parapet and a lit crown.
 */
function oneMeridian(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const a = 22, b = a * 0.6;
  const y0 = 22, floors = 90, fh = 4.0, top = y0 + floors * fh;
  const oct = (t: number): Ring => {
    const out: Ring = [];
    const mid = a * (1 - t) + b * Math.SQRT2 * t;       // base edge midpoint -> top corner
    const corner = a * Math.SQRT2 * (1 - t) + b * t;    // base corner -> top edge midpoint
    for (let k = 0; k < 8; k++) {
      const ang = (k * Math.PI) / 4, r = k % 2 === 0 ? mid : corner;
      out.push([r * Math.cos(ang), r * Math.sin(ang)]);
    }
    return out;
  };

  if (fine) forecourt(m, -44, -44, 44, 44, 7101, { trees: 12, lamps: 10, people: 16, benches: 6 });
  podium(m, lod, plan(25, 25, 0.04, 32), y0, 25.4);
  if (medium) {
    m.painted(TINT.NONE, () => {
      for (let i = -5; i <= 5; i++) {
        const u = i * 4.6;
        m.box([u - 0.25, 9, 25.2], [u + 0.25, y0, 26.6], MAT.STONE);
        m.box([u - 0.25, 9, -26.6], [u + 0.25, y0, -25.2], MAT.STONE);
        m.box([25.2, 9, u - 0.25], [26.6, y0, u + 0.25], MAT.STONE);
        m.box([-26.6, 9, u - 0.25], [-25.2, y0, u + 0.25], MAT.STONE);
      }
    });
  }
  shaft(m, lod, oct, y0, top, floors, 3.0);
  if (medium) for (const f of [30, 60]) plantFloor(m, oct(f / floors), y0 + f * fh - 1, 4);
  // Parapet: the glass carried up past the roof, lit from inside.
  const last = oct(1);
  loft(m, last, last, top, top + 8, fine ? MAT.DARK_TRIM : MAT.GLASS);
  loft(m, shrink(last, 0.96), shrink(last, 0.96), top, top + 8, MAT.DARK_TRIM, true);
  cap(m, shrink(last, 0.96), top + 1, MAT.ROOF);
  if (medium) litCrown(m, last, top + 5, 3);
  if (fine) flags(m, -18, 18, 32, 0.2, 7, 10);
  return m;
}

/**
 * Three wings round a hexagonal core in a Y, the plan that lets a tower go
 * higher than any other -- each wing buttresses the other two. The wings step
 * back one at a time, in turn, so the setbacks spiral up the tower, and the
 * core carries on alone above the last of them in three narrowing drums.
 */
function arcadiaTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const n = fine ? 18 : medium ? 12 : 8;
  const fh = 4.0, y0 = 16, tierFloors = 9, tiers = 9;
  const tierH = tierFloors * fh;
  const width = 7.5;

  if (fine) forecourt(m, -48, -48, 48, 48, 7202, { trees: 12, lamps: 10, people: 14, benches: 6 });
  podium(m, lod, plan(30, 30, 0.8, 36), y0, 30.2);

  const wing = (j: number, tip: number): Ring => {
    const th = Math.PI / 2 + (j * 2 * Math.PI) / 3;
    const half = (tip - 2) / 2;
    const centre = 2 + half;
    return shift(scaled(plan(half, width, 0.55, n), 1, 1, th), centre * Math.cos(th), centre * Math.sin(th));
  };
  for (let k = 0; k < tiers; k++) {
    const yb = y0 + k * tierH, yt = yb + tierH;
    for (let j = 0; j < 3; j++) {
      // Each wing gives up five and a half metres every third tier, offset by wing.
      const steps = Math.floor((k + 3 - j) / 3);
      const tip = 34 - steps * 5.5;
      if (tip < 10) continue;
      const r = wing(j, tip);
      shaft(m, lod, () => r, yb, yt, tierFloors, 2.6);
      cap(m, r, yt, MAT.ROOF);
    }
  }
  // The core, above the wings: three drums, each narrower, then a crown.
  const core = (r: number): Ring => plan(r, r, 1, fine ? 24 : 12);
  let y = y0 + tiers * tierH;
  for (const [r, floors] of [[10, 7], [8, 6], [6, 5]] as const) {
    const ring = core(r);
    shaft(m, lod, () => ring, y, y + floors * fh, floors, 2.6);
    cap(m, ring, y + floors * fh, MAT.ROOF);
    if (medium) plantFloor(m, ring, y + floors * fh - 2, 2);
    y += floors * fh;
  }
  const crown = core(4.2);
  loft(m, crown, shrink(crown, 0.4), y, y + 14, MAT.GLASS);
  if (medium) litCrown(m, crown, y, 2);
  return m;
}

/**
 * A rounded triangle turning a third of a circle as it narrows, the shape that
 * sheds a typhoon's wind a quarter better than a square. Zones of a dozen
 * floors, each finished by a plant floor, and at the top the glass skin
 * carried on past the roof as an open crown.
 */
function helionTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const seg = fine ? 8 : medium ? 5 : 3;
  const y0 = 18, floors = 84, fh = 4.2, top = y0 + floors * fh;
  const base = triPlan(29, 10, seg);
  const at = (t: number): Ring => scaled(base, 1 - 0.4 * t, 1 - 0.4 * t, 2.0 * t);

  if (fine) forecourt(m, -46, -46, 46, 46, 7303, { trees: 12, lamps: 10, people: 14, benches: 6 });
  podium(m, lod, plan(32, 30, 0.85, 40), y0, 30.2);
  shaft(m, lod, at, y0, top, floors, 3.2);
  if (medium) {
    for (let f = 12; f < floors; f += 12) {
      const t = f / floors;
      plantFloor(m, at(t), y0 + t * (top - y0) - 1.2, 3.0);
    }
  }
  // The crown: the skin rising past the roof and still turning, open to the sky.
  const crownH = 24;
  const ext = (t: number): Ring => scaled(base, 0.6 - 0.1 * t, 0.6 - 0.1 * t, 2.0 + 0.3 * t);
  const steps = fine ? 4 : 2;
  for (let k = 0; k < steps; k++) {
    const t0 = k / steps, t1 = (k + 1) / steps;
    const ya = top + t0 * crownH, yb = top + t1 * crownH;
    loft(m, ext(t0), ext(t1), ya, yb, MAT.GLASS);
    loft(m, shrink(ext(t0), 0.97), shrink(ext(t1), 0.97), ya, yb, MAT.DARK_TRIM, true);
  }
  cap(m, at(1), top, MAT.ROOF);
  if (medium) litCrown(m, ext(1), top + crownH - 1.2, 1.2);
  return m;
}

/**
 * Twin towers on a star plan, each setting back in five tiers to a stack of
 * drums, joined a hundred and twenty metres up by a two-storey skybridge on
 * raking legs, over a shared podium that is a shopping centre in its own right.
 */
function castellanTowers(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const n = fine ? 48 : medium ? 32 : 16;
  const fh = 4.0, y0 = 20, X = 25;

  if (fine) forecourt(m, -56, -38.8, 56, 38.8, 7404, { trees: 10, lamps: 12, people: 18, benches: 6 });
  podium(m, lod, plan(52, 24, 0.5, 40), y0, 24.2);
  const tiers: Array<[number, number]> = [[11, 32], [10, 8], [9, 5], [7.8, 4], [6.6, 3]];
  let bridgeY = 0;
  for (const side of [-1, 1]) {
    let y = y0;
    tiers.forEach(([R, floors], k) => {
      const ring = shift(starPlan(R, n), side * X, 0);
      shaft(m, lod, () => ring, y, y + floors * fh, floors, 2.6);
      cap(m, ring, y + floors * fh, MAT.ROOF);
      if (medium && k < 3) plantFloor(m, ring, y + floors * fh - 1.0, 1.0);
      if (k === 0) bridgeY = y + 26 * fh;
      y += floors * fh;
    });
    // The drums and the crown.
    const segsN = fine ? 20 : 10;
    for (const [r, h] of [[5.0, 10], [3.6, 8], [2.4, 7]] as const) {
      m.cylinder(side * X, 0, r, y, y + h, segsN, MAT.GLASS);
      if (medium) m.painted(TINT.METAL_DARK, () => m.cylinder(side * X, 0, r + 0.3, y + h - 1, y + h, segsN, MAT.METAL));
      y += h;
    }
    if (medium) litCrown(m, shift(plan(2.4, 2.4, 1, segsN), side * X, 0), y - 7, 3);
  }
  // The skybridge and its legs.
  const inner = X - 12.5;
  m.box([-inner, bridgeY, -3.2], [inner, bridgeY + 8.5, 3.2], MAT.GLASS);
  m.painted(TINT.METAL_DARK, () => {
    m.box([-inner, bridgeY - 0.6, -3.4], [inner, bridgeY, 3.4], MAT.METAL);
    m.box([-inner, bridgeY + 8.5, -3.4], [inner, bridgeY + 9.1, 3.4], MAT.METAL);
    for (const s of [-1, 1]) {
      m.pipe([s * inner, bridgeY - 44, 0], [s * 1.5, bridgeY - 0.6, 0], 0.8, MAT.METAL, fine ? 10 : 6);
    }
  });
  if (fine) kerb(m, -56, 39.0, 56, 39.8);
  return m;
}

/**
 * Eight glass shards leaning in round a tall irregular plan, each a plane, and
 * none quite meeting the next: at the top they part and stand open to the sky
 * at different heights, which is the whole silhouette.
 */
function paragonShard(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const y0 = 14, height = 300, fh = 4.0;
  const radii = [26, 23, 25, 22, 26, 23, 24, 22];
  const base: Ring = radii.map((r, k) => {
    const a = (k / 8) * Math.PI * 2 + 0.2;
    return [Math.cos(a) * r, Math.sin(a) * r * 0.85] as P2;
  });
  const at = (t: number): Ring => scaled(base, 1 - 0.9 * t);
  const closed = 0.84;
  const topClosed = y0 + closed * height;
  const floors = Math.round((topClosed - y0) / fh);

  if (fine) forecourt(m, -44, -40, 44, 40, 7505, { trees: 10, lamps: 10, people: 16, benches: 6 });
  podium(m, lod, grow(base, 3), y0, 23.8);
  shaft(m, lod, (t) => at(t * closed), y0, topClosed, floors, 3.0);
  cap(m, at(closed), topClosed, MAT.ROOF);
  // The shards above: each face carried on alone to its own height.
  const lift = [1.0, 0.93, 0.97, 0.9, 0.99, 0.92, 0.95, 0.91];
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    const tEnd = lift[i];
    const A = at(closed), B = at(tEnd);
    const ya = topClosed, yb = y0 + tEnd * height;
    m.quad([A[j][0], ya, A[j][1]], [A[i][0], ya, A[i][1]], [B[i][0], yb, B[i][1]], [B[j][0], yb, B[j][1]], MAT.GLASS);
    m.quad([B[j][0], yb, B[j][1]], [B[i][0], yb, B[i][1]], [A[i][0], ya, A[i][1]], [A[j][0], ya, A[j][1]], MAT.DARK_TRIM);
  }
  // The seams between shards: a dark reveal up every corner.
  if (medium) {
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 8; i++) {
        const p0 = at(0)[i], p1 = at(closed)[i];
        m.pipe([p0[0], y0, p0[1]], [p1[0], topClosed, p1[1]], 0.35, MAT.METAL, 4);
      }
    });
    litCrown(m, at(closed), topClosed - 3, 1.5);
  }
  return m;
}

// ------------------------------------------------------ the zoned tower

/**
 * The high-density office on the old spire tower's slot. A rounded glass
 * shaft that narrows and turns a little, finished with a raked glass crown
 * and nothing spiked on it, over a glazed lobby. Any theme: this is the tower
 * a city grows when it has stopped building in its regional style.
 */
export function bladeTower(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const floors = storeysOf(T, 21);
  const lobbyH = Math.max(6, T.floorH * 1.8);
  const hx = 12.6, hz = 11.4;
  const n = fine ? 20 : medium ? 14 : 8;
  const body = plan(hx, hz, 0.7, n);
  const lob = scaled(body, 0.9);
  loft(m, lob, lob, 0.1, lobbyH, fine ? MAT.SHOPFRONT : MAT.GLASS);
  glassShaft(m, lod, {
    hx, hz, r: 5.0, floors, floorH: T.floorH, y0: lobbyH, taper: 0.8, twist: 0.25, rake: 9, mast: 0, bay: 3.0,
  });
  soffit(m, grow(body, 0.2), lobbyH, MAT.CONCRETE);
  if (fine) {
    entrance(m, { axis: 'z', sign: 1, plane: hz * 0.9 }, 0,
      { width: 4.4, height: Math.min(lobbyH - 0.8, 4.6), double: true, glazed: true, canopy: 3.4 });
    kerb(m, -hx - 1.0, hz + 1.2, hx + 1.0, hz + 2.0);
    void seed;
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
    key: 'meridian', name: 'One Meridian', foot: [11, 11], jobs: 3400, upkeep: 4300, power: 6400,
    colour: [0.78, 0.84, 0.92], accent: [0.30, 0.36, 0.46],
    note: 'Ninety storeys on a square whose corners are cut back all the way up: eight triangular glass faces, an octagon at the waist and the base square turned forty-five degrees at the roof, over a podium of stone fins.',
    build: oneMeridian,
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
    key: 'castellan', name: 'Castellan Towers', foot: [14, 10], jobs: 4200, upkeep: 5200, power: 7800,
    colour: [0.84, 0.84, 0.86], accent: [0.36, 0.36, 0.40],
    note: 'Twin towers on an eight-point star plan setting back in five tiers to stacked drums, joined a hundred and twenty metres up by a two-storey skybridge on raking legs, over a shared podium of shops.',
    build: castellanTowers,
  },
  {
    key: 'shard', name: 'Paragon Shard', foot: [11, 10], jobs: 2800, upkeep: 3600, power: 5400,
    colour: [0.80, 0.88, 0.94], accent: [0.30, 0.38, 0.46],
    note: 'Eight glass shards leaning in over three hundred metres, never quite meeting: at the top they part and stand open to the sky at eight different heights.',
    build: paragonShard,
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
