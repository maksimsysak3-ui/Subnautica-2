/**
 * The information overlay, as something the GPU can read.
 *
 * Every information view the simulation produces is a grid of readings over the
 * map, and the only honest way to show one is on the map itself -- a player asking
 * "where is the water" wants to see it over the streets, not in a separate window
 * with a different shape. So the grid becomes a texture, the terrain and the roads
 * sample it, and the ground is tinted where there is a reading and left alone where
 * there is not.
 *
 * Two channels rather than one, and that is what makes the edges work. The value is
 * in red; whether there *is* a value at all is in green. Sampling is linear, so a
 * heatmap is smooth rather than a grid of thirty-two metre squares -- but linear
 * filtering at the boundary of the data would blend a real reading towards zero and
 * paint a dark fringe round every covered district. The coverage channel blends the
 * same way, so the tint fades out instead of darkening.
 *
 * Underground views get a second mode rather than a second pass: the world is
 * darkened and the network lit through it, which is what a utility map looks like
 * and costs one branch in the shader.
 */

/** rg8unorm: r is the reading, g is whether there is one. */
export const OVERLAY_FORMAT: GPUTextureFormat = 'rg8unorm';

/** How the ground is tinted. Must match `overlayTint` in common.wgsl. */
export const OverlayMode = { OFF: 0, SURFACE: 1, UNDERGROUND: 2 } as const;

export interface OverlayMap {
  texture: GPUTexture;
  view: GPUTextureView;
  sampler: GPUSampler;
  uniform: GPUBuffer;
  group: GPUBindGroup;
  /** Cells across; the texture is this square. */
  size: number;
  /**
   * The staging copy, written on the CPU and uploaded whole. Typed with its buffer
   * because WebGPU's queue will not take a SharedArrayBuffer view and the bare
   * Uint8Array type permits one.
   */
  data: Uint8Array<ArrayBuffer>;
}

/** Floats in the uniform: mode, extent, strength, pad, then three ramp colours. */
const UNIFORM_FLOATS = 4 + 12;

export function overlayLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'overlay-bgl',
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
    ],
  });
}

export function buildOverlayMap(device: GPUDevice, layout: GPUBindGroupLayout,
  size: number): OverlayMap {
  const texture = device.createTexture({
    label: 'overlay-map',
    size: { width: size, height: size },
    format: OVERLAY_FORMAT,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  const view = texture.createView();
  const sampler = device.createSampler({
    label: 'overlay-sampler',
    magFilter: 'linear', minFilter: 'linear',
    addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge',
  });
  const uniform = device.createBuffer({
    label: 'overlay-uniform',
    size: UNIFORM_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const group = device.createBindGroup({
    label: 'overlay-bg', layout,
    entries: [
      { binding: 0, resource: view },
      { binding: 1, resource: sampler },
      { binding: 2, resource: { buffer: uniform } },
    ],
  });
  // Two bytes a texel, and writeTexture wants rows padded to 256 bytes -- which a
  // power-of-two grid at two bytes a texel already is for anything from 128 up.
  const data = new Uint8Array(size * size * 2);
  device.queue.writeBuffer(uniform, 0, new Float32Array(UNIFORM_FLOATS));
  device.queue.writeTexture({ texture }, data, { bytesPerRow: size * 2 },
    { width: size, height: size });
  return { texture, view, sampler, uniform, group, size, data };
}

/** Turns "#rrggbb" into linear-ish floats the shader can mix. */
function hex(s: string): [number, number, number] {
  const n = parseInt(s.replace('#', ''), 16);
  // Squared rather than a true sRGB curve: the shader tonemaps afterwards, and the
  // difference between the two at these saturations is not something a legend swatch
  // and the map beside it could disagree about visibly.
  const to = (v: number): number => (v / 255) ** 2.2;
  return [to((n >> 16) & 255), to((n >> 8) & 255), to(n & 255)];
}

/**
 * Uploads a view.
 *
 * `grid` is the simulation's byte per cell, where zero means no reading. Written
 * into the two-channel staging copy and sent whole: a hundred and forty-seven
 * kilobytes is one upload and far cheaper than working out which cells changed.
 */
export function writeOverlay(device: GPUDevice, map: OverlayMap, grid: Uint8Array,
  mode: number, extent: number, strength: number,
  ramp: readonly [string, string, string]): void {
  const data = map.data;
  const n = Math.min(grid.length, map.size * map.size);
  for (let i = 0; i < n; i++) {
    const v = grid[i];
    data[i * 2] = v;
    data[i * 2 + 1] = v === 0 ? 0 : 255;
  }
  device.queue.writeTexture({ texture: map.texture }, data,
    { bytesPerRow: map.size * 2 }, { width: map.size, height: map.size });
  const u = new Float32Array(UNIFORM_FLOATS);
  u[0] = mode; u[1] = extent; u[2] = strength; u[3] = 0;
  const lo = hex(ramp[0]), mid = hex(ramp[1]), hi = hex(ramp[2]);
  u.set([lo[0], lo[1], lo[2], 0], 4);
  u.set([mid[0], mid[1], mid[2], 0], 8);
  u.set([hi[0], hi[1], hi[2], 0], 12);
  device.queue.writeBuffer(map.uniform, 0, u);
}

/** Turns the overlay off without touching the texture. */
export function clearOverlay(device: GPUDevice, map: OverlayMap): void {
  device.queue.writeBuffer(map.uniform, 0, new Float32Array(UNIFORM_FLOATS));
}
