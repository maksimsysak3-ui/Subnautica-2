/**
 * Signature industry: the works and the yard, in each of the five themes.
 *
 * Industry is where a themed library usually gives up, because a shed is a
 * shed -- and that is exactly wrong. What a region makes is the most regional
 * thing about it, and the plant that makes it has a silhouette nothing else
 * does: a blast furnace and its stoves, a mill chimney over a weaving shed, a
 * refinery's column row and flare, a dry dock with a hull in it, a grain
 * dryer over a silo battery. None of these ten is any of the others with a
 * different wall material, and none of them would be mistaken for one.
 *
 * Two per theme. The *works* is the building that makes the thing; the *yard*
 * is the process laid out in the open, where the plant is the architecture and
 * the only enclosure is what has to be enclosed.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import { THEME_ORDER } from '../themes';
import type { Theme } from '../themes';
import {
  conveyor, curtain, flags, lattice, loft, marquee,
  pipeRack, plan, sawtooth, scaled, silo,
} from './signature-parts';
import { band, parapet, railing } from '../parts';
import { hedge, tree } from './landscape';
import { figure } from './vehicles';

// ---------------------------------------------------------------- shared bits

/** Hardstanding with painted bays and a kerb, which is what a works stands on. */
function apron(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number,
  lanes = 0, y = 0): void {
  m.box([x0, y + 0.0005, z0], [x1, y + 0.09, z1], MAT.GROUND);
  m.painted(TINT.NONE, () => {
    m.box([x0 - 0.25, y + 0.0005, z0 - 0.25], [x1 + 0.25, y + 0.18, z0], MAT.CONCRETE);
    m.box([x0 - 0.25, y + 0.0005, z1], [x1 + 0.25, y + 0.18, z1 + 0.25], MAT.CONCRETE);
    for (let i = 1; i < lanes; i++) {
      const x = x0 + (i / lanes) * (x1 - x0);
      m.box([x - 0.09, y + 0.09, z0 + 1.5], [x + 0.09, y + 0.11, z1 - 1.5], MAT.PLATE);
    }
  });
}

/** A run of roller-shutter loading doors along a wall. */
function docks(m: MeshBuilder, x0: number, x1: number, z: number, sign: 1 | -1,
  count: number, h = 4.6, y = 0): void {
  // Depths measured out from the wall, returned low corner first. A bay on a
  // wall facing -z has `sign` -1, and `z + sign * d` is then *below* `z`, so
  // writing the pair in source order handed every box on that elevation its
  // corners reversed -- and a reversed box is wound inside out and culled.
  const out = (a: number, b: number): [number, number] =>
    (sign > 0 ? [z + a, z + b] : [z - b, z - a]);
  for (let i = 0; i < count; i++) {
    const c = x0 + ((i + 0.5) / count) * (x1 - x0);
    const [s0, s1] = out(0, 0.3), [c0, c1] = out(0, 1.6);
    const [g0, g1] = out(0.32, 0.42), [l0, l1] = out(0.3, 1.5);
    m.painted(TINT.METAL_DARK, () => {
      m.box([c - 1.9, y + 0.1, s0], [c + 1.9, y + h, s1], MAT.TRIM);
      m.box([c - 2.2, y + h, c0], [c + 2.2, y + h + 0.5, c1], MAT.TRIM, { skipBottom: false });
    });
    m.box([c - 1.6, y + 1.2, g0], [c + 1.6, y + h - 0.3, g1], MAT.METAL);
    // The dock leveller: the lip a trailer's floor meets, which is the one
    // thing that says loading bay rather than roller shutter.
    m.box([c - 2.0, y + 1.1, l0], [c + 2.0, y + 1.2, l1], MAT.CONCRETE);
  }
}

/** A chain-link boundary with a gatehouse: the one thing every works has. */
function perimeter(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number,
  gate: number, y = 0): void {
  m.painted(TINT.METAL_DARK, () => {
    const post = (x: number, z: number): void => m.cylinder(x, z, 0.09, y + 0.1, y + 2.6, 4, MAT.TRIM, false);
    for (let x = x0; x <= x1; x += 6) { post(x, z0); if (Math.abs(x - gate) > 6) post(x, z1); }
    for (let z = z0; z <= z1; z += 6) { post(x0, z); post(x1, z); }
    for (const z of [z0, z1]) m.box([x0, y + 2.4, z - 0.04], [x1, y + 2.5, z + 0.04], MAT.TRIM);
    for (const x of [x0, x1]) m.box([x - 0.04, y + 2.4, z0], [x + 0.04, y + 2.5, z1], MAT.TRIM);
  });
  m.box([gate - 4.0, y + 0.1, z1 - 3.0], [gate + 4.0, y + 3.4, z1 + 0.4], MAT.CONCRETE, { roof: MAT.ROOF });
  m.box([gate - 3.4, y + 1.0, z1 - 3.2], [gate + 3.4, y + 2.8, z1 - 2.8], MAT.GLASS);
}

// ============================================================ modern: the fab

/**
 * A semiconductor fab: a sealed white box with all of its plant on the roof.
 *
 * The most recognisable modern industrial building and the least building-like
 * -- no windows anywhere, because the process cannot have daylight, and a
 * plant deck as tall as the thing it serves, because the air handling for a
 * clean room is bigger than the clean room. The gas farm and the chiller yard
 * outside are the rest of it.
 */
function semiconductorFab(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 46.0, hz = 30.0, wall = 16.0;

  apron(m, -60, -46, 60, 44, 0);
  m.box([-hx, 0.1, -hz], [hx, wall, hz], MAT.CLADDING, { roof: MAT.ROOF });
  if (medium) {
    // The ribbed skin, and the one strip of glazing there is: the entrance.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 24; i++) {
        const x = -hx + (i / 24) * hx * 2;
        m.box([x - 0.16, 0.1, -hz - 0.24], [x + 0.16, wall, -hz], MAT.TRIM);
        m.box([x - 0.16, 0.1, hz], [x + 0.16, wall, hz + 0.24], MAT.TRIM);
      }
      band(m, -hx, -hz, hx, hz, wall - 1.2, 0.5, 0.32, MAT.TRIM);
    });
    m.box([-16, 0.6, hz], [16, 7.4, hz + 0.4], MAT.GLASS);
    m.painted(TINT.BRAND, () => band(m, -hx, -hz, hx, hz, wall - 3.6, 1.6, 0.5, MAT.CLADDING));
    // The plant deck: a full-footprint enclosure on the roof, half its height
    // again, with the ducts and chillers standing on it.
    m.box([-hx + 3, wall, -hz + 3], [hx - 3, wall + 9.0, hz - 3], MAT.METAL, { roof: MAT.ROOF });
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 14; i++) {
        const x = -hx + 3 + (i / 14) * (hx - 3) * 2;
        m.box([x - 0.2, wall, -hz + 2.8], [x + 0.2, wall + 9.0, -hz + 3.2], MAT.TRIM);
        m.box([x - 0.2, wall, hz - 3.2], [x + 0.2, wall + 9.0, hz - 2.8], MAT.TRIM);
      }
    });
  }
  if (fine) {
    parapet(m, -hx + 3, -hz + 3, hx - 3, hz - 3, wall + 9.0, 1.2, 0.3, MAT.METAL);
    // Air handlers and ducting on the deck, in rows.
    m.painted(TINT.METAL_DARK, () => {
      for (let r = 0; r < 3; r++) {
        for (let i = 0; i < 6; i++) {
          const x = -36 + i * 14, z = -16 + r * 16;
          m.box([x - 5.0, wall + 9.0, z - 4.0], [x + 5.0, wall + 13.4, z + 4.0], MAT.METAL, { roof: MAT.ROOF });
          m.cylinder(x + 6.4, z, 1.5, wall + 9.0, wall + 15.0, 8, MAT.METAL, true);
          m.box([x - 5.0, wall + 10.4, z - 4.6], [x + 5.0, wall + 12.4, z - 4.0], MAT.TRIM);
        }
      }
    });
    // The gas farm: a bunded row of bullet tanks behind a blast wall.
    m.box([-hx - 13.0, 0.1, -20], [-hx - 1.0, 4.6, 20], MAT.CONCRETE);
    for (let i = 0; i < 5; i++) {
      m.painted(TINT.NONE, () => {
        m.cylinder(-hx - 7.0, -16 + i * 8, 1.8, 4.6, 12.4, 10, MAT.METAL, true);
      });
      m.painted(TINT.ACCENT, () => {
        m.cylinder(-hx - 7.0, -16 + i * 8, 1.85, 6.4, 7.4, 10, MAT.TRIM, false);
      });
    }
    pipeRack(m, -hx - 7.0, -hx + 1.0, -22.0, 6.0, 4, 3);
    // The chiller yard.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 6; i++) {
        const x = hx + 4 + (i % 3) * 9, z = -14 + Math.floor(i / 3) * 16;
        m.box([x - 3.6, 0.2, z - 4.4], [x + 3.6, 4.2, z + 4.4], MAT.METAL, { roof: MAT.ROOF });
        for (const sx of [-2.0, 2.0]) m.cylinder(x + sx, z, 1.5, 4.2, 4.8, 8, MAT.TRIM, true);
      }
    });
    marquee(m, -12, 12, hz + 0.6, 1, 8.0, 2.6);
    flags(m, -26, 26, hz + 8.0, 0.2, 5, 9.0);
    perimeter(m, -58, -44, 58, 42, 0);
    for (let i = 0; i < 5; i++) figure(m, 5501 + i * 13, -10 + i * 5, hz + 5.0, Math.PI, { stride: 0.2 });
    hedge(m, -58, 39.0, 58, 40.2, 0.9);
  }
  return m;
}

/**
 * An automated distribution centre: a shed, its dock face, and its trailers.
 *
 * The single most-built industrial building in the world right now, and its
 * whole design is one elevation -- twenty-four dock doors on a saw-toothed
 * concrete apron with the trailers backed on to them. Everything else is the
 * cheapest possible enclosure, and it is honest about that.
 */
function distributionCentre(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 60.0, hz = 30.0, wall = 13.5;

  apron(m, -72, -58, 72, 44, 0);
  m.box([-hx, 0.1, -hz], [hx, wall, hz], MAT.METAL, { roof: MAT.ROOF });
  if (medium) {
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 30; i++) {
        const x = -hx + (i / 30) * hx * 2;
        m.box([x - 0.14, 0.1, -hz - 0.2], [x + 0.14, wall, -hz], MAT.TRIM);
        m.box([x - 0.14, 0.1, hz], [x + 0.14, wall, hz + 0.2], MAT.TRIM);
      }
      band(m, -hx, -hz, hx, hz, wall - 0.9, 0.7, 0.3, MAT.TRIM);
    });
    m.painted(TINT.BRAND, () => band(m, -hx, -hz, hx, hz, wall - 3.4, 2.2, 0.45, MAT.CLADDING));
    // The office corner: two glazed storeys cut into one end.
    m.box([-hx, 0.1, hz - 14], [-hx + 22, 9.0, hz], MAT.CONCRETE, { roof: MAT.ROOF });
    curtain(m, -hx + 0.4, hz - 0.4, -hx + 21.6, hz + 0.4, 0.6, 2, 4.0, { mullions: 3.0 });
    docks(m, -hx + 26, hx - 4, -hz, -1, 18);
  }
  if (fine) {
    parapet(m, -hx, -hz, hx, hz, wall, 1.0, 0.25, MAT.METAL);
    // A photovoltaic array over most of the roof: rows of tilted panels.
    m.painted(TINT.METAL_DARK, () => {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 10; c++) {
          const x = -54 + c * 11.5, z = -25 + r * 6.6;
          m.quad([x - 4.6, wall + 0.5, z - 2.2], [x + 4.6, wall + 0.5, z - 2.2],
                 [x + 4.6, wall + 2.0, z + 2.2], [x - 4.6, wall + 2.0, z + 2.2], MAT.GLASS);
          m.box([x - 4.6, wall, z + 1.9], [x + 4.6, wall + 2.0, z + 2.2], MAT.TRIM);
        }
      }
    });
    // The trailer yard: parked semi-trailers backed on to the dock face.
    for (let i = 0; i < 12; i++) {
      const x = -hx + 28 + i * 6.4;
      m.painted(TINT.NONE, () => {
        m.box([x - 2.5, 1.3, -hz - 15.0], [x + 2.5, 5.4, -hz - 1.2], MAT.CONTAINER, { roof: MAT.ROOF });
      });
      m.painted(TINT.METAL_DARK, () => {
        m.box([x - 2.3, 0.9, -hz - 14.6], [x + 2.3, 1.3, -hz - 1.6], MAT.TRIM);
        for (const pz of [-hz - 13.6, -hz - 12.2]) {
          m.cylinder(x - 2.2, pz, 0.55, 0.1, 1.0, 8, MAT.TYRE, true);
          m.cylinder(x + 2.2, pz, 0.55, 0.1, 1.0, 8, MAT.TYRE, true);
        }
        m.box([x - 0.4, 0.6, -hz - 15.4], [x + 0.4, 1.3, -hz - 14.6], MAT.TRIM);
      });
    }
    m.painted(TINT.NONE, () => {
      for (let i = 0; i <= 12; i++) {
        const x = -hx + 25 + i * 6.4;
        m.box([x - 0.08, 0.09, -hz - 20.0], [x + 0.08, 0.11, -hz - 1.0], MAT.PLATE);
      }
    });
    marquee(m, -hx + 3, -hx + 19, hz + 0.5, 1, 9.4, 2.6);
    flags(m, -hx + 4, -hx + 18, hz + 6.0, 0.2, 3, 9.0);
    perimeter(m, -70, -56, 70, 42, -46);
    for (let i = 0; i < 4; i++) figure(m, 6607 + i * 11, -hx + 8 + i * 4, hz + 4.0, Math.PI, { stride: 0.2 });
  }
  return m;
}

// ======================================================== european: the mill

/**
 * A spinning mill: a six-storey brick block, an engine house and a chimney.
 *
 * The building that industrialised Europe, and still the most legible
 * industrial silhouette there is -- a long brick box with a regular grid of
 * cast-iron windows, a stair tower on the front, an engine house at one end
 * and a round chimney behind it. The weaving shed alongside is the saw-tooth.
 */
function spinningMill(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 40.0, hz = 15.0, floorH = 3.6, floors = 6;
  const top = 1.0 + floors * floorH;

  apron(m, -56, -46, 56, 34, 0);
  m.box([-hx, 0.1, -hz], [hx, 1.0, hz], MAT.STONE);
  m.box([-hx, 1.0, -hz], [hx, top, hz], MAT.BRICK, { roof: MAT.ROOF });
  if (medium) {
    band(m, -hx, -hz, hx, hz, top - 0.8, 0.8, 0.55, MAT.STONE);
    m.gable([-hx - 0.6, top, -hz - 0.6], [hx + 0.6, top, hz + 0.6], 4.6, 'x', MAT.ROOF_TILE, MAT.BRICK);
    for (let f = 0; f < floors; f++) {
      for (const [sign, pln] of [[1, hz], [-1, -hz]] as const) {
        m.windowRow({
          axis: 'z', sign, plane: pln, from: -hx + 2, to: hx - 2,
          y0: 1.0 + f * floorH + 0.7, y1: 1.0 + (f + 1) * floorH - 0.7,
          count: 15, width: 1.6, glass: MAT.PANE, frame: 0.14, proud: 0.08,
        });
      }
    }
    // The stair tower: taller than the mill, with a water tank on top.
    m.box([-6.0, 0.1, hz], [6.0, top + 6.0, hz + 7.0], MAT.BRICK, { roof: MAT.ROOF });
    band(m, -6.0, hz, 6.0, hz + 7.0, top + 5.2, 0.8, 0.5, MAT.STONE);
    m.box([-5.0, top + 6.0, hz + 1.0], [5.0, top + 10.0, hz + 6.0], MAT.STONE, { roof: MAT.ROOF });
    for (let f = 0; f < floors + 1; f++) {
      m.windowRow({
        axis: 'z', sign: 1, plane: hz + 7.0, from: -4.6, to: 4.6,
        y0: 1.0 + f * floorH + 0.7, y1: 1.0 + (f + 1) * floorH - 0.7,
        count: 2, width: 1.4, glass: MAT.PANE, frame: 0.14, proud: 0.08,
      });
    }
  }
  if (fine) {
    // The engine house, and the chimney behind it.
    m.box([hx, 0.1, -hz], [hx + 16.0, 12.0, hz - 2.0], MAT.BRICK, { roof: MAT.ROOF });
    m.gable([hx - 0.4, 12.0, -hz - 0.4], [hx + 16.4, 12.0, hz - 1.6], 4.0, 'x', MAT.ROOF_TILE, MAT.BRICK);
    for (const [sign, pln] of [[1, hz - 2.0], [-1, -hz]] as const) {
      m.windowRow({
        axis: 'z', sign, plane: pln, from: hx + 2, to: hx + 14,
        y0: 2.4, y1: 9.4, count: 3, width: 2.4, glass: MAT.PANE, frame: 0.18, proud: 0.1,
      });
    }
    m.painted(TINT.NONE, () => {
      m.cylinder(hx + 22.0, -4.0, 3.4, 0.1, 3.0, 14, MAT.BRICK, false);
      m.cone(hx + 22.0, -4.0, 3.4, 1.9, 3.0, 42.0, 14, MAT.BRICK);
      m.cylinder(hx + 22.0, -4.0, 2.2, 42.0, 44.4, 14, MAT.STONE, false);
    });
    // The weaving shed: one storey of saw-tooth beside the mill.
    m.box([-hx, 0.1, -hz - 30.0], [hx - 6, 6.4, -hz - 1.0], MAT.BRICK);
    sawtooth(m, -hx + 0.4, -hz - 29.6, hx - 6.4, -hz - 1.4, 6.4, 6, 3.2, MAT.ROOF);
    docks(m, -hx + 6, hx - 14, -hz - 30.0, -1, 4, 4.0);
    // The mill lodge: a rectangular reservoir, which every one of these had.
    m.painted(TINT.NONE, () => m.box([-hx - 14.0, 0.1, -16], [-hx - 1.0, 0.7, 16], MAT.STONE));
    m.box([-hx - 13.2, 0.7, -15.2], [-hx - 1.8, 0.95, 15.2], MAT.WATER);
    marquee(m, -5, 5, hz + 7.3, 1, top + 1.0, 2.2);
    for (const sx of [-46, 46]) tree(m, sx, 26, 9.0, 3.2);
    perimeter(m, -54, -44, 54, 32, 0);
    for (let i = 0; i < 5; i++) figure(m, 7013 + i * 13, -8 + i * 4, hz + 10.0, Math.PI, { stride: 0.2 });
  }
  return m;
}

/**
 * A brewery: a copper vessel house behind a glazed gable, and the malt tower.
 *
 * The one industrial building anywhere that is designed to be looked into --
 * the brewhouse gable is glazed on purpose, so the coppers show. That, the
 * malt tower, the fermenting tanks in the yard and the cask stacks are the
 * whole type, and none of it is a shed.
 */
function brewery(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 22.0, hz = 16.0, top = 22.0;

  apron(m, -54, -40, 54, 40, 0);
  // The brewhouse: a tall gabled block, glazed on the long face.
  m.box([-hx, 0.1, -hz], [hx, 2.0, hz], MAT.STONE);
  m.box([-hx, 2.0, -hz], [hx, top, hz], MAT.BRICK);
  if (medium) {
    m.gable([-hx - 0.7, top, -hz - 0.7], [hx + 0.7, top, hz + 0.7], 8.0, 'x', MAT.ROOF_TILE, MAT.BRICK);
    band(m, -hx, -hz, hx, hz, top - 0.9, 0.9, 0.6, MAT.STONE);
    // The glazed bay: four storeys of window with the coppers behind it.
    m.box([-hx + 3, 3.0, hz - 0.2], [hx - 3, top - 1.4, hz + 0.3], MAT.GLASS);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 8; i++) {
        const x = -hx + 3 + (i / 8) * (hx - 3) * 2;
        m.box([x - 0.14, 3.0, hz - 0.3], [x + 0.14, top - 1.4, hz + 0.42], MAT.TRIM);
      }
      for (let f = 1; f < 5; f++) {
        m.box([-hx + 3, 3.0 + f * 3.8, hz - 0.3], [hx - 3, 3.3 + f * 3.8, hz + 0.42], MAT.TRIM);
      }
    });
    // The coppers themselves, seen through it.
    m.painted(TINT.ACCENT, () => {
      for (const cx of [-11, 0, 11]) {
        m.cylinder(cx, hz - 5.0, 3.2, 6.0, 13.0, 12, MAT.METAL, false);
        m.cone(cx, hz - 5.0, 3.2, 0.7, 13.0, 17.0, 12, MAT.METAL);
        m.cone(cx, hz - 5.0, 3.2, 1.6, 6.0, 3.4, 12, MAT.METAL);
      }
    });
  }
  if (fine) {
    // The malt tower: taller, narrow, with a hoist gable and a cowl.
    m.box([hx, 0.1, -hz + 3], [hx + 13.0, 34.0, hz - 3], MAT.BRICK, { roof: MAT.ROOF });
    m.gable([hx - 0.5, 34.0, -hz + 2.5], [hx + 13.5, 34.0, hz - 2.5], 5.0, 'z', MAT.ROOF_TILE, MAT.BRICK);
    band(m, hx, -hz + 3, hx + 13.0, hz - 3, 33.2, 0.8, 0.5, MAT.STONE);
    for (let f = 0; f < 8; f++) {
      m.windowRow({
        axis: 'x', sign: 1, plane: hx + 13.0, from: -hz + 5, to: hz - 5,
        y0: 2.4 + f * 4.0, y1: 5.0 + f * 4.0, count: 2, width: 1.3,
        glass: MAT.PANE, frame: 0.14, proud: 0.08,
      });
    }
    m.painted(TINT.WOOD, () => m.box([hx + 4.0, 30.0, hz - 3.4], [hx + 9.0, 34.6, hz - 2.6], MAT.TIMBER));
    m.painted(TINT.METAL_DARK, () => {
      m.cylinder(hx + 6.5, 0, 1.4, 39.0, 41.6, 8, MAT.METAL, false);
      m.cone(hx + 6.5, 0, 1.7, 0.4, 41.6, 43.6, 8, MAT.METAL);
    });
    // The fermenting tanks in the yard, and the cask stacks.
    for (let i = 0; i < 6; i++) {
      silo(m, -hx - 9.0, -15 + i * 6.0, 2.4, 0.4, 11.0, { cone: 2.0, ribs: 2, mat: MAT.METAL });
    }
    pipeRack(m, -hx - 9.0, -hx + 1.0, -19.0, 6.4, 3, 3);
    m.painted(TINT.WOOD, () => {
      for (let r = 0; r < 3; r++) {
        for (let i = 0; i < 8; i++) {
          m.cylinder(-24 + i * 3.0, -28.0 + r * 3.2, 1.1, 0.12, 1.5, 10, MAT.TIMBER, true);
          m.cylinder(-24 + i * 3.0, -28.0 + r * 3.2, 1.1, 1.6, 3.0, 10, MAT.TIMBER, true);
        }
      }
    });
    marquee(m, -12, 12, hz + 0.6, 1, 8.6, 2.8);
    flags(m, -16, 16, hz + 6.0, 0.2, 3, 8.0);
    perimeter(m, -52, -38, 52, 38, 0);
    for (let i = 0; i < 5; i++) figure(m, 8123 + i * 11, -8 + i * 4, hz + 4.0, Math.PI, { stride: 0.2 });
  }
  return m;
}

// ==================================================== american: the steelworks

/**
 * A steelworks: a blast furnace, its stoves, the casting shed and a gas holder.
 *
 * Nothing else in any library looks like this. The furnace is a riveted cone
 * on four legs with a charging bridge running up to the top of it; the three
 * stoves beside it are plain drums twice a house tall; the gas holder is a
 * guided drum in a lattice cage. It is the one asset here whose scale is not
 * negotiable -- half size and it reads as a brewery.
 */
function steelWorks(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;

  apron(m, -70, -50, 70, 50, 0);
  // The casting shed: a long, tall, open-sided steel-framed hall.
  m.box([-64, 0.1, 12], [4, 26.0, 46], MAT.METAL, { roof: MAT.ROOF });
  if (medium) {
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 16; i++) {
        const x = -64 + (i / 16) * 68;
        m.box([x - 0.3, 0.1, 11.6], [x + 0.3, 27.0, 12.4], MAT.TRIM);
        m.box([x - 0.3, 0.1, 45.6], [x + 0.3, 27.0, 46.4], MAT.TRIM);
      }
    });
    m.box([-63, 17.0, 11.4], [3, 24.0, 12.0], MAT.GLASS);
    m.gable([-64.8, 26.0, 11.2], [4.8, 26.0, 46.8], 7.0, 'x', MAT.METAL, MAT.METAL);
    // A louvred monitor along the ridge, which is how a hot shed vents.
    m.box([-62, 32.6, 24], [2, 36.0, 34], MAT.METAL, { roof: MAT.ROOF });
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 22; i++) m.box([-61 + i * 2.9, 33.2, 23.6], [-59.6 + i * 2.9, 35.4, 24.2], MAT.TRIM);
    });
  }

  // The furnace: a stack on four legs with a bustle pipe round it.
  const fx = 26.0, fz = 4.0;
  m.painted(TINT.METAL_DARK, () => {
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      m.box([fx + sx * 7.0 - 0.9, 0.1, fz + sz * 7.0 - 0.9], [fx + sx * 7.0 + 0.9, 14.0, fz + sz * 7.0 + 0.9], MAT.TRIM);
    }
  });
  m.painted(TINT.NONE, () => {
    m.cone(fx, fz, 5.0, 8.6, 12.0, 26.0, 14, MAT.METAL);
    m.cylinder(fx, fz, 8.6, 26.0, 34.0, 14, MAT.METAL, false);
    m.cone(fx, fz, 8.6, 4.6, 34.0, 44.0, 14, MAT.METAL);
    m.cylinder(fx, fz, 4.6, 44.0, 52.0, 14, MAT.METAL, false);
  });
  if (medium) {
    m.painted(TINT.ACCENT, () => m.cylinder(fx, fz, 9.4, 22.0, 24.4, 14, MAT.METAL, false));
    // The downcomer and the four uptakes.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        m.pipe([fx + Math.cos(a) * 4.0, 52.0, fz + Math.sin(a) * 4.0],
               [fx + Math.cos(a) * 8.0, 58.0, fz + Math.sin(a) * 8.0], 0.85, MAT.METAL, 6);
      }
      m.pipe([fx + 8.0, 58.0, fz], [fx + 22.0, 30.0, fz], 1.6, MAT.METAL, 8);
      m.cylinder(fx, fz, 4.6, 52.0, 58.0, 14, MAT.METAL, false);
    });
    // Three stoves in a row.
    for (let i = 0; i < 3; i++) {
      const sx = fx - 22.0, sz = fz - 18.0 + i * 12.0;
      m.painted(TINT.NONE, () => {
        m.cylinder(sx, sz, 5.0, 0.1, 36.0, 14, MAT.METAL, false);
        m.cone(sx, sz, 5.0, 0.0, 36.0, 41.0, 14, MAT.METAL);
      });
      m.painted(TINT.METAL_DARK, () => {
        for (let k = 1; k < 5; k++) m.cylinder(sx, sz, 5.15, k * 7.0, k * 7.0 + 0.3, 14, MAT.TRIM, false);
        m.pipe([sx + 5.0, 8.0, sz], [fx - 9.4, 8.0, fz], 0.7, MAT.METAL, 6);
      });
    }
  }
  if (fine) {
    // The charging bridge: an inclined skip hoist up to the furnace top.
    conveyor(m, [fx + 26.0, 2.0, fz + 22.0], [fx + 2.0, 50.0, fz + 7.0], 3.0);
    lattice(m, fx + 26.0, fz + 22.0, 3.2, 2.0, 0.1, 20.0, 5);
    // The gas holder: a drum in a lattice cage.
    const gx = -34.0, gz = -30.0;
    m.painted(TINT.NONE, () => m.cylinder(gx, gz, 15.0, 0.1, 22.0, 18, MAT.METAL, true));
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        m.cylinder(gx + Math.cos(a) * 16.4, gz + Math.sin(a) * 16.4, 0.42, 0.1, 30.0, 5, MAT.TRIM, false);
      }
      for (const y of [10.0, 20.0, 29.0]) {
        for (let i = 0; i < 12; i++) {
          const a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2;
          m.pipe([gx + Math.cos(a0) * 16.4, y, gz + Math.sin(a0) * 16.4],
                 [gx + Math.cos(a1) * 16.4, y, gz + Math.sin(a1) * 16.4], 0.22, MAT.TRIM, 4);
        }
      }
    });
    // Slag pots and a ladle car on rails between the furnace and the shed.
    m.painted(TINT.METAL_DARK, () => {
      for (const pz of [-2.0, 2.0]) m.box([-20, 0.12, pz - 0.08], [58, 0.28, pz + 0.08], MAT.TRIM);
      for (let i = 0; i < 3; i++) {
        const x = 44 + i * 9;
        m.box([x - 3.4, 0.3, -3.2], [x + 3.4, 1.6, 3.2], MAT.TRIM);
        m.cone(x, 0, 3.0, 2.2, 1.6, 6.4, 10, MAT.METAL);
      }
    });
    pipeRack(m, -64, 60, -44.0, 8.0, 5, 8);
    perimeter(m, -68, -48, 68, 48, 20);
    for (let i = 0; i < 4; i++) figure(m, 9109 + i * 17, -14 + i * 6, 8.0, 1.4, { stride: 0.2 });
  }
  return m;
}

/**
 * A refinery: a column row, a flare, a tank farm and the racks between them.
 *
 * Almost no building at all -- four small ones, and everything that matters is
 * plant standing in the open. The reason it is worth a signature slot is the
 * skyline: nothing else produces a row of fifty-metre columns with a flare
 * burning off one end of it.
 */
function refinery(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;

  apron(m, -74, -52, 74, 52, 0);
  // The column row: five fractionating columns on a common structure.
  const cols: Array<[number, number, number]> = [
    [-30, 6.2, 52.0], [-14, 4.6, 40.0], [0, 5.4, 46.0], [14, 3.8, 32.0], [28, 4.4, 38.0],
  ];
  for (const [cx, r, h] of cols) {
    m.painted(TINT.NONE, () => {
      m.cylinder(cx, 0, r, 1.4, h, 14, MAT.METAL, false);
      m.cone(cx, 0, r, 0, h, h + r * 1.1, 14, MAT.METAL);
      m.cylinder(cx, 0, r * 1.25, 0.1, 1.4, 14, MAT.CONCRETE, false);
    });
    if (medium) {
      m.painted(TINT.METAL_DARK, () => {
        // Platforms and the spiral stair that serves them.
        for (let k = 1; k * 8.0 < h; k++) {
          const y = k * 8.0;
          m.cylinder(cx, 0, r + 1.5, y, y + 0.2, 14, MAT.TRIM, false);
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2;
            m.cylinder(cx + Math.cos(a) * (r + 1.4), Math.sin(a) * (r + 1.4), 0.06, y, y + 1.1, 4, MAT.TRIM, false);
          }
        }
        for (let k = 1; k < 6; k++) m.cylinder(cx, 0, r + 0.1, k * 6.0, k * 6.0 + 0.3, 14, MAT.TRIM, false);
      });
    }
  }
  if (medium) {
    pipeRack(m, -46, 46, -16.0, 9.0, 6, 10);
    pipeRack(m, -46, 46, 18.0, 7.0, 5, 10);
    // The furnace box and its stack.
    m.box([44, 0.1, -8], [60, 14.0, 8], MAT.METAL, { roof: MAT.ROOF });
    m.painted(TINT.NONE, () => m.cylinder(64.0, 0, 2.6, 0.1, 46.0, 12, MAT.METAL, false));
    m.painted(TINT.ACCENT, () => m.cylinder(64.0, 0, 2.7, 40.0, 42.4, 12, MAT.TRIM, false));
  }
  if (fine) {
    // The tank farm: six floating-roof tanks in a bund.
    m.painted(TINT.NONE, () => {
      m.box([-70, 0.1, -50], [-4, 3.0, -22], MAT.CONCRETE);
      m.box([-68, 0.3, -48], [-6, 3.2, -24], MAT.GROUND);
    });
    for (let i = 0; i < 3; i++) {
      for (let r = 0; r < 2; r++) {
        silo(m, -58 + i * 22, -42 + r * 14, 9.0, 0.3, 14.0, { ribs: 3, mat: MAT.METAL });
      }
    }
    // The flare: a lattice derrick with a lit tip.
    lattice(m, 62.0, 40.0, 3.6, 1.2, 0.1, 56.0, 8);
    m.painted(TINT.NONE, () => m.cylinder(62.0, 40.0, 0.9, 0.1, 60.0, 8, MAT.METAL, false));
    m.painted(TINT.SIGN_LIT, () => m.cone(62.0, 40.0, 1.4, 0.3, 60.0, 64.0, 8, MAT.LAMP));
    // The cooling tower, the control room and the flare knock-out drum.
    m.painted(TINT.NONE, () => {
      m.cone(-56.0, 34.0, 11.0, 7.4, 0.1, 22.0, 16, MAT.CONCRETE);
      m.cylinder(-56.0, 34.0, 7.4, 22.0, 26.0, 16, MAT.CONCRETE, false);
    });
    m.box([-20, 0.1, 34], [6, 8.0, 48], MAT.CONCRETE, { roof: MAT.ROOF });
    m.box([-19, 2.0, 33.6], [5, 5.6, 34.2], MAT.GLASS);
    m.painted(TINT.NONE, () => {
      m.cylinder(34.0, 40.0, 3.2, 3.0, 3.2, 12, MAT.METAL, true);
      m.pipe([28.0, 4.6, 40.0], [40.0, 4.6, 40.0], 3.2, MAT.METAL, 12);
    });
    marquee(m, -14, 6, 48.4, 1, 8.2, 2.4);
    perimeter(m, -72, -50, 72, 50, -8);
    for (let i = 0; i < 4; i++) figure(m, 4409 + i * 13, -14 + i * 6, 32.0, Math.PI, { stride: 0.2 });
  }
  return m;
}

// ================================================== asian: assembly and yard

/**
 * An electronics assembly plant with its dormitory block.
 *
 * The regional difference is not the factory, it is that the workforce lives
 * on the site: a long clean assembly hall, a canteen, and a nine-storey
 * dormitory with balconies and drying rails on every floor, joined by a
 * covered walk. Drawing the factory without the dormitory would be drawing
 * half of it.
 */
function assemblyPlant(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 46.0, hz = 20.0, wall = 12.0;

  apron(m, -62, -50, 62, 46, 0);
  m.box([-hx, 0.1, -hz], [hx, wall, hz], MAT.PLASTER, { roof: MAT.ROOF });
  if (medium) {
    m.painted(TINT.BRAND, () => band(m, -hx, -hz, hx, hz, wall - 2.6, 1.8, 0.45, MAT.CLADDING));
    m.box([-hx + 2, 2.4, hz], [hx - 2, 8.4, hz + 0.3], MAT.GLASS);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 24; i++) {
        const x = -hx + 2 + (i / 24) * (hx - 2) * 2;
        m.box([x - 0.14, 2.4, hz - 0.1], [x + 0.14, 8.4, hz + 0.42], MAT.TRIM);
      }
    });
    sawtooth(m, -hx + 0.4, -hz + 0.4, hx - 0.4, hz - 0.4, wall, 5, 3.6, MAT.METAL);
    docks(m, -hx + 8, hx - 8, -hz, -1, 8, 4.4);
  }
  // The dormitory: nine storeys, balconies and drying rails on the long face.
  const dx = 26.0, dz = 11.0, fh = 3.2, dfl = 9;
  const dcx = 0, dcz = -hz - 22.0;
  m.box([dcx - dx, 0.1, dcz - dz], [dcx + dx, 1.0, dcz + dz], MAT.TILE);
  m.box([dcx - dx, 1.0, dcz - dz], [dcx + dx, 1.0 + dfl * fh, dcz + dz], MAT.PLASTER, { roof: MAT.ROOF });
  if (medium) {
    band(m, dcx - dx, dcz - dz, dcx + dx, dcz + dz, 1.0 + dfl * fh - 0.6, 0.6, 0.4, MAT.TRIM);
    parapet(m, dcx - dx, dcz - dz, dcx + dx, dcz + dz, 1.0 + dfl * fh, 1.1, 0.28, MAT.TILE);
    for (let f = 0; f < dfl; f++) {
      const y = 1.0 + f * fh;
      for (const [sign, pln] of [[1, dcz + dz], [-1, dcz - dz]] as const) {
        m.windowRow({
          axis: 'z', sign, plane: pln, from: dcx - dx + 2, to: dcx + dx - 2,
          y0: y + 0.7, y1: y + fh - 0.7, count: 10, width: 1.8,
          glass: MAT.PANE, frame: 0.1, proud: 0.06,
        });
      }
    }
  }
  if (fine) {
    m.painted(TINT.METAL_DARK, () => {
      for (let f = 0; f < dfl; f++) {
        const y = 1.0 + f * fh;
        m.box([dcx - dx, y - 0.16, dcz + dz], [dcx + dx, y, dcz + dz + 1.3], MAT.TRIM, { skipBottom: false });
        for (let k = 0; k < 3; k++) {
          m.box([dcx - dx + 1, y + 0.5 + k * 0.2, dcz + dz + 1.0], [dcx + dx - 1, y + 0.54 + k * 0.2, dcz + dz + 1.04], MAT.TRIM);
        }
      }
      railing(m, dcx - dx, dcx + dx, dcz + dz + 1.25, 1.0 + (dfl - 1) * fh, 1.0, 2.0);
    });
    // The covered walk between plant and dormitory, and the canteen.
    m.painted(TINT.METAL_DARK, () => {
      m.box([-3.0, 4.0, dcz + dz], [3.0, 4.5, -hz], MAT.TRIM, { skipBottom: false });
      for (let i = 0; i <= 6; i++) {
        const z = dcz + dz + (i / 6) * (-hz - dcz - dz);
        m.cylinder(-2.6, z, 0.14, 0.2, 4.0, 5, MAT.TRIM, false);
        m.cylinder(2.6, z, 0.14, 0.2, 4.0, 5, MAT.TRIM, false);
      }
    });
    m.box([-hx - 14.0, 0.1, -30], [-hx - 1.0, 7.0, -8], MAT.PLASTER, { roof: MAT.ROOF });
    m.cone(-hx - 7.5, -19.0, 1.0, 0.9, 7.0, 10.4, 4, MAT.ROOF_TILE);
    m.box([-hx - 13.4, 1.6, -8.4], [-hx - 1.6, 5.4, -7.9], MAT.GLASS);
    // The bus bay and the flag line at the gate.
    m.painted(TINT.NONE, () => {
      for (let i = 0; i < 4; i++) m.box([-40 + i * 16, 0.09, 30.0], [-28 + i * 16, 0.11, 42.0], MAT.PLATE);
    });
    marquee(m, -16, 16, hz + 0.5, 1, 8.8, 2.8);
    flags(m, -30, 30, hz + 8.0, 0.2, 7, 9.0);
    perimeter(m, -60, -48, 60, 44, 0);
    for (let i = 0; i < 8; i++) figure(m, 3307 + i * 11, -24 + i * 6.4, hz + 5.0, Math.PI, { stride: 0.22 });
    for (const sx of [-52, 52]) tree(m, sx, 34, 8.0, 2.8);
  }
  return m;
}

/**
 * A shipyard: a dry dock with a hull in it under a portal gantry.
 *
 * The gantry is the landmark -- a hundred metres of box girder on two legs,
 * visible from anywhere in the city -- and what makes it read is that there is
 * something under it. So the dock is drawn as a real excavation with steps
 * down its sides, and the hull sits on keel blocks in the bottom of it with
 * its plating in panels and its bulbous bow modelled.
 */
function shipyard(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const dx = 52.0, dz = 15.0;
  // Quay level. The dock is cut into a plinth rather than into the ground:
  // the terrain is a heightfield the asset does not get to modify, so the
  // land around a dry dock has to be built up rather than dug out. Everything
  // in the yard sits at `q`; the dock floor is the only thing that does not.
  const q = 13.0;

  m.box([-70, 0.0005, -46], [70, q, 46], MAT.CONCRETE, { roof: MAT.GROUND });
  apron(m, -68, -44, 68, 44, 0, q);

  // The dock: four steps down from the coping to the floor.
  m.painted(TINT.NONE, () => {
    for (let k = 0; k < 4; k++) {
      const i = k * 2.0, y = q - k * (q / 4);
      m.box([-dx - i - 2, y - q / 4, -dz - i - 2], [dx + i + 2, y, dz + i + 2], MAT.CONCRETE);
    }
    m.box([-dx, 0.4, -dz], [dx, 0.8, dz], MAT.CONCRETE);
  });
  m.box([-dx - 8, 0.8, -dz - 8], [dx + 8, 0.9, dz + 8], MAT.WATER);
  if (medium) {
    // Keel blocks, and the hull standing on them.
    m.painted(TINT.NONE, () => {
      for (let i = 0; i < 14; i++) m.box([-40 + i * 6, 0.8, -2.2], [-37 + i * 6, 2.8, 2.2], MAT.CONCRETE);
    });
    const hull = plan(38.0, 9.0, 0.55, 20);
    const deck = plan(40.0, 10.0, 0.62, 20);
    loft(m, scaled(hull, 0.55, 0.35), hull, 2.8, 8.4, MAT.METAL);
    loft(m, hull, deck, 8.4, 20.4, MAT.METAL);
    m.painted(TINT.BRAND, () => loft(m, scaled(hull, 1.002), scaled(hull, 1.002), 2.8, 7.4, MAT.METAL));
    m.painted(TINT.ACCENT, () => loft(m, scaled(hull, 1.004), scaled(hull, 1.004), 7.4, 8.4, MAT.METAL));
    m.painted(TINT.NONE, () => {
      for (let i = 0; i < 20; i++) {
        const a = deck[i], b = deck[(i + 1) % 20];
        m.tri([0, 20.4, 0], [b[0], 20.4, b[1]], [a[0], 20.4, a[1]], MAT.METAL);
      }
      m.cone(-39.0, 0, 3.4, 1.0, 2.8, 8.4, 10, MAT.METAL);
      m.box([26.0, 20.4, -7.0], [40.0, 34.4, 7.0], MAT.CLADDING, { roof: MAT.ROOF });
    });
  }
  if (fine) {
    m.painted(TINT.METAL_DARK, () => {
      for (let f = 0; f < 4; f++) {
        m.box([26.2, 22.4 + f * 3.2, -7.2], [39.8, 24.8 + f * 3.2, -6.8], MAT.GLASS);
      }
      m.cylinder(33.0, 0, 0.5, 34.4, 44.4, 6, MAT.TRIM, false);
    });
    // The gantry: two portal frames, a box girder, a trolley and its load.
    m.painted(TINT.BRAND, () => {
      m.box([-62.0, q + 44.0, -6.0], [62.0, q + 52.0, 6.0], MAT.METAL, { roof: MAT.ROOF });
    });
    for (const s of [-1, 1]) {
      lattice(m, s * 58.0, -22.0, 4.0, 3.0, q, q + 44.0, 8);
      lattice(m, s * 58.0, 22.0, 4.0, 3.0, q, q + 44.0, 8);
      m.painted(TINT.METAL_DARK, () => {
        m.pipe([s * 58.0, q + 44.0, -22.0], [s * 58.0, q + 44.0, 22.0], 1.2, MAT.METAL, 6);
        for (const pz of [-22.0, 22.0]) {
          m.box([s * 58.0 - 5.0, q, pz - 1.4], [s * 58.0 + 5.0, q + 1.5, pz + 1.4], MAT.TRIM);
          for (const sx of [-3.4, 0, 3.4]) m.cylinder(s * 58.0 + sx, pz, 0.7, q, q + 1.5, 8, MAT.TRIM, true);
        }
      });
    }
    m.painted(TINT.METAL_DARK, () => {
      m.box([-10.0, q + 38.0, -5.0], [6.0, q + 44.0, 5.0], MAT.TRIM, { roof: MAT.ROOF });
      for (const sx of [-8.0, 4.0]) m.pipe([sx, q + 38.0, 0], [sx, 26.0, 0], 0.09, MAT.TRIM, 4);
      m.box([-9.0, 23.0, -3.6], [5.0, 26.0, 3.6], MAT.METAL);
    });
    // The plate shop and the panel stacks beside the dock.
    m.box([-64, q, 26], [-16, q + 18.0, 44], MAT.METAL, { roof: MAT.ROOF });
    m.gable([-64.6, q + 18.0, 25.4], [-15.4, q + 18.0, 44.6], 4.4, 'x', MAT.METAL, MAT.METAL);
    docks(m, -60, -24, 26.0, -1, 4, 6.0, q);
    m.painted(TINT.NONE, () => {
      for (let i = 0; i < 5; i++) {
        for (let k = 0; k < 3; k++) {
          m.box([8 + i * 11, q + k * 0.9, 28 + k * 0.6], [18 + i * 11, q + 0.8 + k * 0.9, 42 - k * 0.6], MAT.METAL);
        }
      }
    });
    // Bollards and a fender line along the coping, which is what says quay.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 12; i++) {
        const x = -60 + i * 10;
        m.cylinder(x, dz + 10.0, 0.5, q, q + 1.1, 8, MAT.TRIM, true);
      }
    });
    perimeter(m, -68, -44, 68, 44, -40, q);
    for (let i = 0; i < 5; i++) figure(m, 6421 + i * 13, -20 + i * 8, 24.0, Math.PI, { stride: 0.2, lift: q });
  }
  return m;
}

// ================================================= farming: mill and creamery

/**
 * A feed mill: a silo battery, the mill tower over it, and a dryer.
 *
 * The tallest thing for twenty miles in any farming region, and it is a
 * machine rather than a building -- eight concrete cells with the mill house
 * sitting on top of them, a bucket elevator up the side, a dryer beside it and
 * a weighbridge at the gate. Nothing about it is decorated and that is the
 * look.
 */
function feedMill(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;

  apron(m, -56, -44, 56, 44, 0);
  // The silo battery: two rows of four, joined, with the mill house over them.
  const r = 5.2;
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < 2; k++) {
      const cx = -15.6 + i * 10.4, cz = -5.2 + k * 10.4;
      m.painted(TINT.NONE, () => m.cylinder(cx, cz, r, 0.1, 30.0, 14, MAT.CONCRETE, false));
    }
  }
  m.box([-21.0, 30.0, -10.6], [21.0, 44.0, 10.6], MAT.CONCRETE, { roof: MAT.ROOF });
  if (medium) {
    m.painted(TINT.NONE, () => m.box([-21.0, 28.6, -10.6], [21.0, 30.4, 10.6], MAT.CONCRETE));
    m.painted(TINT.METAL_DARK, () => {
      m.box([-21.6, 43.4, -11.2], [21.6, 45.4, 11.2], MAT.METAL, { roof: MAT.ROOF });
      for (let i = 0; i < 6; i++) {
        m.box([-18 + i * 7, 32.0, 10.6], [-13 + i * 7, 40.0, 10.9], MAT.GLASS);
      }
      // The bucket elevator, up the outside to the mill house.
      m.box([22.0, 0.1, -2.2], [26.0, 50.0, 2.2], MAT.METAL, { roof: MAT.ROOF });
      m.box([21.2, 44.0, -3.0], [26.8, 50.6, 3.0], MAT.METAL, { roof: MAT.ROOF });
      for (let k = 0; k < 8; k++) m.box([21.6, 4.0 + k * 6.0, -2.6], [26.4, 4.4 + k * 6.0, 2.6], MAT.TRIM);
    });
    conveyor(m, [24.0, 48.0, 0], [-24.0, 40.0, 0], 1.8);
  }
  if (fine) {
    // The dryer: a tall louvred tower with a fan house at its foot.
    m.painted(TINT.METAL_DARK, () => {
      m.box([-40.0, 0.1, -8.0], [-30.0, 32.0, 2.0], MAT.METAL, { roof: MAT.ROOF });
      for (let k = 0; k < 12; k++) {
        m.box([-40.4, 4.0 + k * 2.2, -8.4], [-29.6, 5.4 + k * 2.2, -7.6], MAT.TRIM);
        m.box([-40.4, 4.0 + k * 2.2, 1.6], [-29.6, 5.4 + k * 2.2, 2.4], MAT.TRIM);
      }
      m.box([-44.0, 0.1, -6.0], [-40.0, 8.0, 0.0], MAT.METAL, { roof: MAT.ROOF });
      m.cylinder(-42.0, -3.0, 1.8, 0.1, 3.6, 10, MAT.METAL, true);
    });
    // The intake pit and the weighbridge at the gate.
    m.painted(TINT.NONE, () => {
      m.box([-14, 0.09, 24.0], [14, 0.14, 34.0], MAT.CONCRETE);
      m.box([-6, 0.14, 26.0], [6, 0.3, 32.0], MAT.METAL);
    });
    m.box([16.0, 0.1, 24.0], [24.0, 4.4, 32.0], MAT.RENDER, { roof: MAT.ROOF });
    m.box([15.6, 1.4, 24.4], [16.2, 3.2, 31.6], MAT.GLASS);
    // A lean-to store and a stack of pallets.
    m.box([-48.0, 0.1, 12.0], [-16.0, 7.0, 30.0], MAT.METAL);
    m.gable([-48.6, 7.0, 11.4], [-15.4, 7.0, 30.6], 4.0, 'x', MAT.METAL, MAT.METAL);
    m.painted(TINT.WOOD, () => {
      for (let i = 0; i < 4; i++) {
        for (let k = 0; k < 3; k++) m.box([-44 + i * 7, 0.12 + k * 1.3, 16 + k * 0.3], [-39 + i * 7, 1.3 + k * 1.3, 24 - k * 0.3], MAT.TIMBER);
      }
    });
    marquee(m, -10, 10, 34.4, 1, 6.0, 2.2);
    perimeter(m, -54, -42, 54, 42, 0);
    for (const sx of [-48, 48]) tree(m, sx, 38, 9.0, 3.2);
    for (let i = 0; i < 4; i++) figure(m, 2903 + i * 13, -8 + i * 5, 36.0, Math.PI, { stride: 0.2 });
  }
  return m;
}

/**
 * A creamery: milk silos, the process hall, and the cattle sheds behind it.
 *
 * The one industrial asset with livestock in it, which is exactly why it
 * belongs to this theme and to no other. The tanker bay at the front, the six
 * insulated silos, the process hall with its stack of ventilators, and two
 * open-sided cattle sheds with a slurry store behind them.
 */
function creamery(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 32.0, hz = 18.0, wall = 12.0;

  apron(m, -56, -50, 56, 40, 0);
  m.box([-hx, 0.1, -hz], [hx, wall, hz], MAT.PLASTER, { roof: MAT.ROOF });
  if (medium) {
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 16; i++) {
        const x = -hx + (i / 16) * hx * 2;
        m.box([x - 0.14, 0.1, -hz - 0.2], [x + 0.14, wall, -hz], MAT.TRIM);
        m.box([x - 0.14, 0.1, hz], [x + 0.14, wall, hz + 0.2], MAT.TRIM);
      }
    });
    m.painted(TINT.BRAND, () => band(m, -hx, -hz, hx, hz, wall - 2.4, 1.6, 0.4, MAT.CLADDING));
    m.box([-hx + 3, 2.2, hz], [hx - 3, 6.4, hz + 0.3], MAT.GLASS);
    m.gable([-hx - 0.7, wall, -hz - 0.7], [hx + 0.7, wall, hz + 0.7], 5.0, 'x', MAT.METAL, MAT.PLASTER);
    // Ventilators along the ridge.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 7; i++) {
        m.cylinder(-24 + i * 8, 0, 1.1, wall + 5.0, wall + 7.4, 8, MAT.METAL, false);
        m.cone(-24 + i * 8, 0, 1.4, 0.3, wall + 7.4, wall + 8.6, 8, MAT.METAL);
      }
    });
  }
  if (fine) {
    // The milk silos: six insulated stainless drums in a row, and their pipes.
    for (let i = 0; i < 6; i++) {
      silo(m, -hx - 10.0, -14 + i * 6.4, 2.7, 0.4, 15.0, { cone: 2.2, ribs: 3, mat: MAT.METAL });
    }
    pipeRack(m, -hx - 10.0, -hx + 1.0, -19.0, 5.6, 4, 3);
    // The tanker bay: a canopy with two bays marked out under it.
    m.painted(TINT.METAL_DARK, () => {
      m.box([-14.0, 6.4, hz + 2.0], [14.0, 7.0, hz + 16.0], MAT.TRIM, { skipBottom: false });
      for (const sx of [-12.0, -1.0, 12.0]) {
        for (const pz of [hz + 3.4, hz + 14.6]) m.cylinder(sx, pz, 0.28, 0.2, 6.4, 6, MAT.TRIM, false);
      }
    });
    m.painted(TINT.NONE, () => {
      for (const sx of [-7.0, 7.0]) m.box([sx - 0.09, 0.09, hz + 2.0], [sx + 0.09, 0.11, hz + 16.0], MAT.PLATE);
    });
    docks(m, -hx + 4, -6, -hz, -1, 4, 4.4);
    // Two open cattle sheds and a slurry store.
    for (let k = 0; k < 2; k++) {
      const z0 = -hz - 16.0 - k * 16.0;
      m.box([-40, 0.1, z0], [24, 0.3, z0 + 12.0], MAT.GROUND);
      m.gable([-40.6, 6.4, z0 - 0.6], [24.6, 6.4, z0 + 12.6], 4.0, 'x', MAT.METAL, MAT.METAL);
      m.painted(TINT.METAL_DARK, () => {
        for (let i = 0; i <= 8; i++) {
          const x = -40 + (i / 8) * 64;
          m.box([x - 0.18, 0.1, z0 + 0.4], [x + 0.18, 6.4, z0 + 0.9], MAT.TRIM);
          m.box([x - 0.18, 0.1, z0 + 11.1], [x + 0.18, 6.4, z0 + 11.6], MAT.TRIM);
        }
      });
      m.painted(TINT.NONE, () => m.box([-40, 0.3, z0 + 0.4], [24, 1.4, z0 + 1.6], MAT.CONCRETE));
    }
    m.painted(TINT.NONE, () => {
      m.cylinder(38.0, -34.0, 9.0, 0.1, 4.6, 14, MAT.CONCRETE, false);
      m.cylinder(38.0, -34.0, 8.6, 4.2, 4.4, 14, MAT.GROUND, true);
    });
    marquee(m, -12, 12, hz + 0.5, 1, 7.2, 2.4);
    flags(m, -20, 20, hz + 20.0, 0.2, 3, 8.0);
    hedge(m, -54, 36.0, 54, 37.2, 1.0);
    for (const sx of [-48, 48]) tree(m, sx, 30, 9.5, 3.4);
    perimeter(m, -54, -48, 54, 38, 0);
    for (let i = 0; i < 4; i++) figure(m, 5501 + i * 11, -8 + i * 5, hz + 18.0, Math.PI, { stride: 0.2 });
  }
  return m;
}

// ====================================================================== table

const plant = (jobs: number, upkeep: number, power: number, pollution: number): AssetDef['sim'] => ({
  jobs, powerKW: power, waterM3: jobs * 1.6, garbagePerWeek: jobs * 20,
  pollution, upkeep,
});

interface Row {
  key: string; name: string; foot: [number, number]; jobs: number;
  upkeep: number; power: number; pollution: number;
  colour: [number, number, number]; accent: [number, number, number];
  note: string; build: (lod: number) => MeshBuilder;
}

const WORKS: Record<Theme, Row> = {
  modern: {
    key: 'works', name: 'Northlight Fab', foot: [18, 12], jobs: 900, upkeep: 2600, power: 6800, pollution: 2,
    colour: [0.16, 0.30, 0.42], accent: [0.62, 0.68, 0.72],
    note: 'A sealed clean-room box with no windows and a nine-metre plant deck on top of it carrying eighteen air handlers, a bunded gas farm behind a blast wall and six chillers in the side yard.',
    build: semiconductorFab,
  },
  european: {
    key: 'works', name: 'Ashcroft Mill', foot: [17, 12], jobs: 520, upkeep: 1500, power: 2200, pollution: 4,
    colour: [0.42, 0.24, 0.14], accent: [0.62, 0.58, 0.44],
    note: 'A six-storey brick spinning mill in fifteen bays with a stair tower and water tank, an engine house, a forty-four metre round chimney, a six-bay saw-tooth weaving shed and the mill lodge beside it.',
    build: spinningMill,
  },
  american: {
    key: 'works', name: 'Ironbridge Steel', foot: [18, 13], jobs: 1100, upkeep: 3400, power: 9000, pollution: 9,
    colour: [0.36, 0.20, 0.14], accent: [0.74, 0.44, 0.12],
    note: 'A fifty-eight metre blast furnace on four legs with a bustle main, four uptakes and a downcomer, three stoves, an inclined charging bridge, a gas holder in a lattice cage and a monitored casting shed.',
    build: steelWorks,
  },
  asian: {
    key: 'works', name: 'Kestrel Assembly', foot: [16, 14], jobs: 1400, upkeep: 2400, power: 4200, pollution: 3,
    colour: [0.18, 0.32, 0.44], accent: [0.74, 0.56, 0.18],
    note: 'A ninety-metre assembly hall under a five-bay saw-tooth with eight loading docks, joined by a covered walk to a nine-storey dormitory with balconies and drying rails on every floor, and a canteen beside it.',
    build: assemblyPlant,
  },
  farming: {
    key: 'works', name: 'Harrowgate Mill', foot: [15, 12], jobs: 240, upkeep: 900, power: 1600, pollution: 3,
    colour: [0.40, 0.34, 0.22], accent: [0.68, 0.60, 0.32],
    note: 'Eight thirty-metre concrete cells with the mill house standing on top of them, a fifty-metre bucket elevator up the side, a louvred grain dryer, an intake pit and a weighbridge at the gate.',
    build: feedMill,
  },
  row: {
    key: 'works', name: '', foot: [1, 1], jobs: 0, upkeep: 0, power: 0, pollution: 0,
    colour: [0, 0, 0], accent: [0, 0, 0], note: '', build: feedMill,
  },
};

const YARD: Record<Theme, Row> = {
  modern: {
    key: 'yard', name: 'Vance Distribution', foot: [19, 15], jobs: 620, upkeep: 1800, power: 2600, pollution: 3,
    colour: [0.16, 0.32, 0.46], accent: [0.74, 0.58, 0.18],
    note: 'A hundred-and-twenty metre shed with eighteen dock doors, twelve trailers backed on to a marked-out yard, a two-storey glazed office corner and eighty photovoltaic arrays across the roof.',
    build: distributionCentre,
  },
  european: {
    key: 'yard', name: 'Copperline Brewery', foot: [14, 11], jobs: 300, upkeep: 1200, power: 2000, pollution: 4,
    colour: [0.42, 0.26, 0.12], accent: [0.72, 0.48, 0.16],
    note: 'A glazed brewhouse gable with three copper vessels showing through it, a thirty-four metre malt tower with a hoist gable and a cowl, six fermenting tanks on a pipe rack and twenty-four casks stacked in the yard.',
    build: brewery,
  },
  american: {
    key: 'yard', name: 'Meridian Refining', foot: [19, 14], jobs: 480, upkeep: 3000, power: 7000, pollution: 10,
    colour: [0.24, 0.26, 0.28], accent: [0.76, 0.46, 0.12],
    note: 'Five fractionating columns to fifty-two metres with platforms and stairs, two pipe racks, a furnace box and stack, six floating-roof tanks in a bund, a cooling tower and a sixty-four metre flare.',
    build: refinery,
  },
  asian: {
    key: 'yard', name: 'Nine Dragons Yard', foot: [18, 12], jobs: 800, upkeep: 2800, power: 4000, pollution: 6,
    colour: [0.18, 0.34, 0.38], accent: [0.78, 0.46, 0.12],
    note: 'A dry dock cut in four steps with a hull on keel blocks in the bottom of it -- plated, boot-topped, bulbous bow, stern superstructure -- under a hundred-and-twenty metre portal gantry on four lattice legs.',
    build: shipyard,
  },
  farming: {
    key: 'yard', name: 'Fenn Creamery', foot: [15, 13], jobs: 260, upkeep: 1000, power: 1900, pollution: 4,
    colour: [0.24, 0.34, 0.30], accent: [0.70, 0.66, 0.48],
    note: 'A process hall with seven ridge ventilators, six insulated milk silos on a pipe rack, a two-bay tanker canopy, four loading docks, two open cattle sheds with feed barriers and a slurry store.',
    build: creamery,
  },
  row: {
    key: 'yard', name: '', foot: [1, 1], jobs: 0, upkeep: 0, power: 0, pollution: 0,
    colour: [0, 0, 0], accent: [0, 0, 0], note: '', build: creamery,
  },
};

export const SIGNATURE_INDUSTRIAL: AssetDef[] = THEME_ORDER.flatMap((t) =>
  [WORKS[t], YARD[t]].map((r): AssetDef => ({
    id: `sig.ind.${t}.${r.key}`,
    name: r.name,
    zone: 'industrial',
    density: 'high',
    variant: 'sculpted',
    theme: t,
    signature: true,
    footprint: r.foot,
    height: 0,
    brand: { name: r.name, colour: r.colour, accent: r.accent, sign: 'fascia' },
    sim: plant(r.jobs, r.upkeep, r.power, r.pollution),
    note: r.note,
    build: r.build,
  })));
