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
/** A car section: sill, waist, shoulder, tumblehome, roof. */
const CAR: Section = [[0.30, 0.72], [0.62, 0.88], [1.00, 0.90], [1.24, 0.82], [1.42, 0.62]];
/** A van or bus section: near-vertical sides and a slightly domed roof. */
const BOX: Section = [[0.34, 0.90], [0.70, 1.10], [1.60, 1.16], [2.40, 1.14], [2.62, 0.92]];

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
 * A tapered limb between two points, with a rounded end at each.
 *
 * The figures were forty axis-aligned boxes each, which is why they read as a
 * stack of bricks: a box cannot point along an arm, so every limb was a
 * vertical block with the stride faked by sliding it sideways, and shoulders,
 * elbows and knees were all right angles. This is a prism swept between two
 * arbitrary points with a radius at each end, so a limb can lie along its own
 * bone and taper from thigh to knee the way a leg does.
 */
function bone(m: MeshBuilder, a: Vec3, b: Vec3, r0: number, r1: number,
  mat: Material, sides = 6): void {
  const ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2];
  const len = Math.hypot(ax, ay, az);
  if (len < 1e-5) return;
  const ux = ax / len, uy = ay / len, uz = az / len;
  // A perpendicular basis: pick whichever axis the bone is least aligned with.
  let px = 0, py = 0, pz = 1;
  if (Math.abs(uz) > 0.9) { px = 1; py = 0; pz = 0; }
  let e1x = uy * pz - uz * py, e1y = uz * px - ux * pz, e1z = ux * py - uy * px;
  const e1l = Math.hypot(e1x, e1y, e1z);
  e1x /= e1l; e1y /= e1l; e1z /= e1l;
  const e2x = uy * e1z - uz * e1y, e2y = uz * e1x - ux * e1z, e2z = ux * e1y - uy * e1x;
  const ring = (c: Vec3, r: number, k: number): Vec3 => {
    const t = (k / sides) * Math.PI * 2;
    const cs = Math.cos(t) * r, sn = Math.sin(t) * r;
    return [c[0] + e1x * cs + e2x * sn, c[1] + e1y * cs + e2y * sn, c[2] + e1z * cs + e2z * sn];
  };
  for (let k = 0; k < sides; k++) {
    m.quad(ring(a, r0, k), ring(a, r0, k + 1), ring(b, r1, k + 1), ring(b, r1, k), mat);
    // End caps, so a limb is a solid and not a tube you can see down.
    m.tri(ring(a, r0, k + 1), ring(a, r0, k), a, mat);
    m.tri(ring(b, r1, k), ring(b, r1, k + 1), b, mat);
  }
}

/** A rounded mass: a barrel with a domed top and bottom. Heads and torsos. */
function blob(m: MeshBuilder, c: Vec3, rx: number, ry: number, rz: number,
  mat: Material, sides = 7, rows = 3): void {
  for (let j = 0; j < rows; j++) {
    const t0 = -1 + (2 * j) / rows, t1 = -1 + (2 * (j + 1)) / rows;
    const y0 = c[1] + t0 * ry, y1 = c[1] + t1 * ry;
    const s0 = Math.sqrt(Math.max(0, 1 - t0 * t0)), s1 = Math.sqrt(Math.max(0, 1 - t1 * t1));
    for (let k = 0; k < sides; k++) {
      const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2;
      const p = (a: number, s: number, y: number): Vec3 =>
        [c[0] + Math.cos(a) * rx * s, y, c[2] + Math.sin(a) * rz * s];
      if (j === 0) m.tri(p(a1, s1, y1), p(a0, s1, y1), [c[0], y0, c[2]], mat);
      else if (j === rows - 1) m.tri(p(a0, s0, y0), p(a1, s0, y0), [c[0], y1, c[2]], mat);
      if (s0 > 0.01 && s1 > 0.01) {
        m.quad(p(a0, s0, y0), p(a1, s0, y0), p(a1, s1, y1), p(a0, s1, y1), mat);
      }
    }
  }
}

/**
 * A person.
 *
 * Proportioned to a real body at 1.75m: hip at 0.53 of standing height,
 * shoulder at 0.82, chin at 0.87, head an eighth of the whole.
 *
 * Three things carry a figure at the size it is actually seen -- a couple of
 * hundred pixels here, three or four in play -- and none of them is anatomy.
 *
 * The silhouette: shoulders wider than hips, a waist between them, arms clear
 * of the body, legs apart, feet flat on the ground. That is what the loft
 * through pelvis, waist, chest, shoulder and trapezius is for, and why a limb
 * is a tapered prism laid along its own bone rather than a stack of boxes.
 *
 * The colour breaks: top, trousers, shoes, skin and hair are five keys, not
 * one. A figure in a single colour from collar to ankle is a mannequin however
 * well it is shaped, and splitting the garment at the waist did more for these
 * than every facial feature put together.
 *
 * And restraint about the face. A brow ridge, a mouth bar, cheekbones and an
 * eyeball with an iris on it, on a head 15cm across, do not read as a face at
 * any distance -- they read as a head that has been scribbled on. What is left
 * is a skull, a jaw, a nose with two centimetres of relief, and one dark mass
 * per eye set into the socket.
 *
 * Every proportion, garment and tone comes from the key, so a crowd of twenty
 * is twenty people and the same key is the same person every time.
 */
function person(m: MeshBuilder, key: number, cx: number, cz: number, facing: number,
  opts: { stride?: number; bag?: boolean; hat?: boolean; scale?: number; lift?: number } = {}): void {
  const rnd = (n: number): number => {
    const v = Math.sin(key * 12.9898 + n * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  const s = (opts.scale ?? 1.0) * (0.94 + rnd(1) * 0.13);
  const lift = opts.lift ?? 0;
  const stride = opts.stride ?? 0;
  const broad = 0.90 + rnd(2) * 0.26;            // build, shoulder to hip
  const tall = 0.97 + rnd(3) * 0.07;
  const coat = rnd(4) > 0.66;
  const hair = rnd(5);
  const skirt = rnd(8) > 0.78;
  const co = Math.cos(facing), si = Math.sin(facing);

  /** Local (forward, up, side) to world. */
  const at = (fx: number, fy: number, fz: number): Vec3 =>
    [cx + (fx * co - fz * si) * s, lift + fy * s, cz + (fx * si + fz * co) * s];
  const lb = (a: [number, number, number], b: [number, number, number],
    r0: number, r1: number, mat: Material, sides = 7): void =>
    bone(m, at(a[0], a[1], a[2]), at(b[0], b[1], b[2]), r0 * s, r1 * s, mat, sides);
  /**
   * A lofted stack of ellipses, in local (forward, up, half-wide, half-deep).
   *
   * `bone` sweeps a circular section, so a trunk built from it is as deep as
   * it is broad -- a sausage with arms. A human trunk is about two wide to one
   * deep at the chest and narrows at the waist, and that ratio is most of what
   * reads as a person at any distance. Same for a skull, which is longer front
   * to back than it is wide.
   */
  const stack = (rings: Array<[number, number, number, number]>, mat: Material,
    sides = 10): void => {
    const put = (r: [number, number, number, number], k: number): Vec3 => {
      const t = (k / sides) * Math.PI * 2;
      return at(r[0] + Math.cos(t) * r[3], r[1], Math.sin(t) * r[2]);
    };
    for (let j = 0; j + 1 < rings.length; j++) {
      const lo = rings[j], hi = rings[j + 1];
      for (let k = 0; k < sides; k++) {
        m.quad(put(lo, k), put(lo, k + 1), put(hi, k + 1), put(hi, k), mat);
      }
    }
    const f = rings[0], l = rings[rings.length - 1];
    for (let k = 0; k < sides; k++) {
      m.tri(put(f, k + 1), put(f, k), at(f[0], f[1], 0), mat);
      m.tri(put(l, k), put(l, k + 1), at(l[0], l[1], 0), mat);
    }
  };

  // The skeleton, as fractions of a 1.75m body.
  const ankle = 0.075 * tall;
  const knee = 0.480 * tall;
  const hip = 0.930 * tall;
  const waist = 1.075 * tall;
  const chest = 1.245 * tall;
  const shoulder = 1.435 * tall;
  const chin = 1.560 * tall;
  const crown = 1.750 * tall;
  const hw = 0.106 * broad;                      // half the width across the hips
  const sw = 0.216 * broad;                      // half the width across the shoulders

  // Trousers, in their own key. A figure in one colour from collar to ankle is
  // a mannequin however well it is shaped; the break at the waist is worth
  // more than any amount of detail above it.
  m.keyed(key * 5 + 1, () => {
    if (skirt) {
      stack([
        [0, knee + 0.06, hw * 1.62, hw * 1.30],
        [0, hip - 0.10, hw * 1.34, hw * 1.06],
        [0, waist - 0.02, 0.118 * broad, 0.092 * broad],
      ], MAT.FIGURE, 9);
    } else {
      for (const [sz, sgn] of [[1, 1], [-1, -1]] as const) {
        const swing = stride * sgn;
        const kneeF = swing * 0.55;
        const bend = Math.max(0, -sgn * stride) * 0.09;
        lb([0, hip - 0.02, sz * hw], [kneeF, knee + bend, sz * hw * 0.93],
          0.078, 0.054, MAT.FIGURE, 6);
      }
      // The seat: the two legs meet in one mass rather than at a point.
      stack([
        [0, hip - 0.16, hw * 0.94, hw * 0.80],
        [0, hip - 0.04, hw * 1.24, hw * 0.98],
        [0, waist - 0.02, 0.118 * broad, 0.092 * broad],
      ], MAT.FIGURE, 9);
    }
    // Calves below the hem, whichever the garment.
    for (const [sz, sgn] of [[1, 1], [-1, -1]] as const) {
      const swing = stride * sgn;
      const kneeF = swing * 0.55, footF = swing * 1.25;
      const bend = Math.max(0, -sgn * stride) * 0.09;
      const mat = skirt ? MAT.SKIN : MAT.FIGURE;
      if (skirt) {
        m.keyed(key * 5 + 3, () =>
          lb([kneeF, knee + bend, sz * hw * 0.93], [footF, ankle + 0.03, sz * hw * 0.88],
            0.052, 0.040, mat, 6));
      } else {
        lb([kneeF, knee + bend, sz * hw * 0.93], [footF, ankle + 0.03, sz * hw * 0.88],
          0.055, 0.042, mat, 6);
      }
    }
  });

  // The top: trunk from waist to the trapezius, arms, and a coat on some.
  m.keyed(key * 5 + 2, () => {
    stack([
      [0, waist - 0.04, 0.122 * broad, 0.094 * broad],
      [0, chest, 0.150 * broad, 0.120 * broad],
      [0, chest + 0.11, 0.164 * broad, 0.116 * broad],
      [0, shoulder, sw * 0.94, 0.108 * broad],
      // The trapezius, then a collar. Without them the neck rises out of a
      // flat plate with twenty centimetres of it showing, and the figure looks
      // long-necked however short the neck actually is.
      [0, shoulder + 0.055, 0.104 * broad, 0.082 * broad],
      [0, chin - 0.055, 0.082, 0.076],
    ], MAT.FIGURE, 9);
    // A deltoid where each arm leaves the yoke. There was a bone straight
    // across the shoulders as well, which at six sides is a plank: from the
    // front every figure had a board nailed across its collarbones.
    for (const sz of [1, -1] as const) {
      blob(m, at(0, shoulder - 0.052, sz * sw * 0.88), 0.058 * s, 0.062 * s, 0.054 * s,
        MAT.FIGURE, 6, 2);
    }
    if (coat) {
      // Hem above the knee and drawn in, so a standing camera does not look
      // up into an open box hanging between the legs.
      stack([
        [0, hip - 0.20, 0.138 * broad, 0.102 * broad],
        [0, hip - 0.14, 0.152 * broad, 0.114 * broad],
        [0, waist, 0.134 * broad, 0.102 * broad],
        [0, chest + 0.06, 0.160 * broad, 0.122 * broad],
      ], MAT.FIGURE, 9);
    }
    // Arms, swinging opposite the legs, with the forearm angled in. The upper
    // arm is the garment; below the cuff it is skin, unless there is a coat.
    for (const [sz, sgn] of [[1, -1], [-1, 1]] as const) {
      const swing = stride * sgn * 0.8;
      const az = sz * sw * 0.92;
      const cuff = chest - 0.10;
      lb([0, shoulder - 0.06, az], [swing * 0.7, cuff, az], 0.058, 0.046, MAT.FIGURE);
      if (coat || rnd(9) > 0.45) {
        lb([swing * 0.7, cuff, az], [swing * 1.5, hip + 0.02, az * 0.90],
          0.046, 0.036, MAT.FIGURE);
      } else {
        m.keyed(key * 5 + 3, () =>
          lb([swing * 0.7, cuff, az], [swing * 1.5, hip + 0.02, az * 0.90],
            0.044, 0.035, MAT.SKIN));
      }
    }
  });

  // Shoes: dark leather, whatever the trousers. A flat box, longer than it is
  // wide and wider than it is tall -- the round-ended stub the bone helper
  // gives is an ankle with a bulb on it, and the leg tapers past it to a spike.
  m.painted(TINT.METAL_DARK, () => {
    for (const [sz, sgn] of [[1, 1], [-1, -1]] as const) {
      const footF = stride * sgn * 1.25;
      const az = sz * hw * 0.88;
      const c = (f: number, y: number, z: number): Vec3 => at(footF + f, y, az + z);
      const hf = 0.105, hz = 0.043, top = 0.066;
      const p = [
        c(-0.075, 0, -hz), c(hf, 0, -hz), c(hf, 0.030, -hz), c(-0.075, top, -hz),
        c(-0.075, 0, hz), c(hf, 0, hz), c(hf, 0.030, hz), c(-0.075, top, hz),
      ];
      m.quad(p[0], p[1], p[2], p[3], MAT.TRIM);
      m.quad(p[5], p[4], p[7], p[6], MAT.TRIM);
      m.quad(p[4], p[5], p[1], p[0], MAT.TRIM);
      m.quad(p[3], p[2], p[6], p[7], MAT.TRIM);
      m.quad(p[1], p[5], p[6], p[2], MAT.TRIM);
      m.quad(p[4], p[0], p[3], p[7], MAT.TRIM);
    }
  });

  // Hands, neck and head, all skin.
  m.keyed(key * 5 + 3, () => {
    for (const [sz, sgn] of [[1, -1], [-1, 1]] as const) {
      const swing = stride * sgn * 0.8;
      const az = sz * sw * 0.92 * 0.90;
      // Centred on the wrist, and three rows rather than two: a two-row blob
      // is a bicone, and a downward cone the size of a fist takes no light at
      // all -- everybody appeared to be carrying a black spike.
      blob(m, at(swing * 1.5, hip + 0.02, az), 0.046 * s, 0.060 * s, 0.038 * s, MAT.SKIN, 6, 3);
    }
    lb([-0.014, shoulder - 0.06, 0], [-0.006, chin + 0.02, 0], 0.060, 0.054, MAT.SKIN, 8);
    // Skull and jaw: 0.19m chin to crown, 0.15 across, an eighth of standing
    // height. It was a fifth, which is a toddler's proportion on an adult.
    const hy = (chin + crown) / 2;
    stack([
      [0, chin, 0.056, 0.058],
      [0, chin + 0.030, 0.066, 0.072],
      [0, chin + 0.062, 0.070, 0.078],
      [0, hy + 0.010, 0.074, 0.082],
      [0, crown - 0.048, 0.072, 0.078],
      [0, crown - 0.014, 0.058, 0.062],
      [0, crown, 0.030, 0.032],
    ], MAT.SKIN, 9);
    for (const sz of [1, -1] as const) {
      blob(m, at(-0.014, chin + 0.098, sz * 0.072), 0.018 * s, 0.028 * s, 0.010 * s,
        MAT.SKIN, 4, 2);
    }
    // The nose, from between the brows down and out. Two centimetres of
    // relief, which is what a nose has; four and a half is a gargoyle.
    lb([0.056, chin + 0.108, 0], [0.076, chin + 0.058, 0], 0.014, 0.011, MAT.SKIN, 6);
  });
  // One dark mass per eye, set into the socket under the brow.
  for (const sz of [1, -1] as const) {
    m.painted(TINT.METAL_DARK, () =>
      blob(m, at(0.056, chin + 0.098, sz * 0.030), 0.009 * s, 0.008 * s, 0.013 * s,
        MAT.TRIM, 5, 2));
  }
  // Hair: a shell over the skull, longer at the back on some.
  if (hair > 0.10) {
    m.keyed(key * 5 + 4, () => {
      stack([
        [0, chin + 0.104, 0.076, 0.084],
        [0, crown - 0.044, 0.078, 0.084],
        [0, crown - 0.010, 0.062, 0.066],
        [0, crown + 0.008, 0.030, 0.032],
      ], MAT.HAIR, 8);
      if (hair > 0.45) lb([-0.056, crown - 0.030, 0], [-0.070, chin + 0.070, 0], 0.062, 0.056,
        MAT.HAIR, 7);
      if (hair > 0.78) lb([-0.068, chin + 0.060, 0], [-0.076, shoulder + 0.03, 0], 0.058, 0.046,
        MAT.HAIR, 7);
    });
  }
  if (opts.hat) {
    m.painted(TINT.METAL_DARK, () => {
      lb([0.012, crown - 0.028, 0], [0.012, crown - 0.008, 0], 0.120, 0.120, MAT.TRIM, 8);
      lb([0, crown - 0.014, 0], [0, crown + 0.078, 0], 0.076, 0.070, MAT.TRIM, 8);
    });
  }
  if (opts.bag) {
    m.keyed(key * 5 + 7, () => {
      // At the hip on a strap across the chest. Slung on the chest itself, it
      // read as a slab of body armour.
      blob(m, at(-0.05, hip + 0.06, 0.21 * broad), 0.075 * s, 0.095 * s, 0.045 * s,
        MAT.FIGURE, 6, 2);
      lb([0, shoulder - 0.04, -0.05], [-0.05, hip + 0.16, 0.20 * broad], 0.018, 0.018,
        MAT.FIGURE, 4);
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
  // Seven walkers. A figure with a built head -- skull, jaw, ears, brow, nose,
  // sockets and eyes -- is about a thousand triangles, and the two-cell fleet
  // ceiling is eight thousand. Seven people you can look at beats twelve you
  // cannot.
  const walkers: Array<[number, number, number, number]> = [
    [-7.0, -1.9, 0, 0.16], [-3.4, -2.3, 0, 0.10], [0.2, -1.7, 0, 0.18],
    [4.0, -2.2, 0, 0.06],
    [-5.2, 1.0, Math.PI, 0.14], [-0.4, 1.4, Math.PI, 0.09],
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

    // A child, and someone sitting on the bench.
    person(m, 421, 5.9, -0.9, Math.PI * 0.5, { scale: 0.66, stride: 0.13 });
    m.painted(TINT.WOOD, () => {
      m.box([-2.6, 0.14, 2.0], [0.4, 0.6, 2.6], MAT.TRIM);
      m.box([-2.6, 0.6, 2.5], [0.4, 1.1, 2.62], MAT.TRIM);
    });
    m.painted(TINT.METAL_DARK, () => {
      for (const px of [-2.4, 0.1]) m.box([px, 0.14, 2.1], [px + 0.12, 0.6, 2.5], MAT.TRIM);
    });
    // Seated: thighs forward along the seat, calves down to the ground, torso
    // upright against the back. Four raw boxes before, which from any angle
    // but square on was a pile of bricks on a bench.
    const sx0 = -1.36;
    m.keyed(431, () => {
      for (const dz of [-0.14, 0.14] as const) {
        bone(m, [sx0 + dz, 0.68, 2.34], [sx0 + dz, 0.66, 1.84], 0.085, 0.062, MAT.FIGURE, 6);
        bone(m, [sx0 + dz, 0.66, 1.84], [sx0 + dz, 0.10, 1.76], 0.062, 0.045, MAT.FIGURE, 6);
      }
      blob(m, [sx0, 0.70, 2.30], 0.13, 0.11, 0.17, MAT.FIGURE, 7, 3);
      bone(m, [sx0, 0.70, 2.34], [sx0, 1.06, 2.42], 0.150, 0.164, MAT.FIGURE, 8);
      bone(m, [sx0, 1.06, 2.42], [sx0, 1.28, 2.44], 0.164, 0.140, MAT.FIGURE, 8);
      for (const dz of [-0.16, 0.16] as const) {
        bone(m, [sx0 + dz, 1.24, 2.42], [sx0 + dz, 0.92, 2.20], 0.062, 0.050, MAT.FIGURE, 6);
        bone(m, [sx0 + dz, 0.92, 2.20], [sx0 + dz, 0.78, 1.96], 0.045, 0.038, MAT.FIGURE, 6);
      }
      bone(m, [sx0, 1.26, 2.44], [sx0, 1.40, 2.44], 0.056, 0.052, MAT.SKIN, 7);
      blob(m, [sx0, 1.50, 2.42], 0.084, 0.106, 0.080, MAT.SKIN, 8, 4);
      blob(m, [sx0, 1.44, 2.34], 0.066, 0.056, 0.062, MAT.SKIN, 7, 3);
      bone(m, [sx0, 1.50, 2.30], [sx0, 1.46, 2.24], 0.018, 0.012, MAT.SKIN, 5);
    });
    m.painted(TINT.METAL_DARK, () => {
      for (const dz of [-0.035, 0.035] as const) {
        blob(m, [sx0 + dz, 1.53, 2.32], 0.013, 0.012, 0.012, MAT.TRIM, 5, 2);
      }
      bone(m, [sx0 - 0.026, 1.415, 2.30], [sx0 + 0.026, 1.415, 2.30], 0.009, 0.009, MAT.TRIM, 4);
    });
    m.keyed(437, () => blob(m, [sx0, 1.575, 2.44], 0.089, 0.078, 0.084, MAT.HAIR, 8, 3));
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
 * A parked vehicle, facing along +x before placement.
 *
 * `turns` is quarter turns anticlockwise, so a bay facing the street is 0 or
 * 2 and one facing across it is 1 or 3. `key` picks the paint; pass the same
 * key twice and you get the same car twice, which is what you do not want in
 * a row of bays.
 */
export function parkedVehicle(m: MeshBuilder, key: number, cx: number, cz: number,
  turns: number, kind: ParkedKind = 'car', body?: number): void {
  // Station tables first, so the glazing and the wheels can be sampled off the
  // body rather than sized by hand for each kind.
  const bus: Station[] = [
    { x: -5.6, s: shape(BOX, 0.94, 2.90) },
    { x: -5.2, s: shape(BOX, 1.02, 3.05) },
    { x: 5.2, s: shape(BOX, 1.02, 3.10) },
    { x: 5.6, s: shape(BOX, 0.94, 2.95) },
  ];
  const cab: Station[] = [
    { x: -4.2, s: shape(BOX, 0.80, 2.30) },
    { x: -3.9, s: shape(BOX, 0.92, 2.55) },
    { x: -2.2, s: shape(BOX, 0.94, 2.70) },
    { x: -1.9, s: shape(BOX, 0.90, 2.30) },
  ];
  const trailer: Station[] = [
    { x: -1.8, s: shape(BOX, 0.96, 3.10) },
    { x: 4.4, s: shape(BOX, 0.96, 3.10) },
  ];
  const van: Station[] = [
    { x: -2.5, s: shape(BOX, 0.72, 1.30) },
    { x: -2.2, s: shape(BOX, 0.88, 1.60) },
    { x: -1.0, s: shape(BOX, 1.00, 2.42) },
    { x: 2.4, s: shape(BOX, 1.00, 2.56) },
  ];
  const car: Station[] = [
    { x: -2.2, s: shape(CAR, 0.82, 0.98) },
    { x: -1.5, s: shape(CAR, 1.00, 1.14) },
    { x: -0.7, s: shape(CAR, 1.04, 1.46) },
    { x: 0.9, s: shape(CAR, 1.04, 1.48) },
    { x: 1.7, s: shape(CAR, 1.00, 1.20) },
    { x: 2.2, s: shape(CAR, 0.86, 1.04) },
  ];
  const st = kind === 'bus' ? bus : kind === 'truck' ? cab : kind === 'van' ? van : car;

  m.placed(cx, cz, turns, () => {
    const paint = (): void => {
      loft(m, st, MAT.PAINT);
      if (kind === 'truck') loft(m, trailer, MAT.PAINT);
    };
    if (body === undefined) m.keyed(key, paint);
    else m.painted(body as never, paint);

    // Wheels and glazing: the two things that stop it reading as a crate.
    if (kind === 'bus') {
      for (const cw of [-3.8, 3.2, 4.4]) {
        for (const sz of [1, -1] as const) wheel(m, cw, 0.48, sz * 0.98, 0.47, 0.17, 10);
      }
      for (const sz of [1, -1] as const) {
        m.quad([-4.6, 1.4, sz * 1.20], [4.6, 1.4, sz * 1.20],
               [4.6, 2.5, sz * 1.20], [-4.6, 2.5, sz * 1.20], MAT.CAR_GLASS);
      }
    } else if (kind === 'truck') {
      for (const cw of [-3.5, -2.2, 2.6, 3.8]) {
        for (const sz of [1, -1] as const) wheel(m, cw, 0.52, sz * 0.92, 0.51, 0.16, 10);
      }
    } else if (kind === 'van') {
      for (const cw of [-1.6, 1.7]) {
        for (const sz of [1, -1] as const) wheel(m, cw, 0.40, sz * 0.86, 0.39, 0.15, 10);
      }
      for (const sz of [1, -1] as const) {
        m.quad([-0.6, 1.5, sz * 1.14], [2.2, 1.5, sz * 1.14],
               [2.2, 2.3, sz * 1.14], [-0.6, 2.3, sz * 1.14], MAT.CAR_GLASS);
      }
    } else {
      for (const cw of [-1.45, 1.5]) {
        for (const sz of [1, -1] as const) wheel(m, cw, 0.35, sz * 0.76, 0.34, 0.13, 10);
      }
    }
    // Lights, so it has a front and a back at any distance.
    const nose = st[0].x;
    const tail = kind === 'truck' ? trailer[trailer.length - 1].x : st[st.length - 1].x;
    const lampY = kind === 'car' ? 0.9 : 1.2;
    for (const sz of [1, -1] as const) {
      m.painted(TINT.SIGN_LIT, () =>
        m.box([nose - 0.04, lampY - 0.15, sz * 0.6 - 0.16], [nose + 0.06, lampY + 0.15, sz * 0.6 + 0.16],
          MAT.TRIM, { skipBottom: false }));
      m.painted(TINT.BRAND, () =>
        m.box([tail - 0.06, lampY - 0.15, sz * 0.6 - 0.16], [tail + 0.04, lampY + 0.15, sz * 0.6 + 0.16],
          MAT.TRIM, { skipBottom: false }));
    }
  });
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

