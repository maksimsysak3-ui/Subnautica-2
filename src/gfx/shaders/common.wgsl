// Shared camera binding. Every pipeline binds this as group 0.

struct Camera {
  viewProj    : mat4x4f,
  /** For unprojecting a screen corner into a world-space view ray. */
  invViewProj : mat4x4f,
  eye      : vec4f,        // xyz = eye position, w = far plane
  /** The sun, normalised, pointing at it. Shared with the asset shader. */
  sunDir   : vec4f,
  // x = time, y = ground extent, z = unused,
  // w = viewportHeight / (2 * tan(fovY / 2)), which converts a size in metres
  // at a given distance into a size in pixels
  params   : vec4f,
  planes   : array<vec4f, 6>,   // frustum, for the culling pass
};

@group(0) @binding(0) var<uniform> camera : Camera;


