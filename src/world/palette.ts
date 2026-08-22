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
import { surfaceTexture, type TextureKind } from './textures';

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
  /**
   * Procedural detail texture, and how many tiles per world metre.
   *
   * Untextured geometry does not look "clean", it looks unfinished — what it
   * is missing is high-frequency break-up, which is exactly what noise
   * provides. The textures are greyscale and multiply the base colour, so the
   * value separation this table is built around survives intact.
   */
  tex?: TextureKind;
  texScale?: number;
}

/**
 * Order matters only in that `M` is derived from it; adding to the end is
 * always safe.
 */
const DEFS = {
  // --- masonry ------------------------------------------------------------
  plasterWhite:  { color: 0xd9d2c4, roughness: 0.95, metalness: 0.0, surface: 'concrete' },
  plasterCream:  { color: 0xcdbfa2, roughness: 0.95, metalness: 0.0, surface: 'concrete' },
  plasterOchre:  { color: 0xc19a63, roughness: 0.93, metalness: 0.0, surface: 'concrete', tex: 'stucco', texScale: 0.9 },
  plasterRose:   { color: 0xc08f7c, roughness: 0.94, metalness: 0.0, surface: 'concrete', tex: 'stucco', texScale: 0.9 },
  plasterSage:   { color: 0x9fa88a, roughness: 0.94, metalness: 0.0, surface: 'concrete', tex: 'stucco', texScale: 0.9 },
  stucco:        { color: 0xb5a68e, roughness: 0.97, metalness: 0.0, surface: 'concrete', tex: 'stucco', texScale: 1.1 },
  concreteRaw:   { color: 0x8e8a83, roughness: 0.93, metalness: 0.0, surface: 'concrete', tex: 'concrete', texScale: 0.7 },
  concreteDark:  { color: 0x5f5c58, roughness: 0.92, metalness: 0.0, surface: 'concrete', tex: 'concrete', texScale: 0.7 },
  stoneTrim:     { color: 0xa89c86, roughness: 0.88, metalness: 0.0, surface: 'concrete', tex: 'concrete', texScale: 1.0 },
  brickRed:      { color: 0x9a5a45, roughness: 0.92, metalness: 0.0, surface: 'concrete', tex: 'tile', texScale: 1.6 },
  drywall:       { color: 0xcfc9be, roughness: 0.96, metalness: 0.0, surface: 'drywall', tex: 'stucco', texScale: 1.3 },

  // --- roofing ------------------------------------------------------------
  terracotta:    { color: 0xa5573a, roughness: 0.90, metalness: 0.0, surface: 'ceramic', tex: 'tile', texScale: 2.2 },
  terracottaOld: { color: 0x8a5140, roughness: 0.93, metalness: 0.0, surface: 'ceramic', tex: 'tile', texScale: 2.2 },
  corrugated:    { color: 0x8d8578, roughness: 0.70, metalness: 0.45, surface: 'metal', tex: 'metal', texScale: 2.6 },
  bitumen:       { color: 0x4a4744, roughness: 0.95, metalness: 0.0, surface: 'concrete', tex: 'asphalt', texScale: 1.0 },

  // --- metal --------------------------------------------------------------
  steelGalv:     { color: 0x9aa1a6, roughness: 0.52, metalness: 0.75, surface: 'metal', tex: 'metal', texScale: 1.4 },
  steelDark:     { color: 0x4e5459, roughness: 0.55, metalness: 0.80, surface: 'metal', tex: 'metal', texScale: 1.4 },
  rust:          { color: 0x8a4f31, roughness: 0.88, metalness: 0.35, surface: 'metal', tex: 'concrete', texScale: 1.6 },
  paintBlue:     { color: 0x35607e, roughness: 0.60, metalness: 0.40, surface: 'metal', tex: 'metal', texScale: 1.2 },
  paintGreen:    { color: 0x3f6b53, roughness: 0.62, metalness: 0.40, surface: 'metal', tex: 'metal', texScale: 1.2 },
  paintRed:      { color: 0x8e3a30, roughness: 0.62, metalness: 0.40, surface: 'metal', tex: 'metal', texScale: 1.2 },
  paintYellow:   { color: 0xb99331, roughness: 0.64, metalness: 0.35, surface: 'metal', tex: 'metal', texScale: 1.2 },
  paintOrange:   { color: 0xc4602a, roughness: 0.66, metalness: 0.20, surface: 'plastic', tex: 'metal', texScale: 1.2 },
  brass:         { color: 0xc8a355, roughness: 0.38, metalness: 0.85, surface: 'metal' },

  // --- wood ---------------------------------------------------------------
  woodDark:      { color: 0x5c3f2b, roughness: 0.80, metalness: 0.0, surface: 'wood', tex: 'wood', texScale: 1.4 },
  woodWarm:      { color: 0x8a6039, roughness: 0.82, metalness: 0.0, surface: 'wood', tex: 'wood', texScale: 1.4 },
  woodPale:      { color: 0xb59667, roughness: 0.85, metalness: 0.0, surface: 'wood', tex: 'wood', texScale: 1.4 },
  woodWeathered: { color: 0x8d8474, roughness: 0.93, metalness: 0.0, surface: 'wood', tex: 'wood', texScale: 1.4 },

  // --- floors -------------------------------------------------------------
  marble:        { color: 0xd6cfc2, roughness: 0.30, metalness: 0.05, surface: 'tile', tex: 'tile', texScale: 0.55 },
  tileTerra:     { color: 0xa9694a, roughness: 0.55, metalness: 0.03, surface: 'tile', tex: 'tile', texScale: 1.5 },
  tileTalavera:  { color: 0x3f6f86, roughness: 0.42, metalness: 0.05, surface: 'tile', tex: 'tile', texScale: 1.8 },
  poolTile:      { color: 0x2f8ba0, roughness: 0.28, metalness: 0.05, surface: 'tile', tex: 'tile', texScale: 2.4 },
  asphalt:       { color: 0x413f3d, roughness: 0.96, metalness: 0.0, surface: 'concrete', tex: 'asphalt', texScale: 0.5 },
  gravelMat:     { color: 0x8b8272, roughness: 0.99, metalness: 0.0, surface: 'gravel', tex: 'gravel', texScale: 0.8 },
  dirtMat:       { color: 0x7a6547, roughness: 0.99, metalness: 0.0, surface: 'dirt', tex: 'dirt', texScale: 0.5 },
  sandMat:       { color: 0xb8a179, roughness: 0.99, metalness: 0.0, surface: 'sand', tex: 'sand', texScale: 0.45 },

  // --- soft ---------------------------------------------------------------
  fabricCream:   { color: 0xc4b79c, roughness: 1.00, metalness: 0.0, surface: 'fabric', tex: 'stucco', texScale: 2.0 },
  fabricRed:     { color: 0x8c4038, roughness: 1.00, metalness: 0.0, surface: 'fabric', tex: 'stucco', texScale: 2.0 },
  fabricTeal:    { color: 0x3d6b6b, roughness: 1.00, metalness: 0.0, surface: 'fabric', tex: 'stucco', texScale: 2.0 },
  leather:       { color: 0x6b4a34, roughness: 0.72, metalness: 0.0, surface: 'fabric', tex: 'stucco', texScale: 2.4 },
  sandbag:       { color: 0x9c8f6d, roughness: 1.00, metalness: 0.0, surface: 'sand', tex: 'sand', texScale: 2.2 },
  rubber:        { color: 0x2a2a2c, roughness: 0.90, metalness: 0.0, surface: 'rubber' },
  plasticWhite:  { color: 0xc9c6bd, roughness: 0.55, metalness: 0.0, surface: 'plastic' },

  // --- vegetation ---------------------------------------------------------
  leafDark:      { color: 0x3c5730, roughness: 1.00, metalness: 0.0, surface: 'foliage', double: true, tex: 'foliage', texScale: 1.2 },
  leafMid:       { color: 0x54713a, roughness: 1.00, metalness: 0.0, surface: 'foliage', double: true, tex: 'foliage', texScale: 1.2 },
  leafDry:       { color: 0x7d7e42, roughness: 1.00, metalness: 0.0, surface: 'foliage', double: true, tex: 'foliage', texScale: 1.2 },
  bark:          { color: 0x6a5844, roughness: 0.95, metalness: 0.0, surface: 'wood', tex: 'wood', texScale: 2.2 },
  lawn:          { color: 0x5d7440, roughness: 1.00, metalness: 0.0, surface: 'grass', tex: 'grass', texScale: 1.1 },

  // --- transparent --------------------------------------------------------
  glass:         { color: 0x9fc4d2, roughness: 0.06, metalness: 0.25, surface: 'glass', opacity: 0.24, smooth: true, noShadow: true },
  water:         { color: 0x2f7f96, roughness: 0.05, metalness: 0.30, surface: 'water', opacity: 0.72, smooth: true, noShadow: true },

  // --- emissive -----------------------------------------------------------
  lampWarm:      { color: 0xffd9a0, roughness: 0.4, metalness: 0.0, surface: 'glass', emissive: 0xffb35c, emissiveIntensity: 2.2, noShadow: true },
  lampCold:      { color: 0xcfe6ff, roughness: 0.4, metalness: 0.0, surface: 'glass', emissive: 0x9fc8ff, emissiveIntensity: 1.6, noShadow: true },
  neonRed:       { color: 0xff6a5a, roughness: 0.4, metalness: 0.0, surface: 'plastic', emissive: 0xff3b28, emissiveIntensity: 2.6, noShadow: true },

  // --- value anchors ------------------------------------------------------
  // Deliberately outside the mid-range band the rest of the table lives in.
  // Not general-purpose surfaces: these are for the darkest recess and the
  // brightest lit face in a composition, so that a frame has a full value
  // range instead of eight materials all within 15% of one another.
  shadowBlack:   { color: 0x121316, roughness: 0.97, metalness: 0.0, surface: 'concrete' },
  tarBlack:      { color: 0x1a1815, roughness: 0.88, metalness: 0.0, surface: 'concrete', tex: 'concrete', texScale: 0.8 },
  sootMetal:     { color: 0x232629, roughness: 0.72, metalness: 0.35, surface: 'metal', tex: 'metal', texScale: 1.2 },
  chalkWhite:    { color: 0xf2efe6, roughness: 0.96, metalness: 0.0, surface: 'concrete', tex: 'stucco', texScale: 1.0 },
  sunlitPaint:   { color: 0xfdf8ee, roughness: 0.72, metalness: 0.0, surface: 'metal' },

  // --- faded / weathered container paints ---------------------------------
  // Every container in the yard was one of five saturated colours, which is
  // why the stacks read as a painted cliff rather than as steel boxes that
  // have crossed an ocean. Four faded tints for every saturated one.
  boxOxide:      { color: 0x7a4433, roughness: 0.94, metalness: 0.12, surface: 'metal', tex: 'metal', texScale: 1.1 },
  boxFadedNavy:  { color: 0x3f4f5e, roughness: 0.92, metalness: 0.12, surface: 'metal', tex: 'metal', texScale: 1.1 },
  boxFadedGrey:  { color: 0x77787a, roughness: 0.93, metalness: 0.10, surface: 'metal', tex: 'metal', texScale: 1.1 },
  boxFadedGreen: { color: 0x4d5f4a, roughness: 0.93, metalness: 0.12, surface: 'metal', tex: 'metal', texScale: 1.1 },
  boxSunbleach:  { color: 0xa8a091, roughness: 0.95, metalness: 0.08, surface: 'metal', tex: 'metal', texScale: 1.1 },
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
    if (d.tex) {
      m.map = surfaceTexture(d.tex, 1);
      applyWorldProjection(m, d.texScale ?? 1);
    }
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

/**
 * Project the detail map in **world space** rather than by mesh UV.
 *
 * Bricks are instanced boxes sharing one geometry, so their UVs run 0..1 per
 * face regardless of how big the instance is. Sampling by UV would tile a 20 m
 * compound wall exactly as many times as a 1 m crate — the same texture
 * stretched across wildly different real sizes, which reads worse than no
 * texture at all.
 *
 * The fix is a planar projection per dominant face axis. Bricks are boxes and
 * wedges, so every fragment has one clearly dominant normal component and a
 * single projection is exact — no triplanar blend needed, and no cost beyond
 * two varyings and a couple of comparisons.
 *
 * `tilesPerMetre` then means exactly what it says, and every surface in the
 * level shares one texel density.
 */
function applyWorldProjection(m: THREE.MeshStandardMaterial, tilesPerMetre: number): void {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTexScale = { value: tilesPerMetre };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vProjPos;
        varying vec3 vProjNrm;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        // Instanced meshes carry their transform in instanceMatrix, which
        // modelMatrix alone does not include.
        #ifdef USE_INSTANCING
          vProjPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          vProjNrm = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal);
        #else
          vProjPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vProjNrm = normalize(mat3(modelMatrix) * objectNormal);
        #endif`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTexScale;
        varying vec3 vProjPos;
        varying vec3 vProjNrm;
        vec2 worldUv() {
          vec3 n = abs(vProjNrm);
          vec3 p = vProjPos * uTexScale;
          if (n.y >= n.x && n.y >= n.z) return p.xz;   // floors and roofs
          if (n.x >= n.z) return p.zy;                 // walls facing X
          return p.xy;                                 // walls facing Z
        }`)
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          // Centre the modulation on 1.0, not on the texel value.
          //
          // A greyscale detail map averages 0.5, so multiplying by it straight
          // halves every surface in the level — which is exactly what happened:
          // the whole scene went grey and lost the palette's warmth. Doubling
          // first makes the average texel a no-op and turns the map into pure
          // variation around the authored colour.
          vec3 detail = texture2D(map, worldUv()).rgb * 2.0;
          diffuseColor.rgb *= mix(vec3(1.0), detail, 0.42);
        #endif`);
  };
  // Materials that compile differently must not share a program cache entry.
  m.customProgramCacheKey = () => `wp:${tilesPerMetre}`;
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
