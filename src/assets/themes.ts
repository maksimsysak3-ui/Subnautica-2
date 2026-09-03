/**
 * Regional themes.
 *
 * A district reads as a place when its buildings agree with each other. Thirty
 * five housing prototypes drawn one at a time do not agree: a timber chalet, a
 * glass point block and a stone almshouse can end up on the same street, and
 * the eye reads that as noise rather than as variety.
 *
 * So variety is organised instead. A theme fixes the vocabulary -- what the
 * walls are made of, how steep the roof is, how wide a window is, whether
 * there are shutters or grilles or a porch -- and every building in it is
 * built from that vocabulary. Two houses in the same theme look related; the
 * same house in two themes looks like a different country.
 *
 * The five are deliberately far apart: a contemporary render-and-glass block,
 * a European brick street, a North American timber suburb, an East Asian
 * render-and-tile block, and a pre-industrial stone-and-timber village.
 */

import { MAT, TINT, MeshBuilder } from './mesh';
import type { Material } from './mesh';

export type Theme = 'modern' | 'european' | 'american' | 'asian' | 'farming' | 'row';

export interface ThemeProfile {
  id: Theme;
  /** Two or three letters, shown in a black box in the asset list. */
  badge: string;
  label: string;
  /** Main wall material. */
  wall: Material;
  /** Plinth, ground floor, or a contrasting base storey. */
  base: Material;
  /** Roof covering. */
  cover: Material;
  /** Joinery and cornices. */
  trim: Material;
  roof: 'flat' | 'gable' | 'hip' | 'mansard';
  /** Ridge height as a fraction of the span. */
  pitch: number;
  /** Eaves overhang. */
  eave: number;
  floorH: number;
  /** Window proportion, in metres, at domestic scale. */
  winW: number;
  winH: number;
  /** Windows per six metres of wall. */
  rhythm: number;
  shutters: boolean;
  grille: boolean;
  chimney: boolean;
  veranda: boolean;
  /** Horizontal glazing instead of punched openings, on taller blocks. */
  ribbon: boolean;
  /** Balcony treatment on medium and high density. */
  balcony: 'none' | 'metal' | 'solid' | 'recessed';

  // ------------------------------------------------------------- massing
  //
  // How a theme builds mass, as opposed to how it dresses it. Without these a
  // theme was a skin: the point block was one shape in five materials, and
  // five towers in a row differed only in what they were painted. A place is
  // recognised by its shape from a distance and by its material only up
  // close, so the shape has to come first.

  /**
   * Frontage against depth. Above one is a wide shallow plot; below one is a
   * narrow deep one -- a European street of narrow frontages against an
   * American suburb of wide ones.
   */
  plot: number;
  /** Multiplier on a plan's storey count. */
  storeys: number;
  /** How far the top of a tall block steps in, as a fraction of its width. */
  setback: number;
  /** Podium height in storeys, or zero for none. */
  podium: number;
  /** A wing off the back or side, as a fraction of the plan's depth. */
  wing: number;
  /** An attic storey inside the roof, with dormers. */
  attic: boolean;
}

export const THEMES: Record<Theme, ThemeProfile> = {
  modern: {
    // White panel, black frames and glass. The whole theme is that contrast,
    // so it takes the flattest roof, the deepest ribbon glazing and no
    // ornament at all -- anything applied to it reads as a different theme.
    id: 'modern', badge: 'MOD', label: 'Modern',
    wall: MAT.RENDER, base: MAT.CONCRETE, cover: MAT.ROOF, trim: MAT.DARK_TRIM,
    roof: 'flat', pitch: 0, eave: 0.12, floorH: 3.2,
    winW: 2.4, winH: 2.2, rhythm: 2, shutters: false, grille: false,
    chimney: false, veranda: false, ribbon: true, balcony: 'metal',
    plot: 1.24, storeys: 1.15, setback: 0.22, podium: 1.4, wing: 0.00, attic: false,
  },
  european: {
    id: 'european', badge: 'EU', label: 'European',
    wall: MAT.BRICK, base: MAT.STONE, cover: MAT.ROOF_TILE, trim: MAT.TRIM,
    roof: 'gable', pitch: 0.46, eave: 0.30, floorH: 3.0,
    winW: 1.1, winH: 1.9, rhythm: 3, shutters: true, grille: false,
    chimney: true, veranda: false, ribbon: false, balcony: 'metal',
    plot: 0.72, storeys: 1.00, setback: 0.00, podium: 0.0, wing: 0.34, attic: true,
  },
  american: {
    id: 'american', badge: 'NA', label: 'North American',
    wall: MAT.HOUSE_WALL, base: MAT.BRICK, cover: MAT.ROOF, trim: MAT.TRIM,
    roof: 'gable', pitch: 0.36, eave: 0.52, floorH: 2.9,
    winW: 1.5, winH: 1.5, rhythm: 2, shutters: true, grille: false,
    chimney: true, veranda: true, ribbon: false, balcony: 'solid',
    plot: 1.38, storeys: 0.85, setback: 0.00, podium: 0.0, wing: 0.42, attic: true,
  },
  asian: {
    id: 'asian', badge: 'AS', label: 'East Asian',
    wall: MAT.PLASTER, base: MAT.TILE, cover: MAT.ROOF_TILE, trim: MAT.TRIM,
    roof: 'hip', pitch: 0.28, eave: 0.75, floorH: 3.0,
    winW: 1.7, winH: 1.7, rhythm: 2, shutters: false, grille: true,
    chimney: false, veranda: false, ribbon: false, balcony: 'recessed',
    plot: 0.92, storeys: 1.30, setback: 0.10, podium: 2.2, wing: 0.00, attic: false,
  },
  farming: {
    // Whitewashed stone and timber under a very steep tiled roof, with deep
    // eaves and small shuttered openings: a working village rather than a
    // period piece.
    id: 'farming', badge: 'FARM', label: 'Farming',
    wall: MAT.PLASTER, base: MAT.STONE, cover: MAT.ROOF_TILE, trim: MAT.TIMBER,
    roof: 'gable', pitch: 0.62, eave: 0.44, floorH: 2.7,
    winW: 0.9, winH: 1.3, rhythm: 3, shutters: true, grille: false,
    chimney: true, veranda: true, ribbon: false, balcony: 'none',
    plot: 1.55, storeys: 0.75, setback: 0.00, podium: 0.0, wing: 0.55, attic: true,
  },
  row: {
    // Row housing: one wall material, one roof, one window, repeated. Kept to
    // the two densities where a terrace is what a street is actually made of.
    id: 'row', badge: 'ROW', label: 'Row',
    wall: MAT.BRICK, base: MAT.CONCRETE, cover: MAT.ROOF, trim: MAT.TRIM,
    roof: 'gable', pitch: 0.30, eave: 0.24, floorH: 2.9,
    winW: 1.3, winH: 1.6, rhythm: 2, shutters: false, grille: false,
    chimney: true, veranda: false, ribbon: false, balcony: 'metal',
    plot: 0.62, storeys: 0.95, setback: 0.00, podium: 0.0, wing: 0.28, attic: true,
  },
};

/**
 * The five full themes, in list order.
 *
 * `row` is deliberately not among them: it is a two-density supplement rather
 * than a vocabulary a whole district can be built from.
 */
export const THEME_ORDER: Theme[] = ['modern', 'european', 'american', 'asian', 'farming'];

/** Every theme, including the supplements, in list order. */
export const ALL_THEMES: Theme[] = [...THEME_ORDER, 'row'];

/** Short key used in asset ids: res.eu.low.terrace. */
export const THEME_KEY: Record<Theme, string> = {
  modern: 'mod', european: 'eu', american: 'na', asian: 'as', farming: 'farm', row: 'row',
};

// ------------------------------------------------------------------ roofing

/**
 * A hipped roof: four slopes to a ridge shorter than the plan.
 *
 * MeshBuilder.gable covers two slopes and two vertical ends, which is the
 * wrong shape everywhere the eaves run right round -- and that is most of the
 * Asian and North American library. Built here rather than in the mesh
 * builder because it is a roof shape, not a primitive.
 */
export function hip(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number,
                    y: number, height: number, cover: Material): void {
  const w = x1 - x0, d = z1 - z0;
  // Ridge runs along the longer axis, inset by half the shorter span.
  const along: 'x' | 'z' = w >= d ? 'x' : 'z';
  const inset = Math.min(w, d) * 0.5;
  const peak = y + height;
  if (along === 'x') {
    const mz = (z0 + z1) / 2;
    const rx0 = x0 + inset, rx1 = x1 - inset;
    m.quad([x0, y, z1], [x1, y, z1], [rx1, peak, mz], [rx0, peak, mz], cover);
    m.quad([x1, y, z0], [x0, y, z0], [rx0, peak, mz], [rx1, peak, mz], cover);
    m.tri([x1, y, z1], [x1, y, z0], [rx1, peak, mz], cover);
    m.tri([x0, y, z0], [x0, y, z1], [rx0, peak, mz], cover);
  } else {
    const mx = (x0 + x1) / 2;
    const rz0 = z0 + inset, rz1 = z1 - inset;
    m.quad([x1, y, z1], [x1, y, z0], [mx, peak, rz0], [mx, peak, rz1], cover);
    m.quad([x0, y, z0], [x0, y, z1], [mx, peak, rz1], [mx, peak, rz0], cover);
    m.tri([x0, y, z1], [x1, y, z1], [mx, peak, rz1], cover);
    m.tri([x1, y, z0], [x0, y, z0], [mx, peak, rz0], cover);
  }
}

/**
 * A mansard: a steep lower slope carrying dormers, then a shallow cap.
 *
 * Two sloped bands rather than one, which is the whole point of the shape --
 * it buys a full storey inside the roof, and it is the reason a Parisian
 * street silhouette is not a row of triangles.
 */
export function mansard(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number,
                        y: number, height: number, cover: Material, wall: Material): void {
  const kneeH = height * 0.62;
  const knee = y + kneeH;
  const ix = Math.min((x1 - x0) * 0.16, 1.6), iz = Math.min((z1 - z0) * 0.16, 1.6);
  const ax0 = x0 + ix, ax1 = x1 - ix, az0 = z0 + iz, az1 = z1 - iz;
  // Steep lower band, all four sides.
  m.quad([x0, y, z1], [x1, y, z1], [ax1, knee, az1], [ax0, knee, az1], cover);
  m.quad([x1, y, z0], [x0, y, z0], [ax0, knee, az0], [ax1, knee, az0], cover);
  m.quad([x1, y, z1], [x1, y, z0], [ax1, knee, az0], [ax1, knee, az1], cover);
  m.quad([x0, y, z0], [x0, y, z1], [ax0, knee, az1], [ax0, knee, az0], cover);
  // Shallow cap over it.
  hip(m, ax0, az0, ax1, az1, knee, height - kneeH, cover);
  // A band at the knee, which is where a mansard is always read from.
  m.box([x0 - 0.08, knee - 0.14, z0 - 0.08], [x1 + 0.08, knee, z1 + 0.08], wall);
}

/** A dormer standing out of a pitched roof, with its own little roof. */
export function dormer(m: MeshBuilder, cx: number, z: number, sign: 1 | -1,
                       base: number, T: ThemeProfile, width = 1.4): void {
  const h = 1.5;
  const front = z + sign * 0.75;
  const lo = Math.min(z, front), hi = Math.max(z, front);
  m.box([cx - width / 2, base, lo], [cx + width / 2, base + h, hi], T.wall);
  m.gable([cx - width / 2 - 0.14, base + h, lo - 0.14], [cx + width / 2 + 0.14, base + h, hi + 0.14],
    width * 0.4, 'z', T.cover, T.wall);
  m.opening({ axis: 'z', sign, plane: front, u0: cx - width / 2 + 0.22, u1: cx + width / 2 - 0.22,
    y0: base + 0.3, y1: base + h - 0.22, glass: MAT.GLASS, frame: 0.09, proud: 0.07 });
}

/** Deep bracketed eaves, the thing that makes a hipped roof read as Asian. */
export function brackets(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number,
                         y: number, out: number): void {
  m.painted(TINT.WOOD, () => {
    const n = Math.max(3, Math.round((x1 - x0) / 2.4));
    for (let i = 0; i <= n; i++) {
      const px = x0 + (i / n) * (x1 - x0);
      for (const [pz, s] of [[z1, 1], [z0, -1]] as const) {
        m.box([px - 0.07, y - 0.55, pz + (s > 0 ? 0 : -out)], [px + 0.07, y - 0.1, pz + (s > 0 ? out : 0)], MAT.TIMBER);
      }
    }
  });
}
