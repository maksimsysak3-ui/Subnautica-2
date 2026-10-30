// =====================================================================
//  Rooms behind the doors of Dar Essalam and of the Ravenscroft outbuildings
// =====================================================================
// Same machinery as Seoul's (roomShell, ROOMS, DOORS): each kind of door leads to its own furnished room
// out past the edge of the map, with people in it. Every room hides a stash (E) — cash, ammunition, a
// field dressing — once per visit to a door.
const RIAD_ZEL = 0xffffff;
function darInteriors() {
  Object.assign(ROOM_ROW, { z: -760, x: { riad: -160, dhouse: -60, warehouse: 40, teahouse: 140 } });
  // ---- the riad: a courtyard open to the sky, a fountain, orange trees, the salon off it ----
  {
    const Wd = 16, D = 16, H = 7.2;
    roomShell('riad', Wd, D, H, { name: 'رياض', en: 'a riad', floor: 0xe8dcc4, wall: 0xf0e2c8, ceil: 0xe8dcc4, floorTx: TX.zellige, door: 0x6a3a1a });
    W.box(Wd, 0.1, D, 0, H + 0.05, 0, 0x8fb4dc, { layer: 'glow' });   // the sky through the open courtyard
    for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) { W.box(0.6, H - 0.6, 0.6, x, (H - 0.6) / 2, z, 0xf0e2c8, { t: TX.plaster }); W.solid(0.6, H, 0.6, x, H / 2, z, 'plaster'); }
    W.box(9, 0.3, 9, 0, 3.6, 0, 0xe8dcc4, { t: TX.carved }); W.box(4.2, 0.32, 4.2, 0, 3.6, 0, 0x8fb4dc, { layer: 'glow' });   // the gallery round the court
    for (let k = 0; k < 4; k++) { W.push(0, 0, 0, k * Math.PI / 2); W.box(8.4, 1.0, 0.1, 0, 4.4, 4.2, 0x6a3a1a, { t: TX.carved }); W.box(8.4, 1.2, 0.1, 0, 0.6, 4.4, RIAD_ZEL, { t: TX.zellige, wear: 1 }); W.pop(); }
    fountain(0, 0, 0, 1.4, 2); for (const [x, z] of [[-5.6, -5.6], [5.6, 5.6]]) tree(x, 0, z, 'orange', 0.8);
    sedari(-6.4, 0, -4.6, Math.PI / 2, 5, 0x8a2a24); sedari(6.4, 0, -4.6, -Math.PI / 2, 5, 0x2a3a6a); teaTable(-5.4, 0, -4.6, 0.5); teaTable(5.4, 0, -4.6, 0.5); samovar(-5.5, 0.5, -4.6);
    for (const x of [-7.2, 7.2]) hangLantern(x, 3.4, 0, 0xffc070, 0.5, true); hangLantern(0, H - 0.4, 0, 0xffc070, 1.2, true);
    floorRug(0, 0.04, -6, 4, 2.6, 0, 0x9a2a24); W.lamp(0, 3.0, 0, 0xffd8a0, 2.4, 12, { halo: 0 });
    LOOT.spot('riad', -6.9, 0.9, 6.6, 'cash');
    staffAt(-5.6, -3.6, Math.PI / 2, 'home'); staffAt(5.6, -3.6, -Math.PI / 2, 'guest'); staffAt(2, 5, Math.PI, 'guest');
    W.pop();
  }
  // ---- a family house: the room everyone lives in — cushions, TV, the kitchen corner, a bed behind a curtain ----
  {
    const Wd = 10, D = 8, H = 3.0;
    roomShell('dhouse', Wd, D, H, { name: '', en: 'a house in the medina', floor: 0xb89a6a, wall: 0xe8dcc4, ceil: 0xe0d4bc, floorTx: TX.ceramic, door: 0x2a5a8a });
    sedari(-4.4, 0, -1, Math.PI / 2, 4, 0x8a2a24); sedari(0, 0, -3.4, 0, 6, 0x8a2a24); teaTable(-1.4, 0, -1.4, 0.55);
    W.box(1.4, 0.8, 0.06, 2.6, 1.4, -3.92, 0x3a6aa8, { layer: 'glow' }); W.box(1.6, 0.5, 0.4, 2.6, 0.25, -3.7, 0x4a3a2a, { t: TX.wood });
    kitchenRun(4.4, 0, 1.6, -Math.PI / 2, 2.4); gasHob(4.5, 0.92, 1.0, -Math.PI / 2); W.box(0.4, 0.3, 0.3, 4.5, 1.05, 2.2, 0x9a5a34);
    W.box(0.05, 2.2, 3.0, -1.5, 1.1, 2.4, 0x8a2a6a, { layer: 'cloth', t: TX.fabric }); bed(-3.4, 0, 2.6, Math.PI / 2, 0xd8a0b0);
    floorRug(-1, 0.03, -1.4, 3, 2.2, 0, 0x6a2a4a); hangLantern(0, H - 0.1, 0, 0xffc070, 0.4, true); W.lamp(0, 2.4, 0, 0xffd8a0, 1.6, 8, { halo: 0 });
    LOOT.spot('dhouse', 4.4, 0.92, 3.4, 'medkit');
    staffAt(0, -2.6, Math.PI, 'home'); staffAt(-3.6, -0.6, -Math.PI / 2, 'guest');
    W.pop();
  }
  // ---- a warehouse the militia uses: crates, ammo cans, a truck half loaded, a desk with the manifests ----
  {
    const Wd = 18, D = 14, H = 6;
    roomShell('warehouse', Wd, D, H, { name: '', en: 'a militia store', floor: 0x8a8478, wall: 0xb8a888, ceil: 0x4a4440, floorTx: TX.concrete, door: 0x3a6a4a });
    for (let x = -7; x <= 7; x += 3.5) palletRack(x, 0, -5.6, 0, 3, 3, 1.1);
    for (let k = 0; k < 8; k++) crateStack(mr(-7, 7), 0, mr(-2, 3), mr(0, 3), 2 + (k % 3));
    for (let k = 0; k < 6; k++) ammoCan(-6 + k * 0.5, 0, 4.6, 0); cargoTruck(4, 2, 0, PC.olive);
    desk(-6.4, 0, 4.2, Math.PI / 2, 1.6, 0.8); paperStack(-6.4, 0.78, 4.2); W.lamp(0, H - 0.5, 0, 0xfff0d0, 2.2, 14, { halo: 0 }); ceilingLight(0, H - 0.05, 0, 0, 4, true);
    LOOT.spot('warehouse', -6.4, 0.8, 3.6, 'ammo');
    staffAt(5, -3, 0, 'guest');
    W.pop();
  }
  // ---- the tea room: low tables, brass trays, the mint tea on the boil, men playing cards ----
  {
    const Wd = 12, D = 9, H = 3.4;
    roomShell('teahouse', Wd, D, H, { name: 'مقهى', en: 'a tea room', floor: 0xc8a878, wall: 0xe8d4b0, ceil: 0x6a4a2a, floorTx: TX.zellige, door: 0x6a3a1a });
    counter(-3, 0, -3.6, 0, 3.2, MC.cedarDk, 0x8a6a4a); samovar(-3.6, 1.0, -3.6); for (let k = 0; k < 6; k++) glassCup(-2.6 + k * 0.18, 1.0, -3.5);
    for (const [x, z] of [[2, -1.6], [-1, 1.2], [3.4, 2.2], [-4, 2.4]]) { teaTable(x, 0, z, 0.5); for (const s of [-1, 1]) pouf(x + s * 0.8, 0, z); cards(x, 0.5, z); }
    for (let x = -5; x <= 5; x += 2.5) hangLantern(x, H - 0.1, 0, 0xffc070, 0.5, true);
    W.lamp(0, 2.6, 0, 0xffc890, 1.8, 10, { halo: 0 }); floorRug(0, 0.03, 0.6, 6, 4, 0, 0x8a2a24);
    LOOT.spot('teahouse', -1.6, 1.0, -3.6, 'cash');
    staffAt(-3, -4.1, 0, 'food'); for (const [x, z] of [[2.8, -1.6], [1.2, -1.6], [-1.8, 1.2], [-0.2, 1.2], [4.2, 2.2]]) staffAt(x, z, mr(0, 6.28), 'guest');
    W.pop();
  }
}
function manorInteriors() {
  Object.assign(ROOM_ROW, { z: -520, x: { lodge: -160, shed: -60, stable: 40, genhouse: 140 } });
  // ---- the lodge: the gatekeeper's parlour, his desk with the guest list, the gun on the wall ----
  {
    const Wd = 9, D = 7, H = 2.9;
    roomShell('lodge', Wd, D, H, { name: '', en: 'the gate lodge', floor: 0x8a5a3a, wall: 0xe8dcc0, ceil: 0xe0d8c8, door: 0x2a4a3a });
    W.box(2.2, 1.4, 0.5, 0, 0.7, -3.25, STONE, { t: TX.stone }); W.box(1.0, 0.6, 0.1, 0, 0.45, -3.0, 0xff8a30, { layer: 'glow' }); W.lamp(0, 0.6, -2.4, 0xff9a40, 1.4, 6, { halo: 0.2, flicker: 0.3 });
    sofa(-2.6, 0, -1.4, Math.PI / 2, 0x6a3a2a, 1.8); desk(2.8, 0, 1.6, -Math.PI / 2, 1.4, 0.7); deskLamp(2.8, 0.78, 1.2, 0, true); paperStack(2.8, 0.78, 2.0);
    cctvWall(3.9, 0.4, -1, -Math.PI / 2, 2, 2); W.box(1.2, 0.08, 0.2, -4.35, 1.8, 1.6, 0x3a2a1a, { ry: Math.PI / 2 });
    floorRug(0, 0.03, -1, 3, 2, 0, 0x5a2a2a); W.lamp(0, 2.4, 0, 0xffd8a0, 1.4, 8, { halo: 0 });
    LOOT.spot('lodge', 2.8, 0.8, 1.0, 'cash');
    staffAt(2.0, 1.6, -Math.PI / 2, 'home');
    W.pop();
  }
  // ---- a garden shed: tools on the wall, the mower, sacks of feed, a radio ----
  {
    const Wd = 6, D = 5, H = 2.6;
    roomShell('shed', Wd, D, H, { name: '', en: 'a garden shed', floor: 0x6a5a40, wall: 0x7a5a3a, ceil: 0x5a4430, wallTx: TX.wood, door: 0x5a4a3a });
    for (let k = 0; k < 7; k++) W.rod([-2.5 + k * 0.7, 0.4, -2.35], [-2.5 + k * 0.7, 1.9, -2.35], 0.02, mpick([0x8a6a4a, 0x6a6e72]));
    W.box(1.2, 0.6, 0.7, 1.6, 0.3, 1.2, 0x2a6a3a, { layer: 'metal' }); for (let k = 0; k < 4; k++) W.box(0.5, 0.6, 0.35, -2 + k * 0.55, 0.3, 1.8, 0xc8b890, { t: TX.fabric });
    W.box(2.4, 0.06, 0.6, -1, 0.9, -1.9, 0x6a5a40, { t: TX.wood }); radioSet(-1.4, 0.93, -1.9, 0); bulb(0, H - 0.05, 0, 0.3, GLOW.warm, 1.6, 6);
    LOOT.spot('shed', -0.4, 0.95, -1.9, 'ammo');
    W.pop();
  }
  // ---- the stables: stalls down both sides, a horse in some, hay, the tack room door ----
  {
    const Wd = 16, D = 10, H = 4.4;
    roomShell('stable', Wd, D, H, { name: '', en: 'the stables', floor: 0x8a7a5a, wall: 0xb8a888, ceil: 0x5a4430, floorTx: TX.cobble, door: 0x2a4a3a });
    for (let k = 0; k < 5; k++) for (const s of [-1, 1]) { const x = -6 + k * 3; W.box(0.12, 1.5, 2.6, x - 1.4, 0.75, s * 3.4, 0x5a3a24, { t: TX.wood }); W.solid(0.12, 1.5, 2.6, x - 1.4, 0.75, s * 3.4, 'wood'); W.box(2.8, 0.1, 0.1, x, 1.45, s * 2.1, 0x5a3a24); if (mchance(0.6)) horse(x, s * 3.6, s > 0 ? 0 : Math.PI); else haybale(x, 0, s * 3.8, 0); }
    W.lamp(0, H - 0.4, 0, 0xffd8a0, 1.8, 12, { halo: 0 }); for (let x = -6; x <= 6; x += 4) hangLantern(x, H - 0.1, 0, 0xffc070, 0.6, true);
    LOOT.spot('stable', 7.2, 1.0, -0.4, 'medkit');
    staffAt(5, 0.5, Math.PI, 'home');
    W.pop();
  }
  // ---- the generator house: the diesel set, fuel drums, the breaker panel for the whole estate ----
  {
    const Wd = 10, D = 7, H = 3.6;
    roomShell('genhouse', Wd, D, H, { name: '', en: 'the generator house', floor: 0x6a6a68, wall: 0xb8b8b0, ceil: 0x4a4a4a, floorTx: TX.concrete, door: 0x5a6a72 });
    bigGenerator(0, 0, -1.2, 0); for (let k = 0; k < 4; k++) drum(-4 + k * 0.7, 0, 2.6, PC.red); W.box(1.4, 1.8, 0.2, 4.6, 1.2, -1, 0x8a8e94, { layer: 'metal', ry: -Math.PI / 2 });
    for (let k = 0; k < 6; k++) W.box(0.06, 0.12, 0.04, 4.48, 1.6 - k * 0.2, -1.4 + (k % 2) * 0.3, k % 3 ? 0x40ff7a : 0xff3a3a, { layer: 'glow' });
    ceilingLight(0, H - 0.05, 0, 0, 3, true); W.lamp(0, H - 0.4, 0, 0xe8f0ff, 1.8, 10, { halo: 0 });
    LOOT.spot('genhouse', 4.2, 0.9, 1.8, 'ammo');
    W.pop();
  }
}
function horse(x, z, ry) {
  W.push(x, 0, z, ry); const c = mpick([0x5a3a24, 0x3a2418, 0x8a6a4a, 0x1a1412]);
  W.box(1.6, 0.7, 0.5, 0, 1.25, 0, c); for (const sx of [-0.6, 0.6]) for (const sz of [-0.15, 0.15]) W.box(0.12, 0.95, 0.12, sx, 0.47, sz, c);
  W.box(0.3, 0.7, 0.28, 0.8, 1.6, 0, c, { rz: -0.5 }); W.box(0.55, 0.22, 0.24, 1.05, 1.95, 0, c, { rz: 0.4 }); W.box(0.2, 0.5, 0.04, -0.85, 1.2, 0, 0x1a1210, { rz: 0.3 });
  W.pop(); W.solid(1.8, 1.6, 0.6, x, 0.8, z, 'cloth', { ry });
}

// ---------------- the stashes ----------------
const LOOT = (() => {
  const spots = {}, taken = new Set();
  const KIND = { cash: ['A ROLL OF BANKNOTES', 150], ammo: ['AMMUNITION', 40], medkit: ['A FIELD DRESSING', 40] };
  return {
    spot(room, lx, ly, lz, kind) { if (W.mode === 'geom') return; const p = W.worldPos(lx, ly, lz); spots[room] = { x: p.x, y: p.y, z: p.z, kind };
      W.box(0.32, 0.18, 0.24, lx, ly + 0.09, lz, kind === 'cash' ? 0x4a3a24 : kind === 'ammo' ? 0x4a5a3a : 0xe8e8e0, { layer: 'metal' }); if (kind === 'medkit') W.box(0.12, 0.03, 0.04, lx, ly + 0.19, lz, 0xd82a2a); },
    near(door) { if (!door) return null; const s = spots[door.room]; if (!s || taken.has(door)) return null; return Math.hypot(s.x - P.pos.x, s.z - P.pos.z) < 1.6 && Math.abs(s.y - P.pos.y - 0.9) < 1.2 ? s : null; },
    prompt() { const d = DOORS.current; const s = LOOT.near(d); return s ? `[E]  SEARCH · ${KIND[s.kind][0]}` : ''; },
    take(door) {
      const s = LOOT.near(door); if (!s) return false;
      taken.add(door); audio.pouch(); const [what, n] = KIND[s.kind];
      if (s.kind === 'cash') P.stats.score += n; else if (s.kind === 'ammo') { for (const id in P.inv) P.inv[id].reserve += Math.ceil(WEAPONS[id].cap * 1.5); } else P.hp = Math.min(100, P.hp + n);
      feed(`<span class="s">FOUND ${what}${s.kind === 'cash' ? ` · +${n}` : s.kind === 'medkit' ? ' · +40 HP' : ''}</span>`); return true;
    },
  };
})();
