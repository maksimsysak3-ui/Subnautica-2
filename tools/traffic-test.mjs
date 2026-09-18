/**
 * The traffic, checked.
 *
 * A following model is easy to write and hard to be sure of, because the ways it
 * goes wrong are quiet: two cars overlapping for a few ticks, a queue that
 * discharges through a red light, a junction that deadlocks against itself and sits
 * there. None of those throw and none of them are obvious in a screenshot -- you
 * find them by asserting the invariants directly, every tick, on a network with
 * real junctions on it.
 *
 * So this runs a city's worth of traffic and checks, on every single tick, that no
 * two vehicles occupy the same stretch of the same lane, that nobody is moving
 * backwards, that nobody crosses a junction against a conflicting movement, and
 * that the queues stay in order. Then it measures what the model produces: how fast
 * traffic flows, how long people wait at lights, how much of the jam clears.
 *
 *   node tools/traffic-test.mjs [seconds] [grid]
 */

import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { Simulation } from '${src}sim/agents/sim';`,
      `export * from '${src}sim/agents/junctions';`,
      `export * from '${src}sim/agents/driving';`,
      `export { makeCity } from '${src}sim/city';`,
      `export { defaultWorld } from '${src}sim/world';`,
      `export { RoadGraph } from '${src}sim/roadgraph';`,
      `export { buildLaneGraph } from '${src}sim/agents/lanes';`,
      `export { TICK_HZ, TICK_SECONDS } from '${src}sim/agents/tick';`,
      `export { configureSim } from '${src}sim/config';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022',
})).outputFiles[0].text;

const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));
const {
  Simulation, Junctions, Control, Light, CONTROL_NAMES, crosses,
  Traffic, Driver, Kind, DRIVER_NAMES, KIND_NAMES, VEHICLE_LENGTH,
  makeCity, defaultWorld, RoadGraph, buildLaneGraph, TICK_HZ, TICK_SECONDS,
  configureSim,
} = M;

let failed = 0, checks = 0;
const ok = (cond, what, detail = '') => {
  checks++;
  if (!cond) { failed++; console.log(`  FAIL  ${what}${detail ? '  -- ' + detail : ''}`); }
};
const section = (name) => console.log(`\n${name}`);

// ---- the conflict test, on its own ---------------------------------------

section('conflicts');
{
  // A crossroads with arms at the compass points. `in` is where a vehicle came
  // from, `out` where it is going, both as seen from the middle.
  const N = Math.PI * 0.5, E = 0, S = Math.PI * 1.5, W = Math.PI;
  // Straight across, both ways: these must not conflict, or no crossroads works.
  ok(!crosses(W, E, E, W), 'opposing straights do not conflict');
  ok(!crosses(N, S, S, N), 'and nor do the other two');
  // A straight and the straight crossing it: must conflict.
  ok(crosses(W, E, N, S), 'crossing straights conflict');
  ok(crosses(N, S, W, E), 'and symmetrically');
  // Turns towards the kerb from adjacent arms: no conflict.
  ok(!crosses(W, N, E, S), 'turns away from each other do not conflict');
  // A turn across the oncoming straight: conflict. Coming from the west heading
  // north, against traffic coming from the east heading west.
  ok(crosses(W, N, E, W), 'a turn across the oncoming straight conflicts');
  // Same approach is a queue, never a conflict, whatever the two are doing.
  ok(!crosses(W, E, W, N), 'two movements off the same arm are a queue');
  ok(!crosses(W, N, W, S), 'even when one turns and the other does not');
  // Same exit is a merge, always a conflict.
  ok(crosses(W, N, E, N), 'two movements into the same arm merge');
  // And it is symmetric everywhere it should be.
  let asymmetric = 0;
  const arms = [N, E, S, W];
  for (const a of arms) for (const b of arms) for (const c of arms) for (const d of arms) {
    if (crosses(a, b, c, d) !== crosses(c, d, a, b)) asymmetric++;
  }
  ok(asymmetric === 0, 'the conflict test is symmetric', `${asymmetric} of 256`);
}

// ---- junction control on a real network ----------------------------------

section('junctions');
{
  const net = new RoadGraph(160);
  // A crossroads of two avenues, a T junction off one, and a quiet corner.
  net.add(-600, 0, 600, 0, 'avenue', 0);
  net.add(0, -600, 0, 600, 'avenue', 0);
  net.add(-300, 0, -300, 400, 'street', 0);          // T off the avenue
  // A three-arm junction of minor roads, which is what gives way rather than
  // being signalised: no arm of it is arterial.
  net.add(300, 200, 500, 200, 'lane', 0);
  net.add(300, 200, 300, 400, 'lane', 0);
  net.add(300, 200, 300, 60, 'lane', 0);
  const g = buildLaneGraph(net);
  const jn = new Junctions(g, net.nodes.length);
  console.log(`  control       ${jn.report}`);

  // Every node with three or more arms is controlled somehow.
  let uncontrolled = 0, armless = 0;
  for (let n = 0; n < jn.count; n++) {
    if (jn.arms[n] >= 3 && jn.control[n] === Control.FREE) uncontrolled++;
    if (jn.arms[n] === 0) armless++;
  }
  ok(uncontrolled === 0, 'no junction of three arms is uncontrolled', `${uncontrolled}`);
  ok(armless < jn.count, 'the nodes have arms on them');
  ok(jn.byControl[Control.SIGNALS] > 0, 'the avenue crossroads got signals',
    `${jn.byControl[Control.SIGNALS]}`);
  ok(jn.byControl[Control.GIVE_WAY] > 0, 'and the quiet corner gives way',
    `${jn.byControl[Control.GIVE_WAY]}`);

  // Signals. Vehicle-actuated, so they have to be *driven* -- with demand on every
  // approach, which is the case where every phase must get its turn.
  const busy = new Uint8Array(g.count).fill(1);
  const seenAt = new Map();
  let both = 0;
  for (let t = 0; t < 400; t += 0.5) {
    jn.step(t, busy);
    for (let n = 0; n < jn.count; n++) {
      if (jn.control[n] !== Control.SIGNALS) continue;
      const greens = new Set();
      for (let l = 0; l < g.count; l++) {
        if (g.to[l] !== n) continue;
        if (jn.lightFor(l, n, t) === Light.GREEN) greens.add(jn.lanePhase[l]);
      }
      if (greens.size > 1) both++;
      if (!seenAt.has(n)) seenAt.set(n, new Set());
      for (const p of greens) seenAt.get(n).add(p);
    }
  }
  let bad = 0, everGreen = 0;
  for (const [n, seen] of seenAt) {
    if (seen.size < jn.phases[n]) bad++;
    if (seen.size > 0) everGreen++;
  }
  ok(both === 0, 'never two signal phases green at once', `${both}`);
  ok(bad === 0, 'with demand everywhere, every phase gets a turn', `${bad} short`);
  ok(everGreen > 0, 'and the signals do go green', `${everGreen}`);

  // No demand on a phase means it is skipped entirely, which is the whole point.
  const quiet = new Uint8Array(g.count);
  const onePhase = (() => {
    for (const [n] of seenAt) if (jn.phases[n] >= 2) return n;
    return -1;
  })();
  if (onePhase >= 0) {
    // Demand on one phase only: the signal should settle on it and stay.
    const want = 0;
    for (let l = 0; l < g.count; l++) {
      if (g.to[l] === onePhase && jn.lanePhase[l] === want) quiet[l] = 1;
    }
    let elsewhere = 0;
    for (let t = 400; t < 700; t += 0.5) {
      jn.step(t, quiet);
      if (t > 500 && jn.phaseAt(onePhase) !== want) elsewhere++;
    }
    ok(elsewhere === 0, 'a phase with nobody waiting on it is skipped',
      `${elsewhere} samples on the wrong phase`);
  }

  // The box refuses a conflicting movement and admits a compatible one.
  const cross = (() => {
    for (let n = 0; n < jn.count; n++) if (jn.control[n] === Control.SIGNALS) return n;
    return -1;
  })();
  ok(cross >= 0, 'found the signalised crossroads');
  const N = Math.PI * 0.5, E = 0, S = Math.PI * 1.5, W = Math.PI;
  ok(jn.enter(cross, 1, W, E, 2, 100, 10), 'the first vehicle gets in');
  ok(!jn.enter(cross, 2, N, S, 2, 100, 10), 'a crossing movement is refused');
  ok(jn.enter(cross, 3, E, W, 2, 100, 10), 'but the opposing straight is admitted');
  ok(jn.occupancy(cross, 100) === 2, 'two in the box', `${jn.occupancy(cross, 100)}`);
  ok(jn.enter(cross, 4, N, S, 2, 200, 10), 'and once they are through, the crossing goes');
  jn.leave(cross, 4);
  ok(jn.occupancy(cross, 200) === 0, 'leaving empties it',
    `${jn.occupancy(cross, 200)}`);
  // Asking is not taking: the whole reason a junction does not throttle itself.
  const before = jn.occupancy(cross, 400);
  jn.closedTo(cross, 8, W, E, 2, 0, 400, 0);
  ok(jn.occupancy(cross, 400) === before, 'asking whether a junction is shut takes nothing',
    `${jn.occupancy(cross, 400)} vs ${before}`);
  // An emergency vehicle forces through whatever is in there.
  ok(jn.enter(cross, 5, W, E, 2, 500, 20), 'somebody is crossing');
  ok(!jn.enter(cross, 6, N, S, 2, 500, 20, false), 'an ordinary vehicle waits');
  ok(jn.enter(cross, 7, N, S, 2, 500, 20, true), 'an ambulance does not');
  // Giving way waits for a better road even where the paths would not cross.
  const side = new Junctions(g, net.nodes.length);
  const give = (() => {
    for (let n = 0; n < side.count; n++) if (side.control[n] === Control.GIVE_WAY) return n;
    return -1;
  })();
  ok(give >= 0, 'found a give-way junction', `${give}`);
}

// ---- the following model, driven hard ------------------------------------

section('driving');
{
  const SECONDS = Number(process.argv[2] || 0) || 240;
  const GRID = Number(process.argv[3] || 0) || 200;
  configureSim({ cityGrid: GRID });
  const world = defaultWorld();
  const city = makeCity(world);
  const sim = new Simulation(city, world.net, 0x7a11c);
  sim.look(0, 0);
  sim.found(12);

  const t = sim.traffic;
  const jn = sim.junctions;
  const g = sim.lanes;
  console.log(`  network       ${world.net.links.length.toLocaleString()} links, `
    + `${g.count.toLocaleString()} lanes, ${jn.count.toLocaleString()} nodes`);
  console.log(`  control       ${jn.report}`);

  // Give the flow model something to be congested about, so vehicles appear.
  const ticks = Math.round(SECONDS * TICK_HZ);
  const queue = [];
  let overlaps = 0, backwards = 0, outOfLane = 0, misordered = 0, conflicts = 0, ringed = 0;
  // Bodies clipping through each other sideways. The check above is per lane and
  // catches a vehicle driving into the back of another; this one catches the
  // other way two cars can end up in the same place, which is one of them moving
  // across into the other. A lane change is instant in the model and drawn over
  // about a second and a half, so the gap it asks for has to cover the whole
  // manoeuvre rather than the instant it starts.
  let clips = 0;
  let firstClip = '';
  /** Two bodies closer than this, side by side, are through each other. */
  const WIDE = 1.9;
  let firstOverlap = '';
  let peak = 0, sumDriving = 0, samples = 0;
  let worstTick = 0, totalMs = 0;

  const c = t.col;
  for (let tick = 0; tick < ticks; tick++) {
    const before = new Float32Array(t.bound);
    const beforeLane = new Int32Array(t.bound);
    for (let v = 0; v < t.bound; v++) {
      if (t.live[v]) { before[v] = c.along[v]; beforeLane[v] = c.lane[v]; }
    }
    const t0 = performance.now();
    sim.step(1);
    const dt = performance.now() - t0;
    totalMs += dt;
    if (dt > worstTick) worstTick = dt;

    // Nobody moved backwards along the lane they stayed on.
    for (let v = 0; v < t.bound; v++) {
      if (t.live[v] === 0) continue;
      if (c.lane[v] !== beforeLane[v]) continue;
      if (c.along[v] < before[v] - 1e-3) backwards++;
      if (c.along[v] < -0.01 || c.along[v] > g.length[c.lane[v]] + 0.01) outOfLane++;
    }

    // No two vehicles overlapping on a lane, and the queue in order. Checked on
    // every lane that has anybody on it -- this is the invariant the whole model
    // exists to maintain, so it is worth the cost of checking it exhaustively.
    for (let lane = 0; lane < g.count; lane++) {
      if (t.onLane(lane) < 2) continue;
      const walked = t.queueOf(lane, queue);
      if (walked !== t.onLane(lane)) ringed++;
      for (let i = 1; i < queue.length; i++) {
        const front = queue[i - 1], back = queue[i];
        if (c.along[back] > c.along[front] + 1e-3) misordered++;
        const gap = c.along[front] - c.length[front] - c.along[back];
        if (gap < -0.2) {
          overlaps++;
          if (!firstOverlap) {
            firstOverlap = `lane ${lane}: ${back} at ${c.along[back].toFixed(1)} `
              + `inside ${front} at ${c.along[front].toFixed(1)} (len `
              + `${c.length[front].toFixed(1)}), gap ${gap.toFixed(2)}`;
          }
        }
      }
    }

    // Two vehicles on neighbouring lanes of one carriageway, overlapping along
    // it, with one of them part way across: that is a body through a body.
    for (let a = 0; a < t.bound; a++) {
      if (t.live[a] === 0) continue;
      const la = c.lane[a];
      if (la < 0) continue;
      if (c.shift[a] === 0) continue;                 // not manoeuvring
      const key = g.link[la] * 2 + g.dir[la];
      for (let b = g.linkStart[key]; b < g.linkEnd[key]; b++) {
        if (b === la || Math.abs(g.index[b] - g.index[la]) !== 1) continue;
        for (let u = 0; u < t.bound; u++) {
          if (t.live[u] === 0 || c.lane[u] !== b) continue;
          const overlap = c.along[a] > c.along[u] - c.length[u]
            && c.along[a] - c.length[a] < c.along[u];
          if (!overlap) continue;
          // Overlapping along the road is only half of it: two vehicles side by
          // side in neighbouring lanes overlap along the road all day and never
          // touch. What matters is how far apart their tracks are, which is the
          // lane spacing less however much of the change has been made.
          const apart = Math.abs((g.index[b] - g.index[la]) * 3.5 - c.shift[a]);
          if (apart >= WIDE) continue;
          clips++;
          if (!firstClip) {
            firstClip = `v${a} shifting ${c.shift[a].toFixed(2)}m beside v${u}`
              + ` on lane ${b}, tracks ${apart.toFixed(2)}m apart`;
          }
        }
      }
    }

    // Nothing in a junction box conflicts with anything else in it.
    for (let n = 0; n < jn.count; n++) {
      const inBox = [];
      for (let v = 0; v < t.bound; v++) {
        if (t.live[v] === 1 && c.inBox[v] === n) inBox.push(v);
      }
      // The movement is where it came in and where it is going *out* -- the lane it
      // has decided on, not the one it is standing in. Using the current lane's own
      // direction for the exit measures something else entirely, and it was this
      // test that was wrong rather than the model.
      for (let i = 0; i < inBox.length; i++) {
        for (let k = i + 1; k < inBox.length; k++) {
          const a = inBox[i], b = inBox[k];
          const na = c.next[a], nb = c.next[b];
          if (na < 0 || nb < 0) continue;
          if (crosses(jn.laneIn[c.lane[a]], jn.laneOut[na],
            jn.laneIn[c.lane[b]], jn.laneOut[nb])) conflicts++;
        }
      }
    }

    if (t.count > peak) peak = t.count;
    sumDriving += t.count;
    samples++;
  }

  const st = t.stats;
  console.log(`  vehicles      ${st.driving.toLocaleString()} on the road now, `
    + `peak ${peak.toLocaleString()}, mean ${(sumDriving / samples).toFixed(0)}`);
  console.log(`  spawned       ${st.spawned.toLocaleString()}, `
    + `refused ${st.refused.toLocaleString()} (no room or over budget)`);
  console.log(`  speed         ${st.meanSpeed.toFixed(1)} m/s mean `
    + `(${(st.meanSpeed * 3.6).toFixed(0)} kph), ${st.stopped} stopped right now`);
  console.log(`  waiting       worst ${st.worstWaitSeconds.toFixed(0)} s at a junction`);
  console.log(`  lane changes  ${st.changes.toLocaleString()}`);
  console.log(`  hard braking  ${st.hardBrakes.toLocaleString()} times`);
  console.log(`  cost          ${(totalMs / ticks * 1000).toFixed(0)} us a tick `
    + `over ${SECONDS} s of driving, worst ${worstTick.toFixed(1)} ms`);

  ok(st.spawned > 40, 'vehicles got onto the road', `${st.spawned}`);
  ok(peak > 20, 'and there were a useful number of them at once', `${peak}`);
  console.log(`  side clips    ${clips.toLocaleString()} while changing lane`);
  ok(clips === 0, 'and nobody changed lane through somebody',
    `${clips}${firstClip ? ', e.g. ' + firstClip : ''}`);
  ok(overlaps === 0, 'no two vehicles ever occupied the same stretch of road',
    `${overlaps}${firstOverlap ? ', e.g. ' + firstOverlap : ''}`);
  ok(backwards === 0, 'nobody drove backwards', `${backwards}`);
  ok(outOfLane === 0, 'nobody left the lane they were on', `${outOfLane}`);
  ok(misordered === 0, 'every lane queue stayed in order', `${misordered}`);
  ok(ringed === 0, 'no lane queue ever closed into a ring or lost a member',
    `${ringed}`);
  ok(conflicts === 0, 'no two conflicting movements were in a junction at once',
    `${conflicts}`);
  ok(st.meanSpeed > 2, 'traffic actually moves', `${st.meanSpeed.toFixed(2)} m/s`);
  ok(st.worstWaitSeconds < 240, 'nobody waited forever at a junction',
    `${st.worstWaitSeconds.toFixed(0)} s`);
  ok(st.stopped < st.driving * 0.8 || st.driving < 10,
    'the city is not gridlocked', `${st.stopped} of ${st.driving} stopped`);
  ok(totalMs / ticks < 4, 'a tick with traffic in it stays cheap',
    `${(totalMs / ticks * 1000).toFixed(0)} us`);

  // Driver personalities have to actually differ, or they are decoration.
  const byDriver = new Int32Array(3);
  const speedByDriver = new Float64Array(3);
  for (let v = 0; v < t.bound; v++) {
    if (t.live[v] === 0) continue;
    byDriver[c.driver[v]]++;
    speedByDriver[c.driver[v]] += c.speed[v];
  }
  console.log(`  drivers       ` + DRIVER_NAMES.map((n, i) =>
    `${n} ${byDriver[i]}`).join(', '));
  ok(byDriver[0] > 0 && byDriver[1] > 0 && byDriver[2] > 0,
    'the city has all three kinds of driver in it', [...byDriver].join(','));
  const kinds = new Int32Array(4);
  for (let v = 0; v < t.bound; v++) if (t.live[v]) kinds[c.kind[v]]++;
  console.log(`  vehicles by   ` + KIND_NAMES.map((n, i) => `${n} ${kinds[i]}`).join(', '));
  ok(kinds[Kind.CAR] > 0, 'there are cars');
}

console.log(`\n${failed === 0 ? 'TRAFFIC_OK' : 'TRAFFIC_FAIL'}  ${checks - failed}/${checks} checks`);
process.exit(failed === 0 ? 0 : 1);
