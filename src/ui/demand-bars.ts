/**
 * The demand bars: what the city is short of, as four columns.
 *
 * A player zoning land is answering one question -- what does this city need more
 * of -- and until now the game gave them no way to ask it. Everything else in the
 * interface reports how the city *is*. This is the only readout that says what it
 * wants, and it is the one that decides what their next click should be.
 *
 * FOUR BARS, NOT THREE. Offices are a zone here, and a city whose graduates are
 * stacking pallets is short of desks rather than of warehouses -- which is a
 * distinction the simulation already draws and which a merged industrial bar would
 * throw away at exactly the moment it starts to matter.
 *
 * SIGNED. The bars run both ways from a centre line. The negative half is doing
 * real work: it is the answer to "why is my industrial estate empty", and a bar
 * that could only be empty or full would leave that question with no answer at
 * all. Empty means balanced; below the line means overbuilt.
 *
 * THE QUEUE LINE UNDER THEM is the other half of the same story. Demand says what
 * the city will pay for; the queue says how much painted land is waiting for it.
 * Read together they explain everything the growth model does -- a full bar and a
 * long queue is a city building as fast as it can, and a flat bar and a long queue
 * is a player who has zoned something nobody wants.
 */

import { ZONE_STYLE } from './zones';

/** How often the bars are rewritten, in milliseconds. */
const REPAINT_MS = 200;

/** Bar geometry, in pixels. */
const BAR_W = 17;
const HALF_H = 33;

/** The columns, in the order `Demand.want` holds them. */
const COLUMNS = [
  { key: 'residential', letter: 'R', name: 'Residential' },
  { key: 'commercial', letter: 'C', name: 'Commercial' },
  { key: 'industrial', letter: 'I', name: 'Industrial' },
  { key: 'office', letter: 'O', name: 'Office' },
] as const;

function style(el: HTMLElement, decls: string[]): void {
  el.style.cssText = decls.join(';');
}

/** What the panel needs each repaint. Null while there is no city. */
export interface DemandReading {
  /** Minus one to one, one per column, in `COLUMNS` order. */
  want: ArrayLike<number>;
  /** Zoned cells still waiting to be built on, and ones already built. */
  waiting: number;
  released: number;
}

export class DemandBars {
  private readonly root: HTMLElement;
  private readonly fills: HTMLElement[] = [];
  private readonly caption: HTMLElement;
  private readonly cells: HTMLElement[] = [];
  private paintedAt = -1;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.dataset.panel = 'demand';
    style(this.root, [
      'position:absolute', 'right:12px', 'bottom:14px', 'z-index:6',
      'display:none', 'pointer-events:none',
      'padding:9px 11px 7px', 'gap:7px',
      'flex-direction:column', 'align-items:stretch',
      'background:rgba(8,12,17,.88)', 'border:1px solid rgba(98,212,255,.16)',
      'border-radius:5px', 'backdrop-filter:blur(14px)',
      'font:11px/1.55 var(--mono)', 'color:#8fa3bd',
    ]);

    const head = document.createElement('div');
    style(head, ['font-size:9px', 'letter-spacing:.14em', 'text-transform:uppercase',
      'color:#5e7a8f', 'text-align:center']);
    head.textContent = 'Demand';
    this.root.appendChild(head);

    const row = document.createElement('div');
    style(row, ['display:flex', 'gap:6px', 'align-items:flex-end']);

    for (const col of COLUMNS) {
      const cell = document.createElement('div');
      cell.dataset.bar = col.key;
      cell.title = `${col.name} demand`;
      style(cell, ['display:flex', 'flex-direction:column', 'align-items:center',
        'gap:4px']);

      // The track. The centre line is where zero is, and the fill grows from it
      // in whichever direction the number goes -- so a glance reads the sign
      // before it reads the size, which is the order the question is asked in.
      const track = document.createElement('div');
      style(track, ['position:relative', `width:${BAR_W}px`, `height:${HALF_H * 2}px`,
        'background:rgba(255,255,255,.05)', 'border-radius:2px', 'overflow:hidden']);

      const zero = document.createElement('div');
      style(zero, ['position:absolute', 'left:0', 'right:0', `top:${HALF_H}px`,
        'height:1px', 'background:rgba(255,255,255,.22)']);

      const fill = document.createElement('div');
      fill.dataset.fill = col.key;
      style(fill, ['position:absolute', 'left:0', 'right:0', `top:${HALF_H}px`,
        'height:0px', 'border-radius:2px',
        'background:' + ZONE_STYLE[col.key].base,
        'transition:top .25s ease,height .25s ease']);

      track.append(fill, zero);

      const letter = document.createElement('div');
      style(letter, ['font-size:9px', 'letter-spacing:.06em',
        `color:${ZONE_STYLE[col.key].light}`]);
      letter.textContent = col.letter;

      cell.append(track, letter);
      row.appendChild(cell);
      this.fills.push(fill);
      this.cells.push(cell);
    }
    this.root.appendChild(row);

    this.caption = document.createElement('div');
    this.caption.dataset.stat = 'queue';
    style(this.caption, ['font-size:9px', 'text-align:center', 'color:#5e7a8f',
      'white-space:nowrap']);
    this.caption.textContent = '—';
    this.root.appendChild(this.caption);

    parent.appendChild(this.root);
  }

  /** Shown while the city is being played, hidden behind the menu. */
  set visible(on: boolean) {
    this.root.style.display = on ? 'flex' : 'none';
  }

  /**
   * Repaints, at most a few times a second.
   *
   * @param now `performance.now()`.
   * @param read called only when a repaint is actually due.
   */
  refresh(now: number, read: () => DemandReading | null): void {
    if (now - this.paintedAt < REPAINT_MS) return;
    this.paintedAt = now;
    const r = read();
    if (r === null) return;

    for (let i = 0; i < this.fills.length; i++) {
      const v = Math.max(-1, Math.min(1, r.want[i] ?? 0));
      const h = Math.round(Math.abs(v) * HALF_H);
      const fill = this.fills[i];
      fill.style.height = `${h}px`;
      fill.style.top = `${v >= 0 ? HALF_H - h : HALF_H}px`;
      // Overbuilt reads as a warning rather than as more of the same colour: a
      // red stub below the line is the one state a player has to act on.
      fill.style.background = v >= 0 ? ZONE_STYLE[COLUMNS[i].key].base : '#a8443a';
      this.cells[i].title = `${COLUMNS[i].name}: `
        + (v > 0.02 ? `${Math.round(v * 100)}% short`
          : v < -0.02 ? `${Math.round(-v * 100)}% overbuilt` : 'balanced');
    }

    // Waiting is zoned land the city has not earned yet. Zero with zoning on the
    // map means everything painted is built, which is the state a player who
    // wants to grow has to fix by zoning more.
    this.caption.textContent = r.waiting > 0
      ? `${r.waiting.toLocaleString()} plots waiting`
      : r.released > 0 ? 'all zoning built' : 'nothing zoned';
  }
}
