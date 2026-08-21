/**
 * Weapon assembly.
 *
 * OWNED BY: Weapon models.
 *
 * Composes the parametric parts in parts.ts into a complete weapon. Any
 * `WeaponSpec` the arsenal invents gets a model, and fitting a different optic
 * or suppressor changes what is actually in the player's hands.
 *
 * Local space: **-Z is forward**, +Y up, +X right. The origin sits at the
 * trigger, so the whole weapon can be posed by where the shooting hand goes.
 *
 * Two outputs matter more than the geometry:
 *   `sightPoint` — the exact aiming axis. The viewmodel aligns ADS by moving
 *                  the weapon until this lands on the camera axis, which is
 *                  why every optic centres correctly with no per-optic tuning.
 *   `muzzleTip`  — where flash, smoke and tracers originate.
 */

import * as THREE from 'three';
import type { WeaponSpec, AttachmentSpec, AttachmentSlot } from '../core/contracts';
import {
  PartBuilder, boxGeo, cylGeo, taperGeo, MATERIALS,
  rail, mlokRow, pistolGrip, boxMagazine, collapsibleStock, fixedStock,
  redDot, scope, ironSights, suppressor, flashHider, muzzleBrake,
  type MatKey,
} from './parts';
import { firingHand, supportHand } from './hands';

export interface WeaponModel {
  group: THREE.Group;
  /** Hands, kept separate so a reload animation can move them alone. */
  hands: THREE.Group;
  sightPoint: THREE.Vector3;
  muzzleTip: THREE.Vector3;
  ejectionPort: THREE.Vector3;
  triangles: number;
}

/** Furniture colour per manufacturer, so weapon families read differently. */
const MAKE_FURNITURE: Record<string, MatKey> = {
  'Aldbrecht Werke': 'polymerBlack',
  'Cassara Arms': 'polymerBlack',
  'Volkov Proizvodstvo': 'wood',
  'Meridian Defence': 'polymerFde',
  'Halloran Ordnance': 'polymerBlack',
  'Tenshou Kikai': 'polymerOlive',
};

export function buildWeapon(
  spec: WeaponSpec,
  attachments: Partial<Record<AttachmentSlot, AttachmentSpec | undefined>>,
): WeaponModel {
  const b = new PartBuilder();
  const furniture = MAKE_FURNITURE[spec.make] ?? 'polymerBlack';
  const isPistol = spec.class === 'pistol';
  const barrelM = spec.barrelLengthMm / 1000;

  // Bore axis height above the origin. Everything aligns to this.
  const BORE = 0.055;

  if (isPistol) {
    return buildPistol(b, spec, attachments, furniture, BORE);
  }

  // =========================================================================
  // Long gun
  // =========================================================================
  const recLen = 0.30;
  const recFront = -0.14;
  const recBack = recFront + recLen;

  // --- lower receiver + magwell ------------------------------------------
  b.box(0.040, 0.052, recLen * 0.62, 'aluDark', 0, BORE - 0.030, recFront + recLen * 0.34);
  // Flared magwell.
  b.box(0.044, 0.030, 0.062, 'aluDark', 0, BORE - 0.048, recFront + 0.062);
  b.box(0.048, 0.010, 0.066, 'alu', 0, BORE - 0.064, recFront + 0.062);
  // Magazine release and bolt catch — small, but they say "this is a machine".
  b.box(0.008, 0.012, 0.012, 'parkerised', 0.023, BORE - 0.034, recFront + 0.070);
  b.box(0.006, 0.018, 0.020, 'parkerised', -0.023, BORE - 0.032, recFront + 0.076);
  // Selector switch on the left.
  b.cyl(0.008, 0.010, 'parkerised', -0.022, BORE - 0.020, recFront + 0.128, 8, 0, Math.PI / 2, 0);
  b.box(0.006, 0.020, 0.007, 'parkerised', -0.028, BORE - 0.024, recFront + 0.128, 0, 0, 0.5);
  // Trigger and guard.
  b.box(0.030, 0.007, 0.062, 'aluDark', 0, BORE - 0.062, recFront + 0.030);
  b.box(0.006, 0.020, 0.008, 'blued', 0, BORE - 0.050, recFront + 0.036, 0.25);

  // --- upper receiver -----------------------------------------------------
  b.box(0.042, 0.046, recLen * 0.94, 'parkerised', 0, BORE + 0.006, recFront + recLen * 0.47);
  // Ejection port: a raised lip and a hinged cover, on the right where the
  // player sees it when the weapon is canted.
  b.box(0.004, 0.026, 0.052, 'aluDark', 0.022, BORE + 0.006, recFront + 0.118);
  b.box(0.006, 0.024, 0.048, 'parkerised', 0.024, BORE + 0.004, recFront + 0.118, 0, 0, 0.06);
  // Brass deflector behind it.
  b.box(0.010, 0.016, 0.014, 'parkerised', 0.022, BORE + 0.018, recFront + 0.150, 0, 0, -0.4);
  // Forward assist.
  b.cyl(0.008, 0.018, 'parkerised', 0.022, BORE - 0.006, recFront + 0.160, 8, 0, Math.PI / 2, 0);
  // Charging handle at the rear with a latch.
  b.box(0.052, 0.010, 0.024, 'aluDark', 0, BORE + 0.028, recBack - 0.020);
  b.box(0.016, 0.008, 0.012, 'alu', -0.026, BORE + 0.028, recBack - 0.016);

  // --- top rail -----------------------------------------------------------
  const railY = BORE + 0.031;
  rail(b, 0, railY, recFront + recLen * 0.44, recLen * 0.90);

  // --- barrel -------------------------------------------------------------
  const barrelLen = Math.max(0.10, barrelM * 0.78);
  const barrelStart = recFront;
  b.cyl(0.0098, barrelLen, 'blued', 0, BORE, barrelStart - barrelLen / 2, 10);
  // Barrel nut where it meets the receiver.
  b.cyl(0.0165, 0.026, 'parkerised', 0, BORE, barrelStart - 0.013, 12);

  // --- handguard ----------------------------------------------------------
  const hgAtt = attachments.handguard;
  const longHg = hgAtt?.id === 'hg-mlok-long' || hgAtt?.id === 'hg-quad';
  const hgLen = Math.min(barrelLen - 0.05, longHg ? barrelLen * 0.86 : barrelLen * 0.58);
  const hgZ = barrelStart - 0.026 - hgLen / 2;
  const hgMat: MatKey = hgAtt?.id === 'hg-quad' ? 'aluDark' : furniture;

  if (hgLen > 0.04) {
    // Octagonal-ish tube: a box plus two chamfer strips reads far better than
    // a plain box at almost no cost.
    b.box(0.040, 0.042, hgLen, hgMat, 0, BORE, hgZ);
    b.box(0.050, 0.024, hgLen, hgMat, 0, BORE, hgZ);
    b.box(0.024, 0.050, hgLen, hgMat, 0, BORE, hgZ);

    if (hgAtt?.id === 'hg-quad') {
      rail(b, 0, BORE + 0.026, hgZ, hgLen * 0.94, 0.020);
      rail(b, 0, BORE - 0.026, hgZ, hgLen * 0.94, 0.020);
    } else {
      // M-LOK slots on the sides and underside.
      mlokRow(b, -0.026, BORE, hgZ - hgLen / 2, hgZ + hgLen / 2, 'polymerBlack', 'x');
      mlokRow(b, 0.026, BORE, hgZ - hgLen / 2, hgZ + hgLen / 2, 'polymerBlack', 'x');
      mlokRow(b, 0, BORE - 0.026, hgZ - hgLen / 2, hgZ + hgLen / 2, 'polymerBlack', 'y');
      // A short rail section at the front of the top face.
      rail(b, 0, BORE + 0.024, hgZ - hgLen * 0.32, hgLen * 0.30, 0.019);
    }
  }

  // --- gas block + front sight base ---------------------------------------
  const gasZ = barrelStart - hgLen - 0.040;
  b.box(0.026, 0.032, 0.030, 'parkerised', 0, BORE + 0.006, gasZ);
  b.cyl(0.006, hgLen * 0.5, 'blued', 0, BORE + 0.016, gasZ + hgLen * 0.25, 8); // gas tube

  // --- muzzle device ------------------------------------------------------
  const muz = attachments.muzzle;
  let muzzleZ = barrelStart - barrelLen;
  if (muz && muz.id !== 'muz-none') {
    if (muz.id.includes('supp')) {
      const canLen = muz.id.includes('heavy') ? 0.20 : 0.16;
      muzzleZ = suppressor(b, 0, BORE, muzzleZ, canLen);
    } else if (muz.id.includes('brake') || muz.id.includes('comp')) {
      muzzleZ = muzzleBrake(b, 0, BORE, muzzleZ);
    } else {
      muzzleZ = flashHider(b, 0, BORE, muzzleZ);
    }
  } else {
    // Bare crown so the bore still reads as a hole.
    b.add(taperGeo(0.0098, 0.0072, 0.010, 10), 'blued', 0, BORE, muzzleZ - 0.005);
    muzzleZ -= 0.010;
  }

  // --- grip ---------------------------------------------------------------
  pistolGrip(b, 0, BORE - 0.056, recFront + 0.100, furniture, 0.26);

  // --- stock --------------------------------------------------------------
  const stockAtt = attachments.stock;
  const stockId = stockAtt?.id ?? 'stock-collapsible';
  if (stockId === 'stock-fixed' || stockId === 'stock-precision') {
    fixedStock(b, 0, BORE - 0.006, recBack, 0.24, furniture);
    if (stockId === 'stock-precision') {
      b.box(0.030, 0.030, 0.075, furniture, 0, BORE + 0.040, recBack + 0.10);
    }
  } else if (stockId === 'stock-brace') {
    b.cyl(0.016, 0.10, 'parkerised', 0, BORE - 0.004, recBack + 0.05, 10);
    b.box(0.030, 0.052, 0.028, furniture, 0, BORE - 0.008, recBack + 0.105);
  } else {
    collapsibleStock(b, 0, BORE - 0.004, recBack, 0.20, furniture);
  }

  // --- magazine -----------------------------------------------------------
  const magId = attachments.magazine?.id ?? 'mag-std';
  const magZ = recFront + 0.062;
  const magY = BORE - 0.070;
  if (magId === 'mag-drum') {
    b.cyl(0.055, 0.034, 'polymerBlack', 0, magY - 0.052, magZ, 14, 0, Math.PI / 2, 0);
    b.cyl(0.050, 0.038, 'aluDark', 0, magY - 0.052, magZ, 14, 0, Math.PI / 2, 0);
    b.box(0.028, 0.048, 0.046, 'polymerBlack', 0, magY - 0.020, magZ);
  } else {
    const magLen = magId === 'mag-ext' ? 0.185 : magId === 'mag-short' ? 0.095 : 0.145;
    // Eastern-pattern cartridges use a strongly curved magazine.
    const curve = spec.caliber === '7.62x39' || spec.caliber === '5.45x39' ? 0.42 : 0.12;
    boxMagazine(b, 0, magY, magZ, magLen, curve, 'polymerBlack');
  }

  // --- optic --------------------------------------------------------------
  const optic = attachments.optic;
  let sightY: number;
  const opticZ = recFront + recLen * 0.52;
  if (optic?.optic && optic.id !== 'opt-iron') {
    const m = optic.optic.magnification;
    sightY = m > 1 ? scope(b, 0, railY + 0.003, opticZ, m) : redDot(b, 0, railY + 0.003, opticZ, optic.id.includes('holo'));
  } else {
    sightY = ironSights(b, 0, railY + 0.003, gasZ, recBack - 0.045);
  }

  // --- underbarrel --------------------------------------------------------
  const ub = attachments.underbarrel;
  if (ub && hgLen > 0.06) {
    const ubZ = hgZ - hgLen * 0.22;
    const ubY = BORE - 0.030;
    if (ub.id === 'grip-vert') {
      b.box(0.024, 0.070, 0.028, 'polymerBlack', 0, ubY - 0.035, ubZ, 0.05);
      b.box(0.028, 0.012, 0.032, 'polymerBlack', 0, ubY - 0.072, ubZ);
    } else if (ub.id === 'grip-angled') {
      b.box(0.024, 0.044, 0.052, 'polymerBlack', 0, ubY - 0.020, ubZ + 0.006, 0.60);
    } else if (ub.id === 'grip-handstop') {
      b.box(0.022, 0.020, 0.024, 'polymerBlack', 0, ubY - 0.010, ubZ, 0.22);
    } else if (ub.id === 'grip-bipod') {
      b.box(0.030, 0.024, 0.040, 'aluDark', 0, ubY - 0.010, ubZ);
      for (const s of [-1, 1]) {
        b.cyl(0.005, 0.105, 'parkerised', s * 0.030, ubY - 0.058, ubZ, 6, 0, 0, s * 0.42);
        b.box(0.014, 0.006, 0.020, 'rubber', s * 0.050, ubY - 0.106, ubZ);
      }
    }
  }

  // --- laser / light ------------------------------------------------------
  const las = attachments.laser;
  if (las && las.id !== 'las-none' && hgLen > 0.06) {
    const lz = hgZ - hgLen * 0.28;
    b.box(0.022, 0.022, 0.050, 'polymerBlack', 0.030, BORE + 0.008, lz);
    b.cyl(0.008, 0.006, las.id === 'las-light' ? 'glass' : 'reticle', 0.030, BORE + 0.008, lz - 0.027, 8);
    b.box(0.008, 0.010, 0.012, 'aluDark', 0.030, BORE + 0.008, lz + 0.028);
  }

  // --- sling points -------------------------------------------------------
  b.cyl(0.004, 0.014, 'aluDark', -0.022, BORE - 0.020, recBack - 0.010, 6, 0, Math.PI / 2, 0);

  // --- hands --------------------------------------------------------------
  // Built last and into their own group so they sit on top of the finished
  // weapon and can later be animated (reload, malfunction clearing) without
  // touching the gun. Their positions are derived from the grip and forend the
  // assembler actually produced, so a longer handguard moves the support hand.
  const hands = new PartBuilder();
  const gloves: MatKey = furniture === 'polymerFde' ? 'gloveTan' : 'glove';
  firingHand(hands, 0, BORE - 0.062, recFront + 0.104, 0.26, recFront + 0.030,
    { glove: gloves, sleeve: 'sleeve', mirror: false });
  if (hgLen > 0.05) {
    // Sit the support hand at the rear third of the handguard unless an
    // underbarrel grip is fitted, in which case it belongs behind it.
    const ubOffset = attachments.underbarrel ? 0.055 : 0.0;
    const supportZ = THREE.MathUtils.clamp(
      hgZ + hgLen * 0.06 + ubOffset, hgZ - hgLen * 0.42, hgZ + hgLen * 0.42);
    supportHand(hands, 0, BORE - 0.008, supportZ, 0.026, 0.16,
      { glove: gloves, sleeve: 'sleeve', mirror: true });
  }
  b.group.add(hands.group);
  b.triangles += hands.triangles;

  finalise(b);
  return {
    group: b.group,
    hands: hands.group,
    sightPoint: new THREE.Vector3(0, sightY, opticZ),
    muzzleTip: new THREE.Vector3(0, BORE, muzzleZ),
    ejectionPort: new THREE.Vector3(0.026, BORE + 0.006, recFront + 0.118),
    triangles: Math.round(b.triangles),
  };
}

// ===========================================================================
// Pistols — different enough in proportion to deserve their own assembler
// ===========================================================================

function buildPistol(
  b: PartBuilder,
  spec: WeaponSpec,
  attachments: Partial<Record<AttachmentSlot, AttachmentSpec | undefined>>,
  furniture: MatKey,
  BORE: number,
): WeaponModel {
  const slideLen = 0.185 + spec.barrelLengthMm / 4000;
  const slideZ = -slideLen / 2 + 0.03;

  // --- frame --------------------------------------------------------------
  b.box(0.030, 0.030, slideLen * 0.80, furniture, 0, BORE - 0.030, slideZ + 0.010);
  // Dust cover with an accessory rail.
  b.box(0.026, 0.018, slideLen * 0.34, furniture, 0, BORE - 0.030, slideZ - slideLen * 0.30);
  for (let i = 0; i < 3; i++) {
    b.box(0.028, 0.005, 0.008, 'polymerBlack', 0, BORE - 0.040, slideZ - slideLen * 0.22 - i * 0.015);
  }
  // Trigger guard: front strap, bow and rear post rather than a solid block.
  b.box(0.026, 0.008, 0.048, furniture, 0, BORE - 0.058, slideZ + 0.030);
  b.box(0.026, 0.030, 0.008, furniture, 0, BORE - 0.046, slideZ + 0.008);
  b.box(0.006, 0.022, 0.008, 'blued', 0, BORE - 0.044, slideZ + 0.030, 0.2);

  // --- slide --------------------------------------------------------------
  b.box(0.030, 0.034, slideLen, 'blued', 0, BORE + 0.004, slideZ);
  // Top chamfer.
  b.box(0.022, 0.040, slideLen, 'blued', 0, BORE + 0.004, slideZ);
  // Rear cocking serrations.
  for (let i = 0; i < 6; i++) {
    b.box(0.032, 0.026, 0.004, 'parkerised', 0, BORE + 0.004, slideZ + slideLen * 0.36 - i * 0.008);
  }
  // Front serrations.
  for (let i = 0; i < 4; i++) {
    b.box(0.032, 0.022, 0.004, 'parkerised', 0, BORE + 0.002, slideZ - slideLen * 0.34 + i * 0.008);
  }
  // Ejection port.
  b.box(0.005, 0.018, 0.036, 'aluDark', 0.015, BORE + 0.010, slideZ - 0.010);
  // Barrel hood peeking out of the port, and the muzzle crown.
  b.cyl(0.0095, 0.030, 'alu', 0, BORE + 0.008, slideZ - slideLen * 0.42, 10);

  // --- grip ---------------------------------------------------------------
  pistolGrip(b, 0, BORE - 0.044, slideZ + slideLen * 0.36, furniture, 0.30);
  // Magazine baseplate protruding.
  b.box(0.026, 0.012, 0.040, 'parkerised', 0, BORE - 0.152, slideZ + slideLen * 0.36 + 0.030, 0.30);
  // Slide stop and takedown lever on the left.
  b.box(0.005, 0.010, 0.030, 'parkerised', -0.017, BORE - 0.014, slideZ + 0.020);
  b.cyl(0.006, 0.008, 'parkerised', -0.017, BORE - 0.024, slideZ - 0.004, 8, 0, Math.PI / 2, 0);

  // --- muzzle -------------------------------------------------------------
  let muzzleZ = slideZ - slideLen / 2;
  const muz = attachments.muzzle;
  if (muz?.id.includes('supp')) {
    muzzleZ = suppressor(b, 0, BORE + 0.006, muzzleZ, 0.135);
  } else {
    b.add(taperGeo(0.0095, 0.0068, 0.008, 10), 'blued', 0, BORE + 0.006, muzzleZ - 0.004);
    muzzleZ -= 0.008;
  }

  // --- sights -------------------------------------------------------------
  const optic = attachments.optic;
  const railY = BORE + 0.022;
  let sightY: number;
  const opticZ = slideZ + slideLen * 0.22;
  if (optic?.optic && optic.id !== 'opt-iron') {
    sightY = redDot(b, 0, railY, opticZ, false);
  } else {
    // Blade front, notch rear.
    b.box(0.004, 0.009, 0.005, 'parkerised', 0, railY + 0.004, slideZ - slideLen * 0.42);
    b.box(0.006, 0.010, 0.006, 'parkerised', -0.008, railY + 0.005, slideZ + slideLen * 0.40);
    b.box(0.006, 0.010, 0.006, 'parkerised', 0.008, railY + 0.005, slideZ + slideLen * 0.40);
    sightY = railY + 0.008;
  }

  // --- hands --------------------------------------------------------------
  // A pistol is shot with both hands stacked on the grip, so the support hand
  // wraps the firing hand rather than the weapon.
  const hands = new PartBuilder();
  const gloves: MatKey = furniture === 'polymerFde' ? 'gloveTan' : 'glove';
  firingHand(hands, 0, BORE - 0.050, slideZ + slideLen * 0.36, 0.30, slideZ + 0.030,
    { glove: gloves, sleeve: 'sleeve', mirror: false });
  supportHand(hands, -0.004, BORE - 0.078, slideZ + slideLen * 0.34, 0.030, 0.42,
    { glove: gloves, sleeve: 'sleeve', mirror: true });
  b.group.add(hands.group);
  b.triangles += hands.triangles;

  finalise(b);
  return {
    group: b.group,
    hands: hands.group,
    sightPoint: new THREE.Vector3(0, sightY, opticZ),
    muzzleTip: new THREE.Vector3(0, BORE + 0.006, muzzleZ),
    ejectionPort: new THREE.Vector3(0.017, BORE + 0.010, slideZ - 0.010),
    triangles: Math.round(b.triangles),
  };
}

function finalise(b: PartBuilder): void {
  b.group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
      // Drawn in its own pass with a cleared depth buffer, so it can never be
      // culled against world geometry.
      o.frustumCulled = false;
    }
  });
}

export function disposeWeaponGeometry(): void {
  for (const m of Object.values(MATERIALS)) m.dispose();
}
