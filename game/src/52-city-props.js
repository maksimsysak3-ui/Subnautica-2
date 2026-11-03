// =====================================================================
//  CITY — props: Moroccan interiors, market goods, street furniture, vehicles, industry
// =====================================================================
// Convention (same as the base prop library): origin on the floor, front = +Z, (x, y, z, ry).
const SPICE = [0xc8461e, 0xe0a020, 0x9a3a1a, 0xd8b84a, 0x6a7a2a, 0x8a2a1a, 0xc87a2a, 0xe8d090, 0x5a3a20, 0xb0602a];
const FABRIC = [0xb0302a, 0x2a4a8a, 0xd0a030, 0x3a7a5a, 0x8a2a5a, 0xe0d0b0, 0x2a2a3a, 0xc85a2a, 0x5a3a7a, 0x1a6a7a];

// ---------------- living rooms ----------------
// sedari: the low banquette that lines a Moroccan salon (base, mattress, bolsters, carved apron)
function sedari(x, y, z, ry = 0, len = 3, col = mpick(FABRIC)) {
  W.push(x, y, z, ry);
  W.box(len, 0.3, 0.78, 0, 0.15, 0, MC.cedar, { t: TX.carved });
  W.box(len, 0.16, 0.76, 0, 0.38, 0.01, col, { t: TX.fabric, wear: mchance(0.5) ? 5 : 1 });
  W.box(len, 0.04, 0.02, 0, 0.36, 0.4, MC.brass, { layer: 'metal', lod: 3 });
  const n = Math.max(1, Math.round(len / 0.75));
  for (let i = 0; i < n; i++) W.box(len / n - 0.04, 0.42, 0.16, -len / 2 + (i + 0.5) * (len / n), 0.66, -0.3, shade(col, 0.85 + 0.25 * mrand()), { t: TX.fabric, rx: -0.12, layer: 'cloth' });
  W.pop();
  W.solid(len, 0.46, 0.78, x, y + 0.23, z, 'cloth', { ry });
}
function pouf(x, y, z, col = mpick([0xa8642a, 0xc8a050, 0x8a3a2a, 0xd8c8a0])) {
  W.cyl(0.26, 0.28, 0.34, x, y + 0.17, z, col, { seg: 12, t: TX.carved });
  W.torus(0.25, 0.015, x, y + 0.33, z, shade(col, 0.7), { rx: Math.PI / 2, seg: 12, lod: 3 });
}
// round low table with an engraved brass tray, teapot and tea glasses
function teaTable(x, y, z, r = 0.45) {
  W.cyl(r * 0.9, r * 0.9, 0.36, x, y + 0.18, z, MC.cedar, { seg: 8, t: TX.carved });
  W.cyl(r, r, 0.025, x, y + 0.38, z, MC.brass, { seg: 16, layer: 'metal', t: TX.gebs });
  W.solid(r * 1.8, 0.4, r * 1.8, x, y + 0.2, z, 'wood');
  W.scope({ lod: 3 }, () => {
    teapot(x + 0.06, y + 0.39, z - 0.05, 0, 0xc8c8c0);
    for (let i = 0; i < 5; i++) { const a = i * 1.25; W.cyl(0.025, 0.02, 0.08, x + Math.cos(a) * r * 0.6, y + 0.43, z + Math.sin(a) * r * 0.6, mpick([0x7a9a3a, 0xc8a050, 0x5a8a7a]), { seg: 6, layer: 'glass' }); }
    if (mchance(0.6)) bowl(x - 0.2, y + 0.39, z + 0.15, 0x3a6aa0, 0xd8b070);
  });
}
// hanging brass lantern with star cut-outs: glows and lights the room
function hangLantern(x, y, z, col = 0xffc070, drop = 0.6, lit = true) {
  W.rod([x, y, z], [x, y - drop, z], 0.006, MC.iron, { lod: 2 });
  W.cyl(0.12, 0.16, 0.34, x, y - drop - 0.17, z, MC.brass, { seg: 6, layer: 'metal', t: TX.gebs, lod: 2 });
  W.cone(0.14, 0.18, x, y - drop + 0.06, z, MC.brass, { seg: 6, layer: 'metal', lod: 2 });
  if (lit) { W.cyl(0.09, 0.12, 0.26, x, y - drop - 0.17, z, col, { seg: 6, layer: 'glow', lod: 2 }); W.lamp(x, y - drop - 0.25, z, col, 4.5, 8, { halo: 0.45 }); }
}
function tagine(x, y, z, col = mpick([0xa0522d, 0x8a4a2a, 0x2a6a8a, 0xc89040, 0x3a7a4a])) {
  W.cyl(0.18, 0.2, 0.05, x, y + 0.025, z, col, { seg: 12 });
  W.cone(0.15, 0.22, x, y + 0.16, z, col, { seg: 12 });
  W.sphere(0.04, 0.04, 0.04, x, y + 0.28, z, shade(col, 0.8), { seg: 6, hseg: 4 });
}
function butane(x, y, z, small = false) {
  const s = small ? 0.7 : 1;
  W.cyl(0.15 * s, 0.15 * s, 0.5 * s, x, y + 0.25 * s, z, 0x2a5ab0, { seg: 10, layer: 'metal', t: TX.metal, wear: 3 });
  W.hemi(0.3 * s, 0.1 * s, 0.3 * s, x, y + 0.5 * s, z, 0x2a5ab0, { layer: 'metal' });
  W.torus(0.08 * s, 0.015, x, y + 0.6 * s, z, 0x2a5ab0, { rx: Math.PI / 2, seg: 8, layer: 'metal', lod: 3 });
  W.cyl(0.03, 0.03, 0.06, x, y + 0.6 * s, z, MC.brass, { seg: 6, layer: 'metal', lod: 3 });
}
function ornateMirror(x, y, z, ry = 0, w = 0.7, h = 1.0) {
  W.push(x, y, z, ry);
  W.box(w + 0.14, h + 0.14, 0.04, 0, 0, 0.02, MC.brass, { layer: 'metal', t: TX.gebs });
  W.box(w, h, 0.01, 0, 0, 0.045, 0xc8d4dc, { layer: 'metal' });
  W.box(w * 0.5, 0.18, 0.04, 0, h / 2 + 0.12, 0.02, MC.brass, { layer: 'metal', t: TX.gebs });
  W.pop();
}
function wallPlates(x, y, z, ry = 0, n = 3) {
  W.push(x, y, z, ry);
  for (let i = 0; i < n; i++) { W.cyl(0.16, 0.16, 0.02, (i - (n - 1) / 2) * 0.38, (i % 2) * 0.1, 0.012, 0xffffff, { rx: Math.PI / 2, seg: 14, t: TX.zellige, wear: Math.floor(mrand() * 8) }); }
  W.pop();
}
function hangingRug(x, y, z, ry = 0, w = 1.4, h = 2.0, col = mpick([0x9a2a24, 0x2a3a6a, 0x8a5a2a, 0x6a2a4a])) {
  W.push(x, y, z, ry);
  W.box(w, h, 0.02, 0, h / 2, 0.012, col, { t: TX.rug, layer: 'cloth' });
  W.rod([-w / 2 - 0.05, h + 0.03, 0.03], [w / 2 + 0.05, h + 0.03, 0.03], 0.015, MC.cedarDk, { lod: 3 });
  for (let i = 0; i < Math.round(w / 0.05); i++) W.box(0.01, 0.08, 0.005, -w / 2 + 0.025 + i * 0.05, -0.04, 0.012, shade(col, 1.3), { lod: 3, ao: false });
  W.pop();
}
function floorRug(x, y, z, w, d, ry = 0, col = mpick([0x9a2a24, 0x2a3a6a, 0x8a5a2a, 0x6a2a4a, 0xc8b8a0])) {
  W.box(w, 0.012, d, x, y + 0.006, z, col, { ry, t: TX.rug, layer: 'cloth', ao: false });
}
function ceilingFan(x, y, z) {
  W.rod([x, y, z], [x, y - 0.35, z], 0.015, MC.cedarDk);
  W.cyl(0.1, 0.12, 0.12, x, y - 0.4, z, MC.cedarDk, { seg: 8 });
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.3; W.box(0.6, 0.012, 0.13, x + Math.cos(a) * 0.38, y - 0.42, z + Math.sin(a) * 0.38, MC.cedar, { ry: -a, t: TX.wood }); }
}
function plantPot(x, y, z, kind = mpick(['palm', 'aloe', 'ficus', 'geranium']), s = 1) {
  W.cyl(0.18 * s, 0.13 * s, 0.32 * s, x, y + 0.16 * s, z, mpick([MC.terracotta, 0x2a6a8a, 0x3a7a4a, 0xd8c8a8]), { seg: 10 });
  W.cyl(0.16 * s, 0.16 * s, 0.01, x, y + 0.31 * s, z, 0x4a3a2a, { seg: 10, lod: 3 });
  if (kind === 'palm') for (let i = 0; i < 7; i++) { const a = i * 0.9; W.box(0.08 * s, 0.02, 0.6 * s, x + Math.cos(a) * 0.2 * s, y + 0.75 * s, z + Math.sin(a) * 0.2 * s, 0x4a7a3a, { ry: -a + Math.PI / 2, rx: 0.6, t: TX.leaf }); W.rod([x, y + 0.3 * s, z], [x + Math.cos(a) * 0.12, y + 0.8 * s, z + Math.sin(a) * 0.12], 0.012, 0x6a5a3a, { lod: 3 }); }
  else if (kind === 'aloe') for (let i = 0; i < 9; i++) { const a = i * 0.7; W.cone(0.04 * s, 0.45 * s, x + Math.cos(a) * 0.06, y + 0.5 * s, z + Math.sin(a) * 0.06, 0x5a8a5a, { seg: 4, rx: Math.cos(a) * 0.5, rz: -Math.sin(a) * 0.5 }); }
  else if (kind === 'ficus') { W.rod([x, y + 0.3 * s, z], [x, y + 1.1 * s, z], 0.02, 0x5a4a3a); for (let i = 0; i < 5; i++) W.sphere(0.35 * s, 0.3 * s, 0.35 * s, x + mr(-0.15, 0.15), y + mr(0.9, 1.5) * s, z + mr(-0.15, 0.15), 0x3a6a2a, { seg: 6, hseg: 4, t: TX.leaf }); }
  else { W.sphere(0.32 * s, 0.22 * s, 0.32 * s, x, y + 0.42 * s, z, 0x3a6a2a, { seg: 6, hseg: 4, t: TX.leaf }); for (let i = 0; i < 6; i++) W.sphere(0.06, 0.06, 0.06, x + mr(-0.12, 0.12), y + 0.52 * s, z + mr(-0.12, 0.12), mpick([0xd02a3a, 0xe05a8a, 0xffffff]), { seg: 5, hseg: 3, lod: 3 }); }
  W.solid(0.36 * s, 0.6 * s, 0.36 * s, x, y + 0.3 * s, z, 'clay');
}
function tvStand(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(1.4, 0.5, 0.42, 0, 0.25, 0, MC.cedarDk, { t: TX.wood });
  for (const s of [-1, 1]) W.box(0.6, 0.38, 0.01, s * 0.33, 0.25, 0.212, MC.cedar, { t: TX.carved, lod: 3 });
  W.pop();
  tv(x, y + 0.5, z, ry);
  W.solid(1.4, 0.5, 0.42, x, y + 0.25, z, 'wood', { ry });
}
function washingMachine(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(0.6, 0.85, 0.58, 0, 0.425, 0, 0xe8e8e4, { layer: 'metal', t: TX.metal, wear: 1 });
  W.cyl(0.2, 0.2, 0.03, 0, 0.42, 0.295, 0x9ab0c0, { rx: Math.PI / 2, seg: 16, layer: 'glass' });
  W.torus(0.21, 0.025, 0, 0.42, 0.3, 0xc0c0c0, { seg: 16, layer: 'metal', lod: 3 });
  W.box(0.5, 0.08, 0.02, 0, 0.78, 0.3, 0xc8c8c8, { lod: 3 });
  W.pop();
  W.solid(0.6, 0.85, 0.58, x, y + 0.425, z, 'metal', { ry });
}
function showerCorner(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(0.9, 0.06, 0.9, 0, 0.03, 0, 0xe8e8e4, { t: TX.ceramic });
  W.box(0.9, 2.0, 0.01, 0, 1.0, -0.45, 0xffffff, { t: TX.zellige, wear: 5 });
  W.rod([0.3, 2.0, -0.43], [0.3, 1.0, -0.43], 0.012, MC.alu, { layer: 'metal' });
  W.cyl(0.07, 0.05, 0.03, 0.3, 2.0, -0.38, MC.alu, { rx: Math.PI / 2 - 0.3, seg: 10, layer: 'metal' });
  W.cyl(0.15, 0.12, 0.32, -0.25, 0.22, 0.2, 0x2a6ab0, { seg: 10, lod: 3 }); // bucket
  W.pop();
}
function kitchenRun(x, y, z, ry = 0, len = 2.4, col = 0xe6e0d4) {
  W.push(x, y, z, ry);
  W.box(len, 0.85, 0.6, 0, 0.425, 0, col, { t: TX.wood, wear: 2 });
  W.box(len + 0.02, 0.04, 0.62, 0, 0.87, 0.01, 0x6a6058, { t: TX.terrazzo });
  W.box(len, 0.55, 0.012, 0, 1.17, -0.29, 0xffffff, { t: TX.zellige, wear: mpick([0, 1, 4, 5]) });
  for (let i = 0; i < Math.round(len / 0.6); i++) { W.box(0.56, 0.7, 0.01, -len / 2 + 0.3 + i * 0.6, 0.42, 0.305, shade(col, 0.95), { lod: 3 }); W.box(0.12, 0.02, 0.02, -len / 2 + 0.3 + i * 0.6, 0.7, 0.315, MC.alu, { lod: 3, layer: 'metal' }); }
  W.box(0.5, 0.12, 0.4, len / 2 - 0.45, 0.83, 0, MC.alu, { layer: 'metal' }); // sink basin
  W.rod([len / 2 - 0.45, 0.88, -0.2], [len / 2 - 0.45, 1.12, -0.12], 0.012, MC.alu, { layer: 'metal', lod: 3 });
  W.box(len, 0.6, 0.32, 0, 1.95, -0.15, col, { t: TX.wood, wear: 2 }); // wall cupboards
  W.pop();
  W.solid(len, 0.9, 0.6, x, y + 0.45, z, 'wood', { ry });
}
function gasHob(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(0.6, 0.06, 0.45, 0, 0.03, 0, 0x2a2a2a, { layer: 'metal' });
  for (const [a, b] of [[-0.15, -0.1], [0.15, -0.1], [-0.15, 0.12], [0.15, 0.12]]) W.torus(0.07, 0.015, a, 0.07, b, 0x1a1a1a, { rx: Math.PI / 2, seg: 8, layer: 'metal', lod: 3 });
  W.pop();
}
function shelfUnit(x, y, z, ry = 0, w = 1.0, h = 1.8, d = 0.4, col = MC.cedar, fill = 'home') {
  W.push(x, y, z, ry);
  for (const s of [-1, 1]) W.box(0.03, h, d, s * (w / 2 - 0.015), h / 2, 0, col, { t: TX.wood });
  W.box(w, h, 0.02, 0, h / 2, -d / 2 + 0.01, shade(col, 0.85), { t: TX.wood });
  const n = Math.max(2, Math.round(h / 0.42));
  for (let i = 0; i <= n; i++) {
    const yy = 0.04 + (i / n) * (h - 0.06);
    W.box(w - 0.04, 0.025, d, 0, yy, 0, col, { t: TX.wood });
    if (i === n) break;
    W.scope({ lod: 3 }, () => shelfGoods(w - 0.1, yy + 0.013, d, fill));
  }
  W.pop();
  W.solid(w, h, d, x, y + h / 2, z, 'wood', { ry });
}
// goods on a shelf (in the shelf's frame)
function shelfGoods(w, y, d, fill) {
  let x = -w / 2;
  while (x < w / 2 - 0.08) {
    const k = mrand();
    if (fill === 'grocery') {
      if (k < 0.3) { const c = mpick([0xd8302a, 0x2a6ab0, 0xe0c030, 0x3a8a3a, 0xf0f0e8]); for (let j = 0; j < 3; j++) W.box(0.07, 0.11, 0.07, x + 0.04, y + 0.055, -d / 2 + 0.06 + j * 0.09, c); x += 0.09; }
      else if (k < 0.55) { W.cyl(0.035, 0.035, 0.24, x + 0.04, y + 0.12, 0, mpick([0x3a8a3a, 0xe8e0d0, 0xd8a020]), { seg: 8, layer: 'glass' }); x += 0.08; }
      else if (k < 0.8) { W.box(0.18, 0.26, 0.07, x + 0.1, y + 0.13, 0, mpick([0xe0c030, 0xd8302a, 0x2a4a8a, 0xf0f0e0])); x += 0.2; }
      else { for (let j = 0; j < 4; j++) W.cyl(0.035, 0.035, 0.1, x + 0.04, y + 0.05, -d / 2 + 0.06 + j * 0.08, mpick([0xd0d0d0, 0xc84a2a, 0x2a6a3a]), { seg: 8, layer: 'metal' }); x += 0.09; }
    } else if (fill === 'pottery') {
      if (k < 0.5) { tagine(x + 0.2, y, 0, undefined); x += 0.42; } else { for (let j = 0; j < 6; j++) W.cyl(0.13, 0.11, 0.025, x + 0.14, y + 0.0125 + j * 0.026, 0, 0xffffff, { seg: 12, t: TX.zellige, wear: Math.floor(mrand() * 8) }); x += 0.3; }
    } else if (fill === 'books') {
      const n = 4 + Math.floor(mrand() * 9);
      for (let j = 0; j < n; j++) { const bh = mr(0.18, 0.28); W.box(0.035, bh, 0.2, x + 0.02 + j * 0.037, y + bh / 2, 0, mpick([0x8a2a24, 0x2a3a6a, 0x3a5a3a, 0x6a5030, 0xd8c8a0, 0x1a1a1a])); }
      x += n * 0.037 + mr(0.05, 0.25);
    } else if (fill === 'boxes') {
      const bw = mr(0.25, 0.5), bh = mr(0.2, 0.35); W.box(bw, bh, d * 0.9, x + bw / 2, y + bh / 2, 0, mpick([0xb89a6a, 0xa88a5a, 0xc8aa7a]), { t: TX.none }); x += bw + 0.03;
    } else if (fill === 'lamps') {
      W.cyl(0.08, 0.1, 0.25, x + 0.1, y + 0.125, 0, MC.brass, { seg: 6, layer: 'metal', t: TX.gebs }); W.cone(0.1, 0.1, x + 0.1, y + 0.3, 0, MC.brass, { seg: 6, layer: 'metal' }); x += 0.22;
    } else if (fill === 'leather') {
      for (let j = 0; j < 3; j++) W.box(0.11, 0.05, 0.26, x + 0.06, y + 0.025 + j * 0.05, 0, mpick([0xd8b020, 0xc83a2a, 0x2a4a8a, 0xe8e0d0, 0x5a3a20, 0x1a1a1a])); x += 0.13;
    } else if (fill === 'tools') {
      W.box(mr(0.2, 0.4), mr(0.05, 0.15), 0.18, x + 0.15, y + 0.06, 0, mpick([0xc83a2a, 0x3a3a3a, 0xd8a020, 0x2a5aa0]), { layer: 'metal' }); x += 0.35;
    } else { // home
      if (k < 0.3) { tagine(x + 0.18, y, 0); x += 0.38; } else if (k < 0.55) { W.cyl(0.04, 0.05, 0.16, x + 0.05, y + 0.08, 0, mpick([0x3a6aa0, 0xc8a050, 0xe8e0d0]), { seg: 8 }); x += 0.12; }
      else if (k < 0.8) { const n = 3 + Math.floor(mrand() * 5); for (let j = 0; j < n; j++) W.box(0.035, mr(0.18, 0.25), 0.18, x + 0.02 + j * 0.037, y + 0.11, 0, mpick([0x8a2a24, 0x2a3a6a, 0x6a5030, 0xd8c8a0])); x += n * 0.037 + 0.05; }
      else x += mr(0.1, 0.3);
    }
  }
}
function dresser(x, y, z, ry = 0, col = MC.cedar) {
  W.push(x, y, z, ry);
  W.box(1.1, 0.8, 0.48, 0, 0.4, 0, col, { t: TX.wood });
  for (let i = 0; i < 3; i++) { W.box(1.02, 0.22, 0.01, 0, 0.15 + i * 0.25, 0.245, shade(col, 1.08), { t: TX.carved, lod: 3 }); W.box(0.15, 0.02, 0.02, 0, 0.18 + i * 0.25, 0.255, MC.brass, { layer: 'metal', lod: 3 }); }
  W.pop();
  W.scope({ lod: 3 }, () => { W.push(x, y + 0.8, z, ry); framedPhoto(-0.3, 0, 0, 0.2, 0.25, 0.2, true); W.cyl(0.05, 0.06, 0.2, 0.3, 0.1, 0, 0x3a6aa0, { seg: 8 }); W.pop(); });
  W.solid(1.1, 0.8, 0.48, x, y + 0.4, z, 'wood', { ry });
}
function nightstand(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(0.45, 0.55, 0.4, 0, 0.275, 0, MC.cedar, { t: TX.wood });
  W.box(0.4, 0.15, 0.01, 0, 0.42, 0.205, MC.cedarLt, { lod: 3 });
  W.pop();
  W.scope({ lod: 3 }, () => { deskLamp(x, y + 0.55, z, ry, true); });
}

// ---------------- shops, cafés, offices ----------------
function counter(x, y, z, ry = 0, len = 2.2, col = MC.cedar, top = 0x6a6058) {
  W.push(x, y, z, ry);
  W.box(len, 1.0, 0.6, 0, 0.5, 0, col, { t: col === MC.cedar ? TX.carved : TX.wood });
  W.box(len + 0.1, 0.05, 0.7, 0, 1.025, 0, top, { t: TX.terrazzo });
  W.box(len, 0.1, 0.02, 0, 0.06, 0.3, shade(col, 0.6), { lod: 3 });
  W.pop();
  W.solid(len + 0.1, 1.05, 0.7, x, y + 0.52, z, 'wood', { ry });
}
function cashRegister(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(0.36, 0.1, 0.34, 0, 0.05, 0, 0x2a2a2a, { layer: 'metal' });
  W.box(0.3, 0.12, 0.2, 0, 0.16, -0.05, 0x3a3a3a, { rx: -0.4, layer: 'metal' });
  W.box(0.2, 0.08, 0.02, 0, 0.28, -0.12, 0x6fa86f, { layer: 'glow' });
  W.pop();
}
function displayFridge(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(0.8, 1.95, 0.7, 0, 0.975, 0, 0xd8302a, { layer: 'metal', t: TX.metal, wear: 2 });
  W.box(0.68, 1.5, 0.02, 0, 1.05, 0.355, PC.glass, { layer: 'glass' });
  W.box(0.66, 1.48, 0.01, 0, 1.05, 0.33, 0xe8f0ff, { layer: 'glow' });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) W.cyl(0.035, 0.035, 0.22, -0.26 + c * 0.13, 0.45 + r * 0.36, 0.25, mpick([0xd8302a, 0x3a8a3a, 0xe8a020, 0x2a6ab0, 0xf0f0f0]), { seg: 6, lod: 3 });
  W.box(0.8, 0.2, 0.7, 0, 1.85, 0.0, 0xe8e0d0, { lod: 3 });
  W.pop();
  W.lamp(x, y + 1.2, z + 0.6, 0xe8f0ff, 1.2, 3, { halo: 0 });
  W.solid(0.8, 1.95, 0.7, x, y + 0.98, z, 'metal', { ry });
}
function espressoMachine(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(0.6, 0.42, 0.45, 0, 0.21, 0, 0xc0c4c8, { layer: 'metal' });
  W.box(0.62, 0.06, 0.47, 0, 0.45, 0, 0x2a2a2a, { layer: 'metal' });
  for (const s of [-1, 1]) W.cyl(0.03, 0.035, 0.12, s * 0.15, 0.22, 0.25, 0x2a2a2a, { rx: Math.PI / 2, seg: 8, layer: 'metal' });
  for (let i = 0; i < 5; i++) W.cyl(0.035, 0.03, 0.06, -0.2 + i * 0.1, 0.51, -0.1, 0xffffff, { seg: 8 });
  W.pop();
}
function bistroTable(x, y, z, chairs = 2, col = mpick([0x2a5a3a, 0x7a2a24, 0x2a2a2a, 0xc8c0b0])) {
  W.cyl(0.32, 0.32, 0.03, x, y + 0.72, z, 0xe8e4dc, { seg: 12, t: TX.terrazzo });
  W.cyl(0.025, 0.025, 0.7, x, y + 0.36, z, MC.iron, { seg: 6, layer: 'metal' });
  W.cyl(0.22, 0.24, 0.03, x, y + 0.015, z, MC.iron, { seg: 8, layer: 'metal' });
  W.solid(0.64, 0.74, 0.64, x, y + 0.37, z, 'metal');
  for (let i = 0; i < chairs; i++) { const a = i * (Math.PI * 2 / chairs) + mr(-0.3, 0.3); bistroChair(x + Math.sin(a) * 0.62, y, z + Math.cos(a) * 0.62, a + Math.PI + mr(-0.4, 0.4), col); }
  W.scope({ lod: 3 }, () => { if (mchance(0.7)) W.cyl(0.03, 0.025, 0.09, x + 0.08, y + 0.78, z, mpick([0x7a9a3a, 0x3a2a1a]), { seg: 6, layer: 'glass' }); if (mchance(0.4)) ashtray(x - 0.1, y + 0.735, z + 0.08); });
}
function bistroChair(x, y, z, ry = 0, col = 0x2a5a3a) {
  W.push(x, y, z, ry); seatHere(0, 0.48, 0.02);
  W.box(0.42, 0.04, 0.42, 0, 0.46, 0, col, { t: TX.wood });
  for (const s of [-1, 1]) for (const t of [-1, 1]) W.rod([s * 0.18, 0.45, t * 0.18], [s * 0.2, 0, t * 0.2], 0.014, MC.iron, { layer: 'metal' });
  W.box(0.42, 0.3, 0.03, 0, 0.75, -0.2, col, { rx: -0.1, t: TX.wood });
  for (const s of [-1, 1]) W.rod([s * 0.19, 0.46, -0.19], [s * 0.19, 0.9, -0.23], 0.012, MC.iron, { layer: 'metal' });
  W.pop();
}
function officeDesk(x, y, z, ry = 0, w = 1.5, kind = 'office') {
  desk(x, y, z, ry, w, 0.75, mpick([PC.woodLt, 0xd8d4cc, 0x6a6a6a]));
  W.scope({ lod: 3 }, () => {
    W.push(x, y + 0.76, z, ry);
    monitor(-w * 0.15, 0, -0.18, 0); keyboard(-w * 0.15, 0, 0.08, 0);
    if (mchance(0.6)) paperStack(w * 0.3, 0, 0, 5, mr(-0.3, 0.3));
    if (mchance(0.6)) mug(w * 0.2, 0, 0.18, mpick([PC.white, PC.redLt, 0x2a5a8a]));
    if (mchance(0.5)) deskPhone(w * 0.36, 0, -0.18, -0.3);
    if (mchance(0.4)) penCup(-w * 0.42, 0, -0.2);
    W.pop();
  });
  W.push(x, y, z, ry); chairOffice(-w * 0.1, 0, 0.72, Math.PI + mr(-0.5, 0.5)); W.pop();
  void kind;
}
function meetingTable(x, y, z, ry = 0, len = 3.2) {
  W.push(x, y, z, ry);
  W.box(len, 0.05, 1.2, 0, 0.74, 0, 0x5a3a24, { t: TX.wood });
  for (const s of [-1, 1]) W.box(0.1, 0.72, 0.8, s * (len / 2 - 0.4), 0.36, 0, 0x3a2a1a, { t: TX.wood });
  const n = Math.floor(len / 0.8);
  for (let i = 0; i < n; i++) for (const s of [-1, 1]) chairOffice(-len / 2 + 0.4 + i * (len - 0.8) / Math.max(1, n - 1), 0, s * 0.95, s > 0 ? Math.PI : 0, 0x2a2a2a);
  W.scope({ lod: 3 }, () => { for (let i = 0; i < 4; i++) paperStack(mr(-len / 2.5, len / 2.5), 0.765, mr(-0.3, 0.3), 3, mr(0, 6)); bottle(0.2, 0.765, 0.1, 0x7fa6b8, 0.3); });
  W.pop();
  W.solid(len, 0.78, 1.2, x, y + 0.39, z, 'wood', { ry });
}
function serverRack(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(0.6, 2.0, 0.9, 0, 1.0, 0, 0x1e2024, { layer: 'metal' });
  for (let i = 0; i < 14; i++) { W.box(0.54, 0.09, 0.02, 0, 0.2 + i * 0.12, 0.455, 0x2a2e34, { layer: 'metal', lod: 3 }); W.box(0.03, 0.015, 0.01, -0.2 + (i % 3) * 0.05, 0.2 + i * 0.12, 0.468, mpick([GLOW.green, GLOW.amber, GLOW.green]), { layer: 'glow', lod: 3 }); }
  W.pop();
  W.solid(0.6, 2.0, 0.9, x, y + 1.0, z, 'metal', { ry });
}
function cctvWall(x, y, z, ry = 0, cols = 4, rows = 3) {
  W.push(x, y, z, ry);
  W.box(cols * 0.56 + 0.1, rows * 0.36 + 0.1, 0.12, 0, 0, 0, 0x1a1a1c, { layer: 'metal' });
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) W.box(0.52, 0.32, 0.01, (c - (cols - 1) / 2) * 0.56, (r - (rows - 1) / 2) * 0.36, 0.065, mpick([0x5a7a8a, 0x6a8a7a, 0x7a8a9a, 0x4a5a6a]), { layer: 'glow' });
  W.pop();
}
function receptionDesk(x, y, z, ry = 0, len = 3) {
  W.push(x, y, z, ry);
  W.box(len, 1.1, 0.5, 0, 0.55, 0.3, 0xd8d0c0, { t: TX.stone });
  W.box(len, 0.75, 0.6, 0, 0.375, -0.25, 0x5a3a24, { t: TX.wood });
  W.box(len + 0.1, 0.04, 0.55, 0, 1.12, 0.3, 0x3a3a3a, { t: TX.terrazzo });
  W.pop();
  W.scope({ lod: 3 }, () => { W.push(x, y + 0.75, z, ry); monitor(-0.4, 0, -0.3, Math.PI); monitor(0.5, 0, -0.3, Math.PI); deskPhone(0, 0, -0.2, Math.PI); W.pop(); });
  W.solid(len, 1.12, 1.1, x, y + 0.56, z, 'wood', { ry });
}
function waitingChairs(x, y, z, ry = 0, n = 4) {
  W.push(x, y, z, ry);
  W.box(n * 0.55, 0.06, 0.08, 0, 0.3, -0.1, MC.alu, { layer: 'metal' });
  for (let i = 0; i < n; i++) { const cx = (i - (n - 1) / 2) * 0.55; W.box(0.48, 0.05, 0.45, cx, 0.45, 0, 0x2a4a6a); W.box(0.48, 0.42, 0.05, cx, 0.7, -0.22, 0x2a4a6a, { rx: -0.1 }); }
  for (const s of [-1, 1]) W.box(0.05, 0.45, 0.4, s * (n * 0.275 - 0.1), 0.22, 0, MC.alu, { layer: 'metal' });
  W.pop();
  W.solid(n * 0.55, 0.9, 0.5, x, y + 0.45, z, 'metal', { ry });
}

// ---------------- market ----------------
// spice pyramids in round tubs on a stepped stand
function spiceStand(x, y, z, ry = 0, w = 1.8) {
  W.push(x, y, z, ry);
  for (let tier = 0; tier < 3; tier++) {
    const ty = 0.35 + tier * 0.3, tz = 0.35 - tier * 0.32;
    W.box(w, ty, 0.34, 0, ty / 2, tz, MC.cedar, { t: TX.wood });
    const n = Math.floor(w / 0.32);
    for (let i = 0; i < n; i++) {
      const cx = -w / 2 + 0.16 + i * (w - 0.32) / Math.max(1, n - 1), c = mpick(SPICE);
      W.cyl(0.14, 0.13, 0.1, cx, ty + 0.05, tz, MC.terracotta, { seg: 10, lod: 2 });
      W.cone(0.13, mr(0.18, 0.3), cx, ty + 0.18, tz, c, { seg: 10, lod: 2, t: TX.gravel });
    }
  }
  for (let i = 0; i < 3; i++) { W.cyl(0.22, 0.25, 0.55, -w / 2 + 0.25 + i * 0.5, 0.275, 0.85, 0xc8b088, { seg: 8, layer: 'cloth', t: TX.fabric, lod: 2 }); W.cyl(0.2, 0.2, 0.02, -w / 2 + 0.25 + i * 0.5, 0.56, 0.85, mpick(SPICE), { seg: 8, lod: 2 }); }
  W.pop();
  W.solid(w, 1.0, 1.4, x, y + 0.5, z, 'wood', { ry });
}
function potteryDisplay(x, y, z, ry = 0, w = 2) {
  W.push(x, y, z, ry);
  W.box(w, 0.6, 0.8, 0, 0.3, 0, MC.cedarDk, { t: TX.wood });
  W.scope({ lod: 2 }, () => {
    for (let i = 0; i < Math.floor(w / 0.42); i++) { if (mchance(0.5)) tagine(-w / 2 + 0.22 + i * 0.42, 0.6, -0.15); else for (let j = 0; j < 5; j++) W.cyl(0.15, 0.12, 0.03, -w / 2 + 0.22 + i * 0.42, 0.615 + j * 0.03, -0.15, 0xffffff, { seg: 12, t: TX.zellige, wear: Math.floor(mrand() * 8) }); }
    for (let i = 0; i < Math.floor(w / 0.35); i++) { const c = mpick([0xa0522d, 0x2a6a8a, 0xc89040, 0x3a7a4a, 0xe8e0d0]); W.cyl(0.1, 0.13, 0.28, -w / 2 + 0.18 + i * 0.35, 0.74, 0.22, c, { seg: 10 }); W.cyl(0.06, 0.1, 0.08, -w / 2 + 0.18 + i * 0.35, 0.92, 0.22, c, { seg: 10 }); }
    for (let i = 0; i < 4; i++) { const c = mpick([MC.terracotta, 0xb0703a]); W.cyl(0.2, 0.28, 0.6, -w / 2 + 0.3 + i * (w - 0.6) / 3, 0.3, 0.7, c, { seg: 10 }); W.cyl(0.14, 0.2, 0.15, -w / 2 + 0.3 + i * (w - 0.6) / 3, 0.66, 0.7, c, { seg: 10 }); }
  });
  W.pop();
  W.solid(w, 0.95, 1.4, x, y + 0.48, z, 'clay', { ry });
}
function lanternCluster(x, y, z, n = 9, spread = 1.2) {
  for (let i = 0; i < n; i++) {
    const ox = mr(-spread, spread), oz = mr(-spread * 0.4, spread * 0.4), drop = mr(0.2, 1.0), lit = mchance(0.45);
    hangLantern(x + ox, y, z + oz, mpick([0xffc070, 0xffa860, 0xff8a60, 0xe0c0ff]), drop, lit && i < 3);
    if (!lit || i >= 3) W.cyl(0.07, 0.09, 0.12, x + ox, y - drop - 0.4, z + oz, mpick([0xc8402a, 0x2a6ab0, 0x3a9a5a, 0xd8a020]), { seg: 6, layer: 'glass', lod: 2 });
  }
}
function babouches(x, y, z, ry = 0, w = 1.6, rows = 5) {
  W.push(x, y, z, ry);
  W.box(w, rows * 0.22 + 0.1, 0.1, 0, (rows * 0.22 + 0.1) / 2, 0, MC.cedarDk, { t: TX.wood });
  W.scope({ lod: 2 }, () => { for (let r = 0; r < rows; r++) for (let i = 0; i < Math.floor(w / 0.14); i++) W.box(0.1, 0.05, 0.26, -w / 2 + 0.08 + i * 0.14, 0.12 + r * 0.22, 0.12, mpick([0xd8b020, 0xc83a2a, 0x2a4a8a, 0xe8e0d0, 0x5a3a20, 0x1a1a1a, 0xd85a9a]), { rx: -0.9 }); });
  W.pop();
  W.solid(w, rows * 0.22, 0.4, x, y + rows * 0.11, z, 'wood', { ry });
}
function rugPile(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  for (let i = 0; i < 6; i++) W.box(mr(1.2, 1.6), 0.05, mr(0.8, 1.0), mr(-0.05, 0.05), 0.025 + i * 0.05, mr(-0.05, 0.05), mpick([0x9a2a24, 0x2a3a6a, 0x8a5a2a, 0x6a2a4a, 0xc8b8a0]), { ry: mr(-0.1, 0.1), t: TX.rug, layer: 'cloth' });
  for (let i = 0; i < 4; i++) W.cyl(0.13, 0.13, 1.4, -0.6 + i * 0.35, 0.42, -0.5, mpick([0x9a2a24, 0x2a3a6a, 0x8a5a2a]), { rz: Math.PI / 2 - 0.15, seg: 8, t: TX.rug, layer: 'cloth', lod: 2 });
  W.pop();
  W.solid(1.6, 0.35, 1.0, x, y + 0.17, z, 'cloth', { ry });
}
function fabricRolls(x, y, z, ry = 0, n = 8) {
  W.push(x, y, z, ry);
  W.box(n * 0.2 + 0.1, 0.05, 0.6, 0, 0.9, 0, MC.cedar, { t: TX.wood });
  for (const s of [-1, 1]) W.box(0.05, 0.9, 0.5, s * (n * 0.1 + 0.03), 0.45, 0, MC.cedar);
  for (let i = 0; i < n; i++) W.cyl(0.08, 0.08, 0.55, -n * 0.1 + 0.1 + i * 0.2, 1.0, 0, mpick(FABRIC), { rx: Math.PI / 2, seg: 8, t: TX.fabric, layer: 'cloth', lod: 2 });
  for (let i = 0; i < n; i++) W.cyl(0.07, 0.07, 1.2, -n * 0.1 + 0.1 + i * 0.2, 0.6, -0.35, mpick(FABRIC), { seg: 8, t: TX.fabric, layer: 'cloth', lod: 2, rx: -0.2 });
  W.pop();
  W.solid(n * 0.2 + 0.1, 1.1, 0.8, x, y + 0.55, z, 'cloth', { ry });
}
function produceCrates(x, y, z, ry = 0, w = 2) {
  W.push(x, y, z, ry);
  W.box(w, 0.7, 0.9, 0, 0.35, 0, MC.cedarDk, { t: TX.wood });
  const fruits = [[0xe8901a, 0.045], [0xd02a1a, 0.04], [0x6aa02a, 0.04], [0xe8d040, 0.05], [0x5a2a4a, 0.035], [0xc84a1a, 0.06], [0x3a7a2a, 0.08]];
  for (let i = 0; i < Math.floor(w / 0.48); i++) {
    const cx = -w / 2 + 0.25 + i * 0.48, [col, r] = mpick(fruits);
    W.push(cx, 0.72, 0.05, 0, -0.25);
    W.box(0.44, 0.14, 0.62, 0, 0.07, 0, PC.woodLt, { t: TX.wood, lod: 2 });
    W.scope({ lod: 2 }, () => { for (let j = 0; j < 9; j++) W.sphere(r * 2, r * 2, r * 2, mr(-0.16, 0.16), 0.14 + r, mr(-0.24, 0.24), col, { seg: 6, hseg: 4 }); });
    W.pop();
  }
  W.pop();
  W.solid(w, 0.95, 0.9, x, y + 0.47, z, 'wood', { ry });
}
function oliveBowls(x, y, z, ry = 0, n = 6) {
  W.push(x, y, z, ry);
  W.box(n * 0.36 + 0.1, 0.8, 0.7, 0, 0.4, 0, 0xe8e0d0, { t: TX.ceramic });
  W.scope({ lod: 2 }, () => { for (let i = 0; i < n; i++) { const c = mpick([0x3a4a1a, 0x5a6a2a, 0x2a1a1a, 0x8a3a2a, 0xc8a040]); W.cyl(0.16, 0.12, 0.12, -n * 0.18 + 0.18 + i * 0.36, 0.86, 0, 0xc8c0b0, { seg: 10 }); W.hemi(0.3, 0.12, 0.3, -n * 0.18 + 0.18 + i * 0.36, 0.92, 0, c, { seg: 10, t: TX.gravel }); } });
  W.pop();
  W.solid(n * 0.36 + 0.1, 0.95, 0.7, x, y + 0.47, z, 'clay', { ry });
}
function copperware(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(1.4, 0.75, 0.6, 0, 0.375, 0, MC.cedar, { t: TX.carved });
  W.scope({ lod: 2 }, () => {
    for (let i = 0; i < 4; i++) teapot(-0.5 + i * 0.33, 0.75, -0.1, mr(0, 6), mpick([0xc8c8c0, 0xb87333, MC.brass]));
    for (let i = 0; i < 3; i++) W.cyl(0.25, 0.25, 0.02, -0.45 + i * 0.45, 0.76 + i * 0.002, 0.16, mpick([0xb87333, MC.brass]), { seg: 16, layer: 'metal', t: TX.gebs });
  });
  W.pop();
  W.solid(1.4, 0.9, 0.6, x, y + 0.45, z, 'wood', { ry });
}
// market stall: timber poles, fabric canopy, counter and goods of one trade
function marketStall(x, z, ry = 0, kind = 'spice', y = 0) {
  const w = mr(2.6, 3.4), d = mr(2.0, 2.6), h = mr(2.3, 2.6), canopy = mpick([[0xb03a2e, 0xe8dcc0], [0x2a5a8a, 0xe8dcc0], [0xc89a3a, 0xc89a3a], [0x3a6a4a, 0xe8dcc0], [0xe8dcc0, 0xe8dcc0], [0x7a2a4a, 0xd8b06a]]);
  W.push(x, y, z, ry);
  W.scope({ lod: 1 }, () => {
    for (const s of [-1, 1]) for (const t of [-1, 1]) W.cyl(0.05, 0.06, h + (t < 0 ? 0.3 : 0), s * w / 2, (h + (t < 0 ? 0.3 : 0)) / 2, t * d / 2, MC.cedarDk, { seg: 6, t: TX.wood });
    W.box(w + 0.4, 0.02, d + 0.6, 0, h + 0.18, 0.1, canopy[0], { rx: 0.14, layer: 'cloth', t: TX.fabric, wear: canopy[0] !== canopy[1] ? 5 : 1 });
    for (let i = 0; i < Math.round((w + 0.4) / 0.3); i++) W.box(0.15, 0.25, 0.02, -w / 2 - 0.2 + 0.15 + i * 0.3, h - 0.08, d / 2 + 0.38, i % 2 ? canopy[1] : canopy[0], { layer: 'cloth', lod: 2 });
    for (const s of [-1, 1]) W.box(0.02, 1.8, d * 0.8, s * (w / 2 + 0.02), h - 0.9, -0.1, mixHex(canopy[0], 0xffffff, 0.2), { layer: 'cloth', t: TX.fabric, lod: 2 });
  });
  const gw = w - 0.3;
  if (kind === 'spice') spiceStand(0, 0, 0.1, 0, gw);
  else if (kind === 'pottery') potteryDisplay(0, 0, 0.2, 0, gw);
  else if (kind === 'lamps') { counter(0, 0, 0.5, 0, gw, MC.cedar); lanternCluster(0, h - 0.05, 0, 12, w / 2 - 0.3); shelfUnit(0, 0, -d / 2 + 0.25, 0, gw, 1.6, 0.35, MC.cedarDk, 'lamps'); }
  else if (kind === 'leather') { babouches(0, 0, -d / 2 + 0.15, 0, gw, 6); counter(0, 0, 0.6, 0, gw * 0.8, MC.cedar); for (let i = 0; i < 6; i++) W.box(0.3, 0.25, 0.1, -gw / 2 + 0.3 + i * gw / 6, h - 0.5, d / 2 - 0.05, mpick([0x8a5a2a, 0xa86a3a, 0x5a3a20, 0xc8a050]), { lod: 2 }); }
  else if (kind === 'rugs') { rugPile(0, 0, 0.3, 0.1); for (let i = 0; i < 3; i++) hangingRug(-gw / 2 + gw / 6 + i * gw / 3, 0.3, -d / 2 + 0.05, 0, gw / 3 - 0.05, h - 0.5); }
  else if (kind === 'fabric') fabricRolls(0, 0, 0, 0, Math.floor(gw / 0.2) - 1);
  else if (kind === 'produce') produceCrates(0, 0, 0.3, 0, gw);
  else if (kind === 'olives') oliveBowls(0, 0, 0.4, 0, Math.floor(gw / 0.36));
  else if (kind === 'copper') { copperware(0, 0, 0.4); for (let i = 0; i < 5; i++) W.cyl(0.25, 0.25, 0.02, -gw / 2 + 0.3 + i * gw / 5, h - 0.6, -d / 2 + 0.05, mpick([0xb87333, MC.brass]), { rx: Math.PI / 2, seg: 16, layer: 'metal', t: TX.gebs, lod: 2 }); }
  else if (kind === 'juice') { counter(0, 0, 0.5, 0, gw, 0xe8e0d0, 0xc8c0b0); W.scope({ lod: 2 }, () => { for (let i = 0; i < 40; i++) W.sphere(0.09, 0.09, 0.09, mr(-gw / 2 + 0.2, gw / 2 - 0.2), 1.1 + Math.floor(i / 12) * 0.08, 0.5 + mr(-0.2, 0.2) - Math.floor(i / 12) * 0.05, 0xf08a1a, { seg: 6, hseg: 4 }); for (let i = 0; i < 6; i++) W.cyl(0.035, 0.03, 0.14, -0.4 + i * 0.16, 1.07, 0.3, 0xffa030, { seg: 6, layer: 'glass' }); }); }
  else { counter(0, 0, 0.4, 0, gw); shelfUnit(0, 0, -d / 2 + 0.25, 0, gw, 1.8, 0.35, MC.cedarDk, 'grocery'); }
  W.scope({ lod: 2 }, () => { stool(w / 2 - 0.4, 0, -d / 2 + 0.6, PC.woodLt); if (mchance(0.5)) butane(-w / 2 + 0.3, 0, -d / 2 + 0.3, true); });
  W.pop();
}
// shop interior goods set (wall shelving + counter by trade)
function shopFit(x0, z0, x1, z1, y, front, kind, H = 3) {
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2;
  const back = front === 1 ? z0 : z1, fz = front === 1 ? z1 : z0, dir = front;   // dir: +1 = front is +z
  const fill = { grocery: 'grocery', pottery: 'pottery', spice: 'grocery', lamps: 'lamps', leather: 'leather', books: 'books', hardware: 'tools', fabric: 'boxes', rugs: 'boxes', copper: 'pottery' }[kind] || 'grocery';
  const ryBack = dir > 0 ? 0 : Math.PI;
  const nShelves = Math.max(1, Math.floor((w - 0.4) / 1.1));
  for (let i = 0; i < nShelves; i++) shelfUnit(x0 + 0.2 + 0.55 + i * 1.1, y, back + dir * 0.22, ryBack, 1.05, Math.min(2.2, H - 0.6), 0.38, MC.cedarDk, fill);
  for (const s of [-1, 1]) { if (d < 3.2) break; const sx = s < 0 ? x0 + 0.22 : x1 - 0.22; shelfUnit(sx, y, back + dir * (d * 0.45), s < 0 ? Math.PI / 2 : -Math.PI / 2, Math.min(2.0, d - 2.2), Math.min(2.0, H - 0.8), 0.38, MC.cedarDk, fill); }
  counter(cx + w * 0.15, y, back + dir * (d * 0.55), dir > 0 ? Math.PI : 0, Math.min(2.0, w * 0.5));
  W.scope({ lod: 3 }, () => { cashRegister(cx + w * 0.15 + 0.4, y + 1.05, back + dir * (d * 0.55), dir > 0 ? 0 : Math.PI); });
  if (kind === 'spice') spiceStand(cx - w * 0.2, y, fz - dir * 0.9, dir > 0 ? 0 : Math.PI, Math.min(1.6, w * 0.4));
  if (kind === 'pottery' || kind === 'copper') potteryDisplay(cx - w * 0.2, y, fz - dir * 1.0, dir > 0 ? 0 : Math.PI, Math.min(1.8, w * 0.4));
  if (kind === 'lamps') lanternCluster(cx, y + H - 0.05, (z0 + z1) / 2, 14, w / 2 - 0.4);
  if (kind === 'rugs') { rugPile(cx - w * 0.15, y, (z0 + z1) / 2, 0.2); hangingRug(x0 + 0.05, y + 0.3, (z0 + z1) / 2, Math.PI / 2, Math.min(2, d - 1), H - 0.8); }
  if (kind === 'grocery') { displayFridge(x1 - 0.5, y, fz - dir * 0.6, dir > 0 ? -Math.PI / 2 : Math.PI / 2); produceCrates(cx - w * 0.2, y, fz - dir * 0.8, dir > 0 ? 0 : Math.PI, Math.min(1.6, w * 0.35)); }
  if (kind === 'leather') babouches(x0 + 0.12, y, (z0 + z1) / 2, Math.PI / 2, Math.min(1.8, d - 1.2), 7);
  if (kind === 'fabric') fabricRolls(cx - w * 0.2, y, (z0 + z1) / 2, 0, 6);
  hangLantern(cx, y + H, (z0 + z1) / 2, 0xfff0d0, 0.3, true);
}

// ---------------- street furniture ----------------
function streetLampModern(x, y, z, ry = 0, h = 8, double = false) {
  W.push(x, y, z, ry);
  W.cyl(0.09, 0.14, h, 0, h / 2, 0, 0x5a5e62, { seg: 8, layer: 'metal', t: TX.metal, wear: 3 });
  W.cyl(0.2, 0.22, 0.5, 0, 0.25, 0, 0x5a5e62, { seg: 8, layer: 'metal' });
  for (const s of double ? [-1, 1] : [1]) {
    W.rod([0, h - 0.2, 0], [0, h + 0.1, s * 1.6], 0.05, 0x5a5e62, { layer: 'metal' });
    W.box(0.32, 0.12, 0.7, 0, h + 0.05, s * 1.9, 0x4a4e52, { layer: 'metal' });
    W.box(0.26, 0.02, 0.6, 0, h - 0.02, s * 1.9, 0xfff4e0, { layer: 'glow', lod: 1 });
  }
  W.pop();
  W.solid(0.3, h, 0.3, x, y + h / 2, z, 'metal');
}
// ornate cast-iron lamp post with a lantern head (medina, civic)
function lampPostOld(x, y, z, h = 4.2) {
  W.cyl(0.18, 0.22, 0.6, x, y + 0.3, z, MC.iron, { seg: 8, layer: 'metal' });
  W.cyl(0.06, 0.09, h - 0.6, x, y + 0.3 + (h - 0.6) / 2, z, MC.iron, { seg: 8, layer: 'metal' });
  W.cyl(0.18, 0.12, 0.5, x, y + h + 0.2, z, MC.iron, { seg: 6, layer: 'metal', t: TX.gebs });
  W.cyl(0.14, 0.1, 0.42, x, y + h + 0.2, z, 0xffd090, { seg: 6, layer: 'glow', lod: 1 });
  W.cone(0.2, 0.3, x, y + h + 0.6, z, MC.iron, { seg: 6, layer: 'metal' });
  W.solid(0.3, h, 0.3, x, y + h / 2, z, 'metal');
}
function trafficLight(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.cyl(0.07, 0.08, 3.4, 0, 1.7, 0, 0x2a2c2e, { seg: 8, layer: 'metal' });
  W.box(0.32, 0.9, 0.28, 0, 3.0, 0.18, 0x1a1a1a, { layer: 'metal' });
  for (const [i, c] of [[0, 0x4a1010], [1, 0x4a3a10], [2, GLOW.green]]) W.cyl(0.09, 0.09, 0.02, 0, 3.27 - i * 0.27, 0.33, c, { rx: Math.PI / 2, seg: 10, layer: i === 2 ? 'glow' : 'solid', lod: 1 });
  W.pop();
  W.solid(0.2, 3.4, 0.2, x, y + 1.7, z, 'metal');
}
function roadSign(x, y, z, ry = 0, kind = mpick(['stop', 'noentry', 'warn', 'blue', 'parking'])) {
  W.push(x, y, z, ry);
  W.cyl(0.035, 0.035, 2.6, 0, 1.3, 0, 0x9a9ea2, { seg: 6, layer: 'metal' });
  if (kind === 'stop') { W.cyl(0.32, 0.32, 0.03, 0, 2.4, 0.04, 0xc8201a, { rx: Math.PI / 2, seg: 8, layer: 'metal' }); W.box(0.36, 0.08, 0.005, 0, 2.4, 0.06, 0xffffff, { lod: 2 }); }
  else if (kind === 'noentry') { W.cyl(0.3, 0.3, 0.03, 0, 2.4, 0.04, 0xc8201a, { rx: Math.PI / 2, seg: 16, layer: 'metal' }); W.box(0.4, 0.09, 0.005, 0, 2.4, 0.06, 0xffffff, { lod: 2 }); }
  else if (kind === 'warn') { W.cyl(0.36, 0.36, 0.03, 0, 2.38, 0.04, 0xc8201a, { rx: Math.PI / 2, seg: 3, layer: 'metal' }); W.cyl(0.27, 0.27, 0.005, 0, 2.38, 0.06, 0xf0f0e8, { rx: Math.PI / 2, seg: 3, lod: 2 }); }
  else if (kind === 'parking') { W.box(0.5, 0.5, 0.03, 0, 2.4, 0.04, 0x1a4aa0, { layer: 'metal' }); W.box(0.08, 0.32, 0.005, -0.06, 2.4, 0.06, 0xffffff, { lod: 2 }); W.box(0.14, 0.12, 0.005, 0.03, 2.48, 0.06, 0xffffff, { lod: 2 }); }
  else { W.cyl(0.3, 0.3, 0.03, 0, 2.4, 0.04, 0x1a4aa0, { rx: Math.PI / 2, seg: 16, layer: 'metal' }); W.box(0.06, 0.3, 0.005, 0, 2.4, 0.06, 0xffffff, { lod: 2, rz: 0.6 }); }
  W.pop();
}
function utilityBox(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(0.9, 1.3, 0.4, 0, 0.65, 0, 0x8a9088, { layer: 'metal', t: TX.metal, wear: 5 });
  W.box(0.94, 0.05, 0.44, 0, 1.32, 0, 0x7a8078, { layer: 'metal' });
  W.box(0.15, 0.15, 0.005, 0.25, 1.0, 0.2, 0xe8c020, { lod: 2 });
  for (let i = 0; i < 3; i++) W.box(mr(0.1, 0.3), mr(0.1, 0.25), 0.005, mr(-0.3, 0.3), mr(0.3, 1.1), 0.2, mpick([0xe8e0d0, 0xc8c0a8, 0xd06a3a]), { lod: 2, ao: false });
  W.pop();
  W.solid(0.9, 1.3, 0.4, x, y + 0.65, z, 'metal', { ry });
}
function dumpster(x, y, z, ry = 0, col = mpick([0x2a5a3a, 0x3a4a6a, 0x5a5a5a])) {
  W.push(x, y, z, ry);
  W.box(1.8, 1.1, 1.0, 0, 0.6, 0, col, { layer: 'metal', t: TX.metal, wear: 6 });
  W.box(1.84, 0.06, 1.06, 0, 1.18, -0.02, shade(col, 0.8), { layer: 'metal', rx: -0.08 });
  for (const s of [-1, 1]) for (const t of [-1, 1]) W.cyl(0.07, 0.07, 0.05, s * 0.75, 0.07, t * 0.4, 0x1a1a1a, { rx: Math.PI / 2, seg: 8 });
  if (mchance(0.6)) for (let i = 0; i < 4; i++) W.box(mr(0.3, 0.6), mr(0.2, 0.4), mr(0.3, 0.5), mr(-1.2, 1.2), 0.15, 0.8 + mr(0, 0.4), mpick([0x1a1a1a, 0xb89a6a, 0x3a5a8a]), { ry: mr(0, 3), lod: 2 });
  W.pop();
  W.solid(1.8, 1.2, 1.0, x, y + 0.6, z, 'metal', { ry });
}
function trashBin(x, y, z) {
  W.cyl(0.24, 0.22, 0.85, x, y + 0.425, z, 0x3a6a4a, { seg: 10, layer: 'metal', t: TX.metal, wear: 4 });
  W.cyl(0.26, 0.26, 0.06, x, y + 0.88, z, 0x2a4a3a, { seg: 10, layer: 'metal' });
  W.solid(0.48, 0.9, 0.48, x, y + 0.45, z, 'metal');
}
function bollard(x, y, z) { W.cyl(0.11, 0.13, 0.85, x, y + 0.425, z, 0x3a3a3a, { seg: 8, layer: 'metal' }); W.sphere(0.22, 0.12, 0.22, x, y + 0.86, z, 0x3a3a3a, { seg: 8, hseg: 3, layer: 'metal' }); W.solid(0.26, 0.9, 0.26, x, y + 0.45, z, 'metal'); }
function planterTree(x, y, z, kind = 'ficus', s = 1) {
  W.box(1.4, 0.55, 1.4, x, y + 0.275, z, MC.concreteLt, { t: TX.concrete, wear: 3 });
  W.box(1.24, 0.02, 1.24, x, y + 0.53, z, 0x4a3a28, { t: TX.earth });
  tree(x, y + 0.53, z, kind, s);
  W.solid(1.4, 0.55, 1.4, x, y + 0.275, z, 'concrete');
}
function tree(x, y, z, kind = 'ficus', s = 1) {
  if (kind === 'palm') { palm(x, y, z, 7 * s + mr(-1, 2)); return; }
  if (kind === 'orange') {
    W.cyl(0.08 * s, 0.12 * s, 1.4 * s, x, y + 0.7 * s, z, 0x5a4632, { seg: 6 });
    W.sphere(2.2 * s, 2.0 * s, 2.2 * s, x, y + 2.2 * s, z, 0x2f5a26, { seg: 8, hseg: 6, t: TX.leaf });
    W.scope({ lod: 2 }, () => { for (let i = 0; i < 14; i++) { const a = mr(0, 6.28), e = mr(-0.6, 0.9); W.sphere(0.1, 0.1, 0.1, x + Math.cos(a) * Math.cos(e) * 1.1 * s, y + 2.2 * s + Math.sin(e) * 1.0 * s, z + Math.sin(a) * Math.cos(e) * 1.1 * s, 0xf08a1a, { seg: 5, hseg: 3 }); } });
    W.solid(0.3, 1.5, 0.3, x, y + 0.75, z, 'wood');
    return;
  }
  if (kind === 'olive') {
    W.rod([x, y, z], [x + 0.2 * s, y + 1.6 * s, z + 0.1], 0.14 * s, 0x6a6050, { seg: 6 });
    for (let i = 0; i < 3; i++) W.sphere(mr(1.4, 2.0) * s, mr(1.0, 1.4) * s, mr(1.4, 2.0) * s, x + mr(-0.7, 0.7) * s, y + mr(1.9, 2.6) * s, z + mr(-0.7, 0.7) * s, mpick([0x5a6a44, 0x66744c, 0x4e5e3c]), { seg: 6, hseg: 4, t: TX.leaf });
    W.solid(0.4, 1.6, 0.4, x, y + 0.8, z, 'wood');
    return;
  }
  // ficus / plane: broad street tree
  W.cyl(0.14 * s, 0.22 * s, 2.6 * s, x, y + 1.3 * s, z, 0x6a5e4e, { seg: 7 });
  for (let i = 0; i < 4; i++) W.sphere(mr(2.0, 2.8) * s, mr(1.5, 2.0) * s, mr(2.0, 2.8) * s, x + mr(-1, 1) * s, y + mr(3.2, 4.2) * s, z + mr(-1, 1) * s, mpick([0x3e5a2a, 0x46642e, 0x37522a]), { seg: 7, hseg: 4, t: TX.leaf });
  W.solid(0.45, 2.6 * s, 0.45, x, y + 1.3 * s, z, 'wood');
}
// wall fountain: zellige panel, carved cedar canopy, basin
function wallFountain(x, y, z, ry = 0, zel = 0) {
  W.push(x, y, z, ry);
  W.box(2.2, 2.8, 0.12, 0, 1.4, 0.06, 0xffffff, { t: TX.zellige, wear: zel });
  W.box(2.5, 0.25, 0.7, 0, 3.0, 0.35, MC.cedar, { t: TX.carved });
  W.box(2.6, 0.06, 0.8, 0, 3.18, 0.36, MC.tile, { rx: -0.25, t: TX.rooftile });
  W.box(2.0, 0.7, 0.8, 0, 0.35, 0.52, 0xffffff, { t: TX.zellige, wear: (zel + 3) & 7 });
  W.box(1.84, 0.02, 0.64, 0, 0.62, 0.52, 0x4a7a8a, { layer: 'glass', lod: 1 });
  W.rod([0, 1.2, 0.13], [0, 1.2, 0.35], 0.02, MC.brass, { layer: 'metal' });
  W.pop();
  W.solid(2.2, 0.7, 0.92, x, y + 0.35, z, 'stone', { ry });
}
// free-standing fountain (square/plaza): octagonal tiled basin with a tiered centre
function fountain(x, y, z, r = 2.4, zel = 0) {
  W.cyl(r, r, 0.6, x, y + 0.3, z, 0xffffff, { seg: 8, t: TX.zellige, wear: zel });
  W.cyl(r + 0.12, r + 0.12, 0.1, x, y + 0.65, z, MC.stone, { seg: 8, t: TX.stone });
  W.cyl(r - 0.15, r - 0.15, 0.02, x, y + 0.55, z, 0x3a6a7a, { seg: 8, layer: 'glass' });
  W.cyl(0.3, 0.45, 1.3, x, y + 0.65, z, MC.stone, { seg: 8, t: TX.stone });
  W.cyl(0.9, 0.5, 0.25, x, y + 1.4, z, MC.stone, { seg: 8, t: TX.stone });
  W.cyl(0.15, 0.2, 0.6, x, y + 1.8, z, MC.stone, { seg: 8 });
  W.sphere(0.25, 0.3, 0.25, x, y + 2.2, z, MC.brass, { layer: 'metal', seg: 8 });
  W.solid(r * 1.85, 0.7, r * 1.85, x, y + 0.35, z, 'stone');
}
function kiosk(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(2.0, 2.4, 1.6, 0, 1.2, 0, 0x2a5a3a, { layer: 'metal', t: TX.metal, wear: 3 });
  W.box(2.4, 0.12, 2.0, 0, 2.5, 0.1, 0x1e4a2e, { layer: 'metal' });
  W.box(1.8, 1.0, 0.02, 0, 1.4, 0.81, PC.glass, { layer: 'glass' });
  W.scope({ lod: 2 }, () => { for (let i = 0; i < 12; i++) W.box(0.22, 0.3, 0.01, -0.8 + (i % 6) * 0.32, 1.1 + Math.floor(i / 6) * 0.42, 0.82, mpick([0xe8e0d0, 0xd8302a, 0x2a6ab0, 0xe8c020]), { ao: false }); });
  W.box(2.0, 0.5, 0.25, 0, 0.6, 1.0, 0x2a5a3a, { layer: 'metal' });
  W.pop();
  W.solid(2.0, 2.4, 1.6, x, y + 1.2, z, 'metal', { ry });
}
function handCart(x, y, z, ry = 0, goods = 'produce') {
  W.push(x, y, z, ry);
  W.box(1.6, 0.08, 0.9, 0, 0.75, 0, PC.woodLt, { t: TX.wood });
  for (const s of [-1, 1]) W.box(1.6, 0.25, 0.04, 0, 0.88, s * 0.45, PC.woodLt, { t: TX.wood });
  for (const s of [-1, 1]) { W.torus(0.35, 0.05, 0.1, 0.35, s * 0.5, 0x3a3a3a, { seg: 12 }); W.rod([0.8, 0.8, s * 0.35], [1.6, 0.9, s * 0.35], 0.025, PC.woodLt); }
  W.box(0.08, 0.7, 0.08, -0.7, 0.4, 0, PC.woodLt);
  W.scope({ lod: 2 }, () => { if (goods === 'produce') for (let i = 0; i < 30; i++) W.sphere(0.12, 0.12, 0.12, mr(-0.7, 0.7), 0.85 + mr(0, 0.15), mr(-0.35, 0.35), mpick([0xf08a1a, 0xd02a1a, 0x6aa02a, 0xe8d040]), { seg: 5, hseg: 3 }); else for (let i = 0; i < 5; i++) W.box(mr(0.3, 0.5), mr(0.2, 0.4), mr(0.3, 0.5), mr(-0.5, 0.5), 0.95, mr(-0.25, 0.25), mpick([0xb89a6a, 0x9a7a4a]), { ry: mr(0, 1) }); });
  W.pop();
  W.solid(1.6, 1.0, 0.9, x, y + 0.5, z, 'wood', { ry });
}
function sack(x, y, z, col = 0xc8b088, ry = 0) { W.box(0.5, 0.6, 0.35, x, y + 0.3, z, col, { ry, layer: 'cloth', t: TX.fabric }); W.sphere(0.48, 0.2, 0.33, x, y + 0.6, z, col, { ry, seg: 6, hseg: 3, layer: 'cloth' }); }
function cardboard(x, y, z, ry = 0, s = 1) { W.box(0.5 * s, 0.4 * s, 0.4 * s, x, y + 0.2 * s, z, mpick([0xb89a6a, 0xa88a5a, 0xc8aa7a]), { ry, t: TX.none }); W.box(0.5 * s, 0.005, 0.06, x, y + 0.4 * s + 0.002, z, 0xc8b88a, { ry, lod: 3, ao: false }); }
function crateStack(x, y, z, ry = 0, n = 3) { for (let i = 0; i < n; i++) crate(x + mr(-0.1, 0.1), y + (i > 1 ? 0.7 : 0), z + (i === 1 ? 0.85 : 0) + mr(-0.05, 0.05), 1.0, 0.7, 0.8, ry + mr(-0.15, 0.15), mpick([PC.woodLt, PC.wood, PC.plywood]), i < 2); }
function scaffold(x, y, z, ry = 0, w = 4, h = 6) {
  W.push(x, y, z, ry);
  for (let i = 0; i <= Math.round(w / 2); i++) for (const t of [0, 1]) W.cyl(0.03, 0.03, h, -w / 2 + i * 2, h / 2, t * 1.0, 0x8a8e92, { seg: 6, layer: 'metal' });
  for (let lv = 1; lv <= Math.floor(h / 2); lv++) { W.box(w, 0.05, 1.0, 0, lv * 2, 0.5, PC.plywood, { t: TX.wood, wear: 6 }); W.rod([-w / 2, lv * 2 + 1, 1], [w / 2, lv * 2 + 1, 1], 0.025, 0x8a8e92, { layer: 'metal' }); }
  for (let i = 0; i < Math.round(w / 2); i++) W.rod([-w / 2 + i * 2, 0.2, 1], [-w / 2 + i * 2 + 2, h - 0.2, 1], 0.02, 0x8a8e92, { layer: 'metal', lod: 2 });
  W.box(w * 0.9, h * 0.9, 0.01, 0, h * 0.5, 1.15, 0x3a7a5a, { layer: 'cloth', t: TX.fabric, lod: 1 });
  W.pop();
  W.solid(w, h, 1.1, x, y + h / 2, z + 0.5, 'metal', { ry });
}
function rubble(x, y, z, n = 10, col = MC.plaster) { for (let i = 0; i < n; i++) W.box(mr(0.15, 0.5), mr(0.1, 0.3), mr(0.15, 0.5), x + mr(-0.8, 0.8), y + mr(0.05, 0.25), z + mr(-0.8, 0.8), mpick([col, MC.concreteDk, 0x8a5a40]), { rx: mr(0, 1), ry: mr(0, 3), rz: mr(0, 1), t: TX.concrete, lod: 2 }); }
function meterBox(x, y, z, ry = 0) { W.push(x, y, z, ry); W.box(0.4, 0.5, 0.18, 0, 0, 0.09, 0xc8c4b8, { layer: 'metal', lod: 2 }); W.box(0.16, 0.16, 0.01, 0, 0.05, 0.185, 0x9ab0c0, { layer: 'glass', lod: 2 }); W.rod([0, 0.25, 0.09], [0, 1.4, 0.09], 0.02, 0x3a3a3a, { lod: 2 }); W.pop(); }
function shopSign(x, y, z, ry = 0, w = 1.6, bg = mpick([0x2a5a3a, 0x7a2a24, 0x2a3a6a, 0xe8e0d0, 0xd8a020]), icon = 'none') {
  W.push(x, y, z, ry);
  W.box(w, 0.5, 0.06, 0, 0, 0.03, bg, { layer: 'metal', t: TX.metal, wear: 3, lod: 1 });
  const fg = bg === 0xe8e0d0 || bg === 0xd8a020 ? 0x2a2a2a : 0xe8e0d0;
  // abstract lettering bars (no garbled glyphs) + an icon for the trade
  for (let i = 0; i < 3; i++) W.box(w * mr(0.12, 0.2), 0.05, 0.005, -w * 0.15 + i * w * 0.2, mr(-0.05, 0.08), 0.065, fg, { lod: 2, ao: false });
  if (icon === 'cup') { W.box(0.12, 0.14, 0.005, -w / 2 + 0.2, -0.02, 0.066, fg, { lod: 2 }); W.torus(0.04, 0.012, -w / 2 + 0.29, 0.0, 0.066, fg, { seg: 6, lod: 2 }); }
  else if (icon === 'cross') { W.box(0.1, 0.32, 0.005, -w / 2 + 0.25, 0, 0.066, 0x2ac85a, { layer: 'glow', lod: 1 }); W.box(0.32, 0.1, 0.005, -w / 2 + 0.25, 0, 0.066, 0x2ac85a, { layer: 'glow', lod: 1 }); }
  else if (icon === 'key') { W.torus(0.06, 0.015, -w / 2 + 0.2, 0, 0.066, fg, { seg: 8, lod: 2 }); W.box(0.18, 0.025, 0.005, -w / 2 + 0.33, 0, 0.066, fg, { lod: 2 }); }
  W.pop();
}
// projecting green pharmacy cross (lit)
function pharmacyCross(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(0.05, 0.05, 0.4, 0, 0, 0.2, MC.iron, { layer: 'metal' });
  W.box(0.12, 0.7, 0.24, 0, 0, 0.5, 0x2ac85a, { layer: 'glow' }); W.box(0.12, 0.24, 0.7, 0, 0, 0.5, 0x2ac85a, { layer: 'glow' });
  W.pop();
  W.lamp(x, y, z, 0x5aff8a, 1.2, 4, { halo: 0.5 });
}
function hostedCables(x0, y0, z0, x1, y1, z1, n = 3) { for (let i = 0; i < n; i++) W.cable([x0, y0 - i * 0.12, z0 + i * 0.05], [x1, y1 - i * 0.1, z1 - i * 0.04], mr(0.3, 0.8), 0.008, 0x1a1a1a, 8, { lod: 1 }); }

// ---------------- vehicles ----------------
function sedan(x, z, ry = 0, col = mpick([0xe8e6e0, 0x2a2c30, 0x8a8e94, 0x6a1a1a, 0x1a2a4a, 0xc8b89a]), kind = 'car', y = 0) {
  W.push(x, y, z, ry);
  const c = kind === 'taxi' ? 0xc8261e : kind === 'taxiB' ? 0xd8c8a0 : col;
  W.scope({ lod: 1 }, () => {
    W.box(4.3, 0.55, 1.72, 0, 0.62, 0, c, { layer: 'metal', t: TX.metal, wear: 2 });
    W.box(1.1, 0.12, 1.66, 1.55, 0.93, 0, c, { layer: 'metal', rz: -0.06 });
    W.box(0.9, 0.12, 1.66, -1.65, 0.93, 0, c, { layer: 'metal', rz: 0.05 });
    W.box(2.1, 0.5, 1.6, -0.1, 1.12, 0, c, { layer: 'metal' });
    W.box(2.12, 0.42, 1.62, -0.1, 1.12, 0, 0x1e2630, { layer: 'metal' });  // dark glass band
    W.box(0.5, 0.05, 1.58, 0.95, 1.22, 0, c, { layer: 'metal', rz: -0.95 });
    W.box(0.45, 0.05, 1.58, -1.15, 1.22, 0, c, { layer: 'metal', rz: 0.9 });
    W.box(2.0, 0.05, 1.58, -0.1, 1.38, 0, c, { layer: 'metal' });
    for (const s of [-1, 1]) for (const t of [-1, 1]) { W.cyl(0.32, 0.32, 0.22, s * 1.35, 0.32, t * 0.78, 0x161618, { rx: Math.PI / 2, seg: 10 }); W.cyl(0.19, 0.19, 0.23, s * 1.35, 0.32, t * 0.78, 0xa8acb0, { rx: Math.PI / 2, seg: 6, layer: 'metal', lod: 2 }); }
    for (const s of [-1, 1]) { W.box(0.04, 0.12, 0.3, 2.16, 0.75, s * 0.6, 0xf0f0e0, { layer: 'metal' }); W.box(0.04, 0.12, 0.28, -2.16, 0.78, s * 0.62, 0x8a1a1a, { layer: 'metal' }); W.box(0.12, 0.06, 0.18, 0.75, 1.05, s * 0.88, c, { layer: 'metal' }); }
    W.box(0.1, 0.18, 1.7, 2.17, 0.45, 0, 0x2a2a2a, { layer: 'metal' }); W.box(0.1, 0.18, 1.7, -2.17, 0.45, 0, 0x2a2a2a, { layer: 'metal' });
    W.box(0.03, 0.1, 0.45, 2.2, 0.48, 0, 0xe8e8e8, { lod: 2 });
    if (kind === 'taxi' || kind === 'taxiB') W.box(0.5, 0.14, 0.25, -0.1, 1.48, 0, 0xe8e0d0, { layer: 'metal' });
  });
  W.pop();
  W.solid(4.4, 1.45, 1.8, x, y + 0.72, z, 'metal', { ry });
}
function van(x, z, ry = 0, col = mpick([0xe8e6e0, 0xd8d4c8, 0x3a5a8a, 0xc8a040]), y = 0) {
  W.push(x, y, z, ry);
  W.scope({ lod: 1 }, () => {
    W.box(4.8, 1.9, 1.95, -0.3, 1.25, 0, col, { layer: 'metal', t: TX.metal, wear: 3 });
    W.box(0.9, 1.0, 1.9, 2.4, 0.8, 0, col, { layer: 'metal' });
    W.box(0.6, 0.9, 1.88, 2.15, 1.65, 0, 0x1e2630, { layer: 'metal', rz: -0.5 });
    for (const s of [-1, 1]) W.box(0.8, 0.55, 0.02, 1.65, 1.7, s * 0.98, 0x1e2630, { layer: 'metal' });
    for (const s of [-1, 1]) for (const t of [-1, 1]) W.cyl(0.36, 0.36, 0.24, s * 1.6 - 0.2, 0.36, t * 0.86, 0x161618, { rx: Math.PI / 2, seg: 12 });
    W.box(3.0, 0.5, 0.005, -0.6, 1.4, 0.98, mpick([0xd8302a, 0x2a5aa0, 0x2a8a4a]), { lod: 2, ao: false });
    for (const s of [-1, 1]) W.box(0.04, 0.14, 0.3, 2.86, 0.8, s * 0.65, 0xf0f0e0, { layer: 'metal' });
  });
  W.pop();
  W.solid(5.8, 2.2, 2.0, x, y + 1.1, z, 'metal', { ry });
}
function scooter(x, z, ry = 0, col = mpick([0xc8261e, 0x2a2a2a, 0xe8e6e0, 0x2a5aa0, 0x8a8e94]), y = 0) {
  W.push(x, y, z, ry);
  W.scope({ lod: 2 }, () => {
    for (const s of [-1, 1]) W.cyl(0.24, 0.24, 0.09, s * 0.62, 0.24, 0, 0x161618, { rx: Math.PI / 2, seg: 10 });
    W.box(0.9, 0.3, 0.32, -0.1, 0.48, 0, col, { layer: 'metal' });
    W.box(0.55, 0.12, 0.28, -0.2, 0.7, 0, 0x1a1a1a);
    W.rod([0.45, 0.4, 0], [0.6, 1.05, 0], 0.03, col, { layer: 'metal' });
    W.rod([0.6, 1.05, -0.32], [0.6, 1.05, 0.32], 0.018, 0x2a2a2a, { layer: 'metal' });
    W.box(0.12, 0.12, 0.18, 0.68, 0.92, 0, 0xe8e8e0, { layer: 'metal' });
    W.rod([0.42, 0.25, 0], [0.62, 0.24, 0], 0.02, 0x8a8e94, { layer: 'metal' });
  });
  W.pop();
  W.solid(1.6, 1.1, 0.5, x, y + 0.55, z, 'metal', { ry });
}
function bus(x, z, ry = 0, col = 0x2a6ab0, y = 0) {
  W.push(x, y, z, ry);
  W.scope({ lod: 1 }, () => {
    W.box(11.5, 2.6, 2.5, 0, 1.65, 0, col, { layer: 'metal', t: TX.metal, wear: 3 });
    W.box(11.4, 0.9, 2.52, 0, 2.15, 0, 0x1e2630, { layer: 'metal' });
    W.box(11.5, 0.15, 2.5, 0, 3.0, 0, 0xe8e6e0, { layer: 'metal' });
    for (const s of [-1, 1]) for (const t of [-1, 1]) W.cyl(0.5, 0.5, 0.3, s * 3.9, 0.5, t * 1.1, 0x161618, { rx: Math.PI / 2, seg: 12 });
    W.box(0.05, 1.4, 1.2, 5.76, 1.9, 0, 0x1e2630, { layer: 'metal' });
  });
  W.pop();
  W.solid(11.6, 3.1, 2.6, x, y + 1.55, z, 'metal', { ry });
}
function forklift(x, z, ry = 0, y = 0) {
  W.push(x, y, z, ry);
  W.scope({ lod: 1 }, () => {
    W.box(2.0, 0.9, 1.1, 0, 0.75, 0, 0xe8b020, { layer: 'metal', t: TX.metal, wear: 5 });
    W.box(0.7, 0.5, 1.05, -0.75, 1.35, 0, 0x3a3a3a, { layer: 'metal' });
    for (const s of [-1, 1]) for (const t of [-1, 1]) W.box(0.06, 1.2, 0.06, s * 0.45 - 0.1, 1.85, t * 0.48, 0x2a2a2a, { layer: 'metal' });
    W.box(1.0, 0.06, 1.05, -0.1, 2.45, 0, 0x2a2a2a, { layer: 'metal' });
    for (const s of [-1, 1]) W.box(0.08, 2.4, 0.1, 1.08, 1.3, s * 0.3, 0x2a2a2a, { layer: 'metal' });
    for (const s of [-1, 1]) W.box(1.1, 0.05, 0.12, 1.65, 0.15, s * 0.3, 0x3a3a3a, { layer: 'metal' });
    for (const s of [-1, 1]) for (const t of [-1, 1]) W.cyl(0.3, 0.3, 0.22, s * 0.65, 0.3, t * 0.5, 0x161618, { rx: Math.PI / 2, seg: 10 });
    W.box(0.3, 0.3, 0.3, 0.1, 1.35, 0, 0x1a1a1a);
  });
  W.pop();
  W.solid(2.7, 2.5, 1.2, x, y + 1.25, z, 'metal', { ry });
}

// ---------------- industry ----------------
function palletRack(x, y, z, ry = 0, len = 5.4, levels = 3, d = 1.1) {
  W.push(x, y, z, ry);
  const bays = Math.max(1, Math.round(len / 2.7)), bw = len / bays, lh = 1.7;
  for (let i = 0; i <= bays; i++) for (const t of [-1, 1]) W.box(0.08, levels * lh + 0.3, 0.08, -len / 2 + i * bw, (levels * lh + 0.3) / 2, t * d / 2, 0x2a5aa0, { layer: 'metal' });
  for (let l = 1; l <= levels; l++) for (const t of [-1, 1]) W.box(len, 0.1, 0.06, 0, l * lh, t * d / 2, 0xe86a1a, { layer: 'metal' });
  W.scope({ lod: 2 }, () => {
    for (let l = 0; l < levels + 1; l++) for (let i = 0; i < bays; i++) for (let k = 0; k < 2; k++) {
      if (mchance(0.2)) continue;
      const px = -len / 2 + i * bw + bw * (0.27 + k * 0.46), py = l * lh + (l ? 0.05 : 0);
      W.box(1.0, 0.12, d - 0.1, px, py + 0.06, 0, PC.woodLt, { t: TX.wood });
      const bh = mr(0.6, 1.3);
      if (mchance(0.7)) W.box(0.95, bh, d - 0.15, px, py + 0.12 + bh / 2, 0, mpick([0xb89a6a, 0xa88a5a, 0xc8aa7a, 0xe8e0d0]), { t: TX.none });
      else for (let s = 0; s < 4; s++) W.cyl(0.25, 0.25, 0.85, px + (s % 2 - 0.5) * 0.5, py + 0.55, (Math.floor(s / 2) - 0.5) * 0.5, mpick([0x2a5aa0, 0xc83a2a, 0x3a3a3a]), { seg: 8, layer: 'metal' });
    }
  });
  W.pop();
  W.solid(len, levels * lh + 0.3, d, x, y + (levels * lh + 0.3) / 2, z, 'metal', { ry });
}
function fuelTank(x, y, z, ry = 0, L = 8, r = 1.4) {
  W.push(x, y, z, ry);
  W.cyl(r, r, L, 0, r + 0.6, 0, 0xe8e6e0, { rz: Math.PI / 2, seg: 16, layer: 'metal', t: TX.metal, wear: 4 });
  for (const s of [-1, 1]) W.sphere(0.6, r * 2, r * 2, s * L / 2, r + 0.6, 0, 0xe8e6e0, { seg: 12, hseg: 8, layer: 'metal' });
  for (const s of [-0.3, 0.3]) W.box(0.4, r + 0.6, r * 1.6, s * L, (r + 0.6) / 2, 0, MC.concreteDk, { t: TX.concrete });
  W.rod([L * 0.2, r * 2 + 0.6, 0], [L * 0.2, r * 2 + 1.2, 0], 0.08, 0x8a8e92, { layer: 'metal' });
  W.box(L * 0.6, 0.3, 0.005, 0, r + 0.9, r + 0.01, 0xc8301a, { lod: 2, ao: false });
  W.pop();
  W.solid(L + 1.2, r * 2 + 0.6, r * 2, x, y + r + 0.3, z, 'metal', { ry });
}
function pipeRun(x0, y0, z0, x1, y1, z1, r = 0.15, col = 0x7a8a6a) {
  W.rod([x0, y0, z0], [x1, y1, z1], r, col, { layer: 'metal', seg: 8, t: TX.metal, wear: 5 });
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 3);
  for (let i = 1; i < n; i++) { const t = i / n; W.box(r * 3, 0.06, r * 3, lerp(x0, x1, t), lerp(y0, y1, t) - r - 0.03, lerp(z0, z1, t), 0x3a3a3a, { layer: 'metal', lod: 2 }); }
}
function chainFence(x0, z0, x1, z1, h = 2.4, y = 0, gaps = []) {
  const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0);
  W.push((x0 + x1) / 2, y, (z0 + z1) / 2, ry);
  const n = Math.max(1, Math.round(L / 3));
  for (let i = 0; i <= n; i++) W.cyl(0.04, 0.04, h + 0.3, -L / 2 + i * (L / n), (h + 0.3) / 2, 0, 0x8a8e92, { seg: 6, layer: 'metal' });
  W.box(L, 0.04, 0.04, 0, h, 0, 0x8a8e92, { layer: 'metal' });
  W.box(L, h - 0.1, 0.01, 0, h / 2, 0, 0x8a8e92, { layer: 'glass', lod: 1 });   // mesh reads as a faint metallic veil
  for (let i = 0; i < 3; i++) W.rod([-L / 2, h + 0.15 + i * 0.1, 0], [L / 2, h + 0.15 + i * 0.1, 0], 0.004, 0x5a5e62, { lod: 2 });
  W.pop();
  let cur = 0;
  const segs = [...gaps.map((g) => [g - 3, g + 3])].sort((a, b) => a[0] - b[0]);
  const ux = (x1 - x0) / L, uz = (z1 - z0) / L;
  for (const [g0, g1] of segs) { if (g0 > cur) W.push(0, 0, 0), W.solid(Math.max(0.01, g0 - cur), h, 0.1, x0 + ux * (cur + g0) / 2, y + h / 2, z0 + uz * (cur + g0) / 2, 'metal', { ry }), W.pop(); cur = g1; }
  if (L > cur) W.solid(L - cur, h, 0.1, x0 + ux * (cur + L) / 2, y + h / 2, z0 + uz * (cur + L) / 2, 'metal', { ry });
}
function railTrack(x0, z0, x1, z1, y = 0) {
  const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0);
  W.push((x0 + x1) / 2, y, (z0 + z1) / 2, ry);
  W.box(L, 0.25, 3.2, 0, 0.125, 0, 0x6a6258, { t: TX.gravel });
  W.scope({ lod: 1 }, () => { for (let i = 0; i < L / 0.65; i++) W.box(0.24, 0.12, 2.5, -L / 2 + 0.3 + i * 0.65, 0.3, 0, 0x5a4a3a, { t: TX.wood, wear: 6 }); });
  for (const s of [-1, 1]) W.box(L, 0.15, 0.08, 0, 0.43, s * 0.72, 0x6a5a50, { layer: 'metal', t: TX.metal, wear: 7 });
  W.pop();
}
function freightWagon(x, z, ry = 0, col = mpick([0x7a3a2a, 0x3a4a5a, 0x5a5a3a]), y = 0) {
  W.push(x, y + 0.5, z, ry);
  W.scope({ lod: 1 }, () => {
    W.box(13, 2.8, 2.9, 0, 2.2, 0, col, { layer: 'metal', t: TX.corrugated, wear: 6 });
    W.box(13.2, 0.25, 3.0, 0, 0.7, 0, 0x2a2a2a, { layer: 'metal' });
    for (const s of [-1, 1]) for (const t of [-1, 1]) { W.cyl(0.42, 0.42, 0.12, s * 4.6 + t * 0.9, 0.0, 0.72, 0x2a2a2a, { rx: Math.PI / 2, seg: 10, layer: 'metal' }); W.cyl(0.42, 0.42, 0.12, s * 4.6 + t * 0.9, 0.0, -0.72, 0x2a2a2a, { rx: Math.PI / 2, seg: 10, layer: 'metal' }); }
    W.box(3, 2.4, 0.06, 0, 2.1, 1.47, shade(col, 0.85), { layer: 'metal', t: TX.metal, wear: 6 });
  });
  W.pop();
  W.solid(13.2, 3.6, 3.0, x, y + 0.5 + 1.8, z, 'metal', { ry });
}
function transformer(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(1.6, 1.8, 1.2, 0, 0.9, 0, 0x6a7a6a, { layer: 'metal', t: TX.metal, wear: 4 });
  for (let i = 0; i < 8; i++) W.box(0.04, 1.4, 0.2, -0.7 + i * 0.2, 0.9, 0.7, 0x5a6a5a, { layer: 'metal', lod: 2 });
  for (let i = 0; i < 3; i++) W.cyl(0.07, 0.09, 0.5, -0.4 + i * 0.4, 2.05, 0, 0x8a5a3a, { seg: 6 });
  W.box(0.3, 0.3, 0.005, 0, 1.4, 0.605, 0xe8c020, { lod: 2 });
  W.pop();
  W.solid(1.6, 1.8, 1.2, x, y + 0.9, z, 'metal', { ry });
}
function bigGenerator(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(3.2, 1.8, 1.4, 0, 0.9, 0, 0xd8d0b8, { layer: 'metal', t: TX.metal, wear: 5 });
  for (let i = 0; i < 10; i++) W.box(0.18, 1.2, 0.02, -1.3 + i * 0.28, 1.0, 0.71, 0x9a9488, { layer: 'metal', lod: 2 });
  W.cyl(0.12, 0.12, 0.8, 1.2, 2.2, 0, 0x3a3a3a, { seg: 8, layer: 'metal' });
  W.pop();
  W.solid(3.2, 1.8, 1.4, x, y + 0.9, z, 'metal', { ry });
}
function gantryCrane(x, z, ry = 0, span = 20, h = 11, y = 0) {
  W.push(x, y, z, ry);
  for (const s of [-1, 1]) for (const t of [-1, 1]) W.box(0.6, h, 0.6, s * span / 2, h / 2, t * 4, 0xe8b020, { layer: 'metal', t: TX.metal, wear: 5 });
  for (const t of [-1, 1]) W.box(span + 0.6, 0.9, 0.7, 0, h, t * 4, 0xe8b020, { layer: 'metal', t: TX.metal, wear: 5 });
  W.box(2.2, 1.2, 8.8, mr(-span / 3, span / 3), h - 0.6, 0, 0x3a3a3a, { layer: 'metal' });
  W.pop();
  for (const s of [-1, 1]) for (const t of [-1, 1]) { W.push(x, y, z, ry); W.solid(0.6, h, 0.6, s * span / 2, h / 2, t * 4, 'metal'); W.pop(); }
}
