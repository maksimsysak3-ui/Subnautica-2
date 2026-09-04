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
import { CELL } from '../types';
import { IMPORTED_IDS, drawImported, drawImpostor, importedName, importedSize } from '../imported';
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
 * Skins a run of stations into one continuous closed shell.
 *
 * The whole car is this surface: sill, door, shoulder, screen, roof,
 * backlight and boot are all bands of the same loft, so there is no seam
 * anywhere and the silhouette is a single curve. It was built as a lower body
 * with a separate cabin box standing on it, which is exactly what it looked
 * like -- two volumes with a joint round the waist.
 *
 * `glass` cuts the glasshouse into that surface instead of adding it: bands
 * above `above` (a fraction of the section's height) between `from` and `to`
 * (fractions of the length) are skinned in glazing rather than paint, except
 * where a pillar interrupts them. Cutting rather than adding is what keeps
 * the surface continuous, and limiting it to a span of the length is what
 * stops it running the whole car -- which is what made the first attempt
 * see-through from end to end.
 *
 * The roof strip is crowned: two quads meeting at a raised centre line. A
 * single flat quad across the top is the single most model-like thing a car
 * can have, because no car has a flat roof.
 */
function loft(m: MeshBuilder, st: Station[], mat: Material,
  opts: {
    ends?: boolean;
    upTo?: number;
    glass?: { from: number; to: number; above: number; pillars: number[]; width?: number };
  } = {}): void {
  const n = st[0].s.length;
  const top = Math.min(opts.upTo ?? n - 1, n - 1);
  const x0 = st[0].x, x1 = st[st.length - 1].x;
  const span = (x1 - x0) || 1;
  // Surface coordinates: u runs nose to tail, v runs sill to roof. Every
  // detail the shader draws on a car -- panel gaps, the waist crease, the
  // shadow in the sill -- is placed in these rather than in world space,
  // because world space on a curved body is not continuous.
  const uAt = (x: number): number => (x - x0) / span;
  const vAt = (j: number): number => j / (n - 1);
  const g = opts.glass;
  const post = g === undefined ? 0.030 : (g.width ?? 0.030);

  /** Is this band of this station's flank glazing rather than bodywork? */
  const glazed = (u: number, v: number): boolean => {
    if (g === undefined) return false;
    if (u < g.from || u > g.to) return false;
    if (v < g.above) return false;
    // The A and D posts are the ends of the run itself.
    if (u < g.from + post || u > g.to - post) return false;
    return !g.pillars.some((p) => Math.abs(u - p) < post);
  };

  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i], b = st[i + 1];
    const ua = uAt(a.x), ub = uAt(b.x);
    const um = (ua + ub) / 2;
    for (let j = 0; j < top; j++) {
      const [ay0, aw0] = a.s[j], [ay1, aw1] = a.s[j + 1];
      const [by0, bw0] = b.s[j], [by1, bw1] = b.s[j + 1];
      const v0 = vAt(j), v1 = vAt(j + 1);
      const band = glazed(um, (v0 + v1) / 2) ? MAT.CAR_GLASS : mat;
      // Glazing sits a little inside the bodywork, so the pillars and the
      // waist stand proud of it and the opening has a reveal.
      const k = band === mat ? 1 : 0.985;
      // +z flank, then -z with the winding reversed so both face outwards.
      m.quadUV([a.x, ay0, aw0 * k], [b.x, by0, bw0 * k], [b.x, by1, bw1 * k], [a.x, ay1, aw1 * k],
        [[ua, v0], [ub, v0], [ub, v1], [ua, v1]], band);
      m.quadUV([a.x, ay1, -aw1 * k], [b.x, by1, -bw1 * k], [b.x, by0, -bw0 * k], [a.x, ay0, -aw0 * k],
        [[ua, v1], [ub, v1], [ub, v0], [ua, v0]], band);
    }
    // The roof, crowned rather than flat: two quads meeting at a centre line
    // lifted by a fiftieth of the width. Flat is what a box has.
    const at = a.s[top], bt = b.s[top], ab = a.s[0], bb = b.s[0];
    const vt = vAt(top);
    const ca = at[0] + at[1] * 0.030, cb = bt[0] + bt[1] * 0.030;
    m.quadUV([a.x, at[0], at[1]], [b.x, bt[0], bt[1]], [b.x, cb, 0], [a.x, ca, 0],
      [[ua, vt], [ub, vt], [ub, 1], [ua, 1]], mat);
    m.quadUV([a.x, ca, 0], [b.x, cb, 0], [b.x, bt[0], -bt[1]], [a.x, at[0], -at[1]],
      [[ua, 1], [ub, 1], [ub, vt], [ua, vt]], mat);
    m.quadUV([a.x, ab[0], -ab[1]], [b.x, bb[0], -bb[1]], [b.x, bb[0], bb[1]], [a.x, ab[0], ab[1]],
      [[ua, 0], [ub, 0], [ub, 0], [ua, 0]], mat);
  }
  if (opts.ends === false) return;
  // End caps, as a fan from the mid-height of the section. Always painted:
  // glazing a cap is what made every nose and tail read as an opening.
  for (const [st0, dir] of [[st[0], -1], [st[st.length - 1], 1]] as const) {
    const mid = (st0.s[0][0] + st0.s[top][0]) / 2;
    const u = uAt(st0.x);
    for (let j = 0; j < top; j++) {
      const [y0, w0] = st0.s[j], [y1, w1] = st0.s[j + 1];
      const c: Vec3 = [st0.x, mid, 0];
      const v0 = vAt(j), v1 = vAt(j + 1), vm = 0.5;
      if (dir > 0) {
        m.triUV([st0.x, y0, w0], [st0.x, y1, w1], c, [[u, v0], [u, v1], [u, vm]], mat);
        m.triUV([st0.x, y1, -w1], [st0.x, y0, -w0], c, [[u, v1], [u, v0], [u, vm]], mat);
      } else {
        m.triUV([st0.x, y1, w1], [st0.x, y0, w0], c, [[u, v1], [u, v0], [u, vm]], mat);
        m.triUV([st0.x, y0, -w0], [st0.x, y1, -w1], c, [[u, v0], [u, v1], [u, vm]], mat);
      }
    }
  }
}
/** Scales a section's widths and shifts its heights: one profile, many bodies. */
function shape(s: Section, wScale: number, yTop: number): Section {
  // Sections that already describe the shape in detail need one subdivision,
  // not two: an eight-point profile splined twice is fifteen bands a station,
  // which doubles the car for nothing anyone can see.
  const r = refine(s, s.length >= 7 ? 1 : 2);
  const top = r[r.length - 1][0];
  const bot = r[0][0];
  return r.map(([y, w]) => [bot + ((y - bot) / (top - bot)) * (yTop - bot), w * wScale] as [number, number]);
}

/**
 * Catmull-Rom through a list of numbers, at parameter t in [0, n-1].
 *
 * Linear interpolation between stations is why the bodies read as folded card:
 * every station is a crease, because the tangent changes discontinuously
 * there. A Catmull-Rom spline passes through the same points with a continuous
 * tangent, so the same eight stations describe a curved body instead of a
 * faceted one.
 */
function spline(v: number[], t: number): number {
  const n = v.length;
  const i = Math.max(0, Math.min(n - 2, Math.floor(t)));
  const f = t - i;
  const p0 = v[Math.max(0, i - 1)], p1 = v[i], p2 = v[i + 1], p3 = v[Math.min(n - 1, i + 2)];
  return 0.5 * ((2 * p1) + (-p0 + p2) * f
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f
    + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
}

/**
 * Subdivides a section profile, so the cross-section is a curve too.
 *
 * A five-point section gives a flank made of four flat bands with a hard edge
 * between each. Splining it to eleven points rounds the shoulder and the
 * tumblehome, which is where most of the light on a car actually lands.
 */
function refine(sec: Section, per = 2): Section {
  if (sec.length < 3) return sec;
  const ys = sec.map((p) => p[0]);
  const ws = sec.map((p) => p[1]);
  const out: Section = [];
  const steps = (sec.length - 1) * per;
  for (let k = 0; k <= steps; k++) {
    const t = (k / steps) * (sec.length - 1);
    out.push([spline(ys, t), spline(ws, t)]);
  }
  return out;
}

/**
 * Section libraries.
 *
 * A section is the cross-cut of a body at one station: pairs of height and
 * half-width from the sill up to the roof. Every vehicle is one of these
 * scaled and swept, which is why a hatchback and a saloon are recognisably
 * from the same world.
 */

// ------------------------------------------------------------------- wheels

/**
 * A road wheel: tyre, dished alloy, brake disc and caliper.
 *
 * Built as real volumes rather than as discs with sticks drawn on them. The
 * spokes are tapered prisms set back from the rim face, so the gaps between
 * them are actual depth and the light catches each spoke's own side -- which
 * is the whole difference between an alloy and a black circle with a pattern
 * on it. The reference for this is a modern five-twin-spoke wheel: ten narrow
 * legs, a deep lip, a small centre cap, and a red caliper visible behind.
 *
 * Spins about Z. `cz` also says which side of the car it is on, so the face
 * detail goes on the outboard side and the inboard side stays cheap.
 */
function wheel(m: MeshBuilder, cx: number, cy: number, cz: number, r: number, halfW: number,
  seg = 18): void {
  const out = cz >= 0 ? 1 : -1;
  const rim = r * 0.60;          // where the tyre bead sits
  const face = cz + out * halfW * 0.26;   // the plane the spokes rise to
  const back = cz - out * halfW * 0.55;   // the back of the barrel
  const hub = r * 0.17;
  const fine = seg >= 14;

  const P = (a: number, rr: number, z: number): Vec3 =>
    [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, z];

  // ------------------------------------------------------------------ tyre
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const u0 = i / seg, u1 = (i + 1) / seg;
    const sh = halfW * 0.80, shR = r * 0.982;
    // Crown, a chamfered shoulder each side, then the sidewalls down to the
    // bead. A tyre section is not a rectangle, and at this size the shoulder
    // is what tells you it is round.
    m.quadUV(P(a0, r, cz + sh), P(a1, r, cz + sh), P(a1, r, cz - sh), P(a0, r, cz - sh),
      [[u0, 0.28], [u1, 0.28], [u1, 0.72], [u0, 0.72]], MAT.TYRE);
    m.quadUV(P(a1, r, cz + sh), P(a0, r, cz + sh), P(a0, shR, cz + halfW), P(a1, shR, cz + halfW),
      [[u1, 0.28], [u0, 0.28], [u0, 0.10], [u1, 0.10]], MAT.TYRE);
    m.quadUV(P(a0, r, cz - sh), P(a1, r, cz - sh), P(a1, shR, cz - halfW), P(a0, shR, cz - halfW),
      [[u0, 0.72], [u1, 0.72], [u1, 0.90], [u0, 0.90]], MAT.TYRE);
    m.quadUV(P(a1, shR, cz + halfW), P(a0, shR, cz + halfW), P(a0, rim, cz + halfW * 0.62),
      P(a1, rim, cz + halfW * 0.62), [[u1, 0.10], [u0, 0.10], [u0, 0.0], [u1, 0.0]], MAT.TYRE);
    m.quadUV(P(a0, shR, cz - halfW), P(a1, shR, cz - halfW), P(a1, rim, cz - halfW * 0.62),
      P(a0, rim, cz - halfW * 0.62), [[u0, 0.90], [u1, 0.90], [u1, 1.0], [u0, 1.0]], MAT.TYRE);
  }

  // ---------------------------------------------------------------- barrel
  // The inside of the rim, seen through the spoke gaps. Without it the gaps
  // are holes straight through the car.
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      m.quad(P(a1, rim * 0.98, face), P(a0, rim * 0.98, face),
             P(a0, rim * 0.98, back), P(a1, rim * 0.98, back), MAT.TRIM);
    }
  });

  // ------------------------------------------------------------------- lip
  // The polished outer lip: a short cone from the bead down to the face.
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const zb = cz + out * halfW * 0.62;
    m.quad(P(a0, rim, zb), P(a1, rim, zb), P(a1, rim * 0.94, face), P(a0, rim * 0.94, face), MAT.METAL);
  }

  // ---------------------------------------------------------------- spokes
  // Ten legs in five pairs, each a tapered prism with its own sides. Wide and
  // shallow at the rim, narrow and proud at the hub.
  const legs = fine ? 10 : 5;
  const zTop = face + out * r * 0.055;
  for (let k = 0; k < legs; k++) {
    const a = (k / legs) * Math.PI * 2 + (fine ? (k % 2 === 0 ? 0.16 : -0.16) : 0.3) + 0.25;
    const ca = Math.cos(a), sa = Math.sin(a);
    const nx = -sa, ny = ca;
    // Corner of the leg at radius rr, half-width t, on plane z.
    const q = (rr: number, t: number, sgn: number, z: number): Vec3 =>
      [cx + ca * rr + nx * t * sgn, cy + sa * rr + ny * t * sgn, z];
    const r0 = hub * 1.05, r1 = rim * 0.95;
    const t0 = r * 0.055, t1 = r * 0.085;
    const A = q(r0, t0, 1, zTop), B = q(r1, t1, 1, face);
    const C = q(r1, t1, -1, face), D = q(r0, t0, -1, zTop);
    const A2 = q(r0, t0 * 0.7, 1, face - out * r * 0.06);
    const B2 = q(r1, t1 * 0.7, 1, face - out * r * 0.06);
    const C2 = q(r1, t1 * 0.7, -1, face - out * r * 0.06);
    const D2 = q(r0, t0 * 0.7, -1, face - out * r * 0.06);
    if (out > 0) {
      m.quad(A, B, C, D, MAT.METAL);            // top face
      m.quad(A, A2, B2, B, MAT.METAL);          // one side
      m.quad(C, C2, D2, D, MAT.METAL);          // the other
    } else {
      m.quad(D, C, B, A, MAT.METAL);
      m.quad(B, B2, A2, A, MAT.METAL);
      m.quad(D, D2, C2, C, MAT.METAL);
    }
  }

  // ------------------------------------------------------------- centre cap
  const capZ = face + out * r * 0.10;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    if (out > 0) m.tri(P(a0, hub, zTop), P(a1, hub, zTop), [cx, cy, capZ], MAT.METAL);
    else m.tri(P(a1, hub, zTop), P(a0, hub, zTop), [cx, cy, capZ], MAT.METAL);
  }
  m.painted(TINT.BRAND, () => {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const z = capZ + out * 0.004;
      if (out > 0) m.tri(P(a0, hub * 0.52, z), P(a1, hub * 0.52, z), [cx, cy, z + out * 0.01], MAT.TRIM);
      else m.tri(P(a1, hub * 0.52, z), P(a0, hub * 0.52, z), [cx, cy, z + out * 0.01], MAT.TRIM);
    }
  });
  // Lug nuts round the cap.
  if (fine) m.painted(TINT.METAL_DARK, () => {
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.6;
      const px = cx + Math.cos(a) * hub * 1.5, py = cy + Math.sin(a) * hub * 1.5;
      m.cylinder(px, zTop, r * 0.032, py - r * 0.032, py + r * 0.032, 6, MAT.TRIM, true);
    }
  });

  // ---------------------------------------------------- brake disc and caliper
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const z = cz - out * halfW * 0.12;
      if (out > 0) m.tri(P(a1, rim * 0.76, z), P(a0, rim * 0.76, z), [cx, cy, z], MAT.TRIM);
      else m.tri(P(a0, rim * 0.76, z), P(a1, rim * 0.76, z), [cx, cy, z], MAT.TRIM);
    }
  });
  if (fine) m.painted(TINT.BRAND, () => {
    // Caliper: a block bridging the disc at ten o'clock, which is where the
    // eye looks for it and the one flash of colour inside a wheel.
    const a = Math.PI * 0.72;
    const px = cx + Math.cos(a) * rim * 0.56, py = cy + Math.sin(a) * rim * 0.56;
    m.box([px - r * 0.11, py - r * 0.16, cz - out * halfW * 0.30],
          [px + r * 0.11, py + r * 0.16, cz - out * halfW * 0.02], MAT.TRIM);
  });
}
/** The ground a vehicle stands on, so it is not floating over a void. */
function tarmac(m: MeshBuilder, x: number, z: number): void {
  m.box([-x, 0.0005, -z], [x, 0.04, z], MAT.GROUND);
  // No bay markings. They were two lit stripes the length of the pad, and at
  // the size a car is reviewed at they read as a coloured strip of nothing
  // lying beside the vehicle rather than as a parking bay.
}

// -------------------------------------------------------------------- people
//
// Figures are built from a dozen boxes and two half-cylinders. They are seen
// at three or four pixels tall in play and at arm's length in this viewer, so
// they need a silhouette that survives both: shoulders wider than the head,
// legs apart, arms clear of the body.

/**
 * A person: boxes, and what is done with them.
 *
 * Three goes at sculpting these produced, in order, a stack of bricks, a
 * mannequin, and a head with a face scribbled on it. The lesson is not that
 * the sculpting needed to be finer. It is that a figure a hundred and fifty
 * pixels tall in this viewer and four pixels tall in play has no room for a
 * cheekbone, and every triangle spent on one is a triangle not spent on
 * something you can actually see. So this is deliberately blocky, in the same
 * key as the imported vehicles: flat-shaded slabs, no curved sections
 * anywhere, and all the effort in proportion, pose and colour.
 *
 * The detail is in what a box can carry. Proportions are a real 1.75m body --
 * hip at 0.53 of standing height, shoulder at 0.82, head an eighth of the
 * whole. Top, trousers, shoes, skin and hair are five separate colour keys, so
 * the crowd is dressed rather than moulded. A shirt has a collar and a cuff, a
 * jacket has lapels and a hem, trousers may be a skirt with bare calves under
 * it, hair is a slab with a fringe and sometimes a tail, and there are boots,
 * a satchel, a cap. The face is two dark chips and a wedge of a nose, which at
 * this size is exactly as much face as reads.
 *
 * About three hundred triangles a head, a quarter of what the sculpted one
 * cost, which is why there are twice as many people on the pavement.
 */
function person(m: MeshBuilder, key: number, cx: number, cz: number, facing: number,
  opts: { stride?: number; bag?: boolean; hat?: boolean; scale?: number; lift?: number;
    sit?: boolean } = {}): void {
  const rnd = (n: number): number => {
    const v = Math.sin(key * 12.9898 + n * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  const s = (opts.scale ?? 1.0) * (0.94 + rnd(1) * 0.13);
  let lift = opts.lift ?? 0;
  const stride = opts.stride ?? 0;
  const broad = 0.90 + rnd(2) * 0.26;
  const tall = 0.97 + rnd(3) * 0.07;
  const jacket = rnd(4) > 0.60;
  const hair = rnd(5);
  const skirt = rnd(8) > 0.76 && opts.sit !== true;
  const sit = opts.sit === true;
  const sleeves = jacket || rnd(9) > 0.45;       // long sleeves, or bare arms
  const co = Math.cos(facing), si = Math.sin(facing);

  /** Local (forward, up, side) to world. */
  const at = (fx: number, fy: number, fz: number): Vec3 =>
    [cx + (fx * co - fz * si) * s, lift + fy * s, cz + (fx * si + fz * co) * s];

  /**
   * An axis-aligned box in local space, from one corner to the other.
   *
   * Local, not world: the whole figure is built facing +x and turned once by
   * `at`, so a pose is written in the coordinates you think in.
   */
  const box = (f0: number, y0: number, z0: number,
    f1: number, y1: number, z1: number, mat: Material): void => {
    const p = [
      at(f0, y0, z0), at(f1, y0, z0), at(f1, y0, z1), at(f0, y0, z1),
      at(f0, y1, z0), at(f1, y1, z0), at(f1, y1, z1), at(f0, y1, z1),
    ];
    m.quad(p[0], p[1], p[2], p[3], mat);      // floor, facing down
    m.quad(p[4], p[7], p[6], p[5], mat);      // lid, facing up
    m.quad(p[0], p[4], p[5], p[1], mat);      // the four sides, facing out
    m.quad(p[2], p[6], p[7], p[3], mat);
    m.quad(p[1], p[5], p[6], p[2], mat);
    m.quad(p[3], p[7], p[4], p[0], mat);
  };

  /**
   * A box swept between two points, for a limb that is not vertical.
   *
   * The section stays square to the figure's own side axis and leans with the
   * bone in the forward/up plane, which is what a swinging arm or a striding
   * leg does. Boxes slid sideways to fake a stride was the first version of
   * these figures and it read as a stack of bricks.
   */
  const limb = (a: [number, number], b: [number, number], z: number,
    hd: number, hz: number, mat: Material): void => {
    const df = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(df, dy) || 1;
    const pf = -dy / len * hd, py = df / len * hd;
    const p = [
      at(a[0] - pf, a[1] - py, z - hz), at(a[0] + pf, a[1] + py, z - hz),
      at(b[0] + pf, b[1] + py, z - hz), at(b[0] - pf, b[1] - py, z - hz),
      at(a[0] - pf, a[1] - py, z + hz), at(a[0] + pf, a[1] + py, z + hz),
      at(b[0] + pf, b[1] + py, z + hz), at(b[0] - pf, b[1] - py, z + hz),
    ];
    m.quad(p[0], p[1], p[2], p[3], mat);      // the two ends
    m.quad(p[7], p[6], p[5], p[4], mat);
    m.quad(p[0], p[4], p[5], p[1], mat);      // and the four long faces
    m.quad(p[1], p[5], p[6], p[2], mat);
    m.quad(p[2], p[6], p[7], p[3], mat);
    m.quad(p[3], p[7], p[4], p[0], mat);
  };

  // The skeleton, as fractions of a 1.75m body.
  const ankle = 0.075 * tall;
  const knee = 0.470 * tall;
  const hip = 0.930 * tall;
  const waist = 1.075 * tall;
  const chest = 1.250 * tall;
  const shoulder = 1.430 * tall;
  const chin = 1.555 * tall;
  const crown = 1.750 * tall;
  const hz = 0.150 * broad;                      // half the width across the hips
  const sz = 0.198 * broad;                      // half the width across the shoulders
  const cuff = chest - 0.11;
  // Seated, `lift` is the height of the seat rather than an offset added to
  // the figure: the hips go on the bench and the ground ends up at a negative
  // local y, which is what the calves are cut to reach.
  if (sit) lift = (opts.lift ?? 0.6) - hip * s;

  // ---------------------------------------------------------------- trousers
  //
  // Seated, the thighs run forward along the seat and the calves drop from the
  // knee to the ground. `lift` has already put the hips at seat height, so the
  // ground is at a negative local y and the calves are cut to reach it.
  const gy = sit ? -lift / s : 0;
  m.keyed(key * 5 + 1, () => {
    if (sit) {
      box(-0.092, hip - 0.10, -hz * 1.02, 0.060, waist - 0.02, hz * 1.02, MAT.FIGURE);
      for (const side of [1, -1] as const) {
        limb([0, hip - 0.06], [0.40, hip - 0.08], side * hz * 0.52, 0.072, hz * 0.42,
          MAT.FIGURE);
      }
    } else if (skirt) {
      // A-line: wider at the hem than at the waist.
      const hemY = knee + 0.09;
      const p = (y: number, w: number, d: number): Vec3[] => [
        at(-d, y, -w), at(d, y, -w), at(d, y, w), at(-d, y, w)];
      const top = p(waist - 0.02, hz * 1.10, 0.086), bot = p(hemY, hz * 1.66, 0.128);
      for (let k = 0; k < 4; k++) {
        m.quad(top[k], top[(k + 1) % 4], bot[(k + 1) % 4], bot[k], MAT.FIGURE);
      }
      m.quad(bot[3], bot[2], bot[1], bot[0], MAT.FIGURE);
      m.quad(top[0], top[1], top[2], top[3], MAT.FIGURE);
    } else {
      box(-0.092, hip - 0.10, -hz * 1.02, 0.092, waist - 0.02, hz * 1.02, MAT.FIGURE);
      for (const [side, sgn] of [[1, 1], [-1, -1]] as const) {
        const swing = stride * sgn;
        const bend = Math.max(0, -sgn * stride) * 0.09;
        limb([0, hip - 0.06], [swing * 0.55, knee + bend], side * hz * 0.52,
          0.072, hz * 0.42, MAT.FIGURE);
      }
    }
  });
  // Calves: trouser below the knee, or bare under a skirt.
  for (const [side, sgn] of [[1, 1], [-1, -1]] as const) {
    const swing = stride * sgn;
    const bend = Math.max(0, -sgn * stride) * 0.09;
    m.keyed(key * 5 + (skirt ? 3 : 1), () =>
      limb(sit ? [0.40, hip - 0.08] : [swing * 0.55, knee + bend],
        sit ? [0.40, gy + 0.09] : [swing * 1.25, ankle + 0.03], side * hz * 0.52,
        skirt ? 0.042 : 0.052, hz * (skirt ? 0.30 : 0.36),
        skirt ? MAT.SKIN : MAT.FIGURE));
  }
  // Boots: dark leather whatever the trousers, with a raised heel behind.
  m.painted(TINT.METAL_DARK, () => {
    for (const [side, sgn] of [[1, 1], [-1, -1]] as const) {
      const f = sit ? 0.40 : stride * sgn * 1.25;
      box(f - 0.075, gy, side * hz * 0.52 - 0.052, f + 0.108, gy + 0.040,
        side * hz * 0.52 + 0.052, MAT.TRIM);
      box(f - 0.075, gy, side * hz * 0.52 - 0.052, f + 0.020, gy + 0.082,
        side * hz * 0.52 + 0.052, MAT.TRIM);
    }
  });

  // -------------------------------------------------------------------- top
  m.keyed(key * 5 + 2, () => {
    // Trunk: hips narrower than chest, chest narrower than shoulders.
    box(-0.096, waist - 0.06, -hz * 1.04, 0.096, chest, hz * 1.04, MAT.FIGURE);
    box(-0.100, chest - 0.02, -sz * 0.92, 0.100, shoulder, sz * 0.92, MAT.FIGURE);
    // Collar, so the neck does not rise out of a flat plate.
    box(-0.072, shoulder, -0.086, 0.072, chin - 0.052, 0.086, MAT.FIGURE);
    if (jacket) {
      // A hem past the hips, and two lapels down the front.
      box(-0.110, hip - 0.12, -hz * 1.12, 0.110, waist + 0.04, hz * 1.12, MAT.FIGURE);
      for (const side of [1, -1] as const) {
        limb([0.096, shoulder - 0.05], [0.100, chest - 0.14], side * 0.062,
          0.028, 0.030, MAT.FIGURE);
      }
    }
    for (const [side, sgn] of [[1, -1], [-1, 1]] as const) {
      const swing = stride * sgn * 0.8;
      const az = side * (sz * 0.92 + 0.052);
      limb([0, shoulder - 0.03], [swing * 0.7, cuff], az, 0.056, 0.050, MAT.FIGURE);
      if (sleeves) {
        limb([swing * 0.7, cuff], sit ? [0.30, hip - 0.04] : [swing * 1.5, hip + 0.03],
          az, 0.048, 0.044, MAT.FIGURE);
      }
    }
  });

  // -------------------------------------------------------- skin: arms, head
  m.keyed(key * 5 + 3, () => {
    for (const [side, sgn] of [[1, -1], [-1, 1]] as const) {
      const swing = stride * sgn * 0.8;
      const az = side * (sz * 0.92 + 0.052);
      const wrist: [number, number] = sit ? [0.30, hip - 0.04] : [swing * 1.5, hip + 0.03];
      if (!sleeves) {
        limb([swing * 0.7, cuff], wrist, az, 0.044, 0.040, MAT.SKIN);
      }
      // Hands, whichever the sleeve.
      limb(wrist, sit ? [0.40, hip - 0.12] : [swing * 1.62, hip - 0.09], az,
        0.048, 0.042, MAT.SKIN);
    }
    box(-0.048, shoulder + 0.02, -0.052, 0.044, chin, 0.052, MAT.SKIN);
    // The head: 0.195m chin to crown, 0.15 across, an eighth of standing
    // height. It was a fifth once, which is a toddler on an adult body.
    box(-0.086, chin, -0.084, 0.084, crown, 0.084, MAT.SKIN);
    // Ears, and a wedge of a nose.
    for (const side of [1, -1] as const) {
      box(-0.020, chin + 0.078, side * 0.084, 0.014, chin + 0.126, side * 0.102, MAT.SKIN);
    }
    box(0.084, chin + 0.058, -0.018, 0.108, chin + 0.110, 0.018, MAT.SKIN);
  });
  // Two dark chips for eyes, set into the face rather than stuck on it.
  m.painted(TINT.METAL_DARK, () => {
    for (const side of [1, -1] as const) {
      box(0.078, chin + 0.104, side * 0.016, 0.090, chin + 0.130, side * 0.050, MAT.TRIM);
    }
  });
  // Hair: a slab over the skull with a fringe, and a tail on some.
  if (hair > 0.10) {
    m.keyed(key * 5 + 4, () => {
      box(-0.094, chin + 0.120, -0.090, 0.078, crown + 0.012, 0.090, MAT.HAIR);
      box(0.068, chin + 0.136, -0.088, 0.092, crown - 0.010, 0.088, MAT.HAIR);
      if (hair > 0.48) box(-0.112, chin + 0.020, -0.080, -0.078, crown, 0.080, MAT.HAIR);
      if (hair > 0.80) box(-0.100, shoulder - 0.02, -0.046, -0.062, chin + 0.06, 0.046, MAT.HAIR);
    });
  }
  if (opts.hat) {
    m.painted(TINT.METAL_DARK, () => {
      box(-0.104, crown - 0.006, -0.106, 0.140, crown + 0.014, 0.106, MAT.TRIM);
      box(-0.090, crown + 0.010, -0.090, 0.086, crown + 0.086, 0.090, MAT.TRIM);
    });
  }
  if (opts.bag) {
    m.keyed(key * 5 + 7, () => {
      box(-0.104, hip - 0.02, hz * 1.12, 0.028, hip + 0.20, hz * 1.12 + 0.078, MAT.FIGURE);
      limb([-0.04, hip + 0.20], [0.02, shoulder - 0.04], sz * 0.60, 0.016, 0.026, MAT.FIGURE);
    });
  }
}
// ------------------------------------------------------------------ the cars
//
// Each car is one loft plus its fittings. The station tables are where the
// character is: a hatchback's roof runs level to a stub tail, a saloon's steps
// down to a boot, a coupe's falls from the B-pillar to the rear bumper.






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
  // Twelve of them: a blocky figure is about three hundred triangles against
  // the thousand the sculpted one cost, and the two-cell ceiling is eight
  // thousand, so the saving goes straight back into a fuller pavement.
  const walkers: Array<[number, number, number, number]> = [
    [-7.6, -1.9, 0, 0.16], [-5.5, -2.4, 0, 0.13], [-3.4, -1.7, 0, 0.10],
    [-1.2, -2.3, 0, 0.17], [0.9, -1.8, 0, 0.18], [3.0, -2.4, 0, 0.06],
    [5.1, -1.9, 0, 0.15],
    [-6.4, 1.1, Math.PI, 0.14], [-4.2, 1.6, Math.PI, 0.09],
    [-1.9, 1.0, Math.PI, 0.17], [0.6, 1.5, Math.PI, 0.12],
    [3.2, 1.1, Math.PI, 0.16],
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
    person(m, 414, 7.5, 1.5, Math.PI * 0.9, { hat: true });

    // A child, and someone sitting on the bench.
    person(m, 421, 5.9, -0.9, Math.PI * 0.5, { scale: 0.66, stride: 0.13 });
    m.painted(TINT.WOOD, () => {
      m.box([-2.6, 0.14, 2.0], [0.4, 0.6, 2.6], MAT.TRIM);
      m.box([-2.6, 0.6, 2.5], [0.4, 1.1, 2.62], MAT.TRIM);
    });
    m.painted(TINT.METAL_DARK, () => {
      for (const px of [-2.4, 0.1]) m.box([px, 0.14, 2.1], [px + 0.12, 0.6, 2.5], MAT.TRIM);
    });
    // Seated, from the same figure as everyone else: `sit` swings the thighs
    // forward along the seat and drops the calves to the ground, and `lift`
    // puts the hips at seat height. It was hand-built out of tubes before,
    // which meant a second figure to keep in step with the first.
    person(m, 431, -1.36, 2.34, -Math.PI * 0.5, { sit: true, lift: 0.60 });
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


// ------------------------------------------------------- cars in buildings
//
// The service and industrial generators used to draw their vehicles as a
// painted box on four smaller boxes. Next to a lofted car in the same scene
// that reads as a placeholder, and every yard, forecourt and appliance bay in
// the library has one. These are the same bodies at a fraction of the cost:
// the loft and the wheels, none of the fittings, so a yard with six of them
// still costs less than one full car.

export type ParkedKind = 'car' | 'van' | 'truck' | 'bus';

/**
 * Which imported models stand in for each kind, and how long they should be.
 *
 * Built from whatever the packs actually contain rather than from a list of
 * ids, so adding a pack widens the choice on every forecourt in the library
 * without touching this file.
 */
const POOL: Record<ParkedKind, { ids: string[]; length: number }> = {
  car: { ids: [], length: 4.4 },
  van: { ids: [], length: 5.2 },
  truck: { ids: [], length: 6.4 },
  bus: { ids: [], length: 8.4 },
};
for (const id of IMPORTED_IDS) {
  const cls = id.replace(/^car\./, '').replace(/[0-9].*$/, '');
  if (cls === 'van' || cls === 'microvan') { POOL.van.ids.push(id); POOL.truck.ids.push(id); POOL.bus.ids.push(id); }
  else POOL.car.ids.push(id);
}

/**
 * A parked vehicle, facing along +x before placement.
 *
 * `turns` is quarter turns, the same convention as MeshBuilder.placed, so a
 * bay facing the street is 0 or 2 and one facing across it is 1 or 3. `key`
 * picks which vehicle; pass the same key twice and you get the same one twice,
 * which is what you do not want in a row of bays.
 *
 * This used to build a car out of a loft and four wheels, which is what put a
 * pink lozenge in every yard and forecourt. It now draws one of the imported
 * models, scaled to the length the bay expects -- so the seventy-odd places in
 * the library that park a car get the same vehicles the fleet does, from one
 * change here.
 */
export function parkedVehicle(m: MeshBuilder, key: number, cx: number, cz: number,
  turns: number, kind: ParkedKind = 'car', body?: number): void {
  void body;
  const pool = POOL[kind];
  if (pool.ids.length === 0) return;
  const k = Math.abs(Math.round(key));
  const id = pool.ids[k % pool.ids.length];
  // Drawn at its own size. The importer already scales each pack so its
  // median vehicle is 4.5m, so a van is longer than a hatchback and a truck
  // longer again -- stretching every model to a fixed bay length threw that
  // away and made a forecourt a row of identically sized boxes.
  //
  // The cheap copy, always: a forecourt parks eight of these and the full
  // model is four thousand triangles. At the size a parked car occupies on
  // screen the clustered one is indistinguishable.
  drawImported(m, id, { cx, cz, turns, low: true });
}

/**
 * An emergency or works vehicle of a given size, facing along +z.
 *
 * The service generators had their own box-on-four-boxes version of this. It
 * was fine on its own and stopped being fine the moment a lofted car parked
 * next to it, so they all call this instead: same call signature, a real body
 * and real wheels under it.
 */
export function applianceVehicle(m: MeshBuilder, cx: number, cz: number, len: number,
  wide: number, tint: number, light = true): void {
  const hl = len / 2, hw = wide / 2;
  // Built along +x at the origin and quarter-turned into place, because the
  // loft only runs one way and a service yard needs them facing the street.
  m.placed(cx, cz, 1, () => {
    const S: Section = [[0.42, 0.62], [0.78, 0.94], [1.9, 1.0], [2.28, 0.94], [2.44, 0.72]];
    const sc = hw / 1.0;
    const st: Station[] = [
      { x: -hl, s: shape(S, sc * 0.86, 2.05) },
      { x: -hl + 0.5, s: shape(S, sc * 0.98, 2.25) },
      { x: -hl + len * 0.34, s: shape(S, sc, 2.45) },
      { x: -hl + len * 0.36, s: shape(S, sc, 2.62) },
      { x: hl - 0.4, s: shape(S, sc, 2.62) },
      { x: hl, s: shape(S, sc * 0.94, 2.5) },
    ];
    m.painted(tint as never, () => loft(m, st, MAT.PAINT));
    for (const sz of [1, -1] as const) {
      m.quad([-hl + 0.3, 1.42, sz * hw * 0.95], [-hl + len * 0.3, 1.42, sz * hw * 0.95],
             [-hl + len * 0.3, 1.98, sz * hw * 0.95], [-hl + 0.3, 1.98, sz * hw * 0.95], MAT.CAR_GLASS);
    }
    m.painted(TINT.METAL_DARK, () => {
      // Locker shutters down both flanks, and the chassis rail under them.
      for (let i = 0; i < 3; i++) {
        const px = -hl + len * 0.42 + i * (len * 0.5) / 3;
        for (const sz of [1, -1] as const) {
          m.box([px, 0.78, Math.min(sz * hw, sz * (hw + 0.05))],
                [px + (len * 0.42) / 3, 1.74, Math.max(sz * hw, sz * (hw + 0.05))], MAT.TRIM);
        }
      }
      m.box([-hl + 0.2, 0.26, -hw * 0.9], [hl - 0.2, 0.44, hw * 0.9], MAT.TRIM);
    });
    for (const px of [-hl + len * 0.24, hl - len * 0.22]) {
      for (const sz of [1, -1] as const) wheel(m, px, 0.46, sz * (hw - 0.1), 0.45, 0.15, 12);
    }
    for (const sz of [1, -1] as const) {
      m.painted(TINT.SIGN_LIT, () =>
        m.box([-hl - 0.05, 0.9, sz * hw * 0.62 - 0.16], [-hl + 0.05, 1.2, sz * hw * 0.62 + 0.16],
          MAT.TRIM, { skipBottom: false }));
    }
    if (light) {
      m.painted(TINT.SIGN_LIT, () =>
        m.box([-hl + 0.5, 2.44, -hw * 0.7], [-hl + len * 0.3, 2.64, hw * 0.7], MAT.TRIM));
    }
  });
}

/** A figure, for building generators that want one for scale. */
export function figure(m: MeshBuilder, key: number, cx: number, cz: number, facing: number,
  opts: { stride?: number; bag?: boolean; hat?: boolean; scale?: number } = {}): void {
  person(m, key, cx, cz, facing, opts);
}

// ===================================================================== table

const road = (jobs: number): AssetDef['sim'] => ({
  jobs, powerKW: 0, waterM3: 0, garbagePerWeek: 0, pollution: 0, upkeep: 0,
});


// ---------------------------------------------------------- the road fleet
//
// Every vehicle below is a table entry rather than a generator. The first ten
// were written out one at a time, which is how you find out what a car needs
// and a bad way to keep twenty of them honest: the same forty lines of
// bumpers, lamps, mirrors and plates were restated each time and every copy
// drifted. One builder, twenty descriptions.

// ------------------------------------------------------------ seven more

// ------------------------------------------------------- more sections







// ------------------------------------------------------------- supercars

// ----------------------------------------------------------- basic cars

// ---------------------------------------------------------- medium cars

// --------------------------------------------------------------- cargo

// ----------------------------------------------------------- off-roaders

// -------------------------------------------------------------- trucks

// -------------------------------------------------------- service fleet

/**
 * The road fleet, imported.
 *
 * These are authored models from the low-poly packs rather than generators.
 * Everything else in the library is procedural, and for buildings that is the
 * right trade -- a generator gives you a hundred variants of a street for the
 * cost of one. A car is the opposite: there is one shape, everybody knows it
 * exactly, and no amount of parameterisation gets a lofted body to the point
 * where it reads as a specific car rather than as a car-shaped object.
 *
 * The pedestrians and the cyclists stay generated, because a crowd does want
 * variants, and so does parkedVehicle() -- the cars standing in yards and
 * forecourts across forty building generators, where an imported mesh at two
 * thousand triangles apiece would cost more than the buildings holding them.
 */
const fleetOf = (id: string): AssetDef => {
  const [hx, hy, hz] = importedSize(id);
  const cells = (v: number): number => Math.max(1, Math.ceil((v * 2 + 1.6) / CELL));
  return {
    id,
    name: importedName(id),
    zone: 'fleet',
    density: 'none',
    variant: 'sculpted',
    footprint: [cells(hx), cells(hz)],
    height: hy,
    sim: road(0),
    note: `Imported low-poly model, ${(hx * 2).toFixed(1)}m long, coloured per vertex.`,
    build: (lod: number): MeshBuilder => {
      const m = new MeshBuilder();
      tarmac(m, hx + 0.9, hz + 0.9);
      // The pack ships one level of detail, so the ladder is: the model, the
      // model without the figure beside it, then a coloured box.
      if (lod >= 2) drawImpostor(m, id);
      else drawImported(m, id);
      if (lod < 1) person(m, id.length * 37 + 3, hx + 1.4, hz + 0.6, Math.PI, { stride: 0.12 });
      return m;
    },
  };
};

export const FLEET: AssetDef[] = [
  ...IMPORTED_IDS.map(fleetOf),
  { id: 'car.people', name: 'Pedestrians', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [2, 1], height: 5.3, brand: { name: 'People', colour: [0.30, 0.32, 0.36], accent: [0.52, 0.44, 0.30], sign: 'none' }, sim: road(0), note: 'Figures on a kerbed pavement: two lanes walking, a group talking, a child, someone on a bench.', build: pedestrians },
  { id: 'car.cyclists', name: 'Cyclists', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [2, 1], height: 1.9, brand: { name: 'Cycles', colour: [0.16, 0.34, 0.30], accent: [0.62, 0.40, 0.12], sign: 'none' }, sim: road(0), note: 'Three riders on diamond-frame bicycles, a scooter with an apron and headlamp, and a full bike stand.', build: cyclists },
];

