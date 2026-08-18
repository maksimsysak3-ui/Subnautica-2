/**
 * CASA VERDUGO — cartel villa compound.
 *
 * A ~160 × 135 m walled estate on a levelled shelf above the basin. The layout
 * is built around tactical questions rather than around a floor plan:
 *
 *   - The gate is the loud approach and everyone knows it, so the walls are
 *     given a drainage culvert (west), a service gate (east) and a low garden
 *     wall by the pool that a fit operator can climb.
 *   - The main house is deliberately *deep*: an entry hall you can be shot at
 *     from three directions, a spine corridor that has to be crossed, and a
 *     first floor whose only stair is overlooked from the landing.
 *   - The roof of every outbuilding is reachable, because the interesting
 *     question in a compound is always "who has the height".
 *   - Service alleys behind the staff block and between the casitas give
 *     flanking routes that never enter the courtyard.
 *
 * Everything is authored in metres relative to the pad, from a seeded Rng.
 */

import { Rng } from '../../core/math';
import { SiteBuilder } from '../builder';
import { Props } from '../props';
import { M } from '../palette';
import { BF, type SiteInstance, type WallOpening, type SiteBuildResult } from '../types';

// --- pad geometry ----------------------------------------------------------
const PAD = 2.0;              // world Y of the compound ground
const TER = PAD + 0.9;        // the raised house/pool terrace
const GF = TER;               // ground floor level
const FF = GF + 3.4;          // first floor level
const ROOF = FF + 3.2;        // roof deck level
const WALL_H = 3.3;

const HOUSE = { x0: -22, x1: 8, z0: -10, z1: 12 };
const PERIM = { x0: -78, x1: 78, z0: -58, z1: 74 };

const W_EXT = 0.34;   // exterior wall thickness
const W_INT = 0.18;   // partition thickness

const DOOR_H = 2.1;
const WIN_Y0 = 0.95;
const WIN_Y1 = 2.35;

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

function archOp(at: number, width: number, height = 2.4): WallOpening {
  return { at, width, y0: 0, y1: height, kind: 'arch' };
}

export function buildVilla(b: SiteBuilder, rng: Rng): SiteBuildResult {
  const p = new Props(b);

  // =========================================================================
  // Ground plane treatments — the single cheapest readability win. Bare
  // terrain everywhere makes a compound look unplanned; paving tells you
  // where you are meant to walk and where you are exposed.
  // =========================================================================
  const pave = (
    x0: number, z0: number, x1: number, z1: number, y: number, mat: number,
    surface: 'concrete' | 'gravel' | 'grass' | 'tile' | 'dirt' | 'sand',
  ): void => {
    b.span(x0, y - 0.14, z0, x1, y, z1, mat, {
      surface, flags: BF.NO_COVER, tint: b.jitterTint(0.05),
    });
  };

  // Lawn across the whole compound, then hard surfaces on top of it.
  pave(PERIM.x0, PERIM.z0, PERIM.x1, PERIM.z1, PAD, M.lawn, 'grass');
  // Driveway: gate → motor court → around the fountain.
  pave(-5, 40, 5, PERIM.z1, PAD + 0.005, M.asphalt, 'concrete');
  pave(-26, 16, 14, 42, PAD + 0.005, M.asphalt, 'concrete');
  // Service spur east to the workshop and staff block.
  pave(14, -34, PERIM.x1 - 1, -26, PAD + 0.005, M.gravelMat, 'gravel');
  pave(28, -42, 58, -22, PAD + 0.005, M.gravelMat, 'gravel');
  pave(-32, -56, 14, -42, PAD + 0.005, M.gravelMat, 'gravel');
  // Service alley behind the staff block — the quiet flanking route.
  pave(-34, -58, 16, -54, PAD + 0.005, M.concreteRaw, 'concrete');
  // The raised terrace slab that carries house + pool.
  b.span(-60, PAD - 0.2, -12, 14, TER, 24, M.stoneTrim, {
    surface: 'tile', flags: BF.NO_COVER, tint: b.jitterTint(0.04),
  });
  pave(-60, -12, 14, 24, TER + 0.005, M.tileTerra, 'tile');
  // Casita court.
  pave(22, -8, 48, 36, PAD + 0.005, M.gravelMat, 'gravel');

  // Terrace steps down to the motor court (front) and a ramp on the service side.
  for (let i = 0; i < 5; i++) {
    const y = PAD + (i * (TER - PAD)) / 5;
    b.span(-14, y, 24 + i * 0.36, 2, y + (TER - PAD) / 5, 26.2, M.stoneTrim, {
      surface: 'concrete', flags: BF.NO_COVER,
    });
  }
  b.wedge(20, PAD + 0.45, 6, 5.5, 0.45, 6, M.concreteRaw, { surface: 'concrete', yaw: -Math.PI / 2, flags: BF.NO_COVER });

  // =========================================================================
  // Perimeter wall
  // =========================================================================
  const GATE_W = 7.2;
  const SERVICE_GATE_W = 5.0;
  const perimeterOpts = {
    y: PAD, height: WALL_H, thickness: 0.4, mat: M.plasterOchre,
    surface: 'concrete' as const,
    coping: { mat: M.terracottaOld, height: 0.22, overhang: 0.14 },
    pilaster: { every: 9, mat: M.plasterCream, width: 0.7, depth: 0.16, extra: 0.34 },
    jitter: 0.06,
  };
  const gateIds = b.wall({
    ...perimeterOpts, x0: PERIM.x0, z0: PERIM.z1, x1: PERIM.x1, z1: PERIM.z1,
    openings: [
      doorOp(78 - GATE_W / 2, GATE_W, 'Main gate', -1, -1, 'gate', { height: 2.8 }),
      winOp(78 + 30, 1.2, 1.6, 2.4),
    ],
  });
  const serviceGateIds = b.wall({
    ...perimeterOpts, x0: PERIM.x1, z0: PERIM.z1, x1: PERIM.x1, z1: PERIM.z0,
    openings: [doorOp(74 + 30, SERVICE_GATE_W, 'Service gate', -1, -1, 'gate', { height: 2.6 })],
  });
  b.wall({ ...perimeterOpts, x0: PERIM.x1, z0: PERIM.z0, x1: PERIM.x0, z1: PERIM.z0 });
  // West wall: lower by the pool garden (the climbable flank) and pierced by a
  // storm drain culvert at the north end.
  b.wall({
    ...perimeterOpts, x0: PERIM.x0, z0: PERIM.z0, x1: PERIM.x0, z1: 26,
    openings: [{ at: 84, width: 1.6, y0: 0, y1: 1.5, kind: 'hole' }],
  });
  b.wall({ ...perimeterOpts, x0: PERIM.x0, z0: 26, x1: PERIM.x0, z1: 44, height: 1.9 });
  b.wall({ ...perimeterOpts, x0: PERIM.x0, z0: 44, x1: PERIM.x0, z1: PERIM.z1 });
  // Culvert mouth outside the wall.
  b.span(PERIM.x0 - 5, PAD - 1.6, 24.6, PERIM.x0 + 0.4, PAD + 1.6, 27.4, M.concreteDark, { surface: 'concrete' });
  b.span(PERIM.x0 - 4.6, PAD - 0.05, 25.0, PERIM.x0 + 1.6, PAD + 1.55, 27.0, M.dirtMat, {
    surface: 'dirt', flags: BF.INVISIBLE | BF.NO_COVER,
  });

  // Razor wire suggestion along the top of the long runs.
  for (let x = PERIM.x0 + 3; x < PERIM.x1; x += 6) {
    b.cyl(x, PAD + WALL_H + 0.5, PERIM.z1, 0.22, 0.05, M.steelGalv, {
      surface: 'metal', flags: BF.NO_COVER | BF.NO_NAV | BF.THIN | BF.NO_SHADOW,
    });
  }

  // =========================================================================
  // Main house
  // =========================================================================
  const houseId = b.building('Main house');
  const { rooms: houseRooms, doorIds: houseDoors } = buildMainHouse(b, p, rng, houseId);
  b.endBuilding();

  // =========================================================================
  // Gatehouse
  // =========================================================================
  const gateHouseId = b.building('Gatehouse');
  const gh = { x0: 7, x1: 17, z0: 64, z1: 72 };
  const ghRoom = b.room({
    name: 'Gatehouse', tag: 'guard', indoors: true, buildingId: gateHouseId,
    minX: gh.x0, maxX: gh.x1, minZ: gh.z0, maxZ: gh.z1, minY: PAD, maxY: PAD + 3.1,
  });
  b.inRoom(ghRoom, () => {
    b.slab(gh.x0, gh.z0, gh.x1, gh.z1, PAD + 0.12, 0.3, M.tileTerra, { surface: 'tile' });
    const wo = { y: PAD, height: 3.1, thickness: W_EXT, mat: M.plasterCream, jitter: 0.05, room: ghRoom };
    b.wall({ ...wo, x0: gh.x0, z0: gh.z1, x1: gh.x1, z1: gh.z1, openings: [winOp(5, 2.6, 1.0, 2.2)] });
    b.wall({ ...wo, x0: gh.x1, z0: gh.z1, x1: gh.x1, z1: gh.z0, openings: [winOp(4, 1.4)] });
    b.wall({ ...wo, x0: gh.x1, z0: gh.z0, x1: gh.x0, z1: gh.z0, openings: [winOp(3, 1.4)] });
    b.wall({
      ...wo, x0: gh.x0, z0: gh.z0, x1: gh.x0, z1: gh.z1,
      openings: [doorOp(4, 1.0, 'Gatehouse door', ghRoom, -1, 'metal')],
    });
    b.flatRoof(gh.x0, gh.z0, gh.x1, gh.z1, PAD + 3.1, 1.0, M.concreteRaw, M.plasterCream);
    p.desk(gh.x0 + 2.2, PAD + 0.12, gh.z1 - 1.4, Math.PI);
    p.chair(gh.x0 + 2.2, PAD + 0.12, gh.z1 - 2.4, 0);
    p.shelf(gh.x1 - 0.5, PAD + 0.12, gh.z0 + 2.4, Math.PI / 2, 1.6, 1.8);
    p.pendant(gh.x0 + 5, PAD + 3.0, gh.z0 + 4);
    p.sconce(gh.x0 + 0.3, PAD + 2.2, gh.z0 + 4, -Math.PI / 2);
  });
  b.ladder(gh.x1 - 1.2, gh.z0 - 0.5, Math.PI / 2, PAD, PAD + 3.4);
  p.sandbags(gh.x0 + 0.5, gh.z0 - 0.1, gh.x1 - 0.5, gh.z0 - 0.1, PAD + 3.36, 3);
  p.floodlight(gh.x0 - 1.2, PAD, gh.z1 - 1, Math.PI, 5.0);
  b.endBuilding();

  // Gate furniture: barrier arm, road spikes, guard hut lamp.
  b.box(4.4, PAD + 1.0, 71.5, 0.12, 0.12, 4.2, M.paintRed, { surface: 'metal', flags: BF.NO_COVER });
  b.cyl(4.4, PAD + 0.6, 71.5, 0.16, 0.6, M.steelGalv, { surface: 'metal' });
  p.jerseyBarrier(-9, PAD, 66, 0, 3.4);
  p.jerseyBarrier(9, PAD, 60, 0, 3.4);
  p.streetLamp(-9, PAD, 50);
  p.streetLamp(9, PAD, 34);

  // =========================================================================
  // Guest casitas
  // =========================================================================
  const casitaRooms: number[] = [];
  const casitaDoors: number[] = [];
  for (const [ci, base] of [{ x0: 26, z0: -6 }, { x0: 26, z0: 18 }].entries()) {
    const id = b.building(`Guest casita ${ci === 0 ? 'A' : 'B'}`);
    const r = buildCasita(b, p, rng, id, base.x0, base.z0, ci);
    casitaRooms.push(...r.rooms);
    casitaDoors.push(...r.doorIds);
    b.endBuilding();
  }

  // =========================================================================
  // Staff block (long service building on the north wall)
  // =========================================================================
  const staffId = b.building('Staff block');
  const staff = buildStaffBlock(b, p, rng, staffId);
  b.endBuilding();

  // =========================================================================
  // Workshop / vehicle shed
  // =========================================================================
  const shopId = b.building('Workshop');
  const shop = buildWorkshop(b, p, rng, shopId);
  b.endBuilding();

  // =========================================================================
  // Pool terrace
  // =========================================================================
  const poolId = b.building('Pool house');
  const pool = buildPoolTerrace(b, p, rng, poolId);
  b.endBuilding();

  // =========================================================================
  // Chapel / narco shrine
  // =========================================================================
  const chapelId = b.building('Shrine');
  const chapelRoom = b.room({
    name: 'Shrine', tag: 'shrine', indoors: true, buildingId: chapelId,
    minX: 30, maxX: 37, minZ: 46, maxZ: 53, minY: PAD, maxY: PAD + 3.4,
  });
  b.inRoom(chapelRoom, () => {
    b.slab(30, 46, 37, 53, PAD + 0.14, 0.3, M.tileTalavera, { surface: 'tile' });
    const wo = { y: PAD, height: 3.4, thickness: 0.3, mat: M.plasterWhite, jitter: 0.04, room: chapelRoom };
    b.wall({ ...wo, x0: 30, z0: 53, x1: 37, z1: 53, openings: [archOp(3.5, 1.6, 2.5)] });
    b.wall({ ...wo, x0: 37, z0: 53, x1: 37, z1: 46, openings: [winOp(3.5, 0.8, 1.4, 2.6)] });
    b.wall({ ...wo, x0: 37, z0: 46, x1: 30, z1: 46 });
    b.wall({ ...wo, x0: 30, z0: 46, x1: 30, z1: 53, openings: [winOp(3.5, 0.8, 1.4, 2.6)] });
    b.gableRoof(30, 46, 37, 53, PAD + 3.4, 1.6, M.terracotta, 0.5);
    // Altar and candles.
    b.span(31.6, PAD + 0.14, 46.6, 35.4, PAD + 1.05, 47.6, M.stoneTrim, { surface: 'concrete' });
    for (let i = 0; i < 9; i++) {
      b.cyl(31.9 + i * 0.42, PAD + 1.18, 47.1, 0.07, 0.13, M.lampWarm, {
        surface: 'glass', flags: BF.NO_COVER | BF.NO_SHADOW | BF.NO_NAV,
      });
    }
    b.box(33.5, PAD + 2.1, 46.3, 0.5, 0.7, 0.12, M.brass, { surface: 'metal', flags: BF.NO_COVER | BF.NO_NAV });
  });
  b.cyl(33.5, PAD + 5.6, 49.5, 0.16, 0.9, M.brass, { surface: 'metal', flags: BF.NO_COVER | BF.NO_NAV });
  b.endBuilding();

  // =========================================================================
  // Watchtowers
  // =========================================================================
  const towers: Array<[number, number, number]> = [
    [PERIM.x0 + 6, PERIM.z1 - 6, Math.PI * 0.25],
    [PERIM.x1 - 6, PERIM.z0 + 6, Math.PI * 1.25],
  ];
  const towerRooms: number[] = [];
  for (const [tx, tz, tyaw] of towers) {
    const tid = b.building('Watchtower');
    const top = PAD + 6.4;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      b.box(tx + sx * 1.5, PAD + 3.2, tz + sz * 1.5, 0.22, 3.2, 0.22, M.concreteRaw, {
        surface: 'concrete', tint: b.jitterTint(0.05),
      });
    }
    // Cross bracing so it reads as a structure, not four sticks.
    for (const s of [-1, 1]) {
      b.box(tx + s * 1.5, PAD + 3.2, tz, 0.1, 0.1, 1.5, M.concreteRaw, { surface: 'concrete', flags: BF.NO_COVER | BF.NO_NAV });
      b.box(tx, PAD + 3.2, tz + s * 1.5, 1.5, 0.1, 0.1, M.concreteRaw, { surface: 'concrete', flags: BF.NO_COVER | BF.NO_NAV });
    }
    const troom = b.room({
      name: 'Watchtower platform', tag: 'tower', indoors: false, buildingId: tid,
      minX: tx - 2, maxX: tx + 2, minZ: tz - 2, maxZ: tz + 2, minY: top, maxY: top + 2.6,
    });
    towerRooms.push(troom);
    b.span(tx - 2, top - 0.24, tz - 2, tx + 2, top, tz + 2, M.woodWeathered, { surface: 'wood', flags: BF.NO_COVER, room: troom });
    for (const [ax, az, bx, bz] of [
      [tx - 2, tz - 2, tx + 2, tz - 2], [tx - 2, tz + 2, tx + 2, tz + 2],
      [tx - 2, tz - 2, tx - 2, tz + 2], [tx + 2, tz - 2, tx + 2, tz + 2],
    ] as Array<[number, number, number, number]>) {
      b.wall({ x0: ax, z0: az, x1: bx, z1: bz, y: top, height: 1.05, thickness: 0.14, mat: M.woodWeathered, surface: 'wood', jitter: 0.08, room: troom });
    }
    // Corrugated canopy on posts.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      b.box(tx + sx * 1.85, top + 1.35, tz + sz * 1.85, 0.07, 1.35, 0.07, M.woodWeathered, { surface: 'wood', flags: BF.NO_COVER, room: troom });
    }
    b.span(tx - 2.3, top + 2.7, tz - 2.3, tx + 2.3, top + 2.86, tz + 2.3, M.corrugated, { surface: 'metal', flags: BF.NO_COVER, room: troom });
    b.ladder(tx + Math.cos(tyaw) * 2.1, tz + Math.sin(tyaw) * 2.1, -tyaw, PAD, top);
    p.sandbags(tx - 1.8, tz - 2.1, tx + 1.8, tz - 2.1, top, 2);
    p.floodlight(tx, top, tz + 1.6, 0, 1.6);
    b.endBuilding();
  }

  // =========================================================================
  // Helipad
  // =========================================================================
  b.cyl(-56, PAD + 0.07, -40, 9, 0.09, M.concreteRaw, { surface: 'concrete', flags: BF.NO_COVER });
  b.cyl(-56, PAD + 0.13, -40, 7.4, 0.04, M.plasterWhite, { surface: 'concrete', flags: BF.NO_COVER | BF.NO_NAV });
  b.cyl(-56, PAD + 0.15, -40, 7.0, 0.04, M.concreteRaw, { surface: 'concrete', flags: BF.NO_COVER | BF.NO_NAV });
  b.span(-58.4, PAD + 0.15, -44, -57.4, PAD + 0.2, -36, M.plasterWhite, { surface: 'concrete', flags: BF.NO_COVER | BF.NO_NAV });
  b.span(-54.6, PAD + 0.15, -44, -53.6, PAD + 0.2, -36, M.plasterWhite, { surface: 'concrete', flags: BF.NO_COVER | BF.NO_NAV });
  b.span(-57.4, PAD + 0.15, -40.5, -54.6, PAD + 0.2, -39.5, M.plasterWhite, { surface: 'concrete', flags: BF.NO_COVER | BF.NO_NAV });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.cyl(-56 + Math.cos(a) * 9.4, PAD + 0.16, -40 + Math.sin(a) * 9.4, 0.1, 0.16, M.lampCold, {
      surface: 'glass', flags: BF.NO_COVER | BF.NO_SHADOW,
    });
  }

  // =========================================================================
  // Landscaping and courtyard dressing
  // =========================================================================
  p.fountain(-6, TER, 30, 2.6);
  for (const [hx0, hz0, hx1, hz1] of [
    [-24, 44, 12, 44], [-24, 56, 12, 56], [-24, 44, -24, 56], [12, 44, 12, 56],
  ] as Array<[number, number, number, number]>) {
    p.hedge(hx0, hz0, hx1, hz1, PAD, 1.15, 0.9);
  }
  // Ornamental garden south-west: hedge rows that break the sightline from the
  // gate to the pool flank, so the west approach is genuinely usable.
  for (let i = 0; i < 5; i++) {
    p.hedge(-72 + i * 2, 30 + i * 8, -34, 30 + i * 8, PAD, 1.3, 0.9);
  }
  for (let i = 0; i < 16; i++) {
    const a = rng.range(0, Math.PI * 2);
    const rad = rng.range(20, 34);
    p.palm(-6 + Math.cos(a) * rad, PAD, 30 + Math.sin(a) * rad * 0.7, rng.range(6, 9.5));
  }
  for (let i = 0; i < 10; i++) p.cypress(rng.range(-74, -30), PAD, rng.range(46, 70), rng.range(5, 8));
  for (let i = 0; i < 6; i++) p.shadeTree(rng.range(16, 60), PAD, rng.range(38, 68), rng.range(6.5, 9));
  for (const [px, pz] of [[-14, 26], [2, 26], [-14, 34], [2, 34], [18, 20], [18, 8]] as Array<[number, number]>) {
    p.planter(px, TER, pz, 0.6);
  }

  // Motor court: the boss's convoy.
  p.suv(-18, PAD, 22, 0.1, M.concreteDark);
  p.suv(-13, PAD, 22, 0.06, M.steelDark);
  p.pickup(-6, PAD, 21.5, 0.02, M.plasterWhite);
  p.sedan(2, PAD, 22, -0.05);
  p.pickup(20, PAD, -30, Math.PI / 2, M.rust);

  // =========================================================================
  // Site record
  // =========================================================================
  const allRooms = [
    ...houseRooms, ghRoom, ...casitaRooms, ...staff.rooms, ...shop.rooms,
    ...pool.rooms, chapelRoom, ...towerRooms,
  ];
  const allDoors = [
    ...gateIds, ...serviceGateIds, ...houseDoors, ...casitaDoors,
    ...staff.doorIds, ...shop.doorIds, ...pool.doorIds,
  ];

  const site: SiteInstance = {
    id: 'casa-verdugo',
    name: 'Casa Verdugo',
    archetype: 'villa',
    x: 0, z: 0, padY: PAD,
    minX: PERIM.x0 - 40, maxX: PERIM.x1 + 40,
    minZ: PERIM.z0 - 40, maxZ: PERIM.z1 + 40,
    coreMinX: PERIM.x0 - 12, coreMaxX: PERIM.x1 + 12,
    coreMinZ: PERIM.z0 - 12, coreMaxZ: PERIM.z1 + 14,
    minY: PAD - 3, maxY: ROOF + 6,
    roomIds: allRooms,
    doorIds: allDoors,
    buildingCount: b.buildingNames.length,
    approaches: [
      {
        id: 'front-gate', name: 'Main gate', kind: 'front',
        x: 0, y: PAD, z: PERIM.z1 + 34, toX: 0, toZ: PERIM.z1,
        description: 'Straight up the access road. Two guns on the gatehouse roof and a clear field of fire down the drive.',
        stealth: 0.05, speed: 0.9, risk: 0.85,
      },
      {
        id: 'storm-drain', name: 'Storm drain', kind: 'drainage',
        x: PERIM.x0 - 14, y: PAD, z: 26, toX: PERIM.x0 + 4, toZ: 26,
        description: 'A culvert punches the west wall below the garden terrace. Prone crawl, comes up inside the hedge rows.',
        stealth: 0.9, speed: 0.25, risk: 0.2,
      },
      {
        id: 'pool-flank', name: 'Garden wall', kind: 'flank',
        x: PERIM.x0 - 8, y: PAD, z: 35, toX: -40, toZ: 20,
        description: 'The wall drops to 1.9 m along the ornamental garden. Over it and you are on the pool terrace, behind the house guns.',
        stealth: 0.6, speed: 0.6, risk: 0.4,
      },
      {
        id: 'service-gate', name: 'Service gate', kind: 'flank',
        x: PERIM.x1 + 22, y: PAD, z: -30, toX: PERIM.x1, toZ: -30,
        description: 'Delivery gate on the east wall. Opens onto the vehicle yard and the workshop, well away from the house.',
        stealth: 0.45, speed: 0.7, risk: 0.5,
      },
      {
        id: 'north-ridge', name: 'North ridge', kind: 'roof',
        x: -10, y: PAD + 6, z: PERIM.z0 - 26, toX: -10, toZ: -50,
        description: 'The hillside behind the estate overlooks the staff block. Drop onto its roof and the service alley is yours.',
        stealth: 0.75, speed: 0.4, risk: 0.35,
      },
    ],
    landmarks: [
      { name: 'Main house', x: -7, y: ROOF, z: 1, prominence: 90 },
      { name: 'Gatehouse', x: 12, y: PAD + 3, z: 68, prominence: 45 },
      { name: 'Water tower', x: -56, y: PAD + 12, z: -20, prominence: 60 },
      { name: 'Shrine', x: 33.5, y: PAD + 6, z: 49.5, prominence: 30 },
      { name: 'Helipad', x: -56, y: PAD, z: -40, prominence: 40 },
    ],
    garrison: [
      { x: 2, y: PAD, z: 70, role: 'gate-guard' },
      { x: 12, y: PAD + 3.4, z: 66, role: 'overwatch' },
      { x: -10, y: PAD, z: 40, role: 'patrol' },
      { x: -6, y: TER, z: 26, role: 'patrol' },
      { x: -4, y: GF, z: 9, role: 'sentry' },
      { x: -15, y: GF, z: 7, role: 'idle' },
      { x: -7, y: GF, z: -4, role: 'idle' },
      { x: -17, y: FF, z: -4, role: 'hvt-guard' },
      { x: 4, y: FF, z: 7, role: 'hvt' },
      { x: -1, y: ROOF, z: 6, role: 'overwatch' },
      { x: -40, y: TER, z: 10, role: 'patrol' },
      { x: -10, y: PAD, z: -48, role: 'idle' },
      { x: -22, y: PAD, z: -56, role: 'patrol' },
      { x: 42, y: PAD, z: -32, role: 'idle' },
      { x: 35, y: PAD, z: 2, role: 'idle' },
      { x: 35, y: PAD, z: 24, role: 'idle' },
      { x: PERIM.x0 + 6, y: PAD + 6.4, z: PERIM.z1 - 6, role: 'overwatch' },
      { x: PERIM.x1 - 6, y: PAD + 6.4, z: PERIM.z0 + 6, role: 'overwatch' },
    ],
  };

  return { site, rooms: b.rooms, navLinks: b.navLinks };
}

// ===========================================================================
// Main house
// ===========================================================================

function buildMainHouse(
  b: SiteBuilder, p: Props, rng: Rng, buildingId: number,
): { rooms: number[]; doorIds: number[] } {
  const { x0, x1, z0, z1 } = HOUSE;
  const ix0 = x0 + W_EXT, ix1 = x1 - W_EXT, iz0 = z0 + W_EXT, iz1 = z1 - W_EXT;
  const CORR0 = 1.2, CORR1 = 3.6;
  const doorIds: number[] = [];
  const rooms: number[] = [];

  const mkRoom = (
    name: string, tag: string, minX: number, minZ: number, maxX: number, maxZ: number,
    floor: number, height: number,
  ): number => {
    const id = b.room({
      name, tag, indoors: true, buildingId,
      minX, maxX, minZ, maxZ, minY: floor, maxY: floor + height,
    });
    rooms.push(id);
    return id;
  };

  // --- ground floor rooms --------------------------------------------------
  const rDining = mkRoom('Dining room', 'dining', ix0, iz0, -12.0, CORR0, GF, 3.4);
  const rKitchen = mkRoom('Kitchen', 'kitchen', -11.8, iz0, -3.5, CORR0, GF, 3.4);
  const rStair = mkRoom('Stair hall', 'stairwell', -3.3, iz0, 2.0, CORR0, GF, 3.4);
  const rStudy = mkRoom('Study', 'office', 2.2, iz0, ix1, CORR0, GF, 3.4);
  const rCorr = mkRoom('Ground corridor', 'corridor', ix0, CORR0, ix1, CORR1, GF, 3.4);
  const rSalon = mkRoom('Grand salon', 'living', ix0, CORR1, -8.0, iz1, GF, 3.4);
  const rEntry = mkRoom('Entry hall', 'entry', -7.8, CORR1, 0.0, iz1, GF, 3.4);
  const rGuard = mkRoom('Guard room', 'guard', 0.2, CORR1, ix1, iz1, GF, 3.4);

  // --- first floor rooms ---------------------------------------------------
  const rMaster = mkRoom('Master bedroom', 'bedroom', ix0, iz0, -12.0, CORR0, FF, 3.2);
  const rEnsuite = mkRoom('Ensuite', 'bathroom', -11.8, iz0, -7.6, CORR0, FF, 3.2);
  const rBed2 = mkRoom('Bedroom 2', 'bedroom', -7.4, iz0, -3.5, CORR0, FF, 3.2);
  const rLanding = mkRoom('Landing', 'stairwell', -3.3, iz0, 2.0, CORR0, FF, 3.2);
  const rBed3 = mkRoom('Bedroom 3', 'bedroom', 2.2, iz0, ix1, CORR0, FF, 3.2);
  const rCorr2 = mkRoom('Upper corridor', 'corridor', ix0, CORR0, ix1, CORR1, FF, 3.2);
  const rLounge = mkRoom('Master lounge', 'living', ix0, CORR1, -13.0, iz1, FF, 3.2);
  const rBath = mkRoom('Bathroom', 'bathroom', -12.8, CORR1, -8.6, iz1, FF, 3.2);
  const rBed4 = mkRoom('Bedroom 4', 'bedroom', -8.4, CORR1, -1.0, iz1, FF, 3.2);
  const rSafe = mkRoom('Office', 'hvt', -0.8, CORR1, ix1, iz1, FF, 3.2);
  const rRoof = b.room({
    name: 'Roof terrace', tag: 'roof', indoors: false, buildingId,
    minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: ROOF, maxY: ROOF + 2.4,
  });
  rooms.push(rRoof);

  // --- slabs ---------------------------------------------------------------
  const STAIR_HOLE: [number, number, number, number] = [-3.3, -6.9, -1.0, CORR0];
  const ROOF_HOLE: [number, number, number, number] = [-0.1, -7.1, 2.0, -1.0];

  b.slab(x0, z0, x1, z1, GF, 0.5, M.marble, { surface: 'tile' });
  b.slab(x0, z0, x1, z1, FF, 0.34, M.woodWarm, { surface: 'wood', holes: [STAIR_HOLE] });
  b.flatRoof(x0, z0, x1, z1, ROOF, 1.05, M.concreteRaw, M.plasterCream, { holes: [ROOF_HOLE], room: rRoof });

  // --- exterior walls ------------------------------------------------------
  const extGF = { y: GF, height: 3.4, thickness: W_EXT, mat: M.plasterCream, jitter: 0.05 };
  const extFF = { y: FF, height: 3.2, thickness: W_EXT, mat: M.plasterCream, jitter: 0.05 };

  // South face (z1) — the public face, seen from the courtyard.
  doorIds.push(...b.wall({
    ...extGF, x0: x0, z0: z1, x1: x1, z1: z1,
    openings: [
      winOp(3.0, 2.4, 0.7, 2.5), winOp(8.0, 2.4, 0.7, 2.5),
      doorOp(16.0, 1.9, 'Front door', rEntry, -1, 'reinforced', { hinge: -1 }),
      winOp(20.5, 1.6), winOp(26.0, 1.6),
    ],
  }));
  doorIds.push(...b.wall({
    ...extFF, x0: x0, z0: z1, x1: x1, z1: z1,
    openings: [
      winOp(3.0, 1.6), winOp(7.0, 1.6),
      doorOp(15.0, 1.7, 'Balcony doors', rBed4, -1, 'glass', { hinge: -1 }),
      winOp(24.0, 1.6), winOp(28.0, 1.6),
    ],
  }));
  // North face (z0) — service side.
  doorIds.push(...b.wall({
    ...extGF, x0: x1, z0: z0, x1: x0, z1: z0,
    openings: [
      winOp(3.0, 1.4), winOp(7.5, 1.2, 1.3, 2.3),
      doorOp(15.0, 1.0, 'Kitchen service door', rKitchen, -1, 'wood'),
      winOp(19.0, 1.6), winOp(25.5, 2.0),
    ],
  }));
  b.wall({
    ...extFF, x0: x1, z0: z0, x1: x0, z1: z0,
    openings: [winOp(4.0, 1.4), winOp(9.0, 1.2), winOp(15.0, 1.2), winOp(21.0, 1.6), winOp(26.0, 1.6)],
  });
  // West face (x0) — opens onto the pool terrace.
  doorIds.push(...b.wall({
    ...extGF, x0: x0, z0: z0, x1: x0, z1: z1,
    openings: [
      winOp(4.0, 1.8), winOp(9.0, 1.4),
      doorOp(17.5, 2.0, 'Salon terrace doors', rSalon, -1, 'glass', { hinge: -1 }),
      winOp(20.6, 1.6, 0.7, 2.5),
    ],
  }));
  b.wall({
    ...extFF, x0: x0, z0: z0, x1: x0, z1: z1,
    openings: [winOp(4.0, 1.6), winOp(10.0, 1.4), winOp(16.5, 2.2, 0.55, 2.4), winOp(19.5, 1.4)],
  });
  // East face (x1).
  b.wall({
    ...extGF, x0: x1, z0: z1, x1: x1, z1: z0,
    openings: [winOp(4.0, 1.6), winOp(9.0, 1.4), winOp(15.0, 1.2, 1.4, 2.3), winOp(19.0, 1.2, 1.4, 2.3)],
  });
  b.wall({
    ...extFF, x0: x1, z0: z1, x1: x1, z1: z0,
    openings: [winOp(4.0, 1.6), winOp(10.0, 1.6), winOp(16.0, 1.4), winOp(20.0, 1.4)],
  });

  // Window bars on the ground-floor service side — a cartel house is a fortress.
  for (const [bx, bz, byaw] of [[-7, z0, 0], [-11.5, z0, 0], [x1, -4, Math.PI / 2], [x1, -8, Math.PI / 2]] as Array<[number, number, number]>) {
    for (let i = -2; i <= 2; i++) {
      b.box(bx + Math.cos(byaw) * i * 0.28, GF + 1.65, bz - Math.sin(byaw) * i * 0.28, 0.025, 0.7, 0.025, M.steelDark, {
        yaw: byaw, surface: 'metal', flags: BF.NO_COVER | BF.NO_NAV | BF.THIN,
      });
    }
  }

  // --- interior partitions, ground floor -----------------------------------
  const intGF = { y: GF, height: 3.4, thickness: W_INT, mat: M.drywall, surface: 'drywall' as const, jitter: 0.03 };
  // Corridor north wall (rooms on the north band open onto it).
  doorIds.push(...b.wall({
    ...intGF, x0: ix0, z0: CORR0, x1: ix1, z1: CORR0,
    openings: [
      doorOp(4.0, 1.0, 'Dining door', rDining, rCorr, 'wood', { open: true }),
      doorOp(14.0, 0.95, 'Kitchen door', rKitchen, rCorr, 'wood'),
      archOp(20.0, 2.2),
      doorOp(26.5, 1.0, 'Study door', rStudy, rCorr, 'reinforced', { locked: true }),
    ],
  }));
  // Corridor south wall.
  doorIds.push(...b.wall({
    ...intGF, x0: ix0, z0: CORR1, x1: ix1, z1: CORR1,
    openings: [
      archOp(6.0, 2.6), archOp(15.5, 2.4),
      doorOp(24.0, 1.0, 'Guard room door', rGuard, rCorr, 'wood'),
    ],
  }));
  // North band partitions.
  b.wall({ ...intGF, x0: -12.0, z0: iz0, x1: -12.0, z1: CORR0, openings: [doorOp(5.0, 1.0, 'Pantry door', rKitchen, rDining, 'wood', { open: true })] });
  b.wall({ ...intGF, x0: -3.4, z0: iz0, x1: -3.4, z1: CORR0, openings: [archOp(8.0, 1.4, 2.3)] });
  b.wall({ ...intGF, x0: 2.1, z0: iz0, x1: 2.1, z1: CORR0 });
  // South band partitions.
  b.wall({ ...intGF, x0: -7.9, z0: CORR1, x1: -7.9, z1: iz1, openings: [archOp(4.0, 2.6, 2.6)] });
  b.wall({ ...intGF, x0: 0.1, z0: CORR1, x1: 0.1, z1: iz1, openings: [doorOp(5.0, 0.95, 'Guard room side door', rGuard, rEntry, 'wood')] });

  // --- interior partitions, first floor ------------------------------------
  const intFF = { y: FF, height: 3.2, thickness: W_INT, mat: M.drywall, surface: 'drywall' as const, jitter: 0.03 };
  doorIds.push(...b.wall({
    ...intFF, x0: ix0, z0: CORR0, x1: ix1, z1: CORR0,
    openings: [
      doorOp(5.0, 1.0, 'Master bedroom door', rMaster, rCorr2, 'wood'),
      doorOp(12.0, 0.9, 'Ensuite door', rEnsuite, rCorr2, 'wood'),
      doorOp(16.5, 0.95, 'Bedroom 2 door', rBed2, rCorr2, 'wood'),
      archOp(21.5, 2.0),
      doorOp(26.5, 0.95, 'Bedroom 3 door', rBed3, rCorr2, 'wood'),
    ],
  }));
  doorIds.push(...b.wall({
    ...intFF, x0: ix0, z0: CORR1, x1: ix1, z1: CORR1,
    openings: [
      doorOp(4.5, 1.0, 'Master lounge door', rLounge, rCorr2, 'wood', { open: true }),
      doorOp(11.0, 0.9, 'Bathroom door', rBath, rCorr2, 'wood'),
      doorOp(17.0, 0.95, 'Bedroom 4 door', rBed4, rCorr2, 'wood'),
      doorOp(25.0, 1.0, 'Office door', rSafe, rCorr2, 'reinforced', { locked: true }),
    ],
  }));
  b.wall({ ...intFF, x0: -12.0, z0: iz0, x1: -12.0, z1: CORR0 });
  b.wall({ ...intFF, x0: -7.5, z0: iz0, x1: -7.5, z1: CORR0 });
  b.wall({ ...intFF, x0: -3.4, z0: iz0, x1: -3.4, z1: CORR0, openings: [archOp(8.0, 1.6, 2.3)] });
  b.wall({ ...intFF, x0: 2.1, z0: iz0, x1: 2.1, z1: CORR0 });
  b.wall({ ...intFF, x0: -13.0, z0: CORR1, x1: -13.0, z1: iz1 });
  b.wall({ ...intFF, x0: -8.5, z0: CORR1, x1: -8.5, z1: iz1 });
  b.wall({ ...intFF, x0: -0.9, z0: CORR1, x1: -0.9, z1: iz1 });

  // --- stairs --------------------------------------------------------------
  b.stairs({
    x: -2.15, z: CORR0 - 0.2, dirX: 0, dirZ: -1, width: 1.9,
    fromY: GF, toY: FF, run: 6.4, mat: M.marble, surface: 'tile', railMat: M.brass, room: rStair,
  });
  b.stairs({
    x: 0.95, z: -6.9, dirX: 0, dirZ: 1, width: 1.7,
    fromY: FF, toY: ROOF, run: 5.6, mat: M.concreteRaw, surface: 'concrete', railMat: M.steelGalv, room: rLanding,
  });
  // Landing balustrade around the stair void.
  for (const [ax, az, bx2, bz2] of [
    [-3.3, CORR0, -1.0, CORR0], [-1.0, -6.9, -1.0, CORR0],
  ] as Array<[number, number, number, number]>) {
    b.wall({ x0: ax, z0: az, x1: bx2, z1: bz2, y: FF, height: 1.0, thickness: 0.1, mat: M.brass, surface: 'metal', room: rLanding, jitter: 0 });
  }

  // --- roof penthouse ------------------------------------------------------
  const pent = { x0: -0.5, x1: 2.6, z0: -7.6, z1: -0.6 };
  const rPent = b.room({
    name: 'Roof stairhead', tag: 'stairwell', indoors: true, buildingId,
    minX: pent.x0, maxX: pent.x1, minZ: pent.z0, maxZ: pent.z1, minY: ROOF, maxY: ROOF + 2.5,
  });
  rooms.push(rPent);
  const pw = { y: ROOF, height: 2.5, thickness: 0.24, mat: M.plasterCream, jitter: 0.04, room: rPent };
  b.wall({ ...pw, x0: pent.x0, z0: pent.z0, x1: pent.x1, z1: pent.z0 });
  b.wall({ ...pw, x0: pent.x1, z0: pent.z0, x1: pent.x1, z1: pent.z1 });
  doorIds.push(...b.wall({
    ...pw, x0: pent.x1, z0: pent.z1, x1: pent.x0, z1: pent.z1,
    openings: [doorOp(1.6, 1.0, 'Roof access door', rPent, rRoof, 'metal')],
  }));
  b.wall({ ...pw, x0: pent.x0, z0: pent.z1, x1: pent.x0, z1: pent.z0 });
  b.span(pent.x0 - 0.2, ROOF + 2.5, pent.z0 - 0.2, pent.x1 + 0.2, ROOF + 2.68, pent.z1 + 0.2, M.concreteRaw, {
    surface: 'concrete', flags: BF.NO_COVER,
  });

  // --- entry portico + balcony --------------------------------------------
  const por = { x0: -9.5, x1: 0.5, z0: z1, z1: z1 + 3.6 };
  for (const px of [por.x0 + 0.5, por.x1 - 0.5]) {
    b.cyl(px, GF + 1.7, por.z1 - 0.6, 0.34, 1.7, M.plasterWhite, { surface: 'concrete', tint: b.jitterTint(0.03) });
    b.cyl(px, GF + 3.48, por.z1 - 0.6, 0.44, 0.12, M.stoneTrim, { surface: 'concrete', flags: BF.NO_COVER });
  }
  b.span(por.x0, GF + 3.4, por.z0, por.x1, GF + 3.66, por.z1, M.concreteRaw, { surface: 'concrete', flags: BF.NO_COVER });
  // Balcony deck + balustrade on top of the portico.
  b.span(por.x0, FF - 0.28, por.z0, por.x1, FF, por.z1, M.tileTerra, { surface: 'tile', flags: BF.NO_COVER });
  for (const [ax, az, bx2, bz2] of [
    [por.x0, por.z1, por.x1, por.z1], [por.x0, por.z0, por.x0, por.z1], [por.x1, por.z0, por.x1, por.z1],
  ] as Array<[number, number, number, number]>) {
    b.wall({ x0: ax, z0: az, x1: bx2, z1: bz2, y: FF, height: 0.55, thickness: 0.16, mat: M.plasterCream, jitter: 0.03 });
    // Balusters.
    const n = Math.max(2, Math.round(Math.hypot(bx2 - ax, bz2 - az) / 0.35));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      b.cyl(ax + (bx2 - ax) * t, FF + 0.85, az + (bz2 - az) * t, 0.07, 0.3, M.stoneTrim, {
        surface: 'concrete', flags: BF.NO_COVER | BF.NO_NAV,
      });
    }
    b.wall({ x0: ax, z0: az, x1: bx2, z1: bz2, y: FF + 1.15, height: 0.12, thickness: 0.22, mat: M.stoneTrim, jitter: 0 });
  }
  // Front steps up to the portico.
  for (let i = 0; i < 4; i++) {
    b.span(por.x0 + 1, GF - 0.9 + i * 0.225, por.z1 + (3 - i) * 0.36, por.x1 - 1, GF - 0.9 + (i + 1) * 0.225, por.z1 + 1.4, M.stoneTrim, {
      surface: 'concrete', flags: BF.NO_COVER,
    });
  }

  // =========================================================================
  // Furnishing — this is what makes the house clearable rather than empty.
  // =========================================================================
  b.inRoom(rSalon, () => {
    p.rug(-15, GF, 7.5, 0, 6.0, 4.2, M.fabricRed);
    p.sofa(-15, GF, 5.4, 0, 2.6);
    p.sofa(-15, GF, 9.6, Math.PI, 2.6);
    p.armchair(-18.6, GF, 7.5, Math.PI / 2);
    p.table(-15, GF, 7.5, 0, 1.5, 0.9, 0.42, M.woodDark);
    p.shelf(-21.2, GF, 5.0, Math.PI / 2, 2.4, 2.0);
    p.painting(-21.4, GF + 1.9, 9.5, Math.PI / 2, 1.4, 1.0);
    p.pendant(-15, GF + 3.3, 7.5);
    p.planter(-9.2, GF, 10.8, 0.5);
    p.planter(-9.2, GF, 4.6, 0.5);
    // Bar — cartel villa staple, and a hard corner to clear.
    p.counter(-21.4, 10.4, -17.0, 10.4, GF, M.woodDark);
  });
  b.inRoom(rEntry, () => {
    p.rug(-4, GF, 8.5, 0, 3.0, 3.0, M.fabricTeal);
    p.table(-6.6, GF, 5.2, 0, 1.1, 0.5, 0.8, M.woodDark);
    p.painting(-3.9, GF + 2.0, 3.7, 0, 1.6, 1.1);
    p.pendant(-4, GF + 3.3, 8.0);
    p.planter(-7.2, GF, 10.9, 0.45);
    p.planter(-0.7, GF, 10.9, 0.45);
  });
  b.inRoom(rGuard, () => {
    p.table(4, GF, 7.5, 0, 1.6, 1.0, 0.75, M.woodWeathered);
    p.chair(2.9, GF, 7.5, -Math.PI / 2);
    p.chair(5.1, GF, 7.5, Math.PI / 2);
    p.sofa(6.6, GF, 5.0, Math.PI / 2, 1.8, M.fabricTeal);
    p.shelf(0.7, GF, 10.0, -Math.PI / 2, 1.6, 1.9);
    p.crate(6.8, GF, 10.6, 0.3, 0.45);
    p.pendant(4, GF + 3.3, 8);
  });
  b.inRoom(rDining, () => {
    p.rug(-16.5, GF, -4.0, 0, 5.0, 3.4);
    p.table(-16.5, GF, -4.0, 0, 3.0, 1.2, 0.76, M.woodDark);
    for (let i = 0; i < 3; i++) {
      p.chair(-18.0 + i * 1.5, GF, -5.1, 0);
      p.chair(-18.0 + i * 1.5, GF, -2.9, Math.PI);
    }
    p.counter(-21.4, -8.6, -16.0, -8.6, GF, M.woodWarm);
    p.pendant(-16.5, GF + 3.3, -4.0);
    p.painting(-21.4, GF + 1.9, -1.5, Math.PI / 2, 1.2, 0.9);
  });
  b.inRoom(rKitchen, () => {
    p.counter(-11.5, -9.2, -4.5, -9.2, GF, M.woodPale);
    p.counter(-11.5, 0.9, -7.5, 0.9, GF, M.woodPale);
    p.table(-8.0, GF, -4.5, 0, 2.2, 1.0, 0.92, M.marble);
    p.fridge(-4.2, GF, -8.3, Math.PI);
    p.stove(-6.4, GF, -9.1, Math.PI);
    p.crate(-10.6, GF, -3.0, 0.2, 0.4);
    p.pendant(-8.0, GF + 3.3, -4.5);
  });
  b.inRoom(rStudy, () => {
    p.desk(5.0, GF, -7.0, Math.PI);
    p.chair(5.0, GF, -5.6, 0);
    p.shelf(7.4, GF, -4.0, -Math.PI / 2, 2.4, 2.0);
    p.shelf(2.5, GF, -4.0, Math.PI / 2, 2.0, 2.0);
    // The safe: the reason the study door is reinforced.
    b.box(6.6, GF + 0.55, -9.0, 0.5, 0.55, 0.4, M.steelDark, { surface: 'metal' });
    b.box(6.6, GF + 0.55, -9.42, 0.42, 0.45, 0.03, M.brass, { surface: 'metal', flags: BF.NO_COVER });
    p.pendant(5.0, GF + 3.3, -5.0);
  });
  b.inRoom(rCorr, () => {
    for (const zz of [-1, 1]) void zz;
    for (const xx of [-18, -10, -2, 6]) p.sconce(xx, GF + 2.3, CORR0 + 0.12, Math.PI);
    p.rug(-8, GF, 2.4, 0, 20, 1.4, M.fabricRed);
  });
  b.inRoom(rStair, () => {
    p.painting(-3.15, GF + 2.1, -3.0, Math.PI / 2, 1.2, 1.6);
    p.planter(1.4, GF, 0.4, 0.45);
  });

  b.inRoom(rMaster, () => {
    p.bed(-16.5, FF, -5.5, 0, 2.0, 2.2);
    p.wardrobe(-21.2, FF, -2.0, Math.PI / 2, 2.4, 2.2);
    p.table(-13.2, FF, -8.6, 0, 0.6, 0.6, 0.55, M.woodDark);
    p.armchair(-13.0, FF, -1.0, Math.PI);
    p.rug(-16.5, FF, -2.6, 0, 4.0, 3.0, M.fabricTeal);
    p.pendant(-16.5, FF + 3.1, -4.5);
    p.painting(-16.5, FF + 2.0, -9.5, 0, 1.8, 1.1);
  });
  b.inRoom(rEnsuite, () => {
    p.toilet(-11.2, FF, -8.8, 0);
    p.basin(-9.6, FF, -9.4, 0);
    b.span(-11.6, FF, -4.6, -9.0, FF + 0.55, -2.4, M.plasticWhite, { surface: 'ceramic' });
    p.sconce(-8.0, FF + 2.1, -6.0, -Math.PI / 2);
  });
  b.inRoom(rBed2, () => {
    p.bed(-5.6, FF, -6.4, 0, 1.4, 2.0);
    p.wardrobe(-7.0, FF, -1.4, Math.PI / 2, 1.4, 2.0);
    p.pendant(-5.5, FF + 3.1, -4.0);
  });
  b.inRoom(rBed3, () => {
    p.bed(4.6, FF, -6.4, 0, 1.4, 2.0);
    p.desk(6.6, FF, -1.2, Math.PI);
    p.shelf(2.6, FF, -2.2, Math.PI / 2, 1.4, 1.7);
    p.pendant(4.8, FF + 3.1, -4.0);
  });
  b.inRoom(rLounge, () => {
    p.sofa(-17.5, FF, 5.6, 0, 2.4, M.leather);
    p.table(-17.5, FF, 7.6, 0, 1.4, 0.8, 0.42, M.woodDark);
    p.shelf(-21.2, FF, 8.6, Math.PI / 2, 2.2, 1.9);
    p.rug(-17.5, FF, 7.0, 0, 5.0, 3.4, M.fabricRed);
    p.pendant(-17.5, FF + 3.1, 7.5);
  });
  b.inRoom(rBath, () => {
    p.toilet(-12.2, FF, 4.4, 0);
    p.basin(-10.4, FF, 4.2, 0);
    b.span(-12.6, FF, 8.0, -9.0, FF + 0.5, 11.2, M.plasticWhite, { surface: 'ceramic' });
  });
  b.inRoom(rBed4, () => {
    p.bed(-5.5, FF, 6.0, Math.PI, 1.8, 2.1);
    p.wardrobe(-8.0, FF, 9.6, Math.PI / 2, 1.6, 2.1);
    p.armchair(-2.2, FF, 9.8, Math.PI);
    p.pendant(-4.8, FF + 3.1, 7.5);
  });
  b.inRoom(rSafe, () => {
    p.desk(4.0, FF, 5.6, Math.PI);
    p.chair(4.0, FF, 7.0, 0);
    p.armchair(6.6, FF, 10.0, Math.PI);
    p.shelf(7.4, FF, 6.0, -Math.PI / 2, 2.2, 2.0);
    p.rug(4.0, FF, 8.0, 0, 3.4, 2.6, M.fabricTeal);
    p.painting(4.0, FF + 2.0, 3.8, 0, 1.6, 1.1);
    p.pendant(4.0, FF + 3.1, 8.0);
    // Crates of product — the objective the mission generator will point at.
    for (let i = 0; i < 4; i++) p.crate(1.0 + (i % 2) * 0.95, FF, 10.4 - Math.floor(i / 2) * 0.9, 0.1, 0.44);
  });

  // Roof dressing.
  b.inRoom(rRoof, () => {
    p.waterTank(-18, ROOF, -7, 1.2, 2.0);
    p.waterTank(-15.2, ROOF, -7, 1.2, 2.0);
    p.acUnit(-18, ROOF, 2, 0);
    p.acUnit(-16.6, ROOF, 2, 0);
    p.satelliteDish(5.0, ROOF, -6.0, Math.PI * 0.75, 1.0);
    p.crate(6.2, ROOF, 8.0, 0.4, 0.5);
    p.sandbags(-2, 10.6, 4, 10.6, ROOF, 3);
    p.sandbags(-21, -8.6, -21, -3, ROOF, 3);
    p.floodlight(6.6, ROOF, -1.5, Math.PI, 2.4);
  });

  void rng;
  return { rooms, doorIds };
}

// ===========================================================================
// Guest casita
// ===========================================================================

function buildCasita(
  b: SiteBuilder, p: Props, rng: Rng, buildingId: number, ox: number, oz: number, variant: number,
): { rooms: number[]; doorIds: number[] } {
  const w = 16, d = 12, h = 3.2;
  const x0 = ox, x1 = ox + w, z0 = oz, z1 = oz + d;
  const y = PAD;
  const rooms: number[] = [];
  const doorIds: number[] = [];
  const wallMat = variant === 0 ? M.plasterRose : M.plasterSage;

  const rLiving = b.room({
    name: `Casita ${variant === 0 ? 'A' : 'B'} living`, tag: 'living', indoors: true, buildingId,
    minX: x0, maxX: x0 + 9, minZ: z0, maxZ: z1, minY: y, maxY: y + h,
  });
  const rBed = b.room({
    name: `Casita ${variant === 0 ? 'A' : 'B'} bedroom`, tag: 'bedroom', indoors: true, buildingId,
    minX: x0 + 9, maxX: x1, minZ: z0 + 4, maxZ: z1, minY: y, maxY: y + h,
  });
  const rBath = b.room({
    name: `Casita ${variant === 0 ? 'A' : 'B'} bathroom`, tag: 'bathroom', indoors: true, buildingId,
    minX: x0 + 9, maxX: x1, minZ: z0, maxZ: z0 + 4, minY: y, maxY: y + h,
  });
  rooms.push(rLiving, rBed, rBath);

  b.slab(x0, z0, x1, z1, y + 0.16, 0.34, M.tileTerra, { surface: 'tile' });
  const wo = { y: y + 0.16, height: h, thickness: 0.3, mat: wallMat, jitter: 0.06 };
  doorIds.push(...b.wall({
    ...wo, x0, z0: z1, x1, z1,
    openings: [winOp(3.0, 1.8), doorOp(7.0, 1.0, `Casita ${variant === 0 ? 'A' : 'B'} door`, rLiving, -1, 'wood'), winOp(12.5, 1.4)],
  }));
  b.wall({ ...wo, x0: x1, z0: z1, x1, z1: z0, openings: [winOp(3.5, 1.4), winOp(9.0, 1.0, 1.4, 2.3)] });
  b.wall({ ...wo, x0: x1, z0, x1: x0, z1: z0, openings: [winOp(4.0, 1.2, 1.5, 2.4), winOp(11.0, 1.6)] });
  b.wall({ ...wo, x0, z0, x1: x0, z1, openings: [winOp(4.0, 1.6), winOp(8.5, 1.6)] });
  // Partitions.
  doorIds.push(...b.wall({
    ...wo, x0: x0 + 9, z0, x1: x0 + 9, z1, thickness: W_INT, mat: M.drywall, surface: 'drywall',
    openings: [
      doorOp(2.0, 0.9, `Casita ${variant === 0 ? 'A' : 'B'} bathroom door`, rBath, rLiving, 'wood'),
      doorOp(8.0, 0.95, `Casita ${variant === 0 ? 'A' : 'B'} bedroom door`, rBed, rLiving, 'wood'),
    ],
  }));
  b.wall({ ...wo, x0: x0 + 9, z0: z0 + 4, x1, z1: z0 + 4, thickness: W_INT, mat: M.drywall, surface: 'drywall' });

  b.gableRoof(x0, z0, x1, z1, y + 0.16 + h, 1.8, variant === 0 ? M.terracotta : M.terracottaOld, 0.7);

  // Shaded veranda along the courtyard face.
  p.pergola(x0 + 0.5, z1, x1 - 0.5, z1 + 3.2, y, 2.8);

  b.inRoom(rLiving, () => {
    p.sofa(x0 + 4.5, y + 0.16, z0 + 3.0, Math.PI, 2.2, M.fabricCream);
    p.table(x0 + 4.5, y + 0.16, z0 + 5.0, 0, 1.2, 0.7, 0.42, M.woodWarm);
    p.counter(x0 + 0.6, z0 + 1.0, x0 + 4.4, z0 + 1.0, y + 0.16, M.woodPale);
    p.chair(x0 + 6.6, y + 0.16, z0 + 8.0, -Math.PI / 2);
    p.table(x0 + 5.4, y + 0.16, z0 + 8.0, 0, 1.0, 1.0, 0.74, M.woodWarm);
    p.pendant(x0 + 4.5, y + 0.16 + h - 0.1, z0 + 5.5);
    p.rug(x0 + 4.5, y + 0.16, z0 + 4.4, 0, 3.2, 2.6, rng.bool() ? M.fabricRed : M.fabricTeal);
  });
  b.inRoom(rBed, () => {
    p.bed(x0 + 12.5, y + 0.16, z0 + 7.0, 0, 1.6, 2.0);
    p.wardrobe(x1 - 0.6, y + 0.16, z0 + 10.0, -Math.PI / 2, 1.4, 2.0);
    p.pendant(x0 + 12.5, y + 0.16 + h - 0.1, z0 + 8.0);
  });
  b.inRoom(rBath, () => {
    p.toilet(x0 + 10.0, y + 0.16, z0 + 1.0, 0);
    p.basin(x0 + 12.5, y + 0.16, z0 + 0.6, 0);
  });

  b.ladder(x1 - 1.5, z0 - 0.4, Math.PI / 2, y, y + 0.16 + h + 1.9);
  return { rooms, doorIds };
}

// ===========================================================================
// Staff block
// ===========================================================================

function buildStaffBlock(
  b: SiteBuilder, p: Props, rng: Rng, buildingId: number,
): { rooms: number[]; doorIds: number[] } {
  const x0 = -32, x1 = 8, z0 = -54, z1 = -44, y = PAD, h = 3.1;
  const rooms: number[] = [];
  const doorIds: number[] = [];

  const rBunk = b.room({ name: 'Bunk room', tag: 'barracks', indoors: true, buildingId, minX: x0, maxX: x0 + 14, minZ: z0, maxZ: z1, minY: y, maxY: y + h });
  const rMess = b.room({ name: 'Mess', tag: 'mess', indoors: true, buildingId, minX: x0 + 14, maxX: x0 + 26, minZ: z0, maxZ: z1, minY: y, maxY: y + h });
  const rGen = b.room({ name: 'Generator room', tag: 'utility', indoors: true, buildingId, minX: x0 + 26, maxX: x1, minZ: z0, maxZ: z1, minY: y, maxY: y + h });
  rooms.push(rBunk, rMess, rGen);

  b.slab(x0, z0, x1, z1, y + 0.14, 0.3, M.concreteRaw, { surface: 'concrete' });
  const wo = { y: y + 0.14, height: h, thickness: 0.3, mat: M.stucco, jitter: 0.06 };
  doorIds.push(...b.wall({
    ...wo, x0, z0: z1, x1, z1,
    openings: [
      winOp(3.0, 1.6), doorOp(7.0, 1.0, 'Bunk room door', rBunk, -1, 'wood'), winOp(11.0, 1.6),
      winOp(17.0, 1.8), doorOp(21.0, 1.0, 'Mess door', rMess, -1, 'wood'), winOp(25.0, 1.8),
      doorOp(33.0, 1.2, 'Generator room door', rGen, -1, 'metal', { locked: true }),
    ],
  }));
  // Rear wall onto the service alley — the quiet way in.
  doorIds.push(...b.wall({
    ...wo, x0: x1, z0, x1: x0, z1: z0,
    openings: [
      winOp(4.0, 1.2, 1.5, 2.3), doorOp(9.0, 1.0, 'Service alley door', rGen, -1, 'metal'),
      winOp(18.0, 1.4, 1.5, 2.4), winOp(26.0, 1.4, 1.5, 2.4), winOp(34.0, 1.4, 1.5, 2.4),
    ],
  }));
  b.wall({ ...wo, x0, z0, x1: x0, z1 });
  b.wall({ ...wo, x0: x1, z0: z1, x1, z1: z0 });
  doorIds.push(...b.wall({
    ...wo, x0: x0 + 14, z0, x1: x0 + 14, z1, thickness: W_INT, mat: M.drywall, surface: 'drywall',
    openings: [doorOp(5.0, 0.95, 'Bunk–mess door', rBunk, rMess, 'wood', { open: true })],
  }));
  b.wall({ ...wo, x0: x0 + 26, z0, x1: x0 + 26, z1, thickness: 0.24, mat: M.concreteRaw, surface: 'concrete' });

  // Corrugated roof with a shallow slope and a reachable deck.
  b.span(x0 - 0.4, y + 0.14 + h, z0 - 0.4, x1 + 0.4, y + 0.14 + h + 0.2, z1 + 0.4, M.corrugated, {
    surface: 'metal', flags: BF.NO_COVER, tint: b.jitterTint(0.05),
  });
  for (let x = x0; x < x1; x += 1.1) {
    b.box(x, y + 0.14 + h + 0.26, (z0 + z1) / 2, 0.09, 0.06, (z1 - z0) / 2 + 0.4, M.corrugated, {
      surface: 'metal', flags: BF.NO_COVER | BF.NO_NAV, tint: b.jitterTint(0.08),
    });
  }
  b.ladder(x0 + 1.2, z0 - 0.4, Math.PI / 2, y, y + 0.14 + h + 0.4);

  b.inRoom(rBunk, () => {
    for (let i = 0; i < 4; i++) {
      p.bed(x0 + 2.0 + i * 3.2, y + 0.14, z0 + 1.6, Math.PI, 1.0, 2.0);
      p.wardrobe(x0 + 3.6 + i * 3.2, y + 0.14, z0 + 1.0, 0, 0.7, 1.8, M.steelGalv);
    }
    p.table(x0 + 7.0, y + 0.14, z1 - 2.0, 0, 1.6, 0.8, 0.74, M.woodWeathered);
    p.pendant(x0 + 7.0, y + 0.14 + h - 0.1, z0 + 5.0);
  });
  b.inRoom(rMess, () => {
    p.table(x0 + 20.0, y + 0.14, z0 + 5.0, 0, 3.0, 1.1, 0.76, M.woodWeathered);
    for (let i = 0; i < 3; i++) {
      p.chair(x0 + 18.6 + i * 1.4, y + 0.14, z0 + 3.8, 0);
      p.chair(x0 + 18.6 + i * 1.4, y + 0.14, z0 + 6.2, Math.PI);
    }
    p.counter(x0 + 14.6, z0 + 0.9, x0 + 20.0, z0 + 0.9, y + 0.14, M.steelGalv);
    p.fridge(x0 + 24.8, y + 0.14, z0 + 1.0, 0);
    p.pendant(x0 + 20.0, y + 0.14 + h - 0.1, z0 + 5.0);
  });
  b.inRoom(rGen, () => {
    p.generator(x0 + 30.0, y + 0.14, z0 + 5.0, Math.PI / 2);
    for (let i = 0; i < 4; i++) p.drum(x0 + 27.2 + (i % 2) * 0.7, y + 0.14, z0 + 1.2 + Math.floor(i / 2) * 0.7);
    p.shelf(x1 - 0.6, y + 0.14, z0 + 7.5, -Math.PI / 2, 2.0, 1.9);
  });

  // Alley dressing — laundry lines, bins, stacked tiles.
  for (let i = 0; i < 5; i++) {
    b.box(x0 + 4 + i * 7, y + 2.4, z0 - 2.0, 3.2, 0.012, 0.01, M.steelGalv, {
      surface: 'metal', flags: BF.NO_COVER | BF.NO_NAV | BF.THIN | BF.NO_SHADOW,
    });
    for (let k = 0; k < 3; k++) {
      b.box(x0 + 2.6 + i * 7 + k * 1.1, y + 2.0, z0 - 2.0, 0.4, 0.42, 0.02, rng.pick([M.fabricCream, M.fabricTeal, M.fabricRed]), {
        surface: 'fabric', flags: BF.SOFT | BF.NO_COVER | BF.NO_NAV | BF.NO_SHADOW,
      });
    }
  }
  for (let i = 0; i < 6; i++) p.drum(x0 + 6 + i * 5.5, y, z0 - 3.2);
  p.pallet(x0 + 20, y, z0 - 3.0, 0.2, 4);
  p.tyreStack(x0 + 33, y, z0 - 3.0, 5);

  return { rooms, doorIds };
}

// ===========================================================================
// Workshop
// ===========================================================================

function buildWorkshop(
  b: SiteBuilder, p: Props, rng: Rng, buildingId: number,
): { rooms: number[]; doorIds: number[] } {
  const x0 = 30, x1 = 54, z0 = -42, z1 = -24, y = PAD, h = 5.2;
  const rooms: number[] = [];
  const doorIds: number[] = [];
  const rShop = b.room({ name: 'Workshop', tag: 'garage', indoors: true, buildingId, minX: x0, maxX: x1 - 6, minZ: z0, maxZ: z1, minY: y, maxY: y + h });
  const rStore = b.room({ name: 'Store room', tag: 'storage', indoors: true, buildingId, minX: x1 - 6, maxX: x1, minZ: z0, maxZ: z1, minY: y, maxY: y + 3.2 });
  rooms.push(rShop, rStore);

  b.slab(x0, z0, x1, z1, y + 0.12, 0.28, M.concreteDark, { surface: 'concrete' });
  const wo = { y: y + 0.12, height: h, thickness: 0.3, mat: M.concreteRaw, jitter: 0.05 };
  doorIds.push(...b.wall({
    ...wo, x0, z0: z1, x1, z1,
    openings: [
      doorOp(9.0, 6.0, 'Workshop roller door', rShop, -1, 'metal', { height: 4.2, open: true }),
      winOp(20.0, 2.0, 3.0, 4.4),
    ],
  }));
  b.wall({ ...wo, x0: x1, z0: z1, x1, z1: z0, openings: [winOp(6.0, 2.4, 3.0, 4.4)] });
  doorIds.push(...b.wall({
    ...wo, x0: x1, z0, x1: x0, z1: z0,
    openings: [doorOp(6.0, 1.1, 'Workshop rear door', rStore, -1, 'metal'), winOp(16.0, 2.4, 3.0, 4.4)],
  }));
  b.wall({ ...wo, x0, z0, x1: x0, z1, openings: [winOp(9.0, 3.0, 3.0, 4.4)] });
  doorIds.push(...b.wall({
    ...wo, x0: x1 - 6, z0, x1: x1 - 6, z1, height: 3.2, thickness: 0.22, mat: M.concreteRaw,
    openings: [doorOp(12.0, 1.1, 'Store room door', rStore, rShop, 'metal', { locked: true })],
  }));
  // Store room ceiling doubles as a mezzanine.
  b.slab(x1 - 6, z0, x1, z1, y + 0.12 + 3.2, 0.24, M.concreteRaw, { surface: 'concrete' });
  b.ladder(x1 - 6.9, (z0 + z1) / 2, 0, y + 0.12, y + 0.12 + 3.2);
  // Corrugated roof.
  b.span(x0 - 0.5, y + 0.12 + h, z0 - 0.5, x1 + 0.5, y + 0.12 + h + 0.22, z1 + 0.5, M.corrugated, {
    surface: 'metal', flags: BF.NO_COVER, tint: b.jitterTint(0.05),
  });
  for (let x = x0; x < x1; x += 1.2) {
    b.box(x, y + 0.12 + h + 0.28, (z0 + z1) / 2, 0.1, 0.06, (z1 - z0) / 2 + 0.5, M.corrugated, {
      surface: 'metal', flags: BF.NO_COVER | BF.NO_NAV, tint: b.jitterTint(0.08),
    });
  }
  // Roof trusses, visible through the big door — sells the interior volume.
  for (let x = x0 + 2; x < x1 - 6; x += 4) {
    b.box(x, y + 0.12 + h - 0.4, (z0 + z1) / 2, 0.12, 0.12, (z1 - z0) / 2, M.steelDark, {
      surface: 'metal', flags: BF.NO_COVER | BF.NO_NAV,
    });
  }

  b.inRoom(rShop, () => {
    p.pickup(x0 + 8, y + 0.12, z0 + 8, Math.PI / 2, M.paintGreen);
    p.counter(x0 + 0.6, z0 + 2.0, x0 + 0.6, z0 + 10.0, y + 0.12, M.steelGalv);
    for (let i = 0; i < 8; i++) p.drum(x0 + 14.5 + (i % 4) * 0.7, y + 0.12, z0 + 2.0 + Math.floor(i / 4) * 0.7);
    p.pallet(x0 + 15, y + 0.12, z0 + 14, 0.1, 4);
    p.tyreStack(x0 + 2.0, y + 0.12, z0 + 15.0, 6);
    p.crate(x0 + 12, y + 0.12, z0 + 15.6, 0.4, 0.7);
    p.crate(x0 + 13.6, y + 0.12, z0 + 15.6, 0.1, 0.7);
    p.floodlight(x0 + 6, y + 0.12, z0 + 3, 0, 4.2);
  });
  b.inRoom(rStore, () => {
    for (let i = 0; i < 6; i++) p.crate(x1 - 4.6 + (i % 2) * 1.5, y + 0.12, z0 + 3 + Math.floor(i / 2) * 1.6, rng.range(0, 0.4), 0.6);
    p.shelf(x1 - 0.6, y + 0.12, z0 + 12, -Math.PI / 2, 2.4, 2.4);
  });

  // Yard dressing.
  for (let i = 0; i < 5; i++) p.container(34 + i * 0.2, y, -16 - i * 3.2, rng.range(-0.05, 0.05));
  p.container(46, y, -12, Math.PI / 2 + 0.03);
  p.container(46, y + 2.66, -12, Math.PI / 2 - 0.02);
  p.jerseyBarrier(24, y, -30, 0);
  p.floodlight(28, y, -20, -Math.PI / 2, 6.0);
  for (let i = 0; i < 8; i++) p.drum(58 + (i % 4) * 0.7, y, -36 + Math.floor(i / 4) * 0.7);

  // Water tower — the compound's landmark and a sniper hide.
  const twx = -56, twz = -20;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.box(twx + sx * 2.2, y + 5.0, twz + sz * 2.2, 0.16, 5.0, 0.16, M.steelDark, { surface: 'metal' });
  }
  for (const s of [-1, 1]) {
    b.box(twx + s * 2.2, y + 5.0, twz, 0.1, 0.1, 2.2, M.steelDark, { surface: 'metal', flags: BF.NO_COVER | BF.NO_NAV });
    b.box(twx, y + 5.0, twz + s * 2.2, 2.2, 0.1, 0.1, M.steelDark, { surface: 'metal', flags: BF.NO_COVER | BF.NO_NAV });
  }
  b.span(twx - 2.6, y + 10.0, twz - 2.6, twx + 2.6, y + 10.2, twz + 2.6, M.steelDark, { surface: 'metal', flags: BF.NO_COVER });
  b.cyl(twx, y + 12.4, twz, 2.4, 2.2, M.rust, { surface: 'metal', tint: b.jitterTint(0.07) });
  b.cyl(twx, y + 14.75, twz, 2.5, 0.15, M.steelDark, { surface: 'metal', flags: BF.NO_COVER });
  b.ladder(twx + 2.7, twz, Math.PI, y, y + 10.2);

  return { rooms, doorIds };
}

// ===========================================================================
// Pool terrace
// ===========================================================================

function buildPoolTerrace(
  b: SiteBuilder, p: Props, rng: Rng, buildingId: number,
): { rooms: number[]; doorIds: number[] } {
  const rooms: number[] = [];
  const doorIds: number[] = [];

  // Sunken pool: a real hole in the terrace, which means real cover in it.
  const px0 = -50, px1 = -34, pz0 = 1, pz1 = 15;
  const depth = 1.7;
  b.slab(-60, -12, 14, 24, TER, 0.3, M.tileTerra, {
    surface: 'tile', holes: [[px0, pz0, px1, pz1], [HOUSE.x0, HOUSE.z0, HOUSE.x1, HOUSE.z1]],
  });
  // Pool shell.
  b.span(px0 - 0.3, TER - depth - 0.35, pz0 - 0.3, px1 + 0.3, TER - depth, pz1 + 0.3, M.poolTile, { surface: 'tile', flags: BF.NO_COVER });
  for (const [ax, az, bx2, bz2] of [
    [px0, pz0, px1, pz0], [px0, pz1, px1, pz1], [px0, pz0, px0, pz1], [px1, pz0, px1, pz1],
  ] as Array<[number, number, number, number]>) {
    b.wall({ x0: ax, z0: az, x1: bx2, z1: bz2, y: TER - depth, height: depth, thickness: 0.3, mat: M.poolTile, surface: 'tile', jitter: 0.04 });
  }
  b.span(px0, TER - 0.35, pz0, px1, TER - 0.22, pz1, M.water, {
    surface: 'water', flags: BF.SOFT | BF.NO_SHADOW | BF.NO_COVER | BF.NO_NAV,
  });
  // Coping course.
  for (const [ax, az, bx2, bz2] of [
    [px0 - 0.35, pz0 - 0.35, px1 + 0.35, pz0 - 0.35], [px0 - 0.35, pz1 + 0.35, px1 + 0.35, pz1 + 0.35],
    [px0 - 0.35, pz0 - 0.35, px0 - 0.35, pz1 + 0.35], [px1 + 0.35, pz0 - 0.35, px1 + 0.35, pz1 + 0.35],
  ] as Array<[number, number, number, number]>) {
    b.wall({ x0: ax, z0: az, x1: bx2, z1: bz2, y: TER, height: 0.09, thickness: 0.7, mat: M.stoneTrim, surface: 'concrete', jitter: 0.03 });
  }
  // Pool steps at the shallow end.
  for (let i = 0; i < 4; i++) {
    b.span(px1 - 2.6, TER - depth, pz0 + i * 0.42, px1 - 0.2, TER - 0.35 - i * 0.34, pz0 + (i + 1) * 0.42, M.poolTile, {
      surface: 'tile', flags: BF.NO_COVER,
    });
  }

  // Cabana / pool bar.
  const cx0 = -59, cx1 = -51, cz0 = -8, cz1 = -1;
  const rCab = b.room({
    name: 'Pool cabana', tag: 'bar', indoors: true, buildingId,
    minX: cx0, maxX: cx1, minZ: cz0, maxZ: cz1, minY: TER, maxY: TER + 3.0,
  });
  rooms.push(rCab);
  b.inRoom(rCab, () => {
    b.slab(cx0, cz0, cx1, cz1, TER + 0.1, 0.3, M.tileTalavera, { surface: 'tile' });
    const wo = { y: TER + 0.1, height: 3.0, thickness: 0.28, mat: M.plasterWhite, jitter: 0.05, room: rCab };
    b.wall({ ...wo, x0: cx0, z0: cz0, x1: cx1, z1: cz0 });
    b.wall({ ...wo, x0: cx0, z0: cz1, x1: cx1, z1: cz1, openings: [archOp(4.0, 3.6, 2.5)] });
    b.wall({ ...wo, x0: cx0, z0: cz0, x1: cx0, z1: cz1, openings: [winOp(3.5, 1.6)] });
    doorIds.push(...b.wall({
      ...wo, x0: cx1, z0: cz0, x1: cx1, z1: cz1,
      openings: [doorOp(5.0, 1.0, 'Cabana door', rCab, -1, 'wood')],
    }));
    b.gableRoof(cx0, cz0, cx1, cz1, TER + 3.1, 1.3, M.terracotta, 0.6);
    p.counter(cx0 + 0.6, cz1 - 1.2, cx1 - 0.6, cz1 - 1.2, TER + 0.1, M.woodDark);
    p.shelf(cx0 + 0.4, TER + 0.1, cz0 + 3.0, Math.PI / 2, 2.4, 1.9);
    p.pendant((cx0 + cx1) / 2, TER + 3.0, (cz0 + cz1) / 2);
    p.chair(cx0 + 2.5, TER + 0.1, cz1 - 2.4, 0);
    p.chair(cx0 + 4.5, TER + 0.1, cz1 - 2.4, 0);
  });

  // Pergola shading the terrace between the pool and the house.
  p.pergola(-30, 2, -24, 18, TER, 3.0);
  // Loungers, parasols, planters.
  for (let i = 0; i < 5; i++) {
    p.sunLounger(px0 - 2.6, TER, pz0 + 1.4 + i * 2.7, Math.PI / 2 + rng.range(-0.06, 0.06));
  }
  for (let i = 0; i < 3; i++) p.sunLounger(px1 + 2.6, TER, pz0 + 2.4 + i * 3.6, -Math.PI / 2 + rng.range(-0.06, 0.06));
  p.parasol(px0 - 4.4, TER, pz0 + 4.0);
  p.parasol(px0 - 4.4, TER, pz0 + 10.0);
  p.table(px1 + 3.6, TER, pz1 - 2.0, 0.2, 1.5, 1.5, 0.74, M.woodPale);
  for (const [ppx, ppz] of [[-53, 18], [-46, 20], [-38, 20], [-31, 18], [-53, -2], [-27, -6]] as Array<[number, number]>) {
    p.planter(ppx, TER, ppz, 0.62);
  }
  // Low retaining wall marking the drop off the terrace edge — cover both sides.
  b.wall({ x0: -60, z0: 24, x1: -12, z1: 24, y: TER - 0.9, height: 1.5, thickness: 0.4, mat: M.stoneTrim, surface: 'concrete', jitter: 0.04, coping: { mat: M.stoneTrim, height: 0.1, overhang: 0.08 } });
  b.wall({ x0: -60, z0: -12, x1: -60, z1: 24, y: TER - 0.9, height: 1.5, thickness: 0.4, mat: M.stoneTrim, surface: 'concrete', jitter: 0.04, coping: { mat: M.stoneTrim, height: 0.1, overhang: 0.08 } });
  b.wall({ x0: -60, z0: -12, x1: -22, z1: -12, y: TER - 0.9, height: 1.5, thickness: 0.4, mat: M.stoneTrim, surface: 'concrete', jitter: 0.04, coping: { mat: M.stoneTrim, height: 0.1, overhang: 0.08 } });
  // Steps down from the terrace into the garden on the west side.
  for (let i = 0; i < 5; i++) {
    const yy = TER - (i + 1) * ((TER - PAD) / 5);
    b.span(-64 - i * 0.4, yy, 6, -60, TER - i * ((TER - PAD) / 5), 10, M.stoneTrim, { surface: 'concrete', flags: BF.NO_COVER });
  }

  return { rooms, doorIds };
}
