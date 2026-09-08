/**
 * The pieces a landmark is made of.
 *
 * The rest of the library is a spawner's stock: a hundred and ninety
 * prototypes that have to survive being repeated down a street, so each one is
 * modest and the variety comes from the theme and the seed. A signature
 * building is the opposite trade. There is one of it in the city, everyone
 * looks at it, and it has to be recognisable from the far side of the map --
 * so it is allowed a shape nothing else has and five times the triangles.
 *
 * What they still share is this kit. Twenty-four bespoke generators is
 * twenty-four places to get a curtain wall wrong, and a curtain wall is the
 * same object on a supertall and on a department store. So the parts that are
 * genuinely general live here, and what each generator writes is only what
 * makes its building that building.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { Material, Tint, Vec3 } from '../mesh';
import { bench, tree } from './landscape';
import { planter, railing } from '../parts';
import { figure } from './vehicles';

/** A closed loop of points in plan, counter-clockwise. Shared with the venues. */
export type Ring = Array<[number, number]>;

// -------------------------------------------------------------------- plans

/**
 * A rounded rectangle as `n` points, by the same superellipse the venues use.
 *
 * `round` is how much of the half-width the corner takes: 0 a sharp box, 1 an
 * ellipse. A tower's plan is the one decision that changes everything above
 * it, and having it as a ring rather than a pair of extents is what lets a
 * shaft taper, twist or step without any of the rest of the code caring.
 */
export function plan(hx: number, hz: number, round: number, n: number): Ring {
  const out: Ring = [];
  const e = 2 / Math.max(0.02, round);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    const k = Math.pow(Math.pow(Math.abs(c), e) + Math.pow(Math.abs(s), e), -1 / e);
    out.push([hx * k * c, hz * k * s]);
  }
  return out;
}

/** A plan scaled about the origin, and optionally spun about it. */
export function scaled(r: Ring, sx: number, sz = sx, turn = 0): Ring {
  const c = Math.cos(turn), s = Math.sin(turn);
  return r.map(([x, z]) => [(x * sx) * c - (z * sz) * s, (x * sx) * s + (z * sz) * c] as [number, number]);
}

/** A vertical skin between one ring at `y0` and another at `y1`. */
export function loft(m: MeshBuilder, a: Ring, b: Ring, y0: number, y1: number, mat: Material,
  inward = false): void {
  const n = a.length;
  for (let i = 0; i < n; i++) {
    const p = a[i], q = a[(i + 1) % n];
    const r = b[i], t = b[(i + 1) % n];
    if (inward) m.quad([p[0], y0, p[1]], [q[0], y0, q[1]], [t[0], y1, t[1]], [r[0], y1, r[1]], mat);
    else m.quad([q[0], y0, q[1]], [p[0], y0, p[1]], [r[0], y1, r[1]], [t[0], y1, t[1]], mat);
  }
}

/** A flat ring between two plans: a setback, a canopy, a slab edge. */
export function shelf(m: MeshBuilder, inner: Ring, outer: Ring, y0: number, y1: number,
  mat: Material): void {
  const n = inner.length;
  for (let i = 0; i < n; i++) {
    const a = inner[i], b = inner[(i + 1) % n];
    const c = outer[i], d = outer[(i + 1) % n];
    m.quad([a[0], y1, a[1]], [b[0], y1, b[1]], [d[0], y1, d[1]], [c[0], y1, c[1]], mat);
    if (y1 > y0) {
      m.quad([d[0], y0, d[1]], [c[0], y0, c[1]], [c[0], y1, c[1]], [d[0], y1, d[1]], mat);
    }
  }
}

/** A lid over a plan, as a fan from its centroid. */
export function cap(m: MeshBuilder, r: Ring, y: number, mat: Material): void {
  let cx = 0, cz = 0;
  for (const p of r) { cx += p[0]; cz += p[1]; }
  cx /= r.length; cz /= r.length;
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length];
    m.tri([cx, y, cz], [b[0], y, b[1]], [a[0], y, a[1]], mat);
  }
}

// ------------------------------------------------------------------ facades

/**
 * A curtain wall: glass between expressed slab edges, with mullions.
 *
 * The single most-used surface in this file. What separates a tower from an
 * extruded rectangle is that you can count its floors, and you can only count
 * them if the slab edge is a solid band standing proud of the glass. Mullions
 * do the same job the other way round.
 */
export function curtain(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number,
  base: number, floors: number, floorH: number, opts: {
    glass?: Material; frame?: Material; band?: number; mullions?: number;
    spandrel?: Material;
  } = {}): void {
  const glass = opts.glass ?? MAT.GLASS;
  const frame = opts.frame ?? MAT.DARK_TRIM;
  const bandH = opts.band ?? 0.5;
  m.box([x0, base, z0], [x1, base + floors * floorH, z1], opts.spandrel ?? glass);
  m.painted(TINT.METAL_DARK, () => {
    for (let f = 0; f <= floors; f++) {
      const y = base + f * floorH;
      m.box([x0 - 0.14, y - bandH / 2, z0 - 0.14], [x1 + 0.14, y + bandH / 2, z1 + 0.14], frame);
    }
    const step = opts.mullions ?? 3.2;
    for (let x = x0 + step; x < x1 - 0.1; x += step) {
      m.box([x - 0.07, base, z0 - 0.1], [x + 0.07, base + floors * floorH, z0 + 0.02], frame);
      m.box([x - 0.07, base, z1 - 0.02], [x + 0.07, base + floors * floorH, z1 + 0.1], frame);
    }
    for (let z = z0 + step; z < z1 - 0.1; z += step) {
      m.box([x0 - 0.1, base, z - 0.07], [x0 + 0.02, base + floors * floorH, z + 0.07], frame);
      m.box([x1 - 0.02, base, z - 0.07], [x1 + 0.1, base + floors * floorH, z + 0.07], frame);
    }
  });
}

/**
 * A masonry shaft with piers between the window bays.
 *
 * The pre-war counterpart of `curtain`: the wall is the structure, so the
 * vertical piers are deep and continuous and the spandrel between floors is
 * recessed. That single difference is most of what makes a 1930s tower look
 * 1930s next to a 1990s one of the same massing.
 */
export function pierWall(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number,
  base: number, floors: number, floorH: number, wall: Material, opts: {
    bays?: number; glass?: Material; depth?: number;
    /** Draw the openings. Off at LOD1 and below: they are most of the mesh. */
    windows?: boolean;
    /**
     * Vertical glazing strips instead of a punched window per floor.
     *
     * The pre-war tall building's own answer, and it is both cheaper and more
     * accurate: the glass runs the full height of the bay between two piers,
     * with a spandrel panel banding across it at each floor. A hundred-and-
     * seventy metre tower drawn with punched openings is four hundred windows
     * and twenty thousand triangles; the same tower in strips is a tenth of
     * that and reads as more of a period building, not less.
     */
    strips?: boolean;
  } = {}): void {
  const glass = opts.glass ?? MAT.PANE;
  const d = opts.depth ?? 0.34;
  const top = base + floors * floorH;
  m.box([x0, base, z0], [x1, top, z1], wall);
  const runs: Array<[number, number, 'x' | 'z']> = [
    [x0, x1, 'x'], [z0, z1, 'z'],
  ];
  void runs;
  const bays = opts.bays ?? Math.max(2, Math.round((x1 - x0) / 4.2));
  const bz = Math.max(2, Math.round((z1 - z0) / 4.2));
  const pier = (a: number, b: number, count: number, along: 'x' | 'z'): void => {
    for (let i = 0; i <= count; i++) {
      const u = a + (i / count) * (b - a);
      const w = 0.55;
      if (along === 'x') {
        m.box([u - w, base, z0 - d], [u + w, top + 0.6, z0], wall);
        m.box([u - w, base, z1], [u + w, top + 0.6, z1 + d], wall);
      } else {
        m.box([x0 - d, base, u - w], [x0, top + 0.6, u + w], wall);
        m.box([x1, base, u - w], [x1 + d, top + 0.6, u + w], wall);
      }
    }
  };
  pier(x0, x1, bays, 'x');
  pier(z0, z1, bz, 'z');
  if (opts.windows === false) return;
  if (opts.strips === true) {
    const strip = (axis: 'x' | 'z', a: number, b: number, count: number,
      p0: number, p1: number): void => {
      for (let i = 0; i < count; i++) {
        const u0 = a + (i / count) * (b - a) + 0.75, u1 = a + ((i + 1) / count) * (b - a) - 0.75;
        for (const pln of [p0, p1]) {
          if (axis === 'z') m.box([u0, base, pln - 0.06], [u1, top, pln + 0.06], glass);
          else m.box([pln - 0.06, base, u0], [pln + 0.06, top, u1], glass);
        }
      }
      for (let f = 1; f < floors; f++) {
        const y = base + f * floorH;
        for (const pln of [p0, p1]) {
          const out = pln === p0 ? -0.1 : 0.1;
          if (axis === 'z') m.box([a, y - 0.75, pln + out], [b, y - 0.1, pln - out], wall);
          else m.box([pln + out, y - 0.75, a], [pln - out, y - 0.1, b], wall);
        }
      }
    };
    strip('z', x0 + 0.4, x1 - 0.4, bays, z0 - 0.02, z1 + 0.02);
    strip('x', z0 + 0.4, z1 - 0.4, bz, x0 - 0.02, x1 + 0.02);
    return;
  }
  for (let f = 0; f < floors; f++) {
    const y = base + f * floorH;
    for (const [sign, pz] of [[1, z1], [-1, z0]] as const) {
      m.windowRow({
        axis: 'z', sign, plane: pz, from: x0 + 0.4, to: x1 - 0.4,
        y0: y + 0.9, y1: y + floorH - 0.5, count: bays, width: (x1 - x0) / bays - 1.5,
        glass, frame: 0.1, proud: 0.06,
      });
    }
    for (const [sign, px] of [[1, x1], [-1, x0]] as const) {
      m.windowRow({
        axis: 'x', sign, plane: px, from: z0 + 0.4, to: z1 - 0.4,
        y0: y + 0.9, y1: y + floorH - 0.5, count: bz, width: (z1 - z0) / bz - 1.5,
        glass, frame: 0.1, proud: 0.06,
      });
    }
  }
}

/**
 * Balconies on every floor of one elevation, with a solid or glazed front.
 *
 * `wave` bends the run: each floor's projection follows a sine, which is the
 * whole idea behind a certain kind of residential tower and costs one term.
 */
export function balconyStack(m: MeshBuilder, x0: number, x1: number, z: number, sign: 1 | -1,
  base: number, floors: number, floorH: number, opts: {
    depth?: number; wave?: number; glazed?: boolean; bays?: number;
  } = {}): void {
  const depth = opts.depth ?? 1.7;
  const bays = opts.bays ?? Math.max(2, Math.round((x1 - x0) / 5.5));
  for (let f = 0; f < floors; f++) {
    const y = base + f * floorH;
    for (let i = 0; i < bays; i++) {
      const a = x0 + (i / bays) * (x1 - x0) + 0.25;
      const b = x0 + ((i + 1) / bays) * (x1 - x0) - 0.25;
      const t = opts.wave === undefined ? 1
        : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(f * 0.75 + (i / bays) * Math.PI * 2 * opts.wave));
      const d = depth * t;
      const p0 = sign > 0 ? z : z - d;
      const p1 = sign > 0 ? z + d : z;
      m.box([a, y, p0], [b, y + 0.16, p1], MAT.CONCRETE, { skipBottom: false });
      if (opts.glazed === false) {
        m.painted(TINT.METAL_DARK, () => {
          m.box([a, y + 0.16, sign > 0 ? p1 - 0.1 : p0], [b, y + 1.15, sign > 0 ? p1 : p0 + 0.1], MAT.TRIM);
        });
      } else {
        m.box([a, y + 0.16, sign > 0 ? p1 - 0.06 : p0], [b, y + 1.2, sign > 0 ? p1 : p0 + 0.06], MAT.GLASS);
      }
    }
  }
}

// --------------------------------------------------------------------- tops

/**
 * A crown: a run of setbacks, then a lantern and a mast.
 *
 * A tower that stops dead is a column with the top sawn off. `steps` setbacks
 * each take a bite out of the plan, the lantern is lit, and the mast is what
 * puts the building on the skyline from four kilometres away.
 */
export function crownStack(m: MeshBuilder, hx: number, hz: number, y: number, steps: number,
  mat: Material, opts: { mast?: number; lantern?: boolean; taper?: number } = {}): number {
  let ax = hx, az = hz, top = y;
  const taper = opts.taper ?? 0.78;
  for (let i = 0; i < steps; i++) {
    const h = 3.2 - i * 0.35;
    m.box([-ax, top, -az], [ax, top + h, az], mat, { roof: MAT.ROOF });
    m.painted(TINT.METAL_DARK, () => {
      m.box([-ax - 0.3, top + h - 0.45, -az - 0.3], [ax + 0.3, top + h, az + 0.3], MAT.TRIM);
    });
    top += h;
    ax *= taper; az *= taper;
  }
  if (opts.lantern !== false) {
    m.box([-ax, top, -az], [ax, top + ax * 2.4, az], MAT.GLASS);
    m.painted(TINT.SIGN_LIT, () => {
      m.box([-ax * 0.5, top + ax * 2.4, -az * 0.5], [ax * 0.5, top + ax * 2.9, az * 0.5], MAT.PLATE);
    });
    top += ax * 2.9;
  }
  if (opts.mast !== undefined && opts.mast > 0) {
    m.painted(TINT.METAL_DARK, () => {
      m.cylinder(0, 0, 0.42, top, top + opts.mast! * 0.55, 6, MAT.TRIM, false);
      m.cylinder(0, 0, 0.2, top + opts.mast! * 0.55, top + opts.mast!, 5, MAT.TRIM, false);
    });
    m.painted(TINT.SIGN_LIT, () => {
      m.box([-0.35, top + opts.mast! * 0.5, -0.35], [0.35, top + opts.mast! * 0.5 + 0.5, 0.35], MAT.LAMP);
    });
    top += opts.mast;
  }
  return top;
}

/** A glazed barrel vault: the roof over an atrium, an arcade, a train shed. */
export function barrelVault(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number,
  y: number, rise: number, segs: number, opts: { ribs?: number; glass?: Material } = {}): void {
  const glass = opts.glass ?? MAT.GLASS;
  const cz = (z0 + z1) / 2, r = (z1 - z0) / 2;
  const at = (i: number): [number, number] => {
    const a = Math.PI * (i / segs);
    return [cz - Math.cos(a) * r, y + Math.sin(a) * rise];
  };
  for (let i = 0; i < segs; i++) {
    const [za, ya] = at(i), [zb, yb] = at(i + 1);
    // Wound so the face points out of the vault. The other way round the
    // whole roof back-face culls and you look at the underside of the far
    // half, which renders as a black lid over a lit street.
    m.quad([x1, ya, za], [x0, ya, za], [x0, yb, zb], [x1, yb, zb], glass);
  }
  const ribs = opts.ribs ?? Math.max(2, Math.round((x1 - x0) / 5));
  m.painted(TINT.METAL_DARK, () => {
    for (let k = 0; k <= ribs; k++) {
      const x = x0 + (k / ribs) * (x1 - x0);
      for (let i = 0; i < segs; i++) {
        const [za, ya] = at(i), [zb, yb] = at(i + 1);
        m.pipe([x, ya, za], [x, yb, zb], 0.16, MAT.TRIM, 4);
      }
    }
    // The two end arches, which is what stops a vault reading as a tube.
    for (const x of [x0, x1]) {
      for (let i = 0; i < segs; i++) {
        const [za, ya] = at(i), [zb, yb] = at(i + 1);
        m.pipe([x, ya, za], [x, yb, zb], 0.24, MAT.TRIM, 5);
      }
    }
  });
}

/** North-light saw-tooth roof: the one roof shape that is only ever a factory. */
export function sawtooth(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number,
  y: number, bays: number, rise: number, mat: Material): void {
  const w = (z1 - z0) / bays;
  for (let i = 0; i < bays; i++) {
    const a = z0 + i * w, b = a + w;
    const ridge = b - w * 0.25;
    // The long slope, then the vertical-ish north light behind it. Both wound
    // to face up and out; the other way round the roof is a hole.
    m.quad([x1, y, a], [x0, y, a], [x0, y + rise, ridge], [x1, y + rise, ridge], mat);
    m.quad([x0, y + rise, ridge], [x0, y, b], [x1, y, b], [x1, y + rise, ridge], MAT.GLASS);
    // Closing triangles at both ends, so the roof is a solid rather than a comb.
    m.tri([x0, y, a], [x0, y + rise, ridge], [x0, y, b], mat);
    m.tri([x1, y, b], [x1, y + rise, ridge], [x1, y, a], mat);
  }
}

// ------------------------------------------------------------------- ground

/**
 * The ground a landmark stands on: paving, kerb, planting, seats, lamps, and
 * people using it.
 *
 * A signature building on bare grey is a model on a table. Half of what makes
 * one look like a place is the twenty metres in front of it, and it is the
 * same twenty metres every time.
 */
export function forecourt(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number,
  seed: number, opts: { trees?: number; lamps?: number; people?: number; benches?: number } = {}): void {
  m.box([x0, 0.0005, z0], [x1, 0.09, z1], MAT.GROUND);
  m.painted(TINT.NONE, () => {
    m.box([x0 - 0.25, 0.0005, z0 - 0.25], [x1 + 0.25, 0.16, z0], MAT.CONCRETE);
    m.box([x0 - 0.25, 0.0005, z1], [x1 + 0.25, 0.16, z1 + 0.25], MAT.CONCRETE);
    m.box([x0 - 0.25, 0.0005, z0], [x0, 0.16, z1], MAT.CONCRETE);
    m.box([x1, 0.0005, z0], [x1 + 0.25, 0.16, z1], MAT.CONCRETE);
  });
  let n = seed | 0;
  const rnd = (): number => { n = (n * 1103515245 + 12345) & 0x7fffffff; return (n >> 8) / 8388608; };
  const trees = opts.trees ?? 4;
  for (let i = 0; i < trees; i++) {
    const x = x0 + 2.5 + rnd() * (x1 - x0 - 5);
    const z = z0 + 2.0 + rnd() * (z1 - z0 - 4);
    tree(m, x, z, 6.5 + rnd() * 3.5, 2.2 + rnd());
    m.painted(TINT.NONE, () => m.box([x - 1.1, 0.09, z - 1.1], [x + 1.1, 0.2, z + 1.1], MAT.CONCRETE));
  }
  for (let i = 0; i < (opts.benches ?? 2); i++) {
    bench(m, x0 + 3.0 + ((i + 0.5) / Math.max(1, opts.benches ?? 2)) * (x1 - x0 - 6), z0 + 2.4, 0);
  }
  const lamps = opts.lamps ?? 4;
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i < lamps; i++) {
      const x = x0 + ((i + 0.5) / lamps) * (x1 - x0);
      m.cylinder(x, z0 + 1.2, 0.11, 0.09, 5.4, 6, MAT.TRIM, false);
      m.box([x - 0.42, 5.4, z0 + 0.9], [x + 0.42, 5.7, z0 + 1.5], MAT.LAMP);
    }
  });
  for (let i = 0; i < (opts.people ?? 5); i++) {
    figure(m, seed * 7 + i * 13, x0 + 2.0 + rnd() * (x1 - x0 - 4), z0 + 1.5 + rnd() * (z1 - z0 - 3),
      rnd() * Math.PI * 2, { stride: 0.2 });
  }
}

/**
 * A porte-cochere: a canopy on columns over a drop-off.
 *
 * The thing every hotel, terminal and civic entrance has and nothing in the
 * library had, and it is what tells you where the front door is from a
 * distance -- which on a building three hundred metres long is a real
 * question.
 */
export function porteCochere(m: MeshBuilder, x0: number, x1: number, z: number, depth: number,
  y: number, cols = 4): void {
  m.painted(TINT.METAL_DARK, () => {
    m.box([x0 - 0.6, y, z], [x1 + 0.6, y + 0.85, z + depth + 0.6], MAT.TRIM, { skipBottom: false });
    for (let i = 0; i < cols; i++) {
      const x = x0 + ((i + 0.5) / cols) * (x1 - x0);
      m.cylinder(x, z + depth, 0.3, 0.1, y, 8, MAT.TRIM, false);
    }
  });
  m.painted(TINT.BRAND, () => {
    m.box([x0 - 0.7, y + 0.85, z], [x1 + 0.7, y + 1.5, z + depth + 0.7], MAT.CLADDING);
  });
}

/** A flagpole with cloth, in the building's own colours. */
export function flags(m: MeshBuilder, x0: number, x1: number, z: number, y: number, count: number,
  height = 9.0): void {
  for (let i = 0; i < count; i++) {
    const x = x0 + ((i + 0.5) / count) * (x1 - x0);
    m.painted(TINT.METAL_DARK, () => m.cylinder(x, z, 0.1, y, y + height, 5, MAT.TRIM, false));
    m.painted(i % 2 === 0 ? TINT.BRAND : TINT.ACCENT, () => {
      m.box([x + 0.08, y + height - 3.6, z - 0.03], [x + 2.4, y + height - 0.4, z + 0.03], MAT.TRIM);
    });
  }
}

/** A lit sign band with the building's name on it, on one elevation. */
export function marquee(m: MeshBuilder, x0: number, x1: number, z: number, sign: 1 | -1,
  y: number, h: number): void {
  const p = z + sign * 0.1;
  m.painted(TINT.BRAND, () => {
    m.box([x0, y - 0.2, Math.min(z, p + sign * 0.5)], [x1, y + h + 0.2, Math.max(z, p + sign * 0.5)], MAT.CLADDING);
  });
  m.painted(TINT.SIGN_LIT, () => {
    const q = z + sign * 0.62;
    if (sign > 0) m.signFace([x0, y, q], [x1, y, q], [x1, y + h, q], [x0, y + h, q], MAT.TRIM);
    else m.signFace([x1, y, q], [x0, y, q], [x0, y + h, q], [x1, y + h, q], MAT.TRIM);
  });
}

// ---------------------------------------------------------------- industry

/** A silo or tank: a ribbed drum with a conical top and a ladder up it. */
export function silo(m: MeshBuilder, cx: number, cz: number, r: number, y0: number, y1: number,
  opts: { cone?: number; ribs?: number; mat?: Material; tint?: Tint } = {}): void {
  const mat = opts.mat ?? MAT.METAL;
  const body = (): void => {
    m.cylinder(cx, cz, r, y0, y1, 14, mat, false);
    if (opts.cone !== undefined) m.cone(cx, cz, r, r * 0.16, y1, y1 + opts.cone, 14, mat);
    else m.cylinder(cx, cz, r, y1 - 0.02, y1, 14, mat, true);
  };
  if (opts.tint !== undefined) m.painted(opts.tint, body); else body();
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i < (opts.ribs ?? 3); i++) {
      const y = y0 + ((i + 1) / ((opts.ribs ?? 3) + 1)) * (y1 - y0);
      m.cylinder(cx, cz, r * 1.02, y, y + 0.22, 14, MAT.TRIM, false);
    }
    // The ladder: two stringers and a cage, which is what says "industrial
    // scale" on a drum that has no other feature to be measured against.
    m.box([cx + r * 0.99, y0, cz - 0.32], [cx + r * 1.05, y1 + 0.6, cz - 0.26], MAT.TRIM);
    m.box([cx + r * 0.99, y0, cz + 0.26], [cx + r * 1.05, y1 + 0.6, cz + 0.32], MAT.TRIM);
    for (let y = y0 + 0.6; y < y1; y += 2.4) {
      m.box([cx + r * 0.98, y, cz - 0.55], [cx + r * 1.4, y + 0.07, cz + 0.55], MAT.TRIM);
    }
  });
}

/** A run of pipes on a rack: the connective tissue of any heavy plant. */
export function pipeRack(m: MeshBuilder, x0: number, x1: number, z: number, y: number,
  lines = 4, bents = 5): void {
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i <= bents; i++) {
      const x = x0 + (i / bents) * (x1 - x0);
      for (const sz of [-1, 1]) m.box([x - 0.16, 0.1, z + sz * 1.5 - 0.16], [x + 0.16, y, z + sz * 1.5 + 0.16], MAT.TRIM);
      m.box([x - 0.2, y, z - 1.8], [x + 0.2, y + 0.3, z + 1.8], MAT.TRIM);
    }
  });
  for (let i = 0; i < lines; i++) {
    const pz = z - 1.5 + (i / Math.max(1, lines - 1)) * 3.0;
    const r = 0.18 + (i % 3) * 0.09;
    m.painted(i % 3 === 0 ? TINT.BRAND : i % 3 === 1 ? TINT.METAL_DARK : TINT.ACCENT, () => {
      m.pipe([x0, y + 0.3 + r, pz], [x1, y + 0.3 + r, pz], r, MAT.METAL, 6);
    });
  }
}

/** A steel lattice: a mast, a crane leg, a flare derrick. */
export function lattice(m: MeshBuilder, cx: number, cz: number, r0: number, r1: number,
  y0: number, y1: number, bays = 6): void {
  m.painted(TINT.METAL_DARK, () => {
    const at = (i: number, t: number): Vec3 => {
      const r = r0 + (r1 - r0) * t;
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      return [cx + Math.cos(a) * r, y0 + (y1 - y0) * t, cz + Math.sin(a) * r];
    };
    for (let i = 0; i < 4; i++) m.pipe(at(i, 0), at(i, 1), 0.14, MAT.TRIM, 4);
    for (let b = 0; b <= bays; b++) {
      const t = b / bays;
      for (let i = 0; i < 4; i++) m.pipe(at(i, t), at((i + 1) % 4, t), 0.09, MAT.TRIM, 3);
      if (b < bays) {
        const u = (b + 1) / bays;
        for (let i = 0; i < 4; i++) m.pipe(at(i, t), at((i + 1) % 4, u), 0.07, MAT.TRIM, 3);
      }
    }
  });
}

/** A conveyor on trestles, running up at an angle. */
export function conveyor(m: MeshBuilder, from: Vec3, to: Vec3, w = 1.6): void {
  m.painted(TINT.METAL_DARK, () => {
    m.pipe(from, to, w * 0.42, MAT.METAL, 4);
    const n = 4;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = from[0] + (to[0] - from[0]) * t;
      const y = from[1] + (to[1] - from[1]) * t;
      const z = from[2] + (to[2] - from[2]) * t;
      m.pipe([x, 0.1, z], [x, y, z], 0.16, MAT.TRIM, 4);
    }
  });
}

/** A guard rail round a plant deck. Re-exported so the sets need one import. */
export { railing, planter };
