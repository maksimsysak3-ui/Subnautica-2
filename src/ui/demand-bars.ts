/**
 * The demand bars: what the city is short of, as four rows.
 *
 * A player zoning land is answering one question -- what does this city need more
 * of -- and until now the game gave them no way to ask it. Everything else in the
 * interface reports how the city *is*. This is the only readout that says what it
 * wants, and it is the one that decides what their next click should be.
 *
 * FOUR, NOT THREE. Offices are a zone here, and a city whose graduates are
 * stacking pallets is short of desks rather than of warehouses -- which is a
 * distinction the simulation already draws and which a merged industrial bar would
 * throw away at exactly the moment it starts to matter.
 *
 * SIGNED. The bars run both ways from a centre line, right for short and left
 * for overbuilt. The negative half is doing
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
import { SKIN, panel, label as labelStyle, tip } from './skin';

/** How often the bars are rewritten, in milliseconds. */
const REPAINT_MS = 200;

/** Bar geometry, in pixels. Small: this is a gauge, not a chart. */
const TRACK_W = 104;
const TRACK_H = 6;
const HALF_W = TRACK_W / 2;

/** The rows, in the order `Demand.want` holds them. */
const COLUMNS = [
  { key: 'residential', letter: 'R', name: 'Residential' },
  { key: 'commercial', letter: 'C', name: 'Commercial' },
  { key: 'industrial', letter: 'I', name: 'Industrial' },
  { key: 'office', letter: 'O', name: 'Office' },
] as const;

/**
 * The colour a bar is drawn in.
 *
 * Always the zone's own -- the same green, blue, gold and violet as the swatch
 * on the button the player has to press, which is the whole reason those colours
 * exist. Four bars that all went red when the city was overbuilt were four bars
 * you could not tell apart at exactly the moment it mattered which one you were
 * reading.
 *
 * So the sign is carried by the *side* and the *shade* instead: short of it
 * fills right in the zone's bright colour, overbuilt fills left in its muted
 * one. Direction is the faster read of the two and it is the one the eye gets
 * first; the shade is what keeps the two readable side by side on a dark track,
 * which the darkest step of each palette is not.
 */

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
    style(this.root, [...panel(), 'position:absolute', 'right:12px', 'bottom:var(--hud-foot, 14px)',
      'z-index:6', 'display:none', 'pointer-events:none',
      'padding:10px 12px 9px', 'gap:7px',
      'flex-direction:column', 'align-items:stretch']);

    const head = document.createElement('div');
    style(head, labelStyle());
    head.textContent = 'Demand';
    this.root.appendChild(head);

    const rows = document.createElement('div');
    style(rows, ['display:flex', 'flex-direction:column', 'gap:3px']);

    for (const col of COLUMNS) {
      const cell = document.createElement('div');
      cell.dataset.bar = col.key;
      tip(cell, `${col.name} demand \u2014 above the line is a shortage`);
      style(cell, ['display:flex', 'align-items:center', 'gap:5px']);

      // The identity colour, always visible. A bar that is empty or overbuilt
      // is not drawn in its zone's colour, and without this the row would then
      // have nothing on it saying which zone it is about but a single letter.
      const chip = document.createElement('span');
      style(chip, ['width:5px', 'height:5px', 'border-radius:1px',
        `background:${ZONE_STYLE[col.key].base}`, 'flex:0 0 auto']);

      const letter = document.createElement('span');
      style(letter, ['font-size:9px', 'width:7px', 'flex:0 0 auto',
        `color:${ZONE_STYLE[col.key].light}`]);
      letter.textContent = col.letter;

      // The track. Zero is the middle, and the fill grows out of it in whichever
      // direction the number goes -- so a glance reads the sign before it reads
      // the size, which is the order the question is asked in.
      const track = document.createElement('div');
      style(track, ['position:relative', `width:${TRACK_W}px`, `height:${TRACK_H}px`,
        `background:${SKIN.track}`, `border-radius:${TRACK_H}px`,
        'overflow:hidden', 'flex:0 0 auto']);

      const zero = document.createElement('div');
      style(zero, ['position:absolute', 'top:0', 'bottom:0', `left:${HALF_W}px`,
        'width:1px', 'background:rgba(255,255,255,.22)']);

      const fill = document.createElement('div');
      fill.dataset.fill = col.key;
      style(fill, ['position:absolute', 'top:0', 'bottom:0', `left:${HALF_W}px`,
        'width:0px', `border-radius:${TRACK_H}px`,
        'background:' + ZONE_STYLE[col.key].base,
        'transition:left .3s cubic-bezier(.2,.7,.3,1),width .3s cubic-bezier(.2,.7,.3,1)']);

      track.append(fill, zero);
      cell.append(chip, letter, track);
      rows.appendChild(cell);
      this.fills.push(fill);
      this.cells.push(cell);
    }
    this.root.appendChild(rows);

    this.caption = document.createElement('div');
    this.caption.dataset.stat = 'queue';
    style(this.caption, ['font-size:9px', `color:${SKIN.faint}`, 'white-space:nowrap',
      'letter-spacing:.04em']);
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
      const w = Math.round(Math.abs(v) * HALF_W);
      const fill = this.fills[i];
      fill.style.width = `${w}px`;
      fill.style.left = `${v >= 0 ? HALF_W : HALF_W - w}px`;
      const palette = ZONE_STYLE[COLUMNS[i].key];
      fill.style.background = v >= 0 ? palette.light : palette.base;
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
