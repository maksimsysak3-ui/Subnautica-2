// The mains, drawn as lines along the streets.
//
// A ribbon per run, in the utility's colour, lying just above the road surface.
// Deliberately unlit: this is a drawing over the world rather than an object in
// it, and a pipe that took the sun's angle would read as a stripe of paint on the
// tarmac -- which is exactly what it would look like and exactly not what it is.
//
// Depth-tested so a building in front hides it, and not depth-writing, so three
// mains side by side in one street blend at their edges instead of fighting.

#include "common.wgsl"
#include "atmosphere.wgsl"

struct Out {
  @builtin(position) pos: vec4f,
  @location(0) tint: vec3f,
  @location(1) fade: f32,
};

@vertex
fn vs(@location(0) at: vec3f, @location(1) tint: vec3f) -> Out {
  var out: Out;
  out.pos = camera.viewProj * vec4f(at, 1.0);
  out.tint = tint;
  // Gone in the distance: a metre-wide line four kilometres away is a flickering
  // thread, and the question it answers is one you ask from above a district.
  out.fade = 1.0 - smoothstep(1600.0, 2600.0, length(camera.eye.xyz - at));
  return out;
}

@fragment
fn fs(in: Out) -> @location(0) vec4f {
  if (in.fade < 0.02) { discard; }
  return vec4f(tonemap(in.tint), in.fade * 0.92);
}
