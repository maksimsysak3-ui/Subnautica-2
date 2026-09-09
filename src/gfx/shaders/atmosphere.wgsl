// The sky, and what distance does to everything seen through it.
//
// Pure functions, no bindings: this is included by the sky pass, by the
// terrain, and by the asset shader, and those three do not agree on what is
// bound at group 0. What they do have to agree on is the colour of the air,
// because the moment they disagree a distant building stops matching the
// horizon behind it and the illusion of depth goes with it.
//
// Not a scattering integral. A city builder needs a sky that is right at a
// glance from a camera that never leaves the ground, and two lobes and a sun
// do that for a hundredth of the cost.

/** Zenith, at the top of the dome. */
const SKY_HIGH = vec3f(0.075, 0.150, 0.360);
/** Horizon, where the air is thickest and the light most scattered. */
const SKY_LOW  = vec3f(0.520, 0.610, 0.740);
/** Below the horizon: haze over ground the map does not extend to. */
const SKY_DOWN = vec3f(0.300, 0.330, 0.360);
/** The sun's own colour, shared with both surface shaders. */
const SUN_COLOUR = vec3f(1.02, 0.94, 0.80);

/**
 * The sky in one direction.
 *
 * `dir` need not be normalised by the caller; `sun` must be. The sun's disc is
 * deliberately a little wider than half a degree -- an exact one is a hard
 * white dot that aliases into a flickering speck the moment the camera moves.
 */
fn skyColour(dir : vec3f, sun : vec3f) -> vec3f {
  let d = normalize(dir);
  let up = clamp(d.y, -1.0, 1.0);

  // Two lobes: a wide one for the body of the sky and a tight one for the band
  // of pale air that sits on the horizon.
  let high = mix(SKY_LOW, SKY_HIGH, pow(clamp(up, 0.0, 1.0), 0.42));
  var col = mix(SKY_DOWN, high, smoothstep(-0.10, 0.02, up));

  // Forward scattering: the whole half of the sky the sun is in is warmer and
  // brighter, not just the disc.
  let towards = clamp(dot(d, sun), 0.0, 1.0);
  col += SUN_COLOUR * pow(towards, 5.0) * 0.22 * (1.0 - smoothstep(0.0, 0.5, up));
  col += SUN_COLOUR * pow(towards, 1400.0) * 9.0;
  return col;
}

/**
 * Aerial perspective: a surface, dimmed and tinted by the air in front of it.
 *
 * `metres` is the distance from the eye. The two-term falloff is doing real
 * work: the near term is what keeps a building three hundred metres away from
 * looking cut out, and the far term is what makes the last kilometre dissolve
 * into the horizon instead of ending at a visible edge.
 */
fn aerial(col : vec3f, metres : f32, dir : vec3f, sun : vec3f) -> vec3f {
  let near = 1.0 - exp(-metres * (1.0 / 2600.0));
  let far = smoothstep(1600.0, 4200.0, metres);
  let haze = clamp(near * 0.62 + far * 0.55, 0.0, 1.0);
  return mix(col, skyColour(dir, sun), haze);
}
