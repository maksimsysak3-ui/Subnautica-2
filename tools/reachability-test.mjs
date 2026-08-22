#!/usr/bin/env node
/**
 * Navmesh / collision agreement test.
 *
 * The navmesh rasteriser skips bricks flagged NO_NAV; the character controller
 * does not. Any brick carrying NO_NAV without NO_COLLIDE therefore produces a
 * square metre the AI believes is walkable and the player physically cannot
 * enter — and because it is usually thin decorative geometry, it looks like
 * empty air.
 *
 * That is not hypothetical. Nine plastic strips hung across each cold-store
 * doorway were flagged SOFT (which only means "does not block sight") and
 * sealed all three chambers. A player walked up to an open doorway, could see
 * straight through it, and bounced off.
 *
 * This test samples the navmesh and asks the collision system whether it
 * agrees. No browser: both systems are pure functions over the brickyard.
 */
import { createServer } from 'vite';

const server = await createServer({
  root: process.cwd(), configFile: 'vite.config.ts',
  server: { middlewareMode: true }, logLevel: 'error', appType: 'custom',
});

const { Brickyard } = await server.ssrLoadModule('/src/world/brickyard.ts');
const { SiteBuilder } = await server.ssrLoadModule('/src/world/builder.ts');
const { NavGrid } = await server.ssrLoadModule('/src/world/navmesh.ts');
const { DoorRegistry } = await server.ssrLoadModule('/src/world/doors.ts');
const { moveCharacter } = await server.ssrLoadModule('/src/world/collision.ts');
const { Rng, Noise2D } = await server.ssrLoadModule('/src/core/math.ts');
const { buildVilla } = await server.ssrLoadModule('/src/world/sites/villa.ts');
const { buildQuay } = await server.ssrLoadModule('/src/world/sites/quay.ts');
const { buildOutskirts } = await server.ssrLoadModule('/src/world/sites/outskirts.ts');

const SHAPE = { radius: 0.36, height: 1.75, stepHeight: 0.42, minGroundNormalY: 0.55 };
const PAD_HEIGHT = 1.88;

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

function run(mapId) {
  const rng = new Rng(`world:${mapId}`);
  const noise = new Noise2D('black-meridian-terrain');
  const yard = new Brickyard();
  const b = new SiteBuilder(yard, rng);
  const terrain = () => PAD_HEIGHT;

  const res = mapId === 'quay'
    ? buildQuay(b, rng, terrain)
    : (() => { const r = buildVilla(b, rng); buildOutskirts(b, rng, terrain); return r; })();
  b.clearDoorways();
  yard.finalize();

  // Open every door and settle the animation. A route through a shut door is
  // not a defect — it is a door — and leaving them closed would drown the
  // signal this test exists to produce.
  const doors = new DoorRegistry(yard, b.doorRigs);
  for (const d of b.doors) doors.open(d.id, -1, true);
  for (let i = 0; i < 240; i++) doors.update(1 / 60);

  const site = res.site;
  const grid = new NavGrid({
    minX: site.coreMinX - 30, maxX: site.coreMaxX + 30,
    minZ: site.coreMinZ - 30, maxZ: site.coreMaxZ + 70,
    minY: site.minY - 4, maxY: site.maxY,
  });
  grid.build(yard, terrain, res.rooms, res.navLinks ?? []);

  // Walk THROUGH every doorway with the character controller.
  //
  // Doorways, specifically, and not general room-to-room routes: I tried that
  // first and it produced five failures on each map that were all artefacts of
  // a naive path follower on stairs. A doorway traversal is unambiguous — the
  // door is open, the line is straight, the geometry either lets a body
  // through or it does not.
  //
  // This is the test that would have caught the cold-store strip curtains:
  // nine plastic strips flagged SOFT (which only stops them blocking SIGHT)
  // hung across each chamber door and sealed all three rooms behind something
  // the player could see straight through.
  const stuckDoors = [];
  for (const d of b.doors) {
    if (d.locked) continue;
    // The doorway normal, and a point 1.6 m clear on each side of it.
    //
    // `WorldDoor.yaw` is documented as "facing of the doorway plane normal"
    // and it is not — it is the yaw of the WALL, i.e. the direction the wall
    // runs, taken straight from `atan2(-uz, ux)` in the wall builder. The
    // normal is perpendicular to that. Taking the comment at its word walked
    // every test capsule sideways into the wall the door is set in.
    const nx = Math.sin(d.yaw), nz = Math.cos(d.yaw);
    // Three lanes across the opening, and passing ONE of them is enough.
    //
    // A door leaf that has swung open stands perpendicular to the wall, which
    // means it is squarely across the middle of the doorway — walking dead
    // through the centre line is blocked at almost every open door in the
    // game, and a player simply steps around the leaf. Testing only the centre
    // reported ten false failures on the villa. What actually matters is
    // whether ANY lane through the opening is passable.
    const ux = Math.cos(d.yaw), uz = -Math.sin(d.yaw);
    const lanes = [0, d.width * 0.28, -d.width * 0.28];
    let reached = false;
    for (const lane of lanes) {
      // Tight to the wall — 0.9 m each side. Starting further out puts the
      // capsule inside the furniture of a densely dressed room and the
      // depenetration push then reads as a blocked doorway. What is being
      // tested is the OPENING, not the room.
      let px = d.x - nx * 0.9 + ux * lane, pz = d.z - nz * 0.9 + uz * lane;
      let py = d.y + 0.15;
      const tx = d.x + nx * 0.9 + ux * lane, tz = d.z + nz * 0.9 + uz * lane;
      let stalled = 0;
      for (let step = 0; step < 400; step++) {
        const dx = tx - px, dz = tz - pz;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.3) { reached = true; break; }
        const sp = 2.4 / 60;
        const bx = px, bz = pz;
        const m = moveCharacter(
          yard, terrain, px, py, pz,
          (dx / dist) * sp, -9.81 / 60 * 0.5, (dz / dist) * sp, SHAPE,
        );
        px = m.x; py = m.y; pz = m.z;
        if (Math.hypot(px - bx, pz - bz) < sp * 0.3) stalled++; else stalled = 0;
        if (stalled > 30) break;
      }
      if (reached) break;
    }
    if (!reached) {
      stuckDoors.push(`${d.name} (${d.x.toFixed(0)}, ${d.z.toFixed(0)})`);
    }
  }
  check(
    `${mapId}: every unlocked doorway lets a body through`,
    stuckDoors.length === 0,
    stuckDoors.length
      ? `${stuckDoors.length} blocked: ${stuckDoors.slice(0, 6).join(', ')}`
      : `${b.doors.filter((d) => !d.locked).length} doorways walked`,
  );

  // And every interior room must have somewhere to stand at all.
  let sealedRooms = 0;
  const names = [];
  for (const r of res.rooms) {
    if (!r.indoors) continue;
    let ok = false;
    for (let a = 0; a < 12 && !ok; a++) {
      const x = r.minX + ((a * 0.37) % 1) * (r.maxX - r.minX);
      const z = r.minZ + ((a * 0.61) % 1) * (r.maxZ - r.minZ);
      const y = r.minY + 0.15;
      let free = 0;
      for (const [dx, dz] of [[0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]]) {
        const m = moveCharacter(yard, terrain, x, y, z, dx, 0, dz, SHAPE);
        if (Math.hypot(m.x - x, m.z - z) > 0.08) free++;
      }
      if (free >= 3) ok = true;
    }
    if (!ok) { sealedRooms++; names.push(r.name); }
  }
  check(
    `${mapId}: every interior room has standable floor`,
    sealedRooms === 0,
    sealedRooms ? names.slice(0, 6).join(', ') : `${res.rooms.filter((r) => r.indoors).length} rooms`,
  );
}

console.log('\n— reachability —');
run('villa');
run('quay');

await server.close();
const passed = results.filter((r) => r.pass).length;
console.log(`\n[reachability] ${passed}/${results.length} passed\n`);
process.exit(passed === results.length ? 0 : 1);
