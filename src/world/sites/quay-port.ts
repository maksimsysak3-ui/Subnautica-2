/**
 * Puerto Meridian — the port district outside the quay's wire.
 *
 * OWNED BY: World design team.
 *
 * ## Why the quay needed a district
 * Meridian Quay was a fenced terminal standing alone on open sand. A port is
 * never that: the bonded compound is one berth in a working district of
 * transit sheds, chandlers, customs brokers, dormitories for the dock crews
 * and the bars they drink in, and the road to the gate runs through all of
 * it. That district is what makes a night approach a choice of streets
 * rather than a walk across a car park, and it is what the smuggling
 * operation hides inside.
 *
 * Layout, outside the south fence (z < -74), either side of the approach road
 * and the drainage ditch that runs beside it:
 *
 *   x -108..-40   WEST DISTRICT  — dormitories, the cantina, a chandlery
 *   x  -37..-24   the ditch (the quiet approach), left exactly as it was
 *   x   -8..8     the approach road and the outer checkpoint
 *   x   10..104   EAST DISTRICT  — transit sheds, a customs house, a fuel yard
 *
 *   CALLE DEL MUELLE  z -96..-104, across both districts
 *   CALLE ADUANA      z -140..-148
 */

import { Rng } from '../../core/math';
import { SiteBuilder } from '../builder';
import { M } from '../palette';
import { BF, type RoomSpec } from '../types';
import { nearDoor, makeKit, frontage, building, street, overhead, meadow, Frame, type Fixture } from '../kit';

const PAD = 2.0;
const Y = PAD + 0.02;
const DEPTH = 9;
const SHED_D = 16;

export interface PortResult {
  rooms: RoomSpec[];
  lights: Fixture[];
  cantina: { x: number; z: number };
  customs: { x: number; z: number };
}

export function buildPortDistrict(b: SiteBuilder, rng: Rng): PortResult {
  const k = makeKit(b, rng);
  const { p } = k;
  b.building('Puerto Meridian');

  // Hard standing under both districts, so the gaps between buildings are
  // yard and not the sand of the open ground.
  for (const [x0, x1] of [[-112, -39], [9, 108]] as const) {
    b.span(x0, PAD - 0.3, -184, x1, PAD + 0.004, -76, M.concreteRaw,
      { surface: 'concrete', flags: BF.NO_COVER, tint: b.jitterTint(0.05) });
  }

  // --- streets ----------------------------------------------------------------
  for (const [cz, name] of [[-100, 'Muelle'], [-144, 'Aduana']] as const) {
    void name;
    street(k, -110, cz - 4, -40, cz + 4, Y, { alongX: true, cars: 2 });
    street(k, 10, cz - 4, 106, cz + 4, Y, { alongX: true, cars: 3 });
  }
  // The approach road carried on south through the district, and the east
  // calles joined onto it, so the district is a street network and not two
  // islands either side of a highway.
  street(k, -4.5, -190, 4.5, -136, Y, { alongX: false, cars: 2 });
  for (const cz of [-100, -144]) street(k, 4.6, cz - 4, 10, cz + 4, Y, { alongX: true, lamps: false, cars: 0, kerb: false });
  // The dock road the lorries use, down the east district to the sheds.
  street(k, 60, -174, 68, -106, Y, { alongX: false, cars: 2 });

  // ==========================================================================
  // EAST DISTRICT — sheds, customs, fuel
  // ==========================================================================
  // Sheds along both sides of Calle del Muelle: the big volumes, and the
  // cover that makes the flanking route out to the rail spur a real route.
  frontage(k, 'south', -100 + 4 + 1.8 + 0.4, 12, 58, {
    depth: SHED_D, y: Y, prefix: 'Transit shed N', minW: 12, maxW: 18, gapMin: 2.4, gapMax: 4,
    styles: [['shed', 1]], storeys: [1, 1, 1],
  });
  frontage(k, 'south', -100 + 4 + 1.8 + 0.4, 71, 104, {
    depth: SHED_D, y: Y, prefix: 'Transit shed NE', minW: 12, maxW: 16, gapMin: 2.4, gapMax: 4,
    styles: [['shed', 1]], storeys: [1, 1, 1],
  });
  frontage(k, 'north', -100 - 4 - 1.8 - 0.4, 12, 58, {
    depth: SHED_D, y: Y, prefix: 'Transit shed S', minW: 12, maxW: 18, gapMin: 2.4, gapMax: 4,
    styles: [['shed', 0.75], ['shop', 1]], storeys: [1, 1, 1],
  });
  frontage(k, 'north', -100 - 4 - 1.8 - 0.4, 71, 104, {
    depth: SHED_D, y: Y, prefix: 'Transit shed SE', minW: 12, maxW: 16, gapMin: 2.4, gapMax: 4,
    styles: [['shed', 1]], storeys: [1, 1, 1],
  });
  // Along Calle Aduana: offices, the customs house, a chandlery.
  frontage(k, 'south', -144 + 4 + 1.8 + 0.4, 12, 58, {
    depth: DEPTH, y: Y, prefix: 'Aduana N', styles: [['shop', 0.5], ['house', 1]],
    storeys: [0.2, 0.8, 1], gapMin: 0.8, gapMax: 2.2,
  });
  frontage(k, 'north', -144 - 4 - 1.8 - 0.4, 12, 58, {
    depth: DEPTH, y: Y, prefix: 'Aduana S', styles: [['house', 0.7], ['bar', 0.8], ['shop', 1]],
    storeys: [0.3, 0.85, 1], gapMin: 0.8, gapMax: 2.2,
  });

  // The customs house: three storeys, the biggest civic building in the
  // district, and it overlooks the approach road and the checkpoint.
  const customs = { x: 88, z: -160 };
  building(k, { frame: new Frame(102, -150.2, 'north'), w: 30, d: 14, y: Y, storeys: 3,
    style: 'rich', name: 'Aduana Maritima', mat: M.chalkWhite, gable: false });

  // The fuel yard on the dock road: tanks, a pump island, a canopy, and the
  // single most dangerous place on the map to start shooting.
  {
    const fx = 80, fz = -128;
    for (let i = 0; i < 3; i++) {
      b.cyl(fx + i * 7, Y + 3.2, fz, 2.6, 3.2, [M.chalkWhite, M.boxFadedGrey, M.chalkWhite][i], { surface: 'metal' });
      b.cyl(fx + i * 7, Y + 6.5, fz, 2.7, 0.12, M.steelDark, { surface: 'metal', flags: BF.NO_COVER });
      b.ladder(fx + i * 7 + 2.75, fz, Math.PI / 2, Y, Y + 6.8);
    }
    // Bund wall round the tank farm.
    for (const [ax, az, bx, bz] of [[fx - 4, fz - 3.6, fx + 18, fz - 3.6], [fx - 4, fz + 3.6, fx + 18, fz + 3.6], [fx + 18, fz - 3.6, fx + 18, fz + 3.6]] as const) {
      b.wall({ x0: ax, z0: az, x1: bx, z1: bz, y: Y, height: 1.1, thickness: 0.3, mat: M.concreteRaw, jitter: 0.05 });
    }
    // Pump island and canopy.
    b.span(69, Y, -137.6, 75, Y + 0.25, -134.2, M.concreteRaw, { surface: 'concrete' });
    for (const px of [70.2, 73.8]) b.box(px, Y + 1.0, -135.9, 0.35, 0.75, 0.25, M.paintRed, { surface: 'metal' });
    for (const [cx, cz] of [[69.5, -138.8], [75.5, -138.8], [69.5, -133.0], [75.5, -133.0]] as const) {
      b.box(cx, Y + 2.4, cz, 0.16, 2.4, 0.16, M.steelGalv, { surface: 'metal' });
    }
    b.span(68.5, Y + 4.8, -139.4, 76.5, Y + 5.2, -132.4, M.chalkWhite, { surface: 'metal', flags: BF.NO_COVER });
    k.lights.push({ position: { x: 72, y: Y + 4.6, z: -136 }, color: 0xe8f0ff, intensity: 110, distance: 20, alwaysOn: true });
    p.pickup(84, Y, -136, Math.PI / 2, M.paintBlue);
    for (let i = 0; i < 8; i++) p.drum(92 + (i % 4) * 0.8, Y, -136.5 + Math.floor(i / 4) * 0.8, i % 3 ? M.paintRed : undefined);
  }

  // Lorries parked nose to tail down the dock road, and trailers in the yard
  // behind the sheds — the east district's cover at ground level.
  for (let i = 0; i < 4; i++) {
    const tz = -168 + i * 13;
    b.span(58.4, Y + 1.0, tz - 5.2, 61.2, Y + 3.9, tz + 3.4, [M.boxOxide, M.boxFadedNavy, M.rust, M.boxSunbleach][i], { surface: 'metal', tint: b.jitterTint(0.06) });
    b.span(58.6, Y + 0.3, tz - 5.0, 61.0, Y + 1.0, tz + 3.2, M.sootMetal, { surface: 'metal' });
    b.span(58.6, Y + 0.3, tz + 3.6, 61.0, Y + 2.9, tz + 5.8, M.paintRed, { surface: 'metal' });
  }

  // ==========================================================================
  // WEST DISTRICT — where the dock crews live
  // ==========================================================================
  frontage(k, 'south', -100 + 4 + 1.8 + 0.4, -108, -42, {
    depth: DEPTH, y: Y, prefix: 'Muelle N', styles: [['house', 0.75], ['shop', 1]],
    storeys: [0.35, 0.85, 1], gapMin: 0.6, gapMax: 2.2,
  });
  frontage(k, 'north', -100 - 4 - 1.8 - 0.4, -108, -58, {
    depth: DEPTH, y: Y, prefix: 'Muelle S', styles: [['house', 0.7], ['shop', 1]],
    storeys: [0.35, 0.85, 1], gapMin: 0.6, gapMax: 2.2,
  });
  frontage(k, 'south', -144 + 4 + 1.8 + 0.4, -108, -42, {
    depth: DEPTH, y: Y, prefix: 'Aduana W N', styles: [['house', 1]],
    storeys: [0.5, 0.9, 1], gapMin: 1.2, gapMax: 2.6,
  });
  frontage(k, 'north', -144 - 4 - 1.8 - 0.4, -108, -42, {
    depth: DEPTH, y: Y, prefix: 'Aduana W S', styles: [['house', 1]],
    storeys: [0.5, 0.9, 1], gapMin: 1.2, gapMax: 2.6,
  });
  // The dormitory block: four storeys of bunk rooms facing the ditch, the
  // tallest building outside the wire and a sniper's dream over the approach.
  building(k, { frame: new Frame(-41, -182, 'east'), w: 20, d: 11, y: Y, storeys: 4,
    style: 'house', name: 'Dormitorio', mat: M.concreteRaw });
  // The cantina, on the corner nearest the gate — where the gate crew drinks.
  // The cantina, on Calle del Muelle nearest the gate, where the gate crew
  // drinks: the first building of the south row, forced to a bar.
  const cantina = { x: -50, z: -110 };
  building(k, { frame: new Frame(-42, -106.2, 'north'), w: 14, d: DEPTH, y: Y, storeys: 2,
    style: 'bar', name: 'Cantina La Ancla' });

  // Yards behind the rows: walls, washing, water tanks, a car on blocks.
  for (const [z0, z1, x0, x1] of [[-128.4, -115.6, -108, -46], [-128.4, -122.8, 12, 56]] as const) {
    {
      for (let x = x0 + 3; x < x1 - 3; x += rng.range(8, 12)) {
        if (nearDoor(k, x, (z0 + z1) / 2, (z1 - z0) / 2 + 1.4) && [...Array(9)].some((_, q) => nearDoor(k, x, z0 + (q / 8) * (z1 - z0), 1.6))) continue;
        b.wall({ x0: x, z0, x1: x, z1, y: Y, height: 1.8, thickness: 0.2,
          mat: [M.concreteRaw, M.brickRed, M.stucco][Math.floor(rng.next() * 3)], jitter: 0.06,
          openings: [{ at: rng.range(1.5, (z1 - z0) - 1.5), width: 1.2, y0: 0, y1: 1.8, kind: 'hole' }],
          panel: { every: 2.6, jitter: 0.15, variants: [M.concreteRaw, M.brickRed], breakChance: 0.08 } });
        const cx = x + rng.range(2, 5), cz = rng.range(z0 + 2, z1 - 2);
        if (nearDoor(k, cx, cz, 2.6)) continue;
        const r = rng.next();
        if (r < 0.3) p.pallet(cx, Y, cz, rng.range(0, 3), 3);
        else if (r < 0.5) p.sedan(cx, Y, cz, rng.range(0, 3.14), M.rust);
        else if (r < 0.7) p.tyreStack(cx, Y, cz, 3);
        else p.waterTank(cx, Y, cz, 0.9, 1.4);
      }
      overhead(k, x0, z0, x1, z1, Y, 10);
      p.dress(x0, z0, x1, z1, Y, 12);
      meadow(k, x0, z0, x1, z1, Y, 3);
    }
  }

  b.endBuilding();
  console.info(`[port] ${k.rooms.length} rooms, ${k.lights.length} fixtures`);
  return { rooms: k.rooms, lights: k.lights, cantina, customs };
}
