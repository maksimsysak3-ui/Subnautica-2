/**
 * The ground, as something the GPU can read.
 *
 * The grass pass runs entirely on the GPU: it decides where every blade
 * stands, and to do that it has to know two things the simulation owns -- how
 * high the ground is at that point, and whether anything has been built on it.
 * Neither can be worked out in a shader. The heightfield is noise plus the
 * grading the city did, and the grading is a relaxation over a grid; the cover
 * is the spawner's own record of which cells it filled.
 *
 * So both are baked into one texture, one texel per zoning cell, and rebuilt
 * whenever the city is. Four hundred and forty-one cells square is under a
 * megabyte, and sampling it is one fetch per blade.
 */

import { heightAt } from '../sim';
import type { City } from '../sim';

/** rg16float: r is height in metres, g is how open the ground is, 0 to 1. */
export const GROUND_FORMAT: GPUTextureFormat = 'rg32float';

export interface GroundMap {
  texture: GPUTexture;
  view: GPUTextureView;
  /** Cells across; the texture is this square. */
  size: number;
  /** Metres per texel. */
  cell: number;
}

export function buildGroundMap(device: GPUDevice, city: City, grid: number,
  cell = 8): GroundMap {
  const size = grid;
  const data = new Float32Array(size * size * 2);
  const half = grid / 2;
  for (let gz = 0; gz < size; gz++) {
    for (let gx = 0; gx < size; gx++) {
      const i = (gz * size + gx) * 2;
      // Sampled at the cell's centre, which is where a blade in that cell
      // stands; the corners belong to the terrain mesh.
      data[i] = heightAt((gx - half + 0.5) * cell, (gz - half + 0.5) * cell);
      data[i + 1] = city.cover[gz * size + gx] / 255;
    }
  }
  const texture = device.createTexture({
    label: 'ground-map',
    size: { width: size, height: size },
    format: GROUND_FORMAT,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture({ texture }, data, { bytesPerRow: size * 8 },
    { width: size, height: size });
  return { texture, view: texture.createView(), size, cell };
}
