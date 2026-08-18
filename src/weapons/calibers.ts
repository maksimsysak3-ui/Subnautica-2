/**
 * Cartridge families.
 *
 * OWNED BY: Weapon systems.
 *
 * A caliber is the physics substrate an ammo type sits on: bore diameter (which
 * fixes the cross-sectional area every penetration calculation needs), chamber
 * pressure (heat and wear), and the barrel-length velocity curve. Ammo specs
 * quote muzzle velocity from `refBarrelMm`; a 10.3" carbine firing 5.56 loses
 * real velocity against the 20" reference, and that shows up downrange as drop
 * and as lost penetration. Nothing here is a fudge factor.
 *
 * Designations are metric case dimensions — the way the rest of the world names
 * cartridges — so the arsenal reads as plausible without borrowing trademarks.
 */

export type CaliberFamily = 'pistol' | 'pdw' | 'intermediate' | 'fullpower' | 'magnum' | 'shotgun';

export interface CaliberSpec {
  id: string;
  name: string;
  /** Projectile diameter in mm. Cross-section drives penetration energy cost. */
  boreMm: number;
  family: CaliberFamily;
  /** Nominal peak chamber pressure, MPa. Feeds wear, heat and report loudness. */
  pressureMPa: number;
  /** Barrel length the ammo table's muzzle velocities are quoted from. */
  refBarrelMm: number;
  /** m/s gained per mm of barrel beyond the reference (lost below it). */
  velocityPerMm: number;
  /** Baseline free-recoil scalar; ammo recoilMultiplier rides on top. */
  impulse: number;
  /** Case volume proxy — larger cases dump more gas into a muzzle device. */
  gasVolume: number;
  description: string;
}

function cal(
  id: string, name: string, boreMm: number, family: CaliberFamily,
  pressureMPa: number, refBarrelMm: number, velocityPerMm: number,
  impulse: number, gasVolume: number, description: string,
): CaliberSpec {
  return { id, name, boreMm, family, pressureMPa, refBarrelMm, velocityPerMm, impulse, gasVolume, description };
}

export const CALIBERS: CaliberSpec[] = [
  cal('9x19', '9×19mm', 9.01, 'pistol', 235, 118, 0.22, 1.00, 0.55,
    'The regional service pistol and SMG round. Cheap, quiet when subsonic, weak against plate.'),
  cal('7.62x25', '7.62×25mm', 7.87, 'pistol', 260, 116, 0.26, 0.92, 0.60,
    'Bottlenecked high-velocity pistol round. Flat, loud, punches soft armour that stops 9mm.'),
  cal('11.43x23', '11.43×23mm', 11.50, 'pistol', 145, 127, 0.16, 1.35, 0.62,
    'Big, slow, subsonic out of anything. Enormous wound channel, stopped by any real plate.'),
  cal('10x25', '10×25mm', 10.17, 'pistol', 230, 127, 0.24, 1.42, 0.72,
    'The full-power auto pistol round. Recoils like a magnum, feeds like a service gun.'),
  cal('9x33r', '9×33mmR', 9.07, 'magnum', 240, 152, 0.30, 1.55, 0.78,
    'Rimmed magnum revolver cartridge. Nothing about it is subtle, including the muzzle blast.'),
  cal('4.6x30', '4.6×30mm', 4.65, 'pdw', 350, 180, 0.34, 0.42, 0.34,
    'Tiny hardened dart at rifle velocity. Defeats soft armour, wastes itself on flesh.'),
  cal('5.7x28', '5.7×28mm', 5.70, 'pdw', 345, 260, 0.30, 0.46, 0.38,
    'PDW round built around armour defeat and a fifty-round magazine you barely feel.'),
  cal('5.56x45', '5.56×45mm', 5.70, 'intermediate', 430, 508, 0.31, 1.00, 1.00,
    'The standard intermediate round. Velocity-dependent — short barrels cost you terminal effect.'),
  cal('5.45x39', '5.45×39mm', 5.60, 'intermediate', 380, 415, 0.29, 0.94, 0.96,
    'Long, low-drag and unstable in tissue. Mild recoil, excellent barrier-to-noise ratio.'),
  cal('7.62x39', '7.62×39mm', 7.92, 'intermediate', 355, 415, 0.27, 1.62, 1.14,
    'Heavy intermediate round. Wallbangs where 5.56 splashes; drops like a thrown brick past 300 m.'),
  cal('7.62x35', '7.62×35mm', 7.82, 'intermediate', 380, 229, 0.38, 1.24, 0.74,
    'Purpose-built for short barrels and cans. Runs supersonic light or subsonic very heavy.'),
  cal('9x39', '9×39mm', 9.25, 'intermediate', 240, 200, 0.20, 1.30, 0.66,
    'Always subsonic, always heavy. Designed from the first sketch to live behind a suppressor.'),
  cal('6.8x51', '6.8×51mm', 7.00, 'fullpower', 550, 406, 0.36, 1.86, 1.34,
    'High-pressure hybrid case. Full-power ballistics from a carbine, and wear to match.'),
  cal('7.62x51', '7.62×51mm', 7.82, 'fullpower', 415, 508, 0.35, 2.05, 1.42,
    'The full-power battle standard. Barrier blind, punishing to shoot fast, honest at 800 m.'),
  cal('6.5x48', '6.5×48mm', 6.70, 'fullpower', 420, 610, 0.33, 1.58, 1.28,
    'Long high-BC bullets in a short-action case. Buys wind immunity with barrel life.'),
  cal('7.62x54r', '7.62×54mmR', 7.92, 'fullpower', 390, 620, 0.34, 2.10, 1.48,
    'Rimmed legacy full-power round. Belt-fed, drum-fed, and still fielded everywhere.'),
  cal('8.6x70', '8.6×70mm', 8.60, 'magnum', 420, 690, 0.38, 3.40, 2.20,
    'Magnum sniping cartridge. Transonic past 1400 m, and it hits like a car door until then.'),
  cal('12.7x99', '12.7×99mm', 12.95, 'magnum', 370, 737, 0.42, 6.80, 4.60,
    'Anti-materiel round. Defeats hard plate at any range you can see the target.'),
  cal('12.7x55', '12.7×55mm', 12.85, 'pistol', 180, 420, 0.20, 2.90, 1.05,
    'Enormous subsonic bullet at pistol velocity. Suppressed, it is quieter than the bolt cycling.'),
  cal('18.5x70', '18.5×70mm', 18.53, 'shotgun', 105, 470, 0.14, 3.10, 2.40,
    'Twelve-bore shell. Buckshot, slug, sabot or breaching — one bore, four completely different guns.'),
];

export const CALIBER_MAP: ReadonlyMap<string, CaliberSpec> = new Map(CALIBERS.map((c) => [c.id, c]));

/** Cross-sectional area of the bore, m². The denominator of every penetration sum. */
export function boreArea(cal: CaliberSpec): number {
  const r = cal.boreMm * 0.0005; // mm diameter -> m radius
  return Math.PI * r * r;
}

/**
 * Muzzle velocity out of a real barrel rather than the catalogue barrel.
 * Clamped so a 4" 5.56 pistol does not asymptote to zero.
 */
export function velocityForBarrel(cal: CaliberSpec, quotedMs: number, barrelMm: number): number {
  const delta = (barrelMm - cal.refBarrelMm) * cal.velocityPerMm;
  return Math.max(quotedMs * 0.55, quotedMs + delta);
}
