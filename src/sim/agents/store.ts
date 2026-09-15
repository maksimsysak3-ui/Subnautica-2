/**
 * The database: entities as columns of typed arrays.
 *
 * Every table in the simulation -- citizens, vehicles, buildings, requests --
 * is an instance of this. There is exactly one storage strategy in the whole
 * simulation and this is it, which is worth stating plainly because the
 * alternative is the thing that kills city builders: an array of objects, one
 * per citizen, each a separate allocation with a hidden class and a pointer to
 * chase. A hundred thousand of those is a hundred thousand cache misses per
 * pass and a garbage collector with a hundred thousand reasons to run.
 *
 * Columns instead. One typed array per field, every entity's field sat next to
 * its neighbours'. A pass that reads three fields of a hundred thousand
 * citizens touches three contiguous runs of memory and nothing else, which is
 * the difference between a simulation that scales to a metropolis and one that
 * stops at a town.
 *
 * What this is not: an ECS with dynamic component composition, archetypes and
 * queries. That machinery earns its keep when entity shapes are discovered at
 * runtime -- a modding surface, say. Here the shapes are known: a citizen is a
 * citizen. Paying an archetype lookup to find out would be paying for
 * flexibility nothing asks for, so tables are declared and that is that.
 */

/** The typed-array kinds a column can be. */
export type ColumnKind =
  | Float32ArrayConstructor
  | Int32ArrayConstructor
  | Uint32ArrayConstructor
  | Int16ArrayConstructor
  | Uint16ArrayConstructor
  | Uint8ArrayConstructor
  | Int8ArrayConstructor;

export type Schema = Record<string, ColumnKind>;
export type Columns<S extends Schema> = { [K in keyof S]: InstanceType<S[K]> };

/**
 * A handle to a row that can tell you whether the row is still the one you
 * meant.
 *
 * Ids are reused -- that is the point of a free list -- so an id alone is a
 * dangling pointer waiting to happen: a dispatcher holding citizen 41 has no
 * way to know that citizen 41 died and a newborn took the slot. The handle
 * carries the generation the slot was on when it was handed out, and the slot
 * bumps its generation every time it is reused, so a stale handle is
 * detectable rather than silently wrong.
 *
 * Packed into one number so it can live in a column: the low twenty-four bits
 * are the id, the top eight the generation. Sixteen million rows per table and
 * two hundred and fifty-six reuses before a generation wraps, which at the
 * rate a city recycles citizens is a couple of centuries.
 */
export type Handle = number;

export const NO_HANDLE = -1;
const ID_BITS = 24;
const ID_MASK = (1 << ID_BITS) - 1;
/**
 * Seven bits of generation, not eight.
 *
 * Eight would put the top bit of a 32-bit integer in play, so a handle to a row
 * on its 128th occupant came out negative -- and every "is this handle any good"
 * test starts by rejecting a negative, because that is what "none" is. So handles
 * silently stopped working on rows that had turned over 128 times, which in a
 * city is the busiest rows: the ones people are constantly born into and die out
 * of. Sixteen million ids and a hundred and twenty-eight generations, all
 * non-negative, is the right side of that trade.
 */
const GEN_BITS = 7;
const GEN_MASK = (1 << GEN_BITS) - 1;

export const handleId = (h: Handle): number => h & ID_MASK;
export const handleGen = (h: Handle): number => (h >>> ID_BITS) & GEN_MASK;
export const makeHandle = (id: number, gen: number): Handle =>
  (id & ID_MASK) | ((gen & GEN_MASK) << ID_BITS);

/**
 * A table of rows.
 *
 * Rows are added and removed; the ids of removed rows come back round. Nothing
 * is ever compacted, because compaction moves rows and everything that refers
 * to a row by id would have to be found and rewritten -- which in a simulation
 * where citizens point at buildings that point at vehicles that point back is
 * the whole database. A hole in a column costs the eight bytes it sits in and
 * a branch in the passes that walk it, and that is far cheaper.
 */
export class Table<S extends Schema> {
  readonly col: Columns<S>;
  /** Which rows are in use. One byte each: the passes test this constantly. */
  readonly live: Uint8Array;
  /** The generation each slot is on, for handle validation. */
  private readonly gen: Uint8Array;
  /** Ids returned by remove(), waiting to be handed out again. */
  private readonly freed: Int32Array;
  private freedCount = 0;
  /** One past the highest id ever allocated: the passes stop here. */
  private high = 0;
  private alive = 0;
  private cap: number;
  private readonly schema: S;

  constructor(schema: S, capacity: number) {
    this.schema = schema;
    this.cap = Math.max(1, capacity);
    this.col = {} as Columns<S>;
    for (const key of Object.keys(schema) as (keyof S)[]) {
      // eslint-disable-next-line new-cap
      (this.col as Record<string, unknown>)[key as string] = new schema[key](this.cap);
    }
    this.live = new Uint8Array(this.cap);
    this.gen = new Uint8Array(this.cap);
    this.freed = new Int32Array(this.cap);
  }

  /** Rows in use. */
  get size(): number { return this.alive; }
  /** One past the highest id in use: the bound for a walk over the table. */
  get bound(): number { return this.high; }
  get capacity(): number { return this.cap; }

  /**
   * Takes a row, from the free list if there is one.
   *
   * Columns are *not* cleared. A caller that allocates a row and does not
   * write every field it later reads has a bug, and zeroing on allocation
   * hides it behind a plausible-looking zero -- while costing a write over
   * every column of every spawn, which at a thousand spawns a second is real.
   * `clear` is there for callers that want it.
   */
  add(): number {
    if (this.freedCount > 0) {
      const id = this.freed[--this.freedCount];
      this.live[id] = 1;
      this.alive++;
      return id;
    }
    if (this.high >= this.cap) this.grow(this.cap * 2);
    const id = this.high++;
    this.live[id] = 1;
    this.alive++;
    return id;
  }

  remove(id: number): void {
    if (id < 0 || id >= this.high || this.live[id] === 0) return;
    this.live[id] = 0;
    this.gen[id] = (this.gen[id] + 1) & GEN_MASK;
    this.freed[this.freedCount++] = id;
    this.alive--;
  }

  /** Zeroes every column of a row. For callers that want a clean slate. */
  clear(id: number): void {
    for (const key of Object.keys(this.schema)) {
      (this.col as Record<string, { [i: number]: number }>)[key][id] = 0;
    }
  }

  handle(id: number): Handle { return makeHandle(id, this.gen[id]); }

  /** Whether a handle still refers to the row it was taken from. */
  valid(h: Handle): boolean {
    if (h < 0) return false;
    const id = handleId(h);
    return id < this.high && this.live[id] === 1 && this.gen[id] === handleGen(h);
  }

  /** The row a handle refers to, or -1 if it has gone. */
  deref(h: Handle): number {
    return this.valid(h) ? handleId(h) : -1;
  }

  /**
   * Grows every column at once.
   *
   * Doubling, and never shrinking. A city that reached a hundred thousand
   * citizens once will very likely reach it again -- a plague is not a reason
   * to hand memory back and then spend the next ten minutes copying arrays as
   * it grows into it a second time.
   */
  private grow(next: number): void {
    const size = Math.max(next, this.cap + 1);
    for (const key of Object.keys(this.schema) as (keyof S)[]) {
      // eslint-disable-next-line new-cap
      const grown = new this.schema[key](size) as unknown as
        { set(a: ArrayLike<number>, o?: number): void };
      grown.set(this.col[key] as unknown as ArrayLike<number>);
      (this.col as Record<string, unknown>)[key as string] = grown;
    }
    const live = new Uint8Array(size); live.set(this.live);
    const gen = new Uint8Array(size); gen.set(this.gen);
    const freed = new Int32Array(size); freed.set(this.freed);
    (this as { live: Uint8Array }).live = live;
    (this as unknown as { gen: Uint8Array }).gen = gen;
    (this as unknown as { freed: Int32Array }).freed = freed;
    this.cap = size;
  }

  /** Bytes this table occupies, for the budget readout. */
  bytes(): number {
    let n = this.cap * 6;   // live 1 + gen 1 + freed 4, per slot
    for (const key of Object.keys(this.schema) as (keyof S)[]) {
      n += (this.col[key] as unknown as { byteLength: number }).byteLength;
    }
    return n;
  }
}
