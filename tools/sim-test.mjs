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
      `export * from '${src}sim/agents/path';`,
      `export * from '${src}sim/agents/router';`,
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
  buildLaneIndex, nearestLane, indexBytes,
  Pathfinder, Layer, Outcome, NO_PATH, profileOf,
  Router, PathStore, CACHE_MISS, MAX_PATH,
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

  // Generation wraps at 128; a handle that survives exactly 128 removals is
  // indistinguishable from a fresh one. Known and bounded -- a handle is meant
  // to be checked, not stored for an hour -- but it must not be worse than that.
  // And no handle is ever negative, whatever generation it is on, because every
  // validity test treats a negative as "none".
  let wrapped = T.add();
  const first = T.handle(wrapped);
  let negative = 0;
  for (let i = 0; i < 127; i++) {
    if (T.handle(wrapped) < 0) negative++;
    T.remove(wrapped); wrapped = T.add();
  }
  ok(negative === 0, 'no handle is ever negative, at any generation', `${negative}`);
  ok(handleId(first) === wrapped, 'the row cycles back to the same id');
  ok(!T.valid(first), '127 removals later the handle is still stale');
  T.remove(wrapped); wrapped = T.add();
  ok(T.valid(first), 'generation wraps at 128, as documented');
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

// ------------------------------------------------------------ the lane index

section('lane index');
{
  const net = new RoadGraph(640);
  const span = 640 * 8 * 0.4;
  for (let i = 0; i < 20; i++) {
    const c = -span + (i / 19) * 2 * span;
    net.add(c, -span, c, span, 'street', 0);
    net.add(-span, c, span, c, 'street', 0);
  }
  // One very long lane, which is the case a midpoint-bucketed index gets wrong.
  net.add(-span, span * 0.97, span, span * 0.97, 'motorway', 0);
  const g = buildLaneGraph(net);
  const t0 = performance.now();
  const ix = buildLaneIndex(g);
  const built = performance.now() - t0;
  console.log(`  index              ${ix.side}x${ix.side} cells of ${ix.cell} m, `
    + `${kib(indexBytes(ix))}, built in ${ms(built)}`);

  // Brute force is the oracle: for a sample of points, the index must name the
  // same lane the exhaustive search does.
  const brute = (x, z, use) => {
    let best = -1, bestD = Infinity;
    for (let l = 0; l < g.count; l++) {
      if ((g.use[l] & use) === 0) continue;
      const ax = g.ax[l], az = g.az[l], bx = g.bx[l], bz = g.bz[l];
      const dx = bx - ax, dz = bz - az, len = dx * dx + dz * dz;
      let t = len > 0 ? ((x - ax) * dx + (z - az) * dz) / len : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = ax + dx * t - x, qz = az + dz * t - z;
      const d = qx * qx + qz * qz;
      if (d < bestD) { bestD = d; best = l; }
    }
    return [best, Math.sqrt(bestD)];
  };
  let wrong = 0, worstOff = 0, tested = 0;
  let rng = 1;
  const rand = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 400; i++) {
    const x = (rand() * 2 - 1) * span, z = (rand() * 2 - 1) * span;
    const [want, wantD] = brute(x, z, Use.CAR);
    if (wantD > 380) continue;              // outside what the index is asked for
    tested++;
    const got = nearestLane(g, ix, x, z, Use.CAR);
    if (got < 0) { wrong++; continue; }
    const gx = g.ax[got], gz = g.az[got], hx = g.bx[got], hz = g.bz[got];
    const dx = hx - gx, dz = hz - gz, len = dx * dx + dz * dz;
    let t = len > 0 ? ((x - gx) * dx + (z - gz) * dz) / len : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = gx + dx * t - x, qz = gz + dz * t - z;
    const gotD = Math.hypot(qx, qz);
    if (gotD > wantD + 0.01) { wrong++; worstOff = Math.max(worstOff, gotD - wantD); }
    void want;
  }
  ok(tested > 200, 'the index was asked enough questions', `${tested}`);
  ok(wrong === 0, 'the index names the truly nearest lane every time',
    `${wrong} wrong, worst ${worstOff.toFixed(1)} m too far`);

  // And the long lane is findable from along its whole length, not just its middle.
  let missed = 0, probes = 0;
  for (let i = 1; i < 20; i++) {
    const x = -span + (i / 20) * 2 * span;
    // Away from the ends, where a cross street's own endpoint is genuinely the
    // nearer thing and the question stops being about the long lane.
    if (Math.abs(Math.abs(x) - span) < 120) continue;
    probes++;
    const l = nearestLane(g, ix, x, span * 0.97 + 3, Use.CAR, 60);
    if (l < 0 || net.links[g.link[l]].cls !== 'motorway') missed++;
  }
  ok(probes >= 15, 'the long lane was probed along its length', `${probes}`);
  ok(missed === 0, 'a long lane is in every cell it crosses', `${missed} of ${probes} points`);

  // Off the end of the world finds nothing rather than something absurd.
  ok(nearestLane(g, ix, 1e6, 1e6, Use.CAR) === -1, 'nothing is near nowhere');
  ok(nearestLane(g, ix, 0, 0, Use.TRAM) === -1, 'and nothing admits a tram here');
}

// ------------------------------------------------------------ routing

section('routing');
{
  // A denser city than the lane-graph section's, because routing is the part
  // whose cost depends on how much there is to search.
  const net = new RoadGraph(640);
  const span = 640 * 8 * 0.44;
  net.add(-span, -span * 0.15, span, span * 0.15, 'motorway', 0.12);
  net.add(-span * 0.15, -span, span * 0.15, span, 'motorway', -0.1);
  for (let i = 0; i < 9; i++) {
    const c = -span + (i / 8) * 2 * span;
    net.add(c, -span, c, span, i % 2 ? 'avenue' : 'boulevard', 0);
    net.add(-span, c, span, c, i % 2 ? 'dual' : 'avenue', 0);
  }
  for (let i = 0; i < 41; i++) {
    const c = -span * 0.98 + (i / 40) * 1.96 * span;
    net.add(c, -span * 0.98, c, span * 0.98, 'street', 0);
    net.add(-span * 0.98, c, span * 0.98, c, i % 7 === 3 ? 'oneway' : 'street', 0);
  }
  // Somewhere with no way in or out, to prove an unreachable route is cheap.
  net.add(span * 1.5, span * 1.5, span * 1.5 + 200, span * 1.5, 'street', 0);

  const g = buildLaneGraph(net);
  const ix = buildLaneIndex(g);
  const finder = new Pathfinder(g);
  console.log(`  network            ${net.links.length.toLocaleString()} links, `
    + `${g.count.toLocaleString()} lanes, ${g.edgeCount.toLocaleString()} movements`);
  console.log(`  scratch            ${kib(finder.bytes())}`);

  const out = new Int32Array(MAX_PATH);

  // --- the oracle: Dijkstra over the same cost model, no heuristic, no
  // --- hierarchy. Slow and obviously correct, which is the point of it.
  const dijkstra = (layer, from, to) => {
    const p = profileOf(layer);
    const travel = (l) => {
      const v = Math.min(g.speed[l], p.top);
      const km = g.length[l] / 1000;
      return g.length[l] / v + km * (g.rank[l] < 2 ? p.minorPenalty : p.majorPenalty);
    };
    const dist = new Float64Array(g.count).fill(Infinity);
    const done = new Uint8Array(g.count);
    const heap = [[travel(from), from]];
    dist[from] = travel(from);
    while (heap.length) {
      let bi = 0;
      for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[bi][0]) bi = i;
      const [d, l] = heap.splice(bi, 1)[0];
      if (done[l]) continue;
      done[l] = 1;
      if (l === to) return d;
      for (let e = g.edgeStart[l]; e < g.edgeEnd[l]; e++) {
        const o = g.edgeTo[e];
        if ((g.use[o] & p.use) === 0 || done[o]) continue;
        const nd = d + g.edgeCost[e] * p.turn + travel(o);
        if (nd < dist[o]) { dist[o] = nd; heap.push([nd, o]); }
      }
    }
    return Infinity;
  };

  // --- a path has to be a walk somebody could actually drive
  const validate = (layer, from, to, n) => {
    const p = profileOf(layer);
    if (n === 0) return 'empty';
    if (out[0] !== from) return 'does not start at the origin';
    if (out[n - 1] !== to) return 'does not end at the destination';
    for (let i = 0; i < n; i++) {
      if ((g.use[out[i]] & p.use) === 0) return `lane ${i} does not admit this traveller`;
      if (i === 0) continue;
      let joined = false;
      for (let e = g.edgeStart[out[i - 1]]; e < g.edgeEnd[out[i - 1]]; e++) {
        if (g.edgeTo[e] === out[i]) { joined = true; break; }
      }
      if (!joined) return `lanes ${i - 1} and ${i} are not connected`;
    }
    return null;
  };

  // A spread of origins and destinations, taken from real positions on the map
  // rather than from lane ids, because that is how the game will ask.
  let rng = 7;
  const rand = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pick = (use) => {
    for (let tries = 0; tries < 40; tries++) {
      const l = nearestLane(g, ix, (rand() * 2 - 1) * span * 0.95,
        (rand() * 2 - 1) * span * 0.95, use);
      if (l >= 0) return l;
    }
    return -1;
  };
  const pairs = [];
  while (pairs.length < 400) {
    const a = pick(Use.CAR), b = pick(Use.CAR);
    if (a >= 0 && b >= 0 && a !== b) pairs.push([a, b]);
  }

  // --- every path is a walk
  let broken = null, found = 0;
  for (const [a, b] of pairs) {
    const n = finder.find(Layer.CAR, a, b, out);
    if (n === 0) continue;
    found++;
    const why = validate(Layer.CAR, a, b, n);
    if (why && !broken) broken = `${a} -> ${b}: ${why}`;
  }
  ok(found > pairs.length * 0.9, 'nearly every pair is routable', `${found}/${pairs.length}`);
  ok(broken === null, 'every path is a walk a driver could follow', broken ?? '');

  // --- short trips must be exactly optimal: no restriction applies there, so a
  // --- disagreement with Dijkstra is a bug in the heuristic or the heap.
  // With the heuristic unweighted, A* must agree with Dijkstra to the last
  // decimal. That is the proof the heap, the stamps and the cost model are
  // right; the weighted default that follows trades a measured slice of that
  // for speed, and the two tests keep those two things separate.
  const exact = new Pathfinder(g, 1);
  let shortTested = 0, suboptimal = 0, worstShort = 0, weighted = 0, worstWeighted = 0;
  for (const [a, b] of pairs) {
    const d = Math.hypot(g.bx[b] - g.ax[a], g.bz[b] - g.az[a]);
    if (d > 900 || shortTested >= 40) continue;
    const n = exact.find(Layer.CAR, a, b, out);
    if (n === 0) continue;
    const best = dijkstra(Layer.CAR, a, b);
    if (!Number.isFinite(best)) continue;
    shortTested++;
    const excess = (exact.seconds - best) / best;
    if (excess > 1e-4) { suboptimal++; worstShort = Math.max(worstShort, excess); }
    if (finder.find(Layer.CAR, a, b, out) > 0) {
      const w = (finder.seconds - best) / best;
      if (w > 1e-4) { weighted++; worstWeighted = Math.max(worstWeighted, w); }
    }
  }
  ok(shortTested >= 12, 'there were short trips to check', `${shortTested}`);
  ok(suboptimal === 0, 'unweighted, A* is exactly the route Dijkstra finds',
    `${suboptimal} worse, worst by ${(worstShort * 100).toFixed(2)}%`);
  console.log(`  weighted heuristic epsilon ${finder.epsilon}: `
    + `${weighted}/${shortTested} short trips differ, worst `
    + `${(worstWeighted * 100).toFixed(1)}% over optimal`);
  ok(worstWeighted < finder.epsilon - 1 + 1e-6,
    'and the weighted one stays inside its own bound',
    `${(worstWeighted * 100).toFixed(1)}% vs ${((finder.epsilon - 1) * 100).toFixed(0)}%`);

  // --- long trips: the hierarchy is a deliberate approximation, so measure what
  // --- it costs in route quality and what it buys in work.
  let longTested = 0, sumExcess = 0, worstLong = 0, sumFast = 0, sumSlow = 0;
  for (const [a, b] of pairs) {
    const d = Math.hypot(g.bx[b] - g.ax[a], g.bz[b] - g.az[a]);
    if (d < 2500 || longTested >= 25) continue;
    const n = finder.find(Layer.CAR, a, b, out);
    if (n === 0) continue;
    const best = dijkstra(Layer.CAR, a, b);
    if (!Number.isFinite(best)) continue;
    longTested++;
    const excess = (finder.seconds - best) / best;
    sumExcess += excess; worstLong = Math.max(worstLong, excess);
    sumFast += finder.expanded;
    sumSlow += exact.find(Layer.CAR, a, b, out) > 0 ? exact.expanded : 0;
  }
  ok(longTested >= 8, 'there were long trips to check', `${longTested}`);
  const meanExcess = longTested ? sumExcess / longTested : 0;
  console.log(`  long-trip detour   mean ${(meanExcess * 100).toFixed(1)}%, `
    + `worst ${(worstLong * 100).toFixed(1)}% over optimal, `
    + `${(sumFast / Math.max(1, longTested)).toFixed(0)} lanes expanded `
    + `vs ${(sumSlow / Math.max(1, longTested)).toFixed(0)} unweighted`);
  ok(meanExcess < 0.12, 'the hierarchy and the weighting cost little route quality',
    `${(meanExcess * 100).toFixed(1)}% mean`);
  ok(worstLong < 0.45, 'and never send anyone badly wrong',
    `${(worstLong * 100).toFixed(1)}%`);
  console.log(`  narrowing          ${finder.restricted} long searches, `
    + `${finder.widened} needed a wider window, ${finder.fallbacks} gave up on it`);
  ok(finder.fallbacks / Math.max(1, finder.restricted) < 0.05,
    'the narrowed search almost never has to be abandoned',
    `${(finder.fallbacks / Math.max(1, finder.restricted) * 100).toFixed(1)}%`);

  // --- unreachable is answered, not hung on
  const island = (() => {
    for (let l = 0; l < g.count; l++) {
      if (g.ax[l] > span * 1.4 && g.az[l] > span * 1.4) return l;
    }
    return -1;
  })();
  ok(island >= 0, 'the island exists', `${island}`);
  const n0 = finder.find(Layer.CAR, pairs[0][0], island, out);
  ok(n0 === 0 && finder.outcome === Outcome.UNREACHABLE,
    'a route to nowhere comes back unreachable', `n ${n0} outcome ${finder.outcome}`);

  // --- a route to itself is a route of one lane
  const self = finder.find(Layer.CAR, pairs[0][0], pairs[0][0], out);
  ok(self === 1 && out[0] === pairs[0][0], 'a trip to where you already are is one lane',
    `${self}`);

  // --- modes go where they belong
  const shareOf = (layer, want) => {
    let lanes = 0, hit = 0, trips = 0;
    for (const [a0, b0] of pairs) {
      const a = (g.use[a0] & profileOf(layer).use) ? a0
        : nearestLane(g, ix, g.ax[a0], g.az[a0], profileOf(layer).use);
      const b = (g.use[b0] & profileOf(layer).use) ? b0
        : nearestLane(g, ix, g.bx[b0], g.bz[b0], profileOf(layer).use);
      if (a < 0 || b < 0 || a === b) continue;
      if (trips >= 60) break;
      const n = finder.find(layer, a, b, out);
      if (n === 0) continue;
      trips++;
      for (let i = 0; i < n; i++) { lanes++; if (want(out[i])) hit++; }
    }
    return { share: lanes ? hit / lanes : 0, trips };
  };
  const onFoot = shareOf(Layer.FOOT, (l) => net.links[g.link[l]].cls === 'motorway');
  ok(onFoot.trips > 10, 'pedestrians had trips to make', `${onFoot.trips}`);
  ok(onFoot.share === 0, 'nobody is routed along the motorway on foot',
    `${(onFoot.share * 100).toFixed(1)}%`);

  const minor = (l) => g.rank[l] < 2;
  const carMinor = shareOf(Layer.CAR, minor);
  const cargoMinor = shareOf(Layer.CARGO, minor);
  console.log(`  back-street share  cars ${(carMinor.share * 100).toFixed(0)}%, `
    + `lorries ${(cargoMinor.share * 100).toFixed(0)}%`);
  ok(cargoMinor.share <= carMinor.share + 1e-6,
    'lorries use fewer back streets than cars', 
    `${(cargoMinor.share * 100).toFixed(1)}% vs ${(carMinor.share * 100).toFixed(1)}%`);

  // --- congestion actually diverts traffic
  {
    const [a, b] = pairs.find(([p0, p1]) =>
      Math.hypot(g.bx[p1] - g.ax[p0], g.bz[p1] - g.az[p0]) > 1500) ?? pairs[0];
    const clear = finder.find(Layer.CAR, a, b, out);
    const first = out.slice(0, clear);
    const free = finder.seconds;
    const load = new Float32Array(g.count);
    for (let i = 0; i < clear; i++) load[first[i]] = 4;   // that route is now solid
    const jammed = finder.find(Layer.CAR, a, b, out, load);
    ok(jammed > 0, 'there is still a route when the direct one jams', `${jammed}`);
    let same = 0;
    for (let i = 0; i < jammed; i++) if (first.includes(out[i])) same++;
    ok(same < jammed, 'and it is not the same route', `${same} of ${jammed} lanes shared`);
    ok(finder.seconds > free, 'the jammed trip takes longer',
      `${finder.seconds.toFixed(0)} s vs ${free.toFixed(0)} s`);
  }

  // --- the path store
  {
    const store = new PathStore(64);
    const a = new Int32Array([1, 2, 3, 4, 5]);
    const h1 = store.alloc(a, 5);
    ok(store.length(h1) === 5, 'a stored path keeps its length', `${store.length(h1)}`);
    ok([...store.view(h1)].join() === '1,2,3,4,5', 'and its contents',
      [...store.view(h1)].join());
    ok(store.at(h1, 2) === 3, 'and can be read one lane at a time');
    ok(store.at(h1, 9) === -1, 'and refuses to read past the end');
    ok(store.refs(h1) === 1, 'a fresh path has one reference');
    store.retain(h1);
    ok(store.refs(h1) === 2, 'retain takes another');
    store.release(h1);
    ok(store.refs(h1) === 1 && store.count === 1, 'release gives one back');
    store.release(h1);
    ok(store.count === 0, 'and the last release frees it');

    // The freed block must come back rather than growing the arena.
    const before = store.used;
    const h2 = store.alloc(a, 5);
    ok(store.used === before, 'a freed block is reused, not appended',
      `${store.used} vs ${before}`);
    ok([...store.view(h2)].join() === '1,2,3,4,5', 'and the reused block is rewritten');

    // Growth, through several size classes, with the contents intact.
    const kept = [], want = [];
    for (let i = 0; i < 200; i++) {
      const n = 1 + (i * 37) % 300;
      const src = new Int32Array(n);
      for (let k = 0; k < n; k++) src[k] = i * 1000 + k;
      kept.push(store.alloc(src, n));
      want.push(src);
    }
    let corrupt = 0;
    for (let i = 0; i < kept.length; i++) {
      const v = store.view(kept[i]);
      if (v.length !== want[i].length) { corrupt++; continue; }
      for (let k = 0; k < v.length; k++) if (v[k] !== want[i][k]) { corrupt++; break; }
    }
    ok(corrupt === 0, 'growing the arena keeps every path intact', `${corrupt} of 200`);
    ok(store.alloc(new Int32Array(MAX_PATH + 1), MAX_PATH + 1) === NO_PATH,
      'a path longer than the arena allows is refused');
    console.log(`  arena              ${store.count} paths in `
      + `${kib(store.bytes())} (${store.used}/${store.capacity} ints)`);
  }

  // --- the router
  {
    const router = new Router(g, 4096);
    const SLOTS = 4096;
    const paths = new Int32Array(SLOTS).fill(NO_PATH);
    const liveRows = new Uint8Array(SLOTS).fill(1);
    const sink = router.addSink({
      name: 'test', out: paths, alive: (slot) => liveRows[slot] === 1,
    });

    // A request answers into the sink, and not before it is served.
    router.request(Layer.CAR, pairs[0][0], pairs[0][1], sink, 0, 0);
    ok(paths[0] === NO_PATH, 'a request does not answer immediately');
    ok(router.pending === 1, 'it queues', `${router.pending}`);
    router.serve(10, 100);
    ok(paths[0] >= 0, 'and serve answers it', `${paths[0]}`);
    ok(router.paths.refs(paths[0]) === 2, 'the cache and the caller each hold it',
      `${router.paths.refs(paths[0])}`);

    // The same route again comes from the cache and costs no search.
    const solved0 = router.stats.solved;
    router.request(Layer.CAR, pairs[0][0], pairs[0][1], sink, 1, 0);
    router.serve(10, 100);
    ok(paths[1] === paths[0], 'the same route is the same path', `${paths[1]}`);
    ok(router.stats.solved === solved0, 'and did not search again');
    ok(router.paths.refs(paths[0]) === 3, 'with another reference on it',
      `${router.paths.refs(paths[0])}`);

    // A request for a traveller that has since died is dropped, not written.
    liveRows[2] = 0;
    const stale0 = router.stats.stale;
    router.request(Layer.CAR, pairs[1][0], pairs[1][1], sink, 2, 0);
    router.serve(10, 100);
    ok(paths[2] === NO_PATH, 'nothing is written for a traveller that has gone');
    ok(router.stats.stale === stale0 + 1, 'and it is counted', `${router.stats.stale}`);

    // Urgent requests jump the queue.
    liveRows[2] = 1;
    const order = [];
    const spySink = router.addSink({
      name: 'spy', out: paths,
      alive: (slot) => { order.push(slot); return true; },
    });
    for (let i = 10; i < 20; i++) router.request(Layer.CAR, pairs[i][0], pairs[i][1], spySink, i, 0);
    router.request(Layer.EMERGENCY, pairs[3][0], pairs[3][1], spySink, 99, 0, true);
    router.serve(50, 100);
    ok(order[0] === 99, 'the ambulance is served first', `${order[0]}`);

    // The budget is honoured: a flood of cold requests is spread over ticks.
    //
    // Offered as the game offers them -- a burst each tick, then a serve -- rather
    // than all at once, because the router refuses a request when its queue is
    // already as deep as it can drain. That refusal is the contract: the caller
    // is being told to work the trip out the cheap way instead of joining a queue
    // nobody can clear.
    const flood = 3000;
    let offered = 0, refused = 0, ticks = 0, worst = 0;
    while (offered < flood && ticks < 4000) {
      for (let k = 0; k < 120 && offered < flood; k++) {
        const [a, b] = pairs[offered % pairs.length];
        if (!router.request(Layer.CAR, a, b, sink, 100 + (offered % 2000), 0)) refused++;
        offered++;
      }
      router.serve(2, 256);
      worst = Math.max(worst, router.stats.ms);
      ticks++;
    }
    while (router.pending > 0 && ticks < 8000) {
      router.serve(2, 256);
      worst = Math.max(worst, router.stats.ms);
      ticks++;
    }
    ok(router.pending === 0, 'the queue drains', `${router.pending} left`);
    ok(refused < flood, 'the router accepted most of the flood',
      `${refused} of ${flood} refused`);
    ok(router.queueLimit >= 64, 'the queue depth tracks what it can serve',
      `${router.queueLimit}`);
    // One request can always overrun -- the budget is checked between them, not
    // inside a search -- so the bound is the budget plus the worst single query.
    ok(worst < 3.5, 'and no tick meaningfully blew its 2 ms budget',
      `worst ${ms(worst)} over ${ticks} ticks`);
    console.log(`  budget             ${flood} requests over ${ticks} ticks, `
      + `worst tick ${ms(worst)}, cache ${(router.hitRate * 100).toFixed(0)}%`);

    // Releasing everything must leave nothing behind but what the cache holds.
    const held = new Set();
    for (let i = 0; i < SLOTS; i++) if (paths[i] >= 0) held.add(i);
    for (const i of held) { router.release(paths[i]); paths[i] = NO_PATH; }
    const afterCallers = router.paths.count;
    router.rebind(g);
    ok(router.paths.count === 0, 'every path is freed once nobody holds it',
      `${router.paths.count} left, ${afterCallers} before the cache let go`);
    ok(router.version === 1, 'and a rebind is a new version', `${router.version}`);
  }

  // --- what it costs at the scale the game has to run at
  {
    const router = new Router(g);
    const N = 20000;
    const paths = new Int32Array(N);
    const sink = router.addSink({ name: 'bench', out: paths, alive: () => true });

    // Cold: every request a different pair, so the cache cannot help.
    const cold = [];
    for (let i = 0; i < N; i++) {
      const a = pick(Use.CAR), b = pick(Use.CAR);
      cold.push([a < 0 ? pairs[i % pairs.length][0] : a,
        b < 0 ? pairs[i % pairs.length][1] : b]);
    }
    // Fed and drained in step, because the queue has a depth and refuses past it.
    const drain = (want) => {
      let at = 0;
      while (at < N) {
        while (at < N && router.request(Layer.CAR, want[at][0], want[at][1], sink, at, 0)) at++;
        router.serve(1e9, 1e9);
      }
      while (router.pending > 0) router.serve(1e9, 1e9);
    };
    const t0 = performance.now();
    drain(cold);
    const coldMs = performance.now() - t0;
    const st = router.stats;
    console.log(`  cold routing       ${N.toLocaleString()} trips in ${coldMs.toFixed(0)} ms `
      + `= ${Math.round(N / (coldMs / 1000)).toLocaleString()} a second`);
    console.log(`  per trip           ${(coldMs / N * 1000).toFixed(0)} us, `
      + `cache ${(router.hitRate * 100).toFixed(0)}%, `
      + `${router.report}`);
    ok(coldMs / N < 1.0, 'a cold route averages under a millisecond',
      `${(coldMs / N).toFixed(3)} ms`);
    void st;

    // Warm: the pattern a city actually has, where people leave the same places
    // for the same places.
    const repeat = [];
    for (let i = 0; i < N; i++) repeat.push(cold[i % 250]);
    const t1 = performance.now();
    drain(repeat);
    const warmMs = performance.now() - t1;
    console.log(`  warm routing       ${N.toLocaleString()} trips in ${warmMs.toFixed(0)} ms `
      + `= ${Math.round(N / (warmMs / 1000)).toLocaleString()} a second`);
    ok(warmMs < coldMs / 5, 'the cache is worth at least five times',
      `${warmMs.toFixed(0)} vs ${coldMs.toFixed(0)} ms`);

    // The requirement, stated properly. A hundred thousand citizens making three
    // trips a day, with a day running in twenty minutes of real time, is 250
    // routes a second. Most of those are cache hits; what has to fit in the tick
    // budget is the cold remainder.
    const TRIPS_PER_SECOND = 250;
    const hit = router.hitRate;
    const coldPerSecond = TRIPS_PER_SECOND * (1 - hit);
    const msPerSecond = coldPerSecond * (coldMs / N) + TRIPS_PER_SECOND * hit * (warmMs / N);
    console.log(`  metropolis load    ${TRIPS_PER_SECOND} trips a second at `
      + `${(hit * 100).toFixed(0)}% cached = ${msPerSecond.toFixed(1)} ms a second `
      + `(${(msPerSecond / 10).toFixed(2)} ms of each 10 Hz tick)`);
    ok(msPerSecond < 100, 'a metropolis of routing fits in a tenth of one core',
      `${msPerSecond.toFixed(0)} ms a second`);
    ok(msPerSecond / 10 < 2, 'and inside a 2 ms slice of every tick',
      `${(msPerSecond / 10).toFixed(2)} ms`);
    console.log(`  router memory      ${kib(router.bytes())}`);
  }
}


console.log(`\n${failed === 0 ? 'SIM_OK' : 'SIM_FAIL'}  ${checks - failed}/${checks} checks`);
process.exit(failed === 0 ? 0 : 1);
