/**
 * Signature offices: the five towers a skyline is recognised by.
 *
 * An office tower is the hardest thing in this library to make distinctive,
 * because the programme is identical every time -- a core, a floor plate, a
 * skin -- and the honest answer is that a tower is distinguished by exactly
 * three things: its plan, what happens where it meets the ground, and what
 * happens where it stops. So each of these five takes a different answer to
 * all three, and none of them is "make it taller".
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import {
  cap, crownStack, curtain, flags, forecourt, loft, marquee, pierWall,
  plan, porteCochere, scaled, shelf,
} from './signature-parts';
import { band, entrance, parapet, planter, railing, roofClutter } from '../parts';
import { tree, hedge } from './landscape';
import { figure } from './vehicles';

// -------------------------------------------------------------- 1. supertall

/**
 * A supertall on a nine-square plan, losing a square at every setback.
 *
 * The plan is the design. Nine squares at the base, then the four corners go,
 * then the four sides, and what is left at the top is one square -- so the
 * tower tapers in three discrete jumps rather than smoothly, and each jump
 * leaves a terrace you can see. That is the shape of every tall building that
 * has to shed wind, and it reads at any distance because the silhouette is
 * still legible when the whole thing is forty pixels tall.
 */
function supertall(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const q = 8.0, floorH = 3.9;

  forecourt(m, -46, -40, 46, 40, 1201, { trees: 8, lamps: 8, people: 10, benches: 4 });
  // The base: a colonnade round a glazed lobby, the full nine squares wide.
  m.box([-q * 1.5 - 3, 0.1, -q * 1.5 - 3], [q * 1.5 + 3, 12.0, q * 1.5 + 3], MAT.STONE, { roof: MAT.ROOF });
  if (medium) {
    m.box([-q * 1.5 - 1, 0.6, -q * 1.5 - 1], [q * 1.5 + 1, 10.8, q * 1.5 + 1], MAT.GLASS);
    m.painted(TINT.NONE, () => {
      for (let i = 0; i <= 8; i++) {
        const u = -q * 1.5 - 3 + (i / 8) * (q * 3 + 6);
        for (const p of [-q * 1.5 - 3, q * 1.5 + 3]) {
          m.box([u - 0.75, 0.1, p - 0.4], [u + 0.75, 12.0, p + 0.9], MAT.STONE);
          m.box([p - 0.4, 0.1, u - 0.75], [p + 0.9, 12.0, u + 0.75], MAT.STONE);
        }
      }
    });
    band(m, -q * 1.5 - 3, -q * 1.5 - 3, q * 1.5 + 3, q * 1.5 + 3, 12.0, 1.4, 0.8, MAT.STONE);
  }

  // Three stages. Each is a curtain-walled block, and each loses part of the
  // plan below it.
  const stages: Array<[number, number, number]> = [[1.5, 22, 13.4], [1.0, 22, 13.4], [0.5, 18, 13.4]];
  let y = 13.4;
  for (const [half, n] of stages) {
    const h = q * half;
    m.box([-h, y, -h], [h, y + n * floorH, h], MAT.GLASS);
    if (medium) {
      curtain(m, -h, -h, h, h, y, n, floorH, { mullions: 4.0 });
      // The four corner piers, which is what carries a tower like this.
      m.painted(TINT.METAL_DARK, () => {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          m.box([sx * h - sx * 1.5, y, sz * h - sz * 1.5], [sx * h + sx * 0.25, y + n * floorH + 1.6, sz * h + sz * 0.25], MAT.CLADDING);
        }
      });
    }
    y += n * floorH;
    if (medium) {
      shelf(m, plan(h * 0.97, h * 0.97, 0.02, 4), plan(h + 1.6, h + 1.6, 0.02, 4), y, y + 1.2, MAT.CONCRETE);
    }
    if (fine) railing(m, -h - 1.4, h + 1.4, h + 1.4, y + 1.2, 1.05, 2.4);
    y += 1.2;
  }
  if (medium) {
    crownStack(m, q * 0.5, q * 0.5, y, 4, MAT.CLADDING, { mast: 34, taper: 0.8 });
  }
  if (fine) {
    porteCochere(m, -10, 10, q * 1.5 + 3.4, 6.0, 7.4, 4);
    entrance(m, { axis: 'z', sign: 1, plane: q * 1.5 + 3 }, 0,
      { width: 5.4, height: 7.0, double: true, glazed: true, fanlight: true });
    marquee(m, -8, 8, q * 1.5 + 3.4, 1, 12.4, 2.2);
    flags(m, -22, 22, q * 1.5 + 8.0, 0.2, 6, 10.0);
    roofClutter(m, -q * 1.5 + 2, -q * 1.5 + 2, q * 1.5 - 2, q * 1.5 - 2, 12.0, 23, 0.4);
  }
  return m;
}

// ------------------------------------------------------------------ 2. prism

/**
 * A triangular prism under a raked glass roof.
 *
 * The one plan nothing else in the library has, and it changes everything: a
 * triangle read from any angle shows one face and two edges, so the building
 * has a front from everywhere. The roof is cut on the diagonal, which turns
 * the top into an event instead of a lid, and the sloped face is where the
 * whole thing gets its name.
 */
function prismTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const R = 26.0, floorH = 3.8, floors = 27;

  forecourt(m, -40, -36, 40, 36, 5099, { trees: 7, lamps: 7, people: 9, benches: 3 });
  // The triangle, as a three-point ring. Everything is lofted off it.
  const tri = (r: number): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
      out.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return out;
  };
  const base = tri(R);
  const top = 6.0 + floors * floorH;

  m.box([-R - 2, 0.1, -R * 0.6 - 2], [R + 2, 0.4, R + 2], MAT.CONCRETE);
  loft(m, scaled(base, 1.06), scaled(base, 1.06), 0.4, 6.0, MAT.GLASS);
  loft(m, base, base, 6.0, top, MAT.GLASS);
  if (medium) {
    // Slab edges every floor and a heavy mullion at every third bay: the
    // triangle's long faces are forty-five metres across and need the grain.
    m.painted(TINT.METAL_DARK, () => {
      for (let f = 0; f <= floors; f++) {
        const y = 6.0 + f * floorH;
        shelf(m, scaled(base, 0.99), scaled(base, 1.02), y - 0.24, y + 0.24, MAT.TRIM);
      }
      for (let i = 0; i < 3; i++) {
        const p = base[i], q = base[(i + 1) % 3];
        for (let k = 1; k < 12; k++) {
          const x = p[0] + (q[0] - p[0]) * (k / 12), z = p[1] + (q[1] - p[1]) * (k / 12);
          m.pipe([x * 1.02, 6.0, z * 1.02], [x * 1.02, top, z * 1.02], 0.17, MAT.TRIM, 4);
        }
        // The three corners, expressed as a full-height fin.
        m.pipe([p[0] * 1.06, 0.4, p[1] * 1.06], [p[0] * 1.06, top + 14.0, p[1] * 1.06], 0.7, MAT.TRIM, 5);
      }
    });
    // The raked roof: one corner carried up, the opposite edge left low.
    const a = base[0], b = base[1], c = base[2];
    m.tri([a[0], top + 14.0, a[1]], [b[0], top + 1.0, b[1]], [c[0], top + 1.0, c[1]], MAT.GLASS);
    m.quad([b[0], top, b[1]], [c[0], top, c[1]], [c[0], top + 1.0, c[1]], [b[0], top + 1.0, b[1]], MAT.DARK_TRIM);
    for (const [p, qq] of [[a, b], [c, a]] as const) {
      m.tri([p[0], top, p[1]], [qq[0], top, qq[1]],
            [p === a ? p[0] : qq[0], top + (p === a ? 14.0 : 1.0), p === a ? p[1] : qq[1]], MAT.DARK_TRIM);
    }
    m.painted(TINT.SIGN_LIT, () => {
      m.box([a[0] - 1.4, top + 14.0, a[1] - 1.4], [a[0] + 1.4, top + 18.0, a[1] + 1.4], MAT.PLATE);
    });
  }
  if (fine) {
    // The entrance is cut into one corner: a glazed notch under a canopy.
    porteCochere(m, -9, 9, R * 0.55, 6.0, 6.6, 3);
    marquee(m, -7, 7, R * 0.55 + 0.2, 1, 7.0, 2.0);
    flags(m, -20, 20, R * 0.72, 0.4, 5, 9.0);
    for (const s of [-1, 1]) planter(m, s * 22, 24, 2.4, 0.7);
    for (let i = 0; i < 6; i++) figure(m, 8100 + i * 17, -10 + i * 4.0, R * 0.62, Math.PI, { stride: 0.22 });
  }
  return m;
}

// --------------------------------------------------------------------- 3. HQ

/**
 * A corporate headquarters: a curved slab on a landscaped podium.
 *
 * Low, wide and out of town rather than tall and downtown, which is what half
 * of the world's biggest companies actually build. The plan is a shallow arc,
 * so the building has no flat elevation at all, and the podium it sits on is
 * a garden rather than a car park -- both of which are the point of the type.
 */
function corporateHq(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const floors = 9, floorH = 4.0, base = 5.5;
  const R = 96.0, span = 1.05, depth = 17.0;
  const top = base + floors * floorH;

  forecourt(m, -56, -44, 56, 30, 6607, { trees: 10, lamps: 8, people: 9, benches: 4 });
  // The arc, as two rings at radius R and R - depth.
  const N = 22;
  const arc = (r: number): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    for (let i = 0; i <= N; i++) {
      const a = -span / 2 + (i / N) * span - Math.PI / 2;
      out.push([Math.cos(a) * r, Math.sin(a) * r + R - 26.0]);
    }
    return out;
  };
  const outer = arc(R), inner = arc(R - depth);

  // Podium: a stone plinth under the whole arc, planted on top.
  for (let i = 0; i < N; i++) {
    const a = outer[i], b = outer[i + 1], c = inner[i], d = inner[i + 1];
    m.quad([a[0], base, a[1]], [b[0], base, b[1]], [d[0], base, d[1]], [c[0], base, c[1]], MAT.ROOF);
    m.quad([b[0], 0.1, b[1]], [a[0], 0.1, a[1]], [a[0], base, a[1]], [b[0], base, b[1]], MAT.STONE);
    m.quad([c[0], 0.1, c[1]], [d[0], 0.1, d[1]], [d[0], base, d[1]], [c[0], base, c[1]], MAT.STONE);
    // The shaft above it.
    m.quad([b[0], base, b[1]], [a[0], base, a[1]], [a[0], top, a[1]], [b[0], top, b[1]], MAT.GLASS);
    m.quad([c[0], base, c[1]], [d[0], base, d[1]], [d[0], top, d[1]], [c[0], top, c[1]], MAT.GLASS);
    m.quad([a[0], top, a[1]], [b[0], top, b[1]], [d[0], top, d[1]], [c[0], top, c[1]], MAT.ROOF);
  }
  if (medium) {
    m.painted(TINT.METAL_DARK, () => {
      for (let f = 0; f <= floors; f++) {
        const y = base + f * floorH;
        for (let i = 0; i < N; i++) {
          for (const r of [outer, inner]) {
            const a = r[i], b = r[i + 1];
            m.quad([b[0] * 1.004, y - 0.28, b[1] + (r === outer ? 0.3 : -0.3)],
                   [a[0] * 1.004, y - 0.28, a[1] + (r === outer ? 0.3 : -0.3)],
                   [a[0] * 1.004, y + 0.28, a[1] + (r === outer ? 0.3 : -0.3)],
                   [b[0] * 1.004, y + 0.28, b[1] + (r === outer ? 0.3 : -0.3)], MAT.TRIM);
          }
        }
      }
      for (let i = 0; i <= N; i++) {
        const a = outer[i];
        m.pipe([a[0], base, a[1] + 0.4], [a[0], top + 2.4, a[1] + 0.4], 0.28, MAT.TRIM, 4);
      }
    });
    // A brise-soleil on the outer face: horizontal fins every floor, which is
    // what a west-facing glass arc actually needs.
    for (let f = 1; f < floors; f++) {
      const y = base + f * floorH + 2.6;
      for (let i = 0; i < N; i++) {
        const a = outer[i], b = outer[i + 1];
        m.quad([a[0], y, a[1]], [b[0], y, b[1]],
               [b[0] * 1.02, y + 0.1, b[1] + 1.5], [a[0] * 1.02, y + 0.1, a[1] + 1.5], MAT.METAL);
      }
    }
  }
  if (fine) {
    // The entrance pavilion in the middle of the arc, and the garden in front.
    m.box([-13, 0.1, -30.0], [13, 9.0, -18.0], MAT.GLASS);
    m.painted(TINT.METAL_DARK, () => {
      m.box([-13.6, 8.6, -30.6], [13.6, 9.8, -17.4], MAT.TRIM, { skipBottom: false });
      for (const sx of [-11, -5.5, 0, 5.5, 11]) m.cylinder(sx, -30.0, 0.26, 0.1, 8.6, 6, MAT.TRIM, false);
    });
    marquee(m, -9, 9, -30.4, -1, 10.0, 2.4);
    porteCochere(m, -11, 11, -37.0, 6.5, 6.0, 4);
    parapet(m, -40, -26.0, 40, -12.0, top, 1.0, 0.3, MAT.CONCRETE);
    roofClutter(m, -30, -24.0, 30, -14.0, top, 47, 0.6);
    flags(m, -30, 30, -40.0, 0.2, 7, 9.5);
    for (const sx of [-34, -24, 24, 34]) tree(m, sx, -22, 9.0, 3.2);
    hedge(m, -42, -34.5, 42, -33.0, 1.0);
    m.painted(TINT.GREEN, () => m.box([-30, 0.2, -33.0], [30, 0.34, -31.0], MAT.TRIM));
  }
  return m;
}

// ------------------------------------------------------------------ 4. deco

/**
 * A stepped 1930s skyscraper: masonry, five setbacks, a crown of tiers.
 *
 * The zoning-envelope tower, and the reason a pre-war downtown looks the way
 * it does. It is drawn as masonry the whole way up -- deep continuous piers,
 * recessed spandrels, no expressed floor line -- which is the opposite of
 * everything else here and reads as age from a very long way off.
 */
function decoTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const floorH = 3.6;

  forecourt(m, -36, -32, 36, 32, 3701, { trees: 6, lamps: 6, people: 9, benches: 3 });
  const stages: Array<[number, number, number]> = [
    [24.0, 20.0, 6], [20.0, 16.5, 7], [16.0, 13.0, 7], [12.0, 10.0, 7], [8.0, 7.0, 6],
  ];
  let y = 0.1;
  // A stone base with a tall arched entrance bay.
  m.box([-25.0, 0.1, -21.0], [25.0, 9.0, 21.0], MAT.STONE, { roof: MAT.ROOF });
  if (medium) {
    m.painted(TINT.NONE, () => {
      for (let i = 0; i <= 10; i++) {
        const x = -24 + (i / 10) * 48;
        m.box([x - 1.1, 0.1, -21.6], [x + 1.1, 10.4, -20.4], MAT.STONE);
        m.box([x - 1.1, 0.1, 20.4], [x + 1.1, 10.4, 21.6], MAT.STONE);
      }
      for (let i = 0; i <= 8; i++) {
        const z = -20 + (i / 8) * 40;
        m.box([-25.6, 0.1, z - 1.1], [-24.4, 10.4, z + 1.1], MAT.STONE);
        m.box([24.4, 0.1, z - 1.1], [25.6, 10.4, z + 1.1], MAT.STONE);
      }
    });
    for (const [axis, sign, pln, a, b, n] of [
      ['z', 1, 21.0, -22, 22, 10], ['z', -1, -21.0, -22, 22, 10],
      ['x', 1, 25.0, -18, 18, 8], ['x', -1, -25.0, -18, 18, 8],
    ] as const) {
      m.windowRow({
        axis, sign, plane: pln, from: a, to: b, y0: 1.4, y1: 7.6,
        count: n, width: 2.4, glass: MAT.SHOPFRONT, frame: 0.2, proud: 0.1,
      });
    }
    band(m, -25.0, -21.0, 25.0, 21.0, 9.0, 1.4, 0.9, MAT.STONE);
  }
  y = 10.4;
  for (const [hx, hz, n] of stages) {
    pierWall(m, -hx, -hz, hx, hz, y, n, floorH, MAT.BRICK,
      { bays: Math.max(3, Math.round(hx / 3.2)), glass: MAT.PANE, windows: medium, depth: 0.42, strips: true });
    y += n * floorH;
    if (medium) {
      band(m, -hx, -hz, hx, hz, y, 1.0, 0.85, MAT.STONE);
      // A chevron frieze in the accent colour: the one ornament this style is
      // never without, and four boxes a bay.
      m.painted(TINT.ACCENT, () => {
        const bays = Math.max(3, Math.round(hx / 3.2));
        for (let i = 0; i < bays; i++) {
          const x = -hx + ((i + 0.5) / bays) * hx * 2;
          for (const pz of [-hz - 0.9, hz + 0.9]) m.box([x - 0.9, y + 0.2, pz - 0.14], [x + 0.9, y + 0.7, pz + 0.14], MAT.TRIM);
        }
      });
    }
    y += 1.0;
    if (fine) railing(m, -hx, hx, hz + 0.6, y, 0.9, 2.0);
  }
  if (medium) {
    // The crown: five diminishing tiers with a lit lantern and a spire.
    let cy = y, r = 7.4;
    for (let i = 0; i < 5; i++) {
      m.cone(0, 0, r, r * 0.8, cy, cy + 2.6, 12, MAT.METAL);
      m.painted(TINT.ACCENT, () => m.cylinder(0, 0, r * 0.8 + 0.14, cy + 2.6, cy + 2.9, 12, MAT.TRIM, false));
      cy += 2.9; r *= 0.8;
    }
    m.painted(TINT.SIGN_LIT, () => m.cylinder(0, 0, r * 0.9, cy, cy + 3.2, 8, MAT.PLATE, true));
    m.painted(TINT.METAL_DARK, () => {
      m.cylinder(0, 0, 0.5, cy + 3.2, cy + 14.0, 6, MAT.TRIM, false);
      m.cylinder(0, 0, 0.18, cy + 14.0, cy + 24.0, 5, MAT.TRIM, false);
    });
  }
  if (fine) {
    entrance(m, { axis: 'z', sign: 1, plane: 21.0 }, 0,
      { width: 6.0, height: 8.4, double: true, glazed: true, fanlight: true });
    marquee(m, -9, 9, 21.4, 1, 9.4, 2.4);
    flags(m, -20, 20, 22.5, 9.0, 5, 7.5);
  }
  return m;
}

// ----------------------------------------------------------------- 5. exchange

/**
 * A trading tower: two cores flanking a full-height glazed atrium.
 *
 * The trading-floor building. It has to hold a column-free floor the size of a
 * pitch, so the structure goes to the outside and the two cores go to the
 * ends, and the space between them is left as an atrium the whole height of
 * the building. Externally that is a diagrid: a lattice of braces on the face,
 * which is the one facade nothing else here has.
 */
function exchangeTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 30.0, hz = 17.0, floorH = 4.0, floors = 24;
  const base = 14.0;
  const top = base + floors * floorH;

  forecourt(m, -42, -34, 42, 34, 8807, { trees: 6, lamps: 8, people: 11, benches: 3 });
  // The trading hall: a two-storey podium with a deep glazed wall.
  m.box([-hx - 4, 0.1, -hz - 4], [hx + 4, base, hz + 4], MAT.CONCRETE, { roof: MAT.ROOF });
  if (medium) {
    m.box([-hx - 2, 1.4, -hz - 4.4], [hx + 2, base - 1.6, hz + 4.4], MAT.GLASS);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 12; i++) {
        const x = -hx - 2 + (i / 12) * (hx + 2) * 2;
        m.box([x - 0.2, 1.0, -hz - 4.6], [x + 0.2, base - 1.4, -hz - 4.2], MAT.TRIM);
        m.box([x - 0.2, 1.0, hz + 4.2], [x + 0.2, base - 1.4, hz + 4.6], MAT.TRIM);
      }
      m.box([-hx - 4.4, base - 1.6, -hz - 4.4], [hx + 4.4, base - 0.8, hz + 4.4], MAT.TRIM);
    });
  }

  // Two cores in solid stone, the atrium glazed between them.
  for (const s of [-1, 1]) {
    m.box([s * hx - s * 9.0, base, -hz], [s * hx, top + 6.0, hz], MAT.CONCRETE, { roof: MAT.ROOF });
    if (medium) {
      m.painted(TINT.METAL_DARK, () => {
        for (let f = 0; f < floors; f += 3) {
          m.box([s * hx - s * 9.2, base + f * floorH + 1.0, -hz - 0.3],
                [s * hx + s * 0.2, base + f * floorH + 2.6, hz + 0.3], MAT.TRIM);
        }
      });
      m.box([s * hx - s * 7.5, base + 2.0, -hz - 0.3], [s * hx - s * 1.5, top, -hz + 0.2], MAT.GLASS);
      m.box([s * hx - s * 7.5, base + 2.0, hz - 0.2], [s * hx - s * 1.5, top, hz + 0.3], MAT.GLASS);
    }
  }
  const ax = hx - 9.0;
  m.box([-ax, base, -hz], [ax, top, hz], MAT.GLASS);
  if (medium) {
    curtain(m, -ax, -hz, ax, hz, base, floors, floorH, { mullions: 5.2, band: 0.34 });
    // The diagrid: braces across four floors at a time, both long faces.
    m.painted(TINT.METAL_DARK, () => {
      const rise = floorH * 4;
      for (let f = 0; f + 4 <= floors; f += 4) {
        const y0 = base + f * floorH, y1 = y0 + rise;
        for (let i = 0; i < 5; i++) {
          const a = -ax + (i / 5) * ax * 2, b = -ax + ((i + 1) / 5) * ax * 2;
          for (const pz of [-hz - 0.5, hz + 0.5]) {
            m.pipe([a, y0, pz], [b, y1, pz], 0.34, MAT.TRIM, 4);
            m.pipe([b, y0, pz], [a, y1, pz], 0.34, MAT.TRIM, 4);
          }
        }
      }
    });
    // The atrium roof: a shallow glazed pyramid between the cores.
    const lid = plan(ax, hz, 0.02, 4);
    shelf(m, scaled(lid, 0.98), scaled(lid, 1.05), top, top + 1.0, MAT.CONCRETE);
    m.cone(0, 0, Math.min(ax, hz) * 1.02, 1.5, top + 1.0, top + 9.0, 4, MAT.GLASS);
    cap(m, plan(2.0, 2.0, 0.02, 4), top + 9.0, MAT.METAL);
    m.painted(TINT.SIGN_LIT, () => m.box([-2.0, top + 9.0, -2.0], [2.0, top + 11.4, 2.0], MAT.PLATE));
  }
  if (fine) {
    for (const s of [-1, 1]) {
      parapet(m, s * hx - s * 9.0, -hz, s * hx, hz, top + 6.0, 1.0, 0.3, MAT.CONCRETE);
      roofClutter(m, s * hx - s * 8.0, -hz + 2, s * hx - s * 1.0, hz - 2, top + 6.0, 67 + s, 0.5);
    }
    porteCochere(m, -12, 12, hz + 4.4, 7.0, 8.4, 4);
    marquee(m, -14, 14, hz + 4.6, 1, base + 0.4, 2.8);
    flags(m, -26, 26, hz + 12.0, 0.2, 7, 10.0);
    for (const s of [-1, 1]) planter(m, s * 26, hz + 8.0, 2.6, 0.75);
  }
  return m;
}

// ====================================================================== table

const desks = (jobs: number, upkeep: number, power: number): AssetDef['sim'] => ({
  jobs, powerKW: power, waterM3: jobs * 0.32, garbagePerWeek: jobs * 7,
  pollution: 0, upkeep,
});

export const SIGNATURE_OFFICE: AssetDef[] = [
  {
    id: 'sig.off.supertall', name: 'Ardent Tower', zone: 'office', density: 'high',
    variant: 'sculpted', theme: 'modern', signature: true, footprint: [12, 11], height: 0,
    brand: { name: 'Ardent', colour: [0.16, 0.26, 0.40], accent: [0.72, 0.62, 0.30], sign: 'box' },
    sim: desks(2600, 3400, 5200),
    note: 'Sixty-two storeys on a nine-square plan that loses its corners, then its sides: three curtain-walled stages with a railed terrace at each setback, a colonnaded stone base and a thirty-four metre mast.',
    build: supertall,
  },
  {
    id: 'sig.off.prism', name: 'The Prism', zone: 'office', density: 'high',
    variant: 'sculpted', theme: 'modern', signature: true, footprint: [11, 10], height: 0,
    brand: { name: 'Prism', colour: [0.14, 0.32, 0.44], accent: [0.66, 0.70, 0.74], sign: 'box' },
    sim: desks(1900, 2500, 3900),
    note: 'A twenty-seven storey equilateral prism with a full-height fin on each corner, cut off on the diagonal under a raked glass roof that carries one corner fourteen metres higher than the other two.',
    build: prismTower,
  },
  {
    id: 'sig.off.hq', name: 'Vance Group HQ', zone: 'office', density: 'high',
    variant: 'sculpted', theme: 'modern', signature: true, footprint: [14, 11], height: 0,
    brand: { name: 'Vance Group', colour: [0.18, 0.30, 0.34], accent: [0.70, 0.58, 0.24], sign: 'box' },
    sim: desks(1400, 2100, 3000),
    note: 'A nine-storey glass slab bent into a shallow arc on a stone podium, with a horizontal brise-soleil on the outer face, a glazed entrance pavilion under a canopy, and a garden and flag line in front.',
    build: corporateHq,
  },
  {
    id: 'sig.off.deco', name: 'The Corvid Building', zone: 'office', density: 'high',
    variant: 'sculpted', theme: 'american', signature: true, footprint: [9, 8], height: 0,
    brand: { name: 'Corvid', colour: [0.24, 0.18, 0.22], accent: [0.74, 0.60, 0.22], sign: 'box' },
    sim: desks(1200, 1900, 2400),
    note: 'A stepped masonry skyscraper: a stone base with an arched entrance bay, five brick stages of deep continuous piers with a chevron frieze at every setback, and a crown of five diminishing tiers under a lit lantern and spire.',
    build: decoTower,
  },
  {
    id: 'sig.off.exchange', name: 'The Exchange', zone: 'office', density: 'high',
    variant: 'sculpted', theme: 'modern', signature: true, footprint: [11, 10], height: 0,
    brand: { name: 'The Exchange', colour: [0.20, 0.22, 0.30], accent: [0.72, 0.52, 0.16], sign: 'box' },
    sim: desks(2100, 2800, 4600),
    note: 'Two concrete cores flanking a twenty-four storey glazed atrium under a pyramid roof, braced by a four-storey diagrid on both long faces, over a two-storey trading hall glazed all the way round.',
    build: exchangeTower,
  },
];
