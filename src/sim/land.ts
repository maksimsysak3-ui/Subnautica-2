/**
 * The land, before there is a river in it or a city on it.
 *
 * Its own module because the river has to read it -- a river runs in the low
 * ground, and where the low ground is is a question about this function --
 * while the terrain has to read the river. Left in one file that is a cycle;
 * split in two it is a line.
 */

import { fbm } from './hash';
import { simConfig } from './config';

export function naturalHeightAt(x: number, z: number): number {
  const s = 1 / 1100;
  const hills = (fbm(x * s, z * s, 5, 101) - 0.5) * 2;      // [-1, 1]
  const ridges = (fbm(x * s * 3.7, z * s * 3.7, 3, 233) - 0.5) * 2;

  // Distance from the city centre, 0 at origin and 1 at the map edge.
  const d = Math.min(Math.hypot(x, z) / (simConfig.terrainSize * 0.5), 1);
  const relief = Math.pow(Math.max(0, (d - 0.05) / 0.95), 1.05);

  // Fine undulation everywhere, including under the city. Undamped by the
  // relief ramp on purpose: without it the buildable centre is a dead-flat
  // plate that reads as a bug from overhead, and at +/-2 m over a ~90 m
  // wavelength it is shallow enough to build on and steep enough to shade.
  const detail = (fbm(x / 90, z / 90, 3, 909) - 0.5) * 2 * 2.1;

  return (hills * 150 + ridges * 34) * relief + detail;
}
