/**
 * The service buildings a city is proud of.
 *
 * The branches were complete before this file -- there was a school, a
 * hospital, a fire station, a power station -- but complete in the sense of
 * "the box is ticked". A city also has the buildings people take visitors to
 * and give directions by, and those are services too: the museum, the concert
 * hall, the cathedral, the observatory. The other half here is the opposite
 * kind of civic object, the ones nobody visits and everybody can see from ten
 * kilometres away: the nuclear station and the energy-from-waste plant.
 *
 * Everything in this file is one to a city. That is the licence to spend the
 * geometry, and the obligation to make each of them a silhouette rather than
 * a shed with a sign on it.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import {
  band, bollards, entrance, kerb, parapet, planter, railing, roofClutter,
} from '../parts';
import {
  barrelVault, conveyor, curtain, flags, forecourt, lattice, lid, loft,
  marquee, pipeRack, plan, porteCochere, scaled, shelf, silo,
} from './signature-parts';
import { bench, hedge, tree } from './landscape';
import { figure } from './vehicles';

// =================================================================== 1. museum

/**
 * A city museum: a colonnaded portico, a domed rotunda and two wings.
 *
 * The one building type that is still designed the way it was in 1840, and
 * for a good reason -- a museum has to say "public, free, and older than you"
 * from the far side of a square. So: a flight of steps the width of the
 * frontage, eight columns, a pediment, and a lit dome over the hall behind.
 */
function museum(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 44.0, hz = 26.0, wall = 17.0;

  forecourt(m, -54, -46, 54, 34, 1301, { trees: 8, lamps: 8, people: 12, benches: 5 });
  // A podium the whole building stands on, with steps up the front.
  m.box([-hx - 2, 0.1, -hz - 2], [hx + 2, 2.6, hz + 2], MAT.STONE);
  m.box([-hx, 2.6, -hz], [hx, wall, hz], MAT.STONE, { roof: MAT.ROOF });
  if (medium) {
    for (let i = 0; i < 7; i++) {
      m.box([-18 - i * 0.9, 0.1 + i * 0.34, hz + 2 + i * 0.9], [18 + i * 0.9, 2.6, hz + 3 + i * 0.9], MAT.STONE);
    }
    band(m, -hx, -hz, hx, hz, wall - 1.6, 1.6, 0.9, MAT.STONE);
    // Pilasters down both wings, and a plinth course under them.
    m.painted(TINT.NONE, () => {
      for (let i = 0; i <= 18; i++) {
        const x = -hx + (i / 18) * hx * 2;
        if (Math.abs(x) < 19) continue;
        m.box([x - 0.9, 2.6, hz - 0.1], [x + 0.9, wall - 1.6, hz + 0.8], MAT.STONE);
        m.box([x - 0.9, 2.6, -hz - 0.8], [x + 0.9, wall - 1.6, -hz + 0.1], MAT.STONE);
      }
    });
    for (const [sign, pln] of [[1, hz], [-1, -hz]] as const) {
      m.windowRow({
        axis: 'z', sign, plane: pln, from: -hx + 3, to: -19, y0: 5.0, y1: 12.0,
        count: 5, width: 2.6, glass: MAT.PANE, frame: 0.2, proud: 0.1,
      });
      m.windowRow({
        axis: 'z', sign, plane: pln, from: 19, to: hx - 3, y0: 5.0, y1: 12.0,
        count: 5, width: 2.6, glass: MAT.PANE, frame: 0.2, proud: 0.1,
      });
    }
    // The portico: eight columns, an entablature and a pediment.
    m.box([-19.5, 2.6, hz], [19.5, wall + 1.0, hz + 7.0], MAT.STONE, { roof: MAT.ROOF });
    m.box([-18.5, 2.6, hz + 0.6], [18.5, wall - 3.4, hz + 6.4], MAT.DARK_TRIM);
    m.painted(TINT.NONE, () => {
      for (let i = 0; i < 8; i++) {
        const x = -16.4 + (i / 7) * 32.8;
        m.cylinder(x, hz + 5.2, 1.35, 2.6, wall - 3.4, 12, MAT.STONE, false);
        m.cylinder(x, hz + 5.2, 1.6, wall - 3.6, wall - 3.0, 12, MAT.STONE, false);
        m.cylinder(x, hz + 5.2, 1.6, 2.6, 3.2, 12, MAT.STONE, false);
      }
      m.box([-20.2, wall - 3.4, hz - 0.2], [20.2, wall + 1.0, hz + 7.2], MAT.STONE);
    });
    m.gable([-20.2, wall + 1.0, hz - 0.2], [20.2, wall + 1.0, hz + 7.2], 5.2, 'x', MAT.STONE, MAT.STONE);
  }
  if (medium) {
    // The rotunda: a drum over the middle of the plan with a lit lantern.
    const N = 20;
    const drum = plan(13.0, 13.0, 1.0, N);
    loft(m, drum, drum, wall, wall + 9.0, MAT.STONE);
    m.painted(TINT.NONE, () => {
      for (let i = 0; i < N; i++) {
        const p = scaled(drum, 1.09)[i];
        m.cylinder(p[0], p[1], 0.5, wall, wall + 8.2, 8, MAT.STONE, false);
      }
    });
    shelf(m, scaled(drum, 1.0), scaled(drum, 1.2), wall + 9.0, wall + 10.4, MAT.STONE);
    // The dome in five shallow stages rather than two. Two cones make a
    // cocked hat; five make something the eye reads as a hemisphere, and it
    // is the same twenty triangles a stage.
    let dr = 13.4, dy = wall + 10.4;
    for (let k = 0; k < 5; k++) {
      const nr = 13.4 * Math.cos(((k + 1) / 5) * Math.PI * 0.46);
      const ny = dy + 9.4 * (Math.sin(((k + 1) / 5) * Math.PI * 0.46) - Math.sin((k / 5) * Math.PI * 0.46));
      m.cone(0, 0, dr, nr, dy, ny, N, MAT.METAL);
      dr = nr; dy = ny;
    }
    m.painted(TINT.SIGN_LIT, () => m.cylinder(0, 0, 2.2, dy, dy + 3.0, 10, MAT.PLATE, true));
    m.cone(0, 0, 2.6, 0.0, dy + 3.0, dy + 6.4, 10, MAT.METAL);
  }
  if (fine) {
    parapet(m, -hx, -hz, hx, hz, wall, 1.2, 0.35, MAT.STONE);
    entrance(m, { axis: 'z', sign: 1, plane: hz + 0.6 }, 0,
      { width: 5.0, height: 6.4, double: true, glazed: true, fanlight: true });
    marquee(m, -14, 14, hz + 7.2, 1, wall - 2.6, 2.4);
    flags(m, -30, 30, hz + 12.0, 0.2, 5, 10.0);
    // A fountain basin in the square, and a crowd on the steps.
    m.painted(TINT.NONE, () => m.cylinder(0, hz + 22.0, 6.0, 0.1, 1.0, 16, MAT.STONE, true));
    m.box([-5.4, 0.9, hz + 16.6], [5.4, 1.05, hz + 27.4], MAT.WATER);
    m.painted(TINT.NONE, () => m.cylinder(0, hz + 22.0, 1.0, 1.0, 4.0, 10, MAT.STONE, true));
    for (let i = 0; i < 10; i++) {
      figure(m, 1301 + i * 13, -18 + i * 4.0, hz + 6.0 + (i % 3) * 2.2, Math.PI, { stride: 0.22 });
    }
    for (const sx of [-40, 40]) tree(m, sx, hz + 14, 10.0, 3.6);
    bollards(m, { axis: 'z', sign: 1, plane: hz + 10.0 }, -hx, hx, 0.4, 12);
    roofClutter(m, -hx + 4, -hz + 4, -20, hz - 4, wall, 29, 0.3);
  }
  return m;
}

// ============================================================= 2. concert hall

/**
 * A concert hall: three metal shells over a glazed foyer on a waterside deck.
 *
 * The other way a city builds a cultural landmark, and the exact opposite of
 * the museum -- no facade at all, a roof that is the whole building, and a
 * foyer wrapped in glass so the crowd inside is what you see at night. The
 * shells are lofted rings rather than boxes, which is the only way this shape
 * exists.
 */
function concertHall(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;

  forecourt(m, -50, -42, 50, 30, 8623, { trees: 7, lamps: 8, people: 12, benches: 5 });
  // The deck, stepped down to the water on one side.
  m.box([-48, 0.1, -40], [48, 3.4, 26], MAT.CONCRETE);
  m.painted(TINT.NONE, () => {
    for (let k = 0; k < 4; k++) {
      m.box([-30, 0.1, 26 + k * 1.6], [30, 3.4 - k * 0.85, 27.6 + k * 1.6], MAT.CONCRETE);
    }
  });
  m.box([-48, 0.1, 33.0], [48, 0.6, 42], MAT.WATER);

  // The foyer: a glazed drum-ended box under the shells.
  m.box([-34, 3.4, -18], [34, 16.0, 16], MAT.GLASS);
  if (medium) {
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 22; i++) {
        const x = -34 + (i / 22) * 68;
        m.box([x - 0.2, 3.4, -18.3], [x + 0.2, 16.0, -17.7], MAT.TRIM);
        m.box([x - 0.2, 3.4, 15.7], [x + 0.2, 16.0, 16.3], MAT.TRIM);
      }
      for (const y of [8.0, 12.4]) {
        m.box([-34.3, y - 0.25, -18.3], [34.3, y + 0.25, 16.3], MAT.TRIM);
      }
    });
    // Three shells: half-cylinders of decreasing size, set at an angle to
    // each other, which is what stops them reading as one barrel.
    const shell = (cx: number, cz: number, r: number, len: number, tilt: number): void => {
      const segs = 12;
      for (let i = 0; i < segs; i++) {
        const a0 = Math.PI * (i / segs) * 0.92 + 0.04, a1 = Math.PI * ((i + 1) / segs) * 0.92 + 0.04;
        const p0: [number, number] = [Math.cos(a0) * r, Math.sin(a0) * r];
        const p1: [number, number] = [Math.cos(a1) * r, Math.sin(a1) * r];
        const t = Math.tan(tilt);
        m.quad([cx - len / 2, 8.0 + p0[1], cz + p0[0]],
               [cx + len / 2, 8.0 + p0[1] + len * t, cz + p0[0]],
               [cx + len / 2, 8.0 + p1[1] + len * t, cz + p1[0]],
               [cx - len / 2, 8.0 + p1[1], cz + p1[0]], MAT.METAL);
      }
      m.painted(TINT.METAL_DARK, () => {
        for (let k = 0; k <= 4; k++) {
          const x = cx - len / 2 + (k / 4) * len;
          for (let i = 0; i < segs; i++) {
            const a0 = Math.PI * (i / segs) * 0.92 + 0.04, a1 = Math.PI * ((i + 1) / segs) * 0.92 + 0.04;
            const t = Math.tan(tilt) * (k / 4) * len;
            m.pipe([x, 8.0 + Math.sin(a0) * r + t, cz + Math.cos(a0) * r],
                   [x, 8.0 + Math.sin(a1) * r + t, cz + Math.cos(a1) * r], 0.24, MAT.TRIM, 4);
          }
        }
      });
    };
    shell(-16.0, -2.0, 21.0, 30.0, 0.11);
    shell(14.0, 4.0, 16.0, 26.0, -0.09);
    shell(30.0, -8.0, 10.0, 18.0, 0.14);
  }
  if (fine) {
    // The auditorium wall behind the glass, the stage tower and the plant.
    m.box([-22, 3.4, -18], [22, 24.0, -6], MAT.CONCRETE, { roof: MAT.ROOF });
    m.box([-9, 24.0, -18], [9, 32.0, -8], MAT.CONCRETE, { roof: MAT.ROOF });
    roofClutter(m, -8, -17, 8, -9, 32.0, 61, 0.5);
    porteCochere(m, -12, 12, 16.4, 7.0, 7.4, 4);
    marquee(m, -18, 18, 16.6, 1, 17.4, 3.0);
    flags(m, -30, 30, 20.0, 3.4, 7, 9.0);
    for (let i = 0; i < 12; i++) {
      figure(m, 8623 + i * 11, -26 + i * 4.4, 20.0 + (i % 3) * 1.8, Math.PI, { stride: 0.24 });
    }
    for (const sx of [-42, 42]) tree(m, sx, 20, 9.0, 3.2);
    railing(m, -30, 30, 32.0, 3.4, 1.05, 2.4);
  }
  return m;
}

// ================================================================ 3. cathedral

/**
 * A cathedral: nave, transept, two west towers and a spire over the crossing.
 *
 * The tallest thing in a European city for eight hundred years and still the
 * one silhouette everybody recognises. Built as a real cross in plan with
 * aisles either side of the nave, a clerestory over them, buttresses taking
 * the thrust out to the aisle walls, and a rose window in the west front.
 */
function cathedral(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const nave = 9.0, aisle = 7.0, len = 52.0;
  const aisleH = 12.0, naveH = 22.0;

  forecourt(m, -44, -36, 44, 34, 4157, { trees: 8, lamps: 7, people: 11, benches: 5 });
  // The plan: a nave with aisles, a transept across it, a chancel beyond.
  m.box([-nave, 0.1, -len * 0.55], [nave, naveH, len * 0.45], MAT.STONE);
  for (const s of [-1, 1]) {
    m.box([s * nave, 0.1, -len * 0.55], [s * (nave + aisle), aisleH, len * 0.45], MAT.STONE);
  }
  m.box([-26.0, 0.1, -6.0], [26.0, naveH, 8.0], MAT.STONE);
  if (medium) {
    // Roofs: a steep lead roof over the nave, transept and chancel, and a
    // lower pitch over the aisles.
    m.gable([-nave - 0.5, naveH, -len * 0.55 - 0.5], [nave + 0.5, naveH, len * 0.45 + 0.5], 8.0, 'z', MAT.ROOF, MAT.STONE);
    m.gable([-26.5, naveH, -6.5], [26.5, naveH, 8.5], 7.0, 'x', MAT.ROOF, MAT.STONE);
    for (const s of [-1, 1]) {
      m.quad([s * nave, aisleH + 6.0, -len * 0.55], [s * nave, aisleH + 6.0, len * 0.45],
             [s * (nave + aisle + 0.5), aisleH, len * 0.45], [s * (nave + aisle + 0.5), aisleH, -len * 0.55], MAT.ROOF);
    }
    // Buttresses, and the flying arches from the clerestory out to them.
    m.painted(TINT.NONE, () => {
      for (let i = 0; i < 8; i++) {
        const z = -len * 0.5 + i * 6.4;
        if (z > -7 && z < 9) continue;
        for (const s of [-1, 1]) {
          m.box([s * (nave + aisle), 0.1, z - 0.8], [s * (nave + aisle + 2.4), aisleH + 2.0, z + 0.8], MAT.STONE);
          m.cone(s * (nave + aisle + 1.2), z, 1.4, 0.0, aisleH + 2.0, aisleH + 5.4, 4, MAT.STONE);
          m.pipe([s * (nave + aisle + 1.2), aisleH + 2.0, z], [s * nave, naveH - 3.0, z], 0.6, MAT.STONE, 4);
        }
      }
    });
    // Clerestory and aisle windows: tall lancets everywhere.
    for (const s of [1, -1] as const) {
      for (let i = 0; i < 8; i++) {
        const z = -len * 0.47 + i * 6.4;
        if (z > -7 && z < 9) continue;
        m.opening({
          axis: 'x', sign: s, plane: s * (nave + aisle), u0: z - 1.9, u1: z + 1.9,
          y0: 3.0, y1: 9.4, glass: MAT.PANE, frame: 0.24, proud: 0.12,
        });
        m.opening({
          axis: 'x', sign: s, plane: s * nave, u0: z - 1.6, u1: z + 1.6,
          y0: aisleH + 2.4, y1: naveH - 2.4, glass: MAT.PANE, frame: 0.24, proud: 0.12,
        });
      }
    }
  }
  if (medium) {
    // The two west towers, and the spire over the crossing.
    for (const s of [-1, 1]) {
      const cx = s * (nave + aisle * 0.5);
      m.box([cx - aisle * 0.5 - 0.6, 0.1, -len * 0.55 - 0.6], [cx + aisle * 0.5 + 0.6, 46.0, -len * 0.55 + 8.0], MAT.STONE);
      band(m, cx - aisle * 0.5 - 0.6, -len * 0.55 - 0.6, cx + aisle * 0.5 + 0.6, -len * 0.55 + 8.0, 45.0, 1.2, 0.7, MAT.STONE);
      for (const y of [20.0, 32.0]) {
        m.opening({
          axis: 'z', sign: -1, plane: -len * 0.55 - 0.6, u0: cx - 1.8, u1: cx + 1.8,
          y0: y, y1: y + 7.0, glass: MAT.DARK_TRIM, frame: 0.26, proud: 0.14,
        });
      }
      // Corner pinnacles.
      m.painted(TINT.NONE, () => {
        for (const px of [cx - aisle * 0.5 - 0.6, cx + aisle * 0.5 + 0.6]) {
          for (const pz of [-len * 0.55 - 0.6, -len * 0.55 + 8.0]) {
            m.box([px - 0.9, 44.0, pz - 0.9], [px + 0.9, 48.0, pz + 0.9], MAT.STONE);
            m.cone(px, pz, 1.1, 0.0, 48.0, 53.0, 4, MAT.STONE);
          }
        }
      });
    }
    m.box([-nave - 1.0, naveH, -1.0, ][0] === 0 ? [-nave, 0, 0] as never : [-nave - 1.0, naveH, -1.0],
      [nave + 1.0, 34.0, 3.0], MAT.STONE);
    m.cone(0, 1.0, nave + 1.6, 0.0, 34.0, 66.0, 8, MAT.ROOF);
    m.painted(TINT.METAL_DARK, () => m.cylinder(0, 1.0, 0.2, 66.0, 70.0, 5, MAT.TRIM, false));
  }
  if (fine) {
    // The west front: a great door and the rose window over it.
    entrance(m, { axis: 'z', sign: -1, plane: -len * 0.55 }, 0,
      { width: 5.4, height: 8.0, double: true, glazed: false, fanlight: true });
    m.painted(TINT.NONE, () => {
      m.cylinder(0, -len * 0.55 - 0.35, 5.6, 0, 0.1, 20, MAT.STONE, false);
    });
    for (let i = 0; i < 20; i++) {
      const a0 = (i / 20) * Math.PI * 2, a1 = ((i + 1) / 20) * Math.PI * 2;
      m.tri([0, 15.0, -len * 0.55 - 0.35],
            [Math.cos(a1) * 5.2, 15.0 + Math.sin(a1) * 5.2, -len * 0.55 - 0.35],
            [Math.cos(a0) * 5.2, 15.0 + Math.sin(a0) * 5.2, -len * 0.55 - 0.35], MAT.PANE);
      m.painted(TINT.NONE, () => {
        m.pipe([0, 15.0, -len * 0.55 - 0.5], [Math.cos(a0) * 5.6, 15.0 + Math.sin(a0) * 5.6, -len * 0.55 - 0.5], 0.22, MAT.STONE, 4);
      });
    }
    // The close: a low wall, yews, and people on the path.
    hedge(m, -34, 26.0, 34, 27.4, 1.1);
    for (const sx of [-28, -20, 20, 28]) tree(m, sx, 20.0, 9.0, 2.8);
    for (let i = 0; i < 8; i++) figure(m, 4157 + i * 13, -12 + i * 3.4, -len * 0.55 - 8.0, 0, { stride: 0.22 });
    kerb(m, -40, -32, 40, 30);
  }
  return m;
}

// ========================================================== 4. nuclear station

/**
 * A nuclear station: two containment domes, a turbine hall and the towers.
 *
 * The largest thing a player can build and the only silhouette in the library
 * visible across the whole map. What makes it read is the pair of hyperboloid
 * cooling towers -- a shape that exists nowhere else -- with the low white
 * containment domes and the long turbine hall in front of them.
 */
function nuclearStation(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;

  m.box([-78, 0.0005, -62], [78, 0.1, 62], MAT.GROUND);
  // Two hyperboloid cooling towers, as a loft between three rings.
  for (const cx of [-46.0, 6.0]) {
    const cz = -34.0;
    const N = 24;
    const ring = (r: number): Array<[number, number]> => {
      const out: Array<[number, number]> = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
      }
      return out;
    };
    const foot = ring(20.0), waist = ring(12.0), lip = ring(14.5);
    m.painted(TINT.NONE, () => {
      loft(m, foot, waist, 6.0, 52.0, MAT.CONCRETE);
      loft(m, waist, lip, 52.0, 74.0, MAT.CONCRETE);
      loft(m, scaled(lip, 0.97, 0.97), scaled(lip, 0.97, 0.97), 70.0, 74.0, MAT.DARK_TRIM);
    });
    if (medium) {
      // The A-frame legs the shell stands on: a real one has forty of them.
      m.painted(TINT.NONE, () => {
        for (let i = 0; i < N; i++) {
          const a = ((i + 0.5) / N) * Math.PI * 2;
          const px = cx + Math.cos(a) * 21.0, pz = cz + Math.sin(a) * 21.0;
          m.pipe([px, 0.1, pz], [cx + Math.cos(a) * 20.0, 6.0, cz + Math.sin(a) * 20.0], 0.55, MAT.CONCRETE, 4);
        }
      });
      m.painted(TINT.NONE, () => m.cylinder(cx, cz, 19.0, 0.1, 1.2, N, MAT.CONCRETE, true));
    }
  }
  // Two containment buildings: a cylinder with a shallow dome on it.
  for (const cx of [-30.0, 14.0]) {
    m.painted(TINT.NONE, () => {
      m.cylinder(cx, 14.0, 15.0, 0.1, 30.0, 20, MAT.CONCRETE, false);
      m.cone(cx, 14.0, 15.0, 11.0, 30.0, 36.0, 20, MAT.CONCRETE);
      m.cone(cx, 14.0, 11.0, 0.0, 36.0, 44.0, 20, MAT.CONCRETE);
    });
    if (medium) {
      m.painted(TINT.METAL_DARK, () => {
        for (const y of [10.0, 20.0]) m.cylinder(cx, 14.0, 15.2, y, y + 0.4, 20, MAT.TRIM, false);
        m.box([cx - 2.0, 0.1, 28.0], [cx + 2.0, 8.0, 30.0], MAT.TRIM);
      });
    }
  }
  // The turbine hall: one long clad building across the front of both.
  m.box([-58, 0.1, 34.0], [42, 24.0, 54.0], MAT.METAL, { roof: MAT.ROOF });
  if (medium) {
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 25; i++) {
        const x = -58 + (i / 25) * 100;
        m.box([x - 0.2, 0.1, 33.7], [x + 0.2, 24.0, 34.3], MAT.TRIM);
        m.box([x - 0.2, 0.1, 53.7], [x + 0.2, 24.0, 54.3], MAT.TRIM);
      }
      band(m, -58, 34.0, 42, 54.0, 22.6, 0.8, 0.35, MAT.TRIM);
    });
    m.box([-56, 14.0, 53.9], [40, 21.0, 54.4], MAT.GLASS);
    m.gable([-58.8, 24.0, 33.2], [42.8, 24.0, 54.8], 6.0, 'x', MAT.METAL, MAT.METAL);
  }
  if (fine) {
    // The switchyard: gantries, busbars and the transformer bank.
    for (let i = 0; i < 5; i++) {
      const x = 48 + 0, z = -44 + i * 10.0;
      lattice(m, x, z, 2.4, 2.4, 0.1, 22.0, 4);
      m.painted(TINT.METAL_DARK, () => {
        m.pipe([44.0, 20.0, z], [70.0, 20.0, z], 0.14, MAT.TRIM, 4);
        m.pipe([44.0, 15.0, z], [70.0, 15.0, z], 0.14, MAT.TRIM, 4);
      });
    }
    for (let i = 0; i < 4; i++) {
      const x = 46 + i * 8.0;
      m.box([x - 3.0, 0.1, 8.0], [x + 3.0, 6.0, 16.0], MAT.METAL, { roof: MAT.ROOF });
      m.painted(TINT.NONE, () => {
        for (const sz of [9.6, 14.4]) m.cylinder(x - 1.4, sz, 0.8, 6.0, 9.0, 8, MAT.CONCRETE, true);
      });
    }
    pipeRack(m, -58, 42, 28.0, 7.0, 4, 8);
    // The gatehouse, the fence and the car park.
    m.box([-8, 0.1, 56.0], [6, 5.0, 62.0], MAT.CONCRETE, { roof: MAT.ROOF });
    m.box([-7, 1.4, 55.6], [5, 3.8, 56.2], MAT.GLASS);
    m.painted(TINT.METAL_DARK, () => {
      for (let x = -76; x <= 76; x += 8) {
        m.cylinder(x, -60.0, 0.1, 0.1, 3.0, 4, MAT.TRIM, false);
        if (Math.abs(x) > 10) m.cylinder(x, 60.0, 0.1, 0.1, 3.0, 4, MAT.TRIM, false);
      }
      for (let z = -60; z <= 60; z += 8) {
        m.cylinder(-76.0, z, 0.1, 0.1, 3.0, 4, MAT.TRIM, false);
        m.cylinder(76.0, z, 0.1, 0.1, 3.0, 4, MAT.TRIM, false);
      }
    });
    marquee(m, -6, 6, 62.2, 1, 5.2, 2.0);
    flags(m, -24, 24, 58.0, 0.2, 3, 8.0);
    for (let i = 0; i < 4; i++) figure(m, 5507 + i * 13, -4 + i * 3.4, 58.0, Math.PI, { stride: 0.2 });
  }
  return m;
}

// ====================================================== 5. energy from waste

/**
 * An energy-from-waste plant: a tipping hall, the bunker, and a hundred-metre
 * stack.
 *
 * The other utility a city has to put somewhere and nobody wants next door,
 * and the one whose section is worth drawing: the lorries tip into a bunker
 * five storeys deep, a grab crane feeds the boiler above it, and the flue
 * gases go out through the only chimney in the library taller than a church.
 */
function energyFromWaste(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;

  m.box([-56, 0.0005, -44], [56, 0.1, 44], MAT.GROUND);
  // The boiler house: the tall block, stepped, with the bunker beside it.
  m.box([-14, 0.1, -20], [16, 46.0, 14], MAT.CLADDING, { roof: MAT.ROOF });
  m.box([-34, 0.1, -20], [-14, 34.0, 14], MAT.CONCRETE, { roof: MAT.ROOF });
  // The tipping hall: lower, wide, with the lorry doors in its long face.
  m.box([-40, 0.1, 14], [16, 15.0, 34], MAT.METAL, { roof: MAT.ROOF });
  if (medium) {
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 16; i++) {
        const x = -40 + (i / 16) * 56;
        m.box([x - 0.2, 0.1, 33.7], [x + 0.2, 15.0, 34.3], MAT.TRIM);
      }
      for (let i = 0; i <= 12; i++) {
        const y = 2.0 + i * 3.6;
        if (y > 44) break;
        m.box([-14.3, y - 0.2, -20.3], [16.3, y + 0.2, 14.3], MAT.TRIM);
      }
    });
    m.painted(TINT.BRAND, () => band(m, -14, -20, 16, 14, 43.0, 2.4, 0.5, MAT.CLADDING));
    // A glazed slot up the boiler house, which is what these are always given.
    m.box([-2.0, 6.0, 14.0], [6.0, 42.0, 14.4], MAT.GLASS);
    for (let i = 0; i < 5; i++) {
      const x = -36 + i * 11.0;
      m.painted(TINT.METAL_DARK, () => {
        m.box([x - 3.4, 0.1, 34.0], [x + 3.4, 6.4, 34.4], MAT.TRIM);
        m.box([x - 3.8, 6.4, 34.0], [x + 3.8, 6.9, 36.0], MAT.TRIM, { skipBottom: false });
      });
      m.box([x - 3.0, 0.6, 34.4], [x + 3.0, 6.0, 34.6], MAT.METAL);
    }
  }
  // The stack: a tapering concrete shell with the flues inside it.
  m.painted(TINT.NONE, () => {
    m.cone(30.0, -6.0, 5.6, 3.4, 0.1, 70.0, 16, MAT.CONCRETE);
    m.cylinder(30.0, -6.0, 3.4, 70.0, 96.0, 16, MAT.CONCRETE, false);
  });
  if (medium) {
    m.painted(TINT.METAL_DARK, () => {
      for (let k = 1; k < 8; k++) {
        const y = k * 12.0;
        const r = y < 70 ? 5.6 - (y / 70) * 2.2 : 3.4;
        m.cylinder(30.0, -6.0, r + 0.25, y, y + 0.4, 16, MAT.TRIM, false);
      }
      m.box([34.4, 0.1, -6.4], [34.8, 96.0, -5.6], MAT.TRIM);
    });
    m.painted(TINT.SIGN_LIT, () => {
      for (const y of [48.0, 92.0]) m.box([26.2, y, -6.5], [27.0, y + 0.8, -5.5], MAT.LAMP);
    });
  }
  if (fine) {
    // The grab crane over the bunker, and the residue silos.
    m.painted(TINT.METAL_DARK, () => {
      m.box([-33, 30.0, -18], [-15, 32.0, 12], MAT.TRIM);
      m.box([-27, 24.0, -6], [-21, 30.0, 2], MAT.TRIM, { roof: MAT.ROOF });
      for (const sx of [-26.0, -22.0]) m.pipe([sx, 24.0, -2.0], [sx, 12.0, -2.0], 0.1, MAT.TRIM, 4);
      m.box([-27.4, 8.0, -5.0], [-20.6, 12.0, 1.0], MAT.TRIM);
    });
    for (let i = 0; i < 3; i++) {
      silo(m, 26.0 + i * 11.0, 24.0, 4.0, 0.1, 22.0, { cone: 3.0, ribs: 3, mat: MAT.METAL });
    }
    conveyor(m, [16.0, 30.0, 4.0], [26.0, 24.0, 20.0], 1.6);
    pipeRack(m, -12, 26, -26.0, 7.0, 4, 5);
    // The weighbridge and the lorry lane in.
    m.painted(TINT.NONE, () => {
      m.box([-20, 0.09, 36.0], [8, 0.14, 42.0], MAT.CONCRETE);
      for (let i = 0; i < 5; i++) m.box([-38 + i * 11 - 0.09, 0.1, 34.0], [-38 + i * 11 + 0.09, 0.12, 42.0], MAT.PLATE);
    });
    m.box([12.0, 0.1, 36.0], [20.0, 4.4, 42.0], MAT.CONCRETE, { roof: MAT.ROOF });
    m.box([11.6, 1.4, 36.4], [12.2, 3.2, 41.6], MAT.GLASS);
    marquee(m, -10, 10, 34.6, 1, 10.0, 2.6);
    hedge(m, -54, 42.0, 54, 43.2, 1.0);
    for (const sx of [-48, 48]) tree(m, sx, 38, 9.0, 3.2);
    for (let i = 0; i < 4; i++) figure(m, 6607 + i * 11, -6 + i * 4, 38.0, Math.PI, { stride: 0.2 });
  }
  return m;
}

// ============================================================== 6. observatory

/**
 * An observatory: a rotating dome with an open shutter, on a drum.
 *
 * Small, and the most recognisable shape in this file after the cooling tower.
 * The dome is drawn with its shutter open and the telescope visible in the
 * slot, because a closed dome is a white ball and an open one is an
 * observatory.
 */
function observatory(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const N = 20;

  forecourt(m, -30, -26, 30, 22, 7717, { trees: 6, lamps: 5, people: 5, benches: 3 });
  // The drum, on a stone plinth, with the lecture wing beside it.
  m.painted(TINT.NONE, () => m.cylinder(0, 0, 12.5, 0.1, 2.0, N, MAT.STONE, false));
  m.painted(TINT.NONE, () => m.cylinder(0, 0, 11.0, 2.0, 15.0, N, MAT.RENDER, false));
  m.box([-24.0, 0.1, -8.0], [-10.0, 9.0, 10.0], MAT.RENDER, { roof: MAT.ROOF });
  m.box([10.0, 0.1, -8.0], [24.0, 9.0, 10.0], MAT.RENDER, { roof: MAT.ROOF });
  if (medium) {
    m.painted(TINT.NONE, () => {
      m.cylinder(0, 0, 11.6, 14.2, 15.4, N, MAT.STONE, false);
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        m.box([Math.cos(a) * 11.0 - 0.28, 3.0, Math.sin(a) * 11.0 - 0.28],
              [Math.cos(a) * 11.4 + 0.28, 14.2, Math.sin(a) * 11.4 + 0.28], MAT.RENDER);
      }
    });
    for (let i = 0; i < N; i += 2) {
      const a = ((i + 0.5) / N) * Math.PI * 2;
      m.opening({
        axis: Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? 'x' : 'z',
        sign: (Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? Math.sign(Math.cos(a)) : Math.sign(Math.sin(a))) as 1 | -1,
        plane: Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? Math.cos(a) * 11.0 : Math.sin(a) * 11.0,
        u0: (Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? Math.sin(a) * 11.0 : Math.cos(a) * 11.0) - 1.2,
        u1: (Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? Math.sin(a) * 11.0 : Math.cos(a) * 11.0) + 1.2,
        y0: 5.0, y1: 9.6, glass: MAT.PANE, frame: 0.16, proud: 0.09,
      });
    }
    for (const [cx, s] of [[-17.0, -1], [17.0, 1]] as const) {
      band(m, cx - 7.0, -8.0, cx + 7.0, 10.0, 8.2, 0.8, 0.4, MAT.STONE);
      m.windowRow({
        axis: 'z', sign: 1, plane: 10.0, from: cx - 6, to: cx + 6, y0: 1.6, y1: 6.4,
        count: 4, width: 1.9, glass: MAT.PANE, frame: 0.14, proud: 0.08,
      });
      void s;
    }
  }
  // The dome: a hemisphere, with a shutter slot cut out of it.
  const segs = 10;
  for (let i = 0; i < segs; i++) {
    const a0 = (Math.PI / 2) * (i / segs), a1 = (Math.PI / 2) * ((i + 1) / segs);
    for (let k = 0; k < N; k++) {
      const b0 = (k / N) * Math.PI * 2, b1 = ((k + 1) / N) * Math.PI * 2;
      // The slot: two segments left out, so the telescope shows through.
      if (k === 0 || k === N - 1) continue;
      const r0 = Math.cos(a0) * 11.6, r1 = Math.cos(a1) * 11.6;
      const y0 = 15.4 + Math.sin(a0) * 9.0, y1 = 15.4 + Math.sin(a1) * 9.0;
      m.quad([Math.cos(b1) * r0, y0, Math.sin(b1) * r0], [Math.cos(b0) * r0, y0, Math.sin(b0) * r0],
             [Math.cos(b0) * r1, y1, Math.sin(b0) * r1], [Math.cos(b1) * r1, y1, Math.sin(b1) * r1], MAT.METAL);
    }
  }
  if (medium) {
    // The shutter leaves, run back either side of the slot.
    m.painted(TINT.METAL_DARK, () => {
      for (const s of [-1, 1]) {
        for (let i = 0; i < segs; i++) {
          const a0 = (Math.PI / 2) * (i / segs), a1 = (Math.PI / 2) * ((i + 1) / segs);
          const r0 = Math.cos(a0) * 12.0, r1 = Math.cos(a1) * 12.0;
          const y0 = 15.4 + Math.sin(a0) * 9.3, y1 = 15.4 + Math.sin(a1) * 9.3;
          const b = s * 0.32;
          m.pipe([Math.cos(b) * r0, y0, Math.sin(b) * r0], [Math.cos(b) * r1, y1, Math.sin(b) * r1], 0.28, MAT.TRIM, 4);
        }
      }
      // The telescope tube in the slot.
      m.pipe([-2.0, 18.0, 0], [7.0, 26.5, 0], 1.9, MAT.METAL, 10);
      m.box([-3.2, 16.4, -2.2], [0.4, 18.6, 2.2], MAT.TRIM);
    });
  }
  if (fine) {
    entrance(m, { axis: 'z', sign: 1, plane: 10.0 }, -17.0,
      { width: 2.2, height: 3.2, double: true, glazed: true, fanlight: true });
    marquee(m, -8, 8, 11.4, 1, 3.6, 1.8);
    m.box([-9.0, 0.1, 8.0], [9.0, 4.2, 12.0], MAT.STONE, { roof: MAT.ROOF });
    for (const sx of [-26, 26]) tree(m, sx, 14, 8.0, 3.0);
    for (let i = 0; i < 5; i++) figure(m, 7717 + i * 11, -8 + i * 4, 15.0, Math.PI, { stride: 0.2 });
    railing(m, -12, 12, 16.0, 0.1, 1.0, 2.4);
    roofClutter(m, -22, -6, -12, 8, 9.0, 31, 0.4);
  }
  return m;
}

// ========================================================= 7. maternity hospital

/**
 * A maternity hospital: a curved ward block over a glazed arrivals canopy.
 *
 * The hospital in the library is a general one -- a slab with a helipad. This
 * is the other kind: smaller, curved so every room faces the garden, with the
 * ambulance canopy and the drop-off that a maternity unit is mostly used
 * through, and a courtyard garden rather than a car park behind it.
 */
function maternityHospital(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const floors = 6, floorH = 3.8, base = 6.0;
  const top = base + floors * floorH;
  const N = 18, R = 70.0, span = 0.86, depth = 15.0;
  const arc = (r: number): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    for (let i = 0; i <= N; i++) {
      const a = -span / 2 + (i / N) * span - Math.PI / 2;
      out.push([Math.cos(a) * r, Math.sin(a) * r + R - 20.0]);
    }
    return out;
  };
  const outer = arc(R), inner = arc(R - depth);

  forecourt(m, -44, -34, 44, 28, 9403, { trees: 8, lamps: 7, people: 9, benches: 4 });
  for (let i = 0; i < N; i++) {
    const a = outer[i], b = outer[i + 1], c = inner[i], d = inner[i + 1];
    m.quad([b[0], 0.1, b[1]], [a[0], 0.1, a[1]], [a[0], top, a[1]], [b[0], top, b[1]], MAT.RENDER);
    m.quad([c[0], 0.1, c[1]], [d[0], 0.1, d[1]], [d[0], top, d[1]], [c[0], top, c[1]], MAT.RENDER);
    lid(m, [a, b, d, c], top, MAT.ROOF);
    lid(m, [a, b, d, c], 0.1, MAT.GROUND);
    // The parapet, following the arc. It used to be an axis-aligned rectangle
    // laid over a curved building, which stood off the roof on three sides
    // and read as a frame hanging in the air above it.
    if (medium) {
      for (const [p, q, o] of [[a, b, -0.3], [c, d, 0.3]] as const) {
        m.quad([q[0], top, q[1] + o], [p[0], top, p[1] + o],
               [p[0], top + 1.1, p[1] + o], [q[0], top + 1.1, q[1] + o], MAT.CONCRETE);
      }
      lid(m, [[a[0], a[1] - 0.3], [b[0], b[1] - 0.3], [b[0], b[1]], [a[0], a[1]]], top + 1.1, MAT.CONCRETE);
      lid(m, [[c[0], c[1] + 0.3], [d[0], d[1] + 0.3], [d[0], d[1]], [c[0], c[1]]], top + 1.1, MAT.CONCRETE);
    }
    if (medium) {
      // Ribbon glazing on both faces, with a slab band between floors.
      for (let f = 0; f < floors; f++) {
        const y = base + f * floorH;
        m.quad([b[0], y + 0.9, b[1] - 0.16], [a[0], y + 0.9, a[1] - 0.16],
               [a[0], y + floorH - 0.8, a[1] - 0.16], [b[0], y + floorH - 0.8, b[1] - 0.16], MAT.PANE);
        m.quad([c[0], y + 0.9, c[1] + 0.16], [d[0], y + 0.9, d[1] + 0.16],
               [d[0], y + floorH - 0.8, d[1] + 0.16], [c[0], y + floorH - 0.8, c[1] + 0.16], MAT.PANE);
      }
      m.painted(TINT.BRAND, () => {
        m.quad([b[0], base - 0.9, b[1] - 0.3], [a[0], base - 0.9, a[1] - 0.3],
               [a[0], base, a[1] - 0.3], [b[0], base, b[1] - 0.3], MAT.CLADDING);
      });
      // The ground floor glazed the whole way round the outside.
      m.quad([b[0], 1.0, b[1] - 0.22], [a[0], 1.0, a[1] - 0.22],
             [a[0], base - 1.2, a[1] - 0.22], [b[0], base - 1.2, b[1] - 0.22], MAT.GLASS);
    }
  }
  if (medium) {
    // The two ends of the ward block. A curved slab drawn as a front skin, a
    // back skin and a lid has nothing across its ends, so you looked straight
    // through the building from either side of it.
    for (const [i, out] of [[0, false], [N, true]] as const) {
      const f = outer[i], b = inner[i];
      if (out) m.quad([b[0], 0.1, b[1]], [f[0], 0.1, f[1]], [f[0], top, f[1]], [b[0], top, b[1]], MAT.RENDER);
      else m.quad([f[0], 0.1, f[1]], [b[0], 0.1, b[1]], [b[0], top, b[1]], [f[0], top, f[1]], MAT.RENDER);
      // A stair window on each floor, so the flank is not blank either.
      for (let fl = 1; fl < floors; fl++) {
        const y = base + fl * floorH;
        const px = f[0] + (b[0] - f[0]) * 0.42, pz = f[1] + (b[1] - f[1]) * 0.42;
        m.opening({ axis: 'x', sign: out ? 1 : -1, plane: px, u0: pz - 1.5, u1: pz + 1.5,
          y0: y + 0.9, y1: y + floorH - 0.9, glass: MAT.PANE, frame: 0.12, proud: 0.07 });
      }
    }
    // The plant enclosure and the lift overrun on the roof.
    m.box([-10, top + 1.1, -12], [10, top + 5.3, -2], MAT.CLADDING, { roof: MAT.ROOF });
  }
  if (fine) {
    roofClutter(m, -30, -16, -12, 0, top + 1.1, 43, 0.5);
    // The arrivals canopy, and the ambulance bay beside it.
    porteCochere(m, -13, 13, -22.0, 8.0, 6.4, 4);
    marquee(m, -16, 16, -22.2, -1, 7.2, 2.6);
    m.painted(TINT.METAL_DARK, () => {
      m.box([16.0, 5.4, -30.0], [36.0, 6.0, -18.0], MAT.TRIM, { skipBottom: false });
      for (const sx of [18.0, 34.0]) for (const pz of [-28.5, -19.5]) m.cylinder(sx, pz, 0.26, 0.1, 5.4, 6, MAT.TRIM, false);
    });
    m.painted(TINT.NONE, () => {
      for (let i = 0; i < 3; i++) m.box([18 + i * 6 - 0.09, 0.09, -30.0], [18 + i * 6 + 0.09, 0.11, -18.0], MAT.PLATE);
    });
    // The garden inside the arc.
    m.painted(TINT.GREEN, () => m.box([-26, 0.12, 4.0], [26, 0.3, 22.0], MAT.TRIM));
    for (const sx of [-20, -7, 7, 20]) tree(m, sx, 13.0, 8.0, 2.8);
    hedge(m, -28, 2.4, 28, 3.4, 0.8);
    for (let i = 0; i < 5; i++) bench(m, -16 + i * 8, 7.0, 0);
    for (let i = 0; i < 8; i++) figure(m, 9403 + i * 13, -18 + i * 5.0, -26.0, 0, { stride: 0.22 });
    flags(m, -20, 20, -32.0, 0.2, 3, 8.0);
    bollards(m, { axis: 'z', sign: -1, plane: -32.0 }, -30, 30, 0.4, 10);
  }
  return m;
}

// ============================================================ 8. coach station

/**
 * A coach station: four island platforms under one long canopy.
 *
 * The transport asset the library was missing, and the one whose whole design
 * is a roof over a piece of ground. The canopy is a vaulted deck on a single
 * line of columns down each island, the concourse is at one end, and the bays
 * are marked out at an angle because that is how a coach reverses on to one.
 */
function coachStation(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;

  m.box([-48, 0.0005, -32], [48, 0.09, 32], MAT.GROUND);
  kerb(m, -46, -30, 46, 30);
  // The concourse: a glazed hall at the west end with a clock on it.
  m.box([-46, 0.1, -26], [-26, 12.0, 26], MAT.CONCRETE, { roof: MAT.ROOF });
  if (medium) {
    curtain(m, -45.4, -25.6, -26.4, 25.6, 0.6, 3, 3.6, { mullions: 3.2 });
    m.painted(TINT.BRAND, () => band(m, -46, -26, -26, 26, 10.6, 1.6, 0.5, MAT.CLADDING));
    m.painted(TINT.SIGN_LIT, () => m.cylinder(-25.9, 0, 2.4, 6.0, 6.2, 14, MAT.PLATE, true));
  }
  // Three islands, each with a canopy on a single line of columns.
  for (let k = 0; k < 3; k++) {
    const cz = -18.0 + k * 18.0;
    m.painted(TINT.NONE, () => m.box([-24, 0.09, cz - 3.0], [44, 0.32, cz + 3.0], MAT.CONCRETE));
    if (medium) {
      barrelVault(m, -24, cz - 8.0, 44, cz + 8.0, 6.4, 2.6, 6, { ribs: 8, glass: MAT.GLASS });
      m.painted(TINT.METAL_DARK, () => {
        for (let i = 0; i <= 8; i++) {
          const x = -22 + (i / 8) * 64;
          m.cylinder(x, cz, 0.36, 0.32, 6.4, 8, MAT.TRIM, false);
          m.pipe([x, 6.4, cz - 7.6], [x, 6.4, cz + 7.6], 0.2, MAT.TRIM, 4);
        }
      });
    }
    if (fine) {
      // The bays, marked out at an angle, with a stand sign over each.
      m.painted(TINT.NONE, () => {
        for (let i = 0; i < 6; i++) {
          const x = -20 + i * 11.0;
          for (const s of [-1, 1]) {
            m.box([x - 0.1, 0.09, cz + s * 3.2], [x + 0.1, 0.11, cz + s * 8.6], MAT.PLATE);
            m.box([x + 4.4, 0.09, cz + s * 3.2], [x + 4.6, 0.11, cz + s * 8.6], MAT.PLATE);
          }
        }
      });
      for (let i = 0; i < 5; i++) {
        const x = -16 + i * 11.0;
        m.painted(TINT.SIGN_LIT, () => m.box([x - 1.1, 4.4, cz - 0.2], [x + 1.1, 5.6, cz + 0.2], MAT.PLATE));
      }
      for (let i = 0; i < 4; i++) bench(m, -14 + i * 14, cz, 1);
      for (let i = 0; i < 4; i++) {
        figure(m, 2609 + k * 31 + i * 11, -18 + i * 12.0, cz + 1.6, k % 2 ? 1.4 : 4.6, { stride: 0.22 });
      }
    }
  }
  if (fine) {
    marquee(m, -44, -28, 26.4, 1, 8.4, 2.8);
    flags(m, -44, -28, 30.0, 0.1, 3, 8.0);
    railing(m, -24, 44, 29.0, 0.1, 1.05, 2.6);
    for (const sx of [-40, 40]) tree(m, sx, -30, 8.0, 3.0);
    roofClutter(m, -44, -24, -28, 24, 12.0, 53, 0.4);
    for (let i = 0; i < 4; i++) planter(m, -40 + i * 5, 28.0, 1.2, 0.6);
  }
  return m;
}

// ====================================================================== table

const civ = (jobs: number, upkeep: number, power: number, water: number): AssetDef['sim'] => ({
  jobs, powerKW: power, waterM3: water, garbagePerWeek: jobs * 8, pollution: 0, upkeep,
});

export const SERVICE_LANDMARKS: AssetDef[] = [
  {
    id: 'svc.gov.museum', name: 'City museum', zone: 'service', branch: 'government',
    density: 'none', variant: 'sculpted', footprint: [14, 14], height: 0,
    brand: { name: 'City Museum', colour: [0.28, 0.26, 0.30], accent: [0.66, 0.58, 0.34], sign: 'box' },
    sim: civ(120, 1400, 620, 220),
    note: 'An eight-column portico and pediment over a flight of steps the width of the front, two pilastered wings, and a colonnaded drum with a two-stage lead dome and a lit lantern over the hall; fountain and square in front.',
    build: museum,
  },
  {
    id: 'svc.gov.concert', name: 'Concert hall', zone: 'service', branch: 'government',
    density: 'none', variant: 'sculpted', footprint: [13, 11], height: 0,
    brand: { name: 'Concert Hall', colour: [0.20, 0.24, 0.34], accent: [0.72, 0.58, 0.26], sign: 'box' },
    sim: civ(90, 1600, 900, 200),
    note: 'Three tilted metal shells over a fully glazed foyer on a stepped waterside deck, with the auditorium and stage tower behind them and a canopied drop-off in front.',
    build: concertHall,
  },
  {
    id: 'svc.death.cathedral', name: 'Cathedral', zone: 'service', branch: 'deathcare',
    density: 'none', variant: 'sculpted', footprint: [11, 10], height: 0,
    brand: { name: 'Cathedral', colour: [0.40, 0.38, 0.34], accent: [0.58, 0.54, 0.44], sign: 'box' },
    sim: civ(24, 620, 120, 90),
    note: 'A cruciform plan with aisles, clerestory and flying buttresses, two forty-six metre west towers with pinnacles, a rose window over the great door and a seventy-metre spire over the crossing.',
    build: cathedral,
  },
  {
    id: 'svc.power.nuclear', name: 'Nuclear station', zone: 'service', branch: 'power',
    density: 'none', variant: 'sculpted', footprint: [20, 16], height: 0,
    brand: { name: 'Nuclear', colour: [0.26, 0.30, 0.34], accent: [0.74, 0.62, 0.14], sign: 'box' },
    sim: civ(420, 5200, 0, 3200),
    note: 'Two seventy-four metre hyperboloid cooling towers on forty A-frame legs, two containment domes, a hundred-metre turbine hall, a five-gantry switchyard, four transformer bays and a fenced perimeter.',
    build: nuclearStation,
  },
  {
    id: 'svc.power.waste', name: 'Energy from waste', zone: 'service', branch: 'power',
    density: 'none', variant: 'sculpted', footprint: [14, 11], height: 0,
    brand: { name: 'Energy Recovery', colour: [0.20, 0.34, 0.30], accent: [0.72, 0.60, 0.20], sign: 'box' },
    sim: civ(140, 2200, 0, 700),
    note: 'A forty-six metre boiler house over a bunker with the grab crane working in it, a five-door tipping hall, three residue silos, a weighbridge, and a ninety-six metre tapering concrete stack with aircraft lights on it.',
    build: energyFromWaste,
  },
  {
    id: 'svc.edu.observatory', name: 'Observatory', zone: 'service', branch: 'education',
    density: 'none', variant: 'sculpted', footprint: [8, 7], height: 0,
    brand: { name: 'Observatory', colour: [0.22, 0.26, 0.36], accent: [0.66, 0.64, 0.52], sign: 'box' },
    sim: civ(30, 420, 180, 60),
    note: 'A rotating steel dome with its shutter open and the telescope tube showing in the slot, on a rendered drum with a stone cornice, between two single-storey lecture wings.',
    build: observatory,
  },
  {
    id: 'svc.health.maternity', name: 'Maternity hospital', zone: 'service', branch: 'health',
    density: 'none', variant: 'sculpted', footprint: [11, 9], height: 0,
    brand: { name: 'Maternity', colour: [0.24, 0.36, 0.40], accent: [0.72, 0.56, 0.52], sign: 'box' },
    sim: civ(260, 2400, 1100, 900),
    note: 'A six-storey ward block bent into an arc so every room faces the garden inside it, ribbon glazing on both faces, a canopied drop-off, a three-bay ambulance canopy and a planted courtyard behind.',
    build: maternityHospital,
  },
  {
    id: 'svc.transport.coach', name: 'Coach station', zone: 'service', branch: 'transport',
    density: 'none', variant: 'sculpted', footprint: [12, 9], height: 0,
    brand: { name: 'Coach Station', colour: [0.18, 0.32, 0.44], accent: [0.74, 0.60, 0.20], sign: 'box' },
    sim: civ(60, 900, 380, 120),
    note: 'Three island platforms under vaulted canopies on a single line of columns each, thirty marked bays with lit stand numbers, and a glazed three-storey concourse with a clock at the west end.',
    build: coachStation,
  },
];
