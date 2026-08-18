import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const OUT = path.resolve('docs/shots/atmodbg'); await mkdir(OUT, { recursive: true });
const server = await createServer({ root: process.cwd(), configFile:'vite.config.ts', server:{port:0,host:'127.0.0.1'}, logLevel:'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', headless:true,
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const page = await browser.newPage({ viewport:{width:1100,height:620} });
page.on('pageerror', e=>console.log('ERR',e.message));
await page.goto(url,{waitUntil:'load',timeout:120000});
await page.waitForFunction(()=>window.__BM?.ready===true,{timeout:180000});
const shot = process.argv[2] ?? 'site-overview';
for (const [name, on] of [['atmo-on',true],['atmo-off',false],['bare',null]]) {
  await page.evaluate(({shot,on})=>{
    window.__BM.setupShot(shot);
    const passes = window.__BM.listPasses();
    if (on === null) {
      for (const p of passes) window.__BM.setPass(p.id, p.id === 'present');
    } else {
      for (const p of passes) window.__BM.setPass(p.id, true);
      window.__BM.setPass('fxaa', false);
      window.__BM.setPass('atmosphere', on);
    }
  }, {shot,on});
  await page.evaluate(()=>window.__BM.settle(500));
  await page.screenshot({ path: path.join(OUT, name+'.png'), timeout: 180000 });
  console.log('  ✓', name);
}
await browser.close(); await server.close();
