/**
 * A placeholder city, generated deterministically.
 *
 * This is scaffolding for the renderer, not simulation: no agents, no economy,
 * no zoning rules. What it does establish is the layout the real systems will
 * use -- an 8 m zoning cell and a 6-cell block with streets between, straight
 * out of planning/CITY-SIM-DESIGN.md -- so the grid on the ground and the
 * buildings standing on it agree from the start.
 *
 * Deterministic on purpose. The design doc commits to a reproducible
 * simulation, which means no Math.random() anywhere, starting here.
 */

import { hash2 } from './hash';
import { heightAt } from './terrain';

/** Three vec4s per instance, matching struct Box in box.wgsl. */
export const INSTANCE_FLOATS = 12;

const CELL = 8;            // zoning cell, metres
const BLOCK = 6;           // cells per block; the seventh row is street
const GRID = 84;           // cells across, so ~672 m of city
const MARGIN = 0.55;       // metres of air between a building and its cell edge

export interface City {
  /** Explicitly ArrayBuffer-backed: WebGPU's queue will not take a
   *  SharedArrayBuffer view, and the bare Float32Array type permits one. */
  data: Float32Array<ArrayBuffer>;
  count: number;
}

export function makeCity(): City {
  const half = GRID / 2;
  const out: number[] = [];

  for (let gx = 0; gx < GRID; gx++) {
    for (let gz = 0; gz < GRID; gz++) {
      // Streets: every BLOCK+1th row and column is left empty.
      if (gx % (BLOCK + 1) === 0 || gz % (BLOCK + 1) === 0) continue;

      const r = hash2(gx, gz, 1);
      if (r < 0.12) continue;                       // vacant lots, so it is not a solid slab

      const cx = (gx - half) * CELL + CELL / 2;
      const cz = (gz - half) * CELL + CELL / 2;

      // Sit the building on the terrain under it. Sampling the four corners
      // rather than the centre catches the slope: too much fall across the
      // footprint and the lot is left empty rather than shipping a building
      // hanging in the air on its downhill side.
      const h0 = heightAt(cx - CELL / 2, cz - CELL / 2);
      const h1 = heightAt(cx + CELL / 2, cz - CELL / 2);
      const h2 = heightAt(cx - CELL / 2, cz + CELL / 2);
      const h3 = heightAt(cx + CELL / 2, cz + CELL / 2);
      const lo = Math.min(h0, h1, h2, h3);
      const hi = Math.max(h0, h1, h2, h3);
      if (hi - lo > 4.5) continue;

      // Density falls off from the centre, the way land value will later.
      const dist = Math.hypot(cx, cz) / (half * CELL);
      const downtown = Math.max(0, 1 - dist * 1.35);

      const spike = hash2(gx, gz, 7);
      const base = 9 + hash2(gx, gz, 3) * 13;
      const height = base + downtown * downtown * 74 * (0.4 + spike * 0.8);

      // Footprint shrinks slightly on taller buildings, which reads as a tower
      // rather than a block.
      const shrink = 1 - Math.min(height / 340, 0.16);
      const halfX = (CELL / 2 - MARGIN) * shrink;
      const halfZ = (CELL / 2 - MARGIN) * shrink;

      // Cool concrete at street level warming towards the towers, with a small
      // per-building jitter so no two neighbours match exactly.
      const t = Math.min(height / 80, 1);
      const j = (hash2(gx, gz, 11) - 0.5) * 0.06;
      const cr = 0.20 + t * 0.34 + j;
      const cg = 0.24 + t * 0.36 + j;
      const cb = 0.30 + t * 0.38 + j;

      // Base sunk slightly below the lowest corner so no daylight shows under
      // the footprint on sloping ground.
      out.push(
        cx, cz, halfX, halfZ,
        lo - 1.2, height + 1.2, 0, 0,
        cr, cg, cb, 1,
      );
    }
  }

  // Sized from a plain array rather than wrapping one, so the result is backed
  // by an ArrayBuffer the GPU queue will accept.
  const data = new Float32Array(out.length);
  data.set(out);
  return { data, count: out.length / INSTANCE_FLOATS };
}
