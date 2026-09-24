/**
 * San Verdugo — the town below the compound.
 *
 * OWNED BY: World design team.
 *
 * ## Why the villa needed a town
 * Casa Verdugo was a walled compound sitting alone in a desert with a lawn in
 * it, reached by one road. Nothing explained why it was there and nothing
 * around it gave the approach anything to be — you walked up a road, and then
 * you were at the wall.
 *
 * A cartel principal does not live in a desert. He lives at the top of HIS
 * town, above the people who work for him and the people who are afraid of
 * him, and the town is his first ring of security: lookouts on the roofs,
 * a checkpoint where the road comes in, a bar where his men drink, and a
 * plaza where everyone can see who arrives. That is what this builds, on the
 * open ground south of the gate, so the whole map now reads as one place:
 *
 *        compound wall (z 74)  ── gate
 *        EDGE STREET  z 78..84, the frontage that watches the gate
 *        block 1      z 86..116
 *        CALLE 1      z 116..124
 *        block 2      z 126..172   (plaza and church on the west side)
 *        CALLE 2      z 172..180
 *        block 3      z 182..212
 *        CALLE 3      z 212..220
 *        block 4      z 222..236
 *        checkpoint at the town entrance, z ~244
 *
 *   CALLE REAL runs north-south down the middle, x -4.5..4.5, from the
 *   checkpoint to the gate. It is the loud approach: 160 m of street, every
 *   window on it a possible shooter.
 *
 * Everything is built with the shared kit, so it inherits every lesson the
 * first two maps paid for.
 */

import { Rng } from '../../core/math';
import { SiteBuilder } from '../builder';
import { M } from '../palette';
import { BF, type RoomSpec } from '../types';
import {
  makeKit, nearDoor, frontage, building, street, overhead, meadow, Frame, doorOp, winOp, archOp,
  type Fixture,
} from '../kit';

const PAD = 2.0;
const PAVE = PAD + 0.02;
const EDGE_X = 72;
const MAIN = 4.5;          // half-width of the Calle Real carriageway
const PAV = 1.8;           // pavement width
const DEPTH = 9;           // building depth

const CALLES = [120, 176, 216];
const EDGE_Z = 81;          // the edge street's centreline
const TOWN_Z1 = 238;
const X_IN_EARLY = MAIN + PAV + 0.4 + DEPTH + 1.8;

export interface TownResult {
  rooms: RoomSpec[];
  lights: Fixture[];
  insertions: Array<{ id: string; x: number; z: number; label: string }>;
  /** Plaza centre, for missions and the garrison. */
  plaza: { x: number; z: number };
  church: { x: number; z: number };
  bar: { x: number; z: number };
}

export function buildVillaTown(b: SiteBuilder, rng: Rng): TownResult {
  const k = makeKit(b, rng);
  const { p } = k;
  b.building('San Verdugo');

  // The whole town sits on one graded pad of packed earth, so nothing between
  // the streets is ever the compound's lawn.
  b.span(-EDGE_X - 6, PAD - 0.3, 76, EDGE_X + 6, PAD + 0.005, TOWN_Z1 + 16, M.dirtMat,
    { surface: 'dirt', flags: BF.NO_COVER, tint: b.jitterTint(0.05) });

  // ==========================================================================
  // STREETS
  // ==========================================================================
  // Calle Real, gate to checkpoint.
  street(k, -MAIN, 78, MAIN, TOWN_Z1 + 14, PAVE, { alongX: false, cars: 5 });
  // Edge street along the town's face toward the compound.
  street(k, -EDGE_X, EDGE_Z - 3, -MAIN - PAV, EDGE_Z + 3, PAVE, { alongX: true, cars: 1, kerb: false });
  street(k, MAIN + PAV, EDGE_Z - 3, EDGE_X, EDGE_Z + 3, PAVE, { alongX: true, cars: 1, kerb: false });
  // Cross streets.
  for (const cz of CALLES) {
    street(k, -EDGE_X, cz - 4, -MAIN - PAV, cz + 4, PAVE, { alongX: true, cars: 2 });
    street(k, MAIN + PAV, cz - 4, EDGE_X, cz + 4, PAVE, { alongX: true, cars: 2 });
  }

  // ==========================================================================
  // BLOCKS
  // ==========================================================================
  const FRONT_X = MAIN + PAV + 0.4;               // Calle Real frontage line
  const blocks: Array<[number, number]> = [[86, 116 - 1.8], [124 + 1.8, 172 - 1.8], [180 + 1.8, 212 - 1.8], [220 + 1.8, TOWN_Z1]];
  const PLAZA = { x0: -54, x1: -FRONT_X - 0.5, z0: 128, z1: 170 };
  const CANTINA = { x0: -54, x1: -38, z0: 128.4, z1: 139.4 };
  const SHED = { x0: X_IN_EARLY + 8, x1: X_IN_EARLY + 24, z0: 140, z1: 152 };

  // Along Calle Real: tallest and most commercial — this is the high street.
  const mainStyles: Array<['house' | 'shop' | 'bar' | 'rich', number]> = [['shop', 0.45], ['house', 0.9], ['bar', 1]];
  for (let bi = 0; bi < blocks.length; bi++) {
    const [z0, z1] = blocks[bi];
    frontage(k, 'west', FRONT_X, z0, z1, {
      depth: DEPTH, y: PAVE, prefix: `Calle Real ${bi + 1}E`, styles: mainStyles,
      storeys: [0.25, 0.75, 1], gapMin: 0, gapMax: 1.4, gable: 0.15,
    });
    if (bi !== 1) {
      frontage(k, 'east', -FRONT_X, z0, z1, {
        depth: DEPTH, y: PAVE, prefix: `Calle Real ${bi + 1}W`, styles: mainStyles,
        storeys: [0.25, 0.75, 1], gapMin: 0, gapMax: 1.4, gable: 0.15,
      });
    }
  }

  // Along the cross streets and the edge street: houses, a few shops.
  const sideStyles: Array<['house' | 'shop', number]> = [['house', 0.82], ['shop', 1]];
  const X_IN = FRONT_X + DEPTH + 1.8;             // start clear of the Calle Real rows
  // Edge street, north side (looking at the compound — every one of these
  // windows watches the gate, which is why the halcones live here).
  for (const [a, c] of [[-EDGE_X + 2, -X_IN], [X_IN, EDGE_X - 2]] as const) {
    frontage(k, 'south', EDGE_Z + 3 + 0.4, a, c, {
      depth: DEPTH, y: PAVE, prefix: `Frente ${a < 0 ? 'W' : 'E'}`, styles: sideStyles,
      storeys: [0.3, 0.85, 1], gable: 0.1,
    });
  }
  for (const cz of CALLES) {
    for (const [a, c] of [[-EDGE_X + 2, -X_IN], [X_IN, EDGE_X - 2]] as const) {
      const west = a < 0;
      // South side of the calle, facing it.
      const skipS: Array<[number, number]> = [];
      const skipN: Array<[number, number]> = [];
      if (west && cz === 120) skipN.push([PLAZA.x0 - 2, PLAZA.x1 + 2]);
      if (west && cz === 176) skipS.push([PLAZA.x0 - 2, PLAZA.x1 + 2]);
      frontage(k, 'north', cz - 4 - PAV - 0.4, a, c, {
        depth: DEPTH, y: PAVE, prefix: `Calle ${cz}S`, styles: sideStyles, skip: skipS,
        storeys: [0.5, 0.92, 1],
      });
      if (cz !== CALLES[CALLES.length - 1] || true) {
        frontage(k, 'south', cz + 4 + PAV + 0.4, a, c, {
          depth: DEPTH, y: PAVE, prefix: `Calle ${cz}N`, styles: sideStyles, skip: skipN,
          storeys: [0.5, 0.92, 1],
        });
      }
    }
  }

  // Backyards: the space between the rows. Walls, sheds, a tree, a car on
  // blocks — this is where a flanking player actually moves, so it needs
  // cover in it and a reason to go.
  for (const [z0, z1] of [[95.5, 104.5], [135.5, 160.5], [191.5, 200.5]] as const) {
    for (const [x0, x1] of [[-EDGE_X + 2, -X_IN + 1], [X_IN - 1, EDGE_X - 2]] as const) {
      if (z0 === 135.5 && x0 < 0) continue;        // that is the plaza
      for (let x = Math.min(x0, x1) + 2; x < Math.max(x0, x1) - 3; x += rng.range(7, 11)) {
        // Yard wall across the gap, with a gap in it.
        if (x > SHED.x0 - 1 && x < SHED.x1 + 1 && z0 === 135.5) continue;
        if (nearDoor(k, x, (z0 + z1) / 2, (z1 - z0) / 2 + 1.4) && [...Array(9)].some((_, q) => nearDoor(k, x, z0 + (q / 8) * (z1 - z0), 1.6))) continue;
        b.wall({ x0: x, z0, x1: x, z1, y: PAVE, height: 1.9, thickness: 0.2,
          mat: [M.concreteRaw, M.brickRed, M.stucco][Math.floor(rng.next() * 3)], jitter: 0.06,
          openings: [{ at: rng.range(1.5, (z1 - z0) - 1.5), width: 1.2, y0: 0, y1: 1.9, kind: 'hole' }],
          panel: { every: 2.6, jitter: 0.15, variants: [M.concreteRaw, M.brickRed], breakChance: 0.08 } });
        const cx = x + rng.range(2, 4), cz = rng.range(z0 + 2, z1 - 2);
        if (nearDoor(k, cx, cz, 2.6)) continue;
        if (cx > SHED.x0 - 3 && cx < SHED.x1 + 3 && cz > SHED.z0 - 3 && cz < SHED.z1 + 3) continue;
        const r = rng.next();
        if (r < 0.25) p.shadeTree(cx, PAVE, cz, rng.range(5, 7.5));
        else if (r < 0.45) p.sedan(cx, PAVE, cz, rng.range(0, 3.14), M.rust);
        else if (r < 0.65) { p.tyreStack(cx, PAVE, cz, 3); p.drum(cx + 1.2, PAVE, cz); }
        else if (r < 0.8) { p.waterTank(cx, PAVE, cz, 0.9, 1.4); }
        else p.pallet(cx, PAVE, cz, rng.range(0, 3), 3);
      }
      overhead(k, Math.min(x0, x1), z0, Math.max(x0, x1), z1, PAVE, 10);
      p.dress(Math.min(x0, x1), z0, Math.max(x0, x1), z1, PAVE, 10);
      meadow(k, Math.min(x0, x1), z0, Math.max(x0, x1), z1, PAVE, 6);
    }
  }
  // The deep middle of block 2 east: a walled builder's yard with a shed.
  building(k, { frame: new Frame(SHED.x0, SHED.z0, 'south'), w: 16, d: 12, y: PAVE, storeys: 1, style: 'shed', name: 'Builders yard shed' });

  // ==========================================================================
  // THE PLAZA — the town's heart, and the one place everyone can see
  // ==========================================================================
  const plaza = { x: (PLAZA.x0 + PLAZA.x1) / 2, z: (PLAZA.z0 + PLAZA.z1) / 2 };
  {
    b.span(PLAZA.x0, PAD, PLAZA.z0, PLAZA.x1, PAVE + 0.08, PLAZA.z1, M.stoneTrim,
      { surface: 'concrete', flags: BF.NO_COVER, tint: b.jitterTint(0.04) });
    // A paving pattern: bands of darker stone in a grid, which is what makes
    // a plaza read as designed from a roof above it.
    for (let x = PLAZA.x0 + 3; x < PLAZA.x1; x += 6) p.paintMarking(x, PLAZA.z0, x + 0.22, PLAZA.z1, PAVE + 0.09, M.concreteDark);
    for (let z = PLAZA.z0 + 3; z < PLAZA.z1; z += 6) p.paintMarking(PLAZA.x0, z, PLAZA.x1, z + 0.22, PAVE + 0.09, M.concreteDark);
    p.fountain(plaza.x, PAVE + 0.08, plaza.z, 3.2);
    // Trees in a square, with benches between them.
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        const tx = PLAZA.x0 + 5 + i * ((PLAZA.x1 - PLAZA.x0 - 10) / 3);
        const tz = PLAZA.z0 + 5 + j * ((PLAZA.z1 - PLAZA.z0 - 10) / 2);
        if (Math.hypot(tx - plaza.x, tz - plaza.z) < 7) continue;
        if (tx < CANTINA.x1 + 2 && tz < CANTINA.z1 + 4) continue;
        b.cyl(tx, PAVE + 0.3, tz, 0.9, 0.3, M.stoneTrim, { surface: 'concrete' });
        p.shadeTree(tx, PAVE + 0.6, tz, rng.range(6.5, 8.5));
        b.span(tx + 1.4, PAVE + 0.08, tz - 1.0, tx + 1.9, PAVE + 0.5, tz + 1.0, M.woodWeathered, { surface: 'wood' });
      }
    }
    // A bandstand kiosk on the north side of the fountain.
    const kx = plaza.x, kz = plaza.z + 12;
    b.cyl(kx, PAVE + 0.4, kz, 3.6, 0.4, M.stoneTrim, { surface: 'concrete' });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.cyl(kx + Math.cos(a) * 3.2, PAVE + 2.0, kz + Math.sin(a) * 3.2, 0.12, 1.6, M.chalkWhite, { surface: 'metal' });
    }
    b.cyl(kx, PAVE + 3.8, kz, 3.9, 0.22, M.terracottaOld, { surface: 'ceramic', flags: BF.NO_COVER });
    b.cyl(kx, PAVE + 4.3, kz, 2.4, 0.3, M.terracottaOld, { surface: 'ceramic', flags: BF.NO_COVER });
    // Market stalls along the plaza's east edge — waist-high cover in rows.
    for (let i = 0; i < 6; i++) {
      const sz = PLAZA.z0 + 4 + i * 6.4;
      const sx = PLAZA.x1 - 3.2;
      p.table(sx, PAVE + 0.08, sz, Math.PI / 2, 2.2, 1.0, 0.86, M.woodWeathered);
      b.span(sx - 1.4, PAVE + 2.3, sz - 1.4, sx + 1.4, PAVE + 2.4, sz + 1.4,
        [M.fabricRed, M.fabricTeal, M.fabricCream, M.paintBlue][i % 4], { surface: 'fabric', flags: BF.NO_COVER | BF.NO_NAV });
      for (const [ox, oz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]] as const) {
        b.box(sx + ox, PAVE + 1.2, sz + oz, 0.04, 1.15, 0.04, M.woodDark, { surface: 'wood', flags: BF.NO_COVER | BF.THIN });
      }
      for (let q = 0; q < 3; q++) p.crate(sx - 0.6 + q * 0.6, PAVE + 0.94, sz, rng.range(0, 3), 0.18);
    }
    for (let i = 0; i < 6; i++) {
      k.lights.push({ position: { x: PLAZA.x0 + 4 + i * 7, y: PAVE + 4.8, z: PLAZA.z0 + 2 }, color: 0xffc27a, intensity: 70, distance: 18, alwaysOn: false });
      p.streetLamp(PLAZA.x0 + 4 + i * 7, PAVE + 0.08, PLAZA.z0 + 1.2, 5.0);
    }
    k.lights.push({ position: { x: kx, y: PAVE + 3.3, z: kz }, color: 0xffd49a, intensity: 40, distance: 14, alwaysOn: true });
    b.room({ name: 'Plaza', tag: 'plaza', indoors: false, minX: PLAZA.x0, maxX: PLAZA.x1, minZ: PLAZA.z0, maxZ: PLAZA.z1, minY: PAVE, maxY: PAVE + 8 });
  }

  // --- the church, on the plaza's west side ---------------------------------
  const church = { x: PLAZA.x0 - 9, z: plaza.z };
  {
    const x0 = PLAZA.x0 - 18, x1 = PLAZA.x0 - 0.5, z0 = plaza.z - 8, z1 = plaza.z + 8;
    const H = 8.5, y = PAVE;
    const nave = b.room({ name: 'Parroquia, nave', tag: 'church', indoors: true, minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: y, maxY: y + H });
    k.rooms.push({ name: 'Parroquia, nave', tag: 'church', indoors: true, minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: y, maxY: y + H, buildingId: 0 });
    b.span(x0, y, z0, x1, y + 0.1, z1, M.tileTerra, { surface: 'tile', flags: BF.NO_COVER, room: nave });
    const cp = { every: 3.4, jitter: 0.03, variants: [M.chalkWhite, M.chalkWhite, M.plasterCream] };
    // Facade onto the plaza, with the big doors.
    b.wall({ x0: x1, z0, x1, z1, y, height: H + 3, thickness: 0.5, mat: M.chalkWhite, panel: cp, room: nave,
      openings: [
        { ...doorOp(8, 2.4, 'Parroquia doors', nave), y1: 3.6 },
        winOp(3.0, 1.0, 3.2, 6.4), winOp(13.0, 1.0, 3.2, 6.4),
      ] });
    // The rose window over the doors is applied to the face rather than cut
    // as an opening: an opening's sill is solid from the wall base up, so a
    // window directly above the doors filled the doorway with masonry.
    b.box(x1 + 0.27, y + 8.3, (z0 + z1) / 2, 0.02, 1.0, 1.0, M.glass,
      { surface: 'glass', flags: BF.NO_COVER | BF.NO_NAV | BF.THIN | BF.NO_COLLIDE });
    b.box(x1 + 0.29, y + 8.3, (z0 + z1) / 2, 0.02, 1.15, 0.12, M.stoneTrim,
      { surface: 'concrete', flags: BF.NO_COVER | BF.NO_NAV | BF.THIN | BF.NO_COLLIDE });
    b.box(x1 + 0.29, y + 8.3, (z0 + z1) / 2, 0.02, 0.12, 1.15, M.stoneTrim,
      { surface: 'concrete', flags: BF.NO_COVER | BF.NO_NAV | BF.THIN | BF.NO_COLLIDE });
    for (const zz of [z0, z1]) {
      b.wall({ x0, z0: zz, x1, z1: zz, y, height: H, thickness: 0.45, mat: M.chalkWhite, panel: cp, room: nave,
        openings: [winOp(4.5, 0.9, 3.0, 6.0), winOp(9.5, 0.9, 3.0, 6.0), winOp(14.5, 0.9, 3.0, 6.0)] });
    }
    b.wall({ x0, z0, x1: x0, z1, y, height: H, thickness: 0.45, mat: M.chalkWhite, panel: cp, room: nave,
      openings: [doorOp(3, 0.9, 'Sacristy door', nave, { locked: true })] });
    b.gableRoof(x0, z0, x1 - 0.3, z1, y + H, 3.2, M.terracottaOld, 0.5);
    // Twin bell towers on the facade corners.
    for (const tz of [z0 - 0.2, z1 - 3.8]) {
      const tw = b.room({ name: 'Bell tower', tag: 'tower', indoors: true, minX: x1 - 4, maxX: x1, minZ: tz, maxZ: tz + 4, minY: y, maxY: y + 18 });
      for (const [ax, az, bx2, bz] of [[x1 - 4, tz, x1, tz], [x1 - 4, tz + 4, x1, tz + 4], [x1 - 4, tz, x1 - 4, tz + 4], [x1, tz, x1, tz + 4]] as const) {
        b.wall({ x0: ax, z0: az, x1: bx2, z1: bz, y: y + H + 3, height: 7, thickness: 0.4, mat: M.chalkWhite, room: tw,
          openings: [{ at: 2, width: 1.8, y0: 2.4, y1: 5.6, kind: 'arch' }], panel: cp });
      }
      b.span(x1 - 4.3, y + H + 2.8, tz - 0.3, x1 + 0.3, y + H + 3.1, tz + 4.3, M.stoneTrim, { surface: 'concrete' });
      b.gableRoof(x1 - 4, tz, x1, tz + 4, y + H + 10, 2.4, M.terracottaOld, 0.3);
      b.cyl(x1 - 2, y + H + 6.6, tz + 2, 0.6, 0.55, M.brass, { surface: 'metal' });
      b.box(x1 - 2, y + H + 13.6, tz + 2, 0.06, 0.8, 0.06, M.sootMetal, { surface: 'metal' });
      b.box(x1 - 2, y + H + 13.9, tz + 2, 0.06, 0.06, 0.4, M.sootMetal, { surface: 'metal' });
    }
    // A stair inside the north tower up to the belfry — the town's highest
    // perch, and it overlooks the whole plaza and the Calle Real.
    b.ladder(x1 - 2, z1 - 2.2, Math.PI / 2, y, y + H + 3.3);
    for (let r = 0; r < 7; r++) {
      for (const side of [-1, 1]) {
        const zc = (z0 + z1) / 2 + side * 3.6;
        b.span(x0 + 3 + r * 1.8, y + 0.1, zc - 2.4, x0 + 3.4 + r * 1.8, y + 0.55, zc + 2.4, M.woodDark, { surface: 'wood', room: nave });
      }
    }
    b.span(x0 + 0.6, y + 0.1, (z0 + z1) / 2 - 2, x0 + 2.2, y + 1.1, (z0 + z1) / 2 + 2, M.stoneTrim, { surface: 'concrete', room: nave });
    for (let c = 0; c < 9; c++) {
      b.cyl(x0 + 1.4, y + 1.25, (z0 + z1) / 2 - 1.6 + c * 0.4, 0.03, 0.15, M.lampWarm, { surface: 'glass', flags: BF.NO_COVER | BF.NO_NAV });
    }
    k.lights.push({ position: { x: x0 + 2, y: y + 2, z: (z0 + z1) / 2 }, color: 0xffb464, intensity: 30, distance: 14, alwaysOn: true });
    k.lights.push({ position: { x: (x0 + x1) / 2, y: y + H - 1, z: (z0 + z1) / 2 }, color: 0xffd9a8, intensity: 90, distance: 20, alwaysOn: false });
  }

  // --- the cantina: the plaza's north side, where the principal's men drink --
  // In the plaza's south-west corner, facing into it.
  const bar = { x: CANTINA.x0 + 8, z: CANTINA.z0 + 5.5 };
  building(k, { frame: new Frame(CANTINA.x1, CANTINA.z1, 'north'), w: 16, d: 11, y: PAVE + 0.08, storeys: 2, style: 'bar', name: 'Cantina El Farol' });
  // Tables out front of it on the plaza.
  for (let i = 0; i < 4; i++) {
    const tx = CANTINA.x0 + 2.5 + i * 3.6, tz = CANTINA.z1 + 2.6;
    p.table(tx, PAVE + 0.08, tz, 0, 0.9, 0.9, 0.76, M.woodDark);
    p.chair(tx - 0.7, PAVE + 0.08, tz, Math.PI / 2);
    p.chair(tx + 0.7, PAVE + 0.08, tz, -Math.PI / 2);
    p.parasol(tx, PAVE + 0.08, tz);
  }

  // ==========================================================================
  // THE CHECKPOINT at the town entrance — the loud approach announces itself
  // ==========================================================================
  {
    const cz = TOWN_Z1 + 7;
    p.jerseyBarrier(-2.6, PAVE, cz - 3, 0, 3.6);
    p.jerseyBarrier(2.8, PAVE, cz + 2, 0, 3.6);
    p.jerseyBarrier(-2.2, PAVE, cz + 7, 0, 3.0);
    p.sandbags(MAIN + 0.6, cz - 5, MAIN + 4.2, cz - 3.8, PAVE, 3);
    p.sandbags(-MAIN - 4.2, cz + 4, -MAIN - 0.6, cz + 5.2, PAVE, 3);
    building(k, { frame: new Frame(-MAIN - 2.2, cz - 3, 'east'), w: 6, d: 5, y: PAVE, storeys: 1, style: 'house', name: 'Checkpoint post' });
    p.floodlight(MAIN + 2, PAVE, cz, Math.PI, 5.2);
    k.lights.push({ position: { x: MAIN + 1.4, y: PAVE + 5, z: cz }, color: 0xe8f0ff, intensity: 160, distance: 26, alwaysOn: false });
    p.pickup(MAIN + 5, PAVE, cz + 6, 0.35, M.sootMetal);
    // A painted welcome arch over the road, which is what makes a town
    // entrance read at 200 m.
    for (const ax of [-MAIN - 1.2, MAIN + 1.2]) b.box(ax, PAVE + 3.2, cz + 12, 0.35, 3.2, 0.35, M.chalkWhite, { surface: 'concrete' });
    b.span(-MAIN - 1.6, PAVE + 6.4, cz + 11.6, MAIN + 1.6, PAVE + 7.4, cz + 12.4, M.chalkWhite, { surface: 'concrete', flags: BF.NO_COVER });
    p.signPlate(0, PAVE + 6.9, cz + 11.5, Math.PI, 5.6, 0.7, M.plasterWhite);
  }

  // Make sure nothing indoors is unlit and nothing in the streets is bare.
  meadow(k, -EDGE_X - 6, 76, EDGE_X + 6, 78, PAD, 6);

  b.endBuilding();
  console.info(`[town] ${k.rooms.length} rooms, ${k.lights.length} fixtures`);

  return {
    rooms: k.rooms,
    lights: k.lights,
    plaza, church, bar,
    insertions: [
      { id: 'town-entrance', x: 0, z: TOWN_Z1 + 30, label: 'Town entrance, south road' },
      { id: 'plaza', x: plaza.x, z: plaza.z, label: 'The plaza' },
    ],
  };
}

void archOp;
