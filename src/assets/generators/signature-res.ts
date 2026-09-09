/**
 * Signature housing: three landmarks in each of the five themes.
 *
 * Not the top of the density ladder -- that is `housing.ts`, and its job is to
 * be repeated. These are the ones there is one of on a map: the block on the
 * corner everybody gives directions by, the courtyard you can see through the
 * gate of, the crescent the district is named after. They are still *housing*,
 * so they are three to nine storeys and thirty metres tall, not two hundred: a
 * residential landmark is distinguished by being better, not by being taller,
 * and a tower where a street wants a mansion block is the single most common
 * way a city builder stops looking like a city.
 *
 * Three archetypes, each built for all five themes. The archetype decides the
 * massing -- corner, courtyard, crescent -- and the theme decides what the
 * building actually is: the corner block is a Haussmann rotunda in Europe, a
 * brownstone with fire escapes in America, a shophouse turret with a tiled cap
 * in Asia, a glazed drum in the modern theme and a dovecote on a farm. That is
 * the division `housing.ts` already uses, taken up a level -- and at this
 * level the theme is allowed to change the massing too, which is why the
 * crescent branches at the top rather than at the trim.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import { THEMES, THEME_ORDER, hip, mansard, dormer } from '../themes';
import type { Theme, ThemeProfile } from '../themes';
import { roofOver, punched, doorway } from '../themed-parts';
import {
  balconyStack, cap, flags, forecourt, loft, marquee, plan, scaled, shelf,
} from './signature-parts';
import {
  awning, band, bollards, entrance, fireEscape, parapet, planter, railing,
  roofClutter, shopfront, steps,
} from '../parts';
import { bench, hedge, tree } from './landscape';
import { figure } from './vehicles';

/**
 * Windows on all four faces of an added mass.
 *
 * The towers and slabs each theme stands on its block are the only pieces
 * here not drawn by `punched`, and left bare they read as packaging. This is
 * the cheap general version: a row per floor per elevation.
 */
function glazeAll(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number,
  base: number, floors: number, fh: number): void {
  const nx = Math.max(2, Math.round((x1 - x0) / 4.2));
  const nz = Math.max(2, Math.round((z1 - z0) / 4.2));
  for (let f = 0; f < floors; f++) {
    const y = base + f * fh;
    for (const [axis, sign, pln, a, b, n] of [
      ['z', 1, z1, x0 + 1.2, x1 - 1.2, nx], ['z', -1, z0, x0 + 1.2, x1 - 1.2, nx],
      ['x', 1, x1, z0 + 1.2, z1 - 1.2, nz], ['x', -1, x0, z0 + 1.2, z1 - 1.2, nz],
    ] as const) {
      m.windowRow({
        axis, sign, plane: pln, from: a, to: b, y0: y + 0.85, y1: y + fh - 0.95,
        count: n, width: 1.9, glass: MAT.PANE, frame: 0.1, proud: 0.06,
      });
    }
  }
}

/** Storeys a signature block of this theme runs to. Housing scale, throughout. */
const STOREYS: Record<Theme, number> = {
  modern: 8, european: 6, american: 7, asian: 9, farming: 3, row: 5,
};

// ------------------------------------------------------------- 1. the corner

/**
 * The corner block: two wings meeting at a drum, with whatever the theme puts
 * over that drum.
 *
 * Every city has one of these and it is always the building people navigate
 * by, because a corner is the only place a facade is seen in the round. The
 * archetype is the same everywhere -- shops in the ground floor, flats above,
 * the corner turned rather than cut -- and the corner feature is entirely the
 * theme's: a stone rotunda under a dome, a brick bay under a water tank, a
 * tiled turret on brackets, a glazed drum, a dovecote.
 */
function cornerBlock(T: ThemeProfile, lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const floors = STOREYS[T.id];
  const fh = T.floorH + 0.4;
  const base = 5.0;
  const hx = 30.0, hz = 24.0, depth = 12.5;
  const top = base + (floors - 1) * fh;
  const N = 16;
  const cx = hx - 9.5, cz = hz - 9.5;
  const drum = plan(9.8, 9.8, 1.0, N);

  forecourt(m, -38, -32, 38, 32, 4211, { trees: 5, lamps: 6, people: 8, benches: 3 });

  // Two wings in an L, so the building has a back and a yard behind it. How
  // tall each wing runs, and what else stands on it, is the theme's -- a
  // re-skinned block is not a different landmark, so the massing differs
  // before the material does.
  const wings: Array<[number, number, number, number]> = [
    [-hx, hz - depth, hx, hz], [hx - depth, -hz, hx, hz - depth],
  ];
  //: [north wing top, east wing top], as a fraction of the full height.
  const RUN: Record<Theme, [number, number]> = {
    modern: [1.0, 0.62], european: [1.0, 1.0], american: [1.0, 0.78],
    asian: [0.72, 1.0], farming: [1.0, 0.55], row: [1.0, 1.0],
  };
  const tops = RUN[T.id].map((f) => base + (top - base) * f);
  wings.forEach(([x0, z0, x1, z1], i) => {
    const h = tops[i];
    m.box([x0, 0.1, z0], [x1, base, z1], T.base, { roof: MAT.ROOF });
    m.box([x0, base, z0], [x1, h, z1], T.wall, { roof: MAT.ROOF });
    if (medium) {
      band(m, x0, z0, x1, z1, base - 0.3, 0.45, 0.26, T.trim);
      band(m, x0, z0, x1, z1, h - 0.8, 0.8, 0.5, T.trim);
    }
  });
  // The one piece of extra mass each theme puts on the short wing, which is
  // what makes five corner blocks five silhouettes.
  if (medium) {
    switch (T.id) {
      case 'modern':
        // A planted deck over the low wing, with a pergola over half of it.
        m.painted(TINT.GREEN, () => m.box([hx - depth + 1, tops[1], -hz + 1], [hx - 1, tops[1] + 0.5, hz - depth - 1], MAT.TRIM));
        m.painted(TINT.METAL_DARK, () => {
          for (let i = 0; i <= 4; i++) {
            const pz = -hz + 3 + i * 4.5;
            m.cylinder(hx - depth + 3, pz, 0.12, tops[1], tops[1] + 3.0, 4, MAT.TRIM, false);
            m.cylinder(hx - 3, pz, 0.12, tops[1], tops[1] + 3.0, 4, MAT.TRIM, false);
            m.box([hx - depth + 2.8, tops[1] + 3.0, pz - 0.1], [hx - 2.8, tops[1] + 3.2, pz + 0.1], MAT.TRIM);
          }
        });
        railing(m, -hz + 1, hz - depth - 1, hx - 0.6, tops[1] + 0.5, 1.05, 2.2);
        break;
      case 'american': {
        // A stepped brick tower over the far end of the short wing.
        const y = tops[1];
        m.box([hx - depth + 1.0, y, -hz + 1.0], [hx - 1.0, top + 6.0, -hz + 14.0], T.wall, { roof: MAT.ROOF });
        m.box([hx - depth + 2.6, top + 6.0, -hz + 2.6], [hx - 2.6, top + 11.0, -hz + 12.4], T.base, { roof: MAT.ROOF });
        if (fine) glazeAll(m, hx - depth + 1.0, -hz + 1.0, hx - 1.0, -hz + 14.0, y, Math.floor((top + 6.0 - y) / fh), fh);
        band(m, hx - depth + 1.0, -hz + 1.0, hx - 1.0, -hz + 14.0, top + 6.0, 0.9, 0.5, T.base);
        break;
      }
      case 'asian': {
        // A slab tower standing on the long wing's podium: the East Asian
        // block is a podium with a tower on it, not a perimeter block.
        const y = tops[0];
        m.box([-hx + 4.0, y, hz - depth + 1.5], [-hx + 24.0, y + 9 * fh, hz - 1.5], T.wall, { roof: MAT.ROOF });
        band(m, -hx + 4.0, hz - depth + 1.5, -hx + 24.0, hz - 1.5, y + 9 * fh - 0.7, 0.7, 0.45, T.trim);
        hip(m, -hx + 3.0, hz - depth + 0.5, -hx + 25.0, hz - 0.5, y + 9 * fh, 4.2, T.cover);
        if (fine) glazeAll(m, -hx + 4.0, hz - depth + 1.5, -hx + 24.0, hz - 1.5, y, 9, fh);
        break;
      }
      case 'farming': {
        // A long open cart barn on the short wing, and a lean-to beside it.
        const y = tops[1];
        m.gable([hx - depth - 0.6, y, -hz - 0.6], [hx + 0.6, y, hz - depth + 0.6], 5.4, 'z', T.cover, T.wall);
        m.painted(TINT.WOOD, () => {
          for (let i = 0; i < 5; i++) {
            const pz = -hz + 2 + i * 5.0;
            m.box([hx - depth + 0.4, 0.1, pz - 0.2], [hx - depth + 0.9, y, pz + 0.2], MAT.TIMBER);
          }
        });
        break;
      }
      default: {
        // European: an attic storey with dormers over both wings.
        for (const [x0, z0, x1, z1] of wings) {
          m.box([x0 + 0.6, top, z0 + 0.6], [x1 - 0.6, top + 2.6, z1 - 0.6], T.wall);
        }
        break;
      }
    }
  }
  m.placed(cx, cz, 0, () => {
    loft(m, drum, drum, 0.1, top, T.wall);
    if (medium) {
      loft(m, scaled(drum, 1.008), scaled(drum, 1.008), 0.1, base, T.base);
      shelf(m, scaled(drum, 0.99), scaled(drum, 1.06), base - 0.3, base + 0.15, T.trim);
      shelf(m, scaled(drum, 0.99), scaled(drum, 1.07), top - 0.8, top, T.trim);
    }
  });

  if (medium) {
    shopfront(m, { axis: 'z', sign: 1, plane: hz }, -hx + 1.5, cx - 8.0,
      { bays: 8, head: 4.0, fascia: 1.0 });
    shopfront(m, { axis: 'x', sign: 1, plane: hx }, -hz + 1.5, cz - 8.0,
      { bays: 6, head: 4.0, fascia: 1.0 });
  }
  if (fine) {
    for (let f = 1; f < floors; f++) {
      const y = base + (f - 1) * fh;
      if (y + fh <= tops[0]) punched(m, T, { axis: 'z', sign: 1, plane: hz }, -hx + 2, cx - 7.0, { floors: 1, base: y });
      if (y + fh <= tops[1]) punched(m, T, { axis: 'x', sign: 1, plane: hx }, -hz + 2, cz - 7.0, { floors: 1, base: y });
      // The yard elevations and the two gable ends.
      //
      // Only the two street frontages were drawn, so every one of these was a
      // thirty-metre blank wall the moment the camera went round the back --
      // and the back of a corner block is a yard the flats above look into,
      // not a party wall. It takes the plainer rhythm a rear elevation has:
      // the same floor lines, narrower openings, no shopfront under it.
      if (y + fh <= tops[0]) {
        punched(m, T, { axis: 'z', sign: -1, plane: hz - depth }, -hx + 2, cx - 8.0, { floors: 1, base: y, lite: true });
        punched(m, T, { axis: 'x', sign: -1, plane: -hx }, hz - depth + 1.6, hz - 1.6, { floors: 1, base: y, lite: true });
      }
      if (y + fh <= tops[1]) {
        punched(m, T, { axis: 'x', sign: -1, plane: hx - depth }, -hz + 2, cz - 8.0, { floors: 1, base: y, lite: true });
        punched(m, T, { axis: 'z', sign: -1, plane: -hz }, hx - depth + 1.6, hx - 1.6, { floors: 1, base: y, lite: true });
      }
    }
    // Ground floor at the back: service doors and yard windows, since the
    // shopfront that fills this level on the street does not turn the corner.
    for (const [axis, sign, pln, a, b] of [
      ['z', -1, hz - depth, -hx + 3.0, cx - 9.0], ['x', -1, hx - depth, -hz + 3.0, cz - 9.0],
    ] as const) {
      punched(m, T, { axis, sign, plane: pln }, a, b, { floors: 1, base: 1.4 });
      doorway(m, T, { axis, sign, plane: pln }, (a + b) / 2, false);
    }
    // Windows in the drum, on the same floor lines, one every other facet.
    m.placed(cx, cz, 0, () => {
      for (let f = 1; f < floors; f++) {
        const y = base + (f - 1) * fh;
        for (let i = 0; i < N; i += 2) {
          const p = drum[i], q = drum[(i + 1) % N];
          const px = (p[0] + q[0]) / 2, pz = (p[1] + q[1]) / 2;
          const r = Math.hypot(px, pz) || 1;
          m.box([px / r * 9.6 - 0.8, y + 0.85, pz / r * 9.6 - 0.8],
                [px / r * 10.0 + 0.8, y + fh - 0.9, pz / r * 10.0 + 0.8], MAT.PANE);
        }
      }
    });
  }

  if (medium) {
    wings.forEach(([x0, z0, x1, z1], i) => {
      if (T.id === 'farming' && i === 1) return;                 // the cart barn has its own roof
      if (T.id === 'modern' && i === 1) return;                  // and the low wing is a terrace
      const y = T.id === 'european' ? top + 2.6 : tops[i];
      const in0 = T.id === 'european' ? 0.6 : 0;
      roofOver(m, T, x0 + in0, z0 + in0, x1 - in0, z1 - in0, y,
        { dormers: fine ? 4 : 0, along: x1 - x0 >= z1 - z0 ? 'x' : 'z' });
    });
    m.placed(cx, cz, 0, () => {
      switch (T.id) {
        case 'european': {
          // A lead dome on a colonnaded drum with a finial: the Paris corner.
          m.cylinder(0, 0, 10.4, top, top + 3.6, N, T.base, false);
          m.painted(TINT.NONE, () => {
            for (let i = 0; i < N; i++) {
              const a = (i / N) * Math.PI * 2;
              m.cylinder(Math.cos(a) * 10.8, Math.sin(a) * 10.8, 0.42, top, top + 3.3, 6, T.base, false);
            }
          });
          m.cone(0, 0, 11.1, 8.0, top + 3.6, top + 6.6, N, T.cover);
          m.cone(0, 0, 8.0, 3.6, top + 6.6, top + 10.8, N, T.cover);
          m.cone(0, 0, 3.6, 0.0, top + 10.8, top + 13.4, N, T.cover);
          m.painted(TINT.METAL_DARK, () => m.cylinder(0, 0, 0.16, top + 13.4, top + 16.8, 5, MAT.TRIM, false));
          break;
        }
        case 'american': {
          // Cornice, stepped brick attic, and the water tank on its frame.
          shelf(m, scaled(drum, 1.0), scaled(drum, 1.14), top, top + 1.4, T.base);
          loft(m, scaled(drum, 0.9), scaled(drum, 0.9), top + 1.4, top + 5.0, T.base);
          cap(m, scaled(drum, 0.9), top + 5.0, MAT.ROOF);
          m.painted(TINT.WOOD, () => m.cylinder(0, 0, 2.4, top + 7.2, top + 12.0, 10, MAT.TIMBER));
          m.cone(0, 0, 2.4, 0, top + 12.0, top + 13.6, 10, T.cover);
          m.painted(TINT.METAL_DARK, () => {
            for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
              m.pipe([sx * 1.8, top + 5.0, sz * 1.8], [sx * 1.8, top + 7.6, sz * 1.8], 0.1, MAT.TRIM, 5);
            }
          });
          break;
        }
        case 'asian': {
          // Two tiled hips on timber brackets, then a finial.
          for (let k = 0; k < 2; k++) {
            const y = top + k * 4.0;
            const r = 12.0 - k * 2.6;
            m.painted(TINT.WOOD, () => {
              for (let i = 0; i < N; i++) {
                const a = (i / N) * Math.PI * 2;
                m.pipe([Math.cos(a) * (r - 3.0), y - 0.4, Math.sin(a) * (r - 3.0)],
                       [Math.cos(a) * r, y + 0.5, Math.sin(a) * r], 0.16, MAT.TIMBER, 4);
              }
            });
            m.cone(0, 0, r, r * 0.45, y + 0.5, y + 2.8, N, T.cover);
            m.cylinder(0, 0, r * 0.45, y + 2.8, y + 4.0, N, T.wall, false);
          }
          m.cone(0, 0, 5.0, 0.0, top + 8.0, top + 11.6, N, T.cover);
          m.painted(TINT.ACCENT, () => m.cylinder(0, 0, 0.5, top + 11.6, top + 13.6, 6, MAT.TRIM, true));
          break;
        }
        case 'farming': {
          // A dovecote: a boarded drum with flight holes under a tiled cone.
          shelf(m, scaled(drum, 1.0), scaled(drum, 1.12), top, top + 0.7, T.trim);
          loft(m, scaled(drum, 0.62), scaled(drum, 0.62), top + 0.7, top + 4.4, T.wall);
          m.painted(TINT.METAL_DARK, () => {
            for (let i = 0; i < N; i += 2) {
              const p = scaled(drum, 0.63)[i];
              m.box([p[0] - 0.3, top + 3.0, p[1] - 0.3], [p[0] + 0.3, top + 3.7, p[1] + 0.3], MAT.TRIM);
            }
          });
          m.cone(0, 0, 7.0, 0.0, top + 4.4, top + 9.0, N, T.cover);
          break;
        }
        default: {
          // Modern: the drum carried two floors clear of the wings, in glass,
          // with a planted deck round the top of it.
          loft(m, scaled(drum, 0.99), scaled(drum, 0.99), top, top + 6.4, MAT.GLASS);
          m.painted(TINT.METAL_DARK, () => {
            for (let i = 0; i < N; i++) {
              const p = drum[i];
              m.pipe([p[0], top, p[1]], [p[0], top + 7.2, p[1]], 0.16, MAT.TRIM, 4);
            }
            shelf(m, scaled(drum, 0.98), scaled(drum, 1.12), top + 6.4, top + 7.2, MAT.TRIM);
          });
          cap(m, scaled(drum, 1.0), top + 7.2, MAT.ROOF);
          m.painted(TINT.GREEN, () => {
            loft(m, scaled(drum, 1.02), scaled(drum, 1.02), top + 0.1, top + 0.9, MAT.TRIM);
          });
          break;
        }
      }
    });
  }

  if (fine) {
    // What hangs on the front, which is the other half of the theme.
    if (T.balcony === 'metal') {
      for (const f of [2, 5]) {
        if (f >= floors) continue;
        const y = base + (f - 1) * fh;
        m.painted(TINT.METAL_DARK, () => {
          m.box([-hx + 1, y - 0.14, hz], [cx - 7.0, y, hz + 1.3], MAT.TRIM, { skipBottom: false });
          m.box([hx, y - 0.14, -hz + 1], [hx + 1.3, y, cz - 7.0], MAT.TRIM, { skipBottom: false });
        });
        railing(m, -hx + 1, cx - 7.0, hz + 1.25, y, 0.95, 1.3);
      }
    }
    if (T.id === 'american') {
      fireEscape(m, { axis: 'z', sign: 1, plane: hz }, -hx + 8.0, base, floors - 1, fh, 2.6);
      fireEscape(m, { axis: 'x', sign: 1, plane: hx }, -hz + 8.0, base, floors - 1, fh, 2.6);
    }
    if (T.id === 'asian') {
      m.placed(cx, cz, 0, () => {
        for (let f = 1; f < floors - 1; f++) {
          m.painted(f % 2 === 0 ? TINT.BRAND : TINT.ACCENT, () => {
            m.box([9.2, base + (f - 1) * fh + 0.6, -1.4], [11.6, base + f * fh - 0.9, 1.4], MAT.CLADDING);
          });
        }
      });
      balconyStack(m, -hx + 2, cx - 8.0, hz, 1, base + 0.4, floors - 2, fh,
        { depth: 1.5, glazed: false, bays: 6 });
    }
    if (T.id === 'farming' || T.id === 'european') {
      for (let i = 0; i < 5; i++) {
        awning(m, { axis: 'z', sign: 1, plane: hz }, -hx + 2 + i * 8, -hx + 8 + i * 8, 3.3, 1.7);
      }
    }
    doorway(m, T, { axis: 'z', sign: 1, plane: hz }, -hx + 6.0, true);
    marquee(m, cx - 22.0, cx - 10.0, hz + 0.3, 1, base + 0.3, 1.6);
    // The back of the block: a yard, planting, and a hedge to the street.
    m.painted(TINT.NONE, () => m.box([-hx, 0.11, -hz], [hx - depth, 0.24, hz - depth], MAT.GROUND));
    for (const s of [-1, 1]) tree(m, s * 12, hz - depth - 9.0, 7.5, 2.6);
    hedge(m, -hx + 1, -hz + 1, hx - depth - 1, -hz + 2.2, 1.0);
    bollards(m, { axis: 'z', sign: 1, plane: hz }, -hx + 2, hx - 2, 2.4, 9);
    for (let i = 0; i < 6; i++) figure(m, 210 + i * 13, -22 + i * 7.0, hz + 3.4, 0.3 * i, { stride: 0.2 });
  }
  return m;
}

// ---------------------------------------------------------- 2. the courtyard

/**
 * A perimeter block round a courtyard you can see into.
 *
 * The archetype is the street wall: the building is the block edge and the
 * good side faces in, so the only thing that says there is anything behind the
 * facade is the gate. That gate is therefore the whole design, and it is
 * completely different in each theme -- a carriage arch, an open-ended garden
 * court, a moon gate, a lifted range, a cart entry under a hay loft -- and so
 * is what you see through it.
 */
function courtyardBlock(T: ThemeProfile, lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const floors = Math.max(3, STOREYS[T.id] - 1);
  const fh = T.floorH + 0.35;
  const hx = 32.0, hz = 24.0, depth = 11.0;
  const top = 0.6 + floors * fh;

  forecourt(m, -39, -31, 39, 31, 5501, { trees: 4, lamps: 6, people: 8, benches: 2 });
  m.box([-hx + depth, 0.1, -hz + depth], [hx - depth, 0.24, hz - depth], MAT.GROUND);

  const ranges: Array<[number, number, number, number]> = [
    [-hx, -hz, hx, -hz + depth], [-hx, hz - depth, hx, hz],
    [-hx, -hz + depth, -hx + depth, hz - depth], [hx - depth, -hz + depth, hx, hz - depth],
  ];
  // How much of the perimeter each theme actually builds, and how tall.
  //
  // A courtyard block is not one plan in five materials. Europe closes all
  // four sides; America leaves the street side open between two pavilions;
  // Asia walls the compound and puts a tower on one range; the modern block
  // lifts a range and stands a slab on another; a farmstead is an L with its
  // barns making up the rest.
  const SIDES: Record<Theme, [number, number, number, number]> = {
    modern: [1.0, 1.0, 1.0, 1.0], european: [1.0, 1.0, 1.0, 1.0],
    american: [0.85, 1.0, 1.0, 1.0], asian: [0.62, 0.82, 0.82, 0.82],
    farming: [0.0, 0.72, 0.72, 0.0], row: [1.0, 1.0, 1.0, 1.0],
  };
  const runs = SIDES[T.id].map((f) => 0.6 + (top - 0.6) * f);
  ranges.forEach(([x0, z0, x1, z1], i) => {
    if (SIDES[T.id][i] === 0) return;
    const h = runs[i];
    m.box([x0, 0.1, z0], [x1, 0.6, z1], T.base);
    m.box([x0, 0.6, z0], [x1, h, z1], T.wall, { roof: MAT.ROOF });
    if (medium) {
      band(m, x0, z0, x1, z1, h - 0.7, 0.7, 0.45, T.trim);
      roofOver(m, T, x0, z0, x1, z1, h,
        { dormers: fine ? 5 : 0, along: x1 - x0 >= z1 - z0 ? 'x' : 'z' });
    }
  });
  if (medium) {
    switch (T.id) {
      case 'modern': {
        // A slab standing on the east range, four storeys clear of the rest.
        m.box([hx - depth, top, -hz + depth + 2], [hx, top + 4 * fh, hz - depth - 2], MAT.RENDER, { roof: MAT.ROOF });
        m.box([hx - depth + 0.6, top + 0.8, hz - depth - 2.4], [hx - 0.6, top + 4 * fh - 0.8, hz - depth - 2.1], MAT.GLASS);
        if (fine) glazeAll(m, hx - depth, -hz + depth + 2, hx, hz - depth - 2, top, 4, fh);
        parapet(m, hx - depth, -hz + depth + 2, hx, hz - depth - 2, top + 4 * fh, 1.0, 0.25, T.trim);
        break;
      }
      case 'american': {
        // A taller block across the back of the court, which is where a
        // garden-apartment scheme puts its lifts.
        m.box([-14, top, hz - depth], [14, top + 3 * fh, hz], T.wall, { roof: MAT.ROOF });
        band(m, -14, hz - depth, 14, hz, top + 3 * fh - 0.8, 0.8, 0.5, T.base);
        if (fine) glazeAll(m, -14, hz - depth, 14, hz, top, 3, fh);
        parapet(m, -14, hz - depth, 14, hz, top + 3 * fh, 1.1, 0.3, T.base);
        break;
      }
      case 'asian': {
        // A slab tower over the east range, and a tiled pavilion in the court.
        m.box([hx - depth + 0.5, runs[3], -hz + depth + 3], [hx - 0.5, runs[3] + 7 * fh, hz - depth - 3], T.wall, { roof: MAT.ROOF });
        if (fine) glazeAll(m, hx - depth + 0.5, -hz + depth + 3, hx - 0.5, hz - depth - 3, runs[3], 7, fh);
        hip(m, hx - depth - 0.5, -hz + depth + 2, hx + 0.5, hz - depth - 2, runs[3] + 7 * fh, 3.6, T.cover);
        break;
      }
      case 'farming': {
        // The two missing sides are open cart barns on posts.
        for (const [x0, z0, x1, z1, along] of [
          [-hx, -hz, hx, -hz + depth, 'x'], [hx - depth, -hz + depth, hx, hz - depth, 'z'],
        ] as const) {
          m.gable([x0 - 0.5, 5.6, z0 - 0.5], [x1 + 0.5, 5.6, z1 + 0.5],
            Math.min(x1 - x0, z1 - z0) * 0.5, along, T.cover, T.wall);
          m.box([x0, 0.1, z0], [x1, 0.4, z1], MAT.GROUND);
          m.painted(TINT.WOOD, () => {
            const n = along === 'x' ? 7 : 4;
            for (let i = 0; i <= n; i++) {
              const u = along === 'x' ? x0 + (i / n) * (x1 - x0) : z0 + (i / n) * (z1 - z0);
              if (along === 'x') {
                m.box([u - 0.24, 0.1, z0 + 0.6], [u + 0.24, 5.6, z0 + 1.1], MAT.TIMBER);
                m.box([u - 0.24, 0.1, z1 - 1.1], [u + 0.24, 5.6, z1 - 0.6], MAT.TIMBER);
              } else {
                m.box([x0 + 0.6, 0.1, u - 0.24], [x0 + 1.1, 5.6, u + 0.24], MAT.TIMBER);
                m.box([x1 - 1.1, 0.1, u - 0.24], [x1 - 0.6, 5.6, u + 0.24], MAT.TIMBER);
              }
            }
          });
        }
        break;
      }
      default: break;
    }
  }
  if (fine) {
    const punchAll = (axis: 'x' | 'z', sign: 1 | -1, plane: number, a: number, b: number): void => {
      punched(m, T, { axis, sign, plane }, a, b, { floors, base: 0.6, skipGround: true });
    };
    punchAll('z', -1, -hz, -hx + 2, hx - 2);
    punchAll('z', 1, hz, -hx + 2, hx - 2);
    punchAll('x', -1, -hx, -hz + 2, hz - 2);
    punchAll('x', 1, hx, -hz + 2, hz - 2);
    punchAll('z', 1, -hz + depth, -hx + depth + 2, hx - depth - 2);
    punchAll('z', -1, hz - depth, -hx + depth + 2, hx - depth - 2);
  }

  if (medium) {
    switch (T.id) {
      case 'european': {
        // A carriage arch with rusticated jambs under a mansarded pavilion.
        m.box([-7.5, top, -hz], [7.5, top + 4.2, -hz + depth], T.wall, { roof: MAT.ROOF });
        mansard(m, -8.2, -hz - 0.4, 8.2, -hz + depth + 0.4, top + 4.2, 5.4, T.cover, T.wall);
        m.box([-3.6, 0.12, -hz - 0.3], [3.6, 6.6, -hz + depth + 0.3], MAT.DARK_TRIM);
        m.painted(TINT.NONE, () => {
          for (const s of [-1, 1]) m.box([s * 3.6, 0.1, -hz - 0.5], [s * 4.8, 7.6, -hz + depth + 0.5], T.base);
          m.box([-4.8, 6.6, -hz - 0.5], [4.8, 7.6, -hz + depth + 0.5], T.base);
        });
        break;
      }
      case 'asian': {
        // A moon gate cut through a tiled screen wall.
        m.box([-9.0, 0.1, -hz - 0.4], [9.0, 7.2, -hz + depth + 0.4], T.wall);
        void runs;
        for (let i = 0; i < 14; i++) {
          const a0 = Math.PI * (i / 14), a1 = Math.PI * ((i + 1) / 14);
          m.quad([Math.cos(a0) * 3.4, 0.12 + Math.sin(a0) * 3.4, -hz - 0.5],
                 [Math.cos(a1) * 3.4, 0.12 + Math.sin(a1) * 3.4, -hz - 0.5],
                 [Math.cos(a1) * 3.4, 0.12 + Math.sin(a1) * 3.4, -hz + depth + 0.5],
                 [Math.cos(a0) * 3.4, 0.12 + Math.sin(a0) * 3.4, -hz + depth + 0.5], MAT.DARK_TRIM);
        }
        m.box([-3.4, 0.12, -hz - 0.5], [3.4, 3.4, -hz + depth + 0.5], MAT.DARK_TRIM);
        hip(m, -10.0, -hz - 1.2, 10.0, -hz + depth + 1.2, 7.2, 3.2, T.cover);
        break;
      }
      case 'american': {
        // No gate at all: the court is open to the street between two end
        // pavilions, which is what a garden-apartment block does.
        m.box([-9.0, 0.1, -hz], [9.0, 0.9, -hz + depth * 0.6], MAT.CONCRETE);
        for (const s of [-1, 1]) {
          m.box([s * 9.0, 0.1, -hz], [s * 13.0, top + 1.2, -hz + depth], T.base, { roof: MAT.ROOF });
        }
        break;
      }
      case 'farming': {
        // A cart entry under a hay loft, with boarded doors either side.
        m.box([-5.2, 0.12, -hz - 0.4], [5.2, 5.0, -hz + depth + 0.4], MAT.DARK_TRIM);
        m.box([-6.4, 5.0, -hz - 0.6], [6.4, top, -hz + depth + 0.6], T.wall);
        m.painted(TINT.WOOD, () => {
          m.box([-2.4, 5.8, -hz - 0.7], [2.4, 8.6, -hz - 0.5], MAT.TIMBER);
          for (const s of [-1, 1]) m.box([s * 5.4, 0.12, -hz - 0.6], [s * 8.6, 4.2, -hz - 0.45], MAT.TIMBER);
        });
        m.gable([-7.0, top, -hz - 0.8], [7.0, top, -hz + depth + 0.8], 4.4, 'z', T.cover, T.wall);
        break;
      }
      default: {
        // Modern: the street range is lifted on columns and the court runs
        // under it.
        m.box([-11.0, 0.12, -hz - 0.4], [11.0, 6.4, -hz + depth + 0.4], MAT.DARK_TRIM);
        m.painted(TINT.METAL_DARK, () => {
          for (const sx of [-9.5, -3.2, 3.2, 9.5]) {
            for (const pz of [-hz + 1.2, -hz + depth - 1.2]) m.cylinder(sx, pz, 0.36, 0.12, 6.4, 8, MAT.TRIM, false);
          }
        });
        break;
      }
    }
  }

  if (fine) {
    switch (T.id) {
      case 'asian': {
        m.painted(TINT.NONE, () => m.cylinder(0, 2.0, 6.0, 0.24, 0.5, 16, MAT.STONE, true));
        m.painted(TINT.GREEN, () => m.cylinder(0, 2.0, 5.4, 0.42, 0.52, 16, MAT.TRIM, true));
        for (const s of [-1, 1]) {
          m.painted(TINT.WOOD, () => {
            for (const pz of [-4.0, 6.0]) m.cylinder(s * 12, pz, 0.18, 0.24, 3.0, 6, MAT.TIMBER, false);
          });
          hip(m, s * 12 - 3.0, -6.4, s * 12 + 3.0, 8.4, 3.0, 1.6, T.cover);
        }
        for (const sx of [-16, 16]) tree(m, sx, -6, 7.0, 2.4);
        break;
      }
      case 'farming': {
        m.painted(TINT.NONE, () => m.cylinder(-10, 0, 1.6, 0.24, 1.1, 10, MAT.STONE, true));
        m.painted(TINT.WOOD, () => {
          m.box([-11.6, 1.1, -1.6], [-8.4, 1.3, 1.6], MAT.TIMBER);
          for (let i = 0; i < 5; i++) m.box([6 + i * 2.2, 0.26, -6], [7.6 + i * 2.2, 2.4, 4], MAT.TIMBER);
        });
        tree(m, 12, -6, 8.5, 3.2);
        break;
      }
      case 'american': {
        for (const sx of [-12, 0, 12]) tree(m, sx, 2, 7.5, 2.6);
        hedge(m, -18, -6, 18, -5, 0.8);
        for (let i = 0; i < 4; i++) bench(m, -12 + i * 8, 8, 0);
        break;
      }
      case 'modern': {
        m.painted(TINT.GREEN, () => m.box([-16, 0.24, -8], [16, 0.36, 10], MAT.TRIM));
        m.painted(TINT.METAL_DARK, () => {
          for (let i = 0; i <= 7; i++) {
            const x = -14 + i * 4;
            m.cylinder(x, -6, 0.12, 0.24, 3.6, 4, MAT.TRIM, false);
            m.cylinder(x, 8, 0.12, 0.24, 3.6, 4, MAT.TRIM, false);
            m.box([x - 0.1, 3.6, -6.4], [x + 0.1, 3.8, 8.4], MAT.TRIM);
          }
        });
        for (const sx of [-18, 18]) tree(m, sx, 0, 7.0, 2.4);
        break;
      }
      default: {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) tree(m, sx * 12, sz * 7, 8.5, 3.0);
        m.painted(TINT.NONE, () => m.cylinder(0, 0, 3.2, 0.24, 0.9, 12, T.base, true));
        m.painted(TINT.GREEN, () => m.cylinder(0, 0, 2.9, 0.7, 0.86, 12, MAT.TRIM, true));
        for (let i = 0; i < 4; i++) bench(m, -12 + i * 8, 9, 0);
        break;
      }
    }
    for (let i = 0; i < 6; i++) figure(m, 320 + i * 9, -14 + i * 5.5, 5.0, 0.4 * i, { stride: 0.2 });
    for (let i = 0; i < 5; i++) {
      const x = -24 + i * 12;
      if (Math.abs(x) < 10) continue;
      shopfront(m, { axis: 'z', sign: -1, plane: -hz }, x - 4.6, x + 4.6, { bays: 3, head: 3.7 });
    }
    doorway(m, T, { axis: 'z', sign: 1, plane: hz }, -14.0, true);
    doorway(m, T, { axis: 'z', sign: 1, plane: hz }, 14.0, true);
    bollards(m, { axis: 'z', sign: -1, plane: -hz }, -hx + 2, hx - 2, 2.4, 10);
    for (const sx of [-26, 26]) planter(m, sx, hz + 3.0, 1.4, 0.6);
  }
  return m;
}

// ----------------------------------------------------------- 3. the set piece

/**
 * One long run of housing, shaped: the thing a district gets named after.
 *
 * Where the other two are blocks, this is a street, and what form a street
 * takes is entirely regional -- there is no common massing to share. So this
 * is the archetype that branches at the top rather than at the trim: a bowed
 * Georgian crescent, a stepped modern deck-access block on the same arc, a
 * brownstone row with stoops and a corner store, a shophouse terrace over a
 * five-foot way, and a manor with its barns round a yard.
 */
function setPiece(T: ThemeProfile, lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const fh = T.floorH + 0.3;

  forecourt(m, -46, -30, 46, 30, 7717, { trees: 6, lamps: 7, people: 8, benches: 3 });

  if (T.id === 'european' || T.id === 'modern') {
    const N = 18, R = 150.0, span = 0.60, depth = 13.0;
    const floors = T.id === 'modern' ? 6 : 5;
    const arc = (r: number): Array<[number, number]> => {
      const out: Array<[number, number]> = [];
      for (let i = 0; i <= N; i++) {
        const a = -span / 2 + (i / N) * span - Math.PI / 2;
        out.push([Math.cos(a) * r, Math.sin(a) * r + R - 20.0]);
      }
      return out;
    };
    const front = arc(R), back = arc(R - depth);
    const top = 0.7 + floors * fh;
    /**
     * The three masses that stop a crescent being a curved wall.
     *
     * A crescent is not an arc of facade -- it is a centrepiece with a
     * pavilion at each end and the plain ranges between them, and that is the
     * whole of why the form works. Drawn as a smooth arc it has no plan depth
     * anywhere, and from the ground it reads as flat as a painted backdrop
     * however many windows are cut into it. Each of these projects two and a
     * half metres, carries its own cornice, and returns to the range with a
     * short side wall on each side of it -- so the crescent has shadow on it
     * at every hour, which is the only thing that gives a curve any relief.
     */
    const BAYS: Array<[number, number]> = [[0, 2], [N / 2 - 1, N / 2 + 1], [N - 2, N]];
    const PROUD = 2.6;
    const proud = arc(R + PROUD);
    for (const [i0, i1] of BAYS) {
      for (let i = i0; i < i1; i++) {
        const a = proud[i], b = proud[i + 1], c = front[i], d = front[i + 1];
        m.quad([b[0], 0.1, b[1]], [a[0], 0.1, a[1]], [a[0], top, a[1]], [b[0], top, b[1]], T.wall);
        m.quad([a[0], top, a[1]], [b[0], top, b[1]], [d[0], top, d[1]], [c[0], top, c[1]], MAT.ROOF);
      }
      // The returns: the two short walls that carry the projection back into
      // the range. Without them the pavilion is a floating panel.
      for (const [i, out] of [[i0, false], [i1, true]] as const) {
        const a = front[i], b = proud[i];
        if (out) m.quad([a[0], 0.1, a[1]], [b[0], 0.1, b[1]], [b[0], top, b[1]], [a[0], top, a[1]], T.wall);
        else m.quad([b[0], 0.1, b[1]], [a[0], 0.1, a[1]], [a[0], top, a[1]], [b[0], top, b[1]], T.wall);
      }
      if (medium) {
        // A cornice round the projection, and a parapet or pediment over it.
        for (let i = i0; i < i1; i++) {
          const a = proud[i], b = proud[i + 1];
          m.quad([b[0], top - 1.1, b[1] - 0.5], [a[0], top - 1.1, a[1] - 0.5],
                 [a[0], top + 0.2, a[1] - 0.5], [b[0], top + 0.2, b[1] - 0.5], T.trim);
          m.quad([b[0], top, b[1]], [a[0], top, a[1]],
                 [a[0], top + 1.9, a[1]], [b[0], top + 1.9, b[1]], T.trim);
        }
      }
      if (fine && T.id === 'european') {
        // Engaged columns across the centrepiece: a giant order two storeys
        // tall, which is what the middle of a crescent always has.
        const c0 = proud[i0], c1 = proud[i1];
        const n = i1 - i0 === 2 ? 4 : 3;
        for (let k = 0; k <= n; k++) {
          const t = k / n;
          const px = c0[0] + (c1[0] - c0[0]) * t, pz = c0[1] + (c1[1] - c0[1]) * t;
          m.cylinder(px, pz - 0.35, 0.52, 4.0, 4.0 + 2 * fh, 8, T.trim, false);
          m.box([px - 0.7, 4.0 + 2 * fh, pz - 1.05], [px + 0.7, 4.0 + 2 * fh + 0.4, pz + 0.35], T.trim);
        }
      }
    }
    // The garden elevation gets its own relief: four stair bays standing out
    // of the back of the range, which is what a crescent has behind it and
    // also the only thing that stops the convex side reading as a drawing of
    // a building rather than a building.
    const REAR: Array<[number, number]> = [[3, 4], [7, 8], [10, 11], [14, 15]];
    const rear = arc(R - depth - 2.4);
    for (const [i0, i1] of REAR) {
      for (let i = i0; i < i1; i++) {
        const a = rear[i], b = rear[i + 1], c = back[i], d = back[i + 1];
        m.quad([a[0], 0.1, a[1]], [b[0], 0.1, b[1]], [b[0], top, b[1]], [a[0], top, a[1]], T.wall);
        m.quad([c[0], top, c[1]], [d[0], top, d[1]], [b[0], top, b[1]], [a[0], top, a[1]], MAT.ROOF);
      }
      for (const [i, out] of [[i0, true], [i1, false]] as const) {
        const a = back[i], b = rear[i];
        if (out) m.quad([b[0], 0.1, b[1]], [a[0], 0.1, a[1]], [a[0], top, a[1]], [b[0], top, b[1]], T.wall);
        else m.quad([a[0], 0.1, a[1]], [b[0], 0.1, b[1]], [b[0], top, b[1]], [a[0], top, a[1]], T.wall);
      }
      if (fine) {
        // The stair itself, read as a tall slot of glazing up the middle.
        const a = rear[i0], b = rear[i1];
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        m.box([mx - 1.3, 1.2, mz + 0.02], [mx + 1.3, top - 0.9, mz + 0.16], MAT.PANE);
        m.painted(TINT.METAL_DARK, () => {
          for (let f = 1; f < floors; f++) {
            const y = 0.7 + f * fh;
            m.box([mx - 1.4, y - 0.16, mz + 0.04], [mx + 1.4, y + 0.06, mz + 0.24], MAT.TRIM);
          }
        });
      }
    }

    /** True where a segment is under one of the projecting masses. */
    const under = (i: number): boolean => BAYS.some(([a, b]) => i >= a && i < b);
    // The two ends of the crescent.
    //
    // The arc was a ribbon: a front skin, a back skin, a lid and a floor, and
    // nothing whatever across the ends of it. From either side you looked
    // straight through the building at the inside faces of its own windows,
    // which is the worst kind of hole because the mesh looks closed from the
    // two views a generator is usually checked in. A crescent ends in a blind
    // flank wall, so that is what goes there.
    for (const [i, out] of [[0, false], [N, true]] as const) {
      const f = proud[i], b = back[i];
      if (out) m.quad([b[0], 0.1, b[1]], [f[0], 0.1, f[1]], [f[0], top, f[1]], [b[0], top, b[1]], T.wall);
      else m.quad([f[0], 0.1, f[1]], [b[0], 0.1, b[1]], [b[0], top, b[1]], [f[0], top, f[1]], T.wall);
      // A flank is plainer than a frontage, not blind: a stair window on each
      // floor and the one at the front of the plan lighting the end rooms.
      // The wall is radial and so a few degrees off the axis, which the frame
      // absorbs -- at this width the reveal reads as a reveal either way.
      if (!fine) continue;
      for (let fl = 1; fl < floors; fl++) {
        const y = 0.7 + (fl - 1) * fh;
        for (const t of [0.24, 0.62]) {
          const px = f[0] + (b[0] - f[0]) * t, pz = f[1] + (b[1] - f[1]) * t;
          m.opening({
            axis: 'x', sign: out ? 1 : -1, plane: px, u0: pz - 0.62, u1: pz + 0.62,
            y0: y + 1.0, y1: y + fh - 1.0, glass: MAT.PANE, frame: 0.11, proud: 0.07,
          });
        }
      }
    }
    for (let i = 0; i < N; i++) {
      const a = front[i], b = front[i + 1], c = back[i], d = back[i + 1];
      m.quad([b[0], 0.1, b[1]], [a[0], 0.1, a[1]], [a[0], top, a[1]], [b[0], top, b[1]], T.wall);
      m.quad([c[0], 0.1, c[1]], [d[0], 0.1, d[1]], [d[0], top, d[1]], [c[0], top, c[1]], T.wall);
      m.quad([a[0], top, a[1]], [b[0], top, b[1]], [d[0], top, d[1]], [c[0], top, c[1]], MAT.ROOF);
      m.quad([a[0], 0.1, a[1]], [b[0], 0.1, b[1]], [d[0], 0.1, d[1]], [c[0], 0.1, c[1]], MAT.GROUND);
      if (medium) {
        // A base storey in stone, and a cornice under the roof: two bands that
        // turn a curved wall into a building.
        m.quad([b[0], 0.1, b[1] - 0.2], [a[0], 0.1, a[1] - 0.2],
               [a[0], 4.0, a[1] - 0.2], [b[0], 4.0, b[1] - 0.2], T.base);
        m.quad([b[0], top - 0.9, b[1] - 0.55], [a[0], top - 0.9, a[1] - 0.55],
               [a[0], top, a[1] - 0.55], [b[0], top, b[1] - 0.55], T.trim);
        // The back is a garden elevation, not a blind wall: the same cornice
        // and a stair-and-window rhythm, because a crescent is seen from both
        // sides and the mews behind it is where its own residents stand.
        m.quad([c[0], top - 0.9, c[1] + 0.55], [d[0], top - 0.9, d[1] + 0.55],
               [d[0], top, d[1] + 0.55], [c[0], top, c[1] + 0.55], T.trim);
      }
      if (fine) {
        // Where the range steps forward, its windows step forward with it --
        // otherwise the whole run of them is buried inside the pavilion.
        const pf = under(i) ? proud : front;
        const mx = (pf[i][0] + pf[i + 1][0]) / 2, mz = (pf[i][1] + pf[i + 1][1]) / 2;
        const nl = Math.hypot(mx, mz - (R - 20.0)) || 1;
        const ox = mx / nl, oz = (mz - (R - 20.0)) / nl;
        const rx = (c[0] + d[0]) / 2, rz = (c[1] + d[1]) / 2;
        for (let f = 0; f < floors; f++) {
          const y = 0.7 + f * fh;
          for (const u of [-1.7, 1.7]) {
            const px = mx - oz * u, pz = mz + ox * u;
            m.box([px - 0.66, y + 0.9, pz - 0.66], [px + 0.66, y + fh - 0.9, pz + 0.66],
              T.id === 'modern' ? MAT.GLASS : MAT.PANE);
          }
          for (const u of [-1.2, 1.2]) {
            const px = rx - oz * u, pz = rz + ox * u;
            m.box([px - 0.5, y + 0.9, pz - 0.5], [px + 0.5, y + fh - 1.0, pz + 0.5], MAT.PANE);
          }
        }
        if (T.id === 'european') {
          m.painted(TINT.METAL_DARK, () => {
            m.box([mx - 2.7, 4.0, mz - 1.4], [mx + 2.7, 4.2, mz + 0.2], MAT.TRIM, { skipBottom: false });
          });
          railing(m, mx - 2.7, mx + 2.7, mz - 1.3, 4.2, 0.9, 1.1);
        }
      }
    }
    if (medium && T.id === 'european') {
      const h = 5.0;
      for (let i = 0; i < N; i++) {
        const a = front[i], b = front[i + 1], c = back[i], d = back[i + 1];
        m.quad([b[0], top, b[1]], [a[0], top, a[1]],
               [a[0] * 0.985, top + h, a[1] + 2.2], [b[0] * 0.985, top + h, b[1] + 2.2], T.cover);
        m.quad([c[0], top, c[1]], [d[0], top, d[1]],
               [d[0] * 1.012, top + h, d[1] - 2.2], [c[0] * 1.012, top + h, c[1] - 2.2], T.cover);
        m.quad([a[0] * 0.985, top + h, a[1] + 2.2], [b[0] * 0.985, top + h, b[1] + 2.2],
               [d[0] * 1.012, top + h, d[1] - 2.2], [c[0] * 1.012, top + h, c[1] - 2.2], T.cover);
        if (fine && i % 2 === 0) dormer(m, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.7, -1, top + 1.5, T);
      }
      // ...and the two ends of the mansard, which were open for the same
      // reason the walls under them were.
      for (const [i, out] of [[0, false], [N, true]] as const) {
        const a = front[i], c = back[i];
        const p: [number, number, number] = [a[0] * 0.985, top + h, a[1] + 2.2];
        const q: [number, number, number] = [c[0] * 1.012, top + h, c[1] - 2.2];
        if (out) m.quad([a[0], top, a[1]], [c[0], top, c[1]], q, p, T.cover);
        else m.quad([c[0], top, c[1]], [a[0], top, a[1]], p, q, T.cover);
      }
    }
    if (medium && T.id === 'modern') {
      // The roofscape, as solids rather than as planes.
      //
      // Two set-back storeys drawn as a wall, a lid and a strip of green was
      // three single-sided quads per segment: no thickness anywhere, so the
      // top of the building read as coloured paper laid over the arc and the
      // parapet had no edge to catch the light. Each storey now closes --
      // front, back, lid, and a return at each end of the run -- and carries a
      // parapet standing proud of its own face, which is the only part of a
      // flat roof anybody actually sees from the ground.
      for (let k = 0; k < 2; k++) {
        const inn = arc(R - 3.5 - k * 3.5);
        const out = arc(R - depth + 1.5 + k * 2.0);
        const y0 = top + k * fh, y1 = y0 + fh;
        for (let i = 0; i < N; i++) {
          const a = inn[i], b = inn[i + 1], c = out[i], d = out[i + 1];
          m.quad([b[0], y0, b[1]], [a[0], y0, a[1]], [a[0], y1, a[1]], [b[0], y1, b[1]], MAT.GLASS);
          m.quad([c[0], y0, c[1]], [d[0], y0, d[1]], [d[0], y1, d[1]], [c[0], y1, c[1]], T.wall);
          m.quad([a[0], y1, a[1]], [b[0], y1, b[1]], [d[0], y1, d[1]], [c[0], y1, c[1]], MAT.ROOF);
          // The parapet: a band standing above the lid on both faces, with a
          // coping across it, so the roof has an edge.
          for (const [p, q, o] of [[a, b, -0.35], [c, d, 0.35]] as const) {
            m.quad([q[0], y1, q[1] + o], [p[0], y1, p[1] + o],
                   [p[0], y1 + 1.0, p[1] + o], [q[0], y1 + 1.0, q[1] + o], T.trim);
            m.quad([p[0], y1 + 1.0, p[1] + o], [q[0], y1 + 1.0, q[1] + o],
                   [q[0], y1 + 1.0, q[1]], [p[0], y1 + 1.0, p[1]], T.trim);
          }
          m.painted(TINT.GREEN, () => {
            const e = arc(R - 0.6 - k * 3.5);
            m.quad([e[i + 1][0], y0, e[i + 1][1]], [e[i][0], y0, e[i][1]],
                   [a[0], y0 + 0.75, a[1]], [b[0], y0 + 0.75, b[1]], MAT.TRIM);
          });
        }
        // The two ends of the set-back run, which were open to the sky.
        for (const [i, outward] of [[0, false], [N, true]] as const) {
          const a = inn[i], c = out[i];
          if (outward) m.quad([c[0], y0, c[1]], [a[0], y0, a[1]], [a[0], y1, a[1]], [c[0], y1, c[1]], T.wall);
          else m.quad([a[0], y0, a[1]], [c[0], y0, c[1]], [c[0], y1, c[1]], [a[0], y1, a[1]], T.wall);
        }
      }
      // Plant and lift overruns on the top deck: what is actually up there,
      // and the thing that stops the last lid reading as a lid.
      const cap2 = arc(R - 7.0);
      for (let i = 2; i < N; i += 6) {
        const p = cap2[i], q = cap2[i + 2];
        const cx2 = (p[0] + q[0]) / 2, cz2 = (p[1] + q[1]) / 2;
        m.painted(TINT.METAL_DARK, () => {
          m.box([cx2 - 3.0, top + 2 * fh, cz2 - 2.2], [cx2 + 3.0, top + 2 * fh + 3.2, cz2 + 2.2],
            MAT.CLADDING, { roof: MAT.METAL });
        });
      }
    }
    if (fine) {
      m.painted(TINT.GREEN, () => m.box([-34, 0.1, -28], [34, 0.24, -8], MAT.TRIM));
      hedge(m, -34, -28.6, 34, -27.6, 0.9);
      for (const sx of [-26, -9, 9, 26]) tree(m, sx, -19, 9.0, 3.2);
      for (let i = 0; i < 5; i++) bench(m, -20 + i * 10, -10, 0);
      for (let i = 0; i < 6; i++) figure(m, 430 + i * 11, -18 + i * 7, -14, 1.2, { stride: 0.22 });
    }
    return m;
  }

  if (T.id === 'american') {
    // A brownstone row: eight houses with bay fronts and stoops, ending in a
    // corner store.
    const units = 8, w = 8.4, d = 15.0, floors = 4;
    const hx = (units * w) / 2;
    const top = 1.9 + floors * fh;
    for (let i = 0; i < units; i++) {
      const x0 = -hx + i * w, x1 = x0 + w;
      m.box([x0, 0.1, -d / 2], [x1, 1.9, d / 2], T.base);
      m.box([x0, 1.9, -d / 2], [x1, top, d / 2], T.wall, { roof: MAT.ROOF });
      if (medium) {
        m.box([x0 + 0.9, 1.9, d / 2], [x1 - 3.4, top - 1.0, d / 2 + 1.5], T.wall);
        band(m, x0, -d / 2, x1, d / 2 + 1.5, top - 1.0, 1.0, 0.55, T.trim);
        band(m, x0, -d / 2, x1, d / 2, 1.9, 0.32, 0.28, T.trim);
      }
      if (fine) {
        for (let f = 0; f < floors; f++) {
          const y = 1.9 + f * fh;
          m.windowRow({
            axis: 'z', sign: 1, plane: d / 2 + 1.5, from: x0 + 1.1, to: x1 - 3.6,
            y0: y + 0.7, y1: y + fh - 0.8, count: 2, width: 1.15,
            glass: MAT.PANE, frame: 0.12, proud: 0.07,
          });
          m.windowRow({
            axis: 'z', sign: -1, plane: -d / 2, from: x0 + 1.0, to: x1 - 1.0,
            y0: y + 0.7, y1: y + fh - 0.8, count: 2, width: 1.3,
            glass: MAT.PANE, frame: 0.12, proud: 0.07,
          });
        }
        steps(m, { axis: 'z', sign: 1, plane: d / 2 }, x1 - 3.0, x1 - 1.0, 7, 0.27, 0.34);
        entrance(m, { axis: 'z', sign: 1, plane: d / 2 }, x1 - 2.0,
          { width: 1.3, height: 2.5, double: false, glazed: false, fanlight: true });
        railing(m, x1 - 3.2, x1 - 0.8, d / 2 + 2.3, 1.9, 1.0, 0.7);
        fireEscape(m, { axis: 'z', sign: -1, plane: -d / 2 }, x0 + w / 2, 1.9, floors, fh, 2.2);
      }
    }
    if (medium) {
      parapet(m, -hx, -d / 2, hx, d / 2 + 1.5, top, 1.0, 0.3, T.base);
      m.box([hx, 0.1, -d / 2], [hx + 9.0, top + 1.4, d / 2], T.base, { roof: MAT.ROOF });
      shopfront(m, { axis: 'z', sign: 1, plane: d / 2 }, hx + 0.6, hx + 8.4, { bays: 3, head: 4.0 });
      shopfront(m, { axis: 'x', sign: 1, plane: hx + 9.0 }, -d / 2 + 1, d / 2 - 1, { bays: 4, head: 4.0 });
      parapet(m, hx, -d / 2, hx + 9.0, d / 2, top + 1.4, 1.0, 0.3, T.base);
    }
    if (fine) {
      // The flats over the corner store. The shopfront fills the ground floor
      // on two sides and nothing filled the four storeys above it, which left
      // the one part of this asset that stands proud of the terrace as a
      // sixteen-metre blank corner.
      for (let f = 0; f < floors - 1; f++) {
        const y = 5.4 + f * fh;
        if (y + fh > top + 1.0) break;
        m.windowRow({ axis: 'x', sign: 1, plane: hx + 9.0, from: -d / 2 + 1.2, to: d / 2 - 1.2,
          y0: y + 0.5, y1: y + fh - 0.8, count: 3, width: 1.25,
          glass: MAT.PANE, frame: 0.12, proud: 0.07 });
        for (const [sign, pln] of [[1, d / 2], [-1, -d / 2]] as const) {
          m.windowRow({ axis: 'z', sign, plane: pln, from: hx + 1.0, to: hx + 8.0,
            y0: y + 0.5, y1: y + fh - 0.8, count: 2, width: 1.25,
            glass: MAT.PANE, frame: 0.12, proud: 0.07 });
        }
        band(m, hx, -d / 2, hx + 9.0, d / 2, y + 0.3, 0.22, 0.16, T.trim);
      }
      awning(m, { axis: 'z', sign: 1, plane: d / 2 }, hx + 0.8, hx + 8.2, 4.2, 1.9);
      marquee(m, hx + 0.8, hx + 8.2, d / 2 + 0.3, 1, 5.4, 1.8);
      roofClutter(m, -hx + 2, -d / 2 + 2, hx - 2, d / 2 - 2, top, 51, 0.8);
      for (let i = 0; i < 8; i++) tree(m, -hx + 4 + i * w, d / 2 + 6.0, 7.0, 2.2);
      for (let i = 0; i < 6; i++) figure(m, 540 + i * 17, -24 + i * 9, d / 2 + 4.0, 1.4, { stride: 0.22 });
      bollards(m, { axis: 'z', sign: 1, plane: d / 2 + 1.5 }, -hx, hx, 7.0, 9);
    }
    return m;
  }

  if (T.id === 'asian') {
    // A shophouse terrace over a covered five-foot way.
    const units = 10, w = 6.2, d = 17.0, floors = 4;
    const hx = (units * w) / 2;
    const top = 0.6 + floors * fh;
    for (let i = 0; i < units; i++) {
      const x0 = -hx + i * w, x1 = x0 + w;
      m.box([x0, 0.1, -d / 2], [x1, top, d / 2 - 3.0], T.wall, { roof: MAT.ROOF });
      m.box([x0, 4.2, d / 2 - 3.0], [x1, top, d / 2], T.wall);
      if (medium) {
        m.painted(TINT.NONE, () => {
          m.box([x0, 0.1, d / 2 - 0.7], [x0 + 0.55, 4.2, d / 2], T.base);
          m.box([x1 - 0.55, 0.1, d / 2 - 0.7], [x1, 4.2, d / 2], T.base);
        });
        shopfront(m, { axis: 'z', sign: 1, plane: d / 2 - 3.0 }, x0 + 0.7, x1 - 0.7,
          { bays: 2, head: 3.5, fascia: 0.8 });
        band(m, x0, -d / 2, x1, d / 2, top - 0.6, 0.6, 0.4, T.trim);
        m.box([x1 - 0.25, 0.1, -d / 2 - 0.2], [x1 + 0.25, top + 1.6, d / 2 + 0.3], T.base);
      }
      if (fine) {
        for (let f = 1; f < floors; f++) {
          const y = 0.6 + f * fh;
          m.box([x0 + 0.8, y + 0.6, d / 2 - 0.16], [x1 - 0.8, y + fh - 0.7, d / 2 + 0.02], MAT.PANE);
          m.painted(TINT.METAL_DARK, () => {
            for (let k = 0; k < 5; k++) {
              const px = x0 + 0.9 + (k / 4) * (w - 1.8);
              m.box([px - 0.04, y + 0.6, d / 2 + 0.02], [px + 0.04, y + fh - 0.7, d / 2 + 0.1], MAT.TRIM);
            }
            // The air conditioners and drying rails these fronts are covered in.
            m.box([x0 + 1.0, y + 0.2, d / 2 + 0.05], [x0 + 1.9, y + 0.85, d / 2 + 0.65], MAT.TRIM);
            for (let k = 0; k < 3; k++) {
              m.box([x0 + 2.4, y + 0.5 + k * 0.16, d / 2 + 0.1], [x1 - 1.0, y + 0.54 + k * 0.16, d / 2 + 0.14], MAT.TRIM);
            }
          });
        }
        m.painted(i % 3 === 0 ? TINT.BRAND : i % 3 === 1 ? TINT.ACCENT : TINT.SIGN_LIT, () => {
          m.box([x0 + 0.7, 4.6, d / 2 + 0.05], [x0 + 1.9, top - 1.2, d / 2 + 0.5], MAT.CLADDING);
        });
        marquee(m, x0 + 2.2, x1 - 0.7, d / 2 + 0.06, 1, 4.3, 1.1);
        // The back lane.
        //
        // A shophouse is two elevations, not one: the street front is the shop
        // and the rear is where the kitchen, the back stair and the washing
        // are, opening onto a service lane. It was a blank slab the full
        // length of the terrace, which is the one view of this asset the
        // spawner cannot avoid giving the player. Grilled windows, a rear
        // light well every other unit, and the drying poles that are the whole
        // character of the thing.
        for (let f = 1; f < floors; f++) {
          const y = 0.6 + f * fh;
          m.box([x0 + 1.0, y + 0.7, -d / 2 - 0.02], [x1 - 1.0, y + fh - 0.9, -d / 2 + 0.16], MAT.PANE);
          m.painted(TINT.METAL_DARK, () => {
            for (let k = 0; k < 4; k++) {
              const px = x0 + 1.1 + (k / 3) * (w - 2.2);
              m.box([px - 0.045, y + 0.7, -d / 2 - 0.1], [px + 0.045, y + fh - 0.9, -d / 2 - 0.02], MAT.TRIM);
            }
            // Bamboo poles out of the wall, which is what a rear elevation in
            // this theme is actually covered in.
            if (i % 2 === 1) {
              for (let k = 0; k < 3; k++) {
                m.box([x0 + 1.2, y + 0.9 + k * 0.34, -d / 2 - 1.7],
                      [x1 - 1.2, y + 0.96 + k * 0.34, -d / 2 - 1.62], MAT.TRIM);
              }
            }
          });
        }
        if (i % 2 === 0) {
          // The light well: a half-depth rear projection with its own window,
          // and the back stair landing beside it.
          m.box([x0 + 0.9, 0.1, -d / 2 - 1.9], [x1 - 0.9, top - 1.6, -d / 2], T.base, { roof: MAT.ROOF });
          for (let f = 1; f < floors; f++) {
            const y = 0.6 + f * fh;
            m.box([x0 + 1.5, y + 0.7, -d / 2 - 2.0], [x1 - 1.5, y + fh - 1.0, -d / 2 - 1.86], MAT.PANE);
          }
          railing(m, x0 + 0.9, x1 - 0.9, -d / 2 - 1.9, top - 1.6, 0.9, 1.9);
        }
      }
    }
    if (medium) {
      parapet(m, -hx, -d / 2, hx, d / 2, top, 1.2, 0.28, T.base);
      hip(m, -hx - 0.6, -d / 2 - 0.6, hx + 0.6, d / 2 - 3.0, top + 1.2, 3.0, T.cover);
      // The end walls. A terrace's flanks are party walls with nothing on
      // them but paint -- so they take the painted advertisement they carry
      // in every city this terrace is from, rather than being left bare.
      for (const s of [-1, 1] as const) {
        m.painted(s > 0 ? TINT.BRAND : TINT.ACCENT, () => {
          m.box([s * hx - s * 0.02, 5.4, -d / 2 + 2.0], [s * hx + s * 0.16, top - 2.2, d / 2 - 4.0],
            MAT.CLADDING, { skip: s > 0 ? '-x' : '+x' });
        });
        for (let f = 1; f < floors; f++) {
          const y = 0.6 + f * fh;
          m.opening({ axis: 'x', sign: s, plane: s * hx, u0: d / 2 - 3.4, u1: d / 2 - 1.8,
            y0: y + 0.8, y1: y + fh - 1.1, glass: MAT.PANE, frame: 0.1, proud: 0.07 });
        }
      }
    }
    if (fine) {
      roofClutter(m, -hx + 2, -d / 2 + 2, hx - 2, d / 2 - 5, top, 63, 1.0);
      for (let i = 0; i < 8; i++) figure(m, 650 + i * 13, -24 + i * 7, d / 2 + 2.4, 1.4, { stride: 0.22 });
      for (let i = 0; i < 4; i++) planter(m, -22 + i * 15, d / 2 + 3.4, 1.2, 0.6);
    }
    return m;
  }

  // farming: a manor with its outbuildings round a yard.
  {
    const hx = 17.0, hz = 11.0, floors = 3;
    const top = 0.8 + floors * fh;
    m.box([-hx, 0.1, -hz], [hx, 0.8, hz], T.base);
    m.box([-hx, 0.8, -hz], [hx, top, hz], T.wall);
    if (medium) {
      roofOver(m, T, -hx, -hz, hx, hz, top, { dormers: fine ? 5 : 0, along: 'x' });
      for (const s of [-1, 1]) {
        m.box([s * hx - s * 6.0, 0.8, -hz - 6.0], [s * hx, top, -hz], T.wall);
        roofOver(m, T, s * hx - s * 6.0, -hz - 6.0, s * hx, -hz, top, { along: 'z' });
        m.box([s * (hx - 3.0) - 1.0, 0.8, hz - 0.4], [s * (hx - 3.0) + 1.0, top + 5.2, hz + 1.2], T.base);
      }
      m.box([-3.2, 0.8, hz], [3.2, top - 1.2, hz + 3.4], T.base, { roof: T.cover });
    }
    if (fine) {
      for (const [sign, pln] of [[1, hz], [-1, -hz]] as const) {
        punched(m, T, { axis: 'z', sign, plane: pln }, -hx + 1.5, hx - 1.5, { floors, base: 0.8 });
      }
      doorway(m, T, { axis: 'z', sign: 1, plane: hz + 3.4 }, 0, true);
      // The barn, the stable range, and the yard between them.
      m.box([-30, 0.1, 16.0], [-6, 8.0, 28.0], T.wall);
      m.gable([-30.6, 8.0, 15.4], [-5.4, 8.0, 28.6], 6.2, 'x', T.cover, T.wall);
      m.painted(TINT.WOOD, () => {
        for (let i = 0; i < 3; i++) m.box([-27 + i * 7, 0.12, 15.85], [-22 + i * 7, 5.2, 16.05], MAT.TIMBER);
      });
      m.box([8, 0.1, 16.0], [28, 5.4, 24.0], T.wall);
      m.gable([7.4, 5.4, 15.4], [28.6, 5.4, 24.6], 4.2, 'x', T.cover, T.wall);
      m.painted(TINT.NONE, () => m.box([-31, 0.11, 13.0], [30, 0.22, 29.0], MAT.GROUND));
      m.painted(TINT.METAL_DARK, () => m.cylinder(-34, 21, 2.6, 0.1, 12.0, 12, MAT.METAL, false));
      m.cone(-34, 21, 2.7, 0.4, 12.0, 14.0, 12, MAT.METAL);
      m.painted(TINT.WOOD, () => {
        m.box([0, 0.22, 19.0], [1.4, 1.0, 23.0], MAT.TIMBER);
        for (let i = 0; i < 3; i++) m.box([-2 + i * 3.2, 0.22, 25.0], [0.4 + i * 3.2, 2.6, 28.0], MAT.TIMBER);
      });
      for (const sx of [-24, -12, 20]) tree(m, sx, 6.0, 9.5, 3.4);
      hedge(m, -34, -16.0, 34, -14.8, 1.1);
      for (let i = 0; i < 5; i++) figure(m, 760 + i * 19, -10 + i * 6, 19.0, 2.0, { stride: 0.2 });
      flags(m, -4, 4, hz + 4.0, top + 1.0, 1, 5.0);
    }
    return m;
  }
}

// ====================================================================== table

const homes = (n: number, upkeep: number): AssetDef['sim'] => ({
  households: n, powerKW: 4.8 * n, waterM3: 0.95 * n,
  garbagePerWeek: 17 * n, pollution: 1, upkeep,
});

const NAMES: Record<Theme, [string, string, string]> = {
  modern: ['Meridian Corner', 'Lantern Court', 'Solstice Terrace'],
  european: ['Ancelle Corner', 'Cloister Court', 'Ashgrove Crescent'],
  american: ['Kingsbridge Corner', 'Delancey Courts', 'Rowan Street Brownstones'],
  asian: ['Nine Willows Corner', 'Moon Gate Court', 'Lantern Street Shophouses'],
  farming: ['Millgate Corner', 'Hollow Farmstead', 'Wexford Manor'],
  row: ['', '', ''],
};

const NOTES: Record<Theme, [string, string, string]> = {
  modern: [
    'Eight storeys in two wings meeting at a glazed drum carried two floors above them under a planted deck, over a run of shopfronts.',
    'A seven-storey perimeter block whose street range is lifted on columns so the courtyard runs under it, with a pergola and a lawn inside.',
    'A bowed deck-access block on a hundred-and-fifty metre arc, with two storeys set back and planted, looking over its own lawn.',
  ],
  european: [
    'Six storeys of brick and stone turning the corner on a colonnaded drum under a three-stage lead dome, with iron balconies at the second and fifth floors.',
    'A five-storey perimeter block round a planted courtyard with a fountain, entered through a rusticated carriage arch under a mansarded pavilion.',
    'A bowed crescent of eighteen houses: stone base, iron area railings, a mansard with dormers, and a lawn in front of it.',
  ],
  american: [
    'Seven storeys of brick turning the corner on a drum with a stone cornice, a stepped attic and a timber water tank, with fire escapes down both street elevations.',
    'A six-storey garden-apartment block open to the street between two end pavilions, with a planted court behind.',
    'Eight brownstones with bay fronts, stoops and fire escapes, ending in a corner store with an awning and a lit sign.',
  ],
  asian: [
    'Nine storeys over a shop podium, the corner drum capped with two tiled hips on timber brackets and a finial, with stacked signage and drying balconies.',
    'An eight-storey compound round a courtyard with a lily pond and two tiled pavilions, entered through a moon gate in a tiled screen wall.',
    'Ten shophouse units over a covered five-foot way: vertical signboards, air conditioners and drying rails on the upper floors, roof tanks behind the parapet.',
  ],
  farming: [
    'Three storeys of rendered stone under a steep tiled roof, the corner carrying a boarded dovecote with flight holes under a conical cap.',
    'A farmstead round its yard: a cart entry under a hay loft, boarded doors, a well and a log store.',
    'A manor with two cross wings and stone stacks, its barn, stable range, grain silo and haystack round a yard.',
  ],
  row: ['', '', ''],
};

const FOOTPRINT: Array<[number, number]> = [[10, 9], [10, 8], [12, 8]];
const HOUSEHOLDS = [96, 84, 64];
const UPKEEP = [340, 300, 250];
const KEYS = ['corner', 'court', 'terrace'];

export const SIGNATURE_RESIDENTIAL: AssetDef[] = THEME_ORDER.flatMap((t) => {
  const T = THEMES[t];
  const builds = [cornerBlock, courtyardBlock, setPiece];
  return builds.map((fn, i): AssetDef => ({
    id: `sig.res.${t}.${KEYS[i]}`,
    name: NAMES[t][i],
    zone: 'residential',
    density: t === 'farming' ? 'medium' : 'high',
    variant: 'sculpted',
    theme: t,
    signature: true,
    footprint: FOOTPRINT[i],
    height: 0,
    brand: {
      name: NAMES[t][i],
      colour: [0.22 + i * 0.06, 0.26 + i * 0.03, 0.34 - i * 0.04],
      accent: [0.68, 0.58 - i * 0.04, 0.30 + i * 0.05],
      sign: 'box',
    },
    sim: homes(HOUSEHOLDS[i], UPKEEP[i]),
    note: NOTES[t][i],
    build: (lod: number) => fn(T, lod),
  }));
});
