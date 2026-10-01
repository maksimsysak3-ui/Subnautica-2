/**
 * The welcome: a short, skippable walk through what a new mayor needs to know
 * before the first road goes down.
 *
 * The first-steps card says *what* to build next and ticks it off; it cannot
 * say *why*, and the why is what a city builder is. A town that starts in the
 * red is not broken, a demand bar is the city asking for something, a red
 * street in a view is a thing to build. Seven cards, read once, then the
 * checklist takes over. Shown on a player's first new city and on demand
 * (`open`), and remembered in the browser so it does not nag.
 */

import { css } from './skin';

interface Page { title: string; body: string; tip: string }

const PAGES: readonly Page[] = [
  {
    title: 'Welcome, Mayor',
    body: 'You have a patch of land, a treasury and a road connection to the outside world. '
      + 'Everything else is up to you. A city grows when people want to live, work and shop here '
      + '-- and it stalls, or shrinks, when they do not.',
    tip: 'Drag to pan, right-drag to orbit, scroll to zoom. Press ? any time for every key.',
  },
  {
    title: 'Start small',
    body: 'Lay a few small two-lane streets off the highway connection. Roads cost money to build '
      + 'and money every week to keep, so a big grid on day one is a bill with nobody to pay it. '
      + 'Grow the network as the city needs it.',
    tip: 'Roads are on the toolbar. Hold Shift for a straight line; drag out a grid in one go.',
  },
  {
    title: 'Zone, then wait',
    body: 'Zoning marks land for residential, commercial, industrial or office buildings; '
      + 'people build on it themselves. Watch the demand bars bottom right: a long bar is the '
      + 'city asking for that zone. Houses first, then shops and work for the people in them.',
    tip: 'Residential (green) needs jobs nearby; industry (yellow) pays the most tax but pollutes.',
  },
  {
    title: 'Power, water, sewage',
    body: 'No building lasts without electricity, fresh water and drainage. Put a wind turbine or '
      + 'small plant down, a water pump on the river bank, and a treatment works downstream of the '
      + 'pump -- never upstream of it. The mains follow your roads.',
    tip: 'The Power, Water and Sewage views show exactly which streets are not reached.',
  },
  {
    title: 'Money is tight at first',
    body: 'Expect the treasury to fall for the first few weeks: services and roads cost money from '
      + 'day one, but a small town pays little tax. That is normal. It turns round as the city '
      + 'fills in. Keep services to what the town needs, and do not build ahead of demand.',
    tip: 'The Budget view shows every line. Taxes a notch higher help -- too high and people leave. A loan is there if you need one.',
  },
  {
    title: 'Read the city',
    body: 'Information views colour the map by one question: traffic, land value, crime, '
      + 'unemployment, education and more. Red is the problem; the card beside it says what to '
      + 'build. Click any building to see what it needs.',
    tip: 'Press V or the chart button bottom left to open the views.',
  },
  {
    title: 'Grow and unlock',
    body: 'Building and new residents earn experience. Each level pays a little cash and stars to '
      + 'unlock services in the development tree -- fire, health, schools, transit and more. '
      + 'Pick what your city is short of; you will not unlock everything quickly.',
    tip: 'Press T or click the level ring to open the tree. The First steps card will guide you from here.',
  },
];

const SEEN_KEY = 'civitas.tutorial.seen';

export class Tutorial {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly body: HTMLElement;
  private readonly tip: HTMLElement;
  private readonly dots: HTMLElement;
  private readonly back: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private page = 0;
  /** Called when the welcome closes, finished or skipped. */
  onClose: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'mr-tut';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'How to play');

    const card = document.createElement('div');
    card.className = 'mr-tut-card';
    const kicker = document.createElement('div');
    kicker.className = 'mr-tut-kicker';
    kicker.textContent = 'How to play';
    this.title = document.createElement('h2');
    this.title.className = 'mr-tut-title';
    this.body = document.createElement('p');
    this.body.className = 'mr-tut-body';
    this.tip = document.createElement('p');
    this.tip.className = 'mr-tut-tip';
    this.dots = document.createElement('div');
    this.dots.className = 'mr-tut-dots';
    for (let i = 0; i < PAGES.length; i++) {
      const d = document.createElement('i');
      d.addEventListener('click', () => this.go(i));
      this.dots.appendChild(d);
    }

    const row = document.createElement('div');
    row.className = 'mr-tut-row';
    const skip = document.createElement('button');
    skip.className = 'mr-tut-skip';
    skip.textContent = 'Skip';
    skip.addEventListener('click', () => this.close());
    this.back = document.createElement('button');
    this.back.className = 'mr-tut-btn';
    this.back.textContent = 'Back';
    this.back.addEventListener('click', () => this.go(this.page - 1));
    this.next = document.createElement('button');
    this.next.className = 'mr-tut-btn is-primary';
    this.next.addEventListener('click', () => {
      if (this.page >= PAGES.length - 1) this.close(); else this.go(this.page + 1);
    });
    const spacer = document.createElement('span');
    css(spacer, ['flex:1']);
    row.append(skip, spacer, this.back, this.next);

    card.append(kicker, this.title, this.body, this.tip, this.dots, row);
    this.root.appendChild(card);
    parent.appendChild(this.root);

    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); this.close(); }
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.stopPropagation(); this.next.click(); }
      if (e.key === 'ArrowLeft') { e.stopPropagation(); if (this.page > 0) this.go(this.page - 1); }
    });
  }

  get isOpen(): boolean { return !this.root.hidden; }

  /** Whether this player has been through the welcome before. */
  static seen(): boolean {
    try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
  }

  /** Opens at the first card. */
  open(): void {
    this.root.hidden = false;
    this.go(0);
    this.next.focus();
  }

  /** Opens only if this player has never seen it. */
  openFirstTime(): void {
    if (!Tutorial.seen()) this.open();
  }

  close(): void {
    if (this.root.hidden) return;
    this.root.hidden = true;
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* private window: shown again next time */ }
    this.onClose?.();
  }

  private go(i: number): void {
    this.page = Math.max(0, Math.min(PAGES.length - 1, i));
    const p = PAGES[this.page];
    this.title.textContent = p.title;
    this.body.textContent = p.body;
    this.tip.textContent = p.tip;
    this.back.hidden = this.page === 0;
    this.next.textContent = this.page === PAGES.length - 1 ? 'Start building' : 'Next';
    [...this.dots.children].forEach((d, k) => d.classList.toggle('is-on', k === this.page));
  }
}
