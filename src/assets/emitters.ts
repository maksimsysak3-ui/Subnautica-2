/**
 * Where each prototype's chimneys are, by prototype index.
 *
 * Filled by the atlas as it bakes a prototype -- the only moment the model is
 * built anyway -- so knowing where the smoke comes from costs nothing extra,
 * and a prototype the city never placed is never asked.
 */

import type { Emitter } from './mesh';

export const EMITTERS = new Map<number, readonly Emitter[]>();

/** Bumped whenever a prototype with chimneys is baked, so a scan can tell it is stale. */
export let emittersVersion = 0;

export function recordEmitters(proto: number, list: readonly Emitter[]): void {
  if (list.length === 0 || EMITTERS.has(proto)) return;
  EMITTERS.set(proto, list.slice());
  emittersVersion++;
}
