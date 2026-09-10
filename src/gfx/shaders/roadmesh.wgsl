// The road surface.
//
// One draw call for every road on the map. The geometry is a swept ribbon --
// see src/sim/roadmesh.ts -- and everything painted on it is computed here
// from two numbers the vertex carries: how far across the road it is, and how
// far along. That is the whole trick. Lane lines sit at a fixed offset across
// and stay parallel through a bend; dashes repeat at a fixed pitch along the
// arc, so they are the same length on a curve as on a straight. Geometry
// cannot do either -- a dash built as a quad is spaced along the chord, and on
// a tight bend the outside dashes stretch and the inside ones bunch.
//
// The surfaces are deliberately few. A road reads as a road because of its
// markings, its kerb and the way the asphalt wears in the wheel tracks, not
// because of material variety, and every extra branch here is a branch taken
// by every pixel of every road on screen.

#include "common.wgsl"
#include "atmosphere.wgsl"
#include "noise.wgsl"

const SURF_ROAD      = 0.0;
const SURF_KERB_FACE = 1.0;
const SURF_KERB_TOP  = 2.0;
const SURF_FOOTWAY   = 3.0;
const SURF_JUNCTION  = 4.0;
const SURF_MEDIAN    = 5.0;
const SURF_VERGE     = 6.0;

struct VSOut {
  @builtin(position) pos   : vec4f,
  @location(0)       world : vec3f,
  @location(1)       normal: vec3f,
  /** x = metres across from the centreline, y = metres along the road. */
  @location(2)       coord : vec2f,
  /** x = surface, y = carriageway half-width, z = lanes each way, w = flags. */
  @location(3) @interpolate(flat) info : vec4f,
};

@vertex
fn vs(@location(0) position : vec3f,
      @location(1) normal   : vec3f,
      @location(2) coord    : vec2f,
      @location(3) info     : vec4f) -> VSOut {
  var out : VSOut;
  out.world = position;
  out.normal = normal;
  out.coord = coord;
  out.info = info;
  out.pos = camera.viewProj * vec4f(position, 1.0);
  return out;
}

/** A painted line: 1 inside it, falling off over a pixel at its edge. */
fn stripe(u : f32, at : f32, width : f32, mpp : f32) -> f32 {
  let d = abs(u - at);
  return 1.0 - smoothstep(width * 0.5 - mpp, width * 0.5 + mpp, d);
}

/** The same, repeated along the road: `on` metres of paint every `pitch`. */
fn dashed(v : f32, pitch : f32, on : f32, mpp : f32) -> f32 {
  let f = fract(v / pitch) * pitch;
  return 1.0 - smoothstep(on - mpp, on + mpp, f);
}

/**
 * Asphalt.
 *
 * Three things, in the order they matter: the wheel tracks, which are polished
 * darker than the rest and are what tells the eye which way a road runs; the
 * aggregate, fine enough to read as texture rather than as noise; and a slow
 * blotching from repairs and age, which is what stops a long straight looking
 * extruded.
 */
fn asphalt(world : vec2f, u : f32, half : f32, lanes : f32, mpp : f32) -> vec3f {
  let grain = vnoise(world * 5.5) * 0.5 + vnoise(world * 21.0) * 0.5;
  var col = mix(vec3f(0.052, 0.053, 0.058), vec3f(0.086, 0.086, 0.090), grain);

  // Patches: the surface has been dug up and made good more than once.
  let repair = vnoise(world * 0.11);
  col = mix(col, col * 0.82 + vec3f(0.006, 0.005, 0.004),
            smoothstep(0.56, 0.74, repair));

  // Wheel tracks, one pair per lane, polished and slightly darker. Lanes of
  // zero means there are none to run in -- a junction is asphalt that traffic
  // crosses in every direction, and running the track pattern over it with one
  // notional lane the width of the whole junction shaded the entire slab a
  // fifth darker than the roads feeding it.
  if (lanes >= 0.5) {
    let laneW = half / lanes;
    let inLane = abs(u) / max(laneW, 0.5);
    let track = fract(inLane) - 0.5;
    let polish = (1.0 - smoothstep(0.10, 0.34, abs(abs(track) - 0.26)))
               * smoothstep(3.0, 0.6, mpp);
    col *= 1.0 - polish * 0.20;
  }
  return col;
}

/** Cast concrete: kerbs, footway slabs, the central reservation. */
fn concrete(world : vec2f, mpp : f32) -> vec3f {
  let grain = vnoise(world * 8.0) * 0.6 + vnoise(world * 30.0) * 0.4;
  return mix(vec3f(0.140, 0.139, 0.132), vec3f(0.196, 0.194, 0.186), grain);
}

/** Footway: slabs, with the joints between them. */
fn footway(world : vec2f, u : f32, v : f32, mpp : f32) -> vec3f {
  var col = concrete(world, mpp);
  // Laid to the road, so the joints run across and along it rather than
  // north-south: a pavement is set out from the kerb.
  let g = fract(vec2f(u, v) / 0.9);
  let joint = max(1.0 - smoothstep(0.0, mpp * 1.6 + 0.012, min(g.x, 1.0 - g.x)),
                  1.0 - smoothstep(0.0, mpp * 1.6 + 0.012, min(g.y, 1.0 - g.y)));
  col *= 1.0 - joint * 0.30;
  // Every slab a shade of its own, which is most of what makes paving read.
  col *= 0.93 + 0.14 * lattice(vec2i(i32(floor(u / 0.9)), i32(floor(v / 0.9))));
  return col;
}

/** Grass, matched to the terrain's own so a verge does not band against it. */
fn verge(world : vec2f, mpp : f32) -> vec3f {
  // Cellular at blade scale, faded out once a blade is under a pixel, and a
  // slower sward under it. The same two terms the terrain uses, so a verge and
  // the grass it runs into do not band against each other.
  let blades = cells(world / 0.045);
  let blade = clamp(blades.d2 - blades.d1, 0.0, 1.0) * octaveFade(0.045, mpp);
  let sward = vnoise(world * 0.38);
  var col = mix(vec3f(0.055, 0.083, 0.036), vec3f(0.088, 0.116, 0.049), sward);
  col *= 0.86 + blade * 0.34;
  return col;
}

/**
 * Everything painted on the carriageway.
 *
 * Returns coverage, so the caller can mix towards the paint colour rather than
 * this having to know what colour the road under it is.
 */
fn markings(u : f32, v : f32, half : f32, lanes : f32, flags : u32, mpp : f32) -> f32 {
  var paint = 0.0;
  let oneWay = (flags & 1u) != 0u;
  let median = (flags & 4u) != 0u;

  // Edge lines, just inside the kerb, solid.
  paint = max(paint, stripe(abs(u), half - 0.35, 0.14, mpp));

  // The centre. A dual carriageway has a reservation instead, and a one-way
  // street has nothing down the middle at all.
  if (!median && !oneWay) {
    paint = max(paint, stripe(abs(u), 0.0, 0.13, mpp) * dashed(v, 9.0, 3.2, mpp));
  }

  // Lane dividers between the running lanes on each side.
  let laneW = (half - 0.5) / max(lanes, 1.0);
  for (var i = 1.0; i < lanes; i += 1.0) {
    let at = i * laneW;
    paint = max(paint, stripe(abs(u), at, 0.11, mpp) * dashed(v + 4.5, 12.0, 3.0, mpp));
  }
  if (oneWay) {
    // A one-way street divides its lanes about the centreline instead.
    let w = half / max(lanes, 1.0);
    for (var i = 1.0; i < lanes; i += 1.0) {
      paint = max(paint, stripe(u, -half + i * 2.0 * w, 0.11, mpp)
                       * dashed(v + 4.5, 12.0, 3.0, mpp));
    }
  }
  return paint;
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4f {
  let surf = in.info.x;
  let half = in.info.y;
  let lanes = in.info.z;
  let flags = u32(in.info.w + 0.5);
  let u = in.coord.x;
  let v = in.coord.y;
  let w2 = in.world.xz;
  let mpp = max(max(fwidth(u), fwidth(v)), 1e-5);

  var col : vec3f;
  if (surf < 0.5) {
    col = asphalt(w2, u, half, lanes, mpp);
    let paint = markings(u, v, half, lanes, flags, mpp);
    // Road paint is never white by the time anyone sees it.
    col = mix(col, vec3f(0.46, 0.45, 0.42) * (0.8 + 0.3 * vnoise(w2 * 3.0)), paint * 0.92);
  } else if (surf < 1.5) {
    // The kerb face, which is the one surface always in its own shadow.
    col = concrete(w2, mpp) * 0.72;
  } else if (surf < 2.5) {
    col = concrete(w2, mpp) * 1.06;
  } else if (surf < 3.5) {
    col = footway(w2, u, v, mpp);
  } else if (surf < 4.5) {
    // The junction. No lane lines across it -- they stop at the give-way --
    // but the stop line itself is what makes a junction read as one.
    col = asphalt(w2, 0.0, half, 0.0, mpp);
    // Worn darker towards the middle, where every turning movement crosses.
    col *= 1.0 - (1.0 - smoothstep(0.0, half * 0.8, abs(u))) * 0.06;
  } else if (surf < 5.5) {
    col = concrete(w2, mpp) * 0.96;
  } else {
    col = verge(w2, mpp);
  }

  let n = normalize(in.normal);
  let sun = normalize(camera.sunDir.xyz);
  let ndl = dot(n, sun);
  let lit = shadowFactor(in.world, ndl);
  let ambient = mix(ambientGround(sun), ambientSky(sun), 0.5 + n.y * 0.5);
  col = col * (ambient + sunLight(sun) * max(ndl, 0.0) * lit);

  let toEye = in.world - camera.eye.xyz;
  col = aerial(col, length(toEye), toEye, sun);
  return vec4f(tonemap(col), 1.0);
}
