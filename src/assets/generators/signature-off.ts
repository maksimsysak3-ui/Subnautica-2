/**
 * Signature offices: a tower and a headquarters in each theme.
 *
 * The modern pair (a twisting supertall and a turning headquarters) and the
 * American headquarters (a braced trading tower) are drawn here. The other
 * seven are real modern skyscraper types rebuilt in supertalls-regional.ts --
 * a diagrid bullet, a triangle of sky gardens, bundled tubes, flared modules,
 * braced quarters, a braced taper and a pencil -- and keep their ids and lots
 * here so saved cities load onto them.
 */

import { glassShaft } from './towers';
import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import type { Vec3 } from '../mesh';
import { THEME_ORDER } from '../themes';
import type { Theme } from '../themes';
import {
  cap, flags, forecourt, loft, marquee, plan, porteCochere, scaled, shelf,
} from './signature-parts';
import type { Ring } from './signature-parts';
import { band, entrance, planter, roofClutter } from '../parts';
import {
  bracedTower, bundledTower, moduleTower, prismTower, skyGardenTower,
} from './supertalls-regional';
import { diagridPlaza, slopeTower } from './supertalls-unique';

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

  // One shaft, sixty-two storeys, drawing in and turning a few degrees as
  // it rises, to a raked crown and a mast. It used to be three curtain-walled
  // boxes stood one on another with a terrace at each step and four more
  // smaller boxes on top -- a staircase, not a skyscraper.
  glassShaft(m, lod, {
    hx: 14.5, hz: 14.5, r: 5.0, floors: 62, floorH, y0: 13.4, taper: 0.56, twist: 0.42,
    rake: 18, mast: 34, bay: 3.2,
  });
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

// ============================================================== 3. american

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
    note: 'Sixty-two storeys of glass on a rounded plan that draws in and turns a quarter of a right angle as it rises, to a raked crown and a thirty-four metre mast, over a colonnaded stone base.',
    build: supertall,
  },
  european: {
    key: 'tower', name: 'The Slope', foot: [9, 8], jobs: 1500, upkeep: 2200, power: 2800,
    colour: [0.22, 0.24, 0.30], accent: [0.66, 0.58, 0.34],
    note: 'Forty-six storeys whose front face slopes back all the way up to a blade at the roof, carried on a white megaframe over a seven-storey public plaza, with its core of glass lifts and steel stairs standing outside at the back in yellow.',
    build: slopeTower,
  },
  american: {
    key: 'tower', name: 'Lakeshore Tower', foot: [9, 8], jobs: 1200, upkeep: 1900, power: 2400,
    colour: [0.24, 0.18, 0.22], accent: [0.74, 0.60, 0.22],
    note: 'Nine square steel-framed tubes bundled three by three, each stopping at its own height from fifty to a hundred and eight storeys, so the tower steps down in a spiral of setbacks banded by black plant floors.',
    build: bundledTower,
  },
  asian: {
    key: 'tower', name: 'Jinlong Tower', foot: [10, 9], jobs: 2200, upkeep: 3000, power: 4400,
    colour: [0.18, 0.30, 0.36], accent: [0.72, 0.46, 0.22],
    note: 'A tapering base of twenty-four storeys, then eight modules of eight floors, each flaring outward like a segment of bamboo with a ledge at every joint, under a stepped and lit crown.',
    build: moduleTower,
  },
  farming: {
    key: 'tower', name: 'Prairie Tower', foot: [15, 11], jobs: 1100, upkeep: 1700, power: 2400,
    colour: [0.36, 0.26, 0.16], accent: [0.68, 0.60, 0.30],
    note: 'Ninety storeys on a rectangular plan tapering all the way up, braced on every face by five great X\'s of dark steel, with the corner columns leaning in with it.',
    build: bracedTower,
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
    key: 'hq', name: 'Kestrel Tower', foot: [14, 11], jobs: 2400, upkeep: 3100, power: 4200,
    colour: [0.26, 0.26, 0.28], accent: [0.64, 0.58, 0.38],
    note: 'Three office wings round a triangular atrium with a concrete core at each corner, and every twelve floors one wing opens four storeys to a garden of trees, a different wing each time, so the gardens spiral up the tower.',
    build: skyGardenTower,
  },
  american: {
    key: 'hq', name: 'The Exchange', foot: [11, 10], jobs: 2100, upkeep: 2800, power: 4600,
    colour: [0.20, 0.22, 0.30], accent: [0.72, 0.52, 0.16],
    note: 'Two concrete cores flanking a twenty-four storey glazed atrium under a pyramid roof, braced by a four-storey diagrid on both long faces, over a two-storey trading hall glazed all the way round.',
    build: diagridTower,
  },
  asian: {
    key: 'hq', name: 'Harbour Prism', foot: [13, 10], jobs: 2400, upkeep: 3200, power: 4800,
    colour: [0.20, 0.28, 0.42], accent: [0.74, 0.54, 0.20],
    note: 'A square split along its diagonals into four triangular quarters stopping at four heights under sloping glass roofs, the whole frame braced by great white X\'s on every face.',
    build: prismTower,
  },
  farming: {
    key: 'hq', name: 'Hearst Plaza', foot: [14, 10], jobs: 1600, upkeep: 2300, power: 3600,
    colour: [0.24, 0.32, 0.24], accent: [0.66, 0.60, 0.36],
    note: 'A six-storey stone block of piers and tall windows, kept whole, with a forty-two storey silver diagrid tower rising out of the middle of it: every face a lattice of triangles, nothing vertical in the frame at all.',
    build: diagridPlaza,
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
