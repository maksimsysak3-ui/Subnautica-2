// The ground plane and its grid.
//
// One quad, no geometry per line. The grid is procedural in the fragment
// shader, with line width derived from screen-space derivatives so a line is
// one pixel wide whether the camera is 8 metres up or 1200. Drawing real line
// geometry would mean thousands of primitives that alias into moire the moment
// you zoom out.
//
// Spacings are the simulation's, not decoration: 8 m is the zoning cell the
// design doc specifies, 64 m is a city block.

#include "common.wgsl"

const CELL  = 8.0;
const BLOCK = 64.0;

struct VSOut {
  @builtin(position) pos   : vec4f,
  @location(0)       world : vec3f,
};

@vertex
fn vs(@builtin(vertex_index) vi : u32) -> VSOut {
  var quad = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f( 1.0, -1.0), vec2f( 1.0,  1.0),
    vec2f(-1.0, -1.0), vec2f( 1.0,  1.0), vec2f(-1.0,  1.0),
  );
  let extent = camera.params.y;
  // Anchored under the camera so the plane can never run out from under a
  // panning view, however far the focus travels.
  let p = quad[vi] * extent + camera.eye.xz;

  var out : VSOut;
  out.world = vec3f(p.x, 0.0, p.y);
  out.pos = camera.viewProj * vec4f(out.world, 1.0);
  return out;
}

// Anti-aliased grid: 1 where a line crosses this pixel, 0 between lines.
fn gridLine(xz : vec2f, spacing : f32) -> f32 {
  let c = xz / spacing;
  let d = abs(fract(c - 0.5) - 0.5) / max(fwidth(c), vec2f(1e-6));
  return 1.0 - min(min(d.x, d.y), 1.0);
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4f {
  let base  = vec3f(0.062, 0.075, 0.094);
  let minor = vec3f(0.118, 0.145, 0.180);
  let major = vec3f(0.200, 0.255, 0.310);
  let axis  = vec3f(0.290, 0.560, 0.720);

  var col = base;
  col = mix(col, minor, gridLine(in.world.xz, CELL) * 0.75);
  col = mix(col, major, gridLine(in.world.xz, BLOCK));

  // The two world axes, so origin is always findable.
  let ax = 1.0 - min(abs(in.world.x) / max(fwidth(in.world.x), 1e-6), 1.0);
  let az = 1.0 - min(abs(in.world.z) / max(fwidth(in.world.z), 1e-6), 1.0);
  col = mix(col, axis, max(ax, az));

  return vec4f(mix(col, SKY, horizonFade(in.world)), 1.0);
}
