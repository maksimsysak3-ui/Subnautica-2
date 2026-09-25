/**
 * Districts: named parts of the city, painted by the player, each with its own
 * policies.
 *
 * A city-wide ordinance is a blunt instrument -- raise the office rate and the
 * old town pays it too. A district lets the player say "this quarter is for
 * tourists" and mean only this quarter: the shops in it pay more, and the city
 * pays a little per building for the signage, the street cleaning and the
 * promotion that makes it so. Every policy is a trade, stated in money.
 *
 * Stored as a cell per district id on the city grid, so the lookup from a
 * building's position is one array read -- the economy asks it for every
 * building, every settle.
 */

export interface DistrictPolicy {
  id: string;
  name: string;
  blurb: string;
  /** Tax yield multipliers by zone, on buildings inside the district. */
  yield: { residential?: number; commercial?: number; industrial?: number; office?: number };
  /** What it costs a week, per building in the district that it applies to. */
  perBuilding: number;
}

export const DISTRICT_POLICIES: DistrictPolicy[] = [
  {
    id: 'tourism', name: 'Tourist quarter', perBuilding: 14,
    blurb: 'Signage, street cleaning and promotion. Shops here take a quarter more; the city pays for the upkeep of the look.',
    yield: { commercial: 1.25 },
  },
  {
    id: 'tech', name: 'Tech cluster', perBuilding: 20,
    blurb: 'Fibre in every street and a start-up fund. Offices here earn three tenths more.',
    yield: { office: 1.3 },
  },
  {
    id: 'industrial', name: 'Industrial park', perBuilding: 14,
    blurb: 'Shared yards, a freight road and a skills centre. Works here pay a fifth more tax.',
    yield: { industrial: 1.2 },
  },
  {
    id: 'garden', name: 'Garden suburb', perBuilding: 5,
    blurb: 'Street trees, front-garden rules and a green belt. Better-off households: residents here pay 15% more.',
    yield: { residential: 1.15 },
  },
  {
    id: 'enterprise', name: 'Enterprise zone', perBuilding: 0,
    blurb: 'Business rates cut by a quarter to bring firms in. Shops, offices and works here pay 25% less -- a tax cut you aim.',
    yield: { commercial: 0.75, office: 0.75, industrial: 0.75 },
  },
];

export const POLICY_BY_ID = new Map(DISTRICT_POLICIES.map((p) => [p.id, p]));

export interface District {
  id: number;
  name: string;
  /** Index into DISTRICT_COLOURS. */
  colour: number;
  policies: string[];
}

/** Distinct, mid-lightness hues that read on the map in daylight and at night. */
export const DISTRICT_COLOURS = [
  '#e0a24a', '#5fb4e0', '#b07ce0', '#5fc78c', '#e06a7a', '#d8d05a',
  '#4fc4bc', '#e08a4f', '#8a9ce8', '#c4e05a', '#e05ab4', '#7ad0a0',
];

const FIRST = ['Old', 'North', 'South', 'East', 'West', 'Upper', 'Lower', 'Market', 'Mill', 'Harbour',
  'Castle', 'Church', 'Bridge', 'Station', 'Kings', 'Queens', 'Abbey', 'Park', 'Canal', 'Chapel'];
const SECOND = ['Town', 'End', 'Gate', 'Green', 'Quarter', 'Side', 'Fields', 'Heath', 'Hill', 'Row',
  'Vale', 'Cross', 'Wharf', 'Common', 'Moor', 'Park', 'Rise', 'Yard'];

export class Districts {
  /** District id per city cell, 0 for none. */
  cells: Uint8Array;
  list: District[] = [];
  /** Bumped on every paint and every policy change. */
  version = 0;
  private nextId = 1;

  constructor(readonly grid: number) {
    this.cells = new Uint8Array(grid * grid);
  }

  /** A new district with a name and a colour, painted nowhere yet. */
  add(): District | null {
    if (this.list.length >= 250) return null;
    const id = this.nextId++;
    const taken = new Set(this.list.map((d) => d.name));
    let name = '';
    for (let k = 0; k < 40 && (name === '' || taken.has(name)); k++) {
      const h = Math.imul(id * 2654435761 + k * 97, 0x9e3779b1) >>> 0;
      name = `${FIRST[h % FIRST.length]} ${SECOND[(h >>> 8) % SECOND.length]}`;
    }
    const d: District = { id, name, colour: (id - 1) % DISTRICT_COLOURS.length, policies: [] };
    this.list.push(d);
    this.version++;
    return d;
  }

  byId(id: number): District | undefined { return this.list.find((d) => d.id === id); }

  /** Paints a rectangle of cells with `id`, or clears it with 0. */
  paint(gx: number, gz: number, w: number, d: number, id: number): number {
    let n = 0;
    for (let z = Math.max(0, gz); z < Math.min(this.grid, gz + d); z++) {
      for (let x = Math.max(0, gx); x < Math.min(this.grid, gx + w); x++) {
        const i = z * this.grid + x;
        if (this.cells[i] !== id) { this.cells[i] = id; n++; }
      }
    }
    if (n > 0) {
      this.version++;
      this.prune();
    }
    return n;
  }

  /** The district a point in metres stands in, 0 for none. */
  at(x: number, z: number): number {
    const half = this.grid / 2;
    const gx = Math.floor(x / 8 + half), gz = Math.floor(z / 8 + half);
    if (gx < 0 || gz < 0 || gx >= this.grid || gz >= this.grid) return 0;
    return this.cells[gz * this.grid + gx];
  }

  toggle(id: number, policy: string): void {
    const d = this.byId(id);
    if (d === undefined || !POLICY_BY_ID.has(policy)) return;
    const i = d.policies.indexOf(policy);
    if (i >= 0) d.policies.splice(i, 1); else d.policies.push(policy);
    this.version++;
  }

  rename(id: number, name: string): void {
    const d = this.byId(id);
    if (d === undefined) return;
    d.name = name.trim().slice(0, 32) || d.name;
    this.version++;
  }

  remove(id: number): void {
    this.list = this.list.filter((d) => d.id !== id);
    for (let i = 0; i < this.cells.length; i++) if (this.cells[i] === id) this.cells[i] = 0;
    this.version++;
  }

  /** Cells painted per district. */
  sizes(): Map<number, number> {
    const out = new Map<number, number>();
    for (let i = 0; i < this.cells.length; i++) {
      const id = this.cells[i];
      if (id !== 0) out.set(id, (out.get(id) ?? 0) + 1);
    }
    return out;
  }

  /** Drops districts with no cells left, so the list is what is on the map. */
  private prune(): void {
    const sizes = this.sizes();
    this.list = this.list.filter((d) => (sizes.get(d.id) ?? 0) > 0);
  }

  saved(): object {
    // Run-length pairs: a district map is large regions of one value.
    const rle: number[] = [];
    let run = 0, v = this.cells[0] ?? 0;
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] === v) { run++; continue; }
      rle.push(v, run); v = this.cells[i]; run = 1;
    }
    rle.push(v, run);
    return { list: this.list, next: this.nextId, rle };
  }

  restore(raw: unknown): void {
    this.cells.fill(0);
    this.list = [];
    this.nextId = 1;
    const r = raw as { list?: unknown; next?: unknown; rle?: unknown } | null;
    if (r === null || typeof r !== 'object') return;
    if (Array.isArray(r.list)) {
      for (const d of r.list as Array<Partial<District>>) {
        if (typeof d?.id !== 'number' || d.id <= 0 || d.id > 255) continue;
        this.list.push({
          id: d.id, name: String(d.name ?? 'District').slice(0, 32),
          colour: Number(d.colour) || 0,
          policies: Array.isArray(d.policies) ? d.policies.filter((p) => POLICY_BY_ID.has(p)) : [],
        });
      }
    }
    this.nextId = Math.max(Number(r.next) || 1, ...this.list.map((d) => d.id + 1), 1);
    if (Array.isArray(r.rle)) {
      let at = 0;
      for (let k = 0; k + 1 < r.rle.length && at < this.cells.length; k += 2) {
        const v = Number(r.rle[k]) || 0, n = Number(r.rle[k + 1]) || 0;
        this.cells.fill(v, at, Math.min(this.cells.length, at + n));
        at += n;
      }
    }
    this.version++;
  }
}
