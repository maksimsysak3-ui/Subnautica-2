// Grass, as geometry.
//
// The ground shader already draws grass, and it is good grass -- but it is a
// picture of grass on a flat surface, and from four metres up a picture of
// grass is exactly what it looks like. What the eye is missing is parallax:
// blades standing between the viewer and the soil, moving against each other
// as the camera moves. Nothing painted on a surface can do that.
//
// So this draws blades. Five triangles each, no vertex buffer -- position and
// shape come from the vertex index -- and no instance buffer either: a blade
// belongs to a cell of a lattice anchored to the world, and which cells are
// drawn is decided from the camera. That anchoring is the thing to get right.
// A blade whose position is hashed from its instance index swims when the
// camera moves, because instance seven is a different piece of ground every
// frame; a blade hashed from its *world cell* stands still while the set of
// cells drawn slides underneath it.
//
// Where a blade may stand comes from the ground map: the height the terrain
// was graded to, and whether the spawner left the cell open. Neither can be
// worked out here -- one is a relaxation over a grid and the other is the
// spawner's own record -- so both are baked into a texture and read once per
// blade.

#include "common.wgsl"
#include "atmosphere.wgsl"
#include "noise.wgsl"

/** The zoning cell, in metres. One texel of the ground map covers one. */
const CELL = 8.0;

@group(1) @binding(0) var groundMap : texture_2d<f32>;

struct Grass {
  /** xy = the lattice origin in metres, z = cell size, w = ground map size. */
  field : vec4f,
  /** x = blade height, y = blade width, z = fade radius, w = cells per side. */
  form  : vec4f,
};
@group(1) @binding(1) var<uniform> grass : Grass;

struct VSOut {
  @builtin(position) pos   : vec4f,
  @location(0)       world : vec3f,
  @location(1)       normal: vec3f,
  /** x = how far up the blade, y = the blade's own hash. */
  @location(2)       blade : vec2f,
};

/** Vertices per blade: four along each side and a tip. */
const BLADE_VERTS = 15u;

/** Nothing to draw here: a triangle with no area, which the rasteriser drops. */
fn nothing() -> VSOut {
  var out : VSOut;
  out.pos = vec4f(0.0, 0.0, 2.0, 1.0);
  return out;
}

@vertex
fn vs(@builtin(vertex_index) vi : u32, @builtin(instance_index) ii : u32) -> VSOut {
  let side = u32(grass.form.w + 0.5);
  let cellSize = grass.field.z;

  // Which cell of the lattice, and where that cell is in the world. The
  // lattice is snapped to its own size, so it does not slide with the camera
  // -- the camera only decides which part of it is drawn.
  let cx = i32(ii % side);
  let cz = i32(ii / side);
  let base = vec2f(grass.field.x + f32(cx) * cellSize,
                   grass.field.y + f32(cz) * cellSize);

  // The blade's own place inside its cell, and its own character.
  let h1 = lattice(vec2i(i32(floor(base.x / cellSize)), i32(floor(base.y / cellSize))));
  let h2 = lattice(vec2i(i32(floor(base.x / cellSize)) + 9871,
                         i32(floor(base.y / cellSize)) - 3301));
  let at = base + vec2f(h1, h2) * cellSize;

  // Out of range, or on ground that is not grass.
  let toEye = at - camera.eye.xz;
  let dist = length(toEye);
  if (dist > grass.form.z) { return nothing(); }

  // The ground map covers the whole zoning grid, one texel per eight-metre
  // cell -- not per grass cell, which is a fifth of a metre. Confusing the two
  // put every blade in the map's middle texel and the field forty times too
  // small, which drew a hundred and forty thousand blades in a puddle.
  let uv = at / (grass.field.w * CELL) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { return nothing(); }
  let texel = vec2i(clamp(uv * grass.field.w, vec2f(0.0), vec2f(grass.field.w - 1.0)));
  let ground = textureLoad(groundMap, texel, 0);
  let open = ground.y;
  if (open < 0.25) { return nothing(); }

  // Thinned with distance rather than cut off: the far half of the field keeps
  // a fraction of its blades, which is what stops the edge being a line.
  let keep = 1.0 - smoothstep(0.18, 1.0, dist / grass.form.z);
  let h3 = lattice(vec2i(i32(at.x * 31.0), i32(at.y * 31.0)));
  if (h3 > keep * open) { return nothing(); }

  // Height, and which way the blade leans. Both from the blade's own hash, so
  // a clump is a range of heights rather than a row of identical spikes.
  let tall = grass.form.x * (0.55 + h1 * 0.85) * (0.55 + open * 0.45);
  let lean = vec2f(h2 - 0.5, h1 - 0.5);

  // Wind: a travelling wave, plus a slower gust that moves across the field.
  // The blade bends rather than shears -- the sway is applied along the
  // blade's length squared, which is how a stem actually bends.
  let t = camera.params.x;
  let gust = 0.45 + 0.55 * vnoise(at * 0.045 + vec2f(t * 0.35, 0.0));
  let wave = sin(t * 2.1 + at.x * 0.55 + at.y * 0.37 + h1 * 6.28);
  let sway = (vec2f(0.62, 0.28) * wave + lean * 1.4) * gust;

  // The blade: four quads up one side and a tip, as a triangle strip unrolled
  // into a list. `step` runs 0 to 1 up the blade.
  let seg = min(vi, BLADE_VERTS - 1u);
  let up = f32(seg / 2u) / 7.0;
  let stepUp = clamp(up, 0.0, 1.0);
  let right = f32(seg % 2u) * 2.0 - 1.0;

  let width = grass.form.y * (1.0 - stepUp * 0.92) * (0.7 + h2 * 0.6);
  // Across the blade, at right angles to the way it leans.
  let across = normalize(vec2f(-sway.y, sway.x) + vec2f(0.001, 0.0));
  let bend = sway * stepUp * stepUp * tall * 0.55;

  var out : VSOut;
  let world = vec3f(
    at.x + across.x * width * right * select(1.0, 0.0, seg == BLADE_VERTS - 1u) + bend.x,
    ground.x + stepUp * tall,
    at.y + across.y * width * right * select(1.0, 0.0, seg == BLADE_VERTS - 1u) + bend.y,
  );
  out.world = world;
  // The blade's normal faces the way it is not leaning, tilted back by the
  // bend, which is what makes a field flash as the wind crosses it.
  out.normal = normalize(vec3f(-across.y * 0.55, 1.0, across.x * 0.55)
    + vec3f(-bend.x, 0.0, -bend.y) * 0.6);
  out.blade = vec2f(stepUp, h1);
  out.pos = camera.viewProj * vec4f(world, 1.0);
  return out;
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4f {
  // Darker at the base, where a real sward is in its own shadow, and yellower
  // at the tip where it is bleached. This gradient is most of what stops a
  // field of blades reading as green wire.
  let root = vec3f(0.042, 0.080, 0.036);
  let tip = mix(vec3f(0.115, 0.180, 0.062), vec3f(0.165, 0.170, 0.075), in.blade.y);
  var col = mix(root, tip, smoothstep(0.0, 0.75, in.blade.x));

  let n = normalize(in.normal);
  let sun = normalize(camera.sunDir.xyz);
  let ndl = dot(n, sun);
  // Grass is thin enough to light from behind: a blade with the sun on the far
  // side of it glows rather than going black, and at a low sun that is the
  // whole look of a field.
  let through = max(-ndl, 0.0) * 0.55 * smoothstep(0.2, 0.9, in.blade.x);
  let ambient = mix(ambientGround(sun), ambientSky(sun), 0.62);
  let lit = shadowFactor(in.world, ndl);
  col = col * (ambient + sunLight(sun) * (max(ndl, 0.0) * lit + through));

  let toEye = in.world - camera.eye.xyz;
  col = aerial(col, length(toEye), toEye, sun);
  return vec4f(tonemap(col), 1.0);
}
