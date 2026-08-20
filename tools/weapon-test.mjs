#!/usr/bin/env node
/**
 * Ballistics and weapon-handling verification.
 *
 * Measures what the simulation actually does rather than asserting that it
 * compiles: time of flight, bullet drop and retained velocity at range, whether
 * penetration and armour behave, and whether the recoil pattern is learnable
 * (deterministic) rather than random.
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
page.on('console', m=>{ if(m.type()==='error') console.log('CONSOLE', m.text()); });
await page.goto(url,{waitUntil:'load',timeout:120000});
await page.waitForFunction(()=>window.__BM?.ready===true,{timeout:180000});

// Put the camera high and clear so shots fly unobstructed.
await page.evaluate(() => {
  window.__BM.setupShot('site-overview');
  const cam = window.services.get('render').camera;
  cam.position.set(0, 60, 0);
  cam.lookAt(300, 60, 0);
});

console.log('\n=== Ballistics: drop and retained velocity by range ===');
const weapons = ['ho-mk4c', 'vp-akm', 'ca-dm7', 'aw-am86', 'aw-p9'];
for (const w of weapons) {
  await page.evaluate((id) => window.__BM.equipWeapon(id), w);
  const rows = [];
  let muzzle = 0;
  for (const range of [100, 300, 600]) {
    const r = await page.evaluate((rg) => window.__BM.ballisticProfile(rg), range);
    muzzle = r.muzzle;
    rows.push(`${String(range).padStart(3)}m t=${r.flightSeconds.toFixed(2)}s drop=${r.dropMetres.toFixed(2)}m v=${String(r.impactSpeed).padStart(3)}${r.reached ? '' : ' (short)'}`);
  }
  console.log(`${w.padEnd(9)} muzzle ${String(muzzle).padStart(3)} m/s | ${rows.join(' | ')}`);
}

console.log('\n=== Recoil pattern determinism (must be learnable) ===');
const pattern = await page.evaluate(() => {
  const mod = window.services.get('weapons');
  // Two independent states on the same weapon must produce the same pattern.
  return window.__BM.weaponState() ? true : false;
});
const patternCheck = await page.evaluate(async () => {
  const { buildPattern } = await import('/src/weapons/recoil.ts');
  const a = buildPattern('ho-mk4c', 10).map(s => [ +s.vertical.toFixed(4), +s.horizontal.toFixed(4) ]);
  const b = buildPattern('ho-mk4c', 10).map(s => [ +s.vertical.toFixed(4), +s.horizontal.toFixed(4) ]);
  const c = buildPattern('vp-akm', 10).map(s => [ +s.vertical.toFixed(4), +s.horizontal.toFixed(4) ]);
  return {
    identical: JSON.stringify(a) === JSON.stringify(b),
    differsBetweenWeapons: JSON.stringify(a) !== JSON.stringify(c),
    first5: a.slice(0, 5),
  };
});
console.log('same weapon twice identical :', patternCheck.identical);
console.log('differs between weapons     :', patternCheck.differsBetweenWeapons);
console.log('first 5 steps [vert, horiz] :', JSON.stringify(patternCheck.first5));

console.log('\n=== Attachment trade-offs (must not be pure upgrades) ===');
const combos = [
  ['bare',        {}],
  ['suppressed',  { muzzle: 'muz-supp-heavy' }],
  ['brake',       { muzzle: 'muz-brake-l' }],
  ['sniper glass',{ optic: 'opt-scope-10' }],
  ['drum',        { magazine: 'mag-drum' }],
  ['heavy barrel',{ receiver: 'bar-heavy' }],
];
for (const [label, att] of combos) {
  const s = await page.evaluate(({ att }) => window.__BM.equipWeapon('ho-mk4c', att), { att });
  console.log(
    `${label.padEnd(13)} erg ${String(Math.round(s.ergonomics)).padStart(3)}  ads ${String(Math.round(s.adsTimeMs)).padStart(4)}ms  ` +
    `vRec ${s.verticalRecoil.toFixed(2)}  sound ${String(Math.round(s.soundMeters)).padStart(4)}m  ` +
    `mag ${String(s.magazineSize).padStart(3)}  sway ${s.swayAmplitude.toFixed(2)}  mass ${s.massKg.toFixed(2)}kg`);
}

console.log('\n=== Penetration: same weapon, different loads, through a wall ===');
await page.evaluate(() => {
  const cam = window.services.get('render').camera;
  // Eye height inside the compound, aimed at a building wall.
  cam.position.set(0, 4, 40);
  cam.lookAt(0, 3, -20);
});
for (const ammoId of ['5.56x45-fmj', '5.56x45-ap', '5.56x45-jhp']) {
  await page.evaluate((a) => window.__BM.equipWeapon('ho-mk4c', {}, a), ammoId);
  const r = await page.evaluate(() => window.__BM.fireAt(0, 3, -20, 20));
  console.log(`${ammoId.padEnd(14)} impacts ${r.impacts}  penetrations ${r.penetrations}  ricochets ${r.ricochets}`);
}

console.log('\n=== Hit registration on a live actor ===');
const hit = await page.evaluate(() => {
  const id = window.__BM.spawnTarget(0, 4, 10);
  const a = window.services.get('actors').get(id);
  // Aim at the actor's actual chest, not a guessed height.
  const aim = { x: a.position.x, y: a.position.y + 1.15, z: a.position.z };
  const cam = window.services.get('render').camera;
  cam.position.set(aim.x, aim.y, aim.z + 25);
  cam.lookAt(aim.x, aim.y, aim.z);
  const before = a.health;
  const r = window.__BM.fireAt(aim.x, aim.y, aim.z, 6);
  const after = window.services.get('actors').get(id).health;
  return { id, aim, before, after: Math.round(after * 10) / 10, ...r };
});
console.log(JSON.stringify(hit));

await browser.close(); await server.close();
