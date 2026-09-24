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

import { SKIN } from './skin';
import { glyph } from './glyphs';

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
  /** What clicking the card does before it is dismissed: take the camera there, say. */
  go?: () => void;
  /** A pictogram name (see glyphs.ts); the tone's own mark if absent. */
  icon?: string;
}

const TONE_ICON: Record<Tone, string> = { good: 'check', warn: 'alert', bad: 'alert', info: 'info' };

const TONE: Record<Tone, string> = {
  good: SKIN.good, warn: SKIN.warn, bad: SKIN.bad, info: SKIN.accent,
};

/** How long a card stays before it leaves on its own, in milliseconds. */
const LIFE = 9000;
/** And the most that can be on screen at once. */
const MOST = 4;

interface Live { el: HTMLElement; tag: string; born: number; go?: (() => void) | undefined; held?: boolean }

export class Alerts {
  private readonly host: HTMLElement;
  private readonly live: Live[] = [];

  constructor(parent: HTMLElement) {
    this.host = document.createElement('div');
    this.host.dataset.panel = 'alerts';
    this.host.className = 'mr-toasts';
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
      const was = this.live[already];
      was.born = performance.now();
      was.go = alert.go;
      this.fill(was.el, alert, tone);
      // Back to the top, where the newest news goes.
      this.host.prepend(was.el);
      return;
    }

    const el = document.createElement('div');
    el.className = 'mr-toast';
    el.setAttribute('role', 'status');
    this.fill(el, alert, tone);
    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.mr-toast-x')) { this.drop(el); return; }
      this.live.find((l) => l.el === el)?.go?.();
      this.drop(el);
    });
    // Held while the pointer is on it: nobody should lose a card they are reading.
    el.addEventListener('pointerenter', () => {
      const l = this.live.find((x) => x.el === el);
      if (l) l.held = true;
      el.classList.add('is-held');
    });
    el.addEventListener('pointerleave', () => {
      const l = this.live.find((x) => x.el === el);
      if (l) { l.held = false; l.born = performance.now(); }
      el.classList.remove('is-held');
      this.restartLife(el);
    });
    this.host.prepend(el);
    // One frame later, so the transition has a state to move from.
    requestAnimationFrame(() => el.classList.add('is-in'));

    this.live.push({ el, tag, born: performance.now(), go: alert.go });
    while (this.live.length > MOST) this.drop(this.live[0].el);
  }

  /** Retires anything that has been up long enough. Called from the frame. */
  update(now: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const l = this.live[i];
      if (l.held) { l.born = now; continue; }
      if (now - l.born > LIFE) this.drop(l.el);
    }
  }

  clear(): void {
    for (let i = this.live.length - 1; i >= 0; i--) this.drop(this.live[i].el);
  }

  private fill(el: HTMLElement, alert: Alert, tone: string): void {
    el.style.setProperty('--tone', tone);
    el.style.setProperty('--life', `${LIFE}ms`);
    el.replaceChildren();
    const badge = document.createElement('span');
    badge.className = 'mr-toast-badge';
    badge.innerHTML = glyph(alert.icon ?? TONE_ICON[alert.tone ?? 'info'], 17);
    const text = document.createElement('div');
    text.className = 'mr-toast-text';
    const head = document.createElement('div');
    head.className = 'mr-toast-title';
    head.textContent = alert.title;
    const body = document.createElement('div');
    body.className = 'mr-toast-body';
    body.textContent = alert.body;
    text.append(head, body);
    if (alert.go !== undefined) {
      const go = document.createElement('span');
      go.className = 'mr-toast-go';
      go.innerHTML = `Go there ${glyph('arrow', 12)}`;
      text.appendChild(go);
    }
    el.append(badge, text);
    if (alert.figure !== undefined) {
      const fig = document.createElement('div');
      fig.className = 'mr-toast-fig';
      fig.textContent = alert.figure;
      el.appendChild(fig);
    }
    const x = document.createElement('button');
    x.className = 'mr-toast-x';
    x.setAttribute('aria-label', 'Dismiss');
    x.innerHTML = glyph('close', 12);
    const life = document.createElement('span');
    life.className = 'mr-toast-life';
    el.append(x, life);
  }

  /** Starts the lifetime bar over, after the card was held. */
  private restartLife(el: HTMLElement): void {
    const life = el.querySelector<HTMLElement>('.mr-toast-life');
    if (life === null) return;
    life.style.animation = 'none';
    void life.offsetWidth;
    life.style.animation = '';
  }

  private drop(el: HTMLElement): void {
    const i = this.live.findIndex((l) => l.el === el);
    if (i < 0) return;
    this.live.splice(i, 1);
    el.classList.remove('is-in');
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 260);
  }
}
