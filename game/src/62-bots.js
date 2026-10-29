// =====================================================================
//  Enemy fighters: the tested combat AI (ai/core.mjs → AICORE) running in the city
// =====================================================================
// A 140 m "arena" follows the player: its navigation grid and cover points are sampled from the
// city's real collision boxes, and line of sight / bullets use the same collision as the player.
// The AI still only knows what it perceives (sight, sound, being shot at, squad callouts).
const BOTS = (() => {
  const { World, Agent, TUNE } = AICORE;
  const SIZE = 140, RELOCATE = 45, N_BOTS = 6, RESPAWN_S = 14;
  let NEXT = null;
  class CityArena extends World {
    constructor(cx, cz) { NEXT = { cx, cz }; super({ w: SIZE, h: SIZE, seed: (Math.random() * 1e9) | 0, cell: 0.5 }); this.recordTracers = true; this.light = new Map(); }
    // walkable = nothing between knee and head height (floors, kerbs and the first stair steps don't block)
    buildNav() {
      this.ox = NEXT.cx; this.oz = NEXT.cz;
      const c = this.cell; this.cols = Math.round(this.w / c); this.rows = Math.round(this.h / c);
      this.blocked = new Uint8Array(this.cols * this.rows);
      const pad = TUNE.body.radius + 0.1, tmp = [];
      for (let j = 0; j < this.rows; j++) for (let i = 0; i < this.cols; i++) {
        const k = j * this.cols + i;
        if (i === 0 || j === 0 || i === this.cols - 1 || j === this.rows - 1) { this.blocked[k] = 1; continue; }
        const x = this.ox - this.w / 2 + (i + 0.5) * c, z = this.oz - this.h / 2 + (j + 0.5) * c;
        if (terrainH(x, z) > 0.5) { this.blocked[k] = 1; continue; }
        for (const b of COL.near(x - pad, z - pad, x + pad, z + pad, tmp)) {
          if (b.y1 < 0.5 || b.y0 > 1.7) continue;
          const dx = x - b.cx, dz = z - b.cz, lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
          if (Math.abs(lx) <= b.hx + pad && Math.abs(lz) <= b.hz + pad) { this.blocked[k] = 1; break; }
        }
      }
    }
    // cover = free cells hugging something solid (sampled, capped so tactical scoring stays cheap)
    buildCoverPoints() {
      const pts = [], C = this.cols, R = this.rows, b = this.blocked;
      for (let j = 3; j < R - 3; j += 2) for (let i = 3; i < C - 3; i += 2) {
        if (b[j * C + i]) continue;
        for (const [di, dj] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) if (b[(j + dj) * C + i + di]) { pts.push({ p: this.cellPos(i, j), n: { x: -di / 2, y: 0, z: -dj / 2 } }); break; }
      }
      for (let i = pts.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [pts[i], pts[k]] = [pts[k], pts[i]]; }
      return pts.slice(0, 700);
    }
    // daylight outside, dim under a roof
    lightAt(p) {
      const k = (Math.floor(p.x / 3) * 4099 + Math.floor(p.z / 3)) | 0;
      let v = this.light.get(k);
      if (v === undefined) { v = COL.ray(new V3(p.x + this.ox, 1.6, p.z + this.oz), UP, 14) ? 0.4 : 0.95; this.light.set(k, v); }
      return v;
    }
    segHit(a, b) {
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz);
      if (L < 1e-6) return Infinity;
      const h = COL.ray(new V3(a.x + this.ox, a.y, a.z + this.oz), new V3(dx / L, dy / L, dz / L), L);
      return h ? h.t / L : Infinity;
    }
  }

  // ---------------- soldier model ----------------
  const mats = {
    cloth: std(0x9a8462, 0.95), vest: std(0x4c5236, 0.9), skin: std(0x8a6448, 0.8), dark: std(0x1e1f22, 0.7), gun: std(0x232427, 0.5, 0.4), wrap: std(0x6a5a44, 1),
    flash: new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  function makeView(agent) {
    const root = new THREE.Group(), hips = new THREE.Group(), upper = new THREE.Group(), arms = new THREE.Group();
    root.add(hips); hips.position.y = 0.95; hips.add(upper);
    const torso = M(bx(0.4, 0.56, 0.24), mats.cloth, upper, 0, 0.3, 0);
    M(bx(0.44, 0.38, 0.3), mats.vest, upper, 0, 0.36, 0);
    for (let i = 0; i < 3; i++) M(bx(0.1, 0.13, 0.06), mats.vest, upper, -0.12 + i * 0.12, 0.22, -0.17);
    const head = M(new THREE.SphereGeometry(0.115, 10, 8), mats.skin, upper, 0, 0.74, 0);
    M(new THREE.SphereGeometry(0.135, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mats.vest, upper, 0, 0.77, 0);
    M(bx(0.22, 0.12, 0.2), mats.wrap, upper, 0, 0.66, 0.0);
    const legs = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(s * 0.11, 0, 0); hips.add(pivot);
      const leg = M(bx(0.16, 0.9, 0.18), mats.cloth, pivot, 0, -0.45, 0);
      M(bx(0.16, 0.1, 0.28), mats.dark, pivot, 0, -0.9, -0.05);
      legs.push({ pivot, mesh: leg });
    }
    // arms + rifle pitch together around the shoulders; the rifle points down −Z
    arms.position.set(0, 0.6, 0); upper.add(arms);
    M(bx(0.08, 0.1, 0.82), mats.gun, arms, 0.1, -0.08, -0.42);
    M(bx(0.05, 0.16, 0.08), mats.gun, arms, 0.1, -0.2, -0.36);
    M(bx(0.1, 0.1, 0.42), mats.cloth, arms, 0.2, -0.06, -0.14).rotation.y = -0.2;
    M(bx(0.1, 0.1, 0.46), mats.cloth, arms, -0.08, -0.08, -0.26).rotation.y = 0.45;
    const flash = M(new THREE.SphereGeometry(0.09, 6, 4), mats.flash, arms, 0.1, -0.08, -0.9); flash.visible = false; flash.scale.set(1, 1, 2.2);
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    const v = { agent, root, hips, upper, arms, legs, flash, phase: Math.random() * 6, y: 0, alive: true, deadT: 0, hits: [] };
    for (const [mesh, part] of [[head, 'head'], [torso, 'torso'], [legs[0].mesh, 'legs'], [legs[1].mesh, 'legs']]) { mesh.userData.target = { type: 'bot', view: v, part }; hitList.push(mesh); v.hits.push(mesh); }
    scene.add(root);
    return v;
  }
  function dropView(v) { scene.remove(v.root); for (const m of v.hits) { const i = hitList.indexOf(m); if (i >= 0) hitList.splice(i, 1); } }

  // ---------------- state ----------------
  let arena = null, me = null, views = [], pending = [], enabled = true, lastTracer = 0, tracersFx = [];
  const tracerGeo2 = new THREE.BoxGeometry(0.025, 0.025, 1).translate(0, 0, -0.5);
  const tracerMat2 = new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const ui = (() => {
    const hp = document.createElement('div'); hp.style.cssText = 'position:absolute;left:24px;bottom:92px;width:180px;height:6px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.15)';
    const fill = document.createElement('i'); fill.style.cssText = 'display:block;height:100%;width:100%;background:#c9d4c0;transition:width .15s'; hp.appendChild(fill);
    const blood = document.createElement('div'); blood.style.cssText = 'position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 45%,rgba(140,0,0,.85) 100%);opacity:0;transition:opacity .25s;z-index:5';
    const dead = document.createElement('div'); dead.style.cssText = 'position:fixed;inset:0;display:none;place-items:center;pointer-events:none;color:#e8d8c8;font:600 22px Rajdhani,sans-serif;letter-spacing:.3em;background:rgba(40,0,0,.45);z-index:6'; dead.textContent = 'YOU WERE KILLED — REGROUPING…';
    const cnt = document.createElement('div'); cnt.style.cssText = 'position:absolute;left:24px;bottom:104px;font-size:12px;letter-spacing:.15em;color:rgba(255,255,255,.55)';
    const host = document.getElementById('hud'); host.appendChild(hp); host.appendChild(cnt); document.body.appendChild(blood); document.body.appendChild(dead);
    return { fill, blood, dead, cnt };
  })();
  P.hp = 100; P.dead = false; P.hurtT = -99;

  const toLocal = (x, z) => ({ x: x - arena.ox, y: 0, z: z - arena.oz });
  function build(cx, cz) {
    for (const v of views) dropView(v);
    views = []; pending = [];
    arena = new CityArena(cx, cz);
    me = new Agent(arena, { team: 'blue', controller: 'script', name: 'you', profile: 'player' });
    me.script = (a, dt, w) => { a.pos = { x: P.pos.x - w.ox, y: P.pos.y, z: P.pos.z - w.oz }; a.vel = { x: P.vel.x, y: 0, z: P.vel.z }; a.stance = P.crouch ? 'crouch' : 'stand'; a.look = { yaw: P.yaw, pitch: P.pitch }; a.alive = !P.dead; };
    me.integrate = function (dt, w) { // footsteps carry: the AI hears you move
      const sp = Math.hypot(this.vel.x, this.vel.z); this.stepAcc = (this.stepAcc || 0) + sp * dt;
      if (this.stepAcc > 0.75) { this.stepAcc = 0; const H = TUNE.hearing; w.emitSound(this.pos, sp > 4.6 ? H.sprint : this.stance !== 'stand' ? H.crouch : sp > 2.8 ? H.run : H.walk, 'step', this.id); }
    };
    me.onHit = (dmg, part) => hurtPlayer(dmg, part);
    me.onNearMiss = () => { audio.crack(); P.shake = Math.min(1.5, P.shake + 0.35); };
    lastTracer = arena.time;
    for (let i = 0; i < N_BOTS; i++) spawnBot(i);
  }
  // somewhere outdoors, 30–62 m away, out of the player's sight
  function spawnPoint() {
    const eye = new V3(P.pos.x, P.pos.y + 1.6, P.pos.z);
    for (let t = 0; t < 300; t++) {
      const a = Math.random() * Math.PI * 2, d = rand(30, 62), x = P.pos.x + Math.sin(a) * d, z = P.pos.z + Math.cos(a) * d;
      if (Math.abs(x - arena.ox) > SIZE / 2 - 4 || Math.abs(z - arena.oz) > SIZE / 2 - 4) continue;
      const g = GR.get(x, z); if (g !== GR.STREET && g !== GR.PAVE) continue;
      const lp = toLocal(x, z); if (!arena.free(lp)) continue;
      const tgt = new V3(x, 1.3, z), dir = tgt.clone().sub(eye), L = dir.length();
      if (!COL.ray(eye, dir.divideScalar(L), L)) continue;   // visible from the player → not here
      return lp;
    }
    return null;
  }
  function spawnBot(i) {
    const p = spawnPoint(); if (!p) return false;
    const prof = ['recruit', 'recruit', 'operator', 'recruit', 'operator', 'veteran'][i % 6];
    const a = new Agent(arena, { team: 'red', pos: p, yaw: Math.random() * 6.28, profile: prof });
    views.push(makeView(a));
    return true;
  }
  function hurtPlayer(dmg, part) {
    if (P.dead) return;
    P.hp = Math.max(0, P.hp - dmg * 0.5); P.hurtT = time0();
    audio.hurt(); P.shake = Math.min(2, P.shake + 0.8);
    ui.blood.style.opacity = String(Math.min(1, 0.35 + (100 - P.hp) / 120));
    me.health = P.hp;
    if (P.hp <= 0) { P.dead = true; P.deadT = 3.2; me.alive = false; ui.dead.style.display = 'grid'; feed(`<span class="m">KILLED${part === 'head' ? ' — HEADSHOT' : ''}</span>`); }
  }
  let clock = 0; const time0 = () => clock;
  // player's own shots: the AI hears them, and rounds cracking past make it duck
  function playerShot(origin, dir) {
    if (!arena || !enabled) return;
    const lo = toLocal(origin.x, origin.z);
    me.lastShotT = arena.time;
    arena.emitSound({ x: lo.x, y: 0, z: lo.z }, TUNE.hearing.gunshot, 'shot', me.id);
    for (const v of views) {
      const a = v.agent; if (!a.alive) continue;
      const c = new V3(a.pos.x + arena.ox, (a.pos.y || 0) + a.top() * 0.7, a.pos.z + arena.oz), w = c.clone().sub(origin), t = w.dot(dir);
      if (t <= 0) continue;
      const miss = c.distanceTo(origin.clone().addScaledVector(dir, t));
      if (miss < TUNE.suppression.missRadius) a.onNearMiss(miss, me, arena);
    }
  }
  // a player round struck a soldier
  function hit(tg, p, b) {
    const a = tg.view.agent; if (!a.alive) return;
    const dmg = TUNE.weapon.dmg[tg.part] * clamp(b.mass ?? 1, 0.3, 1.3);
    a.onHit(dmg, tg.part, me, b.d0, arena);
    emitPuff(p, 0x5a1010, 0.07, 0.45, b.d0.clone().multiplyScalar(0.6), 0.5, 1.6);
    audio.fleshHit(p.distanceTo(P.pos));
    hitFx(false);
    if (!a.alive) { P.stats.score += tg.part === 'head' ? 40 : 25; feed(`<span class="s">ENEMY DOWN${tg.part === 'head' ? ' — HEADSHOT' : ''} +${tg.part === 'head' ? 40 : 25}</span>`); }
  }

  function animate(v, dt) {
    const a = v.agent, wx = a.pos.x + arena.ox, wz = a.pos.z + arena.oz;
    v.y = damp(v.y, COL.ground(wx, wz, v.y + 0.3), 12, dt);
    v.root.position.set(wx, v.y, wz);
    if (!a.alive) {
      if (v.alive) { v.alive = false; v.deadT = 0; for (const m of v.hits) { const i = hitList.indexOf(m); if (i >= 0) hitList.splice(i, 1); } pending.push(RESPAWN_S); }
      v.deadT += dt; const k = Math.min(1, v.deadT / 0.55);
      v.root.rotation.x = -k * k * Math.PI / 2 * 0.95; v.hips.position.y = 0.95 - k * 0.7;
      return;
    }
    v.root.rotation.y = damp(v.root.rotation.y, a.look.yaw, 10, dt);
    const sp = Math.hypot(a.vel.x, a.vel.z), crouch = a.stance === 'crouch' ? 1 : a.stance === 'duck' ? 1.4 : 0;
    v.phase += dt * (2.5 + sp * 1.6);
    const swing = Math.sin(v.phase) * 0.65 * Math.min(1, sp / 3);
    v.legs[0].pivot.rotation.x = swing - crouch * 0.9; v.legs[1].pivot.rotation.x = -swing - crouch * 0.9;
    for (const l of v.legs) l.pivot.scale.y = 1 - crouch * 0.18;
    v.hips.position.y = damp(v.hips.position.y, 0.95 - crouch * 0.38, 10, dt);
    v.upper.rotation.x = damp(v.upper.rotation.x, -crouch * 0.25 - Math.min(0.2, sp * 0.04), 8, dt);
    v.arms.rotation.x = damp(v.arms.rotation.x, a.look.pitch + crouch * 0.25, 14, dt);
    v.flash.visible = arena.time - a.lastShotT < 0.05;
  }
  function tracers() {
    for (const tr of arena.tracers) {
      if (tr.t <= lastTracer) continue;
      const A = new V3(tr.a.x + arena.ox, tr.a.y, tr.a.z + arena.oz), B = new V3(tr.b.x + arena.ox, tr.b.y, tr.b.z + arena.oz);
      const d = B.clone().sub(A), L = d.length(); d.divideScalar(L);
      const m = new THREE.Mesh(tracerGeo2, tracerMat2); m.position.copy(A); m.lookAt(B); m.scale.set(1, 1, Math.min(L, 14)); m.frustumCulled = false;
      scene.add(m); tracersFx.push({ m, A, d, L, t: 0 });
      audio.enemyShot(A.distanceTo(P.pos));
      if (!tr.hit) { const h = COL.ray(A, d, L + 0.2); if (h) { HOLES.add(h.point, h.normal, 1); emitPuff(h.point, 0x8a8478, 0.08, 0.7, h.normal.clone().multiplyScalar(0.6), 0.35, 1.6); emitSparks(h.point, 3, h.normal, [0.9, 0.75, 0.5], 2); } }
    }
    lastTracer = arena.time;
  }
  function update(dt) {
    clock += dt;
    if (!enabled || !MAP.ready) return;
    if (!arena || Math.hypot(P.pos.x - arena.ox, P.pos.z - arena.oz) > RELOCATE) build(P.pos.x, P.pos.z);
    arena.step(Math.min(dt, 0.05));
    for (const v of views) animate(v, dt);
    tracers();
    for (let i = tracersFx.length - 1; i >= 0; i--) { const f = tracersFx[i]; f.t += dt; f.m.position.copy(f.A).addScaledVector(f.d, Math.min(f.L, f.t * 900)); if (f.t > f.L / 900 + 0.02) { scene.remove(f.m); tracersFx.splice(i, 1); } }
    // replacements for the fallen (out of sight), cleanup of old bodies
    for (let i = pending.length - 1; i >= 0; i--) { pending[i] -= dt; if (pending[i] <= 0 && spawnBot(views.length)) pending.splice(i, 1); }
    for (let i = views.length - 1; i >= 0; i--) { const v = views[i]; if (!v.alive && v.deadT > 25) { dropView(v); views.splice(i, 1); arena.agents.splice(arena.agents.indexOf(v.agent), 1); } }
    // health: slow regeneration after a few quiet seconds; death → regroup at the spawn
    if (P.dead) {
      for (const k in keys) keys[k] = false; P.trigger = false; P.vel.set(0, 0, 0);
      P.deadT -= dt;
      if (P.deadT <= 0) { P.dead = false; P.hp = 100; ui.dead.style.display = 'none'; P.pos.set(SPAWN.x, 0, SPAWN.z); P.yaw = SPAWN.yaw; build(P.pos.x, P.pos.z); }
    } else if (clock - P.hurtT > 5 && P.hp < 100) P.hp = Math.min(100, P.hp + 8 * dt);
    ui.fill.style.width = `${P.hp}%`; ui.fill.style.background = P.hp < 35 ? '#d0503a' : '#c9d4c0';
    if (clock - P.hurtT > 0.4) ui.blood.style.opacity = String(Math.max(0, (60 - P.hp) / 80));
    ui.cnt.textContent = `HOSTILES ${views.filter((v) => v.agent.alive).length}`;
  }
  function setEnabled(on) {
    enabled = on;
    if (!on) { for (const v of views) dropView(v); views = []; arena = null; for (const f of tracersFx) scene.remove(f.m); tracersFx = []; ui.cnt.textContent = 'HOSTILES OFF'; ui.blood.style.opacity = '0'; }
    feed(`<span class="m">HOSTILES ${on ? 'ON' : 'OFF'}</span>`);
  }
  return { update, hit, playerShot, toggle: () => setEnabled(!enabled), reset: () => { if (enabled && MAP.ready) build(P.pos.x, P.pos.z); P.hp = 100; }, get arena() { return arena; }, get views() { return views; } };
})();
