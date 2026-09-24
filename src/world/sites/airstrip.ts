/**
 * Pista La Trinidad — the fourth site.
 *
 * OWNED BY: World design team.
 *
 * ## The question this map asks
 * The villa is walls, the quay is layers, the barrio is height. This one is
 * **open ground and a clock**. A clandestine strip cut into a river valley:
 * 300 m of runway you can see down end to end, a hangar with an aircraft in
 * it being fuelled, a control tower that sees everything, and a cook camp
 * under the trees on the far side. There is almost no hard cover between the
 * buildings — the cover is vehicles, fuel drums, the tree lines and the fold
 * of the river bank — so every crossing is a decision about how exposed you
 * are willing to be, and for how long.
 *
 *        z  +92  ~~~~~~~~~~~~~~~~ river ~~~~~~~~~~~~~~~~
 *        z  +80  bank, reeds, the boat landing
 *        z  46..70   HANGAR (x -22..22)      fuel dump (x -70)   tower (x 48)
 *        z  14..44   APRON: the aircraft, the bowser, ground kit
 *        z -12..12   RUNWAY, x -150..150
 *        z -30..-72  THE CAMP under the trees: cook shed, tents, bunkhouses
 *        z  -88      tree line
 */

import { Rng } from '../../core/math';
import { SiteBuilder } from '../builder';
import { Props } from '../props';
import { M } from '../palette';
import { BF, type SiteInstance, type SiteBuildResult, type RoomSpec, type NavLink } from '../types';
import { makeKit, building, Frame, meadow, type Fixture } from '../kit';

const PAD = 2.0;
const RW = { x0: -150, x1: 150, z0: -12, z1: 12 };

export function buildAirstrip(
  b: SiteBuilder, rng: Rng,
  floorAt: (x: number, z: number) => number = () => PAD,
): SiteBuildResult {
  void floorAt;
  const k = makeKit(b, rng);
  const p: Props = k.p;
  const navLinks: NavLink[] = [];
  const lights: Fixture[] = k.lights;
  const rooms: RoomSpec[] = k.rooms;
  const light = (x: number, y: number, z: number, color: number, intensity: number, distance: number, alwaysOn = false): void => {
    lights.push({ position: { x, y, z }, color, intensity, distance, alwaysOn });
  };
  const room = (name: string, tag: string, indoors: boolean, x0: number, z0: number, x1: number, z1: number, y0: number, y1: number): number => {
    const spec = { name, tag, indoors, minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1), minY: y0, maxY: y1 };
    rooms.push({ ...spec, buildingId: 0 });
    return b.room(spec);
  };

  b.building('Pista La Trinidad');

  // ==========================================================================
  // GROUND — a valley floor, not a lawn
  // ==========================================================================
  b.span(-176, PAD - 0.4, -96, 176, PAD, 76, M.dirtMat, { surface: 'dirt', flags: BF.NO_COVER, tint: b.jitterTint(0.04) });
  // Grass everywhere except the runway and its shoulders, the apron and the
  // hangar floor.
  for (const [x0, z0, x1, z1] of [
    [-170, -92, 170, -16], [-170, -16, -155, 16], [155, -16, 170, 16],
    [-170, 16, -46, 76], [46, 16, 170, 76],
    [-46, 46, -24, 76], [24, 46, 46, 76], [-24, 74, 24, 76],
  ] as const) meadow(k, x0, z0, x1, z1, PAD, 5);
  // Dry grass fields either side of the strip — soft, waist-high, and the
  // only concealment on the open ground.
  for (let i = 0; i < 140; i++) {
    const x = rng.range(-165, 165);
    const z = rng.next() < 0.5 ? rng.range(-26, -16) : rng.range(46, 76);
    if (z > 40 && x > -80 && x < 60) continue;
    const s = rng.range(0.9, 2.2);
    b.box(x, PAD + 0.45, z, s, 0.45, s * 0.7, M.leafDry,
      { yaw: rng.range(0, 3.14), surface: 'foliage', flags: BF.SOFT | BF.NO_COVER | BF.NO_SHADOW, tint: b.jitterTint(0.12) });
  }

  // ==========================================================================
  // THE RUNWAY
  // ==========================================================================
  b.span(RW.x0, PAD - 0.2, RW.z0, RW.x1, PAD + 0.04, RW.z1, M.asphalt, { surface: 'concrete', flags: BF.NO_COVER, tint: b.jitterTint(0.05) });
  // Shoulders of packed gravel.
  for (const [z0, z1] of [[RW.z0 - 3, RW.z0], [RW.z1, RW.z1 + 3]] as const) {
    b.span(RW.x0 - 4, PAD - 0.2, z0, RW.x1 + 4, PAD + 0.025, z1, M.gravelMat, { surface: 'gravel', flags: BF.NO_COVER });
  }
  // Centre line, threshold bars and numbers-that-are-just-bars.
  for (let x = RW.x0 + 20; x < RW.x1 - 20; x += 9) p.paintMarking(x, -0.2, x + 4.5, 0.2, PAD + 0.045);
  for (const tx of [RW.x0 + 3, RW.x1 - 9]) {
    for (let j = 0; j < 8; j++) p.paintMarking(tx, RW.z0 + 1.2 + j * 2.8, tx + 6, RW.z0 + 2.2 + j * 2.8, PAD + 0.045);
  }
  // Patch repairs and tyre scrub — this strip is used.
  p.wash(RW.x0, RW.z0, RW.x1, RW.z1, PAD + 0.05, 5);
  // Edge lights: low boxes every 30 m, and every third one a real light so a
  // night landing strip actually reads as a line of lights.
  let n = 0;
  for (let x = RW.x0; x <= RW.x1; x += 30) {
    for (const z of [RW.z0 - 0.6, RW.z1 + 0.6]) {
      b.box(x, PAD + 0.18, z, 0.14, 0.18, 0.14, M.sootMetal, { surface: 'metal', flags: BF.NO_COVER });
      b.box(x, PAD + 0.4, z, 0.1, 0.05, 0.1, M.lampWarm, { surface: 'glass', flags: BF.NO_COVER | BF.NO_NAV });
      if (n++ % 3 === 0) light(x, PAD + 0.8, z, 0xffd28a, 14, 10, true);
    }
  }
  // Windsock.
  b.cyl(RW.x1 - 16, PAD + 3.4, RW.z1 + 10, 0.08, 3.4, M.steelGalv, { surface: 'metal' });
  b.box(RW.x1 - 15.4, PAD + 6.5, RW.z1 + 10, 0.6, 0.25, 0.25, M.paintOrange, { surface: 'fabric', flags: BF.NO_COVER, yaw: 0.4 });

  // ==========================================================================
  // THE APRON AND THE HANGAR
  // ==========================================================================
  b.span(-44, PAD, 14, 44, PAD + 0.06, 46, M.concreteRaw, { surface: 'concrete', flags: BF.NO_COVER, tint: b.jitterTint(0.04) });
  p.wash(-44, 14, 44, 46, PAD + 0.07, 16);
  p.paintMarking(-44, 29.8, 44, 30.1, PAD + 0.07, M.paintYellow);

  // The hangar: one enormous shed, doors open onto the apron.
  const H = { x0: -22, x1: 22, z0: 48, z1: 72 };
  // Front on the apron (z0), depth running away from it. The mouth is a
  // 30 m opening, not a roller door: the aircraft's wings span 18 m.
  building(k, { frame: new Frame(H.x0, H.z0, 'south'), w: H.x1 - H.x0, d: H.z1 - H.z0, y: PAD + 0.06,
    storeys: 1, style: 'shed', name: 'Hangar', storeyH: 9.5, mat: M.corrugated,
    frontOpen: 30, frontOpenH: 7.5 });
  // A mezzanine along the back with an office on it — the hangar's high ground.
  const my = PAD + 4.2;
  b.span(H.x0 + 0.3, my - 0.2, H.z1 - 6, H.x1 - 0.3, my, H.z1 - 0.3, M.steelDark, { surface: 'metal' });
  b.stairs({ x: H.x0 + 2, z: H.z1 - 6 - 5.2, dirX: 0, dirZ: 1, width: 1.2, fromY: PAD + 0.06, toY: my, run: 5.0, mat: M.steelGalv, railMat: M.paintYellow });
  for (let x = H.x0 + 4; x < H.x1; x += 3) {
    b.box(x, my + 0.55, H.z1 - 6, 0.03, 0.55, 0.03, M.paintYellow, { surface: 'metal', flags: BF.NO_COVER | BF.THIN });
  }
  b.span(H.x0 + 0.3, my + 1.05, H.z1 - 6.03, H.x1 - 0.3, my + 1.1, H.z1 - 5.97, M.paintYellow, { surface: 'metal', flags: BF.NO_COVER | BF.THIN });
  room('Hangar mezzanine', 'overwatch', true, H.x0, H.z1 - 6, H.x1, H.z1, my, my + 4);
  light(0, my + 4.5, (H.z0 + H.z1) / 2, 0xdfe8ff, 280, 34, true);

  // --- the aircraft ---------------------------------------------------------
  // A twin-engine light transport, nose out of the hangar, being loaded. It
  // is the objective of one mission and the best cover on the apron in all of
  // them: the fuselage stops rounds and the wings are overhead.
  const plane = (cx: number, cz: number, yaw: number): void => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const at = (u: number, v: number): [number, number] => [cx + c * u + s * v, cz - s * u + c * v];
    const box = (u: number, y: number, v: number, hu: number, hy: number, hv: number, mat: number, flags = 0): void => {
      const [x, z] = at(u, v);
      b.box(x, PAD + y, z, hu, hy, hv, mat, { yaw, surface: 'metal', flags });
    };
    box(0, 1.9, 0, 7.4, 1.0, 0.95, M.chalkWhite);                    // fuselage
    box(7.9, 1.8, 0, 0.6, 0.7, 0.7, M.chalkWhite);                   // nose
    box(8.3, 2.25, 0, 0.3, 0.35, 0.6, M.glass, BF.SOFT | BF.TRANSPARENT);
    box(-8.2, 2.1, 0, 1.0, 0.5, 0.5, M.chalkWhite);                  // tail cone
    box(-8.4, 3.6, 0, 0.9, 1.3, 0.08, M.paintRed);                   // fin
    box(-8.4, 2.4, 0, 0.8, 0.07, 2.8, M.chalkWhite, BF.NO_COVER);    // tailplane
    box(1.0, 2.9, 0, 1.8, 0.1, 9.0, M.chalkWhite, BF.NO_COVER);      // wing
    box(0, 1.9, 0.97, 6.5, 0.1, 0.01, M.paintRed, BF.NO_COVER | BF.THIN);    // cheat line
    box(0, 1.9, -0.97, 6.5, 0.1, 0.01, M.paintRed, BF.NO_COVER | BF.THIN);
    for (const v of [-3.6, 3.6]) {
      box(2.2, 2.7, v, 1.4, 0.45, 0.45, M.boxFadedGrey);             // nacelle
      box(3.7, 2.7, v, 0.04, 1.2, 0.1, M.sootMetal, BF.NO_COVER);    // prop blade
      box(0.8, 1.0, v, 0.15, 0.9, 0.15, M.sootMetal);                // main gear
    }
    box(6.6, 0.6, 0, 0.12, 0.6, 0.12, M.sootMetal);                  // nose gear
    // Cargo door open, with bales being loaded through it.
    box(-3, 1.3, 1.2, 1.1, 0.8, 0.3, M.sootMetal, BF.NO_COVER);
    for (let i = 0; i < 6; i++) {
      const [x, z] = at(-3 + (i % 3) * 0.9, 2.6 + Math.floor(i / 3) * 0.8);
      b.box(x, PAD + 0.36, z, 0.4, 0.3, 0.3, M.sandbag, { yaw, surface: 'fabric' });
    }
  };
  plane(0, 36, 0);
  // Fuel bowser, a tug, a stair truck.
  b.span(14, PAD, 20, 22, PAD + 1.2, 22.6, M.sootMetal, { surface: 'metal' });
  b.cyl(18, PAD + 2.2, 21.3, 1.1, 1.0, M.chalkWhite, { surface: 'metal' });
  b.span(21.4, PAD + 1.2, 20, 22.6, PAD + 2.6, 22.6, M.paintRed, { surface: 'metal' });
  p.pickup(-18, PAD, 22, 0.2, M.paintYellow);
  for (let i = 0; i < 14; i++) p.drum(-34 + (i % 7) * 0.75, PAD + 0.06, 40 + Math.floor(i / 7) * 0.75, i % 4 ? M.paintBlue : M.paintRed);
  for (let i = 0; i < 6; i++) p.pallet(-30 + i * 2.2, PAD + 0.06, 18, 0, 2 + (i % 3));
  for (const [fx, fz] of [[-40, 16], [40, 16], [-40, 44], [40, 44]] as const) {
    p.floodlight(fx, PAD, fz, Math.atan2(-fx, 30 - fz), 7);
    light(fx * 0.95, PAD + 6.6, fz + (fz < 30 ? 1 : -1), 0xe8f0ff, 220, 32);
  }

  // --- the control tower -----------------------------------------------------
  // Three storeys and a glass cab. It sees the whole strip, both tree lines and
  // the river — the best position on the map and the most exposed one.
  const TX = 50, TZ = 30;
  building(k, { frame: new Frame(TX - 3, TZ - 3, 'south'), w: 6, d: 6, y: PAD, storeys: 3,
    style: 'house', name: 'Control tower', mat: M.chalkWhite });
  const cabY = PAD + 9.6;
  // The ring stands inside the roof edge, clear of the kit's back ladder
  // (which lands at x = TX + 2.2 on the +z side), with a doorway there.
  const CR = 2.8;
  for (const [ax, az, bx, bz] of [[TX - CR, TZ - CR, TX + CR, TZ - CR], [TX - CR, TZ + CR, TX + CR, TZ + CR], [TX - CR, TZ - CR, TX - CR, TZ + CR], [TX + CR, TZ - CR, TX + CR, TZ + CR]] as const) {
    const back = az === TZ + CR && bz === TZ + CR;
    const gap = back ? [{ at: 5.0, width: 1.0, y0: 0, y1: 2.4, kind: 'hole' as const }] : [];
    b.wall({ x0: ax, z0: az, x1: bx, z1: bz, y: cabY + 0.2, height: 1.0, thickness: 0.2, mat: M.sootMetal, openings: gap });
    b.wall({ x0: ax, z0: az, x1: bx, z1: bz, y: cabY + 1.2, height: 1.4, thickness: 0.05, mat: M.glass,
      surface: 'glass', flags: BF.SOFT | BF.TRANSPARENT | BF.NO_SHADOW | BF.THIN,
      openings: back ? [{ at: 5.0, width: 1.0, y0: 0, y1: 1.4, kind: 'hole' as const }] : [] });
  }
  b.span(TX - 3.8, cabY + 2.6, TZ - 3.8, TX + 3.8, cabY + 2.9, TZ + 3.8, M.sootMetal, { surface: 'metal', flags: BF.NO_COVER });
  p.roofAerial(TX + 2, cabY + 2.9, TZ + 2, 4.5);
  p.table(TX, cabY + 0.2, TZ + 1.8, 0, 3.0, 0.8, 0.9, M.sootMetal);
  room('Tower cab', 'overwatch', true, TX - CR, TZ - CR, TX + CR, TZ + CR, cabY, cabY + 2.6);
  light(TX, cabY + 2.2, TZ, 0x9fc8ff, 18, 10, true);

  // --- fuel dump ---------------------------------------------------------------
  for (let i = 0; i < 3; i++) {
    const fx = -76 + i * 9, fz = 58;
    b.cyl(fx, PAD + 2.4, fz, 3.1, 2.4, [M.boxFadedGrey, M.chalkWhite, M.boxFadedGreen][i], { surface: 'metal' });
    b.ladder(fx + 3.2, fz, Math.PI / 2, PAD, PAD + 5.0);
  }
  for (const [ax, az, bx, bz] of [[-82, 52, -54, 52], [-82, 64, -54, 64], [-82, 52, -82, 64], [-54, 52, -54, 64]] as const) {
    b.wall({ x0: ax, z0: az, x1: bx, z1: bz, y: PAD, height: 1.2, thickness: 0.3, mat: M.concreteRaw, jitter: 0.05,
      openings: az === 52 && bz === 52 ? [{ at: 14, width: 2, y0: 0, y1: 1.2, kind: 'hole' }] : [] });
  }

  // ==========================================================================
  // THE CAMP — under the trees south of the strip
  // ==========================================================================
  // The cook shed: the lab. One building, walled in, with the product in it.
  building(k, { frame: new Frame(-16, -46, 'north'), w: 18, d: 12, y: PAD, storeys: 1,
    style: 'shed', name: 'Cook shed', storeyH: 4.2, mat: M.concreteRaw });
  for (let i = 0; i < 4; i++) {
    b.span(-31 + i * 3.6, PAD + 0.1, -52, -29 + i * 3.6, PAD + 1.0, -50.6, M.steelGalv, { surface: 'metal' });
    b.cyl(-30 + i * 3.6, PAD + 1.35, -51.3, 0.45, 0.35, M.steelDark, { surface: 'metal', flags: BF.NO_COVER });
  }
  light(-25, PAD + 3.6, -52, 0xd6e4e0, 40, 14, true);
  // Bunkhouses, a mess tent, latrines, a generator.
  building(k, { frame: new Frame(12, -38, 'north'), w: 10, d: 7, y: PAD, storeys: 1, style: 'house', name: 'Bunkhouse A', mat: M.woodWeathered });
  building(k, { frame: new Frame(26, -38, 'north'), w: 10, d: 7, y: PAD, storeys: 1, style: 'house', name: 'Bunkhouse B', mat: M.woodWeathered });
  const tent = (cx: number, cz: number, w: number, d: number, mat: number): void => {
    for (const [ox, oz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]] as const) {
      b.box(cx + ox, PAD + 1.2, cz + oz, 0.05, 1.2, 0.05, M.woodDark, { surface: 'wood', flags: BF.NO_COVER });
    }
    b.gableRoof(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, PAD + 2.4, 1.3, mat, 0.2);
    p.table(cx, PAD, cz, 0, w * 0.6, 1.0, 0.76, M.woodWeathered);
    for (let i = 0; i < 3; i++) p.chair(cx - w * 0.2 + i * w * 0.2, PAD, cz + 1.0, Math.PI);
    light(cx, PAD + 2.1, cz, 0xffc27a, 12, 9);
  };
  tent(-40, -34, 7, 5, M.fabricTeal);
  tent(40, -58, 6, 5, M.boxFadedGreen);
  tent(-44, -62, 6, 4, M.fabricCream);
  p.generator(4, PAD, -58, 0.4);
  for (let i = 0; i < 18; i++) p.drum(-8 + (i % 6) * 0.72, PAD, -62 + Math.floor(i / 6) * 0.72, i % 5 ? M.paintBlue : undefined);
  for (let i = 0; i < 10; i++) p.crate(rng.range(-50, 50), PAD, rng.range(-70, -30), rng.range(0, 3), rng.range(0.4, 0.8));
  p.dress(-55, -75, 55, -28, PAD, 7);
  p.wash(-55, -75, 55, -28, PAD + 0.01, 6);
  // Canopy of trees over the camp — from the tower you can see the strip and
  // not the camp, which is the whole reason the camp is here.
  for (let i = 0; i < 46; i++) {
    const x = rng.range(-70, 70), z = rng.range(-86, -28);
    if (x > -36 && x < -14 && z > -60 && z < -44) continue;     // cook shed
    if (x > 0 && x < 28 && z > -47 && z < -36) continue;        // bunkhouses
    p.shadeTree(x, PAD, z, rng.range(8, 12));
  }

  // --- watchtowers --------------------------------------------------------------
  const watchtower = (x: number, z: number): void => {
    const top = PAD + 6.2;
    for (const [ox, oz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]] as const) {
      b.box(x + ox, PAD + 3.6, z + oz, 0.12, 3.6, 0.12, M.woodDark, { surface: 'wood' });
    }
    b.span(x - 1.6, top - 0.15, z - 1.6, x + 1.6, top, z + 1.6, M.woodWeathered, { surface: 'wood' });
    for (const [ax, az, bx, bz] of [[x - 1.6, z - 1.6, x + 1.6, z - 1.6], [x - 1.6, z + 1.6, x + 1.6, z + 1.6], [x - 1.6, z - 1.6, x - 1.6, z + 1.6]] as const) {
      b.wall({ x0: ax, z0: az, x1: bx, z1: bz, y: top, height: 1.0, thickness: 0.1, mat: M.woodWeathered });
    }
    b.gableRoof(x - 1.7, z - 1.7, x + 1.7, z + 1.7, top + 2.2, 0.8, M.corrugated, 0.2);
    for (const [ox, oz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]] as const) {
      b.box(x + ox, top + 1.1, z + oz, 0.06, 1.1, 0.06, M.woodDark, { surface: 'wood', flags: BF.NO_COVER });
    }
    b.ladder(x + 1.7, z, Math.PI / 2, PAD, top + 0.4);
    p.floodlight(x, top, z - 1.2, 0, 1.5);
    light(x, top + 1.8, z, 0xe8f0ff, 60, 26);
  };
  watchtower(-96, -30);
  watchtower(96, 30);
  watchtower(-40, 72);

  // ==========================================================================
  // THE RIVER — the quiet way in
  // ==========================================================================
  b.span(-176, PAD - 3.2, 82, 176, PAD - 1.3, 96, M.water, { surface: 'water', flags: BF.SOFT | BF.NO_NAV });
  b.span(-176, PAD - 3.4, 82, 176, PAD - 2.0, 96, M.dirtMat, { surface: 'dirt' });
  // The bank drops in two steps: a real fold in the ground you can move
  // along below the eye line of anyone on the apron.
  b.span(-176, PAD - 1.0, 76, 176, PAD - 0.05, 82, M.dirtMat, { surface: 'dirt', flags: BF.NO_COVER });
  for (let i = 0; i < 90; i++) {
    const x = rng.range(-170, 170), z = rng.range(76.5, 81.5);
    b.box(x, PAD - 0.35, z, rng.range(0.4, 1.0), rng.range(0.4, 0.8), 0.3, M.leafMid,
      { surface: 'foliage', flags: BF.SOFT | BF.NO_COVER | BF.NO_SHADOW, yaw: rng.range(0, 3.14) });
  }
  // The boat landing: a jetty and two skiffs.
  b.span(-110, PAD - 0.9, 80, -104, PAD - 0.7, 90, M.woodWeathered, { surface: 'wood' });
  for (const sz of [84, 88]) {
    b.span(-102.5, PAD - 1.5, sz - 0.8, -97.5, PAD - 0.9, sz + 0.8, M.boxFadedNavy, { surface: 'metal' });
  }

  // Tree lines on both flanks of the valley.
  for (let i = 0; i < 120; i++) {
    const side = rng.next() < 0.5 ? -1 : 1;
    const x = side * rng.range(155, 176), z = rng.range(-90, 76);
    if (rng.next() < 0.5) p.cypress(x, PAD, z, rng.range(7, 11));
    else p.shadeTree(x, PAD, z, rng.range(8, 12));
  }
  // A radio mast by the tower, lit red at the top.
  for (let i = 0; i < 6; i++) b.box(62, PAD + 2 + i * 4, 40, 0.3 - i * 0.03, 2, 0.3 - i * 0.03, M.paintRed, { surface: 'metal', flags: i ? BF.NO_COVER : 0 });
  b.box(62, PAD + 24.4, 40, 0.18, 0.18, 0.18, M.neonRed, { surface: 'glass', flags: BF.NO_COVER });
  light(62, PAD + 24, 40, 0xff3b28, 20, 12, true);

  b.endBuilding();

  const site: SiteInstance = {
    id: 'pista-la-trinidad',
    name: 'Pista La Trinidad',
    archetype: 'airfield',
    x: 0, z: 0, padY: PAD,
    minX: -200, maxX: 200, minZ: -120, maxZ: 120,
    coreMinX: -160, coreMaxX: 160, coreMinZ: -92, coreMaxZ: 84,
    minY: PAD - 4, maxY: PAD + 26,
    roomIds: rooms.map((_r, i) => i),
    doorIds: b.doors.map((d) => d.id),
    buildingCount: b.buildingNames.length,
    approaches: [
      { id: 'runway', name: 'Down the strip', kind: 'front',
        x: RW.x1 + 18, y: PAD, z: 0, toX: 0, toZ: 30,
        description: 'Straight down 300 m of runway. Nothing to hide behind but the edge lights.',
        stealth: 0.05, speed: 0.8, risk: 0.9 },
      { id: 'river', name: 'The river bank', kind: 'water',
        x: -150, y: PAD, z: 79, toX: 0, toZ: 60,
        description: 'Along the fold of the bank below the apron. Slow, wet and nearly invisible.',
        stealth: 0.85, speed: 0.3, risk: 0.3 },
      { id: 'camp-woods', name: 'Through the camp', kind: 'flank',
        x: -150, y: PAD, z: -60, toX: 0, toZ: -46,
        description: 'Under the canopy on the south side, through the cook camp. Close quarters and no way to see far.',
        stealth: 0.6, speed: 0.5, risk: 0.55 },
    ],
    landmarks: [
      { name: 'Hangar', x: 0, y: PAD + 11, z: 60, prominence: 180 },
      { name: 'Control tower', x: TX, y: cabY + 3, z: TZ, prominence: 140 },
      { name: 'Radio mast', x: 62, y: PAD + 24, z: 40, prominence: 90 },
      { name: 'Cook shed', x: -25, y: PAD + 4, z: -52, prominence: 40 },
    ],
    garrison: [],
  };

  console.info(`[airstrip] ${rooms.length} rooms, ${lights.length} fixtures`);
  return { site, rooms, navLinks, lights };
}
