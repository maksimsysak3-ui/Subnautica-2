/**
 * A placeholder city, generated deterministically.
 *
 * Scaffolding for the renderer, not simulation: no agents, no economy, no
 * zoning rules. What it does establish is the layout the real systems will
 * use -- an 8 m zoning cell and a 6-cell block with streets between, straight
 * out of planning/CITY-SIM-DESIGN.md -- so the grid on the ground, the
 * buildings standing on it, and the road network later all agree.
 *
 * Buildings are placed in three passes, largest footprint first, because
 * proportion is what makes a skyline read as a city. A 150 m tower on a single
 * 8 m cell is a 1:19 needle; on a 3x3 block it is 1:6, which is roughly what
 * real towers are. The same coarse-to-fine placement is what the zoning system
 * will do once buildings come from asset packs with declared footprints.
 *
 * Deterministic on purpose. The design doc commits to a reproducible
 * simulation, which means no Math.random() anywhere, starting here.
 */

import { hash2 } from './hash';
import { heightAt } from './terrain';
import { simConfig } from './config';

/** Three vec4s per instance, matching struct Box in box.wgsl. */
export const INSTANCE_FLOATS = 12;

const CELL = 8;            // zoning cell, metres
const BLOCK = 6;           // cells per block; the seventh row is street
const MARGIN = 0.55;       // metres of air between a building and its lot edge

/** Largest fall across a footprint before the lot is left empty, in metres. */
const MAX_SLOPE = 4.5;

export interface City {
  /** Explicitly ArrayBuffer-backed: WebGPU's queue will not take a
   *  SharedArrayBuffer view, and the bare Float32Array type permits one. */
  data: Float32Array<ArrayBuffer>;
  count: number;
}

export function makeCity(): City {
  const GRID = simConfig.cityGrid;   // cells across; 440 is 3.5 km of city
  const half = GRID / 2;
  const out: number[] = [];
  const taken = new Uint8Array(GRID * GRID);

  const isStreet = (gx: number, gz: number): boolean =>
    gx % (BLOCK + 1) === 0 || gz % (BLOCK + 1) === 0;

  /** True when every cell of a size x size lot at (gx, gz) is free to build on. */
  const lotFree = (gx: number, gz: number, size: number): boolean => {
    if (gx + size > GRID || gz + size > GRID) return false;
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        if (isStreet(gx + i, gz + j)) return false;
        if (taken[(gz + j) * GRID + gx + i]) return false;
      }
    }
    return true;
  };

  const claim = (gx: number, gz: number, size: number): void => {
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) taken[(gz + j) * GRID + gx + i] = 1;
    }
  };

  /**
   * Emits one building filling a size x size lot, unless the ground under it
   * is too steep. Returns whether it was placed.
   */
  const place = (gx: number, gz: number, size: number, height: number): boolean => {
    const span = size * CELL;
    const cx = (gx - half) * CELL + span / 2;
    const cz = (gz - half) * CELL + span / 2;

    // Four corners rather than the centre, so the slope across the whole
    // footprint is what decides -- otherwise buildings hang in the air on
    // their downhill side.
    const h0 = heightAt(cx - span / 2, cz - span / 2);
    const h1 = heightAt(cx + span / 2, cz - span / 2);
    const h2 = heightAt(cx - span / 2, cz + span / 2);
    const h3 = heightAt(cx + span / 2, cz + span / 2);
    const lo = Math.min(h0, h1, h2, h3);
    if (Math.max(h0, h1, h2, h3) - lo > MAX_SLOPE) return false;

    // Footprint narrows a little with height, which reads as a tower rather
    // than an extruded lot.
    const shrink = 1 - Math.min(height / 420, 0.14);
    const halfExtent = (span / 2 - MARGIN) * shrink;

    // Cool concrete at street level warming towards the towers, with a small
    // per-building jitter so no two neighbours match exactly.
    const t = Math.min(height / 90, 1);
    const j = (hash2(gx, gz, 11) - 0.5) * 0.07;
    out.push(
      cx, cz, halfExtent, halfExtent,
      lo - 1.2, height + 1.2, 0, 0,
      0.20 + t * 0.34 + j, 0.24 + t * 0.36 + j, 0.30 + t * 0.38 + j, 1,
    );
    claim(gx, gz, size);
    return true;
  };

  /** 1 at the centre, 0 by a third of the way out. Land value, roughly. */
  const downtownAt = (gx: number, gz: number): number => {
    const cx = (gx - half) * CELL;
    const cz = (gz - half) * CELL;
    return Math.max(0, 1 - (Math.hypot(cx, cz) / (half * CELL)) * 3.2);
  };

  // Pass 1: towers on 3x3 lots, only near the centre and only where the dice
  // land. Rare and clustered -- this is what a skyline is.
  for (let gz = 1; gz < GRID - 3; gz += 3) {
    for (let gx = 1; gx < GRID - 3; gx += 3) {
      const d = downtownAt(gx, gz);
      if (d <= 0) continue;
      const roll = hash2(gx, gz, 7);
      if (roll > Math.pow(d, 1.5) * 0.55) continue;
      if (!lotFree(gx, gz, 3)) continue;
      const tall = hash2(gx, gz, 13);
      place(gx, gz, 3, 55 + Math.pow(d, 2.2) * 120 * (0.3 + tall));
    }
  }

  // Pass 2: mid-rise on 2x2 lots, spread more widely.
  for (let gz = 1; gz < GRID - 2; gz += 2) {
    for (let gx = 1; gx < GRID - 2; gx += 2) {
      const d = downtownAt(gx, gz);
      const roll = hash2(gx, gz, 23);
      if (roll > 0.16 + d * 0.42) continue;
      if (!lotFree(gx, gz, 2)) continue;
      place(gx, gz, 2, 16 + hash2(gx, gz, 29) * 26 + d * 18);
    }
  }

  // Pass 3: low-rise fills what is left. Most of any city is two to five
  // storeys, and this is that.
  for (let gz = 0; gz < GRID; gz++) {
    for (let gx = 0; gx < GRID; gx++) {
      if (!lotFree(gx, gz, 1)) continue;
      if (hash2(gx, gz, 1) < 0.22) continue;          // vacant lots
      place(gx, gz, 1, 6 + hash2(gx, gz, 3) * 11);
    }
  }

  // Sized from a plain array rather than wrapping one, so the result is backed
  // by an ArrayBuffer the GPU queue will accept.
  const data = new Float32Array(out.length);
  data.set(out);
  return { data, count: out.length / INSTANCE_FLOATS };
}
