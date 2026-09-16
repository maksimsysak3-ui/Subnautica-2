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
  let tint = overlayRamp(s.r / max(have, 0.02));

  if (overlay.mode > 1.5) {
    // Underground: the whole world goes to a dim slate and the mains are lit
    // through it, which is what a utility drawing looks like and reads instantly
    // as "below". The darkening is not conditional on there being a reading --
    // that was the bug that made an unconnected district the *brightest* thing
    // on a power map.
    let ground = bury(col, overlay.strength);
    return ground + tint * (1.9 * overlay.strength * have);
  }

  // Surface: keep the shading, take the hue. A flat wash loses the landscape and
  // with it any sense of where on the map you are looking.
  //
  // And the ground *outside* the reading is drained towards grey, which is the
  // difference between a view and a tint. The traffic ramp is green at its good
  // end and the countryside is green, so a city with free-flowing roads was
  // painting green on green: nothing about the picture said a view was open.
  // Draining the surroundings makes the covered area read as the subject at any
  // point on any ramp.
  let grey = vec3f(dot(col, vec3f(0.299, 0.587, 0.114)));
  let outside = mix(col, grey * 0.82, overlay.strength * 0.6);
  if (have < 0.02) { return outside; }
  let lit = clamp(dot(col, vec3f(0.33)) * 1.5 + 0.35, 0.35, 1.5);
  return mix(outside, tint * lit, overlay.strength * have * 0.86);
}
