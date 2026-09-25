/**
 * The long game: a bot plays a city from bare ground on each difficulty, and
 * the curves are printed and checked.
 *
 * Every other test asks one question of one system. This one asks whether the
 * game as a whole can be played: does a city that is run sensibly grow, stay
 * solvent and climb the levels, and is each difficulty harder than the last
 * without being impossible. It pays for everything at the game's own prices
 * through the game's own treasury, and it only does what a player could do:
 *
 *   - builds streets a block at a time, buying the land under them;
 *   - keeps power, water and sewage ahead of what the city draws;
 *   - zones whatever the demand bars are asking for;
 *   - buys development nodes with its stars, and puts up services as the
 *     levels open them, wherever coverage has fallen behind.
 *
 * It is not a good player -- it does not plan districts or chase land value --
 * which is the point: if a plain, sensible player cannot keep a city alive on
 * Standard, a real one will not enjoy trying.
 *
 *   node tools/long-game.mjs [days] [difficulty...]
 */
import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { Simulation } from '${src}sim/agents/sim';`,
      `export { makeCity } from '${src}sim/city';`,
      `export { emptyWorld, paint, zoneCode, placeLot } from '${src}sim/world';`,
      `export { buildingPrice, roadPrice, zonePrice } from '${src}sim/costs';`,
      `export { assetById } from '${src}assets/registry';`,
      `export { plotAtWorld, PLOTS } from '${src}sim/plots';`,
      `export { TICKS_PER_DAY } from '${src}sim/agents/calendar';`,
      `export { configureSim } from '${src}sim/config';`,
      `export { useDifficulty, RULES } from '${src}sim/difficulty';`,
      `export { NODE_OF_ASSET, TECH_BY_ID, branchLevel, landmarksForLevel } from '${src}sim/tech';`,
      `export { Util } from '${src}sim/agents/utilities';`,
      `export { BRANCHES } from '${src}assets/types';`,
      `export { OVERDRAFT } from '${src}sim/budget';`,
      `export { useMap } from '${src}sim/maps';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022', loader: { '.wgsl': 'text' },
})).outputFiles[0].text;
const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));

const DAYS = Number(process.argv[2] ?? 90);
const WHICH = process.argv.slice(3).length > 0 ? process.argv.slice(3) : ['relaxed', 'standard', 'hard'];
const GRID = 640;
M.configureSim({ cityGrid: GRID, terrainSize: 9216 });
// Any of the starting maps: MAP=saltmere node tools/long-game.mjs ...
if (process.env.MAP) M.useMap(process.env.MAP);

/** Streets every 120 m, blocks between them. */
const STEP = 120;
const HALF = 6;
const cellOf = (m) => Math.floor(m / 8 + GRID / 2);

/**
 * The services the bot keeps up, in the order it reaches for them: the
 * cheapest building that does the job, and how many residents one covers.
 */
const SERVICES = [
  { branch: 'fire', id: 'svc.fire.house', per: 6000 },
  { branch: 'health', id: 'svc.health.clinic', per: 7000 },
  { branch: 'parks', id: 'svc.parks.playground', per: 4000 },
  { branch: 'police', id: 'svc.police.post', per: 6000 },
  { branch: 'education', id: 'svc.edu.primary', per: 8000 },
  { branch: 'deathcare', id: 'svc.death.director', per: 15000 },
];

function play(difficulty) {
  const R = M.useDifficulty(difficulty);
  const world = M.emptyWorld(GRID);
  world.budget.balance = R.funds;
  world.grown.fill(0);
  const sim = new M.Simulation(M.makeCity(world), world.net, 0x10a6, world);
  sim.found(30);

  const blocks = [];
  for (let i = -HALF; i < HALF; i++) {
    for (let j = -HALF; j < HALF; j++) blocks.push({ i, j, use: null });
  }
  // Nearest the middle first, which is how a town grows.
  blocks.sort((a, b) => Math.hypot(a.i + 0.5, a.j + 0.5) - Math.hypot(b.i + 0.5, b.j + 0.5));
  const built = new Set();
  const log = [];
  let spentOnRoads = 0, spentOnServices = 0, spentOnZoning = 0, spentOnLand = 0;
  let roadsDirty = false, lotsDirty = false;
  const placed = { power: 0, water: 0 };
  const reasons = {};
  const services = Object.fromEntries(SERVICES.map((s) => [s.branch, 0]));
  let lowest = world.budget.balance;
  let broke = 0;

  const spend = (cost) => world.budget.spend(cost);
  const earn = (price) => {
    const p = world.progress;
    p.add(p.forBuilding(price, false), 'build', M.landmarksForLevel);
  };

  /** Streets round a block, and the land under it, if the city can pay. */
  function open(block) {
    const x0 = block.i * STEP, z0 = block.j * STEP, x1 = x0 + STEP, z1 = z0 + STEP;
    const plots = new Set([[x0 + 4, z0 + 4], [x1 - 4, z1 - 4], [x0 + 4, z1 - 4], [x1 - 4, z0 + 4]]
      .map(([x, z]) => M.plotAtWorld(GRID, x, z)));
    let landCost = 0;
    for (const p of plots) {
      if (world.land.owns(p)) continue;
      if (!world.land.canBuy(p)) return false;
      landCost += world.land.price();
    }
    const edges = [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]]
      .filter((e) => !built.has(e.join()));
    const roadCost = edges.length * STEP * M.roadPrice('street');
    if (world.budget.balance - roadCost - landCost < 15000) return false;
    for (const p of plots) {
      if (!world.land.owns(p)) { spend(world.land.price()); world.land.take(p); }
    }
    spentOnLand += landCost;
    for (const e of edges) { world.net.add(e[0], e[1], e[2], e[3], 'street'); built.add(e.join()); }
    spend(roadCost);
    spentOnRoads += roadCost;
    roadsDirty = true;
    return true;
  }

  function inner(block) {
    const g0x = cellOf(block.i * STEP) + 2, g0z = cellOf(block.j * STEP) + 2;
    return [g0x, g0z, STEP / 8 - 3, STEP / 8 - 3];
  }

  function nextBlock(use) {
    // A service block with room goes first for services, so they cluster.
    if (use === 'service') {
      const open0 = blocks.find((b) => b.use === 'service' && (b.slots ?? 0) < 4);
      if (open0) return open0;
    }
    for (const b of blocks) {
      if (b.use !== null) continue;
      if (!open(b)) return null;
      b.use = use;
      return b;
    }
    return null;
  }

  function zone(kind) {
    const b = nextBlock(kind);
    if (b === null) return false;
    const [gx, gz, w, d] = inner(b);
    const cost = w * d * M.zonePrice(kind, 'low');
    if (!spend(cost)) { b.use = null; return false; }
    spentOnZoning += cost;
    M.paint(world, gx, gz, w, d, M.zoneCode(kind, 'low'));
    world.painted++;
    return true;
  }

  /** Puts one building in a service block, wherever it fits. */
  function place(id) {
    const def = M.assetById(id);
    const price = M.buildingPrice(def);
    if (world.budget.balance - price < 5000) return false;
    const node = M.NODE_OF_ASSET.get(id);
    if (node !== undefined && !node.free && !world.progress.has(node.id)) {
      if (world.progress.level < M.branchLevel(node.branch)) return false;
      for (const need of node.needs) {
        if (!world.progress.has(need) && M.TECH_BY_ID.get(need)?.free !== true) return false;
      }
      if (!world.progress.buy(node.id, node.cost)) return false;
    }
    for (let tries = 0; tries < 6; tries++) {
      const b = nextBlock('service');
      if (b === null) return false;
      const [gx, gz, w, d] = inner(b);
      for (let dz = 0; dz < d; dz += 2) {
        for (let dx = 0; dx < w; dx += 2) {
          for (const yaw of [0, 1, 2, 3]) {
            const why = M.placeLot(world, id, gx + dx, gz + dz, yaw);
            if (why !== null) { reasons[why] = (reasons[why] ?? 0) + 1; continue; }
            {
              spend(price);
              spentOnServices += price;
              earn(price);
              b.slots = (b.slots ?? 0) + 1;
              lotsDirty = true;
              return true;
            }
          }
        }
      }
      b.slots = 99;
    }
    return false;
  }

  const CHUNK = 32;
  for (let day = 1; day <= DAYS; day++) {
    for (let t = 0; t < M.TICKS_PER_DAY; t += CHUNK) {
      sim.step(CHUNK);
      const grew = sim.grew();
      if (grew !== null) sim.buildingsChanged(M.makeCity(world, grew));
    }
    const p = world.progress;
    p.add(p.forCitizens(sim.people.population), 'people', M.landmarksForLevel);
    // As the game does: an emergency starts once its service can be built.
    const town = sim.people.population >= M.RULES.quiet * 0.5;
    sim.dispatch.exposed[0] = town && p.level >= M.branchLevel('fire');
    sim.dispatch.exposed[1] = town && p.level >= M.branchLevel('police');
    sim.dispatch.exposed[2] = town && p.level >= M.branchLevel('health');

    // ---- the player's turn, once a day --------------------------------------
    const u = sim.utilities.report;
    const pop = sim.people.population;
    // Utilities first: a margin under 1.2 gets another plant.
    if (placed.power === 0 || u.margin[M.Util.POWER] < 1.35) {
      if (place(pop > 6000 && world.budget.balance > 400000 ? 'svc.power.gas' : 'svc.power.solar')) placed.power++;
    }
    if (placed.water === 0 || u.margin[M.Util.WATER] < 1.35 || u.margin[M.Util.SEWAGE] < 1.35) {
      if (place('svc.water.treatment')) placed.water++;
    }
    // Services: one per `per` residents, as the level allows.
    for (const s of SERVICES) {
      if (p.level < M.branchLevel(s.branch)) continue;
      // None until the town is big enough to have the problems they answer.
      const need = pop < M.RULES.quiet * 0.5 ? 0 : 1 + Math.floor(pop / s.per);
      if (services[s.branch] < need && place(s.id)) services[s.branch]++;
    }
    // Zoning: whatever is wanted, if the last lot has mostly built out.
    let waiting = 0;
    for (let i = 0; i < world.zones.length; i++) if (world.zones[i] !== 0 && world.grown[i] === 0) waiting++;
    // Only with money in hand after the essentials: a player who zones with the
    // last of the treasury cannot pay for the plant the new houses will need.
    if (waiting < 150 && world.budget.balance > 30000) {
      const want = sim.demand.want;
      const order = [['residential', want[0]], ['commercial', want[1]], ['industrial', want[2]]]
        .sort((a, b) => b[1] - a[1]);
      if (order[0][1] > 0.15) zone(order[0][0]);
    }
    if (roadsDirty) {
      world.net.rasterise();
      world.mains.layEverywhere(world.net);
      sim.roadsChanged(world.net, world);
      roadsDirty = false;
      lotsDirty = true;
    }
    if (lotsDirty) {
      sim.buildingsChanged(M.makeCity(world));
      lotsDirty = false;
    }
    lowest = Math.min(lowest, world.budget.balance);
    if (world.budget.balance < -M.OVERDRAFT * 0.9) broke++;
    if (day % 10 === 0 || day === 1) {
      const e = sim.economy.report;
      const d = sim.dispatch.stats;
      log.push({
        day, pop, level: p.level, balance: Math.round(world.budget.balance), net: Math.round(e.net),
        happy: Math.round(sim.people.happiness * 100), fires: d.raised[0], crimes: d.raised[1],
        missed: d.missed[0] + d.missed[1] + d.missed[2], stars: p.stars,
        homes: sim.places.homeCapacity, waiting,
        want: Array.from(sim.demand.want).map((x) => x.toFixed(2)).join('/'),
        served: [0, 1, 2].map((k) => Math.round(u.served[k] * 100)).join('/'),
        income: Math.round(e.income), spend: Math.round(e.spending), svc: Math.round(e.services),
        ledger: Object.fromEntries(Object.entries(e).filter(([, v]) => typeof v === 'number' && Math.abs(v) > 50)
          .map(([k, v]) => [k, Math.round(v)])),
      });
      if (process.env.VERBOSE) console.log('   ', JSON.stringify(log[log.length - 1]));
    }
  }
  return {
    difficulty, log, lowest, broke,
    final: log[log.length - 1],
    spent: { roads: spentOnRoads, land: spentOnLand, zoning: spentOnZoning, services: spentOnServices },
    services, placed, reasons,
  };
}

const results = [];
for (const d of WHICH) {
  const t0 = Date.now();
  const r = play(d);
  results.push(r);
  console.log(`\n== ${d.toUpperCase()}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  console.log('  day    pop  lvl   balance    net/wk  happy  fires crimes missed');
  for (const l of r.log) {
    console.log(`  ${String(l.day).padStart(3)} ${String(l.pop).padStart(6)} ${String(l.level).padStart(4)}`
      + ` ${String(l.balance).padStart(9)} ${String(l.net).padStart(9)} ${String(l.happy).padStart(5)}%`
      + ` ${String(l.fires).padStart(6)} ${String(l.crimes).padStart(6)} ${String(l.missed).padStart(6)}`);
  }
  console.log(`  lowest balance ${Math.round(r.lowest)}; spent roads ${Math.round(r.spent.roads)},`
    + ` land ${Math.round(r.spent.land)}, zoning ${Math.round(r.spent.zoning)},`
    + ` services ${Math.round(r.spent.services)}; plants ${JSON.stringify(r.placed)};`
    + ` services ${JSON.stringify(r.services)}`);
  console.log('  refusals', JSON.stringify(r.reasons).slice(0, 300));
}

// ---- what must hold -----------------------------------------------------------
let failed = 0;
const check = (ok, what) => { if (!ok) { failed++; console.log(`FAIL  ${what}`); } else console.log(`ok    ${what}`); };
const by = Object.fromEntries(results.map((r) => [r.difficulty, r]));
for (const r of results) {
  check(r.broke === 0, `${r.difficulty}: a sensible player never sits at the overdraft limit`);
  // Hard is meant to be a squeeze, so its bar is lower -- but it has to grow.
  const bar = r.difficulty === 'hard' ? 300 : 1000;
  check(r.final.pop > bar, `${r.difficulty}: the city grows past ${bar} (${r.final.pop})`);
}
if (by.relaxed && by.standard) {
  check(by.relaxed.final.pop >= by.standard.final.pop * 0.9, 'relaxed grows at least as well as standard');
}
if (by.standard && by.hard) {
  check(by.hard.final.pop < by.standard.final.pop, 'hard grows slower than standard');
}
console.log(failed === 0 ? '\nLONG_GAME_OK' : `\nLONG_GAME: ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
