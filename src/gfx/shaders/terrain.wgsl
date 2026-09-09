// The ground: grass, earth and rock, computed rather than sampled.
//
// No textures anywhere in this project, and the ground is the hardest place to
// hold that line -- it is the largest surface on screen, it is seen from
// twenty metres and from two kilometres in the same session, and it has no
// silhouette to carry it. What replaces a texture here is a stack of noise
// octaves at scales that mean something physically:
//
//   0.045 m blades      individual leaves, combed, each its own colour
//   0.38 m  tussocks    separate clumps with shaded gaps between them
//   3.50 m  sward       mowing and moisture, the scale the eye reads at 30 m
//   14.0 m  wear        worn and bare ground, what breaks a field up
//   140 m   soil        regional character, what stops a hillside being flat
//
// The contrast falls as the scale rises, which is the opposite of what a naive
// fBm does and is the whole trick: turf is fine-grained and low-contrast, and
// one coarse octave at high contrast turns a field into camouflage. The first
// version of this did exactly that.
//
// Every octave fades out as its features approach pixel size, which is the
// same rule the facade shader follows and for the same reason: a frequency you
// cannot resolve is not detail, it is noise, and the ground is where that
// mistake turns the whole map into grey static on zoom-out. The fade also buys
// back the cost -- from a kilometre up only two of the four octaves are
// evaluated at all.
//
// Cover is chosen by slope, not painted: grass on the flats, earth where the
// ground steepens enough to shed it, rock on the faces. That survives the
// player reshaping the terrain, which a painted mask would not.
//
// The zoning grid stays, because it is what the player builds against, but it
// is drawn as mown lines in the turf and fades out with distance rather than
// glowing over the whole map.

#include "common.wgsl"
#include "atmosphere.wgsl"

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

// ------------------------------------------------------------------- noise

/**
 * An integer lattice hash.
 *
 * Integer rather than the usual fract(sin(dot(...))) because the ground runs
 * to three kilometres from the origin: at blade scale that is a coordinate of
 * twenty thousand, where a float hash has run out of mantissa and the noise
 * visibly repeats. Hashing the floored lattice point as bits does not care how
 * far from the origin it is.
 */
fn lattice(p : vec2i) -> f32 {
  var h = u32(p.x) * 374761393u + u32(p.y) * 668265263u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  h = h ^ (h >> 16u);
  return f32(h) * (1.0 / 4294967296.0);
}

/** Value noise on that lattice, smoothstep-interpolated. Returns 0..1. */
fn vnoise(p : vec2f) -> f32 {
  let i = floor(p);
  let f = p - i;
  let u = f * f * (3.0 - 2.0 * f);
  let c = vec2i(i);
  let a0 = lattice(c);
  let a1 = lattice(c + vec2i(1, 0));
  let b0 = lattice(c + vec2i(0, 1));
  let b1 = lattice(c + vec2i(1, 1));
  return mix(mix(a0, a1, u.x), mix(b0, b1, u.x), u.y);
}

/**
 * Jittered-lattice cellular noise: the nearest seed, and which one it was.
 *
 * Value noise cannot make grass. It is smooth, isotropic and Gaussian, and
 * turf is none of those -- it is a field of separate objects with dark gaps
 * between them and a different colour in every one. Cells give exactly that:
 * `d1` is the distance to the nearest blade or clump, which shades the gaps,
 * and `id` is that blade's own number, which colours it.
 *
 * Nine hashes a call, so it is gated on the octave fades and never runs on
 * ground the camera cannot resolve.
 */
struct Cell {
  /** Distance to the nearest seed, in cell units. */
  d1 : f32,
  /** Distance to the second nearest: the two together find the edges. */
  d2 : f32,
  /** The nearest seed's own hash, 0..1. */
  id : f32,
};

fn cells(p : vec2f) -> Cell {
  let base = floor(p);
  let f = p - base;
  let c0 = vec2i(base);
  var out = Cell(8.0, 8.0, 0.0);
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let c = c0 + vec2i(x, y);
      let h = lattice(c);
      // A second, decorrelated hash for the other axis of the jitter. Reusing
      // one hash for both puts every seed on the cell's diagonal.
      let g = lattice(c + vec2i(7919, 104729));
      let o = vec2f(f32(x), f32(y)) + vec2f(h, g) - f;
      let d = dot(o, o);
      if (d < out.d1) {
        out.d2 = out.d1; out.d1 = d; out.id = h * 0.5 + g * 0.5;
      } else if (d < out.d2) {
        out.d2 = d;
      }
    }
  }
  out.d1 = sqrt(out.d1);
  out.d2 = sqrt(out.d2);
  return out;
}

/**
 * Turns a sample point into the frame a blade lies in.
 *
 * Grass is combed: the blades in one patch lean the same way, and the way they
 * lean drifts across a field. Rotating by a slow direction field and then
 * squashing one axis is what turns round cells into blades, and it is the
 * single largest difference between this and green noise.
 */
fn comb(p : vec2f, scale : f32, stretch : f32) -> vec2f {
  let a = vnoise(p * (1.0 / 7.0)) * 6.28318;
  let c = cos(a);
  let s = sin(a);
  let r = vec2f(p.x * c - p.y * s, p.x * s + p.y * c);
  return vec2f(r.x / scale, r.y / (scale * stretch));
}

/**
 * How much of an octave survives at this pixel size.
 *
 * Zero once a feature is smaller than about two pixels, full once it is
 * comfortably larger. Returning zero rather than a small number matters: the
 * caller skips the octave entirely, which is what keeps a zoomed-out frame
 * from paying for detail nobody can see.
 */
fn octaveFade(feature : f32, mpp : f32) -> f32 {
  // Three pixels before it starts, nine before it is fully in. The obvious
  // thresholds -- one and four -- let an octave through at the exact size
  // where it aliases, and a field of 0.4 m clumps seen at a pixel each is not
  // clumping, it is mottle. Waiting until a feature is properly resolvable is
  // both the better picture and the cheaper one.
  return smoothstep(3.0, 9.0, feature / mpp);
}

// ---------------------------------------------------------------- the grid

/** Anti-aliased grid: 1 where a line crosses this pixel, 0 between lines. */
fn gridLine(xz : vec2f, spacing : f32, d : vec2f) -> f32 {
  let c = xz / spacing;
  let w = abs(fract(c - 0.5) - 0.5) / max(d / spacing, vec2f(1e-6));
  return 1.0 - min(min(w.x, w.y), 1.0);
}

// ------------------------------------------------------------------ ground

@fragment
fn fs(in : VSOut) -> @location(0) vec4f {
  var n = normalize(in.normal);

  // Every derivative taken up front, in uniform control flow, so the octave
  // fades below are free to branch.
  let dxz = vec2f(fwidth(in.world.x), fwidth(in.world.z));
  let mpp = max(max(dxz.x, dxz.y), 1e-6);

  let fBlade = octaveFade(0.045, mpp);
  let fTuft  = octaveFade(0.38, mpp);
  let fSward = octaveFade(3.50, mpp);
  let fWear  = octaveFade(14.0, mpp);

  // Regional character: always evaluated, because at every distance this is
  // the octave doing the work. Two samples at different scales, so a hillside
  // has both a drainage pattern and a soil pattern.
  let ground = vnoise(in.world.xz * (1.0 / 46.0));
  let soil = vnoise(in.world.xz * (1.0 / 140.0) + vec2f(11.3, 4.7));

  var wear = 0.5;
  if (fWear > 0.0) {
    wear = mix(0.5, vnoise(in.world.xz * (1.0 / 14.0) + vec2f(3.1, 9.4)), fWear);
  }

  // ---- cover ---------------------------------------------------------
  //
  // Slope decides, with the ground octave pushing the boundary about so the
  // transition is a ragged edge rather than a contour line.
  let slope = 1.0 - clamp(n.y, 0.0, 1.0);
  let ragged = slope + (ground - 0.5) * 0.10;
  let rock  = smoothstep(0.32, 0.58, ragged);
  // Earth appears where the ground is steep enough to shed turf, and in the
  // driest worn patches. The slope threshold has to clear the terrain's own
  // faceting -- one vertex every eight metres means a gentle hill has a real
  // slope at every facet edge, and a threshold under about a fifth put a brown
  // triangle on the side of every mound.
  let worn  = smoothstep(0.70, 0.92, wear * 0.55 + soil * 0.45);
  let earth = max(smoothstep(0.21, 0.44, ragged), worn) * (1.0 - rock);
  let grass = 1.0 - rock - earth;

  // ---- grass ---------------------------------------------------------
  //
  // Three things stacked, coarsest first, each gated on whether the camera can
  // resolve it:
  //
  //   the sward   3.5 m   mowing, damp hollows, what a lawn reads as at 30 m
  //   tussocks    0.38 m  separate clumps with shaded gaps between them
  //   blades      0.045 m individual leaves, combed, each its own colour
  //
  // Dryness runs the colour, not the brightness: lush turf is blue-green and
  // dry turf is yellow-green, and interpolating between two greens of similar
  // value is what stops a big field looking like one flat paint chip.
  let dryness = clamp(soil * 0.62 + wear * 0.38, 0.0, 1.0);
  let lush = vec3f(0.048, 0.106, 0.038);
  let dry  = vec3f(0.128, 0.132, 0.058);
  var turf = mix(lush, dry, smoothstep(0.22, 0.88, dryness));
  // A slow hue drift across a field, on top of the dryness ramp. Two greens
  // are not enough for a kilometre of grass: without this the whole map is one
  // colour with the brightness wobbling, which reads as lighting rather than
  // as ground.
  let hue = vnoise(in.world.xz * (1.0 / 26.0) + vec2f(2.7, 8.1)) - 0.5;
  turf.r += hue * 0.016;
  turf.g += hue * 0.008;
  turf.b -= hue * 0.006;

  if (fSward > 0.0) {
    let sw = (vnoise(in.world.xz * (1.0 / 3.5) + vec2f(6.2, 1.7)) - 0.5) * fSward;
    turf *= 1.0 + sw * 0.20;
    turf.g += sw * 0.016;
    turf.r -= sw * 0.010;
  }

  // Tussocks. The gap between two clumps is in shadow and the crown of one
  // catches the light, which is most of what gives turf depth at walking
  // distance. Slightly stretched, because a clump is not a circle.
  if (fTuft > 0.0) {
    let t = cells(comb(in.world.xz, 0.38, 1.45));
    // Bright at the crown, dark in the gap, and centred on zero: a term with
    // a positive mean does not add clumping, it just makes the whole field
    // paler, which is exactly what the first version of this did.
    let crown = 0.5 - smoothstep(0.14, 0.78, t.d1);
    turf *= 1.0 + crown * 0.38 * fTuft;
    // Each clump is a little drier or greener than its neighbour.
    turf.g += (t.id - 0.5) * 0.011 * fTuft;
    turf.r += (t.id - 0.5) * 0.020 * fTuft;
  }

  // Blades. Each cell is one leaf: its own length along the comb direction,
  // its own colour, and a hard dark edge where it meets the next.
  if (fBlade > 0.0) {
    let b = cells(comb(in.world.xz, 0.045, 3.1));
    // The gap between blades: a narrow band where the two nearest seeds are
    // equidistant. This is the shadow you see down into a lawn.
    let gap = smoothstep(0.0, 0.09, b.d2 - b.d1);
    // Roughly a tenth of a real sward is dead thatch, and leaving it out is
    // why procedural grass so often reads as plastic. Kept darker than the
    // turf, because dead grass is not bright, it is drab.
    let thatch = smoothstep(0.90, 0.985, b.id);
    var leaf = turf * (0.70 + b.id * 0.60);
    leaf = mix(leaf, vec3f(0.105, 0.088, 0.045), thatch * 0.75);
    // Darkened into the gaps, which is where the depth comes from. Centred
    // like the crown term: the mean of `gap` is high, so the constant has to
    // pay for it or every lawn in the city gets a little brighter.
    leaf *= 0.52 + 0.55 * gap;
    turf = mix(turf, leaf, fBlade);
  }

  // ---- earth ---------------------------------------------------------
  var dirt = mix(vec3f(0.088, 0.062, 0.040), vec3f(0.145, 0.105, 0.068),
                 smoothstep(0.3, 0.8, ground));
  if (fWear > 0.0) {
    dirt *= 1.0 + (wear - 0.5) * 0.34 * fWear;
  }
  if (fBlade > 0.0) {
    // Grit. Sparse and bright rather than smooth noise, which is what
    // aggregate actually looks like underfoot.
    let g = vnoise(in.world.xz * (1.0 / 0.09) + vec2f(19.0, 7.0));
    dirt += vec3f(0.05, 0.046, 0.040) * smoothstep(0.80, 0.98, g) * fBlade;
  }

  // ---- rock ----------------------------------------------------------
  //
  // Banded along world Y, so a cliff reads as bedding planes rather than as
  // grey noise. The band is warped by the coarse octave, or every outcrop on
  // the map lines its strata up at the same heights.
  let bed = fract(in.world.y * 0.42 + ground * 0.9);
  var stone = mix(vec3f(0.086, 0.083, 0.079), vec3f(0.132, 0.126, 0.116),
                  smoothstep(0.15, 0.85, bed));
  if (fTuft > 0.0) {
    // Fracture: sharper than the grass octaves, because rock breaks rather
    // than clumps.
    let frac = vnoise(in.world.xz * (1.0 / 0.55) + vec2f(5.5, 2.2));
    stone *= 1.0 + (smoothstep(0.42, 0.58, frac) - 0.5) * 0.50 * fTuft;
  }

  var col = turf * grass + dirt * earth + stone * rock;

  // ---- the zoning grid ------------------------------------------------
  //
  // Mown into the turf rather than drawn over the map: a darker line in the
  // grass, gone by a few hundred metres, and absent from rock and steep ground
  // where nothing would be laid out anyway.
  let near = 1.0 - smoothstep(0.35, 1.4, mpp);
  let flatness = 1.0 - smoothstep(0.08, 0.28, slope);
  let show = near * flatness * (1.0 - rock);
  if (show > 0.001) {
    let minor = gridLine(in.world.xz, CELL, dxz) * 0.22;
    let major = gridLine(in.world.xz, BLOCK, dxz) * 0.40;
    col = mix(col, col * vec3f(0.62, 0.72, 0.58), max(minor, major) * show);
  }

  // ---- a surface normal with the detail in it -------------------------
  //
  // The geometry is one vertex every eight metres, so without this the ground
  // is a faceted plane wearing a texture. Two extra taps of the tuft octave
  // give a gradient to tilt the normal by, which is what makes the turf catch
  // the sun.
  if (fTuft > 0.0) {
    let scale = 0.38;
    let e = 0.19;
    let h0 = vnoise(in.world.xz * (1.0 / scale));
    let hx = vnoise((in.world.xz + vec2f(e, 0.0)) * (1.0 / scale));
    let hz = vnoise((in.world.xz + vec2f(0.0, e)) * (1.0 / scale));
    // The amplitude is a real height, so grass gets a few centimetres and
    // broken rock gets more.
    let amp = (0.055 * grass + 0.030 * earth + 0.110 * rock) * fTuft;
    let bump = vec3f(-(hx - h0) * amp, e, -(hz - h0) * amp);
    n = normalize(n + normalize(bump) - vec3f(0.0, 1.0, 0.0));
  }

  // ---- light ----------------------------------------------------------
  //
  // The same shape the asset shader uses, so the ground and the buildings
  // standing on it agree about where the sun is and what the sky is worth.
  let sun = normalize(camera.sunDir.xyz);
  let ndl = dot(n, sun);
  let sky = vec3f(0.34, 0.40, 0.50);
  let bounce = vec3f(0.24, 0.21, 0.18);
  let ambient = mix(bounce, sky, n.y * 0.5 + 0.5);
  col = col * (ambient + SUN_COLOUR * max(ndl, 0.0) * 1.15);

  // And the same filmic shoulder, for the same reason: a ground that clipped
  // where the buildings rolled off would read as a different material every
  // time the sun caught it.
  // Air in front of the ground, before the tonemap rather than after it, so
  // the haze is a colour the sky actually is rather than a wash over the top.
  let view = in.world - camera.eye.xyz;
  col = aerial(col, length(view), view, sun);

  // And the same filmic shoulder the buildings use, for the same reason: a
  // ground that clipped where they rolled off would read as a different
  // material every time the sun caught it.
  return vec4f(pow(col / (col + vec3f(0.72)) * 1.42, vec3f(0.9)), 1.0);
}
