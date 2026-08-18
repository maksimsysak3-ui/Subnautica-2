import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const OUT = path.resolve('docs/shots/atmo'); await mkdir(OUT, { recursive: true });
const server = await createServer({ root: process.cwd(), configFile:'vite.config.ts', server:{port:0,host:'127.0.0.1'}, logLevel:'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', headless:true,
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const page = await browser.newPage({ viewport:{width:640,height:360} });
page.on('pageerror', e=>console.log('ERR',e.message));
await page.goto(url,{waitUntil:'load',timeout:120000});
await page.waitForFunction(()=>window.__BM?.ready===true,{timeout:180000});

const variants = [
  ['base',        {}],
  ['noHeight',    { heightDensity: 0 }],
  ['noDistance',  { distanceDensity: 0 }],
  ['noDesat',     { desaturation: 0 }],
  ['noInscatter', { inscatterStrength: 0 }],
];
for (const [name, over] of variants) {
  await page.evaluate(({ over }) => {
    const a = window.services.get('render').post.atmosphere;
    a.__saved ??= { heightDensity:a.heightDensity, distanceDensity:a.distanceDensity,
                    desaturation:a.desaturation, inscatterStrength:a.inscatterStrength };
    Object.assign(a, a.__saved, over);
    window.__BM.setupShot('site-overview');
  }, { over });
  await page.evaluate(()=>window.__BM.settle(300));
  await page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 180000 });
  console.log('  ✓', name);
}
// Sample a vertical strip of pixels to measure the band period.
const strip = await page.evaluate(() => {
  const c = document.getElementById('game');
  const gl = c.getContext('webgl2');
  const w = 1, h = c.height;
  const px = new Uint8Array(w*h*4);
  gl.readPixels(Math.floor(c.width*0.15), 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const out = [];
  for (let y=0;y<h;y+=1) out.push(px[y*4]);
  return out;
});
console.log('strip luminance (bottom→top):', strip.slice(0, 120).join(','));
await browser.close(); await server.close();
