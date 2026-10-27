// =====================================================================
//  Prop catalog, part 2: grandstands, pit & track furniture, buildings,
//  skyscrapers, landmarks.
// =====================================================================

// ---------- grandstands ----------
const STAND = 'Grandstands';
// Stepped seating rows along x (length L), rising towards -z. Returns the top height and depth.
function tiers(K, L, rows, rowD, rowH, y0 = 0, z0 = 0, crowdMat = null) {
  const m = crowdMat || pm(0xffffff, { map: FT.crowd, r: 0.9 });
  for (let i = 0; i < rows; i++) {
    const y = y0 + i * rowH, z = z0 - i * rowD;
    K.box(L, rowH, rowD, C.concrete, 0, y, z);
    // Seated crowd (or seats) on the riser face of each step.
    K.panel(L, rowH * 0.95, m, 0, y + rowH, z - rowD * 0.3, 0, -0.35);
  }
  return { top: y0 + rows * rowH, depth: rows * rowD };
}
function standLegs(K, L, h, z, step = 6) { for (let x = -L / 2; x <= L / 2 + 0.01; x += step) K.box(0.4, h, 0.4, C.darkSteel, x, 0, z); }
defProp({ id: 'stand_bleacher', name: 'Bleachers (open)', cat: STAND, r: 0, build: (K) => {
  const L = 24, rows = 8;
  for (let i = 0; i < rows; i++) { K.box(L, 0.08, 0.7, C.steel, 0, 0.5 + i * 0.45, -i * 0.75); K.box(L, 0.45, 0.04, C.darkSteel, 0, 0.1 + i * 0.45, -i * 0.75 + 0.3); }
  K.panel(L, 3.3, pm(0xffffff, { map: FT.crowd, r: 0.9 }), 0, 0.9, -2.6, 0, -0.55);
  for (let x = -L / 2; x <= L / 2; x += 4) { K.rod([x, 0, 0.3], [x, 4.1, -5.6], 0.06, C.steel); K.rod([x, 0, -5.6], [x, 4.1, -5.6], 0.06, C.steel); }
  K.box(L, 1, 0.05, C.steel, 0, 4.1, -5.9);
} });
defProp({ id: 'stand_covered', name: 'Covered Grandstand', cat: STAND, sp: true, r: 0, build: (K, ctx) => {
  const L = 40, t = tiers(K, L, 14, 0.85, 0.5, 1.2);
  K.box(L, 1.2, 1.2, C.concrete, 0, 0, 0.3);
  K.box(L, t.top + 6, 0.6, C.concrete, 0, 0, -t.depth - 0.3);
  const roofY = t.top + 6;
  K.box(L + 2, 0.4, t.depth + 6, C.white, 0, roofY, -t.depth / 2 + 2.5, 0, -0.06);
  for (let x = -L / 2; x <= L / 2; x += 8) { K.box(0.5, roofY, 0.5, C.darkSteel, x, 0, -t.depth - 0.9); K.rod([x, roofY + 0.2, -t.depth - 0.9], [x, roofY + 1.6, 4], 0.12, C.darkSteel); }
  // Sponsor fascia along the roof edge.
  K.box(L + 2, 1.6, 0.3, C.dark, 0, roofY - 0.9, 5.1);
  K.panel(L, 1.4, ctx.sp('wall'), 0, roofY - 0.8, 5.27);
} });
defProp({ id: 'stand_double', name: 'Double-Tier Grandstand', cat: STAND, sp: true, r: 0, build: (K, ctx) => {
  const L = 50;
  const lower = tiers(K, L, 10, 0.85, 0.5, 1);
  K.box(L, 3.2, 3, C.glass, 0, lower.top, -lower.depth - 1.2);            // hospitality boxes between tiers
  K.box(L, 0.6, lower.depth + 4, C.concrete, 0, lower.top + 3.2, -lower.depth / 2 - 1);
  const upper = tiers(K, L, 12, 0.85, 0.55, lower.top + 3.8, -2.5);
  K.box(L, upper.top + 4, 0.8, C.concrete, 0, 0, -2.5 - upper.depth - 0.4);
  K.box(L + 4, 0.5, upper.depth + 8, C.white, 0, upper.top + 4, -upper.depth / 2, 0, -0.05);
  K.box(L + 4, 1.8, 0.3, C.dark, 0, upper.top + 3.2, 5.6); K.panel(L, 1.6, ctx.sp('wall'), 0, upper.top + 3.3, 5.77);
  K.panel(L - 2, 1.2, ctx.sp('wall'), 0, lower.top + 3.25, 0.52);
} });
defProp({ id: 'stand_curved', name: 'Curved Grandstand', cat: STAND, r: 0, build: (K) => {
  const segs = 7, R = 40, arc = 0.9;
  for (let s = 0; s < segs; s++) {
    const a = -arc / 2 + (s + 0.5) * (arc / segs), seg = new THREE.Group();
    const k2 = kit(seg);
    tiers(k2, (R * arc) / segs + 0.4, 10, 0.85, 0.5, 0.6);
    k2.box((R * arc) / segs + 0.4, 9, 0.5, C.concrete, 0, 0, -8.8);
    seg.position.set(Math.sin(a) * R, 0, R - Math.cos(a) * R);
    seg.rotation.y = -a;
    K.group.add(seg);
  }
} });
defProp({ id: 'stand_temp', name: 'Temporary Scaffold Stand', cat: STAND, sp: true, r: 0, build: (K, ctx) => {
  const L = 20, rows = 10;
  for (let i = 0; i < rows; i++) K.box(L, 0.06, 0.8, C.steel, 0, 1.5 + i * 0.5, -i * 0.8);
  K.panel(L, 5.2, pm(0xffffff, { map: FT.seats, r: 0.6 }), 0, 1.6, -3.7, 0, -0.56);
  for (let x = -L / 2; x <= L / 2; x += 2.5) for (let z = 0; z >= -8; z -= 2) {
    const h = 1.5 + (-z / 0.8) * 0.5;
    K.cyl(0.04, 0.04, h, C.steel, x, 0, z, 6);
    if (z > -8) K.rod([x, 0.2, z], [x, h - 0.2, z - 2], 0.025, C.steel);
  }
  K.panel(L, 1.4, ctx.sp('banner'), 0, 0.05, 0.25);
} });
defProp({ id: 'stand_vip', name: 'VIP Terrace', cat: STAND, sp: true, r: 0, build: (K, ctx) => {
  const L = 30;
  K.box(L, 4, 10, C.concrete, 0, 0, -5);
  K.box(L, 3.6, 8, C.glass, 0, 4, -5); K.box(L + 1, 0.4, 11, C.white, 0, 7.6, -5);
  K.box(L, 0.2, 2.5, C.wood, 0, 4, 0.9);
  for (let x = -L / 2; x <= L / 2; x += 1.2) K.cyl(0.02, 0.02, 1.1, C.chrome, x, 4.2, 2.1, 4);
  K.box(L, 0.05, 0.05, C.chrome, 0, 5.3, 2.1);
  for (let x = -L / 2 + 2; x < L / 2; x += 4) { K.cyl(0.5, 0.5, 0.05, C.white, x, 4.95, 0.6, 12); K.cyl(0.05, 0.05, 0.75, C.chrome, x, 4.2, 0.6, 6); }
  K.box(L + 1, 1.2, 0.2, C.dark, 0, 6.6, 0.6); K.panel(L, 1.0, ctx.sp('screen'), 0, 6.7, 0.71);
} });
defProp({ id: 'stand_main', name: 'Main Grandstand + Screen', cat: STAND, sp: true, r: 0, build: (K, ctx) => {
  const L = 80, t = tiers(K, L, 20, 0.9, 0.55, 1.5);
  K.box(L, 1.5, 1, C.concrete, 0, 0, 0.5);
  K.box(L, t.top + 8, 1, C.concrete, 0, 0, -t.depth - 0.5);
  const roofY = t.top + 8;
  K.box(L + 6, 0.6, t.depth + 10, C.white, 0, roofY, -t.depth / 2 + 4, 0, -0.04);
  for (let x = -L / 2; x <= L / 2; x += 10) { K.box(0.8, roofY + 3, 0.8, C.darkSteel, x, 0, -t.depth - 1.4); K.rod([x, roofY + 3, -t.depth - 1.4], [x, roofY + 0.6, 9], 0.14, C.darkSteel); }
  K.box(L + 6, 2.4, 0.4, C.dark, 0, roofY - 1.6, 9.2); K.panel(L, 2.0, ctx.sp('wall'), 0, roofY - 1.4, 9.42);
  K.box(18, 6, 0.6, C.black, 0, roofY + 0.8, -t.depth / 2); K.panel(17, 5.2, ctx.sp('screen'), 0, roofY + 1.2, -t.depth / 2 + 0.31);
} });
defProp({ id: 'stand_bank', name: 'Spectator Bank', cat: STAND, r: 0, build: (K, ctx) => {
  K.side([[4, 0], [-10, 4.5], [-14, 4.5], [-14, 0]], 30, C.grass, 0, 0, 0);
  const crowd = pm(0xffffff, { map: FT.crowd, r: 0.9 });
  K.panel(30, 14.7, crowd, 0, 2.3 - 7.35, -3, 0, -(Math.PI / 2 - Math.atan2(4.5, 14)));   // lies on the slope
  for (let x = -12; x <= 12; x += 6) { K.cyl(0.04, 0.04, 2.6, C.steel, x, 4.5, -12, 6); }
} });

// ---------- pit & track ----------
const PIT = 'Pit & Track';
defProp({ id: 'pit_wall', name: 'Pit Wall + Gantry', cat: PIT, sp: true, r: 0, build: (K, ctx) => {
  const L = 20;
  K.box(L, 1.2, 0.5, C.concrete, 0, 0, 0);
  for (const s of [-1, 1]) K.panel(L - 0.2, 1.0, ctx.sp('wall'), 0, 0.1, s * 0.26, s > 0 ? 0 : Math.PI);
  K.box(L, 3.6, 0.1, pm(0xc0c4ca, { map: TEX.fence, t: true, at: 0.25, ds: true, m: 0.4 }), 0, 1.2, 0.0);
  for (let x = -L / 2 + 2; x < L / 2; x += 4) {
    K.box(3.4, 0.12, 2.2, C.dark, x, 2.6, -1.6);                     // team stand roof
    K.box(3.0, 0.7, 0.05, C.black, x, 1.4, -0.9); K.box(2.8, 0.55, 0.02, pm(0x0a1a2a, { e: 0x2266aa, ei: 0.6 }), x, 1.47, -0.87);
    for (const sx of [-1.1, 0, 1.1]) { K.cyl(0.25, 0.25, 0.08, C.dark, x + sx, 0.8, -1.8, 10); K.cyl(0.04, 0.04, 0.8, C.steel, x + sx, 0, -1.8, 6); }
    K.box(0.08, 2.6, 0.08, C.steel, x - 1.6, 0, -2.6); K.box(0.08, 2.6, 0.08, C.steel, x + 1.6, 0, -2.6);
  }
} });
defProp({ id: 'pit_garages', name: 'Pit Garage Block', cat: PIT, sp: true, r: 0, build: (K, ctx) => {
  const L = 48;
  K.tower(L, 6, 16, pm(0xffffff, { map: FT.metal, r: 0.6, m: 0.3 }), 4, 6, 0, 0, -8);
  for (let i = 0; i < 8; i++) {
    const x = -L / 2 + 3 + i * 6;
    K.box(5.2, 4.6, 0.12, i % 2 ? C.dark : pm(0x2a2f37, { r: 0.5 }), x, 0, 0.06);
    K.box(5.0, 1.0, 0.04, ctx.sp('wall'), x, 4.75, 0.08);
  }
  K.box(L + 2, 0.5, 18, C.white, 0, 6, -8);
  K.box(L, 4, 14, C.glass, 0, 6.5, -9); K.box(L + 2, 0.4, 16, C.white, 0, 10.5, -9);
} });
defProp({ id: 'race_control', name: 'Race Control Tower', cat: PIT, sp: true, r: 4, build: (K, ctx) => {
  K.cyl(3.2, 3.6, 18, C.concrete, 0, 0, 0, 20);
  K.cyl(6.2, 5.2, 4.5, C.glass, 0, 18, 0, 24);
  K.cyl(6.6, 6.6, 0.5, C.white, 0, 22.5, 0, 24); K.cyl(6.6, 6.2, 0.4, C.white, 0, 17.6, 0, 24);
  K.cyl(0.15, 0.15, 6, C.steel, 0, 23, 0, 8); K.sph(0.3, C.redLight, 0, 29, 0);
  for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; K.panel(5, 1.25, ctx.sp('screen'), Math.sin(a) * 3.62, 12, Math.cos(a) * 3.62, a); }
} });
defProp({ id: 'podium', name: 'Podium', cat: PIT, sp: true, r: 3, build: (K, ctx) => {
  K.box(10, 0.3, 6, C.dark, 0, 0, 0);
  [[0, 1.6], [-2.6, 1.1], [2.6, 0.8]].forEach(([x, h], i) => {
    K.box(2.4, h, 2.2, C.white, x, 0.3, 0);
    K.panel(1, 0.7, pm(0xffffff, { map: facadeTex((g, w, hh) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, hh); g.fillStyle = '#111'; g.font = '800 90px Rajdhani, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), w / 2, hh / 2 + 6); }) }), x, 0.3 + h / 2 - 0.35, 1.11);
  });
  K.box(10, 4, 0.3, C.dark, 0, 0.3, -2.4); K.panel(9.6, 2.4, ctx.sp('wall'), 0, 1.5, -2.24);
} });
defProp({ id: 'start_gantry', name: 'Start Light Gantry', cat: PIT, sp: true, r: 0, build: (K, ctx) => {
  const span = 18;
  for (const s of [-1, 1]) K.box(0.6, 8, 0.6, C.darkSteel, s * span / 2, 0, 0);
  K.box(span + 0.6, 1.6, 0.8, C.dark, 0, 7, 0);
  for (let i = 0; i < 5; i++) for (let r = 0; r < 2; r++) K.cyl(0.24, 0.24, 0.1, r ? C.redLight : pm(0x220707), (i - 2) * 0.9, 7.3 + r * 0.6, 0.45, 14, Math.PI / 2);
  for (const s of [-1, 1]) K.panel(6, 1.4, ctx.sp('wall'), s * 6.2, 7.1, 0.41);
} });
defProp({ id: 'tyre_stack', name: 'Tyre Stack', cat: PIT, r: 0.6, build: (K) => {
  for (let i = 0; i < 5; i++) K.torus(0.42, 0.17, i % 2 ? C.tyre : pm(0xf2f2f2, { r: 0.8 }), 0, 0.17 + i * 0.32, 0, Math.PI / 2, 0, 0, Math.PI * 2, 18);
} });
defProp({ id: 'tyre_wall', name: 'Tyre Wall (8 m)', cat: PIT, r: 0, build: (K) => {
  for (let x = -3.6; x <= 3.6; x += 0.9) for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++)
    K.torus(0.42, 0.17, (i + row) % 2 ? C.tyre : C.red, x, 0.17 + i * 0.32, -row * 0.85, Math.PI / 2, 0, 0, Math.PI * 2, 14);
  K.box(8.4, 1.2, 0.04, pm(0x1e4fa8, { r: 0.8, ds: true }), 0, 0.05, 0.5);
} });
defProp({ id: 'cones', name: 'Traffic Cones (x5)', cat: PIT, r: 0, build: (K) => {
  for (let i = 0; i < 5; i++) { K.box(0.38, 0.04, 0.38, C.orange, i * 1.5 - 3, 0, 0); K.cone(0.16, 0.72, C.orange, i * 1.5 - 3, 0.04, 0, 12); K.cyl(0.1, 0.12, 0.12, C.white, i * 1.5 - 3, 0.38, 0, 12); }
} });
defProp({ id: 'water_barrier', name: 'Water Barriers', cat: PIT, r: 0, build: (K) => {
  for (let i = 0; i < 4; i++) K.side([[-1, 0], [1, 0], [0.9, 0.3], [0.2, 0.9], [-0.2, 0.9], [-0.9, 0.3]], 0.55, i % 2 ? C.white : C.red, i * 2.05 - 3.1, 0, 0);
} });
defProp({ id: 'concrete_block', name: 'Concrete Blocks', cat: PIT, r: 0, build: (K) => {
  for (let i = 0; i < 3; i++) K.side([[-0.35, 0], [0.35, 0], [0.12, 0.25], [0.08, 0.8], [-0.08, 0.8], [-0.12, 0.25]], 3.6, C.concrete, i * 3.7 - 3.7, 0, 0);
} });
defProp({ id: 'marshal_post', name: 'Marshal Post', cat: PIT, r: 1.4, build: (K) => {
  K.box(2.4, 0.2, 2.4, C.concrete, 0, 0, 0);
  K.box(2.2, 2.4, 0.08, pm(0xf2f2f0, { r: 0.6 }), 0, 0.2, -1.1); for (const s of [-1, 1]) K.box(0.08, 2.4, 2.2, pm(0xf2f2f0, { r: 0.6 }), s * 1.1, 0.2, 0);
  K.box(2.6, 0.12, 2.6, C.orange, 0, 2.6, 0);
  K.cyl(0.03, 0.03, 1.4, C.steel, 0.8, 0.2, 0.9, 6); K.panel(0.6, 0.4, C.yellow, 1.1, 1.2, 0.9);
  K.cyl(0.03, 0.03, 1.4, C.steel, -0.8, 0.2, 0.9, 6); K.panel(0.6, 0.4, pm(0x16a34a), -0.5, 1.2, 0.9);
  K.box(0.5, 1.4, 0.35, pm(0xc8102e), 0.6, 0.2, -0.8);
} });
defProp({ id: 'light_tower', name: 'Floodlight Tower', cat: PIT, r: 0.6, build: (K) => {
  K.cyl(0.25, 0.45, 24, C.steel, 0, 0, 0, 10);
  K.box(5, 2.4, 0.4, C.darkSteel, 0, 23, 0.4, 0, -0.25);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) K.box(0.62, 0.6, 0.2, C.lightOn, -2 + c * 0.8, 23.2 + r * 0.75, 0.62, 0, -0.25);
  K.box(0.4, 0.1, 0.4, C.darkSteel, 0, 22.8, 0);
} });
defProp({ id: 'camera_tower', name: 'TV Camera Platform', cat: PIT, r: 1.4, build: (K) => {
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.cyl(0.06, 0.06, 6, C.steel, x, 0, z, 6);
  for (let y = 1.5; y < 6; y += 1.5) { K.rod([-1, y - 1.5, -1], [1, y, -1], 0.03, C.steel); K.rod([1, y - 1.5, 1], [-1, y, 1], 0.03, C.steel); }
  K.box(2.6, 0.15, 2.6, C.wood, 0, 6, 0); K.box(2.6, 1, 0.05, C.steel, 0, 6.15, -1.3);
  K.cyl(0.04, 0.04, 1.3, C.dark, 0, 6.15, 0.3, 6); K.box(0.4, 0.35, 0.8, C.black, 0, 7.45, 0.4); K.cyl(0.14, 0.18, 0.5, C.glass, 0, 7.62, 1.05, 12, Math.PI / 2);
  K.box(2.8, 0.1, 2.8, pm(0x16a34a, { r: 0.8 }), 0, 8.4, 0); for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) K.cyl(0.03, 0.03, 2.2, C.steel, x, 6.15, z, 6);
} });
defProp({ id: 'tv_crane', name: 'TV Crane', cat: PIT, r: 1, build: (K) => {
  K.box(1.6, 0.4, 2.4, C.dark, 0, 0, 0); for (const [x, z] of [[0.7, 1.1], [-0.7, 1.1], [0.7, -1.1], [-0.7, -1.1]]) K.cyl(0.18, 0.18, 0.15, C.tyre, x, 0, z, 10);
  K.cyl(0.2, 0.25, 2.4, C.darkSteel, 0, 0.4, 0, 10);
  K.rod([0, 2.8, -3.5], [0, 5.5, 6], 0.13, C.steel); K.box(0.6, 0.6, 0.8, C.dark, 0, 2.3, -3.6);
  K.box(0.35, 0.3, 0.6, C.black, 0, 5.2, 6.1); K.cyl(0.1, 0.12, 0.4, C.glass, 0, 5.32, 6.55, 10, Math.PI / 2);
} });
defProp({ id: 'footbridge', name: 'Spectator Footbridge', cat: PIT, sp: true, r: 0, build: (K, ctx) => {
  const span = 22;
  for (const s of [-1, 1]) {
    K.box(3, 7, 3, C.concrete, s * (span / 2 + 1.5), 0, 0);
    for (let i = 0; i < 12; i++) K.box(3, 0.25, 0.6, C.concrete, s * (span / 2 + 3 + i * 0.6), 6.75 - i * 0.58, 0);
  }
  K.box(span + 6, 0.6, 3, C.concrete, 0, 6.4, 0);
  for (const s of [-1, 1]) {
    K.box(span, 1.6, 0.25, C.dark, 0, 7, s * 1.45);
    K.panel(span - 0.4, 1.4, ctx.sp('wall'), 0, 7.1, s * 1.59, s > 0 ? 0 : Math.PI);
    K.box(span + 6, 0.1, 0.1, C.steel, 0, 8.6, s * 1.45);
  }
  K.box(span + 6, 0.1, 3, C.glassLight, 0, 9.6, 0);
} });
defProp({ id: 'timing_tower', name: 'Timing Pylon', cat: PIT, sp: true, r: 1, build: (K, ctx) => {
  K.box(2.6, 12, 1, C.dark, 0, 0, 0);
  K.panel(2.3, 7.5, pm(0xffffff, { map: FT.timing, e: 0xffffff, emap: FT.timing, ei: 0.7 }), 0, 3.6, 0.51);
  K.box(2.8, 1.4, 1.2, C.darkSteel, 0, 12, 0); K.panel(2.6, 0.65, ctx.sp('screen'), 0, 12.36, 0.61);
  K.panel(2.3, 0.6, ctx.sp('wall'), 0, 1.6, 0.51);
} });
defProp({ id: 'fence_panel', name: 'Catch Fence (10 m)', cat: PIT, r: 0, build: (K) => {
  K.box(10, 4, 0.05, pm(0xc0c4ca, { map: TEX.fence, t: true, at: 0.25, ds: true, m: 0.4 }), 0, 0, 0);
  for (let x = -5; x <= 5; x += 2.5) K.cyl(0.07, 0.07, 4.4, C.steel, x, 0, -0.1, 8);
  K.rod([-5, 4.4, -0.1], [5, 4.4, -0.1], 0.03, C.steel);
} });

defProp({ id: 'pit_wall_low', name: 'Pit Wall (low, sponsor)', cat: PIT, sp: true, r: 0, build: (K, ctx) => {
  K.box(20, 1.1, 0.6, C.concrete, 0, 0, 0); K.box(20.2, 0.12, 0.8, C.capping ?? C.grey, 0, 1.1, 0);
  for (const s of [-1, 1]) K.panel(19.6, 0.9, ctx.sp('wall'), 0, 0.1, s * 0.31, s > 0 ? 0 : Math.PI);
} });
defProp({ id: 'pit_wall_glass', name: 'Pit Wall (glass + roof)', cat: PIT, sp: true, r: 0, build: (K, ctx) => {
  const L = 24;
  K.box(L, 1.2, 0.5, C.concrete, 0, 0, 0); K.panel(L - 0.2, 1, ctx.sp('wall'), 0, 0.1, 0.26);
  K.box(L, 2.4, 0.06, C.glassLight, 0, 1.2, 0);
  for (let x = -L / 2; x <= L / 2; x += 4) { K.box(0.12, 4.4, 0.12, C.steel, x, 0, -0.3); K.box(0.12, 0.12, 3.6, C.steel, x, 4.3, -1.8); }
  K.box(L + 0.4, 0.15, 4, pm(0xf2f2f0, { r: 0.4 }), 0, 4.4, -1.8);
  K.box(L, 0.7, 0.15, C.dark, 0, 3.7, 0.0); K.panel(L - 0.4, 0.6, ctx.sp('screen'), 0, 3.75, 0.08);
  for (let x = -L / 2 + 2; x < L / 2; x += 4) for (const sx of [-0.8, 0.8]) { K.cyl(0.25, 0.25, 0.08, C.dark, x + sx, 0.85, -1.6, 10); K.cyl(0.04, 0.04, 0.85, C.steel, x + sx, 0, -1.6, 6); }
} });
defProp({ id: 'pit_lane_entry', name: 'Pit Entry Board + Bollards', cat: PIT, sp: true, r: 0, build: (K, ctx) => {
  K.box(0.3, 3.2, 0.3, C.darkSteel, -2.2, 0, 0); K.box(0.3, 3.2, 0.3, C.darkSteel, 2.2, 0, 0);
  K.box(4.8, 1.4, 0.2, C.dark, 0, 3.0, 0); K.panel(4.6, 1.2, ctx.sp('wall'), 0, 3.1, 0.11);
  K.box(4.8, 0.7, 0.2, pm(0xffffff, { map: facadeTex((g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = '800 34px Rajdhani, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PIT  80', w / 2, h / 2 + 2); }, 128, 32) }), 0, 2.2, 0);
  for (let i = 0; i < 6; i++) { K.cyl(0.12, 0.12, 0.9, i % 2 ? C.white : C.red, -6 + i * 1.6, 0, 2, 10); }
} });
defProp({ id: 'stand_tower', name: 'Tower Grandstand', cat: STAND, sp: true, r: 0, build: (K, ctx) => {
  const L = 18, t = tiers(K, L, 24, 0.75, 0.75, 2);
  K.box(L, t.top + 4, 0.6, C.concrete, 0, 0, -t.depth - 0.3);
  for (const s of [-1, 1]) K.side([[1, 0], [1, 2], [-t.depth, t.top + 2], [-t.depth, 0]], 0.5, C.concrete, s * (L / 2 + 0.25), 0, 0);
  K.box(L + 2, 0.4, t.depth + 4, C.white, 0, t.top + 4, -t.depth / 2 + 1);
  K.box(L + 2, 1.6, 0.3, C.dark, 0, t.top + 3.2, 3.1); K.panel(L, 1.4, ctx.sp('wall'), 0, t.top + 3.3, 3.27);
} });
defProp({ id: 'stand_modern', name: 'Modern Canopy Grandstand', cat: STAND, sp: true, r: 0, build: (K, ctx) => {
  const L = 60, t = tiers(K, L, 16, 0.85, 0.52, 1.4, 0, pm(0xffffff, { map: FT.seats, r: 0.6 }));
  K.box(L, t.top + 2, 0.6, pm(0x2a2d33), 0, 0, -t.depth - 0.3);
  // Sweeping membrane canopy on raked masts.
  for (let x = -L / 2; x <= L / 2; x += 12) { K.rod([x, 0, -t.depth - 2], [x, t.top + 14, -t.depth + 2], 0.35, C.white); K.rod([x, t.top + 14, -t.depth + 2], [x, t.top + 6, 8], 0.08, C.steel); K.rod([x, t.top + 14, -t.depth + 2], [x, t.top + 7, -t.depth - 4], 0.08, C.steel); }
  K.box(L + 4, 0.25, t.depth + 12, pm(0xf6f6f2, { r: 0.6, ds: true }), 0, t.top + 7, -t.depth / 2 + 2, 0, -0.08);
  K.box(L + 4, 2, 0.3, C.dark, 0, t.top + 5.6, 8.1); K.panel(L, 1.8, ctx.sp('wall'), 0, t.top + 5.7, 8.27);
} });

// ---------- buildings ----------
const BLD = 'Buildings';
const wallM = (t, c = 0xffffff, o = {}) => pm(c, { map: t, r: 0.8, ...o });
defProp({ id: 'house_small', name: 'Small House', cat: BLD, r: 4.5, build: (K) => {
  K.tower(8, 3.2, 7, wallM(FT.house), 3, 3.2, 0, 0, 0);
  K.gable(8, 7, 2.8, pm(0xffffff, { map: FT.roofTile, r: 0.85 }), 0, 3.2, 0);
  K.box(1.0, 2.1, 0.1, C.darkWood, 0, 0, 3.52); K.box(0.6, 1.6, 0.6, pm(0x8e4a35), 2.6, 4.4, -1.2);
  K.box(1.6, 0.15, 1, C.concrete, 0, 0, 4);
} });
defProp({ id: 'cottage', name: 'Cottage', cat: BLD, r: 4, build: (K) => {
  K.tower(7, 3, 6, wallM(FT.brick), 3, 3, 0, 0, 0);
  K.gable(7, 6, 3.4, pm(0xffffff, { map: FT.roofSlate, r: 0.8 }), 0, 3, 0, 0, 0.4);
  K.box(0.7, 2.4, 0.7, wallM(FT.brick), -2.6, 4.4, -0.8); K.box(0.9, 0.2, 0.9, C.concrete, -2.6, 6.8, -0.8);
  K.box(1.0, 2.0, 0.1, pm(0x2e7d32), 0.8, 0, 3.02);
  for (let x = -3.5; x <= 3.5; x += 0.6) K.box(0.08, 0.9, 0.06, C.white, x, 0, 5);
  K.box(7.2, 0.08, 0.06, C.white, 0, 0.75, 5);
} });
defProp({ id: 'house_modern', name: 'Modern House', cat: BLD, r: 6, build: (K) => {
  K.box(12, 3.2, 8, C.white, 0, 0, 0); K.box(12.4, 0.3, 8.4, C.dark, 0, 3.2, 0);
  K.box(8, 3, 6, C.white, -1.5, 3.5, -0.6); K.box(8.4, 0.3, 6.4, C.dark, -1.5, 6.5, -0.6);
  K.box(10, 2.6, 0.06, C.glass, 0.6, 0.3, 4.01); K.box(6, 2.4, 0.06, C.glass, -2.5, 3.8, 2.41);
  K.box(3, 3.2, 0.5, pm(0x8a6a4a, { r: 0.7 }), 4.5, 3.5, 2.2);
  K.box(6, 0.1, 4, C.water, 2, 0, 7); K.box(6.6, 0.14, 4.6, C.concrete, 2, 0, 7);
} });
defProp({ id: 'villa', name: 'Villa', cat: BLD, r: 8, build: (K) => {
  K.tower(16, 3.6, 10, wallM(FT.house, 0xf6e6c8), 3, 3.6, 0, 0, 0);
  K.tower(16, 3.4, 10, wallM(FT.house, 0xf6e6c8), 3, 3.4, 0, 3.6, 0);
  K.gable(16, 10, 3.2, pm(0xffffff, { map: FT.roofTile, r: 0.85 }), 0, 7, 0);
  for (let x = -6; x <= 6; x += 3) K.cyl(0.3, 0.3, 3.6, C.white, x, 0, 5.8, 12);
  K.box(16, 0.3, 2, C.white, 0, 3.6, 5.8);
  K.box(2, 2.6, 0.1, C.darkWood, 0, 0, 5.02);
} });
defProp({ id: 'barn', name: 'Barn', cat: BLD, r: 7, build: (K) => {
  const red = pm(0x9e2a22, { r: 0.85 });
  K.box(10, 5, 14, red, 0, 0, 0);
  K.gable(14, 10, 4.5, C.dark, 0, 5, 0, Math.PI / 2, 0.5);
  K.box(4, 4.2, 0.1, C.white, 0, 0, 7.02); K.box(3.6, 3.8, 0.12, red, 0, 0.2, 7.04);
  K.rod([-1.8, 0.2, 7.1], [1.8, 4.0, 7.1], 0.08, C.white); K.rod([1.8, 0.2, 7.1], [-1.8, 4.0, 7.1], 0.08, C.white);
  K.box(1.4, 1.2, 0.1, C.white, 0, 6.6, 7.02);
} });
defProp({ id: 'farm_silo', name: 'Farmhouse + Silo', cat: BLD, r: 7, build: (K) => {
  K.tower(9, 3, 7, wallM(FT.house, 0xe9ddc6), 3, 3, -2, 0, 0);
  K.gable(9, 7, 2.6, pm(0xffffff, { map: FT.roofSlate }), -2, 3, 0);
  K.cyl(2.2, 2.2, 12, pm(0xc9c9c4, { map: FT.metal, r: 0.5, m: 0.5 }), 5.5, 0, -1, 20);
  K.sph(2.2, C.steel, 5.5, 12, -1, 1, 0.6, 1, 16);
  K.box(8, 2.4, 5, C.wood, 0, 0, -7.5); K.gable(8, 5, 1.4, C.dark, 0, 2.4, -7.5);
} });
defProp({ id: 'garage_shed', name: 'Garage Shed', cat: BLD, r: 3.5, build: (K) => {
  K.tower(6, 3, 7, wallM(FT.metal, 0xc4c8cc), 3, 3, 0, 0, 0);
  K.box(6.3, 0.2, 7.3, C.darkSteel, 0, 3, 0, 0, -0.05);
  K.box(4, 2.6, 0.08, pm(0xffffff, { map: FT.metal }), 0, 0, 3.52);
} });
defProp({ id: 'shop', name: 'Corner Shop', cat: BLD, sp: true, r: 5.5, build: (K, ctx) => {
  K.tower(10, 4.2, 8, wallM(FT.shop), 3.2, 4.2, 0, 0, 0);
  K.tower(10, 3.2, 8, wallM(FT.resi), 3.2, 3.2, 0, 4.2, 0);
  K.box(10.4, 0.4, 8.4, C.dark, 0, 7.4, 0);
  K.box(10, 0.9, 0.2, C.dark, 0, 3.4, 4.1); K.panel(9.6, 0.8, ctx.sp('wall'), 0, 3.45, 4.21);
  K.box(10, 0.1, 1.6, C.canvasRed, 0, 3.1, 4.8, 0, 0.25);
} });
defProp({ id: 'cafe', name: 'Café', cat: BLD, sp: true, r: 5, build: (K, ctx) => {
  K.tower(9, 3.6, 7, wallM(FT.shop, 0xf2e4c4), 3, 3.6, 0, 0, 0);
  K.box(9.4, 0.3, 7.4, C.darkWood, 0, 3.6, 0);
  K.box(9, 0.8, 0.15, C.dark, 0, 2.8, 3.6); K.panel(8.6, 0.7, ctx.sp('wall'), 0, 2.85, 3.69);
  for (let x = -3; x <= 3; x += 3) {
    K.cyl(0.4, 0.4, 0.05, C.white, x, 0.75, 5.4, 12); K.cyl(0.04, 0.04, 0.75, C.steel, x, 0, 5.4, 6);
    K.cyl(0.03, 0.03, 2.3, C.steel, x, 0, 5.4, 6); K.cone(1.4, 0.6, x === 0 ? C.canvasRed : C.fabric, x, 2.2, 5.4, 10);
  }
} });
defProp({ id: 'gas_station', name: 'Gas Station', cat: BLD, sp: true, r: 0, build: (K, ctx) => {
  K.box(16, 0.6, 10, C.white, 0, 5, 3);
  K.box(16.2, 0.8, 0.2, C.dark, 0, 4.9, 8.1); K.panel(15.6, 0.7, ctx.sp('wall'), 0, 4.95, 8.21);
  for (const x of [-4, 4]) { K.box(0.5, 5, 0.5, C.white, x, 0, 3); K.box(1.2, 0.2, 3, C.concrete, x, 0, 3); for (const z of [2, 4]) { K.box(0.8, 1.6, 0.5, C.red, x, 0.2, z); K.box(0.6, 0.4, 0.02, C.glass, x, 1.2, z + 0.26); } }
  K.tower(12, 3.6, 6, wallM(FT.shop), 3, 3.6, 0, 0, -6);
  K.box(12.4, 0.3, 6.4, C.dark, 0, 3.6, -6);
  K.box(1.2, 7, 0.4, C.dark, 9.5, 0, 6); K.box(2.6, 2, 0.5, C.dark, 9.5, 6.4, 6); K.panel(2.4, 0.6, ctx.sp('wall'), 9.5, 7.6, 6.26);
} });
defProp({ id: 'warehouse', name: 'Warehouse', cat: BLD, sp: true, r: 0, build: (K, ctx) => {
  K.tower(30, 9, 20, wallM(FT.metal, 0xd6d9dc), 4, 9, 0, 0, 0);
  K.gable(30, 20, 3, pm(0xa8adb2, { map: FT.metal, r: 0.5, m: 0.4 }), 0, 9, 0, 0, 0.4);
  for (const x of [-9, 0, 9]) K.box(6, 6, 0.1, pm(0xffffff, { map: FT.metalBlue }), x, 0, 10.02);
  K.box(14, 1.6, 0.2, C.dark, 0, 7, 10.1); K.panel(13.6, 1.4, ctx.sp('wall'), 0, 7.1, 10.21);
} });
defProp({ id: 'factory', name: 'Factory', cat: BLD, r: 0, build: (K) => {
  K.tower(26, 10, 18, wallM(FT.brick), 4, 4, 0, 0, 0);
  for (let i = 0; i < 4; i++) K.side([[-2.25, 0], [2.25, 0], [2.25, 0.4], [-2.25, 3]], 18, C.dark, -9.75 + i * 6.5, 10, 0);
  K.cyl(1.2, 1.6, 26, wallM(FT.brick), 9, 0, -6, 16); K.cyl(1.25, 1.25, 1, C.dark, 9, 25, -6, 16);
  K.cyl(1, 1, 6, C.steel, -9, 0, 11, 16); K.cyl(1, 1, 6, C.steel, -6.5, 0, 11, 16);
  K.rod([-9, 5.5, 11], [-9, 10.5, 8.5], 0.25, C.steel);
} });
defProp({ id: 'hotel', name: 'Hotel', cat: BLD, sp: true, r: 0, build: (K, ctx) => {
  K.tower(30, 4.5, 16, wallM(FT.shop), 3, 4.5, 0, 0, 0);
  K.tower(28, 24, 14, wallM(FT.resi), 3, 3.4, 0, 4.5, 0);
  K.box(28.6, 0.6, 14.6, C.dark, 0, 28.5, 0);
  K.box(14, 2.4, 0.4, C.dark, 0, 29.1, 0); K.panel(13.6, 2.0, ctx.sp('screen'), 0, 29.3, 0.21);
  K.box(12, 0.3, 5, C.white, 0, 4.2, 10.5); for (const x of [-5.5, 5.5]) K.cyl(0.25, 0.25, 4.2, C.chrome, x, 0, 12.6, 10);
} });
defProp({ id: 'apartments', name: 'Apartment Block', cat: BLD, r: 0, build: (K) => {
  K.tower(24, 18, 12, wallM(FT.resi, 0xf0e6d6), 3, 3, 0, 0, 0);
  K.box(24.4, 0.4, 12.4, C.grey, 0, 18, 0);
  for (const x of [-7, 0, 7]) { K.box(2.4, 2, 2.4, C.grey, x, 18.4, -2); K.box(1.2, 1.2, 1.2, C.steel, x + 3, 18.4, 2); }
  K.box(4, 3, 0.2, C.glass, 0, 0, 6.05);
} });
defProp({ id: 'church', name: 'Church', cat: BLD, r: 0, build: (K) => {
  const stone = pm(0xcfc6b5, { r: 0.9 });
  K.box(10, 8, 20, stone, 0, 0, -4); K.gable(20, 10, 5, C.dark, 0, 8, -4, Math.PI / 2, 0.4);
  K.box(5, 18, 5, stone, 0, 0, 8); K.cone(3.6, 12, C.dark, 0, 18, 8, 4).rotation.y = Math.PI / 4;
  K.cyl(0.05, 0.05, 2, C.chrome, 0, 30, 8, 6); K.box(1, 0.1, 0.1, C.chrome, 0, 31.3, 8);
  K.cyl(1.4, 1.4, 0.2, C.white, 0, 14, 10.55, 20, Math.PI / 2);
  for (let z = -12; z <= 4; z += 4) for (const s of [-1, 1]) K.box(0.06, 3.6, 1.4, pm(0x3a5c8a, { r: 0.2, m: 0.5 }), s * 5.01, 2.4, z);
} });
defProp({ id: 'hangar', name: 'Hangar', cat: BLD, sp: true, r: 0, build: (K, ctx) => {
  K.cyl(16, 16, 36, pm(0xb8bdc2, { map: FT.metal, r: 0.5, m: 0.5 }), 0, -18, 0, 32, Math.PI / 2);   // half-buried: an arched roof
  K.box(28, 9, 0.2, pm(0xffffff, { map: FT.metalBlue }), 0, 0, 18.02);
  K.box(20, 2, 0.3, C.dark, 0, 9.2, 18.1); K.panel(19.6, 1.8, ctx.sp('wall'), 0, 9.3, 18.26);
} });
defProp({ id: 'water_tower', name: 'Water Tower', cat: BLD, sp: true, r: 3, build: (K, ctx) => {
  for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2 + Math.PI / 4; K.rod([Math.cos(a) * 3.4, 0, Math.sin(a) * 3.4], [Math.cos(a) * 2, 16, Math.sin(a) * 2], 0.18, C.steel); }
  for (let y = 4; y < 16; y += 4) K.torus(3.4 - y * 0.085, 0.06, C.steel, 0, y, 0, Math.PI / 2);
  K.cyl(4.6, 4.6, 5, pm(0xdfe3e7, { r: 0.4, m: 0.6 }), 0, 16, 0, 24); K.cone(4.8, 2.4, C.steel, 0, 21, 0, 24); K.sph(4.6, C.steel, 0, 16, 0, 1, 0.4, 1, 20);
  for (let i = 0; i < 2; i++) { const a = i * Math.PI; K.panel(6.4, 1.6, ctx.sp('wall'), Math.sin(a) * 4.62, 17.6, Math.cos(a) * 4.62, a); }
} });

// ---------- skyscrapers ----------
const SKY = 'Skyscrapers';
defProp({ id: 'tower_glass', name: 'Glass Tower', cat: SKY, sp: true, r: 0, build: (K, ctx) => {
  K.tower(30, 120, 30, pm(0xffffff, { map: FT.glass, r: 0.12, m: 0.7 }), 3, 4, 0, 0, 0, 0, C.dark);
  K.box(32, 6, 32, C.dark, 0, 0, 0); K.box(26, 4, 26, C.darkSteel, 0, 120, 0);
  K.cyl(0.4, 0.6, 20, C.steel, 0, 124, 0, 8); K.sph(0.6, C.redLight, 0, 144, 0);
  for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; K.panel(20, 5, ctx.sp('screen'), Math.sin(a) * 15.1, 112, Math.cos(a) * 15.1, a); }
} });
defProp({ id: 'tower_stepped', name: 'Stepped Tower', cat: SKY, r: 0, build: (K) => {
  const m = pm(0xffffff, { map: FT.office, r: 0.5 });
  [[36, 40], [30, 35], [24, 30], [18, 24], [12, 16]].reduce((y, [w, h]) => { K.tower(w, h, w, m, 3, 3.5, 0, y, 0, 0, C.grey); K.box(w + 1, 1, w + 1, C.grey, 0, y + h, 0); return y + h + 1; }, 0);
  K.cyl(0.3, 0.5, 14, C.steel, 0, 150, 0, 8);
} });
defProp({ id: 'tower_twist', name: 'Twisting Tower', cat: SKY, r: 0, build: (K) => {
  const m = pm(0xffffff, { map: FT.glassGreen, r: 0.15, m: 0.6 });
  for (let i = 0; i < 40; i++) K.tower(22 - i * 0.12, 3.6, 22 - i * 0.12, m, 3, 3.6, 0, i * 3.6, 0, i * 0.035, C.dark);
  K.box(18, 2, 18, C.dark, 0, 144, 0, 40 * 0.035);
} });
defProp({ id: 'tower_cylinder', name: 'Cylinder Tower', cat: SKY, r: 0, build: (K) => {
  const m = pm(0xffffff, { map: FT.glass, r: 0.15, m: 0.6 });
  const g = new THREE.CylinderGeometry(14, 15, 110, 32, 1, true);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 30, uv.getY(i) * 30);
  const mesh = new THREE.Mesh(g, m); mesh.position.y = 55; K.group.add(mesh);
  K.cyl(14, 14, 0.5, C.dark, 0, 110, 0, 32);
  for (let y = 0; y < 110; y += 11) K.torus(14.6 - y * 0.009, 0.25, C.white, 0, y, 0, Math.PI / 2, 0, 0, Math.PI * 2, 40);
  K.cyl(6, 8, 6, C.darkSteel, 0, 110, 0, 20); K.cyl(0.3, 0.4, 25, C.steel, 0, 116, 0, 8);
} });
defProp({ id: 'tower_deco', name: 'Art Deco Spire', cat: SKY, r: 0, build: (K) => {
  const m = pm(0xffffff, { map: FT.deco, r: 0.6 });
  K.tower(30, 60, 26, m, 3, 4, 0, 0, 0, 0, C.grey);
  K.tower(22, 40, 20, m, 3, 4, 0, 60, 0, 0, C.grey);
  K.tower(14, 24, 13, m, 3, 4, 0, 100, 0, 0, C.grey);
  for (let i = 0; i < 6; i++) K.cyl(6 - i, 7 - i, 3, pm(0xd8d4cc, { r: 0.3, m: 0.6 }), 0, 124 + i * 3, 0, 8);
  K.cone(1, 22, C.chrome, 0, 142, 0, 8);
  for (const [x, z] of [[11, 10], [-11, 10], [11, -10], [-11, -10]]) K.cone(1.2, 5, pm(0xd8d4cc, { m: 0.6, r: 0.3 }), x, 100, z, 4);
} });
defProp({ id: 'tower_twin', name: 'Twin Towers + Skybridge', cat: SKY, r: 0, build: (K) => {
  const m = pm(0xffffff, { map: FT.glass, r: 0.15, m: 0.7 });
  for (const x of [-16, 16]) { K.tower(20, 130, 20, m, 3, 4, x, 0, 0, 0, C.dark); K.cyl(5, 8, 12, C.steel, x, 130, 0, 8); K.cone(1, 25, C.chrome, x, 142, 0, 8); }
  K.box(12, 5, 6, C.dark, 0, 70, 0); K.box(12.2, 3, 6.2, C.glass, 0, 71, 0);
} });
defProp({ id: 'office_mid', name: 'Mid-Rise Offices', cat: SKY, sp: true, r: 0, build: (K, ctx) => {
  K.tower(36, 42, 22, pm(0xffffff, { map: FT.office, r: 0.5 }), 3, 3.5, 0, 0, 0, 0, C.grey);
  K.box(36.6, 1, 22.6, C.grey, 0, 42, 0);
  K.box(8, 4, 8, C.darkSteel, 6, 43, 0); for (let x = -12; x <= -4; x += 4) K.cyl(1.2, 1.2, 3, C.steel, x, 43, 4, 12);
  K.box(18, 3.4, 0.4, C.dark, 0, 38, 11.2); K.panel(17.6, 3.0, ctx.sp('wall'), 0, 38.2, 11.41);
} });
defProp({ id: 'resi_high', name: 'Residential High-Rise', cat: SKY, r: 0, build: (K) => {
  K.tower(22, 84, 18, pm(0xffffff, { map: FT.resi, r: 0.7 }), 3, 3, 0, 0, 0, 0, C.grey);
  for (let y = 3; y < 84; y += 6) K.box(22.8, 0.25, 1.2, C.white, 0, y, 9.4);
  K.box(10, 4, 8, C.grey, 0, 84, 0); K.cyl(0.15, 0.15, 10, C.steel, 4, 88, 2, 6);
} });
defProp({ id: 'needle', name: 'Observation Needle', cat: SKY, sp: true, r: 0, build: (K, ctx) => {
  K.cyl(4, 9, 6, C.concrete, 0, 0, 0, 16);
  K.cyl(2.8, 3.6, 150, pm(0xd8d4cc, { r: 0.6 }), 0, 6, 0, 16);
  K.cyl(13, 8, 6, C.glass, 0, 150, 0, 32); K.cyl(14, 14, 1.2, C.white, 0, 156, 0, 32); K.cyl(8, 13, 3, C.white, 0, 147, 0, 32);
  K.cyl(1, 1.6, 10, C.white, 0, 157, 0, 12); K.cone(0.6, 28, C.steel, 0, 167, 0, 8); K.sph(0.6, C.redLight, 0, 195, 0);
  for (let i = 0; i < 3; i++) { const a = (i * Math.PI * 2) / 3; K.panel(6, 1.5, ctx.sp('screen'), Math.sin(a) * 3.3, 60, Math.cos(a) * 3.3, a); }
} });
defProp({ id: 'sail_hotel', name: 'Sail Hotel', cat: SKY, r: 0, build: (K) => {
  const pts = [[0, 0], [30, 0], [30, 4], [24, 60], [14, 120], [0, 150]];
  K.side(pts, 18, pm(0xffffff, { map: FT.resi, r: 0.5 }), 0, 0, -15);
  K.side([[30, 0], [36, 0], [36, 2], [26, 70], [14, 130], [10, 130], [22, 70], [30, 4]], 6, C.white, 0, 0, -15);
  K.cyl(8, 8, 1.6, C.white, 0, 90, 18, 24); K.cyl(1.2, 1.2, 12, C.steel, 0, 150, -15, 8);
} });
defProp({ id: 'tower_crown', name: 'Crown Tower', cat: SKY, sp: true, r: 0, build: (K, ctx) => {
  K.tower(28, 100, 28, pm(0xffffff, { map: FT.dark, r: 0.3, m: 0.4 }), 3, 4, 0, 0, 0, 0, C.dark);
  for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; K.box(28, 14, 0.6, C.darkSteel, Math.sin(a) * 14, 100, Math.cos(a) * 14, a); K.panel(26, 6.5, ctx.sp('screen'), Math.sin(a) * 14.31, 104, Math.cos(a) * 14.31, a); }
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; K.cone(1.4, 10, C.chrome, Math.sin(a) * 12, 114, Math.cos(a) * 12, 6); }
} });
defProp({ id: 'tower_dark', name: 'Black Monolith', cat: SKY, r: 0, build: (K) => {
  K.tower(26, 140, 18, pm(0xffffff, { map: FT.dark, r: 0.2, m: 0.6 }), 3, 4, 0, 0, 0, 0, C.black);
  K.side([[-9, 0], [9, 0], [9, 8], [-9, 18]], 26, C.black, 0, 140, 0);
  for (let y = 20; y < 140; y += 30) K.box(26.4, 2, 18.4, C.darkSteel, 0, y, 0);
} });

// ---------- landmarks ----------
const LND = 'Landmarks & Misc';
defProp({ id: 'wind_turbine', name: 'Wind Turbine', cat: LND, r: 2, build: (K) => {
  K.cyl(1.2, 2.2, 70, C.white, 0, 0, 0, 16);
  K.box(2.4, 2.6, 7, C.white, 0, 70, 0.5); K.sph(1.3, C.white, 0, 71.3, 4.4, 1, 1, 1.3);
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3, blade = new THREE.Group(), bk = kit(blade);
    bk.box(0.3, 34, 1.6, C.white, 0, 0, 0);
    bk.box(0.25, 6, 2.2, C.white, 0, 0, 0);
    blade.position.set(0, 71.3, 5.3); blade.rotation.z = a;
    K.group.add(blade);
  }
} });
defProp({ id: 'ferris_wheel', name: 'Ferris Wheel', cat: LND, r: 6, build: (K) => {
  const R = 28;
  for (const s of [-1, 1]) {
    K.rod([s * 3, 0, -10], [s * 2, R + 4, 0], 0.5, C.white); K.rod([s * 3, 0, 10], [s * 2, R + 4, 0], 0.5, C.white);
    K.torus(R, 0.35, C.white, s * 1.8, R + 4, 0, 0, Math.PI / 2, 0, Math.PI * 2, 48);
  }
  K.rod([-2.4, R + 4, 0], [2.4, R + 4, 0], 1.2, C.steel, 16);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, y = R + 4 + Math.sin(a) * R, z = Math.cos(a) * R;
    for (const s of [-1, 1]) K.rod([s * 1.8, R + 4, 0], [s * 1.8, y, z], 0.1, C.white);
    K.box(2.4, 2.6, 2.2, [C.red, C.yellow, C.blue, pm(0x16a34a)][i % 4], 0, y - 3.2, z);
    K.box(2.5, 0.3, 2.3, C.white, 0, y - 0.6, z);
  }
  K.box(14, 1, 24, C.concrete, 0, 0, 0);
} });
defProp({ id: 'balloon', name: 'Hot Air Balloon', cat: LND, sp: true, r: 0, build: (K, ctx) => {
  const y0 = 30;
  K.lathe([[0.01, 0], [3, 1], [8, 6], [10.5, 12], [10, 17], [7, 21], [0.01, 22.5]], pm(0xffffff, { r: 0.8, ds: true, map: facadeTex((g, w, h) => {
    const cols = ['#e10600', '#ffd200', '#1e4fa8', '#ffffff', '#ff6a00', '#16a34a'];
    for (let i = 0; i < 12; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect((i * w) / 12, 0, w / 12 + 1, h); }
  }) }), 0, y0, 0, 24);
  K.panel(9, 2.2, ctx.sp('banner'), 0, y0 + 9, 9.4, 0);
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) K.rod([x * 0.8, y0 - 6.5, z * 0.8], [x * 2.4, y0 + 0.8, z * 2.4], 0.04, C.dark);
  K.box(1.8, 1.2, 1.8, pm(0x8a6a3a, { r: 0.9 }), 0, y0 - 7.6, 0);
  K.cyl(0.4, 0.5, 0.6, C.darkSteel, 0, y0 - 6.2, 0, 10);
} });
defProp({ id: 'blimp', name: 'Sponsor Blimp', cat: LND, sp: true, r: 0, build: (K, ctx) => {
  const y = 60;
  K.sph(6, pm(0xf2f2f0, { r: 0.5 }), 0, y, 0, 1, 1, 4.5, 28);
  for (const s of [-1, 1]) K.panel(30, 7.5, ctx.sp('wall'), s * 6.0, y - 3.75, -1, s * Math.PI / 2).scale.set(1, 1, 1);
  K.box(2.6, 2, 7, C.dark, 0, y - 7.6, 4); K.box(2.7, 0.8, 6.8, C.glass, 0, y - 6.8, 4);
  for (const [rx, rz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) K.side([[0, 0], [5, 0], [5, 0.2], [0, 4]], 0.3, C.dark, rx * 3.5, y + rz * 3.5, -24).rotation.z = Math.atan2(rz, rx) - Math.PI / 2;
} });
defProp({ id: 'lighthouse', name: 'Lighthouse', cat: LND, r: 3.5, build: (K) => {
  for (let i = 0; i < 6; i++) K.cyl(3.4 - i * 0.3, 3.6 - i * 0.3, 5, i % 2 ? C.red : C.white, 0, i * 5, 0, 20);
  K.cyl(2.6, 2.6, 0.5, C.dark, 0, 30, 0, 20); K.cyl(1.7, 1.7, 3, C.glassLight, 0, 30.5, 0, 16); K.sph(0.8, C.lightOn, 0, 32, 0);
  K.cone(2, 2.4, C.red, 0, 33.5, 0, 16); K.torus(2.6, 0.06, C.steel, 0, 31.4, 0, Math.PI / 2);
  K.box(6, 3.2, 5, C.white, 5, 0, 0); K.gable(6, 5, 1.8, C.red, 5, 3.2, 0);
} });
defProp({ id: 'radio_mast', name: 'Radio Mast', cat: LND, r: 2, build: (K) => {
  const H = 90;
  for (let i = 0; i < 3; i++) { const a = (i * Math.PI * 2) / 3; K.rod([Math.cos(a) * 2, 0, Math.sin(a) * 2], [Math.cos(a) * 0.6, H, Math.sin(a) * 0.6], 0.15, i % 2 ? C.red : C.white); }
  for (let y = 0; y < H; y += 6) { const r2 = 2 - (y / H) * 1.4; K.torus(r2, 0.06, y % 12 ? C.red : C.white, 0, y, 0, Math.PI / 2, 0, 0, Math.PI * 2, 6); }
  for (let y = 30; y < H; y += 30) K.sph(0.4, C.redLight, 0, y, 0);
  for (let i = 0; i < 3; i++) { const a = (i * Math.PI * 2) / 3; K.box(0.8, 2.4, 0.6, C.white, Math.cos(a) * 1.2, 70, Math.sin(a) * 1.2, -a); }
} });
defProp({ id: 'windmill', name: 'Dutch Windmill', cat: LND, r: 4, build: (K) => {
  K.cyl(2.6, 4.2, 12, pm(0x7a5a3a, { r: 0.9 }), 0, 0, 0, 8); K.cone(3.2, 4, C.dark, 0, 12, 0, 8);
  K.torus(4.3, 0.15, C.wood, 0, 5, 0, Math.PI / 2, 0, 0, Math.PI * 2, 8);
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Group(), sk = kit(s);
    sk.box(0.25, 11, 0.25, C.darkWood, 0, 0, 0); sk.box(1.6, 9, 0.05, pm(0xe9e2d0, { r: 0.9, ds: true }), 0.9, 2, 0);
    s.position.set(0, 13, 3.4); s.rotation.z = (i * Math.PI) / 2 + 0.3; K.group.add(s);
  }
  K.box(1.4, 2.2, 0.1, C.darkWood, 0, 0, 4.0);
} });
defProp({ id: 'fountain', name: 'Fountain', cat: LND, r: 4, build: (K) => {
  K.cyl(4.2, 4.4, 0.7, C.concrete, 0, 0, 0, 28); K.cyl(3.9, 3.9, 0.72, C.water, 0, 0, 0, 28);
  K.cyl(0.4, 0.6, 2.2, C.concrete, 0, 0.7, 0, 12); K.cyl(1.6, 1.2, 0.4, C.concrete, 0, 2.9, 0, 18); K.cyl(1.4, 1.4, 0.41, C.water, 0, 2.9, 0, 18);
  K.cyl(0.15, 0.3, 1.2, pm(0xbfe6ff, { t: true, op: 0.6 }), 0, 3.3, 0, 10);
} });
defProp({ id: 'trophy', name: 'Giant Trophy Statue', cat: LND, r: 2.5, build: (K) => {
  K.box(5, 2, 5, C.dark, 0, 0, 0);
  const gold = pm(0xd4a640, { r: 0.2, m: 1 });
  K.lathe([[0.01, 0], [1.4, 0], [1.4, 0.6], [0.5, 1.0], [0.35, 3.5], [0.9, 4.2], [2.2, 6.6], [2.4, 8.6], [0.01, 8.6]], gold, 0, 2, 0, 28);
  for (const s of [-1, 1]) K.torus(1.2, 0.18, gold, s * 2.4, 9, 0, 0, Math.PI / 2, 0, Math.PI, 16);
} });
defProp({ id: 'crane', name: 'Construction Crane', cat: LND, r: 2, build: (K) => {
  K.box(3, 1.4, 3, C.concrete, 0, 0, 0);
  for (let i = 0; i < 4; i++) { const [x, z] = [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]][i]; K.cyl(0.1, 0.1, 60, C.yellow, x, 1.4, z, 6); }
  for (let h = 3; h < 60; h += 3) { K.rod([-0.9, h - 1.5, 0.9], [0.9, h + 1.5, 0.9], 0.05, C.yellow); K.rod([0.9, h - 1.5, -0.9], [-0.9, h + 1.5, -0.9], 0.05, C.yellow); }
  K.box(2.4, 2.4, 2.4, C.yellow, 0, 61.4, 0); K.box(2, 1.8, 2, C.glassLight, 1.6, 61.6, 0);
  K.box(1.4, 1.4, 50, C.yellow, 0, 63.8, 14); K.box(1.6, 1.6, 14, C.yellow, 0, 63.6, -10); K.box(2.6, 2.6, 4, C.concrete, 0, 62, -15);
  K.box(0.8, 6, 0.8, C.yellow, 0, 65.2, 0); K.rod([0, 71, 0], [0, 65, 38], 0.05, C.steel); K.rod([0, 71, 0], [0, 65, -16], 0.05, C.steel);
  K.rod([0, 63.8, 30], [0, 40, 30], 0.03, C.dark); K.box(1.2, 0.8, 1.2, C.red, 0, 39.2, 30);
} });
defProp({ id: 'solar_farm', name: 'Solar Panels', cat: LND, r: 0, build: (K) => {
  const m = pm(0xffffff, { map: FT.solar, r: 0.2, m: 0.6 });
  for (let r2 = 0; r2 < 3; r2++) for (let c = 0; c < 4; c++) {
    const x = (c - 1.5) * 4.4, z = (r2 - 1) * 5;
    K.cyl(0.06, 0.06, 1.2, C.steel, x, 0, z, 6);
    K.box(4, 0.06, 2.6, m, x, 1.2, z, 0, -0.45);
  }
} });
defProp({ id: 'containers', name: 'Shipping Containers', cat: LND, sp: true, r: 0, build: (K, ctx) => {
  const cols = [0xc8102e, 0x1e4fa8, 0x2e7d32, 0xff6a00, 0x8a8f96, 0xffcc00];
  const stack = [[0, 0, 0], [0, 2.6, 0], [2.6, 0, 0], [2.6, 2.6, 0], [5.2, 0, 0], [0, 5.2, 0], [1.3, 0, 6.4]];
  stack.forEach(([x, y, z], i) => K.tower(2.44, 2.59, 6.06, pm(cols[i % cols.length], { map: FT.metal, r: 0.6, m: 0.4 }), 2.44, 2.59, x, y, z));
  K.panel(5.8, 1.45, ctx.sp('wall'), 0, 5.75, 3.04);
} });
defProp({ id: 'oil_tanks', name: 'Storage Tanks', cat: LND, r: 0, build: (K) => {
  [[0, 0, 9, 10], [20, 3, 7, 8], [8, 18, 6, 12]].forEach(([x, z, r2, h]) => {
    K.cyl(r2, r2, h, pm(0xe7e7e2, { r: 0.5, m: 0.3 }), x, 0, z, 28); K.cyl(r2 + 0.2, r2, 0.6, C.steel, x, h, z, 28);
    for (let y = 1; y < h; y += 0.8) K.box(0.5, 0.05, 0.3, C.steel, x + r2 + 0.1, y, z);
  });
  K.rod([0, 2, 0], [20, 2, 3], 0.25, C.steel); K.rod([8, 1.5, 18], [0, 1.5, 0], 0.25, C.steel);
} });
defProp({ id: 'castle_tower', name: 'Castle Tower', cat: LND, r: 6, build: (K) => {
  const stone = pm(0x9c958a, { r: 0.95 });
  K.cyl(5.5, 6.2, 24, stone, 0, 0, 0, 20);
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; K.box(1.4, 1.6, 1, stone, Math.cos(a) * 5.4, 24, Math.sin(a) * 5.4, -a); }
  K.cyl(5.6, 5.6, 0.4, C.dark, 0, 24, 0, 20);
  for (let y = 6; y < 22; y += 6) K.box(0.6, 1.6, 0.2, C.black, 0, y, 5.9);
  K.cyl(0.08, 0.08, 6, C.dark, 0, 24, 0, 6); K.box(2.4, 1.4, 0.04, C.red, 1.2, 28.4, 0);
  K.box(2.4, 3.2, 0.3, C.darkWood, 0, 0, 6);
} });
