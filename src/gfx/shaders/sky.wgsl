// The sky, as one triangle covering the frame.
//
// Drawn before anything else with depth writes off, so every later pass paints
// over it and the sky costs one full-screen shade and no depth traffic. The
// alternative -- clearing to a flat colour -- is what the renderer did, and it
// is why a scene lit for midday read as midnight.

#include "common.wgsl"
#include "atmosphere.wgsl"
#include "noise.wgsl"

struct VSOut {
  @builtin(position) pos : vec4f,
  /** The view ray, in world space, unnormalised. */
  @location(0)       dir : vec3f,
};

@vertex
fn vs(@builtin(vertex_index) i : u32) -> VSOut {
  // One oversized triangle rather than two: no seam down the diagonal, and
  // three vertices instead of six.
  let uv = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  let ndc = uv * 2.0 - 1.0;
  var out : VSOut;
  out.pos = vec4f(ndc, 1.0, 1.0);
  // Unproject the far plane. The camera uniform carries viewProj, so the ray
  // is the inverse applied to this corner -- done by solving rather than by
  // uploading a second matrix, since the view direction is all that is needed.
  let far = camera.invViewProj * vec4f(ndc, 1.0, 1.0);
  out.dir = far.xyz / far.w - camera.eye.xyz;
  return out;
}

/** Four octaves of drifting value noise, the cheapest thing that reads as cloud. */
fn cloudField(p : vec2f, t : f32) -> f32 {
  // Each octave drifts at its own speed, which is what stops the whole sky
  // sliding as one sheet -- the thing that gives a scrolling texture away.
  var v = vnoise(p * 0.90 + vec2f(t * 0.0060, 0.0)) * 0.52;
  v += vnoise(p * 2.10 + vec2f(t * 0.0115, t * 0.004)) * 0.26;
  v += vnoise(p * 4.60 + vec2f(t * 0.0210, -t * 0.008)) * 0.14;
  v += vnoise(p * 9.70 + vec2f(t * 0.0380, 0.0)) * 0.08;
  return v;
}

/**
 * The cloud deck.
 *
 * A sky without cloud is a gradient, and no gradient has ever looked like
 * weather. This is a single flat layer read where the view ray crosses it:
 * `d.xz / d.y` is that crossing for an eye on the ground, which is exactly
 * right overhead, wrong by a little at forty-five degrees, and unusable at the
 * horizon -- so the deck fades out before it gets there, which is also where a
 * real deck disappears into haze.
 *
 * Lit in three parts, in the order the eye reads them: the sun through thin
 * edges, which is what a cloud edge actually is; the flat top, warm and bright;
 * and the base, which is not grey but the colour of the sky reflected into it.
 * Returns rgb premultiplied by coverage in `a`.
 */
fn clouds(d : vec3f, sun : vec3f, t : f32) -> vec4f {
  if (d.y <= 0.02) { return vec4f(0.0); }
  let p = d.xz / d.y * 0.55;
  // Overhead the deck is near; at a grazing angle the same cell of noise is
  // stretched over the whole horizon, so it is faded before it smears.
  // Faded out before the projection smears, and further out under cover so the
  // deck does not stop at a visible line with the flat lid beyond it.
  let reach = 1.0 - smoothstep(0.06, 0.40 + weather.cover * 0.55, length(p) * 0.05);
  if (reach <= 0.001) { return vec4f(0.0); }

  let f = cloudField(p, t);
  // Coverage: a hard-ish edge, because a cloud has one. Softened a little at
  // the top so the deck thins out rather than stopping.
  //
  // The weather moves the threshold rather than the noise. Dropping it fills
  // the sky from the same field, so a front comes in as the clouds it already
  // had growing together -- which is what a sky actually does -- instead of a
  // second layer fading up over the first.
  let cut = mix(0.62, 0.06, weather.cover);
  let body = smoothstep(cut, cut + 0.20, f);
  let edge = smoothstep(cut - 0.06, cut + 0.12, f);
  let a = edge * reach * mix(0.92, 1.0, weather.cover);
  if (a <= 0.002) { return vec4f(0.0); }

  let phase = dayPhase(sun);
  let lit = max(phase.x, phase.y * 0.92);
  // Depth through the cloud, as a proxy for how much light gets through: the
  // body is thick and the edge is not.
  let thick = clamp(body * 1.15 + 0.12, 0.0, 1.0);
  let towards = clamp(dot(normalize(d), sun), 0.0, 1.0);

  // Warm at dawn and dusk, white at noon, and blue-grey at night when the only
  // light on them is the sky itself.
  let warm = mix(vec3f(1.02, 0.98, 0.92), vec3f(1.06, 0.62, 0.34), phase.y);
  let top = mix(vec3f(0.16, 0.19, 0.26), warm, lit);
  let base = mix(vec3f(0.09, 0.11, 0.16), mix(vec3f(0.46, 0.52, 0.62), warm * 0.5, phase.y), lit);
  var col = mix(top, base, thick * 0.78);
  // The silver lining: light through a thin edge, aimed at the sun.
  col += warm * pow(towards, 6.0) * (1.0 - thick) * (0.55 + phase.y * 1.4) * lit;
  // Rain cloud is darker and flatter, and it loses the lining -- there is no
  // thin edge left to see the sun through.
  let heavy = weather.cover * weather.cover;
  col = mix(col, overcastTint(sun) * mix(0.86, 0.48, thick), heavy);
  return vec4f(col, a);
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4f {
  // The weather, once, before anything reads the atmosphere.
  setWeather(camera.weather.x, camera.weather.y);
  let sun = normalize(camera.sunDir.xyz);
  let d = normalize(in.dir);
  var col = skyColour(in.dir, sun);

  let c = clouds(d, sun, camera.params.x);
  col = mix(col, c.rgb, c.a);

  // A dither of a thousandth, keyed to the pixel. A sky is the one surface in
  // the frame that is almost all gradient, and eight bits across a gradient
  // that wide bands visibly -- this costs nothing and removes it.
  let grain = (lattice(vec2i(in.pos.xy)) - 0.5) * 0.0022;

  // The same filmic shoulder the ground and the buildings use, so the horizon
  // meets the terrain without a seam.
  return vec4f(tonemap(col) + grain, 1.0);
}
