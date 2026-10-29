// =====================================================================
//  CITY — the new city: commercial avenues, residential quarters, industry & rail, outskirts
// =====================================================================
const CARCOL = [0xe8e6e0, 0x2a2c30, 0x8a8e94, 0x6a1a1a, 0x1a2a4a, 0xc8b89a, 0x3a4a3a, 0xb8bcc0, 0x5a3a2a];
// dress both pavements of a road: lamps, trees, furniture, parked cars, zebra crossings at junctions
function dressRoad(st, o = {}) {
  const rw = st.road / 2, pw = st.walk;
  if (!pw) return;
  const isX = (x, z) => { const id = GR.roadAt(x, z); return id && id !== st.id && STREETS[id - 1]?.road > 0; };
  for (const side of [-1, 1]) {
    let lastCross = -99;
    for (let s = 2; s < st.len - 2; s += 2) {
      const p = pathAt(st.pts, s), n = [-p.tz * side, p.tx * side], ry = Math.atan2(-p.tz, p.tx);
      const wx = p.x + n[0] * (rw + pw * 0.5), wz = p.z + n[1] * (rw + pw * 0.5);
      if (isX(wx, wz)) { if (s - lastCross > 6 && side > 0) { // zebra across this road just before the junction
          W.scope({ lod: 1 }, () => { for (let k = -rw + 0.5; k < rw - 0.3; k += 1.0) W.box(0.55, 0.012, 3.0, p.x - p.tx * 4 + (-p.tz) * k, 0.035, p.z - p.tz * 4 + p.tx * k, 0xe8e4d8, { ry: ry + Math.PI / 2, t: TX.none, ao: false, jit: 0.1 }); });
          if (mchance(0.6)) trafficLight(p.x + n[0] * (rw + 0.6) - p.tx * 6, 0.16, p.z + n[1] * (rw + 0.6) - p.tz * 6, ry + Math.PI / 2);
        }
        lastCross = s; continue; }
      if (s - lastCross < 7) continue;
      const k = Math.floor(s / 2);
      const lx = p.x + n[0] * (rw + 0.7), lz = p.z + n[1] * (rw + 0.7);
      if (o.lamp && k % Math.round(o.lamp / 2) === (side > 0 ? 0 : Math.round(o.lamp / 4))) W.scope({ lod: 1 }, () => streetLampModern(lx, 0.16, lz, ry + (side > 0 ? -Math.PI / 2 : Math.PI / 2), o.lampH ?? 8));
      else if (o.tree && k % Math.round(o.tree / 2) === 3) tree(p.x + n[0] * (rw + 1.4), 0.16, p.z + n[1] * (rw + 1.4), o.treeKind ?? mpick(['ficus', 'ficus', 'palm']), mr(0.75, 1.0));
      else if (mchance(o.furn ?? 0.06) && GR.get(p.x + n[0] * (rw + pw - 0.6), p.z + n[1] * (rw + pw - 0.6)) !== GR.PAVE) W.defer(() => W.scope({ lod: 1 }, () => { const fx = p.x + n[0] * (rw + pw - 0.6), fz = p.z + n[1] * (rw + pw - 0.6); const q = mrand(); if (q < 0.25) trashBin(fx, 0.16, fz); else if (q < 0.45) bench(fx, 0.16, fz, ry + (side > 0 ? Math.PI : 0)); else if (q < 0.6) utilityBox(fx, 0.16, fz, ry + (side > 0 ? Math.PI : 0)); else if (q < 0.7) roadSign(lx, 0.16, lz, ry + (side > 0 ? -Math.PI / 2 : Math.PI / 2)); else if (q < 0.8) scooter(fx, fz, ry, undefined, 0.16); else if (q < 0.88) kiosk(fx, 0.16, fz, ry + (side > 0 ? Math.PI : 0)); else dumpster(fx, 0.16, fz, ry + (side > 0 ? Math.PI : 0)); }), 'mid', [lx, lz]);
      // parked cars along the kerb
      if (o.park && s % 7 < 2 && mchance(o.park)) { const cx = p.x + n[0] * (rw - 1.2), cz = p.z + n[1] * (rw - 1.2); if (GR.roadAt(cx + p.tx * 3, cz + p.tz * 3) === st.id && GR.roadAt(cx - p.tx * 3, cz - p.tz * 3) === st.id) { const q = mrand(); W.defer(() => { if (q < 0.12) van(cx, cz, ry + (side > 0 ? 0 : Math.PI)); else sedan(cx, cz, ry + (side > 0 ? 0 : Math.PI) + mr(-0.04, 0.04), mpick(CARCOL), q < 0.3 ? mpick(['taxi', 'taxiB']) : 'car'); }, 'mid', [cx, cz]); s += 4; } }
    }
  }
}
// moving-traffic snapshot: a few cars stopped in lanes (cover on the open avenues)
function laneTraffic(st, n) {
  for (let i = 0; i < n; i++) {
    const s = mr(10, st.len - 10), p = pathAt(st.pts, s), side = mchance(0.5) ? 1 : -1, lane = st.median ? st.median / 2 + mr(1.5, st.road / 2 - st.median / 2 - 1.5) : mr(1.2, st.road / 2 - 1.2);
    const x = p.x + -p.tz * side * lane, z = p.z + p.tx * side * lane;
    if (GR.roadAt(x, z) !== st.id) continue;
    const ry = Math.atan2(-p.tz, p.tx) + (side > 0 ? 0 : Math.PI);
    const q = mrand();
    W.defer(() => { if (q < 0.08) bus(x, z, ry, mpick([0x2a6ab0, 0xd8302a, 0xe8c020])); else if (q < 0.2) van(x, z, ry); else if (q < 0.26) cargoTruck(x, z, ry, mpick([0x2a5aa0, 0xe8e6e0, 0xc8301a])); else sedan(x, z, ry, mpick(CARCOL), q < 0.5 ? mpick(['taxi', 'taxiB']) : 'car'); }, 'mid', [x, z]);
  }
}

// ---------------- MODERN COMMERCIAL DISTRICT ----------------
function buildModern() {
  const inMod = (x, z) => x > 128 && x < 652 && z > -322 && z < 302;
  const RB = [300, 30], rbR = 26;
  // boulevards meet at a roundabout with a monument
  const ave = [addStreet([[300, -330], [300, RB[1] - rbR - 4]], 36, 'boulevard', { road: 24, walk: 6, median: 4 }), addStreet([[300, RB[1] + rbR + 4], [300, 612]], 36, 'boulevard', { road: 24, walk: 6, median: 4 })];
  const blvd = [addStreet([[-40, 30], [RB[0] - rbR - 4, 30]], 32, 'boulevard', { road: 20, walk: 6, median: 3 }), addStreet([[RB[0] + rbR + 4, 30], [652, 30]], 32, 'boulevard', { road: 20, walk: 6, median: 3 })];
  const ring = []; for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2; ring.push([RB[0] + Math.cos(a) * rbR, RB[1] + Math.sin(a) * rbR]); }
  const rbs = addStreet(ring, 14, 'ring', { road: 11, walk: 1.5, raw: true });
  GR.street([RB, [RB[0] + 0.01, RB[1]]], (rbR - 5.5) * 2, GR.RESERVED);
  const grid = [
    addStreet([[190, -320], [190, 12]], 18, 'street', { road: 10, walk: 4 }), addStreet([[190, 48], [190, 300]], 18, 'street', { road: 10, walk: 4 }),
    addStreet([[430, -320], [430, 300]], 20, 'street', { road: 12, walk: 4 }),
    addStreet([[560, -320], [575, -150], [550, 0], [565, 150], [560, 300]], 18, 'street', { road: 10, walk: 4 }),
    addStreet([[130, -210], [652, -210]], 18, 'street', { road: 10, walk: 4 }),
    addStreet([[130, -110], [652, -110]], 18, 'street', { road: 10, walk: 4 }),
    addStreet([[118, 140], [652, 140]], 18, 'street', { road: 10, walk: 4 }),
    addStreet([[130, 230], [652, 230]], 18, 'street', { road: 10, walk: 4 }),
    addStreet([[130, -300], [652, -300]], 16, 'street', { road: 10, walk: 3 }),
  ];
  // the park and two car parks are kept open
  GR.rect(495, 185, 112, 76, 0, GR.RESERVED); GR.rect(495, -160, 104, 72, 0, GR.RESERVED); GR.rect(245, -160, 80, 70, 0, GR.RESERVED);
  for (const s of [...ave, ...blvd, ...grid, rbs]) roadway(s);
  // buildings: offices (enterable), glass towers, slabs, apartment blocks with shops; cafés on the boulevard
  let nOff = 0, nCafe = 0;
  const raise = (lots, frontage) => raiseLots(lots, (lot) => {
    if (frontage && nCafe < 8 && lot.w < 16 && mchance(0.3)) { nCafe++; cafe({ ...lot }); return; }
    if (nOff < 11 && lot.w >= 18 && lot.d >= 16 && mchance(0.22)) { nOff++; office({ ...lot, w: Math.min(lot.w, 26), d: Math.min(lot.d, 22) }, { floors: mpick([3, 4, 5]) }); return; }
    if (mchance(0.55)) modernShell(lot, { floors: Math.round(mr(4, frontage ? 13 : 9)) }); else aptShell(lot, { floors: mpick([5, 6, 7]), col: mpick([0xe8e4dc, 0xd8d0c0, MC.cream, 0xe0d8c8]), win: mpick(['glass', 'curtain', 'shut']), balcony: 0.5 });
  });
  for (const s of [...ave, ...blvd]) for (const sd of [1, -1]) raise(lotsAlong(s, sd, { wMin: 14, wMax: 30, dMin: 16, dMax: 28, region: inMod, gap: () => (mchance(0.25) ? mr(3, 8) : 0) }), true);
  for (const s of grid) for (const sd of [1, -1]) raise(lotsAlong(s, sd, { wMin: 16, wMax: 34, dMin: 14, dMax: 26, region: inMod, gap: () => (mchance(0.3) ? mr(4, 10) : 0) }), false);
  // deep block interiors: service yards and surface car parks
  for (const r of fillFree(128, -322, 652, 302, inMod, { cell: 4, max: 40, minA: 300 })) {
    if (r.w > 26 && r.d > 26 && mchance(0.45)) modernShell({ cx: r.cx, cz: r.cz, w: r.w - 10, d: r.d - 10, ry: 0, open: { s: true, n: true, e: true, w: true } }, { floors: Math.round(mr(3, 7)) });
    else if (r.w > 24 && r.d > 18 && mchance(0.5)) carPark(r.cx, r.cz, r.w - 4, r.d - 4); else yard(r);
  }
  // street life
  for (const s of [...ave, ...blvd]) { dressRoad(s, { lamp: 28, tree: 14, treeKind: 'palm', park: 0.35, furn: 0.08 }); laneTraffic(s, Math.floor(s.len / 45)); }
  for (const s of grid) { dressRoad(s, { lamp: 30, tree: 16, park: 0.3, furn: 0.06 }); laneTraffic(s, Math.floor(s.len / 90)); }
  for (const s of [...ave, ...blvd]) W.scope({ lod: 1 }, () => { for (let t = 15; t < s.len - 10; t += 22) { const p = pathAt(s.pts, t); if (GR.roadAt(p.x, p.z) === s.id) palm(p.x, 0.2, p.z, 9 + mr(-1, 2)); } });
  // roundabout monument: a tiled fountain basin, palms, a tall bronze lantern column
  fountain(RB[0], 0.2, RB[1], 9, 0);
  W.box(rbR * 1.4, 0.2, rbR * 1.4, RB[0], 0.1, RB[1], 0x5a6a3a, { t: TX.earth, wear: 2 });
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + 0.4; palm(RB[0] + Math.cos(a) * 14, 0.2, RB[1] + Math.sin(a) * 14, 10); }
  W.cyl(0.9, 1.3, 14, RB[0], 7.6, RB[1], 0xcdb28a, { seg: 8, t: TX.stone }); W.solid(2.2, 14, 2.2, RB[0], 7.6, RB[1], 'stone');
  W.cyl(1.4, 1.0, 1.4, RB[0], 15.2, RB[1], MC.brass, { seg: 8, layer: 'metal', t: TX.gebs }); W.cone(1.5, 2.0, RB[0], 16.9, RB[1], MC.tile, { seg: 8, t: TX.rooftile });
  // city park: lawns, palms, paths, a playground, a café kiosk
  cityPark(495, 185, 108, 72);
  carPark(495, -160, 98, 66); carPark(245, -160, 74, 64);
}
function cityPark(x, z, w, d) {
  groundPlate(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0x5c6a3a, TX.earth, 2, 0.05);
  for (const s of [-1, 1]) W.box(w, 0.02, 3, x, 0.07, z + s * d * 0.18, 0xd0c0a0, { t: TX.paving, ao: false });
  W.box(3, 0.02, d, x, 0.075, z, 0xd0c0a0, { t: TX.paving, ao: false });
  fountain(x, 0.05, z, 3.2, 5);
  for (let i = 0; i < 26; i++) { const px = x + mr(-w / 2 + 4, w / 2 - 4), pz = z + mr(-d / 2 + 4, d / 2 - 4); if (Math.abs(px - x) < 4 || Math.abs(pz - z - d * 0.18) < 3 || Math.abs(pz - z + d * 0.18) < 3) continue; tree(px, 0.05, pz, mpick(['palm', 'ficus', 'olive', 'orange']), mr(0.8, 1.2)); }
  W.scope({ lod: 1 }, () => {
    for (let i = 0; i < 10; i++) bench(x - w / 2 + 6 + i * (w - 12) / 9, 0.05, z + d * 0.18 + 2.2, Math.PI);
    for (let i = 0; i < 8; i++) lampPostOld(x - w / 2 + 6 + i * (w - 12) / 7, 0.05, z - d * 0.18 - 2.5, 4.2);
    kiosk(x + w / 2 - 8, 0.05, z - d / 2 + 6, 0);
    // playground: swings, slide, climbing frame
    const px = x - w / 2 + 14, pz = z - d / 2 + 12;
    W.box(14, 0.03, 10, px, 0.06, pz, 0xc8a87a, { t: TX.earth });
    for (const s of [-1, 1]) W.rod([px - 4 + s * 1.5, 0, pz - 2], [px - 4, 2.6, pz - 2], 0.05, 0xc8301a, { layer: 'metal' });
    W.rod([px - 5.5, 2.6, pz - 2], [px - 2.5, 2.6, pz - 2], 0.05, 0xc8301a, { layer: 'metal' });
    for (const s of [-0.7, 0.7]) { W.rod([px - 4 + s, 2.6, pz - 2], [px - 4 + s, 0.6, pz - 2], 0.01, 0x8a8a8a); W.box(0.5, 0.04, 0.2, px - 4 + s, 0.6, pz - 2, 0x2a2a2a); }
    W.box(0.8, 0.06, 3.2, px + 3, 1.0, pz, 0x2a8ac8, { rx: 0.6, layer: 'metal' }); W.box(1.2, 1.8, 1.2, px + 3, 0.9, pz - 1.9, 0xe8c020, { layer: 'metal' });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) W.rod([px - 1 + i * 0.6, 0, pz + 2.5 + j * 0.01], [px - 1 + i * 0.6, 1.8, pz + 2.5], 0.03, 0x3a8a3a, { layer: 'metal' });
  });
}
function carPark(x, z, w, d) {
  groundPlate(x - w / 2, z - d / 2, x + w / 2, z + d / 2, MC.asphalt, TX.asphalt, 4, 0.035);
  W.defer(() => W.scope({ lod: 1 }, () => {
    for (let r = 0; r < Math.floor(d / 14); r++) for (let i = 0; i < Math.floor(w / 2.8); i++) {
      const px = x - w / 2 + 1.4 + i * 2.8, pz = z - d / 2 + 4 + r * 14;
      W.box(0.1, 0.01, 5, px - 1.4, 0.045, pz + 1, 0xe8e4d8, { ao: false, t: TX.none });
      if (mchance(0.55)) { const q = mrand(); if (q < 0.1) van(px, pz + 1, Math.PI / 2); else sedan(px, pz + 1, Math.PI / 2 + (mchance(0.5) ? Math.PI : 0) + mr(-0.05, 0.05), mpick(CARCOL), q < 0.25 ? 'taxiB' : 'car'); }
    }
    for (let i = 0; i < 4; i++) streetLampModern(x - w / 2 + 6 + i * (w - 12) / 3, 0, z, 0, 9, true);
    W.box(3, 2.4, 3, x - w / 2 + 2.5, 1.2, z + d / 2 - 2.5, 0xe8e4dc, { t: TX.concrete }); W.solid(3, 2.4, 3, x - w / 2 + 2.5, 1.2, z + d / 2 - 2.5, 'concrete');
  }), 'mid', [x, z]);
}

// ---------------- RESIDENTIAL QUARTERS ----------------
const RESI = [[-382, 64], [128, 64], [128, 306], [652, 306], [652, 612], [-382, 612]];
function buildResidential() {
  const poly = [...RESI, RESI[0]];
  const inside = (x, z) => pip(poly, x, z) && polyDist(poly, x, z) > 2;
  // a warped street grid: every line meanders a little so blocks are never quite rectangular
  const streets = [];
  const wig = (a, b, amp, seed) => { const pts = []; const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 40)); for (let i = 0; i <= n; i++) { const t = i / n, x = lerp(a[0], b[0], t), z = lerp(a[1], b[1], t), dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), o = i === 0 || i === n ? 0 : (vnoise(t * 4 + seed, seed) - 0.5) * 2 * amp; pts.push([x - dz / L * o, z + dx / L * o]); } return pts; };
  for (const [x, z0, z1] of [[-330, 44, 612], [-235, 44, 612], [-140, 44, 612], [-45, 44, 612], [55, 44, 612], [170, 306, 612], [420, 306, 612], [530, 306, 612]]) streets.push(addStreet(wig([x, z0], [x, z1], 9, x * 0.01), 14, 'street', { road: 8, walk: 3 }));
  for (const [z, x0, x1] of [[150, -382, 190], [235, -382, 190], [395, -382, 652], [490, -382, 652], [585, -382, 652]]) streets.push(addStreet(wig([x0, z], [x1, z], 8, z * 0.013), 14, 'street', { road: 8, walk: 3 }));
  // two collector roads cutting diagonally (they make the irregular triangles and corner plazas)
  streets.push(addStreet([[-382, 330], [-200, 300], [0, 330], [128, 306]], 16, 'street', { road: 10, walk: 3 }));
  // reserve: football pitch, school yard, bus depot, a neighbourhood square with a fountain
  GR.rect(5, 545, 104, 70, 0, GR.RESERVED); GR.rect(-290, 545, 70, 60, 0, GR.RESERVED); GR.rect(590, 445, 90, 60, 0, GR.RESERVED); reserveSquare(-90, 440, 18); reserveSquare(475, 440, 16);
  for (const s of streets) roadway(s, { wear: 5 });
  let nApt = 0, nCafe = 0, nWork = 0;
  const raise = (lots) => raiseLots(lots, (lot) => {
    if (lot.w >= 11 && lot.d >= 11 && nApt < 30 && mchance(0.13)) { nApt++; apartment({ ...lot, w: Math.min(lot.w, 18), d: Math.min(lot.d, 15) }, { enter: true, floors: mpick([3, 4, 4, 5]), shops: mchance(0.55), balcony: 0.6 }); return; }
    if (lot.w <= 11 && nCafe < 12 && mchance(0.06)) { nCafe++; cafe(lot); return; }
    if (lot.w >= 10 && nWork < 14 && mchance(0.05)) { nWork++; workshop({ ...lot, w: Math.min(lot.w, 14) }); return; }
    aptShell(lot, { floors: mpick([3, 4, 4, 5, 5]), shops: mchance(0.5), balcony: 0.4, col: mpick([MC.plaster, MC.cream, MC.ochre, MC.rose, 0xe0d4c0, 0xd8c8a8, MC.whitewash, 0xe6d2b4]) });
  });
  for (const s of streets) for (const sd of [1, -1]) raise(lotsAlong(s, sd, { wMin: 12, wMax: 24, dMin: 11, dMax: 22, region: inside, gap: () => (mchance(0.15) ? mr(2, 5) : 0) }));
  // block interiors: courtyards with trees, parked cars, laundry, dumpsters
  for (const r of fillFree(-382, 64, 652, 612, inside, { cell: 4, max: 28, minA: 60 })) {
    // courtyard apartment blocks in the deeper block interiors, ringed by parking and yards
    if (r.w >= 18 && r.d >= 18 && mchance(0.6)) { aptShell({ cx: r.cx, cz: r.cz, w: r.w - 7, d: r.d - 7, ry: 0, open: { s: true, n: true, e: true, w: true } }, { floors: mpick([3, 4, 4, 5]), shops: false, balcony: 0.5, col: mpick([MC.plaster, MC.cream, MC.ochre, MC.rose, 0xe0d4c0, 0xd8c8a8, MC.whitewash]) }); yard({ ...r, ring: true }); }
    else yard(r);
  }
  for (const s of streets) dressRoad(s, { lamp: 34, tree: 22, park: 0.22, furn: 0.05, lampH: 7 });
  footballPitch(5, 545); school(-290, 545); busDepot(590, 445);
  dressSquare(-90, 440, 18); dressSquare(475, 440, 16);
}
function yard(r) { W.defer(() => yardNow(r), 'mid', [r.cx, r.cz]); }
function yardNow(r) {
  const { cx, cz, w, d } = r;
  if (r.ring) { W.scope({ lod: 1 }, () => { for (let i = 0; i < Math.min(10, Math.floor((w + d) / 6)); i++) { const sd = mrand(), t = mr(-0.4, 0.4); const x = sd < 0.5 ? cx + t * w : cx + (sd < 0.75 ? -1 : 1) * (w / 2 - 1.8), z = sd < 0.5 ? cz + (sd < 0.25 ? -1 : 1) * (d / 2 - 1.8) : cz + t * d; mpick([() => sedan(x, z, sd < 0.5 ? 0 : Math.PI / 2, mpick(CARCOL)), () => tree(x, 0, z, mpick(['olive', 'ficus', 'orange']), 0.7), () => dumpster(x, 0, z, sd < 0.5 ? 0 : Math.PI / 2), () => scooter(x, z, mr(0, 6)), () => plantPot(x, 0, z, 'palm', 1.3)])(); } }); return; }
  W.scope({ lod: 1 }, () => {
    const k = mrand();
    if (k < 0.35) { for (let i = 0; i < Math.min(6, Math.floor(w * d / 220)); i++) tree(cx + mr(-w / 2 + 2, w / 2 - 2), 0, cz + mr(-d / 2 + 2, d / 2 - 2), mpick(['olive', 'orange', 'ficus', 'palm']), mr(0.6, 1.0)); }
    else if (k < 0.65) { for (let i = 0; i < Math.min(8, Math.floor(w / 3.2)); i++) if (mchance(0.4)) sedan(cx - w / 2 + 1.6 + i * 3.2, cz + mr(-d / 4, d / 4), Math.PI / 2 + mr(-0.15, 0.15), mpick(CARCOL)); }
    else if (k < 0.8) { W.box(w - 2, 0.04, d - 2, cx, 0.02, cz, 0xb8a88a, { t: TX.paving, wear: 6, ao: false }); for (let i = 0; i < 3; i++) laundryLine(cx - w / 2 + 1, 2.0, cz + mr(-d / 3, d / 3), cx + w / 2 - 1, 2.0, cz + mr(-d / 3, d / 3), Math.floor(w / 0.8)); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) W.rod([cx + s * (w / 2 - 1), 0, cz + mr(-d / 3, d / 3)], [cx + s * (w / 2 - 1), 2.1, cz], 0.03, MC.iron); }
    else { dumpster(cx + mr(-w / 4, w / 4), 0, cz + mr(-d / 4, d / 4), mr(0, 3)); rubble(cx + mr(-w / 4, w / 4), 0, cz + mr(-d / 4, d / 4), 12); if (mchance(0.5)) scaffold(cx, 0, cz, mr(0, 3), 4, 4); }
    if (mchance(0.4)) { crateStack(cx + mr(-w / 3, w / 3), 0, cz + mr(-d / 3, d / 3), mr(0, 3), 3); }
  });
}
function footballPitch(x, z) {
  W.push(x, 0, z);
  W.box(100, 0.04, 66, 0, 0.02, 0, 0xa88a62, { t: TX.earth, wear: 6, ao: false });
  W.scope({ lod: 1 }, () => {
    for (const [w, d, px, pz] of [[96, 0.12, 0, -31], [96, 0.12, 0, 31], [0.12, 62, -48, 0], [0.12, 62, 48, 0], [0.12, 62, 0, 0]]) W.box(w, 0.012, d, px, 0.045, pz, 0xe8e4d8, { ao: false, t: TX.none });
    W.torus(9, 0.06, 0, 0.05, 0, 0xe8e4d8, { rx: Math.PI / 2, seg: 32 });
    for (const s of [-1, 1]) { const gx = s * 48; for (const t of [-1, 1]) W.cyl(0.06, 0.06, 2.44, gx, 1.22, t * 3.66, 0xe8e8e8, { seg: 6, layer: 'metal' }); W.cyl(0.06, 0.06, 7.32, gx, 2.44, 0, 0xe8e8e8, { rx: Math.PI / 2, seg: 6, layer: 'metal' }); W.box(1.6, 2.4, 7.3, gx + s * 0.8, 1.2, 0, 0xe8e8e8, { layer: 'glass' }); }
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { W.box(40, 0.4, 0.8, 0, 0.2 + i * 0.4, s * (36 + i * 0.8), 0x8a8e92, { layer: 'metal' }); W.solid(40, 0.4 + i * 0.4, 0.8, 0, (0.4 + i * 0.4) / 2, s * (36 + i * 0.8), 'metal', { walk: true }); }
    for (const s of [-1, 1]) for (const t of [-1, 1]) floodPole(s * 52, 0, t * 34, 0, 14, 2);
    chainFence(-52, -40, 52, -40, 3.2); chainFence(-52, 40, 52, 40, 3.2, 0, [0]); chainFence(-52, -40, -52, 40, 3.2, 0, [40]); chainFence(52, -40, 52, 40, 3.2);
    playBall(10, 0, 5, 0xe8e8e8);
  });
  W.pop();
}
function school(x, z) {
  // U-shaped two-storey shell around a playground, flag-less, with a mural band
  W.push(x, 0, z);
  W.box(70, 0.04, 60, 0, 0.02, 0, 0xc8b898, { t: TX.paving, wear: 5, ao: false });
  for (const [w, d, px, pz] of [[70, 12, 0, -24], [12, 36, -29, 6], [12, 36, 29, 6]]) aptShell({ cx: px, cz: pz, w, d, ry: 0, open: { s: true, n: true, e: true, w: true } }, { floors: 2, col: 0xe8dcc0, win: 'grille', balcony: 0, shops: false });
  W.scope({ lod: 1 }, () => { for (const s of [-1, 1]) { W.cyl(0.08, 0.08, 3, s * 6, 1.5, 10, 0xe86a1a, { seg: 6, layer: 'metal' }); W.box(1.8, 1.2, 0.05, s * 6, 3.2, 10, 0xe8e8e8, { layer: 'metal' }); } for (let i = 0; i < 6; i++) bench(-12 + i * 5, 0, 22, Math.PI); playBall(2, 0, 4, PC.redLt); });
  W.pop();
}
function busDepot(x, z) {
  W.push(x, 0, z);
  W.box(88, 0.04, 58, 0, 0.02, 0, MC.asphalt, { t: TX.asphalt, wear: 6, ao: false });
  for (let i = 0; i < 8; i++) bus(-35 + i * 10, 0, Math.PI / 2 + mr(-0.05, 0.05), mpick([0x2a6ab0, 0xd8302a, 0xe8c020, 0x2a8a5a]));
  W.box(60, 0.3, 14, 0, 7, -20, 0x6a6e72, { layer: 'metal', t: TX.corrugated, wear: 5 });
  for (let i = 0; i < 7; i++) { W.box(0.4, 7, 0.4, -30 + i * 10, 3.5, -26, 0x3a5a7a, { layer: 'metal' }); W.solid(0.4, 7, 0.4, -30 + i * 10, 3.5, -26, 'metal'); }
  W.pop();
  guardHouse({ cx: x + 40, cz: z + 26, w: 4, d: 3.4, ry: 0 });
}

// ---------------- INDUSTRY + RAIL ----------------
function buildIndustry() {
  const inInd = (x, z) => x > -96 && x < 652 && z > -664 && z < -432;
  // railway: main line + freight sidings + the station
  const RZ = -414;
  GR.rect(135, RZ, 1050, 16, 0, GR.RESERVED, true);
  railTrack(-385, RZ, 655, RZ); railTrack(-385, RZ + 5, 655, RZ + 5);
  for (const dz of [-8, -13, -18]) { GR.rect(468, RZ + dz, 376, 5, 0, GR.RESERVED, true); railTrack(280, RZ + dz, 655, RZ + dz); }
  station(-200, -388, 0, 72);
  for (let i = 0; i < 14; i++) freightWagon(320 + i * 14.2, RZ - 8, 0);
  for (let i = 0; i < 9; i++) freightWagon(420 + i * 14.2, RZ - 18, 0, mpick([0x3a4a5a, 0x7a3a2a, 0x2a5a3a]));
  gantryCrane(580, RZ - 13, Math.PI / 2, 26, 12);
  const roads = [
    addStreet([[-96, -470], [652, -470]], 16, 'street', { road: 10, walk: 3 }), addStreet([[-96, -610], [652, -610]], 16, 'street', { road: 10, walk: 3 }), addStreet([[40, -470], [40, -662]], 16, 'street', { road: 10, walk: 3 }), addStreet([[230, -470], [230, -662]], 16, 'street', { road: 10, walk: 3 }), addStreet([[430, -470], [430, -662]], 16, 'street', { road: 10, walk: 3 }), 
    addStreet([[-60, -430], [-60, -470]], 12, 'street', { road: 8, walk: 2 }), addStreet([[300, -426], [300, -470]], 12, 'street', { road: 8, walk: 2 }),
  ];
  // container yard and fuel depot claim space; level-crossings connect the industrial roads to the city
  GR.rect(530, -540, 172, 112, 0, GR.RESERVED, true); GR.rect(330, -540, 160, 84, 0, GR.RESERVED, true);
  for (const s of roads) roadway(s, { wear: 6, pave: 0x9a948a, paveTx: TX.concrete });
  groundPlate(-96, -664, 652, -434, 0x8a8478, TX.concrete, 6, 0.018);
  let nWh = 0, nWs = 0;
  const raise = (lots) => raiseLots(lots, (lot) => {
    if (lot.w >= 26 && lot.d >= 22 && nWh < 12 && mchance(0.35)) { nWh++; warehouse({ ...lot, w: Math.min(lot.w, 44), d: Math.min(lot.d, 32) }, { enter: true }); return; }
    if (lot.w < 20 && nWs < 12 && mchance(0.5)) { nWs++; workshop({ ...lot, w: Math.min(lot.w, 16) }); return; }
    warehouse(lot, { enter: false });
    // yard clutter in front of closed sheds
    W.scope({ lod: 1 }, () => { const c = Math.cos(lot.ry), s = Math.sin(lot.ry); for (let i = 0; i < 3; i++) { const lx = mr(-lot.w / 2 + 2, lot.w / 2 - 2), lz = lot.d / 2 + 2.5; const x = lot.cx + lx * c + lz * s, z = lot.cz - lx * s + lz * c; mpick([() => pallet(x, 0, z, mr(0, 3)), () => drum(x, 0, z, mpick([PC.blue, PC.redLt]), 0), () => crateStack(x, 0, z, mr(0, 3), 2)])(); } });
  });
  for (const s of roads) for (const sd of [1, -1]) raise(lotsAlong(s, sd, { wMin: 22, wMax: 46, dMin: 20, dMax: 36, region: inInd, gap: () => mr(4, 12), setback: 3 }));
  for (const s of roads) dressRoad(s, { lamp: 36, park: 0.15, furn: 0.05, lampH: 9 });
  for (const s of roads) laneTraffic(s, Math.floor(s.len / 120));
  for (const r of fillFree(-96, -664, 652, -434, inInd, { cell: 4, max: 40, minA: 200 })) W.scope({ lod: 1 }, () => { for (let i = 0; i < Math.min(8, Math.floor(r.w * r.d / 120)); i++) { const x = r.cx + mr(-r.w / 2 + 3, r.w / 2 - 3), z = r.cz + mr(-r.d / 2 + 3, r.d / 2 - 3); mpick([() => container(x, 0, z, mpick([0, Math.PI / 2]), mpick([PC.redLt, 0x2a5aa0, 0x3a7a4a, 0x8a8e92])), () => crateStack(x, 0, z, mr(0, 3), 3), () => pallet(x, 0, z, mr(0, 3)), () => cargoTruck(x, z, mr(0, 6), mpick([0x2a5aa0, 0xe8e6e0])), () => drum(x, 0, z, PC.blue, 0)])(); } });
  containerYard(530, -540, 160, 100);
  fuelDepot(330, -540);
  // industrial perimeter: a concrete wall along the rail with two gates and guard posts
  for (const [x0, x1] of [[-90, -66], [-54, 294], [306, 650]]) { W.box(x1 - x0, 3, 0.4, (x0 + x1) / 2, 1.5, -432, MC.concrete, { t: TX.concrete, wear: 6 }); W.solid(x1 - x0, 3, 0.4, (x0 + x1) / 2, 1.5, -432, 'concrete'); W.scope({ lod: 1 }, () => { for (let x = x0 + 1; x < x1; x += 3) W.rod([x, 3, -432], [x, 3.6, -432.3], 0.02, 0x8a8e92); W.cable([x0, 3.5, -432.2], [x1, 3.5, -432.2], 0.05, 0.008, 0x8a8e92, Math.max(2, Math.round((x1 - x0) / 6))); }); }
  for (const gx of [-60, 300]) { guardHouse({ cx: gx + 9, cz: -440, w: 4, d: 3.4, ry: Math.PI }); W.box(6, 0.15, 0.15, gx, 1.0, -436, 0xd8302a, { layer: 'metal', ry: 0 }); }
}
function containerYard(x, z, w, d) {
  const cols = [PC.redLt, 0x2a5aa0, 0x3a7a4a, 0xe8b020, 0x8a8e92, 0xd86a2a, 0x5a3a7a, 0x2a8a8a];
  for (let r = 0; r < 6; r++) for (let i = 0; i < 9; i++) {
    if (mchance(0.12)) continue;
    const cx = x - w / 2 + 12 + i * 15.5, cz = z - d / 2 + 10 + r * 17;
    const h = Math.floor(mr(1, 4));
    for (let k = 0; k < h; k++) container(cx, k * 2.6, cz, (k % 2) * 0 + (mchance(0.1) ? 0.05 : 0), mpick(cols), { long: true });
  }
  gantryCrane(x, z, 0, w - 10, 16);
  W.scope({ lod: 1 }, () => { for (let i = 0; i < 4; i++) streetLampModern(x - w / 2 + 10 + i * (w - 20) / 3, 0, z + d / 2 - 3, 0, 12, true); forklift(x + 20, z + d / 2 - 8, 0.4); forklift(x - 30, z - 10, 2.1); });
}
function fuelDepot(x, z) {
  for (let i = 0; i < 3; i++) fuelTank(x - 45 + i * 30, 0, z - 15, 0, 18, 3.2);
  for (let i = 0; i < 4; i++) { W.cyl(6, 6, 9, x - 50 + i * 30, 4.5, z + 18, 0xe8e6e0, { seg: 20, layer: 'metal', t: TX.metal, wear: 4 }); W.solid(12, 9, 12, x - 50 + i * 30, 4.5, z + 18, 'metal'); W.scope({ lod: 1 }, () => { for (let k = 0; k < 12; k++) W.rod([x - 50 + i * 30 + Math.cos(k * 0.5) * 6.05, 0, z + 18 + Math.sin(k * 0.5) * 6.05], [x - 50 + i * 30 + Math.cos(k * 0.5 + 0.6) * 6.05, 9, z + 18 + Math.sin(k * 0.5 + 0.6) * 6.05], 0.04, 0x8a8e92, { layer: 'metal' }); }); }
  pipeRun(x - 70, 1.2, z, x + 70, 1.2, z, 0.25, 0x7a8a6a); pipeRun(x - 70, 1.8, z + 1, x + 70, 1.8, z + 1, 0.18, 0xc8a020);
  chainFence(x - 75, z - 38, x + 75, z - 38, 3); chainFence(x - 75, z + 38, x + 75, z + 38, 3, 0, [0]);
  transformer(x + 60, 0, z - 30); bigGenerator(x + 52, 0, z - 30, 0);
}

// ---------------- OUTSKIRTS: olive groves, cemetery, farmsteads, the road out ----------------
function buildOutskirts() {
  // olive groves south-west of the walls (long sight lines between the rows)
  for (let x = -810; x < -420; x += 9) for (let z = 505; z < 640; z += 9) if (mchance(0.85)) tree(x + mr(-1.5, 1.5), 0, z + mr(-1.5, 1.5), 'olive', mr(0.8, 1.15));
  // a whitewashed cemetery north of the medina
  W.scope({ lod: 1 }, () => {
    for (let i = 0; i < 26; i++) for (let j = 0; j < 12; j++) { if (mchance(0.15)) continue; const x = -760 + i * 6 + mr(-1, 1), z = -655 + j * 5 + mr(-1, 1); W.box(0.6, 0.4, 1.9, x, 0.2, z, 0xe8e6e0, { t: TX.plaster, wear: 6, ry: 0.1 }); W.box(0.25, 0.7, 0.12, x, 0.55, z - 0.9, 0xe8e6e0, { t: TX.plaster, wear: 6 }); }
  });
  for (let k = 0; k < 2; k++) { W.push(-685 + k * 60, 0, -638); W.box(6, 5, 6, 0, 2.5, 0, 0xf0ece4, { t: TX.plaster, wear: 3 }); W.solid(6, 5, 6, 0, 2.5, 0, 'plaster'); W.hemi(5.4, 4.0, 5.4, 0, 5, 0, 0xf0ece4, { seg: 12, hseg: 6, t: TX.plaster }); faceDoor('s', 6, 6, 0, 0, 1.0, 1.9, 'metal', { doorCol: MC.green, arch: true }); W.pop(); }
  // farmsteads and walls
  for (const [x, z] of [[-890, 300], [-900, -350], [720, 420], [730, -150], [200, 690], [-200, 700], [450, -730], [-500, -740]]) {
    const y = terrainH(x, z) - 0.3;
    medinaShell({ cx: x, cz: z, y, w: mr(9, 13), d: mr(8, 11), ry: mr(0, 3), open: { s: true, n: true, e: true, w: true } }, { H: 4.6, col: MC.pise, tx: TX.pise, parapet: 'low' });
    for (let i = 0; i < 6; i++) tree(x + mr(-25, 25), terrainH(x, z), z + mr(-25, 25), 'olive', mr(0.7, 1.1));
  }
  // road out of the west gate up into the hills
  const west = addStreet([[-830, -54], [-880, -40], [-930, -10]], 10, 'road', { road: 8, walk: 0 });
  roadway(west, { wear: 7 });
}

// ---------------- spawn + targets ----------------
const SPAWN = { x: -230, z: -150, yaw: -Math.PI / 2 };
function placeWorldTargets() {
  const T = (x, z, ry, kind = 'paper', y) => kind === 'paper' ? addPaper(0, 0, { at: { x, z, ry, y } }) : addSteel(0, 0, kind === 'gong' ? 'circle' : kind === 'ipsc' ? 'rect' : 'circle', kind === 'gong' ? 0.7 : 0.45, { at: { x, z, ry, y }, label: kind === 'gong' ? 'GONG' : 'STEEL' });
  // market square: paper targets between the food stalls
  for (let i = 0; i < 5; i++) T(SQ.x0 + 18 + i * 7, SQ.z1 - 25, Math.PI / 2 * 0);
  // medina: a tannery shooting lane and steel down the main street
  for (let i = 0; i < 4; i++) T(-665 + i * 10, -428, 0, i % 2 ? 'steel' : 'paper', 0.9);
  T(-600, -62, Math.PI / 2, 'steel'); T(-700, -57, Math.PI / 2, 'ipsc');
  // civic garden: steel between the parterres; palace roof gong (long shot from the plaza)
  for (let i = 0; i < 3; i++) T(40, -95 + i * 8, -Math.PI / 2, 'steel', 1.65 + G0);
  // freight yard long range: 100–400 m steel lane along the sidings
  for (const d of [80, 160, 240, 320]) T(300 + d, -470 + 9, 0, d >= 240 ? 'gong' : 'steel');
  // modern car park + boulevard median
  for (let i = 0; i < 4; i++) T(470 + i * 10, -165, 0, i % 2 ? 'ipsc' : 'paper');
  // residential football pitch: mixed lane
  for (let i = 0; i < 6; i++) T(-40 + i * 15, 545, Math.PI / 2, i % 3 === 0 ? 'steel' : 'paper');
}

// generation steps (run one per frame so the loading bar can move)
function cityPlan() {
  return [
    ['Laying out the civic plaza', buildCivicPlaza],
    ['Raising the palace and clock tower', () => { civicPalace(60, -60, -Math.PI / 2); GR.rect(60, -60, 100, 122, 0, GR.RESERVED, true); }],
    ['Stalls and souks of the grand market', buildMarket],
    ['Walls, lanes and riads of the medina', buildMedina],
    ['The Mellah quarter', buildMellah],
    ['Rail yards and industry', buildIndustry],
    ['Boulevards and towers', buildModern],
    ['Residential quarters', buildResidential],
    ['Olive groves and outskirts', buildOutskirts],
  ];
}
