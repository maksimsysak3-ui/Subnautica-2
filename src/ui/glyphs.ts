/**
 * The toolbar's pictograms: one line-drawn set, all on the same 24-unit grid,
 * the same 1.7 stroke and the same round joins.
 *
 * The bar used to mix three styles -- shaded isometric blocks, filled
 * silhouettes and thin outlines -- at three different sizes, and a row of
 * icons that do not share a pen reads as clutter however good each one is.
 * These are drawn in `currentColor`, so the tile decides the colour: the
 * category's own hue on the bar, grey when it is locked.
 */

const PATHS: Record<string, string> = {
  look: 'M12 3v18M3 12h18M12 3 9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5'
    + 'M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5',
  road: 'M8.5 3 4 21M15.5 3 20 21M12 4v2.6M12 10v3.2M12 17.2v3.3',
  signature: 'M12 2.5v2.5M9.2 21V9.6L12 5l2.8 4.6V21M4 21h16M5.5 21v-5.5h3.7M18.5 21v-5.5h-3.7'
    + 'M12 11v2',
  fire: 'M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.3 2.3-5.3 3.6-7.6.3 1.7 1.2 2.9 2.4 3.4'
    + '-.3-3.1.9-5.9 3.4-7.6-.2 2.8 1.2 4.4 2.5 6 1.2 1.5 2.1 3.2 2.1 5.4 0 3.9-3.2 6.6-7.5 6.6z'
    + 'M12 21c-1.6 0-2.7-1.1-2.7-2.7 0-1.7 1.4-2.7 2.2-4.1.9 1.2 3.2 2.4 3.2 4.2 0 1.6-1.1 2.6-2.7 2.6z',
  police: 'M12 3 5 5.8v5.4c0 4.6 3 8.3 7 9.8 4-1.5 7-5.2 7-9.8V5.8z'
    + 'M12 8.3l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z',
  health: 'M7.5 3.5h9a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-9a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4z'
    + 'M12 8v8M8 12h8',
  education: 'M2.5 9.5 12 5l9.5 4.5L12 14zM6.5 11.6v4.2c0 1.5 2.5 3.2 5.5 3.2s5.5-1.7 5.5-3.2v-4.2'
    + 'M21.5 9.5V15',
  water: 'M12 3.5c3 3.9 6 7.3 6 10.6a6 6 0 0 1-12 0c0-3.3 3-6.7 6-10.6zM9 14.6a3 3 0 0 0 2.6 2.9',
  sewage: 'M3 5.5h3v7H3zM6 7h6.5a5.5 5.5 0 0 1 5.5 5.5V14M6 11h6.5a1.5 1.5 0 0 1 1.5 1.5V14'
    + 'M12.5 14h7v2.5h-7zM16 18.8c.8 1 1.3 1.7 1.3 2.2a1.3 1.3 0 0 1-2.6 0c0-.5.5-1.2 1.3-2.2z',
  power: 'M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6z',
  transport: 'M7.5 3h9A2.5 2.5 0 0 1 19 5.5V16a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 16V5.5'
    + 'A2.5 2.5 0 0 1 7.5 3zM5 12h14M5 7h14M8 14.8h.01M16 14.8h.01M7.5 17.5V20M16.5 17.5V20',
  government: 'M3.5 9h17L12 4zM6.5 11.5v6M10 11.5v6M14 11.5v6M17.5 11.5v6M3.5 20.5h17',
  parks: 'M12 21v-5.5M12 15.5c-3.6 0-6-2.2-6-5.2 0-2.6 1.9-4.2 3.4-4.5C10 4 11 3 12 3s2 1 2.6 2.8'
    + 'c1.5.3 3.4 1.9 3.4 4.5 0 3-2.4 5.2-6 5.2zM12 12.5l-2-1.8M12 11l2-1.8M8.5 21h7',
  deathcare: 'M6.5 20.5V9.5a5.5 5.5 0 0 1 11 0v11M4.5 20.5h15M12 8.5v6.5M9.5 10.8h5',
  post: 'M5 5.5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z'
    + 'M3.5 7.2l8.5 6.1 8.5-6.1',
  bus: 'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5V16H4zM4 11h16M9 4v7M15 4v7'
    + 'M6.5 16v2.2M17.5 16v2.2M4 16h16',
  tram: 'M9 2.5h6M12 2.5v3M7 5.5h10a2 2 0 0 1 2 2V16a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 16'
    + 'V7.5a2 2 0 0 1 2-2zM5 11.5h14M8.5 17.5 6.5 21M15.5 17.5l2 3.5M8.5 14.5h.01M15.5 14.5h.01',
  land: 'M4 12.5h16v8H4zM12 12.5V3.5l5.5 2.2L12 8',
  clear: 'M3 17.5h11.5V12L12.5 8H7L5 12H3zM7 12h7.5M14.5 14.5h2.2L20 8.5M20.5 8l.5 8.5-4.3.5'
    + 'M5.5 20.5a1.5 1.5 0 1 0 0-.01M12 20.5a1.5 1.5 0 1 0 0-.01M5.5 19h6.5',
  save: 'M5.5 3.5h10.2l4.8 4.8v10.2a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z'
    + 'M8 3.5v5h7v-5M7.5 20.5v-6h9v6',
  develop: 'M12 2.8l2.7 5.7 6.2.8-4.5 4.3 1.1 6.2L12 16.8l-5.5 3 1.1-6.2-4.5-4.3 6.2-.8z',
  settings: 'M4 7h9M17.5 7H20M4 17h2.5M11 17h9M15.3 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'
    + 'M8.7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  money: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM14.8 8.8c-.6-.8-1.6-1.3-2.8-1.3-1.7 0-2.9.9-2.9 2.2'
    + ' 0 3 5.9 1.6 5.9 4.6 0 1.3-1.3 2.2-3 2.2-1.3 0-2.4-.5-3-1.4M12 5.8v1.7M12 16.5v1.7',
  level: 'M3 21h18M5 21v-9h4v9M9 21V6.5L12 4l3 2.5V21M15 21v-7h4v7M11 9h2M11 12h2M11 15h2',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9.5H6z',
};

/** Whether there is a pictogram by this name. */
export function hasGlyph(name: string): boolean {
  return name in PATHS;
}

/**
 * Pictograms that are only lines: filling them would shade whatever the open
 * strokes happen to enclose.
 */
const LINE_ONLY = new Set(['look', 'road', 'sewage', 'settings', 'clear']);

/**
 * One pictogram as inline SVG markup, drawn in the element's text colour.
 *
 * Two-tone: the shape is washed with its own colour under the outline, which
 * is what lets a row of them read as solid objects at toolbar size rather than
 * as wireframes.
 */
export function glyph(name: string, size = 24): string {
  const d = PATHS[name] ?? PATHS.develop;
  const wash = LINE_ONLY.has(name) ? ''
    : `<path d="${d}" fill="currentColor" fill-opacity=".28" stroke="none"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" `
    + 'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" '
    + `aria-hidden="true">${wash}<path d="${d}"/></svg>`;
}
