/**
 * The information views: the panel, the icons, and what the map is showing.
 *
 * One button at the bottom-left opens a rail of twelve icons. Picking one puts
 * that view's readings on the map -- a wash of colour over the surface, or the
 * world buried and the mains lit through it -- and its numbers in a card on the
 * left. The map keeps the whole right-hand side of the screen, which is the point:
 * the statistics are a caption on the picture, not a replacement for it.
 *
 * WHY THE PANEL IS DUMB. Nothing here knows what a service is. It is handed a
 * `ViewInfo` table and a function that returns rows of label, value and bar, and
 * it lays them out. Adding a view is a row in `VIEWS` over in the simulation and
 * nothing here at all -- and that is why the twelve views cost one panel rather
 * than twelve.
 *
 * WHY IT REPAINTS ITSELF RATHER THAN BEING TOLD TO. The numbers behind it change
 * every tick, and repainting a card of thirteen rows three hundred times a second
 * would be a measurable part of the frame for no visible benefit. Four times a
 * second is faster than a player can read and is what `REPAINT_MS` buys.
 */

import { VIEWS, View, Look } from '../sim';
import type { ViewInfo, Stat } from '../sim';
import { GLYPH } from './zones';

/** How often the card's numbers are rewritten, in milliseconds. */
const REPAINT_MS = 250;

/**
 * The four pictograms the zoning palette has no use for.
 *
 * Drawn in the same forty-eight unit box and with the same even-odd convention as
 * the branch glyphs, so one renderer serves both: an inner subpath cuts a hole
 * rather than drawing over the top.
 */
export const EXTRA_GLYPH: Record<string, string> = {
  // A traffic light on its pole, with the three lamps cut out.
  traffic: 'M20 4h8a6 6 0 0 1 6 6v24a6 6 0 0 1-6 6h-8a6 6 0 0 1-6-6V10a6 6 0 0 1 6-6z'
         + 'M21.5 40h5v5h-5z'
         + 'M24 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 1 0 0-7.2z'
         + 'M24 18.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 1 0 0-7.2z'
         + 'M24 28.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 1 0 0-7.2z',
  // A flanged pipe with something leaving it. A manhole cover reads as a circle
  // at sixteen pixels and a circle reads as nothing.
  sewage: 'M5 13h5v20H5zM38 13h5v20h-5zM10 18h28v12H10z'
        + 'M24 30c-.4 0-.7.2-.9.5C21.5 32.9 19 36.6 19 39.2 19 41.9 21.2 44 24 44'
        + 's5-2.1 5-4.8c0-2.6-2.5-6.3-4.1-8.7A1.1 1.1 0 0 0 24 30z',
  // A wheeled bin: lid, handle, tapered body, two ribs cut through it.
  rubbish: 'M20 5h8v4h-8zM13 10h22v5H13z'
         + 'M14 16h20l-1.7 24.2a3 3 0 0 1-3 2.8H18.7a3 3 0 0 1-3-2.8L14 16z'
         + 'M20 21h2.5v16H20zM25.5 21H28v16h-2.5z',
  // A face. Desirability is how the city feels to live in, and every other way of
  // drawing that -- a leaf, a rising bar, a heart -- says something narrower.
  desire: 'M24 4a20 20 0 1 0 0 40 20 20 0 1 0 0-40z'
        + 'M17.5 17a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 1 0 0-5.8z'
        + 'M30.5 17a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 1 0 0-5.8z'
        + 'M14.6 26.8a1.8 1.8 0 0 0-1.7 2.6C15 34.2 19.2 37.2 24 37.2s9-3 11.1-7.8'
        + 'a1.8 1.8 0 0 0-3.3-1.4C30.2 31.5 27.3 33.6 24 33.6s-6.2-2.1-7.8-5.6'
        + 'a1.8 1.8 0 0 0-1.6-1.2z',
};

/** The little chart on the launcher. */
const LAUNCHER_GLYPH = 'M6 6h4v36H6zM6 38h36v4H6z'
  + 'M14 28h5v10h-5zM22 19h5v19h-5zM30 24h5v14h-5zM38 11h5v27h-5z';

function glyphFor(key: string): string {
  return EXTRA_GLYPH[key] ?? (GLYPH as Record<string, string | undefined>)[key]
    ?? LAUNCHER_GLYPH;
}

function svg(path: string, colour: string, size: number): string {
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">`
    + `<path d="${path}" fill="${colour}" fill-rule="evenodd"/></svg>`;
}

function style(el: HTMLElement, decls: string[]): void {
  el.style.cssText = decls.join(';');
}

/** The panel's own chrome, shared with the rest of the interface. */
const CARD = [
  'background:rgba(8,12,17,.88)', 'border:1px solid rgba(98,212,255,.16)',
  'border-radius:5px', 'backdrop-filter:blur(14px)',
  'font:11px/1.55 var(--mono)', 'color:#8fa3bd',
];

export class InfoViews {
  private readonly root: HTMLElement;
  private readonly launcher: HTMLButtonElement;
  private readonly rail: HTMLElement;
  private readonly card: HTMLElement;
  private readonly title: HTMLElement;
  private readonly legend: HTMLElement;
  private readonly scale: HTMLElement;
  private readonly rows: HTMLElement;
  private readonly buttons = new Map<number, HTMLButtonElement>();

  /** Which view is up, or `View.NONE`. */
  private current: number = View.NONE;
  /** Whether the rail is out. The rail can be out with nothing picked. */
  private railOpen = false;
  private paintedAt = -1;
  /** How many rows the card is currently showing, so a repaint can reuse them. */
  private shown = 0;

  /**
   * @param parent the interface layer over the canvas.
   * @param onView called when the selection changes, with `View.NONE` and null
   *   when the player closes the last one.
   */
  constructor(parent: HTMLElement,
    private onView: (view: number, info: ViewInfo | null) => void) {
    this.root = document.createElement('div');
    style(this.root, [
      'position:absolute', 'left:12px', 'bottom:14px', 'z-index:6',
      'display:flex', 'flex-direction:column', 'align-items:flex-start',
      'gap:8px', 'pointer-events:none',
    ]);

    this.card = document.createElement('div');
    // Named parts, so a test can find the card, the rail and a row without
    // matching on a style string -- which the browser rewrites on assignment,
    // and which therefore silently matches nothing.
    this.card.dataset.panel = 'view-stats';
    style(this.card, [...CARD,
      'width:262px', 'padding:10px 12px 11px', 'display:none',
      'pointer-events:auto', 'letter-spacing:.02em',
    ]);
    this.title = document.createElement('div');
    style(this.title, ['font:600 13px/1.3 var(--sans, var(--mono))',
      'color:#dfe9f4', 'letter-spacing:.01em']);
    this.legend = document.createElement('div');
    style(this.legend, ['margin:3px 0 8px', 'color:#7b8ea6', 'font-size:10.5px',
      'line-height:1.45']);
    this.scale = document.createElement('div');
    style(this.scale, ['margin-bottom:9px']);
    this.rows = document.createElement('div');
    style(this.rows, ['display:flex', 'flex-direction:column', 'gap:3px',
      'max-height:46vh', 'overflow-y:auto']);
    this.card.append(this.title, this.legend, this.scale, this.rows);

    this.rail = document.createElement('div');
    this.rail.dataset.panel = 'view-rail';
    style(this.rail, [...CARD,
      'padding:6px', 'display:none', 'grid-template-columns:repeat(6, 32px)',
      'gap:4px', 'pointer-events:auto',
    ]);
    for (const info of VIEWS) this.rail.appendChild(this.button(info));

    this.launcher = document.createElement('button');
    this.launcher.type = 'button';
    this.launcher.title = 'Information views';
    this.launcher.setAttribute('aria-label', 'Information views');
    style(this.launcher, [...CARD,
      'width:38px', 'height:38px', 'display:grid', 'place-items:center',
      'cursor:pointer', 'pointer-events:auto', 'padding:0',
      'transition:border-color .12s, background .12s',
    ]);
    this.launcher.innerHTML = svg(LAUNCHER_GLYPH, '#8fa3bd', 19);
    this.launcher.addEventListener('click', () => this.toggleRail());

    this.root.append(this.card, this.rail, this.launcher);
    parent.appendChild(this.root);

    // Escape closes, which is what every other panel in the game does. On the
    // window rather than the button, because the player's hand is on the map.
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.railOpen) { this.closeAll(); }
    });
  }

  private button(info: ViewInfo): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.title = info.name;
    b.setAttribute('aria-label', info.name);
    style(b, [
      'width:32px', 'height:32px', 'display:grid', 'place-items:center',
      'padding:0', 'cursor:pointer', 'border-radius:3px',
      'background:rgba(255,255,255,.03)', 'border:1px solid transparent',
      'transition:background .1s, border-color .1s',
    ]);
    // The icon takes the good end of the view's own ramp, so the button and the
    // map agree about what colour the subject is before anything is clicked.
    b.innerHTML = svg(glyphFor(info.icon), info.ramp[2], 19);
    b.addEventListener('click', () => this.pick(info.id));
    this.buttons.set(info.id, b);
    return b;
  }

  /** Which view is open, or `View.NONE`. */
  get view(): number { return this.current; }

  /** A view's table entry, for whoever is drawing the map. */
  meta(view: number): ViewInfo | null {
    return VIEWS.find((v) => v.id === view) ?? null;
  }

  /** Hides the whole thing, for the menu. */
  set visible(on: boolean) {
    this.root.style.display = on ? 'flex' : 'none';
    if (!on) this.closeAll();
  }

  private toggleRail(): void {
    this.railOpen = !this.railOpen;
    if (this.railOpen) {
      this.rail.style.display = 'grid';
      this.launcher.style.borderColor = 'rgba(98,212,255,.5)';
    } else {
      this.closeAll();
    }
  }

  private closeAll(): void {
    this.railOpen = false;
    this.rail.style.display = 'none';
    this.launcher.style.borderColor = 'rgba(98,212,255,.16)';
    this.select(View.NONE);
  }

  private pick(id: number): void {
    this.select(this.current === id ? View.NONE : id);
  }

  private select(id: number): void {
    if (id === this.current) return;
    const was = this.buttons.get(this.current);
    if (was !== undefined) {
      was.style.background = 'rgba(255,255,255,.03)';
      was.style.borderColor = 'transparent';
    }
    this.current = id;
    const info = VIEWS.find((v) => v.id === id) ?? null;
    if (info === null) {
      this.card.style.display = 'none';
      this.onView(View.NONE, null);
      return;
    }
    const b = this.buttons.get(id);
    if (b !== undefined) {
      b.style.background = 'rgba(98,212,255,.14)';
      b.style.borderColor = info.ramp[2];
    }
    this.card.style.display = 'block';
    this.title.textContent = info.name;
    this.title.style.color = info.ramp[2];
    this.legend.textContent = info.legend;
    this.scale.innerHTML = this.ramp(info);
    this.rows.replaceChildren();
    this.shown = 0;
    this.paintedAt = -1;
    this.onView(id, info);
  }

  /** The three-stop bar and what its ends mean. */
  private ramp(info: ViewInfo): string {
    const [lo, mid, hi] = info.ramp;
    const bar = `background:linear-gradient(90deg,${lo},${mid},${hi})`;
    const buried = info.look === Look.UNDERGROUND
      ? '<span style="color:#5ad6f0">underground</span>' : '';
    return `<div style="height:6px;border-radius:3px;${bar}"></div>`
      + '<div style="display:flex;justify-content:space-between;margin-top:3px;'
      + `font-size:9.5px;color:#66798f;letter-spacing:.04em">`
      + `<span>none</span><span>${escapeHtml(info.unit)}</span>`
      + `<span>all</span></div>${buried
        ? `<div style="font-size:9.5px;margin-top:2px">${buried}</div>` : ''}`;
  }

  /**
   * Rewrites the numbers, at most four times a second.
   *
   * `read` is only called on the repaints that happen, which matters: gathering
   * thirteen statistics walks a few of the simulation's tables, and doing it on
   * every frame to throw it away was the whole cost of having the panel open.
   */
  refresh(now: number, read: () => Stat[]): void {
    if (this.current === View.NONE) return;
    if (now - this.paintedAt < REPAINT_MS) return;
    this.paintedAt = now;
    const stats = read();

    // Rows are reused rather than rebuilt: replaceChildren on every repaint threw
    // away the scroll position in the card whenever the list was longer than it.
    while (this.shown < stats.length) {
      this.rows.appendChild(this.row());
      this.shown++;
    }
    while (this.shown > stats.length) {
      this.rows.lastElementChild?.remove();
      this.shown--;
    }
    const children = this.rows.children;
    for (let i = 0; i < stats.length; i++) {
      const s = stats[i];
      const el = children[i] as HTMLElement;
      const label = el.firstElementChild as HTMLElement;
      const value = label.nextElementSibling as HTMLElement;
      const track = el.lastElementChild as HTMLElement;
      if (label.textContent !== s.label) label.textContent = s.label;
      const text = s.value;
      if (value.textContent !== text) value.textContent = text;
      value.style.color = s.warn ? '#ff8f6b' : '#dfe9f4';
      if (s.bar < 0) {
        track.style.display = 'none';
      } else {
        track.style.display = 'block';
        const fill = track.firstElementChild as HTMLElement;
        fill.style.width = `${Math.round(Math.max(0, Math.min(1, s.bar)) * 100)}%`;
        fill.style.background = s.warn ? '#e0604a' : 'rgba(98,212,255,.55)';
      }
    }
  }

  private row(): HTMLElement {
    const el = document.createElement('div');
    el.dataset.stat = '';
    style(el, ['display:grid', 'grid-template-columns:1fr auto',
      'grid-template-areas:"l v" "t t"', 'column-gap:8px', 'align-items:baseline']);
    const label = document.createElement('span');
    style(label, ['grid-area:l', 'color:#7b8ea6', 'overflow:hidden',
      'text-overflow:ellipsis', 'white-space:nowrap']);
    const value = document.createElement('span');
    style(value, ['grid-area:v', 'color:#dfe9f4', 'font-variant-numeric:tabular-nums']);
    const track = document.createElement('div');
    track.dataset.bar = '';
    style(track, ['grid-area:t', 'height:3px', 'margin:1px 0 3px',
      'border-radius:2px', 'background:rgba(255,255,255,.07)', 'display:none']);
    const fill = document.createElement('div');
    style(fill, ['height:100%', 'border-radius:2px', 'width:0%',
      'background:rgba(98,212,255,.55)', 'transition:width .2s']);
    track.appendChild(fill);
    el.append(label, value, track);
    return el;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => (
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'));
}
