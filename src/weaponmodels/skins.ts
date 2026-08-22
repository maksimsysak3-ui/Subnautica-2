/**
 * Weapon finishes.
 *
 * OWNED BY: Weapon models.
 *
 * ## What a skin is here
 * Not a decal sheet. Every weapon in this project is built from a small set of
 * material *roles* — receiver, furniture, metalwork, accent — and a skin is a
 * re-colouring of those roles. That is why a skin applies correctly to a
 * bullpup, a pump shotgun and a pistol without any per-weapon authoring: it
 * describes a finish, not a texture placement.
 *
 * It also means a skin can change more than colour. A worn parkerised finish
 * is rougher AND lighter at the edges; a nitride coating is darker and glossier
 * than the aluminium it replaces. Roughness and metalness carry as much of the
 * read as hue does, and skins that only shift hue look like recolours because
 * that is what they are.
 *
 * ## Cost
 * Materials are cloned once per skin, not per weapon, and cached. A skin costs
 * one material set — the same as the base palette — no matter how many weapons
 * are wearing it.
 */

import * as THREE from 'three';
import { MATERIALS, type MatKey } from './parts';

export interface SkinOverride {
  color?: number;
  roughness?: number;
  metalness?: number;
}

export interface WeaponSkin {
  id: string;
  name: string;
  /** Short line shown in the loadout. Flavour, but it should say something. */
  blurb: string;
  /** 0 = issued to everyone, higher = earned. */
  unlockLevel: number;
  overrides: Partial<Record<MatKey, SkinOverride>>;
}

export const SKINS: WeaponSkin[] = [
  {
    id: 'issue',
    name: 'Issue',
    blurb: 'Phosphate over steel, black polymer. What it left the armoury as.',
    unlockLevel: 0,
    overrides: {},
  },
  {
    id: 'fde',
    name: 'Flat Dark Earth',
    blurb: 'Cerakote furniture. Standard for anyone who buys their own.',
    unlockLevel: 0,
    overrides: {
      polymerBlack: { color: 0x8b7c5f, roughness: 0.88 },
      polymerMid: { color: 0x9c8c6c, roughness: 0.86 },
      parkerised: { color: 0x6a6455, roughness: 0.62, metalness: 0.22 },
      aluDark: { color: 0x6d6555, roughness: 0.50 },
    },
  },
  {
    id: 'ranger',
    name: 'Ranger Green',
    blurb: 'Olive polymer, black metalwork. Disappears in anything that grows.',
    unlockLevel: 2,
    overrides: {
      polymerBlack: { color: 0x4b5240, roughness: 0.90 },
      polymerMid: { color: 0x5b6350, roughness: 0.88 },
      parkerised: { color: 0x484d46, roughness: 0.60 },
    },
  },
  {
    id: 'nitride',
    name: 'Black Nitride',
    blurb: 'Salt-bath nitrided. Harder than the steel under it, and it shows.',
    unlockLevel: 4,
    overrides: {
      parkerised: { color: 0x33363a, roughness: 0.28, metalness: 0.55 },
      blued: { color: 0x1c1e21, roughness: 0.18, metalness: 0.72 },
      alu: { color: 0x4a4e54, roughness: 0.22, metalness: 0.70 },
      aluDark: { color: 0x35383d, roughness: 0.26, metalness: 0.60 },
    },
  },
  {
    id: 'saltflat',
    name: 'Salt Flat',
    blurb: 'Sun-bleached and sand-scoured. Nothing about it was a choice.',
    unlockLevel: 3,
    overrides: {
      parkerised: { color: 0x7d786c, roughness: 0.82, metalness: 0.14 },
      polymerBlack: { color: 0x6e6a60, roughness: 0.95 },
      polymerMid: { color: 0x8a8375, roughness: 0.94 },
      blued: { color: 0x54504a, roughness: 0.58, metalness: 0.40 },
      alu: { color: 0x9a958a, roughness: 0.55, metalness: 0.45 },
    },
  },
  {
    id: 'winter',
    name: 'Winter Line',
    blurb: 'Sprayed white over whatever was underneath. It wears through.',
    unlockLevel: 5,
    overrides: {
      parkerised: { color: 0xb9bcbd, roughness: 0.88, metalness: 0.10 },
      polymerBlack: { color: 0xa8acad, roughness: 0.93 },
      polymerMid: { color: 0xc2c5c4, roughness: 0.92 },
      aluDark: { color: 0x9ca09f, roughness: 0.80, metalness: 0.15 },
      blued: { color: 0x3a3d40, roughness: 0.40, metalness: 0.60 },
    },
  },
  {
    id: 'tigerstripe',
    name: 'Tiger Stripe',
    blurb: 'Somebody spent an evening with tape and two rattlecans.',
    unlockLevel: 7,
    overrides: {
      parkerised: { color: 0x5c5b40, roughness: 0.86, metalness: 0.12 },
      polymerBlack: { color: 0x2e2f24, roughness: 0.94 },
      polymerMid: { color: 0x77754f, roughness: 0.92 },
      aluDark: { color: 0x50503a, roughness: 0.72 },
    },
  },
  {
    id: 'brass',
    name: 'Commission',
    blurb: 'Gold trigger, engraved receiver. It shoots exactly as well.',
    unlockLevel: 10,
    overrides: {
      parkerised: { color: 0x3b3a36, roughness: 0.30, metalness: 0.70 },
      alu: { color: 0xc9a24e, roughness: 0.24, metalness: 0.92 },
      aluDark: { color: 0xa8853c, roughness: 0.30, metalness: 0.88 },
      blued: { color: 0x1e1f22, roughness: 0.14, metalness: 0.90 },
      polymerMid: { color: 0x4a3f34, roughness: 0.70 },
    },
  },
];

export const SKIN_MAP = new Map(SKINS.map((s) => [s.id, s]));

/**
 * Material set for a skin.
 *
 * Cloned once per skin and cached, so a skin costs one material set no matter
 * how many weapons wear it. The base set is returned unchanged for 'issue',
 * which means the common case allocates nothing at all.
 */
const cache = new Map<string, Record<MatKey, THREE.Material>>();

export function materialsForSkin(skinId: string): Record<MatKey, THREE.Material> {
  if (!skinId || skinId === 'issue') return MATERIALS;
  const hit = cache.get(skinId);
  if (hit) return hit;

  const skin = SKIN_MAP.get(skinId);
  if (!skin) return MATERIALS;

  const out = { ...MATERIALS } as Record<MatKey, THREE.Material>;
  for (const [key, ov] of Object.entries(skin.overrides) as Array<[MatKey, SkinOverride]>) {
    const base = MATERIALS[key];
    if (!base) continue;
    const m = base.clone() as THREE.MeshStandardMaterial;
    if (ov.color !== undefined) m.color.setHex(ov.color);
    if (ov.roughness !== undefined) m.roughness = ov.roughness;
    if (ov.metalness !== undefined) m.metalness = ov.metalness;
    out[key] = m;
  }
  cache.set(skinId, out);
  return out;
}

export function disposeSkins(): void {
  for (const set of cache.values()) {
    for (const [k, m] of Object.entries(set)) {
      // Only the clones — the base set belongs to parts.ts.
      if (m !== MATERIALS[k as MatKey]) m.dispose();
    }
  }
  cache.clear();
}
