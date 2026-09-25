/**
 * The frame, after the city has been drawn into it.
 *
 * Everything before this writes *linear* light into a floating point target.
 * Nothing upstream tonemaps, grades or encodes: the scene is a measurement of
 * how much light arrives at each pixel, and this file is the camera that turns
 * it into a picture. Doing that once, here, rather than in every surface
 * shader, is what lets the whole frame share one exposure, one filmic curve
 * and one grade -- and what lets bloom, ambient occlusion and antialiasing
 * each work in the space they are correct in.
 *
 * The passes, in order:
 *
 *   ao        half resolution, from the depth buffer: contact shadow where a
 *             building meets the street, where two blocks stand close, under
 *             an awning. Baked vertex occlusion only ever knew about one
 *             asset at a time; this knows about the city.
 *   aoBlur    separable and depth-aware, so the occlusion does not bleed
 *             across a roofline onto the street below it.
 *   down*     the bloom chain: a prefiltered, firefly-safe 13-tap downsample
 *             into successively halved mips...
 *   up        ...and a tent upsample back up them, added as it goes. A chain
 *             rather than one blur is the difference between a lit window
 *             with a soft halo round it and a lit window in a grey fog.
 *   composite exposure, occlusion, bloom, ACES, grade, vignette, sRGB, dither.
 *   fxaa      on the finished, display-encoded picture, which is the only
 *             space edge detection is meaningful in; with a touch of
 *             contrast-adaptive sharpening to give back what it softens.
 */

struct Post {
  /** xy = one texel of the scene. zw = unused. */
  texel : vec4f,
  /** x = bloom strength, y = threshold, z = exposure, w = vignette. */
  tune  : vec4f,
  /** x = night, y = golden hour, z = seconds, w = overcast. */
  mood  : vec4f,
  /** x = near, y = far, z = tan(half fov) * aspect, w = tan(half fov). */
  proj  : vec4f,
  /** x = ao strength (0 = off), y = ao radius scale, z = saturation, w = contrast. */
  look  : vec4f,
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

/** Interleaved gradient noise: the cheapest per-pixel rotation that does not band. */
fn ign(p : vec2f) -> f32 {
  return fract(52.9829189 * fract(dot(p, vec2f(0.06711056, 0.00583715))));
}

// ---- ambient occlusion -----------------------------------------------------

@group(1) @binding(0) var depthTex : texture_depth_2d;

/** Metres from the eye along the view axis, from a [0, 1] perspective depth. */
fn linearDepth(d : f32) -> f32 {
  let n = post.proj.x;
  let f = post.proj.y;
  return n * f / max(f - d * (f - n), 1e-6);
}

fn depthAt(p : vec2i) -> f32 {
  let size = vec2i(textureDimensions(depthTex));
  return textureLoad(depthTex, clamp(p, vec2i(0), size - 1), 0);
}

/** View-space position of a full-resolution depth texel. Right-handed, -z forward. */
fn viewPos(p : vec2i) -> vec3f {
  let size = vec2f(textureDimensions(depthTex));
  let uv = (vec2f(p) + 0.5) / size;
  let z = linearDepth(depthAt(p));
  let ndc = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  return vec3f(ndc.x * post.proj.z * z, ndc.y * post.proj.w * z, -z);
}

/**
 * Scalable ambient obscurance, on a spiral of twelve taps.
 *
 * Each tap asks one question: how much of the hemisphere above this point
 * does the surface at that tap stand in? The answer is weighted by how far
 * away it is, so a tower two streets over does not darken the pavement here.
 * The disc is sized in metres and projected, so the effect means the same
 * thing at street level and over the whole city: at street level it is the
 * dark line where a wall meets the kerb, from altitude it is the shade in the
 * canyons between blocks.
 */
@fragment
fn ao(in : VertexOut) -> @location(0) vec4f {
  let full = vec2i(in.pos.xy * 2.0);
  let d0 = depthAt(full);
  if (d0 >= 0.99999) { return vec4f(1.0); }
  let p = viewPos(full);
  // The normal, from whichever neighbour is closer on each axis: taking the
  // nearer one is what stops a silhouette edge producing a normal that points
  // off into the background.
  let px = viewPos(full + vec2i(1, 0));
  let nx = viewPos(full - vec2i(1, 0));
  let py = viewPos(full + vec2i(0, 1));
  let ny = viewPos(full - vec2i(0, 1));
  let dx = select(p - nx, px - p, abs(px.z - p.z) < abs(nx.z - p.z));
  let dy = select(p - ny, py - p, abs(py.z - p.z) < abs(ny.z - p.z));
  let n = normalize(cross(dy, dx));

  let z = -p.z;
  let radius = clamp(z * 0.028, 0.9, 34.0) * post.look.y;
  let size = vec2f(textureDimensions(depthTex));
  // Metres to pixels at this depth.
  let pxPerM = size.y / (2.0 * post.proj.w * z);
  let screenR = min(radius * pxPerM, 90.0);
  if (screenR < 1.5) { return vec4f(1.0); }

  let spin = ign(in.pos.xy) * 6.2831853;
  let r2 = radius * radius;
  var sum = 0.0;
  const TAPS = 12;
  for (var i = 0; i < TAPS; i++) {
    let t = (f32(i) + 0.5) / f32(TAPS);
    let a = f32(i) * 2.3999632 + spin;
    let off = vec2f(cos(a), sin(a)) * screenR * t;
    let q = viewPos(full + vec2i(off));
    let v = q - p;
    let vv = dot(v, v);
    let vn = dot(v, n);
    let falloff = max(r2 - vv, 0.0) / r2;
    sum += falloff * falloff * max(vn - 0.015 * z, 0.0) / (vv + 0.01 * r2);
  }
  let occ = clamp(1.0 - sum * (2.2 / f32(TAPS)), 0.0, 1.0);
  // Fades out towards the horizon, where the taps are coarser than the detail
  // they are reading and the result is noise rather than shade.
  let fade = 1.0 - smoothstep(1800.0, 3200.0, z);
  return vec4f(mix(1.0, occ, fade), 0.0, 0.0, 1.0);
}

fn aoBlur(in : VertexOut, dir : vec2i) -> vec4f {
  let here = vec2i(in.pos.xy);
  let z0 = linearDepth(depthAt(here * 2));
  var sum = textureLoad(src, here, 0).r;
  var weight = 1.0;
  let size = vec2i(textureDimensions(src));
  for (var i = 1; i <= 3; i++) {
    for (var s = -1; s <= 1; s += 2) {
      let at = clamp(here + dir * i * s, vec2i(0), size - 1);
      let z = linearDepth(depthAt(at * 2));
      let w = exp(-abs(z - z0) / (z0 * 0.02 + 0.2)) * (1.0 - f32(i) * 0.18);
      sum += textureLoad(src, at, 0).r * w;
      weight += w;
    }
  }
  return vec4f(sum / weight, 0.0, 0.0, 1.0);
}

@fragment
fn aoBlurH(in : VertexOut) -> @location(0) vec4f { return aoBlur(in, vec2i(1, 0)); }
@fragment
fn aoBlurV(in : VertexOut) -> @location(0) vec4f { return aoBlur(in, vec2i(0, 1)); }

// ---- bloom -----------------------------------------------------------------

/** The 13-tap downsample from Jimenez's Call of Duty talk. */
fn down13(uv : vec2f) -> array<vec3f, 5> {
  let t = 1.0 / vec2f(textureDimensions(src));
  let a = textureSampleLevel(src, samp, uv + t * vec2f(-2.0, -2.0), 0.0).rgb;
  let b = textureSampleLevel(src, samp, uv + t * vec2f( 0.0, -2.0), 0.0).rgb;
  let c = textureSampleLevel(src, samp, uv + t * vec2f( 2.0, -2.0), 0.0).rgb;
  let d = textureSampleLevel(src, samp, uv + t * vec2f(-2.0,  0.0), 0.0).rgb;
  let e = textureSampleLevel(src, samp, uv, 0.0).rgb;
  let f = textureSampleLevel(src, samp, uv + t * vec2f( 2.0,  0.0), 0.0).rgb;
  let g = textureSampleLevel(src, samp, uv + t * vec2f(-2.0,  2.0), 0.0).rgb;
  let h = textureSampleLevel(src, samp, uv + t * vec2f( 0.0,  2.0), 0.0).rgb;
  let i = textureSampleLevel(src, samp, uv + t * vec2f( 2.0,  2.0), 0.0).rgb;
  let j = textureSampleLevel(src, samp, uv + t * vec2f(-1.0, -1.0), 0.0).rgb;
  let k = textureSampleLevel(src, samp, uv + t * vec2f( 1.0, -1.0), 0.0).rgb;
  let l = textureSampleLevel(src, samp, uv + t * vec2f(-1.0,  1.0), 0.0).rgb;
  let m = textureSampleLevel(src, samp, uv + t * vec2f( 1.0,  1.0), 0.0).rgb;
  // Five overlapping boxes: the centre one, and the four corners.
  return array<vec3f, 5>(
    (j + k + l + m) * 0.25,
    (a + b + d + e) * 0.25,
    (b + c + e + f) * 0.25,
    (d + e + g + h) * 0.25,
    (e + f + h + i) * 0.25,
  );
}

/** Soft-knee threshold: a sign fades into bloom rather than snapping on. */
fn prefilter(c : vec3f) -> vec3f {
  let threshold = post.tune.y;
  let knee = threshold * 0.5 + 1e-4;
  let b = max(c.r, max(c.g, c.b));
  let soft = clamp(b - threshold + knee, 0.0, 2.0 * knee);
  let w = max(b - threshold, soft * soft / (4.0 * knee)) / max(b, 1e-4);
  return c * w;
}

/**
 * The first step down, which is also where the threshold is applied.
 *
 * Each of the five boxes is weighted by the inverse of its own brightness
 * (Karis' average) before they are combined, so one pixel of sun glint off a
 * windscreen cannot dominate a whole block of the chain and strobe as the car
 * drives past.
 */
@fragment
fn downFirst(in : VertexOut) -> @location(0) vec4f {
  let s = down13(in.uv);
  var sum = vec3f(0.0);
  var wsum = 0.0;
  let weights = array<f32, 5>(0.5, 0.125, 0.125, 0.125, 0.125);
  for (var i = 0; i < 5; i++) {
    let c = prefilter(min(s[i], vec3f(60.0)));
    let w = weights[i] / (1.0 + luma(c));
    sum += c * w;
    wsum += w;
  }
  return vec4f(sum / max(wsum, 1e-4), 1.0);
}

@fragment
fn down(in : VertexOut) -> @location(0) vec4f {
  let s = down13(in.uv);
  let c = s[0] * 0.5 + (s[1] + s[2] + s[3] + s[4]) * 0.125;
  return vec4f(c, 1.0);
}

/** A 3x3 tent over the smaller mip, added into the larger by the blend state. */
@fragment
fn up(in : VertexOut) -> @location(0) vec4f {
  let t = 1.0 / vec2f(textureDimensions(src));
  var c = textureSampleLevel(src, samp, in.uv, 0.0).rgb * 4.0;
  c += textureSampleLevel(src, samp, in.uv + t * vec2f(-1.0, 0.0), 0.0).rgb * 2.0;
  c += textureSampleLevel(src, samp, in.uv + t * vec2f( 1.0, 0.0), 0.0).rgb * 2.0;
  c += textureSampleLevel(src, samp, in.uv + t * vec2f(0.0, -1.0), 0.0).rgb * 2.0;
  c += textureSampleLevel(src, samp, in.uv + t * vec2f(0.0,  1.0), 0.0).rgb * 2.0;
  c += textureSampleLevel(src, samp, in.uv + t * vec2f(-1.0, -1.0), 0.0).rgb;
  c += textureSampleLevel(src, samp, in.uv + t * vec2f( 1.0, -1.0), 0.0).rgb;
  c += textureSampleLevel(src, samp, in.uv + t * vec2f(-1.0,  1.0), 0.0).rgb;
  c += textureSampleLevel(src, samp, in.uv + t * vec2f( 1.0,  1.0), 0.0).rgb;
  return vec4f(c / 16.0, 1.0);
}

// ---- composite -------------------------------------------------------------

@group(1) @binding(1) var bloomTex : texture_2d<f32>;
@group(1) @binding(2) var aoTex : texture_2d<f32>;
@group(1) @binding(3) var glowTex : texture_2d<f32>;

/**
 * ACES, as fitted by Stephen Hill: the RRT and ODT with their input and
 * output matrices. The matrices matter -- they are what desaturate a very
 * bright light towards white the way film does, instead of letting a red sign
 * clip to a flat red disc -- and the curve is what gives the frame its black
 * floor and its shoulder.
 */
fn aces(c : vec3f) -> vec3f {
  let i = mat3x3f(
    vec3f(0.59719, 0.07600, 0.02840),
    vec3f(0.35458, 0.90834, 0.13383),
    vec3f(0.04823, 0.01566, 0.83777));
  let o = mat3x3f(
    vec3f( 1.60475, -0.10208, -0.00327),
    vec3f(-0.53108,  1.10813, -0.07276),
    vec3f(-0.07367, -0.00605,  1.07602));
  let v = i * c;
  let a = v * (v + 0.0245786) - 0.000090537;
  let b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return clamp(o * (a / b), vec3f(0.0), vec3f(1.0));
}

fn encodeSrgb(c : vec3f) -> vec3f {
  let lo = c * 12.92;
  let hi = pow(max(c, vec3f(0.0)), vec3f(1.0 / 2.4)) * 1.055 - 0.055;
  return select(lo, hi, c > vec3f(0.0031308));
}

/**
 * The grade, in linear light before the curve.
 *
 * Split-toning by time of day: a clear day holds its shadows slightly cool
 * and its highlights slightly warm, which is what sky fill and sun actually
 * do and what makes a frame read as daylight rather than as a render. Golden
 * hour pushes the warmth; the night pulls the shadows towards blue, because
 * that is how the eye sees in the dark and how every film has shown it.
 */
fn grade(c : vec3f) -> vec3f {
  let night = post.mood.x;
  let golden = post.mood.y;
  let overcast = post.mood.w;
  let l = luma(c);
  let highW = smoothstep(0.05, 0.9, l);
  let warm = mix(vec3f(1.035, 1.0, 0.955), vec3f(1.10, 0.98, 0.84), golden);
  let cool = mix(vec3f(0.965, 0.995, 1.05), vec3f(0.86, 0.94, 1.16), night);
  var g = c * mix(cool, warm, highW);
  // Overcast flattens the split: there is no sun to be warm and no clear sky
  // to be cool.
  g = mix(g, c, overcast * 0.7);
  // Saturation around the frame's own grey.
  let s = post.look.z * (1.0 - night * 0.18);
  g = max(mix(vec3f(luma(g)), g, s), vec3f(0.0));
  return g;
}

@fragment
fn composite(in : VertexOut) -> @location(0) vec4f {
  var hdr = textureSampleLevel(src, samp, in.uv, 0.0).rgb;
  if (post.look.x > 0.0) {
    let occ = textureSampleLevel(aoTex, samp, in.uv, 0.0).r;
    hdr *= mix(1.0, occ, post.look.x);
  }
  hdr += textureSampleLevel(bloomTex, samp, in.uv, 0.0).rgb * post.tune.x;
  // The city's glow in the air. After dark, the lights of a whole district
  // scatter in the damp and the dust over it -- the orange-white dome anyone
  // has seen over a town from outside it, and the halo round a lit street seen
  // from above. The bloom is the lens; this is the air. Wider than any level
  // of the chain on its own, and only at night: by day the same light is the
  // sky, and adding it again is a grey veil over everything. Mist and rain
  // thicken it, because there is more in the air to catch the light.
  let air = post.mood.x * (0.24 + 0.12 * post.mood.w);
  hdr += textureSampleLevel(glowTex, samp, in.uv, 0.0).rgb * air;
  hdr *= post.tune.z;
  hdr = grade(hdr);

  var col = aces(hdr);
  // Contrast around a mid-grey after the curve, where it reads as punch rather
  // than as crushed blacks.
  let k = post.look.w;
  col = clamp((col - 0.18) * k + 0.18, vec3f(0.0), vec3f(1.0));

  let d = in.uv - vec2f(0.5);
  let vig = 1.0 - post.tune.w * smoothstep(0.08, 0.55, dot(d, d) * 1.6);
  col *= vig;

  var out = encodeSrgb(col);
  // Half a code value of noise: the sky is a very long, very shallow
  // gradient and eight bits band it into contour lines without this.
  out += (ign(in.pos.xy + fract(post.mood.z) * 97.0) - 0.5) / 255.0;
  // Grain in the dark, the way a night exposure has it: fine, moving, and in
  // the shadows rather than over the lights. It is what makes a dark frame
  // read as a photograph of the dark rather than as a flat black fill.
  let shadowW = 1.0 - smoothstep(0.02, 0.35, luma(out));
  out += (ign(in.pos.xy * 1.37 + fract(post.mood.z * 7.3) * 131.0) - 0.5)
       * 0.030 * post.mood.x * shadowW;
  return vec4f(out, luma(out));
}

// ---- antialiasing ----------------------------------------------------------

const FXAA_SPAN = 8.0;
const FXAA_REDUCE_MUL = 1.0 / 8.0;
const FXAA_REDUCE_MIN = 1.0 / 128.0;

/**
 * FXAA on the finished picture, then a light contrast-adaptive sharpen.
 *
 * The city is a quarter of a million near-horizontal roof edges against a
 * bright sky, and without this every one of them crawls as the camera turns.
 * Luma rides in the alpha channel from the composite, so each tap is one
 * fetch.
 */
@fragment
fn fxaa(in : VertexOut) -> @location(0) vec4f {
  let o = post.texel.xy;
  let uv = in.uv;
  let m  = textureSampleLevel(src, samp, uv, 0.0);
  let nw = textureSampleLevel(src, samp, uv + vec2f(-o.x, -o.y), 0.0).a;
  let ne = textureSampleLevel(src, samp, uv + vec2f( o.x, -o.y), 0.0).a;
  let sw = textureSampleLevel(src, samp, uv + vec2f(-o.x,  o.y), 0.0).a;
  let se = textureSampleLevel(src, samp, uv + vec2f( o.x,  o.y), 0.0).a;
  let lm = m.a;
  let lMin = min(lm, min(min(nw, ne), min(sw, se)));
  let lMax = max(lm, max(max(nw, ne), max(sw, se)));
  var col = m.rgb;
  if (lMax - lMin >= max(0.0312, lMax * 0.125)) {
    var dir = vec2f(-((nw + ne) - (sw + se)), (nw + sw) - (ne + se));
    let reduce = max((nw + ne + sw + se) * 0.25 * FXAA_REDUCE_MUL, FXAA_REDUCE_MIN);
    let scale = 1.0 / (min(abs(dir.x), abs(dir.y)) + reduce);
    dir = clamp(dir * scale, vec2f(-FXAA_SPAN), vec2f(FXAA_SPAN)) * o;
    let a = 0.5 * (textureSampleLevel(src, samp, uv + dir * (1.0 / 3.0 - 0.5), 0.0).rgb
                 + textureSampleLevel(src, samp, uv + dir * (2.0 / 3.0 - 0.5), 0.0).rgb);
    let b = a * 0.5 + 0.25 * (textureSampleLevel(src, samp, uv + dir * -0.5, 0.0).rgb
                            + textureSampleLevel(src, samp, uv + dir * 0.5, 0.0).rgb);
    let lb = luma(b);
    col = select(b, a, lb < lMin || lb > lMax);
  } else {
    // Flat enough to sharpen: the cross neighbourhood, weighted by how much
    // headroom the pixel has, so already-contrasty detail is left alone.
    let n4 = (textureSampleLevel(src, samp, uv + vec2f(0.0, -o.y), 0.0).rgb
            + textureSampleLevel(src, samp, uv + vec2f(0.0,  o.y), 0.0).rgb
            + textureSampleLevel(src, samp, uv + vec2f(-o.x, 0.0), 0.0).rgb
            + textureSampleLevel(src, samp, uv + vec2f( o.x, 0.0), 0.0).rgb) * 0.25;
    let amount = 0.35 * clamp(1.0 - (lMax - lMin) * 6.0, 0.0, 1.0);
    col = clamp(col + (col - n4) * amount, vec3f(0.0), vec3f(1.0));
  }
  return vec4f(col, 1.0);
}
