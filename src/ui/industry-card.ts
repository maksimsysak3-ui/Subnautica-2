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
  private shownFor = -1;

  constructor(private industry: () => Industry, private onRedraw: (hq: number) => void) {
    this.root = document.createElement('div');
    this.root.className = 'mr-ind';
    this.root.innerHTML = '<div class="mr-ind-head"><span class="mr-ind-ico"></span>'
      + '<span class="mr-ind-what"></span></div>'
      + '<div class="mr-ind-figure"></div><div class="mr-ind-rows"></div>'
      + '<label class="mr-ind-split"><span class="mr-ind-split-l">Ship out</span>'
      + '<input type="range" min="0" max="100" step="5"><span class="mr-ind-split-r">Supply the city</span></label>'
      + '<div class="mr-ind-splitsay"></div>'
      + '<button class="mr-ind-redraw"></button>';
    this.figure = this.root.querySelector('.mr-ind-figure') as HTMLElement;
    this.rows = this.root.querySelector('.mr-ind-rows') as HTMLElement;
    this.slider = this.root.querySelector('input') as HTMLInputElement;
    this.split = this.root.querySelector('.mr-ind-splitsay') as HTMLElement;
    this.slider.setAttribute('aria-label', 'Share shipped out versus supplied to the city');
    this.slider.addEventListener('input', () => {
      if (this.shownFor < 0) return;
      this.industry().setExport(this.shownFor, 1 - Number(this.slider.value) / 100);
      this.paint();
    });
    (this.root.querySelector('.mr-ind-redraw') as HTMLElement)
      .addEventListener('click', () => { if (this.shownFor >= 0) this.onRedraw(this.shownFor); });
  }

  /** Shows headquarters `hq`. */
  show(hq: number): void {
    this.shownFor = hq;
    const h = this.industry().hqs[hq];
    if (h === undefined) return;
    const r = resourceById(h.kind);
    this.root.style.setProperty('--tone', r.ramp[2]);
    (this.root.querySelector('.mr-ind-ico') as HTMLElement).innerHTML = glyph(r.icon, 18);
    (this.root.querySelector('.mr-ind-what') as HTMLElement).textContent = `${r.product} · ${r.name}`;
    this.slider.value = String(Math.round((1 - h.exportShare) * 100));
    (this.root.querySelector('.mr-ind-redraw') as HTMLElement).textContent =
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
    const row = (label: string, value: string, warn = false): string =>
      `<div class="mr-ind-row${warn ? ' is-warn' : ''}"><span>${label}</span><b>${value}</b></div>`;
    if (h.area.length === 0) {
      this.figure.innerHTML = '<b>—</b><span>No harvest area yet</span>';
      this.rows.innerHTML = row('Next', 'draw the area this headquarters works');
    } else if (rep === undefined) {
      this.figure.innerHTML = '<b>—</b><span>Starting up</span>';
      this.rows.innerHTML = '';
    } else {
      this.figure.innerHTML = `<b>${money(Math.round(rep.income))}</b><span>a week</span>`;
      const finite = r.renewable ? 'Stock' : 'Left in the ground';
      this.rows.innerHTML = row(`${r.product} a week`, Math.round(rep.units).toLocaleString())
        + row('Shipped out', `${Math.round(rep.shipped).toLocaleString()} at ${money(PRICE[h.kind])}`)
        + row('To the city', `${Math.round(rep.local).toLocaleString()} at ${money(Math.round(PRICE[h.kind] * LOCAL_PRICE))}`)
        + row('Staffed', `${Math.round(rep.staffing * 100)}%`, rep.staffing < 0.5)
        + row('Area', `${(rep.cells * cellHectares()).toFixed(1)} ha`)
        + row(finite, `${Math.round(rep.remaining * 100)}%`, rep.remaining < 0.25);
    }
    const ship = Math.round(h.exportShare * 100);
    this.split.textContent = ship === 100 ? 'Everything is shipped out: full price, nothing for local industry.'
      : ship === 0 ? 'Everything supplies the city: cheaper, but it feeds the works and cuts imports.'
        : `${ship}% shipped out, ${100 - ship}% to the city's own works.`;
  }
}
