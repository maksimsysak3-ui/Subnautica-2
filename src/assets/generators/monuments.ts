/**
 * The Grand Monuments pack: five landmarks the base game has nothing like.
 *
 * A triumphal arch, a striped lighthouse, a five-tier pagoda, a domed
 * observatory and a windmill. Each is built from the kit's primitives to the
 * landmark triangle budget and stands inside its lot, the same rules every
 * signature building keeps. They come in with the mod and go with it.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { Material, Vec3 } from '../mesh';
import type { AssetDef } from '../types';
import { cap, forecourt, loft, plan } from './signature-parts';
import type { Ring } from './signature-parts';
import { square } from './supertalls';

/** Both faces of a quad, for sails and anything else thin. */
function twoSided(m: MeshBuilder, a: Vec3, b: Vec3, c: Vec3, d: Vec3, mat: Material): void {
  m.quad(a, b, c, d, mat);
  m.quad(d, c, b, a, mat);
}

/** A pitched roof over a box, ridge along x. */
function gableRoof(m: MeshBuilder, x0: number, x1: number, z0: number, z1: number, y: number, h: number, wall: Material): void {
  const zc = (z0 + z1) / 2;
  twoSided(m, [x0, y, z0], [x1, y, z0], [x1, y + h, zc], [x0, y + h, zc], MAT.ROOF_TILE);
  twoSided(m, [x1, y, z1], [x0, y, z1], [x0, y + h, zc], [x1, y + h, zc], MAT.ROOF_TILE);
  m.tri([x1, y, z0], [x1, y, z1], [x1, y + h, zc], wall);
  m.tri([x0, y, z1], [x0, y, z0], [x0, y + h, zc], wall);
}

// ---------------------------------------------------------------- the arch

function arch(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  if (lod < 1) forecourt(m, -23, -15, 23, 15, 71, { lamps: 6, people: 10, benches: 2 });
  // Plinth, two piers, the attic over them.
  m.box([-19, 0.1, -8], [19, 1.6, 8], MAT.STONE);
  m.box([-18, 1.6, -7], [-6, 27, 7], MAT.STONE);
  m.box([6, 1.6, -7], [18, 27, 7], MAT.STONE);
  m.box([-6, 22, -7], [6, 27, 7], MAT.STONE);
  m.box([-18.6, 27, -7.6], [18.6, 28.4, 7.6], MAT.TRIM);
  m.box([-18, 28.4, -7], [18, 38, 7], MAT.STONE);
  m.box([-18.8, 38, -7.8], [18.8, 39.2, 7.8], MAT.TRIM);
  // The vault: a half-round soffit through the middle.
  const seg = fine ? 14 : medium ? 8 : 4;
  for (let k = 0; k < seg; k++) {
    const a0 = Math.PI * (k / seg), a1 = Math.PI * ((k + 1) / seg);
    const p = (a: number): [number, number] => [Math.cos(a) * 6, 16 + Math.sin(a) * 6];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    m.quad([x1, y1, -7], [x0, y0, -7], [x0, y0, 7], [x1, y1, 7], MAT.STONE);
    // Spandrels: fill the corners between the round and the square opening.
    if (k < seg / 2) {
      m.quad([6, y0, 7], [x0, y0, 7], [x1, y1, 7], [6, y1, 7], MAT.STONE);
      m.quad([6, y1, -7], [x1, y1, -7], [x0, y0, -7], [6, y0, -7], MAT.STONE);
    } else {
      m.quad([-6, y1, 7], [x1, y1, 7], [x0, y0, 7], [-6, y0, 7], MAT.STONE);
      m.quad([-6, y0, -7], [x0, y0, -7], [x1, y1, -7], [-6, y1, -7], MAT.STONE);
    }
  }
  m.box([-6, 16, -7], [-5.9, 22, 7], MAT.STONE);
  m.box([5.9, 16, -7], [6, 22, 7], MAT.STONE);
  if (medium) {
    // Engaged columns on both faces, and a frieze band.
    for (const z of [7.7, -7.7]) {
      for (const x of [-16.5, -7.5, 7.5, 16.5]) {
        m.cylinder(x, z, 0.85, 1.6, 26, fine ? 10 : 6, MAT.STONE);
        m.box([x - 1.2, 25.6, z - 0.9], [x + 1.2, 27, z + 0.9], MAT.TRIM);
      }
      m.painted(TINT.ACCENT, () => m.box([-17, 31, z > 0 ? 7 : -7.3], [17, 35, z > 0 ? 7.3 : -7], MAT.PAINT));
    }
  }
  // The quadriga on top, in bronze.
  m.painted(TINT.METAL_DARK, () => {
    m.box([-6, 39.2, -3], [6, 41, 3], MAT.METAL);
    if (medium) for (const x of [-4.5, -1.5, 1.5, 4.5]) m.box([x - 0.6, 41, -2.2], [x + 0.6, 45, 2.2], MAT.METAL);
    m.box([-1, 41, -1], [1, 47.5, 1], MAT.METAL);
  });
  return m;
}

// ---------------------------------------------------------------- the lighthouse

function lighthouse(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const n = fine ? 20 : medium ? 12 : 8;
  if (lod < 1) forecourt(m, -15, -15, 15, 15, 71, { lamps: 6, people: 10, benches: 2 });
  // Rocks at the foot, and the keeper's cottage behind.
  m.box([-7, 0.1, -7], [7, 1.4, 7], MAT.STONE);
  m.box([-12, 0.1, -14], [4, 6, -7.5], MAT.PLASTER);
  gableRoof(m, -12.4, 4.4, -14.4, -7.1, 6, 3.6, MAT.PLASTER);
  // The tower in bands, red and white, narrowing as it goes.
  const bands = 8, h = 36;
  for (let i = 0; i < bands; i++) {
    const t0 = i / bands, t1 = (i + 1) / bands;
    const r0 = 5.6 - 2.4 * t0, r1 = 5.6 - 2.4 * t1;
    const a = plan(r0, r0, 1, n), b = plan(r1, r1, 1, n);
    if (i % 2 === 0) loft(m, a, b, 1.4 + t0 * h, 1.4 + t1 * h, MAT.PLASTER);
    else m.painted(TINT.BRAND, () => loft(m, a, b, 1.4 + t0 * h, 1.4 + t1 * h, MAT.PAINT));
  }
  const top = 1.4 + h;
  // Gallery, lantern, dome.
  m.cylinder(0, 0, 4.4, top, top + 0.6, n, MAT.CONCRETE);
  const rail = plan(4.3, 4.3, 1, n);
  if (medium) { loft(m, rail, rail, top + 0.6, top + 1.7, MAT.METAL); loft(m, rail, rail, top + 0.6, top + 1.7, MAT.METAL, true); }
  const lamp = plan(2.4, 2.4, 1, n);
  m.painted(TINT.SIGN_LIT, () => m.cylinder(0, 0, 1.6, top + 0.6, top + 4.6, n, MAT.PAINT));
  loft(m, lamp, lamp, top + 0.6, top + 5, MAT.GLASS);
  m.painted(TINT.METAL_DARK, () => m.cone(0, 0, 2.8, 0.3, top + 5, top + 8, n, MAT.METAL));
  m.cylinder(0, 0, 0.18, top + 8, top + 10, 5, MAT.METAL);
  return m;
}

// ---------------------------------------------------------------- the pagoda

function pagoda(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const medium = lod < 2;
  if (lod < 1) forecourt(m, -19, -19, 19, 19, 71, { lamps: 6, people: 10, benches: 2 });
  m.box([-16, 0.1, -16], [16, 1.8, 16], MAT.STONE);
  m.box([-4, 0.1, 16], [4, 1.2, 18.5], MAT.STONE);
  let y = 1.8;
  for (let i = 0; i < 5; i++) {
    const s = 11 - i * 1.9, hgt = i === 0 ? 6 : 4.4;
    m.box([-s, y, -s], [s, y + hgt, s], MAT.TIMBER);
    if (medium) {
      m.painted(TINT.BRAND, () => {
        for (const [x, z] of [[s, s], [-s, s], [s, -s], [-s, -s]]) m.box([x - 0.6, y, z - 0.6], [x + 0.6, y + hgt, z + 0.6], MAT.PAINT);
      });
    }
    y += hgt;
    // The eave: a wide, shallow roof sweeping out past the walls.
    const eave: Ring = square(s + 3.6, s + 3.6), ridge: Ring = square(s - 0.6, s - 0.6);
    loft(m, eave, ridge, y, y + 2.2, MAT.ROOF_TILE);
    loft(m, eave, ridge, y, y + 2.2, MAT.ROOF_TILE, true);
    m.painted(TINT.BRAND, () => loft(m, eave, eave, y - 0.5, y, MAT.PAINT));
    y += 2.2;
    cap(m, ridge, y, MAT.ROOF_TILE);
  }
  // The finial: a mast of rings.
  m.painted(TINT.ACCENT, () => {
    m.cylinder(0, 0, 0.5, y, y + 9, 8, MAT.PAINT);
    if (medium) for (let k = 0; k < 6; k++) m.cylinder(0, 0, 1.3 - k * 0.14, y + 1.5 + k * 1.1, y + 1.8 + k * 1.1, 8, MAT.PAINT);
    m.cone(0, 0, 0.9, 0.05, y + 9, y + 11.5, 8, MAT.PAINT);
  });
  return m;
}

// ---------------------------------------------------------------- the observatory

function observatory(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const n = fine ? 28 : medium ? 16 : 10;
  if (lod < 1) forecourt(m, -19, -19, 19, 19, 71, { lamps: 6, people: 10, benches: 2 });
  // The wing in front, the drum, the dome.
  m.box([-9, 0.1, 6], [9, 7, 17], MAT.STONE);
  m.box([-9.4, 7, 5.6], [9.4, 7.8, 17.4], MAT.TRIM);
  m.cylinder(0, 0, 12.5, 0.1, 11, n, MAT.PLASTER);
  m.cylinder(0, 0, 13, 11, 12, n, MAT.TRIM);
  const steps = fine ? 9 : medium ? 5 : 3;
  let prev = plan(12, 12, 1, n), py = 12;
  m.painted(TINT.ACCENT, () => {
    for (let k = 1; k <= steps; k++) {
      const a = (k / steps) * Math.PI / 2;
      const r = Math.max(0.3, Math.cos(a) * 12);
      const next = plan(r, r, 1, n), ny = 12 + Math.sin(a) * 11.5;
      loft(m, prev, next, py, ny, MAT.PAINT);
      prev = next; py = ny;
    }
    cap(m, prev, py, MAT.PAINT);
  });
  // The shutter slit, and the telescope looking out of it.
  m.box([-1.6, 12, 4], [1.6, 23.2, 12.2], MAT.DARK_TRIM);
  if (medium) {
    m.painted(TINT.METAL_DARK, () => {
      for (let k = 0; k < 5; k++) m.box([-0.9, 17 + k * 1.1, 5 + k * 1.3], [0.9, 18.6 + k * 1.1, 6.6 + k * 1.3], MAT.METAL);
    });
  }
  // A smaller dome on the wing.
  m.cylinder(0, 11.5, 3.2, 7.8, 9.6, n / 2, MAT.PLASTER);
  m.painted(TINT.ACCENT, () => m.cone(0, 11.5, 3.2, 0.2, 9.6, 12.4, n / 2, MAT.PAINT));
  return m;
}

// ---------------------------------------------------------------- the windmill

function windmill(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const medium = lod < 2;
  if (lod < 1) forecourt(m, -15, -15, 15, 15, 71, { lamps: 6, people: 10, benches: 2 });
  // An octagonal tower in white render on a brick base, a thatched cap.
  const oct = (r: number): Ring => plan(r, r, 1, 8);
  loft(m, oct(6.8), oct(6.4), 0.1, 4, MAT.BRICK);
  loft(m, oct(6.2), oct(4.2), 4, 19, MAT.PLASTER);
  m.cylinder(0, 0, 5.6, 4, 4.6, 8, MAT.TIMBER);
  m.painted(TINT.WOOD, () => m.cone(0, 0, 4.9, 0.4, 19, 25, 8, MAT.PAINT));
  // A stage round the middle.
  if (medium) {
    const deck = oct(8.4);
    m.painted(TINT.WOOD, () => { loft(m, deck, deck, 8, 8.4, MAT.PAINT); cap(m, deck, 8.4, MAT.PAINT); });
  }
  // The sails: four lattice blades on a hub, facing the front.
  const z = 6.2, cy = 19.5, len = 12.5, w = 1.9;
  m.cylinder(0, 4.6, 0.8, cy - 0.8, cy + 0.8, 8, MAT.METAL);
  m.painted(TINT.WOOD, () => {
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2;
      const ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
      const p = (s: number, o: number): Vec3 => [ux * s + px * o, cy + uy * s + py * o, z];
      twoSided(m, p(1, -0.3), p(len, -0.3), p(len, 0.3), p(1, 0.3), MAT.PAINT);
      twoSided(m, p(2.5, 0.3), p(len, 0.3), p(len, w), p(2.5, w), MAT.TIMBER);
    }
  });
  // The miller's house.
  m.box([-13, 0.1, -13], [-4, 5, -6], MAT.PLASTER);
  gableRoof(m, -13.4, -3.6, -13.4, -5.6, 5, 3, MAT.PLASTER);
  return m;
}

// ================================================================= table

interface Row {
  key: string; name: string; foot: [number, number]; jobs: number; upkeep: number;
  colour: [number, number, number]; accent: [number, number, number]; note: string;
  build: (lod: number) => MeshBuilder;
}

const ROWS: Row[] = [
  { key: 'arch', name: 'Triumphal Arch', foot: [6, 4], jobs: 20, upkeep: 900,
    colour: [0.82, 0.76, 0.62], accent: [0.62, 0.52, 0.34],
    note: 'A forty-metre arch of stone on a plinth, engaged columns and a frieze on both faces, a bronze quadriga on the attic.',
    build: arch },
  { key: 'lighthouse', name: 'Harbour Lighthouse', foot: [4, 4], jobs: 12, upkeep: 600,
    colour: [0.80, 0.14, 0.12], accent: [0.92, 0.92, 0.90],
    note: 'A red-and-white banded tower with a gallery and a lit lantern, and the keeper\'s cottage at its foot.',
    build: lighthouse },
  { key: 'pagoda', name: 'Five-Tier Pagoda', foot: [5, 5], jobs: 30, upkeep: 1100,
    colour: [0.72, 0.14, 0.10], accent: [0.90, 0.72, 0.28],
    note: 'Five timber storeys under sweeping tiled eaves, red posts at every corner and a gilded finial of rings.',
    build: pagoda },
  { key: 'observatory', name: 'City Observatory', foot: [5, 5], jobs: 45, upkeep: 1300,
    colour: [0.30, 0.40, 0.52], accent: [0.62, 0.70, 0.74],
    note: 'A copper dome on a rendered drum with its shutter open and the telescope out, a smaller dome on the lecture wing.',
    build: observatory },
  { key: 'windmill', name: 'Old Windmill', foot: [4, 4], jobs: 8, upkeep: 400,
    colour: [0.66, 0.50, 0.30], accent: [0.52, 0.36, 0.22],
    note: 'An octagonal smock mill in white render on a brick base, with a stage, four lattice sails and the miller\'s house.',
    build: windmill },
];

export const MONUMENTS: AssetDef[] = ROWS.map((r): AssetDef => ({
  id: `mod.monuments.${r.key}`,
  name: r.name,
  zone: 'commercial',
  density: 'high',
  variant: 'sculpted',
  theme: 'modern',
  signature: true,
  mod: 'monuments',
  footprint: r.foot,
  height: 0,
  brand: { name: r.name, colour: r.colour, accent: r.accent, sign: 'box' },
  sim: { jobs: r.jobs, powerKW: r.jobs * 5, waterM3: r.jobs * 0.5, garbagePerWeek: r.jobs * 10, pollution: 0, upkeep: r.upkeep },
  note: r.note,
  build: r.build,
}));
