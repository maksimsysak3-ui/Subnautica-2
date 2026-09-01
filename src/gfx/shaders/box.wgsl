// Instanced buildings, at two levels of detail.
//
// vs_solid draws the near ones as five-faced boxes. vs_impostor draws the far
// ones as a single camera-facing quad: at that distance a building is a few
// pixels wide and the silhouette is all that survives, so five faces of
// shading is work thrown away. Which list an instance lands in is decided by
// the culling pass in cull.wgsl, not here.
//
// Original note, still true of the near path:
// Instanced boxes -- the stand-in for buildings.
//
// This is the draw path the real building renderer will use, proved at a
// scale where mistakes are still cheap: one pipeline, one draw call, N
// instances, all per-instance data read from a storage buffer indexed by
// @builtin(instance_index). Swapping the hardcoded cube for a mesh out of an
// asset pack does not change the shape of any of this.
//
// The bottom face is omitted: 30 vertices instead of 36, and it is never
// visible on something standing on the ground.

#include "common.wgsl"

struct Box {
  // xy = centre on the ground plane, zw = half extents
  ground : vec4f,
  // x = base height (the terrain under it), y = building height
  form   : vec4f,
  // rgb = colour
  tint   : vec4f,
};

@group(1) @binding(0) var<storage, read> boxes : array<Box>;
// Indices chosen by the culling pass. The draw is indirect, so its length is
// only ever known on the GPU.
@group(1) @binding(1) var<storage, read> visible : array<u32>;

struct VSOut {
  @builtin(position) pos    : vec4f,
  @location(0)       normal : vec3f,
  @location(1)       world  : vec3f,
  @location(2)       colour : vec3f,
  @location(3)       up     : f32,   // 0 at the base, 1 at the roof
};

@vertex
fn vs_solid(@builtin(vertex_index) vi : u32,
      @builtin(instance_index) ii : u32) -> VSOut {
  // Five faces, two triangles each, wound counter-clockwise from outside.
  var P = array<vec3f, 30>(
    // +X
    vec3f( 1.0, 0.0,  1.0), vec3f( 1.0, 0.0, -1.0), vec3f( 1.0, 1.0, -1.0),
    vec3f( 1.0, 0.0,  1.0), vec3f( 1.0, 1.0, -1.0), vec3f( 1.0, 1.0,  1.0),
    // -X
    vec3f(-1.0, 0.0, -1.0), vec3f(-1.0, 0.0,  1.0), vec3f(-1.0, 1.0,  1.0),
    vec3f(-1.0, 0.0, -1.0), vec3f(-1.0, 1.0,  1.0), vec3f(-1.0, 1.0, -1.0),
    // +Z
    vec3f(-1.0, 0.0,  1.0), vec3f( 1.0, 0.0,  1.0), vec3f( 1.0, 1.0,  1.0),
    vec3f(-1.0, 0.0,  1.0), vec3f( 1.0, 1.0,  1.0), vec3f(-1.0, 1.0,  1.0),
    // -Z
    vec3f( 1.0, 0.0, -1.0), vec3f(-1.0, 0.0, -1.0), vec3f(-1.0, 1.0, -1.0),
    vec3f( 1.0, 0.0, -1.0), vec3f(-1.0, 1.0, -1.0), vec3f( 1.0, 1.0, -1.0),
    // +Y (roof)
    vec3f(-1.0, 1.0,  1.0), vec3f( 1.0, 1.0,  1.0), vec3f( 1.0, 1.0, -1.0),
    vec3f(-1.0, 1.0,  1.0), vec3f( 1.0, 1.0, -1.0), vec3f(-1.0, 1.0, -1.0),
  );
  var N = array<vec3f, 5>(
    vec3f(1.0, 0.0, 0.0), vec3f(-1.0, 0.0, 0.0),
    vec3f(0.0, 0.0, 1.0), vec3f(0.0, 0.0, -1.0),
    vec3f(0.0, 1.0, 0.0),
  );

  let box = boxes[visible[ii]];
  let local = P[vi];

  let world = vec3f(
    box.ground.x + local.x * box.ground.z,
    box.form.x + local.y * box.form.y,
    box.ground.y + local.z * box.ground.w,
  );

  var out : VSOut;
  out.pos = camera.viewProj * vec4f(world, 1.0);
  out.normal = N[vi / 6u];
  out.world = world;
  out.colour = box.tint.rgb;
  out.up = local.y;
  return out;
}

// Far LOD: one quad, turned to face the camera about the vertical axis, sized
// to the building's footprint and height. Six vertices instead of thirty.
@vertex
fn vs_impostor(@builtin(vertex_index) vi : u32,
               @builtin(instance_index) ii : u32) -> VSOut {
  var Q = array<vec2f, 6>(
    vec2f(-1.0, 0.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0),
    vec2f(-1.0, 0.0), vec2f(1.0, 1.0), vec2f(-1.0, 1.0),
  );

  let box = boxes[visible[ii]];
  let base = vec3f(box.ground.x, box.form.x, box.ground.y);

  // Yaw-only billboard: keeps verticals vertical, which a fully camera-facing
  // quad would not, and buildings read wrong the moment their edges lean.
  let toEye = normalize(vec3f(camera.eye.x - base.x, 0.0, camera.eye.z - base.z));
  let right = vec3f(-toEye.z, 0.0, toEye.x);
  let halfW = max(box.ground.z, box.ground.w);

  let q = Q[vi];
  let world = base + right * (q.x * halfW) + vec3f(0.0, q.y * box.form.y, 0.0);

  var out : VSOut;
  out.pos = camera.viewProj * vec4f(world, 1.0);
  // Face the light as an average of the box's sides, so the LOD switch does
  // not show up as a brightness pop.
  out.normal = toEye;
  out.world = world;
  out.colour = box.tint.rgb;
  out.up = q.y;
  return out;
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4f {
  let sun = normalize(vec3f(0.45, 0.78, 0.32));
  let n = normalize(in.normal);

  // Lambert, plus a cheap sky/ground hemisphere term so the shaded sides do
  // not go flat black.
  let direct = max(dot(n, sun), 0.0) * 0.85;
  let hemi = mix(0.16, 0.34, n.y * 0.5 + 0.5);

  // Slight vertical gradient reads as height without any texture work.
  let vertical = mix(0.86, 1.06, in.up);

  var col = in.colour * (direct + hemi) * vertical;
  col = mix(col, SKY, horizonFade(in.world));
  return vec4f(col, 1.0);
}
