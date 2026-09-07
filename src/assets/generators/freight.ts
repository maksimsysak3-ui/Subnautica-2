/**
 * Freight: the boxes, pallets, drums and crates that stand in a yard.
 *
 * These were written for the docks and then wanted by every storage yard,
 * works and depot in the library, so they live here rather than in marine.ts.
 * Nothing in this file knows what is carrying the freight -- a quayside, a
 * lorry bay and a builders' merchant all draw the same box.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { Tint } from '../mesh';

/** One ISO container. `key` picks its colour; `long` is a forty-foot box. */
export function container(m: MeshBuilder, x: number, y: number, z: number, long: boolean, key: number,
  turned = false, plain = false): void {
  const L = long ? 12.19 : 6.06, W = 2.44, H = 2.59;
  const hx = (turned ? W : L) / 2, hz = (turned ? L : W) / 2;
  m.keyed(key, () => {
    m.box([x - hx, y, z - hz], [x + hx, y + H, z + hz], MAT.CONTAINER, { roof: MAT.CONTAINER });
    // Corner castings. They are what a stack actually rests on, and the gap
    // they leave between boxes is the reason a stack does not read as one
    // striped block. Skipped on a ship's deck cargo: two hundred boxes seen
    // from the quayside is the one place the castings are not worth eighty
    // triangles each, and it is the difference between fitting the budget and
    // not.
    if (plain) {
      // One dark rail across the top instead. It costs a tenth of the castings
      // and does the job they were there for: it draws the line between one
      // box and the one stacked on it, so a bay reads as boxes rather than as
      // a striped block.
      m.painted(TINT.METAL_DARK, () => {
        m.box([x - hx, y + H - 0.16, z - hz - 0.03], [x + hx, y + H, z + hz + 0.03], MAT.TRIM);
      });
      return;
    }
    m.painted(TINT.METAL_DARK, () => {
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          m.box([x + sx * hx - 0.3, y, z + sz * hz - 0.3],
                [x + sx * hx + 0.3, y + 0.22, z + sz * hz + 0.3], MAT.TRIM);
          m.box([x + sx * hx - 0.3, y + H - 0.22, z + sz * hz - 0.3],
                [x + sx * hx + 0.3, y + H, z + sz * hz + 0.3], MAT.TRIM);
        }
      }
      // Doors at one end: two leaves with four locking bars each.
      const dx = turned ? 0 : hx, dz = turned ? hz : 0;
      for (let i = 0; i < 4; i++) {
        const u = (-0.72 + i * 0.48) * (turned ? 1 : 1);
        const bx = turned ? x + u : x + dx + 0.05;
        const bz = turned ? z + dz + 0.05 : z + u;
        m.box([bx - (turned ? 0.05 : 0.06), y + 0.2, bz - (turned ? 0.06 : 0.05)],
              [bx + (turned ? 0.05 : 0.06), y + H - 0.2, bz + (turned ? 0.06 : 0.05)], MAT.TRIM);
      }
    });
  });
}

/** A euro pallet, with stringers you can see daylight through. */
export function pallet(m: MeshBuilder, x: number, y: number, z: number, turns: 0 | 1 = 0): void {
  const L = turns ? 0.8 : 1.2, W = turns ? 1.2 : 0.8;
  m.painted(TINT.WOOD, () => {
    for (let i = 0; i < 3; i++) {
      const u = -L / 2 + 0.09 + (i / 2) * (L - 0.18);
      m.box([x + u - 0.08, y, z - W / 2], [x + u + 0.08, y + 0.1, z + W / 2], MAT.TIMBER);
    }
    for (let i = 0; i < 5; i++) {
      const v = -W / 2 + (i / 4) * (W - 0.11);
      m.box([x - L / 2, y + 0.1, z + v], [x + L / 2, y + 0.145, z + v + 0.11], MAT.TIMBER);
    }
  });
}

/** A drum, banded. */
export function drum(m: MeshBuilder, x: number, z: number, y: number, tint: Tint): void {
  m.painted(tint, () => {
    m.cylinder(x, z, 0.29, y, y + 0.88, 10, MAT.PAINT);
  });
  m.painted(TINT.METAL_DARK, () => {
    m.cylinder(x, z, 0.31, y + 0.24, y + 0.32, 10, MAT.TRIM, false);
    m.cylinder(x, z, 0.31, y + 0.56, y + 0.64, 10, MAT.TRIM, false);
  });
}

/** A timber crate: boards, corner posts and a diagonal brace. */
export function crate(m: MeshBuilder, x: number, y: number, z: number, w: number, d: number, h: number): void {
  m.painted(TINT.WOOD, () => {
    m.box([x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], MAT.TIMBER, { roof: MAT.TIMBER });
    for (const sx of [-1, 1]) {
      m.box([x + sx * w / 2 - 0.07, y, z - d / 2 - 0.05],
            [x + sx * w / 2 + 0.07, y + h, z + d / 2 + 0.05], MAT.TIMBER);
      m.box([x - w / 2 - 0.05, y, z + sx * d / 2 - 0.07],
            [x + w / 2 + 0.05, y + h, z + sx * d / 2 + 0.07], MAT.TIMBER);
    }
    for (const yy of [y + h * 0.18, y + h * 0.82]) {
      m.box([x - w / 2 - 0.05, yy, z - d / 2 - 0.05], [x + w / 2 + 0.05, yy + 0.1, z + d / 2 + 0.05], MAT.TIMBER);
    }
  });
}

/**
 * A run of pallet racking: uprights, beams, and pallets with loads on them.
 *
 * Runs along x from `x0` to `x1` centred on `z`, `bays` bays wide and `levels`
 * levels high. The loads are deliberately uneven -- a rack with every bay full
 * to the same height reads as a striped wall, and a real one never is.
 */
export function racking(m: MeshBuilder, x0: number, x1: number, z: number,
  bays: number, levels: number, seed: number): void {
  const D = 1.1, pitch = (x1 - x0) / bays, H = 1.9;
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i <= bays; i++) {
      const px = x0 + i * pitch;
      for (const sz of [-1, 1]) {
        m.box([px - 0.09, 0, z + sz * D - 0.09], [px + 0.09, levels * H + 0.3, z + sz * D + 0.09], MAT.TRIM);
      }
      // Diagonal bracing between the pair of uprights, which is what stops a
      // rack reading as two loose posts.
      m.box([px - 0.05, 0.9, z - D], [px + 0.05, 1.02, z + D], MAT.TRIM);
      m.box([px - 0.05, levels * H - 0.6, z - D], [px + 0.05, levels * H - 0.48, z + D], MAT.TRIM);
    }
  });
  for (let l = 0; l < levels; l++) {
    const y = l * H + H - 0.16;
    m.painted(TINT.METAL_DARK, () => {
      for (const sz of [-1, 1]) {
        m.box([x0, y, z + sz * D - 0.06], [x1, y + 0.16, z + sz * D + 0.06], MAT.TRIM);
      }
    });
    for (let i = 0; i < bays; i++) {
      const h = ((seed + i * 7 + l * 13) % 11) / 11;
      if (h < 0.22) continue;              // an empty bay, and there always is one
      const cx = x0 + (i + 0.5) * pitch;
      for (const sz of [-1, 1]) {
        const pz = z + sz * D * 0.5;
        pallet(m, cx, y + 0.16, pz, 0);
        const lh = 0.5 + h * 0.9;
        const timber = (seed + i + l) % 3 === 0;
        m.painted(timber ? TINT.WOOD : TINT.NONE, () =>
          m.box([cx - 0.58, y + 0.3, pz - 0.42], [cx + 0.58, y + 0.3 + lh, pz + 0.42],
            timber ? MAT.TIMBER : MAT.CONCRETE, { roof: timber ? MAT.TIMBER : MAT.CONCRETE }));
      }
    }
  }
}

/**
 * A bulk stockpile in a bay: two retaining walls and a heap between them.
 *
 * Aggregate, sand or spoil, depending on the tint you pass. The heap is a
 * ridge rather than a cone -- that is the shape a loading shovel actually
 * leaves, and it beds against the back wall instead of floating off it.
 */
export function stockpile(m: MeshBuilder, cx: number, cz: number, w: number, d: number,
  h: number, tint: Tint): void {
  const hx = w / 2, hz = d / 2;
  m.painted(TINT.NONE, () => {
    for (const sx of [-1, 1]) {
      m.box([cx + sx * hx - 0.3, 0, cz - hz], [cx + sx * hx + 0.3, h * 1.3, cz + hz], MAT.CONCRETE, { roof: MAT.CONCRETE });
    }
    m.box([cx - hx, 0, cz - hz - 0.3], [cx + hx, h * 1.3, cz - hz + 0.3], MAT.CONCRETE, { roof: MAT.CONCRETE });
  });
  // The heap: a ridge running along x, its crest a little off-centre and its
  // front face longer than its back, the way a pile spills forward.
  m.painted(tint, () => {
    const N = 7;
    const crest = cz - hz * 0.15;
    for (let i = 0; i < N; i++) {
      const a = cx - hx + 0.4 + (i / N) * (w - 0.8);
      const b = cx - hx + 0.4 + ((i + 1) / N) * (w - 0.8);
      const t = i / (N - 1);
      const hh = h * (0.55 + 0.45 * Math.sin(Math.PI * (0.2 + 0.6 * t)));
      const hn = h * (0.55 + 0.45 * Math.sin(Math.PI * (0.2 + 0.6 * ((i + 1) / (N - 1)))));
      m.tri([a, 0.05, cz + hz - 0.3], [b, 0.05, cz + hz - 0.3], [b, hn, crest], MAT.GROUND);
      m.tri([a, 0.05, cz + hz - 0.3], [b, hn, crest], [a, hh, crest], MAT.GROUND);
      m.tri([b, 0.05, cz - hz + 0.3], [a, 0.05, cz - hz + 0.3], [a, hh, crest], MAT.GROUND);
      m.tri([b, 0.05, cz - hz + 0.3], [a, hh, crest], [b, hn, crest], MAT.GROUND);
    }
  });
}
