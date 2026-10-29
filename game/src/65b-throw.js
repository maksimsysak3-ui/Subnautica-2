// =====================================================================
//  Things to throw: bottles, cans, bricks, stones lying about every map
// =====================================================================
// E picks one up (one at a time), G throws it where you're looking. Where it lands it makes a noise —
// glass smashing carries further than a brick's thud — and guards who hear it go to look, away from you.
const THROW = (() => {
  const KINDS = {
    bottle: { geo: () => { const g = new THREE.CylinderGeometry(0.035, 0.04, 0.22, 8); g.translate(0, 0.11, 0); return g; }, col: 0x2a8a4a, glass: true, range: 26, name: 'BOTTLE', ko: '병' },
    can: { geo: () => { const g = new THREE.CylinderGeometry(0.033, 0.033, 0.12, 8); g.translate(0, 0.06, 0); return g; }, col: 0xc0302a, range: 14, name: 'CAN', ko: '캔' },
    brick: { geo: () => { const g = new THREE.BoxGeometry(0.21, 0.065, 0.1); g.translate(0, 0.033, 0); return g; }, col: 0x9a4a34, range: 18, name: 'BRICK', ko: '벽돌' },
    stone: { geo: () => { const g = new THREE.DodecahedronGeometry(0.07, 0); g.translate(0, 0.06, 0); return g; }, col: 0x8a8478, range: 16, name: 'STONE', ko: '돌' },
    pipe: { geo: () => { const g = new THREE.CylinderGeometry(0.018, 0.018, 0.45, 6); g.rotateZ(Math.PI / 2); g.translate(0, 0.02, 0); return g; }, col: 0x6a6e72, metal: true, range: 22, name: 'PIPE', ko: '파이프' },
  };
  const SETS = { seoul: ['bottle', 'bottle', 'can', 'brick', 'pipe'], dar: ['stone', 'stone', 'bottle', 'brick', 'can'], manor: ['stone', 'bottle', 'pipe', 'brick'] };
  const items = [], flying = [];
  let held = null, built = false, meshes = {};
  const mat = (k) => new THREE.MeshStandardMaterial({ color: KINDS[k].col, roughness: KINDS[k].glass ? 0.15 : 0.7, metalness: KINDS[k].metal ? 0.6 : 0, transparent: !!KINDS[k].glass, opacity: KINDS[k].glass ? 0.85 : 1 });
  function build() {
    built = true;
    const set = SETS[MAP.id] || SETS.dar, R = mrand;
    // along every street, at the foot of the walls: one every ~22 m
    for (const st of STREETS) {
      if (st.len < 10) continue;
      for (let s = 4 + R() * 6; s < st.len - 4; s += 9 + R() * 9) {
        const p = pathAt(st.pts, s), side = R() < 0.5 ? 1 : -1, r = st.w / 2 - 0.35;
        const x = p.x - p.tz * r * side, z = p.z + p.tx * r * side;
        if (terrainH(x, z) > 0.5) continue;
        items.push({ kind: set[(R() * set.length) | 0], x, z, y: COL.ground(x, z, 0.5), ry: R() * 6.28, live: true });
      }
    }
    for (const k in KINDS) { const im = new THREE.InstancedMesh(KINDS[k].geo(), mat(k), items.length + 4); im.castShadow = true; im.frustumCulled = false; scene.add(im); meshes[k] = im; }
    sync();
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new V3(1, 1, 1), _p = new V3();
  function sync() {
    const n = {}; for (const k in meshes) n[k] = 0;
    for (const it of items) { if (!it.live) continue; const im = meshes[it.kind]; _q.setFromAxisAngle(UP, it.ry); if (it.lie) _q.multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2)); _m.compose(_p.set(it.x, it.y, it.z), _q, _s); im.setMatrixAt(n[it.kind]++, _m); }
    for (const k in meshes) { meshes[k].count = n[k]; meshes[k].instanceMatrix.needsUpdate = true; }
  }
  function nearest() { let b = null, bd = 1.6; for (const it of items) { if (!it.live) continue; const d = Math.hypot(it.x - P.pos.x, it.z - P.pos.z); if (d < bd && Math.abs(it.y - P.pos.y) < 1.4) { bd = d; b = it; } } return b; }
  // the one in your hand, at the bottom of the screen
  const hand = new THREE.Group(); let handMesh = null;
  function showHand() { if (handMesh) hand.remove(handMesh); handMesh = held ? new THREE.Mesh(KINDS[held.kind].geo(), mat(held.kind)) : null; if (handMesh) { handMesh.rotation.set(0.5, 0, 0.3); hand.add(handMesh); } if (!hand.parent) { hand.position.set(0.22, -0.2, -0.45); camera.add(hand); if (!camera.parent) scene.add(camera); } hand.visible = !!held; }
  function pickup() {
    if (held || P.vehicle) return false;
    const it = nearest(); if (!it) return false;
    it.live = false; held = it; sync(); showHand(); audio.pouch();
    feed(`<span class="m">${KINDS[it.kind].name} — G TO THROW</span>`);
    return true;
  }
  function toss() {
    if (!held || P.dead || P.vehicle) return false;
    const dir = new V3(); camera.getWorldDirection(dir);
    const from = camera.position.clone().addScaledVector(dir, 0.6); from.y = Math.max(from.y, P.pos.y + 1.2);
    const v = dir.multiplyScalar(15).add(new V3(P.vel.x, 3.2, P.vel.z));
    const m = new THREE.Mesh(KINDS[held.kind].geo(), mat(held.kind)); m.position.copy(from); scene.add(m);
    flying.push({ it: held, m, p: from, v, spin: new V3(8 + Math.random() * 6, Math.random() * 4, 0), t: 0, loud: true });
    held = null; showHand(); audio.holster();
    return true;
  }
  function land(f, point, normal) {
    const it = f.it, K = KINDS[it.kind], d = point.distanceTo(P.pos);
    if (f.loud) { BOTS.noise(point.x, point.z, K.range); f.loud = false; }
    if (K.glass) { audio.smash(d); emitSparks(point, 10, normal, [0.6, 1, 0.7], 3); scene.remove(f.m); return 'gone'; }
    audio.thud(d); emitPuff(point, 0x8a8478, 0.06, 0.4, normal.clone().multiplyScalar(0.4), 0.3, 1.5);
    return 'bounce';
  }
  const _d = new V3(), _n = new V3(0, 1, 0);
  function update(dt) {
    if (!MAP.ready || mode !== 'range') return;
    if (!built) build();
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i]; f.t += dt;
      f.v.y -= 9.8 * dt;
      const stepL = f.v.length() * dt; _d.copy(f.v).normalize();
      const hit = COL.ray(f.p, _d, stepL + 0.05);
      let done = false;
      if (hit) {
        const r = land(f, hit.point, hit.normal || _n);
        if (r === 'gone') done = true; else { f.p.copy(hit.point).addScaledVector(hit.normal || _n, 0.05); const n = hit.normal || _n; f.v.addScaledVector(n, -1.6 * f.v.dot(n)).multiplyScalar(0.35); }
      } else f.p.addScaledVector(f.v, dt);
      const g = COL.ground(f.p.x, f.p.z, f.p.y + 0.3);
      if (!done && f.p.y <= g + 0.02) {
        if (f.loud || f.v.length() > 3) { const r = land(f, new V3(f.p.x, g, f.p.z), _n); if (r === 'gone') done = true; else { f.p.y = g + 0.02; f.v.y = Math.abs(f.v.y) * 0.3; f.v.x *= 0.5; f.v.z *= 0.5; } }
        else { f.it.x = f.p.x; f.it.z = f.p.z; f.it.y = g; f.it.lie = f.it.kind === 'bottle' || f.it.kind === 'can'; f.it.live = true; scene.remove(f.m); sync(); done = true; }
      }
      if (!done) { f.m.position.copy(f.p); f.m.rotation.x += f.spin.x * dt; f.m.rotation.y += f.spin.y * dt; }
      if (done || f.t > 8) { if (!done) scene.remove(f.m); flying.splice(i, 1); }
    }
  }
  return {
    update, pickup, toss,
    prompt: () => { if (held || P.vehicle) return ''; const it = nearest(); return it ? `[E]  PICK UP ${MAP.id === 'seoul' ? KINDS[it.kind].ko + ' · ' : ''}${KINDS[it.kind].name}` : ''; },
    get held() { return held ? KINDS[held.kind].name : null; },
    get items() { return items; },
  };
})();
