/**
 * Material table.
 *
 * A site reads as a *place* rather than as primitives when hue, value and
 * roughness change from surface to surface. Every brick carries a material
 * index into this table; the renderer builds exactly one InstancedMesh per
 * (material, shape) pair, so adding entries here costs draw calls — keep the
 * table tight and use the per-instance tint for variation within a material.
 *
 * Colours are authored in linear-ish sRGB hex. Values are deliberately kept
 * mid-range (0.25..0.65 luminance) because ACES tone mapping plus a strong sky
 * ambient crushes anything darker into mud.
 */

import * as THREE from 'three';
import type { SurfaceKind } from '../core/contracts';

export interface MatDef {
  color: number;
  roughness: number;
  metalness: number;
  /** Default surface kind for bricks using this material. */
  surface: SurfaceKind;
  /** Flat shading is the house style; smooth is reserved for water/pipes. */
  smooth?: boolean;
  /** 0 = opaque. */
  opacity?: number;
  emissive?: number;
  emissiveIntensity?: number;
  /** Rendered without shadow casting — thin trim, glass, foliage cards. */
  noShadow?: boolean;
  /** Renders both faces (foliage, fabric, thin panels). */
  double?: boolean;
}

/**
 * Order matters only in that `M` is derived from it; adding to the end is
 * always safe.
 */
const DEFS = {
  // --- masonry ------------------------------------------------------------
  plasterWhite:  { color: 0xd9d2c4, roughness: 0.95, metalness: 0.0, surface: 'concrete' },
  plasterCream:  { color: 0xcdbfa2, roughness: 0.95, metalness: 0.0, surface: 'concrete' },
  plasterOchre:  { color: 0xc19a63, roughness: 0.93, metalness: 0.0, surface: 'concrete' },
  plasterRose:   { color: 0xc08f7c, roughness: 0.94, metalness: 0.0, surface: 'concrete' },
  plasterSage:   { color: 0x9fa88a, roughness: 0.94, metalness: 0.0, surface: 'concrete' },
  stucco:        { color: 0xb5a68e, roughness: 0.97, metalness: 0.0, surface: 'concrete' },
  concreteRaw:   { color: 0x8e8a83, roughness: 0.93, metalness: 0.0, surface: 'concrete' },
  concreteDark:  { color: 0x5f5c58, roughness: 0.92, metalness: 0.0, surface: 'concrete' },
  stoneTrim:     { color: 0xa89c86, roughness: 0.88, metalness: 0.0, surface: 'concrete' },
  brickRed:      { color: 0x9a5a45, roughness: 0.92, metalness: 0.0, surface: 'concrete' },
  drywall:       { color: 0xcfc9be, roughness: 0.96, metalness: 0.0, surface: 'drywall' },

  // --- roofing ------------------------------------------------------------
  terracotta:    { color: 0xa5573a, roughness: 0.90, metalness: 0.0, surface: 'ceramic' },
  terracottaOld: { color: 0x8a5140, roughness: 0.93, metalness: 0.0, surface: 'ceramic' },
  corrugated:    { color: 0x8d8578, roughness: 0.70, metalness: 0.45, surface: 'metal' },
  bitumen:       { color: 0x4a4744, roughness: 0.95, metalness: 0.0, surface: 'concrete' },

  // --- metal --------------------------------------------------------------
  steelGalv:     { color: 0x9aa1a6, roughness: 0.52, metalness: 0.75, surface: 'metal' },
  steelDark:     { color: 0x4e5459, roughness: 0.55, metalness: 0.80, surface: 'metal' },
  rust:          { color: 0x8a4f31, roughness: 0.88, metalness: 0.35, surface: 'metal' },
  paintBlue:     { color: 0x35607e, roughness: 0.60, metalness: 0.40, surface: 'metal' },
  paintGreen:    { color: 0x3f6b53, roughness: 0.62, metalness: 0.40, surface: 'metal' },
  paintRed:      { color: 0x8e3a30, roughness: 0.62, metalness: 0.40, surface: 'metal' },
  paintYellow:   { color: 0xb99331, roughness: 0.64, metalness: 0.35, surface: 'metal' },
  brass:         { color: 0xc8a355, roughness: 0.38, metalness: 0.85, surface: 'metal' },

  // --- wood ---------------------------------------------------------------
  woodDark:      { color: 0x5c3f2b, roughness: 0.80, metalness: 0.0, surface: 'wood' },
  woodWarm:      { color: 0x8a6039, roughness: 0.82, metalness: 0.0, surface: 'wood' },
  woodPale:      { color: 0xb59667, roughness: 0.85, metalness: 0.0, surface: 'wood' },
  woodWeathered: { color: 0x8d8474, roughness: 0.93, metalness: 0.0, surface: 'wood' },

  // --- floors -------------------------------------------------------------
  marble:        { color: 0xd6cfc2, roughness: 0.30, metalness: 0.05, surface: 'tile' },
  tileTerra:     { color: 0xa9694a, roughness: 0.55, metalness: 0.03, surface: 'tile' },
  tileTalavera:  { color: 0x3f6f86, roughness: 0.42, metalness: 0.05, surface: 'tile' },
  poolTile:      { color: 0x2f8ba0, roughness: 0.28, metalness: 0.05, surface: 'tile' },
  asphalt:       { color: 0x413f3d, roughness: 0.96, metalness: 0.0, surface: 'concrete' },
  gravelMat:     { color: 0x8b8272, roughness: 0.99, metalness: 0.0, surface: 'gravel' },
  dirtMat:       { color: 0x7a6547, roughness: 0.99, metalness: 0.0, surface: 'dirt' },
  sandMat:       { color: 0xb8a179, roughness: 0.99, metalness: 0.0, surface: 'sand' },

  // --- soft ---------------------------------------------------------------
  fabricCream:   { color: 0xc4b79c, roughness: 1.00, metalness: 0.0, surface: 'fabric' },
  fabricRed:     { color: 0x8c4038, roughness: 1.00, metalness: 0.0, surface: 'fabric' },
  fabricTeal:    { color: 0x3d6b6b, roughness: 1.00, metalness: 0.0, surface: 'fabric' },
  leather:       { color: 0x6b4a34, roughness: 0.72, metalness: 0.0, surface: 'fabric' },
  sandbag:       { color: 0x9c8f6d, roughness: 1.00, metalness: 0.0, surface: 'sand' },
  rubber:        { color: 0x2a2a2c, roughness: 0.90, metalness: 0.0, surface: 'rubber' },
  plasticWhite:  { color: 0xc9c6bd, roughness: 0.55, metalness: 0.0, surface: 'plastic' },

  // --- vegetation ---------------------------------------------------------
  leafDark:      { color: 0x3c5730, roughness: 1.00, metalness: 0.0, surface: 'foliage', double: true },
  leafMid:       { color: 0x54713a, roughness: 1.00, metalness: 0.0, surface: 'foliage', double: true },
  leafDry:       { color: 0x7d7e42, roughness: 1.00, metalness: 0.0, surface: 'foliage', double: true },
  bark:          { color: 0x6a5844, roughness: 0.95, metalness: 0.0, surface: 'wood' },
  lawn:          { color: 0x5d7440, roughness: 1.00, metalness: 0.0, surface: 'grass' },

  // --- transparent --------------------------------------------------------
  glass:         { color: 0x9fc4d2, roughness: 0.06, metalness: 0.25, surface: 'glass', opacity: 0.24, smooth: true, noShadow: true },
  water:         { color: 0x2f7f96, roughness: 0.05, metalness: 0.30, surface: 'water', opacity: 0.72, smooth: true, noShadow: true },

  // --- emissive -----------------------------------------------------------
  lampWarm:      { color: 0xffd9a0, roughness: 0.4, metalness: 0.0, surface: 'glass', emissive: 0xffb35c, emissiveIntensity: 2.2, noShadow: true },
  lampCold:      { color: 0xcfe6ff, roughness: 0.4, metalness: 0.0, surface: 'glass', emissive: 0x9fc8ff, emissiveIntensity: 1.6, noShadow: true },
  neonRed:       { color: 0xff6a5a, roughness: 0.4, metalness: 0.0, surface: 'plastic', emissive: 0xff3b28, emissiveIntensity: 2.6, noShadow: true },
} satisfies Record<string, MatDef>;

export type MatName = keyof typeof DEFS;

const NAMES = Object.keys(DEFS) as MatName[];

/** `M.plasterWhite` → material index. */
export const M = Object.fromEntries(NAMES.map((n, i) => [n, i])) as Record<MatName, number>;

export const MATERIALS: MatDef[] = NAMES.map((n) => DEFS[n] as MatDef);
export const MATERIAL_NAMES: readonly string[] = NAMES;

/**
 * Builds the THREE materials. Instanced meshes carry per-instance colour, so
 * every material sets `vertexColors` — the instanceColor attribute multiplies
 * the base colour and gives us free variation without extra draw calls.
 */
export function buildThreeMaterials(): THREE.MeshStandardMaterial[] {
  return MATERIALS.map((d) => {
    const m = new THREE.MeshStandardMaterial({
      color: d.color,
      roughness: d.roughness,
      metalness: d.metalness,
      flatShading: !d.smooth,
      // NOT vertexColors: brick geometry carries no per-vertex colour
      // attribute. Setting it defines USE_COLOR, and the missing attribute
      // then supplies WebGL's default (0,0,0), multiplying every brick to
      // black. Per-brick tint arrives through instanceColor, which three
      // applies independently of this flag.
      side: d.double ? THREE.DoubleSide : THREE.FrontSide,
    });
    if (d.opacity !== undefined) {
      m.transparent = true;
      m.opacity = d.opacity;
      m.depthWrite = false;
    }
    if (d.emissive !== undefined) {
      m.emissive = new THREE.Color(d.emissive);
      m.emissiveIntensity = d.emissiveIntensity ?? 1;
    }
    return m;
  });
}

// ---------------------------------------------------------------------------
// Tint helpers — deterministic per-brick colour jitter.
// ---------------------------------------------------------------------------

const _c = new THREE.Color();

/**
 * Packs a multiplicative tint. `v` shifts value, `h` rotates hue slightly.
 * Real plaster is never one flat colour; a ±6% value jitter across a wall run
 * is the single cheapest thing that stops geometry reading as CAD output.
 */
export function tint(value: number, hueShift = 0, sat = 1): number {
  _c.setRGB(1, 1, 1);
  _c.setHSL((0.5 + hueShift + 1) % 1, 0, 0.5);
  const v = Math.max(0, Math.min(2, value));
  // Build the multiplier directly in RGB: hue shift biases the channels.
  const r = v * (1 + hueShift * 2.2 * sat);
  const g = v * (1 + hueShift * 0.2 * sat);
  const b = v * (1 - hueShift * 2.0 * sat);
  return packTint(r, g, b);
}

export function packTint(r: number, g: number, b: number): number {
  const q = (x: number): number => Math.max(0, Math.min(255, Math.round(x * 127.5)));
  return (q(r) << 16) | (q(g) << 8) | q(b);
}

export function unpackTint(t: number, out: THREE.Color): THREE.Color {
  out.setRGB(((t >> 16) & 255) / 127.5, ((t >> 8) & 255) / 127.5, (t & 255) / 127.5);
  return out;
}

/** Neutral tint (multiplier 1,1,1). */
export const TINT_NEUTRAL = packTint(1, 1, 1);
