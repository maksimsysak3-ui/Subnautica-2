// The sky, as one triangle covering the frame.
//
// Drawn before anything else with depth writes off, so every later pass paints
// over it and the sky costs one full-screen shade and no depth traffic. The
// alternative -- clearing to a flat colour -- is what the renderer did, and it
// is why a scene lit for midday read as midnight.

#include "common.wgsl"
#include "atmosphere.wgsl"

struct VSOut {
  @builtin(position) pos : vec4f,
  /** The view ray, in world space, unnormalised. */
  @location(0)       dir : vec3f,
};

@vertex
fn vs(@builtin(vertex_index) i : u32) -> VSOut {
  // One oversized triangle rather than two: no seam down the diagonal, and
  // three vertices instead of six.
  let uv = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  let ndc = uv * 2.0 - 1.0;
  var out : VSOut;
  out.pos = vec4f(ndc, 1.0, 1.0);
  // Unproject the far plane. The camera uniform carries viewProj, so the ray
  // is the inverse applied to this corner -- done by solving rather than by
  // uploading a second matrix, since the view direction is all that is needed.
  let far = camera.invViewProj * vec4f(ndc, 1.0, 1.0);
  out.dir = far.xyz / far.w - camera.eye.xyz;
  return out;
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4f {
  let col = skyColour(in.dir, normalize(camera.sunDir.xyz));
  // The same filmic shoulder the ground and the buildings use, so the horizon
  // meets the terrain without a seam.
  return vec4f(pow(col / (col + vec3f(0.72)) * 1.42, vec3f(0.9)), 1.0);
}
