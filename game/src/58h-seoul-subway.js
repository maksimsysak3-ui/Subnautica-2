// =====================================================================
//  NEON SEOUL — Line 2: five stations under the city, and the trains between them
// =====================================================================
// Each entrance on the street leads down to its own station, built out past the city's edge where
// the camera never looks (the streets are culled long before): stairs, a concourse with a konbini,
// a bakery and a cosmetics shop, ticket gates, and an island platform with screen doors and a train
// waiting on each side — inner loop one way, outer loop the other. Board, press E, and the doors
// close; you ride in a car running through a tunnel and step off at the next station along.
const LINE2 = [
  { ko: '홍대입구', en: 'Hongik Univ.', no: '239', x: 65, z: 30 },
  { ko: '아현', en: 'Ahyeon', no: '241', x: -203, z: 24 },
  { ko: '남대문시장', en: 'Namdaemun Market', no: '202', x: 46, z: -186 },
  { ko: '강남', en: 'Gangnam', no: '222', x: 203, z: 24 },
  { ko: '여의나루', en: 'Yeouinaru', no: '237', x: 60, z: 185 },
];
const UNDER = { z: -720, xs: [-440, -220, 0, 220, 440], ride: { x: 640, z: -720 } };
const CAR = { L: 20, Wd: 2.9, H: 2.3, doors: [-7.5, -2.5, 2.5, 7.5], at: 15 };   // car frame: x along it, −z = platform side
const SUBCARS = [];   // { st, dir, ox, oz, ry, leaves: [{ m, bx, sgn }] }

function seoulSubway() {
  LINE2.forEach((s, i) => { subwayEntrance(s.x, s.z, s.ko); s.ox = UNDER.xs[i]; s.oz = UNDER.z; metroStation(s, i); });
  TOWN.spots.subway = { x: LINE2[0].x, z: LINE2[0].z - 2 };
  rideCar();
}

// ---------------- one station ----------------
function metroStation(s, i) {
  const { ox, oz } = s, next = LINE2[(i + 1) % 5], prev = LINE2[(i + 4) % 5];
  flat(ox - 80, oz - 24, ox + 60, oz + 24, -1.3, 10);
  GR.rect(ox - 10, oz, 140, 48, 0, GR.WALL, true);
  W.push(ox, 0, oz, 0);
  const tile = 0xd8d8d0, wallC = 0xc8ccc8, accent = 0x2aa04a;
  const floor = (w, d, x, z, col = tile) => { W.box(w, 0.3, d, x, -0.15, z, col, { t: TX.ceramic, wear: 2 }); W.solid(w, 0.3, d, x, -0.15, z, 'stone', { walk: true }); };
  const wall = (w, h, d, x, y, z, col = wallC, t = TX.ceramic) => { W.box(w, h, d, x, y, z, col, { t, wear: 2 }); W.solid(w, h, d, x, y, z, 'stone'); };
  // floors: concourse, island platform, the stair shaft; the track beds below the platform edge
  floor(38, 28, -31, 0); floor(54, 8.4, 15, 0, 0xc8c8c0); floor(12.5, 6, -56, 0);
  for (const s2 of [-1, 1]) {
    W.box(54, 0.1, 6.3, 15, -1.25, s2 * 7.35, 0x2a2826, { t: TX.gravel });
    for (const r of [-0.72, 0.72]) W.box(54, 0.12, 0.08, 15, -1.12, s2 * 5.85 + r, 0x8a8e94, { layer: 'metal' });
    for (let x = -11; x < 42; x += 0.8) W.box(0.25, 0.08, 2.2, x, -1.18, s2 * 5.85, 0x4a4440, { lod: 2 });
    W.box(54, 0.012, 0.4, 15, 0.005, s2 * 3.95, 0xe8c020, { ao: false });   // tactile edge
  }
  // walls and ceilings
  wall(38, 5.4, 0.3, -31, 2.7, -14.15); wall(38, 5.4, 0.3, -31, 2.7, 14.15);
  wall(0.3, 5.4, 11, -50.15, 2.7, -8.5); wall(0.3, 5.4, 11, -50.15, 2.7, 8.5);
  wall(0.3, 5.4, 3.6, -12, 2.7, -12.3); wall(0.3, 5.4, 3.6, -12, 2.7, 12.3);
  wall(54, 5.4, 0.3, 15, 2.7, -10.65, 0x8a9a8a); wall(54, 5.4, 0.3, 15, 2.7, 10.65, 0x8a9a8a); wall(0.3, 5.4, 21.6, 42.15, 2.7, 0);
  W.box(38.4, 0.3, 28.6, -31, 5.35, 0, 0xe8e8e4, { t: TX.plaster }); W.box(54.4, 0.3, 21.6, 15, 5.35, 0, 0xe8e8e4, { t: TX.plaster });
  for (let x = -48; x < -12; x += 4) for (const z of [-9, -3, 3, 9]) W.box(2.6, 0.04, 0.5, x, 5.18, z, 0xf4f8ff, { layer: 'glow' });
  for (let x = -10; x < 42; x += 3) for (const z of [-2.2, 2.2]) W.box(2.2, 0.04, 0.4, x, 5.18, z, 0xf4f8ff, { layer: 'glow' });
  for (const [x, z] of [[-42, -6], [-42, 6], [-24, -6], [-24, 6], [-4, 0], [12, 0], [28, 0], [38, 0]]) W.lamp(x, 4.6, z, 0xf0f6ff, 2.6, 13, { halo: 0 });
  // the green line along the walls, and the station's name on them every few metres
  for (const z of [-10.48, 10.48]) { W.box(54, 0.35, 0.03, 15, 2.8, z, accent, { ao: false }); for (let x = -6; x < 42; x += 12) { W.push(x, 0, z, z < 0 ? 0 : Math.PI); W.box(4.4, 1.3, 0.05, 0, 3.6, 0.03, 0x1a1a1e, { layer: 'metal' }); NEON.sign(s.ko, 0, 3.8, 0.06, 3.8, 0.7, { style: 'box', col: 'white', glow: false, pool: false, lamp: false, dim: 0.8 }); NEON.sign(s.en, 0, 3.25, 0.06, 3.0, 0.32, { style: 'plate', col: '#ffffff', dim: 0.7 }); W.pop(); } }
  // ---- exit stairs up to the street (the trigger is the landing at the top) ----
  wall(12.5, 9.4, 0.3, -56, 4.7, -3.15); wall(12.5, 9.4, 0.3, -56, 4.7, 3.15); wall(0.3, 9.4, 6, -62.3, 4.7, 0); W.box(12.5, 0.3, 6.3, -56, 9.3, 0, 0xe8e8e4);
  flight(-50.1, 0, [-1, 0], 5.6, 0, 4.6, { col: 0xb8b8b0, tx: TX.terrazzo });
  const fl = Math.round(4.6 / ST_RISE) * ST_RUN; W.box(12.4 - fl, 0.3, 6, -62.2 + (12.4 - fl) / 2, 4.45, 0, 0xb8b8b0, { t: TX.terrazzo }); W.solid(12.4 - fl, 0.3, 6, -62.2 + (12.4 - fl) / 2, 4.45, 0, 'stone', { walk: true });
  for (const z of [-2.6, 2.6]) W.rod([-50.2, 1.0, z], [-50.2 - fl, 5.6, z], 0.04, 0xc8ccd0, { layer: 'metal' });
  W.box(4, 0.04, 0.6, -59, 8.9, 0, 0xf4f8ff, { layer: 'glow' }); W.lamp(-58, 8, 0, 0xf0f6ff, 2, 10, { halo: 0 });
  W.push(-50.3, 0, 0, -Math.PI / 2); W.box(5, 0.8, 0.1, 0, 4.7, 0, 0x1a1a1e, { layer: 'metal' }); NEON.sign('출구 EXIT 1', 0, 4.7, 0.06, 4.6, 0.6, { style: 'box', col: 'yellow', glow: false, pool: false, lamp: false }); W.pop();
  // ---- the concourse: shops down both walls ----
  // konbini: glass front, shelves, a fridge wall, the counter
  W.box(14, 3.2, 0.06, -39, 1.6, -8.1, 0x9ab0c0, { layer: 'glass' }); W.solid(10, 3.2, 0.2, -41, 1.6, -8.1, 'glass'); wall(0.2, 3.4, 6, -46.1, 1.7, -11); wall(0.2, 3.4, 6, -31.9, 1.7, -11);
  W.box(14.4, 1.0, 0.4, -39, 3.7, -7.9, 0x1a1a1e, { layer: 'metal' }); W.push(-39, 0, -7.68, 0); NEON.sign('빛24 편의점', 0, 3.7, 0, 7, 0.8, { style: 'box', col: 'green', pool: true }); W.pop();
  later(() => W.scope({ lod: 2 }, () => {
    for (let i2 = 0; i2 < 4; i2++) shelfUnit(-44 + i2 * 2.1, 0, -13.5, 0, 1.9, 1.8, 0.5, 0xe8e8e4, 'grocery');
    gondola(-40.5, -12.2, -9.6, ['ramen', 'snacks', 'packs']);
    W.box(1.0, 2.0, 0.6, -35, 1.0, -13.6, 0xd8f0ff, { layer: 'glow' }); W.box(1.0, 2.0, 0.6, -33.9, 1.0, -13.6, 0xd8f0ff, { layer: 'glow' });
    counter(-34, 0, -9.4, 0, 2.4, 0xe8e8e4, 0x8a8a88); cashRegister(-34.4, 1.0, -9.4, 0);
  }), 'near');
  W.box(14, 0.04, 6, -39, 0.02, -11, 0xe8e8e4, { t: TX.ceramic }); W.lamp(-39, 3, -11, 0xe8f4ff, 2.4, 8, { halo: 0 });
  // bakery: a warm glass case of bread, trays on the wall behind
  W.box(10, 1.1, 0.8, -41, 0.55, 9.2, 0x8a6a4a, { t: TX.wood }); W.solid(10, 1.1, 0.8, -41, 0.55, 9.2, 'wood'); W.box(9.8, 0.5, 0.7, -41, 1.35, 9.2, 0xffe0a8, { layer: 'glow' }); W.box(10, 0.04, 0.8, -41, 1.62, 9.2, 0x9ab0c0, { layer: 'glass' });
  later(() => W.scope({ lod: 2 }, () => { for (let k = 0; k < 24; k++) W.sphere(0.16, 0.1, 0.12, -45.6 + (k % 12) * 0.8, 1.2, 9.0 + Math.floor(k / 12) * 0.35, mpick([0xb87a3a, 0xc88a4a, 0xa8642a, 0xe8c890]), { seg: 6, hseg: 4 }); for (let r = 0; r < 4; r++) for (let k = 0; k < 9; k++) W.box(0.5, 0.18, 0.3, -45 + k * 1.0, 0.8 + r * 0.55, 13.7, mpick([0xb87a3a, 0xd8a868, 0xe8d0a0, 0x8a4a2a])); }), 'near');
  W.box(10.4, 1.0, 0.4, -41, 3.7, 13.8, 0x3a2418, { layer: 'metal' }); W.push(-41, 0, 13.58, Math.PI); NEON.sign('빵굽는 집', 0, 3.7, 0, 5, 0.75, { style: 'tube', col: 'orange', pool: true }); W.pop();
  W.lamp(-41, 3, 11.5, 0xffd8a0, 2.2, 8, { halo: 0 });
  // cosmetics: white glowing shelves of small bright boxes
  W.box(7, 2.6, 0.5, -29, 1.3, 13.6, 0xf4f4f0, { layer: 'glow' }); W.solid(7, 2.6, 0.5, -29, 1.3, 13.6, 'wood');
  later(() => W.scope({ lod: 2 }, () => { for (let r = 0; r < 5; r++) for (let k = 0; k < 20; k++) W.box(0.18, 0.22, 0.12, -32.2 + k * 0.33, 0.5 + r * 0.45, 13.3, mpick([0xe86a9a, 0xd82a5a, 0xf0c8d8, 0x6ac8e8, 0xe8e8e0, 0xc8a0e8])); }), 'near');
  W.box(7.4, 0.8, 0.4, -29, 3.7, 13.8, 0x1a1a1e, { layer: 'metal' }); W.push(-29, 0, 13.58, Math.PI); NEON.sign('화장품', 0, 3.7, 0, 4, 0.65, { style: 'box', col: 'pink', pool: true }); W.pop();
  W.box(4, 1.0, 1.2, -29, 0.5, 11, 0xe8e8e4); W.solid(4, 1.0, 1.2, -29, 0.5, 11, 'wood');
  // lockers, vending machines, the route map, benches round the pillars
  for (let k = 0; k < 4; k++) W.box(0.6, 2.2, 1.9, -49.6, 1.1, 4.5 + k * 2, 0xc8ccd0, { layer: 'metal' }); W.solid(0.6, 2.2, 8, -49.6, 1.1, 7.5, 'metal');
  later(() => W.scope({ lod: 2 }, () => { for (let k = 0; k < 4; k++) for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) W.box(0.02, 0.48, 0.58, -49.28, 0.3 + r * 0.52, 3.85 + k * 2 + c * 0.62, 0xb8bcc0, { layer: 'metal' }); }), 'near');
  for (let k = 0; k < 3; k++) vendingMachine(-49.5, 0, -5 - k * 1.1, Math.PI / 2, mpick([0xc0302a, 0x2a5aa0, 0xe8e0d0]));
  routeMap(-25, 3.0, -13.95, 0, i);
  // the people: clerks in the three shops, a few waiting for trains
  staffAt(-34, -10.15, Math.PI, 'shop'); staffAt(-42, 10.1, 0, 'shop'); staffAt(-29, 12.45, 0, 'shop');
  for (const [x, z, y] of [[4, 2.2, 0.4], [17, -2.5, 2.8], [27, 1.9, -0.3], [-30, -3, 1.2]]) staffAt(x, z, y, 'guest');
  for (const x of [-40, -24]) for (const z of [-4.5, 4.5]) { wall(1.1, 5.2, 1.1, x, 2.6, z, 0x2a6a4a); W.scope({ lod: 1 }, () => { bench(x + 1.8, 0, z, z > 0 ? Math.PI : 0); }); }
  // ---- ticket gates ----
  for (let k = 0; k < 13; k++) {
    const z = -9.6 + k * 1.6;
    W.box(1.4, 1.0, 0.25, -12, 0.5, z, 0xb8bcc0, { layer: 'metal' }); W.solid(1.4, 1.0, 0.25, -12, 0.5, z, 'metal');
    W.box(0.3, 0.04, 0.2, -12.6, 1.02, z, k % 3 === 0 ? 0xff3a3a : 0x40ff7a, { layer: 'glow' }); W.box(0.3, 0.04, 0.2, -11.4, 1.02, z, 0x40ff7a, { layer: 'glow' });
  }
  W.box(2.2, 2.6, 3.4, -13, 1.3, -12.2, 0xe8e8e4, { t: TX.plaster }); W.box(2.0, 1.0, 0.04, -11.88, 1.6, -12.2, 0xd8e8f0, { layer: 'glow', ry: Math.PI / 2 });
  W.push(-12.2, 0, 0, Math.PI / 2); W.box(8, 0.7, 0.12, 0, 4.4, 0, 0x1a1a1e, { layer: 'metal' }); NEON.sign('타는 곳  Platform', 0, 4.4, 0.07, 7, 0.55, { style: 'box', col: 'green', back: true, glow: false, pool: false, lamp: false }); W.pop();
  // ---- the platform: screen doors with their displays, pillars, benches, the trains ----
  for (const zs of [-1, 1]) {
    const z = zs * 4.2, gaps = CAR.doors.map((d) => CAR.at + d);
    let x0 = -11;
    for (const g of [...gaps.sort((a, b) => a - b), 41.9 + 0.8]) {
      const x1 = Math.min(g - 0.8, 41.9);
      if (x1 > x0) { W.box(x1 - x0, 2.2, 0.05, (x0 + x1) / 2, 1.1, z, 0x9ab8c0, { layer: 'glass' }); W.solid(x1 - x0, 2.3, 0.2, (x0 + x1) / 2, 1.15, z, 'glass'); for (let x = x0; x <= x1; x += 1.6) W.box(0.06, 2.2, 0.1, x, 1.1, z, 0x8a8e94, { layer: 'metal' }); }
      x0 = g + 0.8;
    }
    W.box(53, 0.6, 0.3, 15, 2.55, z, 0x3a3e42, { layer: 'metal' });
    for (const g of gaps) { W.box(1.6, 0.3, 0.5, g, -0.15, zs * 4.42, 0xa8a8a0); W.solid(1.6, 0.3, 0.5, g, -0.15, zs * 4.42, 'stone', { walk: true }); }
    for (const g of gaps) { W.push(g, 0, z, zs < 0 ? Math.PI : 0); NEON.sign(zs > 0 ? `${next.ko} 방면` : `${prev.ko} 방면`, 0, 2.55, 0.17, 1.5, 0.36, { style: 'led', col: 'yellow', glow: false, pool: false, lamp: false }); W.pop(); }
  }
  for (const x of [0, 10, 20, 30]) { wall(0.8, 5.2, 0.8, x, 2.6, 0, 0xd8d8d0); W.scope({ lod: 1 }, () => { for (const zs of [-1, 1]) bench(x + 4, 0, zs * 1.2, zs > 0 ? Math.PI : 0); }); }
  W.push(15, 0, 0, 0); W.box(7, 0.9, 0.2, 0, 4.1, 0, 0x1a1a1e, { layer: 'metal' });
  NEON.sign(`내선 → ${next.ko}`, 0, 4.25, 0.11, 6.4, 0.38, { style: 'led', col: 'green', glow: false, pool: false, lamp: false }); NEON.sign(`외선 → ${prev.ko}`, 0, 3.85, 0.11, 6.4, 0.38, { style: 'led', col: 'orange', glow: false, pool: false, lamp: false });
  W.pop();
  W.pop();
  // the two trains standing at the platform, doors open
  trainCar(ox + CAR.at, oz + 5.85, 0, `다음역 ${next.ko}`, { st: i, dir: 1 });
  trainCar(ox + CAR.at, oz - 5.85, Math.PI, `다음역 ${prev.ko}`, { st: i, dir: -1 });
}
// the loop drawn on the wall, this station marked
function routeMap(x, y, z, ry, here) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const g = cv.getContext('2d');
  g.fillStyle = '#f4f4ee'; g.fillRect(0, 0, 512, 256); g.strokeStyle = '#2aa04a'; g.lineWidth = 10; g.beginPath(); g.ellipse(256, 132, 190, 88, 0, 0, 7); g.stroke();
  g.font = '700 20px "Malgun Gothic","Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.fillStyle = '#1a1a1a'; g.fillText('2호선  Line 2', 256, 30);
  const pos = [[256, 220], [66, 132], [256, 44], [446, 132], [360, 205]];
  LINE2.forEach((s, k) => { const [px, py] = pos[k]; g.fillStyle = k === here ? '#ff3a3a' : '#ffffff'; g.strokeStyle = '#2aa04a'; g.lineWidth = 4; g.beginPath(); g.arc(px, py, k === here ? 12 : 9, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#1a1a1a'; g.font = `${k === here ? 900 : 700} 17px "Malgun Gothic","Noto Sans KR",sans-serif`; g.fillText(s.ko, px, py + (py > 132 ? -18 : 30)); });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  const p = W.worldPos(x, y, z); m.position.copy(p); m.rotation.y = ry; m.updateMatrix(); m.matrixAutoUpdate = false; m.userData.lod = 0; m.geometry.computeBoundingSphere(); scene.add(m);
  W.box(5.3, 2.8, 0.06, x, y, z - 0.04, 0x2a2a2e, { layer: 'metal' });
}

// ---------------- a Line 2 car: frame at floor centre, x along the car, −z faces the platform ----------------
function trainCar(cx, cz, ry, ledText, rec) {
  const { L, Wd, H, doors } = CAR, hw = Wd / 2, seat = rec.ride ? 0x2a5a8a : mpick([0x2a7a5a, 0x2a5a8a]), skin = 0xd8dce0;
  W.push(cx, 0, cz, ry);
  W.box(L, 0.2, Wd + 0.1, 0, -0.1, 0, 0x4a4e56, { t: TX.none }); W.solid(L, 0.2, Wd + 0.1, 0, -0.1, 0, 'metal', { walk: true });
  W.box(L - 1, 0.9, Wd, 0, -0.65, 0, 0x2a2c2e, { layer: 'metal' });
  W.box(L + 0.2, 0.3, Wd + 0.3, 0, H + 0.2, 0, 0xb8bcc0, { layer: 'metal' });
  W.box(L, 0.05, Wd, 0, H, 0, 0xc8ccd0); for (const z of [-0.6, 0.6]) W.box(L - 1, 0.03, 0.14, 0, H - 0.03, z, 0xdce4f0, { layer: 'glow' });
  for (const x of [-6, 0, 6]) W.lamp(x, H - 0.3, 0, 0xf0f6ff, 0.9, 6, { halo: 0 });
  // walls: lower panel, window band, upper panel; the platform side broken by the doors
  const segs = (side) => { const out = []; let a = -L / 2; for (const d of (side < 0 ? doors : [])) { out.push([a, d - 0.68]); a = d + 0.68; } out.push([a, L / 2]); return out; };
  for (const side of [-1, 1]) {
    const z = side * (hw + 0.04);
    for (const [a, b] of segs(side)) {
      const w = b - a, x = (a + b) / 2;
      W.box(w, 0.85, 0.08, x, 0.425, z, skin, { layer: 'metal' }); W.box(w, 0.45, 0.08, x, H - 0.225, z, skin, { layer: 'metal' });
      W.box(w, 1.0, 0.03, x, 1.35, z, 0x8aa0b0, { layer: 'glass' }); for (let k = a; k <= b; k += 2.4) W.box(0.12, 1.0, 0.1, k, 1.35, z, skin, { layer: 'metal' });
      W.solid(w, H, 0.15, x, H / 2, z, 'metal');
      W.box(w, 0.12, 0.02, x, 0.95, z + side * 0.06, 0x2aa04a, { ao: false });   // the green stripe
    }
    if (side < 0) for (const d of doors) { W.box(1.4, 0.35, 0.1, d, H - 0.17, z, skin, { layer: 'metal' }); W.push(d, 0, z + 0.06, 0); NEON.sign(ledText, 0, H - 0.17, 0, 1.1, 0.24, { style: 'led', col: 'red', glow: false, pool: false, lamp: false }); W.pop(); if (rec.ride) W.solid(1.4, H, 0.15, d, H / 2, z, 'metal'); }
  }
  for (const s of [-1, 1]) { W.box(0.1, H, Wd, s * L / 2, H / 2, 0, skin, { layer: 'metal' }); W.box(0.03, 1.2, 0.7, s * (L / 2 - 0.06), 1.3, 0, 0x8aa0b0, { layer: 'glass' }); W.solid(0.15, H, Wd, s * L / 2, H / 2, 0, 'metal'); }
  // long bench seats, poles, grab rails and straps, ads over the windows
  const benches = []; let a0 = -L / 2 + 0.2; for (const d of doors) { benches.push([a0, d - 0.85]); a0 = d + 0.85; } benches.push([a0, L / 2 - 0.2]);
  for (const side of [-1, 1]) for (const [a, b] of benches) {
    const w = b - a, x = (a + b) / 2, z = side * (hw - 0.27);
    W.box(w, 0.4, 0.42, x, 0.2, z, 0x8a8e94, { layer: 'metal' }); W.box(w, 0.1, 0.5, x, 0.45, z, seat, { t: TX.fabric }); W.box(w, 0.5, 0.08, x, 0.78, side * (hw - 0.04), seat, { t: TX.fabric });
    W.solid(w, 0.5, 0.5, x, 0.25, z, 'cloth');
  }
  later(() => W.scope({ lod: 2 }, () => {
    for (const d of doors) for (const s of [-1, 1]) W.rod([d + s * 0.85, 0, 0], [d + s * 0.85, H, 0], 0.025, 0xd8dce0, { layer: 'metal' });
    for (const side of [-1, 1]) {
      W.rod([-L / 2 + 0.3, 1.9, side * 0.95], [L / 2 - 0.3, 1.9, side * 0.95], 0.02, 0xd8dce0, { layer: 'metal' });
      for (let x = -L / 2 + 0.6; x < L / 2 - 0.4; x += 0.45) { W.rod([x, 1.9, side * 0.95], [x, 1.68, side * 0.95], 0.01, 0xe8e8e0); W.box(0.12, 0.12, 0.02, x, 1.62, side * 0.95, 0xe8e8e0); }
      for (let x = -L / 2 + 1.5; x < L / 2 - 1; x += 2.4) W.box(1.2, 0.3, 0.02, x, 2.0, side * (hw - 0.02), mpick([0xe86a9a, 0x6ab0e8, 0xe8c040, 0x8ae86a, 0xe8e8e0]), { ao: false });
    }
  }), 'near');
  W.pop();
  // the sliding doors are real objects so they can open and close
  const mat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.4, metalness: 0.5 }), gl = new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.1, metalness: 0.3 });
  const c = Math.cos(ry), s = Math.sin(ry), leaves = [];
  for (const d of doors) for (const sg of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.95, 0.05), mat); const win = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.06), gl); win.position.y = 0.35; m.add(win);
    m.userData.lod = 0; m.geometry.computeBoundingSphere(); scene.add(m);
    leaves.push({ m, bx: d + sg * 0.33, sgn: sg });
  }
  const car = { ...rec, ox: cx, oz: cz, ry, c, s, leaves, open: rec.ride ? 0 : 1 };
  SUBCARS.push(car); placeDoors(car);
  return car;
}
function placeDoors(car) {
  const z = -(CAR.Wd / 2 + 0.02);
  for (const l of car.leaves) { const lx = l.bx + l.sgn * car.open * 0.64; l.m.position.set(car.ox + lx * car.c + z * car.s, 0.98, car.oz - lx * car.s + z * car.c); l.m.rotation.y = car.ry; l.m.updateMatrixWorld(); }
}
// the car you actually ride in: same interior, doors shut, a tunnel streaming past outside
const TUNNEL = { lights: null, t: 0, speed: 0 };
function rideCar() {
  const { x, z } = UNDER.ride;
  flat(x - 40, z - 20, x + 40, z + 20, -1.3, 8); GR.rect(x, z, 80, 40, 0, GR.WALL, true);
  trainCar(x, z, 0, '열차 운행중', { st: -1, dir: 0, ride: true });
  for (const s of [-1, 1]) W.box(120, 4.5, 0.4, x, 1.2, z + s * 3.4, 0x2a2a28, { t: TX.concrete, wear: 6 });
  W.box(120, 0.4, 7.2, x, 3.7, z, 0x1e1e1c, { t: TX.concrete }); W.box(120, 0.2, 7.2, x, -1.2, z, 0x1a1816, { t: TX.gravel });
  // tunnel lamps and cable trays: instanced, slid along the car while it runs
  const n = 40, g = new THREE.BoxGeometry(0.5, 0.12, 0.08), m = new THREE.MeshBasicMaterial({ color: 0xfff0c8, toneMapped: false });
  const im = new THREE.InstancedMesh(g, m, n * 2); im.frustumCulled = false; scene.add(im);
  TUNNEL.lights = { im, n, x, z };
  W.lamp(x, 1.5, z, 0xf0f6ff, 1.2, 8, { halo: 0 });
}
function tunnelTick(dt) {
  const T = TUNNEL.lights; if (!T) return;
  TUNNEL.t += dt * TUNNEL.speed;
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < T.n; i++) for (const s of [0, 1]) { const off = ((i * 3 - TUNNEL.t) % (T.n * 3) + T.n * 3) % (T.n * 3) - T.n * 1.5; m4.makeTranslation(T.x + off, 1.6 + (s ? 0.4 : 0), T.z + (s ? 1 : -1) * 3.15); T.im.setMatrixAt(i * 2 + s, m4); }
  T.im.instanceMatrix.needsUpdate = true;
}

// ---------------- runtime: stairs down and up, boarding, the ride ----------------
const SUBWAY = (() => {
  if (MAP.id !== 'seoul') return { update() { }, interact: () => false, get under() { return false; } };
  const fade = document.createElement('div'); fade.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .3s;z-index:40';
  const tip = document.createElement('div'); tip.style.cssText = 'position:absolute;left:50%;top:62%;transform:translateX(-50%);font-size:15px;letter-spacing:.2em;color:#9affb0;text-shadow:0 0 8px #000;display:none;text-align:center';
  let built = false, under = false, busy = 0, state = 'idle', t = 0, car = null, dest = null, pending = null;
  const local = (cr, x, z) => { const dx = x - cr.ox, dz = z - cr.oz; return [dx * cr.c - dz * cr.s, dx * cr.s + dz * cr.c]; };
  const world = (cr, lx, lz) => [cr.ox + lx * cr.c + lz * cr.s, cr.oz - lx * cr.s + lz * cr.c];
  const inCar = (cr) => { const [lx, lz] = local(cr, P.pos.x, P.pos.z); return Math.abs(lx) < CAR.L / 2 - 0.1 && Math.abs(lz) < CAR.Wd / 2 && P.pos.y < 1; };
  function blackout(fn) { busy = 0.7; fade.style.opacity = '1'; setTimeout(() => { fn(); setTimeout(() => { fade.style.opacity = '0'; }, 120); }, 320); }
  function put(x, y, z, yaw) { P.pos.set(x, y, z); P.vel.set(0, 0, 0); P.vy = 0; if (yaw !== undefined) P.yaw = yaw; STREAM.prime(P.pos); }
  function moveRel(from, to) { const [lx, lz] = local(from, P.pos.x, P.pos.z), [x, z] = world(to, lx, lz); put(x, P.pos.y, z, P.yaw + (to.ry - from.ry)); }
  const carOf = (st, dir) => SUBCARS.find((c) => c.st === st && c.dir === dir);
  function say(msg) { feed(`<span class="s">${msg}</span>`); }
  return {
    get under() { return under; },
    update(dt) {
      if (!built) { built = true; document.body.appendChild(fade); document.getElementById('hud').appendChild(tip); }
      if (busy > 0) busy -= dt;
      // doors
      for (const c of SUBCARS) { const want = c.want ?? (c.ride ? 0 : 1); if (c.open !== want) { c.open = want > c.open ? Math.min(want, c.open + dt / 1.1) : Math.max(want, c.open - dt / 1.1); placeDoors(c); } }
      if (state === 'riding') {
        t += dt; const k = t < 2 ? t / 2 : t > 5.5 ? Math.max(0, (7 - t) / 1.5) : 1;
        TUNNEL.speed = 60 * k; tunnelTick(dt); P.shake = Math.max(P.shake, 0.06 + 0.12 * k); audio.rumble?.(k);
        if (t > 3 && !pending) { pending = 1; say(`이번 역은 ${LINE2[dest.st].ko}역입니다 · This stop is ${LINE2[dest.st].en}`); }
        if (t >= 7) { state = 'arrive'; blackout(() => { const ride = SUBCARS.find((c) => c.ride); moveRel(ride, dest); dest.open = 0; dest.want = 0; setTimeout(() => { dest.want = 1; audio.chime?.(); }, 500); state = 'idle'; car = null; }); }
        setPrompt(tip, ''); return;
      }
      if (state === 'closing') {
        t += dt;
        if (!inCar(car)) { state = 'idle'; car.want = 1; say('승차 취소 · You stepped off'); return; }
        if (t >= 1.5) { state = 'riding'; t = 0; pending = null; const ride = SUBCARS.find((c) => c.ride); ride.open = 0; placeDoors(ride); moveRel(car, ride); car.want = 1; }
        setPrompt(tip, ''); return;
      }
      if (busy > 0 || P.dead || P.vehicle) { setPrompt(tip, ''); return; }
      // entrances: walk into a stairwell on the street and you're downstairs
      if (!under) for (let i = 0; i < LINE2.length; i++) {
        const s = LINE2[i], lx = P.pos.x - s.x, lz = P.pos.z - s.z;
        if (Math.abs(lx) < 1.9 && lz < 2.2 && lz > -3.8) { blackout(() => { put(s.ox - 46, 0.05, s.oz, -Math.PI / 2); under = true; say(`${s.ko}역 · ${s.en} — Line 2`); }); return; }
      }
      if (under) {
        // the exit landing back up to the street
        for (const s of LINE2) if (Math.abs(P.pos.z - s.oz) < 3 && P.pos.x < s.ox - 57.5 && P.pos.x > s.ox - 63 && P.pos.y > 3.5) { blackout(() => { put(s.x, 0.05, s.z + 5.6, Math.PI); under = false; }); return; }
        const c = SUBCARS.find((c2) => !c2.ride && inCar(c2));
        if (c) { const to = LINE2[(c.st + c.dir + 5) % 5]; setPrompt(tip, `[E]  ${c.dir > 0 ? '내선순환 INNER LOOP' : '외선순환 OUTER LOOP'}<br>다음역 ${to.ko} · next stop ${to.en}`); return; }
      }
      setPrompt(tip, '');
    },
    interact() {
      if (!under || state !== 'idle' || busy > 0) return false;
      const c = SUBCARS.find((c2) => !c2.ride && inCar(c2)); if (!c) return false;
      car = c; dest = carOf((c.st + c.dir + 5) % 5, c.dir); state = 'closing'; t = 0; c.want = 0; audio.chime?.();
      say('출입문 닫습니다 · Doors closing');
      return true;
    },
  };
})();
