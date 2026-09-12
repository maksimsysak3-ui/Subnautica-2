// Rain, as a screen-space pass over the finished frame.
//
// Not particles. A particle system for rain is a hundred thousand quads that
// the player sees for a fraction of a second each, and the whole of what they
// carry is "there are streaks and they move down and towards the camera". A
// procedural screen-space pass carries the same thing for one draw and one
// triangle -- and it is the technique every racing game uses on the windscreen,
// for the same reason.
//
// What it does have to get right, because these are the things a fake one gets
// wrong:
//
//  - Streaks at different depths. All-one-length rain reads as a texture
//    scrolling over the picture. Three layers at different speeds and scales
//    give it a front and a back.
//  - A slant, and the slant leaning with the wind rather than being fixed --
//    vertical rain looks like film scratches.
//  - Rain lit by the sky, not white. Rain against a dark building is bright and
//    rain against a bright sky is dark, and the second one is what tells you it
//    is in front of the scene rather than painted on it.
//  - Nothing at all when it is not raining, at zero cost: the pass is skipped
//    on the CPU, and this bails on its first line besides.

#include "common.wgsl"
#include "atmosphere.wgsl"

struct VSOut {
  @builtin(position) pos : vec4f,
  @location(0) uv : vec2f,
};

@vertex
fn vs(@builtin(vertex_index) i : u32) -> VSOut {
  // The usual full-screen triangle: one primitive, no vertex buffer, and no
  // seam down the diagonal of a two-triangle quad.
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var out : VSOut;
  out.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  out.uv = vec2f(p.x, 1.0 - p.y);
  return out;
}

fn hash21(p : vec2f) -> f32 {
  var h = u32(i32(p.x)) * 374761393u + u32(i32(p.y)) * 668265263u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return f32(h ^ (h >> 16u)) * (1.0 / 4294967296.0);
}

/**
 * One sheet of rain.
 *
 * The screen is cut into tall thin cells; each cell holds one drop, falling on
 * its own phase. `scale` is how many cells across, `speed` how fast they fall,
 * and `slant` how far the whole sheet leans -- so three calls at three scales
 * produce three depths without three copies of this.
 */
fn sheet(uv : vec2f, t : f32, scale : f32, speed : f32, slant : f32, seed : f32) -> f32 {
  // Aspect-corrected so a drop is the same shape on any window, and sheared so
  // the sheet leans. The shear is applied before the cell split, which is what
  // makes the streaks themselves slanted rather than a slanted grid of upright
  // ones.
  var p = vec2f(uv.x * scale + uv.y * slant, uv.y * scale * 0.42);
  let cell = floor(p);
  let f = fract(p);
  let r = hash21(cell + seed);
  // Cells that hold no drop: rain is not a grid.
  if (r > 0.62) { return 0.0; }

  // Where this drop is in its fall, on its own offset phase.
  let fall = fract(r * 7.31 + t * speed * (0.7 + r * 0.6));
  let dy = f.y - fall;
  // The streak: a long tail above the head, nothing below it.
  let len = 0.16 + r * 0.34;
  let along = smoothstep(-len, 0.0, dy) * (1.0 - step(0.0, dy));
  // Across: a thin core with a soft edge, narrower on the far sheets.
  let across = 1.0 - smoothstep(0.0, 0.034 + r * 0.022, abs(f.x - 0.5 - r * 0.3 + 0.15));
  return along * across * (0.45 + r * 0.55);
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4f {
  let rain = camera.weather.z;
  if (rain <= 0.004) { discard; }
  setWeather(camera.weather.x, camera.weather.y);

  let t = camera.params.x;
  let sun = normalize(camera.sunDir.xyz);
  // Pixels, not screen fractions.
  //
  // A drop has a size on the glass, not a size relative to the window: rain
  // measured in fractions of the viewport gets fatter as the window does, and
  // squashed sideways on a wide one. Working from the fragment coordinate
  // makes a drop the same shape and the same size at any resolution, and a
  // denser screen gets finer rain, which is what more pixels should buy.
  let uv = in.pos.xy * (1.0 / 640.0);

  // The wind leans the whole storm, and it breathes rather than holding one
  // angle -- a fixed slant is the tell that this is a texture.
  let gust = sin(t * 0.21) * 0.5 + sin(t * 0.07 + 1.7) * 0.5;
  let slant = (0.55 + gust * 0.45) * (0.3 + rain * 0.7);

  // Three depths. The far sheet is dense, small and slow; the near one is
  // sparse, long and fast, and it is what sells the speed.
  var v = sheet(uv, t, 34.0, 1.30, slant * 0.7, 11.0) * 0.46;
  v += sheet(uv, t, 19.0, 1.95, slant * 0.9, 57.0) * 0.66;
  v += sheet(uv, t, 9.5, 2.90, slant * 1.2, 91.0) * 0.92;
  v *= smoothstep(0.0, 0.30, rain) * (0.45 + rain * 0.85);
  if (v <= 0.002) { discard; }

  // Rain takes its colour from the sky it fell out of, so it is bright over a
  // dark street and nearly invisible against a bright horizon -- which is what
  // puts it in front of the scene instead of on top of it.
  // Straight up, and only the broad colour: a raindrop is two pixels and it
  // is not going to show anyone a star. This runs over the whole screen for
  // as long as it is raining.
  let col = tonemap(skyBody(vec3f(0.0, 1.0, 0.0), sun) * 1.9 + vec3f(0.06));
  return vec4f(col, clamp(v, 0.0, 1.0) * 0.48);
}
