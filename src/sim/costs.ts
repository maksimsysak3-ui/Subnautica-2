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

import { RULES } from './difficulty';
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
  // Eased down about a fifth across all three terms. The ordering between
  // buildings is what these are for and that is unchanged -- what changes is
  // how many of them a young city can afford, which was the complaint: the
  // first services ate most of a starting treasury before the city had any
  // income to replace it with.
  const raw = cells * 420 + def.height * 1000 + (def.sim.upkeep ?? 0) * 130;
  const priced = raw * RULES.build;
  const step = priced < 20000 ? 250 : priced < 100000 ? 1000 : 5000;
  return Math.max(step, Math.round(priced / step) * step);
}

/**
 * Weekly upkeep, as a share of what the thing cost to build.
 *
 * Upkeep used to be its own table of ratings times a constant, and the two
 * drifted apart from the prices: a service cost about a seventh of its price
 * every week, so a clinic ate its own cost in upkeep in seven weeks and a
 * handful of streets cost more to keep than the town could earn. Tied to the
 * price, upkeep is whatever was built, in proportion -- a big plant costs a
 * lot to run because it cost a lot to build, a street costs little because it
 * cost little -- and the difficulty's upkeep setting still leans on it.
 */
export const SERVICE_UPKEEP_RATE = 0.07;
export const ROAD_UPKEEP_RATE = 0.012;

/** How the difficulty leans on upkeep, against how it leans on building. */
function upkeepLean(): number {
  return RULES.upkeep / Math.max(1e-9, RULES.build);
}

/** A service building's weekly upkeep at full staff. */
export function serviceUpkeep(def: AssetDef): number {
  return buildingPrice(def) * SERVICE_UPKEEP_RATE * upkeepLean();
}

/** A metre of road's weekly upkeep, by class. */
export function roadUpkeepPerMetre(cls: RoadClass): number {
  return roadPrice(cls) * ROAD_UPKEEP_RATE * upkeepLean();
}

/**
 * Cost per metre of carriageway, by class. Width is most of it.
 *
 * About a third of what it was. At 5.5 a metre of corridor a hundred-metre
 * street cost a quarter of a million, and a town's first grid ate the whole
 * treasury: a city builder is drawn in roads, and the first ones have to be
 * cheap enough to draw freely. What stops a player paving the map is upkeep,
 * a share of the price every week, not the price itself.
 */
export function roadPrice(cls: RoadClass): number {
  const spec = ROAD_SPECS[cls];
  return Math.round((spec.edge * 1.9 + (spec.tram ? 16 : 0) + (spec.median ? 3 : 0)) * RULES.build);
}

/**
 * Cost per zoned cell: nothing.
 *
 * Zoning is a designation, not a building, and charging for it taxed the one
 * thing a new city has to do most of before it has any income to do it with.
 * What stops a player painting the whole map in the first minute is the land:
 * zoning only takes on plots the city owns, and those are bought.
 */
export function zonePrice(_zone: Zone, _density: Density): number {
  return 0;
}

/** A price, as it should read on a button: 1,250 / 24k / 1.2M. */
export function money(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(n < 10000000 ? 1 : 0)}M`;
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString();
}
