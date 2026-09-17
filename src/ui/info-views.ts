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

import { VIEWS, View, Look, PANEL_ONLY } from '../sim';
import type { ViewInfo, Stat } from '../sim';
import { GLYPH } from './zones';
import { SKIN, panel, label as labelStyle } from './skin';

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
  // A wheeled bin: lid, handle, tapered body, two ribs cut through it.
  rubbish: 'M20 5h8v4h-8zM13 10h22v5H13z'
         + 'M14 16h20l-1.7 24.2a3 3 0 0 1-3 2.8H18.7a3 3 0 0 1-3-2.8L14 16z'
         + 'M20 21h2.5v16H20zM25.5 21H28v16h-2.5z',
  // Coins, stacked, with a note behind them. A budget is money, and every other
  // way of drawing one -- a ledger, a graph, a percentage -- says something
  // narrower than "this is about what the city has".
  budget: 'M8 5h32a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z'
        + 'M24 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7z'
        + 'M5 23h38v3.5H5zM5 29h38v3.5H5z'
        + 'M14 36a7 7 0 1 0 0 14 7 7 0 1 0 0-14z'
        + 'M14 39.4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 1 1 0-7.2z',
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


export class InfoViews {
  private readonly root: HTMLElement;
  private readonly launcher: HTMLButtonElement;
  private readonly rail: HTMLElement;
  private readonly card: HTMLElement;
  private readonly title: HTMLElement;
  private readonly head: HTMLElement;
  private readonly swatch: HTMLElement;
  private readonly hero: HTMLElement;
  private readonly heroValue: HTMLElement;
  private readonly heroLabel: HTMLElement;
  private readonly legend: HTMLElement;
  private readonly scale: HTMLElement;
  private readonly rows: HTMLElement;
  private readonly extra: HTMLElement;
  /** Controls a view brings with it, by view id. */
  private readonly controls = new Map<number, HTMLElement>();
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
    style(this.card, [...panel(), 'width:276px', 'padding:13px 14px 12px',
      'display:none', 'pointer-events:auto']);

    // The head: a swatch in the view's own colour, and its name. The swatch is
    // the same colour the map is about to be tinted in, so the card and the
    // ground agree about what the subject is before anything is read.
    const head = document.createElement('div');
    style(head, ['display:flex', 'align-items:center', 'gap:7px']);
    this.swatch = document.createElement('span');
    style(this.swatch, ['width:3px', 'height:13px', 'border-radius:2px',
      'flex:0 0 auto']);
    this.title = document.createElement('div');
    style(this.title, [...labelStyle(), 'font-size:10px', `color:${SKIN.text}`,
      'letter-spacing:.17em']);
    head.append(this.swatch, this.title);
    this.head = head;

    // The headline. One number, large, with what it is underneath it -- because
    // a panel of thirteen equal rows has no answer in it, only data. Every view
    // has one thing a player opened it to find out, and this is that thing.
    this.hero = document.createElement('div');
    style(this.hero, ['display:flex', 'align-items:baseline', 'gap:7px',
      'margin:9px 0 2px']);
    this.heroValue = document.createElement('span');
    style(this.heroValue, [`font:300 25px/1 ${SKIN.mono}`,
      `color:${SKIN.bright}`, 'font-variant-numeric:tabular-nums',
      'letter-spacing:-.02em']);
    this.heroLabel = document.createElement('span');
    style(this.heroLabel, ['font-size:10px', `color:${SKIN.dim}`,
      'line-height:1.3']);
    this.hero.append(this.heroValue, this.heroLabel);

    this.legend = document.createElement('div');
    style(this.legend, ['margin:2px 0 9px', `color:${SKIN.faint}`,
      'font-size:10px', 'line-height:1.5']);
    this.scale = document.createElement('div');
    style(this.scale, ['margin-bottom:10px']);
    this.rows = document.createElement('div');
    style(this.rows, ['display:flex', 'flex-direction:column', 'gap:3px',
      'max-height:46vh', 'overflow-y:auto']);
    // Where a view mounts controls of its own. Empty for all but the budget,
    // which is the one view that is not only a readout: a tax rate is a thing
    // the player sets, and setting it two panels away from the number it moves
    // would be two panels away from the only reason to set it.
    this.extra = document.createElement('div');
    style(this.extra, ['display:none', 'margin-top:8px',
      'border-top:1px solid rgba(98,212,255,.14)', 'padding-top:8px']);
    this.card.append(this.head, this.hero, this.legend, this.scale, this.rows,
      this.extra);

    this.rail = document.createElement('div');
    this.rail.dataset.panel = 'view-rail';
    style(this.rail, [...panel(),
      'padding:7px', 'display:none', 'grid-template-columns:repeat(7, 32px)',
      'gap:4px', 'pointer-events:auto',
    ]);
    for (const info of VIEWS) this.rail.appendChild(this.button(info));

    this.launcher = document.createElement('button');
    this.launcher.type = 'button';
    this.launcher.title = 'Information views';
    this.launcher.setAttribute('aria-label', 'Information views');
    style(this.launcher, [...panel(),
      'width:40px', 'height:40px', 'display:grid', 'place-items:center',
      'cursor:pointer', 'pointer-events:auto', 'padding:0',
      'transition:border-color .12s, background .12s',
    ]);
    this.launcher.innerHTML = svg(LAUNCHER_GLYPH, SKIN.dim, 19);
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
      'padding:0', 'cursor:pointer', `border-radius:${SKIN.radiusSmall}`,
      'background:rgba(255,255,255,.025)', 'border:1px solid transparent',
      'transition:background .12s, border-color .12s',
    ]);
    // NEUTRAL UNTIL PICKED. Every icon used to be drawn in the good end of its
    // own view's ramp, and eight of the thirteen ramps end in green -- so the
    // rail was a block of near-identical green pictograms that read as one
    // texture rather than as thirteen things you could choose between. The
    // colour is information about the *map*, and it belongs on the map and on
    // the one button that is switched on.
    b.innerHTML = svg(glyphFor(info.icon), SKIN.dim, 19);
    b.dataset.icon = info.icon;
    b.addEventListener('click', () => this.pick(info.id));
    this.buttons.set(info.id, b);
    return b;
  }

  /**
   * Gives a view controls of its own, shown under its rows.
   *
   * The panel still knows nothing about what they are -- it is handed an element
   * and it shows it when that view is up, which keeps adding one to a view a
   * matter of one call rather than a special case in here.
   */
  mount(view: number, el: HTMLElement): void {
    this.controls.set(view, el);
    el.style.display = 'none';
    this.extra.appendChild(el);
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
      was.style.background = 'rgba(255,255,255,.025)';
      was.style.borderColor = 'transparent';
      const icon = was.dataset.icon ?? '';
      was.innerHTML = svg(glyphFor(icon), SKIN.dim, 19);
      was.dataset.icon = icon;
    }
    this.current = id;
    const info = VIEWS.find((v) => v.id === id) ?? null;
    if (info === null) {
      this.card.style.display = 'none';
      this.showControls(View.NONE);
      this.onView(View.NONE, null);
      return;
    }
    const b = this.buttons.get(id);
    if (b !== undefined) {
      b.style.background = 'rgba(255,255,255,.07)';
      b.style.borderColor = info.ramp[2];
      b.innerHTML = svg(glyphFor(info.icon), info.ramp[2], 19);
      b.dataset.icon = info.icon;
    }
    this.card.style.display = 'block';
    this.title.textContent = info.name;
    this.swatch.style.background = info.ramp[2];
    this.accent = info.ramp[2];
    this.heroValue.textContent = '—';
    this.heroLabel.textContent = '';
    this.legend.textContent = info.legend;
    // A view that paints nothing has no scale to explain. The swatch strip is
    // the legend for a map, and a budget is not one.
    const mapped = !PANEL_ONLY.has(id);
    this.scale.style.display = mapped ? 'block' : 'none';
    this.scale.innerHTML = mapped ? this.ramp(info) : '';
    this.rows.replaceChildren();
    this.shown = 0;
    this.paintedAt = -1;
    this.showControls(id);
    this.onView(id, info);
  }

  /** The three-stop bar and what its ends mean. */
  /** Shows the open view's own controls, and hides everybody else's. */
  private showControls(id: number): void {
    let any = false;
    for (const [view, el] of this.controls) {
      const on = view === id;
      el.style.display = on ? 'block' : 'none';
      if (on) any = true;
    }
    this.extra.style.display = any ? 'block' : 'none';
  }

  private ramp(info: ViewInfo): string {
    const [lo, mid, hi] = info.ramp;
    const bar = `background:linear-gradient(90deg,${lo},${mid} 50%,${hi})`;
    const buried = info.look === Look.UNDERGROUND
      ? `<span style="color:${SKIN.accent}">· below ground</span>` : '';
    // Thin, and captioned with the two ends and nothing in the middle: the
    // middle of a three-stop ramp needs no word, and putting one there is how a
    // legend ends up with more text on it than the panel it is legending.
    return `<div style="height:4px;border-radius:2px;${bar};`
      + 'box-shadow:inset 0 0 0 1px rgba(0,0,0,.25)"></div>'
      + '<div style="display:flex;justify-content:space-between;margin-top:4px;'
      + `font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:${SKIN.faint}">`
      + `<span>none</span><span>${escapeHtml(info.unit)} ${buried}</span>`
      + '</div>';
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
    // The headline: whichever row the view nominated, or its first. It is then
    // left out of the list below, because a number printed twice in one card is
    // a card that has not decided what it is for.
    let heroAt = stats.findIndex((s) => s.hero === true);
    if (heroAt < 0) heroAt = 0;
    const hero = stats[heroAt];
    if (hero !== undefined) {
      this.heroValue.textContent = hero.value;
      this.heroValue.style.color = hero.warn ? SKIN.bad : SKIN.bright;
      this.heroLabel.textContent = hero.label.toLowerCase();
    }
    const rest = stats.filter((_, i) => i !== heroAt);

    while (this.shown < rest.length) {
      this.rows.appendChild(this.row());
      this.shown++;
    }
    while (this.shown > rest.length) {
      this.rows.lastElementChild?.remove();
      this.shown--;
    }
    const children = this.rows.children;
    const accent = this.accent;
    for (let i = 0; i < rest.length; i++) {
      const s = rest[i];
      const el = children[i] as HTMLElement;
      const label = el.firstElementChild as HTMLElement;
      const value = label.nextElementSibling as HTMLElement;
      const track = el.lastElementChild as HTMLElement;
      if (label.textContent !== s.label) label.textContent = s.label;
      if (value.textContent !== s.value) value.textContent = s.value;
      value.style.color = s.warn ? SKIN.bad : SKIN.bright;
      if (s.bar < 0) {
        track.style.display = 'none';
      } else {
        track.style.display = 'block';
        const fill = track.firstElementChild as HTMLElement;
        fill.style.width = `${Math.round(Math.max(0, Math.min(1, s.bar)) * 100)}%`;
        // The view's own colour, so a card's bars belong to the map it is about
        // -- and red only where the figure is bad news, which is the one thing a
        // bar has to be able to say without being read.
        fill.style.background = s.warn ? SKIN.bad : accent;
      }
    }
  }

  /** The open view's colour, for its bars. */
  private accent: string = SKIN.accent;

  private row(): HTMLElement {
    const el = document.createElement('div');
    el.dataset.stat = '';
    style(el, ['display:grid', 'grid-template-columns:1fr auto',
      'grid-template-areas:"l v" "t t"', 'column-gap:10px',
      'align-items:baseline', 'padding:1px 0']);
    const label = document.createElement('span');
    style(label, ['grid-area:l', `color:${SKIN.dim}`, 'overflow:hidden',
      'text-overflow:ellipsis', 'white-space:nowrap', 'font-size:10.5px']);
    const value = document.createElement('span');
    style(value, ['grid-area:v', `color:${SKIN.bright}`, 'font-size:10.5px',
      'font-variant-numeric:tabular-nums']);
    const track = document.createElement('div');
    track.dataset.bar = '';
    style(track, ['grid-area:t', 'height:2px', 'margin:2px 0 4px',
      'border-radius:2px', `background:${SKIN.track}`, 'display:none',
      'overflow:hidden']);
    const fill = document.createElement('div');
    style(fill, ['height:100%', 'border-radius:2px', 'width:0%',
      `background:${SKIN.accent}`,
      'transition:width .3s cubic-bezier(.2,.7,.3,1)']);
    track.appendChild(fill);
    el.append(label, value, track);
    return el;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => (
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'));
}
