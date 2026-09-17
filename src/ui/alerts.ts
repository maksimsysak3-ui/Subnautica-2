/**
 * What the city needs to tell the player, while they are looking elsewhere.
 *
 * A city builder's simulation runs whether or not anyone is watching that part
 * of the map, and most of what it decides is invisible: the power margin slips
 * under one and a district browns out, a trade fair pays for a week of
 * services, the treasury crosses into its overdraft. None of that is on screen
 * where the player's pointer is, and a game that only tells you through a
 * number in a panel you were not reading is a game that feels like it is
 * happening to you rather than because of you.
 *
 * So: a stack of cards in the top corner, each one a thing that just happened,
 * with its own colour for what kind of thing it was. They arrive one at a
 * time, they leave on their own, and clicking one dismisses it. There are never
 * more than four, because a wall of notices is the same as no notices.
 */

import { SKIN, css, panel, label } from './skin';

export type Tone = 'good' | 'warn' | 'bad' | 'info';

export interface Alert {
  /** The headline, in a couple of words. */
  title: string;
  /** The sentence under it. */
  body: string;
  tone?: Tone;
  /** A figure shown on the right, already formatted. */
  figure?: string;
  /**
   * Two alerts with the same tag replace each other rather than stacking.
   *
   * The power margin dipping is one event, however many times a tick notices
   * it, and a player who has been told their power is short does not need to be
   * told again eleven seconds later.
   */
  tag?: string;
}

const TONE: Record<Tone, string> = {
  good: SKIN.good, warn: SKIN.warn, bad: SKIN.bad, info: SKIN.accent,
};

/** How long a card stays before it leaves on its own, in milliseconds. */
const LIFE = 9000;
/** And the most that can be on screen at once. */
const MOST = 4;

interface Live { el: HTMLElement; tag: string; born: number }

export class Alerts {
  private readonly host: HTMLElement;
  private readonly live: Live[] = [];

  constructor(parent: HTMLElement) {
    this.host = document.createElement('div');
    this.host.dataset.panel = 'alerts';
    css(this.host, ['position:absolute', 'top:12px', 'right:12px', 'z-index:20',
      'display:flex', 'flex-direction:column', 'gap:7px', 'align-items:flex-end',
      'pointer-events:none', 'max-width:320px']);
    parent.appendChild(this.host);
  }

  set visible(on: boolean) { this.host.style.display = on ? 'flex' : 'none'; }

  /** How many cards are up. Tools read this; the game does not. */
  get count(): number { return this.live.length; }

  push(alert: Alert): void {
    const tone = TONE[alert.tone ?? 'info'];
    const tag = alert.tag ?? `${alert.title}|${alert.body}`;

    const already = this.live.findIndex((l) => l.tag === tag);
    if (already >= 0) {
      // Same subject: refresh the card in place and restart its clock, rather
      // than stacking a second copy of a thing that is still true.
      this.live[already].born = performance.now();
      this.fill(this.live[already].el, alert, tone);
      return;
    }

    const el = document.createElement('div');
    css(el, [...panel(), 'position:relative', 'display:flex', 'gap:9px',
      'padding:9px 11px 9px 12px', 'pointer-events:auto', 'cursor:pointer',
      'overflow:hidden', 'min-width:220px',
      'box-shadow:0 12px 28px rgba(0,0,0,.5)',
      // Arriving: the card slides in from the edge it belongs to.
      'transform:translateX(14px)', 'opacity:0',
      'transition:transform .22s cubic-bezier(.2,.8,.3,1), opacity .22s']);
    this.fill(el, alert, tone);
    el.addEventListener('click', () => this.drop(el));
    this.host.appendChild(el);
    // One frame later, so the transition has a state to move from.
    requestAnimationFrame(() => {
      el.style.transform = 'translateX(0)';
      el.style.opacity = '1';
    });

    this.live.push({ el, tag, born: performance.now() });
    while (this.live.length > MOST) this.drop(this.live[0].el);
  }

  /** Retires anything that has been up long enough. Called from the frame. */
  update(now: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      if (now - this.live[i].born > LIFE) this.drop(this.live[i].el);
    }
  }

  clear(): void {
    for (let i = this.live.length - 1; i >= 0; i--) this.drop(this.live[i].el);
  }

  private fill(el: HTMLElement, alert: Alert, tone: string): void {
    el.innerHTML = '';
    // The stripe down the left edge is the whole colour code: the card stays
    // the same dark slab as every other panel, and one band says what kind of
    // news it is. Tinting the whole card would make four of them a rainbow.
    const stripe = document.createElement('div');
    css(stripe, ['position:absolute', 'left:0', 'top:0', 'bottom:0', 'width:3px',
      `background:${tone}`, `box-shadow:0 0 12px ${tone}66`]);

    const text = document.createElement('div');
    css(text, ['display:flex', 'flex-direction:column', 'gap:3px', 'flex:1']);
    const head = document.createElement('div');
    css(head, [...label(), `color:${tone}`, 'font-size:9px']);
    head.textContent = alert.title;
    const body = document.createElement('div');
    css(body, [`color:${SKIN.text}`, 'font-size:11px', 'line-height:1.45']);
    body.textContent = alert.body;
    text.append(head, body);
    el.append(stripe, text);

    if (alert.figure !== undefined) {
      const fig = document.createElement('div');
      css(fig, ['font-variant-numeric:tabular-nums', `color:${tone}`,
        'font-size:13px', 'align-self:center', 'white-space:nowrap']);
      fig.textContent = alert.figure;
      el.appendChild(fig);
    }
  }

  private drop(el: HTMLElement): void {
    const i = this.live.findIndex((l) => l.el === el);
    if (i < 0) return;
    this.live.splice(i, 1);
    el.style.transform = 'translateX(18px)';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 240);
  }
}
