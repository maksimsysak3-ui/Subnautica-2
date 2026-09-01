// Facade shading for procedural assets.
//
// Three things carry the look, in order of how much they matter:
//
//   1. Baked ambient occlusion, in the 8th vertex float. Dark inside corners,
//      dark where a wall meets the ground, dark under eaves and balconies.
//      Without it a building is a lit box; with it, it is a building.
//   2. A directional shadow map. Self-shadowing is what puts a roof over a
//      wall and a balcony over the window beneath it.
//   3. Patterns computed from world position -- brick courses, punched
//      windows, curtain-wall mullions, corrugated metal -- with no textures
//      and no UVs. Facade coordinates come from the face normal: a wall facing
//      X uses (z, y), a wall facing Z uses (x, y), a horizontal surface uses
//      (x, z). Because the coordinate is world-space, window rows line up
//      across every wall of a building and across neighbours on the same
//      street without anything being authored.
//
// Two consequences of (3). Facades must be axis-aligned, which these buildings
// are. And every pattern has to fade out as its features approach pixel size,
// or a zoomed-out city turns into aliasing soup -- the lesson the terrain grid
// taught, applied per material.

struct Scene {
  viewProj    : mat4x4f,
  sunViewProj : mat4x4f,
  eye         : vec4f,
  sunDir      : vec4f,
  // x = per-building seed, y = shadow map texel size, z = ground fade radius
  params      : vec4f,
};

@group(0) @binding(0) var<uniform> scene : Scene;
@group(0) @binding(1) var shadowMap : texture_depth_2d;
@group(0) @binding(2) var shadowSampler : sampler_comparison;

const MAT_ROOF      = 0u;
const MAT_HOUSING   = 1u;
const MAT_GLASS     = 2u;
const MAT_METAL     = 3u;
const MAT_BRICK     = 4u;
const MAT_TRIM      = 5u;
const MAT_SHOPFRONT = 6u;
const MAT_TILE      = 7u;
const MAT_GROUND    = 8u;
const MAT_HOUSE     = 9u;
const MAT_SHED      = 10u;

struct VSOut {
  @builtin(position) pos      : vec4f,
  @location(0)       world    : vec3f,
  @location(1)       normal   : vec3f,
  @location(2)       ao       : f32,
  @location(3) @interpolate(flat) material : u32,
};

@vertex
fn vs(@location(0) position : vec3f,
      @location(1) normal   : vec3f,
      @location(2) material : f32,
      @location(3) ao       : f32) -> VSOut {
  var out : VSOut;
  out.world = position;
  out.normal = normal;
  out.ao = ao;
  out.material = u32(material + 0.5);
  out.pos = scene.viewProj * vec4f(position, 1.0);
  return out;
}

/** Depth-only pass from the sun's point of view. */
@vertex
fn vs_shadow(@location(0) position : vec3f) -> @builtin(position) vec4f {
  return scene.sunViewProj * vec4f(position, 1.0);
}

// ---------------------------------------------------------------- utilities

fn hash11(x : f32) -> f32 {
  return fract(sin(x * 127.1) * 43758.5453);
}

fn hash21(p : vec2f) -> f32 {
  let q = fract(p * vec2f(0.1031, 0.1030));
  let r = q + dot(q, q.yx + 33.33);
  return fract((r.x + r.y) * r.x * 47.0);
}

/** Facade coordinates in metres, chosen by which way the surface faces. */
fn facadeUV(world : vec3f, n : vec3f) -> vec2f {
  if (abs(n.y) > 0.6) { return world.xz; }
  if (abs(n.x) > abs(n.z)) { return vec2f(world.z, world.y); }
  return vec2f(world.x, world.y);
}

// Every pattern below takes `mpp` -- metres per pixel -- rather than calling
// fwidth itself. WGSL requires derivatives in uniform control flow and the
// material switch is anything but, so it is measured once in the fragment
// entry point and threaded through.

fn resolvable(feature : f32, mpp : f32) -> f32 {
  return smoothstep(1.2, 4.0, feature / mpp);
}

fn inRect(p : vec2f, centre : vec2f, half : vec2f, mpp : f32) -> f32 {
  let d = abs(p - centre) - half;
  let aa = mpp * 1.1 + 1e-5;
  return 1.0 - smoothstep(-aa, aa, max(d.x, d.y));
}

fn stripe(v : f32, spacing : f32, width : f32, mpp : f32) -> f32 {
  let c = v / spacing;
  let d = abs(fract(c) - 0.5) * spacing;
  let aa = mpp * 0.8 + 1e-5;
  return 1.0 - smoothstep(width - aa, width + aa, d);
}

// ----------------------------------------------------------------- palettes
//
// Each building draws its colours from the seed, so a street of the same
// prototype is not a street of clones. Real cities vary far more in colour
// than in shape, and this is by a distance the cheapest variety available.

fn brickColour(seed : f32) -> vec3f {
  let r = hash11(seed * 1.7);
  if (r < 0.34) { return vec3f(0.372, 0.192, 0.145); }   // red stock
  if (r < 0.58) { return vec3f(0.404, 0.310, 0.216); }   // buff
  if (r < 0.80) { return vec3f(0.286, 0.230, 0.208); }   // dark multi
  return vec3f(0.470, 0.404, 0.348);                     // pale grey
}

fn renderColour(seed : f32) -> vec3f {
  let r = hash11(seed * 3.1 + 4.0);
  if (r < 0.26) { return vec3f(0.560, 0.520, 0.440); }   // cream
  if (r < 0.48) { return vec3f(0.400, 0.412, 0.396); }   // grey-green
  if (r < 0.68) { return vec3f(0.470, 0.452, 0.428); }   // warm grey
  if (r < 0.86) { return vec3f(0.352, 0.372, 0.400); }   // cool grey
  return vec3f(0.520, 0.436, 0.384);                     // sand
}

fn tileColour(seed : f32) -> vec3f {
  let r = hash11(seed * 5.3 + 9.0);
  if (r < 0.36) { return vec3f(0.318, 0.168, 0.116); }   // terracotta
  if (r < 0.66) { return vec3f(0.196, 0.200, 0.212); }   // slate
  return vec3f(0.232, 0.184, 0.152);                     // brown
}

fn glassColour(seed : f32) -> vec3f {
  let r = hash11(seed * 7.9 + 2.0);
  if (r < 0.40) { return vec3f(0.086, 0.128, 0.156); }   // blue
  if (r < 0.72) { return vec3f(0.092, 0.132, 0.120); }   // green
  return vec3f(0.120, 0.122, 0.134);                     // neutral
}

fn metalColour(seed : f32) -> vec3f {
  let r = hash11(seed * 11.3 + 6.0);
  if (r < 0.38) { return vec3f(0.400, 0.416, 0.424); }   // galvanised
  if (r < 0.66) { return vec3f(0.318, 0.360, 0.384); }   // blue-grey
  return vec3f(0.336, 0.372, 0.336);                     // green-grey
}

// ----------------------------------------------------------------- patterns

fn housing(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let bay = 3.0;
  let floorH = 3.05;
  let wall = renderColour(seed);

  let cell = vec2f(bay, floorH);
  let id = floor(uv / cell);
  let p = (uv / cell - id) * cell;

  let centre = vec2f(bay * 0.5, 1.62);
  let win = inRect(p, centre, vec2f(0.72, 0.72), mpp);
  // A darker ring just outside the glass fakes the reveal, so even the
  // 20-triangle variant has openings that sit in the wall rather than on it.
  let reveal = inRect(p, centre, vec2f(0.84, 0.84), mpp) - win;

  let r = hash21(id + seed);
  var glass = glassColour(seed) * (0.72 + r * 0.85);
  if (r > 0.88) { glass = vec3f(0.66, 0.58, 0.38); }     // a lit room

  var col = mix(wall, wall * 0.62, reveal);
  col = mix(col, glass, win);
  // Sill under each opening.
  col = mix(col, wall * 1.24, inRect(p, vec2f(bay * 0.5, 0.84), vec2f(0.88, 0.055), mpp));
  // Floor line, faint.
  col = mix(col, wall * 0.88, stripe(uv.y, floorH, 0.03, mpp) * 0.5);
  return mix(wall, col, resolvable(1.4, mpp));
}

fn curtainWall(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let floorH = 3.6;
  let mullion = 1.5;
  let glass = glassColour(seed);
  let spandrel = mix(renderColour(seed), vec3f(0.2), 0.35);

  let band = step(fract(uv.y / floorH), 0.26);
  var col = mix(glass, spandrel, band);

  // Per-pane variation: reflections of sky and of the building opposite never
  // match pane to pane, and a curtain wall without that reads as painted-on.
  let id = floor(vec2f(uv.x / mullion, uv.y / floorH));
  let r = hash21(id + seed * 1.7);
  col = mix(col, col * (0.62 + r * 1.05), 1.0 - band);
  if (r > 0.94) { col = mix(col, vec3f(0.56, 0.52, 0.40), 0.55 * (1.0 - band)); }

  let bars = max(stripe(uv.x, mullion, 0.035, mpp), stripe(uv.y, floorH, 0.05, mpp));
  col = mix(col, vec3f(0.30, 0.31, 0.33), bars * resolvable(0.8, mpp));
  return mix(glass, col, resolvable(1.8, mpp));
}

fn corrugated(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let base = metalColour(seed);
  // Ribs shaded by a cosine rather than a drawn line, so they read as a folded
  // sheet catching light rather than as stripes painted on a flat wall.
  let rib = cos(uv.x * 6.2831853 / 0.28) * 0.5 + 0.5;
  var col = base * (0.80 + rib * 0.38);
  col = mix(col, base * 0.70, stripe(uv.y, 2.4, 0.03, mpp));
  // Streaking below the seams. Industrial buildings are never clean.
  let streak = hash21(vec2f(floor(uv.x * 3.0), 0.0) + seed) * 0.10;
  col = mix(col, col * (1.0 - streak), fract(uv.y / 2.4));
  return mix(base, col, resolvable(0.28, mpp));
}

fn brick(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let course = 0.085;
  let brickLen = 0.24;
  let row = floor(uv.y / course);
  // Every other course offset by half a brick: running bond, not stack bond.
  let offset = fract(row * 0.5) * brickLen;
  let mortar = max(stripe(uv.y, course, 0.011, mpp), stripe(uv.x + offset, brickLen, 0.011, mpp));
  let r = hash21(vec2f(floor((uv.x + offset) / brickLen), row) + seed);
  let body = brickColour(seed) * (0.80 + r * 0.40);
  return mix(body, vec3f(0.46, 0.45, 0.435), mortar * 0.65 * resolvable(0.085, mpp));
}

/**
 * Brick with punched windows, sills and a door.
 *
 * The composite materials exist so a 26-triangle house still has openings.
 * Sculpted variants model theirs and use plain BRICK instead; drawing both
 * would put a painted window inside a modelled one.
 */
fn houseWall(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  var col = brick(uv, mpp, seed);

  let bay = 3.1;
  let floorH = 2.85;
  let cell = vec2f(bay, floorH);
  let id = floor(uv / cell);
  let p = (uv / cell - id) * cell;

  // Ground floor windows sit higher off the floor than upper ones, and one
  // bay per building is a door instead.
  let isGround = f32(uv.y < floorH);
  let centre = vec2f(bay * 0.5, mix(1.62, 1.32, isGround));
  let half = vec2f(0.62, mix(0.62, 0.68, isGround));

  let r = hash21(id + seed);
  let win = inRect(p, centre, half, mpp);
  let reveal = inRect(p, centre, half + vec2f(0.14), mpp) - win;

  var glass = glassColour(seed) * (0.66 + r * 0.8);
  if (r > 0.85) { glass = vec3f(0.60, 0.53, 0.35); }

  col = mix(col, col * 0.55, reveal);
  col = mix(col, glass, win);
  // Lintel over each opening, and a sill under it.
  col = mix(col, vec3f(0.60, 0.58, 0.55), inRect(p, vec2f(bay * 0.5, centre.y + half.y + 0.12), vec2f(half.x + 0.18, 0.06), mpp));
  col = mix(col, vec3f(0.62, 0.60, 0.57), inRect(p, vec2f(bay * 0.5, centre.y - half.y - 0.09), vec2f(half.x + 0.20, 0.055), mpp));

  // A door in one ground-floor bay.
  let doorBay = floor(hash11(seed * 2.3) * 3.0);
  if (isGround > 0.5 && abs(id.x - doorBay) < 0.5) {
    let door = inRect(p, vec2f(bay * 0.5, 1.05), vec2f(0.44, 1.02), mpp);
    col = mix(col, vec3f(0.20, 0.16, 0.13), door);
  }
  return mix(brick(uv, mpp, seed), col, resolvable(1.2, mpp));
}

/** Corrugated metal with a clerestory band, the way a shed is actually lit. */
fn shedWall(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  var col = corrugated(uv, mpp, seed);

  // A glazed band every 12 m of height. Generic rather than placed, because
  // the shader has no idea how tall the building is -- one band lands on any
  // shed between about 7 and 19 metres, which is all of them.
  let band = fract(uv.y / 12.0);
  let inBand = smoothstep(0.545, 0.565, band) * (1.0 - smoothstep(0.715, 0.735, band));
  let pane = stripe(uv.x, 2.1, 0.06, mpp);
  var glass = glassColour(seed) * 0.75;
  glass = mix(glass, vec3f(0.30, 0.32, 0.33), pane);
  col = mix(col, glass, inBand * resolvable(1.6, mpp));

  // Sill flashing under the band.
  col = mix(col, vec3f(0.46, 0.48, 0.50), inBand * 0.0 + stripe(uv.y - 6.55, 12.0, 0.06, mpp) * 0.5);
  return col;
}

fn shopfront(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let glass = glassColour(seed) * 0.8;
  let stall = renderColour(seed) * 0.5;
  var col = mix(glass, stall, step(uv.y, 0.55));
  // Lit interiors and signage: shops are the brightest thing at street level
  // and the main reason a night city reads as inhabited.
  let bay = floor(uv.x / 2.6);
  let r = hash11(bay * 1.31 + seed);
  if (r > 0.45) {
    col = mix(col, vec3f(0.62, 0.56, 0.42) * (0.6 + r * 0.7), (1.0 - step(uv.y, 0.55)) * 0.6);
  }
  col = mix(col, vec3f(0.28, 0.29, 0.30), stripe(uv.x, 2.6, 0.05, mpp) * resolvable(1.4, mpp));
  return col;
}

fn tiles(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let base = tileColour(seed);
  let course = 0.30;
  let r = hash21(floor(uv / vec2f(0.22, course)) + seed);
  let col = base * (0.84 + r * 0.34);
  return mix(base, mix(col, base * 0.66, stripe(uv.y, course, 0.022, mpp)), resolvable(0.30, mpp));
}

fn roofDeck(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let base = vec3f(0.168, 0.174, 0.180);
  let r = hash21(floor(uv / 1.1) + seed);
  var col = base * (0.86 + r * 0.30);
  // Seams in the membrane, and a little staining.
  col = mix(col, col * 0.86, stripe(uv.x, 1.1, 0.02, mpp) * resolvable(1.1, mpp));
  return col;
}

fn ground(uv : vec2f, mpp : f32) -> vec3f {
  let base = vec3f(0.085, 0.092, 0.100);
  let r = hash21(floor(uv / 0.9));
  var col = base * (0.9 + r * 0.2);
  // The 8 m zoning cell, so an asset's size is readable against the grid the
  // simulation actually uses.
  col = mix(col, vec3f(0.150, 0.176, 0.200), stripe(uv.x, 8.0, 0.035, mpp) * resolvable(8.0, mpp) * 0.8);
  col = mix(col, vec3f(0.150, 0.176, 0.200), stripe(uv.y, 8.0, 0.035, mpp) * resolvable(8.0, mpp) * 0.8);
  return col;
}

fn albedo(mat : u32, uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  switch (mat) {
    case 1u: { return housing(uv, mpp, seed); }
    case 2u: { return curtainWall(uv, mpp, seed); }
    case 3u: { return corrugated(uv, mpp, seed); }
    case 4u: { return brick(uv, mpp, seed); }
    case 5u: { return mix(renderColour(seed), vec3f(0.62), 0.55); }
    case 6u: { return shopfront(uv, mpp, seed); }
    case 7u: { return tiles(uv, mpp, seed); }
    case 8u: { return ground(uv, mpp); }
    case 9u: { return houseWall(uv, mpp, seed); }
    case 10u: { return shedWall(uv, mpp, seed); }
    default: { return roofDeck(uv, mpp, seed); }
  }
}

// ------------------------------------------------------------------ shadows

fn shadowFactor(world : vec3f, ndl : f32) -> f32 {
  let lightSpace = scene.sunViewProj * vec4f(world, 1.0);
  let ndc = lightSpace.xyz / lightSpace.w;
  let uv = ndc.xy * vec2f(0.5, -0.5) + 0.5;

  // Outside the shadow volume, or past the far plane, nothing is shadowed.
  // Computed as a weight rather than an early return: textureSampleCompare,
  // like fwidth, must be reached in uniform control flow, so the sampling has
  // to happen for every fragment and the result is blended afterwards.
  let outside = f32(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || ndc.z > 1.0);
  let safeUV = clamp(uv, vec2f(0.001), vec2f(0.999));

  // Slope-scaled bias: a surface nearly edge-on to the sun needs far more
  // bias than one facing it, and a single constant either acnes the flat
  // faces or peters the contact shadows away.
  let bias = clamp(0.0016 * tan(acos(clamp(ndl, 0.0, 1.0))), 0.0006, 0.006);
  let texel = scene.params.y;

  var sum = 0.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let o = vec2f(f32(x), f32(y)) * texel;
      sum += textureSampleCompare(shadowMap, shadowSampler, safeUV + o, ndc.z - bias);
    }
  }
  return mix(sum / 9.0, 1.0, outside);
}

// ----------------------------------------------------------------- fragment

@fragment
fn fs(in : VSOut) -> @location(0) vec4f {
  let n = normalize(in.normal);
  let uv = facadeUV(in.world, n);
  // Taken here, in uniform control flow, then passed down.
  let mpp = max(max(fwidth(uv.x), fwidth(uv.y)), 1e-6);
  let seed = scene.params.x;
  var col = albedo(in.material, uv, mpp, seed);

  let sun = normalize(scene.sunDir.xyz);
  let ndl = dot(n, sun);
  let shadow = shadowFactor(in.world, ndl);

  // Sky above, bounce from the ground below, both modulated by occlusion.
  let sky = vec3f(0.34, 0.40, 0.50);
  let bounce = vec3f(0.24, 0.21, 0.18);
  let ambient = mix(bounce, sky, n.y * 0.5 + 0.5) * in.ao;

  let sunColour = vec3f(1.02, 0.94, 0.80);
  let direct = sunColour * max(ndl, 0.0) * shadow * 1.15;

  col = col * (ambient + direct);

  // Specular on the smooth materials only. Masonry does not shine.
  if (in.material == MAT_GLASS || in.material == MAT_SHOPFRONT
      || in.material == MAT_METAL || in.material == MAT_SHED) {
    let v = normalize(scene.eye.xyz - in.world);
    let h = normalize(v + sun);
    let spec = pow(max(dot(n, h), 0.0), 64.0) * shadow * in.ao;
    col += vec3f(0.70, 0.72, 0.76) * spec * 0.55;
  }

  // Ground fades to the background rather than ending at a visible edge.
  if (in.material == MAT_GROUND) {
    let d = length(in.world.xz) / max(scene.params.z, 1.0);
    col = mix(col, vec3f(0.043, 0.055, 0.075), smoothstep(0.45, 1.0, d));
  }

  // Filmic-ish shoulder: keeps sunlit render and glass highlights from
  // clipping to flat white, which is most of why untonemapped renders look
  // like plastic.
  col = col / (col + vec3f(0.72)) * 1.42;
  return vec4f(pow(col, vec3f(0.9)), 1.0);
}

@fragment
fn fs_wire() -> @location(0) vec4f {
  return vec4f(0.38, 0.83, 1.0, 1.0);
}
