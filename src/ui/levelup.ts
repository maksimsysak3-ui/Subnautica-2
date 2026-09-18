/**
 * The card the city gets when it grows up.
 *
 * A level-up is the one moment a builder gets to be theatrical, and the whole
 * job of this card is to make three facts land in the second and a half a
 * player looks at it: what the city is now, what it was paid, and what it can
 * build that it could not build before.
 *
 * The last of those is the part most games leave out, and it is the only part
 * that changes what the player does next -- so the new buildings are drawn as
 * themselves, from the same photographs the build bar uses, and the card stays
 * up until it is dismissed rather than sliding away while they are read.
 */

import { SKIN, css, panel, label } from './skin';
import { assetIcon, hasIcon } from './icons';
import { assetById } from '../assets/registry';
import { money } from '../sim';
import type { LevelUp } from '../sim/progress';
import { fanfare, click as clickSound } from './sound';

export class LevelUpCard {
  private readonly root: HTMLElement;
  private readonly card: HTMLElement;
  private queue: LevelUp[] = [];
  private showing = false;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.dataset.panel = 'levelup';
    css(this.root, ['position:absolute', 'inset:0', 'z-index:45', 'display:none',
      'align-items:center', 'justify-content:center', 'pointer-events:auto',
      'background:rgba(4,7,11,.5)', 'backdrop-filter:blur(4px)']);

    this.card = document.createElement('div');
    css(this.card, [...panel(), 'width:min(420px, 92vw)', 'padding:0',
      'overflow:hidden', 'text-align:center',
      'box-shadow:0 34px 90px rgba(0,0,0,.65)',
      'transform:scale(.92)', 'opacity:0',
      'transition:transform .28s cubic-bezier(.2,.9,.3,1.2), opacity .24s']);
    this.root.appendChild(this.card);
    parent.appendChild(this.root);

    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.next();
    });
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'Escape' || e.key === 'Enter') && this.showing) this.next();
    });
  }

  /** Queues a level. Several at once are shown one after another. */
  push(level: LevelUp): void {
    this.queue.push(level);
    if (!this.showing) this.next();
  }

  get open(): boolean { return this.showing; }

  /** Drops everything queued and hides the card. For the menu and the probes. */
  dismissAll(): void {
    this.queue.length = 0;
    this.showing = false;
    this.root.style.display = 'none';
    this.card.style.opacity = '0';
  }

  private next(): void {
    const level = this.queue.shift();
    if (level === undefined) {
      this.showing = false;
      this.card.style.transform = 'scale(.96)';
      this.card.style.opacity = '0';
      setTimeout(() => { this.root.style.display = 'none'; }, 220);
      return;
    }
    this.showing = true;
    this.fill(level);
    this.root.style.display = 'flex';
    requestAnimationFrame(() => {
      this.card.style.transform = 'scale(1)';
      this.card.style.opacity = '1';
    });
    fanfare();
  }

  private fill(level: LevelUp): void {
    this.card.innerHTML = '';

    // ---- the banner ----
    const banner = document.createElement('div');
    css(banner, ['position:relative', 'padding:26px 20px 20px',
      'background:radial-gradient(ellipse at 50% 0%, rgba(232,180,84,.22),'
        + ' rgba(10,14,20,0) 70%)',
      `border-bottom:1px solid ${SKIN.edge}`]);

    const eyebrow = document.createElement('div');
    css(eyebrow, [...label(), 'font-size:9.5px', `color:${SKIN.warn}`]);
    eyebrow.textContent = `Level ${level.level} reached`;

    // A ring with the trophy in it, which is the one piece of pure decoration
    // in the game and has earned it.
    const ring = document.createElement('div');
    css(ring, ['width:86px', 'height:86px', 'margin:14px auto 12px',
      'border-radius:86px', 'display:grid', 'place-items:center',
      'border:2px solid rgba(232,180,84,.55)',
      'background:radial-gradient(circle at 50% 35%, rgba(232,180,84,.28),'
        + ' rgba(8,12,18,.9))',
      'box-shadow:0 0 34px rgba(232,180,84,.28), inset 0 1px 0 rgba(255,255,255,.14)']);
    const trophy = document.createElement('div');
    css(trophy, ['font-size:34px', 'line-height:1']);
    trophy.textContent = '\u{1F3C6}';
    ring.appendChild(trophy);

    const name = document.createElement('div');
    css(name, [`color:${SKIN.bright}`, 'font-size:22px', 'letter-spacing:.01em']);
    name.textContent = level.name;

    const line = document.createElement('div');
    css(line, [`color:${SKIN.dim}`, 'font-size:11px', 'margin-top:6px']);
    line.textContent = 'The city has grown. Here is what comes with it.';

    banner.append(eyebrow, ring, name, line);

    // ---- the rewards ----
    const rewards = document.createElement('div');
    css(rewards, ['display:flex', 'gap:10px', 'padding:14px 18px',
      'justify-content:center']);
    rewards.appendChild(this.reward('\u{1F4B0}', money(level.cash), 'to the treasury',
      SKIN.good));
    rewards.appendChild(this.reward('★', `${level.stars}`,
      level.stars === 1 ? 'development star' : 'development stars', SKIN.warn));

    this.card.append(banner, rewards);

    // ---- and what it opens ----
    if (level.unlocked.length > 0) {
      const head = document.createElement('div');
      css(head, [...label(), 'font-size:9px', 'padding:4px 18px 8px',
        'text-align:left']);
      head.textContent = 'New landmarks';
      const strip = document.createElement('div');
      css(strip, ['display:flex', 'gap:10px', 'padding:0 18px 16px',
        'justify-content:center', 'flex-wrap:wrap']);
      for (const id of level.unlocked) {
        const def = assetById(id);
        if (def === undefined) continue;
        const cell = document.createElement('div');
        css(cell, ['display:flex', 'flex-direction:column', 'align-items:center',
          'gap:6px', 'width:120px']);
        const frame = document.createElement('div');
        css(frame, ['width:88px', 'height:88px', 'display:grid',
          'place-items:center', `border-radius:${SKIN.radius}`,
          `border:1px solid ${SKIN.edge}`,
          'background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(8,12,18,.85))',
          'box-shadow:inset 0 1px 0 rgba(255,255,255,.08)']);
        if (hasIcon(id)) frame.appendChild(assetIcon(id, 74));
        const t = document.createElement('div');
        css(t, [`color:${SKIN.text}`, 'font-size:10.5px', 'line-height:1.3',
          'text-align:center']);
        t.textContent = def.name;
        cell.append(frame, t);
        strip.appendChild(cell);
      }
      this.card.append(head, strip);
    }

    const go = document.createElement('button');
    css(go, ['margin:0', 'width:100%', 'padding:13px', 'border:0',
      `border-top:1px solid ${SKIN.edge}`, 'cursor:pointer',
      'background:linear-gradient(180deg, rgba(232,180,84,.22), rgba(232,180,84,.08))',
      `color:${SKIN.bright}`, `font:12px/1 ${SKIN.mono}`, 'letter-spacing:.06em']);
    go.textContent = this.queue.length > 0 ? 'NEXT' : 'CARRY ON BUILDING';
    go.addEventListener('click', () => { clickSound(); this.next(); });
    this.card.appendChild(go);
  }

  private reward(glyph: string, value: string, what: string,
    tint: string): HTMLElement {
    const el = document.createElement('div');
    css(el, ['display:flex', 'flex-direction:column', 'align-items:center',
      'gap:3px', 'padding:10px 16px', `border-radius:${SKIN.radius}`,
      `border:1px solid ${SKIN.edge}`, 'background:rgba(255,255,255,.03)',
      'min-width:128px']);
    const g = document.createElement('div');
    css(g, ['font-size:17px', 'line-height:1', `color:${tint}`]);
    g.textContent = glyph;
    const v = document.createElement('div');
    css(v, [`color:${tint}`, 'font-size:15px', 'font-variant-numeric:tabular-nums']);
    v.textContent = value;
    const w = document.createElement('div');
    css(w, [`color:${SKIN.dim}`, 'font-size:9.5px']);
    w.textContent = what;
    el.append(g, v, w);
    return el;
  }
}
