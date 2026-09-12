/**
 * Every asset the project has, in one list.
 *
 * This becomes the pack manifest when assets ship as files. For now it is the
 * thing the viewer enumerates and the spawner will later query by zone,
 * density and footprint.
 */

import { HOUSING } from './generators/housing';
import { SIGNATURE_RESIDENTIAL } from './generators/signature-res';
import { SIGNATURE_COMMERCIAL } from './generators/signature-com';
import { SIGNATURE_OFFICE } from './generators/signature-off';
import { SIGNATURE_INDUSTRIAL } from './generators/signature-ind';
import { COMMERCE, WORKPLACES, MAKING } from './generators/trade';
import { SAFETY } from './generators/services-safety';
import { UTILITY } from './generators/services-utility';
import { CIVIC } from './generators/services-civic';
import { EXTRA_SERVICES } from './generators/services-extra';
import { DEATH_AND_POST } from './generators/services-civic2';
import { SERVICE_LANDMARKS } from './generators/services-landmark';
import { MORE_SERVICES } from './generators/services-more';
import { TREES } from './generators/trees';
import { ROADS } from './generators/roads';
import { FLEET } from './generators/vehicles';
import { MARINE } from './generators/marine';
import { SPORT } from './generators/sport';
import { MeshBuilder } from './mesh';
import { dressRoof } from './parts';
import { idSeed } from './types';
import type { AssetDef, Zone } from './types';

export const ASSETS: AssetDef[] = [
  ...HOUSING, ...COMMERCE, ...WORKPLACES, ...MAKING,
  ...SIGNATURE_RESIDENTIAL, ...SIGNATURE_COMMERCIAL, ...SIGNATURE_OFFICE, ...SIGNATURE_INDUSTRIAL,
  ...SAFETY, ...UTILITY, ...CIVIC, ...EXTRA_SERVICES, ...DEATH_AND_POST, ...SERVICE_LANDMARKS, ...MORE_SERVICES, ...TREES, ...SPORT, ...FLEET, ...MARINE, ...ROADS,
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
  // Decided once from the full-detail mesh and reused at every LOD -- but on
  // the first build, not here. Working it out for all three hundred and fifty
  // assets while this module evaluated meant a full build of every asset in
  // the library before the page could paint, and a second one for the heights
  // below. That was several seconds of blocked main thread on a fast machine
  // and long enough to look like a hang on a laptop. Almost none of it was
  // needed: a session looks at a handful of assets.
  let plane: ReturnType<MeshBuilder['roofPlane']> | undefined;
  a.build = (lod: number): MeshBuilder => {
    MeshBuilder.detail = lod;
    const m = inner(lod);
    if (plane === undefined) {
      // Measured off the full-detail mesh, so the roof a coarse level is
      // dressed on is the same roof the fine one has. Building that
      // measurement at the outer level's detail would let the two disagree.
      MeshBuilder.detail = 0;
      const lod0 = lod === 0 ? m : inner(0);
      plane = lod0.roofPlane() ?? lod0.bareRoofPlane();
      MeshBuilder.detail = lod;
    }
    dressRoof(m, lod, seed, { at: plane });
    MeshBuilder.detail = 0;
    return m;
  };
}

// Height is measured from the mesh rather than declared. A hand-written number
// drifts the moment a generator gains a chimney, and every consumer -- the
// spawner, the LOD selector, the viewer's framing -- would then be working
// from a lie.
//
// Measured on first read rather than up front, for the reason above: this was
// a second full build of the whole library during module evaluation. bounds()
// itself is cheap -- it reads the vertex list without baking occlusion -- but
// the build feeding it is not.
for (const a of ASSETS) {
  let measured: number | undefined;
  Object.defineProperty(a, 'height', {
    configurable: true,
    enumerable: true,
    get(): number {
      if (measured === undefined) {
        measured = Math.round(a.build(0).bounds().max[1] * 10) / 10;
      }
      return measured;
    },
    set(v: number) { measured = v; },
  });
}

export function assetById(id: string): AssetDef | undefined {
  return ASSETS.find((a) => a.id === id);
}
