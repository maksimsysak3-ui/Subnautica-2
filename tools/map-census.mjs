#!/usr/bin/env node
/**
 * Brick census.
 *
 * Runs both site builders through Vite's SSR loader — no browser, no GPU — and
 * reports the numbers a map critic actually uses: how many bricks exist, what
 * SIZE they are, and how much of the ground plane has something on it.
 *
 * The size distribution is the important one. A map is not "lazy" because it
 * has too few objects; it is lazy because the objects are the wrong size. The
 * reference distribution for exterior geometry is roughly
 *
 *   tier 1  (> 6 m)          5-10%    massing
 *   tier 2  (0.4 - 6 m)      25-35%   furniture and structure
 *   tier 3  (< 0.4 m)        55-70%   the detail your eye lands on at 3 m
 *
 * This project measured 0.7% and 0.04% in tier 3. That is the whole finding.
 */
import { createServer } from 'vite';

const server = await createServer({
  root: process.cwd(), configFile: 'vite.config.ts',
  server: { middlewareMode: true }, logLevel: 'error', appType: 'custom',
});

const { Brickyard } = await server.ssrLoadModule('/src/world/brickyard.ts');
const { SiteBuilder } = await server.ssrLoadModule('/src/world/builder.ts');
const { Rng, Noise2D } = await server.ssrLoadModule('/src/core/math.ts');
const { buildVilla } = await server.ssrLoadModule('/src/world/sites/villa.ts');
const { buildQuay } = await server.ssrLoadModule('/src/world/sites/quay.ts');
const { buildOutskirts } = await server.ssrLoadModule('/src/world/sites/outskirts.ts');

const census = (name, fn) => {
  const rng = new Rng(`world:${name}`);
  const noise = new Noise2D('black-meridian-terrain');
  const yard = new Brickyard();
  const b = new SiteBuilder(yard, rng);
  const terrain = (x, z) => {
    const s = 0.0022;
    let h = noise.fbm(x * s, z * s, 5, 2.1, 0.5) * 26;
    h += noise.ridged(x * s * 2.4 + 100, z * s * 2.4 - 40, 3, 2.3, 0.5) * 9;
    return h;
  };
  fn(b, rng, terrain);

  // The yard is a struct-of-arrays, not a list of objects.
  const n = yard.count;
  const tiers = { t3: 0, t2: 0, t1: 0 };
  const mats = new Set();
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < n; i++) {
    const longest = Math.max(yard.hx[i], yard.hy[i], yard.hz[i]) * 2;
    if (longest < 0.4) tiers.t3++;
    else if (longest <= 6) tiers.t2++;
    else tiers.t1++;
    mats.add(yard.mat[i]);
    minX = Math.min(minX, yard.px[i]); maxX = Math.max(maxX, yard.px[i]);
    minZ = Math.min(minZ, yard.pz[i]); maxZ = Math.max(maxZ, yard.pz[i]);
  }
  const area = Math.max(1, (maxX - minX) * (maxZ - minZ));
  return {
    name, bricks: n, materials: mats.size,
    area: Math.round(area),
    per100: ((n / area) * 100).toFixed(1),
    t3: ((tiers.t3 / n) * 100).toFixed(1),
    t2: ((tiers.t2 / n) * 100).toFixed(1),
    t1: ((tiers.t1 / n) * 100).toFixed(1),
  };
};

const rows = [
  census('villa', (b, rng, terrain) => { buildVilla(b, rng); buildOutskirts(b, rng, terrain); }),
  census('quay', (b, rng, terrain) => buildQuay(b, rng, terrain)),
];

console.log('\nsite    bricks   mats   area m2   /100m2    tier3    tier2    tier1');
for (const r of rows) {
  console.log(
    `${r.name.padEnd(7)} ${String(r.bricks).padStart(6)} ${String(r.materials).padStart(6)} `
    + `${String(r.area).padStart(9)} ${r.per100.padStart(8)} `
    + `${(r.t3 + '%').padStart(8)} ${(r.t2 + '%').padStart(8)} ${(r.t1 + '%').padStart(8)}`,
  );
}
console.log('\nreference tier split: t3 55-70%, t2 25-35%, t1 5-10%\n');
await server.close();
