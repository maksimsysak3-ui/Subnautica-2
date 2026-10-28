// =====================================================================
//  Prop catalog, part 1: trees & nature, vehicles, sponsor signage.
//  Units are metres; every prop faces +z (towards the viewer when placed).
// =====================================================================

// ---------- trees & nature ----------
function crown(K, r, mats, cx, cy, cz, n, spread, rnd, sy = 1) {
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, d = rnd() * spread;
    K.ico(r * (0.7 + rnd() * 0.5), mats[i % mats.length], cx + Math.cos(a) * d, cy + (rnd() - 0.3) * spread * 0.8, cz + Math.sin(a) * d, 1, sy, 1, 1);
  }
}
function trunk(K, r0, r1, h, mat = C.bark, lean = 0) { K.cyl(r1, r0, h, mat, 0, 0, 0, 8, lean, 0); }
const NATURE = 'Trees & Nature';
defProp({ id: 'pine', name: 'Pine', cat: NATURE, r: 0.5, build: (K) => {
  trunk(K, 0.35, 0.22, 3.2);
  [[3.2, 4.6, 2.6], [2.6, 4.2, 4.8], [2.0, 3.6, 6.9], [1.3, 3.0, 8.9], [0.7, 2.2, 10.6]].forEach(([r, h, y]) => K.cone(r, h, C.pine, 0, y, 0, 9));
} });
defProp({ id: 'spruce', name: 'Spruce', cat: NATURE, r: 0.45, build: (K) => {
  trunk(K, 0.3, 0.18, 2);
  for (let i = 0; i < 8; i++) K.cone(2.6 - i * 0.3, 2.4, i % 2 ? C.pine : C.leafDark, 0, 1.4 + i * 1.35, 0, 8);
  K.cone(0.3, 1.4, C.pine, 0, 12.2, 0, 6);
} });
defProp({ id: 'fir_tall', name: 'Tall Fir', cat: NATURE, r: 0.5, build: (K) => {
  trunk(K, 0.4, 0.15, 16);
  for (let i = 0; i < 10; i++) K.cone(1.9 - i * 0.14, 2.2, C.pine, 0, 4 + i * 1.5, 0, 7);
} });
defProp({ id: 'cypress', name: 'Cypress', cat: NATURE, r: 0.4, build: (K) => {
  trunk(K, 0.25, 0.2, 1.2);
  K.sph(1.1, C.leafDark, 0, 5.2, 0, 1, 4.4, 1, 10);
  K.sph(0.9, C.pine, 0.2, 6.5, 0.1, 1, 3.4, 1, 8);
} });
defProp({ id: 'oak', name: 'Oak', cat: NATURE, r: 0.8, build: (K, { rng: r }) => {
  trunk(K, 0.7, 0.45, 3.4);
  K.rod([0, 3, 0], [1.6, 5.2, 0.4], 0.28, C.bark); K.rod([0, 3, 0], [-1.4, 5, -0.6], 0.26, C.bark); K.rod([0, 3.2, 0], [0.2, 5.8, 1.3], 0.24, C.bark);
  crown(K, 2.3, [C.leaf, C.leafDark, C.leafLight], 0, 6.3, 0, 9, 2.6, r, 0.8);
} });
defProp({ id: 'birch', name: 'Birch', cat: NATURE, r: 0.35, build: (K, { rng: r }) => {
  K.cyl(0.14, 0.2, 9, C.birchBark, 0, 0, 0, 8);
  for (let i = 0; i < 6; i++) K.box(0.22, 0.06, 0.05, C.black, (r() - 0.5) * 0.1, 1 + i * 1.3, 0.16);
  crown(K, 1.2, [C.leafLight, C.leaf], 0, 8, 0, 8, 1.4, r, 1.3);
} });
defProp({ id: 'maple_autumn', name: 'Autumn Maple', cat: NATURE, r: 0.6, build: (K, { rng: r }) => {
  trunk(K, 0.5, 0.32, 3);
  crown(K, 1.9, [C.autumn, C.autumn2, pm(0xa83a1e, { flat: true, r: 0.9 })], 0, 5.4, 0, 10, 2.2, r);
} });
defProp({ id: 'cherry', name: 'Cherry Blossom', cat: NATURE, r: 0.5, build: (K, { rng: r }) => {
  trunk(K, 0.38, 0.25, 2.4, C.darkWood, 0.1);
  K.rod([0, 2.2, 0], [1.5, 3.6, 0.3], 0.16, C.darkWood); K.rod([0, 2.2, 0], [-1.3, 3.5, -0.4], 0.15, C.darkWood);
  crown(K, 1.5, [C.blossom, pm(0xf7c6d8, { flat: true, r: 0.85 }), pm(0xe58bb0, { flat: true, r: 0.85 })], 0, 4.1, 0, 12, 2.2, r, 0.75);
} });
defProp({ id: 'willow', name: 'Weeping Willow', cat: NATURE, r: 0.7, build: (K, { rng: r }) => {
  trunk(K, 0.6, 0.38, 3.6);
  crown(K, 2, [C.leafLight], 0, 5.6, 0, 6, 1.8, r, 0.7);
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; K.cyl(0.55, 0.15, 3.6, i % 2 ? C.leafLight : C.leaf, Math.cos(a) * 2.6, 1.6, Math.sin(a) * 2.6, 6); }
} });
defProp({ id: 'palm', name: 'Palm', cat: NATURE, r: 0.4, build: (K) => {
  for (let i = 0; i < 9; i++) K.cyl(0.24 - i * 0.008, 0.27 - i * 0.008, 1.05, i % 2 ? C.bark : C.wood, i * i * 0.012, i * 1.0, 0, 8);
  const top = [0.97, 9.1, 0];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const leaf = K.box(0.9, 0.04, 3.8, C.palmLeaf, top[0] + Math.cos(a) * 1.7, top[1] - 0.6, Math.sin(a) * 1.7, -a + Math.PI / 2, 0.45);
    leaf.rotation.order = 'YXZ';
  }
  for (let i = 0; i < 4; i++) K.sph(0.16, C.darkWood, top[0] + Math.cos(i * 1.6) * 0.3, top[1] - 0.2, Math.sin(i * 1.6) * 0.3);
} });
defProp({ id: 'palm_cluster', name: 'Palm Cluster', cat: NATURE, r: 1.6, build: (K) => {
  [[-1.2, 0, 7, 0.2], [1.1, 0.6, 9, -0.15], [0.2, -1.2, 5.5, 0.05]].forEach(([x, z, h, lean]) => {
    K.cyl(0.18, 0.24, h, C.wood, x, 0, z, 8, lean, 0);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; K.box(0.7, 0.04, 3, C.palmLeaf, x + Math.cos(a) * 1.3 - lean * h * 0.5, h - 0.4, z + Math.sin(a) * 1.3, -a + Math.PI / 2, 0.5); }
  });
  K.ico(1.2, C.leaf, 0, 0.5, 0, 1.6, 0.6, 1.3);
} });
defProp({ id: 'poplar_row', name: 'Poplar Row', cat: NATURE, r: 0, build: (K) => {
  for (let i = -2; i <= 2; i++) { K.cyl(0.15, 0.2, 2, C.bark, i * 3.2, 0, 0, 6); K.sph(1.1, i % 2 ? C.leaf : C.leafDark, i * 3.2, 7, 0, 1, 4.6, 1, 10); }
} });
defProp({ id: 'dead_tree', name: 'Dead Tree', cat: NATURE, r: 0.4, build: (K) => {
  trunk(K, 0.45, 0.25, 5, C.bark, 0.05);
  [[1.6, 7, 0.4], [-1.4, 6.6, -0.6], [0.5, 7.8, -1.2], [-0.6, 7.4, 1.2]].forEach((p) => K.rod([0, 4.2, 0], p, 0.12, C.bark));
  K.rod([1.6, 7, 0.4], [2.4, 7.9, 0.6], 0.06, C.bark); K.rod([-1.4, 6.6, -0.6], [-2.2, 7.2, -0.4], 0.06, C.bark);
} });
defProp({ id: 'bush', name: 'Bush', cat: NATURE, r: 0.8, build: (K, { rng: r }) => { crown(K, 0.8, [C.leaf, C.leafDark], 0, 0.6, 0, 6, 0.8, r, 0.8); } });
defProp({ id: 'bush_flower', name: 'Flowering Bush', cat: NATURE, r: 0.8, build: (K, { rng: r }) => {
  crown(K, 0.8, [C.leaf, C.leafDark], 0, 0.6, 0, 6, 0.8, r, 0.8);
  for (let i = 0; i < 26; i++) { const a = r() * 6.28, d = 0.6 + r() * 0.5; K.sph(0.09, [C.red, C.yellow, pm(0xffffff), pm(0xb04ad6)][i % 4], Math.cos(a) * d, 0.5 + r() * 0.9, Math.sin(a) * d, 1, 1, 1, 6); }
} });
defProp({ id: 'hedge', name: 'Hedge (6 m)', cat: NATURE, r: 0, build: (K) => {
  K.box(6, 1.4, 1.1, C.leafDark, 0, 0, 0);
  for (let x = -2.7; x <= 2.7; x += 0.9) K.ico(0.62, C.leaf, x, 1.35, 0, 1, 0.5, 0.9, 1);
} });
defProp({ id: 'boulder', name: 'Boulder', cat: NATURE, r: 1.6, build: (K) => {
  K.ico(1.7, C.rock, 0, 0.9, 0, 1.2, 0.8, 1, 1); K.ico(0.8, C.rockDark, 1.4, 0.4, 0.6, 1, 0.8, 1, 0);
} });
defProp({ id: 'rocks', name: 'Rock Cluster', cat: NATURE, r: 1.8, build: (K, { rng: r }) => {
  for (let i = 0; i < 7; i++) { const a = r() * 6.28, d = r() * 1.8; K.ico(0.4 + r() * 0.7, i % 2 ? C.rock : C.rockDark, Math.cos(a) * d, 0.2, Math.sin(a) * d, 1, 0.7, 1, 0); }
} });
defProp({ id: 'cactus', name: 'Saguaro Cactus', cat: NATURE, r: 0.4, build: (K) => {
  const m = pm(0x4f7d3a, { r: 0.8 });
  K.cyl(0.32, 0.36, 5.4, m, 0, 0, 0, 10); K.sph(0.32, m, 0, 5.4, 0);
  K.rod([0, 2, 0], [0.9, 2.1, 0], 0.22, m); K.cyl(0.22, 0.22, 1.6, m, 0.9, 2, 0, 8); K.sph(0.22, m, 0.9, 3.6, 0);
  K.rod([0, 2.8, 0], [-0.8, 2.9, 0], 0.2, m); K.cyl(0.2, 0.2, 1.2, m, -0.8, 2.8, 0, 8); K.sph(0.2, m, -0.8, 4, 0);
} });
defProp({ id: 'flowerbed', name: 'Flower Bed', cat: NATURE, r: 0, build: (K, { rng: r }) => {
  K.box(4, 0.35, 2, C.concrete, 0, 0, 0); K.box(3.7, 0.38, 1.7, pm(0x4a3320, { r: 1 }), 0, 0, 0);
  for (let i = 0; i < 60; i++) K.sph(0.1, [C.red, C.yellow, pm(0xffffff), pm(0xd04ad6), C.orange][i % 5], (r() - 0.5) * 3.5, 0.48 + r() * 0.1, (r() - 0.5) * 1.5, 1, 1, 1, 6);
} });

// ---------- vehicles ----------
const VEH = 'Vehicles';
function wheelAt(K, x, y, z, r, w) {
  K.rod([x - w / 2, y, z], [x + w / 2, y, z], r, C.tyre, 16);
  K.rod([x - w / 2 - 0.01, y, z], [x + w / 2 + 0.01, y, z], r * 0.62, C.rim, 12);
}
// Generic road vehicle from side profiles (body + greenhouse), with wheels, lights, bumpers.
function roadCar(K, o) {
  const body = pm(o.color, { r: 0.28, m: 0.45 });
  K.side(o.body, o.w, body, 0, 0, 0, 0.06);
  if (o.cabin) K.side(o.cabin, o.w * 0.86, C.glass, 0, 0, 0, 0.04);
  if (o.roof) K.side(o.roof, o.w * 0.88, body, 0, 0, 0, 0.03);
  const [zf, zr] = o.axles, r = o.wr ?? 0.34, tw = o.w / 2 - 0.12;
  for (const z of [zf, zr]) { wheelAt(K, tw, r, z, r, 0.24); wheelAt(K, -tw, r, z, r, 0.24); }
  const front = o.front ?? o.body.reduce((m, p) => Math.max(m, p[0]), -99), rear = o.body.reduce((m, p) => Math.min(m, p[0]), 99);
  const ly = o.lightY ?? 0.75;
  for (const s of [-1, 1]) {
    K.box(0.32, 0.12, 0.05, C.lightOn, s * (o.w / 2 - 0.3), ly, front - 0.02);
    K.box(0.3, 0.12, 0.05, C.redLight, s * (o.w / 2 - 0.28), ly + 0.05, rear + 0.02);
    if (o.mirrors !== false) K.box(0.16, 0.1, 0.08, body, s * (o.w / 2 + 0.06), o.mirrorY ?? 1.0, o.mirrorZ ?? 0.6);
  }
  K.box(o.w * 0.92, 0.18, 0.12, C.dark, 0, 0.32, front - 0.04);
  K.box(o.w * 0.92, 0.18, 0.12, C.dark, 0, 0.34, rear + 0.04);
  K.box(0.5, 0.11, 0.02, C.white, 0, 0.5, rear - 0.02);
}
defProp({ id: 'sedan', name: 'Sedan', cat: VEH, r: 1.1, build: (K) => roadCar(K, {
  color: 0x2f5d8a, w: 1.8, axles: [1.35, -1.3],
  body: [[2.3, 0.35], [2.35, 0.75], [1.2, 0.95], [-1.6, 1.0], [-2.3, 0.95], [-2.35, 0.4], [-1.8, 0.25], [1.8, 0.25]],
  cabin: [[1.15, 0.95], [0.35, 1.42], [-0.95, 1.42], [-1.65, 1.0]], roof: [[0.3, 1.42], [0.35, 1.47], [-0.95, 1.47], [-0.95, 1.42]],
}) });
defProp({ id: 'hatch', name: 'Hatchback', cat: VEH, r: 1, build: (K) => roadCar(K, {
  color: 0xc8102e, w: 1.72, axles: [1.2, -1.15],
  body: [[1.95, 0.35], [2.0, 0.72], [1.0, 0.92], [-1.75, 1.0], [-1.85, 0.4], [-1.5, 0.25], [1.5, 0.25]],
  cabin: [[0.95, 0.92], [0.2, 1.42], [-1.55, 1.42], [-1.8, 1.0]], roof: [[0.15, 1.42], [0.2, 1.47], [-1.55, 1.47], [-1.55, 1.42]],
}) });
defProp({ id: 'suv', name: 'SUV', cat: VEH, r: 1.2, build: (K) => roadCar(K, {
  color: 0x3a3f45, w: 1.95, axles: [1.45, -1.45], wr: 0.4, lightY: 0.95, mirrorY: 1.25,
  body: [[2.35, 0.42], [2.4, 1.0], [1.4, 1.18], [-2.2, 1.2], [-2.35, 0.5], [-1.9, 0.35], [1.9, 0.35]],
  cabin: [[1.35, 1.18], [0.65, 1.78], [-2.1, 1.8], [-2.25, 1.2]], roof: [[0.6, 1.78], [0.65, 1.86], [-2.1, 1.86], [-2.1, 1.8]],
}) });
defProp({ id: 'pickup', name: 'Pickup Truck', cat: VEH, r: 1.3, build: (K) => {
  roadCar(K, {
    color: 0xd9d4c7, w: 1.95, axles: [1.75, -1.65], wr: 0.42, lightY: 0.95, mirrorY: 1.3, mirrorZ: 0.9,
    body: [[2.75, 0.45], [2.8, 1.05], [1.7, 1.2], [-2.7, 1.2], [-2.75, 0.5], [-2.2, 0.35], [2.2, 0.35]],
    cabin: [[1.65, 1.2], [1.0, 1.85], [-0.4, 1.86], [-0.5, 1.2]], roof: [[0.95, 1.85], [1.0, 1.92], [-0.45, 1.92], [-0.45, 1.85]],
  });
  K.box(1.85, 0.08, 2.1, C.dark, 0, 1.2, -1.6);
  for (const s of [-1, 1]) K.box(0.08, 0.45, 2.1, pm(0xd9d4c7, { r: 0.3, m: 0.4 }), s * 0.93, 1.2, -1.6);
} });
defProp({ id: 'sports', name: 'Sports Car', cat: VEH, r: 1.1, build: (K) => roadCar(K, {
  color: 0xffcc00, w: 1.9, axles: [1.4, -1.3], wr: 0.35, lightY: 0.62, mirrorY: 0.95,
  body: [[2.3, 0.3], [2.35, 0.55], [1.0, 0.82], [-1.2, 0.95], [-2.2, 0.9], [-2.25, 0.35], [-1.8, 0.2], [1.9, 0.2]],
  cabin: [[0.95, 0.82], [0.1, 1.22], [-0.9, 1.2], [-1.6, 0.93]],
}) });
defProp({ id: 'supercar', name: 'Supercar', cat: VEH, r: 1.1, build: (K) => {
  roadCar(K, {
    color: 0x16a34a, w: 2.0, axles: [1.45, -1.35], wr: 0.35, lightY: 0.55, mirrorY: 0.9, mirrorZ: 0.4,
    body: [[2.35, 0.22], [2.4, 0.42], [0.9, 0.78], [-0.4, 1.12], [-2.2, 0.98], [-2.3, 0.3], [-1.9, 0.18], [1.9, 0.18]],
    cabin: [[0.85, 0.78], [0.0, 1.14], [-0.5, 1.14], [-0.6, 1.08]],
  });
  K.box(1.8, 0.05, 0.4, C.black, 0, 1.12, -2.05); for (const s of [-1, 1]) K.box(0.05, 0.25, 0.3, C.black, s * 0.8, 0.9, -2.05);
  for (const s of [-1, 1]) K.box(0.05, 0.25, 0.7, C.black, s * 1.0, 0.45, -0.3);
} });
defProp({ id: 'van', name: 'Delivery Van', cat: VEH, r: 1.4, build: (K) => roadCar(K, {
  color: 0xf2f2f0, w: 2.0, axles: [1.85, -1.75], wr: 0.36, lightY: 0.9, mirrorY: 1.6, mirrorZ: 1.5,
  body: [[2.8, 0.38], [2.85, 1.0], [2.3, 1.25], [1.6, 2.3], [-2.75, 2.35], [-2.8, 0.4], [-2.3, 0.3], [2.3, 0.3]],
  cabin: [[2.3, 1.27], [1.62, 2.25], [1.2, 2.25], [1.2, 1.27]],
}) });
defProp({ id: 'bus', name: 'City Bus', cat: VEH, r: 2, build: (K) => {
  const body = pm(0x1e4fa8, { r: 0.35, m: 0.3 });
  K.box(2.5, 2.7, 11.5, body, 0, 0.35, 0);
  K.box(2.52, 1.0, 10.2, C.glass, 0, 1.6, -0.4);
  K.box(2.4, 1.4, 0.06, C.glass, 0, 1.4, 5.77);
  K.box(2.4, 0.4, 0.06, pm(0x111111, { e: 0xffa020, ei: 1.4 }), 0, 2.65, 5.78);
  for (const z of [3.8, -3.6]) { wheelAt(K, 1.1, 0.5, z, 0.5, 0.3); wheelAt(K, -1.1, 0.5, z, 0.5, 0.3); }
  for (const s of [-1, 1]) { K.box(0.3, 0.15, 0.05, C.lightOn, s * 0.95, 0.7, 5.76); K.box(0.25, 0.3, 0.05, C.redLight, s * 1.0, 0.8, -5.77); }
  K.box(2.3, 0.25, 3, C.grey, 0, 3.05, -2);
} });
defProp({ id: 'box_truck', name: 'Box Truck', cat: VEH, r: 1.8, build: (K) => {
  roadCar(K, {
    color: 0xc8102e, w: 2.3, axles: [2.6, -2.2], wr: 0.48, lightY: 1.0, mirrorY: 1.9, mirrorZ: 2.3,
    body: [[3.4, 0.5], [3.45, 1.3], [3.0, 1.55], [2.6, 2.6], [1.7, 2.65], [1.7, 0.5]],
    cabin: [[3.0, 1.57], [2.62, 2.5], [2.0, 2.5], [2.0, 1.57]],
  });
  K.box(2.45, 3.0, 5.6, C.white, 0, 0.8, -1.25);
  K.box(2.2, 0.15, 6.8, C.dark, 0, 0.6, -0.6);
} });
defProp({ id: 'semi', name: 'Semi Truck & Trailer', cat: VEH, r: 2.2, build: (K, ctx) => {
  const cab = pm(0xf2f2f0, { r: 0.3, m: 0.4 });
  K.box(2.5, 2.2, 2.4, cab, 0, 1.0, 6.4); K.box(2.5, 1.0, 1.6, cab, 0, 3.2, 6.0);
  K.box(2.3, 1.0, 0.06, C.glass, 0, 2.2, 7.62); K.box(2.0, 0.6, 0.06, C.chrome, 0, 1.2, 7.63);
  for (const s of [-1, 1]) { K.cyl(0.08, 0.08, 2.4, C.chrome, s * 1.1, 2.6, 5.1, 8); K.box(0.3, 0.15, 0.05, C.lightOn, s * 0.9, 1.3, 7.64); }
  K.box(2.4, 3.4, 12.5, ctx.sp('wall'), 0, 1.15, -1.8);
  K.box(2.1, 0.2, 14, C.dark, 0, 0.9, 0.5);
  for (const z of [6.2, 3.6, 2.4, -6.0, -7.3]) { wheelAt(K, 1.05, 0.5, z, 0.5, 0.35); wheelAt(K, -1.05, 0.5, z, 0.5, 0.35); }
}, sp: true });
defProp({ id: 'transporter', name: 'Team Transporter', cat: VEH, r: 2.2, sp: true, build: (K, ctx) => {
  const cab = pm(0x15161a, { r: 0.3, m: 0.5 });
  K.box(2.55, 2.4, 2.6, cab, 0, 1.0, 7.0); K.box(2.55, 1.2, 1.6, cab, 0, 3.4, 6.6);
  K.box(2.4, 1.1, 0.06, C.glass, 0, 2.3, 8.32);
  K.box(2.55, 3.9, 13.4, cab, 0, 0.95, -1.9);
  for (const s of [-1, 1]) K.panel(10, 2.4, ctx.sp('wall'), s * 1.285, 1.6, -1.9, s * Math.PI / 2);
  K.box(2.2, 0.25, 15, C.dark, 0, 0.75, 0.5);
  for (const z of [6.8, 3.2, 2.0, -6.6, -7.8]) { wheelAt(K, 1.05, 0.5, z, 0.5, 0.36); wheelAt(K, -1.05, 0.5, z, 0.5, 0.36); }
} });
defProp({ id: 'safety_car', name: 'Safety Car', cat: VEH, r: 1.1, build: (K) => {
  roadCar(K, {
    color: 0xc0c4ca, w: 1.95, axles: [1.45, -1.35], wr: 0.36, lightY: 0.62,
    body: [[2.35, 0.3], [2.4, 0.58], [1.0, 0.86], [-1.3, 0.98], [-2.3, 0.92], [-2.35, 0.35], [-1.9, 0.2], [1.95, 0.2]],
    cabin: [[0.95, 0.86], [0.1, 1.28], [-1.0, 1.26], [-1.7, 0.96]],
  });
  K.box(1.2, 0.12, 0.3, C.black, 0, 1.28, -0.4); K.box(0.5, 0.1, 0.25, C.amberLight, -0.32, 1.38, -0.4); K.box(0.5, 0.1, 0.25, C.amberLight, 0.32, 1.38, -0.4);
  K.box(0.02, 0.18, 2.4, C.yellow, 0.99, 0.55, 0); K.box(0.02, 0.18, 2.4, C.yellow, -0.99, 0.55, 0);
} });
defProp({ id: 'medical_car', name: 'Medical Car', cat: VEH, r: 1.1, build: (K) => {
  roadCar(K, {
    color: 0xf2f2f0, w: 1.85, axles: [1.4, -1.35], wr: 0.36, lightY: 0.75,
    body: [[2.4, 0.35], [2.45, 0.75], [1.25, 0.95], [-1.9, 1.02], [-2.35, 0.95], [-2.4, 0.4], [-1.9, 0.25], [1.9, 0.25]],
    cabin: [[1.2, 0.95], [0.4, 1.42], [-1.6, 1.44], [-2.2, 1.0]],
  });
  K.box(1.2, 0.12, 0.3, C.black, 0, 1.44, -0.2); K.box(0.5, 0.1, 0.25, C.blueLight, -0.32, 1.54, -0.2); K.box(0.5, 0.1, 0.25, C.redLight, 0.32, 1.54, -0.2);
  for (const s of [-1, 1]) { K.box(0.02, 0.5, 0.14, C.red, s * 0.93, 0.6, -0.4); K.box(0.02, 0.14, 0.5, C.red, s * 0.93, 0.78, -0.4); }
} });
defProp({ id: 'ambulance', name: 'Ambulance', cat: VEH, r: 1.5, build: (K) => {
  roadCar(K, {
    color: 0xf4f4f2, w: 2.05, axles: [2.0, -1.7], wr: 0.38, lightY: 0.9, mirrorY: 1.6, mirrorZ: 1.6,
    body: [[2.9, 0.4], [2.95, 1.05], [2.4, 1.3], [1.8, 2.2], [1.3, 2.2], [1.3, 0.4]],
    cabin: [[2.4, 1.32], [1.82, 2.15], [1.4, 2.15], [1.4, 1.32]],
  });
  K.box(2.15, 2.4, 4.3, C.white, 0, 0.55, -0.95);
  K.box(2.17, 0.35, 4.3, pm(0x2fd06a, { r: 0.5 }), 0, 1.0, -0.95); K.box(2.17, 0.12, 4.3, C.red, 0, 1.5, -0.95);
  for (const x of [-0.7, 0, 0.7]) K.box(0.4, 0.14, 0.25, x ? C.blueLight : C.redLight, x, 2.95, 1.0);
} });
defProp({ id: 'fire_truck', name: 'Fire Truck', cat: VEH, r: 2, build: (K) => {
  const red = pm(0xc8102e, { r: 0.3, m: 0.4 });
  K.box(2.5, 2.4, 2.6, red, 0, 0.8, 3.2); K.box(2.3, 1.0, 0.06, C.glass, 0, 2.0, 4.52);
  K.box(2.5, 2.2, 5.6, red, 0, 0.8, -1.0);
  for (let z = -3.4; z <= 1.4; z += 1.2) for (const s of [-1, 1]) K.box(0.03, 1.6, 1.0, C.chrome, s * 1.26, 1.1, z);
  K.rod([0, 3.2, 1.5], [0, 3.5, -3.6], 0.12, C.steel); for (const s of [-0.35, 0.35]) K.rod([s, 3.25, 1.5], [s, 3.55, -3.6], 0.05, C.chrome);
  for (let z = -3.4; z <= 1.4; z += 0.4) K.box(0.75, 0.04, 0.06, C.chrome, 0, 3.35 + (1.5 - z) * 0.06, z);
  K.box(1.6, 0.15, 0.3, C.redLight, 0, 3.2, 3.6);
  for (const z of [3.0, -1.6, -2.8]) { wheelAt(K, 1.1, 0.5, z, 0.5, 0.34); wheelAt(K, -1.1, 0.5, z, 0.5, 0.34); }
} });
defProp({ id: 'tractor', name: 'Tractor', cat: VEH, r: 1.3, build: (K) => {
  const g = pm(0x2e7d32, { r: 0.4, m: 0.3 });
  K.box(1.1, 1.0, 2.2, g, 0, 0.7, 0.6); K.box(1.4, 0.4, 1.4, g, 0, 0.7, -0.9);
  K.box(1.3, 1.4, 1.2, C.glassLight, 0, 1.1, -0.9); K.box(1.5, 0.08, 1.4, g, 0, 2.5, -0.9);
  K.cyl(0.06, 0.06, 1.2, C.darkSteel, 0.4, 1.7, 1.3, 8);
  wheelAt(K, 0.95, 0.85, -1.0, 0.85, 0.5); wheelAt(K, -0.95, 0.85, -1.0, 0.85, 0.5);
  wheelAt(K, 0.8, 0.48, 1.3, 0.48, 0.3); wheelAt(K, -0.8, 0.48, 1.3, 0.48, 0.3);
} });
defProp({ id: 'helicopter', name: 'Helicopter + Pad', cat: VEH, r: 6, build: (K) => {
  K.cyl(7, 7, 0.15, C.concrete, 0, 0, 0, 32); K.torus(6.2, 0.2, C.yellow, 0, 0.16, 0, Math.PI / 2);
  K.box(0.6, 0.02, 4, C.white, -1.4, 0.16, 0); K.box(0.6, 0.02, 4, C.white, 1.4, 0.16, 0); K.box(2.4, 0.02, 0.6, C.white, 0, 0.16, 0);
  const b = pm(0x1b2a6a, { r: 0.3, m: 0.5 });
  K.sph(1.2, b, 0, 1.9, 0.6, 1, 0.95, 1.7); K.sph(1.0, C.glass, 0, 2.1, 1.6, 0.9, 0.8, 0.9);
  K.rod([0, 2.1, -1.4], [0, 2.6, -6.5], 0.22, b); K.box(0.08, 1.4, 0.8, b, 0, 2.2, -6.4);
  K.cyl(0.12, 0.12, 0.5, C.dark, 0, 3.0, 0.3, 8);
  K.box(0.2, 0.05, 11, C.black, 0, 3.5, 0.3); K.box(11, 0.05, 0.2, C.black, 0, 3.5, 0.3);
  for (const s of [-1, 1]) { K.rod([s * 0.9, 0.3, 1.8], [s * 0.9, 0.3, -1.2], 0.06, C.steel); K.rod([s * 0.9, 0.3, 1.2], [s * 0.6, 1.0, 1.0], 0.05, C.steel); K.rod([s * 0.9, 0.3, -0.6], [s * 0.6, 1.0, -0.4], 0.05, C.steel); }
} });
defProp({ id: 'motorhome', name: 'Motorhome', cat: VEH, r: 1.8, build: (K) => {
  roadCar(K, {
    color: 0xf2f0ea, w: 2.3, axles: [2.6, -2.0], wr: 0.42, lightY: 0.95, mirrorY: 1.9, mirrorZ: 3.0,
    body: [[3.6, 0.45], [3.65, 1.1], [3.1, 1.4], [2.6, 2.4], [2.6, 3.1], [-4.0, 3.15], [-4.05, 0.5], [-3.4, 0.35], [3.0, 0.35]],
    cabin: [[3.1, 1.42], [2.62, 2.3], [2.2, 2.3], [2.2, 1.42]],
  });
  for (const z of [0.8, -0.8, -2.6]) for (const s of [-1, 1]) K.box(0.03, 0.7, 1.1, C.glass, s * 1.16, 1.6, z);
  K.box(2.32, 0.18, 7.2, pm(0x7a5a3a, { r: 0.6 }), 0, 1.1, -0.5);
} });
defProp({ id: 'golf_cart', name: 'Marshal Buggy', cat: VEH, r: 0.9, build: (K) => {
  const o = pm(0xff6a00, { r: 0.4 });
  K.box(1.25, 0.5, 2.3, o, 0, 0.3, 0); K.box(1.2, 0.5, 0.6, C.dark, 0, 0.8, -0.3);
  for (const [x, z] of [[0.55, 0.85], [-0.55, 0.85], [0.55, -0.9], [-0.55, -0.9]]) K.cyl(0.03, 0.03, 1.1, C.steel, x, 0.8, z, 6);
  K.box(1.3, 0.06, 2.0, C.white, 0, 1.9, 0); K.box(1.1, 0.6, 0.03, C.glassLight, 0, 1.2, 0.86);
  K.box(0.5, 0.1, 0.2, C.amberLight, 0, 1.96, 0);
  for (const z of [0.75, -0.8]) { wheelAt(K, 0.6, 0.24, z, 0.24, 0.18); wheelAt(K, -0.6, 0.24, z, 0.24, 0.18); }
} });

// ---------- sponsor signage (all take a sponsor) ----------
const SIGN = 'Sponsors & Signage';
defProp({ id: 'billboard', name: 'Billboard', cat: SIGN, sp: true, r: 0.6, build: (K, ctx) => {
  for (const x of [-4, 4]) { K.cyl(0.22, 0.26, 6, C.steel, x, 0, -0.3, 10); K.rod([x, 2, -0.3], [x, 5.8, -1.4], 0.08, C.steel); }
  K.box(12.6, 3.4, 0.25, C.dark, 0, 5.8, 0.0);
  K.panel(12, 3, ctx.sp('wall'), 0, 6.0, 0.13);
  K.box(12.6, 0.1, 1.0, C.steel, 0, 5.6, 0.6);
  for (const x of [-4.5, -1.5, 1.5, 4.5]) { K.rod([x, 9.3, 0.1], [x, 9.5, 1.0], 0.04, C.darkSteel); K.box(0.4, 0.18, 0.3, C.lightOn, x, 9.4, 1.0); }
} });
defProp({ id: 'billboard_v', name: 'V-Shaped Billboard', cat: SIGN, sp: true, r: 0.6, build: (K, ctx) => {
  K.cyl(0.35, 0.45, 8, C.steel, 0, 0, 0, 12);
  for (const s of [-1, 1]) {
    const a = s * 0.45;
    K.box(9.6, 3.2, 0.25, C.dark, Math.sin(a) * 2.4 * s, 8, Math.cos(a) * 2.4 - 2.2, a);
    K.panel(9, 2.8, ctx.sp('wall'), Math.sin(a) * 2.4 * s + Math.sin(a) * 0.14, 8.2, Math.cos(a) * 2.4 - 2.2 + Math.cos(a) * 0.14, a);
  }
} });
defProp({ id: 'pylon_sign', name: 'Tall Pylon Sign', cat: SIGN, sp: true, r: 0.8, build: (K, ctx) => {
  K.box(1.2, 14, 0.8, C.dark, 0, 0, 0);
  K.box(5.4, 1.6, 1.0, C.darkSteel, 0, 14, 0);
  for (const s of [-1, 1]) K.panel(5, 1.25, ctx.sp('wall'), 0, 14.18, s * 0.51, s > 0 ? 0 : Math.PI);
  K.box(3.6, 0.9, 0.9, C.dark, 0, 11.6, 0);
  for (const s of [-1, 1]) K.panel(3.4, 0.85, ctx.sp('screen'), 0, 11.62, s * 0.46, s > 0 ? 0 : Math.PI);
} });
defProp({ id: 'led_screen', name: 'Giant LED Screen', cat: SIGN, sp: true, r: 1, build: (K, ctx) => {
  for (const x of [-6, 6]) { K.box(0.6, 6, 0.6, C.darkSteel, x, 0, -0.6); K.rod([x, 0, -2.5], [x, 5.5, -0.6], 0.12, C.darkSteel); }
  K.box(16.8, 5.2, 0.6, C.black, 0, 5.6, 0);
  K.panel(16, 4.5, ctx.sp('screen'), 0, 5.95, 0.31);
  K.box(16.8, 0.6, 1.2, C.dark, 0, 10.8, 0);
} });
defProp({ id: 'overhead_banner', name: 'Overhead Banner (track span)', cat: SIGN, sp: true, r: 0, build: (K, ctx) => {
  const span = 20;
  for (const s of [-1, 1]) { K.box(0.7, 7.5, 0.7, C.darkSteel, s * span / 2, 0, 0); K.box(1.4, 0.6, 1.4, C.concrete, s * span / 2, 0, 0); }
  K.box(span + 0.7, 0.4, 1.4, C.darkSteel, 0, 7.5, 0);
  for (let x = -span / 2; x < span / 2; x += 2) K.rod([x, 7.6, 0.6], [x + 2, 7.6, -0.6], 0.05, C.steel);
  for (const s of [-1, 1]) K.panel(span - 1, 2.4, ctx.sp('banner'), 0, 5.0, s * 0.18, s > 0 ? 0 : Math.PI);
  K.box(span - 1, 2.5, 0.3, C.dark, 0, 4.95, 0);
} });
defProp({ id: 'arch', name: 'Inflatable Arch', cat: SIGN, sp: true, r: 0, build: (K, ctx) => {
  const m = pm(0xe8e8e8, { r: 0.6 });
  K.torus(7, 0.9, m, 0, 0, 0, 0, 0, 0, Math.PI, 28);
  K.box(10, 1.8, 0.4, C.dark, 0, 5.3, 0);
  for (const s of [-1, 1]) K.panel(9.6, 1.6, ctx.sp('banner'), 0, 5.4, s * 0.21, s > 0 ? 0 : Math.PI);
  for (const s of [-1, 1]) K.cyl(1.1, 1.1, 0.3, C.dark, s * 7, 0, 0, 16);
} });
defProp({ id: 'ad_board', name: 'Trackside Ad Board', cat: SIGN, sp: true, r: 0, build: (K, ctx) => {
  K.box(8.2, 1.3, 0.2, C.dark, 0, 0.25, 0);
  K.panel(8, 1.1, ctx.sp('wall'), 0, 0.35, 0.11);
  for (const x of [-3.6, 0, 3.6]) { K.box(0.1, 0.25, 0.1, C.steel, x, 0, 0); K.rod([x, 0, -0.9], [x, 1.2, -0.1], 0.04, C.steel); }
} });
defProp({ id: 'sponsor_tower', name: 'Sponsor Tower', cat: SIGN, sp: true, r: 1.6, build: (K, ctx) => {
  K.cyl(1.5, 1.6, 0.6, C.concrete, 0, 0, 0, 24);
  for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; K.panel(2.6, 9, ctx.sp('wall'), Math.sin(a) * 1.31, 0.8, Math.cos(a) * 1.31, a); }
  K.box(2.6, 9.4, 2.6, C.dark, 0, 0.6, 0);
  K.box(3, 0.4, 3, C.steel, 0, 10, 0); K.cone(0.3, 2.5, C.steel, 0, 10.4, 0, 8); K.sph(0.25, C.redLight, 0, 12.9, 0);
} });
defProp({ id: 'flags', name: 'Flag Poles (x3)', cat: SIGN, sp: true, r: 0, build: (K, ctx) => {
  for (const x of [-3, 0, 3]) {
    K.cyl(0.07, 0.1, 9, C.steel, x, 0, 0, 8); K.sph(0.12, C.chrome, x, 9.05, 0);
    K.panel(4.6, 1.4, ctx.sp('banner'), x + 0.75, 5.4, 0).rotation.z = Math.PI / 2;   // vertical banner, art reads top-down
  }
} });
defProp({ id: 'tent', name: 'Sponsor Gazebo', cat: SIGN, sp: true, r: 2.2, build: (K, ctx) => {
  for (const [x, z] of [[-2.9, -2.9], [2.9, -2.9], [-2.9, 2.9], [2.9, 2.9]]) K.cyl(0.05, 0.05, 2.6, C.steel, x, 0, z, 8);
  const m = ctx.sp('banner');
  K.cone(4.3, 1.6, C.fabric, 0, 2.6, 0, 4).rotation.y = Math.PI / 4;
  for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; K.panel(6, 0.6, m, Math.sin(a) * 3.0, 2.2, Math.cos(a) * 3.0, a); }
  K.box(3, 0.9, 0.7, C.white, 0, 0, 1.6); K.panel(2.8, 0.7, m, 0, 0.1, 1.96);
} });
defProp({ id: 'ground_logo', name: 'Ground Logo (run-off paint)', cat: SIGN, sp: true, r: 0, build: (K, ctx) => {
  K.panel(16, 4, ctx.sp('wall'), 0, -2 + 0.04, 0, 0, -Math.PI / 2).position.y = 0.04;
} });
defProp({ id: 'roof_sign', name: 'Rooftop Sign Frame', cat: SIGN, sp: true, r: 0, build: (K, ctx) => {
  for (let x = -5; x <= 5; x += 2.5) { K.rod([x, 0, 0], [x, 3.6, 0], 0.06, C.darkSteel); K.rod([x, 0, -1.5], [x, 3.0, 0], 0.05, C.darkSteel); }
  K.panel(12, 3, ctx.sp('screen'), 0, 1.0, 0.08);
} });
defProp({ id: 'distance_boards', name: 'Brake Boards 300/200/100', cat: SIGN, r: 0, build: (K) => {
  [300, 200, 100].forEach((n, i) => {
    const m = pm(0xffffff, { map: facadeTex((g, w, h) => {
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.strokeStyle = '#111'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
      g.fillStyle = '#111'; g.font = '800 66px Rajdhani, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), w / 2, h / 2 + 4);
    }) });
    const z = -i * 100 / 10;
    K.cyl(0.05, 0.05, 1.6, C.steel, 0, 0, z, 6);
    K.box(1.2, 1.2, 0.06, m, 0, 1.4, z);
  });
} });
defProp({ id: 'corner_sign', name: 'Corner Number Board', cat: SIGN, r: 0, build: (K) => {
  K.cyl(0.06, 0.06, 2.2, C.steel, 0, 0, 0, 6);
  K.cyl(0.7, 0.7, 0.08, pm(0xffffff, { map: facadeTex((g, w, h) => {
    g.fillStyle = '#e10600'; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = '800 72px Rajdhani, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('T1', w / 2, h / 2 + 4);
  }) }), 0, 2.2, 0, 24, Math.PI / 2);
} });
defProp({ id: 'a_frame', name: 'A-Frame Sign', cat: SIGN, sp: true, r: 0, build: (K, ctx) => {
  for (const s of [-1, 1]) K.panel(2, 0.6, ctx.sp('wall'), 0, 0.15, s * 0.22, s > 0 ? 0 : Math.PI, s * -0.25);
  K.box(2.05, 0.06, 0.05, C.steel, 0, 0.82, 0);
} });
