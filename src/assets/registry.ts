/**
 * Every asset the project has, in one list.
 *
 * This becomes the pack manifest when assets ship as files. For now it is the
 * thing the viewer enumerates and the spawner will later query by zone,
 * density and footprint.
 */

import { RESIDENTIAL } from './generators/residential';
import { COMMERCIAL } from './generators/commercial';
import { INDUSTRIAL } from './generators/industrial';
import { OFFICE } from './generators/office';
import { SAFETY } from './generators/services-safety';
import { UTILITY } from './generators/services-utility';
import type { AssetDef } from './types';

export const ASSETS: AssetDef[] = [
  ...RESIDENTIAL, ...COMMERCIAL, ...OFFICE, ...INDUSTRIAL,
  ...SAFETY, ...UTILITY,
];

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
