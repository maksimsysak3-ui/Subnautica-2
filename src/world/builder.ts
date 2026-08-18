/**
 * Authoring layer over the Brickyard.
 *
 * Site files describe architecture ("a wall from here to here with a door at
 * 4.2m and two windows") and this turns it into bricks, rooms, doorways and
 * door records. Everything here is deterministic: no Math.random, no time.
 */

import type { SurfaceKind } from '../core/contracts';
import { Rng } from '../core/math';
import { Brickyard } from './brickyard';
import { M, packTint } from './palette';
import {
  BF, SHAPE_BOX, SHAPE_CYL, SHAPE_WEDGE,
  type BrickShape, type DoorMaterial, type DoorSpec, type NavLink,
  type RoomSpec, type WallOpening, type WorldDoor,
} from './types';

export interface BrickOpts {
  yaw?: number;
  shape?: BrickShape;
  surface?: SurfaceKind;
  tint?: number;
  flags?: number;
  room?: number;
}

/** Everything needed to animate one door leaf. */
export interface DoorRig {
  door: WorldDoor;
  brick: number;
  hingeX: number;
  hingeZ: number;
  /** Unit vector along the wall, from hinge toward the free edge. */
  ux: number;
  uz: number;
  leafLen: number;
  baseYaw: number;
  centerY: number;
  /** Max swing in radians. */
  maxAngle: number;
}

export interface WallOpts {
  x0: number; z0: number;
  x1: number; z1: number;
  /** Base height (world Y of the bottom of the wall). */
  y: number;
  height: number;
  thickness: number;
  mat: number;
  surface?: SurfaceKind;
  openings?: WallOpening[];
  flags?: number;
  room?: number;
  /** Adds a cap course along the top (garden walls, parapets). */
  coping?: { mat: number; height: number; overhang: number };
  /** Adds pilasters every N metres — breaks up long wall runs. */
  pilaster?: { every: number; mat: number; width: number; depth: number; extra: number };
  /** Value jitter applied per segment so plaster is not one flat colour. */
  jitter?: number;
  /** Building id override. */
  building?: number;
}

const SURFACE_DEFAULT: SurfaceKind = 'concrete';

export class SiteBuilder {
  readonly rooms: RoomSpec[] = [];
  readonly doors: WorldDoor[] = [];
  readonly doorRigs: DoorRig[] = [];
  readonly navLinks: NavLink[] = [];

  private buildingId = -1;
  private currentRoom = -1;
  /** Building name per id, for room labels. */
  readonly buildingNames: string[] = [];

  constructor(readonly yard: Brickyard, readonly rng: Rng) {}

  // -------------------------------------------------------------------------
  // Context
  // -------------------------------------------------------------------------

  building(name: string): number {
    this.buildingId = this.buildingNames.length;
    this.buildingNames.push(name);
    return this.buildingId;
  }

  endBuilding(): void {
    this.buildingId = -1;
  }

  room(spec: Omit<RoomSpec, 'buildingId'> & { buildingId?: number }): number {
    const id = this.rooms.length;
    this.rooms.push({ ...spec, buildingId: spec.buildingId ?? this.buildingId });
    return id;
  }

  /** Bricks added while this is set are tagged with the room. */
  inRoom<T>(id: number, fn: () => T): T {
    const prev = this.currentRoom;
    this.currentRoom = id;
    const r = fn();
    this.currentRoom = prev;
    return r;
  }

  // -------------------------------------------------------------------------
  // Primitives
  // -------------------------------------------------------------------------

  /** Axis-aligned-ish box specified by centre and half extents. */
  box(
    x: number, y: number, z: number,
    hx: number, hy: number, hz: number,
    mat: number, o: BrickOpts = {},
  ): number {
    return this.yard.add({
      x, y, z, hx, hy, hz,
      yaw: o.yaw ?? 0,
      shape: o.shape ?? SHAPE_BOX,
      surface: o.surface ?? SURFACE_DEFAULT,
      mat,
      tint: o.tint,
      flags: o.flags ?? 0,
      building: this.buildingId,
      room: o.room ?? this.currentRoom,
      door: -1,
    });
  }

  /** Box specified by its min/max corners — usually easier for architecture. */
  span(
    minX: number, minY: number, minZ: number,
    maxX: number, maxY: number, maxZ: number,
    mat: number, o: BrickOpts = {},
  ): number {
    return this.box(
      (minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2,
      Math.abs(maxX - minX) / 2, Math.abs(maxY - minY) / 2, Math.abs(maxZ - minZ) / 2,
      mat, o,
    );
  }

  cyl(x: number, y: number, z: number, r: number, halfHeight: number, mat: number, o: BrickOpts = {}): number {
    return this.box(x, y, z, r, halfHeight, r, mat, { ...o, shape: SHAPE_CYL });
  }

  wedge(
    x: number, y: number, z: number,
    hx: number, hy: number, hz: number,
    mat: number, o: BrickOpts = {},
  ): number {
    return this.box(x, y, z, hx, hy, hz, mat, { ...o, shape: SHAPE_WEDGE });
  }

  /** Deterministic small value jitter, keyed off position so it is stable. */
  jitterTint(amount: number): number {
    const v = 1 + this.rng.range(-amount, amount);
    const h = this.rng.range(-amount, amount) * 0.5;
    return packTint(v * (1 + h), v, v * (1 - h));
  }

  // -------------------------------------------------------------------------
  // Walls
  // -------------------------------------------------------------------------

  /**
   * A wall run with openings punched through it. Returns the door ids created.
   *
   * The wall is centred on the segment (x0,z0)→(x1,z1); `y` is the bottom.
   */
  wall(opts: WallOpts): number[] {
    const dx = opts.x1 - opts.x0;
    const dz = opts.z1 - opts.z0;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) return [];
    const ux = dx / len;
    const uz = dz / len;
    const yaw = Math.atan2(-uz, ux);
    const t = opts.thickness;
    const h = opts.height;
    const y0 = opts.y;
    const surface = opts.surface ?? SURFACE_DEFAULT;
    const flags = opts.flags ?? 0;
    const jitter = opts.jitter ?? 0.05;
    const created: number[] = [];
    const prevBuilding = this.buildingId;
    if (opts.building !== undefined) this.buildingId = opts.building;

    const at = (d: number): [number, number] => [opts.x0 + ux * d, opts.z0 + uz * d];

    const segment = (a: number, b: number, ya: number, yb: number, mat: number, extraFlags = 0): void => {
      if (b - a < 1e-3 || yb - ya < 1e-3) return;
      const mid = (a + b) / 2;
      const [cx, cz] = at(mid);
      this.box(cx, (ya + yb) / 2, cz, (b - a) / 2, (yb - ya) / 2, t / 2, mat, {
        yaw, surface, flags: flags | extraFlags, tint: this.jitterTint(jitter), room: opts.room,
      });
    };

    const ops = [...(opts.openings ?? [])].sort((a, b) => a.at - b.at);
    let cursor = 0;
    for (const op of ops) {
      const a = op.at - op.width / 2;
      const b = op.at + op.width / 2;
      segment(cursor, Math.max(cursor, a), y0, y0 + h, opts.mat);
      cursor = Math.max(cursor, b);

      // Sill below and lintel above the opening.
      if (op.y0 > 0.001) segment(a, b, y0, y0 + op.y0, opts.mat);
      if (op.y1 < h - 0.001) segment(a, b, y0 + op.y1, y0 + h, opts.mat);

      const [ox, oz] = at(op.at);

      if (op.kind === 'window') {
        // Reveal trim so the opening reads as a punched window, not a gap.
        this.box(ox, y0 + op.y0 - 0.06, oz, op.width / 2 + 0.14, 0.07, t / 2 + 0.07, M.stoneTrim, {
          yaw, surface: 'concrete', flags: flags | BF.NO_COVER, room: opts.room,
        });
        this.box(ox, y0 + op.y1 + 0.05, oz, op.width / 2 + 0.14, 0.06, t / 2 + 0.06, M.stoneTrim, {
          yaw, surface: 'concrete', flags: flags | BF.NO_COVER, room: opts.room,
        });
        if (op.glazed !== false) {
          this.box(ox, y0 + (op.y0 + op.y1) / 2, oz, op.width / 2 - 0.02, (op.y1 - op.y0) / 2 - 0.02, 0.015, M.glass, {
            yaw, surface: 'glass', room: opts.room,
            flags: flags | BF.SOFT | BF.TRANSPARENT | BF.WINDOW | BF.NO_SHADOW | BF.NO_NAV | BF.NO_COVER | BF.THIN,
          });
          // Mullion — one thin bar reads as "window" at a glance.
          this.box(ox, y0 + (op.y0 + op.y1) / 2, oz, 0.035, (op.y1 - op.y0) / 2, t / 2 + 0.01, M.woodDark, {
            yaw, surface: 'wood', flags: flags | BF.NO_NAV | BF.NO_COVER | BF.THIN, room: opts.room,
          });
        }
      } else if (op.kind === 'door' && op.doorSpec) {
        created.push(this.makeDoor(op, ox, oz, y0, ux, uz, yaw, t));
        // Door frame.
        this.box(ox, y0 + op.y1 + 0.06, oz, op.width / 2 + 0.12, 0.06, t / 2 + 0.05, M.stoneTrim, {
          yaw, surface: 'concrete', flags: flags | BF.NO_COVER | BF.NO_NAV, room: opts.room,
        });
      } else if (op.kind === 'arch') {
        this.box(ox, y0 + op.y1 + 0.09, oz, op.width / 2 + 0.16, 0.09, t / 2 + 0.06, M.stoneTrim, {
          yaw, surface: 'concrete', flags: flags | BF.NO_COVER | BF.NO_NAV, room: opts.room,
        });
      }
    }
    segment(cursor, len, y0, y0 + h, opts.mat);

    if (opts.coping) {
      const c = opts.coping;
      const mid = len / 2;
      const [cx, cz] = at(mid);
      this.box(cx, y0 + h + c.height / 2, cz, len / 2 + c.overhang, c.height / 2, t / 2 + c.overhang, c.mat, {
        yaw, surface: 'concrete', flags: flags | BF.NO_COVER, tint: this.jitterTint(0.03), room: opts.room,
      });
    }

    if (opts.pilaster) {
      const p = opts.pilaster;
      const n = Math.max(1, Math.round(len / p.every));
      for (let i = 0; i <= n; i++) {
        const d = (i / n) * len;
        const [cx, cz] = at(d);
        this.box(cx, y0 + (h + p.extra) / 2, cz, p.width / 2, (h + p.extra) / 2, t / 2 + p.depth, p.mat, {
          yaw, surface: 'concrete', tint: this.jitterTint(0.03), room: opts.room,
        });
      }
    }

    this.buildingId = prevBuilding;
    return created;
  }

  private makeDoor(
    op: WallOpening, ox: number, oz: number, wallY: number,
    ux: number, uz: number, yaw: number, thickness: number,
  ): number {
    const spec = op.doorSpec as DoorSpec;
    const id = this.doors.length;
    const hinge = spec.hinge ?? 1;
    const swing = spec.swing ?? 1;
    const w = op.width;
    const height = op.y1 - op.y0;
    const leafLen = w - 0.05;
    // Hinge sits at one end of the opening; the leaf extends toward the other.
    const hingeX = ox - ux * (w / 2) * hinge;
    const hingeZ = oz - uz * (w / 2) * hinge;
    const dirSign = hinge; // leaf extends along +u when hinge is at -u end

    const leafMat =
      spec.material === 'reinforced' ? M.steelDark
      : spec.material === 'metal' ? M.steelGalv
      : spec.material === 'gate' ? M.steelDark
      : spec.material === 'glass' ? M.glass
      : M.woodWarm;
    const leafSurface: SurfaceKind =
      spec.material === 'wood' ? 'wood' : spec.material === 'glass' ? 'glass' : 'metal';

    const cy = wallY + op.y0 + height / 2;
    const cx = hingeX + ux * dirSign * (leafLen / 2);
    const cz = hingeZ + uz * dirSign * (leafLen / 2);
    const leafThickness = spec.material === 'reinforced' ? 0.09 : 0.055;

    const brick = this.yard.add({
      x: cx, y: cy, z: cz,
      hx: leafLen / 2, hy: height / 2 - 0.02, hz: leafThickness,
      yaw,
      surface: leafSurface,
      mat: leafMat,
      tint: this.jitterTint(0.04),
      flags: BF.DOOR | BF.NO_NAV | BF.NO_COVER |
        (spec.material === 'glass' ? BF.SOFT | BF.TRANSPARENT | BF.NO_SHADOW : 0),
      building: this.buildingId,
      room: -1,
      door: id,
    });

    const door: WorldDoor = {
      id,
      name: spec.name,
      buildingId: this.buildingId,
      roomA: spec.roomA,
      roomB: spec.roomB,
      x: ox, y: wallY + op.y0, z: oz,
      yaw,
      width: w,
      height,
      hinge,
      swing,
      state: spec.open ? 'open' : spec.locked ? 'locked' : 'closed',
      locked: spec.locked ?? false,
      breachable: spec.breachable ?? true,
      material: spec.material,
      integrity: spec.material === 'reinforced' ? 1 : spec.material === 'metal' ? 0.8 : 0.5,
      openAmount: spec.open ? 1 : 0,
      targetOpen: spec.open ? 1 : 0,
      speed: 2.4,
      destroyed: false,
      brickIds: [brick],
      instance: -1,
    };
    this.doors.push(door);
    this.doorRigs.push({
      door,
      brick,
      hingeX, hingeZ,
      ux: ux * dirSign,
      uz: uz * dirSign,
      leafLen,
      baseYaw: yaw,
      centerY: cy,
      maxAngle: (spec.material === 'gate' ? 0 : 1.62) * swing,
    });
    // Sliding gates translate instead of swinging.
    if (spec.material === 'gate') this.doorRigs[this.doorRigs.length - 1].maxAngle = 0;
    return id;
  }

  // -------------------------------------------------------------------------
  // Slabs, roofs, stairs
  // -------------------------------------------------------------------------

  /** Floor or ceiling slab with rectangular holes cut out (stairwells, light wells). */
  slab(
    minX: number, minZ: number, maxX: number, maxZ: number,
    y: number, thickness: number, mat: number,
    o: BrickOpts & { holes?: Array<[number, number, number, number]> } = {},
  ): void {
    let rects: Array<[number, number, number, number]> = [[minX, minZ, maxX, maxZ]];
    for (const hole of o.holes ?? []) {
      const next: Array<[number, number, number, number]> = [];
      for (const r of rects) next.push(...subtractRect(r, hole));
      rects = next;
    }
    for (const r of rects) {
      if (r[2] - r[0] < 0.02 || r[3] - r[1] < 0.02) continue;
      this.span(r[0], y - thickness, r[1], r[2], y, r[3], mat, {
        ...o,
        surface: o.surface ?? 'tile',
        flags: (o.flags ?? 0) | BF.NO_COVER,
        tint: o.tint ?? this.jitterTint(0.035),
      });
    }
  }

  /**
   * A straight flight of stairs. Steps are solid boxes down to `fromY` so the
   * navmesh rasteriser sees a clean rising staircase instead of floating treads.
   */
  stairs(opts: {
    x: number; z: number;
    /** Unit direction the flight climbs toward. */
    dirX: number; dirZ: number;
    width: number;
    fromY: number; toY: number;
    run: number;
    mat: number;
    surface?: SurfaceKind;
    railMat?: number;
    room?: number;
  }): void {
    const rise = opts.toY - opts.fromY;
    const steps = Math.max(2, Math.round(rise / 0.185));
    const stepRise = rise / steps;
    const stepRun = opts.run / steps;
    const yaw = Math.atan2(-opts.dirZ, opts.dirX);
    const px = -opts.dirZ;
    const pz = opts.dirX;
    for (let k = 0; k < steps; k++) {
      const d = (k + 0.5) * stepRun;
      const top = opts.fromY + (k + 1) * stepRise;
      const cx = opts.x + opts.dirX * d;
      const cz = opts.z + opts.dirZ * d;
      this.box(cx, (opts.fromY + top) / 2, cz, stepRun / 2, (top - opts.fromY) / 2, opts.width / 2, opts.mat, {
        yaw, surface: opts.surface ?? 'concrete', room: opts.room, tint: this.jitterTint(0.03),
        flags: BF.NO_COVER,
      });
    }
    if (opts.railMat !== undefined) {
      for (const s of [-1, 1]) {
        const n = 6;
        for (let k = 0; k <= n; k++) {
          const d = (k / n) * opts.run;
          const y = opts.fromY + (k / n) * rise;
          this.box(
            opts.x + opts.dirX * d + px * s * (opts.width / 2 - 0.05),
            y + 0.5,
            opts.z + opts.dirZ * d + pz * s * (opts.width / 2 - 0.05),
            0.035, 0.5, 0.035, opts.railMat,
            { yaw, surface: 'metal', flags: BF.NO_NAV | BF.NO_COVER | BF.THIN, room: opts.room },
          );
        }
        // Handrail follows the pitch; a wedge would be cleaner but a flat bar
        // at the mid height reads fine at low poly.
        this.box(
          opts.x + opts.dirX * (opts.run / 2) + px * s * (opts.width / 2 - 0.05),
          opts.fromY + rise / 2 + 1.0,
          opts.z + opts.dirZ * (opts.run / 2) + pz * s * (opts.width / 2 - 0.05),
          Math.hypot(opts.run, rise) / 2, 0.04, 0.04, opts.railMat,
          {
            yaw, surface: 'metal', room: opts.room,
            flags: BF.NO_NAV | BF.NO_COVER | BF.THIN,
          },
        );
      }
    }
  }

  /** Terracotta pitched roof over a rectangular footprint. */
  gableRoof(
    minX: number, minZ: number, maxX: number, maxZ: number,
    baseY: number, pitchHeight: number, mat: number, overhang = 0.5,
  ): void {
    const x0 = minX - overhang, x1 = maxX + overhang;
    const z0 = minZ - overhang, z1 = maxZ + overhang;
    const midZ = (z0 + z1) / 2;
    const hz = (z1 - z0) / 2;
    const hx = (x1 - x0) / 2;
    const cx = (x0 + x1) / 2;
    // Two wedges meeting at the ridge. The wedge is full at -z, zero at +z.
    this.box(cx, baseY + pitchHeight / 2, midZ - hz / 2, hx, pitchHeight / 2, hz / 2, mat, {
      shape: SHAPE_WEDGE, yaw: Math.PI, surface: 'ceramic', flags: BF.NO_COVER,
      tint: this.jitterTint(0.05),
    });
    this.box(cx, baseY + pitchHeight / 2, midZ + hz / 2, hx, pitchHeight / 2, hz / 2, mat, {
      shape: SHAPE_WEDGE, surface: 'ceramic', flags: BF.NO_COVER, tint: this.jitterTint(0.05),
    });
    // Ridge cap and eaves fascia give the silhouette a hard edge.
    this.span(x0, baseY + pitchHeight, midZ - 0.16, x1, baseY + pitchHeight + 0.14, midZ + 0.16, mat, {
      surface: 'ceramic', flags: BF.NO_COVER,
    });
    this.span(x0, baseY - 0.1, z0, x1, baseY + 0.06, z0 + 0.18, M.woodDark, { surface: 'wood', flags: BF.NO_COVER });
    this.span(x0, baseY - 0.1, z1 - 0.18, x1, baseY + 0.06, z1, M.woodDark, { surface: 'wood', flags: BF.NO_COVER });
  }

  /** Flat roof deck with a parapet — the rooftop the player can actually use. */
  flatRoof(
    minX: number, minZ: number, maxX: number, maxZ: number,
    y: number, parapetHeight: number, deckMat: number, parapetMat: number,
    o: { holes?: Array<[number, number, number, number]>; room?: number } = {},
  ): void {
    this.slab(minX, minZ, maxX, maxZ, y, 0.26, deckMat, {
      surface: 'concrete', holes: o.holes, room: o.room,
    });
    const t = 0.22;
    const runs: Array<[number, number, number, number]> = [
      [minX, minZ, maxX, minZ],
      [minX, maxZ, maxX, maxZ],
      [minX, minZ, minX, maxZ],
      [maxX, minZ, maxX, maxZ],
    ];
    for (const [ax, az, bx, bz] of runs) {
      this.wall({
        x0: ax, z0: az, x1: bx, z1: bz,
        y, height: parapetHeight, thickness: t, mat: parapetMat,
        coping: { mat: M.stoneTrim, height: 0.09, overhang: 0.06 },
        jitter: 0.04,
      });
    }
  }

  /** Ladder: geometry plus the nav link that makes it usable. */
  ladder(x: number, z: number, yaw: number, fromY: number, toY: number, mat = M.steelGalv): void {
    const h = toY - fromY;
    const ux = Math.cos(yaw), uz = -Math.sin(yaw);
    for (const s of [-1, 1]) {
      this.box(x + -uz * s * 0.22, fromY + h / 2, z + ux * s * 0.22, 0.03, h / 2, 0.03, mat, {
        yaw, surface: 'metal', flags: BF.CLIMB | BF.NO_NAV | BF.NO_COVER | BF.THIN,
      });
    }
    const rungs = Math.max(2, Math.round(h / 0.32));
    for (let i = 1; i < rungs; i++) {
      this.box(x, fromY + (i / rungs) * h, z, 0.24, 0.02, 0.02, mat, {
        yaw: yaw + Math.PI / 2, surface: 'metal', flags: BF.CLIMB | BF.NO_NAV | BF.NO_COVER | BF.THIN,
      });
    }
    this.navLinks.push({
      ax: x + ux * 0.55, ay: fromY, az: z + uz * 0.55,
      bx: x - ux * 0.55, by: toY, bz: z - uz * 0.55,
      kind: 'ladder', penalty: 6, bidirectional: true,
    });
  }
}

/** r minus hole → up to four rectangles. Rectangles are [x0,z0,x1,z1]. */
function subtractRect(
  r: [number, number, number, number],
  h: [number, number, number, number],
): Array<[number, number, number, number]> {
  const [rx0, rz0, rx1, rz1] = r;
  const hx0 = Math.max(rx0, h[0]);
  const hz0 = Math.max(rz0, h[1]);
  const hx1 = Math.min(rx1, h[2]);
  const hz1 = Math.min(rz1, h[3]);
  if (hx1 <= hx0 || hz1 <= hz0) return [r];
  const out: Array<[number, number, number, number]> = [];
  if (hz0 > rz0) out.push([rx0, rz0, rx1, hz0]);
  if (hz1 < rz1) out.push([rx0, hz1, rx1, rz1]);
  if (hx0 > rx0) out.push([rx0, hz0, hx0, hz1]);
  if (hx1 < rx1) out.push([hx1, hz0, rx1, hz1]);
  return out;
}

export { subtractRect };
export type { DoorMaterial };
