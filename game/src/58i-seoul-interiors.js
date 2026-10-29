// =====================================================================
//  NEON SEOUL — through the door: the rooms behind the shopfronts
// =====================================================================
// Most street doors in Seoul open (E). Each kind of business leads to its own furnished room, built
// out past the city's edge like the subway stations: a barbecue restaurant, a beer hof, a karaoke
// with its private room, a PC bang, a café, and — through a villa's front door — somebody's flat.
// Staff and customers are real people (they talk, and you can buy a snack where food is sold).
// Leave by the door you came in and you're back on the street where you were.
const ROOMS = {};          // kind → { x, z, D, name, en }
const ROOM_ROW = { z: -600, x: { bbq: -450, hof: -300, karaoke: -150, pc: 0, cafe: 150, apt: 300 } };
TOWN.doors = []; TOWN.staff = [];
// which room a business's door leads to
function roomFor(kind, txt = '') {
  if (kind === 'r') return 'bbq'; if (kind === 'b') return 'hof'; if (kind === 'c' || kind === 'o') return 'cafe'; if (kind === 'v') return 'apt';
  if (kind === 'n') return /PC/.test(txt) ? 'pc' : 'karaoke';
  return null;
}
// register a street door: (x, z) where you stand to open it, (ox, oz) a step back out on the pavement
function streetDoor(lx, lz, kind, txt) {
  const room = roomFor(kind, txt); if (!room || W.mode === 'geom') return;
  const a = W.worldPos(lx, 0, lz + 0.45), b = W.worldPos(lx, 0, lz + 1.6);
  TOWN.doors.push({ x: a.x, z: a.z, ox: b.x, oz: b.z, room, name: txt });
}
// a staff spot in the current frame; yaw is local (0 faces −z), turned into the world's
const staffAt = (lx, lz, yaw, role, route) => { if (W.mode === 'geom') return; const p = W.worldPos(lx, 0, lz), q = W.worldPos(lx - Math.sin(yaw), 0, lz - Math.cos(yaw)); TOWN.staff.push({ x: p.x, z: p.z, y: 0, yaw: Math.atan2(-(q.x - p.x), -(q.z - p.z)), role, route: route && route.map(([a, b]) => { const q = W.worldPos(a, 0, b); return [q.x, q.z]; }) }); };

// a closed room: floor, walls (solid), ceiling, the street door on its +z wall
function roomShell(kind, Wd, D, H, o) {
  const x = ROOM_ROW.x[kind], z = ROOM_ROW.z;
  flat(x - Wd / 2 - 6, z - D / 2 - 6, x + Wd / 2 + 6, z + D / 2 + 6, 0, 8); GR.rect(x, z, Wd + 20, D + 20, 0, GR.WALL, true);
  ROOMS[kind] = { x, z, D, name: o.name, en: o.en };
  W.push(x, 0, z, 0);
  W.box(Wd, 0.06, D, 0, 0.03, 0, o.floor, { t: o.floorTx ?? TX.wood, wear: 3 });
  for (const s of [-1, 1]) { W.box(Wd + 0.4, H, 0.2, 0, H / 2, s * (D / 2 + 0.1), o.wall, { t: o.wallTx ?? TX.plaster, wear: 2 }); W.solid(Wd + 0.4, H, 0.2, 0, H / 2, s * (D / 2 + 0.1), 'concrete'); W.box(0.2, H, D, s * (Wd / 2 + 0.1), H / 2, 0, o.wall, { t: o.wallTx ?? TX.plaster, wear: 2 }); W.solid(0.2, H, D, s * (Wd / 2 + 0.1), H / 2, 0, 'concrete'); }
  W.box(Wd, 0.1, D, 0, H + 0.05, 0, o.ceil ?? 0x2a2a2c);
  W.box(Wd, 0.12, 0.04, 0, 0.06, D / 2 - 0.01, shade(o.wall, 0.6));   // skirting
  // the door you came in by, and the exit sign over it
  W.box(1.3, 2.3, 0.08, 0, 1.15, D / 2 - 0.03, o.door ?? 0x5a6a72, { layer: 'metal' }); W.box(0.08, 0.4, 0.06, 0.45, 1.05, D / 2 - 0.1, 0xc8ccd0, { layer: 'metal' });
  W.box(0.7, 0.24, 0.05, 0, 2.6, D / 2 - 0.06, 0x2aa04a, { layer: 'glow' });
  W.lamp(0, H - 0.4, D / 2 - 1.2, 0xfff0d8, 1.2, 6, { halo: 0 });
  return { x, z };
}

// ---------------- 고깃집: Korean barbecue ----------------
function roomBBQ() {
  const Wd = 16, D = 11, H = 3.3;
  roomShell('bbq', Wd, D, H, { name: '고깃집', en: 'BBQ restaurant', floor: 0x6a4a32, wall: 0xc8b89a, ceil: 0x2a2624 });
  const steel = 0xb8bcc0;
  // six grill tables, each with its extractor duct dropping from the ceiling, banchan and soju on top
  for (let i = 0; i < 6; i++) {
    const x = -5.5 + (i % 3) * 4.6, z = -1.2 + Math.floor(i / 3) * 3.6;
    W.cyl(0.6, 0.55, 0.72, x, 0.36, z, 0x8a8e94, { seg: 14, layer: 'metal' }); W.solid(1.2, 0.75, 1.2, x, 0.37, z, 'metal');
    W.cyl(0.24, 0.24, 0.04, x, 0.74, z, 0x2a2a2a, { seg: 12 }); W.cyl(0.2, 0.2, 0.02, x, 0.765, z, 0xff6a1a, { seg: 12, layer: 'glow' });
    W.cyl(0.18, 0.2, H - 1.55, x, (H + 1.55) / 2, z, steel, { seg: 10, layer: 'metal' }); W.cyl(0.32, 0.18, 0.25, x, 1.62, z, steel, { seg: 12, layer: 'metal' });
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; W.cyl(0.06, 0.05, 0.03, x + Math.cos(a) * 0.42, 0.75, z + Math.sin(a) * 0.42, mpick([0xc0302a, 0x6aa02a, 0xe8d8a0, 0xe8e8e0]), { seg: 8 }); }
    for (let k = 0; k < 2; k++) W.cyl(0.035, 0.035, 0.22, x + 0.2 - k * 0.4, 0.84, z - 0.3, 0x2a8a4a, { seg: 6, layer: 'glass' });
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.5; stool(x + Math.cos(a) * 0.95, 0, z + Math.sin(a) * 0.95, 0xc0302a); }
    W.lamp(x, 1.4, z, 0xffb070, 1.1, 4, { halo: 0 });
  }
  // the kitchen pass at the back, menu boards over it, a soju fridge, posters
  W.box(8, 1.1, 0.7, 0, 0.55, -D / 2 + 0.5, 0xd8d8d0, { layer: 'metal' }); W.solid(8, 1.1, 0.7, 0, 0.55, -D / 2 + 0.5, 'metal');
  W.box(7.6, 1.1, 0.04, 0, 1.9, -D / 2 + 0.06, 0xffe0b0, { layer: 'glow' });
  for (let i = 0; i < 6; i++) { W.box(1.1, 0.45, 0.03, -3 + i * 1.2, 2.8, -D / 2 + 0.05, 0xf8f0d8, { layer: 'glow' }); }
  W.push(0, 0, -D / 2 + 0.08, 0); NEON.sign('삼겹살 · 목살 · 갈비', 0, 2.8, 0.01, 6.8, 0.4, { style: 'banner', col: 'red' }); W.pop();
  W.box(1.2, 2.0, 0.7, Wd / 2 - 0.8, 1.0, -2, 0xd8f0ff, { layer: 'glow' }); W.solid(1.2, 2.0, 0.7, Wd / 2 - 0.8, 1.0, -2, 'metal');
  for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) W.cyl(0.04, 0.04, 0.22, Wd / 2 - 1.3 + k * 0.17 - 0.0, 0.55 + r * 0.42, -1.75, mchance(0.7) ? 0x2a8a4a : 0xd8a020, { seg: 6, layer: 'glass' });
  for (let i = 0; i < 3; i++) W.box(0.9, 1.3, 0.02, -Wd / 2 + 0.03, 1.8, -3 + i * 2.6, mpick([0x2a8a4a, 0xe8e0d0, 0xd83a3a]), { ry: Math.PI / 2 });
  for (let x = -6; x <= 6; x += 3) W.box(2.4, 0.04, 0.3, x, H - 0.03, 1.5, 0xfff0d8, { layer: 'glow' });
  W.lamp(-4, 2.6, 0, 0xffd8a8, 1.6, 9, { halo: 0 }); W.lamp(4, 2.6, 0, 0xffd8a8, 1.6, 9, { halo: 0 });
  // people: a cook at the pass, a waitress doing the rounds, a manager by the till, two diners waiting
  staffAt(-1.5, -D / 2 + 1.4, Math.PI, 'food'); staffAt(2, 3.6, 0, 'food', [[2, 3.6], [-5.5, 0.7], [-1, 0.7], [3.6, 0.7], [3.6, -1.2, 2], [-1, 2.4], [2, 3.6, 3]]);
  staffAt(Wd / 2 - 1.6, 3.8, Math.PI / 2, 'food'); staffAt(-6.5, 4.2, -Math.PI / 4, 'guest'); staffAt(-5.6, 4.6, Math.PI * 0.8, 'guest');
  W.pop();
}

// ---------------- 호프: beer hall ----------------
function roomHof() {
  const Wd = 14, D = 10, H = 3.2;
  roomShell('hof', Wd, D, H, { name: '호프', en: 'beer hof', floor: 0x3a2a1e, wall: 0x5a3a2a, ceil: 0x1a1412, wallTx: TX.brick });
  // the bar: counter, taps, bottles glowing on the back shelf
  W.box(6, 1.1, 0.7, -2, 0.55, -D / 2 + 1.6, 0x4a2a1a, { t: TX.wood }); W.solid(6, 1.1, 0.7, -2, 0.55, -D / 2 + 1.6, 'wood'); W.box(6.2, 0.06, 0.8, -2, 1.12, -D / 2 + 1.6, 0x2a1a10, { t: TX.wood });
  for (let i = 0; i < 4; i++) { W.rod([-3.5 + i * 0.5, 1.12, -D / 2 + 1.5], [-3.5 + i * 0.5, 1.5, -D / 2 + 1.5], 0.025, 0xc8a050, { layer: 'metal' }); W.box(0.06, 0.12, 0.06, -3.5 + i * 0.5, 1.55, -D / 2 + 1.5, mpick([0xd8302a, 0x2a6ab0, 0xe8c020])); }
  W.box(6, 1.6, 0.3, -2, 2.0, -D / 2 + 0.2, 0xffb060, { layer: 'glow' });
  for (let r = 0; r < 3; r++) for (let k = 0; k < 18; k++) W.cyl(0.04, 0.04, 0.26, -4.8 + k * 0.32, 1.38 + r * 0.5, -D / 2 + 0.38, mpick([0x2a8a4a, 0x8a5a2a, 0xe8e8e0, 0x2a5aa0]), { seg: 6, layer: 'glass' });
  // TV with the match on, neon on the wall
  W.box(2.6, 1.5, 0.08, Wd / 2 - 0.06, 2.1, -1, 0x2a6ad8, { layer: 'glow', ry: Math.PI / 2 }); W.box(2.0, 0.6, 0.05, Wd / 2 - 0.05, 1.8, -1, 0x3ab04a, { layer: 'glow', ry: Math.PI / 2 });
  W.push(-Wd / 2 + 0.12, 0, 1.5, Math.PI / 2); NEON.sign('생맥주 치킨', 0, 2.3, 0, 3.8, 0.8, { style: 'tube', col: 'yellow', pool: false }); W.pop();
  // high tables, a plate of fried chicken and frothy mugs on each
  for (let i = 0; i < 5; i++) {
    const x = -4.5 + (i % 3) * 4.5 + (i > 2 ? 2.2 : 0), z = 0.8 + Math.floor(i / 3) * 2.8;
    W.cyl(0.45, 0.45, 0.05, x, 1.08, z, 0x4a2a1a, { seg: 12, t: TX.wood }); W.cyl(0.05, 0.05, 1.05, x, 0.53, z, 0x1a1a1a, { seg: 6, layer: 'metal' }); W.cyl(0.3, 0.3, 0.03, x, 0.02, z, 0x1a1a1a, { seg: 10, layer: 'metal' }); W.solid(0.9, 1.1, 0.9, x, 0.55, z, 'wood');
    W.cyl(0.18, 0.15, 0.05, x - 0.1, 1.13, z, 0xe8e8e0, { seg: 10 }); for (let k = 0; k < 5; k++) W.sphere(0.07, 0.05, 0.06, x - 0.15 + (k % 3) * 0.08, 1.18, z - 0.05 + Math.floor(k / 3) * 0.08, 0xc87a2a, { seg: 5, hseg: 3 });
    for (let k = 0; k < 2; k++) { W.cyl(0.05, 0.05, 0.16, x + 0.2, 1.19, z - 0.12 + k * 0.24, 0xe8b030, { seg: 8, layer: 'glass' }); W.cyl(0.05, 0.05, 0.03, x + 0.2, 1.285, z - 0.12 + k * 0.24, 0xf8f4e8, { seg: 8 }); }
    W.lamp(x, 2.6, z, 0xffc080, 1.0, 5, { halo: 0 }); W.rod([x, H, z], [x, 2.5, z], 0.006, 0x1a1a1a); W.sphere(0.2, 0.16, 0.2, x, 2.45, z, 0xffd090, { layer: 'glow' });
  }
  staffAt(-2, -D / 2 + 0.9, 0, 'bar'); staffAt(-4.9, 0.3, 0.6, 'guest'); staffAt(-4.0, 1.4, -2.4, 'guest'); staffAt(0.5, 3.0, 2.2, 'guest'); staffAt(4.8, 0.2, -0.5, 'guest');
  W.pop();
}

// ---------------- 노래방: karaoke ----------------
function roomKaraoke() {
  const Wd = 14, D = 12, H = 3.0;
  roomShell('karaoke', Wd, D, H, { name: '노래방', en: 'karaoke', floor: 0x1a1424, wall: 0x2a1a3a, ceil: 0x0e0a14, door: 0x3a2a4a });
  // reception by the door, the corridor of numbered rooms down the left
  W.box(2.6, 1.05, 0.7, 4.5, 0.52, 3.6, 0x1a1a22, { layer: 'metal' }); W.solid(2.6, 1.05, 0.7, 4.5, 0.52, 3.6, 'metal'); W.box(2.6, 0.04, 0.04, 4.5, 1.05, 3.94, 0xff2a8a, { layer: 'glow' });
  for (let i = 0; i < 4; i++) { const z = 3.6 - i * 2.4; W.box(0.06, 2.1, 0.9, -Wd / 2 + 0.05, 1.05, z, 0x4a3a5a, { layer: 'metal' }); W.box(0.04, 0.5, 0.35, -Wd / 2 + 0.09, 1.5, z, 0x9a6aff, { layer: 'glow' }); W.push(-Wd / 2 + 0.12, 0, z, Math.PI / 2); NEON.sign(`${i + 1}`, 0, 2.35, 0, 0.4, 0.3, { style: 'led', col: 'pink', glow: false, pool: false, lamp: false }); W.pop(); }
  for (const z of [-D / 2 + 0.2, D / 2 - 0.2]) W.box(Wd, 0.04, 0.04, 0, 2.9, z, 0xff2a8a, { layer: 'glow' });
  for (const x of [-Wd / 2 + 0.2, Wd / 2 - 0.2]) W.box(0.04, 0.04, D, x, 2.9, 0, 0x2af0ff, { layer: 'glow' });
  // room 5, open: U sofa, low table with tambourines and mics, the big screen, a mirror ball
  const rz = -2.5;
  W.box(7.6, 0.06, 0.06, 2.4, 2.95, rz + 2.6, 0x9a6aff, { layer: 'glow' });
  sofa(2.4, 0, rz - 1.6, 0, 0x6a2a8a, 4.4); sofa(0.0, 0, rz + 0.4, Math.PI / 2, 0x6a2a8a, 2.6); sofa(4.8, 0, rz + 0.4, -Math.PI / 2, 0x6a2a8a, 2.6);
  W.box(2.6, 0.45, 1.2, 2.4, 0.22, rz + 0.3, 0x1a1a22, { layer: 'metal' }); W.solid(2.6, 0.45, 1.2, 2.4, 0.22, rz + 0.3, 'wood'); W.box(2.6, 0.02, 1.2, 2.4, 0.46, rz + 0.3, 0x3a2a6a, { layer: 'glow' });
  for (let k = 0; k < 2; k++) { W.cyl(0.025, 0.02, 0.22, 1.8 + k * 0.5, 0.58, rz + 0.3, 0x1a1a1a, { seg: 6, rz: 1.4 }); W.sphere(0.04, 0.04, 0.04, 1.69 + k * 0.5, 0.6, rz + 0.3, 0x8a8e94, { layer: 'metal' }); }
  W.cyl(0.13, 0.13, 0.05, 3.2, 0.5, rz + 0.1, 0xd8302a, { seg: 12, rx: 0.3 }); for (let k = 0; k < 4; k++) W.cyl(0.04, 0.04, 0.2, 2.9 + k * 0.12, 0.57, rz + 0.6, mpick([0x2a8a4a, 0xe8c020, 0x2a6ab0]), { seg: 6, layer: 'glass' });
  ledScreen(ROOM_ROW.x.karaoke + 2.4, 1.7, ROOM_ROW.z + rz + 2.75, Math.PI, 3.4, 1.9, 5);
  W.sphere(0.25, 0.25, 0.25, 2.4, 2.6, rz, 0xd8dce0, { layer: 'metal', seg: 10, hseg: 8 }); W.rod([2.4, 3.0, rz], [2.4, 2.85, rz], 0.01, 0x8a8a8a);
  for (const [c, x] of [[0xff2a8a, 1.2], [0x2af0ff, 3.6], [0xffd040, 2.4]]) W.lamp(x, 2.4, rz, c, 1.6, 5, { halo: 0.2 });
  for (let k = 0; k < 30; k++) W.box(0.06, 0.06, 0.01, mr(-Wd / 2 + 1, Wd / 2 - 1), mr(0.6, 2.8), -D / 2 + 0.02, mpick([0xff2a8a, 0x2af0ff, 0xffd040, 0x9a6aff]), { layer: 'glow' });
  staffAt(4.5, 4.4, 0, 'room'); staffAt(1.4, rz + 1.2, Math.PI * 0.95, 'guest'); staffAt(3.4, rz + 1.3, -Math.PI * 0.9, 'guest');
  W.pop();
}

// ---------------- PC방 ----------------
function roomPC() {
  const Wd = 16, D = 12, H = 3.0;
  roomShell('pc', Wd, D, H, { name: 'PC방', en: 'PC bang', floor: 0x1a1c22, wall: 0x22262e, ceil: 0x101216, floorTx: TX.ceramic });
  for (const x of [-Wd / 2 + 0.2, Wd / 2 - 0.2]) W.box(0.04, 0.04, D, x, 2.4, 0, 0x2a8aff, { layer: 'glow' });
  // four rows of desks, two monitors deep, RGB keyboards, gaming chairs
  for (let r = 0; r < 4; r++) for (let k = 0; k < 7; k++) {
    const x = -6 + k * 1.6, z = -4.4 + r * 2.4, face = r % 2 ? 0 : Math.PI;
    W.push(x, 0, z, face);
    W.box(1.4, 0.05, 0.75, 0, 0.74, -0.15, 0x2a2a2e, { layer: 'metal' }); W.box(1.4, 0.72, 0.05, 0, 0.36, -0.5, 0x1a1a1e, { layer: 'metal' });
    W.box(0.62, 0.38, 0.03, 0, 1.08, -0.38, mpick([0x3a6ad8, 0x2aa04a, 0xd8602a, 0x8a3ad8, 0x2ab0d8, 0xd83a5a]), { layer: 'glow' }); W.box(0.66, 0.42, 0.04, 0, 1.08, -0.4, 0x0e0e10, { layer: 'metal' }); W.box(0.05, 0.25, 0.05, 0, 0.86, -0.42, 0x1a1a1e);
    W.box(0.45, 0.02, 0.15, -0.05, 0.775, 0.0, mpick([0xff2a8a, 0x2af0ff, 0x40ff7a]), { layer: 'glow' }); W.box(0.08, 0.02, 0.1, 0.3, 0.775, 0.0, 0x2a2a2a);
    chairOffice(0, 0, 0.45, Math.PI, mpick([0xd8302a, 0x1a1a1a, 0x2a2a6a]));
    W.pop();
  }
  for (let r = 0; r < 4; r++) W.solid(11.4, 1.0, 0.8, -1.2, 0.5, -4.4 + r * 2.4 + (r % 2 ? -0.15 : 0.15), 'metal');
  // the counter: noodles, drinks fridge, snacks; the price board in LEDs
  W.box(3, 1.05, 0.7, Wd / 2 - 2, 0.52, 4.4, 0x1a1a22, { layer: 'metal' }); W.solid(3, 1.05, 0.7, Wd / 2 - 2, 0.52, 4.4, 'metal');
  W.box(1.0, 2.0, 0.6, Wd / 2 - 0.5, 1.0, 2.6, 0xd8f0ff, { layer: 'glow' }); W.solid(1.0, 2.0, 0.6, Wd / 2 - 0.5, 1.0, 2.6, 'metal');
  for (let k = 0; k < 10; k++) W.cyl(0.06, 0.05, 0.1, Wd / 2 - 3.2 + k * 0.25, 1.1, 4.35, mpick([0xd8302a, 0xe8a020]), { seg: 8 });
  W.push(Wd / 2 - 0.12, 0, 4.4, -Math.PI / 2); NEON.sign('1시간 1,500원', 0, 2.2, 0, 2.6, 0.4, { style: 'led', col: 'green', glow: false, pool: false, lamp: false }); W.pop();
  for (let x = -6; x <= 6; x += 3) W.lamp(x, 2.6, 0, 0xb0c8ff, 1.0, 7, { halo: 0 });
  staffAt(Wd / 2 - 2, 3.7, Math.PI, 'room'); for (const [k, r] of [[1, 0], [4, 1], [2, 2], [5, 3]]) staffAt(-6 + k * 1.6, -4.4 + r * 2.4 + (r % 2 ? 0.55 : -0.55), r % 2 ? 0 : Math.PI, 'guest');
  W.pop();
}

// ---------------- 카페 ----------------
function roomCafe() {
  const Wd = 12, D = 9, H = 3.4;
  roomShell('cafe', Wd, D, H, { name: '카페', en: 'café', floor: 0x8a6a4a, wall: 0xe8e0d0, ceil: 0x3a3430 });
  W.box(5, 1.05, 0.7, -2.5, 0.52, -D / 2 + 1.4, 0x6a4a2a, { t: TX.wood }); W.solid(5, 1.05, 0.7, -2.5, 0.52, -D / 2 + 1.4, 'wood'); W.box(5.2, 0.05, 0.8, -2.5, 1.07, -D / 2 + 1.4, 0xe8e8e4, { t: TX.stone });
  espressoMachine(-3.8, 1.1, -D / 2 + 1.4, 0); espressoMachine(-2.4, 1.1, -D / 2 + 1.4, 0);
  W.box(1.4, 0.5, 0.6, -0.6, 1.33, -D / 2 + 1.4, 0xfff0d0, { layer: 'glow' }); for (let k = 0; k < 8; k++) W.sphere(0.09, 0.06, 0.09, -1.1 + (k % 4) * 0.3, 1.25 + Math.floor(k / 4) * 0.2, -D / 2 + 1.4, mpick([0xc88a4a, 0xe8c890, 0x6a3a1a, 0xe86a8a]), { seg: 6, hseg: 4 });
  W.box(4, 1.2, 0.05, -2.5, 2.5, -D / 2 + 0.04, 0x1a1a1a); W.push(-2.5, 0, -D / 2 + 0.07, 0); NEON.sign('아메리카노 · 라떼', 0, 2.65, 0, 3.4, 0.35, { style: 'plate', col: '#ffffff', dim: 0.9 }); NEON.sign('4,500원', 0, 2.25, 0, 1.6, 0.3, { style: 'plate', col: '#e8d8b0', dim: 0.9 }); W.pop();
  for (let i = 0; i < 4; i++) { const x = 1.5 + (i % 2) * 2.6, z = -1.8 + Math.floor(i / 2) * 2.8; W.cyl(0.38, 0.38, 0.04, x, 0.74, z, 0xe8e0d0, { seg: 12 }); W.cyl(0.04, 0.04, 0.72, x, 0.36, z, 0x2a2a2a); W.solid(0.8, 0.76, 0.8, x, 0.38, z, 'wood'); for (const s of [-1, 1]) bistroChair(x + s * 0.65, 0, z, s * Math.PI / 2, 0x3a3a3a); W.cyl(0.04, 0.035, 0.1, x + 0.1, 0.81, z, 0xe8e8e0, { seg: 8 }); }
  for (let k = 0; k < 4; k++) { W.rod([-4 + k * 1.2, H, 0], [-4 + k * 1.2, 2.3, 0], 0.006, 0x1a1a1a); W.sphere(0.12, 0.16, 0.12, -4 + k * 1.2, 2.25, 0, 0xffd090, { layer: 'glow' }); }
  for (const [x, z] of [[-Wd / 2 + 0.6, 3.6], [Wd / 2 - 0.6, 3.6], [Wd / 2 - 0.6, -3.6]]) plantPot(x, 0, z, 'ficus', 2.2);
  shelfUnit(-Wd / 2 + 0.25, 0, 0.5, Math.PI / 2, 2.4, 2.0, 0.4, 0x6a4a2a, 'books');
  W.lamp(-2, 2.8, -1, 0xffd8a8, 1.6, 9, { halo: 0 }); W.lamp(3, 2.8, 0.5, 0xffd8a8, 1.4, 9, { halo: 0 });
  staffAt(-3, -D / 2 + 0.75, 0, 'cafe'); staffAt(-0.8, -D / 2 + 0.75, 0, 'cafe'); staffAt(1.5, -1.0, Math.PI, 'guest'); staffAt(-1.5, -1.6, 0.3, 'guest');
  W.pop();
}

// ---------------- a villa flat ----------------
function roomApt() {
  const Wd = 11, D = 9, H = 2.6;
  roomShell('apt', Wd, D, H, { name: '빌라', en: 'a flat', floor: 0xb89a6a, wall: 0xe8e4d8, ceil: 0xe8e8e4, door: 0x5a4a3a });
  // the entrance step and the shoes, the partition to the bedroom
  W.box(1.6, 0.04, 1.2, 0, 0.05, D / 2 - 0.6, 0x8a8a84, { t: TX.ceramic }); for (let k = 0; k < 5; k++) W.box(0.12, 0.08, 0.28, -0.5 + k * 0.25, 0.1, D / 2 - 0.5, mpick([0xe8e8e0, 0x2a2a2a, 0xd83a3a]));
  W.box(0.12, H, 4.5, 1.5, H / 2, -2.25, 0xe8e4d8, { t: TX.plaster }); W.solid(0.12, H, 4.5, 1.5, H / 2, -2.25, 'concrete');
  // living room: sofa, low table with fruit, TV on, a fan, the rice cooker on the counter
  sofa(-3.2, 0, 1.6, Math.PI, 0x6a7a8a, 2.4); lowTable(-3.2, 0, 0.4, 0, 1.2, 0.6); fruitBowl(-3.2, 0.42, 0.4);
  W.box(1.6, 0.9, 0.06, -3.2, 1.2, -D / 2 + 0.08, 0x3a6aa8, { layer: 'glow' }); W.box(1.7, 0.5, 0.4, -3.2, 0.25, -D / 2 + 0.3, 0x4a3a2a, { t: TX.wood }); W.lamp(-3.2, 1.2, -D / 2 + 1.2, 0x6aa0ff, 0.8, 4, { halo: 0 });
  fanStand(-5, 0, 2.6, 2.4); floorRug(-3.2, 0.04, 0.6, 2.6, 2.0, 0, 0x8a6a4a);
  kitchenRun(-Wd / 2 + 0.35, 0, -1.6, Math.PI / 2, 2.6); fridge(-Wd / 2 + 0.45, 0, 0.6, Math.PI / 2);
  // bedroom: bed, wardrobe, desk with a laptop, laundry drying by the window
  bed(3.6, 0, -2.4, 0, 0xd8a0b0); W.box(1.2, 2.0, 0.6, Wd / 2 - 0.4, 1.0, 0.4, 0xd8c8a8, { t: TX.wood, ry: Math.PI / 2 }); W.solid(0.6, 2.0, 1.2, Wd / 2 - 0.4, 1.0, 0.4, 'wood');
  desk(2.4, 0, 2.6, Math.PI, 1.2, 0.6); laptop(2.4, 0.76, 2.6, Math.PI);
  for (let k = 0; k < 6; k++) W.box(0.3, 0.45, 0.01, 2.6 + k * 0.4, 1.6, -D / 2 + 0.6, mpick([0xe8e8e0, 0x6a8ab0, 0xd8a0b0, 0x2a2a2a]));
  W.rod([2.4, 1.85, -D / 2 + 0.6], [5.1, 1.85, -D / 2 + 0.6], 0.01, 0xc8ccd0);
  // the window: the city lit up beyond the glass
  const view = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#0a0b14'; g.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { g.fillStyle = Math.random() < 0.15 ? `hsl(${Math.random() * 360},90%,60%)` : `rgba(255,${200 + Math.random() * 40},${140 + Math.random() * 60},${0.4 + Math.random() * 0.6})`; g.fillRect(Math.random() * w, h * 0.25 + Math.random() * h * 0.75, 2, 2); } });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.4), new THREE.MeshBasicMaterial({ map: view, toneMapped: false }));
  const wp = W.worldPos(3.6, 1.55, -D / 2 + 0.02); win.position.copy(wp); scene.add(win);
  W.box(3.2, 1.6, 0.06, 3.6, 1.55, -D / 2 + 0.03, 0xe8e8e0, { layer: 'metal' }); W.box(0.05, 1.5, 0.08, 3.6, 1.55, -D / 2 + 0.06, 0xe8e8e0, { layer: 'metal' });
  W.lamp(-2, 2.2, 0, 0xfff0d8, 1.4, 8, { halo: 0 }); W.lamp(3.4, 2.2, -1, 0xffe0c0, 1.0, 6, { halo: 0 }); W.box(0.6, 0.05, 0.6, -2, H - 0.03, 0, 0xfff8e8, { layer: 'glow' });
  staffAt(-3.2, 0.9, Math.PI, 'home');
  W.pop();
}
function seoulInteriors() { roomBBQ(); roomHof(); roomKaraoke(); roomPC(); roomCafe(); roomApt(); }

// ---------------- runtime: E at a door, E at the door inside ----------------
const DOORS = (() => {
  if (MAP.id !== 'seoul') return { interact: () => false, prompt: () => '', get inside() { return false; }, get room() { return null; } };
  let inside = null, fadeEl = null, busyUntil = 0;
  const fade = (fn) => {
    if (!fadeEl) { fadeEl = document.createElement('div'); fadeEl.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .25s;z-index:40'; document.body.appendChild(fadeEl); }
    busyUntil = performance.now() + 700; fadeEl.style.opacity = '1'; audio.pouch(); setTimeout(() => { fn(); setTimeout(() => { fadeEl.style.opacity = '0'; }, 100); }, 260);
  };
  const near = () => {
    if (P.vehicle || P.dead || SUBWAY.under) return null;
    if (inside) { const R2 = ROOMS[inside.room]; return Math.hypot(P.pos.x - R2.x, P.pos.z - (R2.z + R2.D / 2)) < 1.8 ? inside : null; }
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); let best = null, bd = 1.7;
    for (const d of TOWN.doors) { const dx = d.x - P.pos.x, dz = d.z - P.pos.z; if (Math.abs(dx) > 2 || Math.abs(dz) > 2) continue; const L = Math.hypot(dx, dz); if (L < bd && (L < 0.5 || (dx * fx + dz * fz) / L > 0.2)) { bd = L; best = d; } }
    return best;
  };
  function interact() {
    if (performance.now() < busyUntil) return false;
    const d = near(); if (!d) return false;
    if (inside) { const back = inside; fade(() => { P.pos.set(back.ox, 0.05, back.oz); P.vel.set(0, 0, 0); P.yaw = Math.atan2(-(back.ox - back.x), -(back.oz - back.z)); STREAM.prime(P.pos); }); inside = null; return true; }
    const R2 = ROOMS[d.room];
    fade(() => { P.pos.set(R2.x, 0.05, R2.z + R2.D / 2 - 1.1); P.vel.set(0, 0, 0); P.yaw = 0; STREAM.prime(P.pos); feed(`<span class="s">${d.name ? d.name + ' · ' : ''}${R2.en.toUpperCase()}</span>`); });
    inside = d; return true;
  }
  return {
    interact,
    prompt() { if (performance.now() < busyUntil) return ''; const d = near(); return d ? (inside ? '[E]  나가기 · LEAVE' : `[E]  들어가기 · ENTER${d.name ? '  ' + d.name : ''}`) : ''; },
    get inside() { return !!inside; },
    get room() { return inside ? inside.room : null; },
  };
})();
// under a roof: no rain (subway, rooms)
const indoors = () => SUBWAY.under || DOORS.inside;
