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
  index, id: def.id, w: def.footprint[0], d: def.footprint[1], def,
  // Read through to the asset rather than copied out of it. An asset measures
  // its own height by building itself the first time it is asked, so copying
  // the number here -- for all four hundred of them, while this module
  // evaluates -- would build the entire library before the game could draw
  // anything. That is the stall this whole indirection exists to avoid. A
  // prototype the city never places never gets measured.
  get height(): number { return def.height; },
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
/** Trees and planting: never zoned, scattered onto whatever is left. */
const nurseryList: Proto[] = [];
/** Industry headquarters and harvest-area props, by id. */
const industryList: Proto[] = [];
/** Buildings a mod added: placed from their own tab, never sited or handed out by a level. */
const modList: Proto[] = [];

/** An industry prototype by id: `spec.hq.<resource>` or `spec.prop.<resource>`. */
export function industryProto(id: string): Proto | undefined {
  return industryList.find((p) => p.id === id);
}

const push = <K,>(m: Map<K, Proto[]>, k: K, p: Proto): void => {
  const list = m.get(k);
  if (list) list.push(p); else m.set(k, [p]);
};

ASSETS.forEach((def, index) => {
  const p = proto(def, index);
  // Industry headquarters and their area props are placed on purpose -- by the
  // industry tools and inside a drawn harvest area -- and never grown.
  if (def.id.startsWith('spec.')) { industryList.push(p); return; }
  if (def.zone === 'service') { serviceList.push(p); return; }
  if (def.zone === 'road') { push(roadBy, p.w, p); return; }
  if (def.zone === 'fleet') return;                   // placed on the road graph, later
  if (def.zone === 'nature') { nurseryList.push(p); return; }
  if (def.mod !== undefined) { modList.push(p); return; }
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

/**
 * How many steps of grandeur a plot can climb through.
 *
 * Three, because a pool holds five to a dozen prototypes and four bands would
 * leave one or two choices in each -- which reads as the same building repeated
 * down the street, which is the thing the pools exist to avoid.
 */
export const TIERS = 3;

/**
 * Each pool, reordered so the prototypes a tier prefers come first.
 *
 * Ranked by how much a building holds *per cell of ground it stands on* --
 * homes plus jobs over footprint. Both halves are declarative, so ranking costs
 * nothing, and it is the ratio rather than either number that means what a tier
 * is meant to mean. Capacity alone put a wide low-rise above a narrow tower and
 * a district that climbed a tier came out holding fewer people than before,
 * because the bigger buildings were bigger on the ground and fewer of them fit
 * down the street. Height would say it too, but height is measured off the mesh
 * and sorting by it would mean generating the whole library to do it.
 *
 * Three nested bands, each dropping the sparsest end of the one below. The spawner picks from a
 * band, and falls back to the pool when nothing in the band fits the gap it has
 * -- which is a decision the spawner has to make, because it is the only thing
 * that knows how much frontage is left. An earlier version returned the band
 * *followed by* the rest of the pool and let that do the biasing, which did
 * nothing at all: the spawner's pick is a hash over the whole list rather than
 * a walk down it, so reordering a list it samples uniformly changes nothing.
 */
const tiered = new Map<string, Proto[][]>();

function capacityOf(p: Proto): number {
  const held = (p.def.sim.households ?? 0) + (p.def.sim.jobs ?? 0);
  return held / Math.max(1, p.w * p.d);
}

function bandsFor(key: string, list: Proto[]): Proto[][] {
  const held = tiered.get(key);
  if (held !== undefined) return held;
  // Smallest first for the banding, so band 0 is the modest end.
  const bySize = [...list].sort((a, b) => capacityOf(a) - capacityOf(b));
  // Nested rather than disjoint: tier 0 is the whole pool, tier 1 drops the
  // sparsest third, tier 2 keeps only the densest third. Disjoint bands made
  // tier 0 -- which is what all bare land is -- the *smallest* buildings in the
  // pool, so painting a suburb produced half the housing it used to and an
  // upgrade was partly making back ground the tiering had taken away. Nesting
  // means bare land builds exactly what it always built and a tier is only ever
  // a gain.
  const bands: Proto[][] = [];
  for (let t = 0; t < TIERS; t++) {
    const from = Math.floor((t * bySize.length) / TIERS);
    const band = bySize.slice(from);
    bands.push(band.length > 0 ? band : bySize);
  }
  tiered.set(key, bands);
  return bands;
}

/**
 * Zoned stock for a district at a given tier.
 *
 * The tier comes from what the land is worth, so the same painted zoning grows
 * cottages on a street nobody wants and apartments on one everybody does -- and
 * grows into the second when the street improves. Tier 0 is what bare land
 * carries.
 */
export function stockAt(zone: Zone, density: Density, theme: Theme,
  tier: number): readonly Proto[] {
  const list = stock(zone, density, theme);
  if (list.length < TIERS) return list;
  const t = tier < 0 ? 0 : tier >= TIERS ? TIERS - 1 : tier | 0;
  return bandsFor(`${zone}|${density}|${theme}|${list.length}`, list as Proto[])[t];
}

/** The whole pool, for a plot no band can fill. */
export { stock as stockAny };

/**
 * Every prototype the spawner could have put where these ones already are.
 *
 * A pool is what a district draws from, so a city holding one member of a pool
 * will keep asking for the others as it grows -- and the moment it asks for one
 * nobody has baked yet is a frame that stops dead while a building is
 * generated. This is the list the renderer warms through while nothing else is
 * happening, so that the road the player draws next finds its meshes already
 * made.
 *
 * Stock and road tiles only. Services and signature buildings are placed one at
 * a time from a drawer, and the drawer says which one is about to be placed --
 * a far better guess than the whole branch.
 */
export function poolSiblings(placed: (index: number) => boolean): string[] {
  const out: string[] = [];
  const seen = new Set<number>();
  const take = (list: readonly Proto[]): void => {
    let hit = false;
    for (const p of list) if (placed(p.index)) { hit = true; break; }
    if (!hit) return;
    for (const p of list) {
      if (placed(p.index) || seen.has(p.index)) continue;
      seen.add(p.index);
      out.push(p.id);
    }
  };
  for (const list of stockBy.values()) take(list);
  for (const list of roadBy.values()) take(list);
  return out;
}

export function signatures(zone: Zone): readonly Proto[] {
  return signatureBy.get(zone) ?? [];
}

/** One signature building by id, for the tools that place one deliberately. */
export function signatureById(id: string): Proto | undefined {
  for (const list of signatureBy.values()) {
    const hit = list.find((p) => p.id === id);
    if (hit) return hit;
  }
  return modList.find((p) => p.id === id);
}

/** Every building the enabled mods added, smallest first. */
export const modBuildings: readonly Proto[] = [...modList].sort((a, b) => a.w * a.d - b.w * b.d);

export const services: readonly Proto[] = serviceList;

/** Road tiles exactly `width` cells across, so they fit a corridor edge to edge. */
export function roads(width: number): readonly Proto[] {
  return roadBy.get(width) ?? [];
}

/** Trees, smallest first, so a spawner filling a gap can find one that fits. */
export function planting(): readonly Proto[] {
  return nurseryList;
}

/** Every prototype, by index, for the renderer's side of the handshake. */
export const PROTO_COUNT = ASSETS.length;

/**
 * Where an asset sits in the registry, by id.
 *
 * The road tiler names the piece it wants rather than carrying a descriptor
 * around, so something has to turn that name into the index the instance
 * format and the atlas both key on.
 */
export const ASSET_INDEX = new Map<string, number>(ASSETS.map((a, i) => [a.id, i]));
