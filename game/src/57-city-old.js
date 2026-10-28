// =====================================================================
//  CITY — the old city: walled medina, Mellah quarter, grand market & souks, civic plaza
// =====================================================================
function pip(poly, x, z) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
function polyDist(poly, x, z) { let d = Infinity; for (let i = 0; i < poly.length - 1; i++) { const [ax, az] = poly[i], [bx, bz] = poly[i + 1], dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1); d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return d; }
// organic street: a random walk that stops when it meets another street (or leaves the region)
function walkStreet(x, z, ang, len, w, inside, kind, o = {}) {
  const pts = [[x, z]], step = o.step ?? 7, turn = o.turn ?? 0.32;
  let a = ang, joined = false;
  for (let s = 0; s < len; s += step) {
    a += mr(-turn, turn);
    const nx = x + Math.cos(a) * step, nz = z + Math.sin(a) * step;
    if (!inside(nx, nz)) break;
    // look ahead: meet an existing street → run straight into it and stop
    if (s > 8) for (let k = 3; k <= 10; k += 1.5) { const ax = nx + Math.cos(a) * k, az = nz + Math.sin(a) * k; const v = GR.get(ax, az); if (v === GR.STREET || v === GR.PAVE) { pts.push([nx, nz], [ax, az]); joined = true; break; } }
    if (joined) break;
    // too close alongside another street → stop (a dead-end derb)
    let crowd = false;
    for (const sgn of [-1, 1]) { const px = nx - Math.sin(a) * sgn * (w / 2 + 5), pz = nz + Math.cos(a) * sgn * (w / 2 + 5); const v = GR.get(px, pz); if (s > 10 && (v === GR.STREET)) crowd = true; }
    const v0 = GR.get(nx, nz);
    if (v0 === GR.BUILT || v0 === GR.RESERVED || v0 === GR.WALL) break;
    pts.push([nx, nz]); x = nx; z = nz;
    if (crowd) break;
  }
  if (pts.length < 3) return null;
  return addStreet(pts, w, kind, { raw: false, district: o.district, joined });
}
// branch side streets off a street every gap metres
function branches(st, o) {
  const out = [];
  for (let s = o.start ?? 15; s < st.len - 10; s += mr(o.gapMin, o.gapMax)) {
    const p = pathAt(st.pts, s), side = mchance(0.5) ? 1 : -1;
    const nx = -p.tz * side, nz = p.tx * side, ang = Math.atan2(nz, nx) + mr(-0.45, 0.45);
    const sx = p.x + nx * (st.w / 2 + 0.5), sz = p.z + nz * (st.w / 2 + 0.5);
    if (GR.get(sx + nx * 4, sz + nz * 4) !== GR.FREE) continue;
    const ns = walkStreet(sx, sz, ang, mr(o.lenMin, o.lenMax), mr(o.wMin, o.wMax), o.inside, o.kind, { district: o.district, turn: o.turn });
    if (ns) out.push(ns);
  }
  return out;
}
// small square: a paved disc kept free of buildings
function reserveSquare(x, z, r) { GR.street([[x, z], [x + 0.01, z]], r * 2, GR.PAVE); }
// covered souk roof: timber lattice on beams spanning the lane (casts striped sunlight)
function soukRoof(st, y = 4.6) {
  W.scope({ lod: 1 }, () => {
    for (let s = 1; s < st.len - 1; s += 0.62) {
      const p = pathAt(st.pts, s), ry = Math.atan2(-p.tz, p.tx);
      if (GR.get(p.x, p.z) !== GR.STREET) continue;
      W.box(0.09, 0.07, st.w + 1.2, p.x, y + 0.25, p.z, mpick([0xb08a5a, 0x9a7448, 0xc09a68]), { ry, t: TX.wood, wear: 5, jit: 0.1 });
      if (Math.floor(s / 0.62) % 9 === 0) { W.box(0.22, 0.24, st.w + 1.6, p.x, y, p.z, MC.cedarDk, { ry, t: TX.wood }); W.solid(0.22, 0.24, st.w + 1.6, p.x, y, p.z, 'wood', { ry }); }
    }
    for (const sd of [-1, 1]) for (let s = 1; s < st.len - 1; s += 3) { const p = pathAt(st.pts, s), q = pathAt(st.pts, Math.min(st.len - 0.5, s + 3)), n = [-p.tz * sd, p.tx * sd], m = [-q.tz * sd, q.tx * sd], r = st.w / 2 + 0.3; W.rod([p.x + n[0] * r, y + 0.12, p.z + n[1] * r], [q.x + m[0] * r, y + 0.12, q.z + m[1] * r], 0.08, MC.cedarDk, { seg: 6 }); }
  });
  // lanterns every ~9 m
  for (let s = 4; s < st.len - 2; s += 9) { const p = pathAt(st.pts, s); if (GR.get(p.x, p.z) === GR.STREET) hangLantern(p.x, y, p.z, 0xffc070, 0.7, Math.floor(s / 9) % 2 === 0); }
}
// fabric canopies and cables strung across a lane
function laneOverhead(st, o = {}) {
  for (let s = mr(4, 12); s < st.len - 4; s += mr(o.every ?? 14, (o.every ?? 14) * 2)) { const p = pathAt(st.pts, s); W.defer(() => laneOverheadAt(st, p), 'mid', [p.x, p.z]); }
}
function laneOverheadAt(st, p) {
  W.scope({ lod: 1 }, () => {
    {
      const n = [-p.tz, p.tx], r = st.w / 2 + 0.2, y = mr(3.6, 5.5);
      const a = [p.x + n[0] * r, y, p.z + n[1] * r], b = [p.x - n[0] * r, y + mr(-0.4, 0.4), p.z - n[1] * r];
      if (GR.get(a[0] + n[0] * 0.8, a[2] + n[1] * 0.8) !== GR.BUILT || GR.get(b[0] - n[0] * 0.8, b[2] - n[1] * 0.8) !== GR.BUILT) return;
      const k = mrand();
      if (k < 0.4) { const len = mr(2, 4), col = mpick([0xb03a2e, 0xd8b06a, 0xe8dcc0, 0x7a2a4a, 0x2a5a8a]); W.box(st.w + 0.4, 0.02, len, p.x, y + 0.2, p.z, col, { ry: Math.atan2(-p.tz, p.tx) + Math.PI / 2, layer: 'cloth', t: TX.fabric, wear: mchance(0.5) ? 5 : 1, rz: mr(-0.05, 0.05) }); }
      else if (k < 0.75) W.cable(a, b, mr(0.2, 0.6), 0.008, 0x1a1a1a, 8);
      else laundryLine(a[0], a[1], a[2], b[0], b[1], b[2], Math.round(st.w / 0.7));
    }
  });
}
// covered passage (sabat): a room bridging an alley between two houses
function sabat(st, s, len = 4) {
  const p = pathAt(st.pts, s), n = [-p.tz, p.tx], r = st.w / 2 + 1.0;
  if (GR.get(p.x + n[0] * r, p.z + n[1] * r) !== GR.BUILT || GR.get(p.x - n[0] * r, p.z - n[1] * r) !== GR.BUILT) return false;
  const ry = Math.atan2(-p.tz, p.tx), col = mpick([MC.ochre, MC.rose, MC.plaster, MC.cream]);
  W.push(p.x, 0, p.z, ry);
  W.box(len, 2.8, st.w + 1.6, 0, 3.4 + 1.4, 0, col, { t: TX.plaster, wear: 4 }); W.solid(len, 2.8, st.w + 1.6, 0, 4.8, 0, 'plaster');
  W.scope({ lod: 1 }, () => { for (let i = 0; i < Math.floor(len / 0.5); i++) W.box(0.14, 0.16, st.w + 1.6, -len / 2 + 0.25 + i * 0.5, 3.32, 0, MC.cedarDk, { t: TX.wood }); });
  hangLantern(0, 3.4, 0, 0xffc070, 0.4, true);
  W.pop();
  return true;
}
// lots → buildings, by district rules
function raiseLots(lots, pick) {
  MAP.lotCount = (MAP.lotCount || 0) + lots.length;
  for (const lot of lots) { lot.open = lotOpenSides(lot); pick(lot); }
}
function fillerOpen(r) {
  const test = (x, z) => { const v = GR.get(x, z); return v === GR.STREET || v === GR.PAVE; };
  const k = (fn) => { let n = 0; for (let t = -0.35; t <= 0.35; t += 0.175) if (fn(t)) n++; return n >= 3; };
  return { s: k((t) => test(r.cx + t * r.w, r.cz + r.d / 2 + 2)), n: k((t) => test(r.cx + t * r.w, r.cz - r.d / 2 - 2)), e: k((t) => test(r.cx + r.w / 2 + 2, r.cz + t * r.d)), w: k((t) => test(r.cx - r.w / 2 - 2, r.cz + t * r.d)) };
}

// ---------------- market props ----------------
function foodStall(x, z, ry = 0) {
  W.push(x, 0, z, ry);
  W.scope({ lod: 1 }, () => {
    for (const s of [-1, 1]) for (const t of [-1, 1]) W.rod([s * 2.2, 0, t * 1.6], [s * 2.2, 2.7, t * 1.6], 0.035, 0x6a6e72, { layer: 'metal' });
    W.box(4.8, 0.05, 3.6, 0, 2.75, 0, 0xe8e0d0, { layer: 'cloth', t: TX.fabric, wear: 1 });
    for (let i = 0; i < 6; i++) W.box(0.25, 0.06, 0.25, -2 + i * 0.8, 2.65, 1.6, 0xfff0c0, { layer: 'glow', lod: 2 });
  });
  W.box(3.8, 0.9, 0.8, 0, 0.45, 0, 0xe8e4dc, { t: TX.ceramic, wear: 4 }); W.solid(3.8, 0.9, 0.8, 0, 0.45, 0, 'metal');
  W.scope({ lod: 2 }, () => {
    W.box(1.2, 0.12, 0.6, -1.0, 0.98, 0, 0x2a2a2a, { layer: 'metal' }); for (let i = 0; i < 8; i++) W.box(0.25, 0.04, 0.04, -1.4 + i * 0.12, 1.06, 0, 0x8a4a2a);
    for (let i = 0; i < 4; i++) tagine(0.3 + i * 0.4, 0.9, mr(-0.2, 0.2));
    for (let i = 0; i < 3; i++) bowl(0.6 + i * 0.35, 0.9, 0.25, 0x3a6aa0, mpick([0xd8b070, 0x5a3a2a, 0xc84a2a]));
    for (const t of [-1, 1]) { W.box(3.8, 0.06, 0.4, 0, 0.45, t * 1.2, MC.cedarLt, { t: TX.wood }); W.solid(3.8, 0.45, 0.4, 0, 0.22, t * 1.2, 'wood'); for (let i = 0; i < 2; i++) W.box(0.06, 0.45, 0.35, -1.6 + i * 3.2, 0.22, t * 1.2, MC.cedarDk); }
    butane(1.8, 0, -0.6);
  });
  W.pop();
}
function juiceCart(x, z, ry = 0) {
  W.push(x, 0, z, ry);
  W.box(2.4, 1.0, 1.1, 0, 0.7, 0, 0x2a6ab0, { layer: 'metal', t: TX.metal, wear: 3 });
  for (const s of [-1, 1]) W.torus(0.3, 0.05, s * 0.8, 0.3, 0.6, 0x2a2a2a, { seg: 10 });
  W.box(2.6, 0.06, 1.6, 0, 2.3, 0, 0xd8302a, { layer: 'cloth', t: TX.fabric, wear: 5 });
  for (const s of [-1, 1]) W.rod([s * 1.1, 1.2, 0.4], [s * 1.1, 2.3, 0.4], 0.025, MC.alu, { layer: 'metal' });
  W.scope({ lod: 2 }, () => { for (let i = 0; i < 30; i++) W.sphere(0.09, 0.09, 0.09, mr(-1.0, 1.0), 1.25 + Math.floor(i / 12) * 0.08, mr(-0.4, 0.4), 0xf08a1a, { seg: 6, hseg: 4 }); for (let i = 0; i < 8; i++) W.cyl(0.035, 0.03, 0.14, -0.7 + i * 0.2, 1.27, 0.48, 0xffa030, { seg: 6, layer: 'glass' }); });
  W.pop();
  W.solid(2.4, 1.3, 1.1, x, 0.65, z, 'metal', { ry });
}
function umbrellaTable(x, z, col = mpick([0xe8dcc0, 0xb03a2e, 0x2a5a3a])) {
  W.rod([x, 0, z], [x, 2.4, z], 0.03, MC.alu, { layer: 'metal', lod: 1 });
  W.cone(1.4, 0.5, x, 2.45, z, col, { seg: 8, layer: 'cloth', lod: 1, t: TX.fabric });
  bistroTable(x, 0, z, mpick([2, 3, 4]), mpick([0x2a2a2a, 0x7a2a24]));
}

// ---------------- the walled medina ----------------
const MEDINA = [[-392, -562], [-600, -575], [-805, -548], [-818, -300], [-806, -80], [-815, 180], [-795, 462], [-600, 478], [-402, 470], [-386, 150], [-394, -200], [-392, -562]];
function buildMedina() {
  const inside = (x, z) => pip(MEDINA, x, z) && polyDist(MEDINA, x, z) > 5;
  // ramparts: stamp them so nothing builds into the wall
  for (let i = 0; i < MEDINA.length - 1; i++) GR.street([MEDINA[i], MEDINA[i + 1]], 7, GR.WALL);
  const gates = [{ i: 0, t: 0.55, zel: 0 }, { i: 4, t: 0.1, zel: 2 }, { i: 6, t: 0.5, zel: 5 }, { i: 7, t: 0.5, zel: 1 }, { i: 9, t: 0.62, zel: 4 }, { i: 10, t: 0.27, zel: 3 }];
  // squares, the tannery and the mosque claim space first
  const squares = [[-560, -75, 20], [-700, -200, 14], [-470, 180, 14], [-620, 196, 18], [-520, 330, 13], [-735, 300, 12], [-480, -390, 13]];
  for (const [x, z, r] of squares) reserveSquare(x, z, r);
  GR.rect(-650, -420, 50, 38, 0, GR.RESERVED); GR.rect(-620, 150, 50, 42, 0, GR.RESERVED);
  // arteries between the gates
  const art = [
    [[[-402, -67], [-470, -40], [-560, -75], [-650, -50], [-740, -62], [-795, -54]], 5.2],
    [[[-506, -556], [-520, -470], [-480, -390], [-540, -280], [-520, -170], [-560, -75]], 4.6],
    [[[-404, -298], [-460, -310], [-540, -280]], 4.2],
    [[[-560, -75], [-590, 20], [-560, 120], [-585, 230], [-560, 340], [-501, 462]], 4.6],
    [[[-650, -50], [-700, 60], [-690, 200], [-700, 340], [-697, 458]], 4.2],
    [[[-470, -40], [-440, 60], [-470, 180], [-430, 300], [-460, 400], [-530, 420]], 3.8],
    [[[-740, -62], [-725, -200], [-760, -330], [-715, -470], [-600, -520], [-520, -470]], 3.8],
  ];
  const arteries = art.map(([pts, w]) => addStreet(pts, w, 'lane', { district: 'medina' }));
  // second order streets and dead-end derbs
  const sec = [];
  for (const a of arteries) sec.push(...branches(a, { gapMin: 32, gapMax: 55, lenMin: 40, lenMax: 140, wMin: 2.8, wMax: 3.5, inside, kind: 'alley', district: 'medina' }));
  const derbs = [];
  for (const s of sec) derbs.push(...branches(s, { gapMin: 24, gapMax: 40, lenMin: 14, lenMax: 42, wMin: 2.0, wMax: 2.5, inside, kind: 'derb', district: 'medina', turn: 0.2 }));
  // ground: worn cobbles everywhere inside the walls, dressed paving on the arteries
  groundPlate(-820, -580, -384, 482, MC.cobble, TX.cobble, 4, 0.03, (x, z) => pip(MEDINA, x, z) || polyDist(MEDINA, x, z) < 20);
  for (const a of arteries) ribbon(a.pts, -a.w / 2, a.w / 2, 0.045, MC.paving, TX.paving, { wear: 5 });
  // buildings
  let nShop = 0, nRiad = 0;
  const raise = (lots, kind) => raiseLots(lots, (lot) => {
    if (kind === 'artery' && lot.w <= 7.5 && lot.d >= 6 && nShop < 70) { nShop++; shopHouse(lot, { up: mpick([1, 1, 2]) }); return; }
    if (lot.w >= 10.6 && lot.d >= 10.6 && nRiad < 34 && mchance(kind === 'artery' ? 0.25 : 0.45)) { nRiad++; riad(lot, {}); return; }
    medinaShell(lot, { H: mpick([6.4, 6.8, 7.4, 9.8, 10.2, 6.8]) });
  });
  for (const a of arteries) for (const side of [1, -1]) raise(lotsAlong(a, side, { wMin: 4.5, wMax: 8.5, dMin: 6, dMax: 14, region: inside }), 'artery');
  for (const s of sec) for (const side of [1, -1]) raise(lotsAlong(s, side, { wMin: 7, wMax: 13, dMin: 7, dMax: 15, region: inside }), 'alley');
  for (const s of derbs) for (const side of [1, -1]) raise(lotsAlong(s, side, { wMin: 6.5, wMax: 12, dMin: 6.5, dMax: 13, region: inside }), 'derb');
  for (const sq of squares) { const st = addRing(sq[0], sq[1], sq[2]); for (const side of [-1]) raise(lotsAlong(st, side, { wMin: 6, wMax: 10, dMin: 7, dMax: 12, region: inside, setback: -0.2 }), 'artery'); }
  // back-of-block mass fills the rest of the quarter
  for (const r of fillFree(-818, -578, -384, 480, inside, { max: 24, minA: 14 })) { r.open = fillerOpen(r); medinaShell(r, { H: mpick([5.8, 6.4, 7.0, 7.6, 9.6]), clutter: mchance(0.4) }); }
  // overhead life in the lanes + covered passages
  for (const s of [...sec, ...derbs]) { laneOverhead(s, { every: 12 }); if (s.len > 30 && mchance(0.4)) sabat(s, mr(8, s.len - 8), mr(3, 6)); }
  for (const a of arteries) laneOverhead(a, { every: 16 });
  // street-level dressing along the lanes
  dressLanes([...arteries, ...sec, ...derbs], 'medina');
  // squares
  for (const [x, z, r] of squares) dressSquare(x, z, r);
  tannery(-650, -420);
  mosque(-620, 150, 0, 46, 38); minaret(-648, 126, 0, 6.8, 38);
  ramparts(MEDINA, gates, { H: 8.6, T: 2.8 });
  return { arteries, sec, derbs };
}
// a ring street around a square (used only to front lots onto squares)
function addRing(x, z, r) {
  const pts = []; for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2; pts.push([x + Math.cos(a) * r, z + Math.sin(a) * r]); }
  const s = { id: 0, pts, w: 0.8, kind: 'ring', len: pathLength(pts) };
  return s;
}
function dressSquare(x, z, r) {
  if (r > 16) fountain(x, 0, z, 2.6, Math.floor(mr(0, 8))); else wallFountainFree(x, z);
  W.scope({ lod: 1 }, () => {
    for (let i = 0; i < Math.floor(r / 5); i++) { const a = mr(0, 6.28), d = mr(r * 0.45, r * 0.75); tree(x + Math.cos(a) * d, 0, z + Math.sin(a) * d, mpick(['orange', 'ficus', 'olive']), mr(0.6, 0.9)); }
    for (let i = 0; i < 3; i++) { const a = mr(0, 6.28), d = r * 0.55; umbrellaTable(x + Math.cos(a) * d, z + Math.sin(a) * d); }
    for (let i = 0; i < 3; i++) { const a = mr(0, 6.28), d = r * 0.7; scooter(x + Math.cos(a) * d, z + Math.sin(a) * d, a); }
    for (let i = 0; i < 2; i++) { const a = mr(0, 6.28), d = r * 0.65; handCart(x + Math.cos(a) * d, 0, z + Math.sin(a) * d, a + Math.PI / 2, mpick(['produce', 'boxes'])); }
    lampPostOld(x + r * 0.35, 0, z + r * 0.35, 4.0); lampPostOld(x - r * 0.35, 0, z - r * 0.35, 4.0);
  });
}
function wallFountainFree(x, z) {
  // a free-standing tiled fountain block (two faces)
  W.box(2.4, 2.8, 1.2, x, 1.4, z, MC.plaster, { t: TX.plaster, wear: 4 }); W.solid(2.4, 2.8, 1.2, x, 1.4, z, 'plaster');
  wallFountain(x, 0, z + 0.6, 0, Math.floor(mr(0, 8))); wallFountain(x, 0, z - 0.6, Math.PI, Math.floor(mr(0, 8)));
}
// the dyers' and tanners' yard: stone pits of colour, terraces of hides, a walkway grid
function tannery(x, z) {
  const w = 46, d = 34;
  W.push(x, 0, z);
  W.box(w, 0.9, d, 0, 0.45, 0, 0xc8b8a0, { t: TX.stone, wear: 6 }); W.solid(w, 0.9, d, 0, 0.45, 0, 'stone', { walk: true });
  const cols = [0xb8862a, 0x8a2a1a, 0x5a2a6a, 0xe8e0d0, 0x2a5a8a, 0xc8b02a, 0x6a4a2a, 0x3a6a3a, 0xd05a2a];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) {
    const px = -w / 2 + 3.5 + i * 5.6, pz = -d / 2 + 3.5 + j * 6.5;
    W.cyl(1.6, 1.6, 0.95, px, 0.45, pz, 0xe8dcc8, { seg: 10, t: TX.stone, wear: 6 });
    W.cyl(1.35, 1.35, 0.02, px, 0.86, pz, mpick(cols), { seg: 10, t: TX.gravel, wear: 2 });
    W.solid(3.2, 0.95, 3.2, px, 0.47, pz, 'stone');
  }
  // drying terraces with hides on the surrounding low walls
  for (const s of [-1, 1]) { W.box(w, 3.2, 3, 0, 1.6, s * (d / 2 + 1.5), MC.plaster, { t: TX.plaster, wear: 7 }); W.solid(w, 3.2, 3, 0, 1.6, s * (d / 2 + 1.5), 'plaster', { walk: true }); W.scope({ lod: 1 }, () => { for (let i = 0; i < 20; i++) W.box(mr(0.6, 1.0), 0.02, mr(0.8, 1.2), -w / 2 + 1.2 + i * 2.3, 3.22, s * (d / 2 + 1.5), mpick([0xd8b878, 0xb88a4a, 0xe8dcc0, 0x8a2a1a]), { ry: mr(-0.3, 0.3), layer: 'cloth', ao: false }); }); }
  flight(-w / 2 - 1.2, d / 2 + 0.3, [0, 1], 1.2, 0, 3.2, { col: MC.stone, tx: TX.stone, thick: 20, run: 0.28 });
  W.pop();
}

// ---------------- street dressing (medina / souks / mellah) ----------------
function dressLanes(streets, district) {
  for (const st of streets) {
    for (let s = mr(3, 10); s < st.len - 3; s += mr(9, 22)) {
      const p = pathAt(st.pts, s), side = mchance(0.5) ? 1 : -1, n = [-p.tz * side, p.tx * side], r = st.w / 2 - 0.45;
      const x = p.x + n[0] * r, z = p.z + n[1] * r, ry = Math.atan2(-p.tz, p.tx);
      if (GR.get(p.x + n[0] * (st.w / 2 + 0.8), p.z + n[1] * (st.w / 2 + 0.8)) !== GR.BUILT) continue;
      if (GR.get(x, z) === GR.PAVE || GR.get(x + p.tx, z + p.tz) === GR.PAVE || GR.get(x - p.tx, z - p.tz) === GR.PAVE) continue;   // a doorway
      const k = mrand();
      W.defer(() => W.scope({ lod: 1 }, () => {
        if (k < 0.18) plantPot(x, 0, z, mpick(['geranium', 'aloe', 'palm']), mr(0.8, 1.2));
        else if (k < 0.3) { scooter(x, z, ry + (side > 0 ? 0 : Math.PI)); }
        else if (k < 0.4) bicycle(x, 0, z, ry, mpick([PC.blueLt, PC.redLt, 0x2a2a2a]));
        else if (k < 0.52) { for (let i = 0; i < mpick([1, 2, 3]); i++) crate(x + p.tx * i * 0.9, 0, z + p.tz * i * 0.9, 0.7, 0.5, 0.6, ry + mr(-0.2, 0.2), mpick([PC.woodLt, PC.plywood, 0x3a6aa0]), i === 0); }
        else if (k < 0.6) sack(x, 0, z, mpick([0xc8b088, 0xa89068]), ry);
        else if (k < 0.68) { for (let i = 0; i < 3; i++) cardboard(x + mr(-0.3, 0.3), i * 0.4, z + mr(-0.3, 0.3), mr(0, 1)); }
        else if (k < 0.74 && st.w > 3) handCart(x, 0, z, ry, mpick(['produce', 'boxes']));
        else if (k < 0.8) { W.cyl(0.2, 0.17, 0.42, x, 0.21, z, mpick([0x2a6ab0, 0x3a7a4a, 0xe8e0d0]), { seg: 8 }); }
        else if (k < 0.86) butane(x, 0, z);
        else if (k < 0.9) stool(x, 0, z, PC.woodLt);
        else if (k < 0.94) plasticChair(x, 0, z, ry + Math.PI / 2 * -side, mpick([PC.white, PC.blueLt, PC.green]));
        else trashBin(x, 0, z);
      }), 'mid', [x, z]);
    }
  }
}

// ---------------- MELLAH: older quarter north of the medina (balconied houses) ----------------
const MELLAH = [[-380, -830], [-120, -830], [-110, -440], [-380, -585]];
function buildMellah() {
  const poly = [...MELLAH, MELLAH[0]];
  const inside = (x, z) => pip(poly, x, z) && polyDist(poly, x, z) > 4;
  const main = [
    addStreet([[-375, -600], [-300, -640], [-230, -700], [-170, -760], [-125, -815]], 6, 'lane', { district: 'mellah' }),
    addStreet([[-300, -560], [-280, -640], [-300, -720], [-280, -815]], 5, 'lane', { district: 'mellah' }),
    addStreet([[-200, -520], [-210, -600], [-180, -680], [-200, -815]], 5, 'lane', { district: 'mellah' }),
    addStreet([[-360, -760], [-300, -720], [-210, -600], [-130, -520]], 5, 'lane', { district: 'mellah' }),
  ];
  const sec = [];
  for (const a of main) sec.push(...branches(a, { gapMin: 28, gapMax: 45, lenMin: 30, lenMax: 90, wMin: 3.0, wMax: 3.8, inside, kind: 'alley', district: 'mellah' }));
  groundPlate(-385, -832, -105, -435, 0x9a8a72, TX.cobble, 5, 0.03, (x, z) => pip(poly, x, z));
  for (const a of main) ribbon(a.pts, -a.w / 2, a.w / 2, 0.045, 0x8a8478, TX.paving, { wear: 6 });
  const raise = (lots) => raiseLots(lots, (lot) => {
    if (lot.w >= 9 && lot.d >= 9 && mchance(0.08)) { apartment(lot, { enter: true, floors: 3, shops: mchance(0.5), balcony: 0.8, win: 'shut' }); return; }
    if (lot.w >= 8 && lot.d >= 8 && mchance(0.5)) { aptShell(lot, { floors: mpick([2, 3, 3]), balcony: 0.7, win: 'shut', col: mpick([MC.whitewash, MC.sky, MC.cream, 0xe8e0d0, 0xd8e4ec]) }); return; }
    medinaShell(lot, { H: mpick([6.4, 7.0, 9.6]), col: mpick([MC.whitewash, MC.sky, MC.cream, 0xd8e4ec, MC.plaster]) });
  });
  for (const a of main) for (const side of [1, -1]) raise(lotsAlong(a, side, { wMin: 6, wMax: 11, dMin: 7, dMax: 14, region: inside }));
  for (const s of sec) for (const side of [1, -1]) raise(lotsAlong(s, side, { wMin: 6, wMax: 11, dMin: 7, dMax: 13, region: inside }));
  for (const r of fillFree(-385, -832, -105, -435, inside, { max: 22, minA: 14 })) { r.open = fillerOpen(r); medinaShell(r, { H: mpick([6, 6.6, 7.2]), col: mpick([MC.whitewash, MC.cream, 0xd8e4ec]), clutter: mchance(0.5) }); }
  for (const s of [...main, ...sec]) laneOverhead(s, { every: 15 });
  dressLanes([...main, ...sec], 'mellah');
}

// ---------------- GRAND MARKET: the great square, covered souks, cafés with terraces ----------------
const SQ = { x0: -282, z0: -205, x1: -138, z1: -95 };
function buildMarket() {
  const inMkt = (x, z) => x > -382 && x < -46 && z > -372 && z < 62 && !(pip(MEDINA, x, z) || polyDist(MEDINA, x, z) < 6);
  // the square itself, paved
  GR.rect((SQ.x0 + SQ.x1) / 2, (SQ.z0 + SQ.z1) / 2, SQ.x1 - SQ.x0, SQ.z1 - SQ.z0, 0, GR.PAVE, true);
  // the promenade to the civic plaza, souk lanes radiating out
  const prom = addStreet([[-138, -150], [-100, -146], [-60, -140], [-20, -130]], 9, 'street', { district: 'market' });
  const souks = [
    [[-282, -172], [-330, -190], [-372, -280], [-386, -296]],
    [[-282, -122], [-320, -102], [-358, -80], [-384, -68]],
    [[-232, -205], [-242, -262], [-222, -330], [-205, -368]],
    [[-170, -205], [-152, -262], [-112, -302], [-82, -340]],
    [[-232, -95], [-246, -40], [-232, 12], [-205, 55]],
    [[-162, -95], [-140, -48], [-100, -10], [-58, 20]],
    [[-330, -190], [-286, -232], [-242, -262]],
    [[-242, -262], [-196, -270], [-152, -262]],
    [[-320, -102], [-282, -66], [-246, -40]],
    [[-246, -40], [-192, -44], [-140, -48]],
    [[-152, -262], [-104, -222], [-70, -175]],
    [[-358, -80], [-340, -20], [-300, 30], [-250, 50]],
  ].map((pts) => addStreet(pts, 4.4, 'souk', { district: 'market' }));
  const side = [];
  for (const s of souks) side.push(...branches(s, { gapMin: 30, gapMax: 50, lenMin: 18, lenMax: 50, wMin: 2.6, wMax: 3.2, inside: inMkt, kind: 'alley', district: 'market', turn: 0.25 }));
  groundPlate(-388, -380, -40, 66, MC.paving, TX.paving, 4, 0.03, (x, z) => inMkt(x, z));
  // buildings: square frontage = cafés (enterable, roof terraces) and shops; souks = enterable shop-houses
  const edges = [
    { id: 0, pts: [[SQ.x0, SQ.z0], [SQ.x1, SQ.z0]], w: 1, len: SQ.x1 - SQ.x0, side: -1 },
    { id: 0, pts: [[SQ.x1, SQ.z1], [SQ.x0, SQ.z1]], w: 1, len: SQ.x1 - SQ.x0, side: -1 },
    { id: 0, pts: [[SQ.x0, SQ.z1], [SQ.x0, SQ.z0]], w: 1, len: SQ.z1 - SQ.z0, side: -1 },
  ];
  let nCafe = 0, nShop = 0;
  for (const e of edges) raiseLots(lotsAlong(e, e.side, { wMin: 8, wMax: 13, dMin: 9, dMax: 13, region: inMkt, start: 6, end: 6 }), (lot) => {
    if (nCafe < 9 && lot.w >= 8 && mchance(0.6)) { nCafe++; lot.open = lotOpenSides(lot); cafe(lot); } else shopHouse(lot, { up: 2 });
  });
  for (const s of souks) { for (const sd of [1, -1]) raiseLots(lotsAlong(s, sd, { wMin: 3.8, wMax: 6.5, dMin: 6, dMax: 10, region: inMkt }), (lot) => { if (nShop < 150 && mchance(0.85)) { nShop++; shopHouse(lot, { up: mpick([1, 1, 2]) }); } else medinaShell(lot, { H: 7 }); }); soukRoof(s); }
  for (const s of [prom, ...side]) for (const sd of [1, -1]) raiseLots(lotsAlong(s, sd, { wMin: 5, wMax: 10, dMin: 7, dMax: 13, region: inMkt }), (lot) => { if (lot.w < 7 && nShop < 190) { nShop++; shopHouse(lot, { up: 2 }); } else medinaShell(lot, { H: mpick([7, 9.6]) }); });
  for (const r of fillFree(-388, -380, -40, 66, inMkt, { max: 24, minA: 14 })) { r.open = fillerOpen(r); medinaShell(r, { H: mpick([6.4, 7, 9.6]), clutter: mchance(0.4) }); }
  for (const s of side) laneOverhead(s, { every: 10 });
  dressLanes([prom, ...side], 'market');
  dressMarketSquare();
}
function dressMarketSquare() {
  const { x0, z0, x1, z1 } = SQ, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  // food-stall city in the east half, juice carts along the north edge, open performers' ground to the west
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) foodStall(cx + 14 + i * 13, z0 + 26 + j * 17, 0);
  for (let i = 0; i < 9; i++) juiceCart(x0 + 18 + i * 13, z0 + 8, Math.PI);
  W.scope({ lod: 1 }, () => {
    for (let i = 0; i < 6; i++) { floorRug(cx - 40 + mr(-20, 20), 0.04, cz + mr(-25, 25), mr(2, 3), mr(1.5, 2), mr(0, 3)); }
    for (let i = 0; i < 8; i++) umbrellaTable(x0 + 10 + mr(0, 50), z1 - 10 - mr(0, 20));
    for (let i = 0; i < 10; i++) lampPostOld(x0 + 6 + i * ((x1 - x0 - 12) / 9), 0, z1 - 3, 4.5);
    for (let i = 0; i < 10; i++) lampPostOld(x0 + 6 + i * ((x1 - x0 - 12) / 9), 0, z0 + 3, 4.5);
    for (let i = 0; i < 6; i++) { handCart(cx - 30 + mr(-25, 25), 0, cz + mr(-30, 30), mr(0, 6), mpick(['produce', 'boxes'])); }
    for (let i = 0; i < 8; i++) scooter(x1 - 4 - mr(0, 3), z0 + 15 + i * 9, Math.PI / 2 + mr(-0.2, 0.2));
    for (let i = 0; i < 5; i++) kiosk(x0 + 4, 0, z0 + 25 + i * 16, Math.PI / 2);
    for (let i = 0; i < 4; i++) sedan(x1 - 12 - i * 6, z1 - 8, 0, undefined, mpick(['taxi', 'taxiB', 'taxiB']));
  });
}

// ---------------- civic plaza between the market and the palace ----------------
function buildCivicPlaza() {
  const x0 = -48, x1 = 12, z0 = -150, z1 = 28;
  GR.rect((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 0, GR.PAVE, true);
  groundPlate(x0, z0, x1, z1, 0xd0c0a0, TX.paving, 2, 0.035);
  // a ceremonial axis to the palace portal: zellige band, two fountains, palm colonnades, benches, lamps
  W.box(x1 - x0, 0.02, 6, (x0 + x1) / 2, 0.05, -60, 0xffffff, { t: TX.zellige, wear: 3, ao: false });
  fountain(-30, 0, -60, 3.4, 3); fountain(-6, 0, -60, 2.4, 6);
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) { palm(x0 + 4 + i * 6.8, 0, -60 + s * 9, 9 + mr(-1, 2)); }
  W.scope({ lod: 1 }, () => {
    for (let i = 0; i < 8; i++) for (const s of [-1, 1]) bench(x0 + 6 + i * 7.5, 0, -60 + s * 13, s > 0 ? Math.PI : 0);
    for (let i = 0; i < 12; i++) for (const s of [-1, 1]) lampPostOld(x0 + 2 + i * 5.2, 0, -60 + s * 20, 4.6);
    for (let i = 0; i < 20; i++) bollard(x0 + 1, 0, z0 + 6 + i * 8.6);
    for (let i = 0; i < 6; i++) planterTree(x0 + 8 + i * 9, 0, z0 + 12, 'orange', 0.8);
    for (let i = 0; i < 6; i++) planterTree(x0 + 8 + i * 9, 0, z1 - 12, 'orange', 0.8);
    for (let i = 0; i < 3; i++) kiosk(x0 + 10 + i * 18, 0, z1 - 4, Math.PI);
    for (let i = 0; i < 5; i++) trashBin(x0 + 5 + i * 12, 0, -60 + 16);
  });
}
