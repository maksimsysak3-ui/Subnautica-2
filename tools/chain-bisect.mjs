#!/usr/bin/env node
/**
 * Enables post passes cumulatively and captures after each, so the first
 * configuration that introduces an artifact identifies the culprit. Disabling
 * one pass at a time cannot find a problem that several passes contribute to.
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const SHOT = process.argv[2] ?? 'site-overview';
const OUT = path.resolve(process.argv[3] ?? 'docs/shots/bisect');
await mkdir(OUT, { recursive: true });
const server = await createServer({ root: process.cwd(), configFile:'vite.config.ts', server:{port:0,host:'127.0.0.1'}, logLevel:'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', headless:true,
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const page = await browser.newPage({ viewport:{width:1100,height:620} });
page.on('pageerror', e=>console.log('ERR',e.message));
await page.goto(url,{waitUntil:'load',timeout:120000});
await page.waitForFunction(()=>window.__BM?.ready===true,{timeout:180000});

const passes = (await page.evaluate(()=>window.__BM.listPasses()))
  .filter(p => p.id !== 'present' && p.id !== 'fxaa')
  .sort((a,b)=>a.order-b.order);

const on = [];
for (let i = 0; i <= passes.length; i++) {
  const label = i === 0 ? '0-present-only' : `${i}-plus-${passes[i-1].id}`;
  if (i > 0) on.push(passes[i-1].id);
  await page.evaluate(({shot,on})=>{
    window.__BM.setupShot(shot);
    for (const p of window.__BM.listPasses()) {
      window.__BM.setPass(p.id, p.id === 'present' || on.includes(p.id));
    }
  }, { shot: SHOT, on: [...on] });
  await page.evaluate(()=>window.__BM.settle(500));
  await page.screenshot({ path: path.join(OUT, label + '.png'), timeout: 180000 });
  console.log('  ✓', label);
}
await browser.close(); await server.close();
