// =====================================================================
//  DAR EL MAKHZEN — the palace north of the town, behind its own walls
// =====================================================================
// Out through Bab Doukkala: a palm avenue to the Mechouar (parade ground), the gatehouse, a forecourt
// with barracks, an inner gate, the Andalusian garden with its long pool, and the palace itself:
// arcaded wings, corner towers and the domed throne hall (enterable). Guarded all the way in.
const PALACE = { x0: -120, x1: 120, z0: -440, z1: -206 };
const MECHOUAR = { x0: -70, z0: -200, x1: 70, z1: -150 };
function buildPalace() {
  const col = 0xd8b48a, wallCol = 0xc89a70, H = 13;
  // ---- the approach ----
  lane('palaceRoad', [[-3, -132], [-3, -142], [0, -150]], 8, 'avenue', { raw: true });
  plaza('Mechouar', MECHOUAR, 0xd0c0a0, TX.paving);
  for (let z = -144; z > -152; z -= 6) for (const s of [-1, 1]) palm(s * 6.5 - 1.5, 0, z, 8);
  for (let x = -64; x <= 64; x += 16) { palm(x, 0, -152, 9); palm(x, 0, -198, 9); }
  for (const x of [-40, -20, 20, 40]) { W.rod([x, 0, -175], [x, 14, -175], 0.08, 0xd8d8d8, { layer: 'metal' }); W.box(3.2, 2.0, 0.03, x + 1.6, 12.8, -175, 0xc0302a, { layer: 'cloth' }); W.box(0.9, 0.9, 0.035, x + 1.6, 12.8, -175, 0x2a6a3a, { layer: 'cloth', rz: Math.PI / 4 }); }
  W.scope({ lod: 1 }, () => {
    sandbagWall(-14, -160, -6, -160, 3); sandbagWall(6, -160, 14, -160, 3);
    W.box(0.14, 0.14, 7, 0, 1.0, -162, 0xd83a2a, { layer: 'metal', ry: Math.PI / 2 });
    for (const x of [-12, 12]) { W.box(2.2, 2.6, 2.2, x, 1.3, -166, 0xe8e4dc, { t: TX.plaster, wear: 3 }); W.solid(2.2, 2.6, 2.2, x, 1.3, -166, 'plaster'); W.box(2.6, 0.2, 2.6, x, 2.7, -166, MC.tile, { t: TX.rooftile }); W.box(1.2, 0.8, 0.03, x, 1.6, -164.88, 0x14100c); }
    for (let i = 0; i < 6; i++) concreteBarrier(-25 + i * 10, 0, -190, 0, PC.concreteLt, true);
    for (const [x, z] of [[-60, -160], [60, -160], [-60, -196], [60, -196]]) floodPole(x, 0, z, 0, 9, 2);
    cargoTruck(-50, -185, 0.1, PC.olive); pickup(46, -182, -0.2, 0x3a3a34); pickup(52, -186, -0.25, 0xd8d4c8);
  });
  // ---- outer walls, towers, the gatehouse ----
  const { x0, x1, z0, z1 } = PALACE;
  rampartRun([x0, z1], [-9, z1], H, 3.2, { inner: -1, col: wallCol }); rampartRun([9, z1], [x1, z1], H, 3.2, { inner: -1, col: wallCol });
  rampartRun([x0, z0], [x1, z0], H, 3.2, { inner: 1, col: wallCol });
  rampartRun([x0, z0], [x0, z1], H, 3.2, { inner: -1, col: wallCol }); rampartRun([x1, z0], [x1, z1], H, 3.2, { inner: 1, col: wallCol });
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) rampartTower(x, z, 12, 20, wallCol);
  for (const x of [-60, 60]) { rampartTower(x, z1, 8, 16, wallCol); rampartTower(x, z0, 8, 16, wallCol); }
  for (const z of [-270, -340]) { rampartTower(x0, z, 8, 16, wallCol); rampartTower(x1, z, 8, 16, wallCol); }
  palaceGate(0, z1, 9, 15, wallCol, 'Bab el Makhzen');
  // ---- forecourt: barracks along both flanks, vehicles, sandbagged posts ----
  plaza('Palace forecourt', { x0: x0 + 2, z0: -256, x1: x1 - 2, z1: z1 - 2 }, 0xc8b898, TX.paving);
  for (const s of [-1, 1]) {
    const bx = s * 104, bw = 22, bd = 42;
    W.box(bw, 7, bd, bx, 3.5, -231, col, { t: TX.plaster, wear: 3 }); W.solid(bw, 7, bd, bx, 3.5, -231, 'plaster');
    W.push(bx - s * bw / 2, 0, -231, s * -Math.PI / 2 + (s < 0 ? Math.PI : 0)); dressFace(bd, 7, col, { green: false }); W.pop();
    lightParapet(bw, bd, 7, 0.9, col, 'merlon'); W.push(bx, 0, -231); lightParapet(bw, bd, 7, 0.9, col, 'merlon'); W.pop();
    W.scope({ lod: 1 }, () => { for (let z = -248; z <= -214; z += 6) { W.box(0.04, 2.2, 1.2, bx - s * (bw / 2 + 0.02), 1.1, z, 0x1e160e); archRim(1.2, 1.6, 0.6, 'horse', 0.0, 0xf0e2c4, TX.gebs); } });
    sandbagWall(s * 30, -214, s * 30, -222, 3); hescoLine(s * 60, -248, s * 74, -248, 2);
  }
  W.scope({ lod: 1 }, () => { cargoTruck(-70, -230, Math.PI / 2, PC.olive); cargoTruck(-70, -238, Math.PI / 2, PC.olive); pickup(70, -232, -Math.PI / 2, 0x3a3a34); pickup(70, -240, -Math.PI / 2, 0x3a3a34); fountain(-40, 0, -238, 2.4, 3); fountain(40, 0, -238, 2.4, 3); for (const [x, z] of [[-30, -250], [30, -250]]) floodPole(x, 0, z, 0, 9, 2); });
  // ---- inner wall and gate into the gardens ----
  rampartRun([x0, -258], [-7, -258], 9, 2.4, { inner: -1, col }); rampartRun([7, -258], [x1, -258], 9, 2.4, { inner: -1, col });
  palaceGate(0, -258, 7, 11, col, 'Inner gate');
  // ---- the Andalusian garden: four quarters, a long reflecting pool, pavilions at each end ----
  const gz0 = -334, gz1 = -260;
  plaza('Palace garden', { x0: x0 + 2, z0: gz0, x1: x1 - 2, z1: gz1 }, 0xd8c8a8, TX.paving);
  W.box(10, 0.5, 60, 0, 0.25, -297, MC.stone, { t: TX.stone, wear: 3 }); W.solid(10, 0.5, 60, 0, 0.25, -297, 'stone');
  W.box(8.6, 0.04, 58.6, 0, 0.46, -297, 0x2a6a7a, { layer: 'glass', ao: false });
  W.box(8.4, 0.05, 58.4, 0, 0.42, -297, 0xffffff, { t: TX.zellige, wear: 4, ao: false });
  for (let z = -322; z <= -272; z += 10) { W.cyl(0.12, 0.16, 0.6, -3.6, 0.6, z, MC.brass, { layer: 'metal', seg: 8 }); W.cyl(0.12, 0.16, 0.6, 3.6, 0.6, z, MC.brass, { layer: 'metal', seg: 8 }); }
  for (const z of [-266, -328]) gardenPavilion(0, z);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const bx = sx * 58, bz = -297 + sz * 18, bw = 92, bd = 30;
    W.box(bw, 0.35, bd, bx, 0.17, bz, 0x6a5a3a, { t: TX.earth, wear: 3 }); W.box(bw - 0.4, 0.04, bd - 0.4, bx, 0.37, bz, 0x5a7a34, { t: TX.leaf, wear: 2, ao: false });
    W.solid(bw, 0.37, bd, bx, 0.18, bz, 'stone', { walk: true });
    for (let i = 0; i < 7; i++) for (let j = 0; j < 3; j++) tree(bx - bw / 2 + 7 + i * (bw - 14) / 6, 0.35, bz - bd / 2 + 6 + j * (bd - 12) / 2, (i + j) % 3 ? 'orange' : 'olive', 1.1);
    W.scope({ lod: 2 }, () => { for (let k = 0; k < 30; k++) bush(bx + mr(-bw / 2 + 1, bw / 2 - 1), 0.37, bz + mr(-bd / 2 + 1, bd / 2 - 1), mr(0.4, 0.7), mpick([0x3a6a2a, 0xc0306a, 0xe8c040, 0x4a7a32])); });
  }
  for (let x = -110; x <= 110; x += 10) { cypress(x, gz1 - 1.5, 9); cypress(x, gz0 + 1.5, 9); }
  // ---- the palace ----
  palaceBlock(col);
  // guards: a lot of them
  TOWN.guards.push(...[
    [-6, -158, 0], [6, -158, 0], [-20, -185, 0.4], [20, -185, -0.4], [-8, -210, 0], [8, -210, 0], [-40, -228, 0.8], [40, -228, -0.8], [-85, -244, 1.6], [85, -244, -1.6], [0, -246, 0],
    [-6, -262, 0], [6, -262, 0], [-55, -280, 0.3], [55, -280, -0.3], [-55, -316, 2.8], [55, -316, -2.8], [-14, -300, 1.57], [14, -300, -1.57],
    [-24, -340, 0], [24, -340, 0], [-70, -342, 0.2], [70, -342, -0.2], [-6, -350, 0], [6, -350, 0], [-10, -366, 3.14], [10, -366, 3.14],
    [-108, -430, 0.8], [108, -430, -0.8], [-108, -214, 2.4], [108, -214, -2.4],
  ].map(([x, z, yaw]) => ({ x, z, yaw })));
  TOWN.spots.palaceGate = { x: 0, z: z1 + 4 }; TOWN.spots.throneHall = { x: 0, y: 0.3, z: -360 };
}
function palaceGate(x, z, w, H, col, name) {
  W.push(x, 0, z, 0);
  for (const s of [-1, 1]) rampartTower(s * (w / 2 + 3.6), 0, 7, H + 4, col);
  wall('x', -w / 2, w / 2, 0, 0, H, 4, { col, tx: TX.plaster, side: 1, ops: [{ at: 0, w: w - 2.4, h: H - 3.5, kind: 'archdoor', arch: 'horse', style: 'carved', leaf: 'open', double: true, zellige: 2, rimCol: 0xf2e6cc }] });
  W.scope({ lod: 1 }, () => { for (const sz of [1, -1]) { W.push(0, 0, 0, sz > 0 ? 0 : Math.PI); W.box(w + 8, 1.2, 0.1, 0, H - 1.4, 2.06, 0xffffff, { t: TX.zellige, wear: 1 }); W.box(w + 9, 0.5, 2.6, 0, H + 0.25, 0.6, MC.tile, { t: TX.rooftile, rx: -0.3 }); for (const s of [-1, 1]) wallLantern(s * (w / 2 - 0.2), 4.6, 2.0, true); W.pop(); } });
  W.pop();
  TOWN.spots[name] = { x, z };
}
function gardenPavilion(x, z) {
  W.push(x, 0, z, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { W.cyl(0.25, 0.28, 4.2, sx * 3, 2.1, sz * 3, 0xf0e6d2, { seg: 10, t: TX.plaster }); W.solid(0.5, 4.2, 0.5, sx * 3, 2.1, sz * 3, 'stone'); }
  W.box(7.2, 0.8, 7.2, 0, 4.6, 0, MC.cedar, { t: TX.carved });
  W.pyramid(8.4, 3, 8.4, 0, 6.5, 0, MC.tile, { t: TX.rooftile });
  W.rod([0, 8, 0], [0, 9.6, 0], 0.05, MC.brass, { layer: 'metal' }); W.sphere(0.3, 0.3, 0.3, 0, 9.4, 0, MC.brass, { layer: 'metal', seg: 8, hseg: 6 });
  W.box(6.4, 0.1, 6.4, 0, 0.1, 0, 0xffffff, { t: TX.zellige, wear: 2, ao: false });
  fountain(0, 0.1, 0, 1.2, 3);
  hangLantern(0, 4.2, 0, 0xffc070, 0.8, true);
  W.pop();
}
// the palace: two arcaded wings, four corner towers, and the domed throne hall in the middle (enterable)
function palaceBlock(col) {
  const fz = -336, bz = -428, hx = 16, hz = -376, Hw = 12, Ht = 15;
  // wings and the block behind the hall
  for (const s of [-1, 1]) {
    const cx = s * (hx + 74) / 2 + s * 0.0, wx = 74 - hx;   // wing from x=±16 to ±90
    const mx = s * (hx + 90) / 2, ww = 90 - hx;
    W.box(ww, Hw, bz - fz < 0 ? fz - bz : 0, mx, Hw / 2, (fz + bz) / 2, col, { t: TX.plaster, wear: 2 }); W.solid(ww, Hw, fz - bz, mx, Hw / 2, (fz + bz) / 2, 'plaster');
    void cx; void wx;
    // arcaded front: deep horseshoe arches with zellige, windows above, a balcony run
    W.scope({ lod: 1 }, () => {
      for (let x = s * (hx + 4); s > 0 ? x < 88 : x > -88; x += s * 6) {
        W.push(x, 0, fz, 0);
        W.box(3.2, 5.2, 0.04, 0, 2.6, 0.02, 0x1e160e, { ao: false });
        archRim(3.2, 3.6, 2.4, 'horse', 0.05, 0xf2e6cc, TX.gebs, 3);
        W.box(1.3, 2.0, 0.04, 0, 8.2, 0.02, 0x14100c, { ao: false }); W.box(1.5, 0.12, 0.3, 0, 7.15, 0.15, MC.stone, { t: TX.stone });
        mashrabiya(1.3, 7.2, 2.0, 0.0, MC.cedar);
        W.pop();
      }
      W.box(ww, 1.0, 0.12, mx, Hw - 1.2, fz + 0.06, 0xffffff, { t: TX.zellige, wear: 1 });
    });
    W.push(mx, 0, (fz + bz) / 2); tiledCornice(ww, fz - bz, Hw, col); W.pop();
    // the wing's far end and back are dressed too
    W.push(s * 90, 0, (fz + bz) / 2, s * Math.PI / 2); dressFace(fz - bz, Hw, col, { green: false }); W.pop();
    W.push(mx, 0, bz, Math.PI); dressFace(ww, Hw, col, { green: false }); W.pop();
    // corner towers
    for (const z of [fz - 4, bz + 4]) {
      const tx = s * 92;
      W.box(12, 22, 12, tx, 11, z, col, { t: TX.plaster, wear: 2 }); W.solid(12, 22, 12, tx, 11, z, 'plaster');
      W.scope({ lod: 1 }, () => { for (const r of [0, 1, 2, 3]) { W.push(tx, 0, z, r * Math.PI / 2); W.box(9, 6, 0.06, 0, 15, 6.03, shade(col, 0.95), { t: TX.carved }); for (const k of [-1, 0, 1]) { W.box(1.0, 2.2, 0.04, k * 2.8, 14.6, 6.05, 0x14100c); archRim(1.0, 15.2, 0.8, 'horse', 6.06, 0xf2e6cc, TX.gebs); } W.box(12.3, 1.0, 0.08, 0, 20.5, 6.04, 0xffffff, { t: TX.zellige, wear: 1 }); W.pop(); } });
      W.pyramid(13.5, 5, 13.5, tx, 24.6, z, MC.tile, { t: TX.rooftile });
      W.rod([tx, 27, z], [tx, 30, z], 0.06, MC.brass, { layer: 'metal' }); W.sphere(0.5, 0.5, 0.5, tx, 29.3, z, MC.brass, { layer: 'metal', seg: 8, hseg: 6 });
    }
  }
  W.box(2 * hx, Ht, hz - bz, 0, Ht / 2, (hz + bz) / 2, col, { t: TX.plaster, wear: 2 }); W.solid(2 * hx, Ht, hz - bz, 0, Ht / 2, (hz + bz) / 2, 'plaster');
  // ---- the throne hall: x ±16, z −336…−376 ----
  const T = 1.2, inner = 0xf0e2c8;
  walls([
    ['x', -hx, hx, fz - T / 2, 1, [{ at: 0, w: 5, h: 8.5, kind: 'archdoor', arch: 'horse', style: 'carved', leaf: 'open', double: true, hood: true, zellige: 0, rimCol: 0xf2e6cc }, { at: -10, w: 2.2, h: 4, sill: 3, kind: 'archwin', arch: 'horse', win: 'grille', zellige: 1 }, { at: 10, w: 2.2, h: 4, sill: 3, kind: 'archwin', arch: 'horse', win: 'grille', zellige: 1 }]],
    ['x', -hx, hx, hz + T / 2, -1, []], ['z', hz + T, fz - T, -hx + T / 2, -1, []], ['z', hz + T, fz - T, hx - T / 2, 1, []],
  ], 0, Ht, T, col, inner, { dimIn: 0.75 });
  slab(-hx + T, hz + T, hx - T, fz - T, 0.2, { top: 0xffffff, topTx: TX.zellige, topWear: 2, bot: false });
  slab(-hx - 0.1, hz - 0.1, hx + 0.1, fz + 0.1, Ht, { top: MC.roofGravel, topTx: TX.gravel, bot: MC.cedar, botTx: TX.carved, thk: 0.5 });
  // the dome: drum, green tile shell, brass finial
  W.cyl(10, 10, 3, 0, Ht + 1.5, (fz + hz) / 2, col, { seg: 16, t: TX.plaster });
  W.hemi(20, 13, 20, 0, Ht + 3, (fz + hz) / 2, MC.tile, { seg: 16, hseg: 6, t: TX.rooftile });
  W.rod([0, Ht + 15.5, (fz + hz) / 2], [0, Ht + 19, (fz + hz) / 2], 0.1, MC.brass, { layer: 'metal' });
  for (let i = 0; i < 3; i++) W.sphere(0.9 - i * 0.2, 0.9 - i * 0.2, 0.9 - i * 0.2, 0, Ht + 16.5 + i * 1.1, (fz + hz) / 2, MC.brass, { layer: 'metal', seg: 10, hseg: 6 });
  parapet(-hx, hz, hx, fz, Ht, { h: 1.0, T: 0.4, col, style: 'merlon' });
  // inside: two rows of columns, zellige wainscot, carved stucco, chandeliers, a dais and the throne
  W.scope({ dim: 0.8 }, () => {
    for (const x of [-8, 8]) for (let z = fz - 6; z > hz + 4; z -= 7) {
      W.cyl(0.55, 0.6, 9, x, 4.7, z, 0xf2e8d6, { seg: 12, t: TX.tadelakt }); W.solid(1.2, 9, 1.2, x, 4.7, z, 'stone');
      W.box(1.4, 0.6, 1.4, x, 9.5, z, MC.cedar, { t: TX.carved }); W.box(1.4, 1.2, 1.4, x, 0.8, z, 0xffffff, { t: TX.zellige, wear: 3 });
    }
    for (const [ax, c, a0, a1] of [['x', fz - T - 0.02, -hx + T, hx - T], ['x', hz + T + 0.02, -hx + T, hx - T], ['z', -hx + T + 0.02, hz + T, fz - T], ['z', hx - T - 0.02, hz + T, fz - T]]) {
      wallBox(ax, c, a0, a1, 0.2, 1.8, -0.02, 0.02, 0xffffff, { t: TX.zellige, wear: 2, ao: false });
      wallBox(ax, c, a0, a1, 1.8, 4.8, -0.03, 0.03, 0xf4ead8, { t: TX.carved, wear: 1, ao: false });
      wallBox(ax, c, a0, a1, Ht - 1.6, Ht - 0.4, -0.05, 0.05, MC.cedar, { t: TX.carved, ao: false });
    }
    W.box(18, 0.9, 7, 0, 0.65, hz + 5, 0xd8c8b0, { t: TX.terrazzo }); W.solid(18, 0.9, 7, 0, 0.65, hz + 5, 'stone', { walk: true });
    flight(-1.5, hz + 8.5 + 0.1, [0, -1], 3, 0.2, 1.1, { col: 0xd8c8b0, tx: TX.terrazzo, soffit: false, thick: 1 });
    floorRug(0, 0.22, (fz + hz) / 2 + 2, 6, 26, 0, 0x8a1a1a); floorRug(0, 1.12, hz + 5, 14, 5, 0, 0x6a1a2a);
    W.box(2.4, 3.4, 1.4, 0, 2.8, hz + 2.6, MC.brass, { layer: 'metal', t: TX.carved }); W.box(1.8, 0.7, 1.2, 0, 1.45, hz + 3.0, 0x8a1a1a, { layer: 'cloth', t: TX.fabric });
    hangingRug(-8, 3, hz + 1.3, 0, 4, 6, 0x6a1a2a); hangingRug(8, 3, hz + 1.3, 0, 4, 6, 0x6a1a2a);
    for (let z = fz - 9; z > hz + 6; z -= 10) hangLantern(0, Ht - 0.6, z, 0xffd090, 3.2, true);
    for (const x of [-12, 12]) for (let z = fz - 8; z > hz + 6; z -= 12) hangLantern(x, Ht - 0.6, z, 0xffc070, 2.4, true);
    for (const x of [-4, 4]) plantPot(x, 1.1, hz + 6.5, 'palm', 2.0);
  });
  // the palace forecourt arcade lanterns and flags over the entrance
  W.scope({ lod: 1 }, () => { for (const s of [-1, 1]) { W.rod([s * 5, Ht, fz + 0.3], [s * 5, Ht + 6, fz + 0.3], 0.06, 0xd8d8d8, { layer: 'metal' }); W.box(2.4, 1.6, 0.03, s * 5 + 1.2, Ht + 5, fz + 0.3, 0xc0302a, { layer: 'cloth' }); } });
  GR.rect(0, (fz + bz) / 2, 184, fz - bz, 0, GR.RESERVED, true);
  GR.rect(0, (fz + hz) / 2, 2 * hx - 3, fz - hz - 3, 0, GR.PAVE, true);   // the hall floor: guards and patrols can stand in it
}
