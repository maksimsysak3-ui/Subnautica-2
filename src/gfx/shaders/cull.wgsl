// GPU-side visibility and LOD selection.
//
// One thread per building. Each tests its own bounding box against the frustum
// and, if it survives, appends its index to one of two lists -- near, drawn as
// solid boxes, and far, drawn as billboards. The lists feed indirect draws, so
// the CPU never learns how many survived and never stalls to find out.
//
// This is the shape the real building renderer needs: at 100k instances,
// culling on the CPU means touching 100k structs every frame in JavaScript,
// and uploading the survivors is a megabyte of traffic per frame.
//
// A third outcome is silent: buildings whose projected height is under a pixel
// or two are dropped entirely. Detail culling like this is usually worth more
// than the LOD split, because a distant city is mostly buildings too small to
// resolve.

#include "common.wgsl"

struct Box {
  ground : vec4f,   // xy centre, zw half extents
  form   : vec4f,   // x base height, y building height
  tint   : vec4f,
};

// Matches GPURenderPassEncoder.drawIndirect's expected layout.
struct DrawArgs {
  vertexCount   : u32,
  instanceCount : atomic<u32>,
  firstVertex   : u32,
  firstInstance : u32,
};

@group(1) @binding(0) var<storage, read>       boxes    : array<Box>;
@group(1) @binding(1) var<storage, read_write> nearList : array<u32>;
@group(1) @binding(2) var<storage, read_write> farList  : array<u32>;
@group(1) @binding(3) var<storage, read_write> args     : array<DrawArgs, 2>;

fn visible(lo : vec3f, hi : vec3f) -> bool {
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
  if (i >= arrayLength(&boxes)) { return; }

  let b = boxes[i];
  let lo = vec3f(b.ground.x - b.ground.z, b.form.x, b.ground.y - b.ground.w);
  let hi = vec3f(b.ground.x + b.ground.z, b.form.x + b.form.y, b.ground.y + b.ground.w);
  if (!visible(lo, hi)) { return; }

  let centre = vec3f(b.ground.x, b.form.x + b.form.y * 0.5, b.ground.y);
  let dist = max(length(centre - camera.eye.xyz), 0.001);

  // params.w is viewportHeight / (2 * tan(fovY / 2)): height in metres times
  // this over distance gives height in pixels.
  let pixels = b.form.y * camera.params.w / dist;
  if (pixels < MIN_PIXELS) { return; }

  if (dist < camera.params.z) {
    let slot = atomicAdd(&args[0].instanceCount, 1u);
    nearList[slot] = i;
  } else {
    let slot = atomicAdd(&args[1].instanceCount, 1u);
    farList[slot] = i;
  }
}

const MIN_PIXELS = 2.0;
