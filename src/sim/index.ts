/**
 * Public surface of the simulation module.
 *
 * Everything the renderer and the tests need, in one place. The rule from
 * planning/CITY-SIM-DESIGN.md is that sim/ never imports from gfx/ -- the
 * simulation must be able to run with the renderer deleted.
 */

export { makeCity, INSTANCE_FLOATS } from './city';
export type { City } from './city';
export { PROTO_COUNT } from './inventory';
export { defaultWorld, startingWorld, emptyWorld, paint, demolish, zoneCode, zoneOf, lotFits, placeLot, ZONES, DENSITIES, BLOCK, STREET, PERIOD } from './world';
export { services, planting, signatures, signatureById, ASSET_INDEX } from './inventory';
export type { Proto } from './inventory';
export type { World } from './world';
export { RoadGraph, ROAD_SPECS, ROAD_ORDER } from './roadgraph';
export type { RoadClass, RoadSpec, Site } from './roadgraph';
export { buildRoadMesh, previewRoad, clearRoadMesh, ROAD_FLOATS, ROAD_FLAGS, SURF } from './roadmesh';
export type { RoadMesh } from './roadmesh';
export {
  buildTerrain, heightAt, baseHeightAt, forgetTerrain, TERRAIN, FLOATS_PER_VERTEX,
  INDICES_PER_CHUNK,
} from './terrain';
export { terrainChunksRebuilt, TERRAIN_LOD_SPANS, TERRAIN_LOD_METRES } from './terrain';
export { clearGrading, clearTerrainCache, warmTerrain, gradedSince, forgetGrading } from './grading';
export { clearWild, clearStanding } from './city';
export type { Dirty } from './city';
export type { Bounds } from './grading';
export { waterAt, valleyAt, buildWaterMesh, WATER_FLOATS } from './river';
export type { Chunk, TerrainMesh } from './terrain';
export { hash2, noise2, fbm } from './hash';
export { simConfig, configureSim, LITE } from './config';
export type { SimConfig } from './config';
export { buildingPrice, roadPrice, zonePrice, money } from './costs';
export {
  Land, PLOTS, STARTING, startingLand, plotAt, plotAtWorld, plotBounds, plotCells,
  plotSpan, ownsCells, ownsAt,
} from './plots';
export { Weather } from './weather';
export type { Sky } from './weather';
export {
  serialise, deserialise, listSaves, writeSave, writeAutosave, readSave, deleteSave,
  toCode, fromCode,
} from './save';
export type { SaveInfo } from './save';

// ---- the simulation ------------------------------------------------------
//
// The living city: who is in it, what they do all day, and how they get there.
// One object owns the lot and schedules it; everything under `agents/` is
// reachable through it, and the pieces are exported too for the readouts.
export { Simulation } from './agents/sim';
export type { SimReport } from './agents/sim';
export { Clock, SECONDS_PER_DAY, TICKS_PER_DAY, YEARS_PER_DAY, SEASON_NAMES } from './agents/calendar';
export { Scheduler, Rate, TICK_HZ, due, slice } from './agents/tick';
export type { System } from './agents/tick';
export { Table, NO_HANDLE } from './agents/store';
export { Rng } from './agents/rand';
export { buildLaneGraph, buildLaneIndex, nearestLane, Use, Turn, laneBytes } from './agents/lanes';
export type { LaneGraph, LaneIndex } from './agents/lanes';
export { Pathfinder, Layer, Outcome, NO_PATH, profileOf } from './agents/path';
export { Router, PathStore, MAX_PATH } from './agents/router';
export type { Sink } from './agents/router';
export { Places, Purpose, Teaches, Pool, buildPlaces, reconcilePlaces } from './agents/places';
export {
  People, Stage, Edu, Doing, Wealth, STAGE_NAMES, EDU_NAMES, DOING_NAMES, stageOf,
} from './agents/people';
export { Migration } from './agents/migration';
export type { Flow } from './agents/migration';
export { Routine, Mode, MODE_NAMES, MOVING_BUDGET, belongs } from './agents/routine';
export type { TripStats } from './agents/routine';
export { Junctions, Control, Light, CONTROL_NAMES, crosses } from './agents/junctions';
export {
  Traffic, Driver, Kind, DRIVER_NAMES, KIND_NAMES, VEHICLE_LENGTH,
} from './agents/driving';
export type { TrafficStats } from './agents/driving';
