#!/usr/bin/env node
/**
 * AI behaviour test.
 *
 * An AI that compiles is not an AI that works. This drives the real engine and
 * asserts on observable behaviour: do enemies exist, do they patrol, do they
 * notice a gunshot, do they notice the player, do they shoot, and does the
 * pathfinder stay inside its frame budget.
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.ts'),
  server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--disable-dev-shm-usage', '--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.error('  [pageerror]', e.message));
await page.goto(url, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__BM?.ready === true, { timeout: 180000 });

const results = [];
const check = (name, pass, detail) => {
  results.push({ pass });
  console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const snap = () => page.evaluate(() => {
  const reg = window.engine.get('actors');
  const ai = window.engine.get('ai');
  const hostiles = reg.all.filter((a) => a.faction !== 'player');
  const states = {};
  for (const a of hostiles) {
    const s = a.brain?.state ?? 'none';
    states[s] = (states[s] ?? 0) + 1;
  }
  return {
    count: hostiles.length,
    alive: hostiles.filter((a) => a.alive).length,
    states,
    stats: { ...ai.stats },
    positions: hostiles.slice(0, 6).map((a) => [+a.position.x.toFixed(2), +a.position.z.toFixed(2)]),
    alertness: hostiles.map((a) => +(a.brain?.alertness ?? 0).toFixed(2)),
  };
});

// --- 1. the garrison exists -------------------------------------------------
const s0 = await snap();
check('garrison spawned', s0.count >= 10, `${s0.count} hostiles, ${s0.alive} alive`);
check('every hostile has a brain', !s0.states.none, JSON.stringify(s0.states));

// --- 2. patrols actually move ----------------------------------------------
await page.evaluate(() => window.__BM.settle(4000));
const s1 = await snap();
const moved = s1.positions.filter((p, i) =>
  Math.hypot(p[0] - s0.positions[i][0], p[1] - s0.positions[i][1]) > 1.0).length;
check('patrols move', moved >= 2, `${moved}/6 sampled moved`);
check('pathfinder stays in budget', s1.stats.pathsThisFrame <= 2,
  `${s1.stats.pathsThisFrame} paths/frame, avg ${s1.stats.pathMsAvg.toFixed(1)}ms`);

// --- 3. hearing -------------------------------------------------------------
const beforeAlert = Math.max(...s1.alertness);
await page.evaluate(() => {
  // A gunshot at the motor court. Nobody should be able to ignore it.
  window.bus.emit('weapon:fired', {
    weaponId: 'test', muzzle: { x: -4, y: 3, z: 40 }, direction: { x: 0, y: 0, z: -1 },
    suppressed: false, loudnessMeters: 120, shooterId: 0,
  });
});
await page.evaluate(() => window.__BM.settle(1200));
const s2 = await snap();
const afterAlert = Math.max(...s2.alertness);
check('gunfire raises alertness', afterAlert > beforeAlert + 0.2,
  `${beforeAlert.toFixed(2)} → ${afterAlert.toFixed(2)}`);
check('alerted enemies investigate',
  (s2.states.search ?? 0) + (s2.states.alert ?? 0) >= 2, JSON.stringify(s2.states));

// --- 4. sight and engagement ------------------------------------------------
// Deterministic rather than opportunistic: pin one guard in place, stand the
// player in front of it, and let it look. Chasing a live patrol made this test
// depend on where that guard happened to have walked, which is exactly the
// kind of flake that teaches you to ignore a red suite.
await page.evaluate(() => {
  const reg = window.engine.get('actors');
  const guard = reg.all.find((a) => a.faction !== 'player' && a.alive);
  guard.brain.route = [];
  guard.brain.path = [];
  guard.brain.goal = null;
  guard.brain.state = 'idle';
  guard.brain.alertness = 0.5;
  const p = window.engine.get('player');
  const world = window.services.get('world');
  const fx = guard.position.x + guard.forward.x * 8;
  const fz = guard.position.z + guard.forward.z * 8;
  p.position.set(fx, world.floorAt(fx, fz, guard.position.y + 3) + p.eyeHeight, fz);
  p.velocity.set(0, 0, 0);
  window.__TESTGUARD = guard.id;
});
await page.evaluate(() => window.__BM.settle(1800));
const s3 = await snap();

// Diagnose rather than guess when this fails: report exactly which link in the
// perception chain is broken.
const diag = await page.evaluate(() => {
  const reg = window.engine.get('actors');
  const world = window.services.get('world');
  const g = reg.get(window.__TESTGUARD);
  const p = reg.get(0);
  if (!g || !p) return { error: `guard=${!!g} player=${!!p}` };
  const dx = p.position.x - g.position.x, dz = p.position.z - g.position.z;
  const dist = Math.hypot(dx, dz);
  const dot = (g.forward.x * dx + g.forward.z * dz) / dist;
  const eye = { x: g.position.x, y: g.position.y + 1.55, z: g.position.z };
  // Probe the torso, not the feet: `Actor.position` is at ground level, so a
  // ray aimed there runs into the floor and reports no line of sight across
  // open ground. That was a real bug in the AI and it is just as easy to
  // write into the test that is supposed to catch it.
  const torso = { x: p.position.x, y: p.position.y + 1.05, z: p.position.z };
  let los = null;
  try { los = world.lineOfSight(eye, torso, [g.id, 0]); } catch (e) { los = 'threw:' + e.message; }
  const env = window.services.tryGet('environment');
  return {
    dist: +dist.toFixed(2), facingDot: +dot.toFixed(3), los,
    light: +(env?.time?.ambientLightLevel ?? -1).toFixed(2),
    brain: { state: g.brain.state, alertness: +g.brain.alertness.toFixed(2),
             lostFor: +g.brain.lostFor.toFixed(2), reaction: +g.brain.reaction.toFixed(2) },
  };
});
console.log('    perception chain:', JSON.stringify(diag));
check('the watched guard engages', diag.brain?.state === 'engage' || (s3.states.engage ?? 0) >= 1,
  `${diag.brain?.state}, ${JSON.stringify(s3.states)}`);

// --- 5. they shoot, and it lands somewhere ---------------------------------
const fired = await page.evaluate(() => new Promise((resolve) => {
  let n = 0;
  const off = window.bus.on('ai:fired', () => { n++; });
  window.__BM.settle(2500);
  setTimeout(() => { off?.(); resolve(n); }, 50);
}));
check('engaged enemies fire', fired > 0, `${fired} shots`);

// Is the player's hit volume actually reachable by a raycast? If enemy fire
// cannot resolve actor 0 then no amount of aiming matters, and that is a very
// different bug from "they keep missing".
const hitProbe = await page.evaluate(() => {
  const world = window.services.get('world');
  const p = window.engine.get('actors').get(0);
  // Probe from close in, on all four axes: the player may well be standing
  // beside a wall, and one blocked direction says nothing about the hit
  // volume. What matters is whether ANY clear ray resolves actor 0.
  const out = [];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let clear = null;
  for (const [dx, dz] of dirs) {
    const from = { x: p.position.x + dx * 5, y: p.position.y + 1.05, z: p.position.z + dz * 5 };
    const hit = world.raycast(from, { x: -dx, y: 0, z: -dz }, { maxDistance: 8 });
    const tag = hit ? `${hit.actorId ?? -1}/${hit.surface}` : 'none';
    out.push(tag);
    // Remember a direction with a genuinely clear shot at the player, so the
    // damage test below does not put its shooter behind a wall.
    if (!clear && hit && hit.actorId === 0) clear = [dx, dz];
  }
  window.__CLEARDIR = clear;
  return { rays: out, resolvesPlayer: !!clear, clear };
});
console.log('    hitbox probe:', JSON.stringify(hitProbe));
check('a raycast can resolve the player', hitProbe.resolvesPlayer, hitProbe.rays.join(' '));

// Damage must actually land, not merely be attempted.
//
// Set this up deliberately: one hostile, point blank, clear line of sight,
// already alerted. Waiting for a distant patrol to connect through spread and
// cover tests the dice, not the damage path.
const hpBefore = await page.evaluate(() => {
  const reg = window.engine.get('actors');
  const p = reg.get(0);
  const g = reg.all.find((a) => a.faction !== 'player' && a.alive);
  // Put the shooter 5 m away on open ground, facing the player.
  // Use the direction the probe found clear at 5 m, not a guess.
  const c = window.__CLEARDIR ?? [0, 1];
  const dir = { x: c[0], z: c[1] };
  g.position.set(p.position.x + dir.x * 5, p.position.y, p.position.z + dir.z * 5);
  g.forward.set(-dir.x, 0, -dir.z);
  g.brain.route = []; g.brain.path = []; g.brain.goal = null;
  g.brain.alertness = 1; g.brain.morale = 1;
  g.brain.state = 'engage'; g.brain.believedPos = p.position.clone();
  g.brain.reaction = 0; g.brain.lostFor = 0; g.brain.aimError = 0.02;
  g.skill = 0.95;
  window.__SHOOTER = g.id;
  return p.health;
});
await page.evaluate(() => window.__BM.settle(5000));
const after = await page.evaluate(() => {
  const p = window.engine.get('actors').get(0);
  const g = window.engine.get('actors').get(window.__SHOOTER);
  return {
    health: p?.health ?? -1, pain: +(p?.pain ?? 0).toFixed(2),
    shooterState: g?.brain?.state, lostFor: +(g?.brain?.lostFor ?? -1).toFixed(2),
  };
});
console.log('    shooter:', JSON.stringify(after));
check('enemy fire damages the player', after.health < hpBefore,
  `health ${hpBefore} → ${after.health.toFixed(1)}, pain ${after.pain}`);

await browser.close();
await server.close();
const failed = results.filter((r) => !r.pass).length;
console.log(`\n[ai] ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
