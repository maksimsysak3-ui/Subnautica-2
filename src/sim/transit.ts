/**
 * Public transport, as state the player edits.
 *
 * A line is a loop of stops. That is the whole of what the player owns: where
 * the stops are, in what order, what runs between them and how many of them
 * there are. Everything else -- the route the vehicles take between two stops,
 * how long the loop takes, how often one comes, who rides it and how full it is
 * -- is worked out from the roads and the city, every time either changes, by
 * `agents/transit.ts`. The same split the roads and the zoning are on, and for
 * the same reason: what is derived must not be saved, and what a player made
 * must not be re-decided.
 *
 * THREE KINDS. Buses and trams run in the street, which is what makes them
 * buildable with the tool the player already has: click along a road, and the
 * vehicles find their own way between the stops. A metro does not: its
 * stations go anywhere and its trains run in straight tunnels between them,
 * never on the roads -- so it is priced from tunnel lengths rather than
 * routed, and draws no vehicles in the street. See `TransitSpec.tunnel`.
 *
 * A LOOP, NOT A LINE WITH TWO ENDS. Real bus routes mostly are loops or
 * out-and-back pairs, and a loop needs no turning circle, no layover logic and
 * no second direction: the vehicles go round. Out-and-back falls out of it for
 * free -- a player who puts the stops down one street and back up it has drawn
 * exactly that.
 */

/** The kinds, in the order they appear in the tool. */
export const TransitKind = { BUS: 0, TRAM: 1, METRO: 2 } as const;
export const TRANSIT_KINDS = ['bus', 'tram', 'metro'] as const;

export interface TransitSpec {
  name: string;
  /** Identity colour, for the line on the map and the chip in the panel. */
  colour: string;
  /** Riders one vehicle carries. */
  capacity: number;
  /** Seconds a vehicle stands at a stop. */
  dwell: number;
  /** Metres a rider will walk to reach a stop at either end. */
  walk: number;
  /** What one vehicle costs to run a week, for the budget readout. */
  weekly: number;
  /**
   * Underground: runs in its own tunnels between stations, straight, at this
   * many metres a second, and never on the roads. Absent for street transit.
   */
  tunnel?: number;
  /** The city level it opens at, where it is gated beyond its branch. */
  level?: number;
}

/**
 * What each kind is.
 *
 * A bus is cheap, flexible and small; a tram carries three times as much, costs
 * three times as much to run, and is worth walking further for -- which is the
 * real trade and the reason cities build both.
 */
export const TRANSIT_SPEC: TransitSpec[] = [
  { name: 'Bus', colour: '#4fa8e8', capacity: 60, dwell: 18, walk: 400, weekly: 2400 },
  { name: 'Tram', colour: '#e8a13f', capacity: 180, dwell: 26, walk: 620, weekly: 7200 },
  // A metro: stations anywhere, joined by straight tunnels, trains of four
  // hundred people at twenty metres a second whatever the traffic above. The
  // most expensive thing a city runs and the only transit that beats a jam.
  { name: 'Metro', colour: '#b36ae2', capacity: 480, dwell: 30, walk: 750, weekly: 7000, tunnel: 20, level: 8 },
];

/** The fewest and most vehicles a player may put on one line. */
export const MIN_FLEET = 1;
export const MAX_FLEET = 24;

/** Stops a line may have. Two is a shuttle; beyond this is a tool problem. */
export const MAX_STOPS = 48;

export interface TransitLine {
  /** Stable across edits and saves, so a vehicle knows which line it is on. */
  id: number;
  kind: number;
  /** Stop positions in metres, x and z interleaved. At least two. */
  stops: number[];
  /** How many vehicles the player runs on it. */
  fleet: number;
}

export class Transit {
  readonly lines: TransitLine[] = [];
  /** Bumped on every edit, so the running side knows to work it out again. */
  version = 0;
  private nextId = 1;

  /** Adds a line. Returns it, or null if it is not a line. */
  add(kind: number, stops: readonly number[], fleet = 4): TransitLine | null {
    if (stops.length < 4 || stops.length % 2 !== 0) return null;
    if (kind < 0 || kind >= TRANSIT_SPEC.length) return null;
    const line: TransitLine = {
      id: this.nextId++,
      kind,
      stops: stops.slice(0, MAX_STOPS * 2),
      fleet: Math.max(MIN_FLEET, Math.min(MAX_FLEET, Math.round(fleet))),
    };
    this.lines.push(line);
    this.version++;
    return line;
  }

  remove(id: number): boolean {
    const i = this.lines.findIndex((l) => l.id === id);
    if (i < 0) return false;
    this.lines.splice(i, 1);
    this.version++;
    return true;
  }

  setFleet(id: number, fleet: number): void {
    const line = this.lines.find((l) => l.id === id);
    if (line === undefined) return;
    const want = Math.max(MIN_FLEET, Math.min(MAX_FLEET, Math.round(fleet)));
    if (want === line.fleet) return;
    line.fleet = want;
    this.version++;
  }

  /** The line whose nearest stop is closest to a point, for a click. */
  nearest(x: number, z: number, within = 60): { line: TransitLine; stop: number } | null {
    let best: { line: TransitLine; stop: number } | null = null;
    let bestD = within * within;
    for (const line of this.lines) {
      for (let i = 0; i < line.stops.length; i += 2) {
        const dx = line.stops[i] - x, dz = line.stops[i + 1] - z;
        const d = dx * dx + dz * dz;
        if (d < bestD) { bestD = d; best = { line, stop: i / 2 }; }
      }
    }
    return best;
  }

  /** Restores from a save, keeping the ids so nothing else has to be remapped. */
  restore(lines: readonly TransitLine[]): void {
    this.lines.length = 0;
    this.nextId = 1;
    for (const l of lines) {
      if (l.stops.length < 4) continue;
      this.lines.push({
        id: l.id, kind: l.kind, stops: l.stops.slice(), fleet: l.fleet,
      });
      this.nextId = Math.max(this.nextId, l.id + 1);
    }
    this.version++;
  }

  bytes(): number {
    let n = 0;
    for (const l of this.lines) n += 48 + l.stops.length * 8;
    return n;
  }
}
