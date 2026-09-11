// The river surface.
//
// Water is mostly not its own colour. What the eye reads is three things
// layered on it, in this order of importance: what it reflects, which is the
// sky and changes completely through the day; how much of the bottom shows
// through, which is what makes shallows read as shallows; and the ripples,
// which are the only part that is actually the water.
//
// So this is a Fresnel mix between a transmitted colour that darkens with
// depth and a reflected sky colour taken from the same atmosphere function
// the sky itself uses -- which is what keeps the river the right colour at
// dawn without anything here knowing what time it is.

#include "common.wgsl"
#include "atmosphere.wgsl"
#include "noise.wgsl"

struct VSOut {
  @builtin(position) pos   : vec4f,
  @location(0)       world : vec3f,
  @location(1)       normal: vec3f,
  /** x = metres across from the middle, y = metres along the river. */
  @location(2)       coord : vec2f,
};

@vertex
fn vs(@location(0) position : vec3f,
      @location(1) normal   : vec3f,
      @location(2) coord    : vec2f) -> VSOut {
  var out : VSOut;
  out.world = position;
  out.normal = normal;
  out.coord = coord;
  out.pos = camera.viewProj * vec4f(position, 1.0);
  return out;
}

/**
 * The surface, as a normal.
 *
 * Three scales of wave, each drifting at its own speed and angle, summed as
 * gradients rather than heights -- a normal is what the shading wants and
 * differencing a summed height field costs three more noise lookups for the
 * same answer.
 *
 * The largest scale is stretched along the river rather than isotropic,
 * because a current draws the surface out downstream. That single detail is
 * most of what makes a river read as flowing rather than as a pond.
 */
fn ripple(p : vec2f, t : f32, fade : f32) -> vec3f {
  var n = vec3f(0.0, 1.0, 0.0);
  // Along the flow: long, low, and moving with it.
  n += vec3f(
    vnoise(vec2f(p.x * 0.09, p.y * 0.021 - t * 0.30)) - 0.5,
    0.0,
    vnoise(vec2f(p.x * 0.09 + 31.0, p.y * 0.021 - t * 0.30)) - 0.5) * 0.55 * fade;
  // Chop.
  n += vec3f(
    vnoise(vec2f(p.x * 0.42 + t * 0.22, p.y * 0.31 - t * 0.55)) - 0.5,
    0.0,
    vnoise(vec2f(p.x * 0.42 + 17.0, p.y * 0.31 - t * 0.55)) - 0.5) * 0.34 * fade;
  // Glitter, only where the surface is close enough to resolve it.
  n += vec3f(
    vnoise(vec2f(p.x * 1.7 - t * 0.9, p.y * 1.7 + t * 0.4)) - 0.5,
    0.0,
    vnoise(vec2f(p.x * 1.7 + 5.0, p.y * 1.7 + t * 0.4)) - 0.5) * 0.22 * fade * fade;
  return normalize(n);
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4f {
  // The weather, once, before anything reads the atmosphere.
  setWeather(camera.weather.x, camera.weather.y);
  let sun = normalize(camera.sunDir.xyz);
  let toEye = camera.eye.xyz - in.world;
  let dist = length(toEye);
  let view = toEye / dist;

  // Ripples fade out with distance rather than aliasing into noise.
  let fade = 1.0 - smoothstep(220.0, 900.0, dist);
  let n = ripple(vec2f(in.coord.x, in.coord.y), camera.params.x, fade);

  // What the water lets through. Deeper in midstream, and the bed is the same
  // silt colour the terrain's own earth is, so a shallow edge does not band
  // against the bank it meets.
  let across = clamp(abs(in.coord.x) / max(abs(in.coord.x) + 1.0, 1.0), 0.0, 1.0);
  let shallow = 1.0 - smoothstep(0.0, 1.0, abs(in.coord.x) * 0.0);
  let edge = 1.0 - smoothstep(0.55, 1.0, abs(in.coord.x) / 60.0);
  let bed = vec3f(0.055, 0.048, 0.034);
  let deep = vec3f(0.010, 0.026, 0.032);
  var through = mix(deep, bed, edge * 0.55);

  // What it reflects. The sky in the mirror direction, which is what makes
  // water blue at noon, orange at sunset and nearly black under stars without
  // any of those being written down anywhere.
  let mirror = reflect(-view, n);
  var sky = skyColour(normalize(vec3f(mirror.x, abs(mirror.y), mirror.z)), sun);

  // Fresnel: almost all reflection at a grazing angle, mostly transmission
  // looking straight down. This is the whole difference between water and a
  // sheet of blue plastic.
  let f = 0.02 + 0.98 * pow(1.0 - clamp(dot(view, n), 0.0, 1.0), 5.0);
  var col = mix(through * (ambientSky(sun) * 0.8 + sunLight(sun) * max(dot(n, sun), 0.0) * 0.25),
                sky, f);

  // The specular glint off the waves. Tight, and only on the lit side.
  let h = normalize(view + sun);
  let spec = pow(max(dot(n, h), 0.0), 220.0) * fade;
  col += sunLight(sun) * spec * 1.6;

  // The bank: a paler line where the water meets the shore, which every body
  // of water has and which is what stops the edge reading as a cut.
  let shore = 1.0 - smoothstep(0.0, 3.5, abs(abs(in.coord.x) - abs(in.coord.x)));
  col = mix(col, col * 1.25 + vec3f(0.012, 0.014, 0.012), edge * 0.18);

  col = aerial(col, dist, -toEye, sun);
  return vec4f(tonemap(col), 1.0);
}
