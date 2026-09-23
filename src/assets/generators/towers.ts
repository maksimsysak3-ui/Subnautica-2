/**
 * Towers drawn as single, continuous forms.
 *
 * The tall stock used to get its silhouette by stacking: a box, a narrower box
 * on it, a narrower box on that, with a smaller plant-room box on the roof.
 * That is how a zoning code draws a building, and from the game's camera it
 * reads as a pile of crates. The towers here get their shape the way the
 * memorable ones do -- from one idea carried through the whole height: a
 * shaft that narrows as it rises, a plan that turns, balconies that ripple, a
 * masonry pier that does not stop at the roof.
 *
 * Built from a small lofting kit: a plan is a closed ring of points, a tower is
 * rings at heights joined by quads, and the facade patterns the shader draws
 * on MAT.GLASS and the theme walls do the rest. Every level of detail is the
 * same form with fewer rings, never a different shape.
 */

import { MAT, MeshBuilder } from '../mesh';
import type { Material } from '../mesh';
import type { ThemeProfile } from '../themes';
import { storeysOf } from '../themed-parts';
import { entrance, frontage, kerb, planter, ribbon } from '../parts';

type P2 = [number, number];

// ---------------------------------------------------------------- the kit

/**
 * A rounded rectangle as a ring of points, counter-clockwise from +X towards
 * +Z -- the winding every function below assumes.
 */
function rounded(hx: number, hz: number, r: number, seg: number): P2[] {
  const out: P2[] = [];
  const rr = Math.max(0.01, Math.min(r, hx - 0.01, hz - 0.01));
  const corners: Array<[number, number, number]> = [
    [hx - rr, hz - rr, 0], [-(hx - rr), hz - rr, 0.5 * Math.PI],
    [-(hx - rr), -(hz - rr), Math.PI], [hx - rr, -(hz - rr), 1.5 * Math.PI],
  ];
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * 0.5 * Math.PI;
      out.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]);
    }
  }
  return out;
}

/** A regular octagon-ish plan: a square with its corners cut by `cut`. */
function chamfered(hx: number, hz: number, cut: number): P2[] {
  const c = Math.min(cut, hx * 0.9, hz * 0.9);
  return [
    [hx, -hz + c], [hx, hz - c], [hx - c, hz], [-hx + c, hz],
    [-hx, hz - c], [-hx, -hz + c], [-hx + c, -hz], [hx - c, -hz],
  ];
}

function scaleRing(ring: P2[], sx: number, sz: number): P2[] {
  return ring.map(([x, z]) => [x * sx, z * sz]);
}

function turnRing(ring: P2[], a: number): P2[] {
  const c = Math.cos(a), s = Math.sin(a);
  return ring.map(([x, z]) => [x * c - z * s, x * s + z * c]);
}

/** Pushes every point of a ring out along its own radius by `by(i)` metres. */
function swell(ring: P2[], by: (i: number, angle: number) => number): P2[] {
  return ring.map(([x, z], i) => {
    const l = Math.hypot(x, z) || 1;
    const d = by(i, Math.atan2(z, x));
    return [x + (x / l) * d, z + (z / l) * d];
  });
}

interface Ring { pts: P2[]; y: number; }

/** The walls between successive rings. Every ring must have the same count. */
function loft(m: MeshBuilder, rings: Ring[], mat: Material): void {
  for (let k = 0; k + 1 < rings.length; k++) {
    const a = rings[k], b = rings[k + 1];
    const n = a.pts.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      m.quad(
        [a.pts[i][0], a.y, a.pts[i][1]], [b.pts[i][0], b.y, b.pts[i][1]],
        [b.pts[j][0], b.y, b.pts[j][1]], [a.pts[j][0], a.y, a.pts[j][1]], mat);
    }
  }
}

/** A flat lid over a ring, facing up (or down, for a soffit). */
function cap(m: MeshBuilder, ring: Ring, mat: Material, down = false): void {
  let cx = 0, cz = 0;
  for (const [x, z] of ring.pts) { cx += x; cz += z; }
  cx /= ring.pts.length; cz /= ring.pts.length;
  const n = ring.pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const p: [number, number, number] = [ring.pts[i][0], ring.y, ring.pts[i][1]];
    const q: [number, number, number] = [ring.pts[j][0], ring.y, ring.pts[j][1]];
    if (down) m.tri([cx, ring.y, cz], p, q, mat);
    else m.tri([cx, ring.y, cz], q, p, mat);
  }
}

/**
 * A thin plate following an outline: a floor slab's edge, a balcony. Drawn
 * as its outer edge, its top and its underside, between the outline and an
 * inner ring it stands off.
 */
function plate(m: MeshBuilder, inner: P2[], outer: P2[], y: number, t: number,
  edge: Material, deck: Material): void {
  loft(m, [{ pts: outer, y }, { pts: outer, y: y + t }], edge);
  const n = outer.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // Top: outer to inner, facing up.
    m.quad([outer[i][0], y + t, outer[i][1]], [inner[i][0], y + t, inner[i][1]],
      [inner[j][0], y + t, inner[j][1]], [outer[j][0], y + t, outer[j][1]], deck);
    // Underside, facing down: the soffit is what is seen from the street.
    m.quad([outer[i][0], y, outer[i][1]], [outer[j][0], y, outer[j][1]],
      [inner[j][0], y, inner[j][1]], [inner[i][0], y, inner[i][1]], edge);
  }
}

/** A tall, faceted spire with a lit tip, which is what catches the sun. */
function spire(m: MeshBuilder, x: number, z: number, y: number, r: number, h: number,
  sides: number, mat: Material): void {
  m.cone(x, z, r, 0, y, y + h, sides, mat);
}

/** A double-height glazed entrance on the +Z face, and the pavement in front. */
function foot(m: MeshBuilder, hx: number, hz: number, h: number, seed: number, fine: boolean): void {
  if (!fine) return;
  ribbon(m, { axis: 'z', sign: 1, plane: hz }, -hx + 1.4, hx - 1.4, 0.4, h - 0.6, { mullions: 11 });
  entrance(m, { axis: 'z', sign: 1, plane: hz }, 0,
    { width: 4.2, height: Math.min(h - 0.8, 4.4), double: true, glazed: true, canopy: 3.2 });
  frontage(m, -hx, hx, hz + 0.6, seed, { planters: 3, bollards: 8 });
}

/**
 * Real glazing over a lofted face: one pane per bay per floor, set a few
 * centimetres proud of a dark body so the gaps between them read as mullions
 * and the spandrel bands as floor edges.
 *
 * The curtain-wall pattern the shader draws on MAT.GLASS is for distance, and
 * up close on a leaning or turning face it reads as a flat tinted sheet. A
 * pane carries its own surface coordinates, so the shader maps one lit room
 * behind each and reflects the sky across its face -- which is what glass
 * looks like from the street.
 *
 * `ringAt(t)` gives the plan at a fraction of the height, so the panes follow
 * a taper or a twist exactly.
 */
function glaze(m: MeshBuilder, ringAt: (t: number) => P2[], y0: number, y1: number,
  floors: number, bay: number): void {
  const fh = (y1 - y0) / floors;
  for (let f = 0; f < floors; f++) {
    const ta = (f + 0.16) / floors, tb = (f + 0.9) / floors;
    const ya = y0 + fh * (f + 0.16), yb = y0 + fh * (f + 0.9);
    const A = ringAt(ta), B = ringAt(tb);
    const n = A.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ex = A[j][0] - A[i][0], ez = A[j][1] - A[i][1];
      const len = Math.hypot(ex, ez);
      if (len < 0.6) continue;
      const nx = ez / len * 0.06, nz = -ex / len * 0.06;
      const bays = Math.max(1, Math.round(len / bay));
      const gap = Math.min(0.09, 0.2 / len) ;
      for (let b = 0; b < bays; b++) {
        const s0 = b / bays + gap, s1 = (b + 1) / bays - gap;
        const at = (R: P2[], s: number, y: number): [number, number, number] => [
          R[i][0] + (R[j][0] - R[i][0]) * s + nx, y, R[i][1] + (R[j][1] - R[i][1]) * s + nz];
        m.quadUV(at(A, s0, ya), at(B, s0, yb), at(B, s1, yb), at(A, s1, ya),
          [[0, 0], [0, 1], [1, 1], [1, 0]], MAT.PANE);
      }
    }
  }
}

// ------------------------------------------------------------- the towers

/**
 * The tapered tower.
 *
 * A chamfered glass shaft that narrows all the way up -- a quarter off its
 * width by the top, continuously, so the silhouette is a line rather than a
 * staircase -- ending in a raked crown whose glass roof is cut on the skew,
 * and a spire. From across the city the rake is what identifies it: one
 * sloped facet catching the light at the top of a skyline of flat lids.
 */
export function taperTower(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 14.6, hz = 14.6;
  const floors = storeysOf(T, 19);
  const lobbyH = T.floorH * 1.6;
  const top = lobbyH + floors * T.floorH;
  const narrow = 0.72;
  const plan = chamfered(hx, hz, 4.2);
  const at = (t: number): P2[] => scaleRing(plan, 1 - (1 - narrow) * t, 1 - (1 - narrow) * t);

  // The lobby: set back behind the line of the shaft, so the tower appears to
  // stand on a band of light.
  const lobbyRing = scaleRing(plan, 0.9, 0.9);
  loft(m, [{ pts: lobbyRing, y: 0 }, { pts: lobbyRing, y: lobbyH }], MAT.SHOPFRONT);
  plate(m, lobbyRing, at(0), lobbyH - 0.3, 0.6, MAT.CONCRETE, MAT.ROOF);

  // The shaft. Rings every few floors at full detail, so the glass pattern's
  // floor lines keep level as the faces lean in.
  const steps = fine ? floors : medium ? 3 : 1;
  const rings: Ring[] = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    rings.push({ pts: at(t), y: lobbyH + t * (top - lobbyH) });
  }
  // Up close: a dark body with real panes on it. Further off: the curtain
  // wall pattern, which is what a glass tower is at that distance.
  loft(m, rings, fine ? MAT.DARK_TRIM : MAT.GLASS);
  if (fine) glaze(m, at, lobbyH, top, floors, 3.0);

  // The crown: the top ring raked, high on one side and low on the other,
  // glazed, with the raking face in the theme's glass.
  const last = at(1);
  const rake = 9.0;
  const raked: Ring = { pts: last, y: top };
  const n = last.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const yi = top + rake * (0.5 + last[i][0] / (hx * narrow * 2));
    const yj = top + rake * (0.5 + last[j][0] / (hx * narrow * 2));
    m.quad([last[i][0], top, last[i][1]], [last[i][0], yi, last[i][1]],
      [last[j][0], yj, last[j][1]], [last[j][0], top, last[j][1]], fine ? MAT.DARK_TRIM : MAT.GLASS);
  }
  // The sloped roof itself: a fan over the raked ring.
  const peak: [number, number, number] = [0, top + rake * 0.5, 0];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const yi = top + rake * (0.5 + last[i][0] / (hx * narrow * 2));
    const yj = top + rake * (0.5 + last[j][0] / (hx * narrow * 2));
    m.tri(peak, [last[j][0], yj, last[j][1]], [last[i][0], yi, last[i][1]], MAT.METAL);
  }
  void raked;

  if (medium) {
    // Four corner fins, full height, leaning with the taper: the verticals
    // that stop a glass prism reading as a blank.
    for (const i of [1, 3, 5, 7]) {
      const b = at(0)[i], t = at(1)[i];
      const ox = Math.sign(b[0]) * 0.45, oz = Math.sign(b[1]) * 0.45;
      m.quad([b[0] + ox, lobbyH, b[1] + oz], [t[0] + ox, top + 2, t[1] + oz],
        [t[0], top + 2, t[1]], [b[0], lobbyH, b[1]], MAT.METAL);
      m.quad([b[0], lobbyH, b[1]], [t[0], top + 2, t[1]],
        [t[0] + ox, top + 2, t[1] + oz], [b[0] + ox, lobbyH, b[1] + oz], MAT.METAL);
    }
    spire(m, hx * narrow * 0.35, 0, top + rake * 0.85, 0.7, 16, 6, MAT.METAL);
  }
  if (fine) {
    // Every third floor plate stands proud of the glass as a thin bright
    // band, leaning in with the shaft: the scale that tells the eye how tall
    // the thing is.
    for (let f = 3; f < floors; f += 3) {
      const t = f / floors;
      plate(m, at(t), swell(at(t), () => 0.28), lobbyH + t * (top - lobbyH) - 0.12, 0.24,
        MAT.TRIM, MAT.TRIM);
    }
  }
  if (fine) {
    // The lobby's canopy and the street.
    foot(m, hx * 0.9, hz * 0.9, lobbyH - 0.3, seed, fine);
    kerb(m, -hx - 1.0, hz + 0.9, hx + 1.0, hz + 1.8);
  }
  return m;
}

/**
 * The twisting tower.
 *
 * A rounded plan turned a little further at every floor, a quarter turn over
 * the height, with every floor plate expressed as a band. Nothing in the city
 * makes the light move the way this does: each face rolls from facing the sun
 * to facing away as it climbs.
 */
export function twistTower(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const half = 11.4;
  const floors = storeysOf(T, 23);
  const lobbyH = T.floorH * 1.5;
  const top = lobbyH + floors * T.floorH;
  const turn = Math.PI * 0.5;
  const plan = rounded(half, half * 0.82, 3.6, fine ? 3 : 2);
  const ringAt = (t: number, grow = 0): P2[] =>
    turnRing(grow === 0 ? plan : swell(plan, () => grow), turn * t);

  // Base: a glazed plinth under the first plate.
  const baseRing = ringAt(0, -0.8);
  loft(m, [{ pts: baseRing, y: 0 }, { pts: baseRing, y: lobbyH }], MAT.SHOPFRONT);

  const every = fine ? 1 : medium ? 3 : floors;
  const rings: Ring[] = [];
  for (let f = 0; f <= floors; f += every) {
    rings.push({ pts: ringAt(f / floors), y: lobbyH + f * T.floorH });
  }
  if (rings[rings.length - 1].y < top - 0.01) rings.push({ pts: ringAt(1), y: top });
  loft(m, rings, fine ? MAT.DARK_TRIM : MAT.GLASS);
  cap(m, { pts: ringAt(1), y: top }, MAT.ROOF);
  if (fine) glaze(m, (t) => ringAt(t), lobbyH, top, floors, 3.0);

  if (medium) {
    // The floor plates, standing proud of the glass. At full detail every
    // other floor; below that, every sixth, which still reads as banding.
    const band = fine ? 2 : 6;
    for (let f = 0; f <= floors; f += band) {
      const t = f / floors;
      plate(m, ringAt(t), ringAt(t, 0.55), lobbyH + f * T.floorH - 0.18, 0.36,
        MAT.CONCRETE, MAT.CONCRETE);
    }
    // A crown ring standing clear of the roof, and a mast.
    const crownRing = ringAt(1, 0.3);
    loft(m, [{ pts: crownRing, y: top }, { pts: crownRing, y: top + 3.2 }], MAT.METAL);
    spire(m, 0, 0, top, 0.5, 14, 6, MAT.METAL);
  }
  if (fine) {
    foot(m, half * 0.9, half * 0.72, lobbyH - 0.2, seed, fine);
    kerb(m, -half - 3, half + 3.6, half + 3, half + 4.5);
    for (const sx of [-1, 1]) planter(m, sx * (half + 1.5), half + 2.2, 1.4, 0.7);
  }
  return m;
}

/**
 * The wave tower.
 *
 * A plain residential core wrapped in balconies whose edges swell in and out
 * from floor to floor, so the whole elevation ripples like water. The
 * balconies are the building: the core behind them is quiet on purpose.
 */
export function waveTower(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 13.2, hz = 11.4;
  const floors = storeysOf(T, 21);
  const baseH = T.floorH * 1.4;
  const top = baseH + floors * T.floorH;
  const plan = rounded(hx, hz, 4.2, fine ? 4 : 2);
  const body = T.ribbon ? (fine ? MAT.DARK_TRIM : MAT.GLASS) : T.wall;

  loft(m, [{ pts: scaleRing(plan, 0.94, 0.94), y: 0 }, { pts: scaleRing(plan, 0.94, 0.94), y: baseH }],
    MAT.SHOPFRONT);
  loft(m, [{ pts: plan, y: baseH }, { pts: plan, y: top }], body);
  cap(m, { pts: plan, y: top }, MAT.ROOF);
  if (fine) glaze(m, () => plan, baseH, top, floors, 2.8);

  // The ripple: a sine round the plan, its phase drifting up the height, so
  // neighbouring floors reach out at different points and the edges flow.
  const every = fine ? 1 : medium ? 2 : 5;
  const phase = (seed % 7) * 0.4;
  for (let f = 1; f <= floors; f += every) {
    const y = baseH + f * T.floorH - 0.12;
    const out = swell(plan, (_i, a) =>
      1.25 + 1.15 * Math.sin(a * 2 + f * 0.33 + phase) * Math.sin(f * 0.11 + a));
    plate(m, plan, out, y, 0.26, MAT.TRIM, MAT.CONCRETE);
  }
  // A roof garden edge and plant screen, set in, low.
  if (medium) {
    const screen = scaleRing(plan, 0.55, 0.55);
    loft(m, [{ pts: screen, y: top }, { pts: screen, y: top + 2.4 }], MAT.METAL);
    cap(m, { pts: screen, y: top + 2.4 }, MAT.ROOF);
  }
  if (fine) {
    foot(m, hx * 0.94, hz * 0.94, baseH - 0.2, seed, fine);
    kerb(m, -hx - 3, hz + 4.2, hx + 3, hz + 5.1);
  }
  return m;
}

export interface GlassShaft {
  hx: number; hz: number;
  /** Corner radius of the plan. */
  r: number;
  floors: number;
  floorH: number;
  y0: number;
  /** Width at the top as a fraction of the bottom. */
  taper: number;
  /** Radians the plan turns over the whole height. */
  twist: number;
  /** Height of the raked crown. */
  rake: number;
  /** Mast above the crown. */
  mast: number;
  bay: number;
}

/**
 * A glass shaft as one continuous form: a rounded plan that narrows and turns
 * as it rises, glazed pane by pane up close, banded at every few floors, and
 * finished with a raked crown and a mast. Returns the tip of the mast.
 */
export function glassShaft(m: MeshBuilder, lod: number, o: GlassShaft): number {
  const fine = lod < 1, medium = lod < 2;
  const top = o.y0 + o.floors * o.floorH;
  const plan = rounded(o.hx, o.hz, o.r, fine ? 3 : 2);
  const at = (t: number, grow = 0): P2[] => {
    const k = 1 - (1 - o.taper) * t;
    const base = scaleRing(plan, k, k);
    return turnRing(grow === 0 ? base : swell(base, () => grow), o.twist * t);
  };
  const steps = fine ? o.floors : medium ? 10 : 3;
  const rings: Ring[] = [];
  for (let k = 0; k <= steps; k++) rings.push({ pts: at(k / steps), y: o.y0 + (k / steps) * (top - o.y0) });
  loft(m, rings, fine ? MAT.DARK_TRIM : MAT.GLASS);
  if (fine) glaze(m, (t) => at(t), o.y0, top, o.floors, o.bay);
  if (medium) {
    const band = fine ? 3 : 8;
    for (let f = band; f < o.floors; f += band) {
      const t = f / o.floors;
      plate(m, at(t), at(t, 0.3), o.y0 + t * (top - o.y0) - 0.14, 0.28, MAT.TRIM, MAT.TRIM);
    }
  }
  // The raked crown: the walls carried up to a sloping glass roof.
  const last = at(1);
  const n = last.length;
  let span = 0;
  for (const [x] of last) span = Math.max(span, Math.abs(x));
  const yAt = (x: number): number => top + o.rake * (0.5 + x / (span * 2));
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    m.quad([last[i][0], top, last[i][1]], [last[i][0], yAt(last[i][0]), last[i][1]],
      [last[j][0], yAt(last[j][0]), last[j][1]], [last[j][0], top, last[j][1]],
      fine ? MAT.DARK_TRIM : MAT.GLASS);
    m.tri([0, top + o.rake * 0.5, 0], [last[j][0], yAt(last[j][0]), last[j][1]],
      [last[i][0], yAt(last[i][0]), last[i][1]], MAT.METAL);
  }
  if (medium && o.mast > 0) spire(m, span * 0.4, 0, yAt(span * 0.4) - 1, 0.9, o.mast, 6, MAT.METAL);
  return top + o.rake + o.mast;
}

export interface PierShaft {
  hx: number; hz: number;
  /** Corner chamfer, metres. */
  cut: number;
  floors: number;
  floorH: number;
  /** Where the shaft starts. */
  y0: number;
  /** Width at the top as a fraction of the bottom: 1 is a prism. */
  taper: number;
  wall: Material;
  pier: Material;
  trim: Material;
  /** Glazing between the piers: its bay width, and its pane material. */
  bay: number;
}

/**
 * A masonry shaft carried by its piers, which do not stop at the roof.
 *
 * One chamfered plan, drawn in continuously if `taper` asks for it, with
 * piers on every face leaning with the walls and rising free of the parapet
 * by a sixth of the height as pointed fins, around an octagonal drum and a
 * long faceted needle. Returns the height of the needle's tip.
 */
export function pierShaft(m: MeshBuilder, lod: number, o: PierShaft): number {
  const fine = lod < 1, medium = lod < 2;
  const top = o.y0 + o.floors * o.floorH;
  const plan = chamfered(o.hx, o.hz, o.cut);
  const at = (t: number): P2[] => scaleRing(plan, 1 - (1 - o.taper) * t, 1 - (1 - o.taper) * t);
  const steps = o.taper < 1 ? (fine ? 6 : medium ? 3 : 1) : 1;
  const rings: Ring[] = [];
  for (let k = 0; k <= steps; k++) rings.push({ pts: at(k / steps), y: o.y0 + (k / steps) * (top - o.y0) });
  loft(m, rings, o.wall);
  cap(m, { pts: at(1), y: top }, MAT.ROOF);
  if (fine) glaze(m, at, o.y0, top, o.floors, o.bay);

  // The piers, found on the bottom and top rings at the same fraction of the
  // same edge, so each leans exactly as the wall behind it does.
  const rise = Math.max(10, (top - o.y0) * 0.16);
  const lo = at(0), hi = at(1);
  const n = plan.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const len = Math.hypot(lo[j][0] - lo[i][0], lo[j][1] - lo[i][1]);
    const count = len > 12 ? Math.max(2, Math.round(len / 7)) : 1;
    const nx = (lo[j][1] - lo[i][1]) / len, nz = -(lo[j][0] - lo[i][0]) / len;
    const tx = -nz, tz = nx;
    for (let k = 0; k < count; k++) {
      const f = (k + 1) / (count + 1);
      const bx = lo[i][0] + (lo[j][0] - lo[i][0]) * f, bz = lo[i][1] + (lo[j][1] - lo[i][1]) * f;
      const ux = hi[i][0] + (hi[j][0] - hi[i][0]) * f, uz = hi[i][1] + (hi[j][1] - hi[i][1]) * f;
      const w = 0.8, d = 1.0;
      // Free-standing heights vary, tallest in the middle of each face.
      const lift = medium ? rise * (0.6 + 0.4 * Math.sin(f * Math.PI)) : 1;
      const pt = (x: number, z: number, u: number, v: number, y: number): [number, number, number] =>
        [x + tx * u + nx * v, y, z + tz * u + nz * v];
      const B = (u: number, v: number): [number, number, number] => pt(bx, bz, u, v, o.y0);
      // Above the roof the pier carries straight on up from where it met it.
      const T2 = (u: number, v: number, y: number): [number, number, number] => pt(ux, uz, u, v, y);
      for (const [y0, y1, bottom] of [[o.y0, top, true], [top, top + lift, false]] as const) {
        const P = (u: number, v: number, y: number): [number, number, number] =>
          bottom ? (y === o.y0 ? B(u, v) : T2(u, v, y)) : T2(u, v, y);
        m.quad(P(-w / 2, d, y0), P(-w / 2, d, y1), P(w / 2, d, y1), P(w / 2, d, y0), o.pier);
        m.quad(P(-w / 2, 0, y0), P(-w / 2, 0, y1), P(-w / 2, d, y1), P(-w / 2, d, y0), o.pier);
        m.quad(P(w / 2, d, y0), P(w / 2, d, y1), P(w / 2, 0, y1), P(w / 2, 0, y0), o.pier);
        if (!bottom) {
          // The back of the free-standing part, and a pointed cap.
          m.quad(P(w / 2, 0, y0), P(w / 2, 0, y1), P(-w / 2, 0, y1), P(-w / 2, 0, y0), o.pier);
          const tip = T2(0, d * 0.5, y1 + 2.6);
          m.tri(P(-w / 2, d, y1), tip, P(w / 2, d, y1), o.pier);
          m.tri(P(-w / 2, 0, y1), tip, P(-w / 2, d, y1), o.pier);
          m.tri(P(w / 2, d, y1), tip, P(w / 2, 0, y1), o.pier);
          m.tri(P(w / 2, 0, y1), tip, P(-w / 2, 0, y1), o.pier);
        }
      }
    }
  }
  let tip = top + 1;
  if (medium) {
    const r = Math.min(o.hx, o.hz) * o.taper * 0.34;
    const facets = fine ? 16 : 8;
    m.cylinder(0, 0, r, top, top + rise * 0.7, facets, o.wall);
    m.cone(0, 0, r, r * 0.62, top + rise * 0.7, top + rise * 0.9, facets, MAT.METAL);
    spire(m, 0, 0, top + rise * 0.9, r * 0.62, rise * 1.7, facets, MAT.METAL);
    tip = top + rise * 2.6;
    for (let f = 0; f <= o.floors; f += fine ? 4 : 10) {
      const t = f / o.floors;
      plate(m, at(t), swell(at(t), () => 0.4), o.y0 + t * (top - o.y0) - 0.2, 0.4, o.trim, o.trim);
    }
  }
  return tip;
}

/**
 * The pier tower, for the masonry themes.
 *
 * A slender chamfered shaft in the theme's own walling, its piers running
 * unbroken from the pavement to past the roof, where they stand free as a
 * crown of fins around a faceted spire. The height is carried by verticals,
 * not by setbacks -- which is what the great masonry towers actually did.
 */
export function pierTower(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const hx = 12.6, hz = 12.6;
  const floors = storeysOf(T, 19);
  const baseH = T.floorH * 2;
  const plan = chamfered(hx, hz, 3.4);
  loft(m, [{ pts: scaleRing(plan, 1.03, 1.03), y: 0 }, { pts: scaleRing(plan, 1.03, 1.03), y: baseH }],
    T.base);
  pierShaft(m, lod, {
    hx, hz, cut: 3.4, floors, floorH: T.floorH, y0: baseH, taper: 0.92,
    wall: T.wall, pier: T.base, trim: T.trim, bay: 2.3,
  });
  if (fine) {
    foot(m, hx, hz * 1.03, baseH - 0.4, seed, fine);
    kerb(m, -hx - 1.0, hz + 1.2, hx + 1.0, hz + 2.1);
  }
  return m;
}

/**
 * The office plan for the setback slot: tapered glass where the theme builds
 * in glass, the pier tower where it builds in masonry.
 */
export function landmarkOffice(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  return T.ribbon ? taperTower(lod, T, seed) : pierTower(lod, T, seed);
}

/** The podium slot: the twist in glass themes, the pier tower's cousin elsewhere. */
export function signatureOffice(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  return T.ribbon ? twistTower(lod, T, seed) : taperTower(lod, T, seed);
}
