/**
 * Zone and service identity: one colour and one icon per thing the player can
 * place.
 *
 * A city builder is read at a glance -- zoning overlay, minimap, toolbar,
 * budget panel -- so every category needs a colour that survives being a four
 * pixel dot, and a silhouette that survives being a 16px icon. Defining both
 * in one place means the overlay, the UI and the demand bars can never drift
 * apart.
 *
 * The zone palette follows the convention players already know (green
 * housing, blue shops, yellow works, teal offices) but pulled towards muted,
 * slightly desaturated tones so a fully zoned map does not turn into a
 * highlighter accident. Each entry carries four steps: `deep` for outlines and
 * text on light ground, `base` for the fill everyone recognises, `light` for
 * hover and low-density variants, and `wash` for large flat overlay areas
 * where a saturated fill would drown the map underneath.
 *
 * The service branches get their own hues, chosen to be separable from each
 * other rather than from the zones -- they never appear on the same map layer.
 */

import type { Branch, Zone } from '../assets/types';
import { BRANCHES } from '../assets/types';

export interface Palette {
  /** Display name, title case, as it appears in UI. */
  label: string;
  /** Darkest step: icon linework, text on a light background. */
  deep: string;
  /** The identity colour. Toolbar swatch, demand bar, legend chip. */
  base: string;
  /** Lighter step: hover states, low-density variants, icon highlights. */
  light: string;
  /** Flat map overlay fill, meant to be drawn at 55-70% opacity. */
  wash: string;
  /** One line on what belongs here, for tooltips. */
  blurb: string;
}

/**
 * The zoning categories that get an icon.
 *
 * 'fleet' is deliberately absent: vehicles and figures are a review tab in the
 * asset viewer, not something the player paints on the map, and giving them a
 * zone icon would put them in the toolbar as if they were.
 */
export type IconZone = Exclude<Zone, 'fleet'>;

export const ZONE_STYLE: Record<IconZone, Palette> = {
  residential: {
    label: 'Residential',
    deep: '#1d4a2b', base: '#3f9a55', light: '#7fc98d', wash: '#c9e8cf',
    blurb: 'Where people live, from detached houses to tower blocks.',
  },
  commercial: {
    label: 'Commercial',
    deep: '#123a63', base: '#2f7fc1', light: '#79b7e2', wash: '#c6e0f2',
    blurb: 'Shops, food, fuel and services that need passing trade.',
  },
  industrial: {
    label: 'Industrial',
    deep: '#6b4a10', base: '#d09a2c', light: '#eac878', wash: '#f4e4bd',
    blurb: 'Sheds, plants and yards. Jobs and goods, noise and pollution.',
  },
  office: {
    label: 'Office',
    deep: '#0f4a4c', base: '#2a9d9c', light: '#7ecfcd', wash: '#c8e9e8',
    blurb: 'Desk work. Clean, dense, and hungry for transport rather than footfall.',
  },
  service: {
    label: 'Services',
    deep: '#3c4450', base: '#79879a', light: '#b3bfcd', wash: '#dde3ea',
    blurb: 'What the city provides for itself, and pays for every week.',
  },
};

export const BRANCH_STYLE: Record<Branch, Palette> = {
  fire: {
    label: 'Fire', deep: '#5e1b16', base: '#c0392b', light: '#e58274', wash: '#f4cec8',
    blurb: 'Stations, a training tower, and the reach of an appliance in traffic.',
  },
  police: {
    label: 'Police', deep: '#152f5c', base: '#2f5fa8', light: '#7fa4d8', wash: '#cddcf0',
    blurb: 'Precincts and holding. Coverage buys down crime, slowly.',
  },
  health: {
    label: 'Healthcare', deep: '#5e2130', base: '#d0596e', light: '#eb9dab', wash: '#f7d8de',
    blurb: 'Clinics up to a general hospital, plus the ambulances they dispatch.',
  },
  education: {
    label: 'Education', deep: '#3a2a58', base: '#7a5ba8', light: '#b39ad4', wash: '#e0d6ef',
    blurb: 'Primary through university. The slowest investment and the largest.',
  },
  water: {
    label: 'Water & sewage', deep: '#0f4657', base: '#2aa3c4', light: '#84d0e2', wash: '#ccebf3',
    blurb: 'Pumping, treatment and storage. Nobody notices it until it stops.',
  },
  power: {
    label: 'Electricity', deep: '#6a4a0f', base: '#e0a52c', light: '#f2cf82', wash: '#faecc9',
    blurb: 'Generation and the substations that get it to the street.',
  },
  transport: {
    label: 'Transport', deep: '#14503c', base: '#2f8f6a', light: '#86c9b0', wash: '#cfe9df',
    blurb: 'Depots, stations and interchanges. The thing that decides the map.',
  },
  government: {
    label: 'Government', deep: '#4c432c', base: '#96854f', light: '#c9bd96', wash: '#e8e2d1',
    blurb: 'City hall, courts and the offices that run the rest of it.',
  },
  parks: {
    label: 'Parks', deep: '#2b5719', base: '#6ab04c', light: '#a8d693', wash: '#d9edcd',
    blurb: 'Squares, playgrounds and green space. Land value, not throughput.',
  },
};

/** Every placeable category, in the order the toolbar shows them. */
export type Category = IconZone | Branch;

export function paletteFor(c: Category): Palette {
  return (ZONE_STYLE as Record<string, Palette>)[c] ?? BRANCH_STYLE[c as Branch];
}

// ------------------------------------------------------------------- icons
//
// The icons are built from isometric boxes rather than drawn as flat glyphs.
//
// A flat silhouette of a house is fine at 16px and looks like a sticker at 64,
// which is the size that actually appears in a toolbar. Three shaded faces per
// box costs nothing, reads at both sizes, and -- more usefully -- means the
// icon is made of the same thing the game is made of, so a category's icon and
// its buildings share a language. Everything below is generated: no
// hand-authored path data, so a change to the projection or the lighting
// applies to all of them at once.
//
// There is no badge behind the model. A rounded square reads as a button
// chrome that the UI is already drawing, and it fought with the toolbar's own
// selection state; the model alone, in the category's colour, is the icon.

/** Isometric projection constants. 2:1 would be flatter; 30 degrees reads as depth. */
const ISO_X = 0.866;
const ISO_Y = 0.5;

/** Face slots, in the order the shading table below lists them. */
const TOP = 0, LEFT = 1, RIGHT = 2, BACK = 3, GROUND = 4;

interface Face { d: string; shade: number }

function project(px: number, py: number, pz: number): [number, number] {
  return [(px - pz) * ISO_X, (px + pz) * ISO_Y - py];
}

function poly(pts: Array<[number, number, number]>): string {
  return pts.map((p, i) => {
    const [sx, sy] = project(p[0], p[1], p[2]);
    return `${i === 0 ? 'M' : 'L'}${sx.toFixed(2)} ${sy.toFixed(2)}`;
  }).join('') + 'Z';
}

/**
 * One box, as its three visible faces.
 *
 * Emitted in the order the caller lists them: at this scale composing the
 * scene back to front by hand is both simpler and more controllable than
 * getting a depth sort right for touching geometry.
 */
function box(x: number, y: number, z: number, w: number, h: number, d: number): Face[] {
  return [
    { d: poly([[x, y + h, z], [x + w, y + h, z], [x + w, y + h, z + d], [x, y + h, z + d]]), shade: TOP },
    { d: poly([[x, y, z + d], [x + w, y, z + d], [x + w, y + h, z + d], [x, y + h, z + d]]), shade: LEFT },
    { d: poly([[x + w, y, z + d], [x + w, y, z], [x + w, y + h, z], [x + w, y + h, z + d]]), shade: RIGHT },
  ];
}

/** A gable-roofed box: walls, then two roof planes and one gable triangle. */
function gabled(x: number, y: number, z: number, w: number, h: number, d: number, rise: number): Face[] {
  const mz = z + d / 2;
  return [
    ...box(x, y, z, w, h, d).slice(1),
    { d: poly([[x, y + h, z + d], [x + w, y + h, z + d], [x + w, y + h + rise, mz], [x, y + h + rise, mz]]), shade: TOP },
    { d: poly([[x, y + h, z], [x + w, y + h, z], [x + w, y + h + rise, mz], [x, y + h + rise, mz]]), shade: BACK },
    { d: poly([[x + w, y + h, z + d], [x + w, y + h, z], [x + w, y + h + rise, mz]]), shade: RIGHT },
  ];
}

/** A vertical drum: tanks, cooling towers, silos. Sampled, not approximated. */
function drum(cx: number, y: number, cz: number, r: number, h: number, taper = 1): Face[] {
  const n = 14;
  const ring = (rad: number, py: number): Array<[number, number, number]> =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return [cx + Math.cos(a) * rad, py, cz + Math.sin(a) * rad] as [number, number, number];
    });
  const top = ring(r * taper, y + h);
  const bot = ring(r, y);
  const faces: Face[] = [];
  // Only the half of the wall facing the viewer is ever seen.
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [sxA] = project(...bot[i]);
    const [sxB] = project(...bot[j]);
    const front = (bot[i][2] - cz) + (bot[i][0] - cx) > -r * 0.2;
    if (!front) continue;
    faces.push({ d: poly([bot[i], bot[j], top[j], top[i]]), shade: sxA + sxB > 0 ? RIGHT : LEFT });
  }
  faces.push({ d: poly(top), shade: TOP });
  return faces;
}

/** A flat plate, for ground, aprons and canopies. */
function plate(x: number, y: number, z: number, w: number, d: number): Face[] {
  return [{ d: poly([[x, y, z], [x + w, y, z], [x + w, y, z + d], [x, y, z + d]]), shade: GROUND }];
}

/**
 * A flat panel lying on one vertical face of a box, at the same plane.
 *
 * Windows and doors were thin boxes standing proud, and three shaded faces on
 * a 15cm-deep box reads as a soft lump rather than an opening -- which is what
 * made the icons look inflated. A single quad on the face plane is crisp.
 */
function faceZ(x: number, y: number, z: number, w: number, h: number): Face[] {
  return [{ d: poly([[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z]]), shade: LEFT }];
}

function faceX(x: number, y: number, z: number, d: number, h: number): Face[] {
  return [{ d: poly([[x, y, z + d], [x, y, z], [x, y + h, z], [x, y + h, z + d]]), shade: RIGHT }];
}

type Tone = 'body' | 'accent' | 'dark' | 'ground';
type Scene = Array<{ faces: Face[]; tone?: Tone }>;

const SCENES: Record<Category, Scene> = {
  // ---- zones ----------------------------------------------------------
  residential: [
    { faces: plate(-2.7, 0, -2.7, 5.4, 5.4), tone: 'ground' },
    { faces: gabled(-2.4, 0, -2.1, 1.9, 1.4, 1.9, 0.85), tone: 'body' },
    { faces: faceZ(-2.3, 0.35, -0.2, 0.55, 0.55), tone: 'dark' },
    { faces: faceZ(-1.35, 0.35, -0.2, 0.55, 0.55), tone: 'dark' },
    { faces: gabled(-0.1, 0, -2.4, 2.3, 2.0, 2.3, 1.15), tone: 'body' },
    { faces: faceZ(0.2, 1.05, -0.1, 0.6, 0.6), tone: 'dark' },
    { faces: faceZ(1.25, 1.05, -0.1, 0.6, 0.6), tone: 'dark' },
    { faces: faceZ(0.2, 0.0, -0.1, 0.6, 0.6), tone: 'dark' },
    { faces: faceZ(1.15, 0.0, -0.1, 0.75, 1.05), tone: 'accent' },
    { faces: faceX(2.2, 0.9, -2.1, 1.7, 0.7), tone: 'dark' },
    { faces: box(1.4, 2.0, -1.75, 0.42, 0.75, 0.42), tone: 'accent' },
  ],
  commercial: [
    { faces: plate(-2.6, 0, -2.6, 5.2, 5.2), tone: 'ground' },
    { faces: box(-2.0, 0, -1.8, 3.8, 3.4, 2.6), tone: 'body' },
    { faces: box(-2.15, 1.55, 0.75, 4.1, 0.55, 0.4), tone: 'accent' },
    { faces: faceZ(-1.6, 0.15, 0.8, 1.4, 1.25), tone: 'dark' },
    { faces: faceZ(0.5, 0.15, 0.8, 1.1, 1.25), tone: 'dark' },
    { faces: faceZ(-0.05, 0.0, 0.8, 0.5, 1.4), tone: 'accent' },
    { faces: faceZ(-1.5, 2.35, 0.8, 1.1, 0.8), tone: 'dark' },
    { faces: faceZ(0.4, 2.35, 0.8, 1.1, 0.8), tone: 'dark' },
    { faces: faceX(1.8, 2.3, -1.7, 2.4, 0.85), tone: 'dark' },
    { faces: box(1.8, 1.0, 0.1, 0.18, 1.2, 0.8), tone: 'accent' },
  ],
  industrial: [
    { faces: plate(-2.8, 0, -2.8, 5.6, 5.6), tone: 'ground' },
    { faces: box(-2.3, 0, -2.2, 3.5, 2.0, 3.2), tone: 'body' },
    { faces: faceZ(-2.0, 0.0, 1.0, 1.5, 1.45), tone: 'dark' },
    { faces: faceZ(-0.2, 0.0, 1.0, 1.0, 1.45), tone: 'accent' },
    { faces: faceX(1.2, 0.55, -2.0, 2.8, 0.8), tone: 'dark' },
    { faces: box(-2.3, 2.0, -1.9, 1.4, 0.55, 1.0), tone: 'dark' },
    { faces: box(-0.5, 2.0, -1.9, 1.4, 0.55, 1.0), tone: 'dark' },
    { faces: box(1.6, 0, -1.1, 0.7, 4.1, 0.7), tone: 'accent' },
    { faces: box(1.45, 4.1, -1.25, 1.0, 0.3, 1.0), tone: 'accent' },
  ],
  office: [
    { faces: plate(-2.6, 0, -2.6, 5.2, 5.2), tone: 'ground' },
    { faces: box(-2.2, 0, -1.1, 1.6, 1.7, 1.9), tone: 'body' },
    { faces: faceZ(-2.0, 0.35, 0.8, 0.5, 0.5), tone: 'dark' },
    { faces: faceZ(-1.2, 0.35, 0.8, 0.5, 0.5), tone: 'dark' },
    { faces: faceZ(-2.0, 1.05, 0.8, 0.5, 0.5), tone: 'dark' },
    { faces: faceZ(-1.2, 1.05, 0.8, 0.5, 0.5), tone: 'dark' },
    { faces: box(-0.1, 0, -2.2, 2.1, 4.4, 2.1), tone: 'body' },
    { faces: faceZ(0.15, 0.5, -0.1, 1.6, 0.55), tone: 'dark' },
    { faces: faceZ(0.15, 1.55, -0.1, 1.6, 0.55), tone: 'dark' },
    { faces: faceZ(0.15, 2.6, -0.1, 1.6, 0.55), tone: 'dark' },
    { faces: faceZ(0.15, 3.65, -0.1, 1.6, 0.55), tone: 'dark' },
    { faces: faceX(2.0, 0.5, -1.95, 1.6, 0.55), tone: 'dark' },
    { faces: faceX(2.0, 1.55, -1.95, 1.6, 0.55), tone: 'dark' },
    { faces: faceX(2.0, 2.6, -1.95, 1.6, 0.55), tone: 'dark' },
    { faces: faceX(2.0, 3.65, -1.95, 1.6, 0.55), tone: 'dark' },
    { faces: box(0.75, 4.4, -1.25, 0.16, 1.1, 0.16), tone: 'accent' },
  ],
  // The services tab itself: a civic block with a portico and a mast.
  service: [
    { faces: plate(-2.6, 0, -2.6, 5.2, 5.2), tone: 'ground' },
    { faces: box(-2.0, 0, -2.0, 3.8, 2.6, 3.2), tone: 'body' },
    { faces: box(-1.0, 0, 1.2, 1.9, 2.2, 0.5), tone: 'accent' },
    { faces: faceZ(-1.6, 0.3, 1.21, 0.45, 1.0), tone: 'dark' },
    { faces: faceZ(0.95, 0.3, 1.21, 0.45, 1.0), tone: 'dark' },
    { faces: faceZ(-0.55, 0.0, 1.71, 1.0, 1.4), tone: 'dark' },
    { faces: faceX(1.8, 0.6, -1.8, 2.6, 0.9), tone: 'dark' },
    { faces: box(-0.2, 2.6, -0.6, 0.16, 1.5, 0.16), tone: 'accent' },
  ],

  // ---- service branches ------------------------------------------------
  // Three appliance bays and a drill tower. The tower is the silhouette a
  // player scans for.
  fire: [
    { faces: plate(-2.8, 0, -2.8, 5.6, 5.6), tone: 'ground' },
    { faces: box(-2.4, 0, -1.6, 3.6, 2.4, 2.8), tone: 'body' },
    { faces: faceZ(-2.2, 0.0, 1.21, 0.9, 1.6), tone: 'dark' },
    { faces: faceZ(-1.1, 0.0, 1.21, 0.9, 1.6), tone: 'dark' },
    { faces: faceZ(0.0, 0.0, 1.21, 0.9, 1.6), tone: 'dark' },
    { faces: faceZ(-2.3, 1.85, 1.21, 3.4, 0.35), tone: 'accent' },
    { faces: faceX(1.2, 0.5, -1.5, 2.6, 1.1), tone: 'dark' },
    { faces: box(1.4, 0, -2.0, 1.2, 4.4, 1.2), tone: 'accent' },
    { faces: box(1.25, 4.4, -2.15, 1.5, 0.3, 1.5), tone: 'body' },
  ],
  // A precinct block with a lit mast and a barred ground floor.
  police: [
    { faces: plate(-2.7, 0, -2.7, 5.4, 5.4), tone: 'ground' },
    { faces: box(-2.2, 0, -1.9, 2.4, 3.4, 3.0), tone: 'body' },
    { faces: box(0.4, 0, -1.4, 1.7, 2.2, 2.4), tone: 'body' },
    { faces: faceZ(-2.0, 0.5, 1.11, 0.6, 0.7), tone: 'dark' },
    { faces: faceZ(-1.1, 0.5, 1.11, 0.6, 0.7), tone: 'dark' },
    { faces: faceZ(-2.0, 1.8, 1.11, 0.6, 0.7), tone: 'dark' },
    { faces: faceZ(-1.1, 1.8, 1.11, 0.6, 0.7), tone: 'dark' },
    { faces: faceZ(0.7, 0.0, 1.01, 1.1, 1.4), tone: 'accent' },
    { faces: faceX(2.1, 0.5, -1.3, 2.2, 1.5), tone: 'dark' },
    { faces: box(-1.4, 3.4, -0.7, 0.16, 1.6, 0.16), tone: 'accent' },
    { faces: box(-1.55, 5.0, -0.85, 0.46, 0.3, 0.46), tone: 'accent' },
  ],
  // A ward block with a lower entrance wing and a rooftop cross.
  health: [
    { faces: plate(-2.7, 0, -2.7, 5.4, 5.4), tone: 'ground' },
    { faces: box(-2.2, 0, -2.2, 2.6, 4.0, 2.4), tone: 'body' },
    { faces: box(-0.2, 0, -0.6, 2.2, 1.8, 2.4), tone: 'body' },
    { faces: faceZ(-2.0, 0.6, 0.21, 0.5, 0.6), tone: 'dark' },
    { faces: faceZ(-1.2, 0.6, 0.21, 0.5, 0.6), tone: 'dark' },
    { faces: faceZ(-2.0, 1.8, 0.21, 0.5, 0.6), tone: 'dark' },
    { faces: faceZ(-1.2, 1.8, 0.21, 0.5, 0.6), tone: 'dark' },
    { faces: faceZ(-2.0, 3.0, 0.21, 0.5, 0.6), tone: 'dark' },
    { faces: faceZ(-1.2, 3.0, 0.21, 0.5, 0.6), tone: 'dark' },
    { faces: faceZ(0.3, 0.0, 1.81, 1.6, 1.3), tone: 'dark' },
    { faces: box(-0.4, 1.8, -0.8, 2.6, 0.3, 0.5), tone: 'accent' },
    // The cross, laid flat on the tall block's roof.
    { faces: box(-1.8, 4.0, -1.55, 1.8, 0.28, 0.55), tone: 'accent' },
    { faces: box(-1.2, 4.0, -2.05, 0.6, 0.28, 1.55), tone: 'accent' },
  ],
  // A long teaching range with a bell cupola and a yard.
  education: [
    { faces: plate(-2.9, 0, -2.9, 5.8, 5.8), tone: 'ground' },
    { faces: box(-2.5, 0, -2.2, 4.6, 2.2, 2.0), tone: 'body' },
    { faces: box(-2.5, 0, -0.2, 1.8, 2.2, 1.8), tone: 'body' },
    { faces: faceZ(-2.3, 0.5, -0.19, 0.5, 0.7), tone: 'dark' },
    { faces: faceZ(-1.5, 0.5, -0.19, 0.5, 0.7), tone: 'dark' },
    { faces: faceZ(-2.3, 1.4, -0.19, 0.5, 0.6), tone: 'dark' },
    { faces: faceZ(-1.5, 1.4, -0.19, 0.5, 0.6), tone: 'dark' },
    { faces: faceZ(-0.5, 0.5, 1.61, 0.5, 0.7), tone: 'dark' },
    { faces: faceZ(0.4, 0.5, 1.61, 0.5, 0.7), tone: 'dark' },
    { faces: faceZ(1.3, 0.0, 1.61, 0.7, 1.3), tone: 'accent' },
    { faces: faceX(2.1, 0.5, -2.1, 1.8, 1.4), tone: 'dark' },
    { faces: box(-0.5, 2.2, -1.8, 1.0, 0.9, 1.0), tone: 'accent' },
    { faces: gabled(-0.65, 3.1, -1.95, 1.3, 0.15, 1.3, 0.7), tone: 'body' },
  ],
  // Two storage tanks, a filter house and a pipe run.
  water: [
    { faces: plate(-2.9, 0, -2.9, 5.8, 5.8), tone: 'ground' },
    { faces: box(-2.5, 0, 0.4, 2.6, 1.9, 2.0), tone: 'body' },
    { faces: faceZ(-2.3, 0.5, 2.41, 0.6, 0.8), tone: 'dark' },
    { faces: faceZ(-1.4, 0.5, 2.41, 0.6, 0.8), tone: 'dark' },
    { faces: faceZ(-0.5, 0.0, 2.41, 0.6, 1.3), tone: 'accent' },
    { faces: drum(-1.0, 0, -1.6, 1.35, 2.6), tone: 'body' },
    { faces: drum(1.7, 0, -0.6, 1.05, 3.4), tone: 'accent' },
    { faces: box(-1.15, 2.6, -1.75, 0.3, 0.35, 0.3), tone: 'accent' },
    { faces: box(-0.6, 1.0, -1.7, 2.4, 0.32, 0.32), tone: 'accent' },
  ],
  // A substation: transformer drums under a gantry, and a cooling stack.
  power: [
    { faces: plate(-2.9, 0, -2.9, 5.8, 5.8), tone: 'ground' },
    { faces: box(-2.5, 0, 0.6, 2.4, 1.8, 1.8), tone: 'body' },
    { faces: faceZ(-2.3, 0.4, 2.41, 0.7, 0.9), tone: 'dark' },
    { faces: faceZ(-1.2, 0.0, 2.41, 0.6, 1.3), tone: 'accent' },
    { faces: box(-1.9, 0, -1.4, 1.3, 1.6, 1.3), tone: 'body' },
    { faces: box(-0.2, 0, -1.9, 1.3, 1.6, 1.3), tone: 'body' },
    // Gantry: two masts and a crossarm, which is what says substation.
    { faces: box(-2.3, 0, -2.5, 0.22, 4.4, 0.22), tone: 'accent' },
    { faces: box(1.5, 0, -2.5, 0.22, 4.4, 0.22), tone: 'accent' },
    { faces: box(-2.4, 4.0, -2.6, 4.1, 0.24, 0.42), tone: 'accent' },
    { faces: drum(2.0, 0, 1.2, 1.0, 3.6, 0.78), tone: 'accent' },
  ],
  // A depot canopy on posts with a vehicle under it, and a platform.
  transport: [
    { faces: plate(-2.9, 0, -2.9, 5.8, 5.8), tone: 'ground' },
    { faces: box(-2.5, 0, -2.2, 2.0, 2.6, 2.2), tone: 'body' },
    { faces: faceZ(-2.3, 0.6, 0.01, 0.5, 0.8), tone: 'dark' },
    { faces: faceZ(-1.5, 0.6, 0.01, 0.5, 0.8), tone: 'dark' },
    { faces: faceZ(-2.3, 1.7, 0.01, 1.3, 0.6), tone: 'accent' },
    { faces: box(-0.2, 2.4, -2.4, 3.0, 0.3, 4.4), tone: 'accent' },
    { faces: box(-0.1, 0, -2.3, 0.18, 2.4, 0.18), tone: 'accent' },
    { faces: box(2.6, 0, -2.3, 0.18, 2.4, 0.18), tone: 'accent' },
    { faces: box(-0.1, 0, 1.7, 0.18, 2.4, 0.18), tone: 'accent' },
    { faces: box(2.6, 0, 1.7, 0.18, 2.4, 0.18), tone: 'accent' },
    { faces: box(0.3, 0.18, -1.8, 2.1, 1.5, 3.2), tone: 'body' },
    { faces: faceZ(0.5, 0.7, 1.41, 1.7, 0.6), tone: 'dark' },
  ],
  // City hall: a stone block, a colonnade and a flag.
  government: [
    { faces: plate(-2.8, 0, -2.8, 5.6, 5.6), tone: 'ground' },
    { faces: box(-2.3, 0, -2.0, 4.2, 2.8, 2.6), tone: 'body' },
    { faces: box(-1.2, 0, 0.6, 2.2, 3.2, 0.7), tone: 'body' },
    // Colonnade in front of the centre bay.
    { faces: box(-1.1, 0.3, 1.3, 0.26, 2.2, 0.26), tone: 'accent' },
    { faces: box(-0.45, 0.3, 1.3, 0.26, 2.2, 0.26), tone: 'accent' },
    { faces: box(0.2, 0.3, 1.3, 0.26, 2.2, 0.26), tone: 'accent' },
    { faces: box(0.85, 0.3, 1.3, 0.26, 2.2, 0.26), tone: 'accent' },
    { faces: box(-1.3, 2.5, 1.15, 2.5, 0.35, 0.6), tone: 'accent' },
    { faces: faceZ(-0.9, 0.0, 1.31, 1.6, 1.7), tone: 'dark' },
    { faces: faceZ(-2.1, 0.6, 0.61, 0.55, 1.5), tone: 'dark' },
    { faces: faceZ(1.35, 0.6, 0.61, 0.55, 1.5), tone: 'dark' },
    { faces: faceX(1.9, 0.6, -1.8, 2.2, 1.5), tone: 'dark' },
    { faces: box(-0.1, 3.2, 0.85, 0.14, 1.7, 0.14), tone: 'accent' },
    { faces: box(0.04, 4.3, 0.88, 0.9, 0.5, 0.08), tone: 'accent' },
  ],
  // A square: lawn, paths, a pavilion and hedges.
  parks: [
    { faces: plate(-2.9, 0, -2.9, 5.8, 5.8), tone: 'ground' },
    { faces: plate(-2.5, 0.06, -2.5, 5.0, 5.0), tone: 'body' },
    { faces: plate(-0.35, 0.09, -2.5, 0.7, 5.0), tone: 'accent' },
    { faces: plate(-2.5, 0.09, -0.35, 5.0, 0.7), tone: 'accent' },
    { faces: box(-2.3, 0.06, -2.3, 1.7, 0.55, 1.7), tone: 'accent' },
    { faces: box(0.9, 0.06, 0.9, 1.5, 0.55, 1.5), tone: 'accent' },
    // Pavilion: four posts and a pitched roof.
    { faces: box(0.7, 0.06, -2.4, 0.18, 1.4, 0.18), tone: 'accent' },
    { faces: box(2.2, 0.06, -2.4, 0.18, 1.4, 0.18), tone: 'accent' },
    { faces: box(0.7, 0.06, -1.0, 0.18, 1.4, 0.18), tone: 'accent' },
    { faces: box(2.2, 0.06, -1.0, 0.18, 1.4, 0.18), tone: 'accent' },
    { faces: gabled(0.5, 1.46, -2.6, 2.1, 0.16, 2.1, 0.8), tone: 'accent' },
  ],
};

/**
 * Renders one category's scene into an SVG document.
 *
 * The model is drawn in the category's own colour at four values -- one per
 * face slot -- so the icon needs no badge behind it to be identifiable, and
 * carries the same lighting as every other icon in the set.
 */
/** Escapes text for an XML attribute. "Water & sewage" is not valid SVG. */
function xml(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Service branch pictograms.
 *
 * The zones get isometric models because a zone IS its buildings -- the icon
 * and the thing it places are the same object. A service branch is not: it is
 * a department, and "fire" covers a station, a tower and a helicopter base.
 * Modelling one of them makes the button look like that one building instead
 * of the category, which is exactly the toolbar mistake that makes a player
 * hunt. So the branches get symbols: a flame, a shield, a cross, a mortar
 * board, a droplet, a bolt, a bus, a portico, a tree.
 *
 * Drawn rather than generated, because a good pictogram is not a projection of
 * anything -- it is a shape chosen to survive at 20 pixels.
 */
const GLYPH: Record<Branch, string> = {
  // Flame: an asymmetric teardrop with a lick off one side.
  fire: 'M24 3.5c-1.1 6.2-6.2 9-9 14.2-1.6 3-2.4 6.4-2.4 9.9C12.6 36.2 17.7 43 24 43'
      + 's11.4-6.8 11.4-15.4c0-4.6-1.5-8.4-4.4-12.1-1.2 2.6-2.6 3.9-4.1 3.9-2.2 0-3-2.7-3-6.2'
      + '0-3.7.3-7.5.1-9.7z'
      + 'M24 26.2c-2.9 2.6-4.4 5.4-4.4 8.2 0 3.2 2 5.6 4.4 5.6s4.4-2.4 4.4-5.6c0-2.8-1.5-5.6-4.4-8.2z',
  // Shield with a five-pointed star cut out of it.
  police: 'M24 3 7 9v13c0 10.5 7.2 18.7 17 23 9.8-4.3 17-12.5 17-23V9L24 3z'
        + 'M24 14.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.2-5.9 3.2 1.2-6.5-4.8-4.6 6.6-.9 2.9-6z',
  // Cross in a rounded square: the sign, not the building.
  health: 'M11 6h26a5 5 0 0 1 5 5v26a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5V11a5 5 0 0 1 5-5z'
        + 'M20.5 13h7v7.5H35v7h-7.5V35h-7v-7.5H13v-7h7.5V13z',
  // Mortar board over a book edge.
  education: 'M24 7 3 16.5 24 26l15-6.8v9.1c0 .9.7 1.6 1.6 1.6.9 0 1.6-.7 1.6-1.6v-11L24 7z'
           + 'M11 22.6v8.1c0 1 .5 1.9 1.4 2.4 3.5 2 7.6 3 11.6 3s8.1-1 11.6-3c.9-.5 1.4-1.4 1.4-2.4v-8.1'
           + 'L24 29.4 11 22.6z',
  // Droplet.
  water: 'M24 4c-.6 0-1.2.3-1.6.8C19.6 8.2 10 20.3 10 28.5 10 36.5 16.3 43 24 43s14-6.5 14-14.5'
       + 'c0-8.2-9.6-20.3-12.4-23.7A2 2 0 0 0 24 4z'
       + 'M24 36.5c-3.6 0-6.5-3-6.5-6.7 0-.8.6-1.4 1.4-1.4s1.4.6 1.4 1.4c0 2.1 1.7 3.9 3.7 3.9'
       + '.8 0 1.4.6 1.4 1.4s-.6 1.4-1.4 1.4z',
  // Bolt.
  power: 'M28.5 3 11 26.5h9.6L18 45l18.5-24.5H26.4L28.5 3z',
  // Bus, seen head-on: roof, screen, windscreen, lights and wheels.
  transport: 'M13 6h22a6 6 0 0 1 6 6v20a5 5 0 0 1-5 5H12a5 5 0 0 1-5-5V12a6 6 0 0 1 6-6z'
           + 'M12 12h24v4H12v-4zM12 20h24v9H12v-9zM11 31h5v4h-5v-4zM32 31h5v4h-5v-4z'
           + 'M9 37h6v5H9v-5zM33 37h6v5h-6v-5z',
  // Portico: pediment, four columns, a step.
  government: 'M24 4 4 15v4h40v-4L24 4zM9 22h5v16H9V22zM19 22h5v16h-5V22zM29 22h5v16h-5V22z'
            + 'M39 22h-5v16h5V22zM4 40h40v4H4v-4z',
  // Broadleaf tree with a trunk.
  parks: 'M24 4c-6.6 0-12 5.2-12 11.6 0 1 .1 2 .4 3C9.2 20 7 23.2 7 27c0 5.5 4.6 10 10.2 10'
       + 'h2.9v4.4c0 .9.8 1.6 1.7 1.6h4.4c.9 0 1.7-.7 1.7-1.6V37h2.9C36.4 37 41 32.5 41 27'
       + 'c0-3.8-2.2-7-5.4-8.4.3-1 .4-2 .4-3C36 9.2 30.6 4 24 4z',
};

/**
 * Renders one category's icon.
 *
 * Zones are drawn as shaded isometric models; branches as a single filled
 * pictogram. Both are drawn in the category's own colour with no badge behind
 * them, so they sit in a toolbar the same way.
 */
function icon(c: Category): string {
  const s = paletteFor(c);
  const glyph = (GLYPH as Record<string, string | undefined>)[c];

  if (glyph !== undefined) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" role="img" aria-label="${xml(s.label)}">
  <path d="${glyph}" fill="${s.base}" fill-rule="evenodd" stroke="${s.deep}"
        stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;
  }

  const body = [s.light, s.base, s.deep, s.base, s.deep];
  const accent = [s.base, s.deep, s.deep, s.deep, s.deep];
  const alphaBody = [1, 1, 1, 0.92, 0.16];
  const alphaAccent = [1, 0.9, 0.78, 0.85, 0.3];

  let out = '';
  for (const part of SCENES[c]) {
    for (const f of part.faces) {
      let fill = body[f.shade];
      let alpha = alphaBody[f.shade];
      if (part.tone === 'accent') { fill = accent[f.shade]; alpha = alphaAccent[f.shade]; }
      if (part.tone === 'dark') { fill = s.deep; alpha = f.shade === TOP ? 0.75 : 0.95; }
      if (part.tone === 'ground') { fill = s.deep; alpha = 0.14; }
      out += `<path d="${f.d}" fill="${fill}" fill-opacity="${alpha}"/>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" role="img" aria-label="${xml(s.label)}">
  <g transform="translate(24 32) scale(5.4)" stroke="${s.deep}" stroke-opacity="0.35"
     stroke-width="0.045" stroke-linejoin="round">${out}</g>
</svg>`;
}

/** Every icon, keyed by category. */
export const ICON: Record<Category, string> = Object.fromEntries(
  ([...(Object.keys(ZONE_STYLE) as Zone[]), ...BRANCHES] as Category[]).map((c) => [c, icon(c)]),
) as Record<Category, string>;

/** Back-compatible alias: the four zone icons. */
export const ZONE_ICON = ICON;

/** The icon inline, sized for UI. Returns SVG markup, not a data URL. */
export function zoneIcon(c: Category, size = 20): string {
  return ICON[c].replace('width="48" height="48"', `width="${size}" height="${size}"`);
}
