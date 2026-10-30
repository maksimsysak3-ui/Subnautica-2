// =====================================================================
//  NEON SEOUL — traffic: cars, taxis and buses driving the arterials
// =====================================================================
// Right-hand traffic on Yanghwa-ro, Sinchon-ro, Gangnam-daero and the north and south roads. Each car keeps
// its lane, follows the car ahead at a safe gap, stops at the junction lights (one city-wide cycle: east–west,
// then north–south), brakes and honks for you, and turns onto the crossing road when its road runs out.
// Every car is an instance: a few draw calls for the lot, headlight beams pooled on the wet road.
const TRAFFIC = (() => {
  if (MAP.id !== 'seoul' && MAP.id !== 'bahamas') return { update() { } };
  const BH = MAP.id === 'bahamas';   // island roads: fewer cars, on the left, no lights, daylight
  const N = BH ? 22 : 64, CYCLE = { green: 13, amber: 3 };
  const cars = [];
  let built = false, t = 0, junctions = [], meshes = {};
  // ---- models: boxes merged into one geometry each, white where the paint goes (instance colour tints it) ----
  function merge(list) {
    let nv = 0, ni = 0; const gs = list.map(([w, h, d, x, y, z, c]) => { const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z); nv += g.attributes.position.count; ni += g.index.count; return [g, new THREE.Color(c)]; });
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = new Uint16Array(ni); let v0 = 0, i0 = 0;
    for (const [g, c] of gs) { pos.set(g.attributes.position.array, v0 * 3); nor.set(g.attributes.normal.array, v0 * 3); for (let i = 0; i < g.attributes.position.count; i++) col.set([c.r, c.g, c.b], (v0 + i) * 3); for (let i = 0; i < g.index.count; i++) idx[i0 + i] = g.index.getX(i) + v0; v0 += g.attributes.position.count; i0 += g.index.count; g.dispose(); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(new THREE.BufferAttribute(idx, 1)); return geo;
  }
  const PAINT = 0xffffff, GLASS = 0x141a22, TYRE = 0x161616, TRIM = 0x5a5e62;
  const TYPES = {
    car: { L: 4.4, W: 1.8, body: [[4.4, 0.6, 1.78, 0, 0.6, 0, PAINT], [1.2, 0.12, 1.7, 1.55, 0.95, 0, PAINT], [2.2, 0.52, 1.6, -0.15, 1.15, 0, GLASS], [2.0, 0.06, 1.56, -0.2, 1.43, 0, PAINT], [0.12, 0.25, 1.82, 2.2, 0.48, 0, TRIM], [0.12, 0.25, 1.82, -2.2, 0.48, 0, TRIM], ...[[1.35, 0.82], [1.35, -0.82], [-1.35, 0.82], [-1.35, -0.82]].map(([x, z]) => [0.62, 0.62, 0.24, x, 0.31, z, TYRE])],
      lights: [[0.06, 0.12, 0.34, 2.21, 0.72, 0.62, 0xfff4dc], [0.06, 0.12, 0.34, 2.21, 0.72, -0.62, 0xfff4dc], [0.06, 0.12, 0.3, -2.21, 0.74, 0.66, 0xff2a20], [0.06, 0.12, 0.3, -2.21, 0.74, -0.66, 0xff2a20]] },
    taxi: { L: 4.4, W: 1.8, body: null, lights: [[0.5, 0.16, 0.26, -0.2, 1.54, 0, 0xffd040]] },
    bus: { L: 11, W: 2.5, body: [[11, 2.4, 2.5, 0, 1.6, 0, PAINT], [10.4, 0.9, 2.52, -0.2, 2.0, 0, GLASS], [0.06, 1.6, 2.2, 5.5, 1.9, 0, GLASS], [11.1, 0.2, 2.55, 0, 0.5, 0, TRIM], ...[[3.8, 1.1], [3.8, -1.1], [-3.4, 1.1], [-3.4, -1.1]].map(([x, z]) => [0.95, 0.95, 0.3, x, 0.47, z, TYRE])],
      lights: [[0.06, 0.18, 0.4, 5.52, 0.8, 0.9, 0xfff4dc], [0.06, 0.18, 0.4, 5.52, 0.8, -0.9, 0xfff4dc], [0.06, 0.25, 0.3, -5.52, 0.9, 1.0, 0xff2a20], [0.06, 0.25, 0.3, -5.52, 0.9, -1.0, 0xff2a20], [0.05, 0.3, 1.6, 5.53, 2.75, 0, 0xffa020]] },
  };
  TYPES.taxi.body = TYPES.car.body; TYPES.taxi.lights = [...TYPES.car.lights, ...TYPES.taxi.lights];
  const COLORS = BH ? { car: [0xf0f0ec, 0xe8e6e0, 0x9ad0ec, 0xf4b0b8, 0x2a5aa0, 0xc84a3a, 0x8a8e94, 0xf6e08a], taxi: [0xf0f0ec, 0x2a2c30], bus: [0x2ab0b0, 0xf0c040, 0xe8604a] } : { car: [0xe8e6e0, 0x2a2c30, 0x8a8e94, 0x1a2a4a, 0xc8c4bc, 0x6a1a1a, 0xdedcd4], taxi: [0xe87a2a, 0xc8c4bc], bus: [0x3a9a5a, 0x2a6ab0, 0x3a9a5a] };
  function build() {
    built = true;
    const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.4 });
    const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    for (const k in TYPES) {
      const body = new THREE.InstancedMesh(merge(TYPES[k].body), bodyMat, N), lights = new THREE.InstancedMesh(merge(TYPES[k].lights), lightMat, N);
      body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
      for (const m of [body, lights]) { m.frustumCulled = false; m.count = 0; scene.add(m); }
      body.castShadow = false; body.receiveShadow = true; meshes[k] = { body, lights };
    }
    // headlight beams lying on the road
    const beamTex = canvasTex(32, 64, (g, w, h) => { const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(w * 0.35, h); g.lineTo(w * 0.65, h); g.lineTo(w, 0); g.lineTo(0, 0); g.fill(); });
    const bg = new THREE.PlaneGeometry(3.4, 11).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2).translate(7.6, 0.06, 0);
    meshes.beam = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ map: beamTex, color: 0xffe8c0, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), N);
    meshes.beam.frustumCulled = false; meshes.beam.count = 0; scene.add(meshes.beam);
    // junctions: every crossing of an x-road and a z-road
    const xs = ROADS.filter((r) => r.pts[0][1] === r.pts[1][1]), zs = ROADS.filter((r) => r.pts[0][0] === r.pts[1][0]);
    for (const a of xs) for (const b of zs) { const z = a.pts[0][1], x = b.pts[0][0]; if (x < Math.min(a.pts[0][0], a.pts[1][0]) - 1 || x > Math.max(a.pts[0][0], a.pts[1][0]) + 1 || z < Math.min(b.pts[0][1], b.pts[1][1]) - 1 || z > Math.max(b.pts[0][1], b.pts[1][1]) + 1) continue; junctions.push({ x, z, a, b }); }
    for (const r of ROADS) if (r.road >= (BH ? 6 : 10) && r.len > 80) for (let i = 0; i < Math.round(N * r.len / 2200); i++) spawn(r);
    while (cars.length < N) spawn(ROADS[(Math.random() * Math.min(5, ROADS.length)) | 0]);
  }
  // a car on road r: s along it, dir ±1, lane offset to the right of travel
  const axisX = (r) => r.pts[0][1] === r.pts[1][1];
  function lanes(r) { return BH ? [-(r.w / 4 + 0.3)] : r.road >= 15 ? [1.8, 5.4] : [2.6]; }
  function spawn(r, s) {
    const dir = Math.random() < 0.5 ? 1 : -1, kind = Math.random() < 0.14 ? 'bus' : Math.random() < 0.3 ? 'taxi' : 'car';
    const c = { r, dir, lane: lanes(r)[(Math.random() * lanes(r).length) | 0], s: s ?? Math.random() * r.len, v: 8, kind, col: new THREE.Color(COLORS[kind][(Math.random() * COLORS[kind].length) | 0]), cruise: kind === 'bus' ? 9 : 11 + Math.random() * 4, yaw: 0, horn: 0, x: 0, z: 0 };
    place(c); c.yaw = c.tyaw; cars.push(c); return c;
  }
  function place(c) {
    const r = c.r, a = r.pts[0], b = r.pts[1], L = r.len, ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    // right of travel: forward (ux,uz)·dir, right = (−uz, ux)·dir in this frame
    const fx = ux * c.dir, fz = uz * c.dir, rx = -fz, rz = fx;
    c.x = a[0] + ux * c.s + rx * c.lane; c.z = a[1] + uz * c.s + rz * c.lane; c.fx = fx; c.fz = fz;
    c.tyaw = Math.atan2(-fz, fx);   // model faces +x
  }
  // the light for a car's axis at time t: 'g' | 'a' | 'r'
  function light(isX) { if (BH) return 'g'; const T = 2 * (CYCLE.green + CYCLE.amber), u = t % T, myStart = isX ? 0 : CYCLE.green + CYCLE.amber; const k = (u - myStart + T) % T; return k < CYCLE.green ? 'g' : k < CYCLE.green + CYCLE.amber ? 'a' : 'r'; }
  // distance along the road to the next stop line ahead (and whether it's red for us)
  function stopAhead(c) {
    const isX = axisX(c.r); let best = Infinity;
    for (const j of junctions) {
      if (j.a !== c.r && j.b !== c.r) continue;
      const cross = isX ? j.b : j.a, js = isX ? (j.x - c.r.pts[0][0]) * Math.sign(c.r.pts[1][0] - c.r.pts[0][0]) : (j.z - c.r.pts[0][1]) * Math.sign(c.r.pts[1][1] - c.r.pts[0][1]);
      const line = js - c.dir * (cross.w / 2 + 2.5), d = (line - c.s) * c.dir;
      if (d > -0.5 && d < best) best = d;
    }
    return best;
  }
  function onRoadEnd(c) {
    // turn onto a road crossing here, else come round again from the far end
    const endX = c.x, endZ = c.z, opts = [];
    for (const j of junctions) if (Math.hypot(j.x - endX, j.z - endZ) < 16) { const nr = j.a === c.r ? j.b : j.b === c.r ? j.a : null; if (nr) opts.push([nr, j]); }
    if (opts.length) {
      const [nr, j] = opts[(Math.random() * opts.length) | 0], a = nr.pts[0], b = nr.pts[1], L = nr.len;
      c.r = nr; c.s = ((j.x - a[0]) * (b[0] - a[0]) + (j.z - a[1]) * (b[1] - a[1])) / L; c.dir = c.s < 12 ? 1 : c.s > L - 12 ? -1 : (Math.random() < 0.5 ? 1 : -1); c.lane = lanes(nr)[0];
      c.s += c.dir * 8; c.v = Math.min(c.v, 5);
    } else if (BH) { c.dir = -c.dir; c.s = clamp(c.s, 0.5, c.r.len - 0.5); c.v = Math.min(c.v, 3); }   // a dead end: turn round
    else { c.s = c.dir > 0 ? 2 : c.r.len - 2; }
    place(c);
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new V3(), _sc = new V3(1, 1, 1);
  function update(dt) {
    if (!MAP.ready || mode !== 'range' || SUBWAY.under || DOORS.inside) { if (built) for (const k in meshes) { const m = meshes[k]; if (m.isInstancedMesh) m.visible = !(SUBWAY.under || DOORS.inside); else { m.body.visible = m.lights.visible = !(SUBWAY.under || DOORS.inside); } } return; }
    if (!built) build();
    for (const k in meshes) { const m = meshes[k]; if (m.isInstancedMesh) m.visible = true; else m.body.visible = m.lights.visible = true; }
    t += dt;
    // who's ahead in each lane (sorted by position)
    const groups = new Map();
    for (const c of cars) { const key = `${c.r.id}|${c.dir}|${c.lane}`; let g = groups.get(key); if (!g) groups.set(key, g = []); g.push(c); }
    for (const g of groups.values()) g.sort((a, b) => (a.s - b.s) * a.dir);
    for (const g of groups.values()) for (let i = 0; i < g.length; i++) {
      const c = g[i], ahead = g[i + 1];
      let want = c.cruise;
      if (ahead) { const gap = (ahead.s - c.s) * c.dir - (TYPES[ahead.kind].L + TYPES[c.kind].L) / 2; want = Math.min(want, Math.max(0, (gap - 2.5) * 0.9)); }
      const sl = stopAhead(c), lt = light(axisX(c.r));
      if (lt !== 'g' && sl < 40 && !(lt === 'a' && sl < c.v * 0.6)) want = Math.min(want, Math.max(0, (sl - 0.5) * 0.8));
      // you, in front of the bumper
      const px = P.pos.x - c.x, pz = P.pos.z - c.z, along = px * c.fx + pz * c.fz, side = -px * c.fz + pz * c.fx;
      if (along > 0 && along < 14 + c.v && Math.abs(side) < TYPES[c.kind].W / 2 + 0.7 && Math.abs(P.pos.y - 0.2) < 2) { want = Math.min(want, Math.max(0, (along - TYPES[c.kind].L / 2 - 2) * 0.8)); if (c.v < 0.5 && (c.horn += dt) > 1.6) { c.horn = -3; if (along < 25) audio.horn(); } }
      else c.horn = Math.max(0, c.horn);
      c.v += clamp(want - c.v, -9 * dt, 3.2 * dt);
      c.s += c.v * c.dir * dt;
      if (c.s < 0 || c.s > c.r.len) onRoadEnd(c); else place(c);
      c.yaw += wrapA(c.tyaw - c.yaw) * Math.min(1, dt * 6);
      // knocked down if you stand in its way at speed
      if (Math.abs(along) < TYPES[c.kind].L / 2 + 0.3 && Math.abs(side) < TYPES[c.kind].W / 2 + 0.3 && Math.abs(P.pos.y - 0.2) < 1.8 && !P.vehicle) {
        if (c.v > 4) { BOTS.hurt(Math.round(c.v * 3)); P.shake = Math.min(2, P.shake + 1); c.v = 0; }
        P.pos.x += -c.fz * Math.sign(side || 1) * 0.25; P.pos.z += c.fx * Math.sign(side || 1) * 0.25;
      }
    }
    // draw
    const cnt = { car: 0, taxi: 0, bus: 0 }; let nb = 0; const cam = camera.position, D2 = ((MAP.drawDist || 200) + 20) ** 2;
    for (const c of cars) {
      if ((c.x - cam.x) ** 2 + (c.z - cam.z) ** 2 > D2) continue;
      const M2 = meshes[c.kind], k = cnt[c.kind]++;
      _q.setFromAxisAngle(UP, c.yaw); _m.compose(_p.set(c.x, 0.04, c.z), _q, _sc);
      M2.body.setMatrixAt(k, _m); M2.lights.setMatrixAt(k, _m); M2.body.setColorAt(k, c.col);
      if (!BH) meshes.beam.setMatrixAt(nb++, _m);
    }
    for (const k in cnt) { const M2 = meshes[k]; M2.body.count = M2.lights.count = cnt[k]; M2.body.instanceMatrix.needsUpdate = M2.lights.instanceMatrix.needsUpdate = true; if (M2.body.instanceColor) M2.body.instanceColor.needsUpdate = true; }
    meshes.beam.count = nb; meshes.beam.instanceMatrix.needsUpdate = true;
  }
  const wrapA = (x) => { while (x > Math.PI) x -= 2 * Math.PI; while (x < -Math.PI) x += 2 * Math.PI; return x; };
  return { update, get cars() { return cars; }, light };
})();
