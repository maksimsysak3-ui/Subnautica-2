/**
 * Tourism: visitors, where they sleep, and what they spend.
 *
 * A city is visited for what is worth seeing in it -- its landmarks, its
 * museums, its zoo, its stadium on a match day -- and only as much as it can
 * put people up and get them there. So three things decide the trade, and the
 * player controls all three:
 *
 *   - the draw: each attraction adds to it, a wonder of the world most of all;
 *   - the beds: hotels grow in dense commercial zoning and a grand hotel can
 *     be placed, and a visitor with nowhere to stay is a day-tripper who spends
 *     a third as much;
 *   - the way in: an airport brings the world, a railway or a harbour the
 *     region, a coach station the county.
 *
 * And the city itself: a happy, handsome city is recommended and a miserable
 * one is not. Visitors spend in the shops, so the take is on the commercial
 * rate: raising it taxes the tourists too.
 */

import type { AssetDef } from '../assets/types';

/** What one attraction draws, in visitors a day before the city's appeal and its links. */
const DRAW: ReadonlyArray<[RegExp, number, string]> = [
  [/^svc\.parks\.zoo$/, 90, 'the zoo'],
  [/^svc\.parks\.stadium$/, 80, 'the stadium'],
  [/^svc\.gov\.museum$/, 70, 'the museum'],
  [/^svc\.parks\.arena$/, 55, 'the arena'],
  [/^svc\.gov\.gallery$/, 50, 'the gallery'],
  [/^svc\.gov\.concert$/, 50, 'the concert hall'],
  [/^svc\.death\.cathedral$/, 40, 'the cathedral'],
  [/^svc\.edu\.observatory$/, 35, 'the observatory'],
  [/^svc\.parks\.(aquatics|glasshouse)$/, 30, 'the gardens'],
  [/^svc\.parks\.(lake|lido)$/, 22, 'the lake'],
  [/^svc\.parks\.(square|garden|bandstand)$/, 12, 'the parks'],
  [/^svc\.parks\./, 4, 'the parks'],
];

/** Beds a hotel that grows in the commercial zoning has. */
const LODGING_BEDS = 160;
/** And a grand one, placed as a landmark. */
const GRAND_BEDS = 320;

/** What a building draws, and the name the Herald would give it. */
export function attractionOf(def: AssetDef): { draw: number; what: string } {
  // A wonder of the world is why people cross the world; a monument, the county.
  if (def.mod === 'wonders') return { draw: 220, what: def.name };
  if (def.mod === 'monuments') return { draw: 90, what: def.name };
  for (const [re, draw, what] of DRAW) if (re.test(def.id)) return { draw, what };
  // A landmark: a signature tower, a player's own. Bigger ones draw more.
  if (def.signature === true) {
    const area = def.footprint[0] * def.footprint[1];
    return { draw: Math.min(80, 25 + area * 0.6), what: def.name };
  }
  return { draw: 0, what: '' };
}

export function bedsOf(def: AssetDef): number {
  if (def.zone !== 'commercial') return 0;
  if (def.id.endsWith('.lodging')) return LODGING_BEDS;
  // A landmark hotel says so in its description, which is the one place the
  // library records what a signature building is for.
  if (def.signature === true && /\bhotel\b/i.test(`${def.name} ${def.note}`)) return GRAND_BEDS;
  return 0;
}

/** How a city is reached, as a multiplier on who comes: the best one it has. */
export function gatewayOf(ids: ReadonlySet<string>): { reach: number; via: string } {
  if (ids.has('svc.transport.airport')) return { reach: 1.8, via: 'the airport' };
  if (ids.has('svc.transport.central') || ids.has('svc.transport.rail')) return { reach: 1.35, via: 'the railway' };
  if (ids.has('svc.transport.ferry') || ids.has('svc.transport.docks')) return { reach: 1.25, via: 'the harbour' };
  if (ids.has('svc.transport.coach')) return { reach: 1.1, via: 'the coach station' };
  return { reach: 0.8, via: 'the roads' };
}

export interface TourismReport {
  /** The draw, before appeal and links. */
  attraction: number;
  beds: number;
  /** Visitors a day, and of them how many stay the night. */
  visitors: number;
  overnight: number;
  /** 0 to 1: how well the city is spoken of. */
  appeal: number;
  /** The best way in, by name. */
  via: string;
  /** What draws the most. */
  top: string;
}

/**
 * Who comes, a day.
 *
 * Demand grows with the draw and falls with what the city is like; the ones
 * who can find a bed stay, the rest come for the day if the city is near
 * enough to people to be worth the trip -- which a village is not.
 */
export function visitors(attraction: number, beds: number, reach: number, appeal: number, population: number):
{ visitors: number; overnight: number } {
  if (attraction <= 0) return { visitors: 0, overnight: 0 };
  const demand = attraction * 5 * reach * appeal;
  const overnight = Math.min(demand * 0.7, beds * 0.85);
  const day = Math.min(demand - overnight, 40 + population * 0.12);
  return { visitors: Math.round(overnight + Math.max(0, day)), overnight: Math.round(overnight) };
}

/** How a city is spoken of: the mood of the people in it, and how it looks. */
export function appealOf(happiness: number, landValue: number): number {
  return Math.max(0.15, Math.min(1.2, 0.35 + 0.9 * (happiness - 0.4) + 0.6 * (landValue - 0.3)));
}
