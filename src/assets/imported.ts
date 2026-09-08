/**
 * Decoding for the imported vehicle meshes.
 *
 * The data is base64 in fleet-data.ts, split in two: a shape holds quantised
 * positions and an index list, and a model holds a shape plus a colour per
 * vertex. The packs are mostly one body in a dozen liveries, so the split
 * stores each body's geometry once and pays three bytes a vertex per livery.
 *
 * Decoded once on first use and cached, because the
 * registry builds every asset at least twice -- once to measure its height and
 * again for whatever asks for it -- and a fleet of thirty models is a few
 * hundred thousand vertices to unpack.
 */

import { MeshBuilder } from './mesh';
import { FLEET_DATA } from './fleet-data';
import type { ImportedShape, ImportedModel } from './fleet-data';

interface Decoded {
  pos: Float32Array;
  col: Uint8Array;
  index: Uint32Array;
  /** Half extents and height, measured after decoding. */
  size: [number, number, number];
}

/** Decoded once per (id, detail); `low` is the vertex-clustered copy. */
const KEY = (id: string, low: boolean): string => (low ? id + '~' : id);

const cache = new Map<string, Decoded>();

function bytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Dequantises a shape's positions and indices. No colour: that is per model.
 */
function unpack(src: ImportedShape, low: boolean): { pos: Float32Array; index: Uint32Array } {
  const raw = bytes(low ? src.lowVerts : src.verts);
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  // Six bytes a vertex of position: three unsigned shorts quantised across the
  // shape's own bounding box, so the precision is a fraction of a millimetre
  // on a car.
  const n = Math.floor(raw.length / 6);
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      const q = view.getUint16(i * 6 + k * 2, true);
      pos[i * 3 + k] = src.lo[k] + (q / 65535) * src.span[k];
    }
  }
  const ib = bytes(low ? src.lowIndex : src.index);
  const iv = new DataView(ib.buffer, ib.byteOffset, ib.byteLength);
  const count = low ? src.lowCount : src.count;
  const wide = src.wide && !low;             // the cheap copy always fits in 16 bits
  const index = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    index[i] = wide ? iv.getUint32(i * 4, true) : iv.getUint16(i * 2, true);
  }
  return { pos, index };
}

/** Bins per degree in the yaw histogram, and the half-width it is smoothed by. */
const YAW_BINS = 4, YAW_SMOOTH = 4;
/** Below this many degrees a measured yaw is quantiser noise, not a rotation. */
const YAW_DEADBAND = 1.0;

/**
 * How far a model is rotated off its own axes, in radians.
 *
 * The civil service pack does not ship its vehicles facing down an axis: it
 * ships the arrangement the artist laid out, and in that arrangement the
 * ambulance sits at 20 degrees, the fire engine at 35, the police car at -40.
 * Nothing downstream can cope with that. The lot size comes out square, so a
 * four-metre car asks for an 8x8 lot; the viewer's pad is a diamond under a
 * straight vehicle; and the moment traffic exists, every one of these will
 * drive down the road crabwise.
 *
 * The measurement is the one thing a vehicle is generous with: its sides,
 * front and back are large flat vertical faces, all at right angles to each
 * other. So take every near-vertical facet, fold its normal's azimuth into a
 * quarter turn -- which makes those four faces agree instead of cancelling --
 * and histogram it by area. The peak is the model's yaw. A body full of curved
 * panels spreads across the histogram and cannot outweigh the flat ones.
 *
 * Folding to a quarter turn means this squares a vehicle to the axes but
 * cannot tell its nose from its tail; it corrects by at most 45 degrees and
 * so always keeps whichever way round the pack drew it.
 *
 * Idempotent by construction: run it on a model that is already square and the
 * peak lands in the deadband and nothing moves. That is what lets it sit in
 * the loader rather than in a table of hand-measured angles that a re-import
 * would silently invalidate.
 */
function measureYaw(pos: Float32Array, index: Uint32Array): number {
  const bins = new Float64Array(90 * YAW_BINS);
  for (let t = 0; t + 2 < index.length; t += 3) {
    const a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-12) continue;
    const horiz = Math.hypot(nx, nz);
    // Roofs, floors and bonnets say nothing about yaw, and there are a lot of
    // them; only the near-vertical facets are asked.
    if (horiz < 0.85 * len) continue;
    let deg = Math.atan2(nz, nx) * 180 / Math.PI;
    deg = ((deg % 90) + 90) % 90;
    bins[Math.round(deg * YAW_BINS) % bins.length] += horiz / 2;
  }
  let best = -1, at = 0;
  for (let i = 0; i < bins.length; i++) {
    let s = 0;
    for (let k = -YAW_SMOOTH; k <= YAW_SMOOTH; k++) s += bins[(i + k + bins.length) % bins.length];
    if (s > best) { best = s; at = i; }
  }
  if (best <= 0) return 0;
  // Refine to the weighted centre of the peak, so the answer is not stuck to
  // the bin grid -- a quarter of a degree over six metres is a visible skew.
  let w = 0, sum = 0;
  for (let k = -YAW_SMOOTH; k <= YAW_SMOOTH; k++) {
    const v = bins[(at + k + bins.length) % bins.length];
    w += v; sum += v * k;
  }
  let deg = (at + (w > 0 ? sum / w : 0)) / YAW_BINS;
  if (deg > 45) deg -= 90;
  return Math.abs(deg) < YAW_DEADBAND ? 0 : deg * Math.PI / 180;
}

/** Measured once per shape: the liveries of one body share its geometry. */
const yaws = new Map<string, number>();

/**
 * The rotation that squares a shape up and lays it along x, in radians.
 *
 * Two decisions, and only the first of them is a measurement. `measureYaw`
 * folds into a quarter turn, so it can leave a vehicle standing across the
 * lot rather than along it; the second decision is which of the two axes is
 * the long one, and that is just a bounding box. Together they get a vehicle
 * parallel to the road, which is the whole point.
 *
 * What neither can tell is a nose from a tail. A pack that draws a car
 * pointing backwards keeps it, here and in the viewer, and that is the
 * importer's business rather than the loader's.
 */
function yawOf(key: string, src: ImportedShape): number {
  const hit = yaws.get(key);
  if (hit !== undefined) return hit;
  // Always measured on the full-detail copy. The cheap copy is vertex
  // clustered, which rounds every flat panel it welds and blunts the peak.
  const { pos, index } = unpack(src, false);
  let y = measureYaw(pos, index);
  const c = Math.cos(-y), s = Math.sin(-y);
  let ex = 0, ez = 0;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], z = pos[i + 2];
    ex = Math.max(ex, Math.abs(x * c - z * s));
    ez = Math.max(ez, Math.abs(x * s + z * c));
  }
  if (ez > ex) y -= Math.PI / 2;
  yaws.set(key, y);
  return y;
}

/**
 * Colour distance, out of 255, at which two facets are painted differently.
 *
 * Generous. Two shades of the same panel colour differ by a handful; a facet
 * that read the wrong patch out of an atlas differs by a hundred and fifty.
 */
const ODD_APART = 40;
/** And the distance within which a facet's neighbours count as agreeing. */
const ODD_TOGETHER = 28;
/** How parallel a facet and its neighbour must be to be one flat panel. */
const ODD_COPLANAR = 0.97;

/**
 * Edge adjacency, welded by position and cached per shape.
 *
 * Geometry, not colour, so the dozen liveries of one body share it -- which
 * matters, because building it is the expensive half of the repair below and
 * the pack is mostly one van in nine paint jobs.
 *
 * Stored as CSR: `at[t]` to `at[t + 1]` indexes into `of`.
 */
interface Adjacency { at: Int32Array; of: Int32Array }
const adjacencies = new Map<string, Adjacency>();

function adjacency(key: string, pos: Float32Array, index: Uint32Array): Adjacency {
  const hit = adjacencies.get(key);
  if (hit !== undefined) return hit;
  // Weld to a tenth of a millimetre. The positions came out of a 16-bit
  // quantiser, so two vertices meant to be the same one are equal to well
  // inside that; anything coarser starts welding a panel to the one behind it.
  const ids = new Int32Array(pos.length / 3);
  const seen = new Map<string, number>();
  for (let v = 0; v < ids.length; v++) {
    const k = `${Math.round(pos[v * 3] * 10000)},${Math.round(pos[v * 3 + 1] * 10000)},${Math.round(pos[v * 3 + 2] * 10000)}`;
    let q = seen.get(k);
    if (q === undefined) { q = seen.size; seen.set(k, q); }
    ids[v] = q;
  }
  const tris = index.length / 3;
  const edges = new Map<number, number[]>();
  for (let t = 0; t < tris; t++) {
    const a = ids[index[t * 3]], b = ids[index[t * 3 + 1]], c = ids[index[t * 3 + 2]];
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const k = Math.min(u, v) * 0x4000000 + Math.max(u, v);
      const l = edges.get(k);
      if (l === undefined) edges.set(k, [t]); else l.push(t);
    }
  }
  const counts = new Int32Array(tris + 1);
  for (const l of edges.values()) for (const t of l) counts[t + 1] += l.length - 1;
  for (let t = 0; t < tris; t++) counts[t + 1] += counts[t];
  const at = counts, of = new Int32Array(at[tris]);
  const fill = at.slice(0, tris);
  for (const l of edges.values()) {
    for (const t of l) for (const u of l) if (u !== t) of[fill[t]++] = u;
  }
  const out = { at, of };
  adjacencies.set(key, out);
  return out;
}

/**
 * Repaints facets that read the wrong patch out of the pack's atlas.
 *
 * The colour of a facet was sampled at its UV centroid, and where an atlas
 * puts an ambulance's red flash next to its white flank, a facet whose
 * centroid lands a texel over comes back red. On the civil service pack that
 * is a couple of dozen facets a vehicle, and because they are the big panels
 * -- a van's flank is four triangles, not four hundred -- what you see is a
 * red wedge across a white door, or a black gash down a yellow bus.
 *
 * A facet is repainted only when it is wrong in a way that geometry cannot
 * explain: every neighbour disagrees with it, all of them agree with each
 * other, and all of them lie in its own plane. A moulding, a lamp, a reflector
 * or an inset panel fails the last test; a painted stripe fails the first,
 * because a stripe runs the length of a panel and so has itself for a
 * neighbour. What is left is a single facet of the wrong colour in the middle
 * of one flat surface, which is not something a low-poly pack ever draws on
 * purpose.
 *
 * Nothing to do on a clean pack: the two car packs come through this with zero
 * facets touched, which is the check that it is repairing a defect rather than
 * flattening detail.
 */
function despeckle(pos: Float32Array, col: Uint8Array, index: Uint32Array, adj: Adjacency): {
  pos: Float32Array; col: Uint8Array;
} {
  const tris = index.length / 3;
  const cr = new Float32Array(tris), cg = new Float32Array(tris), cb = new Float32Array(tris);
  const nx = new Float32Array(tris), ny = new Float32Array(tris), nz = new Float32Array(tris);
  for (let t = 0; t < tris; t++) {
    const a = index[t * 3], b = index[t * 3 + 1], c = index[t * 3 + 2];
    cr[t] = (col[a * 3] + col[b * 3] + col[c * 3]) / 3;
    cg[t] = (col[a * 3 + 1] + col[b * 3 + 1] + col[c * 3 + 1]) / 3;
    cb[t] = (col[a * 3 + 2] + col[b * 3 + 2] + col[c * 3 + 2]) / 3;
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    const len = Math.hypot(x, y, z) || 1;
    nx[t] = x / len; ny[t] = y / len; nz[t] = z / len;
  }
  const apart = (i: number, j: number): number => Math.max(
    Math.abs(cr[i] - cr[j]), Math.abs(cg[i] - cg[j]), Math.abs(cb[i] - cb[j]));
  const flat = (i: number, j: number): boolean =>
    nx[i] * nx[j] + ny[i] * ny[j] + nz[i] * nz[j] > ODD_COPLANAR;

  const extraPos: number[] = [], extraCol: number[] = [];
  const base = pos.length / 3;
  for (let t = 0; t < tris; t++) {
    const from = adj.at[t], to = adj.at[t + 1];
    if (to - from < 2) continue;
    let ok = true;
    for (let i = from; i < to && ok; i++) {
      const u = adj.of[i];
      if (apart(t, u) <= ODD_APART || !flat(t, u)) ok = false;
      for (let j = from; j < to && ok; j++) if (apart(u, adj.of[j]) > ODD_TOGETHER) ok = false;
    }
    if (!ok) continue;
    // Repainted onto three vertices of its own. The pack shares vertices
    // between facets, so writing the new colour where it stood would drag the
    // panel it was cut out of along with it.
    const u = adj.of[from];
    const r = Math.round(cr[u]), g = Math.round(cg[u]), b = Math.round(cb[u]);
    for (let k = 0; k < 3; k++) {
      const v = index[t * 3 + k];
      extraPos.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
      extraCol.push(r, g, b);
      index[t * 3 + k] = base + extraPos.length / 3 - 1;
    }
  }
  if (extraPos.length === 0) return { pos, col };
  const p2 = new Float32Array(pos.length + extraPos.length);
  p2.set(pos); p2.set(extraPos, pos.length);
  const c2 = new Uint8Array(col.length + extraCol.length);
  c2.set(col); c2.set(extraCol, col.length);
  return { pos: p2, col: c2 };
}

function decode(id: string, model: ImportedModel, src: ImportedShape, low: boolean): Decoded {
  const { pos, index } = unpack(src, low);
  const n = pos.length / 3;
  const col = bytes(low ? model.lowColour : model.colour).slice(0, n * 3);
  const yaw = yawOf(model.shape, src);
  if (yaw !== 0) {
    const c = Math.cos(-yaw), s = Math.sin(-yaw);
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3], z = pos[i * 3 + 2];
      pos[i * 3] = x * c - z * s;
      pos[i * 3 + 2] = x * s + z * c;
    }
  }
  // Measured after the rotation, or a squared-up model would keep the lot size
  // of the crooked one.
  let mx = 0, my = 0, mz = 0;
  for (let i = 0; i < n; i++) {
    mx = Math.max(mx, Math.abs(pos[i * 3]));
    my = Math.max(my, pos[i * 3 + 1]);
    mz = Math.max(mz, Math.abs(pos[i * 3 + 2]));
  }
  const fixed = despeckle(pos, col, index, adjacency(KEY(model.shape, low), pos, index));
  const out: Decoded = { pos: fixed.pos, col: fixed.col, index, size: [mx, my, mz] };
  cache.set(KEY(id, low), out);
  return out;
}

export function importedMesh(id: string, low = false): Decoded | null {
  const hit = cache.get(KEY(id, low));
  if (hit !== undefined) return hit;
  const model = FLEET_DATA.models[id];
  if (model === undefined) return null;
  const shape = FLEET_DATA.shapes[model.shape];
  if (shape === undefined) return null;
  return decode(id, model, shape, low);
}

/** Every imported vehicle, in the order the pack listed them. */
export const IMPORTED_IDS: string[] = Object.keys(FLEET_DATA.models);

/** The label the pack gave a model. */
export function importedName(id: string): string {
  return FLEET_DATA.models[id]?.name ?? id;
}

/** Half-extents and height, so the lot size and the pad can be measured. */
export function importedSize(id: string): [number, number, number] {
  return importedMesh(id)?.size ?? [1, 1, 1];
}

/** Draws one, standing on the ground and facing along +x. */
export function drawImported(m: MeshBuilder, id: string,
  opts: { cx?: number; cz?: number; turns?: number; scale?: number; low?: boolean } = {}): void {
  const d = importedMesh(id, opts.low === true);
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
