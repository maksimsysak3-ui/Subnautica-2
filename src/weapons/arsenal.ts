/**
 * The arsenal.
 *
 * OWNED BY: Weapon systems.
 *
 * Fictional weapons from invented manufacturers, built on real cartridges.
 * Nothing here borrows a trademark, but everything is grounded: a weapon's
 * numbers follow from its caliber, barrel length and mass, so the arsenal is
 * internally consistent rather than a table of arbitrary preferences.
 *
 * In-fiction manufacturers (see src/story/ once the world bible lands):
 *   **Aldbrecht Werke** (AW)   — German-pattern, over-engineered, expensive
 *   **Cassara Arms** (CA)      — Italian-pattern, light, fast-handling
 *   **Volkov Proizvodstvo** (VP) — Eastern-pattern, crude, indestructible
 *   **Meridian Defence** (MD)  — regional licence-builds and conversions
 *   **Halloran Ordnance** (HO) — American-pattern, modular, rail-heavy
 *   **Tenshou Kikai** (TK)     — Japanese-pattern, compact, precise
 *
 * Stat conventions:
 *   `spreadMoa` — mechanical accuracy of the weapon, not the shooter.
 *   `ergonomics` — 0..100 handling budget. Drives ADS speed, sway, recovery.
 *   `verticalRecoil`/`horizontalRecoil` — degrees per shot before attachments.
 *   `soundMeters` — unsuppressed audible radius. AI hearing reads this.
 */

import type { WeaponSpec, AttachmentSlot, FireMode, WeaponClass } from '../core/contracts';
import { CALIBER_MAP } from './calibers';
import { ammoForCaliber } from './ammo';

const RIFLE_SLOTS: AttachmentSlot[] = [
  'optic', 'muzzle', 'underbarrel', 'magazine', 'stock',
  'handguard', 'grip', 'laser', 'trigger', 'charging', 'receiver',
];
const SMG_SLOTS: AttachmentSlot[] = ['optic', 'muzzle', 'underbarrel', 'magazine', 'stock', 'handguard', 'grip', 'laser', 'trigger'];
const PISTOL_SLOTS: AttachmentSlot[] = ['optic', 'muzzle', 'magazine', 'laser', 'trigger'];
const SNIPER_SLOTS: AttachmentSlot[] = ['optic', 'muzzle', 'underbarrel', 'magazine', 'stock', 'grip', 'trigger', 'receiver'];
const SHOTGUN_SLOTS: AttachmentSlot[] = ['optic', 'muzzle', 'magazine', 'stock', 'laser'];

interface Seed {
  id: string; name: string; make: string; cls: WeaponClass; caliber: string;
  rpm: number; mag: number; massKg: number; barrelMm: number;
  spreadMoa: number; erg: number; adsMs: number;
  vRecoil: number; hRecoil: number; recovery: number;
  modes: FireMode[];
  tags?: string[];
  reloadMs?: number; reloadEmptyMs?: number;
  unlock?: number; price?: number;
  desc: string;
}

function build(s: Seed): WeaponSpec {
  const cal = CALIBER_MAP.get(s.caliber);
  if (!cal) throw new Error(`[arsenal] ${s.id}: unknown caliber "${s.caliber}"`);

  const classTag = s.cls;
  const tags = [classTag, ...(s.tags ?? [])];

  // Loudness follows chamber pressure and how much gas the case dumps. A short
  // barrel is louder because more of the burn is still happening at the muzzle.
  const barrelFactor = Math.max(0.6, cal.refBarrelMm / Math.max(60, s.barrelMm));
  const soundMeters = Math.round(
    55 + cal.pressureMPa * 0.30 + cal.gasVolume * 34 * barrelFactor,
  );

  const reloadMs = s.reloadMs ?? (s.cls === 'pistol' ? 1750 : s.cls === 'lmg' ? 5200 : 2350);

  const defaults: Partial<Record<AttachmentSlot, string>> = {
    optic: 'opt-iron',
    muzzle: 'muz-none',
    magazine: 'mag-std',
    grip: 'grip-pistol-std',
    laser: 'las-none',
    trigger: 'trg-std',
  };
  if (s.cls !== 'pistol') {
    defaults.handguard = 'hg-std';
    defaults.charging = 'chg-std';
    defaults.receiver = 'bar-std';
    defaults.stock = s.cls === 'sniper' || s.cls === 'dmr' ? 'stock-fixed' : 'stock-collapsible';
  }

  const slots =
    s.cls === 'pistol' ? PISTOL_SLOTS
    : s.cls === 'sniper' ? SNIPER_SLOTS
    : s.cls === 'shotgun' ? SHOTGUN_SLOTS
    : s.cls === 'smg' ? SMG_SLOTS
    : RIFLE_SLOTS;

  return {
    id: s.id,
    name: s.name,
    make: s.make,
    class: s.cls,
    caliber: s.caliber,
    tags,
    fireModes: s.modes,
    rpm: s.rpm,
    // Real cyclic rate wanders; a metronome sounds synthetic.
    rpmJitter: Math.round(s.rpm * 0.018),
    baseMagazine: s.mag,
    massKg: s.massKg,
    barrelLengthMm: s.barrelMm,
    spreadMoa: s.spreadMoa,
    ergonomics: s.erg,
    adsTimeMs: s.adsMs,
    verticalRecoil: s.vRecoil,
    horizontalRecoil: s.hRecoil,
    recoilRecovery: s.recovery,
    soundMeters,
    reloadTimeMs: reloadMs,
    reloadEmptyTimeMs: s.reloadEmptyMs ?? Math.round(reloadMs * 1.42),
    slots,
    defaults,
    ammo: ammoForCaliber(s.caliber).map((a) => a.id),
    unlockLevel: s.unlock ?? 1,
    price: s.price ?? 900,
    description: s.desc,
  };
}

export const WEAPONS: WeaponSpec[] = [
  // =========================================================================
  // Pistols
  // =========================================================================
  build({ id: 'aw-p9', name: 'Aldbrecht P9', make: 'Aldbrecht Werke', cls: 'pistol', caliber: '9x19',
    rpm: 420, mag: 17, massKg: 0.71, barrelMm: 108, spreadMoa: 8.5, erg: 76, adsMs: 190,
    vRecoil: 1.35, hRecoil: 0.55, recovery: 1.5, modes: ['safe', 'semi'],
    unlock: 1, price: 340,
    desc: 'Polymer service pistol. Utterly unremarkable, which is the highest compliment a sidearm can be paid.' }),

  build({ id: 'vp-tk33', name: 'Volkov TK-33', make: 'Volkov Proizvodstvo', cls: 'pistol', caliber: '7.62x25',
    rpm: 450, mag: 8, massKg: 0.85, barrelMm: 116, spreadMoa: 10, erg: 68, adsMs: 205,
    vRecoil: 1.20, hRecoil: 0.62, recovery: 1.45, modes: ['safe', 'semi'],
    unlock: 1, price: 260,
    desc: 'Seventy-year-old design still coming out of a state arsenal. Flat-shooting, and it will go through a soft vest.' }),

  build({ id: 'ho-m12', name: 'Halloran M12', make: 'Halloran Ordnance', cls: 'pistol', caliber: '11.43x23',
    rpm: 380, mag: 8, massKg: 1.12, barrelMm: 127, spreadMoa: 9, erg: 62, adsMs: 235,
    vRecoil: 2.05, hRecoil: 0.70, recovery: 1.25, modes: ['safe', 'semi'],
    unlock: 2, price: 480,
    desc: 'All-steel and heavy in the hand. Slow, subsonic, and it moves whatever it hits.' }),

  build({ id: 'ca-x10', name: 'Cassara X10 Auto', make: 'Cassara Arms', cls: 'pistol', caliber: '10x25',
    rpm: 1100, mag: 20, massKg: 1.04, barrelMm: 127, spreadMoa: 11, erg: 58, adsMs: 225,
    vRecoil: 2.30, hRecoil: 1.30, recovery: 1.15, modes: ['safe', 'semi', 'burst3'],
    unlock: 5, price: 1180,
    desc: 'Machine pistol in a full-power auto cartridge. The burst is controllable. The rest is optimism.' }),

  // =========================================================================
  // SMGs and PDWs
  // =========================================================================
  build({ id: 'aw-mp7k', name: 'Aldbrecht MK-7', make: 'Aldbrecht Werke', cls: 'smg', caliber: '4.6x30',
    rpm: 950, mag: 30, massKg: 1.9, barrelMm: 180, spreadMoa: 5.5, erg: 82, adsMs: 215,
    vRecoil: 0.62, hRecoil: 0.34, recovery: 1.75, modes: ['safe', 'semi', 'auto'],
    tags: ['pdw'], unlock: 3, price: 1450,
    desc: 'Tiny hardened darts at rifle velocity. Recoils like nothing and defeats soft armour the 9mm guns cannot touch.' }),

  build({ id: 'ca-vm9', name: 'Cassara VM-9', make: 'Cassara Arms', cls: 'smg', caliber: '9x19',
    rpm: 800, mag: 32, massKg: 2.6, barrelMm: 200, spreadMoa: 6, erg: 78, adsMs: 230,
    vRecoil: 0.80, hRecoil: 0.42, recovery: 1.62, modes: ['safe', 'semi', 'burst3', 'auto'],
    unlock: 1, price: 780,
    desc: 'Roller-delayed and famously smooth. Suppresses beautifully; the reason so many of these are still working.' }),

  build({ id: 'vp-pp71', name: 'Volkov PP-71', make: 'Volkov Proizvodstvo', cls: 'smg', caliber: '9x19',
    rpm: 1050, mag: 30, massKg: 2.1, barrelMm: 165, spreadMoa: 8, erg: 74, adsMs: 210,
    vRecoil: 0.95, hRecoil: 0.66, recovery: 1.5, modes: ['safe', 'auto'],
    unlock: 1, price: 420,
    desc: 'Stamped, ugly, and it fires faster than you can think. No semi position — commit or leave it slung.' }),

  build({ id: 'tk-s57', name: 'Tenshou S-57', make: 'Tenshou Kikai', cls: 'smg', caliber: '5.7x28',
    rpm: 900, mag: 50, massKg: 2.2, barrelMm: 260, spreadMoa: 4.5, erg: 80, adsMs: 225,
    vRecoil: 0.58, hRecoil: 0.30, recovery: 1.80, modes: ['safe', 'semi', 'auto'],
    tags: ['pdw'], unlock: 4, price: 1620,
    desc: 'Bullpup PDW with a fifty-round magazine that sits flush. Almost no recoil, and almost no stopping power.' }),

  // =========================================================================
  // Carbines and rifles
  // =========================================================================
  build({ id: 'ho-mk4c', name: 'Halloran Mk4 Carbine', make: 'Halloran Ordnance', cls: 'carbine', caliber: '5.56x45',
    rpm: 780, mag: 30, massKg: 3.1, barrelMm: 368, spreadMoa: 2.4, erg: 72, adsMs: 260,
    vRecoil: 1.05, hRecoil: 0.46, recovery: 1.45, modes: ['safe', 'semi', 'burst3', 'auto'],
    unlock: 1, price: 1350,
    desc: 'The default. Modular to a fault, forgiving to shoot, and every part of it is available everywhere.' }),

  build({ id: 'ho-mk4r', name: 'Halloran Mk4 Rifle', make: 'Halloran Ordnance', cls: 'rifle', caliber: '5.56x45',
    rpm: 750, mag: 30, massKg: 3.6, barrelMm: 508, spreadMoa: 1.7, erg: 64, adsMs: 305,
    vRecoil: 0.92, hRecoil: 0.40, recovery: 1.5, modes: ['safe', 'semi', 'auto'],
    unlock: 2, price: 1480,
    desc: 'Full-length barrel on the same receiver. Slower to bring up, and it keeps the round supersonic much further out.' }),

  build({ id: 'vp-ak74m', name: 'Volkov AK-74M', make: 'Volkov Proizvodstvo', cls: 'rifle', caliber: '5.45x39',
    rpm: 650, mag: 30, massKg: 3.4, barrelMm: 415, spreadMoa: 3.2, erg: 66, adsMs: 285,
    vRecoil: 1.02, hRecoil: 0.72, recovery: 1.32, modes: ['safe', 'semi', 'auto'],
    unlock: 1, price: 900,
    desc: 'Long-stroke piston, loose tolerances, and a muzzle brake doing most of the work. It will run caked in mud.' }),

  build({ id: 'vp-akm', name: 'Volkov AKM', make: 'Volkov Proizvodstvo', cls: 'rifle', caliber: '7.62x39',
    rpm: 600, mag: 30, massKg: 3.6, barrelMm: 415, spreadMoa: 4.0, erg: 62, adsMs: 295,
    vRecoil: 1.58, hRecoil: 1.05, recovery: 1.18, modes: ['safe', 'semi', 'auto'],
    unlock: 1, price: 820,
    desc: 'Heavier round, heavier climb. Goes through the cover the small-calibre rifles only chip.' }),

  build({ id: 'md-k7', name: 'Meridian K7', make: 'Meridian Defence', cls: 'carbine', caliber: '7.62x35',
    rpm: 700, mag: 30, massKg: 3.2, barrelMm: 229, spreadMoa: 2.9, erg: 74, adsMs: 250,
    vRecoil: 1.22, hRecoil: 0.55, recovery: 1.42, modes: ['safe', 'semi', 'auto'],
    tags: ['suppressor-optimised'], unlock: 4, price: 1900,
    desc: 'Local conversion built around a short barrel and a can. Runs supersonic light or whisper-quiet heavy.' }),

  build({ id: 'aw-g4', name: 'Aldbrecht G4', make: 'Aldbrecht Werke', cls: 'rifle', caliber: '5.56x45',
    rpm: 700, mag: 30, massKg: 3.9, barrelMm: 450, spreadMoa: 1.9, erg: 60, adsMs: 315,
    vRecoil: 0.88, hRecoil: 0.38, recovery: 1.55, modes: ['safe', 'semi', 'burst2', 'auto'],
    unlock: 3, price: 1780,
    desc: 'Short-stroke piston, cold-hammered barrel, and a two-round burst that is genuinely useful. Heavy for the calibre.' }),

  build({ id: 'tk-t9', name: 'Tenshou T-9', make: 'Tenshou Kikai', cls: 'carbine', caliber: '9x39',
    rpm: 750, mag: 20, massKg: 3.0, barrelMm: 200, spreadMoa: 3.4, erg: 76, adsMs: 245,
    vRecoil: 1.15, hRecoil: 0.60, recovery: 1.40, modes: ['safe', 'semi', 'auto'],
    tags: ['suppressor-optimised'], unlock: 5, price: 2100,
    desc: 'Built from the first sketch around a subsonic round. Silent, heavy-hitting inside 200 m, a rainbow beyond it.' }),

  build({ id: 'ho-mk8', name: 'Halloran Mk8', make: 'Halloran Ordnance', cls: 'rifle', caliber: '6.8x51',
    rpm: 700, mag: 20, massKg: 4.1, barrelMm: 406, spreadMoa: 1.5, erg: 58, adsMs: 330,
    vRecoil: 1.72, hRecoil: 0.68, recovery: 1.22, modes: ['safe', 'semi', 'auto'],
    unlock: 7, price: 3200,
    desc: 'High-pressure hybrid case: full-power ballistics from a carbine barrel. Defeats plate at range, and eats barrels.' }),

  // =========================================================================
  // DMRs and snipers
  // =========================================================================
  build({ id: 'ca-dm7', name: 'Cassara DM-7', make: 'Cassara Arms', cls: 'dmr', caliber: '7.62x51',
    rpm: 400, mag: 20, massKg: 4.4, barrelMm: 508, spreadMoa: 1.1, erg: 52, adsMs: 380,
    vRecoil: 1.95, hRecoil: 0.62, recovery: 1.10, modes: ['safe', 'semi'],
    unlock: 4, price: 2650,
    desc: 'Semi-automatic marksman rifle. Fast enough for a second shot, accurate enough that you rarely need one.' }),

  build({ id: 'vp-svk', name: 'Volkov SVK', make: 'Volkov Proizvodstvo', cls: 'dmr', caliber: '7.62x54r',
    rpm: 380, mag: 10, massKg: 4.3, barrelMm: 620, spreadMoa: 1.6, erg: 50, adsMs: 395,
    vRecoil: 2.05, hRecoil: 0.70, recovery: 1.05, modes: ['safe', 'semi'],
    unlock: 3, price: 2200,
    desc: 'Old-pattern designated marksman rifle. Rimmed cartridge, ten rounds, and it has been in every war since.' }),

  build({ id: 'tk-p65', name: 'Tenshou P-65', make: 'Tenshou Kikai', cls: 'sniper', caliber: '6.5x48',
    rpm: 45, mag: 10, massKg: 5.6, barrelMm: 610, spreadMoa: 0.42, erg: 40, adsMs: 520,
    vRecoil: 1.65, hRecoil: 0.42, recovery: 0.95, modes: ['safe', 'semi'],
    reloadMs: 3100, unlock: 6, price: 4600,
    desc: 'Bolt gun in a high-BC cartridge. Wind matters less, and the barrel is a consumable.' }),

  build({ id: 'aw-am86', name: 'Aldbrecht AM-86', make: 'Aldbrecht Werke', cls: 'sniper', caliber: '8.6x70',
    rpm: 40, mag: 5, massKg: 6.9, barrelMm: 690, spreadMoa: 0.55, erg: 33, adsMs: 610,
    vRecoil: 3.10, hRecoil: 0.80, recovery: 0.80, modes: ['safe', 'semi'],
    reloadMs: 3400, unlock: 8, price: 6400,
    desc: 'Magnum bolt action. Anything it hits stops being a tactical problem, and everyone inside a kilometre knows you fired.' }),

  // =========================================================================
  // Shotguns and support
  // =========================================================================
  build({ id: 'md-b12', name: 'Meridian B12', make: 'Meridian Defence', cls: 'shotgun', caliber: '18.5x70',
    rpm: 90, mag: 7, massKg: 3.3, barrelMm: 470, spreadMoa: 22, erg: 64, adsMs: 290,
    vRecoil: 3.40, hRecoil: 0.90, recovery: 1.00, modes: ['safe', 'semi'],
    reloadMs: 700, reloadEmptyMs: 700, unlock: 2, price: 760,
    desc: 'Pump gun, tube-fed one shell at a time. Buckshot, slug or a breaching round for a hinge.' }),

  build({ id: 'ca-as12', name: 'Cassara AS-12', make: 'Cassara Arms', cls: 'shotgun', caliber: '18.5x70',
    rpm: 300, mag: 8, massKg: 4.6, barrelMm: 470, spreadMoa: 24, erg: 52, adsMs: 340,
    vRecoil: 3.10, hRecoil: 1.40, recovery: 0.92, modes: ['safe', 'semi', 'auto'],
    reloadMs: 2900, unlock: 6, price: 2900,
    desc: 'Box-fed automatic shotgun. Empties itself in under two seconds and is completely unmanageable doing it.' }),

  build({ id: 'vp-pkm', name: 'Volkov PK-M', make: 'Volkov Proizvodstvo', cls: 'lmg', caliber: '7.62x54r',
    rpm: 700, mag: 100, massKg: 7.5, barrelMm: 605, spreadMoa: 3.0, erg: 30, adsMs: 640,
    vRecoil: 1.45, hRecoil: 0.95, recovery: 1.05, modes: ['safe', 'auto'],
    unlock: 5, price: 3400,
    desc: 'Belt-fed general purpose gun. Standing, it is a joke. On a bipod behind a wall, it owns the ground in front of it.' }),

  build({ id: 'ho-m9s', name: 'Halloran M9 Support', make: 'Halloran Ordnance', cls: 'lmg', caliber: '5.56x45',
    rpm: 850, mag: 100, massKg: 6.4, barrelMm: 465, spreadMoa: 3.4, erg: 36, adsMs: 580,
    vRecoil: 0.98, hRecoil: 0.68, recovery: 1.18, modes: ['safe', 'auto'],
    unlock: 4, price: 2800,
    desc: 'Belt-fed in the intermediate calibre. Lighter than the full-power guns and it still holds a corridor closed.' }),
];

export const WEAPON_MAP: ReadonlyMap<string, WeaponSpec> = new Map(WEAPONS.map((w) => [w.id, w]));

export function weaponsOfClass(cls: WeaponClass): WeaponSpec[] {
  return WEAPONS.filter((w) => w.class === cls);
}
