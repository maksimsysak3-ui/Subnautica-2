/**
 * Barrio Santa Muerte — the third site.
 *
 * OWNED BY: World design team.
 *
 * ## The question this map asks
 * Casa Verdugo is flat, walled and horizontal: the defender knows the four
 * directions you can come from. Meridian Quay is orthogonal and industrial,
 * and its verticality lives in a handful of chokepoints — one stair, one
 * ladder, one catwalk. Both maps answer "who holds the height?" with "whoever
 * holds the door".
 *
 * This one has no door to hold. It is a block of houses clinging to a hillside
 * in six terraces, sixteen metres of rise from the bottom street to the church
 * at the top, and the roofs of each row of houses are flush with the street of
 * the row above — so **the roofs are the street network**. Height is won by
 * moving across roofs, and every roof is overlooked by the one above it. There
 * is no top you can hold, because the hill keeps going; the defender's
 * advantage is uphill, and the attacker's is that uphill positions have their
 * backs to a drop.
 *
 * ## Layout, bottom to top (z rises uphill)
 *
 *   T5  z  33..50   church + bell tower (the high point), top street
 *   T4  z  17..33   the rich row: two-storey houses, roof bridges
 *   T3  z   0..17   the cistern — landmark, climbable, silhouetted
 *   T2  z -17..0    the terrace: shops, the market
 *   T1  z -33..-17  the cancha — the one open space, and where it goes loud
 *   T0  z -50..-33  bottom street, six alley mouths, the insertion edge
 *
 *   x -60..-55  THE CUT — a walled storm channel with its own stairs, the
 *               covered stealth spine top to bottom
 *   x  -2.5..2.5 THE STAIR — the public staircase, the fast route, and a
 *               kill channel overlooked from every row
 *
 * ## What the first two maps taught
 * Every lesson from the critic sweeps is built in from the start rather than
 * retrofitted: walls panelised, value anchors in the palette, a light plan
 * with one fixture per room, dressing kept out of doorways, services stood off
 * the wall face, and decals stepped so nothing z-fights.
 */

import { Rng } from '../../core/math';
import { SiteBuilder } from '../builder';
import { Props } from '../props';
import { M } from '../palette';
import { BF, type SiteInstance, type WallOpening, type SiteBuildResult, type RoomSpec, type NavLink } from '../types';

type Fixture = NonNullable<SiteBuildResult['lights']>[number];

const PAD = 2.0;
/** Rise per terrace, and the storey height, deliberately identical. */
const RISE = 3.2;
const TERRACES = 6;
const X0 = -60, X1 = 60;
const Z0 = -50, Z1 = 50;
const BAND = (Z1 - Z0) / TERRACES;          // 16.67 m per terrace
/** Depth of each row of houses, backed onto the retaining wall above. */
const HOUSE_D = 8.0;

const DOOR_H = 2.1;
const W = 0.22;

/** Terrace i: z extent and walking level. */
const tz0 = (i: number): number => Z0 + i * BAND;
const tz1 = (i: number): number => Z0 + (i + 1) * BAND;
const ty = (i: number): number => PAD + i * RISE;

/** Plaster colours of the barrio, weighted toward the dull ones. */
const HOUSE_MATS = [
  M.plasterRose, M.plasterSage, M.plasterOchre, M.plasterCream, M.stucco,
  M.chalkWhite, M.concreteRaw, M.brickRed, M.plasterRose, M.stucco,
  M.brickRed, M.concreteRaw,
];

function doorOp(at: number, width: number, name: string, roomA: number, o: { locked?: boolean } = {}): WallOpening {
  return {
    at, width, y0: 0, y1: DOOR_H, kind: 'door',
    doorSpec: {
      name, roomA, roomB: -1, material: 'wood',
      locked: o.locked, hinge: 1, swing: 1, breachable: true,
    },
  };
}
const winOp = (at: number, width: number, y0: number, y1: number): WallOpening =>
  ({ at, width, y0, y1, kind: 'window', glazed: true });
const holeOp = (at: number, width: number, h: number): WallOpening =>
  ({ at, width, y0: 0, y1: h, kind: 'hole' });

export function buildBarrio(b: SiteBuilder, rng: Rng): SiteBuildResult {
  const p = new Props(b);
  const rooms: RoomSpec[] = [];
  const navLinks: NavLink[] = [];
  const lights: Fixture[] = [];
  const light = (x: number, y: number, z: number, color: number, intensity: number, distance: number, alwaysOn = false): void => {
    lights.push({ position: { x, y, z }, color, intensity, distance, alwaysOn });
  };
  const room = (
    name: string, tag: string, indoors: boolean,
    x0: number, z0: number, x1: number, z1: number, y0: number, y1: number,
  ): number => {
    const spec = {
      name, tag, indoors,
      minX: Math.min(x0, x1), maxX: Math.max(x0, x1),
      minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1),
      minY: y0, maxY: y1,
    };
    const id = b.room(spec);
    rooms.push({ ...spec, buildingId: 0 });
    return id;
  };

  b.building('Barrio');

  // ==========================================================================
  // THE HILL — six terraces, each a solid mass, retaining wall on the front
  // ==========================================================================
  //
  // Each terrace occupies only its own band of z, so no two masses overlap
  // and none of their faces are coplanar. The front face of terrace i is the
  // retaining wall, and a panelised facing is built in front of it that runs
  // a metre above the terrace top — which is the parapet you shoot down from.
  for (let i = 0; i < TERRACES; i++) {
    b.span(X0, PAD - 0.8, tz0(i), X1, ty(i), tz1(i), M.concreteRaw,
      { surface: 'concrete', flags: BF.NO_COVER, tint: b.jitterTint(0.04) });
    // Street paving on the front half of the terrace.
    b.span(X0, ty(i), tz0(i), X1, ty(i) + 0.03, tz0(i) + (BAND - HOUSE_D), i % 2 ? M.asphalt : M.concreteDark,
      { surface: 'concrete', flags: BF.NO_COVER, tint: b.jitterTint(0.05) });
  }

  // Where each flight of stairs cuts through a retaining wall. The Stair is
  // the spine; the Cut is the covered west channel; the rest are alley stairs
  // and are chosen per terrace so no two rows line up.
  const STAIR_X = 0;
  const CUT_X = -57.5;
  const alleyStairs: number[][] = [];
  for (let i = 1; i < TERRACES; i++) {
    const xs: number[] = [];
    for (const base of [-38, -18, 22, 42]) {
      if (rng.next() < 0.55) xs.push(base + rng.range(-4, 4));
    }
    if (xs.length === 0) xs.push(rng.next() < 0.5 ? -26 : 30);
    alleyStairs.push(xs);
  }

  for (let i = 1; i < TERRACES; i++) {
    const z = tz0(i);
    const holes: WallOpening[] = [
      holeOp(STAIR_X - X0, 5.2, RISE + 1.2),
      holeOp(CUT_X - X0, 3.4, RISE + 1.2),
      ...alleyStairs[i - 1].map((x) => holeOp(x - X0, 2.0, RISE + 1.2)),
    ];
    b.wall({
      x0: X0, z0: z - 0.22, x1: X1, z1: z - 0.22, y: ty(i - 1), height: RISE + 1.0,
      thickness: 0.44, mat: M.stoneTrim, surface: 'concrete', jitter: 0.06,
      openings: holes,
      panel: {
        every: 3.8, jitter: 0.12,
        variants: [M.stoneTrim, M.concreteRaw, M.stucco, M.brickRed, M.concreteDark],
      },
    });

    // The Stair: wide, public, straight up the middle of the hill.
    b.stairs({
      x: STAIR_X, z: z - 5.6, dirX: 0, dirZ: 1, width: 4.6,
      fromY: ty(i - 1), toY: ty(i), run: 5.4, mat: M.concreteRaw, railMat: M.steelDark,
    });
    // The Cut's own flight.
    b.stairs({
      x: CUT_X, z: z - 5.6, dirX: 0, dirZ: 1, width: 3.0,
      fromY: ty(i - 1), toY: ty(i), run: 5.4, mat: M.concreteDark,
    });
    // Alley stairs: narrow, steep, and they arrive between two houses.
    for (const x of alleyStairs[i - 1]) {
      b.stairs({
        x, z: z - 4.4, dirX: 0, dirZ: 1, width: 1.5,
        fromY: ty(i - 1), toY: ty(i), run: 4.2, mat: M.concreteRaw, railMat: M.steelGalv,
      });
    }
  }

  // Parapet across the very top and down the open sides.
  b.wall({
    x0: X0, z0: Z1 - 0.2, x1: X1, z1: Z1 - 0.2, y: ty(TERRACES - 1), height: 1.1, thickness: 0.36,
    mat: M.stucco, jitter: 0.05, panel: { every: 4, jitter: 0.1, variants: [M.stucco, M.concreteRaw] },
  });
  for (let i = 0; i < TERRACES; i++) {
    for (const x of [X0 + 0.2, X1 - 0.2]) {
      b.wall({
        x0: x, z0: tz0(i), x1: x, z1: tz1(i), y: ty(i), height: 1.0, thickness: 0.3,
        mat: M.concreteRaw, jitter: 0.06,
      });
    }
  }

  // The Cut: a tall wall down its east side, so the channel is covered all the
  // way and has no exits along most of its length. Gaps at each terrace street
  // let you commit into a row.
  for (let i = 0; i < TERRACES; i++) {
    b.wall({
      x0: -55.2, z0: tz0(i) + 0.2, x1: -55.2, z1: tz1(i) - 0.2, y: ty(i), height: 3.0,
      thickness: 0.3, mat: M.concreteDark, jitter: 0.05,
      openings: [holeOp(2.6, 2.4, 3.0)],
      panel: { every: 3.2, jitter: 0.1, variants: [M.concreteDark, M.concreteRaw, M.rust] },
    });
  }
  room('The Cut', 'channel', false, X0, Z0, -55, Z1, PAD, ty(TERRACES - 1) + 3);

  // ==========================================================================
  // HOUSES — rows backed onto the retaining wall, roofs flush with the street
  // ==========================================================================
  const reserved = (i: number): Array<[number, number]> => {
    const r: Array<[number, number]> = [[-56, -52], [-3.2, 3.2]];
    for (const x of alleyStairs[i] ?? []) r.push([x - 1.4, x + 1.4]);
    if (i === 1) r.push([12, 40]);          // the cancha
    if (i === 3) r.push([-38, -22]);        // the cistern
    if (i === 5) r.push([5, 21]);           // the church
    return r;
  };

  let houseNo = 0;
  const house = (x0: number, x1: number, i: number, storeys: number): void => {
    houseNo++;
    const y = ty(i);
    const zb = tz1(i) - 0.12;                 // back, 12 cm clear of the retaining face
    const zf = zb - HOUSE_D;                  // front, onto the street
    const H = RISE * storeys;
    const mat = HOUSE_MATS[Math.floor(rng.next() * HOUSE_MATS.length)];
    const panel = { every: 3.0, jitter: 0.05, variants: [mat, mat, M.concreteRaw, M.brickRed] };
    const name = `House ${houseNo}`;
    const w = x1 - x0;

    const rGround = room(`${name}, ground`, 'house', true, x0, zf, x1, zb, y, y + RISE);
    const rUpper = storeys > 1 ? room(`${name}, upper`, 'house', true, x0, zf, x1, zb, y + RISE, y + H) : -1;

    b.slab(x0, zf, x1, zb, y + 0.1, 0.1, rng.next() < 0.5 ? M.tileTerra : M.concreteDark, { room: rGround });

    // Front: the door, and a window per storey either side of it.
    const doorAt = w * (rng.next() < 0.5 ? 0.32 : 0.68);
    const front: WallOpening[] = [doorOp(doorAt, 1.0, `${name} door`, rGround, { locked: rng.next() < 0.12 })];
    const winAt = doorAt < w / 2 ? w * 0.78 : w * 0.24;
    front.push(winOp(winAt, 1.2, 1.0, 2.2));
    if (storeys > 1) {
      front.push(winOp(w * 0.28, 1.2, RISE + 1.0, RISE + 2.2));
      front.push(winOp(w * 0.72, 1.2, RISE + 1.0, RISE + 2.2));
    }
    b.wall({ x0, z0: zf, x1, z1: zf, y, height: H, thickness: W, mat, openings: front, panel, room: rGround });
    // Sides: one small window each on some houses, which is what makes an
    // alley a sightline instead of a corridor.
    for (const [sx, dir] of [[x0, 1], [x1, -1]] as const) {
      const ops: WallOpening[] = rng.next() < 0.45 ? [winOp(HOUSE_D * 0.5, 0.8, 1.2, 2.0)] : [];
      if (storeys > 1 && rng.next() < 0.5) ops.push(winOp(HOUSE_D * 0.35, 0.8, RISE + 1.2, RISE + 2.0));
      void dir;
      b.wall({ x0: sx, z0: zf, x1: sx, z1: zb, y, height: H, thickness: W, mat, openings: ops, panel, room: rGround });
    }
    b.wall({ x0, z0: zb, x1, z1: zb, y, height: H, thickness: W, mat, panel, room: rGround });

    // Upper floor, with a stair up the inside of one side wall.
    if (storeys > 1) {
      const sx = x0 + 0.7;
      b.slab(x0, zf, x1, zb, y + RISE, 0.18, M.concreteDark, {
        room: rUpper, holes: [[x0 + 0.2, zb - 4.6, x0 + 1.3, zb - 0.3]],
      });
      b.stairs({
        x: sx, z: zb - 4.6, dirX: 0, dirZ: 1, width: 0.9,
        fromY: y + 0.1, toY: y + RISE, run: 4.2, mat: M.concreteRaw, room: rGround,
      });
    }

    // The roof. A one-storey roof sits exactly at the next street's level,
    // so it IS part of the street above — parapet on the front and sides
    // only, and none against the hill.
    const roofY = y + H;
    b.slab(x0, zf, x1, zb, roofY, 0.2, M.concreteDark, { surface: 'concrete' });
    const par = storeys > 1 ? 1.0 : 0.75;
    b.wall({ x0, z0: zf, x1, z1: zf, y: roofY, height: par, thickness: 0.2, mat, jitter: 0.05,
      coping: { mat: M.stoneTrim, height: 0.08, overhang: 0.05 } });
    for (const sx of [x0, x1]) {
      b.wall({ x0: sx, z0: zf, x1: sx, z1: zb - (storeys > 1 ? 0 : 1.6), y: roofY, height: par,
        thickness: 0.2, mat, jitter: 0.05 });
    }
    if (storeys > 1) {
      b.wall({ x0, z0: zb, x1, z1: zb, y: roofY, height: par, thickness: 0.2, mat, jitter: 0.05 });
      // Two-storey roofs stand 3.2 m above the street behind them. A ladder
      // on the back makes each one a perch you can reach, and lose.
      b.ladder(x0 + w * 0.5, zb + 0.35, 0, roofY - RISE, roofY + 0.4);
    }

    // Roof life: tanks, dishes, aerials, a line of washing. This is the
    // silhouette of the whole map.
    const r = rng.next();
    if (r < 0.62) {
      const tx = x0 + w * rng.range(0.25, 0.75), tz = zf + HOUSE_D * rng.range(0.3, 0.7);
      for (const [lx, lz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]] as const) {
        b.box(tx + lx, roofY + 0.45, tz + lz, 0.05, 0.45, 0.05, M.steelGalv, { surface: 'metal', flags: BF.NO_COVER });
      }
      p.waterTank(tx, roofY + 0.9, tz, 0.72, 1.2);
    }
    if (rng.next() < 0.45) p.satelliteDish(x0 + w * 0.2, roofY, zf + 1.2, rng.range(-0.5, 0.5), 0.55);
    if (rng.next() < 0.55) p.roofAerial(x1 - 0.8, roofY, zb - 1.2, rng.range(1.2, 2.6));
    if (rng.next() < 0.35) p.acUnit(x0 + 1.0, roofY, zf + 2.4, 0);
    if (rng.next() < 0.5) {
      // Washing line across the roof, with the washing on it.
      const ly = roofY + 1.6;
      b.span(x0 + 0.6, ly, zf + 3.0, x1 - 0.6, ly + 0.02, zf + 3.03, M.fabricCream,
        { surface: 'fabric', flags: BF.NO_COVER | BF.NO_NAV | BF.THIN | BF.NO_COLLIDE });
      for (let k = 0; k < 5; k++) {
        const cx = x0 + 1 + k * (w - 2) / 5 + rng.range(0, 0.4);
        b.box(cx, ly - 0.32, zf + 3.01, rng.range(0.18, 0.34), 0.3, 0.012,
          [M.fabricRed, M.fabricTeal, M.plasterWhite, M.fabricCream, M.paintBlue][k % 5],
          { surface: 'fabric', flags: BF.NO_COVER | BF.NO_NAV | BF.THIN | BF.NO_COLLIDE | BF.NO_SHADOW });
      }
    }

    // Inside: a family lives here. Bed at the back, table in the middle,
    // storage on the wall away from the door — and nothing within reach of
    // the doorway, which is the lesson the first two maps taught.
    const iy = y + 0.1;
    const farSide = doorAt < w / 2 ? 1 : -1;
    const cx = (x0 + x1) / 2;
    p.bed(cx + farSide * (w / 2 - 1.3), iy, zb - 1.3, 0, 1.4, 1.9);
    p.table(cx - farSide * 0.8, iy, zf + HOUSE_D * 0.55, rng.range(-0.2, 0.2), 1.3, 0.8, 0.76);
    p.chair(cx - farSide * 0.8 - 0.9, iy, zf + HOUSE_D * 0.55, Math.PI / 2);
    p.chair(cx - farSide * 0.8 + 0.9, iy, zf + HOUSE_D * 0.55, -Math.PI / 2);
    p.wardrobe(x0 + (farSide > 0 ? w - 0.4 : 0.4), iy, zf + 2.6, farSide > 0 ? -Math.PI / 2 : Math.PI / 2, 1.2, 1.9);
    if (rng.next() < 0.6) p.rug(cx, iy + 0.01, zf + HOUSE_D * 0.55, 0, 2.4, 1.6,
      rng.next() < 0.5 ? M.fabricRed : M.fabricTeal);
    if (rng.next() < 0.5) p.shelf(cx - farSide * (w / 2 - 0.45), iy, zb - 0.4, Math.PI, 1.1, 1.8);
    if (rng.next() < 0.4) p.fridge(x0 + 0.5, iy, zb - 3.2, Math.PI / 2);
    light(cx, y + RISE - 0.5, (zf + zb) / 2, 0xffd49a, 7.5, 9);
    if (storeys > 1) {
      p.bed(cx, y + RISE, zb - 1.4, 0, 1.6, 2.0);
      p.sofa(cx + farSide * 1.2, y + RISE, zf + 1.6, Math.PI, 1.8);
      p.table(cx - farSide * 1.2, y + RISE, zf + 3.0, 0, 1.0, 0.6, 0.5);
      light(cx, y + 2 * RISE - 0.5, (zf + zb) / 2, 0xffd49a, 7.5, 9);
    }
    // Walls you walk past get services — stood off the FACE, not the centre.
    p.services(x0, zf, x1, zf, y, H, -1, 0.5, W);
  };

  for (let i = 0; i < TERRACES; i++) {
    const res = reserved(i);
    let x = X0 + 5.6;
    while (x < X1 - 5) {
      const wdt = rng.range(5.8, 8.6);
      let x1 = Math.min(x + wdt, X1 - 1.2);
      // Stop short of anything reserved.
      const hit = res.find(([a, c]) => x1 > a && x < c);
      if (hit) {
        if (hit[0] - x > 4.5) x1 = hit[0] - 0.4;
        else { x = hit[1] + rng.range(1.2, 2.2); continue; }
      }
      if (x1 - x >= 4.5) {
        const storeys = i >= 4 ? (rng.next() < 0.7 ? 2 : 1) : (rng.next() < 0.3 ? 2 : 1);
        house(x, x1, i, storeys);
      }
      // Alley: 1.6 to 2.6 m, which is the width a firefight in a barrio
      // actually happens at.
      x = x1 + rng.range(1.6, 2.6);
    }
  }

  // ==========================================================================
  // THE CANCHA — terrace 1, the one open space on the map
  // ==========================================================================
  {
    const y = ty(1);
    const cx0 = 14, cx1 = 38, cz0 = tz0(1) + 2.4, cz1 = tz1(1) - 1.4;
    b.span(cx0, y, cz0, cx1, y + 0.05, cz1, M.concreteRaw, { surface: 'concrete', flags: BF.NO_COVER });
    // Court markings and two goals.
    p.paintMarking(cx0 + 0.6, cz0 + 0.6, cx1 - 0.6, cz0 + 0.72, y + 0.05);
    p.paintMarking(cx0 + 0.6, cz1 - 0.72, cx1 - 0.6, cz1 - 0.6, y + 0.05);
    p.paintMarking((cx0 + cx1) / 2 - 0.06, cz0 + 0.6, (cx0 + cx1) / 2 + 0.06, cz1 - 0.6, y + 0.05);
    for (const gx of [cx0 + 0.9, cx1 - 0.9]) {
      const mid = (cz0 + cz1) / 2;
      for (const gz of [mid - 1.6, mid + 1.6]) b.box(gx, y + 1.0, gz, 0.05, 1.0, 0.05, M.plasterWhite, { surface: 'metal' });
      b.box(gx, y + 2.0, mid, 0.05, 0.05, 1.65, M.plasterWhite, { surface: 'metal', flags: BF.NO_COVER });
    }
    // Chain fence round the court, waist-high block wall along the drop.
    for (const [ax, az, bx, bz] of [[cx0, cz0, cx0, cz1], [cx1, cz0, cx1, cz1]] as const) {
      b.wall({ x0: ax, z0: az, x1: bx, z1: bz, y, height: 3.2, thickness: 0.05, mat: M.steelGalv,
        surface: 'metal', flags: BF.SOFT, openings: [holeOp(2.0, 1.6, 2.4)] });
    }
    // Floodlight masts at the corners — the map's brightest place at night,
    // and exactly why you do not cross it then.
    for (const [fx, fz] of [[cx0, cz0], [cx1, cz0], [cx0, cz1], [cx1, cz1]] as const) {
      p.floodlight(fx, y, fz, Math.atan2((cx0 + cx1) / 2 - fx, (cz0 + cz1) / 2 - fz), 8.5);
      light(fx + (fx < 26 ? 1.5 : -1.5), y + 8, fz + (fz < 0 ? 1.5 : -1.5), 0xe8f0ff, 260, 34);
    }
    // Bleacher steps along the back, against the retaining wall.
    for (let k = 0; k < 3; k++) {
      b.span(cx0 + 2, y, cz1 - 0.4 - (3 - k) * 0.9, cx1 - 2, y + 0.45 * (k + 1), cz1 - 0.4 - (2 - k) * 0.9,
        M.concreteRaw, { surface: 'concrete' });
    }
    room('The cancha', 'plaza', false, cx0, cz0, cx1, cz1, y, y + 8);
  }

  // ==========================================================================
  // THE CISTERN — terrace 3, the landmark everybody wants and nobody can hold
  // ==========================================================================
  {
    const y = ty(3), cx = -30, cz = (tz0(3) + tz1(3)) / 2 - 1;
    b.cyl(cx, y + 3.5, cz, 4.6, 3.5, M.concreteRaw, { surface: 'concrete', tint: b.jitterTint(0.04) });
    b.cyl(cx, y + 7.08, cz, 4.8, 0.08, M.concreteDark, { surface: 'concrete' });
    // Rust bands and the stains from the overflow.
    for (const by of [1.6, 4.4]) {
      b.cyl(cx, y + by, cz, 4.66, 0.07, M.rust, { surface: 'metal', flags: BF.NO_COVER });
    }
    b.ladder(cx, cz - 4.75, 0, y, y + 7.6);
    // A railing round the top — sitting up there you are silhouetted against
    // the whole sky, which is the price of seeing both halves of the map.
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      b.box(cx + Math.cos(a) * 4.5, y + 7.6, cz + Math.sin(a) * 4.5, 0.04, 0.45, 0.04, M.steelGalv,
        { surface: 'metal', flags: BF.NO_COVER | BF.THIN });
    }
    p.roofAerial(cx + 1.5, y + 7.16, cz + 1.0, 3.2);
    room('Cistern top', 'overwatch', false, cx - 4.6, cz - 4.6, cx + 4.6, cz + 4.6, y + 7.1, y + 9.5);
    light(cx, y + 8.8, cz, 0xffd9a8, 40, 18);
  }

  // ==========================================================================
  // THE CHURCH — terrace 5, the top of the Stair and the natural last stand
  // ==========================================================================
  {
    const y = ty(5), x0 = 6, x1 = 20, zf = tz0(5) + 3.2, zb = tz1(5) - 0.8;
    const H = 6.4;
    const nave = room('Church, nave', 'church', true, x0, zf, x1, zb, y, y + H);
    b.slab(x0, zf, x1, zb, y + 0.1, 0.1, M.tileTerra, { room: nave });
    const cp = { every: 3.4, jitter: 0.04, variants: [M.chalkWhite, M.chalkWhite, M.plasterCream] };
    b.wall({ x0, z0: zf, x1, z1: zf, y, height: H, thickness: 0.4, mat: M.chalkWhite, panel: cp, room: nave,
      openings: [
        { ...doorOp(7.0, 1.8, 'Church doors', nave), y1: 3.0 },
        winOp(2.6, 0.9, 2.4, 4.8), winOp(11.4, 0.9, 2.4, 4.8),
      ] });
    for (const sx of [x0, x1]) {
      b.wall({ x0: sx, z0: zf, x1: sx, z1: zb, y, height: H, thickness: 0.4, mat: M.chalkWhite, panel: cp,
        room: nave, openings: [winOp(4.0, 0.8, 2.6, 5.0), winOp(9.0, 0.8, 2.6, 5.0)] });
    }
    b.wall({ x0, z0: zb, x1, z1: zb, y, height: H, thickness: 0.4, mat: M.chalkWhite, panel: cp, room: nave,
      openings: [doorOp(2.0, 0.9, 'Sacristy door', nave, { locked: true })] });
    b.gableRoof(x0, zf, x1, zb, y + H, 2.4, M.terracottaOld, 0.4);
    // Pews, an altar, candles.
    for (let r = 0; r < 5; r++) {
      for (const side of [-1, 1]) {
        const px = (x0 + x1) / 2 + side * 3.2;
        b.span(px - 2.3, y + 0.1, zf + 2.2 + r * 1.6, px + 2.3, y + 0.55, zf + 2.6 + r * 1.6,
          M.woodDark, { surface: 'wood', room: nave });
      }
    }
    b.span((x0 + x1) / 2 - 1.6, y + 0.1, zb - 2.2, (x0 + x1) / 2 + 1.6, y + 1.05, zb - 1.2,
      M.stoneTrim, { surface: 'concrete', room: nave });
    for (let k = 0; k < 7; k++) {
      b.cyl((x0 + x1) / 2 - 1.2 + k * 0.4, y + 1.2, zb - 1.7, 0.03, 0.15, M.lampWarm,
        { surface: 'glass', flags: BF.NO_COVER | BF.NO_NAV });
    }
    light((x0 + x1) / 2, y + 2.0, zb - 1.8, 0xffb464, 24, 14, true);
    light((x0 + x1) / 2, y + H - 1.0, (zf + zb) / 2, 0xffd9a8, 60, 16);

    // The bell tower, on the south-west corner: the map's high point, one
    // stair, no second exit.
    const tx0 = x0 - 4.2, tx1 = x0 - 0.2, tz0t = zf - 0.2, tz1t = zf + 3.8;
    const tower = room('Bell tower', 'tower', true, tx0, tz0t, tx1, tz1t, y, y + 17);
    for (const [ax, az, bx, bz] of [
      [tx0, tz0t, tx1, tz0t], [tx0, tz1t, tx1, tz1t], [tx0, tz0t, tx0, tz1t], [tx1, tz0t, tx1, tz1t],
    ] as const) {
      const isFront = az === tz0t && bz === tz0t;
      b.wall({
        x0: ax, z0: az, x1: bx, z1: bz, y, height: 17, thickness: 0.4, mat: M.chalkWhite, room: tower,
        openings: [
          ...(isFront ? [doorOp(2.0, 1.0, 'Tower door', tower)] : []),
          { at: 2.0, width: 1.6, y0: 13.4, y1: 16.2, kind: 'arch' as const },
        ],
        panel: cp,
      });
    }
    // A stair run up inside in four flights to the bell deck.
    for (let f = 0; f < 4; f++) {
      const fy = y + 0.1 + f * 3.3;
      const dirZ = f % 2 === 0 ? 1 : -1;
      b.stairs({
        x: tx0 + (f % 2 === 0 ? 1.0 : 3.0), z: dirZ > 0 ? tz0t + 0.4 : tz1t - 0.4,
        dirX: 0, dirZ, width: 1.2, fromY: fy, toY: fy + 3.3, run: 3.2, mat: M.stoneTrim, room: tower,
      });
      if (f < 3) {
        b.slab(tx0, tz0t, tx1, tz1t, fy + 3.3, 0.14, M.woodDark, {
          room: tower, holes: [f % 2 === 0 ? [tx0 + 2.3, tz0t, tx1, tz1t] : [tx0, tz0t, tx0 + 1.7, tz1t]],
        });
      }
    }
    b.slab(tx0, tz0t, tx1, tz1t, y + 13.3, 0.2, M.stoneTrim, { room: tower, holes: [[tx0 + 2.3, tz0t, tx1, tz0t + 2.0]] });
    b.cyl((tx0 + tx1) / 2, y + 15.4, (tz0t + tz1t) / 2, 0.55, 0.5, M.brass, { surface: 'metal' });
    b.gableRoof(tx0, tz0t, tx1, tz1t, y + 17, 2.2, M.terracottaOld, 0.3);
    b.box((tx0 + tx1) / 2, y + 20.2, (tz0t + tz1t) / 2, 0.06, 0.9, 0.06, M.sootMetal, { surface: 'metal' });
    b.box((tx0 + tx1) / 2, y + 20.5, (tz0t + tz1t) / 2, 0.45, 0.06, 0.06, M.sootMetal, { surface: 'metal' });
    light((tx0 + tx1) / 2, y + 14.6, (tz0t + tz1t) / 2, 0xffd9a8, 20, 10);
  }

  // ==========================================================================
  // STREET LIFE — every terrace street, dressed as a street
  // ==========================================================================
  for (let i = 0; i < TERRACES; i++) {
    const y = ty(i);
    const sz0 = tz0(i) + 0.6, sz1 = tz0(i) + (BAND - HOUSE_D) - 0.4;
    const midZ = (sz0 + sz1) / 2;
    // Street lamps on poles along the street edge, sodium-warm, with cables
    // strung from pole to pole — the single most barrio thing on the map.
    let prevX: number | null = null;
    for (let x = X0 + 10; x < X1 - 6; x += rng.range(13, 18)) {
      if (Math.abs(x) < 4) continue;
      p.streetLamp(x, y, sz0 + 0.4, 5.2);
      light(x, y + 5.0, sz0 + 1.4, 0xffc27a, 80, 18);
      if (prevX !== null) {
        b.span(prevX, y + 5.6, sz0 + 0.38, x, y + 5.63, sz0 + 0.42, M.sootMetal,
          { surface: 'metal', flags: BF.NO_COVER | BF.NO_NAV | BF.THIN | BF.NO_COLLIDE | BF.NO_SHADOW });
      }
      prevX = x;
    }
    // Parked cars and a market stall or two on the wider streets.
    for (let k = 0; k < 3; k++) {
      const cx = rng.range(X0 + 8, X1 - 8);
      if (Math.abs(cx) < 6 || (i === 1 && cx > 10 && cx < 42)) continue;
      const r = rng.next();
      if (r < 0.4) p.sedan(cx, y, midZ, rng.range(-0.1, 0.1) + (rng.next() < 0.5 ? 0 : Math.PI));
      else if (r < 0.65) p.pickup(cx, y, midZ, rng.range(-0.1, 0.1) + Math.PI / 2 * 0);
      else {
        p.table(cx, y, midZ, 0, 2.0, 0.9, 0.85, M.woodWeathered);
        p.parasol(cx, y, midZ);
        for (let q = 0; q < 3; q++) p.crate(cx - 0.7 + q * 0.7, y, midZ + 0.9, rng.range(0, 3), 0.28);
      }
    }
    p.wash(X0 + 4, sz0, X1 - 4, sz1, y + 0.035, 16);
    p.dress(X0 + 4, sz0, X1 - 4, sz1, y + 0.03, 9);
  }

  // Laundry and cables across the alley mouths — overhead clutter, the
  // layer that makes every alley read as lived in from the street.
  for (let k = 0; k < 40; k++) {
    const i = Math.floor(rng.next() * TERRACES);
    const x = rng.range(X0 + 6, X1 - 6);
    const z = tz1(i) - HOUSE_D * rng.range(0.1, 0.9);
    const yy = ty(i) + rng.range(2.6, 3.0);
    b.span(x - 1.3, yy, z - 0.015, x + 1.3, yy + 0.02, z + 0.015, M.sootMetal,
      { surface: 'metal', flags: BF.NO_COVER | BF.NO_NAV | BF.THIN | BF.NO_COLLIDE | BF.NO_SHADOW });
  }

  // ==========================================================================
  // THE BOTTOM EDGE — where you come in
  // ==========================================================================
  // A road along the foot of the hill, a bus shelter, a burnt-out car and a
  // wall of scrap: the insertion edge has things to crouch behind.
  b.span(X0 - 20, PAD - 0.3, Z0 - 14, X1 + 20, PAD + 0.02, Z0 - 3, M.asphalt,
    { surface: 'concrete', flags: BF.NO_COVER });
  for (let x = X0 - 16; x < X1 + 16; x += 9) {
    p.paintMarking(x, Z0 - 8.6, x + 4.5, Z0 - 8.42, PAD + 0.03, M.plasterWhite);
  }
  p.sedan(-24, PAD, Z0 - 6, 0.12, M.sootMetal);
  p.pickup(18, PAD, Z0 - 10, Math.PI + 0.1, M.rust);
  for (let k = 0; k < 6; k++) p.jerseyBarrier(-44 + k * 16 + rng.range(-3, 3), PAD, Z0 - 2.2, rng.range(-0.2, 0.2));
  p.wash(X0 - 18, Z0 - 14, X1 + 18, Z0 - 3, PAD + 0.03, 12);

  b.endBuilding();

  // ==========================================================================
  // Site record
  // ==========================================================================
  const approaches: SiteInstance['approaches'] = [
    { id: 'the-stair', name: 'The Stair', kind: 'front',
      x: 0, y: PAD, z: Z0 - 12, toX: 0, toZ: Z0 + 10,
      description: 'Straight up the public stair. The fastest way to the top and every roof on the hill can see it.',
      stealth: 0.1, speed: 0.9, risk: 0.9 },
    { id: 'the-cut', name: 'The Cut', kind: 'flank',
      x: CUT_X, y: PAD, z: Z0 - 10, toX: CUT_X, toZ: Z0 + 10,
      description: 'The storm channel on the west edge. Covered all the way up, and almost no way out of it.',
      stealth: 0.8, speed: 0.5, risk: 0.35 },
    { id: 'east-alleys', name: 'East alleys', kind: 'flank',
      x: 44, y: PAD, z: Z0 - 10, toX: 44, toZ: Z0 + 8,
      description: 'Through the alleys on the east side and up the narrow stairs, row by row.',
      stealth: 0.6, speed: 0.4, risk: 0.5 },
    { id: 'rooftops', name: 'Rooftop drop', kind: 'roof',
      x: 40, y: ty(5), z: Z1 - 2, toX: 40, toZ: Z1 - 14,
      description: 'In from above, at the top of the hill. You start with the height and your back to a drop.',
      stealth: 0.55, speed: 0.6, risk: 0.55 },
  ];

  const site: SiteInstance = {
    id: 'barrio-santa-muerte',
    name: 'Barrio Santa Muerte',
    archetype: 'favela',
    x: 0, z: 0, padY: PAD,
    minX: X0 - 40, maxX: X1 + 40,
    minZ: Z0 - 40, maxZ: Z1 + 40,
    coreMinX: X0 - 6, coreMaxX: X1 + 6,
    coreMinZ: Z0 - 16, coreMaxZ: Z1 + 2,
    minY: PAD - 2, maxY: ty(5) + 22,
    roomIds: rooms.map((_r, i) => i),
    doorIds: b.doors.map((d) => d.id),
    buildingCount: b.buildingNames.length,
    approaches,
    landmarks: [
      { name: 'Bell tower', x: 4, y: ty(5) + 20, z: tz0(5) + 5, prominence: 200 },
      { name: 'Cistern', x: -30, y: ty(3) + 7, z: (tz0(3) + tz1(3)) / 2, prominence: 150 },
      { name: 'Cancha', x: 26, y: ty(1) + 8, z: (tz0(1) + tz1(1)) / 2, prominence: 90 },
      { name: 'The Stair', x: 0, y: ty(3), z: 0, prominence: 60 },
    ],
    garrison: [],
  };

  console.info(`[barrio] ${houseNo} houses, ${lights.length} fixtures, ${rooms.length} rooms`);
  return { site, rooms, navLinks, lights };
}

/** Terrace helpers, exported so the garrison and missions agree with the geometry. */
export const BARRIO = {
  PAD, RISE, TERRACES, BAND, HOUSE_D, X0, X1, Z0, Z1,
  streetZ: (i: number): number => tz0(i) + (BAND - HOUSE_D) / 2,
  level: ty,
  tz0, tz1,
};
