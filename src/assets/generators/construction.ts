/**
 * The building site: what stands on a plot between the day it is cleared and
 * the day there is a building on it.
 *
 * Until now a plot went from grass to a finished six-storey block between one
 * frame and the next, which is the single most artificial thing a city builder
 * can do -- the player's own zoning arrives as a fait accompli, with no moment
 * of "that one is going up". The growth model already knows exactly when it
 * released a patch, so the only thing missing was something to stand there
 * while it does.
 *
 * Three prototypes, drawn per frame from the live site list the same way the
 * traffic is (see `sim/agents/movers.ts`), because a site is temporary and
 * baking it into the city mesh would mean rebuilding that rectangle twice per
 * plot instead of once:
 *
 *   `site.pad`    the cleared and graded ground, hoarded off, with the spoil,
 *                 the cabin and the materials that come with it. One per plot,
 *                 for the whole of the build.
 *   `site.frame`  the structure going up: columns, slabs, scaffold. Appears
 *                 partway through, so a plot visibly progresses.
 *   `site.crane`  a tower crane over the plot. The thing you can see from the
 *                 other side of the city, which is the point of it.
 *
 * `fleet` rather than a zoned kind, for the same reason the vehicles are: these
 * are not buildings the player places, they have no jobs and no demand, and the
 * spawner must never pick one.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';

/** A site costs the city nothing: the building it becomes does. */
const free: AssetDef['sim'] = {
  jobs: 0, households: 0, powerKW: 0, waterM3: 0, garbagePerWeek: 0,
  pollution: 0, upkeep: 0,
};

/** Earth and safety yellow, which is every building site anywhere. */
const SITE: AssetDef['brand'] = {
  name: 'Site', colour: [0.58, 0.47, 0.33], accent: [0.86, 0.66, 0.13],
  sign: 'box',
};

/** Cells across one released patch, in metres. Must match growth's `PATCH`. */
const PAD = 40;

/**
 * A heap of spoil: a four-sided pyramid with a flattened top.
 *
 * Cones read as traffic cones at this scale and cost twice the triangles. A
 * squat pyramid with a ridge is what a bucket leaves.
 */
function heap(m: MeshBuilder, cx: number, cz: number, r: number, h: number): void {
  const t = r * 0.28;
  m.box([cx - r, 0, cz - r], [cx + r, h * 0.42, cz + r], MAT.GROUND);
  m.box([cx - t, h * 0.42, cz - t], [cx + t, h, cz + t], MAT.GROUND);
}

/** Boarded hoarding on posts, which is what closes a site off from the street. */
function hoarding(m: MeshBuilder, half: number, lod: number, gate: number): void {
  const H = 2.45;
  const step = lod < 1 ? 2.4 : lod < 2 ? 5 : 10;
  m.painted(TINT.ACCENT, () => {
    const run = (ax: number, az: number, bx: number, bz: number,
      open: boolean): void => {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(2, Math.round(len / step));
      const ux = (bx - ax) / n, uz = (bz - az) / n;
      for (let i = 0; i < n; i++) {
        const mid = (i + 0.5) / n;
        // The gate: a gap in one run, wide enough for a lorry.
        if (open && Math.abs(mid - 0.5) < gate) continue;
        const x0 = ax + ux * i, z0 = az + uz * i;
        const x1 = x0 + ux, z1 = z0 + uz;
        m.box([Math.min(x0, x1) - 0.06, 0.1, Math.min(z0, z1) - 0.06],
          [Math.max(x0, x1) + 0.06, H, Math.max(z0, z1) + 0.06], MAT.TRIM);
      }
      if (lod < 2) {
        for (let i = 0; i <= n; i++) {
          const px = ax + ux * i, pz = az + uz * i;
          m.painted(TINT.METAL_DARK, () => {
            m.box([px - 0.11, 0, pz - 0.11], [px + 0.11, H + 0.22, pz + 0.11], MAT.TRIM);
          });
        }
      }
    };
    run(-half, -half, half, -half, true);
    run(-half, half, half, half, false);
    run(-half, -half, -half, half, false);
    run(half, -half, half, half, false);
  });
}

/**
 * The cleared plot.
 *
 * Graded earth inside a hoarding, with the pit the foundations go in, the spoil
 * that came out of it, the cabin the site is run from and the materials waiting
 * to be lifted. Everything here is at ground level or just above it, so it
 * never fights the building that replaces it.
 */
function pad(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const half = PAD / 2;
  // The graded surface. Raised a touch so it reads as made ground rather than
  // as a stain on the grass, and inset from the hoarding line.
  m.painted(TINT.BRAND, () => {
    m.box([-half, 0, -half], [half, 0.34, half], MAT.GROUND);
    // The excavation: a rim of earth round a floor of blinding concrete, which
    // is the one thing that says a building is coming rather than leaving.
    const p = half * 0.56;
    m.painted(TINT.NONE, () => {
      m.box([-p, 0.34, -p], [p, 0.42, p], MAT.CONCRETE);
      if (lod < 2) {
        // Pile caps on a grid, which is the footprint of what is coming.
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            const x = -p * 0.66 + (p * 1.32 * i) / 2;
            const z = -p * 0.66 + (p * 1.32 * j) / 2;
            m.box([x - 1.1, 0.42, z - 1.1], [x + 1.1, 0.95, z + 1.1], MAT.CONCRETE);
            if (lod < 1) {
              // Starter bars out of the top of each cap.
              m.painted(TINT.METAL_DARK, () => {
                for (const [ox, oz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
                  m.box([x + ox - 0.035, 0.95, z + oz - 0.035],
                    [x + ox + 0.035, 2.05, z + oz + 0.035], MAT.TRIM);
                }
              });
            }
          }
        }
      }
    });
    heap(m, -half + 5.5, half - 6, 3.4, 2.6);
    if (lod < 2) heap(m, half - 6.5, -half + 7, 2.6, 2.0);
    if (lod < 1) heap(m, half - 7, half - 5.5, 2.1, 1.5);
  });

  // The cabin: a stacked pair of portable offices with a stair between them.
  m.painted(TINT.NONE, () => {
    const cx = -half + 7.5, cz = -half + 5.5;
    for (let f = 0; f < 2; f++) {
      m.box([cx - 4.2, 0.4 + f * 2.85, cz - 1.5], [cx + 4.2, 3.1 + f * 2.85, cz + 1.5],
        MAT.CLADDING);
      if (lod < 2) {
        m.painted(TINT.NONE, () => {
          for (let w = 0; w < 3; w++) {
            const wx = cx - 2.8 + w * 2.8;
            m.box([wx - 0.85, 1.5 + f * 2.85, cz - 1.56],
              [wx + 0.85, 2.5 + f * 2.85, cz - 1.5], MAT.PANE);
          }
        });
      }
    }
    if (lod < 1) {
      m.painted(TINT.METAL_DARK, () => {
        for (let s = 0; s <= 8; s++) {
          const y = 0.4 + (s * 2.45) / 8;
          m.box([cx + 4.3, y, cz - 1.2 + s * 0.28],
            [cx + 5.6, y + 0.08, cz - 0.95 + s * 0.28], MAT.TRIM);
        }
        m.box([cx + 5.5, 0.4, cz - 1.4], [cx + 5.66, 3.4, cz + 1.4], MAT.TRIM);
      });
    }
  });

  // Materials, stacked the way a site stacks them: blocks on pallets, a bundle
  // of rebar, pipe in a rack, and a skip for what comes back out.
  m.painted(TINT.NONE, () => {
    const bx = half - 8, bz = -half + 5;
    for (let s = 0; s < (lod < 2 ? 3 : 1); s++) {
      m.box([bx - 1.3 + s * 2.9, 0.34, bz - 1.1], [bx + 1.3 + s * 2.9, 1.5, bz + 1.1],
        MAT.CONCRETE);
    }
    if (lod < 1) {
      m.painted(TINT.WOOD, () => {
        for (let s = 0; s < 3; s++) {
          m.box([bx - 1.4 + s * 2.9, 0.34, bz - 1.2], [bx + 1.4 + s * 2.9, 0.48, bz + 1.2],
            MAT.TRIM);
        }
      });
      m.painted(TINT.METAL_DARK, () => {
        // A pipe rack, which is the only round thing on a site.
        for (let r = 0; r < 2; r++) {
          for (let p = 0; p < 4 - r; p++) {
            m.pipe([-6 + p * 0.62 + r * 0.31, 0.65 + r * 0.6, half - 4.5],
              [-6 + p * 0.62 + r * 0.31, 0.65 + r * 0.6, half - 11.5], 0.28, MAT.METAL, 6);
          }
        }
      });
    }
    // The skip, tipped the way skips are: a wedge open at the top.
    m.painted(TINT.ACCENT, () => {
      const sx = 3, sz = -half + 4.4;
      m.box([sx - 3, 0.34, sz - 1.2], [sx + 3, 1.9, sz + 1.2], MAT.METAL);
      m.painted(TINT.NONE, () => {
        m.box([sx - 2.7, 1.55, sz - 0.95], [sx + 2.7, 1.8, sz + 0.95], MAT.GROUND);
      });
    });
  });

  hoarding(m, half - 0.4, lod, 0.16);
  return m;
}

/**
 * A lattice section: four legs, ties at every node, and a diagonal per bay.
 *
 * The one piece of geometry this file really needs to get right -- a tower
 * crane read from six hundred metres is a lattice or it is a stick. The bay
 * height rather than the count is the parameter, so a mast and a jib built from
 * this have the same weave.
 */
function lattice(m: MeshBuilder, x0: number, y0: number, z0: number,
  x1: number, y1: number, z1: number, bay: number, leg: number, lod: number): void {
  const horiz = Math.abs(x1 - x0) > Math.abs(y1 - y0);
  const len = horiz ? x1 - x0 : y1 - y0;
  const w = horiz ? (y1 - y0) / 2 : (x1 - x0) / 2;
  const d = (z1 - z0) / 2;
  const cy = horiz ? (y0 + y1) / 2 : 0;
  const cz = (z0 + z1) / 2;
  // The four chords.
  for (const oy of [-w, w]) {
    for (const oz of [-d, d]) {
      if (horiz) {
        m.box([x0, cy + oy - leg, cz + oz - leg], [x1, cy + oy + leg, cz + oz + leg], MAT.TRIM);
      } else {
        m.box([(x0 + x1) / 2 + oy - leg, y0, cz + oz - leg],
          [(x0 + x1) / 2 + oy + leg, y1, cz + oz + leg], MAT.TRIM);
      }
    }
  }
  if (lod >= 2) return;
  const bays = Math.max(1, Math.round(Math.abs(len) / bay));
  const step = len / bays;
  const t = leg * 0.62;
  for (let i = 0; i <= bays; i++) {
    const at = (horiz ? x0 : y0) + step * i;
    // A ring of ties at every node.
    if (horiz) {
      m.box([at - t, cy - w - t, cz - d - t], [at + t, cy + w + t, cz - d + t], MAT.TRIM);
      m.box([at - t, cy - w - t, cz + d - t], [at + t, cy + w + t, cz + d + t], MAT.TRIM);
      m.box([at - t, cy - w - t, cz - d - t], [at + t, cy - w + t, cz + d + t], MAT.TRIM);
      m.box([at - t, cy + w - t, cz - d - t], [at + t, cy + w + t, cz + d + t], MAT.TRIM);
    } else {
      const mx = (x0 + x1) / 2;
      m.box([mx - w - t, at - t, cz - d - t], [mx + w + t, at + t, cz - d + t], MAT.TRIM);
      m.box([mx - w - t, at - t, cz + d - t], [mx + w + t, at + t, cz + d + t], MAT.TRIM);
      m.box([mx - w - t, at - t, cz - d - t], [mx - w + t, at + t, cz + d + t], MAT.TRIM);
      m.box([mx + w - t, at - t, cz - d - t], [mx + w + t, at + t, cz + d + t], MAT.TRIM);
    }
    if (i === bays || lod >= 1) continue;
    // One diagonal per bay per face, alternating, which is what makes a lattice
    // look braced rather than ruled.
    const a = at + (i % 2 === 0 ? 0 : step);
    const b = at + (i % 2 === 0 ? step : 0);
    if (horiz) {
      m.pipe([a, cy - w, cz - d], [b, cy + w, cz - d], t, MAT.TRIM, 4);
      m.pipe([a, cy - w, cz + d], [b, cy + w, cz + d], t, MAT.TRIM, 4);
      m.pipe([a, cy - w, cz - d], [b, cy - w, cz + d], t, MAT.TRIM, 4);
    } else {
      const mx = (x0 + x1) / 2;
      m.pipe([mx - w, a, cz - d], [mx + w, b, cz - d], t, MAT.TRIM, 4);
      m.pipe([mx - w, a, cz + d], [mx + w, b, cz + d], t, MAT.TRIM, 4);
      m.pipe([mx - w, a, cz - d], [mx - w, b, cz + d], t, MAT.TRIM, 4);
    }
  }
}

/**
 * A tower crane, jib along +x.
 *
 * Proportioned off a real one: a two-metre mast, a jib about twice the mast's
 * height, a counter-jib a third of the jib, and the counterweight on the back
 * of it. The hook hangs from a trolley two thirds out, which is where a trolley
 * spends most of its day.
 */
function crane(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const MAST = 2.0;             // half-width of the mast
  const TOP = 38;               // slewing ring height
  const JIB = 30;               // jib reach from the mast centre
  const BACK = 11;              // counter-jib

  // Ballast: cross of precast blocks under the mast.
  m.painted(TINT.NONE, () => {
    m.box([-5.6, 0, -2.4], [5.6, 1.15, 2.4], MAT.CONCRETE);
    m.box([-2.4, 0, -5.6], [2.4, 1.15, 5.6], MAT.CONCRETE);
    m.box([-MAST - 0.5, 1.15, -MAST - 0.5], [MAST + 0.5, 2.1, MAST + 0.5], MAT.CONCRETE);
  });

  m.painted(TINT.ACCENT, () => {
    lattice(m, -MAST, 2.1, -MAST, MAST, TOP, MAST, 2.8, 0.19, lod);
    // Slewing ring and the machinery deck on top of it.
    m.painted(TINT.NONE, () => {
      m.cylinder(0, 0, MAST * 1.05, TOP, TOP + 0.7, lod < 1 ? 12 : 6, MAT.METAL);
    });
    m.box([-MAST - 0.3, TOP + 0.7, -MAST - 0.3], [MAST + 0.3, TOP + 1.5, MAST + 0.3],
      MAT.METAL);

    // The jib, tapering: full depth at the root, shallow at the tip.
    lattice(m, 0, TOP + 1.5, -1.05, JIB * 0.55, TOP + 3.1, 1.05, 3.2, 0.14, lod);
    lattice(m, JIB * 0.55, TOP + 1.7, -0.8, JIB, TOP + 2.7, 0.8, 3.2, 0.11, lod);
    // The counter-jib, and the block of counterweight that balances the reach.
    lattice(m, -BACK, TOP + 1.5, -1.05, 0, TOP + 3.1, 1.05, 3.2, 0.14, lod);
    m.painted(TINT.NONE, () => {
      for (let b = 0; b < 3; b++) {
        m.box([-BACK + 0.4 + b * 1.35, TOP + 0.4, -1.5],
          [-BACK + 1.6 + b * 1.35, TOP + 3.2, 1.5], MAT.CONCRETE);
      }
    });

    // The A-frame and the tie bars that hold the two arms up. Without these a
    // crane reads as a plus sign; with them it reads as a crane.
    const APEX = TOP + 9.5;
    m.box([-0.7, TOP + 1.5, -0.16], [0.7, APEX, 0.16], MAT.TRIM);
    m.box([-0.16, TOP + 1.5, -0.7], [0.16, APEX, 0.7], MAT.TRIM);
    const tie = (x: number, y: number): void => {
      m.pipe([0, APEX, 0], [x, y, 0], 0.11, MAT.TRIM, 4);
    };
    tie(JIB * 0.55, TOP + 3.1);
    tie(JIB, TOP + 2.7);
    tie(-BACK, TOP + 3.1);

    // Cab, slung under the jib root on the mast, glazed on three sides.
    m.painted(TINT.NONE, () => {
      m.box([1.1, TOP - 2.6, -1.25], [4.3, TOP + 0.4, 1.25], MAT.CLADDING);
      m.box([1.15, TOP - 1.9, -1.3], [4.25, TOP - 0.1, 1.3], MAT.PANE);
    });

    // Trolley, hoist rope and hook block. The rope is two thin bars rather than
    // a cylinder: at any distance this is drawn from, a line is a line.
    const TX = JIB * 0.62;
    const HOOK = 14 + (lod === 0 ? 0 : 2);
    m.painted(TINT.NONE, () => {
      m.box([TX - 0.75, TOP + 1.0, -0.7], [TX + 0.75, TOP + 1.7, 0.7], MAT.METAL);
      for (const oz of [-0.2, 0.2]) {
        m.box([TX - 0.05, TOP + 1.7 - HOOK, oz - 0.05],
          [TX + 0.05, TOP + 1.0, oz + 0.05], MAT.TRIM);
      }
      m.box([TX - 0.55, TOP + 1.7 - HOOK, -0.45], [TX + 0.55, TOP + 2.5 - HOOK, 0.45],
        MAT.METAL);
      if (lod < 1) {
        // The load on the hook: a pallet of blocks, because an empty hook looks
        // like a crane that has been left for the weekend.
        m.box([TX - 1.5, TOP + 0.7 - HOOK, -1.1], [TX + 1.5, TOP + 1.7 - HOOK, 1.1],
          MAT.CONCRETE);
      }
    });
  });
  return m;
}

/**
 * The structure going up: three storeys of frame with the top one unfinished.
 *
 * Deliberately generic -- it stands in for a house, a shop and an office block
 * alike, and a frame is what all three look like at this stage. Kept inside a
 * twenty-six metre square so it sits within any released patch.
 */
function frame(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const R = 11;                 // half the plan
  const FLOORS = 3;
  const H = 3.6;
  const cols = 4;
  m.painted(TINT.NONE, () => {
    // Slabs, the top one only half poured.
    for (let f = 0; f <= FLOORS; f++) {
      const y = 0.5 + f * H;
      const part = f === FLOORS;
      const x1 = part ? 0.1 : R;
      if (f > 0) m.box([-R, y - 0.32, -R], [x1, y, R], MAT.CONCRETE);
      if (part && lod < 1) {
        // Formwork and props holding up the pour that has not happened yet.
        m.painted(TINT.WOOD, () => {
          m.box([0.1, y - 0.36, -R], [R * 0.55, y - 0.2, R], MAT.TRIM);
        });
        m.painted(TINT.METAL_DARK, () => {
          for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
              const px = 1.5 + (R * 0.5 * i) / 3, pz = -R + 1.5 + ((R * 2 - 3) * j) / 3;
              m.box([px - 0.07, y - H, pz - 0.07], [px + 0.07, y - 0.36, pz + 0.07],
                MAT.TRIM);
            }
          }
        });
      }
    }
    // Columns, and the ones on the top lift carrying starter bars.
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < cols; j++) {
        const x = -R + 0.9 + ((R * 2 - 1.8) * i) / (cols - 1);
        const z = -R + 0.9 + ((R * 2 - 1.8) * j) / (cols - 1);
        m.box([x - 0.42, 0, z - 0.42], [x + 0.42, 0.5 + FLOORS * H + 0.6, z + 0.42],
          MAT.CONCRETE);
        if (lod < 1) {
          m.painted(TINT.METAL_DARK, () => {
            for (const [ox, oz] of [[-0.26, -0.26], [0.26, -0.26], [-0.26, 0.26], [0.26, 0.26]]) {
              m.box([x + ox - 0.035, 0.5 + FLOORS * H + 0.6, z + oz - 0.035],
                [x + ox + 0.035, 0.5 + FLOORS * H + 1.8, z + oz + 0.035], MAT.TRIM);
            }
          });
        }
      }
    }
    // The core: the one part of a frame that is walls, and the first thing up.
    m.box([-3.2, 0, -R + 0.6], [3.2, 0.5 + FLOORS * H + 1.6, -R + 6.2], MAT.CONCRETE);
  });

  // Scaffold on the two visible faces, with boards on every lift.
  if (lod < 2) {
    m.painted(TINT.METAL_DARK, () => {
      const lifts = FLOORS + 1;
      const std = lod < 1 ? 2.2 : 4.4;
      const run = (ax: number, az: number, bx: number, bz: number): void => {
        const len = Math.hypot(bx - ax, bz - az);
        const n = Math.max(2, Math.round(len / std));
        const ux = (bx - ax) / n, uz = (bz - az) / n;
        const nx = -uz / Math.hypot(ux, uz), nz = ux / Math.hypot(ux, uz);
        for (let i = 0; i <= n; i++) {
          const px = ax + ux * i, pz = az + uz * i;
          for (const off of [0, 1.1]) {
            m.box([px + nx * off - 0.055, 0, pz + nz * off - 0.055],
              [px + nx * off + 0.055, 0.5 + lifts * H, pz + nz * off + 0.055], MAT.TRIM);
          }
        }
        for (let l = 1; l <= lifts; l++) {
          const y = 0.4 + l * H - 0.4;
          const cx0 = Math.min(ax, bx), cx1 = Math.max(ax, bx);
          const cz0 = Math.min(az, bz), cz1 = Math.max(az, bz);
          for (const off of [0, 1.1]) {
            m.box([cx0 + nx * off - 0.05, y, cz0 + nz * off - 0.05],
              [cx1 + nx * off + 0.05, y + 0.09, cz1 + nz * off + 0.05], MAT.TRIM);
          }
          m.painted(TINT.WOOD, () => {
            m.box([cx0 + Math.min(0, nx * 1.1), y + 0.09, cz0 + Math.min(0, nz * 1.1)],
              [cx1 + Math.max(0, nx * 1.1), y + 0.14, cz1 + Math.max(0, nz * 1.1)],
              MAT.TRIM);
          });
        }
      };
      run(-R - 1.2, R + 1.2, R + 1.2, R + 1.2);
      run(R + 1.2, R + 1.2, R + 1.2, -R - 1.2);
    });
  }
  return m;
}

export const CONSTRUCTION: AssetDef[] = [
  {
    id: 'site.pad', name: 'Building site', zone: 'fleet', density: 'none',
    variant: 'sculpted', footprint: [5, 5], height: 5.8, sim: free, brand: SITE,
    note: 'A cleared and hoarded plot with the excavation open. Drawn on every '
      + 'patch of land the city has released and not yet finished building on.',
    build: pad,
  },
  {
    id: 'site.frame', name: 'Frame under construction', zone: 'fleet',
    density: 'none', variant: 'sculpted', footprint: [4, 4], height: 14.4,
    sim: free, brand: SITE,
    note: 'Columns, slabs and scaffold. Appears partway through a plot\'s build '
      + 'so the ground visibly becomes a building.',
    build: frame,
  },
  {
    id: 'site.crane', name: 'Tower crane', zone: 'fleet', density: 'none',
    variant: 'sculpted', footprint: [8, 2], height: 47.5, sim: free, brand: SITE,
    note: 'Over a plot for as long as it is being built. Slewed to a different '
      + 'angle on every site so a district under construction is not a row of '
      + 'identical cranes.',
    build: crane,
  },
];

/** What the frame draws a site as, by seat. See `sim/agents/movers.ts`. */
export const SITE_IDS = {
  pad: 'site.pad',
  frame: 'site.frame',
  crane: 'site.crane',
} as const;

/**
 * How many the census reserves.
 *
 * A patch is released every few seconds and takes a few to build, so a city in
 * full flight has of the order of a hundred plots open at once. Cranes are
 * capped lower and drawn nearest-first: a crane is thirty-eight metres tall and
 * stays at full detail much further out than a pad does.
 */
export const SITE_RESERVE: Record<string, number> = {
  'site.pad': 140,
  'site.frame': 110,
  'site.crane': 64,
};
