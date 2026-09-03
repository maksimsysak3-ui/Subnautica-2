/**
 * Theme-driven building parts.
 *
 * The pieces every themed generator is made of: the roof the theme calls for,
 * its window rhythm and what hangs beside the windows, its front door, its
 * veranda or its boundary wall, and the crown it puts on a tall block. Housing,
 * shops, offices and works all draw from here, which is what makes a district
 * of four zones read as one place rather than four.
 */

import { MAT, TINT, MeshBuilder } from './mesh';
import { hip, mansard, dormer, brackets } from './themes';
import type { ThemeProfile } from './themes';
import { entrance, parapet, railing, ring, roofClutter, windowGrid } from './parts';
import type { Wall } from './parts';

/** The roof the theme calls for, over a footprint. */
export function roofOver(m: MeshBuilder, T: ThemeProfile, x0: number, z0: number, x1: number, z1: number,
                  y: number, opts: { dormers?: number; along?: 'x' | 'z' } = {}): number {
  const w = x1 - x0, d = z1 - z0;
  const e = T.eave;
  const ax0 = x0 - e, az0 = z0 - e, ax1 = x1 + e, az1 = z1 + e;
  const span = Math.min(w, d) + e * 2;
  const along = opts.along ?? (w >= d ? 'x' : 'z');

  if (T.roof === 'flat') {
    m.box([ax0, y, az0], [ax1, y + 0.12, az1], T.cover);
    parapet(m, ax0, az0, ax1, az1, y + 0.12, 0.8, 0.14, T.wall);
    return y + 0.92;
  }
  // Eaves: a thin overhanging slab. A roof flush with the wall reads as a lid.
  m.box([ax0, y - 0.26, az0], [ax1, y, az1], T.trim);
  if (T.roof === 'hip') {
    const h = span * T.pitch;
    hip(m, ax0, az0, ax1, az1, y, h, T.cover);
    if (e > 0.5) brackets(m, x0, z0, x1, z1, y, e);
    return y + h;
  }
  if (T.roof === 'mansard') {
    const h = span * T.pitch;
    mansard(m, ax0, az0, ax1, az1, y, h, T.cover, T.wall);
    return y + h;
  }
  const h = span * T.pitch;
  m.gable([ax0, y, az0], [ax1, y, az1], h, along, T.cover, T.wall);
  const n = opts.dormers ?? 0;
  for (let i = 0; i < n; i++) {
    const cx = x0 + ((i + 0.5) / n) * w;
    if (along === 'x') dormer(m, cx, az1 - Math.min(d, w) * 0.22, 1, y + h * 0.34, T);
  }
  return y + h;
}

/**
 * Windows in the theme's rhythm, with whatever the theme hangs beside them.
 *
 * The shutter and the grille are the cheapest tells in the library: the same
 * wall with the same holes in it reads as Provence or as Kowloon depending on
 * which of the two it gets.
 */
export function punched(m: MeshBuilder, T: ThemeProfile, w: Wall, u0: number, u1: number,
                 o: { floors: number; base: number; skipGround?: boolean }): void {
  const span = u1 - u0;
  const count = Math.max(1, Math.round((span / 6) * T.rhythm));
  const first = o.skipGround ? 1 : 0;
  // A framed opening is four boxes and forty-odd triangles. That is right for
  // a house and ruinous for a sixteen-storey block: the same wall would cost
  // more than the whole building's budget. Above a few dozen openings the
  // frame becomes a continuous lintel and cill per storey -- which is what a
  // repetitive facade actually looks like anyway -- and the glass a quad.
  const lite = (o.floors - first) * count > 22;
  for (let f = first; f < o.floors; f++) {
    const y0 = o.base + f * T.floorH;
    if (!lite) {
      windowGrid(m, w, u0, u1, {
        floors: 1, floorH: T.floorH, base: y0, count,
        width: T.winW, height: T.winH, sill: true,
      });
    } else {
      const d0 = w.plane + w.sign * 0.012;
      for (let i = 0; i < count; i++) {
        const c = u0 + ((i + 0.5) / count) * span;
        const a = c - T.winW / 2, b = c + T.winW / 2;
        if (w.axis === 'x') {
          if (w.sign > 0) m.signFace([d0, y0, b], [d0, y0, a], [d0, y0 + T.winH, a], [d0, y0 + T.winH, b], MAT.PANE);
          else m.signFace([d0, y0, a], [d0, y0, b], [d0, y0 + T.winH, b], [d0, y0 + T.winH, a], MAT.PANE);
        } else if (w.sign > 0) {
          m.signFace([a, y0, d0], [b, y0, d0], [b, y0 + T.winH, d0], [a, y0 + T.winH, d0], MAT.PANE);
        } else {
          m.signFace([b, y0, d0], [a, y0, d0], [a, y0 + T.winH, d0], [b, y0 + T.winH, d0], MAT.PANE);
        }
      }
      // Continuous cill and lintel, standing proud so they cast the reveal.
      const p0 = w.plane + w.sign * 0.02, p1 = w.plane + w.sign * 0.15;
      const lo = Math.min(p0, p1), hi = Math.max(p0, p1);
      for (const [ya, yb] of [[y0 - 0.14, y0], [y0 + T.winH, y0 + T.winH + 0.16]] as const) {
        if (w.axis === 'x') m.box([lo, ya, u0], [hi, yb, u1], T.trim);
        else m.box([u0, ya, lo], [u1, yb, hi], T.trim);
      }
    }
    // Shutters and grilles are detail for the lower storeys; nobody reads one
    // at the sixteenth floor and every one of them costs ten triangles.
    if ((!T.shutters && !T.grille) || (lite && f > first + 2) || o.base > 6) continue;
    for (let i = 0; i < count; i++) {
      const c = u0 + ((i + 0.5) / count) * span;
      if (T.shutters) {
        m.painted(TINT.DOOR, () => {
          for (const s of [-1, 1]) {
            const a = c + s * (T.winW / 2 + 0.14);
            const b = a + s * T.winW * 0.5;
            const [lo, hi] = [Math.min(a, b), Math.max(a, b)];
            if (w.axis === 'x') m.box([w.plane + w.sign * 0.02, y0, lo], [w.plane + w.sign * 0.13, y0 + T.winH, hi], MAT.TRIM);
            else m.box([lo, y0, w.plane + w.sign * 0.02], [hi, y0 + T.winH, w.plane + w.sign * 0.13], MAT.TRIM);
          }
        });
      } else {
        // Security grille: five bars across the opening, proud of the glass.
        m.painted(TINT.METAL_DARK, () => {
          for (let k = 0; k < 5; k++) {
            const p = c - T.winW / 2 + ((k + 0.5) / 5) * T.winW;
            if (w.axis === 'x') m.box([w.plane + w.sign * 0.08, y0 + 0.05, p - 0.03], [w.plane + w.sign * 0.14, y0 + T.winH - 0.05, p + 0.03], MAT.TRIM);
            else m.box([p - 0.03, y0 + 0.05, w.plane + w.sign * 0.08], [p + 0.03, y0 + T.winH - 0.05, w.plane + w.sign * 0.14], MAT.TRIM);
          }
        });
      }
    }
  }
}

/**
 * Glazing bands, for the themes and densities that take ribbon windows.
 *
 * Drawn rather than framed. A framed ribbon is four boxes plus a mullion box
 * every 1.8m, which on a fourteen-storey tower with four elevations is more
 * triangles than the rest of the building put together. A quad of glass, a
 * spandrel below it and three mullions read the same from anywhere the game
 * is played from.
 */
export function banded(m: MeshBuilder, T: ThemeProfile, w: Wall, u0: number, u1: number,
                floors: number, base: number): void {
  const p = w.plane + w.sign * 0.02;
  const lo = Math.min(p, w.plane + w.sign * 0.16), hi = Math.max(p, w.plane + w.sign * 0.16);
  const mull = Math.max(2, Math.min(5, Math.round((u1 - u0) / 3.4)));
  for (let f = 0; f < floors; f++) {
    const y0 = base + f * T.floorH + 0.8;
    const y1 = base + (f + 1) * T.floorH - 0.42;
    const g = w.plane + w.sign * 0.05;
    if (w.axis === 'x') {
      if (w.sign > 0) m.signFace([g, y0, u1], [g, y0, u0], [g, y1, u0], [g, y1, u1], MAT.PANE);
      else m.signFace([g, y0, u0], [g, y0, u1], [g, y1, u1], [g, y1, u0], MAT.PANE);
      m.box([lo, y1, u0 - 0.1], [hi, base + (f + 1) * T.floorH + 0.8, u1 + 0.1], T.trim);
      for (let i = 1; i < mull; i++) {
        const pu = u0 + (i / mull) * (u1 - u0);
        m.box([lo, y0, pu - 0.06], [hi, y1, pu + 0.06], T.trim);
      }
    } else {
      if (w.sign > 0) m.signFace([u0, y0, g], [u1, y0, g], [u1, y1, g], [u0, y1, g], MAT.PANE);
      else m.signFace([u1, y0, g], [u0, y0, g], [u0, y1, g], [u1, y1, g], MAT.PANE);
      m.box([u0 - 0.1, y1, lo], [u1 + 0.1, base + (f + 1) * T.floorH + 0.8, hi], T.trim);
      for (let i = 1; i < mull; i++) {
        const pu = u0 + (i / mull) * (u1 - u0);
        m.box([pu - 0.06, y0, lo], [pu + 0.06, y1, hi], T.trim);
      }
    }
  }
}

/** Whatever the theme puts at the front door. */
export function doorway(m: MeshBuilder, T: ThemeProfile, w: Wall, centre: number, grand = false): void {
  entrance(m, w, centre, {
    width: grand ? 2.4 : 1.15, height: grand ? 2.9 : 2.25, double: grand,
    fanlight: T.id === 'european' || T.id === 'farming',
    glazed: T.id === 'modern' || grand,
    steps: T.id === 'american' ? 3 : T.id === 'european' ? 2 : 1,
    ...(T.id === 'modern' || T.id === 'asian' ? { canopy: 1.6 } : {}),
  });
}

/** A veranda across a front, which is the North American tell. */
export function veranda(m: MeshBuilder, T: ThemeProfile, x0: number, x1: number, z: number, depth: number, y: number): void {
  m.box([x0, 0.02, z], [x1, 0.42, z + depth], MAT.CONCRETE);
  m.box([x0 - 0.2, y, z - 0.1], [x1 + 0.2, y + 0.28, z + depth + 0.2], T.trim);
  m.gable([x0 - 0.2, y + 0.28, z - 0.1], [x1 + 0.2, y + 0.28, z + depth + 0.2], 0.5, 'x', T.cover, T.trim);
  const n = Math.max(2, Math.round((x1 - x0) / 2.6));
  for (let i = 0; i <= n; i++) {
    const px = x0 + (i / n) * (x1 - x0);
    m.box([px - 0.11, 0.42, z + depth - 0.32], [px + 0.11, y, z + depth - 0.1], T.trim);
  }
  railing(m, x0 + 0.2, x1 - 0.2, z + depth - 0.2, 0.42, 0.95, 1.2);
}

/** A boundary wall with a gate, which is what makes a compound a compound. */
export function compound(m: MeshBuilder, T: ThemeProfile, x0: number, z0: number, x1: number, z1: number, h: number): void {
  const gx0 = (x0 + x1) / 2 - 1.6, gx1 = (x0 + x1) / 2 + 1.6;
  const wall = (a: number, b: number, c: number, d: number): void => m.box([a, 0, c], [b, h, d], T.base);
  wall(x0, gx0, z1 - 0.22, z1);
  wall(gx1, x1, z1 - 0.22, z1);
  wall(x0, x1, z0, z0 + 0.22);
  wall(x0, x0 + 0.22, z0, z1);
  wall(x1 - 0.22, x1, z0, z1);
  ring(m, x0, z0, x1, z1, h, 0.12, 0.07, T.trim);
  // Gate piers and leaves.
  for (const px of [gx0, gx1]) m.box([px - 0.3, 0, z1 - 0.34], [px + 0.3, h + 0.5, z1 + 0.12], T.base);
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i < 9; i++) {
      const px = gx0 + 0.35 + (i / 8) * (gx1 - gx0 - 0.7);
      m.box([px - 0.045, 0.05, z1 - 0.12], [px + 0.045, h * 0.92, z1 - 0.04], MAT.TRIM);
    }
    m.box([gx0 + 0.3, h * 0.86, z1 - 0.12], [gx1 - 0.3, h * 0.92, z1 - 0.04], MAT.TRIM);
  });
}

/** The crown a tall block gets, which differs by theme as much as its base. */
export function crown(m: MeshBuilder, T: ThemeProfile, x0: number, z0: number, x1: number, z1: number,
               y: number, seed: number): number {
  switch (T.id) {
    case 'european': {
      const h = Math.min(x1 - x0, z1 - z0) * 0.26;
      mansard(m, x0, z0, x1, z1, y, h, T.cover, T.wall);
      return y + h;
    }
    case 'asian': {
      // A hipped cap on a set-back attic storey: the Asian residential tower
      // crown, and the reason those skylines are not flat.
      const i = Math.min(x1 - x0, z1 - z0) * 0.14;
      m.box([x0 + i, y, z0 + i], [x1 - i, y + 2.6, z1 - i], T.wall, { roof: T.cover });
      const h = Math.min(x1 - x0, z1 - z0) * 0.2;
      hip(m, x0 + i - 0.7, z0 + i - 0.7, x1 - i + 0.7, z1 - i + 0.7, y + 2.6, h, T.cover);
      parapet(m, x0, z0, x1, z1, y, 1.0, 0.14, T.wall);
      return y + 2.6 + h;
    }
    case 'farming': {
      const h = Math.min(x1 - x0, z1 - z0) * 0.34;
      m.gable([x0, y, z0], [x1, y, z1], h, x1 - x0 >= z1 - z0 ? 'x' : 'z', T.cover, T.wall);
      return y + h;
    }
    case 'american': {
      parapet(m, x0, z0, x1, z1, y, 1.1, 0.2, T.base);
      // Water tank on a frame, the New York roofscape in one object.
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      m.painted(TINT.WOOD, () => m.cylinder(cx, cz, 1.7, y + 2.6, y + 6.0, 10, MAT.TIMBER));
      m.cone(cx, cz, 1.7, 0, y + 6.0, y + 7.1, 10, T.cover);
      m.painted(TINT.METAL_DARK, () => {
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          m.pipe([cx + sx * 1.3, y, cz + sz * 1.3], [cx + sx * 1.3, y + 2.6, cz + sz * 1.3], 0.09, MAT.TRIM, 5);
        }
      });
      roofClutter(m, x0 + 1.5, z0 + 1.5, x1 - 1.5, z1 - 1.5, y, seed, 0.7);
      return y + 7.1;
    }
    default: {
      // Modern: a set-back plant enclosure behind a slim parapet.
      parapet(m, x0, z0, x1, z1, y, 1.05, 0.12, T.trim);
      const i = Math.min(x1 - x0, z1 - z0) * 0.2;
      m.box([x0 + i, y, z0 + i], [x1 - i, y + 3.0, z1 - i], MAT.CLADDING, { roof: MAT.ROOF });
      ring(m, x0 + i, z0 + i, x1 - i, z1 - i, y + 3.0, 0.14, 0.1, T.trim);
      roofClutter(m, x0 + 1.4, z0 + 1.4, x1 - 1.4, z1 - 1.4, y, seed, 0.8);
      return y + 3.0;
    }
  }
}

