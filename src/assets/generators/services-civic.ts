/**
 * Civic services: education, government, parks.
 *
 * These are the three branches with a public face, so unlike the utilities
 * they do get a front elevation -- but a civic one, not a domestic one. The
 * vocabulary is a colonnade, a portico, a clock, a flag, a deep glazed
 * entrance under a cantilever, a sports hall with a curved roof, a bandstand.
 * Nothing here has a pitched tiled roof or a punched sash window; the asset
 * test fails a service asset that uses the housing materials at all.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import { parkedVehicle, figure } from './vehicles';
import type { Material } from '../mesh';
import type { Wall } from '../parts';
import {
  band, boxSign, dressRoof, entrance, fins, kerb, louvres, parapet, portal, railing,
  ribbon, roofClutter, serviceYard, windowGrid,
} from '../parts';

// -------------------------------------------------------------- shared parts

/** A stack of ribbon windows, one per floor. */
function ribbonStack(m: MeshBuilder, w: Wall, u0: number, u1: number, o: {
  floors: number; floorH: number; base: number; height: number;
}): void {
  for (let f = 0; f < o.floors; f++) {
    const y = o.base + f * o.floorH;
    ribbon(m, w, u0, u1, y, y + o.height, { head: f === o.floors - 1 });
  }
}

/**
 * A colonnade: round columns carrying an entablature.
 *
 * The oldest civic gesture there is, and the reason a courthouse never gets
 * mistaken for an office. Round columns, not square piers -- a square pier is
 * structure, a round column is rhetoric.
 */
function colonnade(m: MeshBuilder, x0: number, x1: number, z: number, base: number,
                   height: number, count: number, r = 0.5): void {
  const span = (x1 - x0) / (count - 1);
  for (let i = 0; i < count; i++) {
    const cx = x0 + i * span;
    m.box([cx - r * 1.5, base, z - r * 1.5], [cx + r * 1.5, base + 0.35, z + r * 1.5], MAT.STONE);
    m.cylinder(cx, z, r, base + 0.35, base + height - 0.5, 12, MAT.STONE, false);
    m.cylinder(cx, z, r * 1.18, base + height - 0.5, base + height - 0.2, 12, MAT.STONE, false);
    m.box([cx - r * 1.4, base + height - 0.2, z - r * 1.4], [cx + r * 1.4, base + height, z + r * 1.4],
      MAT.STONE);
  }
  m.box([x0 - r * 2.0, base + height, z - r * 1.8], [x1 + r * 2.0, base + height + 0.75, z + r * 1.8],
    MAT.STONE);
  m.box([x0 - r * 2.4, base + height + 0.75, z - r * 2.1],
        [x1 + r * 2.4, base + height + 1.05, z + r * 2.1], MAT.STONE);
}

/** A shallow barrel roof, faked with three facets. Sports halls and libraries. */
function barrel(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number,
                base: number, rise: number, mat: Material = MAT.METAL): void {
  // A real half-cylinder swept along z, with a gable end closing each end.
  //
  // It used to be three quads a side off a table of overlapping spans, with
  // the height pair swapped on one side and no ends at all -- an open fan of
  // angled slabs hanging over the yard, which is what the depot's salt barn
  // looked like from every angle but square on.
  const SEG = 8;
  const cx = (x0 + x1) / 2, r = (x1 - x0) / 2;
  const at = (k: number): [number, number] => {
    const t = (k / SEG) * Math.PI;
    return [cx - Math.cos(t) * r, base + Math.sin(t) * rise];
  };
  for (let k = 0; k < SEG; k++) {
    const [ax, ay] = at(k), [bx, by] = at(k + 1);
    m.quad([ax, ay, z1], [bx, by, z1], [bx, by, z0], [ax, ay, z0], mat);
  }
  // The two ends, as a fan from the springing line up to the vault.
  for (const [z, flip] of [[z0, true], [z1, false]] as const) {
    for (let k = 0; k < SEG; k++) {
      const [ax, ay] = at(k), [bx, by] = at(k + 1);
      const p: [number, number, number][] = [[ax, ay, z], [bx, by, z], [cx, base, z]];
      if (flip) m.tri(p[0], p[1], p[2], MAT.CONCRETE);
      else m.tri(p[2], p[1], p[0], MAT.CONCRETE);
    }
  }
  m.box([x0 - 0.4, base - 0.5, z0 - 0.4], [x1 + 0.4, base, z1 + 0.4], MAT.CONCRETE);
}

/** A clock face on a wall or a tower. Twelve marks and two hands. */
function clock(m: MeshBuilder, w: Wall, u: number, y: number, r: number): void {
  const p = w.plane + w.sign * 0.02;
  m.painted(TINT.ACCENT, () => {
    if (w.axis === 'z') m.cylinder(u, p, r, y - r, y + r, 16, MAT.STONE);
    else m.cylinder(p, u, r, y - r, y + r, 16, MAT.STONE);
  });
  m.painted(TINT.SIGN_LIT, () => {
    const q = w.plane + w.sign * 0.14;
    if (w.axis === 'z') {
      m.signFace([u - r * 0.86, y - r * 0.86, q], [u + r * 0.86, y - r * 0.86, q],
                 [u + r * 0.86, y + r * 0.86, q], [u - r * 0.86, y + r * 0.86, q], MAT.TRIM);
    } else {
      m.signFace([q, y - r * 0.86, u + r * 0.86], [q, y - r * 0.86, u - r * 0.86],
                 [q, y + r * 0.86, u - r * 0.86], [q, y + r * 0.86, u + r * 0.86], MAT.TRIM);
    }
  });
  m.painted(TINT.METAL_DARK, () => {
    const q = w.plane + w.sign * 0.2;
    for (const [len, wid, ang] of [[r * 0.5, 0.09, 1.1], [r * 0.75, 0.06, 4.0]] as const) {
      const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;
      const lo = [Math.min(0, dx) - wid, Math.min(0, dy) - wid];
      const hi = [Math.max(0, dx) + wid, Math.max(0, dy) + wid];
      if (w.axis === 'z') m.box([u + lo[0], y + lo[1], q - 0.05], [u + hi[0], y + hi[1], q + 0.05], MAT.TRIM);
      else m.box([q - 0.05, y + lo[1], u + lo[0]], [q + 0.05, y + hi[1], u + hi[0]], MAT.TRIM);
    }
  });
}

/** Flag on a pole. Government and schools both fly one. */
function flagpole(m: MeshBuilder, cx: number, base: number, cz: number, h: number): void {
  m.painted(TINT.METAL_DARK, () => m.box([cx - 0.09, base, cz - 0.09], [cx + 0.09, base + h, cz + 0.09], MAT.TRIM));
  m.painted(TINT.ACCENT, () => m.box([cx + 0.09, base + h - 2.4, cz - 0.04], [cx + 2.4, base + h - 1.1, cz + 0.04], MAT.TRIM));
  m.box([cx - 0.6, base, cz - 0.6], [cx + 0.6, base + 0.25, cz + 0.6], MAT.STONE);
}


/**
 * A railed perimeter: posts on a pitch with two horizontal rails.
 *
 * Every civic site in a city is fenced -- schools and depots because they have
 * to be, parks because the gate has to be somewhere. It reads at a distance as
 * the boundary of the plot, which is exactly what tells a service building
 * apart from a house sitting in an open garden.
 */
function perimeter(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number,
  h: number, pitch = 1.6, gap?: [number, number]): void {
  m.painted(TINT.METAL_DARK, () => {
    const runs: Array<[number, number, number, number]> = [
      [x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1],
    ];
    for (const [ax, az, bx, bz] of runs) {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(2, Math.round(len / pitch));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
        // Leave a gap where the vehicles get in.
        if (gap && az === z1 && bz === z1 && px > gap[0] && px < gap[1]) continue;
        m.box([px - 0.06, 0, pz - 0.06], [px + 0.06, h, pz + 0.06], MAT.TRIM);
      }
      for (const y of [h - 0.12, h * 0.45]) {
        m.box([Math.min(ax, bx) - 0.04, y, Math.min(az, bz) - 0.04],
              [Math.max(ax, bx) + 0.04, y + 0.08, Math.max(az, bz) + 0.04], MAT.TRIM);
      }
    }
  });
}

/** A lamp column: a civic street light, on its own base. */
function lamp(m: MeshBuilder, cx: number, cz: number, h = 5.0): void {
  m.painted(TINT.METAL_DARK, () => {
    m.box([cx - 0.24, 0, cz - 0.24], [cx + 0.24, 0.35, cz + 0.24], MAT.TRIM);
    m.cylinder(cx, cz, 0.09, 0.35, h, 6, MAT.TRIM, false);
  });
  m.painted(TINT.SIGN_LIT, () =>
    m.box([cx - 0.34, h, cz - 0.22], [cx + 0.34, h + 0.26, cz + 0.22], MAT.TRIM));
}

/** A bench. Parks and squares are mostly made of these. */
function bench(m: MeshBuilder, cx: number, cz: number, len: number, along: 'x' | 'z'): void {
  const hx = along === 'x' ? len / 2 : 0.28;
  const hz = along === 'x' ? 0.28 : len / 2;
  m.painted(TINT.WOOD, () => {
    m.box([cx - hx, 0.42, cz - hz], [cx + hx, 0.5, cz + hz], MAT.TRIM);
    // Backrest along the rear edge, whichever way the bench runs.
    if (along === 'x') m.box([cx - hx, 0.5, cz - hz], [cx + hx, 0.95, cz - hz + 0.12], MAT.TRIM);
    else m.box([cx - hx, 0.5, cz - hz], [cx - hx + 0.12, 0.95, cz + hz], MAT.TRIM);
  });
  m.painted(TINT.METAL_DARK, () => {
    for (const t of [-0.7, 0.7]) {
      const px = cx + (along === 'x' ? t * hx : 0);
      const pz = cz + (along === 'x' ? 0 : t * hz);
      m.box([px - 0.06, 0, pz - 0.22], [px + 0.06, 0.42, pz + 0.22], MAT.TRIM);
    }
  });
}

// ================================================================= education

/** Primary school: two low teaching wings round a yard, under one long canopy. */
function primarySchool(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 22.0, z = 17.0;
  const wall = 4.6;

  // Single-storey teaching range: a long clad block with a monopitch.
  m.box([-x + 1.0, 0, -z + 1.0], [x - 1.0, wall, -z + 9.0], MAT.CLADDING, { roof: MAT.TRIM });
  m.box([-x + 1.0, 0, -z + 9.0], [-x + 10.0, wall, z - 6.0], MAT.CLADDING, { roof: MAT.TRIM });
  // Hall: taller, with a barrel roof, at the junction.
  m.box([x - 14.0, 0, -z + 9.0], [x - 1.0, 7.4, -z + 19.0], MAT.CONCRETE);

  if (medium) {
    // Monopitch over the teaching range, falling to the yard.
    m.quad([-x + 1.0, wall + 1.6, -z + 1.0], [x - 1.0, wall + 1.6, -z + 1.0],
           [x - 1.0, wall + 0.2, -z + 9.4], [-x + 1.0, wall + 0.2, -z + 9.4], MAT.METAL);
    m.box([-x + 0.6, wall + 1.5, -z + 0.6], [x - 0.6, wall + 1.75, -z + 1.4], MAT.CONCRETE);
    m.quad([-x + 1.0, wall + 1.6, -z + 9.0], [-x + 1.0, wall + 0.2, z - 6.0],
           [-x + 10.4, wall + 0.2, z - 6.0], [-x + 10.4, wall + 1.6, -z + 9.0], MAT.METAL);
    barrel(m, x - 14.0, -z + 9.0, x - 1.0, -z + 19.0, 7.4, 2.6);
    // Canopy along the yard face, the piece a school is actually used through.
    m.box([-x + 1.0, 3.2, -z + 9.0], [x - 15.0, 3.5, -z + 12.0], MAT.CONCRETE);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 6; i++) {
        const px = -x + 3.0 + i * 5.4;
        m.box([px - 0.11, 0, -z + 11.6], [px + 0.11, 3.2, -z + 11.82], MAT.TRIM);
      }
    });
    m.painted(TINT.GREEN, () =>
      m.box([-x + 11.0, 0.001, -z + 13.0], [x - 1.0, 0.09, z - 1.0], MAT.TRIM));
  }
  if (fine) {
    // Classroom ribbons, floor to head, the full length of both wings.
    ribbon(m, { axis: 'z', sign: 1, plane: -z + 9.0 }, -x + 2.0, x - 16.0, 1.0, 3.4, { mullions: 10 });
    ribbon(m, { axis: 'z', sign: -1, plane: -z + 1.0 }, -x + 2.0, x - 2.0, 1.6, 3.2, { mullions: 12 });
    ribbon(m, { axis: 'x', sign: 1, plane: -x + 10.0 }, -z + 10.0, z - 7.0, 1.0, 3.4, { mullions: 8 });
    ribbon(m, { axis: 'x', sign: -1, plane: -x + 1.0 }, -z + 10.0, z - 7.0, 1.6, 3.2, { mullions: 8 });
    // Hall: high clerestory only, and a big door to the yard.
    ribbon(m, { axis: 'x', sign: -1, plane: x - 14.0 }, -z + 10.0, -z + 18.0, 5.0, 6.6);
    ribbon(m, { axis: 'z', sign: 1, plane: -z + 19.0 }, x - 13.0, x - 2.0, 5.0, 6.6);
    entrance(m, { axis: 'z', sign: 1, plane: -z + 19.0 }, x - 7.5,
      { width: 2.6, height: 3.0, double: true, glazed: true, canopy: 2.4 });
    entrance(m, { axis: 'z', sign: 1, plane: -z + 9.0 }, -x + 5.0,
      { width: 2.0, height: 2.6, double: true, glazed: true });
    boxSign(m, { axis: 'z', sign: 1, plane: -z + 9.0 }, -x + 8.0, -x + 14.0, 3.6, 4.5);
    flagpole(m, -x + 3.0, 0, z - 3.0, 8.0);
    // Play markings on the yard, and a ball court fence.
    m.painted(TINT.ACCENT, () => {
      m.box([-x + 13.0, 0.09, -z + 15.0], [x - 3.0, 0.11, -z + 15.2], MAT.TRIM);
      m.box([-x + 13.0, 0.09, z - 3.0], [x - 3.0, 0.11, z - 2.8], MAT.TRIM);
      m.box([-x + 13.0, 0.09, -z + 15.0], [-x + 13.2, 0.11, z - 2.8], MAT.TRIM);
      m.box([x - 3.2, 0.09, -z + 15.0], [x - 3.0, 0.11, z - 2.8], MAT.TRIM);
      m.cylinder((x - 3.0 + -x + 13.0) / 2, (z - 2.8 + -z + 15.0) / 2, 2.4, 0.09, 0.11, 16, MAT.TRIM, false);
    });
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 16; i++) {
        const px = -x + 13.0 + i * ((x - 16.0) / 16);
        m.box([px - 0.05, 0, z - 1.6], [px + 0.05, 3.4, z - 1.5], MAT.TRIM);
      }
      m.box([-x + 13.0, 3.25, z - 1.62], [x - 3.0, 3.35, z - 1.48], MAT.TRIM);
    });
    serviceYard(m, -x + 1.0, -x + 12.0, z - 5.5, 1201, { totem: true, flag: false });
    // Roof lights over the hall: the one thing that stops a barrel reading blank.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 4; i++) {
        const pz = -z + 11.0 + i * 2.0;
        m.box([x - 11.0, 9.8, pz - 0.5], [x - 4.0, 10.1, pz + 0.5], MAT.GLASS);
        m.box([x - 11.1, 9.7, pz - 0.62], [x - 3.9, 9.85, pz + 0.62], MAT.TRIM);
      }
      // Cycle stands by the small entrance.
      for (let i = 0; i < 6; i++) {
        const px = -x + 12.4 + i * 1.1;
        m.box([px - 0.05, 0, -z + 10.4], [px + 0.05, 0.85, -z + 10.5], MAT.TRIM);
        m.box([px - 0.05, 0.78, -z + 10.4], [px + 0.05, 0.85, -z + 11.5], MAT.TRIM);
        m.box([px - 0.05, 0, -z + 11.4], [px + 0.05, 0.85, -z + 11.5], MAT.TRIM);
      }
    });
    perimeter(m, -x + 0.4, -z + 0.4, x - 0.4, z - 0.4, 1.8, 2.2, [-x + 2.0, -x + 10.0]);
    kerb(m, -x, z, x, z + 0.4);
  }
  dressRoof(m, lod, 3413);
  return m;
}

/** High school: a three-storey teaching block and a barrel-roofed sports hall. */
function highSchool(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 24.0, z = 18.0;
  const floors = 3, floorH = 3.9;
  const h = floors * floorH;

  m.box([-x + 1.0, 0, -z + 2.0], [x - 13.0, h, -z + 15.0], MAT.CLADDING, { roof: MAT.ROOF });
  m.box([x - 13.0, 0, -z + 4.0], [x - 1.0, 9.5, -z + 17.0], MAT.CONCRETE);

  if (medium) {
    parapet(m, -x + 1.0, -z + 2.0, x - 13.0, -z + 15.0, h, 1.0, 0.34);
    for (let f = 1; f < floors; f++) {
      band(m, -x + 1.0, -z + 2.0, x - 13.0, -z + 15.0, f * floorH, 0.5, 0.28);
    }
    barrel(m, x - 13.0, -z + 4.0, x - 1.0, -z + 17.0, 9.5, 3.2);
    // Stair drum on the corner, and the entrance canopy.
    m.cylinder(-x + 1.0, -z + 8.5, 3.4, 0, h + 2.0, 16, MAT.CLADDING, false);
    parapet(m, -x - 2.4, -z + 5.1, -x + 4.4, -z + 11.9, h + 2.0, 0.9, 0.3);
    portal(m, -6.0, 4.0, -z + 15.0, 5.2, 3.0, 2);
    roofClutter(m, -x + 3, -z + 4, x - 15, -z + 13, h, 1211, 1.2);
  }
  if (fine) {
    for (const [wall, u0, u1] of [
      [{ axis: 'z', sign: 1, plane: -z + 15.0 } as Wall, -x + 2.4, x - 14.4],
      [{ axis: 'z', sign: -1, plane: -z + 2.0 } as Wall, -x + 2.4, x - 14.4],
      [{ axis: 'x', sign: 1, plane: x - 13.0 } as Wall, -z + 3.4, -z + 13.6],
    ] as const) {
      ribbonStack(m, wall, u0, u1, { floors, floorH, base: 1.2, height: 2.4 });
    }
    fins(m, { axis: 'z', sign: 1, plane: -z + 15.0 }, -x + 2.4, x - 14.4, 0.6, h - 0.4, 10, 0.5);
    for (let f = 0; f < floors; f++) {
      m.opening({ axis: 'z', sign: 1, plane: -z + 11.9, u0: -x - 1.4, u1: -x + 3.4,
        y0: 1.2 + f * floorH, y1: 3.4 + f * floorH, glass: MAT.GLASS, frame: 0.12, proud: 0.06 });
    }
    // Sports hall: a clerestory band and one very large door.
    ribbon(m, { axis: 'z', sign: 1, plane: -z + 17.0 }, x - 12.0, x - 2.0, 6.6, 8.6);
    ribbon(m, { axis: 'x', sign: 1, plane: x - 1.0 }, -z + 5.0, -z + 16.0, 6.6, 8.6);
    m.painted(TINT.METAL_DARK, () => {
      m.box([x - 10.0, 0, -z + 16.98], [x - 4.0, 4.6, -z + 17.16], MAT.TRIM);
      for (let g = 1; g < 9; g++) {
        m.box([x - 10.0, g * 0.5, -z + 17.16], [x - 4.0, g * 0.5 + 0.1, -z + 17.22], MAT.TRIM);
      }
    });
    entrance(m, { axis: 'z', sign: 1, plane: -z + 15.0 }, -1.0,
      { width: 3.2, height: 3.2, double: true, glazed: true });
    boxSign(m, { axis: 'z', sign: 1, plane: -z + 15.0 }, -6.0, 4.0, h + 0.2, h + 1.4);
    flagpole(m, -x + 8.0, 0, z - 8.0, 9.0);
    // All-weather pitch with its fence and floodlights.
    m.painted(TINT.GREEN, () => m.box([-x + 2.0, 0.001, z - 12.0], [x - 2.0, 0.09, z - 1.0], MAT.TRIM));
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 22; i++) {
        const px = -x + 2.0 + i * ((2 * x - 4.0) / 22);
        m.box([px - 0.05, 0, z - 1.1], [px + 0.05, 4.0, z - 1.0], MAT.TRIM);
      }
      m.box([-x + 2.0, 3.85, z - 1.12], [x - 2.0, 3.95, z - 0.98], MAT.TRIM);
      for (const px of [-x + 6.0, 0.0, x - 6.0] as const) {
        m.box([px - 0.14, 0, z - 12.6], [px + 0.14, 11.0, z - 12.32], MAT.TRIM);
        m.box([px - 1.3, 11.0, z - 12.8], [px + 1.3, 11.5, z - 12.2], MAT.TRIM);
      }
    });
    serviceYard(m, -x + 1.0, x - 14.0, -z + 15.0, 1213, { flag: false });
    kerb(m, -x, z, x, z + 0.4);
  }
  dressRoof(m, lod, 3420);
  return m;
}

/** University block: a stone-faced range round a quadrangle, with a tower. */
function university(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 24.0, z = 18.4, t = 9.0;
  const floors = 4, floorH = 4.0;
  const h = floors * floorH;

  // Three ranges round a court, in stone: a university is old on purpose.
  m.box([-x + 1.0, 0, -z + 1.0], [x - 1.0, h, -z + 1.0 + t], MAT.STONE, { roof: MAT.ROOF });
  m.box([-x + 1.0, 0, -z + 1.0 + t], [-x + 1.0 + t, h, z - 4.0], MAT.STONE, { roof: MAT.ROOF });
  m.box([x - 1.0 - t, 0, -z + 1.0 + t], [x - 1.0, h, z - 4.0], MAT.STONE, { roof: MAT.ROOF });

  if (medium) {
    for (const [a, b, c, d] of [
      [-x + 1.0, -z + 1.0, x - 1.0, -z + 1.0 + t],
      [-x + 1.0, -z + 1.0 + t, -x + 1.0 + t, z - 4.0],
      [x - 1.0 - t, -z + 1.0 + t, x - 1.0, z - 4.0],
    ] as const) {
      parapet(m, a, b, c, d, h, 1.4, 0.42);
      band(m, a, b, c, d, floorH - 0.4, 0.5, 0.34);
      band(m, a, b, c, d, h - 1.6, 0.7, 0.46);
    }
    // Gate tower on the centre of the front range.
    m.box([-5.0, 0, -z + 0.4], [5.0, h + 8.0, -z + 1.0 + t + 0.6], MAT.STONE, { roof: MAT.ROOF });
    parapet(m, -5.0, -z + 0.4, 5.0, -z + 1.0 + t + 0.6, h + 8.0, 1.8, 0.5);
    for (const sx of [-1, 1] as const) {
      m.box([sx * 5.0 - sx * 1.4, 0, -z + 0.2], [sx * 5.0 + sx * 0.3, h + 10.2, -z + 1.0 + t + 0.8],
        MAT.STONE, { roof: MAT.ROOF });
    }
    m.painted(TINT.GREEN, () =>
      m.box([-x + 2.0 + t, 0.001, -z + 2.0 + t], [x - 2.0 - t, 0.09, z - 5.0], MAT.TRIM));
    roofClutter(m, -x + 3, -z + 2, -6.0, -z + t, h, 1221, 0.4);
  }
  if (fine) {
    // Tall stone-mullioned windows: not domestic sashes, but not ribbons
    // either -- this is the one service that earns a punched opening.
    for (const [wall, u0, u1, n] of [
      [{ axis: 'z', sign: -1, plane: -z + 1.0 } as Wall, -x + 2.4, x - 2.4, 12],
      [{ axis: 'z', sign: 1, plane: -z + 1.0 + t } as Wall, -x + 2.4, -6.0, 4],
      [{ axis: 'z', sign: 1, plane: -z + 1.0 + t } as Wall, 6.0, x - 2.4, 4],
      [{ axis: 'x', sign: 1, plane: -x + 1.0 + t } as Wall, -z + 2.4 + t, z - 5.4, 5],
      [{ axis: 'x', sign: -1, plane: x - 1.0 - t } as Wall, -z + 2.4 + t, z - 5.4, 5],
    ] as const) {
      for (let f = 0; f < floors; f++) {
        for (let i = 0; i < n; i++) {
          const c = u0 + ((i + 0.5) / n) * (u1 - u0);
          m.opening({ axis: wall.axis, sign: wall.sign, plane: wall.plane,
            u0: c - 0.85, u1: c + 0.85, y0: f * floorH + 1.1, y1: f * floorH + 3.3,
            glass: MAT.GLASS, frame: 0.2, proud: 0.09 });
          m.painted(TINT.METAL_DARK, () => {
            const p = wall.plane + wall.sign * 0.16;
            if (wall.axis === 'z') m.box([c - 0.05, f * floorH + 1.1, p - 0.03], [c + 0.05, f * floorH + 3.3, p + 0.03], MAT.TRIM);
            else m.box([p - 0.03, f * floorH + 1.1, c - 0.05], [p + 0.03, f * floorH + 3.3, c + 0.05], MAT.TRIM);
          });
        }
      }
    }
    // The gate: an arch, doors under it, and a clock over.
    m.opening({ axis: 'z', sign: -1, plane: -z + 0.4, u0: -2.6, u1: 2.6, y0: 0.4, y1: 5.4,
      glass: MAT.TRIM, frame: 0.34, proud: 0.16 });
    entrance(m, { axis: 'z', sign: -1, plane: -z + 0.4 }, 0,
      { width: 3.0, height: 3.6, double: true, steps: 2 });
    clock(m, { axis: 'z', sign: -1, plane: -z + 0.2 }, 0, h + 4.4, 2.1);
    flagpole(m, 0, h + 9.8, -z + 5.0, 6.0);
    // Cloister arcade round two sides of the quad.
    colonnade(m, -x + 3.0 + t, x - 3.0 - t, -z + 2.2 + t, 0, 4.6, 8, 0.4);
    boxSign(m, { axis: 'z', sign: -1, plane: -z + 0.4 }, -4.4, 4.4, 6.0, 7.2);
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

/** Library: a barrel-roofed reading room over a stone plinth. */
/**
 * A college campus: a landmark, not a building.
 *
 * The university is one quadrangle on six by five cells; this is the whole
 * institution -- a main hall with a portico and a dome facing a lawn, a
 * library and a science range down either side, halls of residence behind, and
 * the paths, trees and benches that make a quad a quad. Ten by nine cells,
 * which is the largest thing in the library, and deliberately so: a player
 * places one of these and it becomes the middle of that part of the city.
 *
 * The parts are the same colonnade, clock and flagpole the rest of the civic
 * set is built from, so it belongs to the same world as the city hall.
 */
function collegeCampus(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 56.0, z = 48.0;

  /**
   * A span mirrored to one side, written lo-to-hi.
   *
   * Writing a mirrored box as sx * a to sx * b gives min greater than max on
   * the left, and a box with its corners the wrong way round comes out inside
   * out -- which is what turned the left half of this campus into open black
   * shells the first time.
   */
  const span = (a: number, b: number, sx: number): [number, number] =>
    sx > 0 ? [a, b] : [-b, -a];

  m.box([-x, 0.0005, -z], [x, 0.1, z], MAT.CONCRETE);
  // The lawn the whole campus faces, with its cross paths and diagonals.
  m.painted(TINT.GREEN, () => m.box([-30.0, 0.1, -18.0], [30.0, 0.18, 26.0], MAT.TRIM));
  m.box([-2.6, 0.1, -18.0], [2.6, 0.2, 26.0], MAT.GROUND);
  m.box([-30.0, 0.1, 1.4], [30.0, 0.2, 6.0], MAT.GROUND);
  m.box([-30.0, 0.1, 21.0], [30.0, 0.2, 24.4], MAT.GROUND);

  // Old Main: a long stone hall on a plinth, portico and dome on the axis.
  const mh = 19.0;
  m.box([-27.0, 0.1, -44.0], [27.0, 1.8, -19.0], MAT.STONE);
  m.box([-25.0, 1.8, -43.0], [25.0, mh, -20.0], MAT.STONE, { roof: MAT.ROOF });
  // End pavilions, taller, which is what stops a long range reading as a wall.
  for (const sx of [-1, 1] as const) {
    const [px0, px1] = span(16.0, 25.0, sx);
    m.box([px0, 1.8, -44.0], [px1, mh + 3.4, -20.0], MAT.STONE, { roof: MAT.ROOF });
  }
  // The centre bay steps forward and up, and carries the dome.
  m.box([-9.0, 1.8, -30.0], [9.0, mh + 4.5, -19.4], MAT.STONE, { roof: MAT.ROOF });
  m.cylinder(0, -24.7, 7.4, mh + 4.5, mh + 6.0, 16, MAT.STONE, true);
  m.cylinder(0, -24.7, 6.4, mh + 6.0, mh + 11.6, 16, MAT.STONE, false);
  m.cone(0, -24.7, 6.6, 0.0, mh + 11.6, mh + 21.0, 16, MAT.ROOF);
  m.cylinder(0, -24.7, 0.6, mh + 21.0, mh + 25.4, 8, MAT.STONE, true);

  // Teaching ranges down both sides of the lawn, in two blocks each with a
  // link between them, so the quad has a colonnaded edge rather than a slab.
  for (const sx of [-1, 1] as const) {
    const [rx0, rx1] = span(32.0, 48.0, sx);
    for (const [z0, z1] of [[-16.0, 2.0], [8.0, 26.0]] as const) {
      m.box([rx0, 0.1, z0], [rx1, 15.4, z1], MAT.STONE, { roof: MAT.ROOF });
      m.box([rx0 - 0.7, 0.1, z0 - 0.7], [rx1 + 0.7, 1.6, z1 + 0.7], MAT.STONE);
    }
    const [lx0, lx1] = span(34.0, 44.0, sx);
    m.box([lx0, 0.1, 2.0], [lx1, 9.6, 8.0], MAT.STONE, { roof: MAT.ROOF });
  }
  // The library at the south end, in two wings either side of an open
  // gateway. It used to be one solid range closing the quad, which made the
  // whole campus read as a walled compound -- you could see no way into it.
  // Now the axis runs straight out through an arch, and the quad has a front
  // door rather than a back wall.
  m.box([-24.0, 0.1, 30.0], [24.0, 2.2, 46.0], MAT.STONE);
  for (const sx of [-1, 1] as const) {
    const [lx0, lx1] = span(6.0, 21.0, sx);
    m.box([lx0, 2.2, 31.0], [lx1, 17.0, 45.0], MAT.STONE, { roof: MAT.ROOF });
  }
  // The gateway between them: a deep arch carrying a linking storey over it.
  m.box([-6.0, 9.6, 31.0], [6.0, 17.0, 45.0], MAT.STONE, { roof: MAT.ROOF });
  for (const sx of [-1, 1] as const) {
    const [gx0, gx1] = span(4.4, 6.0, sx);
    m.box([gx0, 2.2, 31.0], [gx1, 9.6, 45.0], MAT.STONE);
  }
  // Halls of residence out on the flanks, behind the ranges.
  for (const sx of [-1, 1] as const) {
    for (const [z0, z1] of [[-44.0, -30.0], [-8.0, 8.0]] as const) {
      const [hx0, hx1] = span(38.0, 52.0, sx);
      m.box([hx0, 0.1, z0], [hx1, 21.0, z1], MAT.CLADDING, { roof: MAT.ROOF });
    }
  }

  if (medium) {
    band(m, -25.0, -43.0, 25.0, -20.0, mh - 1.8, 1.1, 0.5);
    parapet(m, -25.0, -43.0, 25.0, -20.0, mh, 1.4, 0.36);
    // The portico: a deep colonnade and a pediment over the centre bay.
    colonnade(m, -7.8, 7.8, -18.6, 1.8, 14.0, 8, 0.72);
    m.gable([-10.2, 17.8, -20.0], [10.2, 17.8, -17.2], 3.2, 'x', MAT.ROOF, MAT.STONE);
    // Steps up to it, narrowing as they rise.
    for (let i = 0; i < 10; i++) {
      m.box([-12.5, 0.1 + i * 0.17, -19.4], [12.5, 0.1 + (i + 1) * 0.17, -13.0 - i * 0.5],
        MAT.STONE);
    }
    for (const sx of [-1, 1] as const) {
      const [rx0, rx1] = span(32.0, 48.0, sx);
      for (const [z0, z1] of [[-16.0, 2.0], [8.0, 26.0]] as const) {
        band(m, rx0, z0, rx1, z1, 15.4, 0.9, 0.36, MAT.STONE);
        parapet(m, rx0, z0, rx1, z1, 15.4, 1.1, 0.3, MAT.STONE);
      }
      // A projecting entrance bay on each range's inner face.
      const [bx0, bx1] = span(30.4, 32.4, sx);
      m.box([bx0, 0.1, -9.0], [bx1, 10.5, -3.0], MAT.STONE, { roof: MAT.ROOF });
      m.box([bx0, 0.1, 14.0], [bx1, 10.5, 20.0], MAT.STONE, { roof: MAT.ROOF });
      for (const [z0, z1] of [[-44.0, -30.0], [-8.0, 8.0]] as const) {
        const [hx0, hx1] = span(38.0, 52.0, sx);
        parapet(m, hx0, z0, hx1, z1, 21.0, 1.0, 0.26, MAT.CONCRETE);
      }
    }
    band(m, -21.0, 31.0, 21.0, 45.0, 15.4, 1.0, 0.4, MAT.STONE);
    parapet(m, -21.0, 31.0, 21.0, 45.0, 17.0, 1.3, 0.34, MAT.STONE);
    // A colonnade across each wing, stopping short of the gateway.
    for (const sx of [-1, 1] as const) {
      const [cx0, cx1] = span(7.5, 19.5, sx);
      colonnade(m, cx0, cx1, 30.2, 2.2, 11.5, 4, 0.6);
    }
    // Avenue trees down both sides of the lawn.
    for (let i = 0; i < 6; i++) {
      const pz = -14.0 + i * 7.6;
      for (const sx of [-1, 1] as const) {
        m.painted(TINT.WOOD, () => m.cylinder(sx * 24.0, pz, 0.3, 0.18, 2.6, 6, MAT.TIMBER));
        m.painted(TINT.GREEN, () => m.cone(sx * 24.0, pz, 3.0, 0.7, 2.6, 9.0, 7, MAT.TRIM));
      }
    }
    flagpole(m, 0, 0.2, 14.0, 14.0);
  }
  if (fine) {
    // Old Main: four storeys of tall lights, skipping the portico bay.
    for (let i = 0; i < 16; i++) {
      const cx = -23.4 + i * 3.12;
      if (Math.abs(cx) < 10.0) continue;
      m.opening({ axis: 'z', sign: 1, plane: -20.0, u0: cx - 0.9, u1: cx + 0.9,
        y0: 3.0, y1: 6.4, glass: MAT.GLASS, frame: 0.18, proud: 0.09 });
      m.opening({ axis: 'z', sign: 1, plane: -20.0, u0: cx - 0.9, u1: cx + 0.9,
        y0: 8.4, y1: 11.8, glass: MAT.GLASS, frame: 0.18, proud: 0.09 });
      m.opening({ axis: 'z', sign: 1, plane: -20.0, u0: cx - 0.9, u1: cx + 0.9,
        y0: 13.4, y1: 16.4, glass: MAT.GLASS, frame: 0.18, proud: 0.09 });
    }
    // Dome windows, so it is a lantern and not a lump.
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * Math.PI * 2;
      m.painted(TINT.METAL_DARK, () =>
        m.box([Math.cos(t) * 6.3 - 0.34, mh + 6.8, -24.7 + Math.sin(t) * 6.3 - 0.34],
              [Math.cos(t) * 6.3 + 0.34, mh + 10.6, -24.7 + Math.sin(t) * 6.3 + 0.34],
              MAT.TRIM));
    }
    entrance(m, { axis: 'z', sign: 1, plane: -19.4 }, 0,
      { width: 4.0, height: 4.6, double: true, glazed: true });
    clock(m, { axis: 'z', sign: 1, plane: -19.4 }, 0, 19.4, 1.9);
    // The ranges, inner and outer faces.
    for (const sx of [-1, 1] as const) {
      for (const [z0, z1] of [[-16.0, 2.0], [8.0, 26.0]] as const) {
        for (const [sign, plane] of [[1, sx * 32.0], [-1, sx * 48.0]] as const) {
          windowGrid(m, { axis: 'x', sign: (sx * sign) as 1 | -1, plane },
            z0 + 1.6, z1 - 1.6,
            { floors: 4, floorH: 3.4, base: 2.4, count: 5, width: 1.3, height: 1.9 });
        }
      }
      // The ranges' end walls, which face out along the campus edges and were
      // the one blank thing left on it.
      for (const [z0, z1] of [[-16.0, 2.0], [8.0, 26.0]] as const) {
        const [rx0, rx1] = span(32.0, 48.0, sx);
        // The outward end only: the inner ends face the link block and are
        // barely visible, and four storeys of glazing is not cheap.
        const outward = z0 < 0 ? ([-1, z0] as const) : ([1, z1] as const);
        windowGrid(m, { axis: 'z', sign: outward[0], plane: outward[1] },
          rx0 + 2.6, rx1 - 2.6,
          { floors: 4, floorH: 3.4, base: 2.4, count: 2, width: 1.3, height: 1.9 });
      }
      entrance(m, { axis: 'x', sign: (-sx) as 1 | -1, plane: sx * 30.4 }, -6.0,
        { width: 2.0, height: 3.2, double: true, steps: 2 });
      entrance(m, { axis: 'x', sign: (-sx) as 1 | -1, plane: sx * 30.4 }, 17.0,
        { width: 2.0, height: 3.2, double: true, steps: 2 });
      // Halls of residence: six storeys, plainer, as they should be.
      for (const [z0, z1] of [[-44.0, -30.0], [-8.0, 8.0]] as const) {
        const [hx0] = span(38.0, 52.0, sx);
        windowGrid(m, { axis: 'x', sign: (-sx) as 1 | -1, plane: sx * 38.0 },
          z0 + 1.4, z1 - 1.4,
          { floors: 6, floorH: 3.3, base: 1.8, count: 4, width: 1.2, height: 1.6 });
        // One tall slot up each end instead of a grid: it reads as a stair
        // and it costs a twentieth of what six storeys of windows do.
        m.painted(TINT.METAL_DARK, () => {
          for (const zz of [z0, z1] as const) {
            m.box([hx0 + 5.4, 2.0, zz - 0.12], [hx0 + 8.6, 19.4, zz + 0.12], MAT.TRIM);
          }
        });
      }
    }
    // The library's reading-room windows, tall between the columns.
    for (const sx of [-1, 1] as const) {
      for (let i = 0; i < 3; i++) {
        const cx = sx * (8.6 + i * 5.2);
        m.opening({ axis: 'z', sign: -1, plane: 31.0, u0: cx - 1.1, u1: cx + 1.1,
          y0: 4.0, y1: 12.6, glass: MAT.GLASS, frame: 0.22, proud: 0.11 });
      }
      entrance(m, { axis: 'z', sign: -1, plane: 31.0 }, sx * 13.0,
        { width: 2.4, height: 3.6, double: true, glazed: true });
    }
    // The gateway's own arch head, so the opening reads as a way through.
    m.painted(TINT.METAL_DARK, () =>
      m.box([-4.4, 9.0, 30.9], [4.4, 9.6, 45.1], MAT.TRIM));
    // The path continues out through it.
    m.box([-2.6, 0.1, 26.0], [2.6, 0.2, z], MAT.GROUND);
    // Benches round the lawn, lamps along the axis, students on the paths.
    for (let i = 0; i < 4; i++) {
      bench(m, -20.0, -8.0 + i * 8.0, 2.4, 'z');
      bench(m, 20.0, -8.0 + i * 8.0, 2.4, 'z');
    }
    for (const px of [-26.0, -9.0, 9.0, 26.0]) lamp(m, px, 3.7, 5.6);
    figure(m, 7701, -1.4, 12.0, 0, { stride: 0.16, bag: true });
    figure(m, 7708, 1.6, 4.0, Math.PI, { stride: 0.13 });
    figure(m, 7715, -12.0, 3.7, Math.PI / 2, { bag: true });
    figure(m, 7722, 14.0, -6.0, -Math.PI / 2, { stride: 0.15 });
    // Visitor parking off the front, outside the portico steps.
    for (let i = 0; i < 3; i++) {
      parkedVehicle(m, 7740 + i * 11, -14.0 + i * 7.0, -47.0, 1, 'car');
    }
    kerb(m, -x + 2.0, -z + 0.6, x - 2.0, -z + 1.6);
  }
  return m;
}

function library(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 16.6, z = 14.0;
  const w = 25.2, d = 17.0, plinth = 1.2, wallH = 9.5;

  m.box([-w / 2, 0, -d / 2 - 1.0], [w / 2, plinth, d / 2 - 1.0], MAT.STONE);
  m.box([-w / 2 + 0.8, plinth, -d / 2 - 0.2], [w / 2 - 0.8, wallH, d / 2 - 1.8], MAT.CLADDING);

  if (medium) {
    barrel(m, -w / 2 + 0.8, -d / 2 - 0.2, w / 2 - 0.8, d / 2 - 1.8, wallH, 3.4, MAT.METAL);
    // Fins the full height between the bays: the reading room's rhythm.
    fins(m, { axis: 'z', sign: 1, plane: d / 2 - 1.8 }, -w / 2 + 1.4, w / 2 - 1.4, plinth, wallH, 8, 0.55);
    fins(m, { axis: 'z', sign: -1, plane: -d / 2 - 0.2 }, -w / 2 + 1.4, w / 2 - 1.4, plinth, wallH, 8, 0.55);
    // Entrance pavilion: a glazed box pushed out of the plinth.
    m.box([-5.0, 0, d / 2 - 1.8], [5.0, 5.6, d / 2 + 3.0], MAT.GLASS, { roof: MAT.TRIM });
    m.box([-5.6, 5.6, d / 2 - 2.4], [5.6, 6.2, d / 2 + 3.6], MAT.CONCRETE);
    roofClutter(m, -w / 2 + 3, -d / 2 + 2, w / 2 - 3, d / 2 - 4, wallH + 3.4, 1231, 0.3);
  }
  if (fine) {
    // Tall glazing between the fins, floor to eaves.
    for (let i = 0; i < 8; i++) {
      const a = -w / 2 + 1.4 + (i / 8) * (w - 2.8) + 0.35;
      const b = -w / 2 + 1.4 + ((i + 1) / 8) * (w - 2.8) - 0.35;
      for (const [sign, plane] of [[1, d / 2 - 1.8], [-1, -d / 2 - 0.2]] as const) {
        m.opening({ axis: 'z', sign, plane, u0: a, u1: b, y0: plinth + 0.9, y1: wallH - 0.8,
          glass: MAT.GLASS, frame: 0.12, proud: 0.06 });
      }
    }
    ribbon(m, { axis: 'x', sign: 1, plane: w / 2 - 0.8 }, -d / 2 + 0.6, d / 2 - 2.6, plinth + 1.4, wallH - 1.4);
    ribbon(m, { axis: 'x', sign: -1, plane: -w / 2 + 0.8 }, -d / 2 + 0.6, d / 2 - 2.6, plinth + 1.4, wallH - 1.4);
    m.windowRow({ axis: 'z', sign: 1, plane: d / 2 + 3.0, from: -4.4, to: 4.4, y0: 0.6, y1: 4.6,
      count: 3, width: 2.4, glass: MAT.SHOPFRONT, frame: 0.12, proud: 0.07 });
    entrance(m, { axis: 'z', sign: 1, plane: d / 2 + 3.0 }, 0,
      { width: 2.8, height: 3.2, double: true, glazed: true, steps: 2 });
    boxSign(m, { axis: 'z', sign: 1, plane: d / 2 + 3.0 }, -4.0, 4.0, 4.8, 5.8);
    // Book stacks visible through the glass: the reason for all that glazing.
    m.painted(TINT.WOOD, () => {
      for (let i = 0; i < 5; i++) {
        const cx = -9.0 + i * 4.5;
        m.box([cx - 1.6, plinth, -3.0], [cx + 1.6, plinth + 2.4, 2.0], MAT.TRIM);
      }
    });
    serviceYard(m, -w / 2, w / 2, d / 2 + 3.0, 1233, { cycles: true, bins: false });
    railing(m, -x + 1.0, x - 1.0, z - 1.0, 0, 0.95, 1.4);
    // Balusters round the plinth: the library's one piece of civic ceremony.
    for (let i = 0; i <= 26; i++) {
      const px = -w / 2 + (i / 26) * w;
      m.box([px - 0.09, plinth, d / 2 - 1.28], [px + 0.09, plinth + 0.8, d / 2 - 1.12], MAT.STONE);
      m.box([px - 0.09, plinth, -d / 2 - 0.88], [px + 0.09, plinth + 0.8, -d / 2 - 0.72], MAT.STONE);
    }
    m.box([-w / 2, plinth + 0.8, d / 2 - 1.34], [w / 2, plinth + 0.96, d / 2 - 1.06], MAT.STONE);
    m.box([-w / 2, plinth + 0.8, -d / 2 - 0.94], [w / 2, plinth + 0.96, -d / 2 - 0.66], MAT.STONE);
    for (const sx of [-1, 1] as const) {
      lamp(m, sx * 7.0, d / 2 + 4.6, 4.4);
      bench(m, sx * 9.0, d / 2 + 3.4, 2.6, 'x');
    }
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

// ================================================================ government

/** City hall: a stone block with a portico, a dome-lantern and a flag. */
function cityHall(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 24.0, z = 19.0;
  const w = 34.0, d = 20.0;
  const base = 6.5, upper = 5.5;
  const h = base + upper * 2;

  m.box([-w / 2, 0, -d / 2 - 1.0], [w / 2, h, d / 2 - 1.0], MAT.STONE, { roof: MAT.ROOF });
  // Centre bay forward and up, end pavilions slightly forward.
  m.box([-8.0, 0, d / 2 - 1.6], [8.0, h + 3.0, d / 2 + 1.4], MAT.STONE, { roof: MAT.ROOF });
  for (const sx of [-1, 1] as const) {
    const a = Math.min(sx * w / 2, sx * w / 2 - sx * 6.0);
    const b = Math.max(sx * w / 2, sx * w / 2 - sx * 6.0);
    m.box([a, 0, d / 2 - 1.6], [b, h + 1.2, d / 2 + 0.6], MAT.STONE, { roof: MAT.ROOF });
  }

  if (medium) {
    band(m, -w / 2, -d / 2 - 1.0, w / 2, d / 2 - 1.0, base, 0.8, 0.5);
    band(m, -w / 2, -d / 2 - 1.0, w / 2, d / 2 - 1.0, h - 2.0, 1.0, 0.6);
    parapet(m, -w / 2, -d / 2 - 1.0, w / 2, d / 2 - 1.0, h, 1.4, 0.36);
    parapet(m, -8.0, d / 2 - 1.6, 8.0, d / 2 + 1.4, h + 3.0, 1.4, 0.44);
    // Lantern over the centre: an octagonal drum with a cap.
    m.cylinder(0, d / 2 - 0.1, 4.6, h + 4.4, h + 6.0, 8, MAT.STONE, false);
    m.cylinder(0, d / 2 - 0.1, 3.9, h + 6.0, h + 11.5, 8, MAT.STONE, false);
    m.cone(0, d / 2 - 0.1, 4.3, 0.7, h + 11.5, h + 16.0, 8, MAT.METAL);
    m.cylinder(0, d / 2 - 0.1, 0.5, h + 16.0, h + 17.4, 8, MAT.METAL);
    // Wide flight of steps to the portico.
    for (let i = 0; i < 9; i++) {
      m.box([-11.0, i * 0.18, d / 2 + 1.4 + i * 0.36], [11.0, (i + 1) * 0.18, d / 2 + 5.0], MAT.STONE);
    }
    roofClutter(m, -w / 2 + 4, -d / 2 + 1, w / 2 - 4, -d / 2 + 5, h, 1241, 0.3);
  }
  if (fine) {
    colonnade(m, -6.4, 6.4, d / 2 + 3.0, base * 0.28, base + upper - 1.2, 6, 0.62);
    // Pediment over the colonnade.
    m.gable([-8.4, base * 0.28 + base + upper - 0.15, d / 2 + 1.6],
            [8.4, base * 0.28 + base + upper - 0.15, d / 2 + 4.4], 2.4, 'x', MAT.ROOF, MAT.STONE);
    for (const [wall, u0, u1, n] of [
      [{ axis: 'z', sign: 1, plane: d / 2 - 1.0 } as Wall, -w / 2 + 2.0, -9.0, 4],
      [{ axis: 'z', sign: 1, plane: d / 2 - 1.0 } as Wall, 9.0, w / 2 - 2.0, 4],
      [{ axis: 'z', sign: -1, plane: -d / 2 - 1.0 } as Wall, -w / 2 + 2.0, w / 2 - 2.0, 11],
      [{ axis: 'x', sign: 1, plane: w / 2 } as Wall, -d / 2 + 0.6, d / 2 - 2.6, 6],
      [{ axis: 'x', sign: -1, plane: -w / 2 } as Wall, -d / 2 + 0.6, d / 2 - 2.6, 6],
    ] as const) {
      for (let f = 0; f < 2; f++) {
        for (let i = 0; i < n; i++) {
          const c = u0 + ((i + 0.5) / n) * (u1 - u0);
          const y = base + f * upper + 1.0;
          m.opening({ axis: wall.axis, sign: wall.sign, plane: wall.plane,
            u0: c - 0.95, u1: c + 0.95, y0: y, y1: y + 3.0,
            glass: MAT.GLASS, frame: 0.22, proud: 0.1 });
        }
      }
      // Ground floor: smaller, square openings in a rusticated base.
      for (let i = 0; i < n; i++) {
        const c = u0 + ((i + 0.5) / n) * (u1 - u0);
        m.opening({ axis: wall.axis, sign: wall.sign, plane: wall.plane,
          u0: c - 0.8, u1: c + 0.8, y0: 2.2, y1: 4.4, glass: MAT.GLASS, frame: 0.24, proud: 0.11 });
      }
    }
    entrance(m, { axis: 'z', sign: 1, plane: d / 2 + 1.4 }, 0,
      { width: 3.6, height: 4.4, double: true });
    clock(m, { axis: 'z', sign: 1, plane: d / 2 + 1.4 }, 0, h + 1.6, 1.9);
    flagpole(m, -10.0, h + 1.2, d / 2 + 0.0, 9.0);
    flagpole(m, 10.0, h + 1.2, d / 2 + 0.0, 9.0);
    railing(m, -13.0, 13.0, d / 2 + 5.0, 0, 1.1, 1.6);
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

/** Courthouse: a blind stone box on a podium, entered up a flight of steps. */
function courthouse(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 20.0, z = 16.0;
  const w = 26.0, d = 17.0;
  const podium = 4.2, body = 13.0;

  m.box([-w / 2, 0, -d / 2 - 1.0], [w / 2, podium, d / 2 - 1.0], MAT.STONE);
  m.box([-w / 2 + 1.2, podium, -d / 2 + 0.2], [w / 2 - 1.2, podium + body, d / 2 - 2.2],
    MAT.STONE, { roof: MAT.ROOF });

  if (medium) {
    band(m, -w / 2 + 1.2, -d / 2 + 0.2, w / 2 - 1.2, d / 2 - 2.2, podium + body - 1.8, 1.2, 0.55);
    parapet(m, -w / 2 + 1.2, -d / 2 + 0.2, w / 2 - 1.2, d / 2 - 2.2, podium + body, 1.6, 0.4);
    // Deep vertical slots instead of windows: a courthouse keeps its counsel.
    for (const [sign, plane] of [[1, d / 2 - 2.2], [-1, -d / 2 + 0.2]] as const) {
      for (let i = 0; i < 9; i++) {
        const c = -w / 2 + 2.6 + i * ((w - 5.2) / 8);
        m.box([c - 0.55, podium + 1.0, plane - (sign > 0 ? 0 : 0.7)],
              [c + 0.55, podium + body - 2.4, plane + (sign > 0 ? 0.7 : 0)], MAT.STONE);
      }
    }
    for (let i = 0; i < 11; i++) {
      m.box([-w / 2 + 1.0, podium, -d / 2 + 0.2 + i * ((d - 2.4) / 10) - 0.45],
            [-w / 2 + 1.9, podium + body - 2.4, -d / 2 + 0.2 + i * ((d - 2.4) / 10) + 0.45], MAT.STONE);
      m.box([w / 2 - 1.9, podium, -d / 2 + 0.2 + i * ((d - 2.4) / 10) - 0.45],
            [w / 2 - 1.0, podium + body - 2.4, -d / 2 + 0.2 + i * ((d - 2.4) / 10) + 0.45], MAT.STONE);
    }
    // The steps, which are half the building. Each tread starts at the
    // building and the flight narrows as it rises -- it was built the other
    // way up, so the top step stood furthest out and the flight climbed away
    // from the door instead of towards it.
    for (let i = 0; i < 14; i++) {
      m.box([-10.0, i * 0.3, d / 2 - 1.0], [10.0, (i + 1) * 0.3, d / 2 + 5.0 - i * 0.42], MAT.STONE);
    }
    // Cheek walls either side, so the flight has an edge rather than fading
    // out into the pavement.
    for (const sx of [-1, 1] as const) {
      m.box([sx * 10.0, 0, d / 2 - 1.0], [sx * 10.9, 4.4, d / 2 + 5.2], MAT.STONE);
    }
    roofClutter(m, -w / 2 + 4, -d / 2 + 2, w / 2 - 4, d / 2 - 5, podium + body, 1251, 0.3);
  }
  if (fine) {
    for (const [sign, plane] of [[1, d / 2 - 2.2], [-1, -d / 2 + 0.2]] as const) {
      for (let i = 0; i < 8; i++) {
        const a = -w / 2 + 3.15 + i * ((w - 5.2) / 8);
        m.opening({ axis: 'z', sign, plane, u0: a, u1: a + ((w - 5.2) / 8) - 1.1,
          y0: podium + 1.4, y1: podium + body - 2.8, glass: MAT.GLASS, frame: 0.16, proud: 0.05 });
      }
    }
    colonnade(m, -7.0, 7.0, d / 2 - 0.4, podium, body - 2.6, 6, 0.7);
    m.gable([-9.2, podium + body - 1.55, d / 2 - 2.0], [9.2, podium + body - 1.55, d / 2 + 1.2],
      2.6, 'x', MAT.ROOF, MAT.STONE);
    entrance(m, { axis: 'z', sign: 1, plane: d / 2 - 2.2 }, 0,
      { width: 3.4, height: 4.2, double: true });
    boxSign(m, { axis: 'z', sign: 1, plane: d / 2 - 2.2 }, -5.0, 5.0, podium + 4.6, podium + 5.8);
    flagpole(m, -12.5, podium, d / 2 - 1.4, 10.0);
    flagpole(m, 12.5, podium, d / 2 - 1.4, 10.0);
    railing(m, -11.0, 11.0, d / 2 + 5.0, 0, 1.1, 1.5);
    // Stone cheeks with balusters flanking the flight, and lamps on the plinths.
    for (const sx of [-1, 1] as const) {
      for (let i = 0; i < 14; i++) {
        const y = i * 0.3;
        m.box([sx * 10.0, y, d / 2 - 1.0 + i * 0.42], [sx * 11.4, y + 1.3, d / 2 + 5.0], MAT.STONE);
      }
      m.box([sx * 9.9, 0, d / 2 + 4.2], [sx * 11.5, 1.9, d / 2 + 6.0], MAT.STONE);
      lamp(m, sx * 10.7, d / 2 + 5.1, 4.2);
    }
    for (let i = 0; i <= 15; i++) {
      const px = -13.0 + i * (26.0 / 15);
      m.box([px - 0.09, 4.2, d / 2 - 1.4], [px + 0.09, 5.0, d / 2 - 1.0], MAT.STONE);
    }
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 12; i++) {
        const px = -14.0 + i * (28.0 / 11);
        m.cylinder(px, d / 2 + 7.2, 0.16, 0, 0.95, 6, MAT.TRIM, true);
      }
    });
    kerb(m, -x, z, x, z + 0.4);
  }
  dressRoof(m, lod, 3427);
  return m;
}

/** Municipal offices: a finned slab on a colonnaded base. Where the work is. */
function municipalOffices(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 20.0, z = 15.0;
  const w = 30.0, d = 15.0;
  const base = 5.4;
  const floors = 6, floorH = 3.7;
  const h = base + floors * floorH;

  m.box([-w / 2 + 1.6, 0, -d / 2 + 1.2], [w / 2 - 1.6, base, d / 2 - 1.2], MAT.STONE);
  m.box([-w / 2, base, -d / 2], [w / 2, h, d / 2], MAT.CONCRETE, { roof: MAT.ROOF });

  if (medium) {
    m.box([-w / 2 - 0.6, base - 0.7, -d / 2 - 0.6], [w / 2 + 0.6, base, d / 2 + 0.6], MAT.CONCRETE);
    parapet(m, -w / 2, -d / 2, w / 2, d / 2, h, 1.2, 0.36);
    for (let f = 1; f <= floors; f++) {
      band(m, -w / 2, -d / 2, w / 2, d / 2, base + f * floorH - 0.6, 0.6, 0.3);
    }
    // Columns holding the slab over a recessed, colonnaded ground floor.
    colonnade(m, -w / 2 + 2.0, w / 2 - 2.0, d / 2 - 0.8, 0, base - 0.9, 9, 0.42);
    colonnade(m, -w / 2 + 2.0, w / 2 - 2.0, -d / 2 + 0.8, 0, base - 0.9, 9, 0.42);
    m.box([-4.0, h + 1.0, -4.0], [4.0, h + 4.2, 4.0], MAT.CONCRETE, { roof: MAT.ROOF });
    roofClutter(m, -w / 2 + 3, -d / 2 + 2, w / 2 - 3, d / 2 - 2, h, 1261, 1.2);
  }
  if (fine) {
    for (const [wall, u0, u1] of [
      [{ axis: 'z', sign: 1, plane: d / 2 } as Wall, -w / 2 + 1.2, w / 2 - 1.2],
      [{ axis: 'z', sign: -1, plane: -d / 2 } as Wall, -w / 2 + 1.2, w / 2 - 1.2],
      [{ axis: 'x', sign: 1, plane: w / 2 } as Wall, -d / 2 + 1.0, d / 2 - 1.0],
      [{ axis: 'x', sign: -1, plane: -w / 2 } as Wall, -d / 2 + 1.0, d / 2 - 1.0],
    ] as const) {
      ribbonStack(m, wall, u0, u1, { floors, floorH, base: base + 0.9, height: 2.3 });
    }
    fins(m, { axis: 'z', sign: 1, plane: d / 2 }, -w / 2 + 1.2, w / 2 - 1.2, base, h - 0.4, 12, 0.5);
    fins(m, { axis: 'z', sign: -1, plane: -d / 2 }, -w / 2 + 1.2, w / 2 - 1.2, base, h - 0.4, 12, 0.5);
    m.windowRow({ axis: 'z', sign: 1, plane: d / 2 - 1.2, from: -w / 2 + 3.0, to: w / 2 - 3.0,
      y0: 0.6, y1: 4.4, count: 8, width: 2.4, glass: MAT.SHOPFRONT, frame: 0.12, proud: 0.07 });
    entrance(m, { axis: 'z', sign: 1, plane: d / 2 - 1.2 }, 0,
      { width: 3.2, height: 3.4, double: true, glazed: true });
    boxSign(m, { axis: 'z', sign: 1, plane: d / 2 }, -5.0, 5.0, base + 0.1, base + 1.3);
    flagpole(m, -w / 2 + 3.0, 0, d / 2 + 2.0, 10.0);
    serviceYard(m, -w / 2, w / 2, d / 2 + 0.6, 1263, { flag: false });
    kerb(m, -x, z, x, z + 0.4);
  }
  dressRoof(m, lod, 3434);
  return m;
}

/** City works depot: salt barn, open bays, a weighbridge and a fuel island. */
function worksDepot(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 22.0, z = 17.0;

  m.box([-x, 0.0005, -z], [x, 0.1, z], MAT.CONCRETE);
  // Salt barn: three walls and a barrel roof, open to the yard.
  const bx = -x + 12.0, bz = -z + 8.0;
  m.box([bx - 10.0, 0.1, bz - 6.5], [bx - 9.2, 6.0, bz + 6.5], MAT.CONCRETE);
  m.box([bx + 9.2, 0.1, bz - 6.5], [bx + 10.0, 6.0, bz + 6.5], MAT.CONCRETE);
  m.box([bx - 10.0, 0.1, bz - 7.3], [bx + 10.0, 6.0, bz - 6.5], MAT.CONCRETE);
  barrel(m, bx - 10.0, bz - 7.3, bx + 10.0, bz + 6.5, 6.0, 3.6);

  if (medium) {
    // Heap inside the barn, and the retaining walls it sits against.
    m.painted(TINT.WOOD, () =>
      m.cone(bx, bz - 1.0, 8.0, 0.4, 0.1, 5.2, 12, MAT.GROUND));
    // Open vehicle bays down the far side.
    m.box([x - 16.0, 0.1, z - 12.0], [x - 1.0, 5.6, z - 11.2], MAT.CLADDING);
    m.box([x - 16.0, 5.6, z - 12.4], [x - 1.0, 6.2, z - 2.0], MAT.METAL);
    for (let i = 0; i <= 4; i++) {
      const px = x - 16.0 + i * 3.75;
      m.box([px - 0.24, 0.1, z - 2.6], [px + 0.24, 5.6, z - 2.0], MAT.CONCRETE);
    }
  }
  if (fine) {
    louvres(m, { axis: 'z', sign: -1, plane: bz - 7.3 }, bx - 8.0, bx + 8.0, 3.6, 5.4);
    // Weighbridge with a kiosk, and a fuel island under a canopy.
    m.box([-x + 3.0, 0.1, z - 8.0], [-x + 13.0, 0.26, z - 4.2], MAT.CONCRETE);
    m.painted(TINT.METAL_DARK, () => {
      m.box([-x + 2.8, 0.1, z - 8.2], [-x + 3.0, 1.0, z - 4.0], MAT.TRIM);
      m.box([-x + 13.0, 0.1, z - 8.2], [-x + 13.2, 1.0, z - 4.0], MAT.TRIM);
      for (const px of [x - 12.0, x - 8.0]) {
        m.box([px - 0.55, 0.1, -z + 3.0], [px + 0.55, 2.1, -z + 4.4], MAT.TRIM);
      }
    });
    m.box([x - 15.0, 4.4, -z + 2.0], [x - 5.0, 4.9, -z + 6.0], MAT.CONCRETE);
    m.painted(TINT.METAL_DARK, () => {
      for (const px of [x - 14.0, x - 6.0]) {
        m.box([px - 0.16, 0.1, -z + 3.8], [px + 0.16, 4.4, -z + 4.2], MAT.TRIM);
      }
    });
    // Gritters in the bays. Real bodies rather than painted slabs: a yard of
    // boxes beside a lofted car in the same scene reads as a placeholder.
    for (let i = 0; i < 3; i++) {
      const cx = x - 14.5 + i * 3.9;
      parkedVehicle(m, 3100 + i * 13, cx, z - 7.5, 3, 'truck');
    }
    // Mess and stores block.
    m.box([-x + 2.0, 0.1, -z + 2.0], [-x + 11.0, 6.4, -z + 8.0], MAT.CLADDING, { roof: MAT.TRIM });
    parapet(m, -x + 2.0, -z + 2.0, -x + 11.0, -z + 8.0, 6.4, 0.8, 0.3);
    ribbonStack(m, { axis: 'z', sign: 1, plane: -z + 8.0 }, -x + 3.0, -x + 10.0,
      { floors: 2, floorH: 3.2, base: 1.2, height: 1.8 });
    entrance(m, { axis: 'z', sign: 1, plane: -z + 8.0 }, -x + 4.0,
      { width: 1.5, height: 2.5, double: true, glazed: true, canopy: 1.6 });
    serviceYard(m, -x + 2.0, -x + 12.0, -z + 8.0, 1271, { flag: false });
    railing(m, -x, x, z, 0, 2.2, 1.8);
    perimeter(m, -x + 0.3, -z + 0.3, x - 0.3, z - 0.3, 2.2, 2.0, [-2.0, 8.0]);
    // Stores in the yard: pipe stacks, pallets, aggregate bays.
    m.painted(TINT.METAL_DARK, () => {
      for (let r = 0; r < 3; r++) {
        for (let i = 0; i < 4 - r; i++) {
          const px = -2.0 + r * 0.9 + i * 1.8;
          m.cylinder(px, 0, 0.82, 0.1, 0.1, 8, MAT.TRIM, true);
          m.box([px - 0.8, 0.1 + r * 1.6, -6.0], [px + 0.8, 1.6 + r * 1.6, 2.0], MAT.TRIM);
        }
      }
    });
    m.painted(TINT.WOOD, () => {
      for (let i = 0; i < 6; i++) {
        const px = -x + 15.0 + (i % 3) * 1.5;
        const py = 0.1 + Math.floor(i / 3) * 0.72;
        m.box([px, py, z - 16.0], [px + 1.2, py + 0.16, z - 14.8], MAT.TRIM);
        m.box([px + 0.1, py + 0.16, z - 15.9], [px + 1.1, py + 0.68, z - 14.9], MAT.TRIM);
      }
    });
    // Concrete bay dividers for aggregate, and gate posts at the entrance.
    for (let i = 0; i <= 3; i++) {
      const px = x - 12.0 + i * 3.4;
      m.box([px - 0.25, 0.1, -z + 1.0], [px + 0.25, 2.2, -z + 6.0], MAT.CONCRETE);
    }
    m.box([x - 12.0, 0.1, -z + 1.0], [x - 1.8, 2.2, -z + 1.5], MAT.CONCRETE);
    for (const px of [-2.0, 8.0]) {
      m.box([px - 0.35, 0, z - 0.9], [px + 0.35, 3.0, z - 0.2], MAT.CONCRETE);
    }
    kerb(m, -x, z, x, z + 0.4);
  }
  dressRoof(m, lod, 3441);
  return m;
}

// ===================================================================== parks

/** City square: paving, a fountain, benches and a colonnaded shelter. */
function citySquare(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 20.0, z = 16.0;

  m.box([-x, 0.0005, -z], [x, 0.1, z], MAT.CONCRETE);
  m.painted(TINT.GREEN, () => {
    m.box([-x + 2.5, 0.1, -z + 2.5], [-4.0, 0.22, -3.0], MAT.TRIM);
    m.box([4.0, 0.1, -z + 2.5], [x - 2.5, 0.22, -3.0], MAT.TRIM);
    m.box([-x + 2.5, 0.1, 3.0], [-4.0, 0.22, z - 2.5], MAT.TRIM);
    m.box([4.0, 0.1, 3.0], [x - 2.5, 0.22, z - 2.5], MAT.TRIM);
  });

  if (medium) {
    // Fountain: three stepped basins and a jet.
    m.cylinder(0, 0, 5.4, 0.1, 0.75, 20, MAT.STONE);
    m.cylinder(0, 0, 4.9, 0.4, 0.85, 20, MAT.GLASS);
    m.cylinder(0, 0, 2.4, 0.85, 1.7, 16, MAT.STONE);
    m.cylinder(0, 0, 2.1, 1.5, 1.78, 16, MAT.GLASS);
    m.cylinder(0, 0, 0.9, 1.7, 2.9, 12, MAT.STONE);
    m.cylinder(0, 0, 1.9, 2.9, 3.2, 14, MAT.STONE);
    m.cylinder(0, 0, 0.42, 3.2, 4.6, 10, MAT.STONE);
    m.painted(TINT.GREEN, () => m.cone(0, 0, 0.32, 0.9, 4.6, 7.0, 10, MAT.GLASS));
    // Colonnaded shelter on one side.
    colonnade(m, -x + 5.0, -x + 13.0, -z + 5.0, 0.1, 4.0, 5, 0.34);
    m.box([-x + 4.0, 4.6, -z + 3.6], [-x + 14.0, 5.1, -z + 6.4], MAT.STONE);
  }
  if (fine) {
    // Benches round the fountain and lamp columns on the diagonals.
    m.painted(TINT.WOOD, () => {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.4;
        const bx = Math.cos(a) * 8.0, bz = Math.sin(a) * 8.0;
        m.box([bx - 1.4, 0.55, bz - 0.3], [bx + 1.4, 0.68, bz + 0.3], MAT.TRIM);
        m.box([bx - 1.4, 0.68, bz - 0.32], [bx + 1.4, 1.3, bz - 0.18], MAT.TRIM);
      }
    });
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.4;
        const bx = Math.cos(a) * 8.0, bz = Math.sin(a) * 8.0;
        for (const sx of [-1.3, 1.3]) {
          m.box([bx + sx - 0.06, 0.1, bz - 0.25], [bx + sx + 0.06, 0.55, bz + 0.25], MAT.TRIM);
        }
      }
      for (const [px, pz] of [[-12.0, -9.0], [12.0, -9.0], [-12.0, 9.0], [12.0, 9.0]] as const) {
        m.box([px - 0.11, 0.1, pz - 0.11], [px + 0.11, 5.2, pz + 0.11], MAT.TRIM);
        m.box([px - 0.42, 5.2, pz - 0.42], [px + 0.42, 5.7, pz + 0.42], MAT.TRIM);
      }
    });
    m.painted(TINT.SIGN_LIT, () => {
      for (const [px, pz] of [[-12.0, -9.0], [12.0, -9.0], [-12.0, 9.0], [12.0, 9.0]] as const) {
        m.box([px - 0.3, 4.8, pz - 0.3], [px + 0.3, 5.2, pz + 0.3], MAT.TRIM);
      }
    });
    // Low walls to the planted quarters, and the kerb round the whole square.
    for (const [a, b, c, d] of [
      [-x + 2.5, -z + 2.5, -4.0, -3.0], [4.0, -z + 2.5, x - 2.5, -3.0],
      [-x + 2.5, 3.0, -4.0, z - 2.5], [4.0, 3.0, x - 2.5, z - 2.5],
    ] as const) {
      m.box([a - 0.3, 0.1, b - 0.3], [b === -z + 2.5 ? c + 0.3 : c + 0.3, 0.55, b], MAT.STONE);
      m.box([a - 0.3, 0.1, d], [c + 0.3, 0.55, d + 0.3], MAT.STONE);
      m.box([a - 0.3, 0.1, b], [a, 0.55, d], MAT.STONE);
      m.box([c, 0.1, b], [c + 0.3, 0.55, d], MAT.STONE);
    }
    // Paving joints radiating from the fountain, and the granite sett band
    // that runs round it -- a square is read by its floor before anything else.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const c = Math.cos(a), sn = Math.sin(a);
      m.box([c * 6.2 - 0.07, 0.1, sn * 6.2 - 0.07], [c * 11.6 + 0.07, 0.14, sn * 11.6 + 0.07], MAT.STONE);
    }
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      m.box([Math.cos(a) * 6.0 - 0.35, 0.1, Math.sin(a) * 6.0 - 0.35],
            [Math.cos(a) * 6.0 + 0.35, 0.16, Math.sin(a) * 6.0 + 0.35], MAT.STONE);
    }
    // Benches and bins along the shelter side, litter bins at the corners.
    for (const px of [-x + 6.0, -x + 11.0]) bench(m, px, -z + 7.4, 2.4, 'x');
    bench(m, x - 6.0, -z + 7.4, 2.4, 'x');
    m.painted(TINT.METAL_DARK, () => {
      for (const [px, pz] of [[-x + 4.0, -z + 7.4], [x - 4.0, -z + 7.4],
                              [-x + 4.0, z - 5.0], [x - 4.0, z - 5.0]] as const) {
        m.cylinder(px, pz, 0.36, 0.1, 1.0, 8, MAT.TRIM, true);
        m.cylinder(px, pz, 0.42, 1.0, 1.14, 8, MAT.TRIM, true);
      }
      // Bollards separating the square from the carriageway.
      for (let i = 0; i < 11; i++) {
        m.cylinder(-x + 2.0 + i * ((2 * x - 4.0) / 10), z - 1.2, 0.15, 0.1, 0.95, 6, MAT.TRIM, true);
        m.cylinder(-x + 2.0 + i * ((2 * x - 4.0) / 10), -z + 1.2, 0.15, 0.1, 0.95, 6, MAT.TRIM, true);
      }
      // Cycle stands along the shelter side.
      for (let i = 0; i < 6; i++) {
        const px = x - 14.0 + i * 1.2;
        m.box([px - 0.05, 0.1, -z + 3.0], [px + 0.05, 0.9, -z + 3.1], MAT.TRIM);
        m.box([px - 0.05, 0.83, -z + 3.0], [px + 0.05, 0.9, -z + 4.1], MAT.TRIM);
        m.box([px - 0.05, 0.1, -z + 4.0], [px + 0.05, 0.9, -z + 4.1], MAT.TRIM);
      }
    });
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

/** Playground: equipment, safety surfacing, a shelter and a railed boundary. */
function playground(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 15.0, z = 12.0;

  m.painted(TINT.GREEN, () => m.box([-x, 0.0005, -z], [x, 0.08, z], MAT.TRIM));
  m.painted(TINT.ACCENT, () => m.box([-x + 2.0, 0.08, -z + 2.0], [x - 2.0, 0.16, z - 4.0], MAT.TRIM));

  if (medium) {
    // Climbing frame: a tower with a slide and a bridge to a second tower.
    for (const cx of [-6.0, 2.0] as const) {
      m.painted(TINT.METAL_DARK, () => {
        for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]] as const) {
          m.box([cx + dx - 0.09, 0.16, dz - 0.09], [cx + dx + 0.09, 3.4, dz + 0.09], MAT.TRIM);
        }
      });
      m.painted(TINT.BRAND, () => {
        m.box([cx - 1.35, 2.0, -1.35], [cx + 1.35, 2.2, 1.35], MAT.TRIM);
        m.gable([cx - 1.5, 3.4, -1.5], [cx + 1.5, 3.4, 1.5], 0.9, 'x', MAT.TRIM, MAT.TRIM);
      });
    }
    m.painted(TINT.WOOD, () => m.box([-4.8, 2.0, -0.5], [0.8, 2.15, 0.5], MAT.TRIM));
    m.painted(TINT.METAL_DARK, () => {
      m.box([-4.8, 2.15, -0.62], [0.8, 2.9, -0.5], MAT.TRIM);
      m.box([-4.8, 2.15, 0.5], [0.8, 2.9, 0.62], MAT.TRIM);
    });
  }
  if (fine) {
    // Slide off one tower, swings, a roundabout and a spring rocker.
    m.painted(TINT.ACCENT, () => {
      m.quad([2.9, 2.2, -0.7], [2.9, 2.2, 0.7], [7.4, 0.3, 0.7], [7.4, 0.3, -0.7], MAT.TRIM);
      m.quad([2.9, 2.2, -0.85], [7.4, 0.3, -0.85], [7.4, 0.55, -0.7], [2.9, 2.45, -0.7], MAT.TRIM);
      m.quad([7.4, 0.3, 0.85], [2.9, 2.2, 0.85], [2.9, 2.45, 0.7], [7.4, 0.55, 0.7], MAT.TRIM);
    });
    m.painted(TINT.METAL_DARK, () => {
      // Swing frame.
      for (const sx of [-1, 1] as const) {
        m.box([-11.0 + sx * 0.1 - 0.09, 0.16, -4.0], [-11.0 + sx * 0.1 + 0.09, 3.0, -3.82], MAT.TRIM);
        m.box([-11.0 + sx * 0.1 - 0.09, 0.16, 3.82], [-11.0 + sx * 0.1 + 0.09, 3.0, 4.0], MAT.TRIM);
      }
      m.box([-11.2, 2.9, -3.95], [-10.8, 3.05, 3.95], MAT.TRIM);
      for (const pz of [-2.0, 0.0, 2.0]) {
        for (const dz of [-0.35, 0.35]) {
          m.box([-11.06, 1.0, pz + dz - 0.03], [-10.94, 2.9, pz + dz + 0.03], MAT.TRIM);
        }
        m.box([-11.3, 0.88, pz - 0.42], [-10.7, 1.0, pz + 0.42], MAT.TRIM);
      }
      // Roundabout and a rocker.
      m.cylinder(8.0, -6.0, 2.1, 0.16, 0.5, 14, MAT.TRIM);
      m.cylinder(8.0, -6.0, 0.28, 0.5, 1.1, 8, MAT.TRIM);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        m.box([8.0 + Math.cos(a) * 1.9 - 0.06, 0.5, -6.0 + Math.sin(a) * 1.9 - 0.06],
              [8.0 + Math.cos(a) * 1.9 + 0.06, 1.05, -6.0 + Math.sin(a) * 1.9 + 0.06], MAT.TRIM);
      }
      m.box([-3.0, 0.16, 6.0], [-2.8, 0.9, 6.2], MAT.TRIM);
    });
    m.painted(TINT.BRAND, () => {
      m.cylinder(8.0, -6.0, 1.5, 1.02, 1.12, 14, MAT.TRIM);
      m.box([-3.9, 0.9, 5.5], [-1.9, 1.4, 6.7], MAT.TRIM);
    });
    // Shelter for parents, a bin and the railed boundary with a gate.
    m.box([-x + 3.0, 2.4, z - 3.6], [-x + 9.0, 2.6, z - 1.4], MAT.METAL);
    m.painted(TINT.METAL_DARK, () => {
      for (const px of [-x + 3.4, -x + 8.6]) {
        m.box([px - 0.08, 0.08, z - 1.7], [px + 0.08, 2.4, z - 1.54], MAT.TRIM);
      }
      m.box([-x + 3.0, 0.08, z - 3.7], [-x + 9.0, 2.4, z - 3.56], MAT.GLASS);
      m.box([-x + 3.6, 0.55, z - 3.3], [-x + 8.4, 0.68, z - 2.6], MAT.TRIM);
      for (const px of [-x + 3.9, -x + 8.1]) {
        m.box([px, 0.08, z - 3.25], [px + 0.12, 0.55, z - 2.65], MAT.TRIM);
      }
    });
    railing(m, -x, x, z, 0, 1.25, 1.3);
    railing(m, -x, x, -z, 0, 1.25, 1.3);
    perimeter(m, -x + 0.6, -z + 0.6, x - 0.6, z - 0.6, 1.25, 1.4, [-1.5, 1.5]);
    // Seesaw, springers and a low climbing net: the rest of the kit.
    m.painted(TINT.METAL_DARK, () => {
      m.box([11.0, 0.16, 3.4], [11.4, 1.0, 5.0], MAT.TRIM);
      for (let i = 0; i < 3; i++) {
        m.box([-8.0 + i * 2.2, 0.16, 8.0], [-7.85 + i * 2.2, 0.75, 8.15], MAT.TRIM);
      }
      // Climbing net: two frames and the strings between them.
      for (const sx of [-1, 1] as const) {
        m.box([5.0 + sx * 2.4 - 0.1, 0.16, 6.0], [5.0 + sx * 2.4 + 0.1, 2.6, 6.2], MAT.TRIM);
      }
      m.box([2.5, 2.5, 6.0], [7.5, 2.62, 6.2], MAT.TRIM);
      for (let i = 0; i <= 8; i++) {
        m.box([2.6 + i * 0.6 - 0.03, 0.2, 6.04], [2.6 + i * 0.6 + 0.03, 2.5, 6.1], MAT.TRIM);
      }
      for (let i = 0; i <= 4; i++) {
        m.box([2.57, 0.3 + i * 0.55, 6.04], [7.43, 0.36 + i * 0.55, 6.1], MAT.TRIM);
      }
    });
    m.painted(TINT.BRAND, () => {
      m.box([8.6, 0.9, 3.9], [13.8, 1.1, 4.5], MAT.TRIM);
      for (let i = 0; i < 3; i++) {
        m.box([-8.4 + i * 2.2, 0.75, 7.6], [-7.4 + i * 2.2, 1.25, 8.6], MAT.TRIM);
      }
    });
    lamp(m, -x + 2.0, -z + 2.0, 4.0);
    lamp(m, x - 2.0, -z + 2.0, 4.0);
    bench(m, -x + 5.0, -z + 1.6, 2.4, 'x');
    bench(m, x - 5.0, -z + 1.6, 2.4, 'x');
    bench(m, x - 1.4, 2.0, 2.4, 'z');
    // Stepping logs and a low balance beam along the edge of the surfacing.
    m.painted(TINT.WOOD, () => {
      for (let i = 0; i < 5; i++) {
        m.cylinder(-12.0 + i * 1.5, -6.5, 0.34, 0.16, 0.4 + (i % 3) * 0.18, 8, MAT.TRIM, true);
      }
      m.box([-2.0, 0.16, -8.0], [4.0, 0.5, -7.6], MAT.TRIM);
      for (const px of [-1.8, 3.8]) {
        m.box([px - 0.12, 0.16, -8.1], [px + 0.12, 0.5, -7.5], MAT.TRIM);
      }
    });
    kerb(m, -x, z, x, z + 0.4);
  }
  return m;
}

/** Sports ground: a pitch, a small stand with a roof, and floodlights. */
function sportsGround(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const x = 26.0, z = 19.0;

  m.painted(TINT.GREEN, () => m.box([-x + 1.0, 0.0005, -z + 1.0], [x - 1.0, 0.08, z - 8.0], MAT.TRIM));

  if (medium) {
    // The stand: raked seating under a cantilevered roof on rear columns.
    const sz = z - 7.0;
    for (let i = 0; i < 7; i++) {
      m.box([-14.0, i * 0.42, sz + i * 0.8], [14.0, (i + 1) * 0.42, sz + (i + 1) * 0.8], MAT.CONCRETE);
    }
    m.box([-14.6, 0, sz + 5.6], [14.6, 3.4, sz + 6.6], MAT.CONCRETE);
    m.box([-15.0, 7.6, sz - 1.2], [15.0, 8.2, sz + 6.8], MAT.METAL);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 5; i++) {
        const px = -14.0 + i * 5.6;
        m.box([px - 0.18, 0, sz + 6.2], [px + 0.18, 7.6, sz + 6.6], MAT.TRIM);
        m.box([px - 0.14, 6.6, sz - 0.8], [px + 0.14, 7.6, sz + 6.4], MAT.TRIM);
      }
    });
    // Goals and the halfway line.
    m.painted(TINT.ACCENT, () => {
      m.box([-x + 3.0, 0.08, -z + 3.0], [x - 3.0, 0.1, -z + 3.2], MAT.TRIM);
      m.box([-x + 3.0, 0.08, z - 10.0], [x - 3.0, 0.1, z - 9.8], MAT.TRIM);
      m.box([-x + 3.0, 0.08, -z + 3.0], [-x + 3.2, 0.1, z - 9.8], MAT.TRIM);
      m.box([x - 3.2, 0.08, -z + 3.0], [x - 3.0, 0.1, z - 9.8], MAT.TRIM);
      m.box([-x + 3.0, 0.08, -3.4], [x - 3.0, 0.1, -3.2], MAT.TRIM);
    });
  }
  if (fine) {
    m.painted(TINT.METAL_DARK, () => {
      for (const pz of [-z + 3.2, z - 10.0] as const) {
        const s = pz < 0 ? 1 : -1;
        for (const px of [-3.7, 3.7]) {
          m.box([px - 0.1, 0.08, pz - 0.1], [px + 0.1, 2.5, pz + 0.1], MAT.TRIM);
          m.box([px - 0.1, 0.08, pz + s * 1.8 - 0.1], [px + 0.1, 1.4, pz + s * 1.8 + 0.1], MAT.TRIM);
        }
        m.box([-3.8, 2.4, pz - 0.1], [3.8, 2.5, pz + 0.1], MAT.TRIM);
      }
      // Four floodlight masts.
      for (const [px, pz] of [[-x + 3.0, -z + 3.0], [x - 3.0, -z + 3.0],
                              [-x + 3.0, z - 9.8], [x - 3.0, z - 9.8]] as const) {
        m.box([px - 0.2, 0, pz - 0.2], [px + 0.2, 16.0, pz + 0.2], MAT.TRIM);
        m.box([px - 2.0, 16.0, pz - 0.6], [px + 2.0, 16.7, pz + 0.6], MAT.TRIM);
        for (let i = 0; i < 4; i++) {
          m.box([px - 1.8 + i * 1.0, 15.5, pz - 0.5], [px - 1.0 + i * 1.0, 16.0, pz + 0.5], MAT.TRIM);
        }
      }
      // Seats in the stand, and the perimeter rail.
      for (let r = 0; r < 7; r++) {
        for (let i = 0; i < 22; i++) {
          const cx = -13.4 + i * 1.24;
          const y = r * 0.42 + 0.42;
          const zz = z - 7.0 + r * 0.8;
          m.box([cx - 0.42, y, zz + 0.1], [cx + 0.42, y + 0.42, zz + 0.24], MAT.TRIM);
        }
      }
    });
    m.painted(TINT.BRAND, () => {
      for (let r = 0; r < 7; r += 2) {
        for (let i = 0; i < 22; i++) {
          const cx = -13.4 + i * 1.24;
          m.box([cx - 0.42, r * 0.42 + 0.42, z - 7.0 + r * 0.8 + 0.24],
                [cx + 0.42, r * 0.42 + 0.84, z - 7.0 + r * 0.8 + 0.34], MAT.TRIM);
        }
      }
    });
    // Changing block behind the stand.
    m.box([-8.0, 0, z - 0.2], [8.0, 4.4, z + 0.2], MAT.CLADDING);
    railing(m, -x + 1.0, x - 1.0, -z + 0.6, 0, 1.1, 1.5);
    kerb(m, -x, z + 0.4, x, z + 0.8);
  }
  return m;
}

/**
 * A half-elliptical vault, closed at both ends.
 *
 * barrel() above is three flat facets and no ends, which from any angle but
 * dead-on reads as folded card with the inside showing. This is a real arch
 * swept along the ridge, with a tympanum at each end so the volume is closed.
 */
function vault(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number,
               base: number, rise: number, mat: Material, segs = 12): void {
  const cz = (z0 + z1) / 2, hz = (z1 - z0) / 2;
  const pt = (k: number): [number, number] => {
    const a = (k / segs) * Math.PI;
    return [cz - Math.cos(a) * hz, base + Math.sin(a) * rise];
  };
  for (let k = 0; k < segs; k++) {
    const [az, ay] = pt(k), [bz, by] = pt(k + 1);
    m.quad([x0, ay, az], [x1, ay, az], [x1, by, bz], [x0, by, bz], mat);
  }
  // Tympana, as fans from the springing line's centre.
  for (const [x, dir] of [[x0, -1], [x1, 1]] as const) {
    for (let k = 0; k < segs; k++) {
      const [az, ay] = pt(k), [bz, by] = pt(k + 1);
      if (dir > 0) m.tri([x, ay, az], [x, by, bz], [x, base, cz], mat);
      else m.tri([x, by, bz], [x, ay, az], [x, base, cz], mat);
    }
  }
}

/** Botanical glasshouse: a barrel-vaulted palm house on a stone plinth. */
function glasshouse(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1;
  const medium = lod < 2;
  const w = 26.0, d = 15.0, eave = 6.0, rise = 5.2;
  const hx = w / 2, hz = d / 2;

  // Plinth, then a glazed wall, then the vault standing on it.
  m.box([-hx - 0.7, 0, -hz - 0.7], [hx + 0.7, 1.0, hz + 0.7], MAT.STONE);
  m.box([-hx, 1.0, -hz], [hx, eave, hz], MAT.GLASS);
  vault(m, -hx, -hz, hx, hz, eave, rise, MAT.GLASS);

  // Central drum and dome, over the middle of the house rather than in front
  // of it. It was a separate pavilion standing off the end with a spike on
  // top, which read as a second building that had landed beside the first.
  const drum = 4.6;
  m.cylinder(0, 0, drum, eave + rise - 1.6, eave + rise + 2.4, 16, MAT.GLASS, false);
  m.cone(0, 0, drum, 0.5, eave + rise + 2.4, eave + rise + 6.0, 16, MAT.METAL);
  m.cylinder(0, 0, 0.3, eave + rise + 6.0, eave + rise + 7.2, 8, MAT.METAL);

  if (medium) {
    m.painted(TINT.METAL_DARK, () => {
      // Main ribs: one arch every 2.6m, each following the vault exactly.
      for (let i = 0; i <= 10; i++) {
        const px = -hx + (i / 10) * w;
        m.box([px - 0.11, 1.0, -hz - 0.07], [px + 0.11, eave, hz + 0.07], MAT.TRIM);
        for (let k = 0; k < 8; k++) {
          const a0 = (k / 8) * Math.PI, a1 = ((k + 1) / 8) * Math.PI;
          m.pipe([px, eave + Math.sin(a0) * rise, -Math.cos(a0) * hz],
                 [px, eave + Math.sin(a1) * rise, -Math.cos(a1) * hz], 0.10, MAT.TRIM, 5);
        }
      }
      // Purlins round the vault, and two bands round the glazed wall.
      for (const t of [0.3, 0.7]) {
        const a = t * Math.PI;
        const py = eave + Math.sin(a) * rise, pz = -Math.cos(a) * hz;
        for (const sz of [pz, -pz]) m.box([-hx, py - 0.09, sz - 0.09], [hx, py + 0.09, sz + 0.09], MAT.TRIM);
      }
      for (const y of [2.6, 4.4]) {
        for (const sz of [hz, -hz]) m.box([-hx - 0.07, y, sz - 0.07], [hx + 0.07, y + 0.11, sz + 0.07], MAT.TRIM);
      }
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        m.box([Math.cos(a) * drum - 0.08, eave + rise - 1.6, Math.sin(a) * drum - 0.08],
              [Math.cos(a) * drum + 0.08, eave + rise + 2.4, Math.sin(a) * drum + 0.08], MAT.TRIM);
      }
    });
    // Porch: a low glazed lobby against the long side, standing on the plinth.
    m.box([-4.6, 0, hz + 0.7], [4.6, 1.0, hz + 4.2], MAT.STONE);
    m.box([-4.0, 1.0, hz], [4.0, 4.2, hz + 3.2], MAT.GLASS);
    m.box([-4.3, 4.2, hz - 0.2], [4.3, 4.6, hz + 3.5], MAT.METAL);
  }
  if (fine) {
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 10; i++) {
        const px = -hx + (i + 0.5) * (w / 10);
        m.box([px - 0.05, 1.0, -hz - 0.05], [px + 0.05, eave, hz + 0.05], MAT.TRIM);
        for (let k = 0; k < 5; k++) {
          const a0 = (k / 5) * Math.PI, a1 = ((k + 1) / 5) * Math.PI;
          m.pipe([px, eave + Math.sin(a0) * rise, -Math.cos(a0) * hz],
                 [px, eave + Math.sin(a1) * rise, -Math.cos(a1) * hz], 0.05, MAT.TRIM, 4);
        }
      }
      // Ridge vents, propped open along the top of the vault.
      for (let i = 0; i < 4; i++) {
        const px = i < 2 ? -10.4 + i * 3.4 : 3.6 + (i - 2) * 3.4;
        m.quad([px - 1.5, eave + rise, -1.1], [px + 1.5, eave + rise, -1.1],
               [px + 1.5, eave + rise + 0.75, 0.5], [px - 1.5, eave + rise + 0.75, 0.5], MAT.GLASS);
        m.box([px - 0.05, eave + rise, -1.2], [px + 0.05, eave + rise + 0.75, 0.6], MAT.TRIM);
      }
      for (let i = 0; i <= 6; i++) {
        const px = -4.0 + (i / 6) * 8.0;
        m.box([px - 0.07, 1.0, hz + 3.1], [px + 0.07, 4.2, hz + 3.3], MAT.TRIM);
      }
    });
    entrance(m, { axis: 'z', sign: 1, plane: hz + 3.2 }, 0,
      { width: 2.6, height: 3.0, double: true, glazed: true, steps: 2 });
    boxSign(m, { axis: 'z', sign: 1, plane: hz + 3.2 }, -2.8, 2.8, 4.7, 5.6);
    // Planting inside, seen through the glass: beds, a path, and palms whose
    // heads reach up into the vault, which is what the vault is for.
    m.painted(TINT.GREEN, () => {
      for (const sx of [-1, 1] as const) {
        m.box([sx * 2.0, 1.0, -hz + 1.4], [sx * (hx - 1.6), 1.6, hz - 1.4], MAT.TRIM);
      }
      for (let i = 0; i < 5; i++) {
        const px = -9.6 + i * 4.8;
        m.cone(px, 2.4, 1.5, 0.4, 1.6, 8.4, 8, MAT.TRIM);
        m.cone(px, -3.2, 1.1, 0.3, 1.6, 6.0, 8, MAT.TRIM);
      }
    });
    m.box([-1.7, 1.0, -hz], [1.7, 1.1, hz], MAT.CONCRETE);
    for (let i = 0; i <= 20; i++) {
      const px = -hx - 0.7 + (i / 20) * (w + 1.4);
      for (const sz of [hz + 0.5, -hz - 0.62] as const) {
        m.box([px - 0.08, 1.0, sz], [px + 0.08, 1.7, sz + 0.12], MAT.STONE);
      }
    }
    m.box([-hx - 0.7, 1.7, hz + 0.44], [hx + 0.7, 1.86, hz + 0.7], MAT.STONE);
    m.box([-hx - 0.7, 1.7, -hz - 0.7], [hx + 0.7, 1.86, -hz - 0.44], MAT.STONE);
    lamp(m, -hx - 2.0, hz + 5.4, 4.2);
    lamp(m, hx + 2.0, hz + 5.4, 4.2);
    kerb(m, -hx - 2.6, hz + 6.0, hx + 2.6, hz + 6.4);
  }
  return m;
}


// ==================================================================== table

const civ = (jobs: number, upkeep: number, power: number, water: number): AssetDef['sim'] => ({
  jobs, powerKW: power, waterM3: water, garbagePerWeek: jobs * 9, pollution: 0, upkeep,
});

export const CIVIC: AssetDef[] = [
  { id: 'svc.edu.primary', name: 'Primary school', zone: 'service', branch: 'education', density: 'none', variant: 'sculpted', footprint: [6, 5], height: 10.0, brand: { name: 'School', colour: [0.40, 0.30, 0.56], accent: [0.72, 0.60, 0.22], sign: 'box' }, sim: civ(30, 280, 120, 90), note: 'Two single-storey teaching wings under monopitches, barrel-roofed hall, yard canopy and ball court.', build: primarySchool },
  { id: 'svc.edu.high', name: 'High school', zone: 'service', branch: 'education', density: 'none', variant: 'sculpted', footprint: [7, 5], height: 13.0, brand: { name: 'High School', colour: [0.40, 0.30, 0.56], accent: [0.72, 0.60, 0.22], sign: 'box' }, sim: civ(60, 520, 260, 180), note: 'Finned three-storey teaching block with a stair drum, barrel sports hall, floodlit all-weather pitch.', build: highSchool },
  { id: 'svc.edu.university', name: 'University', zone: 'service', branch: 'education', density: 'none', variant: 'sculpted', footprint: [6, 5], height: 30.2, brand: { name: 'University', colour: [0.36, 0.28, 0.52], accent: [0.66, 0.58, 0.30], sign: 'box' }, sim: civ(180, 1400, 520, 400), note: 'Stone ranges round a quadrangle, gate tower with a clock, cloister arcade to the lawn.', build: university },
  { id: 'svc.edu.college', name: 'College campus', zone: 'service', branch: 'education', density: 'none', variant: 'sculpted', footprint: [14, 13], height: 44.4, brand: { name: 'College', colour: [0.30, 0.24, 0.46], accent: [0.68, 0.58, 0.28], sign: 'box' }, sim: civ(420, 3200, 1250, 900), note: 'Forty-metre domed hall behind an eight-column portico at the head of a lawn, four teaching ranges down the sides, a colonnaded library closing the far end, four halls of residence on the flanks.', build: collegeCampus },
  { id: 'svc.edu.library', name: 'Library', zone: 'service', branch: 'education', density: 'none', variant: 'sculpted', footprint: [4, 4], height: 12.9, brand: { name: 'Library', colour: [0.36, 0.28, 0.52], accent: [0.66, 0.58, 0.30], sign: 'box' }, sim: civ(24, 240, 110, 40), note: 'Barrel-vaulted reading room on a stone plinth, full-height glazing between deep fins.', build: library },

  { id: 'svc.gov.hall', name: 'City hall', zone: 'service', branch: 'government', density: 'none', variant: 'sculpted', footprint: [6, 5], height: 37.0, brand: { name: 'City Hall', colour: [0.46, 0.40, 0.24], accent: [0.68, 0.60, 0.28], sign: 'box' }, sim: civ(140, 900, 300, 150), note: 'Stone block with a six-column portico and pediment, octagonal lantern, clock and two flags.', build: cityHall },
  { id: 'svc.gov.court', name: 'Courthouse', zone: 'service', branch: 'government', density: 'none', variant: 'sculpted', footprint: [5, 5], height: 19.0, brand: { name: 'Courts', colour: [0.44, 0.38, 0.24], accent: [0.66, 0.58, 0.28], sign: 'box' }, sim: civ(80, 620, 190, 90), note: 'Near-blind stone box on a podium, deep pilaster slots, colonnade over a fourteen-step flight.', build: courthouse },
  { id: 'svc.gov.offices', name: 'Municipal offices', zone: 'service', branch: 'government', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 27.6, brand: { name: 'Council', colour: [0.44, 0.38, 0.24], accent: [0.66, 0.58, 0.28], sign: 'box' }, sim: civ(190, 780, 380, 140), note: 'Finned slab on a colonnaded, recessed ground floor. Where the paperwork actually happens.', build: municipalOffices },
  { id: 'svc.gov.depot', name: 'City works depot', zone: 'service', branch: 'government', density: 'none', variant: 'sculpted', footprint: [6, 5], height: 9.6, brand: { name: 'City Works', colour: [0.46, 0.40, 0.24], accent: [0.72, 0.58, 0.18], sign: 'box' }, sim: civ(45, 340, 130, 70), note: 'Barrel-roofed salt barn open to the yard, covered vehicle bays with gritters, weighbridge, fuel island.', build: worksDepot },

  { id: 'svc.parks.square', name: 'City square', zone: 'service', branch: 'parks', density: 'none', variant: 'sculpted', footprint: [5, 4], height: 7.0, brand: { name: 'Parks', colour: [0.32, 0.52, 0.24], accent: [0.66, 0.62, 0.40], sign: 'none' }, sim: civ(6, 120, 30, 60), note: 'Paved square in four planted quarters round a three-basin fountain, colonnaded shelter, lamp columns.', build: citySquare },
  { id: 'svc.parks.playground', name: 'Playground', zone: 'service', branch: 'parks', density: 'none', variant: 'sculpted', footprint: [4, 3], height: 4.3, brand: { name: 'Parks', colour: [0.32, 0.52, 0.24], accent: [0.68, 0.44, 0.16], sign: 'none' }, sim: civ(3, 70, 12, 20), note: 'Two towers linked by a bridge, slide, swings, roundabout, safety surfacing and a parents shelter.', build: playground },
  { id: 'svc.parks.sports', name: 'Sports ground', zone: 'service', branch: 'parks', density: 'none', variant: 'sculpted', footprint: [7, 5], height: 16.7, brand: { name: 'Parks', colour: [0.32, 0.52, 0.24], accent: [0.62, 0.30, 0.24], sign: 'none' }, sim: civ(12, 200, 180, 90), note: 'Marked pitch with goals, a raked stand under a cantilevered roof, four floodlight masts.', build: sportsGround },
  { id: 'svc.parks.glasshouse', name: 'Botanical glasshouse', zone: 'service', branch: 'parks', density: 'none', variant: 'sculpted', footprint: [5, 5], height: 11.1, brand: { name: 'Botanic', colour: [0.30, 0.50, 0.26], accent: [0.66, 0.62, 0.40], sign: 'box' }, sim: civ(14, 260, 140, 120), note: 'Barrel-vaulted palm house on a stone plinth, ribbed throughout, domed entrance pavilion, roof vents.', build: glasshouse },
];
