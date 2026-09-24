/**
 * Smoke and steam over the city's chimneys, as a list the frame can draw.
 *
 * The models say where their chimney mouths are (`MeshBuilder.emit`); this
 * turns that into world positions for every placed building that has one, and
 * keeps the list until the city or the set of baked models changes. The frame
 * then stands a plume on each within reach -- see `Movers.fill`.
 *
 * A scan of the instance table is one pass over tens of thousands of rows, so
 * it runs when something changed rather than every frame, and at most every
 * half second while the city is growing.
 */

import { EMITTERS, emittersVersion } from '../../assets/emitters';
import { INSTANCE_FLOATS } from '../city';
import type { City } from '../city';

export interface PlumeView {
  count: number;
  x: Float32Array;
  z: Float32Array;
  /** World height of the chimney mouth. */
  y: Float32Array;
  /** EMIT kind: 0 smoke, 1 steam, 2 large steam. */
  kind: Uint8Array;
  /** Per-plume phase, so neighbouring stacks do not breathe in step. */
  seed: Float32Array;
}

const MAX = 4096;

export class Plumes implements PlumeView {
  count = 0;
  x = new Float32Array(MAX);
  z = new Float32Array(MAX);
  y = new Float32Array(MAX);
  kind = new Uint8Array(MAX);
  seed = new Float32Array(MAX);
  private city: City | null = null;
  private stale = true;
  private seenVersion = -1;
  private scannedAt = -Infinity;

  /** The city was rebuilt: its instance table may have moved or grown. */
  use(city: City): void {
    this.city = city;
    this.stale = true;
  }

  /** Rescans if anything changed and enough time has passed. */
  refresh(now: number): void {
    if (this.city === null) return;
    if (!this.stale && this.seenVersion === emittersVersion) return;
    if (now - this.scannedAt < 500) return;
    this.scannedAt = now;
    this.stale = false;
    this.seenVersion = emittersVersion;
    this.scan(this.city);
  }

  private scan(city: City): void {
    const d = city.data;
    let n = 0;
    for (let i = 0; i < city.count && n < MAX; i++) {
      const k = i * INSTANCE_FLOATS;
      const list = EMITTERS.get(Math.round(d[k + 7]));
      if (list === undefined) continue;
      const px = d[k], pz = d[k + 1], py = d[k + 2], a = d[k + 3];
      const c = Math.cos(a), s = Math.sin(a);
      for (const e of list) {
        if (n >= MAX) break;
        // The same turn the vertex shader applies: prototype frame to world.
        this.x[n] = px + e.x * c - e.z * s;
        this.z[n] = pz + e.x * s + e.z * c;
        this.y[n] = py + e.y;
        this.kind[n] = e.kind;
        this.seed[n] = ((i * 2654435761) >>> 0) / 4294967296 * Math.PI * 2;
        n++;
      }
    }
    this.count = n;
  }
}
