/**
 * The toolbar's building icons.
 *
 * One sprite sheet of every placeable building, photographed through the
 * game's own shader -- see tools/icon-sheet.mjs. A player hunting for the fire
 * station is hunting for the building they have seen on the map, and no
 * pictogram of a flame is that building.
 *
 * Drawn as a background rather than an `<img>` so the whole palette is one
 * decode and one GPU upload however many icons are on screen.
 */

import { ICON_SHEET, ICON_COLS, ICON_INDEX, ICON_ZONE } from './icon-sheet';

export { ICON_INDEX };

/**
 * The building that stands for a zone at a density.
 *
 * A zone button saying "medium residential" names a category; a picture of the
 * kind of building that actually grows there answers the question the player
 * is asking, which is what am I about to get. With a theme, it is the building
 * that theme builds -- the same density is six different streets, and the
 * drawer is where that becomes a choice rather than a surprise.
 *
 * Falls back to the zone's other densities, because industry has no density
 * ladder and the spawner treats its three buttons as one pool.
 */
export function zoneSpecimen(zone: string, density: string, theme?: string): string | null {
  if (theme !== undefined) {
    const themed = ICON_ZONE[`${zone}|${density}|${theme}`];
    if (themed !== undefined) return themed;
  }
  const exact = ICON_ZONE[`${zone}|${density}`];
  if (exact !== undefined) return exact;
  for (const key of Object.keys(ICON_ZONE)) {
    if (key.startsWith(`${zone}|`)) return ICON_ZONE[key];
  }
  return null;
}

/** True if this zone, density and theme actually builds anything. */
export function hasSpecimen(zone: string, density: string, theme: string): boolean {
  return ICON_ZONE[`${zone}|${density}|${theme}`] !== undefined;
}

/** True if this asset was photographed, so a caller can fall back if not. */
export function hasIcon(id: string): boolean {
  return ICON_INDEX[id] !== undefined;
}

/**
 * One icon, as an element.
 *
 * The sheet is scaled to the requested size and offset to the cell, which is
 * the standard sprite trick and the only one that keeps a single image while
 * letting each place that uses it choose its own size.
 */
export function assetIcon(id: string, px = 40): HTMLElement {
  const el = document.createElement('i');
  const i = ICON_INDEX[id];
  el.style.cssText = [
    'display:block', `width:${px}px`, `height:${px}px`, 'flex:0 0 auto',
    'image-rendering:auto',
  ].join(';');
  if (i === undefined) return el;
  const col = i % ICON_COLS, row = Math.floor(i / ICON_COLS);
  el.style.backgroundImage = `url(${ICON_SHEET})`;
  el.style.backgroundSize = `${ICON_COLS * px}px auto`;
  el.style.backgroundPosition = `-${col * px}px -${row * px}px`;
  el.style.backgroundRepeat = 'no-repeat';
  return el;
}
