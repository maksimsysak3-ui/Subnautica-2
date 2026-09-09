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
// A building goes into two lists, not one. The camera's list decides what is
// drawn and at which level of detail; the sun's decides what fills the shadow
// map, which is a different set -- something behind the camera still throws a
// shadow into the frame -- and always at the coarsest level, because a shadow
// map at half a metre a texel cannot resolve a window reveal and pays for it
// anyway. So the shadow lists are one bucket per prototype rather than three.
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
  // x = stretch along the prototype's own Z; the rest spare
  extra : vec4f,
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
/** The same again for the shadow map, whose casters are a different set. */
@group(1) @binding(4) var<storage, read_write> casters   : array<u32>;
@group(1) @binding(5) var<storage, read_write> castArgs  : array<DrawArgs>;
@group(1) @binding(6) var<storage, read>       castBase  : array<u32>;

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
  let proto = u32(inst.form.w + 0.5);
  let lo = vec3f(inst.place.x - inst.form.x, inst.place.z, inst.place.y - inst.form.y);
  let hi = vec3f(inst.place.x + inst.form.x, inst.place.z + inst.form.z,
                 inst.place.y + inst.form.y);

  // Shadow casters first, and they are not the visible set: something behind
  // the camera, or off the side of the frame, still throws a shadow into it.
  // The test is a disc around what the camera is looking at, because that is
  // what the sun's orthographic volume is fitted to -- conservative, one
  // comparison, and it cannot miss a caster the way a frustum test would.
  let reach = camera.focus.w * 1.6;
  let flat = vec2f(inst.place.x - camera.focus.x, inst.place.y - camera.focus.z);
  if (dot(flat, flat) < reach * reach
      && inst.form.z > camera.focus.w * SHADOW_MIN_SIZE) {
    let slot = atomicAdd(&castArgs[proto].instanceCount, 1u);
    casters[castBase[proto] + slot] = i;
  }

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

  let bucket = proto * 3u + lod;
  let slot = atomicAdd(&args[bucket].instanceCount, 1u);
  visible[base[bucket] + slot] = i;
}

/**
 * Smallest caster, as a fraction of the shadow volume's half extent.
 *
 * A bollard in a nine-hundred-metre volume is a third of a texel, so its
 * shadow is either nothing or a flickering speck, and drawing it costs a
 * bucket. The threshold is relative rather than absolute so that zooming in,
 * which shrinks the volume, brings the small things back into it.
 */
const SHADOW_MIN_SIZE = 0.006;

/**
 * Under this many pixels tall, a building is not drawn at all.
 *
 * Three was too generous and it showed in the measurements: the triangle count
 * *rose* with distance, because at two kilometres a three-pixel threshold
 * still admits every house on the map. Detail culling is worth more than the
 * level-of-detail split on a city, and this is the knob that does it.
 */
const MIN_PIXELS = 4.5;
/** Over this many pixels tall, the full mesh is worth its triangles. */
const LOD0_PIXELS = 110.0;
/** Between this and LOD0_PIXELS, the middle mesh. Below it, bare massing. */
const LOD1_PIXELS = 32.0;
