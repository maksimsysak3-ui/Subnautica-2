/**
 * Working machines: what farms, forests, mines and quarries are worked with.
 *
 * The imported fleet is cars, buses and service vehicles, so a "truck" parked
 * at a mine came out as a fire engine. These are drawn to real proportions --
 * a tractor's rear wheels as tall as a man, a haul truck's taller than the cab
 * of a lorry -- in the palette slots a prop's brand fills: BRAND for the
 * paintwork, ACCENT for the second colour, METAL_DARK for the ironwork.
 *
 * Every machine is built facing +x at the origin and put in place with
 * `MeshBuilder.placed`, so a generator says where it stands and which way it
 * points and nothing else. `lite` drops wheel segments and small parts, for
 * the props that are repeated across a harvest area.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { Tint, Vec3 } from '../mesh';

/** The palette slot machines are painted in. BRAND unless a generator says otherwise. */
let BODY: Tint = TINT.BRAND;

/** Builds machines inside `fn` in another paint -- a green tractor on a gold field. */
export function paintedAs(tint: Tint, fn: () => void): void {
  const was = BODY;
  BODY = tint;
  try { fn(); } finally { BODY = was; }
}

/** A wheel: a tyre and a hub, spinning about z, standing on the ground. */
function wheel(m: MeshBuilder, x: number, z: number, r: number, halfW: number, lite: boolean): void {
  const sides = lite ? 8 : 14;
  m.pipe([x, r, z - halfW], [x, r, z + halfW], r, MAT.TYRE, sides);
  m.painted(TINT.ACCENT, () => {
    const out = z >= 0 ? 1 : -1;
    m.pipe([x, r, z + out * halfW * 0.9], [x, r, z + out * (halfW + 0.03)], r * 0.55, MAT.PAINT, lite ? 6 : 10);
  });
}

/** A glazed cab: a glass box with a painted roof and corner posts. */
function cab(m: MeshBuilder, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
  lite: boolean): void {
  m.box([x0 + 0.05, y0, z0 + 0.05], [x1 - 0.05, y1, z1 - 0.05], MAT.CAR_GLASS);
  m.painted(BODY, () => m.box([x0 - 0.06, y1, z0 - 0.06], [x1 + 0.06, y1 + 0.16, z1 + 0.06], MAT.PAINT));
  if (!lite) {
    m.painted(TINT.METAL_DARK, () => {
      for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]] as const) {
        m.box([px - 0.05, y0, pz - 0.05], [px + 0.05, y1, pz + 0.05], MAT.TRIM);
      }
    });
  }
}

/** A farm tractor, 4.6 m long. */
export function tractor(m: MeshBuilder, cx: number, cz: number, turns: number, lite = false): void {
  m.placed(cx, cz, turns, () => {
    m.painted(TINT.METAL_DARK, () => m.box([-1.7, 0.55, -0.42], [1.7, 1.1, 0.42], MAT.METAL));
    m.painted(BODY, () => {
      // The bonnet, stepping down to the grille, and the mudguards.
      m.box([0.1, 0.95, -0.52], [1.9, 1.78, 0.52], MAT.PAINT);
      m.box([1.9, 0.95, -0.46], [2.25, 1.6, 0.46], MAT.PAINT);
      for (const s of [-1, 1] as const) {
        m.box([-1.65, 1.62, s * 0.72], [0.05, 1.76, s * 1.28], MAT.PAINT);
        m.box([1.25, 1.12, s * 0.62], [1.95, 1.2, s * 0.92], MAT.PAINT);
      }
    });
    cab(m, -1.55, 1.1, -0.72, 0.15, 2.85, 0.72, lite);
    wheel(m, -0.8, -1.0, 0.86, 0.28, lite);
    wheel(m, -0.8, 1.0, 0.86, 0.28, lite);
    wheel(m, 1.6, -0.78, 0.52, 0.17, lite);
    wheel(m, 1.6, 0.78, 0.52, 0.17, lite);
    if (!lite) {
      m.painted(TINT.METAL_DARK, () => {
        m.box([2.2, 1.0, -0.4], [2.28, 1.55, 0.4], MAT.TRIM);
        m.pipe([0.9, 1.78, 0.36], [0.9, 3.1, 0.36], 0.06, MAT.METAL, 6);
        // The three-point linkage at the back.
        m.box([-2.15, 0.7, -0.5], [-1.7, 0.85, 0.5], MAT.METAL);
      });
    }
  });
}

/** A two-axle farm trailer, loaded or not. */
export function trailer(m: MeshBuilder, cx: number, cz: number, turns: number, load: 'grain' | 'bales' | 'none',
  lite = false): void {
  m.placed(cx, cz, turns, () => {
    m.painted(TINT.ACCENT, () => {
      m.box([-2.6, 0.95, -1.05], [2.4, 1.1, 1.05], MAT.PAINT);
      for (const s of [-1, 1] as const) m.box([-2.6, 1.1, s * 0.98 - 0.07], [2.4, 1.9, s * 0.98 + 0.07], MAT.PAINT);
      m.box([-2.6, 1.1, -1.05], [-2.46, 1.9, 1.05], MAT.PAINT);
      m.box([2.26, 1.1, -1.05], [2.4, 1.9, 1.05], MAT.PAINT);
    });
    m.painted(TINT.METAL_DARK, () => m.pipe([2.4, 0.9, 0], [3.4, 0.9, 0], 0.07, MAT.METAL, 5));
    for (const x of [-1.2, 1.0]) {
      wheel(m, x, -0.92, 0.46, 0.16, lite);
      wheel(m, x, 0.92, 0.46, 0.16, lite);
    }
    if (load === 'grain') {
      m.painted(BODY, () => m.box([-2.45, 1.1, -0.9], [2.25, 1.95, 0.9], MAT.GROUND));
    } else if (load === 'bales') {
      m.painted(TINT.WOOD, () => {
        for (let i = 0; i < 3; i++) m.pipe([-1.9 + i * 1.5, 1.8, -0.8], [-1.9 + i * 1.5, 1.8, 0.8], 0.68, MAT.TIMBER, lite ? 7 : 10);
      });
    }
  });
}

/** A combine harvester with its header down, 9 m long and 6.5 m across the cut. */
export function combine(m: MeshBuilder, cx: number, cz: number, turns: number, lite = false): void {
  m.placed(cx, cz, turns, () => {
    m.painted(BODY, () => {
      m.box([-3.6, 0.95, -1.35], [2.2, 3.3, 1.35], MAT.PAINT);
      m.box([-3.0, 3.3, -1.2], [0.4, 4.25, 1.2], MAT.PAINT);           // grain tank
      m.box([2.2, 0.65, -0.72], [3.3, 1.75, 0.72], MAT.PAINT);          // feeder house
    });
    cab(m, 1.0, 3.3, -0.95, 2.7, 4.95, 0.95, lite);
    // The header: a long trough across the front, with the reel over it.
    m.painted(TINT.ACCENT, () => {
      m.box([3.2, 0.35, -3.25], [4.45, 1.05, 3.25], MAT.PAINT);
      m.box([3.2, 1.05, -3.25], [3.5, 1.5, 3.25], MAT.PAINT);
    });
    m.painted(TINT.METAL_DARK, () => {
      m.pipe([4.05, 1.65, -3.1], [4.05, 1.65, 3.1], lite ? 0.28 : 0.42, MAT.METAL, lite ? 5 : 8);
      if (!lite) {
        // The unloading auger, folded back along the tank.
        m.pipe([-2.4, 4.0, 1.25], [0.6, 4.4, 1.45], 0.2, MAT.METAL, 6);
        m.pipe([-3.3, 3.0, 0.6], [-3.3, 4.6, 0.6], 0.08, MAT.METAL, 5);
      }
    });
    wheel(m, 1.4, -1.55, 0.9, 0.36, lite);
    wheel(m, 1.4, 1.55, 0.9, 0.36, lite);
    wheel(m, -2.8, -1.3, 0.55, 0.2, lite);
    wheel(m, -2.8, 1.3, 0.55, 0.2, lite);
  });
}

/** A tracked excavator with its arm out and bucket down, 9 m to the bucket. */
export function excavator(m: MeshBuilder, cx: number, cz: number, turns: number, lite = false): void {
  m.placed(cx, cz, turns, () => {
    // Tracks: a long slab each side with rounded ends.
    for (const s of [-1, 1] as const) {
      m.box([-2.1, 0.08, s * 1.45 - 0.35], [2.1, 0.9, s * 1.45 + 0.35], MAT.TYRE);
      if (!lite) {
        for (const x of [-2.1, 2.1]) m.pipe([x, 0.5, s * 1.45 - 0.35], [x, 0.5, s * 1.45 + 0.35], 0.42, MAT.TYRE, 8);
      }
    }
    m.painted(TINT.METAL_DARK, () => m.cylinder(0, 0, 1.0, 0.9, 1.05, lite ? 8 : 12, MAT.METAL));
    m.painted(BODY, () => {
      m.box([-2.3, 1.05, -1.3], [1.0, 2.15, 1.3], MAT.PAINT);
      m.box([-2.55, 1.05, -1.25], [-2.1, 2.0, 1.25], MAT.PAINT);       // counterweight
      // Boom and stick, as flattened sections.
      m.pipe([0.8, 1.9, -0.45], [3.5, 4.3, -0.45], 0.32, MAT.PAINT, 4);
      m.pipe([3.5, 4.3, -0.45], [5.0, 1.4, -0.45], 0.24, MAT.PAINT, 4);
    });
    cab(m, -0.1, 2.15, 0.05, 1.05, 3.35, 1.2, lite);
    m.painted(TINT.METAL_DARK, () => {
      m.box([4.5, 0.2, -1.0], [5.5, 1.3, 0.1], MAT.METAL);             // the bucket
      if (!lite) m.pipe([1.2, 1.6, -0.45], [3.0, 3.3, -0.45], 0.1, MAT.METAL, 6);
    });
  });
}

/** A rigid haul truck, 8 m long, with a heaped load in the body. */
export function haulTruck(m: MeshBuilder, cx: number, cz: number, turns: number, loaded: boolean,
  lite = false): void {
  m.placed(cx, cz, turns, () => {
    m.painted(TINT.METAL_DARK, () => m.box([-3.2, 1.1, -1.0], [3.2, 1.7, 1.0], MAT.METAL));
    m.painted(BODY, () => {
      // The body: a deep tub, sloping up at the back, with a canopy over the cab.
      m.box([-3.6, 1.7, -1.7], [1.7, 2.1, 1.7], MAT.PAINT);
      for (const s of [-1, 1] as const) m.box([-3.6, 2.1, s * 1.62 - 0.08], [1.7, 3.5, s * 1.62 + 0.08], MAT.PAINT);
      m.box([1.55, 2.1, -1.7], [1.75, 3.7, 1.7], MAT.PAINT);
      m.box([1.7, 3.5, -1.8], [3.7, 3.7, 1.8], MAT.PAINT);
      m.box([2.2, 1.7, -1.5], [3.6, 2.4, 1.5], MAT.PAINT);             // engine deck
    });
    cab(m, 2.35, 2.4, -1.5, 3.5, 3.45, -0.35, lite);
    if (loaded) {
      m.painted(TINT.ACCENT, () => m.cone(-1.0, 0, 1.6, 0.4, 2.1, 3.9, lite ? 6 : 9, MAT.GROUND));
    }
    for (const x of [-2.0, 2.7]) {
      wheel(m, x, -1.35, 1.1, 0.42, lite);
      wheel(m, x, 1.35, 1.1, 0.42, lite);
    }
  });
}

/** A wheel loader with its bucket lowered, 7 m long. */
export function loader(m: MeshBuilder, cx: number, cz: number, turns: number, lite = false): void {
  m.placed(cx, cz, turns, () => {
    m.painted(BODY, () => {
      m.box([-2.8, 0.9, -1.05], [-0.4, 2.2, 1.05], MAT.PAINT);          // engine, at the back
      m.box([-0.4, 0.9, -0.8], [1.6, 1.7, 0.8], MAT.PAINT);             // front frame
      m.pipe([1.0, 1.4, -0.6], [2.8, 1.0, -0.6], 0.14, MAT.PAINT, 4);   // lift arms
      m.pipe([1.0, 1.4, 0.6], [2.8, 1.0, 0.6], 0.14, MAT.PAINT, 4);
    });
    cab(m, -0.9, 1.7, -0.75, 0.6, 3.1, 0.75, lite);
    m.painted(TINT.METAL_DARK, () => m.box([2.6, 0.15, -1.35], [3.5, 1.35, 1.35], MAT.METAL));
    for (const x of [-1.8, 1.0]) {
      wheel(m, x, -1.0, 0.8, 0.3, lite);
      wheel(m, x, 1.0, 0.8, 0.3, lite);
    }
  });
}

/** A forestry forwarder: six wheels, a log bunk behind and a crane over it. */
export function forwarder(m: MeshBuilder, cx: number, cz: number, turns: number, loaded: boolean,
  lite = false): void {
  m.placed(cx, cz, turns, () => {
    m.painted(BODY, () => {
      m.box([1.2, 0.9, -1.0], [3.4, 1.9, 1.0], MAT.PAINT);              // front unit
      m.box([-3.6, 0.9, -1.0], [0.9, 1.3, 1.0], MAT.PAINT);             // rear frame
    });
    cab(m, 1.5, 1.9, -0.8, 2.8, 3.2, 0.8, lite);
    m.painted(TINT.METAL_DARK, () => {
      // Bunk stakes, and the crane folded over the load.
      for (const x of [-3.4, -1.2]) {
        for (const s of [-1, 1] as const) m.box([x - 0.06, 1.3, s * 0.95 - 0.06], [x + 0.06, 2.9, s * 0.95 + 0.06], MAT.METAL);
      }
      m.pipe([0.9, 1.3, 0], [0.9, 3.4, 0], 0.16, MAT.METAL, 6);
      m.pipe([0.9, 3.4, 0], [-2.2, 3.8, 0.2], 0.12, MAT.METAL, 5);
    });
    if (loaded) {
      m.painted(TINT.WOOD, () => {
        const n = lite ? 3 : 7;
        for (let i = 0; i < n; i++) {
          const zz = -0.7 + (i % 4) * 0.46, yy = 1.6 + Math.floor(i / 4) * 0.42;
          m.pipe([-3.7, yy, zz], [0.5, yy, zz], 0.22, MAT.BARK, lite ? 5 : 7);
        }
      });
    }
    for (const x of [-2.8, -1.6, 2.5]) {
      wheel(m, x, -1.05, 0.62, 0.26, lite);
      wheel(m, x, 1.05, 0.62, 0.26, lite);
    }
  });
}

/** A rigid lorry: a cab and a body that is a tipper, a flatbed of logs, or a tank. */
export function lorry(m: MeshBuilder, cx: number, cz: number, turns: number,
  body: 'tipper' | 'logs' | 'tank' | 'box', lite = false): void {
  m.placed(cx, cz, turns, () => {
    m.painted(TINT.METAL_DARK, () => m.box([-4.2, 0.75, -0.55], [3.4, 1.05, 0.55], MAT.METAL));
    m.painted(BODY, () => {
      m.box([2.0, 1.05, -1.2], [3.6, 3.1, 1.2], MAT.PAINT);
      m.box([3.6, 1.05, -1.15], [3.75, 2.0, 1.15], MAT.PAINT);
    });
    m.box([3.45, 2.1, -1.1], [3.62, 2.95, 1.1], MAT.CAR_GLASS);
    const deck = (): void => m.box([-4.3, 1.05, -1.22], [1.8, 1.25, 1.22], MAT.METAL);
    if (body === 'tipper') {
      m.painted(TINT.ACCENT, () => {
        deck();
        for (const s of [-1, 1] as const) m.box([-4.3, 1.25, s * 1.18 - 0.06], [1.8, 2.5, s * 1.18 + 0.06], MAT.PAINT);
        m.box([-4.3, 1.25, -1.22], [-4.15, 2.5, 1.22], MAT.PAINT);
        m.box([1.65, 1.25, -1.22], [1.8, 2.7, 1.22], MAT.PAINT);
      });
    } else if (body === 'logs') {
      m.painted(TINT.METAL_DARK, () => {
        deck();
        for (const x of [-3.8, -1.2, 1.3]) {
          for (const s of [-1, 1] as const) m.box([x - 0.05, 1.25, s * 1.1 - 0.05], [x + 0.05, 3.0, s * 1.1 + 0.05], MAT.METAL);
        }
      });
      m.painted(TINT.WOOD, () => {
        const n = lite ? 4 : 9;
        for (let i = 0; i < n; i++) {
          const zz = -0.8 + (i % 4) * 0.53, yy = 1.55 + Math.floor(i / 4) * 0.5;
          m.pipe([-4.4, yy, zz], [1.6, yy, zz], 0.27, MAT.BARK, lite ? 5 : 7);
        }
      });
    } else if (body === 'tank') {
      m.painted(TINT.METAL_DARK, deck);
      m.pipe([-4.2, 2.3, 0], [1.6, 2.3, 0], 1.1, MAT.PAINT, lite ? 8 : 14);
    } else {
      m.painted(TINT.ACCENT, () => m.box([-4.3, 1.05, -1.25], [1.8, 3.6, 1.25], MAT.PAINT));
    }
    for (const x of [-3.0, -1.9, 2.6]) {
      wheel(m, x, -1.0, 0.52, 0.2, lite);
      wheel(m, x, 1.0, 0.52, 0.2, lite);
    }
  });
}

/** A post-and-rail fence along a line, for yards and paddocks. */
export function fence(m: MeshBuilder, a: Vec3, b: Vec3, lite = false): void {
  const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const n = Math.max(1, Math.round(len / 2.4));
  m.painted(TINT.WOOD, () => {
    if (!lite) {
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t;
        m.box([x - 0.07, 0, z - 0.07], [x + 0.07, 1.15, z + 0.07], MAT.TIMBER);
      }
    }
    for (const y of [0.55, 1.0]) m.pipe([a[0], y, a[2]], [b[0], y, b[2]], 0.045, MAT.TIMBER, 4);
  });
}
