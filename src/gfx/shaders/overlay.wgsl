/**
 * The information overlay: a view's readings, as something the ground can sample.
 *
 * Its own file rather than part of common.wgsl because it claims group 1, and so
 * do the grass pass and the culling pass -- for different things. WebGPU only
 * objects to a clash when one entry point reaches both, so having all three in
 * every shader would work right up until somebody used the overlay from the grass
 * shader and got an error naming neither. Included only where it is bound.
 *
 * Always bound where it is declared, even with no view open, because a pipeline
 * that declares a group must have one -- and a `mode` of zero costs one compare
 * per fragment, which is cheaper than two pipelines and two draw paths.
 */

struct Overlay {
  // 0 off, 1 a wash over the surface, 2 the world darkened and the network lit.
  mode: f32,
  // Metres across the whole grid, for turning a world position into a texel.
  extent: f32,
  // How strongly to tint, 0 to 1.
  strength: f32,
  // Metres across the whole surface map. Survives a view being closed, because
  // the ground's surfaces are not a view.
  cells: f32,
  // The ends and middle of the colour ramp.
  lo: vec4f,
  mid: vec4f,
  hi: vec4f,
};

@group(1) @binding(0) var overlayTex: texture_2d<f32>;
@group(1) @binding(1) var overlaySampler: sampler;
@group(1) @binding(2) var<uniform> overlay: Overlay;
// What the ground is made of: r paving, g yard, b garden, a park. All zero is
// open country. One texel per zoning cell, filtered, so a boundary between two
// surfaces is a metre or two wide rather than a staircase of eight-metre steps.
@group(1) @binding(3) var surfaceTex: texture_2d<f32>;

/** The surface weights under a world position. Zero everywhere off the map. */
fn surfaceAt(world : vec3f) -> vec4f {
  if (overlay.cells <= 0.0) { return vec4f(0.0); }
  let uv = world.xz / overlay.cells + vec2f(0.5);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { return vec4f(0.0); }
  return textureSampleLevel(surfaceTex, overlaySampler, uv, 0.0);
}

/**
 * How much of its colour a perfectly good reading still gets.
 *
 * Not zero: a coverage map has to show where the coverage *is* as well as where
 * it is not, and a district that is entirely fine should read as a district that
 * has been looked at. A fifth is enough to see and little enough to ignore.
 */
const QUIET = 0.20;

// The ramp: bad at nothing, middling in the middle, good at one. Two mixes rather
// than a gradient texture, because three stops is all a legend can explain and a
// player reading a map wants to know which of three things they are looking at.
fn overlayRamp(v: f32) -> vec3f {
  let t = clamp(v, 0.0, 1.0);
  let low = mix(overlay.lo.rgb, overlay.mid.rgb, clamp(t * 2.0, 0.0, 1.0));
  let high = mix(overlay.mid.rgb, overlay.hi.rgb, clamp(t * 2.0 - 1.0, 0.0, 1.0));
  return select(low, high, t > 0.5);
}

// Tints a colour by the reading at a world position. Returns it unchanged where
// there is no view open.
fn overlayTint(col: vec3f, world: vec3f) -> vec3f {
  if (overlay.mode < 0.5) { return col; }
  let uv = world.xz / overlay.extent + vec2f(0.5);
  let inside = uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0;
  var s = vec4f(0.0);
  if (inside) { s = textureSampleLevel(overlayTex, overlaySampler, uv, 0.0); }
  // The coverage channel is what keeps the edges honest: filtering blends a real
  // reading towards zero at the boundary of the data, and without this the tint
  // would darken into a fringe round every district instead of fading out.
  let have = s.g;
  if (overlay.mode > 1.5) {
    let deep = overlayRamp(s.r / max(have, 0.02));
    // Underground: the whole world goes to a dim slate and the mains are lit
    // through it, which is what a utility drawing looks like and reads instantly
    // as "below". The darkening is not conditional on there being a reading --
    // that was the bug that made an unconnected district the *brightest* thing
    // on a power map.
    let ground = bury(col, overlay.strength);
    return ground + deep * (1.9 * overlay.strength * have);
  }

  // Surface.
  //
  // THE VIEWS USED TO SHOUT AT THE GOOD NEWS. Every reading got the same wash
  // whatever it said, so a city with no congestion at all was painted in solid
  // neon green from edge to edge and a city with a jam looked much the same
  // except redder in one place. A map that colours everything equally is a map
  // that says nothing -- the player's eye has nowhere to go, and what they see
  // is "colours swarming" rather than information.
  //
  // So attention is the thing being drawn. A reading at the good end gets a
  // whisper of its colour, enough to say the data reaches here; a bad one gets
  // the full wash. The eye lands on the problem without being told where it is.
  let t = clamp(s.r / max(have, 0.02), 0.0, 1.0);
  let hue = overlayRamp(t);
  let attention = 1.0 - t;
  // Not squared. Squaring made a middling reading nearly invisible, which is
  // the one a player most needs to see -- a district at a third of what it
  // should have is the district to go and fix.
  let weight = QUIET + (1.0 - QUIET) * pow(attention, 1.4);

  // And the ground outside the reading is drained a little towards grey, which
  // is the difference between a view and a tint: the traffic ramp is green at
  // its good end and the countryside is green, so without this a city with
  // free-flowing roads painted green on green. Gently -- at full strength this
  // turned the whole landscape a dead sickly colour, which is most of what made
  // the views unpleasant to have open.
  let grey = vec3f(dot(col, vec3f(0.299, 0.587, 0.114)));
  let outside = mix(col, grey * 0.90, overlay.strength * 0.55);
  if (have < 0.02) { return outside; }
  // Keep the shading, take the hue. A flat wash loses the landscape and with it
  // any sense of where on the map you are looking.
  let lit = clamp(dot(col, vec3f(0.33)) * 1.5 + 0.35, 0.35, 1.5);
  return mix(outside, hue * lit, overlay.strength * have * weight);
}
