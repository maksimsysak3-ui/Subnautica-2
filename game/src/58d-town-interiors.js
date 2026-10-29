// =====================================================================
//  DAR ESSALAM — authored buildings with hand-furnished interiors
// =====================================================================
// Each of these is laid out room by room: walls, doors, stairs and every piece of furniture placed on
// purpose. (Ordinary town houses keep their doors shut — you only go inside where there is a reason.)
const IN = { plaster: 0xe8dcc4, cream: 0xf0e6d2, zel: 0xffffff };
// one wall line: [ax, a0, a1, c, side, ops] at y0 with height H, outside colour col, inside colour inCol
function walls(list, y0, H, T, col, inCol, o = {}) {
  for (const [ax, a0, a1, c, side, ops = []] of list) wall(ax, a0, a1, c, y0, H, T, { col, tx: o.tx ?? TX.plaster, wear: o.wear ?? 3, side, ops, inCol, inTx: o.inTx ?? TX.plaster, inWear: 1, dimIn: o.dimIn ?? 0.62, plinth: y0 < 0.5 ? (o.plinth ?? 0.55) : 0, ground: y0 });
}
// interior partition: the same paint both sides
function partition(ax, a0, a1, c, y0, H, ops = [], col = IN.plaster) { wall(ax, a0, a1, c, y0, H, 0.16, { col, tx: TX.plaster, wear: 1, ops, dim: 0.62, solid: true }); }
const DOOR = (at, w = 0.9, h = 2.1, o = {}) => ({ at, w, h, kind: 'door', style: 'plank', leaf: 'open', ...o });
const ARCH = (at, w = 1.8, h = 2.9, o = {}) => ({ at, w, h, kind: 'arch', arch: 'horse', ...o });
const WIN = (at, w = 1.0, h = 1.4, sill = 0.9, o = {}) => ({ at, w, h, sill, kind: 'win', win: 'grille', ...o });

// ---------------- Café de la Place: on the square, terrace on the roof ----------------
function cafeDeLaPlace() {
  const x0 = 3.2, x1 = 15.8, z0 = -32, z1 = -22, T = 0.35, H0 = 3.8, H1 = 3.4, yR = H0 + H1, col = 0xe8d8b8;
  GR.rect((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 0, GR.RESERVED, true);
  W.scope({}, () => {
    walls([
      ['x', x0, x1, z1 - T / 2, 1, [{ at: 6.4, w: 3.8, h: 2.9, kind: 'shop', style: 'glass' }, { at: 12.4, w: 3.8, h: 2.9, kind: 'shop', style: 'glass', awning: [0x2a5a3a, 0xe8dcc0] }]],
      ['x', x0, x1, z0 + T / 2, -1, [DOOR(5.0, 0.9, 2.1, { style: 'metal', leaf: 'closed' })]],
      ['z', z0 + T, z1 - T, x0 + T / 2, -1, [WIN(-29.5, 0.8, 1.0, 1.6), WIN(-25.5, 0.8, 1.0, 1.6)]],
      ['z', z0 + T, z1 - T, x1 - T / 2, 1, []],
    ], 0, H0, T, col, 0xf2e2c2);
    walls([
      ['x', x0, x1, z1 - T / 2, 1, [{ at: 5.6, w: 1.2, h: 2.4, sill: 0, kind: 'archdoor', arch: 'horse', style: 'glass', leaf: 'open', zellige: 2 }, { at: 9.5, w: 1.2, h: 2.4, kind: 'archdoor', arch: 'horse', style: 'glass', leaf: 'open', zellige: 2 }, { at: 13.4, w: 1.2, h: 2.4, kind: 'archdoor', arch: 'horse', style: 'glass', leaf: 'open', zellige: 2 }]],
      ['x', x0, x1, z0 + T / 2, -1, [WIN(9.5)]],
      ['z', z0 + T, z1 - T, x0 + T / 2, -1, [WIN(-28, 1.0, 1.4, 0.9, { win: 'mash' }), WIN(-24.5, 1.0, 1.4, 0.9, { win: 'shut' })]],
      ['z', z0 + T, z1 - T, x1 - T / 2, 1, []],
    ], H0, H1, T, col, 0xe6e0d0);
    // floors, stairs (ground → salon along the east wall, salon → roof along the west wall)
    slab(x0 + T, z0 + T, x1 - T, z1 - T, 0.15, { top: 0xc8b8a0, topTx: TX.ceramic, bot: false });
    flight(x1 - T - 0.6, z1 - T - 0.6, [0, -1], 1.15, 0.15, H0, { col: 0xb87a5a, tx: TX.ceramic, riser: 3 });
    slab(x0 + T, z0 + T, x1 - T, z1 - T, H0, { top: 0xb88a6a, topTx: TX.ceramic, holes: [[x1 - T - 1.25, z0 + 3.2, x1 - T, z1 - T]] });
    flight(x0 + T + 0.6, z0 + T + 0.3, [0, 1], 1.1, H0, yR, { col: 0xb87a5a, tx: TX.ceramic, riser: 5 });
    slab(x0 - 0.05, z0 - 0.05, x1 + 0.05, z1 + 0.05, yR, { top: 0xc89a78, topTx: TX.ceramic, holes: [[x0 + T, z0 + T, x0 + T + 1.2, z0 + T + 6.2]], bot: 0xe6e0d0 });
    parapet(x0, z0, x1, z1, yR, { h: 1.0, T: 0.25, col, style: 'plain' });
    railing(x0 + T + 1.2, z0 + T, x0 + T + 1.2, z0 + T + 6.2, yR, 'iron');
    // balcony across the first-floor front
    W.box(x1 - x0 - 0.4, 0.16, 1.1, (x0 + x1) / 2, H0 - 0.08, z1 + 0.55, MC.concreteLt, { t: TX.terrazzo }); W.solid(x1 - x0 - 0.4, 0.16, 1.1, (x0 + x1) / 2, H0 - 0.08, z1 + 0.55, 'concrete', { walk: true });
    railing(x0 + 0.2, z1 + 1.06, x1 - 0.2, z1 + 1.06, H0, 'iron');
    tiledCornice(x1 - x0, z1 - z0, yR, col);
  });
  // ground floor: the café
  W.scope({ dim: 0.8 }, () => {
    counter(9.5, 0.15, -30.6, 0, 4.2, MC.cedarDk, 0x3a3a3a); espressoMachine(8.4, 1.2, -30.8, 0); cashRegister(10.8, 1.2, -30.7, 0);
    displayFridge(4.2, 0.15, -30.8, Math.PI / 2); shelfUnit(12.8, 0.15, -31.4, 0, 1.6, 2.2, 0.35, MC.cedarDk, 'home');
    for (const [x, z] of [[5.4, -24.4], [8.2, -24.4], [11.0, -24.6], [5.4, -27.2], [8.4, -27.4]]) bistroTable(x, 0.15, z, 3, 0x2a2a2a);
    ornateMirror(x0 + T + 0.03, 1.4, -26.5, Math.PI / 2, 0.8, 1.1); wallPlates(x0 + T + 0.03, 2.4, -24, Math.PI / 2, 3);
    ceilingFan(7.5, H0 - 0.1, -26); ceilingFan(11.5, H0 - 0.1, -26); hangLantern(9.5, H0 - 0.05, -29.4, 0xffc070, 0.6, true);
    plantPot(4.0, 0.15, -23.0, 'palm', 1.3); plantPot(13.8, 0.15, -23.0, 'ficus', 1.2);
    floorRug(8, 0.16, -26, 3, 2, 0, 0x8a2a24);
  });
  // first floor: the salon (cushions, hookah, mint tea)
  W.scope({ dim: 0.75 }, () => {
    sedari(7.6, H0, -31.3, 0, 5.2, 0x8a2a24); sedari(x0 + T + 0.45, H0, -24.4, Math.PI / 2, 2.6, 0x8a2a24);
    teaTable(7.6, H0, -30.0, 0.5); teaTable(9.2, H0, -25.2, 0.45); hookah(10.2, H0, -24.6); samovar(12.6, H0, -31.2);
    floorRug(8.6, H0 + 0.01, -27.6, 5, 3.4, 0, 0x2a3a6a); hangLantern(8.6, yR - 0.1, -27.4, 0xffc070, 0.8, true); lanternCluster(12.2, yR - 0.05, -27.8, 5, 0.6);
    for (let i = 0; i < 4; i++) pouf(6.2 + i * 1.4, H0, -28.4 + (i % 2) * 0.5);
  });
  // the roof terrace: umbrellas, plants, the best seat over the square
  W.scope({ lod: 1 }, () => {
    for (const [x, z] of [[7.2, -24.2], [11.4, -24.2], [11.6, -28.8]]) { bistroTable(x, yR, z, 3, 0x2a5a3a); W.rod([x, yR, z], [x, yR + 2.3, z], 0.03, MC.alu, { layer: 'metal' }); W.cone(1.3, 0.45, x, yR + 2.35, z, mpick([0xe8dcc0, 0x2a5a3a, 0xb03a2e]), { seg: 8, layer: 'cloth', t: TX.fabric }); }
    for (let i = 0; i < 5; i++) plantPot(x0 + 1.6 + i * 2.5, yR, z1 - 0.5, mpick(['geranium', 'palm']), 1.2);
    satDish(14.8, yR, -31, 2.4, 0.9); waterTank(13.2, yR, -31.1, 'white');
  });
  // the terrace in front, on the square
  for (const [x, z] of [[5, -20], [9, -20.2], [13, -20]]) umbrellaTable(x, z, 0x2a5a3a);
  TOWN.spots.cafeRoof = { x: 9.5, y: yR, z: -26 };
}

// ---------------- Dar Lamia: a riad at the end of a dead-end lane (the dead drop) ----------------
function darLamia() {
  const x0 = -116, x1 = -101, z0 = 43, z1 = 56.5, T = 0.45, H0 = 3.8, H1 = 3.4, yR = H0 + H1, col = 0xc98a6c;
  const cx0 = -111.5, cx1 = -105.5, cz0 = 47.5, cz1 = 52.5;   // courtyard, open to the sky
  GR.rect((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 0.4, z1 - z0 + 0.4, 0, GR.RESERVED, true);
  const zel = 5, inner = 0xece0c8;
  // outer walls: the lane front has the only door (carved, zellige surround, lantern)
  walls([
    ['x', x0, x1, z0 + T / 2, -1, [{ at: -108, w: 1.3, h: 3.0, kind: 'archdoor', arch: 'horse', style: 'carved', leaf: 'open', flip: true, hood: true, lamp: 0xffc070, zellige: 1, rimCol: 0xf2e6cc }, WIN(-113.5, 0.6, 0.7, 1.8), WIN(-103.4, 0.6, 0.7, 1.8)]],
    ['x', x0, x1, z1 - T / 2, 1, []], ['z', z0 + T, z1 - T, x0 + T / 2, -1, []], ['z', z0 + T, z1 - T, x1 - T / 2, 1, []],
  ], 0, H0, T, col, inner);
  walls([
    ['x', x0, x1, z0 + T / 2, -1, [WIN(-112, 1.1, 1.5, 0.9, { win: 'mash' }), WIN(-104.5, 0.8, 1.0, 1.2)]],
    ['x', x0, x1, z1 - T / 2, 1, []], ['z', z0 + T, z1 - T, x0 + T / 2, -1, []], ['z', z0 + T, z1 - T, x1 - T / 2, 1, []],
  ], H0, H1, T, col, inner);
  // round the courtyard: horseshoe arches below, windows and a mashrabiya above
  for (const [y, h, ops] of [[0, H0, 'g'], [H0, H1, 'u']]) {
    const g = ops === 'g';
    partition('x', x0 + T, x1 - T, cz0, y, h, g ? [DOOR(-113.6, 0.9, 2.2, { style: 'carved', doorCol: MC.cedar }), ARCH(-108.5, 2.4, 3.0, { zellige: zel }), DOOR(-103.4, 0.9, 2.2, { style: 'carved' })] : [DOOR(-113.6), WIN(-108.5, 1.2, 1.5, 0.9, { win: 'mash' }), DOOR(-103.4)], inner);
    partition('x', x0 + T, x1 - T, cz1, y, h, g ? [DOOR(-113.6, 0.9, 2.2, { style: 'carved' }), ARCH(-108.5, 2.4, 3.0, { zellige: zel }), DOOR(-103.4, 0.9, 2.2, { style: 'carved' })] : [DOOR(-113.6), WIN(-108.5, 1.4, 1.5, 0.9), DOOR(-103.4)], inner);
    partition('z', cz0 + 0.08, cz1 - 0.08, cx0, y, h, g ? [ARCH(50, 2.2, 3.0, { zellige: zel })] : [WIN(50, 1.0, 1.4, 0.9, { win: 'shut' })], inner);
    partition('z', cz0 + 0.08, cz1 - 0.08, cx1, y, h, g ? [ARCH(50, 2.2, 3.0, { zellige: zel })] : [WIN(50, 1.0, 1.4, 0.9, { win: 'shut' })], inner);
  }
  // zellige courtyard, tiled wainscot, fountain, orange tree
  W.box(cx1 - cx0, 0.04, cz1 - cz0, (cx0 + cx1) / 2, 0.17, (cz0 + cz1) / 2, IN.zel, { t: TX.zellige, wear: zel, ao: false });
  for (const [ax, c, a0, a1] of [['x', cz0 + 0.09, cx0, cx1], ['x', cz1 - 0.09, cx0, cx1], ['z', cx0 + 0.09, cz0, cz1], ['z', cx1 - 0.09, cz0, cz1]]) wallBox(ax, c, a0, a1, 0.15, 1.2, -0.01, 0.01, IN.zel, { t: TX.zellige, wear: zel + 1, ao: false });
  fountain(-108.5, 0.15, 50, 0.9, zel);
  tree(-110.6, 0.15, 48.5, 'orange', 0.85); plantPot(-106.3, 0.15, 48.4, 'palm', 1.5); plantPot(-106.3, 0.15, 51.6, 'ficus', 1.3); plantPot(-110.7, 0.15, 51.6, 'aloe', 1.4);
  // floors and stairs: ground → first along the south range, first → roof along the north range
  slab(x0 + T, z0 + T, x1 - T, z1 - T, 0.15, { top: 0xd8c8b0, topTx: TX.terrazzo, bot: false, holes: [[cx0, cz0, cx1, cz1]] });
  flight(-102.2, 55.4, [-1, 0], 1.1, 0.15, H0, { col: 0xb87a5a, tx: TX.ceramic, riser: zel });
  slab(x0 + T, z0 + T, x1 - T, z1 - T, H0, { top: 0xc8a888, topTx: TX.terrazzo, holes: [[cx0, cz0, cx1, cz1], [-108.6, 54.8, x1 - T, z1 - T]] });
  flight(-115.0, 44.0, [1, 0], 1.0, H0, yR, { col: 0xb87a5a, tx: TX.ceramic, riser: zel });
  slab(x0 - 0.05, z0 - 0.05, x1 + 0.05, z1 + 0.05, yR, { top: 0xc89a78, topTx: TX.ceramic, holes: [[cx0, cz0, cx1, cz1], [x0 + T, z0 + T, -109.2, z0 + T + 1.1]], bot: 0xe8d8c0 });
  parapet(x0, z0, x1, z1, yR, { h: 0.9, T: 0.3, col, style: 'merlon' });
  railing(cx0, cz0, cx1, cz0, yR, 'iron'); railing(cx0, cz1, cx1, cz1, yR, 'iron'); railing(cx0, cz0, cx0, cz1, yR, 'iron'); railing(cx1, cz0, cx1, cz1, yR, 'iron');
  railing(-109.2, z0 + T, -109.2, z0 + T + 1.1, yR, 'iron');
  // --- furnishing, room by room ---
  W.scope({ dim: 0.7 }, () => {
    // north range, ground: the salon either side of the entrance
    sedari(-113.6, 0.15, 44.0, 0, 3.4, 0x6a2a4a); sedari(-115.1, 0.15, 45.6, Math.PI / 2, 2.4, 0x6a2a4a); teaTable(-113.4, 0.15, 45.6, 0.45);
    floorRug(-113.2, 0.16, 45.6, 3.4, 2.4, 0, 0x9a2a24); ornateMirror(-113.6, 1.5, 43.48, 0, 0.7, 1.0); hangLantern(-113.3, H0 - 0.1, 45.6, 0xffc070, 0.7, true);
    sedari(-103.5, 0.15, 44.0, 0, 3.4, 0x2a5a6a); teaTable(-103.6, 0.15, 45.5, 0.4); wallPlates(-101.48, 2.3, 45.5, -Math.PI / 2, 3); hangLantern(-103.5, H0 - 0.1, 45.5, 0xffc070, 0.6, true);
    // west range: a reading room; east range: the kitchen
    shelfUnit(-115.3, 0.15, 50, Math.PI / 2, 1.8, 2.2, 0.38, MC.cedarDk, 'home'); pouf(-113.8, 0.15, 49.2); pouf(-113.6, 0.15, 50.9); lowTable(-113, 0.15, 50, Math.PI / 2);
    kitchenRun(-101.8, 0.15, 50, -Math.PI / 2, 2.6, 0xe6e0d4); butane(-103, 0.15, 48.2); for (let i = 0; i < 3; i++) tagine(-102.5 + i * 0.1, 1.05, 49.2 + i * 0.5);
    // south range, ground: dining room (the stair runs along its back wall)
    lowTable(-112.5, 0.15, 54, 0, 1.4, 0.8); sedari(-112.6, 0.15, 53.0, Math.PI, 2.6, 0x8a5a2a); floorRug(-112.5, 0.16, 54, 3, 1.6, 0, 0x2a3a6a);
    // first floor: bedrooms, and the study where the courier left the intel
    bed(-103.6, H0, 45.2, Math.PI / 2, 0x8a3a3a); nightstand(-102, H0, 43.9, 0); wardrobe(-106, H0, 44.0, 0, MC.cedar);
    bed(-103.4, H0, 50, -Math.PI / 2, 0x3a5a7a); dresser(-101.9, H0, 48.2, -Math.PI / 2);
    desk(-113.4, H0, 55.4, Math.PI, 1.4, 0.7, MC.cedarDk); chairOffice(-113.4, H0, 54.6, 0); laptop(-113.6, H0 + 0.76, 55.5, Math.PI); paperStack(-112.9, H0 + 0.76, 55.4, 8, 0.2); deskLamp(-114, H0 + 0.76, 55.6, Math.PI); safe(-115.3, H0, 55.6, Math.PI / 2);
    floorRug(-113, H0 + 0.01, 53.8, 2.6, 1.8, 0, 0x6a2a4a); hangLantern(-113.2, yR - 0.1, 54.4, 0xffc070, 0.5, true);
    shelfUnit(-115.3, H0, 50, Math.PI / 2, 1.8, 2.2, 0.38, MC.cedarDk, 'home');
    hangingRug(-115.5, H0 + 0.5, 54.2, Math.PI / 2, 1.3, 1.9, 0x2a3a6a); wallPlates(-112.2, H0 + 2.2, 56.0, Math.PI, 3); framedPhoto(-114.6, H0 + 1.6, 52.62, 0, 0.4, 0.3); wallClock(-111.7, H0 + 2.3, 53.6, -Math.PI / 2);
    for (const [x, z] of [[-103.4, 44.9], [-103.4, 50]]) hangLantern(x, yR - 0.1, z, 0xffc070, 0.5, true);
    ornateMirror(-101.5, H0 + 1.4, 46.5, -Math.PI / 2, 0.7, 1.0); floorRug(-103.6, H0 + 0.01, 45.2, 2.6, 1.8, 0, 0x9a2a24); floorRug(-103.4, H0 + 0.01, 50, 2.4, 1.8, 0, 0x2a5a6a);
  });
  // roof: laundry, plants, a tank and a dish
  W.scope({ lod: 1 }, () => { laundryLine(-115, yR + 1.7, 55.6, -110, yR + 1.7, 55.8, 7); for (const xx of [-115, -110]) W.rod([xx, yR, 55.7], [xx, yR + 1.8, 55.7], 0.02, MC.iron); waterTank(-102.5, yR, 55, 'black'); satDish(-102.4, yR, 44.2, 2.4, 0.9); for (let i = 0; i < 4; i++) plantPot(-115 + i * 1.6, yR, 44, 'geranium', 1.2); plasticChair(-104, yR, 53, 1.2); });
  W.push(-110.5, 0, z0, Math.PI); bougainvillea(0, yR + 0.6, 0, 3.2); W.pop();
  TOWN.spots.intel = { x: -113.4, y: H0, z: 55.3 };
  TOWN.spots.darLamiaDoor = { x: -108, z: 41.5 };
}

// ---------------- the kasbah headquarters: commander's house + barracks ----------------
function kasbahHQ() {
  const x0 = 126, x1 = 149, z0 = -80, z1 = -46, T = 0.5, H0 = 3.8, H1 = 3.4, yR = H0 + H1, col = 0xb98a62, inner = 0xe2d6c0;
  GR.rect((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 0.4, z1 - z0 + 0.4, 0, GR.RESERVED, true);
  // façade toward the parade ground (west): the door, grilled windows, a tiled hood
  walls([
    ['z', z0 + T, z1 - T, x0 + T / 2, -1, [WIN(-76, 0.8, 1.1, 1.4), WIN(-70, 0.8, 1.1, 1.4), { at: -63, w: 1.6, h: 3.0, kind: 'archdoor', arch: 'horse', style: 'carved', leaf: 'open', double: true, hood: true, lamp: 0xffc070, zellige: 6 }, WIN(-56, 0.8, 1.1, 1.4), WIN(-50, 0.8, 1.1, 1.4)]],
    ['z', z0 + T, z1 - T, x1 - T / 2, 1, []], ['x', x0, x1, z0 + T / 2, -1, [WIN(137.5, 0.8, 1.1, 1.4)]], ['x', x0, x1, z1 - T / 2, 1, [WIN(137.5, 0.8, 1.1, 1.4)]],
  ], 0, H0, T, col, inner, { tx: TX.pise });
  walls([
    ['z', z0 + T, z1 - T, x0 + T / 2, -1, [WIN(-76, 1.0, 1.5, 0.9, { win: 'shut' }), WIN(-70, 1.0, 1.5, 0.9, { win: 'shut' }), WIN(-63, 1.2, 1.6, 0.9, { win: 'mash' }), WIN(-56, 1.0, 1.5, 0.9, { win: 'shut' }), WIN(-50, 1.0, 1.5, 0.9, { win: 'shut' })]],
    ['z', z0 + T, z1 - T, x1 - T / 2, 1, [WIN(-63)]], ['x', x0, x1, z0 + T / 2, -1, [WIN(137.5)]], ['x', x0, x1, z1 - T / 2, 1, [WIN(137.5)]],
  ], H0, H1, T, col, inner, { tx: TX.pise });
  // ground: central hall (x 126.5-136) with rooms off it — guard room N, radio room S, armoury E
  for (const [y, h] of [[0, H0], [H0, H1]]) {
    partition('z', z0 + T, z1 - T, 136, y, h, [DOOR(-61.5, 1.2, 2.3, { style: 'metal', doorCol: 0x3a4a3a }), DOOR(-74, 0.9), DOOR(-52, 0.9)]);
    partition('x', x0 + T, 136, -68, y, h, [DOOR(131, 1.0)]);
    partition('x', x0 + T, 136, -58, y, h, [DOOR(131, 1.0)]);
    partition('x', 136, x1 - T, -66, y, h, [DOOR(138.5, 0.9)]);
  }
  slab(x0 + T, z0 + T, x1 - T, z1 - T, 0.15, { top: 0xb8b0a0, topTx: TX.terrazzo, bot: false });
  flight(128.0, -59.0, [0, -1], 1.2, 0.15, H0, { col: 0x9a9488, tx: TX.terrazzo });
  slab(x0 + T, z0 + T, x1 - T, z1 - T, H0, { top: 0xa88a6a, topTx: TX.wood, holes: [[127.3, -65.4, 128.7, -58.5]] });
  flight(134.6, -67.0, [0, 1], 1.0, H0, yR, { col: 0x9a9488, tx: TX.terrazzo });
  slab(x0 - 0.05, z0 - 0.05, x1 + 0.05, z1 + 0.05, yR, { top: 0xa89c88, topTx: TX.concrete, holes: [[134.0, -67.2, 135.2, -61.4]] });
  parapet(x0, z0, x1, z1, yR, { h: 1.0, T: 0.4, col, style: 'merlon' });
  railing(134.0, -67.2, 134.0, -61.4, yR, 'iron');
  W.scope({ dim: 0.65 }, () => {
    // guard room (north-west): table, cards, cots, a kettle
    tableFolding(131, 0.15, -75, 0); chairFolding(130.2, 0.15, -74.2, 2.8); chairFolding(131.8, 0.15, -75.8, -0.4); cards(131, 0.91, -75); kettle(131.6, 0.91, -74.8); ashtray(130.5, 0.91, -75.2);
    cot(128, 0.15, -78.6, 0, PC.olive); cot(133.4, 0.15, -78.6, 0, PC.olive); footlocker(128, 0.15, -77.2); weaponRack(135.5, 0.15, -72, -Math.PI / 2, 4);
    // radio room (south-west): the comms desk
    desk(131, 0.15, -48.2, Math.PI, 2.2, 0.8); radioSet(130.3, 0.91, -48.3, Math.PI); radioSet(131.6, 0.91, -48.3, Math.PI); monitor(131.0, 0.91, -48.4, Math.PI); headset(132.4, 0.91, -48.1);
    chairOffice(131, 0.15, -49.4, 0); mapBoard(126.6, 1.0, -52, Math.PI / 2, 2.2, 1.4); fieldPhone(133.8, 0.91, -48.2, Math.PI); powerStrip(130, 0.15, -47.2); generator(134.6, 0.15, -55.4, 0);
    // armoury (north-east): racks, crates, ammo
    weaponRack(146.6, 0.15, -72, -Math.PI / 2, 6); weaponRack(146.6, 0.15, -68, -Math.PI / 2, 6); ammoCrateOpen(140, 0.15, -78, 0); grenadeCrate(142.4, 0.15, -78.2, 0); for (let i = 0; i < 5; i++) ammoCan(138 + i * 0.5, 0.15, -66, 0); vestStand(139, 0.15, -72, Math.PI / 2); launcherTube(143, 0.15, -70, 0.4);
    // store (south-east)
    shelf(146.8, 0.15, -55, -Math.PI / 2, 1.8, 4, 'supply'); for (let i = 0; i < 4; i++) crate(141 + i * 1.3, 0.15, -48.2, 1.0, 0.7, 0.8, 0, PC.olive); waterCase(139, 0.15, -52, 0); mre(140, 0.15, -53);
    // first floor: commander's office over the hall — the documents are in the safe behind his desk
    desk(141.5, H0, -58, Math.PI, 1.8, 0.85, MC.cedarDk); chairOffice(141.5, H0, -59, 0); laptop(141.2, H0 + 0.76, -58.1, Math.PI); paperStack(142.1, H0 + 0.76, -58, 10, 0.3); deskLamp(140.7, H0 + 0.76, -57.8, Math.PI); phone(142.5, H0 + 0.76, -58.2, 0);
    safe(147.9, H0, -59.5, -Math.PI / 2); sandTable(140.5, H0, -54, 0); flag(146.8, H0, -55.5); framedPhoto(143.6, H0 + 1.6, -46.6, Math.PI, 0.5, 0.4); floorRug(141.5, H0 + 0.01, -56, 3.4, 2.4, 0, 0x6a2a24);
    sofa(144, H0, -52, Math.PI, 0x5a3a2a, 2.0); lowTable(144, H0, -53.2, 0, 1.0, 0.6);
    // his quarters (north-east) and the briefing room (west)
    bed(144, H0, -77, 0, 0x2a3a4a); wardrobe(147.8, H0, -72, -Math.PI / 2, MC.cedarDk); nightstand(142, H0, -78.8, 0);
    meetingTable(131, H0, -52, 0, 3.2); for (let i = 0; i < 6; i++) chairFolding(129.4 + (i % 3) * 1.6, H0, -52 + (i < 3 ? -0.9 : 0.9), i < 3 ? 0 : Math.PI); whiteboard(126.6, H0 + 1.2, -52, Math.PI / 2); projector(131, H0 + 0.76, -52, 0);
    cot(128, H0, -77, 0, PC.olive); cot(131, H0, -77, 0, PC.olive); footlocker(133.5, H0, -78.6);
    for (const [x, z] of [[131, -63], [141.5, -66], [141.5, -50], [131, -74]]) ceilingLight(x, H0 - 0.05, z, 0, 1.2, true);
  });
  // roof: a sandbagged lookout
  W.scope({ lod: 1 }, () => { sandbagWall(127, -78, 127, -72, 2); sandbagWall(127, -78, 132, -78, 2); antenna(147, yR, -48); satDish(146.5, yR, -76, 2.4, 1.1); camoNet(130, yR, -75, 5, 5, 2.3, 0); });
  TOWN.spots.hqSafe = { x: 147.4, y: H0, z: -59.5 };
  TOWN.spots.hqDoor = { x: x0 - 1.5, z: -63 };
  TOWN.spots.hqRoof = { x: 130, y: yR, z: -75 };
}
function flag(x, y, z) { W.rod([x, y, z], [x, y + 2.2, z], 0.02, MC.brass, { layer: 'metal' }); W.box(0.9, 0.6, 0.01, x + 0.45, y + 1.85, z, 0x2a2a2a, { layer: 'cloth' }); W.box(0.4, 0.12, 0.012, x + 0.45, y + 1.85, z, 0xc0302a, { layer: 'cloth' }); }
function barracks() {
  const x0 = 68, x1 = 112, z0 = -131, z1 = -117, T = 0.45, H = 4.2, col = 0xb98a62, inner = 0xd8d0be;
  GR.rect((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 0.4, z1 - z0 + 0.4, 0, GR.RESERVED, true);
  const win = []; for (let x = 72; x < 110; x += 5) if (Math.abs(x - 80) > 2 && Math.abs(x - 100) > 2) win.push(WIN(x, 1.0, 1.1, 1.3));
  walls([
    ['x', x0, x1, z1 - T / 2, 1, [DOOR(80, 1.4, 2.4, { style: 'metal', leaf: 'open', doorCol: 0x3a4a3a }), DOOR(100, 1.4, 2.4, { style: 'metal', leaf: 'ajar', doorCol: 0x3a4a3a }), ...win]],
    ['x', x0, x1, z0 + T / 2, -1, win.map((w) => ({ ...w, sill: 1.8, h: 0.8 }))], ['z', z0 + T, z1 - T, x0 + T / 2, -1, []], ['z', z0 + T, z1 - T, x1 - T / 2, 1, []],
  ], 0, H, T, col, inner, { tx: TX.pise });
  partition('z', z0 + T, z1 - T, 105, 0, H, [DOOR(-124, 0.9)]);
  slab(x0 + T, z0 + T, x1 - T, z1 - T, 0.15, { top: 0x9a948a, topTx: TX.concrete, bot: false });
  slab(x0 - 0.05, z0 - 0.05, x1 + 0.05, z1 + 0.05, H, { top: 0x8a8478, topTx: TX.concrete, bot: 0xd0c8b8 });
  parapet(x0, z0, x1, z1, H, { h: 0.8, T: 0.3, col, style: 'merlon' });
  W.scope({ dim: 0.65 }, () => {
    for (let i = 0; i < 6; i++) { const x = 72 + i * 5.4; bunkBed(x, 0.15, -129.6, 0, PC.olive); locker(x + 1.6, 0.15, -130.4, 0, PC.olive); footlocker(x, 0.15, -128.1); bunkBed(x, 0.15, -118.6, Math.PI, PC.oliveDk); }
    tableFolding(88, 0.15, -124, 0, 2.4, 0.9); for (let i = 0; i < 4; i++) chairFolding(87 + (i % 2) * 2, 0.15, -124 + (i < 2 ? -0.9 : 0.9), i < 2 ? 0 : Math.PI); cards(88, 0.91, -124); ashtray(88.6, 0.91, -124.2); energyCans(87.2, 0.91, -123.9, 3);
    tv(103.6, 0.15, -123, -Math.PI / 2); sofa(100.4, 0.15, -123, Math.PI / 2, 0x4a4a3a); fanStand(102, 0.15, -120, 0);
    for (let i = 0; i < 3; i++) { sink(106 + i * 2, 0.15, -130.6, 0); mirror(106 + i * 2, 1.6, -130.75, 0); } showerCorner(110.8, 0.15, -118.4, Math.PI);
    for (let x = 74; x < 104; x += 8) ceilingLight(x, H - 0.05, -124, 0, 1.4, true);
    uniformLine(70, -120, 84, -120, 1.9, 6);
  });
}
// ---------------- the smugglers' store on the quay ----------------
function smugglersWarehouse() {
  const x0 = 108, x1 = 126, z0 = 76, z1 = 92, T = 0.4, H = 7, col = 0xd8d4c8;
  GR.rect((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 0.4, z1 - z0 + 0.4, 0, GR.RESERVED, true);
  walls([
    ['x', x0, x1, z1 - T / 2, 1, [DOOR(114, 4.2, 4.0, { style: 'metal', leaf: 'open', double: true, doorCol: 0x2a5a8a }), WIN(122.4, 1.4, 1.0, 2.6)]],
    ['x', x0, x1, z0 + T / 2, -1, [WIN(112, 1.2, 0.8, 4.6), WIN(120, 1.2, 0.8, 4.6)]], ['z', z0 + T, z1 - T, x0 + T / 2, -1, [WIN(84, 1.2, 0.8, 4.6)]], ['z', z0 + T, z1 - T, x1 - T / 2, 1, []],
  ], 0, H, T, col, 0xcfc8b8, { wear: 6 });
  slab(x0 + T, z0 + T, x1 - T, z1 - T, 0.12, { top: 0x8a8478, topTx: TX.concrete, bot: false });
  // mezzanine office along the back, steel stair up to it
  slab(x0 + T, z0 + T, x1 - T, z0 + 4.4, 3.4, { top: 0x8a7458, topTx: TX.wood, thk: 0.2 });
  for (const x of [112, 118, 124]) { W.box(0.2, 3.3, 0.2, x, 1.65, z0 + 4.3, 0x4a4e52, { layer: 'metal' }); W.solid(0.2, 3.3, 0.2, x, 1.65, z0 + 4.3, 'metal'); }
  railing(x0 + 2.2, z0 + 4.4, x1 - T, z0 + 4.4, 3.4, 'iron');
  flight(x0 + T + 0.6, z0 + 9.7, [0, -1], 1.1, 0.12, 3.4, { col: 0x4a4e52, tx: TX.metal, thick: 0.08, soffit: false });
  W.box(x1 - x0, 0.3, z1 - z0, (x0 + x1) / 2, H + 0.15, (z0 + z1) / 2, 0x7a7a74, { layer: 'metal', t: TX.corrugated, wear: 6 });
  W.solid(x1 - x0, 0.3, z1 - z0, (x0 + x1) / 2, H + 0.15, (z0 + z1) / 2, 'metal');
  W.scope({ dim: 0.6 }, () => {
    van(119, 85.5, Math.PI / 2, 0xe8e6e0); forklift(112.6, 87.5, 0.4);
    for (const [x, z, n] of [[110.5, 81.5, 4], [110.5, 84, 3], [123.5, 89.4, 4], [121.4, 89.6, 2], [124, 80.5, 3]]) crateStack(x, 0.12, z, 0, n);
    palletRack(122.5, 0.12, 83.5, Math.PI / 2, 5.4, 3, 1.1);
    for (let i = 0; i < 6; i++) drum(109 + (i % 3) * 0.7, 0.12, 89.6 + Math.floor(i / 3) * 0.7, PC.blue);
    fishingBoat(115.5, 81, Math.PI / 2, 6, { y: 0.4 });
    // the office on the mezzanine: maps, radio, cash box, a rifle case
    desk(115, 3.4, z0 + 1.2, 0, 1.6, 0.75); chairOffice(115, 3.4, z0 + 2.0, Math.PI); radioSet(114.4, 4.16, z0 + 1.1, 0); mapBoard(118, 4.6, z0 + 0.45, 0, 1.6, 1.0); paperStack(115.6, 4.16, z0 + 1.2, 6, 0.1);
    safe(121, 3.4, z0 + 1.0, 0); ammoCrateOpen(123, 3.4, z0 + 1.4, 0.2); weaponRack(110, 3.4, z0 + 0.9, 0, 3); ceilingLight(116, H - 0.1, 84, 0, 1.4, true); ceilingLight(116, 3.25, z0 + 2, 0, 1.0, true);
  });
  TOWN.spots.warehouse = { x: 114, z: 93 };
  TOWN.spots.warehouseOffice = { x: 116, y: 3.4, z: 78.5 };
}
function buildInteriors() {
  cafeDeLaPlace();
  darLamia();
  kasbahHQ();
  barracks();
  smugglersWarehouse();
}
