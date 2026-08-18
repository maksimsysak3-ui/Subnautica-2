/**
 * Bounding volume hierarchy over axis-aligned boxes.
 *
 * The AI calls `lineOfSight` thousands of times a second; testing every
 * collider linearly (what the old world system did through THREE.Raycaster)
 * costs O(n) OBB tests per ray and dominates the frame at a few thousand
 * bricks. This is a plain binned-SAH BVH stored in flat typed arrays with an
 * explicit traversal stack — no allocations per query.
 *
 * Nodes are stored as:
 *   bounds[6i..6i+5]  minx,miny,minz,maxx,maxy,maxz
 *   left[i]           index of the first child (right child is left+1), or -1
 *   start[i],count[i] primitive range in `order` for leaves
 */

const BINS = 12;

export class Bvh {
  /** Primitive indices, reordered by the build. */
  order: Int32Array = new Int32Array(0);

  private bounds = new Float32Array(0);
  private left = new Int32Array(0);
  private start = new Int32Array(0);
  private count = new Int32Array(0);
  private nodeCount = 0;

  /** Traversal stack, sized at build time. */
  private stack = new Int32Array(64);

  /** Per-primitive AABBs, 6 floats each, indexed by primitive id. */
  private prim!: Float32Array;

  get nodes(): number {
    return this.nodeCount;
  }

  get primitiveCount(): number {
    return this.order.length;
  }

  /** `prims` is 6 floats per primitive: min xyz, max xyz. */
  build(prims: Float32Array, n: number): void {
    this.prim = prims;
    this.order = new Int32Array(n);
    for (let i = 0; i < n; i++) this.order[i] = i;

    const maxNodes = Math.max(1, 2 * n);
    this.bounds = new Float32Array(maxNodes * 6);
    this.left = new Int32Array(maxNodes).fill(-1);
    this.start = new Int32Array(maxNodes);
    this.count = new Int32Array(maxNodes);
    this.nodeCount = 0;

    if (n === 0) {
      this.nodeCount = 1;
      this.bounds.set([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], 0);
      return;
    }

    const root = this.newNode();
    this.start[root] = 0;
    this.count[root] = n;
    this.computeBounds(root);
    this.subdivide(root, 0);
    this.stack = new Int32Array(96);
  }

  private newNode(): number {
    return this.nodeCount++;
  }

  private computeBounds(node: number): void {
    let ax = Infinity, ay = Infinity, az = Infinity;
    let bx = -Infinity, by = -Infinity, bz = -Infinity;
    const s = this.start[node];
    const e = s + this.count[node];
    const p = this.prim;
    for (let i = s; i < e; i++) {
      const o = this.order[i] * 6;
      if (p[o] < ax) ax = p[o];
      if (p[o + 1] < ay) ay = p[o + 1];
      if (p[o + 2] < az) az = p[o + 2];
      if (p[o + 3] > bx) bx = p[o + 3];
      if (p[o + 4] > by) by = p[o + 4];
      if (p[o + 5] > bz) bz = p[o + 5];
    }
    const b = node * 6;
    this.bounds[b] = ax; this.bounds[b + 1] = ay; this.bounds[b + 2] = az;
    this.bounds[b + 3] = bx; this.bounds[b + 4] = by; this.bounds[b + 5] = bz;
  }

  private subdivide(node: number, depth: number): void {
    const n = this.count[node];
    if (n <= 4 || depth > 40) return;

    const b = node * 6;
    const ex = this.bounds[b + 3] - this.bounds[b];
    const ey = this.bounds[b + 4] - this.bounds[b + 1];
    const ez = this.bounds[b + 5] - this.bounds[b + 2];
    let axis = 0;
    let extent = ex;
    if (ey > extent) { axis = 1; extent = ey; }
    if (ez > extent) { axis = 2; extent = ez; }
    if (extent < 1e-5) return;

    // Binned split on the primitive centroid along the widest axis.
    const lo = this.bounds[b + axis];
    const scale = BINS / extent;
    const binCount = new Int32Array(BINS);
    const binMin = new Float32Array(BINS * 3).fill(Infinity);
    const binMax = new Float32Array(BINS * 3).fill(-Infinity);
    const s = this.start[node];
    const e = s + n;
    const p = this.prim;

    for (let i = s; i < e; i++) {
      const o = this.order[i] * 6;
      const c = (p[o + axis] + p[o + axis + 3]) * 0.5;
      let bi = ((c - lo) * scale) | 0;
      if (bi < 0) bi = 0;
      if (bi >= BINS) bi = BINS - 1;
      binCount[bi]++;
      for (let k = 0; k < 3; k++) {
        if (p[o + k] < binMin[bi * 3 + k]) binMin[bi * 3 + k] = p[o + k];
        if (p[o + k + 3] > binMax[bi * 3 + k]) binMax[bi * 3 + k] = p[o + k + 3];
      }
    }

    // Sweep for the cheapest split plane by surface-area heuristic.
    const leftArea = new Float32Array(BINS);
    const leftNum = new Int32Array(BINS);
    let lminx = Infinity, lminy = Infinity, lminz = Infinity;
    let lmaxx = -Infinity, lmaxy = -Infinity, lmaxz = -Infinity;
    let acc = 0;
    for (let i = 0; i < BINS - 1; i++) {
      acc += binCount[i];
      leftNum[i] = acc;
      if (binCount[i] > 0) {
        lminx = Math.min(lminx, binMin[i * 3]); lmaxx = Math.max(lmaxx, binMax[i * 3]);
        lminy = Math.min(lminy, binMin[i * 3 + 1]); lmaxy = Math.max(lmaxy, binMax[i * 3 + 1]);
        lminz = Math.min(lminz, binMin[i * 3 + 2]); lmaxz = Math.max(lmaxz, binMax[i * 3 + 2]);
      }
      leftArea[i] = area(lmaxx - lminx, lmaxy - lminy, lmaxz - lminz);
    }

    let best = -1;
    let bestCost = Infinity;
    let rminx = Infinity, rminy = Infinity, rminz = Infinity;
    let rmaxx = -Infinity, rmaxy = -Infinity, rmaxz = -Infinity;
    let racc = 0;
    for (let i = BINS - 1; i >= 1; i--) {
      racc += binCount[i];
      if (binCount[i] > 0) {
        rminx = Math.min(rminx, binMin[i * 3]); rmaxx = Math.max(rmaxx, binMax[i * 3]);
        rminy = Math.min(rminy, binMin[i * 3 + 1]); rmaxy = Math.max(rmaxy, binMax[i * 3 + 1]);
        rminz = Math.min(rminz, binMin[i * 3 + 2]); rmaxz = Math.max(rmaxz, binMax[i * 3 + 2]);
      }
      const li = i - 1;
      if (leftNum[li] === 0 || racc === 0) continue;
      const cost = leftArea[li] * leftNum[li] + area(rmaxx - rminx, rmaxy - rminy, rmaxz - rminz) * racc;
      if (cost < bestCost) {
        bestCost = cost;
        best = i;
      }
    }
    if (best < 0) return;

    // Partition in place.
    let i = s;
    let j = e - 1;
    while (i <= j) {
      const o = this.order[i] * 6;
      const c = (p[o + axis] + p[o + axis + 3]) * 0.5;
      let bi = ((c - lo) * scale) | 0;
      if (bi < 0) bi = 0;
      if (bi >= BINS) bi = BINS - 1;
      if (bi < best) {
        i++;
      } else {
        const t = this.order[i];
        this.order[i] = this.order[j];
        this.order[j] = t;
        j--;
      }
    }
    const leftCount = i - s;
    if (leftCount === 0 || leftCount === n) return;

    const l = this.newNode();
    const r = this.newNode();
    this.left[node] = l;
    this.count[node] = 0;
    this.start[l] = s; this.count[l] = leftCount;
    this.start[r] = i; this.count[r] = n - leftCount;
    this.computeBounds(l);
    this.computeBounds(r);
    this.subdivide(l, depth + 1);
    this.subdivide(r, depth + 1);
  }

  /**
   * Walks the tree along a ray, calling `test(primIndex)` for every candidate.
   * `test` returns the hit distance or a negative number for a miss; the
   * traversal shrinks its own `maxT` as hits come in, so it converges fast.
   * Returns the nearest distance found, or -1.
   */
  raycast(
    ox: number, oy: number, oz: number,
    dx: number, dy: number, dz: number,
    maxT: number,
    test: (prim: number, maxT: number) => number,
  ): number {
    if (this.nodeCount === 0) return -1;
    const invx = 1 / (dx || 1e-12);
    const invy = 1 / (dy || 1e-12);
    const invz = 1 / (dz || 1e-12);
    const stack = this.stack;
    let sp = 0;
    stack[sp++] = 0;
    let best = maxT;
    let found = -1;
    const bd = this.bounds;

    while (sp > 0) {
      const node = stack[--sp];
      const b = node * 6;
      // Slab test against the node.
      let t0 = (bd[b] - ox) * invx;
      let t1 = (bd[b + 3] - ox) * invx;
      let tmin = t0 < t1 ? t0 : t1;
      let tmax = t0 < t1 ? t1 : t0;
      t0 = (bd[b + 1] - oy) * invy;
      t1 = (bd[b + 4] - oy) * invy;
      tmin = Math.max(tmin, t0 < t1 ? t0 : t1);
      tmax = Math.min(tmax, t0 < t1 ? t1 : t0);
      t0 = (bd[b + 2] - oz) * invz;
      t1 = (bd[b + 5] - oz) * invz;
      tmin = Math.max(tmin, t0 < t1 ? t0 : t1);
      tmax = Math.min(tmax, t0 < t1 ? t1 : t0);
      if (tmax < Math.max(tmin, 0) || tmin > best) continue;

      const l = this.left[node];
      if (l < 0) {
        const s = this.start[node];
        const e = s + this.count[node];
        for (let i = s; i < e; i++) {
          const prim = this.order[i];
          const t = test(prim, best);
          if (t >= 0 && t < best) {
            best = t;
            found = prim;
          }
        }
      } else {
        if (sp + 2 >= stack.length) continue;
        stack[sp++] = l;
        stack[sp++] = l + 1;
      }
    }
    this.lastDistance = found >= 0 ? best : -1;
    return found;
  }

  /** Distance of the primitive returned by the last `raycast`. */
  lastDistance = -1;

  /**
   * Every primitive whose AABB overlaps the ray segment, unordered.
   * Used by raycastAll (wall penetration) where all hits are needed anyway.
   */
  raycastCandidates(
    ox: number, oy: number, oz: number,
    dx: number, dy: number, dz: number,
    maxT: number,
    visit: (prim: number) => void,
  ): void {
    if (this.nodeCount === 0) return;
    const invx = 1 / (dx || 1e-12);
    const invy = 1 / (dy || 1e-12);
    const invz = 1 / (dz || 1e-12);
    const stack = this.stack;
    let sp = 0;
    stack[sp++] = 0;
    const bd = this.bounds;
    while (sp > 0) {
      const node = stack[--sp];
      const b = node * 6;
      let t0 = (bd[b] - ox) * invx;
      let t1 = (bd[b + 3] - ox) * invx;
      let tmin = t0 < t1 ? t0 : t1;
      let tmax = t0 < t1 ? t1 : t0;
      t0 = (bd[b + 1] - oy) * invy;
      t1 = (bd[b + 4] - oy) * invy;
      tmin = Math.max(tmin, t0 < t1 ? t0 : t1);
      tmax = Math.min(tmax, t0 < t1 ? t1 : t0);
      t0 = (bd[b + 2] - oz) * invz;
      t1 = (bd[b + 5] - oz) * invz;
      tmin = Math.max(tmin, t0 < t1 ? t0 : t1);
      tmax = Math.min(tmax, t0 < t1 ? t1 : t0);
      if (tmax < Math.max(tmin, 0) || tmin > maxT) continue;
      const l = this.left[node];
      if (l < 0) {
        const s = this.start[node];
        const e = s + this.count[node];
        for (let i = s; i < e; i++) visit(this.order[i]);
      } else {
        if (sp + 2 >= stack.length) continue;
        stack[sp++] = l;
        stack[sp++] = l + 1;
      }
    }
  }

  /** Every primitive whose AABB overlaps the query box. */
  queryBox(
    minx: number, miny: number, minz: number,
    maxx: number, maxy: number, maxz: number,
    visit: (prim: number) => void,
  ): void {
    if (this.nodeCount === 0) return;
    const stack = this.stack;
    let sp = 0;
    stack[sp++] = 0;
    const bd = this.bounds;
    while (sp > 0) {
      const node = stack[--sp];
      const b = node * 6;
      if (bd[b] > maxx || bd[b + 3] < minx) continue;
      if (bd[b + 1] > maxy || bd[b + 4] < miny) continue;
      if (bd[b + 2] > maxz || bd[b + 5] < minz) continue;
      const l = this.left[node];
      if (l < 0) {
        const s = this.start[node];
        const e = s + this.count[node];
        for (let i = s; i < e; i++) visit(this.order[i]);
      } else {
        if (sp + 2 >= stack.length) continue;
        stack[sp++] = l;
        stack[sp++] = l + 1;
      }
    }
  }
}

function area(x: number, y: number, z: number): number {
  if (x < 0 || y < 0 || z < 0) return 0;
  return 2 * (x * y + y * z + z * x);
}
