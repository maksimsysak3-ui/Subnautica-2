/**
 * Roads and bridges.
 *
 * A city builder is mostly road by area, and road is where the rules live: how
 * many lanes, which way they run, where you may cross, where you may stop,
 * what happens at the junction. These are built as one-cell-deep sections that
 * tile end to end, so a street is the same asset repeated and a junction is
 * the piece that resolves four of them.
 *
 * Everything is drawn at real dimensions: a 3.2m lane, a 2.4m footway, a 125mm
 * kerb upstand, a 100mm line. Getting those right is most of why a street
 * reads as a street rather than as a grey ribbon -- the eye knows how wide a
 * car is, and everything else is measured against it.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import type { Vec3 } from '../mesh';
import { figure } from './vehicles';

// ------------------------------------------------------------- dimensions

/** One traffic lane. Narrower than this and a bus does not fit. */
const LANE = 3.2;
/** Footway either side. Two people pass on this and not on less. */
const WALK = 2.4;
/** Kerb upstand. 125mm is the standard, and it is visible at city zoom. */
const KERB = 0.125;
/** Carriageway thickness, so a road has an edge rather than being a decal. */
const DECK = 0.28;
/** A painted line. */
const LINE = 0.1;

/** A cell is 8m; a road asset is a whole number of them long. */
const CELL = 8;

// ------------------------------------------------------------------ pieces

/** Carriageway: a slab with a crown, so water runs off it and it has a top. */
function carriageway(m: MeshBuilder, halfW: number, z0: number, z1: number): void {
  // Crowned, not flat: 1 in 40 to each channel. It is 4cm over a two-lane
  // road, which is invisible on its own and is the difference between a
  // surface and a sheet of paper once the sun is on it.
  const crown = halfW / 40;
  m.box([-halfW, 0, z0], [halfW, DECK, z1], MAT.GROUND);
  m.quad([-halfW, DECK, z0], [0, DECK + crown, z0], [0, DECK + crown, z1], [-halfW, DECK, z1],
    MAT.GROUND);
  m.quad([0, DECK + crown, z0], [halfW, DECK, z0], [halfW, DECK, z1], [0, DECK + crown, z1],
    MAT.GROUND);
}

/** Kerb and footway on one side. `sx` is which side of the road. */
function footway(m: MeshBuilder, sx: 1 | -1, edge: number, z0: number, z1: number,
  width = WALK): void {
  const a = sx * edge, b = sx * (edge + width);
  // Kerb face, then the flag paving behind it, laid to falls towards the road.
  m.box([Math.min(a, sx * (edge + 0.15)), 0, z0],
        [Math.max(a, sx * (edge + 0.15)), DECK + KERB, z1], MAT.STONE);
  m.box([Math.min(sx * (edge + 0.15), b), 0, z0],
        [Math.max(sx * (edge + 0.15), b), DECK + KERB, z1], MAT.CONCRETE);
  // Paving joints, every 900mm along and once across.
  m.painted(TINT.METAL_DARK, () => {
    for (let z = z0 + 0.9; z < z1; z += 0.9) {
      m.box([Math.min(a, b), DECK + KERB, z - 0.02], [Math.max(a, b), DECK + KERB + 0.012, z + 0.02],
        MAT.TRIM);
    }
    const mid = sx * (edge + width * 0.55);
    m.box([Math.min(mid - 0.02, mid + 0.02), DECK + KERB, z0],
          [Math.max(mid - 0.02, mid + 0.02), DECK + KERB + 0.012, z1], MAT.TRIM);
  });
}

/** A painted line down the road: solid, or broken to a given cycle. */
function line(m: MeshBuilder, x: number, z0: number, z1: number,
  opts: { dash?: number; gap?: number; width?: number; tint?: number } = {}): void {
  const w = opts.width ?? LINE;
  const dash = opts.dash ?? 0;
  const gap = opts.gap ?? 0;
  const crown = 0.002;
  m.painted((opts.tint ?? TINT.SIGN_LIT) as never, () => {
    if (dash <= 0) {
      m.box([x - w / 2, DECK + crown, z0], [x + w / 2, DECK + crown + 0.006, z1], MAT.TRIM);
      return;
    }
    for (let z = z0; z < z1; z += dash + gap) {
      m.box([x - w / 2, DECK + crown, z], [x + w / 2, DECK + crown + 0.006,
        Math.min(z + dash, z1)], MAT.TRIM);
    }
  });
}

/** A transverse line, for stop lines and crossings. */
function crossLine(m: MeshBuilder, x0: number, x1: number, z: number, w = 0.3): void {
  m.painted(TINT.SIGN_LIT, () =>
    m.box([x0, DECK + 0.002, z - w / 2], [x1, DECK + 0.008, z + w / 2], MAT.TRIM));
}

/**
 * A street light: column, outreach arm and a lantern.
 *
 * Set behind the kerb, leaning over the carriageway, which is where they are
 * and is also what makes a road read as lit rather than as a strip of tarmac.
 */
function streetLight(m: MeshBuilder, sx: 1 | -1, x: number, z: number, h = 8.0): void {
  m.painted(TINT.METAL_DARK, () => {
    m.box([x - 0.28, DECK + KERB, z - 0.28], [x + 0.28, DECK + KERB + 0.18, z + 0.28], MAT.TRIM);
    m.cylinder(x, z, 0.1, DECK + KERB, h, 8, MAT.TRIM, false);
    // The outreach: a short horizontal arm leaning in over the kerb.
    const reach = 1.8;
    m.box([Math.min(x, x - sx * reach), h - 0.12, z - 0.08],
          [Math.max(x, x - sx * reach), h, z + 0.08], MAT.TRIM);
  });
  const lx = x - sx * 1.8;
  m.painted(TINT.METAL_DARK, () =>
    m.box([lx - 0.34, h - 0.24, z - 0.19], [lx + 0.34, h - 0.06, z + 0.19], MAT.TRIM));
  m.painted(TINT.SIGN_LIT, () =>
    m.box([lx - 0.3, h - 0.3, z - 0.15], [lx + 0.3, h - 0.22, z + 0.15], MAT.TRIM));
}

/** A traffic signal head on a pole, facing along -z. */
function signal(m: MeshBuilder, x: number, z: number, facing: 1 | -1, h = 3.6): void {
  m.painted(TINT.METAL_DARK, () => {
    m.box([x - 0.22, DECK + KERB, z - 0.22], [x + 0.22, DECK + KERB + 0.14, z + 0.22], MAT.TRIM);
    m.cylinder(x, z, 0.075, DECK + KERB, h, 8, MAT.TRIM, false);
    m.box([x - 0.2, h - 1.0, z - 0.16], [x + 0.2, h, z + 0.16], MAT.TRIM);
    // Hood over each aspect: without it a signal is a domino.
    for (let i = 0; i < 3; i++) {
      const y = h - 0.85 + i * 0.3;
      m.box([x - 0.22, y + 0.16, Math.min(z + facing * 0.16, z + facing * 0.32)],
            [x + 0.22, y + 0.22, Math.max(z + facing * 0.16, z + facing * 0.32)], MAT.TRIM);
    }
  });
  // Red, amber, green, in that order down the head.
  const lens = [TINT.BRAND, TINT.ACCENT, TINT.GREEN];
  for (let i = 0; i < 3; i++) {
    const y = h - 0.85 + (2 - i) * 0.3;
    m.painted(lens[i] as never, () =>
      m.box([x - 0.11, y, Math.min(z + facing * 0.16, z + facing * 0.2)],
            [x + 0.11, y + 0.22, Math.max(z + facing * 0.16, z + facing * 0.2)], MAT.TRIM));
  }
}

/** Gully, cover and a bollard: the small ironwork every street has. */
function ironwork(m: MeshBuilder, x: number, z: number, kind: 'gully' | 'cover'): void {
  m.painted(TINT.METAL_DARK, () => {
    if (kind === 'gully') {
      m.box([x - 0.24, DECK - 0.004, z - 0.2], [x + 0.24, DECK + 0.01, z + 0.2], MAT.TRIM);
      for (let i = 0; i < 5; i++) {
        m.box([x - 0.22 + i * 0.09, DECK + 0.01, z - 0.18], [x - 0.18 + i * 0.09, DECK + 0.02, z + 0.18],
          MAT.TRIM);
      }
    } else {
      m.box([x - 0.32, DECK - 0.004, z - 0.32], [x + 0.32, DECK + 0.012, z + 0.32], MAT.TRIM);
      m.box([x - 0.26, DECK + 0.012, z - 0.26], [x + 0.26, DECK + 0.02, z + 0.26], MAT.TRIM);
    }
  });
}

/** A road sign on a post: a plate at 2.1m, which is where they are. */
function sign(m: MeshBuilder, x: number, z: number, w: number, h: number, tint: number): void {
  m.painted(TINT.METAL_DARK, () =>
    m.cylinder(x, z, 0.05, DECK + KERB, DECK + KERB + 2.1 + h, 6, MAT.TRIM, false));
  m.painted(tint as never, () =>
    m.box([x - w / 2, DECK + KERB + 2.1, z - 0.03], [x + w / 2, DECK + KERB + 2.1 + h, z + 0.03],
      MAT.TRIM));
}

/** Verge planting between the kerb and the boundary. */
function verge(m: MeshBuilder, sx: 1 | -1, x0: number, x1: number, z0: number, z1: number): void {
  m.painted(TINT.GREEN, () =>
    m.box([Math.min(sx * x0, sx * x1), DECK + KERB - 0.02, z0],
          [Math.max(sx * x0, sx * x1), DECK + KERB + 0.08, z1], MAT.TRIM));
}

// ------------------------------------------------------------------ roads

/** Two-lane residential street: one lane each way, parking, footways. */
function street(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const z0 = -CELL * 2, z1 = CELL * 2;
  const half = LANE + 2.0;                       // two lanes plus a parking strip

  carriageway(m, half, z0, z1);
  for (const sx of [1, -1] as const) footway(m, sx, half, z0, z1);

  if (medium) {
    // Centre line, broken; edge lines solid; parking bays marked out.
    line(m, 0, z0, z1, { dash: 2.0, gap: 4.0 });
    for (const sx of [1, -1] as const) {
      line(m, sx * (half - 2.0), z0, z1, { width: 0.08 });
    }
    for (const sx of [1, -1] as const) {
      for (let z = z0 + 1.0; z < z1 - 5.0; z += 5.4) {
        crossLine(m, Math.min(sx * (half - 2.0), sx * half), Math.max(sx * (half - 2.0), sx * half),
          z, 0.08);
      }
    }
  }
  if (fine) {
    for (const sx of [1, -1] as const) {
      streetLight(m, sx, sx * (half + 0.8), sx > 0 ? -6.0 : 10.0, 7.0);
      ironwork(m, sx * (half - 0.35), sx > 0 ? -12.0 : 4.0, 'gully');
      ironwork(m, sx * (half - 2.4), sx > 0 ? 8.0 : -8.0, 'cover');
      verge(m, sx, half + 1.6, half + 2.4, z0, z1);
    }
    // Cars parked in the bays, and someone crossing between them.
    figure(m, 5140, 0.4, 7.0, Math.PI / 2, { stride: 0.16 });
    figure(m, 5147, half + 1.4, -1.0, Math.PI, { bag: true });
  }
  return m;
}

/** Four-lane avenue with a planted central reservation. */
function avenue(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const z0 = -CELL * 2, z1 = CELL * 2;
  const median = 3.0;
  const half = median / 2 + LANE * 2;

  // Two carriageways with a raised reservation between them.
  for (const sx of [1, -1] as const) {
    m.box([Math.min(sx * (median / 2), sx * half), 0, z0],
          [Math.max(sx * (median / 2), sx * half), DECK, z1], MAT.GROUND);
  }
  m.box([-median / 2, 0, z0], [median / 2, DECK + KERB, z1], MAT.STONE);
  m.box([-median / 2 + 0.2, DECK + KERB - 0.02, z0], [median / 2 - 0.2, DECK + KERB + 0.06, z1],
    MAT.CONCRETE);
  for (const sx of [1, -1] as const) footway(m, sx, half, z0, z1, 3.0);

  if (medium) {
    m.painted(TINT.GREEN, () =>
      m.box([-median / 2 + 0.3, DECK + KERB + 0.04, z0], [median / 2 - 0.3, DECK + KERB + 0.16, z1],
        MAT.TRIM));
    for (const sx of [1, -1] as const) {
      // Lane divider between the two lanes of each carriageway.
      line(m, sx * (median / 2 + LANE), z0, z1, { dash: 3.0, gap: 3.0 });
      line(m, sx * (half - 0.35), z0, z1, { width: 0.1 });
    }
  }
  if (fine) {
    // Lighting off the central reservation, both ways: what an avenue does.
    for (let z = z0 + 6.0; z < z1; z += 14.0) {
      m.painted(TINT.METAL_DARK, () => {
        m.box([-0.3, DECK + KERB, z - 0.3], [0.3, DECK + KERB + 0.2, z + 0.3], MAT.TRIM);
        m.cylinder(0, z, 0.12, DECK + KERB, 9.5, 8, MAT.TRIM, false);
        for (const sx of [1, -1] as const) {
          m.box([Math.min(0, sx * 2.0), 9.35, z - 0.08], [Math.max(0, sx * 2.0), 9.5, z + 0.08],
            MAT.TRIM);
          m.box([sx * 2.0 - 0.34, 9.2, z - 0.19], [sx * 2.0 + 0.34, 9.38, z + 0.19], MAT.TRIM);
        }
      });
      m.painted(TINT.SIGN_LIT, () => {
        for (const sx of [1, -1] as const) {
          m.box([sx * 2.0 - 0.3, 9.14, z - 0.15], [sx * 2.0 + 0.3, 9.22, z + 0.15], MAT.TRIM);
        }
      });
    }
    // Trees down the reservation are placed in game, so this gets shrubs only.
    m.painted(TINT.GREEN, () => {
      for (let z = z0 + 2.0; z < z1; z += 3.5) {
        m.box([-1.0, DECK + KERB + 0.16, z], [1.0, DECK + KERB + 0.85, z + 1.8], MAT.TRIM);
      }
    });
    for (const sx of [1, -1] as const) {
      for (const z of [-10.0, 6.0]) ironwork(m, sx * (half - 0.5), z, 'gully');
      sign(m, sx * (half + 1.2), sx > 0 ? -14.0 : 12.0, 0.7, 0.7, TINT.BRAND);
    }
  }
  return m;
}

/** Signalised crossroads: stop lines, crossings, signals on all four arms. */
function crossroads(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const arm = CELL * 2;
  const half = LANE + 2.0;

  // Four arms and the box in the middle, all one surface.
  m.box([-half, 0, -arm], [half, DECK, arm], MAT.GROUND);
  m.box([-arm, 0, -half], [arm, DECK, half], MAT.GROUND);
  // Corner footways, radiused by a chamfer rather than an arc.
  for (const sx of [1, -1] as const) {
    for (const sz of [1, -1] as const) {
      const a = sx * half, b = sx * arm, c = sz * half, d = sz * arm;
      m.box([Math.min(a, b), 0, Math.min(c, d)], [Math.max(a, b), DECK + KERB, Math.max(c, d)],
        MAT.CONCRETE);
      // Kerb line along both edges of the corner.
      m.box([Math.min(a, b), 0, Math.min(c, sz * (half + 0.15))],
            [Math.max(a, b), DECK + KERB + 0.005, Math.max(c, sz * (half + 0.15))], MAT.STONE);
      m.box([Math.min(a, sx * (half + 0.15)), 0, Math.min(c, d)],
            [Math.max(a, sx * (half + 0.15)), DECK + KERB + 0.005, Math.max(c, d)], MAT.STONE);
    }
  }

  if (medium) {
    // Stop lines on every arm, set back from the junction box.
    for (const sz of [1, -1] as const) {
      crossLine(m, sz > 0 ? -half : 0, sz > 0 ? 0 : half, sz * (half + 3.2), 0.4);
    }
    for (const sx of [1, -1] as const) {
      m.painted(TINT.SIGN_LIT, () =>
        m.box([sx * (half + 3.0), DECK + 0.002, sx > 0 ? 0 : -half],
              [sx * (half + 3.4), DECK + 0.008, sx > 0 ? half : 0], MAT.TRIM));
    }
    // Zebra crossings on all four arms.
    for (const sz of [1, -1] as const) {
      for (let i = 0; i < 7; i++) {
        const x = -half + 0.6 + i * ((2 * half - 1.2) / 7);
        m.painted(TINT.SIGN_LIT, () =>
          m.box([x, DECK + 0.002, sz * (half + 0.6)], [x + 0.5, DECK + 0.009, sz * (half + 2.4)],
            MAT.TRIM));
      }
    }
    for (const sx of [1, -1] as const) {
      for (let i = 0; i < 7; i++) {
        const z = -half + 0.6 + i * ((2 * half - 1.2) / 7);
        m.painted(TINT.SIGN_LIT, () =>
          m.box([sx * (half + 0.6), DECK + 0.002, z], [sx * (half + 2.4), DECK + 0.009, z + 0.5],
            MAT.TRIM));
      }
    }
    // Centre lines up each approach, stopping at the stop line.
    for (const sz of [1, -1] as const) line(m, 0, sz * (half + 3.4), sz * arm, { dash: 2.0, gap: 4.0 });
  }
  if (fine) {
    // A signal on the near-side corner of each approach, plus a duplicate
    // opposite: which is how a real junction is actually equipped.
    for (const sx of [1, -1] as const) {
      for (const sz of [1, -1] as const) {
        signal(m, sx * (half + 0.7), sz * (half + 0.7), (sz > 0 ? 1 : -1) as 1 | -1);
      }
    }
    for (const sx of [1, -1] as const) {
      for (const sz of [1, -1] as const) {
        streetLight(m, sx, sx * (half + 3.4), sz * (half + 3.4), 7.5);
        ironwork(m, sx * (half - 0.4), sz * (half + 1.0), 'gully');
      }
    }
    // Direction sign on one corner, and a box junction in the middle.
    sign(m, half + 2.0, -(half + 2.0), 1.6, 0.5, TINT.BRAND);
    m.painted(TINT.ACCENT, () => {
      for (let i = 0; i <= 6; i++) {
        const t = -half + (i / 6) * 2 * half;
        m.box([t - 0.05, DECK + 0.003, -half], [t + 0.05, DECK + 0.009, half], MAT.TRIM);
        m.box([-half, DECK + 0.003, t - 0.05], [half, DECK + 0.009, t + 0.05], MAT.TRIM);
      }
    });
    figure(m, 5320, -half - 1.4, half + 1.4, 0, { stride: 0.14 });
    figure(m, 5327, half + 1.5, -half - 1.5, Math.PI, { bag: true });
  }
  return m;
}

/** Roundabout: a circulatory carriageway round a domed island. */
function roundabout(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const island = 6.0;
  const outer = island + LANE * 2 + 0.6;
  const arm = CELL * 2;
  const half = LANE + 1.0;

  // Four approach arms, then the circulatory area over the top of them.
  m.box([-half, 0, -arm], [half, DECK, arm], MAT.GROUND);
  m.box([-arm, 0, -half], [arm, DECK, half], MAT.GROUND);
  m.cylinder(0, 0, outer, 0, DECK, 28, MAT.GROUND, true);
  // The island: kerbed, domed and planted.
  m.cylinder(0, 0, island, DECK, DECK + KERB, 24, MAT.STONE, true);
  m.cone(0, 0, island - 0.3, island * 0.55, DECK + KERB, DECK + KERB + 0.9, 24, MAT.GROUND);
  m.painted(TINT.GREEN, () =>
    m.cone(0, 0, island - 0.5, island * 0.5, DECK + KERB + 0.05, DECK + KERB + 1.0, 24, MAT.TRIM));

  if (medium) {
    // Lane divider round the circulatory, and give-way lines on each arm.
    m.painted(TINT.SIGN_LIT, () => {
      for (let i = 0; i < 48; i++) {
        if (i % 2 === 1) continue;
        const a0 = (i / 48) * Math.PI * 2, a1 = ((i + 1) / 48) * Math.PI * 2;
        const r = island + LANE;
        const p = (a: number, rr: number): Vec3 => [Math.cos(a) * rr, DECK + 0.004, Math.sin(a) * rr];
        m.quad(p(a0, r - 0.05), p(a1, r - 0.05), p(a1, r + 0.05), p(a0, r + 0.05), MAT.TRIM);
      }
    });
    for (const sz of [1, -1] as const) {
      for (let i = 0; i < 5; i++) {
        const x = -half + 0.5 + i * ((2 * half - 1.0) / 5);
        m.painted(TINT.SIGN_LIT, () =>
          m.box([x, DECK + 0.002, sz * (outer + 0.3)], [x + 0.4, DECK + 0.008, sz * (outer + 0.9)],
            MAT.TRIM));
      }
    }
    for (const sx of [1, -1] as const) {
      for (let i = 0; i < 5; i++) {
        const z = -half + 0.5 + i * ((2 * half - 1.0) / 5);
        m.painted(TINT.SIGN_LIT, () =>
          m.box([sx * (outer + 0.3), DECK + 0.002, z], [sx * (outer + 0.9), DECK + 0.008, z + 0.4],
            MAT.TRIM));
      }
    }
  }
  if (fine) {
    // Chevron boards facing each arm: the sign that says which way round.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const cx = Math.cos(a) * (island - 1.2), cz = Math.sin(a) * (island - 1.2);
      m.painted(TINT.METAL_DARK, () => {
        for (const d of [-0.8, 0.8]) {
          m.cylinder(cx + Math.cos(a + 1.57) * d, cz + Math.sin(a + 1.57) * d, 0.05,
            DECK + KERB, DECK + KERB + 1.6, 6, MAT.TRIM, false);
        }
      });
      m.painted(TINT.BRAND, () =>
        m.box([cx - 1.0, DECK + KERB + 0.9, cz - 0.06], [cx + 1.0, DECK + KERB + 1.6, cz + 0.06],
          MAT.TRIM));
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      streetLight(m, 1, Math.cos(a) * (outer + 1.6), Math.sin(a) * (outer + 1.6), 8.0);
    }
    // Traffic going round it, so the geometry has something to explain.
    figure(m, 5440, -(outer + 1.4), 2.0, 0, { stride: 0.12 });
  }
  return m;
}

/**
 * A rectangular strut between two points in the XY plane.
 *
 * Needed because an axis-aligned box cannot lean. Building the pylon legs as
 * boxes spanning min-to-max of their two ends gave a solid wedge nine metres
 * wide -- the whole bridge disappeared inside it.
 */
function strut(m: MeshBuilder, a: [number, number], b: [number, number],
  hx: number, hz: number, mat = MAT.CONCRETE): void {
  const corners = (p: [number, number]): Vec3[] => [
    [p[0] - hx, p[1], -hz], [p[0] + hx, p[1], -hz],
    [p[0] + hx, p[1], hz], [p[0] - hx, p[1], hz],
  ];
  const A = corners(a), B = corners(b);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    m.quad(A[i], A[j], B[j], B[i], mat);
  }
  m.quad(B[0], B[1], B[2], B[3], mat);
  m.quad(A[3], A[2], A[1], A[0], mat);
}

// ---------------------------------------------------------------- bridges

/**
 * Beam bridge: a deck on piers, with parapets and a lit footway.
 *
 * Built as the middle span of a longer crossing, so it tiles: piers at both
 * ends, deck between, and the abutments belong to the piece either side.
 */
function beamBridge(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const z0 = -CELL * 2, z1 = CELL * 2;
  const half = LANE + 2.0;
  const rise = 7.0;

  // Deck: a slab on two edge beams, with the road surface over it.
  m.box([-half - WALK, rise, z0], [half + WALK, rise + 0.9, z1], MAT.CONCRETE);
  m.box([-half - WALK - 0.35, rise + 0.55, z0], [half + WALK + 0.35, rise + 0.9, z1], MAT.CONCRETE);
  m.box([-half, rise + 0.9, z0], [half, rise + 0.9 + DECK, z1], MAT.GROUND);
  for (const sx of [1, -1] as const) {
    m.box([Math.min(sx * half, sx * (half + WALK)), rise + 0.9,
           z0], [Math.max(sx * half, sx * (half + WALK)), rise + 0.9 + DECK + KERB, z1],
      MAT.CONCRETE);
  }

  if (medium) {
    // Piers: tapered stems on a pile cap, one pair at each end of the span.
    for (const pz of [z0 + 2.0, z1 - 2.0]) {
      m.box([-half - 1.0, 0, pz - 1.6], [half + 1.0, 0.9, pz + 1.6], MAT.CONCRETE);
      for (const sx of [1, -1] as const) {
        m.box([sx * 4.2 - 0.9, 0.9, pz - 1.0], [sx * 4.2 + 0.9, rise - 0.6, pz + 1.0], MAT.CONCRETE);
      }
      // Pier cap spreading under the deck.
      m.box([-half - 0.6, rise - 0.6, pz - 1.3], [half + 0.6, rise, pz + 1.3], MAT.CONCRETE);
    }
    // Parapets: a solid upstand with a rail over it.
    for (const sx of [1, -1] as const) {
      const e = sx * (half + WALK);
      m.box([Math.min(e, sx * (half + WALK - 0.4)), rise + 0.9 + DECK,
             z0], [Math.max(e, sx * (half + WALK - 0.4)), rise + 2.05, z1], MAT.CONCRETE);
      m.painted(TINT.METAL_DARK, () => {
        m.box([Math.min(e + sx * 0.05, sx * (half + WALK - 0.45)), rise + 2.05, z0],
              [Math.max(e + sx * 0.05, sx * (half + WALK - 0.45)), rise + 2.2, z1], MAT.TRIM);
      });
    }
  }
  if (fine) {
    line(m, 0, z0, z1, { dash: 2.0, gap: 4.0 });
    for (const sx of [1, -1] as const) {
      line(m, sx * (half - 0.3), z0, z1, { width: 0.1 });
      // Lighting off the parapet, and drainage scuppers through it.
      for (let z = z0 + 5.0; z < z1; z += 11.0) {
        m.painted(TINT.METAL_DARK, () => {
          m.cylinder(sx * (half + WALK - 0.2), z, 0.09, rise + 2.2, rise + 6.4, 8, MAT.TRIM, false);
          m.box([Math.min(sx * (half + WALK - 0.2), sx * (half + WALK - 1.6)), rise + 6.25, z - 0.07],
                [Math.max(sx * (half + WALK - 0.2), sx * (half + WALK - 1.6)), rise + 6.4, z + 0.07],
            MAT.TRIM);
        });
        m.painted(TINT.SIGN_LIT, () =>
          m.box([sx * (half + WALK - 1.6) - 0.26, rise + 6.02, z - 0.14],
                [sx * (half + WALK - 1.6) + 0.26, rise + 6.12, z + 0.14], MAT.TRIM));
      }
      for (let z = z0 + 3.0; z < z1; z += 7.0) {
        m.painted(TINT.METAL_DARK, () =>
          m.cylinder(sx * (half + WALK + 0.1), z, 0.08, rise + 0.2, rise + 0.9, 6, MAT.TRIM, false));
      }
      // Paving joints across the bridge footway.
      m.painted(TINT.METAL_DARK, () => {
        for (let z = z0 + 1.2; z < z1; z += 1.2) {
          m.box([Math.min(sx * half, sx * (half + WALK)), rise + 0.9 + DECK + KERB, z - 0.02],
                [Math.max(sx * half, sx * (half + WALK)), rise + 0.9 + DECK + KERB + 0.012, z + 0.02],
            MAT.TRIM);
        }
      });
    }
    figure(m, 5526, half + 1.2, 2.0, 0, { stride: 0.15, bag: true });
    figure(m, 5533, -(half + 1.2), -4.0, Math.PI, { hat: true });
  }
  return m;
}

/** Cable-stayed bridge: one pylon, a fan of stays, the deck hung off them. */
function cableBridge(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const z0 = -CELL * 3, z1 = CELL * 3;
  const half = LANE + 2.0;
  const rise = 8.0;
  const pylon = 34.0;

  m.box([-half - WALK, rise, z0], [half + WALK, rise + 1.0, z1], MAT.CONCRETE);
  m.box([-half, rise + 1.0, z0], [half, rise + 1.0 + DECK, z1], MAT.GROUND);
  for (const sx of [1, -1] as const) {
    m.box([Math.min(sx * half, sx * (half + WALK)), rise + 1.0, z0],
          [Math.max(sx * half, sx * (half + WALK)), rise + 1.0 + DECK + KERB, z1], MAT.CONCRETE);
  }
  // The pylon: two legs meeting above the deck in an A, which is what makes
  // the stays converge instead of running parallel.
  for (const sx of [1, -1] as const) {
    m.box([sx * (half + WALK + 1.4) - 1.1, 0, -2.0], [sx * (half + WALK + 1.4) + 1.1, rise + 6.0, 2.0],
      MAT.CONCRETE);
    for (let i = 0; i < 8; i++) {
      const t0 = i / 8, t1 = (i + 1) / 8;
      const y0 = rise + 6.0 + t0 * (pylon - rise - 6.0);
      const y1 = rise + 6.0 + t1 * (pylon - rise - 6.0);
      const x0 = sx * (half + WALK + 1.4) * (1 - t0 * 0.86);
      const x1 = sx * (half + WALK + 1.4) * (1 - t1 * 0.86);
      strut(m, [x0, y0], [x1, y1], 0.85 - t0 * 0.2, 1.7 - t0 * 0.4);
    }
  }
  m.box([-2.4, pylon, -1.7], [2.4, pylon + 3.2, 1.7], MAT.CONCRETE);

  if (medium) {
    // Stays: a fan each way, anchored down the deck edges.
    m.painted(TINT.METAL_DARK, () => {
      for (const sz of [1, -1] as const) {
        for (let i = 1; i <= 6; i++) {
          const dz = sz * (2.5 + i * 3.6);
          const top = pylon + 2.6 - i * 0.34;
          for (const sx of [1, -1] as const) {
            m.pipe([sx * 1.4, top, 0], [sx * (half + WALK - 0.4), rise + 1.2, dz], 0.09, MAT.METAL);
          }
        }
      }
    });
    for (const sx of [1, -1] as const) {
      const e = sx * (half + WALK);
      m.box([Math.min(e, sx * (half + WALK - 0.4)), rise + 1.0 + DECK, z0],
            [Math.max(e, sx * (half + WALK - 0.4)), rise + 2.15, z1], MAT.CONCRETE);
      m.painted(TINT.METAL_DARK, () =>
        m.box([Math.min(e + sx * 0.05, sx * (half + WALK - 0.45)), rise + 2.15, z0],
              [Math.max(e + sx * 0.05, sx * (half + WALK - 0.45)), rise + 2.3, z1], MAT.TRIM));
    }
    // Piers under the deck, away from the pylon.
    for (const pz of [z0 + 2.0, z1 - 2.0]) {
      for (const sx of [1, -1] as const) {
        m.box([sx * 4.2 - 0.9, 0, pz - 1.0], [sx * 4.2 + 0.9, rise, pz + 1.0], MAT.CONCRETE);
      }
    }
  }
  if (fine) {
    line(m, 0, z0, z1, { width: 0.12 });
    line(m, 0.28, z0, z1, { width: 0.12 });
    for (const sx of [1, -1] as const) {
      line(m, sx * (half - 0.3), z0, z1, { width: 0.1 });
      for (let z = z0 + 6.0; z < z1; z += 12.0) {
        m.painted(TINT.METAL_DARK, () =>
          m.cylinder(sx * (half + WALK - 0.2), z, 0.09, rise + 2.3, rise + 6.6, 8, MAT.TRIM, false));
        m.painted(TINT.SIGN_LIT, () =>
          m.box([sx * (half + WALK - 0.2) - 0.28, rise + 6.4, z - 0.15],
                [sx * (half + WALK - 0.2) + 0.28, rise + 6.55, z + 0.15], MAT.TRIM));
      }
    }
    // Aircraft warning light on the pylon head.
    m.painted(TINT.BRAND, () =>
      m.box([-0.4, pylon + 3.2, -0.4], [0.4, pylon + 3.6, 0.4], MAT.TRIM));
    figure(m, 5640, half + 1.2, -12.0, 0, { stride: 0.14 });
  }
  return m;
}

/** Pedestrian footbridge: a ramped deck over the road on slender piers. */
function footbridge(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const span = CELL * 2;
  const rise = 5.6;
  const w = 2.6;

  // The road it crosses, so the clearance means something.
  m.box([-span, 0, -8.0], [span, DECK, 8.0], MAT.GROUND);
  line(m, 0, -8.0, 8.0, { dash: 2.0, gap: 4.0 });
  // Deck: level over the road, ramping down at both ends.
  m.box([-6.0, rise, -w / 2], [6.0, rise + 0.32, w / 2], MAT.CONCRETE);
  for (const sx of [1, -1] as const) {
    for (let i = 0; i < 6; i++) {
      const t0 = i / 6, t1 = (i + 1) / 6;
      const x0 = sx * (6.0 + t0 * (span - 6.0)), x1 = sx * (6.0 + t1 * (span - 6.0));
      const y0 = rise - t0 * (rise - DECK - 0.4), y1 = rise - t1 * (rise - DECK - 0.4);
      m.quad([x0, y0, -w / 2], [x1, y1, -w / 2], [x1, y1, w / 2], [x0, y0, w / 2], MAT.CONCRETE);
      m.quad([x0, y0 - 0.32, w / 2], [x1, y1 - 0.32, w / 2], [x1, y1 - 0.32, -w / 2],
        [x0, y0 - 0.32, -w / 2], MAT.CONCRETE);
    }
  }

  if (medium) {
    // Piers: a pair either side of the carriageway, and one under each ramp.
    for (const sx of [1, -1] as const) {
      m.box([sx * 6.0 - 0.5, 0, -0.5], [sx * 6.0 + 0.5, rise, 0.5], MAT.CONCRETE);
      m.box([sx * (span - 2.0) - 0.4, 0, -0.4], [sx * (span - 2.0) + 0.4, DECK + 1.2, 0.4],
        MAT.CONCRETE);
    }
    // Balustrades: posts and two rails, all the way along both sides.
    m.painted(TINT.METAL_DARK, () => {
      for (const sz of [1, -1] as const) {
        for (let i = 0; i <= 26; i++) {
          const t = i / 26;
          const x = -span + t * 2 * span;
          const ax = Math.abs(x);
          const y = ax <= 6.0 ? rise : rise - ((ax - 6.0) / (span - 6.0)) * (rise - DECK - 0.4);
          m.box([x - 0.05, y + 0.32, sz * (w / 2) - 0.05], [x + 0.05, y + 1.42, sz * (w / 2) + 0.05],
            MAT.TRIM);
        }
      }
    });
  }
  if (fine) {
    m.painted(TINT.METAL_DARK, () => {
      for (const sz of [1, -1] as const) {
        for (const yOff of [1.32, 0.72]) {
          for (let i = 0; i < 26; i++) {
            const t0 = i / 26, t1 = (i + 1) / 26;
            const x0 = -span + t0 * 2 * span, x1 = -span + t1 * 2 * span;
            const yf = (x: number): number => {
              const ax = Math.abs(x);
              return (ax <= 6.0 ? rise : rise - ((ax - 6.0) / (span - 6.0)) * (rise - DECK - 0.4))
                + 0.32 + yOff;
            };
            m.quad([x0, yf(x0), sz * (w / 2) - 0.03], [x1, yf(x1), sz * (w / 2) - 0.03],
                   [x1, yf(x1) + 0.08, sz * (w / 2) - 0.03], [x0, yf(x0) + 0.08, sz * (w / 2) - 0.03],
              MAT.TRIM);
          }
        }
      }
      // Lights along one side, and an anti-throw screen over the road.
      for (const x of [-4.0, 0.0, 4.0]) {
        m.cylinder(x, w / 2 - 0.1, 0.06, rise + 1.74, rise + 3.4, 6, MAT.TRIM, false);
      }
      for (let i = 0; i <= 14; i++) {
        const x = -6.0 + i * (12.0 / 14);
        for (const sz of [1, -1] as const) {
          m.box([x - 0.03, rise + 1.42, sz * (w / 2) - 0.03], [x + 0.03, rise + 3.0, sz * (w / 2) + 0.03],
            MAT.TRIM);
        }
      }
    });
    m.painted(TINT.SIGN_LIT, () => {
      for (const x of [-4.0, 0.0, 4.0]) {
        m.box([x - 0.22, rise + 3.4, w / 2 - 0.24], [x + 0.22, rise + 3.52, w / 2 + 0.04], MAT.TRIM);
      }
    });
    figure(m, 5701, -2.0, 0.0, 0, { stride: 0.16, bag: true });
    figure(m, 5717, 3.0, 0.5, Math.PI, { stride: 0.12 });
  }
  return m;
}

// ===================================================================== table

// ============================================================ more roads
//
// The first seven covered a street, an avenue, two junctions and three
// bridges. A city is mostly the things between those: a lane, a one-way, a
// bus lane, a cycle track, an alley, a car park, and the whole motorway
// vocabulary. Each of these is a piece of network rather than a picture --
// the lane widths, kerb heights and marking sizes are the same numbers
// throughout, so any two of them can sit end to end.

/** A steel safety barrier: posts and a corrugated beam. */
function barrier(m: MeshBuilder, x: number, z0: number, z1: number, sx: 1 | -1 = 1): void {
  m.painted(TINT.METAL_DARK, () => {
    for (let z = z0; z <= z1; z += 3.2) {
      m.box([x - 0.06, DECK, z - 0.06], [x + 0.06, DECK + 0.72, z + 0.06], MAT.TRIM);
    }
    // The beam, standing off the posts on the traffic side.
    const a = x + sx * 0.06, b = x + sx * 0.16;
    m.box([Math.min(a, b), DECK + 0.44, z0], [Math.max(a, b), DECK + 0.72, z1], MAT.METAL);
  });
}

/** A hedge along a verge, which is what a country road actually has. */
function hedge(m: MeshBuilder, x: number, z0: number, z1: number, h = 1.5): void {
  m.painted(TINT.GREEN, () => {
    for (let z = z0; z < z1; z += 1.6) {
      const t = ((z - z0) / 1.6) % 3;
      m.box([x - 0.55, 0, z], [x + 0.55, h + t * 0.12, Math.min(z + 1.6, z1)], MAT.TRIM);
    }
  });
}

/** A bus shelter: a glazed box with a cantilevered roof and a flag. */
function shelter(m: MeshBuilder, x: number, z: number, sx: 1 | -1): void {
  const y = DECK + KERB;
  m.painted(TINT.METAL_DARK, () => {
    for (const pz of [z - 2.0, z + 2.0]) {
      m.box([x - 0.06, y, pz - 0.06], [x + 0.06, y + 2.4, pz + 0.06], MAT.TRIM);
      m.box([x + sx * 1.3 - 0.06, y, pz - 0.06], [x + sx * 1.3 + 0.06, y + 2.4, pz + 0.06], MAT.TRIM);
    }
    m.box([Math.min(x - 0.2, x + sx * 1.6), y + 2.4, z - 2.2],
          [Math.max(x - 0.2, x + sx * 1.6), y + 2.56, z + 2.2], MAT.TRIM);
  });
  // Back and end panels in glass, so the shelter is not a table.
  m.box([x - 0.03, y, z - 2.0], [x + 0.03, y + 2.4, z + 2.0], MAT.GLASS);
  for (const pz of [z - 2.0, z + 2.0]) {
    m.box([Math.min(x, x + sx * 1.3), y, pz - 0.03], [Math.max(x, x + sx * 1.3), y + 2.4, pz + 0.03], MAT.GLASS);
  }
  m.painted(TINT.METAL_DARK, () => {
    m.box([x + sx * 0.3, y + 0.42, z - 1.7], [x + sx * 0.42, y + 0.5, z + 1.7], MAT.TRIM);
    m.cylinder(x + sx * 2.2, z + 2.6, 0.05, y, y + 3.0, 6, MAT.TRIM, false);
  });
  m.painted(TINT.SIGN_LIT, () =>
    m.box([x + sx * 2.2 - 0.35, y + 2.5, z + 2.57], [x + sx * 2.2 + 0.35, y + 3.0, z + 2.63], MAT.TRIM));
}

/** Railway track: sleepers and two rails, at the level given. */
function track(m: MeshBuilder, x: number, z0: number, z1: number, gauge = 1.435, y = DECK): void {
  m.painted(TINT.WOOD, () => {
    for (let z = z0; z < z1; z += 0.65) {
      m.box([x - gauge / 2 - 0.35, y - 0.14, z], [x + gauge / 2 + 0.35, y - 0.02, z + 0.26], MAT.TIMBER);
    }
  });
  m.painted(TINT.METAL_DARK, () => {
    for (const sx of [-1, 1] as const) {
      m.box([x + sx * gauge / 2 - 0.035, y - 0.02, z0], [x + sx * gauge / 2 + 0.035, y + 0.09, z1], MAT.METAL);
    }
  });
}

/** An arrow painted on the carriageway, pointing along +z or -z. */
function arrow(m: MeshBuilder, x: number, z: number, dir: 1 | -1): void {
  m.painted(TINT.SIGN_LIT, () => {
    m.box([x - 0.09, DECK + 0.003, z - dir * 1.4], [x + 0.09, DECK + 0.009, z + dir * 0.3], MAT.TRIM);
    for (let i = 0; i < 6; i++) {
      const t = i / 6;
      const w = 0.42 * (1 - t);
      m.box([x - w, DECK + 0.003, z + dir * (0.3 + t * 0.9)],
            [x + w, DECK + 0.009, z + dir * (0.3 + (t + 0.17) * 0.9)], MAT.TRIM);
    }
  });
}

/** Single-track country lane: no markings, verges, hedges, a passing place. */
function lane(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const z0 = -CELL * 2, z1 = CELL * 2;
  const half = 1.9;

  carriageway(m, half, z0, z1);
  // The passing place: a widening on one side, which is the whole point of a
  // single-track road and the only thing that distinguishes it from a path.
  m.box([half, 0, -4.0], [half + 2.6, DECK, 4.0], MAT.GROUND);

  if (medium) {
    for (const sx of [1, -1] as const) verge(m, sx, half, half + 2.2, z0, z1);
    verge(m, 1, half + 2.6, half + 3.4, -4.0, 4.0);
    hedge(m, -(half + 2.8), z0, z1, 1.6);
    hedge(m, half + 3.6, z0, z1, 1.4);
  }
  if (fine) {
    sign(m, half + 2.0, 5.0, 0.6, 0.6, TINT.SIGN_LIT);
    for (const z of [-13.0, -1.0, 11.0]) {
      m.painted(TINT.METAL_DARK, () =>
        m.cylinder(-(half + 0.5), z, 0.06, DECK, DECK + 1.0, 6, MAT.TRIM, false));
      m.painted(TINT.SIGN_LIT, () =>
        m.box([-(half + 0.62), DECK + 0.75, z - 0.1], [-(half + 0.38), DECK + 1.0, z + 0.1], MAT.TRIM));
    }
    ironwork(m, half - 0.3, 6.0, 'gully');
  }
  return m;
}

/** A one-way street: two lanes the same way, arrows, parking one side. */
function oneway(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const z0 = -CELL * 2, z1 = CELL * 2;
  const half = LANE + 1.2;

  carriageway(m, half, z0, z1);
  for (const sx of [1, -1] as const) footway(m, sx, half, z0, z1);

  if (medium) {
    line(m, 0, z0, z1, { dash: 3.0, gap: 6.0 });
    line(m, -(half - 2.4), z0, z1, { width: 0.08 });
    for (const z of [-11.0, 1.0, 13.0]) {
      arrow(m, -1.6, z, 1);
      arrow(m, 1.6, z, 1);
    }
    for (let z = z0 + 1.0; z < z1 - 5.0; z += 5.4) {
      crossLine(m, -half, -(half - 2.4), z, 0.08);
    }
  }
  if (fine) {
    for (const sx of [1, -1] as const) streetLight(m, sx, sx * (half + 0.8), sx > 0 ? -8.0 : 8.0, 7.0);
    sign(m, half + 1.2, -14.0, 0.7, 0.7, TINT.BRAND);
    figure(m, 6230, half + 1.4, 2.0, Math.PI, { bag: true });
    ironwork(m, half - 0.35, -4.0, 'gully');
  }
  return m;
}

/** A boulevard: three lanes each way about a planted median with trees. */
function boulevard(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const z0 = -CELL * 2, z1 = CELL * 2;
  const med = 3.4;
  const half = med + LANE * 3;

  for (const sx of [1, -1] as const) {
    m.box([Math.min(sx * med, sx * half), 0, z0], [Math.max(sx * med, sx * half), DECK, z1], MAT.GROUND);
    footway(m, sx, half, z0, z1, 3.2);
  }
  m.box([-med, 0, z0], [med, DECK + KERB, z1], MAT.STONE);
  m.painted(TINT.GREEN, () => m.box([-med + 0.4, DECK + KERB, z0], [med - 0.4, DECK + KERB + 0.1, z1], MAT.TRIM));

  if (medium) {
    for (const sx of [1, -1] as const) {
      for (let i = 1; i < 3; i++) line(m, sx * (med + i * LANE), z0, z1, { dash: 3.0, gap: 6.0 });
      line(m, sx * (half - 0.4), z0, z1, { width: 0.08 });
    }
    // Trees down the median, alternating with lighting.
    for (let i = 0; i < 5; i++) {
      const z = z0 + 3.0 + i * 7.0;
      m.painted(TINT.WOOD, () => m.cylinder(0, z, 0.18, DECK + KERB, 2.4, 6, MAT.TIMBER));
      m.painted(TINT.GREEN, () => {
        m.cone(0, z, 1.9, 1.3, 2.2, 4.6, 8, MAT.TRIM);
        m.cone(0, z, 1.4, 0.0, 4.2, 6.4, 8, MAT.TRIM);
      });
    }
  }
  if (fine) {
    for (let i = 0; i < 4; i++) {
      const z = z0 + 6.5 + i * 7.0;
      m.painted(TINT.METAL_DARK, () => {
        m.cylinder(0, z, 0.11, DECK + KERB, 9.0, 8, MAT.TRIM, false);
        for (const sx of [1, -1] as const) {
          m.box([Math.min(0, sx * 2.2), 8.86, z - 0.08], [Math.max(0, sx * 2.2), 9.0, z + 0.08], MAT.TRIM);
          m.box([sx * 2.2 - 0.3, 8.7, z - 0.17], [sx * 2.2 + 0.3, 8.86, z + 0.17], MAT.TRIM);
        }
      });
    }
    for (const sx of [1, -1] as const) {
      for (const z of [-10.0, 4.0]) figure(m, 6300 + z + sx * 7, sx * (half + 1.6), z, sx > 0 ? Math.PI : 0, {});
    }
  }
  return m;
}

/** Motorway: three lanes each way, hard shoulders, a central barrier. */
function motorway(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const z0 = -CELL * 2, z1 = CELL * 2;
  const med = 1.6;
  const carr = LANE * 3 + 3.0;                   // three lanes and a hard shoulder
  const half = med + carr;

  for (const sx of [1, -1] as const) {
    m.box([Math.min(sx * med, sx * half), 0, z0], [Math.max(sx * med, sx * half), DECK, z1], MAT.GROUND);
  }
  m.box([-med, 0, z0], [med, DECK + 0.1, z1], MAT.CONCRETE);

  if (medium) {
    for (const sx of [1, -1] as const) {
      for (let i = 1; i < 3; i++) line(m, sx * (med + i * LANE), z0, z1, { dash: 4.0, gap: 8.0 });
      // Hard shoulder line, solid and wider than a lane line.
      line(m, sx * (med + LANE * 3), z0, z1, { width: 0.15 });
      line(m, sx * (half - 0.3), z0, z1, { width: 0.1 });
      barrier(m, sx * (med + 0.2), z0, z1, sx);
      verge(m, sx, half, half + 4.0, z0, z1);
    }
  }
  if (fine) {
    for (const sx of [1, -1] as const) {
      m.painted(TINT.METAL_DARK, () => {
        for (let i = 0; i < 3; i++) {
          const z = z0 + 6.0 + i * 11.0;
          m.cylinder(sx * (half + 1.2), z, 0.13, 0, 11.0, 8, MAT.TRIM, false);
          m.box([Math.min(sx * (half + 1.2), sx * (half - 1.0)), 10.84, z - 0.09],
                [Math.max(sx * (half + 1.2), sx * (half - 1.0)), 11.0, z + 0.09], MAT.TRIM);
          m.box([sx * (half - 1.0) - 0.34, 10.66, z - 0.19], [sx * (half - 1.0) + 0.34, 10.84, z + 0.19], MAT.TRIM);
        }
      });
      // Marker posts along the verge.
      for (let z = z0; z < z1; z += 5.5) {
        m.painted(TINT.SIGN_LIT, () =>
          m.box([sx * (half + 0.5) - 0.06, DECK, z - 0.06], [sx * (half + 0.5) + 0.06, DECK + 1.0, z + 0.06], MAT.TRIM));
      }
    }
    for (let i = 0; i < 5; i++) {
    }
  }
  return m;
}


/** A motorway gantry: a portal frame carrying lane signals and a sign. */
function gantry(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const z0 = -CELL * 2, z1 = CELL * 2;
  const med = 1.6, carr = LANE * 3 + 3.0, half = med + carr;

  for (const sx of [1, -1] as const) {
    m.box([Math.min(sx * med, sx * half), 0, z0], [Math.max(sx * med, sx * half), DECK, z1], MAT.GROUND);
  }
  m.box([-med, 0, z0], [med, DECK + 0.1, z1], MAT.CONCRETE);
  // The gantry itself: two legs, a lattice beam and a walkway.
  const gy = 6.2;
  m.painted(TINT.METAL_DARK, () => {
    for (const sx of [1, -1] as const) {
      m.cylinder(sx * (half + 0.9), 0, 0.24, 0, gy, 10, MAT.TRIM, false);
      m.box([sx * (half + 0.9) - 0.6, 0, -0.6], [sx * (half + 0.9) + 0.6, 0.3, 0.6], MAT.CONCRETE);
    }
    for (const y of [gy - 0.9, gy]) {
      m.box([-(half + 0.9), y - 0.12, -0.14], [half + 0.9, y, 0.14], MAT.TRIM);
    }
    for (let i = 0; i <= 12; i++) {
      const x = -(half + 0.9) + (i / 12) * (half + 0.9) * 2;
      m.pipe([x, gy - 0.9, 0], [x + 1.4, gy, 0], 0.055, MAT.TRIM, 5);
    }
  });

  if (medium) {
    for (const sx of [1, -1] as const) {
      for (let i = 1; i < 3; i++) line(m, sx * (med + i * LANE), z0, z1, { dash: 4.0, gap: 8.0 });
      line(m, sx * (med + LANE * 3), z0, z1, { width: 0.15 });
      barrier(m, sx * (med + 0.2), z0, z1, sx);
      verge(m, sx, half, half + 4.0, z0, z1);
    }
    // A sign board over each carriageway, and a lane signal over each lane.
    for (const sx of [1, -1] as const) {
      m.painted(TINT.GREEN, () =>
        m.box([Math.min(sx * (med + 0.6), sx * (half - 1.0)), gy - 3.1, -0.09],
              [Math.max(sx * (med + 0.6), sx * (half - 1.0)), gy - 1.0, 0.09], MAT.TRIM));
      for (let i = 0; i < 3; i++) {
        const x = sx * (med + (i + 0.5) * LANE);
        m.painted(TINT.METAL_DARK, () => m.box([x - 0.32, gy - 1.0, -0.14], [x + 0.32, gy - 0.3, 0.14], MAT.TRIM));
        m.painted(TINT.SIGN_LIT, () => m.box([x - 0.22, gy - 0.9, -0.16], [x + 0.22, gy - 0.42, 0.16], MAT.TRIM));
      }
    }
  }
  if (fine) {
    for (let i = 0; i < 4; i++) {
    }
  }
  return m;
}

/** A diverging slip road, with the chevron nose between it and the main line. */
function slipRoad(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const z0 = -CELL * 2.5, z1 = CELL * 2.5;
  const half = LANE * 2 + 1.4;

  carriageway(m, half, z0, z1);
  // The slip peels away to one side over the length of the asset.
  for (let i = 0; i < 20; i++) {
    const t0 = i / 20, t1 = (i + 1) / 20;
    const za = z0 + t0 * (z1 - z0), zb = z0 + t1 * (z1 - z0);
    const oa = half + t0 * t0 * 9.0, ob = half + t1 * t1 * 9.0;
    m.quad([oa, DECK, za], [oa + LANE + 1.0, DECK, za],
           [ob + LANE + 1.0, DECK, zb], [ob, DECK, zb], MAT.GROUND);
    m.quad([oa, 0, za], [oa, DECK, za], [ob, DECK, zb], [ob, 0, zb], MAT.GROUND);
  }

  if (medium) {
    line(m, 0, z0, z1, { dash: 4.0, gap: 8.0 });
    line(m, -half + 0.4, z0, z1, { width: 0.12 });
    // The nose: a hatched triangle between the two carriageways.
    m.painted(TINT.SIGN_LIT, () => {
      for (let i = 0; i < 14; i++) {
        const t = i / 14;
        const z = z0 + (0.25 + t * 0.4) * (z1 - z0);
        const o = half + Math.pow(0.25 + t * 0.4, 2) * 9.0;
        m.box([half + 0.2, DECK + 0.004, z], [o - 0.2, DECK + 0.01, z + 0.5], MAT.TRIM);
      }
    });
    verge(m, -1, half, half + 3.0, z0, z1);
  }
  if (fine) {
    sign(m, half + 6.0, 8.0, 2.4, 1.4, TINT.GREEN);
    for (let z = z0; z < z1; z += 5.5) {
      m.painted(TINT.SIGN_LIT, () =>
        m.box([-(half + 0.5) - 0.06, DECK, z - 0.06], [-(half + 0.5) + 0.06, DECK + 1.0, z + 0.06], MAT.TRIM));
    }
    barrier(m, -(half + 0.6), z0, z1, 1);
  }
  return m;
}

/** A viaduct: a two-lane deck on piers, for a road crossing low ground. */
function viaduct(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const z0 = -CELL * 2.5, z1 = CELL * 2.5;
  const half = LANE * 2 + 1.0;
  const y = 7.4;

  // Deck and edge beams, carried on three portal piers.
  m.box([-half - 0.5, y, z0], [half + 0.5, y + 0.9, z1], MAT.CONCRETE);
  m.box([-half, y + 0.9, z0], [half, y + 0.9 + DECK, z1], MAT.GROUND);
  for (const z of [z0 + 5.0, 0, z1 - 5.0]) {
    for (const sx of [1, -1] as const) {
      m.cone(sx * (half - 1.4), z, 0.95, 1.25, 0, y, 10, MAT.CONCRETE);
    }
    m.box([-half + 0.4, y - 1.1, z - 0.9], [half - 0.4, y, z + 0.9], MAT.CONCRETE);
  }

  if (medium) {
    // Parapets both sides, and the carriageway markings on the deck.
    for (const sx of [1, -1] as const) {
      m.box([Math.min(sx * half, sx * (half + 0.5)), y + 0.9, z0],
            [Math.max(sx * half, sx * (half + 0.5)), y + 2.1, z1], MAT.CONCRETE);
      m.box([Math.min(sx * (half + 0.5), sx * (half + 0.62)), y + 2.1, z0],
            [Math.max(sx * (half + 0.5), sx * (half + 0.62)), y + 2.26, z1], MAT.STONE);
    }
    m.painted(TINT.SIGN_LIT, () => {
      for (let z = z0; z < z1; z += 12.0) {
        m.box([-0.09, y + 0.9 + DECK + 0.003, z], [0.09, y + 0.9 + DECK + 0.01, z + 4.0], MAT.TRIM);
      }
    });
    m.painted(TINT.GREEN, () => m.box([-half - 6.0, 0.001, z0], [half + 6.0, 0.06, z1], MAT.TRIM));
  }
  if (fine) {
    for (let i = 0; i < 3; i++) {
      const z = z0 + 8.0 + i * 12.0;
      m.painted(TINT.METAL_DARK, () => {
        m.cylinder(half + 0.3, z, 0.1, y + 2.26, y + 9.0, 8, MAT.TRIM, false);
        m.box([half - 1.5, y + 8.86, z - 0.08], [half + 0.3, y + 9.0, z + 0.08], MAT.TRIM);
        m.box([half - 1.8, y + 8.7, z - 0.17], [half - 1.2, y + 8.86, z + 0.17], MAT.TRIM);
      });
    }
  }
  return m;
}

/** A signalised T junction: a side road meeting a through route. */
function tJunction(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const half = LANE + 1.0;
  const arm = CELL * 2;

  carriageway(m, half, -arm, arm);
  m.box([half, 0, -half], [arm, DECK, half], MAT.GROUND);
  for (const sz of [1, -1] as const) {
    footway(m, 1, half, sz > 0 ? half : -arm, sz > 0 ? arm : -half);
    footway(m, -1, half, -arm, arm);
  }
  // The corner footways of the side arm.
  for (const sz of [1, -1] as const) {
    m.box([half, 0, Math.min(sz * half, sz * (half + WALK))],
          [arm, DECK + KERB, Math.max(sz * half, sz * (half + WALK))], MAT.CONCRETE);
  }

  if (medium) {
    line(m, 0, -arm, -half, { dash: 2.0, gap: 4.0 });
    line(m, 0, half, arm, { dash: 2.0, gap: 4.0 });
    crossLine(m, -half, 0, -half - 0.4, 0.4);
    crossLine(m, 0, half, half + 0.4, 0.4);
    m.painted(TINT.SIGN_LIT, () => {
      for (let z = -half + 0.4; z < half - 0.4; z += 0.9) {
        m.box([half + 0.6, DECK + 0.004, z], [half + 1.0, DECK + 0.01, z + 0.5], MAT.TRIM);
      }
    });
    // Zebra across the side arm.
    for (let i = 0; i < 7; i++) {
      m.painted(TINT.SIGN_LIT, () =>
        m.box([half + 2.4, DECK + 0.004, -half + 0.3 + i * 0.86],
              [half + 3.6, DECK + 0.01, -half + 0.75 + i * 0.86], MAT.TRIM));
    }
  }
  if (fine) {
    signal(m, half + 0.6, -half - 0.9, 1);
    signal(m, -half - 0.6, half + 0.9, -1);
    signal(m, half + 1.4, half + 0.9, -1);
    streetLight(m, -1, -(half + 0.9), 6.0, 8.0);
    streetLight(m, 1, half + 0.9, -12.0, 8.0);
    sign(m, half + 1.2, -half - 2.6, 0.9, 0.7, TINT.SIGN_LIT);
    ironwork(m, half - 0.35, -6.0, 'gully');
    ironwork(m, -(half - 0.35), 6.0, 'gully');
    figure(m, 6801, half + 3.0, half + 1.4, Math.PI, {});
  }
  return m;
}

/** A mini roundabout: a painted dome, give-way lines, four arms. */
function miniRoundabout(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const half = LANE + 0.6;
  const arm = CELL * 1.5;

  carriageway(m, half, -arm, arm);
  m.box([-arm, 0, -half], [arm, DECK, half], MAT.GROUND);
  for (const sx of [1, -1] as const) {
    for (const sz of [1, -1] as const) {
      m.box([Math.min(sx * half, sx * arm), 0, Math.min(sz * half, sz * arm)],
            [Math.max(sx * half, sx * arm), DECK + KERB, Math.max(sz * half, sz * arm)], MAT.CONCRETE);
    }
  }
  // The island: painted, slightly domed, not kerbed. That is what makes it a
  // mini roundabout rather than a small roundabout.
  m.painted(TINT.SIGN_LIT, () => m.cone(0, 0, 1.9, 1.3, DECK + 0.004, DECK + 0.10, 16, MAT.TRIM));

  if (medium) {
    for (const [a, b] of [[-arm, -half], [half, arm]] as const) {
      line(m, 0, a, b, { dash: 2.0, gap: 4.0 });
    }
    // Give-way triangles on all four approaches.
    m.painted(TINT.SIGN_LIT, () => {
      for (const s of [1, -1] as const) {
        for (let i = 0; i < 6; i++) {
          m.box([-half + 0.3 + i * 0.55, DECK + 0.004, s * (half + 0.5)],
                [-half + 0.7 + i * 0.55, DECK + 0.01, s * (half + 0.9)], MAT.TRIM);
          m.box([s * (half + 0.5), DECK + 0.004, -half + 0.3 + i * 0.55],
                [s * (half + 0.9), DECK + 0.01, -half + 0.7 + i * 0.55], MAT.TRIM);
        }
      }
    });
  }
  if (fine) {
    for (const sx of [1, -1] as const) {
      for (const sz of [1, -1] as const) {
        sign(m, sx * (half + 1.0), sz * (half + 1.0), 0.7, 0.7, TINT.SIGN_LIT);
      }
    }
    streetLight(m, 1, half + 1.4, -8.0, 8.0);
    streetLight(m, -1, -(half + 1.4), 8.0, 8.0);
    figure(m, 6930, half + 2.0, half + 2.0, Math.PI, { bag: true });
  }
  return m;
}


/** A bus lane and a stop: red surfacing, a cage, a shelter and a flag. */
function busLane(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const z0 = -CELL * 2, z1 = CELL * 2;
  const half = LANE * 2 + 0.6;

  carriageway(m, half, z0, z1);
  for (const sx of [1, -1] as const) footway(m, sx, half, z0, z1);
  // The bus lane, surfaced in a different colour rather than only lined.
  m.painted(TINT.BRAND, () =>
    m.box([half - LANE, DECK + 0.002, z0], [half - 0.1, DECK + 0.012, z1], MAT.TRIM));

  if (medium) {
    line(m, 0, z0, z1, { dash: 2.0, gap: 4.0 });
    line(m, half - LANE, z0, z1, { width: 0.2 });
    // The stop cage.
    m.painted(TINT.SIGN_LIT, () => {
      m.box([half - LANE + 0.1, DECK + 0.013, -6.0], [half - 0.2, DECK + 0.019, -5.8], MAT.TRIM);
      m.box([half - LANE + 0.1, DECK + 0.013, 6.0], [half - 0.2, DECK + 0.019, 6.2], MAT.TRIM);
      for (let z = -5.8; z < 6.0; z += 1.4) {
        m.box([half - LANE + 0.1, DECK + 0.013, z], [half - LANE + 0.3, DECK + 0.019, z + 0.7], MAT.TRIM);
      }
    });
    shelter(m, half + 1.9, 0, -1);
  }
  if (fine) {
    for (const sx of [1, -1] as const) streetLight(m, sx, sx * (half + 0.8), sx > 0 ? -12.0 : 10.0, 8.0);
    for (let i = 0; i < 4; i++) figure(m, 7030 + i * 7, half + 1.2, -3.0 + i * 2.0, Math.PI, { bag: i % 2 === 0 });
    ironwork(m, -(half - 0.35), 4.0, 'gully');
  }
  return m;
}

/** A tramway in the street: grooved track, an island platform, overhead line. */
function tramway(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const z0 = -CELL * 2, z1 = CELL * 2;
  const half = LANE * 2 + 1.6;

  carriageway(m, half, z0, z1);
  for (const sx of [1, -1] as const) footway(m, sx, half, z0, z1);
  for (const sx of [1, -1] as const) track(m, sx * 1.6, z0, z1, 1.435, DECK + 0.02);

  if (medium) {
    // Island platform between the tracks, with a ramp at each end.
    m.box([-1.9, DECK, -5.0], [1.9, DECK + 0.24, 5.0], MAT.CONCRETE);
    for (const sz of [1, -1] as const) {
      m.quad([-1.9, DECK, sz * 5.0], [1.9, DECK, sz * 5.0],
             [1.9, DECK + 0.24, sz * 3.6], [-1.9, DECK + 0.24, sz * 3.6], MAT.CONCRETE);
    }
    m.painted(TINT.SIGN_LIT, () => {
      m.box([-1.9, DECK + 0.24, -5.0], [-1.6, DECK + 0.25, 5.0], MAT.TRIM);
      m.box([1.6, DECK + 0.24, -5.0], [1.9, DECK + 0.25, 5.0], MAT.TRIM);
    });
    line(m, half - LANE, z0, z1, { width: 0.12 });
    line(m, -(half - LANE), z0, z1, { width: 0.12 });
  }
  if (fine) {
    // Overhead line: poles either side with a span wire and the contact wire.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 3; i++) {
        const z = z0 + 6.0 + i * 11.0;
        for (const sx of [1, -1] as const) {
          m.cylinder(sx * (half + 0.9), z, 0.11, DECK + KERB, 8.2, 8, MAT.TRIM, false);
        }
        m.box([-(half + 0.9), 8.0, z - 0.03], [half + 0.9, 8.06, z + 0.03], MAT.TRIM);
      }
      for (const sx of [1, -1] as const) {
        m.box([sx * 1.6 - 0.03, 6.4, z0], [sx * 1.6 + 0.03, 6.46, z1], MAT.TRIM);
      }
    });
    m.painted(TINT.METAL_DARK, () => m.cylinder(0, 4.4, 0.06, DECK + 0.24, DECK + 3.0, 6, MAT.TRIM, false));
    m.painted(TINT.SIGN_LIT, () => m.box([-0.42, DECK + 2.5, 4.34], [0.42, DECK + 3.0, 4.46], MAT.TRIM));
    for (let i = 0; i < 4; i++) figure(m, 7130 + i * 9, -1.0 + (i % 2) * 2.0, -2.0 + i * 1.6, i % 2 ? 0 : Math.PI, {});
  }
  return m;
}

/** A segregated cycle track, with its own kerb and a signalised crossing. */
function cycleTrack(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const z0 = -CELL * 2, z1 = CELL * 2;
  const half = LANE + 0.4;
  const track2 = 2.6;

  carriageway(m, half, z0, z1);
  // The track sits between the carriageway and the footway, at kerb level,
  // separated by a low kerb rather than by paint. That separation is the
  // whole difference between a cycle lane and a cycle track.
  m.box([half, 0, z0], [half + 0.4, DECK + KERB, z1], MAT.STONE);
  m.painted(TINT.BRAND, () => m.box([half + 0.4, 0, z0], [half + 0.4 + track2, DECK + KERB, z1], MAT.TRIM));
  footway(m, 1, half + 0.4 + track2, z0, z1, 2.2);
  footway(m, -1, half, z0, z1);

  if (medium) {
    line(m, 0, z0, z1, { dash: 2.0, gap: 4.0 });
    m.painted(TINT.SIGN_LIT, () => {
      for (let z = z0; z < z1; z += 6.0) {
        m.box([half + 1.6, DECK + KERB + 0.002, z], [half + 1.72, DECK + KERB + 0.008, z + 3.0], MAT.TRIM);
      }
    });
    // Wands on the separating kerb, so it reads at a distance.
    m.painted(TINT.SIGN_LIT, () => {
      for (let z = z0 + 1.0; z < z1; z += 3.2) {
        m.box([half + 0.12, DECK + KERB, z - 0.06], [half + 0.28, DECK + KERB + 0.85, z + 0.06], MAT.TRIM);
      }
    });
  }
  if (fine) {
    streetLight(m, 1, half + 0.4 + track2 + 1.4, -8.0, 7.0);
    streetLight(m, -1, -(half + 0.9), 8.0, 7.0);
    signal(m, half + 0.4 + track2 + 0.6, 6.0, -1, 2.8);
    sign(m, -(half + 1.0), -12.0, 0.6, 0.6, TINT.SIGN_LIT);
    ironwork(m, half - 0.35, 2.0, 'gully');
    figure(m, 7220, half + 1.7, 2.0, 0, { stride: 0.2 });
    figure(m, 7233, half + 0.4 + track2 + 1.0, -2.0, Math.PI, {});
  }
  return m;
}

/** A pedestrianised street: paving, bollards, benches, planters, no kerbs. */
function pedestrianised(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const z0 = -CELL * 2, z1 = CELL * 2;
  const half = 6.0;

  m.box([-half, 0, z0], [half, DECK + KERB, z1], MAT.CONCRETE);
  // A banded paving pattern across the street, which is what these always have
  // and what stops the surface reading as one grey sheet.
  m.painted(TINT.METAL_DARK, () => {
    for (let z = z0; z < z1; z += 4.0) {
      m.box([-half, DECK + KERB, z], [half, DECK + KERB + 0.012, z + 0.5], MAT.STONE);
    }
  });
  m.box([-1.2, DECK + KERB, z0], [1.2, DECK + KERB + 0.014, z1], MAT.STONE);

  if (medium) {
    for (const sx of [1, -1] as const) {
      for (let z = z0 + 2.0; z < z1; z += 4.0) {
        m.painted(TINT.METAL_DARK, () =>
          m.cylinder(sx * (half - 0.8), z, 0.11, DECK + KERB, DECK + KERB + 0.95, 8, MAT.TRIM));
      }
    }
    for (let i = 0; i < 4; i++) {
      const z = z0 + 5.0 + i * 8.0;
      const sx = i % 2 === 0 ? 1 : -1;
      m.box([sx * 2.6 - 0.9, DECK + KERB, z - 0.9], [sx * 2.6 + 0.9, DECK + KERB + 0.55, z + 0.9], MAT.STONE);
      m.painted(TINT.GREEN, () =>
        m.cone(sx * 2.6, z, 0.9, 0.2, DECK + KERB + 0.5, DECK + KERB + 3.4, 8, MAT.TRIM));
    }
  }
  if (fine) {
    for (let i = 0; i < 3; i++) {
      const z = z0 + 8.0 + i * 10.0;
      const sx = i % 2 === 0 ? -1 : 1;
      m.painted(TINT.WOOD, () => {
        m.box([sx * 3.4 - 0.9, DECK + KERB + 0.42, z - 0.24], [sx * 3.4 + 0.9, DECK + KERB + 0.5, z + 0.24], MAT.TIMBER);
      });
      m.painted(TINT.METAL_DARK, () => {
        for (const dz of [-0.7, 0.7]) {
          m.box([sx * 3.4 + dz - 0.05, DECK + KERB, z - 0.2], [sx * 3.4 + dz + 0.05, DECK + KERB + 0.42, z + 0.2], MAT.TRIM);
        }
      });
    }
    for (let i = 0; i < 6; i++) {
      figure(m, 7300 + i * 11, -3.4 + (i % 3) * 3.2, z0 + 4.0 + i * 4.4, i % 2 ? 0 : Math.PI,
        { bag: i % 3 === 0 });
    }
    m.painted(TINT.METAL_DARK, () => {
      m.cylinder(-4.6, -2.0, 0.1, DECK + KERB, 5.4, 8, MAT.TRIM, false);
      m.box([-4.6 - 0.34, 5.1, -2.2], [-4.6 + 0.34, 5.36, -1.8], MAT.TRIM);
    });
  }
  return m;
}

/** A service alley: narrow, no footways, bins, gates and a bollard. */
function alley(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const z0 = -CELL * 2, z1 = CELL * 2;
  const half = 2.4;

  m.box([-half, 0, z0], [half, DECK, z1], MAT.GROUND);
  // Walls either side, since an alley is defined by what encloses it.
  for (const sx of [1, -1] as const) {
    m.box([Math.min(sx * half, sx * (half + 0.4)), 0, z0],
          [Math.max(sx * half, sx * (half + 0.4)), 3.4, z1], MAT.BRICK);
    m.box([Math.min(sx * (half - 0.1), sx * (half + 0.5)), 3.4, z0],
          [Math.max(sx * (half - 0.1), sx * (half + 0.5)), 3.62, z1], MAT.STONE);
  }
  // A drainage channel down the middle, which every alley has.
  m.box([-0.3, DECK - 0.05, z0], [0.3, DECK - 0.02, z1], MAT.STONE);

  if (medium) {
    for (const sz of [-8.0, 6.0]) {
      m.painted(TINT.METAL_DARK, () => {
        m.box([half - 0.02, 0.1, sz - 1.1], [half + 0.42, 2.6, sz + 1.1], MAT.TRIM);
        for (let i = 0; i < 5; i++) {
          m.box([half + 0.42, 0.2 + i * 0.5, sz - 1.0], [half + 0.5, 0.6 + i * 0.5, sz + 1.0], MAT.TRIM);
        }
      });
    }
    for (const [px, pz, t] of [[-1.5, -4.0, TINT.GREEN], [-1.5, -2.6, TINT.BRAND], [1.4, 9.0, TINT.METAL_DARK]] as const) {
      m.painted(t as never, () => {
        m.box([px - 0.55, DECK, pz - 0.4], [px + 0.55, DECK + 1.15, pz + 0.4], MAT.TRIM);
        m.box([px - 0.6, DECK + 1.15, pz - 0.45], [px + 0.6, DECK + 1.26, pz + 0.45], MAT.TRIM);
      });
    }
  }
  if (fine) {
    m.painted(TINT.METAL_DARK, () => {
      m.cylinder(0, z0 + 1.4, 0.12, DECK, DECK + 1.0, 8, MAT.TRIM);
      m.box([-half + 0.1, 3.0, -12.0], [-half + 0.5, 3.3, -11.0], MAT.TRIM);
    });
    // A single lamp bracketed off one wall.
    m.painted(TINT.METAL_DARK, () => m.box([half - 0.02, 3.0, 1.9], [half - 0.9, 3.12, 2.1], MAT.TRIM));
    m.painted(TINT.SIGN_LIT, () => m.box([half - 1.05, 2.8, 1.85], [half - 0.75, 3.02, 2.15], MAT.TRIM));
    ironwork(m, 0, 3.0, 'cover');
    ironwork(m, 0, -7.0, 'cover');
    // Pipework and a fire escape ladder up one wall: an alley is mostly the
    // backs of buildings, and the backs of buildings are covered in these.
    m.painted(TINT.METAL_DARK, () => {
      for (const [px, sx] of [[-half + 0.05, 1], [half - 0.05, -1]] as const) {
        m.pipe([px, 0.2, -14.0], [px, 3.2, -14.0], 0.07, MAT.TRIM, 6);
        m.pipe([px, 3.2, -14.0], [px, 3.2, -10.0], 0.06, MAT.TRIM, 6);
        for (let i = 0; i < 9; i++) {
          m.box([px, 0.6 + i * 0.3, 5.0], [px + sx * 0.42, 0.66 + i * 0.3, 5.06], MAT.TRIM);
        }
        for (const pz of [5.0, 5.7]) {
          m.box([px, 0.4, pz - 0.04], [px + sx * 0.06, 3.4, pz + 0.04], MAT.TRIM);
        }
      }
    });
    figure(m, 7401, -1.0, 2.0, Math.PI, { bag: true });
    figure(m, 7414, 0.9, -5.0, 0, {});
  }
  return m;
}


/** Echelon parking bays along a street, with a footway build-out. */
function parkingBays(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const z0 = -CELL * 2, z1 = CELL * 2;
  const half = LANE + 0.4;
  const bay = 4.8;

  carriageway(m, half, z0, z1);
  m.box([half, 0, z0], [half + bay, DECK, z1], MAT.GROUND);
  footway(m, 1, half + bay, z0, z1);
  footway(m, -1, half, z0, z1);

  if (medium) {
    line(m, 0, z0, z1, { dash: 2.0, gap: 4.0 });
    line(m, half, z0, z1, { width: 0.12 });
    // Bays at 60 degrees, which is what echelon parking is and why it needs
    // a wider strip than parallel bays.
    m.painted(TINT.SIGN_LIT, () => {
      for (let i = 0; i <= 10; i++) {
        const z = z0 + i * 3.0;
        for (let k = 0; k < 8; k++) {
          const t = k / 8;
          m.box([half + t * bay - 0.06, DECK + 0.004, z + t * 2.4],
                [half + t * bay + 0.06, DECK + 0.01, z + t * 2.4 + 0.55], MAT.TRIM);
        }
      }
    });
  }
  if (fine) {
    for (let i = 0; i < 5; i++) {
    }
    streetLight(m, 1, half + bay + 0.9, -10.0, 8.0);
    streetLight(m, -1, -(half + 0.9), 8.0, 8.0);
    for (const z of [-6.0, 10.0]) {
      m.painted(TINT.METAL_DARK, () => m.cylinder(half + bay + 0.6, z, 0.09, DECK + KERB, DECK + KERB + 1.3, 6, MAT.TRIM));
      m.painted(TINT.SIGN_LIT, () =>
        m.box([half + bay + 0.4, DECK + KERB + 1.0, z - 0.1], [half + bay + 0.8, DECK + KERB + 1.3, z + 0.1], MAT.TRIM));
    }
    figure(m, 7530, half + bay + 1.4, 2.0, Math.PI, { bag: true });
  }
  return m;
}

/** A surface car park: aisles, bays, lighting and a barrier at the entry. */
function carPark(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const x = CELL * 2.5, z = CELL * 2;

  m.box([-x, 0, -z], [x, DECK, z], MAT.GROUND);
  m.box([-x - 0.3, 0, -z - 0.3], [x + 0.3, DECK + KERB, -z], MAT.CONCRETE);

  if (medium) {
    // Two rows of bays either side of a central aisle.
    m.painted(TINT.SIGN_LIT, () => {
      for (const sz of [1, -1] as const) {
        for (let i = 0; i <= 14; i++) {
          const px = -x + 1.0 + i * ((2 * x - 2.0) / 14);
          m.box([px - 0.06, DECK + 0.004, Math.min(sz * 3.0, sz * 8.0)],
                [px + 0.06, DECK + 0.01, Math.max(sz * 3.0, sz * 8.0)], MAT.TRIM);
        }
        m.box([-x + 1.0, DECK + 0.004, sz * 8.0 - 0.06], [x - 1.0, DECK + 0.01, sz * 8.0 + 0.06], MAT.TRIM);
      }
    });
    // Kerbed island down the middle of the far row, planted.
    m.box([-x + 2.0, DECK, 9.4], [x - 2.0, DECK + KERB, 11.0], MAT.STONE);
    m.painted(TINT.GREEN, () => m.box([-x + 2.2, DECK + KERB, 9.6], [x - 2.2, DECK + KERB + 0.1, 10.8], MAT.TRIM));
    for (let i = 0; i < 4; i++) {
      const px = -x + 4.0 + i * ((2 * x - 8.0) / 3);
      m.painted(TINT.WOOD, () => m.cylinder(px, 10.2, 0.16, DECK + KERB, 2.2, 6, MAT.TIMBER));
      m.painted(TINT.GREEN, () => m.cone(px, 10.2, 1.7, 0.0, 2.0, 5.6, 8, MAT.TRIM));
    }
  }
  if (fine) {
    for (const px of [-x + 5.0, x - 5.0]) {
      m.painted(TINT.METAL_DARK, () => {
        m.cylinder(px, 0, 0.14, DECK, 9.0, 8, MAT.TRIM, false);
        for (const sz of [1, -1] as const) {
          m.box([px - 0.3, 8.7, Math.min(sz * 0.2, sz * 1.6)], [px + 0.3, 8.9, Math.max(sz * 0.2, sz * 1.6)], MAT.TRIM);
        }
      });
    }
    // Entry barrier and a ticket machine.
    m.painted(TINT.METAL_DARK, () => m.box([-2.2, DECK, -z - 0.2], [-1.9, DECK + 1.1, -z + 0.2], MAT.TRIM));
    m.painted(TINT.SIGN_LIT, () => m.box([-1.9, DECK + 0.85, -z - 0.06], [1.6, DECK + 0.99, -z + 0.06], MAT.TRIM));
    m.painted(TINT.METAL_DARK, () => m.box([2.6, DECK, -z + 0.4], [3.2, DECK + 1.4, -z + 0.9], MAT.TRIM));
    figure(m, 7640, 3.9, -z + 1.6, 0, {});
  }
  return m;
}

/** A level crossing: track across the road, barriers, lights and a hut. */
function levelCrossing(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const half = LANE + 0.8;
  const arm = CELL * 2;

  carriageway(m, half, -arm, arm);
  for (const sx of [1, -1] as const) footway(m, sx, half, -arm, arm);
  // The railway runs across, with ballast either side of the crossing deck.
  m.painted(TINT.METAL_DARK, () => m.box([-arm, 0, -2.2], [arm, DECK - 0.02, 2.2], MAT.GROUND));
  for (const sz of [1, -1] as const) {
    track(m, 0, sz * 0.9, sz * arm, 1.435, DECK);
  }
  m.box([-half - WALK, DECK - 0.02, -1.9], [half + WALK, DECK + 0.06, 1.9], MAT.TIMBER);
  m.painted(TINT.METAL_DARK, () => {
    for (const sx of [-1, 1] as const) {
      m.box([sx * 0.68, DECK + 0.02, -1.9], [sx * 0.78, DECK + 0.1, 1.9], MAT.METAL);
    }
  });

  if (medium) {
    for (const sz of [1, -1] as const) {
      crossLine(m, -half, half, sz * 3.4, 0.4);
      // The zigzag warning markings on the approach.
      m.painted(TINT.SIGN_LIT, () => {
        for (let i = 0; i < 6; i++) {
          m.box([-half + 0.3, DECK + 0.004, sz * (4.2 + i * 1.6)],
                [half - 0.3, DECK + 0.01, sz * (4.4 + i * 1.6)], MAT.TRIM);
        }
      });
    }
  }
  if (fine) {
    // Two half barriers, down, with lights on the same post.
    for (const [sx, sz] of [[1, -1], [-1, 1]] as const) {
      const px = sx * (half + 0.6), pz = sz * 3.0;
      m.painted(TINT.METAL_DARK, () => m.cylinder(px, pz, 0.13, DECK + KERB, 3.2, 8, MAT.TRIM, false));
      m.painted(TINT.SIGN_LIT, () => {
        for (let i = 0; i < 6; i++) {
          const a = px - sx * (0.2 + i * 0.9), b = px - sx * (0.6 + i * 0.9);
          m.box([Math.min(a, b), DECK + 0.95, pz - 0.07], [Math.max(a, b), DECK + 1.12, pz + 0.07], MAT.TRIM);
        }
      });
      m.painted(TINT.BRAND, () => {
        m.box([px - 0.28, 2.5, pz - 0.1], [px - 0.02, 2.78, pz + 0.1], MAT.TRIM);
        m.box([px + 0.02, 2.5, pz - 0.1], [px + 0.28, 2.78, pz + 0.1], MAT.TRIM);
      });
      m.painted(TINT.METAL_DARK, () => m.box([px - 0.34, 2.9, pz - 0.14], [px + 0.34, 3.2, pz + 0.14], MAT.TRIM));
    }
    // Relay hut beside the line.
    m.box([-arm + 2.0, DECK, 3.6], [-arm + 4.4, DECK + 2.4, 5.8], MAT.CONCRETE);
    m.box([-arm + 1.8, DECK + 2.4, 3.4], [-arm + 4.6, DECK + 2.6, 6.0], MAT.METAL);
    sign(m, half + 1.4, -6.0, 0.8, 0.8, TINT.SIGN_LIT);
  }
  return m;
}

/** A tunnel portal in an embankment: a headwall, wing walls and a lit bore. */
function tunnelPortal(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const z0 = -CELL * 2, z1 = CELL * 2;
  const half = LANE * 2 + 0.8;
  const face = 4.0;

  carriageway(m, half, z0, z1);
  // The embankment the portal is cut into, with a batter each side.
  m.painted(TINT.GREEN, () => {
    for (const sx of [1, -1] as const) {
      m.quad([sx * (half + 1.0), 0, face], [sx * (half + 9.0), 0, face],
             [sx * (half + 9.0), 0, z1], [sx * (half + 1.0), 0, z1], MAT.TRIM);
      m.quad([sx * (half + 9.0), 0, face], [sx * (half + 9.0), 9.0, face],
             [sx * (half + 9.0), 9.0, z1], [sx * (half + 9.0), 0, z1], MAT.TRIM);
    }
    m.quad([-(half + 9.0), 9.0, face], [half + 9.0, 9.0, face],
           [half + 9.0, 9.0, z1], [-(half + 9.0), 9.0, z1], MAT.TRIM);
  });
  // Headwall, with the bore cut through it as two piers and a lintel.
  for (const sx of [1, -1] as const) {
    m.box([Math.min(sx * half, sx * (half + 2.6)), 0, face], [Math.max(sx * half, sx * (half + 2.6)), 9.0, face + 1.2], MAT.CONCRETE);
  }
  m.box([-half, 5.6, face], [half, 9.0, face + 1.2], MAT.CONCRETE);
  m.box([-half - 3.0, 9.0, face - 0.3], [half + 3.0, 9.7, face + 1.5], MAT.STONE);
  // The bore behind: a dark box, so the portal is a hole and not a wall.
  m.painted(TINT.METAL_DARK, () => m.box([-half, 0, face + 1.2], [half, 5.6, face + 8.0], MAT.TRIM));

  if (medium) {
    line(m, 0, z0, face, { dash: 3.0, gap: 6.0 });
    for (const sx of [1, -1] as const) {
      line(m, sx * (half - 0.4), z0, face, { width: 0.1 });
      m.box([Math.min(sx * half, sx * (half + 0.5)), 0, z0], [Math.max(sx * half, sx * (half + 0.5)), DECK + KERB + 0.6, z0 + 40.0], MAT.CONCRETE);
    }
    // Lights in the bore, receding.
    for (let i = 0; i < 4; i++) {
      m.painted(TINT.SIGN_LIT, () =>
        m.box([-half + 0.3, 5.1, face + 1.6 + i * 1.6], [half - 0.3, 5.24, face + 2.2 + i * 1.6], MAT.TRIM));
    }
  }
  if (fine) {
    sign(m, half + 1.6, face - 3.0, 1.6, 1.0, TINT.SIGN_LIT);
    for (const sx of [1, -1] as const) {
      m.painted(TINT.SIGN_LIT, () => {
        for (let i = 0; i < 5; i++) {
          m.box([sx * (half + 0.3) - 0.07, DECK, face - 2.0 - i * 3.0],
                [sx * (half + 0.3) + 0.07, DECK + 1.0, face - 1.9 - i * 3.0], MAT.TRIM);
        }
      });
    }
  }
  return m;
}

/** A flyover: one road carried over another on an embankment and abutments. */
function flyover(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const x = CELL * 2.5, z = CELL * 2.5;
  const half = LANE * 2 + 0.8;
  const y = 6.6;

  // The road underneath, running across.
  m.box([-x, 0, -half], [x, DECK, half], MAT.GROUND);
  for (const sz of [1, -1] as const) {
    m.box([-x, 0, Math.min(sz * half, sz * (half + WALK))],
          [x, DECK + KERB, Math.max(sz * half, sz * (half + WALK))], MAT.CONCRETE);
  }
  // Abutments, deck and the embankment beyond each one.
  for (const sz of [1, -1] as const) {
    m.box([-half - 0.6, 0, Math.min(sz * (half + WALK + 0.6), sz * (half + WALK + 3.0))],
          [half + 0.6, y, Math.max(sz * (half + WALK + 0.6), sz * (half + WALK + 3.0))], MAT.CONCRETE);
    m.painted(TINT.GREEN, () => {
      const a = sz * (half + WALK + 3.0), b = sz * z;
      m.box([-half - 4.0, 0, Math.min(a, b)], [half + 4.0, y - 0.9, Math.max(a, b)], MAT.TRIM);
    });
    m.box([-half - 0.6, y - 0.9, Math.min(sz * (half + WALK + 3.0), sz * z)],
          [half + 0.6, y, Math.max(sz * (half + WALK + 3.0), sz * z)], MAT.GROUND);
  }
  m.box([-half - 0.6, y - 1.0, -(half + WALK + 0.6)], [half + 0.6, y, half + WALK + 0.6], MAT.CONCRETE);
  m.box([-half, y, -(half + WALK + 0.6)], [half, y + DECK, half + WALK + 0.6], MAT.GROUND);

  if (medium) {
    for (const sx of [1, -1] as const) {
      m.box([Math.min(sx * half, sx * (half + 0.6)), y, -z], [Math.max(sx * half, sx * (half + 0.6)), y + 1.3, z], MAT.CONCRETE);
    }
    line(m, 0, -half, half, { dash: 2.0, gap: 4.0 });
    for (let i = 0; i < 5; i++) {
      m.painted(TINT.SIGN_LIT, () =>
        m.box([-0.09, y + DECK + 0.003, -z + 2.0 + i * 8.0], [0.09, y + DECK + 0.01, -z + 5.0 + i * 8.0], MAT.TRIM));
    }
  }
  if (fine) {
    for (const sz of [1, -1] as const) {
      streetLight(m, sz > 0 ? 1 : -1, sz * (half + 0.3), sz * 10.0, y + 8.0);
    }
    sign(m, -x + 3.0, half + 2.4, 1.4, 0.9, TINT.SIGN_LIT);
  }
  return m;
}

/** Traffic calming: a raised table, build-outs and a chicane. */
function trafficCalming(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const z0 = -CELL * 2, z1 = CELL * 2;
  const half = LANE + 0.8;

  carriageway(m, half, z0, z1);
  for (const sx of [1, -1] as const) footway(m, sx, half, z0, z1);
  // The table: the carriageway raised to footway level over eight metres,
  // with a ramp at each end.
  m.box([-half, DECK, -4.0], [half, DECK + KERB, 4.0], MAT.CONCRETE);
  for (const sz of [1, -1] as const) {
    m.quad([-half, DECK, sz * 5.2], [half, DECK, sz * 5.2],
           [half, DECK + KERB, sz * 4.0], [-half, DECK + KERB, sz * 4.0], MAT.CONCRETE);
  }

  if (medium) {
    // Build-outs narrowing the road alternately, which is the chicane.
    for (const [sx, sz] of [[1, -1], [-1, 1]] as const) {
      m.box([Math.min(sx * half, sx * (half - 2.0)), 0, sz * 8.0],
            [Math.max(sx * half, sx * (half - 2.0)), DECK + KERB, sz * 13.0], MAT.CONCRETE);
      m.painted(TINT.GREEN, () =>
        m.box([Math.min(sx * (half - 0.4), sx * (half - 1.8)), DECK + KERB, sz * 8.6],
              [Math.max(sx * (half - 0.4), sx * (half - 1.8)), DECK + KERB + 0.1, sz * 12.4], MAT.TRIM));
    }
    line(m, 0, z0, -6.0, { dash: 2.0, gap: 4.0 });
    line(m, 0, 6.0, z1, { dash: 2.0, gap: 4.0 });
    m.painted(TINT.SIGN_LIT, () => {
      for (const sz of [1, -1] as const) {
        for (let i = 0; i < 7; i++) {
          m.box([-half + 0.3 + i * 0.85, DECK + KERB + 0.002, sz * 4.0],
                [-half + 0.7 + i * 0.85, DECK + KERB + 0.008, sz * 4.5], MAT.TRIM);
        }
      }
    });
  }
  if (fine) {
    for (const [sx, sz] of [[1, -1], [-1, 1]] as const) {
      for (let i = 0; i < 3; i++) {
        m.painted(TINT.SIGN_LIT, () =>
          m.box([sx * (half - 2.1) - 0.08, DECK, sz * (9.0 + i * 1.8) - 0.08],
                [sx * (half - 2.1) + 0.08, DECK + 1.0, sz * (9.0 + i * 1.8) + 0.08], MAT.TRIM));
      }
      sign(m, sx * (half + 0.9), sz * 14.5, 0.7, 0.7, TINT.SIGN_LIT);
    }
    streetLight(m, 1, half + 0.9, 0.0, 7.0);
    figure(m, 8001, -1.0, 3.0, Math.PI / 2, { stride: 0.18 });
  }
  return m;
}

/** A toll plaza: booths under a canopy, with an island between each lane. */
function tollPlaza(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const z0 = -CELL * 2, z1 = CELL * 2;
  const lanes = 4;
  const half = lanes * 2.0;

  m.box([-half, 0, z0], [half, DECK, z1], MAT.GROUND);
  // Islands between the lanes, each with a booth on it.
  for (let i = 0; i <= lanes; i++) {
    const x = -half + (i / lanes) * half * 2;
    m.box([x - 0.7, DECK, -5.0], [x + 0.7, DECK + KERB, 5.0], MAT.CONCRETE);
    for (const sz of [1, -1] as const) {
      m.quad([x - 0.7, DECK, sz * 6.4], [x + 0.7, DECK, sz * 6.4],
             [x + 0.7, DECK + KERB, sz * 5.0], [x - 0.7, DECK + KERB, sz * 5.0], MAT.CONCRETE);
    }
    if (i > 0 && i < lanes) {
      m.box([x - 0.6, DECK + KERB, -1.6], [x + 0.6, DECK + KERB + 2.4, 1.6], MAT.CLADDING);
      m.box([x - 0.55, DECK + KERB + 1.0, -1.65], [x + 0.55, DECK + KERB + 2.1, 1.65], MAT.GLASS);
      m.box([x - 0.75, DECK + KERB + 2.4, -1.8], [x + 0.75, DECK + KERB + 2.6, 1.8], MAT.METAL);
    }
  }
  // The canopy over the whole plaza.
  m.box([-half - 1.2, 5.6, -3.4], [half + 1.2, 6.2, 3.4], MAT.METAL);
  for (let i = 0; i <= lanes; i++) {
    const x = -half + (i / lanes) * half * 2;
    if (i === 0 || i === lanes) {
      m.painted(TINT.METAL_DARK, () => m.cylinder(x, 0, 0.22, DECK + KERB, 5.6, 10, MAT.TRIM, false));
    }
  }

  if (medium) {
    m.painted(TINT.SIGN_LIT, () => {
      for (let i = 0; i < lanes; i++) {
        const x = -half + ((i + 0.5) / lanes) * half * 2;
        m.box([x - 0.6, 4.6, -3.5], [x + 0.6, 5.4, -3.36], MAT.TRIM);
      }
    });
    for (let i = 0; i < lanes; i++) {
      const x = -half + ((i + 0.5) / lanes) * half * 2;
      m.painted(TINT.METAL_DARK, () => m.box([x - 1.5, DECK + KERB, 2.2], [x + 1.5, DECK + KERB + 0.12, 2.34], MAT.TRIM));
    }
    for (const sx of [1, -1] as const) verge(m, sx, half, half + 4.0, z0, z1);
  }
  if (fine) {
    for (let z = z0; z < z1; z += 6.0) {
      for (const sx of [1, -1] as const) {
        m.painted(TINT.SIGN_LIT, () =>
          m.box([sx * (half + 0.5) - 0.06, DECK, z - 0.06], [sx * (half + 0.5) + 0.06, DECK + 1.0, z + 0.06], MAT.TRIM));
      }
    }
  }
  return m;
}

/** A layby off a main road, with a shelter and a footpath. */
function layby(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const z0 = -CELL * 2, z1 = CELL * 2;
  const half = LANE + 0.6;
  const bay = 3.4;

  carriageway(m, half, z0, z1);
  // The layby: a bay that tapers in and out, rather than a rectangle.
  for (let i = 0; i < 16; i++) {
    const t0 = i / 16, t1 = (i + 1) / 16;
    const wOf = (t: number): number => bay * Math.min(1, Math.sin(t * Math.PI) * 1.8);
    const za = z0 + t0 * (z1 - z0), zb = z0 + t1 * (z1 - z0);
    m.quad([half, DECK, za], [half + wOf(t0), DECK, za],
           [half + wOf(t1), DECK, zb], [half, DECK, zb], MAT.GROUND);
    m.quad([half + wOf(t0), 0, za], [half + wOf(t0), DECK, za],
           [half + wOf(t1), DECK, zb], [half + wOf(t1), 0, zb], MAT.GROUND);
  }
  footway(m, -1, half, z0, z1);

  if (medium) {
    line(m, 0, z0, z1, { dash: 2.0, gap: 4.0 });
    line(m, half - 0.3, z0, z1, { width: 0.12 });
    m.box([half + bay, 0, -7.0], [half + bay + 2.2, DECK + KERB, 7.0], MAT.CONCRETE);
    shelter(m, half + bay + 1.4, 0, 1);
    verge(m, 1, half + bay + 2.2, half + bay + 4.0, z0, z1);
  }
  if (fine) {
    streetLight(m, 1, half + bay + 2.6, 8.0, 8.0);
    sign(m, half + bay + 2.6, -9.0, 1.1, 0.7, TINT.GREEN);
    for (let i = 0; i < 3; i++) figure(m, 8230 + i * 11, half + bay + 0.6, -2.0 + i * 2.0, Math.PI, {});
    ironwork(m, half - 0.35, -12.0, 'gully');
  }
  return m;
}


const road = (upkeep: number): AssetDef['sim'] => ({
  jobs: 0, powerKW: 0, waterM3: 0, garbagePerWeek: 0, pollution: 0, upkeep,
});

export const ROADS: AssetDef[] = [
  { id: 'road.lane', name: 'Country lane', zone: 'road', density: 'none', variant: 'sculpted', footprint: [3, 4], height: 3.0, sim: road(2), note: 'Single track with a passing place, grass verges, hedges either side, unlit and unmarked.', build: lane },
  { id: 'road.oneway', name: 'One-way street', zone: 'road', density: 'none', variant: 'sculpted', footprint: [3, 4], height: 7.0, sim: road(5), note: 'Two lanes the same way with painted arrows, parking down one side, footways both.', build: oneway },
  { id: 'road.boulevard', name: 'Boulevard', zone: 'road', density: 'none', variant: 'sculpted', footprint: [4, 5], height: 9.0, sim: road(16), note: 'Three lanes each way about a planted median of trees, twin-arm lighting, wide footways.', build: boulevard },
  { id: 'road.motorway', name: 'Motorway', zone: 'road', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 11.0, sim: road(30), note: 'Three lanes and a hard shoulder each way, central steel barrier, high-mast lighting, marker posts.', build: motorway },
  { id: 'road.gantry', name: 'Motorway gantry', zone: 'road', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 7.0, sim: road(20), note: 'Lattice portal over both carriageways carrying a lane signal per lane and a sign board each way.', build: gantry },
  { id: 'road.slip', name: 'Slip road', zone: 'road', density: 'none', variant: 'sculpted', footprint: [6, 5], height: 3.0, sim: road(14), note: 'A lane peeling away from the main line on a curve, with the hatched nose between the two.', build: slipRoad },
  { id: 'road.viaduct', name: 'Viaduct', zone: 'road', density: 'none', variant: 'sculpted', footprint: [4, 5], height: 16.5, sim: road(44), note: 'Two-lane deck on tapered piers and crossheads, solid parapets, lit off the deck edge.', build: viaduct },
  { id: 'road.tjunction', name: 'T junction', zone: 'road', density: 'none', variant: 'sculpted', footprint: [4, 4], height: 3.7, sim: road(10), note: 'Side road meeting a through route, signalised, with give-way hatching and a zebra on the side arm.', build: tJunction },
  { id: 'road.mini', name: 'Mini roundabout', zone: 'road', density: 'none', variant: 'sculpted', footprint: [3, 3], height: 8.0, sim: road(7), note: 'Painted dome rather than a kerbed island, give-way triangles on all four arms, signs on every corner.', build: miniRoundabout },
  { id: 'road.buslane', name: 'Bus lane and stop', zone: 'road', density: 'none', variant: 'sculpted', footprint: [3, 4], height: 8.0, sim: road(9), note: 'Coloured bus lane with a marked stop cage, glazed shelter with a flag, passengers waiting.', build: busLane },
  { id: 'road.tram', name: 'Tramway', zone: 'road', density: 'none', variant: 'sculpted', footprint: [4, 4], height: 8.2, sim: road(24), note: 'Twin grooved tracks in the carriageway, ramped island platform between them, overhead line on span wires.', build: tramway },
  { id: 'road.cycle', name: 'Cycle track', zone: 'road', density: 'none', variant: 'sculpted', footprint: [3, 5], height: 7.0, sim: road(6), note: 'Kerb-separated two-way track with wands, its own signal, and a footway beyond it.', build: cycleTrack },
  { id: 'road.pedestrian', name: 'Pedestrian street', zone: 'road', density: 'none', variant: 'sculpted', footprint: [3, 4], height: 5.4, sim: road(8), note: 'Banded paving with no kerbs, bollards, benches, planted tubs and people walking down the middle.', build: pedestrianised },
  { id: 'road.alley', name: 'Service alley', zone: 'road', density: 'none', variant: 'sculpted', footprint: [2, 4], height: 3.6, sim: road(3), note: 'Narrow lane walled both sides with a central channel, roller shutters, bins and one bracketed lamp.', build: alley },
  { id: 'road.bays', name: 'Echelon parking', zone: 'road', density: 'none', variant: 'sculpted', footprint: [4, 4], height: 8.0, sim: road(6), note: 'Angled bays down one side with a marked-out strip, ticket machines and a footway build-out.', build: parkingBays },
  { id: 'road.carpark', name: 'Car park', zone: 'road', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 9.0, sim: road(11), note: 'Two rows of bays about a central aisle, planted island, twin-head lighting, barrier and ticket machine.', build: carPark },
  { id: 'road.crossing', name: 'Level crossing', zone: 'road', density: 'none', variant: 'sculpted', footprint: [4, 4], height: 3.2, sim: road(18), note: 'Railway across the road on a timber deck, two half barriers down, wig-wag lights and a relay hut.', build: levelCrossing },
  { id: 'road.tunnel', name: 'Tunnel portal', zone: 'road', density: 'none', variant: 'sculpted', footprint: [4, 6], height: 9.7, sim: road(40), note: 'Portal cut into an embankment: headwall, wing walls, coping, and a lit bore receding behind it.', build: tunnelPortal },
  { id: 'road.flyover', name: 'Flyover', zone: 'road', density: 'none', variant: 'sculpted', footprint: [5, 5], height: 15.0, sim: road(38), note: 'One road carried over another on abutments and embankments, with parapets and lighting on the deck.', build: flyover },
  { id: 'road.calming', name: 'Traffic calming', zone: 'road', density: 'none', variant: 'sculpted', footprint: [3, 4], height: 7.0, sim: road(5), note: 'Raised table with ramp markings, alternating planted build-outs forming a chicane, bollards and signs.', build: trafficCalming },
  { id: 'road.toll', name: 'Toll plaza', zone: 'road', density: 'none', variant: 'sculpted', footprint: [4, 4], height: 6.2, sim: road(22), note: 'Four lanes through booths on kerbed islands under a canopy, lane signals and rising barriers.', build: tollPlaza },
  { id: 'road.layby', name: 'Layby', zone: 'road', density: 'none', variant: 'sculpted', footprint: [3, 4], height: 8.0, sim: road(4), note: 'Tapered bay off the carriageway with a hardstanding, shelter, verge and a lorry stopped in it.', build: layby },
  { id: 'road.street', name: 'Residential street', zone: 'road', density: 'none', variant: 'sculpted', footprint: [3, 4], height: 7.0, sim: road(4), note: 'Two lanes and a parking strip, broken centre line, kerbs and paved footways, gullies, lit one side.', build: street },
  { id: 'road.avenue', name: 'Four-lane avenue', zone: 'road', density: 'none', variant: 'sculpted', footprint: [3, 4], height: 9.5, sim: road(9), note: 'Two lanes each way about a planted reservation, twin-arm lighting off the median, wide footways.', build: avenue },
  { id: 'road.crossroads', name: 'Signalised crossroads', zone: 'road', density: 'none', variant: 'sculpted', footprint: [4, 4], height: 3.7, sim: road(14), note: 'Four arms, stop lines, zebra crossings, a box junction, and a signal head on every corner.', build: crossroads },
  { id: 'road.roundabout', name: 'Roundabout', zone: 'road', density: 'none', variant: 'sculpted', footprint: [4, 4], height: 8.0, sim: road(12), note: 'Domed planted island, two circulatory lanes, give-way lines on four arms, chevron boards.', build: roundabout },
  { id: 'road.bridge', name: 'Beam bridge', zone: 'road', density: 'none', variant: 'sculpted', footprint: [3, 4], height: 14.5, sim: road(26), note: 'Deck on tapered piers, solid parapets with a rail, footway both sides, lit off the parapet.', build: beamBridge },
  { id: 'road.cablebridge', name: 'Cable-stayed bridge', zone: 'road', density: 'none', variant: 'sculpted', footprint: [3, 6], height: 37.6, sim: road(60), note: 'A-frame pylon with a twelve-stay fan, deck hung off the stays, warning light on the head.', build: cableBridge },
  { id: 'road.footbridge', name: 'Footbridge', zone: 'road', density: 'none', variant: 'sculpted', footprint: [4, 2], height: 9.1, sim: road(6), note: 'Ramped deck over a carriageway on slender piers, balustrades throughout, anti-throw screen over the road.', build: footbridge },
];
