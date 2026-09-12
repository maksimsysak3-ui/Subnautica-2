/**
 * The renderer, built and run, asserted on the pixels it produced.
 *
 * Was a copy of the frame loop kept in the page: its own pipelines, its own
 * bind groups, its own camera. That copy could pass while the game was broken,
 * which is the one thing a smoke test must not do. It now builds the real
 * Renderer through src/headless.ts and asserts what a screenshot would tell a
 * person -- sky above, ground below, buildings standing on it, the culler
 * dropping some and keeping others, and every level of detail in use.
 *
 * Renders to a texture rather than a canvas so it runs with no display and no
 * real GPU: the software rasteriser here takes canvas presentation down within
 * a second of boot.
 *
 *   node tools/gpu-smoke.mjs
 */

import { chromium } from 'playwright';
import http from 'node:http';
import * as esbuild from 'esbuild';

const W = 480, H = 270;

const bundle = (await esbuild.build({
  entryPoints: [new URL('../src/headless.ts', import.meta.url).pathname],
  bundle: true, format: 'iife', globalName: 'HEADLESS', write: false,
  target: 'es2022', loader: { '.wgsl': 'text' },
})).outputFiles[0].text;

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/headless.js')) {
    res.writeHead(200, { 'content-type': 'text/javascript' }).end(bundle);
  } else {
    // Served over loopback: WebGPU is only exposed in a secure context.
    res.writeHead(200, { 'content-type': 'text/html' })
      .end('<!doctype html><meta charset=utf-8><body><script src="/headless.js"></script>');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=vulkan',
         '--use-vulkan=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox',
         '--disable-gpu-sandbox'],
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });

// Two views, because they exercise different halves of the draw path: from
// high up almost everything is coarse and most of the map is outside the
// frustum, from street level a handful of buildings are at full detail.
const shots = { width: W, height: H, focus: [0, 0], frames: 6, lite: true, hour: 0.34 };
const result = await page.evaluate(async (cfg) => {
  // Sky is the bright, blue-biased part of the frame; ground and buildings
  // are everything else with light on it. Classifying by hue rather than by
  // brightness, because the sky is now the brightest thing in the picture
  // rather than the darkest -- which is how the first version of this test
  // came to insist a sunlit frame had no sky in it.
  const stat = (px) => {
    let sky = 0, lit = 0;
    for (let i = 0; i < px.length; i += 4) {
      const l = px[i] + px[i + 1] + px[i + 2];
      if (px[i + 2] > px[i] + 10 && l > 240) sky++; else if (l > 90) lit++;
    }
    const n = px.length / 4;
    return { skyPct: (sky / n) * 100, litPct: (lit / n) * 100 };
  };
  const out = {};
  const errors = [];
  window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));
  for (const [name, over] of [['far', { distance: 900, pitch: 0.55 }],
                              ['near', { distance: 90, pitch: 0.25 }]]) {
    const shot = await HEADLESS.shoot({ ...cfg, yaw: 0.62, ...over });
    // Sky in the top row, counted rather than sampled at one corner: from
    // street level a building fills the corner, and asserting on one pixel
    // made the test a statement about where the camera happened to point.
    let topSky = 0;
    for (let x = 0; x < cfg.width; x++) {
      const i = x * 4;
      if (shot.pixels[i + 2] > shot.pixels[i] + 10
        && shot.pixels[i] + shot.pixels[i + 1] + shot.pixels[i + 2] > 240) topSky++;
    }
    out[name] = { ...stat(shot.pixels), topSkyPct: (topSky / cfg.width) * 100, stats: shot.stats };
  }
  // The rebuild path: a road placed and a block zoned, then the world made
  // again from the changed state.
  try {
    out.rebuild = await HEADLESS.probeRebuild(cfg.width, cfg.height);
  } catch (err) {
    out.rebuild = { error: String(err) };
  }
  // And the same thing again through the toolbar and the pointer, which is
  // the only path a player has.
  try {
    out.tools = await HEADLESS.probeTools();
  } catch (err) {
    out.tools = { error: String(err) };
  }
  // And the growth animation, which no count can see: the instances are all
  // present from the first frame and the question is how tall they are.
  try {
    out.growth = await HEADLESS.probeGrowth(cfg.width, cfg.height);
  } catch (err) {
    out.growth = { error: String(err) };
  }
  // And the incremental rebuild, against a rebuild from nothing.
  try {
    out.incremental = HEADLESS.probeIncremental();
  } catch (err) {
    out.incremental = { error: String(err) };
  }
  // And the land tool: a bitmask and a shader overlay, invisible to every other
  // check here.
  try {
    out.land = await HEADLESS.probeLand();
  } catch (err) {
    out.land = { error: String(err) };
  }
  // And the curve tool, which is clicked rather than dragged and whose whole
  // job -- a bend where one was asked for, and a run that stays one road --
  // is invisible in a screenshot.
  try {
    out.curve = await HEADLESS.probeCurve();
  } catch (err) {
    out.curve = { error: String(err) };
  }
  out.errors = errors;
  return out;
}, shots).catch((err) => ({ error: String(err).split('\n')[0] }));

const fails = [];
const push = (m) => fails.push(m);
if (result.error) push(result.error);
if (result.errors?.length) push(`unhandled: ${result.errors.join('; ')}`);

for (const view of ['far', 'near']) {
  const v = result[view];
  if (!v) { push(`${view}: no frame`); continue; }
  const s = v.stats ?? {};
  const [shown, total] = (s.buildings ?? '0/0').replace(/,/g, '').split('/').map(Number);
  const lod = (s.lod ?? '0·0·0').split('·').map(Number);
  if (!(total > 200)) push(`${view}: only ${total} instances in the world`);
  if (!(shown > 0)) push(`${view}: culling passed nothing through`);
  if (!(shown < total)) push(`${view}: culling kept all ${total} instances -- is it running?`);
  if (!(lod.reduce((a, b) => a + b, 0) === shown)) {
    push(`${view}: level-of-detail counts ${lod.join('/')} do not sum to ${shown}`);
  }
  if (!(v.topSkyPct > 30)) push(`${view}: only ${v.topSkyPct.toFixed(0)}% of the top row is sky`);
  if (!(v.skyPct > 3 && v.skyPct < 92)) push(`${view}: sky covers ${v.skyPct.toFixed(0)}%`);
  if (!(v.litPct > 1)) push(`${view}: only ${v.litPct.toFixed(1)}% of pixels are lit geometry`);
}
// The far view must be coarser than the near one, or the LOD selector is not
// reading distance at all.
if (result.far?.stats && result.near?.stats) {
  const share = (s) => {
    const l = s.lod.split('·').map(Number);
    const n = l.reduce((a, b) => a + b, 0) || 1;
    return l[0] / n;
  };
  if (!(share(result.near.stats) > share(result.far.stats))) {
    push(`level of detail does not follow distance: near ${result.near.stats.lod}, far ${result.far.stats.lod}`);
  }
}

const rb = result.rebuild;
if (!rb || rb.error) {
  push(`rebuild failed: ${rb?.error ?? 'no result'}`);
} else {
  // Different, not larger: a road driven through a built-up quarter demolishes
  // what stood in it, so the count can move either way. What must not happen
  // is that it does not move, which is what a placement silently failing to
  // take, or a stale buffer left bound, would look like.
  const total = (s) => Number((s.buildings ?? '0/0').split('/')[1].replace(/,/g, ''));
  if (total(rb.after) === total(rb.before)) {
    push(`rebuild changed nothing: ${total(rb.before)} instances before and after`);
  }
  console.log(`rebuild  ${total(rb.before).toLocaleString()} instances -> `
    + `${total(rb.after).toLocaleString()} after an avenue through a built quarter`);
}

const cst = result.rebuild;
if (cst && cst.cost) {
  const parts = Object.entries(cst.cost).filter(([k]) => k !== 'total')
    .sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(0)}`);
  console.log(`cost     rebuild ${cst.cost.total.toFixed(0)}ms  (${parts.join(', ')})`);
  console.log(`edits    ${cst.edits.join(' ')} ms`);
  console.log(`meshes   ${cst.meshes.join(' ')} newly baked per edit`);
  console.log(`chunks   ${cst.cost.terrainChunks} terrain chunks rebuilt on the last edit`);
}

const ic = result.incremental;
if (!ic || ic.error) {
  push(`incremental probe failed: ${ic?.error ?? 'no result'}`);
} else {
  // Exactly, not approximately. Rebuilding the part an edit changed produces
  // the same city as rebuilding all of it, building for building -- the passes
  // are deterministic and the region is sized so nothing outside it can be
  // affected. Anything above zero means a pass is being skipped, run twice, or
  // run against ground whose claims were not put back.
  if (ic.worst !== 0) push(`incremental rebuild is ${ic.worst}% away from a full one`);
  // The road mesh, unlike the buildings, has to match exactly: it is cached
  // piece by piece, and a piece that comes back even slightly different means
  // the roads drift further from the truth with every road drawn.
  if (ic.roads !== 'same') push(`the road mesh does not match a full rebuild — ${ic.roads}`);
  console.log(`partial  incremental vs full: ${ic.sizes} — worst ${ic.worst}% apart, roads ${ic.roads}`);
}

const ld = result.land;
if (!ld || ld.error) {
  push(`land probe failed: ${ld?.error ?? 'no result'}`);
} else {
  if (ld.owned !== 4) push(`a new city starts owning ${ld.owned} plots, wanted 4`);
  if (!(ld.after > ld.owned)) push(`clicking a plot bought nothing: still ${ld.after}`);
  if (ld.zonedOffLand !== 0) push(`zoning took on land nobody owns: ${ld.zonedOffLand} cells`);
  if (!(ld.camera > 400)) push(`the land tool did not lift the camera: ${ld.camera}m`);
  console.log(`land     ${ld.owned} plots -> ${ld.after} bought through the bar, `
    + `camera at ${ld.camera}m, ${ld.zonedOffLand} cells zoned off-plot`);
}

const gr = result.growth;
if (!gr || gr.error) {
  push(`growth probe failed: ${gr?.error ?? 'no result'}`);
} else {
  const [, b, c] = gr.lit;
  if (!(b > 0.3)) push(`nothing moved as the block came up: ${b}% of the frame changed`);
  if (!(c > b)) push(`the growth stopped early: ${b}% changed, then ${c}%`);
  console.log(`growth   ${gr.lit.map((v) => `${v}%`).join(' -> ')} of the frame moved as ${gr.count} buildings came up`);
}

const tl = result.tools;
if (!tl || tl.error) {
  push(`build tools failed: ${tl?.error ?? 'no result'}`);
} else {
  if (!tl.picked) push('selecting a tool did not take the pointer from the camera');
  if (!(tl.roadCellsAfter > tl.roadCellsBefore)) {
    push(`dragging a road laid nothing: ${tl.roadCellsBefore} road cells before and `
      + `${tl.roadCellsAfter} after`);
  }
  if (tl.zonedAfter === tl.zonedBefore) {
    push(`dragging a zone painted nothing: ${tl.zonedBefore} zoned cells before and after`);
  }
  if (!(tl.drawerSize > 4)) push(`the parks drawer offered ${tl.drawerSize} buildings`);
  if (!(tl.lotsAfter > tl.lotsBefore)) {
    push(`placing a service from the drawer put nothing down: ${tl.lotsBefore} lots before and after`);
  }
  // The two data-built drawers. A zone drawer that lost its per-style tiles,
  // or a landmark drawer that lost its tabs, is a regression nothing else here
  // would notice.
  if (!(tl.zoneTiles >= 20)) push(`the zone drawer offered ${tl.zoneTiles} tiles`);
  for (const badge of ['ANY', 'MOD', 'EU', 'NA', 'AS', 'FARM']) {
    if (!String(tl.zoneBadges).split(',').includes(badge)) {
      push(`the zone drawer has no ${badge} tile (badges: ${tl.zoneBadges})`);
    }
  }
  if (tl.sigTabs !== 4) push(`the landmark drawer had ${tl.sigTabs} tabs, wanted 4`);
  if (!(tl.sigTiles > 2)) push(`the landmark drawer showed ${tl.sigTiles} buildings`);
  console.log(`drawers  ${tl.zoneTiles} zone tiles [${tl.zoneBadges}], `
    + `${tl.sigTabs} landmark tabs over ${tl.sigTiles} buildings`);
  console.log(`tools    ${tl.roadCellsBefore} road cells -> ${tl.roadCellsAfter}, `
    + `${tl.zonedBefore} zoned -> ${tl.zonedAfter}, `
    + `${tl.lotsBefore} lots -> ${tl.lotsAfter} from a drawer of ${tl.drawerSize}`);
}

const cv = result.curve;
if (!cv || cv.error) {
  push(`curve tool failed: ${cv?.error ?? 'no result'}`);
} else {
  if (cv.links !== 2) push(`curve tool laid ${cv.links} roads where five clicks should lay 2`);
  if (cv.bowed !== cv.links) {
    push(`${cv.links - cv.bowed} of ${cv.links} curved roads came out straight`);
  }
  // Two segments clicked end to start are one run: three nodes, and only the
  // two ends of the run are dead ends. Four would mean the chain broke and the
  // player is looking at two roads that merely finish near each other.
  if (cv.deadEnds !== 2) {
    push(`a chained run left ${cv.deadEnds} loose ends where it should leave 2`);
  }
  if (cv.nodes !== 3) push(`a chained run made ${cv.nodes} nodes where it should make 3`);
  console.log(`curve    ${cv.links} roads, ${cv.nodes} nodes, ${cv.deadEnds} loose ends, `
    + `bowed up to ${cv.longest.toFixed(0)} m off the chord`);
}

for (const view of ['far', 'near']) {
  const s = result[view]?.stats;
  if (s) {
    console.log(`${view.padEnd(5)} ${Object.entries(s).map(([k, v]) => `${k} ${v}`).join('  ')}`);
  }
}

if (fails.length) {
  console.error('\nFAIL\n' + fails.map((f) => '  - ' + f).join('\n'));
  console.error('\n' + logs.slice(-15).join('\n'));
  process.exitCode = 1;
} else {
  console.log('\nPASS  the real renderer builds, culls, picks levels of detail, and draws a city');
}

await browser.close();
server.close();
