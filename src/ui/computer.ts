/**
 * The City Hall computer: the mayor's desk, where the city is governed from.
 *
 * The phone is for looking at the city as its residents do -- the feed and
 * the weather. This is for running it. Seven programs on one machine:
 *
 *   Overview   the city at a glance, and what is waiting for a decision;
 *   Herald     the city's paper, everything it has been through;
 *   Council    the chamber, the laws in force and the bills to table;
 *   Voters     the six blocs and what each thinks of the administration;
 *   Inbox      petitions, each a decision with a price either way;
 *   Stats      the accounts (moved here from the phone);
 *   Elections  the mayoral race (moved here from the phone).
 *
 * Everything it shows is read from the world on open and on a slow beat
 * while open, and only repainted when something it shows has changed, so it
 * costs nothing while the player is looking at the city.
 */

import { glyph } from './glyphs';
import { click as clickSound, deny } from './sound';
import { tip } from './skin';
import { money } from '../sim';
import type { World } from '../sim/world';
import {
  BILLS, BLOCS, COUNCIL_PARTIES, COUNCIL_POPULATION, COMMITTEE_DAYS, LOBBY_COST, LOBBY_MAX,
  PROTEST_BELOW, billById, petitionById, Council,
} from '../sim/council';
import type { BillDef } from '../sim/council';
import type { NewsDesk, Story } from '../sim/news';
import { monthOf, yearOf } from '../sim/weather';
import type { CityHall } from './city-hall';
import type { StatsApp } from './stats-app';

export type DeskApp = 'home' | 'news' | 'council' | 'voters' | 'inbox' | 'stats' | 'hall';

export interface DeskHost {
  world(): World;
  /** False before a city is running. */
  live(): boolean;
  cityName(): string;
  /** Game days, with the fraction. */
  day(): number;
  population(): number;
  happiness(): number;
  net(): number;
}

const APPS: ReadonlyArray<[DeskApp, string, string]> = [
  ['home', 'Overview', 'views'],
  ['news', 'Herald', 'chat'],
  ['council', 'Council', 'government'],
  ['voters', 'Voters', 'heart'],
  ['inbox', 'Inbox', 'post'],
  ['stats', 'Stats', 'money'],
  ['hall', 'Elections', 'check'],
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];
const DESKS: ReadonlyArray<[NewsDesk | 'all', string]> = [
  ['all', 'All'], ['politics', 'Politics'], ['economy', 'Economy'], ['city', 'City'],
  ['safety', 'Safety'], ['transport', 'Transport'], ['people', 'People'],
];
const DESK_COLOUR: Record<NewsDesk, string> = {
  politics: '#c98bdb', economy: '#f4b54a', city: '#6fd3ff', safety: '#e0685a', transport: '#5fc78c', people: '#9fb4c9',
};

const pct = (x: number): string => `${Math.round(x * 100)}%`;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls !== undefined) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const tone = (x: number): string => (x >= 0.55 ? '#5fc78c' : x >= 0.35 ? '#e8b454' : '#e0685a');

export class Computer {
  private readonly launcher: HTMLButtonElement;
  private readonly badge: HTMLElement;
  private readonly scrim: HTMLElement;
  private readonly body: HTMLElement;
  private readonly title: HTMLElement;
  private readonly meta: HTMLElement;
  private readonly appButtons = new Map<DeskApp, HTMLButtonElement>();
  private app: DeskApp = 'home';
  private shown = false;
  private painted = '';
  private lastLook = 0;
  private desk: NewsDesk | 'all' = 'all';

  constructor(parent: HTMLElement, private host: DeskHost,
    private hall: CityHall | null, private stats: StatsApp | null) {
    this.launcher = el('button', 'mr-pc-launch');
    this.launcher.dataset.panel = 'pc-launch';
    this.launcher.innerHTML = '<svg width="22" height="20" viewBox="0 0 22 20" fill="none" stroke="currentColor" '
      + 'stroke-width="1.6"><rect x="1" y="1" width="20" height="13" rx="2"/><path d="M8 18h6M11 14v4"/></svg>';
    this.badge = el('span', 'mr-pc-dot');
    this.badge.hidden = true;
    this.launcher.appendChild(this.badge);
    this.launcher.setAttribute('aria-label', 'City Hall computer');
    tip(this.launcher, 'City Hall computer — council, news, voters, petitions, stats and elections', 'P');
    this.launcher.addEventListener('click', () => { clickSound(); this.toggle(); });
    parent.appendChild(this.launcher);

    this.scrim = el('div', 'mr-pc-scrim');
    this.scrim.dataset.panel = 'computer';
    this.scrim.hidden = true;
    this.scrim.addEventListener('pointerdown', (e) => { if (e.target === this.scrim) this.close(); });
    const pc = el('div', 'mr-pc');
    pc.setAttribute('role', 'dialog');
    pc.setAttribute('aria-label', 'City Hall computer');
    const screen = el('div', 'mr-pc-screen');

    const side = el('nav', 'mr-pc-side');
    const brand = el('div', 'mr-pc-brand');
    brand.innerHTML = `<span style="display:flex;color:var(--amber)">${glyph('government', 26)}</span>`
      + '<div><b>City Hall</b><small>Civic OS</small></div>';
    side.appendChild(brand);
    for (const [id, name, icon] of APPS) {
      const b = el('button', 'mr-pc-app');
      b.dataset.app = id;
      b.innerHTML = `${glyph(icon, 17)}<span>${name}</span>`;
      b.setAttribute('aria-label', name);
      b.addEventListener('click', () => { clickSound(); this.showApp(id); });
      side.appendChild(b);
      this.appButtons.set(id, b);
    }
    side.appendChild(el('div', 'mr-pc-side-foot', 'Office of the Mayor'));

    const main = el('div', 'mr-pc-main');
    const top = el('div', 'mr-pc-top');
    this.title = el('div', 'mr-pc-title');
    this.meta = el('div', 'mr-pc-meta');
    const x = el('button', 'mr-pc-x');
    x.innerHTML = glyph('close', 15);
    x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', () => { clickSound(); this.close(); });
    top.append(this.title, this.meta, x);
    this.body = el('div', 'mr-pc-body');
    main.append(top, this.body);
    screen.append(side, main);
    pc.appendChild(screen);
    this.scrim.appendChild(pc);
    parent.appendChild(this.scrim);

    window.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement | null;
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'p' || e.key === 'P') { if (this.host.live()) this.toggle(); }
      else if (e.key === 'Escape' && this.shown) { e.stopPropagation(); this.close(); }
    });
  }

  set visible(on: boolean) {
    this.launcher.style.display = on ? 'grid' : 'none';
    if (!on) this.close();
  }

  get open(): boolean { return this.shown; }

  toggle(): void { if (this.shown) this.close(); else this.show(); }

  show(app?: DeskApp): void {
    if (app !== undefined) this.app = app;
    this.shown = true;
    this.scrim.hidden = false;
    this.showApp(this.app);
    requestAnimationFrame(() => this.scrim.classList.add('is-open'));
  }

  close(): void {
    if (!this.shown) return;
    this.shown = false;
    this.scrim.classList.remove('is-open');
    setTimeout(() => { if (!this.shown) this.scrim.hidden = true; }, 180);
  }

  showApp(app: DeskApp): void {
    this.app = app;
    for (const [id, b] of this.appButtons) b.classList.toggle('is-on', id === app);
    this.title.textContent = APPS.find((a) => a[0] === app)?.[1] ?? '';
    this.painted = '';
    this.paint();
  }

  /** Per frame: the badge always, the open program on a slow beat. */
  update(now: number): void {
    const c = this.host.world().council;
    const waiting = c.inbox.length;
    this.badge.hidden = waiting === 0;
    this.badge.textContent = String(waiting);
    const inbox = this.appButtons.get('inbox');
    if (inbox !== undefined) {
      let em = inbox.querySelector('em');
      if (waiting > 0 && em === null) { em = el('em'); inbox.appendChild(em); }
      if (em !== null) { if (waiting === 0) em.remove(); else em.textContent = String(waiting); }
    }
    if (!this.shown) return;
    if (this.app === 'hall') this.hall?.update();
    if (this.app === 'stats') this.stats?.update();
    if (now - this.lastLook < 500) return;
    this.lastLook = now;
    this.paint();
  }

  // ---- painting --------------------------------------------------------------

  /** What the open program shows, as a key: repaint only when it moves. */
  private signature(): string {
    const w = this.host.world();
    const day = Math.floor(this.host.day());
    return [this.app, this.desk, w.council.version, w.news.version, w.politics.version, day,
      Math.round(this.host.population() / 25), Math.round(w.budget.balance / 1000)].join('|');
  }

  private paint(): void {
    if (!this.shown) return;
    const w = this.host.world();
    const day = this.host.day();
    this.meta.innerHTML = '';
    const m = (k: string, v: string): void => {
      const s = el('span', undefined, k);
      const b = el('b', undefined, v);
      s.appendChild(b);
      this.meta.appendChild(s);
    };
    m('', `${MONTHS[monthOf(Math.floor(day))]} ${yearOf(Math.floor(day))}`);
    m('Treasury', money(Math.round(w.budget.balance)));
    if (w.council.open) m('Capital', String(Math.floor(w.council.capital)));

    const sig = this.signature();
    if (sig === this.painted) return;
    this.painted = sig;
    const scroll = this.body.scrollTop;
    this.body.replaceChildren();
    this.body.classList.toggle('is-pane', this.app === 'stats' || this.app === 'hall');
    switch (this.app) {
      case 'home': this.paintHome(); break;
      case 'news': this.paintNews(); break;
      case 'council': this.paintCouncil(); break;
      case 'voters': this.paintVoters(); break;
      case 'inbox': this.paintInbox(); break;
      case 'stats':
        if (this.stats !== null) {
          this.stats.pane.style.display = 'flex';
          this.body.appendChild(this.stats.pane);
          this.stats.update(true);
        }
        break;
      case 'hall':
        if (this.hall !== null) {
          this.hall.pane.style.display = 'flex';
          this.body.appendChild(this.hall.pane);
          this.hall.update(true);
        }
        break;
    }
    this.body.scrollTop = scroll;
  }

  private card(title: string, span: number, aside?: string): HTMLElement {
    const c = el('section', 'mr-pc-card');
    c.style.gridColumn = `span ${span}`;
    const h = el('h3', undefined, title);
    if (aside !== undefined) h.appendChild(el('span', undefined, aside));
    c.appendChild(h);
    return c;
  }

  private bar(value: number, colour: string): HTMLElement {
    const b = el('div', 'mr-pc-bar');
    const f = el('b');
    f.style.width = `${Math.max(0, Math.min(1, value)) * 100}%`;
    f.style.background = colour;
    b.appendChild(f);
    return b;
  }

  private closedNote(): HTMLElement {
    const n = el('div', 'mr-pc-empty');
    n.appendChild(el('b', undefined, 'No council yet'));
    n.appendChild(document.createTextNode(`The town elects its first council at ${COUNCIL_POPULATION.toLocaleString()} residents. `
      + `It has ${this.host.population().toLocaleString()}.`));
    return n;
  }

  // ---- Overview ----------------------------------------------------------------

  private paintHome(): void {
    const w = this.host.world();
    const c = w.council;
    const g = el('div', 'mr-pc-grid');
    const tile = (label: string, value: string, note: string, colour?: string): void => {
      const t = el('section', 'mr-pc-card mr-pc-tile');
      t.style.gridColumn = 'span 2';
      const s = el('small', undefined, label);
      const v = el('strong', undefined, value);
      if (colour !== undefined) v.style.color = colour;
      t.append(s, v, el('i', undefined, note));
      g.appendChild(t);
    };
    const net = this.host.net();
    tile('Population', this.host.population().toLocaleString(), this.host.cityName());
    tile('Happiness', pct(this.host.happiness()), 'average mood', tone(this.host.happiness()));
    tile('Treasury', money(Math.round(w.budget.balance)), 'in the bank', w.budget.balance < 0 ? '#e0685a' : undefined);
    tile('Weekly', `${net >= 0 ? '+' : '−'}${money(Math.abs(Math.round(net)))}`, 'net of spending', net < 0 ? '#e0685a' : '#5fc78c');
    tile('Approval', c.open ? pct(c.overall) : '—', c.open ? 'of the administration' : 'no council yet',
      c.open ? tone(c.overall) : undefined);
    tile('Mayor', w.politics.mayor?.name.split(' ')[0] ?? '—', w.politics.mayor?.party ?? 'elections at 5,000');

    // The chamber, in one strip.
    const ch = this.card('Council', 6, c.open ? `${c.seats[0]} of ${c.seatCount} seats` : undefined);
    if (!c.open) ch.appendChild(el('div', 'mr-pc-note', `Sits at ${COUNCIL_POPULATION.toLocaleString()} residents.`));
    else {
      ch.appendChild(this.seatStrip(c));
      const row = el('div', 'mr-pc-row');
      row.style.marginTop = '10px';
      row.appendChild(el('span', 'mr-pc-note', 'Political capital'));
      const bar = this.bar(c.capital / 100, '#f4b54a');
      bar.style.flex = '1';
      row.append(bar, el('b', undefined, String(Math.floor(c.capital))));
      ch.appendChild(row);
      const pending = c.pending;
      const line = el('div', 'mr-pc-note');
      line.style.marginTop = '8px';
      line.textContent = pending === null
        ? `${c.laws.length} law${c.laws.length === 1 ? '' : 's'} in force. No bill in committee.`
        : `In committee: ${billById(pending.id)?.name ?? ''}${pending.repeal ? ' (repeal)' : ''}.`;
      ch.appendChild(line);
      const go = el('button', 'mr-pc-btn is-quiet', 'Open the chamber');
      go.style.marginTop = '10px';
      go.addEventListener('click', () => { clickSound(); this.showApp('council'); });
      ch.appendChild(go);
    }
    g.appendChild(ch);

    // Opinion.
    const op = this.card('Voters', 6, c.open ? 'approval by bloc' : undefined);
    if (!c.open) op.appendChild(el('div', 'mr-pc-note', 'Opinion is polled once the council sits.'));
    else {
      for (let b = 0; b < BLOCS.length; b++) {
        const row = el('div', 'mr-pc-row');
        row.style.margin = '5px 0';
        const name = el('span', undefined, BLOCS[b].name);
        name.style.width = '84px';
        name.style.color = BLOCS[b].colour;
        const bar = this.bar(c.approval[b], tone(c.approval[b]));
        bar.style.flex = '1';
        const v = el('b', undefined, pct(c.approval[b]));
        v.style.width = '38px';
        v.style.textAlign = 'right';
        row.append(name, bar, v);
        if (c.protesting[b] === 1) row.appendChild(el('span', 'mr-pc-chip', 'Protest'));
        op.appendChild(row);
      }
    }
    g.appendChild(op);

    // The front page.
    const fp = this.card('Front page', 7, 'the Herald');
    const stories = w.news.latest(4);
    if (stories.length === 0) fp.appendChild(el('div', 'mr-pc-note', 'Nothing in the paper yet.'));
    for (const s of stories) fp.appendChild(this.storyLine(s));
    const more = el('button', 'mr-pc-btn is-quiet', 'Read the paper');
    more.style.marginTop = '8px';
    more.addEventListener('click', () => { clickSound(); this.showApp('news'); });
    fp.appendChild(more);
    g.appendChild(fp);

    // Waiting for the mayor.
    const ib = this.card('Waiting for you', 5, c.inbox.length > 0 ? `${c.inbox.length} open` : undefined);
    if (c.inbox.length === 0) ib.appendChild(el('div', 'mr-pc-note', c.open ? 'No petitions waiting.' : 'Petitions arrive once the council sits.'));
    for (const p of c.inbox) {
      const def = petitionById(p.id);
      if (def === undefined) continue;
      const row = el('div', 'mr-pc-row');
      row.style.margin = '6px 0';
      const chip = el('span', 'mr-pc-chip', BLOCS.find((b) => b.id === def.from)?.name ?? '');
      chip.style.color = BLOCS.find((b) => b.id === def.from)?.colour ?? '';
      row.append(chip, el('span', undefined, def.title));
      ib.appendChild(row);
    }
    if (c.inbox.length > 0) {
      const go = el('button', 'mr-pc-btn', 'Answer petitions');
      go.style.marginTop = '8px';
      go.addEventListener('click', () => { clickSound(); this.showApp('inbox'); });
      ib.appendChild(go);
    }
    g.appendChild(ib);
    this.body.appendChild(g);
  }

  private storyLine(s: Story): HTMLElement {
    const d = el('div');
    d.style.padding = '6px 0';
    d.style.borderTop = '1px solid rgba(255,255,255,.05)';
    const k = el('span', 'mr-pc-kicker', `${s.desk} · ${this.ago(s.day)}`);
    k.style.color = DESK_COLOUR[s.desk];
    const h = el('div', undefined, s.head);
    h.style.font = '700 14.5px/1.3 var(--serif)';
    h.style.color = '#e2e8f0';
    h.style.marginTop = '3px';
    d.append(k, h);
    return d;
  }

  private ago(day: number): string {
    const d = Math.floor(this.host.day()) - Math.floor(day);
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
  }

  // ---- Herald --------------------------------------------------------------------

  private paintNews(): void {
    const w = this.host.world();
    const day = Math.floor(this.host.day());
    const mast = el('div', 'mr-pc-news-mast');
    mast.appendChild(el('h2', undefined, `The ${this.host.cityName()} Herald`));
    mast.appendChild(el('div', undefined,
      `${MONTHS[monthOf(day)]} ${yearOf(day)} · Day ${day + 1} · Population ${this.host.population().toLocaleString()}`));
    this.body.appendChild(mast);

    const filters = el('div', 'mr-pc-filters');
    for (const [id, name] of DESKS) {
      const b = el('button', id === this.desk ? 'is-on' : undefined, name);
      b.addEventListener('click', () => { clickSound(); this.desk = id; this.painted = ''; this.paint(); });
      filters.appendChild(b);
    }
    this.body.appendChild(filters);

    const stories = w.news.stories.filter((s) => this.desk === 'all' || s.desk === this.desk);
    if (stories.length === 0) {
      const e = el('div', 'mr-pc-empty');
      e.appendChild(el('b', undefined, 'No news is good news'));
      e.appendChild(document.createTextNode('The paper prints what happens to the city. Nothing has, yet.'));
      this.body.appendChild(e);
      return;
    }
    const [lead, ...rest] = stories;
    const l = el('article', 'mr-pc-news-lead');
    const k = el('div', 'mr-pc-kicker', `${lead.desk} · ${this.ago(lead.day)}`);
    k.style.color = DESK_COLOUR[lead.desk];
    l.append(k, el('h3', undefined, lead.head), el('p', undefined, lead.body));
    this.body.appendChild(l);
    const cols = el('div', 'mr-pc-news-cols');
    for (const s of rest) {
      const a = el('article', 'mr-pc-news-item');
      const kk = el('div', 'mr-pc-kicker', `${s.desk} · ${this.ago(s.day)}`);
      kk.style.color = DESK_COLOUR[s.desk];
      a.append(kk, el('h4', undefined, s.head), el('p', undefined, s.body));
      if (s.tone === 'bad') a.style.borderTopColor = 'rgba(224,104,90,.45)';
      else if (s.tone === 'good') a.style.borderTopColor = 'rgba(95,199,140,.4)';
      cols.appendChild(a);
    }
    this.body.appendChild(cols);
  }

  // ---- Council ---------------------------------------------------------------------

  /** Seats as a row of dots, in party colours, the administration first. */
  private seatStrip(c: Council): HTMLElement {
    const row = el('div', 'mr-pc-whip');
    row.style.flexWrap = 'wrap';
    for (let p = 0; p < c.seats.length; p++) {
      for (let s = 0; s < c.seats[p]; s++) {
        const i = el('i');
        i.style.width = '14px';
        i.style.height = '14px';
        i.style.background = COUNCIL_PARTIES[p].colour;
        i.title = COUNCIL_PARTIES[p].name;
        row.appendChild(i);
      }
    }
    return row;
  }

  /** The chamber as a hemicycle, seat by seat. */
  private hemicycle(c: Council): SVGSVGElement {
    const n = c.seatCount;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 220 124');
    svg.style.width = '100%';
    svg.style.maxWidth = '300px';
    svg.style.display = 'block';
    svg.style.margin = '0 auto';
    const colours: string[] = [];
    for (let p = 0; p < c.seats.length; p++) for (let s = 0; s < c.seats[p]; s++) colours.push(COUNCIL_PARTIES[p].colour);
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (1 - (i + 0.5) / n);
      const r = 82;
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', String(110 + Math.cos(a) * r));
      dot.setAttribute('cy', String(112 - Math.sin(a) * r));
      dot.setAttribute('r', String(n > 9 ? 11 : 13));
      dot.setAttribute('fill', colours[i] ?? '#333');
      dot.setAttribute('stroke', '#0b0f15');
      dot.setAttribute('stroke-width', '2');
      svg.appendChild(dot);
    }
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', '110'); t.setAttribute('y', '108');
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', '#e8eef6');
    t.setAttribute('style', 'font: 800 26px var(--display)');
    t.textContent = `${c.seats[0]}/${n}`;
    svg.appendChild(t);
    return svg;
  }

  private paintCouncil(): void {
    const w = this.host.world();
    const c = w.council;
    if (!c.open) { this.body.appendChild(this.closedNote()); return; }
    const day = this.host.day();
    const pop = this.host.population();
    const g = el('div', 'mr-pc-grid');

    // The chamber.
    const ch = this.card('The chamber', 5, `election in ${Math.max(0, Math.ceil(c.nextElection - day))} days`);
    ch.appendChild(this.hemicycle(c));
    const legend = el('div');
    legend.style.marginTop = '8px';
    const forecast = c.forecast();
    for (let p = 0; p < COUNCIL_PARTIES.length; p++) {
      if (c.seats[p] === 0 && forecast[p] < 0.08) continue;
      const row = el('div', 'mr-pc-row');
      row.style.margin = '4px 0';
      const sw = el('i');
      sw.style.cssText = `width:10px;height:10px;border-radius:50%;background:${COUNCIL_PARTIES[p].colour};flex-shrink:0`;
      const name = el('span', undefined, p === 0 ? 'Administration' : COUNCIL_PARTIES[p].name);
      name.style.flex = '1';
      const seats = el('b', undefined, `${c.seats[p]}`);
      const poll = el('span', 'mr-pc-note', `polling ${pct(forecast[p])}`);
      poll.style.width = '86px';
      poll.style.textAlign = 'right';
      row.append(sw, name, seats, poll);
      legend.appendChild(row);
    }
    ch.appendChild(legend);
    const cap = el('div', 'mr-pc-row');
    cap.style.marginTop = '12px';
    cap.appendChild(el('span', 'mr-pc-note', 'Capital'));
    const cb = this.bar(c.capital / 100, '#f4b54a');
    cb.style.flex = '1';
    cap.append(cb, el('b', undefined, String(Math.floor(c.capital))));
    ch.appendChild(cap);
    ch.appendChild(el('div', 'mr-pc-note',
      'Capital builds while the voters approve of you, and pays for tabling bills and lobbying councillors.'));
    g.appendChild(ch);

    // In committee, and the laws in force.
    const right = this.card('In committee', 7);
    const pe = c.pending;
    if (pe === null) right.appendChild(el('div', 'mr-pc-note', 'No bill before the chamber. Table one below.'));
    else {
      const def = billById(pe.id)!;
      const whip = c.whip(pe.id, pe.repeal, pe.lobbied);
      const ayes = whip.filter((v) => v).length;
      const box = el('div', 'mr-pc-bill');
      const h = el('h4', undefined, `${pe.repeal ? 'Repeal: ' : ''}${def.name}`);
      box.appendChild(h);
      box.appendChild(el('p', undefined,
        `${((n) => (n <= 1 ? 'Vote tomorrow' : `Vote in ${n} days`))(Math.max(0, Math.ceil(pe.tabled + COMMITTEE_DAYS - day)))}. `
        + `Lobbied ${pe.lobbied} of ${LOBBY_MAX} times.`));
      box.appendChild(this.whipRow(whip));
      const side = el('div', 'mr-pc-side-col');
      side.appendChild(this.verdict(ayes, whip.length));
      const lob = el('button', 'mr-pc-btn', `Lobby · ${LOBBY_COST}`);
      lob.disabled = !c.canLobby();
      lob.title = 'Spend capital to bring waverers round';
      lob.addEventListener('click', () => {
        if (c.lobby()) { clickSound(); this.painted = ''; this.paint(); } else deny();
      });
      side.appendChild(lob);
      box.appendChild(side);
      right.appendChild(box);
    }
    const laws = el('h3', undefined, 'Laws in force');
    laws.style.marginTop = '14px';
    right.appendChild(laws);
    if (c.laws.length === 0) right.appendChild(el('div', 'mr-pc-note', 'None yet.'));
    for (const law of c.laws) {
      const def = billById(law.id);
      if (def === undefined) continue;
      const row = el('div', 'mr-pc-row');
      row.style.margin = '6px 0';
      const name = el('span', undefined, def.name);
      name.style.flex = '1';
      name.style.color = '#e8eef6';
      row.appendChild(name);
      if (law.until !== undefined) row.appendChild(el('span', 'mr-pc-note', `${Math.max(0, Math.ceil(law.until - day))} days left`));
      const why = c.blocked(law.id, true, pop);
      const rp = el('button', 'mr-pc-btn is-quiet', `Repeal · ${c.costOf(law.id, true)}`);
      rp.disabled = why !== null || law.until !== undefined;
      if (why !== null) rp.title = why;
      rp.addEventListener('click', () => this.tableBill(law.id, true));
      row.appendChild(rp);
      right.appendChild(row);
    }
    if (c.record.length > 0) {
      const rec = el('h3', undefined, 'Recent divisions');
      rec.style.marginTop = '14px';
      right.appendChild(rec);
      for (const d of c.record.slice(0, 4)) {
        const row = el('div', 'mr-pc-row');
        row.style.margin = '4px 0';
        const v = el('span', 'mr-pc-chip', d.passed ? 'Carried' : 'Defeated');
        v.style.color = d.passed ? '#5fc78c' : '#e0685a';
        row.append(v, el('span', undefined, `${d.repeal ? 'Repeal of ' : ''}${billById(d.id)?.name ?? d.id}`),
          el('span', 'mr-pc-note', `${d.ayes}–${d.noes} · ${this.ago(d.day)}`));
        right.appendChild(row);
      }
    }
    g.appendChild(right);

    // The bills.
    const bills = this.card('Bills you can table', 12, 'the whip count is where the chamber stands today');
    const list = el('div', 'mr-pc-list');
    for (const def of BILLS) {
      if (c.has(def.id)) continue;
      list.appendChild(this.billCard(c, def, pop));
    }
    bills.appendChild(list);
    g.appendChild(bills);
    this.body.appendChild(g);
  }

  private whipRow(whip: boolean[]): HTMLElement {
    const row = el('div', 'mr-pc-whip');
    for (const v of whip) {
      const i = el('i');
      i.style.background = v ? '#5fc78c' : '#e0685a';
      row.appendChild(i);
    }
    return row;
  }

  private verdict(ayes: number, seats: number): HTMLElement {
    const pass = ayes * 2 > seats;
    const v = el('span', 'mr-pc-verdict', `${pass ? 'Would pass' : 'Would fail'} ${ayes}–${seats - ayes}`);
    v.style.color = pass ? '#5fc78c' : '#e0685a';
    return v;
  }

  private billCard(c: Council, def: BillDef, pop: number): HTMLElement {
    const box = el('article', 'mr-pc-bill');
    box.dataset.bill = def.id;
    box.appendChild(el('h4', undefined, def.name));
    box.appendChild(el('p', undefined, def.summary));
    const ul = el('ul');
    for (const s of def.says) ul.appendChild(el('li', undefined, s));
    box.appendChild(ul);
    const stance = el('div', 'mr-pc-stance');
    for (const b of BLOCS) {
      const v = def.blocs[b.id] ?? 0;
      if (Math.abs(v) < 0.15) continue;
      const chip = el('span', 'mr-pc-chip', `${b.name} ${v > 0 ? '▲' : '▼'}`);
      chip.style.color = v > 0 ? '#5fc78c' : '#e0685a';
      chip.style.borderColor = v > 0 ? 'rgba(95,199,140,.35)' : 'rgba(224,104,90,.35)';
      stance.appendChild(chip);
    }
    box.appendChild(stance);
    const side = el('div', 'mr-pc-side-col');
    const whip = c.whip(def.id, false);
    side.appendChild(this.verdict(whip.filter((v) => v).length, whip.length));
    side.appendChild(this.whipRow(whip));
    const why = c.blocked(def.id, false, pop);
    const b = el('button', 'mr-pc-btn', `Table · ${c.costOf(def.id, false)} capital`);
    b.disabled = why !== null;
    if (why !== null) {
      b.title = why;
      const n = el('span', 'mr-pc-note', why);
      n.style.textAlign = 'right';
      n.style.maxWidth = '180px';
      side.append(b, n);
    } else side.appendChild(b);
    b.addEventListener('click', () => this.tableBill(def.id, false));
    box.appendChild(side);
    return box;
  }

  private tableBill(id: string, repeal: boolean): void {
    const c = this.host.world().council;
    if (c.table(id, repeal, this.host.day(), this.host.population())) {
      clickSound();
      this.painted = '';
      this.paint();
    } else deny();
  }

  // ---- Voters ------------------------------------------------------------------------

  private paintVoters(): void {
    const w = this.host.world();
    const c = w.council;
    if (!c.open) { this.body.appendChild(this.closedNote()); return; }
    const g = el('div', 'mr-pc-grid');
    const head = this.card('The administration', 12);
    const row = el('div', 'mr-pc-row');
    row.style.gap = '24px';
    row.style.flexWrap = 'wrap';
    const stat = (label: string, v: string, colour?: string): void => {
      const t = el('div', 'mr-pc-tile');
      const s = el('strong', undefined, v);
      if (colour !== undefined) s.style.color = colour;
      t.append(el('small', undefined, label), s);
      row.appendChild(t);
    };
    stat('Overall approval', pct(c.overall), tone(c.overall));
    stat('Mayor\'s approval', w.politics.mayor !== null ? pct(w.politics.approval) : '—');
    stat('Capital a day', `${(0.55 + 3 * (c.overall - 0.5)) >= 0 ? '+' : ''}${(0.55 + 3 * (c.overall - 0.5)).toFixed(1)}`);
    stat('Next council election', `${Math.max(0, Math.ceil(c.nextElection - this.host.day()))} days`);
    head.appendChild(row);
    const rule = el('div', 'mr-pc-note');
    rule.style.marginTop = '10px';
    head.appendChild(rule);
    rule.appendChild(el('span', undefined,
      `A bloc under ${pct(PROTEST_BELOW)} for three days takes to the streets. Workers strike, which costs the works and the shops.`));
    g.appendChild(head);
    for (let b = 0; b < BLOCS.length; b++) {
      const bloc = BLOCS[b];
      const card = this.card(bloc.name, 4, `${pct(c.share[b])} of voters`);
      card.querySelector('h3')!.style.color = bloc.colour;
      const big = el('div', 'mr-pc-row');
      const v = el('strong', undefined, pct(c.approval[b]));
      v.style.cssText = `font: 800 30px/1 var(--display); color:${tone(c.approval[b])}`;
      big.appendChild(v);
      big.appendChild(el('span', 'mr-pc-note', 'approve'));
      if (c.protesting[b] === 1) {
        const p = el('span', 'mr-pc-chip', bloc.id === 'workers' ? 'On strike' : 'Protesting');
        p.style.color = '#e0685a';
        p.style.marginLeft = 'auto';
        big.appendChild(p);
      }
      card.appendChild(big);
      const bar = this.bar(c.approval[b], tone(c.approval[b]));
      bar.style.margin = '8px 0';
      card.appendChild(bar);
      card.appendChild(el('div', 'mr-pc-note', `Cares about: ${bloc.cares.toLowerCase()}.`));
      // Which laws in force they like and dislike.
      const liked = c.laws.map((l) => billById(l.id)).filter((d): d is BillDef => d !== undefined)
        .map((d) => [d.name, d.blocs[bloc.id] ?? 0] as [string, number]).filter(([, x]) => Math.abs(x) >= 0.3);
      if (liked.length > 0) {
        const st = el('div', 'mr-pc-stance');
        st.style.marginTop = '8px';
        for (const [name, x] of liked) {
          const chip = el('span', 'mr-pc-chip', `${x > 0 ? '▲' : '▼'} ${name}`);
          chip.style.color = x > 0 ? '#5fc78c' : '#e0685a';
          st.appendChild(chip);
        }
        card.appendChild(st);
      }
      g.appendChild(card);
    }
    this.body.appendChild(g);
  }

  // ---- Inbox ---------------------------------------------------------------------------

  private paintInbox(): void {
    const w = this.host.world();
    const c = w.council;
    if (!c.open) { this.body.appendChild(this.closedNote()); return; }
    if (c.inbox.length === 0) {
      const e = el('div', 'mr-pc-empty');
      e.appendChild(el('b', undefined, 'Inbox empty'));
      e.appendChild(document.createTextNode('Petitions arrive every few days. An unanswered one lapses after six, and the people who sent it remember.'));
      this.body.appendChild(e);
      return;
    }
    const pop = this.host.population();
    const list = el('div', 'mr-pc-list');
    for (const p of c.inbox) {
      const def = petitionById(p.id);
      if (def === undefined) continue;
      const bloc = BLOCS.find((b) => b.id === def.from)!;
      const box = el('article', 'mr-pc-card');
      box.dataset.petition = def.id;
      const h = el('h3', undefined, `From: ${bloc.name}`);
      h.style.color = bloc.colour;
      h.appendChild(el('span', undefined, `${Math.max(0, Math.ceil(p.day + 6 - this.host.day()))} days to answer`));
      box.appendChild(h);
      const t = el('div', undefined, def.title);
      t.style.cssText = 'font: 700 20px/1.2 var(--serif); color:#eef2f7; margin-bottom:6px';
      box.appendChild(t);
      const body = el('p', undefined, def.body);
      body.style.cssText = 'margin:0 0 12px; font: 500 14px/1.55 var(--serif); color:#b9c6d6; max-width:70ch';
      box.appendChild(body);
      const opts = el('div', 'mr-pc-row');
      opts.style.flexWrap = 'wrap';
      opts.style.alignItems = 'stretch';
      def.options.forEach((o, i) => {
        const col = el('div');
        col.style.cssText = 'flex:1; min-width:200px; display:flex; flex-direction:column; gap:6px; padding:10px; '
          + 'border:1px solid rgba(255,255,255,.07); border-radius:8px; background:rgba(0,0,0,.15)';
        const cost = c.optionCost(o, pop);
        const b = el('button', i === 0 ? 'mr-pc-btn' : 'mr-pc-btn is-quiet',
          cost > 0 ? `${o.label} · ${money(Math.round(cost))}` : cost < 0 ? `${o.label} · +${money(Math.round(-cost))}` : o.label);
        b.disabled = cost > 0 && w.budget.balance < cost;
        b.addEventListener('click', () => {
          if (c.answer(def.id, i, this.host.day(), pop, w.budget, w.policies, w.news)) {
            clickSound(); this.painted = ''; this.paint();
          } else deny();
        });
        col.append(b, el('span', 'mr-pc-note', o.says));
        opts.appendChild(col);
      });
      box.appendChild(opts);
      list.appendChild(box);
    }
    this.body.appendChild(list);
  }
}
