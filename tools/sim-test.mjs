/**
 * The simulation's foundations, checked.
 *
 * Three things have to be right before anything is built on them, and all three
 * fail silently if they are not. A table that hands out a row twice corrupts
 * whichever citizen loses the race, and nothing crashes. A scheduler whose
 * staggered buckets do not cover every entity leaves a tenth of the city frozen
 * forever, and nothing crashes. A lane graph with an illegal movement in it
 * gives cars a route that drives into oncoming traffic, and nothing crashes --
 * it just produces a city that is subtly wrong in a way no screenshot shows.
 *
 * So this asserts the invariants directly, on a road network the size of a real
 * city, and prints what the structures cost.
 *
 *   node tools/sim-test.mjs [grid]
 */

import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export * from '${src}sim/agents/store';`,
      `export * from '${src}sim/agents/tick';`,
      `export * from '${src}sim/agents/lanes';`,
      `export { RoadGraph, ROAD_SPECS, ROAD_ORDER } from '${src}sim/roadgraph';`,
      `export { configureSim, simConfig } from '${src}sim/config';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022',
})).outputFiles[0].text;

const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));
const {
  Table, NO_HANDLE, handleId, handleGen,
  Scheduler, Rate, due, slice, TICK_HZ,
  buildLaneGraph, laneBytes, Use, Turn, FORWARD, BACKWARD,
  RoadGraph, ROAD_SPECS,
} = M;

let failed = 0, checks = 0;
const ok = (cond, what, detail = '') => {
  checks++;
  if (!cond) { failed++; console.log(`  FAIL  ${what}${detail ? '  -- ' + detail : ''}`); }
};
const section = (name) => console.log(`\n${name}`);
const ms = (n) => `${n.toFixed(1)} ms`;
const kib = (n) => `${(n / 1024).toFixed(0)} KiB`;

// ---------------------------------------------------------------- the store

section('store');
{
  const T = new Table({ x: Float32Array, kind: Uint8Array }, 4);

  // Ids are handed out, returned, and handed out again -- and never twice at
  // once, which is the fault that silently shares one citizen between two
  // households.
  const ids = [];
  for (let i = 0; i < 1000; i++) { const id = T.add(); T.col.x[id] = i; ids.push(id); }
  ok(new Set(ids).size === 1000, 'add never returns a live id');
  ok(T.size === 1000, 'size counts live rows', `${T.size}`);
  ok(T.bound === 1000, 'bound is one past the highest id', `${T.bound}`);
  ok(T.capacity >= 1000, 'grew past its initial capacity', `${T.capacity}`);
  ok(ids.every((id, i) => T.col.x[id] === i), 'growth preserved every column');

  // A handle taken before a row was freed must not resolve to whoever got the
  // row next. This is the one thing generation tags exist for.
  const h = T.handle(ids[500]);
  ok(T.valid(h) && T.deref(h) === ids[500], 'a handle resolves to its row');
  T.remove(ids[500]);
  ok(!T.valid(h) && T.deref(h) === -1, 'a handle to a removed row is stale');
  const reused = T.add();
  ok(reused === ids[500], 'the free list hands the row back', `${reused}`);
  ok(!T.valid(h), 'the old handle does not resolve to the new occupant');
  ok(T.valid(T.handle(reused)), 'the new occupant has a valid handle');
  ok(!T.valid(NO_HANDLE), 'NO_HANDLE is never valid');

  // Generation wraps at 256; a handle that survives exactly 256 removals is
  // indistinguishable from a fresh one. Known and bounded -- a handle is meant
  // to be checked, not stored for an hour -- but it must not be worse than that.
  let wrapped = T.add();
  const first = T.handle(wrapped);
  for (let i = 0; i < 255; i++) { T.remove(wrapped); wrapped = T.add(); }
  ok(handleId(first) === wrapped, 'the row cycles back to the same id');
  ok(!T.valid(first), '255 removals later the handle is still stale');
  T.remove(wrapped); wrapped = T.add();
  ok(T.valid(first), 'generation wraps at 256, as documented');
  ok(handleGen(first) === 0, 'the first handle was generation 0');

  // Removing what is not there must not corrupt the free list.
  const before = T.size;
  T.remove(-1); T.remove(99999); T.remove(ids[500]); T.remove(ids[500]);
  ok(T.size === before - 1, 'a double remove frees one row', `${T.size} vs ${before - 1}`);

  T.col.x[ids[0]] = 7; T.clear(ids[0]);
  ok(T.col.x[ids[0]] === 0, 'clear zeroes a row');

  // What a metropolis of citizens actually costs, on the real schema shape.
  const Citizens = new Table({
    home: Int32Array, work: Int32Array, age: Uint8Array, health: Uint8Array,
    education: Uint8Array, wealth: Uint8Array, mood: Uint8Array, state: Uint8Array,
    x: Float32Array, z: Float32Array, vehicle: Int32Array, path: Int32Array,
  }, 1 << 17);
  const t0 = performance.now();
  for (let i = 0; i < 100_000; i++) Citizens.add();
  const spawn = performance.now() - t0;
  console.log(`  100,000 citizens   ${kib(Citizens.bytes())}  spawned in ${ms(spawn)}`);
  ok(spawn < 60, '100k spawns inside a frame budget', ms(spawn));
  ok(Citizens.bytes() / 100_000 < 48, 'under 48 bytes a citizen',
    `${(Citizens.bytes() / 100_000).toFixed(1)}`);

  // A full walk of the table is the shape every system's inner loop has, so it
  // is worth knowing what one costs before there are thirty of them -- and worth
  // knowing what it costs done wrong. Reaching through `col` inside the loop is
  // a property lookup per element; hoisting the column is the usage every
  // system is expected to follow, and the gap between the two numbers is why.
  const walkOnce = () => {
    const live = Citizens.live, age = Citizens.col.age, n = Citizens.bound;
    let sum = 0;
    for (let i = 0; i < n; i++) if (live[i]) sum += age[i];
    return sum;
  };
  for (let i = 0; i < 20; i++) walkOnce();          // let the compiler settle
  const t1 = performance.now();
  for (let pass = 0; pass < 200; pass++) walkOnce();
  const walk = (performance.now() - t1) / 200;
  console.log(`  one full walk      ${walk.toFixed(3)} ms over 100,000 rows`);
  ok(walk < 0.5, 'a full walk of 100k rows is a fraction of a millisecond', ms(walk));
}

// ------------------------------------------------------------ the scheduler

section('scheduler');
{
  // Staggering must partition: over one period of a rate, every id is due
  // exactly once. If it does not partition, some citizens are updated twice as
  // often as others and some never at all, and the city looks fine.
  for (const rate of [Rate.FAST, Rate.BRISK, Rate.STEADY, Rate.SLOW, Rate.GLACIAL]) {
    let worst = 0, best = 99;
    for (let id = 0; id < 2048; id++) {
      let n = 0;
      for (let t = 0; t < rate; t++) if (due(id, t, rate)) n++;
      worst = Math.max(worst, n); best = Math.min(best, n);
    }
    ok(worst === 1 && best === 1, `rate ${rate} is due exactly once a period`,
      `min ${best} max ${worst}`);
  }

  // And the slice must name the same set the mask does, or a system that walks
  // by slice and a system that tests by due() disagree about who is current.
  for (const rate of [Rate.BRISK, Rate.STEADY]) {
    for (let t = 0; t < rate; t++) {
      const { start, stride } = slice(t, rate);
      let mismatch = 0;
      for (let id = start; id < 4096; id += stride) if (!due(id, t, rate)) mismatch++;
      ok(mismatch === 0, `slice agrees with due at rate ${rate}`, `tick ${t}`);
    }
  }

  // The fixed step must not chase real time when it cannot keep up: a heavy
  // frame must drop ticks rather than run a hundred of them and freeze.
  const s = new Scheduler();
  let ran = 0;
  s.add({ name: 'count', rate: Rate.REALTIME, run: () => { ran++; } });
  // A second of sixty-hertz frames, which is what the game actually does.
  // Ten seconds rather than one, because a fixed step driven by a float frame
  // time is allowed to land a tick either side of the boundary; what it is not
  // allowed to do is drift.
  const run = (sch, secs, speed) => {
    for (let f = 0; f < 60 * secs; f++) sch.advance(1 / 60, speed, 0);
  };
  run(s, 10, 1);
  ok(Math.abs(ran - TICK_HZ * 10) <= 1, 'ten seconds of frames is TICK_HZ ticks a second',
    `${ran} vs ${TICK_HZ * 10}`);
  ran = 0; run(s, 10, 2);
  ok(Math.abs(ran - TICK_HZ * 20) <= 1, 'speed 2 doubles the ticks', `${ran}`);
  ran = 0; run(s, 10, 0);
  ok(ran === 0, 'speed 0 is a pause, not a slow crawl', `${ran}`);
  ran = 0; run(s, 1, 1);
  ok(ran <= TICK_HZ + 1, 'and unpausing does not release a flood of owed ticks', `${ran}`);

  // A frame that took thirty seconds -- a tab restored, a shader compiled -- must
  // drop the debt instead of running three hundred ticks and stalling again.
  ran = 0; const dropped0 = s.dropped; s.advance(30, 1, 0);
  ok(ran <= 8, 'a thirty-second stall does not run three hundred ticks', `${ran}`);
  ok(s.dropped > dropped0, 'and says how much it dropped', `${s.dropped - dropped0}`);
  ran = 0; s.advance(1 / 60, 1, 0);
  ok(ran <= 1, 'the frame after a stall is normal again', `${ran}`);

  // A system at a slow rate must run once a period, and slow systems must not
  // all land on the same tick -- that tick would be the worst frame of the
  // minute, which is exactly the stutter this is all meant to avoid.
  const s2 = new Scheduler();
  const hits = [];
  s2.add({ name: 'slow', rate: Rate.STEADY, run: (t) => { hits.push(t); } });
  const fires = new Map();
  for (const name of ['police', 'garbage', 'water', 'power', 'schools', 'health']) {
    s2.add({ name, rate: Rate.SLOW, run: (t) => { fires.set(t, (fires.get(t) ?? 0) + 1); } });
  }
  const periods = 4;
  const wanted = Rate.SLOW * periods;
  for (let t = 0; t < wanted; t++) s2.advance(1 / TICK_HZ, 1, 0);
  const ticks = s2.tick;
  ok(Math.abs(ticks - wanted) <= 1, 'the scheduler ran the ticks it was given',
    `${ticks} vs ${wanted}`);
  ok(hits.length === Math.floor(ticks / Rate.STEADY),
    'a STEADY system runs once per 32 ticks', `${hits.length} over ${ticks} ticks`);
  const gaps = hits.slice(1).map((t, i) => t - hits[i]);
  ok(gaps.every((d) => d === Rate.STEADY), 'evenly spaced', gaps.join(','));
  ok(s2.names.includes('slow'), 'the scheduler reports its systems');
  const worstTick = Math.max(...fires.values());
  ok(worstTick <= 2, 'slow systems are spread across the period, not stacked',
    `worst tick ran ${worstTick} of 6`);
  const total = [...fires.values()].reduce((a, b) => a + b, 0);
  ok(total >= 6 * (periods - 1), 'and every one of them still ran every period', `${total}`);
}

// ------------------------------------------------------------ the lane graph

section('lane graph');
{
  const grid = Number(process.argv[2] || 0) || 640;
  const net = new RoadGraph(grid);

  // A city, not a test fixture: a motorway across it, arterials on a coarse
  // grid, streets filling the blocks, a few curves, and some dead-end cul-de-sacs
  // -- because the dead end is where the U-turn rule is load-bearing.
  const span = grid * 8 * 0.42;
  const t0 = performance.now();
  net.add(-span, -span * 0.2, span, span * 0.2, 'motorway', 0.18);
  for (let i = -4; i <= 4; i++) {
    const c = (i / 4) * span;
    net.add(c, -span, c, span, i % 2 === 0 ? 'avenue' : 'boulevard', i * 0.02);
    net.add(-span, c, span, c, i % 3 === 0 ? 'dual' : 'street', 0);
  }
  for (let i = -12; i <= 12; i++) {
    const c = (i / 12) * span * 0.9;
    net.add(c, -span * 0.9, c, span * 0.9, i % 4 === 0 ? 'oneway' : 'street', 0);
  }
  // Cul-de-sacs, hanging off the last arterial.
  let culs = 0;
  for (let i = 0; i < 24; i++) {
    const y = -span * 0.9 + (i / 24) * span * 1.8;
    net.add(span * 0.9, y, span * 0.9 + 90, y, 'lane', 0);
    culs++;
  }
  // A pedestrian street and a cycle path, so the use masks are exercised.
  net.add(-span * 0.3, span * 0.5, span * 0.3, span * 0.5, 'pedestrian', 0);
  net.add(-span * 0.3, span * 0.6, span * 0.3, span * 0.6, 'path', 0);
  const laid = performance.now() - t0;

  const t1 = performance.now();
  const g = buildLaneGraph(net);
  const built = performance.now() - t1;

  console.log(`  network            ${net.links.length.toLocaleString()} links, `
    + `${net.nodes.length.toLocaleString()} nodes, laid in ${ms(laid)}`);
  console.log(`  lanes              ${g.count.toLocaleString()}`);
  console.log(`  movements          ${g.edgeCount.toLocaleString()} `
    + `(${(g.edgeCount / Math.max(1, g.count)).toFixed(1)} a lane)`);
  console.log(`  memory             ${kib(laneBytes(g))} `
    + `(${(laneBytes(g) / Math.max(1, g.count)).toFixed(0)} bytes a lane)`);
  console.log(`  built in           ${ms(built)}`);

  ok(g.count > 0, 'the graph has lanes');
  ok(built < 250, 'a whole-network rebuild stays inside a fifth of a second', ms(built));

  // Structure. A CSR whose ranges are not contiguous and ascending is a graph
  // whose edges belong to the wrong nodes, and it will still traverse.
  let bad = 0, gaps = 0, backwards = 0;
  for (let l = 0; l < g.count; l++) {
    if (g.edgeStart[l] > g.edgeEnd[l]) backwards++;
    if (l > 0 && g.edgeStart[l] !== g.edgeEnd[l - 1]) gaps++;
    for (let e = g.edgeStart[l]; e < g.edgeEnd[l]; e++) {
      if (g.edgeTo[e] < 0 || g.edgeTo[e] >= g.count) bad++;
    }
  }
  ok(backwards === 0, 'every edge range is ascending', `${backwards}`);
  ok(gaps === 0, 'the CSR is contiguous', `${gaps}`);
  ok(bad === 0, 'every movement leads to a lane that exists', `${bad}`);
  ok(g.edgeEnd[g.count - 1] === g.edgeCount, 'the last range ends at the edge count');

  // Which nodes are dead ends, straight off the road graph -- an independent
  // answer to the one the lane builder worked out for itself.
  const ends = new Set();
  for (let n = 0; n < net.nodes.length; n++) {
    if (new Set(net.armsOf(n)).size < 2) ends.add(n);
  }

  // Connectivity of the movement graph itself: a lane arriving somewhere must
  // continue somewhere, or a route can enter it and be trapped. There is exactly
  // one lane that may legitimately be a trap -- a one-way road that dead-ends,
  // where turning round would mean driving the wrong way up it. That is a real
  // road layout and the graph should say so rather than inventing a movement;
  // anything else is a bug.
  let stranded = 0, strandedExample = -1, oneWayEnd = 0;
  for (let l = 0; l < g.count; l++) {
    if (g.edgeEnd[l] !== g.edgeStart[l]) continue;
    const cls = net.links[g.link[l]].cls;
    if (ROAD_SPECS[cls].oneWay && ends.has(g.to[l])) { oneWayEnd++; continue; }
    stranded++; if (strandedExample < 0) strandedExample = l;
  }
  ok(stranded === 0, 'no lane is a trap with no way out',
    stranded ? `${stranded}, e.g. lane ${strandedExample} on a `
      + `${net.links[g.link[strandedExample]].cls}` : '');
  console.log(`  one-way dead ends  ${oneWayEnd} lanes (no legal turnaround, correctly)`);

  // Semantics. Each of these is a specific way a route can be wrong.
  let noShared = 0, wrongWay = 0, sameSide = 0, freeUturn = 0, negative = 0;
  let reversals = 0, mislabelled = 0;
  const turns = [0, 0, 0, 0];
  for (let l = 0; l < g.count; l++) {
    for (let e = g.edgeStart[l]; e < g.edgeEnd[l]; e++) {
      const o = g.edgeTo[e];
      if ((g.use[l] & g.use[o]) === 0) noShared++;
      if (g.from[o] !== g.to[l]) wrongWay++;
      if (g.link[l] === g.link[o] && g.dir[l] === g.dir[o]) sameSide++;
      // A reversal back down the link just travelled is the movement that must
      // not exist away from a dead end, or every junction in the city is a free
      // turnaround. A sharp turn between two *different* links may well be
      // classified U -- a hairpin is a legal movement -- so the test is on the
      // link, not on the turn kind.
      if (g.link[o] === g.link[l] && g.dir[o] !== g.dir[l]) {
        reversals++;
        if (!ends.has(g.to[l])) freeUturn++;
        if (g.edgeTurn[e] !== Turn.U) mislabelled++;
      }
      if (g.edgeCost[e] < 0) negative++;
      turns[g.edgeTurn[e]]++;
    }
  }
  ok(noShared === 0, 'no movement joins lanes with no user in common', `${noShared}`);
  ok(wrongWay === 0, 'every movement starts where the last one ended', `${wrongWay}`);
  ok(sameSide === 0, 'no movement is a lane change dressed as a turn', `${sameSide}`);
  ok(freeUturn === 0, 'reversals exist only at dead ends', `${freeUturn}`);
  ok(mislabelled === 0, 'and every one of them is labelled a U-turn', `${mislabelled}`);
  ok(reversals >= culs, 'the cul-de-sacs can be turned round in',
    `${reversals} reversals for ${culs} dead ends`);
  ok(negative === 0, 'no movement costs negative time -- Dijkstra needs that', `${negative}`);
  console.log(`  turns              straight ${turns[0].toLocaleString()} `
    + `right ${turns[1].toLocaleString()} left ${turns[2].toLocaleString()} `
    + `u ${turns[3].toLocaleString()}`);

  // A gentle curve must not read as a turn. This is what the per-end tangents
  // are for, and getting it wrong makes every curved road cost a left turn to
  // drive along.
  {
    const curve = new RoadGraph(64);
    curve.add(-300, 0, 0, 0, 'avenue', 0);
    curve.add(0, 0, 300, 0, 'avenue', 0.35);       // a sweeping bend onward
    const cg = buildLaneGraph(curve);
    let bend = -1;
    for (let l = 0; l < cg.count; l++) {
      for (let e = cg.edgeStart[l]; e < cg.edgeEnd[l]; e++) {
        if (cg.link[l] !== cg.link[cg.edgeTo[e]] && cg.edgeTurn[e] !== Turn.U) {
          bend = Math.max(bend, cg.edgeTurn[e]);
        }
      }
    }
    ok(bend === Turn.STRAIGHT, 'a swept bend between two links is still straight',
      `turn kind ${bend}`);
  }

  // Use masks, at both ends. A motorway with a pedestrian on it and a cycle
  // path with a lorry on it are the same bug from opposite sides.
  let mwFoot = 0, pathCar = 0, pedCar = 0;
  for (let l = 0; l < g.count; l++) {
    const cls = net.links[g.link[l]].cls;
    if (cls === 'motorway' && (g.use[l] & Use.FOOT)) mwFoot++;
    if (cls === 'path' && (g.use[l] & Use.CAR)) pathCar++;
    if (cls === 'pedestrian' && (g.use[l] & Use.CAR)) pedCar++;
  }
  ok(mwFoot === 0, 'nobody walks on the motorway', `${mwFoot}`);
  ok(pathCar === 0, 'nobody drives down the cycle path', `${pathCar}`);
  ok(pedCar === 0, 'nobody drives down the pedestrian street', `${pedCar}`);

  // Lane counts and link ranges. A one-way link with a backward side would give
  // every alley two directions of travel, which is a city of head-on traffic.
  let wrongCount = 0, badRange = 0, oneWayBack = 0;
  for (let i = 0; i < net.links.length; i++) {
    const spec = ROAD_SPECS[net.links[i].cls];
    const want = Math.min(2, Math.max(1, spec.lanes));
    for (const d of [FORWARD, BACKWARD]) {
      const s0 = g.linkStart[i * 2 + d], s1 = g.linkEnd[i * 2 + d];
      if (s0 > s1 || s1 > g.count) badRange++;
      const n = s1 - s0;
      if (spec.oneWay && d === BACKWARD) { if (n !== 0) oneWayBack++; continue; }
      if (n !== want) wrongCount++;
      for (let l = s0; l < s1; l++) {
        if (g.link[l] !== i || g.dir[l] !== d) badRange++;
      }
    }
  }
  ok(wrongCount === 0, 'every link has the lanes its class says', `${wrongCount}`);
  ok(badRange === 0, 'every link range names its own lanes', `${badRange}`);
  ok(oneWayBack === 0, 'a one-way link has no backward lanes', `${oneWayBack}`);

  // Lane discipline is priced, not enforced: crossing the carriageway to turn
  // has to cost more than turning from the lane that serves it, or the whole
  // reason for routing over lanes is gone.
  let priced = 0, cheapWrong = 0;
  for (let l = 0; l < g.count; l++) {
    const link = g.link[l];
    const lanes = g.linkEnd[link * 2 + g.dir[l]] - g.linkStart[link * 2 + g.dir[l]];
    if (lanes < 2) continue;
    for (let e = g.edgeStart[l]; e < g.edgeEnd[l]; e++) {
      const t = g.edgeTurn[e];
      if (t !== Turn.LEFT) continue;
      // From the kerbside lane of a two-lane approach, a left turn crosses the
      // carriageway and must be dearer than the turn alone.
      const base = g.edgeCost[e];
      if (g.index[l] === 0) { priced++; if (base <= 6.0) cheapWrong++; }
    }
  }
  ok(priced > 0, 'there are kerbside left turns to price at all', `${priced}`);
  ok(cheapWrong === 0, 'a left turn from the kerbside lane costs extra', `${cheapWrong}`);

  // Cost sanity: free-flow time must match length over speed, because every
  // route's estimate is built out of it.
  let mismatched = 0;
  for (let l = 0; l < g.count; l++) {
    if (Math.abs(g.free[l] - g.length[l] / g.speed[l]) > 1e-3) mismatched++;
    if (!(g.length[l] > 0) || !(g.speed[l] > 0)) mismatched++;
  }
  ok(mismatched === 0, 'free-flow time is length over speed everywhere', `${mismatched}`);

  // And the rebuild must be stable: the same network twice must give the same
  // graph, or a road edit somewhere silently renumbers lanes somewhere else.
  const t2 = performance.now();
  const again = buildLaneGraph(net);
  const rebuilt = performance.now() - t2;
  console.log(`  warm rebuild       ${ms(rebuilt)}  (what a road edit costs)`);
  ok(rebuilt < 60, 'a warm rebuild is inside a handful of frames', ms(rebuilt));
  ok(again.count === g.count && again.edgeCount === g.edgeCount,
    'rebuilding the same network gives the same graph',
    `${again.count}/${again.edgeCount} vs ${g.count}/${g.edgeCount}`);
}

console.log(`\n${failed === 0 ? 'SIM_OK' : 'SIM_FAIL'}  ${checks - failed}/${checks} checks`);
process.exit(failed === 0 ? 0 : 1);
