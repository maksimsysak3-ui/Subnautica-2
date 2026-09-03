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
  /** Primary brand colour: fascia signs, awnings, painted trim. */
  brand       : vec4f,
  /** Secondary: stripes, doors, sign returns. */
  accent      : vec4f,
  /** The brand name, four characters packed per component, 16 max. */
  signText    : vec4u,
  /** x = character count. */
  signInfo    : vec4f,
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
const MAT_CONCRETE  = 11u;
const MAT_PLASTER   = 12u;
const MAT_PANE      = 13u;
const MAT_ROOF_TILE = 14u;
const MAT_PAINT     = 18u;
const MAT_PLATE     = 20u;
const MAT_TYRE      = 21u;
const MAT_DARK      = 22u;
const MAT_RENDER    = 23u;
const MAT_CAR_GLASS = 24u;
const MAT_STONE     = 15u;
const MAT_CLADDING  = 16u;
const MAT_TIMBER    = 17u;

struct VSOut {
  @builtin(position) pos      : vec4f,
  @location(0)       world    : vec3f,
  @location(1)       normal   : vec3f,
  @location(2)       ao       : f32,
  @location(3) @interpolate(flat) material : u32,
  @location(4) @interpolate(flat) tint     : u32,
  @location(5)       local    : vec2f,
  @location(6) @interpolate(flat) key : f32,
};

@vertex
fn vs(@location(0) position : vec3f,
      @location(1) normal   : vec3f,
      @location(2) material : f32,
      @location(3) ao       : f32,
      @location(4) tint     : f32,
      @location(5) local    : vec2f,
      @location(6) key      : f32) -> VSOut {
  var out : VSOut;
  out.world = position;
  out.normal = normal;
  out.ao = ao;
  out.material = u32(material + 0.5);
  out.tint = u32(tint + 0.5);
  out.local = local;
  // Flat, so it never carries interpolation wobble into a hash.
  out.key = key;
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
  if (r < 0.17) { return vec3f(0.372, 0.192, 0.145); }   // red stock
  if (r < 0.30) { return vec3f(0.456, 0.226, 0.158); }   // orange stock
  if (r < 0.44) { return vec3f(0.404, 0.310, 0.216); }   // buff
  if (r < 0.55) { return vec3f(0.452, 0.396, 0.268); }   // yellow london
  if (r < 0.68) { return vec3f(0.286, 0.230, 0.208); }   // dark multi
  if (r < 0.78) { return vec3f(0.212, 0.166, 0.166); }   // engineering blue
  if (r < 0.90) { return vec3f(0.470, 0.404, 0.348); }   // pale grey
  return vec3f(0.560, 0.520, 0.470);                     // whitewashed
}

fn renderColour(seed : f32) -> vec3f {
  let r = hash11(seed * 3.1 + 4.0);
  if (r < 0.13) { return vec3f(0.560, 0.520, 0.440); }   // cream
  if (r < 0.24) { return vec3f(0.400, 0.412, 0.396); }   // grey-green
  if (r < 0.36) { return vec3f(0.470, 0.452, 0.428); }   // warm grey
  if (r < 0.47) { return vec3f(0.352, 0.372, 0.400); }   // cool grey
  if (r < 0.58) { return vec3f(0.520, 0.436, 0.384); }   // sand
  if (r < 0.68) { return vec3f(0.604, 0.580, 0.532); }   // off-white
  if (r < 0.77) { return vec3f(0.446, 0.352, 0.318); }   // clay
  if (r < 0.86) { return vec3f(0.318, 0.360, 0.372); }   // slate blue
  if (r < 0.94) { return vec3f(0.396, 0.428, 0.376); }   // sage
  return vec3f(0.556, 0.446, 0.350);                     // ochre
}

fn tileColour(seed : f32) -> vec3f {
  let r = hash11(seed * 5.3 + 9.0);
  if (r < 0.22) { return vec3f(0.318, 0.168, 0.116); }   // terracotta
  if (r < 0.38) { return vec3f(0.372, 0.212, 0.130); }   // orange pantile
  if (r < 0.56) { return vec3f(0.196, 0.200, 0.212); }   // slate
  if (r < 0.68) { return vec3f(0.146, 0.150, 0.158); }   // dark slate
  if (r < 0.80) { return vec3f(0.232, 0.184, 0.152); }   // brown
  if (r < 0.90) { return vec3f(0.268, 0.256, 0.220); }   // weathered grey
  return vec3f(0.204, 0.226, 0.204);                     // green slate
}

fn stoneColour(seed : f32) -> vec3f {
  let r = hash11(seed * 13.7 + 21.0);
  if (r < 0.30) { return vec3f(0.586, 0.556, 0.482); }   // limestone
  if (r < 0.55) { return vec3f(0.548, 0.488, 0.404); }   // bath stone
  if (r < 0.75) { return vec3f(0.470, 0.470, 0.462); }   // granite grey
  if (r < 0.90) { return vec3f(0.512, 0.428, 0.372); }   // sandstone
  return vec3f(0.406, 0.400, 0.412);                     // dark granite
}

/**
 * Composite cladding panels: the one material in the set allowed a saturated
 * colour. Modern buildings get most of their identity from these, and without
 * them every post-1990 asset is another grey box.
 */
fn claddingColour(seed : f32) -> vec3f {
  let r = hash11(seed * 17.1 + 33.0);
  if (r < 0.16) { return vec3f(0.196, 0.216, 0.230); }   // anthracite
  if (r < 0.30) { return vec3f(0.622, 0.612, 0.586); }   // white
  if (r < 0.43) { return vec3f(0.412, 0.184, 0.140); }   // oxide red
  if (r < 0.56) { return vec3f(0.146, 0.286, 0.316); }   // teal
  if (r < 0.68) { return vec3f(0.556, 0.436, 0.176); }   // mustard
  if (r < 0.79) { return vec3f(0.226, 0.310, 0.216); }   // olive
  if (r < 0.90) { return vec3f(0.174, 0.216, 0.320); }   // navy
  return vec3f(0.500, 0.352, 0.244);                     // burnt orange
}

fn timberColour(seed : f32) -> vec3f {
  let r = hash11(seed * 19.3 + 45.0);
  if (r < 0.28) { return vec3f(0.372, 0.268, 0.164); }   // larch
  if (r < 0.52) { return vec3f(0.286, 0.216, 0.150); }   // stained dark
  if (r < 0.74) { return vec3f(0.436, 0.362, 0.268); }   // weathered silver
  return vec3f(0.318, 0.180, 0.118);                     // creosote
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

fn housing(uv : vec2f, mpp : f32, seed : f32, par : vec2f) -> vec3f {
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
  // The room behind the opening, mixed with what the pane reflects.
  let inside = room((p - centre + vec2f(0.72, 0.72)) / 1.44, par, r, r > 0.82);
  let glass = mix(glassColour(seed) * (0.9 + r * 0.5), inside, 0.72);

  var col = mix(wall, wall * 0.62, reveal);
  col = mix(col, glass, win);
  // Sill under each opening.
  col = mix(col, wall * 1.24, inRect(p, vec2f(bay * 0.5, 0.84), vec2f(0.88, 0.055), mpp));
  // Floor line, faint.
  col = mix(col, wall * 0.88, stripe(uv.y, floorH, 0.03, mpp) * 0.5);
  return mix(wall, col, resolvable(1.4, mpp));
}

fn curtainWall(uv : vec2f, mpp : f32, seed : f32, par : vec2f) -> vec3f {
  let floorH = 3.6;
  let mullion = 1.5;
  let glass = glassColour(seed);
  let spandrel = mix(renderColour(seed), vec3f(0.2), 0.35);

  let band = step(fract(uv.y / floorH), 0.26);
  let cell = vec2f(mullion, floorH);
  let id = floor(uv / cell);
  let r = hash21(id + seed * 1.7);

  // The office behind each pane, then the sky reflected off the front of it.
  // A curtain wall is both at once, which is why a flat blue box never looks
  // like one.
  let inside = room(vec2f(fract(uv.x / mullion), fract((uv.y - floorH * 0.26) / (floorH * 0.74))),
                    par, r, r > 0.72);
  var col = mix(mix(glass, inside, 0.62), spandrel, band);
  // Reflection gradient: brighter towards the top of the tower, where more
  // sky is in the mirror. Without it a curtain wall is the same value for
  // forty storeys, which no glass building has ever been.
  let sky = clamp((uv.y / max(floorH * 12.0, 1.0)) * 0.5 + 0.25, 0.0, 1.0);
  col = mix(col, glassColour(seed) * (1.4 + r * 0.6), sky * 0.42 * (1.0 - band));
  // And a faint horizontal banding, one storey apart, from the floor slabs
  // showing through the spandrel line.
  col = col * (1.0 - 0.06 * step(0.9, fract(uv.y / floorH)));

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
fn houseWall(uv : vec2f, mpp : f32, seed : f32, par : vec2f) -> vec3f {
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

  let inside = room((p - centre + half) / (half * 2.0), par, r, r > 0.78);
  let glass = mix(glassColour(seed) * (0.85 + r * 0.4), inside, 0.74);

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

fn shopfront(uv : vec2f, mpp : f32, seed : f32, par : vec2f) -> vec3f {
  let bay = floor(uv.x / 2.6);
  let rr = hash11(bay * 1.31 + seed);
  // A shop interior is lit and full, which is what makes a street at dusk
  // read as open for business.
  let inside = room(vec2f(fract(uv.x / 2.6), clamp((uv.y - 0.55) / 2.6, 0.0, 1.0)), par, rr, true);
  let glass = mix(glassColour(seed) * 0.9, inside, 0.8);
  let stall = renderColour(seed) * 0.5;
  var col = mix(glass, stall, step(uv.y, 0.55));
  // Lit interiors and signage: shops are the brightest thing at street level
  // and the main reason a night city reads as inhabited.
  if (rr > 0.45) {
    col = mix(col, vec3f(0.62, 0.56, 0.42) * (0.5 + rr * 0.5), (1.0 - step(uv.y, 0.55)) * 0.28);
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

/**
 * Pitched roof covering: overlapping courses with a broken vertical joint.
 *
 * A pitched roof was using the flat-roof membrane pattern, which is why every
 * house had a grey lid on it. A roof is a third of a low-density building's
 * visible surface and it deserves its own material.
 */
fn roofTile(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let base = tileColour(seed);
  let course = 0.26;
  let width = 0.19;
  let row = floor(uv.y / course);
  let offset = fract(row * 0.5) * width;
  let r = hash21(vec2f(floor((uv.x + offset) / width), row) + seed);
  var col = base * (0.86 + r * 0.30);
  // The shadow line under each course is what makes tiles read as overlapping
  // rather than as a printed grid.
  let lap = smoothstep(0.0, 0.16, fract(uv.y / course));
  col = mix(col * 0.62, col, mix(1.0, lap, resolvable(course, mpp)));
  col = mix(col, col * 0.86, stripe(uv.x + offset, width, 0.008, mpp) * resolvable(width, mpp));
  return col;
}

/** Coursed ashlar: big blocks, fine joints, no colour variation to speak of. */
fn stone(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let base = stoneColour(seed);
  let course = 0.42;
  let blockW = 0.86;
  let row = floor(uv.y / course);
  let offset = fract(row * 0.5) * blockW;
  let r = hash21(vec2f(floor((uv.x + offset) / blockW), row) + seed);
  var col = base * (0.94 + r * 0.12);
  let joint = max(stripe(uv.y, course, 0.010, mpp), stripe(uv.x + offset, blockW, 0.010, mpp));
  return mix(col, base * 0.80, joint * resolvable(course, mpp));
}

/** Rainscreen cladding: large flat panels with a shadow gap between them. */
fn cladding(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let base = claddingColour(seed);
  let pw = 1.15;
  let ph = 0.90;
  let cell = floor(uv / vec2f(pw, ph));
  let r = hash21(cell + seed);
  // Panels of one colour still vary slightly batch to batch, and that tiny
  // variation is most of what stops a flat plane looking like plastic.
  var col = base * (0.95 + r * 0.10);
  let gap = max(stripe(uv.x, pw, 0.014, mpp), stripe(uv.y, ph, 0.014, mpp));
  return mix(col, base * 0.52, gap * resolvable(ph, mpp));
}

/** Vertical boarding with battens. */
fn timber(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let base = timberColour(seed);
  let board = 0.145;
  let b = floor(uv.x / board);
  let r = hash21(vec2f(b, 0.0) + seed);
  var col = base * (0.86 + r * 0.30);
  // Grain, then the shadow line at each board edge.
  let grain = hash21(vec2f(b, floor(uv.y * 6.0)) + seed) * 0.07;
  col = col * (0.97 + grain);
  col = mix(col, base * 0.58, stripe(uv.x, board, 0.009, mpp) * resolvable(board, mpp));
  return col;
}

/**
 * Painted trim: cornices, copings, frames, eaves.
 *
 * This was a flat mix of the render colour towards mid grey, which is why so
 * much of the library read as one beige. Trim is nearly always the lightest
 * plane on a building and it is what gives a facade its edges, so it is a
 * near-white now, carrying only a trace of the building's own colour so a
 * cream building's cornice is warm and a slate one's is cool.
 */
fn trim(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let tinted = mix(vec3f(0.640, 0.638, 0.628), renderColour(seed), 0.20);
  // A faint horizontal grain, and the dirt that collects on an upward face.
  let g = hash21(vec2f(floor(uv.x * 1.4), floor(uv.y * 2.6)) + seed) * 0.05;
  return tinted * (0.975 + g);
}

/**
 * Flat roof. In a city builder played from above this is the single most
 * visible surface in the game, so it gets more than one grey: gravel grain,
 * membrane seams both ways, and patches where water has stood.
 */
fn roofDeck(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let base = mix(vec3f(0.168, 0.174, 0.180), vec3f(0.222, 0.212, 0.196),
                 hash11(seed * 2.3 + 17.0));
  let grain = hash21(floor(uv * 7.0) + seed);
  var col = base * (0.88 + grain * 0.26);
  // Bay pattern: sheets are laid in strips and lapped, both directions.
  let bay = hash21(floor(uv / 1.6) + seed);
  col = col * (0.94 + bay * 0.14);
  let seam = max(stripe(uv.x, 1.6, 0.022, mpp), stripe(uv.y, 3.2, 0.022, mpp));
  col = mix(col, col * 0.82, seam * resolvable(1.6, mpp));
  // Ponding: a soft darker blotch here and there, which is what stops a big
  // flat roof reading as a single flat colour from directly overhead.
  let pond = hash21(floor(uv / 4.5) + seed * 3.1);
  col = mix(col, col * 0.86, smoothstep(0.62, 0.95, pond) * resolvable(4.5, mpp));
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

/**
 * What is behind the glass.
 *
 * Windows that are only a frame and a flat blue pane read as stickers. A room
 * costs nothing to draw: a back wall, a floor, a ceiling with a light on it,
 * a blind pulled down at a random height, and a block of furniture. The
 * parallax offset -- computed from the view direction in the fragment entry
 * point -- is what sells it, because the room shifts as the camera moves the
 * way a real recess does.
 */
fn room(local : vec2f, par : vec2f, r : f32, lit : bool) -> vec3f {
  // Shift the contents against the view, and keep them inside the opening.
  let p = clamp(local + par, vec2f(0.0), vec2f(1.0));

  // A room is mostly a dark box with a bright ceiling. Build it out of smooth
  // gradients rather than hard rectangles: the first version scattered
  // sharp-edged furniture at random positions and a whole facade of it read
  // as noise rather than as windows.
  let depthShade = mix(0.55, 1.0, smoothstep(0.0, 0.75, p.y));
  var col = vec3f(0.062, 0.060, 0.066) * (0.75 + r * 0.5) * depthShade;

  // Ceiling: the brightest thing in any room seen from outside.
  col = mix(col, vec3f(0.150, 0.148, 0.142), smoothstep(0.74, 0.99, p.y));
  // Floor, catching a little light near the window.
  col = mix(col, vec3f(0.086, 0.078, 0.070), smoothstep(0.26, 0.02, p.y));

  // One soft mass in the lower half -- furniture, a counter, a desk. Blurred
  // at the edges so it reads as something in shadow rather than as a sticker.
  let fx = 0.18 + fract(r * 7.3) * 0.5;
  let fw = 0.14 + fract(r * 3.1) * 0.2;
  let mass = smoothstep(fw + 0.09, fw - 0.02, abs(p.x - fx))
           * smoothstep(0.42, 0.30, p.y);
  col = mix(col, vec3f(0.070, 0.062, 0.058), mass * 0.85);

  if (lit) {
    // Warm light, brightest at the ceiling and falling off downwards.
    let glow = smoothstep(0.0, 0.95, p.y);
    col = mix(col, vec3f(0.58, 0.47, 0.31), 0.22 + glow * 0.5);
  }

  // A blind, pulled to a height that varies per opening. Drawn as a flat
  // panel: slats at this scale are a moire generator.
  let blind = fract(r * 11.7);
  if (fract(r * 2.9) > 0.5) {
    let edge = 1.0 - (0.28 + blind * 0.52);
    col = mix(col, vec3f(0.255, 0.248, 0.232) * (0.85 + r * 0.3),
              smoothstep(edge - 0.02, edge + 0.02, p.y) * 0.94);
  }
  return col;
}

fn concrete(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let base = vec3f(0.330, 0.334, 0.336);
  let r = hash21(floor(uv / vec2f(2.4, 1.2)) + seed);
  var col = base * (0.90 + r * 0.20);
  // Panel joints. Precast reads as panels or it reads as nothing.
  col = mix(col, base * 0.74, max(stripe(uv.x, 2.4, 0.022, mpp), stripe(uv.y, 1.2, 0.022, mpp))
                              * resolvable(1.2, mpp));
  return col;
}

fn plaster(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let base = renderColour(seed) * 1.08;
  let r = hash21(floor(uv * 3.0) + seed) * 0.06;
  return base * (0.97 + r);
}

/**
 * Brand palette. A tint index paints a surface instead of patterning it, which
 * is how one shopfront generator makes a green grocer and a red diner.
 */
fn palette(i : u32, uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let brand = scene.brand.rgb;
  let accent = scene.accent.rgb;
  switch (i) {
    case 1u: { return brand; }
    case 2u: { return brand * 0.48; }
    case 3u: { return accent; }
    // Illuminated fascia: brighter than the paint and lifted towards white,
    // so a sign reads as lit rather than merely coloured.
    // Lifted only slightly towards white: pushed further it desaturates into
    // pink and the brand stops being readable, which is what the first attempt
    // did to every sign in the city.
    case 4u: { return mix(brand, vec3f(1.0), 0.16) * 1.18; }
    case 5u: { return accent * 0.55; }
    // Awning: alternating bands, the width of real canvas stripes.
    case 6u: {
      let band = step(0.5, fract(uv.x / 0.42));
      return mix(brand, mix(brand, vec3f(0.92), 0.75), band);
    }
    case 7u: { return vec3f(0.088, 0.092, 0.098); }
    case 8u: {
      let grain = hash21(vec2f(floor(uv.x * 8.0), floor(uv.y * 1.2)) + seed);
      return vec3f(0.238, 0.170, 0.108) * (0.88 + grain * 0.3);
    }
    case 9u: {
      let leaf = hash21(floor(uv * 5.0) + seed);
      return vec3f(0.118, 0.212, 0.108) * (0.75 + leaf * 0.6);
    }
    default: { return brand; }
  }
}


// ------------------------------------------------------- paint and figures
//
// Both read the part key out of the local-uv x channel rather than the
// building seed, so one asset can hold ten cars in ten colours, or a crowd in
// a dozen different coats, without a material or a draw call per colour.

/**
 * Automotive paint, with the panel work drawn rather than modelled.
 *
 * `surf` is the body's own surface coordinate -- u nose to tail, v sill to
 * roof -- written by the loft. Shut lines, the waist crease and the shadow in
 * the sill are drawn from it. They were geometry first, and every one of them
 * floated: a 15mm box placed at a fixed half-width sits proud where the body
 * narrows and sinks in where it swells, and a car is nothing but curves.
 */
fn carPaint(surf : vec2f, d : vec2f, key : f32) -> vec3f {
  // Quantise first. The key arrives interpolated across the triangle, so it
  // carries float wobble of about 1e-5 -- harmless anywhere else, but hash11
  // multiplies its argument by 127 inside a sin and scales the result by
  // 43758, which turns that wobble into full-range salt-and-pepper noise. The
  // whole first fleet came out looking sprayed with glitter.
  let k = floor(key + 0.5);
  let r = hash11(k * 7.31 + 3.7);
  var base : vec3f;
  if (r < 0.13)      { base = vec3f(0.520, 0.062, 0.058); }  // red
  else if (r < 0.24) { base = vec3f(0.055, 0.128, 0.330); }  // deep blue
  else if (r < 0.35) { base = vec3f(0.640, 0.648, 0.660); }  // silver
  else if (r < 0.46) { base = vec3f(0.038, 0.042, 0.050); }  // black
  else if (r < 0.56) { base = vec3f(0.780, 0.786, 0.790); }  // white
  else if (r < 0.65) { base = vec3f(0.086, 0.240, 0.150); }  // racing green
  else if (r < 0.74) { base = vec3f(0.660, 0.420, 0.055); }  // amber
  else if (r < 0.82) { base = vec3f(0.180, 0.196, 0.220); }  // graphite
  else if (r < 0.90) { base = vec3f(0.420, 0.140, 0.320); }  // plum
  else               { base = vec3f(0.090, 0.330, 0.400); }  // teal
  var col = base * (0.92 + hash11(k * 2.13) * 0.16);

  let u = surf.x;
  let v = surf.y;
  // Derivatives are taken at the entry point and passed in: fwidth may only
  // be called from uniform control flow, and this sits inside a switch.
  let du = max(d.x, 1e-5);
  let dv = max(d.y, 1e-5);

  // Shut lines: three, with a rebate shadow on one side and a highlight on the
  // other, so a gap reads as a gap and not as a drawn line.
  let cuts = array<f32, 3>(0.30, 0.52, 0.74);
  var gap = 0.0;
  var lip = 0.0;
  for (var i = 0; i < 3; i = i + 1) {
    let d = u - cuts[i];
    gap = max(gap, 1.0 - smoothstep(0.0035, 0.0035 + du * 1.5, abs(d)));
    lip = max(lip, (1.0 - smoothstep(0.004, 0.011 + du * 2.0, abs(d))) * step(0.0, d));
  }
  // Only between the sill and the shoulder: a shut line does not cross a roof.
  let onFlank = smoothstep(0.02, 0.16, v) * (1.0 - smoothstep(0.62, 0.80, v));
  col = mix(col, base * 0.22, gap * onFlank * 0.9);
  col = col + base * lip * onFlank * 0.22;

  // Body-side shading. This is the whole difference between a car and a solid
  // of one colour: a real flank is dark where it tucks under the sill, bright
  // along the shoulder where it turns to the sky, and darker again as it rolls
  // over onto the roof. Vertex lighting cannot give you that on a shape this
  // smooth, because the normal barely changes across the panel.
  var shade = 0.62 + 0.50 * smoothstep(0.02, 0.34, v);          // sill to waist
  shade = shade * (1.0 + 0.26 * smoothstep(0.30, 0.52, v)
                        * (1.0 - smoothstep(0.52, 0.74, v)));   // shoulder line
  shade = shade * (0.92 + 0.16 * smoothstep(0.74, 0.95, v));    // roof turn
  col = col * shade;

  // Clearcoat: a narrow, near-white band where the shoulder faces the sky, and
  // a broad sky reflection over the top surfaces. Cars are mirrors; a car
  // painted with only its own colour is a bar of soap.
  let band = (1.0 - smoothstep(0.0, 0.11, abs(v - 0.60))) * 0.34;
  col = col + vec3f(0.86, 0.89, 0.95) * band;
  let sky = smoothstep(0.78, 1.0, v);
  col = mix(col, vec3f(0.30, 0.40, 0.55), sky * 0.22);

  // Wrap at the nose and tail: the paint darkens as the body turns away.
  let wrap = min(smoothstep(0.0, 0.05, u), 1.0 - smoothstep(0.95, 1.0, u));
  col = col * (0.80 + 0.20 * wrap);
  return col;
}

/** Clothing and skin: matte, with a weave rather than a flake. */
fn figureColour(uv : vec2f, key : f32) -> vec3f {
  // Quantised for the same reason as the paint above.
  let k = floor(key + 0.5);
  let r = hash11(k * 3.17 + 11.9);
  var base : vec3f;
  if (r < 0.09)      { base = vec3f(0.402, 0.286, 0.212); }  // skin, light
  else if (r < 0.17) { base = vec3f(0.268, 0.176, 0.118); }  // skin, mid
  else if (r < 0.24) { base = vec3f(0.150, 0.096, 0.066); }  // skin, deep
  else if (r < 0.34) { base = vec3f(0.104, 0.130, 0.196); }  // navy
  else if (r < 0.43) { base = vec3f(0.360, 0.128, 0.116); }  // red coat
  else if (r < 0.52) { base = vec3f(0.128, 0.156, 0.128); }  // olive
  else if (r < 0.60) { base = vec3f(0.560, 0.540, 0.490); }  // cream
  else if (r < 0.68) { base = vec3f(0.086, 0.088, 0.096); }  // black
  else if (r < 0.76) { base = vec3f(0.226, 0.166, 0.262); }  // purple
  else if (r < 0.84) { base = vec3f(0.140, 0.256, 0.286); }  // teal
  else if (r < 0.92) { base = vec3f(0.480, 0.360, 0.150); }  // tan
  else               { base = vec3f(0.300, 0.310, 0.340); }  // grey
  // Flat, for the same reason as the paint above, with a per-garment shade so
  // two people in navy are not the identical navy.
  return base * (0.88 + hash11(k * 5.7 + 0.3) * 0.24);
}

/**
 * A number plate, with its registration generated from the part key.
 *
 * Seven characters in the national pattern: two letters, two digits, a space,
 * three letters. Every one of them comes out of a hash of the key, so a street
 * of parked cars has a street of different plates and none of it is modelled
 * or stored. `surf` runs 0..1 across the plate; the glyph table is the same
 * 5x6 font the shop signs use.
 */
fn plateColour(surf : vec2f, d : vec2f, key : f32) -> vec3f {
  let k = floor(key + 0.5);
  let face = vec3f(0.86, 0.86, 0.82);
  // Border and rivets: a plate with no edge reads as a sticker.
  let edge = min(min(surf.x, 1.0 - surf.x) * 3.4, min(surf.y, 1.0 - surf.y));
  if (edge < 0.06) { return vec3f(0.14, 0.14, 0.15); }

  let count = 7u;
  let cellW = 0.90 / f32(count);
  let x = (surf.x - 0.05) / cellW;
  if (x < 0.0 || x >= f32(count)) { return face; }
  let index = u32(x);
  let inCell = vec2f(fract(x), (surf.y - 0.22) / 0.56);
  if (inCell.y < 0.0 || inCell.y >= 1.0) { return face; }

  // Pick this slot's character. Letters, letters, digits, digits, space, then
  // three letters -- the shape of a registration is as recognisable as the
  // characters in it.
  let r = hash11(k * 3.7 + f32(index) * 11.3 + 5.1);
  var code : u32;
  if (index == 4u) {
    code = 40u;                                  // the gap in the middle
  } else if (index == 2u || index == 3u) {
    code = 26u + u32(r * 9.999);                 // digits
  } else {
    code = u32(r * 25.999);                      // letters
  }
  let col = u32(inCell.x * 5.0);
  let row = 5u - u32(inCell.y * 6.0);
  let bits = GLYPHS[code];
  let on = (bits >> (row * 5u + col)) & 1u;
  // Fade the glyph out once it is under a screen pixel, or it aliases into
  // noise at the distance a parked car is usually seen from.
  let px = max(d.x, 1e-5) * 6.0 / cellW;
  let ink = f32(on) * (1.0 - smoothstep(0.9, 2.4, px));
  return mix(face, vec3f(0.07, 0.07, 0.08), ink);
}

/** Tyre: sidewall, moulded shoulder and tread blocks. */
fn tyreColour(surf : vec2f, key : f32) -> vec3f {
  let base = vec3f(0.058, 0.058, 0.062);
  // surf.x runs round the tyre, surf.y across it: 0 and 1 are the sidewalls,
  // 0.5 the centre of the tread.
  let across = abs(surf.y - 0.5) * 2.0;
  // Tread blocks, in two rows offset from each other, only on the crown.
  let bandA = step(0.5, fract(surf.x * 34.0));
  let bandB = step(0.5, fract(surf.x * 34.0 + 0.5));
  let band = select(bandB, bandA, surf.y > 0.5);
  let crown = 1.0 - smoothstep(0.45, 0.85, across);
  var col = base * (1.0 - 0.42 * band * crown);
  // A circumferential groove either side of the centre line.
  let groove = 1.0 - smoothstep(0.02, 0.09, abs(across - 0.34));
  col = col * (1.0 - 0.45 * groove);
  // Sidewall lettering band, and the shoulder catching a little light.
  col = col * (0.86 + 0.30 * smoothstep(0.75, 1.0, across));
  return col;
}

/**
 * Anodised near-black: window frames, copings and fins on the modern theme.
 *
 * Not pure black -- a black surface takes no light and reads as a hole. It is
 * a very dark grey with a faint vertical grain and a slight sheen, which is
 * what a dark powder-coated extrusion looks like against white render.
 */
fn darkMetal(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let grain = hash21(vec2f(floor(uv.x * 40.0), floor(uv.y * 6.0)) + seed) * 0.035;
  let sheen = 0.02 * sin(uv.y * 3.0 + seed);
  return vec3f(0.085 + grain + sheen, 0.088 + grain + sheen, 0.095 + grain + sheen);
}

/**
 * White panel: the modern theme's wall.
 *
 * Plaster was the nearest thing in the palette and it is a warm off-cream --
 * put beside black frames it read as another beige building. This is a cool
 * near-white with the panel joints expressed as fine shadow lines, which is
 * what large-format render panel actually looks like and what gives the theme
 * its contrast.
 */
fn renderPanel(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let base = vec3f(0.855, 0.862, 0.868) + hash21(floor(uv * 0.7) + seed) * 0.02;
  // Joints every 1.2m each way, faded out once they are under a pixel.
  let g = abs(fract(uv / 1.2 + 0.5) - 0.5) / max(mpp / 1.2, 0.0015);
  let line = clamp(min(g.x, g.y), 0.0, 1.0);
  let fade = clamp(1.0 - mpp * 5.0, 0.0, 1.0);
  return base * (1.0 - (1.0 - line) * 0.16 * fade);
}

/**
 * Vehicle glazing, in the body's own surface coordinates.
 *
 * Darkest at the bottom of the screen and lightening towards the roof, the
 * way glass does when it is picking up sky rather than road, with a black
 * band round the edge for the seal. No mullions: this is one pane, which is
 * the whole difference between a car window and a shopfront.
 */
fn carGlass(surf : vec2f, key : f32) -> vec3f {
  let k = floor(key + 0.5);
  let sky = clamp((surf.y - 0.5) * 1.6, 0.0, 1.0);
  let base = mix(vec3f(0.075, 0.088, 0.102), vec3f(0.30, 0.35, 0.40), sky);
  // A faint sheen running along the glass, so a flat pane is not a flat colour.
  let band = 0.03 * sin(surf.x * 9.0 + k);
  // Seal: a dark edge on the top and bottom of the band.
  let edge = clamp(min(surf.y, 1.0 - surf.y) * 14.0, 0.0, 1.0);
  return (base + band) * mix(0.35, 1.0, edge);
}

fn albedo(mat : u32, uv : vec2f, mpp : f32, seed : f32, par : vec2f, key : f32,
          surf : vec2f, surfD : vec2f) -> vec3f {
  switch (mat) {
    case 1u: { return housing(uv, mpp, seed, par); }
    case 2u: { return curtainWall(uv, mpp, seed, par); }
    case 3u: { return corrugated(uv, mpp, seed); }
    case 4u: { return brick(uv, mpp, seed); }
    case 5u: { return trim(uv, mpp, seed); }
    case 6u: { return shopfront(uv, mpp, seed, par); }
    case 7u: { return tiles(uv, mpp, seed); }
    case 8u: { return ground(uv, mpp); }
    case 9u: { return houseWall(uv, mpp, seed, par); }
    case 10u: { return shedWall(uv, mpp, seed); }
    case 11u: { return concrete(uv, mpp, seed); }
    case 12u: { return plaster(uv, mpp, seed); }
    // Handled in the fragment entry point, where the pane's own coordinates
    // are available. Never reached.
    case 13u: { return vec3f(0.0); }
    case 14u: { return roofTile(uv, mpp, seed); }
    case 15u: { return stone(uv, mpp, seed); }
    case 16u: { return cladding(uv, mpp, seed); }
    case 17u: { return timber(uv, mpp, seed); }
    // These two colour themselves from the part key: see MeshBuilder.keyed.
    case 18u: { return carPaint(surf, surfD, key); }
    case 19u: { return figureColour(surf, key); }
    case 20u: { return plateColour(surf, surfD, key); }
    case 21u: { return tyreColour(surf, key); }
    case 22u: { return darkMetal(uv, mpp, seed); }
    case 23u: { return renderPanel(uv, mpp, seed); }
    case 24u: { return carGlass(surf, key); }
    default: { return roofDeck(uv, mpp, seed); }
  }
}

// -------------------------------------------------------------------- text
//
// A 5x6 pixel font, one glyph per u32, bit = row * 5 + col. Signage without a
// name on it reads as a coloured panel; with one it reads as a business, and
// at city-builder distances five pixels of letter is plenty.

const GLYPHS = array<u32, 41>(
  589284910u, 521715247u, 1007715390u, 521717295u, 1041284159u, 34651199u,
  1025041470u, 588840497u, 1044517023u, 211034396u, 588553521u, 1041269793u,
  588830577u, 589092465u, 488162862u, 34651695u, 748340782u, 580042287u,
  520632382u, 138547359u, 488162865u, 145278513u, 599442993u, 581046609u,
  138547537u, 1041305887u, 490395438u, 474091716u, 1042424366u, 520632847u,
  301246856u, 520633407u, 488160302u, 69345823u, 488159790u, 487540270u,
  748329254u, 207618048u, 31744u, 132u, 0u,
);

/** Maps an ASCII code to an index into GLYPHS. 40 is the blank. */
fn glyphIndex(code : u32) -> u32 {
  if (code >= 65u && code <= 90u) { return code - 65u; }        // A-Z
  if (code >= 97u && code <= 122u) { return code - 97u; }       // a-z, folded
  if (code >= 48u && code <= 57u) { return code - 48u + 26u; }  // 0-9
  if (code == 38u) { return 36u; }                              // &
  if (code == 46u) { return 37u; }                              // .
  if (code == 45u) { return 38u; }                              // -
  if (code == 39u) { return 39u; }                              // '
  return 40u;
}

fn charAt(i : u32) -> u32 {
  let word = scene.signText[i / 4u];
  return (word >> ((i % 4u) * 8u)) & 255u;
}

/**
 * Draws the brand name across a sign face. `p` is 0..1 across the board.
 * Returns coverage, anti-aliased by the local derivative.
 */
fn signLabel(p : vec2f, count : u32, mpp : f32) -> f32 {
  if (count == 0u) { return 0.0; }
  // Letters occupy the middle 92% of the board.
  let cellW = 0.92 / f32(count);
  let x = (p.x - 0.04) / cellW;
  if (x < 0.0 || x >= f32(count)) { return 0.0; }

  let index = u32(x);
  let inCell = vec2f(fract(x), (p.y - 0.20) / 0.60);
  if (inCell.y < 0.0 || inCell.y > 1.0) { return 0.0; }

  // Glyph is 5 wide and 6 tall inside a 6-wide cell, giving a one-pixel gap.
  let col = i32(floor(inCell.x * 6.0));
  let row = i32(floor((1.0 - inCell.y) * 6.0));
  if (col < 0 || col > 4 || row < 0 || row > 5) { return 0.0; }

  let bits = GLYPHS[glyphIndex(charAt(index))];
  let on = (bits >> u32(row * 5 + col)) & 1u;

  // Fade out once a glyph pixel is smaller than a screen pixel. `mpp` is
  // measured in the fragment entry point, because fwidth may only be reached
  // in uniform control flow and this function is called inside a branch.
  let px = mpp * 6.0 / cellW;
  return f32(on) * (1.0 - smoothstep(1.0, 2.6, px));
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

  // Parallax for the interiors: the view direction expressed in the same two
  // axes the facade coordinate uses, divided by how square-on the surface is.
  var uDir = vec3f(1.0, 0.0, 0.0);
  var vDir = vec3f(0.0, 1.0, 0.0);
  if (abs(n.y) > 0.6) { vDir = vec3f(0.0, 0.0, 1.0); }
  else if (abs(n.x) > abs(n.z)) { uDir = vec3f(0.0, 0.0, 1.0); }
  // Derivative of the sign-face coordinate, taken here for the same reason:
  // uniform control flow.
  let localMpp = max(max(fwidth(in.local.x), fwidth(in.local.y)), 1e-5);
  // Per-axis derivatives of the surface coordinate, for anything drawn along a
  // body rather than tiled by world position. Taken here for the same reason.
  let surfD = vec2f(fwidth(in.local.x), fwidth(in.local.y));
  let view = normalize(in.world - scene.eye.xyz);
  let facing = max(-dot(view, n), 0.12);
  let par = vec2f(dot(view, uDir), dot(view, vDir)) / facing * 0.26;
  // A tinted surface is painted, not patterned: the palette wins over the
  // material entirely.
  var col = select(albedo(in.material, uv, mpp, seed, par, in.key, in.local, surfD),
                   palette(in.tint, uv, mpp, seed),
                   in.tint != 0u);

  // A modelled window: one room mapped across the pane, using the pane's own
  // coordinates rather than a slice of a world-space grid.
  if (in.material == MAT_PANE) {
    let r = hash21(floor(vec2f(uv.x * 0.9, uv.y * 0.7)) + seed);
    let inside = room(in.local, par, r, r > 0.74);
    // What the pane reflects: sky, stronger the more glancing the view. This
    // is what makes glass read as glass rather than as a picture of a room.
    let grazing = 1.0 - clamp(dot(n, -view), 0.0, 1.0);
    let refl = glassColour(seed) * (1.5 + r * 0.4) + vec3f(0.05, 0.07, 0.10) * grazing;
    col = mix(inside, refl, 0.30 + 0.45 * grazing);
    // A transom bar across the pane, which almost every window has and which
    // gives the eye something to read the glass by.
    col = mix(col, vec3f(0.30, 0.30, 0.29),
              (1.0 - smoothstep(0.008, 0.022, abs(in.local.y - 0.62))) * 0.75);
  }

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

  // Specular. Masonry does not shine, so this is per material rather than
  // global: glass and paint get a tight, bright highlight and a Fresnel rim,
  // metal a broader one, and everything else nothing at all. Without the
  // Fresnel term a glazed tower is matte from every angle except the one the
  // sun happens to bounce off, which is why the curtain walls read as card.
  var gloss = 0.0;
  var power = 64.0;
  var fresnel = 0.0;
  if (in.material == MAT_GLASS || in.material == MAT_SHOPFRONT || in.material == MAT_PANE) {
    gloss = 0.85; power = 180.0; fresnel = 0.55;
  } else if (in.material == MAT_PAINT) {
    // Clearcoat: a car is the glossiest thing in a city street, and the
    // Fresnel rim is what makes the flank pick up the sky at a glance.
    gloss = 1.9; power = 320.0; fresnel = 0.62;
  } else if (in.material == MAT_METAL || in.material == MAT_SHED) {
    gloss = 0.5; power = 42.0; fresnel = 0.12;
  } else if (in.material == MAT_PLATE) {
    gloss = 0.22; power = 30.0;
  } else if (in.material == MAT_TYRE) {
    // Rubber. Almost nothing, but not quite nothing: a tyre has a sheen on
    // the shoulder and none at all in the tread.
    gloss = 0.10; power = 14.0;
  } else if (in.material == MAT_CAR_GLASS) {
    gloss = 1.5; power = 260.0; fresnel = 0.66;
  } else if (in.material == MAT_DARK) {
    gloss = 0.55; power = 90.0; fresnel = 0.30;
  } else if (in.material == MAT_TRIM || in.material == MAT_CONCRETE) {
    // Painted trim and precast are satin, not matte, and a trace of sheen is
    // what stops a white cornice reading as paper.
    gloss = 0.16; power = 26.0;
  }
  if (gloss > 0.0) {
    let v = normalize(scene.eye.xyz - in.world);
    let h = normalize(v + sun);
    let spec = pow(max(dot(n, h), 0.0), power) * shadow * in.ao;
    col += vec3f(0.70, 0.72, 0.76) * spec * gloss;
    if (fresnel > 0.0) {
      // Sky reflection at grazing angles: the other half of what glass does.
      let grazing = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 4.0);
      col += vec3f(0.32, 0.40, 0.52) * grazing * fresnel * mix(0.5, 1.0, in.ao);
    }
  }

  // Ground fades to the background rather than ending at a visible edge.
  if (in.material == MAT_GROUND) {
    let d = length(in.world.xz) / max(scene.params.z, 1.0);
    col = mix(col, vec3f(0.043, 0.055, 0.075), smoothstep(0.45, 1.0, d));
  }

  // Filmic-ish shoulder: keeps sunlit render and glass highlights from
  // clipping to flat white, which is most of why untonemapped renders look
  // like plastic.
  var out = pow(col / (col + vec3f(0.72)) * 1.42, vec3f(0.9));

  // Lit signage bypasses all of it. Run through the tonemap, a saturated brand
  // colour loses its strongest channel fastest and every sign in the city
  // desaturates towards pink -- which is exactly what happened. A sign is its
  // own light source, so it gets its colour, lifted a little, and nothing else.
  if (in.tint == 4u) {
    // Scaled, not mixed towards white. Any lift towards white raises the weak
    // channels and a saturated red becomes salmon -- twice now.
    out = clamp(scene.brand.rgb * 1.35, vec3f(0.0), vec3f(1.0));
    // The business name, in the accent colour, on faces that carry sign
    // coordinates. Faces that do not have local = (0,0) and get nothing.
    let label = signLabel(in.local, u32(scene.signInfo.x + 0.5), localMpp);
    out = mix(out, clamp(scene.accent.rgb * 1.5, vec3f(0.0), vec3f(1.0)), label);
  }
  return vec4f(out, 1.0);
}

@fragment
fn fs_wire() -> @location(0) vec4f {
  return vec4f(0.38, 0.83, 1.0, 1.0);
}
