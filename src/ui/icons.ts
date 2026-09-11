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

import { ICON_SHEET, ICON_COLS, ICON_INDEX } from './icon-sheet';

export { ICON_INDEX };

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
