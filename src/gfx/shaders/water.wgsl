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
    vnoise(vec2f(p.x * 0.09 + 31.0, p.y * 0.021 - t * 0.30)) - 0.5) * 0.26 * fade;
  // Chop.
  n += vec3f(
    vnoise(vec2f(p.x * 0.42 + t * 0.22, p.y * 0.31 - t * 0.55)) - 0.5,
    0.0,
    vnoise(vec2f(p.x * 0.42 + 17.0, p.y * 0.31 - t * 0.55)) - 0.5) * 0.17 * fade;
  // Glitter, only where the surface is close enough to resolve it.
  n += vec3f(
    vnoise(vec2f(p.x * 1.7 - t * 0.9, p.y * 1.7 + t * 0.4)) - 0.5,
    0.0,
    vnoise(vec2f(p.x * 1.7 + 5.0, p.y * 1.7 + t * 0.4)) - 0.5) * 0.12 * fade * fade;
  return normalize(n);
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4f {
  setWeather(camera.weather.x, camera.weather.y);
  let sun = normalize(camera.sunDir.xyz);
  let toEye = camera.eye.xyz - in.world;
  let dist = length(toEye);
  let view = toEye / dist;
  // Ripples fade with distance: past a kilometre they are finer than a pixel
  // and only add shimmer.
  let fade = 1.0 - smoothstep(220.0, 900.0, dist);
  let n = ripple(vec2f(in.coord.x, in.coord.y), camera.params.x, fade);

  // 0 in the channel, 1 at the banks, where the bed shows through.
  let edge = 1.0 - smoothstep(0.55, 1.0, abs(in.coord.x) / 60.0);

  // What comes up out of the water: light scattered in the body of it, which
  // is what gives a river its colour, and the bed where it is shallow enough
  // to see. Teal-green rather than blue -- a river carries silt and algae and
  // is never the colour of a swimming pool.
  let deep = vec3f(0.006, 0.030, 0.036);
  let bed = vec3f(0.050, 0.052, 0.034);
  let light = ambientSky(sun) * 0.9 + sunLight(sun) * max(sun.y, 0.0) * 0.35;
  let body = mix(deep, bed, edge * 0.55) * light;

  // What goes down and comes back: the sky in the mirrored direction. Looked
  // at from the game's camera this is mostly the zenith, which is what makes
  // water read as water from above rather than as a grey road.
  let mirror = reflect(-view, n);
  let sky = skyColour(normalize(vec3f(mirror.x, abs(mirror.y) + 0.02, mirror.z)), sun);
  let f = 0.02 + 0.98 * pow(1.0 - clamp(dot(view, n), 0.0, 1.0), 5.0);
  var col = mix(body, sky * 0.85, clamp(f, 0.0, 0.72));

  // The sun off the surface: a tight core that blooms and a broad sheen
  // around it. Linear light, so the core is allowed to be far brighter than
  // anything lit -- which is the whole of what makes a river glitter.
  let h = normalize(view + sun);
  let nh = max(dot(n, h), 0.0);
  let glint = (pow(nh, 1200.0) * 16.0 + pow(nh, 120.0) * 0.5) * fade;
  col += sunLight(sun) * glint;

  // Shallows catch a little more light at the banks.
  col = mix(col, col * 1.25 + vec3f(0.004, 0.006, 0.005), edge * 0.18);
  col = aerial(col, dist, -toEye, sun);
  col = bury(col, camera.view.x);
  col = drain(col, camera.view.y);
  return vec4f(sceneOut(col), 1.0);
}
