/**
 * Attachments.
 *
 * OWNED BY: Weapon systems.
 *
 * **Rule: nothing here is a pure upgrade.** Every attachment pays for what it
 * gives. A suppressor buys sound and flash with weight, ergonomics and a slower
 * sight picture. A heavy barrel buys stability with handling. A magnified optic
 * buys precision at range with target acquisition up close. If an attachment
 * has no downside, it is not a choice — it is just the correct answer, and the
 * gunsmith screen becomes a checklist instead of a decision.
 *
 * `WeaponStatMods` semantics (from contracts.ts) — this is easy to get wrong:
 *   - **Multiplicative** (default 1): verticalRecoil, horizontalRecoil,
 *     recoilRecovery, muzzleVelocity, flash, swayAmplitude, swayFrequency,
 *     spreadMoa, durabilityBurn.
 *   - **Additive** (default 0): ergonomics (points), adsTimeMs, soundMeters,
 *     reloadTimeMs, magazineSize, weightKg.
 *
 * Ergonomics is the master handling stat: it drives ADS speed, sway and recoil
 * recovery. Bolting on weight costs ergonomics, which is how a maximally-kitted
 * weapon ends up worse than a clean one for close work.
 */

import type { AttachmentSpec, AttachmentSlot } from '../core/contracts';

type Mods = AttachmentSpec['mods'];

let seq = 0;
function att(
  id: string, name: string, slot: AttachmentSlot, fitsTags: string[],
  massKg: number, mods: Mods, price: number, unlockLevel: number,
  description: string, extra: Partial<AttachmentSpec> = {},
): AttachmentSpec {
  seq++;
  return { id, name, slot, fitsTags, massKg, mods, price, unlockLevel, description, ...extra };
}

// ===========================================================================
// Muzzle devices — the clearest trade space in the game
// ===========================================================================

const MUZZLE: AttachmentSpec[] = [
  att('muz-none', 'Bare muzzle', 'muzzle', ['rifle', 'carbine', 'smg', 'pistol', 'dmr', 'sniper', 'lmg', 'shotgun'],
    0, {}, 0, 1,
    'Nothing on the threads. Lightest, fastest, loudest.'),

  att('muz-a2', 'A2 flash hider', 'muzzle', ['rifle', 'carbine', 'dmr', 'lmg'],
    0.07, { flash: 0.35, verticalRecoil: 0.97, ergonomics: -1 }, 45, 1,
    'Kills most of the visible flash and a little of the climb. Does nothing for the report.'),

  att('muz-brake-l', 'Lateral brake', 'muzzle', ['rifle', 'carbine', 'dmr', 'sniper', 'lmg'],
    0.14, { verticalRecoil: 0.74, horizontalRecoil: 1.18, flash: 1.5, soundMeters: 22, ergonomics: -4 },
    120, 3,
    'Vents hard to the sides. Kills climb, throws the report and dust at everyone beside you.'),

  att('muz-comp-3', 'Three-port compensator', 'muzzle', ['rifle', 'carbine', 'smg', 'dmr'],
    0.10, { verticalRecoil: 0.83, horizontalRecoil: 0.92, flash: 1.15, soundMeters: 8, ergonomics: -2 },
    95, 2,
    'Upward ports fight muzzle rise. A fair trade if you can live with the extra noise.'),

  att('muz-supp-light', 'Light suppressor', 'muzzle', ['rifle', 'carbine', 'smg', 'dmr'],
    0.39, {
      soundMeters: -95, flash: 0.06, verticalRecoil: 0.90, muzzleVelocity: 1.02,
      ergonomics: -7, adsTimeMs: 35, durabilityBurn: 1.25, spreadMoa: 1.06,
    }, 480, 4,
    'Titanium can. Drops the report to something a patrol will not place, at the cost of handling and a hotter barrel.'),

  att('muz-supp-heavy', 'Heavy suppressor', 'muzzle', ['rifle', 'dmr', 'sniper', 'lmg'],
    0.72, {
      soundMeters: -140, flash: 0.03, verticalRecoil: 0.82, muzzleVelocity: 1.04,
      ergonomics: -13, adsTimeMs: 70, durabilityBurn: 1.45, swayAmplitude: 1.18,
    }, 760, 6,
    'Steel and dense baffles. As quiet as this gets. Hangs off the front like an anchor.'),

  att('muz-supp-pistol', 'Pistol can', 'muzzle', ['pistol'],
    0.21, { soundMeters: -70, flash: 0.05, verticalRecoil: 0.88, ergonomics: -6, adsTimeMs: 40 },
    310, 3,
    'Booster-fed can for a tilting-barrel pistol. Quiet, and completely blocks the standard sights.'),

  att('muz-breach', 'Breaching standoff', 'muzzle', ['shotgun'],
    0.16, { soundMeters: 10, ergonomics: -3, spreadMoa: 1.1 },
    85, 2,
    'Toothed standoff for putting a breaching round through a hinge without a bounce-back.'),
];

// ===========================================================================
// Optics — precision at range against speed up close
// ===========================================================================

const OPTIC: AttachmentSpec[] = [
  att('opt-iron', 'Iron sights', 'optic', ['rifle', 'carbine', 'smg', 'pistol', 'dmr', 'sniper', 'lmg', 'shotgun'],
    0.04, {}, 0, 1,
    'What the weapon came with. Nothing to fog, nothing to run out of battery.',
    { optic: { magnification: 1, reticle: 'post', adsSpeedMod: 1, unmagnified: true, nightVisionCompatible: true, scopeRender: false } }),

  att('opt-rds', 'Compact red dot', 'optic', ['rifle', 'carbine', 'smg', 'pistol', 'shotgun', 'lmg'],
    0.12, { ergonomics: 2, adsTimeMs: -25 }, 180, 1,
    'Two-MOA dot, both eyes open. The default answer for anything inside a hundred metres.',
    { optic: { magnification: 1, reticle: 'dot', adsSpeedMod: 1.12, unmagnified: true, nightVisionCompatible: true, scopeRender: false } }),

  att('opt-holo', 'Holographic sight', 'optic', ['rifle', 'carbine', 'smg', 'shotgun', 'lmg'],
    0.21, { ergonomics: 1, adsTimeMs: -15 }, 260, 2,
    'Large window, ring-and-dot. Faster to pick up in a doorway than a tube sight.',
    { optic: { magnification: 1, reticle: 'ring-dot', adsSpeedMod: 1.08, unmagnified: true, nightVisionCompatible: true, scopeRender: false } }),

  att('opt-lpvo', 'LPVO 1-6×', 'optic', ['rifle', 'carbine', 'dmr'],
    0.51, { ergonomics: -5, adsTimeMs: 45, swayAmplitude: 1.12 }, 640, 4,
    'One power for the room, six for the treeline. Heavy, and the eye box punishes a sloppy cheek weld.',
    { optic: { magnification: 6, reticle: 'bdc', adsSpeedMod: 0.9, unmagnified: false, nightVisionCompatible: false, scopeRender: true } }),

  att('opt-acog', 'Fixed 4× prism', 'optic', ['rifle', 'carbine', 'dmr', 'lmg'],
    0.38, { ergonomics: -4, adsTimeMs: 35, swayAmplitude: 1.08 }, 470, 3,
    'Prism glass with an etched chevron. Rugged, always on, and useless in a corridor.',
    { optic: { magnification: 4, reticle: 'chevron', adsSpeedMod: 0.92, unmagnified: false, nightVisionCompatible: false, scopeRender: true } }),

  att('opt-scope-10', 'Precision 5-25×', 'optic', ['dmr', 'sniper'],
    0.88, { ergonomics: -11, adsTimeMs: 110, swayAmplitude: 1.35 }, 1450, 6,
    'First-focal-plane glass with a milling reticle. Everything about it is optimised for a shot you take slowly.',
    { optic: { magnification: 25, reticle: 'mil-hash', adsSpeedMod: 0.72, unmagnified: false, nightVisionCompatible: false, scopeRender: true } }),

  att('opt-magnifier', 'Flip magnifier 3×', 'optic', ['rifle', 'carbine'],
    0.29, { ergonomics: -3, adsTimeMs: 20 }, 340, 4,
    'Flips in behind a dot when the range opens up, and out of the way when it closes.',
    { optic: { magnification: 3, reticle: 'dot', adsSpeedMod: 0.95, unmagnified: false, nightVisionCompatible: true, scopeRender: true } }),

  att('opt-thermal', 'Thermal clip-on', 'optic', ['rifle', 'dmr', 'sniper'],
    0.74, { ergonomics: -9, adsTimeMs: 90, swayAmplitude: 1.2 }, 2600, 8,
    'Reads heat, not light. Sees through smoke and foliage, blind to glass, and the battery is always the problem.',
    { optic: { magnification: 3, reticle: 'thermal', adsSpeedMod: 0.8, unmagnified: false, nightVisionCompatible: true, scopeRender: true } }),
];

// ===========================================================================
// Handguards, grips, stocks — the handling budget
// ===========================================================================

const HANDGUARD: AttachmentSpec[] = [
  att('hg-std', 'Standard handguard', 'handguard', ['rifle', 'carbine', 'lmg'], 0.22, {}, 0, 1,
    'Factory furniture. No rails, no complaints.', { provides: [] }),
  att('hg-mlok-short', 'Short M-slot rail', 'handguard', ['rifle', 'carbine', 'smg'],
    0.28, { ergonomics: 3, adsTimeMs: -10 }, 150, 2,
    'Slim and short. Quick to swing, little room to hang things off.',
    { provides: ['underbarrel', 'laser'] }),
  att('hg-mlok-long', 'Extended M-slot rail', 'handguard', ['rifle', 'carbine', 'dmr', 'lmg'],
    0.44, { ergonomics: -2, verticalRecoil: 0.95, swayAmplitude: 0.94 }, 220, 3,
    'Long enough to get your hand out at the muzzle, which is worth more than the weight costs.',
    { provides: ['underbarrel', 'laser', 'grip'] }),
  att('hg-quad', 'Quad rail', 'handguard', ['rifle', 'carbine', 'lmg'],
    0.61, { ergonomics: -6, verticalRecoil: 0.93 }, 190, 2,
    'Steel rails on all four faces. Heavy, cold, and it will hang anything you own.',
    { provides: ['underbarrel', 'laser', 'grip'] }),
];

const GRIP: AttachmentSpec[] = [
  att('grip-vert', 'Vertical foregrip', 'underbarrel', ['rifle', 'carbine', 'smg', 'lmg'],
    0.13, { verticalRecoil: 0.88, horizontalRecoil: 0.90, ergonomics: -2, adsTimeMs: 12 }, 90, 1,
    'Straight grip to pull the weapon into the shoulder. Costs a little speed onto target.'),
  att('grip-angled', 'Angled foregrip', 'underbarrel', ['rifle', 'carbine', 'smg'],
    0.09, { horizontalRecoil: 0.86, ergonomics: 3, adsTimeMs: -18, verticalRecoil: 0.97 }, 85, 2,
    'Encourages a forward push rather than a squeeze. Faster to shoulder, less help with climb.'),
  att('grip-handstop', 'Hand stop', 'underbarrel', ['rifle', 'carbine', 'smg', 'dmr'],
    0.04, { ergonomics: 4, adsTimeMs: -22, horizontalRecoil: 0.95 }, 45, 1,
    'A bump to index against. Almost free, and it stops your hand walking onto the muzzle.'),
  att('grip-bipod', 'Folding bipod', 'underbarrel', ['dmr', 'sniper', 'lmg', 'rifle'],
    0.34, { ergonomics: -8, adsTimeMs: 40, swayAmplitude: 0.35, verticalRecoil: 0.72 }, 210, 4,
    'Transforms the weapon when deployed and is dead weight when not. Prone only.'),
  att('grip-pistol-std', 'Standard pistol grip', 'grip', ['rifle', 'carbine', 'smg', 'dmr', 'sniper', 'lmg'],
    0.08, {}, 0, 1, 'Factory grip.'),
  att('grip-pistol-rubber', 'Rubberised grip', 'grip', ['rifle', 'carbine', 'smg', 'dmr', 'sniper', 'lmg'],
    0.10, { ergonomics: 4, recoilRecovery: 1.08 }, 60, 2,
    'Tackier, fills the hand better. Small gain, no real cost — the exception that proves the rule.'),
];

const STOCK: AttachmentSpec[] = [
  att('stock-fixed', 'Fixed stock', 'stock', ['rifle', 'dmr', 'sniper', 'lmg'],
    0.34, { verticalRecoil: 0.90, swayAmplitude: 0.92, ergonomics: -1 }, 0, 1,
    'Solid, repeatable cheek weld. Long, and awkward in a stairwell.'),
  att('stock-collapsible', 'Collapsible stock', 'stock', ['rifle', 'carbine', 'smg', 'lmg'],
    0.26, { ergonomics: 4, adsTimeMs: -20, verticalRecoil: 1.06 }, 70, 1,
    'Adjusts to fit armour. Slightly more climb than a fixed stock, and much easier to work indoors.'),
  att('stock-folding', 'Side-folding stock', 'stock', ['rifle', 'carbine', 'smg'],
    0.24, { ergonomics: 6, adsTimeMs: -28, verticalRecoil: 1.14, swayAmplitude: 1.1 }, 120, 3,
    'Folds flat for a bag or a vehicle. Shoot with it folded and the weapon fights you.'),
  att('stock-precision', 'Precision chassis stock', 'stock', ['dmr', 'sniper'],
    0.62, { verticalRecoil: 0.78, swayAmplitude: 0.72, spreadMoa: 0.9, ergonomics: -7, adsTimeMs: 55 }, 520, 5,
    'Adjustable comb and length of pull, bedded to the action. Heavy, and it makes the weapon shoot like a benchrest.'),
  att('stock-brace', 'Pistol brace', 'stock', ['smg', 'carbine', 'pistol'],
    0.15, { ergonomics: 7, adsTimeMs: -34, verticalRecoil: 1.3, horizontalRecoil: 1.25 }, 95, 2,
    'Minimal, fast, and no help at all against recoil. For people who intend to be close.'),
];

// ===========================================================================
// Magazines, barrels, lasers, triggers
// ===========================================================================

const MAGAZINE: AttachmentSpec[] = [
  att('mag-std', 'Standard magazine', 'magazine', ['rifle', 'carbine', 'smg', 'pistol', 'dmr', 'sniper', 'lmg', 'shotgun'],
    0, {}, 0, 1, 'What the weapon ships with.'),
  att('mag-ext', 'Extended magazine', 'magazine', ['rifle', 'carbine', 'smg', 'pistol', 'dmr'],
    0.18, { magazineSize: 10, ergonomics: -3, reloadTimeMs: 60, weightKg: 0.15 }, 110, 2,
    'Ten more rounds, and it hangs low enough to foul a prone position.'),
  att('mag-drum', 'Drum magazine', 'magazine', ['rifle', 'carbine', 'smg', 'lmg'],
    0.85, { magazineSize: 55, ergonomics: -14, reloadTimeMs: 900, swayAmplitude: 1.25, weightKg: 0.9 }, 380, 5,
    'Enormous capacity, enormous weight, and a reload you will only survive behind hard cover.'),
  att('mag-short', 'Short magazine', 'magazine', ['rifle', 'carbine', 'smg'],
    -0.08, { magazineSize: -10, ergonomics: 5, reloadTimeMs: -80 }, 40, 1,
    'Fewer rounds, but it clears the ground when you go prone and it comes out of a pouch fast.'),
  att('mag-quick', 'Quick-change magwell', 'magazine', ['rifle', 'carbine', 'dmr'],
    0.06, { reloadTimeMs: -220, ergonomics: 1, weightKg: 0.06 }, 160, 3,
    'Flared well and an extended release. Buys most of a second on every reload.'),
];

const BARREL: AttachmentSpec[] = [
  att('bar-std', 'Standard barrel', 'receiver', ['rifle', 'carbine', 'smg', 'dmr', 'sniper', 'lmg'],
    0, {}, 0, 1, 'Factory length and profile.'),
  att('bar-short', 'Short barrel', 'receiver', ['rifle', 'carbine', 'smg'],
    -0.24, { muzzleVelocity: 0.88, ergonomics: 8, adsTimeMs: -45, soundMeters: 18, flash: 1.6, spreadMoa: 1.25 },
    180, 2,
    'Cut down for vehicles and stairwells. Loud, flashy, and you give up real velocity.'),
  att('bar-heavy', 'Heavy match barrel', 'receiver', ['rifle', 'dmr', 'sniper', 'lmg'],
    0.58, { muzzleVelocity: 1.05, spreadMoa: 0.68, verticalRecoil: 0.90, ergonomics: -10, adsTimeMs: 60, durabilityBurn: 0.8 },
    540, 5,
    'Thick contour, slow to heat. Shoots far better than you can hold it, and weighs like it.'),
  att('bar-long', 'Long barrel', 'receiver', ['rifle', 'dmr', 'sniper'],
    0.31, { muzzleVelocity: 1.09, spreadMoa: 0.85, soundMeters: -10, ergonomics: -6, adsTimeMs: 35 },
    290, 4,
    'Extra velocity and a quieter report, paid for in swing weight.'),
];

const LASER: AttachmentSpec[] = [
  att('las-none', 'No laser', 'laser', ['rifle', 'carbine', 'smg', 'pistol', 'dmr', 'lmg'], 0, {}, 0, 1, 'Nothing on the rail.'),
  att('las-visible', 'Visible laser', 'laser', ['rifle', 'carbine', 'smg', 'pistol'],
    0.07, { spreadMoa: 0.85, ergonomics: 1 }, 130, 2,
    'Tightens unaimed fire considerably. Everyone in the room can see exactly where you are.'),
  att('las-ir', 'IR laser', 'laser', ['rifle', 'carbine', 'smg', 'dmr'],
    0.11, { spreadMoa: 0.88, ergonomics: 1 }, 420, 5,
    'Invisible without night vision — and to anyone who has it, you are a lighthouse.'),
  att('las-light', 'Weapon light', 'laser', ['rifle', 'carbine', 'smg', 'pistol', 'shotgun'],
    0.14, { ergonomics: -1 }, 110, 1,
    'Six hundred lumens. Identifies a target instantly and announces you just as fast.'),
];

const TRIGGER: AttachmentSpec[] = [
  att('trg-std', 'Standard trigger', 'trigger', ['rifle', 'carbine', 'smg', 'pistol', 'dmr', 'sniper', 'lmg'], 0, {}, 0, 1,
    'Mil-spec. Gritty, heavy, reliable.'),
  att('trg-match', 'Match trigger', 'trigger', ['rifle', 'carbine', 'dmr', 'sniper'],
    0.02, { spreadMoa: 0.92, ergonomics: 3, durabilityBurn: 1.1 }, 240, 4,
    'Clean break, short reset. Makes precise shots easier and dirt less forgivable.'),
  att('trg-binary', 'Competition group', 'trigger', ['rifle', 'carbine', 'smg'],
    0.03, { ergonomics: 2, durabilityBurn: 1.35, spreadMoa: 1.05 }, 300, 6,
    'Very fast follow-ups from a light sear. Hard on the internals and unforgiving of a jerky finger.'),
];

const CHARGING: AttachmentSpec[] = [
  att('chg-std', 'Standard charging handle', 'charging', ['rifle', 'carbine', 'dmr', 'sniper', 'lmg'], 0, {}, 0, 1,
    'Factory latch.'),
  att('chg-ambi', 'Extended latch', 'charging', ['rifle', 'carbine', 'dmr', 'lmg'],
    0.03, { ergonomics: 2, reloadTimeMs: -90 }, 70, 2,
    'Big enough to hook with a gloved hand, and much faster to clear a stoppage with.'),
];

export const ATTACHMENTS: AttachmentSpec[] = [
  ...MUZZLE, ...OPTIC, ...HANDGUARD, ...GRIP, ...STOCK,
  ...MAGAZINE, ...BARREL, ...LASER, ...TRIGGER, ...CHARGING,
];

export const ATTACHMENT_MAP: ReadonlyMap<string, AttachmentSpec> =
  new Map(ATTACHMENTS.map((a) => [a.id, a]));

/** Attachments that fit a slot on a weapon carrying these tags. */
export function attachmentsFor(slot: AttachmentSlot, tags: readonly string[]): AttachmentSpec[] {
  return ATTACHMENTS.filter(
    (a) => a.slot === slot && a.fitsTags.some((t) => tags.includes(t)),
  );
}
