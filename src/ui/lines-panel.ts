/**
 * The transit lines, as a list you can change.
 *
 * Mounted under the transport view, because that is where a player goes to ask
 * how people get about — and because the answer to "why is nobody using the
 * number 3" is on the same card as the coverage map that made them ask.
 *
 * WHAT IT REPLACED. The line tool used to hand this job to the status bar: click
 * a stop, then press `[` or `]` to change the fleet and Delete to remove it.
 * That is a keyboard shortcut for a thing with no affordance, on a control the
 * player cannot see, for a list they cannot see either. This is the list, with
 * the two buttons that do the two things.
 *
 * LIVE. Riders a day and whether the roads still join up are read every repaint,
 * so a line the player has just broken by bulldozing a street says so here
 * rather than merely failing to run.
 */

import { TRANSIT_SPEC, MIN_FLEET, MAX_FLEET, money } from '../sim';
import type { Transit, TransitNet } from '../sim';
import { SKIN, label as labelStyle } from './skin';

function style(el: HTMLElement, decls: string[]): void {
  el.style.cssText = decls.join(';');
}

/** What the panel needs each repaint. Null while there is no city. */
export interface LinesReading {
  transit: Transit;
  net: TransitNet;
}

export class LinesPanel {
  readonly root: HTMLElement;
  private readonly list: HTMLElement;
  private readonly empty: HTMLElement;
  private read: (() => LinesReading | null) | null = null;
  /** The transit version the list was last built for. */
  private builtAt = -1;

  constructor() {
    this.root = document.createElement('div');
    this.root.dataset.panel = 'lines';
    style(this.root, ['display:flex', 'flex-direction:column', 'gap:5px']);

    const head = document.createElement('div');
    style(head, labelStyle());
    head.textContent = 'Lines';
    this.root.appendChild(head);

    this.list = document.createElement('div');
    style(this.list, ['display:flex', 'flex-direction:column', 'gap:4px']);
    this.root.appendChild(this.list);

    this.empty = document.createElement('div');
    style(this.empty, ['font-size:11.5px', `color:${SKIN.faint}`, 'line-height:1.5']);
    this.empty.textContent = 'No lines yet. Pick the bus or tram tool on the bar '
      + 'and click along the streets to drop stops.';
    this.root.appendChild(this.empty);
  }

  /** Points at the city. Called whenever the world is replaced. */
  bind(read: (() => LinesReading | null) | null): void {
    this.read = read;
    this.builtAt = -1;
  }

  /** Rebuilds when the lines change, and refreshes the live figures always. */
  refresh(): void {
    const r = this.read?.() ?? null;
    if (r === null) return;
    if (r.transit.version !== this.builtAt) {
      this.builtAt = r.transit.version;
      this.build(r);
    }
    this.figures(r);
  }

  private build(r: LinesReading): void {
    this.list.replaceChildren();
    this.empty.style.display = r.transit.lines.length === 0 ? 'block' : 'none';

    for (const line of r.transit.lines) {
      const spec = TRANSIT_SPEC[line.kind];
      const row = document.createElement('div');
      row.dataset.line = String(line.id);
      style(row, ['display:flex', 'align-items:center', 'gap:5px',
        'font-size:12px', 'pointer-events:auto']);

      const chip = document.createElement('span');
      style(chip, ['width:5px', 'height:12px', 'border-radius:1px', 'flex:0 0 auto',
        `background:${spec.colour}`]);

      const name = document.createElement('span');
      style(name, ['flex:1 1 auto', 'min-width:0', 'overflow:hidden',
        'text-overflow:ellipsis', 'white-space:nowrap', `color:${spec.colour}`]);
      name.textContent = `${spec.name} ${line.id}`;

      const detail = document.createElement('span');
      detail.dataset.stat = `line-${line.id}`;
      style(detail, ['flex:0 0 auto', 'color:#8fa3bd', 'white-space:nowrap',
        'font-variant-numeric:tabular-nums']);

      const step = (delta: number, glyph: string, title: string): HTMLButtonElement => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = glyph;
        b.title = title;
        style(b, ['width:17px', 'height:17px', 'padding:0', 'flex:0 0 auto',
          `border-radius:${SKIN.radiusSmall}`, `border:1px solid ${SKIN.edge}`,
          'background:rgba(255,255,255,.05)', `color:${SKIN.text}`,
          'cursor:pointer', 'line-height:1', `font:11px/1 ${SKIN.mono}`]);
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          r.transit.setFleet(line.id, line.fleet + delta);
          this.builtAt = -1;
          this.refresh();
        });
        return b;
      };

      const bin = document.createElement('button');
      bin.type = 'button';
      bin.textContent = '×';
      bin.title = `Remove ${spec.name.toLowerCase()} line ${line.id}`;
      style(bin, ['width:17px', 'height:17px', 'padding:0', 'flex:0 0 auto',
        `border-radius:${SKIN.radiusSmall}`, 'border:1px solid rgba(224,104,90,.35)',
        'background:rgba(224,104,90,.12)', `color:${SKIN.bad}`,
        'cursor:pointer', 'line-height:1', `font:12px/1 ${SKIN.mono}`]);
      bin.addEventListener('click', (e) => {
        e.stopPropagation();
        r.transit.remove(line.id);
        this.builtAt = -1;
        this.refresh();
      });

      row.append(chip, name, detail,
        step(-1, '−', 'One fewer vehicle'), step(1, '+', 'One more vehicle'), bin);
      this.list.appendChild(row);
    }
  }

  /** The numbers on each row, which move without the list being rebuilt. */
  private figures(r: LinesReading): void {
    for (const line of r.transit.lines) {
      const el = this.list.querySelector(`[data-stat="line-${line.id}"]`);
      if (!(el instanceof HTMLElement)) continue;
      const works = r.net.worksOf(line.id);
      const skipped = r.net.skippedOf(line.id);
      const riders = r.net.ridersOf(line.id);
      const weekly = TRANSIT_SPEC[line.kind].weekly * line.fleet;
      el.textContent = !works ? 'no route'
        : `${line.stops.length / 2} stops · ${line.fleet}× · `
          + `${riders.toLocaleString()}/day · ${money(weekly)}/wk`
          + (skipped > 0 ? ` · ${skipped} off-route` : '');
      el.style.color = !works ? SKIN.bad : skipped > 0 ? SKIN.warn : SKIN.dim;
      void MIN_FLEET; void MAX_FLEET;
    }
  }
}
