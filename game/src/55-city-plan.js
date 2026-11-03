// =====================================================================
//  CITY — planning: occupancy grid, street network, lots along streets, gap filling
// =====================================================================
// A 1 m occupancy grid covers the whole world. Streets are stamped first, then buildings are
// placed as rotated lots fronting each street (so frontages follow curves), and whatever space
// remains inside dense quarters becomes solid back-of-block mass, courtyards or yards.
const GR = (() => {
  const H = 960, N = H * 2, cells = new Uint8Array(N * N), road = new Uint16Array(N * N);
  // cell values
  const FREE = 0, STREET = 1, PAVE = 2, BUILT = 3, RESERVED = 4, WALL = 5;
  const idx = (x, z) => { const i = Math.floor(x + H), j = Math.floor(z + H); return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i; };
  return {
    H, N, cells, road, FREE, STREET, PAVE, BUILT, RESERVED, WALL,
    get(x, z) { const k = idx(x, z); return k < 0 ? WALL : cells[k]; },
    set(x, z, v) { const k = idx(x, z); if (k >= 0) cells[k] = v; },
    roadAt(x, z) { const k = idx(x, z); return k < 0 ? 0 : road[k]; },
    // stamp a filled rectangle (rotated) with value v; only overwrites cells with value < v unless force
    rect(cx, cz, w, d, ry, v, force = false) {
      const c = Math.cos(ry), s = Math.sin(ry), step = 0.5;
      for (let a = -w / 2; a <= w / 2 + 1e-6; a += step) for (let b = -d / 2; b <= d / 2 + 1e-6; b += step) {
        const x = cx + a * c + b * s, z = cz - a * s + b * c, k = idx(x, z);
        if (k >= 0 && (force || cells[k] < v)) cells[k] = v;
      }
    },
    // is the rotated rectangle entirely free? (margin grows it)
    free(cx, cz, w, d, ry, margin = 0, ok = FREE) {
      const c = Math.cos(ry), s = Math.sin(ry), W2 = w / 2 + margin, D2 = d / 2 + margin, step = 0.7;
      // coarse pass first (most rejections happen here)
      for (let a = -W2; a <= W2 + 1e-6; a += Math.max(1, W2 / 3)) for (let b = -D2; b <= D2 + 1e-6; b += Math.max(1, D2 / 3)) if (this.get(cx + a * c + b * s, cz - a * s + b * c) > ok) return false;
      for (let a = -W2; a <= W2 + 1e-6; a += step) for (let b = -D2; b <= D2 + 1e-6; b += step) {
        const x = cx + a * c + b * s, z = cz - a * s + b * c;
        if (this.get(x, z) > ok) return false;
      }
      return true;
    },
    // stamp a street ribbon along polyline points: each segment as a rectangle (slightly overlapping
    // its neighbours), round caps only at the two ends
    street(pts, w, v = STREET, id = 0) {
      const r = w / 2, put = (x, z) => { const kk = idx(x, z); if (kk < 0) return; if (cells[kk] < v || cells[kk] === BUILT) cells[kk] = v; if (id && !road[kk]) road[kk] = id; };
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az);
        if (L < 1e-6) continue;
        const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux;
        const t0 = i === 0 ? -r : -1.0, t1 = i === pts.length - 2 ? L + r : L + 1.0;
        for (let t = t0; t <= t1; t += 0.5) for (let k = -r; k <= r; k += 0.5) {
          if (t < 0 && i === 0 && t * t + k * k > r * r) continue;
          if (t > L && i === pts.length - 2 && (t - L) ** 2 + k * k > r * r) continue;
          put(ax + ux * t + nx * k, az + uz * t + nz * k);
        }
      }
      if (pts.length === 1 || (pts.length === 2 && Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) < 0.1)) { const [x, z] = pts[0]; for (let a = -r; a <= r; a += 0.5) for (let b = -r; b <= r; b += 0.5) if (a * a + b * b <= r * r) put(x + a, z + b); }
    },
  };
})();

// ---------------- polylines ----------------
// Catmull-Rom through control points, resampled every `step` metres
function smoothPath(ctrl, step = 2) {
  if (ctrl.length < 2) return ctrl.slice();
  const P = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]], out = [];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}
function pathLength(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
// point + unit tangent at arclength s
function pathAt(pts, s) {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + L >= s || i === pts.length - 1) {
      const t = L > 0 ? clamp((s - acc) / L, 0, 1) : 0, tx = (pts[i][0] - pts[i - 1][0]) / (L || 1), tz = (pts[i][1] - pts[i - 1][1]) / (L || 1);
      return { x: lerp(pts[i - 1][0], pts[i][0], t), z: lerp(pts[i - 1][1], pts[i][1], t), tx, tz };
    }
    acc += L;
  }
  const n = pts.length - 1; return { x: pts[n][0], z: pts[n][1], tx: 1, tz: 0 };
}
// meandering path between two points (for organic streets)
function wiggle(a, b, amp, seg = 4, seed = 0) {
  const pts = [a];
  for (let i = 1; i < seg; i++) {
    const t = i / seg, x = lerp(a[0], b[0], t), z = lerp(a[1], b[1], t), dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    const o = (vnoise(t * 3 + seed, seed * 1.7) - 0.5) * 2 * amp;
    pts.push([x - dz / L * o, z + dx / L * o]);
  }
  pts.push(b);
  return pts;
}

// ---------------- streets registry ----------------
const STREETS = [];
// kind: alley | lane | street | avenue | boulevard | souk | service ; w = full width (incl. pavements)
function addStreet(ctrl, w, kind, o = {}) {
  const pts = o.raw ? ctrl : smoothPath(ctrl, 2);
  const s = { id: STREETS.length + 1, pts, w, kind, district: o.district, road: o.road ?? 0, walk: o.walk ?? 0, len: pathLength(pts), ...o };
  STREETS.push(s);
  GR.street(pts, w, GR.STREET, 0);
  GR.street(pts, s.road > 0 ? s.road : Math.max(1, w - 1), GR.STREET, s.id);   // carriageway owns the road-id cells
  return s;
}

// ---------------- lots along a street ----------------
// places rotated lots fronting the street on one side (side=+1 right, −1 left of travel direction)
function lotsAlong(st, side, o) {
  const lots = [], L = st.len, setback = st.w / 2 + (o.setback ?? 0.2);
  let s = o.start ?? 1.5;
  while (s < L - (o.end ?? 1.5)) {
    let placed = false;
    for (let tw = 0; tw < 3 && !placed; tw++) {
      const w = tw === 0 ? mr(o.wMin, o.wMax) : tw === 1 ? o.wMin : o.wMin * 0.8;
      if (s + w > L) break;
      const p = pathAt(st.pts, s + w / 2);
      const nx = -p.tz * side, nz = p.tx * side;          // outward normal (away from the street)
      const ry = Math.atan2(-nx, -nz);                    // local +Z faces the street
      for (let d = o.dMax; d >= o.dMin - 1e-6; d -= o.dStep ?? 1.5) {
        const cx = p.x + nx * (setback + d / 2), cz = p.z + nz * (setback + d / 2);
        if (o.region && !o.region(cx, cz)) continue;
        if (!GR.free(cx, cz, w - 1.4, d - 1.4, ry, o.margin ?? 0)) continue;   // 0.7 m tolerance for 1 m grid rounding
        const lot = { cx, cz, w, d, ry, street: st, side, s: s + w / 2 };
        GR.rect(cx, cz, w + (o.pad ?? 0.4), d + (o.pad ?? 0.4), ry, GR.BUILT);
        lots.push(lot); s += w + (o.gap ? o.gap() : 0); placed = true; break;
      }
    }
    if (!placed) s += o.skip ?? 2;
  }
  return lots;
}
// which sides of a lot face open ground (street / plaza) — decides windows, back doors
function lotOpenSides(lot, probe = 2.2) {
  const c = Math.cos(lot.ry), s = Math.sin(lot.ry), open = {};
  const test = (lx, lz) => { const x = lot.cx + lx * c + lz * s, z = lot.cz - lx * s + lz * c, v = GR.get(x, z); return v === GR.STREET || v === GR.PAVE; };
  const sample = (fn) => { let k = 0; for (let t = -0.35; t <= 0.35; t += 0.175) if (fn(t)) k++; return k >= 3; };
  open.s = true;
  open.n = sample((t) => test(t * lot.w, -lot.d / 2 - probe));
  open.e = sample((t) => test(lot.w / 2 + probe, t * lot.d));
  open.w = sample((t) => test(-lot.w / 2 - probe, t * lot.d));
  return open;
}
// greedy rectangles over free cells inside a region (coarse 2 m cells) → back-of-block masses
function fillFree(x0, z0, x1, z1, inside, o = {}) {
  const cs = o.cell ?? 2, nx = Math.floor((x1 - x0) / cs), nz = Math.floor((z1 - z0) / cs);
  const free = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + (i + 0.5) * cs, z = z0 + (j + 0.5) * cs;
    if (inside && !inside(x, z)) continue;
    let ok = true;
    for (let a = -cs / 2 + 0.25; a < cs / 2 && ok; a += 0.5) for (let b = -cs / 2 + 0.25; b < cs / 2 && ok; b += 0.5) if (GR.get(x + a, z + b) !== GR.FREE) ok = false;
    free[j * nx + i] = ok ? 1 : 0;
  }
  const rects = [], maxC = Math.round((o.max ?? 14) / cs);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    if (!free[j * nx + i]) continue;
    let w = 1; while (i + w < nx && w < maxC && free[j * nx + i + w]) w++;
    let h = 1; outer: while (j + h < nz && h < maxC) { for (let k = 0; k < w; k++) if (!free[(j + h) * nx + i + k]) break outer; h++; }
    for (let b = 0; b < h; b++) for (let a = 0; a < w; a++) free[(j + b) * nx + i + a] = 0;
    if (w * h * cs * cs < (o.minA ?? 6)) continue;
    rects.push({ cx: x0 + (i + w / 2) * cs, cz: z0 + (j + h / 2) * cs, w: w * cs, d: h * cs, ry: 0 });
  }
  for (const r of rects) GR.rect(r.cx, r.cz, r.w, r.d, 0, GR.BUILT);
  return rects;
}

// ---------------- ground surfaces ----------------
// flat paved/cobbled plate split into chunk tiles (keeps culling effective)
// hole: a rectangle left uncovered (a lake, a pool): tiles that overlap it are cut round it
function groundPlate(x0, z0, x1, z1, col, t, wear = 3, y = 0.03, inside = null, hole = null) {
  const cs = 32, tile = (ax, az, bx, bz) => { if (bx - ax > 0.01 && bz - az > 0.01) W.box(bx - ax, 0.06, bz - az, (ax + bx) / 2, y - 0.03, (az + bz) / 2, col, { t, wear, ao: false, jit: 0 }); };
  for (let x = x0; x < x1 - 0.01; x += cs) for (let z = z0; z < z1 - 0.01; z += cs) {
    const a = Math.min(cs, x1 - x), b = Math.min(cs, z1 - z);
    if (inside && !inside(x + a / 2, z + b / 2)) continue;
    const H = hole; if (!H || x + a <= H.x0 || x >= H.x1 || z + b <= H.z0 || z >= H.z1) { tile(x, z, x + a, z + b); continue; }
    const hx0 = Math.max(x, H.x0), hx1 = Math.min(x + a, H.x1);
    tile(x, z, hx0, z + b); tile(hx1, z, x + a, z + b); tile(hx0, z, hx1, Math.max(z, H.z0)); tile(hx0, Math.min(z + b, H.z1), hx1, z + b);
  }
}
// ribbon along a polyline: band from offset r0 to r1 (signed, metres from centre line) at height y
function ribbon(pts, r0, r1, y, col, t, o = {}) {
  let tri = [];
  // flush every ~16 segments into a batch centred on that stretch, so chunks cull properly
  const flush = () => {
    if (!tri.length) return;
    let cx = 0, cz = 0; const n = tri.length / 3;
    for (let i = 0; i < tri.length; i += 3) { cx += tri[i]; cz += tri[i + 2]; }
    cx /= n; cz /= n;
    const a = new Float32Array(tri); for (let i = 0; i < a.length; i += 3) { a[i] -= cx; a[i + 2] -= cz; }
    W.push(cx, 0, cz); W.tris(a, col, { t, wear: o.wear ?? 3, ao: false, jit: 0, lod: o.lod ?? 0 }); W.pop();
    tri = [];
  };
  const norm = (i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; return [-dz / L, dx / L]; };
  for (let i = 0; i < pts.length - 1; i++) {
    if (i % 16 === 0) flush();
    if (o.skip && o.skip(i)) continue;
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], na = norm(i), nb = norm(i + 1);
    const p = (q, n, r) => [q[0] + n[0] * r, q[1] + n[1] * r];
    const A0 = p([ax, az], na, r0), A1 = p([ax, az], na, r1), B0 = p([bx, bz], nb, r0), B1 = p([bx, bz], nb, r1);
    // top (two triangles, wound for an upward normal whichever way r0/r1 run)
    const up = r1 > r0;
    if (up) tri.push(A0[0], y, A0[1], A1[0], y, A1[1], B1[0], y, B1[1], A0[0], y, A0[1], B1[0], y, B1[1], B0[0], y, B0[1]);
    else tri.push(A0[0], y, A0[1], B1[0], y, B1[1], A1[0], y, A1[1], A0[0], y, A0[1], B0[0], y, B0[1], B1[0], y, B1[1]);
    if (o.curb !== undefined) { // vertical face at r0 from o.curb up to y
      const yb = o.curb;
      tri.push(A0[0], yb, A0[1], A0[0], y, A0[1], B0[0], y, B0[1], A0[0], yb, A0[1], B0[0], y, B0[1], B0[0], yb, B0[1]);
      tri.push(A0[0], yb, A0[1], B0[0], y, B0[1], A0[0], y, A0[1], A0[0], yb, A0[1], B0[0], yb, B0[1], B0[0], y, B0[1]);
    }
    if (o.solid) { const cx = (A0[0] + A1[0] + B0[0] + B1[0]) / 4, cz = (A0[1] + A1[1] + B0[1] + B1[1]) / 4, Lg = Math.hypot(bx - ax, bz - az) + 0.05; W.solid(Lg, y + 0.02, Math.abs(r1 - r0), cx, y / 2, cz, o.mat ?? 'stone', { ry: Math.atan2(-(bz - az), bx - ax), walk: true }); }
  }
  flush();
}
// a full road: asphalt carriageway, kerbs + raised pavements that open up where other roads cross
function roadway(st, o = {}) {
  const pts = st.pts, rw = st.road / 2, pw = st.walk;
  const crossing = (i, r) => { const a = pts[i], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; const x = (a[0] + b[0]) / 2 - dz / L * r, z = (a[1] + b[1]) / 2 + dx / L * r; const id = GR.roadAt(x, z); return id && id !== st.id && STREETS[id - 1]?.road > 0; };
  ribbon(pts, -rw, rw, 0.025, o.asphalt ?? MC.asphalt, TX.asphalt, { wear: o.wear ?? 3 });
  if (pw > 0) for (const s of [-1, 1]) {
    const r0 = s * rw, r1 = s * (rw + pw);
    ribbon(pts, r0, r1, 0.16, o.pave ?? MC.paving, o.paveTx ?? TX.paving, { curb: 0.0, solid: true, skip: (i) => crossing(i, s * (rw + pw / 2)), wear: 3 });
    ribbon(pts, r0, r0 + s * 0.2, 0.165, MC.curb, TX.stone, { skip: (i) => crossing(i, s * (rw + pw / 2)), lod: 1, wear: 5 });
  }
  // lane markings: centre dashes (and a median kerb on boulevards)
  if (st.median) { ribbon(pts, -st.median / 2, st.median / 2, 0.2, MC.curb, TX.stone, { curb: 0.0, solid: true, skip: (i) => crossing(i, 0) }); ribbon(pts, -st.median / 2 + 0.25, st.median / 2 - 0.25, 0.205, 0x5a5236, TX.earth, { lod: 1, skip: (i) => crossing(i, 0) }); }
  else if (st.road >= 7) W.scope({ lod: 1 }, () => { for (let s = 3; s < st.len - 3; s += 6) { const p = pathAt(pts, s); if (GR.roadAt(p.x, p.z) !== st.id) continue; W.box(3, 0.01, 0.12, p.x, 0.032, p.z, 0xe8e4d8, { ry: Math.atan2(-p.tz, p.tx), ao: false, t: TX.none, jit: 0.1 }); } });
}
