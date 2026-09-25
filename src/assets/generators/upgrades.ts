/**
 * Extension wings: what a service building grows when the city upgrades it.
 *
 * An upgrade that only changes numbers is an upgrade the player cannot see,
 * and the reason to spend on one is as much the building as the capacity. So
 * each tier is a wing built onto the free ground beside the original, two cells
 * deep and as long as the side it stands against:
 *
 *   tier 1  a single-storey glass wing under a planted roof, with a canopy over
 *           its door, planters and a young tree or two along the front;
 *   tier 2  a two-storey wing with coloured fins, a solar array on the roof and
 *           a stair tower at one end carrying a lit band -- the building that
 *           says the city has invested here.
 *
 * Neutral glass and white, because it attaches to every branch's building and
 * a wing in the fire brigade's red would look wrong on a library. Built facing
 * +x with the parent on the -x side; the placing code turns it.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef, Brand } from '../types';
import { tree, bench } from './landscape';

/** Wing lengths, in 8 m cells: every side a service lot can have. */
export const WING_LENGTHS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
export const WING_DEPTH = 2;

export const wingId = (tier: number, cells: number): string => `spec.wing.${tier}.${cells}`;

const BRAND: Brand = {
  name: 'Extension', colour: [0.82, 0.84, 0.86], accent: [0.14, 0.46, 0.52], sign: 'none',
};

function wing(tier: number, cells: number) {
  return (lod: number): MeshBuilder => {
    const m = new MeshBuilder();
    // The roof is the wing's own -- planted, or solar -- so the registry's
    // plant-room pass is told to leave it.
    m.roofDressed = true;
    const L = cells * 8, W = WING_DEPTH * 8;
    // The wing stands a little in from its own edges, and hard against the
    // parent's side so the two read as one building.
    const x0 = 0.2, x1 = W - 2.4, z0 = 1.2, z1 = L - 1.2;
    const cx = W / 2, cz = L / 2;
    {
      // Forecourt paving along the free side.
      m.box([x1, 0, z0 - 0.6], [W - 0.2, 0.08, z1 + 0.6], MAT.CONCRETE);
      const storeys = tier === 1 ? 1 : 2;
      const H = storeys * 4.4 + 0.8;
      // The frame: slab edges at each floor, and a plinth.
      m.box([x0, 0, z0], [x1, 0.5, z1], MAT.CONCRETE);
      m.box([x0 + 0.25, 0.5, z0 + 0.25], [x1 - 0.25, H - 0.6, z1 - 0.25], MAT.GLASS);
      for (let s = 1; s <= storeys; s++) {
        m.box([x0, s * 4.4 - 0.1, z0], [x1, s * 4.4 + 0.5, z1], MAT.CONCRETE);
      }
      m.box([x0, H - 0.6, z0], [x1, H, z1], MAT.CONCRETE);
      // Mullions down the long face, the rhythm that makes glass read as a building.
      if (lod < 2) {
        for (let z = z0 + 2.4; z < z1 - 1; z += 2.4) {
          m.box([x1 - 0.32, 0.5, z - 0.07], [x1 - 0.12, H - 0.6, z + 0.07], MAT.DARK_TRIM);
        }
      }
      if (tier === 1) {
        // A planted roof: sedum inside a parapet.
        m.painted(TINT.GREEN, () => m.box([x0 + 0.5, H, z0 + 0.5], [x1 - 0.5, H + 0.18, z1 - 0.5], MAT.TRIM));
        m.box([x0, H, z0], [x1, H + 0.55, z0 + 0.3], MAT.CONCRETE);
        m.box([x0, H, z1 - 0.3], [x1, H + 0.55, z1], MAT.CONCRETE);
        m.box([x1 - 0.3, H, z0], [x1, H + 0.55, z1], MAT.CONCRETE);
      } else {
        // Coloured fins proud of the glass, floor to roof.
        if (lod < 2) {
          m.painted(TINT.ACCENT, () => {
            for (let z = z0 + 1.2; z < z1 - 0.6; z += 3.6) {
              m.box([x1, 0.5, z - 0.12], [x1 + 0.55, H, z + 0.12], MAT.PAINT);
            }
          });
        }
        // Solar array: tilted panels in rows on the roof.
        if (lod < 2) {
          for (let z = z0 + 1.6; z < z1 - 2.4; z += 3.2) {
            for (let x = x0 + 1.4; x < x1 - 2.2; x += 3.6) {
              m.quad([x, H + 0.35, z + 2.2], [x + 3, H + 0.35, z + 2.2],
                [x + 3, H + 1.3, z], [x, H + 1.3, z], MAT.PANE);
              m.box([x + 0.2, H, z + 0.1], [x + 2.8, H + 0.35, z + 2.1], MAT.METAL);
            }
          }
        }
        // The stair tower at the far end, taller than the wing, with a lit band.
        const tz0 = z1 - 5.5;
        m.box([x0 + 1.5, 0, tz0], [x1 - 1.5, H + 3.6, z1], MAT.CONCRETE);
        m.painted(TINT.SIGN_LIT, () => m.box([x1 - 1.52, H + 1.4, tz0 + 0.6], [x1 - 1.44, H + 2.6, z1 - 0.6], MAT.PAINT));
        m.box([x0 + 1.3, H + 3.6, tz0 - 0.2], [x1 - 1.3, H + 3.9, z1 + 0.2], MAT.DARK_TRIM);
      }
      // The entrance: a canopy on two posts at the middle of the long face.
      const ez = (z0 + z1) / 2;
      m.painted(TINT.ACCENT, () => m.box([x1, 3.2, ez - 2.6], [x1 + 2.0, 3.45, ez + 2.6], MAT.PAINT));
      for (const dz of [-2.3, 2.3]) m.cylinder(x1 + 1.8, ez + dz, 0.08, 0, 3.2, 6, MAT.METAL);
      if (lod < 2) {
        // Planters with young trees either side of the door, and a bench.
        for (const dz of [-6, 6]) {
          const pz = ez + dz;
          if (pz < z0 + 1.5 || pz > z1 - 1.5) continue;
          m.box([x1 + 0.6, 0.08, pz - 0.9], [x1 + 2.0, 0.65, pz + 0.9], MAT.CONCRETE);
          tree(m, x1 + 1.3, pz, tier === 1 ? 5.5 : 6.5, 1.3);
        }
        if (cells >= 5) bench(m, x1 + 1.3, ez + 9, 1);
        // Tier two flies the city's flags at the forecourt's end.
        if (tier === 2) {
          for (let i = 0; i < 3; i++) {
            const fz = z0 + 1 + i * 1.4;
            m.cylinder(W - 0.9, fz, 0.05, 0, 7.5, 5, MAT.METAL);
            m.painted(i === 1 ? TINT.ACCENT : TINT.BRAND, () =>
              m.box([W - 0.88, 6.2, fz], [W - 0.84, 7.3, fz + 1.1], MAT.PAINT));
          }
        }
      }
    }
    // Built with its corner at the origin, then centred on the lot the way
    // every asset is. After, not with `placed`, which the tree and bench
    // helpers use themselves and which does not nest.
    m.translate(-cx, -cz);
    return m;
  };
}

export const WINGS: AssetDef[] = [];
for (const tier of [1, 2]) {
  for (const cells of WING_LENGTHS) {
    WINGS.push({
      id: wingId(tier, cells),
      name: tier === 1 ? 'Extension wing' : 'Flagship wing',
      zone: 'service', density: 'none', variant: 'sculpted',
      footprint: [WING_DEPTH, cells], height: tier === 1 ? 6 : 13,
      sim: { powerKW: 0, waterM3: 0, garbagePerWeek: 0, pollution: 0, upkeep: 0 },
      brand: BRAND,
      note: tier === 1
        ? 'A glass wing under a planted roof, built onto an upgraded service building.'
        : 'Two storeys with fins, a solar roof and a lit stair tower: a flagship service.',
      build: wing(tier, cells),
    });
  }
}
