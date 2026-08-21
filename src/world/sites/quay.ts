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

export function buildQuay(
  b: SiteBuilder, rng: Rng,
  /** Terrain height, for anything placed outside the levelled pad. */
  floorAt: (x: number, z: number) => number = () => PAD,
): SiteBuildResult {
  const p = new Props(b);
  const rooms: RoomSpec[] = [];
  const navLinks: NavLink[] = [];
  const lights: Fixture[] = [];

  /** A hanging high-bay lamp: the fitting, the lens, and the light itself. */
  //
  // ## On the intensities below
  // Three.js point lights with `decay = 2` and a `distance` cutoff give
  // irradiance ~ I/d^2 * (1 - d/distance)^4. A high bay 8.7 m above the floor
  // at intensity 30 delivers 0.066 there — against a NIGHT ambient of 0.30.
  // It was four and a half times dimmer than the darkness it was meant to
  // light. The mistake was scaling intensity with the fitting's importance
  // instead of with the square of its mounting height: at 8.7 m a fixture
  // needs (8.7/3.0)^2 = 8.4x a 3 m bulkhead just to match it.
  const highBay = (x: number, y: number, z: number, intensity = 300, dist = 34): void => {
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
  // South, in two runs with a gap for the gate. A fence drawn straight across
  // its own gateway is solid to a body no matter what the gate does, so the
  // gate would open onto chain link.
  fencePosts(PERIM.x0, PERIM.z0, -14, PERIM.z0);
  fencePosts(14, PERIM.z0, PERIM.x1, PERIM.z0);
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
  // A booth with an inside. It used to be a solid 7 x 6 x 3 m block of
  // concrete with no door and no interior — and the gate guard's spawn point
  // was inside it.
  const booth = (bx: number, bz: number, w: number, d: number, h: number): void => {
    const t = 0.20;
    b.span(bx - w / 2, PAD, bz - d / 2, bx + w / 2, PAD + h, bz - d / 2 + t, M.concreteRaw,
      { surface: 'concrete' });                                   // front, under the glass
    b.span(bx - w / 2, PAD, bz + d / 2 - t, bx + w / 2, PAD + h, bz + d / 2, M.concreteRaw,
      { surface: 'concrete' });
    b.span(bx - w / 2, PAD, bz - d / 2, bx - w / 2 + t, PAD + h, bz + d / 2, M.concreteRaw,
      { surface: 'concrete' });
    // Doorway on the far side, left open — a booth is not a fight.
    b.span(bx + w / 2 - t, PAD, bz - d / 2, bx + w / 2, PAD + h, bz - 0.5, M.concreteRaw,
      { surface: 'concrete' });
    b.span(bx + w / 2 - t, PAD, bz + 0.5, bx + w / 2, PAD + h, bz + d / 2, M.concreteRaw,
      { surface: 'concrete' });
    // Glazing all round the top, which is the whole point of a guard booth.
    for (const [gx0, gz0, gx1, gz1] of [
      [bx - w / 2, bz - d / 2 - 0.02, bx + w / 2, bz - d / 2 + 0.02],
      [bx - w / 2 - 0.02, bz - d / 2, bx - w / 2 + 0.02, bz + d / 2],
    ] as const) {
      b.span(gx0, PAD + 1.05, gz0, gx1, PAD + 2.15, gz1, M.glass,
        { surface: 'glass', flags: BF.SOFT });
    }
    b.span(bx - w / 2 - 0.3, PAD + h, bz - d / 2 - 0.3, bx + w / 2 + 0.3, PAD + h + 0.22,
      bz + d / 2 + 0.3, M.corrugated, { surface: 'metal' });
    b.span(bx - w / 2 + t, PAD + 0.85, bz - d / 2 + t, bx + w / 2 - t, PAD + 0.95,
      bz - d / 2 + t + 0.55, M.woodWeathered, { surface: 'wood' });  // desk
  };
  booth(-20.5, PERIM.z0 + 4, 6.0, 5.0, 2.9);

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

  // Roof, with a hatch and openings under the monitors.
  //
  // The hatch did not exist: the ladder ran through 340 mm of solid bitumen
  // while a navLink and an advertised approach route both claimed it was a way
  // in. The monitors were four sheets of glass laid ON TOP of an opaque roof,
  // so "the only daylight on the floor" entered through nothing.
  b.slab(WH.x0, WH.z0, WH.x1, WH.z1, ROOF, 0.34, M.bitumen, {
    surface: 'metal', room: whCat,
    holes: [
      [WH.x1 - 5.2, WH.z0 + 6.8, WH.x1 - 2.8, WH.z0 + 9.2],
      ...Array.from({ length: 3 }, (_v, i) => {
        const z = WH.z0 + 12 + i * 14;
        return [-56, z, -40, z + 3.2] as [number, number, number, number];
      }),
    ],
  });
  // Hatch coaming and a hinged cover, so the opening reads as a hatch.
  for (const [ox, oz, dx, dz] of [[-1.3, 0, 0.12, 1.3], [1.3, 0, 0.12, 1.3],
                                   [0, -1.3, 1.3, 0.12], [0, 1.3, 1.3, 0.12]] as const) {
    b.box(WH.x1 - 4 + ox, ROOF + 0.18, WH.z0 + 8 + oz, dx, 0.18, dz, M.steelDark,
      { surface: 'metal' });
  }
  // Roof monitors — the only daylight on the floor, and they throw hard shafts
  // straight down the middle of the fight.
  for (let z = WH.z0 + 12; z < WH.z1 - 6; z += 14) {
    b.span(-56, ROOF - 0.02, z, -40, ROOF + 0.06, z + 3.2, M.glass,
      { surface: 'glass', flags: BF.SOFT | BF.NO_COVER });
  }

  // --- mezzanine ----------------------------------------------------------
  // Mezzanine, with the stair well cut out of it. Without the hole the stair
  // climbed the last 3.4 m underneath a solid slab: head clearance ran out at
  // 1.74 m and the player was stopped 1.6 m below the deck.
  b.slab(WH.x0 + 0.3, WH.z0 + 0.3, WH.x0 + 20, WH.z1 - 0.3, MEZZ, 0.30, M.steelDark, {
    surface: 'metal', room: whMezz,
    holes: [[WH.x0 + 15.6, WH.z0 + 4.8, WH.x0 + 20.2, WH.z0 + 7.2]],
  });
  // Handrail along its open edge, with a gap at the stair mouth. A continuous
  // rail across the top of a stair is a wall you have to vault.
  const railGap = (z: number): boolean => z > WH.z0 + 4.4 && z < WH.z0 + 7.6;
  for (let z = WH.z0 + 1; z < WH.z1 - 1; z += 2.2) {
    if (railGap(z)) continue;
    b.cyl(WH.x0 + 20, MEZZ + 0.55, z, 0.045, 0.55, M.steelGalv, { surface: 'metal', flags: BF.NO_NAV });
  }
  for (const [ra, rb] of [[WH.z0 + 0.4, WH.z0 + 4.4], [WH.z0 + 7.6, WH.z1 - 0.4]]) {
    b.span(WH.x0 + 19.9, MEZZ + 1.02, ra, WH.x0 + 20.1, MEZZ + 1.12, rb,
      M.steelGalv, { surface: 'metal', flags: BF.NO_NAV | BF.NO_COVER });
  }

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
    const runsAlongX = (x1 - x0) > (z1 - z0);
    b.slab(x0, z0, x1, z1, CAT, 0.14, M.steelGalv, {
      surface: 'metal', room: whCat,
      // The west leg carries the stair up from the mezzanine.
      holes: !runsAlongX && x0 < WH.x0 + 6
        ? [[x0 - 0.1, WH.z0 + 2.2, x1 + 0.1, WH.z0 + 5.0]]
        : undefined,
    });
    // Rails on BOTH long edges, along whichever axis the leg actually runs.
    //
    // These were always built as spans in Z, so the two 66 m legs that run in
    // X produced a pair of 1.4 m stubs at their ends and left 132 m of catwalk
    // edge with no rail at all — and the stubs sat in the corners at hip
    // height, across the walking line.
    if (runsAlongX) {
      for (const rz of [z0, z1]) {
        b.span(x0, CAT + 0.95, rz - 0.04, x1, CAT + 1.05, rz + 0.04, M.steelGalv,
          { surface: 'metal', flags: BF.NO_NAV | BF.NO_COVER });
      }
    } else {
      for (const rx of [x0, x1]) {
        b.span(rx - 0.04, CAT + 0.95, z0, rx + 0.04, CAT + 1.05, z1, M.steelGalv,
          { surface: 'metal', flags: BF.NO_NAV | BF.NO_COVER });
      }
    }
  }
  b.stairs({
    x: WH.x0 + 8.6, z: WH.z0 + 3.6, dirX: 0, dirZ: -1, width: 1.2,
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
        // Front and back beam of each frame. `z0 + dz * 0` multiplied the
        // offset by zero, so both beams of every pair were drawn at identical
        // coordinates — 24 duplicate bricks all z-fighting, and a rack with a
        // single beam plane down its centreline instead of two.
        for (const dz of [-depth / 2 + 0.1, depth / 2 - 0.1]) {
          b.span(px - 0.09, y, z0, px + 0.09, y + 0.20, z1, M.paintRed,
            { surface: 'metal', flags: BF.NO_COVER, yaw: 0 });
          b.span(px + dz - 0.05, y, z0, px + dz + 0.05, y + 0.16, z1, M.paintRed,
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
    for (const lx of [-70, -52, -34, -20]) highBay(lx, ROOF - 0.5, z, 300, 34);
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

  // Yard rows start clear of the rail corridor.
  //
  // At yardZ0 = -16 the first two rows sat at z -9.9 and -3.8, squarely inside
  // the ballast, with the rails running through the container bodies. The
  // "quiet rail approach" — one of the map's four advertised entries — was
  // physically blocked and visually broken along its whole length.
  const yardX0 = -8, yardZ0 = 0, cols = 7, rows = 5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Lanes: 4 m across the stacks, 3.2 m between rows. Tight enough that a
      // corner is always within a second of you.
      // 16.4 m pitch gives a 4.2 m end-to-end slot against a 12.22 m box.
      // At 13.0 the gap was 0.78 m — the player squeezes through with 70 mm
      // per side and cannot go prone anywhere in the yard.
      const cx = yardX0 + c * 16.4;
      const cz = yardZ0 + r * 6.1;
      if (cx > PERIM.x1 - 10) continue;
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
      color: 0xcfe4ff, intensity: 60, distance: 14, alwaysOn: true,
    });
    b.span(cx0 + 5.4, PAD + 3.95, COLD.z0 + 8.6, cx0 + 6.6, PAD + 4.05, COLD.z0 + 9.4,
      M.lampCold, { surface: 'glass', flags: BF.NO_NAV | BF.NO_COVER });
  }

  // =========================================================================
  // INTERIORS
  //
  // An empty room is a corridor with extra walls. Furniture is not decoration
  // in a tactical shooter — it is what makes a room a *place*: it gives you
  // waist-high cover, it breaks sightlines, it tells you what the room is for
  // before you have cleared it, and it is the difference between "a box with
  // hostiles in it" and somewhere you have to think about.
  //
  // Ready or Not runs its interiors at roughly one prop per 3-5 square metres.
  // This building had ONE prop call in the entire site.
  // =========================================================================

  // --- office block, ground floor -----------------------------------------
  // Lobby: a counter you can fight from, seating, and a board.
  p.counter(OFF.x0 + 3, OFF.z1 - 4.5, OFF.x0 + 11, OFF.z1 - 4.5, PAD, M.steelDark);
  p.chair(OFF.x0 + 5, PAD, OFF.z1 - 7, 0.2);
  p.chair(OFF.x0 + 7.4, PAD, OFF.z1 - 7.4, -0.35);
  p.sofa(OFF.x0 + 13, PAD, OFF.z1 - 3, -Math.PI / 2, 2.4, M.leather);
  p.table(OFF.x0 + 13, PAD, OFF.z1 - 6, 0, 1.1, 0.7, 0.45, M.steelDark);
  p.painting(OFF.x0 + 0.4, PAD + 1.8, OFF.z1 - 8, Math.PI / 2, 1.2, 0.9);
  p.pendant(OFF.x0 + 9, PAD + 3.3, OFF.z1 - 6);
  for (let i = 0; i < 3; i++) p.crate(OFF.x0 + 15 + i * 1.4, PAD, OFF.z1 - 10.5, i * 0.4, 0.55);

  // Mess: tables in rows, a galley run down one wall.
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      const tx = OFF.x0 + 5 + c * 8, tz = OFF.z0 + 6 + r * 9;
      p.table(tx, PAD, tz, 0, 2.0, 0.9, 0.75, M.woodWeathered);
      p.chair(tx - 1.3, PAD, tz, -Math.PI / 2);
      p.chair(tx + 1.3, PAD, tz, Math.PI / 2);
      p.chair(tx, PAD, tz - 0.9, 0);
      if (rng.next() < 0.6) p.chair(tx, PAD, tz + 0.9, Math.PI);
    }
  }
  p.counter(OFF.x0 + 1.2, OFF.z0 + 3, OFF.x0 + 1.2, OFF.z0 + 13, PAD, M.steelGalv);
  p.fridge(OFF.x0 + 2.2, PAD, OFF.z0 + 15.5, Math.PI / 2);
  p.stove(OFF.x0 + 2.2, PAD, OFF.z0 + 17.6, Math.PI / 2);
  for (let i = 0; i < 4; i++) p.pendant(OFF.x0 + 5 + i * 7, PAD + 3.3, OFF.z0 + 10);

  // Bonded store: racking, crates and a strongbox. This is what the mission
  // sends you in for, so it has to look like somewhere things are kept.
  for (let r = 0; r < 3; r++) {
    const rz = OFF.z0 + 5 + r * 8;
    for (let lv = 0; lv < 3; lv++) {
      b.span(OFF.x0 + 20, PAD + lv * 0.9, rz, OFF.x1 - 3, PAD + lv * 0.9 + 0.07, rz + 0.9,
        M.steelDark, { surface: 'metal' });
    }
    for (const ux of [OFF.x0 + 20.2, OFF.x1 - 3.2]) {
      b.span(ux - 0.05, PAD, rz, ux + 0.05, PAD + 2.7, rz + 0.9, M.steelDark, { surface: 'metal' });
    }
    for (let k = 0; k < 7; k++) {
      if (rng.next() < 0.3) continue;
      p.crate(OFF.x0 + 22 + k * 3.6, PAD + Math.floor(rng.next() * 3) * 0.9 + 0.07,
        rz + 0.45, rng.range(-0.2, 0.2), rng.range(0.45, 0.7));
    }
  }
  p.desk(OFF.x0 + 22, PAD, OFF.z1 - 12, 0.4);
  p.shelf(OFF.x1 - 2, PAD, OFF.z1 - 14, -Math.PI / 2, 2.0, 2.2);
  // The strongbox — the manifest objective's anchor.
  b.span(OFF.x0 + 32, PAD, OFF.z1 - 16.4, OFF.x0 + 33.4, PAD + 1.15, OFF.z1 - 15.2,
    M.steelDark, { surface: 'metal' });
  b.span(OFF.x0 + 32.1, PAD + 0.35, OFF.z1 - 16.5, OFF.x0 + 33.3, PAD + 0.85, OFF.z1 - 16.42,
    M.brass, { surface: 'metal', flags: BF.NO_COVER });

  // --- office block, upper floor ------------------------------------------
  // Four offices, each dressed differently so they are distinguishable while
  // clearing them — identical rooms are how a player loses track of where
  // they have been.
  for (let i = 0; i < 4; i++) {
    const ox = OFF.x0 + 2 + i * 12;
    const cz = OFF.z0 + 8;
    p.desk(ox + 5, OFF1, cz, i % 2 ? 0.2 : Math.PI - 0.2);
    p.chair(ox + 5, OFF1, cz + 1.2, Math.PI);
    p.shelf(ox + 1.4, OFF1, cz + 4, Math.PI / 2, 1.6, 2.0);
    if (i % 2 === 0) {
      p.table(ox + 8, OFF1, cz + 6, 0.3, 1.4, 0.8, 0.72, M.woodWeathered);
      p.chair(ox + 8, OFF1, cz + 7.2, Math.PI);
    } else {
      p.sofa(ox + 8, OFF1, cz + 6, Math.PI, 2.0, M.fabricTeal);
      p.rug(ox + 8, OFF1, cz + 7.6, 0, 2.4, 1.6, M.fabricCream);
    }
    p.painting(ox + 5.5, OFF1 + 1.9, OFF.z0 + 2.3, 0, 1.0, 0.75);
    for (let k = 0; k < 3; k++) {
      p.crate(ox + 1.5 + k * 1.2, OFF1, cz + 12 + rng.range(-0.6, 0.6), rng.range(0, 1), 0.45);
    }
  }
  // Corridor: lockers and a water cooler, which is what a corridor has.
  for (let x = OFF.x0 + 6; x < OFF.x1 - 6; x += 3.2) {
    b.span(x, OFF1, OFF.z1 - 6.4, x + 1.1, OFF1 + 1.85, OFF.z1 - 5.8, M.steelDark,
      { surface: 'metal', tint: b.jitterTint(0.05) });
    b.span(x + 0.02, OFF1 + 1.0, OFF.z1 - 6.45, x + 0.5, OFF1 + 1.1, OFF.z1 - 6.4, M.steelGalv,
      { surface: 'metal', flags: BF.NO_COVER });
  }
  p.waterTank(OFF.x1 - 4, OFF1, OFF.z1 - 7.4, 0.24, 0.55);

  // --- cold store ----------------------------------------------------------
  // Lobby: a control panel, a trolley, and hanging strip curtains at each
  // chamber door — the thing that tells you a room is refrigerated.
  b.span(COLD.x0 + 3, PAD + 0.9, COLD.z1 - 1.4, COLD.x0 + 4.6, PAD + 1.9, COLD.z1 - 1.1,
    M.steelGalv, { surface: 'metal' });
  b.span(COLD.x0 + 3.2, PAD + 1.15, COLD.z1 - 1.45, COLD.x0 + 4.4, PAD + 1.65, COLD.z1 - 1.4,
    M.lampCold, { surface: 'glass', flags: BF.NO_COVER });
  for (let i = 0; i < 3; i++) {
    const cx0 = COLD.x0 + 1.5 + i * 13.2;
    // Strip curtain in the doorway.
    for (let k = 0; k < 9; k++) {
      b.span(cx0 + 5.7 + k * 0.2, PAD + 0.2, COLD.z1 - 8.05, cx0 + 5.86 + k * 0.2, PAD + 2.5,
        COLD.z1 - 7.99, M.plasticWhite,
        { surface: 'plastic', flags: BF.SOFT | BF.NO_NAV | BF.NO_COVER });
    }
    // Trolleys and stacked crates inside.
    for (let k = 0; k < 5; k++) {
      if (rng.next() < 0.25) continue;
      const tx = cx0 + 2 + rng.range(0, 8);
      const tz = COLD.z0 + 3 + rng.range(0, 12);
      b.span(tx - 0.5, PAD + 0.16, tz - 0.35, tx + 0.5, PAD + 0.24, tz + 0.35, M.steelDark,
        { surface: 'metal' });
      for (let q = 0; q < 2 + Math.floor(rng.next() * 3); q++) {
        p.crate(tx, PAD + 0.24 + q * 0.5, tz, rng.range(-0.3, 0.3), 0.48);
      }
      for (const wx of [tx - 0.42, tx + 0.42]) {
        b.cyl(wx, PAD + 0.08, tz, 0.08, 0.08, M.rubber, { surface: 'rubber', flags: BF.NO_COVER });
      }
    }
    // Ceiling rail with hanging stock.
    b.span(cx0 + 1, PAD + 3.6, COLD.z0 + 4, cx0 + 11, PAD + 3.7, COLD.z0 + 4.12, M.steelGalv,
      { surface: 'metal', flags: BF.NO_NAV });
    for (let k = 0; k < 6; k++) {
      if (rng.next() < 0.4) continue;
      b.span(cx0 + 1.6 + k * 1.6, PAD + 2.3, COLD.z0 + 3.86, cx0 + 2.2 + k * 1.6, PAD + 3.6,
        COLD.z0 + 4.26, M.fabricCream, { surface: 'fabric', tint: b.jitterTint(0.10) });
    }
  }

  // --- warehouse: a floor office and a break area on the mezzanine ---------
  // Somewhere on a warehouse floor there is always a glass box with a desk in
  // it, and it is always the best cover on the floor.
  const fo = { x0: WH.x1 - 16, x1: WH.x1 - 4, z0: WH.z1 - 14, z1: WH.z1 - 4 };
  for (const [wx0, wz0, wx1, wz1] of [
    [fo.x0, fo.z0, fo.x1, fo.z0 + 0.2], [fo.x0, fo.z1 - 0.2, fo.x1, fo.z1],
    [fo.x0, fo.z0, fo.x0 + 0.2, fo.z1],
  ] as const) {
    b.span(wx0, PAD, wz0, wx1, PAD + 1.05, wz1, M.corrugated, { surface: 'metal' });
    b.span(wx0, PAD + 1.05, wz0, wx1, PAD + 2.6, wz1, M.glass,
      { surface: 'glass', flags: BF.SOFT });
  }
  b.span(fo.x1 - 0.2, PAD, fo.z0, fo.x1, PAD + 2.6, fo.z0 + 4, M.corrugated, { surface: 'metal' });
  b.span(fo.x0, PAD + 2.6, fo.z0, fo.x1, PAD + 2.8, fo.z1, M.bitumen, { surface: 'metal' });
  p.desk(fo.x0 + 4, PAD, fo.z0 + 3, 0.1);
  p.chair(fo.x0 + 4, PAD, fo.z0 + 4.4, Math.PI);
  p.shelf(fo.x0 + 1.2, PAD, fo.z1 - 3, Math.PI / 2, 1.8, 2.0);
  p.pendant(fo.x0 + 6, PAD + 2.5, fo.z0 + 5);
  bulkhead(fo.x0 + 6, PAD + 2.45, fo.z0 + 5, 9, 9);

  // Mezzanine break area.
  p.table(WH.x0 + 8, MEZZ, WH.z0 + 26, 0, 1.6, 0.9, 0.74, M.woodWeathered);
  p.chair(WH.x0 + 6.6, MEZZ, WH.z0 + 26, -Math.PI / 2);
  p.chair(WH.x0 + 9.4, MEZZ, WH.z0 + 26, Math.PI / 2);
  p.fridge(WH.x0 + 3, MEZZ, WH.z0 + 24, Math.PI / 2);
  p.shelf(WH.x0 + 3, MEZZ, WH.z0 + 30, Math.PI / 2, 2.0, 2.0);
  for (let i = 0; i < 8; i++) {
    p.pallet(WH.x0 + 4 + rng.range(0, 14), MEZZ, WH.z0 + 6 + rng.range(0, 34),
      rng.range(0, 3.14), 2 + Math.floor(rng.next() * 4));
  }
  // Forklift on the floor — one silhouette that says "warehouse" instantly.
  const fk = { x: WH.x0 + 34, z: WH.z1 - 12 };
  b.span(fk.x - 0.7, PAD + 0.25, fk.z - 1.1, fk.x + 0.7, PAD + 1.15, fk.z + 0.9, M.paintYellow,
    { surface: 'metal' });
  b.span(fk.x - 0.55, PAD + 1.15, fk.z - 0.2, fk.x + 0.55, PAD + 1.85, fk.z + 0.75, M.steelDark,
    { surface: 'metal' });
  for (const mx of [-0.5, 0.5]) {
    b.span(fk.x + mx - 0.05, PAD + 0.3, fk.z - 2.4, fk.x + mx + 0.05, PAD + 2.9, fk.z - 2.3,
      M.steelDark, { surface: 'metal' });
  }
  b.span(fk.x - 0.6, PAD + 0.1, fk.z - 2.5, fk.x + 0.6, PAD + 0.2, fk.z - 1.4, M.steelGalv,
    { surface: 'metal', flags: BF.NO_COVER });
  for (const [wx, wz] of [[-0.72, -0.7], [0.72, -0.7], [-0.72, 0.6], [0.72, 0.6]] as const) {
    b.cyl(fk.x + wx, PAD + 0.26, fk.z + wz, 0.26, 0.11, M.rubber, { surface: 'rubber' });
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
        intensity: 180, distance: 26, alwaysOn: false,
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

  // =========================================================================
  // OUTSIDE THE WIRE
  //
  // A terminal with nothing around it is a diorama. The approach is where a
  // player decides how to do the mission, and it can only be a decision if
  // there is something out there to read: where the road comes from, what
  // overlooks the gate, where the fence is weak, and what cover exists between
  // the treeline and the wire.
  //
  // Everything here sits OUTSIDE `PERIM`, so none of it changes the fights
  // inside — it changes how you arrive at them.
  // =========================================================================

  // --- the approach road ---------------------------------------------------
  // Runs south from the gate and bends east, so the last 60 m is a straight
  // run at the guard booth with nothing on it. That straightness is the point:
  // it is why the road is the loud way in.
  const road = (x0: number, z0: number, x1: number, z1: number, w: number): void => {
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const yaw = Math.atan2(-dz, dx);
    b.box((x0 + x1) / 2, PAD - 0.08, (z0 + z1) / 2, len / 2, 0.09, w / 2, M.asphalt,
      { yaw, surface: 'concrete', flags: BF.NO_COVER, tint: b.jitterTint(0.05) });
    // Kerbs, which are what actually make a strip of dark ground read as a road.
    for (const side of [-1, 1]) {
      b.box((x0 + x1) / 2 + Math.sin(yaw) * side * (w / 2 + 0.16), PAD + 0.02,
        (z0 + z1) / 2 + Math.cos(yaw) * side * (w / 2 + 0.16),
        len / 2, 0.12, 0.16, M.concreteRaw,
        { yaw, surface: 'concrete', flags: BF.NO_COVER });
    }
  };
  road(0, PERIM.z0 - 2, 0, PERIM.z0 - 62, 9);
  road(0, PERIM.z0 - 62, 78, PERIM.z0 - 78, 9);
  // Stops short of the ditch rather than driving through it. This run used to
  // cross x = -30 at z = -107, burying the tarmac in the dirt and pushing the
  // berms 0.6 m up through the road surface.
  road(0, PERIM.z0 - 30, -23, PERIM.z0 - 33, 7);

  // Centre line, dashed, on the straight run only.
  for (let z = PERIM.z0 - 8; z > PERIM.z0 - 58; z -= 5.5) {
    b.span(-0.16, PAD - 0.04, z, 0.16, PAD + 0.02, z - 2.6, M.plasticWhite,
      { surface: 'concrete', flags: BF.NO_COVER });
  }

  // --- outer checkpoint, 40 m short of the gate ---------------------------
  // Slows a vehicle approach and gives a stealth player their first decision:
  // the ditch on the west side runs past it.
  const cpZ = PERIM.z0 - 40;
  for (let i = 0; i < 5; i++) {
    p.jerseyBarrier(-9 + i * 4.6, PAD, cpZ + (i % 2 ? 2.4 : -2.4), i % 2 ? 0.06 : -0.06);
  }
  booth(-14, cpZ, 5.0, 4.6, 2.8);
  lights.push({ position: vec(-14, PAD + 2.5, cpZ), color: 0xffd9a8,
    intensity: 9, distance: 11, alwaysOn: false });
  // Boom barrier across the road, raised — this checkpoint is not the obstacle.
  b.cyl(-9.4, PAD + 1.1, cpZ, 0.11, 1.1, M.steelGalv, { surface: 'metal' });
  b.span(-9.6, PAD + 1.9, cpZ - 0.09, -9.2, PAD + 4.2, cpZ + 0.09, M.paintRed,
    { surface: 'metal', flags: BF.NO_COVER });
  p.floodlight(-18, PAD, cpZ + 5, 0.4);
  p.sandbags(-22, cpZ - 3, -18, cpZ + 1, PAD, 3);

  // --- the ditch: the quiet approach ---------------------------------------
  // A drainage cut running parallel to the road, deep enough to move along
  // below the checkpoint's sightline and out of the floodlight.
  for (let z = PERIM.z0 - 6; z > PERIM.z0 - 72; z -= 6) {
    // 1.5 m of real cut, with berms above it.
    //
    // `PAD - 1.5` was the block's BOTTOM, not the ditch floor — the walkable
    // top was PAD - 0.1, a 100 mm scrape. A standing player was exposed by
    // 0.98 m over the east berm and a crouching one by 0.42 m, so the "quiet
    // approach" concealed nobody who was not already prone.
    b.span(-34, PAD - 3.0, z - 3, -27, PAD - 1.40, z + 3, M.dirtMat,
      { surface: 'dirt', flags: BF.NO_COVER, tint: b.jitterTint(0.09) });
    b.span(-36.5, PAD - 3.0, z - 3, -34, PAD + 0.42, z + 3, M.dirtMat, { surface: 'dirt' });
    b.span(-27, PAD - 3.0, z - 3, -24.5, PAD + 0.46, z + 3, M.dirtMat, { surface: 'dirt' });
    if (rng.next() < 0.5) p.hedge(-33 + rng.range(0, 5), z - 2, -31 + rng.range(0, 5), z + 2, PAD + 0.4, 1.3, 0.9);
  }
  // Headwalls where the ditch passes the checkpoint.
  //
  // This was a culvert built with `cyl`, which stands upright along Y — `yaw`
  // rotates about that axis and cannot lay it down. The result was a 12 m
  // concrete column standing in the middle of the approach road. Cylinders in
  // this builder are vertical, full stop; a horizontal one is a long box.
  // Headwalls, with the channel left OPEN through them. Solid walls here
  // bracketed the checkpoint and forced the stealth route to vault a 0.8 m
  // wall four metres from the guard post, inside the floodlight.
  for (const hz of [PERIM.z0 - 30, PERIM.z0 - 44]) {
    for (const [wx0, wx1] of [[-35.5, -33.6], [-27.4, -25.5]] as const) {
      b.span(wx0, PAD - 3.0, hz - 0.35, wx1, PAD + 0.55, hz + 0.35, M.concreteDark,
        { surface: 'concrete' });
    }
    // Lintel above the channel, so it reads as a crossing rather than a gap.
    b.span(-34, PAD - 0.10, hz - 0.35, -27, PAD + 0.55, hz + 0.35, M.concreteDark,
      { surface: 'concrete' });
  }

  // --- rail yard, east ------------------------------------------------------
  // The spur that comes through the fence gap has to come FROM somewhere, and
  // a siding with stock parked on it is both the explanation and 120 m of hard
  // cover on the flanking route.
  for (const off of [-9, 2]) {
    for (const rx of [-3.2, 3.2]) {
      b.span(PERIM.x1 + 2, PAD + 0.10, off + rx - 0.06, PERIM.x1 + 78, PAD + 0.19, off + rx + 0.06,
        M.steelDark, { surface: 'metal', flags: BF.NO_COVER });
    }
    for (let x = PERIM.x1 + 4; x < PERIM.x1 + 76; x += 0.62) {
      b.span(x, PAD + 0.03, off - 3.6, x + 0.26, PAD + 0.11, off + 3.6, M.woodWeathered,
        { surface: 'wood', flags: BF.NO_COVER });
    }
  }
  // Parked wagons on the siding.
  for (let i = 0; i < 5; i++) {
    const wx = PERIM.x1 + 14 + i * 15.5;
    b.span(wx - 6.4, PAD + 0.42, 2 - 1.6, wx + 6.4, PAD + 1.1, 2 + 1.6, M.rust, { surface: 'metal' });
    b.span(wx - 6.0, PAD + 1.1, 2 - 1.5, wx + 6.0, PAD + 3.5, 2 + 1.5,
      i % 2 ? M.rust : M.paintBlue, { surface: 'metal', tint: b.jitterTint(0.10) });
    for (const bx of [-4.4, 4.4]) {
      b.cyl(wx + bx, PAD + 0.42, 0.6, 0.42, 0.09, M.steelDark, { surface: 'metal', yaw: Math.PI / 2 });
      b.cyl(wx + bx, PAD + 0.42, 3.4, 0.42, 0.09, M.steelDark, { surface: 'metal', yaw: Math.PI / 2 });
    }
  }

  // --- outer scrub, spoil heaps and the treeline ---------------------------
  // Placed by rejection sampling against everything above, so nothing lands in
  // a road, a ditch or the rail bed.
  // 900 samples over ~105,000 m2 is roughly one object per 120 m2. At 150 it
  // was one per 700 — an object every 26 metres, which is bare sand.
  const clearOf = (x: number, z: number): boolean => {
    if (x > PERIM.x0 - 4 && x < PERIM.x1 + 4 && z > PERIM.z0 - 4 && z < PERIM.z1 + 4) return false;
    if (Math.abs(x) < 8 && z < PERIM.z0 && z > PERIM.z0 - 66) return false;   // road
    if (x > -37 && x < -24 && z < PERIM.z0 && z > PERIM.z0 - 76) return false; // ditch
    if (x > PERIM.x1 && Math.abs(z + 3) < 9) return false;                     // rail
    return true;
  };
  for (let i = 0; i < 900; i++) {
    const x = rng.range(PERIM.x0 - 96, PERIM.x1 + 96);
    const z = rng.range(PERIM.z0 - 96, PERIM.z1 + 30);
    if (!clearOf(x, z)) continue;
    const y = floorAt(x, z);
    const k = rng.next();
    if (k < 0.30) {
      // Scrub.
      p.hedge(x - rng.range(0.8, 2.2), z - 1, x + rng.range(0.8, 2.2), z + 1, y, rng.range(0.7, 1.5), 1.0);
    } else if (k < 0.52) {
      // Spoil heap — a dirt mound, which is the only cover out here.
      const r = rng.range(2.2, 5.0);
      b.span(x - r, y - 0.2, z - r * 0.7, x + r, y + rng.range(0.9, 2.2), z + r * 0.7, M.dirtMat,
        { surface: 'dirt', tint: b.jitterTint(0.10) });
    } else if (k < 0.66) {
      p.cypress(x, y, z, rng.range(5, 9));
    } else if (k < 0.78) {
      for (let q = 0; q < 2 + Math.floor(rng.next() * 4); q++) {
        p.drum(x + rng.range(-1.8, 1.8), y, z + rng.range(-1.8, 1.8));
      }
    } else if (k < 0.87) {
      p.tyreStack(x, y, z, 3 + Math.floor(rng.next() * 3));
    } else if (k < 0.94) {
      // Wrecked plant, long abandoned.
      b.span(x - 2.4, y, z - 1.1, x + 2.4, y + 1.5, z + 1.1, M.rust,
        { surface: 'metal', yaw: rng.range(0, 3.14), tint: b.jitterTint(0.12) });
      p.tyreStack(x + 2.8, y, z, 2);
    } else {
      b.span(x - 3.2, y, z - 2.4, x + 3.2, y + 2.6, z + 2.4, M.corrugated,
        { surface: 'metal', yaw: rng.range(-0.4, 0.4), tint: b.jitterTint(0.10) });
    }
  }

  // --- vehicles on the approach --------------------------------------------
  p.pickup(-6.5, PAD, PERIM.z0 - 20, 0.05);
  p.suv(6.2, PAD, PERIM.z0 - 26, 3.10);
  p.pickup(-13, PAD, cpZ + 8, 1.55);
  p.sedan(20, PAD, PERIM.z0 - 58, 2.3);
  // A truck at the gate, half unloaded — the reason the gate is open at all.
  b.span(-2.6, PAD, PERIM.z0 - 12, 2.6, PAD + 1.0, PERIM.z0 - 4, M.steelDark, { surface: 'metal' });
  b.span(-2.9, PAD + 1.0, PERIM.z0 - 12, 2.9, PAD + 3.6, PERIM.z0 - 5.6, M.paintGreen,
    { surface: 'metal', tint: b.jitterTint(0.06) });
  b.span(-2.4, PAD + 0.9, PERIM.z0 - 5.4, 2.4, PAD + 3.0, PERIM.z0 - 2.4, M.steelDark, { surface: 'metal' });
  p.crate(-4.4, PAD, PERIM.z0 - 9, 0.3, 0.7);
  p.crate(-4.6, PAD, PERIM.z0 - 7, -0.2, 0.7);
  p.pallet(4.6, PAD, PERIM.z0 - 8, 0.1, 4);

  // Street lighting down the approach.
  for (let z = PERIM.z0 - 12; z > PERIM.z0 - 66; z -= 18) {
    for (const sx of [-6.6, 6.6]) {
      p.streetLamp(sx, PAD, z, 5.5);
      lights.push({ position: vec(sx, PAD + 5.2, z), color: 0xffd0a0,
        intensity: 140, distance: 24, alwaysOn: false });
    }
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
