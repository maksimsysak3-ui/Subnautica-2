/**
 * Shared building parts.
 *
 * A library of thirty buildings written as thirty bespoke generators is thirty
 * places for the same mistake. These are the pieces every one of them is made
 * of -- parapets, shopfronts, awnings, signs, roof clutter, fire escapes --
 * each taking a wall to sit on and a size to be.
 *
 * Two conventions throughout. `axis` is the wall's normal axis and `sign`
 * which way it faces, matching MeshBuilder.opening. And `u` runs horizontally
 * along that wall: z for an X-facing wall, x for a Z-facing one.
 */

import { MAT, TINT, MeshBuilder } from './mesh';
import type { Face, Material, Tint, Vec3 } from './mesh';
import { hash2 } from '../sim/hash';

export type Axis = 'x' | 'z';
export type Facing = 1 | -1;

export interface Wall {
  axis: Axis;
  sign: Facing;
  plane: number;
}

/** Turns wall coordinates into world coordinates. */
function place(w: Wall, u0: number, u1: number, y0: number, y1: number, d0: number, d1: number): [Vec3, Vec3] {
  const p0 = w.plane + w.sign * Math.min(d0, d1);
  const p1 = w.plane + w.sign * Math.max(d0, d1);
  const lo = Math.min(p0, p1);
  const hi = Math.max(p0, p1);
  return w.axis === 'x'
    ? [[lo, y0, u0], [hi, y1, u1]]
    : [[u0, y0, lo], [u1, y1, hi]];
}

function slab(m: MeshBuilder, w: Wall, u0: number, u1: number, y0: number, y1: number, d0: number, d1: number, mat: Material): void {
  const [a, b] = place(w, u0, u1, y0, y1, d0, d1);
  // Slabs are mostly seen from below -- fascias, canopies, awnings, stallrisers
  // -- so unlike a plain box they keep their underside. What they never need is
  // the face pressed against the wall, and almost all of them start flush with
  // it. Anything standing off the wall (a blade sign, a bracket) is untouched.
  const flush = Math.min(d0, d1) <= 0.02;
  const back: Face = w.axis === 'x' ? (w.sign > 0 ? '-x' : '+x') : (w.sign > 0 ? '-z' : '+z');
  if (flush) m.box(a, b, mat, { skipBottom: false, skip: back });
  else m.box(a, b, mat, { skipBottom: false });
}

/**
 * The readable face of a sign: a quad carrying 0..1 coordinates so the shader
 * can write the brand name across it.
 */
function signPanel(m: MeshBuilder, w: Wall, u0: number, u1: number, y0: number, y1: number, depth: number): void {
  const p = w.plane + w.sign * depth;
  if (w.axis === 'x') {
    // Wound so the face points away from the wall.
    if (w.sign > 0) m.signFace([p, y0, u1], [p, y0, u0], [p, y1, u0], [p, y1, u1], MAT.TRIM);
    else m.signFace([p, y0, u0], [p, y0, u1], [p, y1, u1], [p, y1, u0], MAT.TRIM);
  } else {
    if (w.sign > 0) m.signFace([u0, y0, p], [u1, y0, p], [u1, y1, p], [u0, y1, p], MAT.TRIM);
    else m.signFace([u1, y0, p], [u0, y0, p], [u0, y1, p], [u1, y1, p], MAT.TRIM);
  }
}

// ------------------------------------------------------------------- tops

/** A lip around a flat roof. Without it a flat-roofed block is an extrusion. */
export function parapet(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number, y: number, h = 0.85, out = 0.18, mat: Material = MAT.TRIM): void {
  m.box([x0 - out, y, z0 - out], [x1 + out, y + h, z1 + out], mat);
}

/**
 * A band that wraps the four walls without capping the roof.
 *
 * The obvious way to write this is one box, and the result is a coloured slab
 * lying on the building -- a red roof where a red fascia was wanted. Four
 * boxes, one per elevation.
 */
export function ring(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number, y: number, h: number, out: number, mat: Material = MAT.TRIM): void {
  m.box([x0 - out, y, z1], [x1 + out, y + h, z1 + out], mat);
  m.box([x0 - out, y, z0 - out], [x1 + out, y + h, z0], mat);
  m.box([x1, y, z0 - out], [x1 + out, y + h, z1 + out], mat);
  m.box([x0 - out, y, z0 - out], [x0, y + h, z1 + out], mat);
}

/** A projecting band, for cornices, string courses and slab edges. */
export function band(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number, y: number, h: number, out: number, mat: Material = MAT.TRIM): void {
  m.box([x0 - out, y, z0 - out], [x1 + out, y + h, z1 + out], mat);
}

/**
 * Whatever is on the roof: extracts, ducts, a stair bulkhead, a water tank.
 *
 * Deterministic from the seed. Roofs are the most-seen surface in a city
 * builder and a bare one is the fastest way to look unfinished.
 */
export function roofClutter(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number, y: number, seed: number, density = 1): void {
  const w = x1 - x0;
  const d = z1 - z0;
  if (w < 3 || d < 3) return;

  // Stair bulkhead: every roof has to be reachable.
  const bw = Math.min(3.2, w * 0.34);
  const bd = Math.min(2.6, d * 0.34);
  m.box([x0 + w * 0.12, y, z0 + d * 0.12], [x0 + w * 0.12 + bw, y + 2.6, z0 + d * 0.12 + bd], MAT.CONCRETE, { roof: MAT.ROOF });

  const units = Math.max(1, Math.round(((w * d) / 60) * density));
  for (let i = 0; i < units; i++) {
    const r1 = hash2(i, 3, seed);
    const r2 = hash2(i, 7, seed);
    const r3 = hash2(i, 11, seed);
    const cx = x0 + 1.6 + r1 * Math.max(0.1, w - 3.2);
    const cz = z0 + 1.6 + r2 * Math.max(0.1, d - 3.2);
    if (r3 < 0.42) {
      // Packaged air handler.
      const uw = 1.1 + r1 * 1.5;
      const ud = 0.9 + r2 * 1.1;
      m.box([cx, y, cz], [cx + uw, y + 0.85 + r3, cz + ud], MAT.METAL);
      m.box([cx + 0.1, y + 0.85 + r3, cz + 0.1], [cx + uw - 0.1, y + 1.05 + r3, cz + ud - 0.1], MAT.TRIM);
    } else if (r3 < 0.72) {
      m.cylinder(cx, cz, 0.34 + r1 * 0.24, y, y + 0.7 + r2 * 0.8, 8, MAT.METAL);
    } else {
      // Ducting run.
      m.box([cx, y + 0.35, cz], [cx + 1.0 + r1 * 3.5, y + 0.85, cz + 0.55], MAT.METAL);
      m.box([cx + 0.1, y, cz + 0.1], [cx + 0.35, y + 0.35, cz + 0.35], MAT.TRIM);
    }
  }

  // Water tank on the taller roofs.
  if (y > 18 && hash2(1, 1, seed) > 0.45) {
    const tx = x1 - Math.min(4.0, w * 0.3);
    const tz = z1 - Math.min(4.0, d * 0.3);
    for (const [dx, dz] of [[0, 0], [1.9, 0], [0, 1.9], [1.9, 1.9]] as const) {
      m.box([tx + dx - 0.1, y, tz + dz - 0.1], [tx + dx + 0.1, y + 1.8, tz + dz + 0.1], MAT.TRIM);
    }
    m.cylinder(tx + 0.95, tz + 0.95, 1.5, y + 1.8, y + 4.2, 12, MAT.METAL);
    m.cone(tx + 0.95, tz + 0.95, 1.5, 0.2, y + 4.2, y + 5.1, 12, MAT.METAL);
  }
}


/**
 * Dresses whatever flat roof the builder already has.
 *
 * A flat-roofed block with a bare top is an extrusion of its own plan, and
 * from the angle a city builder is played at, the roof is a third of what you
 * see of every building. Sixty-odd assets in this library had one.
 *
 * It finds the roof itself rather than taking coordinates, because every
 * generator already holds those numbers in three forms and restating them a
 * fourth time is how plant ends up hovering beside a building instead of on
 * it. Call it last, once the roof exists; it no-ops at the far LOD and on
 * anything pitched.
 */
export function dressRoof(m: MeshBuilder, lod: number, seed: number,
  opts: { density?: number; parapet?: boolean; lights?: number } = {}): void {
  if (lod >= 2) return;
  const roof = m.roofPlane();
  if (roof === null) return;
  const [x0, z0] = roof.min;
  const [x1, z1] = roof.max;
  const y = roof.y;
  const w = x1 - x0, d = z1 - z0;
  if (w < 4 || d < 4) return;

  // Inset, so nothing sits on the very edge where a parapet would be.
  const i = Math.min(1.2, Math.min(w, d) * 0.14);
  roofClutter(m, x0 + i, z0 + i, x1 - i, z1 - i, y, seed, opts.density ?? 1);

  if (opts.parapet !== false) parapet(m, x0, z0, x1, z1, y, 0.75, 0.16);

  // Rooflights in a row, and the mansafe line that has to run past them.
  const lights = opts.lights ?? Math.min(4, Math.max(0, Math.round(w / 9)));
  for (let k = 0; k < lights; k++) {
    const cx = x0 + i + ((k + 0.5) / lights) * (w - 2 * i);
    const cz = (z0 + z1) / 2 + (hash2(k, 5, seed) - 0.5) * d * 0.3;
    m.box([cx - 0.9, y, cz - 0.7], [cx + 0.9, y + 0.22, cz + 0.7], MAT.CONCRETE);
    m.box([cx - 0.8, y + 0.22, cz - 0.6], [cx + 0.8, y + 0.42, cz + 0.6], MAT.GLASS);
  }
  m.painted(TINT.METAL_DARK, () => {
    const cz = z0 + d * 0.62;
    for (let k = 0; k <= Math.max(1, Math.round(w / 4)); k++) {
      const cx = x0 + i + (k / Math.max(1, Math.round(w / 4))) * (w - 2 * i);
      m.box([cx - 0.05, y, cz - 0.05], [cx + 0.05, y + 1.0, cz + 0.05], MAT.TRIM);
    }
    m.box([x0 + i, y + 0.95, cz - 0.03], [x1 - i, y + 1.0, cz + 0.03], MAT.TRIM);
    // A downpipe hopper at one corner: roofs drain somewhere.
    m.box([x1 - i - 0.3, y, z0 + i, ], [x1 - i, y + 0.5, z0 + i + 0.3], MAT.TRIM);
  });
}

// ------------------------------------------------------------ street level

/**
 * A run of shopfront: stallriser, mullioned glazing, a recessed door and a
 * fascia above. This is the single most valuable part in the library -- a
 * building's ground floor is what anyone actually looks at.
 */
export function shopfront(m: MeshBuilder, w: Wall, u0: number, u1: number, opts: {
  sill?: number;
  head?: number;
  bays?: number;
  doorBay?: number;
  fascia?: number;
  brandFascia?: boolean;
} = {}): void {
  const sill = opts.sill ?? 0.55;
  const head = opts.head ?? 3.5;
  const span = u1 - u0;
  const bays = opts.bays ?? Math.max(2, Math.round(span / 2.6));
  const doorBay = opts.doorBay ?? Math.floor(bays / 2);
  const fascia = opts.fascia ?? 0.9;

  // Every layer here sits in FRONT of the wall, never behind it. These walls
  // have no holes cut in them, so anything set back is simply occluded by the
  // wall's own face -- which is how the whole library ended up with glazing
  // nobody could see.
  //
  // Stallriser: the solid panel glazing sits on. Shopfronts without one look
  // like glass boxes with the bottom missing.
  m.painted(TINT.BRAND_DARK, () => slab(m, w, u0, u1, 0, sill, 0.0, 0.16, MAT.TRIM));

  for (let i = 0; i < bays; i++) {
    const a = u0 + (i / bays) * span + 0.09;
    const b = u0 + ((i + 1) / bays) * span - 0.09;
    if (i === doorBay) {
      // Door bay: transom light over a real door. This used to be a painted
      // rectangle on the glass, which at any distance read as one more pane
      // -- shops looked like they had no way in.
      slab(m, w, a, b, 2.45, head - 0.75, 0.01, 0.06, MAT.SHOPFRONT);
      entrance(m, w, (a + b) / 2, {
        width: Math.min(b - a - 0.24, 1.9), height: 2.3, double: b - a > 2.2,
        glazed: true, fanlight: false,
      });
      m.painted(TINT.BRAND_DARK, () => {
        slab(m, w, a - 0.06, a + 0.12, 0, head - 0.75, 0.0, 0.17, MAT.TRIM);
        slab(m, w, b - 0.12, b + 0.06, 0, head - 0.75, 0.0, 0.17, MAT.TRIM);
      });
    } else {
      slab(m, w, a, b, sill, head - 0.75, 0.01, 0.06, MAT.SHOPFRONT);
    }
    // Mullion between bays, proud of the glass.
    m.painted(TINT.BRAND_DARK, () => slab(m, w, b, b + 0.18, 0, head - 0.7, 0.0, 0.15, MAT.TRIM));
  }
  m.painted(TINT.BRAND_DARK, () => slab(m, w, u0 - 0.18, u0, 0, head - 0.7, 0.0, 0.15, MAT.TRIM));

  // Fascia board over the whole run, painted in the brand.
  const t: Tint = opts.brandFascia === false ? TINT.NONE : TINT.BRAND;
  m.painted(t, () => slab(m, w, u0 - 0.22, u1 + 0.22, head - 0.75, head - 0.75 + fascia, -0.05, 0.24, MAT.TRIM));
}

/** Fabric awning over a shopfront bay, sloping down and out. */
export function awning(m: MeshBuilder, w: Wall, u0: number, u1: number, y: number, depth = 1.5): void {
  m.painted(TINT.AWNING, () => {
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      const d0 = (i / steps) * depth;
      const d1 = ((i + 1) / steps) * depth;
      const y0 = y - (i / steps) * 0.55;
      const y1 = y - ((i + 1) / steps) * 0.55;
      slab(m, w, u0, u1, Math.min(y0, y1) - 0.06, Math.max(y0, y1), d0, d1, MAT.TRIM);
    }
    // Valance: the vertical flap at the front edge.
    slab(m, w, u0, u1, y - 0.85, y - 0.55, depth - 0.08, depth, MAT.TRIM);
  });
}

/** Illuminated sign box on the fascia. */
export function fasciaSign(m: MeshBuilder, w: Wall, u0: number, u1: number, y0: number, y1: number): void {
  m.painted(TINT.BRAND_DARK, () => slab(m, w, u0 - 0.1, u1 + 0.1, y0 - 0.08, y1 + 0.08, 0.02, 0.3, MAT.TRIM));
  m.painted(TINT.SIGN_LIT, () => {
    slab(m, w, u0, u1, y0, y1, 0.28, 0.33, MAT.TRIM);
    signPanel(m, w, u0, u1, y0, y1, 0.335);
  });
}

/** Projecting blade sign, hung off a bracket. */
export function bladeSign(m: MeshBuilder, w: Wall, u: number, y0: number, y1: number, reach = 1.35): void {
  m.painted(TINT.METAL_DARK, () => slab(m, w, u - 0.06, u + 0.06, y1 - 0.12, y1, 0.02, reach, MAT.TRIM));
  m.painted(TINT.SIGN_LIT, () => {
    slab(m, w, u - 0.055, u + 0.055, y0, y1 - 0.1, reach - 0.95, reach - 0.06, MAT.TRIM);
    // Both faces of the blade carry the name, since it is read from either
    // direction along the street.
    const p0 = w.plane + w.sign * (reach - 0.95);
    const p1 = w.plane + w.sign * (reach - 0.06);
    if (w.axis === 'z') {
      m.signFace([u - 0.056, y0, p1], [u - 0.056, y0, p0], [u - 0.056, y1 - 0.1, p0], [u - 0.056, y1 - 0.1, p1], MAT.TRIM);
      m.signFace([u + 0.056, y0, p0], [u + 0.056, y0, p1], [u + 0.056, y1 - 0.1, p1], [u + 0.056, y1 - 0.1, p0], MAT.TRIM);
    } else {
      m.signFace([p0, y0, u - 0.056], [p1, y0, u - 0.056], [p1, y1 - 0.1, u - 0.056], [p0, y1 - 0.1, u - 0.056], MAT.TRIM);
      m.signFace([p1, y0, u + 0.056], [p0, y0, u + 0.056], [p0, y1 - 0.1, u + 0.056], [p1, y1 - 0.1, u + 0.056], MAT.TRIM);
    }
  });
  m.painted(TINT.BRAND, () => slab(m, w, u - 0.09, u + 0.09, y0 - 0.08, y0, reach - 1.0, reach, MAT.TRIM));
}

/** Freestanding pole sign, the kind a drive-through puts by the road. */
export function pylonSign(m: MeshBuilder, cx: number, cz: number, height: number, width = 3.0): void {
  m.painted(TINT.METAL_DARK, () => {
    m.box([cx - 0.28, 0, cz - 0.28], [cx + 0.28, height - 2.4, cz + 0.28], MAT.TRIM);
    m.box([cx - 0.7, 0, cz - 0.7], [cx + 0.7, 0.35, cz + 0.7], MAT.CONCRETE);
  });
  m.painted(TINT.BRAND, () => {
    m.box([cx - width / 2, height - 2.6, cz - 0.34], [cx + width / 2, height, cz + 0.34], MAT.TRIM);
  });
  m.painted(TINT.SIGN_LIT, () => {
    const a = cx - width / 2 + 0.16;
    const b = cx + width / 2 - 0.16;
    const y0 = height - 2.4;
    const y1 = height - 0.2;
    m.signFace([b, y0, cz - 0.42], [a, y0, cz - 0.42], [a, y1, cz - 0.42], [b, y1, cz - 0.42], MAT.TRIM);
    m.signFace([a, y0, cz + 0.42], [b, y0, cz + 0.42], [b, y1, cz + 0.42], [a, y1, cz + 0.42], MAT.TRIM);
  });
}

/** Internally lit box sign, flush to a wall. */
export function boxSign(m: MeshBuilder, w: Wall, u0: number, u1: number, y0: number, y1: number): void {
  m.painted(TINT.SIGN_LIT, () => {
    slab(m, w, u0, u1, y0, y1, 0.02, 0.25, MAT.TRIM);
    signPanel(m, w, u0, u1, y0, y1, 0.255);
  });
}

// ---------------------------------------------------------------- openings

/** Rows of modelled windows over a stack of floors. */
export function windowGrid(m: MeshBuilder, w: Wall, u0: number, u1: number, opts: {
  floors: number;
  floorH: number;
  base: number;
  count: number;
  width: number;
  height: number;
  glass?: Material;
  sill?: boolean;
}): void {
  const glass = opts.glass ?? MAT.GLASS;
  for (let f = 0; f < opts.floors; f++) {
    const y0 = opts.base + f * opts.floorH;
    m.windowRow({
      axis: w.axis, sign: w.sign, plane: w.plane,
      from: u0, to: u1, y0, y1: y0 + opts.height,
      count: opts.count, width: opts.width, glass, frame: 0.08, proud: 0.055,
    });
    if (opts.sill !== false) {
      slab(m, w, u0, u1, y0 - 0.12, y0 - 0.02, -0.02, 0.12, MAT.TRIM);
    }
  }
}

/** Balconies along a wall, one per bay per floor. */
export function balconies(m: MeshBuilder, w: Wall, u0: number, u1: number, opts: {
  floors: number; floorH: number; base: number; bays: number; depth?: number; solid?: boolean;
}): void {
  const depth = opts.depth ?? 1.3;
  const span = u1 - u0;
  for (let f = 0; f < opts.floors; f++) {
    const y = opts.base + f * opts.floorH;
    for (let b = 0; b < opts.bays; b++) {
      const c = u0 + ((b + 0.5) / opts.bays) * span;
      const a = c - span / opts.bays / 2 + 0.3;
      const d = c + span / opts.bays / 2 - 0.3;
      slab(m, w, a, d, y, y + 0.16, 0, depth, MAT.CONCRETE);
      if (opts.solid === false) {
        m.painted(TINT.METAL_DARK, () => {
          slab(m, w, a, d, y + 0.16, y + 1.05, depth - 0.08, depth, MAT.TRIM);
          slab(m, w, a, a + 0.08, y + 0.16, y + 1.05, 0, depth, MAT.TRIM);
          slab(m, w, d - 0.08, d, y + 0.16, y + 1.05, 0, depth, MAT.TRIM);
        });
      } else {
        slab(m, w, a, d, y + 0.16, y + 1.05, depth - 0.12, depth, MAT.CONCRETE);
      }
    }
  }
}

/** Zigzag fire escape: landings, stringers and a drop ladder. */
export function fireEscape(m: MeshBuilder, w: Wall, u: number, base: number, floors: number, floorH: number, width = 2.4): void {
  m.painted(TINT.METAL_DARK, () => {
    for (let f = 0; f < floors; f++) {
      const y = base + f * floorH;
      slab(m, w, u, u + width, y, y + 0.1, 0.02, 1.5, MAT.TRIM);
      slab(m, w, u, u + width, y + 0.1, y + 1.0, 1.42, 1.5, MAT.TRIM);
      slab(m, w, u, u + 0.08, y + 0.1, y + 1.0, 0.02, 1.5, MAT.TRIM);
      slab(m, w, u + width - 0.08, u + width, y + 0.1, y + 1.0, 0.02, 1.5, MAT.TRIM);
      // The flight down to the landing below.
      if (f > 0) {
        for (let s = 0; s < 7; s++) {
          const t = s / 7;
          const sy = y - t * floorH + 0.1;
          slab(m, w, u + 0.2 + t * (width - 1.0), u + 0.9 + t * (width - 1.0), sy, sy + 0.06, 0.5, 1.2, MAT.TRIM);
        }
      }
    }
  });
}

// --------------------------------------------------------------- furniture

/** Steps up to a door. */
export function steps(m: MeshBuilder, w: Wall, u0: number, u1: number, count: number, rise = 0.16, tread = 0.3): void {
  for (let i = 0; i < count; i++) {
    const y = (count - i) * rise;
    slab(m, w, u0, u1, 0.0001, y, i * tread, (count - i) * tread + tread, MAT.CONCRETE);
  }
}

/** Bollards along a frontage. */
export function bollards(m: MeshBuilder, w: Wall, u0: number, u1: number, offset: number, count: number): void {
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i < count; i++) {
      const u = u0 + ((i + 0.5) / count) * (u1 - u0);
      const [a, b] = place(w, u - 0.11, u + 0.11, 0, 0.95, offset - 0.11, offset + 0.11);
      m.box(a, b, MAT.TRIM);
    }
  });
}

/** A planter with something growing in it. */
export function planter(m: MeshBuilder, cx: number, cz: number, r: number, h = 0.6): void {
  m.box([cx - r, 0, cz - r], [cx + r, h, cz + r], MAT.CONCRETE);
  m.painted(TINT.GREEN, () => {
    m.box([cx - r + 0.12, h, cz - r + 0.12], [cx + r - 0.12, h + 0.5, cz + r - 0.12], MAT.TRIM);
  });
}


/**
 * Overhanging eaves: a thin slab past the wall line, with a gutter face.
 *
 * A pitched roof flush with the wall reads as a lid rather than a roof, and
 * the overhang is the cheapest thirty triangles in the library.
 */
export function eavesBand(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number,
                          y: number, out = 0.45, depth = 0.26): void {
  m.box([x0 - out, y - depth, z0 - out], [x1 + out, y, z1 + out], MAT.TRIM);
  m.box([x0 - out, y - depth - 0.13, z1 + out - 0.16], [x1 + out, y - depth, z1 + out], MAT.TRIM);
  m.box([x0 - out, y - depth - 0.13, z0 - out], [x1 + out, y - depth, z0 - out + 0.16], MAT.TRIM);
}

/** Brick stack with a capping course. */
export function chimneyStack(m: MeshBuilder, cx: number, cz: number, base: number, top: number,
                             w = 1.1): void {
  m.box([cx - w / 2, base, cz - w / 2], [cx + w / 2, top, cz + w / 2], MAT.BRICK);
  m.box([cx - w / 2 - 0.14, top, cz - w / 2 - 0.14], [cx + w / 2 + 0.14, top + 0.24, cz + w / 2 + 0.14], MAT.TRIM);
  // Two pots, because a bare stack looks unfinished.
  for (const dx of [-w * 0.22, w * 0.22]) {
    m.cylinder(cx + dx, cz, 0.16, top + 0.24, top + 0.72, 6, MAT.TRIM);
  }
}

/**
 * The furniture a civic building has that a shop does not: a lit totem by the
 * road, a flag, a cycle shelter and a bin store.
 *
 * Services are placed one at a time and looked at closely, so the ground
 * around them carries more of the read than it does for a zoned building --
 * and a station or a clinic with a bare apron looks abandoned.
 */
export function serviceYard(m: MeshBuilder, x0: number, x1: number, z: number, seed: number, opts: {
  totem?: boolean;
  flag?: boolean;
  cycles?: boolean;
  bins?: boolean;
} = {}): void {
  if (opts.totem !== false) {
    // Totem: a lit panel on a post, the thing you actually navigate to.
    const tx = x1 - 1.8;
    m.painted(TINT.METAL_DARK, () => m.box([tx - 0.18, 0, z + 1.2], [tx + 0.18, 2.2, z + 1.56], MAT.TRIM));
    m.painted(TINT.BRAND, () => m.box([tx - 0.75, 2.2, z + 1.14], [tx + 0.75, 4.6, z + 1.62], MAT.TRIM));
    m.painted(TINT.SIGN_LIT, () => {
      m.signFace([tx - 0.62, 2.45, z + 1.63], [tx + 0.62, 2.45, z + 1.63],
                 [tx + 0.62, 4.35, z + 1.63], [tx - 0.62, 4.35, z + 1.63], MAT.TRIM);
    });
    m.box([tx - 0.6, 0, z + 1.0], [tx + 0.6, 0.18, z + 1.8], MAT.CONCRETE);
  }
  if (opts.flag !== false) {
    const fx = x0 + 1.6;
    m.painted(TINT.METAL_DARK, () => m.box([fx - 0.09, 0, z + 1.4], [fx + 0.09, 8.5, z + 1.58], MAT.TRIM));
    m.painted(TINT.ACCENT, () => m.box([fx + 0.09, 6.6, z + 1.44], [fx + 2.2, 7.9, z + 1.52], MAT.TRIM));
    m.box([fx - 0.55, 0, z + 0.95], [fx + 0.55, 0.22, z + 2.05], MAT.CONCRETE);
  }
  if (opts.cycles !== false) {
    // Cycle shelter: a canopy on two legs over a row of hoops.
    const cx = (x0 + x1) / 2 + hash2(1, 2, seed) * 2.0 - 1.0;
    m.painted(TINT.METAL_DARK, () => {
      m.box([cx - 2.6, 2.3, z + 1.0], [cx + 2.6, 2.5, z + 3.2], MAT.TRIM);
      for (const px of [cx - 2.3, cx + 2.3]) {
        m.box([px - 0.08, 0, z + 2.9], [px + 0.08, 2.3, z + 3.06], MAT.TRIM);
      }
      for (let i = 0; i < 5; i++) {
        const hx = cx - 2.0 + i * 1.0;
        m.box([hx - 0.05, 0, z + 1.6], [hx + 0.05, 0.8, z + 1.7], MAT.TRIM);
        m.box([hx - 0.05, 0, z + 2.4], [hx + 0.05, 0.8, z + 2.5], MAT.TRIM);
        m.box([hx - 0.05, 0.72, z + 1.6], [hx + 0.05, 0.8, z + 2.5], MAT.TRIM);
      }
    });
  }
  if (opts.bins !== false) {
    const bx = x0 + 3.6;
    m.painted(TINT.METAL_DARK, () => {
      m.box([bx - 1.5, 0, z + 1.2], [bx + 1.5, 1.5, z + 3.0], MAT.TRIM);
      m.box([bx - 1.65, 1.5, z + 1.05], [bx + 1.65, 1.66, z + 3.15], MAT.TRIM);
      for (let i = 0; i < 6; i++) {
        m.box([bx - 1.5, 0.3 + i * 0.2, z + 3.0], [bx + 1.5, 0.38 + i * 0.2, z + 3.06], MAT.TRIM);
      }
    });
  }
}

// -------------------------------------------------------- civic vocabulary
//
// Services are read by a different grammar from housing. A house is punched
// windows in a wall under a pitch; a civic building is a continuous ribbon of
// glass, a shading fin, a louvre bank, an exposed frame, a deep canopy. These
// are the parts that say "not a house" before anything else is drawn.

/**
 * A ribbon window: one continuous run of glazing with mullions across it,
 * rather than a row of separate holes.
 *
 * This single part does more than any other to stop a service building
 * reading as a large house, because punched openings in a wall are the
 * domestic signal and a horizontal band is the civic one.
 */
export function ribbon(m: MeshBuilder, w: Wall, u0: number, u1: number, y0: number, y1: number,
                       opts: { mullions?: number; sill?: boolean; head?: boolean } = {}): void {
  m.opening({
    axis: w.axis, sign: w.sign, plane: w.plane,
    u0, u1, y0, y1, glass: MAT.GLASS, frame: 0.13, proud: 0.07,
  });
  const n = opts.mullions ?? Math.max(1, Math.round((u1 - u0) / 1.8));
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 1; i < n; i++) {
      const px = u0 + (i / n) * (u1 - u0);
      slab(m, w, px - 0.055, px + 0.055, y0, y1, 0.02, 0.11, MAT.TRIM);
    }
  });
  // A continuous cill and head, which is what carries the horizontal.
  if (opts.sill !== false) slab(m, w, u0 - 0.2, u1 + 0.2, y0 - 0.22, y0, -0.02, 0.24, MAT.CONCRETE);
  if (opts.head !== false) slab(m, w, u0 - 0.2, u1 + 0.2, y1, y1 + 0.24, -0.02, 0.24, MAT.CONCRETE);
}

/** Vertical shading fins across an elevation. Cheap, and unmistakably civic. */
export function fins(m: MeshBuilder, w: Wall, u0: number, u1: number, y0: number, y1: number,
                     count: number, depth = 0.45): void {
  for (let i = 0; i <= count; i++) {
    const px = u0 + (i / count) * (u1 - u0);
    slab(m, w, px - 0.11, px + 0.11, y0, y1, 0.0, depth, MAT.CONCRETE);
  }
}

/** A bank of louvres: plant rooms, substations, anything that has to breathe. */
export function louvres(m: MeshBuilder, w: Wall, u0: number, u1: number, y0: number, y1: number,
                        pitch = 0.3): void {
  m.painted(TINT.METAL_DARK, () => {
    slab(m, w, u0 - 0.1, u1 + 0.1, y0 - 0.1, y1 + 0.1, 0.0, 0.1, MAT.TRIM);
    const n = Math.max(2, Math.floor((y1 - y0) / pitch));
    for (let i = 0; i < n; i++) {
      const y = y0 + i * ((y1 - y0) / n);
      slab(m, w, u0, u1, y, y + pitch * 0.55, 0.06, 0.22, MAT.TRIM);
    }
  });
}

/**
 * An exposed portal frame standing off a facade: columns and a beam.
 *
 * The structural gesture a civic building makes and a house never does.
 */
export function portal(m: MeshBuilder, x0: number, x1: number, z: number, height: number,
                       reach = 2.4, legs = 2): void {
  m.box([x0 - 0.3, height, z], [x1 + 0.3, height + 0.5, z + reach + 0.3], MAT.CONCRETE);
  for (let i = 0; i < legs; i++) {
    const px = legs === 1 ? (x0 + x1) / 2 : x0 + (i / (legs - 1)) * (x1 - x0);
    m.box([px - 0.24, 0, z + reach - 0.24], [px + 0.24, height, z + reach + 0.24], MAT.CONCRETE);
  }
}

/** Kerb line and a strip of pavement along one edge of the lot. */
export function kerb(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number): void {
  m.box([x0, 0.0001, z0], [x1, 0.14, z1], MAT.CONCRETE);
}

/**
 * The ground around a building: kerb, bollards, planters and a bin.
 *
 * Every asset gets a version of this. A building that stops at its own wall
 * reads as a model on a table; the thing that makes it read as a place is
 * fifty triangles of pavement furniture that has nothing to do with the
 * building at all.
 */
export function frontage(m: MeshBuilder, x0: number, x1: number, z: number, _seed: number, opts: {
  planters?: number;
  bollards?: number;
  bin?: boolean;
  depth?: number;
} = {}): void {
  const depth = opts.depth ?? 2.6;
  kerb(m, x0, z + depth - 0.4, x1, z + depth);

  const n = opts.bollards ?? 5;
  if (n > 0) bollards(m, { axis: 'z', sign: 1, plane: z }, x0 + 0.6, x1 - 0.6, depth - 0.9, n);

  // No trees here. Street planting is placed in the game, not baked into the
  // building -- a tree welded to an asset cannot be moved, cannot be removed,
  // and repeats identically down a street of the same building.
  const span = x1 - x0;
  const doorFrom = x0 + span * 0.37;
  const doorTo = x0 + span * 0.63;
  for (let i = 0; i < (opts.planters ?? 0); i++) {
    const px = x0 + 1.0 + i * 2.2;
    if (px > doorFrom && px < doorTo) continue;
    planter(m, px, z + 1.0, 0.55);
  }
  if (opts.bin !== false) {
    // A bin: body, lid and two wheels. Twenty triangles, and it is the sort of
    // thing whose absence is felt without being noticed.
    const bx = x1 - 1.6;
    m.painted(TINT.METAL_DARK, () => {
      m.box([bx - 0.42, 0.12, z + 0.5], [bx + 0.42, 1.15, z + 1.1], MAT.TRIM);
      m.box([bx - 0.46, 1.15, z + 0.46], [bx + 0.46, 1.28, z + 1.14], MAT.TRIM);
      for (const wx of [bx - 0.32, bx + 0.32]) {
        m.box([wx - 0.06, 0, z + 0.62], [wx + 0.06, 0.24, z + 0.86], MAT.TRIM);
      }
    });
  }
}

/** A run of railing: posts and two rails. */
export function railing(m: MeshBuilder, x0: number, x1: number, z: number, y: number, height = 1.05, spacing = 1.4): void {
  m.painted(TINT.METAL_DARK, () => {
    const n = Math.max(2, Math.round((x1 - x0) / spacing));
    for (let i = 0; i <= n; i++) {
      const px = x0 + (i / n) * (x1 - x0);
      m.box([px - 0.05, y, z - 0.05], [px + 0.05, y + height, z + 0.05], MAT.TRIM);
    }
    m.box([x0, y + height - 0.12, z - 0.04], [x1, y + height, z + 0.04], MAT.TRIM);
    m.box([x0, y + height * 0.45, z - 0.03], [x1, y + height * 0.45 + 0.08, z + 0.03], MAT.TRIM);
  });
}

/**
 * A front door, done properly.
 *
 * Doors were the weakest thing in the library: some buildings had none, and
 * the ones that did had a painted rectangle at whatever height the caller
 * happened to pass. A door is a threshold, a leaf set into a frame, a handle
 * and usually a fanlight -- and it always starts at the ground, because that
 * is what a door is for.
 */
export function entrance(m: MeshBuilder, w: Wall, centre: number, opts: {
  width?: number;
  height?: number;
  double?: boolean;
  fanlight?: boolean;
  canopy?: number;
  steps?: number;
  /** Shop door: a glazed leaf in a painted frame rather than a solid one. */
  glazed?: boolean;
} = {}): void {
  const halfW = (opts.width ?? 1.1) / 2;
  const h = opts.height ?? 2.25;
  const u0 = centre - halfW;
  const u1 = centre + halfW;
  const stepCount = opts.steps ?? 0;
  const sill = stepCount * 0.16;

  // Threshold slab, and steps up to it when the floor is raised.
  slab(m, w, u0 - 0.3, u1 + 0.3, 0.001, Math.max(sill, 0.05), 0.0, 0.5, MAT.CONCRETE);
  if (stepCount > 0) steps(m, w, u0 - 0.25, u1 + 0.25, stepCount);

  // Frame: two jambs and a head, standing proud of the wall.
  m.painted(TINT.DOOR, () => {
    slab(m, w, u0 - 0.14, u0, sill, sill + h + 0.14, 0.0, 0.12, MAT.TRIM);
    slab(m, w, u1, u1 + 0.14, sill, sill + h + 0.14, 0.0, 0.12, MAT.TRIM);
    slab(m, w, u0 - 0.14, u1 + 0.14, sill + h, sill + h + 0.14, 0.0, 0.12, MAT.TRIM);
    // Leaf, or two of them. A glazed leaf is a frame around glass: rails top
    // and bottom, a stile each side, and the glass added after this block.
    const leaves: Array<[number, number]> = opts.double === true
      ? [[u0, centre - 0.03], [centre + 0.03, u1]]
      : [[u0, u1]];
    for (const [a, b] of leaves) {
      if (opts.glazed === true) {
        slab(m, w, a, b, sill, sill + 0.34, 0.01, 0.08, MAT.TRIM);
        slab(m, w, a, b, sill + h - 0.22, sill + h, 0.01, 0.08, MAT.TRIM);
        slab(m, w, a, a + 0.09, sill, sill + h, 0.01, 0.08, MAT.TRIM);
        slab(m, w, b - 0.09, b, sill, sill + h, 0.01, 0.08, MAT.TRIM);
      } else {
        slab(m, w, a, b, sill, sill + h, 0.01, 0.08, MAT.TRIM);
      }
    }
  });
  if (opts.glazed === true) {
    for (const [a, b] of (opts.double === true
      ? [[u0, centre - 0.03], [centre + 0.03, u1]]
      : [[u0, u1]]) as Array<[number, number]>) {
      slab(m, w, a + 0.09, b - 0.09, sill + 0.34, sill + h - 0.22, 0.02, 0.05, MAT.SHOPFRONT);
    }
  }

  // Handle: two centimetres of geometry that makes the leaf read as a door.
  m.painted(TINT.METAL_DARK, () => {
    const hx = opts.double === true ? centre - 0.16 : u1 - 0.18;
    slab(m, w, hx - 0.03, hx + 0.03, sill + 1.0, sill + 1.24, 0.08, 0.14, MAT.TRIM);
  });

  if (opts.fanlight !== false) {
    // Glazed panel over the door, so the hall is not pitch dark.
    m.opening({
      axis: w.axis, sign: w.sign, plane: w.plane,
      u0, u1, y0: sill + h + 0.2, y1: sill + h + 0.75,
      glass: MAT.GLASS, frame: 0.09, proud: 0.06,
    });
  }
  if (opts.canopy !== undefined) {
    slab(m, w, u0 - 0.5, u1 + 0.5, sill + h + 0.95, sill + h + 1.25, 0.0, opts.canopy, MAT.CONCRETE);
  }
}

/**
 * A back garden: fence, lawn, patio, shed and a washing line.
 *
 * Low-density housing looks unfinished without one, because a detached house
 * in the real world is mostly garden. Everything sits inside the lot the
 * caller passes.
 */
export function backyard(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number, _seed: number): void {
  const w = x1 - x0;
  const d = z1 - z0;
  if (w < 3 || d < 3) return;

  // Lawn, then a paved patio against the house.
  m.painted(TINT.GREEN, () => m.box([x0, 0.001, z0], [x1, 0.06, z1], MAT.TRIM));
  m.box([x0 + 0.4, 0.002, z1 - Math.min(2.6, d * 0.4)], [x1 - 0.4, 0.07, z1], MAT.CONCRETE);

  // Close-boarded fence on three sides: posts and a rail, which is enough.
  m.painted(TINT.WOOD, () => {
    const post = (px: number, pz: number): void => {
      m.box([px - 0.07, 0, pz - 0.07], [px + 0.07, 1.75, pz + 0.07], MAT.TRIM);
    };
    const runs: Array<[number, number, number, number]> = [
      [x0, z0, x1, z0], [x0, z0, x0, z1], [x1, z0, x1, z1],
    ];
    for (const [ax, az, bx, bz] of runs) {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(2, Math.round(len / 1.9));
      for (let i = 0; i <= n; i++) {
        post(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n);
      }
      m.box([Math.min(ax, bx) - 0.06, 0, Math.min(az, bz) - 0.06],
            [Math.max(ax, bx) + 0.06, 1.62, Math.max(az, bz) + 0.06], MAT.TRIM);
    }
  });

  // Shed in a back corner.
  const sx = x0 + 0.7;
  const sz = z0 + 0.7;
  m.painted(TINT.WOOD, () => m.box([sx, 0, sz], [sx + 2.3, 2.0, sz + 1.9], MAT.TRIM));
  m.gable([sx - 0.12, 2.0, sz - 0.12], [sx + 2.42, 2.0, sz + 2.02], 0.55, 'x', MAT.ROOF_TILE, MAT.TRIM);

  // Washing line between two posts.
  m.painted(TINT.METAL_DARK, () => {
    for (const px of [x0 + 3.4, x1 - 1.0]) {
      m.box([px - 0.05, 0, z0 + d * 0.55], [px + 0.05, 1.8, z0 + d * 0.55 + 0.1], MAT.TRIM);
    }
    m.box([x0 + 3.4, 1.72, z0 + d * 0.55], [x1 - 1.0, 1.78, z0 + d * 0.55 + 0.06], MAT.TRIM);
  });

  // A couple of garden chairs on the patio.
  m.painted(TINT.METAL_DARK, () => {
    for (const cx of [x0 + w * 0.45, x0 + w * 0.62]) {
      m.box([cx - 0.22, 0.07, z1 - 1.4], [cx + 0.22, 0.46, z1 - 0.96], MAT.TRIM);
      m.box([cx - 0.22, 0.46, z1 - 1.4], [cx + 0.22, 0.95, z1 - 1.28], MAT.TRIM);
    }
  });
}
