// =====================================================================
//  Enemy fighters: the tested combat AI (ai/core.mjs → AICORE) running in the city
// =====================================================================
// A 140 m "arena" follows the player: its navigation grid and cover points are sampled from the
// city's real collision boxes, and line of sight / bullets use the same collision as the player.
// The AI still only knows what it perceives (sight, sound, being shot at, squad callouts).
const BOTS = (() => {
  const { World, Agent, TUNE } = AICORE;
  const SIZE = 140, RELOCATE = 45, N_BOTS = 4, RESPAWN_S = 20;
  // the market square (player spawn) stays a light zone: no spawns inside it, at most 2 hostiles while you're there
  const SQ_PAD = 12, SQ_MAX = 2;
  const inSquare = (x, z, pad = 0) => x > SQ.x0 - pad && x < SQ.x1 + pad && z > SQ.z0 - pad && z < SQ.z1 + pad;
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

  // ---------------- tuning for the city (the lab defaults are tuned for small arenas) ----------------
  Object.assign(TUNE.vision, { rate: TUNE.vision.rate * 0.3, distScale: 20, range: 85 });
  Object.assign(TUNE.aim, { react: 0.75, reactSpread: 0.35, gainSd: 0.13, lateralSd: 0.065, trackGain: 4 });
  TUNE.weapon.spread = 0.02;
  const HURT = { head: 15, torso: 7, legs: 5 }, GRACE = 10;   // damage the player takes per hit (≈ 14 body hits)

  // ---------------- soldiers use the player's own character rig + rifle, in enemy kit ----------------
  const KITS = [
    { ...PRESETS['Urban Black'] },
    { ...PRESETS['Desert'], topColor: '#3b3a33', pantsColor: '#4a4436', vestColor: '#2c2e25', hatColor: '#3a3a30', packColor: '#2c2e25' },
    { ...PRESETS['Woodland'], topColor: '#2a2d33', vestColor: '#33352a', pantsColor: '#2f3236' },
  ];
  let kitMats = null;
  // clone every slot material per kit, coloured for that kit (the player's own materials are untouched)
  function buildKitMats() {
    kitMats = KITS.map((k) => { applyColors(k); const m = new Map(); for (const key in SLOT) { const mat = SLOT[key]; if (mat && mat.isMaterial) m.set(mat, mat.clone()); } return m; });
    applyColors(cfg);
  }
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const pool = [];
  function makeModel(k) {
    if (!kitMats) buildKitMats();
    const kit = KITS[k % KITS.length], mats = kitMats[k % KITS.length];
    const c = buildCharacter(kit);
    c.spine.rotation.order = 'YXZ'; c.head.rotation.order = 'YXZ'; c.pelvis.rotation.order = 'YXZ'; c.root.rotation.order = 'YXZ';
    const g = buildRifle(kit);
    c.root.add(g.group);
    c.root.traverse((o) => { if (o.isMesh) { const r = mats.get(o.material); if (r) o.material = r; o.castShadow = true; } });
    const flash = M(new THREE.SphereGeometry(0.07, 6, 4), flashMat, g.group, g.muzzle.x, g.muzzle.y, g.muzzle.z + 0.08); flash.scale.set(1, 1, 2.4); flash.visible = false;
    // invisible hit volumes (head / torso / legs) that follow the rig
    const px = { head: M(new THREE.SphereGeometry(0.135, 8, 6), proxyMat, c.root), torso: M(new THREE.BoxGeometry(0.46, 0.62, 0.32), proxyMat, c.root), legs: M(new THREE.BoxGeometry(0.38, 1, 0.26), proxyMat, c.root) };
    scene.add(c.root);
    return { ch: c, gun: g, flash, px, k };
  }
  function takeModel(i) { const m = pool.length ? pool.pop() : makeModel(i); m.ch.root.visible = true; return m; }
  function makeView(agent, i) {
    const model = takeModel(i);
    const v = { agent, model, y: 0, yaw: agent.look.yaw, phase: Math.random() * 6, gaitW: 0, crouchT: 0, lowT: 0.6, prevU: [0, 0], alive: true, deadT: 0, hits: [] };
    for (const part of ['head', 'torso', 'legs']) { const m = model.px[part]; m.userData.target = { type: 'bot', view: v, part }; hitList.push(m); v.hits.push(m); }
    return v;
  }
  function dropView(v) { for (const m of v.hits) { const i = hitList.indexOf(m); if (i >= 0) hitList.splice(i, 1); } v.model.ch.root.visible = false; v.model.ch.root.rotation.x = 0; pool.push(v.model); }
  // pose a soldier with the same IK helpers the player uses (swap the rig the helpers act on)
  const _v = new V3(), _w = new V3(), _q = new THREE.Quaternion(), _q2b = new THREE.Quaternion();
  function poseSoldier(v, dt, wx, wz, near) {
    const a = v.agent, m = v.model, c = m.ch;
    v.yaw = v.yaw + wrapA(a.look.yaw - v.yaw) * Math.min(1, dt * 10);
    c.root.position.set(wx, v.y, wz); c.root.rotation.set(0, v.yaw + Math.PI, 0);
    m.flash.visible = arena.time - a.lastShotT < 0.05;
    if (!near) return;
    const keepCh = ch, keepGun = gun; ch = c; gun = m.gun;
    try {
      const d = c.d;
      const lv = _v.set(a.vel.x, 0, a.vel.z).applyAxisAngle(UP, -(v.yaw + Math.PI)), speed = Math.hypot(lv.x, lv.z);
      v.gaitW = damp(v.gaitW, clamp(speed / 1.2, 0, 1), 8, dt);
      v.crouchT = damp(v.crouchT, a.stance === 'stand' ? 0 : 1, 9, dt);
      const engaging = a.action && (a.action.type === 'engage' || a.action.type === 'hold' || a.action.type === 'suppress');
      v.lowT = damp(v.lowT, engaging ? 0 : speed > 3.5 ? 1 : 0.55, 6, dt);
      const L = clamp(0.3 + speed * 0.13, 0.3, 1.05) * (1 - v.crouchT * 0.35);
      if (speed > 0.05) v.phase += dt * Math.PI * speed / L;
      const bob = v.gaitW * 0.028 * Math.abs(Math.sin(v.phase)), bladed = 1 - v.lowT * 0.6, pitch = a.look.pitch;
      const pelYaw = -0.2 * bladed + Math.sin(v.phase) * 0.08 * v.gaitW, spYaw = -0.3 * bladed - Math.sin(v.phase) * 0.12 * v.gaitW;
      c.pelvis.position.set(0, d.hipY - v.crouchT * d.hipY * 0.3 - bob, 0); c.pelvis.rotation.set(0, pelYaw, 0);
      const lean = 0.12 * v.crouchT - 0.3 * pitch * (1 - v.lowT);
      c.spine.rotation.set(lean, spYaw, 0);
      c.head.rotation.set(-pitch * 0.55 - lean * 0.6, -(pelYaw + spYaw) * 0.95, 0);
      c.root.updateMatrixWorld(true);
      const dir = _w.set(lv.x, 0, lv.z); if (speed > 0.01) dir.divideScalar(speed);
      [[c.legL, c.hipL, 1, 0], [c.legR, c.hipR, -1, Math.PI]].forEach(([leg, hipA, side, off]) => {
        const hip = toRoot(hipA, T.a);
        const u = (((v.phase + off) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        let along, lift = 0;
        if (u < Math.PI) along = L / 2 - L * (u / Math.PI); else { const q = (u - Math.PI) / Math.PI; along = -L / 2 + L * smooth(q); lift = Math.sin(q * Math.PI); }
        const st = T.b.set(side * (d.hipX + 0.025 + 0.04 * bladed + 0.05 * v.crouchT), d.ankle, 0);
        st.z += side > 0 ? 0.1 * bladed + 0.24 * v.crouchT : -0.08 * bladed - 0.12 * v.crouchT;
        st.addScaledVector(dir, along * v.gaitW); st.y += lift * 0.11 * v.gaitW;
        T.pole.set(side * 0.2, 0, 1);
        ik(hip, st, d.thigh, d.shin, T.pole, T.mid, T.end);
        placeSeg(leg.thigh, hip, T.mid, T.fwd); placeSeg(leg.shin, T.mid, T.end, T.fwd);
        leg.foot.position.copy(T.end); leg.foot.rotation.set(-lift * 0.35 * v.gaitW, side * 0.12 + pelYaw * 0.6, 0, 'YXZ');
      });
      // rifle: aimed along the look direction, or carried at low ready
      const mount = toRoot(c.mount, T.a), low = toRoot(c.lowMount, T.b);
      const aimW = _v.set(-Math.sin(a.look.yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(a.look.yaw) * Math.cos(pitch));
      const dirRoot = aimW.applyQuaternion(_q.copy(c.root.quaternion).invert());
      lookQuat(dirRoot, T.q);
      lookQuat(T.c.set(0.66, -0.58, 0.48).normalize(), T.q2); T.q2.multiply(_q2b.setFromEuler(_e1.set(0, 0, 0.25)));
      T.q.slerp(T.q2, v.lowT); mount.lerp(low, v.lowT);
      gun.group.quaternion.copy(T.q);
      const anchorPt = T.c.copy(gun.butt).multiplyScalar(GUN_SCALE).applyQuaternion(T.q);
      gun.group.position.copy(mount).sub(anchorPt);
      gun.group.updateMatrix(); gun.group.updateMatrixWorld(true);
      const gunX = new V3(1, 0, 0).applyQuaternion(T.q), gunY = new V3(0, 1, 0).applyQuaternion(T.q);
      placeArm(c.armR, toRoot(c.shR, T.a), gunToRoot(gun.gripWrist, T.b), gunToRoot(gun.gripPalm, new V3()), T.pole.set(-0.9, -1, -0.35), gunX);
      const wrist = supportPt(gun.support.wrist, new V3()), palm = supportPt(gun.support.palm, new V3());
      placeArm(c.armL, toRoot(c.shL, T.a), wrist, palm, T.pole.set(0.7, -1, -0.1), gunY);
      // hit volumes follow the posed body
      c.root.updateMatrixWorld(true);
      const hp = toRoot(c.head, T.a); m.px.head.position.set(hp.x, hp.y + d.hh * 0.5, hp.z);
      const sp = toRoot(c.spine, T.b); m.px.torso.position.set(sp.x, sp.y + d.torso * 0.45, sp.z);
      const py = c.pelvis.position.y; m.px.legs.position.set(0, py / 2, 0); m.px.legs.scale.y = Math.max(0.3, py);
    } finally { ch = keepCh; gun = keepGun; }
  }
  const wrapA = (x) => { while (x > Math.PI) x -= 2 * Math.PI; while (x < -Math.PI) x += 2 * Math.PI; return x; };

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
    hp.id = 'hpbar'; cnt.id = 'hpcnt';
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
    me.script = (a, dt, w) => { const hid = clock < graceUntil; a.pos = hid ? { x: 1e4, y: 0, z: 1e4 } : { x: P.pos.x - w.ox, y: P.pos.y, z: P.pos.z - w.oz }; a.vel = { x: P.vel.x, y: 0, z: P.vel.z }; a.stance = P.crouch ? 'crouch' : 'stand'; a.look = { yaw: P.yaw, pitch: P.pitch }; a.alive = !P.dead; a.conceal = NPCS.conceal(P.pos); a.disguise = DISGUISE.level(); };
    me.integrate = function (dt, w) { // footsteps carry: the AI hears you move
      const sp = Math.hypot(this.vel.x, this.vel.z); this.stepAcc = (this.stepAcc || 0) + sp * dt;
      if (this.stepAcc > 0.75) { this.stepAcc = 0; const H = TUNE.hearing; w.emitSound(this.pos, sp > 4.6 ? H.sprint : this.stance !== 'stand' ? H.crouch : sp > 2.8 ? H.run : H.walk, 'step', this.id); }
    };
    me.onHit = (dmg, part) => hurtPlayer(dmg, part);
    me.onNearMiss = () => { audio.crack(); P.shake = Math.min(1.5, P.shake + 0.35); };
    lastTracer = arena.time;
    // kasbah sentries at their posts (each post stays empty for a while after its man falls)
    TOWN.guards.filter((g) => clock >= (g.deadUntil || 0) && Math.abs(g.x - arena.ox) < SIZE / 2 - 4 && Math.abs(g.z - arena.oz) < SIZE / 2 - 4)
      .sort((a, b) => Math.hypot(a.x - P.pos.x, a.z - P.pos.z) - Math.hypot(b.x - P.pos.x, b.z - P.pos.z)).slice(0, 14).forEach(spawnGuard);
    for (let i = 0; i < cap(); i++) spawnBot(i);
  }
  // somewhere outdoors, 30–62 m away, out of the player's sight
  function spawnPoint() {
    const eye = new V3(P.pos.x, P.pos.y + 1.6, P.pos.z);
    for (let t = 0; t < 300; t++) {
      const a = Math.random() * Math.PI * 2, d = rand(40, 66), x = P.pos.x + Math.sin(a) * d, z = P.pos.z + Math.cos(a) * d;
      if (Math.abs(x - arena.ox) > SIZE / 2 - 4 || Math.abs(z - arena.oz) > SIZE / 2 - 4) continue;
      if (inSquare(x, z, SQ_PAD)) continue;
      const g = GR.get(x, z); if (g !== GR.STREET && g !== GR.PAVE) continue;
      const lp = toLocal(x, z); if (!arena.free(lp)) continue;
      const tgt = new V3(x, 1.3, z), dir = tgt.clone().sub(eye), L = dir.length();
      if (!COL.ray(eye, dir.divideScalar(L), L)) continue;   // visible from the player → not here
      return lp;
    }
    return null;
  }
  let extra = 0;   // mission pressure: more roaming hostiles
  const cap = () => inSquare(P.pos.x, P.pos.z, SQ_PAD) && !extra ? SQ_MAX : N_BOTS + extra;
  const roaming = () => views.filter((v) => v.agent.alive && !v.post).length;
  function spawnGuard(g) {
    const lp = arena.nearestFree(toLocal(g.x, g.z));
    const a = new Agent(arena, { team: 'red', pos: lp, yaw: g.yaw, profile: 'operator', patrol: [lp, arena.nearestFree(toLocal(g.x - Math.sin(g.yaw) * 5, g.z - Math.cos(g.yaw) * 5))] });
    a.mission = 'guard';
    const v = makeView(a, views.length); v.post = g; views.push(v);
  }
  function spawnBot(i) {
    if (roaming() >= cap()) return false;
    const p = spawnPoint(); if (!p) return false;
    const prof = ['recruit', 'recruit', 'operator', 'recruit', 'operator', 'veteran'][i % 6];
    const a = new Agent(arena, { team: 'red', pos: p, yaw: Math.random() * 6.28, profile: prof });
    views.push(makeView(a, i));
    return true;
  }
  function hurtPlayer(dmg, part) {
    if (P.dead || clock < graceUntil) return;
    P.hp = Math.max(0, P.hp - (typeof part === 'number' ? part : HURT[part] ?? 12)); P.hurtT = time0();
    audio.hurt(); P.shake = Math.min(2, P.shake + 0.8); flinch(Math.random() < 0.5 ? -1 : 1, part === 'head' ? 1.6 : 1);
    ui.blood.style.opacity = String(Math.min(1, 0.35 + (100 - P.hp) / 120));
    me.health = P.hp;
    if (P.hp <= 0) { P.dead = true; P.deadT = 3.2; me.alive = false; ui.dead.style.display = 'grid'; feed(`<span class="m">KILLED${part === 'head' ? ' — HEADSHOT' : ''}</span>`); }
  }
  let clock = 0, graceUntil = GRACE; const time0 = () => clock;
  // player's own shots: the AI hears them, and rounds cracking past make it duck
  function playerShot(origin, dir) {
    if (!arena || !enabled) return;
    const lo = toLocal(origin.x, origin.z);
    me.lastShotT = arena.time; NPCS.alarm(origin.x, origin.z);
    if (views.some((v) => v.agent.alive && Math.hypot(v.agent.pos.x + arena.ox - origin.x, v.agent.pos.z + arena.oz - origin.z) < 90)) DISGUISE.blow('shot');
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
    const dmg = TUNE.weapon.dmg[tg.part] * (b.dmg ?? clamp(b.mass ?? 1, 0.3, 1.3));
    a.onHit(dmg, tg.part, me, b.d0, arena);
    emitPuff(p, 0x5a1010, 0.07, 0.45, b.d0.clone().multiplyScalar(0.6), 0.5, 1.6);
    audio.fleshHit(p.distanceTo(P.pos));
    hitFx(false);
    if (!a.alive) { P.stats.score += tg.part === 'head' ? 40 : 25; feed(`<span class="s">ENEMY DOWN${tg.part === 'head' ? ' — HEADSHOT' : ''} +${tg.part === 'head' ? 40 : 25}</span>`); }
  }

  function animate(v, dt) {
    const a = v.agent, wx = a.pos.x + arena.ox, wz = a.pos.z + arena.oz, c = v.model.ch;
    v.y = damp(v.y, COL.ground(wx, wz, v.y + 0.3), 12, dt);
    if (!a.alive) {
      if (v.alive) { v.alive = false; v.deadT = 0; for (const m of v.hits) { const i = hitList.indexOf(m); if (i >= 0) hitList.splice(i, 1); } if (v.post) v.post.deadUntil = clock + 240; else pending.push(extra ? 6 : RESPAWN_S); v.model.flash.visible = false; }
      v.deadT += dt; const k = Math.min(1, v.deadT / 0.6);
      c.root.position.set(wx, v.y, wz); c.root.rotation.set(-k * k * Math.PI / 2 * 0.92, v.yaw + Math.PI, 0);
      return;
    }
    const dist = Math.hypot(wx - camera.position.x, wz - camera.position.z);
    poseSoldier(v, dt, wx, wz, dist < 70);
  }
  function tracers() {
    for (const tr of arena.tracers) {
      if (tr.t <= lastTracer) continue;
      const A = new V3(tr.a.x + arena.ox, tr.a.y, tr.a.z + arena.oz), B = new V3(tr.b.x + arena.ox, tr.b.y, tr.b.z + arena.oz);
      const d = B.clone().sub(A), L = d.length(); d.divideScalar(L);
      const m = new THREE.Mesh(tracerGeo2, tracerMat2); m.position.copy(A); m.lookAt(B); m.scale.set(1, 1, Math.min(L, 14)); m.frustumCulled = false;
      scene.add(m); tracersFx.push({ m, A, d, L, t: 0 });
      audio.enemyShot(A.distanceTo(P.pos)); NPCS.alarm(A.x, A.z);
      if (!tr.hit) { const h = COL.ray(A, d, L + 0.2); if (h) { HOLES.add(h.point, h.normal, 1); emitPuff(h.point, 0x8a8478, 0.08, 0.7, h.normal.clone().multiplyScalar(0.6), 0.35, 1.6); emitSparks(h.point, 3, h.normal, [0.9, 0.75, 0.5], 2); } }
    }
    lastTracer = arena.time;
  }
  // ---- suspicion: a triangle over each guard who's noticed you, filling yellow as he works out who you are;
  // red once he has. Guards out of view get theirs pinned to the edge of the screen. ----
  const marks = [], _mp = new V3();
  function markEl() {
    const d = document.createElement('div'); d.style.cssText = 'position:absolute;width:26px;height:23px;transform:translate(-50%,-100%);pointer-events:none;display:none;filter:drop-shadow(0 0 3px rgba(0,0,0,.8))';
    d.innerHTML = '<svg viewBox="0 0 26 23" width="26" height="23"><defs><clipPath id="tri"><path d="M13 1 L25 22 L1 22 Z"/></clipPath></defs><rect class="f" x="0" y="23" width="26" height="23" clip-path="url(#tri)" fill="#ffcc33"/><path d="M13 1 L25 22 L1 22 Z" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    document.getElementById('hud').appendChild(d); return { d, f: d.querySelector('.f'), path: d.querySelector('path') };
  }
  function suspicionMarks() {
    let n = 0;
    for (const v of views) {
      const a = v.agent; if (!a.alive || !me) continue;
      const s = a.sus.get(me.id) || 0, known = a.mem.get(me.id)?.visible || s >= 1, wx = a.pos.x + arena.ox, wz = a.pos.z + arena.oz;
      if (s < 0.04 && !known) continue;
      if (Math.hypot(wx - P.pos.x, wz - P.pos.z) > 90) continue;
      const m = marks[n] || (marks[n] = markEl()); n++;
      _mp.set(wx, v.y + 2.25, wz).project(camera);
      let x = _mp.x, y = _mp.y; const behind = _mp.z > 1; if (behind) { x = -x; y = -y; }
      const off = behind || Math.abs(x) > 0.94 || Math.abs(y) > 0.9;
      if (off) { const k = 1 / Math.max(Math.abs(x) / 0.94, Math.abs(y) / 0.9, 1e-3); x *= k; y *= k; }
      m.d.style.display = 'block'; m.d.style.left = `${(x * 0.5 + 0.5) * innerWidth}px`; m.d.style.top = `${(-y * 0.5 + 0.5) * innerHeight}px`;
      m.d.style.transform = `translate(-50%,-100%) scale(${off ? 0.75 : 1})`;
      const k = Math.min(1, s); m.f.setAttribute('y', String(23 - 23 * k)); m.f.setAttribute('fill', known ? '#e8432e' : '#ffcc33');
      m.path.setAttribute('stroke', known ? '#ffb0a0' : '#ffffff'); m.d.style.opacity = known ? String(0.75 + 0.25 * Math.sin(clock * 12)) : '1';
    }
    for (let i = n; i < marks.length; i++) marks[i].d.style.display = 'none';
  }
  function update(dt) {
    clock += dt;
    if (!enabled || !MAP.ready) { for (const m of marks) m.d.style.display = 'none'; return; }
    if (!arena) graceUntil = clock + GRACE;
    if (!arena || Math.hypot(P.pos.x - arena.ox, P.pos.z - arena.oz) > RELOCATE) build(P.pos.x, P.pos.z);
    arena.step(Math.min(dt, 0.05));
    if (P.disguise && views.some((v) => v.agent.alive && v.agent.mem.get(me.id)?.visible)) DISGUISE.blow('seen');
    for (const v of views) animate(v, dt);
    suspicionMarks();
    tracers();
    for (let i = tracersFx.length - 1; i >= 0; i--) { const f = tracersFx[i]; f.t += dt; f.m.position.copy(f.A).addScaledVector(f.d, Math.min(f.L, f.t * 900)); if (f.t > f.L / 900 + 0.02) { scene.remove(f.m); tracersFx.splice(i, 1); } }
    // replacements for the fallen (out of sight), cleanup of old bodies
    for (let i = pending.length - 1; i >= 0; i--) { pending[i] -= dt; if (pending[i] <= 0) { if (spawnBot(views.length)) pending.splice(i, 1); else pending[i] = 1; } }
    if (roaming() + pending.length < cap()) pending.push(extra ? 3 : 8);   // left the square: top back up
    for (let i = views.length - 1; i >= 0; i--) { const v = views[i]; if (!v.alive && v.deadT > 25) { dropView(v); views.splice(i, 1); arena.agents.splice(arena.agents.indexOf(v.agent), 1); } }
    // health: slow regeneration after a few quiet seconds; death → regroup at the spawn
    if (P.dead) {
      for (const k in keys) keys[k] = false; P.trigger = false; P.vel.set(0, 0, 0);
      P.deadT -= dt;
      if (P.deadT <= 0) { DISGUISE.ownGear(); DISGUISE.toggleHolster(false); P.dead = false; P.hp = 100; ui.dead.style.display = 'none'; P.pos.set(SPAWN.x, 0, SPAWN.z); P.yaw = SPAWN.yaw; graceUntil = clock + GRACE; build(P.pos.x, P.pos.z); }
    } else if (clock - P.hurtT > 5 && P.hp < 100) P.hp = Math.min(100, P.hp + 8 * dt);
    ui.fill.style.width = `${P.hp}%`; ui.fill.style.background = P.hp < 35 ? '#d0503a' : '#c9d4c0';
    if (clock - P.hurtT > 0.4) ui.blood.style.opacity = String(Math.max(0, (60 - P.hp) / 80));
    ui.cnt.textContent = clock < graceUntil ? `SPAWN PROTECTION ${Math.ceil(graceUntil - clock)}` : `HOSTILES ${views.filter((v) => v.agent.alive).length}${me && me.conceal > 0.15 ? ' · HIDDEN IN CROWD' : ''}`;
  }
  function setEnabled(on) {
    enabled = on;
    if (!on) { for (const v of views) dropView(v); views = []; arena = null; for (const f of tracersFx) scene.remove(f.m); tracersFx = []; ui.cnt.textContent = 'HOSTILES OFF'; ui.blood.style.opacity = '0'; }
    feed(`<span class="m">HOSTILES ${on ? 'ON' : 'OFF'}</span>`);
  }
  // ---- close quarters: bodies to strip, sentries to take down from behind ----
  const wpos = (v) => ({ x: v.agent.pos.x + arena.ox, z: v.agent.pos.z + arena.oz });
  function bodies() {
    if (!arena) return [];
    return views.filter((v) => !v.alive && v.deadT < 25).map((v) => { const p = v.model.ch.root.position; return { x: p.x, y: v.y, z: p.z, kit: KITS[v.model.k % KITS.length], type: 'militia', taken: v.taken, mark: () => { v.taken = true; } }; });
  }
  function takedownTarget(pos) {
    if (!arena || !enabled) return null;
    let best = null, bd = 1.8;
    for (const v of views) {
      if (!v.agent.alive) continue;
      const w = wpos(v), dx = pos.x - w.x, dz = pos.z - w.z, d = Math.hypot(dx, dz);
      if (d > bd || Math.abs((v.y || 0) - pos.y) > 1) continue;
      const fx = -Math.sin(v.agent.look.yaw), fz = -Math.cos(v.agent.look.yaw), facing = (fx * dx + fz * dz) / (d || 1);
      if (facing < 0.25 || !v.agent.mem.get(me.id)?.visible) { bd = d; best = v; }
    }
    return best;
  }
  function takedown(pos) {
    const v = takedownTarget(pos); if (!v) return false;
    const w = wpos(v);
    v.agent.onHit(999, 'torso', me, { x: w.x - pos.x, y: 0, z: w.z - pos.z }, arena);
    P.stats.score += 30; feed('<span class="s">SILENT TAKEDOWN +30</span>');
    return true;
  }
  function ram(x, z, speed) {
    if (!arena) return;
    for (const v of views) { if (!v.agent.alive) continue; const w = wpos(v); if (Math.hypot(w.x - x, w.z - z) < 1.0 && speed > 4) { v.agent.onHit(speed * 9, 'torso', me, { x: w.x - x, y: 0, z: w.z - z }, arena); if (!v.agent.alive) { P.stats.score += 25; feed('<span class="s">RUN DOWN +25</span>'); } } }
  }
  // a noise you made somewhere else (a thrown bottle): guards who hear it go and look there
  function noise(x, z, range) { if (!arena || !me) return; arena.emitSound({ x: x - arena.ox, y: 0, z: z - arena.oz }, range, 'noise', me.id); NPCS.alarm(x, z); }
  return { update, hit, playerShot, bodies, ram, noise, hurt: (d) => hurtPlayer(d, d), setPressure: (n) => { extra = n; }, get clock() { return clock; }, takedown, canTakedown: (pos) => !!takedownTarget(pos), toggle: () => setEnabled(!enabled), reset: () => { if (enabled && MAP.ready) build(P.pos.x, P.pos.z); P.hp = 100; }, get arena() { return arena; }, get views() { return views; } };
})();
