/**
 * GPU capability inspection.
 *
 * Two jobs:
 *  1. Work out which limits to *request* at device creation. WebGPU gives you
 *     conservative defaults unless you ask for more, and asking for more than
 *     the adapter has is a hard failure -- so we ask for exactly
 *     min(what we want, what exists).
 *  2. Check the adapter against the budgets in planning/CITY-SIM-DESIGN.md and
 *     say loudly when a machine cannot hold them, rather than silently
 *     running at 8fps later.
 */

import { log } from '../util/log';

/** What the engine wants, eventually. Clamped to the adapter's real limits. */
const WANTED = {
  // 400k building instances x 80B, plus lane-graph storage for pathfinding.
  maxBufferSize: 512 * 1024 * 1024,
  maxStorageBufferBindingSize: 512 * 1024 * 1024,
  // Terrain heightmaps and the per-pack texture arrays.
  maxTextureDimension2D: 8192,
  maxTextureArrayLayers: 256,
  // Instance data + material tables + light lists bound at once.
  maxStorageBuffersPerShaderStage: 8,
  maxSampledTexturesPerShaderStage: 16,
  // Traffic and LOD selection compute passes.
  maxComputeWorkgroupStorageSize: 16384,
  maxComputeInvocationsPerWorkgroup: 256,
} as const;

/** Below these, the engine will run but the design budgets are unreachable. */
const MINIMUM = {
  maxBufferSize: 128 * 1024 * 1024,
  maxStorageBufferBindingSize: 128 * 1024 * 1024,
  maxTextureDimension2D: 4096,
} as const;

export type LimitName = keyof typeof WANTED;

export function requestedLimits(adapter: GPUAdapter): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, want] of Object.entries(WANTED)) {
    const have = adapter.limits[name as keyof GPUSupportedLimits];
    if (typeof have === 'number') out[name] = Math.min(want, have);
  }
  return out;
}

/** Optional features we take if offered. None are required to boot. */
export function requestedFeatures(adapter: GPUAdapter): GPUFeatureName[] {
  const nice: GPUFeatureName[] = [
    'timestamp-query',            // GPU-side profiling, needed for the budget HUD
    'texture-compression-bc',     // desktop: BC7 asset packs
    'texture-compression-astc',   // mobile: ASTC asset packs
    'indirect-first-instance',    // GPU-driven draws for merged distant chunks
  ];
  return nice.filter((f) => adapter.features.has(f));
}

function mib(n: number): string {
  return `${(n / 1024 / 1024).toFixed(0)} MiB`;
}

/** Logs a readable capability table and warns about anything under budget. */
export function reportCaps(adapter: GPUAdapter, device: GPUDevice): void {
  const info = adapter.info as GPUAdapterInfo | undefined;
  if (info) {
    const parts = [info.vendor, info.architecture, info.device, info.description]
      .filter((s) => s && s.length > 0)
      .join(' / ');
    log.info('caps', `adapter: ${parts || '(no info exposed)'}`);
  }

  log.info('caps', `features: ${[...device.features].join(', ') || '(none)'}`);
  log.info(
    'caps',
    `buffers: max ${mib(device.limits.maxBufferSize)}, ` +
      `storage binding ${mib(device.limits.maxStorageBufferBindingSize)}`,
  );
  log.info(
    'caps',
    `textures: ${device.limits.maxTextureDimension2D}px 2D, ` +
      `${device.limits.maxTextureArrayLayers} array layers`,
  );
  log.info(
    'caps',
    `compute: ${device.limits.maxComputeInvocationsPerWorkgroup} invocations/wg, ` +
      `${device.limits.maxComputeWorkgroupStorageSize}B shared`,
  );

  for (const [name, floor] of Object.entries(MINIMUM)) {
    const have = device.limits[name as keyof GPUSupportedLimits];
    if (typeof have === 'number' && have < floor) {
      log.warn('caps', `${name} is ${have}, below the ${floor} the design budgets assume`);
    }
  }

  if (!device.features.has('timestamp-query')) {
    log.warn('caps', 'no timestamp-query: GPU timings in the budget HUD will be unavailable');
  }
}
