// =====================================================================
//  TOWN — authoring kit for the hand-laid harbour town of Dar Essalam
// =====================================================================
// The town is laid out by hand (58-town-*.js): every street is drawn, every frontage is written as a
// sequence of houses ("7/3/r+boug" = 7 m wide, 3 storeys, rose medina house with bougainvillea), and
// every square, shop, landmark and interior is placed explicitly. This file holds the pieces.
const TOWN = { doors: [], plazas: [], spots: {}, guards: [], lanes: {} };
const FH0 = 3.7, FHU = 3.2;          // ground / upper storey heights of town houses

// ---------------- house styles ----------------
// cols: wall colours · door: door style · win: upper window kind · top: roofline · tx: wall surface
const STY = {
  r: { cols: [MC.rose, MC.roseDk, MC.terracotta, 0xc98a6c], door: 'carved', win: 'grille', top: 'merlon', few: true },     // medina, rose
  o: { cols: [MC.ochre, MC.ochreDk, 0xc89058, 0xd8a870], door: 'plank', win: 'shut', top: 'plain' },                          // medina, ochre
  c: { cols: [MC.cream, MC.whitewash, MC.plasterLt, 0xe8dcc4], door: 'metal', win: 'arch', top: 'plain' },                     // whitewashed
  b: { cols: [0xe9eef3, 0xdfe7f0, 0xd6e2ee], door: 'metal', doorCol: 0x2a5aa0, win: 'shut', shut: 0x3a6ab0, top: 'plain', blue: true }, // blue quarter
  m: { cols: [MC.plasterLt, 0xd8c8b0, 0xe8d8a0, 0xdce4e2, 0xe6c6b0, 0xd0b48c, 0xeae2d0], door: 'plank', win: 'shut', top: 'cornice', bal: true },          // mellah: balconies
  h: { cols: [MC.cream, 0xe6d2b0, MC.plasterLt], door: 'carved', win: 'arch', top: 'cornice', grand: true },                 // grand / hotel
  k: { cols: [MC.pise, 0xa97e58, 0xc09068], door: 'carved', win: 'slit', top: 'merlon', tx: TX.pise, few: true },              // kasbah pisé
  s: { cols: [MC.ochre, MC.cream, MC.rose, MC.plaster], door: 'plank', win: 'shut', top: 'plain', shop: true },               // souk shop
  w: { cols: [MC.whitewash, 0xd8d4c8, 0xc8c0b0], door: 'metal', win: 'grille', top: 'plain', ware: true },                   // harbour store
};
const TRADES = ['spice', 'pottery', 'lamps', 'leather', 'rugs', 'grocery', 'copper', 'fabric'];

// "7x9/3/r:spice+boug+bal" → { w:7, d:9, F:3, s:'r', trade:'spice', f:{boug,bal} }
function parseUnit(tok) {
  const [main, ...feats] = tok.split('+'), [dims, F, sk = 'o'] = main.split('/'), [w, d] = dims.split('x').map(Number);
  const [s, trade] = sk.split(':');
  const f = {}; for (const k of feats) { const [a, b] = k.split('='); f[a] = b ?? true; }
  return { w, d: d || 0, F: Number(F ?? 2), s, trade, f };
}

// ---------------- one house front + body, in a frame at the front centre (+z = street) ----------------
function townUnit(u) {
  const S = STY[u.s] || STY.o, w = u.w, D = u.d, F = u.F, T = 0.42;
  const col = u.f.col ? Number(u.f.col) : mpick(S.cols), tx = S.tx ?? TX.plaster, wear = Math.floor(mr(2, 6));
  if (F === 0) return gardenWall(u, col, tx);
  const H = FH0 + (F - 1) * FHU;
  const shop = (S.shop || u.trade) && !u.f.noshop, ware = S.ware && !u.f.house;
  const shopD = shop ? Math.min(3.2, D - T - 1) : 0;
  const dark = 0x15110d;
  // --- body (solid) behind the front wall; a shop niche keeps the ground floor open
  W.box(w, H - (shop ? FH0 : 0), D - T, 0, (shop ? FH0 : 0) + (H - (shop ? FH0 : 0)) / 2, -T - (D - T) / 2, col, { t: tx, wear });
  W.solid(w, H - (shop ? FH0 : 0), D - T, 0, (shop ? FH0 : 0) + (H - (shop ? FH0 : 0)) / 2, -T - (D - T) / 2, 'plaster');
  if (shop) { const bd = D - T - shopD; W.box(w, FH0, bd, 0, FH0 / 2, -T - shopD - bd / 2, col, { t: tx, wear }); W.solid(w, FH0, bd, 0, FH0 / 2, -T - shopD - bd / 2, 'plaster'); }
  // --- ground floor
  const ops0 = [];
  let doorAt = null;
  if (shop) {
    const n = w > 7.5 ? 2 : 1, sw = Math.min(3.8, w / n - 1.0);
    for (let i = 0; i < n; i++) {
      const at = -w / 2 + (i + 0.5) * w / n;
      ops0.push({ at, w: sw, h: 2.8, kind: 'shop', style: 'roll', leaf: u.f.closed ? 'closed' : 'open', awning: u.f.noawn ? null : mpick([[0xb03a2e, 0xe8dcc0], [0x2a5a8a, 0xe8dcc0], [0xc89a3a, 0xc89a3a], [0x3a6a4a, 0xe8dcc0], [0x8a3a5a, 0xe8c8a0]]) });
      W.defer(() => shopNiche(at, sw, shopD, T, u.trade || mpick(TRADES), u.f.closed), 'near', [at, -T - shopD / 2]);
    }
  } else if (ware) {
    const dw = Math.min(4.2, w - 1.6); doorAt = 0;
    ops0.push({ at: 0, w: dw, h: 3.2, kind: 'door', style: 'metal', leaf: 'closed', double: true, doorCol: mpick([0x2a5a8a, 0x3a6a4a, 0x7a3a2a]) });
    for (const s of [-1, 1]) if (w > 8) ops0.push({ at: s * (w / 2 - 1.1), w: 0.9, h: 0.6, sill: 2.4, kind: 'win', win: 'grille' });
  } else {
    const dw = S.door === 'carved' ? 1.3 : 1.0, dh = S.door === 'carved' ? 2.5 : 2.15;
    doorAt = u.f.door !== undefined ? Number(u.f.door) * (w / 2 - 1) : (w > 5 ? mpick([-1, 1, 0]) * (w / 2 - dw / 2 - 0.9) : 0);
    const arch = S.door === 'carved' && (S.grand || mchance(0.6));
    ops0.push({ at: doorAt, w: dw, h: arch ? dh + 0.55 : dh, kind: arch ? 'archdoor' : 'door', arch: 'horse', style: S.door, leaf: 'closed', doorCol: S.doorCol ?? (S.door === 'metal' ? mpick([MC.blue, MC.green, 0x2a6a8a, 0x7a3a2a, 0x3a4048]) : undefined), hood: u.f.hood || (S.grand && mchance(0.5)), lamp: u.f.lamp || mchance(0.35) ? 0xffc070 : null, zellige: (u.f.zel || S.grand) ? Math.floor(mr(0, 8)) : undefined, rimCol: S.blue ? 0x5a86c0 : undefined });
    // a small high window or two (privacy) beside the door
    const free = [-w / 2 + 1.0, w / 2 - 1.0].filter((x) => Math.abs(x - doorAt) > dw / 2 + 0.9);
    for (const x of free) if (!S.few || mchance(0.5)) ops0.push({ at: x, w: 0.6, h: 0.7, sill: 1.7, kind: 'win', win: 'grille' });
  }
  TOWN.doors.push(W.worldPos(doorAt ?? 0, 0, 0.6));
  frontWall(w, 0, FH0, T, col, tx, wear, ops0, 0.55, S);
  // --- upper floors
  const nWin = Math.max(1, Math.min(4, Math.floor(w / (S.few ? 3.6 : 2.7))));
  for (let f = 1; f < F; f++) {
    const y0 = FH0 + (f - 1) * FHU, ops = [];
    for (let i = 0; i < nWin; i++) {
      if (S.few && nWin > 1 && mchance(0.3)) continue;
      const at = -w / 2 + (i + 0.5) * w / nWin;
      const kind = S.win === 'slit' ? 'slit' : S.win === 'arch' ? 'arch' : u.f.mash && i === 0 ? 'mash' : S.win;
      if (kind === 'slit') ops.push({ at, w: 0.35, h: 0.9, sill: 1.2, kind: 'win', win: 'open' });
      else if (kind === 'arch') ops.push({ at, w: S.grand ? 1.2 : 1.0, h: 1.9, sill: 0.7, kind: 'archwin', arch: mpick(['horse', 'point', 'round']), win: mchance(0.5) ? 'grille' : 'shut', shutCol: S.shut, box: mchance(0.35), zellige: S.grand ? 3 : undefined, rimCol: MC.cream });
      else if (kind === 'mash') ops.push({ at, w: 1.3, h: 1.6, sill: 0.8, kind: 'win', win: 'mash' });
      else ops.push({ at, w: kind === 'grille' ? 0.8 : 1.0, h: kind === 'grille' ? 1.0 : 1.5, sill: kind === 'grille' ? 1.1 : 0.8, kind: 'win', win: kind === 'shut' ? (mchance(0.3) ? 'shutclosed' : 'shut') : 'grille', shutCol: S.shut ?? mpick([MC.green, MC.blue, 0x6a4a2a, 0x2a5a6a, 0x8a2a24]), box: S.blue ? true : mchance(0.2) });
    }
    frontWall(w, y0, FHU, T, col, tx, wear, ops, 0, S);
    // balconies (mellah style or explicit)
    if ((S.bal || u.f.bal) && ops.length) for (const op of ops.filter((_, k) => k % 2 === 0)) W.defer(() => townBalcony(op.at, y0 + 0.02, Math.min(2.4, op.w + 1.2), S.bal ? 'wood' : 'iron'), 'mid', [op.at, 0.6]);
    if (f === 1 && S.blue) W.scope({ lod: 1 }, () => W.box(w + 0.02, 0.12, 0.06, 0, y0, 0.03, 0x5a86c0, { t: TX.plaster, wear: 3 }));
  }
  // string courses + blue skirt
  W.scope({ lod: 1 }, () => {
    if (!S.few) for (let f = 1; f < F; f++) W.box(w + 0.06, 0.13, 0.1, 0, FH0 + (f - 1) * FHU - 0.02, 0.05, shade(col, 0.92), { t: tx, wear: 3 });
    if (S.blue) W.box(w + 0.01, 1.1, 0.02, 0, 0.55, 0.01, 0x5a86c0, { t: TX.plaster, wear: 5 });
  });
  // roofline
  W.push(0, 0, -D / 2);
  const top = u.f.top ?? S.top;
  W.box(w - 0.3, 0.04, D - 0.3, 0, H + 0.02, 0, MC.roofGravel, { t: TX.gravel, wear: 5, lod: 1 });
  if (top === 'cornice') tiledCornice(w, D, H, col);
  else lightParapet(w, D, H, mr(0.7, 1.0), col, top === 'merlon' ? 'merlon' : 'plain');
  if (u.f.terr) W.defer(() => roofTerrace(w, D, H), 'mid');
  else if (!u.f.bare) roofClutter(-w / 2 + 0.4, -D / 2 + 0.4, w / 2 - 0.4, D / 2 - 0.4, H, { cheap: true, tank: 0.45, laundry: 0.35, dishYaw: 2.4 });
  W.pop();
  // life on the facade
  W.defer(() => W.scope({ lod: 1 }, () => {
    if (u.f.boug) bougainvillea(Number(u.f.boug === true ? mr(-w / 2 + 0.8, w / 2 - 0.8) : u.f.boug), Math.min(H + 0.5, FH0 + FHU), 0.05, mr(2.2, 3.4));
    if (u.f.vine) vineRun(-w / 2 + 0.3, w / 2 - 0.3, FH0 + 0.2, 0.06);
    if (u.f.rug) hangingRug(mr(-w / 2 + 1, w / 2 - 1), FH0 + 0.6, 0.06, 0, mr(1.1, 1.5), mr(1.6, 2.2));
    if (u.f.ac || mchance(0.18)) acWall(mr(-w / 2 + 0.8, w / 2 - 0.8), FH0 + mr(0.4, 1.0), 0.3, 0);
    if (u.f.sign) shopSign(0, FH0 - 0.15, 0.08, 0, Math.min(3, w - 1.5));
    if (!shop && !ware && doorAt !== null && (u.f.pots || mchance(0.4))) for (const s of [-1, 1]) if (mchance(0.7)) plantPot(doorAt + s * (S.door === 'carved' ? 1.0 : 0.85), 0, 0.35, mpick(['geranium', 'aloe', 'ficus', 'palm']), mr(0.9, 1.3));
    if (u.f.cat) cat(doorAt ?? 0.5, 0.06, 0.45, mr(0, 6));
    if (u.f.scoot) scooter(mr(-1, 1), 0.9, Math.PI / 2 + mr(-0.2, 0.2));
  }), 'mid', [0, 0.5]);
  return H;
}
// one storey of a front wall with its openings; dark voids behind every opening
function frontWall(w, y0, h, T, col, tx, wear, ops, plinth, S) {
  wall('x', -w / 2, w / 2, -T / 2, y0, h, T, { col, tx, wear, side: 1, ops, plinth, plinthCol: S.blue ? 0x4a76b0 : undefined, mat: 'plaster', ground: y0 });
  for (const op of ops) {
    if (op.kind === 'shop') continue;
    const sill = op.sill ?? 0, hh = op.kind === 'archwin' || op.kind === 'archdoor' ? op.h : op.h;
    W.box(op.w, hh, 0.03, op.at, y0 + sill + hh / 2, -T + 0.015, 0x14100c, { ao: false, t: TX.none, jit: 0 });
  }
}
// green glazed tile cornice on carved brackets
function tiledCornice(w, d, H, col) {
  W.scope({ lod: 1 }, () => {
    lightParapet(w, d, H, 0.5, col, 'plain');
    W.box(w + 0.5, 0.06, 0.8, 0, H + 0.62, d / 2 + 0.2, MC.tile, { rx: -0.35, t: TX.rooftile, wear: 2 });
    W.box(w + 0.3, 0.12, 0.3, 0, H + 0.42, d / 2 + 0.08, MC.cedar, { t: TX.carved });
    for (let x = -w / 2 + 0.4; x < w / 2; x += 0.8) W.box(0.08, 0.22, 0.32, x, H + 0.28, d / 2 + 0.12, MC.cedarDk, { lod: 2 });
  });
}
// a garden / courtyard wall with a gate and something green showing over it
function gardenWall(u, col, tx) {
  const w = u.w, D = u.d, h = 3.4;
  wall('x', -w / 2, w / 2, -0.21, 0, h, 0.42, { col, tx, side: 1, plinth: 0.5, mat: 'plaster', ops: u.f.gate ? [{ at: 0, w: 1.4, h: 2.6, kind: 'archdoor', arch: 'horse', style: 'carved', leaf: 'closed', zellige: 2 }] : [] });
  W.box(w + 0.1, 0.12, 0.6, 0, h + 0.06, -0.21, MC.tile, { t: TX.rooftile, lod: 1 });
  W.defer(() => {
    if (D > 3) for (let x = -w / 2 + 2; x < w / 2 - 1; x += mr(3.5, 5)) tree(x, 0, -D / 2 - mr(-0.5, 0.5), mpick(['orange', 'orange', 'olive', 'palm']), mr(1.0, 1.3));
    if (u.f.boug) bougainvillea(mr(-w / 2 + 1, w / 2 - 1), h + 0.4, 0.05, 2.8);
  }, 'mid', [0, -D / 2]);
  return h;
}
// an open shop niche: floor, back/side walls, shelves and goods spilling into the street
function shopNiche(at, sw, d, T, trade, closed) {
  if (closed) return;
  W.scope({ lod: 2, dim: 0.75 }, () => {
    W.box(sw, 0.04, d, at, 0.02, -T - d / 2, 0xb8a888, { t: TX.terrazzo, wear: 5, ao: false });
    W.box(sw, 0.04, d, at, FH0 - 0.25, -T - d / 2, 0xd8d0c0, { t: TX.plaster, dim: 0.6 });
    shopFit(at - sw / 2 + 0.05, -T - d, at + sw / 2 - 0.05, -T, 0, 1, trade, FH0 - 0.3);
  });
  W.scope({ lod: 2 }, () => {   // the spill: goods on the street in front of the shop
    const z = 0.55, ry = 0;
    if (trade === 'spice') { spiceStand(at, 0, z + 0.3, ry, Math.min(1.8, sw)); sack(at - sw / 2 + 0.2, 0, z, 0xc8a050); }
    else if (trade === 'pottery' || trade === 'copper') { potteryDisplay(at, 0, z + 0.3, ry, Math.min(2, sw)); if (trade === 'copper') copperware(at + sw / 2 - 0.3, 0, z, ry); }
    else if (trade === 'lamps') lanternCluster(at, FH0 - 0.6, 0.6, 7, sw / 2);
    else if (trade === 'rugs') { hangingRug(at - sw / 4, 0.4, 0.1, 0, 1.2, 2.2); rugPile(at + sw / 4, 0, z + 0.3, 0.1); }
    else if (trade === 'leather') babouches(at - sw / 2 + 0.1, 0, z + 0.2, 0, Math.min(1.6, sw - 0.2), 4);
    else if (trade === 'grocery') { produceCrates(at, 0, z + 0.25, ry, Math.min(1.8, sw)); }
    else if (trade === 'fabric') { fabricRolls(at, 0, z + 0.2, 0, 5); hangingRug(at + sw / 3, 0.6, 0.1, 0, 0.8, 1.8, mpick([0xc8a040, 0x3a7a8a, 0xa02a4a])); }
  });
}
// mellah wooden box balcony / iron balcony, on the front face at x
function townBalcony(x, y, len, style) {
  const dep = 0.9;
  W.push(x, y, 0);
  W.box(len, 0.14, dep, 0, -0.07, dep / 2, style === 'wood' ? MC.cedarDk : MC.concreteLt, { t: style === 'wood' ? TX.wood : TX.terrazzo, wear: 4 });
  for (let i = 0; i < 4; i++) W.box(0.08, 0.3, 0.08, -len / 2 + 0.15 + i * (len - 0.3) / 3, -0.25, dep - 0.1, MC.cedarDk, { lod: 2 });
  if (style === 'wood') {
    for (const [a, b] of [[[-len / 2, 0], [len / 2, 0]], [[-len / 2, 0], [-len / 2, -dep]], [[len / 2, 0], [len / 2, -dep]]]) {
      const cx = (a[0] + b[0]) / 2, cz = dep + (a[1] + b[1]) / 2, L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      W.box(a[1] === b[1] ? L : 0.05, 1.0, a[1] === b[1] ? 0.05 : L, cx, 0.5, a[1] === b[1] ? dep - 0.03 : dep / 2, MC.cedar, { t: TX.carved, wear: 4 });
    }
    W.box(len + 0.1, 0.06, dep + 0.08, 0, 1.0, dep / 2, MC.cedarDk, { t: TX.wood });
  } else railing(-len / 2, dep - 0.04, len / 2, dep - 0.04, 0, 'iron');
  W.solid(len, 0.14, dep, 0, -0.07, dep / 2, 'wood', { walk: true });
  if (mchance(0.6)) plantPot(len / 2 - 0.3, 0, dep - 0.3, mpick(['geranium', 'geranium', 'aloe']), 0.9);
  if (mchance(0.35)) W.box(len * 0.6, 0.7, 0.02, 0, 0.55, dep + 0.02, mpick([0x9a2a24, 0x2a3a6a, 0xc8a050, 0x6a2a4a]), { layer: 'cloth', t: TX.rug, wear: 3 });
  W.pop();
}
// roof terrace: tiled floor, pergola, cushions, plants, an umbrella
function roofTerrace(w, d, H) {
  W.scope({ lod: 1 }, () => {
    W.box(w - 0.5, 0.03, d - 0.5, 0, H + 0.05, 0, 0xc89a78, { t: TX.ceramic, wear: 3, ao: false });
    const px = w / 2 - Math.min(3, w * 0.4), pz = -d / 2 + 0.5;
    for (const [a, b] of [[px, pz], [w / 2 - 0.4, pz], [px, pz + 2.6], [w / 2 - 0.4, pz + 2.6]]) W.box(0.1, 2.3, 0.1, a, H + 1.15, b, MC.cedarDk, { t: TX.wood });
    for (let k = 0; k < 8; k++) W.box(w / 2 - 0.4 - px, 0.05, 0.06, (px + w / 2 - 0.4) / 2, H + 2.32, pz + k * 0.37, MC.cedar, { t: TX.wood });
    W.box(w / 2 - 0.4 - px + 0.4, 0.02, 2.8, (px + w / 2 - 0.4) / 2, H + 2.38, pz + 1.3, 0xd8c8a0, { layer: 'cloth', t: TX.fabric });
    sedari((px + w / 2 - 0.4) / 2, H + 0.06, pz + 0.4, 0, Math.min(2.6, w / 2 - 0.4 - px), mpick([0x9a2a24, 0x2a5a6a, 0xc8a050]));
    teaTable((px + w / 2 - 0.4) / 2, H + 0.06, pz + 1.4, 0.4);
    for (let i = 0; i < 3; i++) plantPot(-w / 2 + 0.6 + i * 0.7, H + 0.06, d / 2 - 0.6, mpick(['geranium', 'palm', 'aloe']), 1.1);
  });
}

// ---------------- no blank walls ----------------
// dress a plain wall face (frame: centre of the face at ground, x along it, +z out): side windows,
// plaster repairs, fallen plaster showing brick, drainpipe + roof spout, conduit and meter, AC, vents, stains
function dressFace(L, H, col, o = {}) {
  const y0 = o.y0 ?? 0;
  if (L < 1.2 || H - y0 < 1.2) return;
  W.defer(() => W.scope({ lod: 1 }, () => {
    const pick = (a, b) => mr(-L / 2 + a, L / 2 - b);
    // repairs and scars
    for (let i = 0, n = Math.ceil(L * (H - y0) / 14); i < n; i++) {
      const pw = mr(0.5, 1.8), ph = mr(0.4, 1.4), px = pick(pw / 2 + 0.1, pw / 2 + 0.1), py = mr(y0 + 0.6, H - 0.6);
      if (mchance(0.22)) W.box(pw * 0.7, ph * 0.6, 0.02, px, py, 0.005, mpick([0x9a5a40, 0x8a5038]), { t: TX.brick, wear: 6, ao: false });
      else W.box(pw, ph, 0.02, px, py, 0.008, shade(col, mr(0.86, 1.1)), { t: TX.plaster, wear: Math.floor(mr(1, 7)), ao: false });
    }
    // rain stains under the parapet
    for (let x = -L / 2 + mr(0.5, 2); x < L / 2 - 0.4; x += mr(1.5, 4)) W.box(mr(0.2, 0.6), mr(1, 3), 0.01, x, H - 1.2, 0.012, shade(col, 0.72), { t: TX.plaster, wear: 7, ao: false });
    // windows on the exposed storeys
    if (o.windows !== false) for (let y = Math.max(y0 + 1.4, FH0 + 0.9); y < H - 1.4; y += FHU) {
      const n = Math.floor(L / 3.4);
      for (let i = 0; i < n; i++) {
        if (mchance(0.35)) continue;
        const ww = mr(0.6, 1.0), wh = mr(0.8, 1.3), x = -L / 2 + (i + 0.5) * L / n + mr(-0.3, 0.3);
        W.box(ww, wh, 0.03, x, y + wh / 2, 0.015, 0x15110d, { ao: false });
        W.box(ww + 0.14, 0.06, 0.14, x, y - 0.03, 0.07, MC.stone, { t: TX.stone, wear: 4 });
        for (const s of [-1, 1]) W.box(0.07, wh + 0.07, 0.06, x + s * (ww / 2 + 0.035), y + wh / 2, 0.03, shade(col, 1.08), { t: TX.plaster });
        W.box(ww + 0.2, 0.09, 0.07, x, y + wh + 0.05, 0.035, shade(col, 1.08), { t: TX.plaster });
        const k = mrand();
        if (k < 0.4) shutters(ww, y, wh, 0.04, mchance(0.4), mpick([MC.green, MC.blue, 0x6a4a2a, 0x2a5a6a]));
        else if (k < 0.75) ironGrille(ww, y, wh, 0.02);
        else W.box(ww * 0.45, wh - 0.1, 0.01, -ww * 0.25 + x, y + wh / 2, 0.035, mpick([0xe8e0d0, 0xc8a070, 0x8a3a3a]), { layer: 'cloth', lod: 2 });
        if (mchance(0.15)) acWall(x + ww / 2 + 0.55, y - 0.5, 0, 0);
      }
    }
    // drainpipe from a roof spout
    if (mchance(o.pipe ?? 0.7)) { const x = mchance(0.5) ? -L / 2 + 0.25 : L / 2 - 0.25; W.rod([x, 0.1, 0.1], [x, H - 0.3, 0.1], 0.05, mpick([0x6a6a66, 0x8a8478, 0x4a4a4a]), { layer: 'metal', seg: 6 }); W.box(0.14, 0.12, 0.4, x, H - 0.25, 0.2, MC.stone, { t: TX.stone }); for (let y = 1; y < H - 0.5; y += 1.6) W.box(0.12, 0.03, 0.1, x, y, 0.06, 0x3a3a3a, { lod: 2 }); }
    else W.box(0.12, 0.12, 0.5, mr(-L / 2 + 0.5, L / 2 - 0.5), H - 0.25, 0.25, MC.cedarDk, { t: TX.wood });   // wooden gargoyle spout
    // electrics
    if (mchance(o.cable ?? 0.6)) { const y = mr(2.6, 3.4); W.rod([-L / 2, y, 0.04], [L / 2, y + mr(-0.15, 0.15), 0.04], 0.012, 0x1a1a1a, { seg: 3 }); if (mchance(0.6)) meterBox(mr(-L / 2 + 0.6, L / 2 - 0.6), 1.5, 0, 0); }
    if (mchance(0.25)) W.box(0.3, 0.3, 0.04, mr(-L / 2 + 0.5, L / 2 - 0.5), mr(2, H - 1), 0.02, 0x6a6a64, { layer: 'metal', t: TX.louver });   // vent
    if (mchance(0.2) && L > 3) wallLantern(mr(-L / 2 + 0.6, L / 2 - 0.6), 2.6, 0, true);
    if (o.green !== false && mchance(0.18)) bougainvillea(mr(-L / 2 + 0.8, L / 2 - 0.8), Math.min(H, 6.5), 0.02, 2.4);
    // plinth
    W.box(L, 0.5, 0.04, 0, 0.25, 0.02, shade(col, 0.8), { t: TX.plaster, wear: 7 });
  }), 'mid');
}
// ---------------- greenery ----------------
// bougainvillea: a twisted trunk up the wall and a magenta cascade over the parapet
function bougainvillea(x, top, z, spread = 3) {
  const cols = [0xc0306a, 0xd8408a, 0xa82a6a, 0xe05a9a, 0xb83478], leaf = [0x3a6a2a, 0x46782e, 0x2f5a22];
  // woody stems fanned up the wall, then a dense mantle of bracts over the top, thinning as it falls
  for (const k of [-1, 0, 1]) W.rod([x + k * 0.15, 0, z + 0.08], [x + k * spread * 0.22, top * 0.75, z + 0.1], 0.035, 0x5a4632, { seg: 4 });
  for (let i = 0; i < 46; i++) {
    const u = mr(-1, 1), fall = Math.pow(mrand(), 1.8) * (1.6 + (1 - Math.abs(u)) * 1.6);
    const px = x + u * spread / 2, py = top - fall + 0.15, r = mr(0.18, 0.36) * (1 - fall * 0.12);
    W.sphere(r * 1.4, r, r * 0.9, px, py, z + 0.12 + mr(0, 0.22), i % 3 === 0 ? mpick(leaf) : mpick(cols), { seg: 6, hseg: 4, t: TX.leaf, ao: false, jit: 0.15 });
  }
  for (let i = 0; i < 10; i++) W.sphere(mr(0.2, 0.32), mr(0.16, 0.24), 0.18, x + mr(-spread / 2, spread / 2), top + mr(-0.1, 0.3), z + mr(-0.2, 0.1), mpick(cols), { seg: 6, hseg: 4, t: TX.leaf, ao: false });
}
// a vine trained along a wire across a facade
function vineRun(x0, x1, y, z) {
  W.rod([x0, y, z + 0.1], [x1, y, z + 0.1], 0.015, MC.iron, { layer: 'metal' });
  for (let x = x0; x < x1; x += mr(0.35, 0.6)) W.sphere(mr(0.4, 0.6), mr(0.35, 0.6), 0.35, x, y - mr(0, 0.4), z + 0.2, mpick([0x3a6a2a, 0x4a7a32, 0x356024]), { seg: 5, hseg: 3, t: TX.leaf, ao: false });
}
function cypress(x, z, h = 9) {
  W.cyl(0.1, 0.16, 1, x, 0.5, z, 0x4a3a2a, { seg: 5 });
  W.cone(0.9, h, x, h / 2 + 0.4, z, 0x24402a, { seg: 8, t: TX.leaf });
  W.cone(0.75, h * 0.7, x, h * 0.45 + 0.2, z, 0x2c4a30, { seg: 7, t: TX.leaf, lod: 1 });
  W.solid(0.5, h, 0.5, x, h / 2, z, 'wood');
}
function cat(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  const c = mpick([0x2a2622, 0xb8763a, 0xe8e0d0, 0x6a6058]);
  W.sphere(0.32, 0.2, 0.18, 0, 0.14, 0, c, { seg: 6, hseg: 4 }); W.sphere(0.13, 0.12, 0.12, 0.17, 0.27, 0, c, { seg: 6, hseg: 4 });
  for (const s of [-1, 1]) W.cone(0.03, 0.06, 0.18, 0.35, s * 0.04, c, { seg: 3 });
  W.rod([-0.15, 0.12, 0], [-0.32, 0.05, 0.12], 0.02, c, { seg: 3 });
  W.pop();
}

// ---------------- streets ----------------
// a hand-drawn lane: registered for the planner/AI/NPCs, then paved
function lane(name, ctrl, w, kind, o = {}) {
  const st = addStreet(ctrl, w, kind, { raw: !!o.raw, district: o.district });
  TOWN.lanes[name] = st;
  const t = o.tx ?? (kind === 'avenue' || kind === 'quay' ? TX.paving : TX.cobble);
  ribbon(st.pts, -w / 2 - 0.6, w / 2 + 0.6, 0.03, o.col ?? (t === TX.cobble ? MC.cobble : MC.paving), t, { wear: 4 });
  if (kind !== 'avenue' && kind !== 'quay') ribbon(st.pts, -0.22, 0.22, 0.034, 0x8a7a64, TX.stone, { wear: 6, lod: 1 });   // centre gutter
  return st;
}
// frontage: hand-written house sequence along one side of a lane (side +1 = right of travel)
// o: { start, end, d: default depth, fill: tokens to keep cycling once the list runs out, setback }
function front(st, side, spec, o = {}) {
  const toks = spec.trim().split(/\s+/).filter(Boolean), fill = o.fill ? o.fill.trim().split(/\s+/) : null;
  const L = st.len - (o.end ?? 0.5), setback = st.w / 2 + (o.setback ?? 0.05);
  let s = o.start ?? 0.3, k = 0, guard = 0;
  const out = [];
  while (s < L && guard++ < 400) {
    const tok = k < toks.length ? toks[k] : fill ? fill[(k - toks.length) % fill.length] : null;
    if (!tok) break;
    const u = parseUnit(tok); if (!u.d) u.d = o.d ?? 8;
    if (tok.startsWith('-')) { s += Math.abs(u.w); k++; continue; }   // "-3" = leave a gap of 3 m
    if (s + u.w > L + 0.3) { if (u.w > 3.2) { u.w = Math.max(3, L - s); } else break; }
    const p = pathAt(st.pts, s + u.w / 2), nx = -p.tz * side, nz = p.tx * side, ry = Math.atan2(-nx, -nz);
    let placed = false;
    for (let d = u.d; d >= 3; d -= 1.5) {
      const cx = p.x + nx * (setback + d / 2), cz = p.z + nz * (setback + d / 2);
      if (!GR.free(cx, cz, u.w - 0.9, d - 0.9, ry, 0)) continue;
      GR.rect(cx, cz, u.w + 0.2, d + 0.2, ry, GR.BUILT);
      u.d = d;
      W.push(p.x + nx * setback, 0, p.z + nz * setback, ry);
      const H = townUnit(u);
      W.pop();
      // exposed side walls: above a lower neighbour, or the whole side at a gap / junction
      const prev = out[out.length - 1], joined = prev && prev.s1 > s - 0.6, me = { ...u, x: cx, z: cz, ry, H, s1: s + u.w, ox: p.x + nx * setback, oz: p.z + nz * setback };
      const low = joined ? prev.H : 0;
      if (H > low + 1.2) sideFace(me, -1, low);
      if (prev && (!joined || prev.H > H + 1.2)) sideFace(prev, 1, joined ? H : 0);
      out.push(me);
      placed = true; break;
    }
    if (placed) { s += u.w; k++; } else s += 1;
  }
  const last = out[out.length - 1];
  if (last) sideFace(last, 1, 0);
  return out;
}
// dress one side wall of a placed unit (side −1 = left, +1 = right) from height y0 up
function sideFace(u, side, y0) {
  W.push(u.ox, 0, u.oz, u.ry); W.push(side * u.w / 2, 0, -u.d / 2, side * Math.PI / 2);
  dressFace(u.d, u.H, mpick(STY[u.s]?.cols || STY.o.cols), { y0, windows: u.H - y0 > 3 });
  W.pop(); W.pop();
}
// back-of-block masses: everything left inside a block becomes roofscape (seen from the rooftops/minaret)
function fillBlocks(x0, z0, x1, z1, inside, cols) {
  for (const r of fillFree(x0, z0, x1, z1, inside, { cell: 2, max: 12, minA: 4 })) {
    const H = mpick([6.6, 6.9, 7.2, 8.4, 9.6]), col = mpick(cols);
    W.box(r.w, H, r.d, r.cx, H / 2, r.cz, col, { t: TX.plaster, wear: 4 });
    W.solid(r.w, H, r.d, r.cx, H / 2, r.cz, 'plaster');
    W.push(r.cx, 0, r.cz);
    W.box(r.w - 0.3, 0.04, r.d - 0.3, 0, H + 0.02, 0, MC.roofGravel, { t: TX.gravel, wear: 5, lod: 1 });
    lightParapet(r.w, r.d, H, 0.7, col, mchance(0.2) ? 'merlon' : 'plain');
    // faces that happen to see a street get a plinth and a shuttered window
    for (const [sx, sz, ry, L] of [[0, 1, 0, r.w], [0, -1, Math.PI, r.w], [1, 0, Math.PI / 2, r.d], [-1, 0, -Math.PI / 2, r.d]]) {
      const ox = sx * (r.w / 2), oz = sz * (r.d / 2), g = GR.get(r.cx + ox + sx * 1.5, r.cz + oz + sz * 1.5);
      if (g !== GR.STREET && g !== GR.PAVE) continue;
      W.push(ox, 0, oz, ry); dressFace(L, H, col, {}); W.pop();
    }
    if (r.w * r.d > 20) roofClutter(-r.w / 2 + 0.4, -r.d / 2 + 0.4, r.w / 2 - 0.4, r.d / 2 - 0.4, H, { cheap: true, tank: 0.5, laundry: 0.4 });
    W.pop();
  }
}
// overhead life across a lane: cables, laundry, lanterns, a sabat (room bridging the lane)
function overhead(st, s, kind, o = {}) {
  const p = pathAt(st.pts, s), n = [-p.tz, p.tx], r = st.w / 2 + 0.1, ry = Math.atan2(-p.tz, p.tx);
  const A = (y, k = 1) => [p.x + n[0] * r * k, y, p.z + n[1] * r * k], B = (y, k = 1) => [p.x - n[0] * r * k, y, p.z - n[1] * r * k];
  W.defer(() => W.scope({ lod: 1 }, () => {
    if (kind === 'cable') { const y = o.y ?? mr(4.5, 6); W.cable(A(y), B(y + mr(-0.4, 0.4)), 0.4, 0.012, 0x1a1a1a, 8); }
    else if (kind === 'laundry') laundryLine(...A(o.y ?? 5), ...B(o.y ?? 5), Math.max(3, Math.floor(st.w / 0.7)));
    else if (kind === 'lantern') { const y = o.y ?? 4.4; W.cable(A(y + 0.6), B(y + 0.6), 0.3, 0.01, 0x1a1a1a, 6); hangLantern(p.x, y + 0.3, p.z, 0xffc070, 0.25, true); }
    else if (kind === 'bunting') { const y = o.y ?? 5; W.cable(A(y), B(y), 0.5, 0.008, 0xe8e0d0, 6); for (let t = 0.08; t < 0.95; t += 0.11) { const q = [lerp(A(y)[0], B(y)[0], t), y - Math.sin(t * Math.PI) * 0.5 - 0.15, lerp(A(y)[2], B(y)[2], t)]; W.box(0.24, 0.26, 0.01, q[0], q[1], q[2], mpick([0xc0302a, 0x2a6a4a, 0xe8c040, 0x2a5aa0, 0xe8e0d0]), { ry, layer: 'cloth', rz: Math.PI / 4, ao: false }); } }
  }), 'mid', [p.x, p.z]);
  if (kind === 'sabat') {   // a little room bridging the lane, on beams, with a window each side
    const len = o.len ?? 4, y = o.y ?? 3.4, h = 2.8, col = o.col ?? MC.ochre;
    W.push(p.x, 0, p.z, ry);
    W.box(len, h, st.w + 1.0, 0, y + h / 2, 0, col, { t: TX.plaster, wear: 5 }); W.solid(len, h, st.w + 1.0, 0, y + h / 2, 0, 'plaster');
    for (let i = 0; i < 5; i++) W.box(0.14, 0.14, st.w + 1.0, -len / 2 + 0.3 + i * (len - 0.6) / 4, y - 0.07, 0, MC.cedarDk, { t: TX.wood });
    W.box(len, 0.06, st.w + 0.9, 0, y + 0.01, 0, 0x7a6a50, { t: TX.wood });
    for (const s2 of [-1, 1]) { W.box(0.7, 0.8, 0.03, 0, y + 1.3, 0, 0x14100c); W.push(0, y + 0.9, s2 * 0.02, 0); W.pop(); }
    W.pop();
  }
}

// ---------------- the sea ----------------
const SEA = (() => {
  const mat = new THREE.ShaderMaterial({
    transparent: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { t: { value: 0 }, sunDir: { value: new V3(-0.74, 0.43, 0.52).normalize() }, sky: { value: new THREE.Color(0x9fb4c8) }, deep: { value: new THREE.Color(0x0e3a4a) }, shallow: { value: new THREE.Color(0x2a7a7a) } }]),
    vertexShader: `#include <common>
      varying vec3 vW;
      #include <fog_pars_vertex>
      #include <logdepthbuf_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
      #include <logdepthbuf_vertex>
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float t; uniform vec3 sunDir, sky, deep, shallow; varying vec3 vW;
      #include <fog_pars_fragment>
      #include <logdepthbuf_pars_fragment>
      vec2 h2(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return -1. + 2.*fract(sin(p)*43758.5453); }
      float gn(vec2 p){ vec2 i = floor(p), f = fract(p), u = f*f*(3.-2.*f); return mix(mix(dot(h2(i),f), dot(h2(i+vec2(1,0)),f-vec2(1,0)),u.x), mix(dot(h2(i+vec2(0,1)),f-vec2(0,1)), dot(h2(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y); }
      float hgt(vec2 p){ return gn(p*.12 + vec2(t*.05, t*.03))*1.0 + gn(p*.35 - vec2(t*.11, -t*.07))*.4 + gn(p*1.1 + vec2(t*.3, t*.21))*.12; }
      void main(){
        #include <logdepthbuf_fragment>
        vec2 p = vW.xz; float e = .25;
        vec3 n = normalize(vec3(hgt(p-vec2(e,0.)) - hgt(p+vec2(e,0.)), 2.*e*2.2, hgt(p-vec2(0.,e)) - hgt(p+vec2(0.,e))));
        vec3 v = normalize(cameraPosition - vW);
        float fr = .03 + .97 * pow(1. - max(dot(n, v), 0.), 5.);
        vec3 r = reflect(-v, n);
        float shore = smoothstep(26., 0., vW.z - 112.) ;
        vec3 water = mix(deep, shallow, .35 + .4 * shore);
        vec3 c = mix(water, sky, clamp(fr, 0., .85));
        c += vec3(1.4,1.2,.95) * pow(max(dot(r, sunDir), 0.), 180.) * 3.;
        c += vec3(.9) * smoothstep(.55, .75, hgt(p*1.3)) * .06;
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000, 1, 1).rotateX(-Math.PI / 2), mat);
  mesh.position.set(0, -1.25, 0); mesh.renderOrder = -1;
  return { mesh, mat, add() { scene.add(mesh); }, update(t) { mat.uniforms.t.value = t; } };
})();

// ---------------- harbour props ----------------
// Essaouira fishing boat: blue hull, red/yellow trim, a little wheelhouse on the bigger ones
function fishingBoat(x, z, ry, L = 7, o = {}) {
  // local +z = bow. A planked shell: side strakes and a bottom between tapered stations, sheer rising to the bow
  W.push(x, o.y ?? -1.0, z, ry);
  const B = L * 0.3, hull = o.col ?? mpick([0x2a5aa0, 0x2a6ab0, 0x3a7ac0, 0x2a4a8a, 0x2a5aa0]), trim = mpick([0xc8302a, 0xe8c040, 0xe8e0d0, 0xc8302a]), inside = 0x8a6a4a;
  const N = 7, st = [];
  for (let i = 0; i <= N; i++) { const t = i / N, w = B * (t < 0.12 ? 0.82 + t * 1.4 : 1 - Math.pow(Math.max(0, (t - 0.5) / 0.5), 1.7) * 0.94), sh = 0.95 + 0.45 * t * t; st.push({ z: (t - 0.5) * L, w: Math.max(0.12, w), sh }); }
  for (let i = 0; i < N; i++) {
    const a = st[i], b = st[i + 1], mz = (a.z + b.z) / 2, len = Math.hypot(b.z - a.z, (b.w - a.w) / 2), h = (a.sh + b.sh) / 2;
    for (const sd of [-1, 1]) {
      const ang = Math.atan2(sd * (b.w - a.w) / 2, b.z - a.z), mx = sd * (a.w + b.w) / 4;
      W.box(0.08, h, len + 0.04, mx, h / 2, mz, hull, { ry: -ang, t: TX.wood, wear: 5 });
      W.box(0.12, 0.1, len + 0.06, mx, h + 0.02, mz, trim, { ry: -ang, t: TX.wood, wear: 4, lod: 1 });
      W.box(0.09, 0.08, len + 0.04, mx * 1.01, 0.35, mz, shade(hull, 0.7), { ry: -ang, t: TX.wood, lod: 1 });
    }
    W.box(Math.min(a.w, b.w) - 0.08, 0.08, b.z - a.z + 0.02, 0, 0.04, mz, shade(hull, 0.55), { t: TX.wood, wear: 6 });
    W.box(Math.min(a.w, b.w) - 0.2, 0.04, b.z - a.z, 0, 0.28, mz, inside, { t: TX.wood, wear: 5, lod: 1 });
  }
  W.box(0.14, 0.5, 0.3, 0, st[N].sh - 0.1, st[N].z + 0.05, trim, { lod: 1 });   // stem post
  W.box(st[0].w, st[0].sh, 0.08, 0, st[0].sh / 2, st[0].z, hull, { t: TX.wood, wear: 5 });   // transom
  W.scope({ lod: 1 }, () => {
    for (const t of [0.3, 0.6]) W.box(B * 0.9, 0.06, 0.28, 0, 0.62, (t - 0.5) * L, inside, { t: TX.wood });   // thwarts
    if (L > 8.5) { W.box(1.5, 1.5, 1.7, 0, 1.25, -L * 0.18, 0xe8e0d0, { t: TX.wood, wear: 4 }); W.box(1.7, 0.1, 1.9, 0, 2.05, -L * 0.18, trim, { t: TX.wood }); W.box(1.1, 0.45, 0.02, 0, 1.6, -L * 0.18 + 0.86, 0x14100c); W.rod([0, 2, -L * 0.18], [0, 4.8, -L * 0.18], 0.05, 0xe8e0d0); }
    else { W.box(0.32, 0.55, 0.32, 0, 0.9, st[0].z - 0.2, 0x2a2a2a, { layer: 'metal' }); W.rod([0, 0.6, st[0].z - 0.25], [0, -0.3, st[0].z - 0.3], 0.05, 0x3a3a3a, { layer: 'metal' }); }
    W.box(0.6, 0.02, 0.14, B * 0.3, 0.75, L * 0.3, 0xe8e0d0, { lod: 2 });   // registration plate
  });
  W.scope({ lod: 2 }, () => { if (mchance(0.6)) netPile(mr(-0.3, 0.3), 0.3, mr(-L * 0.25, L * 0.1)); for (let i = 0; i < 2; i++) if (mchance(0.5)) crate(mr(-0.4, 0.4), 0.3, mr(-L * 0.3, 0), 0.6, 0.35, 0.45, mr(0, 1), 0x9a8a6a, false); });
  W.pop();
}
function netPile(x, y, z) {
  const c = mpick([0x2a6a4a, 0x8a3a2a, 0x3a4a6a, 0xc8a040]);
  for (let i = 0; i < 4; i++) W.sphere(mr(0.6, 1.0), mr(0.25, 0.4), mr(0.6, 1.0), x + mr(-0.3, 0.3), y + 0.1 + i * 0.08, z + mr(-0.3, 0.3), c, { seg: 7, hseg: 3, layer: 'cloth', t: TX.fabric, wear: 6 });
}
function bollardQuay(x, z) { W.cyl(0.22, 0.26, 0.6, x, 0.3, z, 0x2a2a2a, { seg: 8, layer: 'metal', t: TX.metal, wear: 6 }); W.cyl(0.3, 0.3, 0.08, x, 0.62, z, 0x2a2a2a, { seg: 8, layer: 'metal' }); W.solid(0.5, 0.65, 0.5, x, 0.32, z, 'metal'); }
function cannon(x, y, z, ry) {
  W.push(x, y, z, ry);
  W.box(0.9, 0.35, 1.4, 0, 0.35, 0, MC.cedarDk, { t: TX.wood, wear: 6 });
  for (const s of [-1, 1]) for (const zz of [-0.5, 0.5]) W.cyl(0.22, 0.22, 0.08, s * 0.48, 0.22, zz, MC.cedarDk, { rz: Math.PI / 2, seg: 8 });
  W.cyl(0.13, 0.2, 2.4, 0, 0.7, 0.6, 0x2a2c2a, { rx: Math.PI / 2 - 0.08, seg: 10, layer: 'metal', t: TX.metal, wear: 7 });
  W.solid(0.9, 0.9, 2.2, 0, 0.45, 0.4, 'metal');
  W.pop();
}

// ---------------- market pieces (souk roof, food stalls, juice carts, café umbrellas) ----------------
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
