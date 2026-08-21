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
  /**
   * Explicit standing height, for posts on a mezzanine or catwalk.
   *
   * Without this the floor query resolves to the slab underneath and every
   * elevated guard spawns on the ground floor, which quietly removes the whole
   * vertical layer the map was built around.
   */
  y?: number;
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
 * Quay posts.
 *
 * Different map, different problem. The villa's garrison is about approach
 * denial; the quay's is about **layers**. Two of these are up on the mezzanine
 * and catwalk, so clearing the warehouse floor does not clear the warehouse,
 * and a player who never looks up gets shot from above.
 */
const QUAY_POSTS: Post[] = [
  // --- gate: sees the road, and nothing else -----------------------------
  { at: [-19, -70], watch: [-19, -88], skill: 0.32, archetype: 'sentry' },
  { at: [6, -66], watch: [6, -84], skill: 0.30, archetype: 'sentry',
    route: [[6, -66], [-8, -62], [6, -66], [20, -60]] },

  // --- container yard: patrols that cross ---------------------------------
  { at: [18, -8], watch: [40, -8], skill: 0.46, archetype: 'guard',
    route: [[18, -8], [44, -8], [44, 8], [18, 8]] },
  { at: [44, 6], watch: [18, 6], skill: 0.44, archetype: 'guard',
    route: [[44, 6], [44, -12], [70, -12], [70, 6]] },
  { at: [66, 12], watch: [66, 30], skill: 0.40, archetype: 'guard' },

  // --- warehouse: three layers -------------------------------------------
  { at: [-50, 10], watch: [-20, 10], skill: 0.55, archetype: 'guard',
    route: [[-50, 10], [-50, 34], [-24, 34], [-24, 10]] },
  // These two are ABOVE the floor. Their y comes from the post lookup, so the
  // caller has to resolve height at the catwalk, not on the slab.
  { at: [-72, 20], watch: [-40, 20], skill: 0.68, archetype: 'operator', y: 6.6 },
  { at: [-40, 40], watch: [-40, 4], skill: 0.72, archetype: 'operator', y: 9.4 },

  // --- office block -------------------------------------------------------
  { at: [-60, -28], watch: [-60, -50], skill: 0.58, archetype: 'operator' },
  { at: [-46, -33], watch: [-70, -33], skill: 0.62, archetype: 'operator', y: 5.5 },

  // --- cold store and apron -----------------------------------------------
  { at: [-6, -32], watch: [-6, -52], skill: 0.60, archetype: 'operator' },
  { at: [0, 58], watch: [0, 74], skill: 0.50, archetype: 'guard',
    route: [[0, 58], [-30, 58], [0, 58], [26, 56]] },

  // --- the principal ------------------------------------------------------
  { at: [-56, -40], watch: [-40, -40], skill: 0.84, archetype: 'bodyguard' },
];

/**
 * Spawn a garrison and hand every actor to the AI.
 *
 * `floorAt` resolves the standing height, because a post authored in plan view
 * has no idea what is under it — a terrace, a roof, or graded ground.
 */
export function garrison(
  mapId: 'villa' | 'quay',
  actors: ActorRegistry,
  ai: EnemyAi,
  floorAt: (x: number, z: number) => number,
  seed = 0x9a17,
): number {
  const rng = new Rng(seed);
  const posts = mapId === 'quay' ? QUAY_POSTS : VILLA_POSTS;
  let count = 0;

  for (const post of posts) {
    const [x, z] = post.at;
    // An authored height wins: a floor query at a catwalk's plan position
    // finds the warehouse slab five metres below it.
    const y = post.y ?? floorAt(x, z);
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
      ([rx, rz]) => new THREE.Vector3(rx, post.y ?? floorAt(rx, rz), rz),
    );
    ai.attach(actor, route);
    count++;
  }
  return count;
}
