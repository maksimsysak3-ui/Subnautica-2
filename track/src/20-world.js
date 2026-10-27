// =====================================================================
//  Renderer, sky, lighting, procedural textures
// =====================================================================
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.62;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 9000);
scene.fog = new THREE.Fog(0xb9c8d6, 900, 5200);

const sky = new Sky();
sky.scale.setScalar(20000);
scene.add(sky);
const skyU = sky.material.uniforms;
skyU.turbidity.value = 6; skyU.rayleigh.value = 1.4; skyU.mieCoefficient.value = 0.004; skyU.mieDirectionalG.value = 0.82;

const sun = new THREE.DirectionalLight(0xffffff, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
const SH = 90;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 900 });
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x3d4a2a, 0.75);
scene.add(hemi);

const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
const envSky = new Sky();
envSky.scale.setScalar(1000);
envScene.add(envSky);
let envRT = null;
const sunDir = new THREE.Vector3();

function applyTimeOfDay(tod) {
  const dayT = clamp((tod - 6) / 13.5, 0, 1);
  const elev = Math.sin(dayT * Math.PI) * 58 + 2;               // degrees above horizon
  const azim = lerp(100, 260, dayT);
  sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), THREE.MathUtils.degToRad(azim));
  for (const u of [skyU, envSky.material.uniforms]) {
    u.sunPosition.value.copy(sunDir);
    u.turbidity.value = elev < 12 ? 5 : 3.2; u.rayleigh.value = elev < 12 ? 2.8 : 2.0;
    u.mieCoefficient.value = 0.003; u.mieDirectionalG.value = 0.85;
  }
  const low = clamp(1 - (elev - 4) / 26, 0, 1);                 // 1 near the horizon
  sun.color.setRGB(1, lerp(0.97, 0.72, low), lerp(0.92, 0.5, low));
  sun.intensity = lerp(2.9, 1.5, low);
  hemi.intensity = lerp(0.35, 0.25, low);
  scene.fog.color.setRGB(lerp(0.62, 0.86, low), lerp(0.72, 0.62, low), lerp(0.84, 0.5, low));
  renderer.toneMappingExposure = lerp(0.5, 0.62, low);
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(envScene, 0, 0.1, 2000);
  scene.environment = envRT.texture;
}

// --- textures -------------------------------------------------------
function canvasTex(size, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = MAX_ANISO;
  return t;
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function speckle(g, n, size, cols, rMin, rMax, rnd) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = cols[(rnd() * cols.length) | 0];
    const r = rMin + rnd() * (rMax - rMin);
    g.globalAlpha = 0.25 + rnd() * 0.6;
    g.fillRect(rnd() * size, rnd() * size, r, r);
  }
  g.globalAlpha = 1;
}
const TEX = {
  asphalt: canvasTex(512, (g, s) => {
    const r = rng(7);
    g.fillStyle = '#3a3c40'; g.fillRect(0, 0, s, s);
    speckle(g, 26000, s, ['#2a2b2e', '#4a4c51', '#56585e', '#202124', '#5f6166'], 1, 2.4, r);
    // Faint long-wavelength blotches so it doesn't look tiled.
    for (let i = 0; i < 40; i++) {
      g.globalAlpha = 0.05; g.fillStyle = r() < 0.5 ? '#000' : '#888';
      g.beginPath(); g.arc(r() * s, r() * s, 20 + r() * 70, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  }),
  rubber: canvasTex(256, (g, s) => {
    // Darker rubbered-in racing line: transparent at the edges.
    const grd = g.createLinearGradient(0, 0, s, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.5, 'rgba(10,10,12,.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
  }),
  grass: canvasTex(512, (g, s) => {
    const r = rng(3);
    g.fillStyle = '#41612a'; g.fillRect(0, 0, s, s);
    speckle(g, 30000, s, ['#36541f', '#4f6f30', '#5a7b36', '#2e481a', '#63823e'], 1, 3, r);
  }),
  mowed: canvasTex(512, (g, s) => {
    // Lawn-mower stripes for the verges near the circuit.
    const r = rng(5);
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#3f6624' : '#46702a'; g.fillRect(0, (i * s) / 4, s, s / 4); }
    speckle(g, 22000, s, ['#36591e', '#527d31', '#3e6623', '#5a8838'], 1, 2.5, r);
  }),
  gravel: canvasTex(512, (g, s) => {
    const r = rng(11);
    g.fillStyle = '#b9a77f'; g.fillRect(0, 0, s, s);
    speckle(g, 40000, s, ['#a3916b', '#cbbb94', '#8c7c5a', '#d8cba8', '#9a8a66'], 1.5, 3.5, r);
  }),
  runoff: canvasTex(512, (g, s) => {
    const r = rng(13);
    g.fillStyle = '#4a5466'; g.fillRect(0, 0, s, s);
    speckle(g, 22000, s, ['#3f4858', '#58637a', '#384050', '#626d84'], 1, 2.2, r);
  }),
  kerb: canvasTex(256, (g, s) => {
    g.fillStyle = '#d4140c'; g.fillRect(0, 0, s, s / 2);
    g.fillStyle = '#f2f2f2'; g.fillRect(0, s / 2, s, s / 2);
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 0, s * 0.08, s);
  }),
  sausage: canvasTex(128, (g, s) => {
    g.fillStyle = '#f3c211'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, s, s * 0.18);
  }),
  barrier: canvasTex(256, (g, s) => {
    // Tecpro-style blocks: red / white with a blue band.
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#e8e8e8' : '#c4161c'; g.fillRect((i * s) / 4, 0, s / 4, s); }
    g.fillStyle = '#1d3f9a'; g.fillRect(0, s * 0.38, s, s * 0.16);
    g.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 4; i++) g.fillRect((i * s) / 4, 0, 2, s);
  }),
  fence: canvasTex(256, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.strokeStyle = 'rgba(200,205,210,.55)'; g.lineWidth = 1.2;
    for (let i = -s; i < s * 2; i += 10) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke(); g.beginPath(); g.moveTo(i, s); g.lineTo(i + s, 0); g.stroke(); }
    g.fillStyle = '#7d8288'; g.fillRect(0, 0, 7, s); g.fillRect(0, 0, s, 5); g.fillRect(0, s - 5, s, 5);
  }),
  checker: canvasTex(256, (g, s) => {
    const n = 8;
    for (let y = 0; y < 2; y++) for (let x = 0; x < n; x++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4'; g.fillRect((x * s) / n, (y * s) / 2, s / n, s / 2); }
  }),
};

const MAT = {
  road: new THREE.MeshStandardMaterial({ map: TEX.asphalt, roughness: 0.92, metalness: 0 }),
  rubber: new THREE.MeshStandardMaterial({ map: TEX.rubber, transparent: true, depthWrite: false, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2 }),
  line: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3 }),
  kerb: new THREE.MeshStandardMaterial({ map: TEX.kerb, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -1 }),
  sausage: new THREE.MeshStandardMaterial({ map: TEX.sausage, roughness: 0.5 }),
  [SURF.asphalt]: new THREE.MeshStandardMaterial({ map: TEX.runoff, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1 }),
  [SURF.gravel]: new THREE.MeshStandardMaterial({ map: TEX.gravel, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }),
  [SURF.grass]: new THREE.MeshStandardMaterial({ map: TEX.mowed, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }),
  verge: new THREE.MeshStandardMaterial({ map: TEX.mowed, roughness: 1 }),
  barrier: new THREE.MeshStandardMaterial({ map: TEX.barrier, roughness: 0.6, side: THREE.DoubleSide }),
  fence: new THREE.MeshStandardMaterial({ map: TEX.fence, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4 }),
  terrain: new THREE.MeshStandardMaterial({ map: TEX.grass, roughness: 1, vertexColors: true }),
  checker: new THREE.MeshStandardMaterial({ map: TEX.checker, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4 }),
  white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3 }),
};

// =====================================================================
//  Track geometry
// =====================================================================
const trackGroup = new THREE.Group();
const terrainGroup = new THREE.Group();
const sceneryGroup = new THREE.Group();
scene.add(terrainGroup, trackGroup, sceneryGroup);

function disposeGroup(g) {
  for (const o of [...g.children]) {
    g.remove(o);
    o.traverse((c) => { if (c.geometry) c.geometry.dispose(); });
  }
}

// Ribbon along the track on one side. inner/outer give |offset| from the centreline,
// profile maps 0..1 across the strip to a height above the road surface plane.
function ribbon({ side, inner, outer, mask = () => true, profile = () => 0.005, across = 1, vLen = 10, uLen = 0, mat, cast = false }) {
  const n = S.n, k = side > 0 ? 0 : 1;
  const pos = [], uv = [], ind = [];
  const ring = across + 1;
  let verts = 0;
  const emit = (i, distAlong) => {
    const a = Math.min(inner(i), S.lim[k][i] - 0.05), b = Math.min(outer(i), S.lim[k][i]);
    for (let c = 0; c <= across; c++) {
      const f = c / across;
      const d = side * lerp(a, Math.max(a + 0.01, b), f);
      pos.push(S.px[i] + leftX(i) * d, crossY(i, d) + profile(f, i), S.pz[i] + leftZ(i) * d);
      uv.push(uLen ? (Math.abs(d) / uLen) : (side > 0 ? 1 - f : f), distAlong / vLen);
    }
    verts++;
  };
  const strip = () => {
    const base = pos.length / 3 / ring - verts;
    for (let r = 0; r < verts - 1; r++) for (let c = 0; c < across; c++) {
      const a = (base + r) * ring + c, b = a + ring;
      if (side > 0) ind.push(a, b, a + 1, a + 1, b, b + 1); else ind.push(a, a + 1, b, a + 1, b + 1, b);
    }
    verts = 0;
  };
  // Start on an unmasked sample so runs that span the start line aren't split.
  let start = 0;
  if (S.closed) { start = -1; for (let i = 0; i < n; i++) if (!mask(i)) { start = i; break; } }
  const full = start < 0;
  if (full) start = 0;
  const total = S.closed ? n + (full ? 1 : 0) : n;
  for (let o = 0; o < total; o++) {
    const i = (start + o) % n;
    if (mask(i)) emit(i, (start + o) * S.step);
    else if (verts) { emit(i, (start + o) * S.step); strip(); }
  }
  if (verts > 1) strip(); else verts = 0;
  if (!ind.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ind);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true; m.castShadow = cast;
  return m;
}

function buildTrackMeshes() {
  disposeGroup(trackGroup);
  if (!S) return;
  const add = (m) => m && trackGroup.add(m);
  const half = (i) => S.w[i] / 2;
  const edge = (k) => (i) => half(i) + (S.kerb[k][i] ? KERB_W : 0);
  for (const side of [1, -1]) {
    const k = side > 0 ? 0 : 1;
    // Road half (two halves meet at the centre so each can clamp on the inside of a bend).
    add(ribbon({ side, inner: () => 0, outer: half, profile: () => 0, vLen: 9, mat: MAT.road, across: 2 }));
    add(ribbon({ side, inner: (i) => half(i) - 0.55, outer: (i) => half(i) - 0.25, profile: () => 0.004, mat: MAT.line }));
    // Kerbs: flat ones sit just proud of the road and tilt up outward; raised ones add a yellow sausage behind.
    add(ribbon({
      side, inner: half, outer: (i) => half(i) + KERB_W, mask: (i) => S.kerb[k][i] > 0, across: 3, vLen: 3.2, mat: MAT.kerb,
      profile: (f, i) => (S.kerb[k][i] === 2 ? 0.02 + Math.sin(f * Math.PI * 0.85) * 0.07 : 0.012 + f * 0.05),
    }));
    add(ribbon({
      side, inner: (i) => half(i) + KERB_W, outer: (i) => half(i) + KERB_W + 0.55, mask: (i) => S.kerb[k][i] === 2, across: 4, vLen: 1.4,
      mat: MAT.sausage, profile: (f) => 0.02 + Math.sin(f * Math.PI) * 0.16, cast: true,
    }));
    // Painted run-off by surface, then mowed grass out to the barrier everywhere else.
    for (const code of [SURF.asphalt, SURF.gravel, SURF.grass]) {
      add(ribbon({
        side, inner: edge(k), outer: (i) => edge(k)(i) + S.runW[k][i], mask: (i) => S.runW[k][i] > 0.5 && S.runS[k][i] === code,
        uLen: 8, vLen: 8, mat: MAT[code], profile: () => 0.0,
      }));
    }
    add(ribbon({ side, inner: half, outer: (i) => S.bar[k][i] + 3, uLen: 12, vLen: 12, mat: MAT.verge, profile: () => -0.03 }));
    if (state.settings.barriers && S.closed) {
      add(ribbonWall(side, (i) => S.bar[k][i], 0, 1.05, MAT.barrier, 1.0));
      add(ribbonWall(side, (i) => S.bar[k][i] + 0.4, 1.05, 3.6, MAT.fence, 4));
    }
  }
  add(rubberLine());
  if (S.closed) buildStartLine();
}

// Vertical wall (barrier / fence) following an offset line.
function ribbonWall(side, off, y0, y1, mat, vLen) {
  const k = side > 0 ? 0 : 1, n = S.n;
  const pos = [], uv = [], ind = [];
  const count = S.closed ? n + 1 : n;
  for (let o = 0; o < count; o++) {
    const i = o % n;
    const d = side * Math.min(off(i), S.lim[k][i]);
    const x = S.px[i] + leftX(i) * d, z = S.pz[i] + leftZ(i) * d, y = crossY(i, d);
    pos.push(x, y + y0, z, x, y + y1, z);
    uv.push((o * S.step) / vLen, 0, (o * S.step) / vLen, 1);
    if (o) { const a = (o - 1) * 2; ind.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ind); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.castShadow = mat === MAT.barrier; m.receiveShadow = true;
  return m;
}

// A darker rubbered racing line that swings to the outside before corners and clips the apex.
let racingLine = null;   // Float32Array of lateral offsets, reused by the minimap
function computeRacingLine() {
  const n = S.n;
  const off = new Float32Array(n);
  const idx = (i) => (S.closed ? (i + n) % n : clamp(i, 0, n - 1));
  // Look-ahead curvature: positive ahead => go right (outside) before, left (inside) at apex.
  for (let i = 0; i < n; i++) {
    let ahead = 0, here = 0;
    for (let o = 6; o <= 30; o++) ahead += S.k[idx(i + o)];
    for (let o = -4; o <= 4; o++) here += S.k[idx(i + o)];
    const lim = S.w[i] / 2 - 1.4;
    off[i] = clamp(here * 9 * 60 - ahead * 60 * 0.9, -1, 1) * lim;
  }
  for (let pass = 0; pass < 6; pass++) {
    const t = Float32Array.from(off);
    for (let i = 0; i < n; i++) off[i] = (t[idx(i - 2)] + t[idx(i - 1)] * 2 + t[i] * 3 + t[idx(i + 1)] * 2 + t[idx(i + 2)]) / 9;
  }
  racingLine = off;
}
function rubberLine() {
  computeRacingLine();
  const n = S.n, pos = [], uv = [], ind = [];
  const count = S.closed ? n + 1 : n;
  for (let o = 0; o < count; o++) {
    const i = o % n;
    for (const f of [-1, 1]) {
      const d = racingLine[i] + f * 1.4;
      pos.push(S.px[i] + leftX(i) * d, crossY(i, d) + 0.003, S.pz[i] + leftZ(i) * d);
      uv.push(f < 0 ? 0 : 1, o * 0.1);
    }
    if (o) { const a = (o - 1) * 2; ind.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ind); g.computeVertexNormals();
  const m = new THREE.Mesh(g, MAT.rubber);
  m.receiveShadow = true;
  return m;
}

// Chequered start/finish line plus painted grid slots behind it.
function buildStartLine() {
  const flat = (i, along0, along1, d0, d1, mat, lift) => {
    const pts = [];
    const ax = S.tx[i], az = S.tz[i];
    for (const [a, d] of [[along0, d0], [along1, d0], [along1, d1], [along0, d1]]) {
      const x = S.px[i] + ax * a + leftX(i) * d, z = S.pz[i] + az * a + leftZ(i) * d;
      pts.push(x, crossY(i, d) + lift, z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, S.w[i] / 2.2, 1, S.w[i] / 2.2, 0], 2));
    g.setIndex([0, 2, 1, 0, 3, 2]);
    g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) g.setIndex([0, 1, 2, 0, 2, 3]), g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    trackGroup.add(m);
  };
  const w = S.w[0] / 2 - 0.3;
  flat(0, -0.6, 0.6, -w, w, MAT.checker, 0.006);
  for (let slot = 0; slot < 6; slot++) {
    const back = 10 + slot * 8;
    const i = (S.n - Math.round(back / S.step)) % S.n;
    const lat = (slot % 2 ? -1 : 1) * Math.min(3.2, S.w[i] / 4);
    flat(i, -0.15, 0.15, lat - 1.2, lat + 1.2, MAT.white, 0.006);
    flat(i, -2.5, 0.15, lat + (lat > 0 ? 1.1 : -1.3), lat + (lat > 0 ? 1.3 : -1.1), MAT.white, 0.006);
  }
}

// =====================================================================
//  Terrain: gentle hills that blend into the circuit
// =====================================================================
let terrain = null; // {x0,z0,cell,nx,nz,h:Float32Array}
function hills(x, z) {
  return Math.sin(x * 0.0041 + 1.3) * Math.cos(z * 0.0037 - 0.4) * 14 + Math.sin(x * 0.011 + z * 0.008) * 4 + Math.cos(z * 0.019 - x * 0.006) * 1.5 + 3;
}
function buildTerrain() {
  disposeGroup(terrainGroup);
  let minX = -300, maxX = 300, minZ = -300, maxZ = 300;
  if (S) {
    minX = Infinity; maxX = -Infinity; minZ = Infinity; maxZ = -Infinity;
    for (let i = 0; i < S.n; i++) { minX = Math.min(minX, S.px[i]); maxX = Math.max(maxX, S.px[i]); minZ = Math.min(minZ, S.pz[i]); maxZ = Math.max(maxZ, S.pz[i]); }
  }
  const M = 900;
  minX -= M; maxX += M; minZ -= M; maxZ += M;
  const cell = Math.max(6, Math.max(maxX - minX, maxZ - minZ) / 260);
  const nx = Math.ceil((maxX - minX) / cell) + 1, nz = Math.ceil((maxZ - minZ) / cell) + 1;
  const h = new Float32Array(nx * nz);
  const dist = new Float32Array(nx * nz).fill(1e9);
  const tgt = new Float32Array(nx * nz);
  const R = 140;
  if (S) {
    const rc = Math.ceil(R / cell);
    for (let i = 0; i < S.n; i++) {
      const cx = Math.round((S.px[i] - minX) / cell), cz = Math.round((S.pz[i] - minZ) / cell);
      for (let gz = Math.max(0, cz - rc); gz <= Math.min(nz - 1, cz + rc); gz++) {
        for (let gx = Math.max(0, cx - rc); gx <= Math.min(nx - 1, cx + rc); gx++) {
          const x = minX + gx * cell, z = minZ + gz * cell;
          const dx = x - S.px[i], dz = z - S.pz[i];
          const d2 = dx * dx + dz * dz;
          const id = gz * nx + gx;
          if (d2 < dist[id]) {
            dist[id] = d2;
            const lat = dx * leftX(i) + dz * leftZ(i);
            const k = lat > 0 ? 0 : 1;
            const lim = Math.min(S.bar[k][i] + 3, S.lim[k][i]);
            tgt[id] = crossY(i, Math.sign(lat) * Math.min(Math.abs(lat), lim)) - 0.35;
          }
        }
      }
    }
  }
  const col = new Float32Array(nx * nz * 3);
  const pos = new Float32Array(nx * nz * 3);
  for (let gz = 0; gz < nz; gz++) for (let gx = 0; gx < nx; gx++) {
    const id = gz * nx + gx;
    const x = minX + gx * cell, z = minZ + gz * cell;
    const d = Math.sqrt(dist[id]);
    const base = hills(x, z);
    // Flat apron next to the circuit, then a smooth rise into the hills.
    const near = S ? 1 - smooth01(clamp((d - 30) / (R - 30), 0, 1)) : 0;
    h[id] = near > 0 ? lerp(base, tgt[id], near) : base;
    pos[id * 3] = x; pos[id * 3 + 1] = h[id]; pos[id * 3 + 2] = z;
    const v = 0.78 + 0.22 * Math.sin(x * 0.03) * Math.cos(z * 0.027) + (h[id] - 3) * 0.006;
    col[id * 3] = v * 0.96; col[id * 3 + 1] = v; col[id * 3 + 2] = v * 0.86;
  }
  const ind = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let p = 0;
  for (let gz = 0; gz < nz - 1; gz++) for (let gx = 0; gx < nx - 1; gx++) {
    const a = gz * nx + gx, b = a + 1, c = a + nx, d = c + 1;
    ind[p++] = a; ind[p++] = c; ind[p++] = b; ind[p++] = b; ind[p++] = c; ind[p++] = d;
  }
  const uvs = new Float32Array(nx * nz * 2);
  for (let i = 0; i < nx * nz; i++) { uvs[i * 2] = pos[i * 3] / 14; uvs[i * 2 + 1] = pos[i * 3 + 2] / 14; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(new THREE.BufferAttribute(ind, 1));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, MAT.terrain);
  m.receiveShadow = true;
  m.name = 'terrain';
  terrainGroup.add(m);
  // Far ground ring so the horizon never shows a hard edge.
  const far = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000).rotateX(-Math.PI / 2), MAT.terrain);
  far.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(4 * 3).fill(0.8), 3));
  far.position.y = -6;
  terrainGroup.add(far);
  terrain = { x0: minX, z0: minZ, cell, nx, nz, h, dist };
}
function terrainHeight(x, z) {
  if (!terrain) return 0;
  const { x0, z0, cell, nx, nz, h } = terrain;
  const fx = clamp((x - x0) / cell, 0, nx - 1.001), fz = clamp((z - z0) / cell, 0, nz - 1.001);
  const gx = Math.floor(fx), gz = Math.floor(fz), tx = fx - gx, tz = fz - gz;
  const a = h[gz * nx + gx], b = h[gz * nx + gx + 1], c = h[(gz + 1) * nx + gx], d = h[(gz + 1) * nx + gx + 1];
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}
function distToTrack(x, z) {
  if (!terrain) return 1e9;
  const { x0, z0, cell, nx, nz, dist } = terrain;
  const gx = Math.round((x - x0) / cell), gz = Math.round((z - z0) / cell);
  if (gx < 0 || gz < 0 || gx >= nx || gz >= nz) return 1e9;
  return Math.sqrt(dist[gz * nx + gx]);
}

// =====================================================================
//  Scenery: forests, grandstands, pit building, gantry, marshal posts
// =====================================================================
function buildScenery() {
  disposeGroup(sceneryGroup);
  if (!S || !state.settings.scenery) return;
  const r = rng(Math.round(S.L));
  // --- trees (instanced) ---
  const trunkG = new THREE.CylinderGeometry(0.22, 0.32, 3, 6).translate(0, 1.5, 0);
  const pineG = mergeGeoms([new THREE.ConeGeometry(2.6, 6, 7).translate(0, 5, 0), new THREE.ConeGeometry(2.0, 5, 7).translate(0, 7.6, 0)]);
  const leafG = new THREE.IcosahedronGeometry(3.2, 1).translate(0, 5.4, 0);
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x4a3622, roughness: 1 });
  const pineM = new THREE.MeshStandardMaterial({ color: 0x2c4a22, roughness: 0.95, flatShading: true });
  const leafM = new THREE.MeshStandardMaterial({ color: 0x4d6e2a, roughness: 0.95, flatShading: true });
  const spots = [];
  const { x0, z0, cell, nx, nz } = terrain;
  const W = (nx - 1) * cell, D = (nz - 1) * cell;
  for (let tries = 0; tries < 26000 && spots.length < 2600; tries++) {
    const x = x0 + r() * W, z = z0 + r() * D;
    const d = distToTrack(x, z);
    if (d < 34) continue;
    // Forest clumps from low-frequency noise; sparse elsewhere.
    const forest = Math.sin(x * 0.006 + 2) * Math.cos(z * 0.0055 - 1) + Math.sin(x * 0.017 - z * 0.013) * 0.4;
    if (forest < 0.25 && r() > 0.06) continue;
    if (d > 1100) continue;
    spots.push([x, terrainHeight(x, z) - 0.2, z, 0.7 + r() * 0.75, r() * 6.28, r() < 0.6]);
  }
  const pines = spots.filter((s) => s[5]), leafy = spots.filter((s) => !s[5]);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  const inst = (geo, mat, list, shadow) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((s, i) => {
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, s[4]); sc.setScalar(s[3]); ps.set(s[0], s[1], s[2]);
      im.setMatrixAt(i, mtx.compose(ps, q, sc));
    });
    im.castShadow = shadow; im.receiveShadow = true;
    sceneryGroup.add(im);
  };
  inst(trunkG, trunkM, spots, false);
  inst(pineG, pineM, pines, true);
  inst(leafG, leafM, leafy, true);

  if (!S.closed) return;
  // --- start/finish straight furniture ---
  // Skip anything that would land on (or too close to) another part of the circuit.
  const clear = (x, z, off) => distToTrack(x, z) > off * 0.75;
  const placeAlong = (i, side, off, obj, len = 0) => {
    const d = side * off;
    const x = S.px[i] + leftX(i) * d, z = S.pz[i] + leftZ(i) * d;
    if (!clear(x, z, off) || (len && (!clear(x + S.tx[i] * len / 2, z + S.tz[i] * len / 2, off) || !clear(x - S.tx[i] * len / 2, z - S.tz[i] * len / 2, off)))) return;
    obj.position.set(S.px[i] + leftX(i) * d, crossY(i, side * Math.min(off, S.bar[side > 0 ? 0 : 1][i])), S.pz[i] + leftZ(i) * d);
    obj.rotation.y = Math.atan2(S.tx[i], S.tz[i]) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);   // local +z faces the track
    sceneryGroup.add(obj);
  };
  const barR = (i) => S.bar[1][i], barL = (i) => S.bar[0][i];
  const straightLen = (dir) => { let c = 0; for (let o = 0; o < 120; o++) { const i = (S.n + o * dir) % S.n; if (Math.abs(S.k[i]) > 1 / 300) break; c++; } return c; };
  const span = Math.min(straightLen(1), straightLen(-1), 60);
  const pitI = (S.n - Math.round(span * 0.25)) % S.n;
  const pitLen = Math.max(60, span * S.step * 0.9);
  placeAlong(pitI, -1, barR(pitI) + 14, pitBuilding(pitLen), pitLen);
  for (const o of [-span * 0.55, span * 0.35]) {
    const i = (S.n + Math.round(o)) % S.n;
    placeAlong(i, 1, barL(i) + 10, grandstand(70, r), 70);
  }
  // Extra stands on the outside of the two slowest corners.
  const corners = [];
  forEachCorner((a, b, sign, minR) => corners.push({ i: Math.round((a + b) / 2) % S.n, sign, minR }));
  corners.sort((a, b) => a.minR - b.minR).slice(0, 2).forEach((c) => {
    const side = -c.sign, k = side > 0 ? 0 : 1;
    if (S.lim[k][c.i] < 1e8) return;
    placeAlong(c.i, side, S.bar[k][c.i] + 16, grandstand(46, r), 46);
  });
  const g = gantry(S.w[0] + 6);
  const gi = Math.round(14 / S.step) % S.n;
  g.position.set(S.px[gi], S.py[gi], S.pz[gi]);
  g.rotation.y = Math.atan2(S.tx[gi], S.tz[gi]);
  sceneryGroup.add(g);
  startLights = g.userData.lights;
  // Marshal posts + advertising boards every ~400 m.
  for (let i = 40; i < S.n; i += Math.round(400 / S.step)) {
    const side = S.k[i] > 0 ? -1 : 1, k = side > 0 ? 0 : 1;
    placeAlong(i, side, S.bar[k][i] + 2.2, board(r));
  }
}
let startLights = null;

function mergeGeoms(list) {
  // Minimal merge for non-indexed + indexed primitive geometries (position/normal/uv).
  const out = new THREE.BufferGeometry();
  const P = [], N = [], U = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array); U.push(...g.attributes.uv.array);
  }
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  return out;
}

const STAND_MAT = {
  concrete: new THREE.MeshStandardMaterial({ color: 0xb8b9bb, roughness: 0.9 }),
  roof: new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4, metalness: 0.5 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x55595f, roughness: 0.5, metalness: 0.7 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x1b2633, roughness: 0.08, metalness: 0.9 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.7 }),
  red: new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.5 }),
};
// Grandstand facing local +z (towards the track after placeAlong rotation).
function grandstand(len, r) {
  const g = new THREE.Group();
  const rows = 12, rowD = 0.9, rowH = 0.55;
  const steps = new THREE.BoxGeometry(len, rowH, rowD);
  const crowdCount = Math.floor(len * rows * 0.9);
  const crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 0.75, 0.35), new THREE.MeshStandardMaterial({ roughness: 0.9 }), crowdCount);
  const col = new THREE.Color(), m4 = new THREE.Matrix4();
  const palette = [0x8e1a24, 0xb9b9b9, 0x26386b, 0xb89a2a, 0x2f5e3a, 0xa45a26, 0x1c1c1c, 0x4d6f8a, 0x3a3a3a, 0x6b4a3a];
  let c = 0;
  for (let rI = 0; rI < rows; rI++) {
    const s = new THREE.Mesh(steps, STAND_MAT.concrete);
    s.position.set(0, rI * rowH + rowH / 2, -rI * rowD);
    s.receiveShadow = true;
    g.add(s);
    for (let x = -len / 2 + 0.4; x < len / 2 - 0.4 && c < crowdCount; x += 0.55 + r() * 0.5) {
      if (r() < 0.12) continue;
      m4.makeTranslation(x, rI * rowH + rowH + 0.38, -rI * rowD);
      crowd.setMatrixAt(c, m4);
      crowd.setColorAt(c, col.setHex(palette[(r() * palette.length) | 0]));
      c++;
    }
  }
  crowd.count = c;
  g.add(crowd);
  const back = new THREE.Mesh(new THREE.BoxGeometry(len, rows * rowH + 5, 0.6), STAND_MAT.concrete);
  back.position.set(0, (rows * rowH + 5) / 2, -rows * rowD);
  back.castShadow = true;
  g.add(back);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(len + 2, 0.4, rows * rowD + 3), STAND_MAT.roof);
  roof.position.set(0, rows * rowH + 5.2, -rows * rowD / 2 + 0.5);
  roof.rotation.x = -0.08;
  roof.castShadow = true;
  g.add(roof);
  for (let x = -len / 2; x <= len / 2; x += len / 6) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, rows * rowH + 5, 0.35), STAND_MAT.steel);
    p.position.set(x, (rows * rowH + 5) / 2, 1.2);
    g.add(p);
  }
  return g;
}
function pitBuilding(len) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(len, 6, 18), STAND_MAT.concrete);
  base.position.set(0, 3, -9); base.castShadow = base.receiveShadow = true;
  g.add(base);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(len - 2, 3.4, 16), STAND_MAT.glass);
  glass.position.set(0, 7.8, -9);
  g.add(glass);
  const top = new THREE.Mesh(new THREE.BoxGeometry(len + 3, 0.6, 20), STAND_MAT.roof);
  top.position.set(0, 9.8, -9); top.castShadow = true;
  g.add(top);
  const n = Math.floor(len / 8);
  for (let i = 0; i < n; i++) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(6.2, 4.4, 0.2), i % 2 ? STAND_MAT.dark : STAND_MAT.steel);
    door.position.set(-len / 2 + 4 + i * 8, 2.2, 0.02);
    g.add(door);
  }
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, 0.1), STAND_MAT.red);
  stripe.position.set(0, 5.4, 0.05);
  g.add(stripe);
  return g;
}
function gantry(width) {
  const g = new THREE.Group();
  const legG = new THREE.BoxGeometry(0.5, 7.5, 0.5);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(legG, STAND_MAT.steel);
    leg.position.set(s * width / 2, 3.75, 0); leg.castShadow = true;
    g.add(leg);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(width, 1.4, 0.7), STAND_MAT.dark);
  beam.position.set(0, 7.2, 0); beam.castShadow = true;
  g.add(beam);
  const lights = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.MeshStandardMaterial({ color: 0x220707, emissive: 0x000000, roughness: 0.3 });
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 10), m);
    l.position.set((2 - i) * 0.9, 7.2, -0.4);          // lit left-to-right as seen from the grid
    g.add(l);
    lights.push(m);
  }
  g.userData.lights = lights;
  return g;
}
const BOARD_TEX = ['APEX', 'LATE BRAKE', 'FULL SEND', 'DRS ZONE', 'GRIP+', 'TRACK BUILDER'].map((txt, i) =>
  canvasTex(512, (g, s) => {
    const cols = [['#111', '#ffd200'], ['#c8102e', '#fff'], ['#0b3d91', '#fff'], ['#fff', '#111'], ['#16a34a', '#fff'], ['#111', '#e10600']][i];
    g.fillStyle = cols[0]; g.fillRect(0, 0, s, s);
    g.fillStyle = cols[1]; g.font = `700 ${txt.length > 9 ? 70 : 96}px Rajdhani, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, s / 2, s * 0.25);
  }, false));
for (const t of BOARD_TEX) { t.repeat.set(1, 0.5); t.offset.set(0, 0.5); }
function board(r) {
  const g = new THREE.Group();
  const t = BOARD_TEX[(r() * BOARD_TEX.length) | 0];
  const panel = new THREE.Mesh(new THREE.BoxGeometry(8, 1.6, 0.2), [STAND_MAT.dark, STAND_MAT.dark, STAND_MAT.dark, STAND_MAT.dark, new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), STAND_MAT.dark]);
  panel.position.y = 2.6; panel.castShadow = true;
  g.add(panel);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.6, 0.15), STAND_MAT.steel); p.position.set(s * 3.6, 1.3, -0.1); g.add(p); }
  return g;
}
