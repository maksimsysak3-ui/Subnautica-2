// =====================================================================
//  DAR ESSALAM — the kasbah, the squares, the souk roofs and the harbour, dressed by hand
// =====================================================================

// ---------------- the kasbah: old fortress, now the militia's headquarters ----------------
function buildKasbah() {
  const { x0, z0, x1, z1 } = KASBAH, H = 12, col = 0xb98a62;
  rampartRun([x0, z0], [x1, z0], H, 3, { inner: 1, col });
  rampartRun([x0, z0], [x0, -56.5], H, 3, { inner: -1, col }); rampartRun([x0, -47.5], [x0, z1], H, 3, { inner: -1, col });
  rampartRun([x0, z1], [x1, z1], H, 3, { inner: -1, col });
  rampartRun([x1, z0], [x1, z1], H, 3, { inner: 1, col });
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) rampartTower(x, z, 10, 17, col);
  for (const [x, z] of [[108, z0], [108, z1], [x1, -85]]) rampartTower(x, z, 7, 14.5, col);
  // the gate: open, sandbagged, a checkpoint barrier
  W.push(x0, 0, -52, -Math.PI / 2);
  for (const s of [-1, 1]) rampartTower(s * 5.4, 0, 5.6, 15, col);
  wall('x', -2.6, 2.6, 0, 0, H + 1, 3.4, { col, tx: TX.pise, side: -1, ops: [{ at: 0, w: 4.0, h: 6.8, kind: 'archdoor', arch: 'horse', style: 'carved', leaf: 'open', double: true, zellige: 4, rimCol: 0xe0c8a0 }] });
  W.box(8, 0.9, 0.12, 0, H - 1.6, -1.76, 0xffffff, { t: TX.zellige, wear: 3, lod: 1 });
  W.pop();
  W.scope({ lod: 1 }, () => {
    sandbagWall(58, -59, 58, -55, 3); sandbagWall(58, -49, 58, -45, 3);
    W.box(0.12, 0.12, 6, 60.5, 1.0, -52, 0xd83a2a, { layer: 'metal' }); W.box(0.3, 1.0, 0.3, 60.5, 0.5, -55.2, 0x3a3a3a, { layer: 'metal' });
    floodPole(59, 0, -60.5, 0, 6, 1); signPost(58.5, 0, -45, Math.PI / 2, 1.2, 0.8, PC.white, PC.redLt, 1.8);
  });
  // grounds: parade gravel, beaten earth round the buildings
  groundPlate(x0 + 1.5, z0 + 1.5, x1 - 1.5, z1 - 1.5, 0xa88c68, TX.earth, 5, 0.03);
  groundPlate(68, -92, 122, -40, 0xb8a888, TX.gravel, 4, 0.04);
  GR.rect((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 - 4, z1 - z0 - 4, 0, GR.PAVE, true);
  // the old keep (tighremt): tapering corner towers, brick-patterned crown
  kasbahKeep(92, -106);
  // motor pool: a long open shed on posts, trucks and drums
  const mx0 = 118, mz0 = -130, mx1 = 149, mz1 = -104;
  W.box(mx1 - mx0, 0.25, mz1 - mz0, (mx0 + mx1) / 2, 4.6, (mz0 + mz1) / 2, 0x6a6a64, { layer: 'metal', t: TX.corrugated, wear: 6 });
  for (let x = mx0 + 0.3; x <= mx1; x += 6.1) for (const z of [mz0 + 0.3, mz1 - 0.3]) { W.box(0.3, 4.6, 0.3, x, 2.3, z, 0x5a5a56, { layer: 'metal' }); W.solid(0.3, 4.6, 0.3, x, 2.3, z, 'metal'); }
  cargoTruck(124, -115, Math.PI / 2, PC.olive); pickup(134, -124, Math.PI / 2 + 0.1, 0xd8d4c8); pickup(143, -113, -Math.PI / 2, 0x3a3a34);
  W.scope({ lod: 2 }, () => { for (let i = 0; i < 7; i++) drum(mx1 - 1 - (i % 3) * 0.7, 0, mz0 + 1.2 + Math.floor(i / 3) * 0.7, mpick([PC.olive, PC.blue, PC.redLt])); workbench(mx0 + 2, 0, mz0 + 1, 0); toolChest(mx0 + 4.5, 0, mz0 + 0.8, 0); bigGenerator(mx0 + 8, 0, mz0 + 2, 0); jerrycan(mx0 + 10, 0, mz0 + 1, 0); tire(mx0 + 12, 0, mz0 + 1.2); });
  // radio mast + dishes on a plinth
  W.box(3, 1.2, 3, 140, 0.6, -92, MC.concrete, { t: TX.concrete, wear: 5 }); W.solid(3, 1.2, 3, 140, 0.6, -92, 'concrete');
  for (let y = 1.2; y < 22; y += 1.6) { for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) W.rod([140 + a * (1 - y / 30), y, -92 + b * (1 - y / 30)], [140 + a * (1 - (y + 1.6) / 30), y + 1.6, -92 + b * (1 - (y + 1.6) / 30)], 0.03, 0xc8c8c8, { layer: 'metal', seg: 3 }); W.rod([140 - 0.5 * (1 - y / 30), y, -92 - 0.5 * (1 - y / 30)], [140 + 0.5 * (1 - y / 30), y + 1.6, -92 + 0.5 * (1 - y / 30)], 0.02, 0xc8c8c8, { layer: 'metal', seg: 3, lod: 1 }); }
  W.box(0.3, 0.3, 0.3, 140, 22.2, -92, 0xff3020, { layer: 'glow' });
  satDish(138.4, 1.2, -93, 2.4, 1.3);
  // defences and camp life on the parade ground
  W.scope({ lod: 1 }, () => {
    hescoLine(70, -84, 70, -70, 2); hescoLine(116, -44, 116, -56, 2);
    sandbagWall(100, -50, 106, -50, 3); sandbagWall(78, -62, 78, -56, 3);
    camoNet(84, 0, -46, 8, 6, 3, 0); tableFolding(84, 0, -46, 0); chairFolding(83, 0, -45, 2.6); chairFolding(85, 0, -47, -0.5); radioSet(84.3, 0.76, -46.1, 0); mapBoard(81, 0.9, -48.4, 0.3);
    camoNet(108, 0, -74, 9, 7, 3.2, 0.2); for (let i = 0; i < 4; i++) cot(105 + i * 2, 0, -76, Math.PI / 2, PC.olive);
    for (let i = 0; i < 6; i++) ammoCan(110 + (i % 3) * 0.5, 0, -71 + Math.floor(i / 3) * 0.4, mr(0, 1));
    crateStack(73, 0, -88, 0.3, 4); crateStack(118, 0, -88, -0.2, 3); for (let i = 0; i < 4; i++) concreteBarrier(90 + i * 2.2, 0, -41.5, 0, PC.concreteLt, true);
    floodPole(70, 0, -40, Math.PI / 4, 8, 2); floodPole(122, 0, -94, -Math.PI / 4, 8, 2);
    // flag at the centre of the parade ground
    W.rod([95, 0, -66], [95, 12, -66], 0.06, 0xd8d8d8, { layer: 'metal' }); W.box(2.4, 1.5, 0.02, 96.2, 11.2, -66, 0x2a2a2a, { layer: 'cloth' }); W.box(1.0, 0.3, 0.03, 96.2, 11.2, -66, 0xc0302a, { layer: 'cloth' });
    for (const [x, z] of [[74, -100], [112, -92], [76, -50]]) tree(x, 0, z, 'palm', 1.1);
  });
  // where the guards stand (missions place hostiles here)
  TOWN.guards.push(...[[60, -57, 1.57], [60, -47, 1.57], [80, -55, 2.6], [96, -48, 3.14], [110, -62, 1.2], [92, -78, 0], [124, -96, 0.6], [134, -60, -1.57], [86, -98, -0.6], [72, -114, 1.0]].map(([x, z, yaw]) => ({ x, z, yaw })));
  TOWN.spots.kasbahGate = { x: x0 - 3, z: -52 };
}
function kasbahKeep(cx, cz) {
  const w = 18, d = 15, H = 16, col = 0xb07e58;
  W.push(cx, 0, cz, 0);
  W.box(w - 2, H, d - 2, 0, H / 2, 0, col, { t: TX.pise, wear: 6 }); W.solid(w - 2, H, d - 2, 0, H / 2, 0, 'stone');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    // tapering corner tower: three stacked boxes
    for (let k = 0; k < 3; k++) { const ss = 4.6 - k * 0.45, y0 = k * 6.3, hh = k === 2 ? 7 : 6.3; W.box(ss, hh, ss, sx * (w / 2 - 2.2), y0 + hh / 2, sz * (d / 2 - 2.2), col, { t: TX.pise, wear: 6 }); }
    W.solid(4.6, 19.6, 4.6, sx * (w / 2 - 2.2), 9.8, sz * (d / 2 - 2.2), 'stone');
    W.scope({ lod: 1 }, () => { for (let k = 0; k < 4; k++) for (const r of [-1, 1]) W.box(0.5, 0.9, 0.5, sx * (w / 2 - 2.2) + r * 1.2, 20.05, sz * (d / 2 - 2.2) + (k - 1.5) * 1.0, col, { t: TX.pise }); });
  }
  // brick-patterned crown: diamond motifs (darj w ktaf) in relief on every face, slit windows below
  W.scope({ lod: 1 }, () => {
    for (const [r, L] of [[0, w - 2], [Math.PI / 2, d - 2], [Math.PI, w - 2], [-Math.PI / 2, d - 2]]) {
      W.push(0, 0, 0, r); const zf = (r === 0 || r === Math.PI ? d - 2 : w - 2) / 2 + 0.02;
      for (let x = -L / 2 + 1.2; x < L / 2 - 1; x += 1.4) { W.box(0.7, 0.7, 0.08, x, H - 2.6, zf, shade(col, 0.82), { rz: Math.PI / 4, t: TX.brick, wear: 3 }); W.box(0.35, 0.35, 0.1, x, H - 2.6, zf, shade(col, 1.12), { rz: Math.PI / 4, t: TX.pise }); }
      W.box(L, 0.3, 0.12, 0, H - 4, zf, shade(col, 0.88), { t: TX.brick });
      for (let x = -L / 2 + 2; x < L / 2 - 1.5; x += 3) for (const y of [5, 9.5]) W.box(0.3, 1.1, 0.06, x, y, zf, 0x1a120c, { ao: false });
      for (let x = -L / 2 + 0.5; x < L / 2; x += 1.2) W.box(0.6, 0.8, 0.5, x, H + 0.4, zf - 0.25, col, { t: TX.pise });
      W.pop();
    }
    W.push(0, 0, d / 2 - 1, 0); W.box(2.0, 3.0, 0.08, 0, 1.5, 0.02, 0x2a1a10, { t: TX.carved }); archRim(2.0, 2.6, 1.0, 'horse', 0.05, 0xd8b890, TX.pise); W.pop();
  });
  W.pop();
  GR.rect(cx, cz, w + 1, d + 1, 0, GR.RESERVED, true);
}

// ---------------- the main square, dressed piece by piece ----------------
function dressSquareMain() {
  // fountain on the west side, under two big ficus trees
  fountain(-14, 0, 0, 2.8, 5);
  tree(-21, 0, -9, 'ficus', 1.3); tree(-21, 0, 10, 'ficus', 1.25);
  for (const [x, z, r] of [[-17.5, -6, 0.5], [-17.5, 6, -0.5], [-10, -5, -0.6], [-10, 5, 0.6]]) bench(x, 0, z, r);
  // food stalls: three rows of four under white canopies, lights strung between them
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) foodStall(4 + i * 6.2, -9 + j * 8, 0);
  W.defer(() => W.scope({ lod: 1 }, () => { for (let j = 0; j < 3; j++) { const z = -9 + j * 8 - 1.8; W.cable([1.6, 2.85, z], [26.4, 2.85, z], 0.25, 0.01, 0x1a1a1a, 12); for (let x = 2.5; x < 26; x += 1.6) W.sphere(0.07, 0.07, 0.07, x, 2.72 - Math.sin((x - 1.6) / 24.8 * Math.PI) * 0.25, z, 0xfff0c0, { layer: 'glow' }); } }), 'mid', [15, -1]);
  // fresh orange juice carts along the north edge, numbered, each a little different
  for (let i = 0; i < 6; i++) juiceCart(-18 + i * 6.2, -17.5, 0);
  // storyteller's ring, a henna artist, a water seller, a snake charmer's rug
  W.scope({ lod: 1 }, () => {
    floorRug(-14, 0.04, 14, 3, 2.2, 0.2, 0x9a2a24); for (let i = 0; i < 6; i++) pouf(-14 + Math.cos(i) * 2.6, 0, 14 + Math.sin(i) * 2.2);
    umbrellaTable(-6, 15, 0xe8c040); stool(-5, 0, 14.2); stool(-6.8, 0, 15.6);
    floorRug(-2, 0.04, 16.5, 2, 1.4, -0.3, 0x2a3a6a); for (let i = 0; i < 3; i++) basket(-2.6 + i * 0.6, 0.04, 16.4);
    W.cone(1.2, 0.5, -22, 2.5, 16, 0xe8dcc0, { seg: 8, layer: 'cloth', t: TX.fabric }); W.rod([-22, 0, 16], [-22, 2.5, 16], 0.03, MC.alu, { layer: 'metal' });
    for (let i = 0; i < 4; i++) stool(-22 + Math.cos(i * 1.6) * 1.1, 0, 16 + Math.sin(i * 1.6) * 1.1);
  });
  // palms along the south edge, old lamp posts round the edge
  for (let x = -26; x <= 26; x += 8.6) if (Math.abs(x) > 6) palm(x, 0, 19.5, 7.5 + mr(-1, 1.5));
  for (const [x, z] of [[-28.5, -20.5], [28.5, -20.5], [-28.5, 20.5], [28.5, 20.5], [-28.5, 0], [28.5, -10], [0, -20.5], [-14, 20.5], [14, 20.5]]) lampPostOld(x, 0, z, 4.4);
  // petits taxis waiting at the avenue corner, a donkey cart, scooters
  sedan(9, 17.5, Math.PI / 2, 0x2a6ab0); sedan(14.5, 17.5, Math.PI / 2, 0x2a6ab0);
  W.scope({ lod: 1 }, () => { donkey(-26, 0, -12, 0.4); handCart(-24.5, 0, -12.6, 0.4, 'produce'); scooter(27, -15, 0.3); scooter(27.4, -13.6, 0.2); bicycle(-29, 0, 9, Math.PI / 2); });
  TOWN.spots.square = { x: 0, z: 0 };
}
// souk mouths: a horseshoe arch gateway with a carved sign over each souk entrance
function soukArch(x, z, w, ry, name) {
  W.push(x, 0, z, ry);
  const col = 0xd8c4a0, H = 7.2;
  for (const s of [-1, 1]) { W.box(1.2, H, 1.6, s * (w / 2 + 0.6), H / 2, 0, col, { t: TX.plaster, wear: 3 }); W.solid(1.2, H, 1.6, s * (w / 2 + 0.6), H / 2, 0, 'plaster'); }
  const n = 12; for (let i = 0; i < n; i++) { const u0 = -w / 2 + (i / n) * w, u1 = -w / 2 + ((i + 1) / n) * w, uc = (u0 + u1) / 2, top = 3.6 + archY('horse', uc, w); W.box(u1 - u0, H - top, 1.6, uc, (top + H) / 2, 0, col, { t: TX.plaster, wear: 3 }); }
  for (const r of [0, Math.PI]) { W.push(0, 0, 0, r); archRim(w, 3.6, w * 0.78, 'horse', 0.8, 0xf2e6cc, TX.gebs, 2); W.box(w * 0.9, 0.7, 0.06, 0, H - 1.0, 0.82, 0x2a5a3a, { t: TX.carved, lod: 1 }); W.pop(); }
  W.box(w + 3.2, 0.4, 2.2, 0, H + 0.2, 0, MC.tile, { t: TX.rooftile, lod: 1 });
  hangLantern(0, H - 0.6, 0, 0xffc070, 1.2, true);
  W.pop();
  TOWN.spots[name] = { x, z };
}
function rahbaSpices() {
  const { x0, z0, x1, z1 } = RAHBA, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  tree(cx, 0, cz, 'ficus', 1.4);
  W.box(4.6, 0.5, 4.6, cx, 0.25, cz, MC.stone, { t: TX.stone, wear: 6 }); W.solid(4.6, 0.5, 4.6, cx, 0.25, cz, 'stone');
  for (const [x, z, r] of [[x0 + 3, z0 + 3, 0.3], [x1 - 3, z0 + 3, -0.4], [x0 + 3, z1 - 3, 2.8], [x1 - 3.5, z1 - 3, 3.4], [cx, z0 + 2.5, 0]]) { spiceStand(x, 0, z, r, 1.8); W.cone(1.6, 0.5, x, 2.4, z, mpick([0xe8dcc0, 0xb03a2e, 0xc8a040]), { seg: 8, layer: 'cloth', t: TX.fabric, lod: 1 }); W.rod([x, 0, z], [x, 2.4, z], 0.03, MC.cedarDk, { lod: 1 }); }
  W.scope({ lod: 2 }, () => { for (let i = 0; i < 14; i++) sack(mr(x0 + 1.5, x1 - 1.5), 0, mr(z0 + 1.5, z1 - 1.5), mpick([0xc8a050, 0xa8402a, 0xd8c070, 0x6a8a3a, 0x8a4a2a]), mr(0, 6)); for (let i = 0; i < 6; i++) basket(mr(x0 + 2, x1 - 2), 0, mr(z0 + 2, z1 - 2), mpick([0x5a3a2a, 0x4a5a2a, 0xc8a050])); });
  wallFountain(x0 + 0.4, 0, cz, Math.PI / 2, 6);
}
function kasbahSquare() {
  const { x0, z0, x1, z1 } = KSQ;
  W.scope({ lod: 1 }, () => {
    for (const [x, z] of [[x0 + 4, z0 + 4], [x1 - 6, z1 - 3], [x0 + 5, z1 - 4]]) tree(x, 0, z, 'palm', 1.15);
    fountain((x0 + x1) / 2 - 3, 0, (z0 + z1) / 2 + 2, 2.0, 1);
    pickup(x1 - 8, z0 + 6, 0.2, 0x8a8478, false); rubble(x0 + 8, 0, z1 - 2, 8);
    for (let i = 0; i < 3; i++) bench(x0 + 2 + i * 3, 0, z1 - 1.2, Math.PI);
    hescoLine(x1 - 2, z0 + 10, x1 - 2, z0 + 16, 1);
  });
}
function gardenMellah() {
  const { x0, z0, x1, z1 } = JARDIN, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  // tiled cross paths, raised beds with orange trees, cypresses at the corners, a central fountain
  W.box(x1 - x0 - 2, 0.05, 2.4, cx, 0.06, cz, 0xffffff, { t: TX.zellige, wear: 2, ao: false }); W.box(2.4, 0.05, z1 - z0 - 2, cx, 0.06, cz, 0xffffff, { t: TX.zellige, wear: 2, ao: false });
  fountain(cx, 0, cz, 2.2, 4);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const bx = cx + sx * (x1 - x0) / 4, bz = cz + sz * (z1 - z0) / 4, bw = (x1 - x0) / 2 - 4, bd = (z1 - z0) / 2 - 4;
    W.box(bw, 0.4, bd, bx, 0.2, bz, 0x6a5a3a, { t: TX.earth, wear: 3 }); W.box(bw - 0.4, 0.04, bd - 0.4, bx, 0.42, bz, 0x5a7a34, { t: TX.leaf, wear: 2, ao: false }); W.box(bw + 0.3, 0.45, 0.25, bx, 0.22, bz - bd / 2, MC.stone, { t: TX.stone }); W.box(bw + 0.3, 0.45, 0.25, bx, 0.22, bz + bd / 2, MC.stone, { t: TX.stone });
    W.solid(bw, 0.45, bd, bx, 0.22, bz, 'stone', { walk: true });
    for (const k of [-1, 1]) tree(bx + k * bw / 4, 0.4, bz, 'orange', 1.0);
    W.scope({ lod: 2 }, () => { for (let i = 0; i < 14; i++) bush(bx + mr(-bw / 2 + 0.5, bw / 2 - 0.5), 0.42, bz + mr(-bd / 2 + 0.5, bd / 2 - 0.5), mr(0.35, 0.65), mpick([0x3a6a2a, 0x4a7a32, 0xc0306a, 0xe8c040, 0xd8d8e8])); });
    cypress(cx + sx * ((x1 - x0) / 2 - 1.2), cz + sz * ((z1 - z0) / 2 - 1.2), 8 + mr(-1, 2));
    bench(cx + sx * 4, 0, cz + sz * 1.9, sz > 0 ? 0 : Math.PI);
  }
  TOWN.spots.garden = { x: cx, z: cz };
}
// ---------------- the harbour: quay, jetty, breakwater, lighthouse, boats, fish market ----------------
function harbour() {
  const { x0, z0, x1, z1 } = QUAY;
  // quay edge: big dressed stones, a wet face down to the sea, bollards and tyres
  W.box(x1 - x0, 0.3, 1.2, (x0 + x1) / 2, 0.06, z1 - 0.6, 0xa89c88, { t: TX.stone, wear: 6, ao: false });
  W.box(x1 - x0, 4, 0.6, (x0 + x1) / 2, -2, z1 + 0.3, 0x6a6a5e, { t: TX.stone, wear: 7 });
  W.solid(x1 - x0, 4, 0.6, (x0 + x1) / 2, -0.8, z1 + 0.6, 'stone');
  W.solid(x1 - x0 - 4, 3, 0.2, (x0 + x1) / 2, 1.5, z1 + 0.8, 'stone');   // invisible: nobody walks off the quay
  for (let x = x0 + 3; x < x1 - 2; x += 9) { bollardQuay(x, z1 - 0.7); if (Math.abs(x - 64) > 6) W.scope({ lod: 2 }, () => tire(x + 2.5, -0.4, z1 + 0.65, 0, false)); }
  // jetty out into the harbour
  const jx = 64, jz1 = 168;
  W.box(6, 0.4, jz1 - z1, jx, -0.15, (z1 + jz1) / 2, 0xa89c88, { t: TX.stone, wear: 6 });
  W.box(6, 5, jz1 - z1, jx, -2.6, (z1 + jz1) / 2, 0x6a6a5e, { t: TX.stone, wear: 7 });
  W.solid(6, 5.4, jz1 - z1, jx, -2.65, (z1 + jz1) / 2, 'stone', { walk: true });
  for (const s of [-1, 1]) W.solid(0.2, 3, jz1 - z1, jx + s * 3.1, 1.5, (z1 + jz1) / 2, 'stone');
  W.solid(6, 3, 0.2, jx, 1.5, jz1 + 0.1, 'stone');
  for (let z = z1 + 6; z < jz1; z += 10) for (const s of [-1, 1]) bollardQuay(jx + s * 2.6, z);
  // breakwater with the lighthouse
  W.box(10, 3, 80, 158, -0.5, 150, 0x6a665a, { t: TX.stone, wear: 7 }); W.solid(10, 3, 80, 158, -0.5, 150, 'stone');
  W.scope({ lod: 1 }, () => { for (let z = 112; z < 190; z += 2.5) rock(152 + mr(-1, 1), -0.8, z, mr(1.4, 2.4), 0x5a564c); });
  W.cyl(1.8, 2.4, 14, 158, 7, 186, 0xe8e4dc, { seg: 12, t: TX.plaster, wear: 3 }); W.cyl(1.3, 1.3, 2.2, 158, 15.1, 186, 0x2a2a2a, { seg: 10, layer: 'metal' }); W.cyl(1.0, 1.0, 1.6, 158, 15.1, 186, 0xfff0c0, { seg: 10, layer: 'glow' }); W.cone(1.5, 1.4, 158, 16.9, 186, 0xc0302a, { seg: 10, layer: 'metal' });
  for (let k = 0; k < 4; k++) W.box(3.8, 0.8, 3.8, 158, 2 + k * 3.4, 186, 0xc0302a, { lod: 2, ao: false, dim: 0 });
  // the blue boats: moored in rows along the quay and the jetty, a few hauled out for repair
  let b = 0;
  // moored bow-in to the quay in loose groups, some rafted two abreast
  for (const [xa, xb] of [[x0 + 8, 40], [50, 58], [72, 104], [118, 140]]) for (let x = xa; x < xb; x += mr(3.1, 4.2)) { const L = mr(6, 8); fishingBoat(x, z1 + 0.6 + L / 2 + mr(0.1, 0.5), Math.PI + mr(-0.12, 0.12), L); if (mchance(0.25)) { const L2 = mr(6, 7.5); fishingBoat(x + mr(-0.4, 0.4), z1 + L + 1.2 + L2 / 2, Math.PI + mr(-0.2, 0.2), L2); } b++; }
  for (let z = z1 + 8; z < jz1 - 6; z += mr(8, 12)) for (const s of [-1, 1]) if (mchance(0.75)) { const L = s > 0 ? mr(9, 11) : mr(6, 8); fishingBoat(jx + s * (3.6 + 1.1), z, s > 0 ? mr(-0.05, 0.05) : Math.PI + mr(-0.05, 0.05), L); }
  for (let i = 0; i < 7; i++) fishingBoat(84 + (i % 4) * 16 + mr(-3, 3), 132 + Math.floor(i / 4) * 18 + mr(-3, 3), mr(0, 6), mr(7, 11));
  for (const [x, z, r] of [[122, 100, 0.3], [131, 101, -0.2], [140, 99, 0.1]]) {
    fishingBoat(x, z, r, 8, { y: 0.55 });
    W.scope({ lod: 1 }, () => { for (const s of [-1, 1]) W.rod([x + s * 1.6, 0, z - 2], [x + s * 1.1, 1.4, z - 2], 0.1, MC.cedarDk); scaffold(x + 2.6, 0, z, r, 3, 3); paintCans(x - 2.4, 0, z + 2, 3); });
  }
  // fish market: stalls under umbrellas, ice boxes of sardines, scales, gulls
  for (let i = 0; i < 5; i++) {
    const x = 10 + i * 6.5, z = 104;
    W.box(3.2, 0.9, 1.2, x, 0.45, z, 0xd8d8d0, { t: TX.ceramic, wear: 5 }); W.solid(3.2, 0.9, 1.2, x, 0.45, z, 'metal');
    W.scope({ lod: 2 }, () => { for (let k = 0; k < 18; k++) W.sphere(0.24, 0.05, 0.08, x + mr(-1.4, 1.4), 0.95, z + mr(-0.45, 0.45), mpick([0xa8b0b8, 0x8a98a8, 0xc8ccd0, 0xd06a4a]), { seg: 5, hseg: 3, layer: 'metal', ry: mr(0, 3) }); cooler(x + 1.9, 0, z, 0, mpick([PC.blueLt, PC.white, PC.redLt])); });
    W.cone(2.2, 0.6, x, 2.7, z, mpick([0xe8dcc0, 0x2a5aa0, 0xc0302a]), { seg: 8, layer: 'cloth', t: TX.fabric, lod: 1 }); W.rod([x, 0, z], [x, 2.7, z], 0.03, MC.alu, { layer: 'metal', lod: 1 });
  }
  W.scope({ lod: 1 }, () => {
    for (let i = 0; i < 14; i++) netPile(mr(x0 + 30, x1 - 10), 0, mr(z0 + 4, z1 - 3));
    for (let i = 0; i < 10; i++) crateStack(mr(x0 + 40, x1 - 10), 0, mr(z0 + 2, z0 + 6), mr(0, 3), Math.floor(mr(2, 5)));
    for (let i = 0; i < 6; i++) ropeCoil(mr(x0 + 10, x1 - 10), 0, z1 - 1.6);
    for (let i = 0; i < 8; i++) { const x = mr(x0 + 5, x1 - 5); gull(x, 0.7, z1 - 0.7); }
    for (let x = x0 + 8; x < x1; x += 22) { lampPostOld(x, 0, z0 + 1.2, 4.4); bench(x + 4, 0, z0 + 1.4, 0); }
    for (let i = 0; i < 3; i++) palm(-12 + i * 7, 0, z0 + 2.2, 7.5 + i);
    handCart(46, 0, 98, 0.4, 'produce'); forklift(104, 97, 2.6); pallet(108, 0, 96, 0.2); crateStack(108, 0.15, 96, 0.2, 3);
  });
  TOWN.spots.jettyEnd = { x: jx, z: jz1 - 3 };
}
function gull(x, y, z) {
  W.push(x, y, z, mr(0, 6));
  W.sphere(0.32, 0.18, 0.16, 0, 0.2, 0, 0xf2f2ee, { seg: 6, hseg: 4 }); W.sphere(0.12, 0.12, 0.12, 0.16, 0.32, 0, 0xf2f2ee, { seg: 5, hseg: 3 });
  W.box(0.3, 0.03, 0.12, -0.05, 0.27, 0.1, 0x8a8e94); W.box(0.3, 0.03, 0.12, -0.05, 0.27, -0.1, 0x8a8e94); W.box(0.08, 0.03, 0.03, 0.27, 0.31, 0, 0xe8b040);
  W.pop();
}
// ---------------- lanes: roofs over the souks, overhead life, doorstep clutter, trees ----------------
function dressLanesTown() {
  const T = TOWN.lanes;
  // reed-and-timber roofs over the souk streets (light falls through in stripes)
  for (const n of ['soukKebir', 'soukSemmarine', 'derbChouari']) soukRoof(T[n], 4.9);
  soukRoof({ ...T.soukZarbia, len: T.soukZarbia.len * 0.6 }, 4.9);
  // souk mouths on the square
  soukArch(0, -24.5, 4.6, 0, 'Souk el Kebir'); soukArch(-24.6, -24.5, 3.8, 0.19, 'Souk Zarbia'); soukArch(24.3, -24.5, 3.8, -0.17, 'Souk Semmarine');
  // overhead life, lane by lane (spots picked along each lane)
  const plan = {
    derbLalla: [[8, 'lantern'], [17, 'cable'], [26, 'sabat'], [37, 'laundry'], [52, 'cable'], [63, 'bunting'], [75, 'sabat'], [88, 'laundry'], [101, 'cable']],
    derbSidi: [[10, 'laundry'], [24, 'cable'], [40, 'sabat'], [54, 'laundry']],
    derbKhemis: [[12, 'cable'], [30, 'laundry'], [50, 'sabat'], [70, 'cable']],
    derbLamia: [[8, 'laundry'], [20, 'lantern'], [30, 'cable']],
    derbSaida: [[10, 'cable'], [25, 'sabat'], [42, 'laundry'], [60, 'cable'], [74, 'laundry']],
    derbZerka: [[12, 'laundry'], [26, 'cable'], [44, 'laundry'], [60, 'sabat'], [80, 'laundry'], [95, 'cable']],
    derbTala: [[10, 'cable'], [28, 'laundry'], [46, 'sabat'], [66, 'laundry'], [86, 'cable']],
    derbZitoun: [[10, 'laundry'], [26, 'lantern']], derbFrane: [[14, 'cable'], [34, 'laundry'], [54, 'cable']],
    derbBab: [[12, 'laundry'], [30, 'cable'], [44, 'lantern']], skalaLane: [[30, 'cable'], [70, 'laundry'], [110, 'cable']],
    derbMellah: [[10, 'cable'], [30, 'laundry'], [52, 'cable'], [70, 'laundry']], derbNajjar: [[14, 'laundry']], derbMoulay: [[16, 'cable']],
    derbSoussi: [[12, 'laundry'], [26, 'cable']], derbFassi: [[10, 'cable'], [28, 'laundry']], derbTijani: [[14, 'laundry']], derbBahri: [[18, 'cable']],
    derbRahba: [[8, 'lantern']], derbDebbagh: [[10, 'laundry'], [24, 'cable']],
    soukZarbia: [[40, 'bunting'], [62, 'bunting']],
  };
  for (const [n, list] of Object.entries(plan)) for (const [s, kind] of list) if (T[n] && s < T[n].len - 2) overhead(T[n], s, kind, { col: mpick(PAL.medina) });
  // trees and lamps along the two boulevards
  for (let z = 26; z < 88; z += 9) for (const s of [-1, 1]) { tree(s * 3.4, 0, z, 'palm', 1.0); if ((z / 9 | 0) % 2) lampPostOld(s * 3.7, 0, z + 4.5, 4.4); }
  for (let s = 6; s < T.orangers.len - 4; s += 8) { const p = pathAt(T.orangers.pts, s); for (const k of [-1, 1]) { const x = p.x - p.tz * k * 2.6, z = p.z + p.tx * k * 2.6; W.box(1.4, 0.18, 1.4, x, 0.09, z, MC.stone, { t: TX.stone, wear: 5 }); tree(x, 0.1, z, 'orange', 0.95); } }
  // wall fountains at medina junctions, and doorstep life along every lane
  for (const [x, z, r] of [[-68.5, 4.6, Math.PI], [-93, 8.4, Math.PI], [-118, 2.6, Math.PI], [-47, 31.8, -Math.PI / 2], [-54, 56.2, Math.PI]]) wallFountain(x, 0, z, r, Math.floor(mr(0, 8)));
  W.scope({ lod: 2 }, () => {
    for (const st of Object.values(T)) {
      if (st.kind === 'quay' || st.kind === 'avenue') continue;
      for (let s = mr(5, 10); s < st.len - 4; s += mr(7, 13)) {
        const p = pathAt(st.pts, s), side = mchance(0.5) ? 1 : -1, r = st.w / 2 - 0.35, x = p.x - p.tz * side * r, z = p.z + p.tx * side * r, k = mrand();
        if (k < 0.2) { plantPot(x, 0, z, 'geranium', 1.2); plantPot(x + p.tx * 0.5, 0, z + p.tz * 0.5, 'aloe', 1.0); }
        else if (k < 0.3) scooter(x, z, Math.atan2(-p.tz, p.tx));
        else if (k < 0.38) bicycle(x, 0, z, Math.atan2(-p.tz, p.tx));
        else if (k < 0.48) cat(x, 0.05, z, mr(0, 6));
        else if (k < 0.56) crateStack(x, 0, z, mr(0, 3), 2);
        else if (k < 0.62) chicken(x, 0, z, mr(0, 6));
        else if (k < 0.7) { plasticChair(x, 0, z, mr(0, 6)); }
        else if (k < 0.76) sack(x, 0, z, 0xc8b088, mr(0, 6));
        else if (k < 0.8) donkey(x, 0, z, Math.atan2(-p.tz, p.tx));
      }
    }
  });
}
function buildTownPlaces() {
  dressSquareMain();
  rahbaSpices();
  kasbahSquare();
  gardenMellah();
  harbour();
  dressLanesTown();
}
