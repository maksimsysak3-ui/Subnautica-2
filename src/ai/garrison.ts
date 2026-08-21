/**
 * Garrison placement.
 *
 * OWNED BY: AI / Level design.
 *
 * Where the opposition stands is a level-design decision, not an AI one, so it
 * lives apart from the behaviour code. The rules it follows:
 *
 *  - **Nobody spawns looking at the entrance.** An enemy facing the door the
 *    player comes through turns a stealth approach into a coin flip.
 *  - **Patrols cross each other.** Two routes that overlap mean clearing one
 *    guard does not make a corridor safe, which is what forces a player to
 *    keep checking angles.
 *  - **Skill varies by post.** The gate has bored conscripts; the inner
 *    compound has people who will actually shoot back. That gradient is the
 *    difficulty curve, and it is placed rather than scaled.
 */

import * as THREE from 'three';
import type { ActorRegistry } from '../actors/actor-registry';
import type { EnemyAi } from './enemy-ai';
import { Rng } from '../core/math';

interface Post {
  /** Standing position. */
  at: [number, number];
  /** Where they look when idle, as a world point. */
  watch: [number, number];
  /** Extra waypoints. One entry means a static sentry. */
  route?: Array<[number, number]>;
  skill: number;
  archetype: string;
}

/**
 * The villa garrison — a cartel principal's residence and his security.
 *
 * Coordinates are the villa site's own: the compound runs roughly
 * x -70..70, z -60..70, the gate is at (0, +66) and the main house sits
 * around (-14, 10).
 */
const VILLA_POSTS: Post[] = [
  // --- outer approach: bored, badly placed, easy to take quietly ----------
  { at: [-3, 74], watch: [-3, 90], skill: 0.30, archetype: 'sentry',
    route: [[-3, 74], [9, 72], [-3, 74], [-13, 71]] },
  { at: [22, 60], watch: [40, 62], skill: 0.28, archetype: 'sentry' },

  // --- motor court: two overlapping patrols -------------------------------
  { at: [-4, 44], watch: [-4, 62], skill: 0.42, archetype: 'guard',
    route: [[-4, 44], [-22, 34], [-4, 20], [12, 34]] },
  { at: [10, 30], watch: [-10, 30], skill: 0.45, archetype: 'guard',
    route: [[10, 30], [10, 6], [-18, 6], [10, 30]] },

  // --- service side: the quiet flank, deliberately covered ---------------
  { at: [34, -30], watch: [60, -30], skill: 0.40, archetype: 'guard',
    route: [[34, -30], [52, -30], [34, -30], [18, -36]] },
  { at: [-24, -48], watch: [-24, -30], skill: 0.38, archetype: 'guard' },

  // --- inner compound: the ones who will actually fight -------------------
  { at: [-26, 14], watch: [-6, 14], skill: 0.66, archetype: 'operator' },
  { at: [-8, -4], watch: [-8, 20], skill: 0.70, archetype: 'operator',
    route: [[-8, -4], [-30, -4], [-30, 18], [-8, 18]] },
  { at: [4, -18], watch: [4, -40], skill: 0.62, archetype: 'operator' },

  // --- the principal's detail --------------------------------------------
  { at: [-16, 4], watch: [-16, 22], skill: 0.82, archetype: 'bodyguard' },
  { at: [-12, 2], watch: [2, 2], skill: 0.80, archetype: 'bodyguard' },
];

/**
 * Spawn a garrison and hand every actor to the AI.
 *
 * `floorAt` resolves the standing height, because a post authored in plan view
 * has no idea what is under it — a terrace, a roof, or graded ground.
 */
export function garrisonVilla(
  actors: ActorRegistry,
  ai: EnemyAi,
  floorAt: (x: number, z: number) => number,
  seed = 0x9a17,
): number {
  const rng = new Rng(seed);
  let count = 0;

  for (const post of VILLA_POSTS) {
    const [x, z] = post.at;
    const y = floorAt(x, z);
    const facing = Math.atan2(post.watch[0] - x, post.watch[1] - z);

    const actor = actors.spawn({
      faction: 'cartel',
      archetype: post.archetype,
      position: new THREE.Vector3(x, y, z),
      facing,
      // Skill jitter, so two guards on the same post are not the same guard.
      skill: Math.min(0.95, post.skill + rng.range(-0.06, 0.06)),
      health: post.archetype === 'bodyguard' ? 115 : 100,
    });

    const route = (post.route ?? []).map(
      ([rx, rz]) => new THREE.Vector3(rx, floorAt(rx, rz), rz),
    );
    ai.attach(actor, route);
    count++;
  }
  return count;
}
