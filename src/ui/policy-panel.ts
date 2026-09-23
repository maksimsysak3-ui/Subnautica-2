/**
 * The ordinances, as ten switches.
 *
 * Mounted under the budget view beside the tax sliders, and for the same
 * reason they are: a policy is a decision about money as much as about the
 * city, and the bill for it is three lines above. Setting one on a screen of
 * its own would be setting it away from the only number that says whether it
 * was worth it.
 *
 * COLLAPSED UNTIL ASKED FOR. Ten rows of name, effect and price is a wall, and
 * the budget card is already a column of figures -- so the list folds behind a
 * header that says how many are in force and what they are costing, which is
 * the summary a player wants nine times out of ten. Opening it is one click.
 *
 * WHAT A ROW SAYS. The name, what it does, and what it costs, because a switch
 * whose consequence is not written on it is a switch the player flips once and
 * never understands. The effects come from the policy table rather than being
 * restated here, so the two cannot drift apart.
 */

import { POLICIES } from '../sim';
import type { Policies } from '../sim';
import { SKIN, label as labelStyle, css } from './skin';

/** The money format the rest of the panels use: thousands, no decimals. */
function money(n: number): string {
  const abs = Math.abs(n);
  const s = abs >= 1000 ? `${Math.round(abs / 100) / 10}k` : String(Math.round(abs));
  return n < 0 ? `+${s}` : s;
}

export class PolicyPanel {
  readonly root: HTMLElement;
  private readonly list: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly rows: HTMLElement[] = [];
  private readonly boxes: HTMLInputElement[] = [];
  private policies: Policies | null = null;
  private shownVersion = -1;
  private open = false;
  /** The weekly bill, handed in by whoever has the ledger. */
  private bill = 0;

  constructor() {
    this.root = document.createElement('div');
    this.root.dataset.panel = 'policies';
    css(this.root, ['display:flex', 'flex-direction:column', 'gap:6px',
      'margin-top:8px', 'border-top:1px solid rgba(98,212,255,.14)', 'padding-top:8px']);

    const head = document.createElement('button');
    head.type = 'button';
    head.dataset.action = 'policies-toggle';
    css(head, [...labelStyle(), 'display:flex', 'align-items:center', 'gap:6px',
      'background:none', 'border:0', 'padding:0', 'cursor:pointer',
      'pointer-events:auto', 'text-align:left', 'width:100%']);

    const caret = document.createElement('span');
    css(caret, ['font-size:9px', `color:${SKIN.accent}`, 'width:8px']);
    caret.textContent = '▸';

    const title = document.createElement('span');
    title.textContent = 'Policies';
    css(title, ['flex:1 1 auto']);

    this.summary = document.createElement('span');
    this.summary.dataset.stat = 'policy-summary';
    css(this.summary, ['font-size:9.5px', `color:${SKIN.dim}`,
      'font-variant-numeric:tabular-nums', 'letter-spacing:0']);

    head.append(caret, title, this.summary);
    head.addEventListener('click', () => {
      this.open = !this.open;
      caret.textContent = this.open ? '▾' : '▸';
      this.list.style.display = this.open ? 'flex' : 'none';
    });
    this.root.appendChild(head);

    this.list = document.createElement('div');
    // No scroller here either: the card it sits in is the one that scrolls,
    // and a list that catches the wheel first is a list you cannot scroll past.
    css(this.list, ['display:none', 'flex-direction:column', 'gap:3px']);
    this.root.appendChild(this.list);

    for (let i = 0; i < POLICIES.length; i++) {
      const def = POLICIES[i];
      const row = document.createElement('label');
      row.dataset.policy = def.id;
      css(row, ['display:flex', 'gap:7px', 'align-items:flex-start',
        'padding:5px 6px', 'border-radius:4px', 'cursor:pointer',
        'pointer-events:auto', 'background:rgba(255,255,255,.02)',
        'border:1px solid transparent', 'transition:background .1s, border-color .1s']);

      const box = document.createElement('input');
      box.type = 'checkbox';
      box.setAttribute('aria-label', def.name);
      css(box, ['margin:2px 0 0 0', 'flex:0 0 auto', 'cursor:pointer',
        `accent-color:${SKIN.accent}`]);
      box.addEventListener('change', () => {
        this.policies?.set(i, box.checked);
        this.paint();
      });

      const body = document.createElement('div');
      css(body, ['display:flex', 'flex-direction:column', 'gap:1px', 'flex:1 1 auto']);

      const name = document.createElement('span');
      css(name, ['font-size:10.5px', `color:${SKIN.bright}`]);
      name.textContent = def.name;

      const blurb = document.createElement('span');
      css(blurb, ['font-size:9px', `color:${SKIN.dim}`, 'line-height:1.4']);
      blurb.textContent = def.blurb;

      const says = document.createElement('span');
      css(says, ['font-size:9px', `color:${SKIN.faint}`, 'line-height:1.4']);
      says.textContent = def.says.join(' · ');

      body.append(name, blurb, says);
      row.append(box, body);
      this.list.appendChild(row);
      this.rows.push(row);
      this.boxes.push(box);
    }

    const note = document.createElement('div');
    css(note, ['font-size:9.5px', `color:${SKIN.faint}`, 'line-height:1.5']);
    note.textContent = 'Every one of these costs something, in money or in what '
      + 'the city can do. That is the point of them.';
    this.root.appendChild(note);
  }

  /** Points at the city's policies. Called whenever the world is replaced. */
  bind(policies: Policies | null): void {
    this.policies = policies;
    this.shownVersion = -1;
    this.refresh(0);
  }

  /**
   * Pulls the switches back into line, and takes this week's bill.
   *
   * The bill comes from the ledger rather than being worked out here: the same
   * figure the budget rows are showing, so the two cannot disagree.
   */
  refresh(weekly: number): void {
    const p = this.policies;
    if (p === null) return;
    const moved = Math.abs(weekly - this.bill) > 1;
    this.bill = weekly;
    if (p.version === this.shownVersion && !moved) return;
    this.shownVersion = p.version;
    for (let i = 0; i < this.boxes.length; i++) this.boxes[i].checked = p.has(i);
    this.paint();
  }

  private paint(): void {
    const p = this.policies;
    if (p === null) return;
    const n = p.active;
    this.summary.textContent = n === 0 ? 'none in force'
      : `${n} in force · ${money(this.bill)}/wk`;
    this.summary.style.color = n === 0 ? SKIN.faint
      : this.bill < 0 ? SKIN.good : SKIN.text;
    for (let i = 0; i < this.rows.length; i++) {
      const on = p.has(i);
      this.rows[i].style.background = on ? 'rgba(98,212,255,.08)' : 'rgba(255,255,255,.02)';
      this.rows[i].style.borderColor = on ? 'rgba(98,212,255,.28)' : 'transparent';
    }
  }
}
