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
import { parkedVehicle, figure } from './vehicles';

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
    parkedVehicle(m, 5101, half - 1.0, -9.0, 0);
    parkedVehicle(m, 5117, half - 1.0, 3.0, 0);
    parkedVehicle(m, 5131, -(half - 1.0), -2.0, 2);
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
    parkedVehicle(m, 5201, median / 2 + LANE * 0.5, -6.0, 0);
    parkedVehicle(m, 5213, median / 2 + LANE * 1.5, 4.0, 0, 'van');
    parkedVehicle(m, 5227, -(median / 2 + LANE * 0.5), 8.0, 2, 'bus');
    parkedVehicle(m, 5241, -(median / 2 + LANE * 1.5), -10.0, 2);
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
    parkedVehicle(m, 5301, LANE * 0.5, -(half + 5.0), 0);
    parkedVehicle(m, 5313, -LANE * 0.5, half + 6.0, 2);
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
    parkedVehicle(m, 5401, 0, -(island + LANE * 0.5), 0);
    parkedVehicle(m, 5417, island + LANE * 0.5, 0, 1);
    parkedVehicle(m, 5433, 0, island + LANE * 0.5, 2, 'van');
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
    parkedVehicle(m, 5501, LANE * 0.5, -5.0, 0);
    parkedVehicle(m, 5519, -LANE * 0.5, 6.0, 2, 'truck');
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
    parkedVehicle(m, 5601, LANE * 0.5, -8.0, 0);
    parkedVehicle(m, 5617, LANE * 0.5, 6.0, 0, 'bus');
    parkedVehicle(m, 5633, -LANE * 0.5, 0.0, 2);
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
    parkedVehicle(m, 5733, LANE * 0.5, -4.0, 1);
  }
  return m;
}

// ===================================================================== table

const road = (upkeep: number): AssetDef['sim'] => ({
  jobs: 0, powerKW: 0, waterM3: 0, garbagePerWeek: 0, pollution: 0, upkeep,
});

export const ROADS: AssetDef[] = [
  { id: 'road.street', name: 'Residential street', zone: 'road', density: 'none', variant: 'sculpted', footprint: [3, 4], height: 7.0, sim: road(4), note: 'Two lanes and a parking strip, broken centre line, kerbs and paved footways, gullies, lit one side.', build: street },
  { id: 'road.avenue', name: 'Four-lane avenue', zone: 'road', density: 'none', variant: 'sculpted', footprint: [3, 4], height: 9.5, sim: road(9), note: 'Two lanes each way about a planted reservation, twin-arm lighting off the median, wide footways.', build: avenue },
  { id: 'road.crossroads', name: 'Signalised crossroads', zone: 'road', density: 'none', variant: 'sculpted', footprint: [4, 4], height: 3.7, sim: road(14), note: 'Four arms, stop lines, zebra crossings, a box junction, and a signal head on every corner.', build: crossroads },
  { id: 'road.roundabout', name: 'Roundabout', zone: 'road', density: 'none', variant: 'sculpted', footprint: [4, 4], height: 8.0, sim: road(12), note: 'Domed planted island, two circulatory lanes, give-way lines on four arms, chevron boards.', build: roundabout },
  { id: 'road.bridge', name: 'Beam bridge', zone: 'road', density: 'none', variant: 'sculpted', footprint: [3, 4], height: 14.5, sim: road(26), note: 'Deck on tapered piers, solid parapets with a rail, footway both sides, lit off the parapet.', build: beamBridge },
  { id: 'road.cablebridge', name: 'Cable-stayed bridge', zone: 'road', density: 'none', variant: 'sculpted', footprint: [3, 6], height: 37.6, sim: road(60), note: 'A-frame pylon with a twelve-stay fan, deck hung off the stays, warning light on the head.', build: cableBridge },
  { id: 'road.footbridge', name: 'Footbridge', zone: 'road', density: 'none', variant: 'sculpted', footprint: [4, 2], height: 9.1, sim: road(6), note: 'Ramped deck over a carriageway on slender piers, balustrades throughout, anti-throw screen over the road.', build: footbridge },
];
