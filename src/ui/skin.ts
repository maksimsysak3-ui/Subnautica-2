/**
 * One surface, one type scale, one way of drawing a number.
 *
 * Every panel in this game was styled where it was written, so there were five
 * card backgrounds, four border colours, three ideas about what a label looks
 * like and no two bars the same height. Individually all defensible; together a
 * set of windows from different programs.
 *
 * This is the one place those decisions live. It is deliberately small -- a
 * handful of tokens and five helpers -- because a design system nobody can hold
 * in their head is a design system that grows a sixth card background.
 *
 * THE RULES IT ENCODES.
 *
 *   A panel is a dark, slightly translucent slab with a hairline edge and a
 *   highlight along its top, which is what makes it read as lit from above
 *   rather than as a hole cut in the screen.
 *
 *   Labels are small, tracked and dim. Values are larger, bright, and lined up
 *   on their digits. The eye reads down a column of numbers, so the numbers have
 *   to form a column.
 *
 *   One accent at a time, and it belongs to whatever the panel is about -- the
 *   view's own colour, the zone's own colour. A panel with two accents has none.
 *
 *   Nothing is pure white and nothing is pure black. The brightest text is a
 *   warm off-white and the ground is a blue-black, so the interface sits over a
 *   daylit city without either burning through it or disappearing into it.
 */

/** The palette. Everything else here is made of these. */
export const SKIN = {
  /** Panel ground, and the hairline round it. */
  panel: 'rgba(10,14,20,.90)',
  panelSolid: '#0a0e14',
  edge: 'rgba(255,255,255,.09)',
  /** The light along the top edge, which is what makes a slab a slab. */
  sheen: 'rgba(255,255,255,.07)',
  /** Text, from brightest to faintest. */
  bright: '#e8eef6',
  text: '#a9b8cb',
  dim: '#6d8098',
  faint: '#4c5c70',
  /** The one accent, when nothing else has claimed it. */
  accent: '#62d4ff',
  /** Good, middling, bad -- for values rather than for maps. */
  good: '#5fc78c',
  warn: '#e8b454',
  bad: '#e0685a',
  /** Where a bar's track sits. */
  track: 'rgba(255,255,255,.06)',
  /** Radii and the type stack. */
  radius: '8px',
  radiusSmall: '4px',
  mono: 'var(--mono)',
} as const;

export function css(el: HTMLElement, decls: string[]): void {
  el.style.cssText = decls.join(';');
}

/**
 * The slab every panel is drawn on.
 *
 * A gradient rather than a flat fill, and a inset highlight rather than a
 * border on all four sides: a panel lit from the top has an edge you can see at
 * the top and one you cannot at the bottom, which is what a real object does.
 */
export function panel(extra: string[] = []): string[] {
  return [
    `background:linear-gradient(180deg,rgba(18,24,33,.93),${SKIN.panel})`,
    `border:1px solid ${SKIN.edge}`,
    `border-radius:${SKIN.radius}`,
    `box-shadow:inset 0 1px 0 ${SKIN.sheen}, 0 10px 30px rgba(0,0,0,.42)`,
    'backdrop-filter:blur(16px)',
    `font:11px/1.5 ${SKIN.mono}`,
    `color:${SKIN.text}`,
    ...extra,
  ];
}

/** A small, tracked, dim label. The caption on everything. */
export function label(extra: string[] = []): string[] {
  return [
    'font-size:9px', 'letter-spacing:.15em', 'text-transform:uppercase',
    `color:${SKIN.dim}`, ...extra,
  ];
}

/** A number, lined up on its digits. */
export function value(extra: string[] = []): string[] {
  return [
    'font-variant-numeric:tabular-nums', `color:${SKIN.bright}`,
    'text-align:right', ...extra,
  ];
}

/**
 * A thin bar with a rounded track.
 *
 * Returns the track and the fill, because every bar in the game is those two
 * elements and every one of them used to be built by hand.
 */
export function bar(colour: string, height = 3): { track: HTMLElement; fill: HTMLElement } {
  const track = document.createElement('div');
  css(track, ['position:relative', 'width:100%', `height:${height}px`,
    `background:${SKIN.track}`, `border-radius:${height}px`, 'overflow:hidden']);
  const fill = document.createElement('div');
  css(fill, ['position:absolute', 'inset:0 auto 0 0', 'width:0%',
    `background:${colour}`, `border-radius:${height}px`,
    'transition:width .3s cubic-bezier(.2,.7,.3,1)']);
  track.appendChild(fill);
  return { track, fill };
}

/** A hairline rule, for separating groups inside a panel. */
export function rule(): HTMLElement {
  const el = document.createElement('div');
  css(el, ['height:1px', `background:${SKIN.edge}`, 'margin:2px 0']);
  return el;
}

/** Mixes a hex colour towards another, for hover and pressed states. */
export function shade(hex: string, towards: string, amount: number): string {
  const read = (h: string): [number, number, number] => {
    const n = parseInt(h.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const a = read(hex), b = read(towards);
  const m = (i: number): number => Math.round(a[i] + (b[i] - a[i]) * amount);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}
