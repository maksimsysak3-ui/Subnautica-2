// Noise primitives, shared by the ground and by anything that has to look
// like it grew rather than like it was moulded.
//
// No bindings, so this can be included beside whatever a shader binds at group
// zero. Two functions and a struct: smooth value noise for gradual variation,
// and cellular noise for anything made of separate things -- blades of grass,
// leaves on a tree, plates of bark. The difference matters more than it
// sounds. Value noise is smooth, isotropic and Gaussian; a lawn and a canopy
// are none of those, and shading them with it produces green cloud.

/**
 * An integer lattice hash.
 *
 * Integer rather than the usual fract(sin(dot(...))) because the ground runs
 * to three kilometres from the origin: at blade scale that is a coordinate of
 * twenty thousand, where a float hash has run out of mantissa and the noise
 * visibly repeats. Hashing the floored lattice point as bits does not care how
 * far from the origin it is.
 */
fn latticeBits(p : vec2i) -> u32 {
  var h = u32(p.x) * 374761393u + u32(p.y) * 668265263u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return h ^ (h >> 16u);
}

fn lattice(p : vec2i) -> f32 {
  return f32(latticeBits(p)) * (1.0 / 4294967296.0);
}

/** Value noise on that lattice, smoothstep-interpolated. Returns 0..1. */
fn vnoise(p : vec2f) -> f32 {
  let i = floor(p);
  let f = p - i;
  let u = f * f * (3.0 - 2.0 * f);
  let c = vec2i(i);
  let a0 = lattice(c);
  let a1 = lattice(c + vec2i(1, 0));
  let b0 = lattice(c + vec2i(0, 1));
  let b1 = lattice(c + vec2i(1, 1));
  return mix(mix(a0, a1, u.x), mix(b0, b1, u.x), u.y);
}

/**
 * Jittered-lattice cellular noise: the nearest seed, and which one it was.
 *
 * Value noise cannot make grass. It is smooth, isotropic and Gaussian, and
 * turf is none of those -- it is a field of separate objects with dark gaps
 * between them and a different colour in every one. Cells give exactly that:
 * `d1` is the distance to the nearest blade or clump, which shades the gaps,
 * and `id` is that blade's own number, which colours it.
 *
 * Nine hashes a call, so it is gated on the octave fades and never runs on
 * ground the camera cannot resolve.
 */
struct Cell {
  /** Distance to the nearest seed, in cell units. */
  d1 : f32,
  /** Distance to the second nearest: the two together find the edges. */
  d2 : f32,
  /** The nearest seed's own hash, 0..1. */
  id : f32,
};

fn cells(p : vec2f) -> Cell {
  let base = floor(p);
  let f = p - base;
  let c0 = vec2i(base);
  var out = Cell(8.0, 8.0, 0.0);
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let c = c0 + vec2i(x, y);
      // Both jitter axes out of one hash.
      //
      // Two calls put every seed off the diagonal correctly and cost eighteen
      // hashes per lookup -- and this is the most-called function in the
      // renderer: the field parcels, the tussocks, the blades and the road
      // verge all go through it, over ground that is most of the screen. One
      // hash has thirty-two bits and needs about eleven per axis to place a
      // seed inside its cell finely enough that nobody can see the lattice, so
      // taking two disjoint slices of the same word is not an approximation of
      // two hashes, it is two hashes -- the halves of an avalanched word are
      // independent. Nine lookups instead of eighteen, for the same field.
      let bits = latticeBits(c);
      let h = f32(bits & 0xffffu) * (1.0 / 65536.0);
      let g = f32(bits >> 16u) * (1.0 / 65536.0);
      let o = vec2f(f32(x), f32(y)) + vec2f(h, g) - f;
      let d = dot(o, o);
      if (d < out.d1) {
        out.d2 = out.d1; out.d1 = d; out.id = h * 0.5 + g * 0.5;
      } else if (d < out.d2) {
        out.d2 = d;
      }
    }
  }
  out.d1 = sqrt(out.d1);
  out.d2 = sqrt(out.d2);
  return out;
}

/**
 * Turns a sample point into the frame a blade lies in.
 *
 * Grass is combed: the blades in one patch lean the same way, and the way they
 * lean drifts across a field. Rotating by a slow direction field and then
 * squashing one axis is what turns round cells into blades, and it is the
 * single largest difference between this and green noise.
 */
fn comb(p : vec2f, scale : f32, stretch : f32) -> vec2f {
  let a = vnoise(p * (1.0 / 7.0)) * 6.28318;
  let c = cos(a);
  let s = sin(a);
  let r = vec2f(p.x * c - p.y * s, p.x * s + p.y * c);
  return vec2f(r.x / scale, r.y / (scale * stretch));
}

/**
 * How much of an octave survives at this pixel size.
 *
 * Zero once a feature is smaller than about two pixels, full once it is
 * comfortably larger. Returning zero rather than a small number matters: the
 * caller skips the octave entirely, which is what keeps a zoomed-out frame
 * from paying for detail nobody can see.
 */
fn octaveFade(feature : f32, mpp : f32) -> f32 {
  // Three pixels before it starts, nine before it is fully in. The obvious
  // thresholds -- one and four -- let an octave through at the exact size
  // where it aliases, and a field of 0.4 m clumps seen at a pixel each is not
  // clumping, it is mottle. Waiting until a feature is properly resolvable is
  // both the better picture and the cheaper one.
  return smoothstep(3.0, 9.0, feature / mpp);
}

