/**
 * The information views: what the city looks like from the inside.
 *
 * A city builder is only as good as what it will tell you, and every simulation in
 * here computes something a player needs to see. This turns each of those into two
 * things: a grid the renderer can tint the ground with, and a list of numbers worth
 * reading. Nothing in here decides anything -- it is the window, not the machine --
 * which is why it can afford to be generous about detail.
 *
 * HOW A GRID IS BUILT. Almost everything worth showing lives on the roads: traffic
 * load is per lane, a utility is per network and a network is a set of roads,
 * response time is measured along them. So the common shape is to scatter a
 * per-lane value into the cells each lane passes through, then spread it outward a
 * few cells so the blocks between take the colour of the street that serves them --
 * which is also the truth, because the street is what serves them. Buildings-only
 * views scatter their own footprints instead.
 *
 * The grid is coarse on purpose. Thirty-two metres a cell is finer than any
 * coverage question has an answer to, and a quarter of the memory and a sixteenth
 * of the work of doing it per zoning cell.
 *
 * ABOVE AND BELOW GROUND. Power, water and sewage are mains under the streets, and
 * they read wrong drawn as a wash over the landscape -- so those views tell the
 * renderer to darken the world and light the network up through it, which is what a
 * utility map looks like. Everything else is a heatmap over the surface.
 */

import { Places, Purpose } from './places';
import { Utilities, Util, UTIL_NAMES } from './utilities';
import { Services, SERVICE_GRID, UNREACHED } from './services';
import { People, Stage } from './people';
import { Routine } from './routine';
import { Traffic } from './driving';
import { Junctions, Control } from './junctions';
import { Migration } from './migration';
import { Dispatch, Need } from './dispatch';
import { BRANCHES } from '../../assets/types';
import type { LaneGraph } from './lanes';

/** Which view is up. */
export const View = {
  NONE: 0,
  TRAFFIC: 1,
  POWER: 2,
  WATER: 3,
  SEWAGE: 4,
  RUBBISH: 5,
  FIRE: 6,
  POLICE: 7,
  HEALTH: 8,
  EDUCATION: 9,
  PARKS: 10,
  TRANSPORT: 11,
  DESIRABILITY: 12,
} as const;
export type ViewId = typeof View[keyof typeof View];

/** How the renderer should draw a view. */
export const Look = {
  /** A wash of colour over the ground. */
  SURFACE: 0,
  /** The world darkened and the network lit through it. */
  UNDERGROUND: 1,
} as const;

export interface ViewInfo {
  id: number;
  /** Shown on the button. */
  name: string;
  /** The icon key, matched in the UI's icon set. */
  icon: string;
  look: number;
  /** One line under the title, saying what the colours mean. */
  legend: string;
  /** The ends of the scale, from bad to good, as hex for the UI swatches. */
  ramp: [string, string, string];
  /** What a reading of 255 means, for the hover readout. */
  unit: string;
}

/**
 * Every view, in the order the buttons appear.
 *
 * Traffic first because it is the one a player checks constantly, then the four
 * utilities that a city stops without, then the services in the order they start to
 * matter, then desirability, which is the composite you look at when you cannot
 * work out why nobody will move in.
 */
export const VIEWS: ViewInfo[] = [
  {
    id: View.TRAFFIC, name: 'Traffic', icon: 'traffic', look: Look.SURFACE,
    legend: 'How full each road is. Red is at a standstill.',
    ramp: ['#e0483a', '#e8c14a', '#4fbf7a'], unit: 'of capacity',
  },
  {
    id: View.POWER, name: 'Power', icon: 'power', look: Look.UNDERGROUND,
    legend: 'The grid, and whether it is keeping up. Dark is unconnected.',
    ramp: ['#7a2230', '#e8a43a', '#5ad6f0'], unit: 'of demand met',
  },
  {
    id: View.WATER, name: 'Water', icon: 'water', look: Look.UNDERGROUND,
    legend: 'Clean water mains. Pumps must stand on the river.',
    ramp: ['#6b2b3a', '#c8a850', '#4fa8e8'], unit: 'of demand met',
  },
  {
    id: View.SEWAGE, name: 'Sewage', icon: 'sewage', look: Look.UNDERGROUND,
    legend: 'What the works can treat. The rest goes in the river.',
    ramp: ['#6a3520', '#b08a3a', '#7fbf6a'], unit: 'treated',
  },
  {
    id: View.RUBBISH, name: 'Rubbish', icon: 'rubbish', look: Look.SURFACE,
    legend: 'How long the bins have been waiting.',
    ramp: ['#5f4326', '#b89a4a', '#82c07a'], unit: 'collected',
  },
  {
    id: View.FIRE, name: 'Fire', icon: 'fire', look: Look.SURFACE,
    legend: 'What the stations cover. Red is outside every catchment.',
    ramp: ['#d8402e', '#e0a040', '#58c078'], unit: 'covered',
  },
  {
    id: View.POLICE, name: 'Police', icon: 'police', look: Look.SURFACE,
    legend: 'Where a patrol reaches. Red is beyond it.',
    ramp: ['#c03a4a', '#d8a850', '#4a9ed8'], unit: 'covered',
  },
  {
    id: View.HEALTH, name: 'Health', icon: 'health', look: Look.SURFACE,
    legend: 'Clinic and hospital catchments, and how full they are.',
    ramp: ['#cc3a52', '#e0a068', '#66c8a0'], unit: 'covered',
  },
  {
    id: View.EDUCATION, name: 'Schools', icon: 'education', look: Look.SURFACE,
    legend: 'Which streets a school takes from, and whether it has room.',
    ramp: ['#a8402e', '#d8b050', '#6aa8e0'], unit: 'covered',
  },
  {
    id: View.PARKS, name: 'Parks', icon: 'parks', look: Look.SURFACE,
    legend: 'Somewhere to walk to, and how crowded it will be.',
    ramp: ['#8a5a3a', '#bfc05a', '#4fbf6a'], unit: 'covered',
  },
  {
    id: View.TRANSPORT, name: 'Transport', icon: 'transport', look: Look.SURFACE,
    legend: 'How near a stop or a station is.',
    ramp: ['#8a3a5a', '#c89a50', '#5ab0c8'], unit: 'covered',
  },
  {
    id: View.DESIRABILITY, name: 'Desirability', icon: 'desire', look: Look.SURFACE,
    legend: 'Everything at once: services, utilities, traffic, noise.',
    ramp: ['#8a3040', '#cfb050', '#5fc888'], unit: 'desirable',
  },
];

/** Cells across the overlay grid. */
export const VIEW_GRID = 192;

/** Cells the value is spread outward from a road, so blocks take its colour. */
const SPREAD = 4;

/** No reading here. The renderer leaves these untinted. */
export const NO_DATA = 0;

/** A line of the statistics panel. */
export interface Stat {
  label: string;
  value: string;
  /** 0 to 1 where a bar makes sense, or -1 for none. */
  bar: number;
  /** True where the number is bad news, so the UI can mark it. */
  warn: boolean;
}

/** What the views need to look at. Held rather than passed, since it is all of it. */
export interface Sources {
  places: Places;
  utilities: Utilities;
  services: Services;
  people: People;
  routine: Routine;
  traffic: Traffic;
  junctions: Junctions;
  migration: Migration;
  dispatch: Dispatch;
  lanes: LaneGraph;
  /** Metres across the whole map. */
  extent: number;
}

export class Views {
  /** One byte a cell: 0 is no reading, 1..255 is the value. */
  readonly grid = new Uint8Array(VIEW_GRID * VIEW_GRID);
  /** Scratch for the spreading pass. */
  private readonly next = new Uint8Array(VIEW_GRID * VIEW_GRID);
  /** Per-lane value, before it is scattered. */
  private perLane: Float32Array;
  /** Which view the grid currently holds, and when it was built. */
  built: number = View.NONE;
  builtAt = -1;

  constructor(private src: Sources) {
    this.perLane = new Float32Array(src.lanes.count);
  }

  /** The roads changed, so the per-lane scratch is the wrong size. */
  rebind(lanes: LaneGraph): void {
    this.src.lanes = lanes;
    this.perLane = new Float32Array(lanes.count);
    this.built = View.NONE;
  }

  /**
   * Fills the grid for a view. Cheap enough to call whenever it might have changed.
   *
   * Everything routes through one of two shapes -- a value per lane spread outward,
   * or a value per building spread outward -- because that is what the data actually
   * is, and having two shapes rather than thirteen is why adding a view is a table
   * entry rather than a pass.
   */
  build(view: number, tick: number): Uint8Array {
    this.grid.fill(NO_DATA);
    this.built = view;
    this.builtAt = tick;
    switch (view) {
      case View.TRAFFIC: this.fromTraffic(); break;
      case View.POWER: this.fromUtility(Util.POWER); break;
      case View.WATER: this.fromUtility(Util.WATER); break;
      case View.SEWAGE: this.fromUtility(Util.SEWAGE); break;
      case View.RUBBISH: this.fromUtility(Util.GARBAGE); break;
      case View.FIRE: this.fromBranch('fire'); break;
      case View.POLICE: this.fromBranch('police'); break;
      case View.HEALTH: this.fromBranch('health'); break;
      case View.EDUCATION: this.fromBranch('education'); break;
      case View.PARKS: this.fromBranch('parks'); break;
      case View.TRANSPORT: this.fromBranch('transport'); break;
      case View.DESIRABILITY: this.fromDesire(); break;
      default: break;
    }
    return this.grid;
  }

  // ---- the two shapes ----------------------------------------------------

  /** Stamps a value into every cell a lane passes through. */
  private scatter(): void {
    const { lanes, extent } = this.src;
    const half = extent / 2;
    const scale = VIEW_GRID / extent;
    const grid = this.grid;
    for (let l = 0; l < lanes.count; l++) {
      const v = this.perLane[l];
      if (v <= 0) continue;
      const byte = Math.max(1, Math.min(255, Math.round(v * 255)));
      const ax = lanes.ax[l], az = lanes.az[l], bx = lanes.bx[l], bz = lanes.bz[l];
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) * scale));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const gx = ((ax + (bx - ax) * t) + half) * scale | 0;
        const gz = ((az + (bz - az) * t) + half) * scale | 0;
        if (gx < 0 || gz < 0 || gx >= VIEW_GRID || gz >= VIEW_GRID) continue;
        const at = gz * VIEW_GRID + gx;
        // The worst reading wins where two roads share a cell, because a player
        // looking for trouble wants to see it rather than have it averaged away.
        if (grid[at] === NO_DATA || byte < grid[at]) grid[at] = byte;
      }
    }
  }

  /** Stamps a value at a building. */
  private stamp(x: number, z: number, value: number): void {
    const { extent } = this.src;
    const half = extent / 2;
    const scale = VIEW_GRID / extent;
    const gx = (x + half) * scale | 0;
    const gz = (z + half) * scale | 0;
    if (gx < 0 || gz < 0 || gx >= VIEW_GRID || gz >= VIEW_GRID) return;
    const at = gz * VIEW_GRID + gx;
    const byte = Math.max(1, Math.min(255, Math.round(value * 255)));
    if (this.grid[at] === NO_DATA || byte < this.grid[at]) this.grid[at] = byte;
  }

  /**
   * Spreads what has been stamped outward.
   *
   * Because a reading belongs to a street and a player is looking at the blocks
   * either side of it. Nearest-wins rather than a blur: blurring a coverage map
   * invents values between a served district and an unserved one, and the boundary
   * is exactly what the player is trying to see.
   */
  private spread(passes = SPREAD): void {
    const grid = this.grid, next = this.next;
    for (let pass = 0; pass < passes; pass++) {
      next.set(grid);
      let changed = false;
      for (let z = 0; z < VIEW_GRID; z++) {
        for (let x = 0; x < VIEW_GRID; x++) {
          const at = z * VIEW_GRID + x;
          if (grid[at] !== NO_DATA) continue;
          let v = NO_DATA;
          if (x > 0 && grid[at - 1] !== NO_DATA) v = grid[at - 1];
          if (x + 1 < VIEW_GRID && grid[at + 1] !== NO_DATA
            && (v === NO_DATA || grid[at + 1] < v)) v = grid[at + 1];
          if (z > 0 && grid[at - VIEW_GRID] !== NO_DATA
            && (v === NO_DATA || grid[at - VIEW_GRID] < v)) v = grid[at - VIEW_GRID];
          if (z + 1 < VIEW_GRID && grid[at + VIEW_GRID] !== NO_DATA
            && (v === NO_DATA || grid[at + VIEW_GRID] < v)) v = grid[at + VIEW_GRID];
          if (v !== NO_DATA) { next[at] = v; changed = true; }
        }
      }
      grid.set(next);
      if (!changed) break;
    }
  }

  // ---- the views themselves ---------------------------------------------

  private fromTraffic(): void {
    const load = this.src.routine.load;
    for (let l = 0; l < this.perLane.length; l++) {
      // Inverted, so that green is good throughout every view: a full road reads
      // low. One convention across thirteen maps is worth more than each being
      // individually intuitive.
      this.perLane[l] = Math.max(0.02, 1 - Math.min(1, load[l]));
    }
    this.scatter();
    this.spread(3);
  }

  private fromUtility(util: number): void {
    const { utilities, places, lanes } = this.src;
    // Per network, then onto the lanes of that network -- which is what a utility
    // map is: the mains, coloured by how the grid they belong to is doing.
    const nets = utilities.networks;
    const per = new Float32Array(Math.max(1, nets.length));
    const seen = new Uint8Array(Math.max(1, nets.length));
    const c = places.col;
    for (let p = 0; p < places.count; p++) {
      if (places.live[p] === 0) continue;
      const n = utilities.networkOf(p);
      if (n < 0 || n >= per.length) continue;
      const v = utilities.at(p, util);
      if (seen[n] === 0 || v < per[n]) { per[n] = v; seen[n] = 1; }
    }
    this.perLane.fill(0);
    void lanes;
    // A lane takes its colour from the buildings on it rather than from its own
    // node's network: the two agree, and the building is the thing whose supply the
    // player is actually asking about.
    for (let p = 0; p < places.count; p++) {
      if (places.live[p] === 0) continue;
      const lane = c.lane[p];
      if (lane < 0 || lane >= this.perLane.length) continue;
      const n = utilities.networkOf(p);
      const v = n >= 0 && n < per.length && seen[n] === 1
        ? per[n] : utilities.at(p, util);
      this.perLane[lane] = Math.max(0.02, v);
    }
    this.scatter();
    this.spread(3);
    // Buildings that are on no network at all: stamped as the worst reading there
    // is, because "not connected" is the answer the player is looking for.
    for (let p = 0; p < places.count; p++) {
      if (places.live[p] === 0) continue;
      if (utilities.networkOf(p) < 0) this.stamp(c.x[p], c.z[p], 0.01);
    }
  }

  /**
   * A service branch: its catchments, straight off the coverage grid.
   *
   * No scattering and no spreading, because the thing being drawn is already an
   * area -- the simulation stamped each station's catchment into a grid of its
   * own and this resamples it. Which also makes it the cheapest view in the game:
   * one read per cell, no walk over the lanes at all.
   *
   * Everywhere inside the city reads *something*, including zero, because a
   * coverage map that paints nothing where there is no station reads as "no data"
   * and sends the player looking for a bug instead of for a fire station.
   */
  private fromBranch(branch: string): void {
    const b = BRANCHES.indexOf(branch as never);
    if (b < 0) return;
    const { services, extent } = this.src;
    const reach = services.reach[b];

    // Where the city is. A coverage grid has a reading for every cell on the map,
    // including the hillside nobody has built on, and painting all of it gave a
    // scarlet rectangle with a ruler-straight edge across open country -- which
    // says nothing and looks like a rendering fault. The roads are what the city
    // is, so the roads and the ground around them are what gets painted. The
    // *value* is still the catchment: this decides where the map is drawn, not
    // what it says.
    for (let l = 0; l < this.perLane.length; l++) this.perLane[l] = 1;
    this.scatter();
    this.spread(6);

    // The two grids cover the same ground at different resolutions, so a view cell
    // maps to a coverage cell by ratio. Nearest rather than bilinear: the falloff
    // it is sampling is already smooth, and the overlay texture filters again on
    // the way to the screen.
    const ratio = SERVICE_GRID / VIEW_GRID;
    const span = services.span;
    // A loaded save can be a different size from the one the coverage grid was
    // built at, between the road change and the next refresh.
    const fit = span > 0 ? extent / span : 1;
    for (let gz = 0; gz < VIEW_GRID; gz++) {
      const sz = ((gz + 0.5) * ratio * fit) | 0;
      for (let gx = 0; gx < VIEW_GRID; gx++) {
        const at = gz * VIEW_GRID + gx;
        if (this.grid[at] === NO_DATA) continue;
        const sx = ((gx + 0.5) * ratio * fit) | 0;
        const v = (sz < 0 || sz >= SERVICE_GRID || sx < 0 || sx >= SERVICE_GRID)
          ? 0 : reach[sz * SERVICE_GRID + sx];
        // One rather than zero where nothing covers it: zero is "no reading" and
        // would leave a hole in the map exactly where the player needs to be told
        // there is no fire station.
        this.grid[at] = Math.max(1, Math.min(255, Math.round(v * 255)));
      }
    }
  }

  /**
   * Desirability: the one view that answers "why will nobody move here".
   *
   * Everything a household would notice, weighted the way the migration model
   * weights it, so the map and the demand figure cannot disagree with each other.
   */
  private fromDesire(): void {
    const { places, services, utilities, routine } = this.src;
    const c = places.col;
    for (let p = 0; p < places.count; p++) {
      if (places.live[p] === 0) continue;
      const lane = c.lane[p];
      if (lane < 0 || lane >= this.perLane.length) continue;
      let v = 0;
      v += 0.20 * utilities.at(p, Util.POWER);
      v += 0.18 * utilities.at(p, Util.WATER);
      v += 0.08 * utilities.at(p, Util.SEWAGE);
      v += 0.08 * utilities.at(p, Util.GARBAGE);
      v += 0.12 * services.byName(p, 'health');
      v += 0.10 * services.byName(p, 'education');
      v += 0.08 * services.byName(p, 'fire');
      v += 0.06 * services.byName(p, 'police');
      v += 0.06 * services.byName(p, 'parks');
      // Traffic on the doorstep is a cost, not a benefit.
      v += 0.04 * Math.max(0, 1 - Math.min(1, routine.load[lane]));
      // Stamped where the building stands rather than on the road it fronts on:
      // desirability is a property of a plot, and painting it along the kerb made
      // a quiet cul-de-sac and the dual carriageway behind it read the same.
      this.stamp(c.x[p], c.z[p], Math.max(0.02, Math.min(1, v)));
    }
    this.spread();
  }

  // ---- the numbers ------------------------------------------------------

  /** The statistics panel for a view. */
  stats(view: number): Stat[] {
    const s = this.src;
    const pct = (x: number): string => `${Math.round(x * 100)}%`;
    const line = (label: string, value: string, bar = -1, warn = false): Stat =>
      ({ label, value, bar, warn });

    switch (view) {
      case View.TRAFFIC: {
        const t = s.traffic.stats;
        const worst = s.routine.peakLoad;
        let signals = 0, giveWay = 0, roundabouts = 0;
        signals = s.junctions.byControl[Control.SIGNALS];
        giveWay = s.junctions.byControl[Control.GIVE_WAY];
        roundabouts = s.junctions.byControl[Control.ROUNDABOUT];
        return [
          line('Vehicles on the road', t.driving.toLocaleString()),
          line('Mean speed', `${(t.meanSpeed * 3.6).toFixed(0)} kph`,
            Math.min(1, t.meanSpeed / 13.9), t.meanSpeed < 4),
          line('Stopped right now', `${t.stopped.toLocaleString()}`,
            t.driving > 0 ? t.stopped / t.driving : 0, t.stopped > t.driving * 0.5),
          line('Worst wait at a junction', `${t.worstWaitSeconds.toFixed(0)} s`,
            -1, t.worstWaitSeconds > 120),
          line('Busiest road', pct(worst), Math.min(1, worst), worst > 1),
          line('Mean road load', pct(s.routine.peakMeanLoad),
            Math.min(1, s.routine.peakMeanLoad)),
          line('Trips a day', Math.round(s.routine.stats.started
            / Math.max(1, s.people.population)).toLocaleString() + ' a person'),
          line('Average journey', `${s.routine.stats.meanMinutes.toFixed(0)} min`),
          line('Signals', signals.toLocaleString()),
          line('Give way', giveWay.toLocaleString()),
          line('Roundabouts', roundabouts.toLocaleString()),
          line('Lane changes', s.traffic.stats.changes.toLocaleString()),
        ];
      }

      case View.POWER: case View.WATER: case View.SEWAGE: case View.RUBBISH: {
        const util = view === View.POWER ? Util.POWER
          : view === View.WATER ? Util.WATER
            : view === View.SEWAGE ? Util.SEWAGE : Util.GARBAGE;
        const r = s.utilities.report;
        const made = r.margin[util];
        const rows: Stat[] = [
          line('Networks', r.networks.toLocaleString(), -1, r.networks > 3),
          line('Largest network', pct(r.biggest), r.biggest, r.biggest < 0.8),
          line('Supply against demand', pct(made), Math.min(1, made), made < 1),
          line('Buildings supplied', pct(r.served[util]), r.served[util],
            r.served[util] < 0.9),
          line('Not connected to anything', pct(r.cutOff), r.cutOff, r.cutOff > 0.02),
        ];
        if (util === Util.POWER) {
          let made2 = 0, used = 0;
          for (const n of s.utilities.networks) { made2 += n.powerMade; used += n.powerUsed; }
          rows.push(line('Generating', `${(made2 / 1000).toFixed(1)} MW`));
          rows.push(line('Drawing', `${(used / 1000).toFixed(1)} MW`));
          rows.push(line('Power stations', s.utilities.plantsOf('power').toString(),
            -1, s.utilities.plantsOf('power') === 0));
        }
        if (util === Util.WATER) {
          let made2 = 0, used = 0, store = 0;
          for (const n of s.utilities.networks) {
            made2 += n.waterMade; used += n.waterUsed; store += n.storeDays;
          }
          rows.push(line('Pumping', `${Math.round(made2).toLocaleString()} m³ a day`));
          rows.push(line('Drawing', `${Math.round(used).toLocaleString()} m³ a day`));
          rows.push(line('Stored', `${store.toFixed(1)} days`, Math.min(1, store / 3)));
          rows.push(line('Waterworks', s.utilities.plantsOf('water').toString(),
            -1, s.utilities.plantsOf('water') === 0));
        }
        if (util === Util.SEWAGE) {
          let treated = 0, made2 = 0;
          for (const n of s.utilities.networks) {
            treated += n.sewageTreated; made2 += n.sewageMade;
          }
          rows.push(line('Produced', `${Math.round(made2).toLocaleString()} m³ a day`));
          rows.push(line('Treated', `${Math.round(treated).toLocaleString()} m³ a day`));
          rows.push(line('Into the river', `${Math.round(r.spilled).toLocaleString()} m³ a day`,
            -1, r.spilled > 0));
        }
        if (util === Util.GARBAGE) {
          let burnt = 0, made2 = 0;
          for (const n of s.utilities.networks) {
            burnt += n.rubbishBurnt; made2 += n.rubbishMade;
          }
          rows.push(line('Produced', `${Math.round(made2).toLocaleString()} a week`));
          rows.push(line('Dealt with', `${Math.round(burnt).toLocaleString()} a week`));
          rows.push(line('Sitting in the city', Math.round(r.piled).toLocaleString(),
            -1, r.piled > made2));
          rows.push(line('Buildings with a pile', r.smelly.toLocaleString(),
            -1, r.smelly > 0));
        }
        return rows;
      }

      default: {
        const branch = view === View.FIRE ? 'fire'
          : view === View.POLICE ? 'police'
            : view === View.HEALTH ? 'health'
              : view === View.EDUCATION ? 'education'
                : view === View.PARKS ? 'parks'
                  : view === View.TRANSPORT ? 'transport' : '';
        if (branch === '') return this.desireStats();
        const b = BRANCHES.indexOf(branch as never);
        const cov = s.services.cover[b];
        const std = s.services.standardOf(branch);
        const rows: Stat[] = [
          line('Buildings', cov.stations.toLocaleString(), -1, cov.stations === 0),
          line('Well served', pct(cov.wellServed), cov.wellServed, cov.wellServed < 0.6),
          line('Served at all', pct(cov.served), cov.served, cov.served < 0.9),
          line('Out of reach', pct(cov.unreachable), cov.unreachable,
            cov.unreachable > 0.05),
          line('Average distance', cov.meanMetres >= UNREACHED ? '--'
            : `${Math.round(cov.meanMetres)} m`, -1,
          std !== undefined && cov.meanMetres > std.worst),
          line('Capacity against need', pct(cov.capacityRatio),
            Math.min(1, cov.capacityRatio), cov.capacityRatio < 1),
          line('Busiest one is at', pct(cov.worstLoad),
            Math.min(1, cov.worstLoad), cov.worstLoad > 1),
          line('Can look after', cov.capacity.toLocaleString()),
          line('Who need it', Math.round(cov.demand).toLocaleString()),
        ];
        if (std !== undefined) {
          rows.push(line('The catchment', `${std.good} m, nothing past ${std.worst}`));
        }
        // What the service actually did, as opposed to where it could have gone.
        // A city can be fully covered and still miss half its calls, because every
        // engine was already out -- and those two failures want different fixes.
        const need = branch === 'fire' ? Need.FIRE
          : branch === 'police' ? Need.CRIME
            : branch === 'health' ? Need.MEDICAL : -1;
        if (need >= 0) {
          const d = s.dispatch.stats;
          const answered = s.dispatch.rate(need);
          rows.push(line('Calls', Math.round(d.raised[need]).toLocaleString()));
          rows.push(line('Answered in time', pct(answered), answered, answered < 0.85));
          rows.push(line('Too late', Math.round(d.missed[need]).toLocaleString(), -1,
            d.missed[need] > 0));
          rows.push(line('Average response',
            `${d.meanResponseMinutes.toFixed(1)} min`, -1,
            d.meanResponseMinutes > 12));
          rows.push(line('Out right now', `${d.vehicles} vehicles`));
          if (d.waiting > 0) {
            rows.push(line('Waiting for anybody', d.waiting.toLocaleString(), -1, true));
          }
        }
        if (branch === 'education') {
          for (let lv = 1; lv <= 3; lv++) {
            const [taken, total] = s.places.schoolPlaces(lv);
            rows.push(line(['', 'School places', 'College places', 'University places'][lv],
              `${taken.toLocaleString()} of ${total.toLocaleString()}`,
              total > 0 ? taken / total : 0, total > 0 && taken >= total));
          }
        }
        return rows;
      }
    }
  }

  private desireStats(): Stat[] {
    const s = this.src;
    const f = s.migration.flow;
    const pct = (x: number): string => `${Math.round(x * 100)}%`;
    const line = (label: string, value: string, bar = -1, warn = false): Stat =>
      ({ label, value, bar, warn });
    const children = s.people.byStage[Stage.INFANT] + s.people.byStage[Stage.CHILD]
      + s.people.byStage[Stage.TEEN];
    return [
      line('Appeal to newcomers', pct(f.appeal), f.appeal, f.appeal < 0.5),
      line('Because of work', pct(f.work), f.work, f.work < 0.3),
      line('Because of services', pct(f.services), f.services, f.services < 0.5),
      line('Word of mouth', pct(f.word), f.word, f.word < 0.5),
      line('Households waiting', f.queue.toLocaleString(), -1, f.queue > 200),
      line('Moving in', `${f.arrivalsPerDay.toFixed(1)} a day`),
      line('Moving out', `${f.departuresPerDay.toFixed(1)} a day`, -1,
        f.departuresPerDay > f.arrivalsPerDay),
      line('Gave up waiting', f.gaveUp.toLocaleString(), -1, f.gaveUp > 0),
      line('Population', s.people.population.toLocaleString()),
      line('Children', children.toLocaleString()),
      line('Unemployment', pct(s.people.unemployment), s.people.unemployment,
        s.people.unemployment > 0.15),
      line('Happiness', pct(s.people.happiness), s.people.happiness,
        s.people.happiness < 0.5),
      line('Homes spare', s.places.spareHomes.toLocaleString(), -1,
        s.places.spareHomes === 0),
      line('Jobs spare', s.places.spareJobs.toLocaleString()),
    ];
  }

  bytes(): number {
    return this.grid.byteLength + this.next.byteLength + this.perLane.byteLength;
  }
}

export { Purpose, UTIL_NAMES, Util };
