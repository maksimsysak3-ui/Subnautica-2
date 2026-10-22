// =====================================================================
//  WORLD MAP — structures: walls with real openings, buildings, containers, tents, towers, vehicles
// =====================================================================

// A straight wall from (x0,z0) to (x1,z1) in the current frame, with door/window openings.
// Openings: { at: metres from the start, w, type: 'door'|'window', h, sill, door: 'open'|'ajar'|'closed'|'none', shutters, grille }
// Interior faces the wall's local -Z (callers traverse buildings S→E→N→W so that is always inside).
function wallRun(x0, z0, x1, z1, H, T, col, ops = [], o = {}) {
  const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0);
  W.push(x0, o.y0 ?? 0, z0, ry);
  const pieces = [], sorted = [...ops].sort((a, b) => a.at - b.at);
  let cur = 0;
  const dims = (op) => { const sill = op.type === 'door' ? 0 : (op.sill ?? 0.95); return { a: op.at - op.w / 2, b: op.at + op.w / 2, sill, top: op.type === 'door' ? (op.h || 2.1) : sill + (op.h || 1.1) }; };
  for (const op of sorted) {
    const { a, b, sill, top } = dims(op);
    if (a > cur) pieces.push([cur, a, 0, H]);
    if (sill > 0) pieces.push([a, b, 0, sill]);
    if (top < H) pieces.push([a, b, top, H]);
    cur = b;
  }
  if (cur < L) pieces.push([cur, L, 0, H]);
  const inC = o.inCol, outC = o.outCol;
  for (const [a, b, ya, yb] of pieces) {
    const cx = (a + b) / 2, cy = (ya + yb) / 2, w = b - a, h = yb - ya;
    W.box(w, h, T, cx, cy, 0, col, { solid: true, mat: o.mat || 'concrete', jit: o.jit ?? 0.04 });
    if (inC) W.box(w, h, 0.006, cx, cy, -(T / 2 + 0.003), inC, { jit: 0.02 });
    if (outC) W.box(w, h, 0.006, cx, cy, T / 2 + 0.003, outC, { jit: 0.03 });
    if (inC && ya === 0 && o.skirt !== false) W.box(w, 0.1, 0.014, cx, 0.05, -(T / 2 + 0.007), o.skirt ?? PC.woodDk);
    if (o.plinth && ya === 0) W.box(w, 0.35, 0.02, cx, 0.175, T / 2 + 0.01, o.plinth);
    if (o.weather && ya === 0) for (let i = 0; i < Math.floor(w / 1.5); i++) W.box(mr(0.08, 0.3), mr(0.4, 1.2), 0.004, a + mr(0.1, w - 0.1), mr(0.3, 0.7), T / 2 + 0.012, o.weather, { ao: false });
  }
  for (const op of sorted) {
    const { a, b, sill, top } = dims(op), w = op.w, mid = (a + b) / 2;
    const fc = op.frame ?? o.frame ?? PC.woodDk, ft = 0.07;
    // jamb lining + face trims on both sides
    W.box(0.035, top - sill, T + 0.02, a + 0.0175, (sill + top) / 2, 0, fc);
    W.box(0.035, top - sill, T + 0.02, b - 0.0175, (sill + top) / 2, 0, fc);
    W.box(w, 0.035, T + 0.02, mid, top - 0.0175, 0, fc);
    for (const f of [-1, 1]) {
      W.box(ft, top - sill + ft, 0.02, a - ft / 2, (sill + top + ft) / 2 - (op.type === 'door' ? ft / 2 : 0), f * (T / 2 + 0.01), fc);
      W.box(ft, top - sill + ft, 0.02, b + ft / 2, (sill + top + ft) / 2 - (op.type === 'door' ? ft / 2 : 0), f * (T / 2 + 0.01), fc);
      W.box(w + ft * 2, ft, 0.02, mid, top + ft / 2, f * (T / 2 + 0.01), fc);
    }
    if (op.type === 'window') {
      W.box(w + 0.12, 0.04, T + 0.14, mid, sill - 0.02, 0.02, op.sillCol ?? o.sillCol ?? PC.concreteLt);
      if (op.glass !== false) {
        W.box(w - 0.07, top - sill - 0.07, 0.008, mid, (sill + top) / 2, 0.02, PC.glass, { layer: 'glass' });
        W.box(0.035, top - sill - 0.06, 0.04, mid, (sill + top) / 2, 0.02, fc);
        W.box(w - 0.06, 0.035, 0.04, mid, sill + (top - sill) * 0.55, 0.02, fc);
        W.solid(w, top - sill, T, mid, (sill + top) / 2, 0, 'glass');
        if (op.blind) for (let i = 0; i < 10; i++) W.box(w - 0.1, 0.012, 0.03, mid, top - 0.08 - i * (top - sill - 0.15) * 0.1 * op.blind, -T / 2 + 0.04, PC.offwhite, { rx: 0.4 });
        if (op.curtain) for (const s of [-1, 1]) W.box(w * 0.25, top - sill + 0.2, 0.03, mid + s * (w * 0.4), (sill + top) / 2 + 0.05, -T / 2 - 0.05, op.curtain, { layer: 'cloth', jit: 0.1 });
      }
      if (op.grille) for (let i = 1; i < Math.round(w / 0.12); i++) W.box(0.014, top - sill, 0.014, a + i * 0.12, (sill + top) / 2, T / 2 + 0.01, PC.metalDk, { layer: 'metal' });
      if (op.shutters) for (const s of [-1, 1]) {
        W.push(s < 0 ? a : b, (sill + top) / 2, T / 2 + 0.03, s < 0 ? -1.9 : 1.9);
        W.box(w / 2, top - sill, 0.03, -s * w / 4, 0, 0, op.shutters, {});
        for (let k = 0; k < 4; k++) W.box(0.012, top - sill - 0.04, 0.034, (s < 0 ? 1 : -1) * (0.04 + k * w / 9), 0, 0, PC.woodDk);
        W.pop();
      }
      if (op.screen) W.box(w - 0.04, top - sill - 0.04, 0.004, mid, (sill + top) / 2, T / 2 - 0.02, 0x222624, { layer: 'glass' });
    } else if (op.door && op.door !== 'none') {
      const ang = { open: 1.75, ajar: 0.55, closed: 0 }[op.door];
      const dw = w - 0.04, dh = top - 0.03;
      W.push(a + 0.02, 0, -T / 2 + 0.03, ang);
      const dc = op.doorCol ?? o.doorCol ?? PC.wood;
      W.box(dw, dh, 0.045, dw / 2, dh / 2 + 0.01, -0.0225, dc);
      if (op.style === 'plank') { for (let k = 0; k < Math.round(dw / 0.14); k++) W.box(0.008, dh - 0.02, 0.05, 0.07 + k * 0.14, dh / 2, -0.0225, PC.woodDk); for (const hy of [0.3, dh - 0.3]) W.box(dw - 0.06, 0.12, 0.06, dw / 2, hy, -0.03, dc); for (let k = 0; k < 8; k++) W.cyl(0.012, 0.012, 0.01, mr(0.1, dw - 0.1), mr(0.2, dh - 0.2), 0.005, PC.metalDk, { rx: Math.PI / 2, seg: 5, layer: 'metal' }); }
      else if (op.style === 'metal') { W.box(dw - 0.1, dh * 0.35, 0.05, dw / 2, dh * 0.72, -0.0225, op.doorCol2 ?? PC.metalDk, { layer: 'metal' }); for (let k = 0; k < 4; k++) W.box(dw - 0.08, 0.02, 0.05, dw / 2, 0.2 + k * 0.22, -0.0225, PC.metalDk, { layer: 'metal' }); }
      else { for (const [py, ph] of [[dh * 0.72, dh * 0.38], [dh * 0.26, dh * 0.36]]) W.box(dw - 0.18, ph, 0.055, dw / 2, py, -0.0225, op.panel ?? PC.woodLt); }
      for (const f of [-1, 1]) { W.cyl(0.022, 0.022, 0.05, dw - 0.08, 1.0, f * 0.035 - 0.0225, PC.brass, { rx: Math.PI / 2, seg: 8, layer: 'metal' }); W.box(0.1, 0.018, 0.02, dw - 0.11, 1.0, f * 0.065 - 0.0225, PC.brass, { layer: 'metal' }); }
      for (const hy of [0.25, dh - 0.25]) W.cyl(0.015, 0.015, 0.1, 0, hy, 0, PC.metalDk, { seg: 6, layer: 'metal' });
      W.pop();
      if (op.door === 'closed') W.solid(w, top, T, mid, top / 2, 0, 'wood');
      if (op.threshold !== false) W.box(w, 0.025, T + 0.06, mid, 0.0125, 0, PC.metalDk, { layer: 'metal' });
    }
  }
  W.pop();
}

// Rectangular building. Openings per side: o.open = { s:[...], n:[...], e:[...], w:[...] } with `at` measured along
// the building's local axis (x for s/n, z for e/w; origin at the building centre).
function building(x, z, w, d, o = {}) {
  const H = o.H ?? 3, T = o.T ?? 0.25, fh = o.floorH ?? 0.15, col = o.wall ?? PC.concrete;
  W.push(x, o.y ?? 0, z, o.ry ?? 0);
  W.box(w + 0.16, fh, d + 0.16, 0, fh / 2, 0, o.slab ?? PC.concreteDk, { solid: true, mat: 'concrete', walk: true });
  if (o.floorFinish !== false) W.box(w - 2 * T, 0.008, d - 2 * T, 0, fh + 0.004, 0, o.floorFinish ?? 0x8a8478, { ao: false, jit: 0.02 });
  if (o.tiles) for (let i = -w / 2 + T; i < w / 2 - T; i += 0.6) W.box(0.008, 0.002, d - 2 * T, i, fh + 0.009, 0, 0x6a655c, { ao: false });
  const op = o.open || {};
  const conv = { s: (a) => a + w / 2, n: (a) => w / 2 - a, e: (a) => d / 2 - T - a, w: (a) => a + d / 2 - T };
  const mapOps = (k) => (op[k] || []).map((p) => ({ ...p, at: conv[k](p.at) }));
  const wo = { inCol: o.inner ?? PC.offwhite, plinth: o.plinth ?? PC.concreteDk, weather: o.weather ?? 0x6a6458, frame: o.frame, doorCol: o.doorCol, sillCol: o.sillCol, y0: fh, mat: o.mat, skirt: o.skirt, outCol: o.outCol };
  wallRun(-w / 2, d / 2 - T / 2, w / 2, d / 2 - T / 2, H, T, col, mapOps('s'), wo);
  wallRun(w / 2 - T / 2, d / 2 - T, w / 2 - T / 2, -d / 2 + T, H, T, col, mapOps('e'), wo);
  wallRun(w / 2, -d / 2 + T / 2, -w / 2, -d / 2 + T / 2, H, T, col, mapOps('n'), wo);
  wallRun(-w / 2 + T / 2, -d / 2 + T, -w / 2 + T / 2, d / 2 - T, H, T, col, mapOps('w'), wo);
  // interior partitions: both faces painted
  for (const r of o.rooms || []) wallRun(r.x0, r.z0, r.x1, r.z1, H, 0.12, o.inner ?? PC.offwhite, (r.ops || []), { inCol: o.inner ?? PC.offwhite, outCol: o.inner ?? PC.offwhite, y0: fh, frame: o.frame, doorCol: o.doorCol, skirt: o.skirt });
  // ceiling + roof
  if (o.roof !== 'none') {
    W.box(w - 2 * T, 0.012, d - 2 * T, 0, fh + H - 0.006, 0, o.ceiling ?? PC.offwhite, { ao: false });
    if (o.roof === 'gable') gableRoof(w, d, fh + H, o.rise ?? 1.0, o.roofCol ?? 0x7d8288, o.gableCol ?? col);
    else {
      W.box(w + 0.3, 0.22, d + 0.3, 0, fh + H + 0.11, 0, o.roofCol ?? PC.concreteDk, { solid: true });
      const ph = o.parapet ?? 0.45, pc = o.parapetCol ?? col;
      if (ph > 0) {
        for (const s of [-1, 1]) { W.box(w + 0.3, ph, 0.18, 0, fh + H + 0.22 + ph / 2, s * (d / 2 + 0.06), pc); W.box(0.18, ph, d + 0.3, s * (w / 2 + 0.06), fh + H + 0.22 + ph / 2, 0, pc); }
        for (const s of [-1, 1]) { W.box(w + 0.34, 0.05, 0.24, 0, fh + H + 0.22 + ph + 0.025, s * (d / 2 + 0.06), o.coping ?? PC.concreteLt); W.box(0.24, 0.05, d + 0.34, s * (w / 2 + 0.06), fh + H + 0.22 + ph + 0.025, 0, o.coping ?? PC.concreteLt); }
      }
      // roof membrane patches + drain
      for (let i = 0; i < 3; i++) W.box(mr(1, 3), 0.01, mr(1, 3), mr(-w / 3, w / 3), fh + H + 0.226, mr(-d / 3, d / 3), 0x3a3a3c, { ao: false });
      W.cyl(0.05, 0.05, fh + H + 0.2, w / 2 + 0.2, (fh + H + 0.2) / 2, d / 2 - 0.4, PC.metal, { seg: 6, layer: 'metal' });  // downspout
      W.box(0.25, 0.08, 0.1, w / 2 + 0.15, fh + H + 0.3, d / 2 - 0.4, PC.metal, { layer: 'metal' });
    }
  }
  if (o.interior) { W.push(0, fh, 0); o.interior(); W.pop(); }
  if (o.roofProps) { W.push(0, fh + H + 0.22, 0); o.roofProps(); W.pop(); }
  if (o.exterior) { W.push(0, -(o.y ?? 0), 0); o.exterior(); W.pop(); } // exterior detail is placed relative to the ground
  W.pop();
}
// corrugated metal gable roof over w (ridge along x) × d
function gableRoof(w, d, y, rise, col, gableCol) {
  const half = d / 2 + 0.45, slope = Math.atan2(rise, d / 2), len = half / Math.cos(slope);
  for (const s of [-1, 1]) {
    W.push(0, y + rise / 2, s * d / 4 + s * 0.2, 0, s * slope);
    W.box(w + 0.6, 0.03, len, 0, 0, 0, col, { layer: 'metal' });
    for (let i = 0; i < Math.round((w + 0.6) / 0.19); i++) W.box(0.03, 0.03, len, -w / 2 - 0.3 + 0.1 + i * 0.19, 0.022, 0, col, { layer: 'metal', jit: 0.04 });
    for (let i = 0; i < 4; i++) W.cyl(0.012, 0.012, 0.01, mr(-w / 2, w / 2), 0.04, mr(-len / 2, len / 2), PC.steel, { seg: 5 });
    W.pop();
    for (let i = 0; i <= Math.round(w / 0.6); i++) W.box(0.06, 0.12, 0.5, -w / 2 + i * 0.6, y - 0.02, s * (d / 2 + 0.15), PC.woodDk, { rx: s * slope }); // rafter tails
  }
  W.box(w + 0.65, 0.06, 0.2, 0, y + rise + 0.03, 0, col, { layer: 'metal' });                                   // ridge cap
  // gable-end triangles (two right-angle prisms meeting at the ridge)
  for (const s of [-1, 1]) {
    W.push(s * (w / 2 - 0.08), y + rise / 2, 0, Math.PI / 2);
    W.wedge(d / 2, rise, 0.16, -d / 4, 0, 0, gableCol);
    W.wedge(d / 2, rise, 0.16, d / 4, 0, 0, gableCol, { ry: Math.PI });
    W.pop();
  }
  W.solid(w + 0.6, 0.3, d + 0.9, 0, y + rise * 0.5, 0, 'metal');
}

// ISO shipping container 20ft (6.06 × 2.44 × 2.59). Doors on +X end.
function container(x, y, z, ry = 0, col = PC.redLt, o = {}) {
  const L = o.long ? 12.19 : 6.06, Wd = 2.44, H = 2.59;
  W.push(x, y, z, ry);
  W.box(L, H, Wd, 0, H / 2, 0, col, { layer: 'metal', jit: 0.05 });
  // corrugation on long sides + roof
  for (let i = 0; i < Math.round(L / 0.28); i++) for (const s of [-1, 1]) W.box(0.12, H - 0.25, 0.04, -L / 2 + 0.2 + i * 0.28, H / 2, s * (Wd / 2 + 0.015), col, { layer: 'metal', jit: 0.03 });
  for (let i = 0; i < Math.round(L / 0.5); i++) W.box(0.25, 0.03, Wd - 0.15, -L / 2 + 0.3 + i * 0.5, H + 0.01, 0, col, { layer: 'metal', jit: 0.03 });
  // frame rails + corner castings
  for (const s of [-1, 1]) { W.box(L, 0.15, 0.08, 0, 0.075, s * (Wd / 2 - 0.02), PC.metalDk, { layer: 'metal' }); W.box(L, 0.12, 0.08, 0, H - 0.06, s * (Wd / 2 - 0.02), col, { layer: 'metal' }); }
  for (const s of [-1, 1]) for (const t of [-1, 1]) for (const hy of [0.09, H - 0.09]) W.box(0.18, 0.12, 0.17, s * (L / 2 - 0.09), hy, t * (Wd / 2 - 0.085), PC.metalDk, { layer: 'metal' });
  // doors with locking bars (+X end)
  for (const t of [-1, 1]) {
    W.box(0.04, H - 0.3, Wd / 2 - 0.06, L / 2 + 0.02, H / 2, t * (Wd / 4), col, { layer: 'metal' });
    for (let k = 0; k < 4; k++) W.box(0.05, H - 0.35, 0.05, L / 2 + 0.05, H / 2, t * (0.12 + k * 0.28) * 0.9 - (t > 0 ? 0 : 0), col, { layer: 'metal' });
    for (const b of [0.15, 0.4]) { W.cyl(0.02, 0.02, H - 0.2, L / 2 + 0.08, H / 2, t * b * Wd, PC.steel, { seg: 6, layer: 'metal' }); W.box(0.06, 0.12, 0.04, L / 2 + 0.1, 1.2, t * b * Wd, PC.steel, { layer: 'metal' }); }
  }
  W.box(0.006, 0.3, 0.9, -L / 2 - 0.003, H - 0.4, 0.2, PC.white, { ao: false }); // ID markings
  W.box(0.9, 0.18, 0.006, -L / 4, H - 0.35, Wd / 2 + 0.04, PC.white, { ao: false });
  for (let i = 0; i < 4; i++) W.box(mr(0.2, 0.6), mr(0.2, 0.8), 0.006, mr(-L / 2.3, L / 2.3), mr(0.3, H - 0.4), (mrand() < 0.5 ? 1 : -1) * (Wd / 2 + 0.04), PC.rust, { ao: false });
  W.pop();
  W.solid(L + 0.1, H, Wd + 0.06, x, y + H / 2, z, 'metal', { ry });
}

// Containerised housing unit (CHU): a white box with a door, barred window, AC, steps.
function chu(x, z, ry = 0, n = 1, interior = null) {
  W.push(x, 0, z, ry);
  const L = 6.0, Wd = 2.5, H = 2.6, base = 0.3;
  W.box(L, 0.3, Wd, 0, 0.15, 0, PC.concreteDk, { solid: true, walk: true });
  for (const s of [-1, 1]) for (const t of [-1, 1]) W.box(0.4, 0.3, 0.4, s * (L / 2 - 0.3), 0.15, t * (Wd / 2 - 0.3), PC.concrete);
  building(0, 0, L, Wd, { y: base, H: H - 0.2, T: 0.08, wall: 0xd4d0c4, inner: 0xe3ded2, floorFinish: 0x6a6f74, slab: 0xb8b4a8, parapet: 0, roofCol: 0xcfcabe, frame: PC.metalDk, plinth: 0xb8b4a8, weather: 0x9a968a,
    open: { s: [{ at: -1.6, w: 0.9, type: 'door', door: mpick(['closed', 'ajar', 'open']), style: 'metal', doorCol: 0xc8c4b8 }, { at: 1.3, w: 0.8, type: 'window', h: 0.7, sill: 1.1, grille: true, blind: 0.6 }] },
    interior: interior || (() => {
      bunkBed(1.6, 0, -0.1, Math.PI / 2, mpick([PC.olive, PC.charcoal, 0x3a4a6a]));
      locker(-0.6, 0, -0.95, 0, PC.olive); locker(0.05, 0, -0.95, 0, PC.olive, true);
      desk(-2.2, 0, -0.75, 0, 1.2, 0.6, PC.woodLt); chairOffice(-2.2, 0, -0.2, Math.PI + 0.3);
      laptop(-2.3, 0.76, -0.8, 0.2); mug(-1.8, 0.76, -0.75, mpick([PC.white, PC.olive, PC.redLt])); deskLamp(-2.65, 0.76, -0.9, 0.4, mrand() < 0.6);
      boots(-0.2, 0, 0.6, 0.3); footlocker(0.6, 0, 0.7, Math.PI, PC.olive); towel(2.8, 1.6, 0.5, Math.PI / 2);
      poster(-1.5, 1.6, -1.19, 0, 0.5, 0.7, mpick([[PC.offwhite, PC.blue, PC.black, PC.redLt], [PC.black, PC.redLt, PC.white, PC.yellow], [PC.tan, PC.olive, PC.black, PC.white]]));
      bulb(0, 2.38, 0, 0.15, GLOW.warm, 2.5, 6);
      if (mrand() < 0.6) rug(0.6, 0, 0.1, 1.4, 0.9, 0, [0x3a3a5a, 0x5a2a2a, PC.tan, PC.offwhite]);
    }) });
  acUnit(L / 2 - 1.2, base + 1.6, -Wd / 2 - 0.25, Math.PI);
  W.box(1.0, 0.18, 0.6, -1.6, 0.09, Wd / 2 + 0.35, PC.metalDk, { layer: 'metal', solid: true }); // step
  W.box(0.5, 0.2, 0.006, 2.2, base + 1.9, Wd / 2 + 0.005, PC.black, { ao: false });                // unit number
  W.box(0.05, 0.05, 0.04, -0.9, base + 2.15, Wd / 2 + 0.03, GLOW.warm, { layer: 'glow' }); W.lamp(-1.2, base + 2.1, Wd / 2 + 0.5, 0xffd8a0, 2.5, 7, { halo: 0.7 });
  W.pop();
}

// Plywood B-hut barracks: raised floor, battened panels, screened windows with prop-open shutters, tin gable roof.
function bHut(x, z, ry = 0, len = 9.8, interior = 'bunks') {
  const Wd = 4.9, H = 2.5, lift = 0.5;
  W.push(x, 0, z, ry);
  for (let i = 0; i <= 4; i++) for (const s of [-1, 1]) W.box(0.3, lift, 0.3, -len / 2 + 0.3 + i * (len - 0.6) / 4, lift / 2, s * (Wd / 2 - 0.3), PC.concrete);
  const winOps = (n) => Array.from({ length: n }, (_, i) => ({ at: -len / 2 + (i + 1) * len / (n + 1), w: 0.9, h: 0.8, sill: 1.0, type: 'window', glass: false, screen: true, frame: PC.woodDk }));
  building(0, 0, len, Wd, { y: lift, H, T: 0.1, wall: PC.plywood, inner: PC.plywood, floorFinish: PC.plywoodDk, slab: PC.plywoodDk, roof: 'gable', rise: 1.2, roofCol: 0x80868c, gableCol: PC.plywood, frame: PC.woodDk, plinth: PC.plywoodDk, weather: 0x8a6d4a, mat: 'wood', skirt: PC.woodDk,
    open: { s: winOps(3), n: winOps(3), e: [{ at: 0, w: 1.0, type: 'door', door: mpick(['closed', 'open', 'ajar']), style: 'plank', doorCol: PC.plywoodDk }], w: [{ at: 0.9, w: 0.8, h: 0.7, sill: 1.1, type: 'window', glass: false, screen: true }] },
    interior: () => {
      const n = Math.floor(len / 2.4);
      if (interior === 'bunks') for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
        const px = -len / 2 + 1.4 + i * 2.3;
        if (mrand() < 0.5) bunkBed(px, 0, s * 1.4, Math.PI / 2, mpick([PC.olive, PC.charcoal, 0x5a4a3a])); else cot(px, 0, s * 1.55, Math.PI / 2);
        footlocker(px, 0, s * 0.55, s > 0 ? Math.PI : 0, mpick([PC.olive, PC.oliveDk, 0x3a4a5a]));
        if (mrand() < 0.5) boots(px + 0.5, 0, s * 0.5, mr(0, 6));
        if (mrand() < 0.35) backpack(px - 0.6, 0, s * 0.9, mr(0, 6), mpick([PC.coyote, PC.olive]));
        if (mrand() < 0.3) duffel(px + 0.2, 0, s * 0.6, mr(0, 1), mpick([PC.olive, PC.black]));
      }
      else if (interior === 'gym') {
        for (let i = 0; i < 3; i++) { W.box(1.2, 0.05, 0.3, -2.5 + i * 2.2, 0.45, 0, PC.black); for (const s of [-1, 1]) { W.box(0.06, 1.2, 0.06, -2.5 + i * 2.2 + s * 0.6, 0.6, 0.6, PC.metalDk, { layer: 'metal' }); W.cyl(0.22, 0.22, 0.05, -2.5 + i * 2.2 + s * 0.85, 1.1, 0.6, PC.black, { rz: Math.PI / 2, seg: 12 }); } W.cyl(0.015, 0.015, 2.0, -2.5 + i * 2.2, 1.1, 0.6, PC.steel, { rz: Math.PI / 2, layer: 'metal' }); }
        for (let i = 0; i < 8; i++) W.cyl(0.12, 0.12, 0.04, 3.2, 0.02 + i * 0.045, -1.6, PC.black, { seg: 12 });
        rug(0, 0, -1.4, 5, 1.2, 0, [0x2a2a2a, 0x333333, 0x2a2a2a, 0x444444]);
      } else if (interior === 'office') {
        for (let i = 0; i < 3; i++) { desk(-3 + i * 2.6, 0, -1.6, 0); chairOffice(-3 + i * 2.6, 0, -0.9, Math.PI + mr(-0.4, 0.4)); monitor(-3.2 + i * 2.6, 0.78, -1.75, 0); keyboard(-3.1 + i * 2.6, 0.78, -1.4, 0); mug(-2.6 + i * 2.6, 0.78, -1.5, mpick([PC.white, PC.blueLt, PC.redLt])); paperStack(-3.6 + i * 2.6, 0.78, -1.6, 4, 0.3); }
        fileCabinet(4.2, 0, -1.9, 0); fileCabinet(3.7, 0, -1.9, 0); whiteboard(0, 1.5, 2.33, Math.PI); coffeeMaker(4.1, 0.78, 1.6, Math.PI);
        tableFolding(3.6, 0, 1.6, 0, 1.6, 0.6); waterCooler(-4.2, 0, 1.8, 0);
      }
      for (let i = 0; i < 3; i++) bulb(-len / 2 + (i + 0.5) * len / 3, H - 0.05, 0, 0.3, GLOW.warm, 3, 7);
      fanStand(len / 2 - 0.6, 0, -1.8, -0.6);
      poster(-len / 2 + 0.08, 1.5, 0.9, Math.PI / 2, 0.6, 0.8, [PC.black, PC.redLt, PC.white, PC.yellow]);
      corkboard(len / 2 - 0.09, 1.5, -1.2, -Math.PI / 2);
      fireExtinguisher(len / 2 - 0.15, 0, 0.9, -Math.PI / 2, true);
      W.cable([-len / 2 + 0.2, H - 0.05, -Wd / 2 + 0.2], [len / 2 - 0.2, H - 0.05, -Wd / 2 + 0.2], 0.05, 0.008, PC.black, 10);
    },
    exterior: () => {
      // steps + landing at the door
      W.box(1.0, lift + 0.12, 1.4, len / 2 + 0.55, (lift + 0.12) / 2, 0, PC.plywoodDk, { solid: true, walk: true });            // landing
      for (let i = 0; i < 3; i++) { const top = lift + 0.12 - (i + 1) * (lift + 0.12) / 4; W.box(0.32, top, 1.2, len / 2 + 1.21 + i * 0.32, top / 2, 0, PC.plywoodDk, { solid: true, walk: true }); W.box(0.33, 0.02, 1.21, len / 2 + 1.21 + i * 0.32, top - 0.01, 0, PC.woodDk); }
      for (const s of [-1, 1]) W.box(0.06, 0.9, 0.06, len / 2 + 0.95, lift + 0.45, s * 0.65, PC.woodDk);
      W.box(0.06, 0.06, 1.0, len / 2 + 0.95, lift + 0.9, 0.65 * 0 + 0.0, PC.woodDk, { ry: 0 });
      // propped-open plywood window shutters on the long sides
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
        const px = -len / 2 + (i + 1) * len / 4;
        W.push(px, lift + 1.85, s * (Wd / 2 + 0.06), 0, s * 0.95);
        W.box(1.0, 0.03, 0.9, 0, 0, s * 0.45, PC.plywoodDk);
        W.pop();
        W.rod([px + 0.45, lift + 1.0, s * (Wd / 2 + 0.06)], [px + 0.45, lift + 1.55, s * (Wd / 2 + 0.6)], 0.015, PC.woodDk);
      }
      // panel seams + horizontal battens outside
      for (const s of [-1, 1]) { for (let i = 1; i < len / 1.22; i++) W.box(0.04, 2.4, 0.02, -len / 2 + i * 1.22, lift + 0.15 + 1.2, s * (Wd / 2 + 0.01), PC.plywoodDk, { ao: false }); W.box(len, 0.06, 0.03, 0, lift + 0.2, s * (Wd / 2 + 0.02), PC.woodDk); }
      sandbagWall(-len / 2, Wd / 2 + 0.6, len / 2 - 0.6, Wd / 2 + 0.6, 4, mpick([PC.tan, 0xa08a62]));
      W.box(0.12, 0.12, 0.04, len / 2 + 0.06, lift + 2.3, 0.7, GLOW.warm, { layer: 'glow' }); W.lamp(len / 2 + 0.6, lift + 2.2, 0.7, 0xffd8a0, 3, 8, { halo: 0.8 });
      W.cable([len / 2 + 0.05, lift + 2.4, -0.8], [len / 2 + 4, 6, -2], 0.4, 0.012, PC.black, 8);
    } });
  W.pop();
}

// Guard tower: timber legs + bracing, sandbagged platform, tin roof, ladder, floodlight and a thermos.
function guardTower(x, z, ry = 0) {
  const P = 4.5, S = 3.2;
  W.push(x, 0, z, ry);
  for (const s of [-1, 1]) for (const t of [-1, 1]) { W.box(0.22, P + 3.0, 0.22, s * S / 2, (P + 3.0) / 2, t * S / 2, PC.woodDk); W.box(0.5, 0.3, 0.5, s * S / 2, 0.15, t * S / 2, PC.concrete); }
  for (const s of [-1, 1]) for (const lv of [1.2, 3.1]) { W.rod([-S / 2, lv - 0.9, s * S / 2], [S / 2, lv + 0.9, s * S / 2], 0.05, PC.wood); W.rod([s * S / 2, lv - 0.9, -S / 2], [s * S / 2, lv + 0.9, S / 2], 0.05, PC.wood); }
  W.box(S + 0.6, 0.15, S + 0.6, 0, P, 0, PC.plywoodDk, { solid: true });
  for (let i = 0; i < 8; i++) W.box(S + 0.6, 0.02, 0.1, 0, P + 0.085, -S / 2 - 0.25 + i * (S + 0.5) / 7, PC.woodDk, { ao: false });
  for (const [a, b, c2, d2] of [[-S / 2 - 0.2, S / 2 + 0.2, S / 2 + 0.2, S / 2 + 0.2], [-S / 2 - 0.2, -S / 2 - 0.2, S / 2 + 0.2, -S / 2 - 0.2], [-S / 2 - 0.2, -S / 2 - 0.2, -S / 2 - 0.2, S / 2 - 0.6]]) { W.push(0, P + 0.075, 0); sandbagWall(a, b, c2, d2, 6, mpick([PC.tan, 0xa08a62])); W.pop(); }
  W.box(0.2, 0.4, S + 0.6, S / 2 + 0.2, P + 0.3, 0, PC.plywood);
  W.push(0, P + 2.7, 0, 0, 0.12); W.box(S + 1.2, 0.05, S + 1.2, 0, 0, 0, 0x80868c, { layer: 'metal' }); for (let i = 0; i < 20; i++) W.box(0.03, 0.03, S + 1.2, -S / 2 - 0.6 + i * 0.23, 0.035, 0, 0x80868c, { layer: 'metal' }); W.pop();
  // ladder up the open side
  for (const s of [-1, 1]) W.rod([S / 2 + 0.55, 0, s * 0.25], [S / 2 + 0.25, P + 1.0, s * 0.25], 0.03, PC.wood);
  for (let i = 0; i < 14; i++) { const t = i / 14; W.rod([S / 2 + 0.55 - t * 0.3, t * (P + 1.0), -0.25], [S / 2 + 0.55 - t * 0.3, t * (P + 1.0), 0.25], 0.02, PC.wood); }
  // inside: stool, thermos, coffee mug, binoculars, radio, spotlight
  stool(0.6, P + 0.075, 0.5); W.cyl(0.05, 0.05, 0.3, -0.9, P + 0.48, -1.3, 0x3a5a3a, { seg: 10, layer: 'metal' }); mug(-0.75, P + 0.33, -1.3, PC.olive, 0.5);
  W.box(0.16, 0.06, 0.12, -0.4, P + 0.36, -1.35, PC.black); radioSet(0.4, P + 0.33, -1.35, 0);
  W.push(-1.2, P + 1.15, 1.2, -0.8); W.cyl(0.18, 0.22, 0.35, 0, 0, 0.15, PC.metalDk, { rx: Math.PI / 2 - 0.3, seg: 12, layer: 'metal' }); W.cyl(0.17, 0.17, 0.01, 0, -0.05, 0.33, GLOW.cool, { rx: Math.PI / 2 - 0.3, layer: 'glow' }); W.pop();
  W.lamp(-1.5, P + 1.0, 2.0, 0xe8f0ff, 14, 26, { halo: 1 });
  W.pop();
  W.solid(S + 0.4, P + 3, S + 0.4, x, (P + 3) / 2, z, 'wood', { ry });
}

// Tents: GP-medium style. Cloth layer is double-sided so you see the inside.
function tent(x, z, ry = 0, L = 8, Wd = 5, col = 0x6b6a4a, interior = null) {
  const wall = 1.7, ridge = 3.1;
  W.push(x, 0, z, ry);
  W.box(L + 0.2, 0.05, Wd + 0.2, 0, 0.025, 0, PC.plywoodDk, { solid: true, walk: true });
  const slope = Math.atan2(ridge - wall, Wd / 2), slen = (Wd / 2) / Math.cos(slope);
  for (const s of [-1, 1]) {
    W.box(L, wall, 0.02, 0, wall / 2, s * Wd / 2, col, { layer: 'cloth' });
    W.push(0, (wall + ridge) / 2, s * Wd / 4, 0, s * slope); W.box(L + 0.3, 0.02, slen + 0.2, 0, 0, 0, col, { layer: 'cloth' }); W.pop();
    for (let i = 0; i <= Math.round(L / 1.6); i++) { const px = -L / 2 + i * L / Math.round(L / 1.6); W.rod([px, wall, s * Wd / 2], [px, 0, s * (Wd / 2 + 1.4)], 0.008, 0xc8bfa0); W.box(0.03, 0.2, 0.03, px, 0.05, s * (Wd / 2 + 1.4), PC.metalDk, { rx: s * 0.3 }); }
    W.solid(L, wall, 0.1, 0, wall / 2, s * Wd / 2, 'cloth');
  }
  for (const e of [-1, 1]) {
    W.push(e * L / 2, 0, 0, Math.PI / 2);
    W.box(Wd * 0.32, wall, 0.02, Wd * 0.34, wall / 2, 0, col, { layer: 'cloth' }); W.box(Wd * 0.32, wall, 0.02, -Wd * 0.34, wall / 2, 0, col, { layer: 'cloth' });
    W.wedge(Wd / 2, ridge - wall, 0.02, Wd / 4, wall + (ridge - wall) / 2, 0, col, { layer: 'cloth', ry: Math.PI }); W.wedge(Wd / 2, ridge - wall, 0.02, -Wd / 4, wall + (ridge - wall) / 2, 0, col, { layer: 'cloth' });
    W.cyl(0.18, 0.18, Wd * 0.36, 0, 1.75, 0.03, col, { rz: Math.PI / 2, seg: 8, layer: 'cloth' });                   // rolled door flap
    W.pop();
    W.solid(0.1, wall, Wd * 0.32, e * L / 2, wall / 2, Wd * 0.34, 'cloth'); W.solid(0.1, wall, Wd * 0.32, e * L / 2, wall / 2, -Wd * 0.34, 'cloth');
  }
  W.cyl(0.04, 0.04, ridge, 0, ridge / 2, 0, PC.alu, { seg: 6, layer: 'metal' });
  for (const e of [-1, 1]) W.cyl(0.04, 0.04, ridge, e * (L / 2 - 0.1), ridge / 2, 0, PC.alu, { seg: 6, layer: 'metal' });
  W.box(L, 0.06, 0.06, 0, ridge - 0.04, 0, PC.alu, { layer: 'metal' });
  if (interior) interior(L, Wd);
  W.pop();
}

// Humvee-style utility vehicle
function humvee(x, z, ry = 0, col = PC.coyote, wreck = false) {
  W.push(x, terrainH(x, z), z, ry);
  const c = wreck ? 0x3a3530 : col;
  W.box(4.6, 0.5, 2.15, 0, 0.85, 0, c, { layer: 'metal' });                 // lower body
  W.box(1.6, 0.35, 2.0, 1.45, 1.27, 0, c, { layer: 'metal', rz: -0.08 });    // hood
  W.box(1.8, 0.9, 2.05, -0.1, 1.55, 0, c, { layer: 'metal' });             // cabin
  W.box(1.4, 0.55, 2.1, -1.6, 1.38, 0, c, { layer: 'metal' });             // rear deck
  for (const s of [-1, 1]) { W.box(1.5, 0.45, 0.02, -0.1, 1.68, s * 1.03, wreck ? PC.black : PC.glass, { layer: wreck ? 'solid' : 'glass' }); for (const dx of [-0.55, 0.35]) W.box(0.02, 0.85, 0.02, dx, 1.5, s * 1.04, PC.black); }
  W.box(0.02, 0.45, 1.8, 0.81, 1.68, 0, wreck ? PC.black : PC.glass, { layer: wreck ? 'solid' : 'glass', rz: 0.15 });
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    if (wreck && s < 0 && t < 0) { W.cyl(0.3, 0.3, 0.3, s * 1.55, 0.3, t * 0.95, PC.metalDk, { rx: Math.PI / 2, seg: 10, layer: 'metal' }); continue; }
    W.cyl(0.46, 0.46, 0.38, s * 1.55, 0.46, t * 0.96, wreck ? PC.metalDk : PC.rubber, { rx: Math.PI / 2, seg: 14 });
    W.cyl(0.26, 0.26, 0.4, s * 1.55, 0.46, t * 0.96, PC.oliveDk, { rx: Math.PI / 2, seg: 8, layer: 'metal' });
    for (let k = 0; k < 6; k++) W.cyl(0.02, 0.02, 0.42, s * 1.55 + Math.cos(k) * 0.16, 0.46 + Math.sin(k) * 0.16, t * 0.96, PC.metalDk, { rx: Math.PI / 2, seg: 4 });
  }
  W.box(0.15, 0.25, 2.2, 2.33, 0.75, 0, PC.black, { layer: 'metal' });                                         // bumper
  for (const s of [-1, 1]) { W.box(0.04, 0.12, 0.2, 2.32, 1.05, s * 0.75, wreck ? PC.black : GLOW.warm, { layer: wreck ? 'solid' : 'glow' }); W.box(0.6, 0.03, 0.4, 1.4, 1.46, s * 0.6, PC.black, { rz: -0.08 }); }
  for (let i = 0; i < 6; i++) W.box(0.03, 0.2, 1.2, 2.3, 1.05, 0, PC.black, { ry: 0, rz: 0 }), W.box(0.02, 0.18, 0.02, 2.33, 1.05, -0.5 + i * 0.2, PC.metalDk);  // grille
  // turret ring + shield + gun
  W.cyl(0.6, 0.6, 0.12, -0.2, 2.06, 0, PC.metalDk, { seg: 14, layer: 'metal' });
  W.box(0.08, 0.6, 1.3, 0.25, 2.4, 0, c, { layer: 'metal', ry: 0 });
  if (!wreck) { W.box(1.1, 0.14, 0.14, 0.45, 2.38, 0, PC.black, { layer: 'metal' }); W.cyl(0.03, 0.03, 0.8, 1.2, 2.38, 0, PC.black, { rz: Math.PI / 2, seg: 6, layer: 'metal' }); W.box(0.25, 0.2, 0.3, 0.25, 2.3, 0.25, PC.olive, { layer: 'metal' }); }
  for (const s of [-1, 1]) W.cyl(0.012, 0.012, 2.6, -2.1, 2.4, s * 0.85, PC.black, { seg: 4, rz: s * 0.08 });       // antennas
  W.box(0.5, 0.5, 0.15, -2.35, 1.2, 0, c, { layer: 'metal' }); W.cyl(0.36, 0.36, 0.25, -2.45, 1.25, 0, PC.rubber, { rx: 0, rz: Math.PI / 2, seg: 12 }); // spare
  if (wreck) for (let i = 0; i < 6; i++) W.box(mr(0.3, 0.9), 0.01, mr(0.3, 0.9), mr(-2, 2), 1.11, mr(-0.9, 0.9), PC.rust, { ao: false });
  W.pop();
  W.solid(4.8, 2.2, 2.3, x, terrainH(x, z) + 1.1, z, 'metal', { ry });
}
function pickup(x, z, ry = 0, col = PC.white, wreck = false) {
  W.push(x, terrainH(x, z) + (wreck ? 0.2 : 0), z, ry, 0, wreck ? 0.05 : 0);
  const c = wreck ? mpick([0x3a3530, PC.rust]) : col;
  W.box(5.0, 0.55, 1.85, 0, 0.75, 0, c, { layer: 'metal' });
  W.box(1.4, 0.3, 1.8, 1.7, 1.15, 0, c, { layer: 'metal', rz: -0.06 });
  W.box(1.7, 0.75, 1.8, 0.2, 1.4, 0, c, { layer: 'metal' });
  W.box(1.5, 0.5, 1.82, 0.2, 1.48, 0, wreck ? PC.black : PC.glass, { layer: wreck ? 'solid' : 'glass' });
  W.box(0.02, 0.5, 1.6, 1.0, 1.47, 0, wreck ? PC.black : PC.glass, { layer: wreck ? 'solid' : 'glass', rz: 0.4 });
  for (const s of [-1, 1]) W.box(2.0, 0.45, 0.06, -1.5, 1.25, s * 0.9, c, { layer: 'metal' });
  W.box(0.06, 0.45, 1.8, -2.5, 1.25, 0, c, { layer: 'metal' });
  W.box(2.0, 0.04, 1.75, -1.5, 1.03, 0, PC.metalDk, { layer: 'metal' });
  for (const s of [-1, 1]) for (const t of [-1, 1]) { if (wreck) { W.cyl(0.25, 0.25, 0.2, s * 1.6, 0.25, t * 0.85, PC.metalDk, { rx: Math.PI / 2, seg: 10 }); continue; } W.cyl(0.38, 0.38, 0.28, s * 1.6, 0.38, t * 0.85, PC.rubber, { rx: Math.PI / 2, seg: 14 }); W.cyl(0.22, 0.22, 0.3, s * 1.6, 0.38, t * 0.85, PC.alu, { rx: Math.PI / 2, seg: 10, layer: 'metal' }); }
  for (const s of [-1, 1]) { W.box(0.04, 0.12, 0.3, 2.51, 0.95, s * 0.65, wreck ? PC.black : PC.white, { layer: wreck ? 'solid' : 'glow' }); W.box(0.04, 0.2, 0.12, -2.52, 1.1, s * 0.8, wreck ? PC.black : GLOW.red, { layer: wreck ? 'solid' : 'glow' }); W.box(0.08, 0.06, 0.25, 0.9, 1.6, s * 0.95, PC.black); }
  W.box(0.12, 0.2, 1.85, 2.55, 0.6, 0, PC.alu, { layer: 'metal' });
  if (!wreck && mrand() < 0.6) { jerrycan(-1.8, 1.05, -0.5, 0.2, PC.redLt); crate(-1.2, 1.05, 0.3, 0.8, 0.45, 0.6, 0.3, PC.woodLt, false); W.box(1.2, 0.3, 0.9, -1.8, 1.25, 0.3, 0x3a5a7a, { layer: 'cloth', rz: 0.1 }); }
  W.pop();
  W.solid(5.1, 1.8, 1.95, x, terrainH(x, z) + 0.9, z, 'metal', { ry });
}
function cargoTruck(x, z, ry = 0, col = PC.olive) {
  W.push(x, terrainH(x, z), z, ry);
  W.box(7.2, 0.3, 1.2, -0.4, 0.75, 0, PC.black, { layer: 'metal' });                   // chassis
  W.box(2.0, 1.9, 2.4, 2.5, 1.95, 0, col, { layer: 'metal' });                         // cab
  W.box(1.6, 0.8, 2.3, 3.6, 1.4, 0, col, { layer: 'metal' });                          // engine
  for (const s of [-1, 1]) W.box(0.9, 0.6, 0.02, 2.6, 2.4, s * 1.21, PC.glass, { layer: 'glass' });
  W.box(0.02, 0.6, 2.0, 3.5, 2.4, 0, PC.glass, { layer: 'glass', rz: 0.1 });
  W.box(4.8, 0.2, 2.5, -1.2, 1.1, 0, PC.woodDk);                                       // bed
  for (const s of [-1, 1]) W.box(4.8, 0.6, 0.06, -1.2, 1.5, s * 1.22, col, { layer: 'metal' });
  for (let i = 0; i < 5; i++) W.torus(1.25, 0.04, -3.4 + i * 1.1, 2.0, 0, PC.metalDk, { arc: Math.PI, seg: 10, layer: 'metal' });
  W.push(-1.2, 2.0, 0); for (let i = 0; i < 9; i++) { const a = (i / 8) * Math.PI; W.box(4.8, 0.03, 0.46, 0, Math.sin(a) * 1.27, Math.cos(a) * 1.27, PC.olive, { layer: 'cloth', rx: a - Math.PI / 2 + Math.PI / 2 * 0, ry: 0, rz: 0 }); } W.pop();
  for (const [wx, ws] of [[3.0, 1], [-1.6, 1], [-3.0, 1]]) for (const t of [-1, 1]) { W.cyl(0.55, 0.55, 0.42, wx, 0.55, t * 1.05, PC.rubber, { rx: Math.PI / 2, seg: 14 }); W.cyl(0.3, 0.3, 0.44, wx, 0.55, t * 1.05, PC.oliveDk, { rx: Math.PI / 2, seg: 8, layer: 'metal' }); void ws; }
  for (const s of [-1, 1]) { W.box(0.05, 0.15, 0.3, 4.42, 1.3, s * 0.85, GLOW.warm, { layer: 'glow' }); W.box(0.3, 0.06, 0.25, 2.5, 3.0, s * 0.8, PC.black); }
  W.cyl(0.08, 0.08, 1.4, 1.7, 3.0, 1.1, PC.metalDk, { seg: 8, layer: 'metal' });          // exhaust stack
  W.pop();
  W.solid(8.0, 3.3, 2.6, x, terrainH(x, z) + 1.65, z, 'metal', { ry });
}

// ---------------- village ----------------
// Mud-brick house: thick walls, uneven parapet, protruding roof beams, wooden doors and shuttered windows.
function mudHouse(x, z, w, d, o = {}) {
  const H = o.H ?? 2.9, T = 0.4;
  const col = o.col ?? mpick([PC.mud, PC.mudLt, 0xa68a66, 0x957a58]);
  building(x, z, w, d, { ...o, H, T, wall: col, inner: o.inner ?? mpick([0xc8b896, 0xd0c4a4, 0xb8a888]), floorFinish: 0x8a7458, slab: PC.mudDk, plinth: PC.mudDk, weather: 0x7a644a, frame: PC.woodDk, mat: 'concrete',
    roofCol: PC.mudDk, parapet: 0.5, parapetCol: col, coping: col, sillCol: PC.mudLt, skirt: false,
    exterior: () => {
      // irregular parapet blocks, beams, spouts, plaster patches, cracks
      for (let i = 0; i < Math.round((w + d) * 1.2); i++) { const side = mrand(); const px = side < 0.5 ? mr(-w / 2, w / 2) : (mrand() < 0.5 ? -1 : 1) * (w / 2 + 0.06); const pz = side < 0.5 ? (mrand() < 0.5 ? -1 : 1) * (d / 2 + 0.06) : mr(-d / 2, d / 2); W.box(mr(0.2, 0.6), mr(0.05, 0.15), 0.25, px, 0.15 + H + 0.22 + 0.5 + 0.05, pz, col, { ry: side < 0.5 ? 0 : Math.PI / 2 }); }
      for (let i = 0; i < Math.floor(w / 0.6); i++) for (const s of [-1, 1]) W.cyl(0.07, 0.07, 0.5, -w / 2 + 0.4 + i * 0.6, 0.15 + H - 0.05, s * (d / 2 + 0.15), PC.woodDk, { rx: Math.PI / 2, seg: 6 });
      for (const s of [-1, 1]) W.box(0.12, 0.08, 0.6, s * w * 0.3, 0.15 + H + 0.3, d / 2 + 0.35, PC.woodDk);
      for (let i = 0; i < Math.round(w + d); i++) { const f = mrand() < 0.5 ? 1 : -1; const onX = mrand() < 0.5; W.box(onX ? mr(0.3, 1.2) : 0.01, mr(0.2, 0.9), onX ? 0.01 : mr(0.3, 1.2), onX ? mr(-w / 2.3, w / 2.3) : f * (w / 2 + 0.006), mr(0.4, H), onX ? f * (d / 2 + 0.006) : mr(-d / 2.3, d / 2.3), mpick([PC.mudLt, PC.mudDk, 0xb8a07a]), { ao: false }); }
      for (let i = 0; i < 5; i++) W.box(0.008, mr(0.3, 0.8), 0.008, mr(-w / 2.2, w / 2.2), mr(0.6, H), d / 2 + 0.007, 0x5a4a36, { rz: mr(-0.6, 0.6), ao: false });
      if (o.ladder !== false && mrand() < 0.6) { const lx = mr(-w / 3, w / 3); for (const s of [-1, 1]) W.rod([lx + s * 0.22, 0, d / 2 + 0.9], [lx + s * 0.22, H + 0.9, d / 2 + 0.15], 0.035, PC.wood); for (let i = 0; i < 10; i++) { const t = (i + 0.5) / 10; W.rod([lx - 0.22, t * (H + 0.9), d / 2 + 0.9 - t * 0.75], [lx + 0.22, t * (H + 0.9), d / 2 + 0.9 - t * 0.75], 0.02, PC.wood); } }
      if (mrand() < 0.5) { W.cable([-w / 2 - 0.3, 2.0, d / 2 + 1.5], [w / 2 + 0.3, 2.0, d / 2 + 1.5], 0.25, 0.006, PC.black); for (let i = 0; i < 5; i++) W.box(0.45, 0.6, 0.01, mr(-w / 2.5, w / 2.5), 1.6, d / 2 + 1.5, mpick([PC.redLt, PC.blueLt, PC.offwhite, PC.yellow, PC.green]), { layer: 'cloth' }); for (const s of [-1, 1]) W.rod([s * (w / 2 + 0.3), 0, d / 2 + 1.5], [s * (w / 2 + 0.3), 2.05, d / 2 + 1.5], 0.03, PC.wood); }
      if (o.extra) o.extra();
    },
    roofProps: o.roofProps ?? (() => {
      if (mrand() < 0.6) { W.cyl(0.5, 0.5, 1.0, mr(-w / 4, w / 4), 0.7, mr(-d / 4, d / 4), mpick([PC.black, 0x3a5a7a, PC.offwhite]), { seg: 12, layer: 'metal' }); }
      if (mrand() < 0.5) { const dx = mr(-w / 3, w / 3); W.box(0.06, 0.6, 0.06, dx, 0.3, -d / 3, PC.metalDk); W.hemi(0.8, 0.3, 0.8, dx, 0.75, -d / 3 + 0.15, PC.offwhite, { rx: -1.2, seg: 10 }); }
      for (let i = 0; i < 3; i++) W.box(mr(0.3, 0.8), 0.06, mr(0.3, 0.8), mr(-w / 3, w / 3), 0.03, mr(-d / 3, d / 3), mpick([PC.woodLt, PC.tan, PC.offwhite]), { ry: mr(0, 3) });
    }),
    interior: o.interior,
  });
}
// mud courtyard wall with a painted metal gate
function compoundWall(x0, z0, x1, z1, gateAt = -1, gateW = 2.6, col = PC.mud, gateCol = mpick([0x2f6a7a, 0x3a6a3a, 0x7a3a2a, 0x2a4a7a])) {
  const ops = gateAt >= 0 ? [{ at: gateAt, w: gateW, type: 'door', h: 2.3, door: 'none', threshold: false, frame: PC.mudDk }] : [];
  wallRun(x0, z0, x1, z1, 2.4, 0.35, col, ops, { plinth: PC.mudDk, weather: 0x7a644a, outCol: null, mat: 'concrete', frame: PC.mudDk });
  const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0);
  W.push(x0, 0, z0, ry);
  for (let i = 0; i < Math.round(L / 0.5); i++) W.box(0.5, mr(0.06, 0.16), 0.38, i * 0.5 + 0.25, 2.45, 0, col, { jit: 0.08 });     // eroded top
  if (gateAt >= 0) for (const s of [-1, 1]) {
    W.push(gateAt + s * gateW / 2, 0, 0.05, s < 0 ? -0.35 : 0.35 + Math.PI);
    W.box(gateW / 2 - 0.05, 2.2, 0.05, -s * 0 + (s < 0 ? 1 : 1) * (gateW / 4), 1.12, 0, gateCol, { layer: 'metal' });
    for (let k = 0; k < 5; k++) W.box(gateW / 2 - 0.1, 0.04, 0.06, gateW / 4, 0.3 + k * 0.45, 0, PC.metalDk, { layer: 'metal' });
    W.pop();
  }
  W.pop();
}
function marketStall(x, z, ry = 0, awn = [PC.redLt, PC.offwhite]) {
  W.push(x, 0, z, ry);
  for (const s of [-1, 1]) for (const t of [-1, 1]) W.cyl(0.05, 0.05, 2.4, s * 1.4, 1.2, t * 0.9, PC.wood, { seg: 6 });
  for (let i = 0; i < 8; i++) W.box(0.36, 0.02, 2.2, -1.26 + i * 0.36, 2.45 - 0.0, 0.1, awn[i % 2], { layer: 'cloth', rx: 0.2 });
  for (let i = 0; i < 8; i++) W.box(0.36, 0.35, 0.02, -1.26 + i * 0.36, 2.2, 1.2, awn[i % 2], { layer: 'cloth' });
  W.box(2.8, 0.06, 1.0, 0, 0.9, 0.4, PC.woodLt); W.box(2.8, 0.85, 0.04, 0, 0.45, 0.88, PC.wood);
  const fruit = [PC.redLt, PC.orange, PC.yellow, PC.green, 0x5a2a4a];
  for (let i = 0; i < 4; i++) basket(-1.0 + i * 0.66, 0.93, 0.4, mpick(fruit));
  for (let i = 0; i < 3; i++) crate(-1 + i * 1.0, 0, -0.5, 0.6, 0.4, 0.4, mr(-0.2, 0.2), PC.woodLt, false);
  for (let i = 0; i < 4; i++) W.box(0.25, 0.4, 0.02, -1.1 + i * 0.7, 1.9, 0.6, mpick([PC.redLt, 0x2a4a7a, PC.yellow, PC.green]), { layer: 'cloth' });
  lantern(0, 1.9, 0.2, true);
  stool(1.2, 0, -0.6);
  W.pop();
  W.solid(2.9, 1.0, 1.9, x, 0.5, z, 'wood', { ry });
}

// ---------------- infrastructure ----------------
function road(x0, z0, x1, z1, w = 7, o = {}) {
  const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
  W.push((x0 + x1) / 2, 0, (z0 + z1) / 2, ry);
  W.box(w, 0.06, L, 0, 0.03, 0, o.dirt ? 0x7e6c50 : 0x2e2f31, { ao: false, jit: 0.03 });
  if (!o.dirt) {
    for (let i = 0; i < Math.floor(L / 6); i++) W.box(0.14, 0.008, 3, 0, 0.064, -L / 2 + 3 + i * 6, PC.offwhite, { ao: false });
    for (const s of [-1, 1]) W.box(0.12, 0.008, L, s * (w / 2 - 0.3), 0.064, 0, 0xc9b26a, { ao: false });
    for (let i = 0; i < Math.floor(L / 9); i++) W.box(mr(0.4, 1.5), 0.004, mr(0.4, 2), mr(-w / 3, w / 3), 0.062, mr(-L / 2, L / 2), mpick([0x26272a, 0x38393c, 0x1e1f21]), { ao: false });  // patches + cracks
    for (const s of [-1, 1]) W.box(0.8, 0.04, L, s * (w / 2 + 0.4), 0.02, 0, 0x8a785a, { ao: false });
  } else for (const s of [-1, 1]) W.box(0.35, 0.008, L, s * 0.9, 0.062, 0, 0x5e5038, { ao: false }); // wheel ruts
  W.pop();
  flat(Math.min(x0, x1) - w / 2, Math.min(z0, z1) - w / 2, Math.max(x0, x1) + w / 2, Math.max(z0, z1) + w / 2, 0, 10);
}
function latticeTower(x, z, h = 32) {
  const y0 = terrainH(x, z);
  W.push(x, y0, z);
  W.box(4, 0.4, 4, 0, 0.2, 0, PC.concrete, { solid: true });
  const seg = 8;
  for (let i = 0; i < seg; i++) {
    const a = i / seg, b = (i + 1) / seg, ra = lerp(1.6, 0.35, a), rb = lerp(1.6, 0.35, b), ya = a * h, yb = b * h;
    for (const [s, t] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) W.rod([s * ra, ya, t * ra], [s * rb, yb, t * rb], 0.05, i % 2 ? PC.redLt : PC.white, { layer: 'metal' });
    for (const [[s1, t1], [s2, t2]] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) { W.rod([s1 * ra, ya, t1 * ra], [s2 * rb, yb, t2 * rb], 0.025, PC.steel, { layer: 'metal' }); W.rod([s2 * ra, ya, t2 * ra], [s1 * rb, yb, t1 * rb], 0.025, PC.steel, { layer: 'metal' }); W.rod([s1 * rb, yb, t1 * rb], [s2 * rb, yb, t2 * rb], 0.03, PC.steel, { layer: 'metal' }); }
  }
  for (let i = 0; i < 3; i++) { W.push(0, h * (0.55 + i * 0.12), 0, i * 2.1); W.cyl(0.6, 0.6, 0.25, 0, 0, 0.7, PC.offwhite, { rx: Math.PI / 2, seg: 14 }); W.box(0.08, 0.08, 0.5, 0, 0, 0.35, PC.metalDk); W.pop(); }
  for (let i = 0; i < 4; i++) W.box(0.12, 1.6, 0.06, Math.sin(i * 1.57) * 0.45, h * 0.88, Math.cos(i * 1.57) * 0.45, PC.offwhite, { ry: i * 1.57 });
  W.cyl(0.04, 0.04, 4, 0, h + 2, 0, PC.steel, { seg: 6, layer: 'metal' });
  W.sphere(0.2, 0.2, 0.2, 0, h + 4.1, 0, GLOW.red, { layer: 'glow' }); W.lamp(0, h + 4.1, 0, 0xff3020, 6, 20, { flicker: 0.0, halo: 2.5 });
  W.sphere(0.15, 0.15, 0.15, 1.0, h * 0.5, 1.0, GLOW.red, { layer: 'glow' });
  // ladder
  for (let i = 0; i < h / 0.35; i++) W.rod([-0.2, i * 0.35, 1.6 - (i * 0.35 / h) * 1.25], [0.2, i * 0.35, 1.6 - (i * 0.35 / h) * 1.25], 0.012, PC.steel);
  W.pop();
  W.solid(3.4, h, 3.4, x, y0 + h / 2, z, 'metal');
}
function waterTower(x, z) {
  const y0 = terrainH(x, z), H = 7;
  W.push(x, y0, z);
  for (const s of [-1, 1]) for (const t of [-1, 1]) { W.rod([s * 1.6, 0, t * 1.6], [s * 1.1, H, t * 1.1], 0.09, PC.metal, { layer: 'metal' }); W.box(0.5, 0.25, 0.5, s * 1.6, 0.12, t * 1.6, PC.concrete); }
  for (const lv of [2, 4.5]) for (const [[a, b], [c, d]] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) { const r = lerp(1.6, 1.1, lv / H); W.rod([a * r, lv, b * r], [c * r, lv, d * r], 0.04, PC.metal, { layer: 'metal' }); }
  W.cyl(1.8, 1.8, 3, 0, H + 1.5, 0, PC.offwhite, { seg: 16, layer: 'metal' });
  W.cone(1.85, 0.6, 0, H + 3.3, 0, PC.metal, { seg: 16, layer: 'metal' });
  for (const hy of [H + 0.4, H + 2.6]) W.torus(1.82, 0.04, 0, hy, 0, PC.metal, { rx: Math.PI / 2, seg: 18, layer: 'metal' });
  for (let i = 0; i < 4; i++) W.box(1.0, 0.8, 0.01, Math.sin(i * 1.57) * 1.81, H + 1.6, Math.cos(i * 1.57) * 1.81, PC.rust, { ry: i * 1.57, ao: false });
  for (let i = 0; i < 20; i++) W.rod([1.65, i * 0.4, -0.2], [1.65, i * 0.4, 0.2], 0.015, PC.steel);
  W.rod([0, 0, 0], [0, H, 0], 0.1, PC.metalDk, { layer: 'metal' });
  W.pop();
  W.solid(3.6, H + 3.6, 3.6, x, y0 + (H + 3.6) / 2, z, 'metal');
}
function helipad(x, z, s = 22) {
  W.push(x, 0, z);
  W.box(s, 0.12, s, 0, 0.06, 0, PC.concrete, { solid: true, walk: true, ao: false });
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; W.box(1.3, 0.01, 0.4, Math.sin(a) * 7, 0.125, Math.cos(a) * 7, PC.offwhite, { ry: a + Math.PI / 2, ao: false }); }
  W.box(0.8, 0.01, 5, -1.6, 0.126, 0, PC.offwhite, { ao: false }); W.box(0.8, 0.01, 5, 1.6, 0.126, 0, PC.offwhite, { ao: false }); W.box(2.4, 0.01, 0.8, 0, 0.126, 0, PC.offwhite, { ao: false });
  for (let i = 0; i < 16; i++) { const t = (i / 16) * 4, side = Math.floor(t), f = t - side; const px = [-1, 1, 1, -1][side], pz = [-1, -1, 1, 1][side], qx = [1, 1, -1, -1][side], qz = [-1, 1, 1, -1][side]; const lx = lerp(px, qx, f) * (s / 2 - 0.3), lz = lerp(pz, qz, f) * (s / 2 - 0.3); W.cyl(0.08, 0.1, 0.12, lx, 0.18, lz, PC.metalDk, { seg: 8 }); W.sphere(0.1, 0.08, 0.1, lx, 0.25, lz, GLOW.amber, { layer: 'glow' }); }
  W.lamp(0, 2, 0, 0xffb347, 4, 16, { halo: 0 });
  W.box(0.6, 1.5, 0.6, s / 2 + 2, 0.75, s / 2 + 2, PC.metal, { layer: 'metal' });          // windsock mast base
  W.cyl(0.05, 0.05, 5, s / 2 + 2, 3, s / 2 + 2, PC.metal, { seg: 6, layer: 'metal' });
  for (let i = 0; i < 4; i++) W.cyl(0.3 - i * 0.04, 0.34 - i * 0.04, 0.4, s / 2 + 2.3 + i * 0.38, 5.3 - i * 0.06, s / 2 + 2, i % 2 ? PC.white : PC.orange, { rz: Math.PI / 2 - 0.15, seg: 10, layer: 'cloth', open: true });
  W.pop();
}
function flagpole(x, z, h = 12) {
  W.push(x, 0, z);
  W.cyl(0.8, 0.9, 0.4, 0, 0.2, 0, PC.concrete, { seg: 8 });
  W.cyl(0.05, 0.08, h, 0, h / 2, 0, PC.alu, { seg: 8, layer: 'metal' });
  W.sphere(0.15, 0.15, 0.15, 0, h + 0.08, 0, PC.brass, { layer: 'metal' });
  for (let i = 0; i < 10; i++) W.box(0.22, 1.2, 0.02, 0.15 + i * 0.22, h - 0.7, Math.sin(i * 0.9) * 0.12, i < 4 ? 0x2a3a6a : PC.redLt, { layer: 'cloth', ry: Math.cos(i * 0.9) * 0.4 });
  for (let i = 0; i < 4; i++) W.box(0.88, 0.1, 0.022, 0.48, h - 0.25 - i * 0.24, Math.sin(1) * 0.05, PC.white, { layer: 'cloth', ao: false });
  W.rod([0.05, 1.2, 0], [0.05, h - 0.1, 0], 0.006, PC.offwhite);
  W.pop();
  W.solid(1.6, 0.4, 1.6, x, 0.2, z, 'concrete'); W.solid(0.2, h, 0.2, x, h / 2, z, 'metal');
}
