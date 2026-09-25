/**
 * The landfill: the first place a town's rubbish goes, and the cheapest.
 *
 * Before an incinerator or a recycling centre is worth its price, a town digs
 * a lined cell and tips into it. It takes less a week than either, needs
 * hardly anybody, and is the worst neighbour in the library: gulls, lorries,
 * smell. The silhouette is the tip itself -- capped cells stepping up behind
 * the one being filled -- with the gatehouse, weighbridge and flare that say
 * it is run rather than dumped.
 */

import { EMIT, MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import { haulTruck, loader, lorry, fence, paintedAs } from './machines';
import { tree } from './landscape';

function landfill(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2, lite = !fine;
  const X = 40, Z = 32;
  // The site: hard standing at the gate, clay everywhere else.
  m.painted(TINT.ACCENT, () => m.box([-X, 0.0005, -Z], [X, 0.06, Z], MAT.GROUND));
  m.box([-X, 0.06, 18], [-6, 0.14, Z], MAT.CONCRETE);
  // Capped cells: stepped, grassed mounds behind the working one.
  m.painted(TINT.GREEN, () => {
    m.box([-36, 0.06, -30], [4, 3.2, -6], MAT.TRIM);
    m.box([-32, 3.2, -27], [0, 6.2, -9], MAT.TRIM);
    m.box([-27, 6.2, -24], [-5, 8.6, -12], MAT.TRIM);
  });
  // The working cell: raw fill, darker, with the tipping face and its lining.
  m.painted(TINT.ACCENT, () => {
    m.box([6, 0.06, -30], [36, 2.4, -2], MAT.GROUND);
    m.box([10, 2.4, -27], [32, 4.2, -8], MAT.GROUND);
  });
  if (medium) {
    // The lining showing at the edge of the open cell.
    m.painted(TINT.METAL_DARK, () => m.box([5.6, 0.06, -30.4], [36.4, 0.5, -29.6], MAT.TRIM));
    // Litter screens along the downwind side: tall nets on poles.
    m.painted(TINT.METAL_DARK, () => {
      for (let z = -30; z <= -2; z += 7) m.box([37.6, 0.06, z - 0.12], [37.9, 7.5, z + 0.12], MAT.TRIM);
    });
    m.box([37.7, 1.2, -30], [37.8, 7.2, -2], MAT.METAL);
  }
  // Rubbish on the face: a scatter of bright bags and scraps.
  if (medium) {
    for (let i = 0; i < (fine ? 26 : 10); i++) {
      const a = Math.sin(i * 12.9898) * 43758.5453, r = a - Math.floor(a);
      const x = 12 + ((i * 7.31) % 18), z = -24 + ((i * 5.17) % 14);
      m.painted(i % 3 === 0 ? TINT.BRAND : i % 3 === 1 ? TINT.STEAM : TINT.AWNING, () =>
        m.box([x, 4.2, z], [x + 0.9 + r, 4.7 + r * 0.4, z + 0.8], MAT.PAINT));
    }
  }
  // The leachate lagoon, lined and fenced.
  m.box([-36, 0.06, -2], [-18, 0.8, 14], MAT.CONCRETE);
  m.box([-35, 0.3, -1], [-19, 0.35, 13], MAT.WATER);
  // The gas flare: a candle stack on the capped cells, burning off methane.
  m.painted(TINT.METAL_DARK, () => m.cylinder(-20, -18, 0.5, 8.6, 17, 8, MAT.METAL, true));
  m.painted(TINT.SIGN_LIT, () => m.cone(-20, -18, 0.6, 0.15, 17, 18.2, 8, MAT.LAMP));
  m.emit(-20, 18.2, -18, EMIT.SMOKE);
  // The gatehouse and the weighbridge in front of it.
  m.box([-36, 0.1, 21], [-28, 4.2, 29], MAT.CLADDING, { roof: MAT.ROOF });
  m.painted(TINT.BRAND, () => m.box([-36.1, 3, 20.9], [-27.9, 4.2, 21], MAT.CLADDING));
  m.box([-24, 0.14, 22], [-10, 0.5, 26], MAT.METAL);
  if (medium) {
    m.painted(TINT.METAL_DARK, () => m.box([-10.5, 0.14, 21.5], [-10.2, 3.4, 22], MAT.TRIM));
    fence(m, [-X + 0.5, 0, 16], [X - 0.5, 0, 16], lite);
    fence(m, [-X + 0.5, 0, -Z + 0.5], [-X + 0.5, 0, 16], lite);
    for (const x of [30, 36]) tree(m, x, 26, 7, 1.8);
  }
  // Plant: a compactor on the face, and the lorries bringing it more.
  paintedAs(TINT.BRAND, () => {
    if (medium) loader(m, 22, -14, 1, lite);
    if (medium) haulTruck(m, 14, 6, 0, true, lite);
    if (fine) lorry(m, -16, 30, 0, 'tipper', false);
  });
  return m;
}

export const WASTE: AssetDef[] = [
  {
    id: 'svc.waste.landfill', name: 'Landfill', zone: 'service', branch: 'power',
    density: 'none', variant: 'sculpted', footprint: [10, 8], height: 18.2,
    brand: { name: 'Landfill', colour: [0.42, 0.52, 0.30], accent: [0.30, 0.24, 0.16], sign: 'box' },
    sim: { jobs: 14, powerKW: 20, waterM3: 10, garbagePerWeek: 0, pollution: 34, upkeep: 180 },
    note: 'Capped cells stepping up behind the one being filled, litter screens on the downwind side, a lined leachate lagoon, a methane flare, a gatehouse on its weighbridge, a compactor and the lorries.',
    build: landfill,
  },
];
