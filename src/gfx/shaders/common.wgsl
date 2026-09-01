// Shared camera binding. Every pipeline binds this as group 0.

struct Camera {
  viewProj : mat4x4f,
  eye      : vec4f,        // xyz = eye position, w = far plane
  // x = time, y = ground extent, z = near/far LOD split in metres,
  // w = viewportHeight / (2 * tan(fovY / 2)), which converts a size in metres
  // at a given distance into a size in pixels
  params   : vec4f,
  planes   : array<vec4f, 6>,   // frustum, for the culling pass
};

@group(0) @binding(0) var<uniform> camera : Camera;

const SKY = vec3f(0.043, 0.055, 0.075);

// Distance fade into the background colour, so the world dissolves at the
// horizon instead of ending at a visible edge.
fn horizonFade(worldPos : vec3f) -> f32 {
  let d = length(worldPos.xz - camera.eye.xz);
  return smoothstep(camera.params.y * 0.75, camera.params.y * 1.75, d);
}
