/**
 * First-person hands.
 *
 * OWNED BY: Weapon models / Animation.
 *
 * A weapon rendered on its own does not read as a weapon — it reads as a prop
 * hovering in front of the camera. Hands are what turn it into something being
 * *held*, and their absence is the loudest tell that a first-person view is
 * unfinished.
 *
 * ## What the first attempt got wrong
 * Fingers were modelled as three-segment chains, twelve of them, forty-five
 * meshes in total. At hip carry the weapon is 17% of the screen, so a finger
 * segment is roughly two pixels — all that detail resolved to noise. Worse, the
 * forearms were bare eight-sided cylinders 190 mm long and 60 mm across,
 * pointing back at the camera. Each was as large as the entire receiver, they
 * dominated the model's bounding box, and they read as floating pipes.
 *
 * ## What reads instead
 * The same thing low-poly game hands have always done: **the fingers are one
 * mass with grooves cut between them.** A silhouette with three notches in it
 * reads as fingers at any size; twelve separate boxes read as gravel. Only the
 * two fingers that are *doing* something — the trigger finger and the thumb —
 * are modelled separately, because those are the ones that carry the pose.
 *
 * Forearms are short, tapered, and aimed to leave frame rather than to end in
 * mid-air. A forearm you can see the end of is worse than no forearm at all.
 *
 * Same local space as the weapon: **-Z forward**, +Y up, +X right.
 */

import * as THREE from 'three';
import { PartBuilder, type MatKey } from './parts';

export interface HandOptions {
  /** Glove and sleeve materials — swapped per loadout later. */
  glove: MatKey;
  sleeve: MatKey;
  /**
   * True for the left hand. The sign convention is that `mirror` flips the
   * hand to **negative X**, so a mirrored hand and its forearm both end up on
   * the shooter's left. Getting this backwards put the support arm 152 mm out
   * to the *right* of the weapon, crossing the firing arm.
   */
  mirror: boolean;
}

/**
 * ## Why there are no fingers here
 *
 * Two implementations of a procedural finger curl were built and both were
 * geometrically wrong — the first curled the firing hand's fingers off the
 * front of the grip into thin air, the second swept the support hand's away
 * from the forend and upward. That is not a coincidence; a three-joint chain
 * rotated into place has four independent ways to be backwards and no way to
 * notice from the numbers.
 *
 * It also buys nothing. At hip carry the weapon is 17% of the screen, which
 * works out to 0.85 screen pixels per model millimetre. The support hand is
 * about 65 x 65 pixels; a 112-degree finger curl inside that is three or four
 * pixels of shape.
 *
 * What actually reads at that size is three things, and low-poly game hands
 * have used them for twenty years:
 *   1. a **notch** between the finger mass and the palm,
 *   2. the **thumb**, pointing somewhere deliberate,
 *   3. a hard, dark **knuckle plate** on the back of the glove.
 *
 * So each hand is five boxes. No curl, no joints, nothing that can be wrong.
 */

/**
 * Forearm: a tapered stub aimed out of frame.
 *
 * Deliberately short. It exists to say "this hand is attached to an arm" for
 * the 40 mm of it that is on screen, then to be gone. The cuff band at the
 * wrist is what sells the sleeve-over-glove transition.
 */
function forearm(
  b: PartBuilder, x: number, y: number, z: number,
  pitch: number, yaw: number, opt: HandOptions, segments = 3,
): void {
  // Sign check, because it is easy to get backwards and obvious once wrong:
  // the segments are laid out along +Z (behind the wrist), and rotating a
  // point at +Z about X by angle a sends it to y = -d*sin(a). So a POSITIVE
  // pitch drops the arm toward the shoulder. Negative sent both forearms up
  // and across the receiver, which is exactly what they were doing.
  const g = new THREE.Group();
  const sub = new PartBuilder();
  // Cuff — proud of both the glove and the sleeve, and a different value.
  sub.box(0.050, 0.046, 0.020, 'polymerBlack', 0, 0, 0.005);
  // Sleeve, tapering out toward the elbow. Three short segments rather than a
  // cylinder: the taper is the silhouette, and a cylinder has none.
  //
  // Kept small and short on purpose. The first pass ran 190 mm long and 74 mm
  // across, which at inspection scale read as two planks laid over the
  // receiver. A forearm's job here is to occupy the corner of the frame for
  // about 10 cm and then be gone.
  const steps = [
    { w: 0.052, h: 0.048, d: 0.040, z: 0.033 },
    { w: 0.058, h: 0.053, d: 0.042, z: 0.072 },
    { w: 0.063, h: 0.058, d: 0.040, z: 0.108 },
  ];
  for (const s of steps.slice(0, segments)) sub.box(s.w, s.h, s.d, opt.sleeve, 0, -s.z * 0.10, s.z);
  g.add(sub.group);
  g.position.set(x, y, z);
  g.rotation.set(pitch, yaw, 0);
  b.group.add(g);
  b.triangles += sub.triangles;
}

/**
 * Firing hand: wraps a pistol grip, trigger finger extended to the trigger.
 *
 * `gripX/Y/Z` is the top of the grip; `rake` matches the grip's own rake so
 * the hand sits on it rather than through it. `triggerZ` is where the trigger
 * finger reaches to.
 */
export function firingHand(
  b: PartBuilder, gripX: number, gripY: number, gripZ: number,
  rake: number, triggerZ: number, opt: HandOptions,
): void {
  const s = opt.mirror ? -1 : 1;
  const g = new THREE.Group();
  const sub = new PartBuilder();

  // Palm on the backstrap.
  sub.box(0.034, 0.078, 0.030, opt.glove, s * 0.004, -0.028, 0.020);
  // Finger mass wrapping the front strap. Centred on the weapon's own
  // centreline and matched to the grip's 34 mm width — offsetting it outboard
  // buried half the mass inside the grip and left the other half floating.
  sub.box(0.030, 0.066, 0.026, opt.glove, 0, -0.030, -0.020);
  // The notch. This single dark slot between palm and fingers is what makes
  // two boxes read as a hand; at 6 mm it is about five pixels at hip carry.
  sub.box(0.032, 0.070, 0.006, 'polymerBlack', 0, -0.029, -0.004);
  // Knuckle plate on the back of the hand.
  sub.box(0.034, 0.030, 0.008, 'polymerBlack', 0, -0.010, -0.032);
  // Web of the thumb, filling under the beavertail.
  sub.box(0.030, 0.026, 0.034, opt.glove, s * 0.003, 0.008, 0.014);

  // Trigger finger, reaching forward onto the blade. This was already landing
  // on the trigger correctly; it only needed to come inboard so it sits on the
  // blade rather than against the guard wall.
  const reach = Math.max(0.030, gripZ - triggerZ);
  sub.box(0.016, 0.016, reach * 0.74, opt.glove, s * 0.006, 0.004, -reach * 0.34);
  sub.box(0.015, 0.015, reach * 0.32, opt.glove, s * 0.006, -0.006, -reach * 0.84, 0.55);

  // Thumb over the top of the grip toward the far side.
  sub.box(0.016, 0.030, 0.020, opt.glove, s * -0.012, -0.002, 0.012, 0, 0, s * 0.70);

  g.add(sub.group);
  g.position.set(gripX, gripY, gripZ);
  g.rotation.x = rake;
  b.group.add(g);
  b.triangles += sub.triangles;

  // Forearm runs back, down and slightly outboard — the line from a firing
  // grip to the shoulder — and leaves frame within about 10 cm.
  forearm(b, gripX + s * 0.020, gripY - 0.066, gripZ + 0.024, 0.92, s * 0.26, opt, 3);
}

/**
 * Support hand: C-clamp on the forend, high and far forward.
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
  // 13 mm of glove between the palm's centre and the forend's face, so the
  // palm's inner surface actually touches it. At 20 mm the hand cleared the
  // handguard by five millimetres and held nothing.
  const off = radius + 0.013;

  // Palm slab down the near side of the forend. A modern support hand is
  // thumb-forward with the palm on the SIDE — the C-clamp — not cupped
  // underneath.
  sub.box(0.028, 0.056, 0.082, opt.glove, s * off, -0.004, 0);
  // Finger slab lying ACROSS the top of the forend and overhanging the far
  // side. The overhang is what makes it a clamp rather than a shelf.
  sub.box(0.044, 0.028, 0.072, opt.glove, s * (off - radius - 0.008), radius + 0.014, -0.004);
  // The notch between them.
  sub.box(0.032, 0.006, 0.074, 'polymerBlack', s * (off - 0.002), radius + 0.001, -0.004);
  // Thumb pointed forward along the handguard, at the target.
  sub.box(0.018, 0.018, 0.056, opt.glove, s * (off + 0.002), 0.010, -0.046);
  // Knuckle plate on the outboard face.
  sub.box(0.008, 0.044, 0.052, 'polymerBlack', s * (off + 0.016), 0.002, 0.002);

  g.add(sub.group);
  g.position.set(x, y, z);
  g.rotation.z = s * -cant;
  b.group.add(g);
  b.triangles += sub.triangles;

  // The support forearm gets ONE segment, not three.
  //
  // Its hand sits high and far forward, which leaves roughly 250 mm of screen
  // below it — enough for a full forearm to cross the entire lower frame and
  // terminate in a visible flat cut face. A stub that the magazine and grip
  // occlude reads as "the arm continues behind the weapon"; a full pipe reads
  // as a pipe.
  // The cuff has to sit AT the wrist. Placed 24 mm outboard and 48 mm down it
  // was a floating cube hanging under the handguard with a 44 mm gap between
  // it and the hand it belonged to.
  forearm(b, x + s * (radius + 0.015), y - 0.030, z + 0.046, 1.05, s * 0.46, opt, 1);
}
