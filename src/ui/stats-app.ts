/**
 * Stats: the phone's city-accounts app.
 *
 * The budget card answers "what does a week cost". This answers everything
 * behind it: where every coin comes from and goes, which zone's tax is carrying
 * the city, what each service branch costs per building, what the last three
 * years looked like month by month, who lives here, how they travel and what
 * the industry is earning. Seven tabs, all read from state the simulation
 * already holds -- nothing here is estimated for display.
 *
 * Charts follow one set of rules: one measure per chart, bars from a zero
 * baseline, a tooltip on every mark, text in text colours and never in a
 * series colour, and the four zone colours stepped so they separate for
 * colour-blind players against this screen.
 */

import { SKIN } from './skin';
import { click as clickSound } from './sound';
import { money as rawMoney } from '../sim';
import {
  INCOME_LINES, SPENDING_LINES, LINE_LABEL, type CityHistory, type Month,
} from '../sim/history';
import type { Ledger } from '../sim/agents/economy';

/** Everything the app shows, read fresh each paint. */
export interface StatsRead {
  city: string;
  ledger: Ledger;
  history: CityHistory;
  /** The month in progress, banked so far. */
  current: Month;
  balance: number;
  /** Tax rates by zone, 0 to 1, in Tax order. */
  rates: number[];
  /** What each zone's tax is levied on. */
  bases: { residents: number; shopJobs: number; worksJobs: number; officeJobs: number };
  branches: Array<{ name: string; colour: string; upkeep: number; count: number }>;
  /** Every kind of service building the city runs, with its weekly bill. */
  buildings: Array<{ name: string; colour: string; count: number; total: number }>;
  people: {
    population: number; households: number; employed: number; students: number;
    unemployment: number; happiness: number; births: number; deaths: number;
    arrived: number; departed: number; jobs: number;
    stages: Array<[string, number]>; edu: Array<[string, number]>;
  };
  travel: {
    modes: Array<[string, number]>; meanMinutes: number; speed: number; driving: number;
    stopped: number; worstLoad: number; congested: number; lanes: number;
    riders: number; crossTown: number;
  };
  plants: Array<{ name: string; colour: string; taken: number; capacity: number; income: number; staffing: number }>;
  industry: Array<{ name: string; colour: string; income: number; units: number;
    shipped: number; local: number; staffing: number; hectares: number; remaining: number }>;
  /** Loans held, and what the bank will lend. */
  loans: Array<{ name: string; owed: number; payment: number; weeksLeft: number }>;
  offers: Array<{ name: string; amount: number; weeks: number; annual: number; payment: number }>;
  maxLoans: number;
  borrow: (kind: number) => boolean;
  repay: (index: number) => boolean;
}

type Tab = 'overview' | 'income' | 'spending' | 'loans' | 'history' | 'people' | 'travel' | 'industry';
const TABS: Array<[Tab, string]> = [
  ['overview', 'Overview'], ['income', 'Income'], ['spending', 'Spending'], ['loans', 'Loans'],
  ['history', 'History'], ['people', 'People'], ['travel', 'Travel'], ['industry', 'Industry'],
];

/** Zone colours for this screen: the game's hues, stepped to pass CVD and contrast checks. */
const ZONE = ['#46a35c', '#4a8ad6', '#b8841f', '#9670d6'];
const ZONE_NAME = ['Residential', 'Commercial', 'Industrial', 'Office'];
const OTHER = '#6b7888';
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Metric = { id: string; label: string; of: (m: Month) => number; fmt: (v: number) => string; signed?: boolean };
const METRICS: Metric[] = [
  { id: 'net', label: 'Net', of: (m) => sum(m.income) - sum(m.spending), fmt: signedMoney, signed: true },
  { id: 'income', label: 'Income', of: (m) => sum(m.income), fmt: money },
  { id: 'spending', label: 'Spending', of: (m) => sum(m.spending), fmt: money },
  { id: 'balance', label: 'Treasury', of: (m) => m.balance, fmt: money, signed: true },
  { id: 'population', label: 'Population', of: (m) => m.population, fmt: (v) => Math.round(v).toLocaleString() },
  { id: 'happiness', label: 'Happiness', of: (m) => m.happiness * 100, fmt: (v) => `${Math.round(v)}%` },
  { id: 'unemployment', label: 'Jobless', of: (m) => m.unemployment * 100, fmt: (v) => `${v.toFixed(1)}%` },
  { id: 'speed', label: 'Traffic', of: (m) => m.speed, fmt: (v) => `${Math.round(v)} km/h` },
  { id: 'congestion', label: 'Jam cost', of: (m) => m.congestion, fmt: money },
];

export class StatsApp {
  readonly pane: HTMLElement;
  private readonly tabsEl: HTMLElement;
  private readonly body: HTMLElement;
  private readonly tip: HTMLElement;
  private tab: Tab = 'overview';
  private metric = 'net';
  private span = 12;
  private lastPaint = 0;

  constructor(private read: () => StatsRead | null) {
    this.pane = document.createElement('div');
    this.pane.className = 'mr-st';
    this.pane.dataset.pane = 'stats';
    this.pane.style.display = 'none';

    this.tabsEl = el('div', 'mr-st-tabs');
    this.tabsEl.setAttribute('role', 'tablist');
    for (const [id, name] of TABS) {
      const b = el('button', 'mr-st-tab', name);
      b.dataset.tab = id;
      b.setAttribute('role', 'tab');
      b.addEventListener('click', () => { clickSound(); this.tab = id; this.paint(); });
      this.tabsEl.appendChild(b);
    }
    this.body = el('div', 'mr-st-body');
    this.tip = el('div', 'mr-st-tip');
    this.tip.hidden = true;
    this.pane.append(this.tabsEl, this.body, this.tip);
  }

  /** Repaints on a slow beat while shown; `force` repaints now. */
  update(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastPaint < 1500) return;
    this.paint();
  }

  private paint(): void {
    this.lastPaint = performance.now();
    for (const b of Array.from(this.tabsEl.children) as HTMLElement[]) {
      const on = b.dataset.tab === this.tab;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', String(on));
    }
    const r = this.read();
    const scroll = this.body.scrollTop;
    this.body.replaceChildren();
    this.tip.hidden = true;
    if (r === null) { this.body.appendChild(el('div', 'mr-st-empty', 'No city is running.')); return; }
    switch (this.tab) {
      case 'overview': this.overview(r); break;
      case 'income': this.income(r); break;
      case 'spending': this.spending(r); break;
      case 'loans': this.loansTab(r); break;
      case 'history': this.historyTab(r); break;
      case 'people': this.peopleTab(r); break;
      case 'travel': this.travelTab(r); break;
      case 'industry': this.industryTab(r); break;
    }
    this.body.scrollTop = scroll;
  }

  // ---- tabs ------------------------------------------------------------------

  private overview(r: StatsRead): void {
    const L = r.ledger;
    const hero = el('div', 'mr-st-hero');
    hero.append(el('div', 'mr-st-cap', 'Net a week'),
      el('div', `mr-st-big ${L.net >= 0 ? 'is-good' : 'is-bad'}`, signedMoney(L.net)),
      el('div', 'mr-st-sub', L.net >= 0
        ? `Treasury ${money(r.balance)}, growing`
        : `Treasury ${money(r.balance)}, ${isFinite(L.weeksLeft) ? `${L.weeksLeft.toFixed(1)} weeks of runway` : 'holding'}`));
    this.body.appendChild(hero);

    const tiles = el('div', 'mr-st-tiles');
    tiles.append(
      tile('Income', money(L.income), 'a week'),
      tile('Spending', money(L.spending), 'a week'),
      tile('Population', r.people.population.toLocaleString(), `${Math.round(r.people.happiness * 100)}% happy`),
      tile('Land value', `×${L.landValue.toFixed(2)}`, 'on every rate'),
    );
    this.body.appendChild(tiles);

    this.body.appendChild(section('Where the money comes from'));
    this.body.appendChild(this.composition(r));

    const months = r.history.months;
    this.body.appendChild(section('Net, month by month'));
    if (months.length === 0) this.body.appendChild(el('div', 'mr-st-note', 'The first month closes soon. Every month after that is kept for three years.'));
    else this.body.appendChild(this.columns(months.slice(-12), METRICS[0]));

    this.body.appendChild(section('Upkeep a week'));
    this.body.append(
      row('City services', money(L.services)),
      row('Roads', money(L.roads)),
      row('Transit', money(L.transit)),
      row('Industry', money(L.industryUpkeep)),
    );
    this.body.appendChild(section('This month so far'));
    const m = r.current;
    this.body.append(
      row('Money in', money(sum(m.income))),
      row('Money out', money(sum(m.spending))),
      row('Lost to congestion', money(m.congestion), m.congestion > sum(m.income) * 0.05 ? 'warn' : undefined),
    );
  }

  private loansTab(r: StatsRead): void {
    const owed = r.loans.reduce((a, l) => a + l.owed, 0);
    const weekly = r.loans.reduce((a, l) => a + l.payment, 0);
    const hero = el('div', 'mr-st-hero');
    hero.append(el('div', 'mr-st-cap', 'Owed to the bank'),
      el('div', `mr-st-big${owed > 0 ? ' is-bad' : ''}`, money(owed)),
      el('div', 'mr-st-sub', r.loans.length === 0 ? 'No loans. The city owes nobody.'
        : `${money(weekly)} a week in repayments, ${r.loans.length} of ${r.maxLoans} loans`));
    this.body.appendChild(hero);
    if (r.loans.length > 0) {
      this.body.appendChild(section('Held'));
      r.loans.forEach((l, i) => {
        const card = el('div', 'mr-st-loan');
        const words = el('div', 'mr-st-loan-words');
        words.append(el('b', '', l.name),
          el('span', '', `${money(l.owed)} owed · ${money(l.payment)}/wk · ${Math.ceil(l.weeksLeft)} weeks left`));
        const btn = el('button', 'mr-st-btn', 'Pay off');
        btn.disabled = r.balance < l.owed;
        btn.title = btn.disabled ? `Needs ${money(l.owed)} in the treasury` : `Clear it for ${money(l.owed)}`;
        btn.addEventListener('click', () => { clickSound(); if (r.repay(i)) this.paint(); });
        card.append(words, btn);
        this.body.appendChild(card);
      });
    }
    this.body.appendChild(section('Borrow'));
    r.offers.forEach((o, k) => {
      const card = el('div', 'mr-st-loan');
      const words = el('div', 'mr-st-loan-words');
      const total = o.payment * o.weeks;
      words.append(el('b', '', `${o.name} · ${money(o.amount)}`),
        el('span', '', `${o.weeks} weeks at ${(o.annual * 100).toFixed(1)}% · ${money(o.payment)}/wk · `
          + `${money(total - o.amount)} interest in all`));
      const btn = el('button', 'mr-st-btn is-go', 'Borrow');
      btn.disabled = r.loans.length >= r.maxLoans;
      btn.addEventListener('click', () => { clickSound(); if (r.borrow(k)) this.paint(); });
      card.append(words, btn);
      this.body.appendChild(card);
    });
    this.body.appendChild(el('div', 'mr-st-note',
      'Repayments come out every week with the rest of the spending. Borrow for something that will pay '
      + 'its way -- a loan the city cannot carry ends in the overdraft, and the overdraft charges interest too.'));
  }

  private income(r: StatsRead): void {
    const L = r.ledger;
    this.body.appendChild(section('Taxes by zone'));
    this.body.appendChild(this.composition(r));
    const bases = [r.bases.residents, r.bases.shopJobs, r.bases.worksJobs, r.bases.officeJobs];
    const baseName = ['residents', 'shop jobs', 'works jobs', 'office jobs'];
    const lines = [L.residential, L.commercial, L.industrial, L.office];
    const zoneTotal = sum(lines);
    for (let z = 0; z < 4; z++) {
      const card = el('div', 'mr-st-zone');
      card.style.setProperty('--tone', ZONE[z]);
      const head = el('div', 'mr-st-zone-head');
      head.append(swatch(ZONE[z]), el('span', 'mr-st-zone-name', ZONE_NAME[z]),
        el('span', 'mr-st-zone-rate', `${(r.rates[z] * 100).toFixed(1)}%`));
      card.append(head,
        row('A week', money(lines[z])),
        row('A month (so far)', money(r.current.income[z])),
        row('Share of taxes', pct(zoneTotal > 0 ? lines[z] / zoneTotal : 0)),
        row(`Levied on`, `${bases[z].toLocaleString()} ${baseName[z]}`),
        row('Per head a week', bases[z] > 0 ? money(lines[z] / bases[z]) : '—'));
      this.body.appendChild(card);
    }
    this.body.appendChild(section('Everything else'));
    this.lineRows(r, INCOME_LINES.slice(4), L.income, 'income');
    this.body.appendChild(section('All income, a week'));
    this.lineRows(r, INCOME_LINES, L.income, 'income');
  }

  private spending(r: StatsRead): void {
    const L = r.ledger;
    this.body.appendChild(section('All spending, a week'));
    this.lineRows(r, SPENDING_LINES, L.spending, 'spending');
    this.body.append(row(LINE_LABEL.congestion, money(L.congestion), L.congestion > 0 ? 'warn' : undefined));
    this.body.appendChild(el('div', 'mr-st-note',
      'Congestion is not a bill: it is tax the city did not collect because shops and works could not move their goods.'));

    this.body.appendChild(section('City services by branch'));
    const branches = r.branches.filter((b) => b.count > 0).sort((a, b) => b.upkeep - a.upkeep);
    if (branches.length === 0) { this.body.appendChild(el('div', 'mr-st-note', 'No services built yet.')); return; }
    const top = Math.max(1, ...branches.map((b) => b.upkeep));
    for (const b of branches) {
      const line = el('div', 'mr-st-bar-row');
      const name = el('div', 'mr-st-bar-name');
      name.append(swatch(b.colour), el('span', '', b.name));
      const track = el('div', 'mr-st-track');
      const fill = el('div', 'mr-st-fill');
      fill.style.width = `${(b.upkeep / top) * 100}%`;
      fill.style.background = SKIN.accent;
      track.appendChild(fill);
      const val = el('div', 'mr-st-bar-val', money(b.upkeep));
      line.append(name, track, val);
      this.hover(line, `${b.name}: ${money(b.upkeep)} a week, ${b.count} building${b.count === 1 ? '' : 's'}, `
        + `${money(b.upkeep / b.count)} each`);
      this.body.appendChild(line);
    }
    this.upkeepTable(r);
  }

  /** Upkeep by building type, dearest first. */
  private upkeepTable(r: StatsRead): void {
    this.body.appendChild(section('Upkeep by building'));
    const rows = [...r.buildings].sort((a, b) => b.total - a.total);
    const table = el('table', 'mr-st-table');
    const head = el('tr', '');
    for (const h of ['Building', 'Built', 'Each', 'A week']) head.appendChild(el('th', '', h));
    table.appendChild(head);
    for (const b of rows) {
      const tr = el('tr', '');
      const name = el('td', 'mr-st-td-name');
      name.append(swatch(b.colour), el('span', '', b.name));
      tr.append(name, el('td', '', `×${b.count}`), el('td', '', money(b.total / b.count)),
        el('td', '', money(b.total)));
      table.appendChild(tr);
    }
    const total = sum(rows.map((b) => b.total));
    const foot = el('tr', 'mr-st-total');
    foot.append(el('td', '', 'All services'), el('td', '', `×${sum(rows.map((b) => b.count))}`),
      el('td', '', ''), el('td', '', money(total)));
    table.appendChild(foot);
    const wrap = el('div', 'mr-st-scroll');
    wrap.appendChild(table);
    this.body.appendChild(wrap);
    this.body.appendChild(el('div', 'mr-st-note',
      'A building short of staff costs less, but never less than its fixed share: the building is there either way.'));
  }

  private historyTab(r: StatsRead): void {
    const chips = el('div', 'mr-st-chips');
    for (const m of METRICS) {
      const c = el('button', `mr-st-chip${m.id === this.metric ? ' is-on' : ''}`, m.label);
      c.addEventListener('click', () => { clickSound(); this.metric = m.id; this.paint(); });
      chips.appendChild(c);
    }
    const spans = el('div', 'mr-st-chips');
    for (const [n, label] of [[6, '6 mo'], [12, '1 yr'], [36, '3 yr']] as const) {
      const c = el('button', `mr-st-chip${n === this.span ? ' is-on' : ''}`, label);
      c.addEventListener('click', () => { clickSound(); this.span = n; this.paint(); });
      spans.appendChild(c);
    }
    this.body.append(chips, spans);
    const metric = METRICS.find((m) => m.id === this.metric) ?? METRICS[0];
    const months = r.history.months.slice(-this.span);
    if (months.length === 0) {
      this.body.appendChild(el('div', 'mr-st-note', 'No month has closed yet. Leave the city running and the record fills in.'));
      return;
    }
    this.body.appendChild(section(`${metric.label}, the last ${months.length} month${months.length === 1 ? '' : 's'}`));
    this.body.appendChild(this.columns(months, metric));

    this.body.appendChild(section('The books'));
    const table = el('table', 'mr-st-table');
    const head = el('tr', '');
    for (const h of ['Month', 'In', 'Out', 'Net', 'People']) head.appendChild(el('th', '', h));
    table.appendChild(head);
    for (const m of [...months].reverse()) {
      const tr = el('tr', '');
      const net = sum(m.income) - sum(m.spending);
      tr.append(el('td', '', label(m)), el('td', '', money(sum(m.income))),
        el('td', '', money(sum(m.spending))), el('td', net >= 0 ? 'is-good' : 'is-bad', signedMoney(net)),
        el('td', '', m.population.toLocaleString()));
      table.appendChild(tr);
    }
    const wrap = el('div', 'mr-st-scroll');
    wrap.appendChild(table);
    this.body.appendChild(wrap);
  }

  private peopleTab(r: StatsRead): void {
    const p = r.people;
    const tiles = el('div', 'mr-st-tiles');
    tiles.append(
      tile('Residents', p.population.toLocaleString(), `${p.households.toLocaleString()} households`),
      tile('Happiness', `${Math.round(p.happiness * 100)}%`, p.happiness > 0.6 ? 'content' : p.happiness > 0.45 ? 'restless' : 'unhappy'),
      tile('Employed', p.employed.toLocaleString(), `${p.jobs.toLocaleString()} jobs`),
      tile('Jobless', `${(p.unemployment * 100).toFixed(1)}%`, `${p.students.toLocaleString()} studying`),
    );
    this.body.appendChild(tiles);
    this.body.appendChild(section('Ages'));
    this.bars(p.stages, SKIN.accent, (n) => n.toLocaleString());
    this.body.appendChild(section('Education'));
    this.bars(p.edu, SKIN.accent, (n) => n.toLocaleString());
    this.body.appendChild(section('Since founding'));
    this.body.append(row('Born', p.births.toLocaleString()), row('Died', p.deaths.toLocaleString()),
      row('Moved in', p.arrived.toLocaleString()), row('Moved away', p.departed.toLocaleString()));
  }

  private travelTab(r: StatsRead): void {
    const t = r.travel;
    const tiles = el('div', 'mr-st-tiles');
    tiles.append(
      tile('Traffic speed', `${Math.round(t.speed)} km/h`, `${t.driving.toLocaleString()} on the road`),
      tile('Average trip', `${Math.round(t.meanMinutes)} min`, 'door to door'),
      tile('Worst road', pct(t.worstLoad), t.worstLoad > 1 ? 'over capacity' : 'of capacity'),
      tile('Jammed roads', t.congested.toLocaleString(), `of ${t.lanes.toLocaleString()} lanes`),
    );
    this.body.appendChild(tiles);
    this.body.appendChild(section('How people travel'));
    const total = Math.max(1, sum(t.modes.map(([, n]) => n)));
    this.bars(t.modes.map(([k, n]) => [k, n / total]), SKIN.accent, pct);
    this.body.appendChild(section('Right now'));
    this.body.append(
      row('Standing in queues', t.stopped.toLocaleString(), t.driving > 0 && t.stopped / t.driving > 0.3 ? 'warn' : undefined),
      row('Transit riders a day', t.riders.toLocaleString()),
      row('Days out across town', pct(t.crossTown)),
    );
    this.body.appendChild(el('div', 'mr-st-note',
      'Stadiums, landmarks and big parks pull trips from the whole city as it grows. '
      + 'The roads into them are where jams start.'));
  }

  private industryTab(r: StatsRead): void {
    const L = r.ledger;
    const tiles = el('div', 'mr-st-tiles');
    tiles.append(
      tile('Goods made', Math.round(L.goodsMade).toLocaleString(), 'a week'),
      tile('Goods wanted', Math.round(L.goodsWanted).toLocaleString(), 'by the shops'),
      tile('Export duty', money(L.exports), 'a week'),
      tile('Imports', money(L.imports), 'a week'),
    );
    this.body.appendChild(tiles);
    if (r.plants.length > 0) {
      this.body.appendChild(section('Processing plants'));
      for (const p of r.plants) {
        const card = el('div', 'mr-st-zone');
        card.style.setProperty('--tone', p.colour);
        const head = el('div', 'mr-st-zone-head');
        head.append(swatch(p.colour), el('span', 'mr-st-zone-name', p.name), el('span', 'mr-st-zone-rate', money(p.income)));
        card.append(head,
          row('Taking a week', `${Math.round(p.taken)} of ${Math.round(p.capacity * p.staffing)} units`,
            p.taken < p.capacity * p.staffing * 0.5 ? 'warn' : undefined),
          row('Staffed', pct(p.staffing), p.staffing < 0.6 ? 'warn' : undefined));
        this.body.appendChild(card);
      }
    }
    this.body.appendChild(section('Specialised industry'));
    if (r.industry.length === 0) {
      this.body.appendChild(el('div', 'mr-st-note', 'No industry headquarters yet. They unlock at level 3.'));
      return;
    }
    for (const h of r.industry) {
      const card = el('div', 'mr-st-zone');
      card.style.setProperty('--tone', h.colour);
      const head = el('div', 'mr-st-zone-head');
      head.append(swatch(h.colour), el('span', 'mr-st-zone-name', h.name), el('span', 'mr-st-zone-rate', money(h.income)));
      card.append(head,
        row('Produced a week', `${Math.round(h.units).toLocaleString()} units`),
        row('Shipped out / supplied here', `${Math.round(h.shipped)} / ${Math.round(h.local)}`),
        row('Staffed', pct(h.staffing), h.staffing < 0.6 ? 'warn' : undefined),
        row('Area', `${h.hectares.toFixed(1)} ha`),
        row('Resource left', pct(h.remaining), h.remaining < 0.25 ? 'bad' : h.remaining < 0.5 ? 'warn' : undefined));
      this.body.appendChild(card);
    }
  }

  // ---- pieces ----------------------------------------------------------------

  /** The four zone taxes and the rest, as one stacked bar with a legend. */
  private composition(r: StatsRead): HTMLElement {
    const L = r.ledger;
    const parts: Array<[string, number, string]> = [
      ...[L.residential, L.commercial, L.industrial, L.office].map((v, z) => [ZONE_NAME[z], v, ZONE[z]] as [string, number, string]),
      ['Other', L.exports + L.resources + L.fares + L.grant, OTHER],
    ];
    const total = Math.max(1, sum(parts.map((p) => p[1])));
    const wrap = el('div', 'mr-st-comp');
    const stack = el('div', 'mr-st-stack');
    const legend = el('div', 'mr-st-legend');
    for (const [name, v, colour] of parts) {
      if (v <= 0) continue;
      const seg = el('div', 'mr-st-seg');
      seg.style.flexGrow = String(v / total);
      seg.style.background = colour;
      this.hover(seg, `${name}: ${money(v)} a week, ${pct(v / total)}`);
      stack.appendChild(seg);
      const item = el('div', 'mr-st-legend-item');
      item.append(swatch(colour), el('span', '', name), el('b', '', pct(v / total)));
      legend.appendChild(item);
    }
    wrap.append(stack, legend);
    return wrap;
  }

  /** One row per ledger line: its share of the total, this week and this month. */
  private lineRows(r: StatsRead, lines: readonly string[], total: number, side: 'income' | 'spending'): void {
    const all = side === 'income' ? INCOME_LINES : SPENDING_LINES;
    for (const line of lines) {
      const v = (r.ledger as unknown as Record<string, number>)[line] ?? 0;
      const idx = (all as readonly string[]).indexOf(line);
      const month = idx >= 0 ? (side === 'income' ? r.current.income : r.current.spending)[idx] : 0;
      const bar = el('div', 'mr-st-bar-row');
      const name = el('div', 'mr-st-bar-name', LINE_LABEL[line as keyof typeof LINE_LABEL] ?? line);
      const track = el('div', 'mr-st-track');
      const fill = el('div', 'mr-st-fill');
      fill.style.width = `${total > 0 ? Math.min(100, (v / total) * 100) : 0}%`;
      fill.style.background = SKIN.accent;
      track.appendChild(fill);
      bar.append(name, track, el('div', 'mr-st-bar-val', money(v)));
      this.hover(bar, `${LINE_LABEL[line as keyof typeof LINE_LABEL] ?? line}: ${money(v)} a week `
        + `(${pct(total > 0 ? v / total : 0)}), ${money(month)} so far this month`);
      this.body.appendChild(bar);
    }
  }

  /** Horizontal bars for a small labelled set, one hue. */
  private bars(items: Array<[string, number]>, colour: string, fmt: (v: number) => string): void {
    const top = Math.max(1e-9, ...items.map(([, n]) => n));
    for (const [k, n] of items) {
      const line = el('div', 'mr-st-bar-row');
      const track = el('div', 'mr-st-track');
      const fill = el('div', 'mr-st-fill');
      fill.style.width = `${(n / top) * 100}%`;
      fill.style.background = colour;
      track.appendChild(fill);
      line.append(el('div', 'mr-st-bar-name', cap(k)), track, el('div', 'mr-st-bar-val', fmt(n)));
      this.body.appendChild(line);
    }
  }

  /**
   * A column per month for one measure, from a zero baseline. A measure that
   * can go negative gets its baseline where zero is, and its columns coloured
   * for the sign -- with the sign in the tooltip, not only in the colour.
   */
  private columns(months: Month[], metric: Metric): HTMLElement {
    const W = 380, H = 132, padL = 4, padR = 4, padT = 10, padB = 18;
    const vals = months.map(metric.of);
    const hi = Math.max(0, ...vals), lo = Math.min(0, ...vals);
    const range = hi - lo || 1;
    const y = (v: number): number => padT + (hi - v) / range * (H - padT - padB);
    const n = months.length;
    const slot = (W - padL - padR) / Math.max(n, 6);
    const bw = Math.max(3, Math.min(22, slot - 2));
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'mr-st-chart');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${metric.label} by month`);
    const zero = y(0);
    const line = document.createElementNS(svg.namespaceURI, 'line');
    line.setAttribute('x1', String(padL)); line.setAttribute('x2', String(W - padR));
    line.setAttribute('y1', String(zero)); line.setAttribute('y2', String(zero));
    line.setAttribute('class', 'mr-st-axis');
    svg.appendChild(line);
    for (let i = 0; i < n; i++) {
      const v = vals[i];
      const x = padL + i * slot + (slot - bw) / 2;
      const top = Math.min(y(v), zero), h = Math.max(1, Math.abs(y(v) - zero));
      const rect = document.createElementNS(svg.namespaceURI, 'rect');
      rect.setAttribute('x', x.toFixed(1)); rect.setAttribute('y', top.toFixed(1));
      rect.setAttribute('width', bw.toFixed(1)); rect.setAttribute('height', h.toFixed(1));
      rect.setAttribute('rx', String(Math.min(3, bw / 3)));
      rect.setAttribute('fill', metric.signed === true && v < 0 ? SKIN.bad : metric.signed === true ? SKIN.good : SKIN.accent);
      // A hit area the full height of the slot, so a thin bar is easy to point at.
      const hit = document.createElementNS(svg.namespaceURI, 'rect');
      hit.setAttribute('x', (padL + i * slot).toFixed(1)); hit.setAttribute('y', '0');
      hit.setAttribute('width', slot.toFixed(1)); hit.setAttribute('height', String(H));
      hit.setAttribute('fill', 'transparent');
      this.hover(hit as unknown as HTMLElement, `${label(months[i])}: ${metric.fmt(v)}`);
      svg.append(rect, hit);
      // Month names under every third column, and the last.
      if (i % 3 === 0 || i === n - 1) {
        const t = document.createElementNS(svg.namespaceURI, 'text');
        t.setAttribute('x', (x + bw / 2).toFixed(1)); t.setAttribute('y', String(H - 4));
        t.setAttribute('text-anchor', 'middle'); t.setAttribute('class', 'mr-st-tick');
        t.textContent = MONTH[months[i].month];
        svg.appendChild(t);
      }
    }
    const wrap = el('div', 'mr-st-chart-wrap');
    wrap.append(el('div', 'mr-st-scale', hi > 0 ? metric.fmt(hi) : ''), svg);
    if (lo < 0) wrap.appendChild(el('div', 'mr-st-scale', metric.fmt(lo)));
    return wrap;
  }

  /** A tooltip that follows the pointer over `target`. */
  private hover(target: HTMLElement | SVGElement, text: string): void {
    target.addEventListener('pointerenter', () => { this.tip.textContent = text; this.tip.hidden = false; });
    target.addEventListener('pointermove', (e) => {
      const box = this.pane.getBoundingClientRect();
      const x = Math.min(box.width - 12, Math.max(12, (e as PointerEvent).clientX - box.left));
      this.tip.style.left = `${x}px`;
      this.tip.style.top = `${(e as PointerEvent).clientY - box.top - 12}px`;
    });
    target.addEventListener('pointerleave', () => { this.tip.hidden = true; });
  }
}

// ---- helpers -----------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls !== '') e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function section(text: string): HTMLElement { return el('div', 'mr-st-section', text); }

function tile(cap: string, value: string, sub: string): HTMLElement {
  const t = el('div', 'mr-st-tile');
  t.append(el('div', 'mr-st-cap', cap), el('div', 'mr-st-val', value), el('div', 'mr-st-sub', sub));
  return t;
}

function row(name: string, value: string, tone?: 'warn' | 'bad'): HTMLElement {
  const r = el('div', 'mr-st-row');
  r.append(el('span', '', name), el('b', tone === undefined ? '' : `is-${tone}`, value));
  return r;
}

function swatch(colour: string): HTMLElement {
  const s = el('span', 'mr-st-sw');
  s.style.background = colour;
  return s;
}

/** Whole coins: a ledger shown to the penny is noise. */
function money(v: number): string { return rawMoney(Math.round(v)); }
const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0);
const pct = (v: number): string => `${Math.round(v * 100)}%`;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
function signedMoney(v: number): string { return `${v >= 0 ? '+' : '−'}${money(Math.abs(v))}`; }
function label(m: Month): string { return `${MONTH[m.month]} ${m.year}`; }
