// =====================================================================
//  CASE 03 — RAVENSCROFT: a walled estate on the night of a gala
// =====================================================================
// A three-part house (central block over two floors, two single-storey wings) at the top of a long
// gravel drive; lawns with a marquee where the guests drink, formal gardens behind, a hedge maze to the
// west, a lake with a boathouse to the east, garages, a helipad. A stone wall all round: the main gate
// (checked), a service gate, and one stretch the winter brought down. Private security everywhere.
const MANOR = { house: { x0: -72, x1: 72, z0: -66, z1: 10 }, H0: 5.0, H1: 4.5, T: 0.5, wall: { x0: -200, x1: 200, z0: -200, z1: 200 } };
// the lake (east of the gardens): the lawn stops at its stone edge; the boathouse stands on the west shore
const LAKE = { x0: 101, z0: -150, x1: 176, z1: -36 };
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
    ['Ravenscroft House: the main block, the wings, ninety rooms', manorBigHouse],
    ['The estate: lodge, stables, orangery, kitchen garden, car parks', manorEstate],
    ['Gardens, the maze, the lake', manorGardens],
    ['The gala', manorParty],
    ['Security', manorSecurity],
    ['Behind the doors', manorInteriors],
  ];
}

// ---------------- grounds ----------------
function manorGrounds() {
  const Wl = MANOR.wall;
  // the country road outside the gate, the drive, the forecourt, the garden walks (guests walk these)
  lane('countryRoad', [[-255, 222], [255, 222]], 9, 'alley', { tx: TX.asphalt, col: 0x3a3a3c });
  lane('drive', [[0, 222], [0, 24]], 9, 'avenue', { tx: TX.gravel, col: GRAVEL });
  lane('serviceRoad', [[255, -20], [78, -20]], 6, 'alley', { tx: TX.gravel, col: GRAVEL });
  for (const [n, pts] of [['walkN', [[-44, -84], [44, -84]]], ['walkW', [[-44, -84], [-44, -172]]], ['walkE', [[44, -84], [44, -172]]], ['walkS', [[-44, -172], [44, -172]]], ['walkMid', [[0, -76], [0, -172]]], ['walkLawnW', [[-14, 20], [-120, 20], [-120, 170]]], ['walkLawnE', [[14, 20], [120, 20], [120, 170]]], ['walkLake', [[76, -72], [92, -95]]]])
    lane(n, pts, 3.2, 'alley', { tx: TX.gravel, col: GRAVEL });
  plaza('Forecourt', { x0: -49, z0: -31, x1: 49, z1: 24 }, GRAVEL, TX.gravel);
  plaza('Front lawn', { x0: -96, z0: 30, x1: -14, z1: 168 }, GRASS, TX.leaf);
  plaza('East lawn', { x0: 14, z0: 30, x1: 96, z1: 140 }, GRASS, TX.leaf);
  plaza('Terrace', { x0: -50, z0: -80, x1: 50, z1: -66 }, STONE, TX.stone);
  // everything else inside the walls is lawn; outside, rough grass under the trees
  groundPlate(Wl.x0, Wl.z0, Wl.x1, Wl.z1, GRASS, TX.leaf, 4, 0.03, null, LAKE);
  groundPlate(-260, -230, 260, Wl.z0, 0x3e5230, TX.leaf, 6, 0.03); groundPlate(-260, Wl.z1, 260, 245, 0x3e5230, TX.leaf, 6, 0.03);
  groundPlate(-260, Wl.z0, Wl.x0, Wl.z1, 0x3e5230, TX.leaf, 6, 0.03); groundPlate(Wl.x1, Wl.z0, 260, Wl.z1, 0x3e5230, TX.leaf, 6, 0.03);
  fountain(0, 0, -6, 5.2, 1);
  for (const [x, z] of [[-40, -24], [40, -24], [-40, 2], [40, 2], [-20, -14], [20, -14]]) { W.cone(1.1, 3.4, x, 1.7, z, 0x2a4a24, { seg: 8, t: TX.leaf }); W.cyl(0.9, 0.7, 0.8, x, 0.4, z, STONE, { seg: 8 }); }
  // the wall: stone, coped, with piers every 12 m; gaps for the gates and the fallen stretch
  const gaps = { s: [[-6, 6]], e: [[-26, -14]], w: [[-128, -116]], n: [] };
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
  W.box(0.2, 1.1, 0.2, Wl.x1 - 0.3, 0.55, -14.5, 0xe8e8e0, { layer: 'metal' }); W.box(0.1, 0.12, 11, Wl.x1 - 0.3, 1.0, -20, 0xd83a2a, { layer: 'metal' });
  W.box(3, 2.8, 3, Wl.x1 - 4, 1.4, -10, 0xe8e4dc, { t: TX.plaster }); W.solid(3, 2.8, 3, Wl.x1 - 4, 1.4, -10, 'concrete'); W.box(3.4, 0.2, 3.4, Wl.x1 - 4, 2.9, -10, 0x3a3a3c); W.box(1.4, 0.8, 0.04, Wl.x1 - 5.52, 1.6, -10, 0xd8e8f0, { layer: 'glow', ry: Math.PI / 2 });
  // lamps down the drive, guests' cars parked along it
  for (let z = 30; z < 200; z += 16) for (const s of [-1, 1]) { lampPostOld(s * 6, 0, z, 4.2); W.lamp(s * 6, 4, z, 0xffd8a0, 2.4, 12, { halo: 0.7 }); }
  // an avenue of limes down both sides of the drive, box hedges at their feet
  for (let z = 38; z < 196; z += 16) for (const s of [-1, 1]) { tree(s * 11, 0, z, 'ficus', 1.25); W.box(0.8, 0.7, 14, s * 8, 0.35, z + 8, 0x2a4a24, { t: TX.leaf, lod: 1 }); }
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
function balustrade(xa, za, xb, zb) {
  const L = Math.hypot(xb - xa, zb - za), n = Math.max(2, Math.round(L / 0.45)), y = 0.15;
  W.push((xa + xb) / 2, 0, (za + zb) / 2, Math.atan2(-(zb - za), xb - xa));
  W.box(L, 0.12, 0.42, 0, y + 1.0, 0, STONE, { t: TX.stone }); W.box(L, 0.15, 0.4, 0, y + 0.08, 0, STONE, { t: TX.stone }); W.solid(L, 1.1, 0.4, 0, y + 0.55, 0, 'stone');
  W.scope({ lod: 1 }, () => { for (let i = 0; i <= n; i++) W.cyl(0.07, 0.1, 0.8, -L / 2 + i * L / n, y + 0.55, 0, STONE, { seg: 6 }); });
  W.pop();
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
  const L = LAKE;
  flat(L.x0 + 3, L.z0 + 3, L.x1 - 3, L.z1 - 3, -2.6, 3);   // the bed drops away inside the kerb, never under the lawn GR.rect((L.x0 + L.x1) / 2, (L.z0 + L.z1) / 2, L.x1 - L.x0, L.z1 - L.z0, 0, GR.WALL, true);
  // the water stands just below the lawn, up to a stone kerb all round; a low invisible rail on the kerb keeps you
  // out of it (except onto the jetty, by the boathouse)
  const water = new THREE.Mesh(new THREE.PlaneGeometry(L.x1 - L.x0, L.z1 - L.z0), new THREE.MeshStandardMaterial({ color: 0x1a2a34, roughness: 0.08, metalness: 0.7 }));
  water.rotation.x = -Math.PI / 2; water.position.set((L.x0 + L.x1) / 2, -0.15, (L.z0 + L.z1) / 2); scene.add(water);
  const kerb = (ax, az, bx, bz) => { const cx = (ax + bx) / 2, cz = (az + bz) / 2, w = Math.abs(bx - ax) + 0.9, d = Math.abs(bz - az) + 0.9; W.box(w, 0.3, d, cx, -0.03, cz, STONE, { t: TX.stone, wear: 4 }); W.solid(w, 1.3, d, cx, 0.65, cz, 'stone'); };
  kerb(L.x0, L.z0, L.x1, L.z0); kerb(L.x0, L.z1, L.x1, L.z1); kerb(L.x1, L.z0, L.x1, L.z1);
  kerb(L.x0, L.z0, L.x0, -101.6); kerb(L.x0, -98.4, L.x0, L.z1);   // the gap: the jetty
  for (let i = 0; i < 90; i++) { const a = mr(0, 6.28), x = (L.x0 + L.x1) / 2 + Math.cos(a) * (L.x1 - L.x0) * 0.47, z = (L.z0 + L.z1) / 2 + Math.sin(a) * (L.z1 - L.z0) * 0.47; for (let k = 0; k < 4; k++) W.box(0.04, mr(0.8, 1.6), 0.04, x + mr(-0.5, 0.5), 0.2, z + mr(-0.5, 0.5), 0x5a6a34, { lod: 1, rz: mr(-0.2, 0.2) }); }
  // boathouse: timber on stilts, a jetty, the boats (your way out)
  const bx = 96, bz = -95;
  W.box(9, 4, 7, bx + 4.5, 2.4, bz, 0x5a4030, { t: TX.wood, wear: 4 }); W.solid(9, 6.6, 7, bx + 4.5, 1.1, bz, 'wood');   // solid to the lake bed: nothing gets under it
  W.box(9.3, 1.6, 7.3, bx + 4.5, -0.4, bz, STONE_DK, { t: TX.stone, wear: 5 });   // its stone footing, half in the water
  W.box(1.2, 2.2, 0.06, bx - 0.02, 1.5, bz, 0x3a2a1e, { ry: Math.PI / 2, t: TX.wood }); W.box(1.6, 1.0, 0.04, bx + 9.03, 2.8, bz, 0xffd8a0, { layer: 'glow', ry: Math.PI / 2 });
  pitched(bx, bz - 3.5, bx + 9, bz + 3.5, 4.4, 2.2, 0x3a3a34);
  // the jetty runs out from the shore beside the boathouse
  W.box(20, 0.2, 2.4, bx + 13, 0.25, bz - 5, 0x6a5038, { t: TX.wood }); W.solid(20, 0.3, 2.4, bx + 13, 0.2, bz - 5, 'wood', { walk: true });
  for (let x = bx + 6; x < bx + 23; x += 2.5) for (const s of [-1, 1]) W.cyl(0.1, 0.1, 2.4, x, -0.9, bz - 5 + s * 1.1, 0x4a3a2a, { seg: 6 });
  W.scope({ lod: 1 }, () => { fishingBoat(bx + 16, bz - 1.5, Math.PI / 2, 4.5, { y: -0.3 }); fishingBoat(bx + 16, bz - 8.5, Math.PI / 2, 4.5, { y: -0.3 }); });
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
  post(-4, -22, Math.PI); post(4, -22, Math.PI); post(-6, -78, 0); post(6, -78, 0); post(-26, -78, 0); post(26, -78, 0); post(-75, -22, -Math.PI / 2); post(75, -22, Math.PI / 2); post(-61, 13, Math.PI); post(61, 13, Math.PI); post(-46, 6, Math.PI / 2); post(46, 6, -Math.PI / 2);
  // inside: the hall, the landing, the security room, the study door
  TOWN.guards.push(...[[0, -40, Math.PI], [-25, -36, Math.PI], [20, -36, Math.PI], [-30, -48.5, -Math.PI / 2], [30, -48.5, Math.PI / 2], [-61, -20, 0], [61, -20, 0]].map(([x, z, yaw]) => ({ x, z, yaw, team: 'red' })));
  // the gardens, the maze mouth, the lake, the boathouse, the garages, the helipad, the service gate, the fallen wall
  post(-20, -128, Math.PI / 2); post(20, -150, -Math.PI / 2); post(0, -176, 0); post(-96, -31, -Math.PI / 2); post(84, -70, Math.PI / 2); post(100, -110, Math.PI);
  post(-110, 96, Math.PI); post(-130, 128, 0); post(118, 104, 0.6); post(190, -16, -Math.PI / 2); post(186, -26, -Math.PI / 2); post(-128, 60, 0); post(130, 40, 0); post(-80, -112, 0); post(-186, -122, Math.PI / 2);
  // where a guest has no business: the upper floor of the house, the security room, the kitchen yard
  TOWN.restricted.push({ x0: -72, z0: -66, x1: 72, z1: 10, y0: 3 }, { x0: 50, z0: -66, x1: 72, z1: 10 }, { x0: 76, z0: -36, x1: 112, z1: -4 });
}
