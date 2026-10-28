// =====================================================================
//  CITY — building generators
// =====================================================================
// Every generator works in a lot frame: origin = footprint centre on the ground, local +Z = the
// street front. A lot: {cx, cz, ry, w, d, open:{s,n,e,w}, ...}. Enterable buildings get real floors,
// stairs, partitions, doors, windows, furniture and lights; shells are single solid masses with a
// fully dressed facade (no fake doorways: shell doors are closed and solid).
const STREET_SIDE = ['s', 'n', 'e', 'w'];
// keep a doorway's approach free of street props: stamp it as paved on the planning grid
function markDoor(lx, lz, w = 1.6, dep = 2.6) { const p = W.worldPos(lx, 0, lz), ry = W.worldRotY(); GR.rect(p.x, p.z, w + 0.8, dep, ry, GR.PAVE, true); }
function inLot(lot, fn) { W.push(lot.cx, lot.y ?? 0, lot.cz, lot.ry); try { fn(); } finally { W.pop(); } }
const G0 = 0.15; // ground-floor slab top (one small step up from the street)

// ---------------- exterior walls for enterable buildings ----------------
// per side, split into segments by the rooms behind it so the inside face takes each room's paint
function extWalls(w, d, T, y, H, rooms, sp) {
  const defs = { s: ['x', -w / 2, w / 2, d / 2 - T / 2, 1], n: ['x', -w / 2, w / 2, -d / 2 + T / 2, -1], e: ['z', -d / 2 + T, d / 2 - T, w / 2 - T / 2, 1], w: ['z', -d / 2 + T, d / 2 - T, -w / 2 + T / 2, -1] };
  for (const side of STREET_SIDE) {
    const [ax, A0, A1, c, sgn] = defs[side];
    const touching = rooms.filter((r) => (side === 's' && Math.abs(r.z1 - d / 2) < 0.05) || (side === 'n' && Math.abs(r.z0 + d / 2) < 0.05) || (side === 'e' && Math.abs(r.x1 - w / 2) < 0.05) || (side === 'w' && Math.abs(r.x0 + w / 2) < 0.05))
      .map((r) => ({ a0: ax === 'x' ? r.x0 : r.z0, a1: ax === 'x' ? r.x1 : r.z1, r })).sort((p, q) => p.a0 - q.a0);
    const segs = []; let cur = A0;
    for (const t of touching) { const a0 = Math.max(cur, t.a0), a1 = Math.min(A1, t.a1); if (a0 > cur + 0.05) segs.push({ a0: cur, a1: a0, r: null }); if (a1 > a0) segs.push({ a0, a1, r: t.r }); cur = Math.max(cur, a1); }
    if (A1 > cur + 0.05) segs.push({ a0: cur, a1: A1, r: null });
    const ops = sp.ops?.[side] || [];
    for (const g of segs) {
      const mine = ops.filter((o) => o.at >= g.a0 && o.at < g.a1);
      wall(ax, g.a0, g.a1, c, y, H, T, { col: sp.col, tx: sp.tx ?? TX.plaster, wear: sp.wear ?? 3, inCol: g.r ? g.r.paint : (sp.inCol ?? MC.plasterLt), inTx: g.r?.wallTx ?? TX.plaster, dimIn: g.r ? (g.r.dim ?? DIM_IN) : DIM_IN, side: sgn, ops: mine, plinth: sp.plinth, plinthCol: sp.plinthCol, ground: 0, mat: sp.mat ?? 'plaster' });
    }
  }
}
// windows for rooms on exterior sides of a floor; returns ops by side
function roomWindows(rooms, w, d, sp, ops = { s: [], n: [], e: [], w: [] }) {
  for (const r of rooms) {
    if (r.noWin) continue;
    for (const side of STREET_SIDE) {
      if (sp.open && !sp.open[side]) continue;
      const on = (side === 's' && Math.abs(r.z1 - d / 2) < 0.05) || (side === 'n' && Math.abs(r.z0 + d / 2) < 0.05) || (side === 'e' && Math.abs(r.x1 - w / 2) < 0.05) || (side === 'w' && Math.abs(r.x0 + w / 2) < 0.05);
      if (!on) continue;
      const a0 = side === 's' || side === 'n' ? r.x0 : r.z0, a1 = side === 's' || side === 'n' ? r.x1 : r.z1, L = a1 - a0;
      if (L < 1.6) continue;
      if (ops[side].some((o) => o.at > a0 && o.at < a1)) continue;
      const n = L > 5 ? 2 : 1;
      const small = r.type === 'bath' || r.type === 'storage' || r.type === 'stairhall';
      for (let i = 0; i < n; i++) {
        const at = a0 + (i + 0.5) * L / n;
        const op = { at, w: small ? 0.6 : (sp.winW ?? 1.1), h: small ? 0.6 : (sp.winH ?? 1.4), sill: small ? 1.5 : (sp.sill ?? 0.95), kind: sp.arched && !small ? 'archwin' : 'win', arch: 'point', win: small ? 'grille' : (sp.win ?? 'shut'), shutCol: sp.shutCol, grille: sp.grille, box: !small && mchance(sp.flowerBox ?? 0) };
        if (sp.balcony && r.floor > 0 && side === 's' && (r.type === 'living' || r.type === 'salon' || r.type === 'bedroom') && i === 0 && mchance(sp.balcony)) { op.kind = 'door'; op.style = 'glass'; op.leaf = mpick(['open', 'ajar']); op.w = 1.0; op.h = 2.2; op.sill = 0; op.balcony = true; r.wins.push({ side, at, w: 1.0 }); r.doors.push({ side, at, w: 1.0 }); }
        else r.wins.push({ side, at, w: op.w });
        ops[side].push(op);
      }
    }
  }
  return ops;
}
// balcony slab + railing in front of an opening on a side
function balconyOut(side, w, d, at, y, len = 2.4, dep = 1.1, style = 'iron') {
  const p = side === 's' ? [at, d / 2] : side === 'n' ? [at, -d / 2] : side === 'e' ? [w / 2, at] : [-w / 2, at];
  const ry = side === 's' ? 0 : side === 'n' ? Math.PI : side === 'e' ? Math.PI / 2 : -Math.PI / 2;
  W.push(p[0], y, p[1], ry);
  W.box(len, 0.16, dep, 0, -0.08, dep / 2, MC.concreteLt, { t: TX.terrazzo, wear: 4 });
  W.box(len + 0.04, 0.06, dep + 0.02, 0, -0.18, dep / 2, MC.plaster, { t: TX.plaster, wear: 5 });
  W.solid(len, 0.16, dep, 0, -0.08, dep / 2, 'concrete', { walk: true });
  railing(-len / 2, dep - 0.04, len / 2, dep - 0.04, 0, style); railing(-len / 2, 0.1, -len / 2, dep - 0.04, 0, style); railing(len / 2, 0.1, len / 2, dep - 0.04, 0, style);
  W.scope({ lod: 2 }, () => { if (mchance(0.5)) plantPot(len / 2 - 0.3, 0, dep - 0.3, mpick(['geranium', 'aloe'])); if (mchance(0.4)) plasticChair(-len / 4, 0, dep / 2, mr(0, 6)); if (mchance(0.3)) butane(-len / 2 + 0.3, 0, 0.3, true); });
  W.pop();
}
function opsWithBalconies(ops, w, d, y, style) { for (const side of STREET_SIDE) for (const o of ops[side] || []) if (o.balcony) balconyOut(side, w, d, o.at, y, 2.2, 1.0, style); }
// facade trim: string course at each floor line + crown cornice (shared by shells and enterables)
function cornices(w, d, ys, col, sides = 'snew') {
  W.scope({ lod: 1 }, () => {
    for (const y of ys) {
      if (sides.includes('s')) W.box(w + 0.1, 0.14, 0.08, 0, y, d / 2 + 0.04, col, { t: TX.plaster, wear: 4 });
      if (sides.includes('n')) W.box(w + 0.1, 0.14, 0.08, 0, y, -d / 2 - 0.04, col, { t: TX.plaster, wear: 4 });
      if (sides.includes('e')) W.box(0.08, 0.14, d + 0.1, w / 2 + 0.04, y, 0, col, { t: TX.plaster, wear: 4 });
      if (sides.includes('w')) W.box(0.08, 0.14, d + 0.1, -w / 2 - 0.04, y, 0, col, { t: TX.plaster, wear: 4 });
    }
  });
}
// rooftop life: tanks, dishes, laundry, antennas, AC, plants, a chair, a pigeon coop…
function roofClutter(x0, z0, x1, z1, y, o = {}) { W.defer(() => roofClutterNow(x0, z0, x1, z1, y, o), 'mid'); }
function roofClutterNow(x0, z0, x1, z1, y, o = {}) {
  const w = x1 - x0, d = z1 - z0, A = w * d, avoid = o.avoid || [];
  const free = (x, z, r = 0.8) => !avoid.some((a) => x > a[0] - r && x < a[2] + r && z > a[1] - r && z < a[3] + r);
  const pick = () => { for (let t = 0; t < 8; t++) { const x = mr(x0 + 0.9, x1 - 0.9), z = mr(z0 + 0.9, z1 - 0.9); if (free(x, z)) return [x, z]; } return null; };
  W.scope({ lod: 1 }, () => {
    const nd = Math.min(o.cheap ? 1 : 3, Math.floor(A / 40) + (mchance(o.cheap ? 0.45 : 0.7) ? 1 : 0));
    for (let i = 0; i < nd; i++) { const p = pick(); if (p) satDish(p[0], y, p[1], mr(-1, 1) + (o.dishYaw ?? 2.4), mr(0.8, 1.3)); }
    if (mchance(o.tank ?? 0.7)) { const p = pick(); if (p) waterTank(p[0], y, p[1]); }
    if (mchance(o.cheap ? 0.15 : 0.4)) { const p = pick(); if (p) antenna(p[0], y, p[1]); }
    if (mchance(o.ac ?? 0.4)) { const p = pick(); if (p) acCondenser(p[0], y, p[1], mr(0, 3)); }
    if (mchance(o.laundry ?? 0.45) && w > 4) { const z = mr(z0 + 1.2, z1 - 1.2); laundryLine(x0 + 0.6, y + 1.7, z, x1 - 0.6, y + 1.7, z + mr(-0.5, 0.5), Math.floor(w / 0.9)); for (const xx of [x0 + 0.6, x1 - 0.6]) W.rod([xx, y, z], [xx, y + 1.8, z], 0.02, MC.iron, { lod: 2 }); }
  });
  if (o.cheap) return;
  W.scope({ lod: 2 }, () => {
    if (mchance(o.life ?? 0.35)) { const p = pick(); if (p) { plasticChair(p[0], y, p[1], mr(0, 6), mpick([PC.white, PC.blueLt, PC.green])); if (mchance(0.5)) plasticTable(p[0] + 0.8, y, p[1], 0, PC.white); } }
    if (mchance(0.4)) { const p = pick(); if (p) plantPot(p[0], y, p[1], mpick(['geranium', 'aloe', 'palm'])); }
    if (mchance(0.25)) { const p = pick(); if (p) for (let i = 0; i < 3; i++) cardboard(p[0] + mr(-0.5, 0.5), y, p[1] + mr(-0.5, 0.5), mr(0, 3)); }
    if (mchance(0.15)) { const p = pick(); if (p) { W.box(1.2, 1.0, 0.8, p[0], y + 0.5, p[1], MC.cedarLt, { t: TX.wood, wear: 6 }); W.box(1.2, 0.8, 0.01, p[0], y + 0.5, p[1] + 0.41, MC.iron, { layer: 'glass' }); } } // pigeon coop
  });
}

// ---------------- shells (non-enterable masses with dressed facades) ----------------
// window decoration on a solid face (the mass behind it stays solid): frame, dark pane, sill, shutters/grille
function faceWindow(side, w, d, at, y, ww, wh, style, sp = {}) {
  const p = side === 's' ? [at, d / 2] : side === 'n' ? [-at, -d / 2] : side === 'e' ? [w / 2, -at] : [-w / 2, at];
  const ry = side === 's' ? 0 : side === 'n' ? Math.PI : side === 'e' ? Math.PI / 2 : -Math.PI / 2;
  W.push(p[0], y, p[1], ry);
  W.box(ww, wh, 0.02, 0, wh / 2, 0.01, MC.glassDk, { layer: 'pane' });
  W.defer(() => W.scope({ lod: 1 }, () => {
    W.box(ww + 0.12, 0.06, 0.12, 0, -0.03, 0.06, sp.sillCol ?? MC.stone, { t: TX.stone, wear: 4 });
    for (const s of [-1, 1]) W.box(0.06, wh, 0.06, s * (ww / 2 + 0.03), wh / 2, 0.03, sp.frame ?? MC.plasterLt, { t: TX.plaster });
    W.box(ww + 0.12, 0.08, 0.06, 0, wh + 0.04, 0.03, sp.frame ?? MC.plasterLt, { t: TX.plaster });
    W.box(0.04, wh, 0.03, 0, wh / 2, 0.025, sp.mullion ?? 0xd8d8d0, { layer: 'metal', lod: 2 });
    if (style === 'grille') ironGrille(ww, 0, wh, 0.0);
    else if (style === 'shut' || style === 'shutclosed') shutters(ww, 0, wh, 0.0, style === 'shutclosed' || mchance(0.35), sp.shutCol ?? mpick([MC.green, MC.blue, 0x6a4a2a, 0x2a5a6a]));
    else if (style === 'mash') mashrabiya(ww, 0, wh, 0.0, sp.mashCol ?? MC.cedar);
    else if (style === 'curtain') W.box(ww * 0.45, wh - 0.1, 0.01, -ww * 0.27, wh / 2, 0.03, mpick([0xe8e0d0, 0xc8a070, 0x8a3a3a, 0x3a5a8a]), { layer: 'cloth', lod: 2 });
    if (sp.ac && mchance(sp.ac)) acWall(ww / 2 + 0.6, -0.4, 0, 0);
  }), 'mid');
  W.pop();
}
// closed door on a solid face (locked: leaf flush in a recess frame)
function faceDoor(side, w, d, at, y, dw, dh, style, sp = {}) {
  const p = side === 's' ? [at, d / 2] : side === 'n' ? [-at, -d / 2] : side === 'e' ? [w / 2, -at] : [-w / 2, at];
  const ry = side === 's' ? 0 : side === 'n' ? Math.PI : side === 'e' ? Math.PI / 2 : -Math.PI / 2;
  W.push(p[0], y, p[1], ry);
  const col = sp.doorCol ?? (style === 'carved' ? MC.cedar : style === 'metal' ? mpick([MC.blue, MC.green, 0x7a3a2a, 0x3a4048, 0x2a6a8a]) : MC.cedarLt);
  W.box(dw, dh, 0.04, 0, dh / 2, 0.02, col, { t: style === 'carved' ? TX.carved : style === 'metal' ? TX.metal : TX.wood, wear: 5, layer: style === 'metal' ? 'metal' : 'solid' });
  W.defer(() => W.scope({ lod: 1 }, () => {
    for (const s of [-1, 1]) W.box(0.12, dh + 0.1, 0.1, s * (dw / 2 + 0.06), (dh + 0.1) / 2, 0.05, sp.frame ?? MC.stone, { t: TX.stone, wear: 4 });
    W.box(dw + 0.36, 0.14, 0.1, 0, dh + 0.12, 0.05, sp.frame ?? MC.stone, { t: TX.stone, wear: 4 });
    W.box(dw + 0.2, 0.12, 0.3, 0, 0.06, 0.15, MC.stone, { t: TX.stone, wear: 6 });
    if (style === 'carved') { for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) W.box(0.03, 0.03, 0.02, (k - 1) * dw * 0.3, 0.35 + r * (dh - 0.7) / 3, 0.05, MC.brass, { layer: 'metal', lod: 2 }); W.torus(0.05, 0.012, dw * 0.25, dh * 0.55, 0.06, MC.brass, { layer: 'metal', seg: 8, lod: 2 }); }
    if (sp.hood) doorHood(dw, dh + 0.1, 0, sp.hood);
    if (sp.arch) { const n = 9; for (let i = 0; i < n; i++) { const t = (i + 0.5) / n - 0.5, top = archY('horse', t * dw, dw) * 0.6; W.box(dw / n, top, 0.04, t * dw, dh + 0.18 + top / 2, 0.02, col, { t: TX.carved }); } archRim(dw, dh + 0.18, dw * 0.5, 'horse', 0.0, sp.rimCol ?? MC.cream, TX.gebs, sp.zellige); }
    if (sp.lamp) wallLantern(dw / 2 + 0.4, dh + 0.05, 0, true);
    if (sp.plate) W.box(0.14, 0.1, 0.01, -dw / 2 - 0.3, 1.9, 0.005, mpick([0x2a5aa0, 0x2a6a4a, 0xe8e0d0]), { lod: 2, ao: false });
  }), 'mid');
  W.pop();
}
// parapet for inaccessible roofs: four thin boxes (+ a few stepped merlons), no collision of its own
function lightParapet(w, d, y, h, col, style = 'plain', T = 0.22) {
  W.scope({ lod: 1 }, () => {
    W.box(w, h, T, 0, y + h / 2, d / 2 - T / 2, col, { t: TX.plaster, wear: 5 }); W.box(w, h, T, 0, y + h / 2, -d / 2 + T / 2, col, { t: TX.plaster, wear: 5 });
    W.box(T, h, d - 2 * T, w / 2 - T / 2, y + h / 2, 0, col, { t: TX.plaster, wear: 5 }); W.box(T, h, d - 2 * T, -w / 2 + T / 2, y + h / 2, 0, col, { t: TX.plaster, wear: 5 });
    if (style === 'merlon') { for (const [L, axX, c] of [[w, true, d / 2 - T / 2], [w, true, -d / 2 + T / 2], [d, false, w / 2 - T / 2], [d, false, -w / 2 + T / 2]]) { const n = Math.floor(L / 1.1); for (let i = 0; i < n; i++) { const u = -L / 2 + (i + 0.5) * L / n; if (axX) W.box(0.45, 0.5, T, u, y + h + 0.25, c, col, { t: TX.plaster }); else W.box(T, 0.5, 0.45, c, y + h + 0.25, u, col, { t: TX.plaster }); } } }
  });
}
// medina house / back mass as one solid block with a lived-in facade
function medinaShell(lot, o = {}) {
  const { w, d } = lot, H = o.H ?? lot.H ?? mpick([6.4, 6.8, 7.2, 9.6, 10]), col = o.col ?? mpick([MC.ochre, MC.rose, MC.plaster, MC.ochreDk, MC.roseDk, MC.cream, MC.terracotta]);
  const open = lot.open ?? { s: true };
  inLot(lot, () => {
    W.box(w, H, d, 0, H / 2, 0, col, { t: o.tx ?? TX.plaster, wear: o.wear ?? Math.floor(mr(2, 7)) });
    W.solid(w, H, d, 0, H / 2, 0, 'plaster');
    // plinth on street faces
    for (const side of STREET_SIDE) if (open[side]) {
      if (side === 's' || side === 'n') W.box(w + 0.04, 0.5, 0.04, 0, 0.25, (side === 's' ? 1 : -1) * (d / 2 + 0.02), shade(col, 0.78), { t: TX.plaster, wear: 7, lod: 1 });
      else W.box(0.04, 0.5, d + 0.04, (side === 'e' ? 1 : -1) * (w / 2 + 0.02), 0.25, 0, shade(col, 0.78), { t: TX.plaster, wear: 7, lod: 1 });
    }
    // roof: slab finish + parapet
    W.box(w - 0.3, 0.04, d - 0.3, 0, H + 0.02, 0, MC.roofGravel, { t: mchance(0.5) ? TX.gravel : TX.concrete, wear: 5, lod: 1 });
    const pst = o.parapet ?? (mchance(0.2) ? 'merlon' : 'plain');
    if (pst !== 'none') lightParapet(w, d, H, mr(0.6, 1.0), col, pst);
    // facade: a door on the front, few small grilled windows (privacy), mashrabiya on some upper floors
    const fl = Math.max(1, Math.floor(H / 3.1));
    for (const side of STREET_SIDE) {
      if (!open[side]) continue;
      const L = side === 's' || side === 'n' ? w : d;
      if (side === 's' || (mchance(0.3) && L > 4)) {
        const style = o.door ?? mpick(['carved', 'carved', 'plank', 'metal', 'metal']);
        const at = mr(-L / 2 + 1.2, L / 2 - 1.2);
        faceDoor(side, w, d, at, 0, style === 'carved' ? 1.3 : 1.0, style === 'carved' ? 2.4 : 2.1, style, { hood: mchance(0.25), arch: style === 'carved' && mchance(0.5), lamp: mchance(0.3), plate: mchance(0.6), zellige: mchance(0.3) ? Math.floor(mr(0, 8)) : undefined, frame: mchance(0.4) ? MC.blue : undefined });
        if (mchance(0.35)) W.scope({ lod: 1 }, () => { W.push(0, 0, 0, side === 's' ? 0 : side === 'n' ? Math.PI : side === 'e' ? Math.PI / 2 : -Math.PI / 2); meterBox(at + 0.9, 1.6, side === 's' || side === 'n' ? d / 2 : w / 2, 0); W.pop(); });
      }
      for (let f = 0; f < fl; f++) {
        const n = Math.max(0, Math.floor(L / 4.5) - (f === 0 ? 1 : 0));
        for (let i = 0; i < n; i++) {
          if (mchance(0.35)) continue;
          const at = -L / 2 + (i + 0.5) * L / n + mr(-0.4, 0.4), y = f * 3.1 + (f === 0 ? 1.7 : 1.0);
          const style = f === 0 ? 'grille' : mpick(['grille', 'shut', 'shut', 'mash', 'curtain']);
          faceWindow(side, w, d, at, y, f === 0 ? 0.6 : mr(0.7, 1.1), f === 0 ? 0.6 : mr(0.9, 1.3), style, { ac: f > 0 ? 0.15 : 0, frame: mchance(0.3) ? MC.blue : undefined });
        }
      }
    }
    if (o.clutter !== false) roofClutter(-w / 2 + 0.3, -d / 2 + 0.3, w / 2 - 0.3, d / 2 - 0.3, H, { tank: 0.4, laundry: 0.3, cheap: true });
  });
}

// ---------------- RIAD: enterable courtyard house (2 floors + roof terrace) ----------------
function riad(lot, o = {}) {
  const { w, d } = lot, T = 0.4, H0 = 3.6, H1 = 3.2, y1 = G0 + H0, yR = y1 + H1;
  const col = o.col ?? mpick([MC.ochre, MC.rose, MC.plaster, MC.ochreDk, MC.cream]);
  const r = clamp((Math.min(w, d) - 4.2) / 2, 3.0, 3.8);
  const cx0 = -w / 2 + r, cx1 = w / 2 - r, cz0 = -d / 2 + r, cz1 = d / 2 - r;
  const zel = Math.floor(mr(0, 8)), courtCol = o.court ?? mpick([MC.whitewash, MC.cream, 0xe8d8b8, 0xd8e4e8]);
  const open = lot.open ?? { s: true };
  inLot(lot, () => {
    // --- ground floor plan ---
    const fz = d / 2;
    // the vestibule overlaps the courtyard span so its inner (bent) door always opens onto the courtyard
    const vestW = 2.2, vx0 = clamp(mr(cx0 - 0.8, cx1 - vestW + 0.8), -w / 2 + 0.3, w / 2 - vestW - 0.3);
    const stairLen = Math.min(6.6, w - 4), sx0 = mchance(0.5) ? -w / 2 : w / 2 - stairLen;
    const g = [];
    const front = [mkRoom([-w / 2, cz1, vx0, fz], G0, H0, 'storage'), mkRoom([vx0, cz1, vx0 + vestW, fz], G0, H0, 'hall', { paint: courtCol }), mkRoom([vx0 + vestW, cz1, w / 2, fz], G0, H0, 'bedroom')].filter((q) => q.x1 - q.x0 > 1.2);
    for (const q of front) if (q.type !== 'hall') q.type = q.x1 - q.x0 > 3 ? 'salon' : 'storage';
    g.push(...front);
    const left = mkRoom([-w / 2, cz0, cx0, cz1], G0, H0, 'salon');
    const rightSplit = (cz0 + cz1) / 2;
    const rk = mkRoom([cx1, rightSplit, w / 2, cz1], G0, H0, 'kitchen'), rb = mkRoom([cx1, cz0, w / 2, rightSplit], G0, H0, 'bath');
    const back = sx0 < 0 ? [mkRoom([-w / 2, -d / 2, -w / 2 + stairLen, cz0], G0, H0, 'stairhall', { noWin: true }), mkRoom([-w / 2 + stairLen, -d / 2, w / 2, cz0], G0, H0, 'bedroom')] : [mkRoom([-w / 2, -d / 2, w / 2 - stairLen, cz0], G0, H0, 'bedroom'), mkRoom([w / 2 - stairLen, -d / 2, w / 2, cz0], G0, H0, 'stairhall', { noWin: true })];
    const court = mkRoom([cx0, cz0, cx1, cz1], G0, H0, 'courtyard', { paint: courtCol, dim: 1, wallTx: TX.plaster, noWin: true });
    g.push(left, rk, rb, ...back, court);
    for (const q of g) if (q.type !== 'courtyard' && q.type !== 'hall') q.paint = mpick([MC.whitewash, 0xe8e0cc, 0xd8e4e0, 0xe8d8c8]);
    // interior doors: every ring room opens onto the courtyard (salon through a wide arch)
    const doors = [];
    const vestOut = vx0 + 0.6, vestIn = clamp(vx0 + vestW - 0.6, Math.max(cx0 + 0.6, vx0 + 0.5), Math.min(cx1 - 0.6, vx0 + vestW - 0.5));
    doors.push({ ax: 'x', c: cz1, at: vestIn, w: 0.9, arch: 'horse', h: 2.5 });
    for (const q of front) if (q.type !== 'hall') { const a0 = Math.max(q.x0, cx0) + 0.5, a1 = Math.min(q.x1, cx1) - 0.5; if (a1 > a0) doors.push({ ax: 'x', c: cz1, at: (a0 + a1) / 2, w: 0.9, style: 'carved' }); else doors.push({ ax: 'z', c: q.x0 === -w / 2 ? vx0 : vx0 + vestW, at: (cz1 + fz) / 2, w: 0.85 }); }
    doors.push({ ax: 'z', c: cx0, at: (cz0 + cz1) / 2, w: 1.7, arch: 'horse', h: 2.9 });
    doors.push({ ax: 'z', c: cx1, at: (rightSplit + cz1) / 2, w: 0.9, style: 'carved' });
    doors.push({ ax: 'z', c: cx1, at: (cz0 + rightSplit) / 2, w: 0.8 });
    for (const q of back) { const a0 = Math.max(q.x0, cx0) + 0.5, a1 = Math.min(q.x1, cx1) - 0.5; if (a1 > a0 + 0.2) doors.push({ ax: 'x', c: cz0, at: q.type === 'stairhall' ? (sx0 < 0 ? a0 + 0.1 : a1 - 0.1) : (a0 + a1) / 2, w: 0.9, style: 'carved' }); }
    // stair: straight flight along the back wall inside the stair hall (ground → upper → roof, stacked)
    const sdir = sx0 < 0 ? 1 : -1, sxs = sx0 < 0 ? -w / 2 + T + 0.2 : w / 2 - T - 0.2, sz = -d / 2 + T + 0.55;
    // exterior openings
    const ops = { s: [{ at: vestOut, w: 1.3, h: 2.6, kind: 'archdoor', arch: 'horse', style: 'carved', leaf: o.locked ? 'closed' : 'open', hood: mchance(0.5), lamp: true, zellige: zel }], n: [], e: [], w: [] };
    if (lot.open?.n && o.backDoor !== false) { const bq = back.find((q) => q.type === 'bedroom'); if (bq && bq.x1 - bq.x0 > 2) ops.n.push({ at: (bq.x0 + bq.x1) / 2, w: 0.95, h: 2.1, kind: 'door', style: 'metal', leaf: 'ajar' }); }
    for (const q of g) if (q.type !== 'courtyard' && q.type !== 'hall') for (const side of ['s', 'e', 'w']) if (open[side] && q.type !== 'stairhall') { const on = (side === 's' && Math.abs(q.z1 - fz) < 0.05) || (side === 'e' && Math.abs(q.x1 - w / 2) < 0.05) || (side === 'w' && Math.abs(q.x0 + w / 2) < 0.05); if (on) { const a0 = side === 's' ? q.x0 : q.z0, a1 = side === 's' ? q.x1 : q.z1; if (a1 - a0 > 2 && !ops[side].some((p) => p.at > a0 && p.at < a1)) { ops[side].push({ at: (a0 + a1) / 2, w: 0.6, h: 0.7, sill: 1.9, kind: 'win', win: 'grille' }); q.wins.push({ side, at: (a0 + a1) / 2, w: 0.6 }); } } }
    for (const q of g) { q.extN = Math.abs(q.z0 + d / 2) < 0.05; q.extS = Math.abs(q.z1 - d / 2) < 0.05; q.extW = Math.abs(q.x0 + w / 2) < 0.05; q.extE = Math.abs(q.x1 - w / 2) < 0.05; q.extIn = T; }
    for (const q of g) q.doors.push(...(ops.s.filter((p) => q.extS && p.at > q.x0 && p.at < q.x1).map((p) => ({ side: 's', at: p.at, w: p.w }))));
    for (const p of ops.s) markDoor(p.at, d / 2 + 1.2, p.w); for (const p of ops.n) markDoor(p.at, -d / 2 - 1.2, p.w);
    linkDoors(g, doors);
    // build: floor, exterior, partitions
    slab(-w / 2 + T, -d / 2 + T, w / 2 - T, d / 2 - T, G0, { top: MC.floorTerr, topTx: TX.terrazzo, thk: G0 + 0.05, bot: false, dimTop: DIM_IN });
    W.box(cx1 - cx0, 0.02, cz1 - cz0, (cx0 + cx1) / 2, G0 + 0.01, (cz0 + cz1) / 2, 0xffffff, { t: TX.zellige, wear: zel, ao: false });
    for (const q of g) if (q.type === 'salon' || q.type === 'hall') W.box(q.x1 - q.x0 - 0.2, 0.012, q.z1 - q.z0 - 0.2, (q.x0 + q.x1) / 2, G0 + 0.006, (q.z0 + q.z1) / 2, 0xffffff, { t: TX.zellige, wear: (zel + 3) & 7, ao: false, dim: DIM_IN });
    extWalls(w, d, T, G0, H0, g, { col, ops, plinth: 0.55, wear: o.wear ?? 4 });
    partitions(g, doors, G0, H0);
    // zellige dado around the courtyard + carved plaster frieze
    W.scope({ lod: 1 }, () => {
      for (const [x0_, z0_, x1_, z1_] of [[cx0, cz1 - 0.08, cx1, cz1 - 0.06], [cx0, cz0 + 0.06, cx1, cz0 + 0.08], [cx0 + 0.06, cz0, cx0 + 0.08, cz1], [cx1 - 0.08, cz0, cx1 - 0.06, cz1]]) {
        W.box(Math.max(0.02, x1_ - x0_), 1.1, Math.max(0.02, z1_ - z0_), (x0_ + x1_) / 2, G0 + 0.55, (z0_ + z1_) / 2, 0xffffff, { t: TX.zellige, wear: zel });
        W.box(Math.max(0.02, x1_ - x0_), 0.35, Math.max(0.02, z1_ - z0_), (x0_ + x1_) / 2, G0 + H0 - 0.45, (z0_ + z1_) / 2, 0xf0e8d8, { t: TX.gebs });
      }
    });
    // courtyard: fountain or orange trees, plants, arcade columns carrying the upper gallery
    const ccx = (cx0 + cx1) / 2, ccz = (cz0 + cz1) / 2, gal = 1.25;
    const clearCol = (x, z) => !doors.some((dd) => dd.ax === 'x' ? (Math.abs(dd.c - cz0) < 0.05 || Math.abs(dd.c - cz1) < 0.05) && Math.abs(x - dd.at) < dd.w / 2 + 0.75 && Math.abs(z - dd.c) < 2 : (Math.abs(dd.c - cx0) < 0.05 || Math.abs(dd.c - cx1) < 0.05) && Math.abs(z - dd.at) < dd.w / 2 + 0.75 && Math.abs(x - dd.c) < 2);
    W.scope({ lod: 1 }, () => {
      if (mchance(0.6)) fountain(ccx, G0, ccz, Math.min(1.2, (cx1 - cx0) / 4), zel); else { tree(ccx - 0.8, G0, ccz, 'orange', 0.6); tree(ccx + 0.8, G0, ccz + 0.3, 'orange', 0.55); }
      for (const [px, pz] of [[cx0 + gal, cz0 + gal], [cx1 - gal, cz0 + gal], [cx0 + gal, cz1 - gal], [cx1 - gal, cz1 - gal]]) { if (!clearCol(px, pz)) continue; W.box(0.32, H0, 0.32, px, G0 + H0 / 2, pz, 0xffffff, { t: TX.zellige, wear: zel }); W.box(0.32, H0 - 1.2, 0.33, px, G0 + 1.2 + (H0 - 1.2) / 2, pz, courtCol, { t: TX.tadelakt }); W.box(0.5, 0.25, 0.5, px, G0 + H0 - 0.12, pz, MC.cedar, { t: TX.carved }); W.solid(0.32, H0, 0.32, px, G0 + H0 / 2, pz, 'plaster'); }
    });
    // courtyard dressing keeps every doorway onto the courtyard clear (1.3 m)
    const cdoors = doors.filter((dd) => (dd.ax === 'x' && (Math.abs(dd.c - cz0) < 0.05 || Math.abs(dd.c - cz1) < 0.05)) || (dd.ax === 'z' && (Math.abs(dd.c - cx0) < 0.05 || Math.abs(dd.c - cx1) < 0.05)));
    const clear = (x, z, r = 1.3) => !cdoors.some((dd) => dd.ax === 'x' ? Math.abs(x - dd.at) < r + dd.w / 2 && Math.abs(z - dd.c) < r + 0.6 : Math.abs(z - dd.at) < r + dd.w / 2 && Math.abs(x - dd.c) < r + 0.6);
    W.scope({ lod: 2 }, () => { for (const [px, pz] of [[cx0 + 0.5, cz0 + 0.5], [cx1 - 0.5, cz0 + 0.5], [cx0 + 0.5, ccz], [cx1 - 0.5, ccz]]) if (clear(px, pz)) plantPot(px, G0, pz, mpick(['palm', 'aloe', 'geranium', 'ficus'])); if (mchance(0.5) && clear(ccx, cz0 + 0.8, 1.6)) { sedari(ccx, G0, cz0 + 0.5, 0, Math.min(2.4, cx1 - cx0 - 2.8), mpick(FABRIC)); } if (mchance(0.5)) { for (let i = 0; i < 3; i++) birdcage(cx0 + 0.4, G0 + 1.6 + i * 0.01, ccz + i * 0.5); } });
    for (const q of g) if (q.type !== 'courtyard') furnish(q);
    // stair flights (stacked straight runs) + stair-hall light
    const run1 = Math.min(ST_RUN, (stairLen - T - 1.3) / Math.round((y1 - G0) / ST_RISE)), run2 = Math.min(ST_RUN, (stairLen - T - 1.3) / Math.round((yR - y1) / ST_RISE));
    const f1 = flight(sxs, sz, [sdir, 0], 1.0, G0, y1, { col: MC.stone, tx: TX.terrazzo, riser: zel, run: run1 });
    const f2 = flight(sxs, sz, [sdir, 0], 1.0, y1, yR, { col: MC.stone, tx: TX.terrazzo, riser: zel, run: run2 });
    const sHole = [Math.min(sxs, sxs + sdir * f1.len) - 0.05, sz - 0.55, Math.max(sxs, sxs + sdir * f1.len) + 0.05, sz + 0.55];
    const rHole = [Math.min(sxs, sxs + sdir * f2.len) - 0.05, sz - 0.55, Math.max(sxs, sxs + sdir * f2.len) + 0.05, sz + 0.55];
    // --- upper floor: rooms around a gallery that looks down into the courtyard ---
    const up = [];
    up.push(mkRoom([-w / 2, cz1, w / 2 * 0 + (cx0 + cx1) / 2, fz], y1, H1, 'bedroom'), mkRoom([(cx0 + cx1) / 2, cz1, w / 2, fz], y1, H1, mpick(['bedroom', 'living'])));
    up.push(mkRoom([-w / 2, cz0, cx0, cz1], y1, H1, 'bedroom'), mkRoom([cx1, cz0, w / 2, cz1], y1, H1, mpick(['bedroom', 'storage', 'living'])));
    up.push(...(sx0 < 0 ? [mkRoom([-w / 2, -d / 2, -w / 2 + stairLen, cz0], y1, H1, 'stairhall', { noWin: true }), mkRoom([-w / 2 + stairLen, -d / 2, w / 2, cz0], y1, H1, 'bath')] : [mkRoom([-w / 2, -d / 2, w / 2 - stairLen, cz0], y1, H1, 'bath'), mkRoom([w / 2 - stairLen, -d / 2, w / 2, cz0], y1, H1, 'stairhall', { noWin: true })]));
    const voidR = mkRoom([cx0, cz0, cx1, cz1], y1, H1, 'courtyard', { paint: courtCol, dim: 1, noWin: true });
    up.push(voidR);
    for (const q of up) if (q.type !== 'courtyard') q.paint = mpick([MC.whitewash, 0xe8e0cc, 0xd8e4e0, 0xe8d8c8, 0xe0d0e0]);
    for (const q of up) { q.extN = Math.abs(q.z0 + d / 2) < 0.05; q.extS = Math.abs(q.z1 - d / 2) < 0.05; q.extW = Math.abs(q.x0 + w / 2) < 0.05; q.extE = Math.abs(q.x1 - w / 2) < 0.05; q.extIn = T; }
    const udoors = [];
    for (const q of up) {
      if (q.type === 'courtyard') continue;
      if (Math.abs(q.z0 - cz1) < 0.05) { const a0 = Math.max(q.x0, cx0) + gal + 0.3, a1 = Math.min(q.x1, cx1) - gal - 0.3; udoors.push({ ax: 'x', c: cz1, at: a1 > a0 ? (a0 + a1) / 2 : clamp((q.x0 + q.x1) / 2, cx0 + 0.6, cx1 - 0.6), w: 0.9, style: 'carved' }); }
      if (Math.abs(q.x1 - cx0) < 0.05 && q.z0 >= cz0 - 0.05 && q.z1 <= cz1 + 0.05) udoors.push({ ax: 'z', c: cx0, at: (cz0 + cz1) / 2, w: 0.9, style: 'carved' });
      if (Math.abs(q.x0 - cx1) < 0.05 && q.z0 >= cz0 - 0.05 && q.z1 <= cz1 + 0.05) udoors.push({ ax: 'z', c: cx1, at: (cz0 + cz1) / 2, w: 0.9, style: 'carved' });
      if (Math.abs(q.z1 - cz0) < 0.05) { const a0 = Math.max(q.x0, cx0) + 0.5, a1 = Math.min(q.x1, cx1) - 0.5; if (a1 > a0) udoors.push({ ax: 'x', c: cz0, at: q.type === 'stairhall' ? (sx0 < 0 ? a0 + 0.1 : a1 - 0.1) : clamp((a0 + a1) / 2, cx0 + gal + 0.5, cx1 - gal - 0.5), w: 0.9, style: 'carved' }); }
    }
    // the two front rooms also connect to each other
    udoors.push({ ax: 'z', c: (cx0 + cx1) / 2, at: (cz1 + fz) / 2, w: 0.9 });
    linkDoors(up, udoors);
    const uops = roomWindows(up.filter((q) => q.type !== 'stairhall' && q.type !== 'courtyard'), w, d, { win: mpick(['mash', 'grille', 'shut']), winW: 0.9, winH: 1.1, sill: 1.1, open, arched: mchance(0.4) });
    slab(-w / 2 + T, -d / 2 + T, w / 2 - T, d / 2 - T, y1, { holes: [[cx0 + gal, cz0 + gal, cx1 - gal, cz1 - gal], sHole], top: MC.floorTerr, topTx: TX.ceramic, topWear: mpick([0, 4]), bot: MC.cedar, botTx: TX.wood, dimTop: DIM_IN, dimBot: 0.7 });
    extWalls(w, d, T, y1, H1, up, { col, ops: uops, wear: o.wear ?? 4 });
    partitions(up, udoors, y1, H1);
    // gallery balustrade (turned cedar) + carved beam under the gallery edge
    W.scope({ lod: 1 }, () => {
      const gx0 = cx0 + gal, gx1 = cx1 - gal, gz0 = cz0 + gal, gz1 = cz1 - gal;
      railing(gx0, gz1, gx1, gz1, y1, 'mash'); railing(gx0, gz0, gx1, gz0, y1, 'mash'); railing(gx0, gz0, gx0, gz1, y1, 'mash'); railing(gx1, gz0, gx1, gz1, y1, 'mash');
      for (const [a, b, c, e] of [[gx0, gz1, gx1, gz1], [gx0, gz0, gx1, gz0]]) W.box(c - a + 0.3, 0.3, 0.2, (a + c) / 2, y1 - 0.3, b, MC.cedar, { t: TX.carved });
      for (const [a, b, c, e] of [[gx0, gz0, gx0, gz1], [gx1, gz0, gx1, gz1]]) W.box(0.2, 0.3, e - b + 0.3, a, y1 - 0.3, (b + e) / 2, MC.cedar, { t: TX.carved });
    });
    for (const q of up) if (q.type !== 'courtyard') furnish(q);
    // --- roof terrace ---
    slab(-w / 2, -d / 2, w / 2, d / 2, yR, { holes: [[cx0, cz0, cx1, cz1], rHole], top: MC.roofGravel, topTx: TX.ceramic, topWear: 2, bot: MC.cedar, botTx: TX.wood, thk: 0.3, dimBot: 0.7 });
    parapet(-w / 2, -d / 2, w / 2, d / 2, yR, { h: 1.1, T: 0.3, col, style: mchance(0.5) ? 'merlon' : 'plain', gaps: o.roofGaps });
    // low wall + grille round the courtyard light-well, and a rail round the stair opening
    W.scope({ lod: 1 }, () => { railing(cx0, cz0, cx1, cz0, yR, 'concrete', courtCol); railing(cx0, cz1, cx1, cz1, yR, 'concrete', courtCol); railing(cx0, cz0, cx0, cz1, yR, 'concrete', courtCol); railing(cx1, cz0, cx1, cz1, yR, 'concrete', courtCol); });
    // guard rails: along the open side of each stair opening, leaving the top end free to step off
    const railTo = (h, yy, open0) => { const a = sdir > 0 ? h[0] + (open0 ? 1.2 : 0) : h[0] + 0.9, b = sdir > 0 ? h[2] - 0.9 : h[2] - (open0 ? 1.2 : 0); if (b > a) railing(a, h[3], b, h[3], yy, 'iron'); };
    railTo(rHole, yR, false); railTo(sHole, y1, true);
    railing(sdir > 0 ? rHole[0] : rHole[2], rHole[1], sdir > 0 ? rHole[0] : rHole[2], rHole[3], yR, 'iron');
    roofClutter(-w / 2 + 0.4, -d / 2 + 0.4, w / 2 - 0.4, d / 2 - 0.4, yR, { avoid: [[cx0, cz0, cx1, cz1], [rHole[0] - 1, rHole[1], rHole[2] + 1.5, rHole[3] + 1]], life: 0.8, laundry: 0.7 });
    W.lamp(sxs + sdir * 2.5, y1 + 2.4, sz, 0xffd8a0, 2.5, 7, { halo: 0 });
    cornices(w, d, [yR + 1.15], shade(col, 1.05), Object.keys(open).filter((k) => open[k]).join(''));
    // waypoints for automated walk-through tests (street → vestibule → courtyard → stairs → upper floor → roof)
    const sq = sx0 < 0 ? [-w / 2, -w / 2 + stairLen] : [w / 2 - stairLen, w / 2], sdx = sx0 < 0 ? Math.max(sq[0], cx0) + 0.6 : Math.min(sq[1], cx1) - 0.6;
    const P = (x, y, z) => { const v = W.worldPos(x, y, z); return [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)]; };
    MAP.poi.push({ kind: 'riad', path: [P(vestOut, 0, d / 2 + 1.6), P(vestOut, G0, d / 2 - T - 0.7), P(vestIn, G0, d / 2 - T - 0.7), P(vestIn, G0, cz1 - 0.55), P(sdx, G0, cz1 - 0.55), P(sdx, G0, cz0 + 0.9), P(sdx, G0, cz0 - 0.9), P(sxs + sdir * 0.4, G0, sz + 1.2), P(sxs + sdir * 0.4, G0, sz), P(sxs + sdir * (f1.len + 0.5), y1, sz), P(sxs + sdir * (f1.len + 0.5), y1, sz + 1.2), P(sxs + sdir * 0.5, y1, sz + 1.2), P(sxs + sdir * 0.5, y1, sz), P(sxs + sdir * (f2.len + 0.5), yR, sz), P(sxs + sdir * (f2.len + 1.3), yR, sz + 1.5)] });
  });
}

// ---------------- APARTMENT BLOCK (3–5 floors) ----------------
function apartment(lot, o = {}) {
  const { w, d } = lot, T = 0.3, nF = o.floors ?? lot.floors ?? 4, H0 = o.shops ? 3.6 : FH;
  const col = o.col ?? mpick([MC.plaster, MC.ochre, MC.cream, MC.rose, 0xe0d4c0, 0xd8c8a8, MC.whitewash]);
  const open = lot.open ?? { s: true };
  const enter = o.enter ?? false;
  if (!enter) return aptShell(lot, { ...o, col, floors: nF, H0 });
  inLot(lot, () => {
    const sw = 2.6, sd = 5.6, sx0 = -sw / 2, zf = d / 2 - T, zb = d / 2 - T - sd;
    const ys = [G0]; for (let f = 1; f <= nF; f++) ys.push(ys[f - 1] + (f === 1 ? H0 : FH));
    const winStyle = o.win ?? mpick(['shut', 'glass', 'grille']), shutCol = mpick([MC.green, MC.blue, 0x6a4a2a, 0x2a5a6a, 0x8a6a4a]);
    for (let f = 0; f < nF; f++) {
      const y = ys[f], H = ys[f + 1] - y;
      const rooms = [];
      const core = mkRoom([sx0, zb, sx0 + sw, d / 2], y, H, 'stairhall', { paint: 0xd8d0c0, noWin: true, light: true });
      const strip = mkRoom([sx0, -d / 2, sx0 + sw, zb], y, H, mpick(['kitchen', 'bath']));
      rooms.push(core, strip);
      const doors = [];
      const entryZ = zf - 0.75;
      for (const s of [-1, 1]) {
        const ux0 = s < 0 ? -w / 2 : sx0 + sw, ux1 = s < 0 ? sx0 : w / 2;
        const shop = o.shops && f === 0;
        if (shop) {
          const split = lerp(-d / 2, d / 2, mr(0.32, 0.42));
          const front = mkRoom([ux0, split, ux1, d / 2], y, H, 'shop', { front: 1, trade: mpick(['grocery', 'hardware', 'books', 'fabric', 'pottery', 'grocery']), paint: mpick(MC.paint) });
          const backR = mkRoom([ux0, -d / 2, ux1, split], y, H, 'storage');
          rooms.push(front, backR);
          doors.push({ ax: 'x', c: split, at: s < 0 ? ux1 - 0.8 : ux0 + 0.8, w: 0.9 });
          if (s < 0) doors.push({ ax: 'z', c: sx0, at: (-d / 2 + zb) / 2, w: 0.85 }); // storage ↔ strip
        } else {
          const plan = bspPlan(ux0, -d / 2, ux1, d / 2, { minW: 2.5, maxA: 13, doors: [{ ax: 'z', c: s < 0 ? sx0 : sx0 + sw, at: entryZ, w: 0.95 }] });
          const unit = plan.rooms.map((q) => mkRoom(q, y, H, 'bedroom'));
          // types: the room behind the entry door is the living room, smallest is the bath, next the kitchen
          const entry = unit.find((q) => entryZ > q.z0 && entryZ < q.z1 && (s < 0 ? Math.abs(q.x1 - sx0) < 0.05 : Math.abs(q.x0 - sx0 - sw) < 0.05));
          const sorted = [...unit].sort((a, b) => (a.x1 - a.x0) * (a.z1 - a.z0) - (b.x1 - b.x0) * (b.z1 - b.z0));
          if (entry) entry.type = mchance(0.5) ? 'salon' : 'living';
          const rest = sorted.filter((q) => q !== entry);
          if (rest[0]) rest[0].type = 'bath'; if (rest[1]) rest[1].type = 'kitchen';
          if (unit.length === 1) unit[0].type = 'living';
          rooms.push(...unit); doors.push(...plan.doors);
          doors.push({ ax: 'z', c: s < 0 ? sx0 : sx0 + sw, at: entryZ, w: 0.95, style: 'metal', leaf: mpick(['open', 'ajar']) });
          if (s < 0) { const adj = unit.find((q) => Math.abs(q.x1 - sx0) < 0.05 && q.z0 < zb - 0.8 && q.z1 > -d / 2 + 0.8); if (adj) doors.push({ ax: 'z', c: sx0, at: clamp((Math.max(adj.z0, -d / 2) + Math.min(adj.z1, zb)) / 2, -d / 2 + 0.7, zb - 0.7), w: 0.85 }); }
        }
      }
      for (const q of rooms) { q.floor = f; q.extN = Math.abs(q.z0 + d / 2) < 0.05; q.extS = Math.abs(q.z1 - d / 2) < 0.05; q.extW = Math.abs(q.x0 + w / 2) < 0.05; q.extE = Math.abs(q.x1 - w / 2) < 0.05; q.extIn = T; q.style = 'modern'; }
      const ops = { s: [], n: [], e: [], w: [] };
      if (f === 0) {
        ops.s.push({ at: 0, w: 1.2, h: 2.3, kind: 'door', style: mpick(['metal', 'glass']), leaf: 'open', lamp: true });
        if (o.shops) for (const q of rooms.filter((r) => r.type === 'shop')) { const at = (q.x0 + q.x1) / 2, sw2 = Math.min(3.2, q.x1 - q.x0 - 1.0); ops.s.push({ at, w: sw2, h: 2.7, kind: 'shop', style: mchance(0.5) ? 'glass' : 'roll', leaf: 'open', awning: mchance(0.6) ? mpick([[0xb03a2e, 0xe8dcc0], [0x2a5a8a, 0xe8dcc0], [0x3a6a4a, 0x3a6a4a]]) : null }); q.doors.push({ side: 's', at, w: sw2 }); }
        if (open.n) { const bq = rooms.find((q) => q.extN && q.type !== 'stairhall' && q.x1 - q.x0 > 1.8); if (bq) ops.n.push({ at: (bq.x0 + bq.x1) / 2, w: 0.95, h: 2.1, kind: 'door', style: 'metal', leaf: 'ajar' }); }
      }
      roomWindows(rooms.filter((q) => q.type !== 'shop' && q.type !== 'stairhall'), w, d, { win: winStyle, shutCol, open, balcony: o.balcony ?? 0.6, flowerBox: 0.15 }, ops);
      // stair-hall window above the entrance on upper floors
      if (f > 0) ops.s.push({ at: 0, w: 0.8, h: 1.2, sill: 1.0, kind: 'win', win: 'grille' });
      for (const q of rooms) q.doors.push(...(ops.s.filter((p) => q.extS && p.at > q.x0 && p.at < q.x1 && (p.kind === 'door')).map((p) => ({ side: 's', at: p.at, w: p.w }))));
      if (f === 0) { for (const p of ops.s) if (p.kind === 'door' || p.kind === 'shop') markDoor(p.at, d / 2 + 1.2, p.w); for (const p of ops.n) markDoor(p.at, -d / 2 - 1.2, p.w); }
      linkDoors(rooms, doors);
      const hole = f > 0 ? [[sx0, zb, sx0 + sw, zf - 1.2]] : [];
      slab(-w / 2 + T, -d / 2 + T, w / 2 - T, d / 2 - T, y, { holes: hole, top: f === 0 && o.shops ? 0xc8c0b0 : mpick([MC.floorTerr, 0xc8b8a0, 0xd8d0c0]), topTx: mpick([TX.terrazzo, TX.ceramic, TX.ceramic]), topWear: mpick([0, 4, 5]), thk: f === 0 ? G0 + 0.05 : 0.25, bot: f === 0 ? false : MC.ceiling, dimTop: DIM_IN, dimBot: DIM_IN });
      extWalls(w, d, T, y, H, rooms, { col, ops, plinth: f === 0 ? 0.6 : 0, wear: o.wear ?? 3 });
      partitions(rooms, doors, y, H);
      opsWithBalconies(ops, w, d, y, mpick(['iron', 'iron', 'concrete']));
      const top = ys[f + 1];
      uStair(sx0, zf, zb, sw, y, top, { col: 0xb8b0a0, tx: TX.terrazzo, wallCol: 0xd8d0c0 });
      W.scope({ lod: 2, dim: DIM_IN }, () => { if (f === 0) { W.push(sx0 + 0.15, y + 1.2, zf - 0.3, Math.PI / 2); for (let i = 0; i < 4; i++) W.box(0.25, 0.3, 0.12, 0, 0, -0.3 * i, mpick([0x8a8e92, 0x5a6a7a]), { layer: 'metal' }); W.pop(); if (mchance(0.6)) bicycle(sx0 + sw - 0.3, y, zb + 1.5, Math.PI / 2); } meterBox(sx0 + sw - 0.02, y + 1.6, zf - 0.6, -Math.PI / 2); });
      for (const q of rooms) if (q.type !== 'stairhall') furnish(q); else roomLight(q, 'bare');
    }
    // roof
    const yR = ys[nF];
    slab(-w / 2, -d / 2, w / 2, d / 2, yR, { holes: [[sx0, zb, sx0 + sw, zf - 1.2]], top: MC.roofGravel, topTx: TX.gravel, bot: MC.ceiling, thk: 0.3, dimBot: DIM_IN });
    stairHouse(sx0 - 0.2, zb - 0.2, sx0 + sw + 0.2, zf + 0.1, yR, 'w', { col, at: zf - 0.6 });
    parapet(-w / 2, -d / 2, w / 2, d / 2, yR, { h: 1.05, T: 0.25, col, style: 'plain' });
    roofClutter(-w / 2 + 0.4, -d / 2 + 0.4, w / 2 - 0.4, d / 2 - 0.4, yR, { avoid: [[sx0 - 0.4, zb - 0.4, sx0 + sw + 0.4, zf + 0.4]], tank: 0.95, laundry: 0.7, life: 0.4 });
    cornices(w, d, ys.slice(1, nF).map((y) => y - 0.1).concat([yR + 1.12]), shade(col, 1.06), Object.keys(open).filter((k) => open[k]).join('') || 's');
    // street-front utility details
    W.scope({ lod: 1 }, () => { for (let f = 1; f < nF; f++) if (mchance(0.6)) acWall(mr(-w / 2 + 1, w / 2 - 1), ys[f] + 2.4, d / 2, 0); hostedCables(-w / 2, ys[1] - 0.3, d / 2 + 0.05, w / 2, ys[1] - 0.2, d / 2 + 0.05, 2); });
    // walk-through waypoints: street → stair landing → every flight → roof door
    const P = (x, y, z) => { const v = W.worldPos(x, y, z); return [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)]; };
    const fw = (sw - 0.12) / 2, path = [P(0, 0, d / 2 + 1.6), P(0, G0, zf - 0.6)];
    for (let f = 0; f < nF; f++) {
      const y = ys[f], top = ys[f + 1], half = (top - y) / 2, n = Math.round(half / ST_RISE), run = Math.min(ST_RUN, (Math.abs(zb - zf) - 1.2 - 1.1) / n), zs = zf - 1.2, zl0 = zs - n * run;
      path.push(P(sx0 + fw / 2, y, zs + 0.3), P(sx0 + fw / 2, y + half, zl0 - 0.45), P(sx0 + sw - fw / 2, y + half, zl0 - 0.45), P(sx0 + sw - fw / 2, top, zs + 0.3), P(sx0 + sw / 2, top, zf - 0.6));
    }
    path.push(P(sx0 - 1.4, ys[nF], zf - 0.6));
    MAP.poi.push({ kind: 'apartment', floors: nF, path });
  });
}
// apartment shell: same massing and facade rhythm, single solid mass
function aptShell(lot, o = {}) {
  const { w, d } = lot, nF = o.floors ?? 4, H0 = o.H0 ?? FH, H = H0 + (nF - 1) * FH, col = o.col ?? MC.plaster;
  const open = lot.open ?? { s: true };
  const winStyle = o.win ?? mpick(['shut', 'curtain', 'grille', 'shut']), shutCol = mpick([MC.green, MC.blue, 0x6a4a2a, 0x2a5a6a, 0x8a6a4a]);
  inLot(lot, () => {
    W.box(w, H + G0, d, 0, (H + G0) / 2, 0, col, { t: o.tx ?? TX.plaster, wear: o.wear ?? Math.floor(mr(1, 6)) });
    W.solid(w, H + G0, d, 0, (H + G0) / 2, 0, 'plaster');
    const yR = H + G0;
    W.box(w - 0.3, 0.04, d - 0.3, 0, yR + 0.02, 0, MC.roofGravel, { t: TX.gravel, lod: 1 });
    lightParapet(w, d, yR, 1.0, col, 'plain');
    for (const side of STREET_SIDE) {
      if (!open[side]) continue;
      const L = side === 's' || side === 'n' ? w : d, n = Math.max(1, Math.floor(L / 3.4));
      for (let f = 0; f < nF; f++) {
        const yb = G0 + (f === 0 ? 0 : H0 + (f - 1) * FH);
        if (f === 0 && side === 's') {
          faceDoor('s', w, d, 0, 0, 1.1, 2.3, 'metal', { lamp: mchance(0.5), plate: true });
          if (o.shops !== false) for (const s of [-1, 1]) if (L > 8) { W.push(s * L / 4 + s * 0.6, 0, d / 2, 0); const sw = Math.min(3.0, L / 2 - 2.2); W.box(sw, 2.6, 0.06, 0, 1.3, 0.03, mpick([MC.alu, 0x8a8e92, 0x5a6a5a]), { layer: 'metal', t: TX.corrugated, wear: 6 }); W.cyl(0.17, 0.17, sw, 0, 2.75, 0.12, MC.alu, { rz: Math.PI / 2, seg: 8, layer: 'metal', lod: 1 }); if (mchance(0.5)) shopSign(0, 3.2, 0.05, 0, sw, undefined, mpick(['none', 'cup', 'key', 'cross'])); W.pop(); }
          continue;
        }
        for (let i = 0; i < n; i++) {
          if (side === 's' && Math.abs(-L / 2 + (i + 0.5) * L / n) < 0.8 && f > 0) { faceWindow(side, w, d, 0, yb + 1.1, 0.7, 1.1, 'grille', {}); continue; }
          const at = -L / 2 + (i + 0.5) * L / n;
          faceWindow(side, w, d, at, yb + 0.95, 1.1, 1.4, f === 0 ? 'grille' : winStyle, { shutCol, ac: 0.12 });
          if (f > 0 && side === 's' && mchance(o.balcony ?? 0.3)) W.defer(() => W.scope({ lod: 1 }, () => { W.push(at, yb, d / 2, 0); W.box(1.8, 0.14, 0.9, 0, -0.07, 0.45, MC.concreteLt, { t: TX.terrazzo }); W.box(1.8, 1.0, 0.1, 0, 0.5, 0.86, col, { t: TX.plaster, wear: 3 }); for (const sx of [-1, 1]) W.box(0.1, 1.0, 0.86, sx * 0.85, 0.5, 0.43, col, { t: TX.plaster, wear: 3 }); W.box(1.9, 0.06, 0.18, 0, 1.03, 0.86, MC.stone, { t: TX.stone }); if (mchance(0.5)) laundryLine(-0.8, 1.5, 0.7, 0.8, 1.5, 0.7, 3); W.pop(); }), 'mid');
        }
      }
    }
    cornices(w, d, Array.from({ length: nF - 1 }, (_, f) => G0 + H0 + f * FH - 0.1), shade(col, 1.06), Object.keys(open).filter((k) => open[k]).join('') || 's');
    roofClutter(-w / 2 + 0.3, -d / 2 + 0.3, w / 2 - 0.3, d / 2 - 0.3, yR, { tank: 0.8, laundry: 0.4, cheap: true });
  });
}

// ---------------- SHOP-HOUSE (market / medina): enterable shop below, solid house above ----------------
function shopHouse(lot, o = {}) {
  const { w, d } = lot, T = 0.35, H0 = 3.4, up = o.up ?? mpick([1, 1, 2]), col = o.col ?? mpick([MC.ochre, MC.rose, MC.plaster, MC.cream, MC.ochreDk]);
  const trade = o.trade ?? mpick(['spice', 'pottery', 'lamps', 'leather', 'rugs', 'grocery', 'copper', 'fabric']);
  inLot(lot, () => {
    const split = d / 2 - Math.max(3.0, d * 0.62);
    const shop = mkRoom([-w / 2, split, w / 2, d / 2], G0, H0, 'shop', { front: 1, trade, paint: mpick([MC.whitewash, 0xe8dcc0, 0xd8c8a8]) });
    const store = mkRoom([-w / 2, -d / 2, w / 2, split], G0, H0, 'storage', { paint: 0xc8bca0 });
    const rooms = [shop, store];
    for (const q of rooms) { q.extN = Math.abs(q.z0 + d / 2) < 0.05; q.extS = Math.abs(q.z1 - d / 2) < 0.05; q.extW = true; q.extE = true; q.extIn = T; }
    const doors = [{ ax: 'x', c: split, at: mr(-w / 2 + 0.8, w / 2 - 0.8), w: 0.85, style: 'plank', leaf: 'open' }];
    const sw = Math.min(w - 1.0, 3.6);
    const ops = { s: [{ at: 0, w: sw, h: 2.75, kind: 'shop', style: 'roll', leaf: o.closed ? 'closed' : 'open', awning: mchance(0.55) ? mpick([[0xb03a2e, 0xe8dcc0], [0x2a5a8a, 0xe8dcc0], [0xc89a3a, 0xc89a3a], [0x3a6a4a, 0xe8dcc0]]) : null }], n: [], e: [], w: [] };
    shop.doors.push({ side: 's', at: 0, w: sw }); markDoor(0, d / 2 + 1.0, sw, 2.0);
    if (lot.open?.n) { ops.n.push({ at: 0, w: 0.9, h: 2.05, kind: 'door', style: 'metal', leaf: 'ajar' }); store.doors.push({ side: 'n', at: 0, w: 0.9 }); }
    linkDoors(rooms, doors);
    slab(-w / 2 + T, -d / 2 + T, w / 2 - T, d / 2 - T, G0, { top: mpick([MC.floorTerr, 0xb8a888]), topTx: mpick([TX.terrazzo, TX.ceramic, TX.paving]), thk: G0 + 0.05, bot: false, dimTop: DIM_IN });
    extWalls(w, d, T, G0, H0, rooms, { col, ops, plinth: 0.5, wear: 5 });
    partitions(rooms, doors, G0, H0);
    if (o.closed) { store.light = false; shop.light = false; }
    else { furnish(shop); furnish(store); }
    // goods spilling onto the street in front of an open shop
    if (!o.closed) W.scope({ lod: 2 }, () => {
      if (trade === 'pottery' || trade === 'copper') for (let i = 0; i < 4; i++) tagine(mr(-w / 2 + 0.4, w / 2 - 0.4), 0, d / 2 + mr(0.3, 0.9));
      else if (trade === 'rugs') hangingRug(-w / 2 + 0.6, 0.3, d / 2 + 0.06, 0, 1.0, 2.2);
      else if (trade === 'lamps') lanternCluster(0, H0 + 0.4, d / 2 + 0.6, 6, sw / 2);
      else if (trade === 'spice') for (let i = 0; i < 3; i++) sack(-w / 2 + 0.5 + i * 0.6, 0, d / 2 + 0.4, mpick([0xc8b088, 0xa89068]));
      else if (trade === 'grocery') { produceCrates(0, 0, d / 2 + 0.6, 0, Math.min(1.8, sw)); }
      if (mchance(0.6)) stool(w / 2 - 0.5, 0, d / 2 + 0.5, PC.woodLt);
    });
    // solid house above, with a dressed facade
    const Hup = up * 3.1, yU = G0 + H0;
    W.box(w, Hup, d, 0, yU + Hup / 2, 0, col, { t: TX.plaster, wear: 4 });
    W.solid(w, Hup, d, 0, yU + Hup / 2, 0, 'plaster');
    W.box(w, 0.25, d, 0, yU + 0.1, 0, MC.cedar, { t: TX.carved, lod: 1 });
    for (let f = 0; f < up; f++) { const n = Math.max(1, Math.floor(w / 3.2)); for (let i = 0; i < n; i++) faceWindow('s', w, d, -w / 2 + (i + 0.5) * w / n, yU + f * 3.1 + 0.9, 0.9, 1.2, mpick(['shut', 'mash', 'grille', 'curtain']), { ac: 0.15 }); }
    W.box(w - 0.3, 0.04, d - 0.3, 0, yU + Hup + 0.02, 0, MC.roofGravel, { t: TX.gravel, lod: 1 });
    W.scope({ lod: 1 }, () => parapet(-w / 2, -d / 2, w / 2, d / 2, yU + Hup, { h: 0.8, T: 0.22, col, style: mchance(0.3) ? 'merlon' : 'plain', gaps: o.gaps }));
    roofClutter(-w / 2 + 0.3, -d / 2 + 0.3, w / 2 - 0.3, d / 2 - 0.3, yU + Hup, { tank: 0.5, laundry: 0.5 });
    if (mchance(0.5)) W.scope({ lod: 1 }, () => shopSign(0, H0 + 0.6, d / 2 + 0.02, 0, Math.min(2.2, w - 0.6), undefined, 'none'));
  });
}

// ---------------- CAFÉ: street terrace, counter, kitchen, WC, roof terrace ----------------
function cafe(lot, o = {}) {
  const { w, d } = lot, T = 0.3, H0 = 3.6, col = o.col ?? mpick([MC.cream, MC.plaster, MC.whitewash, MC.ochre]);
  inLot(lot, () => {
    const kz = -d / 2 + Math.min(3.2, d * 0.32);
    const hall = mkRoom([-w / 2, kz, w / 2, d / 2], G0, H0, 'cafe', { front: 1, paint: mpick([0xe8dcc0, 0xd8e4dc, 0xf0e8d8]), style: 'modern' });
    const kit = mkRoom([-w / 2, -d / 2, w / 2 - 2.4, kz], G0, H0, 'kitchen', { paint: 0xe8e8e0 });
    const wc = mkRoom([w / 2 - 2.4, -d / 2, w / 2, kz], G0, H0, 'bath', { paint: 0xe0e8e8 });
    const rooms = [hall, kit, wc];
    for (const q of rooms) { q.extN = Math.abs(q.z0 + d / 2) < 0.05; q.extS = Math.abs(q.z1 - d / 2) < 0.05; q.extW = Math.abs(q.x0 + w / 2) < 0.05; q.extE = Math.abs(q.x1 - w / 2) < 0.05; q.extIn = T; }
    const doors = [{ ax: 'x', c: kz, at: -w / 2 + 1.0, w: 0.9, leaf: 'open' }, { ax: 'x', c: kz, at: w / 2 - 1.2, w: 0.8 }];
    const ops = { s: [], n: [], e: [], w: [] };
    const n = Math.max(1, Math.floor((w - 1) / 3.2));
    for (let i = 0; i < n; i++) ops.s.push({ at: -w / 2 + (i + 0.5) * w / n, w: Math.min(2.8, w / n - 0.6), h: 2.8, kind: i === Math.floor(n / 2) ? 'shop' : 'win', style: 'glass', leaf: 'open', win: 'glass', sill: i === Math.floor(n / 2) ? 0 : 0.5 });
    for (const p of ops.s) if (p.kind === 'shop') { hall.doors.push({ side: 's', at: p.at, w: p.w }); markDoor(p.at, d / 2 + 1.2, p.w); }
    if (lot.open?.n) { ops.n.push({ at: -w / 2 + 1.5, w: 0.9, h: 2.05, kind: 'door', style: 'metal', leaf: 'ajar' }); kit.doors.push({ side: 'n', at: -w / 2 + 1.5, w: 0.9 }); }
    linkDoors(rooms, doors);
    slab(-w / 2 + T, -d / 2 + T, w / 2 - T, d / 2 - T, G0, { top: 0xd8d0c0, topTx: TX.ceramic, topWear: mpick([4, 5, 0]), thk: G0 + 0.05, bot: false, dimTop: DIM_IN });
    extWalls(w, d, T, G0, H0, rooms, { col, ops, plinth: 0.5 });
    partitions(rooms, doors, G0, H0);
    for (const q of rooms) furnish(q);
    // terrace on the pavement under an awning
    W.scope({ lod: 2 }, () => { for (let i = 0; i < Math.floor(w / 1.9); i++) bistroTable(-w / 2 + 1.0 + i * 1.9, 0.0, d / 2 + 1.3, 2); });
    W.scope({ lod: 1 }, () => { awning(w, H0 - 0.1, d / 2, mpick([[0x2a5a3a, 0x2a5a3a], [0x7a2a24, 0xe8dcc0], [0xc89a3a, 0xc89a3a]])); shopSign(0, H0 + 0.5, d / 2 + 0.02, 0, Math.min(3, w - 1), mpick([0x2a5a3a, 0x7a2a24, 0x2a2a2a]), 'cup'); });
    // first floor: solid; roof: terrace reached by an external stair at the side
    const yR = G0 + H0 + 3.0;
    W.box(w, 3.0, d, 0, G0 + H0 + 1.5, 0, col, { t: TX.plaster, wear: 3 }); W.solid(w, 3.0, d, 0, G0 + H0 + 1.5, 0, 'plaster');
    for (let i = 0; i < Math.max(1, Math.floor(w / 3)); i++) faceWindow('s', w, d, -w / 2 + (i + 0.5) * w / Math.max(1, Math.floor(w / 3)), G0 + H0 + 0.9, 1.0, 1.3, 'shut', {});
    const side = lot.open?.e ? 1 : lot.open?.w ? -1 : 0;
    const nSteps = Math.round(yR / ST_RISE), run = 0.27, L = nSteps * run, sxE = side * (w / 2 + 0.6), z0 = Math.min(d / 2 - 0.3, -d / 2 + L + 1.6), zTop = z0 - L;
    slab(-w / 2, -d / 2, w / 2, d / 2, yR, { top: 0xc8b8a0, topTx: TX.ceramic, topWear: 2, bot: false });
    parapet(-w / 2, -d / 2, w / 2, d / 2, yR, { h: 1.05, T: 0.22, col, style: 'plain', gaps: side ? [{ side: side > 0 ? 'e' : 'w', at: zTop - 0.6, w: 1.2 }] : [] });
    W.scope({ lod: 2 }, () => { for (let i = 0; i < Math.floor((w - 2) / 2.2); i++) for (let j = 0; j < Math.floor((d - 2) / 2.4); j++) bistroTable(-w / 2 + 1.6 + i * 2.2, yR, -d / 2 + 1.6 + j * 2.4, mpick([2, 3])); if (w > 6) { W.box(4, 0.06, 2.5, 0, yR + 2.6, -d / 2 + 1.5, 0xe8dcc0, { layer: 'cloth', t: TX.fabric, wear: 5 }); for (const s of [-1, 1]) W.rod([s * 1.9, yR, -d / 2 + 0.4], [s * 1.9, yR + 2.6, -d / 2 + 0.4], 0.03, MC.iron, { layer: 'metal' }); } });
    // external masonry stair on the open side face up to the roof terrace
    if (side) {
      flight(sxE, z0, [0, -1], 1.1, 0, yR, { col: MC.stone, tx: TX.stone, run, soffit: false, thick: 30 });
      railing(sxE + side * 0.55, z0, sxE + side * 0.55, zTop, 0, 'iron');
      W.box(1.2, 0.2, 1.2, sxE, yR - 0.1, zTop - 0.6, MC.stone, { t: TX.stone }); W.solid(1.2, 0.2, 1.2, sxE, yR - 0.1, zTop - 0.6, 'stone', { walk: true });
      const P = (x, y, z) => { const v = W.worldPos(x, y, z); return [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)]; };
      MAP.poi.push({ kind: 'cafe', path: [P(sxE, 0, z0 + 1.2), P(sxE, 0, z0 + 0.3), P(sxE, yR, zTop - 0.6), P(side * (w / 2 - 1.0), yR, zTop - 0.6)] });
      GR.rect(W.worldPos(sxE, 0, (z0 + zTop) / 2).x, W.worldPos(sxE, 0, (z0 + zTop) / 2).z, 1.6, L + 3, W.worldRotY(), GR.PAVE, true);
    }
  });
}

// ---------------- OFFICE (modern): lobby, open-plan floors, meeting rooms, roof plant ----------------
function office(lot, o = {}) {
  const { w, d } = lot, T = 0.3, nF = o.floors ?? 4, H0 = 4.2, Hf = 3.6;
  const skin = o.skin ?? mpick(['glass', 'concrete', 'stone']);
  const col = skin === 'stone' ? MC.sandstone : skin === 'concrete' ? MC.concreteLt : 0xd8d4cc;
  inLot(lot, () => {
    const sw = 2.8, sd = 6.0, sx0 = w / 2 - T - sw - 0.4, zb = -d / 2 + T, zf = zb + sd;  // stair core at the back-right
    const ys = [G0]; for (let f = 1; f <= nF; f++) ys.push(ys[f - 1] + (f === 1 ? H0 : Hf));
    for (let f = 0; f < nF; f++) {
      const y = ys[f], H = ys[f + 1] - y;
      const core = mkRoom([sx0, -d / 2, sx0 + sw, zf], y, H, 'stairhall', { paint: 0xd8d8d4, noWin: true });
      const rooms = [core];
      const doors = [{ ax: 'z', c: sx0, at: zb + 0.65, w: 0.9, style: 'glass', leaf: 'open' }, { ax: 'z', c: sx0, at: (zf + d / 2) / 2, w: 1.0, style: 'glass', leaf: 'open' }];
      if (f === 0) {
        const lobby = mkRoom([-w / 2, -d / 2, sx0, d / 2], y, H, 'office', { paint: 0xe8e4dc, style: 'modern' });
        lobby.type = 'empty';
        const side = mkRoom([sx0, zf, w / 2, d / 2], y, H, 'security', { paint: 0xd8dcd8, style: 'modern' });
        rooms.push(lobby, side);
        
        W.scope({ lod: 2, dim: DIM_IN }, () => { receptionDesk((-w / 2 + sx0) / 2, y, d / 2 - 3.2, 0, Math.min(4, (sx0 + w / 2) * 0.5)); waitingChairs(-w / 2 + 1.2, y, 0, Math.PI / 2, 4); plantPot(-w / 2 + 0.8, y, d / 2 - 0.8, 'ficus', 1.3); plantPot(sx0 - 0.8, y, d / 2 - 0.8, 'palm', 1.3); floorRug((-w / 2 + sx0) / 2, y, 0, 3, 2, 0); });
        roomLight(lobby, 'office');
      } else {
        const plan = bspPlan(-w / 2, -d / 2, sx0, d / 2, { minW: 4, maxA: 60, doors: [{ ax: 'z', c: sx0, at: zb + 0.65, w: 0.9 }, { ax: 'z', c: sx0, at: (zf + d / 2) / 2, w: 1.0 }] });
        const fl = plan.rooms.map((q) => mkRoom(q, y, H, 'office', { paint: mpick([0xe8e4dc, 0xdcdcd8, 0xe0e4e8]), style: 'modern' }));
        if (fl.length > 1) fl.sort((a, b) => (a.x1 - a.x0) * (a.z1 - a.z0) - (b.x1 - b.x0) * (b.z1 - b.z0))[0].type = 'meeting';
        const rest = mkRoom([sx0, zf, w / 2, d / 2], y, H, mchance(0.5) ? 'meeting' : 'office', { paint: 0xe0e0dc, style: 'modern' });
        rooms.push(...fl, rest);
        doors.push(...plan.doors);
      }
      for (const q of rooms) { q.floor = f; q.extN = Math.abs(q.z0 + d / 2) < 0.05; q.extS = Math.abs(q.z1 - d / 2) < 0.05; q.extW = Math.abs(q.x0 + w / 2) < 0.05; q.extE = Math.abs(q.x1 - w / 2) < 0.05; q.extIn = T; }
      const ops = { s: [], n: [], e: [], w: [] };
      if (f === 0) { ops.s.push({ at: (-w / 2 + sx0) / 2, w: 2.4, h: 2.9, kind: 'shop', style: 'glass', leaf: 'open' }); rooms[1].doors.push({ side: 's', at: (-w / 2 + sx0) / 2, w: 2.4 }); }
      // ribbon glazing / punched windows
      for (const side of STREET_SIDE) {
        if (lot.open && !lot.open[side]) continue;
        const L = side === 's' || side === 'n' ? w : d, n = Math.max(1, Math.floor(L / 2.2));
        for (let i = 0; i < n; i++) { const at = -L / 2 + (i + 0.5) * L / n; if (ops[side].some((p) => Math.abs(p.at - at) < p.w / 2 + 0.9)) continue; ops[side].push({ at, w: skin === 'glass' ? L / n - 0.3 : 1.3, h: skin === 'glass' ? H - 1.0 : 1.7, sill: skin === 'glass' ? 0.6 : 0.9, kind: 'win', win: 'glass', frameCol: 0x3a3e44 }); }
      }
      for (const side of STREET_SIDE) for (const p of ops[side]) for (const q of rooms) { const on = (side === 's' && q.extS && p.at > q.x0 && p.at < q.x1) || (side === 'n' && q.extN && p.at > q.x0 && p.at < q.x1) || (side === 'e' && q.extE && p.at > q.z0 && p.at < q.z1) || (side === 'w' && q.extW && p.at > q.z0 && p.at < q.z1); if (on) q.wins.push({ side, at: p.at, w: p.w }); }
      linkDoors(rooms, doors);
      slab(-w / 2 + T, -d / 2 + T, w / 2 - T, d / 2 - T, y, { holes: f > 0 ? [[sx0, zb + 1.2, sx0 + sw, zf]] : [], top: f === 0 ? 0xd8d0c0 : 0x8a8e92, topTx: f === 0 ? TX.stone : TX.terrazzo, topWear: 1, thk: f === 0 ? G0 + 0.05 : 0.3, bot: f === 0 ? false : 0xe8e8e4, dimTop: DIM_IN, dimBot: DIM_IN });
      extWalls(w, d, T, y, H, rooms, { col, tx: skin === 'concrete' ? TX.concrete : skin === 'stone' ? TX.stone : TX.concrete, ops, plinth: f === 0 ? 0.4 : 0, plinthCol: 0x6a6a68, wear: 2 });
      partitions(rooms, doors, y, H);
      uStair(sx0, zb, zf, sw, y, ys[f + 1], { col: 0x9a9a98, tx: TX.terrazzo, wallCol: 0xd8d8d4, lf: 1.2 });
      for (const q of rooms) if (q.type !== 'stairhall') furnish(q); else roomLight(q, 'tube');
    }
    const yR = ys[nF];
    slab(-w / 2, -d / 2, w / 2, d / 2, yR, { holes: [[sx0, zb + 1.2, sx0 + sw, zf]], top: 0x9a9488, topTx: TX.gravel, bot: 0xe8e8e4, thk: 0.35, dimBot: DIM_IN });
    stairHouse(sx0 - 0.2, zb + 0.1, sx0 + sw + 0.2, zf + 0.2, yR, 'w', { col, at: zb + 0.75 });
    parapet(-w / 2, -d / 2, w / 2, d / 2, yR, { h: 1.1, T: 0.25, col, style: 'plain' });
    W.scope({ lod: 1 }, () => { for (let i = 0; i < Math.floor(w / 4); i++) acCondenser(-w / 2 + 2 + i * 3.2, yR, -d / 2 + 1.0, 0); bigGenerator(-w / 2 + 3, yR, d / 2 - 2.0, 0); satDish(w / 2 - 1.5, yR, d / 2 - 1.5, 2.4, 1.6); for (let i = 0; i < 3; i++) antenna(-w / 2 + 1 + i * 0.8, yR, 0); });
    cornices(w, d, [yR + 1.15], shade(col, 0.95));
  });
}
// modern shell: tower/slab with banded glazing; ground floor storefronts
function modernShell(lot, o = {}) {
  const { w, d } = lot, nF = o.floors ?? 6, H0 = 4.2, Hf = 3.5, H = G0 + H0 + (nF - 1) * Hf;
  const skin = o.skin ?? mpick(['glass', 'concrete', 'stone', 'band']);
  const col = skin === 'stone' ? MC.sandstone : skin === 'concrete' ? MC.concreteLt : skin === 'band' ? mpick([0xe8e4dc, 0xd8d0c0]) : 0xc8c8c4;
  const open = lot.open ?? { s: true };
  inLot(lot, () => {
    W.box(w, H, d, 0, H / 2, 0, col, { t: skin === 'stone' ? TX.stone : TX.concrete, wear: 2 });
    W.solid(w, H, d, 0, H / 2, 0, 'concrete');
    for (const side of STREET_SIDE) {
      if (!open[side]) continue;
      const L = side === 's' || side === 'n' ? w : d;
      for (let f = 0; f < nF; f++) {
        const yb = f === 0 ? G0 : G0 + H0 + (f - 1) * Hf;
        if (f === 0) {
          const n = Math.max(1, Math.floor(L / 5));
          for (let i = 0; i < n; i++) { const at = -L / 2 + (i + 0.5) * L / n; faceWindow(side, w, d, at, yb + 0.3, L / n - 0.8, 3.0, 'none', { frame: 0x3a3e44, mullion: 0x3a3e44 }); if (side === 's' && mchance(0.5)) W.defer(() => W.scope({ lod: 1 }, () => { W.push(at, 0, d / 2, 0); awning(L / n - 0.6, 3.6, 0, mpick([[0x2a5a3a, 0x2a5a3a], [0x7a2a24, 0x7a2a24], [0x2a2a2a, 0x2a2a2a], [0xc89a3a, 0xe8dcc0]])); shopSign(0, 4.1, 0.02, 0, Math.min(3, L / n - 1), undefined, mpick(['none', 'cup', 'cross', 'key'])); W.pop(); }), 'mid'); }
          continue;
        }
        if (skin === 'glass') { faceWindow(side, w, d, 0, yb + 0.1, L - 0.6, Hf - 0.5, 'none', { frame: 0x3a3e44, mullion: 0x3a3e44, sillCol: 0x3a3e44 }); }
        else {
          const n = Math.max(1, Math.floor(L / (skin === 'band' ? 2.0 : 2.6)));
          for (let i = 0; i < n; i++) faceWindow(side, w, d, -L / 2 + (i + 0.5) * L / n, yb + 0.9, skin === 'band' ? L / n - 0.25 : 1.4, 1.7, mchance(0.15) ? 'curtain' : 'none', { frame: 0x5a5e62, mullion: 0x5a5e62, ac: 0.08 });
          if (skin === 'band') W.box(L + 0.1, 0.5, 0.1, side === 's' || side === 'n' ? 0 : (side === 'e' ? 1 : -1) * (w / 2 + 0.05), yb + 0.4, side === 's' ? d / 2 + 0.05 : side === 'n' ? -d / 2 - 0.05 : 0, shade(col, 0.9), { ry: side === 'e' || side === 'w' ? Math.PI / 2 : 0, t: TX.concrete, lod: 1 });
        }
      }
    }
    W.box(w - 0.3, 0.04, d - 0.3, 0, H + 0.02, 0, 0x9a9488, { t: TX.gravel, lod: 1 });
    W.scope({ lod: 1 }, () => { parapet(-w / 2, -d / 2, w / 2, d / 2, H, { h: 1.1, T: 0.22, col, style: 'plain' }); W.box(mr(3, 6), 2.6, mr(3, 5), mr(-w / 5, w / 5), H + 1.3, mr(-d / 5, d / 5), shade(col, 0.95), { t: TX.concrete }); for (let i = 0; i < Math.floor(w / 5); i++) acCondenser(-w / 2 + 2 + i * 3.6, H, d / 2 - 1.2, 0); if (mchance(0.5)) satDish(w / 2 - 2, H, -d / 2 + 2, 2.4, 1.8); if (mchance(0.3)) waterTank(-w / 2 + 2, H, -d / 2 + 2, 'steel'); });
    W.solid(w * 0.4, 2.6, d * 0.4, 0, H + 1.3, 0, 'concrete');
  });
}

// ---------------- WAREHOUSE: steel portal frame, loading dock, racks, mezzanine office ----------------
function warehouse(lot, o = {}) {
  const { w, d } = lot, H = o.H ?? mr(8, 10.5), T = 0.3, dock = 1.2, enter = o.enter ?? true;
  const clad = o.col ?? mpick([0xb8bcc0, 0x9aa4a8, 0xc8bca8, 0x8a9a8a, 0xa8a090]);
  inLot(lot, () => {
    if (!enter) {
      W.box(w, H, d, 0, H / 2, 0, clad, { layer: 'metal', t: TX.corrugated, wear: Math.floor(mr(2, 7)) });
      W.box(w, 1.2, d, 0, 0.6, 0, MC.concrete, { t: TX.concrete, wear: 5 });
      W.solid(w, H, d, 0, H / 2, 0, 'metal');
      for (let i = 0; i < Math.floor(w / 9); i++) { W.push(-w / 2 + 4.5 + i * 9, 0, d / 2, 0); W.box(4.0, 4.5, 0.08, 0, 2.25, 0.04, mpick([0x8a8e92, 0x5a6a7a, 0xc8a020]), { layer: 'metal', t: TX.corrugated, wear: 6 }); W.box(4.6, 0.3, 1.4, 0, 4.9, 0.7, 0x5a5e62, { layer: 'metal', lod: 1 }); W.pop(); }
      W.box(w + 0.2, 0.3, d + 0.2, 0, H + 0.15, 0, shade(clad, 0.9), { layer: 'metal' });
      W.scope({ lod: 1 }, () => { for (let i = 0; i < Math.floor(w / 6); i++) W.box(1.2, 0.5, 2.4, -w / 2 + 3 + i * 6, H + 0.4, 0, 0xd8e0e8, { layer: 'pane' }); if (mchance(0.6)) for (let i = 0; i < 3; i++) acCondenser(-w / 2 + 2 + i * 1.2, H + 0.3, d / 2 - 1.5); });
      return;
    }
    const y = dock;
    // raised slab (loading dock height) with a dock apron + steps
    W.box(w - 0.2, dock, d - 0.2, 0, dock / 2, 0, MC.concrete, { t: TX.concrete, wear: 5 }); W.solid(w - 0.2, dock, d - 0.2, 0, dock / 2, 0, 'concrete', { walk: true });
    W.box(w - 2 * T, 0.02, d - 2 * T, 0, dock + 0.01, 0, 0x8a8680, { t: TX.concrete, wear: 6, dim: 0.8 });
    W.box(w * 0.7, dock, 3.0, -w * 0.1, dock / 2, d / 2 + 1.5, MC.concrete, { t: TX.concrete, wear: 6 }); W.solid(w * 0.7, dock, 3.0, -w * 0.1, dock / 2, d / 2 + 1.5, 'concrete', { walk: true });
    for (let i = 0; i < Math.round(w * 0.7 / 2); i++) W.box(0.25, 0.4, 0.15, -w * 0.45 + 0.3 + i * 2, dock - 0.3, d / 2 + 3.05, 0x1a1a1a, { lod: 1 });   // bumpers
    railing(-w * 0.45, d / 2 + 2.9, -w * 0.45 + 0.01, d / 2 + 0.2, dock, 'pipe');
    flight(w * 0.25 + 0.7, d / 2 + 2.4, [1, 0], 1.2, 0, dock, { col: MC.concrete, tx: TX.concrete, soffit: false });
    // walls: corrugated cladding over a concrete upstand, roller doors and a personnel door
    const doorsS = []; const nD = Math.max(1, Math.floor(w * 0.7 / 6));
    for (let i = 0; i < nD; i++) doorsS.push({ at: -w * 0.45 + 3 + i * 6, w: 4.0, h: 4.4, kind: 'shop', style: 'roll', leaf: i === 0 || mchance(0.4) ? 'open' : 'closed', shutCol: 0x8a8e92 });
    doorsS.push({ at: w * 0.3, w: 1.0, h: 2.2, kind: 'door', style: 'metal', leaf: 'ajar' });
    const sides = { s: ['x', -w / 2, w / 2, d / 2 - T / 2, 1, doorsS], n: ['x', -w / 2, w / 2, -d / 2 + T / 2, -1, lot.open?.n ? [{ at: 0, w: 1.0, h: 2.2, kind: 'door', style: 'metal', leaf: 'open' }] : []], e: ['z', -d / 2 + T, d / 2 - T, w / 2 - T / 2, 1, []], w: ['z', -d / 2 + T, d / 2 - T, -w / 2 + T / 2, -1, []] };
    for (const k in sides) {
      const [ax, a0, a1, c, s, ops] = sides[k];
      wall(ax, a0, a1, c, y, 1.2, T, { col: MC.concrete, tx: TX.concrete, inCol: MC.concreteLt, side: s, ops: ops.map((p) => ({ at: p.at, w: p.w, h: 2, kind: 'gap' })), solid: true, wear: 6 });
      wall(ax, a0, a1, c, y + 1.2, H - 1.2, T, { col: clad, tx: TX.corrugated, inCol: shade(clad, 0.9), inTx: TX.corrugated, side: s, ops: ops.map((p) => ({ at: p.at, w: p.w, sill: 0, h: p.h - 1.2, kind: 'gap' })), mat: 'metal', wear: 5 });
      // the openings' decoration (roller housings, doors) at full height
      for (const p of ops) opening(ax, c, s, y, T, { ...p }, {});
    }
    // portal frames + roof sheeting with skylights
    const bays = Math.max(2, Math.round(w / 6));
    W.scope({ lod: 1 }, () => {
      for (let i = 0; i <= bays; i++) { const x = -w / 2 + T + 0.2 + i * (w - 2 * T - 0.4) / bays; for (const t of [-1, 1]) W.box(0.3, H, 0.3, x, y + H / 2, t * (d / 2 - T - 0.2), 0x3a5a7a, { layer: 'metal' }); W.box(0.3, 0.6, d - 2 * T, x, y + H - 0.3, 0, 0x3a5a7a, { layer: 'metal' }); }
    });
    W.box(w + 0.3, 0.2, d + 0.3, 0, y + H + 0.1, 0, shade(clad, 0.85), { layer: 'metal', t: TX.corrugated, wear: 5 });
    W.solid(w, 0.2, d, 0, y + H + 0.1, 0, 'metal', { walk: true });
    W.scope({ lod: 1 }, () => { for (let i = 0; i < bays; i++) W.box(1.6, 0.06, d * 0.6, -w / 2 + (i + 0.5) * w / bays, y + H + 0.22, 0, 0xd8e0e8, { layer: 'pane' }); });
    // interior: racks, pallets, forklift, mezzanine office
    W.scope({ lod: 2, dim: 0.75 }, () => {
      const rx0 = -w / 2 + 2.2, rx1 = w * 0.15;
      for (let z = -d / 2 + 2.0; z < d / 2 - 6; z += 4.2) palletRack((rx0 + rx1) / 2, y, z, 0, Math.max(5, rx1 - rx0 - 1), 3, 1.1);
      for (let i = 0; i < 6; i++) { const px = mr(-w / 4, w / 4), pz = d / 2 - mr(2.5, 4.5); pallet(px, y, pz, mr(0, 1.6)); if (mchance(0.6)) crate(px, y + 0.15, pz, 1.0, mr(0.5, 1.0), 0.9, mr(0, 0.3), mpick([PC.woodLt, 0xb89a6a]), true); }
      forklift(w * 0.1, d / 2 - 6.5, mr(0, 3), y);
      for (let i = 0; i < 4; i++) drum(w / 2 - 1.2 - (i % 2) * 0.7, y, -d / 2 + 1.2 + Math.floor(i / 2) * 0.7, mpick([PC.blue, PC.redLt, 0x3a3a3a]));
    });
    // mezzanine office in the back-right corner, reached by a steel stair
    const mx0 = w / 2 - T - 6.5, mz0 = -d / 2 + T, mz1 = mz0 + 5.0, my = y + 3.4;
    W.box(6.5, 0.2, 5.0, mx0 + 3.25, my - 0.1, (mz0 + mz1) / 2, 0x6a6e72, { layer: 'metal', t: TX.metal }); W.solid(6.5, 0.2, 5.0, mx0 + 3.25, my - 0.1, (mz0 + mz1) / 2, 'metal', { walk: true });
    for (const [px, pz] of [[mx0 + 0.2, mz1 - 0.2], [mx0 + 3.2, mz1 - 0.2]]) { W.box(0.2, 3.3, 0.2, px, y + 1.65, pz, 0x3a5a7a, { layer: 'metal' }); W.solid(0.2, 3.3, 0.2, px, y + 1.65, pz, 'metal'); }
    const off = mkRoom([mx0, mz0, w / 2 - T, mz1 - 1.2], my, 2.6, 'office', { paint: 0xe0e0dc, style: 'modern' });
    off.extE = true; off.extN = true; off.extIn = 0.1;
    wall('x', mx0, w / 2 - T, mz1 - 1.2, my, 2.6, 0.12, { col: 0xd8d8d4, inCol: 0xe0e0dc, side: 1, dimOut: 0.8, ops: [{ at: mx0 + 1.2, w: 0.9, h: 2.05, kind: 'door', style: 'metal', leaf: 'open' }, { at: mx0 + 3.8, w: 2.0, h: 1.1, sill: 1.0, kind: 'win', win: 'glass' }] });
    wall('z', mz0, mz1 - 1.2, mx0, my, 2.6, 0.12, { col: 0xd8d8d4, inCol: 0xe0e0dc, side: -1, dimOut: 0.8, ops: [{ at: (mz0 + mz1 - 1.2) / 2, w: 1.6, h: 1.1, sill: 1.0, kind: 'win', win: 'glass' }] });
    off.doors.push({ side: 's', at: mx0 + 1.2, w: 0.9 });
    slab(mx0, mz0, w / 2 - T, mz1 - 1.2, my + 2.7, { top: 0x6a6e72, topTx: TX.metal, bot: 0xe8e8e4, thk: 0.1, solid: true });
    furnish(off);
    railing(mx0, mz1 - 0.05, mx0 + 2.0, mz1 - 0.05, my, 'pipe'); railing(mx0 + 3.2, mz1 - 0.05, mx0 + 6.5, mz1 - 0.05, my, 'pipe');
    const sN = Math.round(3.4 / ST_RISE), sL = sN * ST_RUN;
    flight(mx0 + 2.6, mz1 + sL, [0, -1], 1.1, y, my, { col: 0x5a5e62, tx: TX.metal, soffit: false });
    { const P = (x, yy, z) => { const v = W.worldPos(x, yy, z); return [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)]; }; MAP.poi.push({ kind: 'warehouse', path: [P(mx0 + 2.6, y, mz1 + sL + 1.2), P(mx0 + 2.6, y, mz1 + sL + 0.3), P(mx0 + 2.6, my, mz1 - 0.6), P(mx0 + 1.2, my, mz1 - 0.6), P(mx0 + 1.2, my, mz1 - 2.0)] }); }
    // lights: high-bay lamps
    for (let i = 0; i < bays; i += 1) { const x = -w / 2 + (i + 0.5) * w / bays; W.cyl(0.35, 0.2, 0.3, x, y + H - 0.8, 0, 0x3a3a3a, { layer: 'metal', lod: 1 }); W.cyl(0.32, 0.32, 0.02, x, y + H - 0.96, 0, 0xfff4e0, { layer: 'glow', lod: 1 }); if (i % 2 === 0) W.lamp(x, y + H - 1.2, 0, 0xfff0d8, 9, 16, { halo: 0 }); }
    // roof access: caged ladder approximated by a steep exterior stair on the west face
    if (lot.open?.w) { const nS = Math.round((y + H) / 0.2), L = nS * 0.22; flight(-w / 2 - 0.7, d / 2 - 0.6, [0, -1], 0.9, 0, y + H + 0.2, { col: 0x5a5e62, tx: TX.metal, run: Math.min(0.22, (d - 1.5) / nS), soffit: false }); void L; }
    W.scope({ lod: 1 }, () => { for (let i = 0; i < 3; i++) acCondenser(-w / 2 + 3 + i * 1.3, y + H + 0.2, d / 2 - 2); if (mchance(0.5)) waterTank(w / 2 - 2.5, y + H + 0.2, -d / 2 + 2, 'steel'); });
  });
}
// ---------------- WORKSHOP / garage: roller door, car on a lift, benches; parts room ----------------
function workshop(lot, o = {}) {
  const { w, d } = lot, T = 0.3, H0 = 4.2, col = o.col ?? mpick([MC.cream, MC.plaster, 0xd8d0c0, MC.ochre]);
  inLot(lot, () => {
    const pz = -d / 2 + Math.min(3.2, d * 0.3);
    const bay = mkRoom([-w / 2, pz, w / 2, d / 2], G0, H0, 'workshop', { paint: 0xc8c4b8, style: 'modern' });
    const parts = mkRoom([-w / 2, -d / 2, w / 2 * 0 + w / 2 - 3, pz], G0, H0, 'storage', { paint: 0xc8c4b8 });
    const offc = mkRoom([w / 2 - 3, -d / 2, w / 2, pz], G0, H0, 'office', { paint: 0xd8d8d0, style: 'modern' });
    const rooms = [bay, parts, offc];
    for (const q of rooms) { q.extN = Math.abs(q.z0 + d / 2) < 0.05; q.extS = Math.abs(q.z1 - d / 2) < 0.05; q.extW = Math.abs(q.x0 + w / 2) < 0.05; q.extE = Math.abs(q.x1 - w / 2) < 0.05; q.extIn = T; }
    const doors = [{ ax: 'x', c: pz, at: -w / 2 + 1.2, w: 0.9 }, { ax: 'x', c: pz, at: w / 2 - 1.5, w: 0.9, style: 'metal' }];
    const gw = Math.min(w - 1.6, 4.2);
    const ops = { s: [{ at: -w / 2 + gw / 2 + 0.5, w: gw, h: 3.4, kind: 'shop', style: 'roll', leaf: 'open', shutCol: 0x8a8e92 }], n: [], e: [], w: [] };
    bay.doors.push({ side: 's', at: ops.s[0].at, w: gw }); markDoor(ops.s[0].at, d / 2 + 1.5, gw, 3);
    if (w - gw > 2.6) ops.s.push({ at: w / 2 - 1.0, w: 1.0, h: 1.2, sill: 1.0, kind: 'win', win: 'grille' });
    if (lot.open?.n) { ops.n.push({ at: -w / 2 + 1.5, w: 0.9, h: 2.05, kind: 'door', style: 'metal', leaf: 'ajar' }); parts.doors.push({ side: 'n', at: -w / 2 + 1.5, w: 0.9 }); }
    linkDoors(rooms, doors);
    slab(-w / 2 + T, -d / 2 + T, w / 2 - T, d / 2 - T, G0, { top: 0x7a7670, topTx: TX.concrete, topWear: 7, thk: G0 + 0.05, bot: false, dimTop: 0.65 });
    extWalls(w, d, T, G0, H0, rooms, { col, ops, plinth: 0.5, wear: 6 });
    partitions(rooms, doors, G0, H0);
    for (const q of rooms) furnish(q);
    W.scope({ lod: 2, dim: 0.65 }, () => {
      const cxp = ops.s[0].at, czp = (pz + d / 2) / 2;
      for (const s of [-1, 1]) { W.box(0.3, 1.6, 0.3, cxp + s * 1.4, G0 + 0.8, czp, 0xd8b020, { layer: 'metal' }); W.box(0.2, 0.1, 1.8, cxp + s * 1.1, G0 + 1.55, czp, 0x3a3a3a, { layer: 'metal' }); }
      sedan(cxp, czp, Math.PI / 2, mpick([0x8a8e94, 0x2a2c30, 0xc8261e]), 'car', G0 + 1.6);
      for (let i = 0; i < 4; i++) tire(-w / 2 + 0.5, G0 + i * 0.25, pz + 0.6, 0);
      engineStand(w / 2 - 1.5, G0, czp, 0.4);
      W.box(1.4, 0.01, 1.0, cxp + 0.5, G0 + 0.006, czp - 0.5, 0x1a1a18, { ao: false });
    });
    const yR = G0 + H0;
    slab(-w / 2, -d / 2, w / 2, d / 2, yR, { top: MC.roofGravel, topTx: TX.gravel, bot: 0xd8d4c8, thk: 0.3, dimBot: 0.65 });
    parapet(-w / 2, -d / 2, w / 2, d / 2, yR, { h: 0.8, T: 0.22, col, style: 'plain' });
    roofClutter(-w / 2 + 0.3, -d / 2 + 0.3, w / 2 - 0.3, d / 2 - 0.3, yR, { tank: 0.6, laundry: 0.2, life: 0.1 });
    W.scope({ lod: 1 }, () => { shopSign(-w / 2 + gw / 2 + 0.5, H0 + 0.1, d / 2 + 0.02, 0, gw, mpick([0xd8a020, 0x2a3a6a, 0x7a2a24]), 'key'); for (let i = 0; i < 3; i++) tire(w / 2 - 0.5, i * 0.25, d / 2 + 0.6, 0); oilCans(w / 2 - 1.2, 0, d / 2 + 0.5); });
  });
}
// ---------------- guard house at gates ----------------
function guardHouse(lot) {
  const { w, d } = lot, T = 0.25, H0 = 3.0;
  inLot(lot, () => {
    const r = mkRoom([-w / 2, -d / 2, w / 2, d / 2], G0, H0, 'security', { paint: 0xe0e0d8, style: 'modern' });
    r.extN = r.extS = r.extE = r.extW = true; r.extIn = T;
    const ops = { s: [{ at: w / 2 - 0.8, w: 0.9, h: 2.1, kind: 'door', style: 'metal', leaf: 'open' }, { at: -w / 4, w: Math.min(2, w / 2 - 0.4), h: 1.2, sill: 1.0, kind: 'win', win: 'glass' }], n: [], e: [{ at: 0, w: 1.4, h: 1.2, sill: 1.0, kind: 'win', win: 'glass' }], w: [{ at: 0, w: 1.4, h: 1.2, sill: 1.0, kind: 'win', win: 'glass' }] };
    r.doors.push({ side: 's', at: w / 2 - 0.8, w: 0.9 });
    for (const s of ['e', 'w']) r.wins.push({ side: s, at: 0, w: 1.4 });
    slab(-w / 2 + T, -d / 2 + T, w / 2 - T, d / 2 - T, G0, { top: 0xb8b0a0, topTx: TX.ceramic, thk: G0 + 0.05, bot: false, dimTop: DIM_IN });
    extWalls(w, d, T, G0, H0, [r], { col: 0xe8e4dc, ops, plinth: 0.4, plinthCol: 0x5a6a5a });
    furnish(r);
    slab(-w / 2 - 0.4, -d / 2 - 0.4, w / 2 + 0.4, d / 2 + 0.4, G0 + H0 + 0.25, { top: 0x8a8e92, topTx: TX.metal, bot: 0xe8e8e4, thk: 0.25 });
    W.scope({ lod: 1 }, () => { W.box(0.3, 0.4, 0.3, w / 2 + 0.2, G0 + H0, d / 2 + 0.2, 0x3a3a3a, { layer: 'metal' }); W.box(0.1, 0.1, 0.2, w / 2 + 0.2, G0 + H0 - 0.25, d / 2 + 0.4, 0x2a2a2a, { layer: 'metal' }); });
  });
}
