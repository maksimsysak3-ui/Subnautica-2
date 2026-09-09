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
  planes   : array<vec4f, 6>,   // frustum, for the culling pass
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
  let lightSpace = camera.sunViewProj * vec4f(world, 1.0);
  let ndc = lightSpace.xyz / lightSpace.w;
  let uv = ndc.xy * vec2f(0.5, -0.5) + 0.5;
  let outside = f32(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || ndc.z > 1.0);
  let safeUV = clamp(uv, vec2f(0.001), vec2f(0.999));

  // Slope-scaled bias: a surface nearly edge-on to the sun needs far more
  // bias than one facing it, and a single constant either acnes the flat
  // faces or peters the contact shadows away.
  let bias = clamp(0.0022 * tan(acos(clamp(ndl, 0.0, 1.0))), 0.0008, 0.010);
  let texel = camera.params.z;

  var sum = 0.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let o = vec2f(f32(x), f32(y)) * texel;
      sum += textureSampleCompare(shadowMap, shadowSampler, safeUV + o, ndc.z - bias);
    }
  }
  return mix(sum / 9.0, 1.0, outside);
}


