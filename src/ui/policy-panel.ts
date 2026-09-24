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
import { SKIN, css } from './skin';

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

    this.root.className = 'mr-policies';
    const head = document.createElement('button');
    head.type = 'button';
    head.dataset.action = 'policies-toggle';
    head.className = 'mr-sec-head mr-sec-toggle';
    head.setAttribute('aria-expanded', 'false');

    const caret = document.createElement('span');
    caret.className = 'mr-caret';
    const title = document.createElement('span');
    title.textContent = 'Policies';
    css(title, ['flex:1 1 auto']);

    this.summary = document.createElement('span');
    this.summary.dataset.stat = 'policy-summary';
    this.summary.className = 'mr-sec-sum';

    head.append(caret, title, this.summary);
    head.addEventListener('click', () => {
      this.open = !this.open;
      head.setAttribute('aria-expanded', String(this.open));
      this.list.style.display = this.open ? 'flex' : 'none';
    });
    this.root.appendChild(head);

    this.list = document.createElement('div');
    // No scroller here either: the card it sits in is the one that scrolls,
    // and a list that catches the wheel first is a list you cannot scroll past.
    this.list.className = 'mr-policy-list';
    this.list.style.display = 'none';
    this.root.appendChild(this.list);

    for (let i = 0; i < POLICIES.length; i++) {
      const def = POLICIES[i];
      const row = document.createElement('label');
      row.dataset.policy = def.id;
      row.className = 'mr-policy';

      const box = document.createElement('input');
      box.type = 'checkbox';
      box.className = 'mr-switch';
      box.setAttribute('aria-label', def.name);
      box.addEventListener('change', () => {
        this.policies?.set(i, box.checked);
        this.paint();
      });

      const body = document.createElement('div');
      body.className = 'mr-policy-body';
      const name = document.createElement('span');
      name.className = 'mr-policy-name';
      name.textContent = def.name;
      const blurb = document.createElement('span');
      blurb.className = 'mr-policy-blurb';
      blurb.textContent = def.blurb;
      const says = document.createElement('span');
      says.className = 'mr-policy-says';
      says.textContent = def.says.join(' \u00b7 ');

      body.append(name, blurb, says);
      row.append(body, box);
      this.list.appendChild(row);
      this.rows.push(row);
      this.boxes.push(box);
    }

    const note = document.createElement('div');
    note.className = 'mr-note-small';
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
      // A mandate: an elected mayor's pledge, held in place for the term.
      const pinned = p.isPinned(i);
      this.boxes[i].disabled = pinned;
      this.rows[i].title = pinned ? 'Pledged by the mayor \u2014 in force until the next election' : '';
      this.rows[i].classList.toggle('is-on', on);
      this.rows[i].classList.toggle('is-pinned', pinned);
    }
  }
}
