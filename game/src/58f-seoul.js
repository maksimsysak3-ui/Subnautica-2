// =====================================================================
//  CASE 02 — NEON SEOUL: back streets of Mapo-gu, a rainy night
// =====================================================================
// Yanghwa-ro, a six-lane road with the subway, runs east–west through the middle. North of it: the
// food alley with its orange pojangmacha tents, the bar street, the market square; south: red-brick
// villas on narrow lanes. Every business has its sign — lightboxes, neon tubes, vertical blades —
// and the 24-hour store on the corner is open (you can go in). Namsan and its tower on the skyline.
const SEOUL = {
  bounds: [-150, 150, -135, 135],
  scooters: [[60, 14, 1.57, 0xe8e6e0], [-6, -18, 0, 0xc8261e], [72, -40, 3.1, 0x2a5aa0], [24, 40, 0.2, 0x2a2a2a], [-66, -50, 1.2, 0xe8c040], [108, 70, 2.8, 0x3a8a6a], [-40, 70, 0.4, 0xe8e6e0]],
};
const STATION = { x0: 40, z0: 11, x1: 92, z1: 40 }, MARKET = { x0: -52, z0: -58, x1: -18, z1: -30 };

// ---------------- neon: one sign atlas, one mesh for every sign in town ----------------
const NEON = (() => {
  const SZ = 2048, cv = document.createElement('canvas'); cv.width = cv.height = SZ;
  const g = cv.getContext('2d'); g.clearRect(0, 0, SZ, SZ);
  const FONT = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR","Nanum Gothic",sans-serif';
  const cells = new Map(); let hn = 0, vn = 0;
  const pos = [], uv = [], halo = [], haloCol = [], pool = [], poolCol = [];
  const COLS = { pink: '#ff2a8a', cyan: '#2af0ff', yellow: '#ffd040', green: '#40ff7a', red: '#ff3a3a', violet: '#b06aff', white: '#ffffff', orange: '#ff8a2a', blue: '#3a8aff' };
  // horizontal cells 512×128 (4 × 12) in the top 1536 px; vertical cells 128×512 (16) underneath
  function cell(text, style, col, vertical) {
    const key = `${text}|${style}|${col}|${vertical}`;
    if (cells.has(key)) return cells.get(key);
    const c = COLS[col] || col;
    let x, y, w, h;
    if (!vertical) { x = (hn % 4) * 512; y = Math.floor(hn / 4) * 128; w = 512; h = 128; hn = (hn + 1) % 48; }
    else { x = (vn % 16) * 128; y = 1536; w = 128; h = 512; vn = (vn + 1) % 16; }
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.clearRect(x, y, w, h);
    const box = style === 'box';
    if (box) { g.fillStyle = c; g.fillRect(x + 4, y + 4, w - 8, h - 8); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 4, y + 4, w - 8, (h - 8) * 0.4); }
    else { g.fillStyle = 'rgba(8,6,12,0.85)'; g.fillRect(x + 6, y + 6, w - 12, h - 12); g.strokeStyle = c; g.lineWidth = 4; g.shadowColor = c; g.shadowBlur = 14; g.strokeRect(x + 10, y + 10, w - 20, h - 20); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const draw = (s, tx, ty, size) => {
      g.font = `900 ${size}px ${FONT}`;
      if (box) { g.shadowBlur = 0; g.fillStyle = '#ffffff'; g.fillText(s, tx, ty); }
      else { g.shadowColor = c; g.shadowBlur = 22; g.fillStyle = c; g.fillText(s, tx, ty); g.shadowBlur = 6; g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillText(s, tx, ty); }
    };
    if (!vertical) { const size = Math.min(84, Math.floor((w - 40) / Math.max(1, [...text].length) * 1.1)); draw(text, x + w / 2, y + h / 2 + 4, size); }
    else { const ch = [...text], size = Math.min(84, Math.floor((h - 30) / ch.length * 0.9)); ch.forEach((s, i) => draw(s, x + w / 2, y + 22 + (i + 0.5) * (h - 44) / ch.length, size)); }
    g.restore();
    const r = { u0: x / SZ, v0: 1 - (y + h) / SZ, u1: (x + w) / SZ, v1: 1 - y / SZ, col: new THREE.Color(c) };
    cells.set(key, r); return r;
  }
  // a sign facing local +z in the current W frame; o: {style, col, vertical, glow, pool, back}
  function sign(text, x, y, z, w, h, o = {}) {
    if (MODE_GEOM()) return;
    const r = cell(text, o.style || 'tube', o.col || 'pink', !!o.vertical);
    const P = (a, b, zz = z) => W.worldPos(a, b, zz);
    const quad = (A, B, C, D, flip) => { const q = flip ? [A, C, B, A, D, C] : [A, B, C, A, C, D]; const t = flip ? [[r.u0, r.v0], [r.u1, r.v1], [r.u1, r.v0], [r.u0, r.v0], [r.u0, r.v1], [r.u1, r.v1]] : [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v0], [r.u1, r.v1], [r.u0, r.v1]]; for (let i = 0; i < 6; i++) { pos.push(q[i].x, q[i].y, q[i].z); uv.push(...t[i]); } };
    const A = P(x - w / 2, y - h / 2), B = P(x + w / 2, y - h / 2), C = P(x + w / 2, y + h / 2), D = P(x - w / 2, y + h / 2);
    quad(A, B, C, D, false);
    if (o.back) { const A2 = P(x + w / 2, y - h / 2, z - 0.02), B2 = P(x - w / 2, y - h / 2, z - 0.02), C2 = P(x - w / 2, y + h / 2, z - 0.02), D2 = P(x + w / 2, y + h / 2, z - 0.02); quad(A2, B2, C2, D2, false); }
    // soft halo round it, and its smear on the wet street below
    if (o.glow !== false) { const k = 0.9, Ah = P(x - w / 2 - k, y - h / 2 - k, z + 0.03), Bh = P(x + w / 2 + k, y - h / 2 - k, z + 0.03), Ch = P(x + w / 2 + k, y + h / 2 + k, z + 0.03), Dh = P(x - w / 2 - k, y + h / 2 + k, z + 0.03); for (const p of [Ah, Bh, Ch, Ah, Ch, Dh]) { halo.push(p.x, p.y, p.z); haloCol.push(r.col.r, r.col.g, r.col.b); } }
    if (o.pool !== false) { const c0 = P(x, 0, z + 1.8), s = Math.max(1.6, w * 0.7); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) { pool.push(c0.x + a * s, 0.045, c0.z + b * s * 1.6); poolCol.push(r.col.r * 0.55, r.col.g * 0.55, r.col.b * 0.55); } }
    if (o.lamp !== false && mchance(0.5)) W.lamp(x, y - h / 2 - 0.3, z + 0.8, r.col.getHex(), 2.2, 9, { halo: 0 });
  }
  const MODE_GEOM = () => false;
  function finish() {
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const gs = new THREE.BufferGeometry(); gs.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gs.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const signs = new THREE.Mesh(gs, new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide, alphaTest: 0.02 }));
    signs.renderOrder = 3; scene.add(signs);
    const blob = canvasTex(64, 64, (c2) => { const gr = c2.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c2.fillStyle = gr; c2.fillRect(0, 0, 64, 64); });
    const quadUV = (n) => { const a = []; for (let i = 0; i < n / 6; i++) a.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); return a; };
    for (const [P2, C2] of [[halo, haloCol], [pool, poolCol]]) {
      const gh = new THREE.BufferGeometry(); gh.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); gh.setAttribute('color', new THREE.Float32BufferAttribute(C2, 3)); gh.setAttribute('uv', new THREE.Float32BufferAttribute(quadUV(P2.length / 3), 2));
      const m = new THREE.Mesh(gh, new THREE.MeshBasicMaterial({ map: blob, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      m.renderOrder = 4; scene.add(m);
    }
  }
  return { sign, finish, cell };
})();

// ---------------- buildings ----------------
const BIZ = {
  k: [['빛24 편의점', 'box', 'green'], ['24시 편의점', 'box', 'blue']],
  r: [['삼겹살', 'box', 'red'], ['고기집', 'box', 'orange'], ['국밥', 'box', 'yellow'], ['김밥', 'box', 'orange'], ['분식', 'box', 'red'], ['족발', 'box', 'yellow']],
  b: [['치킨 호프', 'tube', 'yellow'], ['포차', 'tube', 'pink'], ['맥주', 'tube', 'orange'], ['소주방', 'tube', 'cyan']],
  n: [['노래방', 'tube', 'pink'], ['PC방', 'tube', 'cyan'], ['코인노래방', 'tube', 'violet'], ['당구장', 'tube', 'green']],
  c: [['카페', 'tube', 'white'], ['COFFEE', 'tube', 'cyan'], ['디저트', 'tube', 'pink']],
  p: [['약국', 'box', 'green'], ['세탁소', 'box', 'blue'], ['부동산', 'box', 'blue'], ['마트', 'box', 'red'], ['안경', 'box', 'blue']],
  m: [['모텔', 'tube', 'pink'], ['호텔', 'tube', 'violet']],
};
const UPPER = [['노래방', 'pink'], ['PC방', 'cyan'], ['학원', 'yellow'], ['치과', 'green'], ['당구장', 'green'], ['헬스', 'red'], ['미용실', 'violet'], ['한의원', 'orange'], ['스크린골프', 'cyan'], ['네일', 'pink']];
const BLADE = [['노래연습장', 'pink'], ['맥주', 'yellow'], ['모텔', 'violet'], ['PC', 'cyan'], ['치킨', 'orange'], ['호프', 'yellow'], ['당구', 'green'], ['찜질방', 'red']];
const SKIN = { concrete: [0xb8b4ac, 0xa8a49c, 0xc8c0b0, 0x8a8478, 0xd0c8b8, 0x9a968c], brick: [0x8a4a38, 0x9a5a44, 0x7a4234, 0xa8644a] };
// one Korean street building, frame at the front centre (+z = street)
function seoulUnit(u) {
  const w = u.w, D = u.d, F = u.F, kind = u.s, villa = kind === 'v', konbini = kind === 'k';
  const G0 = villa ? 3.0 : 4.2, FL = villa ? 2.9 : 3.3, H = G0 + (F - 1) * FL;
  const brick = villa || mchance(0.25), col = u.f.col ? Number(u.f.col) : mpick(brick ? SKIN.brick : SKIN.concrete), tx = brick ? TX.brick : mchance(0.5) ? TX.ceramic : TX.concrete;
  u.sideCol = col; u.green = false;
  const T = 0.6;
  W.box(w, H, D - T, 0, H / 2, -T - (D - T) / 2, col, { t: tx, wear: 3 }); W.solid(w, H, D - T, 0, H / 2, -T - (D - T) / 2, 'concrete');
  // ground floor
  if (villa) {
    W.box(w, G0, T, 0, G0 / 2, -T / 2, shade(col, 0.9), { t: TX.brick, wear: 4 }); W.solid(w, G0, T, 0, G0 / 2, -T / 2, 'concrete');
    const dx = mr(-w / 2 + 1.2, w / 2 - 1.2);
    W.box(1.1, 2.2, 0.05, dx, 1.1, 0.02, mpick([0x6a6e72, 0x5a4a3a, 0x8a8e94]), { layer: 'metal', t: TX.metal, wear: 4 });
    W.box(1.5, 0.1, 0.9, dx, 2.5, 0.45, 0x8a8e94, { layer: 'metal' });
    W.lamp(dx, 2.35, 0.4, 0xffe0b0, 1.6, 6, { halo: 0.4 }); W.box(0.18, 0.1, 0.1, dx, 2.38, 0.06, 0xfff0d0, { layer: 'glow' });
    W.scope({ lod: 2 }, () => { for (let i = 0; i < 3; i++) W.box(0.25, 0.32, 0.12, dx + 1.0 + i * 0.3, 1.5, 0.07, 0xc8c8c0, { layer: 'metal' }); for (let i = 0; i < 4; i++) W.cyl(0.07, 0.07, 0.6, -w / 2 + 0.4 + i * 0.25, 1.2, 0.1, 0x8a7a3a, { seg: 6, layer: 'metal' }); });
  } else {
    const glassC = 0x8aa0b0, inside = konbini ? 0xd8e0e0 : mpick([0x7a6040, 0x8a6a4a, 0x6a5a6a, 0x5a6a7a, 0x7a5a3a]);
    W.box(w - 0.4, G0 - 1.1, 0.05, 0, (G0 - 1.1) / 2 + 0.25, -0.2, glassC, { layer: 'glass' }); W.solid(w - 0.4, G0 - 0.8, 0.2, 0, (G0 - 0.8) / 2, -0.2, 'glass');
    W.box(w - 0.6, G0 - 1.2, 0.04, 0, (G0 - 1.2) / 2 + 0.25, -0.57, inside, { layer: 'glow' });
    for (let x = -w / 2 + 0.2; x <= w / 2 - 0.1; x += (w - 0.4) / Math.max(1, Math.round(w / 2.4))) W.box(0.08, G0 - 0.9, 0.12, x, (G0 - 0.9) / 2 + 0.15, -0.18, 0x3a3e42, { layer: 'metal' });
    W.box(w, 0.25, 0.3, 0, 0.12, -0.15, 0x6a6a6a, { t: TX.concrete });
    W.lamp(0, 2.2, 1.2, konbini ? 0xe8f4ff : 0xffd8a8, konbini ? 3.4 : 2.2, 9, { halo: 0 });
    // fascia with the shop's sign
    const [txt, sty, c] = u.trade ? [u.trade, u.f.sty || 'box', u.f.c || 'pink'] : mpick(BIZ[kind] || BIZ.r);
    W.box(w, 0.95, 0.35, 0, G0 - 0.55, 0.12, 0x1a1a1e, { layer: 'metal' });
    NEON.sign(txt, 0, G0 - 0.55, 0.3, Math.min(w - 0.4, 6.5), 0.8, { style: sty, col: c });
    // things out front
    W.scope({ lod: 2 }, () => {
      if (kind === 'r' || kind === 'b') { for (let i = 0; i < (w > 7 ? 2 : 1); i++) { const tx2 = -w / 4 + i * w / 2; plasticTable(tx2, 0, 1.3, 0, mpick([0xc0302a, 0x2a6a4a, 0xe8e0d0])); for (const s of [-1, 1]) plasticChair(tx2 + s * 0.7, 0, 1.3, s * 1.57, 0xc0302a); } }
      if (kind === 'k') { for (let i = 0; i < 2; i++) { const tx2 = -w / 3 + i * w / 1.6; plasticTable(tx2, 0, 1.6, 0, 0x2a6a4a); for (const s of [-1, 1]) plasticChair(tx2 + s * 0.7, 0, 1.6, s * 1.57, 0x2a6a4a); W.cone(1.1, 0.4, tx2, 2.3, 1.6, 0x2a8a4a, { seg: 8, layer: 'cloth' }); W.rod([tx2, 0, 1.6], [tx2, 2.3, 1.6], 0.025, 0xc8c8c8, { layer: 'metal' }); } }
      if (kind === 'c') for (let i = 0; i < 3; i++) plantPot(-w / 2 + 0.6 + i * 0.5, 0, 0.6, 'ficus', 1.2);
      if (mchance(0.3)) vendingMachine(w / 2 - 0.6, 0, 0.5, Math.PI, mpick([0xc0302a, 0x2a5aa0, 0xe8e0d0]));
    });
  }
  // upper floors: ribbon windows, half of them lit; some with a business name in the glass
  for (let f = 1; f < F; f++) {
    const y0 = G0 + (f - 1) * FL;
    if (villa) {
      const n = Math.max(1, Math.floor(w / 3.2));
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + (i + 0.5) * w / n, lit = mchance(0.55);
        W.box(1.6, 1.3, 0.05, x, y0 + 1.5, 0.01, lit ? mpick([0xb08a50, 0xc8a870, 0x8aa0c0]) : 0x14161a, { layer: lit ? 'glow' : 'pane' });
        W.box(1.8, 0.08, 0.2, x, y0 + 0.82, 0.1, 0x8a8a8a, { t: TX.concrete });
        if (mchance(0.5)) { for (let k = 0; k < 7; k++) W.box(0.02, 0.9, 0.02, x - 0.8 + k * 0.27, y0 + 1.25, 0.32, 0x2a2a2a, { layer: 'metal', lod: 1 }); W.box(1.7, 0.04, 0.04, x, y0 + 1.7, 0.32, 0x2a2a2a, { layer: 'metal', lod: 1 }); }
        if (lit && mchance(0.25)) W.lamp(x, y0 + 1.5, 0.6, 0xffd8a0, 0.8, 5, { halo: 0 });
      }
      W.box(w, 0.12, 0.15, 0, y0 - 0.06, 0.07, shade(col, 1.15), { t: TX.concrete, lod: 1 });
    } else {
      const lit = mchance(0.6), wc = lit ? mpick([0xc8b890, 0xa8c0d0, 0xd8c8a0, 0x9ab0c8]) : 0x101418;
      W.box(w - 0.5, 1.7, 0.05, 0, y0 + 1.55, 0.01, wc, { layer: lit ? 'glow' : 'pane' });
      for (let x = -w / 2 + 0.25; x <= w / 2 - 0.2; x += 1.6) W.box(0.07, 1.7, 0.08, x, y0 + 1.55, 0.04, 0x3a3e42, { layer: 'metal', lod: 1 });
      W.box(w, 0.6, 0.12, 0, y0 + 0.35, 0.06, shade(col, 0.95), { t: tx, lod: 1 });
      if (mchance(0.45)) { const [t2, c2] = mpick(UPPER); NEON.sign(t2, mr(-w / 4, w / 4), y0 + 1.6, 0.06, Math.min(3.6, w * 0.45), 0.9, { style: 'box', col: c2, pool: false, glow: false, lamp: false }); }
    }
  }
  // a vertical blade sign on the corner, and a rooftop sign on some
  if (!villa && F > 2 && mchance(0.6)) {
    const [t3, c3] = mpick(BLADE), sx = mpick([-1, 1]) * (w / 2 - 0.15);
    W.push(sx, 0, 0.55, Math.PI / 2);
    const bh = Math.min(H - G0 - 0.5, 1.2 + [...t3].length * 0.95);
    W.box(0.7, bh + 0.2, 0.2, 0, G0 + 0.4 + bh / 2, 0, 0x1a1a1e, { layer: 'metal' });
    NEON.sign(t3, 0, G0 + 0.4 + bh / 2, 0.11, 0.6, bh, { style: 'tube', col: c3, vertical: true, back: true, pool: false });
    W.pop();
  }
  // roof: parapet, water tank, antenna, a rooftop lightbox here and there
  W.push(0, 0, -D / 2);
  lightParapet(w, D, H, 1.0, shade(col, 0.95), 'plain');
  W.scope({ lod: 1 }, () => {
    if (mchance(0.6)) { W.cyl(0.7, 0.7, 1.6, mr(-w / 3, w / 3), H + 0.8, mr(-D / 3, D / 3), mpick([0x2a7a4a, 0x3a8a5a, 0xb8b8b0]), { seg: 12, layer: 'metal' }); }
    if (mchance(0.4)) acCondenser(mr(-w / 3, w / 3), H, mr(-D / 3, D / 3), mr(0, 3));
    if (mchance(0.3)) antenna(mr(-w / 3, w / 3), H, mr(-D / 3, D / 3));
    if (mchance(0.25)) laundryLine(-w / 2 + 0.5, H + 1.6, mr(-D / 3, D / 3), w / 2 - 0.5, H + 1.6, mr(-D / 3, D / 3), 6);
  });
  if (!villa && F >= 4 && mchance(0.3)) { const [t4, s4, c4] = mpick([...BIZ.m, ...BIZ.n]); W.box(Math.min(w - 1, 7), 1.8, 0.3, 0, H + 1.4, D / 2 - 0.6, 0x1a1a1e, { layer: 'metal' }); NEON.sign(t4, 0, H + 1.4, D / 2 - 0.42, Math.min(w - 1.4, 6.6), 1.5, { style: s4, col: c4, pool: false }); }
  W.pop();
  // the side walls get pipes, cables, AC units
  if (!villa) W.scope({ lod: 1 }, () => { for (let f = 1; f < F; f += 2) if (mchance(0.5)) acWall(mr(-w / 2 + 0.8, w / 2 - 0.8), G0 + (f - 1) * FL + 0.2, 0.3, 0); });
  return H;
}

// ---------------- the street plan ----------------
function seoulPlan() {
  SKY.night();
  Object.assign(CITY, { x0: -165, x1: 165, z0: -150, z1: 150 });
  Object.assign(SPAWN, { x: 66, z: 30, yaw: Math.PI * 0.85 });
  Object.assign(SQ, { x0: 1e4, z0: 1e4, x1: 1e4 + 1, z1: 1e4 + 1 });   // no "quiet square" here
  MAP.lodDist[0] = 420;
  return [
    ['Laying out Mapo-gu', seoulStreets],
    ['The 24-hour store and the subway', () => { seoulKonbini(); subwayEntrance(65, 30); }],
    ['Shops, bars and villas, street by street', seoulFronts],
    ['Rooftops', () => { fillBlocks(-150, -135, 150, 135, null, [0x9a968c, 0x8a8478, 0x8a4a38, 0xa8a49c]); }],
    ['Pojangmacha, poles and cables', seoulDressing],
    ['Lighting the signs', () => { NEON.finish(); seoulSkyline(); }],
  ];
}
function seoulStreets() {
  // Yanghwa-ro: asphalt, kerbed pavements, lane markings
  const main = addStreet([[-150, 0], [150, 0]], 24, 'road', { raw: true, road: 15, walk: 4.5 });
  TOWN.lanes.yanghwa = main; roadway(main, { asphalt: 0x2a2b2e, pave: 0x8a8680 });
  for (const x of [-70, 0, 70]) for (const dx of [-11, 11]) for (let k = -6; k <= 6; k++) W.box(3, 0.012, 0.6, x + dx, 0.04, k * 1.2, 0xe8e8e0, { ao: false, t: TX.none });   // zebra crossings
  const asphalt = { tx: TX.asphalt, col: 0x323335 };
  lane('golmokN', [[-70, -12], [-70, -135]], 7, 'alley', asphalt);
  lane('golmokS', [[-70, 12], [-70, 135]], 7, 'alley', asphalt);
  lane('foodAlley', [[0, -12], [0, -130]], 6.5, 'alley', { tx: TX.concrete, col: 0x5a5856 });
  lane('barStreet', [[70, -12], [70, -135]], 8, 'alley', asphalt);
  lane('villaLane1', [[20, 12], [18, 62], [22, 135]], 6, 'alley', asphalt);
  lane('villaLane2', [[112, 12], [112, 135]], 6, 'alley', asphalt);
  lane('villaLane3', [[-112, 12], [-110, 70], [-114, 135]], 6, 'alley', asphalt);
  lane('cross1', [[-150, -66], [150, -66]], 7, 'alley', asphalt);
  lane('cross2', [[-150, 70], [150, 70]], 6, 'alley', asphalt);
  lane('back1', [[-150, -110], [150, -110]], 6, 'alley', asphalt);
  plaza('Station plaza', STATION, 0x8a8680, TX.paving);
  plaza('Market square', MARKET, 0x6a6660, TX.paving);
  for (const r of [{ x0: -170, z0: -150, x1: -150, z1: 150 }, { x0: 150, z0: -150, x1: 170, z1: 150 }, { x0: -170, z0: -150, x1: 170, z1: -135 }, { x0: -170, z0: 135, x1: 170, z1: 150 }]) GR.rect((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, r.x1 - r.x0, r.z1 - r.z0, 0, GR.WALL, true);
  // backstops at the map's edge: noise barriers and construction hoarding
  for (const [a, b] of [[[-150, -135], [150, -135]], [[150, -135], [150, 135]], [[150, 135], [-150, 135]], [[-150, 135], [-150, -135]]]) {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    W.push((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, Math.atan2(-dz, dx)); W.box(L, 6, 0.4, 0, 3, 0, 0x4a5a6a, { layer: 'metal', t: TX.corrugated, wear: 4 }); W.solid(L, 6, 0.4, 0, 3, 0, 'metal');
    for (let x = -L / 2 + 10; x < L / 2; x += 20) NEON.sign(mpick(['공사중', '안전제일', '출입금지']), x, 4.4, 0.25, 3.2, 0.8, { style: 'box', col: mpick(['yellow', 'orange']), pool: false, glow: false, lamp: false });
    W.pop();
  }
}
function seoulFronts() {
  const T = TOWN.lanes, U = { unit: seoulUnit };
  const F = (n, side, spec, o = {}) => front(T[n], side, spec, { ...U, d: 13, ...o });
  // Yanghwa-ro: the busy frontage — konbini, restaurants, bars, karaoke towers, a motel
  F('yanghwa', -1, '-5 9/6/n 8/5/r 10/7/n 7/4/c -3 9/5/b 8/6/n 11/8/m 8/5/r -2 7/4/p 9/6/n 10/5/b 8/7/n', { fill: '9/5/n 8/4/r 10/6/b 7/4/c 9/7/n 8/5/p' });
  F('yanghwa', 1, '-5 8/5/r 9/6/n 8/4/c 10/5/b -2 9/7/n 8/4/p 7/4/r 11/6/m 9/5/b -12 8/5/n 9/4/r', { fill: '8/5/r 9/6/n 7/4/c 10/5/b 9/6/p' });
  // food alley: restaurants and pubs, low and close
  F('foodAlley', 1, '6/3/r 5/2/b 7/3/r 5/3/b 6/2/r 6/3/b 5/2/r 7/4/n 6/3/r 5/2/b', { d: 10, fill: '6/3/r 5/2/b' });
  F('foodAlley', -1, '5/2/b 6/3/r 6/2/b 7/3/r 5/3/b 6/3/r 6/2/b 7/4/n 5/3/r', { d: 10, fill: '5/2/b 6/3/r' });
  // bar street: karaoke, PC bangs, bars stacked on each other
  F('barStreet', 1, '8/5/n 7/4/b 9/6/n 7/3/b 8/5/n 6/3/b 9/6/n 7/4/b', { fill: '8/5/n 7/4/b' });
  F('barStreet', -1, '7/4/b 9/6/n 7/3/b 8/5/n 7/4/b 10/7/m', { fill: '7/4/b 8/5/n' });
  F('golmokN', 1, '', { fill: '7/4/r 8/5/n 6/3/p 7/4/b' }); F('golmokN', -1, '', { fill: '6/3/p 7/4/r 8/5/n 6/3/c' });
  for (const n of ['golmokS', 'villaLane1', 'villaLane2', 'villaLane3', 'cross2']) { F(n, 1, '', { d: 11, fill: '8/4/v 7/4/v 9/5/v 6/3/p 8/4/v' }); F(n, -1, '', { d: 11, fill: '7/4/v 9/4/v 8/5/v 7/3/k 8/4/v' }); }
  for (const n of ['cross1', 'back1']) { F(n, 1, '', { fill: '7/4/r 8/5/n 7/3/v 6/3/p' }); F(n, -1, '', { fill: '8/4/v 7/4/r 6/3/c 8/5/n' }); }
  // the market square and the station plaza edges
  front(edge([-52, -58], [-18, -58]), -1, '7/3/r 6/3/p 8/4/r 6/3/b 6/3/r', U);
  front(edge([-18, -30], [-52, -30]), -1, '7/3/b 6/3/r 8/3/p 7/3/r', U);
  front(edge([92, 40], [40, 40]), -1, '10/5/n 9/4/c 11/6/m 9/4/r 10/5/p', U);
}

// ---------------- the 24-hour store: bright, open, enterable ----------------
function seoulKonbini() {
  const x0 = 3.5, x1 = 16, z0 = -24, z1 = -12, H = 4, T = 0.3;
  GR.rect((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 0.4, z1 - z0 + 0.4, 0, GR.RESERVED, true);
  const col = 0xd8d8d0, inner = 0xf4f4f0;
  walls([
    ['x', x0, x1, z1 - T / 2, 1, [{ at: 7.0, w: 1.6, h: 2.4, kind: 'shop', style: 'glass' }, { at: 11.5, w: 6.0, h: 2.6, sill: 0.4, kind: 'win', win: 'open' }]],
    ['x', x0, x1, z0 + T / 2, -1, [DOOR(14.8, 0.9, 2.1, { style: 'metal', leaf: 'closed' })]],
    ['z', z0 + T, z1 - T, x0 + T / 2, -1, [{ at: -18, w: 6.0, h: 2.6, sill: 0.4, kind: 'win', win: 'open' }]], ['z', z0 + T, z1 - T, x1 - T / 2, 1, []],
  ], 0, H, T, col, inner, { dimIn: 1 });
  for (const [ax, c, a, b] of [['x', z1 - T / 2, 8.6, 14.5], ['z', x0 + T / 2, -21, -15]]) { if (ax === 'x') W.box(b - a, 2.6, 0.03, (a + b) / 2, 1.7, c, 0x9ab0c0, { layer: 'glass' }); else W.box(0.03, 2.6, b - a, c, 1.7, (a + b) / 2, 0x9ab0c0, { layer: 'glass' }); }
  slab(x0 + T, z0 + T, x1 - T, z1 - T, 0.12, { top: 0xe8e8e4, topTx: TX.ceramic, bot: false });
  slab(x0 - 0.1, z0 - 0.1, x1 + 0.1, z1 + 0.1, H, { top: 0x6a6a68, topTx: TX.concrete, bot: 0xf0f0ec });
  // fascia: the green-and-blue lightbox wrapping the corner
  W.box(x1 - x0 + 0.4, 1.0, 0.4, (x0 + x1) / 2, H - 0.4, z1 + 0.2, 0x1a1a1e, { layer: 'metal' });
  W.push((x0 + x1) / 2, 0, z1 + 0.41, 0); NEON.sign('빛24 편의점', 0, H - 0.4, 0, 9, 0.85, { style: 'box', col: 'green' }); W.pop();
  W.push(x0 - 0.21, 0, (z0 + z1) / 2, -Math.PI / 2); W.box(z1 - z0, 1.0, 0.4, 0, H - 0.4, -0.2, 0x1a1a1e, { layer: 'metal' }); NEON.sign('24 HOURS', 0, H - 0.4, 0.01, 7, 0.8, { style: 'box', col: 'blue' }); W.pop();
  // inside: shelves of snacks, the drinks fridges glowing along the back, the counter, the ramen bar
  W.scope({}, () => {
    for (let z = z0 + 2.5; z < z1 - 3; z += 2.2) for (const x of [7.5, 11]) shelfUnit(x, 0.12, z, Math.PI / 2, 2.6, 1.6, 0.8, 0xe8e8e4, 'grocery');
    for (let x = x0 + 1; x < x1 - 2.5; x += 1.1) { W.box(1.0, 2.1, 0.7, x, 1.17, z0 + 0.7, 0xc8d0d8, { layer: 'metal' }); W.box(0.9, 1.9, 0.02, x, 1.2, z0 + 1.06, 0xd8f0ff, { layer: 'glow' }); for (let k = 0; k < 4; k++) W.box(0.8, 0.22, 0.4, x, 0.45 + k * 0.45, z0 + 0.8, mpick([0x2a8a4a, 0xc0302a, 0x2a5aa0, 0xe8c040, 0xe8e8e0]), { lod: 2 }); W.solid(1.0, 2.1, 0.7, x, 1.17, z0 + 0.7, 'metal'); }
    counter(14.4, 0.12, -15.2, Math.PI / 2, 2.6, 0xe8e8e4, 0x8a8a88); cashRegister(14.2, 1.15, -14.8, -Math.PI / 2);
    W.box(5.4, 0.06, 0.55, 11.4, 1.05, z1 - 0.65, 0xd8d0c0, { t: TX.wood }); W.solid(5.4, 1.1, 0.55, 11.4, 0.55, z1 - 0.65, 'wood'); for (let i = 0; i < 5; i++) stool(9.2 + i * 1.1, 0.12, z1 - 1.3, 0xe8e8e4);
    microwave(15.2, 1.15, -19.6, -Math.PI / 2); W.box(0.6, 0.5, 0.4, 15.3, 1.4, -21, 0xd8d8d8, { layer: 'metal' });
    for (let x = x0 + 1.5; x < x1 - 1; x += 3) ceilingLight(x, H - 0.05, (z0 + z1) / 2, Math.PI / 2, 2.4, true);
  });
  for (const [x, z] of [[6, -18], [12, -18]]) W.lamp(x, H - 0.4, z, 0xf0f8ff, 3.5, 10, { halo: 0 });
  TOWN.spots.konbini = { x: 9.5, y: 0.12, z: -19 }; TOWN.spots.konbiniDoor = { x: 7, z: -10.5 };
}
// subway entrance: glass canopy, steps down, the line's green circle
function subwayEntrance(x, z) {
  W.push(x, 0, z, 0);
  W.box(4.4, 0.2, 8, 0, 3.2, 0, 0x6a7a8a, { layer: 'metal' }); W.box(4.2, 0.05, 7.8, 0, 3.1, 0, 0x9ab0c0, { layer: 'glass' });
  for (const s of [-1, 1]) { W.box(0.15, 1.1, 8, s * 2.15, 0.55, 0, 0x8a8e94, { layer: 'metal' }); W.solid(0.15, 1.1, 8, s * 2.15, 0.55, 0, 'metal'); W.box(0.12, 3.2, 0.12, s * 2.1, 1.6, -3.9, 0x6a6e72, { layer: 'metal' }); W.box(0.12, 3.2, 0.12, s * 2.1, 1.6, 3.9, 0x6a6e72, { layer: 'metal' }); }
  W.box(4.4, 1.1, 0.15, 0, 0.55, -4, 0x8a8e94, { layer: 'metal' }); W.solid(4.4, 1.1, 0.15, 0, 0.55, -4, 'metal');
  for (let i = 0; i < 16; i++) W.box(4.0, 0.18, 0.4, 0, -0.09 - i * 0.18, 3.6 - i * 0.4, 0x6a6a68, { t: TX.concrete });
  W.box(4.0, 3, 1, 0, -1.5, -3.5, 0x2a2c30, { t: TX.ceramic });
  W.cyl(0.6, 0.6, 0.08, 0, 3.9, 4.0, 0x2aa04a, { seg: 20, rx: Math.PI / 2, layer: 'glow' });
  NEON.sign('지하철 2호선', 0, 3.75, 4.12, 3.4, 0.7, { style: 'box', col: 'green' });
  W.lamp(0, 2.8, 0, 0xe8f4ff, 3, 10, { halo: 0.4 });
  W.pop();
  TOWN.spots.subway = { x, z: z - 2 };
}
// orange-tarp street tents with steaming pots, strings of bulbs, red plastic stools
function pojangmacha(x, z, ry) {
  W.push(x, 0, z, ry);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) W.rod([sx * 2.2, 0, sz * 1.7], [sx * 2.2, 2.4, sz * 1.7], 0.03, 0x8a8e94, { layer: 'metal' });
  W.box(4.6, 0.04, 3.6, 0, 2.5, 0, 0xe8701a, { layer: 'cloth', t: TX.fabric, wear: 4 });
  for (const sz of [-1, 1]) W.box(4.6, 1.5, 0.03, 0, 1.75, sz * 1.8, 0xd8601a, { layer: 'cloth', t: TX.fabric, wear: 5, rx: sz * 0.06 });
  W.box(0.03, 1.4, 3.6, -2.3, 1.8, 0, 0xd8601a, { layer: 'cloth', t: TX.fabric });
  W.box(2.4, 0.8, 0.7, 0.8, 0.4, -1.1, 0xb8b8b0, { layer: 'metal' }); W.solid(2.4, 0.8, 0.7, 0.8, 0.4, -1.1, 'metal');
  for (let i = 0; i < 3; i++) W.cyl(0.18, 0.16, 0.22, 0.2 + i * 0.5, 0.92, -1.1, 0x8a8e94, { seg: 10, layer: 'metal' });
  plasticTable(-0.6, 0, 0.5, 0, 0x2a5aa0); for (const [a, b] of [[-1.3, 0.5], [0.1, 0.5], [-0.6, 1.2], [-0.6, -0.2]]) stool(a, 0, b, 0xc0302a);
  for (let i = 0; i < 6; i++) W.sphere(0.07, 0.07, 0.07, -1.9 + i * 0.75, 2.35, 0, 0xfff0c0, { layer: 'glow' });
  W.lamp(0, 2.2, 0, 0xffb060, 2.6, 7, { halo: 0.5 });
  NEON.sign('포장마차', 0, 2.1, 1.84, 2.4, 0.5, { style: 'box', col: 'red', pool: false, glow: false, lamp: false });
  W.pop();
  W.solid(4.6, 2.5, 0.1, x, 1.25, z - 1.8, 'cloth', { ry });
}
// utility pole with a transformer and the famous tangle of cables
function utilityPole(x, z) {
  W.cyl(0.14, 0.18, 10, x, 5, z, 0x8a8a84, { seg: 8, t: TX.concrete }); W.solid(0.4, 10, 0.4, x, 5, z, 'concrete');
  W.box(1.6, 0.12, 0.12, x, 9.2, z, 0x6a6a64, { layer: 'metal' });
  if (mchance(0.6)) W.cyl(0.32, 0.32, 0.9, x + 0.4, 7.6, z, 0x8a9094, { seg: 10, layer: 'metal' });
  W.scope({ lod: 2 }, () => { for (let i = 0; i < 4; i++) W.sphere(0.35, 0.3, 0.35, x + mr(-0.4, 0.4), 0.3, z + mr(-0.4, 0.4), mpick([0xe8e8e0, 0x2a2a2a, 0x3a6a8a]), { seg: 6, hseg: 4, layer: 'cloth' }); });
}
function seoulDressing() {
  const T = TOWN.lanes;
  // pojangmacha down the food alley
  for (let z = -22; z > -125; z -= 13) pojangmacha(mpick([-1.2, 1.2]), z, Math.PI / 2);
  // street lamps and trees along Yanghwa-ro; poles and cables everywhere else
  for (let x = -140; x <= 140; x += 22) for (const s of [-1, 1]) { streetLampModern(x, 0.16, s * 10.2, s > 0 ? Math.PI : 0, 9); W.lamp(x, 8.8, s * 8.4, 0xffc888, 3.0, 16, { halo: 0.8 }); }
  for (let x = -130; x <= 130; x += 16) for (const s of [-1, 1]) if (Math.abs(x % 70) > 6) tree(x + 8, 0.16, s * 10.8, 'ficus', 0.8);
  for (const x of [-70, 0, 70]) for (const s of [-1, 1]) trafficLight(x + s * 9, 0.16, s * 10.5, s > 0 ? Math.PI : 0);
  for (const st of Object.values(T)) {
    if (st.kind === 'road') continue;
    const poles = [];
    for (let s = 8; s < st.len - 4; s += 18) { const p = pathAt(st.pts, s), n = [-p.tz, p.tx], r = st.w / 2 - 0.35, side = Math.floor(s / 18) % 2 ? 1 : -1; const x = p.x + n[0] * r * side, z = p.z + n[1] * r * side; utilityPole(x, z); poles.push([x, z]); }
    W.defer(() => W.scope({ lod: 1 }, () => { for (let i = 1; i < poles.length; i++) for (let k = 0; k < 5; k++) W.cable([poles[i - 1][0], 8.6 + k * 0.18, poles[i - 1][1]], [poles[i][0], 8.6 + k * 0.18, poles[i][1]], 0.6 + k * 0.15, 0.015, 0x141414, 8); for (const [x, z] of poles) for (let k = 0; k < 2; k++) { const p2 = pathAt(st.pts, mr(2, st.len - 2)); W.cable([x, 8.2 - k * 0.6, z], [p2.x - p2.tz * (st.w / 2 + 0.1), mr(5, 8), p2.z + p2.tx * (st.w / 2 + 0.1)], 0.5, 0.012, 0x141414, 6); } }), 'mid', poles[0] || [0, 0]);
    // parked cars and delivery scooters along the residential lanes
    W.scope({ lod: 1 }, () => { for (let s = 12; s < st.len - 6; s += mr(14, 24)) { const p = pathAt(st.pts, s), side = mchance(0.5) ? 1 : -1, r = st.w / 2 - 1.1; if (st.w >= 6.5 && mchance(0.5)) sedan(p.x - p.tz * r * side, p.z + p.tx * r * side, Math.atan2(-p.tz, p.tx), mpick([0xe8e6e0, 0x2a2c30, 0x8a8e94, 0x1a2a4a, 0xc8c4bc])); else scooter(p.x - p.tz * (r + 0.4) * side, p.z + p.tx * (r + 0.4) * side, Math.atan2(-p.tz, p.tx) + 1.57, mpick([0xe8e6e0, 0xc8261e, 0x2a2a2a])); } });
  }
  // traffic on Yanghwa-ro: taxis, buses, a stopped delivery truck
  W.scope({ lod: 1 }, () => {
    for (let x = -130; x < 140; x += mr(18, 30)) { const lane2 = mpick([-5.4, -1.8, 1.8, 5.4]); if (mchance(0.25)) bus(x, lane2, lane2 > 0 ? Math.PI : 0, mpick([0x3a9a5a, 0x2a6ab0])); else sedan(x, lane2, lane2 > 0 ? Math.PI : 0, mpick([0xe87a2a, 0xc8c4bc, 0x2a2c30, 0xe8e6e0, 0xc85a1a])); }
    busShelter(40, 0.16, 10, Math.PI); busShelter(-40, 0.16, -10, 0);
  });
  // market square: stalls under lights, the station plaza: benches and a kiosk
  for (let i = 0; i < 6; i++) { const x = MARKET.x0 + 5 + (i % 3) * 11, z = MARKET.z0 + 8 + Math.floor(i / 3) * 12; marketStall(x, z, 0, mpick(['produce', 'fabric', 'spice'])); W.lamp(x, 2.4, z, 0xffd8a0, 1.8, 7, { halo: 0.5 }); }
  W.scope({ lod: 1 }, () => { for (let i = 0; i < 4; i++) bench(STATION.x0 + 6 + i * 6, 0, STATION.z1 - 2, Math.PI); kiosk(STATION.x1 - 6, 0, STATION.z0 + 6, 0); for (let i = 0; i < 3; i++) vendingMachine(STATION.x0 + 2, 0, STATION.z0 + 6 + i * 1.1, Math.PI / 2, mpick([0xc0302a, 0x2a5aa0])); });
}
// the skyline: apartment slabs with lit windows round the edge, Namsan and its tower to the north
function seoulSkyline() {
  const tex = canvasTex(256, 512, (g, w, h) => { g.fillStyle = '#0b0c12'; g.fillRect(0, 0, w, h); for (let y = 8; y < h; y += 16) for (let x = 6; x < w; x += 14) if (Math.random() < 0.42) { g.fillStyle = Math.random() < 0.8 ? `rgba(255,${200 + Math.random() * 40},${130 + Math.random() * 60},0.9)` : 'rgba(150,200,255,0.9)'; g.fillRect(x, y, 8, 8); } });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: true, color: 0x9a9aa0 });
  let seed = 3;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2, r = 230 + rnd() * 160, x = Math.cos(a) * r * 1.1, z = Math.sin(a) * r;
    if (z < -200 && Math.abs(x - 40) < 140) continue;   // keep Namsan clear
    const w = 18 + rnd() * 16, h = 40 + rnd() * 50, d = 12;
    const geo = new THREE.BoxGeometry(w, h, d); const uvs = geo.attributes.uv; for (let k = 0; k < uvs.count; k++) uvs.setXY(k, uvs.getX(k) * w / 18, uvs.getY(k) * h / 40);
    const m = new THREE.Mesh(geo, mat); m.position.set(x, h / 2 + terrainH(x, z), z); m.rotation.y = -a + Math.PI / 2; scene.add(m);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 2, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2a3a, toneMapped: false })); top.position.set(x, h + 1 + terrainH(x, z), z); top.rotation.y = m.rotation.y; if (rnd() < 0.5) scene.add(top);
  }
  // N Seoul Tower on the hill
  const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
  const tx = 40, tz = -420, ty = terrainH(tx, tz);
  const tw = new THREE.Group(); tw.position.set(tx, ty, tz); scene.add(tw);
  const wm = new THREE.MeshBasicMaterial({ color: 0x8a8ea0 }), lm = new THREE.MeshBasicMaterial({ color: 0xfff0e0, toneMapped: false });
  tw.add(at(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.4, 90, 12), wm), 0, 45, 0));
  tw.add(at(new THREE.Mesh(new THREE.CylinderGeometry(9, 7, 10, 20), new THREE.MeshBasicMaterial({ color: 0xc8d0ff, toneMapped: false })), 0, 92, 0));
  tw.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.6, 40, 8), wm), 0, 117, 0));
  tw.add(at(new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3a3a, toneMapped: false })), 0, 138, 0));
  for (let i = 0; i < 12; i++) tw.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), lm), Math.cos(i / 12 * Math.PI * 2) * 9.2, 92, Math.sin(i / 12 * Math.PI * 2) * 9.2));
}

// ---------------- rain ----------------
const RAIN = (() => {
  let mesh = null, vel = null;
  const N = 3600, R = 28;
  function build() {
    const pos = new Float32Array(N * 6); vel = new Float32Array(N);
    for (let i = 0; i < N; i++) { const x = (Math.random() - 0.5) * 2 * R, y = Math.random() * 22, z = (Math.random() - 0.5) * 2 * R; pos.set([x, y, z, x + 0.03, y - 0.55, z + 0.02], i * 6); vel[i] = 14 + Math.random() * 6; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    mesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9ab0d0, transparent: true, opacity: 0.32, depthWrite: false, fog: true }));
    mesh.frustumCulled = false; scene.add(mesh);
  }
  return {
    update(dt, cam) {
      if (!MAP.night || !MAP.ready) return;
      if (!mesh) build();
      const p = mesh.geometry.attributes.position.array, cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
      for (let i = 0; i < N; i++) {
        const k = i * 6; let y = p[k + 1] - vel[i] * dt;
        let x = p[k], z = p[k + 2];
        if (y < cy - 6 || Math.abs(x - cx) > R || Math.abs(z - cz) > R) { x = cx + (Math.random() - 0.5) * 2 * R; z = cz + (Math.random() - 0.5) * 2 * R; y = cy + 10 + Math.random() * 10; }
        p[k] = x; p[k + 1] = y; p[k + 2] = z; p[k + 3] = x + 0.03; p[k + 4] = y - 0.55; p[k + 5] = z + 0.02;
      }
      mesh.geometry.attributes.position.needsUpdate = true;
    },
  };
})();
