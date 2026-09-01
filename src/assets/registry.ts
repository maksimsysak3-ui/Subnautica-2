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
import type { AssetDef } from './types';

export const ASSETS: AssetDef[] = [...RESIDENTIAL, ...COMMERCIAL, ...INDUSTRIAL];

export function assetById(id: string): AssetDef | undefined {
  return ASSETS.find((a) => a.id === id);
}
