/**
 * What the city is being asked to do next.
 *
 * Levels come from playing at all -- every building placed and every citizen
 * who arrives pays into them -- so on their own they reward *time*. Goals are
 * the other half: they reward doing a specific thing well, they are worth a
 * great deal of experience each, and they are the only part of the game that
 * ever tells a player what to aim at.
 *
 * Each one is a reading off the simulation rather than a counter kept beside
 * it, so a goal cannot drift out of step with the city, and a save loaded from
 * before goals existed simply finds the ones it has already met.
 */

import type { Simulation } from './agents/sim';
import type { World } from './world';
import { Util } from './agents/utilities';
import { assetById } from '../assets/registry';

export interface Goal {
  id: string;
  title: string;
  /** What to do, in a line. */
  note: string;
  xp: number;
  /** Where the city is, and what it needs, for the bar. */
  progress(sim: Simulation, world: World): [number, number];
}

const share = (n: number): number => Math.max(0, Math.min(1, n));

export const GOALS: Goal[] = [
  {
    id: 'people.100', title: 'A hundred residents',
    note: 'Zone housing near a road and let people move in.',
    xp: 400,
    progress: (sim) => [sim.people.population, 100],
  },
  {
    id: 'people.1000', title: 'A thousand residents',
    note: 'Keep housing ahead of the queue and services ahead of the housing.',
    xp: 1400,
    progress: (sim) => [sim.people.population, 1000],
  },
  {
    id: 'people.5000', title: 'Five thousand residents',
    note: 'A real town. It will need water and drainage that can keep up.',
    xp: 4000,
    progress: (sim) => [sim.people.population, 5000],
  },
  {
    id: 'jobs.500', title: 'Five hundred jobs filled',
    note: 'Zone commerce, industry and offices, and connect them to the housing.',
    xp: 900,
    progress: (sim) => {
      let filled = 0;
      for (const n of sim.places.staffed) filled += n;
      return [filled, 500];
    },
  },
  {
    id: 'money.week', title: 'Ten thousand a week in the black',
    note: 'Raise a rate, or cut a service nobody is using.',
    xp: 1200,
    // Earned, not granted: the founding grant alone put an empty city ten
    // thousand in the black on its first day, and the goal paid out a level
    // before anybody lived there.
    progress: (sim) => [Math.max(0, sim.economy.report.net - sim.economy.report.grant), 10000],
  },
  {
    id: 'power.all', title: 'Everybody has power',
    note: 'Generation ahead of demand, and a main down every street.',
    xp: 800,
    progress: (sim) => [Math.round(share(sim.utilities.report.served[Util.POWER]) * 100), 100],
  },
  {
    id: 'water.all', title: 'Everybody has water',
    note: 'A pump on the river, and pipes that reach the far side of town.',
    xp: 800,
    progress: (sim) => [Math.round(share(sim.utilities.report.served[Util.WATER]) * 100), 100],
  },
  {
    id: 'transit.riders', title: 'Two hundred riders a week',
    note: 'Draw a bus line between the housing and the work.',
    xp: 1100,
    progress: (sim) => [Math.round(sim.transit.report.ridersPerDay * 7), 200],
  },
  {
    id: 'landmark.one', title: 'Build a landmark',
    note: 'Level up to be handed one, then put it somewhere it can be seen.',
    xp: 1000,
    progress: (_sim, world) => {
      // A landmark is a lot whose asset is one: the lot itself carries only an
      // id, and the id is what the library knows.
      let built = 0;
      for (const lot of world.lots) {
        { const d = assetById(lot.id); if (d?.signature === true && d.mod === undefined) built++; }
      }
      return [built, 1];
    },
  },
  {
    id: 'traffic.flow', title: 'Keep the traffic moving',
    note: 'Mean speed over thirty with five hundred vehicles on the road.',
    xp: 1600,
    progress: (sim) => {
      const t = sim.traffic.stats;
      const ok = t.driving >= 500 && t.meanSpeed * 3.6 >= 30;
      return [ok ? 1 : 0, 1];
    },
  },
];

export const GOAL_BY_ID = new Map(GOALS.map((g) => [g.id, g]));
