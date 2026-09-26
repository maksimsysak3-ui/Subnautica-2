/**
 * The tax rates, as four things a player can drag.
 *
 * Mounted under the budget view's rows, because that is the only place setting
 * one makes sense: the number moves and the bill above it moves with it, in the
 * same card, while the pointer is still down. A tax control on a separate screen
 * is a tax control nobody touches twice.
 *
 * WHY SLIDERS AND NOT A FIELD. A rate is not a value somebody knows in advance;
 * it is a value they find by pushing it until something gives. The interesting
 * moment is the one where income stops rising because people have started
 * leaving, and a slider is the only control that lets a player feel where that
 * is. The neutral rate is marked on every track, so "how greedy am I being" is
 * answered without reading a number at all.
 *
 * FOUR, IN THE ZONES' OWN COLOURS, matching the demand bars and the buttons on
 * the toolbar -- the same green, blue, gold and violet the player has already
 * learned somewhere else.
 */

import { Tax, TAX_NAMES, TAX_MIN, TAX_MAX, TAX_NEUTRAL } from '../sim';
import type { Budget } from '../sim';
import { ZONE_STYLE, BRANCH_STYLE } from './zones';
import { BRANCHES } from '../assets/types';
import { FUNDING_MIN, FUNDING_MAX } from '../sim/budget';
import { SKIN } from './skin';

/** Which zone palette each rate takes. `TAX_NAMES` order. */
const PALETTE = ['residential', 'commercial', 'industrial', 'office'] as const;
const SHORT = ['Residential', 'Commercial', 'Industrial', 'Office'] as const;

/** Steps the slider moves in, as a percentage point. */
const STEP = 0.005;

function style(el: HTMLElement, decls: string[]): void {
  el.style.cssText = decls.join(';');
}

export class TaxPanel {
  readonly root: HTMLElement;
  private readonly sliders: HTMLInputElement[] = [];
  private readonly values: HTMLElement[] = [];
  private readonly fundSliders: HTMLInputElement[] = [];
  private readonly fundValues: HTMLElement[] = [];
  private budget: Budget | null = null;
  private shownVersion = -1;

  constructor() {
    this.root = document.createElement('div');
    this.root.dataset.panel = 'tax';
    this.root.dataset.show = 'flex';
    style(this.root, ['display:flex', 'flex-direction:column', 'gap:6px']);

    this.root.className = 'mr-tax';
    const head = document.createElement('div');
    head.className = 'mr-sec-head';
    head.textContent = 'Tax rates';
    this.root.appendChild(head);

    // Where the neutral rate sits on every track, as a fraction of its width.
    const neutral = ((TAX_NEUTRAL - TAX_MIN) / (TAX_MAX - TAX_MIN)) * 100;
    for (let i = 0; i < TAX_NAMES.length; i++) {
      const row = document.createElement('div');
      row.dataset.tax = TAX_NAMES[i];
      row.className = 'mr-tax-row';
      row.style.setProperty('--zone', ZONE_STYLE[PALETTE[i]].base);
      row.style.setProperty('--zone-ink', ZONE_STYLE[PALETTE[i]].light);
      row.style.setProperty('--neutral', `${neutral.toFixed(1)}%`);

      const label = document.createElement('span');
      label.className = 'mr-tax-name';
      label.textContent = SHORT[i];

      // A native range input, deliberately. It already does keyboard, touch,
      // pointer capture and drag-outside-the-track, all of which a hand-rolled
      // one gets wrong, and none of which is the interesting part of this.
      const track = document.createElement('span');
      track.className = 'mr-tax-track';
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'mr-range';
      slider.min = String(TAX_MIN);
      slider.max = String(TAX_MAX);
      slider.step = String(STEP);
      slider.setAttribute('aria-label', `${SHORT[i]} tax rate`);
      slider.addEventListener('input', () => {
        this.budget?.setRate(i, Number(slider.value));
        this.paint();
      });
      track.appendChild(slider);

      const value = document.createElement('span');
      value.dataset.stat = `tax-${TAX_NAMES[i]}`;
      value.className = 'mr-tax-val';

      row.append(label, track, value);
      this.root.appendChild(row);
      this.sliders.push(slider);
      this.values.push(value);
    }

    const note = document.createElement('div');
    note.className = 'mr-note-small';
    note.textContent = `The tick on each track is ${Math.round(TAX_NEUTRAL * 100)}%, what people `
      + 'expect. Above it they grumble, then leave; below it the city is poorer. Industry '
      + 'pays the most per job, and nobody who lives here pays it.';
    this.root.appendChild(note);

    // Service budgets: how well each branch is funded. Cut one to save money
    // and it covers less, fields fewer vehicles, makes less; fund one above
    // the line and it reaches further for more than it saves you elsewhere.
    const fhead = document.createElement('div');
    fhead.className = 'mr-sec-head';
    fhead.textContent = 'Service budgets';
    fhead.style.marginTop = '10px';
    this.root.appendChild(fhead);
    const mid = ((1 - FUNDING_MIN) / (FUNDING_MAX - FUNDING_MIN)) * 100;
    BRANCHES.forEach((branch, i) => {
      const pal = BRANCH_STYLE[branch];
      const row = document.createElement('div');
      row.dataset.fund = branch;
      row.className = 'mr-tax-row';
      row.style.setProperty('--zone', pal.base);
      row.style.setProperty('--zone-ink', pal.light);
      row.style.setProperty('--neutral', `${mid.toFixed(1)}%`);
      const label = document.createElement('span');
      label.className = 'mr-tax-name';
      // The palette's water label names the whole piped network; here sewage
      // has its own row, so it is just water.
      label.textContent = branch === 'water' ? 'Water' : pal.label;
      const track = document.createElement('span');
      track.className = 'mr-tax-track';
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'mr-range';
      slider.min = String(FUNDING_MIN);
      slider.max = String(FUNDING_MAX);
      slider.step = '0.05';
      slider.setAttribute('aria-label', `${pal.label} budget`);
      slider.addEventListener('input', () => {
        this.budget?.setFunding(i, Number(slider.value));
        this.paint();
      });
      track.appendChild(slider);
      const value = document.createElement('span');
      value.className = 'mr-tax-val';
      row.append(label, track, value);
      this.root.appendChild(row);
      this.fundSliders.push(slider);
      this.fundValues.push(value);
    });
    const fnote = document.createElement('div');
    fnote.className = 'mr-note-small';
    fnote.textContent = 'Running costs follow the budget. Coverage, crews and output follow it too, '
      + 'but less than one for one: a cut saves money and costs service.';
    this.root.appendChild(fnote);
  }

  /** Points at the city's treasury. Called whenever the world is replaced. */
  bind(budget: Budget | null): void {
    this.budget = budget;
    this.shownVersion = -1;
    this.refresh();
  }

  /** Pulls the sliders back into line with the budget, if it moved elsewhere. */
  refresh(): void {
    const b = this.budget;
    if (b === null) return;
    if (b.version === this.shownVersion) return;
    this.shownVersion = b.version;
    for (let i = 0; i < this.sliders.length; i++) {
      this.sliders[i].value = String(b.rates[i]);
    }
    for (let i = 0; i < this.fundSliders.length; i++) {
      this.fundSliders[i].value = String(b.funding[i]);
    }
    this.paint();
  }

  /** The numbers beside the sliders, and how alarming each one is. */
  private paint(): void {
    const b = this.budget;
    if (b === null) return;
    for (let i = 0; i < this.fundValues.length; i++) {
      const f = b.funding[i];
      this.fundValues[i].textContent = `${Math.round(f * 100)}%`;
      this.fundValues[i].style.color = f < 0.75 ? SKIN.bad : f < 0.95 ? SKIN.warn : SKIN.text;
    }
    for (let i = 0; i < this.values.length; i++) {
      const rate = b.rates[i];
      this.values[i].textContent = `${(rate * 100).toFixed(1)}%`;
      // Red once a rate is well over what people expect. The industrial and
      // office rates are judged more gently because nobody who lives here pays
      // them -- which is exactly the loophole the game wants a player to find.
      const felt = i === Tax.RESIDENTIAL || i === Tax.COMMERCIAL ? 1 : 0.6;
      const over = ((rate - TAX_NEUTRAL) / TAX_NEUTRAL) * felt;
      this.values[i].style.color = over > 0.75 ? SKIN.bad
        : over > 0.25 ? SKIN.warn : SKIN.text;
      // An elected mandate can hold a rate down for a term; say so where the
      // slider stops moving, or it reads as a broken slider.
      const capped = b.ceiling[i] < TAX_MAX - 1e-9;
      this.sliders[i].title = capped
        ? `Held at ${(b.ceiling[i] * 100).toFixed(0)}% or below by the mayor's mandate` : '';
      if (capped) {
        this.values[i].textContent += ' \u2022';
        this.values[i].style.color = SKIN.warn;
      }
    }
  }
}
