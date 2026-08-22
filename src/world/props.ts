/**
 * Prop library — furniture, dressing and vehicles, all built from bricks so
 * they collide, block sight and generate cover exactly like architecture does.
 *
 * A room with a sofa, a coffee table and a sideboard plays completely
 * differently from an empty box: the furniture is what turns "a room" into
 * "a room you have to clear". Every prop here is chosen for that reason —
 * waist-high cover, sight blockers, and things that break up a doorway's
 * firing line.
 */

import { BF, SHAPE_CYL } from './types';
import { M } from './palette';
import { SiteBuilder } from './builder';

const F_PROP = BF.NO_COVER; // most small props are dressing, not cover
const F_SOFT = BF.SOFT | BF.NO_SHADOW | BF.NO_NAV;
/**
 * Tier-three dressing: visible, but out of every gameplay system.
 *
 * A junction box must not become a cover node, must not block the navmesh and
 * must not cast a shadow map entry — there are going to be thousands of these
 * and every one that reaches the cover graph makes the AI dumber, not the map
 * richer.
 */
const F_THIN = BF.NO_COVER | BF.NO_NAV | BF.THIN | BF.NO_SHADOW;
/**
 * Ground decals: all of the above, plus genuinely non-solid.
 *
 * `SOFT` alone would not do it — that flag is about line of sight, not about
 * bodies, and a millimetre-thick paint stripe that a character can walk into
 * is the same bug as a strip curtain you cannot walk through. NO_COLLIDE also
 * keeps several thousand of these out of the collision BVH entirely.
 */
const F_DECAL = F_THIN | BF.SOFT | BF.NO_COLLIDE;

export class Props {
  constructor(private b: SiteBuilder) {}

  private get rng() { return this.b.rng; }

  // ==== interior ==========================================================

  /** Waist-high sofa: genuine crouch cover inside a living room. */
  sofa(x: number, y: number, z: number, yaw: number, len = 2.2, mat = M.fabricCream): void {
    const b = this.b;
    b.box(x, y + 0.22, z, len / 2, 0.22, 0.45, M.woodDark, { yaw, surface: 'wood', flags: F_PROP });
    b.box(x, y + 0.48, z, len / 2, 0.12, 0.42, mat, { yaw, surface: 'fabric', tint: b.jitterTint(0.05) });
    // Backrest, offset to the -z side of the local frame.
    b.box(x + Math.sin(yaw) * 0.34, y + 0.6, z + Math.cos(yaw) * 0.34, len / 2, 0.3, 0.12, mat, {
      yaw, surface: 'fabric', tint: b.jitterTint(0.05),
    });
    for (const s of [-1, 1]) {
      b.box(x + Math.cos(yaw) * s * (len / 2 - 0.1), y + 0.56, z - Math.sin(yaw) * s * (len / 2 - 0.1),
        0.1, 0.2, 0.44, mat, { yaw, surface: 'fabric', flags: F_PROP });
    }
  }

  armchair(x: number, y: number, z: number, yaw: number, mat = M.leather): void {
    this.sofa(x, y, z, yaw, 0.85, mat);
  }

  table(x: number, y: number, z: number, yaw: number, w: number, d: number, h: number, mat = M.woodWarm): void {
    const b = this.b;
    b.box(x, y + h - 0.04, z, w / 2, 0.04, d / 2, mat, { yaw, surface: 'wood', tint: b.jitterTint(0.05) });
    const lx = w / 2 - 0.12, lz = d / 2 - 0.12;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const px = x + Math.cos(yaw) * sx * lx + Math.sin(yaw) * sz * lz;
      const pz = z - Math.sin(yaw) * sx * lx + Math.cos(yaw) * sz * lz;
      b.box(px, y + (h - 0.04) / 2, pz, 0.05, (h - 0.04) / 2, 0.05, M.woodDark, { yaw, surface: 'wood', flags: F_PROP });
    }
  }

  chair(x: number, y: number, z: number, yaw: number, mat = M.woodDark): void {
    const b = this.b;
    b.box(x, y + 0.44, z, 0.22, 0.03, 0.22, mat, { yaw, surface: 'wood', flags: F_PROP });
    b.box(x + Math.sin(yaw) * 0.2, y + 0.7, z + Math.cos(yaw) * 0.2, 0.22, 0.26, 0.03, mat, { yaw, surface: 'wood', flags: F_PROP });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const px = x + Math.cos(yaw) * sx * 0.18 + Math.sin(yaw) * sz * 0.18;
      const pz = z - Math.sin(yaw) * sx * 0.18 + Math.cos(yaw) * sz * 0.18;
      b.box(px, y + 0.22, pz, 0.03, 0.22, 0.03, mat, { yaw, surface: 'wood', flags: F_PROP });
    }
  }

  bed(x: number, y: number, z: number, yaw: number, w = 1.6, l = 2.0): void {
    const b = this.b;
    b.box(x, y + 0.22, z, w / 2, 0.22, l / 2, M.woodDark, { yaw, surface: 'wood', flags: F_PROP });
    b.box(x, y + 0.52, z, w / 2 - 0.02, 0.1, l / 2 - 0.02, M.fabricCream, { yaw, surface: 'fabric', tint: b.jitterTint(0.05) });
    b.box(x + Math.sin(yaw) * (l / 2 - 0.25), y + 0.66, z + Math.cos(yaw) * (l / 2 - 0.25), w / 2 - 0.16, 0.07, 0.2, M.plasterWhite, { yaw, surface: 'fabric', flags: F_PROP });
    b.box(x + Math.sin(yaw) * (l / 2 + 0.05), y + 0.62, z + Math.cos(yaw) * (l / 2 + 0.05), w / 2, 0.5, 0.06, M.woodWarm, { yaw, surface: 'wood' });
  }

  wardrobe(x: number, y: number, z: number, yaw: number, w = 1.4, h = 2.1, mat = M.woodDark): void {
    const b = this.b;
    b.box(x, y + h / 2, z, w / 2, h / 2, 0.3, mat, { yaw, surface: 'wood', tint: b.jitterTint(0.05) });
    for (const s of [-1, 1]) {
      b.box(x + Math.cos(yaw) * s * w * 0.22 - Math.sin(yaw) * 0.31, y + h / 2, z - Math.sin(yaw) * s * w * 0.22 - Math.cos(yaw) * 0.31,
        w * 0.2, h / 2 - 0.06, 0.02, M.woodWarm, { yaw, surface: 'wood', flags: F_PROP });
    }
  }

  shelf(x: number, y: number, z: number, yaw: number, w = 1.2, h = 1.9): void {
    const b = this.b;
    b.box(x, y + h / 2, z, w / 2, h / 2, 0.16, M.woodWarm, { yaw, surface: 'wood', tint: b.jitterTint(0.05) });
    for (let i = 1; i <= 3; i++) {
      const yy = y + (i / 4) * h;
      const n = this.rng.int(2, 6);
      for (let k = 0; k < n; k++) {
        const off = ((k + 0.5) / n - 0.5) * (w - 0.1);
        b.box(x + Math.cos(yaw) * off, yy + 0.13, z - Math.sin(yaw) * off,
          (w / n) * 0.32, 0.13, 0.1,
          this.rng.pick([M.paintRed, M.paintBlue, M.woodDark, M.fabricTeal, M.paintYellow]),
          { yaw, surface: 'plastic', flags: F_PROP });
      }
    }
  }

  desk(x: number, y: number, z: number, yaw: number): void {
    const b = this.b;
    this.table(x, y, z, yaw, 1.6, 0.75, 0.74, M.woodDark);
    b.box(x + Math.cos(yaw) * 0.5, y + 0.35, z - Math.sin(yaw) * 0.5, 0.28, 0.35, 0.32, M.woodDark, { yaw, surface: 'wood', flags: F_PROP });
    // Monitor + papers.
    b.box(x - Math.sin(yaw) * 0.15, y + 0.98, z - Math.cos(yaw) * 0.15, 0.28, 0.18, 0.03, M.steelDark, { yaw, surface: 'plastic', flags: F_PROP });
    b.box(x + Math.cos(yaw) * -0.4, y + 0.76, z - Math.sin(yaw) * -0.4, 0.14, 0.02, 0.1, M.plasterWhite, { yaw, surface: 'plastic', flags: F_PROP });
  }

  /** Kitchen counter run: the classic waist-high interior cover. */
  counter(x0: number, z0: number, x1: number, z1: number, y: number, mat = M.woodDark): void {
    const b = this.b;
    const len = Math.hypot(x1 - x0, z1 - z0);
    const yaw = Math.atan2(-(z1 - z0), x1 - x0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    b.box(cx, y + 0.44, cz, len / 2, 0.44, 0.31, mat, { yaw, surface: 'wood', tint: b.jitterTint(0.05) });
    b.box(cx, y + 0.91, cz, len / 2 + 0.03, 0.035, 0.34, M.marble, { yaw, surface: 'tile' });
    // Upper cabinets, offset back.
    b.box(cx + Math.sin(yaw) * 0.14, y + 1.75, cz + Math.cos(yaw) * 0.14, len / 2, 0.35, 0.17, mat, {
      yaw, surface: 'wood', flags: F_PROP, tint: b.jitterTint(0.05),
    });
  }

  fridge(x: number, y: number, z: number, yaw: number): void {
    const b = this.b;
    b.box(x, y + 0.9, z, 0.36, 0.9, 0.34, M.steelGalv, { yaw, surface: 'metal', tint: b.jitterTint(0.04) });
    b.box(x - Math.sin(yaw) * 0.35, y + 1.1, z - Math.cos(yaw) * 0.35, 0.02, 0.03, 0.3, M.steelDark, { yaw, surface: 'metal', flags: F_PROP });
  }

  stove(x: number, y: number, z: number, yaw: number): void {
    const b = this.b;
    b.box(x, y + 0.45, z, 0.35, 0.45, 0.32, M.steelDark, { yaw, surface: 'metal' });
    b.box(x, y + 0.92, z, 0.36, 0.02, 0.33, M.steelGalv, { yaw, surface: 'metal', flags: F_PROP });
    b.box(x + Math.sin(yaw) * 0.3, y + 1.9, z + Math.cos(yaw) * 0.3, 0.4, 0.25, 0.25, M.steelGalv, { yaw, surface: 'metal', flags: F_PROP });
  }

  rug(x: number, y: number, z: number, yaw: number, w: number, d: number, mat = M.fabricRed): void {
    this.b.box(x, y + 0.012, z, w / 2, 0.012, d / 2, mat, { yaw, surface: 'fabric', flags: BF.NO_COVER | BF.NO_SHADOW | BF.THIN });
  }

  painting(x: number, y: number, z: number, yaw: number, w = 0.9, h = 0.7): void {
    const b = this.b;
    b.box(x, y, z, w / 2, h / 2, 0.04, M.brass, { yaw, surface: 'wood', flags: F_PROP | BF.NO_NAV });
    b.box(x - Math.sin(yaw) * 0.05, y, z - Math.cos(yaw) * 0.05, w / 2 - 0.06, h / 2 - 0.06, 0.02,
      this.rng.pick([M.fabricTeal, M.leather, M.plasterOchre, M.paintRed]),
      { yaw, surface: 'fabric', flags: F_PROP | BF.NO_NAV });
  }

  /** Warm pendant lamp — reads as an occupied room at night. */
  pendant(x: number, y: number, z: number): void {
    const b = this.b;
    b.box(x, y - 0.35, z, 0.012, 0.35, 0.012, M.steelDark, { surface: 'metal', flags: F_PROP | BF.NO_NAV });
    b.cyl(x, y - 0.78, z, 0.16, 0.1, M.lampWarm, { surface: 'glass', flags: F_PROP | BF.NO_NAV | BF.NO_SHADOW });
  }

  sconce(x: number, y: number, z: number, yaw: number): void {
    this.b.box(x, y, z, 0.09, 0.13, 0.07, M.lampWarm, { yaw, surface: 'glass', flags: F_PROP | BF.NO_NAV | BF.NO_SHADOW });
  }

  toilet(x: number, y: number, z: number, yaw: number): void {
    const b = this.b;
    b.box(x, y + 0.2, z, 0.2, 0.2, 0.28, M.plasticWhite, { yaw, surface: 'ceramic', flags: F_PROP });
    b.box(x + Math.sin(yaw) * 0.28, y + 0.45, z + Math.cos(yaw) * 0.28, 0.22, 0.25, 0.1, M.plasticWhite, { yaw, surface: 'ceramic', flags: F_PROP });
  }

  basin(x: number, y: number, z: number, yaw: number): void {
    const b = this.b;
    b.box(x, y + 0.85, z, 0.3, 0.09, 0.22, M.plasticWhite, { yaw, surface: 'ceramic', flags: F_PROP });
    b.box(x, y + 1.45, z, 0.35, 0.35, 0.03, M.glass, { yaw, surface: 'glass', flags: F_PROP | BF.NO_NAV | BF.SOFT | BF.NO_SHADOW });
  }

  // ==== exterior dressing =================================================

  planter(x: number, y: number, z: number, r = 0.55, mat = M.terracottaOld): void {
    const b = this.b;
    b.cyl(x, y + 0.3, z, r, 0.3, mat, { surface: 'ceramic', tint: b.jitterTint(0.06) });
    b.cyl(x, y + 0.95, z, r * 0.9, 0.45, M.leafDark, { surface: 'foliage', flags: F_SOFT | BF.NO_COVER, tint: b.jitterTint(0.1) });
  }

  hedge(x0: number, z0: number, x1: number, z1: number, y: number, h = 1.1, w = 0.8): void {
    const b = this.b;
    const len = Math.hypot(x1 - x0, z1 - z0);
    const yaw = Math.atan2(-(z1 - z0), x1 - x0);
    const n = Math.max(1, Math.round(len / 1.6));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const jx = this.rng.range(-0.06, 0.06);
      b.box(x0 + (x1 - x0) * t, y + h / 2 + jx, z0 + (z1 - z0) * t,
        len / (2 * n) + 0.05, h / 2, w / 2, this.rng.bool(0.5) ? M.leafDark : M.leafMid,
        { yaw, surface: 'foliage', flags: BF.SOFT | BF.NO_SHADOW | BF.NO_WALK, tint: b.jitterTint(0.12) });
    }
  }

  palm(x: number, y: number, z: number, height = 7): void {
    const b = this.b;
    const lean = this.rng.range(-0.1, 0.1);
    const segs = 5;
    for (let i = 0; i < segs; i++) {
      const t = i / segs;
      const yy = y + height * (t + 0.5 / segs);
      b.cyl(x + lean * yy * 0.12, yy, z, 0.19 - t * 0.07, height / (2 * segs), M.bark, {
        surface: 'wood', tint: b.jitterTint(0.08),
      });
    }
    const tx = x + lean * (y + height) * 0.12;
    const fronds = 7;
    for (let i = 0; i < fronds; i++) {
      const a = (i / fronds) * Math.PI * 2 + this.rng.range(-0.2, 0.2);
      const len = this.rng.range(1.6, 2.5);
      b.box(tx + Math.cos(a) * len * 0.5, y + height + 0.15 - len * 0.12, z + Math.sin(a) * len * 0.5,
        len / 2, 0.05, 0.28, this.rng.bool(0.7) ? M.leafMid : M.leafDry,
        { yaw: -a, surface: 'foliage', flags: F_SOFT | BF.NO_COVER, tint: b.jitterTint(0.14) });
    }
  }

  cypress(x: number, y: number, z: number, height = 6): void {
    const b = this.b;
    b.cyl(x, y + height * 0.25, z, 0.13, height * 0.25, M.bark, { surface: 'wood' });
    for (let i = 0; i < 4; i++) {
      const t = i / 4;
      b.cyl(x, y + height * (0.35 + t * 0.62), z, 0.85 * (1 - t * 0.75), height * 0.16,
        i % 2 ? M.leafDark : M.leafMid, { surface: 'foliage', flags: BF.SOFT | BF.NO_COVER | BF.NO_NAV, tint: b.jitterTint(0.1) });
    }
  }

  /** Broad shade tree — the thing that breaks up a courtyard's sightlines. */
  shadeTree(x: number, y: number, z: number, height = 8): void {
    const b = this.b;
    b.cyl(x, y + height * 0.28, z, 0.28, height * 0.28, M.bark, { surface: 'wood', tint: b.jitterTint(0.08) });
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.rng.range(1.0, 1.9);
      b.box(x + Math.cos(a) * r * 0.7, y + height * this.rng.range(0.62, 0.86), z + Math.sin(a) * r * 0.7,
        r, this.rng.range(0.6, 1.0), r * 0.9,
        this.rng.bool(0.6) ? M.leafDark : M.leafMid,
        { yaw: a, surface: 'foliage', flags: BF.SOFT | BF.NO_COVER | BF.NO_NAV, tint: b.jitterTint(0.12) });
    }
  }

  sunLounger(x: number, y: number, z: number, yaw: number): void {
    const b = this.b;
    b.box(x, y + 0.34, z, 0.36, 0.04, 0.95, M.woodPale, { yaw, surface: 'wood', flags: F_PROP });
    b.box(x + Math.sin(yaw) * 0.7, y + 0.55, z + Math.cos(yaw) * 0.7, 0.36, 0.24, 0.06, M.fabricCream, { yaw: yaw + 0.3, surface: 'fabric', flags: F_PROP });
    for (const s of [-1, 1]) {
      b.box(x + Math.sin(yaw) * s * 0.8, y + 0.16, z + Math.cos(yaw) * s * 0.8, 0.32, 0.16, 0.04, M.woodPale, { yaw, surface: 'wood', flags: F_PROP });
    }
  }

  parasol(x: number, y: number, z: number): void {
    const b = this.b;
    b.cyl(x, y + 1.1, z, 0.05, 1.1, M.woodPale, { surface: 'wood', flags: F_PROP });
    b.cyl(x, y + 2.25, z, 1.5, 0.09, M.fabricCream, { surface: 'fabric', flags: F_PROP | BF.NO_NAV, tint: b.jitterTint(0.05) });
    b.cyl(x, y + 2.45, z, 0.9, 0.12, M.fabricCream, { surface: 'fabric', flags: F_PROP | BF.NO_NAV });
  }

  /** Pergola: slatted shade structure. Fantastic for striped light. */
  pergola(minX: number, minZ: number, maxX: number, maxZ: number, y: number, h = 2.9): void {
    const b = this.b;
    const postR = 0.12;
    for (const px of [minX + postR, maxX - postR]) {
      for (const pz of [minZ + postR, maxZ - postR]) {
        b.box(px, y + h / 2, pz, postR, h / 2, postR, M.woodWarm, { surface: 'wood', tint: b.jitterTint(0.06) });
      }
    }
    const midX = (minX + maxX) / 2, midZ = (minZ + maxZ) / 2;
    b.span(minX, y + h, minZ, maxX, y + h + 0.16, minZ + 0.18, M.woodWarm, { surface: 'wood', flags: BF.NO_COVER });
    b.span(minX, y + h, maxZ - 0.18, maxX, y + h + 0.16, maxZ, M.woodWarm, { surface: 'wood', flags: BF.NO_COVER });
    const slats = Math.max(4, Math.round((maxX - minX) / 0.45));
    for (let i = 0; i <= slats; i++) {
      const x = minX + ((maxX - minX) * i) / slats;
      b.box(x, y + h + 0.24, midZ, 0.055, 0.08, (maxZ - minZ) / 2, M.woodWarm, {
        surface: 'wood', flags: BF.NO_COVER | BF.NO_NAV, tint: b.jitterTint(0.07),
      });
    }
    void midX;
  }

  fountain(x: number, y: number, z: number, r = 2.4): void {
    const b = this.b;
    b.cyl(x, y + 0.3, z, r, 0.3, M.stoneTrim, { surface: 'concrete', tint: b.jitterTint(0.04) });
    b.cyl(x, y + 0.34, z, r - 0.28, 0.22, M.water, { surface: 'water', flags: BF.SOFT | BF.NO_SHADOW | BF.NO_COVER | BF.NO_NAV });
    b.cyl(x, y + 0.8, z, 0.3, 0.5, M.stoneTrim, { surface: 'concrete', flags: BF.NO_COVER });
    b.cyl(x, y + 1.25, z, 0.85, 0.09, M.stoneTrim, { surface: 'concrete', flags: BF.NO_COVER });
    b.cyl(x, y + 1.6, z, 0.16, 0.3, M.stoneTrim, { surface: 'concrete', flags: BF.NO_COVER });
  }

  // ==== utility / industrial ==============================================

  drum(x: number, y: number, z: number, mat?: number): void {
    const m = mat ?? this.rng.pick([M.rust, M.paintBlue, M.paintRed, M.paintYellow]);
    this.b.cyl(x, y + 0.44, z, 0.29, 0.44, m, { surface: 'metal', tint: this.b.jitterTint(0.07) });
  }

  crate(x: number, y: number, z: number, yaw: number, s = 0.6): void {
    this.b.box(x, y + s, z, s, s, s * 0.8, M.woodWeathered, { yaw, surface: 'wood', tint: this.b.jitterTint(0.08) });
  }

  pallet(x: number, y: number, z: number, yaw: number, stack = 3): void {
    for (let i = 0; i < stack; i++) {
      this.b.box(x, y + 0.07 + i * 0.15, z, 0.6, 0.06, 0.5, M.woodWeathered, { yaw, surface: 'wood', tint: this.b.jitterTint(0.08) });
    }
  }

  sandbags(x0: number, z0: number, x1: number, z1: number, y: number, rows = 3): void {
    const b = this.b;
    const len = Math.hypot(x1 - x0, z1 - z0);
    const yaw = Math.atan2(-(z1 - z0), x1 - x0);
    const perRow = Math.max(1, Math.round(len / 0.55));
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < perRow; i++) {
        const t = (i + 0.5 + (r % 2) * 0.25) / perRow;
        if (t > 1) continue;
        b.box(x0 + (x1 - x0) * t, y + 0.13 + r * 0.24, z0 + (z1 - z0) * t,
          len / (2 * perRow) + 0.02, 0.12, 0.24 - r * 0.015, M.sandbag,
          { yaw, surface: 'sand', tint: b.jitterTint(0.09) });
      }
    }
  }

  jerseyBarrier(x: number, y: number, z: number, yaw: number, len = 3.0): void {
    const b = this.b;
    b.box(x, y + 0.22, z, len / 2, 0.22, 0.35, M.concreteRaw, { yaw, surface: 'concrete', tint: b.jitterTint(0.05) });
    b.box(x, y + 0.72, z, len / 2, 0.3, 0.16, M.concreteRaw, { yaw, surface: 'concrete', tint: b.jitterTint(0.05) });
  }

  container(x: number, y: number, z: number, yaw: number, mat?: number): void {
    const b = this.b;
    const m = mat ?? this.rng.pick([M.paintGreen, M.paintRed, M.paintBlue, M.rust, M.paintYellow]);
    b.box(x, y + 1.3, z, 3.03, 1.3, 1.22, m, { yaw, surface: 'metal', tint: b.jitterTint(0.06) });
    // Corrugation ribs read at distance and stop it looking like a plain box.
    for (let i = -4; i <= 4; i++) {
      b.box(x + Math.cos(yaw) * i * 0.62, y + 1.3, z - Math.sin(yaw) * i * 0.62, 0.05, 1.22, 1.25, m, {
        yaw, surface: 'metal', flags: BF.NO_COVER, tint: b.jitterTint(0.1),
      });
    }
    b.box(x, y + 2.63, z, 3.05, 0.05, 1.24, M.steelDark, { yaw, surface: 'metal', flags: BF.NO_COVER });
  }

  waterTank(x: number, y: number, z: number, r = 1.1, h = 1.8): void {
    const b = this.b;
    b.cyl(x, y + h / 2, z, r, h / 2, M.plasticWhite, { surface: 'plastic', tint: b.jitterTint(0.05) });
    b.cyl(x, y + h + 0.06, z, r * 0.4, 0.08, M.steelDark, { surface: 'metal', flags: BF.NO_COVER });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      b.box(x + Math.cos(a) * (r - 0.1), y + 0.3, z + Math.sin(a) * (r - 0.1), 0.06, 0.3, 0.06, M.steelDark, { surface: 'metal', flags: BF.NO_COVER });
    }
  }

  acUnit(x: number, y: number, z: number, yaw: number): void {
    const b = this.b;
    b.box(x, y + 0.35, z, 0.5, 0.35, 0.35, M.steelGalv, { yaw, surface: 'metal', tint: b.jitterTint(0.05) });
    b.cyl(x, y + 0.72, z, 0.32, 0.03, M.steelDark, { yaw, surface: 'metal', flags: BF.NO_COVER });
  }

  satelliteDish(x: number, y: number, z: number, yaw: number, r = 0.85): void {
    const b = this.b;
    b.cyl(x, y + 0.5, z, 0.07, 0.5, M.steelDark, { surface: 'metal', flags: BF.NO_COVER });
    b.box(x, y + 1.1, z, r, r * 0.9, 0.09, M.plasticWhite, { yaw: yaw + 0.4, surface: 'plastic', flags: BF.NO_COVER });
  }

  generator(x: number, y: number, z: number, yaw: number): void {
    const b = this.b;
    b.box(x, y + 0.6, z, 1.1, 0.6, 0.6, M.paintYellow, { yaw, surface: 'metal', tint: b.jitterTint(0.05) });
    b.box(x, y + 1.28, z, 0.9, 0.1, 0.5, M.steelDark, { yaw, surface: 'metal', flags: BF.NO_COVER });
    b.cyl(x + Math.cos(yaw) * 0.9, y + 1.6, z - Math.sin(yaw) * 0.9, 0.09, 0.5, M.rust, { surface: 'metal', flags: BF.NO_COVER });
  }

  floodlight(x: number, y: number, z: number, yaw: number, h = 4.5): void {
    const b = this.b;
    b.cyl(x, y + h / 2, z, 0.09, h / 2, M.steelGalv, { surface: 'metal' });
    b.box(x + Math.cos(yaw) * 0.3, y + h + 0.1, z - Math.sin(yaw) * 0.3, 0.32, 0.2, 0.14, M.steelDark, { yaw, surface: 'metal', flags: BF.NO_COVER });
    b.box(x + Math.cos(yaw) * 0.45, y + h + 0.1, z - Math.sin(yaw) * 0.45, 0.06, 0.17, 0.11, M.lampCold, { yaw, surface: 'glass', flags: BF.NO_COVER | BF.NO_SHADOW });
  }

  streetLamp(x: number, y: number, z: number, h = 4.0): void {
    const b = this.b;
    b.cyl(x, y + h / 2, z, 0.08, h / 2, M.steelDark, { surface: 'metal' });
    b.cyl(x, y + h + 0.18, z, 0.22, 0.2, M.lampWarm, { surface: 'glass', flags: BF.NO_COVER | BF.NO_SHADOW });
    b.cyl(x, y + h + 0.42, z, 0.26, 0.06, M.steelDark, { surface: 'metal', flags: BF.NO_COVER });
  }

  cctv(x: number, y: number, z: number, yaw: number): void {
    const b = this.b;
    b.box(x, y, z, 0.06, 0.06, 0.22, M.plasticWhite, { yaw, surface: 'plastic', flags: BF.NO_COVER | BF.NO_NAV });
    b.box(x + Math.cos(yaw) * 0.24, y - 0.04, z - Math.sin(yaw) * 0.24, 0.05, 0.05, 0.05, M.steelDark, { yaw, surface: 'plastic', flags: BF.NO_COVER | BF.NO_NAV });
  }

  tyreStack(x: number, y: number, z: number, n = 4): void {
    for (let i = 0; i < n; i++) {
      this.b.cyl(x + this.rng.range(-0.05, 0.05), y + 0.11 + i * 0.21, z + this.rng.range(-0.05, 0.05), 0.42, 0.11, M.rubber, {
        yaw: this.rng.range(0, 3), surface: 'rubber',
      });
    }
  }

  // ==== vehicles ==========================================================

  /** Blocky 4x4 — reads instantly and gives hard three-quarter cover. */
  suv(x: number, y: number, z: number, yaw: number, mat?: number): void {
    const b = this.b;
    const m = mat ?? this.rng.pick([M.steelDark, M.plasterWhite, M.paintBlue, M.concreteDark]);
    b.box(x, y + 0.78, z, 2.42, 0.42, 0.98, m, { yaw, surface: 'metal', tint: b.jitterTint(0.05) });
    b.box(x - Math.cos(yaw) * 0.15, y + 1.42, z + Math.sin(yaw) * 0.15, 1.32, 0.34, 0.9, m, { yaw, surface: 'metal', tint: b.jitterTint(0.05) });
    // Glazing.
    b.box(x - Math.cos(yaw) * 0.15, y + 1.44, z + Math.sin(yaw) * 0.15, 1.26, 0.28, 0.92, M.glass, {
      yaw, surface: 'glass', flags: BF.SOFT | BF.TRANSPARENT | BF.NO_SHADOW | BF.NO_COVER | BF.THIN,
    });
    b.box(x, y + 1.78, z, 1.3, 0.05, 0.88, m, { yaw, surface: 'metal', flags: BF.NO_COVER });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const px = x + Math.cos(yaw) * sx * 1.6 + Math.sin(yaw) * sz * 0.92;
      const pz = z - Math.sin(yaw) * sx * 1.6 + Math.cos(yaw) * sz * 0.92;
      b.cyl(px, y + 0.4, pz, 0.4, 0.16, M.rubber, { yaw: yaw + Math.PI / 2, surface: 'rubber', flags: BF.NO_COVER });
    }
    b.box(x + Math.cos(yaw) * 2.4, y + 0.82, z - Math.sin(yaw) * 2.4, 0.06, 0.14, 0.7, M.lampCold, { yaw, surface: 'glass', flags: BF.NO_COVER | BF.NO_SHADOW });
  }

  pickup(x: number, y: number, z: number, yaw: number, mat?: number): void {
    const b = this.b;
    const m = mat ?? this.rng.pick([M.paintRed, M.rust, M.plasterWhite, M.paintGreen]);
    b.box(x, y + 0.72, z, 2.6, 0.36, 0.94, m, { yaw, surface: 'metal', tint: b.jitterTint(0.06) });
    b.box(x - Math.cos(yaw) * 0.55, y + 1.34, z + Math.sin(yaw) * 0.55, 0.85, 0.32, 0.86, m, { yaw, surface: 'metal' });
    b.box(x - Math.cos(yaw) * 0.55, y + 1.36, z + Math.sin(yaw) * 0.55, 0.8, 0.26, 0.88, M.glass, {
      yaw, surface: 'glass', flags: BF.SOFT | BF.TRANSPARENT | BF.NO_SHADOW | BF.NO_COVER | BF.THIN,
    });
    // Bed walls.
    for (const s of [-1, 1]) {
      b.box(x + Math.cos(yaw) * 1.2 + Math.sin(yaw) * s * 0.88, y + 1.12, z - Math.sin(yaw) * 1.2 + Math.cos(yaw) * s * 0.88,
        1.3, 0.28, 0.06, m, { yaw, surface: 'metal' });
    }
    b.box(x + Math.cos(yaw) * 2.5, y + 1.12, z - Math.sin(yaw) * 2.5, 0.06, 0.28, 0.88, m, { yaw, surface: 'metal' });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const px = x + Math.cos(yaw) * sx * 1.75 + Math.sin(yaw) * sz * 0.9;
      const pz = z - Math.sin(yaw) * sx * 1.75 + Math.cos(yaw) * sz * 0.9;
      b.cyl(px, y + 0.38, pz, 0.38, 0.15, M.rubber, { yaw: yaw + Math.PI / 2, surface: 'rubber', flags: BF.NO_COVER });
    }
  }

  sedan(x: number, y: number, z: number, yaw: number, mat?: number): void {
    const b = this.b;
    const m = mat ?? this.rng.pick([M.concreteDark, M.paintBlue, M.plasterWhite, M.steelDark]);
    b.box(x, y + 0.6, z, 2.2, 0.32, 0.88, m, { yaw, surface: 'metal', tint: b.jitterTint(0.05) });
    b.box(x, y + 1.05, z, 1.1, 0.26, 0.8, m, { yaw, surface: 'metal' });
    b.box(x, y + 1.07, z, 1.05, 0.21, 0.82, M.glass, {
      yaw, surface: 'glass', flags: BF.SOFT | BF.TRANSPARENT | BF.NO_SHADOW | BF.NO_COVER | BF.THIN,
    });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const px = x + Math.cos(yaw) * sx * 1.45 + Math.sin(yaw) * sz * 0.85;
      const pz = z - Math.sin(yaw) * sx * 1.45 + Math.cos(yaw) * sz * 0.85;
      b.cyl(px, y + 0.32, pz, 0.32, 0.14, M.rubber, { yaw: yaw + Math.PI / 2, surface: 'rubber', flags: BF.NO_COVER });
    }
  }

  // ==== tier three ========================================================
  //
  // The size class the whole project was missing.
  //
  // A brick census of both maps put objects under 0.4 m at **0.7% of the
  // villa's exterior geometry and 0.04% of the quay's**, against a reference
  // distribution where that tier is 55-70%. That is the mechanical definition
  // of a map reading as "lazy": not too few objects, the wrong SIZE of
  // objects. There was nothing at the scale your eye lands on when you look at
  // a wall from four metres — no conduit, no junction box, no downpipe, no
  // vent, no bracket, no sign, no cable, no cone, no bottle, no litter.
  //
  // Everything below is under half a metre, costs one to four bricks, and is
  // flagged out of the navmesh and the cover graph so a thousand of them
  // change how the map LOOKS without changing how it plays.

  /** Conduit run down a wall face. `yaw` faces the wall's outward normal. */
  conduitRun(x: number, y0: number, z: number, yaw: number, h: number, mat = M.steelGalv): void {
    const b = this.b;
    b.box(x, y0 + h / 2, z, 0.025, h / 2, 0.025, mat,
      { yaw, surface: 'metal', flags: F_THIN });
    // Saddle clips, which is what stops it reading as a floating line.
    const clips = Math.max(2, Math.round(h / 0.9));
    for (let i = 1; i < clips; i++) {
      b.box(x, y0 + (i / clips) * h, z, 0.045, 0.02, 0.045, M.steelDark,
        { yaw, surface: 'metal', flags: F_THIN });
    }
  }

  junctionBox(x: number, y: number, z: number, yaw: number, mat = M.steelGalv): void {
    const b = this.b;
    b.box(x, y, z, 0.11, 0.14, 0.055, mat, { yaw, surface: 'metal', flags: F_THIN });
    b.box(x, y - 0.16, z, 0.02, 0.03, 0.02, M.sootMetal, { yaw, surface: 'metal', flags: F_THIN });
  }

  downpipe(x: number, y0: number, z: number, yaw: number, h: number): void {
    const b = this.b;
    b.cyl(x, y0 + h / 2, z, 0.055, h / 2, M.plasticWhite, { surface: 'plastic', flags: F_THIN });
    // Shoe at the bottom, and the wet stain under it.
    b.box(x, y0 + 0.14, z, 0.07, 0.14, 0.10, M.plasticWhite, { yaw, surface: 'plastic', flags: F_THIN });
    b.box(x, y0 + 0.006, z, 0.34, 0.006, 0.28, M.concreteDark,
      { yaw, surface: 'concrete', flags: F_DECAL, tint: b.jitterTint(0.10) });
  }

  wallVent(x: number, y: number, z: number, yaw: number): void {
    const b = this.b;
    b.box(x, y, z, 0.21, 0.16, 0.03, M.sootMetal, { yaw, surface: 'metal', flags: F_THIN });
    for (let i = -2; i <= 2; i++) {
      b.box(x, y + i * 0.055, z, 0.19, 0.014, 0.045, M.steelDark,
        { yaw, surface: 'metal', flags: F_THIN });
    }
  }

  /** A cable sagging off a wall or a pole. Two segments read as a catenary. */
  cableDrop(x: number, y: number, z: number, yaw: number, len = 1.6): void {
    const b = this.b;
    for (const s of [-1, 1]) {
      b.box(x + Math.cos(yaw) * s * len * 0.25, y - len * 0.09, z - Math.sin(yaw) * s * len * 0.25,
        len * 0.25, 0.016, 0.016, M.sootMetal, { yaw, surface: 'plastic', flags: F_THIN });
    }
    b.box(x, y - len * 0.17, z, len * 0.2, 0.016, 0.016, M.sootMetal,
      { yaw, surface: 'plastic', flags: F_THIN });
  }

  signPlate(x: number, y: number, z: number, yaw: number, w = 0.34, h = 0.24, mat = M.plasticWhite): void {
    const b = this.b;
    b.box(x, y, z, w / 2, h / 2, 0.012, mat, { yaw, surface: 'plastic', flags: F_THIN });
    b.box(x, y, z - 0.004, w / 2 - 0.03, h / 2 - 0.03, 0.014, M.paintRed,
      { yaw, surface: 'plastic', flags: F_THIN });
  }

  cone(x: number, y: number, z: number): void {
    const b = this.b;
    b.box(x, y + 0.012, z, 0.16, 0.012, 0.16, M.rubber, { surface: 'rubber', flags: F_PROP });
    b.cyl(x, y + 0.20, z, 0.10, 0.19, M.paintOrange, { surface: 'plastic', flags: F_PROP });
    b.cyl(x, y + 0.27, z, 0.075, 0.045, M.plasticWhite, { surface: 'plastic', flags: F_THIN });
  }

  hoseCoil(x: number, y: number, z: number, r = 0.28): void {
    const b = this.b;
    for (let i = 0; i < 3; i++) {
      b.cyl(x, y + 0.04 + i * 0.055, z, r - i * 0.03, 0.028, M.rubber,
        { surface: 'rubber', flags: F_PROP });
    }
  }

  bottleCluster(x: number, y: number, z: number, n = 4): void {
    const b = this.b;
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const d = this.rng.range(0, 0.22);
      b.cyl(x + Math.cos(a) * d, y + 0.11, z + Math.sin(a) * d, 0.035, 0.11,
        this.rng.next() < 0.5 ? M.glass : M.plasticWhite,
        { surface: 'glass', flags: F_THIN, tint: b.jitterTint(0.12) });
    }
  }

  rubbishBag(x: number, y: number, z: number): void {
    const b = this.b;
    b.box(x, y + 0.19, z, this.rng.range(0.20, 0.28), 0.19, this.rng.range(0.18, 0.26),
      M.shadowBlack, { yaw: this.rng.range(0, 3.14), surface: 'plastic', flags: F_PROP,
        tint: b.jitterTint(0.10) });
  }

  roofAerial(x: number, y: number, z: number, h = 1.9): void {
    const b = this.b;
    b.cyl(x, y + h / 2, z, 0.022, h / 2, M.steelGalv, { surface: 'metal', flags: F_THIN });
    for (let i = 0; i < 4; i++) {
      b.box(x, y + h * (0.55 + i * 0.11), z, 0.24 - i * 0.04, 0.012, 0.012, M.steelGalv,
        { surface: 'metal', flags: F_THIN });
    }
    b.box(x, y + 0.05, z, 0.13, 0.05, 0.13, M.concreteDark, { surface: 'concrete', flags: F_PROP });
  }

  // ==== ground decals =====================================================
  //
  // Thin slabs, out of the navmesh and the cover graph, sitting a couple of
  // centimetres above the paving. The bottom 38% of every measured frame had a
  // row-luminance standard deviation of 0.012-0.025 — a constant grey —
  // because 20,592 m2 of villa ground was eight bricks and 28,500 m2 of quay
  // asphalt was ONE. This is the cheapest way to fix a third of the screen.

  /** Painted line, bay marking, hatching. */
  paintMarking(x0: number, z0: number, x1: number, z1: number, y: number, mat = M.plasterWhite): void {
    this.b.span(Math.min(x0, x1), y, Math.min(z0, z1), Math.max(x0, x1), y + 0.008, Math.max(z0, z1),
      mat, { surface: 'concrete', flags: F_DECAL, tint: this.b.jitterTint(0.08) });
  }

  /** A pair of worn tyre tracks running through a turn. */
  tyreTrack(x: number, z: number, yaw: number, len = 6, gauge = 1.7): void {
    const b = this.b;
    for (const s of [-1, 1]) {
      b.box(x + Math.sin(yaw) * s * gauge / 2, this.decalY, z + Math.cos(yaw) * s * gauge / 2,
        0.16, 0.005, len / 2, M.concreteDark,
        { yaw, surface: 'concrete', flags: F_DECAL, tint: b.jitterTint(0.10) });
    }
  }

  oilPatch(x: number, y: number, z: number, r = 0.55): void {
    const b = this.b;
    b.box(x, y + 0.005, z, r, 0.005, r * this.rng.range(0.6, 1.0), M.tarBlack,
      { yaw: this.rng.range(0, 3.14), surface: 'concrete', flags: F_DECAL, tint: b.jitterTint(0.14) });
  }

  puddle(x: number, y: number, z: number, r = 0.9): void {
    const b = this.b;
    b.box(x, y + 0.006, z, r, 0.006, r * this.rng.range(0.5, 0.95), M.water,
      { yaw: this.rng.range(0, 3.14), surface: 'water', flags: F_DECAL });
  }

  /** A darker rectangle of newer surfacing — a trench that was dug and filled. */
  patchRepair(x: number, z: number, y: number, w = 2.2, d = 1.4): void {
    const b = this.b;
    b.box(x, y + 0.012, z, w / 2, 0.012, d / 2, M.asphalt,
      { yaw: this.rng.range(-0.06, 0.06), surface: 'concrete', flags: F_DECAL,
        tint: b.jitterTint(0.16) });
  }

  crackLine(x: number, z: number, y: number, yaw: number, len = 3): void {
    const b = this.b;
    let cx = x, cz = z, a = yaw;
    for (let i = 0; i < 3; i++) {
      const seg = len / 3;
      b.box(cx + Math.sin(a) * seg / 2, y + 0.004, cz + Math.cos(a) * seg / 2,
        0.035, 0.004, seg / 2, M.concreteDark,
        { yaw: a, surface: 'concrete', flags: F_DECAL });
      cx += Math.sin(a) * seg;
      cz += Math.cos(a) * seg;
      a += this.rng.range(-0.5, 0.5);
    }
  }

  /** Set by `wash` so the decal helpers know what height to sit at. */
  private decalY = 0;

  /**
   * Scatter ground wear across a region.
   *
   * `density` is decals per 100 m2. Sixteen is a working yard; six is a lawn
   * edge or a quiet corner.
   */
  wash(x0: number, z0: number, x1: number, z1: number, y: number, density = 12): void {
    this.decalY = y + 0.004;
    const area = Math.abs((x1 - x0) * (z1 - z0));
    const n = Math.max(1, Math.round((area / 100) * density));
    for (let i = 0; i < n; i++) {
      const x = this.rng.range(Math.min(x0, x1), Math.max(x0, x1));
      const z = this.rng.range(Math.min(z0, z1), Math.max(z0, z1));
      const r = this.rng.next();
      if (r < 0.26) this.patchRepair(x, z, y, this.rng.range(1.2, 3.4), this.rng.range(0.8, 2.0));
      else if (r < 0.48) this.crackLine(x, z, y, this.rng.range(0, 3.14), this.rng.range(1.6, 4.5));
      else if (r < 0.68) this.oilPatch(x, y, z, this.rng.range(0.25, 0.8));
      else if (r < 0.80) this.tyreTrack(x, z, this.rng.range(0, 3.14), this.rng.range(3, 9));
      else if (r < 0.90) this.puddle(x, y, z, this.rng.range(0.4, 1.3));
      else this.litter(x, y, z, this.rng.range(0.6, 1.6));
    }
  }

  /**
   * Grit, chips, a stray bolt, a flattened can.
   *
   * The smallest thing in the library and the one there is most of. It exists
   * because 20,592 m2 of villa ground and 28,500 m2 of quay asphalt were, in
   * total, nine bricks — and the bottom third of every frame measured out at a
   * luminance standard deviation of two hundredths.
   */
  litter(x: number, y: number, z: number, spread = 1.0): void {
    const b = this.b;
    const n = 3 + Math.floor(this.rng.next() * 5);
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const d = this.rng.range(0, spread);
      const r = this.rng.next();
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      if (r < 0.55) {
        b.box(px, y + 0.018, pz, this.rng.range(0.03, 0.09), 0.018, this.rng.range(0.03, 0.09),
          this.rng.next() < 0.5 ? M.concreteDark : M.sootMetal,
          { yaw: this.rng.range(0, 3.14), surface: 'gravel', flags: F_DECAL,
            tint: b.jitterTint(0.16) });
      } else if (r < 0.8) {
        b.box(px, y + 0.012, pz, this.rng.range(0.05, 0.11), 0.012, this.rng.range(0.02, 0.05),
          M.plasticWhite, { yaw: this.rng.range(0, 3.14), surface: 'plastic', flags: F_DECAL,
            tint: b.jitterTint(0.14) });
      } else {
        b.cyl(px, y + 0.035, pz, 0.032, 0.035, M.steelGalv,
          { surface: 'metal', flags: F_THIN });
      }
    }
  }

  /**
   * Scatter tier-three clutter across a region.
   *
   * `density` is objects per 100 m2. Reference dressing in a working area is
   * 8-15; a formal terrace or a lawn wants 2-4.
   */
  dress(x0: number, z0: number, x1: number, z1: number, y: number, density = 9): void {
    const area = Math.abs((x1 - x0) * (z1 - z0));
    const n = Math.max(1, Math.round((area / 100) * density));
    for (let i = 0; i < n; i++) {
      const x = this.rng.range(Math.min(x0, x1), Math.max(x0, x1));
      const z = this.rng.range(Math.min(z0, z1), Math.max(z0, z1));
      const r = this.rng.next();
      if (r < 0.20) this.cone(x, y, z);
      else if (r < 0.38) this.bottleCluster(x, y, z, 2 + Math.floor(this.rng.next() * 4));
      else if (r < 0.54) this.rubbishBag(x, y, z);
      else if (r < 0.68) this.hoseCoil(x, y, z, this.rng.range(0.18, 0.34));
      else if (r < 0.80) this.crate(x, y, z, this.rng.range(0, 3.14), this.rng.range(0.22, 0.38));
      else if (r < 0.90) this.tyreStack(x, y, z, 1 + Math.floor(this.rng.next() * 3));
      else this.drum(x, y, z);
    }
  }

  /**
   * Dress a wall FACE with services: conduit, boxes, vents, downpipes, signs.
   *
   * `(x0,z0)-(x1,z1)` is the line of the face and `out` is which side the
   * fittings stand proud on (+1 or -1). This is the pass that makes a wall
   * read at three metres; without it a wall reads identically at 60 m and at 3.
   */
  services(
    x0: number, z0: number, x1: number, z1: number, y: number, h: number,
    out = 1, density = 0.10,
  ): void {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 1e-3) return;
    const ux = (x1 - x0) / len, uz = (z1 - z0) / len;
    const yaw = Math.atan2(-uz, ux);
    const nx = -uz * out, nz = ux * out;
    const n = Math.max(1, Math.round(len * density));
    for (let i = 0; i < n; i++) {
      const d = this.rng.range(0.6, len - 0.6);
      const px = x0 + ux * d + nx * 0.06;
      const pz = z0 + uz * d + nz * 0.06;
      const r = this.rng.next();
      if (r < 0.26) this.conduitRun(px, y + 0.4, pz, yaw, this.rng.range(1.2, h - 0.6));
      else if (r < 0.44) this.junctionBox(px, y + this.rng.range(1.1, 1.9), pz, yaw);
      else if (r < 0.60) this.wallVent(px, y + this.rng.range(1.9, Math.max(2.1, h - 0.5)), pz, yaw);
      else if (r < 0.76) this.downpipe(px, y, pz, yaw, h - 0.15);
      else if (r < 0.88) this.signPlate(px, y + this.rng.range(1.3, 2.0), pz, yaw);
      else this.cableDrop(px, y + this.rng.range(2.2, Math.max(2.4, h - 0.4)), pz, yaw);
    }
  }
}

export { SHAPE_CYL };
