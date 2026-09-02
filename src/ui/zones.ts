/**
 * Zone identity: one colour code and one icon per zone.
 *
 * A city builder is read at a glance -- zoning overlay, minimap, toolbar,
 * budget panel -- so every zone needs a colour that survives being a four
 * pixel dot, and a silhouette that survives being a 16px icon. Defining both
 * in one place means the overlay, the UI and the demand bars can never drift
 * apart.
 *
 * The palette follows the convention players already know (green housing,
 * blue shops, yellow works, teal offices) but pulled towards muted, slightly
 * desaturated tones so a fully zoned map does not turn into a highlighter
 * accident. Each zone carries four steps: `deep` for outlines and text on
 * light ground, `base` for the fill everyone recognises, `light` for hover
 * and low-density variants, and `wash` for large flat overlay areas where a
 * saturated fill would drown the map underneath.
 */

import type { Zone } from '../assets/types';

export interface ZoneStyle {
  /** Display name, title case, as it appears in UI. */
  label: string;
  /** Darkest step: icon linework, text on a light background. */
  deep: string;
  /** The zone's identity colour. Toolbar swatch, demand bar, legend chip. */
  base: string;
  /** Lighter step: hover states, low-density variants, icon highlights. */
  light: string;
  /** Flat map overlay fill, meant to be drawn at 55-70% opacity. */
  wash: string;
  /** One line on what belongs here, for tooltips. */
  blurb: string;
}

export const ZONE_STYLE: Record<Zone, ZoneStyle> = {
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
};

// ------------------------------------------------------------------- icons
//
// The icons are built from isometric boxes rather than drawn as flat glyphs.
//
// A flat silhouette of a house is fine at 16px and looks like a sticker at 64,
// which is the size that actually appears in a toolbar. Three shaded faces per
// box costs nothing, reads at both sizes, and -- more usefully -- means the
// icon is made of the same thing the game is made of, so a zone's icon and its
// buildings share a language. Everything below is generated: no hand-authored
// path data, so a change to the projection or the lighting applies to all four.

/** Isometric projection constants. 2:1 would be flatter; 30 degrees reads as depth. */
const ISO_X = 0.866;
const ISO_Y = 0.5;

interface Face { d: string; shade: number }

/** Projects a world point to the icon's 2D space. */
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
 * Drawn back to front within the box, and boxes are emitted in the order the
 * caller lists them -- there is no depth sort, because at this scale composing
 * the scene back-to-front by hand is both simpler and more controllable than
 * getting a sort right for touching geometry.
 */
function box(x: number, y: number, z: number, w: number, h: number, d: number): Face[] {
  return [
    // Top, then the two faces that catch the light differently.
    { d: poly([[x, y + h, z], [x + w, y + h, z], [x + w, y + h, z + d], [x, y + h, z + d]]), shade: 0 },
    { d: poly([[x, y, z + d], [x + w, y, z + d], [x + w, y + h, z + d], [x, y + h, z + d]]), shade: 1 },
    { d: poly([[x + w, y, z + d], [x + w, y, z], [x + w, y + h, z], [x + w, y + h, z + d]]), shade: 2 },
  ];
}

/** A gable-roofed box: walls, then two roof planes and the gable triangles. */
function gabled(x: number, y: number, z: number, w: number, h: number, d: number, rise: number): Face[] {
  const mz = z + d / 2;
  return [
    ...box(x, y, z, w, h, d).slice(1),
    // Front slope catches more light than the back one; the gable ends read
    // as the darkest plane, which is what gives the roof its form.
    { d: poly([[x, y + h, z + d], [x + w, y + h, z + d], [x + w, y + h + rise, mz], [x, y + h + rise, mz]]), shade: 0 },
    { d: poly([[x, y + h, z], [x + w, y + h, z], [x + w, y + h + rise, mz], [x, y + h + rise, mz]]), shade: 3 },
    { d: poly([[x + w, y + h, z + d], [x + w, y + h, z], [x + w, y + h + rise, mz]]), shade: 2 },
  ];
}

/**
 * A flat panel lying on one vertical face of a box, at the same plane.
 *
 * Windows and doors were being drawn as thin boxes standing proud, and three
 * shaded faces on a 15cm-deep box reads as a soft lump rather than an opening
 * -- which is what made the icons look inflated. A single quad on the face
 * plane is crisp.
 */
function faceZ(x: number, y: number, z: number, w: number, h: number): Face[] {
  return [{ d: poly([[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z]]), shade: 1 }];
}

function faceX(x: number, y: number, z: number, d: number, h: number): Face[] {
  return [{ d: poly([[x, y, z + d], [x, y, z], [x, y + h, z], [x, y + h, z + d]]), shade: 2 }];
}

/** A flat plate, for ground, aprons and canopies. */
function plate(x: number, y: number, z: number, w: number, d: number): Face[] {
  return [{ d: poly([[x, y, z], [x + w, y, z], [x + w, y, z + d], [x, y, z + d]]), shade: 4 }];
}

type Scene = Array<{ faces: Face[]; tone?: 'body' | 'accent' | 'glass' | 'ground' }>;

const SCENES: Record<Zone, Scene> = {
  // One house read clearly, with a smaller one behind it for depth. Housing is
  // recognised by its roof and its openings, so both are drawn hard.
  residential: [
    { faces: plate(-2.7, 0, -2.7, 5.4, 5.4), tone: 'ground' },
    { faces: gabled(-2.4, 0, -2.1, 1.9, 1.4, 1.9, 0.85), tone: 'body' },
    { faces: faceZ(-2.3, 0.35, -0.2, 0.55, 0.55), tone: 'glass' },
    { faces: faceZ(-1.35, 0.35, -0.2, 0.55, 0.55), tone: 'glass' },
    { faces: gabled(-0.1, 0, -2.4, 2.3, 2.0, 2.3, 1.15), tone: 'body' },
    { faces: faceZ(0.2, 1.05, -0.1, 0.6, 0.6), tone: 'glass' },
    { faces: faceZ(1.25, 1.05, -0.1, 0.6, 0.6), tone: 'glass' },
    { faces: faceZ(0.2, 0.0, -0.1, 0.6, 0.6), tone: 'glass' },
    { faces: faceZ(1.15, 0.0, -0.1, 0.75, 1.05), tone: 'accent' },
    { faces: faceX(2.2, 0.9, -2.1, 1.7, 0.7), tone: 'glass' },
    { faces: box(1.4, 2.0, -1.75, 0.42, 0.75, 0.42), tone: 'accent' },
  ],
  // A shopfront: a low unit with a deep fascia band and a projecting sign.
  commercial: [
    { faces: plate(-2.6, 0, -2.6, 5.2, 5.2), tone: 'ground' },
    { faces: box(-2.0, 0, -1.8, 3.8, 3.4, 2.6), tone: 'body' },
    { faces: box(-2.15, 1.55, 0.75, 4.1, 0.55, 0.4), tone: 'accent' },
    { faces: faceZ(-1.6, 0.15, 0.8, 1.4, 1.25), tone: 'glass' },
    { faces: faceZ(0.5, 0.15, 0.8, 1.1, 1.25), tone: 'glass' },
    { faces: faceZ(-0.05, 0.0, 0.8, 0.5, 1.4), tone: 'accent' },
    { faces: faceZ(-1.5, 2.35, 0.8, 1.1, 0.8), tone: 'glass' },
    { faces: faceZ(0.4, 2.35, 0.8, 1.1, 0.8), tone: 'glass' },
    { faces: faceX(1.8, 2.3, -1.7, 2.4, 0.85), tone: 'glass' },
    { faces: box(1.8, 1.0, 0.1, 0.18, 1.2, 0.8), tone: 'accent' },
  ],
  // A shed with roof monitors and a stack. The roller door is the detail that
  // makes it industry rather than a bungalow.
  industrial: [
    { faces: plate(-2.8, 0, -2.8, 5.6, 5.6), tone: 'ground' },
    { faces: box(-2.3, 0, -2.2, 3.5, 2.0, 3.2), tone: 'body' },
    { faces: faceZ(-2.0, 0.0, 1.0, 1.5, 1.45), tone: 'glass' },
    { faces: faceZ(-0.2, 0.0, 1.0, 1.0, 1.45), tone: 'accent' },
    { faces: faceX(1.2, 0.55, -2.0, 2.8, 0.8), tone: 'glass' },
    { faces: box(-2.3, 2.0, -1.9, 1.4, 0.55, 1.0), tone: 'glass' },
    { faces: box(-0.5, 2.0, -1.9, 1.4, 0.55, 1.0), tone: 'glass' },
    { faces: box(1.6, 0, -1.1, 0.7, 4.1, 0.7), tone: 'accent' },
    { faces: box(1.45, 4.1, -1.25, 1.0, 0.3, 1.0), tone: 'accent' },
  ],
  // A tower beside a lower block. The bands are drawn on the two visible faces
  // rather than wrapped round as thin boxes, which stacked into a bun.
  office: [
    { faces: plate(-2.6, 0, -2.6, 5.2, 5.2), tone: 'ground' },
    { faces: box(-2.2, 0, -1.1, 1.6, 1.7, 1.9), tone: 'body' },
    { faces: faceZ(-2.0, 0.35, 0.8, 0.5, 0.5), tone: 'glass' },
    { faces: faceZ(-1.2, 0.35, 0.8, 0.5, 0.5), tone: 'glass' },
    { faces: faceZ(-2.0, 1.05, 0.8, 0.5, 0.5), tone: 'glass' },
    { faces: faceZ(-1.2, 1.05, 0.8, 0.5, 0.5), tone: 'glass' },
    { faces: box(-0.1, 0, -2.2, 2.1, 4.4, 2.1), tone: 'body' },
    { faces: faceZ(0.15, 0.5, -0.1, 1.6, 0.55), tone: 'glass' },
    { faces: faceZ(0.15, 1.55, -0.1, 1.6, 0.55), tone: 'glass' },
    { faces: faceZ(0.15, 2.6, -0.1, 1.6, 0.55), tone: 'glass' },
    { faces: faceZ(0.15, 3.65, -0.1, 1.6, 0.55), tone: 'glass' },
    { faces: faceX(2.0, 0.5, -1.95, 1.6, 0.55), tone: 'glass' },
    { faces: faceX(2.0, 1.55, -1.95, 1.6, 0.55), tone: 'glass' },
    { faces: faceX(2.0, 2.6, -1.95, 1.6, 0.55), tone: 'glass' },
    { faces: faceX(2.0, 3.65, -1.95, 1.6, 0.55), tone: 'glass' },
    { faces: box(0.75, 4.4, -1.25, 0.16, 1.1, 0.16), tone: 'accent' },
  ],
};

/**
 * Renders one zone's scene into an SVG document.
 *
 * The badge behind it is the zone colour; the model on top is drawn in white
 * at four opacities, so the icon reads on any badge and every zone's icon
 * carries exactly the same lighting.
 */
function icon(zone: Zone): string {
  const s = ZONE_STYLE[zone];
  // Top, left, right, gable-back, ground: one opacity each, and they are the
  // whole lighting model.
  const shades = [0.97, 0.80, 0.60, 0.68, 0.30];
  const accent = [1.0, 0.88, 0.70, 0.78, 0.36];

  let body = '';
  for (const part of SCENES[zone]) {
    for (const f of part.faces) {
      let fill = '#ffffff';
      let alpha = shades[f.shade];
      if (part.tone === 'accent') { alpha = accent[f.shade]; }
      if (part.tone === 'glass') { fill = s.deep; alpha = f.shade === 0 ? 0.55 : 0.72; }
      if (part.tone === 'ground') { fill = s.deep; alpha = 0.30; }
      body += `<path d="${f.d}" fill="${fill}" fill-opacity="${alpha.toFixed(2)}"/>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" role="img" aria-label="${s.label} zone">
  <defs>
    <linearGradient id="g-${zone}" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="${s.light}"/>
      <stop offset="0.5" stop-color="${s.base}"/>
      <stop offset="1" stop-color="${s.deep}"/>
    </linearGradient>
    <clipPath id="c-${zone}"><rect x="2" y="2" width="44" height="44" rx="10"/></clipPath>
  </defs>
  <rect x="2" y="2" width="44" height="44" rx="10" fill="url(#g-${zone})"/>
  <g clip-path="url(#c-${zone})">
    <g transform="translate(24 30) scale(5.1)" stroke="${s.deep}" stroke-opacity="0.30"
       stroke-width="0.05" stroke-linejoin="round">${body}</g>
  </g>
  <rect x="2.6" y="2.6" width="42.8" height="42.8" rx="9.4" fill="none"
        stroke="${s.deep}" stroke-width="1.2" opacity=".8"/>
</svg>`;
}

/** The four zone icons, as standalone SVG documents keyed by zone. */
export const ZONE_ICON: Record<Zone, string> = {
  residential: icon('residential'),
  commercial: icon('commercial'),
  industrial: icon('industrial'),
  office: icon('office'),
};

/** The icon inline, sized for UI. Returns SVG markup, not a data URL. */
export function zoneIcon(zone: Zone, size = 20): string {
  return ZONE_ICON[zone]
    .replace('width="48" height="48"', `width="${size}" height="${size}"`);
}
