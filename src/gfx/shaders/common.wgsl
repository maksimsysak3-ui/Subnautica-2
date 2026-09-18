// Shared camera binding. Every pipeline binds this as group 0.

struct Camera {
  viewProj    : mat4x4f,
  /** For unprojecting a screen corner into a world-space view ray. */
  invViewProj : mat4x4f,
  /** The sun's own view, for sampling and for filling the shadow map. */
  sunViewProj : mat4x4f,
  eye      : vec4f,        // xyz = eye position, w = far plane
  /** The sun, normalised, pointing at it. Shared with the asset shader. */
  sunDir   : vec4f,
  /** xyz = what the camera is looking at, w = half the shadow volume, metres. */
  focus    : vec4f,
  // x = time, y = ground extent, z = one shadow map texel,
  // w = viewportHeight / (2 * tan(fovY / 2)), which converts a size in metres
  // at a given distance into a size in pixels
  params   : vec4f,
  /** What the build tool is about to affect, in metres: x0, z0, x1, z1. */
  mark     : vec4f,
  /** rgb = the mark's colour, w = 0 when there is nothing to show. */
  markTint : vec4f,
  /**
   * x = cloud cover, y = fog, z = rain, w = how wet the ground is.
   *
   * Rain and wetness are not the same number and must not be: ground stays wet
   * for a while after a shower stops, and that lag is most of what makes rain
   * read as weather rather than as a particle effect.
   */
  weather  : vec4f,
  /**
   * The land overlay.
   *
   * xy = which of the sixty-four plots are owned, as two thirty-two bit halves
   * z  = how strongly to draw the grid, 0 when the land tool is not in hand
   * w  = the plot under the pointer, or -1
   */
  land     : vec4f,
  /** Metres across one plot, and the world coordinate of the grid's corner. */
  plotGrid : vec4f,
  planes   : array<vec4f, 6>,   // frustum, for the culling pass
  /**
   * x = how far the world is buried, 0 to 1.
   *
   * Set while an underground information view is open. The overlay tints the
   * ground and the roads itself, but the sky, the river and the grass sample no
   * overlay and would otherwise stay in full daylight around a darkened street --
   * which reads as a rendering fault rather than as a drawing of what is below.
   */
  view     : vec4f,
};

@group(0) @binding(0) var<uniform> camera : Camera;
@group(0) @binding(1) var shadowMap : texture_depth_2d;
@group(0) @binding(2) var shadowSampler : sampler_comparison;

/**
 * How much sun reaches a point: 1 lit, 0 in shadow.
 *
 * The same nine-tap comparison the asset shader uses, on the same map, so a
 * building's shadow on the ground and on its own wall have the same edge.
 * Sampling has to happen for every fragment whatever the result, because
 * textureSampleCompare must be reached in uniform control flow -- so the
 * "outside the volume" case is a weight blended in afterwards rather than an
 * early return.
 */
fn shadowFactor(world : vec3f, ndl : f32) -> f32 {
  // Shadows switched off in the settings: one uniform branch, which is uniform
  // control flow, so the comparison sampler below is still legal in every path
  // that reaches it.
  if (camera.view.z > 0.5) { return 1.0; }
  let lightSpace = camera.sunViewProj * vec4f(world, 1.0);
  let ndc = lightSpace.xyz / lightSpace.w;
  let uv = ndc.xy * vec2f(0.5, -0.5) + 0.5;
  let outside = f32(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || ndc.z > 1.0);
  let safeUV = clamp(uv, vec2f(0.001), vec2f(0.999));

  // Slope-scaled bias: a surface nearly edge-on to the sun needs far more
  // bias than one facing it, and a single constant either acnes the flat
  // faces or peters the contact shadows away.
  // tan(acos(n)) is sqrt(1 - n*n) / n, which is the same number without two
  // transcendentals -- and this runs on every lit pixel of every surface in
  // the frame, so two is a great many.
  let c = clamp(ndl, 0.0, 1.0);
  let bias = clamp(0.0022 * (sqrt(max(1.0 - c * c, 0.0)) / max(c, 0.02)), 0.0008, 0.010);
  let texel = camera.params.z;

  // Four taps, not nine.
  //
  // The sampler compares with linear filtering, so each tap is already four
  // texel comparisons blended in hardware -- a two-by-two pattern at three
  // quarters of a texel covers the same footprint a three-by-three grid of
  // point taps would, for a bit over half the fetches. Shadow sampling happens
  // once per lit pixel of the ground, the roads and every building, so it is
  // one of the few things in the frame that is genuinely paid for everywhere.
  let o = texel * 0.75;
  var sum = textureSampleCompare(shadowMap, shadowSampler, safeUV + vec2f(-o, -o), ndc.z - bias);
  sum += textureSampleCompare(shadowMap, shadowSampler, safeUV + vec2f(o, -o), ndc.z - bias);
  sum += textureSampleCompare(shadowMap, shadowSampler, safeUV + vec2f(-o, o), ndc.z - bias);
  sum += textureSampleCompare(shadowMap, shadowSampler, safeUV + vec2f(o, o), ndc.z - bias);
  return mix(sum * 0.25, 1.0, outside);
}

/**
 * Sinks a colour towards the slate an underground view is drawn on.
 *
 * The same expression `overlayTint` uses, so the ground, the sky, the river and
 * the buildings all arrive at one colour rather than three near-misses. Repeated
 * rather than shared in asset.wgsl, which cannot include this file: it binds
 * group 1 to its prototypes and the overlay wants the same index.
 */
fn bury(col: vec3f, k: f32) -> vec3f {
  return mix(col, col * 0.11 + vec3f(0.013, 0.017, 0.024), k);
}

/**
 * Drains a colour towards grey while a surface information view is open.
 *
 * The other half of making a view readable. The overlay tints the ground, but a
 * city seen from above is mostly roofs -- brick, tile, render and glass, all of
 * them coloured -- and a data wash competing with three hundred building colours
 * is a data wash nobody can read. So the city goes quiet and the data is the
 * only colour on the screen, which is what a thematic map is.
 *
 * Not to grey exactly: a touch of the original hue survives, because a city that
 * goes completely monochrome stops being the city you were just looking at.
 */
fn drain(col: vec3f, k: f32) -> vec3f {
  let grey = vec3f(dot(col, vec3f(0.299, 0.587, 0.114)));
  return mix(col, mix(grey, col, 0.18) * 0.92, k);
}
