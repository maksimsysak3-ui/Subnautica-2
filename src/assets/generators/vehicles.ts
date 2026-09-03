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
 * Skins a run of stations into a closed painted shell.
 *
 * The flanks are quads between neighbouring section points, so a section with
 * a chamfer between the waist and the roof produces a real chamfered surface
 * with its own normal -- which is the whole reason for doing it this way
 * rather than stacking boxes, since a box roofline catches light in one flat
 * plane and reads as cardboard.
 *
 * `upTo` skins only the bands below a given section index and closes the top
 * with a deck. That is how a car is actually made here: this builds the lower
 * body -- sills, doors, wings, bonnet and boot -- and cabin() sets the
 * greenhouse on the deck. Glazing whole bands of this shell instead was what
 * left every car in the fleet see-through, because a band runs the full length
 * of the vehicle and a single-sided pane is nothing at all from behind.
 */
function loft(m: MeshBuilder, st: Station[], mat: Material,
  opts: { ends?: boolean; upTo?: number } = {}): void {
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

  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i], b = st[i + 1];
    const ua = uAt(a.x), ub = uAt(b.x);
    for (let j = 0; j < top; j++) {
      const [ay0, aw0] = a.s[j], [ay1, aw1] = a.s[j + 1];
      const [by0, bw0] = b.s[j], [by1, bw1] = b.s[j + 1];
      const v0 = vAt(j), v1 = vAt(j + 1);
      // +z flank, then -z with the winding reversed so both face outwards.
      m.quadUV([a.x, ay0, aw0], [b.x, by0, bw0], [b.x, by1, bw1], [a.x, ay1, aw1],
        [[ua, v0], [ub, v0], [ub, v1], [ua, v1]], mat);
      m.quadUV([a.x, ay1, -aw1], [b.x, by1, -bw1], [b.x, by0, -bw0], [a.x, ay0, -aw0],
        [[ua, v1], [ub, v1], [ub, v0], [ua, v0]], mat);
    }
    // Deck and floor: the strips that close the section top and bottom.
    const at = a.s[top], bt = b.s[top], ab = a.s[0], bb = b.s[0];
    const vt = vAt(top);
    m.quadUV([a.x, at[0], at[1]], [b.x, bt[0], bt[1]], [b.x, bt[0], -bt[1]], [a.x, at[0], -at[1]],
      [[ua, vt], [ub, vt], [ub, vt], [ua, vt]], mat);
    m.quadUV([a.x, ab[0], -ab[1]], [b.x, bb[0], -bb[1]], [b.x, bb[0], bb[1]], [a.x, ab[0], ab[1]],
      [[ua, 0], [ub, 0], [ub, 0], [ua, 0]], mat);
  }
  if (opts.ends === false) return;
  // End caps, as a fan from the mid-height of the part that was skinned.
  for (const [st0, dir] of [[st[0], -1], [st[st.length - 1], 1]] as const) {
    const mid = (st0.s[0][0] + st0.s[top][0]) / 2;
    const u = uAt(st0.x);
    for (let j = 0; j < top; j++) {
      const [y0, w0] = st0.s[j], [y1, w1] = st0.s[j + 1];
      const c: Vec3 = [st0.x, mid, 0];
      const v0 = vAt(j), v1 = vAt(j + 1), vm = 0.5;
      // The caps carry coordinates too. Left at zero they came out at v = 0,
      // which is the sill, so every nose and tail in the fleet was painted the
      // dark colour the shader uses under the sills.
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

/** The section index at the widest point: a car's shoulder, and its belt line. */
function beltIndex(sec: Section): number {
  let best = 0;
  for (let j = 1; j < sec.length; j++) if (sec[j][1] >= sec[best][1]) best = j;
  return best;
}

/**
 * The greenhouse: a closed cabin standing on the body's deck.
 *
 * Its own shell, not a glazed band of the body's. That is the whole point --
 * the cabin is closed on six sides, so there is no angle from which you can
 * see through the car, and the glass can be inset from the pillars instead of
 * replacing them. Windscreen and backlight rake in, the pillars stay in body
 * colour, and the roof is painted, because a glass roof is a sunroof.
 */
function cabin(m: MeshBuilder, st: Station[], mat: Material,
  o: { from: number; to: number; pillars?: number[] }): void {
  const n = st[0].s.length;
  const belt = beltIndex(st[0].s);
  if (belt >= n - 1) return;
  const bx0 = st[0].x, bx1 = st[st.length - 1].x;
  const span = (bx1 - bx0) || 1;
  const x0 = bx0 + span * o.from, x1 = bx0 + span * o.to;
  const pillars = o.pillars ?? [];

  /** Section values anywhere along the body, interpolated between stations. */
  const at = (x: number): Section => {
    let i = 0;
    while (i < st.length - 2 && st[i + 1].x < x) i++;
    const a = st[i], b = st[i + 1];
    const t = Math.min(1, Math.max(0, (x - a.x) / ((b.x - a.x) || 1)));
    return a.s.map((p, j) => [p[0] + (b.s[j][0] - p[0]) * t,
      p[1] + (b.s[j][1] - p[1]) * t] as [number, number]);
  };

  const segs = 10;
  const xs: number[] = [];
  for (let i = 0; i <= segs; i++) xs.push(x0 + ((x1 - x0) * i) / segs);
  // Cabin plan: narrower than the body at the belt, and tucked in further at
  // the roof, which is what gives a car its tumblehome.
  const sill = xs.map((x) => at(x)[belt]);
  const roof = xs.map((x) => at(x)[n - 1]);
  const tuck = (i: number, upper: boolean): number =>
    (upper ? roof[i][1] : sill[i][1]) * (upper ? 0.90 : 0.965);
  const yOf = (i: number, upper: boolean): number => (upper ? roof[i][0] : sill[i][0] + 0.02);

  for (let i = 0; i < segs; i++) {
    const ua = i / segs, ub = (i + 1) / segs;
    const midU = o.from + ((ua + ub) / 2) * (o.to - o.from);
    // A pillar is a run of the cabin side left in body colour, and the first
    // and last runs always are: those are the A and D posts.
    const post = i === 0 || i === segs - 1
      || pillars.some((pu) => Math.abs(midU - pu) < 0.028);
    const band = post ? mat : MAT.CAR_GLASS;
    const inset = post ? 0 : 0.02;
    for (const sz of [1, -1] as const) {
      const wa0 = sz * (tuck(i, false) - inset), wa1 = sz * (tuck(i, true) - inset);
      const wb0 = sz * (tuck(i + 1, false) - inset), wb1 = sz * (tuck(i + 1, true) - inset);
      const A: Vec3 = [xs[i], yOf(i, false), wa0], B: Vec3 = [xs[i + 1], yOf(i + 1, false), wb0];
      const C: Vec3 = [xs[i + 1], yOf(i + 1, true), wb1], D: Vec3 = [xs[i], yOf(i, true), wa1];
      // Surface v is kept below the shader's sky-mix threshold on painted
      // pillars and on the roof. Above it the paint takes a strong sky tint,
      // which on a closed cabin came out as a flat grey lid sitting on a
      // coloured car.
      const v0 = post ? 0.56 : 0.0, v1 = post ? 0.72 : 1.0;
      if (sz > 0) m.quadUV(A, B, C, D, [[ua, v0], [ub, v0], [ub, v1], [ua, v1]], band);
      else m.quadUV(D, C, B, A, [[ua, v1], [ub, v1], [ub, v0], [ua, v0]], band);
    }
    // Roof panel.
    m.quadUV([xs[i], yOf(i, true), tuck(i, true)], [xs[i + 1], yOf(i + 1, true), tuck(i + 1, true)],
      [xs[i + 1], yOf(i + 1, true), -tuck(i + 1, true)], [xs[i], yOf(i, true), -tuck(i, true)],
      [[ua, 0.7], [ub, 0.7], [ub, 0.7], [ua, 0.7]], mat);
  }
  // Windscreen and backlight: the two raked ends, glazed, with the rake taken
  // from the cabin's own plan so they always meet the sides.
  for (const [i, dir] of [[0, -1], [segs, 1]] as const) {
    const w0 = tuck(i, false), w1 = tuck(i, true);
    const y0 = yOf(i, false), y1 = yOf(i, true);
    const x = xs[i];
    const A: Vec3 = [x, y0, w0], B: Vec3 = [x, y0, -w0];
    const C: Vec3 = [x, y1, -w1], D: Vec3 = [x, y1, w1];
    // Wound to face out of the car. Both were inside-out, which is why the
    // screen and the backlight vanished from the angles you actually see them
    // from and left the cabin looking open at each end.
    if (dir < 0) m.quadUV(D, C, B, A, [[0, 1], [0, 1], [0, 0], [0, 0]], MAT.CAR_GLASS);
    else m.quadUV(A, B, C, D, [[1, 0], [1, 0], [1, 1], [1, 1]], MAT.CAR_GLASS);
  }
}

/**
 * Arches the body's lower edge up over each wheel.
 *
 * A loft cannot cut a hole, so the wheels were buried: the sill ran straight
 * from nose to tail at 30cm and a 34cm wheel sat almost entirely inside it,
 * leaving a two-centimetre sliver of tyre showing under the door. Raising the
 * section's bottom point at the wheel stations arches the sill over the wheel
 * instead, which is what a wheel arch is.
 */
function withArches(st: Station[], centres: number[], r: number): Station[] {
  const out: Station[] = [];
  const lift = (sec: Section, amount: number): Section => sec.map((p, j) => {
    const rise = j === 0 ? amount : j === 1 ? amount * 0.45 : j === 2 ? amount * 0.08 : 0;
    return [p[0] + rise, p[1]] as [number, number];
  });

  const sample = (x: number): Section => {
    let i = 0;
    while (i < st.length - 2 && st[i + 1].x < x) i++;
    const a = st[i], b = st[i + 1];
    const t = Math.max(0, Math.min(1, (x - a.x) / ((b.x - a.x) || 1)));
    return a.s.map((p, j) =>
      [p[0] + (b.s[j][0] - p[0]) * t, p[1] + (b.s[j][1] - p[1]) * t] as [number, number]);
  };

  // Every original station, plus five round each arch: the rise, the crown and
  // the fall. Five is enough for the curve to read and cheap enough to repeat.
  const extra: Array<{ x: number; s: Section }> = [];
  for (const cx of centres) {
    // Seven stations round each arch, and a crown that clears the axle. The
    // old opening lifted the sill by 0.62r, which stops below the hub -- so
    // the wheel was three-quarters buried and the car read as riding on its
    // sills. A real arch opening clears the hub.
    for (let k = -3; k <= 3; k++) {
      const x = cx + k * r * 0.42;
      if (x <= st[0].x || x >= st[st.length - 1].x) continue;
      const f = Math.cos((Math.abs(k) / 3.6) * Math.PI * 0.5);
      extra.push({ x, s: lift(sample(x), r * 0.72 * f) });
    }
  }
  for (const s0 of st) out.push(s0);
  for (const e of extra) out.push(e);
  out.sort((a, b) => a.x - b.x);
  return out;
}

/** Half-width of a lofted body at a length and a height, by interpolation. */
function hwAt(st: Station[], x: number, y: number): number {
  let i = 0;
  while (i < st.length - 2 && st[i + 1].x < x) i++;
  const a = st[i], b = st[i + 1];
  const t = Math.max(0, Math.min(1, (x - a.x) / ((b.x - a.x) || 1)));
  const sec: Section = a.s.map((p, j) =>
    [p[0] + (b.s[j][0] - p[0]) * t, p[1] + (b.s[j][1] - p[1]) * t] as [number, number]);
  // Walk the section to the requested height and interpolate the width there.
  if (y <= sec[0][0]) return sec[0][1];
  for (let j = 0; j < sec.length - 1; j++) {
    if (y <= sec[j + 1][0]) {
      const f = (y - sec[j][0]) / ((sec[j + 1][0] - sec[j][0]) || 1);
      return sec[j][1] + (sec[j + 1][1] - sec[j][1]) * f;
    }
  }
  return sec[sec.length - 1][1];
}

/** Roof height of a lofted body at a length. */
function topAt(st: Station[], x: number): number {
  let i = 0;
  while (i < st.length - 2 && st[i + 1].x < x) i++;
  const a = st[i], b = st[i + 1];
  const t = Math.max(0, Math.min(1, (x - a.x) / ((b.x - a.x) || 1)));
  const ay = a.s[a.s.length - 1][0], by = b.s[b.s.length - 1][0];
  return ay + (by - ay) * t;
}

/** Scales a section's widths and shifts its heights: one profile, many bodies. */
function shape(s: Section, wScale: number, yTop: number): Section {
  const top = s[s.length - 1][0];
  const bot = s[0][0];
  return s.map(([y, w]) => [bot + ((y - bot) / (top - bot)) * (yTop - bot), w * wScale] as [number, number]);
}

// ------------------------------------------------------------------- wheels

/** The height of the body's deck -- the belt line -- at a point along it. */
function deckAt(st: Station[], x: number): number {
  let i = 0;
  while (i < st.length - 2 && st[i + 1].x < x) i++;
  const a = st[i], b = st[i + 1];
  const t = Math.min(1, Math.max(0, (x - a.x) / ((b.x - a.x) || 1)));
  const j = beltIndex(a.s);
  return a.s[j][0] + (b.s[j][0] - a.s[j][0]) * t;
}

/**
 * Where an axle's wheel sits across the car.
 *
 * Measured from the body at the wheel's own height rather than typed in. Every
 * wheel in the fleet was set a little inside the body's widest point, which
 * buried all four of them -- a 16cm-wide wheel at z = 0.82 inside a body 1.04
 * wide is entirely under the wing, and the fleet looked as though it were
 * riding on its sills.
 */
function axleZ(st: Station[], cx: number, y: number, halfW: number): number {
  return Math.max(0.3, hwAt(st, cx, y) - halfW * 0.12);
}

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
/** The dark shadow of an arch, so a wheel does not float in a flat flank. */
function arch(m: MeshBuilder, cx: number, cy: number, r: number, halfW: number): void {
  // The liner: a dark half-tube inside the opening, set in from the flank, so
  // an arch is a recess with something in it rather than a hole through the
  // car. It used to span the full body width at the tyre's own radius, which
  // drew a dark band arching over the wing like a wire hoop.
  m.painted(TINT.METAL_DARK, () => {
    const w = halfW * 0.90;
    for (let i = 0; i < 9; i++) {
      const a0 = Math.PI * (i / 9), a1 = Math.PI * ((i + 1) / 9);
      const q = (a: number, ww: number): Vec3 =>
        [cx + Math.cos(a) * r, cy + Math.sin(a) * r, ww];
      m.quad(q(a1, w), q(a0, w), q(a0, -w), q(a1, -w), MAT.TRIM);
    }
  });
}
/** A raised lip around a wheel arch, so the arch has an edge and not a hole. */
function archLip(m: MeshBuilder, st: Station[], key: number, cx: number, cy: number,
  r: number): void {
  // A flared wing over the wheel: the lip stands proud of the flank and rolls
  // back under. That roll is what puts a shadow on the top of the tyre, and it
  // is most of why a car looks planted rather than tucked in.
  const flare = 0.075;
  for (let i = 0; i < 10; i++) {
    const a0 = Math.PI * (i / 10), a1 = Math.PI * ((i + 1) / 10);
    const hw = hwAt(st, cx, cy + r * 0.7) - 0.01;
    for (const sz of [1, -1] as const) {
      const w0 = sz * hw, w1 = sz * (hw + flare);
      const p = (a: number, rr: number, w: number): Vec3 =>
        [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, w];
      m.keyed(key, () => {
        if (sz > 0) {
          m.quad(p(a0, r, w1), p(a1, r, w1), p(a1, r + 0.09, w1), p(a0, r + 0.09, w1), MAT.PAINT);
          m.quad(p(a0, r + 0.09, w1), p(a1, r + 0.09, w1), p(a1, r + 0.09, w0), p(a0, r + 0.09, w0), MAT.PAINT);
          m.quad(p(a1, r, w0), p(a0, r, w0), p(a0, r, w1), p(a1, r, w1), MAT.PAINT);
        } else {
          m.quad(p(a1, r, w1), p(a0, r, w1), p(a0, r + 0.09, w1), p(a1, r + 0.09, w1), MAT.PAINT);
          m.quad(p(a1, r + 0.09, w1), p(a0, r + 0.09, w1), p(a0, r + 0.09, w0), p(a1, r + 0.09, w0), MAT.PAINT);
          m.quad(p(a0, r, w0), p(a1, r, w0), p(a1, r, w1), p(a0, r, w1), MAT.PAINT);
        }
      });
    }
  }
}
/**
 * A bumper: three boxes stepped in plan so the ends wrap round the corner.
 *
 * A single slab across the nose is the thing that made the first fleet read as
 * a sculpture -- real bumpers turn the corner, and that corner is most of what
 * you see of a car from three-quarters on.
 */
function bumper(m: MeshBuilder, st: Station[], key: number, x: number, dir: 1 | -1,
  y0: number, y1: number): void {
  // Width taken from the body at the bumper's own height, and the wings set
  // one centimetre inside it. Given a fixed width the corners either hung in
  // the air or vanished into the wing, depending on the car.
  const hw = hwAt(st, x - dir * 0.12, (y0 + y1) / 2) - 0.01;
  // Body-coloured, with only a dark valance under it. Painted dark all over,
  // a bumper reads at any distance as a black slab bolted to the boot, which
  // is exactly what it looked like.
  const a = Math.min(x, x + dir * 0.12), b = Math.max(x, x + dir * 0.12);
  m.keyed(key, () => {
    m.box([a, y0 + 0.10, -hw * 0.8], [b, y1, hw * 0.8], MAT.PAINT, { skipBottom: false });
    for (const sz of [1, -1] as const) {
      const c = Math.min(x, x - dir * 0.18), d = Math.max(x, x - dir * 0.18);
      m.box([c, y0 + 0.12, Math.min(sz * hw, sz * hw * 0.78)],
            [d, y1 - 0.02, Math.max(sz * hw, sz * hw * 0.78)], MAT.PAINT, { skipBottom: false });
    }
  });
  m.painted(TINT.METAL_DARK, () =>
    m.box([a, y0, -hw * 0.76], [b, y0 + 0.11, hw * 0.76], MAT.TRIM, { skipBottom: false }));
}

/** Grille bars in a recess, with a badge in the middle. */
function grille(m: MeshBuilder, st: Station[], x: number, dir: 1 | -1,
  y0: number, y1: number, bars = 4): void {
  // Recessed into the nose, not stuck onto it: the panel sits a little inside
  // the body and the bars sit inside that again.
  const hw = hwAt(st, x - dir * 0.05, (y0 + y1) / 2) * 0.62;
  m.painted(TINT.METAL_DARK, () => {
    const a = Math.min(x + dir * 0.02, x - dir * 0.1), b = Math.max(x + dir * 0.02, x - dir * 0.1);
    m.box([a, y0, -hw], [b, y1, hw], MAT.TRIM, { skipBottom: false });
    for (let i = 0; i < bars; i++) {
      const y = y0 + ((i + 0.5) / bars) * (y1 - y0);
      const c = Math.min(x + dir * 0.03, x - dir * 0.04);
      const d = Math.max(x + dir * 0.03, x - dir * 0.04);
      m.box([c, y - 0.03, -hw * 0.94], [d, y + 0.03, hw * 0.94], MAT.TRIM, { skipBottom: false });
    }
  });
  const c = Math.min(x + dir * 0.04, x - dir * 0.02);
  const d = Math.max(x + dir * 0.04, x - dir * 0.02);
  m.box([c, (y0 + y1) / 2 - 0.10, -0.12], [d, (y0 + y1) / 2 + 0.10, 0.12], MAT.METAL,
    { skipBottom: false });
}

/** Wipers parked at the base of a screen. */
function wipers(m: MeshBuilder, x: number, y: number, hw: number): void {
  m.painted(TINT.METAL_DARK, () => {
    for (const sz of [-1, 1] as const) {
      m.box([x - 0.42, y, sz * hw * 0.45 - 0.03], [x + 0.18, y + 0.045, sz * hw * 0.45 + 0.03],
        MAT.TRIM, { skipBottom: false });
    }
  });
}

/**
 * A lamp: an emissive lens in a dark bezel, sunk into the bodywork.
 *
 * The lens carries its own coordinates so the shader can band it the way a
 * modern light is banded, and it is emissive -- it takes no shading at all.
 * Painted lenses left every car in the library with a grey oval at each end,
 * which is the fastest way to make a vehicle read as a toy.
 */
function lamp(m: MeshBuilder, x: number, y: number, z: number, w: number, h: number,
  dir: 1 | -1, tint: number): void {
  m.painted(TINT.METAL_DARK, () =>
    m.box([Math.min(x - dir * 0.16, x + dir * 0.005), y - h / 2 - 0.03, z - w / 2 - 0.03],
          [Math.max(x - dir * 0.16, x + dir * 0.005), y + h / 2 + 0.03, z + w / 2 + 0.03],
      MAT.TRIM, { skipBottom: false }));
  const p = x + dir * 0.02;
  const a: Vec3 = [p, y - h / 2, z - w / 2], b: Vec3 = [p, y - h / 2, z + w / 2];
  const c: Vec3 = [p, y + h / 2, z + w / 2], d: Vec3 = [p, y + h / 2, z - w / 2];
  const uv: Array<[number, number]> = [[0, 0], [1, 0], [1, 1], [0, 1]];
  m.painted(tint as never, () => {
    if (dir > 0) m.quadUV(b, a, d, c, [uv[1], uv[0], uv[3], uv[2]], MAT.LAMP);
    else m.quadUV(a, b, c, d, uv, MAT.LAMP);
    m.box([Math.min(p, p - dir * 0.05), y - h / 2, z - w / 2],
          [Math.max(p, p - dir * 0.05), y + h / 2, z + w / 2], MAT.TRIM, { skipBottom: false });
  });
}
/**
 * Door handles, sitting on the body's actual surface.
 *
 * The shut lines that used to come with these are drawn by the shader now.
 * As geometry they were a strip at a fixed half-width, which stands proud
 * where the body narrows and sinks in where it swells -- and a car is nothing
 * but places where the body narrows and swells.
 */
function handles(m: MeshBuilder, st: Station[], cuts: number[], y: number): void {
  for (const cut of cuts) {
    const x = cut + 0.18;
    const hw = hwAt(st, x, y);
    for (const sz of [1, -1] as const) {
      m.box([x, y, Math.min(sz * hw, sz * (hw + 0.035))],
            [x + 0.20, y + 0.05, Math.max(sz * hw, sz * (hw + 0.035))], MAT.METAL,
        { skipBottom: false });
    }
  }
}

/** Wing mirrors on stalks, off the body at the height they are given. */
function mirrors(m: MeshBuilder, st: Station[], key: number, x: number, y: number): void {
  const hw = hwAt(st, x, y);
  for (const sz of [1, -1] as const) {
    m.painted(TINT.METAL_DARK, () =>
      m.box([x - 0.03, y - 0.03, Math.min(sz * hw, sz * (hw + 0.1))],
            [x + 0.03, y + 0.03, Math.max(sz * hw, sz * (hw + 0.1))], MAT.TRIM,
        { skipBottom: false }));
    m.keyed(key, () =>
      m.box([x - 0.1, y - 0.06, Math.min(sz * (hw + 0.08), sz * (hw + 0.22))],
            [x + 0.1, y + 0.13, Math.max(sz * (hw + 0.08), sz * (hw + 0.22))], MAT.PAINT,
        { skipBottom: false }));
  }
}

/** Number plate. */
function plate(m: MeshBuilder, key: number, x: number, y: number, dir: 1 | -1): void {
  // A recessed backing plate, then the face itself in a material that draws
  // its own registration from the key. Seven characters, different on every
  // car, and none of it modelled.
  m.painted(TINT.METAL_DARK, () =>
    m.box([Math.min(x - dir * 0.05, x), y - 0.10, -0.27],
          [Math.max(x - dir * 0.05, x), y + 0.10, 0.27], MAT.TRIM, { skipBottom: false }));
  const p = x + dir * 0.012;
  m.keyed(key, () => {
    if (dir > 0) {
      m.quadUV([p, y - 0.085, 0.25], [p, y - 0.085, -0.25], [p, y + 0.085, -0.25],
        [p, y + 0.085, 0.25], [[0, 0], [1, 0], [1, 1], [0, 1]], MAT.PLATE);
    } else {
      m.quadUV([p, y - 0.085, -0.25], [p, y - 0.085, 0.25], [p, y + 0.085, 0.25],
        [p, y + 0.085, -0.25], [[0, 0], [1, 0], [1, 1], [0, 1]], MAT.PLATE);
    }
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
 * One person, standing or walking, facing along +x.
 *
 * Built as a jointed figure rather than a stack of separate boxes: hips join
 * the legs to the torso, shoulders join the arms, and the neck joins the head.
 * The first version left visible gaps at all three, which is what makes a
 * figure read as a pile of blocks rather than as a person.
 *
 * `key` drives both the clothing colours and the build. Everything that varies
 * between people -- height, shoulder width, leg length, hair, whether they are
 * in a long coat -- comes out of it, so a crowd is a crowd and not one model
 * repeated in different colours.
 */
function person(m: MeshBuilder, key: number, cx: number, cz: number, facing: number,
  opts: { stride?: number; bag?: boolean; hat?: boolean; scale?: number; lift?: number } = {}): void {
  // Deterministic per-person variation.
  const rnd = (n: number): number => {
    const v = Math.sin(key * 12.9898 + n * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  const s = (opts.scale ?? 1.0) * (0.94 + rnd(1) * 0.13);
  const lift = opts.lift ?? 0;
  const stride = opts.stride ?? 0;
  const broad = 0.9 + rnd(2) * 0.35;          // shoulder and chest width
  const legLen = 0.80 + rnd(3) * 0.10;        // where the hips sit
  const coat = rnd(4) > 0.62;                 // long coat rather than a jacket
  const hair = rnd(5);                        // style: cropped, swept, long, none
  const co = Math.cos(facing), si = Math.sin(facing);

  const at = (fx: number, fy: number, fz: number): Vec3 =>
    [cx + (fx * co - fz * si) * s, lift + fy * s, cz + (fx * si + fz * co) * s];
  const put = (f0: [number, number, number], f1: [number, number, number], mat: Material): void => {
    const a = at(f0[0], f0[1], f0[2]);
    const b = at(f1[0], f1[1], f1[2]);
    m.box([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
          [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])], mat,
      { skipBottom: false });
  };

  const hip = legLen;
  const chest = hip + 0.30;
  const shoulder = hip + 0.52;
  const neck = shoulder + 0.04;
  const crown = neck + 0.26;

  // Legs, thighs tapering to calves, with the stride swinging them fore and aft.
  m.keyed(key * 5 + 1, () => {
    for (const [sz, sgn] of [[1, 1], [-1, -1]] as const) {
      const off = stride * sgn;
      const w = 0.075 * broad;
      put([-w + off * 0.4, hip * 0.48, sz * 0.10 - w], [w + off * 0.4, hip, sz * 0.10 + w], MAT.FIGURE);
      put([-w * 0.9 + off, 0.075, sz * 0.10 - w * 0.9], [w * 0.9 + off, hip * 0.5, sz * 0.10 + w * 0.9],
        MAT.FIGURE);
    }
    // Hips: the block the legs run into. Without it they hang off the torso.
    put([-0.1 * broad, hip - 0.04, -0.17 * broad], [0.1 * broad, hip + 0.14, 0.17 * broad], MAT.FIGURE);
  });
  // Shoes.
  m.painted(TINT.METAL_DARK, () => {
    for (const [sz, sgn] of [[1, 1], [-1, -1]] as const) {
      const off = stride * sgn;
      put([-0.085 + off * 1.25, 0, sz * 0.10 - 0.06], [0.115 + off * 1.25, 0.078, sz * 0.10 + 0.06],
        MAT.TRIM);
    }
  });

  // Torso: waist, chest and shoulders, each wider than the last, plus a coat
  // that hangs below the hips on about a third of people.
  m.keyed(key * 5 + 2, () => {
    put([-0.085, hip + 0.06, -0.15 * broad], [0.085, chest, 0.15 * broad], MAT.FIGURE);
    put([-0.1, chest - 0.02, -0.185 * broad], [0.1, shoulder, 0.185 * broad], MAT.FIGURE);
    put([-0.105, shoulder - 0.1, -0.215 * broad], [0.105, shoulder + 0.03, 0.215 * broad], MAT.FIGURE);
    if (coat) put([-0.105, hip - 0.22, -0.17 * broad], [0.105, hip + 0.1, 0.17 * broad], MAT.FIGURE);
    // Arms: upper arm from the shoulder, forearm angled in, then a hand.
    for (const [sz, sgn] of [[1, -1], [-1, 1]] as const) {
      const off = stride * sgn * 0.75;
      const az = sz * (0.185 * broad + 0.06);
      put([-0.05 + off * 0.4, chest + 0.06, az - 0.05], [0.05 + off * 0.4, shoulder + 0.02, az + 0.05],
        MAT.FIGURE);
      put([-0.045 + off, hip + 0.14, az - 0.045 * sz - 0.045],
          [0.045 + off, chest + 0.08, az - 0.045 * sz + 0.045], MAT.FIGURE);
    }
  });
  m.keyed(key * 5 + 3, () => {
    for (const [sz, sgn] of [[1, -1], [-1, 1]] as const) {
      const off = stride * sgn * 0.75;
      const az = sz * (0.185 * broad + 0.015);
      put([-0.045 + off, hip + 0.02, az - 0.045], [0.045 + off, hip + 0.15, az + 0.045], MAT.FIGURE);
    }
  });

  // Head: neck, skull, a brow and nose that give it a front, and ears.
  m.keyed(key * 5 + 3, () => {
    put([-0.045, shoulder, -0.05], [0.045, neck + 0.03, 0.05], MAT.FIGURE);
    put([-0.078, neck, -0.088], [0.072, crown, 0.088], MAT.FIGURE);
    // Brow ridge and nose: two small boxes, and the whole reason a head reads
    // as facing somewhere rather than as a cube on a stick.
    put([0.072, neck + 0.13, -0.075], [0.098, neck + 0.17, 0.075], MAT.FIGURE);
    put([0.078, neck + 0.06, -0.022], [0.112, neck + 0.14, 0.022], MAT.FIGURE);
    for (const sz of [1, -1] as const) {
      put([-0.02, neck + 0.09, sz * 0.088], [0.02, neck + 0.16, sz * 0.108], MAT.FIGURE);
    }
  });
  // Eyes, dark, set under the brow.
  m.painted(TINT.METAL_DARK, () => {
    for (const sz of [1, -1] as const) {
      put([0.078, neck + 0.10, sz * 0.028 - 0.018], [0.092, neck + 0.13, sz * 0.028 + 0.018],
        MAT.TRIM);
    }
  });
  // Hair, in its own key so it is not the same colour as the face.
  if (hair > 0.12) {
    m.keyed(key * 5 + 4, () => {
      put([-0.085, crown - 0.055, -0.095], [0.075, crown + 0.025, 0.095], MAT.FIGURE);
      if (hair > 0.45) {
        // Swept back and down the sides.
        put([-0.09, neck + 0.10, -0.098], [-0.06, crown, 0.098], MAT.FIGURE);
      }
      if (hair > 0.75) {
        // Long, to the shoulders.
        put([-0.095, shoulder + 0.02, -0.1], [-0.055, crown, 0.1], MAT.FIGURE);
      }
    });
  }
  if (opts.hat) {
    m.painted(TINT.METAL_DARK, () => {
      put([-0.1, crown + 0.01, -0.115], [0.135, crown + 0.05, 0.115], MAT.TRIM);
      put([-0.085, crown + 0.03, -0.095], [0.075, crown + 0.14, 0.095], MAT.TRIM);
    });
  }
  if (opts.bag) {
    m.keyed(key * 5 + 7, () => {
      put([-0.075, hip + 0.02, 0.2 * broad], [0.09, chest + 0.12, 0.2 * broad + 0.12], MAT.FIGURE);
      // Strap over the shoulder.
      put([-0.02, chest + 0.1, 0.17 * broad], [0.02, shoulder + 0.02, 0.2 * broad + 0.06], MAT.FIGURE);
    });
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

  // The station table, kept so every fitting can sample the body it is
  // going on rather than guess a width and hang off it.
  const plan: Station[] = [
    { x: -2.02, s: shape(CAR, 0.80, 0.98) },
    { x: -1.80, s: shape(CAR, 0.94, 1.06) },
    { x: -1.20, s: shape(CAR, 1.00, 1.18) },
    { x: -0.55, s: shape(CAR, 1.02, 1.46) },
    { x: 0.30, s: shape(CAR, 1.02, 1.50) },
    { x: 1.05, s: shape(CAR, 1.00, 1.50) },
    { x: 1.62, s: shape(CAR, 0.96, 1.44) },
    { x: 1.92, s: shape(CAR, 0.86, 1.22) },
    { x: 2.05, s: shape(CAR, 0.74, 1.06) },
  ];
  // Sill arched over the wheels, so the tyres are seen and not buried.
  const st = withArches(plan, [-1.28, 1.32], 0.33);
  m.keyed(1, () => { loft(m, st, MAT.PAINT, { upTo: beltIndex(st[0].s) });
    cabin(m, st, MAT.PAINT, { from: 0.26, to: 0.9, pillars: [0.55, 0.78] }); });


  if (medium) {
    for (const cx of [-1.28, 1.32]) {
      arch(m, cx, 0.44, 0.46, 0.80);
      archLip(m, st, 1, cx, 0.44, 0.47);
      for (const sz of [1, -1] as const) wheel(m, cx, 0.34, sz * axleZ(st, cx, 0.34, 0.12), 0.33, 0.12);
    }
    // Windscreen and backlight are raked; the side glass sits in the waist.
  }
  if (fine) {
    bumper(m, st, 1, -1.98, -1, 0.42, 0.76);
    bumper(m, st, 1, 2.0, 1, 0.42, 0.78);
    grille(m, st, -2.0, -1, 0.72, 1.02, 3);
    wipers(m, -0.58, 1.02, 0.82);
    handles(m, st, [-0.52, 0.62], 1.02);
    mirrors(m, st, 1, -0.52, 1.16);
    for (const sz of [1, -1] as const) {
      lamp(m, -2.0, 0.88, sz * 0.56, 0.34, 0.22, -1, TINT.SIGN_LIT);
      lamp(m, 2.04, 0.98, sz * 0.58, 0.30, 0.30, 1, TINT.BRAND);
    }
    plate(m, 1, -2.02, 0.62, -1);
    plate(m, 1, 2.04, 0.66, 1);
    // Roof rails, sitting on the roof line rather than at a guessed height.
    m.painted(TINT.METAL_DARK, () => {
      for (const sz of [1, -1] as const) {
        for (let i = 0; i < 6; i++) {
          const a = -0.1 + i * 0.24, b = a + 0.24;
          const y = Math.min(topAt(st, a), topAt(st, b));
          m.box([a, y - 0.02, sz * 0.44 - 0.04], [b, y + 0.05, sz * 0.44 + 0.04], MAT.TRIM);
        }
      }
      m.box([1.7, 0.28, 0.34], [2.06, 0.4, 0.5], MAT.TRIM);
    });
    person(m, 21, 2.9, 1.1, Math.PI, { stride: 0.1 });
    person(m, 27, 2.6, -1.2, 0.3, { bag: true });
  }
  return m;
}

function saloon(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  tarmac(m, 3.3, 1.9);

  // The station table, kept so every fitting can sample the body it is
  // going on rather than guess a width and hang off it.
  const plan: Station[] = [
    { x: -2.35, s: shape(CAR, 0.80, 0.96) },
    { x: -2.10, s: shape(CAR, 0.95, 1.04) },
    { x: -1.45, s: shape(CAR, 1.02, 1.14) },
    { x: -0.75, s: shape(CAR, 1.05, 1.44) },
    { x: 0.10, s: shape(CAR, 1.05, 1.48) },
    { x: 0.95, s: shape(CAR, 1.03, 1.46) },
    { x: 1.50, s: shape(CAR, 1.00, 1.22) },
    { x: 2.15, s: shape(CAR, 0.94, 1.14) },
    { x: 2.38, s: shape(CAR, 0.80, 1.02) },
  ];
  // Sill arched over the wheels, so the tyres are seen and not buried.
  const st = withArches(plan, [-1.52, 1.58], 0.34);
  m.keyed(2, () => { loft(m, st, MAT.PAINT, { upTo: beltIndex(st[0].s) });
    cabin(m, st, MAT.PAINT, { from: 0.28, to: 0.82, pillars: [0.52, 0.72] }); });


  if (medium) {
    for (const cx of [-1.52, 1.58]) {
      arch(m, cx, 0.46, 0.48, 0.84);
      archLip(m, st, 2, cx, 0.46, 0.49);
      for (const sz of [1, -1] as const) wheel(m, cx, 0.35, sz * axleZ(st, cx, 0.35, 0.13), 0.34, 0.13);
    }
  }
  if (fine) {
    bumper(m, st, 2, -2.30, -1, 0.42, 0.78);
    bumper(m, st, 2, 2.34, 1, 0.42, 0.80);
    grille(m, st, -2.32, -1, 0.80, 1.08, 4);
    wipers(m, -0.82, 1.02, 0.86);
    handles(m, st, [-0.76, 0.42], 1.02);
    mirrors(m, st, 2, -0.78, 1.16);
    for (const sz of [1, -1] as const) {
      lamp(m, -2.33, 0.92, sz * 0.6, 0.36, 0.2, -1, TINT.SIGN_LIT);
      lamp(m, 2.37, 0.96, sz * 0.62, 0.34, 0.24, 1, TINT.BRAND);
    }
    plate(m, 2, -2.35, 0.64, -1);
    plate(m, 2, 2.37, 0.68, 1);
    m.painted(TINT.METAL_DARK, () => {
      m.box([2.0, 0.28, 0.36], [2.4, 0.4, 0.54], MAT.TRIM);
      m.box([2.0, 0.28, -0.54], [2.4, 0.4, -0.36], MAT.TRIM);
    });
    person(m, 33, 3.2, -1.2, 0, { stride: 0.12, bag: true });
    person(m, 39, 3.0, 1.3, Math.PI * 0.8, { hat: true });
  }
  return m;
}

function estate(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  tarmac(m, 3.3, 1.9);

  // The station table, kept so every fitting can sample the body it is
  // going on rather than guess a width and hang off it.
  const plan: Station[] = [
    { x: -2.35, s: shape(CAR, 0.80, 0.96) },
    { x: -2.10, s: shape(CAR, 0.95, 1.04) },
    { x: -1.45, s: shape(CAR, 1.02, 1.14) },
    { x: -0.75, s: shape(CAR, 1.05, 1.46) },
    { x: 0.20, s: shape(CAR, 1.05, 1.52) },
    { x: 1.30, s: shape(CAR, 1.04, 1.52) },
    { x: 2.05, s: shape(CAR, 1.02, 1.50) },
    { x: 2.36, s: shape(CAR, 0.92, 1.34) },
  ];
  // Sill arched over the wheels, so the tyres are seen and not buried.
  const st = withArches(plan, [-1.52, 1.58], 0.34);
  m.keyed(3, () => { loft(m, st, MAT.PAINT, { upTo: beltIndex(st[0].s) });
    cabin(m, st, MAT.PAINT, { from: 0.28, to: 0.94, pillars: [0.5, 0.74] }); });


  if (medium) {
    for (const cx of [-1.52, 1.58]) {
      arch(m, cx, 0.46, 0.48, 0.86);
      archLip(m, st, 3, cx, 0.46, 0.49);
      for (const sz of [1, -1] as const) wheel(m, cx, 0.35, sz * axleZ(st, cx, 0.35, 0.13), 0.34, 0.13);
    }
  }
  if (fine) {
    bumper(m, st, 3, -2.30, -1, 0.42, 0.78);
    bumper(m, st, 3, 2.34, 1, 0.42, 0.82);
    grille(m, st, -2.32, -1, 0.80, 1.08, 4);
    wipers(m, -0.82, 1.02, 0.88);
    m.painted(TINT.METAL_DARK, () => {
      // Roof bars with cross rails, and a towbar: what an estate is for.
      for (const sz of [1, -1] as const) {
        m.box([-0.3, 1.52, sz * 0.5 - 0.05], [2.0, 1.60, sz * 0.5 + 0.05], MAT.TRIM);
      }
      for (const cx of [0.1, 1.6]) m.box([cx, 1.58, -0.55], [cx + 0.09, 1.63, 0.55], MAT.TRIM);
      m.box([2.36, 0.24, -0.08], [2.62, 0.34, 0.08], MAT.TRIM);
      m.cylinder(2.6, 0, 0.09, 0.32, 0.46, 8, MAT.TRIM);
    });
    handles(m, st, [-0.76, 0.42, 1.66], 1.04);
    mirrors(m, st, 3, -0.78, 1.16);
    for (const sz of [1, -1] as const) {
      lamp(m, -2.33, 0.92, sz * 0.6, 0.36, 0.2, -1, TINT.SIGN_LIT);
      lamp(m, 2.37, 1.06, sz * 0.66, 0.24, 0.46, 1, TINT.BRAND);
    }
    plate(m, 3, -2.35, 0.64, -1);
    plate(m, 3, 2.37, 0.62, 1);
    person(m, 44, 3.15, 1.2, Math.PI * 0.9, { stride: 0.05, hat: true });
    person(m, 49, 3.0, -1.3, 0.4, { scale: 0.7, stride: 0.14 });
  }
  return m;
}

function suv(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  tarmac(m, 3.3, 2.1);
  const S: Section = [[0.50, 0.80], [0.86, 1.00], [1.28, 1.02], [1.60, 0.94], [1.82, 0.72]];

  // The station table, kept so every fitting can sample the body it is
  // going on rather than guess a width and hang off it.
  const plan: Station[] = [
    { x: -2.30, s: shape(S, 0.86, 1.30) },
    { x: -2.05, s: shape(S, 0.97, 1.40) },
    { x: -1.35, s: shape(S, 1.02, 1.52) },
    { x: -0.70, s: shape(S, 1.04, 1.88) },
    { x: 0.40, s: shape(S, 1.04, 1.94) },
    { x: 1.45, s: shape(S, 1.03, 1.94) },
    { x: 2.10, s: shape(S, 1.00, 1.90) },
    { x: 2.34, s: shape(S, 0.90, 1.72) },
  ];
  // Sill arched over the wheels, so the tyres are seen and not buried.
  const st = withArches(plan, [-1.50, 1.55], 0.46);
  m.keyed(4, () => { loft(m, st, MAT.PAINT, { upTo: beltIndex(st[0].s) });
    cabin(m, st, MAT.PAINT, { from: 0.26, to: 0.92, pillars: [0.5, 0.74] }); });


  if (medium) {
    for (const cx of [-1.50, 1.55]) {
      arch(m, cx, 0.62, 0.60, 0.90);
      archLip(m, st, 4, cx, 0.62, 0.61);
      for (const sz of [1, -1] as const) wheel(m, cx, 0.47, sz * axleZ(st, cx, 0.47, 0.16), 0.46, 0.16);
    }
    // Cladding round the arches and along the sills: an SUV's whole idiom.
    m.painted(TINT.METAL_DARK, () => {
      for (const sz of [1, -1] as const) {
        m.box([-1.95, 0.52, sz * 1.02 - 0.06], [2.2, 0.76, sz * 1.02 + 0.06], MAT.TRIM);
      }
    });
  }
  if (fine) {
    bumper(m, st, 4, -2.26, -1, 0.56, 1.00);
    bumper(m, st, 4, 2.28, 1, 0.56, 1.04);
    grille(m, st, -2.28, -1, 1.04, 1.42, 4);
    wipers(m, -0.78, 1.28, 0.98);
    m.painted(TINT.METAL_DARK, () => {
      // Roof rails and a spare on the tailgate.
      for (const sz of [1, -1] as const) {
        m.box([-0.4, 1.92, sz * 0.56 - 0.06], [2.0, 2.00, sz * 0.56 + 0.06], MAT.TRIM);
      }
    });
    wheel(m, 2.55, 1.20, 0.0, 0.42, 0.15, 12);
    handles(m, st, [-0.72, 0.60], 1.30);
    mirrors(m, st, 4, -0.74, 1.44);
    for (const sz of [1, -1] as const) {
      lamp(m, -2.30, 1.22, sz * 0.66, 0.4, 0.26, -1, TINT.SIGN_LIT);
      lamp(m, 2.36, 1.36, sz * 0.72, 0.26, 0.5, 1, TINT.BRAND);
    }
    plate(m, 4, -2.32, 0.82, -1);
    plate(m, 4, 2.38, 0.86, 1);
    person(m, 55, 3.1, -1.4, 0.4, { stride: 0.0 });
    person(m, 59, 2.9, 1.4, Math.PI * 1.1, { bag: true, stride: 0.11 });
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
  // The station table, kept so every fitting can sample the body it is
  // going on rather than guess a width and hang off it.
  const plan: Station[] = [
    { x: -2.40, s: shape(S, 0.86, 1.24) },
    { x: -2.15, s: shape(S, 0.98, 1.34) },
    { x: -1.40, s: shape(S, 1.02, 1.44) },
    { x: -0.75, s: shape(S, 1.03, 1.82) },
    { x: 0.15, s: shape(S, 1.03, 1.86) },
    { x: 0.55, s: shape(S, 1.02, 1.84) },
  ];
  // Sill arched over the wheels, so the tyres are seen and not buried.
  const st = withArches(plan, [-1.55, 1.75], 0.44);
  // The bed is a second volume: a pickup is a cab and a tray, and the gap
  // between them is most of what says so.
  const bed: Station[] = [
    { x: 0.58, s: shape(S, 1.03, 1.30) },
    { x: 2.55, s: shape(S, 1.03, 1.30) },
  ];
  m.keyed(5, () => {
    loft(m, st, MAT.PAINT, { upTo: beltIndex(st[0].s) });
    cabin(m, st, MAT.PAINT, { from: 0.24, to: 0.58, pillars: [0.42] });
    loft(m, bed, MAT.PAINT);
  });


  if (medium) {
    for (const cx of [-1.55, 1.75]) {
      arch(m, cx, 0.60, 0.58, 0.92);
      archLip(m, st, 5, cx, 0.60, 0.59);
      for (const sz of [1, -1] as const) wheel(m, cx, 0.45, sz * axleZ(st, cx, 0.45, 0.16), 0.44, 0.16);
    }
    // The bed itself: a floor with four walls, open at the top.
    m.painted(TINT.METAL_DARK, () =>
      m.box([0.62, 1.02, -0.78], [2.5, 1.12, 0.78], MAT.TRIM));
  }
  if (fine) {
    bumper(m, st, 5, -2.36, -1, 0.54, 0.98);
    bumper(m, st, 5, 2.58, 1, 0.5, 1.0);
    grille(m, st, -2.38, -1, 1.02, 1.44, 4);
    wipers(m, -0.9, 1.26, 0.98);
    m.painted(TINT.METAL_DARK, () => {
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
    handles(m, st, [-0.80], 1.26);
    mirrors(m, st, 5, -0.82, 1.42);
    for (const sz of [1, -1] as const) {
      lamp(m, -2.40, 1.20, sz * 0.68, 0.4, 0.26, -1, TINT.SIGN_LIT);
      lamp(m, 2.68, 1.20, sz * 0.66, 0.22, 0.4, 1, TINT.BRAND);
    }
    plate(m, 5, -2.42, 0.78, -1);
    // Load in the bed, so the tray is not an empty tank.
    m.painted(TINT.WOOD, () => {
      for (let i = 0; i < 3; i++) {
        m.box([0.9 + i * 0.5, 1.12, -0.6], [1.3 + i * 0.5, 1.5, 0.2], MAT.TRIM);
      }
    });
    person(m, 66, 3.3, 1.3, Math.PI, { stride: 0.14, hat: true });
    person(m, 69, 3.1, -1.4, 0.2, {});
  }
  return m;
}

function van(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  tarmac(m, 3.6, 2.1);

  // The station table, kept so every fitting can sample the body it is
  // going on rather than guess a width and hang off it.
  const plan: Station[] = [
    { x: -2.55, s: shape(BOX, 0.72, 1.30) },
    { x: -2.30, s: shape(BOX, 0.86, 1.52) },
    { x: -1.75, s: shape(BOX, 0.96, 1.86) },
    { x: -1.05, s: shape(BOX, 1.00, 2.42) },
    { x: -0.30, s: shape(BOX, 1.00, 2.56) },
    { x: 2.30, s: shape(BOX, 1.00, 2.58) },
    { x: 2.62, s: shape(BOX, 0.96, 2.52) },
  ];
  // Sill arched over the wheels, so the tyres are seen and not buried.
  const st = withArches(plan, [-1.70, 1.85], 0.39);
  m.keyed(6, () => { loft(m, st, MAT.PAINT, { upTo: beltIndex(st[0].s) });
    cabin(m, st, MAT.PAINT, { from: 0.06, to: 0.98, pillars: [0.24, 0.46] }); });


  if (medium) {
    for (const cx of [-1.70, 1.85]) {
      arch(m, cx, 0.52, 0.52, 0.98);
      archLip(m, st, 6, cx, 0.52, 0.53);
      for (const sz of [1, -1] as const) wheel(m, cx, 0.40, sz * axleZ(st, cx, 0.40, 0.15), 0.39, 0.15);
    }
    // Rear doors: two leaves with a shut line and windows in the top half.
    m.painted(TINT.METAL_DARK, () => m.box([2.6, 0.7, -0.02], [2.66, 2.5, 0.02], MAT.TRIM));
  }
  if (fine) {
    bumper(m, st, 6, -2.50, -1, 0.60, 1.12);
    bumper(m, st, 6, 2.58, 1, 0.58, 1.10);
    grille(m, st, -2.52, -1, 1.18, 1.62, 4);
    wipers(m, -1.20, 1.66, 1.06);
    m.painted(TINT.METAL_DARK, () => {
      // Body swage lines, following the flank rather than hovering off it.
      for (const sz of [1, -1] as const) {
        for (const y of [1.34, 1.62]) {
          for (let i = 0; i < 6; i++) {
            const a = -1.1 + i * 0.6, b = a + 0.6;
            const w = Math.min(hwAt(st, a, y), hwAt(st, b, y));
            m.box([a, y, Math.min(sz * w, sz * (w + 0.04))],
                  [b, y + 0.07, Math.max(sz * w, sz * (w + 0.04))], MAT.TRIM);
          }
        }
      }
      m.box([-1.0, 2.60, -1.0], [1.2, 2.72, 1.0], MAT.TRIM);
    });
    handles(m, st, [-0.32], 1.44);
    mirrors(m, st, 6, -1.18, 2.0);
    for (const sz of [1, -1] as const) {
      lamp(m, -2.55, 1.34, sz * 0.72, 0.44, 0.36, -1, TINT.SIGN_LIT);
      lamp(m, 2.66, 1.34, sz * 0.74, 0.26, 0.5, 1, TINT.BRAND);
    }
    plate(m, 6, -2.57, 0.86, -1);
    // A sign panel on the flank: a van is somebody's advertising.
    m.painted(TINT.BRAND, () => {
      for (const sz of [1, -1] as const) {
        for (let i = 0; i < 5; i++) {
          const a = -0.7 + i * 0.54, b = a + 0.54;
          const w = Math.min(hwAt(st, a, 2.0), hwAt(st, b, 2.0));
          m.box([a, 1.76, Math.min(sz * w, sz * (w + 0.03))],
                [b, 2.30, Math.max(sz * w, sz * (w + 0.03))], MAT.TRIM);
        }
      }
    });
    person(m, 77, 3.4, -1.4, 0.2, { stride: 0.12, bag: true });
    person(m, 79, 3.2, 1.5, Math.PI * 0.9, { hat: true, stride: 0.06 });
  }
  return m;
}

function cityBus(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  tarmac(m, 7.0, 2.2);
  const S: Section = [[0.42, 0.98], [0.74, 1.22], [2.30, 1.26], [3.00, 1.22], [3.18, 0.98]];

  // The station table, kept so every fitting can sample the body it is
  // going on rather than guess a width and hang off it.
  const st: Station[] = [
    { x: -6.10, s: shape(S, 0.92, 2.90) },
    { x: -5.85, s: shape(S, 0.99, 3.05) },
    { x: -5.30, s: shape(S, 1.00, 3.14) },
    { x: 5.30, s: shape(S, 1.00, 3.16) },
    { x: 5.85, s: shape(S, 0.99, 3.08) },
    { x: 6.10, s: shape(S, 0.92, 2.92) },
  ];
  m.keyed(7, () => { loft(m, st, MAT.PAINT, { upTo: beltIndex(st[0].s) });
    cabin(m, st, MAT.PAINT, { from: 0.02, to: 0.98, pillars: [0.18, 0.36, 0.54, 0.72, 0.88] }); });


  if (medium) {
    for (const cx of [-4.20, 3.60, 4.85]) {
      arch(m, cx, 0.56, 0.58, 1.10);
      archLip(m, st, 7, cx, 0.56, 0.59);
      for (const sz of [1, -1] as const) wheel(m, cx, 0.48, sz * axleZ(st, cx, 0.48, 0.17), 0.47, 0.17);
    }
    // Cab: a driver's seat, a wheel and a ticket console.
    // Saloon seating, in pairs down both sides. Four rows, not nine: at the
    // distance a bus is seen the rows read as a rhythm, not as a count.
    m.keyed(901, () => {
      for (let i = 0; i < 4; i++) {
        const px = -4.2 + i * 2.4;
        for (const sz of [1, -1] as const) {
          m.box([px, 1.44, sz * 0.72 - 0.42], [px + 0.44, 1.56, sz * 0.72 + 0.42], MAT.FIGURE,
            { skipBottom: false });
          m.box([px + 0.36, 1.56, sz * 0.72 - 0.42], [px + 0.5, 2.12, sz * 0.72 + 0.42], MAT.FIGURE,
            { skipBottom: false });
        }
      }
    });
    // The window band, which is what makes a bus a bus at any distance.
    // A bus's section has no belt point to glaze from, so its window band is
    // drawn explicitly: sill at 1.3, head at 2.5, pillars between the bays.
    for (const sz of [1, -1] as const) {
      for (let i = 0; i < 7; i++) {
        const x0 = -5.0 + i * 1.5;
        m.quad([x0 + 0.12, 1.32, sz * 1.255], [x0 + 1.38, 1.32, sz * 1.255],
               [x0 + 1.38, 2.48, sz * 1.255], [x0 + 0.12, 2.48, sz * 1.255], MAT.CAR_GLASS);
      }
      m.painted(TINT.METAL_DARK, () => {
        m.box([-5.1, 1.22, sz * 1.26 - 0.04], [5.6, 1.34, sz * 1.26 + 0.04], MAT.TRIM);
        m.box([-5.1, 2.46, sz * 1.26 - 0.04], [5.6, 2.58, sz * 1.26 + 0.04], MAT.TRIM);
      });
    }
  }
  if (fine) {
    m.painted(TINT.METAL_DARK, () => {
      // Pillars between the windows, and the skirt below them.
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
             [cx + 1.27, 2.56, 1.31], [cx + 0.03, 2.56, 1.31], MAT.CAR_GLASS);
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
    plate(m, 7, -6.12, 0.68, -1);
    mirrors(m, st, 7, -5.9, 2.5);
    bumper(m, st, 7, -6.05, -1, 0.68, 1.30);
    bumper(m, st, 7, 6.10, 1, 0.68, 1.30);
    wipers(m, -6.0, 1.36, 1.10);
    // Passengers on board, seen through the window band.
    person(m, 903, -3.2, 0.7, Math.PI / 2, { scale: 0.86, lift: 0.86 });
    person(m, 931, 1.4, 0.7, Math.PI / 2, { scale: 0.86, lift: 0.86, hat: true });
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

  // The station table, kept so every fitting can sample the body it is
  // going on rather than guess a width and hang off it.
  const plan: Station[] = [
    { x: -2.10, s: shape(S, 0.82, 1.00) },
    { x: -1.90, s: shape(S, 0.95, 1.08) },
    { x: -1.45, s: shape(S, 1.00, 1.18) },
    { x: -1.05, s: shape(S, 1.02, 1.72) },
    { x: 0.40, s: shape(S, 1.02, 1.86) },
    { x: 1.55, s: shape(S, 1.01, 1.84) },
    { x: 2.00, s: shape(S, 0.98, 1.60) },
    { x: 2.18, s: shape(S, 0.88, 1.30) },
  ];
  // Sill arched over the wheels, so the tyres are seen and not buried.
  const st = withArches(plan, [-1.35, 1.45], 0.35);
  m.keyed(8, () => { loft(m, st, MAT.PAINT, { upTo: beltIndex(st[0].s) });
    cabin(m, st, MAT.PAINT, { from: 0.26, to: 0.86, pillars: [0.5, 0.74] }); });


  if (medium) {
    for (const cx of [-1.35, 1.45]) {
      arch(m, cx, 0.46, 0.50, 0.86);
      archLip(m, st, 8, cx, 0.46, 0.51);
      for (const sz of [1, -1] as const) wheel(m, cx, 0.36, sz * axleZ(st, cx, 0.36, 0.13), 0.35, 0.13);
    }
    for (const sz of [1, -1] as const) {
      m.quad([-0.1, 1.22, sz * 0.905], [1.5, 1.22, sz * 0.905],
             [1.5, 1.74, sz * 0.905], [-0.1, 1.74, sz * 0.905], MAT.CAR_GLASS);
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
    });
    bumper(m, st, 8, -2.06, -1, 0.50, 0.88);
    bumper(m, st, 8, 2.12, 1, 0.50, 0.90);
    grille(m, st, -2.08, -1, 0.92, 1.22, 3);
    wipers(m, -1.14, 1.20, 0.90);
    handles(m, st, [-0.12, 1.02], 1.10);
    mirrors(m, st, 8, -1.1, 1.36);
    for (const sz of [1, -1] as const) {
      lamp(m, -2.10, 1.06, sz * 0.62, 0.34, 0.3, -1, TINT.SIGN_LIT);
      lamp(m, 2.20, 1.22, sz * 0.62, 0.24, 0.4, 1, TINT.BRAND);
    }
    plate(m, 8, -2.12, 0.72, -1);
    plate(m, 8, 2.22, 0.74, 1);
    person(m, 91, 2.9, 1.2, Math.PI * 0.75, { bag: true, stride: 0.06 });
    person(m, 92, 3.1, -1.1, 0.3, {});
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
  // The station table, kept so every fitting can sample the body it is
  // going on rather than guess a width and hang off it.
  const st: Station[] = [
    { x: -7.30, s: shape(CAB, 0.90, 2.90) },
    { x: -7.05, s: shape(CAB, 0.99, 3.10) },
    { x: -6.60, s: shape(CAB, 1.00, 3.30) },
    { x: -4.60, s: shape(CAB, 1.00, 3.34) },
    { x: -4.35, s: shape(CAB, 0.96, 3.20) },
  ];
  m.keyed(10, () => { loft(m, st, MAT.PAINT, { upTo: beltIndex(st[0].s) });
    cabin(m, st, MAT.PAINT, { from: 0.02, to: 0.3, pillars: [] }); });
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
      archLip(m, st, 10, cx, 0.62, 0.69);
      for (const sz of [1, -1] as const) {
        wheel(m, cx, 0.55, sz * axleZ(st, cx, 0.55, 0.16), 0.54, 0.16, 10);
        if (cx > 0 || cx < -5.5) wheel(m, cx, 0.55, sz * axleZ(st, cx, 0.55, 0.15), 0.54, 0.15, 10);
      }
    }
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
    mirrors(m, st, 10, -6.7, 2.6);
    for (const sz of [1, -1] as const) {
      lamp(m, -7.30, 1.30, sz * 0.9, 0.5, 0.4, -1, TINT.SIGN_LIT);
      lamp(m, 7.30, 1.0, sz * 0.86, 0.4, 0.3, 1, TINT.BRAND);
    }
    plate(m, 10, -7.32, 0.94, -1);
    bumper(m, st, 10, -7.26, -1, 0.90, 1.62);
    wipers(m, -7.2, 1.96, 1.16);
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
  // Twelve walkers, not sixteen: a figure is about three hundred triangles
  // once it has hips, arms and a face, and the fleet ceiling is five thousand.
  const walkers: Array<[number, number, number, number]> = [
    [-7.4, -1.9, 0, 0.16], [-4.8, -2.3, 0, 0.10], [-2.2, -1.7, 0, 0.18],
    [0.4, -2.2, 0, 0.06], [3.0, -1.8, 0, 0.15], [5.6, -2.3, 0, 0.11],
    [-6.6, 0.9, Math.PI, 0.14], [-4.0, 1.4, Math.PI, 0.09], [-1.4, 0.8, Math.PI, 0.17],
    [1.2, 1.3, Math.PI, 0.05], [3.8, 0.9, Math.PI, 0.16],
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


/**
 * A car from a description, rather than another hand-written generator.
 *
 * The first ten were each written out in full, which is the right way to find
 * out what a car needs but the wrong way to have twenty of them: the same
 * forty lines of bumpers, lamps, handles, mirrors and plates were restated
 * every time, and every one of them drifted. Everything below is the same
 * body-and-cabin construction driven by a table.
 */
interface CarSpec {
  key: number;
  /** Half length and the station heights, nose to tail. */
  plan: Array<[number, number, number]>;
  section: Section;
  axles: [number, number];
  wheel: number;
  cabin: { from: number; to: number; pillars: number[] };
  /** Open-topped: no cabin roof, a windscreen frame and a roll hoop instead. */
  open?: boolean;
  pad: [number, number];
  /** Extra geometry, after the fittings. */
  extra?: (m: MeshBuilder, st: Station[]) => void;
}

function buildCar(lod: number, spec: CarSpec): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  tarmac(m, spec.pad[0], spec.pad[1]);

  const plan: Station[] = spec.plan.map(([x, w, y]) => ({ x, s: shape(spec.section, w, y) }));
  const st = withArches(plan, spec.axles, spec.wheel);
  const nose = st[0].x, tail = st[st.length - 1].x;
  m.keyed(spec.key, () => {
    loft(m, st, MAT.PAINT, { upTo: beltIndex(st[0].s) });
    if (!spec.open) cabin(m, st, MAT.PAINT, spec.cabin);
  });
  if (spec.open) {
    // A screen frame and a roll hoop, so an open car still has a structure.
    m.painted(TINT.METAL_DARK, () => {
      const sx = nose + (tail - nose) * spec.cabin.from;
      const hx = nose + (tail - nose) * spec.cabin.to;
      for (const sz of [1, -1] as const) {
        const w = sz * (hwAt(st, sx, 1.0) - 0.03);
        m.pipe([sx, topAt(st, sx) - 0.04, w], [sx + 0.34, topAt(st, sx) + 0.46, w], 0.045, MAT.TRIM, 6);
        m.pipe([hx, topAt(st, hx) - 0.04, sz * (hwAt(st, hx, 1.0) - 0.18)],
               [hx, topAt(st, hx) + 0.40, sz * (hwAt(st, hx, 1.0) - 0.18)], 0.05, MAT.TRIM, 6);
      }
      const sxx = nose + (tail - nose) * spec.cabin.from;
      m.pipe([sxx + 0.34, topAt(st, sxx) + 0.46, hwAt(st, sxx, 1.0) - 0.03],
             [sxx + 0.34, topAt(st, sxx) + 0.46, -(hwAt(st, sxx, 1.0) - 0.03)], 0.045, MAT.TRIM, 6);
    });
    // The screen itself, between the two A-posts.
    const sx = nose + (tail - nose) * spec.cabin.from;
    const w = hwAt(st, sx, 1.0) - 0.05;
    m.quad([sx, topAt(st, sx) - 0.04, w], [sx, topAt(st, sx) - 0.04, -w],
           [sx + 0.34, topAt(st, sx) + 0.44, -w], [sx + 0.34, topAt(st, sx) + 0.44, w], MAT.CAR_GLASS);
  }

  if (medium) {
    for (const cx of spec.axles) {
      // The liner is as wide as the body at the arch, not 2.4 wheel radii --
      // which on a 40cm wheel was a metre-wide hoop arcing out over the wing
      // and reading as a piece of black wire stuck to the car.
      // Centred on the axle, not above it: a liner centred 9cm high with a
      // radius of r + 13cm arcs to r + 22cm above the ground, which on a low
      // car is above the bonnet -- and it came through the wing as a black claw.
      arch(m, cx, spec.wheel + 0.01, spec.wheel + 0.09, hwAt(st, cx, spec.wheel) * 0.92);
      archLip(m, st, spec.key, cx, spec.wheel + 0.01, spec.wheel + 0.12);
      for (const sz of [1, -1] as const) {
        wheel(m, cx, spec.wheel + 0.01, sz * axleZ(st, cx, spec.wheel, 0.17), spec.wheel, 0.17);
      }
    }
  }
  if (fine) {
    // Everything on the nose and tail is placed from the deck -- the top of
    // the bodywork at that end -- rather than from the roof line. A coupe and
    // a minibus have wildly different roof heights and near-identical bumper
    // heights, and hanging the fittings off the roof put a sports car's
    // headlamps level with its bonnet.
    const dn = deckAt(st, nose + 0.2), dt = deckAt(st, tail - 0.2);
    const dm = deckAt(st, 0);
    bumper(m, st, spec.key, nose + 0.04, -1, 0.30, dn * 0.62);
    bumper(m, st, spec.key, tail - 0.04, 1, 0.30, dt * 0.64);
    grille(m, st, nose + 0.02, -1, dn * 0.30, dn * 0.60, 3);
    handles(m, st, [nose + (tail - nose) * 0.46, nose + (tail - nose) * 0.66], dm * 0.86);
    mirrors(m, st, spec.key, nose + (tail - nose) * (spec.cabin.from + 0.04), dm * 1.02);
    for (const sz of [1, -1] as const) {
      const yf = dn * 0.62, yr = dt * 0.66;
      lamp(m, nose + 0.02, yf, sz * (hwAt(st, nose + 0.12, yf) - 0.22), 0.36, 0.17, -1, TINT.SIGN_LIT);
      lamp(m, tail - 0.02, yr, sz * (hwAt(st, tail - 0.12, yr) - 0.22), 0.34, 0.20, 1, TINT.BRAND);
    }
    plate(m, spec.key, nose, dn * 0.40, -1);
    plate(m, spec.key, tail, dt * 0.42, 1);
    if (spec.extra !== undefined) spec.extra(m, st);
    person(m, spec.key * 7 + 3, tail + 0.9, 1.1, Math.PI, { stride: 0.12 });
  }
  return m;
}

/** A tall one-box section: an MPV, a minibus, anything with a high roof. */
const TALL: Section = [[0.34, 0.80], [0.66, 0.98], [1.20, 1.02], [1.72, 0.98], [1.94, 0.78]];

/**
 * A sports car section: wide at the shoulder, tucked at the sill and the roof.
 *
 * Six points rather than five. The extra one is the shoulder crease, and it is
 * what gives the flank two planes to catch light on instead of one -- the
 * single biggest difference between one of these and a slab with wheels.
 */
const SPORT: Section = [[0.26, 0.72], [0.44, 0.90], [0.72, 0.99], [0.98, 0.97], [1.14, 0.86], [1.30, 0.56]];

const COUPE: CarSpec = {
  key: 9, section: SPORT, axles: [-1.42, 1.40], wheel: 0.40, pad: [3.2, 1.9],
  plan: [[-2.16, 0.82, 0.90], [-1.94, 0.94, 1.00], [-1.36, 1.02, 1.12],
         [-0.55, 1.05, 1.30], [0.35, 1.05, 1.34], [1.18, 1.03, 1.28],
         [1.86, 0.97, 1.10], [2.14, 0.86, 0.96]],
  cabin: { from: 0.40, to: 0.80, pillars: [0.60] },
  extra: (m, st) => {
    m.painted(TINT.METAL_DARK, () => {
      // A splitter under the nose, sills tucked under the flank, and two
      // pipes. The previous set -- a plank across the boot for a ducktail, a
      // full-length sill bar -- read as scaffolding bolted to a car, which is
      // worse than no aero at all.
      m.box([-2.20, 0.13, -0.78], [-1.98, 0.21, 0.78], MAT.TRIM);
      for (const sz of [1, -1] as const) {
        const w = hwAt(st, 0, 0.34) - 0.03;
        m.box([-1.05, 0.20, sz * w - 0.05], [1.05, 0.30, sz * w + 0.02], MAT.TRIM);
        m.pipe([2.06, 0.30, sz * 0.44], [2.22, 0.30, sz * 0.44], 0.065, MAT.TRIM, 8);
      }
      // A lip on the boot edge rather than a wing: eight centimetres, following
      // the deck it stands on.
      const d = deckAt(st, 1.95);
      m.keyed(9, () => m.box([1.86, d, -0.80], [2.06, d + 0.08, 0.80], MAT.PAINT));
    });
  },
};

const CITY: CarSpec = {
  key: 11, section: CAR, axles: [-1.05, 1.10], wheel: 0.30, pad: [2.4, 1.7],
  plan: [[-1.62, 0.78, 0.94], [-1.42, 0.90, 1.06], [-0.90, 0.96, 1.30], [-0.10, 0.96, 1.52],
         [0.70, 0.94, 1.52], [1.34, 0.90, 1.36], [1.58, 0.76, 1.10]],
  cabin: { from: 0.24, to: 0.86, pillars: [0.56] },
};

const ROADSTER: CarSpec = {
  key: 12, section: CAR, axles: [-1.30, 1.36], wheel: 0.33, pad: [3.0, 1.8], open: true,
  plan: [[-2.05, 0.86, 0.78], [-1.80, 0.98, 0.84], [-1.10, 1.04, 0.94], [-0.30, 1.06, 1.02],
         [0.60, 1.06, 1.02], [1.40, 1.02, 0.96], [2.00, 0.90, 0.84], [2.20, 0.76, 0.76]],
  cabin: { from: 0.34, to: 0.66, pillars: [] },
};

const MPV: CarSpec = {
  key: 13, section: TALL, axles: [-1.45, 1.50], wheel: 0.34, pad: [3.2, 1.9],
  plan: [[-2.20, 0.84, 1.30], [-1.95, 0.94, 1.50], [-1.20, 1.00, 1.86], [-0.30, 1.02, 1.94],
         [0.70, 1.02, 1.94], [1.60, 0.99, 1.88], [2.15, 0.90, 1.62], [2.35, 0.78, 1.36]],
  cabin: { from: 0.22, to: 0.92, pillars: [0.44, 0.66] },
};

const CROSSOVER: CarSpec = {
  key: 14, section: TALL, axles: [-1.40, 1.46], wheel: 0.38, pad: [3.1, 1.9],
  plan: [[-2.05, 0.84, 1.24], [-1.82, 0.95, 1.42], [-1.10, 1.01, 1.70], [-0.20, 1.02, 1.78],
         [0.70, 1.01, 1.76], [1.50, 0.98, 1.66], [2.00, 0.88, 1.44], [2.20, 0.76, 1.24]],
  cabin: { from: 0.26, to: 0.88, pillars: [0.48, 0.70] },
};

const MINIBUS: CarSpec = {
  key: 15, section: BOX, axles: [-1.90, 1.95], wheel: 0.38, pad: [3.9, 2.0],
  plan: [[-2.90, 0.88, 1.90], [-2.70, 0.97, 2.20], [-1.90, 1.00, 2.50], [-0.60, 1.00, 2.54],
         [0.90, 1.00, 2.54], [2.10, 0.99, 2.50], [2.85, 0.92, 2.30], [3.05, 0.80, 2.00]],
  cabin: { from: 0.10, to: 0.96, pillars: [0.30, 0.50, 0.70, 0.86] },
};

const BOXTRUCK: CarSpec = {
  // Cab only. The box behind it is its own closed loft, because a rigid truck
  // is two volumes and lofting it as one gives a wedge with a hole in it.
  key: 16, section: BOX, axles: [-2.10, 2.20], wheel: 0.42, pad: [4.2, 2.1],
  plan: [[-3.20, 0.86, 2.10], [-3.00, 0.96, 2.40], [-2.40, 1.00, 2.70], [-1.70, 1.00, 2.74],
         [-1.50, 0.98, 2.20], [3.30, 0.96, 2.10], [3.45, 0.88, 1.90]],
  cabin: { from: 0.02, to: 0.22, pillars: [] },
  extra: (m, st) => {
    const box: Station[] = [
      { x: -1.45, s: shape(BOX, 1.02, 3.10) },
      { x: 0.60, s: shape(BOX, 1.04, 3.14) },
      { x: 2.60, s: shape(BOX, 1.04, 3.14) },
      { x: 3.40, s: shape(BOX, 1.02, 3.06) },
    ];
    m.keyed(16, () => loft(m, box, MAT.PAINT));
    void st;
    // A roller shutter and a tail lift on the back of the box.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 9; i++) {
        const yy = 0.9 + i * 0.24;
        m.box([3.40, yy, -0.98], [3.48, yy + 0.17, 0.98], MAT.TRIM);
      }
      m.box([3.46, 0.52, -1.04], [3.92, 0.70, 1.04], MAT.TRIM);
    });
  },
};

export const FLEET: AssetDef[] = [
  { id: 'car.hatchback', name: 'Hatchback', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [1, 1], height: 1.6, brand: { name: 'Hatch', colour: [0.42, 0.13, 0.12], accent: [0.62, 0.20, 0.16], sign: 'none' }, sim: road(0), note: 'Lofted body, five-spoke wheels, roof rails, raked screen and backlight, one pedestrian for scale.', build: hatchback },
  { id: 'car.saloon', name: 'Saloon', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [1, 1], height: 1.6, brand: { name: 'Saloon', colour: [0.10, 0.16, 0.34], accent: [0.44, 0.16, 0.14], sign: 'none' }, sim: road(0), note: 'Three-box body with a stepped boot, barred grille, twin tailpipes, door shuts and handles.', build: saloon },
  { id: 'car.estate', name: 'Estate', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [1, 1], height: 1.7, brand: { name: 'Estate', colour: [0.14, 0.26, 0.18], accent: [0.46, 0.18, 0.14], sign: 'none' }, sim: road(0), note: 'Long roof carried to the tailgate, roof bars with cross rails, towbar, three doors a side.', build: estate },
  { id: 'car.suv', name: 'SUV', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [1, 1], height: 2.1, brand: { name: 'SUV', colour: [0.20, 0.21, 0.24], accent: [0.48, 0.16, 0.14], sign: 'none' }, sim: road(0), note: 'Raised body on 46cm wheels, arch and sill cladding, roof rails, spare on the tailgate.', build: suv },
  { id: 'car.pickup', name: 'Pickup truck', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [1, 1], height: 2.2, brand: { name: 'Pickup', colour: [0.46, 0.26, 0.10], accent: [0.50, 0.18, 0.14], sign: 'none' }, sim: road(0), note: 'Separate cab and bed with a ribbed tray, roll bar, timber load, tall barred grille.', build: pickup },
  { id: 'car.van', name: 'Panel van', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [1, 1], height: 2.8, brand: { name: 'Van', colour: [0.62, 0.62, 0.64], accent: [0.16, 0.34, 0.52], sign: 'none' }, sim: road(0), note: 'Box body with swage lines and a signwritten flank, glazed rear doors, deep windscreen.', build: van },
  { id: 'car.bus', name: 'City bus', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [2, 1], height: 3.5, brand: { name: 'Transit', colour: [0.58, 0.16, 0.14], accent: [0.72, 0.62, 0.20], sign: 'none' }, sim: road(0), note: 'Twelve-metre body, full window band on pillars, two glazed door sets with grab poles, roof pods, a queue.', build: cityBus },
  { id: 'car.taxi', name: 'Taxi', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [1, 1], height: 2.1, brand: { name: 'Taxi', colour: [0.66, 0.50, 0.08], accent: [0.10, 0.10, 0.12], sign: 'none' }, sim: road(0), note: 'Upright cab body with a chequered waist band, lit roof sign, two fares waiting.', build: taxi },
  { id: 'car.coupe', name: 'Sports coupe', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [1, 1], height: 1.3, brand: { name: 'Coupe', colour: [0.52, 0.06, 0.06], accent: [0.14, 0.14, 0.16], sign: 'none' }, sim: road(0), note: 'Low fastback on a six-point section with a shoulder crease, flared arches, splitter, sills and a ducktail.', build: (lod: number) => buildCar(lod, COUPE) },
  { id: 'car.lorry', name: 'Articulated lorry', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [2, 1], height: 3.7, brand: { name: 'Haulage', colour: [0.14, 0.28, 0.44], accent: [0.70, 0.58, 0.18], sign: 'none' }, sim: road(0), note: 'Tractor unit and semi-trailer on four bogies, exhaust stack, mud flaps, curtain tensioners, name board.', build: lorry },
  { id: 'car.city', name: 'City car', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [1, 1], height: 1.6, brand: { name: 'City', colour: [0.62, 0.54, 0.16], accent: [0.20, 0.22, 0.26], sign: 'none' }, sim: road(0), note: 'Three-metre two-door on 30cm wheels, one pillar a side, short overhangs.', build: (lod: number) => buildCar(lod, CITY) },
  { id: 'car.roadster', name: 'Roadster', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [1, 1], height: 1.3, brand: { name: 'Roadster', colour: [0.52, 0.10, 0.10], accent: [0.16, 0.16, 0.18], sign: 'none' }, sim: road(0), note: 'Open two-seater: no roof, a raked screen frame and twin roll hoops behind the seats.', build: (lod: number) => buildCar(lod, ROADSTER) },
  { id: 'car.mpv', name: 'People carrier', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [1, 1], height: 2.2, brand: { name: 'MPV', colour: [0.16, 0.30, 0.44], accent: [0.44, 0.16, 0.14], sign: 'none' }, sim: road(0), note: 'One-box body with a long glasshouse on three pillars and a near-vertical tailgate.', build: (lod: number) => buildCar(lod, MPV) },
  { id: 'car.crossover', name: 'Crossover', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [1, 1], height: 2.0, brand: { name: 'Crossover', colour: [0.24, 0.30, 0.26], accent: [0.46, 0.18, 0.14], sign: 'none' }, sim: road(0), note: 'Raised hatchback on 38cm wheels: the shape most of a modern street is made of.', build: (lod: number) => buildCar(lod, CROSSOVER) },
  { id: 'car.minibus', name: 'Minibus', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [1, 1], height: 2.9, brand: { name: 'Minibus', colour: [0.70, 0.70, 0.72], accent: [0.16, 0.34, 0.52], sign: 'none' }, sim: road(0), note: 'Six-metre box on four pillars a side, full window band, high roof.', build: (lod: number) => buildCar(lod, MINIBUS) },
  { id: 'car.boxtruck', name: 'Box truck', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [1, 1], height: 3.2, brand: { name: 'Freight', colour: [0.60, 0.30, 0.12], accent: [0.20, 0.22, 0.26], sign: 'none' }, sim: road(0), note: 'Rigid seven-tonner: cab and a taller box behind it, roller shutter and tail lift.', build: (lod: number) => buildCar(lod, BOXTRUCK) },
  { id: 'car.people', name: 'Pedestrians', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [2, 1], height: 5.3, brand: { name: 'People', colour: [0.30, 0.32, 0.36], accent: [0.52, 0.44, 0.30], sign: 'none' }, sim: road(0), note: 'Twenty figures on a kerbed pavement: two lanes walking, a group talking, a child, someone on a bench.', build: pedestrians },
  { id: 'car.cyclists', name: 'Cyclists', zone: 'fleet', density: 'none', variant: 'sculpted', footprint: [2, 1], height: 1.9, brand: { name: 'Cycles', colour: [0.16, 0.34, 0.30], accent: [0.62, 0.40, 0.12], sign: 'none' }, sim: road(0), note: 'Three riders on diamond-frame bicycles, a scooter with an apron and headlamp, and a full bike stand.', build: cyclists },
];
