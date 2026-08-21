/**
 * First-person hands.
 *
 * OWNED BY: Weapon models / Animation.
 *
 * A weapon rendered on its own does not read as a weapon — it reads as a prop
 * hovering in front of the camera. Hands are what turn it into something being
 * *held*, and their absence is the single loudest tell that a first-person
 * view is unfinished. Every shooter has them for that reason.
 *
 * They are built parametrically from a grip point and an approach direction,
 * so they follow the weapon rather than being posed per weapon: the firing
 * hand wraps the pistol grip with the trigger finger reaching to the trigger,
 * the support hand wraps whatever the forend turns out to be. Fit a longer
 * handguard and the support hand moves with it.
 *
 * Same local space as the weapon: **-Z forward**, +Y up, +X right.
 */

import * as THREE from 'three';
import { PartBuilder, boxGeo, cylGeo, type MatKey } from './parts';

/**
 * Finger chain.
 *
 * Three phalanges with progressive curl. Modelling the joints rather than
 * bending one long box is what stops a hand reading as a mitten — the
 * knuckle line is most of what the eye uses to recognise a hand at all.
 *
 * `curl` is the total wrap in radians; `side` flips it for the far hand.
 */
function finger(
  b: PartBuilder, x: number, y: number, z: number,
  length: number, thickness: number, curl: number, mat: MatKey, axis: 'x' | 'z',
): void {
  const seg = [0.42, 0.33, 0.25];
  const g = new THREE.Group();
  const sub = new PartBuilder();
  let cx = 0, cy = 0, angle = 0;
  for (let i = 0; i < 3; i++) {
    const len = length * seg[i];
    // Each joint takes a larger share of the curl than the last, which is how
    // a real hand closes: the distal joints do most of the wrapping.
    angle += curl * [0.30, 0.38, 0.32][i];
    const t = thickness * (1 - i * 0.13);
    const hx = cx + Math.sin(angle) * len * 0.5;
    const hy = cy - Math.cos(angle) * len * 0.5;
    if (axis === 'z') sub.box(t, len, t * 0.92, mat, hx, hy, 0, 0, 0, -angle);
    else sub.box(t * 0.92, len, t, mat, 0, hy, hx, angle, 0, 0);
    cx += Math.sin(angle) * len;
    cy -= Math.cos(angle) * len;
    // Knuckle: a slightly proud cube at each joint.
    if (i < 2) {
      if (axis === 'z') sub.box(t * 1.08, t * 0.72, t * 1.0, mat, cx, cy, 0, 0, 0, -angle);
      else sub.box(t * 1.0, t * 0.72, t * 1.08, mat, 0, cy, cx, angle, 0, 0);
    }
  }
  g.add(sub.group);
  g.position.set(x, y, z);
  b.group.add(g);
  b.triangles += sub.triangles;
}

export interface HandOptions {
  /** Glove and sleeve materials — swapped per loadout later. */
  glove: MatKey;
  sleeve: MatKey;
  /** Mirror for the left hand. */
  mirror: boolean;
}

/**
 * Firing hand: wraps a pistol grip, trigger finger extended forward.
 *
 * `gripX/Y/Z` is the centre of the grip; `rake` matches the grip's own rake so
 * the hand sits on it rather than through it.
 */
export function firingHand(
  b: PartBuilder, gripX: number, gripY: number, gripZ: number,
  rake: number, triggerZ: number, opt: HandOptions,
): void {
  const s = opt.mirror ? -1 : 1;
  const g = new THREE.Group();
  const sub = new PartBuilder();

  // Palm, wrapped around the back of the grip.
  sub.box(0.030, 0.088, 0.030, opt.glove, s * 0.026, -0.020, 0.004);
  // Web of the thumb, filling the gap behind the grip's beavertail.
  sub.box(0.026, 0.034, 0.036, opt.glove, s * 0.021, 0.012, 0.014);
  // Back-of-hand knuckle guard — the hard plate every operator glove has, and
  // a strong readability cue at a glance.
  sub.box(0.032, 0.044, 0.006, 'polymerBlack', s * 0.030, -0.006, -0.016);

  // Three wrapping fingers on the front strap. The index is handled below.
  for (let i = 0; i < 3; i++) {
    finger(sub, s * 0.020, -0.014 - i * 0.021, -0.020,
      0.052, 0.0125, 1.85 + i * 0.06, opt.glove, 'z');
  }

  // Trigger finger: reaches forward to the trigger rather than curling with
  // the others, which is what makes the hand look like it is *operating* the
  // weapon instead of just gripping it.
  const reach = triggerZ - gripZ;
  sub.box(0.013, 0.013, 0.030, opt.glove, s * 0.020, 0.008, reach * 0.45);
  sub.box(0.012, 0.013, 0.022, opt.glove, s * 0.020, 0.001, reach * 0.92, 0.42);

  // Thumb, over the top of the grip on the far side.
  sub.box(0.013, 0.030, 0.014, opt.glove, s * -0.006, 0.006, 0.016, 0, 0, s * 0.55);
  sub.box(0.012, 0.024, 0.013, opt.glove, s * -0.014, -0.014, 0.008, 0, 0, s * 1.1);

  // Cuff and forearm, running back and down out of frame.
  sub.box(0.044, 0.046, 0.030, opt.glove, s * 0.028, -0.062, 0.020);
  sub.add(cylGeo(0.030, 0.20, 8), opt.sleeve, s * 0.036, -0.108, 0.086, -1.05, 0, s * 0.18);

  g.add(sub.group);
  g.position.set(gripX, gripY, gripZ);
  g.rotation.x = rake;
  b.group.add(g);
  b.triangles += sub.triangles;
}

/**
 * Support hand: wraps the forend from below and slightly forward.
 *
 * `radius` is the half-thickness of whatever it is holding, so the fingers
 * close around a slim M-LOK tube and a fat quad rail alike.
 */
export function supportHand(
  b: PartBuilder, x: number, y: number, z: number,
  radius: number, cant: number, opt: HandOptions,
): void {
  const s = opt.mirror ? -1 : 1;
  const g = new THREE.Group();
  const sub = new PartBuilder();

  // Palm along the underside of the forend.
  sub.box(0.028, 0.026, 0.078, opt.glove, s * -(radius + 0.014), -0.006, 0.006);
  // Heel of the hand, thicker where it meets the wrist.
  sub.box(0.032, 0.032, 0.034, opt.glove, s * -(radius + 0.016), -0.014, 0.040);
  sub.box(0.030, 0.040, 0.006, 'polymerBlack', s * -(radius + 0.026), -0.004, 0.002);

  // Four fingers reaching over the top of the forend, splayed along it. The
  // support hand on a modern carbine is high and far forward — that is the
  // C-clamp everyone shoots with, and it is instantly recognisable.
  for (let i = 0; i < 4; i++) {
    finger(sub, s * -(radius + 0.008), 0.012, -0.026 + i * 0.021,
      0.050, 0.0125, 2.05 - i * 0.10, opt.glove, 'x');
  }
  // Thumb laid forward along the near side, pointing at the target.
  sub.box(0.014, 0.014, 0.042, opt.glove, s * -(radius + 0.012), 0.004, -0.026, 0, 0, 0);

  // Wrist and forearm, angled down and back toward the shoulder.
  sub.add(cylGeo(0.029, 0.19, 8), opt.sleeve,
    s * -(radius + 0.030), -0.048, 0.096, -0.92, s * -0.30, 0);

  g.add(sub.group);
  g.position.set(x, y, z);
  g.rotation.z = s * cant;
  b.group.add(g);
  b.triangles += sub.triangles;
}

/** Bare-box hand geometry cache warm-up — keeps the first equip hitch small. */
export function warmHandGeometry(): void {
  boxGeo(0.030, 0.088, 0.030);
  cylGeo(0.030, 0.20, 8);
}
