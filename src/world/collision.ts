/**
 * Character collision against brick geometry.
 *
 * OWNED BY: World design team. Used by the player controller and by AI
 * movement, so both agree about what is walkable.
 *
 * Model: a vertical capsule approximated by a stack of horizontal discs. Each
 * disc is depenetrated from the closest point on every nearby brick. This is
 * cheap, stable, and — unlike a single sphere — cannot squeeze a standing
 * character through a waist-high gap.
 *
 * Three behaviours matter for a tactical shooter and are handled explicitly:
 *
 *  - **Step-up.** Kerbs, thresholds and stair treads under `stepHeight` are
 *    climbed without a jump. Without this, interiors are unusable.
 *  - **Ramps.** Wedge bricks are walked *on*, not into: a point above the
 *    sloped face is not obstructed, so ramps and stairs behave like floors.
 *  - **Ground precedence.** The floor is whichever is higher, terrain or the
 *    tallest walkable brick top beneath the character — that is what lets a
 *    player stand on a roof over open ground.
 */

import type { Brickyard } from './brickyard';
import { BF, SHAPE_BOX, SHAPE_WEDGE, SHAPE_CYL } from './types';

/** Matches the collision radius used by Brickyard for octagonal prisms. */
const CYL_R = 0.9239;

// The capsule and move-result shapes are part of the cross-team contract.
export type { CharacterShape, CharacterMove as MoveResult } from '../core/contracts';
import type { CharacterShape, CharacterMove as MoveResult } from '../core/contracts';

const result: MoveResult = {
  x: 0, y: 0, z: 0, grounded: false, hitWall: false, stepped: false, groundY: -Infinity,
};

/** Scratch — this runs every fixed step for every actor. */
const candidates: number[] = [];
let candidateCount = 0;

function collect(yard: Brickyard, minx: number, miny: number, minz: number, maxx: number, maxy: number, maxz: number): void {
  candidateCount = 0;
  yard.queryBox(minx, miny, minz, maxx, maxy, maxz, (b) => {
    // Solidity is its own flag. NO_NAV only means the navmesh rasteriser
    // skips a brick, and door leaves, railings, ladder rungs and door frames
    // all carry it while remaining very much solid — filtering on it here made
    // a third of the level walk-through, closed and locked doors included.
    // INVISIBLE bricks are nav blockers and trigger volumes, which are hints
    // rather than geometry.
    if ((yard.flags[b] & (BF.NO_COLLIDE | BF.INVISIBLE)) !== 0) return;
    candidates[candidateCount++] = b;
  });
}

/**
 * Closest point on a brick to (x,y,z), written into `outX/outY/outZ`.
 * Returns the squared distance, or Infinity when the brick should not obstruct
 * this point (a point resting above a wedge's slope).
 */
let outX = 0, outY = 0, outZ = 0;

function closestPoint(yard: Brickyard, i: number, x: number, y: number, z: number): number {
  const c = yard.cosY[i];
  const s = yard.sinY[i];
  const rx = x - yard.px[i];
  const rz = z - yard.pz[i];
  // Into the brick's local frame.
  let lx = c * rx - s * rz;
  let lz = s * rx + c * rz;
  let ly = y - yard.py[i];

  const hx = yard.hx[i];
  const hy = yard.hy[i];
  const hz = yard.hz[i];
  const shape = yard.shape[i];

  if (shape === SHAPE_WEDGE) {
    // Wedge is full at -z and tapers to nothing at +z. Its top surface is the
    // plane ly = -(hy/hz) * lz. A point above that plane is standing on the
    // ramp, not inside it, so it must not be pushed sideways.
    const surfaceY = -(hy / hz) * lz;
    if (ly >= surfaceY - 0.02 && Math.abs(lx) <= hx + 0.5 && Math.abs(lz) <= hz + 0.5) {
      return Infinity;
    }
  }

  if (shape === SHAPE_CYL) {
    // Elliptical cross-section: scale into a unit circle, clamp, scale back.
    const ax = hx * CYL_R;
    const az = hz * CYL_R;
    const nx = lx / ax;
    const nz = lz / az;
    const len = Math.hypot(nx, nz);
    if (len > 1) {
      lx = (nx / len) * ax;
      lz = (nz / len) * az;
    }
  } else {
    if (lx < -hx) lx = -hx; else if (lx > hx) lx = hx;
    if (lz < -hz) lz = -hz; else if (lz > hz) lz = hz;
  }
  if (ly < -hy) ly = -hy; else if (ly > hy) ly = hy;

  // Back to world space.
  outX = yard.px[i] + (c * lx + s * lz);
  outZ = yard.pz[i] + (-s * lx + c * lz);
  outY = yard.py[i] + ly;

  const dx = x - outX;
  const dy = y - outY;
  const dz = z - outZ;
  return dx * dx + dy * dy + dz * dz;
}

/** Highest walkable brick top at (x,z) within [minY, maxY]. */
/**
 * Is there a climbable surface (a ladder) within reach of this point?
 *
 * `BF.CLIMB` was set on the stiles and rungs of every ladder in both maps and
 * read by absolutely nothing — seven ladders, including the one the quay's
 * `stack-climb` approach is built around, that no player could ever go up.
 * This is the query that makes them work.
 */
export function climbAt(
  yard: Brickyard, x: number, y: number, z: number, radius = 0.75,
): boolean {
  collect(yard, x - radius, y - 0.6, z - radius, x + radius, y + 1.7, z + radius);
  for (let k = 0; k < candidateCount; k++) {
    const b = candidates[k];
    if ((yard.flags[b] & BF.CLIMB) === 0) continue;
    if ((yard.flags[b] & BF.INVISIBLE) !== 0) continue;
    return true;
  }
  return false;
}

export function brickGroundAt(
  yard: Brickyard, x: number, z: number, minY: number, maxY: number, radius = 0.12,
): number {
  collect(yard, x - radius, minY, z - radius, x + radius, maxY, z + radius);
  let best = -Infinity;
  for (let k = 0; k < candidateCount; k++) {
    const b = candidates[k];
    if ((yard.flags[b] & (BF.NO_WALK | BF.NO_COLLIDE | BF.INVISIBLE)) !== 0) continue;
    const top = yard.topAt(b, x, z);
    if (top > best && top >= minY && top <= maxY) best = top;
  }
  return best;
}

/**
 * Moves a character from (x,y,z) — y at the FEET — by (dx,dy,dz), resolving
 * against bricks and the terrain height function.
 *
 * The returned object is reused between calls; copy anything you keep.
 */
export function moveCharacter(
  yard: Brickyard,
  terrainAt: (x: number, z: number) => number,
  x: number, y: number, z: number,
  dx: number, dy: number, dz: number,
  shape: CharacterShape,
): MoveResult {
  const r = shape.radius;
  const h = shape.height;

  let px = x + dx;
  let py = y + dy;
  let pz = z + dz;
  let hitWall = false;
  let stepped = false;

  // Discs up the capsule. The lowest sits above stepHeight so kerbs are
  // stepped over rather than collided with.
  const discs = [shape.stepHeight + r * 0.5, h * 0.5, h - r * 0.6];

  // Iterative depenetration: each pass resolves only the single DEEPEST
  // overlap, then re-queries.
  //
  // Summing a full push for every overlapping brick in one sweep compounds
  // badly — a doorway puts the capsule against a leaf, two jambs and a lintel
  // at once, and applying all four pushes in sequence without re-testing
  // ejected the character metres away instead of stopping it. Resolving one
  // contact at a time converges to the same place a real solver would, and a
  // per-pass clamp keeps a bad start position from launching anyone.
  const MAX_PUSH_PER_PASS = r;
  for (let pass = 0; pass < 4; pass++) {
    collect(
      yard,
      px - r - 0.5, py - 0.1, pz - r - 0.5,
      px + r + 0.5, py + h + 0.1, pz + r + 0.5,
    );
    if (candidateCount === 0) break;

    let deepest = 0;
    let bestNx = 0, bestNz = 0;
    let bestBrick = -1;

    for (let d = 0; d < discs.length; d++) {
      const dyLocal = discs[d];
      if (dyLocal > h) continue;
      const sy = py + dyLocal;

      for (let k = 0; k < candidateCount; k++) {
        const b = candidates[k];
        const d2 = closestPoint(yard, b, px, sy, pz);
        if (d2 === Infinity || d2 >= r * r) continue;

        const depth = r - Math.sqrt(d2);
        if (depth <= deepest) continue;

        let nx = px - outX;
        let nz = pz - outZ;
        const len = Math.hypot(nx, nz);
        if (len < 1e-5) {
          // Dead centre — back out along the incoming motion instead.
          const mlen = Math.hypot(dx, dz) || 1;
          nx = -dx / mlen;
          nz = -dz / mlen;
        } else {
          nx /= len;
          nz /= len;
        }
        deepest = depth;
        bestNx = nx;
        bestNz = nz;
        bestBrick = b;
      }
    }

    if (bestBrick < 0) break;

    // Step up before treating it as a wall: a low ledge with headroom is a
    // stair tread, not an obstacle.
    const top = yard.topAt(bestBrick, px, pz);
    if (
      top !== -Infinity &&
      top > py &&
      top - py <= shape.stepHeight &&
      (yard.flags[bestBrick] & BF.NO_WALK) === 0 &&
      headroom(yard, px, top, pz, h, r)
    ) {
      py = top;
      stepped = true;
      continue;
    }

    const push = Math.min(deepest, MAX_PUSH_PER_PASS);
    px += bestNx * push;
    pz += bestNz * push;
    hitWall = true;
  }

  // --- ground ------------------------------------------------------------
  const terrainY = terrainAt(px, pz);
  const brickY = brickGroundAt(yard, px, pz, py - 2.2, py + shape.stepHeight + 0.05, r * 0.6);
  const groundY = Math.max(terrainY, brickY === -Infinity ? -Infinity : brickY);

  let grounded = false;
  if (groundY !== -Infinity && py <= groundY + 0.02) {
    py = groundY;
    grounded = true;
  }

  result.x = px;
  result.y = py;
  result.z = pz;
  result.grounded = grounded;
  result.hitWall = hitWall;
  result.stepped = stepped;
  result.groundY = groundY;
  return result;
}

/** True when a character of height `h` fits standing at (x, footY, z). */
function headroom(yard: Brickyard, x: number, footY: number, z: number, h: number, r: number): boolean {
  const lo = footY + 0.15;
  const hi = footY + h;
  if (hi <= lo) return true;
  let blocked = false;
  yard.queryBox(x - r * 0.6, lo, z - r * 0.6, x + r * 0.6, hi, z + r * 0.6, (b) => {
    if (blocked) return;
    if ((yard.flags[b] & (BF.NO_COLLIDE | BF.INVISIBLE)) !== 0) return;
    // Sample the column centre; a brick spanning it means no headroom.
    if (yard.containsPoint(b, x, (lo + hi) * 0.5, z)) blocked = true;
  });
  return !blocked;
}

export { SHAPE_BOX, SHAPE_WEDGE, SHAPE_CYL };
