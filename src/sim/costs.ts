/**
 * What things cost.
 *
 * A price is the only number in a city builder that makes a choice a choice.
 * Without one every tool is equally free, the palette is a list of shapes, and
 * "should I put the big hospital here" is not a question anyone has to answer.
 *
 * These are derived from what the asset already declares -- its footprint, its
 * height and its running cost -- rather than typed in per building. A
 * hand-written price list of ninety buildings goes stale the moment one of
 * them is resized, and nobody notices until the numbers stop making sense
 * against each other. Derived, a bigger building is always dearer than a
 * smaller one of the same kind, which is the only ordering a player actually
 * checks.
 */

import type { AssetDef } from '../assets/types';
import { ROAD_SPECS } from './roadgraph';
import type { RoadClass } from './roadgraph';
import type { Density, Zone } from '../assets/types';

/**
 * The price of one placed building.
 *
 * Three terms: the land it takes, the structure standing on it, and a year of
 * what it costs to run -- which is what makes a power station dearer than a
 * warehouse of the same size. Rounded to something a player can hold in their
 * head, because a hospital costing 41,732 reads as noise.
 */
export function buildingPrice(def: AssetDef): number {
  const cells = def.footprint[0] * def.footprint[1];
  const raw = cells * 520 + def.height * 1250 + (def.sim.upkeep ?? 0) * 160;
  const step = raw < 20000 ? 250 : raw < 100000 ? 1000 : 5000;
  return Math.max(step, Math.round(raw / step) * step);
}

/** Cost per metre of carriageway, by class. Width is most of it. */
export function roadPrice(cls: RoadClass): number {
  const spec = ROAD_SPECS[cls];
  return Math.round(spec.edge * 5.5 + (spec.tram ? 42 : 0) + (spec.median ? 8 : 0));
}

/**
 * Cost per zoned cell.
 *
 * Zoning is cheap -- the city is buying a designation, not a building -- but
 * not free, because free zoning means painting the whole map on the first
 * minute and watching it fill.
 */
export function zonePrice(zone: Zone, density: Density): number {
  const base = zone === 'nature' ? 22 : zone === 'industrial' ? 30 : 36;
  const tier = density === 'high' ? 2.6 : density === 'medium' ? 1.6 : 1;
  return Math.round(base * tier);
}

/** A price, as it should read on a button: 1,250 / 24k / 1.2M. */
export function money(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(n < 10000000 ? 1 : 0)}M`;
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString();
}
