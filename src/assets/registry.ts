/**
 * Every asset the project has, in one list.
 *
 * This becomes the pack manifest when assets ship as files. For now it is the
 * thing the viewer enumerates and the spawner will later query by zone,
 * density and footprint.
 */

import { HOUSING } from './generators/housing';
import { COMMERCIAL } from './generators/commercial';
import { INDUSTRIAL } from './generators/industrial';
import { OFFICE } from './generators/office';
import { SAFETY } from './generators/services-safety';
import { UTILITY } from './generators/services-utility';
import { CIVIC } from './generators/services-civic';
import { EXTRA_SERVICES } from './generators/services-extra';
import { ROADS } from './generators/roads';
import { FLEET } from './generators/vehicles';
import type { MeshBuilder } from './mesh';
import { dressRoof } from './parts';
import { idSeed } from './types';
import type { AssetDef, Zone } from './types';

export const ASSETS: AssetDef[] = [
  ...HOUSING, ...COMMERCIAL, ...OFFICE, ...INDUSTRIAL,
  ...SAFETY, ...UTILITY, ...CIVIC, ...EXTRA_SERVICES, ...FLEET, ...ROADS,
];

// Every zoned building gets its roof dressed, whether or not its generator
// asked. A flat top with nothing on it reads as an extrusion of its own plan,
// and from the angle this game is played at the roof is a third of what you
// see of a building -- so it cannot be left to each of a hundred and fifty
// generators to remember. Generators that dress their own roof with options
// set the mesh's roofDressed flag and are left alone.
const DRESSED = new Set<Zone>(['residential', 'commercial', 'office', 'industrial', 'service']);
for (const a of ASSETS) {
  if (!DRESSED.has(a.zone)) continue;
  const inner = a.build.bind(a);
  const seed = Math.round(idSeed(a.id));
  // Decided once, from the full-detail mesh, and reused at every LOD.
  const lod0 = inner(0);
  const plane = lod0.roofPlane() ?? lod0.bareRoofPlane();
  a.build = (lod: number): MeshBuilder => {
    const m = inner(lod);
    dressRoof(m, lod, seed, { at: plane });
    return m;
  };
}

// Height is measured from the mesh rather than declared. A hand-written number
// drifts the moment a generator gains a chimney, and every consumer -- the
// spawner, the LOD selector, the viewer's framing -- would then be working
// from a lie. Cheap: bounds() reads the vertex list without baking occlusion.
for (const a of ASSETS) {
  a.height = Math.round(a.build(0).bounds().max[1] * 10) / 10;
}

export function assetById(id: string): AssetDef | undefined {
  return ASSETS.find((a) => a.id === id);
}
