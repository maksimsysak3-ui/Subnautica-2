// The terrain surface, and the grid drawn onto it.
//
// The grid is procedural rather than geometry: line width comes from
// screen-space derivatives, so a line stays one pixel wide whether the camera
// is 8 metres up or 1200. Drawing real lines would mean thousands of
// primitives that alias into moire on zoom-out.
//
// Spacings are the simulation's, not decoration: 8 m is the zoning cell the
// design doc specifies, 64 m is a city block. The city generator places
// buildings on the same grid, so ground and buildings agree by construction.

#include "common.wgsl"

const CELL  = 8.0;
const BLOCK = 64.0;

struct VSOut {
  @builtin(position) pos    : vec4f,
  @location(0)       world  : vec3f,
  @location(1)       normal : vec3f,
};

@vertex
fn vs(@location(0) position : vec3f,
      @location(1) normal   : vec3f) -> VSOut {
  var out : VSOut;
  out.world = position;
  out.normal = normal;
  out.pos = camera.viewProj * vec4f(position, 1.0);
  return out;
}

// Anti-aliased grid: 1 where a line crosses this pixel, 0 between lines.
fn gridLine(xz : vec2f, spacing : f32) -> f32 {
  let c = xz / spacing;
  let d = abs(fract(c - 0.5) - 0.5) / max(fwidth(c), vec2f(1e-6));
  return 1.0 - min(min(d.x, d.y), 1.0);
}

// Fades a grid out once its cells shrink towards pixel size. Without this the
// 8 m cells turn the whole map into grey mush the moment you zoom out -- the
// lines are still individually correct, there are just far too many of them.
fn densityFade(xz : vec2f, spacing : f32) -> f32 {
  let metresPerPixel = max(max(fwidth(xz.x), fwidth(xz.y)), 1e-6);
  return smoothstep(3.0, 14.0, spacing / metresPerPixel);
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4f {
  let n = normalize(in.normal);
  let sun = normalize(vec3f(0.45, 0.78, 0.32));

  // Grass in the flats, rock on the steep faces -- slope is the only input, so
  // it stays consistent when the player reshapes the ground later.
  let slope = 1.0 - clamp(n.y, 0.0, 1.0);
  let flat  = vec3f(0.074, 0.092, 0.104);
  let steep = vec3f(0.104, 0.098, 0.092);
  var col = mix(flat, steep, smoothstep(0.08, 0.42, slope));

  // The grid fades out on steep ground, where it would only read as noise.
  let gridStrength = 1.0 - smoothstep(0.10, 0.34, slope);
  let minor = vec3f(0.128, 0.155, 0.190);
  let major = vec3f(0.210, 0.265, 0.320);
  col = mix(col, minor, gridLine(in.world.xz, CELL) * 0.62 * gridStrength
                        * densityFade(in.world.xz, CELL));
  col = mix(col, major, gridLine(in.world.xz, BLOCK) * gridStrength
                        * densityFade(in.world.xz, BLOCK));

  // The world axes. Faded by the same density term as the grid: at grazing
  // angles a pixel covers hundreds of metres, so "within one pixel of x = 0"
  // becomes true across the whole horizon and the axis smears into a band.
  let ax = 1.0 - min(abs(in.world.x) / max(fwidth(in.world.x), 1e-6), 1.0);
  let az = 1.0 - min(abs(in.world.z) / max(fwidth(in.world.z), 1e-6), 1.0);
  col = mix(col, vec3f(0.290, 0.560, 0.720),
            max(ax, az) * gridStrength * densityFade(in.world.xz, CELL));

  let direct = max(dot(n, sun), 0.0) * 0.75;
  let hemi = mix(0.30, 0.52, n.y * 0.5 + 0.5);
  col = col * (direct + hemi) * 2.0;

  return vec4f(mix(col, SKY, horizonFade(in.world)), 1.0);
}
