// =====================================================================
//  RAVENSCROFT HOUSE — the main block (three floors), two wings (two floors) round a courtyard
// =====================================================================
// Rooms are laid out along corridors from a list per floor, and each is furnished by its kind; the
// furniture streams in only near the camera. The façade is drawn bay by bay: rusticated ground floor,
// pedimented piano nobile, square attic windows, cornices, a balustrade with urns, a dome over the hall.
const HOUSE = {
  main: { x0: -50, x1: 50, z0: -66, z1: -32 }, FH: [5.0, 4.5, 4.2], T: 0.5,
  corr: [-50, -47],            // main corridor (z) on every floor
  hall: [-10, 10],             // the central hall (x), open through the ground floor
  wings: [{ x0: -72, x1: -50, cx: -61, side: -1 }, { x0: 50, x1: 72, cx: 61, side: 1 }], wingZ: [-66, 10], wingCorr: 3,
};
const HY = (f) => HOUSE.FH.slice(0, f).reduce((a, b) => a + b, 0);
const WALL_IN = [0xefe6d4, 0xe6dccb, 0xe8e2d6, 0xdcd0bc, 0xd8e0dc, 0xe8d8d0];
// each floor's rooms: [x0, x1, kind] along the south side (corridor → +z) and the north side (corridor → −z)
const PLAN = {
  0: { S: [[-50, -10, 'ballroom'], [10, 30, 'dining'], [30, 50, 'music']], N: [[-50, -30, 'library'], [-30, -10, 'billiards'], [10, 30, 'drawing'], [30, 50, 'gallery']] },
  1: { S: [[-50, -40, 'bedroom'], [-40, -30, 'bath'], [-30, -20, 'bedroom'], [-20, -10, 'dressing'], [10, 30, 'master'], [30, 40, 'dressing'], [40, 50, 'bath']],
       N: [[-50, -38, 'security'], [-38, -26, 'guardroom'], [-26, -10, 'sitting'], [10, 24, 'study'], [24, 36, 'office'], [36, 42, 'bath'], [42, 50, 'bedroom']] },
  2: { S: [[-50, -40, 'nursery'], [-40, -30, 'bedroom'], [-30, -20, 'bedroom'], [-20, -10, 'bath'], [10, 20, 'bedroom'], [20, 30, 'bedroom'], [30, 40, 'servants'], [40, 50, 'servants']],
       N: [[-50, -38, 'store'], [-38, -26, 'servants'], [-26, -10, 'chapel'], [10, 22, 'servants'], [22, 34, 'store'], [34, 42, 'bath'], [42, 50, 'servants']] },
};
// the wings: rooms along z, either side of the wing corridor (west side of the corridor = 'in', toward the courtyard)
const WPLAN = {
  '-1:0': { in: [[-47, -32, 'gunroom'], [-32, -12, 'orangery'], [-12, 10, 'games']], out: [[-66, -50, 'pool'], [-47, -30, 'cinema'], [-30, -12, 'chapel'], [-12, 10, 'garage']] },
  '-1:1': { in: [[-47, -35, 'bedroom'], [-35, -23, 'bedroom'], [-23, -11, 'bath'], [-11, 10, 'bedroom']], out: [[-66, -50, 'sitting'], [-47, -35, 'bedroom'], [-35, -23, 'bedroom'], [-23, -11, 'bedroom'], [-11, 10, 'gallery']] },
  '1:0': { in: [[-47, -30, 'pantry'], [-30, -12, 'servanthall'], [-12, 10, 'laundry']], out: [[-66, -50, 'scullery'], [-47, -18, 'kitchen'], [-18, 0, 'wine'], [0, 10, 'boots']] },
  '1:1': { in: [[-47, -35, 'servants'], [-35, -23, 'servants'], [-23, -11, 'bath'], [-11, 10, 'servants']], out: [[-66, -50, 'office'], [-47, -35, 'servants'], [-35, -23, 'servants'], [-23, -11, 'servants'], [-11, 10, 'store']] },
};

function manorBigHouse() {
  const { main: M2, T } = HOUSE, H3 = HY(3), HW = HY(2);
  for (const r of [M2, ...HOUSE.wings.map((w) => ({ x0: w.x0, x1: w.x1, z0: HOUSE.wingZ[0], z1: HOUSE.wingZ[1] }))]) GR.rect((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, r.x1 - r.x0 + 1, r.z1 - r.z0 + 1, 0, GR.RESERVED, true);
  // ---------- outer walls, floor by floor ----------
  for (let f = 0; f < 3; f++) {
    const y0 = HY(f), H = HOUSE.FH[f];
    // main block: south (courtyard) and north (garden) fronts; its ends are shared with the wings
    facade('x', M2.x0, M2.x1, M2.z1, 1, f, y0, H, f === 0 ? [[0, 'door']] : []);
    facade('x', M2.x0, M2.x1, M2.z0, -1, f, y0, H, f === 0 ? [[-3, 'french'], [3, 'french'], [-25, 'french'], [25, 'french']] : []);
    if (f === 2) for (const s of [-1, 1]) facade('z', M2.z0, M2.z1, s * 50, s, f, y0, H, []);   // above the wings, the end walls are outside
  }
  for (const w of HOUSE.wings) for (let f = 0; f < 2; f++) {
    const y0 = HY(f), H = HOUSE.FH[f], s = w.side, outX = s < 0 ? w.x0 : w.x1, inX = s < 0 ? w.x1 : w.x0;
    facade('z', HOUSE.wingZ[0], HOUSE.wingZ[1], outX, s, f, y0, H, f === 0 ? [[-22, 'door']] : []);
    facade('z', HOUSE.main.z1, HOUSE.wingZ[1], inX, -s, f, y0, H, f === 0 ? [[-10, 'door']] : []);     // courtyard face
    facade('x', w.x0, w.x1, HOUSE.wingZ[1], 1, f, y0, H, f === 0 ? [[w.cx, 'door']] : []);              // the wing's end
    facade('x', w.x0, w.x1, HOUSE.wingZ[0], -1, f, y0, H, []);
  }
  // ---------- floors and stairs ----------
  stairs();
  // ---------- rooms ----------
  for (let f = 0; f < 3; f++) mainFloor(f);
  for (const w of HOUSE.wings) for (let f = 0; f < 2; f++) wingFloor(w, f);
  // ---------- roofs: main block flat behind a balustrade, the dome over the hall; pitched slate on the wings ----------
  slab(M2.x0 - 0.3, M2.z0 - 0.3, M2.x1 + 0.3, M2.z1 + 0.3, H3, { top: 0x5a5a58, topTx: TX.concrete, bot: 0xf0ece4 });
  W.box(M2.x1 - M2.x0 + 1.4, 0.7, M2.z1 - M2.z0 + 1.4, 0, H3 + 0.1, (M2.z0 + M2.z1) / 2, STONE, { t: TX.stone });
  for (const [xa, za, xb, zb] of [[M2.x0, M2.z1, M2.x1, M2.z1], [M2.x0, M2.z0, M2.x1, M2.z0], [M2.x0, M2.z0, M2.x0, M2.z1], [M2.x1, M2.z0, M2.x1, M2.z1]]) { W.push(0, H3 + 0.3, 0); balustrade(xa, za, xb, zb); W.pop(); }
  for (let x = M2.x0; x <= M2.x1; x += 10) for (const z of [M2.z0, M2.z1]) urn(x, H3 + 1.6, z);
  pitched(M2.x0 + 2, M2.z0 + 2, -12, M2.z1 - 2, H3 + 0.45, 4.2, SLATE); pitched(12, M2.z0 + 2, M2.x1 - 2, M2.z1 - 2, H3 + 0.45, 4.2, SLATE);
  for (const x of [-42, -30, -18, 18, 30, 42]) for (const z of [-60, -38]) { W.box(1.6, 4.6, 1.1, x, H3 + 2.6, z, 0x8a6a54, { t: TX.brick }); W.box(1.8, 0.3, 1.3, x, H3 + 5.0, z, STONE); for (const k of [-0.4, 0, 0.4]) W.cyl(0.12, 0.12, 0.5, x + k, H3 + 5.4, z, 0x8a5a3a, { seg: 6 }); }
  // dormers in the slate
  W.scope({ lod: 1 }, () => { for (let x = -45; x <= 45; x += 10) if (Math.abs(x) > 12) for (const [z, ry] of [[M2.z1 - 4.2, 0], [M2.z0 + 4.2, Math.PI]]) { W.push(x, H3 + 1.3, z, ry); W.box(2.2, 2.0, 2.0, 0, 1.0, 0, STONE, { t: TX.stone }); W.box(1.2, 1.2, 0.05, 0, 1.0, 1.02, mchance(0.5) ? 0xd8b880 : 0x1a1e24, { layer: mchance(0.5) ? 'glow' : 'pane' }); W.pyramid(2.6, 1.0, 2.4, 0, 2.5, 0, SLATE, { t: TX.rooftile }); W.pop(); } });
  // the dome on its drum, the lantern on top
  const dy = H3 + 0.5;
  W.cyl(8.6, 8.6, 4.4, 0, dy + 2.2, -49, STONE, { seg: 24, t: TX.stone });
  W.scope({ lod: 1 }, () => { for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; W.box(1.0, 2.6, 0.2, Math.cos(a) * 8.65, dy + 2.2, -49 + Math.sin(a) * 8.65, k % 2 ? 0x1a2028 : 0xd8b880, { layer: k % 2 ? 'pane' : 'glow', ry: -a + Math.PI / 2 }); W.box(0.5, 4.4, 0.6, Math.cos(a + 0.2) * 8.8, dy + 2.2, -49 + Math.sin(a + 0.2) * 8.8, STONE, { ry: -a }); } });
  W.box(18.4, 0.5, 18.4, 0, dy + 4.6, -49, STONE, { t: TX.stone });
  W.hemi(17, 9, 17, 0, dy + 4.7, -49, 0x6a8a84, { seg: 24, hseg: 8, t: TX.metal });
  W.cyl(1.6, 1.8, 3.4, 0, dy + 13.3, -49, STONE, { seg: 10 }); W.cone(1.9, 2.6, 0, dy + 16.3, -49, 0x6a8a84, { seg: 10 }); W.sphere(0.5, 0.5, 0.5, 0, dy + 17.8, -49, 0xc8a050, { layer: 'metal' });
  for (const w of HOUSE.wings) {
    const z0 = HOUSE.wingZ[0], z1 = HOUSE.wingZ[1];
    slab(w.x0 - 0.3, z0 - 0.3, w.x1 + 0.3, z1 + 0.3, HW, { top: 0x5a5a58, topTx: TX.concrete, bot: 0xf0ece4 });
    W.box(w.x1 - w.x0 + 1.2, 0.6, z1 - z0 + 1.2, w.cx, HW + 0.3, (z0 + z1) / 2, STONE, { t: TX.stone });
    pitched(w.x0 - 0.4, z0 - 0.4, w.x1 + 0.4, z1 + 0.4, HW + 0.6, 5.5, SLATE);
    for (const z of [-56, -30, -6]) { W.box(1.4, 4.2, 1.0, w.cx + w.side * 6, HW + 4.2, z, 0x8a6a54, { t: TX.brick }); W.box(1.6, 0.25, 1.2, w.cx + w.side * 6, HW + 6.4, z, STONE); }
    W.scope({ lod: 1 }, () => { for (let z = -60; z < 8; z += 8) for (const sx of [-1, 1]) { const x = w.cx + sx * 5.2; W.push(x, HW + 1.6, z, sx * Math.PI / 2); W.box(2.0, 1.8, 1.8, 0, 0.9, 0, STONE, { t: TX.stone }); W.box(1.1, 1.1, 0.05, 0, 0.9, 0.92, mchance(0.55) ? 0xd8b880 : 0x1a1e24, { layer: 'glow' }); W.pyramid(2.4, 0.9, 2.2, 0, 2.25, 0, SLATE, { t: TX.rooftile }); W.pop(); } });
  }
  // ---------- the portico: eight columns two floors tall, a pediment, the balcony over the door ----------
  const pz = M2.z1, ph = HY(2);
  for (let k = 0; k < 8; k++) { const cx = -10.5 + k * 3; W.cyl(0.55, 0.62, ph - 1.0, cx, ph / 2, pz + 8, STONE, { seg: 14, t: TX.stone }); W.box(1.5, 0.5, 1.5, cx, 0.4, pz + 8, STONE); W.box(1.4, 0.5, 1.4, cx, ph - 0.25, pz + 8, STONE); W.solid(1.2, ph, 1.2, cx, ph / 2, pz + 8, 'stone'); }
  W.box(25, 1.2, 9.2, 0, ph + 0.6, pz + 4.4, STONE, { t: TX.stone });
  W.tris(twoSided([-12.5, ph + 1.2, pz + 9, 12.5, ph + 1.2, pz + 9, 0, ph + 5.4, pz + 9]), STONE, { t: TX.stone });
  W.box(8, 1.4, 0.2, 0, ph + 2.4, pz + 9.08, 0xc8b898, { t: TX.carved, lod: 1 });   // carved arms in the tympanum
  pitched(-12.5, pz, 12.5, pz + 9, ph + 1.2, 4.2, SLATE);
  slab(-12.5, pz, 12.5, pz + 9.4, 0.4, { top: STONE, topTx: TX.stone, bot: false });
  for (let k = 0; k < 5; k++) W.box(28 - k * 0.8, 0.2, 1.0, 0, 0.3 - k * 0.1 - 0.2, pz + 9.9 + k * 0.9, STONE, { t: TX.stone });
  for (const s of [-1, 1]) { W.box(1.6, 1.6, 4, s * 13.5, 0.8, pz + 11, STONE, { t: TX.stone }); W.sphere(1.0, 1.0, 1.0, s * 13.5, 2.2, pz + 12.4, STONE, { t: TX.stone }); lampPostOld(s * 13.5, 1.6, pz + 9.6, 1.6); }
  // the balcony over the portico, reached from the first floor
  slab(-12, pz, 12, pz + 8.6, HY(1), { top: STONE, topTx: TX.stone, bot: 0xe8e0d0, thk: 0.4 });
  W.push(0, HY(1), 0); balustrade(-12, pz + 8.6, 12, pz + 8.6); W.pop();
  // façade lighting: lamps washing the stone, light spilling from every window
  for (const x of [-40, -20, 20, 40]) W.lamp(x, 1.2, M2.z1 + 6, 0xffcc90, 2.4, 18, { halo: 0 });
  for (const x of [-61, 61]) W.lamp(x, 1.2, 14, 0xffcc90, 2.0, 14, { halo: 0 });
}

// ---------- a façade line, one floor: bays of windows every 5 m, doors where asked, mouldings ----------
function facade(ax, a0, a1, c, side, f, y0, H, doors) {
  const ops = [], bay = 5;
  for (let a = a0 + bay / 2; a < a1; a += bay) {
    const d = doors.find(([at]) => Math.abs(at - a) < bay / 2);
    if (d) { ops.push(d[1] === 'door' ? { at: d[0], w: 2.6, h: 3.8, kind: 'door', style: 'plank', leaf: 'open' } : { at: d[0], w: 1.8, h: 3.4, kind: 'door', style: 'glass', leaf: 'open' }); continue; }
    if (f === 0) ops.push({ at: a, w: 1.7, h: 3.4, sill: 0.6, kind: 'archwin', arch: 'round', _spring: 2.5, win: 'plain', rimCol: STONE, rimTx: TX.stone });
    else if (f === 1) ops.push({ at: a, w: 1.6, h: 3.0, sill: 0.5, kind: 'win', win: 'plain', sillCol: STONE });
    else ops.push({ at: a, w: 1.4, h: 1.7, sill: 1.0, kind: 'win', win: 'plain', sillCol: STONE });
  }
  walls([[ax, a0, a1, c, side, ops]], y0, H, HOUSE.T, f === 0 ? STONE_DK : STONE, WALL_IN[(Math.abs(Math.round(c)) + f) % WALL_IN.length], { tx: TX.stone, dimIn: 0.72 });
  // mouldings on the face: string course under each floor, rustication on the ground floor, pediments on the piano nobile
  W.scope({ lod: 1 }, () => {
    const L = a1 - a0, m = (a0 + a1) / 2, o = c + side * (HOUSE.T / 2 + 0.08);
    const bx = (w, h, d, a, y) => ax === 'x' ? W.box(w, h, d, a, y, o, STONE, { t: TX.stone }) : W.box(d, h, w, o, y, a, STONE, { t: TX.stone });
    bx(L + 0.4, 0.35, 0.3, m, y0 + H - 0.1);
    if (f === 0) { for (let y = 0.9; y < H - 0.5; y += 0.9) bx(L, 0.06, 0.12, m, y); bx(L + 0.2, 0.6, 0.35, m, 0.3); }
    for (let a = a0 + bay / 2; a < a1; a += bay) {
      if (doors.some(([at]) => Math.abs(at - a) < bay / 2)) continue;
      if (f === 1) { bx(2.2, 0.18, 0.3, a, y0 + 3.6); if (ax === 'x') W.tris(twoSided([a - 1.15, y0 + 3.7, o + side * 0.15, a + 1.15, y0 + 3.7, o + side * 0.15, a, y0 + 4.3, o + side * 0.15]), STONE, { t: TX.stone }); else W.tris(twoSided([o + side * 0.15, y0 + 3.7, a - 1.15, o + side * 0.15, y0 + 3.7, a + 1.15, o + side * 0.15, y0 + 4.3, a]), STONE, { t: TX.stone }); }
      if (a + bay / 2 < a1) bx(0.6, H - 0.4, 0.18, a + bay / 2, y0 + (H - 0.4) / 2);   // pilaster between bays
      if (f === 0 && side > 0 && ax === 'x') { W.box(0.9, 0.5, 0.4, a, 0.95, o + side * 0.3, STONE); W.box(0.85, 0.3, 0.35, a, 1.3, o + side * 0.3, 0x3a5a2a, { t: TX.leaf }); for (let k = 0; k < 5; k++) W.sphere(0.1, 0.1, 0.1, a - 0.35 + k * 0.17, 1.48, o + side * 0.3, mpick([0xd83a4a, 0xf0e0e8, 0xe8b030]), { seg: 5, hseg: 3 }); }   // window boxes
    }
  });
}

// ---------- stairs: the grand pair in the hall, a service pair at each end of the main block ----------
const STAIRHOLES = { 1: [], 2: [] };
function stairs() {
  for (const x of [-6, 6, -45, 45]) {
    const run1 = Math.round(HOUSE.FH[0] / ST_RISE) * ST_RUN, run2 = Math.round(HOUSE.FH[1] / ST_RISE) * ST_RUN, grand = Math.abs(x) < 10, w = grand ? 2.6 : 1.4;
    flight(x, -34.3, [0, -1], w, 0.15, HY(1), { col: grand ? 0xe8e0d0 : 0xb8b0a0, tx: TX.stone });
    STAIRHOLES[1].push([x - w / 2 - 0.1, -34.3 - run1 - 0.4, x + w / 2 + 0.1, -32.5]);
    flight(x, -65.4, [0, 1], w, HY(1), HY(2), { col: grand ? 0xe8e0d0 : 0xb8b0a0, tx: TX.stone });
    STAIRHOLES[2].push([x - w / 2 - 0.1, -65.6, x + w / 2 + 0.1, -65.4 + run2 + 0.4]);
    W.push(0, 0, 0); railing(x + w / 2 + 0.1, -34.3 - run1, x + w / 2 + 0.1, -34.3, HY(1), 'iron'); railing(x - w / 2 - 0.1, -34.3 - run1, x - w / 2 - 0.1, -34.3, HY(1), 'iron'); W.pop();
  }
  const M2 = HOUSE.main, T = HOUSE.T;
  slab(M2.x0 + T, M2.z0 + T, M2.x1 - T, M2.z1 - T, 0.15, { top: 0xd8d4cc, topTx: TX.ceramic, bot: false });
  // the hall rises through two floors: a gallery round it on the first
  slab(M2.x0 + T, M2.z0 + T, M2.x1 - T, M2.z1 - T, HY(1), { top: 0x8a5a3a, topTx: TX.wood, bot: 0xf0ece4, holes: [...STAIRHOLES[1], [-4.4, -60, 4.4, -36]] });
  railing(-4.4, -60, 4.4, -60, HY(1), 'iron'); railing(-4.4, -36, 4.4, -36, HY(1), 'iron'); railing(-4.4, -60, -4.4, -36, HY(1), 'iron'); railing(4.4, -60, 4.4, -36, HY(1), 'iron');
  slab(M2.x0 + T, M2.z0 + T, M2.x1 - T, M2.z1 - T, HY(2), { top: 0x7a5a3a, topTx: TX.wood, bot: 0xf0ece4, holes: STAIRHOLES[2] });
  for (const w of HOUSE.wings) {
    slab(w.x0 + T, HOUSE.wingZ[0] + T, w.x1 - T, HOUSE.wingZ[1] - T, 0.15, { top: w.side > 0 ? 0xc8c8c0 : 0x8a6a4a, topTx: w.side > 0 ? TX.ceramic : TX.wood, bot: false });
    slab(w.x0 + T, HOUSE.wingZ[0] + T, w.x1 - T, HOUSE.wingZ[1] - T, HY(1), { top: 0x7a5a3a, topTx: TX.wood, bot: 0xf0ece4, holes: [[w.cx + w.side * 3.5 - 0.8, -12, w.cx + w.side * 3.5 + 0.8, 0]] });
    flight(w.cx + w.side * 3.5, 0, [0, -1], 1.4, 0.15, HY(1), { col: 0xb8b0a0, tx: TX.stone });
  }
}

// ---------- one floor of the main block ----------
function mainFloor(f) {
  const y0 = HY(f) + 0.15, H = HOUSE.FH[f] - 0.15, [c0, c1] = HOUSE.corr, P2 = PLAN[f], col = WALL_IN[f];
  // corridor walls with a door into every room (the hall breaks them on the ground and first floors)
  for (const [side, zc, list] of [[1, c1, P2.S], [-1, c0, P2.N]]) {
    const ops = list.map(([a, b, kind]) => ({ at: (a + b) / 2, w: kind === 'ballroom' ? 3.0 : 1.2, h: kind === 'ballroom' ? 3.4 : 2.4, kind: 'door', style: 'plank', leaf: 'open' }));
    if (kind2(list, 'ballroom')) ops.push({ at: -42, w: 2.4, h: 3.4, kind: 'door', style: 'plank', leaf: 'open' });
    for (const [a, b] of f < 2 ? [[-50, -10], [10, 50]] : [[-50, 50]]) partition('x', a, b, zc, y0, H, ops.filter((o) => o.at > a && o.at < b), col);
    // walls between rooms
    for (const [a, b, kind] of list) for (const x of [a, b]) if (Math.abs(x) !== 50 && Math.abs(x) !== 10) partition('z', side > 0 ? c1 : HOUSE.main.z0 + HOUSE.T, side > 0 ? HOUSE.main.z1 - HOUSE.T : c0, x, y0, H, [], col);
    for (const [a, b, kind] of list) { const z0 = side > 0 ? c1 : HOUSE.main.z0 + HOUSE.T, z1 = side > 0 ? HOUSE.main.z1 - HOUSE.T : c0; room(kind, a + 0.1, z0, b - 0.1, z1, y0, H, side > 0 ? -1 : 1); }
  }
  if (f === 2) for (const x of [-10, 10]) { partition('z', HOUSE.corr[1], HOUSE.main.z1 - HOUSE.T, x, y0, H, [], col); partition('z', HOUSE.main.z0 + HOUSE.T, HOUSE.corr[0], x, y0, H, [], col); }
  // the hall walls on the first two floors close off the rooms either side; arches into the hall
  if (f < 2) for (const x of [-10, 10]) partition('z', HOUSE.main.z0 + HOUSE.T, HOUSE.main.z1 - HOUSE.T, x, y0, H, [{ at: -48.5, w: 3.0, h: 3.2, kind: 'arch' }], col);
  // the ends of the main block meet the wings: a door through on the corridor
  if (f < 2) for (const x of [-50, 50]) partition('z', HOUSE.main.z0 + HOUSE.T, HOUSE.main.z1 - HOUSE.T, x, y0, H, [{ at: -48.5, w: 1.6, h: 2.6, kind: 'door', style: 'plank', leaf: 'open' }], col);
  // corridor: runner carpet, sconces, portraits, a console table every so often
  W.defer(() => W.scope({ dim: 0.85 }, () => {
    W.box(98, 0.01, 1.6, 0, y0 + 0.01, (c0 + c1) / 2, 0x6a1a24, { t: TX.rug, ao: false });
    for (let x = -46; x <= 46; x += 6) { if (Math.abs(x) < 11 && f < 2) continue; for (const z of [c0 + 0.12, c1 - 0.12]) { W.box(0.2, 0.3, 0.12, x, y0 + 2.3, z, 0xc8a050, { layer: 'metal' }); W.sphere(0.12, 0.16, 0.12, x, y0 + 2.5, z, 0xffe0a8, { layer: 'glow' }); } if ((x / 6) % 2) portrait(x + 3, y0 + 1.7, c1 - 0.1, Math.PI); }
  }), 'near', [0, (c0 + c1) / 2]);
  for (let x = -40; x <= 40; x += 20) W.lamp(x, y0 + H - 0.5, (c0 + c1) / 2, 0xffd8a8, 1.4, 12, { halo: 0 });
  if (f === 0) hall();
}
const kind2 = (list, k) => list.some((r) => r[2] === k);
// the hall: black-and-white marble, the round table, the grand stair, a chandelier hanging from the dome
function hall() {
  W.defer(() => W.scope({ dim: 0.9 }, () => {
    for (let i = 0; i < 19; i++) for (let k = 0; k < 33; k++) if ((i + k) % 2) W.box(1, 0.01, 1, -9 + i, 0.16, -65 + k, 0x1a1a1c, { t: TX.ceramic, lod: 2, ao: false });
    W.cyl(1.2, 1.2, 0.07, 0, 0.95, -44, 0x5a3a24, { seg: 18, t: TX.wood }); W.cyl(0.18, 0.28, 0.8, 0, 0.55, -44, 0x5a3a24, { seg: 8 });
    W.cyl(0.2, 0.14, 0.5, 0, 1.25, -44, 0xe8e8f0, { seg: 10, layer: 'glass' }); for (let k = 0; k < 11; k++) W.sphere(0.14, 0.14, 0.14, mr(-0.25, 0.25), 1.6 + mr(0, 0.35), -44 + mr(-0.25, 0.25), mpick([0xd83a5a, 0xf0f0e8, 0xe8a0b0, 0xf0d040]), { seg: 6, hseg: 4 });
    for (const s of [-1, 1]) { statue(s * 8.5, -60, s > 0 ? -Math.PI / 2 : Math.PI / 2); for (let k = 0; k < 4; k++) portrait(s * 9.8, 3.0, -38 - k * 5, s > 0 ? -Math.PI / 2 : Math.PI / 2, 1.3, 1.7); }
    floorRug(0, 0.17, -40, 5, 8, 0, 0x6a1a24); for (const s of [-1, 1]) plantPot(s * 3, 0.16, -34.2, 'palm', 2.0);
  }), 'near', [0, -48]);
  W.solid(2.4, 1.0, 2.4, 0, 0.5, -44, 'wood');
  chandelier(0, HY(2) - 0.6, -48, 2.4); chandelier(0, HY(1) - 0.4, -38, 1.4);
  TOWN.spots.hall = { x: 0, z: -44 };
}

// ---------- a wing floor: rooms either side of a corridor running along z ----------
function wingFloor(w, f) {
  const y0 = HY(f) + 0.15, H = HOUSE.FH[f] - 0.15, s = w.side, cc = w.cx, cw = HOUSE.wingCorr, col = WALL_IN[(f + 3) % WALL_IN.length];
  const ci = cc - s * cw / 2, co = cc + s * cw / 2, innerX = s < 0 ? w.x1 - HOUSE.T : w.x0 + HOUSE.T, outerX = s < 0 ? w.x0 + HOUSE.T : w.x1 - HOUSE.T, P2 = WPLAN[`${s}:${f}`];
  for (const [lineX, list, far] of [[ci, P2.in, innerX], [co, P2.out, outerX]]) {
    partition('z', -47, 10 - HOUSE.T, lineX, y0, H, list.filter(([a]) => a >= -47).map(([a, b]) => ({ at: (a + b) / 2, w: 1.2, h: 2.4, kind: 'door', style: 'plank', leaf: 'open' })), col);
    for (const [a, b, kind] of list) {
      if (a > -48) partition('x', Math.min(lineX, far), Math.max(lineX, far), a, y0, H, [], col);
      const x0 = Math.min(lineX, far), x1 = Math.max(lineX, far);
      if (a < -48) room(kind, Math.min(innerX, outerX), -66 + HOUSE.T, Math.max(innerX, outerX), -50, y0, H, 1);   // across the wing's north end
      else room(kind, x0, a + 0.1, x1, b - 0.1, y0, H, lineX > far ? 2 : -2);
    }
  }
  partition('x', Math.min(innerX, outerX), Math.max(innerX, outerX), -50, y0, H, [{ at: cc, w: 1.6, h: 2.6, kind: 'door', style: 'plank', leaf: 'open' }], col);
  // the main corridor's spur into the wing
  partition('x', Math.min(innerX, ci), Math.max(innerX, ci), -47, y0, H, [], col);
  W.defer(() => W.box(cw - 0.4, 0.01, 56, cc, y0 + 0.01, -19, 0x6a1a24, { t: TX.rug, ao: false }), 'near', [cc, -19]);
  for (const z of [-40, -20, 0]) W.lamp(cc, y0 + H - 0.5, z, 0xffd8a8, 1.2, 10, { halo: 0 });
}

// ---------- a room: lit, and furnished by kind (streamed in) ----------
// door: 1 → the door is on the room's +z side, −1 → −z, 2 → +x, −2 → −x
function room(kind, x0, z0, x1, z1, y, H, door) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, alongX = Math.abs(door) === 1, w = alongX ? x1 - x0 : z1 - z0, d = alongX ? z1 - z0 : x1 - x0;
  const ry = door === 1 ? 0 : door === -1 ? Math.PI : door === 2 ? Math.PI / 2 : -Math.PI / 2;
  const warm = ['security', 'guardroom', 'office', 'kitchen', 'scullery', 'laundry', 'pantry', 'boots', 'garage', 'store', 'wine'].includes(kind) ? 0xe8f0ff : 0xffd8a8;
  W.lamp(cx, y + H - 0.6, cz, warm, kind === 'ballroom' ? 3 : 1.5, Math.max(8, Math.min(16, Math.max(w, d))), { halo: 0 });
  W.defer(() => { W.push(cx, y, cz, ry); W.scope({ dim: 0.85 }, () => furnishRoom(kind, w, d, H)); W.pop(); }, 'near', [cx, cz]);
  if (kind === 'study') { TOWN.spots.study = { x: cx, y, z: cz }; const p = new V3(w / 2 - 0.35, 0, -d / 2 + 2.2).applyAxisAngle(UP, ry); TOWN.spots.safe = { x: cx + p.x, y: y + 1, z: cz + p.z }; }
  if (kind === 'security') TOWN.spots.security = { x: cx, y, z: cz };
  if (kind === 'ballroom') TOWN.spots.ballroom = { x: cx, z: cz };
  // the people in it (they appear as you come near)
  const add = (lx, lz, yaw, role, route) => { const p = new V3(lx, 0, lz).applyAxisAngle(UP, ry); TOWN.staff.push({ x: cx + p.x, z: cz + p.z, y, yaw: yaw + ry, role, route: route && route.map(([a, b, t]) => { const q = new V3(a, 0, b).applyAxisAngle(UP, ry); return [cx + q.x, cz + q.z, t]; }) }); };
  if (y < 1) {
    if (kind === 'ballroom') { for (let k = 0; k < 12; k++) add(mr(-w / 2 + 3, w / 2 - 3), mr(-d / 2 + 3, d / 2 - 3), mr(0, 6.28), 'guest'); add(0, -d / 2 + 1.6, 0, 'bar'); add(-w / 4, 0, 0, 'food', [[-w / 4, 0], [w / 4, 1, 3], [w / 4, -3], [-w / 4, -3, 3]]); }
    if (kind === 'dining' || kind === 'drawing' || kind === 'music' || kind === 'gallery') for (let k = 0; k < 4; k++) add(mr(-w / 2 + 2, w / 2 - 2), mr(-d / 2 + 2, d / 2 - 2), mr(0, 6.28), 'guest');
    if (kind === 'kitchen') for (let k = 0; k < 4; k++) add(mr(-w / 2 + 1.5, w / 2 - 1.5), mr(-1, 1), mr(0, 6.28), 'food');
    if (kind === 'library' || kind === 'billiards' || kind === 'games' || kind === 'orangery') for (let k = 0; k < 3; k++) add(mr(-w / 2 + 2, w / 2 - 2), mr(-d / 2 + 2, d / 2 - 2), mr(0, 6.28), 'guest');
    if (kind === 'servanthall' || kind === 'laundry' || kind === 'scullery') for (let k = 0; k < 2; k++) add(mr(-w / 2 + 1.5, w / 2 - 1.5), mr(-d / 2 + 1.5, d / 2 - 1.5), mr(0, 6.28), 'food');
  } else if (kind === 'security' || kind === 'office') add(0, -d / 2 + 1.6, Math.PI, 'room');
}

// all the furniture, by kind, in the room frame: floor at y 0, the far wall at z = −d/2, the door at z = +d/2
function furnishRoom(kind, w, d, H) {
  const far = -d / 2 + 0.3, L = -w / 2 + 0.3, R = w / 2 - 0.3;
  const rug = (col) => floorRug(0, 0.02, 0, Math.min(w - 2, 6), Math.min(d - 2, 5), 0, col);
  const fire = (x = 0) => { W.box(2.4, 1.6, 0.5, x, 0.8, far + 0.05, STONE, { t: TX.stone }); W.box(1.4, 0.9, 0.1, x, 0.55, far + 0.3, 0x1a1210); W.box(1.0, 0.4, 0.05, x, 0.35, far + 0.34, 0xff8a30, { layer: 'glow' }); W.box(2.8, 0.15, 0.6, x, 1.62, far + 0.05, STONE); W.lamp(x, 0.6, far + 1.0, 0xff9a40, 1.4, 6, { halo: 0.2, flicker: 0.3 }); portrait(x, 2.6, far - 0.2, 0, 1.2, 1.4); };
  const chandel = () => chandelier(0, H - 0.3, 0, Math.min(1.6, w / 8));
  switch (kind) {
    case 'ballroom': {
      W.box(w - 0.4, 0.02, d - 0.4, 0, 0.02, 0, 0x9a6a3a, { t: TX.wood, ao: false });
      for (let x = -w / 2 + 6; x < w / 2 - 3; x += 10) chandelier(x, H - 0.3, 0, 1.8);
      for (let x = -w / 2 + 3; x < w / 2; x += 7) { W.box(1.4, 2.6, 0.05, x, 2.0, far - 0.25, 0xc8d8e0, { layer: 'glass' }); W.box(1.6, 2.8, 0.06, x, 2.0, far - 0.27, 0xc8a050, { layer: 'metal' }); }
      W.box(7, 0.4, 3.4, -w / 2 + 5, 0.2, far + 2, 0x5a3a24, { t: TX.wood }); for (let k = 0; k < 4; k++) { chairWood(-w / 2 + 2.6 + k * 1.6, 0.4, far + 2, Math.PI); W.box(0.06, 1.1, 0.06, -w / 2 + 2.6 + k * 1.6, 1.0, far + 1.4, 0x1a1a1a); }
      W.box(1.6, 1.0, 0.8, -w / 2 + 8, 0.9, far + 2.2, 0x101012, { layer: 'metal' });
      W.box(6, 1.1, 0.8, 0, 0.55, far + 0.8, 0x3a2418, { t: TX.wood }); for (let k = 0; k < 18; k++) W.cyl(0.035, 0.035, 0.28, -2.8 + k * 0.33, 1.25, far + 0.8, mpick([0x2a6a3a, 0xe8d8a0, 0x6a1a2a, 0xe8e8f0]), { seg: 6, layer: 'glass' });
      for (let k = 0; k < 6; k++) { const x = -w / 2 + 6 + k * 5.5; W.cyl(0.45, 0.45, 0.04, x, 1.1, d / 2 - 2.5, 0xf0f0e8, { seg: 12 }); W.cyl(0.04, 0.04, 1.0, x, 0.55, d / 2 - 2.5, 0x8a8a8a); }
      break;
    }
    case 'dining': W.box(2.4, 0.08, w - 6, 0, 0.95, 0, 0x5a3420, { t: TX.wood, ry: Math.PI / 2 }); W.box(2.5, 0.02, w - 5.8, 0, 1.0, 0, 0xf0ece0, { ry: Math.PI / 2 });
      for (let k = 0; k < Math.floor((w - 7) / 1.8); k++) for (const s of [-1, 1]) { const x = -w / 2 + 4 + k * 1.8; chairWood(x, 0, s * 1.6, s > 0 ? Math.PI : 0); W.cyl(0.13, 0.13, 0.02, x, 1.02, s * 0.75, 0xf8f8f0, { seg: 10 }); W.cyl(0.03, 0.03, 0.18, x + 0.2, 1.1, s * 0.6, 0xe8e8f0, { seg: 6, layer: 'glass' }); }
      for (const x of [-w / 4, 0, w / 4]) { W.cyl(0.05, 0.08, 0.5, x, 1.25, 0, 0xc8a050, { seg: 6, layer: 'metal' }); for (const dx of [-0.2, 0, 0.2]) W.sphere(0.05, 0.09, 0.05, x + dx, 1.58, 0, 0xffd080, { layer: 'glow' }); }
      W.box(4, 1.0, 0.6, 0, 0.5, far + 0.1, 0x4a2a18, { t: TX.wood }); fire(w / 3); chandelier(-w / 4, H - 0.3, 0, 1.3); chandelier(w / 4, H - 0.3, 0, 1.3); break;
    case 'music': W.box(2.2, 1.0, 1.5, -w / 4, 0.95, -d / 6, 0x101012, { layer: 'metal' }); W.box(2.2, 0.06, 0.4, -w / 4, 1.0, -d / 6 + 0.9, 0xf0f0e8); W.box(0.06, 1.0, 1.4, -w / 4 + 1.0, 1.5, -d / 6 - 0.1, 0x101012, { layer: 'metal', rz: 0.5 });
      W.rod([w / 4, 0, -d / 4], [w / 4 + 0.3, 1.8, -d / 4], 0.05, 0xc8a050, { layer: 'metal' }); for (let k = 0; k < 8; k++) W.rod([w / 4 + 0.02 * k, 0.3, -d / 4], [w / 4 + 0.03 * k + 0.25, 1.7, -d / 4], 0.004, 0xe8e0d0);
      for (let k = 0; k < 10; k++) chairWood(-w / 2 + 2.5 + (k % 5) * 1.6, 0, d / 4 + Math.floor(k / 5) * 1.4, Math.PI); rug(0x2a3a5a); chandel(); break;
    case 'library': for (let x = L + 1.0; x < R - 0.8; x += 2.1) shelfUnit(x, 0, far + 0.2, 0, 2.0, H - 0.6, 0.4, 0x4a2a18, 'books');
      for (let z = far + 2.5; z < d / 2 - 2; z += 2.1) { shelfUnit(L + 0.2, 0, z, Math.PI / 2, 2.0, H - 0.6, 0.4, 0x4a2a18, 'books'); shelfUnit(R - 0.2, 0, z, -Math.PI / 2, 2.0, H - 0.6, 0.4, 0x4a2a18, 'books'); }
      W.box(3.2, 0.08, 1.4, 0, 0.78, 0, 0x4a2a18, { t: TX.wood }); for (const s of [-1, 1]) chairWood(s * 0.8, 0, 1.1, Math.PI); deskLamp(0.8, 0.82, 0, 0, true); globe(-1.2, 0.82, 0); rug(0x5a1a1a);
      for (const [x, r] of [[-w / 4, 0.4], [w / 4, -0.4]]) sofa(x, 0, d / 4, r + Math.PI, 0x5a2a1e, 1.0); chandel(); break;
    case 'billiards': W.box(2.6, 0.12, 1.4, 0, 0.8, 0, 0x1a6a3a); W.box(2.8, 0.18, 1.6, 0, 0.72, 0, 0x4a2a18, { t: TX.wood }); for (const sx of [-1, 1]) for (const sz of [-1, 1]) W.box(0.14, 0.7, 0.14, sx * 1.2, 0.35, sz * 0.6, 0x4a2a18);
      for (let k = 0; k < 10; k++) W.sphere(0.055, 0.055, 0.055, mr(-1, 1), 0.89, mr(-0.5, 0.5), mpick([0xe8e8e0, 0xd83a2a, 0xe8c020, 0x1a1a1a, 0x2a5aa0]), { seg: 6 });
      W.box(1.0, 0.05, 2.6, 0, 1.9, 0, 0x2a2a2a, { ry: Math.PI / 2 }); W.box(0.9, 0.04, 2.4, 0, 1.86, 0, 0xfff0c0, { layer: 'glow', ry: Math.PI / 2 }); W.lamp(0, 1.7, 0, 0xffe8b0, 1.6, 6, { halo: 0 });
      W.box(1.2, 1.6, 0.1, L + 0.2, 1.4, 0, 0x4a2a18, { ry: Math.PI / 2 }); for (let k = 0; k < 6; k++) W.rod([L + 0.25, 0.4, -0.5 + k * 0.2], [L + 0.25, 1.9, -0.5 + k * 0.2], 0.012, 0xc8a070);
      sofa(0, 0, d / 2 - 1.4, Math.PI, 0x3a1a14, 2.2); fire(); break;
    case 'drawing': case 'sitting': for (const s of [-1, 1]) sofa(s * 1.6, 0, 0, s * Math.PI / 2, kind === 'drawing' ? 0x6a7a5a : 0x8a5a4a, 2.2); lowTable(0, 0, 0, 0, 1.4, 0.8); W.cyl(0.12, 0.08, 0.2, 0, 0.42, 0, 0xe8e8f0, { seg: 8, layer: 'glass' });
      fire(); rug(kind === 'drawing' ? 0x4a5a3a : 0x6a2a2a); for (const x of [L + 0.5, R - 0.5]) plantPot(x, 0, d / 2 - 1, 'palm', 1.6); W.box(1.2, 1.9, 0.5, R - 0.4, 0.95, far + 1.5, 0x4a2a18, { t: TX.wood, ry: -Math.PI / 2 }); if (w > 14) chandel(); break;
    case 'gallery': for (let x = L + 1.5; x < R - 1; x += 3) { portrait(x, 2.2, far - 0.2, 0, 1.4, 1.8); } for (let x = -w / 2 + 3; x < w / 2 - 2; x += 5) statue(x, 0, Math.PI); for (const z of [-1, 1]) W.box(2.2, 0.45, 0.6, 0, 0.23, z * 1.5, 0x5a2a1e, { t: TX.fabric }); chandel(); break;
    case 'bedroom': case 'master': { const big = kind === 'master'; bed(0, 0, far + 1.4, 0, mpick([0x6a2a3a, 0x2a3a5a, 0x3a5a3a, 0xd8c8b0])); if (big) { for (const sx of [-1, 1]) W.rod([sx * 0.8, 0, far + 0.4], [sx * 0.8, 2.6, far + 0.4], 0.04, 0x4a2a18); W.box(1.8, 0.1, 2.4, 0, 2.6, far + 1.4, 0x6a1a24, { layer: 'cloth' }); }
      for (const sx of [-1, 1]) { nightstand(sx * 1.2, 0, far + 0.4, 0); deskLamp(sx * 1.2, 0.56, far + 0.4, 0, true); }
      wardrobe(R - 0.4, 0, 0, -Math.PI / 2, 0x5a3a24); W.box(1.2, 0.9, 0.5, L + 0.4, 0.45, 0, 0x5a3a24, { t: TX.wood, ry: Math.PI / 2 }); W.box(0.6, 0.8, 0.04, L + 0.2, 1.4, 0, 0xc8d8e0, { layer: 'glass', ry: Math.PI / 2 });
      rug(mpick([0x8a6a4a, 0x5a2a2a, 0x2a3a4a])); W.box(0.7, 0.7, 0.7, R - 1.6, 0.35, d / 2 - 1.4, 0x8a5a4a, { t: TX.fabric }); if (big) fire(-w / 4); break; }
    case 'bath': W.box(1.7, 0.6, 0.8, L + 1.1, 0.3, far + 0.6, 0xf4f4f0); W.box(1.5, 0.1, 0.6, L + 1.1, 0.58, far + 0.6, 0x9ac8e0, { layer: 'glass' }); for (const sx of [-1, 1]) W.sphere(0.12, 0.12, 0.12, L + 1.1 + sx * 0.7, 0.05, far + 0.3, 0xc8a050, { layer: 'metal' });
      W.box(0.9, 0.85, 0.5, R - 0.6, 0.42, far + 0.4, 0xf0f0ec); W.box(0.5, 0.65, 0.04, R - 0.6, 1.5, far + 0.1, 0xc8d8e0, { layer: 'glass' }); W.box(0.45, 0.45, 0.65, R - 0.5, 0.22, 0, 0xf4f4f0);
      W.box(w - 0.4, 1.2, 0.02, 0, 0.6, far, 0xd8e8e8, { t: TX.ceramic }); break;
    case 'dressing': for (let x = L + 0.7; x < R - 0.5; x += 1.3) wardrobe(x, 0, far + 0.3, 0, 0x6a4a2a); W.box(1.4, 1.9, 0.05, 0, 1.2, d / 2 - 0.4, 0xc8d8e0, { layer: 'glass' }); W.box(0.8, 0.45, 0.8, 0, 0.23, 0, 0x8a4a5a, { t: TX.fabric }); break;
    case 'study': desk(0, 0, -d / 6, 0, 2.2, 1.0, 0x3a2014); chairWood(0, 0, -d / 6 - 1.0, 0); deskLamp(0.7, 0.78, -d / 6, 0, true); for (let k = 0; k < 6; k++) W.box(0.22, 0.02, 0.3, -0.6 + k * 0.1, 0.79 + k * 0.003, -d / 6 + 0.1, 0xf0ece0);
      for (let x = L + 1.0; x < R - 0.8; x += 2.1) shelfUnit(x, 0, far + 0.2, 0, 2.0, 2.6, 0.38, 0x3a2014, 'books');
      safe(R - 0.25, 0, -d / 2 + 2.2, -Math.PI / 2); portrait(R - 0.08, 2.0, -d / 2 + 2.2, -Math.PI / 2, 1.1, 0.9); rug(0x5a1a1a); sofa(0, 0, d / 2 - 1.5, Math.PI, 0x3a1a14, 2.0); globe(L + 1.0, 0.0, d / 2 - 1.2); break;
    case 'office': for (const x of [-w / 4, w / 4]) { officeDesk(x, 0, -d / 6, 0, 1.8, 'office'); chairOffice(x, 0, -d / 6 + 0.9, Math.PI); } for (let x = L + 0.6; x < R; x += 1.2) fileCabinet(x, 0, far + 0.2, 0); break;
    case 'security': cctvWall(0, 0.3, far + 0.1, 0, Math.max(3, Math.floor(w / 2)), 3); officeDesk(0, 0, far + 1.6, 0, Math.min(w - 2, 4), 'office'); for (let k = -1; k <= 1; k++) { monitor(k * 1.0, 0.78, far + 1.5, 0, 0x4aa0ff); chairOffice(k * 1.2, 0, far + 2.6, Math.PI); } W.lamp(0, 2, far + 1.5, 0x6aa0ff, 1.2, 6, { halo: 0 }); break;
    case 'guardroom': W.box(2.4, 0.06, 1.0, 0, 0.75, 0, 0x6a6e72, { layer: 'metal' }); for (const s of [-1, 1]) chairFolding(s * 0.8, 0, 0.9, Math.PI); for (let x = L + 0.6; x < R - 0.4; x += 0.8) locker(x, 0, far + 0.25, 0, 0x4a4e54); W.box(1.6, 1.6, 0.1, R - 0.1, 1.4, 0, 0x3a3a3a, { ry: -Math.PI / 2 }); for (let k = 0; k < 5; k++) W.box(0.08, 0.9, 0.06, R - 0.2, 1.3, -0.6 + k * 0.3, 0x1a1a1a, { layer: 'metal' }); break;
    case 'nursery': W.box(1.2, 0.6, 0.7, L + 1, 0.3, far + 0.6, 0xe8d8e0); for (let k = 0; k < 8; k++) W.box(0.3, 0.3, 0.3, mr(-w / 3, w / 3), 0.15, mr(-d / 4, d / 4), mpick([0xd83a3a, 0x3a8ad8, 0xe8c020, 0x3ab04a]), { ry: mr(0, 3) });
      W.box(0.9, 0.7, 0.3, 0, 0.6, 0, 0x8a5a3a, { t: TX.wood }); W.torus(0.5, 0.06, 0, 0.1, 0, 0x6a3a1a, { rx: Math.PI / 2, arc: Math.PI }); rug(0x8ab0d8); break;
    case 'servants': case 'servanthall': if (kind === 'servanthall') { W.box(1.0, 0.06, w - 3, 0, 0.75, 0, 0x8a6a4a, { t: TX.wood, ry: Math.PI / 2 }); for (let x = -w / 2 + 2; x < w / 2 - 1.5; x += 1.4) for (const s of [-1, 1]) chairWood(x, 0, s * 0.8, s > 0 ? Math.PI : 0); }
      else { bunkBed(L + 0.6, 0, far + 1.2, 0, 0x6a6a72); if (w > 9) bunkBed(R - 0.6, 0, far + 1.2, 0, 0x6a6a72); locker(0, 0, far + 0.25, 0, 0x6a6e72); W.box(0.9, 0.7, 0.5, 0, 0.35, 0, 0x8a6a4a, { t: TX.wood }); } break;
    case 'store': case 'pantry': case 'wine': for (let x = L + 0.8; x < R - 0.6; x += 2.0) shelfUnit(x, 0, far + 0.3, 0, 1.8, 2.2, 0.5, 0x6a5a40, kind === 'wine' ? 'home' : 'boxes'); if (kind === 'wine') for (let x = L + 1; x < R - 1; x += 1.2) W.box(0.9, 1.6, 0.5, x, 0.8, d / 2 - 1.5, 0x5a3a24, { t: TX.wood }); crateStack(0, 0, 0, 0, 3); break;
    case 'kitchen': case 'scullery': for (let x = L + 1.3; x < R - 1; x += 2.6) kitchenRun(x, 0, far + 0.3, 0, 2.4, 0xd8d8d0); for (let x = -w / 2 + 2.5; x < w / 2 - 2; x += 3.5) { W.box(2.4, 0.9, 1.2, x, 0.45, 0, 0xc8ccd0, { layer: 'metal' }); W.box(2.2, 0.05, 1.0, x, 0.92, 0, 0xe8e8e8, { layer: 'metal' }); for (let k = 0; k < 3; k++) W.cyl(0.15, 0.13, 0.2, x - 0.6 + k * 0.6, 1.05, 0, 0x8a8e94, { seg: 10, layer: 'metal' }); }
      fridge(R - 0.5, 0, d / 2 - 1, -Math.PI / 2); for (let x = -w / 2 + 2; x < w / 2; x += 2) { W.rod([x, H, 1.5], [x, H - 0.8, 1.5], 0.01, 0x8a8a8a); for (let k = 0; k < 3; k++) W.cyl(0.12, 0.12, 0.04, x - 0.2 + k * 0.2, H - 0.85, 1.5, 0x8a5a3a, { rx: Math.PI / 2, seg: 8, layer: 'metal' }); } break;
    case 'laundry': for (let x = L + 0.8; x < R - 0.5; x += 1.0) { W.box(0.7, 0.9, 0.65, x, 0.45, far + 0.4, 0xf0f0ec, { layer: 'metal' }); W.cyl(0.22, 0.22, 0.02, x, 0.5, far + 0.74, 0x4a5a6a, { rx: Math.PI / 2, seg: 12, layer: 'glass' }); } laundryLine(L + 0.5, 2.2, 0, R - 0.5, 2.2, 0, 7); break;
    case 'boots': for (let x = L + 0.4; x < R; x += 0.5) { W.box(0.3, 0.3, 0.3, x, 0.15, far + 0.2, mpick([0x2a2a2a, 0x3a2a1a, 0x2a3a2a])); W.rod([x, 1.4, far + 0.1], [x, 1.6, far + 0.1], 0.02, 0x8a8a8a); W.box(0.35, 0.8, 0.12, x, 1.2, far + 0.15, mpick([0x3a4a2a, 0x2a2a3a, 0x5a4a3a]), { layer: 'cloth' }); } break;
    case 'gunroom': for (let x = L + 1; x < R - 0.8; x += 1.6) { W.box(1.4, 2.0, 0.4, x, 1.0, far + 0.25, 0x4a2a18, { t: TX.wood }); W.box(1.2, 1.7, 0.04, x, 1.0, far + 0.46, 0x9ab0c0, { layer: 'glass' }); for (let k = 0; k < 4; k++) W.box(0.05, 1.2, 0.05, x - 0.45 + k * 0.3, 1.1, far + 0.35, 0x2a2018); } W.box(2.0, 0.06, 1.0, 0, 0.8, 0, 0x4a2a18, { t: TX.wood }); fire(); break;
    case 'orangery': for (let x = -w / 2 + 1.5; x < w / 2 - 1; x += 2.5) for (const z of [-d / 4, d / 4]) { W.box(0.9, 0.7, 0.9, x, 0.35, z, 0xd8d0c0, { t: TX.stone }); tree(x, 0.7, z, 'orange', 0.6); } for (let x = -w / 2 + 1; x < w / 2; x += 2) W.box(1.6, 2.6, 0.04, x, 2.2, far, 0xc8d8d0, { layer: 'glass' }); bench(0, 0, 0, 0); break;
    case 'games': W.box(1.6, 0.08, 1.0, -w / 4, 0.78, 0, 0x2a6a3a); W.box(1.7, 0.7, 1.1, -w / 4, 0.4, 0, 0x4a2a18, { t: TX.wood }); W.box(1.4, 0.05, 0.8, w / 4, 0.76, 0, 0x4a2a18, { t: TX.wood }); chessBoard(w / 4, 0.8, 0, 0); for (const s of [-1, 1]) chairWood(w / 4 + s * 0.9, 0, 0, s * Math.PI / 2); W.box(1.8, 1.0, 0.06, 0, 1.6, far, 0x2a5aa0, { layer: 'glow' }); sofa(0, 0, d / 2 - 1.4, Math.PI, 0x4a4a5a, 2.4); break;
    case 'cinema': W.box(w - 2, (w - 2) * 0.45, 0.05, 0, 0.6 + (w - 2) * 0.225, far, 0xd8e0f0, { layer: 'glow' }); for (let r = 0; r < 3; r++) for (let x = -w / 2 + 1.6; x < w / 2 - 1; x += 1.0) W.box(0.8, 0.9, 0.8, x, 0.45 + r * 0.25, far + 4 + r * 1.6, 0x6a1a24, { t: TX.fabric }); break;
    case 'chapel': for (let r = 0; r < Math.floor((d - 5) / 1.4); r++) for (const s of [-1, 1]) { W.box(w / 2 - 1.6, 0.45, 0.45, s * (w / 4 + 0.2), 0.45, far + 4 + r * 1.4, 0x5a3a24, { t: TX.wood }); W.box(w / 2 - 1.6, 0.6, 0.06, s * (w / 4 + 0.2), 0.75, far + 4.2 + r * 1.4, 0x5a3a24, { t: TX.wood }); }
      W.box(2.4, 1.0, 1.0, 0, 0.5, far + 1.2, 0xf0ece0); W.box(0.12, 1.2, 0.12, 0, 1.6, far + 1.2, 0xc8a050, { layer: 'metal' }); W.box(0.6, 0.12, 0.12, 0, 1.9, far + 1.2, 0xc8a050, { layer: 'metal' }); for (const s of [-1, 1]) { W.cyl(0.04, 0.04, 0.4, s * 0.9, 1.2, far + 1.2, 0xf0f0e8, { seg: 6 }); W.sphere(0.05, 0.1, 0.05, s * 0.9, 1.45, far + 1.2, 0xffd080, { layer: 'glow' }); }
      for (let x = L + 1.2; x < R; x += 3) W.box(1.0, 2.4, 0.04, x, 2.4, far - 0.15, mpick([0x8a2a6a, 0x2a4a9a, 0xc8a030, 0x2a8a5a]), { layer: 'glow' }); break;
    case 'pool': W.box(w - 2.4, 0.04, d - 3.2, 0, 0.02, 0, 0x3a9ab8, { layer: 'glass' }); for (const s of [-1, 1]) W.box(0.7, 0.4, 2.0, s * (w / 2 - 0.8), 0.2, 0, 0xf0f0e8); break;
    case 'garage': for (let k = 0; k < Math.floor((w - 2) / 3.6); k++) sedan(-w / 2 + 2.6 + k * 3.6, 0, Math.PI / 2, mpick([0x141414, 0x6a1a1a, 0x1a2a4a, 0xe8e6e0]), 'car', 0); W.box(w - 0.6, 0.02, d - 0.6, 0, 0.02, 0, 0x5a5a58, { t: TX.concrete }); break;
    default: rug(0x6a4a3a);
  }
}
function urn(x, y, z) { W.scope({ lod: 1 }, () => { W.box(0.5, 0.3, 0.5, x, y, z, STONE); W.cyl(0.32, 0.18, 0.6, x, y + 0.45, z, STONE, { seg: 8, t: TX.stone }); W.sphere(0.4, 0.3, 0.4, x, y + 0.85, z, 0x3a5a2a, { t: TX.leaf }); }); }

// =====================================================================
//  The estate: lodge, stables, orangery, pool, kitchen garden, tennis, sheds, car parks, orchard
// =====================================================================
// a small building: walls, windows, a door, a pitched roof and a chimney (solid; you don't go in)
function cottage(x, z, w, d, H, ry, o = {}) {
  W.push(x, 0, z, ry);
  const col = o.col ?? STONE, roof = o.roof ?? SLATE;
  W.box(w, H, d, 0, H / 2, 0, col, { t: o.tx ?? TX.stone, wear: 4 }); W.solid(w, H, d, 0, H / 2, 0, 'stone');
  W.box(w + 0.2, 0.3, d + 0.2, 0, 0.15, 0, STONE_DK, { t: TX.stone });
  for (let k = -w / 2 + 1.6; k < w / 2 - 1; k += 2.8) for (const s of [-1, 1]) { const lit = mchance(0.55); W.box(1.0, 1.2, 0.05, k, H * 0.55, s * (d / 2 + 0.02), lit ? 0xd8b880 : 0x1a1e24, { layer: lit ? 'glow' : 'pane' }); W.box(1.2, 0.1, 0.2, k, H * 0.55 - 0.65, s * (d / 2 + 0.08), STONE); }
  W.box(1.1, 2.1, 0.06, o.doorX ?? 0, 1.05, d / 2 + 0.03, o.door ?? 0x2a4a3a, { t: TX.wood }); W.lamp(o.doorX ?? 0, 2.4, d / 2 + 0.8, 0xffd8a0, 1.2, 6, { halo: 0.4 });
  W.pop();
  W.push(x, 0, z, ry); pitched(-w / 2 - 0.3, -d / 2 - 0.3, w / 2 + 0.3, d / 2 + 0.3, H, o.pitch ?? Math.min(3.2, d * 0.45), roof); W.pop();
  if (o.chimney !== false) { W.push(x, 0, z, ry); W.box(0.9, 2.6, 0.9, w / 2 - 1.2, H + 1.6, 0, 0x8a6a54, { t: TX.brick }); W.pop(); }
}
function glasshouse(x, z, w, d, H, ry) {
  W.push(x, 0, z, ry);
  W.box(w, 0.6, d, 0, 0.3, 0, 0x8a6a54, { t: TX.brick }); W.solid(w, H, d, 0, H / 2, 0, 'glass');
  for (const s of [-1, 1]) { W.box(w, H - 0.6, 0.04, 0, (H + 0.6) / 2, s * d / 2, 0xc8d8d4, { layer: 'glass' }); W.box(0.04, H - 0.6, d, s * w / 2, (H + 0.6) / 2, 0, 0xc8d8d4, { layer: 'glass' }); }
  for (let k = -w / 2; k <= w / 2; k += 1.2) for (const s of [-1, 1]) W.box(0.06, H - 0.6, 0.06, k, (H + 0.6) / 2, s * d / 2, 0xf0f0ec, { layer: 'metal', lod: 1 });
  const a = Math.atan2(1.6, d / 2), sl = Math.hypot(1.6, d / 2);
  for (const s of [-1, 1]) W.box(w, 0.04, sl, 0, H + 0.8, s * d / 4, 0xd0e0dc, { layer: 'glass', rx: s * a });
  W.box(w, 0.1, 0.1, 0, H + 1.6, 0, 0xf0f0ec, { layer: 'metal' });
  W.scope({ lod: 2 }, () => { for (let k = -w / 2 + 0.8; k < w / 2 - 0.5; k += 0.9) for (const s of [-1, 1]) { W.box(0.7, 0.8, 0.8, k, 0.4, s * (d / 2 - 0.7), 0x6a4a2a, { t: TX.wood }); W.sphere(0.5, 0.5, 0.5, k, 1.05, s * (d / 2 - 0.7), mpick([0x3a6a2a, 0x4a7a3a, 0x5a8a2a]), { seg: 6, t: TX.leaf }); } });
  W.lamp(0, H, 0, 0xfff0d0, 1.0, 8, { halo: 0 });
  W.pop();
}
function carPark(x0, z0, x1, z1, rows, fill = 0.8) {
  groundPlate(x0, z0, x1, z1, 0x3a3a3c, TX.asphalt, 3, 0.05);
  const depth = (z1 - z0) / rows;
  for (let r = 0; r < rows; r++) {
    const zr = z0 + depth * (r + 0.5), face = r % 2 ? Math.PI / 2 : -Math.PI / 2;
    for (let x = x0 + 1.6; x < x1 - 1.4; x += 2.8) {
      W.box(0.1, 0.01, 5, x - 1.4, 0.06, zr, 0xe8e8e0, { ao: false, lod: 1 });
      if (mchance(fill)) W.defer(() => sedan(x, zr, face + (mchance(0.1) ? 0.1 : 0), mpick([0x141414, 0x1a1a2a, 0xe8e6e0, 0x4a1a1a, 0x8a8e94, 0x2a3a2a, 0x2a2a3a, 0xc8b89a])), 'mid', [x, zr]);
    }
  }
  for (let x = x0 + 6; x < x1; x += 14) for (const z of [z0 + 0.6, z1 - 0.6]) { lampPostOld(x, 0, z, 4.6); W.lamp(x, 4.4, z, 0xfff0d8, 2.0, 12, { halo: 0.6 }); }
  for (const z of [z0 - 0.5, z1 + 0.5]) W.box(x1 - x0, 0.9, 0.9, (x0 + x1) / 2, 0.45, z, 0x2a4a24, { t: TX.leaf, lod: 1 });
}
function manorEstate() {
  // the gate lodge: the keeper's cottage, a picket fence and its own garden
  cottage(-28, 184, 10, 7, 5.5, 0, { col: 0xd0c4ac, chimney: true });
  W.scope({ lod: 1 }, () => { for (let x = -36; x <= -20; x += 0.6) W.box(0.08, 1.0, 0.06, x, 0.5, 190.5, 0xf0f0ec); W.box(16, 0.08, 0.06, -28, 0.85, 190.5, 0xf0f0ec); for (let k = 0; k < 8; k++) W.sphere(0.5, 0.4, 0.5, -34 + k * 1.7, 0.3, 189.5, mpick([0xd83a4a, 0xe8d0e0, 0xd8a030, 0x3a6a2a]), { seg: 6, t: TX.leaf }); });
  // guest car park by the gate, the staff car park in the service yard
  carPark(18, 148, 76, 192, 4, 0.85);
  carPark(78, -34, 112, -4, 2, 0.6);
  W.scope({ lod: 1 }, () => { for (const [x, z] of [[84, -36.6], [92, -36.6], [100, -36.6]]) { W.box(1.4, 1.3, 1.0, x, 0.65, z, mpick([0x2a6a3a, 0x2a4a8a, 0x8a8e94]), { layer: 'metal' }); } cargoTruck(104, -12, Math.PI, 0xe8e6e0); });
  cottage(118, -20, 8, 6, 4, Math.PI / 2, { col: 0xb8b0a0, tx: TX.concrete, roof: 0x4a4a4a, chimney: false });   // generator house
  // the stable block: three ranges round a cobbled yard, the clock tower over the arch
  const SX = -128, SZ = 60;
  for (const [dx, dz, w, d, ry] of [[0, -22, 48, 7, 0], [-21, 0, 38, 7, Math.PI / 2], [21, 0, 38, 7, Math.PI / 2]]) {
    W.push(SX + dx, 0, SZ + dz, ry);
    W.box(w, 5, d, 0, 2.5, 0, 0xc8a888, { t: TX.brick, wear: 3 }); W.solid(w, 5, d, 0, 2.5, 0, 'stone');
    for (let k = -w / 2 + 2.5; k < w / 2 - 1; k += 4) { W.box(2.2, 2.6, 0.06, k, 1.3, d / 2 + 0.03, 0x2a4a3a, { t: TX.wood }); W.box(2.2, 0.4, 0.2, k, 2.7, d / 2 + 0.1, STONE); W.box(0.9, 0.7, 0.05, k, 3.8, d / 2 + 0.03, 0x1a1e24, { layer: 'pane' }); }
    W.pop();
    W.push(SX + dx, 0, SZ + dz, ry); pitched(-w / 2 - 0.3, -d / 2 - 0.3, w / 2 + 0.3, d / 2 + 0.3, 5, 2.6, SLATE); W.pop();
  }
  groundPlate(SX - 18, SZ - 18, SX + 18, SZ + 20, 0x8a8478, TX.cobble, 4, 0.05);
  W.box(4, 12, 4, SX, 6, SZ - 22, 0xc8a888, { t: TX.brick }); W.solid(4, 12, 4, SX, 6, SZ - 22, 'stone');
  W.cyl(1.3, 1.3, 0.1, SX, 9.5, SZ - 19.98, 0xf0f0e8, { rx: Math.PI / 2, seg: 20 }); W.box(0.08, 1.0, 0.04, SX, 9.8, SZ - 19.9, 0x1a1a1a); W.box(0.7, 0.08, 0.04, SX + 0.3, 9.5, SZ - 19.9, 0x1a1a1a);
  W.cyl(2.4, 2.4, 2.5, SX, 13.2, SZ - 22, 0xe8e4dc, { seg: 8 }); W.cone(2.8, 3.2, SX, 16.1, SZ - 22, 0x6a8a84, { seg: 8 }); W.lamp(SX, 9.5, SZ - 18.5, 0xfff0d0, 1.4, 8, { halo: 0.4 });
  W.scope({ lod: 1 }, () => { for (let k = 0; k < 8; k++) haybale(SX + mr(-12, 12), 0, SZ + mr(-10, 14), mr(0, 3)); W.box(3, 0.6, 0.8, SX + 8, 0.3, SZ + 6, STONE); W.box(2.8, 0.05, 0.6, SX + 8, 0.58, SZ + 6, 0x3a5a6a, { layer: 'glass' }); });
  for (let k = 0; k < 4; k++) cottage(SX - 32, SZ - 12 + k * 7, 4, 3, 2.2, Math.PI / 2, { col: 0x8a6a4a, tx: TX.wood, roof: 0x4a3a2a, chimney: false, pitch: 1 });   // kennels
  // the orangery and the pool house, west of the formal garden
  glasshouse(-81, -143, 30, 10, 4.5, 0);
  W.box(32, 1.0, 1.2, -81, 5.6, -143, STONE, { t: TX.stone });
  groundPlate(-98, -126, -64, -96, STONE, TX.stone, 3, 0.05);
  W.box(24, 0.05, 12, -81, 0.07, -111, 0x3ab0d0, { layer: 'glass' }); W.box(25, 0.3, 13, -81, -0.05, -111, 0xe8e4dc, { t: TX.ceramic }); W.lamp(-81, 0.4, -111, 0x6ac0ff, 2.0, 14, { halo: 0 });
  for (let k = 0; k < 6; k++) { const x = -94 + k * 5; W.box(0.8, 0.3, 2.0, x, 0.3, -100.5, 0xf0f0ec); W.cone(1.3, 0.4, x, 2.6, -98, mpick([0xd83a4a, 0xf0f0ec, 0x2a5a9a]), { seg: 8, layer: 'cloth' }); W.rod([x, 0, -98], [x, 2.6, -98], 0.025, 0xc8c8c8, { layer: 'metal' }); }
  cottage(-81, -132, 14, 6, 4, 0, { col: 0xf0ece4, tx: TX.plaster, roof: 0x4a5058, chimney: false });
  // the walled kitchen garden: brick walls, beds in rows, two glasshouses, the potting sheds
  const K = { x0: 100, x1: 170, z0: 8, z1: 72 };
  for (const [ax, a0, a1, c] of [['x', K.x0, K.x1, K.z0], ['x', K.x0, K.x1, K.z1], ['z', K.z0, K.z1, K.x0], ['z', K.z0, K.z1, K.x1]]) {
    const mid = (a0 + a1) / 2, gap = ax === 'z' && c === K.x0 ? [mid - 2, mid + 2] : ax === 'x' && c === K.z1 ? [mid - 2, mid + 2] : null;
    for (const [s0, s1] of gap ? [[a0, gap[0]], [gap[1], a1]] : [[a0, a1]]) { const L = s1 - s0, m = (s0 + s1) / 2; if (ax === 'x') { W.box(L, 3, 0.5, m, 1.5, c, 0x9a5a44, { t: TX.brick, wear: 4 }); W.solid(L, 3, 0.5, m, 1.5, c, 'stone'); } else { W.box(0.5, 3, L, c, 1.5, m, 0x9a5a44, { t: TX.brick, wear: 4 }); W.solid(0.5, 3, L, c, 1.5, m, 'stone'); } }
  }
  for (let r = 0; r < 6; r++) for (let k = 0; k < 3; k++) { const x = K.x0 + 8 + k * 14, z = K.z0 + 8 + r * 6; W.box(10, 0.35, 3.2, x, 0.18, z, 0x4a3a2a, { t: TX.earth }); W.scope({ lod: 2 }, () => { for (let i = 0; i < 12; i++) W.sphere(0.4, 0.35, 0.4, x - 4.5 + i * 0.82, 0.5, z + mr(-0.8, 0.8), mpick([0x3a7a2a, 0x4a8a3a, 0x6aa02a, 0x8a3a6a]), { seg: 6, hseg: 4, t: TX.leaf }); }); }
  glasshouse(K.x0 + 52, K.z0 + 20, 22, 8, 3.5, Math.PI / 2); glasshouse(K.x0 + 52, K.z0 + 50, 22, 8, 3.5, Math.PI / 2);
  cottage(K.x1 - 6, K.z1 - 5, 6, 4, 2.8, Math.PI, { col: 0x8a6a4a, tx: TX.wood, roof: 0x3a3a34, chimney: false, pitch: 1.4 });
  // tennis court with its fence, a pavilion; garden sheds about the grounds; an orchard in the north-west
  groundPlate(50, -196, 86, -178, 0x3a6a4a, TX.concrete, 2, 0.06);
  for (const [w, d, x, z] of [[24, 0.08, 68, -180], [24, 0.08, 68, -194], [0.08, 14, 56, -187], [0.08, 14, 80, -187], [0.08, 14, 68, -187]]) W.box(w, 0.01, d, x, 0.09, z, 0xf0f0ec, { ao: false });
  W.box(0.08, 1.0, 12, 68, 0.5, -187, 0x2a2a2a, { layer: 'metal' });
  chainFence(48, -198, 88, -198, 3); chainFence(48, -176, 88, -176, 3); chainFence(48, -198, 48, -176, 3); chainFence(88, -198, 88, -176, 3);
  cottage(98, -186, 6, 4, 3, -Math.PI / 2, { col: 0xf0ece4, tx: TX.wood, roof: 0x2a4a3a, chimney: false });
  for (const [x, z, r] of [[-40, -192, 0], [36, -150, 1.2], [-150, -20, 2.4], [150, -170, 0.6], [180, 120, 3]]) cottage(x, z, 3.6, 2.6, 2.4, r, { col: 0x5a4a3a, tx: TX.wood, roof: 0x3a3a34, chimney: false, pitch: 0.9 });
  for (let x = -190; x <= -130; x += 7) for (let z = 128; z <= 190; z += 7) tree(x + mr(-1, 1), 0, z + mr(-1, 1), 'orange', 0.75);
  // plants: borders along the courtyard faces, urns at the corners, clipped bay trees by the doors
  W.scope({ lod: 1 }, () => {
    for (const x of [-48, 48]) for (let z = -28; z < 8; z += 1.2) W.sphere(0.6, 0.5, 0.6, x + Math.sign(x) * -0.6, 0.3, z, mpick([0xd83a4a, 0xe8d0e0, 0xd8a030, 0x3a6a2a, 0x8a3a8a]), { seg: 6, t: TX.leaf });
    for (let x = -46; x <= 46; x += 1.2) if (Math.abs(x) > 14) W.sphere(0.6, 0.5, 0.6, x, 0.3, -30.6, mpick([0xd83a4a, 0xe8d0e0, 0xd8a030, 0x3a6a2a]), { seg: 6, t: TX.leaf });
  });
  for (const [x, z] of [[-14, -28], [14, -28], [-50, 9], [50, 9], [-50, -30], [50, -30]]) urn(x, 0.2, z);
  // deciduous trees across the lawns (some cover, some lines of sight)
  for (let i = 0; i < 46; i++) { const x = mr(-190, 190), z = mr(-196, 196); if (GR.get(x, z) !== GR.FREE || (Math.abs(x) < 80 && z > -90 && z < 30)) continue; tree(x, 0, z, mchance(0.5) ? 'ficus' : 'olive', mr(1.1, 1.6)); }
  TOWN.spots.boathouse = { x: 96, z: -95 }; TOWN.spots.gate = { x: 0, z: 196 }; TOWN.spots.serviceGate = { x: 198, z: -20 };
}
