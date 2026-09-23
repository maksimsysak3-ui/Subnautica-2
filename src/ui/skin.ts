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
  accent: '#6fd3ff',
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
    `font:500 12.5px/1.5 ${SKIN.mono}`,
    `color:${SKIN.text}`,
    ...extra,
  ];
}

/** A small, tracked, dim label. The caption on everything. */
export function label(extra: string[] = []): string[] {
  return [
    'font:600 10.5px/1.3 var(--label)', 'letter-spacing:.16em', 'text-transform:uppercase',
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

// ---- controls --------------------------------------------------------------

/**
 * The raised key every button in the game is.
 *
 * Three cheap tricks stacked make a square read as a physical key: a top-lit
 * gradient, so the face is brighter where a light above it would catch; a
 * hairline highlight along the top edge and a dark one along the bottom; and a
 * shadow under the whole thing. Hovering lifts it a pixel and lengthens the
 * shadow, pressing sinks it and replaces the shadow with an inset one. That is
 * the entire vocabulary, and every control that uses it feels like part of the
 * same machine.
 *
 * `accent` is what the key glows with when it is hovered or selected. Selection
 * is held in `data-on`, so a caller can select a key without knowing any of
 * this, and a selected key stops responding to hover -- it is already lit.
 */
export function key(el: HTMLElement, accent: string, size = 40): void {
  css(el, [
    'display:flex', 'align-items:center', 'justify-content:center',
    `width:${size}px`, `height:${size}px`, 'padding:0',
    `border-radius:${Math.round(size * 0.26)}px`,
    'border:1px solid rgba(255,255,255,.07)',
    'background:linear-gradient(177deg,rgba(255,255,255,.085),'
      + 'rgba(255,255,255,.012) 46%,rgba(0,0,0,.20))',
    `color:${SKIN.dim}`, 'cursor:pointer', 'position:relative',
    `font:600 10px/1 ${SKIN.mono}`,
    'transition:transform .1s, box-shadow .12s, color .12s, background .12s',
  ]);
  paintKey(el, accent, false);
  el.addEventListener('pointerenter', () => paintKey(el, accent, true));
  el.addEventListener('pointerleave', () => paintKey(el, accent, false));
  el.addEventListener('pointerdown', () => {
    el.style.transform = 'translateY(1px)';
    el.style.boxShadow = 'inset 0 2px 6px rgba(0,0,0,.55)';
  });
  el.addEventListener('pointerup', () => paintKey(el, accent, true));
}

/** Repaints a key for its current state. Call after changing `data-on`. */
export function paintKey(el: HTMLElement, accent: string, hover: boolean): void {
  // Selected reads as pressed in rather than as lit up: the light moves to the
  // bottom edge, the shadow goes inside, and the key sits a pixel low. Nothing
  // else on a physical panel looks like that, so it is unmistakable at a
  // glance -- and it is the language the tool bar already speaks.
  const on = el.dataset.on === '1';
  el.style.transform = on ? 'translateY(1px)' : hover ? 'translateY(-1px)' : 'translateY(0)';
  el.style.color = on ? accent : hover ? SKIN.bright : SKIN.dim;
  el.style.background = on
    ? `linear-gradient(177deg,${accent}44,${accent}1c 60%,rgba(0,0,0,.28))`
    : 'linear-gradient(177deg,rgba(255,255,255,.085),rgba(255,255,255,.012) 46%,'
      + 'rgba(0,0,0,.20))';
  el.style.borderColor = on ? `${accent}66` : 'rgba(255,255,255,.07)';
  el.style.boxShadow = on
    ? 'inset 0 2px 6px rgba(0,0,0,.55), inset 0 -1px 0 rgba(255,255,255,.14),'
      + ` 0 0 12px ${accent}40`
    : hover
      ? 'inset 0 1px 0 rgba(255,255,255,.22), inset 0 -1px 0 rgba(0,0,0,.42),'
        + '0 4px 9px rgba(0,0,0,.5)'
      : 'inset 0 1px 0 rgba(255,255,255,.16), inset 0 -1px 0 rgba(0,0,0,.42),'
        + '0 2px 4px rgba(0,0,0,.42)';
}

/** Selects or deselects a key painted by `key`. */
export function setKey(el: HTMLElement, accent: string, on: boolean): void {
  if (on) el.dataset.on = '1'; else delete el.dataset.on;
  paintKey(el, accent, false);
}

let tipEl: HTMLElement | null = null;
let tipTimer = 0;

/**
 * The tooltip.
 *
 * The browser's own takes a second to appear, cannot be styled, and shows a
 * different font from everything around it -- which is why every game writes
 * its own. This one appears after a beat, above the control unless there is no
 * room, and carries its keyboard shortcut in a chip on the right, because a
 * player who learns one shortcut from a tooltip stops using the mouse for it.
 *
 * The text also lands in `aria-label`, so the control is still named for a
 * screen reader and still findable by whatever is looking for it.
 */
export function tip(el: HTMLElement, text: string, shortcut?: string): void {
  el.setAttribute('aria-label', text);
  el.removeAttribute('title');
  el.dataset.tip = text;
  if (shortcut !== undefined) el.dataset.key = shortcut;

  const show = (): void => {
    const box = ensureTip();
    box.innerHTML = '';
    const t = document.createElement('span');
    t.textContent = text;
    box.appendChild(t);
    const k = el.dataset.key;
    if (k !== undefined) {
      const chip = document.createElement('span');
      chip.textContent = k;
      css(chip, ['margin-left:8px', 'padding:1px 5px', `border-radius:${SKIN.radiusSmall}`,
        `background:${SKIN.track}`, `color:${SKIN.dim}`, 'font-size:9.5px',
        `border:1px solid ${SKIN.edge}`]);
      box.appendChild(chip);
    }
    box.style.visibility = 'hidden';
    box.style.display = 'flex';
    const r = el.getBoundingClientRect();
    const w = box.offsetWidth, h = box.offsetHeight;
    const above = r.top > h + 14;
    box.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
    box.style.top = `${above ? r.top - h - 8 : r.bottom + 8}px`;
    box.style.visibility = 'visible';
    box.style.opacity = '1';
  };
  el.addEventListener('pointerenter', () => {
    clearTimeout(tipTimer);
    tipTimer = window.setTimeout(show, 260);
  });
  const hide = (): void => {
    clearTimeout(tipTimer);
    if (tipEl !== null) { tipEl.style.opacity = '0'; tipEl.style.display = 'none'; }
  };
  el.addEventListener('pointerleave', hide);
  el.addEventListener('pointerdown', hide);
}

function ensureTip(): HTMLElement {
  if (tipEl !== null) return tipEl;
  const box = document.createElement('div');
  box.dataset.panel = 'tip';
  css(box, [...panel(), 'position:fixed', 'z-index:80', 'display:none',
    'align-items:center', 'padding:5px 9px', 'pointer-events:none',
    `color:${SKIN.bright}`, 'font-size:10.5px', 'white-space:nowrap',
    'opacity:0', 'transition:opacity .12s', 'box-shadow:0 8px 22px rgba(0,0,0,.5)']);
  document.body.appendChild(box);
  tipEl = box;
  return box;
}
