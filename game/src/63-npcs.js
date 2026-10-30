// =====================================================================
//  Civilians: unarmed townsfolk walking the streets around the player
// =====================================================================
// Built from the same character rig as the player, in everyday clothes. They follow the street
// polylines (keeping to the right of their direction of travel), wander the market square, scatter
// when shots are fired, and give the player cover: standing in a crowd slows enemy recognition.
const NPCS = (() => {
  // a big crowd: the near ones are fully posed rigs, the rest a single baked mesh each (one draw call)
  // N posed civilians live near you (full rigs, collision, panic, talk); WALKERS more fill the streets out to the
  // draw distance. Beyond posing range everyone is drawn as an instance of one of K outfits.
  const N = MAP.id === 'seoul' ? 50 : MAP.id === 'manor' ? 36 : 46, WALKERS = MAP.id === 'seoul' ? 820 : MAP.id === 'manor' ? 220 : MAP.id === 'bahamas' ? 420 : 600, K = 16, NEAR_POSE = 26, FAR = 85, PLAZA_N = 18, SHADOW_R = 16, R = 0.28;
  // squares where people linger (not the kasbah's: that's the militia's ground)
  const CIVIL = ['Harbour front', 'Resort beach', 'Pool deck', 'Straw market', 'Forecourt', 'Front lawn', 'East lawn', 'Terrace', 'Place Lalla Yeto', 'Rahba Kedima', 'Jardin du Mellah', 'Quai des Pêcheurs', 'Mosque forecourt', 'Station plaza', 'Food alley', 'Market square', 'Gangnam plaza', 'Hangang park', 'Market plaza', 'Ahyeon plaza'];
  const plazaDist = (r) => Math.hypot(clamp(P.pos.x, r.x0, r.x1) - P.pos.x, clamp(P.pos.z, r.z0, r.z1) - P.pos.z);
  function nearPlaza() { let best = null, bd = 70; for (const r of TOWN.plazas) if (CIVIL.includes(r.name)) { const d = plazaDist(r); if (d < bd) { bd = d; best = r; } } return best; }
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const SKIN = ['#e3b48e', '#c98e62', '#a8714a', '#8a5a3a', '#6b4430', '#d9a37a'];
  const TOPC = ['#8a2f2f', '#2f4f7a', '#d8d2c4', '#556b2f', '#c9a45c', '#3c3c44', '#7a5c8a', '#b86b3a', '#e8e4da', '#2a6f6a', '#5a3a2a', '#9aa4ac'];
  const PANTC = ['#2d3550', '#4a4a4a', '#c8b89a', '#1f1f22', '#6b5a44', '#3d4a3a'];
  const HAIRC = ['#1c1612', '#2e2018', '#4a3426', '#6a6058', '#121010'];
  // the manor's guests dress for the gala
  const FORMAL = ['#141416', '#1a2238', '#2a2a2e', '#4a1a24', '#e8e4dc', '#2a3a2a'];
  function outfit() {
    if (MAP.id === 'bahamas') return { ...REFERENCE, skin: pick(SKIN), height: rand(0.92, 1.06), shoulders: rand(0.9, 1.04), muscle: rand(0.15, 0.5), fat: rand(0.1, 0.55), headSize: rand(1.0, 1.1), brows: pick(['flat', 'raised']), facialHair: pick(['none', 'none', 'stubble', 'beard']), hair: pick(['short', 'messy', 'long', 'buzz']), hairColor: pick(HAIRC), headwear: pick(['none', 'cap', 'boonie', 'none']), hatColor: pick(['#f0f0ec', '#e8c060', '#2ab0d0', '#f4b0b8']), ears: 'none', top: pick(['tshirt', 'tshirt', 'tshirt', 'longsleeve']), topColor: pick(['#f0f0ec', '#2ab0d0', '#f6e08a', '#f4b0b8', '#a8e0c8', '#e8604a', '#9ad0ec', '#f8c8a0']), sleeves: 'rolled', gloves: 'none', vest: 'none', pack: 'none', belt: false, bottom: 'shorts', pantsColor: pick(['#2a5aa0', '#e8e0d0', '#2ab0b0', '#c84a3a', '#3a3a3a', '#f0c040']), kneepads: false, shoes: 'sneakers', shoeColor: pick(['#f0f0ec', '#c8a878', '#2a2a2a']), eyewear: Math.random() < 0.6 ? 'sunglasses' : 'none', facePaint: 'none', patch: 'none', holster: false, watch: Math.random() < 0.4 };
    if (MAP.id === 'manor') return { ...REFERENCE, skin: pick(SKIN), height: rand(0.92, 1.06), shoulders: rand(0.9, 1.04), muscle: rand(0.15, 0.4), fat: rand(0.1, 0.45), headSize: rand(1.0, 1.1), brows: pick(['flat', 'raised']), facialHair: pick(['none', 'none', 'stubble', 'beard']), hair: pick(['short', 'long', 'messy', 'buzz']), hairColor: pick(HAIRC), headwear: 'none', ears: 'none', top: pick(['jacket', 'jacket', 'longsleeve']), topColor: pick(FORMAL), sleeves: 'full', gloves: 'none', vest: 'none', pack: 'none', belt: false, bottom: 'pants', pantsColor: pick(['#141416', '#1a1a22', '#2a2a2e']), kneepads: false, shoes: 'boots', shoeColor: '#0e0e10', eyewear: 'none', facePaint: 'none', patch: 'none', holster: false, watch: Math.random() < 0.6 };
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
  // ---------------- the crowd's bodies: one baked, standing body per outfit, limbs tagged for swinging ----------------
  // limb: 0 body, 1 left leg, 2 right leg, 3 left arm, 4 right arm; pivY: the hip or shoulder height it swings from
  function crowdGeo(m, low) {
    const c = m.ch; c.root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(c.root.matrixWorld).invert(), limbOf = new Map();
    [[c.legL, 1], [c.legR, 2], [c.armL, 3], [c.armR, 4]].forEach(([set, k]) => { for (const key in set) if (set[key] && set[key].isObject3D) limbOf.set(set[key], k); });
    const pivot = { 1: c.hipL, 2: c.hipR, 3: c.shL, 4: c.shR }, pv = {};
    for (const k in pivot) { const w = new V3(); pivot[k].getWorldPosition(w); pv[k] = w.applyMatrix4(inv).y; }
    const parts = [];
    c.root.traverse((o) => {
      if (!o.isMesh || !(o.material === bodyMat[THREE.FrontSide] || o.material === bodyMat[THREE.DoubleSide])) return;
      if (low) { o.geometry.computeBoundingSphere(); if (o.geometry.boundingSphere.radius < 0.035) return; }   // the tiny bits go
      let j = o, k = 0; while (j && !k) { k = limbOf.get(j) || 0; j = j.parent; if (j === c.root) break; }
      parts.push([o, k]);
    });
    let nv = 0, ni = 0; for (const [o] of parts) { nv += o.geometry.attributes.position.count; ni += o.geometry.index.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), limb = new Float32Array(nv), piv = new Float32Array(nv), idx = new Uint32Array(ni);
    let v0 = 0, i0 = 0;
    for (const [o, k] of parts) {
      const g = o.geometry, P0 = g.attributes.position, N0 = g.attributes.normal, C0 = g.attributes.color;
      _m4.multiplyMatrices(inv, o.matrixWorld); _n3.getNormalMatrix(_m4);
      for (let i = 0; i < P0.count; i++) { _pv.fromBufferAttribute(P0, i).applyMatrix4(_m4); pos.set([_pv.x, _pv.y, _pv.z], (v0 + i) * 3); _pv.fromBufferAttribute(N0, i).applyMatrix3(_n3).normalize(); nor.set([_pv.x, _pv.y, _pv.z], (v0 + i) * 3); col.set([C0.getX(i), C0.getY(i), C0.getZ(i)], (v0 + i) * 3); limb[v0 + i] = k; piv[v0 + i] = k ? pv[k] : 0; }
      for (let i = 0; i < g.index.count; i++) idx[i0 + i] = g.index.getX(i) + v0;
      i0 += g.index.count; v0 += P0.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('limb', new THREE.BufferAttribute(limb, 1)); geo.setAttribute('pivY', new THREE.BufferAttribute(piv, 1)); geo.setIndex(new THREE.BufferAttribute(nv < 65536 ? new Uint16Array(idx) : idx, 1));
    return geo;
  }
  // beyond 70 m: a dozen boxes in the outfit's colours (≈110 triangles instead of thousands)
  function lowBody(m) {
    const c = m.ch, k = m.kit; c.root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(c.root.matrixWorld).invert(), Y = (o) => { const w = new V3(); o.getWorldPosition(w); return w.applyMatrix4(inv); };
    const hip = Y(c.hipL), sh = Y(c.shL), head = Y(c.head), hipY = hip.y, shY = sh.y, hx = Math.abs(hip.x), sx = Math.abs(sh.x);
    const parts = [], col = (h) => new THREE.Color(h || '#777');
    const box = (w, h, d, x, y, z, color, limb, piv) => parts.push({ g: new THREE.BoxGeometry(w, h, d).translate(x, y, z), c: col(color), limb, piv });
    const legC = k.bottom === 'shorts' ? k.skin : k.pantsColor;
    for (const [sgn, L] of [[1, 1], [-1, 2]]) { box(0.15, hipY - 0.1, 0.17, sgn * hx, (hipY + 0.1) / 2, 0, legC, L, hipY); box(0.14, 0.09, 0.26, sgn * hx, 0.05, 0.03, k.shoeColor, L, hipY); }
    box(sx * 2 + 0.06, shY - hipY + 0.14, 0.25, 0, (shY + hipY) / 2 + 0.02, 0, k.topColor, 0, 0);
    for (const [sgn, L] of [[1, 3], [-1, 4]]) { box(0.1, 0.56, 0.11, sgn * (sx + 0.08), shY - 0.27, 0, k.top === 'tshirt' ? k.skin : k.topColor, L, shY); box(0.08, 0.1, 0.09, sgn * (sx + 0.08), shY - 0.6, 0, k.skin, L, shY); }
    box(0.19, 0.23, 0.21, 0, head.y + 0.1, 0, k.skin, 0, 0);
    if (k.headwear !== 'none') box(0.22, 0.08, 0.23, 0, head.y + 0.24, 0, k.hatColor, 0, 0); else if (k.hair !== 'none') box(0.2, 0.06, 0.22, 0, head.y + 0.23, -0.01, k.hairColor, 0, 0);
    let nv = 0, ni = 0; for (const p of parts) { nv += p.g.attributes.position.count; ni += p.g.index.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), cl = new Float32Array(nv * 3), limb = new Float32Array(nv), piv = new Float32Array(nv), idx = new Uint16Array(ni);
    let v0 = 0, i0 = 0;
    for (const p of parts) { const P0 = p.g.attributes.position, N0 = p.g.attributes.normal; for (let i = 0; i < P0.count; i++) { pos.set([P0.getX(i), P0.getY(i), P0.getZ(i)], (v0 + i) * 3); nor.set([N0.getX(i), N0.getY(i), N0.getZ(i)], (v0 + i) * 3); cl.set([p.c.r, p.c.g, p.c.b], (v0 + i) * 3); limb[v0 + i] = p.limb; piv[v0 + i] = p.piv; } for (let i = 0; i < p.g.index.count; i++) idx[i0 + i] = p.g.index.getX(i) + v0; v0 += P0.count; i0 += p.g.index.count; p.g.dispose(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(cl, 3)); geo.setAttribute('limb', new THREE.BufferAttribute(limb, 1)); geo.setAttribute('pivY', new THREE.BufferAttribute(piv, 1)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
    return geo;
  }
  // walking, in the vertex shader: legs and arms swing about hip and shoulder, the body bobs
  const crowdMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, side: THREE.DoubleSide });
  crowdMat.onBeforeCompile = (sh) => {
    // at night the city's light on them: a little of their own colour, so a street full of people reads as one
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += vColor.rgb * ${MAP.id === 'seoul' ? '0.28' : '0.0'};`);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float limb; attribute float pivY; attribute float iPhase; attribute float iGait;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        if (limb > 0.5) { float side = (limb < 1.5 || limb > 3.5) ? 0.0 : 3.14159; float a = sin(iPhase + side) * (limb < 2.5 ? 0.5 : 0.36) * iGait, c = cos(a), s = sin(a);
          float py = transformed.y - pivY, pz = transformed.z; transformed.y = pivY + py * c - pz * s; transformed.z = py * s + pz * c; }
        transformed.y += abs(sin(iPhase)) * 0.03 * iGait;`);
  };
  const VAR = [];   // { kit, mid, low } — the instanced meshes, filled every frame
  function makeVariant(k) {
    const kit = outfit(), m = makeModel(kit), tmp = { m, x: 0, y: 0, z: 0, yaw: -Math.PI, vx: 0, vz: 0, gaitW: 0, phase: 0, seed: 0 };
    pose(tmp, 1 / 60);
    const mk = (geo, cap) => {
      geo.setAttribute('iPhase', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1)); geo.setAttribute('iGait', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1));
      const im = new THREE.InstancedMesh(geo, crowdMat, cap); im.count = 0; im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true; scene.add(im); return im;
    };
    const cap = Math.ceil((WALKERS + N) / K * 2.2) + 8;
    VAR[k] = { kit, mid: mk(crowdGeo(m, true), cap), low: mk(lowBody(m), cap) };
    scene.remove(m.ch.root);
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
    if (v.talkT > 0 && v.panic <= 0) { v.talkT -= dt; v.vx = v.vz = 0; v.yaw += wrap(Math.atan2(-(P.pos.x - v.x), -(P.pos.z - v.z)) - v.yaw) * Math.min(1, dt * 6); return; }
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
    if (VAR.length < K) { makeVariant(VAR.length); return; }   // the outfits first, one a frame
    if (civs.length < N) {   // build the crowd a model per frame (no hitch)
      const vk = civs.length % K, v = { m: makeModel({ ...VAR[vk].kit }), vk, k: civs.length, seed: Math.random() * 10, phase: Math.random() * 6, gaitW: 0, plaza: false, alive: false, deadT: 20, hits: [] };
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
      if (!v.alive) { v.inst = false; if (v.deadT < 20) { v.deadT += dt; const k = Math.min(1, v.deadT / 0.7); root.rotation.set(-k * k * Math.PI / 2 * 0.92, v.yaw + Math.PI, 0); } continue; }
      if (v.panic > 0) v.panic -= dt;
      step(v, dt);
      const near = d2(v.x, v.z) < NEAR_POSE * NEAR_POSE;
      if (near) pose(v, dt); else { root.position.set(v.x, v.y, v.z); root.rotation.set(0, v.yaw + Math.PI, 0); }
      root.visible = near; v.inst = !near;
    }
    crowdTick(dt);
    if (scan <= 0) scan = 0.3;
    staffTick(dt); bubbleTick(dt);
    // scripted figures (mission targets, couriers): follow their route, posed out to scope range
    for (const v of figs) {
      const root = v.m.ch.root;
      if (!v.alive) { if (v.deadT < 90) { v.deadT += dt; const k = Math.min(1, v.deadT / 0.7); root.rotation.set(-k * k * Math.PI / 2 * 0.92, v.yaw + Math.PI, 0); } continue; }
      if (v.fig.paused) { v.vx = v.vz = 0; } else step(v, dt);
      if (v.fig.lookAt) { const L = v.fig.lookAt; v.yaw += wrap(Math.atan2(-(L.x - v.x), -(L.z - v.z)) - v.yaw) * Math.min(1, dt * 4); }
      if (d2(v.x, v.z) < 220 * 220) pose(v, dt); else { root.position.set(v.x, v.y, v.z); root.rotation.set(0, v.yaw + Math.PI, 0); }
    }
  }
  // ---------------- talking (E) ----------------
  const SEOUL = MAP.id === 'seoul';
  const LINES = SEOUL ? {
    chat: [['안녕하세요?', 'Hi there.'], ['비가 계속 오네요.', 'It just keeps raining.'], ['지하철역은 저쪽이에요.', 'The subway is that way.'], ['편의점 라면 드셔 보세요. 진짜 맛있어요.', 'Try the konbini ramen. It’s really good.'], ['죄송해요, 지금 바빠서요.', 'Sorry, I’m in a hurry.'], ['강남 가시려면 2호선 타세요.', 'For Gangnam, take Line 2.'], ['요즘 이 동네 깡패들 조심하세요.', 'Watch out for the gangs round here lately.'], ['외국인이세요? 한국 처음이에요?', 'Not from here? First time in Korea?'], ['저기 포장마차 떡볶이 최고예요.', 'The tteokbokki at that tent is the best.'], ['한강 가면 야경 진짜 예뻐요.', 'The river’s beautiful at night.'], ['네? 뭐라고요?', 'Huh? Say again?'], ['우산 없어요? 감기 걸려요.', 'No umbrella? You’ll catch a cold.']],
    scared: [['으악! 총이다!', 'He’s got a gun!'], ['살려주세요!', 'Help!'], ['경찰 불러요!', 'Call the police!']],
    shop: [['어서오세요!', 'Welcome!'], ['1+1 행사 중이에요.', 'Buy one, get one free tonight.'], ['봉투 필요하세요?', 'Need a bag?'], ['카드 되세요.', 'We take cards.']],
    food: [['몇 분이세요?', 'Table for how many?'], ['삼겹살 2인분 드릴까요?', 'Pork belly for two?'], ['여기 앉으세요!', 'Sit anywhere!'], ['소주 한 병 더요?', 'Another bottle of soju?']],
    bar: [['생맥주 한 잔?', 'A draught beer?'], ['치킨 금방 나와요.', 'The chicken’s nearly done.'], ['오늘 축구 보세요?', 'Watching the match tonight?']],
    room: [['몇 시간 하실 거예요?', 'How many hours?'], ['3번 방으로 가세요.', 'Room three, go on in.'], ['음료수는 서비스예요.', 'Drinks are on the house.']],
    guest: [['조용히 좀 해 주세요.', 'Keep it down, please.'], ['아, 깜짝이야!', 'Oh, you startled me!'], ['한 판만 더 하고 갈게.', 'One more round and I’m off.'], ['여기 자주 와요?', 'Come here often?']],
    home: [['누구세요?!', 'Who are you?!'], ['나가세요! 경찰 부를 거예요!', 'Get out! I’ll call the police!']],
    snack: ['삼각김밥', '컵라면', '바나나우유', '호빵', '에너지 드링크'],
  } : {
    chat: [['Salam alikoum.', 'Peace be upon you.'], ['Labas? Kulchi mzyan?', 'All good?'], ['Le souk, c’est par là.', 'The souk is that way.'], ['Attention aux soldats près du palais.', 'Careful of the soldiers by the palace.'], ['Un thé à la menthe?', 'Mint tea?'], ['Smeh liya, ana mzroub.', 'Sorry, I’m in a hurry.'], ['Le port est en bas.', 'The harbour is down there.'], ['Il fait chaud aujourd’hui.', 'Hot today.']],
    scared: [['Aaah! Il est armé!', 'He’s armed!'], ['Aawnou! Aawnou!', 'Help! Help!']],
    shop: [['Marhba bik!', 'Welcome!'], ['Bon prix pour toi.', 'Good price for you.']], food: [['Tajine, couscous?', 'Tagine? Couscous?']], bar: [['Un café?', 'Coffee?']], room: [['Marhba.', 'Welcome.']], guest: [['Salam.', 'Hello.']], home: [['Chkoun?!', 'Who’s there?!']],
    snack: ['msemen', 'thé à la menthe', 'pain au chocolat'],
  };
  const bubble = document.createElement('div');
  bubble.style.cssText = 'position:absolute;transform:translate(-50%,-100%);max-width:260px;padding:7px 11px;border-radius:10px;background:rgba(14,16,22,.82);border:1px solid rgba(255,255,255,.18);color:#fff;font:600 14px/1.3 system-ui,"Malgun Gothic","Noto Sans KR",sans-serif;text-align:center;pointer-events:none;display:none;white-space:normal';
  let talker = null, talkT = 0, snackT = -99, bubbleOn = false;
  const _hp = new V3();
  function say(v, [ko, en]) {
    if (!bubbleOn) { document.getElementById('hud').appendChild(bubble); bubbleOn = true; }
    bubble.innerHTML = `${ko}<br><span style="font-weight:400;font-size:12px;opacity:.75">${en}</span>`;
    talker = v; talkT = 4.5;
  }
  function bubbleTick(dt) {
    if (!talker || (talkT -= dt) <= 0 || !talker.alive) { bubble.style.display = 'none'; talker = null; return; }
    _hp.set(talker.x, talker.y + 2.05, talker.z).project(camera);
    if (_hp.z > 1 || Math.hypot(talker.x - P.pos.x, talker.z - P.pos.z) > 12) { bubble.style.display = 'none'; return; }
    bubble.style.display = 'block'; bubble.style.left = `${(_hp.x * 0.5 + 0.5) * innerWidth}px`; bubble.style.top = `${(-_hp.y * 0.5 + 0.5) * innerHeight}px`;
  }
  // the person in front of you (within reach), civilian or shop staff
  function facing() {
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); let best = null, bd = 2.6;
    for (const v of [...civs, ...figs]) {
      if (!v.alive || (v.fig && !v.fig.staff)) continue;
      const dx = v.x - P.pos.x, dz = v.z - P.pos.z, d = Math.hypot(dx, dz);
      if (d < bd && (dx * fx + dz * fz) / (d || 1) > 0.25 && Math.abs(v.y - P.pos.y) < 1.3) { bd = d; best = v; }
    }
    return best;
  }
  function talk() {
    const v = facing(); if (!v) return false;
    const armed = !P.holstered && P.disguise !== 'militia';
    if (v.fig) {
      const role = v.fig.role || 'shop';
      if (role === 'home') { say(v, pick(LINES.home)); return true; }
      if ((role === 'shop' || role === 'food') && clock - snackT > 15 && P.hp < 100) {
        snackT = clock; const item = pick(LINES.snack); P.hp = Math.min(100, P.hp + 30);
        say(v, SEOUL ? [`${item} 여기요. 맛있게 드세요!`, `Here’s your ${item}. Enjoy!`] : [`Tfeddal, ${item}.`, `Here you go: ${item}.`]); feed(`<span class="s">${item.toUpperCase()} · +30 HP</span>`); audio.pouch(); return true;
      }
      say(v, pick(LINES[role] || LINES.shop)); return true;
    }
    if (armed) { say(v, pick(LINES.scared)); v.panic = rand(6, 9); v.idle = 0; v.talkT = 0; return true; }
    say(v, pick(LINES.chat)); v.talkT = 4.5; v.idle = 0; return true;
  }
  const promptTalk = () => { const v = facing(); return v ? (v.fig ? '[E]  TALK' + ((v.fig.role === 'shop' || v.fig.role === 'food') && P.hp < 100 ? ' · BUY A SNACK' : '') : '[E]  TALK') : ''; };
  // ---------------- shop staff: real people behind the counters near you (spots registered by the map) ----------------
  const STAFF_R = 32, STAFF_MAX = 26, UNIFORM = { shop: ['#2a8a4a', 'cap'], food: ['#1a1a1a', 'none'], bar: ['#6a1a1a', 'none'], room: ['#3a2a6a', 'none'], cafe: ['#4a3424', 'none'], guest: [null, 'none'], home: ['#8a8a9a', 'none'] };
  let staffClock = 0;
  function staffTick(dt) {
    if ((staffClock -= dt) > 0 || !TOWN.staff) return; staffClock = 0.5;
    let live = 0; for (const s2 of TOWN.staff) if (s2.v) live++;
    for (const s2 of TOWN.staff) {
      const d = Math.hypot(s2.x - P.pos.x, s2.z - P.pos.z) + Math.abs((s2.y || 0) - P.pos.y) * 4;
      if (s2.v && (d > STAFF_R + 14 || !s2.v.alive && s2.v.deadT > 30)) { removeFigure(s2.v); s2.v = null; live--; continue; }
      if (!s2.v && d < STAFF_R && live < STAFF_MAX && !s2.dead) {
        const [col, hat] = UNIFORM[s2.role] || UNIFORM.shop, kit = outfit();
        if (col) Object.assign(kit, { top: 'tshirt', topColor: col, headwear: hat, hatColor: col, vest: s2.role === 'food' ? 'none' : kit.vest });
        const home = { x: s2.x - Math.sin(s2.yaw) * 3, z: s2.z - Math.cos(s2.yaw) * 3 };
        s2.v = spawnFigure({ kit, route: s2.route || [[s2.x, s2.z]], loop: !!s2.route, speed: s2.route ? 0.9 : 0, yaw: s2.yaw, y: s2.y, staff: true, role: s2.role === 'cafe' ? 'shop' : s2.role, home, onDeath: () => { s2.dead = true; P.stats.score -= 100; feed('<span class="m">CIVILIAN DOWN −100</span>'); alarm(s2.x, s2.z); } });
        s2.v.fig.lookAt = s2.route ? null : home; live++;
      }
      if (s2.v && s2.v.alive && !s2.route) s2.v.fig.lookAt = d < 5 ? P.pos : s2.v.fig.home;
    }
  }
  // ---------------- walkers: the rest of the crowd — street-following, no collision, drawn instanced ----------------
  const walkers = [];
  let frameN = 0;
  const _mx = new THREE.Matrix4(), _q2 = new THREE.Quaternion(), _sc = new V3(1, 1, 1), _ps = new V3(), _fw = new V3();
  const RMAX = () => Math.min(300, (MAP.drawDist || 300) + 20);
  // streets by length, the main roads (with their wide pavements) counting extra
  let streetW = null;
  function pickStreet() {
    if (!streetW) { let acc = 0; streetW = STREETS.filter((st) => st.len >= 12).map((st) => [st, acc += st.len * (st.road > 0 ? 2.5 : 1)]); }
    const r = Math.random() * streetW[streetW.length - 1][1]; for (const [st, a] of streetW) if (a >= r) return st; return null;
  }
  function placeWalker(w, minD, maxD) {
    if (Math.random() < 0.6) maxD = Math.min(maxD, Math.max(minD + 30, 110));   // most of the crowd stays within a block or two of you
    // a quarter of them mill about the squares instead of walking the streets
    if (Math.random() < 0.28) {
      const pl = TOWN.plazas.filter((r) => CIVIL.includes(r.name) && plazaDist(r) < maxD && (r.x1 - r.x0) * (r.z1 - r.z0) > 200);
      if (pl.length) {
        const Q = pl[(Math.random() * pl.length) | 0];
        for (let t = 0; t < 12; t++) {
          const x = rand(Q.x0 + 1.5, Q.x1 - 1.5), z = rand(Q.z0 + 1.5, Q.z1 - 1.5), d = Math.hypot(x - P.pos.x, z - P.pos.z), g = GR.get(x, z);
          if (d < minD || d > maxD || g === GR.BUILT || g === GR.WALL || terrainH(x, z) > 0.5) continue;
          w.plaza = Q; w.x = x; w.z = z; w.y = COL.ground(x, z, 0.4); w.yaw = Math.random() * 6.28; w.idle = rand(0, 4); w.panic = 0; w.speed = rand(0.8, 1.2); newPlazaGoal(w);
          return true;
        }
      }
    }
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    for (let t = 0; t < 40; t++) {
      const st = pickStreet(); if (!st) continue;
      const i = (Math.random() * (st.pts.length - 1)) | 0, f = Math.random(), a = st.pts[i], b = st.pts[i + 1];
      onStreet(w, st, i, Math.random() < 0.5 ? 1 : -1);
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1, sgn = w.off * w.dir;
      const x = a[0] + dx * f - dz / L * sgn, z = a[1] + dz * f + dx / L * sgn, d = Math.hypot(x - P.pos.x, z - P.pos.z);
      if (d < minD || d > maxD || terrainH(x, z) > 0.5 || GR.get(x, z) === GR.WALL) continue;
      if (d < 110 && ((x - P.pos.x) * fx + (z - P.pos.z) * fz) / d > 0.2 && Math.random() < 0.85) continue;   // not right in front of you
      w.x = x; w.z = z; w.y = COL.ground(x, z, 0.4); w.yaw = Math.random() * 6.28; w.idle = 0; w.panic = 0; w.plaza = false; w.speed = rand(1.0, 1.45);
      return true;
    }
    return false;
  }
  function walk(w, dt) {
    if (w.idle > 0 && w.panic <= 0) { w.idle -= dt; w.gait = Math.max(0, w.gait - dt * 3); return; }
    if (w.panic > 0) w.panic -= dt;
    let tx, tz; if (w.plaza) { tx = w.tx; tz = w.tz; } else { const q = target(w); tx = q.x; tz = q.z; }
    let dx = tx - w.x, dz = tz - w.z; const L = Math.hypot(dx, dz);
    if (L < 0.9) {
      if (w.plaza) { newPlazaGoal(w); if (Math.random() < 0.5) w.idle = rand(2, 6); }
      else { const j = w.i + w.dir; if (j <= 0 || j >= w.st.pts.length - 1) { w.i = clamp(j, 0, w.st.pts.length - 1); junction(w); } else w.i = j; }
      return;
    }
    const sp = w.panic > 0 ? w.speed * 3 : w.speed;
    dx /= L; dz /= L; w.x += dx * sp * dt; w.z += dz * sp * dt;
    w.yaw += wrap(Math.atan2(-dx, -dz) - w.yaw) * Math.min(1, dt * 5);
    w.phase += dt * sp * 5.9; w.gait = Math.min(1, w.gait + dt * 3);
    if ((w.yT -= dt) <= 0) { w.yT = 0.5; w.y = COL.ground(w.x, w.z, w.y + 0.5); }
  }
  // a walker coming into posing range trades places with a far-off civilian in the same outfit: nobody sees it
  const SWAP = ['x', 'y', 'z', 'yaw', 'st', 'i', 'dir', 'off', 'speed', 'phase', 'plaza', 'tx', 'tz', 'idle'];
  function swapIn(w) {
    for (const c of civs) {
      if (c.vk !== w.vk || !c.alive || !c.inst || c.panic > 0 || c.talkT > 0 || d2(c.x, c.z) < (NEAR_POSE + 10) ** 2) continue;
      for (const k of SWAP) { const t = c[k]; c[k] = w[k]; w[k] = t; }
      c.vx = c.vz = 0; c.stuckT = 0; c.gaitW = w.gait || 0; return true;
    }
    return false;
  }
  function crowdTick(dt) {
    if (VAR.length < K) return;
    while (walkers.length < WALKERS) { const w = { vk: walkers.length % K, phase: Math.random() * 6, gait: 0, yT: Math.random(), panic: 0, idle: 0 }; if (!placeWalker(w, 30, RMAX())) break; walkers.push(w); }
    frameN++;
    const R2 = RMAX() ** 2;
    for (let n = 0; n < walkers.length; n++) {
      const w = walkers[n], dd = d2(w.x, w.z);
      if (dd > R2) { placeWalker(w, 70, RMAX()); continue; }
      if (dd > 120 * 120) { if ((n + frameN) % 3 === 0) walk(w, dt * 3); } else walk(w, dt);
      if (dd < (NEAR_POSE + 3) ** 2 && (n + frameN) % 4 === 0) swapIn(w);
    }
    // draw: everyone beyond posing range (and any walker that couldn't swap), by outfit, near or far body
    for (const V of VAR) { V.mid.count = 0; V.low.count = 0; }
    camera.getWorldDirection(_fw);
    const cx = camera.position.x, cz = camera.position.z, DD = (MAP.drawDist || 300) ** 2;
    const put = (p, gait) => {
      const dx = p.x - cx, dz = p.z - cz, dd = dx * dx + dz * dz;
      if (dd > DD || dx * _fw.x + dz * _fw.z < -6) return;
      const V = VAR[p.vk], im = dd < 55 * 55 ? V.mid : V.low, k = im.count; if (k >= im.instanceMatrix.count) return;
      _q2.setFromAxisAngle(UP, p.yaw + Math.PI); _mx.compose(_ps.set(p.x, p.y, p.z), _q2, _sc); im.setMatrixAt(k, _mx);
      im.geometry.attributes.iPhase.array[k] = p.phase; im.geometry.attributes.iGait.array[k] = gait; im.count = k + 1;
    };
    for (const w of walkers) put(w, w.gait);
    for (const c of civs) if (c.inst && c.alive) put(c, c.gaitW);
    for (const V of VAR) for (const im of [V.mid, V.low]) { im.instanceMatrix.needsUpdate = true; im.geometry.attributes.iPhase.needsUpdate = true; im.geometry.attributes.iGait.needsUpdate = true; }
  }
  function setHits(v, on) { for (const m of v.hits) { const i = hitList.indexOf(m); if (on && i < 0) hitList.push(m); else if (!on && i >= 0) hitList.splice(i, 1); } }
  // gunfire nearby: scatter away from the shooter
  function alarm(x, z) {
    if (clock - lastAlarm < 0.15) return; lastAlarm = clock;
    for (const w of walkers) { const d = Math.hypot(w.x - x, w.z - z); if (d < 60) { w.panic = rand(6, 10); w.idle = 0; if (!w.plaza) { const q = target(w); if ((q.x - w.x) * (w.x - x) + (q.z - w.z) * (w.z - z) < 0) w.dir = -w.dir; } } }
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
  return { update, alarm, conceal, hit, knockout, bodies, honk, bump, spawnFigure, removeFigure, talk, promptTalk, outfit: (over = {}) => ({ ...outfit(), ...over }), get figs() { return figs; }, canKnockout: (pos) => !!koTarget(pos), get civs() { return civs; }, get walkers() { return walkers; }, get VAR() { return VAR; } };
})();
