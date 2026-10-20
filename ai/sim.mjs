// Headless test bench for the Night Range AI.  Run:  node ai/sim.mjs [quick]
// Every scenario is repeated many times with different seeds and reports distributions,
// compared against human reference ranges so tuning is driven by numbers, not vibes.
import { World, Agent, TUNE, util } from './core.mjs';

const { v3, dist2d, anglesTo, wrap } = util;
const QUICK = process.argv.includes('quick');
const N = (n) => (QUICK ? Math.max(6, Math.round(n / 4)) : n);
const DT = 1 / 30;
const OFF = Number(process.env.SEED_OFFSET || 0); // re-run everything on fresh seeds to catch overfitting

const q = (arr, p) => { if (!arr.length) return NaN; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const pct = (x) => `${(100 * x).toFixed(0)}%`;
const ms = (x) => (Number.isFinite(x) ? `${Math.round(x * 1000)}ms` : '—');
const results = [];
function check(name, value, lo, hi, fmt = (x) => x.toFixed(2), note = '') {
  const ok = value >= lo && value <= hi;
  results.push({ name, value, lo, hi, ok, fmt, note });
  return ok;
}

// ---------------------------------------------------------------------------
//  Maps
// ---------------------------------------------------------------------------
function openWorld(seed, { lit = true, ambient = 0.03 } = {}) {
  return new World({ w: 220, h: 220, seed: seed + OFF, ambient, lights: lit ? [{ x: 0, z: 0, r: 200, i: 1.2 }] : [] });
}
// a night yard: shipping containers (high), jersey barriers (low), a few floodlights
function yard(seed) {
  const boxes = [
    { x0: -6, x1: 6, z0: -1.2, z1: 1.2, h: 2.6 },      // central container
    { x0: -18, x1: -14, z0: -10, z1: -8, h: 1.1 },   // barriers
    { x0: 14, x1: 18, z0: -10, z1: -8, h: 1.1 },
    { x0: -18, x1: -14, z0: 8, z1: 10, h: 1.1 },
    { x0: 14, x1: 18, z0: 8, z1: 10, h: 1.1 },
    { x0: -3, x1: 3, z0: -16, z1: -14.8, h: 1.1 },
    { x0: -3, x1: 3, z0: 14.8, z1: 16, h: 1.1 },
    { x0: -26, x1: -23, z0: -3, z1: 3, h: 2.6 },     // side containers
    { x0: 23, x1: 26, z0: -3, z1: 3, h: 2.6 },
    { x0: -10, x1: -8, z0: 20, z1: 26, h: 2.6 },
    { x0: 8, x1: 10, z0: -26, z1: -20, h: 2.6 },
    { x0: 8, x1: 12, z0: 20, z1: 21, h: 1.1 },
    { x0: -12, x1: -8, z0: -21, z1: -20, h: 1.1 },
  ];
  const lights = [{ x: 0, z: -22, r: 10, i: 0.9 }, { x: 0, z: 22, r: 10, i: 0.9 }, { x: -20, z: 0, r: 8, i: 0.7 }, { x: 20, z: 0, r: 8, i: 0.7 }, { x: 0, z: 0, r: 6, i: 0.5 }];
  return new World({ w: 70, h: 70, seed: seed + OFF, boxes, lights, ambient: 0.035 });
}

// ---------------------------------------------------------------------------
//  Test fixtures (these are *not* the AI; they're scripted actors with truth access)
// ---------------------------------------------------------------------------
const dummy = (world, pos, opts = {}) => {
  const a = new Agent(world, { team: 'blue', pos, controller: 'script', ...opts });
  a.health = opts.health ?? 1e9;
  return a;
};
// a stand-in shooter with a fixed, decent aim
function shooterScript(target, { spread = 0.03, interval = 0.18, react = 0.35, crouchPeek = false } = {}) {
  let seenAt = null, next = 0, up = true, toggle = 0;
  return (me, dt, world) => {
    if (!target.alive) return;
    if (crouchPeek) { toggle -= dt; if (toggle <= 0) { up = !up; toggle = up ? 1.6 : 1.8; } me.stance = up ? 'stand' : 'crouch'; }
    const vis = target.bodyPts().some((p) => world.los(me.eye(), p));
    if (!vis) { seenAt = null; return; }
    seenAt ??= world.time;
    if (world.time - seenAt < react || world.time < next) return;
    next = world.time + interval;
    const ch = v3(target.pos.x, target.top() * 0.7, target.pos.z), a = anglesTo(me.eye(), ch);
    const dir = util.dirOf(a.yaw + world.rand.normal(0, spread), a.pitch + world.rand.normal(0, spread));
    me.lastShotT = world.time;
    world.shoot(me, me.eye(), dir, TUNE.weapon);
    world.emitSound(me.pos, TUNE.hearing.gunshot, 'shot', me.id);
  };
}
function run(world, seconds, until = () => false) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) { world.step(DT); if (until(world)) return world.time; }
  return world.time;
}

// ---------------------------------------------------------------------------
//  S1  Reaction time to a target appearing in view
// ---------------------------------------------------------------------------
function sReaction() {
  const conds = [
    { k: 'lit 20m', d: 20, lit: true, move: false },
    { k: 'lit 50m', d: 50, lit: true, move: false },
    { k: 'dark 20m still', d: 20, lit: false, move: false },
    { k: 'dark 20m walking', d: 20, lit: false, move: true },
    { k: 'dark 25m firing', d: 25, lit: false, move: false, fire: true },
  ];
  const out = {};
  for (const c of conds) {
    const det = [], shot = [], rts = [];
    let found = 0; const n = N(80);
    for (let s = 0; s < n; s++) {
      const w = openWorld(1000 + s, { lit: c.lit, ambient: c.lit ? 0.03 : 0.02 });
      const ai = new Agent(w, { team: 'red', pos: v3(0, 0, 0), yaw: 0 });
      ai.think = () => {}; ai.action = { type: 'engage', since: 0, minUntil: 1e9 };
      const ang = w.rand.range(-0.35, 0.35);
      const t = dummy(w, v3(Math.sin(ang) * -c.d, 0, -Math.cos(ang) * c.d));
      t.alive = false;
      if (c.move) t.script = (me) => { me.vel = v3(1.4, 0, 0); };
      if (c.fire) { let nx = 0; t.script = (me, dt, world) => { if (world.time > nx) { nx = world.time + 2; me.lastShotT = world.time; world.emitSound(me.pos, 260, 'shot', me.id); } }; }
      run(w, 0.5);
      t.alive = true; const t0 = w.time;
      let tDet = null;
      run(w, 8, () => {
        const m = ai.mem.get(t.id);
        if (m && m.visible && tDet == null) tDet = w.time - t0;
        return ai.stats.shots > 0;
      });
      if (tDet != null) { found++; det.push(tDet); }
      if (ai.stats.shots > 0) shot.push(ai.lastShotT - t0);
      rts.push(...ai.stats.reactions);
    }
    out[c.k] = { found: found / n, det: q(det, 0.5), shot50: q(shot, 0.5), shot10: q(shot, 0.1), shot90: q(shot, 0.9), rt: q(rts, 0.5), rtSd: Math.sqrt(mean(rts.map((x) => (x - mean(rts)) ** 2))) };
  }
  console.log('\nS1 reaction (appearance → detection → first shot)');
  for (const [k, v] of Object.entries(out)) console.log(`  ${k.padEnd(18)} spotted ${pct(v.found).padStart(4)}  detect ${ms(v.det).padStart(7)}  first shot p10/p50/p90 ${ms(v.shot10)}/${ms(v.shot50)}/${ms(v.shot90)}  motor RT ${ms(v.rt)} ±${ms(v.rtSd)}`);
  check('lit 20m: first shot median (human 350–750ms)', out['lit 20m'].shot50, 0.35, 0.75, ms);
  check('lit 20m: spread p90-p10 > 150ms (not robotic)', out['lit 20m'].shot90 - out['lit 20m'].shot10, 0.15, 2, ms);
  check('lit 50m: slower than 20m', out['lit 50m'].shot50 - out['lit 20m'].shot50, 0.03, 2, ms);
  check('dark, still, 20m: rarely spotted in 8s', out['dark 20m still'].found, 0, 0.35, pct);
  check('dark, walking: usually spotted', out['dark 20m walking'].found, 0.55, 1, pct);
  check('dark, firing: muzzle flash gives you away', out['dark 25m firing'].found, 0.9, 1, pct);
  check('motor reaction median (human 200–320ms)', out['lit 20m'].rt, 0.2, 0.32, ms);
  return out;
}

// ---------------------------------------------------------------------------
//  S2  Marksmanship vs distance, calm and under suppression
// ---------------------------------------------------------------------------
function sAccuracy() {
  const ds = [10, 25, 50, 100], calm = {}, supp = {}, first = {};
  for (const d of ds) for (const stressed of [false, true]) {
    let shots = 0, hits = 0, fShots = 0, fHits = 0;
    for (let s = 0; s < N(40); s++) {
      const w = openWorld(2000 + s + d * 7);
      const ai = new Agent(w, { team: 'red', pos: v3(0, 0, 0), yaw: 0 });
      ai.think = () => {}; ai.action = { type: 'engage', since: 0, minUntil: 1e9 };
      ai.W.reloadTac = ai.W.reloadEmpty = 0.01;
      const t = dummy(w, v3(w.rand.range(-2, 2), 0, -d));
      const hitsBefore = () => ai.stats.hits;
      let firstDone = false;
      if (stressed) { let nx = 0; t.script = (me, dt, world) => { if (world.time > nx) { nx = world.time + 0.25; ai.onNearMiss(0.4, me, world); } }; }
      run(w, 6, () => {
        if (!firstDone && ai.stats.shots >= 1) { firstDone = true; fShots++; if (hitsBefore() >= 1) fHits++; }
        return false;
      });
      shots += ai.stats.shots; hits += ai.stats.hits;
    }
    (stressed ? supp : calm)[d] = hits / Math.max(1, shots);
    if (!stressed) first[d] = fHits / Math.max(1, fShots);
  }
  console.log('\nS2 marksmanship (static standing target, AI stationary)');
  for (const d of ds) console.log(`  ${String(d).padStart(3)}m  hit rate calm ${pct(calm[d]).padStart(4)}   suppressed ${pct(supp[d]).padStart(4)}   first shot ${pct(first[d]).padStart(4)}`);
  check('10m hit rate (rapid unsupported: 65–95%)', calm[10], 0.65, 0.95, pct);
  check('25m hit rate (rapid unsupported: 55–90%)', calm[25], 0.55, 0.9, pct);
  check('50m hit rate (crouched rapid: 50–85%)', calm[50], 0.5, 0.85, pct);
  check('100m hit rate (rapid unsupported: 15–50%)', calm[100], 0.15, 0.5, pct);
  check('suppression hurts accuracy at 25m (≥20% relative)', 1 - supp[25] / calm[25], 0.2, 0.95, pct);
  return { calm, supp, first };
}

// ---------------------------------------------------------------------------
//  S3  Taking cover under fire / reload discipline
// ---------------------------------------------------------------------------
const EXPO = {};
function sCover() {
  let survive = 0, react = [], coveredFrac = [], idleCov = [], hitRuns = 0, reloads = 0, exposed = 0, arrivals = 0, good = 0;
  const n = N(60);
  for (let s = 0; s < n; s++) {
    const w = yard(3000 + s);
    const start = v3(w.rand.range(-14, 14), 0, w.rand.range(4, 7));
    const ai = new Agent(w, { team: 'red', pos: start, yaw: Math.PI });
    const enemy = dummy(w, v3(w.rand.range(-10, 10), 0, 30), { health: 1e9 });
    enemy.script = shooterScript(ai, { spread: 0.035, interval: 0.22 });
    let firstHit = null, tReact = null, cov = 0, tot = 0, icov = 0, itot = 0, firstFire = null;
    run(w, 12, () => {
      if (firstHit == null && ai.lastHurt) firstHit = w.time;
      if (firstHit != null && tReact == null && w.time - firstHit < 1.5 && (['cover', 'retreat'].includes(ai.action.type) || !ai.bodyPts().some((p) => w.los(enemy.eye(), p)))) tReact = w.time - firstHit;
      if (firstFire == null && enemy.lastShotT > 0) firstFire = w.time;
      if (firstFire != null) {
        const hidden = !ai.bodyPts().some((p) => w.los(enemy.eye(), p));
        tot++; if (hidden) cov++;
        if (w.time - ai.lastShotT > 0.5) { itot++; if (hidden) icov++; else { const k = ai.action.type + '/' + ai.stance + (ai.path ? '/moving' : ''); EXPO[k] = (EXPO[k] || 0) + 1; } }
      }
      return !ai.alive;
    });
    if (ai.alive) survive++;
    if (firstHit != null) hitRuns++;
    if (tReact != null) react.push(tReact);
    if (itot) idleCov.push(icov / itot);
    if (tot) coveredFrac.push(cov / tot);
    reloads += ai.stats.reloads; exposed += ai.stats.reloadsExposed; arrivals += ai.stats.coverArrivals; good += ai.stats.coverGood;
  }
  console.log('\nS3 caught in the open by a shooter at ~25m');
  console.log(`  after first hit: moved for cover ${pct(react.length / Math.max(1, hitRuns))} (median ${ms(q(react, 0.5))})  protected from the shooter ${pct(mean(coveredFrac))} of the fight, ${pct(mean(idleCov))} when not shooting  cover picks protective ${pct(good / Math.max(1, arrivals))}  survived 12s ${pct(survive / n)}  reloads exposed ${exposed}/${reloads}`);
  console.log('  exposed-and-not-shooting frames by state:', Object.entries(EXPO).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}:${v}`).join('  '));
  check('hit → hidden or moving to cover within 1.5s', react.length / Math.max(1, hitRuns), 0.65, 1, pct);
  check('reaction to being shot (median < 900ms)', q(react, 0.5), 0, 0.9, ms);
  check('chosen cover blocks the real shooter', good / Math.max(1, arrivals), 0.85, 1, pct);
  check('protected when not shooting (cover 6–10m away)', mean(idleCov), 0.4, 1, pct);
  return {};
}

// ---------------------------------------------------------------------------
//  S4  Hearing: threats outside the field of view
// ---------------------------------------------------------------------------
function sHearing() {
  const conds = [['footsteps (walk) 6m behind', 'walk', 6], ['footsteps (sprint) 14m behind', 'sprint', 14], ['crouch-walk 5m behind', 'crouch', 5], ['gunshot 40m behind', 'shot', 40]];
  const out = {};
  for (const [k, kind, d] of conds) {
    let turned = 0, spotted = 0; const tt = []; const n = N(40);
    for (let s = 0; s < n; s++) {
      const w = openWorld(4000 + s);
      const ai = new Agent(w, { team: 'red', pos: v3(0, 0, 0), yaw: 0 });
      ai.mission = 'guard'; // a sentry, not a hunter
      const t = dummy(w, v3(w.rand.range(-2, 2), 0, d));
      const sp = { walk: 2.0, sprint: 5.4, crouch: 1.3, shot: 0 }[kind];
      t.stance = kind === 'crouch' ? 'crouch' : 'stand';
      let nx = 0.5;
      t.script = (me, dt, world) => {
        me.vel = v3(Math.sin(world.time * 2) * sp, 0, 0);
        if (kind === 'shot' && world.time > nx) { nx = world.time + 3; me.lastShotT = world.time; world.emitSound(me.pos, 260, 'shot', me.id); }
      };
      let tTurn = null;
      run(w, 5, () => {
        const facing = Math.abs(wrap(anglesTo(ai.eye(), t.eye()).yaw - ai.look.yaw)) < 0.5;
        if (facing && tTurn == null) tTurn = w.time;
        return false;
      });
      if (tTurn != null) { turned++; tt.push(tTurn); }
      if (ai.mem.get(t.id)?.source === 'sight' || ai.mem.get(t.id)?.visible) spotted++;
    }
    out[k] = { turned: turned / n, t: q(tt, 0.5), spotted: spotted / n };
  }
  console.log('\nS4 hearing (source behind the AI)');
  for (const [k, v] of Object.entries(out)) console.log(`  ${k.padEnd(30)} turned to look ${pct(v.turned).padStart(4)} (median ${ms(v.t)})  then saw it ${pct(v.spotted)}`);
  check('hears a walker close behind', out['footsteps (walk) 6m behind'].turned, 0.7, 1, pct);
  check('hears a sprinter at 14m', out['footsteps (sprint) 14m behind'].turned, 0.7, 1, pct);
  check('crouch-walking is (mostly) silent', out['crouch-walk 5m behind'].turned, 0, 0.45, pct);
  check('reacts to gunshots behind', out['gunshot 40m behind'].turned, 0.8, 1, pct);
  return out;
}

// ---------------------------------------------------------------------------
//  S5  No-cheat test: does the AI hunt where you ARE or where it last had evidence?
// ---------------------------------------------------------------------------
function sNoCheat() {
  let towardOld = 0, towardNew = 0, found = 0; const n = N(40);
  for (let s = 0; s < n; s++) {
    const w = yard(5000 + s);
    const ai = new Agent(w, { team: 'red', pos: v3(-12, 0, 12), yaw: 0 });
    const t = dummy(w, v3(-12, 0, -5));
    // seen briefly, then the target slips behind the container...
    run(w, 1.5);
    t.pos = v3(0, 0, -4); run(w, 0.3);
    // ...and secretly teleports to the far side of the map (no sound, no sight)
    t.pos = v3(w.rand() < 0.5 ? 20 : -20, 0, -20);
    const lkp = ai.mem.get(t.id)?.pos;
    run(w, 10);
    if (!lkp) continue;
    const dOld = dist2d(ai.pos, v3(0, 0, -4)), dNew = dist2d(ai.pos, t.pos);
    if (dOld < dNew) towardOld++; else towardNew++;
    if (ai.mem.get(t.id)?.visible) found++;
  }
  console.log('\nS5 no-cheat check (target vanishes and silently relocates)');
  console.log(`  AI ended closer to the last evidence ${towardOld}/${towardOld + towardNew}, closer to the true hidden position ${towardNew}/${towardOld + towardNew}; re-acquired by luck ${found}/${n}`);
  check('hunts last-known position, not true position', towardOld / Math.max(1, towardOld + towardNew), 0.7, 1, pct);
  return { towardOld, towardNew };
}

// ---------------------------------------------------------------------------
//  S6  Squad tactics: two AIs vs one entrenched shooter behind a barrier
// ---------------------------------------------------------------------------
function sSquad() {
  let wins = 0, flanked = 0, suppressed = 0, times = [], losses = 0; const n = N(50);
  for (let s = 0; s < n; s++) {
    const w = yard(6000 + s);
    const a1 = new Agent(w, { team: 'red', pos: v3(-4, 0, 26), yaw: 0 });
    const a2 = new Agent(w, { team: 'red', pos: v3(4, 0, 26), yaw: 0 });
    const e = dummy(w, v3(0, 0, -17), { health: 100 });
    e.stance = 'crouch';
    // the squad was told roughly where the shooter is (like a radio report)
    for (const a of [a1, a2]) a.receiveCallout({ id: e.id, pos: v3(w.rand.range(-4, 4), 0, -16 + w.rand.range(-3, 3)), vel: v3(), t: 0 });
    e.script = (me, dt, world) => {
      const ais = [a1, a2].filter((a) => a.alive);
      const tgt = ais.sort((x, y) => dist2d(x.pos, me.pos) - dist2d(y.pos, me.pos))[0];
      if (tgt) me._f = me._f || shooterScript(tgt, { spread: 0.03, interval: 0.2, crouchPeek: true });
      if (tgt) me._f(me, dt, world);
      if (tgt && me._t !== tgt) { me._t = tgt; me._f = shooterScript(tgt, { spread: 0.03, interval: 0.2, crouchPeek: true }); }
    };
    run(w, 60, () => !e.alive || (!a1.alive && !a2.alive));
    if (!e.alive) { wins++; times.push(w.time); }
    if (!a1.alive && !a2.alive) losses++;
    if (a1.stats.flanks + a2.stats.flanks > 0) flanked++;
    if ((a1.stats.actions.suppress || 0) + (a2.stats.actions.suppress || 0) > 0) suppressed++;
  }
  console.log('\nS6 two AIs vs an entrenched shooter (peeking over a barrier)');
  console.log(`  squad won ${pct(wins / n)} (median ${q(times, 0.5).toFixed(1)}s)  wiped ${pct(losses / n)}  used a flank ${pct(flanked / n)}  used suppression ${pct(suppressed / n)}`);
  check('squad attempts flanks against a dug-in enemy', flanked / n, 0.4, 1, pct);
  check('squad wins most of these', wins / n, 0.5, 1, pct);
  return { wins: wins / n, flanked: flanked / n };
}

// ---------------------------------------------------------------------------
//  S7  Duels: AI operator vs AI player-profile, and 2v2 brawls (stability + balance)
// ---------------------------------------------------------------------------
function sDuels() {
  let redWins = 0, draws = 0, ttk = [], heads = 0, kills = 0, switchesPerMin = [], stuck = 0, nan = 0, ff = 0, shots = 0, rl = 0, rlx = 0;
  const n = N(80);
  for (let s = 0; s < n; s++) {
    const w = yard(7000 + s);
    const reds = [new Agent(w, { team: 'red', pos: v3(-20, 0, 25), yaw: 0, profile: 'operator' }), new Agent(w, { team: 'red', pos: v3(-12, 0, 27), yaw: 0, profile: 'operator' })];
    const blues = [new Agent(w, { team: 'blue', pos: v3(20, 0, -25), yaw: Math.PI, profile: 'operator' }), new Agent(w, { team: 'blue', pos: v3(12, 0, -27), yaw: Math.PI, profile: 'operator' })];
    // give both sides a vague idea where the other spawned (like a real match start)
    for (const a of reds) a.receiveCallout({ id: blues[0].id, pos: v3(15, 0, -22), vel: v3(), t: 0 });
    for (const a of blues) a.receiveCallout({ id: reds[0].id, pos: v3(-15, 0, 22), vel: v3(), t: 0 });
    let firstContact = null;
    run(w, 120, () => {
      if (firstContact == null && w.events.some((e) => e.type === 'shot')) firstContact = w.time;
      return reds.every((a) => !a.alive) || blues.every((a) => !a.alive);
    });
    const rAlive = reds.some((a) => a.alive), bAlive = blues.some((a) => a.alive);
    if (rAlive && !bAlive) redWins++; else if (rAlive && bAlive) draws++;
    for (const e of w.events) if (e.type === 'kill') kills++;
    for (const e of w.events) if (e.type === 'hit' && e.part === 'head') heads++;
    if (firstContact != null) { const lastKill = w.events.filter((e) => e.type === 'kill').pop(); if (lastKill) ttk.push(lastKill.t - firstContact); }
    for (const a of [...reds, ...blues]) {
      switchesPerMin.push(a.stats.actionSwitches / (w.time / 60));
      stuck += a.stats.stuckEvents; rl += a.stats.reloads; rlx += a.stats.reloadsExposed;
      if (![a.pos.x, a.pos.z, a.look.yaw].every(Number.isFinite)) nan++;
    }
    ff += w.stats.friendlyHits; shots += w.stats.shots;
  }
  console.log('\nS7 2v2 firefights in the yard (both sides: same AI)');
  console.log(`  red/blue/draw ${redWins}/${n - redWins - draws}/${draws}  fight length median ${q(ttk, 0.5).toFixed(1)}s  head hits ${heads}  kills ${kills}  decisions changed ${mean(switchesPerMin).toFixed(1)}/min  stuck events ${stuck}  friendly hits ${ff}/${shots} shots  NaN ${nan}`);
  console.log(`  reloads: ${rl}, of which with an enemy able to see the reloader: ${rlx} (${pct(rlx / Math.max(1, rl))})`);
  check('reloads done where an enemy can see you (≤ 25%)', rlx / Math.max(1, rl), 0, 0.25, pct);
  check('mirror match is balanced (red win share)', redWins / Math.max(1, n - draws), 0.3, 0.7, pct);
  check('fights resolve (few draws in 2 min)', draws / n, 0, 0.25, pct);
  check('no dithering (< 40 decision changes/min)', mean(switchesPerMin), 0, 40);
  check('friendly fire rare', ff / Math.max(1, shots), 0, 0.02, pct);
  check('no NaN', nan, 0, 0, (x) => String(x));
  check('stuck events per match', stuck / n, 0, 0.6);
  return { redWins, draws, ttk: q(ttk, 0.5) };
}

if (process.argv.includes('trace-cover')) {
  for (const seed of (process.env.SEEDS || '3000,3001,3002').split(',').map(Number)) {
    const w = yard(seed);
    const start = v3(w.rand.range(-14, 14), 0, w.rand.range(4, 7));
    const ai = new Agent(w, { team: 'red', pos: start, yaw: Math.PI });
    const enemy = dummy(w, v3(w.rand.range(-10, 10), 0, 30), { health: 1e9 });
    enemy.script = shooterScript(ai, { spread: 0.035, interval: 0.22 });
    let last = '';
    for (let i = 0; i < 360 && ai.alive; i++) {
      w.step(DT);
      const m = ai.mem.get(enemy.id);
      const line = `${ai.action.type}${ai.action.cover ? '→cover' : ''} path=${ai.path ? ai.path.length : 0} stance=${ai.stance} hp=${ai.health} sup=${ai.suppression.toFixed(2)} vis=${m ? m.visible : '-'}`;
      if (line !== last) { console.log(w.time.toFixed(2), `pos=(${ai.pos.x.toFixed(1)},${ai.pos.z.toFixed(1)})`, line); last = line; }
    }
    console.log('---', ai.alive ? 'alive' : 'dead', 'arrivals', ai.stats.coverArrivals, 'good', ai.stats.coverGood);
  }
  process.exit(0);
}
// ---------------------------------------------------------------------------
//  S8  Skill ladder: better shooters must win, but not every time
// ---------------------------------------------------------------------------
function sLadder() {
  const pairs = [['veteran', 'recruit'], ['operator', 'recruit'], ['veteran', 'operator']];
  const NN = N(160);
  const out = {};
  for (const [a, b] of pairs) {
    let aw = 0, bw = 0; const n = NN;
    for (let s = 0; s < n; s++) {
      const w = yard(8000 + s);
      const flip = s % 2 === 0;
      const A = new Agent(w, { team: 'red', pos: flip ? v3(-18, 0, 25) : v3(18, 0, -25), yaw: flip ? 0 : Math.PI, profile: a });
      const B = new Agent(w, { team: 'blue', pos: flip ? v3(18, 0, -25) : v3(-18, 0, 25), yaw: flip ? Math.PI : 0, profile: b });
      A.receiveCallout({ id: B.id, pos: v3(B.pos.x * 0.7, 0, B.pos.z * 0.7), vel: v3(), t: 0 });
      B.receiveCallout({ id: A.id, pos: v3(A.pos.x * 0.7, 0, A.pos.z * 0.7), vel: v3(), t: 0 });
      run(w, 120, () => !A.alive || !B.alive);
      if (A.alive && !B.alive) aw++; else if (B.alive && !A.alive) bw++;
    }
    out[`${a} vs ${b}`] = aw / Math.max(1, aw + bw);
  }
  console.log('\nS8 1v1 skill ladder (win share of the first)');
  for (const [k, v] of Object.entries(out)) console.log(`  ${k.padEnd(22)} ${pct(v)}`);
  check('veteran beats recruit most of the time (65–95%)', out['veteran vs recruit'], 0.65, 0.95, pct);
  check('operator beats recruit (55–90%)', out['operator vs recruit'], 0.55, 0.9, pct);
  check('veteran vs operator is close-ish (45–75%)', out['veteran vs operator'], 0.45, 0.75, pct);
  return out;
}

// ---------------------------------------------------------------------------
//  S9  Hunt: a target hides in the dark somewhere near where it was last reported
// ---------------------------------------------------------------------------
function sHunt() {
  let found = 0, killed = 0, lost = 0; const tf = []; const n = N(50);
  for (let s = 0; s < n; s++) {
    const w = yard(9000 + s);
    const ai = new Agent(w, { team: 'red', pos: v3(0, 0, 28), yaw: 0 });
    const all = w.coverPts.filter((c) => c.p.z < -5).sort((a, b) => w.lightAt(a.p) - w.lightAt(b.p));
    const spots = all.slice(0, Math.max(1, Math.floor(all.length * 0.3)));
    const spot = spots[Math.floor(w.rand() * spots.length)].p;
    const t = dummy(w, spot, { health: 100 });
    t.stance = 'crouch';
    t.script = shooterScript(ai, { spread: 0.03, interval: 0.15, react: 0.45 }); // armed, waiting in ambush
    ai.receiveCallout({ id: t.id, pos: v3(spot.x + w.rand.normal(0, 4), 0, spot.z + w.rand.normal(0, 4)), vel: v3(), t: 0 });
    run(w, 45, () => { if (ai.mem.get(t.id)?.visible && !tf[s]) tf[s] = w.time; return !t.alive || !ai.alive; });
    if (tf[s]) found++;
    if (!ai.alive) lost++;
    if (!t.alive) killed++;
  }
  const times = tf.filter(Boolean);
  console.log('\nS9 hunt an armed defender hiding in the dark (rough report ±4m)');
  console.log(`  found ${pct(found / n)} (median ${q(times, 0.5).toFixed(1)}s)  hunter won ${pct(killed / n)}  hunter killed ${pct(lost / n)}`);
  check('hunter locates the hidden defender', found / n, 0.6, 1, pct);
  check('ambush stays dangerous: hunter win rate 25–80%', killed / n, 0.25, 0.8, pct);
  return { found: found / n };
}

const t0 = Date.now();
sLadder(); sHunt();
sReaction(); sAccuracy(); sCover(); sHearing(); sNoCheat(); sSquad(); sDuels();
console.log('\n=== SUMMARY ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(56)} ${r.fmt(r.value)}`);
console.log(`${results.filter((r) => r.ok).length}/${results.length} checks passed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
