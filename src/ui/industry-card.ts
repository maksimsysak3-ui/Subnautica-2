/**
 * The industry headquarters' section of the building card.
 *
 * What the area makes, what it earns and where it goes, with the one lever that
 * matters: how much is shipped out for money now and how much supplies the
 * city's own works. And a way back to the map, because the answer to "it is not
 * making much" is usually "draw the area somewhere richer".
 */

import type { Industry } from '../sim/industry';
import { PRICE, LOCAL_PRICE, cellHectares } from '../sim/industry';
import { resourceById } from '../sim/resources';
import { money } from '../sim';
import { glyph } from './glyphs';

export class IndustryCard {
  readonly root: HTMLElement;
  private readonly figure: HTMLElement;
  private readonly rows: HTMLElement;
  private readonly slider: HTMLInputElement;
  private readonly split: HTMLElement;
  private readonly icon: HTMLElement;
  private readonly what: HTMLElement;
  private readonly redraw: HTMLElement;
  private shownFor = -1;

  constructor(private industry: () => Industry, private onRedraw: (hq: number) => void) {
    const el = (tag: string, cls: string, text = ''): HTMLElement => {
      const e = document.createElement(tag);
      e.className = cls;
      if (text !== '') e.textContent = text;
      return e;
    };
    this.root = el('div', 'mr-ind');
    const head = el('div', 'mr-ind-head');
    this.icon = el('span', 'mr-ind-ico');
    this.what = el('span', 'mr-ind-what');
    head.append(this.icon, this.what);
    this.figure = el('div', 'mr-ind-figure');
    this.rows = el('div', 'mr-ind-rows');
    const split = el('label', 'mr-ind-split');
    this.slider = document.createElement('input');
    this.slider.type = 'range';
    this.slider.min = '0'; this.slider.max = '100'; this.slider.step = '5';
    this.slider.setAttribute('aria-label', 'Share shipped out versus supplied to the city');
    split.append(el('span', 'mr-ind-split-l', 'Ship out'), this.slider, el('span', 'mr-ind-split-r', 'Supply the city'));
    this.split = el('div', 'mr-ind-splitsay');
    this.redraw = el('button', 'mr-ind-redraw');
    this.root.append(head, this.figure, this.rows, split, this.split, this.redraw);
    this.slider.addEventListener('input', () => {
      if (this.shownFor < 0) return;
      this.industry().setExport(this.shownFor, 1 - Number(this.slider.value) / 100);
      this.paint();
    });
    this.redraw.addEventListener('click', () => { if (this.shownFor >= 0) this.onRedraw(this.shownFor); });
  }

  /** Shows headquarters `hq`. */
  show(hq: number): void {
    this.shownFor = hq;
    const h = this.industry().hqs[hq];
    if (h === undefined) return;
    const r = resourceById(h.kind);
    this.root.style.setProperty('--tone', r.ramp[2]);
    this.icon.innerHTML = glyph(r.icon, 18);
    this.what.textContent = `${r.product} · ${r.name}`;
    this.slider.value = String(Math.round((1 - h.exportShare) * 100));
    this.redraw.textContent =
      h.area.length === 0 ? 'Draw the harvest area' : 'Redraw the harvest area';
    this.paint();
  }

  /** Repaints the figures, for a card that stays open while the weeks go by. */
  paint(): void {
    const ind = this.industry();
    const h = ind.hqs[this.shownFor];
    if (h === undefined) return;
    const rep = ind.reports[this.shownFor];
    const r = resourceById(h.kind);
    const row = (label: string, value: string, warn = false): HTMLElement => {
      const d = document.createElement('div');
      d.className = warn ? 'mr-ind-row is-warn' : 'mr-ind-row';
      const l = document.createElement('span');
      l.textContent = label;
      const v = document.createElement('b');
      v.textContent = value;
      d.append(l, v);
      return d;
    };
    const figure = (big: string, small: string): void => {
      const b = document.createElement('b');
      b.textContent = big;
      const sm = document.createElement('span');
      sm.textContent = small;
      this.figure.replaceChildren(b, sm);
    };
    if (h.area.length === 0) {
      figure('—', 'No harvest area yet');
      this.rows.replaceChildren(row('Next', 'draw the area this headquarters works'));
    } else if (rep === undefined) {
      figure('—', 'Starting up');
      this.rows.replaceChildren();
    } else {
      figure(money(Math.round(rep.income)), 'a week');
      const finite = r.renewable ? 'Stock' : 'Left in the ground';
      this.rows.replaceChildren(
        row(`${r.product} a week`, Math.round(rep.units).toLocaleString()),
        row('Shipped out', `${Math.round(rep.shipped).toLocaleString()} at ${money(PRICE[h.kind])}`),
        row('To the city', `${Math.round(rep.local).toLocaleString()} at ${money(Math.round(PRICE[h.kind] * LOCAL_PRICE))}`),
        row('Staffed', `${Math.round(rep.staffing * 100)}%`, rep.staffing < 0.5),
        row('Area', `${(rep.cells * cellHectares()).toFixed(1)} ha`),
        row(finite, `${Math.round(rep.remaining * 100)}%`, rep.remaining < 0.25),
      );
    }
    const ship = Math.round(h.exportShare * 100);
    this.split.textContent = ship === 100 ? 'Everything is shipped out: full price, nothing for local industry.'
      : ship === 0 ? 'Everything supplies the city: cheaper, but it feeds the works and cuts imports.'
        : `${ship}% shipped out, ${100 - ship}% to the city's own works.`;
  }
}
