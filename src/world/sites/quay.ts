/**
 * MERIDIAN QUAY — bonded cargo terminal.
 *
 * The second map exists to ask questions the villa cannot. Casa Verdugo is a
 * sunlit walled estate: long sightlines, a hard perimeter, and a defender who
 * knows where you must come from. The quay is its opposite on every axis that
 * matters tactically:
 *
 *   - **Verticality.** Catwalks, a warehouse mezzanine, container stacks and
 *     a gantry crane mean height is contested rather than assumed. Almost
 *     every position here is overlooked by another.
 *   - **Maze cover.** The container yard is a grid of hard corners with no
 *     long shot in it. You clear it a corner at a time or you get shot from
 *     one you skipped.
 *   - **Real CQB.** The office block and the cold store are small rooms with
 *     short walls and doors that open the wrong way. There is nowhere in
 *     either to fight at distance.
 *   - **Interiors that are dark in daylight.** The warehouse and cold store
 *     have roofs and few windows, so light discipline is a live question at
 *     any hour rather than only at night.
 *
 * Layout, roughly 190 x 150 m:
 *
 *          N (water)
 *     ┌─────────────────────────────────┐
 *     │  quay apron · gantry crane      │
 *     ├──────────┬──────────────────────┤
 *     │ WAREHOUSE│   container yard     │
 *     │ + mezz   │   (stacked grid)     │
 *     ├──────────┴───────┬──────────────┤
 *     │ office block     │ cold store   │
 *     └───────┬──────────┴──────────────┘
 *          main gate (S)
 *
 * Four ways in, deliberately: the main gate (loud), the rail spur gap in the
 * east fence (quiet, long), the quay apron from the water (flanking, exposed
 * crossing), and the warehouse roof hatch reached from a container stack
 * (slow, and it puts you above everything).
 */

import * as THREE from 'three';
import { Rng } from '../../core/math';
import { SiteBuilder } from '../builder';
import { Props } from '../props';
import { M } from '../palette';
import { BF, type SiteInstance, type WallOpening, type SiteBuildResult, type RoomSpec, type NavLink } from '../types';
import type { Fixture } from '../../lighting/interior-lights';

// --- datums ----------------------------------------------------------------
const PAD = 2.0;              // apron level
const DOCK = PAD + 1.1;       // loading dock lip — a real step, and cover
const MEZZ = PAD + 4.6;       // warehouse mezzanine deck
const CAT = PAD + 7.4;        // high catwalk
const ROOF = PAD + 9.2;       // warehouse roof
const OFF1 = PAD + 3.5;       // office first floor

const PERIM = { x0: -96, x1: 94, z0: -74, z1: 76 };

const W_EXT = 0.32;
const W_INT = 0.16;
const DOOR_H = 2.1;
const WIN_Y0 = 1.0;
const WIN_Y1 = 2.3;

// Buildings, in plan.
const WH = { x0: -84, x1: -14, z0: -18, z1: 44 };   // warehouse
const OFF = { x0: -84, x1: -34, z0: -62, z1: -24 }; // office block
const COLD = { x0: -26, x1: 16, z0: -62, z1: -26 }; // cold store

function doorOp(
  at: number, width: number, name: string, roomA: number, roomB: number,
  material: 'wood' | 'reinforced' | 'metal' | 'glass' | 'gate',
  o: { locked?: boolean; hinge?: -1 | 1; swing?: -1 | 1; open?: boolean; height?: number } = {},
): WallOpening {
  return {
    at, width, y0: 0, y1: o.height ?? DOOR_H, kind: 'door',
    doorSpec: {
      name, roomA, roomB, material,
      locked: o.locked, hinge: o.hinge ?? 1, swing: o.swing ?? 1, open: o.open,
      breachable: material !== 'gate',
    },
  };
}

function winOp(at: number, width: number, y0 = WIN_Y0, y1 = WIN_Y1): WallOpening {
  return { at, width, y0, y1, kind: 'window', glazed: true };
}

const vec = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export function buildQuay(b: SiteBuilder, rng: Rng): SiteBuildResult {
  const p = new Props(b);
  const rooms: RoomSpec[] = [];
  const navLinks: NavLink[] = [];
  const lights: Fixture[] = [];

  /** A hanging high-bay lamp: the fitting, the lens, and the light itself. */
  const highBay = (x: number, y: number, z: number, intensity = 26, dist = 22): void => {
    b.cyl(x, y + 0.34, z, 0.035, 0.34, M.steelDark, { surface: 'metal', flags: BF.NO_NAV });
    b.cyl(x, y - 0.10, z, 0.30, 0.12, M.steelGalv, { surface: 'metal', flags: BF.NO_NAV | BF.NO_COVER });
    b.cyl(x, y - 0.24, z, 0.24, 0.05, M.lampCold,
      { surface: 'glass', flags: BF.NO_NAV | BF.NO_COVER });
    lights.push({
      position: vec(x, y - 0.4, z),
      color: 0xdfe8ff, intensity, distance: dist, alwaysOn: true,
    });
  };

  /** A warm bulkhead fitting for offices and stairwells. */
  const bulkhead = (x: number, y: number, z: number, intensity = 12, dist = 12): void => {
    b.span(x - 0.22, y - 0.08, z - 0.10, x + 0.22, y + 0.08, z + 0.10, M.lampWarm,
      { surface: 'glass', flags: BF.NO_NAV | BF.NO_COVER });
    lights.push({ position: vec(x, y - 0.15, z), color: 0xffd9a8, intensity, distance: dist, alwaysOn: true });
  };

  const room = (
    name: string, tag: string, indoors: boolean,
    x0: number, z0: number, x1: number, z1: number, y0: number, y1: number,
    buildingId?: number,
  ): number => {
    const id = b.room({
      name, tag, indoors,
      minX: Math.min(x0, x1), maxX: Math.max(x0, x1),
      minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1),
      minY: y0, maxY: y1,
      buildingId,
    });
    rooms.push({
      name, tag, indoors, buildingId: buildingId ?? 0,
      minX: Math.min(x0, x1), maxX: Math.max(x0, x1),
      minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1),
      minY: y0, maxY: y1,
    });
    return id;
  };

  const pave = (
    x0: number, z0: number, x1: number, z1: number, y: number, mat: number,
    surface: 'concrete' | 'gravel' | 'grass' | 'tile' | 'dirt' | 'sand' | 'metal',
  ): void => {
    b.span(x0, y - 0.16, z0, x1, y, z1, mat, {
      surface, flags: BF.NO_COVER, tint: b.jitterTint(0.05),
    });
  };

  // =========================================================================
  // Ground
  // =========================================================================
  pave(PERIM.x0, PERIM.z0, PERIM.x1, PERIM.z1, PAD, M.asphalt, 'concrete');
  // The apron is a different pour — lighter, and it tells you where the water
  // edge is from a long way off.
  pave(PERIM.x0 + 4, 46, PERIM.x1 - 4, 72, PAD + 0.03, M.concreteRaw, 'concrete');
  // Rail spur running east, the quiet approach.
  pave(20, -14, PERIM.x1 - 2, -4, PAD + 0.02, M.gravelMat, 'gravel');
  for (let z = -13; z < -4; z += 0.62) {
    b.span(22, PAD + 0.03, z, PERIM.x1 - 4, PAD + 0.11, z + 0.26, M.woodWeathered,
      { surface: 'wood', flags: BF.NO_COVER });
  }
  for (const rx of [-3.2, 3.2]) {
    b.span(22, PAD + 0.10, -9 + rx - 0.06, PERIM.x1 - 4, PAD + 0.19, -9 + rx + 0.06, M.steelDark,
      { surface: 'metal', flags: BF.NO_COVER });
  }

  // =========================================================================
  // Perimeter — chain fence, not a masonry wall. You can see through it, which
  // makes the approach a decision rather than a corridor.
  // =========================================================================
  const fencePosts = (x0: number, z0: number, x1: number, z1: number): void => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(2, Math.round(len / 3.4));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      b.cyl(x0 + (x1 - x0) * t, PAD + 1.5, z0 + (z1 - z0) * t, 0.07, 1.5, M.steelGalv,
        { surface: 'metal' });
    }
    // The mesh itself: thin, see-through, and still solid to a body.
    b.wall({
      x0, z0, x1, z1, y: PAD, height: 2.9, thickness: 0.05, mat: M.steelGalv,
      surface: 'metal', flags: BF.SOFT, jitter: 0.02,
    });
  };
  fencePosts(PERIM.x0, PERIM.z0, PERIM.x1, PERIM.z0);          // south
  fencePosts(PERIM.x0, PERIM.z0, PERIM.x0, 44);                // west
  fencePosts(PERIM.x1, PERIM.z0, PERIM.x1, -16);               // east, lower
  fencePosts(PERIM.x1, -2, PERIM.x1, 44);                      // east, upper
  // The gap at z -16..-2 is the rail spur. It is not an oversight.

  // Main gate, south.
  const gateRoom = room('Main gate', 'gate', false, -14, -78, 14, -68, PAD, PAD + 4);
  b.wall({
    x0: -14, z0: PERIM.z0, x1: 14, z1: PERIM.z0, y: PAD, height: 4.2, thickness: 0.28,
    mat: M.steelDark, surface: 'metal',
    openings: [doorOp(14, 9, 'Main gate', gateRoom, -1, 'gate', { locked: false })],
  });
  // Gate booth, built here rather than as a prop — the prop library is
  // furniture, and this is a small building.
  b.span(-24, PAD, PERIM.z0 + 1, -17, PAD + 3.0, PERIM.z0 + 7, M.concreteRaw, { surface: 'concrete' });
  b.span(-23.4, PAD + 1.0, PERIM.z0 + 0.9, -17.6, PAD + 2.4, PERIM.z0 + 1.1, M.glass,
    { surface: 'glass', flags: BF.SOFT });
  b.span(-24.4, PAD + 3.0, PERIM.z0 + 0.4, -16.6, PAD + 3.3, PERIM.z0 + 7.6, M.corrugated,
    { surface: 'metal' });

  // =========================================================================
  // WAREHOUSE — the centrepiece. One big volume with a mezzanine down one
  // side and a catwalk ring above, so the interior is fought in three layers.
  // =========================================================================
  const whId = b.building('Warehouse');
  const whFloor = room('Warehouse floor', 'warehouse', true,
    WH.x0, WH.z0, WH.x1, WH.z1, PAD, MEZZ, whId);
  const whMezz = room('Mezzanine', 'mezzanine', true,
    WH.x0, WH.z0, WH.x0 + 20, WH.z1, MEZZ, CAT, whId);
  const whCat = room('Catwalk', 'catwalk', true,
    WH.x0, WH.z0, WH.x1, WH.z1, CAT, ROOF, whId);

  const whWall = (x0: number, z0: number, x1: number, z1: number, ops: WallOpening[] = []): void => {
    b.wall({
      x0, z0, x1, z1, y: PAD, height: ROOF - PAD, thickness: W_EXT,
      mat: M.corrugated, surface: 'metal', openings: ops, room: whFloor,
      building: whId, jitter: 0.07,
      pilaster: { every: 9, mat: M.steelDark, width: 0.5, depth: 0.22, extra: 0.2 },
    });
  };
  // South wall: the dock face, with roller doors onto the yard.
  whWall(WH.x0, WH.z0, WH.x1, WH.z0, [
    doorOp(14, 6, 'Dock door 1', whFloor, -1, 'metal', { height: 4.4 }),
    doorOp(36, 6, 'Dock door 2', whFloor, -1, 'metal', { height: 4.4, locked: true }),
    doorOp(56, 1.1, 'Dock personnel door', whFloor, -1, 'metal'),
  ]);
  // North wall faces the apron.
  whWall(WH.x0, WH.z1, WH.x1, WH.z1, [
    doorOp(20, 7, 'Quay door', whFloor, -1, 'metal', { height: 4.8 }),
    winOp(46, 4, 5.4, 7.2), winOp(56, 4, 5.4, 7.2),
  ]);
  // East wall, onto the container yard.
  whWall(WH.x1, WH.z0, WH.x1, WH.z1, [
    doorOp(22, 1.2, 'Yard door', whFloor, -1, 'metal'),
    winOp(38, 3.4, 5.6, 7.4), winOp(48, 3.4, 5.6, 7.4),
  ]);
  // West wall — blind. Its only opening is the stair to the office link.
  whWall(WH.x0, WH.z0, WH.x0, WH.z1, [
    doorOp(8, 1.2, 'Office link', whFloor, -1, 'metal', { locked: true }),
  ]);

  b.slab(WH.x0, WH.z0, WH.x1, WH.z1, ROOF, 0.34, M.bitumen, { surface: 'metal', room: whCat });
  // Roof monitors — the only daylight on the floor, and they throw hard shafts
  // straight down the middle of the fight.
  for (let z = WH.z0 + 12; z < WH.z1 - 6; z += 14) {
    b.span(-56, ROOF - 0.02, z, -40, ROOF + 0.06, z + 3.2, M.glass,
      { surface: 'glass', flags: BF.SOFT | BF.NO_COVER });
  }

  // --- mezzanine ----------------------------------------------------------
  b.slab(WH.x0 + 0.3, WH.z0 + 0.3, WH.x0 + 20, WH.z1 - 0.3, MEZZ, 0.30, M.steelDark,
    { surface: 'metal', room: whMezz });
  // Handrail along its open edge.
  for (let z = WH.z0 + 1; z < WH.z1 - 1; z += 2.2) {
    b.cyl(WH.x0 + 20, MEZZ + 0.55, z, 0.045, 0.55, M.steelGalv, { surface: 'metal', flags: BF.NO_NAV });
  }
  b.span(WH.x0 + 19.9, MEZZ + 1.02, WH.z0 + 0.4, WH.x0 + 20.1, MEZZ + 1.12, WH.z1 - 0.4,
    M.steelGalv, { surface: 'metal', flags: BF.NO_NAV | BF.NO_COVER });

  b.stairs({
    x: WH.x0 + 22, z: WH.z0 + 6, dirX: -1, dirZ: 0, width: 1.6,
    fromY: PAD, toY: MEZZ, run: 5.4, mat: M.steelDark, surface: 'metal', room: whFloor,
  });

  // --- catwalk ring -------------------------------------------------------
  const catW = 1.4;
  const ring: Array<[number, number, number, number]> = [
    [WH.x0 + 2, WH.z0 + 2, WH.x1 - 2, WH.z0 + 2 + catW],
    [WH.x0 + 2, WH.z1 - 2 - catW, WH.x1 - 2, WH.z1 - 2],
    [WH.x0 + 2, WH.z0 + 2, WH.x0 + 2 + catW, WH.z1 - 2],
    [WH.x1 - 2 - catW, WH.z0 + 2, WH.x1 - 2, WH.z1 - 2],
  ];
  for (const [x0, z0, x1, z1] of ring) {
    b.slab(x0, z0, x1, z1, CAT, 0.14, M.steelGalv, { surface: 'metal', room: whCat });
    // Rails on both sides — an unrailed catwalk reads as a plank.
    for (const rx of [x0, x1]) {
      b.span(rx - 0.04, CAT + 0.95, z0, rx + 0.04, CAT + 1.05, z1, M.steelGalv,
        { surface: 'metal', flags: BF.NO_NAV | BF.NO_COVER });
    }
  }
  b.stairs({
    x: WH.x0 + 18, z: WH.z0 + 3, dirX: -1, dirZ: 0, width: 1.2,
    fromY: MEZZ, toY: CAT, run: 4.2, mat: M.steelGalv, surface: 'metal', room: whMezz,
  });

  // Roof hatch: the fourth way in, and the only one that starts outside.
  b.ladder(WH.x1 - 4, WH.z0 + 8, 0, CAT, ROOF + 0.4, M.steelGalv);
  navLinks.push({
    ax: WH.x1 - 4, ay: CAT, az: WH.z0 + 8,
    bx: WH.x1 - 4, by: ROOF + 0.4, bz: WH.z0 + 8,
    kind: 'ladder', penalty: 6, bidirectional: true,
  });

  // --- warehouse contents -------------------------------------------------
  //
  // Pallet racking, built as racking rather than as floating lines. The first
  // pass used 180 mm beams spanning 11 m, which at any distance rendered as
  // thin dark wires suspended in mid-air — no uprights you could read, no
  // depth, no sense that anything was holding anything up.
  //
  // What makes a rack read: fat uprights you can see the section of, beams
  // with visible end brackets, diagonal bracing between the uprights, and
  // stock that overhangs.
  const rack = (cx: number, z0: number, z1: number): void => {
    const bays = 3;
    const levels = 3;
    const depth = 2.6;
    const halfW = 6.0;
    const bayLen = (z1 - z0) / bays;

    for (const px of [cx - halfW, cx + halfW]) {
      for (let bay = 0; bay <= bays; bay++) {
        const bz = z0 + bay * bayLen;
        // Uprights: 140 mm section, in safety yellow, running the full height.
        for (const dz of [-depth / 2, depth / 2]) {
          b.span(px - 0.07, PAD, bz + dz - 0.07, px + 0.07, PAD + 7.4, bz + dz + 0.07,
            M.paintYellow, { surface: 'metal' });
        }
        // Horizontal ties between the two uprights of each frame. Bricks are
        // yaw-only, so a true diagonal is not available — a tie at four
        // heights reads as a frame just as well and costs the same.
        for (let k = 0; k < 4; k++) {
          const y = PAD + 0.5 + k * 1.8;
          b.span(px - 0.05, y, bz - depth / 2, px + 0.05, y + 0.09, bz + depth / 2,
            M.paintYellow, { surface: 'metal', flags: BF.NO_COVER });
        }
        // Foot plate.
        b.span(px - 0.16, PAD, bz - depth / 2 - 0.16, px + 0.16, PAD + 0.08, bz + depth / 2 + 0.16,
          M.steelDark, { surface: 'metal', flags: BF.NO_COVER });
      }
      // Beams: 200 mm deep, orange, one pair per level per bay.
      for (let lvl = 1; lvl <= levels; lvl++) {
        const y = PAD + lvl * 2.1;
        for (const dz of [-depth / 2 + 0.1, depth / 2 - 0.1]) {
          b.span(px - 0.09, y, z0 + dz * 0 - 0, px + 0.09, y + 0.20, z1, M.paintRed,
            { surface: 'metal', flags: BF.NO_COVER });
        }
      }
    }

    // Decking and stock. Irregular on purpose — a full, tidy rack is a wall,
    // and a wall has no gaps to see through or shoot along.
    for (let bay = 0; bay < bays; bay++) {
      for (let lvl = 0; lvl < levels; lvl++) {
        for (const px of [cx - halfW, cx + halfW]) {
          if (rng.next() < 0.22) continue;
          const y = PAD + (lvl + 1) * 2.1 + 0.20;
          const bz = z0 + bay * bayLen;
          b.span(px - depth / 2, y, bz + 0.3, px + depth / 2, y + 0.06, bz + bayLen - 0.3,
            M.woodWeathered, { surface: 'wood', flags: BF.NO_COVER });
          // One to three pallet loads on the deck.
          const loads = 1 + Math.floor(rng.next() * 3);
          for (let q = 0; q < loads; q++) {
            const lz = bz + 0.6 + (q + rng.range(0, 0.4)) * ((bayLen - 1.4) / loads);
            const h = rng.range(0.9, 1.7);
            b.span(px - 0.9, y + 0.06, lz, px + 0.9, y + 0.06 + h, lz + 1.05,
              rng.next() < 0.4 ? M.plasticWhite : rng.next() < 0.6 ? M.woodWeathered : M.fabricCream,
              { surface: 'wood', tint: b.jitterTint(0.10) });
            // Strapping — two dark bands, and the detail that makes a block
            // read as a palletised load rather than as a crate.
            for (const sy of [0.3, 0.7]) {
              b.span(px - 0.94, y + 0.06 + h * sy, lz + 0.05, px + 0.94, y + 0.06 + h * sy + 0.04,
                lz + 1.0, M.rubber, { surface: 'plastic', flags: BF.NO_COVER });
            }
          }
        }
      }
    }
  };
  rack(-40, WH.z0 + 6, WH.z1 - 8);
  rack(-24, WH.z0 + 6, WH.z1 - 8);

  // High-bay lighting on a grid. This is what turns the warehouse from a fog
  // bank into a space with pools of light and shadow between the racks.
  for (let z = WH.z0 + 8; z < WH.z1 - 4; z += 12) {
    for (const lx of [-70, -52, -34, -20]) highBay(lx, ROOF - 0.5, z, 30, 24);
  }
  // Mezzanine and catwalk get their own, lower and warmer, so the levels read
  // as different places rather than one volume.
  for (let z = WH.z0 + 8; z < WH.z1 - 6; z += 14) bulkhead(WH.x0 + 10, MEZZ + 2.6, z, 14, 13);

  // Dock levellers along the south face.
  for (const dx of [-70, -48]) {
    b.span(dx - 3, PAD, WH.z0 - 3.4, dx + 3, DOCK, WH.z0, M.concreteDark, { surface: 'concrete' });
    b.span(dx - 3.2, DOCK - 0.12, WH.z0 - 4.2, dx + 3.2, DOCK, WH.z0 - 3.2, M.steelDark,
      { surface: 'metal', flags: BF.NO_COVER });
  }

  // =========================================================================
  // CONTAINER YARD — the maze. Stacks two and three high with lanes between.
  // =========================================================================
  const CONT = [M.paintBlue, M.paintRed, M.paintGreen, M.rust, M.paintYellow];
  const container = (cx: number, cz: number, y: number, yaw: number, mat: number): void => {
    // 12 x 2.6 x 2.9 — a forty-foot box, which is the unit the whole yard's
    // spacing is derived from.
    b.box(cx, y + 1.45, cz, 6.05, 1.45, 1.3, mat, { yaw, surface: 'metal', tint: b.jitterTint(0.10) });
    // Corrugations: eight shallow ribs down each flank, which is what stops a
    // container reading as a coloured brick.
    for (let i = -5; i <= 5; i++) {
      b.box(cx + Math.cos(yaw) * i * 1.05, y + 1.45, cz - Math.sin(yaw) * i * 1.05,
        0.09, 1.28, 1.36, mat, { yaw, surface: 'metal', flags: BF.NO_COVER, tint: b.jitterTint(0.14) });
    }
    // Corner castings.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      b.box(cx + Math.cos(yaw) * sx * 5.95 + Math.sin(yaw) * sz * 1.22, y + 1.45,
        cz - Math.sin(yaw) * sx * 5.95 + Math.cos(yaw) * sz * 1.22,
        0.16, 1.4, 0.16, M.steelDark, { yaw, surface: 'metal', flags: BF.NO_COVER });
    }
  };

  const yardX0 = -8, yardZ0 = -16, cols = 7, rows = 5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Lanes: 4 m across the stacks, 3.2 m between rows. Tight enough that a
      // corner is always within a second of you.
      const cx = yardX0 + c * 13.0;
      const cz = yardZ0 + r * 6.1;
      if (cx > PERIM.x1 - 12) continue;
      // Deliberate gaps — a perfectly full yard is a grid, and a grid is
      // solved once. Holes make it a place.
      if (rng.next() < 0.18) continue;
      const high = rng.next();
      const stack = high < 0.30 ? 3 : high < 0.72 ? 2 : 1;
      const yaw = rng.next() < 0.08 ? rng.range(-0.25, 0.25) : 0;
      for (let s = 0; s < stack; s++) {
        container(cx, cz, PAD + s * 2.92, yaw, CONT[Math.floor(rng.next() * CONT.length)]);
      }
    }
  }
  room('Container yard', 'yard', false, -14, -20, PERIM.x1 - 6, 18, PAD, PAD + 9);

  // A gantry crane straddling the apron — pure silhouette, and it makes the
  // skyline legible from anywhere on the map.
  const craneZ = 58;
  for (const cx of [-46, 30]) {
    for (const sz of [-9, 9]) {
      b.span(cx - 0.7, PAD, craneZ + sz - 0.7, cx + 0.7, PAD + 22, craneZ + sz + 0.7, M.paintYellow,
        { surface: 'metal' });
    }
    // Cross-bracing, which is most of what makes a crane read as a structure.
    for (let k = 0; k < 5; k++) {
      const y = PAD + 3 + k * 4;
      b.span(cx - 0.8, y, craneZ - 9, cx + 0.8, y + 0.4, craneZ + 9, M.paintYellow,
        { surface: 'metal', flags: BF.NO_COVER });
    }
  }
  b.span(-52, PAD + 22, craneZ - 2.2, 36, PAD + 25, craneZ + 2.2, M.paintYellow, { surface: 'metal' });
  b.span(-16, PAD + 18.4, craneZ - 3.0, -4, PAD + 22, craneZ + 3.0, M.steelDark, { surface: 'metal' });

  // Quay edge: bollards and fenders, and a hard drop to the water.
  for (let x = PERIM.x0 + 10; x < PERIM.x1 - 10; x += 14) {
    b.cyl(x, PAD + 0.45, 70, 0.42, 0.45, M.steelDark, { surface: 'metal' });
    b.cyl(x, PAD + 0.86, 70, 0.28, 0.12, M.steelDark, { surface: 'metal', flags: BF.NO_COVER });
  }
  b.span(PERIM.x0, PAD - 4, 72, PERIM.x1, PAD + 0.2, 74, M.concreteDark, { surface: 'concrete' });
  b.span(PERIM.x0, PAD - 5, 74, PERIM.x1, PAD - 1.2, PERIM.z1 + 20, M.water,
    { surface: 'water', flags: BF.SOFT | BF.NO_NAV });

  // =========================================================================
  // OFFICE BLOCK — two storeys of small rooms. Pure CQB.
  // =========================================================================
  const offId = b.building('Office block');
  const offRooms: number[] = [];
  const lobby = room('Lobby', 'lobby', true, OFF.x0, OFF.z1 - 12, OFF.x0 + 18, OFF.z1, PAD, OFF1, offId);
  const corridor = room('Ground corridor', 'corridor', true,
    OFF.x0 + 18, OFF.z1 - 9, OFF.x1, OFF.z1 - 6, PAD, OFF1, offId);
  const messRoom = room('Mess', 'mess', true, OFF.x0, OFF.z0, OFF.x0 + 18, OFF.z1 - 12, PAD, OFF1, offId);
  const store = room('Bonded store', 'store', true,
    OFF.x0 + 18, OFF.z0, OFF.x1, OFF.z1 - 9, PAD, OFF1, offId);
  offRooms.push(lobby, corridor, messRoom, store);

  const offWall = (
    x0: number, z0: number, x1: number, z1: number, y: number, h: number,
    mat: number, ops: WallOpening[], rm: number, thick = W_EXT,
  ): void => {
    b.wall({ x0, z0, x1, z1, y, height: h, thickness: thick, mat, surface: 'concrete',
             openings: ops, room: rm, building: offId, jitter: 0.05 });
  };

  for (const [lvl, top] of [[PAD, OFF1], [OFF1, OFF1 + 3.3]] as const) {
    offWall(OFF.x0, OFF.z0, OFF.x1, OFF.z0, lvl, top - lvl, M.concreteRaw,
      [winOp(12, 2.2), winOp(26, 2.2), winOp(40, 2.2)], messRoom);
    offWall(OFF.x0, OFF.z1, OFF.x1, OFF.z1, lvl, top - lvl, M.concreteRaw,
      lvl === PAD
        ? [doorOp(9, 1.3, 'Office entrance', lobby, -1, 'glass'), winOp(28, 2.4), winOp(40, 2.4)]
        : [winOp(10, 2.2), winOp(24, 2.2), winOp(38, 2.2)], lobby);
    offWall(OFF.x0, OFF.z0, OFF.x0, OFF.z1, lvl, top - lvl, M.concreteRaw,
      [winOp(10, 2.0), winOp(28, 2.0)], messRoom);
    offWall(OFF.x1, OFF.z0, OFF.x1, OFF.z1, lvl, top - lvl, M.concreteRaw,
      lvl === PAD ? [doorOp(30, 1.2, 'Yard door', corridor, -1, 'metal', { locked: true })] : [], store);
  }

  // Ground floor partitions.
  offWall(OFF.x0 + 18, OFF.z0, OFF.x0 + 18, OFF.z1, PAD, OFF1 - PAD, M.drywall,
    [doorOp(30, 1.1, 'Mess door', messRoom, corridor, 'wood'),
     doorOp(12, 1.1, 'Store door', store, corridor, 'reinforced', { locked: true })],
    corridor, W_INT);
  offWall(OFF.x0 + 18, OFF.z1 - 9, OFF.x1, OFF.z1 - 9, PAD, OFF1 - PAD, M.drywall,
    [doorOp(8, 1.1, 'Store hatch', store, corridor, 'wood')], corridor, W_INT);

  b.slab(OFF.x0, OFF.z0, OFF.x1, OFF.z1, OFF1, 0.28, M.concreteRaw,
    { surface: 'concrete', room: lobby, holes: [[OFF.x0 + 2, OFF.z1 - 6, OFF.x0 + 7, OFF.z1 - 1]] });
  b.slab(OFF.x0, OFF.z0, OFF.x1, OFF.z1, OFF1 + 3.3, 0.30, M.bitumen, { surface: 'concrete', room: lobby });

  b.stairs({
    x: OFF.x0 + 4.5, z: OFF.z1 - 7, dirX: 0, dirZ: 1, width: 1.4,
    fromY: PAD, toY: OFF1, run: 4.6, mat: M.concreteRaw, surface: 'concrete', room: lobby,
  });

  // Upper floor: four small offices off one corridor. The stair lands facing
  // the corridor's long axis, so whoever holds the top of it holds the floor.
  const upCorr = room('Upper corridor', 'corridor', true,
    OFF.x0 + 2, OFF.z1 - 9, OFF.x1 - 2, OFF.z1 - 6, OFF1, OFF1 + 3.3, offId);
  offRooms.push(upCorr);
  for (let i = 0; i < 4; i++) {
    const ox0 = OFF.x0 + 2 + i * 12;
    const r = room(`Office ${i + 1}`, 'office', true, ox0, OFF.z0 + 2, ox0 + 11, OFF.z1 - 9,
      OFF1, OFF1 + 3.3, offId);
    offRooms.push(r);
    offWall(ox0, OFF.z1 - 9, ox0 + 11, OFF.z1 - 9, OFF1, 3.3, M.drywall,
      [doorOp(5.5, 1.0, `Office ${i + 1} door`, r, upCorr, 'wood',
        { hinge: i % 2 === 0 ? 1 : -1 })], upCorr, W_INT);
    if (i < 3) offWall(ox0 + 11, OFF.z0 + 2, ox0 + 11, OFF.z1 - 9, OFF1, 3.3, M.drywall, [], r, W_INT);
    p.desk(ox0 + 5, OFF1, OFF.z0 + 6, rng.range(-0.3, 0.3));
    bulkhead(ox0 + 5.5, OFF1 + 2.9, OFF.z0 + 12, 10, 11);
  }

  // Ground floor and corridor lighting.
  bulkhead(OFF.x0 + 9, PAD + 3.1, OFF.z1 - 6, 11, 12);
  bulkhead(OFF.x0 + 9, PAD + 3.1, OFF.z0 + 8, 11, 12);
  for (let x = OFF.x0 + 24; x < OFF.x1; x += 14) bulkhead(x, PAD + 3.1, OFF.z1 - 7.5, 9, 10);
  for (let x = OFF.x0 + 8; x < OFF.x1; x += 14) bulkhead(x, OFF1 + 2.9, OFF.z1 - 7.5, 9, 10);

  // =========================================================================
  // COLD STORE — small, dark, and the doors are heavy.
  // =========================================================================
  const coldId = b.building('Cold store');
  const antechamber = room('Cold store lobby', 'lobby', true,
    COLD.x0, COLD.z1 - 8, COLD.x1, COLD.z1, PAD, PAD + 4.2, coldId);
  const chambers: number[] = [];
  for (let i = 0; i < 3; i++) {
    const cx0 = COLD.x0 + 1.5 + i * 13.2;
    chambers.push(room(`Chamber ${i + 1}`, 'coldroom', true,
      cx0, COLD.z0 + 1.5, cx0 + 12, COLD.z1 - 8, PAD, PAD + 4.2, coldId));
  }

  const coldWall = (x0: number, z0: number, x1: number, z1: number, ops: WallOpening[], rm: number): void => {
    b.wall({ x0, z0, x1, z1, y: PAD, height: 4.6, thickness: 0.42, mat: M.plasticWhite,
             surface: 'concrete', openings: ops, room: rm, building: coldId, jitter: 0.03 });
  };
  coldWall(COLD.x0, COLD.z1, COLD.x1, COLD.z1,
    [doorOp(14, 2.6, 'Cold store door', antechamber, -1, 'metal', { height: 3.0 })], antechamber);
  coldWall(COLD.x0, COLD.z0, COLD.x1, COLD.z0, [], chambers[1]);
  coldWall(COLD.x0, COLD.z0, COLD.x0, COLD.z1, [], chambers[0]);
  coldWall(COLD.x1, COLD.z0, COLD.x1, COLD.z1,
    [doorOp(18, 1.1, 'Cold store side door', antechamber, -1, 'metal', { locked: true })], antechamber);
  coldWall(COLD.x0, COLD.z1 - 8, COLD.x1, COLD.z1 - 8, chambers.map((c, i) =>
    doorOp(7.5 + i * 13.2, 1.8, `Chamber ${i + 1} door`, c, antechamber, 'metal',
      { hinge: i === 1 ? -1 : 1, height: 2.6 })), antechamber);
  for (let i = 0; i < 2; i++) {
    coldWall(COLD.x0 + 13.2 * (i + 1), COLD.z0, COLD.x0 + 13.2 * (i + 1), COLD.z1 - 8, [], chambers[i]);
  }
  b.slab(COLD.x0, COLD.z0, COLD.x1, COLD.z1, PAD + 4.6, 0.3, M.bitumen,
    { surface: 'concrete', room: antechamber });

  // Racked pallets inside the chambers — cover, and something to hide behind.
  for (let i = 0; i < 3; i++) {
    const cx0 = COLD.x0 + 2.5 + i * 13.2;
    for (let k = 0; k < 4; k++) {
      if (rng.next() < 0.25) continue;
      b.span(cx0 + 1 + (k % 2) * 6, PAD, COLD.z0 + 3 + Math.floor(k / 2) * 8,
             cx0 + 4.4 + (k % 2) * 6, PAD + 2.1, COLD.z0 + 6.4 + Math.floor(k / 2) * 8,
             M.plasticWhite, { surface: 'plastic', tint: b.jitterTint(0.08) });
    }
  }

  // Cold store: cold white, and the only light in there. A chamber with the
  // door shut is genuinely dark, which is the point of putting one on the map.
  bulkhead(COLD.x0 + 21, PAD + 4.1, COLD.z1 - 4, 13, 14);
  for (let i = 0; i < 3; i++) {
    const cx0 = COLD.x0 + 1.5 + i * 13.2;
    lights.push({
      position: vec(cx0 + 6, PAD + 3.9, COLD.z0 + 9),
      color: 0xcfe4ff, intensity: 9, distance: 12, alwaysOn: true,
    });
    b.span(cx0 + 5.4, PAD + 3.95, COLD.z0 + 8.6, cx0 + 6.6, PAD + 4.05, COLD.z0 + 9.4,
      M.lampCold, { surface: 'glass', flags: BF.NO_NAV | BF.NO_COVER });
  }

  // =========================================================================
  // Yard clutter — the things that make a working terminal read as one.
  // =========================================================================
  for (let i = 0; i < 26; i++) {
    const x = rng.range(PERIM.x0 + 8, PERIM.x1 - 8);
    const z = rng.range(PERIM.z0 + 8, 44);
    // Keep clutter out of the buildings.
    if (x > WH.x0 - 3 && x < WH.x1 + 3 && z > WH.z0 - 3 && z < WH.z1 + 3) continue;
    if (x > OFF.x0 - 3 && x < OFF.x1 + 3 && z > OFF.z0 - 3 && z < OFF.z1 + 3) continue;
    if (x > COLD.x0 - 3 && x < COLD.x1 + 3 && z > COLD.z0 - 3 && z < COLD.z1 + 3) continue;
    const kind = rng.next();
    if (kind < 0.3) {
      // Oil drums, in clusters.
      for (let k = 0; k < 2 + Math.floor(rng.next() * 4); k++) {
        b.cyl(x + rng.range(-1.6, 1.6), PAD + 0.44, z + rng.range(-1.6, 1.6), 0.30, 0.44,
          rng.next() < 0.5 ? M.rust : M.paintBlue, { surface: 'metal' });
      }
    } else if (kind < 0.6) {
      b.span(x - 1.1, PAD, z - 0.9, x + 1.1, PAD + 1.0, z + 0.9, M.woodWeathered, { surface: 'wood' });
    } else if (kind < 0.82) {
      // Stacked pallets.
      for (let k = 0; k < 3 + Math.floor(rng.next() * 4); k++) {
        b.span(x - 0.6, PAD + k * 0.15, z - 0.5, x + 0.6, PAD + k * 0.15 + 0.12, z + 0.5,
          M.woodWeathered, { surface: 'wood', flags: BF.NO_COVER });
      }
    } else {
      b.cyl(x, PAD + 3.4, z, 0.11, 3.4, M.steelGalv, { surface: 'metal' });
      b.span(x - 0.5, PAD + 6.6, z - 0.22, x + 0.5, PAD + 7.0, z + 0.22, M.lampCold,
        { surface: 'glass', flags: BF.NO_COVER });
      // Yard lamps come on at dusk, not at noon.
      lights.push({
        position: vec(x, PAD + 6.4, z), color: 0xdce8ff,
        intensity: 22, distance: 20, alwaysOn: false,
      });
    }
  }

  // Pipe rack running the west side — cover at waist height and a visual spine.
  for (let z = -60; z < 40; z += 5.5) {
    b.span(PERIM.x0 + 5, PAD, z - 0.2, PERIM.x0 + 5.4, PAD + 4.2, z + 0.2, M.steelDark, { surface: 'metal' });
  }
  // The pipes themselves. `cyl` stands upright, so a horizontal run is built
  // as a long thin box — which at this diameter is indistinguishable and costs
  // a fraction of the triangles.
  for (const py of [PAD + 2.6, PAD + 3.4, PAD + 4.0]) {
    b.span(PERIM.x0 + 4.98, py - 0.22, -60, PERIM.x0 + 5.42, py + 0.22, 40, M.rust,
      { surface: 'metal', flags: BF.NO_COVER });
  }

  const site: SiteInstance = {
    id: 'meridian-quay',
    name: 'Meridian Quay',
    archetype: 'port',
    x: 0, z: 0, padY: PAD,
    minX: PERIM.x0 - 40, maxX: PERIM.x1 + 40,
    minZ: PERIM.z0 - 40, maxZ: PERIM.z1 + 40,
    coreMinX: PERIM.x0 - 10, coreMaxX: PERIM.x1 + 10,
    coreMinZ: PERIM.z0 - 10, coreMaxZ: PERIM.z1 + 6,
    minY: PAD - 6, maxY: PAD + 26,
    roomIds: rooms.map((_r, i) => i),
    doorIds: b.doors.map((d) => d.id),
    buildingCount: b.buildingNames.length,
    approaches: [
      {
        id: 'main-gate', name: 'Main gate', kind: 'front',
        x: 0, y: PAD, z: PERIM.z0 - 30, toX: 0, toZ: PERIM.z0,
        description: 'Straight through the vehicle gate. Fast, and the booth sees you the whole way in.',
        stealth: 0.05, speed: 0.95, risk: 0.85,
      },
      {
        id: 'rail-spur', name: 'Rail spur', kind: 'flank',
        x: PERIM.x1 + 26, y: PAD, z: -9, toX: PERIM.x1 - 6, toZ: -9,
        description: 'The fence stops either side of the track. A long walk in the open, but nobody watches the rails.',
        stealth: 0.72, speed: 0.35, risk: 0.30,
      },
      {
        id: 'quay-apron', name: 'Quay apron', kind: 'water',
        x: -10, y: PAD, z: PERIM.z1 + 12, toX: -10, toZ: 62,
        description: 'Over the quay wall onto the apron. Puts you behind the warehouse, with the crane between you and the yard.',
        stealth: 0.55, speed: 0.6, risk: 0.45,
      },
      {
        id: 'stack-climb', name: 'Container stack', kind: 'roof',
        x: WH.x1 + 8, y: PAD, z: WH.z0 + 8, toX: WH.x1 - 4, toZ: WH.z0 + 8,
        description: 'Climb the stacks to the warehouse roof and come in through the hatch. Slow, and it puts you above everything.',
        stealth: 0.80, speed: 0.20, risk: 0.35,
      },
    ],
    landmarks: [
      { name: 'Gantry crane', x: -8, y: PAD + 25, z: craneZ, prominence: 220 },
      { name: 'Warehouse', x: (WH.x0 + WH.x1) / 2, y: ROOF, z: (WH.z0 + WH.z1) / 2, prominence: 140 },
      { name: 'Cold store', x: (COLD.x0 + COLD.x1) / 2, y: PAD + 4.6, z: (COLD.z0 + COLD.z1) / 2, prominence: 70 },
      { name: 'Main gate', x: 0, y: PAD + 4, z: PERIM.z0, prominence: 60 },
    ],
    garrison: [
      { x: -19, y: PAD, z: PERIM.z0 + 4, role: 'gate' },
      { x: 18, y: PAD, z: -8, role: 'yard' },
      { x: 44, y: PAD, z: 6, role: 'yard' },
      { x: -50, y: PAD, z: 10, role: 'warehouse' },
      { x: -72, y: MEZZ, z: 20, role: 'overwatch' },
      { x: -40, y: CAT, z: WH.z1 - 4, role: 'overwatch' },
      { x: -60, y: PAD, z: OFF.z1 - 4, role: 'office' },
      { x: -46, y: OFF1, z: OFF.z1 - 7, role: 'office' },
      { x: -6, y: PAD, z: COLD.z1 - 4, role: 'cold' },
      { x: 0, y: PAD, z: 60, role: 'apron' },
    ],
  };

  b.endBuilding();
  return { site, rooms, navLinks, lights };
}
