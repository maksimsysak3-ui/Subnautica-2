/**
 * Ready-made junctions: drop one, connect roads to its loose ends.
 *
 * Every one of these can be drawn by hand with the road tools -- a motorway,
 * a viaduct over it, four slip roads -- and a player who wants their own
 * layout still can. These are for the player who wants a working exit now.
 * Each is plain data (pieces in local metres, the main road along +z) and is
 * laid by the same function the preview uses, so the ghost is what gets built.
 *
 * ORDER MATTERS. A road ended on another road joins it, whatever the heights,
 * so an overpass is laid before the road it passes over: the deck's middle
 * junction then already exists, and the road underneath crosses the deck
 * with clearance rather than landing on it.
 */

import type { RoadClass } from './roadgraph';
import { RoadGraph, ELEVATIONS } from './roadgraph';

/** One road of a template: from, to, class, height of free ends, and bow. */
export interface Piece {
  a: [number, number];
  b: [number, number];
  cls: RoadClass;
  /** Metres up for an end that lands on nothing; ends on roads take theirs. */
  elev?: number;
  /** Bow off the chord in metres, positive to the left. */
  bend?: number;
}

export interface Interchange {
  id: string;
  name: string;
  /** One line in the drawer. */
  blurb: string;
  pieces: Piece[];
  /** Junctions to give a control, in local metres, and which. */
  controls?: Array<{ at: [number, number]; ctl: number }>;
  /** The level the city must have reached. */
  level: number;
}

/** Junction controls, as `Control` in the agents. Repeated to keep this module free of them. */
const SIGNALS = 2, ROUNDABOUT = 3;

const R = 34;                          // roundabout radius
const ARC = -2 * R * (1 - Math.SQRT1_2); // control offset for a quarter circle
const DECK = ELEVATIONS[1];

export const INTERCHANGES: readonly Interchange[] = [
  {
    id: 'roundabout', name: 'Roundabout', level: 1,
    blurb: 'Four avenues meeting on a ring. Nobody waits for lights.',
    pieces: [
      { a: [0, -R], b: [R, 0], cls: 'avenue', bend: ARC },
      { a: [R, 0], b: [0, R], cls: 'avenue', bend: ARC },
      { a: [0, R], b: [-R, 0], cls: 'avenue', bend: ARC },
      { a: [-R, 0], b: [0, -R], cls: 'avenue', bend: ARC },
      { a: [0, -R], b: [0, -R - 56], cls: 'avenue' },
      { a: [R, 0], b: [R + 56, 0], cls: 'avenue' },
      { a: [0, R], b: [0, R + 56], cls: 'avenue' },
      { a: [-R, 0], b: [-R - 56, 0], cls: 'avenue' },
    ],
    controls: [
      { at: [0, -R], ctl: ROUNDABOUT }, { at: [R, 0], ctl: ROUNDABOUT },
      { at: [0, R], ctl: ROUNDABOUT }, { at: [-R, 0], ctl: ROUNDABOUT },
    ],
  },
  {
    id: 'crossroads', name: 'Signalled crossroads', level: 1,
    blurb: 'Two avenues crossing on traffic lights, ready to extend.',
    pieces: [
      { a: [0, -90], b: [0, 90], cls: 'avenue' },
      { a: [-90, 0], b: [90, 0], cls: 'avenue' },
    ],
    controls: [{ at: [0, 0], ctl: SIGNALS }],
  },
  {
    id: 'diamond', name: 'Diamond interchange', level: 3,
    blurb: 'A motorway under an avenue bridge, with an exit and an entry each way.',
    pieces: [
      // The avenue and its bridge first: ground, ramp up, deck, ramp down, ground.
      { a: [-170, 0], b: [-60, 0], cls: 'avenue' },
      { a: [60, 0], b: [170, 0], cls: 'avenue' },
      { a: [-60, 0], b: [0, 0], cls: 'avenue', elev: DECK },
      { a: [0, 0], b: [60, 0], cls: 'avenue', elev: DECK },
      // Then the motorway underneath.
      { a: [0, -220], b: [0, 220], cls: 'motorway' },
      // Off before the bridge and on after it, each side of the carriageway.
      { a: [0, -150], b: [-60, 0], cls: 'slip', bend: 22 },
      { a: [-60, 0], b: [0, 150], cls: 'slip', bend: 22 },
      { a: [0, 150], b: [60, 0], cls: 'slip', bend: 22 },
      { a: [60, 0], b: [0, -150], cls: 'slip', bend: 22 },
    ],
    controls: [{ at: [-60, 0], ctl: SIGNALS }, { at: [60, 0], ctl: SIGNALS }],
  },
  {
    id: 'exit', name: 'Motorway exit', level: 3,
    blurb: 'A stretch of motorway with a slip road off and one back on, to a side road.',
    pieces: [
      { a: [0, -220], b: [0, 220], cls: 'motorway' },
      { a: [0, -130], b: [-90, -20], cls: 'slip', bend: 18 },
      { a: [-90, 20], b: [0, 130], cls: 'slip', bend: 18 },
      { a: [-90, -20], b: [-90, 20], cls: 'street' },
      { a: [-90, -20], b: [-200, -20], cls: 'street' },
      { a: [-90, 20], b: [-200, 20], cls: 'street' },
    ],
  },
];

export function interchangeById(id: string): Interchange | undefined {
  return INTERCHANGES.find((t) => t.id === id);
}

/** A local point turned by `yaw` quarter turns and moved to (`x`, `z`). */
export function place(p: readonly [number, number], x: number, z: number, yaw: number): [number, number] {
  let [u, v] = p;
  for (let i = 0; i < (yaw & 3); i++) [u, v] = [-v, u];
  return [x + u, z + v];
}

/**
 * Lays a template onto a network. Returns the nodes the controls belong to,
 * paired with the control, for the caller to set on the live junctions.
 */
export function layInterchange(net: RoadGraph, t: Interchange, x: number, z: number,
  yaw: number): Array<{ node: number; ctl: number }> {
  // A quarter turn mirrors which side "left" is on for nothing -- a turn is a
  // rotation, and a bow to the left stays a bow to the left.
  for (const p of t.pieces) {
    const [ax, az] = place(p.a, x, z, yaw);
    const [bx, bz] = place(p.b, x, z, yaw);
    net.add(ax, az, bx, bz, p.cls, p.bend ?? 0, null, p.elev ?? 0, (p.bend ?? 0) === 0);
  }
  const out: Array<{ node: number; ctl: number }> = [];
  for (const c of t.controls ?? []) {
    const [cx, cz] = place(c.at, x, z, yaw);
    let best = -1, bestD = 6;
    for (let i = 0; i < net.nodes.length; i++) {
      const n = net.nodes[i];
      if (n.dead === true) continue;
      const d = Math.hypot(n.x - cx, n.z - cz);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0) out.push({ node: best, ctl: c.ctl });
  }
  return out;
}

/** Every point a template touches, for the land and water checks. */
export function footprint(t: Interchange, x: number, z: number, yaw: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const p of t.pieces) {
    const a = place(p.a, x, z, yaw), b = place(p.b, x, z, yaw);
    out.push(a, b, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  }
  return out;
}

/** Metres of each class a template lays, for the price. */
export function lengths(t: Interchange): Map<RoadClass, number> {
  const out = new Map<RoadClass, number>();
  for (const p of t.pieces) {
    const len = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]) + Math.abs(p.bend ?? 0) * 0.8;
    out.set(p.cls, (out.get(p.cls) ?? 0) + len);
  }
  return out;
}
