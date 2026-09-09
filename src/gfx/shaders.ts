/**
 * The shader sources, with their includes resolved.
 *
 * One place, because the renderer, the asset viewer and the offscreen tools
 * all compile the same WGSL and a file that resolved includes in only two of
 * the three would fail in the third at pipeline creation -- which surfaces as
 * "invalid CommandBuffer" and names neither the file nor the line.
 */

import commonSrc from './shaders/common.wgsl?raw';
import atmosphereSrc from './shaders/atmosphere.wgsl?raw';
import noiseSrc from './shaders/noise.wgsl?raw';
import assetSrc from './shaders/asset.wgsl?raw';
import cullSrc from './shaders/cull.wgsl?raw';
import terrainSrc from './shaders/terrain.wgsl?raw';
import skySrc from './shaders/sky.wgsl?raw';

/** Files that may be included. Anything with an entry point is not one. */
const INCLUDES: Record<string, string> = {
  'common.wgsl': commonSrc,
  'atmosphere.wgsl': atmosphereSrc,
  'noise.wgsl': noiseSrc,
};

/** The whole preprocessor: textual include, one pass, resolved at load. */
export function resolve(src: string): string {
  return src.replace(/^[ \t]*#include\s+"([\w.-]+)"[ \t]*$/gm,
    (whole, name: string) => INCLUDES[name] ?? whole);
}

export const SHADERS = {
  asset: resolve(assetSrc),
  cull: resolve(cullSrc),
  terrain: resolve(terrainSrc),
  sky: resolve(skySrc),
};
