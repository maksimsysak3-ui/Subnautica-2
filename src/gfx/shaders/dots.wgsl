// Connection dots: one round marker per building, facing the camera.
//
// What they are for is the question "is this house on the water main", which is a
// question about one building at a time and therefore cannot be answered by a
// heatmap -- a wash of colour over a block says the block is served, and the
// player wants to know about the house. So each building gets a dot in the colour
// of the utility, filled when it is connected and hollow when it is not.
//
// Screen-facing and screen-sized within limits: a marker that shrank with distance
// like a real object would vanish at the zoom a player lays pipes from, and one
// that did not would swallow the city from above. It is clamped at both ends.

#include "common.wgsl"
#include "atmosphere.wgsl"

struct Dot {
  // xyz = where it sits in the world, w = radius in metres.
  at: vec4f,
  // rgb = the utility's colour, a = 1 connected, 0 not.
  tint: vec4f,
};

@group(1) @binding(0) var<storage, read> dots: array<Dot>;

struct Out {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) tint: vec4f,
  @location(2) fade: f32,
};

/** The four corners of a quad, as a triangle strip. */
const CORNERS = array<vec2f, 4>(
  vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, 1.0),
);

/** Metres a dot may shrink to and grow to, whatever the zoom says. */
const MIN_METRES = 0.9;
const MAX_METRES = 3.2;

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> Out {
  let d = dots[ii];
  let corner = CORNERS[vi];

  // Held at roughly a constant size on screen. `camera.params.w` converts a size
  // in metres at a given distance into a size in pixels, so dividing by it does
  // the reverse -- the same number the building icons are scaled by, which is why
  // a dot and a label agree about how big "small" is.
  let toEye = length(camera.eye.xyz - d.at.xyz);
  let want = toEye / max(camera.params.w, 1.0) * 7.0;
  let radius = clamp(want, MIN_METRES, MAX_METRES) * d.at.w;

  // Expanded in view space, so it faces the camera without a billboard matrix.
  let right = normalize(vec3f(camera.viewProj[0][0], camera.viewProj[1][0],
                              camera.viewProj[2][0]));
  let up = normalize(vec3f(camera.viewProj[0][1], camera.viewProj[1][1],
                           camera.viewProj[2][1]));
  let world = d.at.xyz + right * (corner.x * radius) + up * (corner.y * radius);

  var out: Out;
  out.pos = camera.viewProj * vec4f(world, 1.0);
  out.uv = corner;
  out.tint = d.tint;
  // Gone in the distance rather than drawn as a speck: ten thousand specks is
  // noise, and the question they answer is one a player asks close up.
  out.fade = 1.0 - smoothstep(900.0, 1500.0, toEye);
  return out;
}

@fragment
fn fs(in: Out) -> @location(0) vec4f {
  let r = length(in.uv);
  if (r > 1.0) { discard; }
  // A filled disc for a connection, a ring for the absence of one. The ring is
  // what makes a missed house findable: a gap in a field of dots is invisible, an
  // outline among filled discs is not.
  let edge = fwidth(r) * 1.5 + 0.02;
  let disc = 1.0 - smoothstep(1.0 - edge * 2.0, 1.0, r);
  let ring = smoothstep(0.52 - edge, 0.52 + edge, r) * disc;
  let mask = mix(ring, disc, in.tint.a);
  if (mask < 0.02) { discard; }

  // Unconnected dots are drawn in a warning red rather than in the utility's own
  // colour: the colour says which utility, the shape and the hue together say
  // whether it is there.
  let colour = mix(vec3f(0.92, 0.28, 0.22), in.tint.rgb, in.tint.a);
  return vec4f(tonemap(colour * 1.3), mask * in.fade * 0.95);
}
