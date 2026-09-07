/**
 * Landscape: the trees, benches and hedges that dress a garden or a forecourt.
 *
 * Written for the parks and then wanted by the crematorium, the funeral
 * director and half the civic buildings, so they live here rather than being
 * copied into each generator that needs a bench.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';

/** A tree: a trunk and two stacked crowns, which is enough at city scale. */
export function tree(m: MeshBuilder, cx: number, cz: number, h: number, r: number): void {
  m.painted(TINT.WOOD, () => m.cylinder(cx, cz, r * 0.16, 0, h * 0.42, 6, MAT.TIMBER));
  m.painted(TINT.GREEN, () => {
    m.cone(cx, cz, r, r * 0.75, h * 0.34, h * 0.72, 8, MAT.TRIM);
    m.cone(cx, cz, r * 0.78, 0.0, h * 0.66, h, 8, MAT.TRIM);
  });
}

/** A bench: two ends and a slatted seat and back. */
export function bench(m: MeshBuilder, cx: number, cz: number, turns: number): void {
  m.placed(cx, cz, turns, () => {
    m.painted(TINT.METAL_DARK, () => {
      for (const sx of [-0.8, 0.8]) {
        m.box([sx - 0.06, 0, -0.24], [sx + 0.06, 0.44, 0.24], MAT.TRIM);
        m.box([sx - 0.06, 0.44, -0.24], [sx + 0.06, 0.92, -0.14], MAT.TRIM);
      }
    });
    m.painted(TINT.WOOD, () => {
      for (const pz of [-0.22, -0.04, 0.14]) m.box([-0.9, 0.44, pz], [0.9, 0.5, pz + 0.14], MAT.TIMBER);
      for (const py of [0.58, 0.74]) m.box([-0.9, py, -0.22], [0.9, py + 0.13, -0.15], MAT.TIMBER);
    });
  });
}

/** A clipped hedge run. */
export function hedge(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number, h = 0.9): void {
  m.painted(TINT.GREEN, () => m.box([x0, 0.04, z0], [x1, h, z1], MAT.TRIM));
}
