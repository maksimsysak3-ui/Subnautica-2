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
const SURF_CROSSING  = 7.0;
const SURF_GRAVEL    = 8.0;
const SURF_SETTS     = 9.0;
const SURF_CONCRETE  = 10.0;
const SURF_CYCLE     = 11.0;

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

@vertex
fn vs(@location(0) position : vec3f,
      @location(1) normal   : vec3f,
      @location(2) coord    : vec3f,
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
    let legible = 1.0 - smoothstep(0.10, 0.34, mpp);
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

  let n = normalize(in.normal);
  let sun = normalize(camera.sunDir.xyz);
  let ndl = dot(n, sun);
  let lit = shadowFactor(in.world, ndl);
  // A kerb face looks sideways and sees half as much sky as the footway above
  // it, which is the whole reason a kerb reads as a step rather than a line.
  let ambient = mix(ambientGround(sun), ambientSky(sun), 0.5 + n.y * 0.5);
  col = col * (ambient + sunLight(sun) * max(ndl, 0.0) * lit);

  // Street lighting, as light rather than as lamp posts.
  //
  // The road already knows how far apart its columns stand -- the mesh builder
  // has been working it out and throwing it away since the day it was written.
  // What a player sees of a lit street from anywhere above walking height is
  // not the poles, it is the chain of warm pools down the carriageway and the
  // way they run out into the dark between. A thousand lamp instances draw the
  // poles and cost a thousand instances; this draws the light, for a fract and
  // a smoothstep, and it reads from a kilometre up where a five-metre pole is
  // a third of a pixel.
  //
  // Alternating sides, matching the spacing the mesh builder uses, because a
  // real street staggers them and a single row down one side reads as an
  // airport runway.
  let spacing = f32(flags >> 8u);
  if (spacing > 0.5) {
    let night = 1.0 - smoothstep(-0.06, 0.14, sun.y);
    if (night > 0.004) {
      // Which lamp is nearest along the road, and which side it stands on.
      let idx = floor(v / spacing + 0.5);
      let along = v - idx * spacing;
      let side = select(-1.0, 1.0, (i32(idx) & 1) == 0);
      let post = vec2f(side * half * 1.06, 0.0);
      let d = vec2f(u, along) - post;
      // An ellipse, longer along the road than across it: a lamp throws down
      // the street, not sideways. Two terms -- a bright core under the lantern
      // and a wide spill -- because one Gaussian is a spotlight and a street
      // lamp is not a spotlight.
      let r = vec2f(d.x / (half * 1.5 + 3.0), d.y / (spacing * 0.62));
      let fall = exp(-dot(r, r) * 2.6);
      let core = exp(-dot(vec2f(d.x / 3.4, d.y / 3.4), vec2f(d.x / 3.4, d.y / 3.4)) * 1.4);
      // Sodium, not white. The colour is half of what says street lamp.
      let glow = vec3f(1.00, 0.72, 0.36) * (fall * 0.55 + core * 0.42) * night;
      // Lands on what is under it, and lands hard.
      //
      // The first pass at this multiplied the surface by the light, which is
      // physically the right shape and visually nothing at all: a night road
      // reflects about one part in eighty, so lighting it by its own albedo
      // leaves it as dark as it started. A lamp is one of the few genuinely
      // bright things in a night frame and has to be treated as one -- most of
      // the term is additive, which is also what a real sodium lamp looks like
      // through the dust and damp over a road.
      col += col * glow * 3.0 + glow * 0.62;
    }
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

  // A road that has not been built yet: the same geometry, said differently.
  // Tinted rather than outlined, because what a player is judging is where the
  // carriageway will sit against what is already there, and an outline hides
  // exactly that. Chosen at the end rather than returned early -- the shadow
  // lookup above has to stay in uniform control flow.
  let proposal = mix(vec3f(0.12, 0.34, 0.46), vec3f(0.42, 0.76, 0.92),
                     clamp(col.r * 5.0, 0.0, 1.0));
  return vec4f(tonemap(select(col, proposal, (flags & 8u) != 0u)), 1.0);
}
