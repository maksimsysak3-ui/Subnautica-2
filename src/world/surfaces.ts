/**
 * Physical properties per surface kind.
 *
 * OWNED BY: World design team. Consumed by ballistics (penetration and
 * ricochet), audio (footstep loudness and impact timbre) and VFX (impact
 * decals and particles), so the numbers here are the single agreed description
 * of what a material *is*.
 *
 * Densities are real (kg/m³). Thickness is the typical built thickness for
 * that material in this world — a drywall partition is 12mm, a concrete wall
 * is 200mm — because penetration depends on how much of it a round must cross,
 * not just what it is made of.
 */

import type { SurfaceKind, SurfaceProperties } from '../core/contracts';

export const SURFACE_TABLE: Record<SurfaceKind, SurfaceProperties> = {
  // Structural — these stop or slow rounds.
  concrete: { kind: 'concrete', density: 2400, absorption: 0.42, ricochetBias: 0.55, footstepLoudness: 1.00, penetrable: true,  thickness: 0.200 },
  metal:    { kind: 'metal',    density: 7800, absorption: 0.68, ricochetBias: 0.80, footstepLoudness: 1.25, penetrable: true,  thickness: 0.006 },
  wood:     { kind: 'wood',     density: 650,  absorption: 0.16, ricochetBias: 0.18, footstepLoudness: 0.95, penetrable: true,  thickness: 0.040 },
  drywall:  { kind: 'drywall',  density: 800,  absorption: 0.07, ricochetBias: 0.05, footstepLoudness: 0.90, penetrable: true,  thickness: 0.012 },
  glass:    { kind: 'glass',    density: 2500, absorption: 0.05, ricochetBias: 0.02, footstepLoudness: 1.10, penetrable: true,  thickness: 0.006 },
  ceramic:  { kind: 'ceramic',  density: 3800, absorption: 0.72, ricochetBias: 0.12, footstepLoudness: 1.10, penetrable: true,  thickness: 0.012 },
  tile:     { kind: 'tile',     density: 2200, absorption: 0.30, ricochetBias: 0.30, footstepLoudness: 1.35, penetrable: true,  thickness: 0.020 },

  // Ground — soft, quiet, and where footstep audio does most of its work.
  dirt:     { kind: 'dirt',     density: 1600, absorption: 0.35, ricochetBias: 0.10, footstepLoudness: 0.70, penetrable: true,  thickness: 0.500 },
  sand:     { kind: 'sand',     density: 1500, absorption: 0.40, ricochetBias: 0.06, footstepLoudness: 0.55, penetrable: true,  thickness: 0.500 },
  gravel:   { kind: 'gravel',   density: 1700, absorption: 0.38, ricochetBias: 0.22, footstepLoudness: 1.30, penetrable: true,  thickness: 0.300 },
  grass:    { kind: 'grass',    density: 1400, absorption: 0.30, ricochetBias: 0.08, footstepLoudness: 0.60, penetrable: true,  thickness: 0.400 },
  mud:      { kind: 'mud',      density: 1800, absorption: 0.45, ricochetBias: 0.03, footstepLoudness: 0.65, penetrable: true,  thickness: 0.400 },
  snow:     { kind: 'snow',     density: 400,  absorption: 0.25, ricochetBias: 0.02, footstepLoudness: 0.40, penetrable: true,  thickness: 0.300 },
  water:    { kind: 'water',    density: 1000, absorption: 0.55, ricochetBias: 0.35, footstepLoudness: 1.40, penetrable: true,  thickness: 1.000 },

  // Light clutter — cover that looks like cover but isn't.
  foliage:  { kind: 'foliage',  density: 200,  absorption: 0.02, ricochetBias: 0.00, footstepLoudness: 0.85, penetrable: true,  thickness: 0.300 },
  fabric:   { kind: 'fabric',   density: 300,  absorption: 0.04, ricochetBias: 0.00, footstepLoudness: 0.35, penetrable: true,  thickness: 0.020 },
  plastic:  { kind: 'plastic',  density: 950,  absorption: 0.10, ricochetBias: 0.08, footstepLoudness: 0.80, penetrable: true,  thickness: 0.010 },
  rubber:   { kind: 'rubber',   density: 1100, absorption: 0.22, ricochetBias: 0.05, footstepLoudness: 0.45, penetrable: true,  thickness: 0.020 },

  flesh:    { kind: 'flesh',    density: 1050, absorption: 0.28, ricochetBias: 0.00, footstepLoudness: 0.50, penetrable: true,  thickness: 0.250 },
};
