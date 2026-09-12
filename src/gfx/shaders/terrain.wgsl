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
// Cover is chosen by slope and altitude, not painted: grass on the low flats,
// thinner and browner as the ground rises, earth where it steepens enough to
// shed turf, rock on the faces. That survives the player reshaping the
// terrain, which a painted mask would not.
//
// Altitude matters as much as slope and was missing, which is why the hills
// used to read as one green wash: real high ground is drier, thinner and
// stonier than the valley under it whatever its gradient, and a hillside that
// is the same colour as the meadow below it has no relief in it at all.
//
// Two more things run at scales above any of the octaves below. Fields, at
// 190 m, which is what breaks open country into parcels that differ in
// character rather than only in brightness. And the low ground, which is wet:
// the greenest grass on any map is in the bottom of the valley.
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
  /**
   * The three slow fields, sampled per vertex instead of per pixel.
   *
   * x = regional ground, y = soil, z = the hue drift. Their features are
   * twenty-six, forty-six and a hundred and forty metres across and a terrain
   * vertex stands every eight, so interpolating them over a triangle is not an
   * approximation of sampling them per pixel -- there is nothing between two
   * vertices for a per-pixel sample to find. Twelve lattice hashes a pixel,
   * over ground that is most of the screen, become twelve per vertex on a mesh
   * of a few thousand.
   */
  @location(2)       slow   : vec3f,
};

@vertex
fn vs(@location(0) position : vec3f,
      @location(1) normal   : vec3f) -> VSOut {
  var out : VSOut;
  out.world = position;
  out.normal = normal;
  out.slow = vec3f(
    vnoise(position.xz * (1.0 / 46.0)),
    vnoise(position.xz * (1.0 / 140.0) + vec2f(11.3, 4.7)),
    vnoise(position.xz * (1.0 / 26.0) + vec2f(2.7, 8.1)) - 0.5,
  );
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

/** Whether the player owns the plot at these plot coordinates. */
fn ownsPlot(px : i32, pz : i32) -> bool {
  if (px < 0 || pz < 0 || px >= 8 || pz >= 8) { return false; }
  let i = pz * 8 + px;
  let word = select(bitcast<u32>(camera.land.y), bitcast<u32>(camera.land.x), i < 32);
  return (word & (1u << u32(i % 32))) != 0u;
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4f {
  // The weather, once, before anything reads the atmosphere.
  setWeather(camera.weather.x, camera.weather.y);
  setPlanView(camera.land.z);
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
  let ground = in.slow.x;
  let soil = in.slow.y;

  var wear = 0.5;
  if (fWear > 0.0) {
    wear = mix(0.5, vnoise(in.world.xz * (1.0 / 14.0) + vec2f(3.1, 9.4)), fWear);
  }

  // Where this ground sits in the landscape. The city is built around y = 0
  // and the hills reach a couple of hundred metres, so these two ramps leave
  // the built-up flats alone and do their work on the relief around it.
  let alt = smoothstep(26.0, 125.0, in.world.y);
  let wet = 1.0 - smoothstep(-16.0, 7.0, in.world.y);

  // Fields: parcels of open country with their own character, at a scale
  // above every octave below. Without this a square kilometre of grass is one
  // colour with the brightness wobbling, which reads as lighting rather than
  // as land.
  // Two scales, because a parcel of land has a shape as well as a size: the
  // larger sets which fields there are and the smaller breaks their edges so
  // they are not all the same soft blob.
  let field = vnoise(in.world.xz * (1.0 / 190.0) + vec2f(41.0, 17.0)) * 0.72
            + vnoise(in.world.xz * (1.0 / 74.0) + vec2f(7.0, 63.0)) * 0.28;
  let meadow = smoothstep(0.50, 0.70, field) * (1.0 - alt);
  let moor = smoothstep(0.44, 0.22, field);

  // Parcels.
  //
  // Above every octave below sat one smooth blend from meadow to moor, and a
  // smooth blend reads as a gradient rather than as land. Countryside seen from
  // any height a player actually uses is not a gradient: it is *divided* --
  // fields with hard edges, each cut or grazed or left at a different time, and
  // a darker line where one meets the next. That division is the single thing
  // that tells the eye it is looking at ground somebody farms rather than at
  // noise, and it is the scale the camera spends its whole life at.
  //
  // A cell decomposition at about a hundred and thirty metres, warped so the
  // parcels are not all convex blobs, with each one taking its own character
  // from its own id.
  //
  // Faded out beyond about a kilometre, and the fade is tested *before* the
  // work rather than multiplied into it afterwards. Field colour is a texture,
  // and a texture the eye cannot resolve is noise -- at map distance the
  // parcels read as a Voronoi diagram laid over the country rather than as
  // fields in it. Computing two warp octaves and a cell decomposition for
  // every pixel of far ground and then multiplying the answer by zero is the
  // most expensive way to draw nothing, and the ground is most of the screen.
  let parcelFade = 1.0 - smoothstep(700.0, 1900.0, length(camera.eye.xz - in.world.xz));
  var parcel = Cell(1.0, 1.0, 0.0);
  var inField = 1.0;
  if (parcelFade > 0.002) {
    let warp = vec2f(vnoise(in.world.xz * (1.0 / 210.0)) - 0.5,
                     vnoise(in.world.xz * (1.0 / 210.0) + vec2f(37.0, 11.0)) - 0.5);
    parcel = cells(in.world.xz * (1.0 / 132.0) + warp * 0.55);
    // How far into the parcel this is: 0 on the boundary, 1 well inside.
    inField = smoothstep(0.0, 0.055, parcel.d2 - parcel.d1);
  }
  // Each parcel's own state, in three bands that do not blend into each other.
  let cut = fract(parcel.id * 7.13);

  // ---- cover ---------------------------------------------------------
  //
  // Slope decides, with the ground octave pushing the boundary about so the
  // transition is a ragged edge rather than a contour line.
  let slope = 1.0 - clamp(n.y, 0.0, 1.0);
  let ragged = slope + (ground - 0.5) * 0.10 + alt * 0.11;
  let rock  = smoothstep(0.32, 0.58, ragged);
  // Earth appears where the ground is steep enough to shed turf, and in the
  // driest worn patches. The slope threshold has to clear the terrain's own
  // faceting -- one vertex every eight metres means a gentle hill has a real
  // slope at every facet edge, and a threshold under about a fifth put a brown
  // triangle on the side of every mound.
  //
  // Altitude counts towards bare ground as well as slope: turf thins out as it
  // climbs, and a hilltop of unbroken lawn is the one thing that gives a
  // procedural landscape away.
  let worn  = smoothstep(0.64, 0.90, wear * 0.50 + soil * 0.34 + alt * 0.34 - wet * 0.25);
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
  //
  // Both noise terms are centred on a half and the ramp across them used to be
  // wide, which compressed every field on the map into the middle of the mix:
  // the whole map came out one colour. So the spread is opened up about its
  // own mean before the ramp sees it, and the ramp itself is narrower.
  // The 140 m soil octave leads and the 14 m wear only modulates it. Weighting
  // them 62/38 and adding them was the actual bug: averaging two noise fields
  // narrows the distribution instead of widening it, and that is why a square
  // kilometre of grass came out as one colour with the brightness wobbling.
  let damp = clamp((soil - 0.5) * 2.3 + (wear - 0.5) * 0.5 + 0.5
                   + alt * 0.42 - wet * 0.38, 0.0, 1.0);
  let dryness = smoothstep(0.22, 0.82, damp);
  let lush = vec3f(0.040, 0.104, 0.034);
  let dry  = vec3f(0.136, 0.136, 0.056);
  var turf = mix(lush, dry, dryness);
  // Meadow is taller and yellower; moor is the olive-brown of heath and rough
  // grazing. Two named covers rather than a continuum, because a landscape
  // reads as parcelled land and a continuum reads as a gradient.
  turf = mix(turf, vec3f(0.158, 0.146, 0.052), meadow * 0.62);
  turf = mix(turf, vec3f(0.074, 0.070, 0.042), moor * 0.55);

  // The parcel's own colour, applied hard rather than blended, and only inside
  // its boundary -- which is what makes the boundary a boundary.
  //
  // Three states: recently cut and pale, standing and green, left and gone to
  // seed. They are far enough apart to read from a kilometre up, which is where
  // a player spends most of their time, and each is a shift in hue as well as
  // in value so they survive the tonemap.
  let mown = smoothstep(0.68, 0.74, cut);
  let rank = smoothstep(0.28, 0.22, cut);
  turf = mix(turf, mix(turf, vec3f(0.150, 0.139, 0.062), 0.44), mown * inField * parcelFade);
  turf = mix(turf, mix(turf, vec3f(0.052, 0.094, 0.038), 0.36), rank * inField * parcelFade);
  // And a little each way even inside a plain parcel, so no two are identical.
  turf *= 1.0 + (fract(parcel.id * 19.7) - 0.5) * 0.09 * inField * parcelFade;
  // The boundary itself: a hedge line, darker and a shade bluer, the width of
  // a real field margin rather than a drawn line. Faint -- it is a hedge, not
  // a drawn border, and at full strength the map read as a Voronoi diagram.
  let margin = (1.0 - inField) * (1.0 - rock);
  turf = mix(turf, vec3f(0.030, 0.058, 0.030), margin * 0.26 * parcelFade);
  // A slow hue drift across a field, on top of the dryness ramp. Two greens
  // are not enough for a kilometre of grass: without this the whole map is one
  // colour with the brightness wobbling, which reads as lighting rather than
  // as ground.
  let hue = in.slow.z;
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
  let lit = shadowFactor(in.world, ndl);
  let ambient = mix(ambientGround(sun), ambientSky(sun), n.y * 0.5 + 0.5);
  // Wrapped, not clamped. Turf is a deep pile of translucent blades rather
  // than a hard surface, so light carries a little way past the terminator --
  // which is the difference between a hillside that turns away from the sun
  // and one that has a line drawn across it.
  let wrap = max((ndl + 0.18) / 1.18, 0.0);
  col = col * (ambient + sunLight(sun) * wrap * lit);

  // The sheen. Grass and dry earth both scatter forward, so a field lights up
  // when the sun is low and behind what you are looking at -- and that one
  // effect is most of what makes late light read as late light. Broad and
  // weak: this is a sheen off a million blades, not a highlight off a surface.
  let toEye = normalize(camera.eye.xyz - in.world);
  let halfway = normalize(toEye + sun);
  let sheen = pow(max(dot(n, halfway), 0.0), 9.0)
            * (1.0 - smoothstep(0.30, 0.75, sun.y))
            * (grass * 0.55 + earth * 0.30);
  col += sunLight(sun) * sheen * 0.28 * lit;

  // Wet ground.
  //
  // Two things happen when it rains and only one of them is obvious. The
  // obvious one: everything goes darker, because a film of water fills the
  // pores that were scattering light back out. The other one, which is what
  // actually makes it read as wet: the surface becomes specular, so it picks up
  // the sky in a way dry earth never does. Bare earth and rock take more of
  // both than turf does -- grass sheds water and stays green, mud does not.
  let soak = camera.weather.w;
  if (soak > 0.002) {
    let porous = clamp(earth * 0.85 + rock * 0.70 + grass * 0.30, 0.0, 1.0);
    let w = soak * porous;
    col *= mix(1.0, 0.58, w);
    let gloss = pow(max(dot(n, normalize(toEye + sun)), 0.0), 64.0);
    col += (ambientSky(sun) * 0.55 + sunLight(sun) * gloss * lit * 1.6) * w * 0.42;
  }

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

  // The land you own, and the land you could buy.
  //
  // Drawn into the ground rather than as geometry over it, for the same reason
  // the build mark is: a translucent quad at the terrain's own height z-fights
  // with it and one lifted clear of it floats over the hills. This follows
  // every contour by construction.
  //
  // Unowned land is desaturated and darkened rather than tinted a colour --
  // what a player needs to read is "not yours yet", and a wash of blue over a
  // third of the map reads as a different biome. The boundaries are dashed,
  // which is the one convention everybody already knows means a line on a plan
  // rather than a thing on the ground.
  {
    let span = camera.plotGrid.x;
    let origin = camera.plotGrid.yz;
    let cell = (in.world.xz - origin) / span;
    let px = i32(floor(cell.x));
    let pz = i32(floor(cell.y));
    let inside = px >= 0 && pz >= 0 && px < 8 && pz < 8;
    let mine = ownsPlot(px, pz);
    let here = select(-1, pz * 8 + px, inside);
    let strength = camera.land.z;

    // The edge of what you own is drawn whatever tool is in hand: it is the
    // one boundary that governs every other decision, and a player should not
    // have to open a menu to see where their city can go. The rest of the grid
    // -- the squares nobody has bought, the prices, the hover -- only appears
    // when the land tool is up, because sixty-four dashed squares over a city
    // you are trying to look at is a plan, not a view.
    var frontier = 0.0;
    {
      let f0 = fract(cell);
      let d = min(min(f0.x, 1.0 - f0.x), min(f0.y, 1.0 - f0.y));
      // A boundary only where the neighbour across it differs. Sampling the
      // mask on both sides is what stops this drawing a grid over the middle
      // of a block someone owns outright.
      let nx = i32(floor(cell.x + select(-0.5, 0.5, f0.x > 0.5)));
      let nz = i32(floor(cell.y + select(-0.5, 0.5, f0.y > 0.5)));
      let sideX = select(false, ownsPlot(nx, pz), nx >= 0 && nx < 8 && pz >= 0 && pz < 8);
      let sideZ = select(false, ownsPlot(px, nz), nz >= 0 && nz < 8 && px >= 0 && px < 8);
      let crossX = f32(mine != sideX) * (1.0 - smoothstep(0.0, 0.004, min(f0.x, 1.0 - f0.x)));
      let crossZ = f32(mine != sideZ) * (1.0 - smoothstep(0.0, 0.004, min(f0.y, 1.0 - f0.y)));
      frontier = max(crossX, crossZ) * (1.0 - strength);
      // Dashed, in the direction it runs.
      let along = select(cell.x, cell.y, crossZ > crossX);
      frontier *= step(0.34, fract(along * 22.0));
      // Faint, and gone under a low camera: this is a note on the ground, and
      // at street level it would be a painted line across the pavement.
      frontier *= smoothstep(140.0, 420.0, length(camera.eye.xz - in.world.xz));
      let _unused = d;
    }
    col = mix(col, vec3f(0.58, 0.95, 0.74) * 1.5, clamp(frontier, 0.0, 1.0) * 0.5);

    if (strength > 0.0 && !mine) {
      // Off the map entirely, or land not bought: both are "you cannot build
      // here", and saying so the same way is less to learn than two rules.
      // Enough to read as "not yours", not so much that two thirds of the map
      // turns to mud. The first version desaturated hard and darkened hard, and
      // over a distant view with haze already on it the result was a grey field
      // with a grid drawn on it -- which told a player nothing about the land
      // they were being asked to buy.
      let grey = dot(col, vec3f(0.30, 0.59, 0.11));
      col = mix(col, mix(vec3f(grey), col, 0.55) * 0.80, strength * 0.55);
    }
    if (inside && strength > 0.0) {
      // The dashes. Distance to the nearest plot edge, in plot units, against a
      // sawtooth along that edge -- so the line is dashed in the direction it
      // runs rather than being a dotted grid of squares.
      let f = fract(cell);
      let edgeX = min(f.x, 1.0 - f.x);
      let edgeZ = min(f.y, 1.0 - f.y);
      let near = min(edgeX, edgeZ);
      let along = select(cell.x, cell.y, edgeZ < edgeX);
      let dash = step(0.32, fract(along * 26.0));
      let width = 0.006 + 0.010 * step(0.5, strength);
      var line = (1.0 - smoothstep(0.0, width, near)) * dash * strength;
      // The plot under the pointer gets a solid edge and a lift, because the
      // one a click would buy has to be unmistakable among sixty-three others.
      let hot = f32(here == i32(camera.land.w + 0.5));
      line = max(line, (1.0 - smoothstep(0.0, width * 2.2, near)) * hot * strength);
      let ink = select(vec3f(0.62, 0.86, 1.00), vec3f(0.55, 1.00, 0.72), mine);
      col = mix(col, ink * 1.6, clamp(line, 0.0, 1.0) * 0.85);
      col = mix(col, ink * 0.9, hot * strength * 0.10);
    }
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
