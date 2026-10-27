// =====================================================================
//  Props: modelling helpers, shared materials and facade textures, and the
//  instanced renderer. Each catalog prop is modelled once from primitives,
//  merged per material, and drawn as one InstancedMesh per material, so
//  hundreds of hand-placed props cost a handful of draw calls.
// =====================================================================
const PROP_DEFS = [];                 // filled by the catalog: {id, name, cat, r, sp, build(P, ctx)}
const PROP_INDEX = new Map();         // id -> def
function defProp(def) { PROP_DEFS.push(def); PROP_INDEX.set(def.id, def); }

// --- materials (cached so props merge into few draw calls) ----------------
const _pmats = new Map();
function pm(color, o = {}) {
  const key = color + '|' + JSON.stringify(o, (k, v) => (v && v.isTexture ? v.uuid : v));
  let m = _pmats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, roughness: o.r ?? 0.75, metalness: o.m ?? 0, map: o.map || null, flatShading: !!o.flat,
      emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1, emissiveMap: o.emap || null,
      transparent: !!o.t, opacity: o.op ?? 1, side: o.ds ? THREE.DoubleSide : THREE.FrontSide, depthWrite: o.t ? false : true,
      alphaTest: o.at ?? 0,
    });
    _pmats.set(key, m);
  }
  return m;
}

// --- facade textures: one tile = one window bay x one floor ---------------
function facadeTex(draw, w = 128, h = 128) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = MAX_ANISO;
  return t;
}
const FT = {
  glass: facadeTex((g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, '#5d86ad'); grd.addColorStop(1, '#2b4a6b');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(8, 8, w * 0.35, h - 16);
    g.fillStyle = '#c9d2db'; g.fillRect(0, 0, w, 6); g.fillRect(0, 0, 5, h);
  }),
  glassGreen: facadeTex((g, w, h) => {
    g.fillStyle = '#3f6e66'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(200,255,240,.14)'; g.fillRect(6, 10, w * 0.4, h - 20);
    g.fillStyle = '#9fb3ad'; g.fillRect(0, 0, w, 10); g.fillRect(0, 0, 4, h);
  }),
  office: facadeTex((g, w, h) => {
    g.fillStyle = '#d8d6cf'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#28394b'; g.fillRect(6, 22, w - 12, h * 0.55);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(10, 26, 30, h * 0.5);
    g.fillStyle = '#bdbab2'; g.fillRect(w / 2 - 2, 22, 4, h * 0.55);
  }),
  resi: facadeTex((g, w, h) => {
    g.fillStyle = '#e6dccb'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#34475a'; g.fillRect(20, 18, w - 40, h * 0.55);
    g.fillStyle = '#f4f4f4'; g.fillRect(20, 18 + h * 0.27, w - 40, 3);
    g.fillStyle = '#9aa3ab'; g.fillRect(10, h * 0.74, w - 20, 8);
    g.fillStyle = '#7d858c'; for (let x = 12; x < w - 10; x += 9) g.fillRect(x, h * 0.62, 2, h * 0.12);
  }),
  brick: facadeTex((g, w, h) => {
    g.fillStyle = '#8e4a35'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#a65b42';
    for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? -8 : 0; x < w; x += 16) g.fillRect(x + 1, y + 1, 14, 6);
    g.fillStyle = '#e8e2d4'; g.fillRect(30, 26, w - 60, h * 0.5);
    g.fillStyle = '#2c3a48'; g.fillRect(34, 30, w - 68, h * 0.5 - 8);
    g.fillStyle = '#e8e2d4'; g.fillRect(w / 2 - 2, 30, 4, h * 0.5 - 8);
  }),
  deco: facadeTex((g, w, h) => {
    g.fillStyle = '#cfc4ae'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2e3a46'; g.fillRect(28, 12, w - 56, h - 24);
    g.fillStyle = '#b9ac92'; g.fillRect(0, 0, 20, h); g.fillRect(w - 20, 0, 20, h);
    g.fillStyle = '#e3d8c2'; g.fillRect(4, 0, 6, h);
  }),
  dark: facadeTex((g, w, h) => {
    g.fillStyle = '#1b1f26'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2b3542'; g.fillRect(4, 8, w - 8, h - 16);
    g.fillStyle = 'rgba(255,214,140,.35)'; g.fillRect(12, 18, 28, 40);
    g.fillStyle = '#0e1116'; g.fillRect(0, 0, w, 8);
  }),
  house: facadeTex((g, w, h) => {
    g.fillStyle = '#efe7d6'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,.06)'; for (let y = 0; y < h; y += 10) g.fillRect(0, y, w, 2);
    g.fillStyle = '#ffffff'; g.fillRect(36, 28, w - 72, 56);
    g.fillStyle = '#3d5368'; g.fillRect(40, 32, w - 80, 48);
    g.fillStyle = '#ffffff'; g.fillRect(w / 2 - 2, 32, 4, 48); g.fillRect(40, 54, w - 80, 4);
    g.fillStyle = '#5b7e4a'; g.fillRect(30, 26, 6, 60); g.fillRect(w - 36, 26, 6, 60);
  }),
  shop: facadeTex((g, w, h) => {
    g.fillStyle = '#d9d2c2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#20303e'; g.fillRect(6, 30, w - 12, h - 30);
    g.fillStyle = 'rgba(255,240,200,.22)'; g.fillRect(10, 34, w - 20, h - 40);
    g.fillStyle = '#b8b0a0'; g.fillRect(w / 2 - 2, 30, 4, h - 30);
  }),
  metal: facadeTex((g, w, h) => {
    g.fillStyle = '#a8adb2'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) { g.fillStyle = x % 16 ? '#9ba0a5' : '#b7bcc1'; g.fillRect(x, 0, 4, h); }
  }),
  metalBlue: facadeTex((g, w, h) => {
    g.fillStyle = '#3d5f86'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) { g.fillStyle = x % 16 ? '#36557a' : '#46698f'; g.fillRect(x, 0, 4, h); }
  }),
  roofTile: facadeTex((g, w, h) => {
    g.fillStyle = '#8c3b2a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 12) for (let x = (y / 12) % 2 ? -10 : 0; x < w; x += 20) { g.fillStyle = '#a5483a'; g.fillRect(x + 1, y + 1, 18, 9); g.fillStyle = '#6d2c20'; g.fillRect(x + 1, y + 9, 18, 2); }
  }),
  roofSlate: facadeTex((g, w, h) => {
    g.fillStyle = '#3c4148'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 10) for (let x = (y / 10) % 2 ? -8 : 0; x < w; x += 16) { g.fillStyle = '#4a5058'; g.fillRect(x + 1, y + 1, 14, 8); }
  }),
  crowd: facadeTex((g, w, h) => {
    const r = rng(77), cols = ['#c8102e', '#f4f4f4', '#1e3a8a', '#ffd200', '#16a34a', '#f97316', '#111', '#7dd3fc', '#8b5a2b', '#e5c49f'];
    g.fillStyle = '#6b6f75'; g.fillRect(0, 0, w, h);
    for (let y = 4; y < h; y += 16) for (let x = 2; x < w; x += 8) {
      if (r() < 0.1) continue;
      g.fillStyle = cols[(r() * cols.length) | 0]; g.fillRect(x, y + 4, 6, 8);
      g.fillStyle = ['#f1d0b0', '#c48a5c', '#8a5a3c', '#e9b98f'][(r() * 4) | 0]; g.fillRect(x + 1, y, 4, 4);
    }
  }),
  seats: facadeTex((g, w, h) => {
    g.fillStyle = '#5c6066'; g.fillRect(0, 0, w, h);
    for (let y = 2; y < h; y += 16) for (let x = 2; x < w; x += 10) { g.fillStyle = '#1e5aa8'; g.fillRect(x, y, 8, 10); }
  }),
  rubber: facadeTex((g, w, h) => {
    g.fillStyle = '#18181a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 6) { g.fillStyle = '#222225'; g.fillRect(0, y, w, 3); }
  }),
  timing: facadeTex((g, w, h) => {
    g.fillStyle = '#05070a'; g.fillRect(0, 0, w, h);
    g.font = '700 12px monospace'; g.textBaseline = 'top';
    const names = ['VER', 'HAM', 'LEC', 'NOR', 'ALO', 'RUS', 'PIA', 'SAI', 'GAS', 'OCO'];
    names.forEach((n, i) => {
      g.fillStyle = i % 2 ? '#0d1117' : '#11161d'; g.fillRect(0, i * 12.8, w, 12.8);
      g.fillStyle = '#ffd200'; g.fillText(String(i + 1).padStart(2, ' '), 4, i * 12.8 + 1);
      g.fillStyle = '#fff'; g.fillText(n, 30, i * 12.8 + 1);
      g.fillStyle = '#2fd06a'; g.fillText('+' + (i * 0.731).toFixed(1), 78, i * 12.8 + 1);
    });
  }),
  numbers: facadeTex((g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#111'; g.lineWidth = 6; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#111'; g.font = '800 70px Rajdhani, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('100', w / 2, h / 2 + 4);
  }),
  solar: facadeTex((g, w, h) => {
    g.fillStyle = '#132a4a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8fa8c8'; g.lineWidth = 2;
    for (let x = 0; x <= w; x += w / 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += h / 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }),
};
// A plain placeholder when no sponsor is assigned.
const PLACEHOLDER_SPONSOR = { id: '_ph', text: 'YOUR LOGO', tag: 'SELECT A SPONSOR', bg: '#26292f', fg: '#ffffff', accent: '#e10600', layout: 'block', icon: 'none' };
const placeholderMats = {};
function placeholderMat(kind) {
  if (!placeholderMats[kind]) {
    const c = document.createElement('canvas'); c.width = SPONSOR_W; c.height = SPONSOR_H;
    drawSponsor(c.getContext('2d'), PLACEHOLDER_SPONSOR);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
    placeholderMats[kind] = kind === 'screen'
      ? new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.5 })
      : new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, side: THREE.DoubleSide });
  }
  return placeholderMats[kind];
}

// --- modelling kit --------------------------------------------------------
// Positions are the base (bottom) of each part unless noted; rotations in radians.
function kit(group) {
  const put = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    group.add(m);
    return m;
  };
  // Scale a box's UVs so a facade tile covers (tileW x tileH) metres on every face.
  const boxGeo = (w, h, d, tileW, tileH) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (tileW) {
      const uv = g.attributes.uv;
      const faceSize = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
        const i = f * 4 + v;
        uv.setXY(i, uv.getX(i) * (faceSize[f][0] / tileW), uv.getY(i) * (faceSize[f][1] / (tileH || tileW)));
      }
    }
    return g;
  };
  const K = {
    group,
    box: (w, h, d, mat, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) => put(boxGeo(w, h, d), mat, x, y + h / 2, z, rx, ry, rz),
    // Box with a repeating facade on its sides (top/bottom get the roof material if given).
    tower: (w, h, d, mat, tileW, tileH, x = 0, y = 0, z = 0, ry = 0, roof = null) => {
      put(boxGeo(w, h, d, tileW, tileH), roof ? [mat, mat, roof, roof, mat, mat] : mat, x, y + h / 2, z, 0, ry, 0);
    },
    cyl: (rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 14, rx = 0, rz = 0, open = false) => put(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat, x, y + h / 2, z, rx, 0, rz),
    // Cylinder between two points (struts, beams, poles, pipes).
    rod: (a, b, r, mat, seg = 8) => {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), len = va.distanceTo(vb);
      const g = new THREE.CylinderGeometry(r, r, len, seg);
      g.translate(0, len / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()));
      return put(g, mat, va.x, va.y, va.z);
    },
    sph: (r, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, seg = 14) => { const m = put(new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.6 | 0)), mat, x, y, z); m.scale.set(sx, sy, sz); return m; },
    ico: (r, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, detail = 1) => { const m = put(new THREE.IcosahedronGeometry(r, detail), mat, x, y, z); m.scale.set(sx, sy, sz); return m; },
    cone: (r, h, mat, x = 0, y = 0, z = 0, seg = 10, rx = 0, rz = 0) => put(new THREE.ConeGeometry(r, h, seg), mat, x, y + h / 2, z, rx, 0, rz),
    torus: (R, r, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, arc = Math.PI * 2, seg = 24) => put(new THREE.TorusGeometry(R, r, 8, seg, arc), mat, x, y, z, rx, ry, rz),
    lathe: (pts, mat, x = 0, y = 0, z = 0, seg = 20) => put(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg), mat, x, y, z),
    // Extrude a 2D outline (in the z/y plane: [forward, up]) across width w (x).
    side: (pts, w, mat, x = 0, y = 0, z = 0, bevel = 0) => {
      const sh = new THREE.Shape();
      pts.forEach(([a, b], i) => (i ? sh.lineTo(a, b) : sh.moveTo(a, b)));
      sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: w - bevel * 2, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 6 });
      g.translate(0, 0, -(w - bevel * 2) / 2);
      g.rotateY(-Math.PI / 2);          // shape x -> world z (forward), extrusion -> x
      return put(g, mat, x, y, z);
    },
    // Flat panel facing +z (billboard faces, signs) with UVs 0..1.
    panel: (w, h, mat, x = 0, y = 0, z = 0, ry = 0, rx = 0) => put(new THREE.PlaneGeometry(w, h), mat, x, y + h / 2, z, rx, ry, 0),
    // Pitched roof (triangular prism) along x, ridge height h.
    gable: (w, d, h, mat, x = 0, y = 0, z = 0, ry = 0, over = 0.3) => {
      const sh = new THREE.Shape();
      sh.moveTo(-d / 2 - over, 0); sh.lineTo(d / 2 + over, 0); sh.lineTo(0, h); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: w + over * 2, bevelEnabled: false });
      g.translate(0, 0, -(w + over * 2) / 2);
      g.rotateY(Math.PI / 2);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 3, uv.getY(i) / 3);
      return put(g, mat, x, y, z, 0, ry, 0);
    },
  };
  return K;
}

// Shared palette.
const C = {
  white: pm(0xf2f2f0), offwhite: pm(0xe3ddd0), black: pm(0x15161a, { r: 0.5 }), dark: pm(0x2a2d33, { r: 0.6 }),
  grey: pm(0x8a8f96), lgrey: pm(0xc4c7cc), concrete: pm(0xb3b0a8, { r: 0.92 }), asphalt: pm(0x3a3c40, { r: 0.95 }),
  steel: pm(0x9aa1a8, { r: 0.35, m: 0.8 }), chrome: pm(0xd8dde2, { r: 0.15, m: 1 }), darkSteel: pm(0x4a5058, { r: 0.45, m: 0.7 }),
  glass: pm(0x1b2633, { r: 0.08, m: 0.9 }), glassBlue: pm(0x2c4a66, { r: 0.1, m: 0.85 }), glassLight: pm(0x8fb3cf, { r: 0.1, m: 0.6, t: true, op: 0.55 }),
  tyre: pm(0x161618, { r: 0.9 }), rim: pm(0xb9bdc4, { r: 0.25, m: 0.9 }), red: pm(0xc8102e, { r: 0.5 }), yellow: pm(0xffcc00, { r: 0.5 }),
  orange: pm(0xff6a00, { r: 0.55 }), blue: pm(0x1e4fa8, { r: 0.5 }), green: pm(0x2e7d32, { r: 0.6 }),
  wood: pm(0x8a5a35, { r: 0.85 }), darkWood: pm(0x5a3a22, { r: 0.85 }), bark: pm(0x5b4330, { r: 1 }),
  leaf: pm(0x3f6e2a, { r: 0.9, flat: true }), leafDark: pm(0x2c5122, { r: 0.9, flat: true }), leafLight: pm(0x6a9a3a, { r: 0.9, flat: true }),
  pine: pm(0x264a2a, { r: 0.9, flat: true }), autumn: pm(0xc7652a, { r: 0.9, flat: true }), autumn2: pm(0xe0a22e, { r: 0.9, flat: true }),
  blossom: pm(0xf2a7c3, { r: 0.85, flat: true }), birchBark: pm(0xe8e4dc, { r: 0.9 }), palmLeaf: pm(0x4f8a2e, { r: 0.85, flat: true, ds: true }),
  rock: pm(0x8b8780, { r: 0.95, flat: true }), rockDark: pm(0x6b6862, { r: 0.95, flat: true }), sand: pm(0xd8c08a, { r: 1 }),
  grass: pm(0x4e7a2e, { r: 1 }), water: pm(0x3a7ca5, { r: 0.1, m: 0.3 }), lightOn: pm(0xfff4d6, { e: 0xfff1c8, ei: 2.2 }),
  redLight: pm(0x400000, { e: 0xff2020, ei: 2 }), amberLight: pm(0x402000, { e: 0xff9a1a, ei: 1.8 }), blueLight: pm(0x000a40, { e: 0x2a6bff, ei: 2.2 }),
  fabric: pm(0xf4f4f4, { r: 0.9, ds: true }), canvasRed: pm(0xc8102e, { r: 0.9, ds: true }),
};

// --- instanced prototypes ---------------------------------------------------
const _protos = new Map();   // key (id|sponsor) -> {parts:[{geo, mat}], radius, height, center}
function sponsorCtx(spId) {
  return { sp: (kind = 'wall') => (spId && sponsorMat(spId, kind)) || placeholderMat(kind === 'screen' ? 'screen' : 'wall') };
}
function propProto(id, spId = '') {
  const def = PROP_INDEX.get(id);
  const key = def.sp ? id + '|' + spId : id;
  let p = _protos.get(key);
  if (p) return p;
  const g = new THREE.Group();
  def.build(kit(g), { ...sponsorCtx(spId), rng: rng(id.length * 7919 + id.charCodeAt(0)) });
  g.updateMatrixWorld(true);
  const byMat = new Map();
  g.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    // Multi-material meshes: split by group.
    const groups = Array.isArray(o.material) && o.geometry.groups.length ? o.geometry.groups : [{ start: 0, count: geo.attributes.position.count, materialIndex: 0 }];
    for (const gr of groups) {
      const mat = mats[gr.materialIndex] || mats[0];
      const part = new THREE.BufferGeometry();
      for (const name of ['position', 'normal', 'uv']) {
        const a = geo.attributes[name];
        part.setAttribute(name, new THREE.Float32BufferAttribute(a.array.slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize));
      }
      if (!byMat.has(mat)) byMat.set(mat, []);
      byMat.get(mat).push(part);
    }
  });
  const parts = [];
  for (const [mat, geos] of byMat) parts.push({ geo: mergeAll(geos), mat });
  const box = new THREE.Box3().setFromObject(g);
  const size = box.getSize(new THREE.Vector3());
  p = { parts, radius: Math.max(size.x, size.z) / 2, height: size.y, box, sizeVec: size };
  _protos.set(key, p);
  return p;
}
function mergeAll(geos) {
  let n = 0;
  for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}
// Sponsor art changed: drop cached prototypes for that sponsor (materials update in place, geometry is shared).
function forgetSponsorProtos(spId) { for (const k of [..._protos.keys()]) if (k.endsWith('|' + spId)) _protos.delete(k); }

// --- placed props ---------------------------------------------------------
const propGroup = new THREE.Group();
scene.add(propGroup);
let propMeshes = [];          // InstancedMesh list; userData {key, idx: [prop indices]}
const propCols = new Map();   // grid cell -> [{x, z, r}]
const PCELL = 16;
function propGroundY(x, z) {
  if (S) {
    const p = project(x, z);
    if (p) {
      const k = p.d > 0 ? 0 : 1;
      if (Math.abs(p.d) <= Math.min(S.bar[k][p.i] + 3, S.lim[k][p.i])) return surfaceHeight(x, z, p.i).y;
    }
  }
  return terrainHeight(x, z) + 0.3;
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _sv = new THREE.Vector3(), _pv = new THREE.Vector3(), _yAxis = new THREE.Vector3(0, 1, 0);
function propMatrix(p, out = _m4) {
  _q.setFromAxisAngle(_yAxis, p.r); _sv.setScalar(p.s); _pv.set(p.x, propGroundY(p.x, p.z) + (p.dy || 0), p.z);
  return out.compose(_pv, _q, _sv);
}
function rebuildProps() {
  for (const m of propMeshes) { propGroup.remove(m); m.dispose(); }
  propMeshes = [];
  propCols.clear();
  const groups = new Map();
  state.props.forEach((p, i) => {
    const def = PROP_INDEX.get(p.t);
    if (!def) return;
    const key = def.sp ? p.t + '|' + (p.sp || '') : p.t;
    if (!groups.has(key)) groups.set(key, { t: p.t, sp: p.sp || '', idx: [] });
    groups.get(key).idx.push(i);
    if (def.r > 0) {
      const r = def.r * p.s;
      const c0x = Math.floor((p.x - r) / PCELL), c1x = Math.floor((p.x + r) / PCELL), c0z = Math.floor((p.z - r) / PCELL), c1z = Math.floor((p.z + r) / PCELL);
      for (let cx = c0x; cx <= c1x; cx++) for (let cz = c0z; cz <= c1z; cz++) {
        const k = cx * 100003 + cz;
        if (!propCols.has(k)) propCols.set(k, []);
        propCols.get(k).push({ x: p.x, z: p.z, r });
      }
    }
  });
  for (const [key, gInfo] of groups) {
    const proto = propProto(gInfo.t, gInfo.sp);
    for (const part of proto.parts) {
      const im = new THREE.InstancedMesh(part.geo, part.mat, gInfo.idx.length);
      gInfo.idx.forEach((pi, j) => im.setMatrixAt(j, propMatrix(state.props[pi])));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = proto.height > 1.2; im.receiveShadow = true;
      im.computeBoundingSphere();
      im.userData = { key, idx: gInfo.idx };
      propGroup.add(im);
      propMeshes.push(im);
    }
  }
}
// Move one prop live (while dragging) without rebuilding everything.
function updatePropInstance(pi) {
  for (const im of propMeshes) {
    const j = im.userData.idx.indexOf(pi);
    if (j >= 0) { im.setMatrixAt(j, propMatrix(state.props[pi])); im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
  }
}
// Circle colliders for the car (hull points against prop footprints).
function propContact(x, z) {
  const list = propCols.get(Math.floor(x / PCELL) * 100003 + Math.floor(z / PCELL));
  if (!list) return null;
  let best = null;
  for (const c of list) {
    const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
    if (d < c.r && (!best || c.r - d > best.depth)) best = { nx: d > 1e-4 ? dx / d : 1, nz: d > 1e-4 ? dz / d : 0, depth: Math.min(0.6, c.r - d) };
  }
  return best;
}

// --- thumbnails -----------------------------------------------------------
const _thumbs = new Map();
let _thumbRT = null, _thumbScene = null, _thumbCam = null;
function propThumb(id) {
  if (_thumbs.has(id)) return _thumbs.get(id);
  const size = 224, out = 112;             // render at 2x, downsample on the canvas for smooth edges
  if (!_thumbRT) {
    _thumbRT = new THREE.WebGLRenderTarget(size, size);
    _thumbRT.texture.colorSpace = THREE.SRGBColorSpace;
    _thumbScene = new THREE.Scene();
    _thumbScene.add(new THREE.HemisphereLight(0xdfeeff, 0x445533, 1.1));
    const d = new THREE.DirectionalLight(0xffffff, 2.4); d.position.set(3, 5, 4); _thumbScene.add(d);
    _thumbCam = new THREE.PerspectiveCamera(30, 1, 0.1, 5000);
  }
  _thumbScene.environment = scene.environment;
  const proto = propProto(id, state.sponsors[0]?.id || '');
  const holder = new THREE.Group();
  for (const p of proto.parts) holder.add(new THREE.Mesh(p.geo, p.mat));
  _thumbScene.add(holder);
  const c = proto.box.getCenter(new THREE.Vector3());
  const R = Math.max(proto.sizeVec.x, proto.sizeVec.y, proto.sizeVec.z) * 0.62 + 0.2;
  const dist = R / Math.sin((30 * Math.PI) / 360);
  _thumbCam.position.set(c.x + dist * 0.62, c.y + dist * 0.42, c.z + dist * 0.66);
  _thumbCam.near = dist / 50; _thumbCam.far = dist * 4; _thumbCam.updateProjectionMatrix();
  _thumbCam.lookAt(c);
  renderer.setRenderTarget(_thumbRT);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(_thumbScene, _thumbCam);
  const buf = new Uint8Array(size * size * 4);
  renderer.readRenderTargetPixels(_thumbRT, 0, 0, size, size, buf);
  renderer.setRenderTarget(null);
  renderer.setClearColor(0x000000, 1);
  _thumbScene.remove(holder);
  const big = document.createElement('canvas'); big.width = big.height = size;
  const bg = big.getContext('2d'), img = bg.createImageData(size, size);
  for (let y = 0; y < size; y++) img.data.set(buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
  bg.putImageData(img, 0, 0);
  const cv = document.createElement('canvas'); cv.width = cv.height = out;
  const g = cv.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(big, 0, 0, out, out);
  const url = cv.toDataURL();
  _thumbs.set(id, url);
  return url;
}
