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

const FULL: SimConfig = { cityGrid: 440, terrainSize: 6144 };

/** Small enough to build and render anywhere, same code, same layout rules. */
export const LITE: SimConfig = { cityGrid: 90, terrainSize: 1536 };

export const simConfig: SimConfig = { ...FULL };

export function configureSim(partial: Partial<SimConfig>): void {
  Object.assign(simConfig, partial);
}
