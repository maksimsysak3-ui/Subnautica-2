/**
 * The tall end of the zoned stock: seven plans for the middle of a city.
 *
 * High density was the thinnest part of the library and the part a player
 * looks at most. A downtown had one office plan, so every office block in it
 * was the same building; high-density commercial had a superstore and an
 * hotel; the five residential towers were all square prisms on square plots.
 * Repeating one prism across forty lots is what makes a generated city read as
 * generated, and no amount of facade detail fixes it, because what the eye
 * sorts a skyline by is silhouette.
 *
 * So these are chosen for *massing* rather than for style: a thin glazed slab,
 * a retail base with flats over, a mall under a vault and a pair of linked
 * shafts. (The tower on a podium, the wedding cake of setbacks and the
 * stepped terrace block that used to be here were box-on-box stacks, and
 * were replaced by the single-form towers in towers.ts.) Put any two of them side by side and they are different
 * shapes from a kilometre away, which is the whole point.
 *
 * They also draw on the vocabulary the signature buildings use -- `curtain`,
 * `pierWall`, `crownStack`, `barrelVault` -- rather than the plain-box walling
 * the rest of the stock uses. That vocabulary is why the signature towers look
 * like towers, and nothing about it was ever specific to a landmark.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { ThemeProfile } from '../themes';
import { banded, crown, plotOf, punched, storeysOf } from '../themed-parts';
import {
  awning, balconies, band, bollards, boxSign, entrance, fasciaSign, frontage, kerb,
  louvres, parapet, planter, ribbon, roofClutter, shopfront,
} from '../parts';
import type { Wall } from '../parts';
import { barrelVault, pierWall } from './signature-parts';

/**
 * The four walls of a rectangle, as the wall records the part helpers take.
 *
 * Every plan here needs them and spelling the four literals out each time is
 * how one of them ends up with the wrong sign and a window sunk into the wall.
 */
function walls(x0: number, z0: number, x1: number, z1: number): Wall[] {
  return [
    { axis: 'z', sign: 1, plane: z1 }, { axis: 'z', sign: -1, plane: z0 },
    { axis: 'x', sign: 1, plane: x1 }, { axis: 'x', sign: -1, plane: x0 },
  ];
}

/**
 * The shaft of a tall block, in the theme's own structural idiom.
 *
 * The one decision that separates a post-war tower from a pre-war one: a
 * curtain wall hangs off the floor slabs and expresses them as bands, a pier
 * wall *is* the structure and expresses the verticals. `T.ribbon` already
 * records which side of that a theme sits on, so this reads it rather than
 * asking every plan to decide again.
 */
function shaft(m: MeshBuilder, T: ThemeProfile, x0: number, z0: number, x1: number, z1: number,
               base: number, floors: number, lod: number): void {
  const top = base + floors * T.floorH;
  // The envelope is drawn here and nowhere else.
  //
  // `pierWall` draws its own solid body, so a plan that also drew a wall box
  // put two surfaces on the same plane and the depth test picked between them
  // per pixel. One owner for the envelope, chosen by detail level.
  if (lod > 0) {
    m.box([x0, base, z0], [x1, top, z1], T.wall, { roof: T.cover });
    return;
  }
  if (T.ribbon) {
    // Ribbon themes: the wall box in the theme's material with the glazing
    // banded across it, which is what the rest of the library's tall blocks
    // use and what makes them read as glass.
    //
    // Not `curtain` on MAT.GLASS. That material is already a complete curtain
    // wall -- its own mullions, its own spandrel course and the lit office
    // behind each pane -- so a `curtain` frame over it expressed every floor
    // twice at two different spacings, and the interference read as a beige
    // grid rather than as a glass tower.
    m.box([x0, base, z0], [x1, top, z1], T.wall, { roof: T.cover });
    for (const wl of walls(x0, z0, x1, z1)) {
      const [u0, u1] = wl.axis === 'x' ? [z0 + 0.8, z1 - 0.8] : [x0 + 0.8, x1 - 0.8];
      banded(m, T, wl, u0, u1, floors, base);
    }
    return;
  }
  // Masonry themes: the wall is the structure, so the piers are continuous and
  // the glazing runs in vertical strips between them. This is the one part of
  // the signature vocabulary that was never specific to a landmark, and it is
  // most of why a pre-war tower reads as pre-war.
  pierWall(m, x0, z0, x1, z1, base, floors, T.floorH, T.wall, {
    bays: Math.max(2, Math.round((x1 - x0) / 5.0)), strips: true, windows: true,
  });
  m.box([x0, top - 0.35, z0], [x1, top, z1], T.wall, { roof: T.cover });
}

/** A lit lobby behind glass, along one elevation, under a canopy. */
function lobby(m: MeshBuilder, x0: number, x1: number, z: number,
               height: number, seed: number): void {
  ribbon(m, { axis: 'z', sign: 1, plane: z }, x0 + 1.2, x1 - 1.2, 1.0, height - 0.9, { mullions: 9 });
  entrance(m, { axis: 'z', sign: 1, plane: z }, (x0 + x1) / 2,
    { width: 3.6, height: 3.4, double: true, glazed: true, canopy: 2.8 });
  boxSign(m, { axis: 'z', sign: 1, plane: z }, -3.2, 3.2, height - 0.8, height - 0.1);
  frontage(m, x0, x1, z + 0.6, seed, { planters: 3, bollards: 8 });
}

// ------------------------------------------------------------------ offices

/**
 * Curtain-wall slab.
 *
 * Thin, wide and glazed on its two long faces, with the cores expressed as
 * solid stone ends standing proud and a little taller. The point of it in a
 * downtown is that it has an axis: whichever way the lot is turned, half the
 * blocks on the street present a broad wall and half a narrow one, and that
 * alone breaks up a run of square towers.
 */
export function curtainSlab(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const [w, d] = plotOf(T, 45.0, 21.0);
  const x = w / 2, z = d / 2;
  const floors = storeysOf(T, 15);
  const base = T.floorH * 1.9;
  const wall = base + floors * T.floorH;
  const end = w * 0.14;

  // The ground floor is set back behind the line of the slab and the weight
  // above lands on columns: the one detail that says "slab on piloti" rather
  // than "box standing on the pavement".
  m.box([-x, 0, -z + 1.3], [x, base, z - 1.3], T.base, { roof: MAT.ROOF });
  shaft(m, T, -x + end, -z, x - end, z, base, floors, lod);
  // The two service ends, in the heavier material, taken above the roof line.
  for (const sx of [-1, 1] as const) {
    const a = sx > 0 ? x - end : -x, b = sx > 0 ? x : -x + end;
    m.box([a, 0, -z], [b, wall + 3.4, z], T.base, { roof: MAT.ROOF });
    if (medium) parapet(m, a, -z, b, z, wall + 3.4, 0.9, 0.18, T.base);
  }
  crown(m, T, -x + end, -z, x - end, z, wall, seed);

  if (medium) {
    for (let i = 0; i < 7; i++) {
      const px = -x + end + 1.2 + (i / 6) * (w - 2 * end - 2.4);
      for (const pz of [-z + 1.3, z - 1.3]) {
        m.box([px - 0.32, 0, pz - 0.32], [px + 0.32, base, pz + 0.32], MAT.CONCRETE);
      }
    }
    band(m, -x + end, -z - 0.2, x - end, z + 0.2, base, 0.55, 0.3, T.trim);
    // The two end walls are the tallest blank surfaces in the plan -- twenty
    // metres wide and sixty up -- so they get what a real core gets: a
    // recessed joint either side of a stair strip, a full-height slot of
    // glazing in it, and the plant louvres at the head.
    for (const sx of [-1, 1] as const) {
      const wl: Wall = { axis: 'x', sign: sx, plane: sx > 0 ? x : -x };
      for (const s2 of [-1, 1] as const) {
        m.box([sx > 0 ? x - 0.16 : -x, 0, s2 * (z * 0.34) - 0.2],
              [sx > 0 ? x : -x + 0.16, wall + 3.4, s2 * (z * 0.34) + 0.2], T.trim);
      }
      ribbon(m, wl, -z * 0.32, z * 0.32, base + 1.0, wall - 4.0, { mullions: 3 });
      // Plant louvres at the head, banded top and bottom so the panel reads as
      // an opening in the core rather than as a sign hung on it.
      louvres(m, wl, -z * 0.30, z * 0.30, wall + 0.4, wall + 2.6, 0.5);
      for (const y of [wall - 0.2, wall + 2.9]) {
        m.box([sx > 0 ? x - 0.1 : -x - 0.22, y, -z * 0.42],
              [sx > 0 ? x + 0.22 : -x + 0.1, y + 0.5, z * 0.42], T.trim);
      }
    }
  }
  if (fine) {
    lobby(m, -x + end, x - end, z - 1.3, base, seed);
    kerb(m, -x - 1.0, z + 1.0, x + 1.0, z + 2.2);
  }
  return m;
}

// --------------------------------------------------------------- commercial

/**
 * Mixed-use block: shops below, flats above.
 *
 * What high-density commercial frontage is actually made of in every city that
 * has any, and the library had nothing between a superstore and an hotel. The
 * two-storey retail base runs to the pavement on three sides; the residential
 * slab above is set back off the street so the base reads as a base.
 */
export function mixedUse(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const [w, d] = plotOf(T, 29.0, 37.0);
  const x = w / 2, z = d / 2;
  const retail = T.floorH * 1.5;
  const deck = retail + T.floorH * 1.2;
  const floors = storeysOf(T, 8);
  const inset = 2.0;
  const wall = deck + floors * T.floorH;

  m.box([-x, 0, -z], [x, retail, z], T.base, { roof: MAT.ROOF });
  m.box([-x, retail, -z], [x, deck, z], T.base, { roof: MAT.ROOF });
  m.box([-x + inset, deck, -z + inset], [x - inset, wall, z - inset], T.wall, { roof: T.cover });
  crown(m, T, -x + inset, -z + inset, x - inset, z - inset, wall, seed);

  if (medium) {
    band(m, -x, -z, x, z, retail, 0.42, 0.24, T.trim);
    parapet(m, -x, -z, x, z, deck, 1.0, 0.2, T.base);
    // The deck the setback leaves is the block's communal garden.
    m.box([-x + 0.5, deck, -z + 0.5], [x - 0.5, deck + 0.14, z - 0.5], T.base);
    for (const [px, pz] of [[-x + inset * 0.5, 0], [x - inset * 0.5, 0]] as const) {
      planter(m, px, pz, 1.3, 0.65);
    }
    awning(m, { axis: 'z', sign: 1, plane: z }, -x + 1.0, x - 1.0, retail - 1.2, 1.7);
    awning(m, { axis: 'x', sign: 1, plane: x }, -z + 1.0, z - 1.0, retail - 1.2, 1.7);
    if (T.balcony !== 'none') {
      for (const [sign, plane] of [[1, z - inset], [-1, -z + inset]] as const) {
        balconies(m, { axis: 'z', sign, plane }, -x + inset + 1.0, x - inset - 1.0,
          { floors, floorH: T.floorH, base: deck + 0.5, bays: 3, depth: 1.4, solid: T.balcony === 'solid' });
      }
    }
  }
  if (fine) {
    for (const wl of walls(-x + inset, -z + inset, x - inset, z - inset)) {
      const [u0, u1] = wl.axis === 'x' ? [-z + inset + 0.9, z - inset - 0.9] : [-x + inset + 0.9, x - inset - 0.9];
      if (T.ribbon) banded(m, T, wl, u0, u1, floors, deck);
      else punched(m, T, wl, u0, u1, { floors, base: deck + 0.9 });
    }
    // Shops on two elevations, because a corner block has two frontages and
    // one of the commonest faults in the library was a blank return wall.
    shopfront(m, { axis: 'z', sign: 1, plane: z }, -x + 0.8, x - 0.8,
      { bays: 4, doorBay: 2, head: retail - 1.0, fascia: 0.95 });
    shopfront(m, { axis: 'x', sign: 1, plane: x }, -z + 0.8, z - 0.8,
      { bays: 5, doorBay: 4, head: retail - 1.0, fascia: 0.95 });
    fasciaSign(m, { axis: 'z', sign: 1, plane: z }, -x + 1.6, x - 1.6, retail - 0.95, retail - 0.15);
    fasciaSign(m, { axis: 'x', sign: 1, plane: x }, -z + 1.6, z - 1.6, retail - 0.95, retail - 0.15);
    for (const wl of [{ axis: 'z', sign: 1, plane: z } as Wall, { axis: 'x', sign: 1, plane: x } as Wall]) {
      const [u0, u1] = wl.axis === 'x' ? [-z + 1.4, z - 1.4] : [-x + 1.4, x - 1.4];
      ribbon(m, wl, u0, u1, retail + 0.6, deck - 0.8, { mullions: 7 });
    }
    bollards(m, { axis: 'z', sign: 1, plane: z }, -x + 1.0, x - 1.0, 1.4, 7);
    kerb(m, -x - 1.2, z + 1.0, x + 1.2, z + 2.2);
  }
  return m;
}

/**
 * Shopping galleria.
 *
 * Two retail ranges with a glazed vault over the mall between them, a portal
 * at each end and a parking deck over one range. A superstore is a shed with a
 * car park; this is the other kind of big retail, and it is a completely
 * different object from above -- which is the view that matters.
 */
export function galleria(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const [w, d] = plotOf(T, 42.0, 42.0);
  const x = w / 2, z = d / 2;
  const mall = d * 0.20;                       // half-width of the vaulted mall
  const high = T.floorH * 2.4;                 // eaves of the ranges
  const rangeZ = [[-z, -mall], [mall, z]] as const;

  for (const [z0, z1] of rangeZ) {
    m.box([-x, 0, z0], [x, high, z1], T.wall, { roof: MAT.ROOF });
    if (medium) parapet(m, -x, z0, x, z1, high, 1.2, 0.26, T.base);
  }
  // The mall floor and its end walls, then the vault over them.
  m.box([-x, 0, -mall], [x, 0.14, mall], MAT.TILE);
  for (const sx of [-1, 1] as const) {
    const a = sx > 0 ? x - 1.0 : -x, b = sx > 0 ? x : -x + 1.0;
    m.box([a, 0, -mall], [b, high * 0.82, mall], T.base);
  }
  barrelVault(m, -x + 1.0, -mall, x - 1.0, mall, high * 0.82, mall * 0.85,
    medium ? 9 : 5, { ribs: medium ? Math.round(w / 6) : 3 });
  m.roofDressed = true;

  // The deck over the north range: kerbs, lamp columns and a stair core.
  const [dz0, dz1] = rangeZ[0];
  m.box([-x + 0.4, high, dz0 + 0.4], [x - 0.4, high + 0.16, dz1 - 0.4], MAT.CONCRETE);
  m.box([-x + 3.0, high + 0.16, dz0 + 2.0], [-x + 8.0, high + 4.2, dz0 + 7.0], T.base, { roof: MAT.ROOF });
  if (medium) {
    parapet(m, -x + 3.0, dz0 + 2.0, -x + 8.0, dz0 + 7.0, high + 4.2, 0.8, 0.16, T.base);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 6; i++) {
        const px = -x + 6.0 + (i / 5) * (w - 12.0);
        m.cylinder(px, (dz0 + dz1) / 2, 0.11, high + 0.16, high + 5.0, 6, MAT.TRIM, false);
        m.box([px - 0.5, high + 5.0, (dz0 + dz1) / 2 - 0.3], [px + 0.5, high + 5.3, (dz0 + dz1) / 2 + 0.3], MAT.LAMP);
      }
    });
    roofClutter(m, -x + 2.0, dz1 - 0.4 + 0.5, x - 2.0, z - 2.0, high, seed, 0.8);
    band(m, -x, dz0, x, dz1, high * 0.5, 0.5, 0.3, T.trim);
    band(m, -x, rangeZ[1][0], x, rangeZ[1][1], high * 0.5, 0.5, 0.3, T.trim);
  }
  if (fine) {
    // The street elevations of both ranges: this is a shop, so it is shopfront
    // at the bottom and blank above, which is exactly what a real one is.
    shopfront(m, { axis: 'z', sign: 1, plane: z }, -x + 1.2, x - 1.2,
      { bays: 6, doorBay: 3, head: T.floorH * 1.3, fascia: 1.1 });
    fasciaSign(m, { axis: 'z', sign: 1, plane: z }, -x + 6.0, x - 6.0, T.floorH * 1.3 + 0.15, T.floorH * 1.3 + 1.25);
    for (const sx of [-1, 1] as const) {
      entrance(m, { axis: 'x', sign: sx, plane: sx > 0 ? x : -x }, 0,
        { width: 5.0, height: high * 0.62, double: true, glazed: true, canopy: 2.0 });
    }
    for (const [z0, z1] of rangeZ) {
      for (const wl of [{ axis: 'x', sign: 1, plane: x } as Wall, { axis: 'x', sign: -1, plane: -x } as Wall]) {
        punched(m, T, wl, z0 + 1.4, z1 - 1.4, { floors: 1, base: high * 0.55 });
      }
    }
    // The glazed shop walls facing into the mall, which is what a vault is for.
    for (const [zi, sign] of [[-mall, -1], [mall, 1]] as const) {
      ribbon(m, { axis: 'z', sign, plane: zi }, -x + 2.0, x - 2.0, 0.9, high * 0.55, { mullions: 10 });
    }
    frontage(m, -x, x, z + 0.8, seed, { planters: 5, bollards: 12 });
    kerb(m, -x - 1.0, z + 0.9, x + 1.0, z + 1.9);
  }
  return m;
}

// -------------------------------------------------------------- residential

/**
 * Twin towers on a shared podium.
 *
 * Two slim shafts and a link bridge two thirds up. Twinning is the cheapest
 * way a real estate scheme gets density without a floorplate nobody wants to
 * live in, so it is everywhere -- and a pair of slim towers reads as a
 * completely different object from one fat one holding the same number of
 * flats, which is the whole argument for the plan.
 */
export function twinTowers(lod: number, T: ThemeProfile, seed: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const [w, d] = plotOf(T, 45.0, 25.0);
  const x = w / 2, z = d / 2;
  const podium = T.floorH * Math.max(1.4, T.podium);
  const floors = storeysOf(T, 13);
  const wall = podium + floors * T.floorH;
  const half = w * 0.21;                       // half-width of one shaft
  const gap = w * 0.09;                        // half the gap between them
  const tz = z - 1.6;

  m.box([-x, 0, -z], [x, podium, z], T.base, { roof: MAT.ROOF });
  const towers: Array<[number, number]> = [[-x + 0.8, -x + 0.8 + half * 2], [x - 0.8 - half * 2, x - 0.8]];
  void gap;
  for (const [a, b] of towers) {
    m.box([a, podium, -tz], [b, wall, tz], T.wall, { roof: T.cover });
    crown(m, T, a, -tz, b, tz, wall, seed + (a < 0 ? 0 : 23));
    if (fine) {
      // Three walls, not four. The flank each shaft turns towards the other is
      // four metres from its twin and never seen from any camera the game has,
      // and windowing it cost a quarter of the plan's whole triangle budget.
      const inner = a < 0 ? b : a;
      for (const wl of walls(a, -tz, b, tz)) {
        if (wl.axis === 'x' && wl.plane === inner) continue;
        const [u0, u1] = wl.axis === 'x' ? [-tz + 0.9, tz - 0.9] : [a + 0.9, b - 0.9];
        if (T.ribbon) banded(m, T, wl, u0, u1, floors, podium);
        else punched(m, T, wl, u0, u1, { floors, base: podium + 0.9 });
      }
      if (T.balcony !== 'none') {
        for (const [sign, plane] of [[1, tz], [-1, -tz]] as const) {
          balconies(m, { axis: 'z', sign, plane }, a + 1.0, b - 1.0,
            { floors, floorH: T.floorH, base: podium + 0.5, bays: 1, depth: 1.5, solid: T.balcony === 'solid' });
        }
      }
    }
  }
  if (medium) {
    // The bridge. Two floors of it, glazed on both faces, landing on the two
    // shafts rather than floating between them.
    const by = podium + Math.floor(floors * 0.62) * T.floorH;
    const bh = T.floorH * 2;
    m.box([towers[0][1] - 0.4, by, -tz * 0.45], [towers[1][0] + 0.4, by + bh, tz * 0.45], T.base);
    m.painted(TINT.METAL_DARK, () => {
      m.box([towers[0][1] - 0.5, by - 0.35, -tz * 0.48], [towers[1][0] + 0.5, by, tz * 0.48], MAT.TRIM);
      m.box([towers[0][1] - 0.5, by + bh, -tz * 0.48], [towers[1][0] + 0.5, by + bh + 0.35, tz * 0.48], MAT.TRIM);
    });
    band(m, -x, -z, x, z, podium - 0.9, 0.44, 0.24, T.trim);
    parapet(m, -x, -z, x, z, podium, 0.95, 0.18, T.base);
    roofClutter(m, -x + 2.0, -z + 2.0, x - 2.0, z - 2.0, podium + 0.1, seed, 0.5);
  }
  if (fine) {
    for (const [sign, plane] of [[1, tz * 0.45], [-1, -tz * 0.45]] as const) {
      const by = podium + Math.floor(floors * 0.62) * T.floorH;
      ribbon(m, { axis: 'z', sign, plane }, towers[0][1] + 0.2, towers[1][0] - 0.2,
        by + 0.5, by + T.floorH * 2 - 0.5, { mullions: 6 });
    }
    // Glazed on the street and the two returns; the back of a podium is a
    // service wall in every real block and nobody's camera gets behind it.
    for (const wl of [{ axis: 'z', sign: 1, plane: z } as Wall,
      { axis: 'x', sign: 1, plane: x } as Wall, { axis: 'x', sign: -1, plane: -x } as Wall]) {
      const [u0, u1] = wl.axis === 'x' ? [-z + 1.2, z - 1.2] : [-x + 1.2, x - 1.2];
      ribbon(m, wl, u0, u1, 1.1, podium - 1.2, { mullions: 9 });
    }
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0,
      { width: 4.0, height: 3.6, double: true, glazed: true, canopy: 3.0 });
    frontage(m, -x, x, z + 0.6, seed, { planters: 4, bollards: 10 });
    kerb(m, -x - 1.2, z + 0.9, x + 1.2, z + 1.9);
  }
  return m;
}
