/**
 * The urban kit.
 *
 * OWNED BY: World design team.
 *
 * ## Why this exists
 * Both original maps were a small walled site sitting alone on empty ground:
 * a compound in a desert with a lawn, a port with nothing around it. That is
 * why they "made no sense" — nothing explained why the place was there, and
 * nothing around it gave the approach anything to be. Real targets sit inside
 * a place: a cartel boss's house is at the top of HIS town, and a smuggling
 * quay is one berth in a working port.
 *
 * So both maps are now built out of a shared kit of town pieces — row houses,
 * shops, sheds, streets — that can be laid down in any of four orientations
 * along any street. Everything a first pass of these pieces got wrong has been
 * learned already and is built in once, here:
 *
 *  - walls are panelised, never one brick per run
 *  - every room gets a light fixture, so nothing is ever black at night
 *  - nothing is placed within reach of a doorway
 *  - wall services stand off the wall FACE, not its centre line
 *  - thin overhead clutter (washing, cables) is NO_COLLIDE, so a washing
 *    line never becomes an invisible wall
 *
 * ## Frames
 * A piece is authored in local (u, v): u runs along the street frontage, v
 * runs from the street (v = 0, the front wall) back into the block. A `Frame`
 * maps that onto the world in one of four axis-aligned orientations, so a
 * rectangle stays a rectangle and every existing builder call still applies.
 */

import { Rng } from '../core/math';
import { SiteBuilder } from './builder';
import { Props } from './props';
import { M } from './palette';
import { BF, type WallOpening, type SiteBuildResult, type RoomSpec } from './types';

export type Fixture = NonNullable<SiteBuildResult['lights']>[number];

export interface KitCtx {
  b: SiteBuilder;
  p: Props;
  rng: Rng;
  rooms: RoomSpec[];
  lights: Fixture[];
}

export function makeKit(b: SiteBuilder, rng: Rng): KitCtx {
  return { b, p: new Props(b), rng, rooms: [], lights: [] };
}

// ===========================================================================
// Frames
// ===========================================================================

/** Which way a building's front faces, in world terms. */
export type Facing = 'south' | 'north' | 'east' | 'west';

export class Frame {
  /** u axis and v axis in world (x, z). */
  readonly ux: number; readonly uz: number;
  readonly vx: number; readonly vz: number;
  /** The yaw every prop placed in this frame is rotated by. */
  readonly theta: number;

  /**
   * `(ox, oz)` is the world position of local (0, 0): the left end of the
   * front wall, as seen from the street. `facing` is the direction the front
   * of the building looks — i.e. toward the street.
   */
  constructor(readonly ox: number, readonly oz: number, facing: Facing) {
    // Props rotate local x to (cos t, -sin t) and local z to (sin t, cos t).
    // v points INTO the block, i.e. away from the street, i.e. opposite to
    // the facing direction.
    // 'north' means the front looks toward +z, so v (into the block) is -z.
    const t = facing === 'south' ? 0 : facing === 'west' ? Math.PI / 2
      : facing === 'north' ? Math.PI : -Math.PI / 2;
    this.theta = t;
    this.ux = Math.round(Math.cos(t)); this.uz = Math.round(-Math.sin(t));
    this.vx = Math.round(Math.sin(t)); this.vz = Math.round(Math.cos(t));
  }

  x(u: number, v: number): number { return this.ox + this.ux * u + this.vx * v; }
  z(u: number, v: number): number { return this.oz + this.uz * u + this.vz * v; }

  /** Axis-aligned world rect [x0, z0, x1, z1] for a local rect. */
  rect(u0: number, v0: number, u1: number, v1: number): [number, number, number, number] {
    const xa = this.x(u0, v0), xb = this.x(u1, v1);
    const za = this.z(u0, v0), zb = this.z(u1, v1);
    return [Math.min(xa, xb), Math.min(za, zb), Math.max(xa, xb), Math.max(za, zb)];
  }

  yaw(localYaw: number): number { return localYaw + this.theta; }
}

// ===========================================================================
// Openings
// ===========================================================================

export function doorOp(at: number, width: number, name: string, roomA: number,
  o: { locked?: boolean; material?: 'wood' | 'metal' | 'glass' | 'reinforced'; height?: number } = {}): WallOpening {
  return {
    at, width, y0: 0, y1: o.height ?? 2.1, kind: 'door',
    doorSpec: {
      name, roomA, roomB: -1, material: o.material ?? 'wood',
      locked: o.locked, hinge: 1, swing: 1, breachable: true,
    },
  };
}
export const winOp = (at: number, width: number, y0: number, y1: number): WallOpening =>
  ({ at, width, y0, y1, kind: 'window', glazed: true });
export const archOp = (at: number, width: number, h: number): WallOpening =>
  ({ at, width, y0: 0, y1: h, kind: 'arch' });
export const holeOp = (at: number, width: number, h: number): WallOpening =>
  ({ at, width, y0: 0, y1: h, kind: 'hole' });

// ===========================================================================
// Palette choices
// ===========================================================================

/** Plaster colours of a working town, weighted toward the dull ones. */
export const TOWN_MATS = [
  M.plasterRose, M.plasterSage, M.plasterOchre, M.plasterCream, M.stucco,
  M.chalkWhite, M.concreteRaw, M.brickRed, M.plasterRose, M.stucco,
  M.plasterOchre, M.brickRed, M.concreteRaw, M.plasterWhite,
];

/** The richer end of town — painted, kept, and lighter in value. */
export const RICH_MATS = [M.chalkWhite, M.plasterCream, M.plasterWhite, M.plasterOchre, M.plasterRose];

// ===========================================================================
// Buildings
// ===========================================================================

export type HouseStyle = 'house' | 'shop' | 'rich' | 'shed' | 'bar';

export interface HouseOpts {
  frame: Frame;
  /** Frontage length (along u) and depth (along v). */
  w: number;
  d: number;
  /** Ground level. */
  y: number;
  storeys: number;
  style: HouseStyle;
  name: string;
  /** Storey height. */
  storeyH?: number;
  /** Override the wall material. */
  mat?: number;
  /** Pitched roof instead of a flat, usable one. */
  gable?: boolean;
  /** No back wall: the building is dug into something behind it. */
  backed?: boolean;
}

/**
 * One building, complete: shell, doors, windows, floors, stair, roof, roof
 * life, interior, services on the street face, and a light per storey.
 * Returns the ground-floor room id.
 */
export function building(k: KitCtx, o: HouseOpts): number {
  const { b, p, rng } = k;
  const F = o.frame;
  const w = o.w, d = o.d, y = o.y;
  const SH = o.storeyH ?? (o.style === 'shed' ? 6.2 : 3.2);
  const H = SH * o.storeys;
  const mat = o.mat ?? (o.style === 'rich'
    ? RICH_MATS[Math.floor(rng.next() * RICH_MATS.length)]
    : o.style === 'shed'
      ? [M.corrugated, M.corrugated, M.concreteRaw, M.boxFadedGrey, M.rust][Math.floor(rng.next() * 5)]
      : TOWN_MATS[Math.floor(rng.next() * TOWN_MATS.length)]);
  const surface = o.style === 'shed' && mat !== M.concreteRaw ? 'metal' as const : 'concrete' as const;
  const panel = o.style === 'shed'
    ? { every: 3.0, jitter: 0.02, variants: [mat, mat, M.rust, M.corrugated] }
    : { every: 3.0, jitter: 0.05, variants: [mat, mat, M.concreteRaw, M.brickRed] };
  const T = o.style === 'shed' ? 0.24 : 0.22;

  const [rx0, rz0, rx1, rz1] = F.rect(0, 0, w, d);
  const room = (name: string, y0: number, y1: number, tag: string): number => {
    const spec = { name, tag, indoors: true, minX: rx0, maxX: rx1, minZ: rz0, maxZ: rz1, minY: y0, maxY: y1 };
    const id = b.room(spec);
    k.rooms.push({ ...spec, buildingId: 0 });
    return id;
  };
  const tag = o.style === 'shop' ? 'shop' : o.style === 'shed' ? 'store' : o.style === 'bar' ? 'bar' : 'house';
  const rGround = room(`${o.name}, ground`, y, y + SH, tag);
  const rUpper: number[] = [];
  for (let s = 1; s < o.storeys; s++) rUpper.push(room(`${o.name}, floor ${s + 1}`, y + s * SH, y + (s + 1) * SH, 'house'));

  b.span(rx0, y, rz0, rx1, y + 0.1, rz1, o.style === 'shed' ? M.concreteDark
    : rng.next() < 0.5 ? M.tileTerra : M.concreteDark,
    { surface: o.style === 'shed' ? 'concrete' : 'tile', flags: BF.NO_COVER, room: rGround });

  // --- front ---------------------------------------------------------------
  const front: WallOpening[] = [];
  let doorU: number;
  if (o.style === 'shed') {
    // A roller door and a personnel door beside it.
    doorU = w * 0.45;
    front.push(doorOp(doorU, Math.min(5.2, w * 0.5), `${o.name} roller door`, rGround,
      { material: 'metal', height: 4.4 }));
    if (w > 10) front.push(doorOp(w * 0.86, 1.0, `${o.name} side door`, rGround, { material: 'metal' }));
  } else if (o.style === 'shop' || o.style === 'bar') {
    // Shopfront: a wide open arch you can walk straight into, and a door.
    doorU = w * 0.38;
    front.push(archOp(doorU, Math.min(3.0, w * 0.45), 2.6));
    front.push(winOp(w * 0.8, Math.min(1.6, w * 0.24), 0.9, 2.3));
  } else {
    doorU = w * (rng.next() < 0.5 ? 0.3 : 0.7);
    front.push(doorOp(doorU, 1.0, `${o.name} door`, rGround, { locked: rng.next() < 0.12 }));
    const wu = doorU < w / 2 ? w * 0.76 : w * 0.24;
    front.push(winOp(wu, 1.2, 1.0, 2.2));
  }
  // Upper windows must not sit above the ground-floor opening.
  //
  // The wall builder takes openings as disjoint spans along the wall, and a
  // window's SILL is a solid segment from the wall base up to the window. An
  // upper-floor window directly above the front door therefore filled the
  // doorway below it with 4 m of masonry — 44 front doors in the town were
  // sealed that way before this check.
  const doorHalf = (o.style === 'shed' ? Math.min(5.2, w * 0.5) : o.style === 'shop' || o.style === 'bar' ? Math.min(3.0, w * 0.45) : 1.0) / 2;
  const clearOfDoor = (u: number, half: number): boolean => Math.abs(u - doorU) > doorHalf + half + 0.25;
  for (let s = 1; s < o.storeys; s++) {
    const n = Math.max(1, Math.floor(w / 3.2));
    for (let j = 0; j < n; j++) {
      const u = (j + 0.5) * (w / n);
      if (clearOfDoor(u, 0.55) && u > 0.8 && u < w - 0.8) front.push(winOp(u, 1.1, s * SH + 1.0, s * SH + 2.3));
    }
  }
  if (o.style === 'shed' && clearOfDoor(w * 0.12, 0.8)) front.push(winOp(w * 0.12, 1.6, 4.8, 5.6));
  // Drop anything that overlaps an opening already accepted, in order.
  const accepted: WallOpening[] = [];
  for (const op of front) {
    if (accepted.every((a) => Math.abs(a.at - op.at) > (a.width + op.width) / 2 + 0.15)) accepted.push(op);
  }
  b.wall({ x0: F.x(0, 0), z0: F.z(0, 0), x1: F.x(w, 0), z1: F.z(w, 0), y, height: H,
    thickness: T, mat, surface, openings: accepted, panel, room: rGround });

  // --- sides and back -------------------------------------------------------
  for (const su of [0, w]) {
    const ops: WallOpening[] = [];
    if (rng.next() < 0.4 && o.style !== 'shed') ops.push(winOp(d * 0.5, 0.8, 1.2, 2.0));
    for (let s = 1; s < o.storeys; s++) if (rng.next() < 0.5) ops.push(winOp(d * 0.4, 0.8, s * SH + 1.2, s * SH + 2.0));
    b.wall({ x0: F.x(su, 0), z0: F.z(su, 0), x1: F.x(su, d), z1: F.z(su, d), y, height: H,
      thickness: T, mat, surface, openings: ops, panel, room: rGround });
  }
  if (!o.backed) {
    const back: WallOpening[] = [];
    if (o.style !== 'shed' && rng.next() < 0.5) {
      // Centred. On the far side it opened straight onto the bed, and on the
      // near side onto the stair.
      back.push(doorOp(w * 0.5, 0.9, `${o.name} back door`, rGround,
        { locked: rng.next() < 0.3 }));
    }
    b.wall({ x0: F.x(0, d), z0: F.z(0, d), x1: F.x(w, d), z1: F.z(w, d), y, height: H,
      thickness: T, mat, surface, openings: back, panel, room: rGround });
  }

  // --- floors and the stair ---------------------------------------------------
  for (let s = 1; s < o.storeys; s++) {
    const fy = y + s * SH;
    const hole = F.rect(0.2, d - 4.7, 1.3, d - 0.3);
    b.slab(rx0, rz0, rx1, rz1, fy, 0.18, M.concreteDark, { room: rUpper[s - 1], holes: [hole] });
    b.stairs({
      x: F.x(0.75, d - 4.7), z: F.z(0.75, d - 4.7), dirX: F.vx, dirZ: F.vz, width: 0.9,
      fromY: fy - SH + (s === 1 ? 0.1 : 0), toY: fy, run: 4.2, mat: M.concreteRaw, room: rGround,
    });
  }

  // --- roof ---------------------------------------------------------------------
  const roofY = y + H;
  if (o.gable || o.style === 'shed') {
    // Pitched: gableRoof ridges along x, so give it the world rect directly.
    b.gableRoof(rx0, rz0, rx1, rz1, roofY, o.style === 'shed' ? 1.6 : 1.9,
      o.style === 'shed' ? M.corrugated : M.terracottaOld, o.style === 'shed' ? 0.3 : 0.45);
  } else {
    b.slab(rx0, rz0, rx1, rz1, roofY, 0.2, M.concreteDark, { surface: 'concrete' });
    const par = o.style === 'rich' ? 1.0 : rng.range(0.6, 1.1);
    const pm = o.style === 'rich' ? M.stoneTrim : mat;
    const runs: Array<[number, number, number, number]> = [[0, 0, w, 0], [0, 0, 0, d], [w, 0, w, d]];
    if (!o.backed) runs.push([0, d, w, d]);
    for (const [u0, v0, u1, v1] of runs) {
      b.wall({ x0: F.x(u0, v0), z0: F.z(u0, v0), x1: F.x(u1, v1), z1: F.z(u1, v1), y: roofY,
        height: par, thickness: 0.2, mat: pm, jitter: 0.05,
        coping: { mat: M.stoneTrim, height: 0.08, overhang: 0.05 } });
    }
    // Roof life: this is the silhouette of a town.
    if (rng.next() < 0.6) {
      const tu = w * rng.range(0.3, 0.7), tv = d * rng.range(0.3, 0.7);
      for (const [lu, lv] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]] as const) {
        b.box(F.x(tu + lu, tv + lv), roofY + 0.45, F.z(tu + lu, tv + lv), 0.05, 0.45, 0.05,
          M.steelGalv, { surface: 'metal', flags: BF.NO_COVER });
      }
      p.waterTank(F.x(tu, tv), roofY + 0.9, F.z(tu, tv), 0.7, 1.2);
    }
    if (rng.next() < 0.45) p.satelliteDish(F.x(w * 0.2, 1.2), roofY, F.z(w * 0.2, 1.2), F.yaw(rng.range(-0.5, 0.5)), 0.55);
    if (rng.next() < 0.5) p.roofAerial(F.x(w - 0.8, d - 1.2), roofY, F.z(w - 0.8, d - 1.2), rng.range(1.2, 2.8));
    if (rng.next() < 0.4) p.acUnit(F.x(1.0, 2.4), roofY, F.z(1.0, 2.4), F.yaw(0));
    if (rng.next() < 0.45) {
      const ly = roofY + 1.6;
      const [a0, b0, a1, b1] = F.rect(0.6, 3.0, w - 0.6, 3.03);
      b.span(a0, ly, b0, a1, ly + 0.02, b1, M.fabricCream,
        { surface: 'fabric', flags: BF.NO_COVER | BF.NO_NAV | BF.THIN | BF.NO_COLLIDE });
      for (let j = 0; j < 5; j++) {
        const cu = 1 + j * (w - 2) / 5 + rng.range(0, 0.4);
        b.box(F.x(cu, 3.01), ly - 0.32, F.z(cu, 3.01), F.ux ? rng.range(0.18, 0.34) : 0.012, 0.3,
          F.ux ? 0.012 : rng.range(0.18, 0.34),
          [M.fabricRed, M.fabricTeal, M.plasterWhite, M.fabricCream, M.paintBlue][j % 5],
          { surface: 'fabric', flags: BF.NO_COVER | BF.NO_NAV | BF.THIN | BF.NO_COLLIDE | BF.NO_SHADOW });
      }
    }
    // A roof hatch and ladder on flat roofs over two storeys, so every tall
    // roof is a reachable perch — and one you can be caught on.
    if (o.storeys >= 2 && !o.backed) {
      // Off to one end of the back wall: centred, it stood directly outside
      // the back door, and a ladder's rails are solid.
      b.ladder(F.x(w - 0.8, d + 0.35), F.z(w - 0.8, d + 0.35), F.yaw(0), y, roofY + 0.4);
    }
  }

  // --- the street face ---------------------------------------------------------
  if (o.style === 'shop' || o.style === 'bar') {
    // Awning over the shopfront, and a sign.
    const [a0, b0, a1, b1] = F.rect(0.3, -1.6, w - 0.3, 0);
    b.span(a0, y + 2.8, b0, a1, y + 2.92, b1, [M.fabricRed, M.fabricTeal, M.fabricCream, M.paintBlue][Math.floor(rng.next() * 4)],
      { surface: 'fabric', flags: BF.NO_COVER | BF.NO_NAV });
    p.signPlate(F.x(w * 0.38, -0.14), y + 3.3, F.z(w * 0.38, -0.14), F.yaw(0), Math.min(2.4, w * 0.4), 0.5,
      o.style === 'bar' ? M.neonRed : M.plasterWhite);
    if (o.style === 'bar') {
      k.lights.push({ position: { x: F.x(w * 0.38, -0.8), y: y + 3.0, z: F.z(w * 0.38, -0.8) },
        color: 0xff5a48, intensity: 14, distance: 9, alwaysOn: true });
    }
  }
  k.p.services(F.x(0, 0), F.z(0, 0), F.x(w, 0), F.z(w, 0), y, H, -1, 0.45, T);

  // --- interiors -----------------------------------------------------------------
  const iy = y + 0.1;
  const L = (u: number, v: number): [number, number] => [F.x(u, v), F.z(u, v)];
  const far = doorU < w / 2 ? 1 : -1;
  const cu = w / 2;
  if (o.style === 'house' || o.style === 'rich') {
    // 1.65 m clear of the back wall, so the back door has room to open onto.
    const [bx, bz] = L(cu + far * (w / 2 - 1.3), d - 2.6);
    p.bed(bx, iy, bz, F.yaw(0), 1.4, 1.9);
    const [tx, tz] = L(cu - far * 0.8, d * 0.5);
    p.table(tx, iy, tz, F.yaw(rng.range(-0.2, 0.2)), 1.3, 0.8, 0.76);
    const [c1x, c1z] = L(cu - far * 0.8 - 0.9, d * 0.5);
    const [c2x, c2z] = L(cu - far * 0.8 + 0.9, d * 0.5);
    p.chair(c1x, iy, c1z, F.yaw(Math.PI / 2));
    p.chair(c2x, iy, c2z, F.yaw(-Math.PI / 2));
    const [wx, wz] = L(far > 0 ? w - 0.4 : 0.4, d * 0.35);
    p.wardrobe(wx, iy, wz, F.yaw(far > 0 ? -Math.PI / 2 : Math.PI / 2), 1.2, 1.9);
    if (rng.next() < 0.6) { const [rx, rz] = L(cu, d * 0.5); p.rug(rx, iy + 0.01, rz, F.yaw(0), 2.2, 1.5, rng.next() < 0.5 ? M.fabricRed : M.fabricTeal); }
    if (rng.next() < 0.5) { const [sx, sz] = L(cu - far * (w / 2 - 0.45), d - 0.4); p.shelf(sx, iy, sz, F.yaw(Math.PI), 1.1, 1.8); }
    if (o.style === 'rich') { const [sx, sz] = L(cu, 1.6); p.sofa(sx, iy, sz, F.yaw(Math.PI), 2.0); }
  } else if (o.style === 'shop') {
    const [c0x, c0z] = L(w * 0.62, d * 0.35);
    const [c1x, c1z] = L(w - 0.6, d * 0.35);
    p.counter(Math.min(c0x, c1x), Math.min(c0z, c1z), Math.max(c0x, c1x), Math.max(c0z, c1z), iy);
    for (let j = 0; j < Math.max(1, Math.floor(w / 1.4)); j++) {
      const su = 0.8 + j * 1.3;
      const [sx, sz] = L(su, d - 0.4);
      if (su > w - 0.6) break;
      if (Math.abs(su - w * 0.5) < 1.3) continue;       // the back door
      p.shelf(sx, iy, sz, F.yaw(Math.PI), 1.1, 2.0);
    }
    for (let j = 0; j < 3; j++) { const [cx, cz] = L(w * 0.2 + j * 0.7, d * 0.6); p.crate(cx, iy, cz, F.yaw(rng.range(0, 3)), 0.32); }
  } else if (o.style === 'bar') {
    const [c0x, c0z] = L(w * 0.55, d - 1.2);
    const [c1x, c1z] = L(w - 0.5, d - 1.2);
    p.counter(Math.min(c0x, c1x), Math.min(c0z, c1z), Math.max(c0x, c1x), Math.max(c0z, c1z), iy, M.woodDark);
    for (let j = 0; j < 3; j++) {
      const [tx, tz] = L(1.4 + j * (w - 2.8) / 2, d * 0.45);
      p.table(tx, iy, tz, F.yaw(rng.range(-0.4, 0.4)), 0.9, 0.9, 0.76, M.woodDark);
      p.chair(tx + 0.6, iy, tz, F.yaw(-Math.PI / 2));
      p.chair(tx - 0.6, iy, tz, F.yaw(Math.PI / 2));
      const [bx, bz] = L(1.4 + j * (w - 2.8) / 2, d * 0.45);
      p.bottleCluster(bx, iy + 0.76, bz, 3);
    }
  } else {
    // Shed: racked stock, pallets and a parked vehicle.
    for (let j = 0; j < Math.floor(w / 3.5); j++) {
      const [sx, sz] = L(1.6 + j * 3.4, d - 1.1);
      p.pallet(sx, iy, sz, F.yaw(0), 2 + Math.floor(rng.next() * 3));
    }
    for (let j = 0; j < 6; j++) { const [cx, cz] = L(rng.range(1.5, w - 1.5), rng.range(d * 0.45, d - 2.5)); p.crate(cx, iy, cz, F.yaw(rng.range(0, 3)), rng.range(0.4, 0.8)); }
    if (w > 9 && rng.next() < 0.6) { const [vx, vz] = L(w * 0.7, d * 0.45); p.pickup(vx, iy, vz, F.yaw(Math.PI / 2)); }
    for (let j = 0; j < 4; j++) { const [dx, dz] = L(0.8 + j * 0.7, 2.2); p.drum(dx, iy, dz); }
  }
  for (let s = 0; s < o.storeys; s++) {
    const [lx, lz] = L(cu, d * 0.5);
    const mount = SH - 0.4;
    k.lights.push({ position: { x: lx, y: y + s * SH + mount, z: lz },
      color: o.style === 'shed' ? 0xd6e4e0 : 0xffd49a,
      intensity: mount * mount * (o.style === 'shed' ? 3.6 : 0.85), distance: Math.max(9, w * 1.1),
      alwaysOn: o.style === 'shed' || o.style === 'bar' });
  }
  if (o.storeys > 1) {
    for (let s = 1; s < o.storeys; s++) {
      const [bx, bz] = L(cu, d - 1.4);
      p.bed(bx, y + s * SH, bz, F.yaw(0), 1.6, 2.0);
      const [sx, sz] = L(cu + far * 1.2, 1.6);
      p.sofa(sx, y + s * SH, sz, F.yaw(Math.PI), 1.8);
    }
  }
  return rGround;
}

/** True when nothing should be built at (x, z): a doorway is within `r`. */
export function nearDoor(k: KitCtx, x: number, z: number, r = 2.2): boolean {
  for (const d of k.b.doors) if ((d.x - x) ** 2 + (d.z - z) ** 2 < r * r) return true;
  return false;
}

// ===========================================================================
// Rows and streets
// ===========================================================================

export interface RowOpts {
  frame: Frame;
  /** Frontage available along u. */
  length: number;
  depth: number;
  y: number;
  /** Width range per building. */
  minW?: number;
  maxW?: number;
  /** Alley range between buildings. 0 for a terrace of party walls. */
  gapMin?: number;
  gapMax?: number;
  /** Probability per storey count, cumulative from 1. */
  storeys?: number[];
  styles?: Array<[HouseStyle, number]>;
  /** u ranges to leave empty (a stair, a side street). */
  skip?: Array<[number, number]>;
  prefix: string;
  gable?: number;
  backed?: boolean;
}

/** Fill a street frontage with buildings. Returns how many were placed. */
export function row(k: KitCtx, o: RowOpts): number {
  const { rng } = k;
  const minW = o.minW ?? 5.8, maxW = o.maxW ?? 8.8;
  const gapMin = o.gapMin ?? 1.6, gapMax = o.gapMax ?? 2.6;
  const st = o.storeys ?? [0.55, 0.9, 1];
  const styles = o.styles ?? [['house', 0.78], ['shop', 1]];
  let u = 0;
  let n = 0;
  while (u < o.length - minW) {
    let w = rng.range(minW, maxW);
    let u1 = Math.min(u + w, o.length);
    const hit = (o.skip ?? []).find(([a, c]) => u1 > a && u < c);
    if (hit) {
      if (hit[0] - u >= minW) u1 = hit[0] - 0.3;
      else { u = hit[1] + 0.4; continue; }
    }
    w = u1 - u;
    if (w >= 4.2) {
      const r = rng.next();
      const storeys = r < st[0] ? 1 : r < st[1] ? 2 : 3;
      const sr = rng.next();
      const style = (styles.find(([, c]) => sr < c) ?? styles[styles.length - 1])[0];
      const f = new Frame(o.frame.x(u, 0), o.frame.z(u, 0), facingOf(o.frame));
      building(k, {
        frame: f, w, d: o.depth, y: o.y, storeys, style,
        name: `${o.prefix} ${++n}`, gable: rng.next() < (o.gable ?? 0.2) && storeys < 3,
        backed: o.backed,
      });
    }
    u = u1 + rng.range(gapMin, gapMax);
  }
  return n;
}

function facingOf(f: Frame): Facing {
  if (f.vz === 1) return 'south';
  if (f.vz === -1) return 'north';
  if (f.vx === 1) return 'west';
  return 'east';
}

/**
 * A row of buildings along a street edge, given in world terms.
 *
 * `front` is the world coordinate of the front wall line (x for east/west
 * facing rows, z for north/south), and `from..to` the extent along it. The
 * builder works out which end is "left as seen from the street".
 */
export function frontage(
  k: KitCtx, facing: Facing, front: number, from: number, to: number,
  o: Omit<RowOpts, 'frame' | 'length'>,
): number {
  const lo = Math.min(from, to), hi = Math.max(from, to);
  // u runs: south +x, north -x, east +z, west -z.
  const origin: [number, number] =
    facing === 'south' ? [lo, front]
      : facing === 'north' ? [hi, front]
        : facing === 'east' ? [front, lo]
          : [front, hi];
  // Skip ranges are given in world terms along the frontage; convert to u.
  const toU = (w: number): number => (facing === 'north' || facing === 'west') ? hi - w : w - lo;
  const skip = (o.skip ?? []).map(([a, c]): [number, number] => {
    const u0 = toU(a), u1 = toU(c);
    return [Math.min(u0, u1), Math.max(u0, u1)];
  });
  return row(k, { ...o, skip, frame: new Frame(origin[0], origin[1], facing), length: hi - lo });
}

/**
 * A street: paving, kerbs, a centre line, lamps on poles with cable strung
 * between them, parked cars, and the wear of use. `x0..x1, z0..z1` is the
 * carriageway; `alongX` says which way it runs.
 */
export function street(k: KitCtx, x0: number, z0: number, x1: number, z1: number, y: number,
  o: { alongX: boolean; lamps?: boolean; cars?: number; mat?: number; kerb?: boolean } ): void {
  const { b, p, rng } = k;
  b.span(x0, y - 0.25, z0, x1, y + 0.02, z1, o.mat ?? M.asphalt, { surface: 'concrete', flags: BF.NO_COVER, tint: b.jitterTint(0.04) });
  const len = o.alongX ? x1 - x0 : z1 - z0;
  const wid = o.alongX ? z1 - z0 : x1 - x0;
  if (o.kerb !== false) {
    // Kerbs and a raised pavement either side.
    for (const side of [0, 1]) {
      if (o.alongX) {
        const zz = side ? z1 : z0 - 1.8;
        b.span(x0, y - 0.25, zz, x1, y + 0.14, zz + 1.8, M.concreteRaw, { surface: 'concrete', flags: BF.NO_COVER });
      } else {
        const xx = side ? x1 : x0 - 1.8;
        b.span(xx, y - 0.25, z0, xx + 1.8, y + 0.14, z1, M.concreteRaw, { surface: 'concrete', flags: BF.NO_COVER });
      }
    }
  }
  // Dashed centre line.
  if (wid > 5) {
    for (let t = 2; t < len - 2; t += 6) {
      if (o.alongX) p.paintMarking(x0 + t, (z0 + z1) / 2 - 0.07, x0 + t + 3, (z0 + z1) / 2 + 0.07, y + 0.025);
      else p.paintMarking((x0 + x1) / 2 - 0.07, z0 + t, (x0 + x1) / 2 + 0.07, z0 + t + 3, y + 0.025);
    }
  }
  if (o.lamps !== false) {
    let prev: [number, number] | null = null;
    for (let t = 6; t < len - 3; t += rng.range(14, 19)) {
      const lx = o.alongX ? x0 + t : x0 - 0.9;
      const lz = o.alongX ? z0 - 0.9 : z0 + t;
      p.streetLamp(lx, y + 0.14, lz, 5.4);
      k.lights.push({ position: { x: lx + (o.alongX ? 0 : 1.2), y: y + 5.2, z: lz + (o.alongX ? 1.2 : 0) },
        color: 0xffc27a, intensity: 95, distance: 20, alwaysOn: false });
      if (prev) {
        b.span(Math.min(prev[0], lx) - 0.02, y + 5.8, Math.min(prev[1], lz) - 0.02,
          Math.max(prev[0], lx) + 0.02, y + 5.83, Math.max(prev[1], lz) + 0.02, M.sootMetal,
          { surface: 'metal', flags: BF.NO_COVER | BF.NO_NAV | BF.THIN | BF.NO_COLLIDE | BF.NO_SHADOW });
      }
      prev = [lx, lz];
    }
  }
  for (let c = 0; c < (o.cars ?? Math.floor(len / 30)); c++) {
    const t = rng.range(6, len - 6);
    const off = wid * 0.28;
    const cx = o.alongX ? x0 + t : (rng.next() < 0.5 ? x0 + off * 0.6 : x1 - off * 0.6);
    const cz = o.alongX ? (rng.next() < 0.5 ? z0 + off * 0.6 : z1 - off * 0.6) : z0 + t;
    const yaw = (o.alongX ? Math.PI / 2 : 0) + (rng.next() < 0.5 ? 0 : Math.PI) + rng.range(-0.06, 0.06);
    const r = rng.next();
    if (r < 0.45) p.sedan(cx, y, cz, yaw);
    else if (r < 0.75) p.pickup(cx, y, cz, yaw);
    else p.suv(cx, y, cz, yaw);
    p.oilPatch(cx, y + 0.03, cz, 0.6);
  }
  p.wash(x0, z0, x1, z1, y + 0.03, 14);
}

/** Overhead clutter across a gap between two rows: cables and washing. */
export function overhead(k: KitCtx, x0: number, z0: number, x1: number, z1: number, y: number, n: number): void {
  const { b, rng } = k;
  for (let i = 0; i < n; i++) {
    const alongX = rng.next() < 0.5;
    const cx = rng.range(x0, x1), cz = rng.range(z0, z1);
    const yy = y + rng.range(3.6, 6.2);
    const L = rng.range(2.5, 6);
    b.span(cx - (alongX ? L / 2 : 0.012), yy, cz - (alongX ? 0.012 : L / 2),
      cx + (alongX ? L / 2 : 0.012), yy + 0.02, cz + (alongX ? 0.012 : L / 2), M.sootMetal,
      { surface: 'metal', flags: BF.NO_COVER | BF.NO_NAV | BF.THIN | BF.NO_COLLIDE | BF.NO_SHADOW });
  }
}

/**
 * Break a flat sheet of lawn into a landscape: dry patches, bare earth, tufts
 * and flowers. The villa's grounds were one 20,000 m2 slab of saturated green,
 * which read as a golf course at every range.
 */
export function meadow(k: KitCtx, x0: number, z0: number, x1: number, z1: number, y: number, density = 10): void {
  const { b, rng } = k;
  const area = Math.abs((x1 - x0) * (z1 - z0));
  const n = Math.round(area / 100 * density);
  let step = 0;
  for (let i = 0; i < n; i++) {
    const x = rng.range(x0, x1), z = rng.range(z0, z1);
    const r = rng.next();
    step = (step + 1) % 20;
    const dy = step * 0.0015;
    if (r < 0.35) {
      b.box(x, y + 0.006 + dy, z, rng.range(0.8, 3.2), 0.006, rng.range(0.6, 2.4), rng.next() < 0.6 ? M.leafDry : M.dirtMat,
        { yaw: rng.range(0, 3.14), surface: 'grass', flags: BF.NO_COVER | BF.NO_NAV | BF.THIN | BF.NO_SHADOW | BF.NO_COLLIDE, tint: b.jitterTint(0.12) });
    } else if (r < 0.8) {
      // Tufts.
      for (let t = 0; t < 4; t++) {
        b.box(x + rng.range(-0.5, 0.5), y + 0.09, z + rng.range(-0.5, 0.5), rng.range(0.05, 0.14), rng.range(0.06, 0.14), rng.range(0.05, 0.14),
          rng.next() < 0.5 ? M.leafMid : M.leafDry,
          { yaw: rng.range(0, 3.14), surface: 'foliage', flags: BF.NO_COVER | BF.NO_NAV | BF.THIN | BF.NO_SHADOW | BF.NO_COLLIDE | BF.SOFT });
      }
    } else {
      // A cluster of flowers — the smallest spot of colour on the map.
      const mat = [M.fabricRed, M.plasterWhite, M.paintYellow, M.plasterRose][Math.floor(rng.next() * 4)];
      for (let t = 0; t < 5; t++) {
        b.box(x + rng.range(-0.4, 0.4), y + 0.12, z + rng.range(-0.4, 0.4), 0.035, 0.03, 0.035, mat,
          { surface: 'foliage', flags: BF.NO_COVER | BF.NO_NAV | BF.THIN | BF.NO_SHADOW | BF.NO_COLLIDE });
      }
    }
  }
}
