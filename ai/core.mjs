// Night Range combat AI — standalone core (no rendering, no three.js).
//
// Design rule: an agent's *decisions* only ever read its own memory (built by perceive()),
// its own body state and the static map. perceive() is the single place that touches the
// truth (other agents' real positions), and it does so only through sight, hearing, being
// hit and squad callouts — so the AI cannot cheat by "knowing" where you are.

// ---------------------------------------------------------------------------
//  Math + RNG
// ---------------------------------------------------------------------------
export function rng(seed = 1) {
  let a = seed >>> 0;
  const f = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.range = (lo, hi) => lo + f() * (hi - lo);
  f.normal = (mu = 0, sd = 1) => { const u = 1 - f(), v = f(); return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  f.logn = (median, spread) => median * Math.exp(f.normal(0, spread));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
const sub = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const add = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const mul = (a, k) => v3(a.x * k, a.y * k, a.z * k);
const len = (a) => Math.hypot(a.x, a.y, a.z);
const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const norm = (a) => { const l = len(a) || 1; return v3(a.x / l, a.y / l, a.z / l); };
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
// yaw 0 looks toward -z (same convention as the game camera); pitch + is up
const dirOf = (yaw, pitch) => v3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
const anglesTo = (from, to) => { const d = sub(to, from); return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) }; };
const angBetween = (a, b) => Math.acos(clamp((a.x * b.x + a.y * b.y + a.z * b.z) / ((len(a) * len(b)) || 1), -1, 1));
export const util = { v3, sub, add, mul, len, norm, dist2d, dirOf, anglesTo, angBetween, wrap };

// ---------------------------------------------------------------------------
//  Tunables (one place, so the test harness can sweep them)
// ---------------------------------------------------------------------------
export const TUNE = {
  body: { standEye: 1.65, crouchEye: 1.12, duckEye: 0.84, standTop: 1.8, crouchTop: 1.25, duckTop: 0.97, radius: 0.24 },
  speed: { sprint: 5.4, run: 3.8, walk: 2.0, crouch: 1.3, accel: 14 },
  vision: { fovHalf: 1.75, foveal: 0.26, rate: 5.0, distScale: 38, decay: 0.6, glimpse: 0.3, darkFloor: 0.018, moveFloor: 0.16, flash: 15 },
  hearing: { gunshot: 260, suppressed: 45, sprint: 20, run: 13, walk: 7, crouch: 2.5, impact: 12, reload: 6, occlusion: 0.45 },
  memory: { predict: 1.2, growth: 1.1 },
  callout: { delay: [0.6, 1.3], error: 1.2 },
  think: { interval: [0.22, 0.42], commit: 0.18 },
  aim: { react: 0.235, reactSpread: 0.22, fittsA: 0.08, fittsB: 0.075, overshoot: 0.05, gainSd: 0.07, lateralSd: 0.03, motorSd: 0.0018,
    correctDelay: 0.075, trackGain: 7.5, swayStill: 0.0042, swayMove: 0.011, recoilComp: 5, flinch: 0.0026 },
  weapon: { rpm: 750, cap: 30, spread: 0.0016, kick: 0.0105, kickYaw: 0.0045, dmg: { head: 100, torso: 34, legs: 22 }, reloadTac: 2.3, reloadEmpty: 2.8, range: 300 },
  suppression: { perMiss: 0.16, missRadius: 1.6, decay: 0.28, hurt: 0.45 },
};

// ---------------------------------------------------------------------------
//  World: static geometry, lights, nav grid, sound + ballistics
// ---------------------------------------------------------------------------
export class World {
  constructor({ w = 80, h = 80, boxes = [], lights = [], ambient = 0.03, seed = 1, cell = 0.5 } = {}) {
    this.w = w; this.h = h; this.boxes = boxes; this.lights = lights; this.ambient = ambient;
    this.rand = rng(seed); this.cell = cell; this.time = 0;
    this.agents = []; this.sounds = []; this.events = []; this.callouts = []; this.tracers = []; this.soundLog = [];
    this.stats = { shots: 0, hits: 0, wallHitsThroughCover: 0, friendlyHits: 0, coverHits: 0 };
    this.buildNav();
    this.coverPts = this.buildCoverPoints();
  }
  inBounds(p) { return Math.abs(p.x) < this.w / 2 - 0.5 && Math.abs(p.z) < this.h / 2 - 0.5; }
  lightAt(p) {
    let L = this.ambient;
    for (const l of this.lights) {
      const d2 = (p.x - l.x) ** 2 + (p.z - l.z) ** 2;
      if (d2 > (l.r * 2.2) ** 2) continue;
      L += l.i / (1 + d2 / (l.r * l.r * 0.35)) * clamp(1 - Math.sqrt(d2) / (l.r * 2.2), 0, 1);
    }
    return Math.min(1.5, L);
  }
  // first hit parameter t∈[0,1] of segment a→b against any box, or Infinity
  segHit(a, b, ignoreLow = false) {
    let best = Infinity;
    const d = sub(b, a);
    for (const bx of this.boxes) {
      if (ignoreLow && bx.h < 1.3) continue;
      let t0 = 0, t1 = 1;
      const lo = [bx.x0, 0, bx.z0], hi = [bx.x1, bx.h, bx.z1], o = [a.x, a.y, a.z], dd = [d.x, d.y, d.z];
      let ok = true;
      for (let k = 0; k < 3; k++) {
        if (Math.abs(dd[k]) < 1e-9) { if (o[k] < lo[k] || o[k] > hi[k]) { ok = false; break; } continue; }
        let ta = (lo[k] - o[k]) / dd[k], tb = (hi[k] - o[k]) / dd[k];
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 < best) best = t0;
    }
    return best;
  }
  los(a, b) { return this.segHit(a, b) === Infinity; }
  // ---- navigation grid ----
  buildNav() {
    const c = this.cell; this.cols = Math.round(this.w / c); this.rows = Math.round(this.h / c);
    this.blocked = new Uint8Array(this.cols * this.rows);
    const pad = TUNE.body.radius + 0.12;
    for (let j = 0; j < this.rows; j++) for (let i = 0; i < this.cols; i++) {
      const x = -this.w / 2 + (i + 0.5) * c, z = -this.h / 2 + (j + 0.5) * c;
      if (i === 0 || j === 0 || i === this.cols - 1 || j === this.rows - 1) { this.blocked[j * this.cols + i] = 1; continue; }
      for (const b of this.boxes) if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad) { this.blocked[j * this.cols + i] = 1; break; }
    }
  }
  cellOf(p) { return [clamp(Math.floor((p.x + this.w / 2) / this.cell), 0, this.cols - 1), clamp(Math.floor((p.z + this.h / 2) / this.cell), 0, this.rows - 1)]; }
  cellPos(i, j) { return v3(-this.w / 2 + (i + 0.5) * this.cell, 0, -this.h / 2 + (j + 0.5) * this.cell); }
  free(p) { const [i, j] = this.cellOf(p); return !this.blocked[j * this.cols + i]; }
  nearestFree(p) {
    if (this.free(p)) return p;
    const [i0, j0] = this.cellOf(p);
    for (let r = 1; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const i = i0 + di, j = j0 + dj;
      if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) continue;
      if (!this.blocked[j * this.cols + i]) return this.cellPos(i, j);
    }
    return p;
  }
  // A* with an optional extra per-cell cost (used for exposure-aware tactical paths)
  path(from, to, extraCost = null) {
    const C = this.cols, R = this.rows;
    const s = this.cellOf(this.nearestFree(from)), g = this.cellOf(this.nearestFree(to));
    const si = s[1] * C + s[0], gi = g[1] * C + g[0];
    const gs = new Float32Array(C * R).fill(Infinity), came = new Int32Array(C * R).fill(-1), closed = new Uint8Array(C * R);
    const heap = []; // binary heap of [f, idx]
    const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const h = (i) => Math.hypot((i % C) - g[0], Math.floor(i / C) - g[1]);
    gs[si] = 0; push(h(si), si);
    let iter = 0;
    while (heap.length && iter++ < 40000) {
      const [, cur] = pop();
      if (cur === gi) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % C, cz = Math.floor(cur / C);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= C || nz >= R) continue;
        const ni = nz * C + nx;
        if (this.blocked[ni] || closed[ni]) continue;
        if (dx && dz && (this.blocked[cz * C + nx] || this.blocked[nz * C + cx])) continue;
        const step = dx && dz ? 1.414 : 1;
        const ng = gs[cur] + step + (extraCost ? extraCost(nx, nz) * step : 0);
        if (ng < gs[ni]) { gs[ni] = ng; came[ni] = cur; push(ng + h(ni), ni); }
      }
    }
    if (came[gi] === -1 && si !== gi) return null;
    const cells = [];
    for (let k = gi; k !== -1; k = came[k]) { cells.push(k); if (k === si) break; }
    cells.reverse();
    const pts = cells.map((k) => this.cellPos(k % C, Math.floor(k / C)));
    pts[pts.length - 1] = this.nearestFree(to);
    if (extraCost) return pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1); // keep the tactical shape
    // string-pull smoothing at knee height
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.walkable(pts[i], pts[j])) j--;
      out.push(pts[j]); i = j;
    }
    return out;
  }
  walkable(a, b) {
    const n = Math.ceil(dist2d(a, b) / (this.cell * 0.5));
    for (let k = 1; k < n; k++) if (!this.free(v3(lerp(a.x, b.x, k / n), 0, lerp(a.z, b.z, k / n)))) return false;
    return true;
  }
  // candidate cover spots around every box (crouch-protected from some direction)
  buildCoverPoints() {
    const pts = [];
    for (const b of this.boxes) {
      const off = TUNE.body.radius + 0.35, step = 0.8;
      for (let x = b.x0; x <= b.x1 + 1e-6; x += step) { pts.push({ p: v3(x, 0, b.z0 - off), box: b, n: v3(0, 0, 1) }); pts.push({ p: v3(x, 0, b.z1 + off), box: b, n: v3(0, 0, -1) }); }
      for (let z = b.z0; z <= b.z1 + 1e-6; z += step) { pts.push({ p: v3(b.x0 - off, 0, z), box: b, n: v3(1, 0, 0) }); pts.push({ p: v3(b.x1 + off, 0, z), box: b, n: v3(-1, 0, 0) }); }
    }
    return pts.filter((c) => this.inBounds(c.p) && this.free(c.p));
  }
  emitSound(pos, range, kind, src) {
    this.sounds.push({ pos: { ...pos }, range, kind, src, t: this.time });
    if (this.recordTracers) { this.soundLog.push({ pos: { ...pos }, range, kind, t: this.time }); if (this.soundLog.length > 120) this.soundLog.shift(); }
  }
  // instant ballistics (bullets at 30-80 m arrive in <0.1 s)
  shoot(shooter, origin, dir, W) {
    this.stats.shots++;
    const end = add(origin, mul(dir, W.range));
    const tBox = this.segHit(origin, end);
    let best = { t: tBox * W.range, agent: null };
    for (const a of this.agents) {
      if (a === shooter || !a.alive) continue;
      const top = a.top();
      // ray vs vertical cylinder
      const ox = origin.x - a.pos.x, oz = origin.z - a.pos.z, r = TUNE.body.radius;
      const A = dir.x * dir.x + dir.z * dir.z, B = 2 * (ox * dir.x + oz * dir.z), Cc = ox * ox + oz * oz - r * r;
      const disc = B * B - 4 * A * Cc;
      // near-miss suppression (closest approach to the chest)
      const chest = v3(a.pos.x, (a.pos.y || 0) + top * 0.7, a.pos.z), w = sub(chest, origin), tc = w.x * dir.x + w.y * dir.y + w.z * dir.z;
      if (tc > 0 && tc < best.t) {
        const cp = add(origin, mul(dir, tc)), miss = len(sub(cp, chest));
        if (miss < TUNE.suppression.missRadius && a.team !== shooter.team) a.onNearMiss(miss, shooter, this);
      }
      if (disc < 0 || A < 1e-9) continue;
      const t = (-B - Math.sqrt(disc)) / (2 * A);
      if (t < 0 || t >= best.t) continue;
      const y = origin.y + dir.y * t;
      if (y < (a.pos.y || 0) || y > (a.pos.y || 0) + top) continue;
      best = { t, agent: a, y };
    }
    const hitPt = add(origin, mul(dir, Math.min(best.t, W.range)));
    if (this.recordTracers) { this.tracers.push({ a: { ...origin }, b: hitPt, t: this.time, team: shooter.team, hit: !!best.agent }); if (this.tracers.length > 200) this.tracers.shift(); }
    if (best.agent) {
      const a = best.agent, top = a.top();
      const ry = best.y - (a.pos.y || 0), part = ry > top - 0.26 ? 'head' : ry > top * 0.5 ? 'torso' : 'legs';
      this.stats.hits++;
      if (a.team === shooter.team) this.stats.friendlyHits++;
      a.onHit(W.dmg[part], part, shooter, dir, this);
      this.events.push({ t: this.time, type: 'hit', from: shooter.id, to: a.id, part });
      return { hit: a, part, point: hitPt };
    }
    if (tBox !== Infinity) { this.stats.coverHits++; this.emitSound(hitPt, TUNE.hearing.impact, 'impact', shooter.id); }
    return { hit: null, point: hitPt };
  }
  step(dt) {
    this.time += dt;
    for (const c of this.callouts) if (c.at <= this.time && !c.done) { c.done = true; c.to.receiveCallout(c); }
    this.callouts = this.callouts.filter((c) => !c.done);
    const order = [...this.agents].sort(() => this.rand() - 0.5); // no first-mover bias
    for (const a of order) if (a.alive) a.perceive(dt, this);
    for (const a of order) if (a.alive) a.think(dt, this);
    for (const a of order) if (a.alive) a.act(dt, this);
    this.sounds = this.sounds.filter((s) => this.time - s.t < 0.2);
  }
}

// ---------------------------------------------------------------------------
//  Agent
// ---------------------------------------------------------------------------
let NEXT_ID = 1;
export const PROFILES = {
  operator: { skill: 0.75, aggression: 0.5, discipline: 0.8, reaction: 1.0 },
  recruit: { skill: 0.3, aggression: 0.55, discipline: 0.3, reaction: 1.3 },
  veteran: { skill: 0.88, aggression: 0.55, discipline: 0.9, reaction: 0.92 },
  player: { skill: 0.65, aggression: 0.65, discipline: 0.6, reaction: 1.0 },
};

export class Agent {
  constructor(world, { team = 'red', pos = v3(), yaw = 0, profile = 'operator', name, patrol = null, controller = 'ai', seed } = {}) {
    this.id = NEXT_ID++; this.name = name || `${team}${this.id}`; this.team = team;
    this.pos = v3(pos.x, 0, pos.z); this.vel = v3(); this.yaw = yaw;
    this.look = { yaw, pitch: 0 }; this.stance = 'stand'; this.moveMode = 'walk';
    this.health = 100; this.alive = true; this.controller = controller;
    this.prof = { ...(PROFILES[profile] || profile) };
    this.r = rng(seed ?? (world.rand() * 1e9) | 0);
    this.W = { ...TUNE.weapon, mag: TUNE.weapon.cap, chamber: 1 };
    this.reloadUntil = 0; this.nextShotT = 0; this.burstLeft = 0; this.burstPauseUntil = 0;
    this.mem = new Map();      // enemyId -> memory record (everything the agent *believes*)
    this.sus = new Map();      // enemyId -> detection accumulator
    this.suppression = 0; this.lastHurt = null; this.lastShotT = -9;
    this.action = { type: 'idle', since: 0, minUntil: 0 }; this.nextThink = 0;
    this.path = null; this.pathIdx = 0; this.dest = null;
    this.aim = { mode: 'free', targetId: null, point: null, reactUntil: 0, from: null, to: null, t0: 0, dur: 0, correctAt: 0, ou: { x: 0, y: 0 }, recoil: { p: 0, y: 0 } };
    this.patrol = patrol; this.patrolIdx = 0; this.searchPts = []; this.peek = { up: true, until: 0 };
    this.mission = 'hunt'; this.visited = []; // hunt = keep clearing the area when contact is lost
    this.stats = { shots: 0, hits: 0, reactions: [], firstShotTimes: [], reloadsExposed: 0, reloads: 0, actions: {}, actionSwitches: 0, coverArrivals: 0, coverGood: 0,
      flanks: 0, detections: [], stuckEvents: 0, overshoots: 0, flicks: 0, damageTaken: 0 };
    this.stuck = { t: 0, ref: v3(pos.x, 0, pos.z) };
    this.script = null; // for test dummies
    world.agents.push(this);
  }
  eye() { const B = TUNE.body; return v3(this.pos.x, (this.pos.y || 0) + (this.stance === 'duck' ? B.duckEye : this.stance === 'crouch' ? B.crouchEye : B.standEye), this.pos.z); }
  top() { const B = TUNE.body; return this.stance === 'duck' ? B.duckTop : this.stance === 'crouch' ? B.crouchTop : B.standTop; }
  bodyPts() { const t = this.top(), y = this.pos.y || 0; return [v3(this.pos.x, y + t - 0.12, this.pos.z), v3(this.pos.x, y + t * 0.7, this.pos.z), v3(this.pos.x, y + t * 0.42, this.pos.z)]; }
  speed() { return Math.hypot(this.vel.x, this.vel.z); }
  enemies(world) { return world.agents.filter((a) => a.team !== this.team); }

  // =========================== PERCEPTION ===========================
  perceive(dt, world) {
    if (this.controller !== 'ai') return;
    const now = world.time, V = TUNE.vision, eye = this.eye(), lookDir = dirOf(this.look.yaw, this.look.pitch);
    for (const o of this.enemies(world)) {
      let m = this.mem.get(o.id);
      if (!o.alive) { if (m && m.visible && !m.dead) { m.dead = true; m.visible = false; } continue; }
      const pts = o.bodyPts();
      let vis = 0, seenPt = null;
      for (const p of pts) if (world.los(eye, p)) { vis++; seenPt = seenPt || p; }
      let s = this.sus.get(o.id) || 0;
      const d = dist2d(this.pos, o.pos);
      if (vis > 0 && d < (V.range || 250)) {
        const toO = sub(seenPt, eye), off = angBetween(lookDir, toO);
        const flash = now - o.lastShotT < 0.09 && !o.suppressed;
        if (off < V.fovHalf) {
          const acuity = off < V.foveal ? 1 : off < 0.7 ? 0.55 : off < 1.2 ? 0.25 : 0.1;
          const moving = o.speed() > 0.6;
          const light = clamp((world.lightAt(o.pos) - 0.02) / 0.3, 0, 1);
          const eff = Math.max(light, moving ? V.moveFloor : V.darkFloor);
          const size = (vis / 3) * (o.stance === 'stand' ? 1 : o.stance === 'crouch' ? 0.75 : 0.55);
          const distF = 1 / (1 + (d / V.distScale) ** 2);
          // trained eyes pick out shapes and movement faster (situational awareness)
          let rate = V.rate * acuity * eff * size * distF * (moving ? 1.6 : 1) * (1 - 0.45 * this.suppression) * (0.55 + 0.6 * this.prof.skill);
          if (m && m.visible) rate *= 3; // already tracking
          rate *= 1 - (o.conceal || 0);   // blending into a crowd (host-supplied, 0..1)
          if (flash) rate += V.flash * Math.sqrt(acuity) * (1 / (1 + d / 120));
          s = Math.min(1.6, s + rate * dt);
        } else s = Math.max(0, s - V.decay * dt);
        // seen
        if (s >= 1) {
          const err = d * 0.01 * (1 - clamp(world.lightAt(o.pos), 0, 1));
          const pos = v3(o.pos.x + this.r.normal(0, err), o.pos.y || 0, o.pos.z + this.r.normal(0, err));
          const firstContact = !m || (!m.visible && now - m.t > 3);
          if (!m) { m = { id: o.id }; this.mem.set(o.id, m); }
          if (firstContact) { m.firstSeenT = now; this.stats.detections.push({ t: now, d, light: world.lightAt(o.pos) }); }
          m.vel = m.visible && m.pos ? mul(sub(pos, m.pos), 1 / Math.max(dt, 1e-3)) : v3();
          m.vel = v3(clamp(o.vel.x, -6, 6), 0, clamp(o.vel.z, -6, 6)); // motion is perceived directly while visible
          Object.assign(m, { pos, t: now, visible: true, conf: 1, source: 'sight', stance: o.stance, exposure: vis / 3, dead: false, inCover: vis < 3 });
          if (firstContact) this.callout(world, m);
          else if (now - (m.lastCallout || 0) > 2.5) this.callout(world, m);
        } else if (s >= V.glimpse && (!m || !m.visible)) {
          // something moved over there: rough position, not yet identified
          const err = d * 0.08;
          if (!m) { m = { id: o.id, conf: 0 }; this.mem.set(o.id, m); }
          if (!m.t || now - m.t > 1) Object.assign(m, { pos: v3(o.pos.x + this.r.normal(0, err), o.pos.y || 0, o.pos.z + this.r.normal(0, err)), vel: v3(), t: now, visible: false, conf: Math.max(m.conf || 0, 0.35), source: 'glimpse' });
        } else if (m && m.visible) m.visible = false;
      } else {
        s = Math.max(0, s - V.decay * dt);
        if (m && m.visible) { m.visible = false; }
      }
      this.sus.set(o.id, s);
    }
    // hearing
    const Hh = TUNE.hearing;
    for (const snd of world.sounds) {
      if (snd.heardBy && snd.heardBy.has(this.id)) continue;
      (snd.heardBy ||= new Set()).add(this.id);
      const src = world.agents.find((a) => a.id === snd.src);
      if (!src || src === this) continue;
      const d = dist2d(this.pos, snd.pos);
      const occ = world.los(eye, v3(snd.pos.x, 1.2, snd.pos.z)) ? 1 : Hh.occlusion;
      if (d > snd.range * occ) continue;
      if (src.team === this.team) continue;
      const m0 = this.mem.get(src.id);
      if (m0 && m0.visible) continue;
      const err = d * (snd.kind === 'shot' ? 0.06 : snd.kind === 'impact' ? 0.25 : 0.12);
      let pos = v3(snd.pos.x + this.r.normal(0, err), 0, snd.pos.z + this.r.normal(0, err));
      if (snd.kind === 'impact') pos = this.guessShooterFromImpact(snd, world) || pos;
      const m = m0 || { id: src.id, conf: 0 };
      if (!m0) this.mem.set(src.id, m);
      if (!m.t || now - m.t > 0.5 || m.source !== 'sight') {
        Object.assign(m, { pos, vel: v3(), t: now, visible: false, conf: Math.max(snd.kind === 'shot' ? 0.6 : 0.4, m.conf * 0.8), source: snd.kind === 'shot' ? 'gunshot' : 'noise' });
      }
      if (!this.attentionUntil || now > this.attentionUntil - 0.5) { this.attention = { ...pos }; this.attentionUntil = now + 1.6; }
    }
    this.suppression = Math.max(0, this.suppression - TUNE.suppression.decay * dt * (now - (this.lastSuppressedT || 0) > 1.5 ? 1.6 : 0.6));
    // forget very old, low-confidence info
    for (const [id, m] of this.mem) if (!m.visible && now - m.t > 60) this.mem.delete(id);
  }
  guessShooterFromImpact() { return null; } // impacts tell you you're being shot at, not from where
  onNearMiss(miss, shooter, world) {
    this.suppression = Math.min(1, this.suppression + TUNE.suppression.perMiss * (1 - miss / TUNE.suppression.missRadius) * 1.5);
    this.lastSuppressedT = world.time;
    this.stats.nearMisses = (this.stats.nearMisses || 0) + 1;
    // you hear the crack and roughly the direction it came from
    if (this.controller === 'ai') this.noteDirection(shooter, world, 0.3);
  }
  onHit(dmg, part, shooter, dir, world) {
    this.health -= dmg; this.stats.damageTaken += dmg;
    this.suppression = Math.min(1, this.suppression + TUNE.suppression.hurt);
    this.lastHurt = { t: world.time };
    this.lastSuppressedT = world.time;
    if (this.health <= 0) { this.alive = false; this.health = 0; world.events.push({ t: world.time, type: 'kill', from: shooter.id, to: this.id }); return; }
    if (this.controller === 'ai') this.noteDirection(shooter, world, 0.35);
  }
  // knowledge of an incoming direction only: bearing ±error, range unknown (guess)
  noteDirection(shooter, world, angErr) {
    const m = this.mem.get(shooter.id);
    if (m && m.visible) return;
    const b = Math.atan2(shooter.pos.x - this.pos.x, shooter.pos.z - this.pos.z) + this.r.normal(0, angErr);
    const guess = m && world.time - m.t < 8 ? dist2d(this.pos, m.pos) : this.r.range(15, 45);
    const pos = v3(this.pos.x + Math.sin(b) * guess, 0, this.pos.z + Math.cos(b) * guess);
    const rec = m || { id: shooter.id, conf: 0 };
    if (!m) this.mem.set(shooter.id, rec);
    Object.assign(rec, { pos, vel: v3(), t: world.time, visible: false, conf: Math.max(rec.conf * 0.9, 0.45), source: 'incoming' });
    this.attention = { ...pos }; this.attentionUntil = world.time + 1.2;
  }
  callout(world, m) {
    m.lastCallout = world.time;
    for (const mate of world.agents) {
      if (mate === this || mate.team !== this.team || !mate.alive || mate.controller !== 'ai') continue;
      if (dist2d(mate.pos, this.pos) > 60) continue; // voice range
      const e = TUNE.callout.error;
      world.callouts.push({ at: world.time + this.r.range(...TUNE.callout.delay), to: mate, id: m.id, from: this.id,
        pos: v3(m.pos.x + this.r.normal(0, e), 0, m.pos.z + this.r.normal(0, e)), vel: { ...m.vel }, t: world.time });
    }
  }
  receiveCallout(c) {
    const m = this.mem.get(c.id);
    if (m && (m.visible || m.t >= c.t)) return;
    const rec = m || { id: c.id, conf: 0 };
    if (!m) this.mem.set(c.id, rec);
    Object.assign(rec, { pos: c.pos, vel: c.vel, t: c.t, visible: false, conf: Math.max(rec.conf || 0, 0.6), source: 'callout' });
  }

  // =========================== BELIEF HELPERS ===========================
  est(m, now) { const age = Math.min(now - m.t, TUNE.memory.predict); return v3(m.pos.x + m.vel.x * age, m.pos.y || 0, m.pos.z + m.vel.z * age); }
  uncertainty(m, now) { return 0.4 + TUNE.memory.growth * (now - m.t); }
  threat(now) {
    let best = null, bs = -Infinity;
    for (const m of this.mem.values()) {
      if (m.dead) continue;
      const age = now - m.t;
      if (age > 45) continue;
      const sc = (m.visible ? 4 : 0) + m.conf * 2 - age * 0.12 - dist2d(this.pos, m.pos) * 0.015;
      if (sc > bs) { bs = sc; best = m; }
    }
    return best;
  }
  // am I protected from point p (crouched chest hidden)?
  coveredFrom(world, p, pos = this.pos, stance = 'crouch') {
    // 'crouch' here means ducked behind cover (head tucked below the cover line)
    const chest = v3(pos.x, stance === 'crouch' ? 0.7 : 1.25, pos.z), head = v3(pos.x, stance === 'crouch' ? 0.95 : 1.65, pos.z);
    const from = v3(p.x, 1.55, p.z);
    return !world.los(from, chest) && !world.los(from, head);
  }

  // =========================== DECISION (utility AI) ===========================
  think(dt, world) {
    if (this.controller !== 'ai') return;
    const now = world.time;
    if (now < this.nextThink) return;
    this.nextThink = now + this.r.range(...TUNE.think.interval) * (1 + this.suppression * 0.4);
    const th = this.threat(now), P = this.prof;
    const W = this.W;
    const est = th ? this.est(th, now) : null;
    const d = est ? dist2d(this.pos, est) : Infinity;
    const age = th ? now - th.t : Infinity;
    const covered = est ? this.coveredFrom(world, est) : false;
    const hurt = this.lastHurt && now - this.lastHurt.t < 3;
    const magFrac = W.mag / W.cap;
    const reloading = now < this.reloadUntil;
    const mates = world.agents.filter((a) => a !== this && a.alive && a.team === this.team);
    const sc = {};
    sc.idle = 0.1;
    const stale = !th || now - th.t > 25;
    if (stale && this.mission === 'hunt' && !this.patrol) sc.roam = 0.3;
    if (!th) {
      sc.patrol = this.patrol ? 0.3 : 0;
      if (magFrac < 0.7 && !reloading) sc.reload = 0.5;
    } else {
      const visible = th.visible;
      sc.engage = visible ? 0.62 + 0.25 * P.aggression + (covered ? 0.05 : 0) - 0.45 * this.suppression - (this.health < 40 ? 0.2 : 0) - (W.mag === 0 ? 1 : 0)
        : age < 2.5 ? 0.42 + 0.1 * P.aggression : 0;
      // when a known threat is close and visible, fighting back beats running across its line of fire
      const exposedOpen = !covered;
      // trained instinct: caught in the open at range → get off the X before trading shots
      const underFire = now - (this.lastSuppressedT || -9) < 1.5;
      sc.cover = exposedOpen ? 0.22 + 0.2 * P.discipline + 0.75 * this.suppression + (hurt ? 0.45 : 0) + (visible && d > 12 ? 0.15 + 0.2 * P.discipline : 0) + (underFire ? 0.15 : 0) + (W.mag < 6 ? 0.25 : 0) - (visible && d < 8 ? 0.35 : 0) - P.aggression * 0.15 : 0;
      sc.reload = W.mag === 0 && !reloading ? (covered || !visible || this.noCover ? 0.95 : 0.3) : (!visible && magFrac < 0.5 && !reloading ? 0.55 + (covered ? 0.15 : -0.1) : 0);
      if (W.mag === 0 && exposedOpen && visible && !this.noCover) sc.cover += 0.6;
      const freshHit = this.lastHurt && now - this.lastHurt.t < 1.0;
      sc.retreat = this.health < 35 && (!covered || freshHit) && (visible || hurt) ? 0.55 + (1 - this.health / 35) * 0.3 : 0;
      const enemyDug = !visible && age > 2 && age < 20 && th.conf > 0.5;
      const someoneEngaging = mates.some((m) => ['engage', 'suppress'].includes(m.action.type));
      const someoneFlanking = mates.some((m) => m.action.type === 'flank');
      sc.flank = enemyDug && this.health > 50 && !someoneFlanking && mates.length ? 0.45 + 0.25 * P.aggression + (someoneEngaging ? 0.15 : 0) : 0;
      sc.suppress = !visible && age < 5 && someoneFlanking && W.mag > 8 ? 0.6 : 0;
      sc.search = !visible && age > 3 ? clamp(0.35 + 0.2 * P.aggression - age * 0.004, 0.15, 0.55) * (th.conf > 0.3 ? 1 : 0.6) : 0;
      sc.hold = !visible && age >= 2.5 && age < 15 ? 0.4 + 0.2 * P.discipline - 0.15 * P.aggression + (covered ? 0.1 : 0) : 0;
    }
    // commitment / hysteresis
    const cur = this.action.type;
    if (sc[cur] !== undefined) sc[cur] += now < this.action.minUntil ? 0.35 : TUNE.think.commit;
    let best = 'idle', bv = -Infinity;
    for (const [k, v] of Object.entries(sc)) if (v > bv) { bv = v; best = k; }
    if (best !== cur || (this.action.replan && now >= this.action.minUntil)) this.setAction(best, world, th, est);
  }
  setAction(type, world, th, est) {
    const now = world.time;
    if (type !== this.action.type) { this.stats.actionSwitches++; this.stats.actions[type] = (this.stats.actions[type] || 0) + 1; }
    this.action = { type, since: now, minUntil: now + ({ cover: 1.2, flank: 3, search: 4, retreat: 2, reload: 0.5, engage: 0.6, hold: 1.5, suppress: 1.5 }[type] || 0.5), threatId: th && th.id };
    this.path = null; this.dest = null;
    if (type === 'cover' || type === 'retreat') {
      const c = this.findCover(world, est, type === 'retreat');
      const urgent = type === 'retreat' || this.suppression > 0.25 || (th && th.visible) || (this.lastHurt && now - this.lastHurt.t < 2);
      if (c) { this.goTo(world, c.p, urgent ? 'sprint' : 'run', est, true); this.action.cover = c; this.noCover = false; }
      else { this.noCover = true; this.action.minUntil = now; }
    } else if (type === 'flank') {
      const f = this.findFlank(world, th, est);
      if (f) { this.goTo(world, f, 'run', est, true); this.stats.flanks++; this.action.flankPt = f; }
      else this.action.type = 'hold';
    } else if (type === 'search') {
      this.searchPts = this.planSearch(world, th);
      this.nextSearchPoint(world);
    } else if (type === 'reload') {
      this.startReload(world);
    } else if (type === 'roam') {
      // clear ground we haven't looked at recently, moving between cover, mostly through the dark
      let best = null, bs = -Infinity;
      for (let k = 0; k < 20; k++) {
        const c = world.coverPts.length ? this.r.pick(world.coverPts).p : world.nearestFree(v3(this.r.range(-world.w / 2.5, world.w / 2.5), 0, this.r.range(-world.h / 2.5, world.h / 2.5))), d = dist2d(this.pos, c);
        if (d < 8 || d > 35) continue;
        const fresh = Math.min(...this.visited.map((v) => dist2d(v, c)).concat([40]));
        const sc2 = fresh * 0.6 - d * 0.15 - world.lightAt(c) * 6 + this.r() * 3;
        if (sc2 > bs) { bs = sc2; best = c; }
      }
      if (best) { this.goTo(world, best, this.r() > this.prof.discipline + 0.25 ? 'run' : 'walk', null, false, this.prof.discipline); this.visited.push({ ...best }); if (this.visited.length > 8) this.visited.shift(); }
    } else if (type === 'patrol' && this.patrol) {
      this.goTo(world, this.patrol[this.patrolIdx % this.patrol.length], 'walk');
    }
  }
  goTo(world, p, mode, threatPos = null, tactical = false, shadows = 0) {
    let cost = null;
    if (shadows > 0) {
      // fieldcraft: prefer routes through the dark
      const cache = new Map();
      cost = (i, j) => { const k = j * world.cols + i; if (!cache.has(k)) cache.set(k, Math.max(0, world.lightAt(world.cellPos(i, j)) - 0.05) * 10 * shadows); return cache.get(k); };
    }
    if (threatPos && tactical) {
      // exposure-aware path: cells visible from the threat cost more (move behind cover when possible)
      const tp = v3(threatPos.x, 1.5, threatPos.z), cache = new Map();
      cost = (i, j) => {
        const k = j * world.cols + i;
        if (!cache.has(k)) { const c = world.cellPos(i, j); cache.set(k, world.los(tp, v3(c.x, 1.0, c.z)) ? 6 : 0); }
        return cache.get(k);
      };
    }
    const path = world.path(this.pos, p, cost);
    this.path = path; this.pathIdx = 1; this.dest = p; this.moveMode = mode;
  }
  findCover(world, threat, far) {
    if (!threat) return null;
    const th = this.threat(world.time), margin = clamp(th ? this.uncertainty(th, world.time) + dist2d(this.pos, threat) * 0.05 : 2, 1.5, 4);
    const mates = world.agents.filter((a) => a !== this && a.alive && a.team === this.team);
    let best = null, bs = -Infinity;
    for (const c of world.coverPts) {
      const dMe = dist2d(this.pos, c.p);
      if (dMe > (far ? 30 : 16)) continue;
      const dT = dist2d(c.p, threat);
      if (dT < 4) continue;
      // cover must hold against where the threat *might* be, not just the best guess
      const perp = norm(v3(-(threat.z - c.p.z), 0, threat.x - c.p.x)), m = margin;
      if (!this.coveredFrom(world, threat, c.p) || !this.coveredFrom(world, add(threat, mul(perp, m)), c.p) || !this.coveredFrom(world, add(threat, mul(perp, -m)), c.p)) continue;
      let s = -dMe * (far ? 0.3 : 1.0);
      if (far) s += Math.min(dT, 40) * 0.6; else s -= Math.abs(dT - 22) * 0.12;
      // prefer spots I can shoot from by standing up (low cover) or stepping out (edges)
      const peek = this.coveredFrom(world, threat, c.p, 'stand') ? 0 : 1.2;
      s += far ? 0 : peek;
      // don't run toward the threat to reach cover
      if (dist2d(c.p, threat) < dist2d(this.pos, threat) - 3) s -= 4;
      for (const m of mates) if (dist2d(m.pos, c.p) < 2.5 || (m.dest && dist2d(m.dest, c.p) < 2.5)) s -= 5;
      if (s > bs) { bs = s; best = c; }
    }
    return best;
  }
  findFlank(world, th, est) {
    if (!est) return null;
    const cur = Math.atan2(this.pos.x - est.x, this.pos.z - est.z);
    let best = null, bs = -Infinity;
    for (let k = 0; k < 24; k++) {
      const side = k % 2 ? 1 : -1, a = cur + side * this.r.range(0.9, 1.9), r = this.r.range(10, 22);
      const p = world.nearestFree(v3(est.x + Math.sin(a) * r, 0, est.z + Math.cos(a) * r));
      if (!world.inBounds(p)) continue;
      // must be able to see where the enemy is hiding from there (standing)
      if (!world.los(v3(p.x, 1.6, p.z), v3(est.x, (est.y || 0) + 1.0, est.z))) continue;
      const travel = dist2d(this.pos, p);
      if (travel > 35) continue;
      const angGain = Math.abs(wrap(a - cur));
      const s = angGain * 4 - travel * 0.15 + (this.coveredFrom(world, est, p, 'crouch') ? 0 : 0.5);
      if (s > bs) { bs = s; best = p; }
    }
    return best;
  }
  planSearch(world, th) {
    const now = world.time, base = this.est(th, now), u = Math.min(this.uncertainty(th, now), 12);
    const pts = [base];
    // likely hiding spots near where they were: cover points within the uncertainty radius
    const cands = world.coverPts.filter((c) => dist2d(c.p, base) < u + 3).sort(() => this.r() - 0.5).slice(0, 4);
    for (const c of cands) pts.push(c.p);
    return pts;
  }
  nextSearchPoint(world) {
    const p = this.searchPts.shift();
    if (p) this.goTo(world, p, this.prof.discipline > 0.6 ? 'walk' : 'run', null, false, this.prof.discipline * 0.5); else { this.action = { type: 'idle', since: world.time, minUntil: world.time + 1 }; }
  }
  startReload(world) {
    if (world.time < this.reloadUntil || this.W.mag === this.W.cap) return;
    const empty = this.W.mag === 0;
    this.reloadUntil = world.time + (empty ? this.W.reloadEmpty : this.W.reloadTac) * this.r.range(0.92, 1.1);
    this.stats.reloads++;
    // was anyone I know about able to see me right now? (judged from beliefs, scored with truth later)
    world.emitSound(this.pos, TUNE.hearing.reload, 'reload', this.id);
    this.reloadingStarted = world.time;
    if (world.agents.some((o) => o.team !== this.team && o.alive && world.los(o.eye(), v3(this.pos.x, 1.0, this.pos.z)))) this.stats.reloadsExposed++;
  }

  // =========================== ACTION / MOTOR ===========================
  act(dt, world) {
    if (this.controller === 'script') { this.script && this.script(this, dt, world); this.integrate(dt, world); return; }
    const now = world.time, th = this.threat(now), est = th ? this.est(th, now) : null;
    // dry gun: reload right away only if it's safe or there's nowhere to go; otherwise think() sends us to cover first
    if (this.W.mag === 0 && now >= this.reloadUntil && !this.reloadingStarted && (!est || this.coveredFrom(world, est) || !(th && th.visible) || this.action.type === 'reload' || this.noCover)) this.startReload(world);
    if (now >= this.reloadUntil && this.reloadingStarted) { this.W.mag = this.W.cap; this.reloadingStarted = 0; }
    const reloading = now < this.reloadUntil;
    const t = this.action.type;
    let wantMove = null, aimPoint = null, aimId = null, fire = false;

    if (t === 'engage' || t === 'hold' || t === 'suppress') {
      if (th && th.visible) {
        const o = world.agents.find((a) => a.id === th.id);
        // aim at what is exposed: centre mass, or the head if that's all that shows
        aimPoint = th.exposure < 0.5 ? v3(th.pos.x, (th.pos.y || 0) + (th.stance === 'crouch' ? 1.12 : 1.62), th.pos.z) : v3(th.pos.x, (th.pos.y || 0) + (th.stance === 'crouch' ? 0.85 : 1.2), th.pos.z);
        aimId = th.id;
        fire = !reloading;
        void o;
      } else if (est) {
        // pre-aim where they're expected to reappear (head height); suppress = fire at it
        aimPoint = v3(est.x, (est.y || 0) + 1.35, est.z); aimId = th.id;
        fire = t === 'suppress' && !reloading;
      }
      this.handleCoverPeek(world, est, t, th);
      if (t === 'engage' && th && th.visible) {
        const d = dist2d(this.pos, th.pos);
        // human strafing in open ground at mid range
        if (!this.coveredFrom(world, th.pos) && d > 7 && d < 35 && this.prof.aggression > 0.3) {
          if (!this.strafe || now > this.strafe.until) this.strafe = { dir: this.r() < 0.5 ? -1 : 1, until: now + this.r.range(0.4, 1.1) };
          const right = v3(Math.cos(this.look.yaw), 0, -Math.sin(this.look.yaw));
          wantMove = { dir: mul(right, this.strafe.dir), mode: this.stance === 'crouch' ? 'crouch' : 'walk' };
        }
      }
    } else if (t === 'cover' || t === 'retreat' || t === 'flank' || t === 'search' || t === 'patrol' || t === 'roam') {
      const step = this.followPath(world);
      if (step) { wantMove = step; if (step.mode === 'run' || step.mode === 'sprint') this.stance = 'stand'; else if (this.stance === 'duck') this.stance = 'crouch'; }
      else if (t === 'cover' || t === 'retreat') { if (this.action.cover && !this.action.arrived) this.arriveCover(world, est); this.stance = est && this.coveredFrom(world, est) ? 'duck' : 'crouch'; }
      else if (t === 'search') { this.nextSearchPoint(world); }
      else if (t === 'flank') { this.action.minUntil = 0; }
      else if (t === 'patrol') { this.patrolIdx++; this.setAction('patrol', world, null, null); }
      else if (t === 'roam' && !this.action.replan) {
        // listening halt: disciplined hunters stop, get low and watch (a still observer spots movers); novices barely pause
        const D = this.prof.discipline;
        this.action.replan = true; this.action.minUntil = now + (D > 0.6 ? this.r.range(3, 7) : this.r.range(0.5, 1.5)); this.nextThink = this.action.minUntil;
        if (D > 0.6) this.stance = 'crouch';
      }
      // while moving: watch the threat if known, otherwise look where you're going (and check sounds)
      if (th && th.visible) { aimPoint = v3(th.pos.x, (th.pos.y || 0) + 1.2, th.pos.z); aimId = th.id; fire = !reloading && (t === 'flank' || t === 'search' || dist2d(this.pos, th.pos) < 10); }
      else if (this.attention && now < this.attentionUntil) aimPoint = v3(this.attention.x, 1.4, this.attention.z);
      else if (est && t !== 'patrol' && t !== 'roam') aimPoint = v3(est.x, (est.y || 0) + 1.4, est.z);
      else if (step) aimPoint = add(this.eye(), mul(step.dir, 10));
      if (t === 'search' || t === 'flank') this.stance = 'stand';
    } else if (t === 'reload') {
      if (est) aimPoint = v3(est.x, (est.y || 0) + 1.3, est.z);
      this.stance = est && this.coveredFrom(world, est) ? 'duck' : 'crouch';
      if (!reloading) this.action.minUntil = 0;
    } else {
      // idle: scan, look at sounds
      if (this.attention && now < this.attentionUntil) aimPoint = v3(this.attention.x, 1.4, this.attention.z);
      else if (!this.scan || now > this.scan.until) { this.scan = { yaw: this.yaw + this.r.range(-1.2, 1.2) * (0.6 + this.prof.skill), until: now + this.r.range(1.5, 3.5) * (1.3 - this.prof.skill * 0.6) }; }
      if (!aimPoint && this.scan) aimPoint = add(this.eye(), mul(dirOf(this.scan.yaw, 0), 10));
    }
    this.updateAim(dt, world, aimPoint, aimId, th);
    if (fire && aimPoint) this.tryFire(dt, world, aimPoint, th);
    this.applyMove(dt, wantMove);
    this.integrate(dt, world);
    this.checkStuck(dt, world, !!wantMove);
  }
  handleCoverPeek(world, est, t, th) {
    if (!est) { this.stance = 'stand'; return; }
    const now = world.time;
    const coveredCrouch = this.coveredFrom(world, est, this.pos, 'crouch'), coveredStand = this.coveredFrom(world, est, this.pos, 'stand');
    if (coveredCrouch && !coveredStand) {
      // low cover: pop up to shoot, duck to recover/reload
      if (now > this.peek.until) { this.peek.up = !this.peek.up; this.peek.until = now + (this.peek.up ? this.r.range(1.1, 2.6) * (1.5 - 0.6 * this.prof.discipline) : this.r.range(0.7, 1.6)) * (this.peek.up ? 1 - this.suppression * 0.5 : 1 + this.suppression); }
      const reloading = now < this.reloadUntil;
      this.stance = this.peek.up && !reloading && this.suppression < 0.85 ? 'stand' : 'duck';
    } else if (coveredCrouch && coveredStand && (t === 'engage' || t === 'hold' || t === 'suppress')) {
      // high cover: step out to an edge that sees the threat, then back
      if (!this.action.peekPos) {
        const tp = v3(est.x, (est.y || 0) + 1.2, est.z);
        for (const a of [0, 1, -1, 2, -2, 3, -3]) {
          for (const r of [0.8, 1.4, 2.0]) {
            const right = v3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
            const p = add(this.pos, mul(right, Math.sign(a) * r + (a === 0 ? 0 : 0)));
            if (world.free(p) && world.los(v3(p.x, 1.6, p.z), tp)) { this.action.peekPos = p; this.action.home = { ...this.pos }; break; }
          }
          if (this.action.peekPos) break;
        }
      }
      if (this.action.peekPos && now > this.peek.until) {
        this.peek.up = !this.peek.up; this.peek.until = now + (this.peek.up ? this.r.range(1.0, 2.2) : this.r.range(0.8, 1.8));
        this.goTo(world, this.peek.up ? this.action.peekPos : this.action.home, 'walk');
      }
      this.stance = 'stand';
      if (this.path) { const s = this.followPath(world); if (s) this.applyMove(1 / 30, s); }
    } else {
      // in the open: crouch for stability at range unless moving
      const d = dist2d(this.pos, est);
      this.stance = d > 18 && th && th.visible ? 'crouch' : 'stand';
    }
  }
  arriveCover(world, est) {
    this.action.arrived = true;
    if (this.W.mag / this.W.cap < 0.4) this.startReload(world);
    this.stats.coverArrivals++;
    if (est && this.coveredFrom(world, est)) this.stats.coverGood++;
    this.action.minUntil = world.time; // re-decide now that we're in cover
  }
  followPath(world) {
    if (!this.path || this.pathIdx >= this.path.length) return null;
    let wp = this.path[this.pathIdx];
    if (dist2d(this.pos, wp) < (this.pathIdx === this.path.length - 1 ? 0.18 : 0.45)) { this.pathIdx++; if (this.pathIdx >= this.path.length) { this.path = null; return null; } wp = this.path[this.pathIdx]; }
    const d = sub(wp, this.pos); d.y = 0;
    return { dir: norm(d), mode: this.moveMode };
  }
  applyMove(dt, want) {
    const S = TUNE.speed;
    let target = v3();
    if (want) {
      let mode = want.mode;
      if ((this.stance === 'crouch' || this.stance === 'duck') && mode !== 'sprint') mode = 'crouch';
      if (mode === 'sprint') this.stance = 'stand';
      const sp = { sprint: S.sprint, run: S.run, walk: S.walk, crouch: S.crouch }[mode] * (this.health < 50 ? 0.8 : 1);
      target = mul(want.dir, sp);
      this.curMoveMode = mode;
    } else this.curMoveMode = null;
    const k = 1 - Math.exp(-S.accel * dt);
    this.vel.x += (target.x - this.vel.x) * k; this.vel.z += (target.z - this.vel.z) * k;
    const sp = this.speed();
    if (sp > 0.3) {
      const moveYaw = Math.atan2(-this.vel.x, -this.vel.z);
      // body faces aim when aiming at something, else movement
      this.yaw = this.aim.point ? this.look.yaw : moveYaw;
    }
  }
  integrate(dt, world) {
    const np = add(this.pos, mul(this.vel, dt));
    if (world.free(np)) this.pos = np;
    else if (world.free(v3(np.x, 0, this.pos.z))) { this.pos = v3(np.x, 0, this.pos.z); this.vel.z = 0; }
    else if (world.free(v3(this.pos.x, 0, np.z))) { this.pos = v3(this.pos.x, 0, np.z); this.vel.x = 0; }
    else { this.vel = v3(); }
    // footsteps
    const sp = this.speed();
    this.stepAcc = (this.stepAcc || 0) + sp * dt;
    if (this.stepAcc > 0.75) {
      this.stepAcc = 0;
      const H = TUNE.hearing;
      const r = sp > 4.6 ? H.sprint : this.stance !== 'stand' ? H.crouch : sp > 2.8 ? H.run : H.walk;
      world.emitSound(this.pos, r, 'step', this.id);
    }
  }
  checkStuck(dt, world, moving) {
    if (!moving) { this.stuck.t = 0; this.stuck.ref = { ...this.pos }; return; }
    this.stuck.t += dt;
    if (this.stuck.t > 2.5) {
      if (dist2d(this.pos, this.stuck.ref) < 0.6) { this.stats.stuckEvents++; this.path = null; this.action.minUntil = 0; this.nextThink = 0; }
      this.stuck.t = 0; this.stuck.ref = { ...this.pos };
    }
  }

  // ---------------- human aim model ----------------
  // Aim = reaction delay → ballistic flick (Fitts' law timing, minimum-jerk profile, overshoot/undershoot)
  //     → corrective sub-movements → smooth pursuit with lag and physiological sway; recoil is fought imperfectly.
  updateAim(dt, world, point, id, th) {
    const A = this.aim, T = TUNE.aim, P = this.prof, now = world.time, eye = this.eye();
    if (!point) { A.point = null; A.targetId = null; return; }
    const want = anglesTo(eye, point);
    const d = Math.max(1, dist2d(this.pos, point));
    const newTarget = id !== A.targetId || (id == null && A.targetId == null && !A.point);
    A.point = point;
    if (newTarget) {
      A.targetId = id;
      if (id != null) {
        // reaction time (log-normal like real human RTs); slower in the dark, when suppressed or surprised from the side
        const off = Math.abs(wrap(want.yaw - this.look.yaw));
        const light = clamp(world.lightAt(point), 0, 1);
        const rt = this.r.logn(T.react * P.reaction * (1 + 0.35 * (1 - light) + 0.4 * this.suppression + 0.25 * clamp(off / 1.5, 0, 1)), T.reactSpread);
        A.mode = 'react'; A.reactUntil = now + rt; A.reactStart = now; A.rt = rt;
      } else { A.mode = 'smooth'; }
    }
    const look = this.look;
    if (A.mode === 'react') {
      if (now >= A.reactUntil) this.planFlick(want, d, now, true);
    } else if (A.mode === 'flick') {
      const u = clamp((now - A.t0) / A.dur, 0, 1), s = u * u * u * (10 - 15 * u + 6 * u * u);
      look.yaw = A.from.yaw + wrap(A.to.yaw - A.from.yaw) * s;
      look.pitch = A.from.pitch + (A.to.pitch - A.from.pitch) * s;
      if (u >= 1) {
        const err = Math.hypot(wrap(want.yaw - look.yaw), want.pitch - look.pitch), tgt = Math.atan(0.3 / d);
        if (err > tgt * 1.2) { A.mode = 'wait'; A.correctAt = now + T.correctDelay * this.r.range(0.8, 1.3); }
        else A.mode = 'track';
      }
    } else if (A.mode === 'wait') {
      if (now >= A.correctAt) this.planFlick(want, d, now, false);
    } else {
      // smooth pursuit (tracking) and general looking
      const k = (A.mode === 'track' ? T.trackGain * (0.6 + 0.5 * P.skill) : 10) * dt; // free looking / orienting to a sound is a fast head turn
      const eyaw = wrap(want.yaw - look.yaw), ep = want.pitch - look.pitch;
      if (A.mode === 'track' && Math.hypot(eyaw, ep) > 0.25) { this.planFlick(want, d, now, false); }
      else { look.yaw += eyaw * Math.min(1, k); look.pitch += ep * Math.min(1, k); }
    }
    // physiological sway: Ornstein–Uhlenbeck noise, worse when moving, hurt, suppressed or out of breath
    const moving = this.speed() > 0.5;
    const amp = (moving ? T.swayMove : T.swayStill) * (this.stance === 'crouch' ? 0.75 : 1) * (1 + this.suppression * 2.2) * (1 + (100 - this.health) / 120) * (1.5 - P.skill * 0.6);
    const th2 = 3.2;
    A.ou.x += -A.ou.x * th2 * dt + this.r.normal(0, amp * Math.sqrt(2 * th2 * dt));
    A.ou.y += -A.ou.y * th2 * dt + this.r.normal(0, amp * Math.sqrt(2 * th2 * dt));
    // recoil recovery: the shooter pulls the muzzle back down, imperfectly and with lag
    const rec = A.recoil, comp = T.recoilComp * (0.55 + 0.6 * P.skill);
    if (now - this.lastShotT > 0.06) { rec.p -= rec.p * Math.min(1, comp * dt); rec.y -= rec.y * Math.min(1, comp * 0.8 * dt); }
  }
  planFlick(want, d, now, first) {
    const A = this.aim, T = TUNE.aim, P = this.prof;
    const from = { yaw: this.look.yaw, pitch: this.look.pitch };
    const dy = wrap(want.yaw - from.yaw), dp = want.pitch - from.pitch, amp = Math.hypot(dy, dp);
    const W = Math.max(0.004, 2 * Math.atan(0.25 / d));
    const dur = (T.fittsA + T.fittsB * (1.35 - P.skill * 0.5) * Math.log2(1 + amp / W)) * this.r.range(0.85, 1.2);
    // endpoint error scales with movement amplitude (speed–accuracy trade-off)
    const g = 1 + this.r.normal(T.overshoot, T.gainSd * (1.4 - P.skill * 0.6)) * (first ? 1 : 0.6);
    const lat = this.r.normal(0, T.lateralSd * (1.4 - P.skill * 0.6)) * amp;
    const ux = amp > 1e-6 ? dy / amp : 0, uy = amp > 1e-6 ? dp / amp : 0;
    const to = { yaw: from.yaw + dy * g - uy * lat + this.r.normal(0, T.motorSd), pitch: from.pitch + dp * g + ux * lat + this.r.normal(0, T.motorSd) };
    if (first && amp > 0.03) { this.stats.flicks++; if (g > 1.02) this.stats.overshoots++; }
    if (first && this.aim.reactStart != null) { this.stats.reactions.push(now - this.aim.reactStart); this.aim.reactStart = null; }
    Object.assign(A, { mode: 'flick', from, to, t0: now, dur: Math.max(0.05, dur) });
  }
  effectiveAim() {
    const A = this.aim;
    return { yaw: this.look.yaw + A.ou.x + A.recoil.y, pitch: this.look.pitch + A.ou.y + A.recoil.p };
  }
  tryFire(dt, world, point, th) {
    const now = world.time, W = this.W, A = this.aim;
    if (now < this.reloadUntil || W.mag <= 0 || this.stance === 'duck') return;
    if (A.mode === 'react') return;
    if (now < this.nextShotT || now < this.burstPauseUntil) return;
    const eye = this.eye(), d = Math.max(1, dist2d(this.pos, point));
    const aimNow = this.effectiveAim();
    const want = anglesTo(eye, point);
    const err = Math.hypot(wrap(want.yaw - aimNow.yaw), want.pitch - aimNow.pitch);
    // shoot when the sights are on: tolerance ~ target half-width, looser up close / when suppressing
    const suppressing = !(th && th.visible);
    // trained shooters wait for a proper sight picture; novices pull the trigger on a rough one
    const tol = suppressing ? 0.06 : Math.atan(0.22 / d) * (d < 8 ? 2.2 : 1.3) * (0.8 + 0.4 * this.prof.aggression) * (1 + this.suppression * 1.2) * (1.55 - 0.6 * this.prof.skill);
    // once a burst has started the finger keeps going through the recoil climb; only a big miss stops it
    if (this.burstLeft > 0 ? err > tol * 5 : err > tol) { if (this.burstLeft > 0) this.burstLeft = 0; return; }
    if (this.burstLeft <= 0) {
      // trigger discipline: full auto up close, short bursts mid range, single shots far
      this.burstLeft = suppressing ? this.r.range(3, 6) | 0 : d < 8 ? this.r.range(5, 10) | 0 : d < 25 ? this.r.range(3, 5) | 0 : d < 50 ? this.r.range(1, 3) | 0 : 1;
      this.burstLeft = Math.max(1, Math.round(this.burstLeft * (1 + (1 - this.prof.discipline) * 0.9))); // novices hold the trigger down
      if (A.firstShotPending !== A.targetId && th) { A.firstShotPending = A.targetId; if (th.firstSeenT != null) this.stats.firstShotTimes.push(now - th.firstSeenT); }
    }
    // spread: weapon + movement + stance
    const moving = this.speed() > 0.5;
    const spread = W.spread * (moving ? 3.5 : 1) * (this.stance === 'crouch' ? 0.8 : 1);
    const r = spread * Math.sqrt(this.r()), a = this.r() * Math.PI * 2;
    // trigger press disturbs the sights (flinch/jerk), worse for less skilled or stressed shooters
    const fl = TUNE.aim.flinch * (1.5 - this.prof.skill) * (1 + this.suppression * 1.5);
    const dir = dirOf(aimNow.yaw + Math.cos(a) * r + this.r.normal(0, fl), aimNow.pitch + Math.sin(a) * r + this.r.normal(0, fl));
    const muzzle = v3(eye.x + dir.x * 0.6, eye.y - 0.05, eye.z + dir.z * 0.6);
    const res = world.shoot(this, muzzle, dir, W);
    this.stats.shots++; if (res.hit && res.hit.team !== this.team) this.stats.hits++;
    W.mag--; this.lastShotT = now; this.burstLeft--;
    this.nextShotT = now + 60 / W.rpm;
    if (this.burstLeft <= 0) this.burstPauseUntil = now + this.r.range(0.18, 0.45) * (d > 25 ? 1.4 : 1);
    A.recoil.p += W.kick * this.r.range(0.8, 1.2); A.recoil.y += this.r.normal(0, W.kickYaw);
    world.emitSound(this.pos, TUNE.hearing.gunshot, 'shot', this.id);
    world.events.push({ t: now, type: 'shot', from: this.id, hit: res.hit ? res.hit.id : null });
  }
}
