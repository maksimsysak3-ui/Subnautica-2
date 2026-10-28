// =====================================================================
//  F1 car model, ported from the F4 racer (maksimsysak3-ui/F4, racer/src/car + cars/f1)
//  at full size: no miniature squash, normal-size helmet. Each module keeps its own scope.
// =====================================================================
const F4 = {};
F4.meshBuilder = (() => {
const { BufferGeometry, Float32BufferAttribute, Mesh, Group, ShapeUtils, Vector2 } = THREE;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const WHITE = [1, 1, 1];
const normalize = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** Per-material vertex data in growable typed arrays (pos/nrm/col/uv expose the filled part). */
class Bucket {
  constructor() {
    this.n = 0; // vertices
    this.P = new Float32Array(768); this.N = new Float32Array(768); this.C = new Float32Array(768); this.U = new Float32Array(512);
    this.hasColor = false; this.hasUV = false;
  }
  /** Room for k more vertices; returns the first new vertex index. */
  reserve(k) {
    const v = this.n, need = (v + k) * 3;
    if (need > this.P.length) {
      const cap = Math.max(need, this.P.length * 2), grow = (a, m) => { const b = new Float32Array(cap / 3 * m); b.set(a); return b; };
      this.P = grow(this.P, 3); this.N = grow(this.N, 3); this.C = grow(this.C, 3); this.U = grow(this.U, 2);
    }
    this.n += k;
    return v;
  }
  get pos() { return this.P.subarray(0, this.n * 3); }
  get nrm() { return this.N.subarray(0, this.n * 3); }
  get col() { return this.C.subarray(0, this.n * 3); }
  get uv() { return this.U.subarray(0, this.n * 2); }
}

/**
 * Collects triangles per material key and emits one mesh per material.
 *
 * Normals are explicit: every quad gets a single normal (from its diagonals),
 * so a slightly non-planar quad still reads as one clean facet instead of two
 * differently-lit triangles. That is what makes low-poly read as "designed".
 */
class MeshBuilder {
  constructor() {
    this.buckets = new Map();
    /** Optional vertex colour [r, g, b] (linear) applied to everything emitted while set. */
    this.color = null;
  }

  bucket(key) {
    let b = this.buckets.get(key);
    if (!b) this.buckets.set(key, (b = new Bucket()));
    return b;
  }

  tri(key, a, b, c, n = null, uvs = null) {
    const bk = this.bucket(key);
    let nx, ny, nz;
    if (n) { nx = n[0]; ny = n[1]; nz = n[2]; } else {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx;
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= l; ny /= l; nz /= l;
    }
    const v = bk.reserve(3);
    const P = bk.P, N = bk.N, C = bk.C, U = bk.U, o = v * 3;
    P[o] = a[0]; P[o + 1] = a[1]; P[o + 2] = a[2]; P[o + 3] = b[0]; P[o + 4] = b[1]; P[o + 5] = b[2]; P[o + 6] = c[0]; P[o + 7] = c[1]; P[o + 8] = c[2];
    for (let i = 0; i < 9; i += 3) { N[o + i] = nx; N[o + i + 1] = ny; N[o + i + 2] = nz; }
    const col = this.color || WHITE;
    if (this.color) bk.hasColor = true;
    for (let i = 0; i < 9; i += 3) { C[o + i] = col[0]; C[o + i + 1] = col[1]; C[o + i + 2] = col[2]; }
    const u = v * 2;
    if (uvs) { bk.hasUV = true; U[u] = uvs[0][0]; U[u + 1] = uvs[0][1]; U[u + 2] = uvs[1][0]; U[u + 3] = uvs[1][1]; U[u + 4] = uvs[2][0]; U[u + 5] = uvs[2][1]; }
    else { U[u] = 0; U[u + 1] = 0; U[u + 2] = 0; U[u + 3] = 0; U[u + 4] = 0; U[u + 5] = 0; }
  }

  /** Textured quad: uv per corner. */
  quadUV(key, a, b, c, d, ua, ub, uc, ud) {
    const raw = cross(sub(c, a), sub(d, b));
    if (Math.hypot(raw[0], raw[1], raw[2]) < 1e-12) return;
    const n = normalize(raw);
    this.tri(key, a, b, c, n, [ua, ub, uc]);
    this.tri(key, a, c, d, n, [ua, uc, ud]);
  }

  /** Quad a-b-c-d, counter-clockwise when viewed from the front face. */
  quad(key, a, b, c, d) {
    const raw = cross(sub(c, a), sub(d, b));
    if (Math.hypot(raw[0], raw[1], raw[2]) < 1e-12) return; // degenerate
    const n = normalize(raw);
    this.tri(key, a, b, c, n);
    this.tri(key, a, c, d, n);
  }

  /** Closed polygon ring fanned from its centroid (safe for mildly concave outlines). */
  fan(key, ring) {
    const c = [0, 0, 0];
    for (const p of ring) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
    c[0] /= ring.length; c[1] /= ring.length; c[2] /= ring.length;
    for (let i = 0; i < ring.length; i++) this.tri(key, c, ring[i], ring[(i + 1) % ring.length]);
  }

  /** Triangle flipped if needed so its normal faces along n. */
  triFacing(key, a, b, c, n) {
    const fn = cross(sub(b, a), sub(c, a));
    if (fn[0] * n[0] + fn[1] * n[1] + fn[2] * n[2] >= 0) this.tri(key, a, b, c);
    else this.tri(key, a, c, b);
  }

  /**
   * Six-sided solid from 8 corners: bottom ring b0..b3 and top ring t0..t3
   * (matching order). Faces are oriented outward from the centroid. Good for
   * tapered blocks (mirrors, scoops) that a straight prism can't express.
   */
  hexa(key, b, t) {
    const all = [...b, ...t];
    const c = all.reduce((s, p) => [s[0] + p[0] / 8, s[1] + p[1] / 8, s[2] + p[2] / 8], [0, 0, 0]);
    const face = (p, q, r, s) => {
      const mid = [(p[0] + r[0]) / 2, (p[1] + r[1]) / 2, (p[2] + r[2]) / 2];
      const out = sub(mid, c);
      const n = cross(sub(r, p), sub(s, q));
      if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] >= 0) this.quad(key, p, q, r, s);
      else this.quad(key, s, r, q, p);
    };
    face(b[0], b[1], b[2], b[3]);
    face(t[0], t[1], t[2], t[3]);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      face(b[i], b[j], t[j], t[i]);
    }
  }

  /**
   * Extrude a 2D outline (may be concave) along an axis between lo and hi.
   * axis 'x': outline is (z, y). axis 'y': (x, z). axis 'z': (x, y).
   */
  prism(key, outline, axis, lo, hi) {
    const to3 = {
      x: (u, v, t) => [t, v, u],
      y: (u, v, t) => [u, t, v],
      z: (u, v, t) => [u, v, t],
    }[axis];
    const axisN = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[axis];
    const pts = outline.map(([u, v]) => new Vector2(u, v));
    if (ShapeUtils.isClockWise(pts)) pts.reverse();
    const faces = ShapeUtils.triangulateShape(pts, []);
    const neg = axisN.map((v) => -v);
    for (const [i, j, k] of faces) {
      const P = (q, t) => to3(pts[q].x, pts[q].y, t);
      this.triFacing(key, P(i, hi), P(j, hi), P(k, hi), axisN);
      this.triFacing(key, P(i, lo), P(j, lo), P(k, lo), neg);
    }
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const out = to3(b.y - a.y, -(b.x - a.x), 0); // outward 2D normal of a CCW outline
      const p0 = to3(a.x, a.y, lo), p1 = to3(b.x, b.y, lo), p2 = to3(b.x, b.y, hi), p3 = to3(a.x, a.y, hi);
      this.triFacing(key, p0, p1, p2, out);
      this.triFacing(key, p0, p2, p3, out);
    }
  }

  /** Same prism on both sides of the car (outline axis 'x', x range given for the left side). */
  prismMirrorX(key, outline, lo, hi) {
    this.prism(key, outline, 'x', lo, hi);
    this.prism(key, outline, 'x', -hi, -lo);
  }

  /**
   * @param materials  key -> material
   * @param warpZ      optional (z) => z' applied to every vertex, with slope(z) for normals
   */
  build(materials, warpZ = null, slope = null) {
    const group = new Group();
    for (const [key, { pos, nrm, col, uv, hasColor, hasUV }] of this.buckets) {
      if (warpZ) {
        for (let i = 0; i < pos.length; i += 3) {
          // Normals of a stretched surface scale by the inverse stretch.
          const k = slope(pos[i + 2]);
          nrm[i + 2] /= k;
          const l = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) || 1;
          nrm[i] /= l; nrm[i + 1] /= l; nrm[i + 2] /= l;
          pos[i + 2] = warpZ(pos[i + 2]);
        }
      }
      const geo = new BufferGeometry();
      geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
      if (hasColor) geo.setAttribute('color', new Float32BufferAttribute(col, 3));
      if (hasUV) geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
      geo.computeBoundingSphere();
      const mesh = new Mesh(geo, materials[key]);
      mesh.name = key;
      mesh.castShadow = key !== 'glass';
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }
}

/** Faceted copy of a primitive geometry (non-indexed, one normal per triangle). */
function facet(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.computeVertexNormals();
  return g;
}
return { MeshBuilder, facet };
})();
F4.loft = (() => {
/**
 * Lofted car bodies from a hand-drawn "lines plan": a table of half
 * cross-sections from nose to tail. Each section is 7 points running from the
 * sill up and over to the roof centreline. Sections are mirrored for the right
 * side, and every quad between neighbouring stations becomes one flat facet,
 * which gives the faceted low-poly look.
 *
 * Point index meaning (per section):
 *  P0 sill/bottom edge  P1 lower side  P2 belt (widest)  P3 shoulder / fender peak
 *  P4 hood crease / window base  P5 roof edge / A-pillar  P6 centreline top
 * Each lines row: [z, x0,y0, x1,y1, x2,y2, x3,y3, x4,y4, x5,y5, y6]
 *
 * Design space: +X left, +Y up, +Z forward, ground at y = 0.
 */

const mirror = (p) => [-p[0], p[1], p[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const vec = { sub, add, scale, cross, norm, mirror };

/**
 * @param {object} o
 * @param {number[][]} o.lines         lines plan rows, front (high z) to rear
 * @param {number[][]} o.arch          arch profile [distance from axle, height], from the top down
 * @param {number[]}   o.axles         [front z, rear z]
 * @param {number}     o.wellX         x of the inner wheel-well walls
 * @param {number[]}   [o.extraStations] extra z stations so features get their own facets
 * @param {(strip:number, z:number, arch:number) => string} o.stripMaterial
 * @param {number[]}   [o.archGaps]    how far P1..P3 must clear the arch edge
 */
function createLoft(o) {
  const { lines, arch, axles, wellX, stripMaterial } = o;
  const archGaps = o.archGaps || [0, 0.02, 0.045, 0.07];
  const nose = lines[0][0];
  const tail = lines[lines.length - 1][0];
  const archHalf = arch[arch.length - 1][0];

  function archHeight(z) {
    let best = 0;
    for (const zc of axles) {
      const d = Math.abs(z - zc);
      if (d >= archHalf) continue;
      for (let i = 1; i < arch.length; i++) {
        if (d <= arch[i][0]) {
          const [d0, h0] = arch[i - 1];
          const [d1, h1] = arch[i];
          best = Math.max(best, h0 + ((h1 - h0) * (d - d0)) / (d1 - d0));
          break;
        }
      }
    }
    return best;
  }

  /** Arch outline in (z, y) for one axle, used for the inner wheel-well liners. */
  function archOutline(zc) {
    const pts = [];
    for (let i = arch.length - 1; i >= 0; i--) pts.push([zc + arch[i][0], arch[i][1]]);
    for (let i = 1; i < arch.length; i++) pts.push([zc - arch[i][0], arch[i][1]]);
    return pts;
  }

  function rowAt(z) {
    if (z >= lines[0][0]) return lines[0].slice();
    for (let i = 1; i < lines.length; i++) {
      const a = lines[i - 1];
      const b = lines[i];
      if (z >= b[0]) {
        const t = (a[0] - z) / (a[0] - b[0]);
        return a.map((v, k) => v + (b[k] - v) * t);
      }
    }
    return lines[lines.length - 1].slice();
  }

  /** Half cross-section at z as 7 [x, y] points (arches applied). */
  function sectionAt(z) {
    const r = rowAt(z);
    const p = [];
    for (let i = 0; i < 6; i++) p.push([r[1 + i * 2], r[2 + i * 2]]);
    p.push([0, r[13]]);
    const a = archHeight(z);
    if (a > p[0][1]) {
      // Lift the lower body over the tire; the panel above becomes the fender lip.
      p[0] = [p[1][0], a];
      for (let i = 1; i <= 3; i++) p[i][1] = Math.max(p[i][1], a + archGaps[i]);
    }
    return p;
  }

  function stations() {
    const zs = new Set(lines.map((r) => r[0]));
    for (const zc of axles) {
      for (const [d] of arch) { zs.add(+(zc + d).toFixed(4)); zs.add(+(zc - d).toFixed(4)); }
    }
    (o.extraStations || []).forEach((z) => zs.add(z));
    return [...zs].filter((z) => z <= nose && z >= tail).sort((a, b) => b - a);
  }

  /** Emits the shell into a MeshBuilder. */
  function buildShell(mb) {
    const zs = stations();
    const secs = zs.map((z) => sectionAt(z).map(([x, y]) => [x, y, z]));
    for (let k = 0; k < secs.length - 1; k++) {
      const A = secs[k];
      const B = secs[k + 1];
      const zMid = (zs[k] + zs[k + 1]) / 2;
      const a = archHeight(zMid);
      for (let i = 0; i < 6; i++) {
        const mat = stripMaterial(i, zMid, a);
        mb.quad(mat, A[i], B[i], B[i + 1], A[i + 1]); // left side (outward = +X)
        mb.quad(mat, mirror(A[i]), mirror(A[i + 1]), mirror(B[i + 1]), mirror(B[i])); // right, mirrored
      }
      // Underside between the two sills (over the wheels this is the well ceiling).
      mb.quad('black', A[0], mirror(A[0]), mirror(B[0]), B[0]);
      if (a > 0) {
        // Keep the floor flat between the wheel wells so the car isn't hollow from below.
        const ya = rowAt(zs[k])[2];
        const yb = rowAt(zs[k + 1])[2];
        mb.quad('black', [wellX, ya, zs[k]], [-wellX, ya, zs[k]], [-wellX, yb, zs[k + 1]], [wellX, yb, zs[k + 1]]);
      }
    }
    // Nose and tail caps. Ring runs counter-clockwise seen from the front.
    const ring = (sec) => [...sec.slice().reverse().map(mirror), ...sec.slice(0, 6)];
    mb.fan(o.noseMaterial || 'paint', ring(secs[0]));
    mb.fan(o.tailMaterial || 'paint', ring(secs[secs.length - 1]).reverse());
    for (const zc of axles) mb.prismMirrorX('grille', archOutline(zc), wellX - 0.02, wellX);
  }

  /** Point on the shell surface: z and a fractional profile index s in [0, 6]. */
  function surfacePoint(z, s, side = 1) {
    const p = sectionAt(z);
    const i = Math.min(5, Math.floor(s));
    const f = s - i;
    const x = p[i][0] + (p[i + 1][0] - p[i][0]) * f;
    const y = p[i][1] + (p[i + 1][1] - p[i][1]) * f;
    return [x * side, y, z];
  }

  /** Outward surface normal at (z, s). */
  function surfaceNormal(z, s, side = 1) {
    const e = 0.01;
    const dz = sub(surfacePoint(z + e, s, side), surfacePoint(z - e, s, side));
    const ds = sub(surfacePoint(z, Math.min(6, s + e), side), surfacePoint(z, Math.max(0, s - e), side));
    const n = norm(cross(ds, dz));
    return side > 0 ? n : scale(n, -1);
  }

  /** Thin raised ribbon following the body surface through (z, s) waypoints. */
  function ribbon(mb, key, path, width, lift, side) {
    const pts = path.map(([z, s]) => add(surfacePoint(z, s, side), scale(surfaceNormal(z, s, side), lift)));
    const nrm = path.map(([z, s]) => surfaceNormal(z, s, side));
    for (let i = 0; i < pts.length - 1; i++) {
      const dir = norm(sub(pts[i + 1], pts[i]));
      const offA = scale(norm(cross(nrm[i], dir)), width / 2);
      const offB = scale(norm(cross(nrm[i + 1], dir)), width / 2);
      const a0 = sub(pts[i], offA), a1 = add(pts[i], offA);
      const b0 = sub(pts[i + 1], offB), b1 = add(pts[i + 1], offB);
      mb.triFacing(key, a0, b0, b1, nrm[i]);
      mb.triFacing(key, a0, b1, a1, nrm[i]);
    }
  }

  /**
   * Triangle laid onto the curved body: subdivided in (z, s) parameter space so
   * every vertex sits on the surface, then lifted slightly along the normal.
   */
  function decal(mb, key, [A, B, C], lift, side, steps = 6) {
    const P = (u, v) => {
      const z = A[0] + (B[0] - A[0]) * u + (C[0] - A[0]) * v;
      const s = A[1] + (B[1] - A[1]) * u + (C[1] - A[1]) * v;
      return [add(surfacePoint(z, s, side), scale(surfaceNormal(z, s, side), lift)), surfaceNormal(z, s, side)];
    };
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps - i; j++) {
        const u0 = i / steps, v0 = j / steps, d = 1 / steps;
        const [a, n] = P(u0, v0);
        const [b] = P(u0 + d, v0);
        const [c] = P(u0, v0 + d);
        mb.triFacing(key, a, b, c, n);
        if (j < steps - i - 1) {
          const [e] = P(u0 + d, v0 + d);
          mb.triFacing(key, b, e, c, n);
        }
      }
    }
  }

  /** Quad patch on the surface (corners A..D in (z, s), CCW from outside), subdivided. */
  function patch(mb, key, [A, B, C, D], lift, side) {
    decal(mb, key, [A, B, C], lift, side, 4);
    decal(mb, key, [A, C, D], lift, side, 4);
  }

  return {
    nose, tail, axles, wellX,
    rowAt, sectionAt, archHeight, archOutline, surfacePoint, surfaceNormal,
    buildShell, ribbon, decal, patch,
  };
}

/**
 * A low-poly domed lens (headlight, indicator) sitting on a surface: an n-gon
 * ring in the plane through `center` perpendicular to `normal`, with a raised
 * centre. `up` orients the ellipse; rx/ry are its radii.
 */
function lens(mb, key, center, normal, up, rx, ry, { segments = 12, dome = 0.02, rim = null, rimWidth = 0.012 } = {}) {
  const n = norm(normal);
  const u = norm(cross(up, n));
  const v = norm(cross(n, u));
  const ring = (k, grow) => {
    const a = (k / segments) * Math.PI * 2;
    return add(center, add(scale(u, Math.cos(a) * (rx + grow)), scale(v, Math.sin(a) * (ry + grow))));
  };
  const apex = add(center, scale(n, dome));
  for (let k = 0; k < segments; k++) mb.triFacing(key, apex, ring(k, 0), ring(k + 1, 0), n);
  if (rim) {
    for (let k = 0; k < segments; k++) {
      const a = ring(k, 0), b = ring(k + 1, 0), c = ring(k + 1, rimWidth), d = ring(k, rimWidth);
      mb.triFacing(rim, a, c, b, n);
      mb.triFacing(rim, a, d, c, n);
    }
  }
}
return { vec, createLoft, lens };
})();
F4.materials = (() => {
const { MeshPhysicalMaterial, MeshStandardMaterial, MeshBasicMaterial, Color, AdditiveBlending, DoubleSide } = THREE;
/** Every material the car uses, keyed by the names the geometry builders emit. */
function createCarMaterials(paintHex, overrides = {}) {
  // Body meshes carry explicit per-facet normals; primitives are pre-faceted with facet().
  const flat = {};
  const m = {
    paint: new MeshPhysicalMaterial({
      ...flat, color: paintHex, metalness: 0.3, roughness: 0.32,
      clearcoat: 1, clearcoatRoughness: 0.24, envMapIntensity: 1.35,
    }),
    black: new MeshStandardMaterial({ ...flat, color: 0x0c0c0e, roughness: 0.6, metalness: 0.2 }),
    carbon: new MeshPhysicalMaterial({
      ...flat, color: 0x18181b, roughness: 0.38, metalness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15,
    }),
    grille: new MeshStandardMaterial({ ...flat, color: 0x050506, roughness: 0.85, metalness: 0.1 }),
    glass: new MeshPhysicalMaterial({
      ...flat, color: 0x0b0f16, roughness: 0.09, metalness: 0.1, transparent: true, opacity: 0.8,
      envMapIntensity: 1.1, depthWrite: false,
    }),
    headlight: new MeshPhysicalMaterial({
      ...flat, color: 0x1a1d22, roughness: 0.05, metalness: 0.9, clearcoat: 1, envMapIntensity: 2.2,
    }),
    drl: new MeshStandardMaterial({ color: 0x000000, emissive: new Color(0xf2f6ff), emissiveIntensity: 6 }),
    tail: new MeshStandardMaterial({ color: 0x220000, emissive: new Color(0xff1020), emissiveIntensity: 3 }),
    reverse: new MeshStandardMaterial({ color: 0x111111, emissive: new Color(0xffffff), emissiveIntensity: 0 }),
    chrome: new MeshStandardMaterial({ ...flat, color: 0xc8ccd2, roughness: 0.12, metalness: 1 }),
    titanium: new MeshStandardMaterial({ ...flat, color: 0x6d6a66, roughness: 0.25, metalness: 1 }),
    gold: new MeshStandardMaterial({ ...flat, color: 0xd4a640, roughness: 0.2, metalness: 1 }),
    tire: new MeshStandardMaterial({ ...flat, color: 0x141416, roughness: 0.92, metalness: 0 }),
    tireWall: new MeshStandardMaterial({ ...flat, color: 0x1c1c1f, roughness: 0.8, metalness: 0 }),
    rim: new MeshStandardMaterial({ ...flat, color: 0x2a2b2f, roughness: 0.28, metalness: 0.9 }),
    rimLip: new MeshStandardMaterial({ ...flat, color: 0xb9bdc4, roughness: 0.15, metalness: 1 }),
    disc: new MeshStandardMaterial({ ...flat, color: 0x55575c, roughness: 0.45, metalness: 0.85 }),
    caliper: new MeshStandardMaterial({ ...flat, color: 0xffb400, roughness: 0.35, metalness: 0.2 }),
    interior: new MeshStandardMaterial({ ...flat, color: 0x121214, roughness: 0.9 }),
    alcantara: new MeshStandardMaterial({ ...flat, color: 0x1d1d22, roughness: 1 }),
    stitch: new MeshStandardMaterial({ ...flat, color: 0xffc21a, roughness: 0.6 }),
    helmet: new MeshPhysicalMaterial({ ...flat, color: 0xf4f4f4, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: 0.6 }),
    visor: new MeshPhysicalMaterial({ ...flat, color: 0x101418, roughness: 0.05, metalness: 0.6, clearcoat: 1 }),
    suit: new MeshStandardMaterial({ ...flat, color: 0x24242a, roughness: 0.8 }),
    stripe: new MeshPhysicalMaterial({
      ...flat, color: 0xf4f4f2, metalness: 0.1, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.24,
    }),
    amber: new MeshStandardMaterial({ color: 0x331a00, emissive: new Color(0xff8a10), emissiveIntensity: 1.2 }),
    lamp: new MeshPhysicalMaterial({ color: 0xdfe6ee, emissive: new Color(0xfff2d8), emissiveIntensity: 1.3, roughness: 0.1, clearcoat: 1 }),
    plate: new MeshStandardMaterial({ ...flat, color: 0xe9e6dc, roughness: 0.6 }),
    flame: new MeshBasicMaterial({
      color: 0xff8a2a, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide,
    }),
  };
  for (const [key, hex] of Object.entries(overrides)) m[key].color.setHex(hex);
  return m;
}
return { createCarMaterials };
})();
F4.wheel = (() => {
const { Group, Mesh, LatheGeometry, Vector2, Vector3, Shape, ExtrudeGeometry, CylinderGeometry, BoxGeometry } = THREE;
const { facet } = F4.meshBuilder;
const TIRE_SEGMENTS = 22;

/** Lathe a profile given as [radius, axialOffset] pairs around the X axis. */
function latheX(profile, segments) {
  const geo = new LatheGeometry(profile.map(([r, x]) => new Vector2(r, x)), segments);
  geo.rotateZ(-Math.PI / 2); // lathe axis Y -> X
  return facet(geo);
}

/** Y-shaped spoke, the Huracán-style design, in the wheel face plane. */
function ySpokeShape() {
  const s = new Shape();
  const pts = [
    [-0.017, 0.05], [0.017, 0.05], [0.021, 0.125], [0.079, 0.214], [0.052, 0.226],
    [0.0, 0.152], [-0.052, 0.226], [-0.079, 0.214], [-0.021, 0.125],
  ];
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

/**
 * One wheel assembly. Returns:
 *  root  - positioned at the hub, steers about Y
 *  spin  - child of root, rotates about X with the wheel
 * Outer face points to +X; mirrored for right-hand wheels.
 */
/** Torq-Thrust style spoke: tapered from a wide root to a narrow tip, classic muscle-car mag. */
function torqSpokeShape() {
  const s = new Shape();
  const pts = [[-0.045, 0.07], [0.045, 0.07], [0.022, 0.215], [-0.022, 0.215]];
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

/** style: 'ySpoke' (Lamborghini, centre-lock), 'torq' (classic mag, lug nuts, taller sidewall) or
 * 'offroad' (all-terrain tyre with block tread, six-spoke wheel with a beadlock ring). */
function buildWheel(mats, { radius, width, left, style = 'ySpoke' }) {
  const root = new Group();
  const spin = new Group();
  const holder = new Group();
  root.add(spin);
  spin.add(holder);
  if (!left) holder.rotation.y = Math.PI;

  const hw = width / 2;
  if (style === 'kart') return kartWheel(mats, root, spin, holder, radius, hw);
  if (style === 'rally') return rallyWheel(mats, root, spin, holder, radius, hw, left);
  if (style === 'aero') return aeroWheel(mats, root, spin, holder, radius, hw, left);
  const off = style === 'offroad';
  const torq = style === 'torq' || off; // offroad shares the lug-nut hub and recessed face
  const rimR = radius * (off ? 0.56 : torq ? 0.64 : 0.72);

  // Tire: tread + rounded shoulders + sidewalls, one low-poly lathe each.
  const tread = latheX([
    [radius * 0.96, -hw], [radius, -hw + 0.03], [radius, hw - 0.03], [radius * 0.96, hw],
  ], TIRE_SEGMENTS);
  // Profile order sets which way lathe faces point; these run so the walls face away from the tire centre.
  const wall = latheX([
    [radius * 0.96, hw], [radius * 0.9, hw + 0.004], [rimR, hw - 0.012],
  ], TIRE_SEGMENTS);
  const wallIn = latheX([
    [rimR, -hw + 0.012], [radius * 0.9, -hw - 0.004], [radius * 0.96, -hw],
  ], TIRE_SEGMENTS);
  for (const [g, m] of [[tread, mats.tire], [wall, mats.tireWall], [wallIn, mats.tireWall]]) {
    const mesh = new Mesh(g, m);
    mesh.castShadow = true;
    holder.add(mesh);
  }

  if (off) {
    // All-terrain tread: staggered blocks standing proud of the carcass, and shoulder lugs.
    const block = new BoxGeometry(width * 0.4, 0.028, radius * 0.17);
    const lug = new BoxGeometry(0.03, radius * 0.1, radius * 0.14);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      for (const sx of [-1, 1]) {
        const m = new Mesh(block, mats.tire);
        const x = sx * width * (i % 2 ? 0.22 : 0.26);
        m.position.set(x, Math.cos(a) * (radius + 0.008), Math.sin(a) * (radius + 0.008));
        m.rotation.x = -a;
        holder.add(m);
        const l = new Mesh(lug, mats.tireWall);
        l.position.set(sx * (hw + 0.006), Math.cos(a + 0.17) * radius * 0.9, Math.sin(a + 0.17) * radius * 0.9);
        l.rotation.x = -a - 0.17;
        holder.add(l);
      }
    }
  }

  // Rim barrel (inside) and polished lip.
  const barrel = new Mesh(latheX([[rimR, hw - 0.02], [rimR * 0.97, -hw + 0.02]], 18), mats.rim);
  const lip = new Mesh(latheX([[rimR * 1.01, hw - 0.004], [rimR * 0.93, hw - 0.012], [rimR * 0.92, hw - 0.04]], 30), mats.rimLip);
  holder.add(barrel, lip);

  // Five spokes.
  const spokeGeo = facet(new ExtrudeGeometry(torq ? torqSpokeShape() : ySpokeShape(), { depth: 0.028, bevelEnabled: false }));
  spokeGeo.scale(rimR / 0.235, rimR / 0.235, 1);
  spokeGeo.rotateY(Math.PI / 2); // shape plane XY -> ZY, extrude along X
  if (torq) {
    // Dark recessed face behind the polished spokes.
    const face = new Mesh(facet(new CylinderGeometry(rimR * 0.93, rimR * 0.93, 0.01, 20)), mats.rim);
    face.rotation.z = Math.PI / 2;
    face.position.x = hw - 0.065;
    holder.add(face);
  }
  const spokes = off ? 6 : 5;
  for (let i = 0; i < spokes; i++) {
    const spoke = new Mesh(spokeGeo, torq && !off ? mats.rimLip : mats.rim);
    spoke.rotation.x = (i / spokes) * Math.PI * 2;
    spoke.position.x = hw - 0.05;
    spoke.castShadow = true;
    holder.add(spoke);
  }

  if (torq) {
    // Domed chrome cap and five lug nuts.
    const capT = new Mesh(facet(new CylinderGeometry(0.035, 0.055, 0.04, 10)), mats.chrome);
    capT.rotation.z = Math.PI / 2;
    capT.position.x = hw - 0.025;
    holder.add(capT);
    if (off) {
      // Beadlock ring bolted round the rim edge.
      const ring = new Mesh(latheX([[rimR * 1.04, hw + 0.004], [rimR * 0.9, hw + 0.004], [rimR * 0.9, hw - 0.01]], 24), mats.rimLip);
      holder.add(ring);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const bolt = new Mesh(facet(new CylinderGeometry(0.008, 0.008, 0.02, 6)), mats.chrome);
        bolt.rotation.z = Math.PI / 2;
        bolt.position.set(hw + 0.008, Math.cos(a) * rimR * 0.97, Math.sin(a) * rimR * 0.97);
        holder.add(bolt);
      }
    }
    for (let i = 0; i < 5; i++) {
      const a = ((i + 0.5) / 5) * Math.PI * 2;
      const nut = new Mesh(facet(new CylinderGeometry(0.012, 0.012, 0.03, 6)), mats.chrome);
      nut.rotation.z = Math.PI / 2;
      nut.position.set(hw - 0.04, Math.cos(a) * 0.075, Math.sin(a) * 0.075);
      holder.add(nut);
    }
  }

  // Hexagonal centre-lock nut.
  const hub = new Mesh(facet(new CylinderGeometry(0.05, 0.058, 0.05, 6)), mats.rimLip);
  hub.rotation.z = Math.PI / 2;
  hub.position.x = hw - 0.03;
  const cap = new Mesh(facet(new CylinderGeometry(0.03, 0.03, 0.012, 6)), mats.gold);
  cap.rotation.z = Math.PI / 2;
  cap.position.x = hw - 0.002;
  if (!torq) holder.add(hub, cap);

  // Brake disc spins; the caliper does not.
  const disc = new Mesh(facet(new CylinderGeometry(rimR * 0.86, rimR * 0.86, 0.028, 24)), mats.disc);
  disc.rotation.z = Math.PI / 2;
  disc.position.x = hw - 0.11;
  holder.add(disc);

  const caliper = new Mesh(new BoxGeometry(0.05, 0.13, 0.075), mats.caliper);
  caliper.position.set((left ? 1 : -1) * (hw - 0.085), rimR * 0.62, -rimR * 0.42);
  caliper.rotation.x = 0.6;
  caliper.castShadow = true;
  root.add(caliper);

  return { root, spin };
}

/**
 * Kart wheel: a wide, low slick with square shoulders on a small cast
 * magnesium rim: a flat dished face with six lightening holes, a raised hub
 * boss with three studs and a gold centre nut. No brake inside (the kart
 * brakes on its rear axle).
 */
function kartWheel(mats, root, spin, holder, radius, hw) {
  const rimR = radius * 0.6;
  const tread = latheX([[radius * 0.97, -hw], [radius, -hw + 0.012], [radius, hw - 0.012], [radius * 0.97, hw]], TIRE_SEGMENTS);
  const wall = latheX([[radius * 0.97, hw], [radius * 0.93, hw + 0.002], [rimR * 1.04, hw - 0.004]], TIRE_SEGMENTS);
  const wallIn = latheX([[rimR * 1.04, -hw + 0.004], [radius * 0.93, -hw - 0.002], [radius * 0.97, -hw]], TIRE_SEGMENTS);
  for (const [g, m] of [[tread, mats.tire], [wall, mats.tireWall], [wallIn, mats.tireWall]]) {
    const mesh = new Mesh(g, m);
    mesh.castShadow = true;
    holder.add(mesh);
  }
  // Bead flange, dish and face.
  holder.add(new Mesh(latheX([[rimR * 1.05, hw - 0.002], [rimR * 0.98, hw - 0.01], [rimR * 0.96, -hw + 0.01], [rimR * 1.05, -hw + 0.002]], 24), mats.rimLip));
  const face = new Mesh(facet(new CylinderGeometry(rimR * 0.96, rimR * 0.96, 0.012, 24)), mats.rim);
  face.rotation.z = Math.PI / 2;
  face.position.x = hw - 0.03;
  holder.add(face);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const hole = new Mesh(facet(new CylinderGeometry(rimR * 0.17, rimR * 0.17, 0.014, 10)), mats.tire);
    hole.rotation.z = Math.PI / 2;
    hole.position.set(hw - 0.028, Math.cos(a) * rimR * 0.6, Math.sin(a) * rimR * 0.6);
    holder.add(hole);
  }
  const boss = new Mesh(facet(new CylinderGeometry(rimR * 0.3, rimR * 0.36, 0.03, 12)), mats.rimLip);
  boss.rotation.z = Math.PI / 2;
  boss.position.x = hw - 0.012;
  holder.add(boss);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const stud = new Mesh(facet(new CylinderGeometry(0.009, 0.009, 0.03, 6)), mats.chrome);
    stud.rotation.z = Math.PI / 2;
    stud.position.set(hw + 0.004, Math.cos(a) * rimR * 0.2, Math.sin(a) * rimR * 0.2);
    holder.add(stud);
  }
  const nut = new Mesh(facet(new CylinderGeometry(0.018, 0.018, 0.02, 6)), mats.gold);
  nut.rotation.z = Math.PI / 2;
  nut.position.x = hw + 0.006;
  holder.add(nut);
  return { root, spin };
}

/** Tyre carcass shared by the custom wheels: tread band and two sidewalls down to rimR. */
function carcass(mats, holder, radius, hw, rimR, crown = 0.97) {
  const tread = latheX([[radius * crown, -hw], [radius, -hw + hw * 0.15], [radius, hw - hw * 0.15], [radius * crown, hw]], TIRE_SEGMENTS);
  const wall = latheX([[radius * crown, hw], [radius * 0.9, hw + 0.004], [rimR * 1.03, hw - 0.008]], TIRE_SEGMENTS);
  const wallIn = latheX([[rimR * 1.03, -hw + 0.008], [radius * 0.9, -hw - 0.004], [radius * crown, -hw]], TIRE_SEGMENTS);
  for (const [g, m] of [[tread, mats.tire], [wall, mats.tireWall], [wallIn, mats.tireWall]]) {
    const mesh = new Mesh(g, m);
    mesh.castShadow = true;
    holder.add(mesh);
  }
}

/**
 * Gravel rally wheel: a chunky block-tread tyre on a white flat-faced rim with
 * eight round lightening holes, a deep dish and five wheel nuts; a vented disc
 * and the red caliper behind it.
 */
function rallyWheel(mats, root, spin, holder, radius, hw, left) {
  const rimR = radius * 0.6;
  carcass(mats, holder, radius, hw, rimR, 0.95);
  // Gravel blocks across the tread, staggered.
  const block = new BoxGeometry(hw * 0.7, 0.02, radius * 0.13);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    for (const sx of [-1, 1]) {
      const m = new Mesh(block, mats.tire);
      m.position.set(sx * hw * (i % 2 ? 0.4 : 0.5), Math.cos(a) * (radius + 0.006), Math.sin(a) * (radius + 0.006));
      m.rotation.x = -a;
      holder.add(m);
    }
  }
  holder.add(new Mesh(latheX([[rimR * 1.04, hw - 0.004], [rimR * 0.97, hw - 0.012], [rimR * 0.95, -hw + 0.012], [rimR * 1.04, -hw + 0.004]], 24), mats.rim));
  const face = new Mesh(facet(new CylinderGeometry(rimR * 0.95, rimR * 0.95, 0.014, 24)), mats.rim);
  face.rotation.z = Math.PI / 2;
  face.position.x = hw - 0.045;
  holder.add(face);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const hole = new Mesh(facet(new CylinderGeometry(rimR * 0.15, rimR * 0.15, 0.016, 10)), mats.tire);
    hole.rotation.z = Math.PI / 2;
    hole.position.set(hw - 0.043, Math.cos(a) * rimR * 0.66, Math.sin(a) * rimR * 0.66);
    holder.add(hole);
  }
  for (let i = 0; i < 5; i++) {
    const a = ((i + 0.5) / 5) * Math.PI * 2;
    const nut = new Mesh(facet(new CylinderGeometry(0.012, 0.012, 0.03, 6)), mats.chrome);
    nut.rotation.z = Math.PI / 2;
    nut.position.set(hw - 0.03, Math.cos(a) * rimR * 0.28, Math.sin(a) * rimR * 0.28);
    holder.add(nut);
  }
  const disc = new Mesh(facet(new CylinderGeometry(rimR * 0.8, rimR * 0.8, 0.026, 22)), mats.disc);
  disc.rotation.z = Math.PI / 2;
  disc.position.x = hw - 0.11;
  holder.add(disc);
  const caliper = new Mesh(new BoxGeometry(0.05, 0.12, 0.07), mats.caliper);
  caliper.position.set((left ? 1 : -1) * (hw - 0.09), rimR * 0.55, -rimR * 0.4);
  caliper.rotation.x = 0.6;
  root.add(caliper);
  return { root, spin };
}

/**
 * Aero wheel: a low-profile tyre on a big rim closed by a flat turbine cover:
 * a dark disc with curved vanes and a coloured accent ring, the brake glowing behind.
 */
function aeroWheel(mats, root, spin, holder, radius, hw, left) {
  const rimR = radius * 0.76;
  carcass(mats, holder, radius, hw, rimR, 0.97);
  holder.add(new Mesh(latheX([[rimR * 1.03, hw - 0.003], [rimR * 0.97, hw - 0.01], [rimR * 0.95, -hw + 0.01], [rimR * 1.03, -hw + 0.003]], 28), mats.rimLip));
  const cover = new Mesh(facet(new CylinderGeometry(rimR * 0.95, rimR * 0.95, 0.012, 28)), mats.rim);
  cover.rotation.z = Math.PI / 2;
  cover.position.x = hw - 0.02;
  holder.add(cover);
  // Curved turbine vanes raised on the cover.
  const vane = new BoxGeometry(0.008, rimR * 0.62, 0.03);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const m = new Mesh(vane, mats.rimLip);
    m.position.set(hw - 0.01, Math.cos(a) * rimR * 0.55, Math.sin(a) * rimR * 0.55);
    m.rotation.x = -a + 0.5;
    holder.add(m);
  }
  const ring = new Mesh(latheX([[rimR * 0.9, hw - 0.012], [rimR * 0.86, hw - 0.012]], 28), mats.caliper);
  holder.add(ring);
  const hub = new Mesh(facet(new CylinderGeometry(rimR * 0.18, rimR * 0.2, 0.03, 8)), mats.rimLip);
  hub.rotation.z = Math.PI / 2;
  hub.position.x = hw - 0.005;
  holder.add(hub);
  const caliper = new Mesh(new BoxGeometry(0.05, 0.13, 0.075), mats.caliper);
  caliper.position.set((left ? 1 : -1) * (hw - 0.085), rimR * 0.6, -rimR * 0.4);
  caliper.rotation.x = 0.6;
  root.add(caliper);
  return { root, spin };
}
return { buildWheel };
})();
F4.cockpit = (() => {
const { Group, Mesh, IcosahedronGeometry, TorusGeometry, BoxGeometry, SphereGeometry, CylinderGeometry, ConeGeometry } = THREE;
const { facet } = F4.meshBuilder;
/**
 * Chibi driver (oversized helmet, tiny body) and steering wheel, shared by all
 * cars. Positions are in the car's design space; the visual squashes only the
 * placement, so the helmet stays round.
 */
function buildCockpit(mats, { seatX = 0.36, seatZ = -0.18, wheelZ = 0.2, wheelY = 0.7, seatY = 0 } = {}) {
  const group = new Group();

  const driver = new Group();
  driver.position.set(seatX, seatY, seatZ);
  const torso = new Mesh(facet(new BoxGeometry(0.3, 0.32, 0.2)), mats.suit);
  torso.position.set(0, 0.56, -0.08);
  torso.rotation.x = -0.25;
  const head = new Group();
  head.position.set(0, 0.92, -0.02);
  head.userData.baseY = 0.92;
  const helmet = new Mesh(facet(new IcosahedronGeometry(0.175, 2)), mats.helmet);
  const stripe = new Mesh(facet(new IcosahedronGeometry(0.178, 2)), mats.paint);
  stripe.scale.set(0.28, 1, 1);
  const visor = new Mesh(facet(new SphereGeometry(0.18, 10, 3, Math.PI / 2 - 0.95, 1.9, 1.2, 0.62)), mats.visor);
  head.add(helmet, stripe, visor);
  for (const m of [torso, helmet, stripe, visor]) m.castShadow = true;
  const armL = new Mesh(facet(new BoxGeometry(0.07, 0.07, 0.24)), mats.suit);
  armL.position.set(0.13, 0.64, 0.1);
  armL.rotation.x = 0.3;
  const armR = armL.clone();
  armR.position.x = -0.13;
  driver.add(torso, head, armL, armR);
  group.add(driver);

  const steering = new Group();
  steering.position.set(seatX, wheelY + seatY, wheelZ);
  steering.rotation.x = -0.35;
  const rimMesh = new Mesh(facet(new TorusGeometry(0.12, 0.018, 5, 12)), mats.alcantara);
  const spokeBar = new Mesh(new BoxGeometry(0.22, 0.03, 0.02), mats.interior);
  const marker = new Mesh(new BoxGeometry(0.02, 0.03, 0.03), mats.stitch);
  marker.position.y = 0.12;
  steering.add(rimMesh, spokeBar, marker);
  group.add(steering);

  return { group, head, steering };
}

/**
 * Exhaust tips with flame cones for pops & bangs. Each tip: { x, y, z, r, sides, rotate }.
 * Returns the meshes to add and the flame cones to animate.
 */
function buildExhausts(mats, tips) {
  const group = new Group();
  const flames = [];
  for (const t of tips) {
    const pipe = new Mesh(facet(new CylinderGeometry(t.r, t.r, 0.16, t.sides, 1, true)), mats.titanium);
    pipe.rotation.x = Math.PI / 2;
    pipe.rotation.y = t.rotate || 0;
    pipe.position.set(t.x, t.y, t.z - 0.04);
    const inner = new Mesh(new CylinderGeometry(t.r * 0.85, t.r * 0.85, 0.01, t.sides), mats.grille);
    inner.rotation.x = Math.PI / 2;
    inner.rotation.y = t.rotate || 0;
    inner.position.set(t.x, t.y, t.z - 0.06);
    const flame = new Mesh(new ConeGeometry(t.r, 0.32, 7, 1, true), mats.flame);
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(t.x, t.y, t.z - 0.28);
    flame.visible = false;
    flames.push(flame);
    group.add(pipe, inner, flame);
  }
  return { group, flames };
}
return { buildCockpit, buildExhausts };
})();
F4.f1body = (() => {
const { Group } = THREE;
const { lens } = F4.loft;
const { buildCockpit, buildExhausts } = F4.cockpit;
/**
 * Mini F1 car, hand-built in design space (+X left, +Y up, +Z forward, ground
 * at y = 0). Open wheels: the body is a narrow tub with a raised nose, a
 * multi-element front wing, sidepods, an engine cover with shark fin, a
 * halo, a two-element rear wing with beam wing, floor and diffuser, and
 * wishbones out to the wheels.
 */
const AXLE_FRONT = 1.75;
const AXLE_REAR = -1.75;
const NOSE_Z = 2.78;
const TAIL_Z = -2.42;
const HUB_X = 0.95;

// Tub/nose/engine cover sections: [z, half width, bottom y, top y].
const SPINE = [
  [2.62, 0.07, 0.27, 0.33], [2.35, 0.11, 0.24, 0.4], [2.0, 0.16, 0.21, 0.48], [1.5, 0.22, 0.19, 0.56],
  [1.0, 0.29, 0.17, 0.63], [0.6, 0.33, 0.15, 0.66], [-0.3, 0.35, 0.15, 0.68], [-0.75, 0.32, 0.15, 0.82],
  [-1.25, 0.24, 0.16, 0.66], [-1.75, 0.16, 0.17, 0.5], [-2.15, 0.1, 0.2, 0.42],
];

const ring = ([z, w, y0, y1], dw = 0, dy = 0) => [[w + dw, y0 - dy, z], [-w - dw, y0 - dy, z], [-w - dw, y1 + dy, z], [w + dw, y1 + dy, z]];

/** Square-section rod between two design-space points. */
function rod(mb, key, p, q, w) {
  const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
  const len = Math.hypot(...d) || 1;
  const t = d.map((x) => x / len);
  let u = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  let v = cr(t, u); const lv = Math.hypot(...v); v = v.map((x) => x / lv);
  u = cr(v, t);
  const h = w / 2;
  const sq = (c) => [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([i, j]) => [c[0] + (u[0] * i + v[0] * j) * h, c[1] + (u[1] * i + v[1] * j) * h, c[2] + (u[2] * i + v[2] * j) * h]);
  mb.hexa(key, sq(p), sq(q));
}

/** Wing element: a thin cambered plate spanning x0..x1, chord from zLead to zTrail, rising by `lift`. */
function plate(mb, key, x0, x1, zLead, zTrail, y, thick, lift = 0) {
  const b = [[x1, y + lift, zTrail], [x0, y + lift, zTrail], [x0, y, zLead], [x1, y, zLead]];
  mb.hexa(key, b, b.map(([x, yy, z]) => [x, yy + thick, z]));
}

function buildShell(mb) {
  // Spine: nose, tub, engine cover. Top half in livery, lower half carbon.
  for (let k = 0; k < SPINE.length - 1; k++) {
    const a = SPINE[k], b = SPINE[k + 1];
    const mid = (s) => [s[0], s[1], s[2], (s[2] + s[3]) / 2];
    const top = (s) => [s[0], s[1], (s[2] + s[3]) / 2, s[3]];
    mb.hexa('carbon', ring(mid(a)), ring(mid(b)));
    // Livery on top, with the cockpit opening cut from the tub (between z 0.6 and -0.3).
    if (!(a[0] <= 0.6 && b[0] >= -0.3)) mb.hexa('paint', ring(top(a)), ring(top(b)));
  }
  // Cockpit sides and rim around the opening.
  for (const s of [1, -1]) {
    mb.hexa('paint', [[0.35 * s, 0.4, 0.6], [0.26 * s, 0.4, 0.6], [0.26 * s, 0.4, -0.3], [0.35 * s, 0.4, -0.3]], [[0.35 * s, 0.68, 0.6], [0.26 * s, 0.7, 0.6], [0.26 * s, 0.7, -0.3], [0.35 * s, 0.68, -0.3]]);
    mb.hexa('carbon', [[0.27 * s, 0.68, 0.6], [0.22 * s, 0.68, 0.6], [0.22 * s, 0.68, -0.3], [0.27 * s, 0.68, -0.3]], [[0.27 * s, 0.72, 0.6], [0.22 * s, 0.72, 0.6], [0.22 * s, 0.72, -0.3], [0.27 * s, 0.72, -0.3]]);
  }
  mb.prism('interior', [[-0.26, 0.6], [0.26, 0.6], [0.26, -0.3], [-0.26, -0.3]], 'y', 0.38, 0.42); // cockpit floor
  // Nose tip accent and the front of the tub in stripe colour.
  mb.hexa('stripe', ring(SPINE[0], 0.003, 0.003), ring([2.45, 0.1, 0.25, 0.38], 0.003, 0.003));
  mb.hexa('stripe', ring([-0.75, 0.33, 0.6, 0.83], 0.004, 0.004), ring([-1.0, 0.29, 0.55, 0.75], 0.004, 0.004));
}

function buildFrontWing(mb) {
  // Main plane and two flaps rising towards the wheels, with endplates and nose pylons.
  plate(mb, 'carbon', -1.08, 1.08, 2.82, 2.48, 0.1, 0.035, 0.02);
  for (const s of [1, -1]) {
    plate(mb, 'paint', 0.18 * s, 1.06 * s, 2.55, 2.36, 0.16, 0.025, 0.08);
    plate(mb, 'stripe', 0.3 * s, 1.04 * s, 2.42, 2.26, 0.26, 0.02, 0.07);
    mb.prism('carbon', [[2.86, 0.08], [2.24, 0.08], [2.24, 0.4], [2.5, 0.42], [2.86, 0.22]], 'x', 1.06 * s - 0.015, 1.06 * s + 0.015);
    rod(mb, 'carbon', [0.06 * s, 0.13, 2.6], [0.06 * s, 0.3, 2.5], 0.03); // pylons
  }
}

function buildSidepods(mb) {
  for (const s of [1, -1]) {
    const S = (p) => [p[0] * s, p[1], p[2]];
    const front = [[0.34, 0.18, 0.45], [0.76, 0.18, 0.45], [0.76, 0.52, 0.42], [0.34, 0.6, 0.45]].map(S);
    const mid = [[0.34, 0.18, -0.4], [0.72, 0.2, -0.4], [0.7, 0.5, -0.4], [0.34, 0.6, -0.4]].map(S);
    const rear = [[0.25, 0.18, -1.5], [0.36, 0.2, -1.5], [0.36, 0.32, -1.5], [0.25, 0.42, -1.5]].map(S);
    mb.hexa('paint', front, mid);
    mb.hexa('paint', mid, rear);
    // Inlet: dark opening in the pod front.
    mb.prism('grille', [[0.4 * s, 0.24], [0.72 * s, 0.24], [0.72 * s, 0.48], [0.4 * s, 0.54]].map(([x, y]) => [x, y]), 'z', 0.455, 0.47);
    // Undercut and sidepod wing / bargeboard.
    mb.prism('carbon', [[0.85, 0.12], [0.85, 0.5], [0.4, 0.52], [0.2, 0.12]].map(([z, y]) => [z, y]), 'x', 0.78 * s - 0.01, 0.78 * s + 0.01);
    // Mirror on a stalk.
    rod(mb, 'carbon', [0.33 * s, 0.66, 0.5], [0.52 * s, 0.78, 0.48], 0.025);
    mb.hexa('carbon', [[0.48 * s, 0.74, 0.5], [0.64 * s, 0.74, 0.5], [0.64 * s, 0.74, 0.44], [0.48 * s, 0.74, 0.44]], [[0.48 * s, 0.83, 0.5], [0.64 * s, 0.83, 0.5], [0.64 * s, 0.83, 0.44], [0.48 * s, 0.83, 0.44]]);
    mb.prism('chrome', [[0.49 * s, 0.75], [0.63 * s, 0.75], [0.63 * s, 0.82], [0.49 * s, 0.82]], 'z', 0.435, 0.44);
  }
}

function buildEngineAndRear(mb) {
  // Airbox intake above the driver, roll hoop, T-cam and the shark fin.
  mb.prism('grille', [[-0.11, 0.7], [0.11, 0.7], [0.1, 0.86], [-0.1, 0.86]], 'z', -0.33, -0.31);
  mb.hexa('paint', [[0.13, 0.8, -0.3], [-0.13, 0.8, -0.3], [-0.13, 0.88, -0.3], [0.13, 0.88, -0.3]], [[0.18, 0.78, -0.75], [-0.18, 0.78, -0.75], [-0.16, 0.9, -0.75], [0.16, 0.9, -0.75]]);
  mb.hexa('stripe', [[0.05, 0.9, -0.42], [-0.05, 0.9, -0.42], [-0.05, 0.94, -0.42], [0.05, 0.94, -0.42]], [[0.05, 0.9, -0.5], [-0.05, 0.9, -0.5], [-0.05, 0.94, -0.5], [0.05, 0.94, -0.5]]);
  mb.prism('paint', [[-0.75, 0.82], [-2.05, 0.95], [-2.05, 0.62], [-1.2, 0.62]], 'x', -0.012, 0.012);
  // Floor with edge wing, and the diffuser fins.
  mb.prism('carbon', [[-0.85, 1.0], [0.85, 1.0], [0.85, -2.05], [-0.85, -2.05]], 'y', 0.06, 0.09);
  for (const s of [1, -1]) mb.prism('carbon', [[1.0, 0.06], [1.0, 0.13], [-2.05, 0.13], [-2.05, 0.06]], 'x', 0.84 * s - 0.01, 0.84 * s + 0.01);
  for (const x of [-0.6, -0.3, 0, 0.3, 0.6]) mb.prism('carbon', [[-2.05, 0.08], [-2.42, 0.36], [-2.42, 0.4], [-2.05, 0.12]], 'x', x - 0.01, x + 0.01);
  mb.prism('carbon', [[-0.62, 0.36], [0.62, 0.36], [0.62, 0.4], [-0.62, 0.4]], 'z', -2.42, -2.4);
  // Rear wing: endplates, main plane, DRS flap, beam wing, swan-neck pylon.
  for (const s of [1, -1]) mb.prism('paint', [[-2.0, 0.5], [-2.0, 1.04], [-2.4, 1.08], [-2.42, 0.46]], 'x', 0.56 * s - 0.015, 0.56 * s + 0.015);
  plate(mb, 'carbon', -0.55, 0.55, -2.04, -2.3, 0.82, 0.04, 0.05);
  plate(mb, 'paint', -0.55, 0.55, -2.26, -2.4, 0.93, 0.03, 0.06);
  plate(mb, 'carbon', -0.5, 0.5, -2.1, -2.3, 0.45, 0.03, 0.04);
  rod(mb, 'carbon', [0, 0.6, -1.9], [0, 0.97, -2.3], 0.04);
  // Rain light.
  mb.prism('tail', [[-0.06, 0.28], [0.06, 0.28], [0.06, 0.36], [-0.06, 0.36]], 'z', -2.44, -2.42);
}

function buildSuspension(mb) {
  // Upper and lower wishbones and push rods from the tub to each hub.
  for (const [z, inner, yb, yt] of [[AXLE_FRONT, 0.28, 0.24, 0.5], [AXLE_REAR, 0.22, 0.24, 0.46]]) {
    for (const s of [1, -1]) {
      for (const [y0, y1] of [[yb, 0.26], [yt, 0.48]]) {
        rod(mb, 'carbon', [inner * s, y0, z + 0.22], [(HUB_X - 0.12) * s, y1, z], 0.028);
        rod(mb, 'carbon', [inner * s, y0, z - 0.22], [(HUB_X - 0.12) * s, y1, z], 0.028);
      }
      rod(mb, 'titanium', [(HUB_X - 0.15) * s, 0.27, z], [(inner + 0.02) * s, 0.58, z + (z > 0 ? -0.15 : 0.15)], 0.022);
    }
  }
}

function buildDetails(mb) {
  buildFrontWing(mb);
  buildSidepods(mb);
  buildEngineAndRear(mb);
  buildSuspension(mb);
  // Halo: titanium hoop from the tub front over the cockpit to the roll-hoop sides.
  const H = [[0, 0.7, 0.6], [0, 0.88, 0.45], [0.16, 0.9, 0.2], [0.26, 0.88, -0.05], [0.28, 0.72, -0.25]];
  for (let k = 0; k < H.length - 1; k++) {
    rod(mb, 'titanium', H[k], H[k + 1], 0.045);
    if (k > 0) rod(mb, 'titanium', [-H[k][0], H[k][1], H[k][2]], [-H[k + 1][0], H[k + 1][1], H[k + 1][2]], 0.045);
  }
  // Number dot on the nose.
  lens(mb, 'plate', [0, 0.5, 1.75], [0, 0.85, 0.5], [0, 0, 1], 0.07, 0.07, { segments: 12 });
}

function buildAnimatedParts(mats) {
  const cockpit = buildCockpit(mats, { seatX: 0, seatZ: -0.15, wheelZ: 0.32, wheelY: 0.55, seatY: -0.05 });
  const ex = buildExhausts(mats, [{ x: 0, y: 0.5, z: -2.3, r: 0.05, sides: 10 }]);
  const group = new Group();
  group.add(...cockpit.group.children, ...ex.group.children);
  return { group, head: cockpit.head, steering: cockpit.steering, flames: ex.flames };
}
return { AXLE_FRONT, AXLE_REAR, NOSE_Z, TAIL_Z, rod, plate, buildShell, buildDetails, buildAnimatedParts };
})();
