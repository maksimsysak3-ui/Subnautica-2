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

import type { MapId } from '../world/types';
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

  // =======================================================================
  // SAN VERDUGO — the town is the first ring of his security
  // =======================================================================
  // The checkpoint where the road comes in: the only place in town anyone is
  // actually expecting trouble, and they are still facing the wrong way half
  // the time.
  { at: [6.8, 243], watch: [6.8, 275], skill: 0.36, archetype: 'sentry' },
  { at: [-7.5, 249], watch: [-2, 280], skill: 0.34, archetype: 'sentry',
    route: [[-7.5, 249], [-7.5, 236], [-7.5, 249], [3, 252]] },
  // Halcones — lookouts on the corners of the Calle Real. Bored, badly
  // armed, and every one of them can radio the compound.
  { at: [5.6, 214], watch: [0, 240], skill: 0.30, archetype: 'sentry' },
  { at: [-5.6, 178], watch: [0, 210], skill: 0.32, archetype: 'sentry' },
  { at: [5.6, 122], watch: [0, 160], skill: 0.33, archetype: 'sentry' },
  // Sicarios walking the high street — the patrols that cross it.
  { at: [-2, 200], watch: [-2, 150], skill: 0.48, archetype: 'guard',
    route: [[-2, 200], [-2, 128], [30, 120], [-2, 128]] },
  { at: [2, 140], watch: [2, 190], skill: 0.50, archetype: 'guard',
    route: [[2, 140], [2, 214], [-40, 216], [2, 214]] },
  // The plaza: two by the fountain, one on the cantina's door, and a
  // lookout up in the parroquia's bell tower who sees the whole square.
  { at: [-24, 144], watch: [-8, 150], skill: 0.46, archetype: 'guard',
    route: [[-24, 144], [-36, 158], [-24, 164], [-14, 150]] },
  { at: [-36, 142], watch: [-46, 150], skill: 0.44, archetype: 'guard' },
  { at: [-46, 141.2], watch: [-46, 160], skill: 0.52, archetype: 'guard' },
  { at: [-56.5, 155.5], y: 13.62, watch: [-10, 150], skill: 0.58, archetype: 'operator' },
  // The edge street, facing the compound gate: nobody gets to the wall
  // without walking past these two.
  { at: [-12, 81], watch: [0, 72], skill: 0.52, archetype: 'guard',
    route: [[-12, 81], [-40, 81], [-12, 81], [20, 81]] },
  { at: [26, 81], watch: [0, 100], skill: 0.50, archetype: 'guard' },
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
  // Beside the booth, not inside it. This post used to sit at (-19, -70),
  // which is within the gate booth's footprint — the guard spawned inside a
  // building.
  { at: [-16.5, -71], watch: [-16.5, -89], skill: 0.32, archetype: 'sentry' },
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
  // On the catwalk deck, not 0.6 m past its edge. The north leg ends at
  // z = 42, and this post was at z = 40 standing on nothing 7.4 m up.
  { at: [-40, 41.2], watch: [-40, 4], skill: 0.72, archetype: 'operator', y: 9.4 },

  // --- office block -------------------------------------------------------
  { at: [-60, -28], watch: [-60, -50], skill: 0.58, archetype: 'operator' },
  { at: [-46, -33], watch: [-70, -33], skill: 0.62, archetype: 'operator', y: 5.5 },

  // --- cold store and apron -----------------------------------------------
  { at: [-6, -32], watch: [-6, -52], skill: 0.60, archetype: 'operator' },
  { at: [0, 58], watch: [0, 74], skill: 0.50, archetype: 'guard',
    route: [[0, 58], [-30, 58], [0, 58], [26, 56]] },

  // =======================================================================
  // PUERTO MERIDIAN — the district outside the wire
  // =======================================================================
  // The syndicate's shooter on the dormitory roof, over the port road.
  { at: [-46, -172], y: 14.82, watch: [0, -150], skill: 0.66, archetype: 'operator' },
  // Two in the cantina's doorway — paid, drinking, and armed.
  { at: [-52, -104.8], watch: [-52, -96], skill: 0.42, archetype: 'guard' },
  { at: [-47, -104.8], watch: [-30, -100], skill: 0.40, archetype: 'guard' },
  // Street patrols that cross the port road.
  { at: [30, -100], watch: [60, -100], skill: 0.46, archetype: 'guard',
    route: [[30, -100], [90, -100], [64, -110], [64, -160], [30, -144], [2, -144]] },
  { at: [-80, -144], watch: [-50, -144], skill: 0.44, archetype: 'guard',
    route: [[-80, -144], [-44, -144], [-80, -144], [-80, -100], [-44, -100]] },
  // The fuel yard and the customs house.
  { at: [72, -134], watch: [40, -134], skill: 0.48, archetype: 'guard' },
  { at: [86, -148.5], watch: [86, -120], skill: 0.52, archetype: 'guard' },
  { at: [2.5, -170], watch: [2.5, -190], skill: 0.36, archetype: 'sentry' },

  // --- the principal ------------------------------------------------------
  { at: [-56, -40], watch: [-40, -40], skill: 0.84, archetype: 'bodyguard' },
];

/**
 * Barrio Santa Muerte. The hill is six terraces; the posts are on the
 * streets, on the cancha, on top of the cistern and in the church, and every
 * one of them is overlooked by the row above — which is the point.
 *
 * Terrace levels: 2.0, 5.2, 8.4, 11.6, 14.8, 18.0. Street centrelines:
 * z -45.7, -29.0, -12.3, 4.3, 21.0, 37.7.
 */
const BARRIO_POSTS: Post[] = [
  // --- the bottom street: the insertion edge ------------------------------
  { at: [-20, -45.7], y: 2.0, watch: [-50, -45.7], skill: 0.32, archetype: 'sentry' },
  { at: [24, -45.7], y: 2.0, watch: [50, -45.7], skill: 0.34, archetype: 'sentry' },
  { at: [3, -44], y: 2.0, watch: [20, -46], skill: 0.40, archetype: 'guard',
    route: [[3, -44], [-40, -45.7], [3, -44], [44, -45.7]] },
  // --- the cancha crew -------------------------------------------------------
  { at: [22, -24], y: 5.25, watch: [30, -24], skill: 0.46, archetype: 'guard' },
  { at: [32, -27], y: 5.25, watch: [20, -27], skill: 0.48, archetype: 'guard',
    route: [[32, -27], [16, -27], [32, -21]] },
  // --- terrace two: the market street ---------------------------------------
  { at: [-10, -12.3], y: 8.4, watch: [30, -12.3], skill: 0.50, archetype: 'guard',
    route: [[-10, -12.3], [-50, -12.3], [-10, -12.3], [46, -12.3]] },
  { at: [3.2, -10], y: 8.4, watch: [3.2, -40], skill: 0.52, archetype: 'guard' },
  // --- the cistern: the shooter everybody has to deal with ----------------
  { at: [-30, 7.3], y: 18.76, watch: [0, -30], skill: 0.70, archetype: 'operator' },
  // --- terrace four: the rich row ---------------------------------------------
  { at: [30, 21], y: 14.8, watch: [-10, 21], skill: 0.60, archetype: 'operator',
    route: [[30, 21], [-40, 21], [30, 21]] },
  { at: [-3.2, 18], y: 14.8, watch: [-3.2, -10], skill: 0.62, archetype: 'operator' },
  // --- the west half, the Cut and the middle terraces ---------------------------
  { at: [-57.5, 12], y: 11.6, watch: [-57.5, -30], skill: 0.52, archetype: 'guard' },
  { at: [35, 4.3], y: 11.6, watch: [-10, 4.3], skill: 0.48, archetype: 'guard',
    route: [[35, 4.3], [-20, 4.3], [35, 4.3]] },
  { at: [-40, -29], y: 5.2, watch: [0, -29], skill: 0.42, archetype: 'guard',
    route: [[-40, -29], [-10, -29], [-40, -29]] },
  { at: [-44, 4.3], y: 11.6, watch: [-44, -20], skill: 0.50, archetype: 'guard' },
  // --- the church: the principal's detail, and a lookout in the tower ----------
  { at: [11, 43], y: 18.1, watch: [11, 36], skill: 0.80, archetype: 'bodyguard' },
  { at: [15, 45], y: 18.1, watch: [15, 36], skill: 0.82, archetype: 'bodyguard' },
  { at: [13, 34.5], y: 18.0, watch: [13, 20], skill: 0.58, archetype: 'guard' },
  { at: [3.8, 37.1], y: 31.3, watch: [0, -20], skill: 0.64, archetype: 'operator' },
];

/**
 * Pista La Trinidad. Open ground: the posts are about who sees the strip,
 * and the camp under the trees is where the people who work here actually
 * are.
 */
const AIRSTRIP_POSTS: Post[] = [
  // Runway patrol, in a pickup's worth of boredom.
  { at: [80, 14], watch: [80, -40], skill: 0.36, archetype: 'sentry',
    route: [[80, 14], [140, 14], [80, 14], [20, 14]] },
  { at: [-80, -14], watch: [-150, 0], skill: 0.36, archetype: 'sentry',
    route: [[-80, -14], [-140, -14], [-80, -14], [-20, -14]] },
  // The apron and the aircraft: the loading crew and the pilot's minders.
  { at: [6, 26], watch: [0, 0], skill: 0.52, archetype: 'guard' },
  { at: [-8, 40], watch: [0, 20], skill: 0.54, archetype: 'guard',
    route: [[-8, 40], [-26, 37], [-8, 40], [16, 24]] },
  { at: [-4, 32.5], watch: [-4, 20], skill: 0.80, archetype: 'bodyguard' },
  { at: [-12, 20], watch: [-40, 0], skill: 0.78, archetype: 'bodyguard' },
  // Height: the hangar mezzanine, the tower cab, three watchtowers.
  { at: [0, 69], y: 6.2, watch: [0, 30], skill: 0.66, archetype: 'operator' },
  { at: [50, 30], y: 11.8, watch: [0, 0], skill: 0.68, archetype: 'operator' },
  { at: [-96, -30], y: 8.2, watch: [-150, -60], skill: 0.48, archetype: 'guard' },
  { at: [96, 30], y: 8.2, watch: [150, 60], skill: 0.48, archetype: 'guard' },
  { at: [-40, 72], y: 8.2, watch: [-110, 80], skill: 0.46, archetype: 'guard' },
  // The river landing, the fuel dump and the empty east half.
  { at: [-106, 79], watch: [-150, 80], skill: 0.44, archetype: 'sentry' },
  { at: [-68, 50], watch: [-68, 20], skill: 0.48, archetype: 'guard',
    route: [[-68, 50], [-86, 58], [-68, 50], [-50, 58]] },
  { at: [100, -20], watch: [140, -40], skill: 0.40, archetype: 'sentry',
    route: [[100, -20], [140, -20], [100, -20], [100, -60]] },
  // The camp.
  { at: [-25, -43.5], watch: [-25, -20], skill: 0.55, archetype: 'guard' },
  { at: [18, -35.8], watch: [18, -20], skill: 0.44, archetype: 'guard' },
  { at: [-40, -40], watch: [-60, -40], skill: 0.50, archetype: 'guard',
    route: [[-40, -40], [-40, -68], [30, -68], [30, -30]] },
  { at: [6, -62], watch: [40, -62], skill: 0.46, archetype: 'guard' },
];

/**
 * Spawn a garrison and hand every actor to the AI.
 *
 * `floorAt` resolves the standing height, because a post authored in plan view
 * has no idea what is under it — a terrace, a roof, or graded ground.
 */
export function garrison(
  mapId: MapId,
  actors: ActorRegistry,
  ai: EnemyAi,
  floorAt: (x: number, z: number) => number,
  seed = 0x9a17,
): number {
  const rng = new Rng(seed);
  const posts = mapId === 'quay' ? QUAY_POSTS
    : mapId === 'barrio' ? BARRIO_POSTS
      : mapId === 'airstrip' ? AIRSTRIP_POSTS
        : VILLA_POSTS;
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
