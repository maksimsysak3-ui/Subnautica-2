// =====================================================================
//  NEON SEOUL — the wider city round Mapo: arterials, Gangnam's towers, the apartment wall,
//  the covered market, and the Han River park with its bridges
// =====================================================================
// The old 300 × 270 m core stays as it was. Around it, 500 × 600 m in all: Sinchon-ro and
// Gangnam-daero run north–south either side, a market quarter fills the north, a row of apartment
// slabs the west, glass towers and their giant screens the east, and the river closes off the south.
const DIST = {
  ahyeon: { x0: -222, z0: 13, x1: -185, z1: 36 },
  gangnam: { x0: 185, z0: 13, x1: 222, z1: 36 },
  market: { x0: 30, z0: -206, x1: 62, z1: -166 },
  park: { x0: -250, z0: 161, x1: 250, z1: 230 },
  apts: [{ x0: -248, z0: -326, x1: -182, z1: -162 }, { x0: -248, z0: -140, x1: -182, z1: -30 }, { x0: -248, z0: 38, x1: -182, z1: 140 }],
  RIVER: 232,
};
const ROADS = [];

// ---------------- roads: laid together, so each knows where the others cross it ----------------
function seoulRoads() {
  const R = (name, pts, w, road, walk) => { const st = addStreet(pts, w, 'road', { raw: true, road, walk }); TOWN.lanes[name] = st; ROADS.push(st); return st; };
  R('yanghwa', [[-250, 0], [250, 0]], 24, 15, 4.5);
  R('sinchon', [[-165, -330], [-165, 150]], 24, 15, 4.5);
  R('gangnamDaero', [[165, -330], [165, 150]], 24, 15, 4.5);
  R('northRd', [[-250, -150], [250, -150]], 20, 12, 4);
  R('southRd', [[-250, 150], [250, 150]], 20, 12, 4);
  R('bridgeRd', [[-60, 160], [-60, DIST.RIVER - 2]], 18, 12, 3);
  for (const st of ROADS) roadway(st, { asphalt: 0x2a2b2e, pave: 0x8a8680 });
  // zebra crossings on every approach of every junction, and the lights at its corners
  for (const a of ROADS) for (const b of ROADS) {
    if (a === b || a.pts[0][1] !== a.pts[1][1] || b.pts[0][0] !== b.pts[1][0]) continue;   // a runs along x, b along z
    const z = a.pts[0][1], x = b.pts[0][0];
    if (x < Math.min(a.pts[0][0], a.pts[1][0]) || x > Math.max(a.pts[0][0], a.pts[1][0]) || z < Math.min(b.pts[0][1], b.pts[1][1]) - 1 || z > Math.max(b.pts[0][1], b.pts[1][1]) + 1) continue;
    for (const s of [-1, 1]) {
      const zx = x + s * (b.w / 2 + 1.6), zz = z + s * (a.w / 2 + 1.6);
      for (let k = -a.road / 2 + 0.6; k < a.road / 2; k += 1.2) W.box(3, 0.012, 0.6, zx, 0.04, z + k, 0xe8e8e0, { ao: false, t: TX.none });
      if (Math.max(b.pts[0][1], b.pts[1][1]) > zz && Math.min(b.pts[0][1], b.pts[1][1]) < zz) for (let k = -b.road / 2 + 0.6; k < b.road / 2; k += 1.2) W.box(0.6, 0.012, 3, x + k, 0.04, zz, 0xe8e8e0, { ao: false, t: TX.none });
      trafficLight(x + s * (b.road / 2 + 1.4), 0.16, z + s * (a.road / 2 + 1.4), s > 0 ? Math.PI : 0);
    }
  }
}
// lamps, ginkgos, the median rail and the traffic along one road, broken wherever another road crosses
function boulevard(st) {
  const rw = st.road / 2, crossed = (x, z) => { const id = GR.roadAt(x, z); return id && id !== st.id; };
  const clear = (p, r) => !crossed(p.x - p.tz * r, p.z + p.tx * r) && !crossed(p.x, p.z) && !crossed(p.x + p.tx * 6, p.z + p.tz * 6) && !crossed(p.x - p.tx * 6, p.z - p.tz * 6);
  for (let s = 8; s < st.len - 6; s += 22) {
    const p = pathAt(st.pts, s), ry = Math.atan2(-p.tz, p.tx);
    for (const side of [-1, 1]) {
      if (!clear(p, side * (rw + 2))) continue;
      const nx = -p.tz * side, nz = p.tx * side;
      streetLampModern(p.x + nx * (rw + 2.7), 0.16, p.z + nz * (rw + 2.7), ry + (side > 0 ? Math.PI : 0), 9);
      W.lamp(p.x + nx * (rw + 0.9), 8.8, p.z + nz * (rw + 0.9), 0xffc888, 3.0, 16, { halo: 0.8 }); NEON.pool(p.x + nx * (rw + 0.9), p.z + nz * (rw + 0.9), 5, 0xffc888, 0.32);
      if (st.walk >= 4 && clear(pathAt(st.pts, Math.min(st.len - 4, s + 11)), side * (rw + 2))) { const q = pathAt(st.pts, Math.min(st.len - 4, s + 11)); ginkgo(q.x + nx * (rw + 3.1), q.z + nz * (rw + 3.1)); }
    }
  }
  // the median rail down the middle of the wide roads
  if (st.road >= 15) W.scope({ lod: 1 }, () => {
    for (let s = 2; s < st.len - 2; s += 2) { const p = pathAt(st.pts, s); if (!clear(p, 0) || crossed(p.x + p.tx * 12, p.z + p.tz * 12) || crossed(p.x - p.tx * 12, p.z - p.tz * 12)) continue; const ry = Math.atan2(-p.tz, p.tx); W.push(p.x, 0, p.z, ry); W.box(0.06, 0.9, 0.06, 0, 0.45, 0, 0xe8e8e0, { layer: 'metal' }); W.box(2, 0.06, 0.04, 1, 0.85, 0, 0xe8e8e0, { layer: 'metal' }); W.box(2, 0.12, 0.03, 1, 0.6, 0, 0xe8c020, { layer: 'metal' }); W.pop(); }
  });
  // traffic: taxis (lit roof signs), buses, cars, each streamed in with its stretch of road
  const lanes = st.road >= 15 ? [-5.4, -1.8, 1.8, 5.4] : [-3, 3];
  for (let s = 10; s < st.len - 10; s += mr(16, 30)) {
    const p = pathAt(st.pts, s), off = mpick(lanes); if (crossed(p.x, p.z) || crossed(p.x - p.tz * off, p.z + p.tx * off)) continue;
    const x = p.x - p.tz * off, z = p.z + p.tx * off, ry = Math.atan2(-p.tz, p.tx) + (off > 0 ? Math.PI : 0), bus2 = mchance(0.2), c = mpick([0xe87a2a, 0xc8c4bc, 0x2a2c30, 0xe8e6e0, 0xe87a2a, 0x8a8e94]), taxi = c === 0xe87a2a || mchance(0.12);
    W.defer(() => {
      if (bus2) { bus(x, z, ry, mpick([0x3a9a5a, 0x2a6ab0])); return; }
      sedan(x, z, ry, c);
      if (taxi) { W.push(x, 0, z, ry); W.box(0.5, 0.16, 0.26, -0.1, 1.46, 0, 0xffd040, { layer: 'glow' }); W.box(0.52, 0.04, 0.28, -0.1, 1.38, 0, 0x2a2a2a); W.pop(); }
    }, 'mid', [x, z]);
  }
}

// ---------------- the lanes of the new quarters ----------------
function seoulOuterLanes() {
  const asphalt = { tx: TX.asphalt, col: 0x323335 };
  lane('marketArcade', [[0, -160], [0, -328]], 8, 'alley', { tx: TX.concrete, col: 0x5a5856 });
  lane('mktCross', [[-153, -215], [153, -215]], 6.5, 'alley', asphalt);
  lane('mktCross2', [[-153, -285], [153, -285]], 6, 'alley', asphalt);
  lane('nLaneW', [[-90, -160], [-90, -328]], 6, 'alley', asphalt);
  lane('nLaneE', [[90, -160], [90, -328]], 6, 'alley', asphalt);
  lane('towerBackN', [[212, -12], [212, -328]], 7, 'alley', asphalt);
  lane('towerBackS', [[212, 12], [212, 140]], 7, 'alley', asphalt);
}
function seoulReserves() {
  for (const r of [DIST.ahyeon, DIST.gangnam, DIST.market]) plaza(r === DIST.ahyeon ? 'Ahyeon plaza' : r === DIST.gangnam ? 'Gangnam plaza' : 'Market plaza', r, 0x8a8680, TX.paving);
  const P = DIST.park;   // the lawn, in two halves either side of the bridge road
  plaza('Hangang park', { ...P, x1: -70 }, 0x2e3a26, TX.leaf); plaza('Hangang park', { ...P, x0: -50 }, 0x2e3a26, TX.leaf);
  for (const r of DIST.apts) reserve(r);
  // the river and everything past it
  GR.rect(0, (DIST.RIVER + 400) / 2, 1900, 400 - DIST.RIVER, 0, GR.WALL, true);
  for (const r of [{ x0: -280, z0: -360, x1: -250, z1: 280 }, { x0: 250, z0: -360, x1: 280, z1: 280 }, { x0: -280, z0: -360, x1: 280, z1: -330 }]) GR.rect((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, r.x1 - r.x0, r.z1 - r.z0, 0, GR.WALL, true);
}
function seoulOuterFronts() {
  const T = TOWN.lanes, U = { unit: seoulUnit };
  const F = (n, side, fill, o = {}) => front(T[n], side, '', { ...U, d: 13, fill, ...o });
  const TOWERS = '20/18/o 16/12/o 24/24/o 14/9/n 18/15/o 22/20/o 12/7/b 18/26/o';
  // Gangnam: the towers line both arterials' east side and Yanghwa-ro past the crossing
  F('gangnamDaero', -1, TOWERS, { d: 22 });
  F('yanghwa', -1, '-427 ' + TOWERS, { d: 22 }); F('yanghwa', 1, '-427 ' + TOWERS, { d: 22 });
  F('towerBackN', 1, '8/5/n 7/4/b 9/6/r 7/3/b 8/5/n 9/7/m', { d: 14 }); F('towerBackS', -1, '8/5/n 7/4/b 9/6/r 8/5/b 9/7/m', { d: 14 });
  // the west: a strip of shops along Yanghwa-ro under the apartments
  F('yanghwa', -1, '10/4/k 9/3/r 8/4/p 10/3/c 9/4/n 12/5/p', { d: 12, end: 427 }); F('yanghwa', 1, '9/3/r 10/4/c 8/3/p 9/5/n 10/4/b', { d: 12, end: 427 });
  // the north: the market quarter
  F('marketArcade', 1, '6/2/r 5/2/p 6/3/r 5/2/r 7/3/p 5/2/c', { d: 9 }); F('marketArcade', -1, '5/2/p 6/2/r 6/3/p 5/2/r 7/2/r 6/3/b', { d: 9 });
  F('mktCross', 1, '7/3/r 8/4/v 7/4/p 9/5/v 6/3/b', { d: 11 }); F('mktCross', -1, '8/4/v 7/3/r 9/5/v 7/4/n 8/3/p', { d: 11 });
  F('mktCross2', 1, '8/4/v 7/4/v 9/5/v 6/3/p 8/4/v', { d: 11 }); F('mktCross2', -1, '7/4/v 9/4/v 8/5/v 7/3/k', { d: 11 });
  for (const n of ['nLaneW', 'nLaneE']) { F(n, 1, '8/4/v 7/4/v 6/3/p 9/5/v 7/3/r', { d: 11 }); F(n, -1, '7/4/v 9/4/v 7/3/k 8/5/v 6/3/c', { d: 11 }); }
  F('northRd', -1, '10/6/r 9/5/n 11/7/o 8/4/p 10/8/m 9/5/b 12/9/o', { d: 14 }); F('northRd', 1, '9/5/n 10/6/r 8/4/b 11/6/p 10/7/n', { d: 13 });
  F('southRd', -1, '9/5/r 10/6/n 8/4/c 11/7/m 9/4/p', { d: 13 });
}

// ---------------- the apartment wall: numbered slabs, lit balconies, the brand on the roof ----------------
function aptSlab(cx, cz, len, F, num, brand) {
  const FL = 2.8, G = 3.4, H = G + F * FL, D = 12, col = mpick([0xe8e4dc, 0xd8d4cc, 0xe0dcd0, 0xd0ccc0]);
  W.push(cx, 0, cz, Math.PI / 2);   // balconies (local +z) face east, over the city
  W.box(len, H - G, D, 0, (H + G) / 2, 0, col, { t: TX.concrete, wear: 2 }); W.solid(len, H - G, D, 0, (H + G) / 2, 0, 'concrete');
  W.box(len - 2, G, D - 3, 0, G / 2, 0, shade(col, 0.75), { t: TX.concrete }); W.solid(len - 2, G, D - 3, 0, G / 2, 0, 'concrete');
  for (const x of [-len / 2 + 0.6, -len / 6, len / 6, len / 2 - 0.6]) { W.box(0.8, G, 0.8, x, G / 2, D / 2 - 0.5, col, { t: TX.concrete }); W.solid(0.8, G, 0.8, x, G / 2, D / 2 - 0.5, 'concrete'); }
  const units = Math.round(len / 4.6), uw = len / units;
  for (let f = 0; f < F; f++) {
    const y = G + f * FL;
    for (let i = 0; i < units; i++) { const lit = mchance(0.42), x = -len / 2 + (i + 0.5) * uw; W.box(uw - 0.5, 1.7, 0.04, x, y + 1.3, D / 2 + 0.02, lit ? mpick([0xd8c090, 0xc8b080, 0xe0d0b0, 0xa8b8c8, 0x8aa0c0]) : 0x12141a, { layer: lit ? 'glow' : 'pane' }); }
    W.box(len, 0.32, 0.25, 0, y + 0.16, D / 2 + 0.1, 0xf0f0ea, { t: TX.concrete });
    // the open corridor on the back, its strip lights mostly on
    const on = mchance(0.75); W.box(len, 0.9, 0.15, 0, y + 0.45, -D / 2 - 1.3, 0xe8e8e0); W.box(len, 0.06, 1.3, 0, y + 0.03, -D / 2 - 0.65, 0xc8c8c0);
    W.box(len - 1, 0.05, 0.08, 0, y + 2.6, -D / 2 - 0.4, on ? 0xe8f0ff : 0x2a2a2a, { layer: on ? 'glow' : 'metal' });
  }
  later(() => W.scope({ lod: 1 }, () => {
    for (let f = 0; f < F; f++) for (let i = 1; i < units; i++) W.box(0.12, 1.9, 0.12, -len / 2 + i * uw, G + f * FL + 1.3, D / 2 + 0.06, 0xf0f0ea);
    for (let f = 0; f < F; f += 2) if (mchance(0.5)) acWall(mr(-len / 2 + 2, len / 2 - 2), G + f * FL + 0.4, D / 2 + 0.1, 0);
  }));
  // gable ends: the block number big enough to read from the next block
  for (const s of [-1, 1]) { W.push(s * len / 2 + s * 0.02, 0, 0, s * Math.PI / 2); NEON.sign(`${num}동`, 0, H - 5, 0, 7, 2.6, { style: 'plate', col: '#e8e0d0', dim: 0.42 }); W.pop(); }
  // roof: parapet, lift house, the brand lit in white letters, red aviation lights
  W.push(0, 0, 0); lightParapet(len, D, H, 1.2, col, 'plain'); W.pop();
  W.box(6, 3.2, 5, len / 4, H + 1.6, 0, col, { t: TX.concrete }); W.box(6, 3.2, 5, -len / 4, H + 1.6, 0, col, { t: TX.concrete });
  NEON.sign(brand, 0, H + 2.4, D / 2 - 0.2, Math.min(14, len * 0.4), 2.0, { style: 'tube', col: 'white', pool: false, lamp: false });
  for (const s of [-1, 1]) W.sphere(0.3, 0.3, 0.3, s * (len / 2 - 0.5), H + 1.4, 0, 0xff2020, { layer: 'glow' });
  W.lamp(0, G - 0.3, D / 2 - 1.5, 0xe8f0ff, 1.6, 8, { halo: 0 }); W.box(3, 0.04, 1.2, 0, G - 0.05, D / 2 - 1.5, 0xf0f4ff, { layer: 'glow' });
  W.pop();
}
function seoulApartments() {
  const brands = ['한빛아파트', '푸른마을', '한빛아파트'];
  let num = 101;
  DIST.apts.forEach((r, k) => {
    const len = Math.min(44, (r.z1 - r.z0) / 2 - 8), n = Math.floor((r.z1 - r.z0) / (len + 10));
    groundPlate(r.x0, r.z0, r.x1, r.z1, 0x5a5854, TX.paving, 3, 0.035);
    for (let i = 0; i < n; i++) {
      const cz = r.z0 + (r.z1 - r.z0) * (i + 0.5) / n;
      aptSlab(-222, cz, len, 14 + ((k * 3 + i * 5) % 9), num++, brands[k]);
      // between the slabs: parking, a playground or a garden, trees, lamps
      const gz = cz + (r.z1 - r.z0) / n / 2;
      if (i < n - 1 || k === 1) W.defer(() => W.scope({ lod: 1 }, () => {
        if ((i + k) % 2 === 0) { for (let c = 0; c < 8; c++) sedan(-240 + c * 3.1, gz, Math.PI / 2, mpick([0xe8e6e0, 0x2a2c30, 0x8a8e94, 0x1a2a4a, 0xc8c4bc])); for (let c = 0; c < 9; c++) W.box(0.1, 0.012, 4.6, -241.6 + c * 3.1, 0.05, gz, 0xe8e8e0, { ao: false }); }
        else { W.box(14, 0.04, 6, -208, 0.05, gz, 0x7a3a2a, { t: TX.none }); for (const [dx, h] of [[-4, 2.2], [0, 2.8], [4, 2.0]]) { W.rod([-208 + dx, 0, gz - 1.5], [-208 + dx, h, gz - 1.5], 0.06, mpick([0xd8302a, 0x2a6ab0, 0xe8c020]), { layer: 'metal' }); W.rod([-208 + dx, 0, gz + 1.5], [-208 + dx, h, gz + 1.5], 0.06, mpick([0xd8302a, 0x2a6ab0, 0xe8c020]), { layer: 'metal' }); W.box(0.2, 0.2, 3.2, -208 + dx, h, gz, 0xe8c020, { layer: 'metal' }); } W.box(1.2, 0.08, 2.6, -204, 1.0, gz, 0x2a8a4a, { rx: 0.4 }); for (const s of [-1, 1]) bench(-198, 0, gz + s * 2, s > 0 ? Math.PI : 0); }
        for (const s of [-1, 1]) ginkgo(-190, gz + s * 6);
      }), 'mid', [-208, gz]);
      W.lamp(-196, 4.5, gz, 0xfff0d8, 1.8, 10, { halo: 0.6 }); NEON.pool(-196, gz, 3.4, 0xfff0d8, 0.3); W.cyl(0.08, 0.1, 4.6, -196, 2.3, gz, 0x3a3e42, { seg: 6, layer: 'metal' }); W.box(0.6, 0.2, 0.6, -196, 4.6, gz, 0x2a2a2a, { layer: 'metal' });
    }
    // the complex fence along the arterial, with the guard hut at its gate
    W.scope({ lod: 1 }, () => { for (let z = r.z0 + 1; z < r.z1 - 1; z += 2.5) { W.box(0.08, 1.6, 0.08, -179.5, 0.8, z, 0x2a3a2e, { layer: 'metal' }); W.box(0.04, 0.05, 2.5, -179.5, 1.5, z + 1.25, 0x2a3a2e, { layer: 'metal' }); W.box(0.04, 0.05, 2.5, -179.5, 0.3, z + 1.25, 0x2a3a2e, { layer: 'metal' }); } });
    W.solid(0.2, 1.6, r.z1 - r.z0 - 2, -179.5, 0.8, (r.z0 + r.z1) / 2, 'metal');
    W.box(2.4, 2.6, 2.4, -182, 1.3, r.z1 - 6, 0xd8d4c8, { t: TX.plaster }); W.box(1.6, 0.9, 0.04, -180.78, 1.6, r.z1 - 6, 0xd8c090, { layer: 'glow', ry: Math.PI / 2 }); W.box(2.8, 0.15, 2.8, -182, 2.65, r.z1 - 6, 0x3a3a3c);
  });
}

// ---------------- Gangnam: giant screens on the crossing ----------------
// Each screen is its own canvas, redrawn a few times a second: colour washes, a scrolling slogan, an ad that cuts every few seconds.
const SCREENS = [];
function ledScreen(x, y, z, ry, w, h, seed) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round(512 * h / w);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: true }));
  m.position.set(x, y, z); m.rotation.y = ry; m.updateMatrix(); m.matrixAutoUpdate = false; m.userData.lod = 0; m.geometry.computeBoundingSphere();
  scene.add(m);
  const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, h + 0.6, 0.5), new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.6 }));
  fr.position.set(x - Math.sin(ry) * 0.27, y, z - Math.cos(ry) * 0.27); fr.rotation.y = ry; fr.updateMatrix(); fr.matrixAutoUpdate = false; fr.userData.lod = 0; scene.add(fr);
  W.lamp(x + Math.sin(ry) * 4, y - h / 2, z + Math.cos(ry) * 4, 0x8a6aff, 3.5, 22, { halo: 0 });
  SCREENS.push({ cv, g: cv.getContext('2d'), tex, t: seed * 3.7, acc: 0, m });
}
const ADS = [['빛24', '#40ff7a', '오늘도 24시간'], ['SEOUL NIGHT', '#ff2a8a', '마포 불빛 축제'], ['신제품 출시', '#2af0ff', 'NEW PHONE 15'], ['한강 라면', '#ffd040', '편의점에서 만나요'], ['K-POP LIVE', '#b06aff', '토요일 8PM']];
// redraw the screens near the camera a few times a second
function seoulTick(dt, cam) {
  for (const s of SCREENS) { if (s.m.position.distanceToSquared(cam.position) > 160 * 160) continue; s.acc += dt; if (s.acc > 0.12) { s.t += s.acc; s.acc = 0; drawScreen(s); } }
}
function drawScreen(s) {
  const { g, cv } = s, W2 = cv.width, H2 = cv.height, t = s.t, ad = ADS[Math.floor(t / 5) % ADS.length], k = (t % 5) / 5;
  const hue = (t * 40) % 360, gr = g.createLinearGradient(0, 0, W2, H2);
  gr.addColorStop(0, `hsl(${hue},80%,${18 + 10 * Math.sin(t)}%)`); gr.addColorStop(1, `hsl(${(hue + 120) % 360},70%,12%)`);
  g.fillStyle = gr; g.fillRect(0, 0, W2, H2);
  for (let i = 0; i < 6; i++) { g.fillStyle = `hsla(${(hue + i * 50) % 360},90%,60%,0.25)`; const r = (Math.sin(t * 1.3 + i) * 0.5 + 0.5) * H2 * 0.6; g.beginPath(); g.arc(W2 * (i / 5), H2 * 0.5 + Math.sin(t + i * 2) * H2 * 0.3, r, 0, 7); g.fill(); }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = ad[1]; g.shadowBlur = 20; g.fillStyle = '#ffffff';
  g.font = `900 ${Math.round(H2 * 0.32)}px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif`;
  g.globalAlpha = Math.min(1, k * 6, (1 - k) * 6); g.fillText(ad[0], W2 / 2 + (1 - Math.min(1, k * 3)) * 80, H2 * 0.42);
  g.font = `700 ${Math.round(H2 * 0.13)}px "Malgun Gothic","Noto Sans KR",sans-serif`; g.fillStyle = ad[1]; g.fillText(ad[2], W2 / 2, H2 * 0.75); g.globalAlpha = 1; g.shadowBlur = 0;
  for (let y = 0; y < H2; y += 4) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y, W2, 1); }   // scanlines
  s.tex.needsUpdate = true;
}
function seoulGangnam() {
  const P = DIST.gangnam;
  // the crossing's screens: one on a mast over the plaza, two on the tower corners
  ledScreen(P.x1 - 4, 14, P.z0 + 2, -Math.PI * 0.75, 14, 8, 1);
  W.box(0.8, 10, 0.8, P.x1 - 2, 5, P.z0 + 4, 0x3a3e42, { layer: 'metal' }); W.solid(0.8, 10, 0.8, P.x1 - 2, 5, P.z0 + 4, 'metal');
  ledScreen(176.6, 22, -30, -Math.PI / 2, 10, 14, 2);
  ledScreen(192, 26, -11.6, 0, 22, 10, 3);
  // plaza: granite, benches round planters, a sculpture lit from below
  W.scope({ lod: 1 }, () => {
    for (let i = 0; i < 3; i++) { const x = P.x0 + 6 + i * 11, z = P.z1 - 6; W.box(4, 0.5, 4, x, 0.25, z, 0x6a6a68, { t: TX.stone }); W.solid(4, 0.5, 4, x, 0.25, z, 'stone'); ginkgo(x, z); }
    W.cyl(0.5, 1.4, 6, P.x0 + 12, 3, P.z0 + 10, 0xc8ccd0, { seg: 6, layer: 'metal', rx: 0.3 }); W.box(3, 0.4, 3, P.x0 + 12, 0.2, P.z0 + 10, 0x4a4a4c);
    for (let i = 0; i < 4; i++) bench(P.x0 + 4 + i * 8, 0, P.z0 + 18, 0);
  });
  W.lamp(P.x0 + 12, 0.6, P.z0 + 10, 0x7aa0ff, 2.5, 8, { halo: 0.5 });
}

// ---------------- the covered market ----------------
function seoulMarket() {
  const st = TOWN.lanes.marketArcade;
  // the arched polycarbonate roof on steel ribs, lights hanging in rows
  for (let s = 2; s < st.len - 2; s += 6) {
    const p = pathAt(st.pts, s);
    W.push(p.x, 0, p.z, Math.atan2(-p.tz, p.tx) + Math.PI / 2);   // local x across the lane
    for (let k = 0; k < 6; k++) { const a0 = Math.PI * k / 6, a1 = Math.PI * (k + 1) / 6, r = 5.2; const x0 = Math.cos(a0) * r, y0 = 6.2 + Math.sin(a0) * 2.4, x1 = Math.cos(a1) * r, y1 = 6.2 + Math.sin(a1) * 2.4; W.rod([x0, y0, 0], [x1, y1, 0], 0.08, 0x5a5e62, { layer: 'metal' }); W.box(Math.hypot(x1 - x0, y1 - y0) + 0.05, 0.03, 6, (x0 + x1) / 2, (y0 + y1) / 2, 3, 0xa8c0b8, { layer: 'glass', rz: Math.atan2(y1 - y0, x1 - x0) }); }
    for (const sx of [-1, 1]) W.rod([sx * 5.2, 0, 0], [sx * 5.2, 6.2, 0], 0.09, 0x5a5e62, { layer: 'metal' });
    for (const sx of [-2, 2]) { W.rod([sx, 7.9, 0], [sx, 5.2, 0], 0.006, 0x1a1a1a); W.sphere(0.32, 0.22, 0.32, sx, 5.1, 0, 0xfff0c8, { layer: 'glow', seg: 8, hseg: 4 }); }
    if (s % 12 < 6) W.lamp(0, 5.0, 0, 0xffe0b0, 2.4, 10, { halo: 0.5 });
    W.pop();
  }
  // the gate sign at each end
  for (const [s, ry] of [[1, 0], [st.len - 1, Math.PI]]) {
    const p = pathAt(st.pts, s);
    W.push(p.x, 0, p.z, Math.atan2(-p.tz, p.tx) + Math.PI / 2 + ry);
    W.box(11, 1.6, 0.4, 0, 8.6, 0, 0x7a1a1a, { layer: 'metal' });
    NEON.sign('남대문시장', 0, 8.6, 0.21, 9.4, 1.3, { style: 'box', col: 'red', back: true });
    W.pop();
  }
  // stalls pushed against the shopfronts: produce, fish on ice, rice cakes, socks and hats
  W.defer(() => W.scope({ lod: 1 }, () => {
    for (let s = 6; s < st.len - 6; s += mr(5, 8)) for (const side of [-1, 1]) {
      if (mchance(0.35)) continue;
      const p = pathAt(st.pts, s), x = p.x - p.tz * 2.9 * side, z = p.z + p.tx * 2.9 * side, ry = Math.atan2(-p.tz, p.tx), k = mrand();
      W.push(x, 0, z, ry);
      W.box(2.2, 0.8, 1.0, 0, 0.4, 0, 0x8a6a4a, { t: TX.wood }); W.solid(2.2, 0.8, 1.0, 0, 0.4, 0, 'wood');
      if (k < 0.3) for (let i = 0; i < 10; i++) W.sphere(0.12, 0.12, 0.12, -0.9 + (i % 5) * 0.45, 0.88, -0.2 + Math.floor(i / 5) * 0.4, mpick([0xd8302a, 0xe8a020, 0x6aa02a, 0xc8b030]), { seg: 6, hseg: 4 });
      else if (k < 0.5) { W.box(2.1, 0.06, 0.9, 0, 0.83, 0, 0xe8f0f4); for (let i = 0; i < 6; i++) W.box(0.5, 0.06, 0.14, -0.7 + (i % 3) * 0.7, 0.9, -0.2 + Math.floor(i / 3) * 0.4, 0x8a9aa8, { layer: 'metal', ry: mr(-0.3, 0.3) }); }
      else if (k < 0.7) for (let i = 0; i < 8; i++) W.box(0.2, 0.08, 0.2, -0.8 + (i % 4) * 0.5, 0.84, -0.2 + Math.floor(i / 4) * 0.4, mpick([0xf0e8e0, 0xe8a0b0, 0x8ac06a, 0xd8c080]));
      else { W.box(2.2, 0.5, 0.06, 0, 1.6, -0.45, 0x5a4a3a); for (let i = 0; i < 9; i++) W.box(0.18, 0.3, 0.02, -0.9 + i * 0.22, 1.55, -0.4, mpick([0x2a2a6a, 0xd83a3a, 0xe8e8e0, 0x3a3a3a, 0xc8a030])); }
      W.box(2.4, 0.04, 1.4, 0, 2.3, 0.1, mpick([0x2a6a9a, 0xd8601a, 0x3a8a4a]), { layer: 'cloth', rx: 0.15 });
      W.pop();
    }
  }), 'mid', [0, -220]);
}

// ---------------- the Han River: park, embankment, the water and its bridges ----------------
function seoulRiver() {
  const P = DIST.park, Z = DIST.RIVER;
  flat(-1700, Z + 6, 1700, 560, -4, 8);
  // lawn and paths: a jogging path, the red bike path, paving round the store
  groundPlate(P.x0, P.z0 + 18, P.x1, P.z0 + 22, 0x6a6660, TX.paving, 3, 0.05);
  groundPlate(P.x0, P.z0 + 28, P.x1, P.z0 + 31, 0x6a2e26, TX.asphalt, 3, 0.05);
  for (let x = P.x0 + 3; x < P.x1; x += 6) W.box(1.6, 0.01, 0.12, x, 0.065, P.z0 + 29.5, 0xe8e8e0, { ao: false, lod: 1 });
  // embankment wall and its railing; the water below
  W.box(P.x1 - P.x0 + 40, 4.4, 1.2, 0, -2, Z + 0.6, 0x6a6864, { t: TX.concrete, wear: 6 });
  W.scope({ lod: 1 }, () => { for (let x = P.x0; x < P.x1; x += 2) { W.box(0.08, 1.1, 0.08, x, 0.55, Z - 0.3, 0xc8ccd0, { layer: 'metal' }); W.box(2, 0.06, 0.06, x + 1, 1.08, Z - 0.3, 0xc8ccd0, { layer: 'metal' }); W.box(2, 0.04, 0.04, x + 1, 0.6, Z - 0.3, 0xc8ccd0, { layer: 'metal' }); } });
  W.solid(P.x1 - P.x0 + 40, 1.2, 0.3, 0, 0.6, Z - 0.3, 'metal');
  const water = new THREE.Mesh(new THREE.PlaneGeometry(3400, 900), new THREE.MeshStandardMaterial({ color: 0x0a1018, roughness: 0.12, metalness: 0.6 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, -1.3, Z + 450); scene.add(water);
  // reflections: long smears of the bridge and the far bank's lights
  const refl = [];
  for (let i = 0; i < 160; i++) { const x = (Math.random() - 0.5) * 900, c = new THREE.Color(mpick([0xffd090, 0xff2a8a, 0x2af0ff, 0xfff0e0, 0xb06aff, 0xffc060])); refl.push([x, Z + 30 + Math.random() * 260, 0.8 + Math.random() * 1.6, 8 + Math.random() * 30, c]); }
  for (const bx of [-60, 200]) for (let z = Z + 10; z < Z + 300; z += 14) refl.push([bx + mr(-6, 6), z + 6, 1.2, 10, new THREE.Color(0xffe0a0)]);
  const pos = [], col = [], uv = [];
  for (const [x, z, w, l, c] of refl) for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) { pos.push(x + a * w, -1.25, z + b * l); col.push(c.r * 0.5, c.g * 0.5, c.b * 0.5); uv.push((a + 1) / 2, (b + 1) / 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const blob = canvasTex(32, 64, (c2, w2, h2) => { const gr = c2.createLinearGradient(0, 0, w2, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c2.fillStyle = gr; c2.fillRect(0, 0, w2, h2); });
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: blob, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
  // bridges: Mapo off the end of the bridge road (closed tonight), another far to the east
  for (const [bx, closed] of [[-60, true], [200, false]]) {
    const z0 = closed ? Z - 2 : Z + 4, y = 7, len = 700;
    W.box(18, 1.4, len, bx, y, z0 + len / 2, 0x5a5c60, { t: TX.concrete, lod: 0 });
    if (closed) { for (let i = 0; i < 12; i++) { const t = i / 12; W.box(18, 0.5, 4, bx, t * y, Z - 26 + i * 2.2, 0x5a5c60, { t: TX.concrete }); } }
    for (let z = z0; z < z0 + len; z += 50) { W.box(3, y + 5, 4, bx, (y - 5) / 2, z + 25, 0x6a6c70, { t: TX.concrete, lod: 0 }); }
    for (let z = z0; z < z0 + len; z += 12) for (const s of [-1, 1]) { W.box(0.15, 1.2, 0.15, bx + s * 8.8, y + 1.3, z, 0x8a8e94, { layer: 'metal', lod: 1 }); W.sphere(0.25, 0.25, 0.25, bx + s * 8.8, y + 2.0, z, 0xffe0a0, { layer: 'glow', lod: 0 }); }
    for (let z = z0 + 30; z < z0 + 200; z += 40) W.lamp(bx, y + 3, z, 0xffd8a0, 2.4, 18, { halo: 0.9 });
  }
  // Mapo bridge is shut: barriers and a lit sign across the road
  W.scope({ lod: 0 }, () => { for (let x = -68; x <= -52; x += 2) concreteBarrier(x, 0, Z - 30, 0, 0xe8e8e0, true); W.solid(18, 1.2, 1, -60, 0.6, Z - 30, 'concrete'); });
  W.push(-60, 0, Z - 31, Math.PI); NEON.sign('통행제한', 0, 2.2, 0, 4, 0.9, { style: 'led', col: 'red', pool: true }); W.pop();
  // the park: lamps, benches, trees, the riverside store with its folding tables, a food truck
  for (let x = P.x0 + 10; x < P.x1 - 5; x += 26) {
    W.cyl(0.07, 0.09, 4.5, x, 2.25, P.z0 + 24, 0x3a3e42, { seg: 6, layer: 'metal' }); W.sphere(0.35, 0.35, 0.35, x, 4.6, P.z0 + 24, 0xfff0d8, { layer: 'glow' });
    W.lamp(x, 4.4, P.z0 + 24, 0xfff0d8, 2.0, 12, { halo: 0.7 }); NEON.pool(x, P.z0 + 24, 4, 0xfff0d8, 0.3);
    if (Math.abs(x + 60) > 14) W.defer(() => { ginkgo(x + 13, P.z0 + 10); bench(x + 6, 0, P.z0 + 22.6, Math.PI); if (mchance(0.4)) { W.box(2.4, 0.02, 1.8, x + 18, 0.05, P.z0 + 36, mpick([0x2a6aa0, 0xd8302a, 0xe8c020, 0x3a8a4a])); } }, 'mid', [x, P.z0 + 20]);
  }
  const sx = 110, sz = P.z0 + 38;
  W.box(14, 3.6, 7, sx, 1.8, sz, 0xe8e8e4, { t: TX.metal }); W.solid(14, 3.6, 7, sx, 1.8, sz, 'concrete');
  W.box(12, 2.4, 0.04, sx, 1.5, sz - 3.52, 0xd8f0f0, { layer: 'glow' });
  W.box(14.4, 0.8, 0.4, sx, 3.4, sz - 3.6, 0x1a1a1e, { layer: 'metal' }); W.push(sx, 0, sz - 3.82, Math.PI); NEON.sign('빛24 한강점', 0, 3.4, 0, 8, 0.7, { style: 'box', col: 'green' }); W.pop();
  W.lamp(sx, 2.5, sz - 6, 0xe8f4ff, 3, 12, { halo: 0.4 });
  W.defer(() => W.scope({ lod: 1 }, () => { for (let i = 0; i < 6; i++) { const tx = sx - 8 + (i % 3) * 8, tz = sz - 8 - Math.floor(i / 3) * 5; plasticTable(tx, 0, tz, 0, 0xe8e8e0); for (const s of [-1, 1]) plasticChair(tx + s * 0.7, 0, tz, s * 1.57, 0xe8e8e0); W.cone(1.3, 0.45, tx, 2.3, tz, mpick([0x2a8a4a, 0xd8302a, 0x2a5aa0]), { seg: 8, layer: 'cloth' }); W.rod([tx, 0, tz], [tx, 2.3, tz], 0.025, 0xc8c8c8, { layer: 'metal' }); W.cyl(0.08, 0.06, 0.1, tx + 0.15, 0.78, tz, 0xd8302a, { seg: 8 }); } }), 'mid', [sx, sz]);
  // food truck with its hatch open
  W.box(5.5, 2.6, 2.2, -150, 1.6, P.z0 + 38, 0xe8c020, { layer: 'metal' }); W.box(3, 1.0, 0.04, -150, 2.0, P.z0 + 36.88, 0xffd8a0, { layer: 'glow' }); W.box(3.2, 0.06, 1.0, -150, 2.6, P.z0 + 36.4, 0xe8c020, { layer: 'metal', rx: -0.5 });
  W.solid(5.5, 2.6, 2.2, -150, 1.6, P.z0 + 38, 'metal'); W.lamp(-150, 2.2, P.z0 + 35.5, 0xffd8a0, 2, 8, { halo: 0.4 });
  W.push(-150, 0, P.z0 + 36.85, Math.PI); NEON.sign('닭꼬치', 0, 3.2, 0, 2.6, 0.6, { style: 'tube', col: 'orange', pool: false }); W.pop();
}

// ---------------- the city's edge: noise barriers where the streets run out ----------------
function seoulEdges() {
  for (const [a, b] of [[[-250, -330], [250, -330]], [[250, -330], [250, DIST.RIVER]], [[-250, DIST.RIVER], [-250, -330]]]) {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    W.push((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, Math.atan2(-dz, dx)); W.box(L, 7, 0.4, 0, 3.5, 0, 0x4a5a6a, { layer: 'metal', t: TX.corrugated, wear: 4 }); W.solid(L, 7, 0.4, 0, 3.5, 0, 'metal');
    for (let x = -L / 2 + 10; x < L / 2; x += 24) NEON.sign(mpick(['공사중', '안전제일', '출입금지']), x, 5, 0.25, 3.2, 0.8, { style: 'box', col: 'yellow', pool: false, glow: false, lamp: false });
    W.pop();
  }
}
// all the new quarters' furniture, after the frontages are down
function seoulOuterDressing() {
  for (const st of ROADS) boulevard(st);
  seoulApartments(); seoulGangnam(); seoulMarket(); seoulRiver(); seoulEdges();
  for (const [x, z] of [[DIST.market.x0 + 4, DIST.market.z1 - 3], [DIST.gangnam.x0 + 3, DIST.gangnam.z1 - 4], [DIST.ahyeon.x1 - 4, DIST.ahyeon.z1 - 3]]) W.scope({ lod: 1 }, () => { kiosk(x, 0, z, 0); });
}
