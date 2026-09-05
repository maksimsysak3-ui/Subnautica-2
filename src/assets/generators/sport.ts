/**
 * Venues, and the two terminals the fleet needed.
 *
 * Everything here is a landmark: one to a city, a hundred metres across, and
 * the middle of whatever district it lands in. The library already had a
 * stadium, and it was the size of a large school -- twelve cells by eleven,
 * which is a municipal ground rather than the thing a city puts on a postcard.
 *
 * A venue at this size is mostly one problem: a bowl of raked seating is a
 * ramp, and a ramp is dull. What makes it read as a stadium is everything
 * hung on the ramp -- a vomitory every twenty metres, a ring of hospitality
 * boxes at the break between tiers, a roof carried on trusses that land
 * somewhere, and a concourse at the bottom that people could actually walk
 * into. Each of those is a loop, so they cost lines rather than triangles.
 *
 * The two terminals are here because the fleet grew past what the library
 * could park. There are aircraft now, and there was nowhere to put one; there
 * are ships, and there was no quay.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import type { Material } from '../mesh';
import { band, kerb, parapet, railing, ring, roofClutter } from '../parts';
import { figure, parkedVehicle } from './vehicles';
import { IMPORTED_IDS, drawImported } from '../imported';

// -------------------------------------------------------------------- helpers

/**
 * A bank of raked seating, as a stepped ring between two rectangles.
 *
 * Steps rather than a smooth ramp, because a stadium bowl seen from outside is
 * a stack of horizontal lines: the terrace edges catch the light and the
 * risers fall into shadow. A single sloped face has neither and reads as a
 * concrete embankment.
 */
function tier(m: MeshBuilder, o: {
  ix: number; iz: number;              // inner rectangle: the edge of the pitch
  ox: number; oz: number;              // outer rectangle: the back of the tier
  y0: number; y1: number;              // rake, from the front row to the back
  steps: number;
  mat?: Material;
  /** Paint every nth terrace edge in the brand colour: seat blocks. */
  bandEvery?: number;
}): void {
  const mat = o.mat ?? MAT.CONCRETE;
  for (let i = 0; i < o.steps; i++) {
    const t0 = i / o.steps, t1 = (i + 1) / o.steps;
    const ax = o.ix + t0 * (o.ox - o.ix), az = o.iz + t0 * (o.oz - o.iz);
    const bx = o.ix + t1 * (o.ox - o.ix), bz = o.iz + t1 * (o.oz - o.iz);
    const y = o.y0 + t1 * (o.y1 - o.y0);
    // Four boxes, not one: the middle of the bowl is the pitch, and a solid
    // box here fills it in.
    m.box([-bx, 0.2, -bz], [-ax, y, bz], mat);
    m.box([ax, 0.2, -bz], [bx, y, bz], mat);
    m.box([-ax, 0.2, -bz], [ax, y, -az], mat);
    m.box([-ax, 0.2, az], [ax, y, bz], mat);
    if (o.bandEvery && i % o.bandEvery === 1) {
      // A block of seats, not a pinstripe. The first version was a six
      // centimetre line and vanished at any distance; a terrace of seats is
      // the height of the riser and it is what gives the bowl its colour.
      m.painted(i % (o.bandEvery * 2) === 1 ? TINT.BRAND : TINT.ACCENT, () => {
        ring(m, -ax, -az, ax, az, y - (o.y1 - o.y0) / o.steps, (o.y1 - o.y0) / o.steps, 0.14, MAT.TRIM);
      });
    }
  }
}

/**
 * Vomitories: the gaps stairs come up through, cut into the back of a tier.
 *
 * Modelled as a dark recess rather than as a hole, because a hole in a stepped
 * ring is a lot of geometry for something read at fifty metres, and the recess
 * gives the same rhythm of dark slots round the bowl.
 */
function vomitories(m: MeshBuilder, ox: number, oz: number, y0: number, y1: number,
  along: number, across: number): void {
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i < along; i++) {
      const x = -ox + ((i + 0.5) / along) * ox * 2;
      for (const s of [1, -1]) {
        m.box([x - 1.6, y0, s * oz - 0.5], [x + 1.6, y1, s * oz + 0.12], MAT.TRIM);
      }
    }
    for (let i = 0; i < across; i++) {
      const z = -oz + ((i + 0.5) / across) * oz * 2;
      for (const s of [1, -1]) {
        m.box([s * ox - 0.5, y0, z - 1.6], [s * ox + 0.12, y1, z + 1.6], MAT.TRIM);
      }
    }
  });
}

/**
 * A flat rectangular annulus: a deck with a hole in the middle.
 *
 * The obvious thing -- one box from the outer edge to the outer edge -- is a
 * lid, and a lid over a stadium bowl is a closed grey shed. That is exactly
 * what the first version of both stadiums was.
 */
function annulus(m: MeshBuilder, ix: number, iz: number, ox: number, oz: number,
  y0: number, y1: number, mat: Material): void {
  m.box([-ox, y0, -oz], [-ix, y1, oz], mat);
  m.box([ix, y0, -oz], [ox, y1, oz], mat);
  m.box([-ix, y0, -oz], [ix, y1, -iz], mat);
  m.box([-ix, y0, iz], [ix, y1, oz], mat);
}

/** A floodlight mast: lattice column, head frame and a grid of lamps. */
function floodMast(m: MeshBuilder, cx: number, cz: number, y0: number, height: number,
  lamps = 4): void {
  m.painted(TINT.METAL_DARK, () => {
    m.cylinder(cx, cz, 0.65, y0, y0 + height, 8, MAT.TRIM, false);
    // Two spreader arms so the head is carried rather than balanced on a pole.
    m.pipe([cx, y0 + height - 6.0, cz], [cx - 2.6, y0 + height, cz], 0.18, MAT.TRIM, 5);
    m.pipe([cx, y0 + height - 6.0, cz], [cx + 2.6, y0 + height, cz], 0.18, MAT.TRIM, 5);
    m.box([cx - 4.2, y0 + height, cz - 0.9], [cx + 4.2, y0 + height + 0.5, cz + 0.9], MAT.TRIM);
  });
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < lamps; i++) {
      const px = cx - 3.6 + (i / (lamps - 1)) * 7.2;
      m.box([px - 0.62, y0 + height + 0.5 + r * 1.15, cz - 0.5],
            [px + 0.62, y0 + height + 1.5 + r * 1.15, cz + 0.5], MAT.LAMP);
    }
  }
}

/** A big screen on a gantry: frame, face and the truss carrying it. */
function bigScreen(m: MeshBuilder, cx: number, cz: number, y: number, w: number, h: number,
  facing: 1 | -1): void {
  m.painted(TINT.METAL_DARK, () => {
    m.box([cx - w / 2 - 0.5, y - 0.5, cz - 0.7], [cx + w / 2 + 0.5, y + h + 0.5, cz + 0.7], MAT.TRIM);
    for (const s of [-1, 1]) {
      m.pipe([cx + s * w * 0.32, y - 0.5, cz], [cx + s * w * 0.32, y - 6.0, cz - facing * 2.0], 0.3, MAT.TRIM, 6);
    }
  });
  m.painted(TINT.SIGN_LIT, () => {
    m.box([cx - w / 2, y, cz + facing * 0.7], [cx + w / 2, y + h, cz + facing * 0.85], MAT.PLATE);
  });
}

/**
 * A car park: bays, markings, lamp columns and a scatter of vehicles.
 *
 * Half full rather than full. A solid block of cars is a texture; gaps are
 * what makes it read as a car park somebody parks in.
 */
function carPark(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number,
  seed: number, dense = 0.55, cap = 12): void {
  m.box([x0, 0.0005, z0], [x1, 0.06, z1], MAT.GROUND);
  const bayW = 2.6, rowD = 5.4;
  const cols = Math.max(1, Math.floor((x1 - x0) / bayW));
  const rows = Math.max(1, Math.floor((z1 - z0) / rowD));
  m.painted(TINT.NONE, () => {
    for (let r = 0; r <= rows; r++) {
      const z = z0 + r * rowD;
      if (z > z1) break;
      m.box([x0, 0.06, z - 0.06], [x1, 0.08, z + 0.06], MAT.PLATE);
    }
  });
  let n = seed, drawn = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      n = (n * 1103515245 + 12345) & 0x7fffffff;
      const x = x0 + (c + 0.5) * bayW, z = z0 + (r + 0.5) * rowD;
      // Bay lines every bay; a car in a bit over half of them.
      m.box([x - bayW / 2, 0.06, z - rowD / 2 + 0.2], [x - bayW / 2 + 0.1, 0.08, z + rowD / 2 - 0.2], MAT.PLATE);
      // A cap on the real vehicles, not on the bays.
      //
      // A stadium car park is three hundred bays, and a model in every one of
      // them is a hundred thousand triangles of parked car standing next to a
      // twelve thousand triangle stadium. The markings run the whole park --
      // they are two quads a bay -- and the cars fill the front rows nearest
      // the gate, which is where they would be anyway.
      if (drawn < cap && (n >> 8) % 100 < dense * 100) {
        parkedVehicle(m, n >> 4, x, z, r % 2 === 0 ? 1 : 3, 'car');
        drawn++;
      }
    }
  }
  // Lamp columns down the middle of every other aisle.
  m.painted(TINT.METAL_DARK, () => {
    for (let r = 1; r < rows; r += 2) {
      const z = z0 + r * rowD;
      for (let i = 0; i <= 2; i++) {
        const x = x0 + (i / 2) * (x1 - x0);
        m.cylinder(x, z, 0.18, 0.06, 8.0, 6, MAT.TRIM, false);
        m.box([x - 0.9, 8.0, z - 0.35], [x + 0.9, 8.5, z + 0.35], MAT.LAMP);
      }
    }
  });
}

/** A concourse: a colonnade of piers with a glazed line behind and a fascia. */
function concourse(m: MeshBuilder, ox: number, oz: number, depth: number, height: number,
  bays: number): void {
  const px = ox + depth, pz = oz + depth;
  // Both of these are rings. Written as boxes -- which is what they were --
  // the apron buries the pitch and the glazing fills the bowl with a solid
  // block of glass seven metres deep, which is why both stadiums came out with
  // a flat cream rectangle where the grass should be.
  annulus(m, ox - 0.5, oz - 0.5, px, pz, 0.1, 0.35, MAT.CONCRETE);
  // Glazed line, set back behind the piers.
  annulus(m, px - 1.7, pz - 1.7, px - 0.9, pz - 0.9, 0.35, height - 1.2, MAT.GLASS);
  const pier = (cx: number, cz: number, w: number, d: number): void => {
    m.box([cx - w, 0.35, cz - d], [cx + w, height, cz + d], MAT.CONCRETE);
  };
  for (let i = 0; i <= bays; i++) {
    const x = -px + (i / bays) * px * 2;
    pier(x, -pz + 0.45, 0.7, 0.45);
    pier(x, pz - 0.45, 0.7, 0.45);
  }
  const across = Math.max(4, Math.round(bays * (pz / px)));
  for (let i = 0; i <= across; i++) {
    const z = -pz + (i / across) * pz * 2;
    pier(-px + 0.45, z, 0.45, 0.7);
    pier(px - 0.45, z, 0.45, 0.7);
  }
  band(m, -px, -pz, px, pz, height, 1.3, 0.35, MAT.CLADDING);
  parapet(m, -px, -pz, px, pz, height + 1.3, 0.5, 0.2, MAT.TRIM);
}

/** Turnstile pods along one face of the concourse. */
function turnstiles(m: MeshBuilder, x0: number, x1: number, z: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const x = x0 + ((i + 0.5) / count) * (x1 - x0);
    m.painted(TINT.METAL_DARK, () => {
      m.box([x - 1.5, 0.35, z - 0.5], [x - 1.2, 1.35, z + 0.5], MAT.TRIM);
      m.box([x + 1.2, 0.35, z - 0.5], [x + 1.5, 1.35, z + 0.5], MAT.TRIM);
      m.box([x - 1.5, 2.6, z - 0.6], [x + 1.5, 2.9, z + 0.6], MAT.TRIM);
    });
    m.painted(TINT.SIGN_LIT, () => {
      m.box([x - 1.2, 2.9, z - 0.1], [x + 1.2, 3.5, z + 0.1], MAT.PLATE);
    });
  }
}

/** Pitch markings: a painted line loop, plus whatever the code draws inside. */
function markings(m: MeshBuilder, x0: number, z0: number, x1: number, z1: number, y: number): void {
  m.painted(TINT.NONE, () => {
    m.box([x0, y, z0], [x1, y + 0.02, z0 + 0.22], MAT.PLATE);
    m.box([x0, y, z1 - 0.22], [x1, y + 0.02, z1], MAT.PLATE);
    m.box([x0, y, z0], [x0 + 0.22, y + 0.02, z1], MAT.PLATE);
    m.box([x1 - 0.22, y, z0], [x1, y + 0.02, z1], MAT.PLATE);
  });
}

// ==================================================================== venues

/**
 * A gridiron stadium: two tiers, a club ring between them, and a roof.
 *
 * The one venue in the library that is bigger than a city block. The field is
 * a hundred and nine metres including both end zones, which is what sets
 * everything else -- by the time there is a bowl round it, a concourse round
 * that and a car park round that, it is a hundred and sixty metres across.
 */
function gridiron(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const fx = 55.0, fz = 24.5;                    // field, including end zones
  const lox = 70.0, loz = 40.0;                  // back of the lower tier
  const upx = 82.0, upz = 52.0;                  // back of the upper tier
  const lowY = 14.0, clubY = 20.0, upY = 40.0;

  m.box([-104, 0.0005, -84], [104, 0.1, 84], MAT.CONCRETE);

  // The field: turf, the hash-marked middle and two end zones in the brand.
  m.painted(TINT.GREEN, () => m.box([-fx, 0.1, -fz], [fx, 0.2, fz], MAT.TRIM));
  m.painted(TINT.BRAND, () => {
    m.box([-fx, 0.21, -fz], [-fx + 9.1, 0.23, fz], MAT.TRIM);
    m.box([fx - 9.1, 0.21, -fz], [fx, 0.23, fz], MAT.TRIM);
  });
  // Mown bands across the field, the same as the soccer pitch gets. Flat
  // green at this size is a teal sheet with nothing on it to measure.
  m.painted(TINT.GREEN_DARK, () => {
    for (let i = 0; i < 12; i += 2) {
      const x = -fx + (i / 12) * fx * 2;
      m.box([x, 0.2, -fz], [x + (fx * 2) / 12, 0.21, fz], MAT.TRIM);
    }
  });
  markings(m, -fx, -fz, fx, fz, 0.21);
  if (medium) {
    // Yard lines every five yards, which is the read that says gridiron
    // rather than football.
    m.painted(TINT.NONE, () => {
      for (let i = 1; i < 22; i++) {
        const x = -fx + 9.1 + (i / 22) * (fx - 9.1) * 2;
        m.box([x - 0.11, 0.21, -fz + 0.3], [x + 0.11, 0.23, fz - 0.3], MAT.PLATE);
      }
    });
    // Goalposts.
    m.painted(TINT.ACCENT, () => {
      for (const s of [1, -1]) {
        m.cylinder(s * (fx - 0.6), 0, 0.16, 0.2, 3.0, 6, MAT.PAINT, false);
        m.box([s * (fx - 0.7), 3.0, -2.8], [s * (fx - 0.5), 3.2, 2.8], MAT.PAINT);
        for (const t of [1, -1]) m.cylinder(s * (fx - 0.6), t * 2.8, 0.14, 3.2, 9.4, 6, MAT.PAINT, false);
      }
    });
  }

  tier(m, { ix: fx + 2.5, iz: fz + 2.5, ox: lox, oz: loz, y0: 1.6, y1: lowY, steps: 11, bandEvery: 3 });
  // The club ring: a band of hospitality boxes carried over the lower tier,
  // which is the horizontal line that stops the bowl reading as one long ramp.
  annulus(m, lox - 7.0, loz - 7.0, lox + 1.5, loz + 1.5, lowY, clubY, MAT.CLADDING);
  ring(m, -lox - 1.6, -loz - 1.6, lox + 1.6, loz + 1.6, lowY + 1.6, 3.2, 0.2, MAT.GLASS);
  tier(m, { ix: lox - 1.0, iz: loz - 1.0, ox: upx, oz: upz, y0: clubY + 1.0, y1: upY, steps: 12, bandEvery: 4 });

  if (medium) {
    vomitories(m, upx, upz, clubY + 2.0, upY - 1.0, 9, 6);
    // The roof: a ring over the back of the upper tier, on raking props that
    // land on the outer wall. A roof with nothing holding it up is the single
    // thing that makes a large model read as a toy.
    // The roof, as a ring over the seating with the field open to the sky.
    // Over the back half of the upper tier only. Roofed to the touchline it
    // is a lid with a hole in it: the bowl disappears, and the bowl is the
    // thing worth looking at.
    annulus(m, upx - 8.0, upz - 8.0, upx + 3.0, upz + 3.0, upY + 3.0, upY + 4.4, MAT.METAL);
    // A translucent strip inboard of it, so the roof has a leading edge rather
    // than stopping dead.
    annulus(m, upx - 13.0, upz - 13.0, upx - 8.0, upz - 8.0, upY + 3.2, upY + 4.2, MAT.GLASS);
    ring(m, -upx - 3.0, -upz - 3.0, upx + 3.0, upz + 3.0, upY + 4.4, 1.6, 0.5, MAT.TRIM);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 12; i++) {
        const x = -upx + (i / 11) * upx * 2;
        for (const s of [1, -1]) {
          m.pipe([x, upY - 2.0, s * (upz + 0.5)], [x, upY + 3.0, s * (upz + 3.0)], 0.28, MAT.TRIM, 5);
        }
      }
      for (let i = 0; i < 8; i++) {
        const z = -upz + (i / 7) * upz * 2;
        for (const s of [1, -1]) {
          m.pipe([s * (upx + 0.5), upY - 2.0, z], [s * (upx + 3.0), upY + 3.0, z], 0.28, MAT.TRIM, 5);
        }
      }
    });
    bigScreen(m, 0, -upz + 3.0, upY + 6.0, 34.0, 14.0, 1);
    bigScreen(m, 0, upz - 3.0, upY + 6.0, 34.0, 14.0, -1);
  }

  if (fine) {
    concourse(m, upx, upz, 5.0, 9.0, 18);
    turnstiles(m, -30, 30, upz + 5.0, 8);
    turnstiles(m, -30, 30, -upz - 5.0, 8);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      floodMast(m, sx * (upx + 2.0), sz * (upz + 2.0), 0.35, 52.0, 5);
      // Spiral ramp towers on the corners, which is how a two-tier bowl
      // actually gets its upper deck filled.
      m.box([sx * (upx + 1.0) - sx * 7.0, 0.35, sz * (upz + 1.0) - sz * 7.0],
            [sx * (upx + 1.0) + sx * 1.5, upY, sz * (upz + 1.0) + sz * 1.5], MAT.CONCRETE);
      m.painted(TINT.METAL_DARK, () => {
        for (let f = 1; f < 5; f++) {
          const y = f * (upY / 5);
          m.box([Math.min(sx * (upx + 2.6), sx * (upx - 6.0)), y, Math.min(sz * (upz + 2.6), sz * (upz - 6.0))],
                [Math.max(sx * (upx + 2.6), sx * (upx - 6.0)), y + 0.35, Math.max(sz * (upz + 2.6), sz * (upz - 6.0))], MAT.TRIM);
        }
      });
    }
    carPark(m, -102, -82, -90, 82, 11);
    carPark(m, 90, -82, 102, 82, 29);
    carPark(m, -84, 62, 84, 82, 47, 0.45);
    kerb(m, -88, -78, 88, 78);
    for (let i = 0; i < 10; i++) {
      figure(m, 900 + i * 7, -34 + i * 7.6, upz + 8.6, Math.PI, { stride: 0.2 });
    }
  }
  return m;
}

/**
 * A soccer stadium: a continuous bowl under one roof, the European shape.
 *
 * Where the gridiron stadium is two tiers with a gap, this is one sweep from
 * the touchline to the back, roofed right round and glazed at the back of the
 * top rows. It is a smaller pitch and a bigger roof.
 */
function soccer(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const fx = 52.5, fz = 34.0;                   // 105 x 68, the regulation pitch
  const ox = 74.0, oz = 55.0;
  const rim = 34.0;

  m.box([-96, 0.0005, -78], [96, 0.1, 78], MAT.CONCRETE);
  m.painted(TINT.GREEN, () => m.box([-fx, 0.1, -fz], [fx, 0.2, fz], MAT.TRIM));
  if (medium) {
    // Mown stripes, which is most of what says football pitch from above.
    m.painted(TINT.GREEN_DARK, () => {
      for (let i = 0; i < 8; i += 2) {
        const x = -fx + (i / 8) * fx * 2;
        m.box([x, 0.2, -fz], [x + (fx * 2) / 8, 0.21, fz], MAT.TRIM);
      }
    });
    markings(m, -fx, -fz, fx, fz, 0.21);
    m.painted(TINT.NONE, () => {
      m.box([-0.11, 0.21, -fz], [0.11, 0.23, fz], MAT.PLATE);
      for (const s of [1, -1]) {
        // Penalty area.
        m.box([s * fx - s * 16.5, 0.21, -20.2], [s * fx - s * 16.3, 0.23, 20.2], MAT.PLATE);
        m.box([s * fx - s * 16.5, 0.21, -20.2], [s * fx, 0.23, -20.0], MAT.PLATE);
        m.box([s * fx - s * 16.5, 0.21, 20.0], [s * fx, 0.23, 20.2], MAT.PLATE);
      }
    });
    // Goals.
    for (const s of [1, -1]) {
      m.box([s * fx, 0.2, -3.66], [s * fx + s * 0.12, 2.44, -3.54], MAT.TRIM);
      m.box([s * fx, 0.2, 3.54], [s * fx + s * 0.12, 2.44, 3.66], MAT.TRIM);
      m.box([s * fx, 2.32, -3.66], [s * fx + s * 0.12, 2.44, 3.66], MAT.TRIM);
    }
  }

  tier(m, { ix: fx + 4.0, iz: fz + 4.0, ox, oz, y0: 1.8, y1: rim, steps: 18, bandEvery: 4 });
  if (medium) {
    vomitories(m, ox, oz, 6.0, rim - 1.0, 10, 8);
    // The roof, in two rings: an opaque outer and a translucent inner strip,
    // which is what a modern stand does so the grass still gets light.
    annulus(m, ox - 9.0, oz - 9.0, ox + 5.0, oz + 5.0, rim + 4.0, rim + 5.6, MAT.METAL);
    annulus(m, ox - 15.0, oz - 15.0, ox - 9.0, oz - 9.0, rim + 4.2, rim + 5.4, MAT.GLASS);
    ring(m, -ox - 5.0, -oz - 5.0, ox + 5.0, oz + 5.0, rim + 5.6, 1.8, 0.6, MAT.TRIM);
    // Trusses: one every twelve metres, landing on the back of the bowl.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 14; i++) {
        const x = -ox + (i / 13) * ox * 2;
        for (const s of [1, -1]) {
          m.pipe([x, rim - 3.0, s * (oz + 1.0)], [x, rim + 4.0, s * (oz + 5.0)], 0.3, MAT.TRIM, 5);
          m.pipe([x, rim + 4.0, s * (oz + 5.0)], [x, rim + 4.0, s * (fx > 0 ? oz - 13.0 : 0)], 0.22, MAT.TRIM, 5);
        }
      }
      for (let i = 0; i < 10; i++) {
        const z = -oz + (i / 9) * oz * 2;
        for (const s of [1, -1]) {
          m.pipe([s * (ox + 1.0), rim - 3.0, z], [s * (ox + 5.0), rim + 4.0, z], 0.3, MAT.TRIM, 5);
        }
      }
    });
    // Glazed back wall behind the top rows, and the fascia over it.
    ring(m, -ox, -oz, ox, oz, rim - 4.0, 4.0, 0.9, MAT.GLASS);
    m.painted(TINT.BRAND, () => {
      ring(m, -ox, -oz, ox, oz, rim, 2.6, 1.1, MAT.CLADDING);
    });
    bigScreen(m, -ox + 16.0, -oz + 12.0, rim + 7.0, 22.0, 10.0, 1);
    bigScreen(m, ox - 16.0, oz - 12.0, rim + 7.0, 22.0, 10.0, -1);
  }

  if (fine) {
    concourse(m, ox, oz, 4.5, 8.0, 16);
    turnstiles(m, -26, 26, oz + 4.5, 7);
    turnstiles(m, -26, 26, -oz - 4.5, 7);
    // Dugouts, which nothing else in the library has and which sell the scale:
    // they are the one thing on the pitch that is person-sized.
    for (const s of [1, -1]) {
      m.painted(TINT.METAL_DARK, () => {
        m.box([-7.0, 0.2, s * (fz + 1.2)], [7.0, 2.3, s * (fz + 3.0)], MAT.TRIM, { roof: MAT.TRIM });
      });
      m.box([-6.4, 0.9, s * (fz + 1.1)], [6.4, 2.1, s * (fz + 1.3)], MAT.GLASS);
    }
    carPark(m, -94, -74, -82, 74, 13);
    carPark(m, 82, -74, 94, 74, 31);
    kerb(m, -80, -70, 80, 70);
    railing(m, -26, 26, oz + 9.4, 0.35, 1.1, 2.0);
    for (let i = 0; i < 10; i++) figure(m, 500 + i * 11, -30 + i * 6.8, oz + 7.6, Math.PI, { stride: 0.18 });
  }
  return m;
}

/**
 * An indoor arena: the hockey rink, and the shed it lives in.
 *
 * The opposite problem from the two above. A stadium is a bowl and you see the
 * bowl; an arena is a closed box and everything interesting about it is the
 * outside -- a glazed drum on the corner where the concourse is, a deep fascia
 * carrying the name, a service yard where the trucks back in, and a roof that
 * is entirely plant.
 */
function arena(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const ax = 52.0, az = 42.0;                   // the shell
  const eaves = 24.0;

  m.box([-72, 0.0005, -60], [72, 0.1, 60], MAT.CONCRETE);
  // The shell: a lower podium in stone, the bowl above it in cladding, and a
  // deep fascia at the top. Three bands, so a hundred metres of wall is not
  // one hundred-metre wall.
  m.box([-ax, 0.1, -az], [ax, 6.5, az], MAT.STONE);
  m.box([-ax + 1.2, 6.5, -az + 1.2], [ax - 1.2, eaves, az - 1.2], MAT.CLADDING, { roof: MAT.ROOF });
  band(m, -ax + 1.2, -az + 1.2, ax - 1.2, az - 1.2, eaves, 3.4, 0.8, MAT.METAL);
  m.painted(TINT.BRAND, () => {
    band(m, -ax + 1.2, -az + 1.2, ax - 1.2, az - 1.2, eaves + 3.4, 1.1, 1.0, MAT.CLADDING);
  });
  // Roof: a shallow vault, because a flat lid over ninety metres reads as a
  // warehouse and this is meant to read as a hall.
  for (let i = 0; i < 9; i++) {
    const t0 = i / 9, t1 = (i + 1) / 9;
    const c0 = Math.sin(t0 * Math.PI), c1 = Math.sin(t1 * Math.PI);
    const z0 = -az + 1.2 + t0 * (az - 1.2) * 2, z1 = -az + 1.2 + t1 * (az - 1.2) * 2;
    m.box([-ax + 1.2, eaves + 4.5 + Math.min(c0, c1) * 5.5, z0],
          [ax - 1.2, eaves + 4.5 + Math.max(c0, c1) * 5.5, z1], MAT.ROOF);
  }

  if (medium) {
    // The glazed corner drum: the entrance, and the one soft shape on the box.
    m.cylinder(-ax + 6.0, -az + 6.0, 15.0, 0.1, eaves + 2.0, 20, MAT.GLASS, false);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        m.pipe([-ax + 6.0 + Math.cos(a) * 15.1, 0.1, -az + 6.0 + Math.sin(a) * 15.1],
               [-ax + 6.0 + Math.cos(a) * 15.1, eaves + 2.0, -az + 6.0 + Math.sin(a) * 15.1], 0.16, MAT.TRIM, 4);
      }
      m.cylinder(-ax + 6.0, -az + 6.0, 15.8, eaves + 2.0, eaves + 3.0, 20, MAT.TRIM);
    });
    // Window bands round the rest, so the wall has floors in it.
    for (const y of [8.5, 14.0]) {
      ring(m, -ax + 1.2, -az + 1.2, ax - 1.2, az - 1.2, y, 2.4, 0.1, MAT.GLASS);
    }
    // The name, big, on the long elevation.
    m.painted(TINT.SIGN_LIT, () => {
      m.box([-22.0, eaves + 0.6, az - 2.2], [22.0, eaves + 3.0, az - 1.9], MAT.PLATE);
      m.box([-22.0, eaves + 0.6, -az + 1.9], [22.0, eaves + 3.0, -az + 2.2], MAT.PLATE);
    });
    roofClutter(m, -ax + 8, -az + 8, ax - 8, az - 8, eaves + 9.5, 71, 1.4);
  }

  if (fine) {
    // The service yard: two dock levellers and a truck backed onto one, which
    // is what the back of every arena in the world looks like.
    m.box([ax, 0.1, -18.0], [ax + 16.0, 0.16, 18.0], MAT.GROUND);
    m.painted(TINT.METAL_DARK, () => {
      for (const z of [-9.0, 0.0, 9.0]) {
        m.box([ax - 0.4, 1.2, z - 2.2], [ax + 0.3, 5.0, z + 2.2], MAT.TRIM);
        m.box([ax - 0.5, 5.0, z - 2.6], [ax + 2.4, 5.6, z + 2.6], MAT.TRIM);
      }
    });
    parkedVehicle(m, 91, ax + 9.0, 9.0, 2, 'truck');
    parkedVehicle(m, 57, ax + 9.0, -9.0, 2, 'van');
    // Plaza, box office and a queue rail outside the drum.
    m.box([-ax - 14.0, 0.1, -az - 14.0], [-ax + 22.0, 0.2, -az + 6.0], MAT.CONCRETE);
    m.box([-ax + 24.0, 0.2, -az - 7.0], [-ax + 36.0, 4.2, -az - 1.0], MAT.CONCRETE, { roof: MAT.ROOF });
    m.box([-ax + 25.0, 1.1, -az - 7.2], [-ax + 35.0, 2.6, -az - 6.9], MAT.SHOPFRONT);
    railing(m, -ax - 10.0, -ax + 18.0, -az - 10.0, 0.2, 1.0, 2.2);
    carPark(m, -68, 24, 68, 56, 17);
    carPark(m, -68, -56, -34, -24, 37);
    kerb(m, -66, -58, 66, 58);
    for (let i = 0; i < 12; i++) {
      figure(m, 700 + i * 13, -ax - 6.0 + i * 4.4, -az - 11.0, 0, { stride: 0.22 });
    }
  }
  return m;
}

// ================================================================= terminals

/**
 * An airport terminal: a pier, an apron and two stands.
 *
 * There are aircraft in the library now and nowhere to put one. What makes
 * this read as an airport rather than as a long shed is the apron marking and
 * the jet bridges: a terminal is a building people walk out of onto concrete,
 * and the bridge is the bit that says so.
 */
function airTerminal(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const tx = 62.0, tz = 13.0;

  m.box([-84, 0.0005, -60], [84, 0.1, 60], MAT.CONCRETE);
  // Apron: a darker slab with stand markings and a centreline lead-in.
  m.box([-80, 0.1, 6.0], [80, 0.16, 58.0], MAT.GROUND);
  m.painted(TINT.NONE, () => {
    for (const cx of [-38.0, 38.0]) {
      m.box([cx - 0.2, 0.16, 8.0], [cx + 0.2, 0.18, 52.0], MAT.PLATE);
      m.box([cx - 14.0, 0.16, 30.0], [cx + 14.0, 0.18, 30.4], MAT.PLATE);
    }
  });

  // The terminal: a glazed pier under a shallow curved roof on splayed columns.
  m.box([-tx, 0.1, -tz], [tx, 4.2, tz], MAT.CONCRETE);
  m.box([-tx + 0.8, 4.2, -tz + 0.8], [tx - 0.8, 15.0, tz - 0.8], MAT.GLASS);
  for (let i = 0; i < 7; i++) {
    const t0 = i / 7, t1 = (i + 1) / 7;
    const c0 = Math.sin(t0 * Math.PI), c1 = Math.sin(t1 * Math.PI);
    const z0 = -tz - 2.5 + t0 * (tz + 2.5) * 2, z1 = -tz - 2.5 + t1 * (tz + 2.5) * 2;
    m.box([-tx - 2.5, 15.0 + Math.min(c0, c1) * 4.0, z0],
          [tx + 2.5, 15.6 + Math.max(c0, c1) * 4.0, z1], MAT.METAL);
  }
  m.painted(TINT.METAL_DARK, () => {
    for (let i = 0; i <= 16; i++) {
      const x = -tx + (i / 16) * tx * 2;
      for (const s of [1, -1]) {
        m.pipe([x, 4.2, s * (tz - 1.0)], [x, 15.2, s * (tz + 2.4)], 0.28, MAT.TRIM, 6);
      }
    }
  });

  if (medium) {
    // Jet bridges: a raised tube on a rotunda, reaching out to each stand.
    for (const cx of [-38.0, 38.0]) {
      m.painted(TINT.METAL_DARK, () => {
        m.cylinder(cx, tz + 2.0, 2.2, 0.16, 6.0, 10, MAT.TRIM);
        m.box([cx - 1.9, 6.0, tz + 2.0], [cx + 1.9, 9.4, tz + 20.0], MAT.CLADDING, { roof: MAT.ROOF });
        m.box([cx - 2.2, 9.4, tz + 18.0], [cx + 2.2, 10.2, tz + 22.0], MAT.TRIM);
        m.cylinder(cx, tz + 12.0, 0.5, 0.16, 6.0, 6, MAT.TRIM, false);
        m.cylinder(cx, tz + 19.0, 0.5, 0.16, 6.0, 6, MAT.TRIM, false);
      });
      m.box([cx - 1.7, 6.9, tz + 2.0], [cx + 1.7, 8.6, tz + 19.8], MAT.GLASS);
    }
    // Landside: a canopy over the drop-off, on the other face.
    m.box([-tx + 6.0, 6.2, -tz - 14.0], [tx - 6.0, 7.0, -tz], MAT.METAL);
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 8; i++) {
        const x = -tx + 8.0 + (i / 8) * (tx - 8.0) * 2;
        m.cylinder(x, -tz - 12.0, 0.32, 0.1, 6.2, 8, MAT.TRIM, false);
      }
    });
    m.painted(TINT.SIGN_LIT, () => {
      m.box([-18.0, 15.8, -tz - 0.9], [18.0, 18.4, -tz - 0.6], MAT.PLATE);
    });
    // Control tower on the end, because an airport without one is a bus
    // station with a big forecourt.
    m.cylinder(tx + 14.0, -20.0, 4.0, 0.1, 30.0, 12, MAT.CONCRETE, false);
    m.cone(tx + 14.0, -20.0, 6.4, 5.2, 30.0, 34.5, 12, MAT.GLASS);
    m.painted(TINT.METAL_DARK, () => {
      m.cone(tx + 14.0, -20.0, 7.0, 7.6, 34.5, 36.0, 12, MAT.TRIM);
      m.cylinder(tx + 14.0, -20.0, 0.2, 36.0, 41.0, 6, MAT.TRIM, false);
    });
  }

  if (fine) {
    parapet(m, -tx, -tz, tx, tz, 4.2, 0.5, 0.3, MAT.TRIM);
    // An aircraft on the near stand. The terminal exists because the library
    // grew aircraft and had nowhere to put one, so it would be perverse to
    // draw the stand and leave it empty. The clustered copy: this is scenery
    // beside a building, not the hero model in the fleet viewer.
    const plane = IMPORTED_IDS.find((id) => id.startsWith('air.widebody'))
      ?? IMPORTED_IDS.find((id) => id.startsWith('air.'));
    if (plane) drawImported(m, plane, { cx: -38.0, cz: 40.0, turns: 1, low: true });
    // Ground fleet on the apron and a rank of vans landside.
    for (let i = 0; i < 6; i++) parkedVehicle(m, 400 + i * 9, -60 + i * 24, 50.0, 1, i % 3 === 0 ? 'truck' : 'van');
    carPark(m, -78, -56, 78, -30, 23);
    kerb(m, -tx - 16, -tz - 16, tx + 16, tz + 2);
    for (let i = 0; i < 12; i++) {
      figure(m, 300 + i * 17, -50 + i * 9.0, -tz - 6.0, 0, { stride: 0.2, bag: true });
    }
  }
  return m;
}

/**
 * A container terminal: quay, gantry cranes and a stacking yard.
 *
 * The other half of the boats. Two ship-to-shore gantries straddling the
 * quayside, a yard of boxes behind them, and a reefer rack -- and the cranes
 * are what makes it: fifty metres of portal frame with a boom out over the
 * water is a silhouette nothing else in the library has.
 */
function containerTerminal(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;

  // Water on the seaward side, quay apron on the landward.
  m.box([-72, 0.0005, -56], [72, 0.06, -18.0], MAT.WATER);
  m.box([-72, 0.0005, -18.0], [72, 1.8, 56], MAT.CONCRETE);
  // Quay edge: a coping beam with fenders and bollards hung off it.
  m.painted(TINT.METAL_DARK, () => {
    m.box([-72, 1.4, -18.6], [72, 1.9, -17.6], MAT.TRIM);
    for (let i = 0; i < 15; i++) {
      const x = -68 + i * 9.7;
      m.cylinder(x, -18.0, 0.55, 1.9, 2.9, 8, MAT.TRIM);
      m.box([x - 1.1, 0.2, -19.0], [x + 1.1, 1.4, -18.4], MAT.TYRE);
    }
  });

  /** One ship-to-shore gantry: portal legs, a sill beam, a boom and a trolley. */
  const gantry = (cx: number): void => {
    const H = 44.0, legZ = [-14.0, 10.0];
    m.painted(TINT.ACCENT, () => {
      for (const sx of [-1, 1]) {
        for (const z of legZ) {
          m.box([cx + sx * 11.0 - 1.1, 1.8, z - 1.1], [cx + sx * 11.0 + 1.1, H, z + 1.1], MAT.PAINT);
        }
        // Sill and portal beams, so the legs are a frame and not four posts.
        m.box([cx + sx * 11.0 - 1.3, 16.0, legZ[0]], [cx + sx * 11.0 + 1.3, 17.6, legZ[1]], MAT.PAINT);
      }
      for (const z of legZ) {
        m.box([cx - 12.3, H, z - 1.4], [cx + 12.3, H + 2.6, z + 1.4], MAT.PAINT);
      }
      // The boom: out over the water, and the backreach behind.
      m.box([cx - 3.2, H + 2.6, -52.0], [cx + 3.2, H + 5.4, 26.0], MAT.PAINT);
      // Machinery house and the A-frame carrying the boom stays.
      m.box([cx - 5.0, H + 5.4, 6.0], [cx + 5.0, H + 11.0, 18.0], MAT.CLADDING, { roof: MAT.ROOF });
    });
    m.painted(TINT.METAL_DARK, () => {
      m.pipe([cx, H + 11.0, 12.0], [cx, H + 5.4, -50.0], 0.22, MAT.TRIM, 5);
      m.pipe([cx, H + 11.0, 12.0], [cx, H + 5.4, 24.0], 0.22, MAT.TRIM, 5);
      // Trolley and spreader, hanging where a box would be.
      m.box([cx - 2.6, H + 0.8, -30.0], [cx + 2.6, H + 2.6, -25.0], MAT.TRIM);
      for (const sx of [-1, 1]) m.pipe([cx + sx * 2.0, H + 0.8, -27.5], [cx + sx * 2.0, 14.0, -27.5], 0.1, MAT.TRIM, 4);
      m.box([cx - 1.4, 12.4, -33.6], [cx + 1.4, 14.0, -21.4], MAT.TRIM);
    });
    // Legs land on rails.
    m.painted(TINT.METAL_DARK, () => {
      for (const z of legZ) m.box([-72, 1.8, z - 0.3], [72, 2.0, z + 0.3], MAT.TRIM);
    });
  };

  gantry(-30.0);
  gantry(26.0);

  if (medium) {
    // The stacking yard: rows of boxes four high, in lanes with a road
    // between them. Plain boxes -- the castings are not readable from the
    // quayside and there are a hundred and fifty of them here.
    let key = 800;
    for (let lane = 0; lane < 3; lane++) {
      const z = 22.0 + lane * 11.0;
      for (let i = 0; i < 9; i++) {
        const x = -62.0 + i * 13.4;
        const tall = 4 - ((i + lane) % 3);
        for (let t = 0; t < tall; t++) {
          m.keyed(key++, () => {
            m.box([x - 6.1, 1.8 + t * 2.62, z - 1.22], [x + 6.1, 4.39 + t * 2.62, z + 1.22],
                  MAT.CONTAINER, { roof: MAT.CONTAINER });
          });
          m.painted(TINT.METAL_DARK, () => {
            m.box([x - 6.1, 4.23 + t * 2.62, z - 1.25], [x + 6.1, 4.39 + t * 2.62, z + 1.25], MAT.TRIM);
          });
        }
      }
    }
  }

  if (fine) {
    // Lighting masts down the yard, a gatehouse, and the office block.
    m.painted(TINT.METAL_DARK, () => {
      for (const x of [-52.0, 0.0, 52.0]) {
        m.cylinder(x, 52.0, 0.7, 1.8, 34.0, 8, MAT.TRIM, false);
        m.box([x - 3.4, 34.0, 51.4], [x + 3.4, 35.4, 52.6], MAT.TRIM);
        for (let i = 0; i < 4; i++) {
          m.box([x - 3.0 + i * 1.7, 35.4, 51.6], [x - 2.0 + i * 1.7, 36.4, 52.4], MAT.LAMP);
        }
      }
    });
    m.box([54.0, 1.8, -14.0], [70.0, 16.0, 6.0], MAT.CLADDING, { roof: MAT.ROOF });
    for (const y of [5.0, 9.0, 13.0]) {
      m.box([53.9, y, -13.0], [70.1, y + 2.0, 5.0], MAT.GLASS);
    }
    parapet(m, 54.0, -14.0, 70.0, 6.0, 16.0, 0.7, 0.25, MAT.TRIM);
    m.painted(TINT.SIGN_LIT, () => m.box([55.0, 16.7, -14.3], [69.0, 19.0, -14.0], MAT.PLATE));
    for (let i = 0; i < 5; i++) parkedVehicle(m, 600 + i * 13, -50 + i * 20, 12.0, 1, 'truck');
    railing(m, -70, 70, -17.0, 1.8, 1.1, 3.0);
    for (let i = 0; i < 6; i++) figure(m, 810 + i * 19, -40 + i * 16, 8.0, 0, { stride: 0.16, hat: true });
  }
  return m;
}

// ===================================================================== table

const venue = (jobs: number, upkeep: number, power: number, water: number): AssetDef['sim'] => ({
  jobs, powerKW: power, waterM3: water, garbagePerWeek: jobs * 9, pollution: 0, upkeep,
});

export const SPORT: AssetDef[] = [
  {
    id: 'svc.parks.gridiron', name: 'Football stadium', zone: 'service', branch: 'parks',
    density: 'none', variant: 'sculpted', footprint: [26, 21], height: 55.9,
    brand: { name: 'Gridiron', colour: [0.20, 0.28, 0.52], accent: [0.72, 0.56, 0.16], sign: 'box' },
    sim: venue(220, 3400, 1900, 900),
    note: 'Hundred-and-nine-metre field with yard lines and goalposts, two tiers with a glazed hospitality ring between them, roof on raking props, corner ramp towers, four masts, end screens and three car parks.',
    build: gridiron,
  },
  {
    id: 'svc.parks.soccer', name: 'Soccer stadium', zone: 'service', branch: 'parks',
    density: 'none', variant: 'sculpted', footprint: [24, 20], height: 45.0,
    brand: { name: 'City FC', colour: [0.16, 0.34, 0.58], accent: [0.78, 0.72, 0.20], sign: 'box' },
    sim: venue(180, 2900, 1600, 820),
    note: 'Regulation 105 by 68 pitch, mown stripes and goals, one continuous eighteen-row bowl, roof in an opaque outer ring and a translucent inner one on trusses, glazed back wall, dugouts and two screens.',
    build: soccer,
  },
  {
    id: 'svc.parks.arena', name: 'Ice arena', zone: 'service', branch: 'parks',
    density: 'none', variant: 'sculpted', footprint: [19, 16], height: 39.0,
    brand: { name: 'Arena', colour: [0.24, 0.30, 0.42], accent: [0.66, 0.24, 0.26], sign: 'box' },
    sim: venue(140, 2400, 1750, 700),
    note: 'Stone podium under a clad bowl and a deep branded fascia, glazed entrance drum on the corner, vaulted roof of plant, three dock levellers with a truck backed on, plaza, box office and parking.',
    build: arena,
  },
  {
    id: 'svc.transport.airport', name: 'Airport terminal', zone: 'service', branch: 'transport',
    density: 'none', variant: 'sculpted', footprint: [22, 19], height: 41.0,
    brand: { name: 'Airport', colour: [0.22, 0.34, 0.48], accent: [0.74, 0.60, 0.22], sign: 'box' },
    sim: venue(260, 3100, 2100, 1100),
    note: 'Glazed pier under a curved roof on splayed columns, two jet bridges out to marked stands, landside drop-off canopy, and a thirty-six-metre control tower on the end.',
    build: airTerminal,
  },
  {
    id: 'svc.transport.docks', name: 'Container terminal', zone: 'service', branch: 'transport',
    density: 'none', variant: 'sculpted', footprint: [19, 15], height: 55.4,
    brand: { name: 'Port', colour: [0.20, 0.36, 0.40], accent: [0.80, 0.44, 0.10], sign: 'box' },
    sim: venue(200, 2800, 1400, 400),
    note: 'Two ship-to-shore gantries on rails with booms out over the water and a spreader down on the hatch, quay coping with fenders and bollards, three lanes of stacked boxes, lighting masts and an office block.',
    build: containerTerminal,
  },
];
