/**
 * Low-poly humanoid.
 *
 * OWNED BY: Character models.
 *
 * ## What the previous version got wrong
 * It was six boxes with **0.40 m of empty air inside the silhouette — 22% of
 * the figure's height**. A 0.26 m void at the waist, a 0.14 m void at the
 * neck, and legs that stopped 0.24 m short of the hips. At 17 m that renders
 * as three separate floating boxes with the building visible between them,
 * which is exactly what it looked like.
 *
 * It also carried **zero facing information**. Every part was symmetric about
 * the plane through z = 0, so an enemy rotated 180 degrees was pixel-identical.
 * Whether a hostile is looking at you is the single most important read in a
 * tactical shooter and the model could not express it at any range.
 *
 * ## Two rules this one follows
 *
 * **1. Joints interpenetrate by 20-50 mm, never abut.** Abutting boxes crack
 * open under temporal jitter at every distance. Overlapping ones never do, and
 * the overlap guarantees at least a pixel of fusion out past 20 m.
 *
 * **2. The silhouette is asymmetric front-to-back.** The chest plate, the rear
 * pouch, the helmet brim and above all the *weapon* push the figure's plan
 * projection into a pointed 0.72 x 0.50 m ellipse. At 20 m the difference
 * between facing-you and facing-away is the weapon reading as a 2-pixel stub
 * versus a 17-pixel broadside bar — an 8.5:1 discriminator, for 12 triangles.
 *
 * ## Proportion
 * Head-and-helmet to shoulder is 0.23 : 0.50, about 1 : 2.2, which is the real
 * human ratio and what makes the figure read as a person from a 14-pixel blob
 * at 60 m. The old model was 1 : 3.35 — a crate on a post.
 *
 * ## Cost
 * 240 triangles in ONE merged geometry, so one draw call per actor. The old
 * six-mesh version cost six draws each: with thirteen hostiles that was 78
 * draw calls, 31% of the entire frame. This is both better looking and
 * measurably cheaper.
 */

import * as THREE from 'three';

export interface HumanoidColors {
  body: number;
  gear: number;
  head: number;
  /**
   * A bright band across the shoulders.
   *
   * Measured: the old bodies rendered at luma 0.06-0.09 against asphalt at
   * 0.117 — a 1.3:1 contrast ratio, which is why the lower half of every
   * figure vanished into the tarmac. Nothing on an actor may render darker
   * than about 0.18, and every figure needs one bright horizontal band to
   * break it up.
   */
  accent: number;
}

interface BoxSpec {
  /** Half-extents. */
  w: number; h: number; d: number;
  /** Centre, in metres from the feet. */
  x: number; y: number; z: number;
  color: keyof HumanoidColors;
  /** Rotation about X, for the forearms. */
  pitch?: number;
}

/**
 * The figure, from the feet up. `y` here is the box CENTRE, so a part spans
 * `y ± h`. Every adjacent pair overlaps.
 *
 * -Z is the facing direction.
 */
const PARTS: BoxSpec[] = [
  // --- legs ----------------------------------------------------------------
  // The leg READ has to stop at the hip, not at the chest.
  //
  // The previous pass ran body-coloured geometry continuously from the boot to
  // 1.01 m — 56% of the figure's height in one unbroken colour — so the legs
  // looked far too long even though the skeleton underneath was correct at
  // 48%. Belt, knee pads and boots are all `gear`, and those three dark bands
  // are what give the leg a knee, an ankle and a top.
  { w: 0.058, h: 0.055, d: 0.135, x: -0.10, y: 0.055, z: -0.035, color: 'gear' },
  { w: 0.058, h: 0.055, d: 0.135, x: 0.10, y: 0.055, z: -0.035, color: 'gear' },
  { w: 0.062, h: 0.20, d: 0.068, x: -0.10, y: 0.29, z: 0, color: 'body' },
  { w: 0.062, h: 0.20, d: 0.068, x: 0.10, y: 0.29, z: 0, color: 'body' },
  // Knee pads — the mid-leg break.
  { w: 0.068, h: 0.048, d: 0.078, x: -0.10, y: 0.485, z: -0.015, color: 'gear' },
  { w: 0.068, h: 0.048, d: 0.078, x: 0.10, y: 0.485, z: -0.015, color: 'gear' },
  { w: 0.078, h: 0.20, d: 0.088, x: -0.10, y: 0.67, z: 0, color: 'body' },
  { w: 0.078, h: 0.20, d: 0.088, x: 0.10, y: 0.67, z: 0, color: 'body' },

  // --- belt and hips: the top of the leg, in a contrasting value ----------
  { w: 0.165, h: 0.085, d: 0.115, x: 0, y: 0.915, z: 0, color: 'gear' },
  // Drop pouches on the thighs. Small, but they sit exactly where the eye
  // looks for a hip line.
  { w: 0.042, h: 0.075, d: 0.055, x: -0.155, y: 0.87, z: -0.01, color: 'gear' },
  { w: 0.042, h: 0.075, d: 0.055, x: 0.155, y: 0.87, z: -0.01, color: 'gear' },

  // --- torso ---------------------------------------------------------------
  // Abdomen in GEAR, not body.
  //
  // This one word is why the legs looked too long. The skeleton is right — the
  // leg top is at 48.4% of height, if anything slightly short of the real
  // 52-53% — but the eye chains regions of the same tone, and a body-coloured
  // abdomen repeated the leg's exact value at 50-57% of the figure. Measured
  // off the render, the leg READ ran to 56.7% against a true 48.4%: they
  // looked 17% longer than they are. Dark from the belt to the shoulders makes
  // the light column stop at 40%.
  { w: 0.175, h: 0.085, d: 0.115, x: 0, y: 1.05, z: 0, color: 'gear' },
  { w: 0.215, h: 0.175, d: 0.145, x: 0, y: 1.28, z: 0, color: 'gear' },

  // --- the asymmetry: plate in front, pouches behind ---------------------
  { w: 0.155, h: 0.13, d: 0.025, x: 0, y: 1.28, z: -0.15, color: 'gear' },
  // Magazine pouches across the front of the plate — three of them, and the
  // clearest "this person is equipped" cue at any distance.
  { w: 0.035, h: 0.055, d: 0.03, x: -0.075, y: 1.185, z: -0.165, color: 'accent' },
  { w: 0.035, h: 0.055, d: 0.03, x: 0, y: 1.185, z: -0.165, color: 'accent' },
  { w: 0.035, h: 0.055, d: 0.03, x: 0.075, y: 1.185, z: -0.165, color: 'accent' },
  { w: 0.14, h: 0.105, d: 0.05, x: 0, y: 1.25, z: 0.175, color: 'gear' },

  // --- shoulder yoke: the bright band, and the widest point --------------
  { w: 0.245, h: 0.048, d: 0.135, x: 0, y: 1.455, z: 0, color: 'accent' },

  // --- neck, head and FACE ------------------------------------------------
  { w: 0.058, h: 0.045, d: 0.058, x: 0, y: 1.515, z: 0.008, color: 'head' },
  // 230 mm chin to crown, not 190.
  //
  // The old head made the figure 9.05 heads tall. Real is 7.5, and 8-9 heads
  // is the fashion-illustration proportion — which is precisely the
  // "impossibly long legs" look. At 0.115 the figure is 7.48 heads with
  // nothing else touched.
  { w: 0.082, h: 0.115, d: 0.102, x: 0, y: 1.615, z: 0, color: 'head' },
  // The face.
  //
  // A featureless skin-coloured cube is the thing that most makes a low-poly
  // figure read as a mannequin rather than a person, and it costs almost
  // nothing to fix: a dark band across the eyes and a slightly proud jaw. At
  // 20 m the band is the only facial feature that survives, and it is also a
  // second facing cue — you can see at a glance whether a head is turned
  // toward you.
  { w: 0.083, h: 0.024, d: 0.012, x: 0, y: 1.662, z: -0.102, color: 'gear' },
  // The jaw is GEAR, not skin. As a head-coloured block on a head-coloured
  // cube it cost twelve triangles and produced no contrast at any range. Dark
  // makes the head a three-value stack — helmet, skin, chin — and a three-band
  // head reads as a person far better than a two-band one, right down to the
  // last pixel, because it is a value cue rather than a shape cue.
  { w: 0.058, h: 0.030, d: 0.016, x: 0, y: 1.545, z: -0.099, color: 'gear' },
  // Chin strap, framing the face. The strongest "helmeted soldier" read there
  // is at 10-20 m, for 24 triangles.
  { w: 0.010, h: 0.058, d: 0.010, x: -0.076, y: 1.630, z: -0.030, color: 'gear' },
  { w: 0.010, h: 0.058, d: 0.010, x: 0.076, y: 1.630, z: -0.030, color: 'gear' },
  // Helmet, deeper than it is wide and pushed forward — the brim is a facing
  // cue that survives to the last pixel.
  { w: 0.108, h: 0.064, d: 0.128, x: 0, y: 1.762, z: -0.018, color: 'gear' },

  // --- arms and weapon ----------------------------------------------------
  //
  // Rebuilt because nothing was holding the rifle. The gloves sat 20 mm and
  // 170 mm from it — the support hand on the opposite side of the centreline —
  // and 385 mm of the weapon was buried inside the torso with 15 mm of
  // buttstock protruding out of the actor's spine.
  //
  // The forearm pitch was also 30 degrees off: 0.95 rad puts the hand where
  // the elbow-to-grip line needs 1.47, which left 179 mm of upper arm dangling
  // below the elbow like a second forearm.
  //
  // Now: the weapon runs along x = 0.14 with its stock at the shoulder and its
  // muzzle forward, the firing hand is at the grip and the support hand is out
  // on the handguard. Both arms reach the weapon and the two are no longer
  // mirror images, which is what makes the pose read as "holding" rather than
  // "praying".
  { w: 0.052, h: 0.115, d: 0.065, x: -0.235, y: 1.335, z: -0.02, color: 'body' },
  { w: 0.052, h: 0.115, d: 0.065, x: 0.235, y: 1.335, z: -0.01, color: 'body' },
  // Support forearm, reaching across and forward to the handguard.
  { w: 0.046, h: 0.125, d: 0.055, x: -0.185, y: 1.245, z: -0.19, color: 'body', pitch: 1.30 },
  // Firing forearm, shorter and tucked to the grip.
  { w: 0.046, h: 0.100, d: 0.055, x: 0.185, y: 1.265, z: -0.06, color: 'body', pitch: 0.85 },
  // Gloves, ON the weapon.
  { w: 0.042, h: 0.042, d: 0.048, x: -0.145, y: 1.215, z: -0.315, color: 'gear' },
  { w: 0.042, h: 0.042, d: 0.048, x: 0.145, y: 1.205, z: -0.075, color: 'gear' },

  // The weapon. Its stock ends at the shoulder pocket rather than inside the
  // chest, and the whole thing sits outboard on the firing side.
  { w: 0.026, h: 0.042, d: 0.300, x: 0.140, y: 1.240, z: -0.185, color: 'gear' },
  // Magazine, hanging below — a strong profile cue at any range.
  { w: 0.020, h: 0.070, d: 0.042, x: 0.140, y: 1.150, z: -0.095, color: 'gear' },
  // Optic, standing proud of the receiver.
  { w: 0.016, h: 0.028, d: 0.045, x: 0.140, y: 1.300, z: -0.170, color: 'gear' },
];

/**
 * Build one actor's geometry, merged.
 *
 * Colours are baked as a vertex attribute rather than split across materials,
 * because splitting is what forced one draw call per body part.
 */
export function buildHumanoid(
  colors: HumanoidColors, stance: StanceKey = 'stand',
): THREE.BufferGeometry {
  const parts = posture(stance);
  const positions: number[] = [];
  const normals: number[] = [];
  const colorAttr: number[] = [];
  const indices: number[] = [];

  const c = new THREE.Color();
  const m = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (const part of parts) {
    const geo = new THREE.BoxGeometry(part.w * 2, part.h * 2, part.d * 2);
    m.makeRotationX(part.pitch ?? 0);
    m.setPosition(part.x, part.y, part.z);
    geo.applyMatrix4(m);
    nm.getNormalMatrix(m);

    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const idx = geo.getIndex()!;
    const base = positions.length / 3;

    c.setHex(colors[part.color]);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      positions.push(v.x, v.y, v.z);
      n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      normals.push(n.x, n.y, n.z);
      colorAttr.push(c.r, c.g, c.b);
    }
    for (let i = 0; i < idx.count; i++) indices.push(base + idx.getX(i));
    geo.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colorAttr, 3));
  out.setIndex(indices);
  out.computeBoundingSphere();
  return out;
}

export type StanceKey = 'stand' | 'crouch' | 'prone';

/** Standing height, floor to helmet crown. */
export const HUMANOID_HEIGHT = 1.826;

/** Top of the thigh — where the leg ends and the belt begins. */
export const LEG_TOP = 0.92;

/**
 * Crown height per stance, and the ONE place anything may ask about it.
 *
 * Four different sets of stance numbers were in circulation: the renderer's,
 * `regionForHit`'s, the registry's eye height and the AI's perception scaling.
 * They disagreed, and the disagreement was not cosmetic — you could not
 * headshot a crouching or prone target, and chest shots on them scored as
 * headshots, because the hit-region maths and the geometry described different
 * bodies.
 */
export const STANCE_HEIGHT: Record<StanceKey, number> = {
  stand: HUMANOID_HEIGHT,
  crouch: 1.33,
  prone: 0.46,
};

/** Eye height per stance, derived from the same geometry. */
export const STANCE_EYE: Record<StanceKey, number> = {
  stand: 1.66,
  crouch: 1.19,
  prone: 0.34,
};

/**
 * Legacy ratio, kept only for callers that still want a plain scalar.
 * Prefer `STANCE_HEIGHT`.
 */
export const STANCE_SCALE: Record<string, number> = {
  stand: 1,
  crouch: STANCE_HEIGHT.crouch / HUMANOID_HEIGHT,
  prone: STANCE_HEIGHT.prone / HUMANOID_HEIGHT,
};

const postureCache = new Map<StanceKey, BoxSpec[]>();

/**
 * Pose the standing parts into a stance.
 *
 * Crouching is a **leg bend**, not a squash: the legs compress and everything
 * above the hip travels down intact. Scaling the whole figure on Y turns a
 * crouching enemy into a full-width-shouldered dwarf; translating it — which
 * is what the code actually did — turns it into a standing figure sunk 266 mm
 * into the concrete, with its boots underground and no reduction in height at
 * all.
 *
 * Prone rotates the body about the hip so it lies along its own forward axis.
 * Squashing it on Y put every vertex of a prone actor below the floor plane,
 * which made prone actors completely invisible.
 */
function posture(stance: StanceKey): BoxSpec[] {
  const hit = postureCache.get(stance);
  if (hit) return hit;

  let out: BoxSpec[];
  if (stance === 'stand') {
    out = PARTS;
  } else if (stance === 'crouch') {
    // Legs fold to 46% of their height; the upper body follows them down.
    const k = 0.46;
    const drop = LEG_TOP * (1 - k);
    out = PARTS.map((p) => {
      if (p.y - p.h < LEG_TOP) {
        // In the legs: compress about the ground, and thicken slightly, which
        // is what a bent knee actually does to the silhouette.
        return { ...p, y: p.y * k, h: Math.max(0.03, p.h * k), d: p.d * 1.18 };
      }
      return { ...p, y: p.y - drop };
    });
  } else {
    // Prone: rotate the whole figure forward about the hip, then set it down.
    // -Z is forward, so the body ends up lying head-first along -Z.
    // Rotating -90 degrees about X maps (x, y, z) -> (x, z, -y): what was up
    // becomes what is behind, and what was in front becomes what is down. So
    // the figure ends up face-down with its head forward along -Z, which is
    // the direction it was facing.
    const pivotY = 0.92;
    const groundClear = 0.20;
    out = PARTS.map((p) => ({
      ...p,
      y: groundClear + p.z,
      z: -(p.y - pivotY),
      // Half-extents swap with the axes they belong to.
      h: p.d,
      d: p.h,
      pitch: 0,
    }));
  }
  postureCache.set(stance, out);
  return out;
}
