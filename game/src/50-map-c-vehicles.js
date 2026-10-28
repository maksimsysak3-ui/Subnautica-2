// =====================================================================
//  WORLD MAP — vehicles & containers (reused by the city)
// =====================================================================
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

