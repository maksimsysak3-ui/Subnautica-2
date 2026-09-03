/**
 * Decoding for the imported vehicle meshes.
 *
 * The data is base64 in fleet-data.ts: quantised positions, a colour per
 * vertex and an index list. Decoded once on first use and cached, because the
 * registry builds every asset at least twice -- once to measure its height and
 * again for whatever asks for it -- and a fleet of thirty models is a few
 * hundred thousand vertices to unpack.
 */

import { MeshBuilder } from './mesh';
import { IMPORTED } from './fleet-data';
import type { ImportedMesh } from './fleet-data';

interface Decoded {
  pos: Float32Array;
  col: Uint8Array;
  index: Uint32Array;
  /** Half extents and height, measured after decoding. */
  size: [number, number, number];
}

const cache = new Map<string, Decoded>();

function bytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decode(id: string, src: ImportedMesh): Decoded {
  const raw = bytes(src.verts);
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  // Nine bytes a vertex: three unsigned shorts of position, three bytes of
  // colour. Positions are quantised across the model's own bounding box, so
  // the precision is about a tenth of a millimetre on a car.
  const n = Math.floor(raw.length / 9);
  const pos = new Float32Array(n * 3);
  const col = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      const q = view.getUint16(i * 9 + k * 2, true);
      pos[i * 3 + k] = src.lo[k] + (q / 65535) * src.span[k];
    }
    col[i * 3] = raw[i * 9 + 6];
    col[i * 3 + 1] = raw[i * 9 + 7];
    col[i * 3 + 2] = raw[i * 9 + 8];
  }
  const ib = bytes(src.index);
  const iv = new DataView(ib.buffer, ib.byteOffset, ib.byteLength);
  const index = new Uint32Array(src.count);
  for (let i = 0; i < src.count; i++) {
    index[i] = src.wide ? iv.getUint32(i * 4, true) : iv.getUint16(i * 2, true);
  }
  let mx = 0, my = 0, mz = 0;
  for (let i = 0; i < n; i++) {
    mx = Math.max(mx, Math.abs(pos[i * 3]));
    my = Math.max(my, pos[i * 3 + 1]);
    mz = Math.max(mz, Math.abs(pos[i * 3 + 2]));
  }
  const out: Decoded = { pos, col, index, size: [mx, my, mz] };
  cache.set(id, out);
  return out;
}

export function importedMesh(id: string): Decoded | null {
  const hit = cache.get(id);
  if (hit !== undefined) return hit;
  const src = IMPORTED[id];
  if (src === undefined) return null;
  return decode(id, src);
}

/** Every imported vehicle, in the order the pack listed them. */
export const IMPORTED_IDS: string[] = Object.keys(IMPORTED);

/** The label the pack gave a model. */
export function importedName(id: string): string {
  return IMPORTED[id]?.name ?? id;
}

/** Half-extents and height, so the lot size and the pad can be measured. */
export function importedSize(id: string): [number, number, number] {
  return importedMesh(id)?.size ?? [1, 1, 1];
}

/** Draws one, standing on the ground and facing along +x. */
export function drawImported(m: MeshBuilder, id: string,
  opts: { cx?: number; cz?: number; turns?: number; scale?: number } = {}): void {
  const d = importedMesh(id);
  if (d === null) return;
  m.imported(d.pos, d.col, d.index, opts);
}

/**
 * The far impostor: a box in the model's own average colour.
 *
 * An imported mesh has no cheaper version of itself -- the pack ships one
 * level of detail -- so without this the fleet costs the same at every
 * distance, which is the one thing procedural assets were good at. A vehicle
 * two hundred metres away is a coloured block, and a coloured block is what
 * this draws.
 */
export function drawImpostor(m: MeshBuilder, id: string): void {
  const d = importedMesh(id);
  if (d === null) return;
  let r = 0, g = 0, b = 0;
  const n = d.col.length / 3;
  for (let i = 0; i < n; i++) { r += d.col[i * 3]; g += d.col[i * 3 + 1]; b += d.col[i * 3 + 2]; }
  const col = new Uint8Array([r / n, g / n, b / n]);
  const [hx, hy, hz] = d.size;
  // Wheels-down: the box sits from the ground to the model's own height.
  const pos = new Float32Array([
    -hx, 0, -hz, hx, 0, -hz, hx, 0, hz, -hx, 0, hz,
    -hx, hy, -hz, hx, hy, -hz, hx, hy, hz, -hx, hy, hz,
  ]);
  const cols = new Uint8Array(24);
  for (let i = 0; i < 8; i++) cols.set(col, i * 3);
  m.imported(pos, cols, new Uint32Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
  ]));
}
