// =====================================================================
//  CASE 03 — RAVENSCROFT: a walled estate on the night of a gala
// =====================================================================
// A three-part house (central block over two floors, two single-storey wings) at the top of a long
// gravel drive; lawns with a marquee where the guests drink, formal gardens behind, a hedge maze to the
// west, a lake with a boathouse to the east, garages, a helipad. A stone wall all round: the main gate
// (checked), a service gate, and one stretch the winter brought down. Private security everywhere.
const MANOR = { house: { x0: -24, x1: 24, z0: -62, z1: -30 }, H0: 4.6, H1: 4.2, T: 0.45, wall: { x0: -200, x1: 200, z0: -200, z1: 200 } };
const STONE = 0xd8cdb8, STONE_DK = 0xb8ab94, SLATE = 0x4a5058, GRASS = 0x4a6a34, GRAVEL = 0xb8ae98;

function manorPlan() {
  SKY.dusk();
  Object.assign(CITY, { x0: -260, x1: 260, z0: -230, z1: 245 });
  Object.assign(SPAWN, { x: -46, z: 220, yaw: 0 });
  Object.assign(SQ, { x0: 1e4, z0: 1e4, x1: 1e4 + 1, z1: 1e4 + 1 });
  MAP.bounds = 600;
  TOWN.factionAt = () => 'red';
  return [
    ['The estate: walls, gates, the drive', manorGrounds],
    ['Ravenscroft House', manorHouse],
    ['Inside the house', manorRooms],
    ['Gardens, the maze, the lake', manorGardens],
    ['The gala', manorParty],
    ['Security', manorSecurity],
  ];
}

// ---------------- grounds ----------------
function manorGrounds() {
  const Wl = MANOR.wall;
  // the country road outside the gate, the drive, the forecourt, the garden walks (guests walk these)
  lane('countryRoad', [[-255, 222], [255, 222]], 9, 'alley', { tx: TX.asphalt, col: 0x3a3a3c });
  lane('drive', [[0, 222], [0, 20]], 9, 'avenue', { tx: TX.gravel, col: GRAVEL });
  lane('serviceRoad', [[255, -60], [60, -60]], 6, 'alley', { tx: TX.gravel, col: GRAVEL });
  for (const [n, pts] of [['walkN', [[-44, -84], [44, -84]]], ['walkW', [[-44, -84], [-44, -172]]], ['walkE', [[44, -84], [44, -172]]], ['walkS', [[-44, -172], [44, -172]]], ['walkMid', [[0, -76], [0, -172]]], ['walkLawnW', [[-14, 20], [-120, 20], [-120, 170]]], ['walkLawnE', [[14, 20], [120, 20], [120, 170]]], ['walkLake', [[56, -50], [92, -95]]]])
    lane(n, pts, 3.2, 'alley', { tx: TX.gravel, col: GRAVEL });
  plaza('Forecourt', { x0: -30, z0: -24, x1: 30, z1: 22 }, GRAVEL, TX.gravel);
  plaza('Front lawn', { x0: -118, z0: 26, x1: -12, z1: 168 }, GRASS, TX.leaf);
  plaza('East lawn', { x0: 12, z0: 26, x1: 118, z1: 168 }, GRASS, TX.leaf);
  plaza('Terrace', { x0: -30, z0: -76, x1: 30, z1: -62 }, STONE, TX.stone);
  // everything else inside the walls is lawn; outside, rough grass under the trees
  groundPlate(Wl.x0, Wl.z0, Wl.x1, Wl.z1, GRASS, TX.leaf, 4, 0.03);
  groundPlate(-260, -230, 260, Wl.z0, 0x3e5230, TX.leaf, 6, 0.03); groundPlate(-260, Wl.z1, 260, 245, 0x3e5230, TX.leaf, 6, 0.03);
  groundPlate(-260, Wl.z0, Wl.x0, Wl.z1, 0x3e5230, TX.leaf, 6, 0.03); groundPlate(Wl.x1, Wl.z0, 260, Wl.z1, 0x3e5230, TX.leaf, 6, 0.03);
  fountain(0, 0, 0, 4.2, 1);
  // the wall: stone, coped, with piers every 12 m; gaps for the gates and the fallen stretch
  const gaps = { s: [[-6, 6]], e: [[-66, -54]], w: [[-128, -116]], n: [] };
  const run = (ax, a0, a1, c, key) => {
    let a = a0; const cuts = [...gaps[key]].sort((p, q) => p[0] - q[0]);
    for (const [g0, g1] of [...cuts, [a1, a1]]) { if (g0 > a) wallRun(ax, a, g0, c); a = g1; }
  };
  run('x', Wl.x0, Wl.x1, Wl.z1, 's'); run('x', Wl.x0, Wl.x1, Wl.z0, 'n'); run('z', Wl.z0, Wl.z1, Wl.x1, 'e'); run('z', Wl.z0, Wl.z1, Wl.x0, 'w');
  for (const z of [-128, -116]) { /* the fallen stretch: rubble you can step over */ }
  W.scope({ lod: 1 }, () => { for (let k = 0; k < 26; k++) W.box(mr(0.4, 1.0), mr(0.2, 0.6), mr(0.4, 0.9), Wl.x0 + mr(-2, 2), 0.2, mr(-128, -116), STONE_DK, { t: TX.stone, ry: mr(0, 3) }); });
  // the main gate: stone piers with lamps, iron gates folded back, the gatehouse
  for (const s of [-1, 1]) {
    W.box(1.6, 5.2, 1.6, s * 6.8, 2.6, Wl.z1, STONE, { t: TX.stone }); W.solid(1.6, 5.2, 1.6, s * 6.8, 2.6, Wl.z1, 'stone');
    W.sphere(1.0, 1.0, 1.0, s * 6.8, 5.7, Wl.z1, STONE, { t: TX.stone }); lampPostOld(s * 6.8, 5.2, Wl.z1 + 0.9, 0.6);
    for (let k = 0; k < 9; k++) W.box(0.05, 3.2, 0.05, s * (5.8 - 0.1), 1.6, Wl.z1 - 0.6 - k * 0.65, 0x1a1a1a, { layer: 'metal' });
    W.box(0.08, 0.1, 5.8, s * 5.7, 3.1, Wl.z1 - 3.3, 0x1a1a1a, { layer: 'metal' });
  }
  W.box(5, 3.4, 4.5, -12, 1.7, Wl.z1 - 4, STONE, { t: TX.stone }); W.solid(5, 3.4, 4.5, -12, 1.7, Wl.z1 - 4, 'stone');
  W.pyramid(6, 1.8, 5.5, -12, 4.3, Wl.z1 - 4, SLATE, { t: TX.rooftile }); W.box(1.6, 1.0, 0.05, -9.47, 1.9, Wl.z1 - 4, 0xffd8a0, { layer: 'glow', ry: Math.PI / 2 }); W.lamp(-8, 2.5, Wl.z1 - 4, 0xffd8a0, 2, 8, { halo: 0.4 });
  // service gate: a plain opening with a barrier arm
  W.box(0.2, 1.1, 0.2, Wl.x1 - 0.3, 0.55, -54.5, 0xe8e8e0, { layer: 'metal' }); W.box(0.1, 0.12, 11, Wl.x1 - 0.3, 1.0, -60, 0xd83a2a, { layer: 'metal' });
  // lamps down the drive, guests' cars parked along it
  for (let z = 30; z < 200; z += 16) for (const s of [-1, 1]) { lampPostOld(s * 6, 0, z, 4.2); W.lamp(s * 6, 4, z, 0xffd8a0, 2.4, 12, { halo: 0.7 }); }
  W.scope({ lod: 1 }, () => { for (let z = 46; z < 190; z += 7.5) for (const s of [-1, 1]) if (mchance(0.75)) sedan(s * 9.5, z, s > 0 ? Math.PI / 2 : -Math.PI / 2, mpick([0x141414, 0x1a1a2a, 0xe8e6e0, 0x4a1a1a, 0x8a8e94, 0x2a3a2a])); });
  // the forest round the outside: pines, dark and close
  for (let i = 0; i < 260; i++) {
    const a = mr(0, Math.PI * 2), r = mr(215, 300), x = Math.cos(a) * r * 1.15, z = Math.sin(a) * r;
    if (z > 212 && z < 232 && Math.abs(x) < 250) continue;   // the road
    pine(x, z, mr(9, 16));
  }
  for (let i = 0; i < 70; i++) { const x = mr(-190, 190), z = mr(-190, 190); if (Math.hypot(x, z + 45) < 70 || (Math.abs(x) < 16 && z > -30) || GR.get(x, z) !== GR.FREE) continue; pine(x, z, mr(8, 13)); }
}
function wallRun(ax, a0, a1, c) {
  const L = a1 - a0, m = (a0 + a1) / 2, H = 3.2;
  if (ax === 'x') { W.box(L, H, 0.6, m, H / 2, c, STONE_DK, { t: TX.stone, wear: 4 }); W.solid(L, H, 0.6, m, H / 2, c, 'stone'); W.box(L, 0.18, 0.8, m, H + 0.09, c, STONE, { t: TX.stone }); }
  else { W.box(0.6, H, L, c, H / 2, m, STONE_DK, { t: TX.stone, wear: 4 }); W.solid(0.6, H, L, c, H / 2, m, 'stone'); W.box(0.8, 0.18, L, c, H + 0.09, m, STONE, { t: TX.stone }); }
  for (let a = a0; a <= a1; a += 12) { const [x, z] = ax === 'x' ? [a, c] : [c, a]; W.box(1.0, H + 0.6, 1.0, x, (H + 0.6) / 2, z, STONE, { t: TX.stone, lod: 1 }); }
}
function pine(x, z, h) {
  W.cyl(0.16, 0.24, h * 0.35, x, h * 0.17, z, 0x4a3426, { seg: 6 });
  W.scope({ lod: 1 }, () => { for (let k = 0; k < 3; k++) W.cone(h * (0.28 - k * 0.06), h * 0.42, x, h * (0.38 + k * 0.2), z, mpick([0x24402a, 0x2a4a2e, 0x1e3a26]), { seg: 7, t: TX.leaf }); });
  W.solid(0.5, h * 0.4, 0.5, x, h * 0.2, z, 'wood');
}

// ---------------- the house ----------------
// a pitched roof over a rectangle, ridge along its longer side, gable ends filled
function pitched(x0, z0, x1, z1, y, h, col) {
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, alongX = w >= d, span = alongX ? d : w, L = alongX ? w : d, a = Math.atan2(h, span / 2), sl = Math.hypot(h, span / 2) + 0.6;
  for (const s of [-1, 1]) {
    if (alongX) W.box(L + 0.8, 0.22, sl, cx, y + h / 2, cz + s * span / 4, col, { t: TX.rooftile, wear: 3, rx: s * a });
    else W.box(sl, 0.22, L + 0.8, cx + s * span / 4, y + h / 2, cz, col, { t: TX.rooftile, wear: 3, rz: -s * a });
  }
  // gable triangles
  const tri = [];
  for (const e of [-1, 1]) {
    if (alongX) { const x = cx + e * L / 2; tri.push(x, y, z0, x, y, z1, x, y + h, cz); }
    else { const z = cz + e * L / 2; tri.push(x0, y, z, x1, y, z, cx, y + h, z); }
  }
  W.tris(twoSided(tri), STONE, { t: TX.stone });
}
// a triangle list drawn from both sides
function twoSided(t) { const o = [...t]; for (let i = 0; i < t.length; i += 9) o.push(t[i], t[i + 1], t[i + 2], t[i + 6], t[i + 7], t[i + 8], t[i + 3], t[i + 4], t[i + 5]); return o; }
function manorHouse() {
  const { x0, x1, z0, z1 } = MANOR.house, { H0, H1, T } = MANOR, yR = H0 + H1;
  GR.rect(0, -46, 120, 36, 0, GR.RESERVED, true);
  const archWin = (at) => ({ at, w: 1.5, h: 2.9, sill: 0.5, kind: 'archwin', arch: 'round', _spring: 2.1, win: 'plain', rimCol: STONE, rimTx: TX.stone });
  const win = (at, h = 2.2) => ({ at, w: 1.3, h, sill: 0.9, kind: 'win', win: 'plain', sillCol: STONE });
  W.scope({}, () => {
    // ground floor: the front with the great door, the garden side with French doors onto the terrace
    walls([
      ['x', x0, x1, z1 - T / 2, 1, [{ at: 0, w: 2.4, h: 3.4, kind: 'door', style: 'plank', leaf: 'open' }, ...[-19, -14, -9, -4, 4, 9, 14, 19].map(archWin)]],
      ['x', x0, x1, z0 + T / 2, -1, [DOOR(-3, 1.6, 2.8, { style: 'glass', leaf: 'open' }), DOOR(3, 1.6, 2.8, { style: 'glass', leaf: 'open' }), ...[-19, -14, -9, 9, 14, 19].map(archWin)]],
      ['z', z0 + T, z1 - T, x0 + T / 2, -1, [DOOR(-46, 1.6, 2.6, { style: 'plank', leaf: 'open' }), win(-38), win(-54)]],
      ['z', z0 + T, z1 - T, x1 - T / 2, 1, [DOOR(-46, 1.6, 2.6, { style: 'plank', leaf: 'open' }), win(-38), win(-54)]],
    ], 0, H0, T, STONE, 0xe8dcc8, { tx: TX.stone });
    walls([
      ['x', x0, x1, z1 - T / 2, 1, [-19, -14, -9, -4, 0, 4, 9, 14, 19].map((a) => win(a))],
      ['x', x0, x1, z0 + T / 2, -1, [-19, -14, -9, -4, 0, 4, 9, 14, 19].map((a) => win(a))],
      ['z', z0 + T, z1 - T, x0 + T / 2, -1, [win(-38), win(-54)]],
      ['z', z0 + T, z1 - T, x1 - T / 2, 1, [win(-38), win(-54)]],
    ], H0, H1, T, STONE, 0xe8e0d0, { tx: TX.stone });
    // floors and the grand stair (two flights up the sides of the hall)
    slab(x0 + T, z0 + T, x1 - T, z1 - T, 0.15, { top: 0xd8d4cc, topTx: TX.ceramic, bot: false });
    flight(-6.2, z1 - T - 0.4, [0, -1], 1.8, 0.15, H0, { col: 0xd8d0c0, tx: TX.stone });
    flight(6.2, z1 - T - 0.4, [0, -1], 1.8, 0.15, H0, { col: 0xd8d0c0, tx: TX.stone });
    const run = Math.round((H0 - 0.15) / ST_RISE) * ST_RUN, zTop = z1 - T - 0.4 - run;
    slab(x0 + T, z0 + T, x1 - T, z1 - T, H0, { top: 0x8a5a3a, topTx: TX.wood, bot: 0xf0ece4, holes: [[-7.2, zTop, -5.2, z1 - T], [5.2, zTop, 7.2, z1 - T], [-5.2, zTop + 1.5, 5.2, z1 - T]] });
    railing(-7.2, zTop, -7.2, z1 - T, H0, 'iron'); railing(7.2, zTop, 7.2, z1 - T, H0, 'iron'); railing(-5.2, zTop + 1.5, 5.2, zTop + 1.5, H0, 'iron');
    // roof: cornice, then the slate pitch, chimneys at the ends
    slab(x0 - 0.3, z0 - 0.3, x1 + 0.3, z1 + 0.3, yR, { top: 0x5a5a58, topTx: TX.concrete, bot: 0xf0ece4 });
    W.box(x1 - x0 + 1.2, 0.5, z1 - z0 + 1.2, 0, yR + 0.25, (z0 + z1) / 2, STONE, { t: TX.stone });
    pitched(x0, z0, x1, z1, yR + 0.5, 5.5, SLATE);
    for (const cx of [-18, -6, 6, 18]) { W.box(1.4, 3.4, 1.0, cx, yR + 5.0, (z0 + z1) / 2 + mr(-3, 3), STONE_DK, { t: TX.brick }); W.box(1.6, 0.25, 1.2, cx, yR + 6.8, (z0 + z1) / 2, STONE); }
    // the portico: six columns, a pediment, steps down to the forecourt
    for (const cx of [-9, -5.4, -1.8, 1.8, 5.4, 9]) { W.cyl(0.42, 0.48, yR - 0.4, cx, (yR - 0.4) / 2 + 0.2, z1 + 5, STONE, { seg: 12, t: TX.stone }); W.solid(0.9, yR, 0.9, cx, yR / 2, z1 + 5, 'stone'); W.box(1.2, 0.4, 1.2, cx, 0.2, z1 + 5, STONE); W.box(1.1, 0.4, 1.1, cx, yR - 0.2, z1 + 5, STONE); }
    W.box(21, 0.8, 6.4, 0, yR + 0.2, z1 + 3, STONE, { t: TX.stone });
    W.tris(twoSided([-10.5, yR + 0.6, z1 + 6.2, 10.5, yR + 0.6, z1 + 6.2, 0, yR + 3.6, z1 + 6.2]), STONE, { t: TX.stone });
    pitched(-10.5, z1, 10.5, z1 + 6.2, yR + 0.6, 3.0, SLATE);
    for (let k = 0; k < 4; k++) { W.box(22 - k * 0.6, 0.15, 1.0, 0, 0.075 + k * 0.15 - 0.45, z1 + 7.0 + k * 0.9 - 2.7, STONE, { t: TX.stone }); }
    slab(-11, z1, 11, z1 + 6.8, 0.15, { top: STONE, topTx: TX.stone, bot: false });
    // the terrace behind, with its balustrade and steps to the garden
    slab(-30, z0 - 14, 30, z0, 0.15, { top: STONE, topTx: TX.stone, bot: false });
    balustrade(-30, z0 - 14, -3, z0 - 14); balustrade(3, z0 - 14, 30, z0 - 14); balustrade(-30, z0 - 14, -30, z0); balustrade(30, z0 - 14, 30, z0);
    // the wings: library (west), kitchen and service (east), a storey each under their own roofs
    for (const s of [-1, 1]) {
      const wx0 = s < 0 ? -56 : 24, wx1 = s < 0 ? -24 : 56, wz0 = -58, wz1 = -34, H = 5.0;
      walls([
        ['x', wx0, wx1, wz1 - T / 2, 1, [s * 30, s * 36, s * 42, s * 48].map((a) => archWin(a))],
        ['x', wx0, wx1, wz0 + T / 2, -1, s > 0 ? [DOOR(42, 1.4, 2.4, { style: 'plank', leaf: 'open' }), win(32), win(50)] : [win(-32), win(-40), win(-48)]],
        ['z', wz0 + T, wz1 - T, s < 0 ? wx0 + T / 2 : wx1 - T / 2, s, [win(-40), win(-50)]],
      ], 0, H, T, STONE, 0xe8dcc8, { tx: TX.stone });
      slab(wx0 + T, wz0 + T, wx1 - T, wz1 - T, 0.15, { top: s < 0 ? 0x7a4a2a : 0xd8d8d0, topTx: s < 0 ? TX.wood : TX.ceramic, bot: false });
      slab(wx0 - 0.2, wz0 - 0.2, wx1 + 0.2, wz1 + 0.2, H, { top: 0x5a5a58, topTx: TX.concrete, bot: 0xf0ece4 });
      W.box(wx1 - wx0 + 0.8, 0.4, wz1 - wz0 + 0.8, (wx0 + wx1) / 2, H + 0.2, (wz0 + wz1) / 2, STONE, { t: TX.stone });
      pitched(wx0, wz0, wx1, wz1, H + 0.4, 3.6, SLATE);
    }
  });
  // light in every window at dusk: the rooms are lit (see manorRooms); a warm wash on the façade from lamps in the forecourt
  for (const x of [-16, 0, 16]) W.lamp(x, 1.5, z1 + 12, 0xffd8a0, 2.4, 16, { halo: 0 });
}
function balustrade(xa, za, xb, zb) {
  const L = Math.hypot(xb - xa, zb - za), n = Math.max(2, Math.round(L / 0.45)), y = 0.15;
  W.push((xa + xb) / 2, 0, (za + zb) / 2, Math.atan2(-(zb - za), xb - xa));
  W.box(L, 0.12, 0.42, 0, y + 1.0, 0, STONE, { t: TX.stone }); W.box(L, 0.15, 0.4, 0, y + 0.08, 0, STONE, { t: TX.stone }); W.solid(L, 1.1, 0.4, 0, y + 0.55, 0, 'stone');
  W.scope({ lod: 1 }, () => { for (let i = 0; i <= n; i++) W.cyl(0.07, 0.1, 0.8, -L / 2 + i * L / n, y + 0.55, 0, STONE, { seg: 6 }); });
  W.pop();
}

// ---------------- the rooms ----------------
function manorRooms() {
  const { x0, x1, z0, z1 } = MANOR.house, { H0, H1, T } = MANOR, y1 = H0;
  const sAt = (x, z, yaw, role, route, y = 0) => { TOWN.staff.push({ x, z, y, yaw, role, route }); };
  W.scope({}, () => {
    // ground-floor partitions: hall in the middle (stairs), ballroom west, dining room east
    partition('z', z0 + T, z1 - T, -8, 0.15, H0 - 0.15, [{ at: -40, w: 2.4, h: 3.0, kind: 'door', style: 'plank', leaf: 'open' }, { at: -54, w: 2.4, h: 3.0, kind: 'door', style: 'plank', leaf: 'open' }], 0xf0e6d4);
    partition('z', z0 + T, z1 - T, 8, 0.15, H0 - 0.15, [{ at: -40, w: 2.4, h: 3.0, kind: 'door', style: 'plank', leaf: 'open' }, { at: -54, w: 2.4, h: 3.0, kind: 'door', style: 'plank', leaf: 'open' }], 0xf0e6d4);
    // first floor: the landing in the middle, bedrooms at the front, the security room and the study at the back
    partition('z', z0 + T, z1 - T, -8, y1, H1, [DOOR(-38, 1.0, 2.3, { style: 'plank', leaf: 'open' }), DOOR(-54, 1.0, 2.3, { style: 'plank', leaf: 'open' })], 0xe8e0d0);
    partition('z', z0 + T, z1 - T, 8, y1, H1, [DOOR(-38, 1.0, 2.3, { style: 'plank', leaf: 'open' }), DOOR(-54, 1.0, 2.3, { style: 'plank', leaf: 'open' })], 0xe8e0d0);
    partition('x', x0 + T, -8, -46, y1, H1, [], 0xe8e0d0); partition('x', 8, x1 - T, -46, y1, H1, [], 0xe8e0d0);
  });
  // the hall: black-and-white marble, a round table under the chandelier, portraits up the stairs
  W.scope({ dim: 0.85 }, () => {
    for (let i = 0; i < 16; i++) for (let k = 0; k < 30; k++) if ((i + k) % 2) W.box(1, 0.01, 1, -7.5 + i, 0.16, z0 + 1 + k, 0x1a1a1c, { t: TX.ceramic, lod: 2, ao: false });
    W.cyl(0.9, 0.9, 0.06, 0, 0.95, -46, 0x5a3a24, { seg: 16, t: TX.wood }); W.cyl(0.14, 0.2, 0.8, 0, 0.55, -46, 0x5a3a24, { seg: 8 }); W.solid(1.8, 1.0, 1.8, 0, 0.5, -46, 'wood');
    W.cyl(0.15, 0.1, 0.35, 0, 1.15, -46, 0xe8e8f0, { seg: 10, layer: 'glass' }); for (let k = 0; k < 7; k++) W.sphere(0.12, 0.12, 0.12, mr(-0.15, 0.15), 1.4 + mr(0, 0.25), -46 + mr(-0.15, 0.15), mpick([0xd83a5a, 0xf0f0e8, 0xe8a0b0]), { seg: 6, hseg: 4 });
    chandelier(0, H0 - 0.2, -46, 1.4);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) portrait(s * 7.9, 2.6 + k * 0.5, -34 - k * 2.4, s > 0 ? -Math.PI / 2 : Math.PI / 2);
    floorRug(0, 0.17, -38, 4, 6, 0, 0x6a1a24);
  });
  // the ballroom: parquet, three chandeliers, mirrors, a string quartet on a low stage, the bar
  W.scope({ dim: 0.85 }, () => {
    W.box(15, 0.02, 30, -16, 0.165, -46, 0x9a6a3a, { t: TX.wood });
    for (const z of [-38, -46, -54]) chandelier(-16, H0 - 0.2, z, 1.6);
    for (const z of [-36, -46, -56]) { W.box(0.05, 2.6, 1.4, x0 + T + 0.03, 2.0, z, 0xc8d8e0, { layer: 'glass' }); W.box(0.06, 2.8, 1.6, x0 + T + 0.02, 2.0, z, 0xc8a050, { layer: 'metal' }); }
    W.box(6, 0.4, 3.5, -16, 0.35, z0 + 2.6, 0x5a3a24, { t: TX.wood }); W.solid(6, 0.4, 3.5, -16, 0.35, z0 + 2.6, 'wood');
    for (let k = 0; k < 4; k++) { chairWood(-18.2 + k * 1.5, 0.55, z0 + 2.4); W.box(0.06, 1.0, 0.06, -18.2 + k * 1.5, 1.3, z0 + 3.1, 0x1a1a1a); }
    W.box(1.6, 1.0, 0.7, -11.6, 0.65, z0 + 2.4, 0x141414, { layer: 'metal' }); // the piano
    W.box(5, 1.1, 0.7, -16, 0.7, z1 - 2.2, 0x3a2418, { t: TX.wood }); W.solid(5, 1.1, 0.7, -16, 0.7, z1 - 2.2, 'wood');
    for (let k = 0; k < 14; k++) W.cyl(0.035, 0.035, 0.28, -18.2 + k * 0.32, 1.39, z1 - 2.2, mpick([0x2a6a3a, 0xe8d8a0, 0x6a1a2a]), { seg: 6, layer: 'glass' });
    for (let k = 0; k < 4; k++) { const x = -21 + k * 3.6; W.cyl(0.4, 0.4, 0.04, x, 1.1, -46 + (k % 2 ? 6 : -6), 0xf0f0e8, { seg: 12 }); W.cyl(0.04, 0.04, 1.0, x, 0.6, -46 + (k % 2 ? 6 : -6), 0x8a8a8a); }
  });
  // dining room: the long table laid for sixteen, candelabra, a sideboard
  W.scope({ dim: 0.85 }, () => {
    W.box(2.2, 0.08, 14, 16, 0.95, -46, 0x5a3420, { t: TX.wood }); W.box(2.3, 0.02, 14.1, 16, 1.0, -46, 0xf0ece0); W.solid(2.2, 1.0, 14, 16, 0.5, -46, 'wood');
    for (let k = 0; k < 8; k++) for (const s of [-1, 1]) { chairWood(16 + s * 1.5, 0.15, -52.3 + k * 1.8, s > 0 ? -Math.PI / 2 : Math.PI / 2); W.cyl(0.13, 0.13, 0.02, 16 + s * 0.7, 1.02, -52.3 + k * 1.8, 0xf8f8f0, { seg: 10 }); W.cyl(0.03, 0.03, 0.18, 16 + s * 0.55, 1.1, -52 + k * 1.8, 0xe8e8f0, { seg: 6, layer: 'glass' }); }
    for (const z of [-50, -46, -42]) { W.cyl(0.05, 0.08, 0.5, 16, 1.25, z, 0xc8a050, { seg: 6, layer: 'metal' }); for (const dx of [-0.2, 0, 0.2]) W.sphere(0.05, 0.09, 0.05, 16 + dx, 1.58, z, 0xffd080, { layer: 'glow' }); W.lamp(16, 1.8, z, 0xffc070, 1.2, 5, { halo: 0.3 }); }
    W.box(4, 1.0, 0.6, 16, 0.65, z0 + 1.0, 0x4a2a18, { t: TX.wood }); chandelier(16, H0 - 0.2, -46, 1.2);
  });
  // library (west wing): books floor to ceiling, a fire, leather chairs
  W.scope({ dim: 0.85 }, () => {
    for (let x = -54; x < -27; x += 2.2) { shelfUnit(x, 0.15, -57.0, 0, 2.0, 4.2, 0.4, 0x4a2a18, 'books'); shelfUnit(x, 0.15, -35.0, Math.PI, 2.0, 4.2, 0.4, 0x4a2a18, 'books'); }
    W.box(2.4, 1.6, 0.6, -55.3, 0.95, -46, STONE, { t: TX.stone, ry: Math.PI / 2 }); W.box(1.4, 0.8, 0.3, -55.1, 0.65, -46, 0xff8a30, { layer: 'glow', ry: Math.PI / 2 }); W.lamp(-54.2, 0.9, -46, 0xff9a40, 2.0, 7, { halo: 0.3, flicker: 0.3 });
    for (const [x, z, r] of [[-51, -48, -1.2], [-51, -44, -1.9]]) sofa(x, 0.15, z, r, 0x5a2a1e, 1.0);
    desk(-36, 0.15, -46, Math.PI / 2, 1.8, 0.9, 0x4a2a18); W.lamp(-40, 3.5, -46, 0xffd8a0, 1.6, 10, { halo: 0 });
  });
  // kitchen and service (east wing): ranges, steel counters, the cooks
  W.scope({ dim: 0.9 }, () => {
    for (let x = 28; x < 54; x += 2.6) kitchenRun(x, 0.15, -56.8, 0, 2.4, 0xd8d8d0);
    for (const x of [32, 40, 48]) { W.box(2.4, 0.9, 1.2, x, 0.6, -46, 0xc8ccd0, { layer: 'metal' }); W.solid(2.4, 0.9, 1.2, x, 0.6, -46, 'metal'); W.box(2.2, 0.05, 1.0, x, 1.06, -46, 0xe8e8e8, { layer: 'metal' }); }
    for (const x of [30, 52]) fridge(x, 0.15, -35.4, Math.PI);
    W.lamp(36, 4.2, -46, 0xf0f4ff, 2.2, 12, { halo: 0 }); W.lamp(48, 4.2, -46, 0xf0f4ff, 2.2, 12, { halo: 0 });
  });
  // first floor: bedrooms at the front
  W.scope({ dim: 0.8 }, () => {
    for (const s of [-1, 1]) { const cx = s * 16; bed(cx, y1, -36, Math.PI, s < 0 ? 0x6a2a3a : 0x2a3a5a); wardrobe(cx + s * 5.5, y1, -44.6, 0, 0x5a3a24); floorRug(cx, y1 + 0.02, -38, 3.6, 3, 0, 0x8a6a4a); W.lamp(cx, y1 + 3.2, -38, 0xffd8a0, 1.2, 8, { halo: 0 }); }
    // security room (back west): the monitor wall, two desks
    cctvWall(-16, y1 + 0.3, -61.3, 0, 5, 3); officeDesk(-16, y1, -56.5, Math.PI, 2.4, 'office'); officeDesk(-20, y1, -52, Math.PI / 2, 1.6, 'office');
    for (let k = 0; k < 3; k++) monitor(-17 + k * 1.0, y1 + 0.78, -56.6, Math.PI, 0x4aa0ff);
    W.lamp(-16, y1 + 3.4, -54, 0xcfe0ff, 1.4, 9, { halo: 0 });
    // the study (back east): desk, bookcases, the painting that hides the safe
    desk(16, y1, -52, 0, 2.0, 1.0, 0x3a2014); chairWood(16, y1, -50.8, Math.PI); for (let x = 10; x < 23; x += 2.2) shelfUnit(x, y1, -61.3, 0, 2.0, 2.6, 0.38, 0x3a2014, 'books');
    safe(22.9, y1, -55, -Math.PI / 2); portrait(23.2, y1 + 2.0, -55, -Math.PI / 2, 1.2, 0.9);
    floorRug(16, y1 + 0.02, -54, 4, 3, 0, 0x5a1a1a); W.lamp(16, y1 + 1.4, -52, 0xffd090, 1.4, 6, { halo: 0.3 });
    // the landing: a long gallery of paintings over the hall
    for (let k = 0; k < 5; k++) portrait(-7.9, y1 + 1.8, -40 - k * 4, Math.PI / 2);
    chandelier(0, yRoof() - 0.3, -50, 1.0);
  });
  TOWN.spots.safe = { x: 22.6, y: y1 + 1, z: -55 }; TOWN.spots.study = { x: 16, y: y1, z: -53 };
  TOWN.spots.boathouse = { x: 96, z: -95 }; TOWN.spots.gate = { x: 0, z: 196 }; TOWN.spots.serviceGate = { x: 198, z: -60 };
  TOWN.spots.ballroom = { x: -16, z: -46 }; TOWN.spots.kitchen = { x: 40, z: -46 }; TOWN.spots.security = { x: -16, y: y1, z: -54 };
  // the staff at work and the guests at the party, inside
  sAt(-15, z1 - 1.4, Math.PI, 'bar'); sAt(16, -40, 0, 'food', [[16, -40], [13.4, -52], [13.4, -40, 2], [18.6, -40], [18.6, -52, 2]]);
  for (const [x, z] of [[-19, -40], [-13, -42], [-18, -50], [-13.5, -52], [-20, -45], [-12, -47], [-17, -55], [-14.5, -36]]) sAt(x, z, mr(0, 6.28), 'guest');
  for (const [x, z] of [[-18.2, z0 + 2.4], [-16.7, z0 + 2.4], [-15.2, z0 + 2.4], [-13.7, z0 + 2.4]]) TOWN.staff.push({ x, z, y: 0.55, yaw: Math.PI, role: 'guest' });
  for (const [x, z] of [[34, -44], [40, -48], [46, -44]]) sAt(x, z, mr(0, 6.28), 'food');
  sAt(-3, -44, Math.PI / 2, 'guest'); sAt(3, -48, -Math.PI / 2, 'guest');
}
const yRoof = () => MANOR.H0 + MANOR.H1;
function chandelier(x, y, z, r) {
  W.rod([x, y + 0.2, z], [x, y - 0.4, z], 0.02, 0xc8a050, { layer: 'metal' });
  W.torus(r * 0.5, 0.05, x, y - 0.5, z, 0xc8a050, { layer: 'metal', rx: Math.PI / 2, seg: 16 });
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; W.sphere(0.07, 0.11, 0.07, x + Math.cos(a) * r * 0.5, y - 0.38, z + Math.sin(a) * r * 0.5, 0xffe0a8, { layer: 'glow' }); }
  W.lamp(x, y - 0.7, z, 0xffd8a0, 2.4, 11, { halo: 0.5 });
}
function portrait(x, y, z, ry, w = 0.9, h = 1.15) {
  W.push(x, y, z, ry);
  W.box(w + 0.16, h + 0.16, 0.06, 0, 0, 0.03, 0xb88a3a, { layer: 'metal' }); W.box(w, h, 0.02, 0, 0, 0.07, mpick([0x3a2a20, 0x2a3a2a, 0x4a3020, 0x2a2a3a]), { t: TX.fabric });
  W.sphere(w * 0.32, h * 0.38, 0.02, 0, h * 0.08, 0.08, mpick([0xc89a7a, 0xb8886a]), { seg: 8 });
  W.pop();
}
function chairWood(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(0.46, 0.05, 0.46, 0, 0.46, 0, 0x5a3420, { t: TX.wood }); W.box(0.46, 0.6, 0.05, 0, 0.78, -0.21, 0x5a3420, { t: TX.wood }); W.box(0.4, 0.04, 0.4, 0, 0.5, 0, 0x7a1a2a, { t: TX.fabric });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) W.box(0.04, 0.46, 0.04, sx * 0.2, 0.23, sz * 0.2, 0x4a2a18);
  W.pop();
}

// ---------------- gardens, maze, lake ----------------
function manorGardens() {
  // the formal garden behind the house: parterres of box hedge, gravel, a fountain, statues, a temple at the end
  const hedge = (x, z, w, d, h = 0.7) => { W.box(w, h, d, x, h / 2, z, 0x2a4a24, { t: TX.leaf, wear: 3 }); if (h > 1.2) W.solid(w, h, d, x, h / 2, z, 'cloth'); };
  for (const sx of [-1, 1]) for (const sz of [0, 1]) {
    const cx = sx * 22, cz = -106 - sz * 44;
    hedge(cx, cz - 17, 34, 0.6); hedge(cx, cz + 17, 34, 0.6); hedge(cx - 17, cz, 0.6, 34); hedge(cx + 17, cz, 0.6, 34);
    hedge(cx, cz, 0.5, 20); hedge(cx, cz, 20, 0.5);
    for (const [dx, dz] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) W.box(10, 0.18, 10, cx + dx, 0.09, cz + dz, mpick([0xc83a4a, 0xe8d0e0, 0xd8a030, 0x8a3a8a]), { t: TX.leaf, wear: 6 });
    W.cone(0.8, 2.6, cx + 15, 1.3, cz + 15, 0x2a4a24, { seg: 8, t: TX.leaf }); W.cone(0.8, 2.6, cx - 15, 1.3, cz - 15, 0x2a4a24, { seg: 8, t: TX.leaf });
  }
  fountain(0, 0, -128, 5, 1);
  for (const z of [-96, -116, -140, -160]) for (const s of [-1, 1]) statue(s * 3.4, z, s > 0 ? Math.PI / 2 : -Math.PI / 2);
  // the little temple at the end of the walk
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; W.cyl(0.25, 0.3, 4.2, Math.cos(a) * 3.2, 2.3, -184 + Math.sin(a) * 3.2, STONE, { seg: 10, t: TX.stone }); }
  W.cyl(4, 4, 0.4, 0, 0.2, -184, STONE, { seg: 16, t: TX.stone }); W.solid(8, 0.4, 8, 0, 0.2, -184, 'stone', { walk: true }); W.hemi(7.6, 2.6, 7.6, 0, 4.4, -184, 0x8a9a8a, { seg: 16, hseg: 6, t: TX.stone });
  for (let z = -90; z > -176; z -= 14) for (const s of [-1, 1]) { lampPostOld(s * 4.5, 0, z, 3.6); W.lamp(s * 4.5, 3.4, z, 0xffd8a0, 1.8, 10, { halo: 0.6 }); }
  // the maze: 10 × 10 cells of 7 m, 2.6 m yew, carved out depth-first from the east side
  const MX = -170, MZ = -66, C = 7, N2 = 10, Hh = 2.6;
  const cells = [], seen = new Set(), walls2 = new Set();
  for (let i = 0; i <= N2; i++) for (let j = 0; j < N2; j++) { walls2.add(`v${i},${j}`); walls2.add(`h${j},${i}`); }
  const stack = [[N2 - 1, N2 >> 1]]; seen.add(`${N2 - 1},${N2 >> 1}`);
  while (stack.length) {
    const [i, j] = stack[stack.length - 1], nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([di, dj]) => [i + di, j + dj, di, dj]).filter(([a, b]) => a >= 0 && b >= 0 && a < N2 && b < N2 && !seen.has(`${a},${b}`));
    if (!nb.length) { stack.pop(); continue; }
    const [a, b, di, dj] = nb[(mrand() * nb.length) | 0];
    if (di) walls2.delete(`v${Math.max(i, a)},${j}`); else walls2.delete(`h${i},${Math.max(j, b)}`);
    seen.add(`${a},${b}`); stack.push([a, b]);
  }
  walls2.delete(`v${N2},${N2 >> 1}`);   // the way in, from the lawn side
  for (const k of walls2) {
    const vert = k[0] === 'v', [p, q] = k.slice(1).split(',').map(Number);
    if (vert) hedge(MX + p * C, MZ + (q + 0.5) * C, 1.0, C + 1, Hh); else hedge(MX + (p + 0.5) * C, MZ + q * C, C + 1, 1.0, Hh);
  }
  statue(MX + 5 * C, MZ + 5 * C, 0); W.lamp(MX + 5 * C, 3, MZ + 5 * C, 0xffd8a0, 1.6, 10, { halo: 0.5 });
  GR.rect(MX + 35, MZ + 35, 72, 72, 0, GR.RESERVED, true);
  // the lake: lowered ground, still dark water, reeds, the boathouse on its jetty
  const L = { x0: 92, z0: -150, x1: 176, z1: -36 };
  flat(L.x0 + 6, L.z0 + 6, L.x1 - 6, L.z1 - 6, -2.6, 9); GR.rect((L.x0 + L.x1) / 2, (L.z0 + L.z1) / 2, L.x1 - L.x0, L.z1 - L.z0, 0, GR.WALL, true);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(L.x1 - L.x0, L.z1 - L.z0), new THREE.MeshStandardMaterial({ color: 0x1a2a34, roughness: 0.08, metalness: 0.7 }));
  water.rotation.x = -Math.PI / 2; water.position.set((L.x0 + L.x1) / 2, -0.9, (L.z0 + L.z1) / 2); scene.add(water);
  for (let i = 0; i < 90; i++) { const a = mr(0, 6.28), x = (L.x0 + L.x1) / 2 + Math.cos(a) * (L.x1 - L.x0) * 0.47, z = (L.z0 + L.z1) / 2 + Math.sin(a) * (L.z1 - L.z0) * 0.47; for (let k = 0; k < 4; k++) W.box(0.04, mr(0.8, 1.6), 0.04, x + mr(-0.5, 0.5), 0.2, z + mr(-0.5, 0.5), 0x5a6a34, { lod: 1, rz: mr(-0.2, 0.2) }); }
  // boathouse: timber on stilts, a jetty, the boats (your way out)
  const bx = 96, bz = -95;
  W.box(9, 4, 7, bx + 4.5, 2.4, bz, 0x5a4030, { t: TX.wood, wear: 4 }); W.solid(9, 4, 7, bx + 4.5, 2.4, bz, 'wood');
  W.box(1.2, 2.2, 0.06, bx - 0.02, 1.5, bz, 0x3a2a1e, { ry: Math.PI / 2, t: TX.wood }); W.box(1.6, 1.0, 0.04, bx + 9.03, 2.8, bz, 0xffd8a0, { layer: 'glow', ry: Math.PI / 2 });
  pitched(bx, bz - 3.5, bx + 9, bz + 3.5, 4.4, 2.2, 0x3a3a34);
  W.box(14, 0.2, 2.4, bx + 16, 0.25, bz - 5, 0x6a5038, { t: TX.wood }); W.solid(14, 0.3, 2.4, bx + 16, 0.2, bz - 5, 'wood', { walk: true });
  for (let x = bx + 10; x < bx + 23; x += 2.5) for (const s of [-1, 1]) W.cyl(0.1, 0.1, 2.4, x, -0.9, bz - 5 + s * 1.1, 0x4a3a2a, { seg: 6 });
  W.scope({ lod: 1 }, () => { fishingBoat(bx + 16, bz - 1.5, Math.PI / 2, 4.5, { y: -0.75 }); fishingBoat(bx + 16, bz - 8.5, Math.PI / 2, 4.5, { y: -0.75 }); });
  lampPostOld(bx + 22, 0.3, bz - 4, 2.8); W.lamp(bx + 22, 2.8, bz - 4, 0xffd8a0, 2, 10, { halo: 0.6 });
  // garages and the helipad
  W.box(44, 5, 12, -128, 2.5, 106, STONE, { t: TX.stone }); W.solid(44, 5, 12, -128, 2.5, 106, 'stone'); pitched(-150, 100, -106, 112, 5, 2.8, SLATE);
  for (let k = 0; k < 5; k++) W.box(5.6, 3.4, 0.08, -146 + k * 9, 1.7, 112.04, mpick([0x2a3a2a, 0x3a3a3a]), { layer: 'metal', t: TX.corrugated });
  W.scope({ lod: 1 }, () => { for (let k = 0; k < 4; k++) sedan(-141 + k * 9, 120, Math.PI / 2, mpick([0x141414, 0x8a1a1a, 0xe8e6e0, 0x1a2a4a])); });
  W.cyl(11, 11, 0.12, 128, 0.07, 116, 0x4a4a4c, { seg: 24, t: TX.concrete }); W.box(1.2, 0.02, 7, 125, 0.14, 116, 0xf0f0e8, { ao: false }); W.box(1.2, 0.02, 7, 131, 0.14, 116, 0xf0f0e8, { ao: false }); W.box(4.8, 0.02, 1.2, 128, 0.14, 116, 0xf0f0e8, { ao: false });
  helicopter(128, 116, 0.6);
}
function statue(x, z, ry) {
  W.box(1.2, 1.4, 1.2, x, 0.7, z, STONE, { t: TX.stone }); W.solid(1.2, 1.4, 1.2, x, 0.7, z, 'stone');
  W.push(x, 1.4, z, ry);
  W.cyl(0.22, 0.3, 1.0, 0, 0.5, 0, 0xe8e4dc, { seg: 8, t: TX.stone }); W.cyl(0.24, 0.2, 0.7, 0, 1.3, 0, 0xe8e4dc, { seg: 8, t: TX.stone }); W.sphere(0.24, 0.3, 0.26, 0, 1.85, 0, 0xe8e4dc, { t: TX.stone });
  W.rod([0.2, 1.5, 0], [0.5, 1.9, 0.2], 0.07, 0xe8e4dc); W.rod([-0.2, 1.5, 0], [-0.35, 1.0, 0.15], 0.07, 0xe8e4dc);
  W.pop();
}
function helicopter(x, z, ry) {
  W.push(x, 0, z, ry);
  W.box(5.2, 2.0, 2.2, 0, 1.6, 0, 0x1a1a1e, { layer: 'metal' }); W.box(2.0, 1.2, 2.0, 2.0, 1.9, 0, 0x2a3a4a, { layer: 'glass' });
  W.box(6, 0.5, 0.5, -5, 2.0, 0, 0x1a1a1e, { layer: 'metal' }); W.box(0.2, 1.4, 0.1, -7.8, 2.4, 0, 0x1a1a1e, { layer: 'metal' });
  for (const s of [-1, 1]) W.box(4.6, 0.1, 0.1, 0, 0.3, s * 1.1, 0x5a5a5a, { layer: 'metal' });
  W.cyl(0.2, 0.2, 0.5, 0, 2.85, 0, 0x2a2a2a, { layer: 'metal' }); for (let k = 0; k < 4; k++) W.box(10, 0.04, 0.32, 0, 3.12, 0, 0x2a2a2a, { layer: 'metal', ry: k * Math.PI / 4 });
  W.pop(); W.solid(5.4, 2.6, 2.4, x, 1.3, z, 'metal', { ry });
}

// ---------------- the gala: the marquee, bars, strings of lights ----------------
function manorParty() {
  const mx = 64, mz = 56;
  W.box(28, 0.1, 18, mx, 0.08, mz, 0xd8c8a8, { t: TX.wood });
  for (const sx of [-1, 1]) for (let k = 0; k <= 4; k++) W.cyl(0.08, 0.08, 4, mx + sx * 14, 2, mz - 9 + k * 4.5, 0xf0f0e8, { seg: 6 });
  for (const sz of [-1, 1]) W.box(28.4, 0.1, 9.6, mx, 4.9, mz + sz * 4.6, 0xf4f2ea, { layer: 'cloth', rx: sz * 0.22, t: TX.fabric });
  for (const sx of [-1, 1]) W.box(0.05, 1.0, 18, mx + sx * 14.1, 3.6, mz, 0xf4f2ea, { layer: 'cloth', t: TX.fabric });
  for (let k = 0; k < 6; k++) { W.rod([mx - 13, 4.6, mz - 7 + k * 2.8], [mx + 13, 4.6, mz - 7 + k * 2.8], 0.004, 0x1a1a1a); for (let i = 0; i < 12; i++) W.sphere(0.06, 0.08, 0.06, mx - 12 + i * 2.2, 4.5, mz - 7 + k * 2.8, 0xffe0a0, { layer: 'glow', seg: 5, hseg: 3 }); }
  for (const [x, z] of [[mx - 6, mz - 3], [mx, mz - 3], [mx + 6, mz - 3]]) W.lamp(x, 4.2, z, 0xffd8a0, 2.2, 12, { halo: 0.3 });
  W.box(8, 1.1, 0.8, mx, 0.6, mz - 7.6, 0xf0ece0); W.solid(8, 1.1, 0.8, mx, 0.6, mz - 7.6, 'cloth');
  for (let k = 0; k < 20; k++) W.cyl(0.035, 0.035, 0.28, mx - 3.6 + k * 0.38, 1.3, mz - 7.6, mpick([0x2a6a3a, 0xe8d8a0, 0x6a1a2a, 0xe8e8f0]), { seg: 6, layer: 'glass' });
  for (let k = 0; k < 8; k++) { const x = mx - 10 + (k % 4) * 6.5, z = mz + (k < 4 ? 1 : 6); W.cyl(0.4, 0.4, 0.04, x, 1.1, z, 0xf0f0e8, { seg: 12 }); W.cyl(0.04, 0.04, 1.0, x, 0.6, z, 0x8a8a8a); W.cyl(0.03, 0.03, 0.2, x + 0.1, 1.22, z, 0xe8e8f0, { seg: 6, layer: 'glass' }); }
  TOWN.staff.push({ x: mx, z: mz - 8.4, y: 0, yaw: Math.PI, role: 'bar' }, { x: mx - 3, z: mz - 8.4, y: 0, yaw: Math.PI, role: 'bar' });
  TOWN.staff.push({ x: mx - 9, z: mz + 3, y: 0, yaw: 0, role: 'food', route: [[mx - 9, mz + 3], [mx + 9, mz + 3, 2], [mx + 9, mz - 4], [mx - 9, mz - 4, 2]] });
  for (let k = 0; k < 10; k++) TOWN.staff.push({ x: mx - 10 + (k % 5) * 5 + mr(-1, 1), z: mz - 2 + (k < 5 ? 0 : 7) + mr(-1, 1), y: 0, yaw: mr(0, 6.28), role: 'guest' });
  // strings of bulbs across the forecourt and the front of the house
  for (let k = 0; k < 5; k++) for (const sx of [-1, 1]) { W.cyl(0.06, 0.08, 4.7, sx * 26.2, 2.35, -18 + k * 8, 0x2a2a2a, { seg: 6, layer: 'metal' }); W.solid(0.3, 4.7, 0.3, sx * 26.2, 2.35, -18 + k * 8, 'metal'); }
  for (let k = 0; k < 5; k++) { const z = -18 + k * 8; W.cable([-26, 4.5, z], [26, 4.5, z], 0.8, 0.006, 0x1a1a1a, 10); for (let i = 0; i < 14; i++) { const t = i / 13; W.sphere(0.06, 0.08, 0.06, -26 + t * 52, 4.4 - Math.sin(t * Math.PI) * 0.8, z, 0xffe0a0, { layer: 'glow', seg: 5, hseg: 3 }); } }
  for (const [x, z] of [[-12, 4], [12, 4], [0, -14]]) W.lamp(x, 3.8, z, 0xffd8a0, 2.0, 12, { halo: 0.3 });
}

// ---------------- security: posts all round, the house's upper floor off limits ----------------
function manorSecurity() {
  const post = (x, z, yaw) => TOWN.guards.push({ x, z, yaw, team: 'red' });
  // the main gate and the drive
  post(-4, 196, 0); post(4, 196, 0); post(-11, 190, 0.4); post(0, 120, Math.PI); post(-8, 60, -1.2); post(8, 30, 1.2);
  // the house: front door, garden doors, service door, the wings' corners
  post(-3, -21, Math.PI); post(3, -21, Math.PI); post(-6, -78, 0); post(6, -78, 0); post(42, -62, 0); post(-60, -46, -Math.PI / 2); post(60, -46, Math.PI / 2);
  // inside: the hall, the landing, the security room, the study door
  TOWN.guards.push({ x: 0, z: -40, yaw: Math.PI, team: 'red' }, { x: -16, z: -34, yaw: Math.PI, team: 'red' }, { x: 16, z: -34, yaw: Math.PI, team: 'red' });
  // the gardens, the maze mouth, the lake, the boathouse, the garages, the helipad, the service gate, the fallen wall
  post(-20, -128, Math.PI / 2); post(20, -150, -Math.PI / 2); post(0, -176, 0); post(-96, -31, -Math.PI / 2); post(84, -70, Math.PI / 2); post(100, -110, Math.PI);
  post(-110, 96, Math.PI); post(-130, 128, 0); post(118, 104, 0.6); post(190, -56, -Math.PI / 2); post(186, -66, -Math.PI / 2); post(-186, -122, Math.PI / 2);
  // where a guest has no business: the upper floor of the house, the security room, the kitchen yard
  TOWN.restricted.push({ x0: -24, z0: -62, x1: 24, z1: -30, y0: 3 }, { x0: 24, z0: -66, x1: 60, z1: -56 });
  const H = MANOR.house; GR.rect((H.x0 + H.x1) / 2, (H.z0 + H.z1) / 2, H.x1 - H.x0, H.z1 - H.z0, 0, GR.RESERVED, true);
}
