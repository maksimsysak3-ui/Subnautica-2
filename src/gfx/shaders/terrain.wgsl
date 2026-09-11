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
#include "noise.wgsl"

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
  // Only while a build tool is in hand. A lattice mown into the turf every
  // eight metres is exactly what a player wants when they are laying something
  // out against it, and exactly what they do not want the rest of the time --
  // at the default camera the fade below still had it at four fifths strength
  // over the whole map, which turned a kilometre of countryside into graph
  // paper. That was most of what was wrong with the ground.
  //
  // The cell lines are also held back further than the block lines now. Eight
  // metres is under a pixel and a half at the distance a city is usually
  // watched from, and a line that cannot be resolved is not guidance, it is
  // noise on top of the grass.
  let flatness = 1.0 - smoothstep(0.08, 0.28, slope);
  let show = camera.markTint.w * flatness * (1.0 - rock);
  if (show > 0.001) {
    let minor = gridLine(in.world.xz, CELL, dxz) * 0.18
              * (1.0 - smoothstep(0.10, 0.40, mpp));
    let major = gridLine(in.world.xz, BLOCK, dxz) * 0.34
              * (1.0 - smoothstep(0.60, 2.20, mpp));
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
  let ambient = mix(ambientGround(sun), ambientSky(sun), n.y * 0.5 + 0.5);
  col = col * (ambient + sunLight(sun) * max(ndl, 0.0) * shadowFactor(in.world, ndl));

  // And the same filmic shoulder, for the same reason: a ground that clipped
  // where the buildings rolled off would read as a different material every
  // time the sun caught it.
  // What the build tool is about to do to this ground.
  //
  // Drawn into the surface rather than as geometry hovering over it: a
  // translucent quad at the terrain's own height z-fights with it, and one
  // lifted clear of it floats. A tint with a bright edge reads as a marked
  // area at every camera angle and costs four comparisons.
  if (camera.markTint.w > 0.0) {
    let m = camera.mark;
    let inside = f32(in.world.x >= m.x && in.world.x <= m.z
                  && in.world.z >= m.y && in.world.z <= m.w);
    // The edge: within a metre and a bit of any side of the rectangle.
    let edge = inside * (1.0 - smoothstep(0.0, 1.6, min(
      min(in.world.x - m.x, m.z - in.world.x),
      min(in.world.z - m.y, m.w - in.world.z))));
    col = mix(col, camera.markTint.rgb * 0.5, inside * camera.markTint.w * 0.34);
    col = mix(col, camera.markTint.rgb * 2.2, edge * camera.markTint.w);
  }

  // Air in front of the ground, before the tonemap rather than after it, so
  // the haze is a colour the sky actually is rather than a wash over the top.
  let view = in.world - camera.eye.xyz;
  col = aerial(col, length(view), view, sun);

  // And the same filmic shoulder the buildings use, for the same reason: a
  // ground that clipped where they rolled off would read as a different
  // material every time the sun caught it.
  return vec4f(tonemap(col), 1.0);
}
