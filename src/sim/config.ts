/**
 * World size, in one place.
 *
 * Exists so tests and low-powered devices can build a smaller world without a
 * separate code path. The deployment test runs the real bundle under a
 * software rasteriser, where a 627k-vertex terrain and a 100k-instance cull
 * crash the page -- which would otherwise force the test to guess at timings
 * instead of asserting something.
 *
 * sim/ must never read the URL or the DOM: the simulation has to run headless.
 * main.ts parses the query string and calls configureSim before anything is
 * built.
 */

export interface SimConfig {
  /** Zoning cells across the city, at 8 m each. */
  cityGrid: number;
  /** Metres across the terrain, centred on the origin. */
  terrainSize: number;
}

/**
 * The map: 640 cells of eight metres, so a bit over five kilometres square
 * and twenty-six square kilometres of buildable land.
 *
 * It was 440. What made the bigger map affordable was not a faster machine
 * but four fixes worth measuring: the polyline walk binary-searches instead of
 * scanning, the frontage pass looks up its district and stock once per
 * position rather than once per attempt and rejects a plot on its middle cell
 * before walking its whole footprint, and the road mesh pins the ground
 * through flat arrays rather than a map. A rebuild -- what the player waits
 * for after every edit -- costs 836 ms across twenty-six square kilometres,
 * against about a second for the old twelve.
 */
const FULL: SimConfig = { cityGrid: 640, terrainSize: 9216 };

/** Small enough to build and render anywhere, same code, same layout rules. */
export const LITE: SimConfig = { cityGrid: 90, terrainSize: 1536 };

export const simConfig: SimConfig = { ...FULL };

export function configureSim(partial: Partial<SimConfig>): void {
  Object.assign(simConfig, partial);
}
