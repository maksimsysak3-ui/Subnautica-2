/**
 * Industry specialisations: a headquarters, the area it harvests, and what
 * comes out of it.
 *
 * A player places a headquarters for one natural resource and draws the area
 * it works as a polygon on the map. Every week the area yields what is under
 * it -- the resource field's amount, less what has already been taken -- in
 * proportion to how well the headquarters is staffed, and the yield goes two
 * ways by a share the player sets:
 *
 *   shipped  sold out of the city at the full price, money now
 *   local    sold to the city's own industry at a discount, where it counts
 *            as goods made here -- fewer imports -- and lifts industrial demand
 *
 * What is taken does not all come back. Ore, oil and stone are finite: a seam
 * worked flat out lasts some tens of weeks and then the area has to move.
 * Forest and fish regrow, but against the harvest, so a hard-worked area
 * settles at a fraction of what it gave at first. Farmland is farmland.
 *
 * State lives on the World and travels in the save; the simulation calls
 * `settle` on the money beat with a way to ask how staffed each headquarters is.
 */

import { RESOURCES, RES_GRID, resourceFields } from './resources';
import type { ResourceId } from './resources';
import { waterAt } from './river';
import { RULES } from './difficulty';
import { MAP } from './maps';

export interface Hq {
  kind: ResourceId;
  /** The headquarters' lot, in city cells: what ties this record to the building. */
  gx: number; gz: number; w: number; d: number;
  /** The harvest area, as a polygon: x, z, x, z ... in metres. Empty until drawn. */
  area: number[];
  /** Share of the yield shipped out, 0 to 1. The rest supplies the city. */
  exportShare: number;
}

/** What one headquarters did last week. */
export interface HqReport {
  /** Units produced a week, at the current staffing. */
  units: number;
  shipped: number;
  local: number;
  /** Money a week from both. */
  income: number;
  staffing: number;
  /** Harvest cells in the area. */
  cells: number;
  /** Share of the area's original resource still there, 0 to 1. */
  remaining: number;
}

/** Per resource: units a fully rich, fully staffed hectare yields a week. */
const YIELD: Record<ResourceId, number> = {
  fertile: 12.7, forest: 11.2, ore: 14.1, oil: 16.9, stone: 12.7, fish: 11.2,
};
/** Money a unit fetches shipped out. */
export const PRICE: Record<ResourceId, number> = {
  fertile: 50, forest: 58, ore: 84, oil: 100, stone: 52, fish: 60,
};
/** What the city's own industry pays, as a share of the export price. */
export const LOCAL_PRICE = 0.65;
/**
 * A processing plant: what it can take a week at full staff, and what its
 * product is worth against the raw material's export price.
 */
export const PROCESS_CAP = 140;
export const PROCESS_VALUE = 2.2;

/** One processing plant, as the settle needs it. */
export interface PlantIn { kind: ResourceId; staff: number; upkeep: number }
/** And what it did last week. */
export interface PlantReport { kind: ResourceId; taken: number; capacity: number; income: number; staffing: number }
/** Finite resources: the share of a cell taken a week at full staffing. */
const DEPLETE: Partial<Record<ResourceId, number>> = { ore: 0.03, oil: 0.028, stone: 0.02 };
/**
 * Renewable resources: harvest pressure and regrowth rate a week. The stock
 * settles where the two balance, at H / (H + R) taken -- about 40% for forest
 * worked flat out, which is the price of working it that hard.
 */
const RENEW: Partial<Record<ResourceId, { harvest: number; regrow: number }>> = {
  forest: { harvest: 0.05, regrow: 0.08 },
  fish: { harvest: 0.06, regrow: 0.07 },
};

/** The largest area one headquarters may work, in hectares: half a square kilometre. */
export const MAX_HECTARES = 50;
/** How far from its headquarters an area may reach, in metres. */
export const REACH = 1200;
/** What drawing an area costs, a hectare. */
export const HECTARE_COST = 630;
/**
 * Hectares in one resource cell. The fields are a fixed number of cells across
 * whatever the map's size, so on the small map a cell is a few metres and on
 * the full one about twenty-seven: every rate here is per hectare, so an area
 * earns what its ground is worth on either.
 */
export function cellHectares(): number {
  const m = resourceFields().extent / RES_GRID;
  return (m * m) / 10000;
}

const CELL = 8;

export class Industry {
  hqs: Hq[] = [];
  /** How much of each resource has been taken, per resource cell, 0 to 1. */
  private used = new Map<ResourceId, Float32Array>();
  /** Last week's figures, one per headquarters, in the same order. */
  reports: HqReport[] = [];
  /** Money a week, all headquarters together. */
  weekly = 0;
  /** Units a week supplied to the city's own industry. */
  localUnits = 0;
  /** Upkeep a week, all headquarters together. */
  upkeep = 0;
  /** Last week's processing plants, in the order they were given. */
  plantReports: PlantReport[] = [];
  /** Money a week the plants added on top of what the raw material fetched. */
  processed = 0;
  /** Bumped on any change a rebuild or a panel should notice. */
  version = 0;

  private masks: Array<Int32Array | null> = [];
  private masksFor = '';

  // ---- queries -----------------------------------------------------------

  usedOf(kind: ResourceId): Float32Array {
    let u = this.used.get(kind);
    if (u === undefined) {
      u = new Float32Array(RES_GRID * RES_GRID);
      this.used.set(kind, u);
    }
    return u;
  }

  /** The headquarters standing on this lot, if any. */
  at(gx: number, gz: number): number {
    return this.hqs.findIndex((h) => h.gx === gx && h.gz === gz);
  }

  /** Centre of a headquarters' lot, in metres. */
  centre(h: Hq, grid: number): [number, number] {
    return [(h.gx + h.w / 2 - grid / 2) * CELL, (h.gz + h.d / 2 - grid / 2) * CELL];
  }

  /**
   * The resource cells an area covers: inside its polygon, on the right kind of
   * ground (water for fish, dry land for everything else), and not already
   * worked by an earlier headquarters.
   */
  cells(i: number): Int32Array {
    const key = `${MAP.id}:${this.version}`;
    if (this.masksFor !== key) {
      this.masks = [];
      this.masksFor = key;
    }
    const have = this.masks[i];
    if (have !== undefined && have !== null) return have;
    const taken = new Set<number>();
    for (let k = 0; k < i; k++) for (const c of this.cells(k)) taken.add(c);
    const out = this.raster(this.hqs[i].area, this.hqs[i].kind, taken);
    this.masks[i] = out;
    return out;
  }

  /** The cells a polygon would cover for a resource, for the tool's preview and checks. */
  raster(poly: readonly number[], kind: ResourceId, taken: ReadonlySet<number> = new Set()): Int32Array {
    if (poly.length < 6) return new Int32Array(0);
    const extent = resourceFields().extent;
    const cell = extent / RES_GRID;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let k = 0; k < poly.length; k += 2) {
      x0 = Math.min(x0, poly[k]); x1 = Math.max(x1, poly[k]);
      z0 = Math.min(z0, poly[k + 1]); z1 = Math.max(z1, poly[k + 1]);
    }
    const i0 = Math.max(0, Math.floor((x0 / extent + 0.5) * RES_GRID));
    const i1 = Math.min(RES_GRID - 1, Math.floor((x1 / extent + 0.5) * RES_GRID));
    const j0 = Math.max(0, Math.floor((z0 / extent + 0.5) * RES_GRID));
    const j1 = Math.min(RES_GRID - 1, Math.floor((z1 / extent + 0.5) * RES_GRID));
    const out: number[] = [];
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = -extent / 2 + (i + 0.5) * cell, z = -extent / 2 + (j + 0.5) * cell;
        if (!inside(poly, x, z)) continue;
        const k = j * RES_GRID + i;
        if (taken.has(k)) continue;
        const wet = waterAt(x, z) !== null;
        if ((kind === 'fish') !== wet) continue;
        out.push(k);
      }
    }
    return Int32Array.from(out);
  }

  // ---- edits -------------------------------------------------------------

  add(h: Hq): number {
    this.hqs.push(h);
    this.version++;
    return this.hqs.length - 1;
  }

  setArea(i: number, poly: number[]): void {
    this.hqs[i].area = poly;
    this.version++;
  }

  setExport(i: number, share: number): void {
    this.hqs[i].exportShare = Math.max(0, Math.min(1, share));
    this.version++;
  }

  remove(i: number): void {
    this.hqs.splice(i, 1);
    this.reports.splice(i, 1);
    this.version++;
  }

  /** Drops any headquarters whose building is no longer on the map. */
  prune(stands: (h: Hq) => boolean): void {
    for (let i = this.hqs.length - 1; i >= 0; i--) if (!stands(this.hqs[i])) this.remove(i);
  }

  // ---- the week ------------------------------------------------------------

  /**
   * Produces, sells and depletes for `days` of a week.
   *
   * `staffing` says how full each headquarters' jobs are, 0 to 1, and `upkeep`
   * what it costs a week to run.
   */
  settle(days: number, staffing: (h: Hq) => number, upkeep: (h: Hq) => number,
    plants: PlantIn[] = []): void {
    const share = days / 7;
    const f = resourceFields();
    let weekly = 0, local = 0, cost = 0;
    const inArea = new Map<ResourceId, Uint8Array>();
    this.reports = this.hqs.map((h, i) => {
      const cells = this.cells(i);
      const amount = f.amount[h.kind];
      const used = this.usedOf(h.kind);
      const staff = Math.max(0, Math.min(1, staffing(h)));
      let sum = 0, orig = 0;
      const mark = inArea.get(h.kind) ?? new Uint8Array(RES_GRID * RES_GRID);
      inArea.set(h.kind, mark);
      const dep = DEPLETE[h.kind], renew = RENEW[h.kind];
      for (const c of cells) {
        mark[c] = 1;
        const a = amount[c] / 255;
        orig += a;
        sum += a * (1 - used[c]);
        if (dep !== undefined) {
          used[c] = Math.min(1, used[c] + dep * staff * share);
        } else if (renew !== undefined) {
          const take = renew.harvest * staff * (1 - used[c]);
          used[c] = Math.max(0, Math.min(0.95, used[c] + (take - renew.regrow * used[c]) * share));
        }
      }
      const units = sum * cellHectares() * YIELD[h.kind] * staff;
      const shipped = units * h.exportShare;
      const sold = units - shipped;
      const income = (shipped + sold * LOCAL_PRICE) * PRICE[h.kind] * RULES.income;
      weekly += income;
      local += sold;
      cost += upkeep(h);
      return {
        units, shipped, local: sold, income, staffing: staff, cells: cells.length,
        remaining: orig > 0 ? sum / orig : 0,
      };
    });
    // Renewables recover where nobody is harvesting them.
    for (const [kind, renew] of Object.entries(RENEW) as Array<[ResourceId, { regrow: number }]>) {
      const used = this.used.get(kind);
      if (used === undefined) continue;
      const mark = inArea.get(kind);
      for (let c = 0; c < used.length; c++) {
        if (used[c] > 0 && (mark === undefined || mark[c] === 0)) {
          used[c] = Math.max(0, used[c] - renew.regrow * used[c] * share);
        }
      }
    }
    // The plants take first from what the headquarters supply the city: a
    // tonne of ore made into steel here is worth more than the same tonne
    // sold to a works, which is the whole case for building one.
    const pool = new Map<ResourceId, number>();
    this.hqs.forEach((h, i) => pool.set(h.kind, (pool.get(h.kind) ?? 0) + this.reports[i].local));
    let processed = 0;
    this.plantReports = plants.map((pl) => {
      const staff = Math.max(0, Math.min(1, pl.staff));
      const capacity = PROCESS_CAP * staff;
      const taken = Math.min(capacity, pool.get(pl.kind) ?? 0);
      pool.set(pl.kind, (pool.get(pl.kind) ?? 0) - taken);
      const income = taken * PRICE[pl.kind] * (PROCESS_VALUE - LOCAL_PRICE) * RULES.income;
      processed += income;
      local -= taken;
      cost += pl.upkeep;
      return { kind: pl.kind, taken, capacity: PROCESS_CAP, income, staffing: staff };
    });
    this.processed = processed;
    this.weekly = weekly + processed;
    this.localUnits = Math.max(0, local);
    this.upkeep = cost;
  }

  // ---- save --------------------------------------------------------------

  saved(): unknown {
    const used: Record<string, number[]> = {};
    for (const [k, v] of this.used) {
      let any = false;
      for (const x of v) if (x > 0) { any = true; break; }
      if (any) used[k] = rle(v);
    }
    return { hqs: this.hqs.map((h) => ({ ...h, area: h.area.map((n) => Math.round(n * 10) / 10) })), used };
  }

  restore(v: unknown): void {
    this.hqs = [];
    this.used.clear();
    this.reports = [];
    if (typeof v !== 'object' || v === null) return;
    const o = v as { hqs?: unknown; used?: unknown };
    if (Array.isArray(o.hqs)) {
      for (const r of o.hqs) {
        if (typeof r !== 'object' || r === null) continue;
        const h = r as Record<string, unknown>;
        const kind = RESOURCES.find((x) => x.id === h.kind)?.id;
        const num = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
        if (kind === undefined) continue;
        this.hqs.push({
          kind, gx: num(h.gx), gz: num(h.gz), w: num(h.w), d: num(h.d),
          area: Array.isArray(h.area) ? h.area.map(num) : [],
          exportShare: Math.max(0, Math.min(1, typeof h.exportShare === 'number' ? h.exportShare : 1)),
        });
      }
    }
    if (typeof o.used === 'object' && o.used !== null) {
      for (const [k, runs] of Object.entries(o.used as Record<string, unknown>)) {
        const kind = RESOURCES.find((x) => x.id === k)?.id;
        if (kind === undefined || !Array.isArray(runs)) continue;
        unrle(runs.filter((n): n is number => typeof n === 'number'), this.usedOf(kind));
      }
    }
    this.version++;
  }
}

/** Even-odd point-in-polygon, on a flat x, z list. */
export function inside(poly: readonly number[], x: number, z: number): boolean {
  let hit = false;
  const n = poly.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i * 2], zi = poly[i * 2 + 1], xj = poly[j * 2], zj = poly[j * 2 + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

/** Run-length, quantised to 64 levels: depletion is smooth and mostly zero. */
function rle(v: Float32Array): number[] {
  const out: number[] = [];
  let code = Math.round(v[0] * 63), run = 0;
  for (let i = 0; i < v.length; i++) {
    const c = Math.round(v[i] * 63);
    if (c === code) { run++; continue; }
    out.push(code, run);
    code = c; run = 1;
  }
  out.push(code, run);
  return out;
}

function unrle(runs: readonly number[], into: Float32Array): void {
  let at = 0;
  for (let i = 0; i + 1 < runs.length; i += 2) {
    const v = runs[i] / 63;
    for (let k = 0; k < runs[i + 1] && at < into.length; k++) into[at++] = v;
  }
}
