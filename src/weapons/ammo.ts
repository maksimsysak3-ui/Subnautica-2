/**
 * Ammunition.
 *
 * OWNED BY: Weapon systems.
 *
 * The design goal here is the one thing Tarkov gets more right than any other
 * shooter: **what you load matters as much as what you carry.** A carbine
 * firing cheap steel-core is a different weapon from the same carbine firing
 * match hollow-point, and the player should be able to feel that difference
 * without reading a stat screen.
 *
 * That means every field below has to *do* something in the simulation:
 *
 *   massG + bc      → retained velocity and drop downrange (ballistics.ts)
 *   muzzleVelocity  → quoted from the caliber's reference barrel, then
 *                     corrected for the actual barrel (calibers.ts)
 *   penetration     → compared against armour class; partial penetration is a
 *                     real outcome, not a coin flip
 *   fragmentation   → trades penetration for wound severity
 *   damage          → flesh damage before region multipliers
 *
 * Nothing is a pure upgrade. Armour-piercing loads carry less bullet mass and
 * fragment poorly, so they punch plate and under-perform against an unarmoured
 * target. Subsonic loads are quiet and hit hard up close but bleed velocity and
 * drop badly. That tension is the whole point.
 */

import type { AmmoSpec } from '../core/contracts';
import { CALIBER_MAP } from './calibers';

type AmmoKind = 'fmj' | 'jhp' | 'ap' | 'match' | 'subsonic' | 'tracer' | 'buck' | 'slug' | 'sabot' | 'breach' | 'frangible';

/** Per-kind behavioural defaults, before the caliber's own character is applied. */
const KIND: Record<AmmoKind, {
  penDelta: number; damageMul: number; fragMul: number;
  massMul: number; velMul: number; priceMul: number; malfunction: number;
}> = {
  //           pen   dmg   frag  mass  vel   price  jam
  fmj:       { penDelta: 0,   damageMul: 1.00, fragMul: 0.35, massMul: 1.00, velMul: 1.00, priceMul: 1.0, malfunction: 0.00040 },
  jhp:       { penDelta: -2,  damageMul: 1.55, fragMul: 0.95, massMul: 1.02, velMul: 0.97, priceMul: 1.6, malfunction: 0.00055 },
  ap:        { penDelta: +2,  damageMul: 0.78, fragMul: 0.05, massMul: 0.92, velMul: 1.05, priceMul: 3.2, malfunction: 0.00035 },
  match:     { penDelta: 0,   damageMul: 1.12, fragMul: 0.45, massMul: 1.08, velMul: 1.02, priceMul: 2.4, malfunction: 0.00018 },
  subsonic:  { penDelta: -1,  damageMul: 1.20, fragMul: 0.20, massMul: 1.85, velMul: 0.42, priceMul: 1.9, malfunction: 0.00075 },
  tracer:    { penDelta: -1,  damageMul: 0.92, fragMul: 0.30, massMul: 0.96, velMul: 0.99, priceMul: 1.3, malfunction: 0.00060 },
  frangible: { penDelta: -3,  damageMul: 1.70, fragMul: 1.00, massMul: 0.88, velMul: 1.03, priceMul: 2.0, malfunction: 0.00050 },
  buck:      { penDelta: -1,  damageMul: 1.00, fragMul: 0.60, massMul: 1.00, velMul: 1.00, priceMul: 1.0, malfunction: 0.00060 },
  slug:      { penDelta: +1,  damageMul: 2.60, fragMul: 0.15, massMul: 1.00, velMul: 1.00, priceMul: 1.5, malfunction: 0.00070 },
  sabot:     { penDelta: +3,  damageMul: 1.90, fragMul: 0.05, massMul: 0.55, velMul: 1.45, priceMul: 3.4, malfunction: 0.00065 },
  breach:    { penDelta: -4,  damageMul: 0.35, fragMul: 1.00, massMul: 1.10, velMul: 0.75, priceMul: 2.2, malfunction: 0.00080 },
};

const KIND_LABEL: Record<AmmoKind, string> = {
  fmj: 'FMJ', jhp: 'JHP', ap: 'AP', match: 'Match', subsonic: 'Subsonic',
  tracer: 'Tracer', frangible: 'Frangible', buck: 'Buckshot', slug: 'Slug',
  sabot: 'Sabot', breach: 'Breaching',
};

interface AmmoSeed {
  caliber: string;
  kind: AmmoKind;
  /** Base bullet mass in grams for this caliber's standard load. */
  massG: number;
  /** Quoted muzzle velocity from the caliber's reference barrel, m/s. */
  velocity: number;
  /** G7 ballistic coefficient of the standard load. */
  bc: number;
  /** Armour penetration class of the standard load, 1..6. */
  pen: number;
  /** Flesh damage of the standard load before kind multipliers. */
  damage: number;
  price: number;
  /** Overrides for loads that don't follow their kind's pattern. */
  over?: Partial<AmmoSpec>;
  suffix?: string;
  note?: string;
}

function make(seed: AmmoSeed): AmmoSpec {
  const cal = CALIBER_MAP.get(seed.caliber);
  if (!cal) throw new Error(`[ammo] unknown caliber "${seed.caliber}"`);
  const k = KIND[seed.kind];

  const massG = seed.massG * k.massMul;
  const velocity = seed.velocity * k.velMul;

  // Heavier bullets of the same shape carry better: BC scales with sectional
  // density, so a heavy subsonic load retains velocity well even though it
  // starts slow.
  const bc = seed.bc * (massG / seed.massG) ** 0.65;

  // Penetration is really about energy per unit area at the plate. The kind
  // delta is the construction (hardened core, expanding jacket); the velocity
  // term is what the load is actually doing when it arrives.
  const velFactor = (velocity / seed.velocity) ** 0.8;
  const penetration = Math.max(1, Math.min(6,
    Math.round((seed.pen + k.penDelta) * velFactor * 10) / 10));

  const label = seed.suffix ?? KIND_LABEL[seed.kind];

  return {
    id: `${seed.caliber}-${seed.kind}${seed.suffix ? '-' + seed.suffix.toLowerCase().replace(/\s+/g, '') : ''}`,
    name: `${cal.name} ${label}`,
    caliber: seed.caliber,
    massG: Math.round(massG * 10) / 10,
    muzzleVelocity: Math.round(velocity),
    bc: Math.round(bc * 1000) / 1000,
    penetration,
    damage: Math.round(seed.damage * k.damageMul),
    fragmentation: Math.min(1, k.fragMul),
    tracer: seed.kind === 'tracer' ? 1 : 0,
    // Muzzle flash tracks how much unburnt powder is still leaving the barrel.
    flashMultiplier: seed.kind === 'subsonic' ? 0.35 : 1 + (cal.gasVolume - 1) * 0.35,
    recoilMultiplier: (massG * velocity) / (seed.massG * seed.velocity),
    malfunctionChance: k.malfunction,
    price: Math.round(seed.price * k.priceMul),
    ...seed.over,
  };
}

/** Expand one caliber into its available loads. */
function loads(base: Omit<AmmoSeed, 'kind'>, kinds: AmmoKind[]): AmmoSpec[] {
  return kinds.map((kind) => make({ ...base, kind }));
}

export const AMMO: AmmoSpec[] = [
  // --- pistol ---------------------------------------------------------------
  ...loads({ caliber: '9x19', massG: 8.0, velocity: 375, bc: 0.135, pen: 2, damage: 52, price: 14 },
    ['fmj', 'jhp', 'ap', 'subsonic', 'tracer', 'frangible']),
  ...loads({ caliber: '7.62x25', massG: 5.5, velocity: 455, bc: 0.118, pen: 3, damage: 48, price: 16 },
    ['fmj', 'jhp', 'ap']),
  ...loads({ caliber: '11.43x23', massG: 14.9, velocity: 253, bc: 0.162, pen: 1, damage: 72, price: 18 },
    ['fmj', 'jhp', 'frangible']),
  ...loads({ caliber: '10x25', massG: 11.7, velocity: 360, bc: 0.156, pen: 2, damage: 66, price: 22 },
    ['fmj', 'jhp', 'ap']),
  ...loads({ caliber: '9x33r', massG: 10.2, velocity: 430, bc: 0.148, pen: 3, damage: 78, price: 28 },
    ['fmj', 'jhp']),

  // --- PDW ------------------------------------------------------------------
  ...loads({ caliber: '4.6x30', massG: 2.6, velocity: 660, bc: 0.098, pen: 4, damage: 34, price: 26 },
    ['fmj', 'ap', 'subsonic']),
  ...loads({ caliber: '5.7x28', massG: 2.0, velocity: 715, bc: 0.104, pen: 4, damage: 33, price: 27 },
    ['fmj', 'ap', 'jhp']),

  // --- intermediate ---------------------------------------------------------
  ...loads({ caliber: '5.56x45', massG: 4.0, velocity: 920, bc: 0.151, pen: 4, damage: 54, price: 32 },
    ['fmj', 'jhp', 'ap', 'match', 'tracer', 'frangible']),
  ...loads({ caliber: '5.45x39', massG: 3.4, velocity: 880, bc: 0.168, pen: 4, damage: 51, price: 29 },
    ['fmj', 'ap', 'tracer']),
  ...loads({ caliber: '7.62x39', massG: 7.9, velocity: 730, bc: 0.191, pen: 4, damage: 68, price: 30 },
    ['fmj', 'jhp', 'ap', 'tracer']),
  ...loads({ caliber: '7.62x35', massG: 8.1, velocity: 790, bc: 0.196, pen: 4, damage: 70, price: 44 },
    ['fmj', 'subsonic', 'ap']),
  ...loads({ caliber: '9x39', massG: 16.2, velocity: 295, bc: 0.255, pen: 4, damage: 86, price: 58 },
    ['fmj', 'ap', 'jhp'], ),

  // --- full power -----------------------------------------------------------
  ...loads({ caliber: '6.8x51', massG: 8.7, velocity: 900, bc: 0.271, pen: 5, damage: 86, price: 62 },
    ['fmj', 'ap', 'match']),
  ...loads({ caliber: '7.62x51', massG: 9.5, velocity: 838, bc: 0.243, pen: 5, damage: 90, price: 55 },
    ['fmj', 'jhp', 'ap', 'match', 'subsonic', 'tracer']),
  ...loads({ caliber: '6.5x48', massG: 9.0, velocity: 855, bc: 0.315, pen: 5, damage: 84, price: 68 },
    ['fmj', 'match', 'ap']),
  ...loads({ caliber: '7.62x54r', massG: 9.8, velocity: 830, bc: 0.248, pen: 5, damage: 92, price: 52 },
    ['fmj', 'ap', 'match', 'tracer']),

  // --- magnum / anti-materiel ----------------------------------------------
  ...loads({ caliber: '8.6x70', massG: 16.2, velocity: 880, bc: 0.368, pen: 6, damage: 124, price: 140 },
    ['fmj', 'match', 'ap']),
  ...loads({ caliber: '12.7x99', massG: 41.9, velocity: 853, bc: 0.520, pen: 6, damage: 220, price: 320 },
    ['fmj', 'ap']),
  ...loads({ caliber: '12.7x55', massG: 38.0, velocity: 300, bc: 0.288, pen: 3, damage: 145, price: 96 },
    ['fmj', 'subsonic', 'ap']),

  // --- shotgun --------------------------------------------------------------
  // Buckshot damage is *per pellet*; the pellet count lives on the weapon's
  // shot pattern, so one shell is genuinely a spread of independent hits.
  ...loads({ caliber: '18.5x70', massG: 3.5, velocity: 410, bc: 0.042, pen: 2, damage: 26, price: 20 },
    ['buck']),
  ...loads({ caliber: '18.5x70', massG: 28.4, velocity: 460, bc: 0.098, pen: 2, damage: 52, price: 24 },
    ['slug', 'sabot', 'breach']),
];

export const AMMO_MAP: ReadonlyMap<string, AmmoSpec> = new Map(AMMO.map((a) => [a.id, a]));

/** Loads available for a caliber, cheapest first — used by the gunsmith UI. */
export function ammoForCaliber(caliber: string): AmmoSpec[] {
  return AMMO.filter((a) => a.caliber === caliber).sort((a, b) => a.price - b.price);
}

/**
 * Pellets per trigger pull. Only shotguns fire more than one; buckshot is the
 * reason a shotgun is a different weapon rather than a high-damage rifle.
 */
export function pelletCount(ammo: AmmoSpec): number {
  if (ammo.caliber !== '18.5x70') return 1;
  if (ammo.id.includes('buck')) return 9;
  return 1;
}

/** True when the round stays below the speed of sound and makes no crack. */
export function isSubsonic(ammo: AmmoSpec): boolean {
  return ammo.muzzleVelocity < 343;
}
