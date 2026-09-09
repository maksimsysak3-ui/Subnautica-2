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
import type { Vec3 } from '../mesh';
import { THEME_ORDER } from '../themes';
import type { Theme } from '../themes';
import {
  barrelVault, cap, conveyor, crownStack, curtain, flags, forecourt, lattice,
  loft, marquee, pierWall, plan, porteCochere, scaled, shelf, silo,
} from './signature-parts';
import type { Ring } from './signature-parts';
import { band, entrance, parapet, planter, railing, roofClutter } from '../parts';
import { tree, hedge } from './landscape';
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
 * A tower that turns as it rises.
 *
 * One move, carried the whole height: every floor plate is the one below it
 * rotated a degree and shrunk a fraction, so the corners of the building
 * describe a helix and no two elevations are ever the same. It is the only
 * silhouette in this file that cannot be drawn with a straight edge, and it is
 * what a curved glass slab in a business park was never going to be -- the old
 * one was nine storeys of shallow arc, which is a fine building and not a
 * landmark, and a landmark is the whole brief here.
 *
 * The twist is only visible if the floors are: a shaft of smooth glass that
 * happens to be turning reads as a shaft of smooth glass. So every slab edge
 * stands proud as a band, and the bands are what the eye follows round.
 */
function twistTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const N = 16;
  const floors = 48, floorH = 4.1, base = 11.0;
  const hx = 17.0, hz = 15.0;
  //: How far the plan turns between the ground and the roof, in radians.
  const TURN = 1.15;
  //: ...and how much of its plan it gives up on the way.
  const TAPER = 0.34;
  const root = plan(hx, hz, 0.34, N);
  const ring = (f: number): Ring => {
    const t = f / floors;
    const k = 1 - TAPER * t;
    return scaled(root, k, k, TURN * t);
  };
  const yOf = (f: number): number => base + f * floorH;
  const top = yOf(floors);

  forecourt(m, -46, -38, 46, 38, 6607, { trees: 9, lamps: 8, people: 11, benches: 4 });

  // The podium: a stone plinth with the lobby glazed the whole way round, so
  // the tower reads as standing on something rather than growing out of the
  // pavement.
  m.box([-hx - 7, 0.1, -hz - 7], [hx + 7, base, hz + 7], MAT.STONE, { roof: MAT.ROOF });
  if (medium) {
    m.box([-hx - 5.4, 1.2, -hz - 7.6], [hx + 5.4, base - 2.2, hz + 7.6], MAT.GLASS);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 14; i++) {
        const u = -hx - 5.4 + (i / 14) * (hx + 5.4) * 2;
        for (const pz of [-hz - 7.7, hz + 7.5]) {
          m.box([u - 0.18, 0.9, pz], [u + 0.18, base - 2.0, pz + 0.2], MAT.TRIM);
        }
      }
      m.box([-hx - 7.4, base - 2.2, -hz - 7.4], [hx + 7.4, base - 1.3, hz + 7.4], MAT.TRIM);
    });
    band(m, -hx - 7, -hz - 7, hx + 7, hz + 7, base, 1.2, 0.7, MAT.STONE);
  }

  // The shaft. One loft per floor, because the plan changes at every one.
  for (let f = 0; f < floors; f++) {
    loft(m, ring(f), ring(f + 1), yOf(f), yOf(f + 1), MAT.GLASS);
  }
  if (medium) {
    // The slab edges, which are the twist. Standing proud of the glass and
    // lit differently, they turn a smooth shaft into a stack of plates you
    // can count and follow round the building.
    for (let f = 1; f <= floors; f++) {
      const r = ring(f);
      shelf(m, scaled(r, 0.995), scaled(r, 1.05), yOf(f) - 0.36, yOf(f), MAT.CONCRETE);
    }
  }
  if (fine) {
    // Mullions follow the corners up, so they climb as helices rather than
    // standing vertical -- the one detail that says the twist is structural
    // and not a pattern printed on a straight tower.
    m.painted(TINT.METAL_DARK, () => {
      for (let f = 0; f < floors; f++) {
        const a = ring(f), b = ring(f + 1);
        for (let i = 0; i < N; i += 2) {
          m.pipe([a[i][0], yOf(f), a[i][1]], [b[i][0], yOf(f + 1), b[i][1]], 0.13, MAT.TRIM, 4);
        }
      }
    });
  }

  // The crown: the last plan drawn in three diminishing lifts, glazed and lit,
  // then the mast. A twist has to stop somewhere and a flat lid stops it dead.
  if (medium) {
    let y = top;
    let k = 1 - TAPER;
    for (let i = 0; i < 3; i++) {
      const a = scaled(root, k, k, TURN);
      k *= 0.72;
      const b = scaled(root, k, k, TURN + 0.12 * (i + 1));
      loft(m, a, b, y, y + 5.0, MAT.GLASS);
      m.painted(TINT.SIGN_LIT, () => {
        shelf(m, scaled(b, 0.98), scaled(b, 1.09), y + 5.0, y + 5.8, MAT.CLADDING);
      });
      y += 5.8;
    }
    cap(m, scaled(root, k, k, TURN + 0.36), y, MAT.METAL);
    m.painted(TINT.METAL_DARK, () => m.cylinder(0, 0, 0.34, y, y + 22.0, 6, MAT.TRIM, false));
  }
  if (fine) {
    porteCochere(m, -11, 11, hz + 7.6, 6.4, 7.8, 4);
    entrance(m, { axis: 'z', sign: 1, plane: hz + 7 }, 0,
      { width: 5.0, height: 6.4, double: true, glazed: true, fanlight: true });
    marquee(m, -9, 9, hz + 7.8, 1, 11.0, 2.4);
    flags(m, -24, 24, hz + 13.0, 0.2, 6, 10.0);
    roofClutter(m, -hx + 3, -hz + 3, hx - 3, hz - 3, base, 41, 0.4);
    for (const sx of [-1, 1]) planter(m, sx * 27, hz + 9.0, 2.8, 0.8);
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
 * A stone tower that gets wider near the top, carried on brackets.
 *
 * The European answer to the tall building, and the one shape in this file
 * that looks structurally alarming and is not: the shaft rises narrow for
 * twenty-eight floors and then the last nine step *out* over it, held on
 * raking stone brackets, because the offices below wanted a small footprint
 * on a medieval street and the floors above wanted a large one. It is
 * top-heavy on purpose, and there is nothing else like it on the map.
 *
 * What it replaced was a six-storey quadrangle round a glazed court, which
 * was a good building and not a tall one. The court survives as the podium:
 * an arcaded cloister you can see through at the base, so the tower still
 * meets the ground the way a European one should.
 */
function corbelTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const floorH = 3.9;
  const hx = 13.0, hz = 11.5;              // the shaft
  const fx = 19.5, fz = 17.0;              // ...and the flare over it
  const base = 12.0;
  const lower = 28, upper = 9;
  const brk = base + lower * floorH;       // where it steps out
  const top = brk + 3.2 + upper * floorH;

  forecourt(m, -40, -34, 40, 34, 4241, { trees: 7, lamps: 8, people: 10, benches: 4 });

  // The cloister: a square of stone piers you can see between, with the
  // lobby glazed behind them.
  m.box([-hx - 9, 0.1, -hz - 9], [hx + 9, base, hz + 9], MAT.STONE, { roof: MAT.ROOF });
  if (medium) {
    m.box([-hx - 6.6, 0.6, -hz - 6.6], [hx + 6.6, base - 2.0, hz + 6.6], MAT.GLASS);
    m.painted(TINT.NONE, () => {
      for (const [a, b, axis] of [[hx + 9, hz + 9, 'x'], [hz + 9, hx + 9, 'z']] as const) {
        const n = Math.round(a / 4.4);
        for (let i = 0; i <= n; i++) {
          const u = -a + (i / n) * a * 2;
          for (const sgn of [-1, 1]) {
            if (axis === 'x') m.box([u - 1.1, 0.1, sgn * b - sgn * 2.0], [u + 1.1, base, sgn * b], MAT.STONE);
            else m.box([sgn * b - sgn * 2.0, 0.1, u - 1.1], [sgn * b, base, u + 1.1], MAT.STONE);
          }
        }
      }
    });
    band(m, -hx - 9, -hz - 9, hx + 9, hz + 9, base, 1.5, 0.9, MAT.STONE);
  }

  // The shaft: stone piers with the glazing recessed between them.
  pierWall(m, -hx, -hz, hx, hz, base, lower, floorH, MAT.STONE,
    { bays: 4, glass: MAT.PANE, windows: medium, strips: true, depth: 0.5 });

  // The brackets. Five to a face, raking out and up, and they are the whole
  // reason the building looks the way it does -- without them the flare is a
  // box balanced on a smaller box.
  if (medium) {
    m.painted(TINT.NONE, () => {
      for (const axis of ['x', 'z'] as const) {
        const a = axis === 'x' ? hx : hz;
        for (let i = 0; i < 5; i++) {
          const u = -a + ((i + 0.5) / 5) * a * 2;
          for (const sgn of [-1, 1]) {
            const inner: [number, number, number] = axis === 'x'
              ? [u, brk - 7.0, sgn * hz] : [sgn * hx, brk - 7.0, u];
            const outer: [number, number, number] = axis === 'x'
              ? [u, brk + 3.2, sgn * fz] : [sgn * fx, brk + 3.2, u];
            m.pipe(inner, outer, 0.62, MAT.STONE, 4);
          }
        }
      }
    });
    // The soffit the flare sits on, so the step out is a solid thing rather
    // than a shadow.
    shelf(m, plan(hx, hz, 0.02, 4), plan(fx, fz, 0.02, 4), brk + 2.0, brk + 3.2, MAT.STONE);
  }

  // The flare: nine floors overhanging the shaft on every side.
  pierWall(m, -fx, -fz, fx, fz, brk + 3.2, upper, floorH, MAT.STONE,
    { bays: 6, glass: MAT.PANE, windows: medium, strips: true, depth: 0.55 });

  if (medium) {
    band(m, -fx, -fz, fx, fz, top, 1.8, 1.1, MAT.STONE);
    parapet(m, -fx, -fz, fx, fz, top + 1.8, 1.6, 0.4, MAT.STONE);
    // A lantern on the roof, and a pinnacle at each corner of the flare.
    m.box([-4.2, top + 1.8, -4.2], [4.2, top + 9.0, 4.2], MAT.STONE, { roof: MAT.ROOF });
    m.painted(TINT.SIGN_LIT, () => {
      for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        m.box([ax * 4.3 - 2.2, top + 3.4, az * 4.3 - 2.2],
              [ax * 4.3 + 2.2, top + 7.4, az * 4.3 + 2.2], MAT.PANE);
      }
    });
    m.cone(0, 0, 5.4, 0.0, top + 9.0, top + 17.0, 4, MAT.METAL);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      m.cone(sx * (fx - 1.6), sz * (fz - 1.6), 1.5, 0.0, top + 1.8, top + 8.4, 4, MAT.STONE);
    }
  }
  if (fine) {
    for (const s of [-1, 1] as const) {
      entrance(m, { axis: 'z', sign: s, plane: s * (hz + 9) }, 0,
        { width: 4.4, height: 5.6, double: true, glazed: true, fanlight: true });
    }
    marquee(m, -8, 8, hz + 9.2, 1, base - 1.6, 2.2);
    flags(m, -22, 22, hz + 13.0, 0.2, 5, 9.0);
    roofClutter(m, -fx + 6, -fz + 6, fx - 6, fz - 6, top + 1.8, 29, 0.35);
    for (const sx of [-1, 1]) planter(m, sx * 25, hz + 11.0, 2.6, 0.8);
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
 * A diagrid tower: the structure is on the outside and there is nothing else.
 *
 * A tall building normally hides its frame and expresses a skin. This one has
 * no skin worth the name -- the diagonal grid *is* the structure, it carries
 * every load down to twelve points at the ground, and because it does there is
 * not a single column inside and not a single flat wall outside. Every face is
 * the same triangulated net, tapering as the plan draws in, so the building
 * reads as one object from any angle.
 *
 * The version this replaced had the right idea and put it on two faces out of
 * four, with the other two given over to eighteen-metre blank concrete cores
 * and a flat lid over the top. Half a landmark and half a car park wall, which
 * is worse than either.
 */
function diagridTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const floorH = 4.0, floors = 48, base = 15.0;
  const hx = 21.0, hz = 15.5;
  //: The plan gives up this much of itself between the base and the roof.
  const TAPER = 0.30;
  //: Floors per bay of the grid. The diagonals cross once in each.
  const MOD = 4;
  const half = (y: number): [number, number] => {
    const t = (y - base) / (floors * floorH);
    const k = 1 - TAPER * Math.max(0, Math.min(1, t));
    return [hx * k, hz * k];
  };
  // The four true corners, not `plan(..., 4)`.
  //
  // A superellipse sampled at four angles puts its points on the axes, which
  // is a diamond -- and a diamond shaft inside a rectangular grid is how the
  // structure ended up floating two metres off the glass it is supposed to be
  // holding up.
  const ringAt = (y: number): Ring => {
    const [a, b] = half(y);
    return [[a, b], [-a, b], [-a, -b], [a, -b]];
  };
  const top = base + floors * floorH;

  forecourt(m, -44, -36, 44, 36, 8807, { trees: 8, lamps: 9, people: 12, benches: 4 });

  // The trading hall: a glazed room the full footprint, with the grid's feet
  // landing between its windows.
  m.box([-hx - 5, 0.1, -hz - 5], [hx + 5, 1.6, hz + 5], MAT.STONE, { roof: MAT.ROOF });
  m.box([-hx - 3, 1.6, -hz - 3], [hx + 3, base, hz + 3], MAT.GLASS);
  if (medium) {
    m.painted(TINT.METAL_DARK, () => {
      for (const [a, b, axis] of [[hx + 3, hz + 3, 'x'], [hz + 3, hx + 3, 'z']] as const) {
        const n = Math.round(a / 3.4);
        for (let i = 0; i <= n; i++) {
          const u = -a + (i / n) * a * 2;
          for (const sgn of [-1, 1]) {
            if (axis === 'x') m.box([u - 0.19, 1.6, sgn * b - 0.2], [u + 0.19, base, sgn * b + 0.2], MAT.TRIM);
            else m.box([sgn * b - 0.2, 1.6, u - 0.19], [sgn * b + 0.2, base, u + 0.19], MAT.TRIM);
          }
        }
      }
      m.box([-hx - 3.4, base - 1.0, -hz - 3.4], [hx + 3.4, base, hz + 3.4], MAT.TRIM);
    });
  }

  // The shaft, lofted a bay at a time because the plan is drawing in.
  for (let f = 0; f < floors; f += MOD) {
    const y0 = base + f * floorH, y1 = base + Math.min(floors, f + MOD) * floorH;
    loft(m, ringAt(y0), ringAt(y1), y0, y1, MAT.GLASS);
  }
  if (medium) {
    // A slab edge at every floor, so the grid has something to be measured
    // against and the tower has a scale.
    for (let f = 1; f <= floors; f++) {
      const y = base + f * floorH;
      const r = ringAt(y);
      shelf(m, scaled(r, 0.99), scaled(r, 1.035), y - 0.3, y, MAT.CONCRETE);
    }
    // The grid itself: two diagonals per bay per face, crossing at mid-bay,
    // plus the ring beam where the bays meet.
    m.painted(TINT.METAL_DARK, () => {
      for (let f = 0; f < floors; f += MOD) {
        const y0 = base + f * floorH, y1 = base + Math.min(floors, f + MOD) * floorH;
        const [a0, b0] = half(y0), [a1, b1] = half(y1);
        for (const axis of ['x', 'z'] as const) {
          const lo = axis === 'x' ? a0 : b0, hi = axis === 'x' ? a1 : b1;
          const bays = axis === 'x' ? 4 : 3;
          for (let i = 0; i < bays; i++) {
            const u0 = -lo + (i / bays) * lo * 2, u2 = -lo + ((i + 1) / bays) * lo * 2;
            const v0 = -hi + (i / bays) * hi * 2, v2 = -hi + ((i + 1) / bays) * hi * 2;
            for (const sgn of [-1, 1]) {
              const p = axis === 'x'
                ? [[u0, y0, sgn * b0], [v2, y1, sgn * b1], [u2, y0, sgn * b0], [v0, y1, sgn * b1]]
                : [[sgn * a0, y0, u0], [sgn * a1, y1, v2], [sgn * a0, y0, u2], [sgn * a1, y1, v0]];
              m.pipe(p[0] as Vec3, p[1] as Vec3, 0.4, MAT.TRIM, 4);
              m.pipe(p[2] as Vec3, p[3] as Vec3, 0.4, MAT.TRIM, 4);
            }
          }
        }
        const r = ringAt(y0);
        shelf(m, scaled(r, 1.0), scaled(r, 1.07), y0 - 0.5, y0 + 0.5, MAT.CLADDING);
      }
    });
  }

  // The crown: the grid carries on past the last floor as an open cage, lit
  // from inside, and the mast stands in the middle of it.
  if (medium) {
    const r = ringAt(top);
    shelf(m, scaled(r, 0.98), scaled(r, 1.08), top, top + 1.4, MAT.CONCRETE);
    // An open cage rather than a lid: four raking legs and the ring beams
    // between them, with the lit box standing inside where you can see it
    // through the structure.
    m.painted(TINT.METAL_DARK, () => {
      const c = scaled(r, 0.62);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        m.pipe([r[i][0], top + 1.4, r[i][1]], [c[i][0], top + 14.0, c[i][1]], 0.5, MAT.TRIM, 4);
        m.pipe([r[i][0], top + 1.4, r[i][1]], [c[j][0], top + 14.0, c[j][1]], 0.26, MAT.TRIM, 4);
        m.pipe([c[i][0], top + 14.0, c[i][1]], [c[j][0], top + 14.0, c[j][1]], 0.34, MAT.TRIM, 4);
      }
    });
    m.painted(TINT.SIGN_LIT, () => {
      const c = scaled(r, 0.5);
      loft(m, c, c, top + 3.0, top + 11.5, MAT.PLATE);
      cap(m, c, top + 11.5, MAT.PLATE);
    });
    m.painted(TINT.METAL_DARK, () => m.cylinder(0, 0, 0.4, top + 14.0, top + 34.0, 6, MAT.TRIM, false));
  }
  if (fine) {
    porteCochere(m, -12, 12, hz + 5.4, 6.6, 8.0, 4);
    entrance(m, { axis: 'z', sign: 1, plane: hz + 3 }, 0,
      { width: 5.4, height: 7.0, double: true, glazed: true, fanlight: true });
    marquee(m, -13, 13, hz + 5.6, 1, base - 1.4, 2.6);
    flags(m, -25, 25, hz + 10.0, 0.2, 7, 10.0);
    for (const sx of [-1, 1]) planter(m, sx * 26, hz + 7.0, 2.6, 0.8);
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
 * A grain elevator, built as tall as a tower and read as one.
 *
 * The countryside's own skyscraper, and it was standing on the prairie before
 * the cities had one. Sixteen concrete silos in two ranks make the shaft, the
 * headhouse spans them all at a hundred and ten metres with the machinery in
 * it, and the leg tower that lifts the grain goes higher still. Nothing else
 * in the library is a bundle of cylinders, so it reads as itself from the far
 * side of the map -- which is more than a brick exchange with a clock on it
 * was ever going to do at thirty-five metres.
 */
function elevatorTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const R = 5.4, GAP = 10.6;
  const COLS = 6, ROWS = 2;
  const silos = 96.0;                          // where the silos stop
  const deck = silos + 2.0;
  const head = deck + 20.0;                    // the headhouse over them
  const legX = -(COLS - 1) * GAP / 2 - GAP;    // the leg tower, off one end
  const hx = (COLS - 1) * GAP / 2, hz = (ROWS - 1) * GAP / 2;

  forecourt(m, -56, -40, 56, 40, 9109, { trees: 6, lamps: 7, people: 7, benches: 2 });
  m.box([-hx - 12, 0.1, -hz - 10], [hx + 10, 2.2, hz + 10], MAT.CONCRETE, { roof: MAT.ROOF });

  // The battery. Interstitial silos between the ranks as well, which is what
  // makes a real elevator read as a solid slab of cylinders rather than a
  // row of separate tanks.
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const x = -hx + c * GAP, z = -hz + r * GAP;
      // The ribs and the ladder are most of a silo's triangles and none of
      // its silhouette, so at distance it is the cylinder and nothing else.
      silo(m, x, z, R, 2.2, silos, { ribs: medium ? 6 : 0, mat: MAT.CONCRETE, tint: TINT.NONE });
    }
    if (medium && c < COLS - 1 && ROWS > 1) {
      silo(m, -hx + (c + 0.5) * GAP, 0, R * 0.62, 2.2, silos - 6.0,
        { ribs: 4, mat: MAT.CONCRETE, tint: TINT.NONE });
    }
  }

  // The deck slab and the headhouse: one long shed spanning the whole battery,
  // clad in corrugated metal, with the drive gear in a taller box at one end.
  m.box([-hx - R - 1.4, silos, -hz - R - 1.4], [hx + R + 1.4, deck, hz + R + 1.4], MAT.CONCRETE);
  m.box([-hx - R, deck, -hz - R], [hx + R, head, hz + R], MAT.SHED_WALL, { roof: MAT.ROOF });
  if (medium) {
    m.gable([-hx - R - 0.8, head, -hz - R - 0.8], [hx + R + 0.8, head, hz + R + 0.8],
      5.0, 'x', MAT.METAL, MAT.SHED_WALL);
    parapet(m, -hx - R - 1.4, -hz - R - 1.4, hx + R + 1.4, hz + R + 1.4, deck, 1.0, 0.26, MAT.CONCRETE);
    // Windows down the length of the headhouse: the one thing that gives a
    // hundred-metre concrete object a scale.
    for (const sz of [-1, 1] as const) {
      m.windowRow({
        axis: 'z', sign: sz, plane: sz * (hz + R), from: -hx - R + 2, to: hx + R - 2,
        y0: deck + 3.0, y1: deck + 8.0, count: 9, width: 2.2,
        glass: MAT.PANE, frame: 0.14, proud: 0.08,
      });
    }
  }

  // The leg tower: taller than everything, which is what an elevator's
  // silhouette actually is.
  m.box([legX - 5.0, 2.2, -7.0], [legX + 5.0, head + 16.0, 7.0], MAT.CONCRETE, { roof: MAT.ROOF });
  if (medium) {
    m.box([legX - 5.8, head + 16.0, -7.8], [legX + 5.8, head + 20.0, 7.8], MAT.SHED_WALL, { roof: MAT.ROOF });
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 7; i++) {
        const y = 10.0 + i * 16.0;
        if (y > head + 14.0) break;
        m.box([legX - 5.2, y, -7.2], [legX + 5.2, y + 0.5, 7.2], MAT.TRIM);
      }
    });
    conveyor(m, [legX, head + 18.0, 0], [hx + R - 2, deck + 12.0, 0], 2.2);
    conveyor(m, [legX + 5.0, 12.0, 0], [hx + 4, 5.0, 0], 1.8);
  }

  // The exchange itself, which is what the vehicles come to: a brick office
  // and weighbridge along one flank.
  m.box([-hx - 6, 0.1, hz + 12], [hx + 2, 12.0, hz + 26], MAT.BRICK, { roof: MAT.ROOF });
  if (medium) {
    band(m, -hx - 6, hz + 12, hx + 2, hz + 26, 12.0, 1.0, 0.6, MAT.STONE);
    for (let f = 0; f < 3; f++) {
      m.windowRow({
        axis: 'z', sign: 1, plane: hz + 26, from: -hx - 4, to: hx, y0: 1.4 + f * 3.6,
        y1: 4.0 + f * 3.6, count: 8, width: 1.5, glass: MAT.PANE, frame: 0.12, proud: 0.07,
      });
    }
    m.painted(TINT.BRAND, () => m.box([-8, 12.2, hz + 25.6], [10, 16.4, hz + 26.2], MAT.CLADDING));
  }
  if (fine) {
    for (let i = 0; i < 6; i++) figure(m, 5501 + i * 13, -26 + i * 10, hz + 29.0, 1.4, { stride: 0.22 });
    for (const sx of [-1, 1]) tree(m, sx * 46, -30, 8.0, 3.0);
    roofClutter(m, -hx, -hz, hx, hz, head + 5.0, 71, 0.4);
    lattice(m, hx + 14, -26, 1.6, 0.8, 0.12, 28.0, 6);
  }
  return m;
}

/**
 * A tower that grows things, with the crop on the outside of it.
 *
 * The agricultural theme's tall building has to be a tall building and still
 * be about farming, and stacking greenhouses is the honest way to do both:
 * every fifth floor is a double-height growing deck that steps out past the
 * glass, planted, so the tower is banded in green all the way up and the bands
 * are what you recognise it by. Underneath it is still a research station --
 * the glasshouse range and the trial plots are the same ones the campus had,
 * kept as the base rather than spread over a field.
 */
function vertiFarm(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 17.0, hz = 14.0, floorH = 4.2, floors = 40, base = 9.0;
  //: Every this-many floors is a growing deck rather than an office floor.
  const EVERY = 5;
  const top = base + floors * floorH;

  forecourt(m, -50, -38, 50, 38, 4409, { trees: 8, lamps: 8, people: 9, benches: 4 });

  // The research base: a low timber-and-glass range the tower stands on.
  m.box([-hx - 14, 0.1, -hz - 9], [hx + 14, base, hz + 9], MAT.TIMBER, { roof: MAT.ROOF });
  if (medium) {
    m.box([-hx - 12, 1.0, -hz - 9.6], [hx + 12, base - 1.6, hz + 9.6], MAT.GLASS);
    m.painted(TINT.WOOD, () => {
      for (let i = 0; i <= 16; i++) {
        const u = -hx - 12 + (i / 16) * (hx + 12) * 2;
        for (const pz of [-hz - 9.8, hz + 9.4]) {
          m.box([u - 0.26, 0.6, pz], [u + 0.26, base - 1.4, pz + 0.4], MAT.TIMBER);
        }
      }
    });
    band(m, -hx - 14, -hz - 9, hx + 14, hz + 9, base, 1.0, 0.6, MAT.TIMBER);
    // The glasshouses, kept from the campus this replaced.
    for (const sx of [-1, 1] as const) {
      const x0 = sx * (hx + 16), x1 = sx * (hx + 30);
      barrelVault(m, Math.min(x0, x1), -14, Math.max(x0, x1), 14, 1.2, 4.2, 7, { ribs: 6 });
      m.box([Math.min(x0, x1), 0.1, -14], [Math.max(x0, x1), 1.2, 14], MAT.CONCRETE);
      m.box([Math.min(x0, x1) + 0.4, 1.2, -13.6], [Math.max(x0, x1) - 0.4, 4.2, 13.6], MAT.GLASS);
      m.painted(TINT.GREEN, () => {
        m.box([Math.min(x0, x1) + 1, 1.2, -13], [Math.max(x0, x1) - 1, 2.4, 13], MAT.TRIM);
      });
    }
  }

  // The shaft, and the growing decks that band it.
  m.box([-hx, base, -hz], [hx, top, hz], MAT.GLASS);
  if (medium) {
    curtain(m, -hx, -hz, hx, hz, base, floors, floorH, { mullions: 4.4, band: 0.4 });
    for (let f = EVERY; f < floors; f += EVERY) {
      const y = base + f * floorH;
      // The deck: a planted tray stepping out past the glass on all four
      // sides, with a rail round it and the crop showing over the edge.
      m.box([-hx - 2.6, y - 0.7, -hz - 2.6], [hx + 2.6, y + 0.2, hz + 2.6], MAT.CONCRETE);
      m.painted(TINT.GREEN, () => {
        m.box([-hx - 2.2, y + 0.2, -hz - 2.2], [hx + 2.2, y + 1.5, hz + 2.2], MAT.TRIM);
        m.box([-hx - 0.1, y + 0.2, -hz - 0.1], [hx + 0.1, y + 2 * floorH - 0.6, hz + 0.1], MAT.TRIM);
      });
      if (fine) {
        railing(m, -hx - 2.6, hx + 2.6, hz + 2.6, y + 0.2, 1.05, 3.0);
        railing(m, -hx - 2.6, hx + 2.6, -hz - 2.6, y + 0.2, 1.05, 3.0);
      }
    }
  }

  // The crown: a glasshouse on the roof, gabled, so the tower finishes with
  // the same thing it is made of.
  if (medium) {
    shelf(m, plan(hx * 0.98, hz * 0.98, 0.02, 12), plan(hx + 3.0, hz + 3.0, 0.02, 12),
      top, top + 1.2, MAT.CONCRETE);
    m.box([-hx + 1.5, top + 1.2, -hz + 1.5], [hx - 1.5, top + 8.0, hz - 1.5], MAT.GLASS);
    barrelVault(m, -hx + 1.5, -hz + 1.5, hx - 1.5, hz - 1.5, top + 8.0, 5.5, 9, { ribs: 7 });
    m.painted(TINT.GREEN, () => {
      m.box([-hx + 2.5, top + 1.2, -hz + 2.5], [hx - 2.5, top + 2.6, hz - 2.5], MAT.TRIM);
    });
    m.painted(TINT.METAL_DARK, () => {
      m.cylinder(0, 0, 0.3, top + 13.5, top + 30.0, 6, MAT.TRIM, false);
      for (const sx of [-1, 1]) {
        m.cylinder(sx * (hx - 2.0), 0, 0.22, top + 1.2, top + 12.0, 5, MAT.TRIM, false);
      }
    });
  }
  if (fine) {
    porteCochere(m, -9, 9, hz + 9.8, 5.4, 6.0, 3);
    entrance(m, { axis: 'z', sign: 1, plane: hz + 9 }, 0,
      { width: 4.2, height: 5.0, double: true, glazed: true, fanlight: false });
    marquee(m, -11, 11, hz + 10.0, 1, base - 1.2, 2.2);
    flags(m, -22, 22, hz + 14.0, 0.2, 5, 8.0);
    hedge(m, -46, -22.0, 46, -20.8, 1.0);
    for (let i = 0; i < 8; i++) figure(m, 4409 + i * 11, -28 + i * 8.0, hz + 13.0, 1.4, { stride: 0.22 });
    lattice(m, 46, -30, 1.4, 0.7, 0.1, 26.0, 6);
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
    key: 'tower', name: 'Wheatmarket Elevator', foot: [15, 11], jobs: 1100, upkeep: 1700, power: 2400,
    colour: [0.36, 0.26, 0.16], accent: [0.68, 0.60, 0.30],
    note: 'Sixteen concrete silos in two ranks rising ninety-six metres, a headhouse spanning the whole battery under a metal gable, a leg tower higher again with conveyor galleries off it, and the brick exchange and weighbridge along one flank.',
    build: elevatorTower,
  },
  row: {
    key: 'tower', name: '', foot: [1, 1], jobs: 0, upkeep: 0, power: 0,
    colour: [0, 0, 0], accent: [0, 0, 0], note: '', build: supertall,
  },
};

const HQ: Record<Theme, Row> = {
  modern: {
    key: 'hq', name: 'Vance Group Tower', foot: [14, 11], jobs: 3100, upkeep: 3900, power: 5800,
    colour: [0.18, 0.30, 0.34], accent: [0.70, 0.58, 0.24],
    note: 'Forty-eight storeys turning a full sixty-five degrees between the pavement and the roof, every slab edge standing proud so the twist can be counted, mullions climbing the corners as helices, and a crown of three diminishing lit lifts under a mast.',
    build: twistTower,
  },
  european: {
    key: 'hq', name: 'Ravensholt Tower', foot: [14, 11], jobs: 2400, upkeep: 3100, power: 4200,
    colour: [0.26, 0.26, 0.28], accent: [0.64, 0.58, 0.38],
    note: 'Twenty-eight storeys of stone piers on a narrow plan, then nine more stepping out over them on twenty raking brackets, above an arcaded cloister you can see straight through; corner pinnacles, a lit lantern and a copper cap.',
    build: corbelTower,
  },
  american: {
    key: 'hq', name: 'The Exchange', foot: [11, 10], jobs: 2100, upkeep: 2800, power: 4600,
    colour: [0.20, 0.22, 0.30], accent: [0.72, 0.52, 0.16],
    note: 'Two concrete cores flanking a twenty-four storey glazed atrium under a pyramid roof, braced by a four-storey diagrid on both long faces, over a two-storey trading hall glazed all the way round.',
    build: diagridTower,
  },
  asian: {
    key: 'hq', name: 'Twin Cranes', foot: [13, 10], jobs: 2400, upkeep: 3200, power: 4800,
    colour: [0.20, 0.28, 0.42], accent: [0.74, 0.54, 0.20],
    note: 'Two thirty-six storey towers on a shared glazed podium, tied at the twenty-third floor by a skybridge on raking props, each capped with three diminishing tiled tiers and a mast.',
    build: twinTowers,
  },
  farming: {
    key: 'hq', name: 'Fallowmere Vertical Farm', foot: [14, 10], jobs: 1600, upkeep: 2300, power: 3600,
    colour: [0.24, 0.32, 0.24], accent: [0.66, 0.60, 0.36],
    note: 'Forty storeys banded in green: every fifth floor is a double-height growing deck stepping out past the glass and planted over its edge, on a timber research base with two barrel-vaulted glasshouses, and finishing in a glasshouse on the roof.',
    build: vertiFarm,
  },
  row: {
    key: 'hq', name: '', foot: [1, 1], jobs: 0, upkeep: 0, power: 0,
    colour: [0, 0, 0], accent: [0, 0, 0], note: '', build: twistTower,
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
