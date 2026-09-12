// The sky, the light that comes out of it, and what distance does to
// everything seen through it.
//
// No bindings: this is included by the sky pass, by the terrain and by the
// asset shader, and those three do not agree on what is bound at group 0. What they do have to agree on is the sun and the colour
// of the air, because the moment they disagree the ground is lit for one time
// of day and the buildings standing on it for another.
//
// Everything here is a function of the sun's own direction. That is the whole
// design: there is no separate "time of day" parameter to keep in step with
// anything, because the only thing that changes over a day is where the sun
// is, and every colour in the scene is derived from it. Move the sun and the
// sky, the light, the shadows and the haze all follow by construction.
//
// Not a scattering integral. A city builder needs a sky that is right at a
// glance from a camera that never leaves the ground, and a handful of lobes
// keyed to the sun's elevation does that for a hundredth of the cost.

// ---- the weather -------------------------------------------------------
//
// A private global rather than a parameter on all sixteen call sites below.
//
// The weather is ambient scene state, exactly as the sun is -- every surface
// in the frame has to agree about it or the ground is overcast while the
// buildings standing on it are in sunshine, which is the failure this file's
// header exists to prevent. Threading it through as a parameter would say the
// same thing sixteen times and let one of them be forgotten.
//
// Each fragment entry point sets it once, from its own uniform, before it
// touches anything here. Anything that does not -- a vertex stage, the icon
// renderer -- gets the default, which is a clear day. That is the right answer
// for a photograph of a building, and it is why this is the zero value.
//
//   x -- cloud cover: 0 open sky, 1 solid overcast.
//   y -- fog: extra air between the eye and everything, 0 to 1.
struct Weather {
  cover : f32,
  fog   : f32,
}

var<private> weather : Weather = Weather(0.0, 0.0);

fn setWeather(cover : f32, fog : f32) {
  weather.cover = clamp(cover, 0.0, 1.0);
  weather.fog = clamp(fog, 0.0, 1.0);
}

/**
 * The colour an overcast sky and the light under it tend towards.
 *
 * Not grey. An overcast sky is a diffuser lit from behind by the sun, so it
 * keeps the sun's own colour and loses its direction -- which is why an
 * overcast afternoon is silver and an overcast dusk is still orange, just
 * flat. A fixed grey would have made every weather in the game noon.
 */
fn overcastTint(sun : vec3f) -> vec3f {
  let p = dayPhase(sun);
  let lit = max(p.x, p.y * 0.9);
  let warm = mix(vec3f(0.60, 0.62, 0.66), vec3f(0.52, 0.40, 0.36), p.y);
  return mix(vec3f(0.052, 0.060, 0.078), warm, lit);
}

// ---- palettes, at the three times of day that have their own colour ------

const DAY_HIGH   = vec3f(0.055, 0.125, 0.340);
const DAY_LOW    = vec3f(0.500, 0.600, 0.750);
/** Low sun: the zenith holds while the horizon goes to fire. */
const DUSK_HIGH  = vec3f(0.085, 0.090, 0.180);
const DUSK_LOW   = vec3f(0.720, 0.330, 0.150);
const NIGHT_HIGH = vec3f(0.0045, 0.0075, 0.0180);
const NIGHT_LOW  = vec3f(0.0180, 0.0250, 0.0480);

/** Below the horizon: haze over ground the map does not extend to. */
const DAY_DOWN   = vec3f(0.300, 0.330, 0.360);
const NIGHT_DOWN = vec3f(0.012, 0.014, 0.020);

/**
 * How far through the day the sun is.
 *
 * x -- 0 at night, 1 when the sun is properly up.
 * y -- 1 when the sun is on the horizon, falling off either side. This is the
 *      golden hour, and it is a separate term rather than a point on the day
 *      ramp because dawn light is not dim daylight, it is a different colour.
 */
fn dayPhase(sun : vec3f) -> vec2f {
  let up = sun.y;
  let day = smoothstep(-0.09, 0.22, up);
  let low = exp(-pow((up - 0.03) / 0.15, 2.0));
  return vec2f(day, low);
}

/** The sun's own colour, reddened as it drops. Zero once it has set. */
fn sunLight(sun : vec3f) -> vec3f {
  let p = dayPhase(sun);
  let high = vec3f(1.02, 0.96, 0.86);
  let low = vec3f(1.10, 0.52, 0.24);
  let clear = mix(high, low, p.y * 0.92) * smoothstep(-0.045, 0.09, sun.y) * 1.15;
  // Cover takes the direct sun out, and with it the shadows. It does not take
  // it all: even under a solid deck there is a brighter half of the sky, and a
  // scene with no directional term at all goes completely flat.
  return clear * (1.0 - weather.cover * 0.88);
}

/** Skylight from above: the dominant ambient term, and blue. */
fn ambientSky(sun : vec3f) -> vec3f {
  let p = dayPhase(sun);
  // Moonlight, not darkness.
  //
  // Physically a moonlit night is about a four-hundred-thousandth of daylight,
  // and at that figure a 0.08-albedo road under this term comes out at 0.002 --
  // black after the tonemap, which is exactly what it did. Every game cheats
  // here and this one does too: enough of a cool floor that the ground, the
  // kerbs and the parked cars are all still readable, while the lit windows
  // stay far and away the brightest thing in the frame.
  let night = vec3f(0.150, 0.178, 0.250);
  let dawn = vec3f(0.240, 0.230, 0.290);
  let noon = vec3f(0.340, 0.400, 0.500);
  let clear = mix(night, mix(noon, dawn, p.y * 0.75), p.x);
  // Under cover the sky becomes the light. The whole dome is the source, so
  // the ambient goes up as the sun goes out -- which is why an overcast day is
  // shadowless rather than dark, and why a photograph taken under one needs
  // less exposure than the sky suggests.
  return mix(clear, overcastTint(sun) * 1.22, weather.cover);
}

/** Bounce from the ground: warmer, weaker, and what fills the undersides. */
fn ambientGround(sun : vec3f) -> vec3f {
  let p = dayPhase(sun);
  let night = vec3f(0.094, 0.098, 0.118);
  let lit = vec3f(0.240, 0.210, 0.180);
  let clear = mix(night, mix(lit, vec3f(0.230, 0.150, 0.110), p.y * 0.6), p.x);
  // The ground bounces less when there is less on it to bounce, and wet ground
  // bounces less still.
  return mix(clear, overcastTint(sun) * 0.52, weather.cover);
}

/**
 * Stars.
 *
 * A hash on a quantised direction, threshold high so they are sparse, and
 * faded out the moment the sky has any daylight in it. Cheap, and the
 * difference between a night sky and a dark grey wall.
 */
fn stars(d : vec3f, night : f32) -> vec3f {
  if (night <= 0.001 || d.y < 0.0) { return vec3f(0.0); }
  let cell = floor(d * 340.0);
  var h = u32(i32(cell.x)) * 374761393u + u32(i32(cell.y)) * 668265263u
        + u32(i32(cell.z)) * 2654435761u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  let r = f32(h ^ (h >> 16u)) * (1.0 / 4294967296.0);
  let mag = smoothstep(0.9975, 1.0, r);
  // A little colour: real stars are not all white, and a field of identical
  // white dots reads as dust on the screen.
  let tint = mix(vec3f(0.78, 0.86, 1.0), vec3f(1.0, 0.88, 0.72), fract(r * 91.7));
  return tint * mag * night * smoothstep(0.0, 0.22, d.y) * 2.4;
}

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
  let p = dayPhase(sun);

  // Two lobes: a wide one for the body of the sky and a tight one for the
  // band of pale air that sits on the horizon.
  //
  // Weighted by `lit` rather than by the day ramp. Twilight is the one time
  // the sky is worth looking at and it happens with the sun below the
  // horizon, so gating the warm palette on daylight suppressed it exactly
  // when it should have been strongest -- which is what the first version did:
  // sunrise came out as a slightly grey night.
  let lit = max(p.x, p.y * 0.92);
  let t = pow(clamp(up, 0.0, 1.0), 0.42);
  let dayCol = mix(mix(DAY_LOW, DUSK_LOW, p.y), mix(DAY_HIGH, DUSK_HIGH, p.y * 0.7), t);
  let nightCol = mix(NIGHT_LOW, NIGHT_HIGH, t);
  let above = mix(nightCol, dayCol, lit);
  let below = mix(NIGHT_DOWN, DAY_DOWN, lit);
  var col = mix(below, above, smoothstep(-0.10, 0.02, up));

  // No stars through cloud.
  col += stars(d, (1.0 - max(p.x, p.y * 0.8)) * (1.0 - weather.cover));

  // Forward scattering: the whole half of the sky the sun is in is warmer and
  // brighter, not just the disc. At sunrise this is most of the sky.
  let towards = clamp(dot(d, sun), 0.0, 1.0);
  let glow = mix(vec3f(1.00, 0.90, 0.72), vec3f(1.05, 0.46, 0.20), p.y);
  col += glow * pow(towards, 5.0) * (0.20 + p.y * 1.15) * lit
       * (1.0 - smoothstep(0.0, 0.55, up));
  // A band of fire along the horizon in the sun's half of the sky. Twilight is
  // not a glow around a point, it is a lit edge to the world.
  col += glow * pow(clamp(dot(normalize(vec3f(d.x, 0.0, d.z)), normalize(vec3f(sun.x, 0.0, sun.z))), 0.0, 1.0), 2.2)
       * p.y * 0.55 * (1.0 - smoothstep(-0.02, 0.30, up)) * smoothstep(-0.16, 0.0, up);
  // The disc. Gone below the horizon rather than sinking into the ground.
  col += glow * pow(towards, 1400.0) * 9.0 * smoothstep(-0.03, 0.02, sun.y);

  // Overcast: the lid.
  //
  // The deck itself is drawn by the sky pass, but the sky *behind* it has to go
  // too, or an overcast day is a blue sky with clouds over it -- and the two
  // read completely differently. Under full cover the dome flattens towards the
  // overcast tint, a shade darker overhead than at the horizon, which is the
  // one gradient a solid deck still has.
  //
  // Darker overhead than at the horizon, but only just: a big difference puts
  // a visible band across the sky where the deck stops and the lid starts, and
  // a real overcast has almost no gradient in it at all -- that flatness is
  // most of what makes one oppressive.
  let lid = overcastTint(sun) * mix(0.90, 1.04, 1.0 - abs(up));
  col = mix(col, lid, weather.cover * smoothstep(-0.30, 0.10, up));
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
/**
 * Set while the land overlay is up, to take the air out.
 *
 * The land view is a plan, not a vista: what it is for is comparing one plot
 * against another across five kilometres, and aerial perspective -- which is
 * exactly right for a view of a city -- turns the far half of that comparison
 * into grey. This is the one place the atmosphere is deliberately wrong.
 */
var<private> planView : f32 = 0.0;

fn setPlanView(on : f32) {
  planView = clamp(on, 0.0, 1.0);
}

fn hazeAmount(metres : f32) -> f32 {
  // Fog is air brought closer. One scale length instead of two thousand six
  // hundred metres is a thick morning; the same curve, just shorter, so the
  // near and far terms keep their relationship and nothing pops.
  let scale = mix(2600.0, 420.0, weather.fog);
  let near = 1.0 - exp(-metres * (1.0 / scale));
  let far = smoothstep(mix(1600.0, 200.0, weather.fog),
                       mix(4200.0, 900.0, weather.fog), metres);
  let air = clamp(near * 0.62 + far * (0.55 + weather.fog * 0.42), 0.0, 1.0);
  return air * (1.0 - planView * 0.72);
}

fn aerial(col : vec3f, metres : f32, dir : vec3f, sun : vec3f) -> vec3f {
  return mix(col, skyColour(dir, sun), hazeAmount(metres));
}

/** The filmic shoulder every surface in the game shares. */
fn tonemap(col : vec3f) -> vec3f {
  return pow(col / (col + vec3f(0.72)) * 1.42, vec3f(0.9));
}
