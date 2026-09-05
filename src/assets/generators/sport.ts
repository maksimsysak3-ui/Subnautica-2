/**
 * Venues, terminals, and the exhibition halls.
 *
 * Everything here is a landmark: one to a city, well over a hundred metres
 * across, and the middle of whatever district it lands in.
 *
 * The first version of these was three rectangles. That is the thing to avoid
 * and it took building them to see why: a stadium read from outside is a
 * silhouette, and three venues with the same silhouette are one venue at three
 * sizes however different their contents. So the geometry here is built on a
 * plan -- a closed loop of points -- rather than on a bounding box, and the
 * three venues have three genuinely different plans: the gridiron stadium is a
 * horseshoe open at one end, the soccer stadium a chamfered oval, the arena a
 * true drum. Everything else follows from that.
 *
 * The other thing that took building them to see: at this size the inside is
 * most of what you look at. A bowl needs terraces you can count, seats with
 * colour in them, vomitories that go somewhere, a tunnel at pitch level and a
 * concourse under the stand. Those are loops over a plan, so they cost lines
 * rather than triangles.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import type { Material } from '../mesh';
import { band, kerb, parapet, railing, roofClutter } from '../parts';
import { figure, parkedVehicle } from './vehicles';
import { IMPORTED_IDS, drawImported } from '../imported';

// ----------------------------------------------------------------- the plan

/** A closed loop of points in plan, counter-clockwise, centred on the origin. */
type Plan = Array<[number, number]>;

/**
 * A rounded rectangle, as `n` points.
 *
 * `round` is how much of the half-width the corner radius takes: 0 is a sharp
 * box and 1 is an ellipse. Everything below is one of these, which is what
 * lets a rectangular pitch sit inside an oval bowl with the terraces running
 * smoothly from one to the other -- both plans have the same point count, so a
 * terrace is just a blend between them.
 */
function roundedPlan(hx: number, hz: number, round: number, n: number): Plan {
  const out: Plan = [];
  // Superellipse. The exponent is what turns a box into an ellipse, and it
  // moves the corner without moving the middle of any side -- which a corner
  // fillet does not, and the sides are where the seats are.
  const e = 2 / Math.max(0.02, round);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    const k = Math.pow(Math.pow(Math.abs(c), e) + Math.pow(Math.abs(s), e), -1 / e);
    out.push([hx * k * c, hz * k * s]);
  }
  return out;
}

/** Point `i` of a plan, blended `t` of the way to the same point of another. */
function blend(a: Plan, b: Plan, t: number, i: number): [number, number] {
  const p = a[i % a.length], q = b[i % b.length];
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
}

/**
 * A raked bowl of terraces between two plans.
 *
 * Each step is a riser and a tread, not a slope: a bowl seen from outside is a
 * stack of horizontal lines, and a smooth ramp has none of them. `open` skips
 * a run of segments, which is how the horseshoe gets its open end.
 */
function bowl(m: MeshBuilder, o: {
  inner: Plan; outer: Plan;
  y0: number; y1: number;
  steps: number;
  mat?: Material;
  /** [first, count] segments to leave out, for a stadium open at one end. */
  open?: [number, number];
  /** Seat colour blocks: how many segments share a colour. */
  block?: number;
}): void {
  const n = o.inner.length;
  const mat = o.mat ?? MAT.CONCRETE;
  const skip = (i: number): boolean => {
    if (!o.open) return false;
    const [from, count] = o.open;
    const k = ((i - from) % n + n) % n;
    return k < count;
  };
  for (let k = 0; k < o.steps; k++) {
    const t0 = k / o.steps, t1 = (k + 1) / o.steps;
    const y0 = o.y0 + t0 * (o.y1 - o.y0), y1 = o.y0 + t1 * (o.y1 - o.y0);
    for (let i = 0; i < n; i++) {
      if (skip(i)) continue;
      const a0 = blend(o.inner, o.outer, t0, i);
      const a1 = blend(o.inner, o.outer, t0, i + 1);
      const b0 = blend(o.inner, o.outer, t1, i);
      const b1 = blend(o.inner, o.outer, t1, i + 1);
      // Riser, in bare concrete.
      m.quad([a0[0], y0, a0[1]], [a1[0], y0, a1[1]],
             [a1[0], y1, a1[1]], [a0[0], y1, a0[1]], mat);
      // Tread, in seat colour. Blocked rather than striped: a real bowl is
      // painted in blocks of a few hundred seats, and blocks give the inside
      // its texture where a stripe just draws a line round it.
      const blk = o.block ?? 6;
      const tint = Math.floor(i / blk) % 3 === 0 ? TINT.ACCENT
        : Math.floor(i / blk) % 3 === 1 ? TINT.BRAND : TINT.BRAND_DARK;
      m.painted(tint, () => {
        m.quad([a0[0], y1, a0[1]], [a1[0], y1, a1[1]],
               [b1[0], y1, b1[1]], [b0[0], y1, b0[1]], MAT.TRIM);
      });
    }
  }
}

/** A vertical skin between a plan at one height and the same plan at another. */
function skin(m: MeshBuilder, plan: Plan, y0: number, y1: number, mat: Material,
  open?: [number, number], inward = false): void {
  const n = plan.length;
  for (let i = 0; i < n; i++) {
    if (open) {
      const k = ((i - open[0]) % n + n) % n;
      if (k < open[1]) continue;
    }
    const a = plan[i], b = plan[(i + 1) % n];
    // A plan runs counter-clockwise in x/z, so the quad a-b-b-a has its normal
    // pointing at the centre, not away from it. Written that way round the
    // arena's shell was back-face culled from outside and the whole building
    // was transparent -- which read, briefly and misleadingly, like a rather
    // good glass drum.
    if (inward) m.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], mat);
    else m.quad([b[0], y0, b[1]], [a[0], y0, a[1]], [a[0], y1, a[1]], [b[0], y1, b[1]], mat);
  }
}

/** A flat ring between two plans at one height: a roof, a deck, an apron. */
function deck(m: MeshBuilder, inner: Plan, outer: Plan, y0: number, y1: number,
  mat: Material, open?: [number, number]): void {
  const n = inner.length;
  for (let i = 0; i < n; i++) {
    if (open) {
      const k = ((i - open[0]) % n + n) % n;
      if (k < open[1]) continue;
    }
    const a0 = inner[i], a1 = inner[(i + 1) % n];
    const b0 = outer[i], b1 = outer[(i + 1) % n];
    m.quad([a0[0], y1, a0[1]], [a1[0], y1, a1[1]], [b1[0], y1, b1[1]], [b0[0], y1, b0[1]], mat);
    if (y1 - y0 > 0.001) {
      m.quad([a1[0], y0, a1[1]], [a0[0], y0, a0[1]], [a0[0], y1, a0[1]], [a1[0], y1, a1[1]], mat);
      m.quad([b0[0], y0, b0[1]], [b1[0], y0, b1[1]], [b1[0], y1, b1[1]], [b0[0], y1, b0[1]], mat);
    }
  }
}

/** Scale a plan about the origin. */
function grow(plan: Plan, sx: number, sz = sx): Plan {
  return plan.map(([x, z]) => [x * sx, z * sz] as [number, number]);
}

/**
 * The concourse under a stand: piers, a dark recess between them, and a fascia.
 *
 * This is what makes a stadium look enterable rather than solid. The recess is
 * a skin set back behind the pier line, so between every pair of piers there
 * is a dark gap that reads as the way in.
 */
function undercroft(m: MeshBuilder, plan: Plan, y0: number, y1: number, every: number): void {
  const back = grow(plan, 0.965);
  skin(m, back, y0, y1, MAT.DARK_TRIM);
  const n = plan.length;
  for (let i = 0; i < n; i += every) {
    const a = plan[i], b = plan[(i + 1) % n];
    const ba = back[i], bb = back[(i + 1) % n];
    m.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], MAT.CONCRETE);
    m.quad([ba[0], y0, ba[1]], [a[0], y0, a[1]], [a[0], y1, a[1]], [ba[0], y1, ba[1]], MAT.CONCRETE);
    m.quad([b[0], y0, b[1]], [bb[0], y0, bb[1]], [bb[0], y1, bb[1]], [b[0], y1, b[1]], MAT.CONCRETE);
  }
}

/** Vomitories: dark slots through the back of a bowl, where the stairs land. */
function vomitories(m: MeshBuilder, plan: Plan, y0: number, y1: number, every: number): void {
  const n = plan.length;
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 2; i < n; i += every) {
      const a = plan[i], b = plan[(i + 1) % n];
      const push = 0.985;
      m.quad([a[0] * push, y0, a[1] * push], [b[0] * push, y0, b[1] * push],
             [b[0] * push, y1, b[1] * push], [a[0] * push, y1, a[1] * push], MAT.TRIM);
    }
  });
}

// --------------------------------------------------------------- furniture

/** A floodlight mast: column, spreader arms, head frame and a grid of lamps. */
function floodMast(m: MeshBuilder, cx: number, cz: number, y0: number, height: number,
  lamps = 4): void {
  m.painted(TINT.METAL_DARK, () => {
    m.cylinder(cx, cz, 0.7, y0, y0 + height, 8, MAT.TRIM, false);
    m.pipe([cx, y0 + height - 7.0, cz], [cx - 3.0, y0 + height, cz], 0.2, MAT.TRIM, 5);
    m.pipe([cx, y0 + height - 7.0, cz], [cx + 3.0, y0 + height, cz], 0.2, MAT.TRIM, 5);
    m.box([cx - 4.6, y0 + height, cz - 1.0], [cx + 4.6, y0 + height + 0.5, cz + 1.0], MAT.TRIM);
  });
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < lamps; i++) {
      const px = cx - 4.0 + (i / (lamps - 1)) * 8.0;
      m.box([px - 0.66, y0 + height + 0.5 + r * 1.2, cz - 0.55],
            [px + 0.66, y0 + height + 1.6 + r * 1.2, cz + 0.55], MAT.LAMP);
    }
  }
}

/** A big screen on a gantry: frame, face and the truss carrying it. */
function bigScreen(m: MeshBuilder, cx: number, cz: number, y: number, w: number, h: number,
  facing: 1 | -1): void {
  m.painted(TINT.METAL_DARK, () => {
    m.box([cx - w / 2 - 0.6, y - 0.6, cz - 0.8], [cx + w / 2 + 0.6, y + h + 0.6, cz + 0.8], MAT.TRIM);
    for (const s of [-1, 1]) {
      m.pipe([cx + s * w * 0.32, y - 0.6, cz], [cx + s * w * 0.32, y - 8.0, cz - facing * 2.5], 0.34, MAT.TRIM, 6);
    }
  });
  m.painted(TINT.SIGN_LIT, () => {
    m.box([cx - w / 2, y, cz + facing * 0.8], [cx + w / 2, y + h, cz + facing * 0.95], MAT.PLATE);
  });
}

/**
 * A car park: bays, markings, lamp columns and a scatter of vehicles.
 *
 * The bays run the whole park -- they are two quads each -- and the cars fill
 * the rows nearest the gate up to `cap`, which is where they would be anyway.
 * A model in every one of three hundred bays is more geometry than the
 * stadium.
 */
function carPark(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number,
  seed: number, dense = 0.55, cap = 8): void {
  m.box([x0, 0.0005, z0], [x1, 0.06, z1], MAT.GROUND);
  const bayW = 2.6, rowD = 5.4;
  const cols = Math.max(1, Math.floor((x1 - x0) / bayW));
  const rows = Math.max(1, Math.floor((z1 - z0) / rowD));
  m.painted(TINT.NONE, () => {
    for (let r = 0; r <= rows; r++) {
      const z = z0 + r * rowD;
      if (z > z1) break;
      m.box([x0, 0.06, z - 0.06], [x1, 0.08, z + 0.06], MAT.PLATE);
    }
  });
  let n = seed, drawn = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      n = (n * 1103515245 + 12345) & 0x7fffffff;
      const x = x0 + (c + 0.5) * bayW, z = z0 + (r + 0.5) * rowD;
      m.box([x - bayW / 2, 0.06, z - rowD / 2 + 0.2], [x - bayW / 2 + 0.1, 0.08, z + rowD / 2 - 0.2], MAT.PLATE);
      if (drawn < cap && (n >> 8) % 100 < dense * 100) {
        parkedVehicle(m, n >> 4, x, z, r % 2 === 0 ? 1 : 3, 'car');
        drawn++;
      }
    }
  }
  m.painted(TINT.METAL_DARK, () => {
    for (let r = 1; r < rows; r += 2) {
      const z = z0 + r * rowD;
      for (let i = 0; i <= 2; i++) {
        const x = x0 + (i / 2) * (x1 - x0);
        m.cylinder(x, z, 0.18, 0.06, 8.0, 6, MAT.TRIM, false);
        m.box([x - 0.9, 8.0, z - 0.35], [x + 0.9, 8.5, z + 0.35], MAT.LAMP);
      }
    }
  });
}

/** Turnstile pods: two posts, a canopy and a lit sign over each. */
function turnstiles(m: MeshBuilder, x0: number, x1: number, z: number, count: number,
  y = 0.35): void {
  for (let i = 0; i < count; i++) {
    const x = x0 + ((i + 0.5) / count) * (x1 - x0);
    m.painted(TINT.METAL_DARK, () => {
      m.box([x - 1.5, y, z - 0.5], [x - 1.2, y + 1.0, z + 0.5], MAT.TRIM);
      m.box([x + 1.2, y, z - 0.5], [x + 1.5, y + 1.0, z + 0.5], MAT.TRIM);
      m.box([x - 1.6, y + 2.6, z - 0.7], [x + 1.6, y + 2.9, z + 0.7], MAT.TRIM);
      for (const sx of [-1.4, 1.4]) m.cylinder(x + sx, z, 0.09, y, y + 2.6, 6, MAT.TRIM, false);
    });
    m.painted(TINT.SIGN_LIT, () => {
      m.box([x - 1.2, y + 2.9, z - 0.1], [x + 1.2, y + 3.5, z + 0.1], MAT.PLATE);
    });
  }
}

/** A painted line loop on a playing surface. */
function markings(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number, y: number,
  w = 0.22): void {
  m.painted(TINT.NONE, () => {
    m.box([x0, y, z0], [x1, y + 0.02, z0 + w], MAT.PLATE);
    m.box([x0, y, z1 - w], [x1, y + 0.02, z1], MAT.PLATE);
    m.box([x0, y, z0], [x0 + w, y + 0.02, z1], MAT.PLATE);
    m.box([x1 - w, y, z0], [x1, y + 0.02, z1], MAT.PLATE);
  });
}

/** Mown bands across a pitch, which is what stops flat turf reading as a sheet. */
function mown(m: MeshBuilder, hx: number, hz: number, y: number, bands: number): void {
  m.painted(TINT.GREEN_DARK, () => {
    for (let i = 0; i < bands; i += 2) {
      const x = -hx + (i / bands) * hx * 2;
      m.box([x, y, -hz], [x + (hx * 2) / bands, y + 0.01, hz], MAT.TRIM);
    }
  });
}

/** A players' tunnel: a portal in the front wall of the bowl with a hood. */
function tunnel(m: MeshBuilder, cx: number, cz: number, facing: 1 | -1, w: number, h: number): void {
  m.painted(TINT.METAL_DARK, () => {
    m.box([cx - w / 2 - 0.5, 0.2, cz - 0.6], [cx + w / 2 + 0.5, h + 0.6, cz + 0.6], MAT.TRIM);
    m.box([cx - w / 2 - 0.9, 0.2, cz], [cx + w / 2 + 0.9, h + 1.0, cz + facing * 3.4], MAT.TRIM);
  });
  m.box([cx - w / 2, 0.2, cz - 0.7], [cx + w / 2, h, cz + 0.7], MAT.DARK_TRIM);
}

/** Team benches: a roofed run of seats at pitch level. */
function bench(m: MeshBuilder, cx: number, cz: number, len: number): void {
  m.painted(TINT.METAL_DARK, () => {
    m.box([cx - len / 2, 0.2, cz - 0.9], [cx + len / 2, 2.4, cz + 0.9], MAT.TRIM, { roof: MAT.TRIM });
  });
  m.box([cx - len / 2 + 0.4, 0.9, cz - 1.0], [cx + len / 2 - 0.4, 2.1, cz - 0.85], MAT.GLASS);
  m.painted(TINT.BRAND, () => {
    m.box([cx - len / 2 + 0.4, 0.55, cz - 0.4], [cx + len / 2 - 0.4, 0.95, cz + 0.6], MAT.TRIM);
  });
}

// ==================================================================== venues

/**
 * A gridiron stadium: a horseshoe, open at the south end.
 *
 * The shape is the point. Every American stadium of this vintage is a bowl
 * with one end left open -- for the scoreboard, for the plaza, for the view --
 * and it is what stops this reading as the same object as the soccer ground.
 * The open end also does the library a favour: you can see straight into the
 * bowl from outside, so the terraces, the tunnel and the benches are all doing
 * work rather than being hidden behind a wall.
 */
function gridiron(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const N = 48;
  const fx = 55.0, fz = 24.5;                    // field, both end zones in
  const OPEN: [number, number] = [36, 9];        // segments left out, the south end

  const inner = roundedPlan(fx + 6.0, fz + 7.0, 0.16, N);
  const mid = roundedPlan(fx + 22.0, fz + 26.0, 0.34, N);
  const outer = roundedPlan(fx + 36.0, fz + 42.0, 0.42, N);

  m.box([-118, 0.0005, -96], [118, 0.1, 96], MAT.CONCRETE);

  // The field.
  m.painted(TINT.GREEN, () => m.box([-fx, 0.1, -fz], [fx, 0.2, fz], MAT.TRIM));
  mown(m, fx, fz, 0.2, 12);
  m.painted(TINT.BRAND, () => {
    m.box([-fx, 0.21, -fz], [-fx + 9.1, 0.23, fz], MAT.TRIM);
    m.box([fx - 9.1, 0.21, -fz], [fx, 0.23, fz], MAT.TRIM);
  });
  markings(m, -fx, -fz, fx, fz, 0.21, 0.3);
  if (medium) {
    m.painted(TINT.NONE, () => {
      for (let i = 1; i < 22; i++) {
        const x = -fx + 9.1 + (i / 22) * (fx - 9.1) * 2;
        m.box([x - 0.12, 0.21, -fz + 0.4], [x + 0.12, 0.23, fz - 0.4], MAT.PLATE);
      }
      // Hash marks: two rows of stubs down the middle, which is the one detail
      // that is gridiron and nothing else.
      for (let i = 1; i < 44; i++) {
        const x = -fx + 9.1 + (i / 44) * (fx - 9.1) * 2;
        for (const z of [-6.0, 6.0]) m.box([x - 0.1, 0.21, z - 0.5], [x + 0.1, 0.23, z + 0.5], MAT.PLATE);
      }
    });
    m.painted(TINT.ACCENT, () => {
      for (const s of [1, -1]) {
        m.cylinder(s * (fx - 0.6), 0, 0.18, 0.2, 3.0, 8, MAT.PAINT, false);
        m.box([s * (fx - 0.75), 3.0, -2.8], [s * (fx - 0.45), 3.2, 2.8], MAT.PAINT);
        for (const t of [1, -1]) m.cylinder(s * (fx - 0.6), t * 2.8, 0.15, 3.2, 9.6, 6, MAT.PAINT, false);
      }
    });
  }

  // The bowl: a lower tier, a ring of boxes, an upper tier. The horseshoe is
  // one `open` argument threaded through all of them.
  bowl(m, { inner, outer: mid, y0: 1.8, y1: 17.0, steps: 13, open: OPEN, block: 5 });
  undercroft(m, inner, 0.2, 1.8, 3);
  if (medium) {
    // The hospitality ring: glazed boxes on the break between tiers, which is
    // the horizontal line that stops a bowl reading as one long ramp.
    deck(m, grow(mid, 0.90), grow(mid, 1.02), 17.0, 17.9, MAT.CLADDING, OPEN);
    skin(m, grow(mid, 0.90), 17.9, 21.4, MAT.GLASS, OPEN, true);
    skin(m, grow(mid, 1.02), 17.9, 21.4, MAT.CLADDING, OPEN);
    deck(m, grow(mid, 0.90), grow(mid, 1.02), 21.4, 22.2, MAT.METAL, OPEN);
    bowl(m, { inner: grow(mid, 0.94), outer, y0: 22.4, y1: 46.0, steps: 15, open: OPEN, block: 6 });
    vomitories(m, outer, 24.0, 44.0, 4);
    skin(m, outer, 0.2, 46.0, MAT.CONCRETE, OPEN);
    // Roof over the back rows only, with a translucent leading edge. Roofed to
    // the touchline it is a lid with a hole in it and the bowl disappears.
    deck(m, grow(outer, 0.84), grow(outer, 1.03), 49.0, 50.6, MAT.METAL, OPEN);
    deck(m, grow(outer, 0.74), grow(outer, 0.84), 49.2, 50.2, MAT.GLASS, OPEN);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < N; i += 3) {
        const k = ((i - OPEN[0]) % N + N) % N;
        if (k < OPEN[1]) continue;
        const p = outer[i];
        m.pipe([p[0] * 0.97, 42.0, p[1] * 0.97], [p[0] * 1.02, 49.0, p[1] * 1.02], 0.32, MAT.TRIM, 5);
      }
    });
    // The scoreboard stands in the open end, which is what an open end is for.
    bigScreen(m, 0, fz + 46.0, 26.0, 46.0, 20.0, -1);
  }

  if (fine) {
    tunnel(m, 0, -fz - 5.6, -1, 5.0, 4.0);
    bench(m, -24.0, fz + 4.4, 22.0);
    bench(m, 24.0, fz + 4.4, 22.0);
    for (const [sx, sz] of [[-1, -1], [1, -1]] as const) {
      floodMast(m, sx * (fx + 30.0), sz * (fz + 40.0), 0.2, 58.0, 5);
    }
    turnstiles(m, -40, 40, -fz - 44.0, 9, 0.2);
    carPark(m, -114, -92, -96, 92, 11, 0.6, 10);
    carPark(m, 96, -92, 114, 92, 29, 0.6, 10);
    kerb(m, -100, -88, 100, 88);
    for (let i = 0; i < 12; i++) {
      figure(m, 900 + i * 7, -40 + i * 7.2, -fz - 47.0, 0, { stride: 0.2 });
    }
  }
  return m;
}

/**
 * A soccer stadium: a chamfered oval under one continuous roof.
 *
 * The European shape, and deliberately the opposite of the horseshoe: closed
 * all the way round, one sweep of seating from the touchline to the back, and
 * a roof over the whole of it. What you see from outside is a drum; what you
 * see from above is the bowl.
 */
function soccer(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const N = 56;
  const fx = 52.5, fz = 34.0;                   // 105 x 68, regulation

  const inner = roundedPlan(fx + 5.5, fz + 6.0, 0.20, N);
  const outer = roundedPlan(fx + 34.0, fz + 34.0, 0.62, N);

  m.box([-110, 0.0005, -92], [110, 0.1, 92], MAT.CONCRETE);
  m.painted(TINT.GREEN, () => m.box([-fx, 0.1, -fz], [fx, 0.2, fz], MAT.TRIM));
  mown(m, fx, fz, 0.2, 8);
  markings(m, -fx, -fz, fx, fz, 0.21, 0.24);
  if (medium) {
    m.painted(TINT.NONE, () => {
      m.box([-0.12, 0.21, -fz], [0.12, 0.23, fz], MAT.PLATE);
      for (const s of [1, -1]) {
        m.box([s * fx - s * 16.5, 0.21, -20.2], [s * fx - s * 16.26, 0.23, 20.2], MAT.PLATE);
        m.box([s * fx - s * 16.5, 0.21, -20.2], [s * fx, 0.23, -19.96], MAT.PLATE);
        m.box([s * fx - s * 16.5, 0.21, 19.96], [s * fx, 0.23, 20.2], MAT.PLATE);
        m.box([s * fx - s * 5.5, 0.21, -9.2], [s * fx - s * 5.26, 0.23, 9.2], MAT.PLATE);
      }
      // The centre circle, as a ring of short chords.
      for (let i = 0; i < 28; i++) {
        const a0 = (i / 28) * Math.PI * 2, a1 = ((i + 1) / 28) * Math.PI * 2;
        m.pipe([Math.cos(a0) * 9.15, 0.22, Math.sin(a0) * 9.15],
               [Math.cos(a1) * 9.15, 0.22, Math.sin(a1) * 9.15], 0.12, MAT.PLATE, 4);
      }
    });
    for (const s of [1, -1]) {
      m.box([s * fx, 0.2, -3.66], [s * fx + s * 0.14, 2.44, -3.52], MAT.TRIM);
      m.box([s * fx, 0.2, 3.52], [s * fx + s * 0.14, 2.44, 3.66], MAT.TRIM);
      m.box([s * fx, 2.30, -3.66], [s * fx + s * 0.14, 2.44, 3.66], MAT.TRIM);
      // The net, as a translucent box behind the frame.
      m.box([s * fx + s * 0.14, 0.2, -3.6], [s * fx + s * 2.0, 2.3, 3.6], MAT.GLASS);
    }
  }

  bowl(m, { inner, outer: grow(outer, 0.80), y0: 2.0, y1: 24.0, steps: 16, block: 7 });
  undercroft(m, inner, 0.2, 2.0, 3);
  if (medium) {
    // The upper ring, set back over a band of boxes.
    deck(m, grow(outer, 0.74), grow(outer, 0.83), 24.0, 24.9, MAT.CLADDING);
    skin(m, grow(outer, 0.74), 24.9, 28.4, MAT.GLASS, undefined, true);
    bowl(m, { inner: grow(outer, 0.78), outer, y0: 28.6, y1: 44.0, steps: 11, block: 8 });
    vomitories(m, outer, 30.0, 42.0, 5);
    skin(m, outer, 0.2, 44.0, MAT.CLADDING);
    // The outer skin gets a louvred band and a brand fascia, because a drum
    // this size with nothing on it is a gasholder.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < N; i += 2) {
        const p = outer[i], q = outer[(i + 1) % N];
        m.quad([p[0] * 1.012, 8.0, p[1] * 1.012], [q[0] * 1.012, 8.0, q[1] * 1.012],
               [q[0] * 1.012, 34.0, q[1] * 1.012], [p[0] * 1.012, 34.0, p[1] * 1.012], MAT.TRIM);
      }
    });
    m.painted(TINT.BRAND, () => {
      deck(m, grow(outer, 1.00), grow(outer, 1.05), 44.0, 46.6, MAT.CLADDING);
    });
    // One continuous roof, opaque outside and translucent at the leading edge.
    deck(m, grow(outer, 0.82), grow(outer, 1.05), 47.0, 48.8, MAT.METAL);
    deck(m, grow(outer, 0.68), grow(outer, 0.82), 47.2, 48.4, MAT.GLASS);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < N; i += 3) {
        const p = outer[i];
        m.pipe([p[0] * 0.98, 40.0, p[1] * 0.98], [p[0] * 1.04, 47.0, p[1] * 1.04], 0.34, MAT.TRIM, 5);
        m.pipe([p[0] * 1.04, 47.0, p[1] * 1.04], [p[0] * 0.70, 47.4, p[1] * 0.70], 0.20, MAT.TRIM, 4);
      }
    });
    bigScreen(m, -fx - 18.0, -fz - 14.0, 30.0, 24.0, 11.0, 1);
    bigScreen(m, fx + 18.0, fz + 14.0, 30.0, 24.0, 11.0, -1);
  }

  if (fine) {
    tunnel(m, 0, -fz - 4.6, -1, 4.4, 3.6);
    bench(m, -14.0, fz + 3.6, 16.0);
    bench(m, 14.0, fz + 3.6, 16.0);
    turnstiles(m, -34, 34, -fz - 36.0, 9, 0.2);
    carPark(m, -106, -86, -92, 86, 13, 0.6, 10);
    carPark(m, 92, -86, 106, 86, 31, 0.6, 10);
    kerb(m, -96, -84, 96, 84);
    for (let i = 0; i < 12; i++) figure(m, 500 + i * 11, -34 + i * 6.2, -fz - 39.0, 0, { stride: 0.18 });
  }
  return m;
}

/**
 * An ice arena: a drum with a glazed oculus over the rink.
 *
 * The first attempt at this was a clad box, and it was the worst thing in the
 * library: an arena's whole interest is that it is a bowl inside a shell, and
 * a box shows you neither. So this is a true round drum -- a shape nothing
 * else here has -- and the roof is a ring rather than a lid, with the rink,
 * the boards and the seating bowl visible down through it. That is not a
 * liberty: every arena of the last thirty years has a lit oculus or a
 * skylight ring, and it is the only honest way to show an interior on a
 * building whose interior is the point.
 */
function arena(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const N = 48;
  const rx = 30.5, rz = 14.0;                   // the rink: 61 x 28

  const rinkPlan = roundedPlan(rx + 4.0, rz + 4.5, 0.42, N);
  const bowlTop = roundedPlan(rx + 26.0, rz + 26.0, 0.86, N);
  const shell = roundedPlan(rx + 33.0, rz + 33.0, 0.94, N);

  m.box([-84, 0.0005, -76], [84, 0.1, 76], MAT.CONCRETE);

  // The rink: white ice, blue lines, a red centre line and two creases.
  m.box([-rx - 1.2, 0.1, -rz - 1.2], [rx + 1.2, 0.9, rz + 1.2], MAT.CONCRETE);
  m.box([-rx, 0.9, -rz], [rx, 1.0, rz], MAT.PLASTER);
  m.painted(TINT.NONE, () => {
    m.box([-0.2, 1.0, -rz], [0.2, 1.02, rz], MAT.PLATE);
  });
  m.painted(TINT.BRAND, () => {
    for (const x of [-rx * 0.42, rx * 0.42]) m.box([x - 0.22, 1.0, -rz], [x + 0.22, 1.02, rz], MAT.TRIM);
    for (const x of [-rx * 0.78, rx * 0.78]) m.box([x - 0.14, 1.0, -rz], [x + 0.14, 1.02, rz], MAT.TRIM);
  });
  if (medium) {
    // Faceoff circles and the goals, which is what makes it a hockey rink and
    // not a swimming pool.
    m.painted(TINT.ACCENT, () => {
      for (const cx of [-rx * 0.6, rx * 0.6]) {
        for (const cz of [-rz * 0.55, rz * 0.55]) {
          for (let i = 0; i < 20; i++) {
            const a0 = (i / 20) * Math.PI * 2, a1 = ((i + 1) / 20) * Math.PI * 2;
            m.pipe([cx + Math.cos(a0) * 4.5, 1.01, cz + Math.sin(a0) * 4.5],
                   [cx + Math.cos(a1) * 4.5, 1.01, cz + Math.sin(a1) * 4.5], 0.09, MAT.PAINT, 4);
          }
        }
      }
    });
    m.painted(TINT.ACCENT, () => {
      for (const s of [1, -1]) {
        m.box([s * rx * 0.78 - s * 3.0, 1.0, -2.4], [s * rx * 0.78, 1.02, 2.4], MAT.PAINT);
        m.box([s * rx * 0.78 - s * 0.1, 1.0, -0.95], [s * rx * 0.78 - s * 1.9, 2.05, -0.85], MAT.PAINT);
        m.box([s * rx * 0.78 - s * 0.1, 1.0, 0.85], [s * rx * 0.78 - s * 1.9, 2.05, 0.95], MAT.PAINT);
        m.box([s * rx * 0.78 - s * 0.1, 1.95, -0.95], [s * rx * 0.78 - s * 1.9, 2.05, 0.95], MAT.PAINT);
      }
    });
    // The boards and the glass above them: the rink's own wall, which is the
    // single most recognisable thing about an ice pad.
    skin(m, rinkPlan, 1.0, 2.0, MAT.PLASTER);
    m.painted(TINT.BRAND, () => skin(m, grow(rinkPlan, 1.004), 1.0, 1.45, MAT.TRIM));
    skin(m, grow(rinkPlan, 1.002), 2.0, 3.8, MAT.GLASS);
  }

  // The seating bowl, ringing the rink, and the shell round that.
  bowl(m, { inner: grow(rinkPlan, 1.12), outer: bowlTop, y0: 2.6, y1: 21.0, steps: 15, block: 5 });
  undercroft(m, grow(rinkPlan, 1.12), 1.0, 2.6, 3);
  skin(m, shell, 0.1, 8.0, MAT.STONE);
  skin(m, shell, 8.0, 28.0, MAT.CLADDING);
  if (medium) {
    // A glazed band round the concourse level, so the drum has floors in it.
    skin(m, grow(shell, 1.01), 9.5, 13.0, MAT.GLASS);
    skin(m, grow(shell, 1.01), 16.0, 19.0, MAT.GLASS);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < N; i += 1) {
        const p = shell[i];
        m.pipe([p[0] * 1.02, 8.0, p[1] * 1.02], [p[0] * 1.02, 28.0, p[1] * 1.02], 0.16, MAT.TRIM, 4);
      }
    });
    m.painted(TINT.BRAND, () => {
      deck(m, grow(shell, 1.00), grow(shell, 1.06), 28.0, 31.2, MAT.CLADDING);
    });
    // The roof: a ring from the shell in to the back of the bowl, then a
    // glazed oculus over the rink itself.
    deck(m, grow(bowlTop, 0.62), grow(shell, 1.06), 31.4, 33.2, MAT.ROOF);
    deck(m, grow(rinkPlan, 1.30), grow(bowlTop, 0.62), 32.0, 32.6, MAT.GLASS);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < N; i += 4) {
        const p = shell[i], q = rinkPlan[i];
        m.pipe([p[0], 31.4, p[1]], [q[0] * 1.30, 32.0, q[1] * 1.30], 0.26, MAT.TRIM, 5);
      }
      // The scoreboard, hung over centre ice on four cables.
      m.box([-5.0, 24.0, -4.0], [5.0, 29.0, 4.0], MAT.TRIM);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        m.pipe([sx * 4.4, 29.0, sz * 3.4], [sx * 10.0, 32.0, sz * 8.0], 0.07, MAT.TRIM, 4);
      }
    });
    m.painted(TINT.SIGN_LIT, () => {
      for (const s of [1, -1]) {
        m.box([s * 5.0, 24.6, -3.4], [s * 5.1, 28.4, 3.4], MAT.PLATE);
        m.box([-3.4, 24.6, s * 4.0], [3.4, 28.4, s * 4.1], MAT.PLATE);
      }
    });
    roofClutter(m, -26, 18, 26, 34, 33.2, 71, 0.7);
  }

  if (fine) {
    // The entrance: a cantilevered canopy on the south side, with the name over
    // it, and a plaza in front.
    m.box([-24.0, 0.1, -shell[0][1] - 26.0], [24.0, 0.2, -rz - 40.0], MAT.CONCRETE);
    m.painted(TINT.METAL_DARK, () => {
      m.box([-22.0, 9.6, -60.0], [22.0, 10.4, -44.0], MAT.TRIM);
      for (const x of [-18.0, -6.0, 6.0, 18.0]) m.cylinder(x, -57.0, 0.4, 0.2, 9.6, 8, MAT.TRIM, false);
    });
    m.painted(TINT.SIGN_LIT, () => m.box([-18.0, 31.6, -47.0], [18.0, 35.4, -46.6], MAT.PLATE));
    turnstiles(m, -20, 20, -52.0, 7, 0.2);
    // Service yard with dock levellers and a truck backed on.
    m.box([48.0, 0.1, -16.0], [76.0, 0.16, 16.0], MAT.GROUND);
    m.painted(TINT.METAL_DARK, () => {
      for (const z of [-8.0, 0.0, 8.0]) {
        m.box([47.6, 1.2, z - 2.2], [48.4, 5.0, z + 2.2], MAT.TRIM);
        m.box([47.5, 5.0, z - 2.6], [50.4, 5.6, z + 2.6], MAT.TRIM);
      }
    });
    parkedVehicle(m, 91, 60.0, 8.0, 2, 'truck');
    parkedVehicle(m, 57, 60.0, -8.0, 2, 'van');
    carPark(m, -80, 30, 80, 72, 17, 0.5, 10);
    kerb(m, -78, -70, 78, 74);
    for (let i = 0; i < 12; i++) figure(m, 700 + i * 13, -22.0 + i * 4.0, -55.0, 0, { stride: 0.22 });
  }
  return m;
}

// ================================================================= terminals

/**
 * An airport terminal: a landside hall, two piers and six stands.
 *
 * The first one was a shed with two bridges. An airport is a diagram before it
 * is a building -- kerb, hall, security, pier, stand -- and it only reads as
 * one if each of those is a distinct piece with the next one behind it. So:
 * a multi-storey car park at the kerb, a departures viaduct into a
 * double-height hall, two piers running out from the hall at an angle, and the
 * stands hung off the piers with the aircraft actually on them.
 */
function airTerminal(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;

  m.box([-140, 0.0005, -104], [140, 0.1, 104], MAT.CONCRETE);
  // Apron, with stand markings and lead-in lines.
  m.box([-134, 0.1, 4.0], [134, 0.16, 100], MAT.GROUND);
  m.painted(TINT.NONE, () => {
    for (const cx of [-96.0, -32.0, 32.0, 96.0]) {
      m.box([cx - 0.25, 0.16, 12.0], [cx + 0.25, 0.18, 90.0], MAT.PLATE);
      m.box([cx - 18.0, 0.16, 56.0], [cx + 18.0, 0.18, 56.5], MAT.PLATE);
    }
    // The taxiway, right at the back.
    m.box([-134, 0.16, 94.0], [134, 0.18, 94.6], MAT.PLATE);
  });

  /** One pier: a glazed tube on a plinth, with a roof and a gate lounge line. */
  const pier = (x0: number, x1: number, z0: number, z1: number): void => {
    m.box([x0, 0.1, z0], [x1, 5.0, z1], MAT.CONCRETE);
    m.box([x0 + 0.8, 5.0, z0 + 0.8], [x1 - 0.8, 14.0, z1 - 0.8], MAT.GLASS);
    m.painted(TINT.METAL_DARK, () => {
      const n = Math.max(4, Math.round((x1 - x0) / 6.0));
      for (let i = 0; i <= n; i++) {
        const x = x0 + (i / n) * (x1 - x0);
        for (const z of [z0 + 0.8, z1 - 0.8]) m.cylinder(x, z, 0.3, 5.0, 14.4, 6, MAT.TRIM, false);
      }
    });
    // A shallow curved roof: seven strips on a sine, so it is a vault and not
    // a slab.
    for (let i = 0; i < 7; i++) {
      const t0 = i / 7, t1 = (i + 1) / 7;
      const c0 = Math.sin(t0 * Math.PI), c1 = Math.sin(t1 * Math.PI);
      const a = z0 - 2.5 + t0 * (z1 - z0 + 5.0), b = z0 - 2.5 + t1 * (z1 - z0 + 5.0);
      m.box([x0 - 2.5, 14.0 + Math.min(c0, c1) * 3.2, a],
            [x1 + 2.5, 14.7 + Math.max(c0, c1) * 3.2, b], MAT.METAL);
    }
  };

  // Landside hall, wider and taller than the piers, with a full-height glass
  // wall to the kerb.
  m.box([-46.0, 0.1, -30.0], [46.0, 6.0, 6.0], MAT.CONCRETE);
  m.box([-45.0, 6.0, -29.0], [45.0, 22.0, 5.0], MAT.GLASS);
  for (let i = 0; i < 9; i++) {
    const t0 = i / 9, t1 = (i + 1) / 9;
    const c0 = Math.sin(t0 * Math.PI), c1 = Math.sin(t1 * Math.PI);
    const a = -33.0 + t0 * 42.0, b = -33.0 + t1 * 42.0;
    m.box([-49.0, 22.0 + Math.min(c0, c1) * 6.5, a], [49.0, 23.0 + Math.max(c0, c1) * 6.5, b], MAT.METAL);
  }
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i <= 15; i++) {
      const x = -45.0 + (i / 15) * 90.0;
      m.cylinder(x, -29.0, 0.42, 6.0, 22.6, 8, MAT.TRIM, false);
    }
  });

  pier(-124.0, -20.0, 8.0, 22.0);
  pier(20.0, 124.0, 8.0, 22.0);

  if (medium) {
    // Jet bridges, one per stand, reaching from the pier to the aircraft.
    for (const cx of [-96.0, -32.0, 32.0, 96.0]) {
      m.painted(TINT.METAL_DARK, () => {
        m.cylinder(cx, 24.0, 2.4, 0.16, 6.5, 10, MAT.TRIM);
        m.box([cx - 2.0, 6.5, 24.0], [cx + 2.0, 10.0, 44.0], MAT.CLADDING, { roof: MAT.ROOF });
        m.box([cx - 2.4, 10.0, 41.0], [cx + 2.4, 10.9, 46.0], MAT.TRIM);
        for (const z of [32.0, 42.0]) m.cylinder(cx, z, 0.55, 0.16, 6.5, 6, MAT.TRIM, false);
      });
      m.box([cx - 1.8, 7.5, 24.0], [cx + 1.8, 9.2, 43.8], MAT.GLASS);
    }
    // Departures viaduct and its canopy over the kerb.
    m.box([-52.0, 5.2, -44.0], [52.0, 6.0, -30.0], MAT.CONCRETE);
    m.painted(TINT.METAL_DARK, () => {
      for (const x of [-44.0, -22.0, 0.0, 22.0, 44.0]) m.cylinder(x, -40.0, 0.9, 0.1, 5.2, 8, MAT.TRIM, false);
      m.box([-52.0, 12.0, -46.0], [52.0, 12.8, -30.0], MAT.TRIM);
      for (const x of [-46.0, -16.0, 16.0, 46.0]) m.cylinder(x, -43.0, 0.42, 6.0, 12.0, 8, MAT.TRIM, false);
    });
    railing(m, -52.0, 52.0, -44.2, 6.0, 1.1, 3.0);
    m.painted(TINT.SIGN_LIT, () => {
      m.box([-26.0, 23.5, -29.6], [26.0, 27.5, -29.2], MAT.PLATE);
    });
    // Control tower: a shaft, a raked cab and a mast.
    m.cylinder(66.0, -46.0, 4.6, 0.1, 40.0, 14, MAT.CONCRETE, false);
    m.cone(66.0, -46.0, 7.2, 5.8, 40.0, 45.5, 14, MAT.GLASS);
    m.painted(TINT.METAL_DARK, () => {
      m.cone(66.0, -46.0, 7.9, 8.4, 45.5, 47.2, 14, MAT.TRIM);
      m.cylinder(66.0, -46.0, 0.22, 47.2, 54.0, 6, MAT.TRIM, false);
    });
    // Multi-storey car park at the kerb: four decks with an open ramp end.
    for (let f = 0; f < 4; f++) {
      const y = 0.1 + f * 3.4;
      m.box([-44.0, y, -92.0], [44.0, y + 0.45, -54.0], MAT.CONCRETE);
      m.painted(TINT.METAL_DARK, () => {
        m.box([-44.2, y + 0.45, -92.2], [44.2, y + 1.5, -91.8], MAT.TRIM);
        m.box([-44.2, y + 0.45, -54.2], [44.2, y + 1.5, -53.8], MAT.TRIM);
      });
    }
    for (const x of [-40.0, -20.0, 0.0, 20.0, 40.0]) {
      for (const z of [-88.0, -72.0, -58.0]) m.box([x - 0.6, 0.1, z - 0.6], [x + 0.6, 13.9, z + 0.6], MAT.CONCRETE);
    }
  }

  if (fine) {
    parapet(m, -46.0, -30.0, 46.0, 6.0, 6.0, 0.6, 0.3, MAT.TRIM);
    // Aircraft on two of the four stands.
    const wide = IMPORTED_IDS.find((id) => id.startsWith('air.widebody'));
    const small = IMPORTED_IDS.find((id) => id.startsWith('air.airliner'));
    // The clustered copies. A widebody is nine thousand triangles on its own
    // and there are two of them parked beside a building that is already the
    // biggest thing in the library.
    if (wide) drawImported(m, wide, { cx: -96.0, cz: 58.0, turns: 1, low: true });
    if (small) drawImported(m, small, { cx: 32.0, cz: 54.0, turns: 1, low: true });
    // Ground fleet along the apron and the service road behind the piers.
    for (let i = 0; i < 8; i++) {
      parkedVehicle(m, 400 + i * 9, -112 + i * 30, 84.0, 1, i % 3 === 0 ? 'truck' : 'van');
    }
    for (let i = 0; i < 4; i++) parkedVehicle(m, 470 + i * 5, -60 + i * 40, -50.0, 3, 'car');
    carPark(m, -130, -100, -50, -50, 23, 0.5, 8);
    carPark(m, 50, -100, 130, -50, 41, 0.5, 8);
    kerb(m, -54.0, -50.0, 54.0, -30.0);
    for (let i = 0; i < 14; i++) {
      figure(m, 300 + i * 17, -46 + i * 7.0, -34.0, 0, { stride: 0.2, bag: true });
    }
  }
  return m;
}

/**
 * A container terminal: quay, gantry cranes and a stacking yard.
 *
 * The other half of the boats. Two ship-to-shore gantries straddling the
 * quayside, a yard of boxes behind them, and the cranes are what makes it: a
 * fifty-metre portal frame with a boom out over the water is a silhouette
 * nothing else in the library has.
 */
function containerTerminal(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;

  m.box([-72, 0.0005, -56], [72, 0.06, -18.0], MAT.WATER);
  m.box([-72, 0.0005, -18.0], [72, 1.8, 56], MAT.CONCRETE);
  m.painted(TINT.METAL_DARK, () => {
    m.box([-72, 1.4, -18.6], [72, 1.9, -17.6], MAT.TRIM);
    for (let i = 0; i < 15; i++) {
      const x = -68 + i * 9.7;
      m.cylinder(x, -18.0, 0.55, 1.9, 2.9, 8, MAT.TRIM);
      m.box([x - 1.1, 0.2, -19.0], [x + 1.1, 1.4, -18.4], MAT.TYRE);
    }
  });

  const gantry = (cx: number): void => {
    const H = 44.0, legZ = [-14.0, 10.0];
    m.painted(TINT.ACCENT, () => {
      for (const sx of [-1, 1]) {
        for (const z of legZ) {
          m.box([cx + sx * 11.0 - 1.1, 1.8, z - 1.1], [cx + sx * 11.0 + 1.1, H, z + 1.1], MAT.PAINT);
        }
        m.box([cx + sx * 11.0 - 1.3, 16.0, legZ[0]], [cx + sx * 11.0 + 1.3, 17.6, legZ[1]], MAT.PAINT);
      }
      for (const z of legZ) {
        m.box([cx - 12.3, H, z - 1.4], [cx + 12.3, H + 2.6, z + 1.4], MAT.PAINT);
      }
      m.box([cx - 3.2, H + 2.6, -52.0], [cx + 3.2, H + 5.4, 26.0], MAT.PAINT);
      m.box([cx - 5.0, H + 5.4, 6.0], [cx + 5.0, H + 11.0, 18.0], MAT.CLADDING, { roof: MAT.ROOF });
    });
    m.painted(TINT.METAL_DARK, () => {
      m.pipe([cx, H + 11.0, 12.0], [cx, H + 5.4, -50.0], 0.22, MAT.TRIM, 5);
      m.pipe([cx, H + 11.0, 12.0], [cx, H + 5.4, 24.0], 0.22, MAT.TRIM, 5);
      m.box([cx - 2.6, H + 0.8, -30.0], [cx + 2.6, H + 2.6, -25.0], MAT.TRIM);
      for (const sx of [-1, 1]) m.pipe([cx + sx * 2.0, H + 0.8, -27.5], [cx + sx * 2.0, 14.0, -27.5], 0.1, MAT.TRIM, 4);
      m.box([cx - 1.4, 12.4, -33.6], [cx + 1.4, 14.0, -21.4], MAT.TRIM);
      for (const z of legZ) m.box([-72, 1.8, z - 0.3], [72, 2.0, z + 0.3], MAT.TRIM);
    });
  };

  gantry(-30.0);
  gantry(26.0);

  if (medium) {
    let key = 800;
    for (let lane = 0; lane < 3; lane++) {
      const z = 22.0 + lane * 11.0;
      for (let i = 0; i < 9; i++) {
        const x = -62.0 + i * 13.4;
        const tall = 4 - ((i + lane) % 3);
        for (let t = 0; t < tall; t++) {
          m.keyed(key++, () => {
            m.box([x - 6.1, 1.8 + t * 2.62, z - 1.22], [x + 6.1, 4.39 + t * 2.62, z + 1.22],
                  MAT.CONTAINER, { roof: MAT.CONTAINER });
          });
          m.painted(TINT.METAL_DARK, () => {
            m.box([x - 6.1, 4.23 + t * 2.62, z - 1.25], [x + 6.1, 4.39 + t * 2.62, z + 1.25], MAT.TRIM);
          });
        }
      }
    }
  }

  if (fine) {
    m.painted(TINT.METAL_DARK, () => {
      for (const x of [-52.0, 0.0, 52.0]) {
        m.cylinder(x, 52.0, 0.7, 1.8, 34.0, 8, MAT.TRIM, false);
        m.box([x - 3.4, 34.0, 51.4], [x + 3.4, 35.4, 52.6], MAT.TRIM);
        for (let i = 0; i < 4; i++) {
          m.box([x - 3.0 + i * 1.7, 35.4, 51.6], [x - 2.0 + i * 1.7, 36.4, 52.4], MAT.LAMP);
        }
      }
    });
    m.box([54.0, 1.8, -14.0], [70.0, 16.0, 6.0], MAT.CLADDING, { roof: MAT.ROOF });
    for (const y of [5.0, 9.0, 13.0]) m.box([53.9, y, -13.0], [70.1, y + 2.0, 5.0], MAT.GLASS);
    parapet(m, 54.0, -14.0, 70.0, 6.0, 16.0, 0.7, 0.25, MAT.TRIM);
    m.painted(TINT.SIGN_LIT, () => m.box([55.0, 16.7, -14.3], [69.0, 19.0, -14.0], MAT.PLATE));
    for (let i = 0; i < 4; i++) parkedVehicle(m, 600 + i * 13, -50 + i * 22, 12.0, 1, 'truck');
    railing(m, -70, 70, -17.0, 1.8, 1.1, 3.0);
    for (let i = 0; i < 6; i++) figure(m, 810 + i * 19, -40 + i * 16, 8.0, 0, { stride: 0.16, hat: true });
  }
  return m;
}

/**
 * A convention centre: three exhibition halls, a concourse and a truck dock.
 *
 * The other building a city of this size has one of and the library had none
 * of. It is the opposite problem from a stadium: no bowl, no seating, nothing
 * to look into -- just a very large enclosure that has to read as a public
 * building rather than as a distribution shed. What separates the two is
 * entirely at the front: a glazed concourse the full length of it, a canopy
 * you arrive under, and a roof of shallow vaults rather than a flat lid.
 */
function convention(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const halls = [[-84.0, -30.0], [-26.0, 28.0], [32.0, 86.0]] as const;

  m.box([-116, 0.0005, -80], [116, 0.1, 80], MAT.CONCRETE);

  for (const [x0, x1] of halls) {
    m.box([x0, 0.1, -14.0], [x1, 20.0, 46.0], MAT.CLADDING);
    // Shallow vaults over each hall, running across it.
    for (let i = 0; i < 8; i++) {
      const t0 = i / 8, t1 = (i + 1) / 8;
      const c0 = Math.sin(t0 * Math.PI), c1 = Math.sin(t1 * Math.PI);
      const a = -14.0 + t0 * 60.0, b = -14.0 + t1 * 60.0;
      m.box([x0 - 1.0, 20.0 + Math.min(c0, c1) * 7.0, a],
            [x1 + 1.0, 21.0 + Math.max(c0, c1) * 7.0, b], MAT.ROOF);
      void 0;
    }
    if (medium) {
      // A louvred band and a clerestory, so fifty metres of wall has a scale.
      m.painted(TINT.METAL_DARK, () => {
        for (let i = 0; i < 18; i++) {
          const x = x0 + 2.0 + (i / 18) * (x1 - x0 - 4.0);
          m.box([x - 0.5, 0.1, -14.4], [x + 0.5, 20.0, -13.9], MAT.TRIM);
          m.box([x - 0.5, 0.1, 45.9], [x + 0.5, 20.0, 46.4], MAT.TRIM);
        }
      });
      m.box([x0 + 1.0, 15.0, -14.5], [x1 - 1.0, 18.5, -14.1], MAT.GLASS);
      m.box([x0 + 1.0, 15.0, 46.1], [x1 - 1.0, 18.5, 46.5], MAT.GLASS);
      m.painted(TINT.BRAND, () => {
        band(m, x0, -14.0, x1, 46.0, 20.0, 1.6, 0.5, MAT.CLADDING);
      });
    }
  }

  // The concourse: full length, glazed, in front of all three halls.
  m.box([-92.0, 0.1, -30.0], [94.0, 4.5, -14.0], MAT.CONCRETE);
  m.box([-91.0, 4.5, -29.0], [93.0, 17.0, -15.0], MAT.GLASS);
  m.box([-93.0, 17.0, -31.0], [95.0, 18.4, -13.0], MAT.METAL);
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i <= 24; i++) {
      const x = -91.0 + (i / 24) * 184.0;
      m.cylinder(x, -29.0, 0.34, 4.5, 17.4, 6, MAT.TRIM, false);
    }
  });

  if (medium) {
    // The arrival canopy: a long cantilever on raking props.
    m.box([-60.0, 9.0, -46.0], [60.0, 9.9, -30.0], MAT.METAL);
    m.painted(TINT.METAL_DARK, () => {
      for (const x of [-52.0, -26.0, 0.0, 26.0, 52.0]) {
        m.pipe([x, 0.34, -42.0], [x, 9.0, -34.0], 0.34, MAT.TRIM, 6);
      }
    });
    m.painted(TINT.SIGN_LIT, () => m.box([-30.0, 18.6, -30.8], [30.0, 22.4, -30.4], MAT.PLATE));
    // Roof plant on the flat between the vaults.
    roofClutter(m, -80, -8, 80, 40, 28.2, 43, 0.8);
  }

  if (fine) {
    // The truck dock at the back: six levellers with a trailer on two.
    m.box([-90.0, 0.1, 46.0], [92.0, 0.16, 70.0], MAT.GROUND);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 6; i++) {
        const x = -76.0 + i * 30.0;
        m.box([x - 2.4, 1.2, 45.6], [x + 2.4, 5.2, 46.4], MAT.TRIM);
        m.box([x - 2.8, 5.2, 45.5], [x + 2.8, 5.8, 48.4], MAT.TRIM);
      }
    });
    for (let i = 0; i < 3; i++) parkedVehicle(m, 640 + i * 11, -76.0 + i * 60.0, 54.0, 3, 'truck');

    turnstiles(m, -46, 46, -30.6, 10, 0.1);
    carPark(m, -112, -76, 112, -50, 19, 0.5, 12);
    kerb(m, -96, -48, 98, -30);
    for (let i = 0; i < 14; i++) figure(m, 620 + i * 9, -50 + i * 7.4, -36.0, 0, { stride: 0.2, bag: true });

  }
  return m;
}

// ===================================================================== table

const venue = (jobs: number, upkeep: number, power: number, water: number): AssetDef['sim'] => ({
  jobs, powerKW: power, waterM3: water, garbagePerWeek: jobs * 9, pollution: 0, upkeep,
});

export const SPORT: AssetDef[] = [
  {
    id: 'svc.parks.gridiron', name: 'Football stadium', zone: 'service', branch: 'parks',
    density: 'none', variant: 'sculpted', footprint: [30, 25], height: 59.6,
    brand: { name: 'Gridiron', colour: [0.20, 0.28, 0.52], accent: [0.72, 0.56, 0.16], sign: 'box' },
    sim: venue(240, 3800, 2100, 1000),
    note: 'A horseshoe open at the south end: a hundred-and-nine-metre field with hash marks and posts, thirteen terraces of lower bowl, a glazed hospitality ring, fifteen of upper, a roof on raking props, tunnel, benches and a forty-six-metre scoreboard standing in the open end.',
    build: gridiron,
  },
  {
    id: 'svc.parks.soccer', name: 'Soccer stadium', zone: 'service', branch: 'parks',
    density: 'none', variant: 'sculpted', footprint: [28, 24], height: 51.0,
    brand: { name: 'City FC', colour: [0.16, 0.34, 0.58], accent: [0.78, 0.72, 0.20], sign: 'box' },
    sim: venue(200, 3200, 1800, 900),
    note: 'A chamfered oval closed right round: regulation 105 by 68 pitch with a centre circle and netted goals, sixteen terraces under a glazed box ring and eleven above, a louvred outer drum, and one continuous roof with a translucent leading edge.',
    build: soccer,
  },
  {
    id: 'svc.parks.arena', name: 'Ice arena', zone: 'service', branch: 'parks',
    density: 'none', variant: 'sculpted', footprint: [22, 21], height: 54.0,
    brand: { name: 'Arena', colour: [0.24, 0.30, 0.42], accent: [0.66, 0.24, 0.26], sign: 'box' },
    sim: venue(150, 2600, 1900, 750),
    note: 'A drum with a glazed oculus over the rink: 61 by 28 ice with blue lines, faceoff circles, goals, boards and glass; fifteen terraces of bowl round it; a stone podium under a glazed and finned shell; a hung scoreboard, a cantilevered entrance canopy and a dock yard.',
    build: arena,
  },
  {
    id: 'svc.transport.airport', name: 'Airport terminal', zone: 'service', branch: 'transport',
    density: 'none', variant: 'sculpted', footprint: [35, 26], height: 54.0,
    brand: { name: 'Airport', colour: [0.22, 0.34, 0.48], accent: [0.74, 0.60, 0.22], sign: 'box' },
    sim: venue(320, 4200, 2600, 1400),
    note: 'Kerb to stand in five pieces: a four-deck car park, a departures viaduct under a canopy, a vaulted landside hall, two two-hundred-metre piers, and four marked stands with jet bridges and two aircraft on them. Forty-metre control tower.',
    build: airTerminal,
  },
  {
    id: 'svc.transport.docks', name: 'Container terminal', zone: 'service', branch: 'transport',
    density: 'none', variant: 'sculpted', footprint: [19, 15], height: 55.4,
    brand: { name: 'Port', colour: [0.20, 0.36, 0.40], accent: [0.80, 0.44, 0.10], sign: 'box' },
    sim: venue(200, 2800, 1400, 400),
    note: 'Two ship-to-shore gantries on rails with booms out over the water and a spreader down on the hatch, quay coping with fenders and bollards, three lanes of stacked boxes, lighting masts and an office block.',
    build: containerTerminal,
  },
  {
    id: 'svc.gov.convention', name: 'Convention centre', zone: 'service', branch: 'government',
    density: 'none', variant: 'sculpted', footprint: [30, 21], height: 28.2,
    brand: { name: 'Expo', colour: [0.26, 0.30, 0.38], accent: [0.72, 0.46, 0.14], sign: 'box' },
    sim: venue(180, 2700, 1600, 800),
    note: 'Three vaulted exhibition halls behind a hundred-and-eighty-metre glazed concourse, an arrival canopy on raking props, six truck docks with trailers backed on, and parking for the lot.',
    build: convention,
  },
];
