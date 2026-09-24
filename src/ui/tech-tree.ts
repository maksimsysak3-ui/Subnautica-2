/**
 * The development tree: what the city has learned to build, and what is next.
 *
 * Laid out as a branch at a time rather than as one enormous graph. Every
 * builder that ships a tech tree draws the whole thing at once and every one of
 * them is unreadable at a glance; a city has twelve services and a player is
 * thinking about one of them -- the one that is failing -- so the rail on the
 * left picks the branch and the panel draws that branch's line from the root
 * outward, with the buildings each node hands over drawn as themselves.
 *
 * THE CIRCLES HOLD THE BUILDINGS. Each node shows the model it unlocks, taken
 * from the same photographs the build bar uses, so the thing being bought is
 * the thing you can see. A node with nothing bought before it is dimmed to
 * silhouette, so the shape of the branch reads before any of the words do.
 */

import { SKIN, css, panel, label, bar, key as keyStyle, setKey, tip, lockBadge } from './skin';
import { assetIcon, hasIcon } from './icons';
import { glyph as pictogram } from './glyphs';
import { BRANCH_LABEL, BRANCH_ORDER, TECH, TECH_BY_ID, branchLevel } from '../sim/tech';
import { levelName } from '../sim/progress';
import { GOALS } from '../sim/goals';
import type { TechNode } from '../sim/tech';
import { assetById } from '../assets/registry';
import { money, buildingPrice } from '../sim';
import type { Progress } from '../sim/progress';
import { click as clickSound, confirm as confirmSound, deny as denySound } from './sound';

/** The accent each branch is drawn in. */
/** The rail entry that is not a branch. */
const GOALS_PAGE = 'goals';

const BRANCH_TINT: Record<string, string> = {
  power: '#ffd15c', water: '#5cc8ff', sewage: '#8fa9c8', fire: '#ff6b5a',
  police: '#5c8cff', health: '#ff6b9d', education: '#b58cff',
  transport: '#5fd0a8', parks: '#6fd46f', government: '#e0c98a',
  deathcare: '#9aa3b0', post: '#ffa94d',
};

export class TechTree {
  private readonly root: HTMLElement;
  private readonly rail: HTMLElement;
  private readonly board: HTMLElement;
  private readonly side: HTMLElement;
  private readonly stars: HTMLElement;
  private branch = 'power';
  private chosen: TechNode | null = null;
  private shown = false;

  /** Read through, not held: a loaded city brings a new career object. */
  private get progress(): Progress { return this.progressOf(); }

  constructor(parent: HTMLElement, private progressOf: () => Progress,
    private onBuy: (node: TechNode) => void) {
    this.root = document.createElement('div');
    this.root.dataset.panel = 'tech';
    css(this.root, ['position:absolute', 'inset:0', 'z-index:38', 'display:none',
      'align-items:center', 'justify-content:center', 'pointer-events:auto',
      'background:rgba(4,7,11,.58)', 'backdrop-filter:blur(3px)']);
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.close();
    });

    const card = document.createElement('div');
    css(card, [...panel(), 'width:min(1000px, 94vw)', 'height:min(640px, 86vh)',
      'display:flex', 'flex-direction:column', 'overflow:hidden', 'padding:0',
      'box-shadow:0 30px 80px rgba(0,0,0,.6)']);

    // ---- head: what the tree costs and what the city has ----
    const head = document.createElement('div');
    css(head, ['display:flex', 'align-items:center', 'gap:14px',
      'padding:13px 16px', `border-bottom:1px solid ${SKIN.edge}`]);
    const title = document.createElement('div');
    css(title, [...label(), 'font-size:10px', `color:${SKIN.dim}`]);
    title.textContent = 'Development';
    this.stars = document.createElement('div');
    css(this.stars, ['margin-left:auto', 'display:flex', 'align-items:center',
      'gap:7px', `color:${SKIN.bright}`, 'font-size:13px']);
    const shut = document.createElement('button');
    css(shut, ['width:26px', 'height:26px', 'padding:0',
      `border:1px solid ${SKIN.edge}`, `border-radius:${SKIN.radiusSmall}`,
      'background:transparent', `color:${SKIN.dim}`, 'cursor:pointer',
      `font:13px/1 ${SKIN.mono}`]);
    shut.textContent = '×';
    shut.setAttribute('aria-label', 'Close development');
    shut.addEventListener('click', () => this.close());
    head.append(title, this.stars, shut);

    // ---- body: rail, board, detail ----
    const body = document.createElement('div');
    css(body, ['display:flex', 'flex:1', 'min-height:0']);

    this.rail = document.createElement('div');
    css(this.rail, ['display:flex', 'flex-direction:column', 'gap:5px',
      'padding:12px 10px', `border-right:1px solid ${SKIN.edge}`,
      'overflow:auto', 'flex:none']);

    this.board = document.createElement('div');
    css(this.board, ['flex:1', 'position:relative', 'overflow:auto',
      'padding:22px 26px']);

    this.side = document.createElement('div');
    css(this.side, ['width:264px', 'flex:none', 'padding:16px',
      `border-left:1px solid ${SKIN.edge}`, 'display:flex',
      'flex-direction:column', 'gap:10px', 'overflow:auto']);

    body.append(this.rail, this.board, this.side);
    card.append(head, body);
    this.root.appendChild(card);
    parent.appendChild(this.root);

    {
      // Goals first, above the branches: it is the one part of the panel that
      // says what to do next rather than what can be bought.
      const b = document.createElement('button');
      b.dataset.branch = GOALS_PAGE;
      keyStyle(b, SKIN.good, 42);
      const g = document.createElement('span');
      css(g, ['font-size:17px', 'line-height:1']);
      g.textContent = '\u2713';
      b.appendChild(g);
      tip(b, 'Goals \u2014 what the city is being asked to do next');
      b.addEventListener('click', () => {
        this.branch = GOALS_PAGE;
        this.chosen = null;
        clickSound();
        this.paint();
      });
      this.rail.appendChild(b);
    }
    for (const branch of BRANCH_ORDER) {
      if (!TECH.some((n) => n.branch === branch)) continue;
      const b = document.createElement('button');
      b.dataset.branch = branch;
      const tint = BRANCH_TINT[branch] ?? SKIN.accent;
      keyStyle(b, tint, 42);
      // The bar's own pictogram for the branch, so the rail here and the row of
      // service buttons down there are unmistakably the same twelve things.
      const glyph = document.createElement('span');
      glyph.innerHTML = pictogram(branch, 24);
      css(glyph, ['display:flex', `color:${tint}`,
        'filter:drop-shadow(0 1.5px 1.5px rgba(0,0,0,.55))']);
      b.appendChild(glyph);
      tip(b, BRANCH_LABEL[branch] ?? branch);
      b.addEventListener('click', () => {
        this.branch = branch;
        this.chosen = null;
        clickSound();
        this.paint();
      });
      this.rail.appendChild(b);
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.shown) this.close();
    });
  }

  get open(): boolean { return this.shown; }

  toggle(): void { if (this.shown) this.close(); else this.show(); }

  show(): void {
    this.shown = true;
    this.root.style.display = 'flex';
    this.paint();
  }

  close(): void {
    this.shown = false;
    this.root.style.display = 'none';
  }

  /** Repaints if it is open, for when stars are earned while it is up. */
  refresh(): void { if (this.shown) this.paint(); }

  // ---- drawing ---------------------------------------------------------

  private paint(): void {
    // The branch rail: a padlock and the level on every branch not open yet.
    for (const b of Array.from(this.rail.querySelectorAll('[data-branch]')) as HTMLElement[]) {
      const branch = b.dataset.branch ?? '';
      const open = this.progress.level >= branchLevel(branch);
      const glyph = b.firstElementChild as HTMLElement | null;
      if (glyph !== null) { glyph.style.opacity = open ? '' : '0.35'; glyph.style.filter = open ? 'drop-shadow(0 1.5px 1.5px rgba(0,0,0,.55))' : 'grayscale(1)'; }
      b.style.position = 'relative';
      const old = b.querySelector('[data-lock]');
      if (open) old?.remove();
      else if (old === null) b.appendChild(lockBadge(branchLevel(branch)));
    }
    const p = this.progress;
    this.stars.innerHTML = '';
    const star = document.createElement('span');
    css(star, [`color:${SKIN.warn}`, 'font-size:15px']);
    star.textContent = '★';
    const count = document.createElement('span');
    css(count, ['font-variant-numeric:tabular-nums']);
    count.textContent = `${p.stars}`;
    const of = document.createElement('span');
    css(of, [`color:${SKIN.dim}`, 'font-size:11px']);
    of.textContent = `stars · level ${p.level}`;
    this.stars.append(star, count, of);

    for (const b of Array.from(this.rail.children) as HTMLElement[]) {
      const tint = BRANCH_TINT[b.dataset.branch ?? ''] ?? SKIN.accent;
      setKey(b, tint, b.dataset.branch === this.branch);
    }

    if (this.branch === GOALS_PAGE) { this.paintGoals(); return; }
    const nodes = TECH.filter((n) => n.branch === this.branch);
    this.board.innerHTML = '';
    const tint = BRANCH_TINT[this.branch] ?? SKIN.accent;

    const head = document.createElement('div');
    css(head, [...label(), 'font-size:11px', `color:${tint}`, 'margin-bottom:16px']);
    head.textContent = BRANCH_LABEL[this.branch] ?? this.branch;
    this.board.appendChild(head);

    // ---- the fan --------------------------------------------------------
    //
    // One root on the left, and each tier wider than the one before it. Laid
    // out absolutely rather than in a flex row, because the connectors have to
    // run from a parent to a child that may be two rows away -- and a line
    // between two boxes is a line, not a gap between them.
    const tiers: TechNode[][] = [];
    for (const n of nodes) (tiers[n.tier] ??= []).push(n);
    const COL = 150, ROW = 124, PAD = 22;
    const tallest = tiers.reduce((a, t) => Math.max(a, t?.length ?? 0), 1);
    const width = PAD * 2 + Math.max(1, tiers.length) * COL + 40;
    const height = PAD * 2 + tallest * ROW;

    const stage = document.createElement('div');
    css(stage, ['position:relative', `width:${width}px`, `height:${height}px`]);

    const where = new Map<string, [number, number]>();
    for (let t = 0; t < tiers.length; t++) {
      const row = tiers[t] ?? [];
      for (let k = 0; k < row.length; k++) {
        const x = PAD + t * COL + 42;
        const y = PAD + (height - PAD * 2 - row.length * ROW) / 2 + k * ROW + 42;
        where.set(row[k].id, [x, y]);
      }
    }

    // The track, under the nodes: one path per edge, lit when the parent is
    // bought so the shape of what the city has learned reads as a lit path.
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    css(svg as unknown as HTMLElement,
      ['position:absolute', 'left:0', 'top:0', 'pointer-events:none']);
    for (const n of nodes) {
      const to = where.get(n.id);
      if (to === undefined) continue;
      for (const need of n.needs) {
        const from = where.get(need);
        if (from === undefined) continue;
        const lit = this.progress.has(need) || TECH_BY_ID.get(need)?.free === true;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const midX = (from[0] + to[0]) / 2;
        path.setAttribute('d',
          `M ${from[0] + 42} ${from[1]} C ${midX} ${from[1]}, ${midX} ${to[1]}, `
          + `${to[0] - 42} ${to[1]}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', lit ? tint : 'rgba(255,255,255,.10)');
        path.setAttribute('stroke-width', lit ? '3' : '2');
        if (lit) path.setAttribute('filter', 'drop-shadow(0 0 5px ' + tint + ')');
        svg.appendChild(path);
      }
    }
    stage.appendChild(svg as unknown as HTMLElement);

    for (const n of nodes) {
      const at = where.get(n.id);
      if (at === undefined) continue;
      const bubble = this.bubble(n, tint);
      css(bubble, ['position:absolute', `left:${at[0] - 52}px`, `top:${at[1] - 42}px`,
        'display:flex', 'flex-direction:column', 'align-items:center', 'gap:7px',
        'width:104px']);
      stage.appendChild(bubble);
    }
    this.board.appendChild(stage);

    this.paintSide(this.chosen ?? nodes[0] ?? null, tint);
  }

  /**
   * The goals board.
   *
   * Two columns of cards: what is still open, and what has been done. Each
   * carries its own progress against its own target, because "a thousand
   * residents" means nothing without "you have four hundred and twelve".
   */
  private paintGoals(): void {
    this.board.innerHTML = '';
    this.side.innerHTML = '';
    const head = document.createElement('div');
    css(head, [...label(), 'font-size:11px', `color:${SKIN.good}`, 'margin-bottom:16px']);
    head.textContent = 'Goals';
    this.board.appendChild(head);

    const grid = document.createElement('div');
    css(grid, ['display:grid', 'grid-template-columns:repeat(auto-fill,minmax(250px,1fr))',
      'gap:10px']);
    const read = this.readGoal;
    for (const goal of GOALS) {
      const done = this.progress.done.has(goal.id);
      const [now, need] = read !== null ? read(goal.id) : [0, 1];
      const card = document.createElement('div');
      css(card, ['display:flex', 'flex-direction:column', 'gap:7px',
        'padding:12px 13px', `border-radius:${SKIN.radius}`,
        `border:1px solid ${done ? 'rgba(95,199,140,.4)' : SKIN.edge}`,
        `background:${done ? 'rgba(95,199,140,.08)' : 'rgba(255,255,255,.02)'}`]);
      const top = document.createElement('div');
      css(top, ['display:flex', 'align-items:baseline', 'gap:8px']);
      const t = document.createElement('div');
      css(t, [`color:${done ? SKIN.good : SKIN.bright}`, 'font-size:12px']);
      t.textContent = goal.title;
      const xp = document.createElement('div');
      css(xp, [`color:${SKIN.warn}`, 'font-size:10.5px', 'margin-left:auto',
        'font-variant-numeric:tabular-nums']);
      xp.textContent = done ? 'done' : `+${goal.xp} xp`;
      top.append(t, xp);
      const note = document.createElement('div');
      css(note, [`color:${SKIN.dim}`, 'font-size:10.5px', 'line-height:1.45']);
      note.textContent = goal.note;
      const { track, fill } = bar(done ? SKIN.good : SKIN.accent, 4);
      fill.style.width = `${Math.round(100 * Math.min(1, need > 0 ? now / need : 0))}%`;
      const count = document.createElement('div');
      css(count, [`color:${SKIN.faint}`, 'font-size:10px',
        'font-variant-numeric:tabular-nums']);
      count.textContent = done ? '' : `${Math.round(now).toLocaleString()} of `
        + `${need.toLocaleString()}`;
      card.append(top, note, track, count);
      grid.appendChild(card);
    }
    this.board.appendChild(grid);
  }

  /** Reads one goal's progress. Set by whoever has the simulation. */
  readGoal: ((id: string) => [number, number]) | null = null;

  /** One node: the circle, the model in it, the cost under it. */
  private bubble(node: TechNode, tint: string): HTMLElement {
    const p = this.progress;
    const bought = node.free || p.has(node.id);
    // A branch the city is too small to run cannot be bought into, whatever
    // the stars say.
    const levelOk = p.level >= branchLevel(node.branch);
    const ready = !bought && levelOk
      && node.needs.every((id) => p.has(id) || TECH_BY_ID.get(id)?.free);
    const afford = ready && p.stars >= node.cost;

    const wrap = document.createElement('div');

    const circle = document.createElement('button');
    circle.dataset.node = node.id;
    css(circle, ['width:78px', 'height:78px', 'border-radius:78px', 'padding:0',
      'display:grid', 'place-items:center', 'cursor:pointer', 'position:relative',
      `border:2px solid ${bought ? tint : ready ? `${tint}77` : SKIN.edge}`,
      `background:${bought ? `radial-gradient(circle at 50% 30%, ${tint}2e, rgba(8,12,18,.9))`
        : 'radial-gradient(circle at 50% 30%, rgba(255,255,255,.05), rgba(8,12,18,.92))'}`,
      bought ? `box-shadow:0 0 22px ${tint}3a, inset 0 1px 0 rgba(255,255,255,.12)`
        : 'box-shadow:inset 0 1px 0 rgba(255,255,255,.06)',
      'transition:transform .12s, box-shadow .12s']);

    // The building itself, from the same photographs the build bar uses. The
    // rail on the left carries the bar's pictogram for the whole branch; a node
    // is one specific building, so it shows that building.
    const shown = node.assets.find((id) => hasIcon(id));
    if (shown !== undefined) {
      const icon = assetIcon(shown, 60);
      icon.style.opacity = bought ? '1' : ready ? '0.8' : '0.3';
      icon.style.filter = bought ? `drop-shadow(0 0 8px ${tint}44)` : 'grayscale(1)';
      circle.appendChild(icon);
    } else {
      const glyph = document.createElement('span');
      glyph.innerHTML = pictogram(node.branch, 36);
      css(glyph, ['display:flex', `color:${tint}`, `opacity:${bought ? '1' : '0.4'}`]);
      circle.appendChild(glyph);
    }

    // The badge: what it costs, or a tick once it is bought.
    const badge = document.createElement('span');
    css(badge, ['position:absolute', 'bottom:-6px', 'left:50%',
      'transform:translateX(-50%)', 'padding:2px 8px', 'border-radius:10px',
      'font-size:10px', 'display:flex', 'align-items:center', 'gap:3px',
      `border:1px solid ${bought ? tint : SKIN.edge}`,
      `background:${SKIN.panelSolid}`,
      `color:${bought ? tint : afford ? SKIN.warn : SKIN.dim}`]);
    badge.textContent = bought ? 'Unlocked'
      : node.cost === 0 ? 'Free' : `★ ${node.cost}`;
    circle.appendChild(badge);

    circle.addEventListener('pointerenter', () => {
      circle.style.transform = 'translateY(-2px)';
    });
    circle.addEventListener('pointerleave', () => {
      circle.style.transform = 'translateY(0)';
    });
    circle.addEventListener('click', () => {
      this.chosen = node;
      clickSound();
      this.paint();
    });

    const name = document.createElement('div');
    css(name, [`color:${bought ? SKIN.bright : SKIN.dim}`, 'font-size:10px',
      'text-align:center', 'line-height:1.3', 'max-width:104px']);
    name.textContent = node.name;

    wrap.append(circle, name);
    return wrap;
  }

  /** The panel on the right: what this node is and the button that buys it. */
  private paintSide(node: TechNode | null, tint: string): void {
    this.side.innerHTML = '';
    if (node === null) return;
    const p = this.progress;
    const bought = node.free || p.has(node.id);
    const opens = branchLevel(node.branch);
    const levelOk = p.level >= opens;
    const ready = levelOk && node.needs.every((id) => p.has(id) || TECH_BY_ID.get(id)?.free);
    const afford = p.stars >= node.cost;

    const name = document.createElement('div');
    css(name, [`color:${SKIN.bright}`, 'font-size:14px', 'line-height:1.3']);
    name.textContent = node.name;
    const branch = document.createElement('div');
    css(branch, [...label(), 'font-size:9px', `color:${tint}`]);
    branch.textContent = BRANCH_LABEL[node.branch] ?? node.branch;
    const blurb = document.createElement('div');
    css(blurb, [`color:${SKIN.text}`, 'font-size:11px', 'line-height:1.5']);
    blurb.textContent = node.blurb;
    this.side.append(branch, name, blurb);

    const list = document.createElement('div');
    css(list, ['display:flex', 'flex-direction:column', 'gap:7px',
      'margin-top:4px']);
    for (const id of node.assets) {
      const def = assetById(id);
      if (def === undefined) continue;
      const row = document.createElement('div');
      css(row, ['display:flex', 'align-items:center', 'gap:9px']);
      const icon = assetIcon(id, 34);
      icon.style.opacity = bought ? '1' : '0.5';
      const text = document.createElement('div');
      css(text, ['display:flex', 'flex-direction:column', 'gap:2px', 'flex:1',
        'min-width:0']);
      const t = document.createElement('div');
      css(t, [`color:${SKIN.bright}`, 'font-size:11px']);
      t.textContent = def.name;
      const price = document.createElement('div');
      css(price, [`color:${SKIN.dim}`, 'font-size:10px']);
      price.textContent = `${money(buildingPrice(def))} to build`
        + (def.sim.upkeep > 0 ? ` · ${money(def.sim.upkeep * 45)}/wk` : '');
      text.append(t, price);
      row.append(icon, text);
      list.appendChild(row);
    }
    this.side.appendChild(list);

    const buy = document.createElement('button');
    css(buy, ['margin-top:auto', 'padding:11px 14px', `border-radius:${SKIN.radius}`,
      'cursor:pointer', 'font-size:12px', `font-family:${SKIN.mono}`,
      `border:1px solid ${bought ? SKIN.edge : afford && ready ? tint : SKIN.edge}`,
      `background:${bought ? 'transparent' : afford && ready ? `${tint}22` : 'transparent'}`,
      `color:${bought ? SKIN.dim : afford && ready ? SKIN.bright : SKIN.faint}`]);
    buy.textContent = bought ? 'Already unlocked'
      : !levelOk ? `Opens at level ${opens} \u2014 ${levelName(opens).toLowerCase()}`
      : !ready ? 'Unlock what comes before it'
        : afford ? `Unlock for ★ ${node.cost}`
          : `Needs ★ ${node.cost} — you have ${p.stars}`;
    buy.disabled = bought || !ready || !afford;
    buy.addEventListener('click', () => {
      if (!p.buy(node.id, node.cost)) { denySound(); return; }
      confirmSound();
      this.onBuy(node);
      this.paint();
    });
    this.side.appendChild(buy);
  }
}
