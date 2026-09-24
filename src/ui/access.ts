/**
 * Accessibility switches the whole interface reads.
 *
 * Colour-blind friendly: every "good versus bad" signal in the game -- value
 * readouts, bars, and the colour scale of every map view -- is red against
 * green, which is the one pair the most common colour blindness cannot tell
 * apart. The switch moves them onto orange against blue, which every common
 * form can.
 *
 * Reduce motion: no pulsing markers, sliding cards or camera glide.
 */

import { SKIN } from './skin';

export const ACCESS = { colourBlind: false, reduceMotion: false };

/** A map view's scale, bad to good, that reads without red and green. */
const SAFE_RAMP: [string, string, string] = ['#c8561a', '#e3cf86', '#2f7fd0'];

/** The scale to draw a view in, under the current setting. */
export function rampFor(ramp: readonly [string, string, string]): [string, string, string] {
  return ACCESS.colourBlind ? SAFE_RAMP : [ramp[0], ramp[1], ramp[2]];
}

const NORMAL = { good: SKIN.good, bad: SKIN.bad };

export function applyAccess(colourBlind: boolean, reduceMotion: boolean): void {
  ACCESS.colourBlind = colourBlind;
  ACCESS.reduceMotion = reduceMotion;
  // Read at paint time everywhere, so readouts pick the new colours up as
  // they next refresh.
  const skin = SKIN as unknown as { good: string; bad: string };
  skin.good = colourBlind ? '#4ea5ff' : NORMAL.good;
  skin.bad = colourBlind ? '#f08a2c' : NORMAL.bad;
  document.documentElement.dataset.motion = reduceMotion ? 'reduce' : '';
}
