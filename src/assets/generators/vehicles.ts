/**
 * Vehicles and figures.
 *
 * These are not buildings and they are not placed by the player: they are the
 * things that will sit on the roads and pavements once traffic and pedestrians
 * exist, and they live in the library so they can be reviewed at the same
 * fidelity as everything else.
 *
 * Two things make a car look like a car rather than a shoebox with wheels: the
 * body is lofted through cross-sections rather than assembled from boxes, so
 * the roofline, waist and shoulders actually curve; and the paint colour comes
 * from the part key (`MeshBuilder.keyed`) rather than the asset seed, so a car
 * park is many colours out of one material.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import type { Material, Vec3 } from '../mesh';

// ------------------------------------------------------------------ lofting

/**
 * One cross-section of a body, as (height, half-width) pairs from the sill up
 * over the shoulder to the roof. Every station in a loft shares a point count,
 * so the skin is a quad strip and the shape is entirely in the numbers.
 */
type Section = Array<[number, number]>;

interface Station { x: number; s: Section }

/**
 * Skins a run of stations: both flanks, the roof, the floor and the two ends.
 *
 * The flanks are quads between neighbouring section points, so a section with
 * a chamfer between the waist and the roof produces a real chamfered surface
 * with its own normal -- which is the whole reason for doing it this way
 * rather than stacking boxes, since a box roofline catches light in one flat
 * plane and reads as cardboard.
 */
function loft(m: MeshBuilder, st: Station[], mat: Material, opts: { ends?: boolean } = {}): void {
  const n = st[0].s.length;
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i], b = st[i + 1];
    for (let j = 0; j < n - 1; j++) {
      const [ay0, aw0] = a.s[j], [ay1, aw1] = a.s[j + 1];
      const [by0, bw0] = b.s[j], [by1, bw1] = b.s[j + 1];
      // +z flank, then -z with the winding reversed so both face outwards.
      m.quad([a.x, ay0, aw0], [b.x, by0, bw0], [b.x, by1, bw1], [a.x, ay1, aw1], mat);
      m.quad([a.x, ay1, -aw1], [b.x, by1, -bw1], [b.x, by0, -bw0], [a.x, ay0, -aw0], mat);
    }
    // Roof and floor: the strips that close the section top and bottom.
    const at = a.s[n - 1], bt = b.s[n - 1], ab = a.s[0], bb = b.s[0];
    m.quad([a.x, at[0], at[1]], [b.x, bt[0], bt[1]], [b.x, bt[0], -bt[1]], [a.x, at[0], -at[1]], mat);
    m.quad([a.x, ab[0], -ab[1]], [b.x, bb[0], -bb[1]], [b.x, bb[0], bb[1]], [a.x, ab[0], ab[1]], mat);
  }
  if (opts.ends === false) return;
  // End caps, as a fan from the section's mid-height.
  for (const [st0, dir] of [[st[0], -1], [st[st.length - 1], 1]] as const) {
    const mid = (st0.s[0][0] + st0.s[n - 1][0]) / 2;
    for (let j = 0; j < n - 1; j++) {
      const [y0, w0] = st0.s[j], [y1, w1] = st0.s[j + 1];
      const c: Vec3 = [st0.x, mid, 0];
      if (dir > 0) {
        m.tri([st0.x, y0, w0], [st0.x, y1, w1], c, mat);
        m.tri([st0.x, y1, -w1], [st0.x, y0, -w0], c, mat);
      } else {
        m.tri([st0.x, y1, w1], [st0.x, y0, w0], c, mat);
        m.tri([st0.x, y0, -w0], [st0.x, y1, -w1], c, mat);
      }
    }
  }
}

/** Scales a section's widths and shifts its heights: one profile, many bodies. */
function shape(s: Section, wScale: number, yTop: number): Section {
  const top = s[s.length - 1][0];
  const bot = s[0][0];
  return s.map(([y, w]) => [bot + ((y - bot) / (top - bot)) * (yTop - bot), w * wScale] as [number, number]);
}

// ------------------------------------------------------------------- wheels

/**
 * A road wheel, spinning about Z.
 *
 * MeshBuilder's cylinder is Y-axis only, and a wheel lying on its side is the
 * one thing in the whole library that needs another axis, so it is built here.
 * Tyre, sidewall, dished rim and five spokes -- the spokes are what stop a
 * wheel reading as a black disc at any distance you would actually see it.
 */
function wheel(m: MeshBuilder, cx: number, cy: number, cz: number, r: number, halfW: number,
  seg = 14): void {
  const inner = r * 0.62;
  const dish = halfW * 0.45;
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const p = (a: number, rr: number, w: number): Vec3 =>
        [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, cz + w];
      // Tread, then the two sidewalls in to the rim.
      m.quad(p(a0, r, halfW), p(a1, r, halfW), p(a1, r, -halfW), p(a0, r, -halfW), MAT.TRIM);
      m.quad(p(a1, r, halfW), p(a0, r, halfW), p(a0, inner, dish), p(a1, inner, dish), MAT.TRIM);
      m.quad(p(a0, r, -halfW), p(a1, r, -halfW), p(a1, inner, -dish), p(a0, inner, -dish), MAT.TRIM);
    }
  });
  // Rim: a dished disc with a hub and spokes, in bright metal.
  for (const sw of [1, -1] as const) {
    const w = sw * dish;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const p = (a: number, rr: number): Vec3 =>
        [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, cz + w];
      const hub: Vec3 = [cx, cy, cz + w * 1.05];
      if (sw > 0) m.tri(p(a0, inner * 0.34), p(a1, inner * 0.34), hub, MAT.METAL);
      else m.tri(p(a1, inner * 0.34), p(a0, inner * 0.34), hub, MAT.METAL);
    }
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.3;
      const ca = Math.cos(a), sa = Math.sin(a);
      const na = -sa, nb = ca;
      const t = inner * 0.11;
      const q = (rr: number, sgn: number): Vec3 =>
        [cx + ca * rr + na * t * sgn, cy + sa * rr + nb * t * sgn, cz + w * 1.02];
      if (sw > 0) m.quad(q(inner * 0.3, 1), q(inner * 0.96, 1), q(inner * 0.96, -1), q(inner * 0.3, -1), MAT.METAL);
      else m.quad(q(inner * 0.3, -1), q(inner * 0.96, -1), q(inner * 0.96, 1), q(inner * 0.3, 1), MAT.METAL);
    }
  }
}

/** The dark shadow of an arch, so a wheel does not float in a flat flank. */
function arch(m: MeshBuilder, cx: number, cy: number, r: number, halfW: number): void {
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i < 9; i++) {
      const a0 = Math.PI * (i / 9), a1 = Math.PI * ((i + 1) / 9);
      const q = (a: number, w: number): Vec3 =>
        [cx + Math.cos(a) * r, cy + Math.sin(a) * r, w];
      m.quad(q(a0, halfW), q(a1, halfW), q(a1, -halfW), q(a0, -halfW), MAT.TRIM);
    }
  });
}

// ------------------------------------------------------------------ fittings

/** Glazing set into a body: windscreen, backlight and side windows. */
function glazing(m: MeshBuilder, x0: number, x1: number, y0: number, y1: number,
  hw: number, rake = 0.0): void {
  for (const sz of [1, -1] as const) {
    const w = sz * (hw + 0.012);
    m.quad([x0 + rake, y0, w], [x1 - rake, y0, w], [x1, y1, w], [x0, y1, w], MAT.GLASS);
  }
}

/** A lamp: a lens on a chrome bezel, sunk into the bodywork. */
function lamp(m: MeshBuilder, x: number, y: number, z: number, w: number, h: number,
  dir: 1 | -1, tint: number): void {
  m.painted(TINT.METAL_DARK, () =>
    m.box([x - dir * 0.06, y - h / 2 - 0.03, z - w / 2 - 0.03],
          [x + dir * 0.02, y + h / 2 + 0.03, z + w / 2 + 0.03], MAT.TRIM, { skipBottom: false }));
  m.painted(tint as never, () =>
    m.box([Math.min(x, x + dir * 0.05), y - h / 2, z - w / 2],
          [Math.max(x, x + dir * 0.05), y + h / 2, z + w / 2], MAT.TRIM, { skipBottom: false }));
}

/** Door shut lines and handles: the detail that gives a flank its scale. */
function doors(m: MeshBuilder, cuts: number[], y0: number, y1: number, hw: number,
  handleY: number): void {
  m.painted(TINT.METAL_DARK, () => {
    for (const cx of cuts) {
      for (const sz of [1, -1] as const) {
        m.box([cx - 0.015, y0, Math.min(sz * hw, sz * (hw + 0.012))],
              [cx + 0.015, y1, Math.max(sz * hw, sz * (hw + 0.012))], MAT.TRIM,
          { skipBottom: false });
      }
    }
  });
  for (let i = 0; i < cuts.length; i++) {
    for (const sz of [1, -1] as const) {
      const x = cuts[i] + 0.16;
      m.box([x, handleY, Math.min(sz * hw, sz * (hw + 0.04))],
            [x + 0.22, handleY + 0.055, Math.max(sz * hw, sz * (hw + 0.04))], MAT.METAL,
        { skipBottom: false });
    }
  }
}

/** Wing mirrors on stalks. */
function mirrors(m: MeshBuilder, x: number, y: number, hw: number): void {
  for (const sz of [1, -1] as const) {
    m.painted(TINT.METAL_DARK, () =>
      m.box([x - 0.03, y - 0.03, Math.min(sz * hw, sz * (hw + 0.1))],
            [x + 0.03, y + 0.03, Math.max(sz * hw, sz * (hw + 0.1))], MAT.TRIM, { skipBottom: false }));
    m.box([x - 0.1, y - 0.06, Math.min(sz * (hw + 0.08), sz * (hw + 0.22))],
          [x + 0.1, y + 0.13, Math.max(sz * (hw + 0.08), sz * (hw + 0.22))], MAT.PAINT,
      { skipBottom: false });
  }
}

/** Number plate. */
function plate(m: MeshBuilder, x: number, y: number, dir: 1 | -1): void {
  m.painted(TINT.SIGN_LIT, () =>
    m.box([Math.min(x, x + dir * 0.03), y - 0.09, -0.26],
          [Math.max(x, x + dir * 0.03), y + 0.09, 0.26], MAT.TRIM, { skipBottom: false }));
}

/** The ground a vehicle stands on, so it is not floating over a void. */
function tarmac(m: MeshBuilder, x: number, z: number): void {
  m.box([-x, 0.0005, -z], [x, 0.04, z], MAT.GROUND);
  m.painted(TINT.SIGN_LIT, () => {
    for (const sz of [-1, 1] as const) {
      m.box([-x + 0.6, 0.04, sz * (z - 0.5) - 0.06], [x - 0.6, 0.055, sz * (z - 0.5) + 0.06], MAT.TRIM);
    }
  });
}

// -------------------------------------------------------------------- people
//
// Figures are built from a dozen boxes and two half-cylinders. They are seen
// at three or four pixels tall in play and at arm's length in this viewer, so
// they need a silhouette that survives both: shoulders wider than the head,
// legs apart, arms clear of the body.

/**
 * One person, standing or walking, facing along +x.
 *
 * `key` picks the clothing colours: the coat, the legs and the head each take
 * their own key so a crowd is not a row of people in matching outfits.
 */
function person(m: MeshBuilder, key: number, cx: number, cz: number, facing: number,
  opts: { stride?: number; bag?: boolean; hat?: boolean; scale?: number; lift?: number } = {}): void {
  const s = opts.scale ?? 1.0;
  const lift = opts.lift ?? 0;
  const stride = opts.stride ?? 0;
  const co = Math.cos(facing), si = Math.sin(facing);
  // Everything is placed in the figure's own frame and rotated on the way out,
  // so a walking pose does not have to be re-derived per direction.
  const at = (fx: number, fy: number, fz: number): Vec3 =>
    [cx + (fx * co - fz * si) * s, lift + fy * s, cz + (fx * si + fz * co) * s];
  const boxAt = (f0: [number, number, number], f1: [number, number, number], mat: Material): void => {
    const a = at(f0[0], f0[1], f0[2]);
    const b = at(f1[0], f1[1], f1[2]);
    m.box([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
          [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])], mat,
      { skipBottom: false });
  };

  // Legs: offset fore and aft by the stride, which is what makes a figure walk.
  m.keyed(key * 3 + 1, () => {
    for (const [sz, sgn] of [[1, 1], [-1, -1]] as const) {
      const off = stride * sgn;
      boxAt([-0.07 + off, 0.0, sz * 0.11 - 0.055], [0.07 + off, 0.86, sz * 0.11 + 0.055], MAT.FIGURE);
      // Shoe.
      boxAt([-0.09 + off * 1.25, 0.0, sz * 0.11 - 0.06], [0.13 + off * 1.25, 0.09, sz * 0.11 + 0.06],
        MAT.TRIM);
    }
  });
  // Torso: a coat that flares slightly at the shoulders.
  m.keyed(key * 3 + 2, () => {
    boxAt([-0.1, 0.82, -0.19], [0.1, 1.36, 0.19], MAT.FIGURE);
    boxAt([-0.115, 1.14, -0.215], [0.115, 1.42, 0.215], MAT.FIGURE);
    // Arms, swinging opposite the legs.
    for (const [sz, sgn] of [[1, -1], [-1, 1]] as const) {
      const off = stride * sgn * 0.8;
      boxAt([-0.055 + off, 0.94, sz * 0.235 - 0.055], [0.055 + off, 1.4, sz * 0.235 + 0.055],
        MAT.FIGURE);
    }
  });
  // Head and neck.
  m.keyed(key * 3, () => {
    boxAt([-0.05, 1.4, -0.055], [0.05, 1.48, 0.055], MAT.FIGURE);
    boxAt([-0.085, 1.46, -0.095], [0.085, 1.66, 0.095], MAT.FIGURE);
  });
  if (opts.hat) {
    m.painted(TINT.METAL_DARK, () => {
      boxAt([-0.115, 1.64, -0.12], [0.115, 1.68, 0.12], MAT.TRIM);
      boxAt([-0.085, 1.66, -0.095], [0.085, 1.74, 0.095], MAT.TRIM);
    });
  }
  if (opts.bag) {
    m.keyed(key * 3 + 7, () =>
      boxAt([-0.07, 0.86, 0.2], [0.09, 1.16, 0.32], MAT.FIGURE));
  }
}

// ------------------------------------------------------------------ the cars
//
// Each car is one loft plus its fittings. The station tables are where the
// character is: a hatchback's roof runs level to a stub tail, a saloon's steps
// down to a boot, a coupe's falls from the B-pillar to the rear bumper.

/** The generic road-car section: sill, waist, shoulder, roof edge, roof. */
const CAR: Section = [[0.30, 0.72], [0.62, 0.88], [1.00, 0.90], [1.24, 0.82], [1.42, 0.62]];
/** A van or bus section: near-vertical sides and a slightly domed roof. */
const BOX: Section = [[0.34, 0.90], [0.70, 1.10], [1.60, 1.16], [2.40, 1.14], [2.62, 0.92]];

function hatchback(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  tarmac(m, 3.0, 1.9);

  m.keyed(1, () => {
    loft(m, [
      { x: -2.02, s: shape(CAR, 0.80, 0.98) },
      { x: -1.80, s: shape(CAR, 0.94, 1.06) },
      { x: -1.20, s: shape(CAR, 1.00, 1.18) },
      { x: -0.55, s: shape(CAR, 1.02, 1.46) },
      { x: 0.30, s: shape(CAR, 1.02, 1.50) },
      { x: 1.05, s: shape(CAR, 1.00, 1.50) },
      { x: 1.62, s: shape(CAR, 0.96, 1.44) },
      { x: 1.92, s: shape(CAR, 0.86, 1.22) },
      { x: 2.05, s: shape(CAR, 0.74, 1.06) },
    ], MAT.PAINT);
  });

  if (medium) {
    for (const cx of [-1.28, 1.32]) {
      arch(m, cx, 0.44, 0.46, 0.80);
      for (const sz of [1, -1] as const) wheel(m, cx, 0.34, sz * 0.72, 0.33, 0.12);
    }
    // Windscreen and backlight are raked; the side glass sits in the waist.
    glazing(m, -0.62, 0.28, 1.06, 1.44, 0.845, 0.22);
    glazing(m, 1.02, 1.66, 1.06, 1.42, 0.845, -0.18);
  }
  if (fine) {
    m.painted(TINT.METAL_DARK, () => {
      m.box([-0.60, 0.98, -0.82], [1.68, 1.10, 0.82], MAT.TRIM);
      m.box([-2.04, 0.44, -0.76], [-1.86, 0.72, 0.76], MAT.TRIM);
      m.box([1.94, 0.44, -0.72], [2.08, 0.74, 0.72], MAT.TRIM);
    });
    doors(m, [-0.52, 0.62], 0.62, 1.24, 0.90, 1.02);
    mirrors(m, -0.52, 1.16, 0.90);
    for (const sz of [1, -1] as const) {
      lamp(m, -2.0, 0.88, sz * 0.56, 0.34, 0.22, -1, TINT.SIGN_LIT);
      lamp(m, 2.04, 0.98, sz * 0.58, 0.30, 0.30, 1, TINT.BRAND);
    }
    plate(m, -2.02, 0.62, -1);
    plate(m, 2.04, 0.66, 1);
    // Roof rails and a tailpipe.
    m.painted(TINT.METAL_DARK, () => {
      for (const sz of [1, -1] as const) {
        m.box([-0.1, 1.50, sz * 0.44 - 0.04], [1.3, 1.56, sz * 0.44 + 0.04], MAT.TRIM);
      }
      m.box([1.7, 0.28, 0.34], [2.06, 0.4, 0.5], MAT.TRIM);
    });
    person(m, 21, 2.9, 1.1, Math.PI, { stride: 0.1 });
  }
  return m;
}

function saloon(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  tarmac(m, 3.3, 1.9);

  m.keyed(2, () => {
    loft(m, [
      { x: -2.35, s: shape(CAR, 0.80, 0.96) },
      { x: -2.10, s: shape(CAR, 0.95, 1.04) },
      { x: -1.45, s: shape(CAR, 1.02, 1.14) },
      { x: -0.75, s: shape(CAR, 1.05, 1.44) },
      { x: 0.10, s: shape(CAR, 1.05, 1.48) },
      { x: 0.95, s: shape(CAR, 1.03, 1.46) },
      { x: 1.50, s: shape(CAR, 1.00, 1.22) },
      { x: 2.15, s: shape(CAR, 0.94, 1.14) },
      { x: 2.38, s: shape(CAR, 0.80, 1.02) },
    ], MAT.PAINT);
  });

  if (medium) {
    for (const cx of [-1.52, 1.58]) {
      arch(m, cx, 0.46, 0.48, 0.84);
      for (const sz of [1, -1] as const) wheel(m, cx, 0.35, sz * 0.75, 0.34, 0.13);
    }
    glazing(m, -0.85, 0.06, 1.06, 1.42, 0.87, 0.24);
    glazing(m, 0.90, 1.56, 1.06, 1.40, 0.87, -0.22);
  }
  if (fine) {
    m.painted(TINT.METAL_DARK, () => {
      m.box([-0.86, 0.98, -0.86], [1.58, 1.10, 0.86], MAT.TRIM);
      m.box([-2.38, 0.42, -0.78], [-2.18, 0.74, 0.78], MAT.TRIM);
      m.box([2.24, 0.42, -0.74], [2.42, 0.76, 0.74], MAT.TRIM);
      // Radiator grille: horizontal bars, which is most of a car's face.
      for (let i = 0; i < 4; i++) {
        m.box([-2.36, 0.80 + i * 0.075, -0.42], [-2.24, 0.83 + i * 0.075, 0.42], MAT.TRIM);
      }
    });
    doors(m, [-0.76, 0.42], 0.62, 1.24, 0.94, 1.02);
    mirrors(m, -0.78, 1.16, 0.94);
    for (const sz of [1, -1] as const) {
      lamp(m, -2.33, 0.92, sz * 0.6, 0.36, 0.2, -1, TINT.SIGN_LIT);
      lamp(m, 2.37, 0.96, sz * 0.62, 0.34, 0.24, 1, TINT.BRAND);
    }
    plate(m, -2.35, 0.64, -1);
    plate(m, 2.37, 0.68, 1);
    m.painted(TINT.METAL_DARK, () => {
      m.box([2.0, 0.28, 0.36], [2.4, 0.4, 0.54], MAT.TRIM);
      m.box([2.0, 0.28, -0.54], [2.4, 0.4, -0.36], MAT.TRIM);
    });
    person(m, 33, 3.2, -1.2, 0, { stride: 0.12, bag: true });
  }
  return m;
}

function estate(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  tarmac(m, 3.3, 1.9);

  m.keyed(3, () => {
    loft(m, [
      { x: -2.35, s: shape(CAR, 0.80, 0.96) },
      { x: -2.10, s: shape(CAR, 0.95, 1.04) },
      { x: -1.45, s: shape(CAR, 1.02, 1.14) },
      { x: -0.75, s: shape(CAR, 1.05, 1.46) },
      { x: 0.20, s: shape(CAR, 1.05, 1.52) },
      { x: 1.30, s: shape(CAR, 1.04, 1.52) },
      { x: 2.05, s: shape(CAR, 1.02, 1.50) },
      { x: 2.36, s: shape(CAR, 0.92, 1.34) },
    ], MAT.PAINT);
  });

  if (medium) {
    for (const cx of [-1.52, 1.58]) {
      arch(m, cx, 0.46, 0.48, 0.86);
      for (const sz of [1, -1] as const) wheel(m, cx, 0.35, sz * 0.76, 0.34, 0.13);
    }
    glazing(m, -0.85, 0.10, 1.06, 1.46, 0.87, 0.24);
    glazing(m, 2.10, 2.34, 1.10, 1.44, 0.87, 0.06);
  }
  if (fine) {
    m.painted(TINT.METAL_DARK, () => {
      m.box([-0.86, 0.98, -0.88], [2.10, 1.10, 0.88], MAT.TRIM);
      m.box([-2.38, 0.42, -0.78], [-2.18, 0.74, 0.78], MAT.TRIM);
      m.box([2.26, 0.42, -0.80], [2.42, 0.78, 0.80], MAT.TRIM);
      // Roof bars with cross rails, and a towbar: what an estate is for.
      for (const sz of [1, -1] as const) {
        m.box([-0.3, 1.52, sz * 0.5 - 0.05], [2.0, 1.60, sz * 0.5 + 0.05], MAT.TRIM);
      }
      for (const cx of [0.1, 1.6]) m.box([cx, 1.58, -0.55], [cx + 0.09, 1.63, 0.55], MAT.TRIM);
      m.box([2.36, 0.24, -0.08], [2.62, 0.34, 0.08], MAT.TRIM);
      m.cylinder(2.6, 0, 0.09, 0.32, 0.46, 8, MAT.TRIM);
    });
    doors(m, [-0.76, 0.42, 1.66], 0.62, 1.26, 0.96, 1.04);
    mirrors(m, -0.78, 1.16, 0.96);
    for (const sz of [1, -1] as const) {
      lamp(m, -2.33, 0.92, sz * 0.6, 0.36, 0.2, -1, TINT.SIGN_LIT);
      lamp(m, 2.37, 1.06, sz * 0.66, 0.24, 0.46, 1, TINT.BRAND);
    }
    plate(m, -2.35, 0.64, -1);
    plate(m, 2.37, 0.62, 1);
    person(m, 44, 3.15, 1.2, Math.PI * 0.9, { stride: 0.05, hat: true });
  }
  return m;
}

function suv(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  tarmac(m, 3.3, 2.1);
  const S: Section = [[0.50, 0.80], [0.86, 1.00], [1.28, 1.02], [1.60, 0.94], [1.82, 0.72]];

  m.keyed(4, () => {
    loft(m, [
      { x: -2.30, s: shape(S, 0.86, 1.30) },
      { x: -2.05, s: shape(S, 0.97, 1.40) },
      { x: -1.35, s: shape(S, 1.02, 1.52) },
      { x: -0.70, s: shape(S, 1.04, 1.88) },
      { x: 0.40, s: shape(S, 1.04, 1.94) },
      { x: 1.45, s: shape(S, 1.03, 1.94) },
      { x: 2.10, s: shape(S, 1.00, 1.90) },
      { x: 2.34, s: shape(S, 0.90, 1.72) },
    ], MAT.PAINT);
  });

  if (medium) {
    for (const cx of [-1.50, 1.55]) {
      arch(m, cx, 0.62, 0.60, 0.90);
      for (const sz of [1, -1] as const) wheel(m, cx, 0.47, sz * 0.80, 0.46, 0.16);
    }
    glazing(m, -0.82, 0.16, 1.30, 1.86, 0.985, 0.26);
    glazing(m, 2.12, 2.32, 1.34, 1.84, 0.985, 0.04);
    // Cladding round the arches and along the sills: an SUV's whole idiom.
    m.painted(TINT.METAL_DARK, () => {
      for (const sz of [1, -1] as const) {
        m.box([-1.95, 0.52, sz * 1.02 - 0.06], [2.2, 0.76, sz * 1.02 + 0.06], MAT.TRIM);
      }
    });
  }
  if (fine) {
    m.painted(TINT.METAL_DARK, () => {
      m.box([-2.34, 0.56, -0.92], [-2.06, 0.98, 0.92], MAT.TRIM);
      m.box([2.20, 0.56, -0.90], [2.42, 1.02, 0.90], MAT.TRIM);
      for (let i = 0; i < 3; i++) {
        m.box([-2.32, 1.06 + i * 0.1, -0.48], [-2.18, 1.11 + i * 0.1, 0.48], MAT.TRIM);
      }
      // Roof rails and a spare on the tailgate.
      for (const sz of [1, -1] as const) {
        m.box([-0.4, 1.92, sz * 0.56 - 0.06], [2.0, 2.00, sz * 0.56 + 0.06], MAT.TRIM);
      }
    });
    wheel(m, 2.55, 1.20, 0.0, 0.42, 0.15, 12);
    doors(m, [-0.72, 0.60], 0.86, 1.58, 1.06, 1.30);
    mirrors(m, -0.74, 1.44, 1.06);
    for (const sz of [1, -1] as const) {
      lamp(m, -2.30, 1.22, sz * 0.66, 0.4, 0.26, -1, TINT.SIGN_LIT);
      lamp(m, 2.36, 1.36, sz * 0.72, 0.26, 0.5, 1, TINT.BRAND);
    }
    plate(m, -2.32, 0.82, -1);
    plate(m, 2.38, 0.86, 1);
    person(m, 55, 3.1, -1.4, 0.4, { stride: 0.0 });
  }
  return m;
}

function pickup(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  tarmac(m, 3.5, 2.0);
  const S: Section = [[0.48, 0.82], [0.84, 1.00], [1.26, 1.02], [1.56, 0.94], [1.76, 0.74]];

  // Cab, then a separate bed: a pickup is two volumes and the gap shows.
  m.keyed(5, () => {
    loft(m, [
      { x: -2.40, s: shape(S, 0.86, 1.24) },
      { x: -2.15, s: shape(S, 0.98, 1.34) },
      { x: -1.40, s: shape(S, 1.02, 1.44) },
      { x: -0.75, s: shape(S, 1.03, 1.82) },
      { x: 0.15, s: shape(S, 1.03, 1.86) },
      { x: 0.55, s: shape(S, 1.02, 1.84) },
    ], MAT.PAINT);
    loft(m, [
      { x: 0.58, s: shape(S, 1.03, 1.30) },
      { x: 2.55, s: shape(S, 1.03, 1.30) },
    ], MAT.PAINT);
  });

  if (medium) {
    for (const cx of [-1.55, 1.75]) {
      arch(m, cx, 0.60, 0.58, 0.92);
      for (const sz of [1, -1] as const) wheel(m, cx, 0.45, sz * 0.82, 0.44, 0.16);
    }
    glazing(m, -0.88, 0.05, 1.28, 1.80, 0.975, 0.26);
    glazing(m, 0.42, 0.54, 1.30, 1.78, 0.975, 0.02);
    // The bed itself: a floor with four walls, open at the top.
    m.painted(TINT.METAL_DARK, () =>
      m.box([0.62, 1.02, -0.78], [2.5, 1.12, 0.78], MAT.TRIM));
  }
  if (fine) {
    m.painted(TINT.METAL_DARK, () => {
      m.box([-2.44, 0.54, -0.94], [-2.14, 0.96, 0.94], MAT.TRIM);
      m.box([2.5, 0.5, -0.9], [2.72, 0.98, 0.9], MAT.TRIM);
      for (let i = 0; i < 3; i++) {
        m.box([-2.42, 1.02 + i * 0.11, -0.5], [-2.28, 1.08 + i * 0.11, 0.5], MAT.TRIM);
      }
      // Ribs down the inside of the bed walls, and a roll bar behind the cab.
      for (let i = 0; i < 5; i++) {
        const px = 0.8 + i * 0.42;
        m.box([px - 0.04, 1.12, -0.72], [px + 0.04, 1.30, 0.72], MAT.TRIM);
      }
      for (const sz of [1, -1] as const) {
        m.box([0.60, 1.30, sz * 0.62 - 0.05], [0.70, 2.05, sz * 0.62 + 0.05], MAT.TRIM);
      }
      m.box([0.58, 2.00, -0.68], [0.72, 2.08, 0.68], MAT.TRIM);
    });
    doors(m, [-0.80], 0.84, 1.54, 1.06, 1.26);
    mirrors(m, -0.82, 1.42, 1.06);
    for (const sz of [1, -1] as const) {
      lamp(m, -2.40, 1.20, sz * 0.68, 0.4, 0.26, -1, TINT.SIGN_LIT);
      lamp(m, 2.68, 1.20, sz * 0.66, 0.22, 0.4, 1, TINT.BRAND);
    }
    plate(m, -2.42, 0.78, -1);
    // Load in the bed, so the tray is not an empty tank.
    m.painted(TINT.WOOD, () => {
      for (let i = 0; i < 3; i++) {
        m.box([0.9 + i * 0.5, 1.12, -0.6], [1.3 + i * 0.5, 1.5, 0.2], MAT.TRIM);
      }
    });
    person(m, 66, 3.3, 1.3, Math.PI, { stride: 0.14, hat: true });
  }
  return m;
}

function van(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  tarmac(m, 3.6, 2.1);

  m.keyed(6, () => {
    loft(m, [
      { x: -2.55, s: shape(BOX, 0.72, 1.30) },
      { x: -2.30, s: shape(BOX, 0.86, 1.52) },
      { x: -1.75, s: shape(BOX, 0.96, 1.86) },
      { x: -1.05, s: shape(BOX, 1.00, 2.42) },
      { x: -0.30, s: shape(BOX, 1.00, 2.56) },
      { x: 2.30, s: shape(BOX, 1.00, 2.58) },
      { x: 2.62, s: shape(BOX, 0.96, 2.52) },
    ], MAT.PAINT);
  });

  if (medium) {
    for (const cx of [-1.70, 1.85]) {
      arch(m, cx, 0.52, 0.52, 0.98);
      for (const sz of [1, -1] as const) wheel(m, cx, 0.40, sz * 0.86, 0.39, 0.15);
    }
    glazing(m, -1.15, -0.34, 1.70, 2.42, 1.10, 0.3);
    glazing(m, -0.28, 0.42, 1.72, 2.34, 1.15, 0.0);
    // Rear doors: two leaves with a shut line and windows in the top half.
    m.painted(TINT.METAL_DARK, () => m.box([2.6, 0.7, -0.02], [2.66, 2.5, 0.02], MAT.TRIM));
    glazing(m, 2.62, 2.64, 1.90, 2.30, 0.66, 0.0);
  }
  if (fine) {
    m.painted(TINT.METAL_DARK, () => {
      m.box([-2.58, 0.60, -1.00], [-2.28, 1.12, 1.00], MAT.TRIM);
      m.box([2.5, 0.58, -0.96], [2.7, 1.10, 0.96], MAT.TRIM);
      // Body swage lines: a van flank is three metres of nothing without them.
      for (const sz of [1, -1] as const) {
        for (const y of [1.34, 1.62]) {
          m.box([-1.1, y, sz * 1.16 - 0.03], [2.5, y + 0.07, sz * 1.16 + 0.03], MAT.TRIM);
        }
      }
      m.box([-1.0, 2.60, -1.0], [1.2, 2.72, 1.0], MAT.TRIM);
    });
    doors(m, [-0.32], 0.74, 2.34, 1.18, 1.44);
    mirrors(m, -1.18, 2.0, 1.16);
    for (const sz of [1, -1] as const) {
      lamp(m, -2.55, 1.34, sz * 0.72, 0.44, 0.36, -1, TINT.SIGN_LIT);
      lamp(m, 2.66, 1.34, sz * 0.74, 0.26, 0.5, 1, TINT.BRAND);
    }
    plate(m, -2.57, 0.86, -1);
    // A sign panel on the flank: a van is somebody's advertising.
    m.painted(TINT.BRAND, () => {
      for (const sz of [1, -1] as const) {
        m.box([-0.7, 1.76, Math.min(sz * 1.16, sz * 1.19)], [2.0, 2.30, Math.max(sz * 1.16, sz * 1.19)],
          MAT.TRIM);
      }
    });
    person(m, 77, 3.4, -1.4, 0.2, { stride: 0.12, bag: true });
  }
  return m;
}

function cityBus(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  tarmac(m, 7.0, 2.2);
  const S: Section = [[0.42, 0.98], [0.74, 1.22], [2.30, 1.26], [3.00, 1.22], [3.18, 0.98]];

  m.keyed(7, () => {
    loft(m, [
      { x: -6.10, s: shape(S, 0.92, 2.90) },
      { x: -5.85, s: shape(S, 0.99, 3.05) },
      { x: -5.30, s: shape(S, 1.00, 3.14) },
      { x: 5.30, s: shape(S, 1.00, 3.16) },
      { x: 5.85, s: shape(S, 0.99, 3.08) },
      { x: 6.10, s: shape(S, 0.92, 2.92) },
    ], MAT.PAINT);
  });

  if (medium) {
    for (const cx of [-4.20, 3.60, 4.85]) {
      arch(m, cx, 0.56, 0.58, 1.10);
      for (const sz of [1, -1] as const) wheel(m, cx, 0.48, sz * 0.98, 0.47, 0.17);
    }
    // The window band, which is what makes a bus a bus at any distance.
    glazing(m, -6.05, -5.4, 1.30, 2.72, 1.235, 0.3);
    for (const sz of [1, -1] as const) {
      for (let i = 0; i < 7; i++) {
        const x0 = -5.0 + i * 1.5;
        m.quad([x0, 1.28, sz * 1.27], [x0 + 1.34, 1.28, sz * 1.27],
               [x0 + 1.34, 2.5, sz * 1.27], [x0, 2.5, sz * 1.27], MAT.GLASS);
      }
    }
    glazing(m, 5.4, 6.05, 1.30, 2.5, 1.235, -0.3);
  }
  if (fine) {
    m.painted(TINT.METAL_DARK, () => {
      // Pillars between the windows, and the skirt below them.
      for (const sz of [1, -1] as const) {
        for (let i = 0; i <= 7; i++) {
          const px = -5.0 + i * 1.5;
          m.box([px - 0.09, 1.24, sz * 1.28 - 0.03], [px + 0.09, 2.54, sz * 1.28 + 0.03], MAT.TRIM);
        }
        m.box([-5.2, 1.16, sz * 1.28 - 0.04], [5.2, 1.28, sz * 1.28 + 0.04], MAT.TRIM);
        m.box([-5.2, 2.52, sz * 1.28 - 0.04], [5.2, 2.64, sz * 1.28 + 0.04], MAT.TRIM);
      }
      m.box([-6.14, 0.68, -1.16], [-5.6, 1.30, 1.16], MAT.TRIM);
      m.box([5.7, 0.68, -1.14], [6.16, 1.30, 1.14], MAT.TRIM);
      // Roof: hatches and the air-conditioning pod.
      m.box([-2.0, 3.16, -0.9], [1.4, 3.44, 0.9], MAT.TRIM);
      for (const cx of [-4.0, 3.0]) m.box([cx, 3.14, -0.5], [cx + 0.9, 3.24, 0.5], MAT.TRIM);
    });
    // Two sets of doors, glazed, with a step and a grab pole inside.
    for (const cx of [-3.4, 1.9]) {
      m.painted(TINT.METAL_DARK, () =>
        m.box([cx - 0.06, 0.74, 1.24], [cx + 1.36, 2.62, 1.30], MAT.TRIM));
      m.quad([cx + 0.03, 0.80, 1.31], [cx + 1.27, 0.80, 1.31],
             [cx + 1.27, 2.56, 1.31], [cx + 0.03, 2.56, 1.31], MAT.GLASS);
      m.painted(TINT.METAL_DARK, () =>
        m.box([cx + 0.63, 0.74, 1.26], [cx + 0.71, 2.62, 1.32], MAT.TRIM));
    }
    // Destination blind over the windscreen.
    m.painted(TINT.SIGN_LIT, () =>
      m.box([-6.12, 2.72, -0.9], [-5.9, 3.02, 0.9], MAT.TRIM));
    for (const sz of [1, -1] as const) {
      lamp(m, -6.10, 1.02, sz * 0.86, 0.5, 0.34, -1, TINT.SIGN_LIT);
      lamp(m, 6.14, 1.02, sz * 0.86, 0.5, 0.34, 1, TINT.BRAND);
    }
    plate(m, -6.12, 0.68, -1);
    mirrors(m, -5.9, 2.5, 1.24);
    // A queue at the door, which is what the doors are for.
    person(m, 81, -2.6, 1.9, -Math.PI / 2, { bag: true });
    person(m, 82, -3.3, 2.0, -Math.PI / 2, { stride: 0.08 });
    person(m, 83, -4.0, 1.95, -Math.PI / 2, { hat: true });
  }
  return m;
}

function taxi(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  tarmac(m, 3.3, 1.9);
  // A tall, upright cab body: short bonnet, high roof, boxy tail.
  const S: Section = [[0.36, 0.78], [0.68, 0.94], [1.16, 0.96], [1.52, 0.88], [1.72, 0.66]];

  m.keyed(8, () => {
    loft(m, [
      { x: -2.10, s: shape(S, 0.82, 1.00) },
      { x: -1.90, s: shape(S, 0.95, 1.08) },
      { x: -1.45, s: shape(S, 1.00, 1.18) },
      { x: -1.05, s: shape(S, 1.02, 1.72) },
      { x: 0.40, s: shape(S, 1.02, 1.86) },
      { x: 1.55, s: shape(S, 1.01, 1.84) },
      { x: 2.00, s: shape(S, 0.98, 1.60) },
      { x: 2.18, s: shape(S, 0.88, 1.30) },
    ], MAT.PAINT);
  });

  if (medium) {
    for (const cx of [-1.35, 1.45]) {
      arch(m, cx, 0.46, 0.50, 0.86);
      for (const sz of [1, -1] as const) wheel(m, cx, 0.36, sz * 0.78, 0.35, 0.13);
    }
    glazing(m, -1.15, -0.2, 1.20, 1.80, 0.905, 0.24);
    glazing(m, 1.6, 1.98, 1.24, 1.72, 0.905, -0.1);
    for (const sz of [1, -1] as const) {
      m.quad([-0.1, 1.22, sz * 0.905], [1.5, 1.22, sz * 0.905],
             [1.5, 1.74, sz * 0.905], [-0.1, 1.74, sz * 0.905], MAT.GLASS);
    }
  }
  if (fine) {
    // The livery: a chequered band along the waist, in the accent colour.
    m.painted(TINT.ACCENT, () => {
      for (const sz of [1, -1] as const) {
        for (let i = 0; i < 11; i++) {
          const px = -1.2 + i * 0.28;
          m.box([px, 0.86 + (i % 2) * 0.14, Math.min(sz * 0.96, sz * 0.99)],
                [px + 0.28, 1.00 + (i % 2) * 0.14, Math.max(sz * 0.96, sz * 0.99)], MAT.TRIM);
        }
      }
    });
    // Roof sign: the one thing that says taxi from behind.
    m.painted(TINT.SIGN_LIT, () => m.box([-0.35, 1.86, -0.36], [0.45, 2.06, 0.36], MAT.TRIM));
    m.painted(TINT.METAL_DARK, () => {
      m.box([-0.4, 1.80, -0.4], [0.5, 1.88, 0.4], MAT.TRIM);
      m.box([-2.14, 0.50, -0.84], [-1.94, 0.86, 0.84], MAT.TRIM);
      m.box([2.06, 0.50, -0.80], [2.24, 0.88, 0.80], MAT.TRIM);
      for (let i = 0; i < 3; i++) {
        m.box([-2.12, 0.92 + i * 0.09, -0.44], [-2.00, 0.96 + i * 0.09, 0.44], MAT.TRIM);
      }
    });
    doors(m, [-0.12, 1.02], 0.68, 1.50, 1.00, 1.10);
    mirrors(m, -1.1, 1.36, 1.00);
    for (const sz of [1, -1] as const) {
      lamp(m, -2.10, 1.06, sz * 0.62, 0.34, 0.3, -1, TINT.SIGN_LIT);
      lamp(m, 2.20, 1.22, sz * 0.62, 0.24, 0.4, 1, TINT.BRAND);
    }
    plate(m, -2.12, 0.72, -1);
    plate(m, 2.22, 0.74, 1);
    person(m, 91, 2.9, 1.2, Math.PI * 0.75, { bag: true, stride: 0.06 });
    person(m, 92, 3.1, -1.1, 0.3, {});
  }
  return m;
}

function coupe(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  tarmac(m, 3.2, 1.9);
  // Low and wide, with the roofline falling all the way to the tail.
  const S: Section = [[0.22, 0.80], [0.50, 0.96], [0.82, 0.98], [1.02, 0.88], [1.16, 0.60]];

  m.keyed(9, () => {
    loft(m, [
      { x: -2.20, s: shape(S, 0.86, 0.80) },
      { x: -1.95, s: shape(S, 0.98, 0.86) },
      { x: -1.20, s: shape(S, 1.04, 0.94) },
      { x: -0.35, s: shape(S, 1.06, 1.20) },
      { x: 0.45, s: shape(S, 1.06, 1.24) },
      { x: 1.35, s: shape(S, 1.04, 1.16) },
      { x: 2.00, s: shape(S, 1.00, 0.98) },
      { x: 2.22, s: shape(S, 0.90, 0.88) },
    ], MAT.PAINT);
  });

  if (medium) {
    for (const cx of [-1.40, 1.45]) {
      arch(m, cx, 0.38, 0.44, 0.90);
      for (const sz of [1, -1] as const) wheel(m, cx, 0.36, sz * 0.82, 0.35, 0.16);
    }
    glazing(m, -0.5, 0.35, 0.86, 1.18, 0.94, 0.24);
    glazing(m, 0.85, 1.70, 0.90, 1.14, 0.94, -0.28);
  }
  if (fine) {
    m.painted(TINT.METAL_DARK, () => {
      // Splitter, side sills and a ducktail spoiler.
      m.box([-2.30, 0.16, -0.86], [-1.90, 0.28, 0.86], MAT.TRIM);
      for (const sz of [1, -1] as const) {
        m.box([-1.3, 0.16, sz * 1.02 - 0.06], [1.4, 0.28, sz * 1.02 + 0.06], MAT.TRIM);
      }
      m.box([2.02, 0.94, -0.86], [2.30, 1.02, 0.86], MAT.TRIM);
      m.box([1.9, 0.16, -0.8], [2.3, 0.30, 0.8], MAT.TRIM);
      // Vents in the bonnet and behind the front arch.
      for (let i = 0; i < 3; i++) {
        m.box([-1.6 + i * 0.16, 0.86, -0.36], [-1.54 + i * 0.16, 0.9, 0.36], MAT.TRIM);
      }
      for (const sz of [1, -1] as const) {
        for (let i = 0; i < 3; i++) {
          m.box([-0.95, 0.56 + i * 0.1, sz * 1.0 - 0.03], [-0.7, 0.60 + i * 0.1, sz * 1.0 + 0.03],
            MAT.TRIM);
        }
      }
      // Quad tailpipes.
      for (const sz of [1, -1] as const) {
        for (const dz of [0.18, 0.38]) {
          m.cylinder(2.26, sz * dz, 0.07, 0.22, 0.36, 8, MAT.TRIM);
        }
      }
    });
    doors(m, [-0.42], 0.5, 1.02, 1.02, 0.86);
    mirrors(m, -0.5, 0.98, 1.02);
    for (const sz of [1, -1] as const) {
      lamp(m, -2.20, 0.70, sz * 0.62, 0.4, 0.16, -1, TINT.SIGN_LIT);
      lamp(m, 2.24, 0.80, sz * 0.6, 0.36, 0.14, 1, TINT.BRAND);
    }
    plate(m, -2.22, 0.42, -1);
    plate(m, 2.26, 0.5, 1);
    person(m, 101, 3.0, 1.2, Math.PI, { stride: 0.1 });
  }
  return m;
}

function lorry(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  tarmac(m, 8.5, 2.3);
  const CAB: Section = [[0.75, 1.02], [1.05, 1.24], [2.60, 1.28], [3.20, 1.24], [3.38, 1.02]];

  // Tractor unit and a semi-trailer: two bodies with a real gap between them.
  m.keyed(10, () => {
    loft(m, [
      { x: -7.30, s: shape(CAB, 0.90, 2.90) },
      { x: -7.05, s: shape(CAB, 0.99, 3.10) },
      { x: -6.60, s: shape(CAB, 1.00, 3.30) },
      { x: -4.60, s: shape(CAB, 1.00, 3.34) },
      { x: -4.35, s: shape(CAB, 0.96, 3.20) },
    ], MAT.PAINT);
  });
  m.keyed(11, () => {
    loft(m, [
      { x: -4.10, s: shape(CAB, 0.98, 3.60) },
      { x: 7.20, s: shape(CAB, 0.98, 3.62) },
    ], MAT.PAINT);
  });

  if (medium) {
    // Chassis rails carrying the trailer, and the bogies.
    m.painted(TINT.METAL_DARK, () => {
      for (const sz of [1, -1] as const) {
        m.box([-4.4, 0.86, sz * 0.62 - 0.09], [7.2, 1.02, sz * 0.62 + 0.09], MAT.TRIM);
      }
      m.box([-4.6, 0.86, -0.72], [-3.6, 1.05, 0.72], MAT.TRIM);
    });
    for (const cx of [-6.30, -4.90, 5.10, 6.20]) {
      arch(m, cx, 0.62, 0.68, 1.16);
      for (const sz of [1, -1] as const) {
        wheel(m, cx, 0.55, sz * 1.00, 0.54, 0.16);
        if (cx > 0 || cx < -5.5) wheel(m, cx, 0.55, sz * 0.70, 0.54, 0.15);
      }
    }
    glazing(m, -7.25, -6.5, 1.90, 3.06, 1.265, 0.3);
  }
  if (fine) {
    m.painted(TINT.METAL_DARK, () => {
      m.box([-7.34, 0.90, -1.20], [-6.7, 1.62, 1.20], MAT.TRIM);
      // Grille, sun visor, exhaust stack and mud flaps.
      for (let i = 0; i < 5; i++) {
        m.box([-7.32, 1.70 + i * 0.16, -0.66], [-7.14, 1.78 + i * 0.16, 0.66], MAT.TRIM);
      }
      m.box([-7.3, 3.10, -1.2], [-6.9, 3.30, 1.2], MAT.TRIM);
      m.cylinder(-4.7, 1.14, 0.13, 1.05, 3.30, 8, MAT.TRIM, false);
      for (const cx of [-4.55, 6.65]) {
        for (const sz of [1, -1] as const) {
          m.box([cx, 0.06, sz * 1.06 - 0.24], [cx + 0.05, 0.62, sz * 1.06 + 0.24], MAT.TRIM);
        }
      }
      // Trailer: door frame, hinges and the underrun bar.
      m.box([7.18, 1.10, -1.20], [7.26, 3.52, 1.20], MAT.TRIM);
      for (const sz of [1, -1] as const) {
        for (const y of [1.5, 2.4, 3.2]) {
          m.box([7.2, y, sz * 0.9], [7.32, y + 0.16, sz * 1.14], MAT.TRIM);
        }
      }
      m.box([7.1, 0.5, -1.1], [7.3, 0.66, 1.1], MAT.TRIM);
      // Curtain tensioners down the trailer flank.
      for (const sz of [1, -1] as const) {
        for (let i = 0; i < 11; i++) {
          const px = -3.8 + i * 1.0;
          m.box([px - 0.05, 1.16, sz * 1.24 - 0.03], [px + 0.05, 3.44, sz * 1.24 + 0.03], MAT.TRIM);
        }
      }
    });
    mirrors(m, -6.7, 2.6, 1.24);
    for (const sz of [1, -1] as const) {
      lamp(m, -7.30, 1.30, sz * 0.9, 0.5, 0.4, -1, TINT.SIGN_LIT);
      lamp(m, 7.30, 1.0, sz * 0.86, 0.4, 0.3, 1, TINT.BRAND);
    }
    plate(m, -7.32, 0.94, -1);
    // Operator's name board on the trailer flank.
    m.painted(TINT.BRAND, () => {
      for (const sz of [1, -1] as const) {
        m.box([-2.8, 2.0, Math.min(sz * 1.24, sz * 1.28)], [4.4, 3.1, Math.max(sz * 1.24, sz * 1.28)],
          MAT.TRIM);
      }
    });
    person(m, 111, -8.1, 1.4, 0.2, { hat: true, stride: 0.1 });
  }
  return m;
}

// --------------------------------------------------------------- the people

/** A pavement's worth of figures, walking in both directions. */
function pedestrians(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 8.6, z = 3.4;

  // The pavement they are on, with a kerb, so the group has a place to be.
  m.box([-x, 0.0005, -z], [x, 0.14, z - 0.6], MAT.CONCRETE);
  m.box([-x, 0.0005, z - 0.6], [x, 0.18, z - 0.3], MAT.STONE);
  m.box([-x, 0.0005, z - 0.3], [x, 0.04, z], MAT.GROUND);

  // Two lanes of walkers passing each other, plus a group standing still.
  const walkers: Array<[number, number, number, number]> = [
    [-7.6, -1.9, 0, 0.16], [-6.0, -2.3, 0, 0.10], [-4.2, -1.7, 0, 0.18],
    [-2.4, -2.2, 0, 0.06], [-0.6, -1.8, 0, 0.15], [1.4, -2.3, 0, 0.11],
    [3.2, -1.9, 0, 0.17], [5.4, -2.1, 0, 0.08],
    [-6.8, 0.9, Math.PI, 0.14], [-4.9, 1.4, Math.PI, 0.09], [-3.0, 0.8, Math.PI, 0.17],
    [-1.1, 1.3, Math.PI, 0.05], [0.9, 0.9, Math.PI, 0.16], [2.9, 1.4, Math.PI, 0.12],
    [4.8, 0.85, Math.PI, 0.18], [6.7, 1.3, Math.PI, 0.07],
  ];
  for (let i = 0; i < walkers.length; i++) {
    const [px, pz, f, st] = walkers[i];
    if (!medium && i % 3 !== 0) continue;
    person(m, 200 + i * 7, px, pz, f, {
      stride: st,
      bag: i % 3 === 0,
      hat: i % 5 === 2,
      scale: 0.94 + ((i * 37) % 13) / 100,
    });
  }
  if (fine) {
    // A group waiting: two facing each other, one apart, all still.
    person(m, 400, 7.2, -0.4, Math.PI * 0.5, { bag: true });
    person(m, 407, 7.9, 0.4, -Math.PI * 0.5, {});
    person(m, 414, 6.4, 1.6, Math.PI * 0.2, { hat: true });
    // A child, and someone sitting on the bench.
    person(m, 421, 5.9, -0.9, Math.PI * 0.5, { scale: 0.66, stride: 0.13 });
    m.painted(TINT.WOOD, () => {
      m.box([-2.6, 0.14, 2.0], [0.4, 0.6, 2.6], MAT.TRIM);
      m.box([-2.6, 0.6, 2.5], [0.4, 1.1, 2.62], MAT.TRIM);
    });
    m.painted(TINT.METAL_DARK, () => {
      for (const px of [-2.4, 0.1]) m.box([px, 0.14, 2.1], [px + 0.12, 0.6, 2.5], MAT.TRIM);
    });
    // Seated: legs forward, torso upright, on the bench.
    m.keyed(431, () => {
      m.box([-1.5, 0.6, 2.16], [-1.2, 1.16, 2.48], MAT.FIGURE);
      m.box([-1.5, 0.52, 1.72], [-1.22, 0.66, 2.2], MAT.FIGURE);
      m.box([-1.52, 0.06, 1.7], [-1.2, 0.56, 1.86], MAT.FIGURE);
      m.box([-1.46, 1.14, 2.2], [-1.24, 1.34, 2.42], MAT.FIGURE);
    });
    // A lamp column and a bin, so the pavement is a street and not a stage.
    m.painted(TINT.METAL_DARK, () => {
      m.box([3.6, 0.14, 2.3], [4.0, 0.44, 2.7], MAT.TRIM);
      m.cylinder(3.8, 2.5, 0.08, 0.44, 5.0, 8, MAT.TRIM, false);
      m.cylinder(-5.4, 2.4, 0.3, 0.14, 1.0, 8, MAT.TRIM, true);
      m.cylinder(-5.4, 2.4, 0.36, 1.0, 1.12, 8, MAT.TRIM, true);
    });
    m.painted(TINT.SIGN_LIT, () => m.box([3.5, 5.0, 2.32], [4.1, 5.24, 2.68], MAT.TRIM));
  }
  return m;
}

/** Cyclists and a scooter rider: the other half of what moves on a street. */
function cyclists(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  tarmac(m, 6.0, 2.6);

  /** A bicycle: two wheels, a diamond frame, bars and a saddle. */
  const bike = (cx: number, cz: number, key: number): void => {
    for (const dx of [-0.55, 0.55]) wheel(m, cx + dx, 0.34, cz, 0.33, 0.035, 12);
    m.painted(TINT.METAL_DARK, () => {
      // Frame: down tube, seat tube, top tube, chain stays, forks.
      const tube = (a: Vec3, b: Vec3): void => m.pipe(a, b, 0.035, MAT.TRIM);
      tube([cx - 0.28, 0.86, cz], [cx + 0.3, 0.48, cz]);
      tube([cx - 0.28, 0.86, cz], [cx + 0.3, 0.9, cz]);
      tube([cx + 0.3, 0.9, cz], [cx + 0.3, 0.48, cz]);
      tube([cx + 0.3, 0.48, cz], [cx + 0.55, 0.34, cz]);
      tube([cx + 0.3, 0.9, cz], [cx + 0.55, 0.34, cz]);
      tube([cx - 0.28, 0.86, cz], [cx - 0.55, 0.34, cz]);
      tube([cx - 0.3, 0.94, cz - 0.22], [cx - 0.3, 0.94, cz + 0.22]);
      m.box([cx + 0.24, 0.9, cz - 0.07], [cx + 0.44, 0.96, cz + 0.07], MAT.TRIM);
      m.cylinder(cx + 0.3, cz, 0.09, 0.44, 0.52, 8, MAT.TRIM);
    });
    person(m, key, cx + 0.12, cz, 0, { scale: 0.86, lift: 0.5, stride: 0.16 });
  };

  if (medium) {
    bike(-3.2, -1.1, 501);
    bike(-1.0, 0.9, 512);
  }
  if (fine) {
    bike(1.4, -0.9, 523);
    // A scooter: step-through frame, apron, small wheels, a rider.
    const sx = 3.6, sz = 1.0;
    for (const dx of [-0.5, 0.5]) wheel(m, sx + dx, 0.26, sz, 0.25, 0.06, 12);
    m.keyed(534, () => {
      m.box([sx - 0.62, 0.3, sz - 0.16], [sx + 0.2, 0.5, sz + 0.16], MAT.PAINT);
      m.box([sx + 0.05, 0.44, sz - 0.2], [sx + 0.55, 1.0, sz + 0.2], MAT.PAINT);
    });
    m.painted(TINT.METAL_DARK, () => {
      m.box([sx - 0.5, 0.5, sz - 0.18], [sx - 0.1, 0.62, sz + 0.18], MAT.TRIM);
      m.box([sx + 0.42, 1.0, sz - 0.28], [sx + 0.5, 1.06, sz + 0.28], MAT.TRIM);
    });
    m.painted(TINT.SIGN_LIT, () => m.box([sx + 0.5, 0.78, sz - 0.12], [sx + 0.58, 0.94, sz + 0.12], MAT.TRIM));
    person(m, 545, sx - 0.05, sz, Math.PI, { scale: 0.84, lift: 0.42, hat: true, stride: 0.14 });
    // A rack of parked bikes against a stand.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 4; i++) {
        const px = -4.6 + i * 0.9;
        m.box([px - 0.04, 0.04, 1.8], [px + 0.04, 0.85, 1.88], MAT.TRIM);
        m.box([px - 0.04, 0.78, 1.8], [px + 0.04, 0.85, 2.7], MAT.TRIM);
        m.box([px - 0.04, 0.04, 2.62], [px + 0.04, 0.85, 2.7], MAT.TRIM);
      }
    });
  }
  return m;
}

// ===================================================================== table

const road = (jobs: number): AssetDef['sim'] => ({
  jobs, powerKW: 0, waterM3: 0, garbagePerWeek: 0, pollution: 0, upkeep: 0,
});

export const FLEET: AssetDef[] = [
  { id: 'car.hatchback', name: 'Hatchback', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [1, 1], height: 1.6, brand: { name: 'Hatch', colour: [0.42, 0.13, 0.12], accent: [0.62, 0.20, 0.16], sign: 'none' }, sim: road(0), note: 'Lofted body, five-spoke wheels, roof rails, raked screen and backlight, one pedestrian for scale.', build: hatchback },
  { id: 'car.saloon', name: 'Saloon', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [1, 1], height: 1.6, brand: { name: 'Saloon', colour: [0.10, 0.16, 0.34], accent: [0.44, 0.16, 0.14], sign: 'none' }, sim: road(0), note: 'Three-box body with a stepped boot, barred grille, twin tailpipes, door shuts and handles.', build: saloon },
  { id: 'car.estate', name: 'Estate', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [1, 1], height: 1.7, brand: { name: 'Estate', colour: [0.14, 0.26, 0.18], accent: [0.46, 0.18, 0.14], sign: 'none' }, sim: road(0), note: 'Long roof carried to the tailgate, roof bars with cross rails, towbar, three doors a side.', build: estate },
  { id: 'car.suv', name: 'SUV', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [1, 1], height: 2.1, brand: { name: 'SUV', colour: [0.20, 0.21, 0.24], accent: [0.48, 0.16, 0.14], sign: 'none' }, sim: road(0), note: 'Raised body on 46cm wheels, arch and sill cladding, roof rails, spare on the tailgate.', build: suv },
  { id: 'car.pickup', name: 'Pickup truck', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [1, 1], height: 2.2, brand: { name: 'Pickup', colour: [0.46, 0.26, 0.10], accent: [0.50, 0.18, 0.14], sign: 'none' }, sim: road(0), note: 'Separate cab and bed with a ribbed tray, roll bar, timber load, tall barred grille.', build: pickup },
  { id: 'car.van', name: 'Panel van', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [1, 1], height: 2.8, brand: { name: 'Van', colour: [0.62, 0.62, 0.64], accent: [0.16, 0.34, 0.52], sign: 'none' }, sim: road(0), note: 'Box body with swage lines and a signwritten flank, glazed rear doors, deep windscreen.', build: van },
  { id: 'car.bus', name: 'City bus', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [2, 1], height: 3.5, brand: { name: 'Transit', colour: [0.58, 0.16, 0.14], accent: [0.72, 0.62, 0.20], sign: 'none' }, sim: road(0), note: 'Twelve-metre body, full window band on pillars, two glazed door sets with grab poles, roof pods, a queue.', build: cityBus },
  { id: 'car.taxi', name: 'Taxi', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [1, 1], height: 2.1, brand: { name: 'Taxi', colour: [0.66, 0.50, 0.08], accent: [0.10, 0.10, 0.12], sign: 'none' }, sim: road(0), note: 'Upright cab body with a chequered waist band, lit roof sign, two fares waiting.', build: taxi },
  { id: 'car.coupe', name: 'Sports coupe', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [1, 1], height: 1.3, brand: { name: 'Coupe', colour: [0.52, 0.06, 0.06], accent: [0.14, 0.14, 0.16], sign: 'none' }, sim: road(0), note: 'Low fastback on wide wheels, splitter and sills, bonnet and arch vents, ducktail, quad pipes.', build: coupe },
  { id: 'car.lorry', name: 'Articulated lorry', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [2, 1], height: 3.7, brand: { name: 'Haulage', colour: [0.14, 0.28, 0.44], accent: [0.70, 0.58, 0.18], sign: 'none' }, sim: road(0), note: 'Tractor unit and semi-trailer on four bogies, exhaust stack, mud flaps, curtain tensioners, name board.', build: lorry },
  { id: 'car.people', name: 'Pedestrians', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [2, 1], height: 5.3, brand: { name: 'People', colour: [0.30, 0.32, 0.36], accent: [0.52, 0.44, 0.30], sign: 'none' }, sim: road(0), note: 'Twenty figures on a kerbed pavement: two lanes walking, a group talking, a child, someone on a bench.', build: pedestrians },
  { id: 'car.cyclists', name: 'Cyclists', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [2, 1], height: 1.9, brand: { name: 'Cycles', colour: [0.16, 0.34, 0.30], accent: [0.62, 0.40, 0.12], sign: 'none' }, sim: road(0), note: 'Three riders on diamond-frame bicycles, a scooter with an apron and headlamp, and a full bike stand.', build: cyclists },
];
