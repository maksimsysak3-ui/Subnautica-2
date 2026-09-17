/**
 * The frame, after the city has been drawn into it.
 *
 * Everything before this writes tonemapped colour into a floating point target
 * rather than into the swapchain, which leaves two things on the table that an
 * eight bit buffer throws away: values above one -- lit signage, the sun's
 * glare off glass, a bright sky -- and the chance to work on the picture as a
 * whole. This pass spends both. Bloom is taken from what is actually brighter
 * than the display can show, so it lights up at dusk and stays out of the way
 * at noon; the edges are smoothed; and the whole frame gets the grade a camera
 * would give it.
 *
 * Four passes: a bright pass at half resolution, a separable blur across it,
 * and a composite that also does the antialiasing.
 */

struct Post {
  /** xy = one texel of the scene, zw = one texel of the bloom chain. */
  texel : vec4f,
  /** x = bloom strength, y = threshold, z = exposure, w = vignette. */
  tune  : vec4f,
  /** x = night, 0 at noon and 1 after dark. y = wet. z = seconds. */
  mood  : vec4f,
};

@group(0) @binding(0) var samp : sampler;
@group(0) @binding(1) var src  : texture_2d<f32>;
@group(0) @binding(2) var<uniform> post : Post;

struct VertexOut {
  @builtin(position) pos : vec4f,
  @location(0) uv : vec2f,
};

/** One triangle over the whole target. No vertex buffer, no index buffer. */
@vertex
fn vs(@builtin(vertex_index) i : u32) -> VertexOut {
  var out : VertexOut;
  let x = f32((i << 1u) & 2u);
  let y = f32(i & 2u);
  out.pos = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  out.uv = vec2f(x, y);
  return out;
}

fn luma(c : vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }

/**
 * What is brighter than the screen can show, downsampled by half.
 *
 * A soft knee rather than a hard cut: a hard threshold makes a sign flicker
 * into bloom as the camera moves, because the pixel crosses the line and comes
 * back. The knee is the same curve every film game uses and it is worth the
 * three extra instructions.
 */
@fragment
fn brightPass(in : VertexOut) -> @location(0) vec4f {
  let o = post.texel.xy;
  var sum = vec3f(0.0);
  sum += textureSampleLevel(src, samp, in.uv + vec2f(-o.x, -o.y), 0.0).rgb;
  sum += textureSampleLevel(src, samp, in.uv + vec2f( o.x, -o.y), 0.0).rgb;
  sum += textureSampleLevel(src, samp, in.uv + vec2f(-o.x,  o.y), 0.0).rgb;
  sum += textureSampleLevel(src, samp, in.uv + vec2f( o.x,  o.y), 0.0).rgb;
  let col = sum * 0.25;

  let threshold = post.tune.y;
  let knee = threshold * 0.6 + 0.0001;
  let b = luma(col);
  let soft = clamp(b - threshold + knee, 0.0, 2.0 * knee);
  let weight = max(b - threshold, soft * soft / (4.0 * knee)) / max(b, 0.0001);
  return vec4f(col * weight, 1.0);
}

/** Nine taps, which five samples get for free on a linear sampler. */
fn blur(uv : vec2f, dir : vec2f) -> vec4f {
  let step = post.texel.zw * dir;
  var col = textureSampleLevel(src, samp, uv, 0.0).rgb * 0.2270270270;
  col += textureSampleLevel(src, samp, uv + step * 1.3846153846, 0.0).rgb * 0.3162162162;
  col += textureSampleLevel(src, samp, uv - step * 1.3846153846, 0.0).rgb * 0.3162162162;
  col += textureSampleLevel(src, samp, uv + step * 3.2307692308, 0.0).rgb * 0.0702702703;
  col += textureSampleLevel(src, samp, uv - step * 3.2307692308, 0.0).rgb * 0.0702702703;
  return vec4f(col, 1.0);
}

@fragment
fn blurH(in : VertexOut) -> @location(0) vec4f { return blur(in.uv, vec2f(1.0, 0.0)); }
@fragment
fn blurV(in : VertexOut) -> @location(0) vec4f { return blur(in.uv, vec2f(0.0, 1.0)); }

// ---- composite -------------------------------------------------------------

@group(0) @binding(3) var bloomTex : texture_2d<f32>;

const FXAA_SPAN = 6.0;
const FXAA_REDUCE = 1.0 / 128.0;
const FXAA_MIN = 1.0 / 24.0;

/**
 * Edge antialiasing, the cheap version.
 *
 * The city is a quarter of a million near-horizontal roof edges against a
 * bright sky, and without this every one of them crawls as the camera turns.
 * Multisampling would cost the whole frame again at 4x; this costs five taps
 * and is most of the way there.
 */
fn fxaa(uv : vec2f) -> vec3f {
  let o = post.texel.xy;
  let rgbM  = textureSampleLevel(src, samp, uv, 0.0).rgb;
  let rgbNW = textureSampleLevel(src, samp, uv + vec2f(-o.x, -o.y), 0.0).rgb;
  let rgbNE = textureSampleLevel(src, samp, uv + vec2f( o.x, -o.y), 0.0).rgb;
  let rgbSW = textureSampleLevel(src, samp, uv + vec2f(-o.x,  o.y), 0.0).rgb;
  let rgbSE = textureSampleLevel(src, samp, uv + vec2f( o.x,  o.y), 0.0).rgb;

  // On the displayable part of the signal: an unclamped highlight otherwise
  // reads as an edge against everything near it and smears the sign it came
  // from across its own neighbours.
  let lNW = luma(min(rgbNW, vec3f(1.0)));
  let lNE = luma(min(rgbNE, vec3f(1.0)));
  let lSW = luma(min(rgbSW, vec3f(1.0)));
  let lSE = luma(min(rgbSE, vec3f(1.0)));
  let lM  = luma(min(rgbM,  vec3f(1.0)));
  let lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  let lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  if (lMax - lMin < lMax * 0.10 + 0.018) { return rgbM; }

  var dir = vec2f(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
  let reduce = max((lNW + lNE + lSW + lSE) * 0.25 * FXAA_REDUCE, FXAA_MIN);
  let scale = 1.0 / (min(abs(dir.x), abs(dir.y)) + reduce);
  dir = clamp(dir * scale, vec2f(-FXAA_SPAN), vec2f(FXAA_SPAN)) * o;

  let inner = (textureSampleLevel(src, samp, uv + dir * (1.0 / 3.0 - 0.5), 0.0).rgb
             + textureSampleLevel(src, samp, uv + dir * (2.0 / 3.0 - 0.5), 0.0).rgb) * 0.5;
  let outer = inner * 0.5 + (textureSampleLevel(src, samp, uv - dir * 0.5, 0.0).rgb
                           + textureSampleLevel(src, samp, uv + dir * 0.5, 0.0).rgb) * 0.25;
  let lOuter = luma(min(outer, vec3f(1.0)));
  return select(inner, outer, lOuter >= lMin && lOuter <= lMax);
}

@fragment
fn composite(in : VertexOut) -> @location(0) vec4f {
  var col = fxaa(in.uv);
  col += textureSampleLevel(bloomTex, samp, in.uv, 0.0).rgb * post.tune.x;
  col *= post.tune.z;

  // A gentle S: the shadows close up a little and the midtones lift, which is
  // what a lens does and what a straight buffer never does. Kept small, because
  // the surfaces were already graded by the light that landed on them.
  col = clamp(col, vec3f(0.0), vec3f(4.0));
  col = col * col * (3.0 - 2.0 * min(col, vec3f(1.0))) * 0.34 + col * 0.66;

  // Colour temperature by time of day, carried on one number: the night city is
  // lit by sodium and mercury and reads cold-blue in the shadows, the day city
  // does not.
  let night = post.mood.x;
  let tint = mix(vec3f(1.0, 1.0, 1.0), vec3f(0.94, 0.97, 1.10), night);
  col *= tint;

  let grey = vec3f(luma(col));
  col = mix(grey, col, 1.06 + 0.06 * night);

  // The corners, very slightly. Enough to keep the eye in the middle of the
  // screen and not enough for anyone to be able to say what changed.
  let d = in.uv - vec2f(0.5);
  let vig = 1.0 - post.tune.w * dot(d, d) * 2.2;
  col *= vig;

  return vec4f(col, 1.0);
}
