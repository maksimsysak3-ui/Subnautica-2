/**
 * Asset invariants. No GPU needed.
 *
 * The one that matters is footprint. An asset whose geometry runs past its
 * declared lot looks perfectly fine in a viewer and then overlaps the street
 * and its neighbours once the spawner places it, which is a bug you find
 * months later in a screenshot and cannot easily trace back. Cheaper to assert.
 *
 *   node tools/asset-test.mjs
 */

import * as esbuild from 'esbuild';

/** pos(3) + normal(3) + material(1) + occlusion(1) + tint(1) + local uv(2). */
const STRIDE = 13;

const CELL = 8;
/** Eaves, canopies and cornices may lean out this far past the lot. */
const OVERHANG = 0.8;
/** LOD0 ceiling. Above this an asset is too heavy to repeat across a city. */
const MAX_TRIS = 10000;
/**
 * Services get a wider band at both ends. There is only ever one or two of
 * each on a map so a landmark can afford more, and each has to be
 * recognisable on its own rather than as a member of a category -- which
 * needs a floor a zoned building does not.
 */
const SERVICE_MIN = 2400;
const SERVICE_MAX = 12000;
/**
 * Landmarks: a service asset covering seventy cells or more.
 *
 * There is one of these on a map, it is the better part of a hundred metres
 * across, and it is the middle of whatever district the player puts it in.
 * Holding it to the same budget as a fire station buys either a hundred metres
 * of blank wall or no landmark at all, so it gets its own ceiling -- still a
 * ceiling, because it is drawn every frame like everything else.
 *
 * Measured on area rather than on both sides, so a hospital that is long and
 * not square counts.
 */
const LANDMARK_AREA = 70;
const LANDMARK_MAX = 20000;
/**
 * Venues: a service asset covering three hundred cells or more.
 *
 * A tier above the landmark, and there are five of them in the library. A
 * gridiron stadium is a hundred and sixty metres of bowl with two tiers, a
 * roof on props, four masts and three car parks -- held to the landmark
 * ceiling it loses the roof or the car parks, and either one makes it read as
 * a model of a stadium rather than a stadium. Still a ceiling: it is drawn
 * every frame like everything else, and its own LOD1 is under four thousand.
 */
const MEGA_AREA = 300;
const MEGA_MAX = 36000;
/**
 * Vehicles and figures.
 *
 * There is no floor any more. The band existed to stop a generated car being
 * cheap enough to read as a box, and the fleet is imported now: a model is
 * whatever the artist built, and several of the small ones are three or four
 * hundred triangles and look completely right at that. The ceiling still
 * matters -- there will be hundreds on screen at once.
 */
const FLEET_MIN = 0;
const FLEET_MAX = 16000;
/**
 * The ceiling for a fleet asset that covers more than one cell.
 *
 * A car is four and a half metres and a widebody airliner is sixty, and there
 * is exactly one of the latter on an airfield against hundreds of the former
 * on the roads. Held to the car's ceiling an aeroplane loses its engines, and
 * it is still far cheaper per metre than anything else in the library.
 *
 * The civil service pack pushed this up again. Its fire engine is twenty-three
 * thousand triangles as the artist built it -- ladder, hose reels, roller
 * shutters and all -- and the brief for these imports is the model as shipped,
 * not a version of it this tool decided to thin out. There is one fire station
 * on a map. The clustered LOD copy, which is what a parked appliance and
 * anything at distance actually draws, is a tenth of that.
 */
const BIG_FLEET_MAX = 26000;

/**
 * Materials a service building may not use.
 *
 * BRICK, TILE, HOUSE_WALL and ROOF_TILE are the housing vocabulary. A fire
 * station in brick under a tiled pitch reads as a large house with garage
 * doors in it, which is the opposite of what a civic building is for: the
 * player is scanning for it specifically and it has to announce itself.
 * Enforced here rather than left to discipline, because it drifted back twice.
 */
const DOMESTIC = new Map([[4, 'BRICK'], [7, 'TILE'], [9, 'HOUSE_WALL'], [14, 'ROOF_TILE']]);
/**
 * LOD0 floor. Below this an asset has not been detailed -- no frames, no
 * furniture, nothing at street level -- and it shows next to its neighbours.
 */
const MIN_TRIS = 1000;
/**
 * Roads get a lower one.
 *
 * A road piece is a carriageway, its markings, its kerbs and whatever
 * furniture stands on it, and that is genuinely less geometry than a building.
 * These used to clear the building floor only because each one shipped with
 * two or three cars modelled into it -- which is wrong: traffic is something
 * the simulation puts on a road, not part of the road.
 */
const ROAD_MIN = 300;

const bundle = (
  await esbuild.build({
    entryPoints: [new URL('../src/assets/registry.ts', import.meta.url).pathname],
    bundle: true, format: 'esm', write: false, target: 'es2022',
  })
).outputFiles[0].text;

const { ASSETS } = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));

const fails = [];
const note = (id, msg) => fails.push(`${id}: ${msg}`);

console.log('asset'.padEnd(22) + 'LOD0 / 1 / 2'.padEnd(22) + 'extent (m)'.padEnd(18) + 'height');

for (const a of ASSETS) {
  const meshes = [0, 1, 2].map((l) => a.build(l).build());
  const tris = meshes.map((m) => m.indices.length / 3);

  const limitX = (a.footprint[0] * CELL) / 2 + OVERHANG;
  const limitZ = (a.footprint[1] * CELL) / 2 + OVERHANG;
  let maxX = 0, maxZ = 0, maxY = 0, minY = 0;

  for (const [lod, mesh] of meshes.entries()) {
    if (tris[lod] === 0) { note(a.id, `LOD ${lod} is empty`); continue; }
    for (let i = 0; i < mesh.vertices.length; i += STRIDE) {
      const x = mesh.vertices[i], y = mesh.vertices[i + 1], z = mesh.vertices[i + 2];
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        note(a.id, `LOD ${lod} has a non-finite vertex`);
        break;
      }
      maxX = Math.max(maxX, Math.abs(x));
      maxZ = Math.max(maxZ, Math.abs(z));
      maxY = Math.max(maxY, y);
      minY = Math.min(minY, y);
    }
  }

  console.log(
    a.id.padEnd(22) +
    tris.map((t) => String(t).padStart(5)).join(' / ').padEnd(22) +
    `${(maxX * 2).toFixed(1)} x ${(maxZ * 2).toFixed(1)}`.padEnd(18) +
    `${maxY.toFixed(1)}m`,
  );

  if (maxX > limitX) note(a.id, `overflows its lot on X: ${maxX.toFixed(1)}m past centre, lot allows ${limitX.toFixed(1)}m`);
  if (maxZ > limitZ) note(a.id, `overflows its lot on Z: ${maxZ.toFixed(1)}m past centre, lot allows ${limitZ.toFixed(1)}m`);
  if (minY < -0.01) note(a.id, `has geometry below ground (${minY.toFixed(2)}m)`);
  const service = a.zone === 'service';
  if (service) {
    const used = new Set();
    const v = meshes[0].vertices;
    for (let i = 6; i < v.length; i += STRIDE) used.add(v[i]);
    for (const [id, name] of DOMESTIC) {
      if (used.has(id)) note(a.id, `uses the domestic material ${name}; services must not read as housing`);
    }
  }
  const fleet = a.zone === 'fleet';
  const big = fleet && a.footprint[0] >= 2;
  const area = a.footprint[0] * a.footprint[1];
  const landmark = service && area >= LANDMARK_AREA;
  const ceiling = fleet ? (big ? BIG_FLEET_MAX : FLEET_MAX)
    : service ? (area >= MEGA_AREA ? MEGA_MAX : landmark ? LANDMARK_MAX : SERVICE_MAX)
      : MAX_TRIS;
  const road = a.zone === 'road';
  const floor = fleet ? FLEET_MIN : service ? SERVICE_MIN : road ? ROAD_MIN : MIN_TRIS;
  if (tris[0] > ceiling) note(a.id, `LOD0 is ${tris[0]} triangles, over the ${ceiling} ceiling`);
  if (tris[0] < floor) note(a.id, `LOD0 is only ${tris[0]} triangles, under the ${floor} floor`);
  if (tris[1] > tris[0] || tris[2] > tris[1]) note(a.id, `LOD ladder is not decreasing: ${tris.join(' / ')}`);
  if (Math.abs(maxY - a.height) > 0.2) {
    note(a.id, `height ${a.height}m does not match the mesh at ${maxY.toFixed(1)}m`);
  }
  // The smallest lot this geometry would actually fit in, so the failure
  // message says what to change rather than only that something is wrong.
  const needX = Math.ceil(((maxX - OVERHANG) * 2) / CELL);
  const needZ = Math.ceil(((maxZ - OVERHANG) * 2) / CELL);
  if (needX > a.footprint[0] || needZ > a.footprint[1]) {
    note(a.id, `declared ${a.footprint[0]}x${a.footprint[1]} cells but needs ${needX}x${needZ}`);
  }
}

if (fails.length) {
  console.error('\nFAIL\n' + fails.map((f) => '  - ' + f).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`\nPASS  ${ASSETS.length} assets inside their lots, within budget, LODs decreasing`);
}
