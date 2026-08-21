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

/**
 * Layout overrides, keyed by weapon id.
 *
 * The assembler is parametric off the spec, but two things cannot be derived
 * from statistics: whether the action sits behind the trigger, and whether the
 * weapon feeds from a tube instead of a box. Both change the silhouette
 * completely, so they are declared.
 */
const BULLPUP = new Set(['md-bp5']);
const TUBE_FED = new Set(['ho-m590', 'md-b12']);

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

  // Layout, not class. A bullpup and a pump shotgun differ from a conventional
  // rifle in where the magazine and the grip sit relative to the action, which
  // changes the silhouette far more than any statistic does.
  const bullpup = BULLPUP.has(spec.id);
  const pumpTube = TUBE_FED.has(spec.id);

  // =========================================================================
  // Long gun
  // =========================================================================
  // 215 mm, not 300. A real AR receiver set is 197 mm; at 300 it ate 85 mm
  // that belongs to the barrel and gas system, which is why the weapon read as
  // a long slab with a stubby nose while still measuring the right overall
  // length. Five other landmarks derive from this, and all five were wrong in
  // the same direction: the rail carried 26 slots instead of 19, the forward
  // assist sat 122 mm from the rear face instead of 42, and the ejection port
  // sat at 42% along the receiver instead of 58%.
  const recLen = 0.215;
  const recFront = -0.14;
  const recBack = recFront + recLen;

  // --- lower receiver + magwell ------------------------------------------
  // Widths here were 60-70% oversize across the board. The tell is the rail:
  // a 21 mm Picatinny on a 42 mm receiver leaves a 10.5 mm deck on each side,
  // where a real AR leaves 2.1 mm. That is why the rail read as a ladder
  // sitting on a plinth rather than as the top of the receiver.
  b.box(0.026, 0.050, recLen * 0.66, 'aluDark', 0, BORE - 0.030, recFront + recLen * 0.34);
  // Flared magwell.
  b.box(0.032, 0.030, 0.062, 'aluDark', 0, BORE - 0.048, recFront + 0.062);
  // Magwell lip: aluDark, not alu. A 48 x 66 mm plate of the brightest
  // material on the model read as a chrome tray bolted under the receiver.
  b.box(0.036, 0.010, 0.066, 'aluDark', 0, BORE - 0.064, recFront + 0.062);
  // Magazine release and bolt catch — small, but they say "this is a machine".
  b.box(0.008, 0.012, 0.012, 'parkerised', 0.016, BORE - 0.034, recFront + 0.070);
  b.box(0.006, 0.018, 0.020, 'parkerised', -0.016, BORE - 0.032, recFront + 0.076);
  // Selector switch on the left.
  b.cyl(0.008, 0.010, 'parkerised', -0.015, BORE - 0.020, recFront + 0.118, 8, 0, Math.PI / 2, 0);
  b.box(0.006, 0.020, 0.007, 'parkerised', -0.021, BORE - 0.024, recFront + 0.118, 0, 0, 0.5);
  // Trigger guard, as a real loop: front strap, bow and rear post. It was a
  // flat 30 x 62 mm shelf floating 2.5 mm below the receiver, attached to
  // nothing along its front third — and the open loop of a trigger guard is a
  // strong silhouette cue that a shelf does not give you.
  b.box(0.020, 0.007, 0.054, 'aluDark', 0, BORE - 0.058, recFront + 0.030);
  b.box(0.020, 0.030, 0.007, 'aluDark', 0, BORE - 0.044, recFront + 0.004);
  b.box(0.020, 0.020, 0.007, 'aluDark', 0, BORE - 0.038, recFront + 0.056);
  b.box(0.006, 0.020, 0.008, 'blued', 0, BORE - 0.046, recFront + 0.036, 0.25);

  // --- upper receiver -----------------------------------------------------
  b.box(0.028, 0.042, recLen * 0.94, 'parkerised', 0, BORE + 0.008, recFront + recLen * 0.47);
  // Upper/lower takedown line. Twelve triangles for a 170-pixel feature — the
  // single most recognisable thing about an AR receiver group, and previously
  // absent: the upper's underside sat 13 mm inside the lower with no seam at
  // all, so the two read as one extruded block.
  b.box(0.030, 0.003, recLen * 0.90, 'polymerBlack', 0, BORE - 0.013, recFront + recLen * 0.47);
  // Ejection port: a raised lip and a hinged cover, on the right where the
  // player sees it when the weapon is canted.
  b.box(0.004, 0.024, 0.048, 'aluDark', 0.015, BORE + 0.008, recFront + 0.124);
  b.box(0.006, 0.022, 0.044, 'parkerised', 0.017, BORE + 0.006, recFront + 0.124, 0, 0, 0.06);
  // Brass deflector behind it.
  b.box(0.010, 0.016, 0.014, 'parkerised', 0.015, BORE + 0.020, recFront + 0.152, 0, 0, -0.4);
  // Forward assist.
  b.cyl(0.008, 0.018, 'parkerised', 0.015, BORE - 0.004, recFront + 0.170, 8, 0, Math.PI / 2, 0);
  // Charging handle at the rear with a latch.
  b.box(0.046, 0.010, 0.024, 'aluDark', 0, BORE + 0.030, recBack - 0.018);
  b.box(0.016, 0.008, 0.012, 'alu', -0.023, BORE + 0.030, recBack - 0.014);

  // --- top rail -----------------------------------------------------------
  const railY = BORE + 0.031;
  rail(b, 0, railY, recFront + recLen * 0.44, recLen * 0.90);

  // --- barrel -------------------------------------------------------------
  // 0.92, not 0.78. With the receiver corrected to its real 215 mm the weapon
  // came out 735 mm overall against a real carbine's 783; the missing length
  // belongs to the barrel, which had only 95 mm of it exposed forward of the
  // handguard against a real 175. This puts exposed barrel at 173 mm and total
  // length at 786 mm.
  const barrelLen = Math.max(0.10, barrelM * 0.92);
  const barrelStart = recFront;
  b.cyl(0.0098, barrelLen, 'blued', 0, BORE, barrelStart - barrelLen / 2, 10);
  // Barrel nut where it meets the receiver.
  b.cyl(0.0165, 0.026, 'parkerised', 0, BORE, barrelStart - 0.013, 12);

  // --- handguard ----------------------------------------------------------
  const hgAtt = attachments.handguard;
  const longHg = hgAtt?.id === 'hg-mlok-long' || hgAtt?.id === 'hg-quad';
  const hgLen = Math.min(barrelLen - 0.05, longHg ? barrelLen * 0.86 : barrelLen * 0.58);
  // Butted straight against the receiver. The 26 mm setback left the barrel
  // nut exposed between handguard and receiver — a free-float handguard covers
  // the nut, and the gap was breaking the weapon's top line in two.
  const hgZ = barrelStart - hgLen / 2;
  const hgMat: MatKey = hgAtt?.id === 'hg-quad' ? 'aluDark' : furniture;

  // A pump gun has no free-float handguard and no gas system: the sliding
  // forend below is the only thing the support hand touches, and the barrel
  // above it is bare.
  if (hgLen > 0.04 && !pumpTube) {
    // Octagonal-ish tube: a box plus two chamfer strips reads far better than
    // a plain box at almost no cost. Narrowed to match the corrected receiver
    // — at 50 mm across against a 21 mm rail the handguard was 39% oversize.
    b.box(0.030, 0.034, hgLen, hgMat, 0, BORE, hgZ);
    b.box(0.038, 0.020, hgLen, hgMat, 0, BORE, hgZ);
    // The tall box supports the rail, so its top must reach railY.
    b.box(0.020, 0.048, hgLen, hgMat, 0, BORE + 0.004, hgZ);

    if (hgAtt?.id === 'hg-quad') {
      rail(b, 0, BORE + 0.026, hgZ, hgLen * 0.96, 0.020);
      rail(b, 0, BORE - 0.026, hgZ, hgLen * 0.96, 0.020);
    } else {
      // M-LOK slots on the sides and underside.
      mlokRow(b, -0.0195, BORE, hgZ - hgLen / 2, hgZ + hgLen / 2, 'polymerBlack', 'x');
      mlokRow(b, 0.0195, BORE, hgZ - hgLen / 2, hgZ + hgLen / 2, 'polymerBlack', 'x');
      mlokRow(b, 0, BORE - 0.0215, hgZ - hgLen / 2, hgZ + hgLen / 2, 'polymerBlack', 'y');
      // Full-length top rail, continuous with the receiver's.
      //
      // It used to be a 50 mm stub sitting 7 mm below the receiver rail with a
      // 111 mm bare gap between them, so the weapon's top line went
      // rail -> gap -> ledge -> rail. On a free-float carbine that line is
      // unbroken, and the unbroken line IS the modern-carbine silhouette.
      rail(b, 0, railY, hgZ, hgLen * 0.97, 0.019);
    }
  }

  if (pumpTube && hgLen > 0.04) {
    // Ribbed sliding forend, wrapped around the magazine tube rather than
    // free-floated on the barrel.
    const fz = barrelStart - 0.055 - 0.055;
    b.box(0.048, 0.052, 0.130, furniture, 0, BORE - 0.020, fz);
    for (let i = 0; i < 7; i++) {
      b.box(0.052, 0.006, 0.008, 'polymerBlack', 0, BORE - 0.020, fz - 0.052 + i * 0.017);
    }
  }

  // --- gas block + front sight base ---------------------------------------
  const gasZ = pumpTube ? barrelStart - barrelLen + 0.05 : barrelStart - hgLen - 0.040;
  if (pumpTube) {
    // Bead sight on a ventilated rib, which is what a shotgun has instead.
    b.box(0.010, 0.008, barrelLen * 0.62, 'parkerised', 0, BORE + 0.014, barrelStart - barrelLen * 0.55);
    b.cyl(0.004, 0.005, 'alu', 0, BORE + 0.021, gasZ, 8);
  } else {
    b.box(0.026, 0.032, 0.030, 'parkerised', 0, BORE + 0.006, gasZ);
    b.cyl(0.006, hgLen * 0.5, 'blued', 0, BORE + 0.016, gasZ + hgLen * 0.25, 8); // gas tube
  }

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
  // A bullpup's grip is forward of its action, not behind it — that is the
  // whole layout. It sits just aft of the handguard with the magazine well
  // behind the shooter's hand.
  const gripZ = bullpup ? recFront + 0.030 : recFront + 0.100;
  pistolGrip(b, 0, BORE - 0.056, gripZ, furniture, 0.26);

  // --- stock --------------------------------------------------------------
  const stockAtt = attachments.stock;
  const stockId = stockAtt?.id ?? 'stock-collapsible';
  if (bullpup) {
    // No separate stock: the receiver IS the stock. A butt pad on the back of
    // the housing and a raised comb along the top is the entire assembly.
    b.box(0.038, 0.076, 0.062, furniture, 0, BORE - 0.014, recBack - 0.030);
    b.box(0.046, 0.086, 0.018, 'rubber', 0, BORE - 0.014, recBack + 0.004);
    b.box(0.030, 0.016, 0.090, furniture, 0, BORE + 0.022, recBack - 0.048);
    // Sling loop on the toe.
    b.box(0.006, 0.018, 0.006, 'aluDark', 0.017, BORE - 0.048, recBack - 0.014);
  } else if (stockId === 'stock-fixed' || stockId === 'stock-precision') {
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
  const magZ = bullpup ? recFront + recLen - 0.030 : recFront + 0.062;
  // The floorplate used to sit 224 mm below the bore — 63 mm BELOW the pistol
  // grip — which made the magazine the longest thing on the weapon and turned
  // grip-plus-magazine into one continuous trapezoid. A real carbine's
  // floorplate is roughly level with the grip. This also buries ~29 mm of the
  // magazine inside the magwell, giving the junction line that separates them;
  // previously every millimetre of it was exposed.
  const magY = BORE - 0.040;
  if (pumpTube) {
    // Tube magazine slung under the barrel, plus a ribbed sliding forend. A
    // pump gun has no box magazine at all, and rendering one under a shotgun
    // was the single most obviously wrong thing about this class.
    const tubeLen = Math.min(barrelLen - 0.06, 0.30);
    b.cyl(0.0135, tubeLen, 'blued', 0, BORE - 0.028, barrelStart - 0.02 - tubeLen / 2, 12);
    b.cyl(0.0155, 0.016, 'parkerised', 0, BORE - 0.028, barrelStart - 0.02 - tubeLen, 12);
    // Magazine cap and follower spring retainer at the muzzle end.
    b.box(0.014, 0.010, 0.030, 'parkerised', 0, BORE - 0.014, barrelStart - 0.05);
    // Loading gate on the underside of the receiver.
    b.box(0.022, 0.004, 0.052, 'polymerBlack', 0, BORE - 0.042, recFront + 0.050);
    // Shell carrier lifter, visible through the gate.
    b.box(0.018, 0.006, 0.040, 'brass', 0, BORE - 0.038, recFront + 0.050);
  } else if (magId === 'mag-drum') {
    b.cyl(0.055, 0.034, 'polymerMid', 0, magY - 0.052, magZ, 14, 0, Math.PI / 2, 0);
    b.cyl(0.050, 0.038, 'aluDark', 0, magY - 0.052, magZ, 14, 0, Math.PI / 2, 0);
    b.box(0.028, 0.048, 0.046, 'polymerBlack', 0, magY - 0.020, magZ);
  } else {
    const magLen = magId === 'mag-ext' ? 0.170 : magId === 'mag-short' ? 0.088 : 0.130;
    // Eastern-pattern cartridges use a strongly curved magazine.
    const curve = spec.caliber === '7.62x39' || spec.caliber === '5.45x39' ? 0.42 : 0.12;
    boxMagazine(b, 0, magY, magZ, magLen, curve, 'polymerMid');
  }

  // --- optic --------------------------------------------------------------
  const optic = attachments.optic;
  let sightY: number;
  const opticZ = recFront + recLen * 0.52;
  if (optic?.optic && optic.id !== 'opt-iron') {
    const m = optic.optic.magnification;
    sightY = m > 1 ? scope(b, 0, railY + 0.003, opticZ, m) : redDot(b, 0, railY + 0.003, opticZ, optic.id.includes('holo'));
  } else {
    // Iron sights mount to whatever is actually under them. On a pump gun
    // that is the barrel rib, 24 mm below the receiver's rail line — posting
    // the front sight at rail height left it floating over a bare barrel.
    const ironY = pumpTube ? BORE + 0.018 : railY + 0.003;
    sightY = ironSights(b, 0, ironY, gasZ, pumpTube ? recFront + 0.030 : recBack - 0.045);
  }

  // --- underbarrel --------------------------------------------------------
  const ub = attachments.underbarrel;
  if (ub && hgLen > 0.06) {
    const ubZ = hgZ - hgLen * 0.22;
    // Handguard underside is at BORE - 0.022 once the M-LOK recesses are
    // flush; every accessory was hanging 3-5 mm clear of it.
    const ubY = BORE - 0.021;
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
  b.cyl(0.004, 0.014, 'aluDark', -0.015, BORE - 0.020, recBack - 0.030, 6, 0, Math.PI / 2, 0);

  // --- hands --------------------------------------------------------------
  // Built last and into their own group so they sit on top of the finished
  // weapon and can later be animated (reload, malfunction clearing) without
  // touching the gun. Their positions are derived from the grip and forend the
  // assembler actually produced, so a longer handguard moves the support hand.
  const hands = new PartBuilder();
  const gloves: MatKey = furniture === 'polymerFde' ? 'gloveTan' : 'glove';
  // Follows the grip the assembler actually placed, so a bullpup's forward
  // grip carries the hand with it instead of leaving it out over the magwell.
  firingHand(hands, 0, BORE - 0.062, gripZ + 0.004, 0.26, gripZ - 0.070,
    { glove: gloves, sleeve: 'sleeve', mirror: false });
  if (pumpTube) {
    // On a pump the support hand belongs on the sliding forend, which is a
    // separate, fatter object further forward than any handguard.
    supportHand(hands, 0, BORE - 0.020, barrelStart - 0.110, 0.026, 0.10,
      { glove: gloves, sleeve: 'sleeve', mirror: true });
  } else if (hgLen > 0.05) {
    // Forward on the handguard — that is what a C-clamp is. It used to land
    // 11% from the REAR of the handguard with 148 mm of bare tube in front of
    // it, which is a magwell grip, not a C-clamp; and the underbarrel offset
    // pushed it further backwards rather than behind the stop.
    const ubOffset = attachments.underbarrel ? 0.030 : 0.0;
    const supportZ = THREE.MathUtils.clamp(
      hgZ - hgLen * 0.20 + ubOffset, hgZ - hgLen * 0.42, hgZ + hgLen * 0.42);
    supportHand(hands, 0, BORE - 0.004, supportZ, 0.019, 0.14,
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
      // Self-shadowing. On a flat-shaded model under a near-uniform
      // environment, occlusion is the only remaining source of internal
      // structure — with it off, the optic cast nothing on the rail, the
      // magazine cast nothing into the magwell and the hands cast nothing on
      // the handguard, so every internal edge had to be carried by value
      // alone. The viewmodel key light has a tight 1.1 m ortho frustum, so
      // this is one small extra pass, not a scene-wide cost.
      o.castShadow = true;
      o.receiveShadow = true;
      // Drawn in its own pass with a cleared depth buffer, so it can never be
      // culled against world geometry.
      o.frustumCulled = false;
    }
  });
}

export function disposeWeaponGeometry(): void {
  for (const m of Object.values(MATERIALS)) m.dispose();
}
