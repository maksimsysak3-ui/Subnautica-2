/**
 * Signature offices: two in each theme, and they are meant to be big.
 *
 * An office tower is the hardest thing in this library to make distinctive,
 * because the programme is identical every time -- a core, a floor plate, a
 * skin -- and the honest answer is that a tower is distinguished by exactly
 * three things: its plan, what happens where it meets the ground, and what
 * happens where it stops. So no two of these ten share a plan, and none of
 * them is distinguished by being taller than the last.
 *
 * Each theme gets a tower and a headquarters, and the pair is regional rather
 * than translated: the American tower is a zoning-envelope masonry skyscraper
 * and its headquarters is a trading floor with a diagrid round it; the
 * European pair is a stone chancery and a quadrangle round a glazed court; the
 * East Asian pair is a sky-garden shaft and two towers on a skybridge; the
 * farming pair is a grain exchange and a research campus with glasshouses.
 * None of them would be recognisable as any of the others re-skinned.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import { THEME_ORDER } from '../themes';
import type { Theme } from '../themes';
import {
  barrelVault, cap, conveyor, crownStack, curtain, flags, forecourt, lattice,
  loft, marquee, pierWall, plan, porteCochere, sawtooth, scaled, shelf, silo,
} from './signature-parts';
import { band, entrance, parapet, planter, railing, roofClutter } from '../parts';
import { tree, hedge, bench } from './landscape';
import { figure } from './vehicles';

// ================================================================ 1. modern

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

  /**
   * A stage of the shaft.
   *
   * Glass between expressed slab edges is what a tower is made of, and on its
   * own it is also what makes one indistinguishable from the next at the
   * distance a city is actually looked at. So each stage carries three things
   * beyond its skin: fins on the module lines deep enough to throw a shadow
   * down the whole face, a banded mechanical storey where the plant is, and a
   * belt of structure at the setback. Those are the parts of a tall building
   * that read from a kilometre away.
   */
  const shaft = (h: number, d: number, y: number, n: number, lobby: number): number => {
    const top = y + n * floorH;
    m.box([-h, y, -d], [h, top, d], MAT.GLASS);
    if (medium) {
      curtain(m, -h, -d, h, d, y, n, floorH, { mullions: 4.2 });
      // The fins are left the cladding's own colour rather than tinted dark.
      // A dark fin on dark glass is a fin nobody sees: the whole point of
      // carrying structure outside the skin is that it stripes the tower, and
      // it only stripes it if it is lighter than what it stands on.
      m.painted(TINT.NONE, () => {
        // Fins on the module lines, carried past the head of the stage so the
        // silhouette is toothed rather than cut flat.
        for (const [a, b, along] of [[h, d, 'x'], [d, h, 'z']] as const) {
          const n2 = Math.max(2, Math.round(a / 4.0));
          for (let i = 0; i <= n2; i++) {
            const u = -a + (i / n2) * 2 * a;
            for (const sgn of [-1, 1]) {
              if (along === 'x') {
                m.box([u - 0.45, y, sgn > 0 ? b - 0.05 : -b - 0.7],
                      [u + 0.45, top + 1.8, sgn > 0 ? b + 0.7 : -b + 0.05], MAT.STONE);
              } else {
                m.box([sgn > 0 ? b - 0.05 : -b - 0.7, y, u - 0.45],
                      [sgn > 0 ? b + 0.7 : -b + 0.05, top + 1.8, u + 0.45], MAT.STONE);
              }
            }
          }
        }
      });
      // The mechanical floor: two solid storeys, louvred, standing proud.
      m.painted(TINT.METAL_DARK, () => {
        const ly = y + lobby * floorH;
        m.box([-h - 0.4, ly, -d - 0.4], [h + 0.4, ly + 2 * floorH, d + 0.4], MAT.CLADDING);
      });
      if (fine) {
        const ly = y + lobby * floorH;
        m.painted(TINT.NONE, () => {
          for (let k = 0; k < 5; k++) {
            const yy = ly + 0.7 + k * ((2 * floorH - 1.4) / 5);
            m.box([-h - 0.55, yy, -d - 0.55], [h + 0.55, yy + 0.14, d + 0.55], MAT.TRIM);
          }
        });
      }
    }
    return top;
  };

  /** The terrace a setback leaves, and the belt of structure under it. */
  const setback = (h: number, d: number, y: number): number => {
    if (medium) {
      shelf(m, plan(h * 0.99, d * 0.99, 0.02, 4), plan(h + 2.2, d + 2.2, 0.02, 4), y, y + 1.4, MAT.CONCRETE);
      m.painted(TINT.METAL_DARK, () => {
        m.box([-h - 0.9, y - 2.2, -d - 0.9], [h + 0.9, y, d + 0.9], MAT.CLADDING);
      });
    }
    if (fine) {
      railing(m, -h - 2.0, h + 2.0, d + 2.0, y + 1.4, 1.05, 2.6);
      railing(m, -h - 2.0, h + 2.0, -d - 2.0, y + 1.4, 1.05, 2.6);
      m.painted(TINT.GREEN, () => m.box([-h + 1, y + 1.4, -d + 1], [h - 1, y + 1.7, d - 1], MAT.TRIM));
    }
    return y + 1.4;
  };

  // Nine squares at the base; the four corners go, leaving a cross; then the
  // arms go too and one square carries the crown. The plan is the design, and
  // it is why the silhouette is still legible at forty pixels tall.
  let y = 13.4;
  y = setback(q * 1.5, q * 1.5, shaft(q * 1.5, q * 1.5, y, 22, 11));
  // The cross: two bars across the same centre, so the corners of the stage
  // below are left as terraces on all four sides rather than a single ledge.
  const arm = q * 1.5, wide = q * 0.62;
  const crossTop = shaft(arm, wide, y, 20, 10);
  shaft(wide, arm, y, 20, 10);
  if (fine) {
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      m.painted(TINT.GREEN, () => {
        m.box([sx > 0 ? wide + 0.6 : -arm, y, sz > 0 ? wide + 0.6 : -arm],
              [sx > 0 ? arm : -wide - 0.6, y + 0.3, sz > 0 ? arm : -wide - 0.6], MAT.TRIM);
      });
    }
  }
  y = setback(arm, arm, crossTop);
  y = setback(q * 0.85, q * 0.85, shaft(q * 0.85, q * 0.85, y, 16, 8));
  if (medium) {
    // The crown: a lantern of four diminishing glazed tiers, then the mast.
    for (let k = 0; k < 4; k++) {
      const h = q * (0.85 - k * 0.16);
      m.box([-h, y, -h], [h, y + 5.4, h], MAT.GLASS);
      m.painted(TINT.SIGN_LIT, () => {
        m.box([-h - 0.5, y + 5.4, -h - 0.5], [h + 0.5, y + 6.2, h + 0.5], MAT.CLADDING);
      });
      y += 6.2;
    }
    crownStack(m, q * 0.2, q * 0.2, y, 3, MAT.CLADDING, { mast: 30, taper: 0.75 });
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

/**
 * A corporate headquarters: a curved glass slab on a landscaped podium.
 *
 * Low, wide and out of town rather than tall and downtown, which is what half
 * the world's biggest companies actually build. The plan is a shallow arc, so
 * the building has no flat elevation anywhere, and what it stands on is a
 * garden rather than a car park.
 */
function corporateHq(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const floors = 9, floorH = 4.0, base = 5.5;
  const R = 96.0, span = 1.05, depth = 17.0;
  const top = base + floors * floorH;
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

  forecourt(m, -56, -44, 56, 30, 6607, { trees: 10, lamps: 8, people: 9, benches: 4 });
  for (let i = 0; i < N; i++) {
    const a = outer[i], b = outer[i + 1], c = inner[i], d = inner[i + 1];
    m.quad([a[0], base, a[1]], [b[0], base, b[1]], [d[0], base, d[1]], [c[0], base, c[1]], MAT.ROOF);
    m.quad([b[0], 0.1, b[1]], [a[0], 0.1, a[1]], [a[0], base, a[1]], [b[0], base, b[1]], MAT.STONE);
    m.quad([c[0], 0.1, c[1]], [d[0], 0.1, d[1]], [d[0], base, d[1]], [c[0], base, c[1]], MAT.STONE);
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
            const a = r[i], b = r[i + 1], o = r === outer ? 0.3 : -0.3;
            m.quad([b[0], y - 0.28, b[1] + o], [a[0], y - 0.28, a[1] + o],
                   [a[0], y + 0.28, a[1] + o], [b[0], y + 0.28, b[1] + o], MAT.TRIM);
          }
        }
      }
      for (let i = 0; i <= N; i++) {
        const a = outer[i];
        m.pipe([a[0], base, a[1] + 0.4], [a[0], top + 2.4, a[1] + 0.4], 0.28, MAT.TRIM, 4);
      }
    });
    // A brise-soleil on the outer face: what a west-facing glass arc needs.
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

// ============================================================== 2. european

/**
 * A stone chancery: a masonry tower with a clock stage and a copper roof.
 *
 * The European tall building is a civic object rather than a commercial one --
 * it is stone to the top, it has a public storey at the bottom you can walk
 * through, and it finishes in a roof rather than in a mast. So this one is
 * built out of arcading and cornices, has an arched loggia at ground level,
 * and puts a four-faced clock and a copper spire where the American one puts
 * an aerial.
 */
function chanceryTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const floorH = 3.8;
  const hx = 17.0, hz = 15.0;
  const base = 11.0;

  forecourt(m, -34, -30, 34, 30, 5099, { trees: 6, lamps: 7, people: 9, benches: 4 });
  // The loggia: an arcade you can see through, round the whole base.
  m.box([-hx - 3.5, 0.1, -hz - 3.5], [hx + 3.5, base, hz + 3.5], MAT.STONE, { roof: MAT.ROOF });
  m.box([-hx - 2.2, 0.4, -hz - 2.2], [hx + 2.2, base - 1.6, hz + 2.2], MAT.DARK_TRIM);
  if (medium) {
    m.painted(TINT.NONE, () => {
      for (let i = 0; i <= 9; i++) {
        const u = -hx - 3.5 + (i / 9) * (hx + 3.5) * 2;
        m.box([u - 1.0, 0.1, -hz - 3.6], [u + 1.0, base, -hz - 1.6], MAT.STONE);
        m.box([u - 1.0, 0.1, hz + 1.6], [u + 1.0, base, hz + 3.6], MAT.STONE);
      }
      for (let i = 0; i <= 8; i++) {
        const u = -hz - 3.5 + (i / 8) * (hz + 3.5) * 2;
        m.box([-hx - 3.6, 0.1, u - 1.0], [-hx - 1.6, base, u + 1.0], MAT.STONE);
        m.box([hx + 1.6, 0.1, u - 1.0], [hx + 3.6, base, u + 1.0], MAT.STONE);
      }
    });
    band(m, -hx - 3.5, -hz - 3.5, hx + 3.5, hz + 3.5, base - 1.6, 1.6, 0.9, MAT.STONE);
  }

  // Two shafts, not one. A twenty-storey block with a hat on it is an office
  // building; what makes a stone tower read as a tower is that it steps in
  // once on the way up, so the piers of the upper shaft land on the cornice of
  // the lower and the whole thing has a waist. It also takes it half as tall
  // again, which is the other half of what the silhouette needs.
  pierWall(m, -hx, -hz, hx, hz, base, 22, floorH, MAT.STONE,
    { bays: 6, glass: MAT.PANE, windows: medium, strips: true, depth: 0.5 });
  let y = base + 22 * floorH;
  const ux = hx * 0.76, uz = hz * 0.76;
  if (medium) {
    band(m, -hx, -hz, hx, hz, y, 1.6, 1.1, MAT.STONE);
    // The setback: a balustraded terrace where the lower shaft stops, with an
    // urn on each corner -- the one place a stone tower is allowed ornament.
    shelf(m, plan(ux * 1.02, uz * 1.02, 0.02, 4), plan(hx + 1.0, hz + 1.0, 0.02, 4), y, y + 1.0, MAT.STONE);
    if (fine) {
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        m.cylinder(sx * (hx - 1.2), sz * (hz - 1.2), 0.9, y + 1.0, y + 3.4, 8, MAT.STONE, true);
      }
      railing(m, -hx + 0.6, hx - 0.6, hz - 0.6, y + 1.0, 1.1, 2.4);
      railing(m, -hx + 0.6, hx - 0.6, -hz + 0.6, y + 1.0, 1.1, 2.4);
    }
  }
  y += 1.6;
  pierWall(m, -ux, -uz, ux, uz, y, 14, floorH, MAT.STONE,
    { bays: 5, glass: MAT.PANE, windows: medium, strips: true, depth: 0.45 });
  y += 14 * floorH;
  if (medium) {
    band(m, -ux, -uz, ux, uz, y, 1.4, 1.0, MAT.STONE);
    y += 1.4;
    // The clock stage: a set-back drum with four faces and a colonnade.
    const N = 16;
    const drum = plan(ux * 0.86, uz * 0.86, 0.9, N);
    loft(m, drum, drum, y, y + 9.0, MAT.STONE);
    m.painted(TINT.NONE, () => {
      for (let i = 0; i < N; i++) {
        const p = scaled(drum, 1.1)[i];
        m.cylinder(p[0], p[1], 0.4, y, y + 8.2, 6, MAT.STONE, false);
      }
    });
    m.painted(TINT.SIGN_LIT, () => {
      for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        m.cylinder(ax * ux * 0.88, az * uz * 0.88, 2.6, y + 2.6, y + 2.8, 14, MAT.PLATE, true);
      }
    });
    shelf(m, scaled(drum, 1.0), scaled(drum, 1.22), y + 9.0, y + 10.2, MAT.STONE);
    // A copper spire in three stages with a weathervane.
    m.cone(0, 0, ux * 0.94, ux * 0.6, y + 10.2, y + 17.0, N, MAT.METAL);
    m.cone(0, 0, ux * 0.6, ux * 0.26, y + 17.0, y + 26.0, N, MAT.METAL);
    m.cone(0, 0, ux * 0.26, 0.0, y + 26.0, y + 34.0, N, MAT.METAL);
    m.painted(TINT.METAL_DARK, () => m.cylinder(0, 0, 0.18, y + 34.0, y + 40.0, 5, MAT.TRIM, false));
    m.painted(TINT.ACCENT, () => m.box([0.1, y + 37.6, -0.04], [2.2, y + 39.2, 0.04], MAT.TRIM));
  }
  if (fine) {
    entrance(m, { axis: 'z', sign: 1, plane: hz + 3.5 }, 0,
      { width: 4.6, height: 6.6, double: true, glazed: true, fanlight: true });
    marquee(m, -7, 7, hz + 3.8, 1, base + 0.2, 2.0);
    flags(m, -14, 14, hz + 6.0, base, 3, 7.0);
    for (const sx of [-24, 24]) tree(m, sx, hz + 12, 9.0, 3.2);
    for (let i = 0; i < 6; i++) figure(m, 1810 + i * 13, -12 + i * 4.4, hz + 6.8, Math.PI, { stride: 0.22 });
  }
  return m;
}

/**
 * A quadrangle: four stone ranges round a glazed court.
 *
 * The European headquarters is a block with a hole in it, and the hole is
 * roofed. That single move gives it everything a tower gets from height --
 * a public interior, a front door that means something, a section worth
 * looking at -- at six storeys, which is what a European city will actually
 * let anyone build.
 */
function quadrangleHq(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 42.0, hz = 30.0, depth = 15.0, floorH = 4.2, floors = 6;
  const top = 1.0 + floors * floorH;

  forecourt(m, -52, -40, 52, 40, 4241, { trees: 8, lamps: 8, people: 10, benches: 4 });
  const ranges: Array<[number, number, number, number]> = [
    [-hx, -hz, hx, -hz + depth], [-hx, hz - depth, hx, hz],
    [-hx, -hz + depth, -hx + depth, hz - depth], [hx - depth, -hz + depth, hx, hz - depth],
  ];
  for (const [x0, z0, x1, z1] of ranges) {
    m.box([x0, 0.1, z0], [x1, 1.0, z1], MAT.STONE);
    m.box([x0, 1.0, z0], [x1, top, z1], MAT.STONE, { roof: MAT.ROOF });
    if (medium) {
      band(m, x0, z0, x1, z1, top - 1.2, 1.2, 0.75, MAT.STONE);
      // A mansard with dormers over each range.
      m.cone((x0 + x1) / 2, (z0 + z1) / 2, 1.0, 0.86, top + 1.2, top + 5.4, 4, MAT.ROOF_TILE);
    }
    if (fine) parapet(m, x0, z0, x1, z1, top, 1.0, 0.3, MAT.STONE);
  }
  if (medium) {
    // Stone piers and glazing on every elevation, inside and out.
    for (const [axis, sign, pln, a, b] of [
      ['z', -1, -hz, -hx + 2, hx - 2], ['z', 1, hz, -hx + 2, hx - 2],
      ['x', -1, -hx, -hz + 2, hz - 2], ['x', 1, hx, -hz + 2, hz - 2],
      ['z', 1, -hz + depth, -hx + depth + 2, hx - depth - 2],
      ['z', -1, hz - depth, -hx + depth + 2, hx - depth - 2],
    ] as const) {
      for (let f = 0; f < floors; f++) {
        m.windowRow({
          axis, sign, plane: pln, from: a, to: b, y0: 1.0 + f * floorH + 0.9, y1: 1.0 + (f + 1) * floorH - 1.0,
          count: Math.max(3, Math.round((b - a) / 5.0)), width: 2.6,
          glass: MAT.PANE, frame: 0.16, proud: 0.1,
        });
      }
    }
    // The court, roofed: a shallow glazed vault the length of it.
    barrelVault(m, -hx + depth, -hz + depth, hx - depth, hz - depth, top - 6.0, 7.0, 9, { ribs: 9 });
  }
  if (fine) {
    // The entrance: a pedimented centrepiece with a giant order.
    m.box([-9.0, 0.1, hz], [9.0, top + 2.4, hz + 2.4], MAT.STONE);
    m.painted(TINT.NONE, () => {
      for (const sx of [-7.4, -3.0, 3.0, 7.4]) m.cylinder(sx, hz + 1.6, 0.85, 1.0, top - 4.0, 10, MAT.STONE, false);
      m.box([-9.4, top - 4.0, hz - 0.2], [9.4, top - 2.2, hz + 3.0], MAT.STONE);
    });
    m.gable([-9.4, top - 2.2, hz - 0.2], [9.4, top - 2.2, hz + 3.0], 3.2, 'x', MAT.STONE, MAT.STONE);
    entrance(m, { axis: 'z', sign: 1, plane: hz + 2.4 }, 0,
      { width: 4.6, height: 6.0, double: true, glazed: true, fanlight: true });
    // The court floor: paving, planting, and people crossing it.
    m.painted(TINT.NONE, () => m.box([-hx + depth, 0.1, -hz + depth], [hx - depth, 0.26, hz - depth], MAT.STONE));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) tree(m, sx * 14, sz * 6, 8.0, 2.8);
    for (let i = 0; i < 4; i++) bench(m, -12 + i * 8, 0, 0);
    for (let i = 0; i < 8; i++) figure(m, 2410 + i * 11, -20 + i * 5.4, (i % 3 - 1) * 4.0, 0.5 * i, { stride: 0.22 });
    flags(m, -20, 20, hz + 5.0, 0.2, 5, 9.0);
    roofClutter(m, -hx + 3, -hz + 3, -hx + 14, hz - 3, top, 59, 0.4);
  }
  return m;
}

// ============================================================== 3. american

/**
 * A stepped 1930s skyscraper: masonry, five setbacks, a crown of tiers.
 *
 * The zoning-envelope tower, and the reason a pre-war downtown looks the way
 * it does. Drawn as masonry the whole way up -- deep continuous piers, a
 * recessed spandrel, no expressed floor line -- which is the opposite of
 * everything else here and reads as age from a very long way off.
 */
function decoTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const floorH = 3.6;

  forecourt(m, -36, -32, 36, 32, 3701, { trees: 6, lamps: 6, people: 9, benches: 3 });
  // Five stages, and each of them a real number of storeys.
  //
  // The zoning envelope this shape comes from bought height by giving up plan,
  // and a tower that steps five times in thirty-three floors has given up the
  // plan without taking the height -- it reads as a wedding cake rather than a
  // skyscraper. Fifty-five storeys is what the shape is for, and the lower
  // stages carry most of them, which is also what makes the taper look like a
  // consequence of the setback rule rather than a decision about proportion.
  const stages: Array<[number, number, number]> = [
    [24.0, 20.0, 14], [20.0, 16.5, 12], [16.0, 13.0, 11], [12.0, 10.0, 10], [8.0, 7.0, 8],
  ];
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
  let y = 10.4;
  for (const [hx, hz, n] of stages) {
    pierWall(m, -hx, -hz, hx, hz, y, n, floorH, MAT.BRICK,
      { bays: Math.max(3, Math.round(hx / 3.2)), glass: MAT.PANE, windows: medium, depth: 0.42, strips: true });
    y += n * floorH;
    if (medium) {
      band(m, -hx, -hz, hx, hz, y, 1.0, 0.85, MAT.STONE);
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

/**
 * A trading tower: two cores flanking a full-height glazed atrium.
 *
 * The trading-floor building. It has to hold a column-free floor the size of a
 * pitch, so the structure goes to the outside and the two cores go to the
 * ends, and the space between them is left as an atrium the whole height of
 * the building. Externally that is a diagrid -- a lattice of braces on the
 * face -- which is a facade nothing else here has.
 */
function exchangeTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 30.0, hz = 17.0, floorH = 4.0, floors = 24;
  const base = 14.0;
  const top = base + floors * floorH;

  forecourt(m, -42, -34, 42, 34, 8807, { trees: 6, lamps: 8, people: 11, benches: 3 });
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

// ================================================================= 4. asian

/**
 * A sky-garden tower: a glass shaft with three storeys cut out of it, twice.
 *
 * The move that defines the type: instead of ending in a crown, the tower
 * gives up floor area in the middle and lets you see daylight through it.
 * Structurally the two voids are where the transfer floors go, and visually
 * they are the only thing that makes a two-hundred-metre glass shaft anything
 * other than a two-hundred-metre glass shaft.
 */
function skyGardenTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 15.0, hz = 15.0, floorH = 3.8;
  const base = 14.0;
  //: [start floor, floors] of each void.
  //
  // Three gardens rather than two, and fifty-eight storeys rather than
  // forty-four. The void cut through the shaft is this tower's whole idea, and
  // the idea reads better the more times it happens on the way up -- it turns
  // the shaft into four stacked blocks instead of a slab with two notches.
  const voids: Array<[number, number]> = [[13, 3], [28, 3], [43, 3]];
  const floors = 58;
  const top = base + floors * floorH;

  forecourt(m, -38, -34, 38, 34, 7013, { trees: 7, lamps: 8, people: 10, benches: 4 });
  // A deep podium with a tiled canopy over it, which is what these stand on.
  m.box([-30, 0.1, -26], [30, base, 26], MAT.TILE, { roof: MAT.ROOF });
  if (medium) {
    m.box([-28, 1.0, -26.4], [28, base - 2.4, 26.4], MAT.GLASS);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 14; i++) {
        const x = -28 + (i / 14) * 56;
        m.box([x - 0.22, 0.6, -26.7], [x + 0.22, base - 2.2, -26.2], MAT.TRIM);
        m.box([x - 0.22, 0.6, 26.2], [x + 0.22, base - 2.2, 26.7], MAT.TRIM);
      }
    });
    m.cone(0, 0, 1.0, 0.88, base, base + 3.4, 4, MAT.ROOF_TILE);
    m.painted(TINT.BRAND, () => band(m, -30, -26, 30, 26, base - 2.4, 2.0, 0.6, MAT.CLADDING));
  }

  const inVoid = (f: number): boolean => voids.some(([a, n]) => f >= a && f < a + n);
  for (let f = 0; f < floors; f++) {
    const y = base + 3.4 + f * floorH;
    if (inVoid(f)) {
      // The void: the two cores carry through it and nothing else does.
      for (const s of [-1, 1]) {
        m.box([s * hx - s * 5.0, y, -5.0], [s * hx, y + floorH, 5.0], MAT.CONCRETE);
      }
      if (fine) {
        m.painted(TINT.GREEN, () => m.box([-hx + 5.4, y, -hz + 1], [hx - 5.4, y + 0.6, hz - 1], MAT.TRIM));
        railing(m, -hx, hx, hz - 0.4, y + 0.6, 1.05, 2.6);
        railing(m, -hx, hx, -hz + 0.4, y + 0.6, 1.05, 2.6);
      }
      continue;
    }
    m.box([-hx, y, -hz], [hx, y + floorH, hz], MAT.GLASS);
  }
  if (medium) {
    m.painted(TINT.METAL_DARK, () => {
      for (let f = 0; f <= floors; f++) {
        if (inVoid(f) || inVoid(f - 1)) continue;
        const y = base + 3.4 + f * floorH;
        m.box([-hx - 0.2, y - 0.28, -hz - 0.2], [hx + 0.2, y + 0.28, hz + 0.2], MAT.TRIM);
      }
      // Four corner columns full height, which is what carries the voids.
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        m.box([sx * hx - sx * 1.4, base, sz * hz - sz * 1.4],
              [sx * hx + sx * 0.35, top + 6.0, sz * hz + sz * 0.35], MAT.CLADDING);
      }
    });
    // A tiered crown: three tiled hips, diminishing, on a set-back attic.
    m.box([-hx * 0.8, top, -hz * 0.8], [hx * 0.8, top + 4.0, hz * 0.8], MAT.PLASTER, { roof: MAT.ROOF });
    for (let k = 0; k < 3; k++) {
      const r = hx * (1.0 - k * 0.22), y0 = top + 4.0 + k * 5.0;
      m.cone(0, 0, r, r * 0.62, y0, y0 + 3.2, 12, MAT.ROOF_TILE);
      m.cylinder(0, 0, r * 0.62, y0 + 3.2, y0 + 5.0, 12, MAT.PLASTER, false);
    }
    m.cone(0, 0, hx * 0.36, 0.0, top + 19.0, top + 26.0, 12, MAT.ROOF_TILE);
    m.painted(TINT.ACCENT, () => m.cylinder(0, 0, 0.6, top + 26.0, top + 29.0, 6, MAT.TRIM, true));
  }
  if (fine) {
    porteCochere(m, -12, 12, 26.4, 7.0, 8.0, 4);
    marquee(m, -16, 16, 26.6, 1, base - 1.6, 2.6);
    flags(m, -26, 26, 30.0, 0.2, 7, 9.0);
    for (const s of [-1, 1]) planter(m, s * 24, 30.0, 2.4, 0.7);
    roofClutter(m, -12, -12, 12, 12, top + 4.0, 73, 0.3);
  }
  return m;
}

/**
 * Two towers on a shared podium, tied by a skybridge.
 *
 * The pair is the point: one tower of the same floor area is a stick, and two
 * of three-quarters the width read as a gateway from every direction but one.
 * The bridge is what makes them one building rather than two, and it goes two
 * thirds up, clear of the podium and under the crowns.
 */
function twinTowers(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const floorH = 3.9, floors = 36;
  const hx = 10.5, hz = 13.0, gap = 19.0;
  const base = 10.0;
  const top = base + floors * floorH;

  forecourt(m, -50, -36, 50, 36, 4211, { trees: 8, lamps: 8, people: 11, benches: 4 });
  m.box([-44, 0.1, -22], [44, base, 22], MAT.TILE, { roof: MAT.ROOF });
  if (medium) {
    m.box([-42, 1.0, -22.4], [42, base - 2.2, 22.4], MAT.GLASS);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 18; i++) {
        const x = -42 + (i / 18) * 84;
        m.box([x - 0.22, 0.6, -22.7], [x + 0.22, base - 2.0, -22.2], MAT.TRIM);
        m.box([x - 0.22, 0.6, 22.2], [x + 0.22, base - 2.0, 22.7], MAT.TRIM);
      }
    });
    m.painted(TINT.BRAND, () => band(m, -44, -22, 44, 22, base - 2.2, 1.8, 0.55, MAT.CLADDING));
    parapet(m, -44, -22, 44, 22, base, 1.0, 0.25, MAT.CONCRETE);
  }
  for (const s of [-1, 1]) {
    const cx = s * (gap / 2 + hx);
    m.box([cx - hx, base, -hz], [cx + hx, top, hz], MAT.GLASS);
    if (medium) {
      curtain(m, cx - hx, -hz, cx + hx, hz, base, floors, floorH, { mullions: 3.4 });
      // The core expressed as a solid slab on the inner face.
      m.box([cx - hx * 0.34, base, -hz - 0.5], [cx + hx * 0.34, top + 3.0, -hz + 0.4], MAT.CLADDING);
      m.painted(TINT.BRAND, () => {
        m.box([cx - hx * 0.3, base, -hz - 0.62], [cx + hx * 0.3, top, -hz - 0.52], MAT.CLADDING);
      });
      // A tiered cap, which is what makes these a pair of Asian towers rather
      // than a pair of anonymous ones.
      m.placed(cx, 0, 0, () => {
        for (let k = 0; k < 3; k++) {
          const r = hx * (1.0 - k * 0.2), y0 = top + k * 4.4;
          m.cone(0, 0, r, r * 0.66, y0, y0 + 2.8, 10, MAT.ROOF_TILE);
          m.cylinder(0, 0, r * 0.66, y0 + 2.8, y0 + 4.4, 10, MAT.CLADDING, false);
        }
        m.painted(TINT.METAL_DARK, () => {
          m.cylinder(0, 0, 0.4, top + 13.2, top + 24.0, 6, MAT.TRIM, false);
          m.cylinder(0, 0, 0.16, top + 24.0, top + 34.0, 5, MAT.TRIM, false);
        });
        m.painted(TINT.SIGN_LIT, () => m.box([-0.5, top + 18.0, -0.5], [0.5, top + 18.8, 0.5], MAT.LAMP));
      });
    }
  }
  if (medium) {
    const y = base + floors * floorH * 0.62;
    m.box([-gap / 2 - 1, y, -6.0], [gap / 2 + 1, y + 8.0, 6.0], MAT.GLASS);
    m.painted(TINT.METAL_DARK, () => {
      m.box([-gap / 2 - 1.4, y - 0.8, -6.4], [gap / 2 + 1.4, y, 6.4], MAT.TRIM, { skipBottom: false });
      m.box([-gap / 2 - 1.4, y + 8.0, -6.4], [gap / 2 + 1.4, y + 8.8, 6.4], MAT.TRIM);
      for (let i = 0; i <= 5; i++) {
        const x = -gap / 2 + (i / 5) * gap;
        m.box([x - 0.14, y, -6.5], [x + 0.14, y + 8.0, -6.35], MAT.TRIM);
        m.box([x - 0.14, y, 6.35], [x + 0.14, y + 8.0, 6.5], MAT.TRIM);
      }
      // Two raking props under the bridge, off each tower.
      for (const s of [-1, 1]) {
        m.pipe([s * gap / 2, y - 0.8, 0], [s * (gap / 2 + hx * 0.8), y - 14.0, 0], 0.5, MAT.TRIM, 5);
      }
    });
  }
  if (fine) {
    porteCochere(m, -11, 11, 22.4, 7.0, 7.0, 4);
    marquee(m, -18, 18, 22.6, 1, base - 1.4, 2.6);
    flags(m, -36, 36, 26.0, 0.2, 9, 9.5);
    roofClutter(m, -34, -18, -18, 18, base, 77, 0.5);
    for (const s of [-1, 1]) planter(m, s * 30, 27.0, 2.6, 0.75);
  }
  return m;
}

// =============================================================== 5. farming

/**
 * A grain exchange: a trading hall under a saw-tooth, with the silos attached.
 *
 * The rural theme's big office, and the only honest form for one -- a company
 * that trades what the region grows has its floor beside the thing it trades.
 * So it is one long two-storey block of offices, a top-lit hall, and six
 * concrete silos joined to it by a conveyor. Wide rather than tall, which is
 * how a farming region builds anything.
 */
function grainExchange(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 44.0, hz = 20.0, floorH = 4.2, floors = 4;
  const top = 0.8 + floors * floorH;

  forecourt(m, -56, -34, 56, 34, 2903, { trees: 7, lamps: 8, people: 8, benches: 3 });
  m.box([-hx, 0.1, -hz], [hx, 0.8, hz], MAT.STONE);
  m.box([-hx, 0.8, -hz], [hx, top, hz], MAT.BRICK, { roof: MAT.ROOF });
  if (medium) {
    // Brick piers with timber-framed glazing between them, which is what a
    // nineteenth-century exchange actually looks like.
    m.painted(TINT.NONE, () => {
      for (let i = 0; i <= 14; i++) {
        const x = -hx + (i / 14) * hx * 2;
        m.box([x - 1.1, 0.8, -hz - 0.5], [x + 1.1, top + 0.8, -hz], MAT.BRICK);
        m.box([x - 1.1, 0.8, hz], [x + 1.1, top + 0.8, hz + 0.5], MAT.BRICK);
      }
    });
    for (let f = 0; f < floors; f++) {
      for (const [sign, pln] of [[1, hz], [-1, -hz]] as const) {
        m.windowRow({
          axis: 'z', sign, plane: pln, from: -hx + 2, to: hx - 2,
          y0: 0.8 + f * floorH + 0.8, y1: 0.8 + (f + 1) * floorH - 0.8,
          count: 14, width: 3.2, glass: MAT.PANE, frame: 0.16, proud: 0.1,
        });
      }
    }
    band(m, -hx, -hz, hx, hz, top - 0.9, 0.9, 0.6, MAT.STONE);
    sawtooth(m, -hx + 0.5, -hz + 0.5, hx - 0.5, hz - 0.5, top + 0.8, 5, 4.2, MAT.METAL);
    for (const s of [-1, 1]) {
      m.box([s * (hx - 0.4), top - 0.4, -hz], [s * (hx + 0.2), top + 5.4, hz], MAT.BRICK);
    }
  }
  if (fine) {
    // A clock gable over the entrance, which is the one vertical it gets.
    m.box([-8.0, 0.1, hz], [8.0, top + 3.0, hz + 3.0], MAT.BRICK);
    m.gable([-8.6, top + 3.0, hz - 0.6], [8.6, top + 3.0, hz + 3.6], 4.6, 'x', MAT.ROOF_TILE, MAT.BRICK);
    m.painted(TINT.SIGN_LIT, () => m.cylinder(0, hz + 3.05, 2.2, top + 4.0, top + 4.2, 14, MAT.PLATE, true));
    entrance(m, { axis: 'z', sign: 1, plane: hz + 3.0 }, 0,
      { width: 3.8, height: 5.0, double: true, glazed: true, fanlight: true });
    marquee(m, -7, 7, hz + 3.3, 1, 6.4, 2.0);
    // The silo battery and the conveyor that feeds it.
    for (let i = 0; i < 6; i++) {
      silo(m, -hx + 8 + i * 12.5, -hz - 14.0, 5.4, 0.1, 26.0, { cone: 3.4, ribs: 4, mat: MAT.CONCRETE });
    }
    m.box([-hx + 2, 26.0, -hz - 19.0], [hx - 2, 30.0, -hz - 9.0], MAT.METAL, { roof: MAT.ROOF });
    conveyor(m, [hx - 4, 30.0, -hz - 14.0], [hx + 14, 8.0, -hz - 14.0], 2.0);
    m.painted(TINT.NONE, () => m.box([-hx, 0.11, -hz - 24.0], [hx, 0.2, -hz - 1.0], MAT.GROUND));
    flags(m, -20, 20, hz + 8.0, 0.2, 5, 8.5);
    for (const sx of [-40, 40]) tree(m, sx, hz + 12, 9.5, 3.4);
    for (let i = 0; i < 7; i++) figure(m, 3311 + i * 13, -18 + i * 6.0, hz + 6.0, Math.PI, { stride: 0.22 });
  }
  return m;
}

/**
 * An agricultural research campus: three pavilions and a run of glasshouses.
 *
 * The other kind of big rural employer, and it is a campus rather than a
 * building -- low blocks in a landscape, joined by a covered walk, with the
 * glasshouses that are the actual work laid out beside them. Nothing else in
 * the library is a plan rather than an object, which is the point.
 */
function agriCampus(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const floorH = 4.0;

  forecourt(m, -56, -40, 56, 24, 6151, { trees: 12, lamps: 8, people: 8, benches: 5 });
  // Three pavilions on a spine, each two or three storeys of glass and timber.
  const pav: Array<[number, number, number]> = [[-34, 3, 20], [0, 2, 24], [34, 3, 20]];
  for (const [cx, n, w] of pav) {
    const h = 0.6 + n * floorH;
    m.box([cx - w / 2, 0.1, -16], [cx + w / 2, 0.6, 12], MAT.STONE);
    m.box([cx - w / 2, 0.6, -16], [cx + w / 2, h, 12], MAT.RENDER, { roof: MAT.ROOF });
    if (medium) {
      curtain(m, cx - w / 2 + 0.5, -16.4, cx + w / 2 - 0.5, 12.4, 0.6, n, floorH,
        { mullions: 3.0, frame: MAT.TIMBER });
      // A deep timber brise-soleil, which is the theme's one modern gesture.
      m.painted(TINT.WOOD, () => {
        for (let f = 1; f <= n; f++) {
          m.box([cx - w / 2 - 1.2, 0.6 + f * floorH - 0.9, 12.4], [cx + w / 2 + 1.2, 0.6 + f * floorH - 0.6, 14.2], MAT.TIMBER);
        }
        for (let i = 0; i <= 6; i++) {
          const x = cx - w / 2 + (i / 6) * w;
          m.box([x - 0.16, 0.6, 13.6], [x + 0.16, h, 14.0], MAT.TIMBER);
        }
      });
      m.gable([cx - w / 2 - 0.8, h, -16.8], [cx + w / 2 + 0.8, h, 12.8], 3.6, 'x', MAT.ROOF_TILE, MAT.RENDER);
    }
    if (fine) roofClutter(m, cx - w / 2 + 2, -14, cx + w / 2 - 2, 10, h, 43 + cx, 0.4);
  }
  if (medium) {
    // The covered walk that joins them.
    m.painted(TINT.WOOD, () => {
      m.box([-46, 4.2, 12.6], [46, 4.6, 17.4], MAT.TIMBER, { skipBottom: false });
      for (let i = 0; i <= 22; i++) {
        const x = -46 + (i / 22) * 92;
        m.cylinder(x, 17.0, 0.2, 0.2, 4.2, 6, MAT.TIMBER, false);
      }
    });
  }
  if (fine) {
    // The glasshouses: five spans of glazed barrel vault on dwarf walls.
    for (let i = 0; i < 5; i++) {
      const z0 = -38.0, z1 = -18.0;
      const x0 = -44 + i * 18, x1 = x0 + 14;
      m.box([x0, 0.1, z0], [x1, 1.2, z1], MAT.CONCRETE);
      m.box([x0 + 0.3, 1.2, z0 + 0.3], [x1 - 0.3, 4.2, z1 - 0.3], MAT.GLASS);
      barrelVault(m, x0, z0, x1, z1, 4.2, 4.0, 7, { ribs: 6 });
      m.painted(TINT.GREEN, () => m.box([x0 + 1, 1.2, z0 + 1], [x1 - 1, 2.4, z1 - 1], MAT.TRIM));
    }
    // Trial plots between the glasshouses and the pavilions.
    m.painted(TINT.GREEN, () => {
      for (let i = 0; i < 6; i++) m.box([-46 + i * 15.5, 0.12, -16.0], [-36 + i * 15.5, 0.34, -6.0], MAT.TRIM);
    });
    hedge(m, -50, -4.0, 50, -2.8, 1.0);
    porteCochere(m, -8, 8, 14.4, 5.5, 5.5, 3);
    marquee(m, -12, 12, 14.6, 1, 6.6, 2.2);
    flags(m, -24, 24, 20.0, 0.2, 5, 8.0);
    for (let i = 0; i < 8; i++) figure(m, 4409 + i * 11, -30 + i * 8.0, 19.0, Math.PI, { stride: 0.22 });
    for (const sx of [-50, 50]) tree(m, sx, 18, 10.0, 3.6);
    lattice(m, 50, -30, 1.4, 0.7, 0.1, 26.0, 6);
  }
  return m;
}

// ====================================================================== table

const desks = (jobs: number, upkeep: number, power: number): AssetDef['sim'] => ({
  jobs, powerKW: power, waterM3: jobs * 0.32, garbagePerWeek: jobs * 7,
  pollution: 0, upkeep,
});

interface Row {
  key: string; name: string; foot: [number, number]; jobs: number;
  upkeep: number; power: number; colour: [number, number, number];
  accent: [number, number, number]; note: string;
  build: (lod: number) => MeshBuilder;
}

const TOWER: Record<Theme, Row> = {
  modern: {
    key: 'tower', name: 'Ardent Tower', foot: [12, 11], jobs: 2600, upkeep: 3400, power: 5200,
    colour: [0.16, 0.26, 0.40], accent: [0.72, 0.62, 0.30],
    note: 'Sixty-two storeys on a nine-square plan that loses its corners, then its sides: three curtain-walled stages with a railed terrace at each setback, a colonnaded stone base and a thirty-four metre mast.',
    build: supertall,
  },
  european: {
    key: 'tower', name: 'The Chancery', foot: [9, 8], jobs: 1500, upkeep: 2200, power: 2800,
    colour: [0.22, 0.24, 0.30], accent: [0.66, 0.58, 0.34],
    note: 'Twenty storeys of stone piers over an arcaded loggia you can see through, finishing in a colonnaded clock stage with four lit faces and a three-stage copper spire with a weathervane on it.',
    build: chanceryTower,
  },
  american: {
    key: 'tower', name: 'The Corvid Building', foot: [9, 8], jobs: 1200, upkeep: 1900, power: 2400,
    colour: [0.24, 0.18, 0.22], accent: [0.74, 0.60, 0.22],
    note: 'A stepped masonry skyscraper: a stone base with an arched entrance bay, five brick stages of deep continuous piers with a chevron frieze at every setback, and a crown of five diminishing tiers under a lit lantern and spire.',
    build: decoTower,
  },
  asian: {
    key: 'tower', name: 'Cloud Terrace', foot: [10, 9], jobs: 2200, upkeep: 3000, power: 4400,
    colour: [0.18, 0.30, 0.36], accent: [0.72, 0.46, 0.22],
    note: 'Forty-four storeys with two three-storey sky gardens cut clean through the shaft, carried on four corner columns, over a glazed podium with a tiled canopy, and finishing in three diminishing tiled tiers and a finial.',
    build: skyGardenTower,
  },
  farming: {
    key: 'tower', name: 'Wheatmarket Exchange', foot: [15, 11], jobs: 900, upkeep: 1400, power: 1800,
    colour: [0.36, 0.26, 0.16], accent: [0.68, 0.60, 0.30],
    note: 'A ninety-metre brick exchange in fourteen piered bays under a five-bay north-light roof, with a clock gable over the door and a battery of six twenty-six metre silos joined to it by a conveyor.',
    build: grainExchange,
  },
  row: {
    key: 'tower', name: '', foot: [1, 1], jobs: 0, upkeep: 0, power: 0,
    colour: [0, 0, 0], accent: [0, 0, 0], note: '', build: supertall,
  },
};

const HQ: Record<Theme, Row> = {
  modern: {
    key: 'hq', name: 'Vance Group HQ', foot: [14, 11], jobs: 1400, upkeep: 2100, power: 3000,
    colour: [0.18, 0.30, 0.34], accent: [0.70, 0.58, 0.24],
    note: 'A nine-storey glass slab bent into a shallow arc on a stone podium, with a horizontal brise-soleil on the outer face, a glazed entrance pavilion under a canopy, and a garden and flag line in front.',
    build: corporateHq,
  },
  european: {
    key: 'hq', name: 'Ravensholt Quadrangle', foot: [14, 11], jobs: 1300, upkeep: 1900, power: 2400,
    colour: [0.26, 0.26, 0.28], accent: [0.64, 0.58, 0.38],
    note: 'Four six-storey stone ranges round a court roofed in a glazed barrel vault, mansards over each range, a pedimented centrepiece on four giant columns, and the court paved, planted and walked across.',
    build: quadrangleHq,
  },
  american: {
    key: 'hq', name: 'The Exchange', foot: [11, 10], jobs: 2100, upkeep: 2800, power: 4600,
    colour: [0.20, 0.22, 0.30], accent: [0.72, 0.52, 0.16],
    note: 'Two concrete cores flanking a twenty-four storey glazed atrium under a pyramid roof, braced by a four-storey diagrid on both long faces, over a two-storey trading hall glazed all the way round.',
    build: exchangeTower,
  },
  asian: {
    key: 'hq', name: 'Twin Cranes', foot: [13, 10], jobs: 2400, upkeep: 3200, power: 4800,
    colour: [0.20, 0.28, 0.42], accent: [0.74, 0.54, 0.20],
    note: 'Two thirty-six storey towers on a shared glazed podium, tied at the twenty-third floor by a skybridge on raking props, each capped with three diminishing tiled tiers and a mast.',
    build: twinTowers,
  },
  farming: {
    key: 'hq', name: 'Fallowmere Research', foot: [14, 10], jobs: 700, upkeep: 1100, power: 1600,
    colour: [0.24, 0.32, 0.24], accent: [0.66, 0.60, 0.36],
    note: 'Three timber-and-glass pavilions on a covered walk, five glazed barrel-vaulted glasshouses laid out beside them, trial plots between the two and a met mast at the end of the site.',
    build: agriCampus,
  },
  row: {
    key: 'hq', name: '', foot: [1, 1], jobs: 0, upkeep: 0, power: 0,
    colour: [0, 0, 0], accent: [0, 0, 0], note: '', build: corporateHq,
  },
};

export const SIGNATURE_OFFICE: AssetDef[] = THEME_ORDER.flatMap((t) =>
  [TOWER[t], HQ[t]].map((r): AssetDef => ({
    id: `sig.off.${t}.${r.key}`,
    name: r.name,
    zone: 'office',
    density: 'high',
    variant: 'sculpted',
    theme: t,
    signature: true,
    footprint: r.foot,
    height: 0,
    brand: { name: r.name, colour: r.colour, accent: r.accent, sign: 'box' },
    sim: desks(r.jobs, r.upkeep, r.power),
    note: r.note,
    build: r.build,
  })));
