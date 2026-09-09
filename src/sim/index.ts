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
export { buildTerrain, heightAt, baseHeightAt, TERRAIN, FLOATS_PER_VERTEX, INDICES_PER_CHUNK } from './terrain';
export { clearGrading } from './grading';
export type { Chunk, TerrainMesh } from './terrain';
export { hash2, noise2, fbm } from './hash';
export { simConfig, configureSim, LITE } from './config';
export type { SimConfig } from './config';
