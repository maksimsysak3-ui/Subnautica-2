/**
 * The challenge card: what the scenario asks, how far the city has got, and
 * how long it has left.
 *
 * Top left, out of the way of the first-steps card in the middle and the
 * notices on the right. A click on the heading folds it to one line, for a
 * player who knows what they are doing and wants the view.
 */

import type { Simulation } from '../sim/agents/sim';
import type { World } from '../sim/world';
import { scenarioById, type ScenarioState } from '../sim/scenarios';
import { DAYS_PER_YEAR } from '../sim/weather';
import { money } from '../sim';
import { SKIN, css, panel } from './skin';

/** Days as the calendar says them: years and months. */
function span(days: number): string {
  if (days <= 0) return 'time is up';
  const years = Math.floor(days / DAYS_PER_YEAR);
  const months = Math.floor((days % DAYS_PER_YEAR) / (DAYS_PER_YEAR / 12));
  if (years === 0 && months === 0) return `${Math.ceil(days)} day${Math.ceil(days) === 1 ? '' : 's'} left`;
  return `${years > 0 ? `${years} yr ` : ''}${months > 0 ? `${months} mo ` : ''}left`;
}

export class ScenarioCard {
  readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly list: HTMLElement;
  private folded = false;
  private shown = false;
  private key = '';

  constructor(host: HTMLElement) {
    this.root = document.createElement('div');
    this.root.dataset.panel = 'scenario';
    css(this.root, panel([
      'position:absolute', 'left:12px', 'top:12px', 'width:min(270px,calc(100vw - 24px))',
      'padding:10px 12px', 'pointer-events:auto', 'display:none', 'flex-direction:column',
      'gap:8px', 'z-index:5',
    ]));
    const head = document.createElement('button');
    head.setAttribute('aria-expanded', 'true');
    css(head, ['display:grid', 'grid-template-columns:1fr auto', 'align-items:baseline', 'gap:8px',
      'background:none', 'border:0', 'padding:0', 'cursor:pointer', 'text-align:left', 'color:inherit']);
    this.title = document.createElement('div');
    css(this.title, ['font:700 13px/1.2 var(--display)', 'letter-spacing:.03em', `color:${SKIN.bright}`]);
    this.clock = document.createElement('div');
    css(this.clock, ['font:600 12px/1 var(--ui)', `color:${SKIN.dim}`, 'font-variant-numeric:tabular-nums']);
    head.append(this.title, this.clock);
    head.addEventListener('click', () => {
      this.folded = !this.folded;
      head.setAttribute('aria-expanded', String(!this.folded));
      this.list.style.display = this.folded ? 'none' : 'flex';
    });
    this.list = document.createElement('div');
    css(this.list, ['display:flex', 'flex-direction:column', 'gap:7px']);
    this.root.append(head, this.list);
    host.appendChild(this.root);
  }

  set visible(on: boolean) {
    this.shown = on;
    this.paintShown(null);
  }

  private paintShown(state: ScenarioState | null | undefined): void {
    const has = state === undefined ? this.root.dataset.has === '1' : state !== null;
    this.root.dataset.has = has ? '1' : '0';
    this.root.style.display = this.shown && has ? 'flex' : 'none';
  }

  /** Reads the city. Called about once a second. */
  update(sim: Simulation, world: World, day: number): void {
    const st = world.scenario;
    this.paintShown(st);
    if (st === null) return;
    const def = scenarioById(st.id);
    if (def === undefined) return;
    this.title.textContent = def.name;
    this.clock.textContent = st.status === 'won' ? 'won' : st.status === 'lost' ? 'time ran out' : span(st.until - day);
    this.clock.style.color = st.status === 'won' ? SKIN.good : st.status === 'lost' || st.until - day < DAYS_PER_YEAR / 4 ? 'var(--amber)' : SKIN.dim;
    const rows = def.objectives.map((o, i) => {
      const [have, need] = o.progress(sim, world);
      return { title: o.title, have, need, unit: o.unit ?? 'count', done: st.met[i] || have >= need };
    });
    const key = rows.map((r) => `${r.title}${Math.round(r.have * 100)}${r.done}`).join('|') + st.status;
    if (key === this.key) return;
    this.key = key;
    this.list.replaceChildren(...rows.map((r) => {
      const row = document.createElement('div');
      css(row, ['display:grid', 'grid-template-columns:1fr auto', 'row-gap:4px', 'column-gap:8px', 'align-items:baseline']);
      const t = document.createElement('div');
      t.textContent = `${r.done ? '✓ ' : ''}${r.title}`;
      css(t, ['font:600 12.5px/1.3 var(--ui)', `color:${r.done ? SKIN.good : SKIN.text}`]);
      const v = document.createElement('div');
      const fmt = (x: number): string => (r.unit === 'share' ? `${Math.round(x * 100)}%` : r.unit === 'money' ? money(x) : Math.round(x).toLocaleString());
      v.textContent = r.need === 1 && r.unit === 'count' ? (r.done ? 'done' : 'not yet') : `${fmt(Math.max(0, r.have))} / ${fmt(r.need)}`;
      css(v, ['font:600 11.5px/1 var(--ui)', `color:${SKIN.dim}`, 'font-variant-numeric:tabular-nums']);
      const track = document.createElement('div');
      css(track, ['grid-column:1 / -1', 'height:4px', 'border-radius:2px', 'background:rgba(255,255,255,.08)', 'overflow:hidden']);
      const fill = document.createElement('div');
      css(fill, ['height:100%', `width:${Math.round(Math.max(0, Math.min(1, r.have / r.need)) * 100)}%`,
        `background:${r.done ? SKIN.good : 'var(--amber)'}`, 'transition:width .6s ease']);
      track.appendChild(fill);
      row.append(t, v, track);
      return row;
    }));
  }
}
