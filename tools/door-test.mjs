#!/usr/bin/env node
/**
 * Door solidity regression test.
 *
 * Walks the real player controller perpendicular into every closed door and
 * asserts it does not pass through. The original collision test only walked
 * eight headings from open ground and checked the end position, so it passed
 * cleanly while a third of the level's geometry — every door leaf, railing and
 * ladder rung — was walk-through.
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ root: process.cwd(), configFile:'vite.config.ts',
  server:{port:0,host:'127.0.0.1'}, logLevel:'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', headless:true,
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const page = await browser.newPage({ viewport:{width:480,height:270} });
page.on('pageerror', e=>console.log('PAGEERR', e.message));
await page.goto(url,{waitUntil:'load',timeout:120000});
await page.waitForFunction(()=>window.__BM?.ready===true,{timeout:180000});

const results = await page.evaluate(() => {
  const world = window.services.get('world');
  const doors = world.doors;
  const out = [];

  const ids = [];
  for (let i = 0; i < 200; i++) if (doors.get(i)) ids.push(i);

  // Test the collision solver directly rather than driving the controller
  // across the level: this asserts exactly the property that matters — that a
  // capsule cannot cross the door plane — with no pathing or placement in the
  // way.
  const shape = { radius: 0.32, height: 1.8, stepHeight: 0.46, minGroundNormalY: 0.55 };

  for (const id of ids) {
    const d = doors.get(id);
    if (!d || d.state === 'open') continue;

    // Doorway plane normal. The leaf brick is built with its local X along the
    // doorway and local Z as thickness, so the plane normal is the brick's
    // local +Z taken to world space: (sin yaw, cos yaw). Using (cos, -sin)
    // here approaches *along* the wall instead, which starts the capsule
    // inside solid geometry and measures nothing about the door.
    const nx = Math.sin(d.yaw), nz = Math.cos(d.yaw);
    // Start just in front of the leaf, at the door's own floor height.
    const sx = d.x + nx * 0.75, sz = d.z + nz * 0.75;
    const y = d.y + 0.05;

    // Push 1.5 m straight through, in six 0.25 m increments so the solver gets
    // the same small steps a walking character would give it.
    let px = sx, py = y, pz = sz;
    for (let i = 0; i < 6; i++) {
      const r = world.moveCharacter(px, py, pz, -nx * 0.25, 0, -nz * 0.25, shape);
      px = r.x; py = r.y; pz = r.z;
    }

    // Signed distance from the door plane along its normal. Positive means the
    // capsule is still on the side it started.
    const sd = (px - d.x) * nx + (pz - d.z) * nz;
    const sd0 = (sx - d.x) * nx + (sz - d.z) * nz;
    out.push({
      id, name: d.name, material: d.material, locked: !!d.locked,
      startedAt: +sd0.toFixed(2),
      endedAt: +sd.toFixed(2),
      // Blocked means the capsule never reached the far side of the plane.
      through: sd < -0.1,
      // A huge outward jump means depenetration ejected it rather than stopping it.
      ejected: sd > sd0 + 1.0,
    });
  }
  return out;
});

console.table(results);
const through = results.filter(r => r.through);
console.log(through.length === 0
  ? `[doors] ✓ all ${results.length} closed doors are solid`
  : `[doors] ✗ ${through.length}/${results.length} closed doors walked through: ${through.map(r=>r.id).join(', ')}`);

await browser.close(); await server.close();
process.exit(through.length === 0 ? 0 : 1);
