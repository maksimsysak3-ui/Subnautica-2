// =====================================================================
//  CASE 02 — NEON SEOUL: back streets of Mapo-gu, a rainy night
// =====================================================================
// Yanghwa-ro, a six-lane road with the subway, runs east–west through the middle. North of it: the
// food alley with its orange pojangmacha tents, the bar street, the market square; south: red-brick
// villas on narrow lanes. Every business has its sign — lightboxes, neon tubes, vertical blades —
// and the 24-hour store on the corner is open (you can go in). Namsan and its tower on the skyline.
const SEOUL = {
  bounds: [-250, 250, -330, 240],
  scooters: [[60, 14, 1.57, 0xe8e6e0], [-6, -18, 0, 0xc8261e], [72, -40, 3.1, 0x2a5aa0], [24, 40, 0.2, 0x2a2a2a], [-66, -50, 1.2, 0xe8c040], [108, 70, 2.8, 0x3a8a6a], [-40, 70, 0.4, 0xe8e6e0],
    [200, 40, 1.57, 0x2a2a2a], [-200, 40, 0, 0xe8e6e0], [40, -232, 0.3, 0xc8261e], [100, 176, 1.57, 0x2a5aa0], [212, -150, 0, 0xe8c040]],
};
const STATION = { x0: 40, z0: 11, x1: 92, z1: 40 }, MARKET = { x0: -52, z0: -58, x1: -18, z1: -30 };

// ---------------- neon: one sign atlas, one mesh for every sign in town ----------------
const NEON = (() => {
  // 4096×4096: 224 horizontal cells (512×128, 8 a row) over 32 vertical ones (128×512) along the bottom.
  // A cell is keyed by text+style+colour, so callers keep each text to one colour to stay inside it.
  const SW = 4096, SH = 4096, HROWS = 28, cv = document.createElement('canvas'); cv.width = SW; cv.height = SH;
  const g = cv.getContext('2d'); g.clearRect(0, 0, SW, SH);
  const FONT = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR","Nanum Gothic",sans-serif';
  const cells = new Map(); let hn = 0, vn = 0;
  const pos = [], uv = [], dimv = [], halo = [], haloCol = [], pool = [], poolCol = [];
  const COLS = { pink: '#ff2a8a', cyan: '#2af0ff', yellow: '#ffd040', green: '#40ff7a', red: '#ff3a3a', violet: '#b06aff', white: '#ffffff', orange: '#ff8a2a', blue: '#3a8aff' };
  // styles: box (lightbox) · tube (neon on a dark plate) · led (dot-matrix) · vinyl (letters stuck on glass)
  //         plate (bare letters, for building names) · banner (printed cloth)
  function cell(text, style, col, vertical) {
    const key = `${text}|${style}|${col}|${vertical}`;
    if (cells.has(key)) return cells.get(key);
    const c = COLS[col] || col;
    let x, y, w, h;
    if (!vertical) { if (hn >= HROWS * 8) console.warn('NEON: atlas full'); x = (hn % 8) * 512; y = Math.floor(hn / 8) % HROWS * 128; w = 512; h = 128; hn++; }
    else { if (vn >= 32) console.warn('NEON: atlas full (vertical)'); x = (vn % 32) * 128; y = HROWS * 128; w = 128; h = 512; vn++; }
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.clearRect(x, y, w, h);
    if (style === 'box') { g.fillStyle = c; g.fillRect(x + 4, y + 4, w - 8, h - 8); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 4, y + 4, w - 8, (h - 8) * 0.4); }
    else if (style === 'banner') { g.fillStyle = '#ece6da'; g.fillRect(x + 2, y + 8, w - 4, h - 16); g.fillStyle = c; g.fillRect(x + 2, y + 8, 26, h - 16); g.fillRect(x + w - 28, y + 8, 26, h - 16); }
    else if (style === 'led') { g.fillStyle = '#07070a'; g.fillRect(x + 4, y + 4, w - 8, h - 8); }
    else if (style === 'tube') { g.fillStyle = 'rgba(8,6,12,0.85)'; g.fillRect(x + 6, y + 6, w - 12, h - 12); g.strokeStyle = c; g.lineWidth = 4; g.shadowColor = c; g.shadowBlur = 14; g.strokeRect(x + 10, y + 10, w - 20, h - 20); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const draw = (s, tx, ty, size) => {
      g.font = `900 ${size}px ${FONT}`;
      if (style === 'box') { g.shadowBlur = 0; g.fillStyle = '#ffffff'; g.fillText(s, tx, ty); }
      else if (style === 'banner') { g.shadowBlur = 0; g.fillStyle = c; g.fillText(s, tx, ty); }
      else if (style === 'plate' || style === 'vinyl') { g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 4; g.fillStyle = c; g.fillText(s, tx, ty); }
      else if (style === 'led') { g.shadowColor = c; g.shadowBlur = 10; g.fillStyle = c; g.fillText(s, tx, ty); }
      else { g.shadowColor = c; g.shadowBlur = 22; g.fillStyle = c; g.fillText(s, tx, ty); g.shadowBlur = 6; g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillText(s, tx, ty); }
    };
    if (!vertical) { const size = Math.min(84, Math.floor((w - 40) / Math.max(1, [...text].length) * 1.1)); draw(text, x + w / 2, y + h / 2 + 4, size); }
    else { const ch = [...text], size = Math.min(84, Math.floor((h - 30) / ch.length * 0.9)); ch.forEach((s, i) => draw(s, x + w / 2, y + 22 + (i + 0.5) * (h - 44) / ch.length, size)); }
    // dot-matrix: knock a grid of dark gaps through the lit letters
    if (style === 'led') { g.shadowBlur = 0; g.fillStyle = '#07070a'; for (let k = x + 4; k < x + w; k += 7) g.fillRect(k, y, 2, h); for (let k = y + 4; k < y + h; k += 7) g.fillRect(x, k, w, 2); }
    g.restore();
    const r = { u0: x / SW, v0: 1 - (y + h) / SH, u1: (x + w) / SW, v1: 1 - y / SH, col: new THREE.Color(c) };
    cells.set(key, r); return r;
  }
  // a sign facing local +z in the current W frame; o: {style, col, vertical, glow, pool, back, lamp, dim}
  // printed things (plate, banner, vinyl) default to no halo, no pool, no light, and are dimmed to read as lit by the street
  function sign(text, x, y, z, w, h, o = {}) {
    if (W.mode === 'geom') { if (o.lamp !== false && !['plate', 'banner', 'vinyl'].includes(o.style)) mchance(0.5); return; }   // streamed detail: quads were laid in its first pass
    const st = o.style || 'tube', r = cell(text, st, o.col || 'pink', !!o.vertical);
    if (st === 'plate' || st === 'banner' || st === 'vinyl') o = { glow: false, pool: false, lamp: false, dim: st === 'vinyl' ? 0.8 : 0.32, ...o };
    const dm = o.dim ?? 1;
    const P = (a, b, zz = z) => W.worldPos(a, b, zz);
    const quad = (A, B, C, D, flip) => { const q = flip ? [A, C, B, A, D, C] : [A, B, C, A, C, D]; const t = flip ? [[r.u0, r.v0], [r.u1, r.v1], [r.u1, r.v0], [r.u0, r.v0], [r.u0, r.v1], [r.u1, r.v1]] : [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v0], [r.u1, r.v1], [r.u0, r.v1]]; for (let i = 0; i < 6; i++) { pos.push(q[i].x, q[i].y, q[i].z); uv.push(...t[i]); dimv.push(dm, dm, dm); } };
    const A = P(x - w / 2, y - h / 2), B = P(x + w / 2, y - h / 2), C = P(x + w / 2, y + h / 2), D = P(x - w / 2, y + h / 2);
    quad(A, B, C, D, false);
    if (o.back) { const A2 = P(x + w / 2, y - h / 2, z - 0.02), B2 = P(x - w / 2, y - h / 2, z - 0.02), C2 = P(x - w / 2, y + h / 2, z - 0.02), D2 = P(x + w / 2, y + h / 2, z - 0.02); quad(A2, B2, C2, D2, false); }
    // soft halo round it, and its smear on the wet street below
    if (o.glow !== false) { const k = 0.9, Ah = P(x - w / 2 - k, y - h / 2 - k, z + 0.03), Bh = P(x + w / 2 + k, y - h / 2 - k, z + 0.03), Ch = P(x + w / 2 + k, y + h / 2 + k, z + 0.03), Dh = P(x - w / 2 - k, y + h / 2 + k, z + 0.03); for (const p of [Ah, Bh, Ch, Ah, Ch, Dh]) { halo.push(p.x, p.y, p.z); haloCol.push(r.col.r, r.col.g, r.col.b); } }
    if (o.pool !== false) { const c0 = P(x, 0, z + 1.8), s = Math.max(1.6, w * 0.7); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) { pool.push(c0.x + a * s, 0.045, c0.z + b * s * 1.6); poolCol.push(r.col.r * 0.55, r.col.g * 0.55, r.col.b * 0.55); } }
    if (o.lamp !== false && mchance(0.5)) W.lamp(x, y - h / 2 - 0.3, z + 0.8, r.col.getHex(), 2.2, 9, { halo: 0 });
  }
  // a soft spill of light on the wet ground under a street lamp (world coordinates)
  function groundPool(x, z, r, hex, k = 0.4) { if (W.mode === 'geom') return; const c = new THREE.Color(hex); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) { pool.push(x + a * r, 0.05, z + b * r); poolCol.push(c.r * k, c.g * k, c.b * k); } }
  // split quad soup (6 vertices a quad) into 64 m chunks, so far signs drop out with the rest of the map
  function chunked(P, attrs) {
    const out = new Map();
    for (let q = 0; q < P.length / 18; q++) {
      const k = `${Math.floor(P[q * 18] / 64)}|${Math.floor(P[q * 18 + 2] / 64)}`;
      let c = out.get(k); if (!c) out.set(k, (c = { P: [], A: attrs.map(() => []) }));
      for (let v = 0; v < 18; v++) c.P.push(P[q * 18 + v]);
      attrs.forEach(([arr, n], i) => { for (let v = 0; v < 6 * n; v++) c.A[i].push(arr[q * 6 * n + v]); });
    }
    return out.values();
  }
  function addMesh(c, names, mat, order) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(c.P, 3));
    names.forEach(([nm, n], i) => g.setAttribute(nm, new THREE.Float32BufferAttribute(c.A[i], n)));
    g.computeBoundingSphere(); g.userData.tris = c.P.length / 9;
    const m = new THREE.Mesh(g, mat); m.renderOrder = order; m.userData.lod = 0; m.matrixAutoUpdate = false;
    scene.add(m); MAP.meshes.push(m);
  }
  function finish() {
    console.log(`[map] neon atlas: ${hn}/${HROWS * 8} horizontal, ${vn}/32 vertical`);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const signMat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, toneMapped: false, side: THREE.DoubleSide, alphaTest: 0.02 });
    for (const c of chunked(pos, [[uv, 2], [dimv, 3]])) addMesh(c, [['uv', 2], ['color', 3]], signMat, 3);
    const blob = canvasTex(64, 64, (c2) => { const gr = c2.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c2.fillStyle = gr; c2.fillRect(0, 0, 64, 64); });
    const glowMat = new THREE.MeshBasicMaterial({ map: blob, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    for (const [P2, C2] of [[halo, haloCol], [pool, poolCol]]) {
      const uv2 = []; for (let i = 0; i < P2.length / 18; i++) uv2.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
      for (const c of chunked(P2, [[C2, 3], [uv2, 2]])) addMesh(c, [['color', 3], ['uv', 2]], glowMat, 4);
    }
    pos.length = uv.length = dimv.length = halo.length = haloCol.length = pool.length = poolCol.length = 0;
  }
  return { sign, finish, cell, pool: groundPool, get used() { return [hn, vn]; } };
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
  o: [['은행', 'box', 'blue'], ['증권', 'box', 'cyan'], ['CAFE', 'tube', 'white'], ['서점', 'box', 'orange'], ['베이커리', 'box', 'yellow'], ['클리닉', 'box', 'green']],
};
const UPPER = [['노래방', 'pink'], ['PC방', 'cyan'], ['영어학원', 'yellow'], ['치과', 'green'], ['당구장', 'green'], ['헬스', 'red'], ['미용실', 'violet'], ['한의원', 'orange'], ['스크린골프', 'cyan'], ['네일', 'pink'], ['수학학원', 'orange'], ['세무회계', 'blue'], ['필라테스', 'violet'], ['피부과', 'cyan']];
const BLADE = [['노래연습장', 'pink'], ['맥주', 'yellow'], ['모텔', 'violet'], ['PC', 'cyan'], ['치킨', 'orange'], ['호프', 'yellow'], ['당구', 'green'], ['찜질방', 'red']];
const GLASSNOTE = ['영업중', 'OPEN', '배달 가능', '포장 환영', '카드 OK', '24시간'];
const VILLAS = [['그린빌라', '#c8b088'], ['행복하우스', '#e8d8b0'], ['로즈빌', '#e8d8b0'], ['미래빌라', '#ffffff'], ['한강맨션', '#c8b088'], ['은하빌', '#ffffff'], ['청솔빌라', '#e8d8b0'], ['해피하임', '#c8b088']];
const SKIN = { concrete: [0xb8b4ac, 0xa8a49c, 0xc8c0b0, 0x8a8478, 0xd0c8b8, 0x9a968c], brick: [0x8a4a38, 0x9a5a44, 0x7a4234, 0xa8644a, 0x6a3a2e], panel: [0xd8d8d4, 0x8a9098, 0x5a6068, 0xc8c0b0, 0x3a3e44] };
const NEONHEX = { pink: 0xff2a8a, cyan: 0x2af0ff, yellow: 0xffd040, green: 0x40ff7a, red: 0xff3a3a, violet: 0xb06aff, white: 0xffffff, orange: 0xff8a2a, blue: 0x3a8aff };
// detail that only matters up close: built when the camera comes near, dropped when it leaves (see STREAM)
const later = (fn, cls = 'mid') => W.defer(fn, cls);
// one Korean street building, frame at the front centre (+z = street). Mixes the massing (glass towers,
// set-back top floors, villas on piloti over their parking), the cladding, the window type and the
// shopfront — open, shuttered, with the stair door to the tenants upstairs — so no two read the same.
function seoulUnit(u) {
  const w = u.w, D = u.d, F = u.F, kind = u.s, villa = kind === 'v';
  const G0 = villa ? 3.0 : 4.2, FL = villa ? 2.9 : 3.3;
  const tower = !villa && F >= 6 && (kind === 'o' || mchance(0.5));
  const setback = !tower && F >= 4 && D >= 9 && mchance(0.35), Fm = setback ? F - 1 : F;
  const piloti = villa && F >= 4 && w >= 7 && mchance(0.55);
  const H = G0 + (Fm - 1) * FL;
  const clad = villa ? 'brick' : tower ? 'glass' : mpick(['concrete', 'concrete', 'tile', 'brick', 'panel', 'panel']);
  const col = u.f.col ? Number(u.f.col) : mpick(clad === 'brick' ? SKIN.brick : clad === 'panel' ? SKIN.panel : clad === 'glass' ? [0x2a323c, 0x343c46] : SKIN.concrete);
  const tx = { brick: TX.brick, tile: TX.ceramic, panel: TX.metal, glass: TX.metal, concrete: TX.concrete }[clad];
  u.sideCol = clad === 'glass' ? 0x8a8e94 : col; u.green = false;
  // the mass: upper floors flush with the street line, the ground floor set behind its shopfront or piloti
  const gd = piloti ? 5.6 : villa ? 0.6 : 3.6;
  W.box(w, H - G0, D, 0, (H + G0) / 2, -D / 2, col, { t: tx, wear: 3 }); W.solid(w, H - G0, D, 0, (H + G0) / 2, -D / 2, 'concrete');
  W.box(w, G0, D - gd, 0, G0 / 2, -gd - (D - gd) / 2, shade(col, 0.9), { t: tx, wear: 4 }); W.solid(w, G0, D - gd, 0, G0 / 2, -gd - (D - gd) / 2, 'concrete');
  if (villa) villaGround(u, w, G0, gd, col, piloti, H); else shopGround(u, w, G0, gd, col, kind, clad);
  // upper floors
  const wt = villa ? 'villa' : tower ? 'grid' : mpick(['ribbon', 'ribbon', 'punched', 'punched', 'blinds']);
  const tenants = [...UPPER].sort(() => mrand() - 0.5);
  for (let f = 1; f < Fm; f++) upperFloor(wt, w, G0 + (f - 1) * FL, FL, col, tx, f, tenants[f % tenants.length], f === Fm - 1);
  if (villa) later(() => villaFace(w, G0, H, FL, Fm, col));
  // LED strips tracing the edges of the nightlife buildings
  if (!villa && (kind === 'n' || kind === 'm' || kind === 'b' || tower) && mchance(0.45)) {
    const c = NEONHEX[mpick(['pink', 'cyan', 'violet', 'blue', 'white'])];
    for (const s of [-1, 1]) W.box(0.07, H - G0, 0.07, s * (w / 2 - 0.04), (H + G0) / 2, 0.04, c, { layer: 'glow' });
    W.box(w, 0.07, 0.07, 0, H - 0.05, 0.04, c, { layer: 'glow' });
    if (mchance(0.5)) for (let f = 1; f < Fm; f++) W.box(w, 0.05, 0.05, 0, G0 + (f - 1) * FL, 0.05, c, { layer: 'glow', lod: 1 });
  }
  // a vertical blade sign on the corner
  if (!villa && Fm > 2 && mchance(0.6)) {
    const [t3, c3] = mpick(BLADE), sx = mpick([-1, 1]) * (w / 2 - 0.15);
    W.push(sx, 0, 0.55, Math.PI / 2);
    const bh = Math.min(H - G0 - 0.5, 1.2 + [...t3].length * 0.95);
    W.box(0.7, bh + 0.2, 0.2, 0, G0 + 0.4 + bh / 2, 0, 0x1a1a1e, { layer: 'metal' });
    NEON.sign(t3, 0, G0 + 0.4 + bh / 2, 0.11, 0.6, bh, { style: 'tube', col: c3, vertical: true, back: true, pool: false });
    W.pop();
  }
  // roof: parapet, green waterproofing, then whatever lives up there
  W.push(0, 0, -D / 2);
  lightParapet(w, D, H, villa ? 1.1 : 1.0, shade(col, villa ? 1.0 : 0.95), 'plain');
  const greenRoof = villa || mchance(0.45);
  W.box(w - 0.5, 0.03, D - 0.5, 0, H + 0.015, 0, greenRoof ? mpick([0x3a7a5a, 0x2a6a4a, 0x4a8a6a]) : 0x6a6a68, { t: TX.concrete, wear: 5, lod: 1 });
  if (setback) setbackTop(w, D, H, FL, col, tx, wt, tenants[0]);
  else later(() => roofLife(w, D, H, villa, kind, F));
  W.pop();
  // AC condensers stacked up the facade of the commercial ones
  if (!villa && !tower) later(() => W.scope({ lod: 1 }, () => { for (let f = 1; f < Fm; f += 2) if (mchance(0.4)) acWall(mpick([-1, 1]) * (w / 2 - 0.7), G0 + (f - 1) * FL + 0.15, 0, 0); }));
  return H;
}
// shop on the ground floor: a real room behind the glass (3.4 m deep), lit, furnished by its trade
function shopGround(u, w, G0, gd, col, kind, clad) {
  const stairs = u.F >= 3 && w >= 6.5 && kind !== 'k' && kind !== 'm', sx = mchance(0.5) ? -1 : 1, sw = stairs ? 1.4 : 0;
  const fw = w - 0.6 - sw, fx = -sx * sw / 2;   // shopfront width and centre
  const shut = (kind === 'p' || kind === 'c' || kind === 'r') && mchance(0.18);
  const pier = clad === 'panel' ? shade(col, 0.8) : mpick([0x3a3a3c, 0x5a5650, 0x8a8478, shade(col, 0.8)]);
  for (const x of [-w / 2 + 0.15, w / 2 - 0.15, ...(stairs ? [sx * (w / 2 - 0.3 - sw)] : [])]) { W.box(0.3, G0, 0.5, x, G0 / 2, -0.25, pier, { t: TX.ceramic, wear: 3 }); W.solid(0.3, G0, 0.5, x, G0 / 2, -0.25, 'concrete'); }
  // side walls of the shop room, so a gap next door never shows into it
  for (const s of [-1, 1]) { W.box(0.12, G0, gd - 0.5, s * (w / 2 - 0.06), G0 / 2, -0.5 - (gd - 0.5) / 2, shade(col, 0.7), { t: TX.plaster, lod: 1 }); W.solid(0.12, G0, gd - 0.5, s * (w / 2 - 0.06), G0 / 2, -0.5 - (gd - 0.5) / 2, 'concrete'); }
  // fascia band with the shop's sign
  const [txt, sty, c] = u.trade ? [u.trade, u.f.sty || 'box', u.f.c || 'pink'] : mpick(BIZ[kind] || BIZ.r);
  W.box(w, 0.95, 0.35, 0, G0 - 0.55, 0.12, 0x1a1a1e, { layer: 'metal' });
  NEON.sign(txt, fx, G0 - 0.55, 0.3, Math.min(fw - 0.2, 6.5), 0.8, { style: sty, col: c });
  if (stairs) later(() => stairDoor(sx * (w / 2 - 0.3 - sw / 2), G0, gd, u));
  if (shut) {
    // roller shutter down: corrugated steel, the shutter box, a notice taped on
    W.box(fw, G0 - 1.05, 0.06, fx, (G0 - 1.05) / 2, -0.1, mpick([0x8a8e94, 0x6a7078, 0x9aa0a6, 0x7a6a5a]), { layer: 'metal', t: TX.corrugated, wear: 6 });
    W.box(fw, 0.32, 0.32, fx, G0 - 0.95, -0.06, 0x4a4e54, { layer: 'metal' });
    W.solid(fw, G0 - 1.05, 0.25, fx, (G0 - 1.05) / 2, -0.1, 'metal');
    W.box(0.42, 0.58, 0.005, fx + mr(-fw / 3, fw / 3), 1.45, -0.065, 0xe8e4d8, { ao: false, lod: 2 });
    W.box(fw * 0.5, 0.5, 0.005, fx + mr(-fw / 5, fw / 5), 0.7, -0.065, mpick([0x2a8aa0, 0xc02a6a, 0x3a3a3a]), { ao: false, lod: 2, t: TX.plaster, wear: 7 });
    return;
  }
  // glass, mullions, kick plate, a door; the room behind
  const konbini = kind === 'k', inside = { o: 0xd8d0c0, k: 0xe8f0f0, r: 0x8a6a4a, b: 0x5a3a2a, n: 0x3a2a4a, c: 0x9a7a5a, p: 0xd8dcd8, m: 0x4a2a3a }[kind] || 0x7a6040;
  W.box(fw, G0 - 1.15, 0.04, fx, (G0 - 1.15) / 2 + 0.2, -0.3, 0x8aa0b0, { layer: 'glass' }); W.solid(fw, G0 - 0.95, 0.15, fx, (G0 - 0.95) / 2, -0.3, 'glass');
  W.box(fw, 0.2, 0.08, fx, 0.1, -0.28, 0x2a2c2e, { layer: 'metal' });
  const nm = Math.max(1, Math.round(fw / 2.2));
  for (let i = 1; i < nm; i++) W.box(0.07, G0 - 1.05, 0.1, fx - fw / 2 + i * fw / nm, (G0 - 1.05) / 2, -0.28, 0x2a2c2e, { layer: 'metal' });
  W.box(fw, 0.07, 0.1, fx, G0 - 1.08, -0.28, 0x2a2c2e, { layer: 'metal' });
  const dx = fx + mpick([-1, 1]) * (fw / 2 - 0.7);
  streetDoor(dx, -0.25, kind, txt);
  // whoever works here, at their post
  const post = { r: [fx + fw / 2 - 0.7, -2.9, 'food'], b: [fx + fw / 2 - 0.7, -2.9, 'bar'], c: [fx - fw / 4, -3.25, 'cafe'], o: [fx - fw / 4, -3.25, 'cafe'], n: [fx, -3.25, 'room'], k: [fx - fw / 2 + 0.9, -1.55, 'shop'], p: [fx - fw / 2 + 0.9, -1.55, 'shop'] }[kind];
  if (post && fw > 3.5) staffAt(post[0], post[1], Math.PI, post[2]);
  W.box(0.05, 2.2, 0.05, dx - 0.45, 1.1, -0.25, 0xb8bcc0, { layer: 'metal' }); W.box(0.05, 2.2, 0.05, dx + 0.45, 1.1, -0.25, 0xb8bcc0, { layer: 'metal' }); W.box(0.04, 0.35, 0.04, dx + 0.36, 1.05, -0.2, 0xd8d8d8, { layer: 'metal' });
  if (mchance(0.6)) NEON.sign(mpick(GLASSNOTE), dx, 1.55, -0.27, 0.7, 0.18, { style: 'vinyl', col: 'white' });
  // the room: floor, a glowing back wall (lit from inside), ceiling panels, the trade's furniture
  const rd = gd - 0.35, rz = -0.35 - rd / 2;
  W.box(fw, 0.04, rd, fx, 0.02, rz, konbini ? 0xe8e8e4 : shade(inside, 1.2), { t: TX.ceramic, wear: 3 });
  W.box(fw, G0 - 1.1, 0.04, fx, (G0 - 1.1) / 2, -gd + 0.04, shade(inside, 0.55), { layer: 'glow' });
  W.box(fw, 0.04, rd, fx, G0 - 1.1, rz, shade(inside, 0.4), { layer: 'glow' });
  for (let x = fx - fw / 2 + 1.2; x < fx + fw / 2 - 0.6; x += 2.2) W.box(1.2, 0.03, 0.3, x, G0 - 1.13, rz, kind === 'n' || kind === 'b' || kind === 'm' ? NEONHEX[mpick(['violet', 'pink', 'cyan'])] : 0xf4f0e8, { layer: 'glow' });
  W.lamp(fx, G0 - 1.4, -1.6, konbini || kind === 'p' ? 0xe8f4ff : kind === 'n' ? 0xc070ff : 0xffd0a0, konbini ? 3.0 : 2.0, 8, { halo: 0 });
  later(() => W.scope({ lod: 2 }, () => shopFurniture(kind, fx, fw, gd, inside)), 'near');
  // out front, by trade
  later(() => W.scope({ lod: 2 }, () => {
    if ((kind === 'r' || kind === 'c' || kind === 'p') && mchance(0.4)) { const ac = mpick([0xc0302a, 0x2a6a4a, 0x2a4a8a, 0xd8a020, 0xe8e0d0]); W.box(fw, 0.04, 1.4, fx, G0 - 1.35, 0.6, ac, { layer: 'cloth', t: TX.fabric, rx: 0.32 }); W.box(fw, 0.25, 0.02, fx, G0 - 1.65, 1.26, ac, { layer: 'cloth', t: TX.fabric }); }
    if (kind === 'r' || kind === 'b') { for (let i = 0; i < (w > 7 ? 2 : 1); i++) { const tx2 = fx - fw / 4 + i * fw / 2; plasticTable(tx2, 0, 1.25, 0, mpick([0xc0302a, 0x2a6a4a, 0xe8e0d0, 0x2a5aa0])); for (const s of [-1, 1]) stool(tx2 + s * 0.65, 0, 1.25, 0xc0302a); for (let k = 0; k < 3; k++) W.cyl(0.03, 0.03, 0.22, tx2 + mr(-0.25, 0.25), 0.83, 1.25 + mr(-0.25, 0.25), 0x2a8a4a, { seg: 6, layer: 'glass' }); } }
    if (kind === 'b' || kind === 'r') sojuCrates(fx + fw / 2 - 0.3, 0.5, mchance(0.5) ? 3 : 2);
    if (kind === 'c') for (let i = 0; i < 3; i++) plantPot(fx - fw / 2 + 0.5 + i * 0.55, 0, 0.45, 'ficus', 1.2);
    if (kind !== 'p' && kind !== 'o' && mchance(0.55)) standSign(fx + mpick([-1, 1]) * (fw / 2 - 0.4), 0.9, kind);
    else if (mchance(0.4)) aBoard(fx + mr(-fw / 3, fw / 3), 0.8, mpick([0.2, -0.2]));
    if (mchance(0.25)) vendingMachine(fx + fw / 2 - 0.55, 0, 0.45, 0, mpick([0xc0302a, 0x2a5aa0, 0xe8e0d0]));
    if (kind === 'm') { for (let i = 0; i < 9; i++) W.box(0.22, 2.2, 0.01, fx - 1.0 + i * 0.25, 1.2, -0.2, mpick([0xc02a6a, 0x8a2a8a]), { layer: 'cloth' }); }   // the motel's car-park fringe
  }));
}
function shopFurniture(kind, fx, fw, gd, inside) {
  const back = -gd + 0.4, n = Math.max(1, Math.floor(fw / 2.2));
  if (kind === 'r') {   // barbecue tables: steel drum tables with the extractor ducts dropping from the ceiling
    for (let i = 0; i < n; i++) { const x = fx - fw / 2 + (i + 0.5) * fw / n, z = -1.9; W.cyl(0.42, 0.38, 0.72, x, 0.36, z, 0x8a8e94, { seg: 12, layer: 'metal' }); W.cyl(0.18, 0.18, 0.05, x, 0.74, z, 0x2a2a2a, { seg: 10 }); W.cyl(0.14, 0.18, 1.6, x, 3.0 - 0.8, z, 0xb8bcc0, { seg: 10, layer: 'metal' }); for (const s of [-1, 1]) stool(x + s * 0.65, 0, z, 0xc0302a); }
    for (let x = fx - fw / 2 + 0.6; x < fx + fw / 2 - 0.4; x += 0.7) W.box(0.55, 0.32, 0.02, x, 2.55, back + 0.33, mpick([0xf0e8d0, 0xf8f0d8]), { layer: 'glow' });   // menu boards
  } else if (kind === 'b') {   // hof: long tables, the TV on the wall, a fridge of beer
    for (let i = 0; i < n; i++) { const x = fx - fw / 2 + (i + 0.5) * fw / n; W.box(1.3, 0.05, 0.7, x, 0.75, -1.9, 0x6a4a2a, { t: TX.wood }); W.box(0.1, 0.72, 0.1, x, 0.37, -1.9, 0x2a2a2a); for (const s of [-1, 1]) stool(x + s * 0.5, 0, -1.25, 0x3a2a1a); }
    W.box(1.4, 0.8, 0.06, fx, 2.2, back + 0.33, 0x4a8ad8, { layer: 'glow' }); W.box(1.0, 1.9, 0.6, fx + fw / 2 - 0.7, 0.95, back + 0.3, 0xd8f0ff, { layer: 'glow' });
  } else if (kind === 'c' || kind === 'o') {   // café (and the tower lobbies' coffee bars): counter with the machine, pendant bulbs, little tables
    counter(fx - fw / 4, 0, back + 0.5, 0, Math.min(2.6, fw / 2), 0xd8c8b0, 0x3a3a3a); espressoMachine(fx - fw / 4, 1.0, back + 0.5, 0);
    for (let i = 0; i < 3; i++) { W.rod([fx + i * 0.8 - 0.4, 3.05, -1.6], [fx + i * 0.8 - 0.4, 2.3, -1.6], 0.006, 0x1a1a1a); W.sphere(0.08, 0.1, 0.08, fx + i * 0.8 - 0.4, 2.25, -1.6, 0xffd090, { layer: 'glow' }); }
    W.cyl(0.35, 0.35, 0.04, fx + fw / 4, 0.74, -1.6, 0xe8e0d0, { seg: 12 }); W.cyl(0.04, 0.04, 0.72, fx + fw / 4, 0.36, -1.6, 0x2a2a2a);
  } else if (kind === 'n') {   // karaoke / PC bang lobby: reception, neon strips round the walls, the stairs going down
    W.box(1.8, 1.0, 0.6, fx, 0.5, back + 0.5, 0x1a1a22, { layer: 'metal' }); W.box(1.8, 0.04, 0.04, fx, 1.0, back + 0.82, NEONHEX[mpick(['pink', 'cyan', 'violet'])], { layer: 'glow' });
    for (const y of [0.3, 2.6]) W.box(fw - 0.2, 0.04, 0.04, fx, y, back + 0.1, NEONHEX[mpick(['pink', 'cyan', 'violet', 'blue'])], { layer: 'glow' });
    for (let i = 0; i < 3; i++) W.box(0.9, 0.6, 0.04, fx - fw / 2 + 0.8 + i * 1.1, 2.0, back + 0.15, mpick([0x6a3ad8, 0xd83a8a, 0x3ad8d8]), { layer: 'glow' });
  } else if (kind === 'k' || kind === 'p') {   // shop: shelves, counter, a lit drinks fridge
    for (let i = 0; i < Math.max(1, n - 1); i++) shelfUnit(fx - fw / 2 + 1.2 + i * 2.2, 0, -1.8, 0, 1.6, 1.5, 0.5, 0xe8e8e4, 'grocery');
    W.box(1.0, 1.9, 0.6, fx + fw / 2 - 0.7, 0.95, back + 0.3, 0xd8f0ff, { layer: 'glow' });
    W.box(1.3, 1.0, 0.5, fx - fw / 2 + 0.9, 0.5, -0.9, 0xe8e8e4, { layer: 'metal' });
  } else if (kind === 'm') {   // motel lobby: a little window with a curtain, a potted plant
    W.box(1.2, 0.5, 0.05, fx, 1.3, back + 0.1, 0xffd0a0, { layer: 'glow' }); plantPot(fx + 1.2, 0, back + 0.5, 'ficus', 1.6);
  }
}
// the narrow door beside the shop: stairs up to the tenants, their names stacked on the board outside
function stairDoor(x, G0, gd, u) {
  W.box(1.1, 0.04, gd - 0.4, x, 0.02, -0.4 - (gd - 0.4) / 2, 0x6a6a68, { t: TX.terrazzo });
  for (let i = 0; i < 8; i++) W.box(1.0, 0.18, 0.3, x, 0.09 + i * 0.18, -1.0 - i * 0.3, 0x8a8a84, { t: TX.terrazzo, lod: 2 });
  W.box(1.1, G0 - 0.2, 0.04, x, (G0 - 0.2) / 2, -gd + 0.05, 0x2a2a28, { t: TX.plaster });
  W.box(0.5, 0.06, 0.2, x, G0 - 0.6, -1.2, 0xfff4e0, { layer: 'glow' });
  W.lamp(x, G0 - 0.8, -0.8, 0xfff0d8, 1.2, 4, { halo: 0 });
  // the tenant board: a column of small lightboxes
  const n = Math.min(u.F - 1, 5);
  W.box(0.62, n * 0.3 + 0.12, 0.08, x - 0.75 * Math.sign(x || 1), 1.0 + n * 0.15, 0.06, 0x1a1a1e, { layer: 'metal' });
  for (let i = 0; i < n; i++) { const [t, c] = UPPER[(Math.floor(mrand() * UPPER.length))]; NEON.sign(t, x - 0.75 * Math.sign(x || 1), 1.1 + i * 0.3, 0.11, 0.56, 0.24, { style: 'box', col: c, glow: false, pool: false, lamp: false }); }
}
function upperFloor(wt, w, y0, FL, col, tx, f, tenant, top) {
  // the lit and dark panes are built now (they're what reads from down the street); frames, sills,
  // grilles and blinds stream in close up
  const z = 0.02;
  if (wt === 'ribbon') {
    const lit = mchance(0.65), wc = lit ? mpick([0xc8b890, 0xa8c0d0, 0xd8c8a0, 0x9ab0c8, 0xe8e8f0]) : 0x101418;
    W.box(w - 0.6, 1.8, 0.04, 0, y0 + 1.55, z, wc, { layer: lit ? 'glow' : 'pane' });
    W.box(w, 0.5, 0.14, 0, y0 + 0.32, 0.07, shade(col, 0.85), { t: tx });
    later(() => W.scope({ lod: 1 }, () => {
      for (let x = -w / 2 + 0.3; x <= w / 2 - 0.2; x += 1.5) W.box(0.07, 1.8, 0.08, x, y0 + 1.55, 0.05, 0x2a2e32, { layer: 'metal' });
      W.box(w - 0.6, 0.07, 0.08, 0, y0 + 2.45, 0.05, 0x2a2e32, { layer: 'metal' });
    }));
    if (lit && mchance(0.55)) NEON.sign(tenant[0], 0, y0 + 1.6, 0.05, Math.min(4.4, w * 0.6), 1.0, { style: 'vinyl', col: tenant[1] });
    else if (mchance(0.35)) NEON.sign(tenant[0], mr(-w / 4, w / 4), y0 + 1.6, 0.07, Math.min(3.6, w * 0.45), 0.9, { style: 'box', col: tenant[1], pool: false, glow: false, lamp: false });
  } else if (wt === 'punched' || wt === 'blinds' || wt === 'villa') {
    const n = Math.max(1, Math.round(w / (wt === 'villa' ? 3.2 : 2.3))), ww = Math.min(1.6, w / n - 0.6), wins = [];
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * w / n, lit = mchance(0.55);
      W.box(ww, 1.4, 0.04, x, y0 + 1.5, z, lit ? mpick([0xb08a50, 0xc8a870, 0x8aa0c0, 0xd8c8a0]) : 0x14161a, { layer: lit ? 'glow' : 'pane' });
      wins.push([x, lit, wt === 'villa' && mchance(0.45)]);
    }
    later(() => W.scope({ lod: 1 }, () => {
      for (const [x, lit, grille] of wins) {
        W.box(ww + 0.14, 0.08, 0.1, x, y0 + 2.24, 0.05, 0xd8d8d0, { layer: 'metal' }); W.box(ww + 0.14, 0.08, 0.1, x, y0 + 0.76, 0.05, 0xd8d8d0, { layer: 'metal' });
        for (const s of [-1, 1]) W.box(0.07, 1.4, 0.1, x + s * (ww / 2 + 0.03), y0 + 1.5, 0.05, 0xd8d8d0, { layer: 'metal' });
        W.box(0.05, 1.4, 0.06, x, y0 + 1.5, 0.05, 0xd8d8d0, { layer: 'metal', lod: 2 });
        if (wt === 'blinds' && lit) for (let k = 0; k < 6; k++) W.box(ww, 0.05, 0.02, x, y0 + 0.9 + k * 0.23, 0.04, 0x8a7a5a, { lod: 2 });
        if (grille) { for (let k = 0; k < 8; k++) W.box(0.02, 0.85, 0.02, x - ww / 2 + 0.05 + k * (ww - 0.1) / 7, y0 + 1.2, 0.28, 0x2a2a2a, { layer: 'metal' }); W.box(ww + 0.1, 0.04, 0.3, x, y0 + 1.64, 0.15, 0x2a2a2a, { layer: 'metal' }); }
      }
    }));
    if (wt !== 'villa' && mchance(0.4)) NEON.sign(tenant[0], 0, y0 + 2.75, 0.07, Math.min(3.4, w * 0.45), 0.55, { style: 'box', col: tenant[1], pool: false, glow: false, lamp: false });
  } else if (wt === 'grid') {
    // glass curtain wall: dark panes, a few offices still lit, mullions both ways
    for (let x = -w / 2 + 0.75; x < w / 2; x += 1.5) { const lit = mchance(0.28); W.box(1.42, FL - 0.12, 0.04, x, y0 + FL / 2, z, lit ? mpick([0x8a9cb0, 0x9aa8b8, 0xa89a78, 0x7a90a8]) : 0x1a2430, { layer: lit ? 'glow' : 'pane' }); }
    later(() => W.scope({ lod: 1 }, () => { for (let x = -w / 2 + 0.75; x < w / 2; x += 1.5) W.box(0.06, FL, 0.12, x - 0.75, y0 + FL / 2, 0.06, 0x5a626a, { layer: 'metal' }); W.box(w, 0.12, 0.14, 0, y0, 0.07, 0x5a626a, { layer: 'metal' }); }));
  }
  if (wt === 'villa') W.box(w, 0.12, 0.16, 0, y0 - 0.06, 0.08, shade(col, 1.18), { t: TX.concrete, lod: 1 });
}
// villa street level: either the piloti car park under the building or the brick front with its door
function villaGround(u, w, G0, gd, col, piloti, H) {
  const [name, plate] = mpick(VILLAS);
  if (piloti) {
    for (const x of [-w / 2 + 0.2, 0, w / 2 - 0.2]) { W.box(0.4, G0, 0.4, x, G0 / 2, -0.3, 0xb8b4ac, { t: TX.concrete, wear: 4 }); W.solid(0.4, G0, 0.4, x, G0 / 2, -0.3, 'concrete'); }
    for (const s of [-1, 1]) { W.box(0.2, G0, gd - 0.5, s * (w / 2 - 0.1), G0 / 2, -0.5 - (gd - 0.5) / 2, shade(col, 0.85), { t: TX.brick, wear: 4 }); W.solid(0.2, G0, gd - 0.5, s * (w / 2 - 0.1), G0 / 2, -0.5 - (gd - 0.5) / 2, 'concrete'); }
    W.box(w, 0.6, 0.3, 0, G0 - 0.3, 0.0, shade(col, 1.1), { t: TX.concrete });
    NEON.sign(name, 0, G0 - 0.3, 0.17, Math.min(3.2, w * 0.4), 0.5, { style: 'plate', col: plate });
    W.box(w - 0.4, 0.04, gd, 0, 0.02, -gd / 2, 0x5a5a58, { t: TX.concrete, wear: 6 });
    W.box(2.2, 0.03, 0.6, -w / 4, G0 - 0.02, -gd / 2, 0xf0f4ff, { layer: 'glow' });
    W.lamp(0, G0 - 0.4, -gd / 2, 0xe8f0ff, 1.6, 7, { halo: 0 });
    // the lobby at the back: glass door, mailboxes, the bike nobody rides
    streetDoor(w / 4, -gd + 0.1, 'v', '');
    W.box(1.3, 2.3, 0.05, w / 4, 1.15, -gd + 0.04, 0xa8c0c8, { layer: 'glow' }); W.box(1.4, 2.4, 0.1, w / 4, 1.2, -gd + 0.06, 0x8a8e94, { layer: 'metal' });
    W.scope({ lod: 2 }, () => {
      for (let i = 0; i < 6; i++) W.box(0.3, 0.25, 0.25, w / 4 + 1.1 + (i % 3) * 0.32, 1.2 + Math.floor(i / 3) * 0.27, -gd + 0.15, 0xb8bcc0, { layer: 'metal' });
      bicycle(-w / 2 + 0.8, 0, -gd + 0.6, Math.PI / 2, mpick([0x2a5aa0, 0xc0302a, 0x2a2a2a]));
    });
    W.scope({ lod: 1 }, () => { if (mchance(0.7)) sedan(-w / 4 + 0.2, -gd / 2 + 0.1, Math.PI / 2, mpick([0xe8e6e0, 0x2a2c30, 0x8a8e94, 0x1a2a4a, 0xc8c4bc])); else scooter(-w / 4, -2, 0.4, mpick([0xe8e6e0, 0xc8261e])); });
    return;
  }
  W.box(w, G0, 0.6, 0, G0 / 2, -0.3, shade(col, 0.9), { t: TX.brick, wear: 4 }); W.solid(w, G0, 0.6, 0, G0 / 2, -0.3, 'concrete');
  const dx = mr(-w / 2 + 1.2, w / 2 - 1.2);
  streetDoor(dx, 0, 'v', '');
  W.box(1.1, 2.2, 0.05, dx, 1.1, 0.02, mpick([0x6a6e72, 0x5a4a3a, 0x8a8e94, 0x3a5a4a]), { layer: 'metal', t: TX.metal, wear: 4 });
  W.box(1.5, 0.1, 0.9, dx, 2.5, 0.45, 0x8a8e94, { layer: 'metal' });
  NEON.sign(name, dx, 2.78, 0.03, 1.6, 0.36, { style: 'plate', col: plate });
  W.lamp(dx, 2.35, 0.4, 0xffe0b0, 1.6, 6, { halo: 0.4 }); W.box(0.18, 0.1, 0.1, dx, 2.38, 0.06, 0xfff0d0, { layer: 'glow' });
  // the half-basement's window at the pavement, lit
  if (w > 6) { const bx = dx > 0 ? -w / 4 : w / 4; W.box(1.6, 0.5, 0.04, bx, 0.35, 0.03, mchance(0.5) ? 0xb08a50 : 0x14161a, { layer: 'glow' }); for (let k = 0; k < 6; k++) W.box(0.02, 0.5, 0.03, bx - 0.7 + k * 0.28, 0.35, 0.07, 0x2a2a2a, { layer: 'metal', lod: 2 }); }
  W.scope({ lod: 2 }, () => { for (let i = 0; i < 3; i++) W.box(0.25, 0.32, 0.12, dx + 1.0 + i * 0.3, 1.5, 0.07, 0xc8c8c0, { layer: 'metal' }); });
}
// villa facade: the yellow gas pipes, enclosed balconies, AC units on brackets
function villaFace(w, G0, H, FL, Fm, col) {
  W.scope({ lod: 1 }, () => {
    const px = mpick([-1, 1]) * (w / 2 - 0.35);
    W.cyl(0.035, 0.035, H - 0.6, px, (H + 0.6) / 2, 0.08, 0xe8c020, { seg: 6, layer: 'metal' });
    for (let f = 1; f < Fm; f++) { const y = G0 + (f - 1) * FL + 0.25; W.cyl(0.03, 0.03, w * 0.55, px - Math.sign(px) * w * 0.275, y, 0.08, 0xe8c020, { seg: 6, layer: 'metal', rz: Math.PI / 2 }); W.box(0.18, 0.22, 0.1, px - Math.sign(px) * 0.25, y + 0.2, 0.1, 0xd8d8d0, { layer: 'metal' }); }
    if (mchance(0.45)) { const bx = mr(-w / 4, w / 4), bw = Math.min(3.4, w * 0.45); for (let f = 1; f < Fm; f++) { const y0 = G0 + (f - 1) * FL; W.box(bw, FL - 0.3, 0.7, bx, y0 + FL / 2 - 0.05, 0.36, shade(col, 1.05), { t: TX.brick, wear: 3 }); const lit = mchance(0.5); W.box(bw - 0.3, 1.2, 0.04, bx, y0 + 1.6, 0.72, lit ? 0xc8a870 : 0x14161a, { layer: lit ? 'glow' : 'pane' }); for (let k = 0; k < 4; k++) W.box(0.05, 1.2, 0.06, bx - (bw - 0.3) / 2 + k * (bw - 0.3) / 3, y0 + 1.6, 0.74, 0xe8e8e0, { layer: 'metal' }); } }
    for (let f = 1; f < Fm; f++) if (mchance(0.5)) acWall(mr(-w / 2 + 0.8, w / 2 - 0.8), G0 + (f - 1) * FL + 0.15, 0.02, 0);
  });
}
// the top floor pulled back: a terrace with a railing, plants, a table out under the sky
function setbackTop(w, D, H, FL, col, tx, wt, tenant) {
  const tw = w - 1.0, td = D - 3.4, tz = -D / 2 + td / 2 + 0.3;
  W.box(tw, FL, td, 0, H + FL / 2, tz, shade(col, 1.05), { t: tx, wear: 3 }); W.solid(tw, FL, td, 0, H + FL / 2, tz, 'concrete');
  W.push(0, 0, tz + td / 2); upperFloor(wt === 'grid' ? 'ribbon' : wt, tw, H, FL, col, tx, 9, tenant, true); W.pop();
  W.scope({ lod: 1 }, () => {
    W.box(w - 0.3, 0.05, 0.05, 0, H + 1.0, D / 2 - 0.15, 0xc8ccd0, { layer: 'metal' });
    for (let x = -w / 2 + 0.3; x < w / 2; x += 0.5) W.box(0.03, 1.0, 0.03, x, H + 0.5, D / 2 - 0.15, 0xc8ccd0, { layer: 'metal' });
    for (let i = 0; i < 3; i++) plantPot(-w / 2 + 0.8 + i * 1.2, H, D / 2 - 0.7, mpick(['ficus', 'geranium']), 1.4);
    plasticTable(w / 4, H, tz + td / 2 + 1.4, 0, 0xe8e8e0);
  });
  W.push(0, 0, tz); lightParapet(tw, td, H + FL, 0.5, shade(col, 1.0), 'plain'); W.pop();
  W.push(0, 0, tz); roofLife(tw, td, H + FL, false, 'p', 1); W.pop();
}
// what lives on a Seoul roof: water tanks, condensers, the rooftop room, styrofoam gardens, laundry
function roofLife(w, D, H, villa, kind, F) {
  W.scope({ lod: 1 }, () => {
    if (villa && w >= 7 && mchance(0.4)) {   // oktapbang: the rooftop room, blue door, its own light
      const rx = mr(-w / 4, w / 4), rz = -D / 4;
      W.box(3.6, 2.5, 3.0, rx, H + 1.25, rz, 0xd8d4c8, { t: TX.plaster, wear: 5 }); W.solid(3.6, 2.5, 3.0, rx, H + 1.25, rz, 'concrete');
      W.box(3.9, 0.12, 3.3, rx, H + 2.56, rz, 0x3a6a8a, { layer: 'metal', t: TX.corrugated });
      W.box(0.8, 1.9, 0.04, rx - 0.9, H + 0.95, rz + 1.52, 0x2a5a9a, { layer: 'metal' });
      const lit = mchance(0.6); W.box(1.0, 0.8, 0.04, rx + 0.8, H + 1.5, rz + 1.52, lit ? 0xd8b880 : 0x14161a, { layer: lit ? 'glow' : 'pane' });
      if (lit) W.lamp(rx + 0.8, H + 1.6, rz + 2.2, 0xffd8a0, 1.0, 5, { halo: 0 });
    }
    if (mchance(0.65)) waterTank(mr(-w / 3, w / 3), H, mr(-D / 3, D / 3), mpick(['steel', 'white']));
    if (mchance(0.5)) acCondenser(mr(-w / 3, w / 3), H, mr(-D / 3, D / 3), mr(0, 3));
    if (mchance(0.3)) antenna(mr(-w / 3, w / 3), H, mr(-D / 3, D / 3));
    if (mchance(villa ? 0.5 : 0.2)) for (let i = 0; i < 4; i++) { const x = -w / 2 + 0.7 + i * 0.75, z = D / 2 - 0.8; W.box(0.6, 0.3, 0.4, x, H + 0.15, z, 0xf0f0ec); for (let k = 0; k < 3; k++) W.cone(0.1, 0.35, x - 0.18 + k * 0.18, H + 0.45, z, mpick([0x3a7a2a, 0x4a8a3a, 0x2a6a2a]), { seg: 5 }); }
    if (mchance(villa ? 0.45 : 0.15)) laundryLine(-w / 2 + 0.6, H + 1.6, mr(-D / 3, 0), w / 2 - 0.6, H + 1.6, mr(-D / 3, 0), 6);
  });
  if (!villa && F >= 4 && mchance(0.3)) { const [t4, s4, c4] = mpick([...BIZ.m, ...BIZ.n]); W.box(Math.min(w - 1, 7), 1.8, 0.3, 0, H + 1.4, D / 2 - 0.6, 0x1a1a1e, { layer: 'metal' }); NEON.sign(t4, 0, H + 1.4, D / 2 - 0.42, Math.min(w - 1.4, 6.6), 1.5, { style: s4, col: c4, pool: false }); for (const s of [-1, 1]) W.rod([s * 2, H, D / 2 - 0.8], [s * 2, H + 1.4, D / 2 - 0.6], 0.04, 0x3a3a3a, { layer: 'metal' }); }
}

// ---------------- the street plan ----------------
function seoulPlan() {
  SKY.night();
  Object.assign(CITY, { x0: -250, x1: 250, z0: -330, z1: 270 });
  MAP.lodDist.splice(0, 4, 200, 80, 45, 24); MAP.drawDist = 200;
  Object.assign(SPAWN, { x: 58, z: 19, yaw: Math.PI * 0.85 });
  Object.assign(SQ, { x0: 1e4, z0: 1e4, x1: 1e4 + 1, z1: 1e4 + 1 });   // no "quiet square" here
  // two crews: the Black Dragons hold Mapo's bar streets, the Blue Snakes Gangnam and the north-east
  TOWN.factionAt = (x, z) => (x > 150 || (z < -150 && x > 30) ? 'gold' : 'red');
  TOWN.guards.push(...[[66, -45, -Math.PI / 2], [74, -72, Math.PI / 2], [66, -98, -Math.PI / 2], [74, -124, Math.PI / 2], [2, -127, Math.PI], [-66, -30, -Math.PI / 2]].map(([x, z, yaw]) => ({ x, z, yaw, team: 'red' })),
    ...[[196, 27, Math.PI / 2], [216, 31, Math.PI / 2], [209, -60, -Math.PI / 2], [215, -112, Math.PI / 2], [209, 92, -Math.PI / 2], [95, -205, Math.PI / 2]].map(([x, z, yaw]) => ({ x, z, yaw, team: 'gold' })));
  MAP.bounds = 900;
  return [
    ['Laying out Mapo-gu', () => { seoulRoads(); seoulStreets(); seoulOuterLanes(); seoulReserves(); }],
    ['The 24-hour store and the subway', () => { seoulKonbini(); seoulSubway(); }],
    ['Shops, bars and villas, street by street', seoulFronts],
    ['Gangnam, the market, the river', seoulOuterFronts],
    ['Rooftops', () => { fillBlocks(-250, -330, 250, DIST.RIVER, null, [0x9a968c, 0x8a8478, 0x8a4a38, 0xa8a49c]); }],
    ['Pojangmacha, poles and cables', () => { seoulDressing(); seoulOuterDressing(); }],
    ['Behind the doors', seoulInteriors],
    ['Lighting the signs', () => { NEON.finish(); seoulSkyline(); }],
  ];
}
function seoulStreets() {
  for (const x of [-70, 0, 70]) for (const dx of [-11, 11]) for (let k = -6; k <= 6; k++) W.box(3, 0.012, 0.6, x + dx, 0.04, k * 1.2, 0xe8e8e0, { ao: false, t: TX.none });   // zebra crossings
  const asphalt = { tx: TX.asphalt, col: 0x323335 };
  lane('golmokN', [[-70, -12], [-70, -140]], 7, 'alley', asphalt);
  lane('golmokS', [[-70, 12], [-70, 140]], 7, 'alley', asphalt);
  lane('foodAlley', [[0, -12], [0, -140]], 6.5, 'alley', { tx: TX.concrete, col: 0x5a5856 });
  lane('barStreet', [[70, -12], [70, -140]], 8, 'alley', asphalt);
  lane('villaLane1', [[20, 12], [18, 62], [22, 140]], 6, 'alley', asphalt);
  lane('villaLane2', [[112, 12], [112, 140]], 6, 'alley', asphalt);
  lane('villaLane3', [[-112, 12], [-110, 70], [-114, 140]], 6, 'alley', asphalt);
  lane('cross1', [[-153, -66], [153, -66]], 7, 'alley', asphalt);
  lane('cross2', [[-153, 70], [153, 70]], 6, 'alley', asphalt);
  lane('back1', [[-153, -110], [153, -110]], 6, 'alley', asphalt);
  plaza('Station plaza', STATION, 0x8a8680, TX.paving);
  plaza('Market square', MARKET, 0x6a6660, TX.paving);
}
function seoulFronts() {
  const T = TOWN.lanes, U = { unit: seoulUnit };
  const F = (n, side, spec, o = {}) => front(T[n], side, spec, { ...U, d: 13, ...o });
  // Yanghwa-ro: the busy frontage — konbini, restaurants, bars, karaoke towers, a motel
  F('yanghwa', -1, '-105 9/6/n 8/5/r 10/7/n 7/4/c -3 9/5/b 8/6/n 11/8/m 8/5/r -2 7/4/p 9/6/n 10/5/b 8/7/n', { fill: '9/5/n 8/4/r 10/6/b 7/4/c 9/7/n 8/5/p', end: 100 });
  F('yanghwa', 1, '-105 8/5/r 9/6/n 8/4/c 10/5/b -2 9/7/n 8/4/p 7/4/r 11/6/m 9/5/b -12 8/5/n 9/4/r', { fill: '8/5/r 9/6/n 7/4/c 10/5/b 9/6/p', end: 100 });
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
  slab(x0 - 0.1, z0 - 0.1, x1 + 0.1, z1 + 0.1, H, { top: 0x6a6a68, topTx: TX.concrete, bot: 0xc4c8c4 });
  // fascia: the green-and-blue lightbox wrapping the corner
  W.box(x1 - x0 + 0.4, 1.0, 0.4, (x0 + x1) / 2, H - 0.4, z1 + 0.2, 0x1a1a1e, { layer: 'metal' });
  W.push((x0 + x1) / 2, 0, z1 + 0.41, 0); NEON.sign('빛24 편의점', 0, H - 0.4, 0, 9, 0.85, { style: 'box', col: 'green' }); W.pop();
  W.push(x0 - 0.21, 0, (z0 + z1) / 2, -Math.PI / 2); W.box(z1 - z0, 1.0, 0.4, 0, H - 0.4, -0.2, 0x1a1a1e, { layer: 'metal' }); NEON.sign('24 HOURS', 0, H - 0.4, 0.01, 7, 0.8, { style: 'box', col: 'blue' }); W.pop();
  // inside: shelves of snacks, the drinks fridges glowing along the back, the counter, the ramen bar
  W.scope({}, () => {
    // two gondolas: noodles and snacks on one, drinks and daily things on the other
    gondola(7.0, -21.3, -16.0, ['ramen', 'snacks', 'packs', 'ramen']); gondola(10.6, -21.3, -16.0, ['bottles', 'other', 'snacks', 'packs']);
    // the drinks wall: lit glass doors, rows of bottles and cans, the header
    for (let x = x0 + 1; x < x1 - 2.5; x += 1.1) {
      W.box(1.0, 0.25, 0.7, x, 0.24, z0 + 0.7, 0xc8d0d8, { layer: 'metal' }); W.box(1.0, 0.2, 0.7, x, 2.12, z0 + 0.7, 0xc8d0d8, { layer: 'metal' }); W.box(0.06, 2.1, 0.7, x - 0.47, 1.17, z0 + 0.7, 0xb8c0c8, { layer: 'metal' });
      W.box(0.9, 1.7, 0.02, x, 1.2, z0 + 0.38, 0xd8f0ff, { layer: 'glow' }); W.box(0.9, 1.75, 0.02, x, 1.2, z0 + 1.06, 0xd8e8f0, { layer: 'glass' }); W.solid(1.0, 2.1, 0.7, x, 1.17, z0 + 0.7, 'metal');
      for (let k = 0; k < 5; k++) W.box(0.9, 0.015, 0.55, x, 0.4 + k * 0.36, z0 + 0.7, 0xe8eef0, { layer: 'metal', lod: 2 });
      W.box(0.03, 1.2, 0.04, x + 0.38, 1.2, z0 + 1.1, 0xb8bcc0, { layer: 'metal' });
      W.scope({ lod: 2 }, () => { for (let k = 0; k < 5; k++) { const c = mpick([0x2a8a4a, 0xc0302a, 0x2a5aa0, 0xe8c040, 0xe8e8e0, 0x8a2a8a, 0xe87a2a]); for (let j = 0; j < 7; j++) W.cyl(0.04, 0.04, k > 2 ? 0.14 : 0.24, x - 0.36 + j * 0.12, 0.42 + k * 0.36 + (k > 2 ? 0.07 : 0.12), z0 + 0.85, mchance(0.7) ? c : mpick([0x2a8a4a, 0xe8e8e0]), { seg: 6, layer: k > 2 ? 'metal' : 'glass' }); } });
    }
    W.box(x1 - x0 - 3, 0.4, 0.1, (x0 + x1 - 1.5) / 2, 2.5, z0 + 0.4, 0x1a6a3a, { layer: 'metal' });
    NEON.sign('시원한 음료', (x0 + x1 - 1.5) / 2, 2.5, z0 + 0.46, 3.2, 0.36, { style: 'box', col: 'green', glow: false, pool: false, lamp: false });
    // counter: till, hot-bun steamer, the cigarette wall behind
    counter(14.4, 0.12, -15.2, Math.PI / 2, 2.6, 0xe8e8e4, 0x8a8a88); staffAt(15.25, -15.2, Math.PI / 2, 'shop'); cashRegister(14.2, 1.15, -14.8, -Math.PI / 2);
    W.box(0.5, 0.45, 0.5, 14.3, 1.37, -16.1, 0xc8ccd0, { layer: 'glass' }); W.box(0.46, 0.4, 0.46, 14.3, 1.37, -16.1, 0xffe8b0, { layer: 'glow' }); for (let k = 0; k < 4; k++) W.sphere(0.1, 0.08, 0.1, 14.2 + (k % 2) * 0.2, 1.24 + Math.floor(k / 2) * 0.18, -16.1, 0xf8f0e0);
    konbiniCounterWall(15.65, -16.6, -13.9);
    // window bar with the night's leftovers: cup noodles, a can, a triangle kimbap
    W.box(5.4, 0.06, 0.55, 11.4, 1.05, z1 - 0.65, 0xd8d0c0, { t: TX.wood }); W.solid(5.4, 1.1, 0.55, 11.4, 0.55, z1 - 0.65, 'wood'); for (let i = 0; i < 5; i++) stool(9.2 + i * 1.1, 0.12, z1 - 1.3, 0xe8e8e4);
    W.scope({ lod: 2 }, () => { for (const [bx, c] of [[9.4, 0xd8302a], [10.0, 0xe8a020], [12.6, 0xd8302a]]) { W.cyl(0.07, 0.055, 0.11, bx, 1.14, z1 - 0.7, c, { seg: 10 }); W.box(0.012, 0.012, 0.22, bx + 0.08, 1.2, z1 - 0.72, 0xe8d8b0, { rx: 0.5 }); } W.cyl(0.033, 0.033, 0.12, 12.2, 1.14, z1 - 0.6, 0x2a5aa0, { seg: 8, layer: 'metal' }); W.box(0.12, 0.03, 0.12, 13.4, 1.1, z1 - 0.7, 0xe8e8e0, { ry: 0.785 }); });
    // microwave and hot water for the noodles; ATM, ice-cream chest, umbrellas by the door, the wet-floor sign
    microwave(15.2, 1.15, -19.6, -Math.PI / 2); W.box(0.6, 0.5, 0.4, 15.3, 1.4, -21, 0xd8d8d8, { layer: 'metal' }); W.box(0.4, 0.9, 0.4, 15.3, 0.57, -21, 0xb8bcc0, { layer: 'metal' });
    W.box(0.8, 1.7, 0.7, 4.25, 0.97, -13.8, 0x5a6a7a, { layer: 'metal' }); W.box(0.4, 0.3, 0.02, 4.67, 1.35, -13.8, 0x6ab0ff, { layer: 'glow', ry: Math.PI / 2 }); W.solid(0.8, 1.7, 0.7, 4.25, 0.97, -13.8, 'metal');
    W.box(0.85, 0.85, 1.9, 4.3, 0.55, -18, 0xf0f0ec, { layer: 'metal' }); W.box(0.75, 0.02, 1.8, 4.3, 0.98, -18, 0xbfe8ff, { layer: 'glow' }); W.solid(0.85, 0.9, 1.9, 4.3, 0.55, -18, 'metal');
    W.scope({ lod: 2 }, () => { for (let k = 0; k < 14; k++) W.box(0.14, 0.06, 0.2, 4.0 + (k % 3) * 0.25, 0.94, -18.8 + Math.floor(k / 3) * 0.36, mpick([0xd82a8a, 0xf0d020, 0x2a8ad8, 0xe8e8e0, 0x8a4a2a])); });
    W.cyl(0.2, 0.2, 0.5, 5.6, 0.37, z1 - 0.7, 0x8a8e94, { seg: 10, layer: 'metal' }); for (let k = 0; k < 6; k++) W.rod([5.6 + mr(-0.1, 0.1), 0.15, z1 - 0.7 + mr(-0.1, 0.1)], [5.6 + mr(-0.2, 0.2), 1.0, z1 - 0.7 + mr(-0.2, 0.2)], 0.035, 0xd8e4ec, { layer: 'glass' });
    W.push(8.1, 0.12, -13.7, 0.4); for (const s of [-1, 1]) W.box(0.3, 0.6, 0.02, 0, 0.3, s * 0.08, 0xf0c020, { rx: s * 0.25 }); W.pop();
    // promo cards hanging over the aisles, the ceiling strips, a CCTV dome
    for (const [hx, hz, t] of [[8.8, -17.2, '1+1'], [8.8, -20.2, 'NEW'], [12.6, -18.6, '행사']]) { W.rod([hx, H - 0.05, hz], [hx, 3.05, hz], 0.004, 0x8a8a8a); NEON.sign(t, hx, 2.85, hz, 0.7, 0.36, { style: 'box', col: PROMO[t], back: true, glow: false, pool: false, lamp: false }); }
    for (let x = x0 + 1.5; x < x1 - 1; x += 3) ceilingLight(x, H - 0.05, (z0 + z1) / 2, Math.PI / 2, 2.4, true);
    W.sphere(0.16, 0.12, 0.16, 14.8, H - 0.1, -13.2, 0x1a1a1a, { layer: 'glass' });
  });
  for (const [x, z] of [[6, -18], [12, -18]]) W.lamp(x, H - 0.4, z, 0xf0f8ff, 2.4, 10, { halo: 0 });
  TOWN.spots.konbini = { x: 9.5, y: 0.12, z: -19 }; TOWN.spots.konbiniDoor = { x: 7, z: -10.5 };
}
// subway entrance: glass canopy, steps down, the line's green circle
function subwayEntrance(x, z, name = '') {
  W.push(x, 0, z, 0);
  if (name) { W.box(3.6, 0.5, 0.06, 0, 2.75, 3.9, 0x1a1a1e, { layer: 'metal' }); NEON.sign(`${name}역`, 0, 2.75, 3.94, 3.2, 0.42, { style: 'box', col: 'white', glow: false, pool: false, lamp: false, dim: 0.8 }); }
  W.box(4.4, 0.2, 8, 0, 3.2, 0, 0x6a7a8a, { layer: 'metal' }); W.box(4.2, 0.05, 7.8, 0, 3.1, 0, 0x9ab0c0, { layer: 'glass' });
  for (const s of [-1, 1]) { W.box(0.15, 1.1, 8, s * 2.15, 0.55, 0, 0x8a8e94, { layer: 'metal' }); W.solid(0.15, 1.1, 8, s * 2.15, 0.55, 0, 'metal'); W.box(0.12, 3.2, 0.12, s * 2.1, 1.6, -3.9, 0x6a6e72, { layer: 'metal' }); W.box(0.12, 3.2, 0.12, s * 2.1, 1.6, 3.9, 0x6a6e72, { layer: 'metal' }); }
  W.box(4.4, 1.1, 0.15, 0, 0.55, -4, 0x8a8e94, { layer: 'metal' }); W.solid(4.4, 1.1, 0.15, 0, 0.55, -4, 'metal');
  for (let i = 0; i < 16; i++) W.box(4.0, 0.18, 0.4, 0, -0.09 - i * 0.18, 3.6 - i * 0.4, 0x6a6a68, { t: TX.concrete });
  W.box(4.0, 3, 1, 0, -1.5, -3.5, 0x2a2c30, { t: TX.ceramic });
  // the plaza paving runs over the real steps, so the well is drawn on top of it: a dark drop, the yellow
  // nosing of each step closing up as it goes down, and the lit concourse showing at the bottom
  W.box(4.0, 0.02, 7.6, 0, 0.06, -0.1, 0x08080a, { ao: false });
  for (let i = 0; i < 14; i++) W.box(3.9, 0.012, 0.05, 0, 0.075, 3.4 - i * 0.48 * (1 - i * 0.025), shade(0xc8b040, 1 - i * 0.055), { ao: false });
  W.box(3.9, 0.5, 0.02, 0, 0.3, -3.88, 0x9ab0c8, { layer: 'glow' }); W.lamp(0, 0.4, -3, 0xcfe0ff, 1.4, 5, { halo: 0 });
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
  // the orange tarp glows with the bulbs inside it: that's what makes a pojangmacha from down the street
  W.box(4.6, 0.04, 3.6, 0, 2.5, 0, 0xa8481a, { layer: 'glow' });
  // orange valance round the top, clear plastic walls rolled down below it so you see the tables inside
  for (const sz of [-1, 1]) { W.box(4.6, 0.4, 0.03, 0, 2.3, sz * 1.8, 0xc8581a, { layer: 'glow' }); W.box(4.6, 1.6, 0.02, 0, 1.3, sz * 1.82, 0xd8a070, { layer: 'glass', rx: sz * 0.04 }); for (let k = 0; k < 7; k++) W.box(0.02, 1.6, 0.04, -2.1 + k * 0.7, 1.3, sz * 1.83, 0xe8d8c8, { layer: 'glass', lod: 2 }); }
  W.box(0.03, 0.4, 3.6, -2.3, 2.3, 0, 0xc8581a, { layer: 'glow' }); W.box(0.02, 1.6, 3.6, -2.3, 1.3, 0, 0xd8a070, { layer: 'glass' });
  W.box(2.4, 0.8, 0.7, 0.8, 0.4, -1.1, 0xb8b8b0, { layer: 'metal' }); W.solid(2.4, 0.8, 0.7, 0.8, 0.4, -1.1, 'metal');
  for (let i = 0; i < 3; i++) W.cyl(0.18, 0.16, 0.22, 0.2 + i * 0.5, 0.92, -1.1, 0x8a8e94, { seg: 10, layer: 'metal' });
  W.cyl(0.16, 0.16, 0.02, 0.2, 1.03, -1.1, 0xc02a1a, { seg: 10 }); W.cyl(0.16, 0.16, 0.02, 0.7, 1.03, -1.1, 0xc8a060, { seg: 10 });   // tteokbokki, eomuk broth
  W.scope({ lod: 2 }, () => { for (let k = 0; k < 8; k++) W.rod([0.62 + k * 0.03, 1.0, -1.1], [0.62 + k * 0.035, 1.35, -1.0], 0.006, 0xd8c8a0); for (let k = 0; k < 4; k++) W.cyl(0.035, 0.035, 0.22, -0.8 + k * 0.12, 0.83, 0.5 + (k % 2) * 0.1, 0x2a8a4a, { seg: 6, layer: 'glass' }); W.cyl(0.12, 0.1, 0.05, -0.4, 0.75, 0.6, 0xe8e8e0, { seg: 10 }); });
  staffAt(0.8, -1.62, Math.PI, 'food');   // the cook
  plasticTable(-0.6, 0, 0.5, 0, 0x2a5aa0); for (const [a, b] of [[-1.3, 0.5], [0.1, 0.5], [-0.6, 1.2], [-0.6, -0.2]]) stool(a, 0, b, 0xc0302a);
  for (let i = 0; i < 6; i++) W.sphere(0.07, 0.07, 0.07, -1.9 + i * 0.75, 2.35, 0, 0xfff0c0, { layer: 'glow' });
  W.lamp(0, 2.2, 0, 0xffb060, 2.6, 7, { halo: 0.5 });
  NEON.sign('포장마차', 0, 2.1, 1.84, 2.4, 0.5, { style: 'box', col: 'red', pool: false, glow: false, lamp: false });
  W.pop();
  W.solid(4.6, 2.5, 0.1, x, 1.25, z - 1.8, 'cloth', { ry });
}
// utility pole with a transformer and the famous tangle of cables
// a pruned ginkgo in its iron grate, gone gold for the season, its leaves all over the pavement
function ginkgo(x, z) {
  W.box(1.2, 0.04, 1.2, x, 0.18, z, 0x2a2a2a, { layer: 'metal' });
  W.cyl(0.13, 0.17, 4.2, x, 2.2, z, 0x4a3a2e, { seg: 7 }); W.solid(0.4, 4, 0.4, x, 2, z, 'wood');
  W.scope({ lod: 1 }, () => {
    for (const [y, r, h] of [[3.6, 1.4, 1.8], [4.8, 1.2, 1.6], [5.9, 0.85, 1.4], [6.8, 0.45, 1.0]]) W.sphere(r * 2, h, r * 2, x + mr(-0.15, 0.15), y, z + mr(-0.15, 0.15), mpick([0xc8a028, 0xd0aa30, 0xb89020]), { seg: 7, hseg: 5, t: TX.leaf, layer: 'cloth' });
    for (const a of [0.6, 2.4, 4.3]) W.rod([x, 3.0, z], [x + Math.cos(a) * 0.9, 4.0, z + Math.sin(a) * 0.9], 0.05, 0x4a3a2e);
  });
  W.scope({ lod: 2 }, () => { for (let i = 0; i < 18; i++) W.box(0.07, 0.006, 0.06, x + mr(-2.2, 2.2), 0.17, z + mr(-1.4, 1.4), mpick([0xd8b030, 0xc89a20, 0xe0c040]), { ry: mr(0, 3), ao: false }); });
}
function utilityPole(x, z, cx = x, cz = z) {
  W.cyl(0.14, 0.18, 10, x, 5, z, 0x8a8a84, { seg: 8, t: TX.concrete }); W.solid(0.4, 10, 0.4, x, 5, z, 'concrete');
  // the street light bolted to it, leaning out over the lane: sodium orange on old poles, white LED on new
  const L = Math.hypot(cx - x, cz - z) || 1, ax = x + (cx - x) / L * 1.6, az = z + (cz - z) / L * 1.6, led = mchance(0.5);
  W.rod([x, 6.2, z], [ax, 6.6, az], 0.04, 0x6a6a64, { layer: 'metal' });
  W.box(0.5, 0.1, 0.22, ax, 6.58, az, 0x3a3a3c, { layer: 'metal', ry: Math.atan2(-(cz - z), cx - x) }); W.box(0.4, 0.03, 0.16, ax, 6.52, az, led ? 0xf0f4ff : 0xffc070, { layer: 'glow', ry: Math.atan2(-(cz - z), cx - x) });
  W.lamp(ax, 6.3, az, led ? 0xdce8ff : 0xffb060, 2.6, 14, { halo: 0.7 }); NEON.pool(ax, az, 3.6, led ? 0xdce8ff : 0xffb060, 0.38);
  W.box(0.3, 0.45, 0.02, x, 3.0, z, 0xe8e0c8, { lod: 2 });   // a flyer taped round it
  W.box(1.6, 0.12, 0.12, x, 9.2, z, 0x6a6a64, { layer: 'metal' });
  if (mchance(0.6)) W.cyl(0.32, 0.32, 0.9, x + 0.4, 7.6, z, 0x8a9094, { seg: 10, layer: 'metal' });
  W.scope({ lod: 2 }, () => { for (let i = 0; i < 4; i++) W.sphere(0.35, 0.3, 0.35, x + mr(-0.4, 0.4), 0.3, z + mr(-0.4, 0.4), mpick([0xe8e8e0, 0x2a2a2a, 0x3a6a8a]), { seg: 6, hseg: 4, layer: 'cloth' }); });
}
function seoulDressing() {
  const T = TOWN.lanes;
  // pojangmacha down the food alley
  for (let z = -22; z > -125; z -= 13) pojangmacha(mpick([-1.2, 1.2]), z, Math.PI / 2);
  for (const x of [-70, 0, 70]) for (const s of [-1, 1]) trafficLight(x + s * 9, 0.16, s * 10.5, s > 0 ? Math.PI : 0);
  for (const [name, st] of Object.entries(T)) {
    if (st.kind === 'road') continue;
    const poles = [];
    for (let s = 8; s < st.len - 4; s += 18) { const p = pathAt(st.pts, s), n = [-p.tz, p.tx], r = st.w / 2 - 0.35, side = Math.floor(s / 18) % 2 ? 1 : -1; const x = p.x + n[0] * r * side, z = p.z + n[1] * r * side; utilityPole(x, z, p.x, p.z); poles.push([x, z]); }
    W.defer(() => W.scope({ lod: 1 }, () => { for (let i = 1; i < poles.length; i++) for (let k = 0; k < 5; k++) W.cable([poles[i - 1][0], 8.6 + k * 0.18, poles[i - 1][1]], [poles[i][0], 8.6 + k * 0.18, poles[i][1]], 0.6 + k * 0.15, 0.015, 0x141414, 8); for (const [x, z] of poles) for (let k = 0; k < 2; k++) { const p2 = pathAt(st.pts, mr(2, st.len - 2)); W.cable([x, 8.2 - k * 0.6, z], [p2.x - p2.tz * (st.w / 2 + 0.1), mr(5, 8), p2.z + p2.tx * (st.w / 2 + 0.1)], 0.5, 0.012, 0x141414, 6); } }), 'mid', poles[0] || [0, 0]);
    // parked cars and delivery scooters along the residential lanes
    const taken = [];
    W.scope({ lod: 1 }, () => { for (let s = 12; s < st.len - 6; s += mr(14, 24)) { const p = pathAt(st.pts, s), side = mchance(0.5) ? 1 : -1, r = st.w / 2 - 1.1; taken.push([s, side]); if (st.w >= 6.5 && mchance(0.5)) sedan(p.x - p.tz * r * side, p.z + p.tx * r * side, Math.atan2(-p.tz, p.tx), mpick([0xe8e6e0, 0x2a2c30, 0x8a8e94, 0x1a2a4a, 0xc8c4bc])); else scooter(p.x - p.tz * (r + 0.4) * side, p.z + p.tx * (r + 0.4) * side, Math.atan2(-p.tz, p.tx) + 1.57, mpick([0xe8e6e0, 0xc8261e, 0x2a2a2a])); } });
    W.defer(() => kerbLife(name, st, taken), 'mid', [st.pts[0][0], st.pts[0][1]]);
  }
  W.scope({ lod: 1 }, () => {
    busShelter(40, 0.16, 10, Math.PI); busShelter(-40, 0.16, -10, 0);
  });
  // market square: stalls under lights, the station plaza: benches and a kiosk
  for (let i = 0; i < 6; i++) { const x = MARKET.x0 + 5 + (i % 3) * 11, z = MARKET.z0 + 8 + Math.floor(i / 3) * 12; marketStall(x, z, 0, mpick(['produce', 'fabric', 'spice'])); W.lamp(x, 2.4, z, 0xffd8a0, 1.8, 7, { halo: 0.5 }); }
  W.scope({ lod: 1 }, () => { for (let i = 0; i < 4; i++) bench(STATION.x0 + 6 + i * 6, 0, STATION.z1 - 2, Math.PI); kiosk(STATION.x1 - 6, 0, STATION.z0 + 6, 0); for (let i = 0; i < 3; i++) vendingMachine(STATION.x0 + 2, 0, STATION.z0 + 6 + i * 1.1, Math.PI / 2, mpick([0xc0302a, 0x2a5aa0])); });
  // strings of bulbs over the food alley and the bar street, banners across the lanes, cameras at the corners
  festoon(T.foodAlley, 4, T.foodAlley.len - 8, 4.6, 5, 0xffd890); festoon(T.barStreet, 4, T.barStreet.len - 8, 5.2, 6, 0xff9ad8); festoon(T.golmokN, 4, 60, 4.4, 6, 0xffe0a0);
  for (const [n, s2, t, c] of [['golmokS', 20, '불법주정차 단속', 'red'], ['villaLane1', 30, '쓰레기 무단투기 금지', 'blue'], ['barStreet', 90, '마포 불빛 축제', 'violet'], ['cross1', 60, '안전한 골목길', 'green'], ['villaLane3', 40, '어린이 보호구역', 'orange']]) laneBanner(T[n], s2, t, c);
  W.scope({ lod: 1 }, () => {
    for (const [x, z] of [[-73.8, -14], [3.6, -14], [73.8, -14], [-73.8, 14], [23.6, 14], [115.6, 14]]) cctvPole(x, z);
    for (const x of [-70, 0, 70]) for (const s of [-1, 1]) steelBollards(x - 4, s * 7.9, x + 4, s * 7.9, 1.6);
    bikeDock(-37, -10.6, 0, 5); bikeDock(98, 10.6, Math.PI, 5); bikeDock(-120, 10.6, Math.PI, 4);
  });
}
// whatever piles up against the buildings: bins, rubbish, gardens, bikes — never on a parked car's spot or a junction
function kerbLife(name, st, taken) {
  const villa = /villa|golmokS|cross2/.test(name), night = name === 'foodAlley' || name === 'barStreet';
  W.scope({ lod: 2 }, () => {
    for (let s = 6; s < st.len - 4; s += mr(4, 8)) {
      const side = mchance(0.5) ? 1 : -1;
      if (taken.some(([s2, sd]) => sd === side && Math.abs(s2 - s) < 3.2)) continue;
      const p = pathAt(st.pts, s), nx = -p.tz * side, nz = p.tx * side, r = st.w / 2 - 0.5;
      if (GR.get(p.x + nx * (st.w / 2 + 2), p.z + nz * (st.w / 2 + 2)) !== GR.BUILT) continue;   // only with a building behind
      const x = p.x + nx * r, z = p.z + nz * r, ry = Math.atan2(-nx, -nz), k = mrand();
      if (night) { if (k < 0.3) binBags(x, z); else if (k < 0.45) deliveryBike(x, z, ry + Math.PI / 2); else if (k < 0.55) recycleBins(x, z, ry); }
      else if (villa) { if (k < 0.22) styroGarden(x, z, ry, 2 + Math.floor(mrand() * 3)); else if (k < 0.36) binBags(x, z); else if (k < 0.48) recycleBins(x, z, ry); else if (k < 0.55) clothesBin(x, z, ry); else if (k < 0.68) bicycle(x, 0, z, ry + Math.PI / 2, mpick([0x2a5aa0, 0xc0302a, 0x2a2a2a, 0xe8e8e0])); else if (k < 0.75) deliveryBike(x, z, ry + Math.PI / 2); else if (k < 0.85) plantPot(x, 0, z, mpick(['ficus', 'geranium']), 1.5); }
      else { if (k < 0.25) binBags(x, z); else if (k < 0.4) recycleBins(x, z, ry); else if (k < 0.52) deliveryBike(x, z, ry + Math.PI / 2); else if (k < 0.6) styroGarden(x, z, ry, 2); else if (k < 0.7) bicycle(x, 0, z, ry + Math.PI / 2); }
    }
  });
}
// beyond the draw distance there's only rain and haze; N Seoul Tower stands lit on its hill to the north
function seoulSkyline() {
  // N Seoul Tower on the hill
  const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
  const tx = 60, tz = -980, ty = terrainH(tx, tz);
  const tw = new THREE.Group(); tw.position.set(tx, ty, tz); scene.add(tw);
  const wm = new THREE.MeshBasicMaterial({ color: 0x8a8ea0 }), lm = new THREE.MeshBasicMaterial({ color: 0xfff0e0, toneMapped: false });
  tw.add(at(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.4, 90, 12), wm), 0, 45, 0));
  tw.add(at(new THREE.Mesh(new THREE.CylinderGeometry(9, 7, 10, 20), new THREE.MeshBasicMaterial({ color: 0xc8d0ff, toneMapped: false })), 0, 92, 0));
  tw.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.6, 40, 8), wm), 0, 117, 0));
  tw.add(at(new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3a3a, toneMapped: false })), 0, 138, 0));
  for (let i = 0; i < 12; i++) tw.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), lm), Math.cos(i / 12 * Math.PI * 2) * 9.2, 92, Math.sin(i / 12 * Math.PI * 2) * 9.2));
  tw.scale.setScalar(1.8); tw.traverse((o) => { if (o.material) o.material.fog = false; });
}

// ---------------- street furniture of the Seoul kind ----------------
const STAND = { r: ['삼겹살', 'red'], b: ['생맥주', 'yellow'], n: ['노래방', 'pink'], c: ['커피', 'white'], k: ['편의점', 'green'], m: ['모텔', 'violet'] };
// soju crates: green bottles in plastic crates, stacked by the door
function sojuCrates(x, z, n = 2) {
  for (let i = 0; i < n; i++) {
    const y = i * 0.3, c = mpick([0x2a7a3a, 0x3a5aa0, 0xc0a020]);
    W.box(0.6, 0.3, 0.4, x, y + 0.15, z, c, { t: TX.none });
    for (let k = 0; k < 8; k++) W.cyl(0.035, 0.035, 0.24, x - 0.22 + (k % 4) * 0.145, y + 0.36, z - 0.09 + Math.floor(k / 4) * 0.18, mchance(0.8) ? 0x2a8a4a : 0x8a5a2a, { seg: 6, layer: 'glass' });
  }
}
// the round lit drum sign every restaurant wheels out at dusk
function standSign(x, z, kind) {
  const [t, c] = STAND[kind] || STAND.r, hex = NEONHEX[c];
  W.cyl(0.22, 0.22, 1.5, x, 0.85, z, shade(hex, 0.75), { seg: 12, layer: 'glow' });
  W.cyl(0.25, 0.25, 0.1, x, 0.05, z, 0x2a2a2a, { seg: 12 }); W.cyl(0.24, 0.24, 0.05, x, 1.62, z, 0x2a2a2a, { seg: 12 });
  NEON.sign(t, x, 0.88, z + 0.23, 0.32, 1.3, { style: 'box', col: c, vertical: true, pool: true, lamp: false });
}
// A-frame board with a scrolling LED panel
function aBoard(x, z, ry) {
  W.push(x, 0, z, ry);
  for (const s of [-1, 1]) W.box(0.6, 1.0, 0.03, 0, 0.5, s * 0.12, 0x1a1a1a, { rx: s * 0.13 });
  NEON.sign(mpick(GLASSNOTE), 0, 0.72, 0.19, 0.5, 0.16, { style: 'led', col: 'red', glow: false, lamp: false, pool: false });
  W.pop();
}
// white rubbish bags in a heap by a pole, recycling sacks, a crushed box
function binBags(x, z) {
  for (let i = 0; i < 4 + Math.floor(mrand() * 4); i++) W.sphere(mr(0.4, 0.6), mr(0.35, 0.5), mr(0.4, 0.55), x + mr(-0.6, 0.6), 0.2, z + mr(-0.4, 0.4), mpick([0xe8e8e0, 0xe0e4e8, 0xd8dcd0, 0x3a6a9a, 0x2a2a2a]), { seg: 6, hseg: 4, layer: 'cloth' });
  if (mchance(0.5)) W.box(0.6, 0.04, 0.5, x + mr(-0.5, 0.5), 0.03, z + mr(-0.3, 0.3), 0xb89a6a, { ry: mr(0, 3) });
}
function recycleBins(x, z, ry) {
  W.push(x, 0, z, ry);
  [0x2a6aa0, 0xe8c020, 0x2a8a4a].forEach((c, i) => { W.box(0.5, 0.9, 0.5, -0.55 + i * 0.55, 0.45, 0, c, { layer: 'metal' }); W.box(0.52, 0.06, 0.52, -0.55 + i * 0.55, 0.92, 0, shade(c, 0.7), { layer: 'metal' }); });
  W.pop(); W.solid(1.6, 0.95, 0.55, x, 0.47, z, 'metal', { ry });
}
// styrofoam boxes turned into gardens: chillies, spring onions, lettuce
function styroGarden(x, z, ry, n = 3) {
  W.push(x, 0, z, ry);
  for (let i = 0; i < n; i++) { const bx = -((n - 1) * 0.35) + i * 0.7; W.box(0.62, 0.32, 0.42, bx, 0.16, 0, 0xf0f0ec); for (let k = 0; k < 4; k++) W.cone(0.08, mr(0.25, 0.45), bx - 0.2 + k * 0.13, 0.5, mr(-0.1, 0.1), mpick([0x3a7a2a, 0x4a8a3a, 0x2a6a2a, 0x5a9a3a]), { seg: 5 }); }
  W.pop();
}
// the green clothing-donation bin, the delivery bike, the public-bike dock
function clothesBin(x, z, ry) { W.push(x, 0, z, ry); W.box(1.0, 1.6, 0.8, 0, 0.8, 0, 0x2a7a4a, { layer: 'metal', t: TX.metal, wear: 5 }); W.box(0.6, 0.3, 0.05, 0, 1.3, 0.41, 0x1a3a2a, { layer: 'metal' }); W.box(0.8, 0.25, 0.01, 0, 0.9, 0.41, 0xe8e8e0, { ao: false }); W.pop(); W.solid(1.0, 1.6, 0.8, x, 0.8, z, 'metal', { ry }); }
function deliveryBike(x, z, ry) {
  scooter(x, z, ry, mpick([0x2a2a2a, 0xe8e6e0, 0x2a5aa0]));
  W.push(x, 0, z, ry); W.box(0.5, 0.45, 0.45, -0.75, 1.15, 0, mpick([0x2ab0b0, 0xe8e8e0, 0xd83a2a, 0xe8a020]), { layer: 'metal' }); W.pop();
}
function bikeDock(x, z, ry, n = 5) {
  W.push(x, 0, z, ry);
  W.box(n * 0.75, 0.12, 0.3, 0, 0.06, -0.6, 0x5a5e62, { layer: 'metal' });
  for (let i = 0; i < n; i++) { const bx = -(n - 1) * 0.375 + i * 0.75; W.box(0.12, 0.8, 0.12, bx, 0.4, -0.6, 0x3a3e42, { layer: 'metal' }); W.box(0.06, 0.06, 0.02, bx, 0.7, -0.53, 0x40ff7a, { layer: 'glow' }); if (mchance(0.75)) bicycle(bx, 0, 0, Math.PI / 2, 0x3aa04a); }
  W.pop();
}
function cctvPole(x, z) {
  W.cyl(0.08, 0.1, 5.5, x, 2.75, z, 0x8a8e94, { seg: 8, layer: 'metal' });
  for (const a of [0, 2.1, 4.2]) { W.push(x, 5.2, z, a); W.box(0.12, 0.12, 0.35, 0, 0, 0.22, 0xe8e8e0, { layer: 'metal' }); W.box(0.02, 0.02, 0.01, 0, 0.03, 0.4, 0xff2020, { layer: 'glow' }); W.pop(); }
  W.box(0.5, 0.35, 0.03, x, 3.2, z + 0.1, 0xe8c020, { layer: 'metal' }); W.box(0.4, 0.06, 0.01, x, 3.25, z + 0.12, 0x1a1a1a, { ao: false });
}
function steelBollards(x0, z0, x1, z1, step = 1.6) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.floor(L / step));
  for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; W.cyl(0.08, 0.08, 0.8, x, 0.4, z, 0x8a8e94, { seg: 8, layer: 'metal' }); W.cyl(0.085, 0.085, 0.08, x, 0.65, z, 0xe8c020, { seg: 8, layer: 'glow' }); }
}
// festoon bulbs zig-zagging across a lane between the shopfronts
function festoon(st, s0, s1, h = 4.4, step = 5, col = 0xffd890) {
  W.defer(() => W.scope({ lod: 1 }, () => {
    let side = 1, prev = null;
    for (let s = s0; s <= s1; s += step) {
      const p = pathAt(st.pts, s), r = st.w / 2 + 0.2, pt = [p.x - p.tz * r * side, h + mr(-0.2, 0.2), p.z + p.tx * r * side];
      if (prev) { W.cable(prev, pt, 0.5, 0.008, 0x141414, 8); for (let k = 1; k < 6; k++) { const t = k / 6; W.sphere(0.06, 0.08, 0.06, prev[0] + (pt[0] - prev[0]) * t, prev[1] + (pt[1] - prev[1]) * t - Math.sin(t * Math.PI) * 0.5 - 0.08, prev[2] + (pt[2] - prev[2]) * t, col, { layer: 'glow', seg: 5, hseg: 3 }); } }
      if (Math.floor((s - s0) / step) % 2 === 0) W.lamp(p.x, h - 0.5, p.z, col, 1.8, 7, { halo: 0.3 });
      prev = pt; side = -side;
    }
  }), 'mid', [pathAt(st.pts, s0).x, pathAt(st.pts, s0).z]);
}
// a printed cloth banner strung across the lane
function laneBanner(st, s, text, col) {
  const p = pathAt(st.pts, s), r = st.w / 2 + 0.1;
  W.push(p.x, 0, p.z, Math.atan2(-p.tx, -p.tz));   // local x across the lane
  W.box(st.w, 0.9, 0.02, 0, 5.2, 0, 0xece6da, { layer: 'cloth', lod: 1 });
  NEON.sign(text, 0, 5.2, 0.015, st.w - 0.2, 0.8, { style: 'banner', col, back: true });
  for (const sx of [-1, 1]) W.rod([sx * st.w / 2, 5.6, 0], [sx * (r + 0.1), 6.0, 0], 0.006, 0x1a1a1a);
  W.pop();
}
// ---------------- the konbini's insides ----------------
const PROMO = { '1+1': 'red', '2+1': 'orange', '행사': 'yellow', 'NEW': 'red' };
// a double-sided gondola run along z: four shelves a side, each stocked by theme, price rails, a promo end cap
function gondola(x, z0, z1, themes) {
  const L = z1 - z0, zc = (z0 + z1) / 2, h = 1.55;
  W.box(0.12, h, L, x, h / 2 + 0.12, zc, 0xe8e8e4, { layer: 'metal' }); W.solid(1.1, h, L, x, h / 2 + 0.12, zc, 'metal');
  W.box(1.1, 0.12, L, x, 0.18, zc, 0xd0d0cc, { layer: 'metal' });
  for (const s of [-1, 1]) for (let lv = 0; lv < 4; lv++) {
    const y = 0.26 + lv * 0.36, sx = x + s * 0.3;
    W.box(0.48, 0.02, L, sx, y, zc, 0xf0f0ec, { layer: 'metal' });
    W.box(0.02, 0.05, L, x + s * 0.55, y + 0.01, zc, 0xf8e040, { layer: 'metal', lod: 2 });   // price rail
    W.scope({ lod: 2 }, () => konbiniGoods(sx, y + 0.01, z0 + 0.05, z1 - 0.05, s, themes[(lv + (s > 0 ? 1 : 0)) % themes.length]));
  }
  for (const ez of [z0 - 0.35, z1 + 0.35]) { W.box(1.0, 0.3, 0.6, x, 0.27, ez, 0xe8e8e4, { layer: 'metal' }); W.solid(1.0, 1.2, 0.6, x, 0.72, ez, 'metal'); W.box(0.06, 1.5, 0.06, x, 1.0, ez + (ez < zc ? 0.27 : -0.27), 0xd8d8d8, { layer: 'metal' }); const c = mpick([0xd8302a, 0xe8a020, 0x2a6ab0, 0x3a9a4a]); W.scope({ lod: 2 }, () => { for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - r; k++) for (let j = 0; j < 2; j++) W.box(0.28, 0.24, 0.26, x - (2 - r) * 0.15 + k * 0.3, 0.54 + r * 0.25, ez - 0.14 + j * 0.28, mchance(0.8) ? c : 0xe8e8e0); }); W.push(x, 0, ez, ez < zc ? Math.PI : 0); { const t = mpick(['1+1', '2+1', '행사', 'NEW']); NEON.sign(t, 0, 1.75, 0.26, 0.8, 0.28, { style: 'box', col: PROMO[t], back: true, glow: false, pool: false, lamp: false }); } W.pop(); }
}
function konbiniGoods(x, y, z0, z1, side, theme) {
  let z = z0;
  while (z < z1 - 0.1) {
    if (theme === 'ramen') { const c = mpick([0xd8302a, 0xe8a020, 0xc82a2a, 0xf0e0c0, 0x2a2a2a]), n = 3; for (let k = 0; k < n; k++) W.cyl(0.055, 0.045, 0.1, x + side * (0.18 - k * 0.12), y + 0.05, z + 0.06, c, { seg: 8 }); W.cyl(0.056, 0.056, 0.012, x + side * 0.18, y + 0.105, z + 0.06, 0xe8e8e0, { seg: 8 }); z += 0.13; }
    else if (theme === 'packs') { const c = mpick([0xd8302a, 0xe8a020, 0x2a6ab0, 0x2a9a4a, 0x8a2a8a, 0xf0d020]); W.box(0.42, 0.14, 0.16, x, y + 0.07, z + 0.09, c); W.box(0.43, 0.04, 0.17, x, y + 0.11, z + 0.09, 0xe8e8e0); z += 0.19; }
    else if (theme === 'snacks') { const c = mpick([0xe8402a, 0xf0c020, 0x2a8ad8, 0x3ac04a, 0xd82a8a, 0xf08020]); W.box(0.06, 0.26, 0.2, x + side * 0.15, y + 0.14, z + 0.11, c, { rx: mr(-0.1, 0.1) }); W.box(0.06, 0.26, 0.2, x - side * 0.05, y + 0.14, z + 0.11, c, { rx: mr(-0.1, 0.1) }); z += 0.22; }
    else if (theme === 'bottles') { const c = mpick([0x2a8a4a, 0xd8a020, 0x8ac0e0, 0xe8e8e8, 0xc02a2a]); for (let k = 0; k < 3; k++) W.cyl(0.035, 0.035, 0.24, x + side * (0.18 - k * 0.1), y + 0.12, z + 0.04, c, { seg: 6, layer: 'glass' }); z += 0.085; }
    else { const c = mpick([0xe8e8e0, 0x8ac0e0, 0xd8c8a0, 0xe8a0b0, 0x2a5aa0]); W.box(0.3, mr(0.15, 0.3), 0.2, x, y + 0.1, z + 0.11, c); z += 0.24; }
  }
}
// the corner of the counter that sells cigarettes, lottery and hot buns
function konbiniCounterWall(x, z0, z1) {
  W.box(0.05, 1.2, z1 - z0, x, 1.95, (z0 + z1) / 2, 0xe8e0d0, { layer: 'glow' });
  W.scope({ lod: 2 }, () => { for (let r = 0; r < 6; r++) for (let z = z0 + 0.06; z < z1 - 0.05; z += 0.075) W.box(0.06, 0.12, 0.055, x - 0.05, 1.45 + r * 0.19, z, mpick([0xe8e8e0, 0x2a2a6a, 0xd82a2a, 0x2a2a2a, 0xd8c040, 0x3a8a8a])); });
  W.push(x - 0.06, 0, (z0 + z1) / 2, -Math.PI / 2); NEON.sign('담배', 0, 2.75, 0, 1.2, 0.3, { style: 'box', col: 'blue', glow: false, pool: false, lamp: false }); W.pop();
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
      const inn = indoors();
      HEMI.intensity += ((inn ? 0.95 : 0.35) - HEMI.intensity) * Math.min(1, dt * 4);   // under a roof the room's own light fills in
      if (mesh) mesh.visible = !inn;
      if (inn) return;
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
