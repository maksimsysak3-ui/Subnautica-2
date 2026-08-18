/**
 * Casa Verdugo — outskirts.
 *
 * OWNED BY: World design team.
 *
 * The land around the compound. This exists for three reasons, in order of
 * importance:
 *
 *  1. **The approaches have to be real.** The villa advertises a front gate, a
 *     storm drain and a garden wall. If the player is dropped twenty metres
 *     from the wall, choosing between them is theatre. Insertion happens out
 *     here, and getting to your chosen approach is part of the mission.
 *  2. **Standoff.** A compound you can only see from its own doorstep can't be
 *     scouted. Terraces and the ridge give real overwatch positions, which is
 *     what makes optics and a recon pass worth anything.
 *  3. **Readability.** Approaching down a road past a checkpoint and an orchard
 *     tells you where you are and where the guns are, long before you're in
 *     range of them.
 *
 * Everything here sits on rolling terrain rather than the compound's graded
 * pad, so props are placed against a sampled ground height.
 */

import type { SiteBuilder } from '../builder';
import { Props } from '../props';
import { M } from '../palette';
import { BF } from '../types';
import type { Rng } from '../../core/math';

/** Compound perimeter, mirrored from villa.ts — the outskirts wrap it. */
const PERIM = { x0: -78, x1: 78, z0: -58, z1: 74 };
const PAD = 2.0;

/** How far the outskirts extend beyond the compound wall. */
export const OUTSKIRTS_REACH = 135;

export interface OutskirtsResult {
  /** Where a mission should insert the player, well back from the wall. */
  insertions: Array<{ id: string; x: number; z: number; label: string }>;
}

export function buildOutskirts(
  b: SiteBuilder,
  rng: Rng,
  groundAt: (x: number, z: number) => number,
): OutskirtsResult {
  const p = new Props(b);
  b.building('Outskirts');

  /** Places a brick sitting on the terrain rather than a flat pad. */
  const onGround = (
    x: number, z: number, hx: number, hy: number, hz: number, mat: number,
    o: Parameters<SiteBuilder['box']>[7] = {},
  ): number => b.box(x, groundAt(x, z) + hy, z, hx, hy, hz, mat, o);

  // =========================================================================
  // Access road — south, running to the main gate
  // =========================================================================
  const ROAD_W = 7.0;
  const roadZ0 = PERIM.z1 + 2;
  const roadZ1 = PERIM.z1 + OUTSKIRTS_REACH;

  // Laid as segments so the surface follows the ground instead of floating.
  for (let z = roadZ0; z < roadZ1; z += 6) {
    const zc = z + 3;
    // Slight lateral wander keeps it from reading as a ruled line.
    const wander = Math.sin(zc * 0.035) * 3.2;
    const y = groundAt(wander, zc);
    b.span(
      wander - ROAD_W / 2, y - 0.16, z, wander + ROAD_W / 2, y + 0.02, z + 6.2,
      M.asphalt,
      { surface: 'concrete', flags: BF.NO_COVER },
    );
    // Gravel shoulders — audibly different underfoot, which matters at night.
    for (const s of [-1, 1]) {
      b.span(
        wander + s * (ROAD_W / 2), y - 0.14, z,
        wander + s * (ROAD_W / 2 + 1.6), y - 0.02, z + 6.2,
        M.gravelMat,
        { surface: 'gravel', flags: BF.NO_COVER },
      );
    }
  }

  // Utility poles down the east verge, wired toward the compound.
  for (let z = roadZ0 + 10; z < roadZ1; z += 26) {
    const x = Math.sin(z * 0.035) * 3.2 + ROAD_W / 2 + 4.5;
    const y = groundAt(x, z);
    b.cyl(x, y + 4.4, z, 0.16, 4.4, M.woodDark, { surface: 'wood' });
    b.box(x, y + 8.2, z, 1.5, 0.09, 0.09, M.woodDark, { surface: 'wood', flags: BF.NO_COVER });
  }

  // =========================================================================
  // Roadside checkpoint — the loud approach announces itself
  // =========================================================================
  {
    const cz = PERIM.z1 + 52;
    const cx = Math.sin(cz * 0.035) * 3.2;
    const y = groundAt(cx, cz);

    // Staggered barriers force a slow weave — and give hard cover both ways.
    p.jerseyBarrier(cx - 5.0, y, cz - 4, 0, 4.0);
    p.jerseyBarrier(cx + 4.6, y, cz + 2, 0, 4.0);
    p.jerseyBarrier(cx - 4.2, y, cz + 8, 0, 3.4);

    p.sandbags(cx + 3.0, cz - 7.5, cx + 8.4, cz - 6.2, y, 3);
    p.tyreStack(cx + 7.0, y, cz + 4, 4);

    // Guard shack: a room the player can clear on the way in.
    const sx = cx - 10.5;
    const sz = cz;
    const sy = groundAt(sx, sz);
    const shackRoom = b.room({
      name: 'Checkpoint hut', tag: 'guard', indoors: true,
      minX: sx - 2.2, maxX: sx + 2.2, minZ: sz - 2.2, maxZ: sz + 2.2,
      minY: sy, maxY: sy + 2.7,
    });
    b.inRoom(shackRoom, () => {
      b.span(sx - 2.4, sy - 0.1, sz - 2.4, sx + 2.4, sy + 0.06, sz + 2.4, M.concreteRaw, { surface: 'concrete', flags: BF.NO_COVER });
      // Three walls and an open front, so it reads as occupied, not sealed.
      b.span(sx - 2.4, sy, sz - 2.4, sx + 2.4, sy + 2.6, sz - 2.1, M.plasterOchre, { surface: 'concrete', flags: BF.INDOORS });
      b.span(sx - 2.4, sy, sz - 2.4, sx - 2.1, sy + 2.6, sz + 2.4, M.plasterOchre, { surface: 'concrete', flags: BF.INDOORS });
      b.span(sx + 2.1, sy, sz - 2.4, sx + 2.4, sy + 2.6, sz + 2.4, M.plasterOchre, { surface: 'concrete', flags: BF.INDOORS });
      b.span(sx - 2.4, sy + 2.6, sz - 2.4, sx + 2.4, sy + 2.86, sz + 2.6, M.corrugated, { surface: 'metal', flags: BF.NO_COVER });
      p.table(sx, sy, sz - 1.4, 0, 1.6, 0.7, 0.75);
      p.chair(sx - 0.6, sy, sz - 0.6, 0);
    });
    p.floodlight(cx + 9.5, y, cz - 2, Math.PI, 5.0);
    p.drum(cx - 7.5, y, cz - 2);
    p.drum(cx - 7.0, y, cz - 0.9, M.rust);
    p.pickup(cx + 8.5, y, cz + 9, 0.4, M.rust);
  }

  // =========================================================================
  // Agricultural terraces — west flank, stepping down toward the arroyo
  // =========================================================================
  for (let t = 0; t < 4; t++) {
    const x0 = PERIM.x0 - 22 - t * 20;
    const z0 = -34;
    const z1 = 54;
    const wallY = groundAt(x0, (z0 + z1) / 2);
    // Retaining wall: chest-high cover running the length of the terrace.
    b.span(x0 - 0.5, wallY - 1.6, z0, x0 + 0.5, wallY + 0.9, z1, M.stoneTrim, { surface: 'concrete' });

    // Orchard rows behind it.
    for (let z = z0 + 6; z < z1 - 4; z += 9) {
      const tx = x0 - 8 + rng.range(-1.2, 1.2);
      const tz = z + rng.range(-1.5, 1.5);
      if (t % 2 === 0) p.shadeTree(tx, groundAt(tx, tz), tz, rng.range(5.5, 8));
      else p.cypress(tx, groundAt(tx, tz), tz, rng.range(4.5, 7));
    }
  }

  // Irrigation channel feeding the storm drain the villa advertises.
  for (let z = -30; z < 40; z += 8) {
    const x = PERIM.x0 - 12;
    const y = groundAt(x, z);
    b.span(x - 1.1, y - 0.9, z, x + 1.1, y - 0.35, z + 8.2, M.concreteRaw, { surface: 'concrete', flags: BF.NO_COVER });
  }

  // =========================================================================
  // Arroyo — a dry riverbed giving a covered west approach
  // =========================================================================
  for (let z = -60; z < 70; z += 10) {
    const x = PERIM.x0 - 52 + Math.sin(z * 0.05) * 9;
    const y = groundAt(x, z);
    // Cut banks either side; the bed itself is sand.
    b.span(x - 9, y - 0.3, z, x - 4.5, y + 1.5, z + 10.2, M.dirtMat, { surface: 'dirt' });
    b.span(x + 4.5, y - 0.3, z, x + 9, y + 1.5, z + 10.2, M.dirtMat, { surface: 'dirt' });
    b.span(x - 4.5, y - 0.45, z, x + 4.5, y - 0.28, z + 10.2, M.sandMat, { surface: 'sand', flags: BF.NO_COVER });
    if (rng.bool(0.4)) {
      const bx = x + rng.range(-3.5, 3.5);
      const bz = z + rng.range(1, 9);
      b.cyl(bx, groundAt(bx, bz) + 0.35, bz, rng.range(0.5, 1.1), 0.35, M.stoneTrim, { surface: 'concrete' });
    }
  }

  // =========================================================================
  // Outbuildings — reasons to leave the road
  // =========================================================================
  {
    // Barn on the east flank: big, empty, and a sightline onto the service gate.
    const bx = PERIM.x1 + 34;
    const bz = 10;
    const by = groundAt(bx, bz);
    const barn = b.room({
      name: 'Barn', tag: 'storage', indoors: true,
      minX: bx - 9, maxX: bx + 9, minZ: bz - 6.5, maxZ: bz + 6.5,
      minY: by, maxY: by + 5.2,
    });
    b.inRoom(barn, () => {
      b.span(bx - 9.2, by - 0.12, bz - 6.7, bx + 9.2, by + 0.05, bz + 6.7, M.concreteRaw, { surface: 'concrete', flags: BF.NO_COVER });
      // Long walls, with a wide opening in the south face.
      b.span(bx - 9.2, by, bz - 6.7, bx + 9.2, by + 5.0, bz - 6.3, M.corrugated, { surface: 'metal', flags: BF.INDOORS });
      b.span(bx - 9.2, by, bz - 6.7, bx - 8.8, by + 5.0, bz + 6.7, M.corrugated, { surface: 'metal', flags: BF.INDOORS });
      b.span(bx + 8.8, by, bz - 6.7, bx + 9.2, by + 5.0, bz + 6.7, M.corrugated, { surface: 'metal', flags: BF.INDOORS });
      for (const seg of [[-9.2, -3.4], [3.4, 9.2]] as const) {
        b.span(bx + seg[0], by, bz + 6.3, bx + seg[1], by + 5.0, bz + 6.7, M.corrugated, { surface: 'metal', flags: BF.INDOORS });
      }
      // Shallow gable, built from two wedges so it reads as a roof not a lid.
      b.wedge(bx, by + 5.6, bz - 3.3, 9.2, 0.9, 3.4, M.corrugated, { surface: 'metal', flags: BF.NO_COVER });
      b.wedge(bx, by + 5.6, bz + 3.3, 9.2, 0.9, 3.4, M.corrugated, { surface: 'metal', flags: BF.NO_COVER, yaw: Math.PI });
      for (let i = 0; i < 5; i++) p.pallet(bx - 6 + i * 3, by, bz - 3.5, rng.range(0, 3), 2 + rng.int(0, 3));
      p.crate(bx + 5, by, bz + 3, 0.3, 0.8);
      p.crate(bx + 6.1, by, bz + 3.4, 1.1, 0.7);
      p.drum(bx - 7.5, by, bz + 4.5);
    });
    p.container(bx + 13, by, bz - 8, 0.2);
    p.tyreStack(bx - 12, by, bz + 8, 5);
  }

  {
    // Pump house over the arroyo — small, hard, worth clearing.
    const px = PERIM.x0 - 44;
    const pz = 52;
    const py = groundAt(px, pz);
    const room = b.room({
      name: 'Pump house', tag: 'utility', indoors: true,
      minX: px - 3, maxX: px + 3, minZ: pz - 2.6, maxZ: pz + 2.6,
      minY: py, maxY: py + 3.0,
    });
    b.inRoom(room, () => {
      b.span(px - 3.2, py - 0.1, pz - 2.8, px + 3.2, py + 0.06, pz + 2.8, M.concreteRaw, { surface: 'concrete', flags: BF.NO_COVER });
      b.span(px - 3.2, py, pz - 2.8, px + 3.2, py + 2.9, pz - 2.5, M.concreteRaw, { surface: 'concrete', flags: BF.INDOORS });
      b.span(px - 3.2, py, pz + 2.5, px + 3.2, py + 2.9, pz + 2.8, M.concreteRaw, { surface: 'concrete', flags: BF.INDOORS });
      b.span(px - 3.2, py, pz - 2.8, px - 2.9, py + 2.9, pz + 2.8, M.concreteRaw, { surface: 'concrete', flags: BF.INDOORS });
      b.span(px + 2.9, py, pz - 2.8, px + 3.2, py + 1.1, pz + 2.8, M.concreteRaw, { surface: 'concrete', flags: BF.INDOORS });
      b.span(px - 3.2, py + 2.9, pz - 2.8, px + 3.2, py + 3.1, pz + 2.8, M.concreteRaw, { surface: 'concrete', flags: BF.NO_COVER });
      p.generator(px, py, pz, 0);
    });
    p.waterTank(px + 5.5, py, pz - 1, 1.4, 2.4);
  }

  // Ruined shell north of the compound — overwatch with real cover.
  {
    const rx = -30;
    const rz = PERIM.z0 - 40;
    const ry = groundAt(rx, rz);
    b.span(rx - 6, ry, rz - 4, rx + 6, ry + 2.6, rz - 3.7, M.stucco, { surface: 'concrete' });
    b.span(rx - 6, ry, rz - 4, rx - 5.7, ry + 1.4, rz + 4, M.stucco, { surface: 'concrete' });
    b.span(rx + 3.4, ry, rz - 4, rx + 3.7, ry + 2.2, rz + 1.2, M.stucco, { surface: 'concrete' });
    for (let i = 0; i < 7; i++) {
      const dx = rx + rng.range(-6, 6);
      const dz = rz + rng.range(-4, 4);
      b.box(dx, groundAt(dx, dz) + 0.18, dz, rng.range(0.3, 0.8), 0.18, rng.range(0.3, 0.7),
        M.concreteRaw, { surface: 'gravel', yaw: rng.range(0, 3.14), flags: BF.NO_COVER });
    }
  }

  // =========================================================================
  // Scatter — rocks and scrub so the ground isn't bare between landmarks
  // =========================================================================
  const inCompound = (x: number, z: number): boolean =>
    x > PERIM.x0 - 6 && x < PERIM.x1 + 6 && z > PERIM.z0 - 6 && z < PERIM.z1 + 6;

  for (let i = 0; i < 260; i++) {
    const x = rng.range(PERIM.x0 - OUTSKIRTS_REACH, PERIM.x1 + OUTSKIRTS_REACH);
    const z = rng.range(PERIM.z0 - OUTSKIRTS_REACH, PERIM.z1 + OUTSKIRTS_REACH);
    if (inCompound(x, z)) continue;
    // Keep the road surface clear.
    if (Math.abs(x - Math.sin(z * 0.035) * 3.2) < 6 && z > PERIM.z1) continue;
    const y = groundAt(x, z);
    const roll = rng.next();
    if (roll < 0.42) {
      const r = rng.range(0.35, 1.5);
      b.cyl(x, y + r * 0.55, z, r, r * 0.55, M.stoneTrim,
        { surface: 'concrete', yaw: rng.range(0, 3.14) });
    } else if (roll < 0.82) {
      // Scrub: soft, so it breaks up sightlines without stopping bullets.
      const s = rng.range(0.5, 1.2);
      b.box(x, y + s * 0.5, z, s, s * 0.5, s * 0.9, M.leafDry,
        { surface: 'foliage', flags: BF.SOFT | BF.NO_COVER, yaw: rng.range(0, 3.14) });
    } else {
      p.cypress(x, y, z, rng.range(3.5, 6.5));
    }
  }

  b.endBuilding();

  return {
    insertions: [
      { id: 'road-south', x: 2, z: PERIM.z1 + 118, label: 'Access road, 2km marker' },
      { id: 'arroyo-west', x: PERIM.x0 - 56, z: 58, label: 'Arroyo, west bank' },
      { id: 'terrace-west', x: PERIM.x0 - 62, z: -18, label: 'Upper terraces' },
      { id: 'ridge-north', x: -34, z: PERIM.z0 - 52, label: 'Ridge, north of the compound' },
    ],
  };
}
