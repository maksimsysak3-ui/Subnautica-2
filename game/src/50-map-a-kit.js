// =====================================================================
//  WORLD MAP — engine: static batching, collision, terrain, sky, lamp pool
// =====================================================================
// Every static object (walls, props, a coffee mug) is written into a handful of merged,
// vertex-coloured meshes split into 48 m chunks. That keeps tens of thousands of objects
// at a few dozen draw calls, while frustum culling still works per chunk.
const MAP = { bounds: 300, chunk: 48, lamps: [], colliders: [], targetsReady: false, lampGain: 3.2 };

// ---------------- deterministic randomness (layout must be identical every load) ----------------
const mrand = (() => { let s = 1337; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
const mr = (a, b) => a + mrand() * (b - a);
const mpick = (arr) => arr[Math.floor(mrand() * arr.length)];

// ---------------- terrain ----------------
// Flat pads where things are built; dunes and rising hills beyond; a dry riverbed (wadi) to the west.
const FLATS = []; // {x0,z0,x1,z1,y,blend}
function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, z) { let s = 0, a = 1, f = 1; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, z * f); a *= 0.5; f *= 2.03; } return s / 1.875; }
function rawTerrain(x, z) {
  const r = Math.hypot(x, z);
  let h = (fbm(x * 0.012, z * 0.012) - 0.45) * 7 + (fbm(x * 0.05 + 9, z * 0.05) - 0.5) * 1.2;
  const ring = Math.max(0, r - 210) ** 1.35 * 0.09;
  h += 55 * (1 - Math.exp(-ring / 40));                                // hills ringing the area (levelling off ~55 m)
  h += Math.exp(-(((x - 190) ** 2) + ((z + 70) ** 2)) / 1800) * 26;   // radio-tower hill
  h += Math.exp(-(((x + 120) ** 2) + ((z + 150) ** 2)) / 2500) * 9;   // rocky rise NW
  // wadi: a meandering dry riverbed west of the base running north–south
  const wx = -228 + Math.sin(z * 0.018) * 14;
  h -= Math.exp(-((x - wx) ** 2) / 90) * 4.2;
  return h;
}
function terrainH(x, z) {
  let h = rawTerrain(x, z);
  for (const f of FLATS) {
    const dx = Math.max(f.x0 - x, 0, x - f.x1), dz = Math.max(f.z0 - z, 0, z - f.z1), d = Math.hypot(dx, dz);
    if (d < f.blend) { const t = smooth(1 - d / f.blend); h = lerp(h, f.y, t); }
  }
  return h;
}
function flat(x0, z0, x1, z1, y = 0, blend = 18) { FLATS.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), y, blend }); }

// ---------------- static batch builder ----------------
const W = (() => {
  const layers = {
    solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, flatShading: true }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.55, flatShading: true }),
    glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.3, transparent: true, opacity: 0.32, depthWrite: false, flatShading: true }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    cloth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true, side: THREE.DoubleSide }),
  };
  const buckets = new Map(); // `${layer}|${cx}|${cz}` -> {pos: Float32Array, col, n}
  const geoCache = new Map();
  let M = new THREE.Matrix4();
  const stack = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new V3(), _s = new V3(), _c = new THREE.Color();
  let tris = 0, objects = 0;
  function unit(key, make) {
    let g = geoCache.get(key);
    if (!g) { const src = make(); const ni = src.index ? src.toNonIndexed() : src; g = ni.attributes.position.array.slice(); src.dispose(); geoCache.set(key, g); }
    return g;
  }
  const G = {
    box: () => unit('box', () => new THREE.BoxGeometry(1, 1, 1)),
    cyl: (seg = 8, ratio = 1, open = false) => unit(`cyl${seg}_${ratio.toFixed(2)}_${open}`, () => new THREE.CylinderGeometry(0.5 * ratio, 0.5, 1, seg, 1, open)),
    sphere: (w = 8, h = 6) => unit(`sph${w}_${h}`, () => new THREE.SphereGeometry(0.5, w, h)),
    hemi: (w = 8, h = 4) => unit(`hem${w}_${h}`, () => new THREE.SphereGeometry(0.5, w, h, 0, Math.PI * 2, 0, Math.PI / 2)),
    cone: (seg = 8) => unit(`cone${seg}`, () => new THREE.ConeGeometry(0.5, 1, seg)),
    torus: (seg = 10, tube = 0.2, arc = Math.PI * 2) => unit(`tor${seg}_${tube}_${arc.toFixed(3)}`, () => new THREE.TorusGeometry(0.5, tube * 0.5, 4, seg, arc)),
    wedge: () => unit('wedge', () => { // right-angle prism: slope from (-.5,-.5) up to (.5,.5) over z
      const g = new THREE.BufferGeometry();
      const v = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5]];
      const p = [];
      const tri = (a, b, c) => p.push(...a, ...b, ...c);
      const P = (i, z) => [v[i][0], v[i][1], z];
      tri(P(0, 0.5), P(1, 0.5), P(2, 0.5)); tri(P(0, -0.5), P(2, -0.5), P(1, -0.5));
      const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
      quad(P(0, -0.5), P(1, -0.5), P(1, 0.5), P(0, 0.5));
      quad(P(1, -0.5), P(2, -0.5), P(2, 0.5), P(1, 0.5));
      quad(P(2, -0.5), P(0, -0.5), P(0, 0.5), P(2, 0.5));
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      return g;
    }),
    plane: () => unit('plane', () => new THREE.PlaneGeometry(1, 1)),
    disc: (seg = 12) => unit(`disc${seg}`, () => new THREE.CircleGeometry(0.5, seg)),
  };
  function bucket(layer, wx, wz) {
    const key = `${layer}|${Math.floor(wx / MAP.chunk)}|${Math.floor(wz / MAP.chunk)}`;
    let b = buckets.get(key);
    if (!b) { b = { layer, pos: new Float32Array(9 * 512), col: new Float32Array(9 * 512), n: 0 }; buckets.set(key, b); }
    return b;
  }
  function grow(b, need) {
    if (b.n + need <= b.pos.length) return;
    let cap = b.pos.length; while (cap < b.n + need) cap *= 2;
    const p = new Float32Array(cap), c = new Float32Array(cap); p.set(b.pos); c.set(b.col); b.pos = p; b.col = c;
  }
  // write a unit shape transformed by world matrix m, colour col (hex), with per-object variation + contact darkening
  function put(arr, m, col, layer = 'solid', o = {}) {
    const e = m.elements;
    const cx = e[12], cz = e[14];
    const b = bucket(layer, cx, cz);
    grow(b, arr.length);
    _c.set(col);
    const jit = o.jit ?? 0.06, k = 1 + (mrand() - 0.5) * 2 * jit;
    const r = _c.r * k, g = _c.g * k, bl = _c.b * k;
    const ao = o.ao ?? (layer === 'solid' || layer === 'metal');
    const base = o.ground ?? 0;
    for (let i = 0; i < arr.length; i += 3) {
      const x = arr[i], y = arr[i + 1], z = arr[i + 2];
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12], wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      const j = b.n + i;
      b.pos[j] = wx; b.pos[j + 1] = wy; b.pos[j + 2] = wz;
      const a = ao ? 0.66 + 0.34 * clamp((wy - base) / 0.7, 0, 1) : 1;
      b.col[j] = r * a; b.col[j + 1] = g * a; b.col[j + 2] = bl * a;
    }
    b.n += arr.length; tris += arr.length / 9; objects++;
  }
  function local(x, y, z, sx, sy, sz, o) {
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'); _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    return new THREE.Matrix4().multiplyMatrices(M, _m);
  }
  function solidFrom(m, mat = 'concrete', o = {}) {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (const cx of [-0.5, 0.5]) for (const cy of [-0.5, 0.5]) for (const cz of [-0.5, 0.5]) {
      _p.set(cx, cy, cz).applyMatrix4(m);
      x0 = Math.min(x0, _p.x); x1 = Math.max(x1, _p.x); y0 = Math.min(y0, _p.y); y1 = Math.max(y1, _p.y); z0 = Math.min(z0, _p.z); z1 = Math.max(z1, _p.z);
    }
    COL.add({ x0, y0, z0, x1, y1, z1, mat, walk: o.walk });
  }
  const api = {
    G, layers,
    push(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) { stack.push(M.clone()); _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _m.compose(_p.set(x, y, z), _q, _s.set(1, 1, 1)); M = M.clone().multiply(_m); },
    pop() { M = stack.pop(); },
    // primitives in the current local frame; o: {rx,ry,rz,layer,solid,mat,jit,ao,walk}
    box(w, h, d, x, y, z, col, o = {}) { const m = local(x, y, z, w, h, d, o); put(G.box(), m, col, o.layer, o); if (o.solid) solidFrom(m, o.mat, o); return m; },
    cyl(rt, rb, h, x, y, z, col, o = {}) { const seg = o.seg || 8; const r = Math.max(rt, rb); const m = local(x, y, z, r * 2, h, r * 2, o); put(G.cyl(seg, rb > 0 ? rt / rb : 1, o.open), m, col, o.layer, o); if (o.solid) solidFrom(m, o.mat, o); return m; },
    sphere(w, h, d, x, y, z, col, o = {}) { put(G.sphere(o.seg || 8, o.hseg || 6), local(x, y, z, w, h, d, o), col, o.layer, o); },
    hemi(w, h, d, x, y, z, col, o = {}) { put(G.hemi(o.seg || 8, o.hseg || 4), local(x, y, z, w, h, d, o), col, o.layer, o); },
    cone(r, h, x, y, z, col, o = {}) { put(G.cone(o.seg || 8), local(x, y, z, r * 2, h, r * 2, o), col, o.layer, o); },
    torus(r, tube, x, y, z, col, o = {}) { put(G.torus(o.seg || 10, tube / r, o.arc || Math.PI * 2), local(x, y, z, r * 2, r * 2, r * 2, o), col, o.layer, o); },
    wedge(w, h, d, x, y, z, col, o = {}) { const m = local(x, y, z, w, h, d, o); put(G.wedge(), m, col, o.layer, o); if (o.solid) solidFrom(m, o.mat, o); },
    plane(w, h, x, y, z, col, o = {}) { put(G.plane(), local(x, y, z, w, h, 1, o), col, o.layer, o); },
    disc(r, x, y, z, col, o = {}) { put(G.disc(o.seg || 12), local(x, y, z, r * 2, r * 2, 1, o), col, o.layer, o); },
    // a thin tube between two local points (cables, pipes, rope, rebar)
    rod(a, b, r, col, o = {}) {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1e-4;
      const q = new THREE.Quaternion().setFromUnitVectors(UP, new V3(dx / L, dy / L, dz / L));
      const m = new THREE.Matrix4().compose(new V3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, new V3(r * 2, L, r * 2));
      put(G.cyl(o.seg || 5), new THREE.Matrix4().multiplyMatrices(M, m), col, o.layer, o);
    },
    // sagging cable through points
    cable(a, b, sag, r, col, n = 8) {
      let prev = a;
      for (let i = 1; i <= n; i++) {
        const t = i / n, p = [lerp(a[0], b[0], t), lerp(a[1], b[1], t) - Math.sin(t * Math.PI) * sag, lerp(a[2], b[2], t)];
        this.rod(prev, p, r, col, { ao: false }); prev = p;
      }
    },
    solid(w, h, d, x, y, z, mat = 'concrete', o = {}) { solidFrom(local(x, y, z, w, h, d, o), mat, o); },
    worldPos(x, y, z) { return new V3(x, y, z).applyMatrix4(M); },
    worldRotY() { _e.setFromRotationMatrix(M, 'YXZ'); return _e.y; },
    lamp(x, y, z, color = 0xffd9a0, intensity = 8, range = 12, o = {}) {
      const p = this.worldPos(x, y, z);
      MAP.lamps.push({ p, color: new THREE.Color(color), intensity: intensity * MAP.lampGain, range: range * 1.25, flicker: o.flicker || 0, halo: o.halo ?? 1 });
    },
    stats: () => ({ tris, objects, buckets: buckets.size }),
    finish() {
      const meshes = [];
      for (const b of buckets.values()) {
        if (!b.n) continue;
        const pos = b.pos.subarray(0, b.n), col = b.col.subarray(0, b.n);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3));
        g.setAttribute('color', new THREE.BufferAttribute(col.slice(), 3));
        g.computeVertexNormals();
        g.computeBoundingSphere(); g.computeBoundingBox();
        const mesh = new THREE.Mesh(g, layers[b.layer]);
        const shadowy = b.layer === 'solid' || b.layer === 'metal' || b.layer === 'cloth';
        mesh.castShadow = shadowy; mesh.receiveShadow = b.layer !== 'glow';
        mesh.renderOrder = b.layer === 'glass' ? 2 : 0;
        scene.add(mesh); meshes.push(mesh);
      }
      buckets.clear();
      return meshes;
    },
  };
  return api;
})();

// ---------------- collision: axis-aligned boxes in a 4 m spatial hash ----------------
const COL = (() => {
  const cell = 4, grid = new Map(), list = [];
  const key = (i, j) => i * 100003 + j;
  function add(b) {
    b.id = list.length; list.push(b);
    for (let i = Math.floor(b.x0 / cell); i <= Math.floor(b.x1 / cell); i++) for (let j = Math.floor(b.z0 / cell); j <= Math.floor(b.z1 / cell); j++) {
      const k = key(i, j); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(b);
    }
  }
  let stamp = 1;
  function near(x0, z0, x1, z1, out) {
    stamp++; out.length = 0;
    for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++) for (let j = Math.floor(z0 / cell); j <= Math.floor(z1 / cell); j++) {
      const a = grid.get(key(i, j)); if (!a) continue;
      for (const b of a) if (b._s !== stamp) { b._s = stamp; out.push(b); }
    }
    return out;
  }
  const tmp = [];
  // highest walkable surface under (x,z) that is no more than `step` above the feet
  function ground(x, z, feet, step = 0.45) {
    let h = terrainH(x, z);
    for (const b of near(x - 0.01, z - 0.01, x + 0.01, z + 0.01, tmp)) {
      if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
      if (b.y1 <= feet + step && b.y1 > h) h = b.y1;
    }
    return h;
  }
  // push a vertical capsule (circle in XZ) out of boxes it overlaps
  function resolve(p, r, height, step = 0.45) {
    for (let it = 0; it < 3; it++) {
      let moved = false;
      for (const b of near(p.x - r, p.z - r, p.x + r, p.z + r, tmp)) {
        if (b.y1 <= p.y + step || b.y0 >= p.y + height) continue;
        const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1);
        let dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 < 1e-10) { // centre inside the box: leave by the nearest face
          const opts = [[b.x0 - r - p.x, 0], [b.x1 + r - p.x, 0], [0, b.z0 - r - p.z], [0, b.z1 + r - p.z]];
          opts.sort((a, c) => Math.hypot(...a) - Math.hypot(...c));
          p.x += opts[0][0]; p.z += opts[0][1];
        } else { const d = Math.sqrt(d2), push = r - d; p.x += (dx / d) * push; p.z += (dz / d) * push; }
        moved = true;
      }
      if (!moved) break;
    }
  }
  // nearest ray hit against boxes: marches the hash grid along the ray (2D DDA)
  function ray(o, d, maxT) {
    let best = null, bt = maxT;
    const h = Math.hypot(d.x, d.z);
    const stepT = cell / Math.max(h, 1e-6) * 0.999;
    const seen = new Set();
    for (let t = 0; t <= bt + stepT; t += stepT) {
      const x = o.x + d.x * t, z = o.z + d.z * t;
      const i = Math.floor(x / cell), j = Math.floor(z / cell);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const a = grid.get(key(i + di, j + dj)); if (!a) continue;
        for (const b of a) {
          if (seen.has(b.id)) continue; seen.add(b.id);
          let t0 = 0, t1 = bt, n = null;
          const lo = [b.x0, b.y0, b.z0], hi = [b.x1, b.y1, b.z1], oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
          let ok = true, axis = -1, sign = 0;
          for (let k = 0; k < 3; k++) {
            if (Math.abs(dd[k]) < 1e-9) { if (oo[k] < lo[k] || oo[k] > hi[k]) { ok = false; break; } continue; }
            let ta = (lo[k] - oo[k]) / dd[k], tb = (hi[k] - oo[k]) / dd[k], s = -1;
            if (ta > tb) { [ta, tb] = [tb, ta]; s = 1; }
            if (ta > t0) { t0 = ta; axis = k; sign = s; }
            t1 = Math.min(t1, tb);
            if (t0 > t1) { ok = false; break; }
          }
          if (ok && t0 < bt && t0 > 0) { bt = t0; n = [0, 0, 0]; if (axis >= 0) n[axis] = sign; best = { t: t0, box: b, normal: new V3(n[0], n[1], n[2]) }; }
        }
      }
      if (best && t > bt + cell) break;
    }
    if (best) best.point = new V3(o.x + d.x * best.t, o.y + d.y * best.t, o.z + d.z * best.t);
    return best;
  }
  return { add, list, ground, resolve, ray, near };
})();
MAP.colliders = COL.list;

// ---------------- bullet holes (instanced decals on the map) ----------------
const HOLES = (() => {
  const N = 600;
  const tex = canvasTex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(8,7,6,1)'); gr.addColorStop(0.35, 'rgba(20,18,16,.95)'); gr.addColorStop(0.6, 'rgba(60,55,50,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.07, 0.07), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 1 }), N);
  mesh.count = 0; mesh.frustumCulled = false; scene.add(mesh);
  let i = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3();
  return {
    add(p, n, size = 1) {
      q.setFromUnitVectors(new V3(0, 0, 1), n);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), Math.random() * 6.28));
      m4.compose(p.clone().addScaledVector(n, 0.004), q, s.setScalar(size * rand(0.8, 1.25)));
      mesh.setMatrixAt(i, m4); i = (i + 1) % N; mesh.count = Math.min(N, mesh.count + 1);
      mesh.instanceMatrix.needsUpdate = true;
    },
    clear() { mesh.count = 0; i = 0; },
  };
})();

// ---------------- sky: gradient dome, stars, moon, horizon mountains ----------------
const SKY = (() => {
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 top = vec3(0.012,0.016,0.035); vec3 hor = vec3(0.05,0.06,0.09); vec3 glow = vec3(0.10,0.085,0.07); float t = smoothstep(-0.05,0.5,h); vec3 c = mix(hor, top, t); c += glow * exp(-abs(h)*14.0) * 0.6; gl_FragColor = vec4(c,1.); }',
  }));
  dome.renderOrder = -10; scene.add(dome);
  const N = 2600, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = Math.random(), v = Math.random() * 0.95 + 0.05, th = u * Math.PI * 2, ph = Math.acos(v);
    const r = 1300;
    pos.set([Math.sin(ph) * Math.cos(th) * r, Math.cos(ph) * r, Math.sin(ph) * Math.sin(th) * r], i * 3);
    const b = Math.pow(Math.random(), 3) * 0.9 + 0.1, tint = Math.random();
    col.set([b * (0.85 + tint * 0.15), b * 0.9, b * (1 - tint * 0.1 + 0.1)], i * 3);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false, transparent: true }));
  stars.renderOrder = -9; scene.add(stars);
  const moonDir = new V3(-0.45, 0.55, -0.7).normalize();
  const moonTex = canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(235,238,245,1)'); gr.addColorStop(0.28, 'rgba(225,230,240,1)'); gr.addColorStop(0.31, 'rgba(160,175,210,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(150,155,170,.35)'; for (const [x, y, r] of [[56, 58, 7], [72, 70, 5], [64, 48, 4], [52, 72, 3]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  });
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, fog: false, depthWrite: false, toneMapped: false }));
  moon.scale.setScalar(150); moon.renderOrder = -8; scene.add(moon);
  // horizon mountain ring (silhouettes, unaffected by fog so they read against the sky)
  const ring = new THREE.Group();
  for (const [r, hgt, col2, segs] of [[1050, 170, 0x0b0d14, 90], [820, 110, 0x0d1018, 110]]) {
    const pts = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const n = fbm(Math.cos(a) * 3 + r, Math.sin(a) * 3) * 0.8 + fbm(Math.cos(a) * 9, Math.sin(a) * 9 + r) * 0.35;
      const h = hgt * (0.25 + n * 0.9);
      pts.push(Math.cos(a) * r, -20, Math.sin(a) * r, Math.cos(a) * r * 0.985, h, Math.sin(a) * r * 0.985);
      if (i < segs) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setIndex(idx); g.computeVertexNormals();
    ring.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col2, fog: false, side: THREE.DoubleSide })));
  }
  scene.add(ring);
  const moonLight = new THREE.DirectionalLight(0xa6b8e4, 0.95);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  const sc = moonLight.shadow.camera; sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42; sc.near = 1; sc.far = 260;
  moonLight.shadow.bias = -0.0006; moonLight.shadow.normalBias = 0.04;
  scene.add(moonLight, moonLight.target);
  return {
    moonDir, moonLight,
    update(cam, focus) {
      dome.position.copy(cam.position); stars.position.copy(cam.position); ring.position.set(cam.position.x, 0, cam.position.z);
      moon.position.copy(cam.position).addScaledVector(moonDir, 1250);
      // shadow frustum follows the player, snapped to texels to avoid shimmering
      const snap = 84 / 2048;
      const fx = Math.round(focus.x / snap) * snap, fz = Math.round(focus.z / snap) * snap;
      moonLight.target.position.set(fx, 0, fz);
      moonLight.position.set(fx + moonDir.x * 120, moonDir.y * 120, fz + moonDir.z * 120);
    },
  };
})();

// ---------------- lamp pool: hundreds of lamps, only the nearest few are real lights ----------------
const LAMPS = (() => {
  const N = 10, pool = [];
  for (let i = 0; i < N; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 2); scene.add(l); pool.push({ l, lamp: null, cur: 0 }); }
  let haloPts = null, timer = 0;
  function buildHalos() {
    const tex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
    const L = MAP.lamps.filter((l) => l.halo > 0);
    const pos = new Float32Array(L.length * 3), col = new Float32Array(L.length * 3);
    L.forEach((l, i) => { pos.set([l.p.x, l.p.y, l.p.z], i * 3); col.set([l.color.r * l.halo * 0.8, l.color.g * l.halo * 0.8, l.color.b * l.halo * 0.8], i * 3); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    haloPts = new THREE.Points(g, new THREE.PointsMaterial({ map: tex, size: 1.6, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    scene.add(haloPts);
  }
  return {
    init: buildHalos,
    update(dt, focus, time) {
      timer -= dt;
      if (timer <= 0) {
        timer = 0.25;
        const ranked = MAP.lamps.map((l) => ({ l, d: l.p.distanceTo(focus) - l.range * 0.6 })).sort((a, b) => a.d - b.d).slice(0, N + 4).map((x) => x.l);
        const keep = new Set(ranked.slice(0, N + 4));
        for (const s of pool) if (s.lamp && !keep.has(s.lamp)) s.lamp = null;
        for (const l of ranked.slice(0, N)) {
          if (pool.some((s) => s.lamp === l)) continue;
          const free = pool.find((s) => !s.lamp);
          if (!free) break;
          free.lamp = l; free.cur = 0;
          free.l.position.copy(l.p); free.l.color.copy(l.color); free.l.distance = l.range;
        }
      }
      for (const s of pool) {
        const target = s.lamp ? s.lamp.intensity * (s.lamp.flicker ? 1 - s.lamp.flicker * (Math.random() < 0.06 ? Math.random() : 0) : 1) : 0;
        s.cur = damp(s.cur, target, 6, dt);
        s.l.intensity = s.cur;
      }
    },
  };
})();
