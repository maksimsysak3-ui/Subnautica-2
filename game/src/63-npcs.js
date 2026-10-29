// =====================================================================
//  Civilians: unarmed townsfolk walking the streets around the player
// =====================================================================
// Built from the same character rig as the player, in everyday clothes. They follow the street
// polylines (keeping to the right of their direction of travel), wander the market square, scatter
// when shots are fired, and give the player cover: standing in a crowd slows enemy recognition.
const NPCS = (() => {
  const N = 30, NEAR_POSE = 42, FAR = 85, PLAZA_N = 13, SHADOW_R = 32, R = 0.28;
  // squares where people linger (not the kasbah's: that's the militia's ground)
  const CIVIL = ['Place Lalla Yeto', 'Rahba Kedima', 'Jardin du Mellah', 'Quai des Pêcheurs', 'Mosque forecourt'];
  const plazaDist = (r) => Math.hypot(clamp(P.pos.x, r.x0, r.x1) - P.pos.x, clamp(P.pos.z, r.z0, r.z1) - P.pos.z);
  function nearPlaza() { let best = null, bd = 70; for (const r of TOWN.plazas) if (CIVIL.includes(r.name)) { const d = plazaDist(r); if (d < bd) { bd = d; best = r; } } return best; }
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const SKIN = ['#e3b48e', '#c98e62', '#a8714a', '#8a5a3a', '#6b4430', '#d9a37a'];
  const TOPC = ['#8a2f2f', '#2f4f7a', '#d8d2c4', '#556b2f', '#c9a45c', '#3c3c44', '#7a5c8a', '#b86b3a', '#e8e4da', '#2a6f6a', '#5a3a2a', '#9aa4ac'];
  const PANTC = ['#2d3550', '#4a4a4a', '#c8b89a', '#1f1f22', '#6b5a44', '#3d4a3a'];
  const HAIRC = ['#1c1612', '#2e2018', '#4a3426', '#6a6058', '#121010'];
  function outfit() {
    return {
      ...REFERENCE, skin: pick(SKIN), height: rand(0.92, 1.06), shoulders: rand(0.9, 1.04), muscle: rand(0.15, 0.5), fat: rand(0.1, 0.55), headSize: rand(1.0, 1.1),
      brows: pick(['flat', 'raised', 'stern']), facialHair: pick(['none', 'none', 'stubble', 'beard', 'mustache']), hair: pick(['short', 'messy', 'buzz', 'long', 'none']), hairColor: pick(HAIRC),
      headwear: pick(['none', 'none', 'none', 'cap', 'beanie', 'boonie']), hatColor: pick(TOPC), ears: 'none',
      top: pick(['hoodie', 'longsleeve', 'tshirt', 'tshirt', 'jacket']), topColor: pick(TOPC), sleeves: pick(['rolled', 'full']), gloves: 'none',
      vest: 'none', pack: 'none', belt: Math.random() < 0.5, beltColor: '#2a2420', bottom: pick(['pants', 'pants', 'joggers', 'shorts']), pantsColor: pick(PANTC),
      kneepads: false, shoes: pick(['sneakers', 'sneakers', 'boots']), shoeColor: pick(['#2a2a2a', '#7a5a3a', '#e8e8e8', '#3a3f50']),
      eyewear: Math.random() < 0.15 ? 'sunglasses' : 'none', facePaint: 'none', patch: 'none', holster: false, watch: Math.random() < 0.4,
    };
  }
  // ~76 small meshes per rig → one vertex-coloured mesh per joint (≈16 draw calls per civilian)
  const bodyMat = { [THREE.FrontSide]: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }), [THREE.DoubleSide]: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, side: THREE.DoubleSide }) };
  const _m4 = new THREE.Matrix4(), _n3 = new THREE.Matrix3(), _pv = new V3();
  function bake(c) {
    const joints = new Set([c.root, c.pelvis, c.spine, c.head]);
    for (const k of ['armL', 'armR', 'legL', 'legR']) for (const s in c[k]) if (c[k][s] && c[k][s].isObject3D) joints.add(c[k][s]);
    c.root.updateMatrixWorld(true);
    const groups = new Map(), kill = [];
    c.root.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material, bucket = m.side === THREE.DoubleSide ? THREE.DoubleSide : THREE.FrontSide;
      if (m.transparent || m.map || !m.isMeshStandardMaterial || !o.visible) { if (!m.transparent && !m.map) o.castShadow = true; return; }   // glass, decals: kept as they are
      let j = o.parent; while (!joints.has(j)) j = j.parent;
      const key = j.uuid + bucket; let g = groups.get(key); if (!g) groups.set(key, g = { j, bucket, list: [] });
      g.list.push(o); kill.push(o);
    });
    for (const { j, bucket, list } of groups.values()) {
      let nv = 0, ni = 0;
      for (const o of list) { const g = o.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = new Uint32Array(ni);
      let v0 = 0, i0 = 0;
      const inv = new THREE.Matrix4().copy(j.matrixWorld).invert();
      for (const o of list) {
        const g = o.geometry, P0 = g.attributes.position, N0 = g.attributes.normal, cl = o.material.color;
        _m4.multiplyMatrices(inv, o.matrixWorld); _n3.getNormalMatrix(_m4);
        for (let i = 0; i < P0.count; i++) {
          _pv.fromBufferAttribute(P0, i).applyMatrix4(_m4); pos.set([_pv.x, _pv.y, _pv.z], (v0 + i) * 3);
          if (N0) { _pv.fromBufferAttribute(N0, i).applyMatrix3(_n3).normalize(); nor.set([_pv.x, _pv.y, _pv.z], (v0 + i) * 3); }
          col.set([cl.r, cl.g, cl.b], (v0 + i) * 3);
        }
        if (g.index) for (let i = 0; i < g.index.count; i++) idx[i0 + i] = g.index.getX(i) + v0; else for (let i = 0; i < P0.count; i++) idx[i0 + i] = i + v0;
        i0 += g.index ? g.index.count : P0.count; v0 += P0.count;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, bodyMat[bucket]); mesh.castShadow = true; j.add(mesh);
    }
    // kept meshes may hang off merged ones: move them onto the owning joint first
    const gone = new Set(kill);
    for (const o of kill) for (const k of [...o.children]) if (!gone.has(k)) { let j = o.parent; while (!joints.has(j)) j = j.parent; j.attach(k); }
    for (const o of kill) o.parent.remove(o);
  }
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  function makeModel(kitIn) {
    const kit = kitIn || outfit();
    applyColors(kit);
    const c = buildCharacter(kit);
    c.spine.rotation.order = 'YXZ'; c.head.rotation.order = 'YXZ'; c.pelvis.rotation.order = 'YXZ'; c.root.rotation.order = 'YXZ';
    bake(c);
    applyColors(cfg);
    const px = { head: M(new THREE.SphereGeometry(0.13, 8, 6), proxyMat, c.root, 0, c.d.hipY + 0.78, 0), torso: M(new THREE.BoxGeometry(0.44, 0.6, 0.3), proxyMat, c.root, 0, c.d.hipY + 0.32, 0), legs: M(new THREE.BoxGeometry(0.36, c.d.hipY, 0.24), proxyMat, c.root, 0, c.d.hipY / 2, 0) };
    scene.add(c.root);
    const meshes = []; c.root.traverse((o) => { if (o.isMesh && o.material !== proxyMat) meshes.push(o); });
    return { ch: c, px, kit, meshes };
  }

  const civs = [];
  let lastAlarm = -99, clock = 0, scan = 0;
  const free = (x, z) => { const p = { x, y: 0, z }; COL.resolve(p, R, 1.7); return Math.hypot(p.x - x, p.z - z) < 0.05; };
  const visibleFrom = (x, z) => { const e = new V3(P.pos.x, P.pos.y + 1.6, P.pos.z), d = new V3(x, 1.3, z).sub(e), L = d.length(); return !COL.ray(e, d.divideScalar(L), L); };

  // ---------------- placement ----------------
  function nearestSeg(st, x, z) { let bi = 0, bd = Infinity; for (let i = 0; i < st.pts.length; i++) { const d = (st.pts[i][0] - x) ** 2 + (st.pts[i][1] - z) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; }
  function onStreet(v, st, i, dir) {
    v.st = st; v.dir = dir; v.i = clamp(i, 0, st.pts.length - 1);
    if (v.i === st.pts.length - 1 && dir > 0) v.dir = -1; else if (v.i === 0 && dir < 0) v.dir = 1;
    // keep right: pavements on roads, anywhere across a lane
    const half = st.w / 2;
    v.off = st.road > 0 ? Math.max(0.3, half - rand(0.9, 1.6)) : Math.max(0, half - 0.7) * rand(0.15, 0.9);
  }
  function place(v, minD, maxD, hidden) {
    for (let t = 0; t < 60; t++) {
      let x, z;
      if (v.plaza) { const Q = v.plaza; x = rand(Q.x0 + 2, Q.x1 - 2); z = rand(Q.z0 + 2, Q.z1 - 2); const d = Math.hypot(x - P.pos.x, z - P.pos.z); if (d < minD || d > maxD) continue; }
      else {
        const a = Math.random() * Math.PI * 2, d = rand(minD, maxD); x = P.pos.x + Math.sin(a) * d; z = P.pos.z + Math.cos(a) * d;
        const id = GR.roadAt(x, z), st = id && STREETS[id - 1]; if (!st || st.len < 12) continue;
        onStreet(v, st, nearestSeg(st, x, z), Math.random() < 0.5 ? 1 : -1); towardPlayer(v, 0.7);
        const q = target(v); x = q.x; z = q.z;
      }
      if (terrainH(x, z) > 0.5 || !free(x, z)) continue;
      if (hidden && d2(x, z) < 60 * 60 && visibleFrom(x, z)) continue;
      v.x = x; v.z = z; v.y = COL.ground(x, z, 0.3); v.yaw = Math.random() * 6.28; v.panic = 0; v.idle = 0; v.stuckT = 0; v.tx = x; v.tz = z;
      v.speed = rand(1.05, 1.45); v.alive = true; v.deadT = 0; v.ko = false; v.taken = false; v.m.ch.root.rotation.x = 0;
      if (v.plaza) newPlazaGoal(v);
      return true;
    }
    return false;
  }
  const d2 = (x, z) => (x - P.pos.x) ** 2 + (z - P.pos.z) ** 2;
  // street walkers aim for the next polyline point, shifted to their side of the street
  function target(v) {
    const p = v.st.pts, j = clamp(v.i + v.dir, 0, p.length - 1), a = p[Math.min(v.i, j)], b = p[Math.max(v.i, j)];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1, s = v.off * v.dir;
    return { x: p[j][0] - dz / L * s, z: p[j][1] + dx / L * s };
  }
  // at a street's end: carry on into a street that meets it, else turn around
  function junction(v) {
    const e = v.st.pts[v.i];
    let best = null, bd = 16;
    for (const st of STREETS) {
      if (st === v.st || st.len < 12) continue;
      const k = nearestSeg(st, e[0], e[1]), d = (st.pts[k][0] - e[0]) ** 2 + (st.pts[k][1] - e[1]) ** 2;
      if (d < bd && Math.random() < 0.8) { bd = d; best = [st, k]; }
    }
    if (best) { onStreet(v, best[0], best[1], Math.random() < 0.5 ? 1 : -1); towardPlayer(v, 0.6); } else v.dir = -v.dir;
  }
  // pedestrians drift toward where the player is, so the crowd stays around them
  function towardPlayer(v, p) {
    if (Math.random() > p) return;
    const q = v.st.pts, a = q[v.i], b = q[clamp(v.i + v.dir, 0, q.length - 1)];
    if ((b[0] - a[0]) * (P.pos.x - a[0]) + (b[1] - a[1]) * (P.pos.z - a[1]) < 0) { v.dir = -v.dir; if (v.i === 0 && v.dir < 0 || v.i === q.length - 1 && v.dir > 0) v.dir = -v.dir; }
  }
  function newPlazaGoal(v) {
    const Q = v.plaza;
    for (let t = 0; t < 12; t++) { const nearP = Math.random() < 0.6, x = clamp(nearP ? P.pos.x + rand(-25, 25) : rand(Q.x0, Q.x1), Q.x0 + 1.5, Q.x1 - 1.5), z = clamp(nearP ? P.pos.z + rand(-25, 25) : rand(Q.z0, Q.z1), Q.z0 + 1.5, Q.z1 - 1.5); if (free(x, z) && Math.hypot(x - v.x, z - v.z) > 6) { v.tx = x; v.tz = z; return; } }
  }

  // ---------------- motion ----------------
  function step(v, dt) {
    if (v.idle > 0 && v.panic <= 0) { v.idle -= dt; v.vx = v.vz = 0; return; }
    if (v.route) { const r = v.route[v.ri]; v.tx = r[0]; v.tz = r[1]; }
    else if (!v.plaza) { const q = target(v); v.tx = q.x; v.tz = q.z; }
    let dx = v.tx - v.x, dz = v.tz - v.z; const L = Math.hypot(dx, dz);
    if (L < (v.route ? 0.5 : 0.9)) {
      if (v.route) { const w = v.route[v.ri][2]; if (w) v.idle = w; v.ri++; if (v.ri >= v.route.length) { if (v.fig.loop) v.ri = 0; else { v.ri = v.route.length - 1; v.arrived = true; v.idle = 1e9; } } return; }
      if (v.plaza) { newPlazaGoal(v); if (v.panic <= 0 && Math.random() < 0.6) v.idle = rand(1.5, 5); }
      else { const j = v.i + v.dir; if (j <= 0 || j >= v.st.pts.length - 1) { v.i = clamp(j, 0, v.st.pts.length - 1); junction(v); } else v.i = j; }
      return;
    }
    const sp = v.panic > 0 ? v.speed * 3.1 : v.speed;
    dx /= L; dz /= L;
    const ox = v.x, oz = v.z, p = { x: v.x + dx * sp * dt, y: v.y, z: v.z + dz * sp * dt };
    COL.resolve(p, R, 1.7);
    v.x = p.x; v.z = p.z; v.y = damp(v.y, COL.ground(v.x, v.z, v.y + 0.3), 12, dt);
    v.vx = (v.x - ox) / dt; v.vz = (v.z - oz) / dt;
    v.yaw += wrap(Math.atan2(-dx, -dz) - v.yaw) * Math.min(1, dt * (v.panic > 0 ? 10 : 5));
    // blocked (stall, parked car, someone's doorstep): turn back / choose another spot
    v.stuckT = Math.hypot(v.vx, v.vz) < sp * 0.3 ? v.stuckT + dt : 0;
    if (v.stuckT > 1.2) { v.stuckT = 0; if (v.route) { v.ri = Math.min(v.route.length - 1, v.ri + 1); } else if (v.plaza) newPlazaGoal(v); else { v.dir = -v.dir; v.off *= rand(0.3, 1); } }
  }
  const wrap = (x) => { while (x > Math.PI) x -= 2 * Math.PI; while (x < -Math.PI) x += 2 * Math.PI; return x; };

  // ---------------- pose (same IK helpers as the player; rig swapped in) ----------------
  const _v = new V3(), _w = new V3(), _a = new V3(), _b = new V3();
  function pose(v, dt) {
    const c = v.m.ch, d = c.d;
    c.root.position.set(v.x, v.y, v.z); c.root.rotation.set(0, v.yaw + Math.PI, 0);
    const keepCh = ch; ch = c;
    try {
      const lv = _v.set(v.vx || 0, 0, v.vz || 0).applyAxisAngle(UP, -(v.yaw + Math.PI)), speed = Math.hypot(lv.x, lv.z), run = clamp((speed - 2) / 2, 0, 1);
      v.gaitW = damp(v.gaitW, clamp(speed / 1.0, 0, 1), 8, dt);
      const Ls = clamp(0.32 + speed * 0.16, 0.32, 1.1);
      if (speed > 0.05) v.phase += dt * Math.PI * speed / Ls;
      const bob = v.gaitW * (0.022 + run * 0.03) * Math.abs(Math.sin(v.phase));
      c.pelvis.position.set(0, d.hipY - bob - run * 0.05, 0); c.pelvis.rotation.set(0, Math.sin(v.phase) * 0.1 * v.gaitW, 0);
      c.spine.rotation.set(0.04 + run * 0.22, -Math.sin(v.phase) * 0.12 * v.gaitW, 0);
      c.head.rotation.set(-run * 0.15, Math.sin(clock * 0.4 + v.seed) * 0.35 * (1 - v.gaitW * 0.6), 0);
      c.root.updateMatrixWorld(true);
      const dir = _w.set(lv.x, 0, lv.z); if (speed > 0.01) dir.divideScalar(speed);
      [[c.legL, c.hipL, 1, 0], [c.legR, c.hipR, -1, Math.PI]].forEach(([leg, hipA, side, off]) => {
        const hip = toRoot(hipA, T.a), u = (((v.phase + off) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        let along, lift = 0;
        if (u < Math.PI) along = Ls / 2 - Ls * (u / Math.PI); else { const q = (u - Math.PI) / Math.PI; along = -Ls / 2 + Ls * smooth(q); lift = Math.sin(q * Math.PI); }
        const st = T.b.set(side * (d.hipX + 0.02), d.ankle, 0).addScaledVector(dir, along * v.gaitW); st.y += lift * (0.1 + run * 0.08) * v.gaitW;
        ik(hip, st, d.thigh, d.shin, T.pole.set(side * 0.15, 0, 1), T.mid, T.end);
        placeSeg(leg.thigh, hip, T.mid, T.fwd); placeSeg(leg.shin, T.mid, T.end, T.fwd);
        leg.foot.position.copy(T.end); leg.foot.rotation.set(-lift * 0.35 * v.gaitW, side * 0.1, 0, 'YXZ');
      });
      // arms swing opposite the legs; pumping, bent elbows when running
      [[c.armL, c.shL, 1, Math.PI], [c.armR, c.shR, -1, 0]].forEach(([arm, shA, side, off]) => {
        const sh = toRoot(shA, _a), sw = Math.sin(v.phase + off) * v.gaitW;
        const reach = (d.upper + d.fore) * (0.93 - run * 0.35);
        const w = _b.set(sh.x + side * (0.06 + run * 0.02), sh.y - reach, sh.z + sw * (0.16 + run * 0.2) + run * 0.12);
        placeArm(arm, sh, w, null, T.pole.set(side * 0.2, 0, -1), T.fwd);
      });
    } finally { ch = keepCh; }
  }

  // ---------------- lifecycle ----------------
  function update(dt) {
    clock += dt;
    if (!MAP.ready || mode !== 'range') return;
    if (civs.length < N) {   // build the crowd a model per frame (no hitch)
      const v = { m: makeModel(), k: civs.length, seed: Math.random() * 10, phase: Math.random() * 6, gaitW: 0, plaza: false, alive: false, deadT: 20, hits: [] };
      for (const part of ['head', 'torso', 'legs']) { const m = v.m.px[part]; m.userData.target = { type: 'civ', civ: v, part }; v.hits.push(m); }
      civs.push(v); v.m.ch.root.visible = false;
    }
    const pz = nearPlaza();
    scan -= dt;
    for (const v of civs) {
      const root = v.m.ch.root;
      // recycle: out of range (or the square's crowd while you're elsewhere) → re-place near you, out of sight
      const wantPlaza = v.k < PLAZA_N && pz ? pz : false;
      if (scan <= 0 && (!v.alive ? v.deadT >= 20 : d2(v.x, v.z) > FAR * FAR || (v.plaza !== wantPlaza && d2(v.x, v.z) > 30 * 30))) {
        v.plaza = wantPlaza;
        if (place(v, v.placed ? 22 : 4, v.placed ? 70 : 55, v.placed)) { v.placed = true; setHits(v, true); } else { v.alive = false; v.deadT = 20; setHits(v, false); }
      }
      root.visible = v.alive || v.deadT < 20;
      const sh = root.visible && d2(v.x, v.z) < SHADOW_R * SHADOW_R;   // only the near crowd casts shadows
      if (v.shadow !== sh) { v.shadow = sh; for (const m of v.m.meshes) m.castShadow = sh; }
      if (!v.alive) { if (v.deadT < 20) { v.deadT += dt; const k = Math.min(1, v.deadT / 0.7); root.rotation.set(-k * k * Math.PI / 2 * 0.92, v.yaw + Math.PI, 0); } continue; }
      if (v.panic > 0) v.panic -= dt;
      step(v, dt);
      if (d2(v.x, v.z) < NEAR_POSE * NEAR_POSE) pose(v, dt); else { root.position.set(v.x, v.y, v.z); root.rotation.set(0, v.yaw + Math.PI, 0); }
    }
    if (scan <= 0) scan = 0.3;
    // scripted figures (mission targets, couriers): follow their route, posed out to scope range
    for (const v of figs) {
      const root = v.m.ch.root;
      if (!v.alive) { if (v.deadT < 90) { v.deadT += dt; const k = Math.min(1, v.deadT / 0.7); root.rotation.set(-k * k * Math.PI / 2 * 0.92, v.yaw + Math.PI, 0); } continue; }
      if (v.fig.paused) { v.vx = v.vz = 0; } else step(v, dt);
      if (v.fig.lookAt) { const L = v.fig.lookAt; v.yaw += wrap(Math.atan2(-(L.x - v.x), -(L.z - v.z)) - v.yaw) * Math.min(1, dt * 4); }
      if (d2(v.x, v.z) < 220 * 220) pose(v, dt); else { root.position.set(v.x, v.y, v.z); root.rotation.set(0, v.yaw + Math.PI, 0); }
    }
  }
  function setHits(v, on) { for (const m of v.hits) { const i = hitList.indexOf(m); if (on && i < 0) hitList.push(m); else if (!on && i >= 0) hitList.splice(i, 1); } }
  // gunfire nearby: scatter away from the shooter
  function alarm(x, z) {
    if (clock - lastAlarm < 0.15) return; lastAlarm = clock;
    for (const v of civs) {
      if (!v.alive) continue;
      const dx = v.x - x, dz = v.z - z, d = Math.hypot(dx, dz); if (d > 60) continue;
      const wasCalm = v.panic <= 0; v.panic = rand(6, 10); v.idle = 0;
      if (!wasCalm) continue;
      if (v.plaza) { const Q = v.plaza; v.tx = clamp(v.x + dx / (d || 1) * 30, Q.x0 + 1.5, Q.x1 - 1.5); v.tz = clamp(v.z + dz / (d || 1) * 30, Q.z0 + 1.5, Q.z1 - 1.5); }
      else { const q = target(v); if ((q.x - v.x) * dx + (q.z - v.z) * dz < 0) v.dir = -v.dir; }
    }
  }
  // the player's cover: each civilian within a few metres slows enemy recognition (capped)
  function conceal(p) {
    let n = 0;
    for (const v of civs) if (v.alive && Math.abs(v.x - p.x) < 7 && Math.abs(v.z - p.z) < 7 && (v.x - p.x) ** 2 + (v.z - p.z) ** 2 < 49) n++;
    return Math.min(0.7, n * 0.22);
  }
  function hit(tg, p, b) {
    const v = tg.civ; if (!v.alive) return;
    v.alive = false; v.deadT = 0; setHits(v, false);
    if (v.fig) { emitPuff(p, 0x5a1010, 0.07, 0.45, b.d0.clone().multiplyScalar(0.6), 0.5, 1.6); audio.fleshHit(p.distanceTo(P.pos)); hitFx(false); v.fig.onDeath?.(v, tg.part); return; }
    emitPuff(p, 0x5a1010, 0.07, 0.45, b.d0.clone().multiplyScalar(0.6), 0.5, 1.6);
    audio.fleshHit(p.distanceTo(P.pos));
    P.stats.score -= 100; feed('<span class="m">CIVILIAN DOWN −100</span>');
    alarm(p.x, p.z);
  }
  // ---- close quarters: a knocked-out civilian, and their clothes ----
  function koTarget(pos) {
    let best = null, bd = 1.7;
    for (const v of civs) { if (!v.alive) continue; const d = Math.hypot(v.x - pos.x, v.z - pos.z); if (d < bd && Math.abs(v.y - pos.y) < 1) { bd = d; best = v; } }
    return best;
  }
  function knockout(pos) {
    const v = koTarget(pos); if (!v) return false;
    v.alive = false; v.deadT = 0; v.ko = true; setHits(v, false);
    feed('<span class="m">CIVILIAN KNOCKED OUT</span>');
    alarm(v.x, v.z);
    return true;
  }
  function bodies() { return civs.filter((v) => !v.alive && v.deadT < 20 && v.placed).map((v) => ({ x: v.x, y: v.y, z: v.z, kit: v.m.kit, type: 'civilian', taken: v.taken, mark: () => { v.taken = true; } })); }
  // ---- traffic: a horn clears the way; a scooter at speed knocks people flying ----
  function honk(x, z, yaw) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    for (const v of civs) { if (!v.alive) continue; const dx = v.x - x, dz = v.z - z, d = Math.hypot(dx, dz); if (d < 16 && (dx * fx + dz * fz) / (d || 1) > 0.2) { v.panic = Math.max(v.panic, 1.6); v.idle = 0; } }
  }
  function bump(x, z, speed) {
    for (const v of [...civs, ...figs]) {
      if (!v.alive || Math.hypot(v.x - x, v.z - z) > 0.85) continue;
      if (speed > 5 && !v.fig) { v.alive = false; v.deadT = 0; v.ko = true; setHits(v, false); P.stats.score -= 50; feed('<span class="m">CIVILIAN HIT −50</span>'); audio.fleshHit(1); alarm(x, z); }
      else { v.panic = 2.5; }
    }
  }
  // ---- scripted figures ----
  const figs = [];
  function spawnFigure(o) {
    const v = { m: makeModel(o.kit), k: -1, seed: Math.random() * 10, phase: Math.random() * 6, gaitW: 0, alive: true, deadT: 0, hits: [], fig: o, route: o.route, ri: 0,
      x: o.route[0][0], z: o.route[0][1], y: 0, yaw: o.yaw ?? 0, speed: o.speed ?? 1.3, panic: 0, idle: 0, stuckT: 0, vx: 0, vz: 0, plaza: false };
    v.y = COL.ground(v.x, v.z, (o.y ?? 0) + 0.3);
    for (const part of ['head', 'torso', 'legs']) { const m = v.m.px[part]; m.userData.target = { type: 'civ', civ: v, part }; v.hits.push(m); }
    setHits(v, true); v.m.ch.root.visible = true; for (const m of v.m.meshes) m.castShadow = true;
    figs.push(v); return v;
  }
  function removeFigure(v) { const i = figs.indexOf(v); if (i >= 0) figs.splice(i, 1); setHits(v, false); scene.remove(v.m.ch.root); }
  return { update, alarm, conceal, hit, knockout, bodies, honk, bump, spawnFigure, removeFigure, outfit: (over = {}) => ({ ...outfit(), ...over }), get figs() { return figs; }, canKnockout: (pos) => !!koTarget(pos), get civs() { return civs; } };
})();
