#!/usr/bin/env node
/**
 * Playability test — can a player actually do the basic things?
 *
 * Everything else in tools/ checks a subsystem in isolation. This drives the
 * real controller through the real level and asks the questions a player asks
 * in the first minute: can I get in, can I shoot, does anything happen when I
 * do. A build can pass every unit check and still be unplayable.
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ root: process.cwd(), configFile:'vite.config.ts',
  server:{port:0,host:'127.0.0.1'}, logLevel:'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', headless:true,
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const page = await browser.newPage({ viewport:{width:320,height:180} });
page.on('pageerror', e=>console.log('PAGEERR', e.message));
await page.goto(url,{waitUntil:'load',timeout:120000});
await page.waitForFunction(()=>window.__BM?.ready===true,{timeout:180000});

// This test measures gameplay state, not pixels. The post chain is the entire
// frame cost under software rendering, so turning it off is the difference
// between a 40-second run and a timeout.
await page.evaluate(() => {
  for (const p of window.__BM.listPasses()) window.__BM.setPass(p.id, p.id === 'present');
});

const report = await page.evaluate(() => {
  const out = {};
  const world = window.services.get('world');
  const player = window.engine.get('player');
  const doors = world.doors;

  // --- 1. Where does the player start, and is the gate reachable? ---------
  out.spawn = { x:+player.position.x.toFixed(1), y:+player.position.y.toFixed(1), z:+player.position.z.toFixed(1) };

  const gate = doors.get(0);
  out.gate = gate ? { name: gate.name, x:+gate.x.toFixed(1), z:+gate.z.toFixed(1), state: gate.state, locked: gate.locked } : null;

  // --- 2. Walk from spawn toward the gate --------------------------------
  const dx = gate.x - player.position.x, dz = gate.z - player.position.z;
  const yaw = Math.atan2(-dx, -dz);
  window.__BM.placePlayer(player.position.x, player.position.z, yaw);
  const start = { x: player.position.x, z: player.position.z };
  window.__BM.driveGame({ moveZ: 1, sprint: true }, 60 * 7);
  const afterWalk = { x:+player.position.x.toFixed(1), z:+player.position.z.toFixed(1) };
  out.walkedToGate = {
    from: { x:+start.x.toFixed(1), z:+start.z.toFixed(1) },
    to: afterWalk,
    distanceToGate: +Math.hypot(gate.x - player.position.x, gate.z - player.position.z).toFixed(1),
  };

  // --- 3. Can the player open the gate with interact? --------------------
  const before = gate.state;
  // Exactly one frame: `use` toggles, so holding it opens and shuts the door
  // repeatedly. The real input path is edge-triggered, this one is not.
  window.__BM.driveGame({ use: true }, 1);
  // Let the leaf finish swinging.
  window.__BM.driveGame({}, 90);
  out.interact = {
    gateBefore: before,
    gateAfter: doors.get(0).state,
    openAmount: +doors.get(0).openAmount.toFixed(2),
  };

  // --- 4. Try to get inside the compound at all --------------------------
  // Drive forward for another 10 seconds and see whether we cross the wall.
  window.__BM.driveGame({ moveZ: 1, sprint: true }, 60 * 6);
  const p = player.position;
  const PERIM = { x0:-78, x1:78, z0:-58, z1:74 };
  out.insideCompound = p.x > PERIM.x0 && p.x < PERIM.x1 && p.z > PERIM.z0 && p.z < PERIM.z1;
  out.endedAt = { x:+p.x.toFixed(1), y:+p.y.toFixed(1), z:+p.z.toFixed(1) };

  // --- 5. Does firing produce anything? ----------------------------------
  const rt = window.engine.get('weaponRuntime');
  const ball = window.engine.get('ballistics');
  const b0 = { ...ball.stats };
  let events = 0;
  const off = window.bus.on('weapon:fired', () => { events++; });
  player.input.fire = true;
  for (let i = 0; i < 30; i++) rt.fixedUpdate(1/60, window.engine.ctx);
  player.input.fire = false;
  off();
  out.firing = {
    firedEvents: events,
    projectiles: ball.stats.fired - b0.fired,
    ammo: rt.ammoCount,
  };

  // --- 6. Is there any visual feedback for a shot? -----------------------
  const render = window.services.get('render');
  const names = [];
  render.scene.traverse(o => { if (o.name) names.push(o.name); });
  out.fxObjects = names.filter(n => /tracer|flash|impact|decal|muzzle|spark|smoke/i.test(n));
  out.viewSceneChildren = render.viewScene.children.length;

  return out;
});

console.log(JSON.stringify(report, null, 2));
await browser.close(); await server.close();
