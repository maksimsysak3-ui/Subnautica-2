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

/**
 * The ground's own surfaces, which ride along in the same bind group.
 *
 * Not an overlay -- it is there whether or not a view is open, and it is what
 * turns a block of pasture with houses standing in it into a street with
 * gardens, forecourts and yards. It lives here because it is sampled by exactly
 * the two shaders that already take this group, the terrain and the roads, and
 * a group of its own would be a fourth layout, a fourth bind, and two more
 * pipeline layouts for one texture.
 *
 * Four channels because filtering is the point. A class id cannot be blended --
 * halfway between garden and yard is paving, which is nonsense -- so each class
 * is its own channel and the filter mixes weights, which is exactly right: a
 * garden that meets a yard should meet it over a metre or two, the way a real
 * boundary does.
 *
 * r paving, g yard, b garden, a park. All zero is open country.
 */
export const SURFACE_FORMAT: GPUTextureFormat = 'rgba8unorm';

/** How the ground is tinted. Must match `overlayTint` in common.wgsl. */
export const OverlayMode = { OFF: 0, SURFACE: 1, UNDERGROUND: 2, ABUNDANCE: 3 } as const;

export interface OverlayMap {
  texture: GPUTexture;
  view: GPUTextureView;
  sampler: GPUSampler;
  uniform: GPUBuffer;
  group: GPUBindGroup;
  /** Cells across; the texture is this square. */
  size: number;
  /** The ground surfaces, at one texel per zoning cell. */
  surface: GPUTexture;
  /** Cells across the surface texture, and metres across the whole of it. */
  surfaceCells: number;
  extent: number;
  /** Street light falling on the ground, baked from the lamps: see `writeLights`. */
  lights: GPUTexture;
  lightCells: number;
  /** Worked land, one texel per zoning cell: see `writeWorked`. */
  worked: GPUTexture;
  /**
   * The staging copy, written on the CPU and uploaded whole. Typed with its buffer
   * because WebGPU's queue will not take a SharedArrayBuffer view and the bare
   * Uint8Array type permits one.
   */
  data: Uint8Array<ArrayBuffer>;
}

/**
 * Floats in the uniform: mode, extent, strength, and the metres across the
 * surface map -- then three ramp colours.
 *
 * The fourth was padding and is now the one field that has to survive a view
 * being closed: the surfaces are drawn whether or not anything is overlaid, so
 * `clearOverlay` puts the mode back to zero and leaves this alone.
 */
const UNIFORM_FLOATS = 4 + 12;

export function overlayLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'overlay-bgl',
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
    ],
  });
}

export function buildOverlayMap(device: GPUDevice, layout: GPUBindGroupLayout,
  size: number, surfaceCells: number, extent: number): OverlayMap {
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
  const surface = device.createTexture({
    label: 'surface-map',
    size: { width: surfaceCells, height: surfaceCells },
    format: SURFACE_FORMAT,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture({ texture: surface },
    new Uint8Array(surfaceCells * surfaceCells * 4),
    { bytesPerRow: surfaceCells * 4 }, { width: surfaceCells, height: surfaceCells });
  // A texel every four metres, and a multiple of sixty-four across so each row
  // is already the 256 bytes writeTexture wants.
  const lightCells = Math.min(2048, Math.ceil(extent / LIGHT_METRES / 64) * 64);
  const lights = device.createTexture({
    label: 'street-light-map',
    size: { width: lightCells, height: lightCells },
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture({ texture: lights },
    new Uint8Array(lightCells * lightCells * 4),
    { bytesPerRow: lightCells * 4 }, { width: lightCells, height: lightCells });
  const worked = device.createTexture({
    label: 'worked-land-map',
    size: { width: surfaceCells, height: surfaceCells },
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture({ texture: worked },
    new Uint8Array(surfaceCells * surfaceCells * 4),
    { bytesPerRow: surfaceCells * 4 }, { width: surfaceCells, height: surfaceCells });
  const group = device.createBindGroup({
    label: 'overlay-bg', layout,
    entries: [
      { binding: 0, resource: view },
      { binding: 1, resource: sampler },
      { binding: 2, resource: { buffer: uniform } },
      { binding: 3, resource: surface.createView() },
      { binding: 4, resource: lights.createView() },
      { binding: 5, resource: worked.createView() },
    ],
  });
  // Two bytes a texel, and writeTexture wants rows padded to 256 bytes -- which a
  // power-of-two grid at two bytes a texel already is for anything from 128 up.
  const data = new Uint8Array(size * size * 2);
  const u = new Float32Array(UNIFORM_FLOATS);
  u[3] = extent;
  device.queue.writeBuffer(uniform, 0, u);
  device.queue.writeTexture({ texture }, data, { bytesPerRow: size * 2 },
    { width: size, height: size });
  return {
    texture, view, sampler, uniform, group, size, data,
    surface, surfaceCells, extent, lights, lightCells, worked,
  };
}

/**
 * Class per cell in, weights per texel out.
 *
 * The expansion happens here rather than in the shader because it is what makes
 * the filtering mean something: every texel holds one class at full weight, so
 * what the sampler returns between two of them is a blend of those two and
 * nothing else. Written whole -- a megabyte and a half on a full map, once per
 * rebuild, against working out which texels moved.
 */
export function writeSurface(device: GPUDevice, map: OverlayMap,
  kinds: Uint8Array): void {
  const cells = map.surfaceCells;
  const data = new Uint8Array(cells * cells * 4);
  const n = Math.min(kinds.length, cells * cells);
  for (let i = 0; i < n; i++) {
    const k = kinds[i];
    if (k === 0) continue;
    // 1 garden -> b, 2 paving -> r, 3 yard -> g, 4 park -> a.
    data[i * 4 + (k === 2 ? 0 : k === 3 ? 1 : k === 1 ? 2 : 3)] = 255;
  }
  device.queue.writeTexture({ texture: map.surface }, data,
    { bytesPerRow: cells * 4 }, { width: cells, height: cells });
}

/**
 * Worked land in: kind codes per cell (see worked.ts). Out: r how much of the
 * texel is worked, filtered so an area's edge is soft rather than stepped;
 * g the kind, read unfiltered, times thirty-two. `draft` is an area still being
 * drawn, shown at half strength over whatever is there.
 */
export function writeWorked(device: GPUDevice, map: OverlayMap, codes: Uint8Array,
  draft: Uint8Array | null = null, draftCode = 0): void {
  const cells = map.surfaceCells;
  const data = new Uint8Array(cells * cells * 4);
  const n = Math.min(codes.length, cells * cells);
  // Weight and kind per cell, the draft over the top of what is built.
  const weight = new Float32Array(n);
  const kind = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (draft !== null && draft[i] !== 0) { weight[i] = 0.55; kind[i] = draftCode; }
    else if (codes[i] !== 0) { weight[i] = 1; kind[i] = codes[i]; }
  }
  // An area's edge follows eight-metre cells, and filtered straight from them it
  // is a staircase. A 3x3 blur on the weight rounds it, and the kind is spread a
  // cell outward so the blurred rim has a kind to fade in: the edge of a field
  // softens into the grass beside it rather than stepping.
  // Rows with nothing worked in or beside them are skipped: most of the map.
  const rowAny = new Uint8Array(cells);
  for (let i = 0; i < n; i++) if (kind[i] !== 0) rowAny[(i / cells) | 0] = 1;
  for (let z = 0; z < cells; z++) {
    if (rowAny[z] === 0 && (z === 0 || rowAny[z - 1] === 0) && (z === cells - 1 || rowAny[z + 1] === 0)) continue;
    for (let x = 0; x < cells; x++) {
      const i = z * cells + x;
      if (i >= n) continue;
      let sum = 0, cnt = 0, k = kind[i];
      for (let dz = -1; dz <= 1; dz++) {
        const zz = z + dz;
        if (zz < 0 || zz >= cells) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= cells) continue;
          const j = zz * cells + xx;
          sum += weight[j]; cnt++;
          if (k === 0 && kind[j] !== 0) k = kind[j];
        }
      }
      if (k === 0) continue;
      data[i * 4] = Math.round((sum / cnt) * 255);
      data[i * 4 + 1] = k * 32;
    }
  }
  device.queue.writeTexture({ texture: map.worked }, data,
    { bytesPerRow: cells * 4 }, { width: cells, height: cells });
}

/** Metres per texel of the street-light map. */
const LIGHT_METRES = 4;
/** How high a lantern hangs, and how far its light is worth carrying. */
const LANTERN = 5;
const LIGHT_REACH = 26;
/** Warm white, cool white, sodium: the road shader's three, in linear light. */
const LAMP_TINTS: ReadonlyArray<readonly [number, number, number]> = [
  [1.00, 0.80, 0.56], [0.94, 0.94, 1.00], [1.00, 0.62, 0.26],
];

/**
 * The street lights, as light on the ground: what every lamp in the city
 * throws, summed and baked into a map the ground and the buildings sample.
 *
 * The road ribbon lights itself analytically, lamp by lamp, because it knows
 * where its own lamps are. Nothing else does -- and a lit street in a black
 * void is what a night city looked like: the verge, the gardens, the forecourt
 * and the ground floor of every building beside a road were as dark as open
 * country. This is the light that reaches them. Baked rather than computed per
 * pixel because there are tens of thousands of lamps and it changes only when
 * a road does.
 *
 * Irradiance from a point a lantern's height up, cubed cosine rather than the
 * physical fourth power: the extra spread stands for the light the street
 * itself bounces, which is most of what lights a wall across the pavement.
 * Stored as a square root so the dim edge of a pool keeps its precision in
 * eight bits.
 */
export function writeLights(device: GPUDevice, map: OverlayMap,
  lamps: ReadonlyArray<{ x: number; z: number; tint: number }>): void {
  const n = map.lightCells;
  const cell = map.extent / n;
  const sum = new Float32Array(n * n * 3);
  const reach = Math.ceil(LIGHT_REACH / cell);
  const h2 = LANTERN * LANTERN;
  for (const l of lamps) {
    const tint = LAMP_TINTS[l.tint] ?? LAMP_TINTS[0];
    const cx = (l.x + map.extent / 2) / cell - 0.5;
    const cz = (l.z + map.extent / 2) / cell - 0.5;
    const x0 = Math.max(0, Math.floor(cx) - reach), x1 = Math.min(n - 1, Math.ceil(cx) + reach);
    const z0 = Math.max(0, Math.floor(cz) - reach), z1 = Math.min(n - 1, Math.ceil(cz) + reach);
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) * cell, dz = (z - cz) * cell;
        const r2 = dx * dx + dz * dz;
        if (r2 > LIGHT_REACH * LIGHT_REACH) continue;
        const c = LANTERN / Math.sqrt(h2 + r2);
        // Faded to nothing at the reach, so a pool has no rim.
        const e = c * c * c * (1 - r2 / (LIGHT_REACH * LIGHT_REACH));
        const i = (z * n + x) * 3;
        sum[i] += e * tint[0];
        sum[i + 1] += e * tint[1];
        sum[i + 2] += e * tint[2];
      }
    }
  }
  const data = new Uint8Array(n * n * 4);
  for (let i = 0, j = 0; i < sum.length; i += 3, j += 4) {
    data[j] = Math.min(255, Math.sqrt(sum[i]) * 255);
    data[j + 1] = Math.min(255, Math.sqrt(sum[i + 1]) * 255);
    data[j + 2] = Math.min(255, Math.sqrt(sum[i + 2]) * 255);
    data[j + 3] = 255;
  }
  device.queue.writeTexture({ texture: map.lights }, data,
    { bytesPerRow: n * 4 }, { width: n, height: n });
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
  blur(data, map.size);
  device.queue.writeTexture({ texture: map.texture }, data,
    { bytesPerRow: map.size * 2 }, { width: map.size, height: map.size });
  const u = new Float32Array(UNIFORM_FLOATS);
  u[0] = mode; u[1] = extent; u[2] = strength; u[3] = map.extent;
  const lo = hex(ramp[0]), mid = hex(ramp[1]), hi = hex(ramp[2]);
  u.set([lo[0], lo[1], lo[2], 0], 4);
  u.set([mid[0], mid[1], mid[2], 0], 8);
  u.set([hi[0], hi[1], hi[2], 0], 12);
  device.queue.writeBuffer(map.uniform, 0, u);
}

/**
 * Rounds the edges off a view.
 *
 * The readings come from a scatter along the lanes and a spread outward from
 * them, so what arrives here is a lattice of hard-edged cells -- and drawn over
 * a city at the distance a player watches one from, a lattice of hard-edged
 * cells is confetti. It was the single loudest thing about the views: not the
 * colours but the *texture*, thousands of little squares crawling over the
 * ground as the camera moved.
 *
 * A separable box blur over both channels. The coverage channel is blurred with
 * the value, which is what keeps the normalisation honest -- the shader divides
 * one by the other, so smearing only the numerator would darken every edge.
 *
 * Two passes of a five-tap box, which is a decent Gaussian and is four adds per
 * texel. Thirty-seven thousand texels, twice, on the frame a view opens.
 */
const BLUR_PASSES = 2;
const BLUR_RADIUS = 3;

function blur(data: Uint8Array<ArrayBuffer>, size: number): void {
  const n = size * size;
  let src: Uint8Array<ArrayBuffer> = data;
  let tmp: Uint8Array<ArrayBuffer> = new Uint8Array(n * 2);
  for (let pass = 0; pass < BLUR_PASSES * 2; pass++) {
    // Even passes run along x, odd along z: the same loop with the two strides
    // swapped, which is what "separable" buys.
    const along = pass % 2 === 0 ? 1 : size;
    const across = pass % 2 === 0 ? size : 1;
    for (let b = 0; b < size; b++) {
      for (let a = 0; a < size; a++) {
        let v = 0, h = 0, taps = 0;
        for (let k = -BLUR_RADIUS; k <= BLUR_RADIUS; k++) {
          const at = a + k;
          if (at < 0 || at >= size) continue;
          const i = (at * along + b * across) * 2;
          v += src[i]; h += src[i + 1]; taps++;
        }
        const o = (a * along + b * across) * 2;
        tmp[o] = v / taps;
        tmp[o + 1] = h / taps;
      }
    }
    const swap = src; src = tmp; tmp = swap;
  }
  // An odd number of swaps would leave the answer in the scratch buffer.
  if (src !== data) data.set(src);
}

/** Turns the overlay off without touching the texture. */
export function clearOverlay(device: GPUDevice, map: OverlayMap): void {
  const u = new Float32Array(UNIFORM_FLOATS);
  // Everything off except the map's own extent, which the surfaces need and
  // which has nothing to do with any view being open.
  u[3] = map.extent;
  device.queue.writeBuffer(map.uniform, 0, u);
}
