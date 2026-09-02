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

/** The four zone icons, as standalone SVG documents keyed by zone. */
export const ZONE_ICON: Record<Zone, string> = {
  residential: icon('residential', `
    <!-- garden strip and a tree, so the low-density read is immediate -->
    <path d="M6 38h36v4H6z" fill="{light}" opacity=".55"/>
    <path d="M11.5 38v-5" stroke="{deep}" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="11.5" cy="30" r="3.6" fill="{deep}" opacity=".85"/>
    <!-- terrace behind, main house in front: two depths in one silhouette -->
    <path d="M28 20h13v18H28z" fill="{deep}" opacity=".35"/>
    <path d="M28 20l6.5-5 6.5 5" fill="none" stroke="{deep}" stroke-width="2"
          stroke-linejoin="round" opacity=".45"/>
    <path d="M16 24h16v14H16z" fill="#fff"/>
    <path d="M14 24.5L24 16l10 8.5" fill="none" stroke="#fff" stroke-width="3"
          stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M19 28h4v4h-4zM26 28h4v4h-4z" fill="{deep}"/>
    <path d="M22.2 34h3.6v4h-3.6z" fill="{deep}" opacity=".7"/>
  `),
  commercial: icon('commercial', `
    <path d="M6 38h36v4H6z" fill="{light}" opacity=".55"/>
    <!-- shopfront: fascia sign, striped awning, glazing, door -->
    <path d="M12 16h24v6H12z" fill="#fff"/>
    <path d="M15 18.2h13v1.7H15z" fill="{deep}" opacity=".8"/>
    <path d="M12 22h24v4H12z" fill="{deep}" opacity=".45"/>
    <path d="M14 22h3v4h-3zM20 22h3v4h-3zM26 22h3v4h-3zM32 22h3v4h-3z" fill="#fff" opacity=".9"/>
    <path d="M12 26h24v12H12z" fill="#fff" opacity=".92"/>
    <path d="M15 29h7v6h-7zM26 29h7v6h-7z" fill="{deep}"/>
    <path d="M22.6 29h2.8v9h-2.8z" fill="{deep}" opacity=".65"/>
    <!-- blade sign standing off the corner -->
    <path d="M36 17h5v8h-5z" fill="{deep}"/>
    <circle cx="38.5" cy="21" r="1.5" fill="{light}"/>
  `),
  industrial: icon('industrial', `
    <path d="M6 38h36v4H6z" fill="{light}" opacity=".55"/>
    <!-- chimney with a puff of smoke -->
    <path d="M32 14h5v24h-5z" fill="#fff"/>
    <path d="M31 14h7v2.4h-7z" fill="{deep}" opacity=".6"/>
    <circle cx="36" cy="9.5" r="3" fill="#fff" opacity=".5"/>
    <circle cx="31.5" cy="7" r="2.2" fill="#fff" opacity=".32"/>
    <!-- sawtooth shed: the shape that says "works" faster than any other -->
    <path d="M8 38V26l6-6 0 6 6-6 0 6 6-6 0 18z" fill="#fff"/>
    <path d="M14 20v6M20 20v6M26 20v6" stroke="{deep}" stroke-width="1.4" opacity=".55"/>
    <path d="M11 30h5v8h-5z" fill="{deep}"/>
    <path d="M19 30h8v3h-8z" fill="{deep}" opacity=".6"/>
    <path d="M19 34.5h8v3.5h-8z" fill="{deep}" opacity=".85"/>
  `),
  office: icon('office', `
    <path d="M6 38h36v4H6z" fill="{light}" opacity=".55"/>
    <!-- low block beside a tower: the density story in one glance -->
    <path d="M8 26h11v12H8z" fill="{deep}" opacity=".38"/>
    <path d="M10.5 29h2.5v2.5h-2.5zM14.5 29h2.5v2.5h-2.5zM10.5 33h2.5v2.5h-2.5zM14.5 33h2.5v2.5h-2.5z"
          fill="#fff" opacity=".55"/>
    <path d="M21 12h17v26H21z" fill="#fff"/>
    <path d="M21 12h17v3.2H21z" fill="{deep}" opacity=".55"/>
    <path d="M29.2 6h1.6v6h-1.6z" fill="{deep}"/>
    <path d="M24 18h4v3h-4zM31 18h4v3h-4zM24 23h4v3h-4zM31 23h4v3h-4zM24 28h4v3h-4zM31 28h4v3h-4z"
          fill="{deep}"/>
    <path d="M27.4 33h4.2v5h-4.2z" fill="{deep}" opacity=".7"/>
  `),
};

/**
 * Wraps a glyph in the shared badge: rounded square, zone fill, a soft top
 * highlight so the icons do not look like flat stickers, and a hairline
 * border that keeps them legible on both light and dark chrome.
 */
function icon(zone: string, glyph: string): string {
  const s = ZONE_STYLE[zone as Zone];
  const body = glyph
    .replace(/\{deep\}/g, s.deep)
    .replace(/\{light\}/g, s.light)
    .replace(/\{base\}/g, s.base);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" role="img" aria-label="${s.label} zone">
  <defs>
    <linearGradient id="g-${zone}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${s.light}"/>
      <stop offset="0.55" stop-color="${s.base}"/>
      <stop offset="1" stop-color="${s.deep}"/>
    </linearGradient>
    <clipPath id="c-${zone}"><rect x="2" y="2" width="44" height="44" rx="10"/></clipPath>
  </defs>
  <rect x="2" y="2" width="44" height="44" rx="10" fill="url(#g-${zone})"/>
  <g clip-path="url(#c-${zone})">${body}</g>
  <rect x="2.6" y="2.6" width="42.8" height="42.8" rx="9.4" fill="none"
        stroke="${s.deep}" stroke-width="1.2" opacity=".75"/>
</svg>`;
}

/** The icon inline, sized for UI. Returns SVG markup, not a data URL. */
export function zoneIcon(zone: Zone, size = 20): string {
  return ZONE_ICON[zone]
    .replace('width="48" height="48"', `width="${size}" height="${size}"`);
}
