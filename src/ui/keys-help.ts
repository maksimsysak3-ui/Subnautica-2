/**
 * The keyboard, on one card.
 *
 * Every panel in the game has a key and every tool has one or two more, and
 * the only place any of them was written down was a tooltip that appears once
 * the pointer has already found the button. `?` (or F1) puts all of them on
 * screen at once, which is where a player looks when their hand is on the
 * keyboard and they have forgotten which letter the views are on.
 */

import { SKIN, panel, label, css } from './skin';

/** Groups of [keys, what they do]. Keys are separated by spaces. */
const GROUPS: [string, [string, string][]][] = [
  ['Camera', [
    ['W A S D', 'pan (arrow keys too)'],
    ['Q E', 'turn'],
    ['R F', 'tilt'],
    ['+ −', 'zoom'],
    ['Shift drag', 'orbit with the mouse'],
  ]],
  ['Time', [
    ['Space', 'pause and resume'],
    ['1 2 3 4', 'pick a speed'],
  ]],
  ['Building', [
    ['Ctrl Z', 'undo the last build'],
    ['R', 'rotate what you are placing'],
    ['PgUp PgDn', 'raise or lower a road'],
    ['Esc', 'drop the half-drawn road, then the tool'],
    ['Enter', 'finish a transit line or area'],
    ['Del', 'remove the last stop or point'],
    ['[ ]', 'fewer or more vehicles on a line'],
  ]],
  ['Panels', [
    ['V', 'info views'],
    ['T', 'tech tree'],
    ['P', 'City Hall computer'],
    ['C', 'CitiTok'],
    ['O', 'settings'],
    ['Ctrl S', 'save'],
    ['F3', 'performance readout'],
    ['?', 'this card'],
  ]],
];

export class KeysHelp {
  private el: HTMLElement;
  private shown = false;
  /** Off behind the title screen, where none of these keys mean anything. */
  allowed = false;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.dataset.panel = 'keys';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Keyboard shortcuts');
    css(this.el, [...panel(), 'position:absolute', 'left:50%', 'top:50%',
      'transform:translate(-50%,-50%)', 'padding:16px 20px 14px', 'z-index:40',
      'width:min(620px,calc(100vw - 32px))', 'max-height:calc(100vh - 64px)', 'overflow:auto',
      'display:none']);

    const head = document.createElement('div');
    css(head, ['display:flex', 'justify-content:space-between', 'align-items:baseline',
      'margin-bottom:12px']);
    const title = document.createElement('div');
    title.textContent = 'Keyboard';
    css(title, [`color:${SKIN.bright}`, 'font:600 15px/1.2 var(--label)']);
    const hint = document.createElement('div');
    hint.textContent = 'Esc or ? to close';
    css(hint, label(['letter-spacing:.08em']));
    head.append(title, hint);

    const grid = document.createElement('div');
    css(grid, ['display:grid', 'grid-template-columns:repeat(auto-fit,minmax(250px,1fr))',
      'gap:14px 24px']);
    for (const [name, rows] of GROUPS) {
      const group = document.createElement('div');
      const cap = document.createElement('div');
      cap.textContent = name;
      css(cap, label(['margin-bottom:6px']));
      group.appendChild(cap);
      for (const [keys, what] of rows) {
        const row = document.createElement('div');
        css(row, ['display:flex', 'align-items:center', 'gap:10px', 'padding:2px 0']);
        const caps = document.createElement('div');
        css(caps, ['display:flex', 'gap:3px', 'flex:0 0 96px', 'flex-wrap:wrap']);
        for (const k of keys.split(' ')) {
          const kb = document.createElement('kbd');
          kb.textContent = k;
          css(kb, ['font:600 11px/1 var(--mono)', `color:${SKIN.bright}`,
            'padding:3px 5px', `border:1px solid ${SKIN.edge}`, `border-radius:${SKIN.radiusSmall}`,
            'background:rgba(255,255,255,.05)', 'box-shadow:inset 0 -1px 0 rgba(0,0,0,.4)']);
          caps.appendChild(kb);
        }
        const desc = document.createElement('div');
        desc.textContent = what;
        row.append(caps, desc);
        group.appendChild(row);
      }
      grid.appendChild(group);
    }
    this.el.append(head, grid);
    parent.appendChild(this.el);

    addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      if (e.key === '?' || e.key === 'F1') {
        e.preventDefault();
        this.toggle(!this.shown);
      } else if (e.key === 'Escape' && this.shown) {
        // First, so the Escape that closes this card does not also put the
        // player's tool away underneath it.
        e.stopImmediatePropagation();
        this.toggle(false);
      }
    }, true);
    this.el.addEventListener('pointerdown', () => this.toggle(false));
  }

  toggle(on: boolean): void {
    this.shown = on && this.allowed;
    this.el.style.display = this.shown ? 'block' : 'none';
  }
}
