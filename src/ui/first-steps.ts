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
import type { World } from '../sim/world';
import { TAX_NEUTRAL } from '../sim/budget';
import { TECH_BY_ID } from '../sim/tech';
import { BRANCHES } from '../assets/types';

/** What the steps can read beyond the simulation. */
export interface StepContext {
  world: World;
  /** Whether the player has opened an information view this session. */
  viewed: boolean;
}
import { SKIN, css, panel } from './skin';

interface Step {
  title: string;
  how: string;
  done: (sim: Simulation, ctx: StepContext) => boolean;
}

interface Chapter { name: string; steps: readonly Step[] }

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

/** Buildings of a service branch standing in the city. */
function standing(sim: Simulation, branch: string): number {
  const b = BRANCHES.indexOf(branch as never);
  return b < 0 ? 0 : sim.places.byBranch[b]?.size ?? 0;
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

/**
 * The chapters after the first: what a town needs to learn next, taught when
 * it is next needed rather than all at once on the first screen.
 */
const CHAPTERS: readonly Chapter[] = [
  { name: 'First steps', steps: STEPS },
  {
    name: 'A growing town',
    steps: [
      { title: 'Read the city through a view',
        how: 'Press V, or the chart button bottom-left, and pick one: power, water, desirability...',
        done: (_s, c) => c.viewed },
      { title: 'Set a tax rate',
        how: 'Open the Budget view and drag a slider. Industry pays the most; people notice residential.',
        done: (_s, c) => Array.from(c.world.budget.rates).some((r) => Math.abs(r - TAX_NEUTRAL) > 0.004) },
      { title: 'Spend a development star',
        how: 'Press T, or click the level ring, and unlock something in a branch.',
        done: (_s, c) => [...c.world.progress.bought].some((id) => TECH_BY_ID.get(id)?.free !== true) },
      { title: 'Reach a thousand residents',
        how: 'Around here fires and emergencies start. Keep zoning what the demand bars ask for.',
        done: (sim) => sim.people.population >= 1000 },
    ],
  },
  {
    name: 'Becoming a city',
    steps: [
      { title: 'Build a fire station',
        how: 'Fire opens at level 2. A station covers the streets around it -- see the Fire view.',
        done: (sim) => standing(sim, 'fire') > 0 },
      { title: 'Build a clinic',
        how: 'Health opens at level 3. Emergencies nobody reaches in time cost lives.',
        done: (sim) => standing(sim, 'health') > 0 },
      { title: 'Pass a policy',
        how: 'In the Budget view, open Policies and switch one on. Each has a cost and a catch.',
        done: (_s, c) => c.world.policies.active > 0 },
      { title: 'Reach five thousand residents',
        how: 'City Hall opens on the phone (C): elections, candidates and a platform to write.',
        done: (sim) => sim.people.population >= 5000 },
    ],
  },
  {
    name: 'Running the city',
    steps: [
      { title: 'Write your candidate\u2019s platform',
        how: 'Phone, City Hall: pick up to three pledges. If you win, they become law.',
        done: (_s, c) => (c.world.politics.yours?.pledges.length ?? 0) > 0 },
      { title: 'Draw a bus or tram line',
        how: 'Transport opens at level 8. Click stops along the streets, Enter to close the loop.',
        done: (_s, c) => c.world.transit.lines.length > 0 },
      { title: 'Win an election',
        how: 'Hold rallies, fix what voters complain about, and pick pledges that answer it.',
        done: (_s, c) => c.world.politics.mayor?.player === true },
    ],
  },
];

export class FirstSteps {
  readonly root: HTMLElement;
  private readonly heading: HTMLElement;
  private readonly list: HTMLElement;
  private rows: HTMLElement[] = [];
  private shown = false;
  private dismissed = false;
  private last = '';
  /** Which chapter is on the card, and whether it is between chapters. */
  private chapter = -1;
  private turning = false;
  private finished = false;

  constructor(host: HTMLElement) {
    this.root = document.createElement('div');
    css(this.root, panel([
      // Top centre: the left edge belongs to the information panels, the
      // right to the notices, and a card over either hides what it covers.
      'position:absolute', 'left:50%', 'top:12px', 'width:min(320px,calc(100vw - 24px))',
      'margin-left:calc(min(320px,calc(100vw - 24px)) / -2)',
      'padding:12px 14px 10px', 'pointer-events:auto', 'display:none',
      'flex-direction:column', 'gap:8px', 'z-index:6',
      'transition:opacity .6s ease, transform .6s ease',
    ]));
    const head = document.createElement('div');
    css(head, ['display:flex', 'align-items:center', 'justify-content:space-between', 'gap:8px']);
    this.heading = document.createElement('div');
    css(this.heading, ['font:700 16px/1 var(--display)', 'letter-spacing:.12em',
      'text-transform:uppercase', `color:${SKIN.bright}`]);
    const close = document.createElement('button');
    close.textContent = 'Hide';
    close.setAttribute('aria-label', 'Hide the guide');
    css(close, ['background:none', 'border:0', 'cursor:pointer', 'padding:2px 4px',
      'font:600 12px/1 var(--label)', 'letter-spacing:.18em', 'text-transform:uppercase',
      `color:${SKIN.dim}`]);
    close.addEventListener('click', () => { this.dismissed = true; this.root.style.display = 'none'; });
    head.append(this.heading, close);
    this.list = document.createElement('div');
    css(this.list, ['display:flex', 'flex-direction:column', 'gap:8px']);
    this.root.append(head, this.list);
    host.appendChild(this.root);
  }

  /** Lays out one chapter's rows. */
  private open(n: number): void {
    this.chapter = n;
    this.last = '';
    const ch = CHAPTERS[n];
    this.heading.textContent = ch.name;
    this.list.replaceChildren();
    this.rows = [];
    for (const step of ch.steps) {
      const row = document.createElement('div');
      css(row, ['display:grid', 'grid-template-columns:18px 1fr', 'column-gap:8px',
        'align-items:start']);
      const tick = document.createElement('div');
      css(tick, ['width:14px', 'height:14px', 'margin-top:1px', 'border-radius:50%',
        `border:1.5px solid ${SKIN.faint}`, 'display:grid', 'place-items:center',
        'font:700 12px/1 var(--ui)', 'color:#0a0e14', 'transition:all .3s ease']);
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
      this.list.appendChild(row);
      this.rows.push(row);
    }
  }

  set visible(on: boolean) {
    this.shown = on;
    this.root.style.display = on && !this.dismissed && !this.finished ? 'flex' : 'none';
  }

  /** Starts over for a new city. */
  reset(): void {
    this.dismissed = false;
    this.finished = false;
    this.turning = false;
    this.chapter = -1;
    this.root.style.opacity = '1';
    this.root.style.transform = 'none';
    this.visible = this.shown;
  }

  /** Reads the city. Cheap; called at the same cadence as the notices. */
  update(sim: Simulation, now: number, ctx: StepContext): void {
    void now;
    if (this.dismissed || this.finished || this.turning) return;
    if (this.chapter < 0) {
      // A loaded city starts at the first chapter it has not finished.
      let n = 0;
      while (n < CHAPTERS.length - 1 && CHAPTERS[n].steps.every((st) => st.done(sim, ctx))) n++;
      this.open(n);
    }
    const steps = CHAPTERS[this.chapter].steps;
    const done = steps.map((st) => st.done(sim, ctx));
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
      tick.textContent = done[i] ? '\u2713' : '';
      tick.style.background = done[i] ? SKIN.good : 'transparent';
      tick.style.borderColor = done[i] ? SKIN.good : i === next ? 'var(--amber)' : SKIN.faint;
      title.style.color = done[i] ? SKIN.dim : i === next ? SKIN.bright : SKIN.text;
      title.style.textDecoration = done[i] ? 'line-through' : 'none';
      how.style.display = i === next ? 'block' : 'none';
    });
    if (next !== -1) return;
    // A moment to see the last tick land, then the next chapter -- or, after
    // the last one, out of the way for good.
    this.turning = true;
    const last = this.chapter >= CHAPTERS.length - 1;
    setTimeout(() => {
      this.root.style.opacity = '0';
      this.root.style.transform = 'translateY(-6px)';
    }, 2600);
    setTimeout(() => {
      this.turning = false;
      if (last) { this.finished = true; this.root.style.display = 'none'; return; }
      this.open(this.chapter + 1);
      this.root.style.opacity = '1';
      this.root.style.transform = 'none';
    }, 3400);
  }
}
