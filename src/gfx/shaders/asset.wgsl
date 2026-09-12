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

#include "atmosphere.wgsl"
#include "noise.wgsl"

struct Scene {
  viewProj    : mat4x4f,
  sunViewProj : mat4x4f,
  eye         : vec4f,
  sunDir      : vec4f,
  // x = aerial perspective strength, y = shadow map texel size,
  // z = ground fade radius
  params      : vec4f,
  /** Primary brand colour: fascia signs, awnings, painted trim. */
  brand       : vec4f,
  /** Secondary: stripes, doors, sign returns. */
  accent      : vec4f,
  /** The brand name, four characters packed per component, 16 max. */
  signText    : vec4u,
  /** x = character count. */
  signInfo    : vec4f,
  /**
   * x = cloud cover, y = fog, z = rain, w = ground wetness.
   *
   * Here as well as on the camera uniform because the buildings have to agree
   * with the ground about the weather. Zero for the icon renderer and the asset
   * viewer, which photograph a building on a clear day whatever the city is
   * doing.
   */
  weather     : vec4f,
};

@group(0) @binding(0) var<uniform> scene : Scene;
@group(0) @binding(1) var shadowMap : texture_depth_2d;
@group(0) @binding(2) var shadowSampler : sampler_comparison;

/**
 * One prototype: everything about an asset that is the same for every copy of
 * it standing in the city.
 *
 * The viewer draws one asset at a time and passed all of this in the scene
 * uniform. A city draws four hundred prototypes in one pass, so it moves into
 * a table the shader indexes by the instance's own prototype. The viewer binds
 * a table of one row, which keeps a single fragment stage serving both.
 */
struct Proto {
  /** xyz = the quantisation origin the vertices were packed against;
   *  w = the prototype's colour seed, from its id. */
  frame    : vec4f,
  /** xyz = the quantisation extent. */
  span     : vec4f,
  /** Primary brand colour: fascia signs, awnings, painted trim. */
  brand    : vec4f,
  /** Secondary: stripes, doors, sign returns. */
  accent   : vec4f,
  /** The brand name, four characters packed per component, 16 max. */
  signText : vec4u,
  /** x = character count. */
  signInfo : vec4f,
};

@group(1) @binding(0) var<storage, read> protos : array<Proto>;

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
const MAT_LAMP      = 25u;
const MAT_IMPORTED  = 26u;
const MAT_SKIN      = 27u;
const MAT_STONE     = 15u;
const MAT_FOLIAGE   = 31u;
const MAT_BARK      = 32u;
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
  // Flat, not interpolated. Blending between the three corners of a facet is
  // what made the fleet look smeared and foggy: a low-poly car is a set of
  // crisp flat planes, and the moment the rasteriser gradients across one it
  // reads as a smudge rather than as bodywork. The importer picks one colour
  // per facet -- the dominant texel over its own UV footprint -- so there is
  // nothing to interpolate and every panel comes out clean-edged.
  @location(7) @interpolate(flat) vcol : vec3f,
  /** Which row of the prototype table this surface belongs to. */
  @location(8) @interpolate(flat) proto : u32,
  /** The colour seed: the prototype's, plus the instance's own. */
  @location(9) @interpolate(flat) seed : f32,
  /** 1 for the building being placed, which is not there yet. */
  @location(13) @interpolate(flat) ghost : f32,
  /**
   * Position and normal in the prototype's own frame, before the instance was
   * turned.
   *
   * Every facade pattern used to be projected onto a world axis plane picked
   * by the dominant face normal. That is exact for a building standing square
   * to the axes and wrong for every other angle: a wall at forty degrees has
   * its brick courses compressed by the cosine, so the pattern shears. It is
   * also why the whole simulation was locked to an axis-aligned grid.
   *
   * Shading in the prototype's frame removes the constraint entirely. At the
   * four quarter turns it is identical to what the world projection did,
   * because a quarter turn maps axes onto axes; at every other angle it is the
   * only one of the two that is right.
   */
  @location(10)                    shade : vec3f,
  @location(11)                    pnorm : vec3f,
  /** cos and sin of the instance's yaw, to bring world vectors into that frame. */
  @location(12) @interpolate(flat) spin  : vec2f,
};

@vertex
fn vs(@location(0) position : vec3f,
      @location(1) normal   : vec3f,
      @location(2) material : f32,
      @location(3) ao       : f32,
      @location(4) tint     : f32,
      @location(5) local    : vec2f,
      @location(6) key      : f32,
      @location(7) vcol     : f32) -> VSOut {
  var out : VSOut;
  out.world = position;
  out.normal = normal;
  out.ao = ao;
  out.material = u32(material + 0.5);
  out.tint = u32(tint + 0.5);
  out.local = local;
  // Flat, so it never carries interpolation wobble into a hash.
  out.key = key;
  // Four bytes packed into the float: r, g, b and a spare. Imported meshes
  // carry their colour per vertex because an authored model has no world-space
  // pattern to shade itself from, which is what everything generated uses.
  // Unpacked by hand rather than with unpack4x8unorm: that builtin is not
  // resolved by every WGSL implementation this runs on, and a pipeline that
  // fails to compile takes the whole renderer down. Three shifts and a mask
  // cost nothing and work everywhere.
  let packed = bitcast<u32>(vcol);
  out.vcol = vec3f(f32(packed & 0xffu),
                   f32((packed >> 8u) & 0xffu),
                   f32((packed >> 16u) & 0xffu)) * (1.0 / 255.0);
  out.proto = 0u;
  out.seed = scene.params.x;
  out.pos = scene.viewProj * vec4f(position, 1.0);
  return out;
}

/** Depth-only pass from the sun's point of view. */
@vertex
fn vs_shadow(@location(0) position : vec3f) -> @builtin(position) vec4f {
  return scene.sunViewProj * vec4f(position, 1.0);
}

// -------------------------------------------------- the city's vertex stage
//
// The viewer feeds this shader one asset at a time out of a fifty-two-byte
// float vertex. The city feeds it four hundred prototypes out of one packed
// arena, twenty bytes a vertex, drawn instanced. Everything downstream is the
// same -- the fragment stage cannot tell which stage produced its input, and
// that is the point: what the viewer shows is what the city renders.
//
// The packing, from src/gfx/atlas.ts:
//
//   x  position x, y      u16, u16, against the prototype's own bounding box
//   y  position z, normal u16, u16 octahedral
//   z  material, occlusion, tint, spare   u8 x4
//   w  local u, v         u16, u16
//   extra  the part key, or the imported vertex colour: the material says
//          which, and no vertex in the library carries both.

struct Instance {
  /** x, z, base height, yaw in quarter turns. */
  place : vec4f,
  /** half extent x, half extent z, height, prototype index. */
  form  : vec4f,
  /**
   * x = stretch along the prototype's own Z
   * y = ghost, when this is a preview rather than a building
   * z = when this building first appeared, in seconds on the renderer's clock
   */
  extra : vec4f,
};

/** Seconds a new building takes to rise. */
const GROW_SECONDS = 2.6;

/**
 * How far up a building is, 0 to 1.
 *
 * Buildings do not appear, they are built. A city that grows a hundred houses
 * the instant a block is zoned reads as a switch being thrown; the same hundred
 * rising over a couple of seconds reads as the city doing something, and it
 * gives the eye somewhere to look after a decision instead of a jump cut.
 *
 * Eased at both ends, and the first fifth of the curve is nearly flat, so a
 * building spends a moment as a footprint before it starts to climb -- which is
 * what makes it look like a site rather than an extrusion.
 */
fn growth(inst : Instance) -> f32 {
  let born = inst.extra.z;
  if (born <= 0.0) { return 1.0; }
  let t = clamp((scene.params.w - born) / GROW_SECONDS, 0.0, 1.0);
  return smoothstep(0.0, 1.0, t * t * (3.0 - 2.0 * t));
}

@group(2) @binding(0) var<storage, read> instances : array<Instance>;
/** The survivors of one bucket, bound at that bucket's offset. */
@group(2) @binding(1) var<storage, read> visible : array<u32>;

/** The inverse of atlas.ts's packNormal: two bytes back to a unit vector. */
fn unpackNormal(word : u32) -> vec3f {
  let x = (f32(word & 255u) - 127.5) / 127.5;
  let z = (f32((word >> 8u) & 255u) - 127.5) / 127.5;
  let y = 1.0 - abs(x) - abs(z);
  var o = vec3f(x, y, z);
  if (y < 0.0) {
    o = vec3f((1.0 - abs(z)) * select(-1.0, 1.0, x >= 0.0), y,
              (1.0 - abs(x)) * select(-1.0, 1.0, z >= 0.0));
  }
  return normalize(o);
}

/**
 * A quarter turn about Y, the same convention as MeshBuilder.placed.
 *
 * Quarter turns only, and that is a rule rather than a limitation: the facade
 * patterns are computed from world position and the dominant face normal, so
 * a wall has to stay axis-aligned or every brick course in the city shears.
 */
fn turn(v : vec3f, c : f32, s : f32) -> vec3f {
  return vec3f(v.x * c - v.z * s, v.y, v.x * s + v.z * c);
}

/** The same rotation the other way: a world vector into the prototype's frame. */
fn unturn(v : vec3f, c : f32, s : f32) -> vec3f {
  return vec3f(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
}

/** World placement of one packed vertex. Shared by the colour and shadow passes. */
fn protoVertex(packed : vec4u, inst : Instance, p : Proto) -> vec3f {
  let q = vec3f(f32(packed.x & 0xffffu), f32(packed.x >> 16u), f32(packed.y & 0xffffu));
  var local = p.frame.xyz + q * (1.0 / 65535.0) * p.span.xyz;
  // Stretched along its own Z before it is turned. Roads use this and nothing
  // else does; a road tile is an extrusion along Z, so a few per cent either
  // way lengthens the extrusion rather than distorting anything.
  local.z *= inst.extra.x;
  // Rising out of the ground. Scaled about its own base rather than moved up
  // from below, because a building sliding up out of the terrain shows its
  // underside through the hillside it is cut into, and a building that grows
  // does not.
  local.y *= growth(inst);
  return local;
}

fn cityVertex(packed : vec4u, inst : Instance, p : Proto) -> vec3f {
  let a = inst.place.w;
  return turn(protoVertex(packed, inst, p), cos(a), sin(a))
       + vec3f(inst.place.x, inst.place.z, inst.place.y);
}

@vertex
fn vs_city(@location(0) packed : vec4u, @location(1) extra : u32,
           @builtin(instance_index) slot : u32) -> VSOut {
  let inst = instances[visible[slot]];
  let index = u32(inst.form.w + 0.5);
  let p = protos[index];

  let a = inst.place.w;
  let c = cos(a);
  let s = sin(a);

  var out : VSOut;
  out.ghost = inst.extra.y;
  out.shade = protoVertex(packed, inst, p);
  out.pnorm = unpackNormal(packed.y >> 16u);
  out.spin = vec2f(c, s);
  out.world = turn(out.shade, c, s) + vec3f(inst.place.x, inst.place.z, inst.place.y);
  out.normal = turn(out.pnorm, c, s);
  out.material = packed.z & 255u;
  out.ao = f32((packed.z >> 8u) & 255u) * (1.0 / 255.0);
  out.tint = (packed.z >> 16u) & 255u;
  out.local = vec2f(f32(packed.w & 0xffffu), f32(packed.w >> 16u)) * (1.0 / 65535.0);
  out.proto = index;

  // The union word. Only one of the two is ever read for a given material,
  // which is what let the atlas share the word in the first place.
  out.key = f32(extra);
  out.vcol = vec3f(f32(extra & 0xffu), f32((extra >> 8u) & 0xffu),
                   f32((extra >> 16u) & 0xffu)) * (1.0 / 255.0);

  // The prototype's own character, plus this copy's. Without the second term
  // a terrace of eight identical houses is eight identical houses; with it
  // they are the same house in eight sets of curtains. Hashed from the lot
  // rather than stored, which is deterministic and costs no memory.
  out.seed = p.frame.w + hash21(floor(inst.place.xy * 0.125)) * 512.0;

  out.pos = scene.viewProj * vec4f(out.world, 1.0);
  return out;
}

/** The same placement, depth only, from the sun. */
@vertex
fn vs_city_shadow(@location(0) packed : vec4u, @location(1) extra : u32,
                  @builtin(instance_index) slot : u32) -> @builtin(position) vec4f {
  let inst = instances[visible[slot]];
  let world = cityVertex(packed, inst, protos[u32(inst.form.w + 0.5)]);   // yaw in radians
  return scene.sunViewProj * vec4f(world, 1.0);
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

/**
 * Where the pattern that shaded this pixel put a window, and which one.
 *
 * `x` is coverage, 0 to 1; `yz` identifies the opening, so one window lights
 * or stays dark as a whole rather than fading across its own glass.
 *
 * A private module variable rather than a second return value, because the
 * alternative is threading an out-parameter through nine pattern functions and
 * the switch that dispatches them. Cleared at the top of albedo(), written by
 * the patterns that draw openings, read once by the night lighting -- which is
 * the only thing in the shader that needs to know where a window is, and which
 * has to know exactly, or a city at night is lit rectangles that miss the
 * windows they are meant to be in.
 */
var<private> opening : vec3f;

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
  opening = vec3f(win, id);
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
  opening = vec3f(1.0 - band, id);
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

/**
 * A tree canopy.
 *
 * The surface is a lumpy shell, and what has to happen on it is the thing a
 * shell cannot do by itself: read as thousands of separate leaves. Cells give
 * that -- each one a leaf with its own green, and the gap between two of them
 * in shadow, which is where the depth comes from.
 *
 * `up` is the surface normal's Y. A canopy is not one colour: the leaves on
 * top of the crown are in full sun and bleached towards yellow, the ones
 * underneath are in the tree's own shade and much bluer, and getting that
 * gradient right is most of the difference between a tree and a green boulder.
 */
fn foliage(world : vec3f, mpp : f32, seed : f32, up : f32) -> vec3f {
  // A skewed world projection rather than the facade coordinate. facadeUV
  // picks its plane from the dominant face normal, which on a lumpy shell
  // flips from one plane to another partway across the surface and tears the
  // leaves along the seam. This is continuous everywhere, and leaves are
  // isotropic enough that the distortion costs nothing.
  let uv = vec2f(world.x * 0.81 + world.z * 0.59, world.y + world.x * 0.14);
  let sunlit = smoothstep(-0.35, 0.75, up);
  let shade = vec3f(0.034, 0.070, 0.034);
  let lit   = vec3f(0.140, 0.205, 0.072);
  var col = mix(shade, lit, sunlit);
  // A slow drift, so one side of a crown is not the same green as the other.
  col *= 0.86 + vnoise(uv * (1.0 / 1.4) + seed) * 0.30;

  // Sprays: clumps of leaves about a third of a metre across. This is the
  // scale that does the work, because a leaf is six centimetres and from any
  // normal viewing distance six centimetres is under a pixel -- so a canopy
  // shaded only at leaf scale is a flat green surface everywhere except with
  // your nose against it, which is exactly what the first version was. The
  // spray is what carries the texture at thirty metres, and the shadow
  // between two sprays is what gives a crown its depth.
  let spray = smoothstep(1.4, 4.5, 0.34 / max(mpp, 1e-6));
  if (spray > 0.0) {
    let c = cells(vec2f(uv.x / 0.34, uv.y / 0.26));
    let gap = smoothstep(0.0, 0.30, c.d2 - c.d1);
    var clump = col * (0.72 + c.id * 0.58);
    clump *= 0.56 + 0.58 * gap;
    col = mix(col, clump, spray);
  }

  // Leaves. Roughly 6 cm across and slightly elongated, which is what most
  // broadleaves are, and dropped entirely once they are under a couple of
  // pixels rather than left to alias into a green fizz.
  let fade = smoothstep(1.3, 4.0, 0.06 / max(mpp, 1e-6));
  if (fade > 0.0) {
    let c = cells(vec2f(uv.x / 0.06, uv.y / 0.085));
    let gap = smoothstep(0.0, 0.12, c.d2 - c.d1);
    // Each leaf its own shade, a few of them turning.
    var leaf = col * (0.72 + c.id * 0.62);
    leaf = mix(leaf, vec3f(0.145, 0.108, 0.038), smoothstep(0.93, 0.995, c.id) * 0.7 * sunlit);
    // Dark into the gaps: a canopy is mostly the shadow between its leaves.
    leaf *= 0.52 + 0.58 * gap;
    col = mix(col, leaf, fade);
  }
  return col;
}

/**
 * Bark.
 *
 * TIMBER is sawn boards with battens, which wrapped round a trunk reads as a
 * barrel. Bark runs the other way: irregular vertical ridges with the fissures
 * between them in deep shadow, breaking into plates on the old wood low down.
 */
fn bark(world : vec3f, mpp : f32, seed : f32) -> vec3f {
  // Continuous around the trunk, for the same reason the canopy is: the
  // facade coordinate changes plane at each forty-five degree line and the
  // ridges would step across it.
  let uv = vec2f(world.x + world.z, world.y);
  let base = mix(vec3f(0.078, 0.066, 0.056), vec3f(0.128, 0.114, 0.098),
                 hash11(seed * 3.1 + 8.0));
  // Ridges: cells stretched hard along the trunk, so they are long and narrow
  // the way bark is, rather than a field of round lumps.
  let c = cells(vec2f(uv.x / 0.055, uv.y / 0.62));
  let fissure = smoothstep(0.34, 0.0, c.d2 - c.d1);
  var col = base * (0.80 + c.id * 0.46);
  col = mix(col, base * 0.34, fissure);
  // Cross-cracks, sparse, breaking the ridges into plates.
  let plate = vnoise(vec2f(uv.x * 3.4, uv.y * 1.15) + seed * 0.7);
  col *= 0.90 + plate * 0.22;
  // Moss and damp on the shaded lower trunk, which every mature tree has.
  col = mix(col, vec3f(0.052, 0.086, 0.046), smoothstep(0.72, 0.95, plate) * 0.35);
  return col;
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

/**
 * Harbour water.
 *
 * Two swells crossing at an angle plus a fine chop, all of it shading a flat
 * quad rather than moving it -- a vessel's pad is seen from above at a slant
 * and never edge on, so displaced geometry would buy nothing. The glitter is
 * the crests only: a smooth gradient over the whole surface reads as painted
 * metal, and it is the small bright specks that say liquid.
 */
fn water(uv : vec2f, mpp : f32) -> vec3f {
  let deep = vec3f(0.026, 0.062, 0.078);
  let shallow = vec3f(0.058, 0.128, 0.146);
  // Three swells at angles that share no common period, so nothing lines up
  // with the quad's own axes. The first version crossed two axis-aligned sines
  // and multiplied them, which is the definition of a grid: the pads came out
  // as a chequerboard of dots.
  let a = uv.x * 0.311 + uv.y * 0.194;
  let b = uv.x * -0.147 + uv.y * 0.263;
  let c = uv.x * 0.088 - uv.y * 0.121;
  let swell = sin(a) * 0.5 + sin(b * 1.618) * 0.33 + sin(c * 2.414) * 0.17;
  var col = mix(deep, shallow, clamp(swell * 0.6 + 0.5, 0.0, 1.0));
  // Chop rides on the swell rather than multiplying against it, so the fine
  // detail follows the big shape instead of tiling over it.
  let chop = sin(a * 7.3 + swell * 2.1) * 0.6 + sin(b * 11.9 - swell * 1.4) * 0.4;
  col *= 0.93 + 0.14 * (chop * 0.5 + 0.5);
  // Crests, gated by noise. Summed sines are a lattice however you rotate
  // them -- the first two attempts both came out as a regular field of dots --
  // so where a crest is allowed to catch the light is decided by a hash of the
  // cell it falls in, and the regularity goes.
  let cell = hash21(floor(uv * 0.55));
  let crest = smoothstep(0.55, 0.95, chop) * step(0.62, cell) * resolvable(2.2, mpp);
  return col + vec3f(0.08, 0.10, 0.11) * crest;
}

/**
 * Container steel.
 *
 * The same folded-sheet trick as corrugated(), at a quarter of the pitch and
 * with the top and bottom rails left flat, because that is the proportion that
 * makes a six-metre box read as a container rather than as a shed wall.
 */
fn containerColour(key : f32) -> vec3f {
  // Quantised for the same reason carPaint quantises: the key is interpolated
  // across the facet and arrives with float wobble that hash11 turns into
  // noise. A yard of containers is one colour per box, keyed per box.
  let r = hash11(floor(key + 0.5) * 5.17 + 1.9);
  if (r < 0.20) { return vec3f(0.070, 0.170, 0.330); }   // line blue
  if (r < 0.38) { return vec3f(0.360, 0.120, 0.080); }   // oxide red
  if (r < 0.52) { return vec3f(0.090, 0.220, 0.150); }   // green
  if (r < 0.66) { return vec3f(0.420, 0.420, 0.410); }   // grey
  if (r < 0.80) { return vec3f(0.520, 0.260, 0.060); }   // orange
  if (r < 0.91) { return vec3f(0.640, 0.640, 0.630); }   // white
  return vec3f(0.180, 0.180, 0.195);                     // dark
}

fn containerSide(uv : vec2f, mpp : f32, seed : f32, key : f32) -> vec3f {
  let base = containerColour(key);
  let rib = cos(uv.x * 6.2831853 / 0.075) * 0.5 + 0.5;
  var col = base * (0.84 + rib * 0.30);
  // Rails: a hand's width of flat plate top and bottom, darker than the wall.
  let rail = step(uv.y, 0.16) + step(2.44, uv.y);
  col = mix(col, base * 0.74, clamp(rail, 0.0, 1.0));
  let rust = hash21(vec2f(floor(uv.x * 2.0), floor(uv.y * 2.0)) + seed) * 0.14;
  col *= 1.0 - rust * step(0.55, hash21(vec2f(floor(uv.x), 0.0) + seed));
  return mix(base * 0.92, col, resolvable(0.075, mpp));
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
  opening = vec3f(win, id);
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
  opening = vec3f(inBand * (1.0 - pane), floor(uv.x / 2.1), floor(uv.y / 12.0));
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
fn palette(i : u32, uv : vec2f, mpp : f32, seed : f32, brand : vec3f, accent : vec3f) -> vec3f {
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
    case 10u: {
      let blade = hash21(floor(uv * 5.0) + seed);
      return vec3f(0.072, 0.146, 0.070) * (0.80 + blade * 0.45);
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
  // Clothes only. Three of these used to be skin tones, from when heads and
  // hands were keyed off this same ramp -- so a figure could come out dressed
  // in its own complexion, which reads exactly as badly as it sounds. Skin has
  // its own material now and this is a wardrobe.
  if (r < 0.10)      { base = vec3f(0.104, 0.130, 0.196); }  // navy
  else if (r < 0.18) { base = vec3f(0.360, 0.128, 0.116); }  // red
  else if (r < 0.26) { base = vec3f(0.128, 0.156, 0.128); }  // olive
  else if (r < 0.34) { base = vec3f(0.560, 0.540, 0.490); }  // cream
  else if (r < 0.43) { base = vec3f(0.086, 0.088, 0.096); }  // black
  else if (r < 0.50) { base = vec3f(0.226, 0.166, 0.262); }  // purple
  else if (r < 0.58) { base = vec3f(0.140, 0.256, 0.286); }  // teal
  else if (r < 0.65) { base = vec3f(0.480, 0.360, 0.150); }  // tan
  else if (r < 0.72) { base = vec3f(0.300, 0.310, 0.340); }  // grey
  else if (r < 0.79) { base = vec3f(0.150, 0.170, 0.330); }  // denim
  else if (r < 0.85) { base = vec3f(0.620, 0.610, 0.600); }  // white
  else if (r < 0.90) { base = vec3f(0.190, 0.330, 0.200); }  // green
  else if (r < 0.95) { base = vec3f(0.480, 0.250, 0.110); }  // rust
  else               { base = vec3f(0.330, 0.120, 0.220); }  // plum
  // Flat, for the same reason as the paint above, with a per-garment shade so
  // two people in navy are not the identical navy.
  return base * (0.88 + hash11(k * 5.7 + 0.3) * 0.24);
}

/**
 * Skin, from the part key.
 *
 * A separate ramp from figureColour rather than a slice of it: a head and a
 * coat are keyed independently -- they have to be, or everyone is dressed in
 * their own complexion -- so drawing both from one twelve-colour wardrobe put
 * three quarters of the faces in the wrong colour entirely.
 */
fn skinColour(key : f32) -> vec3f {
  let k = floor(key + 0.5);
  let r = hash11(k * 2.71 + 5.3);
  var base : vec3f;
  if (r < 0.17)      { base = vec3f(0.520, 0.380, 0.300); }
  else if (r < 0.34) { base = vec3f(0.440, 0.306, 0.232); }
  else if (r < 0.52) { base = vec3f(0.330, 0.216, 0.152); }
  else if (r < 0.70) { base = vec3f(0.226, 0.140, 0.094); }
  else if (r < 0.86) { base = vec3f(0.140, 0.086, 0.058); }
  else               { base = vec3f(0.082, 0.050, 0.036); }
  return base * (0.94 + hash11(k * 9.1 + 2.7) * 0.14);
}

/** Hair: naturals only, plus the occasional dye. */
fn hairColour(key : f32) -> vec3f {
  let k = floor(key + 0.5);
  let r = hash11(k * 4.13 + 17.7);
  var base : vec3f;
  if (r < 0.34)      { base = vec3f(0.036, 0.028, 0.026); }  // black
  else if (r < 0.60) { base = vec3f(0.088, 0.058, 0.040); }  // dark brown
  else if (r < 0.78) { base = vec3f(0.170, 0.108, 0.062); }  // brown
  else if (r < 0.88) { base = vec3f(0.320, 0.230, 0.120); }  // fair
  else if (r < 0.96) { base = vec3f(0.230, 0.096, 0.044); }  // auburn
  else               { base = vec3f(0.520, 0.510, 0.500); }  // grey
  return base * (0.90 + hash11(k * 6.3 + 1.1) * 0.20);
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
  var col = mix(vec3f(0.085, 0.098, 0.115), vec3f(0.34, 0.40, 0.47), sky);

  // What is behind the glass. A car window that is one flat tint reads as a
  // sticker; you always see something of the cabin through it, and the shapes
  // you actually read at any distance are the head restraints and the dark
  // mass of the seats under the belt line.
  let seatA = 1.0 - smoothstep(0.05, 0.13, abs(surf.x - 0.34));
  let seatB = 1.0 - smoothstep(0.05, 0.13, abs(surf.x - 0.62));
  let head = max(seatA, seatB) * (1.0 - smoothstep(0.30, 0.70, surf.y));
  col = mix(col, vec3f(0.030, 0.031, 0.036), head * 0.85);
  // Dash and door cards along the bottom of the opening.
  col = mix(col, vec3f(0.042, 0.044, 0.050), (1.0 - smoothstep(0.08, 0.30, surf.y)) * 0.8);
  // A pillar-to-pillar shade band across the top, as most screens have.
  col = mix(col, vec3f(0.02, 0.02, 0.025), smoothstep(0.86, 0.99, surf.y) * 0.7);

  // Two reflection streaks raking across the glass. This is the single thing
  // that makes glass read as glass rather than as dark paint.
  let d = surf.x * 1.7 + surf.y;
  let s1 = 1.0 - smoothstep(0.0, 0.10, abs(fract(d * 0.7 + k * 0.13) - 0.5));
  col += vec3f(0.20, 0.23, 0.28) * s1 * (0.35 + 0.5 * sky);
  // Seal: a dark edge round the opening.
  let edge = clamp(min(surf.y, 1.0 - surf.y) * 16.0, 0.0, 1.0);
  return col * mix(0.30, 1.0, edge);
}

/**
 * A lamp lens: emissive, and banded the way modern lights are.
 *
 * Headlights and tail lights are the only part of a car that is a light
 * source, and leaving them as painted panels is why a parked car reads as a
 * model of a car. The bars come from the surface coordinate, so a wide lamp
 * gets more of them and a narrow one fewer.
 */
fn lampColour(surf : vec2f, rear : bool) -> vec3f {
  let base = select(vec3f(0.94, 0.95, 1.00), vec3f(0.92, 0.07, 0.05), rear);
  // Horizontal elements, brighter in the middle of each.
  let bar = abs(fract(surf.y * 3.0) - 0.5) * 2.0;
  let lit = mix(1.0, 0.34, smoothstep(0.35, 0.85, bar));
  // The lens darkens towards its edges, where the bezel is.
  let edge = clamp(min(min(surf.x, 1.0 - surf.x), min(surf.y, 1.0 - surf.y)) * 9.0, 0.0, 1.0);
  return base * lit * mix(0.25, 1.0, edge);
}

fn albedo(mat : u32, uv : vec2f, mpp : f32, seed : f32, par : vec2f, key : f32,
          surf : vec2f, surfD : vec2f, world : vec3f, wmpp : f32, up : f32) -> vec3f {
  // Cleared here so a material that draws no openings leaves none behind from
  // the last pixel a wall pattern shaded.
  opening = vec3f(0.0);
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
    case 25u: { return lampColour(surf, key < 0.5); }
    case 27u: { return skinColour(key); }
    case 28u: { return hairColour(key); }
    case 29u: { return water(uv, mpp); }
    case 30u: { return containerSide(uv, mpp, seed, key); }
    case 31u: { return foliage(world, wmpp, seed, up); }
    case 32u: { return bark(world, wmpp, seed); }
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

fn charAt(text : vec4u, i : u32) -> u32 {
  let word = text[i / 4u];
  return (word >> ((i % 4u) * 8u)) & 255u;
}

/**
 * Draws the brand name across a sign face. `p` is 0..1 across the board.
 * Returns coverage, anti-aliased by the local derivative.
 */
fn signLabel(text : vec4u, p : vec2f, count : u32, mpp : f32) -> f32 {
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

  let bits = GLYPHS[glyphIndex(charAt(text, index))];
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
  // tan(acos(n)) is sqrt(1 - n*n) / n: the same number, no transcendentals.
  let c = clamp(ndl, 0.0, 1.0);
  let bias = clamp(0.0016 * (sqrt(max(1.0 - c * c, 0.0)) / max(c, 0.02)), 0.0006, 0.006);
  let texel = scene.params.y;

  // Four taps, not nine.
  //
  // The sampler compares with linear filtering, so each tap is already four
  // texel comparisons blended in hardware -- a two-by-two pattern at three
  // quarters of a texel covers the same footprint a three-by-three grid of
  // point taps would, for a bit over half the fetches. Shadow sampling happens
  // once per lit pixel of the ground, the roads and every building, so it is
  // one of the few things in the frame that is genuinely paid for everywhere.
  let o = texel * 0.75;
  var sum = textureSampleCompare(shadowMap, shadowSampler, safeUV + vec2f(-o, -o), ndc.z - bias);
  sum += textureSampleCompare(shadowMap, shadowSampler, safeUV + vec2f(o, -o), ndc.z - bias);
  sum += textureSampleCompare(shadowMap, shadowSampler, safeUV + vec2f(-o, o), ndc.z - bias);
  sum += textureSampleCompare(shadowMap, shadowSampler, safeUV + vec2f(o, o), ndc.z - bias);
  return mix(sum * 0.25, 1.0, outside);
}

// ----------------------------------------------------------------- fragment

@fragment
fn fs(in : VSOut) -> @location(0) vec4f {
  // The weather, from this shader's own uniform: the icon renderer and the
  // asset viewer leave it at zero, which is a clear day.
  setWeather(scene.weather.x, scene.weather.y);
  let n = normalize(in.normal);
  // The pattern frame is the prototype's, not the world's: see VSOut.shade.
  let sn = normalize(in.pnorm);
  let uv = facadeUV(in.shade, sn);
  // Taken here, in uniform control flow, then passed down.
  let mpp = max(max(fwidth(uv.x), fwidth(uv.y)), 1e-6);
  let look = protos[in.proto];
  let seed = in.seed;

  // Parallax for the interiors: the view direction expressed in the same two
  // axes the facade coordinate uses, divided by how square-on the surface is.
  var uDir = vec3f(1.0, 0.0, 0.0);
  var vDir = vec3f(0.0, 1.0, 0.0);
  if (abs(sn.y) > 0.6) { vDir = vec3f(0.0, 0.0, 1.0); }
  else if (abs(sn.x) > abs(sn.z)) { uDir = vec3f(0.0, 0.0, 1.0); }
  // Derivative of the sign-face coordinate, taken here for the same reason:
  // uniform control flow.
  let localMpp = max(max(fwidth(in.local.x), fwidth(in.local.y)), 1e-5);
  // Per-axis derivatives of the surface coordinate, for anything drawn along a
  // body rather than tiled by world position. Taken here for the same reason.
  let surfD = vec2f(fwidth(in.local.x), fwidth(in.local.y));
  let viewWorld = normalize(in.world - scene.eye.xyz);
  // Into the prototype's frame, so the parallax axes are the same two the
  // facade coordinate is built from.
  let view = unturn(viewWorld, in.spin.x, in.spin.y);
  let facing = max(-dot(view, sn), 0.12);
  let par = vec2f(dot(view, uDir), dot(view, vDir)) / facing * 0.26;
  // A tinted surface is painted, not patterned: the palette wins over the
  // material entirely.
  // Derivatives of world position, for the materials whose pattern is not on
  // the facade grid. Taken here with the others, in uniform control flow.
  let wmpp = max(max(fwidth(in.world.x), fwidth(in.world.y)), max(fwidth(in.world.z), 1e-6));
  var col = select(albedo(in.material, uv, mpp, seed, par, in.key, in.local, surfD,
                          in.world, wmpp, n.y),
                   palette(in.tint, uv, mpp, seed, look.brand.rgb, look.accent.rgb),
                   in.tint != 0u);
  // An imported mesh brings its own colour and takes no pattern at all.
  if (in.material == MAT_IMPORTED) { col = in.vcol; }

  // A modelled window: one room mapped across the pane, using the pane's own
  // coordinates rather than a slice of a world-space grid.
  if (in.material == MAT_PANE) {
    let r = hash21(floor(vec2f(uv.x * 0.9, uv.y * 0.7)) + seed);
    let inside = room(in.local, par, r, r > 0.74);
    // What the pane reflects: sky, stronger the more glancing the view. This
    // is what makes glass read as glass rather than as a picture of a room.
    let grazing = 1.0 - clamp(dot(n, -viewWorld), 0.0, 1.0);
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
  } else if (in.material == MAT_IMPORTED) {
    // Enough clearcoat to read as a vehicle, less than the painted material:
    // an imported mesh has glass, rubber and trim all on the same material,
    // so a highlight tuned for paint would put a shine on the tyres.
    gloss = 0.85; power = 160.0; fresnel = 0.34;
  } else if (in.material == MAT_SKIN) {
    // Skin is not matte: a face with no highlight at all is a mask, and the
    // forehead and the bridge of the nose are where it shows.
    gloss = 0.13; power = 20.0;
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
    out = clamp(look.brand.rgb * 1.35, vec3f(0.0), vec3f(1.0));
    // The business name, in the accent colour, on faces that carry sign
    // coordinates. Faces that do not have local = (0,0) and get nothing.
    let label = signLabel(look.signText, in.local, u32(look.signInfo.x + 0.5), localMpp);
    out = mix(out, clamp(look.accent.rgb * 1.5, vec3f(0.0), vec3f(1.0)), label);
  }
  // Windows come on at night, which is most of what a city looks like after
  // dark. Lit exactly where the wall pattern drew an opening, and switched per
  // opening rather than per pixel, so a tower ends up with a scatter of lit
  // floors rather than a gradient -- and so a lit rectangle never lands beside
  // the window it was meant to be in.
  let night = 1.0 - dayPhase(sun).x;
  if (night > 0.01) {
    // Modelled glass is all opening; drawn glass reports its own coverage.
    var cover = opening.x;
    var id = opening.yz;
    if (in.material == MAT_PANE || in.material == MAT_GLASS) {
      cover = 1.0;
      id = floor(uv / vec2f(2.35, 3.15));
    }
    if (cover > 0.01) {
      // Which windows are lit, and why they are not a coin flip.
      //
      // Every opening used to light independently at a fifty-six per cent
      // chance, and uncorrelated flips at a half are the recipe for maximum
      // visual noise: a tower came out as television static. A real building
      // is nothing like that. A floor's lights are on one circuit, a tenant
      // takes a run of bays, and most of the building is dark.
      //
      // So three terms, weighted so the floor dominates: lit windows arrive in
      // rows and in blocks, and the threshold lands about a quarter of them.
      let rw = hash21(id * 1.7 + seed);
      let rf = hash21(vec2f(11.3, floor(id.y)) * 3.1 + seed);
      let rb = hash21(vec2f(floor(id.x * 0.34), 7.9) * 5.7 + seed);
      let occupancy = rf * 0.46 + rb * 0.30 + rw * 0.24;
      let on = step(0.615, occupancy);

      // Tungsten in most, cool fluorescent in a few: an office tower left on
      // overnight is not the same colour as a lit sitting room. Keyed off the
      // floor rather than the window, because a floor is one tenant with one
      // kind of light fitting.
      let warm = mix(vec3f(1.00, 0.79, 0.48), vec3f(0.80, 0.89, 1.00), step(0.86, rf));
      // Blinds, lamps, how deep the room is: a lit floor is not a flat bar of
      // light, and this is what stops one reading as a painted stripe.
      let strength = 0.40 + rw * 0.62;
      out = mix(out, warm * strength, on * night * cover * 0.94);

      // A window that is dark is not black. It takes the night sky, which is
      // what gives an unlit face its shape instead of a silhouette.
      out = mix(out, vec3f(0.045, 0.058, 0.080), (1.0 - on) * night * cover * 0.55);
    }
  }

  // A lamp is its own light source, like a lit sign: it takes no shading at
  // all, or a headlight in shadow is a grey oval.
  if (in.material == MAT_LAMP) {
    out = clamp(lampColour(in.local, in.tint != 4u) * 1.45, vec3f(0.0), vec3f(1.0));
  }

  // Air in front of the building. Without it a white block a kilometre away is
  // the same white as one across the street, and the city reads as a model on
  // a table rather than as a place with distance in it. Off in the viewer,
  // where the subject is eighty metres away and the background is not sky.
  let haze = scene.params.x;
  if (haze > 0.0) {
    let toEye = in.world - scene.eye.xyz;
    // After the tonemap, unlike the ground: the surface colours here have
    // already been through it, and running it twice crushes them.
    // The body of the sky, not the whole of it: this is the colour distance
    // fades into, and a star field and a moon disc are not resolvable through
    // it at any strength. Every lit pixel of every building runs this line.
    let air = skyBody(toEye, sun);
    let lit = pow(air / (air + vec3f(0.72)) * 1.42, vec3f(0.9));
    let d = length(toEye);
    let amount = clamp((1.0 - exp(-d * (1.0 / 2600.0))) * 0.62
                     + smoothstep(1600.0, 4200.0, d) * 0.55, 0.0, 1.0) * haze;
    out = mix(out, lit, amount);
  }

  // The building being placed, which is not there yet.
  //
  // Shown as itself rather than as a footprint rectangle, because what a
  // player is judging is the thing -- how tall it is against its neighbours,
  // which way its front faces, whether it fits the gap. A rectangle on the
  // ground answers none of that.
  //
  // Drawn as the real mesh, lit the real way, then pushed towards a cold
  // blue and banded horizontally so it reads as a projection rather than as a
  // building that is already built. Opaque, so it needs no sorting: the bands
  // are what says "not yet", not transparency.
  if (in.ghost > 0.5) {
    let band = 0.5 + 0.5 * sin(in.world.y * 2.6 - scene.params.x * 2.2);
    let tone = dot(out, vec3f(0.30, 0.59, 0.11));
    let cold = mix(vec3f(0.10, 0.30, 0.42), vec3f(0.46, 0.82, 0.98),
                   clamp(tone * 2.6, 0.0, 1.0));
    out = cold * (0.72 + band * 0.42);
    // A bright rim, so the silhouette is legible against whatever is behind it.
    let rim = pow(1.0 - abs(dot(normalize(in.normal), normalize(scene.eye.xyz - in.world))), 3.0);
    out += vec3f(0.30, 0.70, 0.90) * rim * 0.9;
  }
  return vec4f(out, 1.0);
}

@fragment
fn fs_wire() -> @location(0) vec4f {
  return vec4f(0.38, 0.83, 1.0, 1.0);
}
