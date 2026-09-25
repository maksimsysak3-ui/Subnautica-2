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
#include "overlay.wgsl"
#include "atmosphere.wgsl"
#include "noise.wgsl"

const SURF_ROAD      = 0.0;
const SURF_KERB_FACE = 1.0;
const SURF_KERB_TOP  = 2.0;
const SURF_FOOTWAY   = 3.0;
const SURF_JUNCTION  = 4.0;
const SURF_MEDIAN    = 5.0;
const SURF_VERGE     = 6.0;
const SURF_CROSSING  = 7.0;
const SURF_GRAVEL    = 8.0;
const SURF_SETTS     = 9.0;
const SURF_CONCRETE  = 10.0;
const SURF_CYCLE     = 11.0;
const SURF_SKIRT     = 12.0;
/** A street lamp's column, and the lantern on the end of its arm. */
const SURF_LAMP      = 13.0;
const SURF_LANTERN   = 14.0;

struct VSOut {
  @builtin(position) pos   : vec4f,
  @location(0)       world : vec3f,
  @location(1)       normal: vec3f,
  /**
   * x = metres across from the centreline, y = metres along the road,
   * z = metres to the nearer end of the run, for the stop line at a junction.
   */
  @location(2)       coord : vec3f,
  /** x = surface, y = carriageway half-width, z = lanes each way, w = flags. */
  @location(3) @interpolate(flat) info : vec4f,
};

/**
 * How much of the cross-section's relief to keep, by how thick the ribbon is
 * on screen.
 *
 * A kerb stands fifteen centimetres above the carriageway and the footway
 * behind it twelve, and at a shallow angle those centimetres *occlude the road
 * itself*: what wins the depth test along the ribbon's length is the raised
 * pale edge nearest the camera, not the tarmac behind it. So a road comes out
 * as a band of pavement with the road hidden behind it, down one side.
 *
 * The first attempt at this keyed on distance, and distance is the wrong
 * variable -- which is why it fixed the far view and left the near one alone.
 * How much road a kerb hides is `height / tan(elevation)`: it is set by the
 * angle the camera looks down at, and barely by the range. A road a hundred
 * metres away seen almost edge-on is hit hard; the same road from overhead is
 * not hit at all.
 *
 * What actually matters is how many pixels the ribbon covers across its width,
 * which folds both in: the road's own width, foreshortened by the elevation
 * angle, over the distance. Under a few pixels there is no room to draw a kerb
 * and a carriageway separately, so the relief flattens and the ribbon is one
 * band of road. Over twenty there is, so it keeps every millimetre -- and that
 * now holds at a shallow angle close up, which is where this was still wrong.
 */
fn relief(world : vec3f, half : f32) -> f32 {
  let toEye = camera.eye.xyz - world;
  let dist = max(length(toEye), 1.0);
  // 1 looking straight down at it, towards 0 looking along it.
  let elev = abs(normalize(toEye).y);
  // params.w converts metres-at-a-distance into pixels.
  let pixels = (half * 2.0 * elev) * camera.params.w / dist;
  return smoothstep(5.0, 24.0, pixels);
}

@vertex
fn vs(@location(0) position : vec3f,
      @location(1) normal   : vec3f,
      @location(2) coord    : vec3f,
      @location(3) info     : vec4f,
      @location(4) lift     : f32) -> VSOut {
  var out : VSOut;
  // Flattened about the carriageway plane. The skirt goes with it: it exists
  // to hide a hairline of terrain under the near edge, and at this distance
  // there is no hairline to hide.
  var p = position;
  let keep = relief(position, info.y);
  p.y -= lift * (1.0 - keep);
  out.world = p;
  // The normals flatten too. A kerb face pointing sideways is what makes one
  // side of a distant road bright and the other dark, and once the face has
  // no height left it should not still be lit as though it had.
  out.normal = normalize(mix(vec3f(0.0, 1.0, 0.0), normal, keep));
  out.coord = coord;
  out.info = info;
  out.pos = camera.viewProj * vec4f(p, 1.0);
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
  // A shade lighter than fresh blacktop, so the network reads against grass
  // and roofs from the building camera's height.
  var col = mix(vec3f(0.066, 0.067, 0.073), vec3f(0.104, 0.104, 0.110), grain);

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
  // Darker and a shade warmer than the concrete it is made of. A pavement that
  // has been walked on is not the colour of a fresh precast slab, and taking
  // the slab colour straight was half of why a street read as a grey band from
  // above -- the other half being that the pavement was twice as wide as one.
  var col = concrete(world, mpp) * vec3f(0.80, 0.785, 0.755);
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
  // The endpoints are the terrain's own lush and dry, pulled towards each
  // other: a verge is mown and watered, so it does not reach either extreme,
  // but it has to sit between them or it bands against the grass it meets.
  var col = mix(vec3f(0.048, 0.096, 0.034), vec3f(0.104, 0.122, 0.050), sward);
  col *= 0.86 + blade * 0.34;
  return col;
}

/**
 * Loose stone: a farm track, and the shoulder of one.
 *
 * Two cell fields at different scales rather than noise. Gravel is *stones* --
 * a surface made of discrete things with shadow between them -- and smooth
 * noise reads as mud however it is coloured, which is what the first attempt
 * looked like.
 */
fn gravel(world : vec2f, mpp : f32) -> vec3f {
  let coarse = cells(world / 0.16);
  let fine = cells(world / 0.055);
  let stone = clamp(coarse.d2 - coarse.d1, 0.0, 1.0) * octaveFade(0.16, mpp);
  let grit = clamp(fine.d2 - fine.d1, 0.0, 1.0) * octaveFade(0.055, mpp);
  // Pale dry limestone through to the damp brown underneath.
  var col = mix(vec3f(0.118, 0.106, 0.086), vec3f(0.196, 0.181, 0.152),
                vnoise(world * 0.9));
  // Each stone its own value, and the gaps between them darker.
  col *= 0.80 + stone * 0.42 + grit * 0.16;
  col *= 0.94 + 0.12 * lattice(vec2i(i32(floor(world.x / 0.16)), i32(floor(world.y / 0.16))));
  return col;
}

/**
 * Setts: granite blocks, laid in courses across the way.
 *
 * Across rather than along, because that is how a street is actually set out
 * and it is what stops the surface reading as tiling. Each block takes its own
 * value, and the joints are wide -- the joints are most of what says setts
 * rather than slabs.
 */
fn setts(world : vec2f, u : f32, v : f32, mpp : f32) -> vec3f {
  let pitch = vec2f(0.20, 0.13);
  // Courses offset by half a block, alternating: a running bond.
  let course = floor(v / pitch.y);
  let shift = select(0.0, pitch.x * 0.5, (i32(course) & 1) == 0);
  let cell = vec2f(floor((u + shift) / pitch.x), course);
  let g = vec2f(fract((u + shift) / pitch.x), fract(v / pitch.y));
  let edge = max(1.0 - smoothstep(0.0, mpp * 2.2 / pitch.x + 0.055, min(g.x, 1.0 - g.x)),
                 1.0 - smoothstep(0.0, mpp * 2.2 / pitch.y + 0.075, min(g.y, 1.0 - g.y)));
  let tone = lattice(vec2i(i32(cell.x), i32(cell.y)));
  // Grey granite with a warm and a cool end, which is what a real setted
  // street has -- they were never one quarry.
  var col = mix(vec3f(0.098, 0.094, 0.092), vec3f(0.168, 0.160, 0.150), tone);
  // Domed: a sett is not flat, and the crown catching light is what makes a
  // wet one glitter.
  let dome = 1.0 - max(abs(g.x - 0.5), abs(g.y - 0.5)) * 0.7;
  col *= 0.72 + dome * 0.42;
  col *= 1.0 - edge * 0.46;
  return col;
}

/**
 * Poured concrete, in bays, with the joints between them.
 *
 * The road an industrial estate is built with: pale, jointed every few metres,
 * and stained where the lorries turn.
 */
fn slabRoad(world : vec2f, u : f32, v : f32, mpp : f32) -> vec3f {
  var col = concrete(world, mpp) * 1.34;
  let bay = 4.2;
  let g = fract(v / bay);
  let joint = 1.0 - smoothstep(0.0, mpp * 1.4 / bay + 0.006, min(g, 1.0 - g));
  col *= 1.0 - joint * 0.34;
  col *= 0.95 + 0.10 * lattice(vec2i(0, i32(floor(v / bay))));
  // Tyre tracks: two darker bands where every wheel has run.
  let track = exp(-pow((abs(u) - 1.5) / 0.75, 2.0));
  col *= 1.0 - track * 0.10;
  return col;
}

/**
 * Everything painted on the carriageway.
 *
 * Returns coverage, so the caller can mix towards the paint colour rather than
 * this having to know what colour the road under it is.
 */
/**
 * The arrows down a one-way street.
 *
 * A one-way road that is only marked by what it *lacks* -- no centre line -- is
 * a road a player has to work out. One arrow per lane every twenty metres is
 * how every city in the world says it, and it is two strokes and a shaft.
 *
 * Drawn in the lane's own coordinates, so a three-lane one-way gets three
 * columns of arrows rather than one down the middle of the road.
 */
fn arrows(u : f32, v : f32, half : f32, lanes : f32, mpp : f32) -> f32 {
  let n = max(lanes, 1.0);
  let w = 2.0 * half / n;
  // Which lane this pixel is in, and where it sits across that lane.
  let lane = floor((u + half) / w);
  let mid = -half + (lane + 0.5) * w;
  let du = u - mid;
  // Repeated along the road. The arrow points towards +v, which is the
  // direction of travel on a one-way link.
  let period = 22.0;
  let f = fract(v / period) * period;
  var paint = 0.0;
  // The shaft: three metres of it, behind the head.
  if (f > 1.6 && f < 4.6) {
    paint = max(paint, stripe(du, 0.0, 0.16, mpp));
  }
  // The head: two strokes opening backwards from the point at f = 1.5.
  if (f >= 0.0 && f <= 1.6) {
    let spread = (1.6 - f) * 0.62;
    paint = max(paint, stripe(abs(du), spread, 0.17, mpp));
  }
  // Never over the edge line, and never so wide it reads as a hatch.
  return paint * step(abs(du), min(1.0, w * 0.42));
}

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
    paint = max(paint, arrows(u, v, half, lanes, mpp));
  }
  return paint;
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4f {
  // The weather, once, before anything reads the atmosphere.
  setWeather(camera.weather.x, camera.weather.y);
  let surf = in.info.x;
  let half = in.info.y;
  let lanes = in.info.z;
  let flags = u32(in.info.w + 0.5);
  let u = in.coord.x;
  let v = in.coord.y;
  let w2 = in.world.xz;
  let mpp = max(max(fwidth(u), fwidth(v)), 1e-5);
  // How much road one pixel spans *across* the ribbon, as opposed to along it.
  //
  // These are very different numbers and confusing them is what put a slab of
  // flat grey over roads right in front of the camera. `v` is metres along the
  // road, and looking down a road at a shallow angle one pixel spans tens of
  // them -- so a footprint taken as the larger of the two is enormous for
  // tarmac twenty metres away, and any test against it fires when it should
  // not. It also varies across the picture in a way that looks like nothing
  // else: the grey lifts where the camera happens to look across the road and
  // comes back a few metres further along, which is one patch clearing while
  // the one beside it stays.
  //
  // Anything about the road's *cross-section* -- which is the strips, and the
  // averaging of them -- has to ask this one.
  let mppU = max(fwidth(u), 1e-5);

  var col : vec3f;
  if (surf < 0.5) {
    col = asphalt(w2, u, half, lanes, mpp);
    // Markings fade out as they stop being resolvable.
    //
    // A dashed line whose gaps are under a pixel is not a dashed line, it is a
    // row of flickering dots -- and with edge lines, a centre line and a lane
    // divider per lane all doing it at once, a road seen from any height came
    // out as a mess of sparkle. They now go quietly to nothing once the pixel
    // is wider than the paint, which is the point past which they were only
    // ever adding noise.
    let legible = 1.0 - smoothstep(0.14, 0.48, mpp);
    var paint = markings(u, v, half, lanes, flags, mpp) * legible;
    // The stop line, where the carriageway meets a junction. This is most of
    // what makes a junction read as a junction rather than as a hole in the
    // road: the eye is looking for where it is told to stop.
    let toEnd = in.coord.z;
    let bar = (1.0 - smoothstep(0.30, 0.30 + mpp * 1.5, abs(toEnd - 0.9)))
            * step(0.0, u * select(1.0, -1.0, (flags & 1u) != 0u) + select(0.0, half, (flags & 1u) != 0u));
    paint = max(paint, bar);
    // Road paint is never white by the time anyone sees it.
    col = mix(col, vec3f(0.46, 0.45, 0.42) * (0.8 + 0.3 * vnoise(w2 * 3.0)), paint * 0.92);
  } else if (surf < 1.5) {
    // The kerb face. It is lit by its own normal now rather than by a
    // constant, so this only carries the weathering a vertical face gets.
    col = concrete(w2, mpp) * 0.88;
  } else if (surf < 2.5) {
    col = concrete(w2, mpp) * 1.06;
  } else if (surf < 3.5) {
    col = footway(w2, u, v, mpp);
  } else if (surf < 4.5) {
    // The junction. No lane lines across it -- they stop at the give-way --
    // but the stop line itself is what makes a junction read as one.
    col = asphalt(w2, 0.0, half, 0.0, mpp);
    // Worn darker towards the middle, where every turning movement crosses.
    col *= 1.0 - (1.0 - smoothstep(0.0, half * 0.8, abs(u))) * 0.08;
  } else if (surf < 5.5) {
    col = concrete(w2, mpp) * 0.96;
  } else if (surf < 6.5) {
    col = verge(w2, mpp);
  } else if (surf > 12.5 && surf < 13.5) {
    // A lamp column: galvanised steel, darker down the shaded side, with the
    // faint vertical banding a spun column has.
    col = vec3f(0.132, 0.138, 0.148)
        * (0.86 + 0.28 * vnoise(vec2f(w2.x * 0.4, w2.y * 9.0)));
  } else if (surf > 14.5) {
    // A viaduct: parapet, fascia, soffit and piers. Board-marked concrete,
    // paler than the kerbs, with the formwork lifts showing as faint bands
    // and a stain running down from each deck joint.
    let lifts = 0.94 + 0.06 * step(0.5, fract(in.world.y / 1.2));
    let stain = 1.0 - 0.10 * smoothstep(0.6, 1.0, vnoise(vec2f(w2.x * 0.08 + w2.y * 0.08, in.world.y * 0.15)));
    col = concrete(w2, mpp) * 1.12 * lifts * stain;
  } else if (surf > 13.5) {
    // The lantern. Its albedo barely matters -- what it is for happens after
    // the lighting, below, where it becomes the source of the pool on the road.
    col = vec3f(0.30, 0.29, 0.26);
  } else if (surf > 11.5) {
    // The apron under the ribbon's edge: the cut face of the road bed, seen
    // only where the ground falls away from it. Dark earth, and darker still
    // at the bottom, so where it does show it reads as the shadow under a kerb
    // rather than as a wall of pavement.
    col = mix(vec3f(0.052, 0.044, 0.034), vec3f(0.088, 0.078, 0.060),
              vnoise(w2 * 2.2));
  } else if (surf > 7.5 && surf < 8.5) {
    col = gravel(w2, mpp);
  } else if (surf > 8.5 && surf < 9.5) {
    col = setts(w2, u, v, mpp);
  } else if (surf > 9.5 && surf < 10.5) {
    col = slabRoad(w2, u, v, mpp);
  } else if (surf > 10.5) {
    // A cycle track. Coloured surfacing, because that is what a cycle lane is
    // -- the colour is the segregation -- with the tarmac showing through it
    // where it has worn, and a white edge line against the carriageway.
    let base = asphalt(w2, u, half, 0.0, mpp);
    let worn = 0.62 + 0.38 * vnoise(w2 * 1.3);
    col = mix(base, vec3f(0.126, 0.052, 0.040) * (0.7 + 0.6 * vnoise(w2 * 5.0)),
              0.72 * worn);
    let line = 1.0 - smoothstep(0.0, mpp * 1.4 + 0.02, abs(abs(u) - (half - 0.10)));
    col = mix(col, vec3f(0.46, 0.45, 0.42), line * 0.8 * (1.0 - smoothstep(0.10, 0.34, mpp)));
  } else {
    // A crossing across the mouth of a junction.
    //
    // The bars are pitched off the road's own lane width rather than a
    // constant, so a dual carriageway gets a wider ladder than a lane does --
    // which is what tells the eye how many lanes are running through the
    // junction without a single lane line being drawn across it.
    col = asphalt(w2, u, half, 0.0, mpp);
    let laneW = half / max(lanes, 1.0);
    let pitch = clamp(laneW * 0.52, 0.55, 1.30);
    let f = abs(fract(u / pitch) - 0.5) * pitch * 2.0;
    // Worn: a crossing is the most driven-over paint on a road, and fresh
    // white bars are the giveaway that a junction was stamped rather than used.
    let wear = 0.55 + 0.45 * vnoise(w2 * 1.7);
    let bar = (1.0 - smoothstep(pitch * 0.46, pitch * 0.46 + mpp * 1.6, f))
            * (1.0 - smoothstep(half - 0.45, half - 0.08, abs(u)));
    col = mix(col, vec3f(0.52, 0.51, 0.47) * (0.72 + 0.36 * vnoise(w2 * 3.0)),
              bar * wear * 0.94);
  }

  // Seen from far enough that one pixel spans more than one strip of it.
  //
  // The ribbon is built as strips across its width -- carriageway, kerb face,
  // kerb top, footway -- each with its own material and its own normal, and
  // nothing mips them. Once a pixel is wider than a strip, the shader returns
  // whichever strip its single sample happened to land on, and a road running
  // to the horizon becomes a shimmer of pale pavement and dark tarmac: it
  // reads as a dashed white line rather than as a road. That is the whole of
  // the "roads are half grey from far away" problem, and it is neither the
  // skirt nor the terrain under it -- both were ruled out by rendering with
  // each removed and getting the same picture.
  //
  // A mip level would return the average of what it covers, so this does: past
  // about a metre a pixel, every strip fades to what the full width comes to,
  // which is mostly carriageway with a fringe of pavement either side. The
  // normal goes with it -- a kerb face pointing sideways is a strip too, and
  // its lighting shimmers for exactly the same reason.
  // Now that the geometry flattens on its own, this only has to blend colour
  // once a pixel genuinely covers more than one strip across the width. A
  // street's footway is two metres and its carriageway seven, so a pixel
  // spanning more than about a metre across is mixing them whatever it does.
  // Never a viaduct's structure: its faces are not strips of a road surface.
  let coarse = smoothstep(1.20, 3.50, mppU) * select(1.0, 0.0, surf > 14.5);
  if (coarse > 0.0) {
    let mean = mix(asphalt(w2, 0.0, half, 0.0, mpp), concrete(w2, mpp) * 0.80, 0.28);
    col = mix(col, mean, coarse);
  }

  var n = normalize(in.normal);
  n = normalize(mix(n, vec3f(0.0, 1.0, 0.0), coarse));
  let sun = normalize(camera.sunDir.xyz);
  let ndl = dot(n, sun);
  let lit = shadowFactor(in.world, ndl);
  // A kerb face looks sideways and sees half as much sky as the footway above
  // it, which is the whole reason a kerb reads as a step rather than a line.
  let ambient = mix(ambientGround(sun), ambientSky(sun), 0.5 + n.y * 0.5);
  col = col * (ambient + sunLight(sun) * max(ndl, 0.0) * lit);

  // Street lighting.
  //
  // What a lit street looks like is not a chain of orange ellipses. It is a
  // carriageway lit nearly evenly, brightest under each lantern and dipping
  // between them, in white or warm-white light -- because a modern luminaire is
  // a full cut-off LED that throws its light down the road and overlaps the
  // next one's. The old pool was one smoothstepped ellipse per lamp, mostly
  // additive, all sodium orange: a painted decal rather than light.
  //
  // So each point sums the four lamps around it, and each lamp is a point
  // source at its lantern's height with the falloff a real one has on the
  // ground: cos^3 of the angle off vertical over the height squared (the
  // inverse square law and the tilt of the surface together), times a beam
  // that throws further along the road than across it. The light then
  // multiplies what it lands on, which is the only way a road reads as lit
  // rather than as glowing -- markings, setts and kerbs all show through it.
  //
  // The colour follows the road. An arterial is the cool white a highway
  // authority fits; a street is warm white; a lane of gravel or setts keeps
  // the sodium orange of the lights nobody has got round to replacing.
  let spacing = f32(flags >> 8u);
  let night = 1.0 - smoothstep(-0.06, 0.14, sun.y);
  var lampTint = vec3f(1.00, 0.80, 0.56);
  if (lanes >= 2.5) { lampTint = vec3f(0.94, 0.94, 1.00); }
  if (surf > 7.5 && surf < 9.5) { lampTint = vec3f(1.00, 0.62, 0.26); }
  if (surf > 13.5 && surf < 14.5) {
    // The lantern: the source, bright enough to bloom but no longer a beacon.
    col = mix(col, lampTint * 4.2, night);
  }
  if (spacing > 0.5 && night > 0.004) {
    let height = 5.0;
    let reach = min(2.1, half * 0.42);
    let first = floor(v / spacing) - 1.0;
    var light = 0.0;
    var gloss = 0.0;
    for (var k = 0; k < 4; k++) {
      let idx = first + f32(k);
      let along = v - idx * spacing;
      let side = select(-1.0, 1.0, (i32(idx) & 1) == 0);
      let across = u - side * (half * 1.06 - reach);
      // The beam: wider along the road than across it.
      let r2 = across * across * 1.45 + along * along * 0.42;
      let c = height * inverseSqrt(height * height + r2);
      // Each lamp its own: a few per cent brighter or dimmer, and the odd one
      // failing. A row of identical lights is what gives a street away as
      // generated.
      let rnd = lattice(vec2i(i32(idx), i32(spacing * 13.0 + half * 7.0)));
      let output = select(0.86 + rnd * 0.28, 0.18, rnd > 0.965);
      light += c * c * c * c * output;
      gloss += pow(c, 40.0) * output;
    }
    let lamplit = lampTint * light * night;
    // Mostly multiplicative, with a whisper of scatter in the air over it.
    col += col * lamplit * 9.0 + lamplit * 0.012;
    // A wet road is a mirror, and the mirror shows the lamp: a hot spot under
    // each lantern, which is most of what makes a rainy night street.
    col += lampTint * gloss * night * camera.weather.w * 0.9;
  }

  // Wet tarmac.
  //
  // This is where rain is most visible in a city and where the shading has the
  // most to gain: dry asphalt is nearly matt, and wet asphalt is a mirror with
  // the road markings showing through it. So the specular goes up hard, and it
  // reflects the sky rather than a white highlight -- at dusk a wet road is
  // orange, and that is the whole reason anyone photographs one.
  //
  // Kerbs and footways take less: they are rougher, and they drain.
  let soak = camera.weather.w;
  if (soak > 0.002) {
    // How much a surface shines when it is wet. Sealed tarmac is a mirror;
    // setts are a mirror with the joints still matt; gravel drains and never
    // shines at all, which is most of what tells a wet track from a wet road.
    var porosity = 0.55;
    if (surf == SURF_ROAD || surf == SURF_JUNCTION || surf == SURF_CROSSING
        || surf == SURF_CYCLE) { porosity = 1.0; }
    else if (surf == SURF_SETTS) { porosity = 0.86; }
    else if (surf == SURF_CONCRETE) { porosity = 0.62; }
    else if (surf == SURF_GRAVEL) { porosity = 0.12; }
    let w = soak * porosity;
    col *= mix(1.0, 0.52, w);
    let toSun = normalize(camera.eye.xyz - in.world);
    let gloss = pow(max(dot(n, normalize(toSun + sun)), 0.0), 180.0);
    // The sky in the mirror direction, which is what a wet road actually shows.
    let mirror = reflect(-toSun, n);
    // Wet road only, and a wet road means the sky is a grey lid, so the
    // detail the full sky adds is not in the reflection to begin with.
    col += skyBody(mirror, sun) * w * 0.34;
    col += sunLight(sun) * gloss * lit * w * 2.6;
  }

  let toEye = in.world - camera.eye.xyz;
  col = aerial(col, length(toEye), toEye, sun);

  // The information overlay. On the carriageway rather than only the land
  // beside it, because every reading in the game is measured along the streets
  // -- and a utility main is under this exact surface.
  col = overlayTint(col, in.world);

  // A road that has not been built yet: the same geometry, said differently.
  // Tinted rather than outlined, because what a player is judging is where the
  // carriageway will sit against what is already there, and an outline hides
  // exactly that. Chosen at the end rather than returned early -- the shadow
  // lookup above has to stay in uniform control flow.
  let proposal = mix(vec3f(0.12, 0.34, 0.46), vec3f(0.42, 0.76, 0.92),
                     clamp(col.r * 5.0, 0.0, 1.0));
  return vec4f(sceneOut(select(col, proposal, (flags & 8u) != 0u)), 1.0);
}
