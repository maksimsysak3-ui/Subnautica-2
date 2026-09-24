/**
 * The card for one building.
 *
 * A city builder is a game about cause and effect, and until this existed the
 * game could show both halves and never join them: a map of where power was
 * short, a bubble over an unhappy roof, and no way at all to point at a
 * building and ask what it is, who is in it and why it has stopped. The
 * simulation knew all of it; nothing asked.
 *
 * So: click a building with no tool in hand and this opens on it. Everything on
 * it is read from the tables at the moment it opens -- occupancy, the three
 * utilities and whether a main even reaches, days of rubbish standing outside,
 * the five services it is covered by, and the building's own worst complaint
 * with the fix underneath it. Escape closes it, and so does clicking away.
 */

import type { Inspection } from '../sim';
import { SKIN, css, panel, label, bar, rule } from './skin';
import { ZONE_STYLE } from './zones';

/** Shares below this read as a failure rather than as a thin margin. */
const POOR = 0.5;

export class Inspect {
  readonly root: HTMLElement;
  private head!: HTMLElement;
  private body!: HTMLElement;
  private shown: Inspection | null = null;

  constructor(parent: HTMLElement, private onClose: () => void) {
    this.root = document.createElement('div');
    this.root.dataset.panel = 'inspect';
    css(this.root, [...panel(), 'position:absolute', 'left:12px', 'top:12px',
      'width:286px', 'padding:0', 'overflow:hidden', 'display:none',
      'pointer-events:auto', 'z-index:12']);

    this.head = document.createElement('div');
    css(this.head, ['display:flex', 'align-items:flex-start', 'gap:9px',
      'padding:11px 12px 10px', `border-bottom:1px solid ${SKIN.edge}`]);

    this.body = document.createElement('div');
    css(this.body, ['display:flex', 'flex-direction:column', 'gap:9px',
      'padding:11px 12px 12px']);

    this.root.append(this.head, this.body);
    parent.appendChild(this.root);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.shown !== null) this.close();
    });
  }

  get open(): boolean { return this.shown !== null; }
  /** Which building is being shown, or -1. */
  get place(): number { return this.shown?.place ?? -1; }

  close(): void {
    this.shown = null;
    this.root.style.display = 'none';
    this.reserve();
    this.onClose();
  }

  /**
   * Tells the rest of the left-hand column how much room this card is taking.
   *
   * Both this and the information card are anchored to the top left corner, so
   * a player who clicked a building while a view was open had them on top of
   * one another. Rather than move one of them somewhere it does not belong, the
   * card that sits over the other publishes its height and the column
   * underneath starts below it. Measured from the layout rather than assumed,
   * because this card's height is whatever the building had to say.
   */
  private reserve(): void {
    const px = this.root.style.display === 'none' ? 0 : this.root.offsetHeight + 8;
    this.root.parentElement?.style.setProperty('--hud-detail', `${12 + px}px`);
  }

  show(what: Inspection): void {
    this.shown = what;
    this.root.style.display = 'block';
    const accent = (ZONE_STYLE as Record<string, { base: string; light: string }>)[what.zone]
      ?.light ?? SKIN.accent;

    // ---- the head: what it is ------------------------------------------
    this.head.innerHTML = '';
    const swatch = document.createElement('div');
    css(swatch, ['width:4px', 'height:30px', `background:${accent}`,
      'border-radius:2px', `box-shadow:0 0 12px ${accent}66`, 'flex:none',
      'margin-top:2px']);
    const titles = document.createElement('div');
    css(titles, ['display:flex', 'flex-direction:column', 'gap:3px', 'flex:1',
      'min-width:0']);
    const name = document.createElement('div');
    css(name, [`color:${SKIN.bright}`, 'font-size:13px', 'line-height:1.25']);
    name.textContent = what.name;
    const kind = document.createElement('div');
    css(kind, [...label(), 'font-size:10.5px']);
    kind.textContent = what.branch !== undefined
      ? `${what.branch} service`
      : `${what.density} ${what.zone}`;
    titles.append(name, kind);

    const shut = document.createElement('button');
    css(shut, ['width:22px', 'height:22px', 'flex:none', 'padding:0',
      'border:1px solid transparent', `border-radius:${SKIN.radiusSmall}`,
      'background:transparent', `color:${SKIN.dim}`, 'cursor:pointer',
      `font:12px/1 ${SKIN.mono}`]);
    shut.textContent = '×';
    shut.setAttribute('aria-label', 'Close');
    shut.addEventListener('pointerenter', () => { shut.style.color = SKIN.bright; });
    shut.addEventListener('pointerleave', () => { shut.style.color = SKIN.dim; });
    shut.addEventListener('click', () => this.close());
    this.head.append(swatch, titles, shut);

    // ---- the body: how it is doing --------------------------------------
    this.body.innerHTML = '';
    if (what.homes > 0) {
      this.body.appendChild(this.meter('Residents', what.residents, what.homes * 2,
        accent, `${what.residents} in ${what.homes} homes`));
    }
    if (what.jobs > 0) {
      this.body.appendChild(this.meter(
        what.branch !== undefined ? 'Crew' : 'Jobs filled',
        what.workers, what.jobs, accent, `${what.workers} of ${what.jobs}`));
    }

    this.body.appendChild(rule());

    // The utilities, as three rows that say which of the two possible failures
    // this is: no main in the street, or a main with nothing in it.
    const utils: Array<[string, number, boolean]> = [
      ['Power', what.power, what.onMain[0]],
      ['Water', what.water, what.onMain[1]],
      ['Sewage', what.sewage, what.onMain[2]],
    ];
    for (const [nameOf, share, onMain] of utils) {
      this.body.appendChild(this.row(nameOf,
        !onMain ? 'no main' : share >= 0.999 ? 'supplied'
          : `${Math.round(share * 100)}%`,
        !onMain ? SKIN.bad : share < POOR ? SKIN.bad
          : share < 0.999 ? SKIN.warn : SKIN.good));
    }
    if (what.rubbish > 0.5) {
      this.body.appendChild(this.row('Rubbish',
        `${what.rubbish.toFixed(1)} days`,
        what.rubbish > 3 ? SKIN.bad : SKIN.warn));
    }

    // The ground it stands on, and how the building itself is bearing up. These
    // are the two readings that say whether this plot has a future: condition
    // is what decides whether it is condemned, and land value is what decides
    // what replaces it if the street keeps improving.
    this.body.appendChild(rule());
    this.body.appendChild(this.meter('Condition', Math.round(what.condition * 100), 100,
      what.condition < 0.28 ? SKIN.bad : what.condition < 0.55 ? SKIN.warn : SKIN.good,
      what.condition < 0.28 ? 'failing'
        : what.condition < 0.55 ? 'wearing' : 'sound'));
    this.body.appendChild(this.row('Land value',
      `${Math.round(what.landValue * 100)}%`,
      what.landValue < 0.3 ? SKIN.bad : what.landValue < 0.55 ? SKIN.warn : SKIN.good));
    if (what.pollution > 0.06) {
      this.body.appendChild(this.row('Air',
        `${Math.round(what.pollution * 100)}% polluted`,
        what.pollution > 0.4 ? SKIN.bad : SKIN.warn));
    }
    if (what.noise > 0.25) {
      this.body.appendChild(this.row('Noise',
        `${Math.round(what.noise * 100)}%`,
        what.noise > 0.6 ? SKIN.bad : SKIN.warn));
    }

    if (what.cover.length > 0) {
      this.body.appendChild(rule());
      const grid = document.createElement('div');
      css(grid, ['display:grid', 'grid-template-columns:repeat(5, 1fr)',
        'gap:6px']);
      for (const c of what.cover) {
        const cell = document.createElement('div');
        css(cell, ['display:flex', 'flex-direction:column', 'gap:4px',
          'align-items:center']);
        const dot = document.createElement('div');
        const tone = c.share <= 0.001 ? SKIN.bad
          : c.share < POOR ? SKIN.warn : SKIN.good;
        css(dot, ['width:100%', 'height:3px', `background:${tone}`,
          'border-radius:3px', `opacity:${0.35 + 0.65 * Math.min(1, c.share)}`]);
        const cap = document.createElement('div');
        css(cap, [...label(), 'font-size:7.5px', 'letter-spacing:.08em']);
        cap.textContent = c.name.slice(0, 4);
        cell.append(dot, cap);
        grid.appendChild(cell);
      }
      this.body.appendChild(grid);
    }

    // And the complaint, last, because it is the thing to act on and the last
    // thing on a card is the thing a reader leaves with.
    if (what.gripe !== '') {
      const note = document.createElement('div');
      css(note, ['display:flex', 'flex-direction:column', 'gap:4px',
        'padding:8px 9px', `border-radius:${SKIN.radiusSmall}`,
        'background:rgba(224,104,90,.09)',
        'border:1px solid rgba(224,104,90,.22)']);
      const t = document.createElement('div');
      css(t, [...label(), `color:${SKIN.bad}`, 'font-size:10.5px']);
      t.textContent = what.gripe;
      const w = document.createElement('div');
      css(w, [`color:${SKIN.text}`, 'font-size:12px', 'line-height:1.45']);
      w.textContent = what.gripeWhat;
      const f = document.createElement('div');
      css(f, [`color:${SKIN.dim}`, 'font-size:12px', 'line-height:1.45']);
      f.textContent = what.gripeFix;
      note.append(t, w, f);
      this.body.appendChild(note);
    }
    this.reserve();
  }

  /** A label, a value, and a bar under both. */
  private meter(name: string, got: number, of: number, colour: string,
    text: string): HTMLElement {
    const wrap = document.createElement('div');
    css(wrap, ['display:flex', 'flex-direction:column', 'gap:5px']);
    const top = document.createElement('div');
    css(top, ['display:flex', 'align-items:baseline', 'gap:8px']);
    const l = document.createElement('div');
    css(l, [...label(), 'font-size:10.5px']);
    l.textContent = name;
    const v = document.createElement('div');
    css(v, [`color:${SKIN.bright}`, 'font-size:11px', 'margin-left:auto',
      'font-variant-numeric:tabular-nums']);
    v.textContent = text;
    top.append(l, v);
    const { track, fill } = bar(colour, 3);
    fill.style.width = `${Math.round(100 * Math.min(1, of > 0 ? got / of : 0))}%`;
    wrap.append(top, track);
    return wrap;
  }

  /** A label on the left, a coloured reading on the right. */
  private row(name: string, text: string, tone: string): HTMLElement {
    const el = document.createElement('div');
    css(el, ['display:flex', 'align-items:baseline', 'gap:8px']);
    const l = document.createElement('div');
    css(l, [`color:${SKIN.text}`, 'font-size:11px']);
    l.textContent = name;
    const v = document.createElement('div');
    css(v, [`color:${tone}`, 'font-size:11px', 'margin-left:auto',
      'font-variant-numeric:tabular-nums']);
    v.textContent = text;
    el.append(l, v);
    return el;
  }
}
