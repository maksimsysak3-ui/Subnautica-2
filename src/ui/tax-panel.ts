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
import { ZONE_STYLE } from './zones';
import { SKIN, label as labelStyle } from './skin';

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
  private budget: Budget | null = null;
  private shownVersion = -1;

  constructor() {
    this.root = document.createElement('div');
    this.root.dataset.panel = 'tax';
    this.root.dataset.show = 'flex';
    style(this.root, ['display:flex', 'flex-direction:column', 'gap:6px']);

    const head = document.createElement('div');
    style(head, labelStyle());
    head.textContent = 'Tax rates';
    this.root.appendChild(head);

    for (let i = 0; i < TAX_NAMES.length; i++) {
      const row = document.createElement('div');
      row.dataset.tax = TAX_NAMES[i];
      style(row, ['display:flex', 'align-items:center', 'gap:6px']);

      const chip = document.createElement('span');
      style(chip, ['width:5px', 'height:5px', 'border-radius:1px', 'flex:0 0 auto',
        `background:${ZONE_STYLE[PALETTE[i]].base}`]);

      const label = document.createElement('span');
      style(label, ['font-size:10px', 'width:66px', 'flex:0 0 auto',
        `color:${ZONE_STYLE[PALETTE[i]].light}`]);
      label.textContent = SHORT[i];

      // A native range input, deliberately. It already does keyboard, touch,
      // pointer capture and drag-outside-the-track, all of which a hand-rolled
      // one gets wrong, and none of which is the interesting part of this.
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = String(TAX_MIN);
      slider.max = String(TAX_MAX);
      slider.step = String(STEP);
      slider.setAttribute('aria-label', `${SHORT[i]} tax rate`);
      style(slider, ['flex:1 1 auto', 'min-width:80px', 'height:14px',
        'pointer-events:auto', 'cursor:pointer',
        `accent-color:${ZONE_STYLE[PALETTE[i]].base}`]);
      slider.addEventListener('input', () => {
        this.budget?.setRate(i, Number(slider.value));
        this.paint();
      });

      const value = document.createElement('span');
      value.dataset.stat = `tax-${TAX_NAMES[i]}`;
      style(value, ['font-size:10px', 'width:34px', 'text-align:right',
        'flex:0 0 auto', 'font-variant-numeric:tabular-nums']);

      row.append(chip, label, slider, value);
      this.root.appendChild(row);
      this.sliders.push(slider);
      this.values.push(value);
    }

    const note = document.createElement('div');
    style(note, ['font-size:9.5px', `color:${SKIN.faint}`, 'line-height:1.5']);
    note.textContent = `${Math.round(TAX_NEUTRAL * 100)}% is what people expect. `
      + 'Above it they grumble, and then they leave. Below it you are poor.';
    this.root.appendChild(note);
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
    this.paint();
  }

  /** The numbers beside the sliders, and how alarming each one is. */
  private paint(): void {
    const b = this.budget;
    if (b === null) return;
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
    }
  }
}
