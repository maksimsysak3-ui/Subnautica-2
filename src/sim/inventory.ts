/**
 * The asset registry, indexed the way a spawner asks for things.
 *
 * A spawner never wants "asset 214". It wants "a medium-density European
 * residential building at most four cells deep that fits the eleven cells of
 * frontage I have left", and it wants that answer without walking four hundred
 * descriptors. So the registry is bucketed once, at load, by the three things
 * that decide what may stand on a lot: what the lot is zoned, how dense the
 * district is, and which regional theme the district was given.
 *
 * Only the descriptors are read here. No mesh is built -- the whole point of
 * the atlas is that a prototype the city never places is never generated.
 *
 * The `index` on every entry is the position in ASSETS, which is also the
 * prototype index in the atlas and the row in the GPU prototype table. One
 * number identifies an asset through the whole pipeline.
 */

import { ASSETS } from '../assets/registry';
import type { AssetDef, Density, Zone } from '../assets/types';
import { ALL_THEMES } from '../assets/themes';
import type { Theme } from '../assets/themes';

/** What the spawner needs to know about a prototype to place it. */
export interface Proto {
  index: number;
  id: string;
  /** Lot size in 8 m zoning cells. */
  w: number;
  d: number;
  /** Approximate height in metres, for the instance's culling box. */
  height: number;
  def: AssetDef;
}

const proto = (def: AssetDef, index: number): Proto => ({
  index, id: def.id, w: def.footprint[0], d: def.footprint[1],
  height: def.height, def,
});

/** Zoned stock, keyed `zone|density|theme`. Signature buildings excluded. */
const stockBy = new Map<string, Proto[]>();
/** Signature buildings by zone: placed one at a time, never picked at random. */
const signatureBy = new Map<Zone, Proto[]>();
/** Services, in registry order, which groups them by branch already. */
const serviceList: Proto[] = [];
/** Road tiles, keyed by how many cells wide across the carriageway they are. */
const roadBy = new Map<number, Proto[]>();
/** Last-resort bucket: every stock prototype of a zone, at any density. */
const zoneAll = new Map<Zone, Proto[]>();

const push = <K,>(m: Map<K, Proto[]>, k: K, p: Proto): void => {
  const list = m.get(k);
  if (list) list.push(p); else m.set(k, [p]);
};

ASSETS.forEach((def, index) => {
  const p = proto(def, index);
  if (def.zone === 'service') { serviceList.push(p); return; }
  if (def.zone === 'road') { push(roadBy, p.w, p); return; }
  if (def.zone === 'fleet') return;                   // placed on the road graph, later
  if (def.signature) { push(signatureBy, def.zone, p); return; }
  push(stockBy, `${def.zone}|${def.density}|${def.theme ?? 'modern'}`, p);
  push(zoneAll, def.zone, p);
});

// Longest first, so a spawner that wants the biggest thing that fits can stop
// at the first match instead of scanning the bucket twice.
for (const list of stockBy.values()) list.sort((a, b) => b.w * b.d - a.w * a.d);
for (const list of zoneAll.values()) list.sort((a, b) => b.w * b.d - a.w * a.d);

/**
 * Zoned stock for a district, largest footprint first.
 *
 * The registry does not cover every combination -- the row-house theme is
 * low-density only, and the four zones do not all have a low tier -- and a
 * spawner that took an empty bucket at face value would silently drop every
 * district that asked for one. So the miss falls back: first to another theme
 * at the same density, then to the whole zone. An empty result means the zone
 * itself is not stock, which is a real answer.
 */
export function stock(zone: Zone, density: Density, theme: Theme): readonly Proto[] {
  const exact = stockBy.get(`${zone}|${density}|${theme}`);
  if (exact) return exact;
  for (const t of ALL_THEMES) {
    const near = stockBy.get(`${zone}|${density}|${t}`);
    if (near) return near;
  }
  return zoneAll.get(zone) ?? [];
}

export function signatures(zone: Zone): readonly Proto[] {
  return signatureBy.get(zone) ?? [];
}

export const services: readonly Proto[] = serviceList;

/** Road tiles exactly `width` cells across, so they fit a corridor edge to edge. */
export function roads(width: number): readonly Proto[] {
  return roadBy.get(width) ?? [];
}

/** Every prototype, by index, for the renderer's side of the handshake. */
export const PROTO_COUNT = ASSETS.length;
