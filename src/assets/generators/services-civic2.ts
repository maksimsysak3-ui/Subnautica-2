/**
 * Death care and the post.
 *
 * Two branches every city has and neither of which usually gets modelled. A
 * crematorium and a funeral director are the kind of building a player will
 * place once and then look at for the rest of the game, so they get a real
 * silhouette rather than another shed; the postal side is the opposite -- a
 * counter on a high street, a delivery office behind it, and a sorting centre
 * out by the ring road.
 */

import { MAT, TINT, MeshBuilder } from '../mesh';
import type { AssetDef } from '../types';
import { parkedVehicle, figure } from './vehicles';

import {
  band, bollards, boxSign, entrance, frontage, kerb, louvres, parapet,
  planter, railing, ribbon, ring, roofClutter, serviceYard, windowGrid,
} from '../parts';

/** A colonnade of square columns carrying a beam: a portico without a pediment. */
function colonnade(m: MeshBuilder, x0: number, x1: number, z: number, depth: number,
  h: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const cx = x0 + ((i + 0.5) / count) * (x1 - x0);
    m.box([cx - 0.3, 0, z + depth - 0.6], [cx + 0.3, h, z + depth], MAT.STONE);
    m.box([cx - 0.38, h - 0.22, z + depth - 0.68], [cx + 0.38, h, z + depth + 0.08], MAT.STONE);
  }
  m.box([x0 - 0.3, h, z - 0.1], [x1 + 0.3, h + 0.55, z + depth + 0.1], MAT.STONE);
  m.box([x0 - 0.45, h + 0.55, z - 0.25], [x1 + 0.45, h + 0.75, z + depth + 0.25], MAT.TRIM);
}

/** A crematorium: a chapel, a flue, a cloister and a garden of remembrance. */
function crematorium(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 22.0, d = 15.0, h = 8.4;
  const x = w / 2, z = d / 2;

  // The chapel. It was a box with a flat lid and a monopitch quad floating
  // over it -- so from above you saw the lid, and the roof clutter pass put
  // plant inside the roof void. It is a real gabled hall now, with a glazed
  // lantern on the ridge, which is what actually lights a chapel.
  m.box([-x, 0, -z], [x, h, z], MAT.STONE);
  m.box([-x - 0.5, 0, -z - 0.5], [x + 0.5, 1.0, z + 0.5], MAT.STONE);
  m.gable([-x - 0.5, h, -z - 0.5], [x + 0.5, h, z + 0.5], 3.4, 'x', MAT.ROOF, MAT.STONE);
  const ridge = h + 3.4;
  // The lantern: a clerestory box standing on the ridge with its own little
  // roof, glazed on all four sides.
  m.box([-5.0, ridge - 1.2, -2.2], [5.0, ridge + 1.4, 2.2], MAT.STONE);
  m.gable([-5.3, ridge + 1.4, -2.5], [5.3, ridge + 1.4, 2.5], 1.0, 'x', MAT.ROOF, MAT.STONE);

  // The flue: the one part of a crematorium anyone can identify from a street.
  m.box([x + 1.4, 0, -z + 2.0], [x + 4.0, 17.0, -z + 4.6], MAT.CONCRETE);
  m.box([x + 1.2, 17.0, -z + 1.8], [x + 4.2, 17.5, -z + 4.8], MAT.STONE);
  m.painted(TINT.METAL_DARK, () =>
    m.cylinder(x + 2.7, -z + 3.3, 0.44, 17.5, 19.4, 10, MAT.TRIM, false));

  if (medium) {
    band(m, -x, -z, x, z, 6.6, 0.3, 0.16, MAT.TRIM);
    // Stone banding up the flue, so it reads as built rather than extruded.
    for (const y of [5.0, 9.0, 13.0]) {
      m.box([x + 1.2, y, -z + 1.8], [x + 4.2, y + 0.4, -z + 4.8], MAT.STONE);
    }
    // Buttresses down the flanks, between the windows.
    for (const [sx, plane] of [[1, x], [-1, -x]] as const) {
      for (let i = 0; i < 4; i++) {
        const u = -z + 3.0 + i * ((d - 6.0) / 3);
        m.box([sx > 0 ? plane : plane - 0.7, 0, u - 0.5],
              [sx > 0 ? plane + 0.7 : plane, h - 0.6, u + 0.5], MAT.STONE);
      }
    }
    // Cloister down the front, opening onto the garden.
    colonnade(m, -x + 1.0, x - 1.0, z + 0.2, 2.6, 3.4, 7);
    // Garden of remembrance: lawn, a path and low walls for plaques.
    m.painted(TINT.GREEN, () => m.box([-x, 0.001, z + 3.2], [x, 0.07, z + 11.0], MAT.TRIM));
    m.box([-1.4, 0.02, z + 3.2], [1.4, 0.09, z + 11.0], MAT.GROUND);
    for (const sx of [1, -1] as const) {
      m.box([sx * 3.0, 0.05, z + 4.4], [sx * (x - 1.4), 0.95, z + 4.9], MAT.STONE);
      m.box([sx * 3.0, 0.95, z + 4.3], [sx * (x - 1.4), 1.06, z + 5.0], MAT.TRIM);
    }
    // A columbarium wall closing the far end of the garden, with its niches.
    m.box([-x, 0, z + 11.0], [x, 3.0, z + 11.9], MAT.STONE);
    m.box([-x - 0.3, 3.0, z + 10.7], [x + 0.3, 3.4, z + 12.2], MAT.TRIM);
  }
  if (fine) {
    // Tall narrow lights down the flanks: a chapel is lit high and thin.
    for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
      for (let i = 0; i < 3; i++) {
        const u = -z + 4.5 + i * ((d - 9.0) / 2);
        m.opening({ axis: 'x', sign, plane, u0: u - 0.36, u1: u + 0.36, y0: 2.6, y1: 7.4,
          glass: MAT.GLASS, frame: 0.14, proud: 0.08 });
      }
      // The lantern's glazing, which is what makes it read as a lantern.
      for (let i = 0; i < 3; i++) {
        const u = -1.4 + i * 1.4;
        m.opening({ axis: 'x', sign: sign as 1 | -1, plane: sign > 0 ? 5.0 : -5.0,
          u0: u - 0.5, u1: u + 0.5, y0: ridge - 0.9, y1: ridge + 1.1,
          glass: MAT.GLASS, frame: 0.1, proud: 0.06 });
      }
    }
    // A porte-cochere over the door: a mourners' car stops under it.
    m.box([-5.4, 4.0, z + 0.2], [5.4, 4.6, z + 6.4], MAT.STONE);
    ring(m, -5.4, z + 0.2, 5.4, z + 6.4, 4.6, 0.24, 0.14, MAT.TRIM);
    for (const [px, pz] of [[-4.6, z + 5.6], [4.6, z + 5.6]] as const) {
      m.cylinder(px, pz, 0.34, 0, 4.0, 10, MAT.STONE);
      m.cylinder(px, pz, 0.46, 3.7, 4.0, 10, MAT.STONE);
    }
    // Niche plaques along the columbarium wall.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 14; i++) {
        for (const y of [1.1, 2.0]) {
          const px = -x + 1.2 + i * ((w - 2.4) / 13);
          m.box([px - 0.42, y, z + 10.94], [px + 0.42, y + 0.56, z + 11.02], MAT.TRIM);
        }
      }
    });
    entrance(m, { axis: 'z', sign: 1, plane: z }, 0,
      { width: 3.0, height: 3.4, double: true, steps: 2 });
    boxSign(m, { axis: 'z', sign: 1, plane: z }, -3.4, 3.4, 4.8, 5.7);
    for (let i = 0; i < 4; i++) planter(m, -6.0 + i * 4.0, z + 9.6, 0.9, 0.55);
    // A hearse and two mourners' cars on the forecourt.
    parkedVehicle(m, 9101, -8.0, -z - 5.0, 0, 'car');
    parkedVehicle(m, 9117, -3.0, -z - 5.0, 0, 'car');
    parkedVehicle(m, 9133, 2.0, -z - 5.0, 0, 'van');
    kerb(m, -x, -z - 7.4, x, -z - 6.6);
    figure(m, 9140, -5.4, -z - 3.2, Math.PI / 2, {});
    figure(m, 9151, -4.6, -z - 3.4, -Math.PI / 2, {});
  }
  return m;
}

/**
 * A parish church: nave, chancel, west tower and spire, in a walled yard.
 *
 * Built from the outside in, the way one reads from a street: the tower is the
 * tallest thing and carries the clock and the spire; the nave is long and low
 * with a steep roof and buttresses between its lancets; the chancel steps down
 * at the east end. Everything else -- the porch, the lychgate, the yews -- is
 * what tells you it is a church rather than a hall.
 */
function church(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const x = 22.0, z = 20.0;                    // the churchyard
  const nw = 9.0, nl = 24.0, nh = 9.5;         // nave: half-width, length, eaves
  const tw = 4.6, th = 20.0;                   // tower: half-width, height

  // Ground, and the yard wall round it.
  m.painted(TINT.GREEN, () => m.box([-x, 0.001, -z], [x, 0.09, z], MAT.TRIM));
  m.box([-x, 0, -z], [x, 1.3, -z + 0.6], MAT.STONE);
  m.box([-x, 0, z - 0.6], [x, 1.3, z], MAT.STONE);
  m.box([-x, 0, -z], [-x + 0.6, 1.3, z], MAT.STONE);
  m.box([x - 0.6, 0, -z], [x, 1.3, z], MAT.STONE);

  // The nave, running east-west along z, with its steep roof.
  const n0 = -nl / 2, n1 = nl / 2;
  m.box([-nw, 0, n0], [nw, nh, n1], MAT.STONE);
  m.gable([-nw - 0.5, nh, n0 - 0.4], [nw + 0.5, nh, n1 + 0.4], 5.4, 'z', MAT.ROOF, MAT.STONE);
  // The chancel: lower and narrower, at the east end.
  m.box([-nw + 2.2, 0, n1], [nw - 2.2, nh - 2.2, n1 + 7.0], MAT.STONE);
  m.gable([-nw + 1.8, nh - 2.2, n1 - 0.3], [nw - 1.8, nh - 2.2, n1 + 7.4], 3.8, 'z',
    MAT.ROOF, MAT.STONE);
  // The west tower, and its spire.
  const t0 = n0 - 6.4;
  m.box([-tw, 0, t0], [tw, th, n0 + 0.6], MAT.STONE);
  m.box([-tw - 0.5, th, t0 - 0.5], [tw + 0.5, th + 0.9, n0 + 1.1], MAT.STONE);
  m.cone(0, (t0 + n0 + 0.6) / 2, tw + 0.4, 0, th + 0.9, th + 12.0, 4, MAT.ROOF);

  if (medium) {
    // Buttresses between the nave windows, and clasping the tower corners.
    for (const sx of [-1, 1] as const) {
      for (let i = 0; i < 5; i++) {
        const u = n0 + 2.4 + i * ((nl - 4.8) / 4);
        m.box([sx > 0 ? nw : -nw - 1.0, 0, u - 0.55], [sx > 0 ? nw + 1.0 : -nw, nh - 1.2, u + 0.55],
          MAT.STONE);
        m.box([sx > 0 ? nw : -nw - 1.2, nh - 1.4, u - 0.7], [sx > 0 ? nw + 1.2 : -nw, nh - 1.0, u + 0.7],
          MAT.TRIM);
      }
      for (const u of [t0 + 0.7, n0 - 0.1]) {
        m.box([sx > 0 ? tw : -tw - 0.9, 0, u - 0.45], [sx > 0 ? tw + 0.9 : -tw, th - 2.4, u + 0.45],
          MAT.STONE);
      }
    }
    // String courses round the tower, which is what gives it stages.
    for (const y of [6.0, 11.0, 15.5]) ring(m, -tw, t0, tw, n0 + 0.6, y, 0.26, 0.16, MAT.TRIM);
    // The porch on the south side.
    m.box([nw, 0, -3.4], [nw + 4.0, 4.2, 1.4], MAT.STONE);
    m.gable([nw - 0.2, 4.2, -3.8], [nw + 4.4, 4.2, 1.8], 2.0, 'z', MAT.ROOF, MAT.STONE);
    // A lychgate on the yard wall, and yews along it.
    m.box([-2.6, 0, z - 1.2], [-2.0, 2.6, z + 0.2], MAT.TIMBER);
    m.box([2.0, 0, z - 1.2], [2.6, 2.6, z + 0.2], MAT.TIMBER);
    m.gable([-3.2, 2.6, z - 1.6], [3.2, 2.6, z + 0.6], 1.2, 'x', MAT.ROOF, MAT.TIMBER);
    for (const px of [-x + 4.0, -x + 10.0, x - 10.0, x - 4.0]) {
      m.painted(TINT.WOOD, () => m.cylinder(px, z - 3.6, 0.34, 0, 1.6, 6, MAT.TIMBER));
      m.painted(TINT.GREEN, () => m.cone(px, z - 3.6, 1.9, 0, 1.4, 6.4, 8, MAT.TRIM));
    }
  }
  if (fine) {
    // Lancets down both flanks of the nave, paired between the buttresses.
    for (const [sign, plane] of [[1, nw], [-1, -nw]] as const) {
      for (let i = 0; i < 4; i++) {
        const u = n0 + 2.4 + (i + 0.5) * ((nl - 4.8) / 4);
        for (const o of [-0.85, 0.85]) {
          m.opening({ axis: 'x', sign, plane, u0: u + o - 0.34, u1: u + o + 0.34,
            y0: 3.0, y1: 7.6, glass: MAT.GLASS, frame: 0.16, proud: 0.09 });
        }
      }
    }
    // The east window: one big light over the altar.
    m.opening({ axis: 'z', sign: 1, plane: n1 + 7.0, u0: -2.4, u1: 2.4, y0: 2.4, y1: 6.2,
      glass: MAT.GLASS, frame: 0.24, proud: 0.12 });
    // Belfry louvres, one to each face, and the clock under them.
    for (const [axis, sign, plane] of [['x', 1, tw], ['x', -1, -tw],
      ['z', -1, t0]] as const) {
      louvres(m, { axis, sign, plane }, axis === 'x' ? t0 + 1.2 : -tw + 1.2,
        axis === 'x' ? n0 - 0.6 : tw - 1.2, 15.9, 19.0);
    }
    m.painted(TINT.SIGN_LIT, () =>
      m.cylinder(0, t0 - 0.1, 1.5, 11.6, 11.75, 16, MAT.TRIM, true));
    m.painted(TINT.METAL_DARK, () => {
      m.cylinder(0, t0 - 0.2, 1.62, 11.5, 11.62, 16, MAT.TRIM, true);
      m.box([-0.08, 11.6, t0 - 0.3], [0.08, 12.8, t0 - 0.18], MAT.TRIM);
      m.box([-0.06, 11.55, t0 - 0.3], [0.85, 11.67, t0 - 0.18], MAT.TRIM);
    });
    entrance(m, { axis: 'z', sign: 1, plane: 1.4 }, nw + 2.0,
      { width: 1.6, height: 3.0, double: true, steps: 1 });
    entrance(m, { axis: 'z', sign: -1, plane: t0 }, 0,
      { width: 2.0, height: 3.4, double: true, steps: 2 });
    // Headstones in the yard, and the path up to the porch.
    m.box([-1.5, 0.02, 2.0], [1.5, 0.10, z - 1.2], MAT.GROUND);
    m.box([1.5, 0.02, 0.6], [nw + 4.4, 0.10, 2.0], MAT.GROUND);
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < 6; i++) {
        const px = -x + 4.0 + i * 3.2;
        const pz = -z + 4.0 + r * 3.0;
        const hgt = 0.7 + ((i * 5 + r * 3) % 4) * 0.14;
        m.box([px - 0.34, 0.05, pz - 0.12], [px + 0.34, hgt, pz + 0.12], MAT.STONE);
      }
    }
    figure(m, 9601, 0.0, z - 4.0, 0, { stride: 0.12 });
    figure(m, 9608, nw + 2.4, 3.0, Math.PI, { bag: true });
    parkedVehicle(m, 9615, -x + 6.0, -z + 3.4, 1, 'car');
  }
  return m;
}

/** A funeral director: a shopfront chapel of rest with a garage behind. */
function funeralDirector(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 15.0, d = 11.0, h = 6.6;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], MAT.STONE, { roof: MAT.ROOF });
  m.box([-x - 0.3, 0, -z - 0.3], [x + 0.3, 0.85, z + 0.3], MAT.STONE);
  parapet(m, -x, -z, x, z, h, 1.0, 0.24, MAT.STONE);
  // The garage for the hearses, lower and behind.
  m.box([-x, 0, -z - 8.0], [x - 2.0, 4.2, -z], MAT.CONCRETE, { roof: MAT.ROOF });
  parapet(m, -x, -z - 8.0, x - 2.0, -z, 4.2, 0.6, 0.16, MAT.CONCRETE);

  if (medium) {
    band(m, -x, -z, x, z, 3.9, 0.36, 0.2, MAT.TRIM);
    // A dark stone fascia over the window, which is how these read on a street.
    m.painted(TINT.METAL_DARK, () => m.box([-x - 0.2, 3.9, z], [x + 0.2, 5.0, z + 0.34], MAT.TRIM));
    ring(m, -x, -z, x, z, 5.0, 0.2, 0.1, MAT.TRIM);
  }
  if (fine) {
    // A single deep display window with a blind behind it, not a shopfront.
    m.opening({ axis: 'z', sign: 1, plane: z, u0: -x + 1.2, u1: -1.2, y0: 1.0, y1: 3.6,
      glass: MAT.GLASS, frame: 0.2, proud: 0.12 });
    m.painted(TINT.METAL_DARK, () =>
      m.box([-x + 1.4, 2.4, z + 0.06], [-1.4, 3.5, z + 0.12], MAT.TRIM));
    entrance(m, { axis: 'z', sign: 1, plane: z }, 1.6,
      { width: 1.4, height: 2.6, fanlight: true, steps: 1 });
    boxSign(m, { axis: 'z', sign: 1, plane: z }, -4.6, 4.6, 4.1, 4.8);
    windowGrid(m, { axis: 'z', sign: 1, plane: z }, -x + 1.0, x - 1.0,
      { floors: 1, floorH: 3.0, base: 4.4, count: 3, width: 1.1, height: 1.5 });
    for (const [sign, plane] of [[1, x], [-1, -x]] as const) {
      windowGrid(m, { axis: 'x', sign, plane }, -z + 1.2, z - 1.2,
        { floors: 1, floorH: 3.0, base: 4.4, count: 2, width: 1.1, height: 1.5 });
    }
    m.painted(TINT.METAL_DARK, () => {
      for (const cx of [-4.0, 1.2]) {
        m.opening({ axis: 'z', sign: -1, plane: -z - 8.0, u0: cx - 1.7, u1: cx + 1.7,
          y0: 0.2, y1: 3.2, glass: MAT.TRIM, frame: 0.16, proud: 0.1 });
      }
    });
    // Two hearses in the yard rather than one, and a walled yard round them:
    // a funeral director is a garage and a chapel behind a quiet frontage.
    parkedVehicle(m, 9201, -4.0, -z - 11.6, 2, 'car');
    parkedVehicle(m, 9207, 1.2, -z - 11.6, 2, 'van');
    m.box([-x - 0.4, 0, -z - 12.6], [-x, 2.2, -z], MAT.STONE);
    m.box([x - 2.0, 0, -z - 12.6], [x - 1.6, 2.2, -z], MAT.STONE);
    m.box([-x - 0.4, 0, -z - 13.0], [x - 1.6, 2.2, -z - 12.6], MAT.STONE);
    for (const px of [-x - 0.4, x - 2.0]) {
      m.box([px - 0.12, 2.2, -z - 13.1], [px + 0.52, 2.44, -z + 0.1], MAT.TRIM);
    }
    // A columned porch over the door, which is the one piece of ceremony a
    // building like this gets.
    m.box([-3.6, 0, z], [3.6, 0.24, z + 2.6], MAT.STONE);
    for (const px of [-3.2, -1.1, 1.1, 3.2]) {
      m.cylinder(px, z + 2.0, 0.26, 0.24, 3.9, 8, MAT.STONE);
    }
    m.box([-3.8, 3.9, z - 0.2], [3.8, 4.5, z + 2.8], MAT.STONE);
    ring(m, -3.8, z - 0.2, 3.8, z + 2.8, 4.5, 0.22, 0.12, MAT.TRIM);
    frontage(m, -x, x, z + 3.2, 9210, { planters: 2, bollards: 5 });
    figure(m, 9220, 3.4, z + 4.4, Math.PI, {});
  }
  return m;
}

/** A cemetery: walled ground with rows of stones, a lychgate and a chapel. */
function cemetery(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const x = 26.0, z = 20.0;

  m.painted(TINT.GREEN, () => m.box([-x, 0.001, -z], [x, 0.07, z], MAT.TRIM));
  // Boundary wall with a coping, open at the gate.
  for (const [a, b] of [[-x, -3.2], [3.2, x]] as const) {
    m.box([a, 0, z - 0.45], [b, 1.7, z], MAT.STONE);
    m.box([a - 0.06, 1.7, z - 0.51], [b + 0.06, 1.86, z + 0.06], MAT.TRIM);
  }
  for (const sx of [1, -1] as const) {
    m.box([Math.min(sx * x, sx * (x - 0.45)), 0, -z], [Math.max(sx * x, sx * (x - 0.45)), 1.7, z], MAT.STONE);
  }
  m.box([-x, 0, -z], [x, 1.7, -z + 0.45], MAT.STONE);

  // The lychgate: a covered gateway, which is what marks a burial ground.
  for (const sx of [1, -1] as const) {
    for (const sz of [1, -1] as const) {
      m.painted(TINT.WOOD, () =>
        m.box([sx * 3.0 - 0.16, 0, z + sz * 1.2 - 0.16], [sx * 3.0 + 0.16, 2.8, z + sz * 1.2 + 0.16], MAT.TIMBER));
    }
  }
  m.gable([-3.6, 2.8, z - 1.9], [3.6, 2.8, z + 1.9], 1.5, 'x', MAT.ROOF, MAT.TIMBER);

  if (medium) {
    // Rows of headstones, varied in height and slightly out of line.
    for (let r = 0; r < 5; r++) {
      for (let i = 0; i < 11; i++) {
        const px = -x + 3.4 + i * ((2 * x - 6.8) / 10);
        const pz = -z + 4.0 + r * 3.4;
        const hgt = 0.75 + ((i * 7 + r * 3) % 5) * 0.16;
        m.box([px - 0.42, 0.05, pz - 0.14], [px + 0.42, hgt, pz + 0.14], MAT.STONE);
        m.box([px - 0.5, 0, pz - 0.24], [px + 0.5, 0.12, pz + 0.24], MAT.STONE);
      }
    }
    m.box([-1.4, 0.02, -z + 1.0], [1.4, 0.09, z], MAT.GROUND);
  }
  if (fine) {
    // A small chapel at the far end, and yews along the walls.
    m.box([-4.0, 0, -z + 1.2], [4.0, 5.0, -z + 8.0], MAT.STONE);
    m.gable([-4.4, 5.0, -z + 0.8], [4.4, 5.0, -z + 8.4], 2.6, 'z', MAT.ROOF, MAT.STONE);
    m.opening({ axis: 'z', sign: 1, plane: -z + 8.0, u0: -1.2, u1: 1.2, y0: 1.0, y1: 3.6,
      glass: MAT.GLASS, frame: 0.16, proud: 0.09 });
    entrance(m, { axis: 'z', sign: 1, plane: -z + 8.0 }, 2.6, { width: 1.2, height: 2.4, steps: 1 });
    for (let i = 0; i < 8; i++) {
      const px = -x + 3.0 + i * ((2 * x - 6.0) / 7);
      m.painted(TINT.WOOD, () => m.cylinder(px, z - 2.6, 0.22, 0.05, 2.0, 6, MAT.TIMBER));
      m.painted(TINT.GREEN, () => m.cone(px, z - 2.6, 1.5, 0.0, 1.8, 6.6, 8, MAT.TRIM));
    }
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 11; i++) {
        const px = -3.0 + i * 0.6;
        m.box([px - 0.045, 0.1, z - 0.04], [px + 0.045, 2.2, z + 0.04], MAT.TRIM);
      }
    });
    // Mourners at a graveside, with flowers on the nearest row. A figure is a
    // third of the triangles it used to be now they are built from boxes, so
    // this is what the ground gets back.
    figure(m, 9301, 1.8, -2.0, 0, {});
    figure(m, 9308, 2.9, -1.6, -Math.PI * 0.6, { bag: true });
    figure(m, 9315, 2.3, -3.1, Math.PI * 0.9, {});
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < 4; i++) {
        const px = -x + 4.2 + i * 3.6;
        const pz = -z + 4.0 + r * 3.4;
        m.painted(TINT.GREEN, () => m.box([px - 0.16, 0.05, pz + 0.20],
          [px + 0.16, 0.16, pz + 0.46], MAT.TRIM));
        m.painted(TINT.BRAND, () => m.box([px - 0.11, 0.16, pz + 0.25],
          [px + 0.11, 0.30, pz + 0.41], MAT.TRIM));
      }
    }
    kerb(m, -x, z + 1.9, x, z + 2.7);
  }
  return m;
}

/** A post office: a counter hall on a high street with a sorting room behind. */
function postOffice(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 18.0, d = 13.0, h = 7.6;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], MAT.STONE, { roof: MAT.ROOF });
  m.box([-x - 0.4, 0, -z - 0.4], [x + 0.4, 1.1, z + 0.4], MAT.STONE);
  parapet(m, -x, -z, x, z, h, 1.1, 0.28, MAT.STONE);
  m.box([-x, 0, -z - 7.0], [x - 3.0, 4.6, -z], MAT.CONCRETE, { roof: MAT.ROOF });
  parapet(m, -x, -z - 7.0, x - 3.0, -z, 4.6, 0.6, 0.16, MAT.CONCRETE);

  if (medium) {
    band(m, -x, -z, x, z, 4.4, 0.4, 0.22, MAT.TRIM);
    // Pilasters between the bays: a counter hall is always articulated.
    for (let i = 0; i <= 4; i++) {
      const px = -x + (i / 4) * w;
      m.box([px - 0.42, 0, z], [px + 0.42, h - 0.4, z + 0.26], MAT.STONE);
    }
    m.painted(TINT.ACCENT, () => m.box([-x - 0.2, 4.4, z + 0.1], [x + 0.2, 5.6, z + 0.36], MAT.TRIM));
  }
  if (fine) {
    for (let i = 0; i < 4; i++) {
      const a = -x + (i / 4) * w + 0.7, b = -x + ((i + 1) / 4) * w - 0.7;
      if (i === 1) {
        entrance(m, { axis: 'z', sign: 1, plane: z }, (a + b) / 2,
          { width: 2.4, height: 3.2, double: true, glazed: true, steps: 1 });
      } else {
        m.opening({ axis: 'z', sign: 1, plane: z, u0: a, u1: b, y0: 1.1, y1: 4.0,
          glass: MAT.SHOPFRONT, frame: 0.18, proud: 0.1 });
      }
    }
    windowGrid(m, { axis: 'z', sign: 1, plane: z }, -x + 1.0, x - 1.0,
      { floors: 1, floorH: 3.0, base: 5.9, count: 4, width: 1.2, height: 1.4 });
    boxSign(m, { axis: 'z', sign: 1, plane: z }, -5.0, 5.0, 4.5, 5.5);
    // Posting boxes and a bike rack on the pavement.
    for (const [px, r] of [[-6.2, 0.42], [-4.9, 0.42]] as const) {
      m.painted(TINT.BRAND, () => {
        m.cylinder(px, z + 1.9, r, 0, 1.35, 10, MAT.TRIM);
        m.cone(px, z + 1.9, r + 0.04, 0.1, 1.35, 1.62, 10, MAT.TRIM);
      });
    }
    m.painted(TINT.METAL_DARK, () => {
      for (const cx of [-5.0, 1.0]) {
        m.opening({ axis: 'z', sign: -1, plane: -z - 7.0, u0: cx - 1.9, u1: cx + 1.9,
          y0: 0.2, y1: 3.6, glass: MAT.TRIM, frame: 0.18, proud: 0.1 });
      }
    });
    parkedVehicle(m, 9401, -5.0, -z - 10.6, 2, 'van');
    parkedVehicle(m, 9417, 1.0, -z - 10.6, 2, 'van');
    frontage(m, -x, x, z + 0.4, 9420, { planters: 2, bollards: 6 });
    figure(m, 9430, -3.0, z + 1.6, Math.PI, { bag: true });
    roofClutter(m, -x + 3, -z + 3, x - 3, z - 3, h, 9440, 0.4);
  }
  return m;
}

/** A delivery office: frames, cages and a yard full of vans. */
function deliveryOffice(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 26.0, d = 16.0, h = 7.0;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], MAT.SHED_WALL, { roof: MAT.ROOF });
  parapet(m, -x, -z, x, z, h, 0.9, 0.22, MAT.METAL);
  // Office end in a different material, so the shed is placed somewhere.
  m.box([-x, 0, z - 1.0], [-x + 9.0, 5.4, z + 3.0], MAT.CLADDING, { roof: MAT.ROOF });
  parapet(m, -x, z - 1.0, -x + 9.0, z + 3.0, 5.4, 0.7, 0.18, MAT.CONCRETE);

  if (medium) {
    band(m, -x, -z, x, z, 3.4, 0.3, 0.14, MAT.TRIM);
    m.painted(TINT.ACCENT, () => m.box([-x, 4.8, z + 0.02], [-x + 9.0, 5.4, z + 3.06], MAT.TRIM));
    // Loading apron and dock levellers along the front.
    m.box([-x + 9.0, 0, z], [x, 1.1, z + 3.2], MAT.CONCRETE);
    m.box([-x + 6.0, 0.01, z + 3.2], [x + 2.0, 0.07, z + 14.0], MAT.GROUND);
    for (let i = 0; i < 4; i++) {
      const cx = -x + 11.5 + i * 3.4;
      m.painted(TINT.METAL_DARK, () =>
        m.opening({ axis: 'z', sign: 1, plane: z, u0: cx - 1.3, u1: cx + 1.3, y0: 1.2, y1: 4.4,
          glass: MAT.TRIM, frame: 0.14, proud: 0.09 }));
      m.box([cx - 1.6, 4.4, z], [cx + 1.6, 5.0, z + 1.2], MAT.METAL);
    }
  }
  if (fine) {
    ribbon(m, { axis: 'z', sign: 1, plane: z + 3.0 }, -x + 0.8, -x + 8.2, 1.2, 3.0, { mullions: 5 });
    entrance(m, { axis: 'z', sign: 1, plane: z + 3.0 }, -x + 4.5,
      { width: 2.2, height: 3.0, double: true, glazed: true });
    boxSign(m, { axis: 'z', sign: 1, plane: z + 3.0 }, -x + 1.4, -x + 7.6, 3.5, 4.5);
    louvres(m, { axis: 'x', sign: -1, plane: -x }, -z + 2.0, z - 3.0, 4.6, 6.2, 7);
    // Roll cages waiting on the apron, and vans in the yard.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i < 6; i++) {
        const cx = -x + 10.5 + (i % 3) * 1.5, cz = z + 1.0 + Math.floor(i / 3) * 1.6;
        for (const [ax, az] of [[-0.5, -0.4], [0.5, -0.4], [-0.5, 0.4], [0.5, 0.4]] as const) {
          m.box([cx + ax - 0.05, 1.1, cz + az - 0.05], [cx + ax + 0.05, 2.6, cz + az + 0.05], MAT.TRIM);
        }
        for (const y of [1.5, 2.0, 2.5]) m.box([cx - 0.55, y, cz - 0.45], [cx + 0.55, y + 0.07, cz + 0.45], MAT.TRIM);
      }
    });
    for (let i = 0; i < 4; i++) parkedVehicle(m, 9500 + i * 13, -x + 8.0 + i * 5.0, z + 8.6, 0, 'van');
    serviceYard(m, -x, x, -z - 8.0, 9520, { bins: true, cycles: true });
    roofClutter(m, -x + 3, -z + 3, x - 3, z - 3, h, 9530, 0.7);
  }
  return m;
}

/** A sorting centre: a long shed with a conveyor bridge and a lorry yard. */
function sortingCentre(lod: number): MeshBuilder {
  const m = new MeshBuilder();
  const fine = lod < 1, medium = lod < 2;
  const w = 34.0, d = 22.0, h = 12.0;
  const x = w / 2, z = d / 2;

  m.box([-x, 0, -z], [x, h, z], MAT.SHED_WALL, { roof: MAT.ROOF });
  parapet(m, -x, -z, x, z, h, 1.1, 0.26, MAT.METAL);
  m.box([-x, 0, z - 1.2], [-x + 12.0, 8.0, z + 4.0], MAT.CLADDING, { roof: MAT.ROOF });
  parapet(m, -x, z - 1.2, -x + 12.0, z + 4.0, 8.0, 0.8, 0.2, MAT.CONCRETE);

  if (medium) {
    // Profiled cladding ribs, and the conveyor bridge over the yard.
    m.painted(TINT.METAL_DARK, () => {
      for (let i = 0; i <= 12; i++) {
        const px = -x + (i / 12) * w;
        m.box([px - 0.1, 0, -z - 0.14], [px + 0.1, h, -z], MAT.TRIM);
      }
    });
    m.box([x, 6.4, -z + 4.0], [x + 12.0, 8.2, -z + 7.2], MAT.CLADDING);
    m.box([x - 0.2, 8.2, -z + 3.8], [x + 12.2, 8.5, -z + 7.4], MAT.METAL);
    for (const px of [x + 3.0, x + 9.0]) {
      m.box([px - 0.4, 0, -z + 5.0], [px + 0.4, 6.4, -z + 6.2], MAT.CONCRETE);
    }
    m.box([-x + 12.0, 0, z], [x, 1.2, z + 3.6], MAT.CONCRETE);
    m.box([-x + 8.0, 0.01, z + 3.6], [x + 4.0, 0.07, z + 18.0], MAT.GROUND);
  }
  if (fine) {
    for (let i = 0; i < 6; i++) {
      const cx = -x + 15.0 + i * 3.2;
      m.painted(TINT.METAL_DARK, () =>
        m.opening({ axis: 'z', sign: 1, plane: z, u0: cx - 1.4, u1: cx + 1.4, y0: 1.3, y1: 4.8,
          glass: MAT.TRIM, frame: 0.16, proud: 0.1 }));
      m.box([cx - 1.7, 4.8, z], [cx + 1.7, 5.5, z + 1.3], MAT.METAL);
    }
    ribbon(m, { axis: 'z', sign: 1, plane: z + 4.0 }, -x + 0.9, -x + 11.1, 1.4, 3.4, { mullions: 6 });
    ribbon(m, { axis: 'z', sign: 1, plane: z + 4.0 }, -x + 0.9, -x + 11.1, 4.6, 6.6, { mullions: 6 });
    entrance(m, { axis: 'z', sign: 1, plane: z + 4.0 }, -x + 6.0,
      { width: 2.6, height: 3.2, double: true, glazed: true, canopy: 2.4 });
    boxSign(m, { axis: 'z', sign: 1, plane: z + 4.0 }, -x + 1.6, -x + 10.4, 6.9, 7.9);
    louvres(m, { axis: 'x', sign: 1, plane: x }, -z + 2.0, -z + 3.6, 7.0, 10.0, 6);
    for (let i = 0; i < 4; i++) {
      parkedVehicle(m, 9600 + i * 17, -x + 12.0 + i * 7.0, z + 10.0, 0, 'truck');
    }
    for (const px of [-x + 4.0, x - 4.0]) {
      m.painted(TINT.METAL_DARK, () => {
        m.pipe([px, 0, z + 14.0], [px, 11.0, z + 14.0], 0.16, MAT.TRIM, 8);
        m.box([px - 1.6, 10.7, z + 13.8], [px + 1.6, 11.0, z + 14.2], MAT.TRIM);
      });
    }
    railing(m, -x + 12.0, x, z + 3.4, 1.2, 1.1, 1.6);
    bollards(m, { axis: 'z', sign: 1, plane: z + 4.0 }, -x + 1.0, -x + 11.0, 1.6, 5);
    roofClutter(m, -x + 3, -z + 3, x - 3, z - 3, h, 9620, 1.0);
  }
  return m;
}

// ==================================================================== table

const civ = (jobs: number, upkeep: number, power: number, water: number): AssetDef['sim'] => ({
  jobs, powerKW: power, waterM3: water, garbagePerWeek: jobs * 9, pollution: 0, upkeep,
});

export const DEATH_AND_POST: AssetDef[] = [
  { id: 'svc.death.crematorium', name: 'Crematorium', zone: 'service', branch: 'deathcare', density: 'none', variant: 'sculpted', footprint: [5, 6], height: 19.4, brand: { name: 'Crematorium', colour: [0.36, 0.34, 0.38], accent: [0.60, 0.56, 0.48], sign: 'box' }, sim: civ(16, 300, 220, 60), note: 'Stone chapel under a monopitch with high narrow lights, a seventeen-metre flue, cloister and garden of remembrance.', build: crematorium },
  { id: 'svc.death.director', name: 'Funeral director', zone: 'service', branch: 'deathcare', density: 'none', variant: 'sculpted', footprint: [4, 5], height: 7.6, brand: { name: 'Funeral Director', colour: [0.20, 0.18, 0.22], accent: [0.62, 0.58, 0.44], sign: 'box' }, sim: civ(8, 120, 50, 30), note: 'Chapel of rest behind a single deep display window with a blind, and a hearse garage in the yard behind.', build: funeralDirector },
  { id: 'svc.death.church', name: 'Church', zone: 'service', branch: 'deathcare', density: 'none', variant: 'sculpted', footprint: [6, 6], height: 32.9, brand: { name: 'Church', colour: [0.42, 0.40, 0.36], accent: [0.56, 0.52, 0.44], sign: 'box' }, sim: civ(6, 140, 40, 40), note: 'Nave and chancel under steep roofs with buttressed lancets, a west tower with a clock, louvred belfry and spire, in a walled yard with a lychgate.', build: church },
  { id: 'svc.death.cemetery', name: 'Cemetery', zone: 'service', branch: 'deathcare', density: 'none', variant: 'sculpted', footprint: [7, 6], height: 7.6, brand: { name: 'Cemetery', colour: [0.30, 0.34, 0.28], accent: [0.58, 0.56, 0.50], sign: 'box' }, sim: civ(4, 90, 10, 40), note: 'Walled ground with a timber lychgate, five rows of headstones, a small chapel and yews along the wall.', build: cemetery },
  { id: 'svc.post.office', name: 'Post office', zone: 'service', branch: 'post', density: 'none', variant: 'sculpted', footprint: [4, 5], height: 8.7, brand: { name: 'Post Office', colour: [0.66, 0.14, 0.10], accent: [0.90, 0.84, 0.24], sign: 'box' }, sim: civ(14, 160, 70, 30), note: 'Counter hall articulated by pilasters, a fascia band, two posting boxes on the pavement and a van yard behind.', build: postOffice },
  { id: 'svc.post.delivery', name: 'Delivery office', zone: 'service', branch: 'post', density: 'none', variant: 'sculpted', footprint: [5, 6], height: 8.0, brand: { name: 'Delivery', colour: [0.64, 0.14, 0.10], accent: [0.90, 0.84, 0.24], sign: 'box' }, sim: civ(40, 280, 140, 60), note: 'Shed with four dock doors and canopies, roll cages on the apron, a clad office end and a yard of vans.', build: deliveryOffice },
  { id: 'svc.post.sorting', name: 'Sorting centre', zone: 'service', branch: 'post', density: 'none', variant: 'sculpted', footprint: [8, 8], height: 13.1, brand: { name: 'Sorting', colour: [0.62, 0.14, 0.10], accent: [0.90, 0.84, 0.24], sign: 'box' }, sim: civ(140, 780, 520, 180), note: 'Long clad shed with six dock doors, a glazed office end, a conveyor bridge over the yard and floodlit lorry parking.', build: sortingCentre },
];
