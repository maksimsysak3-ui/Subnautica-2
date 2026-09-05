/**
 * Vessels and freight.
 *
 * Two things the library had no way to say. A port with no ships in it is a
 * car park with a blue edge, and an industrial estate with no freight standing
 * about is a set of sheds -- containers, pallets, drums and trailers are what
 * makes a yard read as a working one rather than as empty tarmac.
 *
 * Everything here is authored rather than imported, for the reason the road
 * fleet is the other way round: a car is a shape everybody knows exactly and
 * no parameterisation gets a lofted body to read as a specific one, whereas a
 * hull is a handful of numbers -- length, beam, sheer, flare, where the
 * deckhouse sits -- and the same twenty lines produce a tug, a trawler and a
 * container ship that are recognisably different vessels.
 *
 * Boats float on a water pad rather than standing on the tarmac the road fleet
 * uses, because a hull on tarmac reads as a hull on a lorry.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import type { Material, Tint, Vec3 } from '../mesh';
import { railing } from '../parts';
import { figure } from './vehicles';

// --------------------------------------------------------------------- hulls

/**
 * A hull, lofted from stations along its length.
 *
 * The waterline is y = 0 and nothing below it is modelled: a vessel is only
 * ever seen floating, and the underwater body is a third of the triangles for
 * a shape that is hidden by the water quad in every frame it appears in.
 *
 * `shape` gives the half-beam at each point along the hull as a fraction of
 * the maximum, and `sheer` the deck height as a fraction of the freeboard.
 * Those two curves are the entire difference between the vessels below: a tug
 * is a short one with a very full bow, a container ship a long one that is
 * parallel-sided for two thirds of its length.
 */
interface HullOpts {
  length: number;
  beam: number;
  /** Deck height above the waterline amidships. */
  freeboard: number;
  /** Half-beam as a fraction of the maximum, stern (0) to bow (1). */
  shape: (t: number) => number;
  /** Deck height as a fraction of the freeboard, stern (0) to bow (1). */
  sheer: (t: number) => number;
  /** Topsides above the boot top. */
  mat: Material;
  /** The band at the waterline: antifouling, and always darker. */
  boot: Material;
  /** The deck itself. */
  deck: Material;
  /** Stations along the length. More is smoother and costs quads. */
  stations?: number;
  /** Flare: the bottom is this fraction of the deck's half-beam. */
  tumble?: number;
  /** Paint key: one per vessel, so no two hulls come out the same colour. */
  key?: number;
}

interface Hull {
  /** Deck height at a point along the length, in metres above the waterline. */
  deckAt: (x: number) => number;
  /** Deck half-beam at a point along the length. */
  halfAt: (x: number) => number;
  length: number;
  beam: number;
}

/**
 * A hull, painted.
 *
 * The paint key is per vessel. Without one every hull in the library took the
 * same colour out of carPaint and the whole fleet came out the same teal --
 * seven boats that differ in every dimension and read as one boat at seven
 * sizes.
 */
function hull(m: MeshBuilder, o: HullOpts): Hull {
  let built: Hull | null = null;
  m.keyed(o.key ?? 0, () => { built = hullBody(m, o); });
  return built as unknown as Hull;
}

function hullBody(m: MeshBuilder, o: HullOpts): Hull {
  const n = o.stations ?? 16;
  const half = o.length / 2;
  const tumble = o.tumble ?? 0.74;
  // The boot top is a constant height above the water, not a constant fraction
  // of the freeboard: it is where the vessel floats, and it does not rise and
  // fall with the sheer.
  const boot = Math.min(0.9, o.freeboard * 0.34);

  const at = (i: number): { x: number; hw: number; y: number } => {
    const t = i / n;
    return {
      x: -half + t * o.length,
      hw: Math.max(0.04, (o.beam / 2) * o.shape(t)),
      y: o.freeboard * o.sheer(t),
    };
  };

  for (let i = 0; i < n; i++) {
    const a = at(i), b = at(i + 1);
    const ab = a.hw * tumble, bb = b.hw * tumble;
    for (const s of [1, -1]) {
      // Wound so the outward normal faces away from the centreline on both
      // sides: the port strip is the starboard strip read backwards.
      const p = (x: number, y: number, w: number): Vec3 => [x, y, s * w];
      const quad = (q0: Vec3, q1: Vec3, q2: Vec3, q3: Vec3, mat: Material): void => {
        if (s > 0) m.quad(q0, q1, q2, q3, mat);
        else m.quad(q3, q2, q1, q0, mat);
      };
      // Boot top, then topsides, so the waterline band is a real strip of
      // geometry and not a stripe painted across a single quad.
      quad(p(a.x, 0, ab), p(b.x, 0, bb), p(b.x, boot, bb + (b.hw - bb) * 0.5),
           p(a.x, boot, ab + (a.hw - ab) * 0.5), o.boot);
      quad(p(a.x, boot, ab + (a.hw - ab) * 0.5), p(b.x, boot, bb + (b.hw - bb) * 0.5),
           p(b.x, b.y, b.hw), p(a.x, a.y, a.hw), o.mat);
    }
    // Bottom, seen only from a low angle across the water but cheap to close.
    m.quad([a.x, 0, -ab], [b.x, 0, -bb], [b.x, 0, bb], [a.x, 0, ab], o.boot);
    // Deck.
    m.quad([a.x, a.y, -a.hw], [a.x, a.y, a.hw], [b.x, b.y, b.hw], [b.x, b.y, -b.hw], o.deck);
  }
  // The rubbing strake: a raised line along the hull at deck level.
  //
  // The single biggest thing missing from the first version. A lofted hull
  // with nothing on it is a bar of soap; one horizontal line down its length
  // gives the eye the sheer to read and the topsides something to be above and
  // below. Every working vessel afloat has one.
  for (let i = 0; i < n; i++) {
    const a = at(i), b = at(i + 1);
    for (const s of [1, -1]) {
      const q0: Vec3 = [a.x, a.y - 0.34, s * (a.hw + 0.10)];
      const q1: Vec3 = [b.x, b.y - 0.34, s * (b.hw + 0.10)];
      const q2: Vec3 = [b.x, b.y - 0.08, s * (b.hw + 0.10)];
      const q3: Vec3 = [a.x, a.y - 0.08, s * (a.hw + 0.10)];
      if (s > 0) m.quad(q0, q1, q2, q3, MAT.DARK_TRIM);
      else m.quad(q3, q2, q1, q0, MAT.DARK_TRIM);
    }
  }

  // Transom.
  const s0 = at(0);
  m.quad([s0.x, 0, s0.hw * tumble], [s0.x, 0, -s0.hw * tumble],
         [s0.x, s0.y, -s0.hw], [s0.x, s0.y, s0.hw], o.mat);

  const lookup = (x: number, pick: (v: { x: number; hw: number; y: number }) => number): number => {
    const t = Math.min(1, Math.max(0, (x + half) / o.length)) * n;
    const i = Math.min(n - 1, Math.floor(t));
    const f = t - i;
    return pick(at(i)) * (1 - f) + pick(at(i + 1)) * f;
  };
  return {
    deckAt: (x) => lookup(x, (v) => v.y),
    halfAt: (x) => lookup(x, (v) => v.hw),
    length: o.length,
    beam: o.beam,
  };
}

/**
 * Mooring furniture: bitts down each side and an anchor in its hawse.
 *
 * Small, and worth more than its size. A hull with nothing on the deck edge
 * reads as a bath toy; a row of bitts gives the deck a scale, and the anchor
 * pulled up tight into the bow is the detail everyone knows even if they have
 * never looked at a ship.
 */
function mooring(m: MeshBuilder, h: Hull, x0: number, x1: number, count: number,
  anchor = true): void {
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i < count; i++) {
      const x = x0 + ((i + 0.5) / count) * (x1 - x0);
      const y = h.deckAt(x);
      for (const s of [1, -1]) {
        const w = (h.halfAt(x) - 0.55) * s;
        m.box([x - 0.5, y, w - 0.34], [x + 0.5, y + 0.18, w + 0.34], MAT.TRIM);
        for (const t of [-0.22, 0.22]) {
          m.cylinder(x + t, w, 0.14, y + 0.18, y + 0.78, 8, MAT.TRIM);
        }
      }
    }
    if (anchor) {
      const bx = x1 + (h.length / 2 - x1) * 0.55;
      for (const s of [1, -1]) {
        const w = h.halfAt(bx) * s;
        // The hawse pipe, and the fluke sitting proud of it.
        m.cylinder(bx, w, 0.42, h.deckAt(bx) - 1.5, h.deckAt(bx) - 0.7, 8, MAT.TRIM, false);
        m.box([bx - 0.7, h.deckAt(bx) - 1.9, w - 0.16], [bx + 0.7, h.deckAt(bx) - 0.6, w + 0.16], MAT.TRIM);
        m.box([bx - 1.0, h.deckAt(bx) - 2.1, w - 0.12], [bx + 1.0, h.deckAt(bx) - 1.6, w + 0.12], MAT.TRIM);
      }
    }
  });
}

/** Bulwark: the low wall round the edge of a deck, and its capping rail. */
function bulwark(m: MeshBuilder, h: Hull, x0: number, x1: number, height: number, mat: Material): void {
  const step = (x1 - x0) / 10;
  for (let x = x0; x < x1 - 1e-6; x += step) {
    const xa = x, xb = Math.min(x1, x + step);
    for (const s of [1, -1]) {
      const wa = h.halfAt(xa) * s, wb = h.halfAt(xb) * s;
      const ya = h.deckAt(xa), yb = h.deckAt(xb);
      const inset = 0.16 * s;
      const quad = (q: Vec3[], mt: Material): void => {
        if (s > 0) m.quad(q[0], q[1], q[2], q[3], mt);
        else m.quad(q[3], q[2], q[1], q[0], mt);
      };
      quad([[xa, ya, wa], [xb, yb, wb], [xb, yb + height, wb], [xa, ya + height, wa]], mat);
      quad([[xa, ya + height, wa - inset], [xa, ya + height, wa],
            [xb, yb + height, wb], [xb, yb + height, wb - inset]], MAT.TRIM);
      quad([[xa, ya, wa - inset], [xa, ya + height, wa - inset],
            [xb, yb + height, wb - inset], [xb, ya, wb - inset]], mat);
    }
  }
}

/** A deckhouse: a box with a window band round it and a door in the back. */
function deckhouse(m: MeshBuilder, o: {
  x0: number; x1: number; hw: number; y0: number; y1: number;
  windows?: boolean; door?: boolean; mat?: Material;
}): void {
  const mat = o.mat ?? MAT.PLASTER;
  m.box([o.x0, o.y0, -o.hw], [o.x1, o.y1, o.hw], mat, { roof: MAT.ROOF });
  if (o.windows !== false) {
    const wy0 = o.y1 - (o.y1 - o.y0) * 0.62;
    const wy1 = o.y1 - (o.y1 - o.y0) * 0.22;
    // Proud of the wall by a few centimetres, so the glass is a recess with a
    // frame round it rather than a decal.
    m.box([o.x0 + 0.25, wy0, -o.hw - 0.04], [o.x1 - 0.25, wy1, o.hw + 0.04], MAT.CAR_GLASS);
    m.box([o.x0 + 0.18, wy0 - 0.09, -o.hw - 0.06], [o.x1 - 0.18, wy0, o.hw + 0.06], MAT.TRIM);
    m.box([o.x0 + 0.18, wy1, -o.hw - 0.06], [o.x1 - 0.18, wy1 + 0.09, o.hw + 0.06], MAT.TRIM);
    // Mullions. A continuous ribbon of glass round a deckhouse reads as a
    // painted stripe; the divisions are what make it windows.
    m.painted(TINT.METAL_DARK, () => {
      const panes = Math.max(2, Math.round((o.x1 - o.x0) / 1.5));
      for (let i = 1; i < panes; i++) {
        const x = o.x0 + 0.25 + (i / panes) * (o.x1 - o.x0 - 0.5);
        m.box([x - 0.06, wy0, -o.hw - 0.07], [x + 0.06, wy1, o.hw + 0.07], MAT.TRIM);
      }
      // And the corner posts, so the box has an edge.
      for (const sx of [o.x0, o.x1 - 0.14]) {
        m.box([sx, o.y0, -o.hw - 0.05], [sx + 0.14, o.y1, o.hw + 0.05], MAT.TRIM);
      }
    });
  }
  if (o.door !== false) {
    m.painted(TINT.DOOR, () => {
      m.box([o.x0 - 0.05, o.y0, -0.42], [o.x0 + 0.06, o.y0 + 1.95, 0.42], MAT.TRIM);
    });
  }
}

/** A funnel: a raked oval stack with a cap band. */
function funnel(m: MeshBuilder, cx: number, y0: number, y1: number, r: number, mat: Material): void {
  m.painted(TINT.BRAND, () => {
    m.cone(cx, 0, r, r * 0.86, y0, y1 - 0.28, 10, mat);
  });
  // A band below the cap, which is how every shipping line on earth marks a
  // funnel, and the black top that every one of them has above it.
  m.painted(TINT.ACCENT, () => {
    m.cylinder(cx, 0, r * 0.94, y1 - 1.5, y1 - 0.9, 10, MAT.PAINT, false);
  });
  m.painted(TINT.METAL_DARK, () => {
    m.cylinder(cx, 0, r * 0.92, y1 - 0.28, y1, 10, MAT.TRIM);
    // Uptakes: two pipes standing out of the top, so it is a funnel and not a
    // solid cone with a lid.
    for (const t of [-0.4, 0.4]) m.cylinder(cx + t * r, 0, r * 0.22, y1, y1 + 0.5, 6, MAT.TRIM);
  });
}

/** A mast with crosstrees and a masthead lamp. */
function mast(m: MeshBuilder, cx: number, y0: number, height: number): void {
  m.painted(TINT.METAL_DARK, () => {
    m.pipe([cx, y0, 0], [cx, y0 + height, 0], 0.11, MAT.TRIM, 6);
    m.pipe([cx, y0 + height * 0.62, -height * 0.24], [cx, y0 + height * 0.62, height * 0.24], 0.07, MAT.TRIM, 5);
  });
  m.box([cx - 0.13, y0 + height, -0.13], [cx + 0.13, y0 + height + 0.26, 0.13], MAT.LAMP);
}

/** Tyre fenders hung over the side, which is what makes a working boat one. */
function fenders(m: MeshBuilder, h: Hull, x0: number, x1: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const x = x0 + ((i + 0.5) / count) * (x1 - x0);
    const y = h.deckAt(x);
    for (const s of [1, -1]) {
      const w = h.halfAt(x) * s;
      m.cylinder(x, w + 0.1 * s, 0.42, y - 1.15, y - 0.35, 8, MAT.TYRE, false);
    }
  }
}

// ------------------------------------------------------------------ freight

/** One ISO container. `key` picks its colour; `long` is a forty-foot box. */
function container(m: MeshBuilder, x: number, y: number, z: number, long: boolean, key: number,
  turned = false, plain = false): void {
  const L = long ? 12.19 : 6.06, W = 2.44, H = 2.59;
  const hx = (turned ? W : L) / 2, hz = (turned ? L : W) / 2;
  m.keyed(key, () => {
    m.box([x - hx, y, z - hz], [x + hx, y + H, z + hz], MAT.CONTAINER, { roof: MAT.CONTAINER });
    // Corner castings. They are what a stack actually rests on, and the gap
    // they leave between boxes is the reason a stack does not read as one
    // striped block. Skipped on a ship's deck cargo: two hundred boxes seen
    // from the quayside is the one place the castings are not worth eighty
    // triangles each, and it is the difference between fitting the budget and
    // not.
    if (plain) {
      // One dark rail across the top instead. It costs a tenth of the castings
      // and does the job they were there for: it draws the line between one
      // box and the one stacked on it, so a bay reads as boxes rather than as
      // a striped block.
      m.painted(TINT.METAL_DARK, () => {
        m.box([x - hx, y + H - 0.16, z - hz - 0.03], [x + hx, y + H, z + hz + 0.03], MAT.TRIM);
      });
      return;
    }
    m.painted(TINT.METAL_DARK, () => {
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          m.box([x + sx * hx - 0.3, y, z + sz * hz - 0.3],
                [x + sx * hx + 0.3, y + 0.22, z + sz * hz + 0.3], MAT.TRIM);
          m.box([x + sx * hx - 0.3, y + H - 0.22, z + sz * hz - 0.3],
                [x + sx * hx + 0.3, y + H, z + sz * hz + 0.3], MAT.TRIM);
        }
      }
      // Doors at one end: two leaves with four locking bars each.
      const dx = turned ? 0 : hx, dz = turned ? hz : 0;
      for (let i = 0; i < 4; i++) {
        const u = (-0.72 + i * 0.48) * (turned ? 1 : 1);
        const bx = turned ? x + u : x + dx + 0.05;
        const bz = turned ? z + dz + 0.05 : z + u;
        m.box([bx - (turned ? 0.05 : 0.06), y + 0.2, bz - (turned ? 0.06 : 0.05)],
              [bx + (turned ? 0.05 : 0.06), y + H - 0.2, bz + (turned ? 0.06 : 0.05)], MAT.TRIM);
      }
    });
  });
}

/** A euro pallet, with stringers you can see daylight through. */
function pallet(m: MeshBuilder, x: number, y: number, z: number, turns: 0 | 1 = 0): void {
  const L = turns ? 0.8 : 1.2, W = turns ? 1.2 : 0.8;
  m.painted(TINT.WOOD, () => {
    for (let i = 0; i < 3; i++) {
      const u = -L / 2 + 0.09 + (i / 2) * (L - 0.18);
      m.box([x + u - 0.08, y, z - W / 2], [x + u + 0.08, y + 0.1, z + W / 2], MAT.TIMBER);
    }
    for (let i = 0; i < 5; i++) {
      const v = -W / 2 + (i / 4) * (W - 0.11);
      m.box([x - L / 2, y + 0.1, z + v], [x + L / 2, y + 0.145, z + v + 0.11], MAT.TIMBER);
    }
  });
}

/** A drum, banded. */
function drum(m: MeshBuilder, x: number, z: number, y: number, tint: Tint): void {
  m.painted(tint, () => {
    m.cylinder(x, z, 0.29, y, y + 0.88, 10, MAT.PAINT);
  });
  m.painted(TINT.METAL_DARK, () => {
    m.cylinder(x, z, 0.31, y + 0.24, y + 0.32, 10, MAT.TRIM, false);
    m.cylinder(x, z, 0.31, y + 0.56, y + 0.64, 10, MAT.TRIM, false);
  });
}

/** A timber crate: boards, corner posts and a diagonal brace. */
function crate(m: MeshBuilder, x: number, y: number, z: number, w: number, d: number, h: number): void {
  m.painted(TINT.WOOD, () => {
    m.box([x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], MAT.TIMBER, { roof: MAT.TIMBER });
    for (const sx of [-1, 1]) {
      m.box([x + sx * w / 2 - 0.07, y, z - d / 2 - 0.05],
            [x + sx * w / 2 + 0.07, y + h, z + d / 2 + 0.05], MAT.TIMBER);
      m.box([x - w / 2 - 0.05, y, z + sx * d / 2 - 0.07],
            [x + w / 2 + 0.05, y + h, z + sx * d / 2 + 0.07], MAT.TIMBER);
    }
    for (const yy of [y + h * 0.18, y + h * 0.82]) {
      m.box([x - w / 2 - 0.05, yy, z - d / 2 - 0.05], [x + w / 2 + 0.05, yy + 0.1, z + d / 2 + 0.05], MAT.TIMBER);
    }
  });
}

/** The concrete a yard stands on. */
function apron(m: MeshBuilder, x: number, z: number): void {
  m.box([-x, 0.0005, -z], [x, 0.05, z], MAT.CONCRETE);
}

/** The water a hull floats in. */
function sea(m: MeshBuilder, x: number, z: number): void {
  m.box([-x, 0.0005, -z], [x, 0.06, z], MAT.WATER);
}

// ======================================================================= boats

function tug(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  sea(m, 12.6, 7.0);
  const h = hull(m, {
    key: 3, length: 21, beam: 7.4, freeboard: 2.5,
    // Very full forward and cut away aft: a tug is mostly bow, because the
    // bow is the working end.
    shape: (t) => (t < 0.12 ? 0.80 + t * 1.4 : t < 0.72 ? 1.0 : 1.0 - ((t - 0.72) / 0.28) ** 1.7 * 0.92),
    sheer: (t) => 1.0 + 0.20 * (t - 0.45) ** 2 * 4,
    mat: MAT.PAINT, boot: MAT.DARK_TRIM, deck: MAT.METAL, stations: 14, tumble: 0.80,
  });
  bulwark(m, h, -9.5, 9.0, 1.05, MAT.PAINT);
  mooring(m, h, -8.0, 8.6, 4);
  // Deckhouse, then the wheelhouse standing on it: the two-box stack with a
  // ring of glass on top is the whole silhouette of a harbour tug.
  deckhouse(m, { x0: -6.4, x1: 1.6, hw: 2.7, y0: 2.7, y1: 5.5 });
  deckhouse(m, { x0: -4.4, x1: 0.2, hw: 2.2, y0: 5.5, y1: 8.0, mat: MAT.PLASTER });
  m.box([-4.9, 7.95, -2.6], [0.7, 8.2, 2.6], MAT.ROOF);
  funnel(m, -6.0, 5.5, 9.4, 1.05, MAT.PAINT);
  mast(m, -2.1, 8.2, 2.8);
  if (lod < 1) {
    fenders(m, h, -8.0, 8.2, 7);
    // The towing hook and the winch drum aft, and a bow fender the size of a
    // car tyre stack, because that is what a tug pushes with.
    m.painted(TINT.METAL_DARK, () => {
      m.cylinder(-8.2, 0, 1.05, 3.0, 4.1, 10, MAT.TRIM);
      m.box([-8.9, 2.6, -1.5], [-7.5, 3.0, 1.5], MAT.TRIM);
    });
    for (let i = 0; i < 3; i++) m.cylinder(9.1, 0, 0.95, 1.0 + i * 0.55, 1.5 + i * 0.55, 10, MAT.TYRE, false);
    railing(m, -4.9, 0.7, 2.55, 8.2, 0.9, 1.2);
    railing(m, -4.9, 0.7, -2.55, 8.2, 0.9, 1.2);
    figure(m, 71, -2.0, 1.4, Math.PI * 0.5, { lift: 5.5 });
  }
  return m;
}

function trawler(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  sea(m, 15.6, 7.0);
  const h = hull(m, {
    key: 11, length: 26, beam: 7.6, freeboard: 2.8,
    shape: (t) => (t < 0.08 ? 0.88 : t < 0.62 ? 1.0 : 1.0 - ((t - 0.62) / 0.38) ** 1.6 * 0.94),
    // A working boat's sheer: high at the bow, dropping to a low working deck
    // aft where the net comes over the stern ramp.
    sheer: (t) => 0.72 + 0.62 * t ** 2,
    mat: MAT.PAINT, boot: MAT.DARK_TRIM, deck: MAT.METAL, stations: 16, tumble: 0.76,
  });
  bulwark(m, h, -12.0, 11.0, 1.15, MAT.PAINT);
  mooring(m, h, -10.0, 11.0, 5);
  deckhouse(m, { x0: -1.0, x1: 6.5, hw: 2.9, y0: 3.2, y1: 6.0 });
  deckhouse(m, { x0: 0.6, x1: 5.0, hw: 2.4, y0: 6.0, y1: 8.4, mat: MAT.PLASTER });
  m.box([0.1, 8.35, -2.8], [5.5, 8.6, 2.8], MAT.ROOF);
  funnel(m, -0.4, 6.0, 9.6, 0.78, MAT.PAINT);
  // The gantry over the working deck, and the net drum under it. This is the
  // one part that says trawler rather than "boat with a cabin".
  m.painted(TINT.METAL_DARK, () => {
    for (const s of [1, -1]) {
      m.pipe([-4.0, h.deckAt(-4.0), s * 2.9], [-4.6, 8.2, s * 1.5], 0.15, MAT.TRIM, 6);
    }
    m.pipe([-4.6, 8.2, -1.6], [-4.6, 8.2, 1.6], 0.15, MAT.TRIM, 6);
    m.pipe([-4.6, 8.2, 0], [-4.6, 7.0, 0], 0.07, MAT.TRIM, 5);
  });
  m.painted(TINT.ACCENT, () => {
    m.cylinder(-7.4, 0, 1.25, 3.1, 4.4, 12, MAT.PAINT);
  });
  m.painted(TINT.METAL_DARK, () => {
    m.pipe([-8.9, 3.75, 0], [-5.9, 3.75, 0], 0.12, MAT.TRIM, 6);
  });
  mast(m, 2.6, 8.6, 3.4);
  if (lod < 1) {
    fenders(m, h, -10.0, 9.0, 8);
    // Outriggers, stowed up against the mast the way they are in harbour.
    m.painted(TINT.METAL_DARK, () => {
      for (const s of [1, -1]) m.pipe([2.6, 9.0, 0], [-3.4, 11.0, s * 1.2], 0.1, MAT.TRIM, 5);
    });
    for (let i = 0; i < 5; i++) {
      crate(m, -9.5 + (i % 3) * 1.5, h.deckAt(-9.5) , (i < 3 ? -1.4 : 1.2) + (i % 2) * 0.4, 1.1, 0.8, 0.7);
    }
    railing(m, 0.1, 5.5, 2.75, 8.6, 0.9, 1.2);
    railing(m, 0.1, 5.5, -2.75, 8.6, 0.9, 1.2);
    figure(m, 23, -8.0, -0.6, 0, { lift: h.deckAt(-8.0) });
    figure(m, 44, -6.4, 1.4, Math.PI, { lift: h.deckAt(-6.4) });
  }
  return m;
}

function pilotBoat(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  sea(m, 8.6, 4.6);
  const h = hull(m, {
    key: 7, length: 14, beam: 4.4, freeboard: 1.9,
    shape: (t) => (t < 0.10 ? 0.86 : t < 0.60 ? 1.0 : 1.0 - ((t - 0.60) / 0.40) ** 1.5 * 0.93),
    sheer: (t) => 0.82 + 0.5 * t ** 2,
    mat: MAT.PAINT, boot: MAT.DARK_TRIM, deck: MAT.METAL, stations: 12, tumble: 0.70,
  });
  mooring(m, h, -5.0, 5.6, 3);
  deckhouse(m, { x0: -1.4, x1: 3.4, hw: 1.7, y0: 2.1, y1: 4.4, mat: MAT.PLASTER });
  m.box([-1.8, 4.35, -1.9], [3.8, 4.6, 1.9], MAT.ROOF);
  // A light bar and a radar dome, which is what marks a boat out as official
  // at the distance these are actually seen from.
  m.box([0.4, 4.6, -0.7], [1.6, 4.98, 0.7], MAT.LAMP);
  m.painted(TINT.METAL_DARK, () => {
    m.cylinder(2.6, 0, 0.42, 4.6, 4.72, 10, MAT.TRIM);
    m.box([2.3, 4.72, -0.12], [2.9, 5.1, 0.12], MAT.TRIM);
  });
  mast(m, -0.2, 4.6, 2.1);
  if (lod < 1) {
    fenders(m, h, -5.0, 5.4, 5);
    bulwark(m, h, -6.2, 5.6, 0.6, MAT.PAINT);
    railing(m, -6.0, -2.0, 1.4, h.deckAt(-4.0), 0.8, 1.1);
    railing(m, -6.0, -2.0, -1.4, h.deckAt(-4.0), 0.8, 1.1);
    figure(m, 91, -3.6, 0.6, Math.PI * 0.5, { lift: h.deckAt(-3.6) });
  }
  return m;
}

function motorYacht(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  sea(m, 16.6, 4.6);
  const h = hull(m, {
    key: 27, length: 24, beam: 6.0, freeboard: 2.4,
    // Long fine entry and a broad transom: the plan of a planing motor yacht,
    // and the opposite of the tug's.
    shape: (t) => (t < 0.55 ? 0.92 + t * 0.15 : 1.0 - ((t - 0.55) / 0.45) ** 1.35 * 0.95),
    sheer: (t) => 0.90 + 0.32 * t ** 1.6,
    mat: MAT.PLASTER, boot: MAT.DARK_TRIM, deck: MAT.ROOF, stations: 16, tumble: 0.66,
  });
  mooring(m, h, -10.0, 10.0, 3);
  // Superstructure in two long low steps, raked back, with a continuous band
  // of glass. Nothing about a yacht is vertical.
  m.box([-3.0, h.deckAt(0), -2.5], [7.0, h.deckAt(0) + 2.1, 2.5], MAT.PLASTER, { roof: MAT.ROOF });
  m.box([-3.0, h.deckAt(0) + 0.55, -2.56], [6.2, h.deckAt(0) + 1.65, 2.56], MAT.CAR_GLASS);
  m.box([-1.4, h.deckAt(0) + 2.1, -2.1], [4.6, h.deckAt(0) + 3.9, 2.1], MAT.PLASTER, { roof: MAT.ROOF });
  m.box([-1.4, h.deckAt(0) + 2.6, -2.16], [4.2, h.deckAt(0) + 3.5, 2.16], MAT.CAR_GLASS);
  // Radar arch over the flybridge.
  m.painted(TINT.METAL_DARK, () => {
    for (const s of [1, -1]) m.pipe([-1.0, h.deckAt(0) + 3.9, s * 1.9], [-1.6, h.deckAt(0) + 5.6, s * 1.5], 0.11, MAT.TRIM, 6);
    m.pipe([-1.6, h.deckAt(0) + 5.6, -1.6], [-1.6, h.deckAt(0) + 5.6, 1.6], 0.11, MAT.TRIM, 6);
  });
  if (lod < 1) {
    // Sunpad forward and a swim platform aft.
    m.box([7.2, h.deckAt(8) - 0.05, -1.9], [10.2, h.deckAt(8) + 0.22, 1.9], MAT.ROOF);
    m.box([-12.6, 0.55, -2.0], [-10.6, 0.8, 2.0], MAT.ROOF);
    railing(m, 7.0, 10.4, 2.0, h.deckAt(8), 0.72, 1.3);
    railing(m, 7.0, 10.4, -2.0, h.deckAt(8), 0.72, 1.3);
    railing(m, -1.4, 4.6, 2.0, h.deckAt(0) + 3.9, 0.9, 1.3);
    railing(m, -1.4, 4.6, -2.0, h.deckAt(0) + 3.9, 0.9, 1.3);
    figure(m, 17, 1.8, 1.2, Math.PI, { lift: h.deckAt(0) + 3.9 });
    figure(m, 58, -6.0, -0.8, Math.PI * 0.5, { lift: h.deckAt(-6.0) });
  }
  return m;
}

function ferry(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  sea(m, 24.6, 8.6);
  const h = hull(m, {
    key: 34, length: 44, beam: 12.5, freeboard: 3.4,
    shape: (t) => (t < 0.10 ? 0.90 : t < 0.72 ? 1.0 : 1.0 - ((t - 0.72) / 0.28) ** 1.5 * 0.92),
    sheer: (t) => 0.94 + 0.16 * t ** 2,
    mat: MAT.PAINT, boot: MAT.DARK_TRIM, deck: MAT.METAL, stations: 18, tumble: 0.82,
  });
  const d = h.deckAt(0);
  mooring(m, h, -19.0, 19.0, 7);
  // Two enclosed decks of seating with a window band each, then an open top
  // deck. The bow ramp forward is what makes it a ferry and not a launch.
  for (let f = 0; f < 2; f++) {
    const y0 = d + f * 3.1;
    m.box([-19.0, y0, -5.6], [15.0, y0 + 3.1, 5.6], MAT.PLASTER, { roof: MAT.ROOF });
    m.box([-18.4, y0 + 0.95, -5.66], [14.4, y0 + 2.35, 5.66], MAT.CAR_GLASS);
    m.painted(TINT.METAL_DARK, () => {
      m.box([-18.6, y0 + 0.82, -5.7], [14.6, y0 + 0.95, 5.7], MAT.TRIM);
      m.box([-18.6, y0 + 2.35, -5.7], [14.6, y0 + 2.48, 5.7], MAT.TRIM);
    });
  }
  const top = d + 6.2;
  m.box([-19.4, top, -5.9], [15.4, top + 0.25, 5.9], MAT.ROOF);
  // Wheelhouse: full width, well forward, one storey up from the top deck.
  m.box([8.0, top + 0.25, -4.6], [14.6, top + 3.0, 4.6], MAT.PLASTER, { roof: MAT.ROOF });
  m.box([8.0, top + 1.05, -4.66], [14.0, top + 2.5, 4.66], MAT.CAR_GLASS);
  funnel(m, -14.0, top + 0.25, top + 4.6, 1.3, MAT.PAINT);
  mast(m, 11.0, top + 3.0, 3.2);
  if (lod < 1) {
    fenders(m, h, -18.0, 16.0, 12);
    railing(m, -19.2, 7.6, 5.7, top + 0.25, 1.05, 1.6);
    railing(m, -19.2, 7.6, -5.7, top + 0.25, 1.05, 1.6);
    // Lifeboats in davits along the top deck, and a bow ramp hinged up.
    for (let i = 0; i < 4; i++) {
      const x = -16.0 + i * 5.4;
      for (const s of [1, -1]) {
        m.painted(TINT.ACCENT, () => {
          m.box([x - 1.5, top + 0.55, s * 5.0 - 0.55], [x + 1.5, top + 1.35, s * 5.0 + 0.55], MAT.PAINT, { roof: MAT.PAINT });
        });
        m.painted(TINT.METAL_DARK, () => {
          m.pipe([x - 1.2, top + 0.25, s * 4.4], [x - 1.2, top + 1.9, s * 5.2], 0.09, MAT.TRIM, 5);
          m.pipe([x + 1.2, top + 0.25, s * 4.4], [x + 1.2, top + 1.9, s * 5.2], 0.09, MAT.TRIM, 5);
        });
      }
    }
    m.painted(TINT.METAL_DARK, () => {
      m.box([19.4, h.deckAt(19.4) - 0.2, -3.0], [21.6, h.deckAt(19.4) + 2.6, 3.0], MAT.TRIM);
    });
    for (let i = 0; i < 5; i++) figure(m, 200 + i * 13, -14 + i * 6.2, (i % 2 ? 1 : -1) * 4.4, i % 2 ? 0 : Math.PI, { lift: top + 0.25 });
  }
  return m;
}

function containerShip(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  sea(m, 48.6, 12.6);
  const h = hull(m, {
    key: 42, length: 92, beam: 17.0, freeboard: 7.0,
    // Parallel-sided for two thirds of her length, which is the whole point of
    // a box boat: the cargo is rectangular, so the ship is too.
    shape: (t) => (t < 0.06 ? 0.82 + t * 3 : t < 0.80 ? 1.0 : 1.0 - ((t - 0.80) / 0.20) ** 1.8 * 0.95),
    sheer: (t) => 0.97 + 0.08 * t ** 3,
    mat: MAT.PAINT, boot: MAT.DARK_TRIM, deck: MAT.METAL, stations: 20, tumble: 0.90,
  });
  const d = h.deckAt(0);
  mooring(m, h, -44.0, 44.0, 12);
  // Accommodation block aft, five storeys with a bridge wing each side.
  for (let f = 0; f < 5; f++) {
    const y0 = d + f * 3.0;
    const w = 6.4 - f * 0.25;
    m.box([-40.0, y0, -w], [-30.0, y0 + 3.0, w], MAT.PLASTER, { roof: MAT.ROOF });
    m.box([-39.4, y0 + 1.0, -w - 0.06], [-30.6, y0 + 2.2, w + 0.06], MAT.CAR_GLASS);
  }
  const bridge = d + 15.0;
  m.box([-40.6, bridge, -8.6], [-30.4, bridge + 3.2, 8.6], MAT.PLASTER, { roof: MAT.ROOF });
  m.box([-40.2, bridge + 1.0, -8.66], [-30.8, bridge + 2.6, 8.66], MAT.CAR_GLASS);
  m.box([-41.0, bridge + 3.2, -8.9], [-30.0, bridge + 3.5, 8.9], MAT.ROOF);
  funnel(m, -44.0, bridge + 3.5, bridge + 9.5, 2.3, MAT.PAINT);
  // Hatch coamings and the deck cargo. Three tiers on deck is what a feeder
  // ship this size actually carries.
  let key = 300;
  for (let bay = 0; bay < 8; bay++) {
    const x = -22.0 + bay * 6.9;
    m.painted(TINT.METAL_DARK, () => {
      m.box([x - 3.2, d, -7.4], [x + 3.2, d + 0.7, 7.4], MAT.TRIM, { roof: MAT.TRIM });
    });
    const tiers = bay > 5 ? 2 : 3;
    for (let tier = 0; tier < tiers; tier++) {
      for (let row = 0; row < 5; row++) {
        if (bay > 5 && (row === 0 || row === 4)) continue;
        container(m, x, d + 0.7 + tier * 2.62, -5.2 + row * 2.6, false, key++, false, true);
      }
    }
  }
  if (lod < 1) {
    bulwark(m, h, -46.0, 44.0, 1.3, MAT.PAINT);
    mast(m, 40.0, h.deckAt(40.0), 5.5);
    // Deck cranes: a pedestal, a house and a jib stowed fore and aft.
    for (const cx of [-27.0, 12.0]) {
      m.painted(TINT.METAL_DARK, () => {
        m.cylinder(cx, 0, 1.5, d, d + 3.0, 10, MAT.TRIM);
        m.box([cx - 2.0, d + 3.0, -2.0], [cx + 2.0, d + 6.0, 2.0], MAT.TRIM, { roof: MAT.TRIM });
        m.pipe([cx, d + 5.0, 0], [cx + 16.0, d + 16.0, 0], 0.45, MAT.TRIM, 6);
      });
    }
    railing(m, -41.0, -30.0, 8.9, bridge + 3.5, 1.05, 1.8);
    railing(m, -41.0, -30.0, -8.9, bridge + 3.5, 1.05, 1.8);
    figure(m, 311, -35.0, 7.6, Math.PI * 0.5, { lift: bridge + 3.5 });
  }
  return m;
}

function barge(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  sea(m, 24.6, 7.0);
  const h = hull(m, {
    key: 58, length: 44, beam: 11.0, freeboard: 2.6,
    // A barge is a box with the ends pushed in: almost no shape at all, which
    // is exactly what distinguishes it from everything else here.
    shape: (t) => (t < 0.10 ? 0.55 + t * 4.5 : t < 0.90 ? 1.0 : 1.0 - ((t - 0.90) / 0.10) ** 1.2 * 0.45),
    sheer: () => 1.0,
    mat: MAT.PAINT, boot: MAT.DARK_TRIM, deck: MAT.METAL, stations: 14, tumble: 0.94,
  });
  const d = h.deckAt(0);
  mooring(m, h, -20.0, 20.0, 8, false);
  // The hold: a coaming round a well, heaped with aggregate.
  m.painted(TINT.METAL_DARK, () => {
    m.box([-16.0, d, -4.9], [16.0, d + 1.5, 4.9], MAT.TRIM);
    m.box([-15.4, d + 0.1, -4.3], [15.4, d + 1.5, 4.3], MAT.CONCRETE, { roof: MAT.CONCRETE });
  });
  // The heap itself, a coarse pyramid so it does not read as a flat lid.
  for (let i = 0; i < 6; i++) {
    const inset = i * 0.62;
    m.box([-15.0 + inset * 1.9, d + 1.4 + i * 0.28, -4.0 + inset],
          [15.0 - inset * 1.9, d + 1.7 + i * 0.28, 4.0 - inset], MAT.GROUND, { roof: MAT.GROUND });
  }
  deckhouse(m, { x0: -21.0, x1: -17.2, hw: 3.2, y0: d, y1: d + 2.9 });
  m.box([-21.4, d + 2.85, -3.4], [-16.8, d + 3.1, 3.4], MAT.ROOF);
  mast(m, -19.0, d + 3.1, 2.4);
  if (lod < 1) {
    fenders(m, h, -20.0, 20.0, 12);
    railing(m, -16.0, 16.0, 4.9, d, 0.9, 2.2);
    railing(m, -16.0, 16.0, -4.9, d, 0.9, 2.2);
    figure(m, 63, -18.0, 2.2, Math.PI, { lift: d });
  }
  return m;
}

// ===================================================================== freight

function containerStack(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  apron(m, 15, 10);
  // Two rows of forty-foot boxes, stacked three and four high with a gap
  // between them: a yard block, not a wall.
  let key = 10;
  const heights = [3, 4, 2, 4, 3];
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 5; i++) {
      const n = Math.max(1, heights[(i + row * 2) % heights.length] - (row ? 1 : 0));
      for (let t = 0; t < n; t++) {
        container(m, -12.4 + i * 6.25, 0.05 + t * 2.62, row ? 4.0 : -4.0, false, key++, false);
      }
    }
  }
  if (lod < 1) {
    // A reach stacker's spreader would be a second asset; what belongs here is
    // the ground furniture -- a lighting mast and the painted lane markings
    // that make a stack read as a yard rather than as a wall.
    m.painted(TINT.METAL_DARK, () => {
      m.pipe([14.0, 0.05, 8.6], [14.0, 11.0, 8.6], 0.22, MAT.TRIM, 6);
      m.box([13.0, 11.0, 8.2], [15.0, 11.4, 9.0], MAT.LAMP);
    });
    figure(m, 5, 9.5, 0.0, Math.PI * 0.5);
  }
  return m;
}

function palletYard(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  apron(m, 7, 5);
  // Pallets loaded three ways -- boxed, drummed and shrink-wrapped -- because
  // a yard of identical cubes reads as a texture rather than as goods.
  const spots: Array<[number, number, 0 | 1]> = [
    [-4.6, -2.6, 0], [-3.0, -2.6, 0], [-1.4, -2.6, 0],
    [-4.6, -0.8, 0], [-3.0, -0.8, 0],
    [1.2, -2.4, 1], [1.2, -0.8, 1], [1.2, 0.8, 1],
    [3.4, -2.4, 1], [3.4, -0.8, 1],
    [-4.2, 2.2, 0], [-2.6, 2.2, 0], [-1.0, 2.2, 0],
  ];
  spots.forEach(([x, z, turns], i) => {
    pallet(m, x, 0.05, z, turns);
    const kind = i % 3;
    if (kind === 0) {
      // Cartons, stacked and slightly out of true.
      for (let r = 0; r < 3; r++) {
        const w = 0.52 - r * 0.02;
        m.painted(TINT.WOOD, () => {
          m.box([x - w, 0.2 + r * 0.42, z - 0.34], [x + w, 0.6 + r * 0.42, z + 0.34], MAT.TIMBER, { roof: MAT.TIMBER });
        });
      }
    } else if (kind === 1) {
      for (let d = 0; d < 4; d++) {
        drum(m, x - 0.26 + (d % 2) * 0.52, z - 0.2 + Math.floor(d / 2) * 0.4, 0.145,
             d % 2 ? TINT.ACCENT : TINT.BRAND);
      }
    } else {
      // Shrink-wrapped: one block, glassy, with a strap round the middle.
      m.box([x - 0.55, 0.145, z - 0.36], [x + 0.55, 1.35, z + 0.36], MAT.CAR_GLASS, { roof: MAT.CAR_GLASS });
      m.painted(TINT.ACCENT, () => {
        m.box([x - 0.58, 0.62, z - 0.39], [x + 0.58, 0.72, z + 0.39], MAT.PAINT);
      });
    }
  });
  if (lod < 1) {
    crate(m, 4.6, 0.05, 2.4, 1.6, 1.2, 1.1);
    crate(m, 4.6, 1.2, 2.4, 1.4, 1.0, 0.6);
    figure(m, 12, -0.2, 3.4, Math.PI, { stride: 0.2 });
  }
  return m;
}

function crateYard(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  apron(m, 7, 5);
  crate(m, -4.0, 0.05, -2.2, 2.6, 1.8, 2.0);
  crate(m, -4.0, 2.1, -2.2, 2.2, 1.5, 0.9);
  crate(m, -0.6, 0.05, -2.6, 1.8, 1.4, 1.4);
  crate(m, 2.6, 0.05, -2.4, 3.0, 1.6, 1.2);
  crate(m, 2.6, 1.3, -2.4, 2.4, 1.3, 0.8);
  // Drums, on and off a pallet, and a bundle of pipe on timber bearers.
  for (let i = 0; i < 9; i++) {
    drum(m, -3.4 + (i % 3) * 0.72, 1.4 + Math.floor(i / 3) * 0.72, 0.05,
         i % 3 === 0 ? TINT.ACCENT : i % 3 === 1 ? TINT.BRAND : TINT.METAL_DARK);
  }
  m.painted(TINT.WOOD, () => {
    for (const z of [-0.4, 1.4]) m.box([1.4, 0.05, z], [5.4, 0.19, z + 0.18], MAT.TIMBER);
  });
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 4 - r; i++) {
      m.painted(TINT.METAL_DARK, () => {
        m.pipe([1.4, 0.36 + r * 0.46, 0.0 + i * 0.5 + r * 0.25],
               [5.4, 0.36 + r * 0.46, 0.0 + i * 0.5 + r * 0.25], 0.23, MAT.TRIM, 8);
      });
    }
  }
  if (lod < 1) {
    for (let i = 0; i < 4; i++) pallet(m, 5.6, 0.05 + i * 0.16, -3.4);
    figure(m, 33, 0.4, 3.6, Math.PI, { stride: 0.16 });
  }
  return m;
}

function semiTrailer(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  apron(m, 8, 3);
  // A box trailer standing on its legs, uncoupled. The bogie back, the legs
  // forward and the kingpin plate between them is the whole read.
  const y = 1.32;
  m.painted(TINT.BRAND, () => {
    m.box([-6.6, y, -1.28], [6.4, y + 2.86, 1.28], MAT.CLADDING, { roof: MAT.ROOF });
  });
  m.painted(TINT.METAL_DARK, () => {
    m.box([-6.7, y - 0.22, -1.24], [6.5, y, 1.24], MAT.TRIM);
    // Rear doors, frame and buffer bar.
    m.box([-6.75, y + 0.1, -1.3], [-6.6, y + 2.8, 1.3], MAT.TRIM);
    m.box([-6.9, 0.55, -1.15], [-6.5, 0.75, 1.15], MAT.TRIM);
    // Landing legs.
    for (const s of [1, -1]) {
      m.box([3.4, 0.05, s * 0.9 - 0.11], [3.7, y - 0.22, s * 0.9 + 0.11], MAT.TRIM);
      m.box([3.25, 0.05, s * 0.9 - 0.26], [3.85, 0.16, s * 0.9 + 0.26], MAT.TRIM);
    }
    m.box([4.6, y - 0.34, -0.6], [5.8, y - 0.22, 0.6], MAT.TRIM);
  });
  // Tri-axle bogie.
  for (let a = 0; a < 3; a++) {
    const ax = -5.4 + a * 1.32;
    m.painted(TINT.METAL_DARK, () => {
      m.box([ax - 0.14, 0.5, -1.05], [ax + 0.14, 0.72, 1.05], MAT.TRIM);
    });
    for (const s of [1, -1]) {
      m.cylinder(ax, s * 1.08, 0.52, 0.02, 0.28, 12, MAT.TYRE);
      m.painted(TINT.METAL_DARK, () => {
        m.cylinder(ax, s * 1.08, 0.24, 0.06, 0.24, 8, MAT.TRIM);
      });
    }
  }
  if (lod < 1) {
    // Side skirts, mudguards and marker lamps.
    m.painted(TINT.METAL_DARK, () => {
      for (const s of [1, -1]) {
        m.box([-2.4, 0.62, s * 1.22], [3.0, y - 0.22, s * 1.3], MAT.TRIM);
        m.box([-6.2, 1.02, s * 0.9], [-2.6, 1.18, s * 1.3], MAT.TRIM);
      }
    });
    m.box([-6.78, y + 0.35, -1.1], [-6.6, y + 0.62, -0.72], MAT.LAMP);
    m.box([-6.78, y + 0.35, 0.72], [-6.6, y + 0.62, 1.1], MAT.LAMP);
    figure(m, 88, -7.6, 0.4, Math.PI * 1.5, { stride: 0.1 });
  }
  return m;
}

function tankContainers(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  apron(m, 8, 6);
  // ISO tanks: a barrel slung in a twenty-foot frame. Two of them, plus a
  // flat rack of pipe, because a tank farm of identical cylinders is dull.
  for (let i = 0; i < 2; i++) {
    const z = -2.6 + i * 5.2;
    const y = 0.05 + i * 0;
    m.painted(TINT.METAL_DARK, () => {
      // The frame: four posts and the rails between them.
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          m.box([sx * 3.0 - 0.11, y, z + sz * 1.22 - 0.11],
                [sx * 3.0 + 0.11, y + 2.59, z + sz * 1.22 + 0.11], MAT.TRIM);
        }
        m.box([sx * 3.0 - 0.11, y, z - 1.22], [sx * 3.0 + 0.11, y + 0.18, z + 1.22], MAT.TRIM);
        m.box([sx * 3.0 - 0.11, y + 2.41, z - 1.22], [sx * 3.0 + 0.11, y + 2.59, z + 1.22], MAT.TRIM);
      }
      for (const sz of [-1, 1]) {
        m.box([-3.0, y, z + sz * 1.22 - 0.09], [3.0, y + 0.18, z + sz * 1.22 + 0.09], MAT.TRIM);
        m.box([-3.0, y + 2.41, z + sz * 1.22 - 0.09], [3.0, y + 2.59, z + sz * 1.22 + 0.09], MAT.TRIM);
      }
    });
    // The barrel, lying along the frame with dished ends.
    m.painted(i ? TINT.NONE : TINT.BRAND, () => {
      m.pipe([-2.7, y + 1.32, z], [2.7, y + 1.32, z], 1.02, MAT.METAL, 14);
      m.pipe([-2.94, y + 1.32, z], [-2.7, y + 1.32, z], 0.82, MAT.METAL, 14);
      m.pipe([2.7, y + 1.32, z], [2.94, y + 1.32, z], 0.82, MAT.METAL, 14);
    });
    m.painted(TINT.METAL_DARK, () => {
      m.cylinder(0.4, z, 0.34, y + 2.28, y + 2.5, 10, MAT.TRIM);
      m.box([-0.2, y + 2.5, z - 0.5], [1.0, y + 2.62, z + 0.5], MAT.TRIM);
      m.pipe([-2.4, y + 0.42, z], [-2.4, y + 0.42, z + 1.1], 0.1, MAT.TRIM, 6);
    });
  }
  if (lod < 1) {
    // Hazard placards, which are the one detail that says what is in them.
    for (let i = 0; i < 2; i++) {
      const z = -2.6 + i * 5.2;
      m.painted(TINT.SIGN_LIT, () => {
        m.box([2.95, 0.9, z - 0.4], [3.05, 1.6, z + 0.4], MAT.PLATE);
      });
    }
    figure(m, 46, 0.0, 4.6, Math.PI, { stride: 0.14 });
  }
  return m;
}

function timberStack(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  apron(m, 8, 5);
  // Sawn timber in banded packs on bearers, and sawlogs in a rack. Between
  // them they cover most of what a builders' merchant or a mill yard holds.
  for (let p = 0; p < 3; p++) {
    const x = -5.2 + p * 3.6;
    m.painted(TINT.WOOD, () => {
      for (const z of [-2.6, -1.0]) m.box([x - 1.5, 0.05, z], [x + 1.5, 0.17, z + 0.16], MAT.TIMBER);
    });
    for (let t = 0; t < 3 - (p % 2); t++) {
      m.painted(TINT.WOOD, () => {
        m.box([x - 1.5, 0.17 + t * 0.56, -2.7], [x + 1.5, 0.69 + t * 0.56, -0.7], MAT.TIMBER, { roof: MAT.TIMBER });
      });
      m.painted(TINT.ACCENT, () => {
        for (const bz of [-2.3, -1.1]) {
          m.box([x - 1.54, 0.19 + t * 0.56, bz], [x + 1.54, 0.67 + t * 0.56, bz + 0.06], MAT.PAINT);
        }
      });
    }
  }
  // Log rack: posts, and logs nested in courses.
  m.painted(TINT.METAL_DARK, () => {
    for (const x of [-5.0, 0.0, 5.0]) {
      for (const sz of [-1, 1]) m.box([x - 0.12, 0.05, 2.4 + sz * 1.6 - 0.12], [x + 0.12, 2.2, 2.4 + sz * 1.6 + 0.12], MAT.TRIM);
    }
  });
  for (let r = 0; r < 4; r++) {
    for (let i = 0; i < 5 - r; i++) {
      m.painted(TINT.WOOD, () => {
        m.pipe([-6.0, 0.42 + r * 0.62, 1.0 + i * 0.66 + r * 0.33],
               [6.0, 0.42 + r * 0.62, 1.0 + i * 0.66 + r * 0.33], 0.31, MAT.TIMBER, 8);
      });
    }
  }
  if (lod < 1) {
    for (let i = 0; i < 3; i++) pallet(m, 6.4, 0.05 + i * 0.16, -2.2);
    figure(m, 77, -0.4, -4.0, 0, { stride: 0.18 });
  }
  return m;
}

// ======================================================================= table

const marine = (jobs: number): AssetDef['sim'] => ({
  jobs, powerKW: 0, waterM3: 0, garbagePerWeek: 0, pollution: 0, upkeep: 0,
});

const def = (id: string, name: string, footprint: [number, number], height: number,
  note: string, build: (lod: number) => MeshBuilder): AssetDef => ({
  id, name, zone: 'fleet', density: 'none', variant: 'sculpted',
  footprint, height, sim: marine(0), note, build,
});

export const MARINE: AssetDef[] = [
  def('boat.tug', 'Harbour tug', [3, 2], 11.3,
    'Twenty-one metres of mostly bow: full forward sections, a two-box deckhouse under a wheelhouse, a raked funnel and seven tyre fenders a side.',
    tug),
  def('boat.trawler', 'Fishing trawler', [4, 2], 12.3,
    'Wheelhouse aft over a low working deck, a gantry and net drum over the stern, outriggers stowed against the mast, and fish boxes on deck.',
    trawler),
  def('boat.pilot', 'Pilot boat', [2, 1], 7.0,
    'Fourteen metres, wheelhouse amidships, a light bar and a radar dome on the roof, and a low bulwark round the after deck.',
    pilotBoat),
  def('boat.yacht', 'Motor yacht', [4, 1], 8.1,
    'Fine entry, broad transom, superstructure in two raked steps with a continuous glass band, a radar arch over the flybridge and a swim platform aft.',
    motorYacht),
  def('boat.ferry', 'Passenger ferry', [6, 2], 16.0,
    'Two enclosed decks of seating under an open top deck, wheelhouse forward, funnel aft, lifeboats in davits and a bow ramp hinged up.',
    ferry),
  def('boat.container', 'Container feeder', [12, 3], 31.4,
    'Ninety-two metres, parallel-sided for two thirds of it, five storeys of accommodation aft under a full-width bridge, and eight bays of boxes three tiers high.',
    containerShip),
  def('boat.barge', 'Aggregate barge', [6, 2], 8.4,
    'A box with the ends pushed in: a coamed hold heaped with aggregate, a wheelhouse right aft, and twelve fenders a side.',
    barge),

  def('cargo.containers', 'Container stack', [4, 3], 11.4,
    'Two rows of boxes stacked two to four high with a lane between them, each one its own colour, corner castings and door bars.',
    containerStack),
  def('cargo.pallets', 'Pallet yard', [2, 2], 1.8,
    'Thirteen loaded pallets: cartons stacked out of true, drums banded in fours, and shrink-wrapped blocks with a strap round the middle.',
    palletYard),
  def('cargo.crates', 'Crate and drum yard', [2, 2], 3.0,
    'Braced timber crates stacked two high, nine drums, and a bundle of pipe nested on timber bearers.',
    crateYard),
  def('cargo.trailer', 'Box trailer', [2, 1], 4.2,
    'A tri-axle box trailer standing uncoupled on its landing legs, with side skirts, mudguards and marker lamps.',
    semiTrailer),
  def('cargo.tanks', 'Tank containers', [2, 2], 2.7,
    'Two ISO tanks: a dished barrel slung in a twenty-foot frame, walkway hatch on top, discharge pipe at the bottom and a placard on the end.',
    tankContainers),
  def('cargo.timber', 'Timber yard', [2, 2], 2.6,
    'Banded packs of sawn timber on bearers, and sawlogs nested four courses deep in a posted rack.',
    timberStack),
];
