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
export { buildRoadMesh, previewRoad, ROAD_FLOATS, SURF } from './roadmesh';
export type { RoadMesh } from './roadmesh';
export {
  buildTerrain, heightAt, baseHeightAt, forgetTerrain, TERRAIN, FLOATS_PER_VERTEX,
  INDICES_PER_CHUNK,
} from './terrain';
export { terrainChunksRebuilt } from './terrain';
export { clearGrading, clearTerrainCache, warmTerrain, gradedSince, forgetGrading } from './grading';
export { clearWild } from './city';
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
