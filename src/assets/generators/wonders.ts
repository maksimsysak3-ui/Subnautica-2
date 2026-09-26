/**
 * Wonders of the World: a content mod of four landmarks the game does not
 * otherwise have.
 *
 * An amphitheatre of three arcaded tiers around a sand arena; a stepped
 * pyramid with its grand stair and a temple on the summit; an iron lattice
 * tower on four curving legs with arches between them and two decks; and an
 * observation wheel ninety metres across with its pods and a lit rim. Each is
 * modelled the way the game's own landmarks are, and each is a real draw:
 * they pull visitors and lift the land around them like any landmark.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { Vec3 } from '../mesh';
import type { AssetDef } from '../types';
import { cap, forecourt, loft, plan, shelf } from './signature-parts';
import type { Ring } from './signature-parts';
import { grow, litCrown } from './supertalls';

// ================================================================ arena

/** An ellipse as a ring. */
const ellipse = (a: number, b: number, n: number): Ring => plan(a, b, 1, n);

function arena(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const n = fine ? 72 : medium ? 44 : 20;
  const A = 46, B = 38, tierH = 9, tiers = 3, attic = 5;
  const wallTop = tiers * tierH + attic;

  if (fine) forecourt(m, -56, -48, 56, 48, 5101, { trees: 8, lamps: 12, people: 30, benches: 6 });
  // The shadowed galleries behind the arcades, then the arcades' piers.
  const back = ellipse(A - 2.4, B - 2.4, n);
  loft(m, back, back, 0.1, tiers * tierH, MAT.DARK_TRIM);
  const piers = fine ? 56 : medium ? 36 : 0;
  m.painted(TINT.NONE, () => {
    for (let t = 0; t < tiers; t++) {
      const y0 = t * tierH, y1 = y0 + tierH - 1.6;
      for (let k = 0; k < piers; k++) {
        const a = (k / piers) * Math.PI * 2;
        m.cylinder(Math.cos(a) * (A - 0.9), Math.sin(a) * (B - 0.9), 0.95, y0 + 0.1, y1, 6, MAT.STONE);
      }
      // The entablature over each arcade.
      const band = ellipse(A, B, n);
      loft(m, band, band, y1, y0 + tierH, MAT.STONE);
      shelf(m, back, band, y0 + tierH - 0.1, y0 + tierH, MAT.STONE);
    }
  });
  // The attic storey, solid, with the ring of masts that held the awning.
  const outer = ellipse(A, B, n);
  loft(m, outer, outer, tiers * tierH, wallTop, MAT.STONE);
  if (medium) {
    for (let k = 0; k < (fine ? 40 : 20); k++) {
      const a = (k / (fine ? 40 : 20)) * Math.PI * 2;
      m.cylinder(Math.cos(a) * (A - 0.4), Math.sin(a) * (B - 0.4), 0.18, wallTop, wallTop + 4, 5, MAT.TIMBER);
    }
  }
  // The seating: steps down from the top of the wall to the arena's edge.
  const steps = fine ? 12 : medium ? 7 : 3;
  let prev = ellipse(A - 2.4, B - 2.4, n), py = wallTop;
  for (let k = 1; k <= steps; k++) {
    const u = k / steps;
    const ring = ellipse(A - 2.4 - u * 20, B - 2.4 - u * 20, n);
    const y = wallTop - u * (wallTop - 3);
    shelf(m, ring, prev, y, py, MAT.STONE);
    prev = ring; py = y;
  }
  // The inside face of the seating, and the arena floor.
  const edge = ellipse(A - 22.4, B - 22.4, n);
  loft(m, edge, edge, 0.3, 3, MAT.STONE, true);
  m.painted(TINT.WOOD, () => cap(m, edge, 0.3, MAT.PLASTER));
  return m;
}

// ============================================================== pyramid

function pyramid(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const tiers = 9, tierH = 5, base = 40, topHalf = 9;
  if (fine) forecourt(m, -48, -48, 48, 48, 5202, { trees: 10, lamps: 8, people: 24, benches: 4 });
  for (let k = 0; k < tiers; k++) {
    const h = base - (base - topHalf) * (k / (tiers - 1));
    const y = k * tierH;
    m.box([-h, y, -h], [h, y + tierH - 0.6, h], MAT.STONE);
    // A cornice at every tier's lip.
    m.box([-h - 0.5, y + tierH - 0.6, -h - 0.5], [h + 0.5, y + tierH, h + 0.5], MAT.STONE);
    if (fine) {
      // Carved panels on each face.
      m.painted(TINT.METAL_DARK, () => {
        for (const s of [-1, 1]) {
          for (let p = -2; p <= 2; p++) {
            const c = p * h * 0.36;
            m.box([c - h * 0.1, y + 1.2, s * h - (s > 0 ? 0 : 0.2)], [c + h * 0.1, y + tierH - 1.8, s * h + (s > 0 ? 0.2 : 0)], MAT.PAINT);
            m.box([s * h - (s > 0 ? 0 : 0.2), y + 1.2, c - h * 0.1], [s * h + (s > 0 ? 0.2 : 0), y + tierH - 1.8, c + h * 0.1], MAT.PAINT);
          }
        }
      });
    }
  }
  const summit = tiers * tierH;
  // The grand stair up the front, one step a metre, with balustrades.
  const steps = fine ? summit : medium ? summit / 3 : summit / 9;
  const rise = summit / steps;
  for (let k = 0; k < steps; k++) {
    const t = (k + 1) / steps;
    const z = base + 2 - (base - topHalf + 2) * t;
    m.box([-6, 0, z - 1], [6, (k + 1) * rise, z + (base - topHalf + 2) / steps], MAT.STONE);
  }
  if (medium) {
    for (const s of [-1, 1]) {
      m.pipe([s * 6.6, 1.2, base + 2], [s * 6.6, summit + 1.2, topHalf], 0.6, MAT.STONE, 6);
    }
  }
  // The temple on top.
  m.box([-6.5, summit, -6.5], [6.5, summit + 7, 6.5], MAT.STONE);
  m.painted(TINT.METAL_DARK, () => m.box([-2.2, summit, 6.4], [2.2, summit + 5, 6.6], MAT.PAINT));
  m.box([-7.5, summit + 7, -7.5], [7.5, summit + 8.4, 7.5], MAT.STONE);
  if (medium) {
    // Braziers either side of the door, lit.
    for (const s of [-1, 1]) {
      m.cylinder(s * 4.5, 8.2, 0.7, summit, summit + 1.6, 8, MAT.STONE);
      m.painted(TINT.SIGN_LIT, () => m.cylinder(s * 4.5, 8.2, 0.55, summit + 1.6, summit + 2.3, 8, MAT.PAINT));
    }
    litCrown(m, [[7.5, -7.5], [7.5, 7.5], [-7.5, 7.5], [-7.5, -7.5]], summit + 8.4, 0.5);
  }
  return m;
}

// ========================================================= lattice tower

function latticeTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const H1 = 100;
  // Each leg's centreline: from a corner at the ground, curving in to the
  // shaft a hundred metres up.
  const reach = (t: number): number => 30 * Math.pow(1 - t, 1.7) + 5.5;
  const segs = fine ? 12 : medium ? 7 : 4;
  const r = fine ? 0.35 : 0.55, sides = fine ? 5 : 4;
  if (fine) forecourt(m, -40, -40, 40, 40, 5303, { trees: 10, lamps: 8, people: 26, benches: 6 });
  m.painted(TINT.BRAND, () => {
    for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
      // A leg is a square truss: four posts and a diagonal on each face.
      const post = (t: number, ox: number, oz: number): Vec3 => {
        const d = reach(t), w = 2.8 * (1 - t) + 1.2;
        return [sx * d + ox * w, 0.8 + t * (H1 - 0.8), sz * d + oz * w];
      };
      const corners: Array<[number, number]> = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let k = 0; k < segs; k++) {
        const t0 = k / segs, t1 = (k + 1) / segs;
        for (let c = 0; c < 4; c++) {
          const [ox, oz] = corners[c];
          m.pipe(post(t0, ox, oz), post(t1, ox, oz), r * 1.4, MAT.PAINT, sides);
          if (medium) {
            const [nx, nz] = corners[(c + 1) % 4];
            m.pipe(post(t0, ox, oz), post(t1, nx, nz), r, MAT.PAINT, sides);
          }
        }
      }
    }
    // The arches between the legs at the foot.
    const arch = fine ? 14 : 6;
    for (const [ax, az, bx, bz] of [[1, 1, -1, 1], [-1, 1, -1, -1], [-1, -1, 1, -1], [1, -1, 1, 1]]) {
      const at = (u: number): Vec3 => {
        const d = reach(0.18);
        const x = ax * d + (bx - ax) * d * u, z = az * d + (bz - az) * d * u;
        return [x, 18 + 12 * Math.sin(u * Math.PI), z];
      };
      for (let k = 0; k < arch; k++) m.pipe(at(k / arch), at((k + 1) / arch), r * 1.6, MAT.PAINT, sides);
    }
    // The upper shaft: four posts drawing together, braced, to the cabin.
    const top = 160;
    const upper = fine ? 8 : 4;
    const px = (t: number): number => 5.5 - 3.2 * t;
    for (let k = 0; k < upper; k++) {
      const t0 = k / upper, t1 = (k + 1) / upper;
      const y0 = H1 + t0 * (top - H1), y1 = H1 + t1 * (top - H1);
      for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
        m.pipe([sx * px(t0), y0, sz * px(t0)], [sx * px(t1), y1, sz * px(t1)], r * 1.3, MAT.PAINT, sides);
      }
      if (medium) {
        m.pipe([px(t0), y0, px(t0)], [-px(t1), y1, px(t1)], r, MAT.PAINT, sides);
        m.pipe([px(t0), y0, -px(t0)], [px(t1), y1, px(t1)], r, MAT.PAINT, sides);
      }
    }
  });
  // The decks.
  for (const [t, extra] of [[0.3, 3], [0.62, 2]] as const) {
    const d = reach(t) + extra, y = t * H1;
    m.box([-d, y, -d], [d, y + 1.6, d], MAT.DARK_TRIM);
    if (medium) {
      const ring: Ring = [[d, -d], [d, d], [-d, d], [-d, -d]];
      loft(m, ring, ring, y + 1.6, y + 5.2, MAT.GLASS);
      cap(m, ring, y + 5.2, MAT.ROOF);
    }
  }
  // The cabin and its light.
  m.box([-4, 160, -4], [4, 166, 4], MAT.GLASS);
  m.box([-4.6, 166, -4.6], [4.6, 167.2, 4.6], MAT.DARK_TRIM);
  m.cylinder(0, 0, 0.6, 167.2, 178, 6, MAT.METAL);
  if (medium) litCrown(m, [[4, -4], [4, 4], [-4, 4], [-4, -4]], 163, 1.2);
  return m;
}

// ================================================================= wheel

function greatWheel(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const R = 43, cy = 50, n = fine ? 64 : medium ? 36 : 18, pods = fine ? 32 : medium ? 16 : 0;
  const rim = (a: number, z: number, rr = R): Vec3 => [Math.cos(a) * rr, cy + Math.sin(a) * rr, z];
  if (fine) forecourt(m, -52, -24, 52, 24, 5404, { trees: 8, lamps: 10, people: 30, benches: 6 });
  m.painted(TINT.NONE, () => {
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      for (const z of [-3, 3]) m.pipe(rim(a0, z), rim(a1, z), 0.7, MAT.TRIM, fine ? 6 : 4);
      if (medium) m.pipe(rim(a0, -3), rim(a0, 3), 0.35, MAT.TRIM, 4);
    }
    // Spokes from the hub to the rim, both faces.
    const spokes = fine ? 32 : 16;
    for (let k = 0; k < spokes; k++) {
      const a = (k / spokes) * Math.PI * 2;
      for (const z of [-3, 3]) m.pipe([0, cy, z * 0.6], rim(a, z), 0.22, MAT.TRIM, 4);
    }
    // The hub.
    m.pipe([0, cy, -5], [0, cy, 5], 2.6, MAT.METAL, fine ? 12 : 8);
    // The A-frame legs.
    for (const z of [-1, 1]) {
      for (const x of [-1, 1]) m.pipe([x * 17, 1.4, z * 11], [0, cy, z * 4.2], 1.3, MAT.TRIM, fine ? 8 : 5);
      m.pipe([-12, 16, z * 9.5], [12, 16, z * 9.5], 0.7, MAT.TRIM, 5);
    }
  });
  // The lit rim.
  if (medium) {
    m.painted(TINT.SIGN_LIT, () => {
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
        m.pipe(rim(a0, 0, R + 0.9), rim(a1, 0, R + 0.9), 0.3, MAT.PAINT, 4);
      }
    });
  }
  // The pods, hanging level outside the rim.
  for (let k = 0; k < pods; k++) {
    const a = (k / pods) * Math.PI * 2;
    const x = Math.cos(a) * (R + 3.2), y = cy + Math.sin(a) * (R + 3.2) - 1.6;
    m.cylinder(x, 0, 2.0, y - 1.5, y + 1.5, fine ? 12 : 8, MAT.GLASS);
    m.painted(TINT.METAL_DARK, () => m.cylinder(x, 0, 2.1, y + 1.5, y + 1.9, fine ? 12 : 8, MAT.METAL));
  }
  // The boarding station under the wheel.
  const hall: Ring = grow([[9, -7], [9, 7], [-9, 7], [-9, -7]], 0);
  loft(m, hall, hall, 0.1, 5.5, fine ? MAT.SHOPFRONT : MAT.GLASS);
  m.painted(TINT.BRAND, () => cap(m, grow(hall, 1.2), 5.5, MAT.PAINT));
  return m;
}

// ================================================================= table

interface Row {
  key: string; name: string; foot: [number, number]; jobs: number; upkeep: number;
  colour: [number, number, number]; accent: [number, number, number]; note: string;
  build: (lod: number) => MeshBuilder;
  /** The elevation drawn on its build-menu tile, in a 52-unit square. */
  icon: string;
}

const ROWS: Row[] = [
  { key: 'arena', name: 'Arena of Ages', foot: [14, 12], jobs: 160, upkeep: 2600,
    colour: [0.78, 0.66, 0.48], accent: [0.42, 0.30, 0.18],
    note: 'An amphitheatre of three arcaded tiers and an attic ringed with awning masts, around stepped seating and a sand arena.',
    icon: '<ellipse cx="26" cy="40" rx="23" ry="6" fill="#6d5236"/><path d="M4 40V22h44v18" fill="#c8a878"/>'
      + '<path d="M4 22h44v3H4z" fill="#8a6a44"/><path d="M4 30h44v2H4z" fill="#8a6a44"/>'
      + '<path d="M8 26h3v4H8zm7 0h3v4h-3zm7 0h3v4h-3zm7 0h3v4h-3zm7 0h3v4h-3zm7 0h3v4h-3zM8 33h3v6H8zm7 0h3v6h-3zm7 0h3v6h-3zm7 0h3v6h-3zm7 0h3v6h-3zm7 0h3v6h-3z" fill="#4a3522"/>',
    build: arena },
  { key: 'pyramid', name: 'Sun Pyramid', foot: [12, 12], jobs: 90, upkeep: 1800,
    colour: [0.80, 0.70, 0.52], accent: [0.95, 0.62, 0.22],
    note: 'Nine stepped tiers with carved panels, a grand stair up the front between balustrades, and a temple on the summit with its braziers lit.',
    icon: '<path d="M4 46h44l-4-5H8zm6-5h32l-4-5H14zm6-5h20l-4-5H20zm5-5h10l-2-5h-6z" fill="#cdb488"/>'
      + '<path d="M23 21h6v-5h-6z" fill="#e8d6b0"/><path d="M23 46h6V21h-6z" fill="#a88a5c"/>'
      + '<circle cx="21.5" cy="15" r="1.6" fill="#ffb347"/><circle cx="30.5" cy="15" r="1.6" fill="#ffb347"/>',
    build: pyramid },
  { key: 'lattice', name: 'Iron Lattice Tower', foot: [10, 10], jobs: 120, upkeep: 2200,
    colour: [0.40, 0.29, 0.20], accent: [0.95, 0.78, 0.40],
    note: 'Four trussed legs curving in from the corners over arches, two observation decks, and a lit cabin a hundred and sixty metres up.',
    icon: '<path d="M26 2v6M24 8h4l3 20h-10z" stroke="#6b4a30" stroke-width="1.6" fill="none"/>'
      + '<path d="M20 28h12M8 48C14 38 18 32 21 28M44 48C38 38 34 32 31 28M8 48h7M37 48h7" stroke="#6b4a30" stroke-width="2.4" fill="none"/>'
      + '<path d="M15 48c2-8 20-8 22 0" stroke="#6b4a30" stroke-width="1.6" fill="none"/><path d="M18 36h16" stroke="#6b4a30" stroke-width="2"/>'
      + '<rect x="24" y="6" width="4" height="3" fill="#f2c867"/>',
    build: latticeTower },
  { key: 'wheel', name: 'Great Wheel', foot: [13, 6], jobs: 110, upkeep: 2000,
    colour: [0.30, 0.78, 0.95], accent: [0.92, 0.92, 0.94],
    note: 'An observation wheel ninety metres across on an A-frame, with thirty-two glass pods and a lit rim, over a boarding hall.',
    icon: '<circle cx="26" cy="22" r="18" stroke="#4cc6f2" stroke-width="2" fill="none"/>'
      + '<path d="M26 4v36M8 22h36M13 9l26 26M39 9L13 35" stroke="#cfd6de" stroke-width=".8"/>'
      + '<path d="M26 22L16 46M26 22l10 24" stroke="#e8ecf0" stroke-width="2.2"/><rect x="10" y="44" width="32" height="4" fill="#8aa0b4"/>'
      + '<circle cx="26" cy="22" r="2.4" fill="#e8ecf0"/>',
    build: greatWheel },
];

export const WONDERS: AssetDef[] = ROWS.map((r): AssetDef => ({
  id: `mod.wonders.${r.key}`,
  name: r.name,
  zone: 'commercial',
  density: 'high',
  variant: 'sculpted',
  theme: 'modern',
  signature: true,
  mod: 'wonders',
  footprint: r.foot,
  height: 0,
  brand: { name: r.name, colour: r.colour, accent: r.accent, sign: 'box' },
  sim: { jobs: r.jobs, powerKW: r.jobs * 6, waterM3: r.jobs * 0.6, garbagePerWeek: r.jobs * 14, pollution: 0, upkeep: r.upkeep },
  note: r.note,
  iconSvg: `<svg width="52" height="52" viewBox="0 0 52 52">${r.icon}</svg>`,
  build: r.build,
}));
