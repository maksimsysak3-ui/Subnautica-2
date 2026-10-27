// =====================================================================
//  Track model: control points + painted features, sampled into an
//  evenly spaced strip that geometry, physics and timing all read from.
// =====================================================================
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth01 = (t) => t * t * (3 - 2 * t);

const STEP = 2;            // metres between track samples
const KERB_W = 1.6;        // kerb strip width
const VERGE = 7;           // grass between road edge and barrier when no run-off is painted
const MIN_RADIUS = 14;     // tighter than this is flagged as undrivable for an F1 car
const SURF = { road: 0, kerb: 1, asphalt: 2, gravel: 3, grass: 4 };
const SURF_NAMES = ['TRACK', 'KERB', 'RUN-OFF', 'GRAVEL', 'GRASS'];
const RUN_CODES = { asphalt: SURF.asphalt, gravel: SURF.gravel, grass: SURF.grass };
const KERB_CODES = { flat: 1, sausage: 2 };

function defaultSettings() {
  return { barriers: true, scenery: true, tod: 15.5, livery: 0, kerbStyle: 'flat', runSurf: 'gravel', runW: 14 };
}

const state = {
  name: 'New circuit',
  points: [],          // {x, z, y, w, bank}
  closed: false,
  features: [],        // {kind:'kerb'|'runoff', side:1|-1, u0, u1, style|surf, width}
  settings: defaultSettings(),
};

// Number of spline segments: closed loops have one per point, open paths one fewer.
const segCount = () => (state.closed ? state.points.length : Math.max(0, state.points.length - 1));

// ---------------------------------------------------------------------
//  Sample the spline
// ---------------------------------------------------------------------
let S = null;          // current sampled track (see buildSamples)
let curve = null;

function scalarCR(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
function pointScalar(key, u) {
  const P = state.points, n = P.length;
  const i = Math.floor(u), t = u - i;
  const at = (k) => (state.closed ? P[((k % n) + n) % n][key] : P[clamp(k, 0, n - 1)][key]);
  return scalarCR(at(i - 1), at(i), at(i + 1), at(i + 2), t);
}

function buildSamples() {
  const P = state.points;
  const segs = segCount();
  if (P.length < 2 || segs < 1) { S = null; curve = null; return; }
  curve = new THREE.CatmullRomCurve3(P.map((p) => new THREE.Vector3(p.x, p.y, p.z)), state.closed, 'centripetal');

  // Dense pass for an arc-length table.
  const fine = segs * 48;
  const fu = new Float64Array(fine + 1), fd = new Float64Array(fine + 1);
  const v = new THREE.Vector3(), prev = new THREE.Vector3();
  curve.getPoint(0, prev);
  for (let k = 1; k <= fine; k++) {
    curve.getPoint(k / fine, v);
    fd[k] = fd[k - 1] + Math.hypot(v.x - prev.x, v.y - prev.y, v.z - prev.z);
    fu[k] = (k / fine) * segs;
    prev.copy(v);
  }
  const L = fd[fine];
  if (L < 4) { S = null; return; }
  const n = Math.max(4, Math.round(L / STEP));
  const step = L / n;
  const count = state.closed ? n : n + 1;

  const s = {
    n: count, closed: state.closed, L, step,
    px: new Float32Array(count), py: new Float32Array(count), pz: new Float32Array(count),
    tx: new Float32Array(count), tz: new Float32Array(count),
    u: new Float32Array(count), w: new Float32Array(count), roll: new Float32Array(count), k: new Float32Array(count),
    kerb: [new Uint8Array(count), new Uint8Array(count)],       // [left, right] style code
    runW: [new Float32Array(count), new Float32Array(count)],
    runS: [new Uint8Array(count), new Uint8Array(count)],
    bar: [new Float32Array(count), new Float32Array(count)],    // barrier distance from centre
    lim: [new Float32Array(count), new Float32Array(count)],    // max usable offset (inside of tight bends)
  };
  let j = 0;
  for (let i = 0; i < count; i++) {
    const target = i * step;
    while (j < fine - 1 && fd[j + 1] < target) j++;
    const span = fd[j + 1] - fd[j] || 1;
    const u = fu[j] + ((target - fd[j]) / span) * (fu[j + 1] - fu[j]);
    s.u[i] = Math.min(u, segs - 1e-6);
    curve.getPoint(s.u[i] / segs, v);
    s.px[i] = v.x; s.py[i] = v.y; s.pz[i] = v.z;
    s.w[i] = clamp(pointScalar('w', s.u[i]), 6, 30);
  }
  // Horizontal tangents from neighbours (smoother than the analytic tangent across uneven segments).
  const idx = (i) => (s.closed ? (i + count) % count : clamp(i, 0, count - 1));
  for (let i = 0; i < count; i++) {
    const a = idx(i - 1), b = idx(i + 1);
    let dx = s.px[b] - s.px[a], dz = s.pz[b] - s.pz[a];
    const l = Math.hypot(dx, dz) || 1;
    s.tx[i] = dx / l; s.tz[i] = dz / l;
  }
  // Signed curvature (+ = left turn), smoothed so geometry offsets don't ripple.
  const raw = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = idx(i - 1), b = idx(i + 1);
    const cross = s.tx[a] * s.tz[b] - s.tz[a] * s.tx[b];          // sin of heading change, sign: right turn > 0
    const dot = s.tx[a] * s.tx[b] + s.tz[a] * s.tz[b];
    raw[i] = -Math.atan2(cross, dot) / (2 * step);
  }
  for (let i = 0; i < count; i++) {
    let acc = 0, wsum = 0;
    for (let o = -4; o <= 4; o++) { const wt = 5 - Math.abs(o); acc += raw[idx(i + o)] * wt; wsum += wt; }
    s.k[i] = acc / wsum;
  }
  // Banking follows the corner: + banks into the bend, - is off-camber, fades to flat on straights.
  for (let i = 0; i < count; i++) {
    const b = pointScalar('bank', s.u[i]) * Math.PI / 180;
    s.roll[i] = b * clamp(s.k[i] * 150, -1, 1);
  }
  applyFeatures(s);
  S = s;
  buildSpatialIndex();
}

// Left normal of the driving direction. Lateral offsets d > 0 are on the left.
const leftX = (i) => S.tz[i];
const leftZ = (i) => -S.tx[i];
// Road surface height at lateral offset d from the centre of sample i.
const crossY = (i, d) => S.py[i] - d * Math.tan(S.roll[i]);

// Which side (1 = left, -1 = right) is the inside of the bend at sample i, and the
// largest offset usable there before ribbons would fold over themselves.
function sideLimit(s, i, side) {
  const k = s.k[i];
  if (k * side > 0) return 0.9 / Math.abs(k);
  return 1e9;
}

function featureCovers(f, u, segs) {
  if (u >= f.u0 && u <= f.u1) return true;
  if (state.closed && u + segs >= f.u0 && u + segs <= f.u1) return true;
  return false;
}

function applyFeatures(s) {
  const segs = segCount();
  for (let i = 0; i < s.n; i++) {
    for (let k = 0; k < 2; k++) { s.kerb[k][i] = 0; s.runW[k][i] = 0; s.runS[k][i] = SURF.grass; }
  }
  for (const f of state.features) {
    const k = f.side > 0 ? 0 : 1;
    for (let i = 0; i < s.n; i++) {
      if (!featureCovers(f, s.u[i], segs)) continue;
      if (f.kind === 'kerb') s.kerb[k][i] = KERB_CODES[f.style] || 1;
      else { s.runW[k][i] = Math.max(s.runW[k][i], f.width); s.runS[k][i] = RUN_CODES[f.surf] ?? SURF.gravel; }
    }
  }
  const idx = (i) => (s.closed ? (i + s.n) % s.n : clamp(i, 0, s.n - 1));
  for (let k = 0; k < 2; k++) {
    const side = k === 0 ? 1 : -1;
    const raw = new Float32Array(s.n);
    for (let i = 0; i < s.n; i++) {
      s.lim[k][i] = sideLimit(s, i, side);
      const edge = s.w[i] / 2 + (s.kerb[k][i] ? KERB_W : 0);
      raw[i] = edge + Math.max(VERGE, s.runW[k][i]);
    }
    // Barriers: widen early and taper back slowly so the wall reads as one smooth line.
    const W = 40;
    for (let i = 0; i < s.n; i++) {
      let m = 0;
      for (let o = -W; o <= W; o++) {
        const v = raw[idx(i + o)] - Math.abs(o) * 0.35;
        if (v > m) m = v;
      }
      s.bar[k][i] = Math.min(m, s.lim[k][i]);
    }
  }
}

// ---------------------------------------------------------------------
//  Spatial index + projection onto the track
// ---------------------------------------------------------------------
const CELL = 24;
let grid = new Map();
function buildSpatialIndex() {
  grid = new Map();
  for (let i = 0; i < S.n; i++) {
    const key = Math.floor(S.px[i] / CELL) * 73856093 ^ Math.floor(S.pz[i] / CELL) * 19349663;
    let b = grid.get(key);
    if (!b) grid.set(key, (b = []));
    b.push(i);
  }
}
function nearestSample(x, z, hint = -1) {
  if (!S) return -1;
  let best = -1, bd = Infinity;
  const test = (i) => {
    const dx = S.px[i] - x, dz = S.pz[i] - z, d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  };
  if (hint >= 0 && hint < S.n) {
    for (let o = -30; o <= 30; o++) {
      const i = S.closed ? (hint + o + S.n) % S.n : hint + o;
      if (i >= 0 && i < S.n) test(i);
    }
    // Trust the local search unless we are clearly far from the strip (e.g. teleported or cut across).
    if (bd < 40 * 40) return best;
  }
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  for (let r = 1; r <= 40 && best < 0; r += 3) {
    for (let gx = cx - r; gx <= cx + r; gx++) for (let gz = cz - r; gz <= cz + r; gz++) {
      const b = grid.get(gx * 73856093 ^ gz * 19349663);
      if (b) for (const i of b) test(i);
    }
  }
  if (best < 0) for (let i = 0; i < S.n; i += 1) test(i);
  return best;
}
// Exact projection onto the centreline polyline around the nearest sample.
// Returns {i, t, d (lateral, + left), dist (along track), y (road height at that offset)}.
function project(x, z, hint = -1) {
  const i0 = nearestSample(x, z, hint);
  if (i0 < 0) return null;
  let best = null;
  for (const a of [i0 - 1, i0]) {
    let ia = a, ib = a + 1;
    if (S.closed) { ia = (ia + S.n) % S.n; ib = (ib + S.n) % S.n; }
    else if (ia < 0 || ib >= S.n) continue;
    const ax = S.px[ia], az = S.pz[ia], bx = S.px[ib], bz = S.pz[ib];
    const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez || 1;
    const t = clamp(((x - ax) * ex + (z - az) * ez) / l2, 0, 1);
    const qx = ax + ex * t, qz = az + ez * t;
    const dd = (x - qx) ** 2 + (z - qz) ** 2;
    if (!best || dd < best.dd) best = { ia, ib, t, dd, qx, qz };
  }
  if (!best) return null;
  const i = best.t < 0.5 ? best.ia : best.ib;
  const lx = lerp(leftX(best.ia), leftX(best.ib), best.t), lz = lerp(leftZ(best.ia), leftZ(best.ib), best.t);
  const d = (x - best.qx) * lx + (z - best.qz) * lz;
  const cy = lerp(S.py[best.ia], S.py[best.ib], best.t);
  const roll = lerp(S.roll[best.ia], S.roll[best.ib], best.t);
  const dist = (best.ia + best.t) * S.step;
  return { i, ia: best.ia, ib: best.ib, t: best.t, d, dist, cy, roll };
}

// ---------------------------------------------------------------------
//  Analysis
// ---------------------------------------------------------------------
function analyse() {
  const out = { length: 0, corners: 0, minR: Infinity, climb: 0, issues: [] };
  const P = state.points;
  if (P.length < 3) { out.issues.push({ lvl: 'warn', text: 'Click on the ground to place at least 3 points.' }); return out; }
  if (!S) return out;
  out.length = S.L;
  let inCorner = false;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < S.n; i++) {
    const r = 1 / Math.max(1e-6, Math.abs(S.k[i]));
    if (r < out.minR) out.minR = r;
    if (r < 160 && !inCorner) { out.corners++; inCorner = true; } else if (r > 260) inCorner = false;
    lo = Math.min(lo, S.py[i]); hi = Math.max(hi, S.py[i]);
  }
  out.climb = hi - lo;
  if (!state.closed) out.issues.push({ lvl: 'bad', text: 'Track is open. Drag the last point onto the first (or click the first point) to close the loop.' });
  if (out.minR < MIN_RADIUS) out.issues.push({ lvl: 'bad', text: `A corner is too tight (${out.minR.toFixed(0)} m radius). Spread the points out.` });
  else if (out.minR < 22) out.issues.push({ lvl: 'warn', text: `Hairpin of ${out.minR.toFixed(0)} m radius: first gear stuff.` });
  if (S.L < 800 && state.closed) out.issues.push({ lvl: 'warn', text: 'Short lap. Real circuits run 3–7 km.' });
  const cross = findCrossing();
  if (cross) out.issues.push({ lvl: cross.bridge ? 'warn' : 'bad', text: cross.bridge ? 'Track crosses itself on a bridge.' : 'Track crosses itself. Raise one part 7 m+ to build a bridge.' });
  // Steep grades: real tracks stay under ~12 %.
  let maxGrade = 0;
  for (let i = 1; i < S.n; i++) maxGrade = Math.max(maxGrade, Math.abs(S.py[i] - S.py[i - 1]) / S.step);
  if (maxGrade > 0.14) out.issues.push({ lvl: 'warn', text: `Very steep slope (${(maxGrade * 100).toFixed(0)} %).` });
  if (!out.issues.length) out.issues.push({ lvl: 'ok', text: 'Ready to drive.' });
  return out;
}

function findCrossing() {
  const n = S.n, stride = 2;
  const segs = [];
  for (let i = 0; i + stride < n + (S.closed ? stride : 0); i += stride) {
    const a = i % n, b = (i + stride) % n;
    if (!S.closed && i + stride >= n) break;
    segs.push([a, b]);
  }
  const cell = new Map();
  const key = (x, z) => Math.floor(x / 30) * 92821 + Math.floor(z / 30);
  segs.forEach((sg, k) => {
    const x = (S.px[sg[0]] + S.px[sg[1]]) / 2, z = (S.pz[sg[0]] + S.pz[sg[1]]) / 2;
    const kk = key(x, z);
    (cell.get(kk) || cell.set(kk, []).get(kk)).push(k);
  });
  let found = null;
  const inter = (a, b, c, d) => {
    const x1 = S.px[a], z1 = S.pz[a], x2 = S.px[b], z2 = S.pz[b], x3 = S.px[c], z3 = S.pz[c], x4 = S.px[d], z4 = S.pz[d];
    const den = (x1 - x2) * (z3 - z4) - (z1 - z2) * (x3 - x4);
    if (Math.abs(den) < 1e-9) return false;
    const t = ((x1 - x3) * (z3 - z4) - (z1 - z3) * (x3 - x4)) / den;
    const u = -((x1 - x2) * (z1 - z3) - (z1 - z2) * (x1 - x3)) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };
  for (let k = 0; k < segs.length && !found; k++) {
    const [a, b] = segs[k];
    const x = (S.px[a] + S.px[b]) / 2, z = (S.pz[a] + S.pz[b]) / 2;
    const cx = Math.floor(x / 30), cz = Math.floor(z / 30);
    for (let gx = cx - 1; gx <= cx + 1 && !found; gx++) for (let gz = cz - 1; gz <= cz + 1 && !found; gz++) {
      const list = cell.get(gx * 92821 + gz);
      if (!list) continue;
      for (const m of list) {
        if (Math.abs(m - k) < 6 || (S.closed && segs.length - Math.abs(m - k) < 6)) continue;
        const [c, d] = segs[m];
        if (inter(a, b, c, d)) { found = { bridge: Math.abs(S.py[a] - S.py[c]) >= 7 }; break; }
      }
    }
  }
  return found;
}

// ---------------------------------------------------------------------
//  Editing helpers that keep painted features attached to the layout
// ---------------------------------------------------------------------
function remapFeatures(fn) {
  const segs = segCount();
  state.features = state.features.map((f) => {
    let u0 = fn(f.u0), u1 = fn(f.u1);
    if (u0 == null || u1 == null) return null;
    if (u1 <= u0) u1 += segs;
    if (u1 - u0 < 0.02) return null;
    return { ...f, u0, u1 };
  }).filter(Boolean);
}
// Insert a point after index i at local spline parameter t of segment i.
function insertPoint(i, t, p) {
  const oldSegs = segCount();
  state.points.splice(i + 1, 0, p);
  const N = segCount();
  remapFeatures((u) => {
    const w = state.closed ? ((u % oldSegs) + oldSegs) % oldSegs : u;
    let r;
    if (w < i) r = w;
    else if (w >= i + 1) r = w + 1;
    else { const lt = w - i; r = lt < t ? i + lt / t : i + 1 + (lt - t) / (1 - t); }
    return state.closed ? r % N : r;
  });
}
function deletePoint(j) {
  const oldSegs = segCount();
  const n = state.points.length;
  state.points.splice(j, 1);
  if (state.points.length < 3) state.closed = false;
  const N = segCount();
  if (N < 1) { state.features = []; return; }
  remapFeatures((u) => {
    let w = state.closed ? ((u % oldSegs) + oldSegs) % oldSegs : u;
    let r;
    if (state.closed && j === 0) {
      // Segments n-1 and 0 merge into the new last segment.
      if (w < 1) r = (n - 2) + (w + 1) / 2;
      else if (w >= n - 1) r = (n - 2) + (w - (n - 1)) / 2;
      else r = w - 1;
    } else if (j === 0) r = Math.max(0, w - 1);          // open path: the first segment disappears
    else if (w < j - 1) r = w;
    else if (w < j + 1) r = j - 1 + (w - (j - 1)) / 2;
    else r = w - 1;
    r = Math.min(r, N - 1e-4);
    return state.closed ? r % N : r;
  });
}
// Rotate the loop so point k becomes the start/finish (index 0).
function setStart(k) {
  if (!state.closed || k <= 0) return;
  const N = state.points.length;
  state.points = state.points.slice(k).concat(state.points.slice(0, k));
  remapFeatures((u) => (((u - k) % N) + N) % N);
}
// Merge overlapping features of the same kind/side/look so repeated painting stays tidy.
function addFeature(f) {
  const segs = segCount();
  const same = (g) => g.kind === f.kind && g.side === f.side && (f.kind === 'kerb' ? g.style === f.style : g.surf === f.surf && g.width === f.width);
  const span = (g) => [g.u0, g.u1];
  let [a, b] = span(f);
  const keep = [];
  for (const g of state.features) {
    if (!same(g)) { keep.push(g); continue; }
    let [c, d] = span(g);
    const shifts = state.closed ? [0, segs, -segs] : [0];
    let merged = false;
    for (const sh of shifts) {
      if (c + sh <= b + 0.05 && d + sh >= a - 0.05) { a = Math.min(a, c + sh); b = Math.max(b, d + sh); merged = true; break; }
    }
    if (!merged) keep.push(g);
  }
  if (state.closed) {
    if (b - a >= segs) { a = 0; b = segs; }
    else if (a < 0) { a += segs; b += segs; } else if (a >= segs) { a -= segs; b -= segs; }
  }
  keep.push({ ...f, u0: a, u1: b });
  state.features = keep;
}

// Kerbs on both edges of every corner, run-off on the outside of the faster ones.
function autoKerbs() {
  if (!S) return;
  state.features = state.features.filter((f) => f.kind !== 'kerb');
  forEachCorner((i0, i1, sign) => {
    const pad = 6;
    const a = Math.max(0, i0 - pad), b = Math.min(S.n - 1 + (S.closed ? pad : 0), i1 + pad);
    for (const side of [1, -1]) {
      // The outside kerb runs a bit later (corner exit), the inside one sits around the apex.
      const shift = side === sign ? -2 : 4;
      addFeature({ kind: 'kerb', side, style: state.settings.kerbStyle, u0: uAt(a + shift), u1: uAt(b + shift) });
    }
  });
}
function autoRunoff() {
  if (!S) return;
  state.features = state.features.filter((f) => f.kind !== 'runoff');
  forEachCorner((i0, i1, sign, minR) => {
    const outside = -sign;
    const width = clamp(Math.round(12 + minR / 6), 12, 32);
    const surf = minR > 60 ? state.settings.runSurf : 'asphalt';
    addFeature({ kind: 'runoff', side: outside, surf, width, u0: uAt(i0 - 4), u1: uAt(i1 + 14) });
  });
}
function uAt(i) {
  const segs = segCount();
  if (S.closed) {
    const wraps = Math.floor(i / S.n);
    return S.u[((i % S.n) + S.n) % S.n] + wraps * segs;
  }
  return S.u[clamp(i, 0, S.n - 1)];
}
function forEachCorner(cb) {
  const n = S.n, TH = 1 / 150;
  // Start the scan on a straight so a corner spanning the start line isn't split.
  let start = 0;
  if (S.closed) for (let i = 0; i < n; i++) if (Math.abs(S.k[i]) < TH * 0.5) { start = i; break; }
  let i0 = -1, sign = 0, minR = Infinity;
  for (let o = 0; o <= n; o++) {
    const i = S.closed ? start + o : Math.min(o, n - 1);
    const k = S.k[i % n];
    const inC = Math.abs(k) > TH;
    const sg = Math.sign(k);
    if (inC && i0 < 0) { i0 = i; sign = sg; minR = 1 / Math.abs(k); }
    else if (inC && sg === sign) minR = Math.min(minR, 1 / Math.abs(k));
    if (i0 >= 0 && (!inC || sg !== sign || o === n)) {
      if (i - i0 > 3) cb(i0, i, sign, minR);
      i0 = inC ? i : -1; sign = sg; minR = inC ? 1 / Math.abs(k) : Infinity;
    }
    if (!S.closed && o >= n - 1) break;
  }
}

// ---------------------------------------------------------------------
//  Serialisation + history
// ---------------------------------------------------------------------
function serialise() {
  const r = (v) => Math.round(v * 100) / 100;
  return JSON.stringify({
    v: 1, name: state.name, closed: state.closed,
    points: state.points.map((p) => ({ x: r(p.x), z: r(p.z), y: r(p.y), w: r(p.w), bank: r(p.bank) })),
    features: state.features.map((f) => ({ ...f, u0: Math.round(f.u0 * 1e4) / 1e4, u1: Math.round(f.u1 * 1e4) / 1e4 })),
    settings: state.settings,
  });
}
// Validates untrusted JSON (imports, localStorage) before it touches the state.
function deserialise(text) {
  const o = JSON.parse(text);
  const num = (v, d, a, b) => (Number.isFinite(+v) ? clamp(+v, a, b) : d);
  if (!o || !Array.isArray(o.points)) throw new Error('Not a track file');
  const points = o.points.slice(0, 400).map((p) => ({
    x: num(p.x, 0, -20000, 20000), z: num(p.z, 0, -20000, 20000), y: num(p.y, 0, -20, 40),
    w: num(p.w, 13, 9, 22), bank: num(p.bank, 0, -12, 12),
  }));
  const closed = !!o.closed && points.length >= 3;
  const segs = closed ? points.length : Math.max(0, points.length - 1);
  const features = (Array.isArray(o.features) ? o.features : []).slice(0, 2000).map((f) => {
    const kind = f.kind === 'kerb' ? 'kerb' : f.kind === 'runoff' ? 'runoff' : null;
    if (!kind) return null;
    const u0 = num(f.u0, 0, 0, segs), u1 = num(f.u1, 0, 0, segs * 2);
    if (!(u1 > u0)) return null;
    const g = { kind, side: f.side > 0 ? 1 : -1, u0, u1 };
    if (kind === 'kerb') g.style = f.style === 'sausage' ? 'sausage' : 'flat';
    else { g.surf = RUN_CODES[f.surf] != null ? f.surf : 'gravel'; g.width = num(f.width, 14, 4, 40); }
    return g;
  }).filter(Boolean);
  const st = { ...defaultSettings(), ...(o.settings && typeof o.settings === 'object' ? o.settings : {}) };
  const settings = {
    barriers: !!st.barriers, scenery: !!st.scenery, tod: num(st.tod, 15.5, 6.5, 19.5),
    livery: Math.floor(num(st.livery, 0, 0, 5)), kerbStyle: st.kerbStyle === 'sausage' ? 'sausage' : 'flat',
    runSurf: RUN_CODES[st.runSurf] != null ? st.runSurf : 'gravel', runW: num(st.runW, 14, 4, 40),
  };
  return { name: String(o.name || 'Imported circuit').slice(0, 40), points, closed, features, settings };
}
function loadInto(obj) {
  state.name = obj.name; state.points = obj.points; state.closed = obj.closed;
  state.features = obj.features; state.settings = obj.settings;
}

const history = { stack: [], pos: -1 };
function commit() {
  const snap = serialise();
  if (history.stack[history.pos] === snap) return;
  history.stack.length = history.pos + 1;
  history.stack.push(snap);
  if (history.stack.length > 120) history.stack.shift();
  history.pos = history.stack.length - 1;
  try { localStorage.setItem('tb.autosave', snap); } catch {}
}
function undo() { if (history.pos > 0) { history.pos--; loadInto(deserialise(history.stack[history.pos])); return true; } return false; }
function redo() { if (history.pos < history.stack.length - 1) { history.pos++; loadInto(deserialise(history.stack[history.pos])); return true; } return false; }

// A ~4.3 km sample circuit: long straight, heavy braking zones, an uphill esses section and a banked sweeper.
function sampleTrack() {
  const pts = [
    [0, 0, 0], [0, 260, 0], [0, 480, 0], [-20, 600, 0.5], [-90, 650, 1], [-180, 640, 2], [-240, 700, 3.5],
    [-250, 800, 5], [-200, 880, 7], [-260, 960, 9], [-360, 980, 11], [-470, 930, 12], [-540, 820, 12],
    [-560, 690, 11], [-520, 560, 9], [-600, 460, 7], [-700, 420, 5], [-760, 320, 3.5], [-720, 210, 2],
    [-620, 160, 1], [-560, 60, 0.5], [-520, -60, 0], [-420, -150, 0], [-300, -170, 0], [-190, -120, 0],
    [-110, -170, 0], [-40, -170, 0],
  ];
  const banks = { 9: 5, 10: 6, 11: 6, 12: 5, 21: 4, 22: 4 };
  return {
    name: 'Valle Rossa GP', closed: true,
    points: pts.map(([x, z, y], i) => ({ x, z, y, w: i < 3 ? 15 : 13, bank: banks[i] || 0 })),
    features: [], settings: { ...defaultSettings(), ...state.settings },
  };
}
