/**
 * The team menu: found a club, then run it.
 *
 * Opened from a stadium or arena's card. Before there is a club it is the
 * founding form -- a name, a sport the venue suits, the colours; after, five
 * tabs: the club at a glance, the squad, the transfer market, the fixtures,
 * and the league table.
 */

import { SKIN, panel, label, css } from './skin';
import { SPORTS, FOUNDING_COST, VENUE_SEATS, sportById, venueName, ordinal } from '../sim/sports';
import type { Sports } from '../sim/sports';
import type { Budget } from '../sim/budget';
import type { Newsroom } from '../sim/news';
import { money } from '../sim/costs';

export interface TeamHost {
  sports(): Sports;
  budget(): Budget;
  news(): Newsroom;
  day(): number;
  /** The sports venues the city has built, by asset id. */
  venues(): string[];
}

const COLOURS = ['#c8102e', '#1d4ed8', '#15803d', '#f59e0b', '#7c3aed', '#0f172a', '#ea580c', '#0891b2'];
type Tab = 'club' | 'squad' | 'market' | 'fixtures' | 'league';

export class TeamPanel {
  private root: HTMLElement;
  private body!: HTMLElement;
  private tab: Tab = 'club';
  private shown = false;
  private sport = 'football';
  private colour = COLOURS[0];
  private note = '';

  constructor(parent: HTMLElement, private host: TeamHost) {
    this.root = document.createElement('div');
    this.root.dataset.panel = 'team';
    css(this.root, [...panel(), 'position:absolute', 'left:50%', 'top:50%', 'transform:translate(-50%,-50%)',
      'width:min(680px,calc(100vw - 32px))', 'max-height:calc(100vh - 80px)', 'overflow:auto',
      'padding:16px 18px', 'z-index:40', 'display:none', 'pointer-events:auto']);
    parent.appendChild(this.root);
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.shown) { e.stopImmediatePropagation(); this.close(); }
    }, true);
  }

  get open(): boolean { return this.shown; }

  show(): void {
    this.shown = true;
    this.note = '';
    this.root.style.display = 'block';
    this.draw();
  }

  close(): void {
    this.shown = false;
    this.root.style.display = 'none';
  }

  /** Redraws, if open: after a game, so the record on screen is the record. */
  refresh(): void { if (this.shown) this.draw(); }

  private el(tag: string, text = '', decls: string[] = []): HTMLElement {
    const e = document.createElement(tag);
    if (text !== '') e.textContent = text;
    if (decls.length > 0) css(e, decls);
    return e;
  }

  private button(text: string, on: () => void, primary = false, disabled = false): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = text;
    b.disabled = disabled;
    css(b, ['font:600 12px/1 var(--label)', 'padding:7px 11px', `border-radius:${SKIN.radiusSmall}`,
      `border:1px solid ${primary ? 'transparent' : SKIN.edge}`, 'cursor:pointer',
      `background:${primary ? SKIN.accent : 'rgba(255,255,255,.05)'}`,
      `color:${primary ? '#0b1320' : SKIN.bright}`, disabled ? 'opacity:.45' : '']);
    b.addEventListener('click', (e) => { e.stopPropagation(); on(); });
    return b;
  }

  private draw(): void {
    const t = this.host.sports().team;
    this.root.replaceChildren();
    const head = this.el('div', '', ['display:flex', 'align-items:center', 'gap:10px', 'margin-bottom:12px']);
    const badge = this.el('div', '', ['width:30px', 'height:30px', 'border-radius:50%', 'flex:none',
      `background:${t?.colour ?? this.colour}`, 'box-shadow:inset 0 0 0 3px rgba(255,255,255,.25)']);
    const title = this.el('div', t === null ? 'Found a club' : t.name,
      ['flex:1', `color:${SKIN.bright}`, 'font:700 17px/1.2 var(--label)']);
    head.append(badge, title, this.button('Close', () => this.close()));
    this.root.appendChild(head);
    if (this.note !== '') {
      this.root.appendChild(this.el('div', this.note, ['margin-bottom:10px', `color:${SKIN.warn}`, 'font:500 12.5px/1.4 var(--ui)']));
    }
    this.body = this.el('div', '', ['display:flex', 'flex-direction:column', 'gap:10px']);
    this.root.appendChild(this.body);
    if (t === null) { this.founding(); return; }

    const tabs = this.el('div', '', ['display:flex', 'gap:6px', 'flex-wrap:wrap', 'margin-bottom:4px']);
    const names: Array<[Tab, string]> = [['club', 'Club'], ['squad', 'Squad'], ['market', 'Transfers'], ['fixtures', 'Fixtures'], ['league', 'League']];
    for (const [k, n] of names) tabs.appendChild(this.button(n, () => { this.tab = k; this.note = ''; this.draw(); }, this.tab === k));
    this.body.appendChild(tabs);
    ({ club: () => this.club(), squad: () => this.squad(), market: () => this.market(), fixtures: () => this.fixtures(), league: () => this.league() })[this.tab]();
  }

  private founding(): void {
    const venues = this.host.venues();
    const intro = this.el('div', `A professional club of the city's own, playing at your ${venues.length > 0 ? venues.map(venueName).join(' / ') : 'stadium'}. `
      + `Founding costs ${money(FOUNDING_COST)}; the club pays wages every game and takes the gate at home.`,
    [`color:${SKIN.text}`, 'font:500 13px/1.5 var(--ui)']);
    this.body.appendChild(intro);

    this.body.appendChild(this.el('div', 'Name', label()));
    const name = document.createElement('input');
    name.value = 'City United';
    name.maxLength = 32;
    css(name, ['font:600 14px/1 var(--ui)', 'padding:8px 10px', `border:1px solid ${SKIN.edge}`,
      `border-radius:${SKIN.radiusSmall}`, 'background:rgba(0,0,0,.25)', `color:${SKIN.bright}`]);
    this.body.appendChild(name);

    this.body.appendChild(this.el('div', 'Sport', label()));
    const sports = this.el('div', '', ['display:grid', 'grid-template-columns:repeat(auto-fill,minmax(180px,1fr))', 'gap:6px']);
    for (const s of SPORTS) {
      const fits = s.venues.some((v) => venues.includes(v));
      const b = this.button(`${s.name}${fits ? '' : ` — needs ${venueName(s.venues[0])}`}`, () => { this.sport = s.id; this.draw(); },
        this.sport === s.id, !fits);
      b.style.textAlign = 'left';
      sports.appendChild(b);
    }
    this.body.appendChild(sports);

    this.body.appendChild(this.el('div', 'Colours', label()));
    const swatches = this.el('div', '', ['display:flex', 'gap:8px']);
    for (const c of COLOURS) {
      const sw = this.el('button', '', ['width:26px', 'height:26px', 'border-radius:50%', 'cursor:pointer', `background:${c}`,
        `border:2px solid ${c === this.colour ? SKIN.bright : 'transparent'}`]);
      sw.addEventListener('click', () => { this.colour = c; this.draw(); });
      swatches.appendChild(sw);
    }
    this.body.appendChild(swatches);

    const go = this.button(`Found the club — ${money(FOUNDING_COST)}`, () => {
      const why = this.host.sports().found(name.value, this.sport, this.colour, venues, this.host.day(), this.host.budget(), this.host.news());
      this.note = why ?? '';
      this.tab = 'club';
      this.draw();
    }, true);
    this.body.appendChild(go);
  }

  private row(cells: Array<string | HTMLElement>, head = false, us = false): HTMLElement {
    const r = this.el('div', '', ['display:grid', `grid-template-columns:${cells.length === 7 ? '30px 1fr 44px 40px 54px 60px 78px' : cells.length === 6 ? '34px 1fr 46px 46px 70px 80px' : `repeat(${cells.length},1fr)`}`,
      'gap:6px', 'align-items:center', 'padding:4px 6px', `border-radius:${SKIN.radiusSmall}`,
      us ? 'background:rgba(106,174,232,.14)' : '', head ? `color:${SKIN.dim}` : `color:${SKIN.text}`,
      head ? 'font:600 10.5px/1.3 var(--label);letter-spacing:.1em;text-transform:uppercase' : 'font:500 12.5px/1.3 var(--ui)',
      'font-variant-numeric:tabular-nums']);
    for (const c of cells) r.appendChild(typeof c === 'string' ? this.el('span', c) : c);
    return r;
  }

  private club(): void {
    const s = this.host.sports(), t = s.team!;
    const def = sportById(t.sport)!;
    const pos = s.table().findIndex((r) => r.us) + 1;
    const facts: Array<[string, string]> = [
      ['Sport', def.name], ['Season', `${t.season} — round ${Math.min(t.round + 1, s.rounds)} of ${s.rounds}`],
      ['Record', `${t.w}–${t.d}–${t.l}${def.draws ? '' : ' (W–D–L)'}`], ['League position', ordinal(pos)],
      ['Team strength', Math.round(s.strength()).toString()], ['Following', `${Math.round(t.support * 100)}% of the city`],
      ['Home ground', `${venueName(t.venue)}, ${(VENUE_SEATS[t.venue] ?? 0).toLocaleString()} seats`],
      ['Wage bill', `${money(s.wages())} a game`],
      ['Mood in the city', (() => { const m = s.mood(); return m > 0.2 ? `lifted by the form (+${m.toFixed(1)})` : m < -0.2 ? `dampened by the form (${m.toFixed(1)})` : 'no effect yet'; })()], ['Titles', `${t.titles}${t.bestFinish > 0 ? ` · best finish ${ordinal(t.bestFinish)}` : ''}`],
      ['Next game', `${t.round % 2 === 0 ? 'home to' : 'away at'} ${t.rivals[t.round % t.rivals.length]?.name ?? '—'}, day ${t.next}`],
    ];
    const grid = this.el('div', '', ['display:grid', 'grid-template-columns:auto 1fr', 'gap:5px 16px']);
    for (const [k, v] of facts) {
      grid.appendChild(this.el('span', k, label(['align-self:center'])));
      grid.appendChild(this.el('span', v, [`color:${SKIN.bright}`, 'font:600 13px/1.3 var(--ui)']));
    }
    this.body.appendChild(grid);

    const price = this.el('div', '', ['display:flex', 'align-items:center', 'gap:8px', 'margin-top:6px']);
    price.appendChild(this.el('span', 'Ticket price', label()));
    price.appendChild(this.button('−', () => { s.setTicket(t.ticket - 2); this.draw(); }));
    price.appendChild(this.el('span', money(t.ticket), [`color:${SKIN.bright}`, 'font:700 14px/1 var(--ui)', 'min-width:48px', 'text-align:center']));
    price.appendChild(this.button('+', () => { s.setTicket(t.ticket + 2); this.draw(); }));
    price.appendChild(this.el('span', 'Cheaper fills the ground; dearer earns more a seat.', [`color:${SKIN.dim}`, 'font:500 12px/1.3 var(--ui)']));
    this.body.appendChild(price);

    if (t.history.length > 0) {
      this.body.appendChild(this.el('div', 'Past seasons', label(['margin-top:8px'])));
      for (const h of t.history.slice(0, 6)) {
        this.body.appendChild(this.el('div', `Season ${h.season}: ${ordinal(h.finish)} — ${h.w}–${h.d}–${h.l}`, [`color:${SKIN.text}`, 'font:500 12.5px/1.4 var(--ui)']));
      }
    }
  }

  private squad(): void {
    const s = this.host.sports(), t = s.team!;
    const def = sportById(t.sport)!;
    this.body.appendChild(this.el('div', `${t.roster.length} players · the best ${def.lineup} start`, [`color:${SKIN.dim}`, 'font:500 12px/1.3 var(--ui)']));
    this.body.appendChild(this.row(['#', 'Player', 'Pos', 'Age', 'Rating', 'Wage', ''], true));
    const order = t.roster.map((p, i) => ({ p, i })).sort((a, b) => b.p.rating - a.p.rating);
    const starters = new Set(order.slice(0, def.lineup).map((o) => o.i));
    for (const { p, i } of order) {
      this.body.appendChild(this.row([String(p.number), `${p.name}${starters.has(i) ? '' : ' (bench)'}`, p.pos, String(p.age),
        String(Math.round(p.rating)), money(p.wage),
        this.button('Release', () => { this.note = s.release(i) ?? ''; this.draw(); })], false, starters.has(i)));
    }
  }

  private market(): void {
    const s = this.host.sports(), t = s.team!;
    this.body.appendChild(this.el('div', 'Players other clubs would sell. A new list every season.', [`color:${SKIN.dim}`, 'font:500 12px/1.3 var(--ui)']));
    this.body.appendChild(this.row(['#', 'Player', 'Pos', 'Age', 'Rating', 'Fee', ''], true));
    t.market.forEach((p, i) => {
      this.body.appendChild(this.row([String(p.number), p.name, p.pos, String(p.age), String(Math.round(p.rating)), money(s.fee(p)),
        this.button('Sign', () => { this.note = s.sign(i, this.host.budget()) ?? ''; this.draw(); }, true)]));
    });
    if (t.market.length === 0) this.body.appendChild(this.el('div', 'Nobody left to sign this season.', [`color:${SKIN.dim}`]));
  }

  private fixtures(): void {
    const t = this.host.sports().team!;
    if (t.games.length === 0) { this.body.appendChild(this.el('div', 'No games played yet.', [`color:${SKIN.dim}`])); return; }
    this.body.appendChild(this.row(['Day', 'Opponent', 'H/A', 'Score', 'Crowd', 'Gate'], true));
    for (const g of t.games) {
      const res = g.us > g.them ? 'W' : g.us < g.them ? 'L' : 'D';
      this.body.appendChild(this.row([String(g.day), g.opponent, g.home ? 'H' : 'A', `${res} ${g.us}–${g.them}`,
        g.home ? g.crowd.toLocaleString() : '—', g.home ? money(g.gate) : '—']));
    }
  }

  private league(): void {
    const s = this.host.sports();
    this.body.appendChild(this.row(['', 'Club', 'W', 'D', 'L', '+/−', 'Pts'], true));
    s.table().forEach((r, i) => {
      this.body.appendChild(this.row([String(i + 1), r.name, String(r.w), String(r.d), String(r.l),
        String(r.pf - r.pa), String(r.pts)], false, r.us));
    });
  }
}
