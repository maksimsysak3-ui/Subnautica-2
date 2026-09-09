/**
 * Broadleaf trees, grown rather than stacked.
 *
 * The tree the library had was two cones on a cylinder. That is a conifer, and
 * it is the shape every city builder reaches for because it is four
 * primitives; a street of them reads as a plantation. What a city actually has
 * on its verges and in its parks is mature deciduous trees, and those have a
 * shape a cone cannot approximate: a short thick trunk that splits low into
 * three or four major limbs, those limbs visible through the crown, and a
 * canopy that is wider than it is tall, lumpy in silhouette, and full of gaps
 * you can see sky through.
 *
 * So the skeleton is recursive and the canopy is a set of separate masses hung
 * on its outer tips. Two consequences worth stating, because they are what
 * make the result look like the photograph rather than like a lollipop:
 *
 *   - Foliage goes only on the ends of branches. A crown modelled as one blob
 *     is solid, and the eye reads solid as plastic. Hanging the masses on the
 *     tips leaves the middle of the tree open, which is where the branches
 *     are, and they show through exactly as they do in life.
 *   - Every limb bends. A branch drawn as one straight prism between two
 *     points is a stick; the same branch in three segments, each turned a few
 *     degrees, is a branch. It costs two triangles a segment.
 *
 * Level of detail is the recursion depth and the number of canopy masses, not
 * a decimation: LOD2 is the same tree grown two generations less far.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { Vec3 } from '../mesh';
import type { AssetDef } from '../types';

/** Deterministic per-tree noise. Every parameter below is drawn from this. */
function rand(seed: number, i: number): number {
  const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

function norm(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Any unit vector at right angles to `v`. Used to build a ring's plane. */
function perp(v: Vec3): Vec3 {
  const a: Vec3 = Math.abs(v[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return norm([
    a[1] * v[2] - a[2] * v[1],
    a[2] * v[0] - a[0] * v[2],
    a[0] * v[1] - a[1] * v[0],
  ]);
}

/**
 * A tapered tube between two points: the one primitive a tree is made of.
 *
 * MeshBuilder.cylinder is axis-aligned, and nothing above the trunk of a tree
 * is. The ring is built in the plane at right angles to the segment, so a limb
 * leaning at forty degrees has a round section rather than an elliptical one.
 */
function limb(m: MeshBuilder, a: Vec3, b: Vec3, ra: number, rb: number, sides: number): void {
  const axis = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
  const u = perp(axis);
  const v: Vec3 = [
    axis[1] * u[2] - axis[2] * u[1],
    axis[2] * u[0] - axis[0] * u[2],
    axis[0] * u[1] - axis[1] * u[0],
  ];
  const ring = (c: Vec3, r: number): Vec3[] => {
    const out: Vec3[] = [];
    for (let i = 0; i < sides; i++) {
      const t = (i / sides) * Math.PI * 2;
      const cs = Math.cos(t) * r, sn = Math.sin(t) * r;
      out.push([
        c[0] + u[0] * cs + v[0] * sn,
        c[1] + u[1] * cs + v[1] * sn,
        c[2] + u[2] * cs + v[2] * sn,
      ]);
    }
    return out;
  };
  const lo = ring(a, ra), hi = ring(b, rb);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    m.quad(lo[i], lo[j], hi[j], hi[i], MAT.BARK);
  }
}

/**
 * One mass of leaves: a squashed, lumpy spheroid.
 *
 * Lumpy is the whole job. A smooth ellipsoid reads as a balloon however it is
 * shaded, so every vertex is pushed in or out by its own hash -- and by enough
 * to break the silhouette, because the silhouette is what the eye reads a tree
 * by from more than twenty metres away.
 */
/**
 * The highest point mass() will reach, without building it.
 *
 * The measuring pass needs this exactly, not approximately: it is what sets
 * the scale that makes the tree its declared height, and an estimate leaves
 * the mesh a couple of per cent off -- which is a real discrepancy between
 * what the descriptor says and what the game draws, and is caught by the
 * asset test rather than by anybody looking.
 */
function massTop(c: Vec3, r: number, flat: number, seed: number,
  sides: number, rings: number): number {
  let hi = c[1] + r * flat * (0.78 + rand(seed, 91) * 0.34);
  for (let j = 1; j < rings; j++) {
    const phi = (j / rings) * Math.PI;
    if (Math.cos(phi) <= 0) break;
    for (let i = 0; i < sides; i++) {
      const y = c[1] + Math.cos(phi) * r * (0.80 + rand(seed, j * 31 + i) * 0.34) * flat;
      if (y > hi) hi = y;
    }
  }
  return hi;
}

function mass(m: MeshBuilder, c: Vec3, r: number, flat: number, seed: number,
  sides: number, rings: number): void {
  const grid: Vec3[][] = [];
  for (let j = 1; j < rings; j++) {
    const phi = (j / rings) * Math.PI;
    const row: Vec3[] = [];
    for (let i = 0; i < sides; i++) {
      const th = (i / sides) * Math.PI * 2;
      // Enough wobble to break the silhouette, not so much that the mass
      // reads as a crystal. The first version used nearly twice this and the
      // canopy came out faceted like cut glass.
      const wob = 0.80 + rand(seed, j * 31 + i) * 0.34;
      const rr = r * wob;
      row.push([
        c[0] + Math.sin(phi) * Math.cos(th) * rr,
        c[1] + Math.cos(phi) * rr * flat,
        c[2] + Math.sin(phi) * Math.sin(th) * rr,
      ]);
    }
    grid.push(row);
  }
  const top: Vec3 = [c[0], c[1] + r * flat * (0.78 + rand(seed, 91) * 0.34), c[2]];
  const bot: Vec3 = [c[0], c[1] - r * flat * (0.72 + rand(seed, 92) * 0.30), c[2]];
  // Winding: the ring runs clockwise seen from above -- x to z is right to
  // down on screen when you look down the y axis -- so the top cap takes the
  // ring the other way round to come out counter-clockwise, which is the
  // front face. Getting this backwards culls the top of every canopy mass and
  // leaves a black hole in the crown, which is what it did.
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    m.tri(top, grid[0][j], grid[0][i], MAT.FOLIAGE);
    for (let k = 0; k + 1 < grid.length; k++) {
      m.quad(grid[k][i], grid[k][j], grid[k + 1][j], grid[k + 1][i], MAT.FOLIAGE);
    }
    const last = grid[grid.length - 1];
    m.tri(bot, last[j], last[i], MAT.FOLIAGE);
  }
}

interface Species {
  /** Metres, to the top of the crown. */
  height: number;
  /** Crown half-width as a fraction of height. Broadleaves are wider than tall. */
  spread: number;
  /** Where the trunk first splits, as a fraction of height. */
  fork: number;
  /** Trunk radius at the ground. */
  butt: number;
  /** How far limbs lean out of vertical at the first split, in radians. */
  lean: number;
  /** How strongly branches turn back towards the sky at each generation. */
  reach: number;
  /** Canopy mass flattening: below 1 the masses are wider than tall. */
  flat: number;
  /** Generations of branching this species has not grown yet. */
  young: number;
}

/**
 * Grows one tree.
 *
 * `lod` decides how many generations of branch are drawn and how many canopy
 * masses hang on them, which is the only difference between the three -- a
 * coarse tree is the same tree grown less far, so it keeps its proportions and
 * does not pop into a different shape at the switch.
 */
function grow(lod: number, s: Species, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const medium = lod < 2;
  // A young tree has not had time to branch as far as an old one, so its
  // depth is short by a generation whatever the level of detail.
  //
  // Both of these are `let` because the measuring pass below runs at full
  // detail whatever level is being built. A coarse tree branches one
  // generation less far and therefore grows shorter, so measuring it on its
  // own terms would scale it up to reach the declared height -- and a level of
  // detail that is a different size from the one it replaces both pops at the
  // switch and falls outside the shared quantisation frame in the atlas, which
  // is where this was caught.
  let fine = true;
  let depth = 4 - s.young;
  const sides = fine ? 7 : 5;
  const massSides = fine ? 6 : medium ? 5 : 4;
  // Four, not three. Three puts one ring above the equator and one below, so
  // the mass is a drum with a flat top -- and a canopy of flat-topped drums is
  // what the crown looked like. Two, at the coarsest level, is a bipyramid --
  // eight triangles for a thing that is about to be twenty pixels tall, and
  // trees are the most numerous asset in the city by a wide margin.
  const massRings = fine ? 4 : medium ? 3 : 2;

  let clusters = 0;
  /** Highest point the skeleton reached, for the normalising pass below. */
  let top = 0;
  /** Off for the dry run: the first pass measures, the second builds. */
  let emitting = false;
  /** Everything is scaled by this, which is what makes the tree its height. */
  let k = 1;

  const branch = (from: Vec3, dir: Vec3, len: number, r: number, gen: number, id: number): void => {
    // How hard this limb turns back towards the sky, drawn per limb rather
    // than taken from the species. One value for the whole tree made every
    // tip finish at the same height and the crown came out as a flat plate on
    // a stick; letting some limbs stay near horizontal and others climb is
    // what gives a canopy its depth from top to bottom.
    // Negative for some of them: a mature broadleaf has lower limbs that
    // descend as well as upper ones that reach, and forcing every limb
    // upwards is what squashed the first crowns into a plate on a stick.
    const climb = s.reach * (-0.45 + rand(seed, id * 53) * 2.1);
    // Every limb in two or three segments, each turned a few degrees, because
    // one straight prism between two points is a stick and this is a branch.
    const parts = gen === 0 ? 3 : 2;
    let p = from;
    let d = dir;
    for (let seg = 0; seg < parts; seg++) {
      const t0 = seg / parts, t1 = (seg + 1) / parts;
      const next = add(p, d, len / parts);
      if (emitting) {
        limb(m, p, next, r * (1 - t0 * 0.55), r * (1 - t1 * 0.55),
          Math.max(4, sides - gen));
      }
      p = next;
      // The tube's ring stands r out from the axis, so a limb ending upright
      // reaches its own radius above the point it ends at.
      if (p[1] + r > top) top = p[1] + r;
      // Bend: a little jitter, and a pull back towards the sky. A real limb
      // sweeps up towards its tip -- that curve is most of what distinguishes
      // a broadleaf from a diagram of one.
      const j = 0.13;
      d = norm([
        d[0] + (rand(seed, id * 17 + seg * 5 + 1) - 0.5) * j,
        d[1] + (rand(seed, id * 17 + seg * 5 + 2) - 0.5) * j * 0.6 + climb * 0.16,
        d[2] + (rand(seed, id * 17 + seg * 5 + 3) - 0.5) * j,
      ]);
    }

    const massAt = (c: Vec3, r0: number, id2: number, sides2: number, rings2: number): void => {
      // Exactly what mass() will reach, not an estimate: the measuring pass
      // and the building pass have to agree to the millimetre, or the declared
      // height is a number that does not describe the mesh.
      const tip = massTop(c, r0, s.flat, seed + id2, sides2, rings2);
      if (tip > top) top = tip;
      if (!emitting) return;
      mass(m, c, r0, s.flat, seed + id2, sides2, rings2);
      clusters++;
    };
    const crown = s.height * k * s.spread;

    // Leaves start one generation before the last, as a spur off a limb that
    // carries on growing. A canopy whose foliage all hangs at the same depth
    // is a ring of separate balls; this is what fills the inside of it.
    if (fine && gen === depth - 1 && rand(seed, id * 59) < 0.42) {
      massAt(add(p, d, len * 0.10), crown * (0.13 + rand(seed, id * 61) * 0.09),
        id * 3 + 5, massSides - 1, massRings);
    }

    if (gen >= depth) {
      // The end of the line. Two or three small masses around the tip rather
      // than one large one: a crown built from masses a third of its own width
      // has a cauliflower silhouette, and the silhouette is what the eye reads
      // a tree by from more than twenty metres away.
      // Three at every level of detail, the same size at every level. The
      // coarse levels used to hang two larger masses instead, which saved
      // triangles and made the coarse tree *wider than the fine one* -- a
      // level of detail that grows when it simplifies pops at the switch, and
      // falls outside the quantisation frame the atlas shares between levels.
      // The saving comes from the mass being cheaper, not from it being
      // absent: fewer sides, fewer rings, same crown.
      // Fewer at distance, never larger: dropping a mass shrinks the crown,
      // which keeps the coarse tree inside the fine one's bounds. Growing the
      // remaining ones to compensate is what broke that before.
      const heads = fine ? 3 : medium ? 3 : 2;
      for (let k = 0; k < heads; k++) {
        const r0 = crown * (0.13 + rand(seed, id * 7 + k) * 0.10);
        const along = len * (0.10 + k * 0.22);
        const c = add(p, d, along);
        massAt([
          c[0] + (rand(seed, id * 41 + k) - 0.5) * r0 * 1.5,
          c[1] + (rand(seed, id * 43 + k) - 0.5) * r0 * 1.2,
          c[2] + (rand(seed, id * 47 + k) - 0.5) * r0 * 1.5,
        ], r0, id * 4 + k, massSides, massRings);
      }
      return;
    }

    // Two or three children, spread around the parent's axis. Three keeps the
    // crown full; two leaves the gaps a real tree has.
    const kids = gen === 0 ? (fine ? 4 : 3) : (rand(seed, id * 3) < 0.34 ? 3 : 2);
    const side = perp(d);
    const other: Vec3 = [
      d[1] * side[2] - d[2] * side[1],
      d[2] * side[0] - d[0] * side[2],
      d[0] * side[1] - d[1] * side[0],
    ];
    const phase = rand(seed, id * 11) * Math.PI * 2;
    for (let i = 0; i < kids; i++) {
      const a = phase + (i / kids) * Math.PI * 2 + (rand(seed, id * 13 + i) - 0.5) * 0.7;
      const spread = (gen === 0 ? s.lean : s.lean * 0.72) * (0.65 + rand(seed, id * 19 + i) * 0.7);
      const kid = norm([
        d[0] + (side[0] * Math.cos(a) + other[0] * Math.sin(a)) * spread,
        d[1] + (side[1] * Math.cos(a) + other[1] * Math.sin(a)) * spread,
        d[2] + (side[2] * Math.cos(a) + other[2] * Math.sin(a)) * spread,
      ]);
      branch(p, kid, len * (0.68 + rand(seed, id * 23 + i) * 0.14),
        r * (0.60 + rand(seed, id * 29 + i) * 0.10), gen + 1, id * 5 + i + 1);
    }
  };

  // Two passes. The first grows the skeleton without emitting anything and
  // records how high it got; the second scales every length by whatever makes
  // that height the declared one and builds for real.
  //
  // Necessary because the tree's height is an outcome, not an input: the limbs
  // sweep upwards as they taper, so a tree grown from a nominal twelve metres
  // finishes anywhere between twelve and eighteen depending on how the dice
  // fell. Guessing the overshoot with a constant per species would be a number
  // nobody could check; measuring it costs one walk of a few dozen vectors.
  const run = (): void => {
    if (emitting && medium) {
      // A flared butt. Mature trees are not cylinders at the ground, and the
      // flare is what makes one look rooted rather than pushed into the soil.
      limb(m, [0, 0, 0], [0, s.height * k * 0.10, 0], s.butt * k * 1.42, s.butt * k, sides + 1);
    }
    branch([0, medium ? s.height * k * 0.10 : 0, 0], [0, 1, 0],
      s.height * k * s.fork, s.butt * k, 0, 1);
  };
  run();
  k = s.height / Math.max(top, 0.001);
  fine = lod < 1;
  depth = (lod < 1 ? 4 : lod < 2 ? 3 : 2) - s.young;
  emitting = true;
  top = 0;
  m.painted(TINT.NONE, run);

  void clusters;
  return m;
}

const SPECIES: Record<string, Species> = {
  // The reference: a mature ash in open ground. Short trunk, low fork, crown
  // half as wide again as it is tall above the fork.
  ash:      { height: 12.5, spread: 0.36, fork: 0.28, butt: 0.42, lean: 0.58, reach: 0.60, flat: 0.94, young: 0 },
  // Street lime: pruned up for headroom, so the fork is high and the crown is
  // narrower and more upright than a tree that grew in a field.
  lime:     { height: 11.0, spread: 0.27, fork: 0.42, butt: 0.26, lean: 0.46, reach: 0.78, flat: 1.00, young: 0 },
  // Plane: the big one. Heavy limbs, broad crown, the tree of every boulevard.
  plane:    { height: 16.0, spread: 0.34, fork: 0.32, butt: 0.54, lean: 0.62, reach: 0.58, flat: 0.92, young: 0 },
  // Oak: wide, low and slow. Limbs almost horizontal, crown flat on top.
  oak:      { height: 13.0, spread: 0.42, fork: 0.24, butt: 0.58, lean: 0.80, reach: 0.40, flat: 0.86, young: 0 },
  // Birch: slight, upright, open. The gaps in it are the point.
  birch:    { height: 9.5,  spread: 0.25, fork: 0.34, butt: 0.16, lean: 0.42, reach: 0.70, flat: 1.05, young: 0 },
  // A young street tree, newly planted and staked in the parks generators.
  sapling:  { height: 5.2,  spread: 0.24, fork: 0.46, butt: 0.075, lean: 0.40, reach: 0.85, flat: 1.00, young: 1 },
};

function def(id: string, name: string, key: keyof typeof SPECIES,
  footprint: [number, number], note: string): AssetDef {
  const s = SPECIES[key];
  const seed = id.length * 13 + id.charCodeAt(4) * 7;
  return {
    id, name, zone: 'nature', density: 'none', variant: 'sculpted',
    footprint, height: s.height,
    sim: { powerKW: 0, waterM3: 0, garbagePerWeek: 0, pollution: -2, upkeep: 1 },
    note,
    build: (lod: number) => grow(lod, s, seed),
  };
}

export const TREES: AssetDef[] = [
  def('tree.ash', 'Ash', 'ash', [2, 2],
    'A mature ash in open ground: short trunk, low fork, four heavy limbs and a crown wider than it is tall.'),
  def('tree.lime', 'Street lime', 'lime', [2, 2],
    'Pruned up for headroom, so the fork is high and the crown upright. The standard street tree.'),
  def('tree.plane', 'London plane', 'plane', [3, 3],
    'The boulevard tree. Heavy limbs, sixteen metres, and a crown broad enough to shade a carriageway.'),
  def('tree.oak', 'Oak', 'oak', [3, 3],
    'Wide, low and slow, with limbs near horizontal and a crown flat on top.'),
  def('tree.birch', 'Birch', 'birch', [2, 2],
    'Slight and upright, and open enough to see through. The gaps are the point.'),
  def('tree.sapling', 'Young tree', 'sapling', [1, 1],
    'Newly planted: one slim stem, a light head, and not yet any shade.'),
];
