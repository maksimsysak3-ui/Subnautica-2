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
import type { ThemeProfile } from '../themes';
import { storeysOf } from '../themed-parts';
import { cap, forecourt, loft, plan, porteCochere, scaled } from './signature-parts';
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
 * Three wings round a hexagonal core in a Y, the plan that lets a tower go
 * higher than any other -- each wing buttresses the other two. The wings step
 * back one at a time, in turn, so the setbacks spiral up the tower, and the
 * core carries on alone above the last of them in three narrowing drums.
 */
export function arcadiaTower(lod: number): MeshBuilder {
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
export function helionTower(lod: number): MeshBuilder {
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
  // Each theme's tower is its own: how it narrows, which way and how far it
  // turns, and how it meets the sky -- a raked glass crown, a flat top behind
  // a louvred plant screen, or a setback storey block.
  const pick = (k: number): number => { const v = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
  const crown = Math.floor(pick(1) * 3);
  const taper = 0.72 + pick(2) * 0.18;
  const twist = (pick(3) - 0.5) * 0.9;
  const floors = storeysOf(T, 21);
  const lobbyH = Math.max(6, T.floorH * 1.8);
  const hx = 12.6, hz = 11.4;
  const n = fine ? 20 : medium ? 14 : 8;
  const body = plan(hx, hz, 0.7, n);
  const lob = scaled(body, 0.9);
  loft(m, lob, lob, 0.1, lobbyH, fine ? MAT.SHOPFRONT : MAT.GLASS);
  const main = crown === 2 ? Math.round(floors * 0.84) : floors;
  const rake = crown === 0 ? 7 + pick(4) * 4 : 0;
  glassShaft(m, lod, {
    hx, hz, r: 5.0, floors: main, floorH: T.floorH, y0: lobbyH, taper, twist, rake, mast: 0, bay: 3.0,
    lid: MAT.DARK_TRIM,
  });
  const top = lobbyH + main * T.floorH;
  // The plan at the top of the shaft, as the shaft draws it.
  const k = taper;
  const last = scaled(body, k, k, twist);
  if (crown === 1) {
    // Flat roof behind two storeys of louvres.
    plantFloor(m, last, top, T.floorH * 1.6);
  } else if (crown === 2) {
    // A setback block of the last few storeys, turned on with the shaft.
    const up = scaled(body, k * 0.72, k * 0.72, twist);
    const extra = floors - main;
    shaft(m, lod, () => up, top, top + extra * T.floorH, extra, 3.0);
    cap(m, last, top, MAT.ROOF);
    plantFloor(m, up, top + extra * T.floorH, T.floorH);
  }
  soffit(m, grow(body, 0.2), lobbyH, MAT.CONCRETE);
  if (fine) {
    entrance(m, { axis: 'z', sign: 1, plane: hz * 0.9 }, 0,
      { width: 4.4, height: Math.min(lobbyH - 0.8, 4.6), double: true, glazed: true, canopy: 3.4 });
    kerb(m, -hx - 1.0, hz + 1.2, hx + 1.0, hz + 2.0);
  }
  return m;
}
