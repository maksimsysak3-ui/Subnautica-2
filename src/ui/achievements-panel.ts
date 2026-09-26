/**
 * The Achievements screen, from the title menu: every achievement, earned or
 * not, in tiers, with the day each was earned.
 */

import { ACHIEVEMENTS, earnedAt, earnedCount, reloadAchievements, type Tier } from '../sim/achievements';
import { glyph } from './glyphs';

const BACK_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
  + ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';

const TIER_ORDER: Tier[] = ['gold', 'silver', 'bronze'];
const TIER_NAME: Record<Tier, string> = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function openAchievementsPanel(host: HTMLElement, onClose: () => void): void {
  reloadAchievements();
  const frame = el('div', 'mr-setup mr-mods mr-ach');
  frame.setAttribute('role', 'dialog');
  frame.setAttribute('aria-label', 'Achievements');
  const head = el('div', 'mr-setup-head');
  const back = el('button', 'mr-square');
  back.setAttribute('aria-label', 'Back');
  back.innerHTML = BACK_SVG;
  const total = ACHIEVEMENTS.length, got = earnedCount();
  const chip = el('span', 'mr-chip is-amber', `${got} of ${total}`);
  head.append(back, el('h2', '', 'Achievements'), chip);

  const bar = el('div', 'mr-ach-bar');
  const fill = el('div', 'mr-ach-fill');
  fill.style.width = `${Math.round((got / total) * 100)}%`;
  bar.appendChild(fill);
  const note = el('p', 'mr-mods-note',
    'Kept in this browser across every city you run. They are checked while you play.');

  const body = el('div', 'mr-ach-body');
  for (const tier of TIER_ORDER) {
    const list = ACHIEVEMENTS.filter((a) => a.tier === tier);
    body.appendChild(el('div', 'mr-mod-label', `${TIER_NAME[tier]} · ${list.filter((a) => earnedAt(a.id) !== null).length}/${list.length}`));
    const grid = el('div', 'mr-ach-grid');
    for (const a of list) {
      const at = earnedAt(a.id);
      const card = el('div', `mr-ach-card is-${tier}${at !== null ? ' is-got' : ''}`);
      const medal = el('div', 'mr-ach-medal');
      medal.innerHTML = at !== null ? glyph('signature', 22) : glyph('lock', 18);
      const words = el('div', 'mr-ach-words');
      words.append(el('b', '', a.title), el('span', '', a.note));
      if (at !== null) words.appendChild(el('i', '', `Earned ${new Date(at).toLocaleDateString()}`));
      card.append(medal, words);
      grid.appendChild(card);
    }
    body.appendChild(grid);
  }

  frame.append(head, bar, note, body);
  host.appendChild(frame);
  requestAnimationFrame(() => frame.classList.add('is-open'));
  const keys = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); shut(); }
    e.stopImmediatePropagation();
  };
  const shut = (): void => {
    removeEventListener('keydown', keys, true);
    frame.remove();
    onClose();
  };
  addEventListener('keydown', keys, true);
  back.addEventListener('click', shut);
}
