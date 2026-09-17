/**
 * The things that move: what the traffic and the citizens are drawn as.
 *
 * The library already holds vehicles and figures, and every one of them stands
 * on a slab of tarmac with a bystander beside it -- they were built to be
 * *reviewed*, a showroom pad per model, and a showroom pad driving down a
 * street would take the street with it. These are the same models with nothing
 * around them: origin-centred, facing +x, sitting on y = 0, so a position and a
 * heading out of the simulation is all it takes to put one on a road.
 *
 * Every mover is a prototype like any other, so it is culled, given a level of
 * detail and drawn by the same machinery a tower block goes through. What is
 * different is that its instances are rewritten every frame rather than at
 * load, which is why the census reserves room for them -- see `MOVER_RESERVE`.
 */

import { MAT, MeshBuilder } from '../mesh';
import { IMPORTED_IDS, drawImported, drawImpostor, importedSize } from '../imported';
import { person } from './vehicles';
import type { AssetDef } from '../types';

/** A mover costs the city nothing: it is what the city's costs look like. */
const free: AssetDef['sim'] = {
  jobs: 0, households: 0, powerKW: 0, waterM3: 0, garbagePerWeek: 0,
  pollution: 0, upkeep: 0,
};

/** Where a class of imported model is picked from, by the pack's own naming. */
function idsOfClass(cls: string): string[] {
  return IMPORTED_IDS.filter((id) => id.startsWith('car.')
    && id.replace(/^car\./, '').replace(/[0-9].*$/, '') === cls);
}

/** Models the pack ships at a density no moving vehicle needs. */
const HEAVY = new Set(['car.fire1', 'car.garbage1', 'car.citybus1', 'car.servicetruck1']);

/**
 * The box a heavy model is drawn as far away, sized to the mesh it replaces.
 *
 * The pack's own impostor is built from the full model's bounds, and a heavy
 * model here is drawn from its *low* copy -- which the pack made a little
 * shorter. Mixing the two puts a lorry through a growth spurt as it crosses the
 * level-of-detail boundary, and leaves the library's own audit unable to say
 * how tall the asset is. So the box is measured from what is actually drawn.
 */
function lowBox(m: MeshBuilder, id: string): void {
  let box = LOW_BOUNDS.get(id);
  if (box === undefined) {
    const probe = new MeshBuilder();
    drawImported(probe, id, { low: true });
    const b = probe.bounds();
    box = [b.min[0], b.min[1], b.min[2], b.max[0], b.max[1], b.max[2]];
    LOW_BOUNDS.set(id, box);
  }
  m.box([box[0], Math.max(0, box[1]), box[2]], [box[3], box[4], box[5]], MAT.PAINT);
}
const LOW_BOUNDS = new Map<string, number[]>();

/** A body with nothing around it, at three levels of detail. */
function bare(id: string, heavy = false): (lod: number) => MeshBuilder {
  return (lod: number): MeshBuilder => {
    const m = new MeshBuilder();
    // A fire engine is seventeen thousand triangles in the pack -- more than a
    // tower block -- and there can be thirty of them moving at once. The heavy
    // models start one rung down the ladder, which is free: nothing in the city
    // is ever close enough to a passing appliance to tell.
    if (lod >= 2) { if (heavy) lowBox(m, id); else drawImpostor(m, id); }
    else drawImported(m, id, { low: heavy || lod >= 1 });
    return m;
  };
}

function moverOf(id: string, name: string, seat: string): AssetDef | null {
  const size = importedSize(id);
  if (size === undefined) return null;
  const [hx, hy, hz] = size;
  return {
    id: `move.${seat}`,
    name,
    zone: 'fleet',
    density: 'none',
    variant: 'sculpted',
    // A mover claims no land: the footprint is what the culler sizes its
    // bounding box from and nothing else ever asks.
    footprint: [Math.max(1, Math.ceil((hx * 2) / 8)), Math.max(1, Math.ceil((hz * 2) / 8))],
    // Replaced below by what the mesh actually measures.
    height: hy,
    sim: free,
    note: `On the road: ${(hx * 2).toFixed(1)} m, drawn wherever the traffic model puts it.`,
    build: bare(id, HEAVY.has(id)),
  };
}

/** One person, walking, at the origin. */
function walker(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  if (lod >= 2) {
    // Two boxes at forty metres: a head-coloured cap on a body-coloured post is
    // what a person is from that far away, and it is eight triangles.
    m.box([-0.17, 0, -0.13], [0.17, 1.42, 0.13], MAT.HOUSING);
    m.box([-0.12, 1.42, -0.11], [0.12, 1.74, 0.11], MAT.SKIN);
    return m;
  }
  // Facing +x, so the instance's heading is the direction of travel with no
  // correction anywhere: `person` builds looking down +z, so it is turned a
  // quarter turn here rather than in the frame loop.
  person(m, 91, 0, 0, Math.PI * 0.5, { stride: 0.34, scale: 1.0, bag: false });
  return m;
}

/** One rider on a bicycle, at the origin, facing +x. */
function rider(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  if (lod >= 2) {
    m.box([-0.6, 0.2, -0.12], [0.6, 0.55, 0.12], MAT.METAL);
    m.box([-0.16, 0.55, -0.15], [0.18, 1.62, 0.15], MAT.HOUSING);
    return m;
  }
  m.painted(0, () => {
    for (const dx of [-0.55, 0.55]) {
      m.cylinder(dx, 0, 0.33, 0.30, 0.38, lod >= 1 ? 8 : 12, MAT.TYRE);
    }
    m.pipe([-0.5, 0.34, 0], [0.1, 0.9, 0], 0.035, MAT.TRIM, 5);
    m.pipe([0.1, 0.9, 0], [0.55, 0.36, 0], 0.035, MAT.TRIM, 5);
    m.pipe([-0.5, 0.34, 0], [-0.12, 0.95, 0], 0.035, MAT.TRIM, 5);
    m.box([0.42, 0.95, -0.22], [0.5, 1.0, 0.22], MAT.TRIM);
  });
  person(m, 57, -0.12, 0, Math.PI * 0.5, { stride: 0.2, scale: 0.96, lift: 0.46 });
  return m;
}

/**
 * The movers, in a fixed order the simulation indexes by seat.
 *
 * The seats are what the traffic model already distinguishes -- a car, a van, a
 * lorry, a bus, an emergency vehicle -- plus the two ways a person travels
 * under their own power.
 */
const SEATS: Array<[string, string, string]> = [
  ['saloon', 'Car', 'car'],
  ['hatchback', 'Hatchback', 'car2'],
  ['estate', 'Estate', 'car3'],
  ['sports', 'Coupe', 'car4'],
  ['servicetruck', 'Lorry', 'lorry'],
  ['citybus', 'Bus', 'bus'],
  ['taxi', 'Taxi', 'taxi'],
  ['police', 'Police car', 'police'],
  ['ambulance', 'Ambulance', 'ambulance'],
  ['fire', 'Fire engine', 'fire'],
  ['garbage', 'Refuse lorry', 'refuse'],
];

const built: AssetDef[] = [];
{
  const used = new Set<string>();
  for (const [cls, name, seat] of SEATS) {
    const pool = idsOfClass(cls);
    // A second livery of the same class takes the next model along, so a street
    // is not one car repeated; a class with only one model reuses it rather
    // than dropping the seat, because the seat is what the simulation indexes.
    const id = pool.find((p) => !used.has(p)) ?? pool[0];
    if (id === undefined) continue;
    used.add(id);
    const def = moverOf(id, name, seat);
    if (def !== null) built.push(def);
  }
}

built.push({
  id: 'move.walker', name: 'Pedestrian', zone: 'fleet', density: 'none',
  variant: 'sculpted', footprint: [1, 1], height: 1.8,
  sim: free,
  note: 'One person, walking. Drawn wherever a citizen on foot actually is.',
  build: walker,
});
built.push({
  id: 'move.cyclist', name: 'Cyclist', zone: 'fleet', density: 'none',
  variant: 'sculpted', footprint: [1, 1], height: 1.7,
  sim: free,
  note: 'One rider. Drawn wherever a citizen on a bicycle actually is.',
  build: rider,
});

export const MOVERS: AssetDef[] = built;

/**
 * Which prototype each kind of mover is drawn as, by id.
 *
 * The simulation speaks in its own terms -- a vehicle kind, a travel mode -- and
 * this is the one table that turns those into prototypes. Everything else on
 * both sides stays ignorant of the other.
 */
export const MOVER_IDS = {
  car: 'move.car',
  car2: 'move.car2',
  car3: 'move.car3',
  car4: 'move.car4',
  lorry: 'move.lorry',
  bus: 'move.bus',
  taxi: 'move.taxi',
  police: 'move.police',
  ambulance: 'move.ambulance',
  fire: 'move.fire',
  refuse: 'move.refuse',
  walker: 'move.walker',
  cyclist: 'move.cyclist',
} as const;

/**
 * How many of each the census reserves.
 *
 * The visibility slices are sized from the census at load, so a mover that was
 * never counted has nowhere to be listed and would be silently dropped by the
 * culler. These are ceilings rather than expectations: the frame writes as many
 * as the simulation has and no more.
 */
export const MOVER_RESERVE: Record<string, number> = {
  'move.car': 420,
  'move.car2': 300,
  'move.car3': 260,
  'move.car4': 200,
  'move.lorry': 140,
  'move.bus': 80,
  'move.taxi': 90,
  'move.police': 40,
  'move.ambulance': 40,
  'move.fire': 30,
  'move.refuse': 50,
  'move.walker': 1600,
  'move.cyclist': 300,
};

/** Every instance the frame may write, which is what the buffer is sized for. */
export const MOVER_BUDGET = Object.values(MOVER_RESERVE).reduce((a, b) => a + b, 0);
