/**
 * Mesh construction for procedural assets.
 *
 * Deliberately small: boxes, prisms and cylinders. Almost every building is a
 * composition of those, and a generator that can only make those stays
 * readable -- which matters more than expressiveness when there will eventually
 * be dozens of them.
 *
 * No UVs. Facade coordinates are derived in the shader from world position and
 * face normal (see asset.wgsl), so window rows line up across every surface of
 * a building automatically and nothing has to be unwrapped. The cost is that
 * facades are axis-aligned, which is true of the buildings these generate.
 *
 * Vertex layout: position(3), normal(3), material(1), ambient occlusion(1),
 * tint(1), local uv(2) = 11 floats.
 *
 * `local` is 0..1 across a face and is only meaningful on sign faces, where it
 * is what lets the shader lay a name across the board. Everything else leaves
 * it at zero.
 *
 * `tint` indexes a small palette in the shader. It is how a building carries a
 * brand: the same shopfront generator makes a green grocer and a red diner by
 * painting the fascia, awning and door from an index rather than by having two
 * generators. Zero means "use the material's own colour".
 *
 * The occlusion is baked here rather than computed at runtime. Assets are
 * small and built once, so a few milliseconds of ray marching per asset buys
 * the contact shading -- dark inside corners, dark where a wall meets the
 * ground, dark under eaves and balconies -- that is most of the difference
 * between a building and a box.
 */

export const FLOATS_PER_VERTEX = 12;

/** Which face of a box to leave out. Used where one is buried in another solid. */
export type Face = '+x' | '-x' | '+z' | '-z' | '+y';

/** Surface kinds the facade shader knows how to draw. */
export const MAT = {
  /** Flat roof: gravel and plant, no windows. */
  ROOF: 0,
  /** Punched windows in render or brick -- housing. */
  HOUSING: 1,
  /** Curtain wall: continuous glass with mullions -- offices. */
  GLASS: 2,
  /** Corrugated metal -- industrial. */
  METAL: 3,
  /** Brick coursework with small openings -- low-rise. */
  BRICK: 4,
  /** Painted trim, cornices, frames. No pattern. */
  TRIM: 5,
  /** Shopfront glazing: tall, undivided, at street level. */
  SHOPFRONT: 6,
  /** Pitched roof tiles. */
  TILE: 7,
  /** The ground the asset stands on. Viewer only, for now. */
  GROUND: 8,
  /**
   * Brick with punched windows drawn into it. For shaded variants, where the
   * openings are not modelled -- sculpted variants use plain BRICK and model
   * theirs, or the two would draw on top of each other.
   */
  HOUSE_WALL: 9,
  /** Corrugated metal with a clerestory band, for shaded industrial. */
  SHED_WALL: 10,
  /** Precast panels with visible joints. Podiums, slabs, plant. */
  CONCRETE: 11,
  /** Painted render, flat. Cheap housing and infill. */
  PLASTER: 12,
  /**
   * A single glazed opening, carrying 0..1 coordinates across the pane.
   *
   * Distinct from GLASS because a modelled window needs one room mapped across
   * the whole pane, while a curtain wall needs a grid of them tiled by world
   * position. Sharing a material made every window show an arbitrary slice of
   * somebody's living room.
   */
  PANE: 13,
  /**
   * A pitched roof covering: overlapping courses with a shadow line under
   * each. Distinct from TILE, which is a flat tiled surface -- a pitched roof
   * drawn with the flat-roof membrane is why every house had a grey lid.
   */
  ROOF_TILE: 14,
  /** Coursed ashlar. Civic frontages, bank plinths, older office bases. */
  STONE: 15,
  /**
   * Rainscreen cladding panels. The one material allowed a saturated colour,
   * which is where most modern buildings get their identity.
   */
  CLADDING: 16,
  /** Vertical timber boarding with battens. */
  TIMBER: 17,
  /**
   * Automotive paint: a flat colour with a clearcoat sheen, keyed off the
   * part key rather than the building seed, so ten cars in one scene are ten
   * colours without ten draw calls.
   */
  PAINT: 18,
  /**
   * Clothing and skin for figures. Same trick as PAINT -- the key picks the
   * garment colour -- with a matte, slightly noisy finish so a crowd does not
   * look like a row of painted bollards.
   */
  FIGURE: 19,
  /**
   * A number plate. The registration is generated in the shader from the part
   * key, so every car in a car park carries a different one without any of
   * them costing a draw call or a character of geometry.
   */
  PLATE: 20,
  /**
   * Tyre: a black rubber sidewall with a moulded shoulder and tread blocks.
   * Distinct from painted trim because a tyre is the one thing on a car that
   * is neither shiny nor flat, and it is a fifth of what you see of a wheel.
   */
  TYRE: 21,
  /**
   * Anodised near-black extrusion: frames, copings and fins.
   *
   * The modern theme is white render, black frames and glass, and there was
   * no black in the palette -- TRIM is a pale painted joinery colour. Without
   * this the theme came out as white-on-white and read as unfinished.
   */
  DARK_TRIM: 22,
  /** Cool white render panel with expressed joints: the modern theme's wall. */
  RENDER: 23,
  /**
   * Vehicle glazing.
   *
   * Cars used MAT.GLASS, which is the building curtain wall -- a mullion grid
   * with a floor line in it. At car scale that grid reads as an open frame,
   * and every car in the fleet looked as though you could see straight through
   * its greenhouse into the street beyond. This is a single dark tinted pane
   * with a gradient and no grid.
   */
  CAR_GLASS: 24,
  /**
   * A lamp lens: emissive, banded, unaffected by light.
   *
   * Headlights and tail lights are the only part of a car that emits, and
   * painting them left every vehicle in the library with grey ovals at each
   * end. The tint says which end it is: SIGN_LIT is a headlight, anything
   * else a tail light.
   */
  LAMP: 25,
} as const;

export type Material = (typeof MAT)[keyof typeof MAT];

export type Vec3 = [number, number, number];

/**
 * Palette slots the shader knows. Index 0 means untinted.
 *
 * Kept small and named after what they are for, not after colours, so a brand
 * can be restyled in one place without every generator needing to change.
 */
export const TINT = {
  NONE: 0,
  BRAND: 1,        // the building's primary brand colour
  BRAND_DARK: 2,   // the same, shaded, for reveals and sign returns
  ACCENT: 3,       // secondary brand colour, for stripes and trim
  SIGN_LIT: 4,     // illuminated sign face
  DOOR: 5,         // painted joinery
  AWNING: 6,       // fabric
  METAL_DARK: 7,   // dark ironwork, railings, fire escapes
  WOOD: 8,
  GREEN: 9,        // planting
} as const;

export type Tint = (typeof TINT)[keyof typeof TINT];

export class MeshBuilder {
  private verts: number[] = [];
  private idx: number[] = [];
  /** Applied to everything pushed until it is changed again. */
  private tint: number = TINT.NONE;
  /**
   * Part key, written into the local-uv channel.
   *
   * PAINT and FIGURE read it to pick a colour, which is how one asset can hold
   * a crowd of differently dressed people, or a car park of different cars,
   * without a material per colour. Everything else ignores it.
   */
  private key = 0;
  /**
   * Set once dressRoof has run on this mesh.
   *
   * The registry dresses every zoned building's roof as a last pass, so a
   * generator that never asked cannot end up with a bare lid. This is how it
   * knows not to dress a roof its generator already dressed with options of
   * its own -- which would find the new deck and stack a second tray on it.
   */
  roofDressed = false;
  /** Rotation and offset applied to everything emitted, or null for none. */
  private place: { cx: number; cz: number; q: number } | null = null;

  /**
   * Runs `body` with a part key applied, then restores the previous one.
   *
   * Any integer; only its hash matters. Use one key per thing that should be
   * its own colour -- per car, per person, per garment.
   */
  keyed(key: number, body: () => void): void {
    const prev = this.key;
    this.key = key;
    body();
    this.key = prev;
  }

  /** Runs `body` with a tint applied, then restores the previous one. */
  painted(tint: Tint, body: () => void): void {
    const prev = this.tint;
    this.tint = tint;
    body();
    this.tint = prev;
  }

  get triangleCount(): number {
    return this.idx.length / 3;
  }

  get vertexCount(): number {
    return this.verts.length / FLOATS_PER_VERTEX;
  }

  /**
   * Runs `body` with everything it emits rotated about Y and moved into place.
   *
   * Quarter turns only, so an axis-aligned box stays axis-aligned and the
   * facade shading -- which picks its coordinate from the dominant face normal
   * -- keeps working. That is the whole reason the library is axis-aligned, and
   * it is also enough: a parked car, a skip, a bench face along a street.
   */
  placed(cx: number, cz: number, quarterTurns: number, body: () => void): void {
    const prev = this.place;
    const q = ((quarterTurns % 4) + 4) % 4;
    this.place = { cx, cz, q };
    body();
    this.place = prev;
  }

  /** Applies the current placement to a point. */
  private xf(p: Vec3): Vec3 {
    const t = this.place;
    if (t === null) return p;
    const [x, y, z] = p;
    switch (t.q) {
      case 1: return [t.cx - z, y, t.cz + x];
      case 2: return [t.cx - x, y, t.cz - z];
      case 3: return [t.cx + z, y, t.cz - x];
      default: return [t.cx + x, y, t.cz + z];
    }
  }

  /** Adds one triangle from explicit positions, with a shared face normal. */
  tri(rawA: Vec3, rawB: Vec3, rawC: Vec3, mat: Material): void {
    const a = this.xf(rawA), b = this.xf(rawB), c = this.xf(rawC);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;

    const base = this.vertexCount;
    for (const p of [a, b, c]) {
      this.verts.push(p[0], p[1], p[2], nx, ny, nz, mat, 1, this.tint, 0, 0, this.key);
    }
    this.idx.push(base, base + 1, base + 2);
  }

  /** Adds a quad as two triangles, wound a-b-c-d. */
  quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, mat: Material): void {
    this.tri(a, b, c, mat);
    this.tri(a, c, d, mat);
  }

  /** A triangle carrying explicit surface coordinates at each corner. */
  triUV(a: Vec3, b: Vec3, c: Vec3, uv: Array<[number, number]>, mat: Material): void {
    const p = [this.xf(a), this.xf(b), this.xf(c)];
    const ux = p[1][0] - p[0][0], uy = p[1][1] - p[0][1], uz = p[1][2] - p[0][2];
    const vx = p[2][0] - p[0][0], vy = p[2][1] - p[0][1], vz = p[2][2] - p[0][2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    const base = this.vertexCount;
    for (let i = 0; i < 3; i++) {
      this.verts.push(p[i][0], p[i][1], p[i][2], nx, ny, nz, mat, 1, this.tint,
        uv[i][0], uv[i][1], this.key);
    }
    this.idx.push(base, base + 1, base + 2);
  }

  /**
   * A quad carrying explicit surface coordinates at each corner.
   *
   * For surfaces the shader has to draw something *along* rather than tile by
   * world position: a car flank wants panel gaps at fractions of its own
   * length, and the facade coordinate cannot give that, because it is derived
   * from world position and the dominant face normal and flips axis wherever
   * the body curves.
   */
  quadUV(a: Vec3, b: Vec3, c: Vec3, d: Vec3, uv: Array<[number, number]>, mat: Material): void {
    const emit = (i0: number, i1: number, i2: number): void => {
      const p = [this.xf(a), this.xf(b), this.xf(c), this.xf(d)];
      const A = p[i0], B = p[i1], C = p[i2];
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
      const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      const base = this.vertexCount;
      for (const i of [i0, i1, i2]) {
        const q = p[i];
        this.verts.push(q[0], q[1], q[2], nx, ny, nz, mat, 1, this.tint,
          uv[i][0], uv[i][1], this.key);
      }
      this.idx.push(base, base + 1, base + 2);
    };
    emit(0, 1, 2);
    emit(0, 2, 3);
  }

  /**
   * Axis-aligned box. `skipBottom` defaults true: the underside of anything
   * standing on the ground is never seen, and it is a sixth of the triangles.
   */
  box(min: Vec3, max: Vec3, mat: Material,
      opts: { skipBottom?: boolean; roof?: Material; skip?: Face } = {}): void {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    const roof = opts.roof ?? mat;
    const skip = opts.skip;

    // `skip` drops the one face a caller knows is buried in another solid.
    // Window frames are the case that pays for this: four boxes per opening,
    // each with a face pressed flat against the wall behind it, times a few
    // hundred openings on a tower.
    if (skip !== '+x') this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], mat);
    if (skip !== '-x') this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], mat);
    if (skip !== '+z') this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], mat);
    if (skip !== '-z') this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], mat);
    if (skip !== '+y') this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], roof);
    if (opts.skipBottom === false) {
      this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], mat);
    }
  }

  /**
   * Gable roof over a footprint. `along` picks the ridge axis: 'x' runs the
   * ridge east-west, 'z' north-south.
   */
  gable(min: Vec3, max: Vec3, height: number, along: 'x' | 'z', mat: Material, gableMat: Material): void {
    const [x0, y, z0] = min;
    const [x1, , z1] = max;
    const peak = y + height;

    if (along === 'x') {
      const mz = (z0 + z1) / 2;
      this.quad([x0, y, z1], [x1, y, z1], [x1, peak, mz], [x0, peak, mz], mat);
      this.quad([x1, y, z0], [x0, y, z0], [x0, peak, mz], [x1, peak, mz], mat);
      this.tri([x1, y, z1], [x1, y, z0], [x1, peak, mz], gableMat);
      this.tri([x0, y, z0], [x0, y, z1], [x0, peak, mz], gableMat);
    } else {
      const mx = (x0 + x1) / 2;
      this.quad([x1, y, z1], [x1, y, z0], [mx, peak, z0], [mx, peak, z1], mat);
      this.quad([x0, y, z0], [x0, y, z1], [mx, peak, z1], [mx, peak, z0], mat);
      this.tri([x0, y, z1], [x1, y, z1], [mx, peak, z1], gableMat);
      this.tri([x1, y, z0], [x0, y, z0], [mx, peak, z0], gableMat);
    }
  }

  /** Vertical cylinder, for tanks and silos. */
  cylinder(cx: number, cz: number, r: number, y0: number, y1: number, segments: number, mat: Material, cap = true): void {
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const p0: Vec3 = [cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r];
      const p1: Vec3 = [cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r];
      const p2: Vec3 = [cx + Math.cos(a1) * r, y1, cz + Math.sin(a1) * r];
      const p3: Vec3 = [cx + Math.cos(a0) * r, y1, cz + Math.sin(a0) * r];
      // Wound p0-p3-p2-p1 so the face normal points out of the cylinder.
      // The obvious order points it inward, which back-face culls the near
      // side and leaves the far side lit from behind -- a black tube.
      this.quad(p0, p3, p2, p1, mat);
      if (cap) {
        this.tri([cx, y1, cz],
                 [cx + Math.cos(a1) * r, y1, cz + Math.sin(a1) * r],
                 [cx + Math.cos(a0) * r, y1, cz + Math.sin(a0) * r], mat);
      }
    }
  }

  /**
   * A window: glass set slightly into the wall, with a frame standing proud of
   * it on all four sides.
   *
   * Built from boxes rather than as a hole cut through the wall. Cutting holes
   * means re-triangulating the wall face for every opening, which is where
   * procedural building generators usually become unreadable -- and at these
   * sizes the frame's own shadow reads the same either way.
   *
   * `axis` is the wall's normal axis, `sign` which way it faces, `plane` where
   * that wall is. `u` runs horizontally along the wall: z for an X-facing wall,
   * x for a Z-facing one.
   */
  opening(o: {
    axis: 'x' | 'z';
    sign: 1 | -1;
    plane: number;
    u0: number; u1: number;
    y0: number; y1: number;
    frame?: number;
    proud?: number;
    glass: Material;
    frameMat?: Material;
  }): void {
    const f = o.frame ?? 0.11;
    const proud = o.proud ?? 0.09;
    const frameMat = o.frameMat ?? MAT.TRIM;
    const inset = 0.06;

    /** A box spanning [ua,ub] x [ya,yb], between two depths from the wall. */
    const slab = (ua: number, ub: number, ya: number, yb: number, da: number, db: number, mat: Material): void => {
      const lo = o.plane + o.sign * Math.min(da, db);
      const hi = o.plane + o.sign * Math.max(da, db);
      // Frames are seen from outside and from the sides, never from below, so
      // the default five faces is right. Over hundreds of windows per building
      // that sixth face is hundreds of triangles for nothing.
      // The face pointing back into the wall is never seen: skip it.
      const back: Face = o.axis === 'x' ? (o.sign > 0 ? '-x' : '+x') : (o.sign > 0 ? '-z' : '+z');
      if (o.axis === 'x') this.box([lo, ya, ua], [hi, yb, ub], mat, { skip: back });
      else this.box([ua, ya, lo], [ub, yb, hi], mat, { skip: back });
    };

    // Glass is a single quad, not a box: it sits in a recess and nothing ever
    // sees its edges. Two triangles instead of ten, times every window in the
    // city. Glazing carries pane coordinates so the shader can put one room
    // behind it; anything else (a door leaf, a shutter) does not.
    const glazed = o.glass === MAT.GLASS || o.glass === MAT.SHOPFRONT;
    const mat: Material = glazed ? MAT.PANE : o.glass;
    // Just in front of the wall, not behind it.
    //
    // A real window is recessed, and modelling it that way put the pane inside
    // the wall box -- where the wall's own front face occluded it, because
    // these walls have no hole cut in them. Every window in the library was an
    // empty frame showing brick. The frame stands proud instead, and its
    // shadow does the work of the reveal.
    const gd = o.plane + o.sign * 0.012;
    if (o.axis === 'x') {
      const a: Vec3 = [gd, o.y0, o.u0], b: Vec3 = [gd, o.y0, o.u1];
      const c: Vec3 = [gd, o.y1, o.u1], d: Vec3 = [gd, o.y1, o.u0];
      if (o.sign > 0) {
        if (glazed) this.signFace(b, a, d, c, mat); else this.quad(b, a, d, c, mat);
      } else if (glazed) this.signFace(a, b, c, d, mat); else this.quad(a, b, c, d, mat);
    } else {
      const a: Vec3 = [o.u0, o.y0, gd], b: Vec3 = [o.u1, o.y0, gd];
      const c: Vec3 = [o.u1, o.y1, gd], d: Vec3 = [o.u0, o.y1, gd];
      if (o.sign > 0) {
        if (glazed) this.signFace(a, b, c, d, mat); else this.quad(a, b, c, d, mat);
      } else if (glazed) this.signFace(b, a, d, c, mat); else this.quad(b, a, d, c, mat);
    }

    slab(o.u0 - f, o.u1 + f, o.y1, o.y1 + f, -inset, proud, frameMat);
    slab(o.u0 - f, o.u1 + f, o.y0 - f, o.y0, -inset, proud, frameMat);
    slab(o.u0 - f, o.u0, o.y0, o.y1, -inset, proud, frameMat);
    slab(o.u1, o.u1 + f, o.y0, o.y1, -inset, proud, frameMat);
  }

  /** Windows evenly spaced along a wall, one row. */
  windowRow(o: {
    axis: 'x' | 'z';
    sign: 1 | -1;
    plane: number;
    from: number; to: number;
    y0: number; y1: number;
    count: number;
    width: number;
    glass: Material;
    frame?: number;
    proud?: number;
  }): void {
    const span = o.to - o.from;
    for (let i = 0; i < o.count; i++) {
      const c = o.from + ((i + 0.5) / o.count) * span;
      this.opening({
        axis: o.axis, sign: o.sign, plane: o.plane,
        u0: c - o.width / 2, u1: c + o.width / 2,
        y0: o.y0, y1: o.y1, glass: o.glass,
        ...(o.frame !== undefined ? { frame: o.frame } : {}),
        ...(o.proud !== undefined ? { proud: o.proud } : {}),
      });
    }
  }

  /** Cone or truncated cone, for silo tops and hoppers. */
  cone(cx: number, cz: number, r0: number, r1: number, y0: number, y1: number, segments: number, mat: Material): void {
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const p0: Vec3 = [cx + Math.cos(a0) * r0, y0, cz + Math.sin(a0) * r0];
      const p1: Vec3 = [cx + Math.cos(a1) * r0, y0, cz + Math.sin(a1) * r0];
      if (r1 < 0.001) {
        this.tri(p1, p0, [cx, y1, cz], mat);
      } else {
        this.quad(p0,
          [cx + Math.cos(a0) * r1, y1, cz + Math.sin(a0) * r1],
          [cx + Math.cos(a1) * r1, y1, cz + Math.sin(a1) * r1],
          p1, mat);
      }
    }
  }

  /** A run of pipe as a box. Cheaper than a cylinder and reads identically. */
  pipe(from: Vec3, to: Vec3, radius: number, mat: Material, sides = 6): void {
    // A real prism along the axis, not the bounding box of the two ends. It
    // was the bounding box, which is identical for an axis-aligned run and
    // catastrophic for a diagonal one: the cable-stayed bridge's twelve stays
    // came out as twelve solids the size of the bridge, and every bicycle
    // frame in the library was a stack of blocks.
    const ax = to[0] - from[0], ay = to[1] - from[1], az = to[2] - from[2];
    const len = Math.hypot(ax, ay, az);
    if (len < 1e-6) return;
    const dx = ax / len, dy = ay / len, dz = az / len;
    // Any vector not parallel to the axis gives a starting perpendicular.
    const ref: Vec3 = Math.abs(dy) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let ux = ref[1] * dz - ref[2] * dy;
    let uy = ref[2] * dx - ref[0] * dz;
    let uz = ref[0] * dy - ref[1] * dx;
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul; uy /= ul; uz /= ul;
    const vx = dy * uz - dz * uy;
    const vy = dz * ux - dx * uz;
    const vz = dx * uy - dy * ux;

    const ring = (p: Vec3): Vec3[] => {
      const out: Vec3[] = [];
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        const c = Math.cos(a) * radius, s2 = Math.sin(a) * radius;
        out.push([p[0] + ux * c + vx * s2, p[1] + uy * c + vy * s2, p[2] + uz * c + vz * s2]);
      }
      return out;
    };
    const A = ring(from), B = ring(to);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      this.quad(A[i], A[j], B[j], B[i], mat);
    }
    // Caps, as fans from each end point.
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      this.tri(A[j], A[i], from, mat);
      this.tri(B[i], B[j], to, mat);
    }
  }


  /**
   * A quad carrying local 0..1 coordinates, for surfaces the shader needs to
   * lay something across -- currently sign boards, so a name can be written on
   * one. Corners are given in the order bottom-left, bottom-right, top-right,
   * top-left.
   */
  signFace(a: Vec3, b: Vec3, c: Vec3, d: Vec3, mat: Material): void {
    const uv: Array<[number, number]> = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const emit = (i0: number, i1: number, i2: number): void => {
      const p = [this.xf(a), this.xf(b), this.xf(c), this.xf(d)];
      const A = p[i0], B = p[i1], C = p[i2];
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
      const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      const base = this.vertexCount;
      for (const i of [i0, i1, i2]) {
        const q = p[i];
        this.verts.push(q[0], q[1], q[2], nx, ny, nz, mat, 1, this.tint, uv[i][0], uv[i][1], this.key);
      }
      this.idx.push(base, base + 1, base + 2);
    };
    emit(0, 1, 2);
    emit(0, 2, 3);
  }

  /**
   * The main flat roof, if there is one: its height and its plan extent.
   *
   * Found by binning every upward-facing triangle's area by height and taking
   * the highest bin that holds a real amount of area. A pitched roof has no
   * such bin and returns null, which is right -- a pitch is never a bare lid.
   *
   * This exists so a generator can dress its own roof without restating
   * coordinates it already has in three other forms. Getting those numbers
   * slightly wrong is how plant ends up hovering beside a building.
   */
  roofPlane(): { y: number; min: [number, number]; max: [number, number] } | null {
    let top = -Infinity;
    for (let i = 1; i < this.verts.length; i += FLOATS_PER_VERTEX) {
      if (this.verts[i] > top) top = this.verts[i];
    }
    if (!Number.isFinite(top) || top < 3) return null;

    const bins = new Map<number, { area: number; x0: number; x1: number; z0: number; z1: number }>();
    for (let t = 0; t < this.idx.length; t += 3) {
      const p = [0, 1, 2].map((k) => this.idx[t + k] * FLOATS_PER_VERTEX);
      // Genuinely horizontal, not merely upward. A 21-degree pitch still has
      // a normal of 0.93, so at 0.9 the top slice of a gable binned as a flat
      // roof and every pitched block got plant inside its own roof void.
      if (this.verts[p[0] + 4] < 0.995) continue;
      const cy = (this.verts[p[0] + 1] + this.verts[p[1] + 1] + this.verts[p[2] + 1]) / 3;
      const ux = this.verts[p[1]] - this.verts[p[0]];
      const uz = this.verts[p[1] + 2] - this.verts[p[0] + 2];
      const wx = this.verts[p[2]] - this.verts[p[0]];
      const wz = this.verts[p[2] + 2] - this.verts[p[0] + 2];
      const area = Math.abs(ux * wz - uz * wx) / 2;
      const k = Math.round(cy * 4) / 4;
      const b = bins.get(k) ?? { area: 0, x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
      b.area += area;
      for (const q of p) {
        b.x0 = Math.min(b.x0, this.verts[q]); b.x1 = Math.max(b.x1, this.verts[q]);
        b.z0 = Math.min(b.z0, this.verts[q + 2]); b.z1 = Math.max(b.z1, this.verts[q + 2]);
      }
      bins.set(k, b);
    }
    let bestY: number | null = null;
    let best: { area: number; x0: number; x1: number; z0: number; z1: number } | null = null;
    for (const [y, b] of bins) {
      if (b.area < 30 || y < top * 0.55) continue;
      if (bestY === null || y >= bestY) { bestY = y; best = b; }
    }
    if (bestY === null || best === null) return null;

    // Reject a plane that something else is sitting on top of. A gabled block
    // is built as a box with a roof face and a gable over it, so the box's own
    // top is still the largest upward plane in the mesh -- dressing it puts
    // plant and a parapet *inside* the roof void, which is what the first pass
    // did to every pitched building it touched.
    const ix0 = best.x0 + (best.x1 - best.x0) * 0.08;
    const ix1 = best.x1 - (best.x1 - best.x0) * 0.08;
    const iz0 = best.z0 + (best.z1 - best.z0) * 0.08;
    const iz1 = best.z1 - (best.z1 - best.z0) * 0.08;
    let over = 0;
    for (let t = 0; t < this.idx.length; t += 3) {
      const p = [0, 1, 2].map((k) => this.idx[t + k] * FLOATS_PER_VERTEX);
      const cy = (this.verts[p[0] + 1] + this.verts[p[1] + 1] + this.verts[p[2] + 1]) / 3;
      if (cy < bestY + 0.4) continue;
      const cx = (this.verts[p[0]] + this.verts[p[1]] + this.verts[p[2]]) / 3;
      const cz = (this.verts[p[0] + 2] + this.verts[p[1] + 2] + this.verts[p[2] + 2]) / 3;
      if (cx < ix0 || cx > ix1 || cz < iz0 || cz > iz1) continue;
      const ux = this.verts[p[1]] - this.verts[p[0]];
      const uz = this.verts[p[1] + 2] - this.verts[p[0] + 2];
      const wx = this.verts[p[2]] - this.verts[p[0]];
      const wz = this.verts[p[2] + 2] - this.verts[p[0] + 2];
      over += Math.abs(ux * wz - uz * wx) / 2;
    }
    if (over > best.area * 0.35) return null;

    return { y: bestY, min: [best.x0, best.z0], max: [best.x1, best.z1] };
  }

  /**
   * The highest horizontal plane that has nothing standing on it.
   *
   * roofPlane() is deliberately strict -- it refuses a plane that something
   * else covers, so a gabled block's own box top is never dressed. That
   * strictness also makes it refuse plenty of genuinely bare tops: a podium
   * with a stair core in one corner, a shed with a single vent. Those are the
   * lids the audit reports, and they are the ones worth dressing, so they get
   * a looser search of their own: the highest real horizontal plane with
   * almost nothing above it.
   */
  bareRoofPlane(): { y: number; min: [number, number]; max: [number, number] } | null {
    let top = -Infinity;
    for (let i = 1; i < this.verts.length; i += FLOATS_PER_VERTEX) {
      if (this.verts[i] > top) top = this.verts[i];
    }
    if (!Number.isFinite(top) || top < 3) return null;

    const bins = new Map<number, { area: number; x0: number; x1: number; z0: number; z1: number }>();
    const above: number[] = [];
    for (let t = 0; t < this.idx.length; t += 3) {
      const p = [0, 1, 2].map((k) => this.idx[t + k] * FLOATS_PER_VERTEX);
      const cy = (this.verts[p[0] + 1] + this.verts[p[1] + 1] + this.verts[p[2] + 1]) / 3;
      above.push(cy);
      if (this.verts[p[0] + 4] < 0.995) continue;
      const ux = this.verts[p[1]] - this.verts[p[0]];
      const uz = this.verts[p[1] + 2] - this.verts[p[0] + 2];
      const wx = this.verts[p[2]] - this.verts[p[0]];
      const wz = this.verts[p[2] + 2] - this.verts[p[0] + 2];
      const area = Math.abs(ux * wz - uz * wx) / 2;
      const k = Math.round(cy * 4) / 4;
      const b = bins.get(k) ?? { area: 0, x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
      b.area += area;
      for (const q of p) {
        b.x0 = Math.min(b.x0, this.verts[q]); b.x1 = Math.max(b.x1, this.verts[q]);
        b.z0 = Math.min(b.z0, this.verts[q + 2]); b.z1 = Math.max(b.z1, this.verts[q + 2]);
      }
      bins.set(k, b);
    }
    let bestY: number | null = null;
    let best: { area: number; x0: number; x1: number; z0: number; z1: number } | null = null;
    for (const [y, b] of bins) {
      if (b.area < 25 || y < top * 0.55) continue;
      // A long thin plane is a canopy or a cornice, not a roof.
      if (Math.min(b.x1 - b.x0, b.z1 - b.z0) < 4) continue;
      // Bare: what stands on it is a handful of triangles, not a storey.
      if (above.filter((cy) => cy > y + 0.35).length >= 24) continue;
      if (bestY === null || y >= bestY) { bestY = y; best = b; }
    }
    if (bestY === null || best === null) return null;
    return { y: bestY, min: [best.x0, best.z0], max: [best.x1, best.z1] };
  }

  /**
   * Whether the given roof plane already has something standing round its edge.
   *
   * Used to decide whether a roof still wants a parapet. Measured rather than
   * declared, because the caller that needs to know -- the pass that dresses
   * every roof in the library -- has no idea what each generator built.
   */
  hasUpstand(roof: { y: number; min: [number, number]; max: [number, number] }): boolean {
    const [x0, z0] = roof.min;
    const [x1, z1] = roof.max;
    const bx = (x1 - x0) * 0.1, bz = (z1 - z0) * 0.1;
    let edge = 0;
    for (let t = 0; t < this.idx.length; t += 3) {
      const p = [0, 1, 2].map((k) => this.idx[t + k] * FLOATS_PER_VERTEX);
      const cy = (this.verts[p[0] + 1] + this.verts[p[1] + 1] + this.verts[p[2] + 1]) / 3;
      if (cy < roof.y + 0.15 || cy > roof.y + 2.5) continue;
      const cx = (this.verts[p[0]] + this.verts[p[1]] + this.verts[p[2]]) / 3;
      const cz = (this.verts[p[0] + 2] + this.verts[p[1] + 2] + this.verts[p[2] + 2]) / 3;
      if (cx < x0 - 0.6 || cx > x1 + 0.6 || cz < z0 - 0.6 || cz > z1 + 0.6) continue;
      const near = cx < x0 + bx || cx > x1 - bx || cz < z0 + bz || cz > z1 - bz;
      if (near) edge++;
    }
    return edge >= 16;
  }

  /** World-space bounds of everything pushed so far. Cheap: no AO, no copy. */
  bounds(): { min: Vec3; max: Vec3 } {
    const min: Vec3 = [Infinity, Infinity, Infinity];
    const max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < this.verts.length; i += FLOATS_PER_VERTEX) {
      for (let k = 0; k < 3; k++) {
        const v = this.verts[i + k];
        if (v < min[k]) min[k] = v;
        if (v > max[k]) max[k] = v;
      }
    }
    if (!Number.isFinite(min[0])) return { min: [0, 0, 0], max: [0, 0, 0] };
    return { min, max };
  }

  build(opts: { occlusion?: boolean } = {}): { vertices: Float32Array<ArrayBuffer>; indices: Uint32Array<ArrayBuffer> } {
    const vertices = new Float32Array(this.verts.length);
    vertices.set(this.verts);
    const indices = new Uint32Array(this.idx.length);
    indices.set(this.idx);
    if (opts.occlusion !== false) bakeOcclusion(vertices, indices);
    return { vertices, indices };
  }
}

// ---------------------------------------------------------------- occlusion

const VOXEL = 0.34;          // metres
const RAY_STEPS = 9;
const RAY_LENGTH = 3.4;      // metres
const STRENGTH = 0.70;
/**
 * Rays start this far along the normal. Without it every ray leaving a flat
 * wall immediately re-enters the wall's own surface voxels and the whole
 * building bakes out uniformly dark -- which is exactly what the first attempt
 * did.
 */
const ORIGIN_OFFSET = 0.62;

/** Cosine-weighted hemisphere directions, generated once by a spiral. */
const HEMISPHERE: Vec3[] = (() => {
  const dirs: Vec3[] = [];
  const n = 20;
  for (let i = 0; i < n; i++) {
    // Fibonacci hemisphere: even coverage without clumping, which matters at
    // this few samples -- clumped rays produce blotches, not soft corners.
    const y = Math.sqrt((i + 0.5) / n);
    const r = Math.sqrt(1 - y * y);
    const phi = (i + 0.5) * Math.PI * (3 - Math.sqrt(5));
    dirs.push([Math.cos(phi) * r, y, Math.sin(phi) * r]);
  }
  return dirs;
})();

function voxelKey(x: number, y: number, z: number): number {
  // 10 bits per axis around the origin: +/-170 m at this voxel size, far more
  // than any single building needs.
  return ((x + 512) | ((y + 512) << 10) | ((z + 512) << 20)) >>> 0;
}

/**
 * Marks every voxel the surface passes through, by sampling each triangle on a
 * grid finer than the voxels. Surface-only, not solid -- which is what we want:
 * a ray that reaches a wall from outside should stop at the wall.
 */
function voxelize(vertices: Float32Array, indices: Uint32Array): Set<number> {
  const grid = new Set<number>();
  const mark = (x: number, y: number, z: number): void => {
    grid.add(voxelKey(Math.floor(x / VOXEL), Math.floor(y / VOXEL), Math.floor(z / VOXEL)));
  };

  for (let t = 0; t < indices.length; t += 3) {
    const ia = indices[t] * FLOATS_PER_VERTEX;
    const ib = indices[t + 1] * FLOATS_PER_VERTEX;
    const ic = indices[t + 2] * FLOATS_PER_VERTEX;
    const ax = vertices[ia], ay = vertices[ia + 1], az = vertices[ia + 2];
    const bx = vertices[ib], by = vertices[ib + 1], bz = vertices[ib + 2];
    const cx = vertices[ic], cy = vertices[ic + 1], cz = vertices[ic + 2];

    // Sample density from the triangle's longest edge, so big faces are not
    // sampled as coarsely as small ones.
    const span = Math.max(
      Math.hypot(bx - ax, by - ay, bz - az),
      Math.hypot(cx - ax, cy - ay, cz - az),
      Math.hypot(cx - bx, cy - by, cz - bz),
    );
    const n = Math.min(48, Math.max(2, Math.ceil((span / VOXEL) * 1.6)));
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n - i; j++) {
        const u = i / n, v = j / n, w = 1 - u - v;
        mark(ax * w + bx * u + cx * v, ay * w + by * u + cy * v, az * w + bz * u + cz * v);
      }
    }
  }
  return grid;
}

/** Writes an occlusion factor into the 8th float of every vertex. */
export function bakeOcclusion(vertices: Float32Array, indices: Uint32Array): void {
  if (indices.length === 0) return;
  const grid = voxelize(vertices, indices);
  const step = RAY_LENGTH / RAY_STEPS;

  for (let v = 0; v < vertices.length; v += FLOATS_PER_VERTEX) {
    const px = vertices[v], py = vertices[v + 1], pz = vertices[v + 2];
    const nx = vertices[v + 3], ny = vertices[v + 4], nz = vertices[v + 5];

    // Tangent frame around the normal, so rays sample the hemisphere the
    // surface actually faces.
    let tx = 0, ty = 0, tz = 0;
    if (Math.abs(ny) < 0.9) { tx = -nz; tz = nx; } else { tx = 1; }
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;
    const bx = ny * tz - nz * ty;
    const by = nz * tx - nx * tz;
    const bz = nx * ty - ny * tx;

    const ox = px + nx * ORIGIN_OFFSET;
    const oy = py + ny * ORIGIN_OFFSET;
    const oz = pz + nz * ORIGIN_OFFSET;

    let hits = 0;
    for (const [dx, dy, dz] of HEMISPHERE) {
      // dy is along the normal; dx and dz span the surface.
      const rx = tx * dx + nx * dy + bx * dz;
      const ry = ty * dx + ny * dy + by * dz;
      const rz = tz * dx + nz * dy + bz * dz;

      for (let s = 1; s <= RAY_STEPS; s++) {
        const d = s * step;
        const sx = ox + rx * d, sy = oy + ry * d, sz = oz + rz * d;
        // The ground is solid too: this is what darkens the base of every wall.
        if (sy < 0) { hits += 1 - (s - 1) / RAY_STEPS; break; }
        if (grid.has(voxelKey(Math.floor(sx / VOXEL), Math.floor(sy / VOXEL), Math.floor(sz / VOXEL)))) {
          // Nearer hits occlude more, which is what makes a corner a gradient
          // rather than a hard band.
          hits += 1 - (s - 1) / RAY_STEPS;
          break;
        }
      }
    }

    const ao = 1 - STRENGTH * (hits / HEMISPHERE.length);
    vertices[v + 7] = Math.max(0.08, Math.min(1, ao));
  }
}
