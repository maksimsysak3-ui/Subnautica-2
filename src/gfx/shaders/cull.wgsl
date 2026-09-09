// GPU-side visibility and level-of-detail selection.
//
// One thread per building. Each tests its own bounding box against the frustum
// and, if it survives, works out how many pixels tall it will be and appends
// its index to the list for one bucket -- one prototype at one level of
// detail. The lists feed indirect draws, so the CPU never learns how many
// survived and never stalls to find out.
//
// There is no billboard bucket. Every building in the frame is real geometry;
// what changes with distance is which of the three meshes the generator built
// gets drawn. A flat card would be cheaper and would look like a flat card.
//
// A third outcome is silent: buildings whose projected height is under a few
// pixels are dropped entirely. Detail culling like this is usually worth more
// than the LOD split, because a distant city is mostly buildings too small to
// resolve.
//
// The bucket a building lands in is `prototype * 3 + lod`, and where that
// bucket's list lives is `base[bucket]` -- a table the CPU built from the
// city's own census, so a bucket is exactly as large as the number of that
// prototype in the world and can never overflow into its neighbour.

#include "common.wgsl"

struct Instance {
  // x, z, base height, yaw in quarter turns
  place : vec4f,
  // half extent x, half extent z, height, prototype index
  form  : vec4f,
};

// Matches GPURenderPassEncoder.drawIndirect's expected layout.
struct DrawArgs {
  vertexCount   : u32,
  instanceCount : atomic<u32>,
  firstVertex   : u32,
  firstInstance : u32,
};

@group(1) @binding(0) var<storage, read>       instances : array<Instance>;
@group(1) @binding(1) var<storage, read_write> visible   : array<u32>;
@group(1) @binding(2) var<storage, read_write> args      : array<DrawArgs>;
@group(1) @binding(3) var<storage, read>       base      : array<u32>;

fn inFrustum(lo : vec3f, hi : vec3f) -> bool {
  for (var i = 0u; i < 6u; i++) {
    let p = camera.planes[i];
    // The corner furthest along the plane normal. If that one is behind the
    // plane, all eight are.
    let c = vec3f(
      select(lo.x, hi.x, p.x >= 0.0),
      select(lo.y, hi.y, p.y >= 0.0),
      select(lo.z, hi.z, p.z >= 0.0),
    );
    if (dot(p.xyz, c) + p.w < 0.0) { return false; }
  }
  return true;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid : vec3u) {
  let i = gid.x;
  if (i >= arrayLength(&instances)) { return; }

  let inst = instances[i];
  let lo = vec3f(inst.place.x - inst.form.x, inst.place.z, inst.place.y - inst.form.y);
  let hi = vec3f(inst.place.x + inst.form.x, inst.place.z + inst.form.z,
                 inst.place.y + inst.form.y);
  if (!inFrustum(lo, hi)) { return; }

  let centre = vec3f(inst.place.x, inst.place.z + inst.form.z * 0.5, inst.place.y);
  let dist = max(length(centre - camera.eye.xyz), 0.001);

  // params.w is viewportHeight / (2 * tan(fovY / 2)): height in metres times
  // this over distance gives height in pixels.
  let pixels = inst.form.z * camera.params.w / dist;
  if (pixels < MIN_PIXELS) { return; }

  var lod = 2u;
  if (pixels > LOD0_PIXELS) { lod = 0u; }
  else if (pixels > LOD1_PIXELS) { lod = 1u; }

  let bucket = u32(inst.form.w + 0.5) * 3u + lod;
  let slot = atomicAdd(&args[bucket].instanceCount, 1u);
  visible[base[bucket] + slot] = i;
}

/** Under this many pixels tall, a building is not drawn at all. */
const MIN_PIXELS = 3.0;
/** Over this many pixels tall, the full mesh is worth its triangles. */
const LOD0_PIXELS = 150.0;
/** Between this and LOD0_PIXELS, the middle mesh. Below it, bare massing. */
const LOD1_PIXELS = 45.0;
