// The mains, drawn as lines along the streets.
//
// A ribbon per run, in the utility's colour, lying just above the road surface.
// Deliberately unlit: this is a drawing over the world rather than an object in
// it, and a pipe that took the sun's angle would read as a stripe of paint on the
// tarmac -- which is exactly what it would look like and exactly not what it is.
//
// WIDENED HERE, NOT IN THE MESH. A main is about a metre across and a player lays
// pipes from four hundred metres up, where a metre is less than a pixel. Baked at
// its true width it was drawn, correctly, and invisible -- so each corner arrives
// sitting on the centreline with the way out of it, and is pushed out far enough
// to hold a steady handful of pixels whatever the zoom. Clamped at both ends: a
// line that never thinned would swallow the city from altitude, and one that never
// grew is the bug this replaced.
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

/** Metres. The floor matches MAIN_MIN_WIDTH in mains-mesh.ts. */
const MIN_WIDTH = 1.15;
const MAX_WIDTH = 7.5;
/** Roughly the pixels across a main should hold. */
const WANT_PIXELS = 5.0;

@vertex
fn vs(@location(0) at: vec3f, @location(1) tint: vec3f,
      @location(2) side: vec3f) -> Out {
  let toEye = length(camera.eye.xyz - at);
  // `camera.params.w` turns a size in metres at a given distance into a size in
  // pixels, so dividing by it does the reverse. The same number the connection
  // markers use, which is why a dot and the line into it agree about scale.
  let want = toEye / max(camera.params.w, 1.0) * WANT_PIXELS;
  let half = clamp(want, MIN_WIDTH, MAX_WIDTH) * 0.5;
  let world = at + vec3f(side.x, 0.0, side.y) * (side.z * half);

  var out: Out;
  out.pos = camera.viewProj * vec4f(world, 1.0);
  out.tint = tint;
  // Gone in the far distance: a line four kilometres away is a flickering thread,
  // and the question it answers is one you ask from above a district.
  out.fade = 1.0 - smoothstep(2600.0, 4200.0, toEye);
  return out;
}

@fragment
fn fs(in: Out) -> @location(0) vec4f {
  if (in.fade < 0.02) { discard; }
  return vec4f(tonemap(in.tint), in.fade * 0.95);
}
