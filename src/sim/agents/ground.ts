/**
 * What the ground is worth, and what is in the air over it.
 *
 * The city had a hundred numbers about itself and not one of them was about a
 * *place*. Coverage said a district was short of schools; the budget said the
 * week was in the black; nothing anywhere said that the streets behind the
 * cement works are a bad place to live and the ones along the park are a good
 * one. So every quarter of the map was worth the same as every other, the
 * industry the player zoned cost nothing to put next to housing, and a district
 * the player improved looked exactly like one they had ignored. A city builder
 * without land value is a painting program.
 *
 * Three fields, on the grid the coverage model already uses -- so a branch's
 * reach can be read at the same index without resampling anything.
 *
 *   pollution  what industry, power and traffic put in the air. Drifts a long
 *              way and fades slowly, which is why nobody builds houses downwind
 *              of a foundry.
 *   noise      engines, mostly. Falls off within a street or two, so the quiet
 *              side of a block is genuinely quieter than the main road.
 *   value      what a plot is worth, from everything above plus what is near it.
 *
 * WHAT READS THEM. The tiering model, which decides how grand a building the
 * land can carry and therefore what the spawner puts there; the population,
 * whose health the air affects; migration, which is choosier about where it
 * will settle than about whether it will come; the economy, which collects
 * more from valuable land; and two information views.
 *
 * COST. A whole-grid pass, which sounds worse than it is: nine thousand cells,
 * a walk of the places table that every other slow system also does, and four
 * separable box blurs. Under a millisecond for any city, on the slowest rate
 * the scheduler has. It is deliberately not sliced -- a field that is half this
 * second's and half last's has a seam down the middle of it, and the seam is
 * visible in the view.
 */

import type { Places } from './places';
import { ASSETS } from '../../assets/registry';
import { SERVICE_GRID } from './services';
import type { Services } from './services';
import { Util } from './utilities';
import type { Utilities } from './utilities';
import type { LaneGraph } from './lanes';
import { BRANCHES } from '../../assets/types';
import { Policies, NO_POLICIES } from '../policies';

/** The field grid. Shared with coverage so the two line up cell for cell. */
export const GROUND_GRID = SERVICE_GRID;
const N = GROUND_GRID * GROUND_GRID;

/**
 * How far each field carries, in cells.
 *
 * Pollution drifts: a works is a nuisance to the district, not to its own
 * street. Noise does not: a lorry is loud where it is and inaudible a block
 * away. Density is the widest of the three because it is standing in for "how
 * much city is around here", which is a question about the quarter.
 */
const SPREAD_POLLUTION = 7;
const SPREAD_NOISE = 2;
const SPREAD_DENSITY = 10;
const SPREAD_BLIGHT = 3;
/** Two passes of a box is close enough to a Gaussian for a field nobody measures. */
const PASSES = 2;

/** Branches whose presence makes a street somewhere people want to be. */
const AMENITY: { branch: number; weight: number }[] = [
  { branch: BRANCHES.indexOf('parks'), weight: 1.0 },
  { branch: BRANCHES.indexOf('education'), weight: 0.7 },
  { branch: BRANCHES.indexOf('health'), weight: 0.6 },
  { branch: BRANCHES.indexOf('transport'), weight: 0.6 },
  { branch: BRANCHES.indexOf('police'), weight: 0.4 },
  { branch: BRANCHES.indexOf('government'), weight: 0.3 },
];
const AMENITY_TOTAL = AMENITY.reduce((a, b) => a + b.weight, 0);

/**
 * The health a building has to fall below before it drags its street down.
 *
 * One boarded-up shop is a shame; a row of them is what makes the rest of the
 * row boarded up too, and that feedback is the whole reason blight is a field
 * rather than a property of a building.
 */
const BLIGHT_AT = 110;

function clampi(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** One separable box pass along the rows. */
function boxRows(src: Float32Array, dst: Float32Array, radius: number): void {
  const inv = 1 / (radius * 2 + 1);
  for (let z = 0; z < GROUND_GRID; z++) {
    const row = z * GROUND_GRID;
    let sum = 0;
    for (let i = -radius; i <= radius; i++) sum += src[row + clampi(i, 0, GROUND_GRID - 1)];
    for (let x = 0; x < GROUND_GRID; x++) {
      dst[row + x] = sum * inv;
      sum += src[row + clampi(x + radius + 1, 0, GROUND_GRID - 1)]
        - src[row + clampi(x - radius, 0, GROUND_GRID - 1)];
    }
  }
}

/** The same down the columns. */
function boxCols(src: Float32Array, dst: Float32Array, radius: number): void {
  const inv = 1 / (radius * 2 + 1);
  for (let x = 0; x < GROUND_GRID; x++) {
    let sum = 0;
    for (let i = -radius; i <= radius; i++) sum += src[clampi(i, 0, GROUND_GRID - 1) * GROUND_GRID + x];
    for (let z = 0; z < GROUND_GRID; z++) {
      dst[z * GROUND_GRID + x] = sum * inv;
      sum += src[clampi(z + radius + 1, 0, GROUND_GRID - 1) * GROUND_GRID + x]
        - src[clampi(z - radius, 0, GROUND_GRID - 1) * GROUND_GRID + x];
    }
  }
}

export class Ground {
  /** The ordinances in force: smoke control, and the planting policy. */
  private policies: Policies = NO_POLICIES;

  /** Points at the city's policies. Called whenever the world is replaced. */
  governedBy(policies: Policies): void {
    this.policies = policies;
  }

  /** Airborne filth, 0 clean to 1 unliveable. */
  readonly pollution = new Float32Array(N);
  /** Engines and plant, 0 quiet to 1 intolerable. */
  readonly noise = new Float32Array(N);
  /** What a plot here is worth, 0 to 1. */
  readonly value = new Float32Array(N);
  /** How much city is within a few streets. The shape of downtown. */
  readonly density = new Float32Array(N);
  /** Buildings on their way out, per cell, blurred. */
  readonly blight = new Float32Array(N);
  /** Plots with no power or no water, blurred: a whole block off supply. */
  private readonly starved = new Float32Array(N);

  private readonly a = new Float32Array(N);
  private readonly b = new Float32Array(N);

  private services: Services | null = null;
  private utilities: Utilities | null = null;
  private lanes: LaneGraph | null = null;
  private laneLoad: Float32Array | null = null;

  /** Metres across the field, and metres a cell. */
  private extent: number;
  private cell: number;

  /** City-wide readings, for the panels. */
  meanValue = 0;
  meanPollution = 0;
  meanNoise = 0;
  /** Parks and services within reach of the built-up city, 0 to 1. */
  meanAmenity = 0;
  worstPollution = 0;
  /** Share of the built-up cells whose air is bad enough to matter. */
  pollutedShare = 0;

  constructor(readonly places: Places, extent = 5120) {
    this.extent = extent;
    this.cell = extent / GROUND_GRID;
    // Empty land is worth something, and a brand new city should not read as a
    // slum until the first settle has run.
    this.value.fill(0.42);
  }

  resize(extent: number): void {
    this.extent = extent;
    this.cell = extent / GROUND_GRID;
  }

  /**
   * The rest of the model, attached after construction.
   *
   * Same reason the coverage model is: what the land is worth depends on the
   * services, and where the services are wanted depends on what the land is
   * worth, so one of the two has to be wired up second.
   */
  informedBy(services: Services, utilities: Utilities,
    lanes: LaneGraph, laneLoad: Float32Array): void {
    this.services = services;
    this.utilities = utilities;
    this.lanes = lanes;
    this.laneLoad = laneLoad;
  }

  /** The cell a world position falls in, or -1 for off the map. */
  cellAt(x: number, z: number): number {
    const half = this.extent / 2;
    const gx = ((x + half) / this.cell) | 0;
    const gz = ((z + half) / this.cell) | 0;
    if (gx < 0 || gz < 0 || gx >= GROUND_GRID || gz >= GROUND_GRID) return -1;
    return gz * GROUND_GRID + gx;
  }

  /** Land value at a world position, 0 to 1. */
  valueAt(x: number, z: number): number {
    const at = this.cellAt(x, z);
    return at < 0 ? 0 : this.value[at];
  }

  /** Pollution at a world position, 0 to 1. */
  pollutionAt(x: number, z: number): number {
    const at = this.cellAt(x, z);
    return at < 0 ? 0 : this.pollution[at];
  }

  /** Noise at a world position, 0 to 1. */
  noiseAt(x: number, z: number): number {
    const at = this.cellAt(x, z);
    return at < 0 ? 0 : this.noise[at];
  }

  /** The three, at a building. */
  valueOf(place: number): number {
    const c = this.places.col;
    return this.valueAt(c.x[place], c.z[place]);
  }

  pollutionOf(place: number): number {
    const c = this.places.col;
    return this.pollutionAt(c.x[place], c.z[place]);
  }

  noiseOf(place: number): number {
    const c = this.places.col;
    return this.noiseAt(c.x[place], c.z[place]);
  }

  /** Rebuilds all three fields. */
  settle(): void {
    this.emit();
    this.stampNoise();
    this.smooth();
    this.combine();
  }

  /**
   * What each building puts into the air and onto the ground under it.
   *
   * One walk, four fields. Pollution is scaled by how busy the place actually
   * is -- a works with nobody in it is a shed -- with a floor, because a plant
   * standing idle is still a plant.
   */
  private emit(): void {
    const { pollution, density, blight, starved } = this;
    pollution.fill(0);
    density.fill(0);
    blight.fill(0);
    starved.fill(0);
    const p = this.places;
    const c = p.col;
    const u = this.utilities;
    // Per cell rather than per square metre: the cell is the unit every one of
    // these fields is read in, and dividing by an area nobody measures in only
    // moves the constants below.
    for (let id = 0; id < p.count; id++) {
      if (p.live[id] === 0) continue;
      const at = this.cellAt(c.x[id], c.z[id]);
      if (at < 0) continue;
      const def = ASSETS[c.proto[id]];
      if (def !== undefined) {
        const dirt = def.sim.pollution;
        if (dirt > 0) {
          const jobs = c.jobs[id];
          const busy = jobs > 0 ? Math.max(0.35, c.working[id] / jobs) : 1;
          // Smoke control, where the smoke is made. A works under it burns
          // cleaner fuel through a filter; a shop or a house was never what
          // the order was about, so only industry is scaled.
          const clean = def.zone === 'industrial'
            ? this.policies.effects.industrialPollution : 1;
          pollution[at] += dirt * busy * clean;
        }
      }
      density[at] += c.homes[id] + c.jobs[id];
      const h = c.health[id];
      if (h < BLIGHT_AT) blight[at] += (BLIGHT_AT - h) / BLIGHT_AT;
      if (u !== null && (c.homes[id] > 0 || c.jobs[id] > 0)) {
        const supply = Math.min(u.at(id, Util.POWER), u.at(id, Util.WATER));
        if (supply < 0.9) starved[at] += 1 - supply;
      }
    }
  }

  /**
   * Traffic noise, along the lanes that carry it.
   *
   * Stamped from the lane's load rather than from its class: an empty motorway
   * is quiet and a jammed high street is not, and the player can do something
   * about the second one.
   */
  private stampNoise(): void {
    const noise = this.noise;
    noise.fill(0);
    const lanes = this.lanes;
    const load = this.laneLoad;
    if (lanes === null || load === null) return;
    const half = this.extent / 2;
    const scale = GROUND_GRID / this.extent;
    for (let l = 0; l < lanes.count; l++) {
      const v = load[l];
      if (v <= 0.02) continue;
      const ax = lanes.ax[l], az = lanes.az[l], bx = lanes.bx[l], bz = lanes.bz[l];
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) * scale));
      // Split along the lane so a long one does not deposit its whole load in
      // the cell its midpoint happens to fall in.
      const each = Math.min(1, v) / (steps + 1);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const gx = ((ax + (bx - ax) * t) + half) * scale | 0;
        const gz = ((az + (bz - az) * t) + half) * scale | 0;
        if (gx < 0 || gz < 0 || gx >= GROUND_GRID || gz >= GROUND_GRID) continue;
        noise[gz * GROUND_GRID + gx] += each;
      }
    }
  }

  /** Spreads each field by its own distance. */
  private smooth(): void {
    const { a, b } = this;
    const run = (field: Float32Array, radius: number): void => {
      for (let i = 0; i < PASSES; i++) {
        boxRows(field, a, radius);
        boxCols(a, b, radius);
        field.set(b);
      }
    };
    run(this.pollution, SPREAD_POLLUTION);
    run(this.noise, SPREAD_NOISE);
    run(this.density, SPREAD_DENSITY);
    run(this.blight, SPREAD_BLIGHT);
    run(this.starved, SPREAD_BLIGHT);
  }

  /**
   * What the land is worth.
   *
   * A weighted sum with no cleverness in it, because every term is something
   * the player did and the player has to be able to work backwards from the
   * colour to the cause. The one non-obvious term is density: a plot in the
   * middle of a city is worth more than the same plot on its edge, whatever is
   * built on either, and without that every map ends up uniformly suburban.
   */
  private combine(): void {
    const { value, pollution, noise, density, blight, starved } = this;
    const s = this.services;
    let sumValue = 0, sumDirt = 0, sumDin = 0, sumAmenity = 0;
    let worst = 0, dirty = 0, built = 0;
    const planted = this.policies.effects.landValue;
    for (let i = 0; i < N; i++) {
      // Saturating, because the difference between a foundry and four foundries
      // is much less than four times.
      const dirt = 1 - Math.exp(-pollution[i] * 1.8);
      pollution[i] = dirt;
      const din = Math.min(1, noise[i] * 0.55);
      noise[i] = din;

      let amenity = 0;
      if (s !== null) {
        for (const a of AMENITY) {
          if (a.branch < 0) continue;
          amenity += a.weight * s.reach[a.branch][i];
        }
        amenity /= AMENITY_TOTAL;
      }
      // The blur averages rather than accumulates, so this is people and jobs
      // per cell of field averaged over the two hundred metres around it --
      // not a total. Twenty-five is a properly built-up quarter; a suburb of
      // detached houses is two or three, and downtown is well over it.
      const centre = Math.min(1, density[i] / 25);

      // Green corridors and a height limit both move this, and both do it
      // everywhere at once: a policy is not a park, it does not have a
      // catchment, and pretending it does would be a lie the player could see
      // through the moment they opened the land value view.
      let v = 0.28 + planted
        + 0.34 * amenity
        + 0.22 * centre
        - 0.42 * dirt
        - 0.16 * din
        - 0.30 * Math.min(1, blight[i])
        - 0.22 * Math.min(1, starved[i]);
      if (v < 0.02) v = 0.02;
      else if (v > 1) v = 1;
      value[i] = v;

      // "Where the city is" for the city-wide averages. Half a person or job per
      // cell of field, averaged over the two hundred metres around it, is the
      // thinnest suburb; below that it is countryside and averaging it in would
      // say more about how much empty map there is than about the city.
      if (density[i] > 0.5) {
        built++;
        sumValue += v;
        sumDirt += dirt;
        sumDin += din;
        sumAmenity += amenity;
        if (dirt > 0.35) dirty++;
      }
      if (dirt > worst) worst = dirt;
    }
    this.meanValue = built > 0 ? sumValue / built : 0;
    this.meanPollution = built > 0 ? sumDirt / built : 0;
    this.meanNoise = built > 0 ? sumDin / built : 0;
    this.meanAmenity = built > 0 ? sumAmenity / built : 0;
    this.pollutedShare = built > 0 ? dirty / built : 0;
    this.worstPollution = worst;
  }

  bytes(): number {
    return (this.pollution.byteLength + this.noise.byteLength + this.value.byteLength
      + this.density.byteLength + this.blight.byteLength + this.starved.byteLength
      + this.a.byteLength + this.b.byteLength);
  }
}
