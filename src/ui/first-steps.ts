/**
 * First steps: the handful of things every new town needs, in order, ticked off
 * as the city actually does them.
 *
 * A new player zones a street of houses, watches them go up, and a week later
 * watches them come down again -- because nobody has power or water, and the
 * lifecycle model does exactly what it should with a building nobody supplies.
 * Nothing on screen said so. The goals list names the milestones, but it does
 * not say that the first four things a town needs are housing, electricity,
 * water and drainage, and that the houses will not wait for the rest.
 *
 * Each step reads the simulation rather than counting clicks, so a step done by
 * a loaded save, or undone by a bulldozer, shows the truth. The card retires
 * itself a few seconds after the last one is done.
 */

import type { Simulation } from '../sim/agents/sim';
import type { Network } from '../sim/agents/utilities';
import { SKIN, css, panel } from './skin';

interface Step {
  title: string;
  how: string;
  done: (sim: Simulation) => boolean;
}

/**
 * Whether anything in the city is actually producing a utility.
 *
 * Not the supply margin: with nothing drawing on a network the margin reads
 * as satisfied, so a brand-new city with no plant and no pump ticked power,
 * water and sewage off before the player had built anything.
 */
function made(sim: Simulation, of: (n: Network) => number): boolean {
  for (const n of sim.utilities.networks) if (of(n) > 0) return true;
  return false;
}

const STEPS: readonly Step[] = [
  {
    title: 'Zone housing beside the road',
    how: 'Open Zoning, pick Residential, and drag along a street you own.',
    done: (sim) => sim.places.homeCapacity > 0,
  },
  {
    title: 'Switch on the power',
    how: 'Electricity: a wind turbine or a small plant. The mains follow the roads.',
    done: (sim) => made(sim, (n) => n.powerMade),
  },
  {
    title: 'Pump fresh water',
    how: 'Water & sewage: a pumping station on the river bank.',
    done: (sim) => made(sim, (n) => n.waterMade),
  },
  {
    title: 'Treat the sewage',
    how: 'Water & sewage: a treatment works, downstream of the pump.',
    done: (sim) => made(sim, (n) => n.sewageTreated),
  },
  {
    title: 'Give people somewhere to work',
    how: 'Zone commercial or industrial land within reach of the houses.',
    done: (sim) => {
      for (const n of sim.places.staffed) if (n > 0) return true;
      return false;
    },
  },
  {
    title: 'Reach a hundred residents',
    how: 'Keep supply ahead of the houses and they will keep coming.',
    done: (sim) => sim.people.population >= 100,
  },
];

export class FirstSteps {
  readonly root: HTMLElement;
  private rows: HTMLElement[] = [];
  private shown = false;
  private finishedAt = 0;
  private dismissed = false;
  private last = '';

  constructor(host: HTMLElement) {
    this.root = document.createElement('div');
    css(this.root, panel([
      // Top centre: the left edge belongs to the information panels, the
      // right to the notices, and a card over either hides what it covers.
      'position:absolute', 'left:50%', 'top:12px', 'width:min(300px,calc(100vw - 24px))',
      'margin-left:calc(min(300px,calc(100vw - 24px)) / -2)',
      'padding:12px 14px 10px', 'pointer-events:auto', 'display:none',
      'flex-direction:column', 'gap:8px', 'z-index:6',
      'transition:opacity .6s ease, transform .6s ease',
    ]));
    const head = document.createElement('div');
    css(head, ['display:flex', 'align-items:center', 'justify-content:space-between', 'gap:8px']);
    const title = document.createElement('div');
    title.textContent = 'First steps';
    css(title, ['font:700 16px/1 var(--display)', 'letter-spacing:.12em',
      'text-transform:uppercase', `color:${SKIN.bright}`]);
    const close = document.createElement('button');
    close.textContent = 'Hide';
    close.setAttribute('aria-label', 'Hide first steps');
    css(close, ['background:none', 'border:0', 'cursor:pointer', 'padding:2px 4px',
      'font:600 10px/1 var(--label)', 'letter-spacing:.18em', 'text-transform:uppercase',
      `color:${SKIN.dim}`]);
    close.addEventListener('click', () => { this.dismissed = true; this.root.style.display = 'none'; });
    head.append(title, close);
    this.root.appendChild(head);

    for (const step of STEPS) {
      const row = document.createElement('div');
      css(row, ['display:grid', 'grid-template-columns:18px 1fr', 'column-gap:8px',
        'align-items:start']);
      const tick = document.createElement('div');
      css(tick, ['width:14px', 'height:14px', 'margin-top:1px', 'border-radius:50%',
        `border:1.5px solid ${SKIN.faint}`, 'display:grid', 'place-items:center',
        'font:700 10px/1 var(--ui)', 'color:#0a0e14', 'transition:all .3s ease']);
      const text = document.createElement('div');
      const t = document.createElement('div');
      t.textContent = step.title;
      css(t, ['font:600 13px/1.3 var(--ui)', `color:${SKIN.text}`]);
      const how = document.createElement('div');
      how.textContent = step.how;
      css(how, ['font:500 12px/1.4 var(--ui)', `color:${SKIN.dim}`, 'margin-top:2px',
        'display:none']);
      text.append(t, how);
      row.append(tick, text);
      this.root.appendChild(row);
      this.rows.push(row);
    }
    host.appendChild(this.root);
  }

  set visible(on: boolean) {
    this.shown = on;
    this.root.style.display = on && !this.dismissed && this.finishedAt === 0 ? 'flex' : 'none';
  }

  /** Starts over for a new city. */
  reset(): void {
    this.dismissed = false;
    this.finishedAt = 0;
    this.last = '';
    this.root.style.opacity = '1';
    this.root.style.transform = 'none';
    this.visible = this.shown;
  }

  /** Reads the city. Cheap; called at the same cadence as the notices. */
  update(sim: Simulation, now: number): void {
    if (this.dismissed) return;
    if (this.finishedAt !== 0) {
      return;
    }
    const done = STEPS.map((s) => s.done(sim));
    const key = done.map((d) => (d ? '1' : '0')).join('');
    if (key === this.last) return;
    this.last = key;
    // The first step not yet done is the one to do now: it shows how.
    const next = done.indexOf(false);
    this.rows.forEach((row, i) => {
      const tick = row.children[0] as HTMLElement;
      const text = row.children[1] as HTMLElement;
      const title = text.children[0] as HTMLElement;
      const how = text.children[1] as HTMLElement;
      tick.textContent = done[i] ? '✓' : '';
      tick.style.background = done[i] ? SKIN.good : 'transparent';
      tick.style.borderColor = done[i] ? SKIN.good : i === next ? 'var(--amber)' : SKIN.faint;
      title.style.color = done[i] ? SKIN.dim : i === next ? SKIN.bright : SKIN.text;
      title.style.textDecoration = done[i] ? 'line-through' : 'none';
      how.style.display = i === next ? 'block' : 'none';
    });
    if (next === -1) {
      // A moment to see the last tick land, then out of the way.
      this.finishedAt = now;
      setTimeout(() => {
        this.root.style.opacity = '0';
        this.root.style.transform = 'translateY(-6px)';
      }, 2600);
      setTimeout(() => { this.root.style.display = 'none'; }, 3400);
    }
  }
}
