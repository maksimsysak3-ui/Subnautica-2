/**
 * Three services the library was missing.
 *
 * The gaps were real rather than cosmetic. There is an energy-from-waste plant
 * but nothing that sorts and bales the recyclate, so the waste chain ended in
 * a chimney; there are five kinds of park and none of them is a destination
 * anybody crosses a city for; and the museum is a classical one, which leaves
 * nowhere for a city to put the modern collection. Each of these is a shape
 * the library does not already have.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import {
  barrelVault, campanile, cap, conveyor, flags, forecourt, lid, loft, marquee,
  pipeRack, plan, porteCochere, sawtooth, scaled, shelf, silo,
} from './signature-parts';
import { band, bollards, entrance, parapet, planter, roofClutter } from '../parts';
import { bench, hedge, tree } from './landscape';
import { figure } from './vehicles';

// ------------------------------------------------------- 1. recycling centre

/**
 * A materials recovery facility: tip on one side, bales out the other.
 *
 * The building is a diagram of the process and is best drawn as one. Lorries
 * back into the tipping hall at the low end; the picking line runs along a
 * glazed gallery above the floor, which is the only part of the process a
 * visitor ever sees and so the only part expressed; and the sorted material
 * comes out as bales that stack in the yard. The building steps up from the
 * tipping end to the baler end because the material moves that way.
 */
function recyclingCentre(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 34.0, hz = 21.0;

  forecourt(m, -44, -30, 44, 30, 3313, { trees: 4, lamps: 6, people: 5, benches: 1 });
  m.box([-hx - 6, 0.1, -hz - 7], [hx + 6, 0.3, hz + 7], MAT.CONCRETE);

  // The hall, stepping up from the tipping end.
  m.box([-hx, 0.3, -hz], [-4.0, 13.0, hz], MAT.SHED_WALL, { roof: MAT.ROOF });
  m.box([-4.0, 0.3, -hz], [hx, 19.5, hz], MAT.SHED_WALL, { roof: MAT.ROOF });
  if (medium) {
    sawtooth(m, -4.0, -hz, hx, hz, 19.5, 5, 4.2, MAT.METAL);
    parapet(m, -hx, -hz, -4.0, hz, 13.0, 0.9, 0.24, MAT.METAL);
    // The picking gallery: glazed, along the whole street face, at the level
    // the sorting line actually runs.
    m.box([-hx + 2, 8.4, hz - 0.1], [hx - 4, 12.6, hz + 2.2], MAT.GLASS);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 14; i++) {
        const x = -hx + 2 + (i / 14) * (2 * hx - 6);
        m.box([x - 0.18, 8.2, hz + 0.2], [x + 0.18, 12.8, hz + 2.4], MAT.TRIM);
      }
      m.box([-hx + 2, 12.6, hz - 0.1], [hx - 4, 13.3, hz + 2.6], MAT.TRIM, { skipBottom: false });
      for (let i = 0; i < 5; i++) {
        const x = -hx + 6 + i * 12;
        m.box([x - 0.3, 0.3, hz + 2.0], [x + 0.3, 8.4, hz + 2.6], MAT.TRIM);
      }
    });
    // The tipping doors, and the ribs down the long flank.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 4; i++) {
        const z = -hz + 3.4 + i * 9.0;
        m.box([-hx - 0.4, 0.4, z - 3.2], [-hx + 0.2, 9.4, z + 3.2], MAT.TRIM);
      }
      for (let i = 0; i < 9; i++) {
        const x = -hx + 4 + i * 8;
        m.box([x - 0.25, 0.3, -hz - 0.5], [x + 0.25, x < -4 ? 13.0 : 19.5, -hz + 0.1], MAT.TRIM);
      }
    });
    // Three silos for the bulked glass, and the conveyor that feeds them.
    for (let i = 0; i < 3; i++) {
      silo(m, hx + 3.4, -hz + 6 + i * 9.0, 3.0, 0.3, 15.0,
        { cone: 3.0, ribs: medium ? 3 : 0, mat: MAT.METAL, tint: TINT.NONE });
    }
    conveyor(m, [hx - 6, 18.0, 0], [hx + 3.4, 16.0, -hz + 15.0], 1.9);
  }
  if (fine) {
    // The bale yard. Sorted material leaves as blocks and they stack, which is
    // the one thing that says what this building is for.
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 6; c++) {
        const x = -hx + 4 + c * 6.2, z = hz + 4.0 + r * 2.6;
        const h = 1.1 + ((c * 7 + r * 3) % 3) * 1.1;
        m.painted([TINT.BRAND, TINT.ACCENT, TINT.GREEN][(c + r) % 3], () => {
          m.box([x, 0.3, z], [x + 5.0, 0.3 + h, z + 2.2], MAT.CONTAINER);
        });
      }
    }
    m.box([-hx - 5.4, 0.3, -hz + 2], [-hx - 1.0, 4.2, -hz + 9], MAT.CONCRETE, { roof: MAT.ROOF });
    m.painted(TINT.METAL_DARK, () => m.box([-hx - 6.0, 0.3, -hz - 1.0], [-hx - 0.4, 0.5, -hz + 1.4], MAT.PLATE));
    entrance(m, { axis: 'z', sign: 1, plane: hz + 2.6 }, -hx + 8, { width: 2.2, height: 2.6 });
    m.painted(TINT.BRAND, () => m.box([-hx + 3, 14.0, hz + 0.1], [-6, 17.6, hz + 0.5], MAT.CLADDING));
    for (let i = 0; i < 5; i++) figure(m, 7703 + i * 13, -20 + i * 10, hz + 3.4, 1.4, { stride: 0.22 });
    for (const sx of [-1, 1]) tree(m, sx * 40, -26, 7.0, 2.6);
    pipeRack(m, -hx + 2, hx - 8, -hz - 4.5, 5.0, 3, 6);
    roofClutter(m, -hx + 3, -hz + 3, -6, hz - 3, 13.0, 55, 0.6);
  }
  return m;
}

// --------------------------------------------------------------- 2. the zoo

/**
 * A zoo: a gate you queue at, and enclosures you walk between.
 *
 * The only park in the library that is a destination rather than a place. It
 * has to read as one from the air, so what it is made of is enclosures --
 * fenced paddocks with shelters in them, a pool, and an aviary big enough to
 * be the thing you see first -- laid out along a path rather than a grid,
 * because a zoo that is on a grid reads as a car park with animals in it.
 */
function zoo(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 46.0, hz = 34.0;

  forecourt(m, -hx - 4, -hz - 6, hx + 4, hz + 6, 8123, { trees: 10, lamps: 8, people: 14, benches: 5 });
  m.painted(TINT.GREEN, () => m.box([-hx, 0.11, -hz], [hx, 0.26, hz], MAT.TRIM));

  // The entrance range: ticket hall, shop and the arch you go through.
  m.box([-16.0, 0.1, hz - 7.0], [16.0, 7.2, hz], MAT.TIMBER, { roof: MAT.ROOF });
  if (medium) {
    m.box([-5.0, 0.1, hz - 7.4], [5.0, 6.0, hz + 0.4], MAT.SHED_WALL);
    m.painted(TINT.BRAND, () => m.box([-15.0, 7.2, hz - 5.0], [15.0, 10.6, hz - 4.4], MAT.CLADDING));
    m.box([-15.0, 1.2, hz - 0.2], [-6.0, 5.4, hz + 0.2], MAT.GLASS);
    m.box([6.0, 1.2, hz - 0.2], [15.0, 5.4, hz + 0.2], MAT.GLASS);
    barrelVault(m, -16.0, hz - 7.0, 16.0, hz, 7.2, 3.4, 9, { ribs: 7 });
  }

  /** One enclosure: a fenced paddock with a shelter and a feed rack in it. */
  const pen = (cx: number, cz: number, w: number, d: number, seed: number): void => {
    m.painted(TINT.GREEN_DARK, () => m.box([cx - w, 0.26, cz - d], [cx + w, 0.34, cz + d], MAT.TRIM));
    if (!medium) return;
    m.painted(TINT.METAL_DARK, () => {
      const n = Math.max(3, Math.round(w / 2.4));
      for (let i = 0; i <= n; i++) {
        const x = cx - w + (i / n) * w * 2;
        for (const sz of [-1, 1]) m.box([x - 0.11, 0.3, cz + sz * d - 0.11], [x + 0.11, 2.5, cz + sz * d + 0.11], MAT.TRIM);
      }
      const k = Math.max(3, Math.round(d / 2.4));
      for (let i = 0; i <= k; i++) {
        const z = cz - d + (i / k) * d * 2;
        for (const sx of [-1, 1]) m.box([cx + sx * w - 0.11, 0.3, z - 0.11], [cx + sx * w + 0.11, 2.5, z + 0.11], MAT.TRIM);
      }
      for (const sz of [-1, 1]) {
        m.box([cx - w, 2.3, cz + sz * d - 0.09], [cx + w, 2.5, cz + sz * d + 0.09], MAT.TRIM);
      }
    });
    // The shelter, turned away from the path.
    m.box([cx - w * 0.42, 0.3, cz - d * 0.55], [cx + w * 0.42, 3.4, cz - d * 0.05], MAT.TIMBER);
    m.gable([cx - w * 0.48, 3.4, cz - d * 0.6], [cx + w * 0.48, 3.4, cz + d * 0.0], 1.5, 'x', MAT.METAL, MAT.TIMBER);
    if (fine) {
      for (let i = 0; i < 3; i++) tree(m, cx - w * 0.6 + i * w * 0.6, cz + d * 0.5, 5.0 + (seed % 3), 1.8);
      m.painted(TINT.WOOD, () => m.box([cx + w * 0.5, 0.3, cz + d * 0.2], [cx + w * 0.5 + 1.6, 1.9, cz + d * 0.2 + 0.3], MAT.TIMBER));
    }
  };

  pen(-30, 10, 14, 11, 3);
  pen(-30, -16, 14, 10, 5);
  pen(2, -18, 16, 10, 7);
  pen(30, 8, 13, 12, 11);

  // The pool, sunk with a viewing wall along the path side.
  m.painted(TINT.NONE, () => m.box([-4.0, 0.26, 4.0], [20.0, 0.34, 20.0], MAT.CONCRETE));
  m.box([-2.5, 0.3, 5.5], [18.5, 1.4, 18.5], MAT.WATER);
  if (medium) {
    m.box([-4.0, 0.3, 4.0], [20.0, 2.6, 5.5], MAT.CONCRETE);
    m.box([-3.6, 1.5, 4.2], [19.6, 2.5, 4.5], MAT.GLASS);
    m.painted(TINT.NONE, () => {
      m.box([12.0, 0.3, 12.0], [17.0, 2.2, 17.0], MAT.STONE);
      m.box([-1.0, 0.3, 14.0], [3.0, 1.6, 17.5], MAT.STONE);
    });
  }

  // The aviary: the thing you see over the fence from outside.
  if (medium) {
    const ring = plan(13.0, 11.0, 0.75, 14);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 14; i++) {
        const a = ring[i];
        m.pipe([-24 + a[0], 0.3, 22 + a[1]], [-24 + a[0] * 0.18, 20.0, 22 + a[1] * 0.18], 0.22, MAT.TRIM, 4);
      }
      for (const s of [0.35, 0.62, 0.85]) {
        const r = scaled(ring, s);
        for (let i = 0; i < 14; i++) {
          const a = r[i], b = r[(i + 1) % 14];
          const y = 20.0 - s * 17.0;
          m.pipe([-24 + a[0], y, 22 + a[1]], [-24 + b[0], y, 22 + b[1]], 0.14, MAT.TRIM, 4);
        }
      }
      m.cylinder(-24, 22, 0.4, 0.3, 21.0, 6, MAT.TRIM, false);
    });
    m.painted(TINT.GREEN_DARK, () => lid(m, ring.map(([x, z]) => [-24 + x, 22 + z] as [number, number]), 0.3, MAT.TRIM));
    if (fine) for (const [dx, dz] of [[-6, 4], [5, -3], [0, 6]]) tree(m, -24 + dx, 22 + dz, 9.0, 2.4);
  }

  if (fine) {
    // The path, which is what a zoo is actually organised around.
    m.painted(TINT.NONE, () => {
      for (const [x0, z0, x1, z1] of [
        [-3.0, -hz + 6, 3.0, hz - 8], [-hx + 8, -3.0, hx - 8, 3.0],
      ] as const) m.box([x0, 0.27, z0], [x1, 0.33, z1], MAT.GROUND);
    });
    for (let i = 0; i < 14; i++) figure(m, 8123 + i * 11, -34 + i * 5.4, (i % 3) * 9 - 6, 1.4, { stride: 0.24 });
    for (let i = 0; i < 6; i++) bench(m, -22 + i * 9, 1.2, 0);
    hedge(m, -hx, hz - 9.4, -17.0, hz - 8.4, 1.1);
    hedge(m, 17.0, hz - 9.4, hx, hz - 8.4, 1.1);
    bollards(m, { axis: 'z', sign: 1, plane: hz + 0.4 }, -15, 15, 2.4, 9);
    marquee(m, -14, 14, hz + 0.5, 1, 5.6, 2.4);
    flags(m, -24, 24, hz + 3.0, 0.2, 6, 8.0);
    for (const sx of [-1, 1]) planter(m, sx * 20, hz - 2.0, 2.2, 0.7);
  }
  return m;
}

// -------------------------------------------------------- 3. the art gallery

/**
 * A modern art gallery: a top-lit shed with a sculptural front on it.
 *
 * The opposite building to the museum, deliberately. A museum of antiquities
 * is a classical box with a portico and a dome, and that one already exists;
 * a gallery of modern work is a plain hall lit from the roof, because the
 * hanging is what matters and daylight from the side is the enemy of it. So
 * the whole budget goes on two things -- the north-light roof, which is the
 * honest expression of that hall, and a folded metal entrance mass that does
 * the job the portico does on the other one.
 */
function artGallery(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 30.0, hz = 22.0;
  const wall = 14.0;

  forecourt(m, -38, -30, 38, 28, 6199, { trees: 6, lamps: 8, people: 11, benches: 4 });
  m.box([-hx - 4, 0.1, -hz - 4], [hx + 4, 1.2, hz + 4], MAT.STONE, { roof: MAT.ROOF });
  m.box([-hx, 1.2, -hz], [hx, wall, hz], MAT.CONCRETE, { roof: MAT.ROOF });

  if (medium) {
    // The north lights over the hall: the reason the building is this shape.
    sawtooth(m, -hx, -hz, hx, hz, wall, 6, 4.6, MAT.METAL);
    band(m, -hx, -hz, hx, hz, wall, 0.9, 0.5, MAT.STONE);
    // The folded entrance mass, faceted so no two panels catch the same light.
    const fold: Array<[number, number]> = [
      [-13.0, 0], [-8.0, 8.5], [-2.0, 11.5], [4.5, 10.0], [10.0, 5.5], [13.0, 0],
    ];
    m.painted(TINT.METAL_DARK, () => {
      const outer = fold.map(([x, z]) => [x, hz + z] as [number, number]);
      const inner = fold.map(([x, z]) => [x * 0.86, hz + z * 0.5] as [number, number]);
      loft(m, outer.map(([x, z]) => [x, z] as [number, number]),
        inner.map(([x, z]) => [x, z] as [number, number]), 1.2, 17.5, MAT.CLADDING);
      lid(m, inner, 17.5, MAT.CLADDING);
      for (let i = 0; i < outer.length - 1; i++) {
        m.pipe([outer[i][0], 1.2, outer[i][1]], [inner[i][0], 17.5, inner[i][1]], 0.2, MAT.TRIM, 4);
      }
    });
    m.box([-9.0, 1.4, hz + 0.2], [9.0, 8.6, hz + 4.6], MAT.GLASS);
    // The service and education wing along one flank, lower and quieter.
    m.box([-hx - 9.0, 1.2, -hz + 4], [-hx, 8.4, hz - 6], MAT.STONE, { roof: MAT.ROOF });
    m.windowRow({
      axis: 'x', sign: -1, plane: -hx - 9.0, from: -hz + 6, to: hz - 8,
      y0: 3.0, y1: 7.0, count: 6, width: 2.4, glass: MAT.GLASS, frame: 0.14, proud: 0.08,
    });
    parapet(m, -hx - 9.0, -hz + 4, -hx, hz - 6, 8.4, 0.8, 0.22, MAT.STONE);
  }
  if (fine) {
    porteCochere(m, -8, 8, hz + 4.6, 5.6, 6.2, 4);
    entrance(m, { axis: 'z', sign: 1, plane: hz + 0.2 }, 0,
      { width: 4.6, height: 5.4, double: true, glazed: true, fanlight: false });
    marquee(m, -11, 11, hz + 4.8, 1, 9.0, 2.4);
    m.painted(TINT.BRAND, () => m.box([-12.0, 11.0, hz + 3.4], [12.0, 14.6, hz + 3.8], MAT.CLADDING));
    // Sculpture on the forecourt, which is where a gallery puts the big pieces.
    m.painted(TINT.ACCENT, () => {
      m.pipe([19.0, 0.6, hz + 5.0], [24.0, 9.5, hz + 8.0], 0.9, MAT.PAINT, 5);
      m.pipe([24.0, 9.5, hz + 8.0], [27.5, 2.2, hz + 3.5], 0.9, MAT.PAINT, 5);
    });
    m.painted(TINT.METAL_DARK, () => {
      m.cylinder(-22.0, hz + 6.0, 2.4, 0.2, 0.9, 10, MAT.PLATE, true);
      m.cylinder(-22.0, hz + 6.0, 0.7, 0.9, 6.4, 8, MAT.TRIM, false);
      m.box([-24.4, 6.4, hz + 3.6], [-19.6, 7.4, hz + 8.4], MAT.TRIM, { skipBottom: false });
    });
    for (let i = 0; i < 9; i++) figure(m, 6199 + i * 13, -20 + i * 5.0, hz + 6.4, 1.4, { stride: 0.24 });
    for (let i = 0; i < 4; i++) bench(m, -16 + i * 11, hz + 8.4, 0);
    hedge(m, -hx, -hz - 3.2, hx, -hz - 2.2, 1.0);
    roofClutter(m, -hx + 4, -hz + 4, hx - 4, hz - 4, wall + 4.6, 61, 0.4);
    for (const sx of [-1, 1]) planter(m, sx * 30, hz + 4.0, 2.4, 0.75);
    campanile(m, hx + 6.0, -hz + 6.0, 2.6, 22.0, MAT.CONCRETE,
      { belfry: 4.4, cap: 'flat', tint: TINT.NONE });
  }
  return m;
}

// ------------------------------------------------------- 4. the telecom tower

/**
 * A telecommunications tower: the one civic object visible from everywhere.
 *
 * Every real city has one and this library had none -- a concrete shaft too
 * thin to be a building, a pod of equipment and public floors near the top,
 * and a mast above that. It is the only asset here whose whole job is to be
 * seen from the far side of the map, and at a hundred and sixty metres on a
 * five-cell lot it is also the cheapest landmark per square metre in the set.
 */
function telecomTower(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const shaft = 118.0, pod = 26.0;

  forecourt(m, -22, -20, 22, 20, 5407, { trees: 5, lamps: 6, people: 6, benches: 3 });
  m.box([-13, 0.1, -12], [13, 6.4, 12], MAT.CONCRETE, { roof: MAT.ROOF });
  if (medium) {
    m.box([-11, 0.9, -12.6], [11, 5.2, 12.6], MAT.GLASS);
    band(m, -13, -12, 13, 12, 6.4, 0.9, 0.5, MAT.STONE);
  }

  // The shaft: a tapering drum, ribbed so it has a scale.
  const foot = plan(6.6, 6.6, 1.0, 14);
  loft(m, foot, scaled(foot, 0.62), 0.1, shaft, MAT.CONCRETE);
  if (medium) {
    m.painted(TINT.NONE, () => {
      for (let i = 0; i < 7; i++) {
        const t = i / 7, r = 6.6 * (1 - 0.38 * t) * 1.02;
        m.cylinder(0, 0, r, 4.0 + t * (shaft - 8), 4.4 + t * (shaft - 8), 14, MAT.STONE, false);
      }
    });
  }

  // The pod: two glazed decks under a ring of plant, on a flared collar.
  const ring = plan(13.0, 13.0, 1.0, 16);
  loft(m, scaled(foot, 0.62), ring, shaft, shaft + 4.0, MAT.CONCRETE);
  loft(m, ring, ring, shaft + 4.0, shaft + 12.0, MAT.GLASS);
  if (medium) {
    shelf(m, scaled(ring, 0.98), scaled(ring, 1.14), shaft + 12.0, shaft + 13.2, MAT.CONCRETE);
    loft(m, scaled(ring, 0.86), scaled(ring, 0.86), shaft + 13.2, shaft + pod - 6.0, MAT.CLADDING);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 16; i += 2) {
        const a = ring[i];
        m.pipe([a[0], shaft + 4.0, a[1]], [a[0] * 0.86, shaft + 12.0, a[1] * 0.86], 0.18, MAT.TRIM, 4);
      }
    });
    // The dishes, which are what the thing is for.
    m.painted(TINT.NONE, () => {
      for (let i = 0; i < 16; i += 4) {
        const a = scaled(ring, 1.16)[i];
        m.cylinder(a[0], a[1], 2.1, shaft + 13.6, shaft + 14.1, 10, MAT.PLATE, true);
      }
    });
    loft(m, scaled(ring, 0.5), scaled(ring, 0.28), shaft + pod - 6.0, shaft + pod, MAT.CONCRETE);
    cap(m, scaled(ring, 0.28), shaft + pod, MAT.ROOF);
  }
  // The mast.
  m.painted(TINT.METAL_DARK, () => {
    m.cylinder(0, 0, 0.85, shaft + pod, shaft + pod + 26.0, 6, MAT.TRIM, false);
    m.cylinder(0, 0, 0.35, shaft + pod + 26.0, shaft + pod + 40.0, 5, MAT.TRIM, false);
  });
  if (fine) {
    m.painted(TINT.SIGN_LIT, () => {
      for (const y of [shaft + pod + 8.0, shaft + pod + 20.0, shaft + pod + 34.0]) {
        m.cylinder(0, 0, 1.1, y, y + 0.7, 6, MAT.PLATE, true);
      }
    });
    porteCochere(m, -7, 7, 12.6, 4.6, 5.2, 3);
    entrance(m, { axis: 'z', sign: 1, plane: 12.0 }, 0, { width: 3.6, height: 4.2, double: true, glazed: true });
    flags(m, -17, 17, 15.0, 0.2, 5, 8.0);
    for (let i = 0; i < 6; i++) figure(m, 5407 + i * 11, -12 + i * 5.0, 15.5, 1.4, { stride: 0.24 });
    for (const sx of [-1, 1]) tree(m, sx * 18, -15, 7.0, 2.6);
  }
  return m;
}

// ------------------------------------------------------------- 5. the temple

/**
 * A temple in its own walled precinct.
 *
 * The library had a parish church and a cathedral and nothing else, which
 * makes every city on the map the same city. This is the other tradition: a
 * gate you pass through rather than a door you open, a swept court with an
 * incense burner in the middle of it, a hall on a stone platform under two
 * tiers of eaves, and a pagoda standing off to one side.
 */
function temple(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 30.0, hz = 24.0;

  forecourt(m, -hx - 2, -hz - 3, hx + 2, hz + 3, 4909, { trees: 5, lamps: 6, people: 9, benches: 2 });
  m.painted(TINT.NONE, () => m.box([-hx, 0.11, -hz], [hx, 0.3, hz], MAT.STONE));

  // The precinct wall, with the gate in the middle of the front.
  if (medium) {
    for (const [x0, z0, x1, z1] of [
      [-hx, hz - 1.4, -8.0, hz], [8.0, hz - 1.4, hx, hz],
      [-hx, -hz, -hx + 1.4, hz], [hx - 1.4, -hz, hx, hz], [-hx, -hz, hx, -hz + 1.4],
    ] as const) {
      m.box([x0, 0.3, z0], [x1, 4.2, z1], MAT.PLASTER);
      m.painted(TINT.BRAND_DARK, () => m.box([x0 - 0.4, 4.2, z0 - 0.4], [x1 + 0.4, 5.0, z1 + 0.4], MAT.CLADDING));
    }
    // The gate: four posts, a beam and two tiers of eaves.
    m.painted(TINT.BRAND, () => {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        m.cylinder(sx * 6.0, hz - 0.7 + sz * 1.6, 0.62, 0.3, 7.4, 8, MAT.PAINT, false);
      }
      m.box([-7.4, 7.4, hz - 3.0], [7.4, 8.6, hz + 1.6], MAT.PAINT);
    });
    for (const [w, d, y, h] of [[9.4, 3.6, 8.6, 1.5], [7.0, 2.8, 11.2, 1.3]] as const) {
      m.painted(TINT.BRAND_DARK, () => m.box([-w, y, hz - 0.7 - d], [w, y + 0.5, hz - 0.7 + d], MAT.CLADDING));
      m.gable([-w - 0.9, y + 0.5, hz - 0.7 - d - 0.9], [w + 0.9, y + 0.5, hz - 0.7 + d + 0.9],
        h, 'x', MAT.CLADDING, MAT.TIMBER);
    }
  }

  // The hall, on a stone platform, under two tiers.
  m.box([-15.0, 0.3, -14.0], [15.0, 2.6, 8.0], MAT.STONE, { roof: MAT.STONE });
  m.box([-12.5, 2.6, -11.5], [12.5, 10.0, 5.5], MAT.TIMBER);
  if (medium) {
    for (const [w, d, y, h] of [[14.6, 13.6, 10.0, 3.4], [11.0, 10.2, 14.4, 3.0]] as const) {
      m.box([-w, y, -3.0 - d], [w, y + 0.6, -3.0 + d], MAT.TIMBER);
      m.gable([-w - 1.6, y + 0.6, -3.0 - d - 1.6], [w + 1.6, y + 0.6, -3.0 + d + 1.6],
        h, 'x', MAT.CLADDING, MAT.TIMBER);
    }
    m.painted(TINT.BRAND, () => {
      for (let i = 0; i < 6; i++) {
        const x = -11.0 + i * 4.4;
        m.cylinder(x, 5.2, 0.66, 2.6, 10.0, 8, MAT.PAINT, false);
      }
      m.box([-13.0, 9.4, 4.6], [13.0, 10.2, 6.0], MAT.PAINT);
    });
    m.windowRow({
      axis: 'z', sign: 1, plane: 5.5, from: -10.0, to: 10.0, y0: 4.0, y1: 8.4,
      count: 5, width: 2.6, glass: MAT.PANE, frame: 0.16, proud: 0.1,
    });
  }

  // The pagoda, off to one side, which is what you see over the wall.
  if (medium) {
    const base = 5.4;
    for (let k = 0; k < 5; k++) {
      const r = base * (1 - k * 0.13), y = 0.3 + k * 5.2;
      m.box([-22.0 - r, y, -12.0 - r], [-22.0 + r, y + 3.9, -12.0 + r], MAT.TIMBER);
      m.painted(TINT.BRAND_DARK, () => m.box([-22.0 - r - 1.5, y + 3.9, -12.0 - r - 1.5],
        [-22.0 + r + 1.5, y + 4.6, -12.0 + r + 1.5], MAT.CLADDING));
      if (fine) {
        m.painted(TINT.BRAND, () => {
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            m.cylinder(-22.0 + sx * (r - 0.5), -12.0 + sz * (r - 0.5), 0.28, y, y + 3.9, 6, MAT.PAINT, false);
          }
        });
      }
    }
    m.cone(-22.0, -12.0, 2.4, 0.0, 26.3, 31.5, 8, MAT.METAL);
    m.painted(TINT.METAL_DARK, () => m.cylinder(-22.0, -12.0, 0.18, 31.5, 34.5, 5, MAT.TRIM, false));
  }
  if (fine) {
    // The burner in the middle of the court, and the lanterns down the path.
    m.painted(TINT.METAL_DARK, () => {
      m.cylinder(0, 15.0, 2.0, 0.3, 3.2, 10, MAT.TRIM, false);
      m.cone(0, 15.0, 2.6, 0.6, 3.2, 5.4, 10, MAT.TRIM);
    });
    m.painted(TINT.SIGN_LIT, () => {
      for (let i = 0; i < 6; i++) {
        for (const sx of [-1, 1]) {
          m.box([sx * 9.0 - 0.5, 2.4, 8.0 + i * 2.6], [sx * 9.0 + 0.5, 3.6, 9.0 + i * 2.6], MAT.PANE);
        }
      }
    });
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) {
        m.box([sx * 9.0 - 0.14, 0.3, 8.4 + i * 2.6], [sx * 9.0 + 0.14, 2.4, 8.7 + i * 2.6], MAT.TRIM);
      }
    });
    for (let i = 0; i < 9; i++) figure(m, 4909 + i * 13, -14 + i * 3.4, 12.0, 1.4, { stride: 0.22 });
    for (const [x, z] of [[22, 12], [24, -4], [-25, 14]] as const) tree(m, x, z, 8.0, 2.6);
    hedge(m, -hx + 3, -hz + 3.0, hx - 3, -hz + 4.0, 1.0);
  }
  return m;
}

// --------------------------------------------------- 6. the aquatics centre

/**
 * An indoor pool under a roof that follows the water.
 *
 * The lido is open-air and seasonal; this is the one a city can use in
 * February, and it is a different building entirely. A competition pool needs
 * one clear span and a bank of seating down one side, so the roof is a single
 * curve that is deepest over the diving end and flattens over the shallow end
 * -- which is both structurally honest and the only silhouette in the parks
 * set that is not a box or a bowl.
 */
function aquaticsCentre(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const hx = 32.0, hz = 20.0;
  const N = 14;

  forecourt(m, -40, -28, 40, 28, 7717, { trees: 5, lamps: 7, people: 10, benches: 3 });
  m.box([-hx - 3, 0.1, -hz - 3], [hx + 3, 1.4, hz + 3], MAT.CONCRETE, { roof: MAT.ROOF });

  //: The roof's height at a fraction along the hall: deep over the boards.
  const curve = (t: number): number => 10.0 + 9.5 * Math.sin(Math.PI * (0.18 + 0.62 * t));
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    const x0 = -hx + t0 * hx * 2, x1 = -hx + t1 * hx * 2;
    const y0 = curve(t0), y1 = curve(t1);
    // The two long walls, glazed, and the shell over them.
    m.box([x0, 1.4, -hz], [x1, y0 - 1.0, -hz + 0.5], MAT.GLASS);
    m.box([x0, 1.4, hz - 0.5], [x1, y0 - 1.0, hz], MAT.GLASS);
    m.quad([x0, y0, -hz - 0.8], [x1, y1, -hz - 0.8], [x1, y1, hz + 0.8], [x0, y0, hz + 0.8], MAT.METAL);
    m.quad([x0, y0 - 0.9, -hz - 0.8], [x0, y0, -hz - 0.8], [x1, y1, -hz - 0.8], [x1, y1 - 0.9, -hz - 0.8], MAT.CLADDING);
    m.quad([x1, y1 - 0.9, hz + 0.8], [x1, y1, hz + 0.8], [x0, y0, hz + 0.8], [x0, y0 - 0.9, hz + 0.8], MAT.CLADDING);
    if (medium) {
      m.painted(TINT.METAL_DARK, () => {
        m.box([x0 - 0.2, 1.4, -hz - 0.9], [x0 + 0.2, y0, hz + 0.9], MAT.TRIM);
      });
    }
  }
  // The two ends.
  for (const [x, t, out] of [[-hx, 0, false], [hx, 1, true]] as const) {
    const y = curve(t);
    m.box([x - (out ? 0 : 0.6), 1.4, -hz], [x + (out ? 0.6 : 0), y, hz], MAT.CONCRETE);
  }

  if (medium) {
    // The tank, the boards and the seating bank down one side.
    m.box([-24.0, 1.4, -12.0], [16.0, 1.5, 8.0], MAT.CONCRETE);
    m.box([-23.0, 1.5, -11.0], [15.0, 3.2, 7.0], MAT.WATER);
    m.painted(TINT.NONE, () => {
      for (let i = 0; i < 4; i++) {
        m.box([-23.0 + i * 9.4, 3.2, -11.0], [-22.6 + i * 9.4, 3.3, 7.0], MAT.PLATE);
      }
    });
    m.painted(TINT.METAL_DARK, () => {
      for (const [h, d] of [[4.4, 3.0], [7.6, 4.0], [11.0, 5.0]] as const) {
        m.box([-22.5, 1.5, -10.0], [-21.5, h, -10.0 + 0.9], MAT.TRIM);
        m.box([-22.8, h, -10.0], [-22.8 + d, h + 0.3, -8.6], MAT.TRIM);
      }
    });
    for (let r = 0; r < 6; r++) {
      m.box([-22.0, 1.4 + r * 0.8, 9.0 + r * 1.3], [14.0, 1.8 + r * 0.8, 10.3 + r * 1.3], MAT.CONCRETE);
    }
    // The entrance block, lower, across one end.
    m.box([hx - 1.0, 1.4, -14.0], [hx + 9.0, 9.0, 14.0], MAT.STONE, { roof: MAT.ROOF });
    m.box([hx + 1.0, 2.0, -12.0], [hx + 9.4, 7.4, 12.0], MAT.GLASS);
    parapet(m, hx - 1.0, -14.0, hx + 9.0, 14.0, 9.0, 0.9, 0.24, MAT.STONE);
  }
  if (fine) {
    // A canopy on the +x face. `porteCochere` and `marquee` both take a z
    // plane, and handing them an x one puts the entrance forty metres off the
    // end of the building -- which is what they did here.
    m.painted(TINT.METAL_DARK, () => {
      m.box([hx + 9.0, 5.6, -8.0], [hx + 15.0, 6.2, 8.0], MAT.TRIM, { skipBottom: false });
      for (const sz of [-1, 1]) m.cylinder(hx + 14.0, sz * 7.0, 0.2, 1.4, 5.6, 6, MAT.TRIM, false);
    });
    m.painted(TINT.BRAND, () => m.box([hx + 1.5, 9.2, -8.0], [hx + 2.0, 12.4, 8.0], MAT.CLADDING));
    for (let i = 0; i < 8; i++) figure(m, 7717 + i * 13, hx + 11.0, -11 + i * 3.0, -1.6, { stride: 0.24 });
    for (let i = 0; i < 5; i++) bench(m, -20 + i * 10, hz + 6.0, 0);
    hedge(m, -hx, hz + 4.0, hx - 6, hz + 5.0, 1.0);
    for (const sx of [-1, 1]) tree(m, sx * 30, -hz - 6.0, 7.5, 2.8);
    roofClutter(m, hx, -12, hx + 8, 12, 9.0, 43, 0.5);
  }
  return m;
}

// ====================================================================== table

const civ = (jobs: number, upkeep: number, power: number, water: number): AssetDef['sim'] => ({
  jobs, powerKW: power, waterM3: water, garbagePerWeek: jobs * 8, pollution: 0, upkeep,
});

export const MORE_SERVICES: AssetDef[] = [
  {
    id: 'svc.waste.recycling', name: 'Recycling centre', zone: 'service', branch: 'power',
    density: 'none', variant: 'sculpted', footprint: [11, 9], height: 0,
    brand: { name: 'Recycling', colour: [0.20, 0.38, 0.28], accent: [0.72, 0.64, 0.20], sign: 'box' },
    sim: civ(90, 1150, 460, 220),
    note: 'A materials recovery hall stepping up from a four-door tipping end to a north-lit baling end, the picking line glazed the length of the street front, three glass silos on a conveyor, and the sorted bales stacked in the yard.',
    build: recyclingCentre,
  },
  {
    id: 'svc.parks.zoo', name: 'Zoo', zone: 'service', branch: 'parks',
    density: 'none', variant: 'sculpted', footprint: [13, 10], height: 0,
    brand: { name: 'Zoo', colour: [0.22, 0.36, 0.24], accent: [0.76, 0.58, 0.22], sign: 'box' },
    sim: civ(70, 980, 260, 540),
    note: 'A timber entrance range under a glazed vault, four fenced paddocks with shelters and feed racks, a sunk pool with a viewing wall along the path, and a twenty-metre aviary cage on fourteen raking masts.',
    build: zoo,
  },
  {
    id: 'svc.gov.gallery', name: 'Art gallery', zone: 'service', branch: 'government',
    density: 'none', variant: 'sculpted', footprint: [10, 9], height: 0,
    brand: { name: 'Gallery', colour: [0.26, 0.26, 0.30], accent: [0.70, 0.52, 0.30], sign: 'box' },
    sim: civ(60, 1040, 420, 130),
    note: 'A top-lit hall under six north lights, a folded metal entrance mass faceted so no two panels catch the same light, a lower education wing along one flank, and a sculpture court with a twelve-metre painted steel piece in it.',
    build: artGallery,
  },
  {
    id: 'svc.gov.telecom', name: 'Telecom tower', zone: 'service', branch: 'government',
    density: 'none', variant: 'sculpted', footprint: [6, 6], height: 0,
    brand: { name: 'Telecom', colour: [0.22, 0.26, 0.32], accent: [0.76, 0.42, 0.22], sign: 'box' },
    sim: civ(40, 1420, 900, 60),
    note: 'A hundred-and-eighteen metre ribbed concrete shaft on a glazed base, a flared collar carrying two glazed decks and a ring of dishes, and a mast above that with obstruction lights on it. A hundred and eighty-four metres to the tip.',
    build: telecomTower,
  },
  {
    id: 'svc.death.temple', name: 'Temple', zone: 'service', branch: 'deathcare',
    density: 'none', variant: 'sculpted', footprint: [9, 8], height: 0,
    brand: { name: 'Temple', colour: [0.34, 0.20, 0.18], accent: [0.78, 0.60, 0.24], sign: 'box' },
    sim: civ(20, 380, 120, 90),
    note: 'A walled precinct entered through a two-tiered painted gate, a hall on a stone platform under two sweeps of tiled eaves on six columns, a five-storey pagoda in one corner, and a bronze burner in the swept court.',
    build: temple,
  },
  {
    id: 'svc.parks.aquatics', name: 'Aquatics centre', zone: 'service', branch: 'parks',
    density: 'none', variant: 'sculpted', footprint: [12, 8], height: 0,
    brand: { name: 'Aquatics', colour: [0.16, 0.34, 0.44], accent: [0.72, 0.62, 0.24], sign: 'box' },
    sim: civ(85, 1320, 640, 1900),
    note: 'A single-span roof curving from deep over the diving boards to shallow over the far end, glazed the length of both flanks, with a fifty-metre tank, three boards, six rows of seating down one side and a stone entrance block across the end.',
    build: aquaticsCentre,
  },
];
