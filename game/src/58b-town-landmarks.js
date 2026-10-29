// =====================================================================
//  DAR ESSALAM — landmarks: walls, sea bastion, gates, minaret, mosque, tannery
// =====================================================================
// ---------------- town walls (pisé, crenellated, towers; inner faces dressed) ----------------
function rampartRun(a, b, H = 10, T = 2.6, o = {}) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx);
  W.push((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, ry);
  const col = o.col ?? MC.pise;
  W.box(L, H, T, 0, H / 2, 0, col, { t: TX.pise, wear: 6 }); W.solid(L, H, T, 0, H / 2, 0, 'stone');
  W.scope({ lod: 1 }, () => {
    // merlons
    for (let x = -L / 2 + 0.6; x < L / 2 - 0.4; x += 1.5) W.box(0.8, 0.9, T * 0.5, x, H + 0.45, 0, col, { t: TX.pise, wear: 5 });
    // the face toward the town (local -z when o.inner = -1): putlog holes, buttresses, stains, plants
    const s = o.inner ?? 1;
    for (let y = 1.6; y < H - 1; y += 1.25) for (let x = -L / 2 + 0.8 + (y % 2.5) * 0.4; x < L / 2 - 0.5; x += 1.9) W.box(0.18, 0.16, 0.05, x, y, s * (T / 2 + 0.01), 0x3a2a1c, { ao: false, lod: 2 });
    for (let x = -L / 2 + 6; x < L / 2 - 3; x += 12) { W.box(1.4, H * 0.7, 1.2, x, H * 0.35, s * (T / 2 + 0.6), shade(col, 0.95), { t: TX.pise, wear: 6 }); W.solid(1.4, H * 0.7, 1.2, x, H * 0.35, s * (T / 2 + 0.6), 'stone'); }
    for (let x = -L / 2 + mr(1, 4); x < L / 2; x += mr(3, 7)) W.box(mr(0.4, 1.4), mr(2, 6), 0.02, x, H - mr(1.5, 3), s * (T / 2 + 0.012), shade(col, 0.75), { t: TX.pise, wear: 7, ao: false });
    for (let x = -L / 2 + mr(4, 9); x < L / 2; x += mr(9, 20)) bush(x, 0, s * (T / 2 + 0.5), mr(0.5, 0.9), mpick([0x5a6a3a, 0x4a5a32]));
  });
  W.pop();
}
function rampartTower(x, z, s = 7, H = 13, col = MC.pise) {
  GR.rect(x, z, s + 1, s + 1, 0, GR.RESERVED);
  W.box(s, H, s, x, H / 2, z, col, { t: TX.pise, wear: 6 }); W.solid(s, H, s, x, H / 2, z, 'stone');
  W.scope({ lod: 1 }, () => {
    for (const [ox, oz, rx] of [[0, s / 2, 0], [0, -s / 2, 0], [s / 2, 0, 1], [-s / 2, 0, 1]]) {
      for (let k = -1; k <= 1; k++) W.box(rx ? 0.6 : 0.8, 0.9, rx ? 0.8 : 0.6, x + ox * (rx ? 1 : 0) + (rx ? 0 : k * s * 0.33), H + 0.45, z + oz * (rx ? 0 : 1) + (rx ? k * s * 0.33 : 0), col, { t: TX.pise });
      W.box(rx ? 0.04 : 0.3, 1.0, rx ? 0.3 : 0.04, x + ox, H - 3, z + oz, 0x1a140e, { ao: false });   // arrow slit
    }
    W.box(s + 0.3, 0.3, s + 0.3, x, H - 1.6, z, shade(col, 0.9), { t: TX.pise, wear: 4 });   // corbel band
  });
}
function townWalls() {
  // north
  for (const [a, b] of [[[-156, -136], [-80, -136]], [[-80, -136], [-10, -136]], [[4, -136], [64, -136]]]) rampartRun(a, b, 10, 2.6, { inner: 1 });
  // west
  for (const [a, b] of [[[-156, -136], [-156, -40]], [[-156, -40], [-156, 0]], [[-156, 6], [-156, 95]]]) rampartRun(a, b, 10, 2.6, { inner: -1 });
  // east (south of the kasbah, behind the Mellah)
  rampartRun([154, -36], [154, 92], 10, 2.6, { inner: 1 });
  for (const [x, z] of [[-156, -136], [-118, -136], [-80, -136], [-40, -136], [30, -136], [-156, -96], [-156, -56], [-156, 40], [-156, 70], [154, 0], [154, 40], [154, 88]]) rampartTower(x, z);
  townGate(-3, -136, 0, 'Bab Doukkala', true);
  townGate(-156, 3, Math.PI / 2, 'Bab Zerka');
}
// a closed town gate: twin towers, horseshoe arch, studded doors, inscription band
function townGate(x, z, ry, name, open = false) {
  W.push(x, 0, z, ry);
  const col = 0xc8a07a, w = 5.2, H = 12;
  for (const s of [-1, 1]) rampartTower(s * 5.4, 0, 5.6, 14, col);
  wall('x', -2.6, 2.6, 0, 0, H, 3.4, { col, tx: TX.stone, side: -1, ops: [{ at: 0, w: 3.6, h: 6.2, kind: 'archdoor', arch: 'horse', style: 'carved', leaf: open ? 'open' : 'closed', double: true, zellige: 1, rimCol: 0xe8d8b8 }] });
  W.box(w + 6, 0.8, 0.2, 0, H - 2, 1.8, 0xffffff, { t: TX.zellige, wear: 1, lod: 1 });
  for (let i = -2; i <= 2; i++) W.box(0.8, 0.9, 1.2, i * 1.1, H + 0.45, 0, col, { t: TX.stone, lod: 1 });
  W.pop();
  TOWN.spots[name] = { x, z };
}

// ---------------- the skala: sea bastion with cannons, vaulted workshops beneath ----------------
function skala() {
  const x0 = -154, x1 = -24, zIn = 89.5, zOut = 100, H = 6;
  const L = x1 - x0, cx = (x0 + x1) / 2, cz = (zIn + zOut) / 2;
  // mass with vaulted workshops opening onto the lane
  W.box(L, H, zOut - zIn, cx, H / 2, cz, MC.stone, { t: TX.stone, wear: 6 });
  W.solid(L, H, zOut - zIn, cx, H / 2, cz, 'stone', { walk: true });
  W.box(L, 0.05, zOut - zIn - 0.6, cx, H + 0.03, cz, 0xb8a888, { t: TX.paving, wear: 5, ao: false });
  W.scope({ lod: 1 }, () => {
    for (let x = x0 + 4; x < x1 - 3; x += 5.5) {   // vault arches with woodworkers' shops (thuya marquetry)
      W.push(x, 0, zIn, Math.PI);
      archRim(3.2, 2.2, 1.6, 'round', 0.02, 0xd8c8a8, TX.stone);
      W.box(3.2, 3.8, 0.04, 0, 1.9, -0.0, 0x1a140e, { ao: false });
      W.box(3.0, 1.6, 0.02, 0, 3.0, -0.02, 0x2a1e14, { ao: false });
      if (mchance(0.75)) W.scope({ lod: 2 }, () => { for (let k = 0; k < 4; k++) W.box(mr(0.3, 0.6), mr(0.3, 0.7), 0.25, mr(-1.2, 1.2), mr(0.3, 2.4), 0.25, mpick([0x8a5a2a, 0xa06a3a, 0x6a4a2a]), { t: TX.carved }); crate(mr(-1, 1), 0, 0.6, 0.7, 0.5, 0.5, mr(0, 1), 0x8a6a4a, false); });
      W.pop();
    }
    // parapet with embrasures facing the sea, low wall to the town
    for (let x = x0 + 0.8; x < x1; x += 2.6) { W.box(1.8, 1.4, 0.9, x, H + 0.7, zOut - 0.45, MC.stone, { t: TX.stone, wear: 6 }); W.solid(1.8, 1.4, 0.9, x, H + 0.7, zOut - 0.45, 'stone'); }
    W.box(L, 0.9, 0.5, cx, H + 0.45, zIn + 0.25, MC.stone, { t: TX.stone, wear: 5 }); W.solid(L, 1.1, 0.5, cx, H + 0.55, zIn + 0.25, 'stone');
    for (let x = x0 + 2.1; x < x1 - 1; x += 5.2) cannon(x, H, zOut - 2.4, 0);
    // sea face: weathered, wet at the foot
    W.box(L, 3, 0.05, cx, -1.0, zOut + 0.03, 0x4a5a4a, { t: TX.stone, wear: 7 });
  });
  // steps up the bastion's end, beside the sea gate
  W.push(-23.1, 0, 87.6, 0);
  flight(0, 0, [0, 1], 2.2, 0, H, { col: MC.stone, tx: TX.stone, thick: 6.2, soffit: false });
  W.pop();
  // rock apron below the bastion
  W.scope({ lod: 1 }, () => { for (let x = x0; x < x1; x += mr(2, 4)) rock(x, -1.6, zOut + mr(1, 4), mr(1.2, 2.6), 0x5a5448); });
  // corner bastion tower at the west end, toward the open sea
  rampartTower(x0 + 3, zOut - 4, 9, H + 4, MC.stone);
  TOWN.spots.skalaTop = { x: -60, y: H, z: 96 };
}
// Bab el Bahr: the sea gate where the avenue meets the quay
function seaGate() {
  const z = 90, col = 0xd8c4a0;
  for (const s of [-1, 1]) { rampartTower(s * 7.6, z, 5.2, 13, col); }
  W.box(9.8, 3.2, 3, 0, 9.4, z, col, { t: TX.stone, wear: 4 }); W.solid(9.8, 3.2, 3, 0, 9.4, z, 'stone');
  W.push(0, 0, z, 0);
  const n = 18; for (let i = 0; i < n; i++) { const u0 = -5 + (i / n) * 10, u1 = -5 + ((i + 1) / n) * 10, uc = (u0 + u1) / 2, top = 4.9 + archY('horse', uc, 10) * 0.75; W.box(u1 - u0, 7.8 - top, 3, uc, (top + 7.8) / 2, 0, col, { t: TX.stone, wear: 4 }); }
  archRim(10, 4.9, 3.9, 'horse', 1.5, 0xf0e2c4, TX.gebs, 2); W.push(0, 0, 0, Math.PI); archRim(10, 4.9, 3.9, 'horse', 1.5, 0xf0e2c4, TX.gebs, 2); W.pop();
  W.box(6, 0.7, 0.1, 0, 9.0, 1.56, 0xffffff, { t: TX.zellige, wear: 2, lod: 1 });
  W.pop();
  for (const s of [-1, 1]) wallLantern(s * 5.4, 4.4, 0, true);
}

// ---------------- the minaret: climbable, a gallery at 25 m over the whole town ----------------
function climbMinaret(cx, cz) {
  const s = 6.2, T = 0.75, I = s / 2 - T, core = 0.7, seg = 0.9, turns = 7, Ht = turns * 4 * seg, top = Ht + 1.0;
  const col = 0xdcc2a0;
  W.push(cx, 0, cz, 0);
  // shaft walls, banded so openings can sit at different heights; door on the east face
  const faces = [['x', -s / 2, s / 2, s / 2 - T / 2, 1], ['x', -s / 2, s / 2, -s / 2 + T / 2, -1], ['z', -s / 2 + T, s / 2 - T, s / 2 - T / 2, 1], ['z', -s / 2 + T, s / 2 - T, -s / 2 + T / 2, -1]];
  for (let b = 0; b * 3.6 < top; b++) {
    const y0 = b * 3.6, h = Math.min(3.6, top - y0);
    faces.forEach(([ax, a0, a1, c, side], fi) => {
      const ops = [];
      if (b === 0 && fi === 2) ops.push({ at: 0, w: 1.1, h: 2.4, kind: 'archdoor', arch: 'horse', style: 'carved', leaf: 'open', zellige: 0, rimCol: 0xf2e6cc });
      else if (b > 0 && b % 2 === (fi % 2) && h > 2) ops.push({ at: 0, w: 0.32, h: 1.1, sill: 1.3, kind: 'win', win: 'open' });
      wall(ax, a0, a1, c, y0, h, T, { col, tx: TX.plaster, wear: 3, side, ops, inCol: 0xcab494, inTx: TX.plaster, dimIn: 0.45 });
    });
  }
  // decoration: blind arcade panels with carved lattice, zellige band, merlons
  W.scope({ lod: 1 }, () => {
    for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      W.push(0, 0, 0, r);
      for (const yy of [7.2, 15.2]) {
        W.box(s - 1.4, 5.6, 0.06, 0, yy + 2.8, s / 2 + 0.04, shade(col, 0.96), { t: TX.carved, wear: 2 });
        for (const k of [-1, 0, 1]) archRim(0.9, yy + 3.4, 0.7, 'horse', s / 2 + 0.07, 0xf2e6cc, TX.gebs);
      }
      W.box(s + 0.04, 1.0, 0.06, 0, Ht - 1.0, s / 2 + 0.04, 0xffffff, { t: TX.zellige, wear: 0 });
      W.box(s + 0.3, 0.25, 0.3, 0, Ht - 0.3, s / 2 + 0.05, 0xf2e6cc, { t: TX.gebs });
      for (let i = 0; i < 4; i++) W.box(0.7, 0.45, 0.6, -s / 2 + 0.7 + i * (s - 1.4) / 3, top + 0.22, s / 2 - 0.3, col, { t: TX.plaster });
      W.pop();
    }
  });
  // interior: central core and a square spiral of short flights and corner landings
  W.scope({ dim: 0.55 }, () => {
    W.box(core * 2, Ht + 0.1, core * 2, 0, (Ht + 0.1) / 2, 0, 0xcab494, { t: TX.plaster }); W.solid(core * 2, Ht + 0.1, core * 2, 0, (Ht + 0.1) / 2, 0, 'plaster');
    W.box(I * 2, 0.06, I * 2, 0, 0.03, 0, MC.stone, { t: TX.stone, wear: 5, ao: false });
    const C = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => [a * (core + I) / 2, b * (core + I) / 2]), wd = I - core;
    let y = 0;
    for (let t = 0; t < turns; t++) for (let k = 0; k < 4; k++) {
      const a = C[k], b = C[(k + 1) % 4], dir = [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])];
      const start = [a[0] + dir[0] * wd / 2, a[1] + dir[1] * wd / 2];
      flight(start[0], start[1], dir, wd, y, y + seg, { run: (2 * core) / 5, col: 0xb8a68a, tx: TX.stone, soffit: false, thick: 0.3 });
      y += seg;
      const isTop = t === turns - 1 && k === 3;
      if (!isTop) { W.box(wd, 0.2, wd, b[0], y - 0.1, b[1], 0xb8a68a, { t: TX.stone, ao: false }); W.solid(wd, 0.2, wd, b[0], y - 0.1, b[1], 'stone', { walk: true }); }
    }
    // the gallery deck at the top: a ring walk round the core, open where the last flight arrives
    // (the east side and north-east corner stay open: that's the stairwell)
    for (const [x0, z0, x1, z1] of [[-I, core, I, I], [-I, -core, -core, core], [-I, -I, core, -core]]) { W.box(x1 - x0, 0.2, z1 - z0, (x0 + x1) / 2, Ht - 0.1, (z0 + z1) / 2, 0xc8b49a, { t: TX.terrazzo, ao: false }); W.solid(x1 - x0, 0.2, z1 - z0, (x0 + x1) / 2, Ht - 0.1, (z0 + z1) / 2, 'stone', { walk: true }); }
    railing(core, -I, core, -core, Ht, 'iron');
    hangLantern(0.0, Ht - 0.4, I - 0.4, 0xffc070, 0.2, true);
  });
  // lantern storey on the core: small tower, green tile pyramid, brass finials
  const ls = 2.2, LH = 4.4;
  W.box(ls, LH, ls, 0, Ht + LH / 2, 0, col, { t: TX.plaster }); W.solid(ls, LH, ls, 0, Ht + LH / 2, 0, 'plaster');
  W.scope({ lod: 1 }, () => { for (const r of [0, 1, 2, 3]) { W.push(0, 0, 0, r * Math.PI / 2); W.box(0.7, 1.6, 0.03, 0, Ht + 2.4, ls / 2 + 0.02, 0x1a140e, { ao: false }); archRim(0.7, Ht + 2.9, 0.5, 'horse', ls / 2 + 0.03, 0xf2e6cc, TX.gebs); W.box(ls + 0.04, 0.5, 0.04, 0, Ht + LH - 0.5, ls / 2 + 0.02, 0xffffff, { t: TX.zellige, wear: 0 }); W.pop(); } });
  W.pyramid(ls + 0.5, 2.2, ls + 0.5, 0, Ht + LH + 1.1, 0, MC.tile, { t: TX.rooftile });
  W.rod([0, Ht + LH + 2, 0], [0, Ht + LH + 4.6, 0], 0.05, MC.brass, { layer: 'metal' });
  for (let i = 0; i < 3; i++) W.sphere(0.42 - i * 0.1, 0.42 - i * 0.1, 0.42 - i * 0.1, 0, Ht + LH + 2.7 + i * 0.7, 0, MC.brass, { layer: 'metal', seg: 10, hseg: 6 });
  W.pop();
  TOWN.spots.minaretTop = { x: cx, y: Ht, z: cz + 1.6 };
  TOWN.spots.minaretDoor = { x: cx + s / 2 + 1, z: cz };
}

// ---------------- the Great Mosque (exterior: courtyard walls, prayer-hall roofs, shops in its flank) ----------------
function greatMosque() {
  const { x0, z0, x1, z1 } = MOSQUE, w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, col = 0xe2d2b4, H = 9;
  W.push(cx, 0, cz, 0);
  // prayer hall (north 60%) and walled courtyard (south)
  const hz = -d / 2 + d * 0.6;
  W.box(w, H, d * 0.6, 0, H / 2, (-d / 2 + hz) / 2, col, { t: TX.plaster, wear: 2 }); W.solid(w, H, d * 0.6, 0, H / 2, (-d / 2 + hz) / 2, 'plaster');
  const cd = d / 2 - hz;
  for (const [ax, a0, a1, c, side] of [['x', -w / 2, w / 2 - 6.4, d / 2 - 0.4, 1], ['z', hz, d / 2, -w / 2 + 0.4, -1], ['z', hz, d / 2 - 6.4, w / 2 - 0.4, 1]]) {
    const ops = ax === 'x' ? [{ at: -4, w: 2.6, h: 4.4, kind: 'archdoor', arch: 'horse', style: 'carved', leaf: 'closed', double: true, hood: true, zellige: 0, rimCol: 0xf2e6cc }] : [];
    wall(ax, a0, a1, c, 0, H - 1.5, 0.8, { col, tx: TX.plaster, wear: 3, side, ops, plinth: 0.8 });
  }
  W.box(w - 2, 0.05, cd - 1, 0, 0.04, hz + cd / 2, 0xffffff, { t: TX.zellige, wear: 2, ao: false });
  fountain(-4, 0, hz + cd / 2, 1.8, 3);
  // ridged green-tile roofs over the naves + a cupola over the mihrab
  W.scope({ lod: 0 }, () => {
    const n = Math.floor(w / 5.4);
    for (let i = 0; i < n; i++) { const xx = -w / 2 + (i + 0.5) * w / n; for (const s of [-1, 1]) W.box(w / n * 0.56, 0.14, d * 0.58, xx + s * w / n * 0.24, H + 1.2, (-d / 2 + hz) / 2, MC.tile, { rz: -s * 0.62, t: TX.rooftile, wear: 2 }); W.box(0.2, 0.25, d * 0.58, xx, H + 1.85, (-d / 2 + hz) / 2, MC.greenDk, { t: TX.rooftile }); }
    W.box(w + 0.6, 0.4, d * 0.6 + 0.6, 0, H + 0.2, (-d / 2 + hz) / 2, MC.cedarDk, { t: TX.carved });
    W.pyramid(6, 2.6, 6, 0, H + 3.0, -d / 2 + 4, MC.tile, { t: TX.rooftile });
  });
  // the hall's south face, seen across the courtyard: arcade of horseshoe arches
  W.scope({ lod: 1 }, () => { for (let i = 0; i < 6; i++) { const xx = -w / 2 + 3 + i * (w - 6) / 5; W.push(xx, 0, hz, 0); W.box(2.4, 4.6, 0.04, 0, 2.3, 0.02, 0x1e160e, { ao: false }); archRim(2.4, 3.4, 1.8, 'horse', 0.04, 0xf2e6cc, TX.gebs, 1); W.pop(); } });
  W.pop();
  // the east flank faces the rug souk: little shops let into the mosque wall (habous shops)
  W.push(x1, 0, cz, Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const at = -d / 2 + 2.6 + i * 4.6;
    W.box(3.2, 2.6, 0.05, at, 1.3, 0.02, 0x1a140e, { ao: false });
    W.scope({ lod: 1 }, () => { W.box(3.4, 0.1, 0.2, at, 2.65, 0.1, MC.cedarDk, { t: TX.wood }); awning(3.4, 2.75, 0, mpick([[0xb03a2e, 0xe8dcc0], [0x2a5a8a, 0xe8dcc0], [0x8a3a5a, 0xe8c8a0]])); });
    W.scope({ lod: 2 }, () => { if (i % 2) hangingRug(at - 0.8, 0.3, 0.12, 0, 1.3, 2.1); else { rugPile(at, 0, 0.8, 0); babouches(at - 1.4, 0, 0.3, 0, 1.5, 3); } });
  }
  W.pop();
  // and its west and north walls get the treatment too
  W.push(x0, 0, cz, -Math.PI / 2); dressFace(d, H, col, { windows: false, green: false }); W.pop();
  W.push(cx, 0, z0, Math.PI); dressFace(w, H, col, { windows: false, green: false }); W.pop();
  climbMinaret(x1 - 3.4, z1 - 3.4);
  // forecourt: ablution fountain, shoes, a bench under a fig tree
  W.scope({ lod: 1 }, () => {
    wallFountain(-36.5, 0, -28.6, 0, 3);
    tree(-41, 0, -18, 'ficus', 0.9); bench(-38, 0, -16.5, Math.PI);
    for (let i = 0; i < 6; i++) slippers(-46 + i * 0.6, 0, -27.2, mr(-0.3, 0.3));
  });
}

// ---------------- the tannery: honeycomb of dye vats, hides drying on the terraces ----------------
function tanneryYard() {
  const { x0, z0, x1, z1 } = TANNERY, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
  W.push(cx, 0, cz, 0);
  W.push(-1, 0, 0);
  const pw = w - 12, pd = d - 10;
  W.box(pw, 0.9, pd, 0, 0.45, 0, 0xc8b8a0, { t: TX.stone, wear: 7 }); W.solid(pw, 0.9, pd, 0, 0.45, 0, 'stone', { walk: true });
  const dyes = [0xb8862a, 0x8a2a1a, 0x5a2a6a, 0xe8e0d0, 0x2a5a8a, 0xc8b02a, 0x6a4a2a, 0x3a6a3a, 0xd05a2a, 0xa83a2a];
  const nx = Math.floor(pw / 3.6), nz = Math.floor(pd / 3.6);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const px = -pw / 2 + (i + 0.5) * pw / nx, pz = -pd / 2 + (j + 0.5) * pd / nz;
    W.cyl(1.55, 1.55, 0.25, px, 0.97, pz, 0xe0d4c0, { seg: 10, t: TX.stone, wear: 6 });
    W.cyl(1.3, 1.3, 0.02, px, 1.08, pz, mpick(dyes), { seg: 10, t: TX.gravel, wear: 2, ao: false });
    if ((i + j) % 5 === 0) W.scope({ lod: 2 }, () => { W.box(0.8, 0.02, 1.0, px + 1.2, 1.1, pz, 0xc89a5a, { layer: 'cloth', ry: mr(0, 3), ao: false }); });
  }
  // the three-storey leather houses round it, terraces stepping down to the vats
  W.pop(); W.pop();
  for (const [a, b, c, e, H] of [[x0, z0, x1, z0 + 5, 9.6], [x0, z1 - 5, x0 + 18, z1, 6.6], [x0, z0 + 5, x0 + 5, z1 - 5, 9.6]]) {
    const ww = c - a, dd = e - b;
    W.box(ww, H, dd, (a + c) / 2, H / 2, (b + e) / 2, mpick([MC.ochre, MC.plaster, MC.rose]), { t: TX.plaster, wear: 6 }); W.solid(ww, H, dd, (a + c) / 2, H / 2, (b + e) / 2, 'plaster', { walk: true });
    W.scope({ lod: 1 }, () => { for (let k = 0; k < Math.floor(ww * dd / 3); k++) W.box(mr(0.6, 1.1), 0.03, mr(0.8, 1.3), mr(a + 0.6, c - 0.6), H + 0.03, mr(b + 0.6, e - 0.6), mpick([0xd8b878, 0xb88a4a, 0xe8dcc0, 0x8a2a1a, 0xc8a050]), { ry: mr(-0.4, 0.4), layer: 'cloth', ao: false }); });
  }
  // the viewing terrace of the leather shop on the east side, reached by a stair from the lane
  const tx = x1 - 6, H = 6.6;
  W.box(6, H, d, tx + 3, H / 2, cz, MC.cream, { t: TX.plaster, wear: 4 }); W.solid(6, H, d, tx + 3, H / 2, cz, 'plaster', { walk: true });
  W.box(6, 0.05, d, tx + 3, H + 0.03, cz, 0xb87a5a, { t: TX.ceramic, wear: 4, ao: false });
  railing(tx, z0 + 5, tx, z1, H, 'iron');
  W.push(x1 + 1.2, 0, z1 - 0.5, 0); flight(0, 0, [0, -1], 1.6, 0, H, { col: MC.stone, tx: TX.stone, thick: 7, soffit: false }); W.pop();
  W.scope({ lod: 2 }, () => { for (let k = 0; k < 6; k++) { hangingRug(tx + 5.9, H - 0.2 - 2.2, z0 + 6 + k * 4, -Math.PI / 2, 1.4, 2.0, mpick([0xc8a050, 0x8a2a1a, 0x5a2a6a, 0x2a5a8a])); } babouches(tx + 1.2, H, z0 + 8, Math.PI / 2, 4, 5); for (let k = 0; k < 4; k++) plantPot(tx + 0.6, H, z0 + 14 + k * 3, 'geranium', 1.2); });
  TOWN.spots.tanneryTerrace = { x: tx + 2, y: H, z: cz };
}
