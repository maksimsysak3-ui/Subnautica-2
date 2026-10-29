// =====================================================================
//  CITY — modular architecture kit
// =====================================================================
// All parts work in the current W frame (a building pushes its own frame: origin at the
// footprint centre on the ground, local +Z = street front). Walls are axis-aligned in that frame.
// Every visible solid gets a matching collider, so what you see is what you bump into and shoot.
const MC = {
  plaster: 0xd8c29c, plasterLt: 0xe7d8ba, ochre: 0xd09a63, ochreDk: 0xb27c4b, rose: 0xd3937a, roseDk: 0xb9785f, terracotta: 0xbd7150,
  sandstone: 0xcdb085, stone: 0xb9a586, pise: 0xb98b62, whitewash: 0xece7dc, cream: 0xe4d6b8, sky: 0x86acd8, blue: 0x4a79b4, blueDk: 0x2c4f86,
  green: 0x2e6a4d, greenDk: 0x1f4a36, tile: 0x2c6c4a, cedar: 0x8b5b35, cedarDk: 0x5b3a20, cedarLt: 0xa6744a, iron: 0x242528, ironRust: 0x4b3527,
  brass: 0xc0973f, concrete: 0xaaa59b, concreteDk: 0x86827a, concreteLt: 0xc2beb4, asphalt: 0x3e3f41, curb: 0xb5b0a5, paving: 0xb7a689,
  cobble: 0xb39c7c, glassDk: 0x2a3640, alu: 0xb9bdc2, ceiling: 0xe9e3d6, floorTerr: 0xbdb3a2, floorWood: 0x8a6440, roofGravel: 0xa59a88,
  paint: [0xe9e2d2, 0xdcd3be, 0xd9e2dc, 0xe6d6c2, 0xcfd8e2, 0xe3cfb7, 0xd5c7a6], exterior: [0xd8c29c, 0xd09a63, 0xd3937a, 0xe4d6b8, 0xcdb085, 0xbd7150, 0xe7d8ba],
};
const FH = 3.2;           // residential floor-to-floor height
const DIM_IN = 0.5;       // interior albedo factor: rooms get far less skylight than the street
const ST_RISE = 0.18, ST_RUN = 0.29; // stair riser / tread

// ---------------- wall with openings ----------------
// ax 'x': runs along local x from a0 to a1 at z = c; ax 'z': runs along local z at x = c.
// side (+1/-1): which face is the exterior (towards +c or −c). sp: {col, tx, wear, inCol, inTx, ops, solid, mat, skirt, plinth}
// op: {at, w, h, sill, kind:'door'|'win'|'shop'|'gap'|'arch'|'archdoor'|'archwin', arch:'round'|'horse'|'point', leaf, style, win, ...}
function wallBox(ax, c, u0, u1, v0, v1, n0, n1, col, o) {
  if (u1 - u0 < 1e-3 || v1 - v0 < 1e-3) return;
  if (ax === 'x') W.box(u1 - u0, v1 - v0, n1 - n0, (u0 + u1) / 2, (v0 + v1) / 2, c + (n0 + n1) / 2, col, o);
  else W.box(n1 - n0, v1 - v0, u1 - u0, c + (n0 + n1) / 2, (v0 + v1) / 2, (u0 + u1) / 2, col, o);
}
function wallSolid(ax, c, u0, u1, v0, v1, T, mat) {
  if (u1 - u0 < 1e-3 || v1 - v0 < 1e-3) return;
  if (ax === 'x') W.solid(u1 - u0, v1 - v0, T, (u0 + u1) / 2, (v0 + v1) / 2, c, mat);
  else W.solid(T, v1 - v0, u1 - u0, c, (v0 + v1) / 2, (u0 + u1) / 2, mat);
}
// arch profile: height of the intrados above the spring line at offset dx from the centre
function archRise(kind, w) { return kind === 'point' ? w * 0.755 : kind === 'horse' ? w * 0.779 : w * 0.5; }
function archY(kind, dx, w) {
  const r = w / 2, x = Math.min(Math.abs(dx), r);
  if (kind === 'point') { const R = w * 0.82, cx = R - r; return Math.sqrt(Math.max(0, R * R - (x + cx) ** 2)); }
  if (kind === 'horse') { const R = r * 1.1, c = Math.sqrt(R * R - r * r); return c + Math.sqrt(Math.max(0, R * R - x * x)); }
  return Math.sqrt(Math.max(0, r * r - x * x));
}
function wall(ax, a0, a1, c, y0, H, T, sp = {}) {
  const col = sp.col ?? MC.plaster, tx = sp.tx ?? TX.plaster, wear = sp.wear ?? 3;
  const side = sp.side ?? 1;
  const two = sp.inCol !== undefined;
  const halves = two ? [[side > 0 ? 0 : -T / 2, side > 0 ? T / 2 : 0, col, tx, wear, sp.dimOut ?? 1], [side > 0 ? -T / 2 : 0, side > 0 ? 0 : T / 2, sp.inCol, sp.inTx ?? TX.plaster, sp.inWear ?? 1, sp.dimIn ?? DIM_IN]] : [[-T / 2, T / 2, col, tx, wear, sp.dim ?? 1]];
  const mat = sp.mat ?? 'plaster', solid = sp.solid !== false;
  const piece = (u0, u1, v0, v1) => {
    for (const [n0, n1, cc, tt, ww, dm] of halves) wallBox(ax, c, u0, u1, v0, v1, n0, n1, cc, { t: tt, wear: ww, ground: sp.ground ?? y0, dim: dm });
    if (solid) wallSolid(ax, c, u0, u1, v0, v1, T, mat);
  };
  const ops = (sp.ops || []).filter((o) => o.w > 0).sort((p, q) => p.at - q.at);
  let cur = a0;
  for (const op of ops) {
    const L = Math.max(a0, op.at - op.w / 2), R = Math.min(a1, op.at + op.w / 2);
    if (R - L < 0.05) continue;
    piece(cur, L, y0, y0 + H);
    const sill = op.sill ?? 0, h = Math.min(op.h ?? 2.1, H - sill);
    if (sill > 0) piece(L, R, y0, y0 + sill);
    const isArch = op.kind === 'arch' || op.kind === 'archdoor' || op.kind === 'archwin';
    if (isArch) {
      const kind = op.arch || 'horse', w = R - L, rise = archRise(kind, w), spring = y0 + sill + h - rise;
      const n = Math.max(5, Math.round(w / 0.14));
      for (let i = 0; i < n; i++) {
        const u0 = L + (i / n) * w, u1 = L + ((i + 1) / n) * w, uc = (u0 + u1) / 2;
        const top = spring + archY(kind, uc - (L + R) / 2, w);
        piece(u0, u1, Math.min(top, y0 + H), y0 + H);
      }
      op._spring = spring - y0; op._rise = rise;
    } else if (sill + h < H) piece(L, R, y0 + sill + h, y0 + H);
    cur = R;
  }
  piece(cur, a1, y0, y0 + H);
  // openings: frames, leaves, glass, grilles…
  for (const op of ops) opening(ax, c, side, y0, T, op, sp);
  // exterior plinth band (rising damp + scuffs) and interior skirting
  if (sp.plinth) {
    const pn = side > 0 ? [T / 2, T / 2 + 0.03] : [-T / 2 - 0.03, -T / 2];
    let u = a0;
    for (const op of ops.filter((o) => (o.sill ?? 0) < 0.1)) { wallBox(ax, c, u, op.at - op.w / 2, y0, y0 + sp.plinth, pn[0], pn[1], sp.plinthCol ?? shade(col, 0.82), { t: sp.plinthTx ?? TX.plaster, wear: 6 }); u = op.at + op.w / 2; }
    wallBox(ax, c, u, a1, y0, y0 + sp.plinth, pn[0], pn[1], sp.plinthCol ?? shade(col, 0.82), { t: sp.plinthTx ?? TX.plaster, wear: 6 });
  }
}
// hex colour × factor
function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return c.getHex(); }
function mixHex(a, b, t) { return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex(); }

// decorations for one opening, built in an opening-local frame: x along the wall, +z out of the exterior face
function opening(ax, c, side, y0, T, op, sp) {
  const ry = ax === 'x' ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
  const px = ax === 'x' ? op.at : c, pz = ax === 'x' ? c : op.at;
  const w = op.w, sill = op.sill ?? 0, h = op.h ?? 2.1, ext = T / 2;
  const kind = op.kind;
  W.push(px, y0, pz, ry);
  const frameCol = op.frameCol ?? MC.cedarDk;
  if (kind === 'door' || kind === 'archdoor') {
    const leafH = kind === 'archdoor' ? (op._spring ?? h) - sill : h;
    // threshold + frame
    W.box(w + 0.02, 0.04, T + 0.02, 0, sill + 0.02, 0, MC.stone, { t: TX.stone, wear: 5 });
    for (const s of [-1, 1]) W.box(0.08, leafH, 0.12, s * (w / 2 - 0.04), sill + leafH / 2, ext - 0.12, frameCol, { t: TX.wood, lod: 1 });
    if (kind === 'door') W.box(w, 0.1, 0.12, 0, sill + h - 0.05, ext - 0.12, frameCol, { t: TX.wood, lod: 1 });
    // open leaves fold flat against the inside face of the wall; ajar ones stand in the reveal
    const zh = (op.leaf ?? 'open') === 'open' ? -(ext + 0.04) : ext - 0.18;
    doorLeaf(w - 0.16, leafH - 0.06, sill, op.flip ? -zh : zh, op);
    if (kind === 'archdoor') archTympanum(w, op, ext);
    if (op.hood) doorHood(w, sill + h, ext, op.hood);
    if (op.lamp) { wallLantern(w / 2 + 0.35, sill + Math.min(h, 2.3) + 0.15, ext, op.lamp); }
  } else if (kind === 'shop') {
    W.box(w, 0.04, T, 0, sill + 0.02, 0, MC.stone, { t: TX.stone, wear: 6 });
    const style = op.style || 'roll';
    if (style === 'roll') {
      W.cyl(0.17, 0.17, w, 0, sill + h - 0.17, ext + 0.05, MC.alu, { rz: Math.PI / 2, seg: 8, layer: 'metal', t: TX.metal, wear: 5, lod: 1 });
      for (const s of [-1, 1]) W.box(0.06, h, 0.06, s * (w / 2 - 0.03), sill + h / 2, ext + 0.02, MC.alu, { layer: 'metal', lod: 1 });
      if (op.leaf === 'closed') { W.box(w - 0.08, h - 0.3, 0.04, 0, sill + (h - 0.3) / 2, ext + 0.02, op.shutCol ?? MC.alu, { layer: 'metal', t: TX.corrugated, wear: 6 }); W.solid(w, h, 0.1, 0, sill + h / 2, ext, 'metal'); W.box(0.08, 0.1, 0.05, 0, sill + 0.2, ext + 0.06, MC.brass, { layer: 'metal' }); }
    } else if (style === 'glass') {
      for (const s of [-1, 1]) W.box(0.07, h, 0.08, s * (w / 2 - 0.035), sill + h / 2, ext - 0.06, MC.iron, { layer: 'metal', lod: 1 });
      W.box(w, 0.08, 0.08, 0, sill + h - 0.04, ext - 0.06, MC.iron, { layer: 'metal', lod: 1 });
      // glazed front with a door in the middle third, left open
      const dw = Math.min(1.0, w * 0.34), gw = (w - dw) / 2 - 0.07;
      for (const s of [-1, 1]) {
        W.box(gw, h - 0.5, 0.02, s * (dw / 2 + gw / 2), sill + 0.42 + (h - 0.5) / 2, ext - 0.06, PC.glass, { layer: 'glass' });
        W.box(gw, 0.4, 0.08, s * (dw / 2 + gw / 2), sill + 0.2, ext - 0.06, MC.iron, { layer: 'metal' });
        W.solid(gw, h, 0.08, s * (dw / 2 + gw / 2), sill + h / 2, ext - 0.06, 'glass');
      }
      W.push(-dw / 2, sill, ext - 0.06, 1.4); W.box(dw - 0.04, h - 0.1, 0.03, dw / 2, (h - 0.1) / 2, 0, PC.glass, { layer: 'glass' }); W.box(dw - 0.04, 0.06, 0.04, dw / 2, h - 0.12, 0, MC.iron, { layer: 'metal' }); W.box(0.05, h - 0.1, 0.04, dw - 0.04, (h - 0.1) / 2, 0, MC.iron, { layer: 'metal' }); W.pop();
    }
    if (op.awning) awning(w + 0.4, sill + h + 0.25, ext, op.awning);
  } else if (kind === 'win' || kind === 'archwin') {
    const style = op.win || 'grille';
    const top = kind === 'archwin' ? (op._spring ?? h) : h;
    // projecting stone sill + slim frame
    W.box(w + 0.16, 0.06, 0.1, 0, sill - 0.03, ext + 0.03, op.sillCol ?? MC.stone, { t: TX.stone, wear: 4 });
    if (style === 'dark') { W.box(w, top, 0.03, 0, sill + top / 2, ext - 0.12, MC.glassDk, { layer: 'metal' }); W.box(w, 0.05, 0.05, 0, sill + top / 2, ext - 0.1, MC.alu, { layer: 'metal', lod: 1 }); }
    else {
      W.box(w, 0.05, 0.06, 0, sill + 0.025, ext - 0.12, frameCol, { lod: 1, t: TX.wood });
      W.box(w, 0.05, 0.06, 0, sill + top - 0.025, ext - 0.12, frameCol, { lod: 1, t: TX.wood });
      for (const s of [-1, 1]) W.box(0.05, top, 0.06, s * (w / 2 - 0.025), sill + top / 2, ext - 0.12, frameCol, { lod: 1, t: TX.wood });
      W.box(0.04, top, 0.05, 0, sill + top / 2, ext - 0.12, frameCol, { lod: 1, t: TX.wood });
      if (style !== 'open') W.box(w - 0.08, top - 0.08, 0.01, 0, sill + top / 2, ext - 0.12, PC.glass, { layer: 'glass' });
      W.solid(w, top, 0.06, 0, sill + top / 2, ext - 0.12, 'glass');
    }
    if (style === 'grille' || op.grille) ironGrille(w, sill, top, ext + 0.0, true);
    if (style === 'shut' || style === 'shutclosed') shutters(w, sill, top, ext, style === 'shutclosed', op.shutCol ?? MC.green);
    if (style === 'mash') mashrabiya(w, sill, top, ext, op.mashCol ?? MC.cedar);
    if (kind === 'archwin') archTympanum(w, op, ext, true);
    if (op.box) flowerBox(w, sill, ext);
  } else if (kind === 'arch') {
    // archway passage: a moulded rim on the face
    W.box(w + 0.02, 0.03, T + 0.02, 0, sill + 0.015, 0, MC.stone, { t: TX.stone, wear: 6 });
  }
  if ((kind === 'arch' || kind === 'archdoor' || kind === 'archwin') && op._rise) archRim(w, sill + op._spring, op._rise, op.arch || 'horse', ext, op.rimCol ?? MC.cream, op.rimTx ?? TX.gebs, op.zellige);
  W.pop();
}
// moulded arch surround on the exterior face (+ optional zellige spandrels)
function archRim(w, spring, rise, kind, ext, col, tx, zel) {
  const n = 14, th = 0.16;
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const t = i / n, dx = (t - 0.5) * (w + th * 0.6);
    const y = spring + archY(kind, dx, w + th * 0.6) + th * 0.3;
    if (prev) { const mx = (prev[0] + dx) / 2, my = (prev[1] + y) / 2, L = Math.hypot(dx - prev[0], y - prev[1]); W.box(L + 0.02, th, 0.05, mx, my, ext + 0.025, col, { rz: Math.atan2(y - prev[1], dx - prev[0]), t: tx, wear: 2, lod: 1 }); }
    prev = [dx, y];
  }
  for (const s of [-1, 1]) W.box(th, spring, 0.05, s * (w / 2 + th / 2), spring / 2, ext + 0.025, col, { t: tx, wear: 3, lod: 1 });
  if (zel !== undefined) { // rectangular alfiz frame with tiled spandrels
    const top = spring + rise + 0.35;
    for (const s of [-1, 1]) W.box(0.12, top - spring + 0.15, 0.04, s * (w / 2 + 0.32), spring + (top - spring) / 2, ext + 0.02, 0xffffff, { t: TX.zellige, wear: zel, lod: 1 });
    W.box(w + 0.76, 0.14, 0.04, 0, top, ext + 0.02, 0xffffff, { t: TX.zellige, wear: zel, lod: 1 });
  }
}
function archTympanum(w, op, ext, glass = false) {
  const kind = op.arch || 'horse', sp = op._spring ?? 2, rise = op._rise ?? w / 2, n = 8;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n - 0.5, dx = u * w, top = archY(kind, dx, w);
    if (top < 0.02) continue;
    W.box(w / n, top, 0.04, dx, (op.sill ?? 0) + sp + top / 2, ext - 0.2, glass ? 0x6f8fa8 : MC.cedar, { t: glass ? TX.none : TX.carved, layer: glass ? 'glass' : 'solid', lod: 1 });
  }
  void rise;
}
// door leaves: carved cedar (studded), plank, painted steel, glass; open/ajar/closed
function doorLeaf(w, h, y, z, op) {
  const state = op.leaf ?? 'open', style = op.style ?? 'plank';
  const col = op.doorCol ?? (style === 'carved' ? MC.cedar : style === 'metal' ? mpick([MC.blue, MC.green, 0x7a3a2a, 0x3a4048]) : style === 'plank' ? MC.cedarLt : MC.alu);
  const ang = (state === 'open' ? 2.98 : state === 'ajar' ? 1.45 : 0) * (op.flip ? -1 : 1);
  if (state === 'none') return;
  const dbl = op.double && w > 1.3;
  const leaves = dbl ? [[-w / 2, w / 2, 1], [w / 2, w / 2, -1]] : [[-w / 2, w, 1]];
  for (const [hx, lw, dir] of leaves) {
    W.push(hx, y, z, dir * ang);
    const cx = dir * lw / 2;
    if (style === 'glass') {
      W.box(lw, h, 0.05, cx, h / 2, 0, MC.alu, { layer: 'metal', lod: 1 });
      W.box(lw - 0.12, h - 0.2, 0.01, cx, h / 2 + 0.03, 0.03, PC.glass, { layer: 'glass' });
    } else {
      W.box(lw, h, 0.06, cx, h / 2, 0, col, { t: style === 'carved' ? TX.carved : style === 'metal' ? TX.metal : TX.wood, wear: 4, layer: style === 'metal' ? 'metal' : 'solid' });
      if (style === 'carved') {
        // framing stiles, studs and a ring knocker
        for (const s of [-1, 1]) W.box(0.07, h, 0.02, cx + s * (lw / 2 - 0.035), h / 2, 0.035, shade(col, 0.8), { t: TX.wood, lod: 1 });
        for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) W.box(0.025, 0.025, 0.02, cx + (k - 1) * lw * 0.3, 0.3 + r * (h - 0.6) / 4, 0.04, MC.brass, { layer: 'metal', lod: 2 });
        W.torus(0.05, 0.012, cx + dir * lw * 0.3, h * 0.55, 0.05, MC.brass, { layer: 'metal', seg: 8, lod: 2 });
      } else if (style === 'plank') {
        for (const yy of [0.25, h - 0.3]) W.box(lw - 0.06, 0.1, 0.02, cx, yy, 0.035, shade(col, 0.85), { t: TX.wood, lod: 1 });
      } else if (style === 'metal') {
        for (const yy of [h * 0.3, h * 0.72]) W.box(lw - 0.12, 0.5, 0.01, cx, yy, 0.035, shade(col, 0.9), { layer: 'metal', t: TX.metal, wear: 4, lod: 1 });
      }
      W.box(0.03, 0.14, 0.05, cx + dir * (lw / 2 - 0.12), 1.0 - y * 0, 0.05, MC.brass, { layer: 'metal', lod: 2 });
    }
    W.solid(lw, h, 0.07, cx, h / 2, 0, style === 'metal' || style === 'glass' ? 'metal' : 'wood');
    W.pop();
  }
}
// tiled canopy over a doorway (green glazed tiles on carved cedar brackets)
function doorHood(w, y, ext, col = MC.tile) {
  W.box(w + 0.7, 0.08, 0.62, 0, y + 0.18, ext + 0.31, MC.cedar, { t: TX.carved, lod: 1 });
  W.box(w + 0.8, 0.05, 0.75, 0, y + 0.36, ext + 0.32, col === true ? MC.tile : col, { rx: -0.42, t: TX.rooftile, wear: 1, lod: 1 });
  W.box(w + 0.82, 0.08, 0.1, 0, y + 0.46, ext + 0.04, MC.cedarDk, { lod: 1 });
  for (const s of [-1, 1]) W.box(0.07, 0.28, 0.5, s * (w / 2 + 0.25), y + 0.03, ext + 0.25, MC.cedarDk, { t: TX.carved, lod: 1 });
}
// forged iron grille with a scrolled crest
function ironGrille(w, sill, h, z, fancy = false) {
  const n = Math.max(2, Math.round(w / (fancy ? 0.12 : 0.17)));
  for (let i = 1; i < n; i++) W.box(0.02, h, 0.02, -w / 2 + (i / n) * w, sill + h / 2, z + 0.03, MC.iron, { layer: 'metal', lod: 1 });
  for (const yy of fancy ? [0.08, h * 0.5, h - 0.08] : [0.1, h - 0.1]) W.box(w, 0.025, 0.025, 0, sill + yy, z + 0.035, MC.iron, { layer: 'metal', lod: 1 });
  if (fancy) for (let i = 0; i < n - 1; i += 2) W.torus(0.05, 0.008, -w / 2 + ((i + 1) / n) * w + 0.06, sill + h * 0.5 + 0.06, z + 0.04, MC.iron, { layer: 'metal', seg: 8, lod: 2 });
  W.solid(w, h, 0.05, 0, sill + h / 2, z + 0.03, 'metal');
}
function shutters(w, sill, h, ext, closed, col) {
  for (const s of [-1, 1]) {
    W.push(s * w / 2, sill, ext + 0.02, closed ? 0 : s * -1.72);
    W.box(w / 2, h, 0.04, -s * w / 4, h / 2, 0, col, { t: TX.louver, wear: 5, lod: 1 });
    W.pop();
  }
}
function mashrabiya(w, sill, h, ext, col) {
  // projecting turned-wood oriel screen
  W.box(w + 0.2, 0.08, 0.42, 0, sill - 0.04, ext + 0.2, col, { t: TX.wood, lod: 1 });
  W.box(w + 0.2, 0.08, 0.42, 0, sill + h + 0.04, ext + 0.2, col, { t: TX.wood, lod: 1 });
  W.box(w, h, 0.03, 0, sill + h / 2, ext + 0.4, shade(col, 1.1), { t: TX.carved, lod: 1 });
  for (const s of [-1, 1]) W.box(0.03, h, 0.4, s * (w / 2 + 0.08), sill + h / 2, ext + 0.2, shade(col, 1.1), { t: TX.carved, lod: 1 });
  W.box(w + 0.3, 0.18, 0.5, 0, sill + h + 0.15, ext + 0.24, MC.tile, { rx: -0.3, t: TX.rooftile, lod: 1 });
  W.solid(w + 0.2, h, 0.42, 0, sill + h / 2, ext + 0.2, 'wood');
}
function flowerBox(w, sill, ext) {
  W.box(w * 0.9, 0.18, 0.22, 0, sill + 0.09, ext + 0.12, MC.terracotta, { lod: 1 });
  for (let i = 0; i < 5; i++) W.sphere(0.16, 0.14, 0.16, -w * 0.38 + i * w * 0.19, sill + 0.24, ext + 0.12, mpick([0x3e6a2e, 0x4f7a34, 0xb0304a, 0xd05a8a]), { seg: 5, hseg: 3, lod: 2, t: TX.leaf });
}
// fabric awning on a light frame, sloping out from the wall
function awning(w, y, ext, col) {
  const c = Array.isArray(col) ? col : [col, col];
  W.push(0, y, ext, 0, 0.32);
  W.box(w, 0.025, 1.3, 0, 0, 0.65, c[0], { layer: 'cloth', t: TX.fabric, wear: c[1] !== c[0] ? 5 : 1, lod: 1 });
  for (let i = 0; i < Math.round(w / 0.35); i++) W.box(0.17, 0.22, 0.02, -w / 2 + 0.17 + i * 0.35, -0.11, 1.3, i % 2 ? c[1] : c[0], { layer: 'cloth', lod: 2, t: TX.fabric });
  W.pop();
  for (const s of [-1, 1]) W.rod([s * w / 2, y, ext], [s * w / 2, y - 0.45, ext + 1.2], 0.012, MC.iron, { layer: 'metal', lod: 2 });
}
// brass lantern on a wall bracket, lit
function wallLantern(x, y, ext, col = 0xffc070) {
  W.box(0.04, 0.04, 0.3, x, y + 0.3, ext + 0.15, MC.iron, { layer: 'metal', lod: 1 });
  W.box(0.16, 0.26, 0.16, x, y + 0.08, ext + 0.3, MC.brass, { layer: 'metal', lod: 1, t: TX.gebs });
  W.box(0.11, 0.2, 0.11, x, y + 0.08, ext + 0.3, col === true ? 0xffc070 : col, { layer: 'glow', lod: 1 });
  W.cone(0.12, 0.12, x, y + 0.27, ext + 0.3, MC.brass, { seg: 4, layer: 'metal', lod: 1 });
  W.lamp(x, y + 0.05, ext + 0.4, col === true ? 0xffc070 : col, 3.5, 7, { halo: 0.35 });
}

// ---------------- floors, ceilings, slabs with holes ----------------
// subtract rectangular holes from a rect: returns covering rects
function rectMinus(x0, z0, x1, z1, holes) {
  const xs = [x0, x1];
  for (const h of holes) { if (h[0] > x0 && h[0] < x1) xs.push(h[0]); if (h[2] > x0 && h[2] < x1) xs.push(h[2]); }
  xs.sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1]; if (b - a < 1e-3) continue;
    const mid = (a + b) / 2;
    const cuts = holes.filter((h) => mid > h[0] && mid < h[2]).map((h) => [Math.max(z0, h[1]), Math.min(z1, h[3])]).filter((s) => s[1] > s[0]).sort((p, q) => p[0] - q[0]);
    let z = z0;
    for (const [c0, c1] of cuts) { if (c0 > z + 1e-3) out.push([a, z, b, c0]); z = Math.max(z, c1); }
    if (z1 > z + 1e-3) out.push([a, z, b, z1]);
  }
  // merge vertically-adjacent columns with identical z spans
  const merged = [];
  for (const r of out) {
    const m = merged.find((q) => Math.abs(q[2] - r[0]) < 1e-6 && Math.abs(q[1] - r[1]) < 1e-6 && Math.abs(q[3] - r[3]) < 1e-6);
    if (m) m[2] = r[2]; else merged.push([...r]);
  }
  return merged;
}
// slab: top surface at y. sp: {thk, top, topTx, topWear, bot, botTx, holes:[[x0,z0,x1,z1]], solid}
function slab(x0, z0, x1, z1, y, sp = {}) {
  const thk = sp.thk ?? 0.22, fin = sp.fin ?? 0.03;
  for (const [a, b, c, d] of rectMinus(x0, z0, x1, z1, sp.holes || [])) {
    const w = c - a, dd = d - b, cx = (a + c) / 2, cz = (b + d) / 2;
    W.box(w, fin, dd, cx, y - fin / 2, cz, sp.top ?? MC.floorTerr, { t: sp.topTx ?? TX.terrazzo, wear: sp.topWear ?? 2, ao: false, jit: 0.02, dim: sp.dimTop ?? 1 });
    if (sp.bot !== false) W.box(w, thk - fin, dd, cx, y - fin - (thk - fin) / 2, cz, sp.bot ?? MC.ceiling, { t: sp.botTx ?? TX.plaster, wear: 1, ao: false, jit: 0.02, dim: sp.dimBot ?? 1 });
    if (sp.solid !== false) W.solid(w, thk, dd, cx, y - thk / 2, cz, sp.mat ?? 'concrete', { walk: true });
  }
}

// ---------------- stairs ----------------
// straight flight in the local frame: starts at (x,z) at height y0, climbs to y1 heading along dir (unit axis vector [dx,dz]), width w
// steps are thick treads (not solid blocks) so flights can stack above each other with headroom
function flight(x, z, dir, w, y0, y1, sp = {}) {
  const n = Math.max(1, Math.round((y1 - y0) / ST_RISE)), rise = (y1 - y0) / n, run = sp.run ?? ST_RUN;
  const [dx, dz] = dir;
  const col = sp.col ?? MC.stone, tx = sp.tx ?? TX.terrazzo;
  for (let i = 0; i < n; i++) {
    const top = y0 + rise * (i + 1), bot = Math.max(y0, top - (sp.thick ?? 0.32));
    const cx = x + dx * (i + 0.5) * run, cz = z + dz * (i + 0.5) * run;
    const bw = dx ? run : w, bd = dx ? w : run;
    W.box(bw, top - bot, bd, cx, (top + bot) / 2, cz, col, { t: tx, wear: 3, ao: false, jit: 0.02 });
    if (sp.riser) W.box(dx ? 0.012 : w, rise * 0.92, dx ? w : 0.012, cx - dx * run / 2 - dx * 0.006, top - rise / 2, cz - dz * run / 2 - dz * 0.006, 0xffffff, { t: TX.zellige, wear: sp.riser, lod: 2, ao: false });
    W.solid(bw, top - bot, bd, cx, (top + bot) / 2, cz, 'concrete', { walk: true });
  }
  // sloped soffit under the flight
  if (sp.soffit !== false && y1 - y0 > 0.8) {
    const L = n * run, ang = Math.atan2(y1 - y0, L);
    const mx = x + dx * L / 2, mz = z + dz * L / 2, my = (y0 + y1) / 2 - 0.36;
    if (dx) W.box(L / Math.cos(ang), 0.06, w, mx, my, mz, MC.ceiling, { rz: dx > 0 ? ang : -ang, t: TX.plaster, lod: 1 });
    else W.box(w, 0.06, L / Math.cos(ang), mx, my, mz, MC.ceiling, { rx: dz > 0 ? -ang : ang, t: TX.plaster, lod: 1 });
  }
  return { len: n * run, end: [x + dx * n * run, z + dz * n * run] };
}
// U-turn stair core inside rect (x0..x0+w, zf..zb); entry/arrival landings at the front (zf side).
// front landing depth lf; climbs from y0 to y1. Returns the slab hole to cut in the floor above.
function uStair(x0, zf, zb, w, y0, y1, sp = {}) {
  const lf = sp.lf ?? 1.2, fw = (w - 0.12) / 2, dirz = zb > zf ? 1 : -1;
  const half = (y1 - y0) / 2;
  const n = Math.round(half / ST_RISE), run = Math.min(ST_RUN, (Math.abs(zb - zf) - lf - 1.1) / n);
  const zs = zf + dirz * lf;
  flight(x0 + fw / 2, zs, [0, dirz], fw, y0, y0 + half, { ...sp, run });
  const zl0 = zs + dirz * n * run, zl1 = zb;
  slab(x0, Math.min(zl0, zl1), x0 + w, Math.max(zl0, zl1), y0 + half, { top: sp.col ?? MC.stone, topTx: sp.tx ?? TX.terrazzo, thk: 0.3, bot: MC.ceiling });
  flight(x0 + w - fw / 2, zl0, [0, -dirz], fw, y0 + half, y1, { ...sp, run });
  // masonry spine between the flights, full storey height, with a handrail along each flight
  const zmin = Math.min(zs, zl0), zmax = Math.max(zs, zl0);
  W.box(0.12, y1 - y0 + 0.95, zmax - zmin, x0 + w / 2, (y0 + y1 + 0.95) / 2, (zmin + zmax) / 2, sp.wallCol ?? MC.plasterLt, { t: TX.plaster, wear: 2 });
  W.solid(0.12, y1 - y0 + 0.95, zmax - zmin, x0 + w / 2, (y0 + y1 + 0.95) / 2, (zmin + zmax) / 2, 'plaster');
  for (const s of [-1, 1]) railLine([[x0 + w / 2 + s * 0.08, y0 + (s < 0 ? 0.9 : half + 0.9), s < 0 ? zs : zl0], [x0 + w / 2 + s * 0.08, y0 + (s < 0 ? half + 0.9 : 2 * half + 0.9), s < 0 ? zl0 : zs]], MC.cedarDk, true);
  return [x0, Math.min(zs, zb), x0 + w, Math.max(zs, zb)];
}
// sloping or level handrail through 3D points (balusters every ~0.35 m)
function railLine(pts, col = MC.iron, noBalusters = false) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    W.rod(a, b, 0.022, col, { layer: 'metal', lod: 1 });
    if (noBalusters) continue;
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(1, Math.round(L / 0.35));
    for (let k = 0; k <= n; k++) { const t = k / n, p = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; W.rod(p, [p[0], p[1] - 0.9, p[2]], 0.01, col, { layer: 'metal', lod: 2 }); }
  }
}
// level railing / balustrade between two floor points; style: iron | wood | concrete | pipe | mash
function railing(x0, z0, x1, z1, y, style = 'iron', col) {
  const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0);
  W.push((x0 + x1) / 2, y, (z0 + z1) / 2, ry);
  if (style === 'concrete') { W.box(L, 1.0, 0.16, 0, 0.5, 0, col ?? MC.plaster, { t: TX.plaster, wear: 3 }); W.box(L + 0.06, 0.07, 0.24, 0, 1.03, 0, MC.stone, { t: TX.stone }); }
  else if (style === 'pipe') { for (const h of [0.5, 1.05]) W.box(L, 0.05, 0.05, 0, h, 0, col ?? 0xc8a020, { layer: 'metal', t: TX.metal, wear: 4 }); for (let i = 0; i <= Math.round(L / 1.5); i++) W.box(0.05, 1.05, 0.05, -L / 2 + i * (L / Math.max(1, Math.round(L / 1.5))), 0.52, 0, col ?? 0xc8a020, { layer: 'metal' }); }
  else if (style === 'mash') { W.box(L, 0.95, 0.05, 0, 0.5, 0, col ?? MC.cedar, { t: TX.carved, lod: 1 }); W.box(L, 0.08, 0.1, 0, 1.0, 0, shade(col ?? MC.cedar, 0.8), { t: TX.wood }); }
  else {
    const c = col ?? (style === 'wood' ? MC.cedar : MC.iron), layer = style === 'wood' ? 'solid' : 'metal';
    W.box(L, style === 'wood' ? 0.08 : 0.04, style === 'wood' ? 0.1 : 0.04, 0, 1.0, 0, c, { layer, t: style === 'wood' ? TX.wood : TX.metal });
    W.box(L, 0.03, 0.03, 0, 0.12, 0, c, { layer, lod: 1 });
    const n = Math.max(2, Math.round(L / (style === 'wood' ? 0.22 : 0.13)));
    for (let i = 0; i <= n; i++) W.box(style === 'wood' ? 0.05 : 0.016, 0.88, style === 'wood' ? 0.05 : 0.016, -L / 2 + (i / n) * L, 0.56, 0, c, { layer, lod: 2 });
    if (style === 'iron') for (let i = 0; i < n; i += 3) W.torus(0.07, 0.008, -L / 2 + ((i + 1.5) / n) * L, 0.75, 0, c, { layer: 'metal', seg: 8, lod: 2 });
  }
  W.solid(L, 1.05, 0.12, 0, 0.52, 0, style === 'concrete' ? 'plaster' : 'metal');
  W.pop();
}

// ---------------- roofs ----------------
// parapet around a rectangle; style: plain | merlon (stepped crenellations) | rail | low; gaps: [{side:'n|s|e|w', at, w}]
function parapet(x0, z0, x1, z1, y, sp = {}) {
  const h = sp.h ?? 1.0, T = sp.T ?? 0.25, col = sp.col ?? MC.plaster, style = sp.style ?? 'plain';
  const sides = { s: ['x', x0, x1, z1 - T / 2, 1], n: ['x', x0, x1, z0 + T / 2, -1], e: ['z', z0 + T, z1 - T, x1 - T / 2, 1], w: ['z', z0 + T, z1 - T, x0 + T / 2, -1] };
  for (const k in sides) {
    if (sp.skip && sp.skip.includes(k)) continue;
    const [ax, a0, a1, c, side] = sides[k];
    const ops = (sp.gaps || []).filter((g) => g.side === k).map((g) => ({ at: g.at, w: g.w, h: h + 1, kind: 'gap' }));
    if (style === 'rail') { railingRun(ax, a0, a1, c, y, ops); continue; }
    wall(ax, a0, a1, c, y, h, T, { col, tx: sp.tx ?? TX.plaster, wear: sp.wear ?? 4, side, ops });
    // coping + crenellations
    const L = a1 - a0;
    if (style === 'merlon') {
      const n = Math.floor(L / 0.9);
      for (let i = 0; i < n; i++) {
        const u = a0 + (i + 0.5) * (L / n);
        if (ops.some((g) => Math.abs(u - g.at) < g.w / 2 + 0.35)) continue;
        // stepped merlon: two tiers + pointed cap
        wallBox(ax, c, u - 0.24, u + 0.24, y + h, y + h + 0.35, -T / 2, T / 2, col, { t: TX.plaster, wear: 4, lod: 1 });
        wallBox(ax, c, u - 0.14, u + 0.14, y + h + 0.35, y + h + 0.6, -T / 2, T / 2, col, { t: TX.plaster, wear: 4, lod: 1 });
      }
    } else if (style !== 'low') {
      let cur = a0;
      for (const g of ops) { wallBox(ax, c, cur, g.at - g.w / 2, y + h, y + h + 0.06, -T / 2 - 0.04, T / 2 + 0.04, sp.cap ?? shade(col, 0.92), { t: TX.plaster, wear: 5, lod: 1 }); cur = g.at + g.w / 2; }
      wallBox(ax, c, cur, a1, y + h, y + h + 0.06, -T / 2 - 0.04, T / 2 + 0.04, sp.cap ?? shade(col, 0.92), { t: TX.plaster, wear: 5, lod: 1 });
    }
  }
}
function railingRun(ax, a0, a1, c, y, gaps) {
  let cur = a0;
  const seg = (u0, u1) => { if (u1 - u0 < 0.2) return; if (ax === 'x') railing(u0, c, u1, c, y, 'pipe', 0x9aa0a6); else railing(c, u0, c, u1, y, 'pipe', 0x9aa0a6); };
  for (const g of gaps.sort((p, q) => p.at - q.at)) { seg(cur, g.at - g.w / 2); cur = g.at + g.w / 2; }
  seg(cur, a1);
}
// green-tiled hipped roof (pyramid) over a rectangle at height y
function tileRoof(x, z, w, d, y, rise, col = MC.tile) {
  W.pyramid(w + 0.5, rise, d + 0.5, x, y + rise / 2, z, col, { t: TX.rooftile, wear: col === MC.terracotta ? 5 : 1 });
  W.box(w + 0.6, 0.18, d + 0.6, x, y + 0.02, z, MC.cedarDk, { t: TX.carved });
  W.cone(0.06, 0.5, x, y + rise + 0.2, z, MC.brass, { seg: 6, layer: 'metal', lod: 1 });
  W.sphere(0.12, 0.12, 0.12, x, y + rise + 0.05, z, MC.brass, { layer: 'metal', lod: 1, seg: 6, hseg: 4 });
  W.solid(w, rise * 0.6, d, x, y + rise * 0.3, z, 'clay');
}

// ---------------- rooftop & facade equipment ----------------
function acCondenser(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(0.8, 0.55, 0.3, 0, 0.28, 0, 0xd6d6d0, { layer: 'metal', t: TX.metal, wear: 4 });
  W.cyl(0.21, 0.21, 0.02, 0.12, 0.28, 0.155, 0x3a3a3a, { rx: Math.PI / 2, seg: 10, layer: 'metal', lod: 2 });
  for (let i = 0; i < 4; i++) W.box(0.4, 0.012, 0.012, 0.12, 0.12 + i * 0.11, 0.165, 0x5a5a5a, { layer: 'metal', lod: 2 });
  W.pop();
  W.solid(0.8, 0.55, 0.3, x, y + 0.28, z, 'metal', { ry });
}
function acWall(x, y, z, ry = 0) { // condenser on brackets with a drip stain
  W.push(x, y, z, ry);
  for (const s of [-1, 1]) W.box(0.04, 0.04, 0.42, s * 0.3, -0.02, 0.21, MC.iron, { layer: 'metal', lod: 2 });
  W.box(0.8, 0.55, 0.3, 0, 0.27, 0.2, 0xd8d6cf, { layer: 'metal', t: TX.metal, wear: 3, lod: 1 });
  W.cyl(0.2, 0.2, 0.02, 0.12, 0.27, 0.355, 0x3a3a3a, { rx: Math.PI / 2, seg: 10, layer: 'metal', lod: 2 });
  W.box(0.08, 1.2, 0.006, -0.25, -0.62, 0.003, 0x6a5a48, { ao: false, lod: 2, jit: 0.15 });
  W.pop();
}
function satDish(x, y, z, ry = 0, s = 1) {
  W.push(x, y, z, ry);
  W.box(0.05, 0.6 * s, 0.05, 0, 0.3 * s, 0, MC.iron, { layer: 'metal', lod: 1 });
  W.push(0, 0.7 * s, 0.05, 0, -0.5);
  W.cyl(0.42 * s, 0.38 * s, 0.08 * s, 0, 0, 0, 0xe8e6e0, { rx: Math.PI / 2, seg: 12, layer: 'metal', lod: 1, open: true });
  W.rod([0, 0, 0.05], [0, -0.05, 0.42 * s], 0.012, MC.iron, { layer: 'metal', lod: 2 });
  W.box(0.07, 0.07, 0.1, 0, -0.05, 0.45 * s, 0x2a2a2a, { lod: 2 });
  W.pop(); W.pop();
}
function waterTank(x, y, z, kind = mpick(['black', 'steel', 'white'])) {
  if (kind === 'steel') { for (const s of [-1, 1]) for (const t of [-1, 1]) W.box(0.06, 0.6, 0.06, x + s * 0.4, y + 0.3, z + t * 0.4, MC.iron, { layer: 'metal', lod: 1 }); W.cyl(0.5, 0.5, 1.2, x, y + 1.2, z, 0xb8bcc2, { rz: Math.PI / 2, seg: 12, layer: 'metal', t: TX.metal, wear: 5 }); }
  else { W.cyl(0.55, 0.6, 1.25, x, y + 0.63, z, kind === 'black' ? 0x1e1f22 : 0xe0ddd2, { seg: 12, t: TX.none }); W.cyl(0.32, 0.4, 0.12, x, y + 1.31, z, kind === 'black' ? 0x1e1f22 : 0xe0ddd2, { seg: 12 }); W.rod([x + 0.5, y + 0.3, z], [x + 0.9, y + 0.05, z + 0.5], 0.02, 0x9a9a9a, { lod: 2 }); }
  W.solid(1.2, 1.5, 1.2, x, y + 0.75, z, 'metal');
}
function antenna(x, y, z) {
  W.rod([x, y, z], [x, y + 2.6, z], 0.02, MC.alu, { layer: 'metal', lod: 1, seg: 4 });
  for (let i = 0; i < 3; i++) W.box(0.8 - i * 0.15, 0.015, 0.015, x, y + 2.2 - i * 0.12, z, MC.alu, { layer: 'metal', lod: 1 });
  W.cable([x, y + 2.4, z], [x + mr(-2, 2), y, z + mr(-2, 2)], 0.3, 0.004, 0x1a1a1a, 3, { lod: 2 });
}
function laundryLine(x0, y0, z0, x1, y1, z1, n = 6) {
  W.cable([x0, y0, z0], [x1, y1, z1], 0.25, 0.004, 0x8a8a8a, 6, { lod: 1 });
  const cols = [0xd04a4a, 0x3a6ab0, 0xe8e0d0, 0xe8c040, 0x5aa070, 0xd07ab0, 0x3a3a48, 0xffffff];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.7) / (n + 0.5), x = lerp(x0, x1, t), z = lerp(z0, z1, t), y = lerp(y0, y1, t) - Math.sin(t * Math.PI) * 0.25;
    const w = mr(0.3, 0.7), h = mr(0.35, 0.8);
    W.box(w, h, 0.01, x, y - h / 2, z, mpick(cols), { layer: 'cloth', ry: Math.atan2(-(z1 - z0), x1 - x0), t: TX.fabric, wear: mchance(0.3) ? 6 : 1, lod: 1, ao: false });
  }
}
// small rooftop stair house: a door, a light, a little parapet on top
function stairHouse(x0, z0, x1, z1, y, doorSide = 's', sp = {}) {
  const H = 2.5, T = 0.2, col = sp.col ?? MC.plaster;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const at = sp.at ?? (doorSide === 's' || doorSide === 'n' ? cx : cz);
  const door = { at, w: 0.95, h: 2.05, kind: 'door', style: 'metal', leaf: 'open' };
  wall('x', x0, x1, z1 - T / 2, y, H, T, { col, side: 1, ops: doorSide === 's' ? [door] : [] });
  wall('x', x0, x1, z0 + T / 2, y, H, T, { col, side: -1, ops: doorSide === 'n' ? [door] : [] });
  wall('z', z0 + T, z1 - T, x1 - T / 2, y, H, T, { col, side: 1, ops: doorSide === 'e' ? [door] : [] });
  wall('z', z0 + T, z1 - T, x0 + T / 2, y, H, T, { col, side: -1, ops: doorSide === 'w' ? [door] : [] });
  slab(x0 - 0.1, z0 - 0.1, x1 + 0.1, z1 + 0.1, y + H + 0.2, { top: MC.roofGravel, topTx: TX.gravel, bot: MC.ceiling, thk: 0.2 });
  W.lamp(cx, y + H - 0.3, cz, 0xfff0d8, 2.5, 6, { halo: 0.2 });
}
