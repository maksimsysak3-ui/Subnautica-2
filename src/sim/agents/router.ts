/**
 * The routing service: who wants a path, where the paths are kept, and how much
 * of a tick may be spent working them out.
 *
 * A city of a hundred thousand people does not need a hundred thousand searches
 * a second. A trip lasts minutes, so at any moment the number of travellers who
 * need a *new* path is a few hundred a second -- and most of them want a path
 * somebody else has already asked for, because people leave the same streets for
 * the same places. So the three things that matter are not the search itself:
 *
 *   A budget. Requests queue and the service spends a fixed slice of each tick
 *   on them. A traveller that waits two ticks for its route has waited a fifth
 *   of a second, and nobody can see that; a frame that stops to solve four
 *   hundred routes at once is a visible stutter, and that is what every city
 *   builder does wrong.
 *
 *   A cache. Two-way associative, fixed size, no clearing and no bookkeeping
 *   beyond a use stamp. A conflict costs one re-search, which is a far better
 *   trade than the allocation and churn of anything cleverer.
 *
 *   Somewhere to put the paths. Fifty thousand vehicles holding a small array
 *   each is fifty thousand allocations the collector has to walk. One arena of
 *   size classes with a free list per class is a handful of buffers, reused
 *   forever, and a path is then a number.
 *
 * Paths are shared, so they are reference counted: the cache holds one count and
 * each traveller holds another, and the block goes back on the free list when
 * the last of them lets go. That is the one piece of bookkeeping in here that
 * has to be exactly right, because a path freed while a car is still driving it
 * sends that car down whatever route is written there next.
 */

import { Table } from './store';
import { Pathfinder, Outcome, NO_PATH } from './path';
import type { LaneGraph } from './lanes';

/** Nothing is known about this route yet. Distinct from a known failure. */
export const CACHE_MISS = -2;

/** The longest route the arena will store, in lanes. */
export const MAX_PATH = 2048;
/** Size classes: 2^4 .. 2^11 lanes. */
const MIN_CLASS = 4;
const MAX_CLASS = 11;

/** How long a served request may sit in the cache before a conflict evicts it. */
interface Stats {
  /** Searches actually run. */
  solved: number;
  /** Requests answered from the cache. */
  cached: number;
  /** Requests that had no route. */
  failed: number;
  /** Requests still waiting. */
  queued: number;
  /** Milliseconds spent in the last serve. */
  ms: number;
  /** Lanes expanded in the last serve. */
  expanded: number;
  /** Requests dropped because their traveller no longer exists. */
  stale: number;
}

/**
 * The path arena.
 *
 * Blocks are powers of two so a freed block always fits the next request of its
 * class exactly, which is what keeps the free lists short and the arena from
 * fragmenting. A path of 40 lanes takes a 64-lane block and wastes 96 bytes;
 * that waste is the price of never searching for a fit.
 */
export class PathStore {
  private data: Int32Array;
  private top = 0;
  private readonly blocks = new Table({
    off: Int32Array, len: Int32Array, cls: Uint8Array, refs: Int32Array,
  }, 1024);
  /** Freed blocks, by size class. */
  private readonly free: number[][] = [];

  constructor(capacity = 1 << 16) {
    this.data = new Int32Array(capacity);
    for (let c = 0; c <= MAX_CLASS; c++) this.free.push([]);
  }

  /** Live paths. */
  get count(): number { return this.blocks.size; }
  /** Ints of arena in use, and total. */
  get used(): number { return this.top; }
  get capacity(): number { return this.data.length; }

  /**
   * Copies `n` lanes of `src` into a new block and returns its handle.
   *
   * The handle starts with one reference, held by whoever called this.
   */
  alloc(src: Int32Array, n: number): number {
    if (n <= 0 || n > MAX_PATH) return NO_PATH;
    let cls = MIN_CLASS;
    while ((1 << cls) < n) cls++;
    const size = 1 << cls;
    const reuse = this.free[cls];
    let off: number;
    if (reuse.length > 0) {
      off = reuse.pop() as number;
    } else {
      if (this.top + size > this.data.length) {
        let next = this.data.length * 2;
        while (this.top + size > next) next *= 2;
        const grown = new Int32Array(next);
        grown.set(this.data);
        this.data = grown;
      }
      off = this.top;
      this.top += size;
    }
    const id = this.blocks.add();
    this.blocks.col.off[id] = off;
    this.blocks.col.len[id] = n;
    this.blocks.col.cls[id] = cls;
    this.blocks.col.refs[id] = 1;
    this.data.set(src.subarray(0, n), off);
    return id;
  }

  /** How many lanes a path has. */
  length(h: number): number {
    return h < 0 || this.blocks.live[h] === 0 ? 0 : this.blocks.col.len[h];
  }

  /** The `i`th lane of a path. */
  at(h: number, i: number): number {
    if (h < 0 || this.blocks.live[h] === 0) return -1;
    if (i < 0 || i >= this.blocks.col.len[h]) return -1;
    return this.data[this.blocks.col.off[h] + i];
  }

  /** The path, as a view onto the arena. Valid until the next alloc. */
  view(h: number): Int32Array {
    if (h < 0 || this.blocks.live[h] === 0) return this.data.subarray(0, 0);
    const off = this.blocks.col.off[h];
    return this.data.subarray(off, off + this.blocks.col.len[h]);
  }

  retain(h: number): void {
    if (h >= 0 && this.blocks.live[h] === 1) this.blocks.col.refs[h]++;
  }

  /** Lets go of a path. The block is reusable once nobody holds it. */
  release(h: number): void {
    if (h < 0 || this.blocks.live[h] === 0) return;
    if (--this.blocks.col.refs[h] > 0) return;
    this.free[this.blocks.col.cls[h]].push(this.blocks.col.off[h]);
    this.blocks.remove(h);
  }

  /** References held on a path, for the tests and the readout. */
  refs(h: number): number {
    return h < 0 || this.blocks.live[h] === 0 ? 0 : this.blocks.col.refs[h];
  }

  bytes(): number { return this.data.byteLength + this.blocks.bytes(); }
}

/**
 * A fixed-size, two-way associative path cache.
 *
 * Two ways rather than one because a direct-mapped cache throws away a hot entry
 * whenever a cold one hashes to the same slot, and two ways removes most of that
 * for one extra comparison. Not more ways, and not open addressing with probing:
 * a miss here costs one search, and a search is a millisecond at worst. What
 * would actually hurt is a cache that grows without bound or stalls to rehash.
 */
class PathCache {
  private readonly from: Int32Array;
  private readonly to: Int32Array;
  private readonly layer: Int8Array;
  private readonly path: Int32Array;
  /** When this entry was last wanted, for choosing which way to evict. */
  private readonly stamp: Int32Array;
  private readonly mask: number;
  private clock = 0;
  hits = 0;
  misses = 0;

  constructor(entries: number, private readonly store: PathStore) {
    let n = 1024;
    while (n < entries) n *= 2;
    this.mask = (n - 1) & ~1;              // pairs, so the low bit picks the way
    this.from = new Int32Array(n).fill(-1);
    this.to = new Int32Array(n);
    this.layer = new Int8Array(n);
    this.path = new Int32Array(n).fill(NO_PATH);
    this.stamp = new Int32Array(n);
  }

  private slot(layer: number, from: number, to: number): number {
    let h = Math.imul(from, 0x9e3779b1) ^ Math.imul(to, 0x85ebca77) ^ Math.imul(layer, 0xc2b2ae35);
    h ^= h >>> 15;
    return (h >>> 0) & this.mask;
  }

  /**
   * Looks a route up: a path handle, retained for the caller; NO_PATH for a
   * route already known not to exist; CACHE_MISS for one never asked before.
   *
   * Three outcomes rather than two, and that is the point. A route that does not
   * exist is worth remembering: without it, every car in a district the player
   * has just cut off re-searches the whole reachable network every time it tries
   * to leave -- which is the single most expensive thing the router can do, and
   * it happens precisely when the player is watching, straight after an edit.
   */
  get(layer: number, from: number, to: number): number {
    const s = this.slot(layer, from, to);
    for (let w = 0; w < 2; w++) {
      const i = s + w;
      if (this.from[i] === from && this.to[i] === to && this.layer[i] === layer) {
        this.stamp[i] = ++this.clock;
        this.hits++;
        const h = this.path[i];
        if (h !== NO_PATH) this.store.retain(h);
        return h;
      }
    }
    this.misses++;
    return CACHE_MISS;
  }

  /** Stores a path, taking a reference of its own. */
  put(layer: number, from: number, to: number, h: number): void {
    const s = this.slot(layer, from, to);
    // The way that has not been wanted for longest, and an empty one first.
    let i = s;
    if (this.from[s] < 0) i = s;
    else if (this.from[s + 1] < 0) i = s + 1;
    else i = this.stamp[s] <= this.stamp[s + 1] ? s : s + 1;
    if (this.from[i] >= 0 && this.path[i] !== NO_PATH) this.store.release(this.path[i]);
    this.from[i] = from; this.to[i] = to; this.layer[i] = layer;
    this.path[i] = h; this.stamp[i] = ++this.clock;
    if (h !== NO_PATH) this.store.retain(h);
  }

  /** Drops everything. Called when the road network changes under it. */
  clear(): void {
    for (let i = 0; i < this.from.length; i++) {
      if (this.from[i] >= 0 && this.path[i] !== NO_PATH) this.store.release(this.path[i]);
      this.from[i] = -1; this.path[i] = NO_PATH;
    }
    this.clock = 0;
  }

  get entries(): number { return this.from.length; }
  bytes(): number {
    return this.from.byteLength + this.to.byteLength + this.layer.byteLength
      + this.path.byteLength + this.stamp.byteLength;
  }
}

/**
 * A ring of pending requests.
 *
 * Flat arrays and a head and tail, because the queue is drained every tick and
 * the one thing it must not do is allocate. It grows by doubling if a burst
 * outruns the budget -- a disaster evacuating a district will do that -- and
 * never shrinks, because it will happen again.
 */
class Queue {
  private layer: Uint8Array;
  private from: Int32Array;
  private to: Int32Array;
  private sink: Uint8Array;
  private slot: Int32Array;
  private token: Int32Array;
  private head = 0;
  private tail = 0;
  private mask: number;

  constructor(capacity = 1024) {
    let n = 16;
    while (n < capacity) n *= 2;
    this.mask = n - 1;
    this.layer = new Uint8Array(n); this.from = new Int32Array(n);
    this.to = new Int32Array(n); this.sink = new Uint8Array(n);
    this.slot = new Int32Array(n); this.token = new Int32Array(n);
  }

  get size(): number { return this.tail - this.head; }

  push(layer: number, from: number, to: number, sink: number, slot: number, token: number): void {
    if (this.size > this.mask) this.grow();
    const i = this.tail++ & this.mask;
    this.layer[i] = layer; this.from[i] = from; this.to[i] = to;
    this.sink[i] = sink; this.slot[i] = slot; this.token[i] = token;
  }

  /** Reads the front entry into the five out-params and drops it. */
  shift(out: Int32Array): boolean {
    if (this.tail === this.head) return false;
    const i = this.head++ & this.mask;
    out[0] = this.layer[i]; out[1] = this.from[i]; out[2] = this.to[i];
    out[3] = this.sink[i]; out[4] = this.slot[i]; out[5] = this.token[i];
    return true;
  }

  private grow(): void {
    const n = (this.mask + 1) * 2;
    const layer = new Uint8Array(n), from = new Int32Array(n), to = new Int32Array(n);
    const sink = new Uint8Array(n), slot = new Int32Array(n), token = new Int32Array(n);
    for (let k = 0; k < this.size; k++) {
      const i = (this.head + k) & this.mask;
      layer[k] = this.layer[i]; from[k] = this.from[i]; to[k] = this.to[i];
      sink[k] = this.sink[i]; slot[k] = this.slot[i]; token[k] = this.token[i];
    }
    this.tail = this.size; this.head = 0; this.mask = n - 1;
    this.layer = layer; this.from = from; this.to = to;
    this.sink = sink; this.slot = slot; this.token = token;
  }

  clear(): void { this.head = 0; this.tail = 0; }
}

/**
 * Where a served request puts its answer.
 *
 * A sink is a column of an entity table -- `Vehicles.col.path`, say -- plus the
 * table's live flags, so a request for a car that has since been deleted is
 * dropped instead of writing a path handle into a row that now belongs to
 * somebody else. The token is the row's generation at the time of the request,
 * which is what makes "since deleted" a question that can be answered at all.
 *
 * The slot is owned by the router's answer. Every slot starts at NO_PATH, the
 * router releases whatever a slot held before writing a new handle into it, and
 * the owner releases the handle and sets the slot back to NO_PATH when it has
 * finished with the route. Without that first rule every traveller that asks for
 * a second route leaks its first one, and a leak here is invisible: nothing
 * breaks, the arena simply never stops growing.
 */
export interface Sink {
  readonly name: string;
  /** Written with the path handle, or NO_PATH on failure. Starts at NO_PATH. */
  readonly out: Int32Array;
  /** Whether a row still exists, and whether it is still the same occupant. */
  alive(slot: number, token: number): boolean;
}

/**
 * The service.
 *
 * `request` is cheap and never searches. `serve` is where the time goes, and it
 * is given a budget. Everything else is bookkeeping.
 */
export class Router {
  private finder: Pathfinder;
  private readonly store: PathStore;
  private readonly cache: PathCache;
  private readonly urgent = new Queue(256);
  private readonly normal = new Queue(4096);
  private readonly scratch = new Int32Array(MAX_PATH);
  private readonly entry = new Int32Array(6);
  private readonly sinks: Sink[] = [];
  private graph: LaneGraph;

  /** Bumped whenever the network changes: a held path older than this is void. */
  version = 0;

  readonly stats: Stats = {
    solved: 0, cached: 0, failed: 0, queued: 0, ms: 0, expanded: 0, stale: 0,
  };

  constructor(graph: LaneGraph, cacheEntries = 1 << 15) {
    this.graph = graph;
    this.finder = new Pathfinder(graph);
    this.store = new PathStore();
    this.cache = new PathCache(cacheEntries, this.store);
  }

  get paths(): PathStore { return this.store; }
  /** The network being routed on. Systems read lane geometry through this. */
  get lanes(): LaneGraph { return this.graph; }
  get pending(): number { return this.urgent.size + this.normal.size; }
  get hitRate(): number {
    const n = this.cache.hits + this.cache.misses;
    return n === 0 ? 0 : this.cache.hits / n;
  }

  /** Registers somewhere answers can be written. Returns the sink's id. */
  addSink(sink: Sink): number {
    this.sinks.push(sink);
    return this.sinks.length - 1;
  }

  /**
   * Asks for a route. Returns nothing: the answer arrives in the sink, later.
   *
   * Urgent requests -- an ambulance, a fire engine -- jump the whole queue.
   * Everything else is first come, first served, because a citizen whose bus
   * route is worked out a tick after their neighbour's has no way to tell.
   */
  request(layer: number, from: number, to: number, sink: number, slot: number,
    token: number, urgent = false): void {
    (urgent ? this.urgent : this.normal).push(layer, from, to, sink, slot, token);
  }

  /**
   * Spends up to `budgetMs` on the queue, and at most `maxQueries` searches.
   *
   * The clock is read before every request, not every eighth. Eight cold
   * searches on a big network is half a millisecond of work between checks, so
   * a two-millisecond budget overran to five -- and a budget that is only
   * approximately a budget is not one. Reading the clock costs a few tens of
   * nanoseconds against a cache hit's microsecond, which is the right trade.
   */
  serve(budgetMs = 2, maxQueries = 512): void {
    const t0 = performance.now();
    const st = this.stats;
    st.ms = 0; st.expanded = 0;
    let done = 0;
    for (;;) {
      if (done >= maxQueries) break;
      if (done > 0 && performance.now() - t0 >= budgetMs) break;
      if (!this.urgent.shift(this.entry) && !this.normal.shift(this.entry)) break;
      done++;
      // Read by index: destructuring a typed array builds an iterator, and at
      // five hundred requests a tick that allocation is the whole cost of a hit.
      const e = this.entry;
      const layer = e[0], from = e[1], to = e[2], slot = e[4], token = e[5];
      const sink = this.sinks[e[3]];
      if (sink === undefined || !sink.alive(slot, token)) { st.stale++; continue; }

      const known = this.cache.get(layer, from, to);
      if (known !== CACHE_MISS) {
        this.deliver(sink, slot, known);
        if (known === NO_PATH) st.failed++; else st.cached++;
        continue;
      }
      const n = this.finder.find(layer, from, to, this.scratch);
      st.expanded += this.finder.expanded;
      if (n === 0) {
        // Remember the failure so a cut-off district does not re-search the
        // whole network for every traveller in it.
        if (this.finder.outcome === Outcome.UNREACHABLE) {
          this.cache.put(layer, from, to, NO_PATH);
        }
        this.deliver(sink, slot, NO_PATH);
        st.failed++;
        continue;
      }
      const h = this.store.alloc(this.scratch, n);
      this.cache.put(layer, from, to, h);       // takes its own reference
      this.deliver(sink, slot, h);              // and the caller keeps ours
      st.solved++;
    }
    st.queued = this.pending;
    st.ms = performance.now() - t0;
  }

  /**
   * Writes an answer into a slot, letting go of whatever was there.
   *
   * A traveller that asks for a new route before releasing its old one is the
   * normal case -- it happens every time somebody changes their mind -- so the
   * router does the release rather than trusting thirty call sites to remember.
   */
  private deliver(sink: Sink, slot: number, h: number): void {
    const held = sink.out[slot];
    if (held === h) {
      // The same route, into a slot that already holds it. The lookup that
      // produced `h` took a reference, and one slot is one reference -- so the
      // extra one goes back, or a traveller that asks the same question twice
      // pins its path in the arena forever.
      if (h >= 0) this.store.release(h);
      return;
    }
    if (held >= 0) this.store.release(held);
    sink.out[slot] = h;
  }

  /**
   * Answers a route immediately, outside the budget.
   *
   * For the handful of things that genuinely cannot wait a tick -- working out
   * whether a service building covers an address at the moment it is placed --
   * and deliberately awkward to reach for, because every caller that uses this
   * instead of `request` is a caller that can stutter the frame.
   */
  solveNow(layer: number, from: number, to: number): number {
    const known = this.cache.get(layer, from, to);
    if (known !== CACHE_MISS) return known;
    const n = this.finder.find(layer, from, to, this.scratch);
    if (n === 0) {
      if (this.finder.outcome === Outcome.UNREACHABLE) this.cache.put(layer, from, to, NO_PATH);
      this.stats.failed++;
      return NO_PATH;
    }
    const h = this.store.alloc(this.scratch, n);
    this.cache.put(layer, from, to, h);
    this.stats.solved++;
    return h;
  }

  /** Seconds the last route solved would take. Read straight after solving. */
  get seconds(): number { return this.finder.seconds; }

  /** Lets go of a path. Every holder must, exactly once. */
  release(h: number): void { this.store.release(h); }

  /**
   * The network changed.
   *
   * Everything cached is void, and so is everything queued -- a request names
   * lanes, and the lanes have been renumbered. Paths travellers are holding are
   * void too, but this cannot reach them: they compare `version` and ask again.
   * That is deliberate, because a car halfway along a route the player has just
   * bulldozed has to decide for itself what to do, and only it knows where it is.
   */
  rebind(graph: LaneGraph): void {
    this.graph = graph;
    this.finder = new Pathfinder(graph);
    this.cache.clear();
    this.urgent.clear();
    this.normal.clear();
    this.version++;
  }

  /** What the service occupies, for the budget readout. */
  bytes(): number {
    return this.store.bytes() + this.cache.bytes() + this.finder.bytes();
  }

  /** For the readout: cache entries and how full the arena is. */
  get report(): string {
    return `paths ${this.store.count} in ${(this.store.used * 4 / 1024).toFixed(0)} KiB`
      + `, cache ${(this.hitRate * 100).toFixed(0)}% of ${this.cache.entries}`
      + `, queue ${this.pending}`;
  }
}
