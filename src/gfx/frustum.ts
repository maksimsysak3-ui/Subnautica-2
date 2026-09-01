/**
 * Frustum culling.
 *
 * Six planes pulled out of the view-projection matrix by the standard
 * Gribb-Hartmann trick: each plane is a sum or difference of two matrix rows.
 * Testing an axis-aligned box against a plane needs only the box corner
 * furthest along the plane normal -- if that one is behind, all eight are.
 *
 * Cheap enough to run on every chunk every frame, and it is the same test that
 * will later decide which buildings get instanced and which agents get
 * promoted to full simulation.
 */

import type { Mat4 } from '../math/m4';

export class Frustum {
  /** Six planes as (nx, ny, nz, d), packed flat. Also uploaded to the GPU
   *  culling pass, which runs the identical test per instance. */
  readonly planes = new Float32Array(24);

  /** Rebuilds from a column-major view-projection matrix. */
  update(m: Mat4): void {
    const p = this.planes;
    // row i of m is (m[i], m[4+i], m[8+i], m[12+i])
    const r = (i: number, j: number): number => m[j * 4 + i];

    const set = (k: number, a: number, b: number, c: number, d: number): void => {
      const len = Math.hypot(a, b, c) || 1;
      p[k] = a / len; p[k + 1] = b / len; p[k + 2] = c / len; p[k + 3] = d / len;
    };

    set(0,  r(3, 0) + r(0, 0), r(3, 1) + r(0, 1), r(3, 2) + r(0, 2), r(3, 3) + r(0, 3)); // left
    set(4,  r(3, 0) - r(0, 0), r(3, 1) - r(0, 1), r(3, 2) - r(0, 2), r(3, 3) - r(0, 3)); // right
    set(8,  r(3, 0) + r(1, 0), r(3, 1) + r(1, 1), r(3, 2) + r(1, 2), r(3, 3) + r(1, 3)); // bottom
    set(12, r(3, 0) - r(1, 0), r(3, 1) - r(1, 1), r(3, 2) - r(1, 2), r(3, 3) - r(1, 3)); // top
    // WebGPU clip space is z in [0, 1], so the near plane is row 2 alone --
    // not (w + z) as it would be in an OpenGL-style [-1, 1] clip space.
    set(16, r(2, 0), r(2, 1), r(2, 2), r(2, 3));                                          // near
    set(20, r(3, 0) - r(2, 0), r(3, 1) - r(2, 1), r(3, 2) - r(2, 2), r(3, 3) - r(2, 3)); // far
  }

  /** True when any part of the box may be visible. */
  containsBox(min: [number, number, number], max: [number, number, number]): boolean {
    const p = this.planes;
    for (let k = 0; k < 24; k += 4) {
      const nx = p[k], ny = p[k + 1], nz = p[k + 2];
      // The corner furthest along the plane normal.
      const x = nx >= 0 ? max[0] : min[0];
      const y = ny >= 0 ? max[1] : min[1];
      const z = nz >= 0 ? max[2] : min[2];
      if (nx * x + ny * y + nz * z + p[k + 3] < 0) return false;
    }
    return true;
  }
}
