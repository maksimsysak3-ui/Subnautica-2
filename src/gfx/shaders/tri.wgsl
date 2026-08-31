// Step-1 proof shader.
//
// Deliberately not "a triangle". It exercises the three things the building
// renderer will depend on, so that if any of them is broken we find out now:
//
//   1. a uniform bind group (per-frame constants)
//   2. a read-only storage buffer indexed by @builtin(instance_index)
//      -- this is exactly how 100k buildings will be drawn, one call
//   3. a real depth attachment: the instances are submitted front-to-back,
//      the wrong order for painter's algorithm, so the overlap is only
//      correct if depth testing genuinely works.

struct Frame {
  aspect : f32,
  time   : f32,
  _pad   : vec2f,
};

struct Instance {
  offset : vec2f,
  depth  : f32,   // clip-space z, 0 = near, 1 = far (WebGPU convention)
  scale  : f32,
  color  : vec4f,
};

@group(0) @binding(0) var<uniform> frame : Frame;
@group(0) @binding(1) var<storage, read> instances : array<Instance>;

struct VSOut {
  @builtin(position) pos   : vec4f,
  @location(0)       color : vec4f,
  @location(1)       bary  : vec2f,
};

const VERTS = array<vec2f, 3>(
  vec2f( 0.0,  0.62),
  vec2f(-0.54, -0.32),
  vec2f( 0.54, -0.32),
);

@vertex
fn vs(@builtin(vertex_index) vi : u32,
      @builtin(instance_index) ii : u32) -> VSOut {
  let inst = instances[ii];

  // Each instance spins at its own phase so the frame loop is visibly live.
  let a = frame.time * 0.35 + f32(ii) * 2.0944;
  let s = sin(a);
  let c = cos(a);

  var p = VERTS[vi] * inst.scale;
  p = vec2f(p.x * c - p.y * s, p.x * s + p.y * c);
  p += inst.offset;
  p.x /= max(frame.aspect, 0.0001);   // keep it square on any window shape

  var out : VSOut;
  out.pos = vec4f(p, inst.depth, 1.0);
  out.color = inst.color;
  out.bary = VERTS[vi];
  return out;
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4f {
  // Cheap vertical falloff so the shapes read as solid objects, not flat fill.
  let shade = 0.72 + 0.28 * (in.bary.y + 0.32);
  return vec4f(in.color.rgb * shade, in.color.a);
}
