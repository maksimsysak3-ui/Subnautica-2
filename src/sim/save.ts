/**
 * Saving a city, and getting it back.
 *
 * A city is not the thing on screen. The thing on screen is derived: every
 * building, every tree, every metre of tarmac is worked out again from scratch
 * on each rebuild. What a player actually made is much smaller -- where the
 * roads run, what each cell is zoned for, and what they placed by hand -- and
 * that is all this writes. Saving the derived city would be megabytes of
 * buildings that the generator can produce again from kilobytes of intent, and
 * it would go stale the moment a generator changed.
 *
 * The format is versioned and deliberately dull: a JSON object of flat arrays.
 * Zoning is run-length encoded, because a map is overwhelmingly one value
 * repeated -- unzoned -- and a raw array of four hundred thousand zeroes is
 * not a save file, it is an accident.
 */

import { emptyWorld } from './world';
import type { World, Lot } from './world';
import { ROAD_ORDER } from './roadgraph';
import type { RoadClass } from './roadgraph';

/**
 * Bumped whenever the shape below changes in a way an old file cannot meet.
 *
 * 2: the zoning byte carries a regional theme as well as a zone and a density,
 * so every code in a version 1 file means something different now. The bytes
 * would have loaded and produced a map zoned at random.
 *
 * 3: land is bought a plot at a time, and a file with no record of which plots
 * were bought would load as a city standing on land nobody owns.
 */
const VERSION = 3;

interface SaveFile {
  v: number;
  /** Set on the rolling slot the game writes itself. */
  auto?: 1;
  /** Cells across. A save from a different map size cannot be loaded onto it. */
  grid: number;
  name: string;
  /** Unix millis, for sorting the load list. */
  at: number;
  /** Node positions, x and z interleaved. */
  nodes: number[];
  /** Per link: node a, node b, control x, control z, class index. */
  links: number[];
  /** Zoning, run-length encoded as [code, run, code, run, ...]. */
  zones: number[];
  /** Which plots of land are owned, as two thirty-two bit halves. */
  land: [number, number];
  /**
   * Per lot: id, cell x, cell z, width, depth, yaw -- then, for a big one, the
   * superblock it reserves as its grounds.
   *
   * The grounds are not decoration. A rebuild claims them so nothing grows in
   * a landmark's forecourt, and dropping them from the save let 226 buildings
   * grow inside the museum's lawn on reload. A save has to carry everything a
   * rebuild reads, and "everything a rebuild reads" is not the same list as
   * "everything that looks like the building".
   */
  lots: Array<[string, number, number, number, number, number,
    (readonly [number, number, number, number])?]>;
}

/** What a save looks like from outside, for the menu's list. */
export interface SaveInfo {
  key: string;
  name: string;
  at: number;
  /** Roads and placed buildings, so a slot says something about itself. */
  roads: number;
  lots: number;
  /** True for the rolling slot, which a player did not choose to make. */
  auto: boolean;
}

const PREFIX = 'citysim.save.';

/**
 * The slot the game writes on its own.
 *
 * A city builder's one unrecoverable mistake is closing the tab, and a save
 * system that only saves when asked hands that mistake to the player to make.
 *
 * It has a key of its own rather than being a slot named "Autosave", because
 * the two jobs are different: a deliberate save is a point a player chose to be
 * able to come back to, and a rolling save that overwrote one would destroy the
 * thing it is there to protect. It still lists and loads like any other slot,
 * carrying the city's own name, marked as the rolling one.
 */
const AUTO_KEY = 'citysim.auto';

/** Trims a name to something that can be a key and still read as a name. */
function cleanName(name: string): string {
  return name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 48);
}

function encodeZones(zones: Uint8Array): number[] {
  const out: number[] = [];
  let run = 0, code = zones[0] ?? 0;
  for (let i = 0; i < zones.length; i++) {
    if (zones[i] === code) { run++; continue; }
    out.push(code, run);
    code = zones[i];
    run = 1;
  }
  out.push(code, run);
  return out;
}

function decodeZones(rle: readonly number[], into: Uint8Array): void {
  let at = 0;
  for (let i = 0; i + 1 < rle.length; i += 2) {
    const code = rle[i], run = rle[i + 1];
    const end = Math.min(into.length, at + run);
    if (code !== 0) into.fill(code, at, end);
    at = end;
  }
}

/** A world, as a string. `auto` marks the rolling slot. */
export function serialise(world: World, name: string, auto = false): string {
  const nodes: number[] = [];
  for (const n of world.net.nodes) nodes.push(n.x, n.z);
  const links: number[] = [];
  for (const l of world.net.links) {
    links.push(l.a, l.b, l.cx, l.cz, Math.max(0, ROAD_ORDER.indexOf(l.cls)));
  }
  const file: SaveFile = {
    v: VERSION,
    ...(auto ? { auto: 1 as const } : {}),
    grid: world.grid,
    name,
    at: Date.now(),
    nodes,
    links,
    zones: encodeZones(world.zones),
    land: [world.land.lo, world.land.hi],
    lots: world.lots.map((l) => (l.grounds === undefined
      ? [l.id, l.gx, l.gz, l.w, l.d, l.yaw] as SaveFile['lots'][number]
      : [l.id, l.gx, l.gz, l.w, l.d, l.yaw,
        [l.grounds[0], l.grounds[1], l.grounds[2], l.grounds[3]] as const])),
  };
  return JSON.stringify(file);
}

/**
 * A string, back into a world.
 *
 * The links are put back through the graph's own node table rather than
 * through `add`, because `add` finds crossings and splits links -- which is
 * right when a player draws a road across another and catastrophic when
 * reloading a graph where all of that has already happened. Loading is not
 * drawing; it is restoring what drawing produced.
 */
export function deserialise(text: string): { world: World; name: string; at: number } | null {
  let file: SaveFile;
  try {
    file = JSON.parse(text) as SaveFile;
  } catch {
    return null;
  }
  if (file === null || typeof file !== 'object' || file.v !== VERSION) return null;
  if (!Array.isArray(file.nodes) || !Array.isArray(file.links)) return null;

  const world = emptyWorld(file.grid);
  for (let i = 0; i + 1 < file.nodes.length; i += 2) {
    world.net.restoreNode(file.nodes[i], file.nodes[i + 1]);
  }
  const count = file.nodes.length / 2;
  for (let i = 0; i + 4 < file.links.length; i += 5) {
    const a = file.links[i], b = file.links[i + 1];
    if (a < 0 || b < 0 || a >= count || b >= count) continue;
    const cls: RoadClass = ROAD_ORDER[file.links[i + 4]] ?? ROAD_ORDER[0];
    world.net.restoreLink(a, b, file.links[i + 2], file.links[i + 3], cls);
  }
  world.net.rasterise();
  decodeZones(file.zones ?? [], world.zones);
  if (Array.isArray(file.land) && file.land.length === 2) {
    world.land.lo = file.land[0] >>> 0;
    world.land.hi = file.land[1] >>> 0;
  }
  for (const l of file.lots ?? []) {
    const lot: Lot = { id: l[0], gx: l[1], gz: l[2], w: l[3], d: l[4], yaw: l[5] };
    const g = l[6];
    if (g !== undefined) lot.grounds = [g[0], g[1], g[2], g[3]];
    world.lots.push(lot);
  }
  return { world, name: file.name ?? 'City', at: file.at ?? 0 };
}

// ---- where saves live -------------------------------------------------
//
// localStorage, which is per-browser and survives a reload but not a cleared
// site. That is the honest limit of a game with no server behind it, and it is
// worth saying out loud in the menu rather than letting someone find out.

function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function listSaves(): SaveInfo[] {
  const s = store();
  if (s === null) return [];
  const keys: string[] = [AUTO_KEY];
  for (let i = 0; i < s.length; i++) {
    const key = s.key(i);
    if (key !== null && key.startsWith(PREFIX)) keys.push(key);
  }
  const out: SaveInfo[] = [];
  for (const key of keys) {
    const text = s.getItem(key);
    if (text === null) continue;
    try {
      const f = JSON.parse(text) as SaveFile;
      out.push({
        key, name: f.name ?? key.slice(PREFIX.length), at: f.at ?? 0,
        roads: Math.floor((f.links?.length ?? 0) / 5), lots: f.lots?.length ?? 0,
        auto: f.auto === 1,
      });
    } catch {
      // A slot that will not parse is a slot that is gone. Skipping it beats
      // taking the menu down with it.
    }
  }
  return out.sort((a, b) => b.at - a.at);
}

/**
 * Writes the rolling slot. Silent about failure, deliberately.
 *
 * This runs on a timer and on the page going away, where there is nobody to
 * tell and nothing a player could do about it anyway. A full disk must not put
 * a toast over the city every ninety seconds.
 */
export function writeAutosave(world: World, name: string): void {
  const s = store();
  if (s === null) return;
  try {
    s.setItem(AUTO_KEY, serialise(world, cleanName(name) || 'City', true));
  } catch {
    // Quota, or a browser refusing to store. Either way: nothing useful to do.
  }
}

/** Writes a slot. Returns why not, or null if it went in. */
export function writeSave(world: World, name: string): string | null {
  const s = store();
  if (s === null) return 'this browser will not let the page store anything';
  const clean = cleanName(name);
  if (clean === '') return 'a city needs a name';
  try {
    s.setItem(PREFIX + clean, serialise(world, clean));
    return null;
  } catch {
    // Quota. Almost always a map with a very large road network on a browser
    // with a small allowance, and there is nothing useful to do but say so.
    return 'no room left in this browser’s storage';
  }
}

export function readSave(key: string): { world: World; name: string; at: number } | null {
  const s = store();
  if (s === null) return null;
  const text = s.getItem(key);
  return text === null ? null : deserialise(text);
}

export function deleteSave(key: string): void {
  store()?.removeItem(key);
}

/**
 * A city as a code that can be handed to someone else.
 *
 * There is no server, so "join" cannot mean what it means in a game with one.
 * What it can honestly mean is this: a city travels as text, and pasting
 * someone's code puts you on their map with their roads and their zoning.
 * Compressed where the browser offers it -- a save is JSON full of repeated
 * digits and gzip takes about ninety per cent off.
 */
export async function toCode(world: World, name: string): Promise<string> {
  const text = serialise(world, name);
  const bytes = new TextEncoder().encode(text);
  let packed: Uint8Array = bytes;
  const CS = (globalThis as { CompressionStream?: unknown }).CompressionStream;
  if (typeof CS === 'function') {
    const stream = new Blob([bytes as BufferSource]).stream()
      .pipeThrough(new (CS as new (f: string) => TransformStream)('gzip'));
    packed = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  let bin = '';
  for (const b of packed) bin += String.fromCharCode(b);
  return (packed === bytes ? 'C0' : 'C1') + btoa(bin);
}

export async function fromCode(code: string):
Promise<{ world: World; name: string; at: number } | null> {
  const trimmed = code.trim();
  if (trimmed.length < 3) return null;
  const tag = trimmed.slice(0, 2);
  if (tag !== 'C0' && tag !== 'C1') return null;
  let bytes: Uint8Array;
  try {
    const bin = atob(trimmed.slice(2));
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch {
    return null;
  }
  if (tag === 'C1') {
    const DS = (globalThis as { DecompressionStream?: unknown }).DecompressionStream;
    if (typeof DS !== 'function') return null;
    try {
      const stream = new Blob([bytes as BufferSource]).stream()
        .pipeThrough(new (DS as new (f: string) => TransformStream)('gzip'));
      bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    } catch {
      return null;
    }
  }
  return deserialise(new TextDecoder().decode(bytes));
}
