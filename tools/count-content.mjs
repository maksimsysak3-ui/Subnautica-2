import { createServer } from 'vite';
const s = await createServer({ root: process.cwd(), configFile:'vite.config.ts', server:{middlewareMode:true}, logLevel:'error', appType:'custom' });
const a = await s.ssrLoadModule('/src/weapons/arsenal.ts');
const m = await s.ssrLoadModule('/src/weapons/ammo.ts');
const t = await s.ssrLoadModule('/src/weapons/attachments.ts');
const c = await s.ssrLoadModule('/src/weapons/calibers.ts');
console.log(`weapons: ${a.WEAPONS.length}  ammo: ${m.AMMO.length}  attachments: ${t.ATTACHMENTS.length}  calibers: ${c.CALIBERS.length}`);
await s.close();
