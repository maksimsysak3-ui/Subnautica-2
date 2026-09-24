/**
 * City Hall: the phone's politics app.
 *
 * Three screens, one per phase of the political year -- the race, the count
 * and the term -- plus the locked door before the town is big enough to hold
 * an election. Everything on them is read from `Politics`; the only things the
 * player does here are the two the campaign allows: write their candidate's
 * platform, and pay for a rally.
 */

import { SKIN, css } from './skin';
import { glyph } from './glyphs';
import { portrait, crowd } from './portraits';
import { click as clickSound, deny } from './sound';
import {
  PLEDGES, pledgeById, ELECTION_POPULATION, RECALL_APPROVAL, TERM_DAYS,
} from '../sim/politics';
import type { Politics, Candidate, Issues } from '../sim/politics';
import { money } from '../sim';

export interface HallHost {
  politics(): Politics | null;
  issues(): Issues | null;
  population(): number;
  /** Fractional game days. */
  day(): number;
  balance(): number;
  /** Pays for and holds a rally; false if it could not. */
  rally(): boolean;
}

const CROWD = 72;

export class CityHall {
  readonly pane: HTMLElement;
  private shownVersion = -1;
  private shownPhase = '';
  private editing = false;

  constructor(private host: HallHost) {
    this.pane = document.createElement('div');
    this.pane.dataset.pane = 'hall';
    css(this.pane, ['flex:1', 'display:none', 'flex-direction:column', 'min-height:0',
      'overflow:auto', 'background:#10151c']);
  }

  /** Repaints if anything changed. Cheap to call every frame. */
  update(force = false): void {
    const p = this.host.politics();
    const v = p === null ? -2 : p.version;
    const phase = p?.phase ?? 'none';
    if (!force && v === this.shownVersion && phase === this.shownPhase) return;
    this.shownVersion = v;
    this.shownPhase = phase;
    const scroll = this.pane.scrollTop;
    this.pane.replaceChildren();
    if (p === null || p.phase === 'closed') this.paintClosed(p);
    else if (p.phase === 'campaign') this.paintCampaign(p);
    else if (p.phase === 'count') this.paintCount(p);
    else this.paintTerm(p);
    // The pane is a scrolling flex column, and a flex item with no content of
    // its own -- the poll bar -- shrinks to nothing when the column overflows.
    for (const el of Array.from(this.pane.children) as HTMLElement[]) el.style.flexShrink = '0';
    this.pane.scrollTop = scroll;
  }

  // ---- pieces --------------------------------------------------------------

  private band(title: string, sub: string, colour: string): HTMLElement {
    const el = document.createElement('div');
    css(el, ['display:flex', 'align-items:center', 'gap:10px', 'padding:12px 14px 11px',
      `background:linear-gradient(180deg, ${colour}33, transparent)`,
      `border-bottom:1px solid ${SKIN.edge}`]);
    const icon = document.createElement('span');
    css(icon, ['display:flex', `color:${colour}`]);
    icon.innerHTML = glyph('government', 22);
    const text = document.createElement('div');
    css(text, ['display:flex', 'flex-direction:column', 'gap:3px']);
    const t = document.createElement('div');
    css(t, ['font:800 15px/1 var(--display)', 'letter-spacing:.1em', 'text-transform:uppercase',
      `color:${SKIN.bright}`]);
    t.textContent = title;
    const s = document.createElement('div');
    css(s, ['font:600 11px/1.2 var(--ui)', `color:${SKIN.dim}`]);
    s.textContent = sub;
    text.append(t, s);
    el.append(icon, text);
    return el;
  }

  private section(title: string): HTMLElement {
    const el = document.createElement('div');
    css(el, ['font:700 12px/1 var(--label)', 'letter-spacing:.18em', 'text-transform:uppercase',
      `color:${SKIN.faint}`, 'padding:14px 14px 7px']);
    el.textContent = title;
    return el;
  }

  private chip(text: string, colour: string, locked = false): HTMLElement {
    const el = document.createElement('span');
    css(el, ['display:inline-flex', 'align-items:center', 'gap:4px', 'padding:3px 7px',
      'border-radius:6px', `background:${colour}1f`, `border:1px solid ${colour}55`,
      `color:${SKIN.text}`, 'font:600 12px/1.2 var(--ui)']);
    el.innerHTML = locked ? glyph('lock', 11) : '';
    el.append(text);
    return el;
  }

  private card(c: Candidate, share: number | null, leader: boolean): HTMLElement {
    const el = document.createElement('div');
    css(el, ['display:grid', 'grid-template-columns:58px 1fr auto', 'column-gap:10px',
      'row-gap:8px', 'align-items:center', 'margin:0 10px 8px', 'padding:9px 10px', 'border-radius:12px',
      `background:${leader ? `${c.colour}18` : 'rgba(255,255,255,.035)'}`,
      `border:1px solid ${leader ? `${c.colour}66` : 'rgba(255,255,255,.06)'}`]);
    const face = document.createElement('div');
    face.innerHTML = portrait(c.face, c.colour, 58);
    const who = document.createElement('div');
    css(who, ['display:flex', 'flex-direction:column', 'gap:4px', 'min-width:0']);
    const name = document.createElement('div');
    css(name, ['font:700 13px/1.1 var(--ui)', `color:${SKIN.bright}`]);
    name.textContent = c.name;
    if (c.player) {
      const you = document.createElement('span');
      css(you, ['margin-left:6px', 'padding:1px 5px', 'border-radius:4px',
        'background:var(--cyan)', 'color:#06121a', 'font:800 11px/1.3 var(--label)',
        'letter-spacing:.1em', 'vertical-align:2px']);
      you.textContent = 'YOU';
      name.appendChild(you);
    }
    const party = document.createElement('div');
    css(party, ['font:600 12px/1.2 var(--ui)', `color:${c.colour}`]);
    party.textContent = `${c.party} · “${c.slogan}”`;
    const pledges = document.createElement('div');
    css(pledges, ['display:flex', 'flex-wrap:wrap', 'gap:3px', 'grid-column:1/-1']);
    for (const id of c.pledges) pledges.appendChild(this.chip(pledgeById(id)?.name ?? id, c.colour));
    if (c.pledges.length === 0) {
      const none = document.createElement('span');
      css(none, ['font:italic 500 10.5px/1.2 var(--ui)', `color:${SKIN.faint}`]);
      none.textContent = 'No platform yet';
      pledges.appendChild(none);
    }
    who.append(name, party);
    el.append(face, who);
    if (share !== null) {
      const pct = document.createElement('div');
      css(pct, ['font:800 22px/1 var(--display)', `color:${leader ? c.colour : SKIN.text}`,
        'font-variant-numeric:tabular-nums']);
      pct.textContent = `${Math.round(share * 100)}%`;
      el.appendChild(pct);
    }
    el.appendChild(pledges);
    return el;
  }

  /** One bar for the whole race, each candidate a segment. */
  private stack(shares: number[], cands: Candidate[]): HTMLElement {
    const el = document.createElement('div');
    css(el, ['display:flex', 'height:10px', 'margin:0 14px', 'border-radius:5px',
      'overflow:hidden', 'box-shadow:inset 0 0 0 1px rgba(0,0,0,.3)']);
    shares.forEach((s, i) => {
      const seg = document.createElement('div');
      css(seg, [`flex:${Math.max(0.001, s)}`, `background:${cands[i]?.colour ?? '#888'}`,
        'transition:flex .6s ease']);
      el.appendChild(seg);
    });
    return el;
  }

  /** The poll's history as three lines. */
  private trend(p: Politics): HTMLElement {
    const el = document.createElement('div');
    css(el, ['margin:8px 14px 0']);
    const h = p.history;
    if (h.length < 2) return el;
    const W = 256, H = 54;
    let paths = '';
    p.candidates.forEach((c, i) => {
      const pts = h.map((row, k) =>
        `${((k / (h.length - 1)) * W).toFixed(1)},${(H - (row[i] ?? 0) * H).toFixed(1)}`);
      paths += `<polyline points="${pts.join(' ')}" fill="none" stroke="${c.colour}"`
        + ` stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    });
    el.innerHTML = `<svg viewBox="-2 -2 ${W + 4} ${H + 4}" width="100%" height="${H + 4}"`
      + ' preserveAspectRatio="none">'
      + `<line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="rgba(255,255,255,.1)"`
      + ' stroke-dasharray="3 4"/>' + paths + '</svg>';
    return el;
  }

  private news(p: Politics, max = 5): HTMLElement {
    const el = document.createElement('div');
    css(el, ['display:flex', 'flex-direction:column', 'gap:1px', 'padding:0 10px 14px']);
    for (const h of p.headlines.slice(0, max)) {
      const row = document.createElement('div');
      const tone = h.tone === 'good' ? SKIN.good : h.tone === 'bad' ? SKIN.bad : SKIN.dim;
      css(row, ['display:grid', 'grid-template-columns:3px 1fr', 'gap:9px', 'padding:7px 4px',
        `border-bottom:1px solid ${SKIN.edge}`]);
      const bar = document.createElement('span');
      css(bar, [`background:${tone}`, 'border-radius:2px']);
      const text = document.createElement('div');
      css(text, ['font:500 11.5px/1.4 var(--ui)', `color:${SKIN.text}`]);
      text.textContent = h.text;
      row.append(bar, text);
      el.appendChild(row);
    }
    return el;
  }

  // ---- the screens ---------------------------------------------------------

  private paintClosed(p: Politics | null): void {
    const pop = this.host.population();
    this.pane.appendChild(this.band('City Hall', 'Opens with the first election', SKIN.dim));
    const body = document.createElement('div');
    css(body, ['display:flex', 'flex-direction:column', 'align-items:center', 'gap:12px',
      'padding:22px 18px', 'text-align:center']);
    const faces = document.createElement('div');
    css(faces, ['display:flex', 'gap:6px', 'filter:grayscale(1)', 'opacity:.45']);
    faces.innerHTML = portrait(11, '#888', 58) + portrait(29, '#888', 58) + portrait(47, '#888', 58);
    const title = document.createElement('div');
    css(title, ['font:700 15px/1.3 var(--ui)', `color:${SKIN.bright}`]);
    title.textContent = `Elections start at ${ELECTION_POPULATION.toLocaleString()} residents`;
    const track = document.createElement('div');
    css(track, ['width:100%', 'height:8px', 'border-radius:4px', `background:${SKIN.track}`,
      'overflow:hidden']);
    const fill = document.createElement('div');
    css(fill, ['height:100%', `width:${Math.min(100, (pop / ELECTION_POPULATION) * 100).toFixed(1)}%`,
      'background:var(--amber)', 'border-radius:4px']);
    track.appendChild(fill);
    const count = document.createElement('div');
    css(count, ['font:600 11px/1 var(--label)', 'letter-spacing:.12em', `color:${SKIN.dim}`,
      'text-transform:uppercase']);
    count.textContent = `${pop.toLocaleString()} / ${ELECTION_POPULATION.toLocaleString()}`;
    const about = document.createElement('div');
    css(about, ['font:500 12px/1.5 var(--ui)', `color:${SKIN.dim}`]);
    about.textContent = 'Once the town is big enough to argue, three candidates will stand for '
      + 'mayor -- one of them yours. Platforms are real city policies, people vote on how the '
      + 'city is treating them, and whatever the winner promised becomes law for the term.';
    body.append(faces, title, track, count, about);
    this.pane.appendChild(body);
    void p;
  }

  private paintCampaign(p: Politics): void {
    const day = this.host.day();
    const left = p.daysLeft(day);
    this.pane.appendChild(this.band('Election', `Polling day in ${left} day${left === 1 ? '' : 's'}`,
      '#f2b544'));

    this.pane.appendChild(this.section('Latest poll'));
    this.pane.appendChild(this.stack(p.poll, p.candidates));
    this.pane.appendChild(this.trend(p));
    const lead = p.poll.indexOf(Math.max(...p.poll));
    const list = document.createElement('div');
    css(list, ['padding-top:10px']);
    p.candidates.forEach((c, i) => list.appendChild(this.card(c, p.poll[i] ?? 0, i === lead)));
    this.pane.appendChild(list);

    // ---- the player's own campaign ----
    const you = p.yours;
    if (you !== null) {
      this.pane.appendChild(this.section(`Your candidate · ${you.name}`));
      const actions = document.createElement('div');
      css(actions, ['display:flex', 'gap:6px', 'padding:0 10px']);
      const cost = p.rallyCost(this.host.population());
      const rally = this.button(`Hold a rally · ${money(cost)}`, '#f2b544',
        p.canRally(day) && this.host.balance() >= cost);
      rally.addEventListener('click', () => {
        if (this.host.rally()) clickSound(); else deny();
        this.update(true);
      });
      const edit = this.button(this.editing ? 'Done' : 'Write the platform', SKIN.accent, true);
      edit.addEventListener('click', () => { clickSound(); this.editing = !this.editing; this.update(true); });
      actions.append(edit, rally);
      this.pane.appendChild(actions);
      if (!p.canRally(day)) {
        const note = document.createElement('div');
        css(note, ['font:500 12px/1.4 var(--ui)', `color:${SKIN.faint}`, 'padding:6px 14px 0']);
        note.textContent = 'One rally every two days. The crowd needs to miss you.';
        this.pane.appendChild(note);
      }
      if (this.editing) this.pane.appendChild(this.editor(p, you, day));
    }

    this.pane.appendChild(this.section('On the trail'));
    this.pane.appendChild(this.news(p));
  }

  /** The platform: every pledge, how it is playing in this city, and a switch. */
  private editor(p: Politics, you: Candidate, day: number): HTMLElement {
    const el = document.createElement('div');
    css(el, ['display:flex', 'flex-direction:column', 'gap:4px', 'padding:10px 10px 0']);
    const hint = document.createElement('div');
    css(hint, ['font:500 11px/1.4 var(--ui)', `color:${SKIN.dim}`, 'padding:0 4px 4px']);
    hint.textContent = 'Up to three. The bars are how each would play with voters today; '
      + 'win, and your picks become law for the term.';
    el.appendChild(hint);
    const issues = this.host.issues();
    for (const pl of PLEDGES) {
      const on = you.pledges.includes(pl.id);
      const row = document.createElement('button');
      css(row, ['display:grid', 'grid-template-columns:1fr auto', 'gap:8px', 'align-items:center',
        'padding:7px 9px', 'border-radius:9px', 'cursor:pointer', 'text-align:left',
        `background:${on ? 'rgba(111,211,255,.14)' : 'rgba(255,255,255,.03)'}`,
        `border:1px solid ${on ? 'rgba(111,211,255,.55)' : 'transparent'}`, 'font:inherit']);
      const text = document.createElement('div');
      text.innerHTML = `<div style="font:700 12px/1.2 var(--ui);color:${SKIN.bright}">${pl.name}</div>`
        + `<div style="font:500 12px/1.3 var(--ui);color:${SKIN.dim}">${pl.pitch}</div>`;
      const heat = issues === null ? 0 : Math.max(0, Math.min(1, pl.appeal(issues) / 0.4));
      const bars = document.createElement('div');
      css(bars, ['display:flex', 'gap:2px', 'align-items:flex-end']);
      for (let k = 0; k < 4; k++) {
        const b = document.createElement('span');
        css(b, ['width:4px', `height:${5 + k * 3}px`, 'border-radius:1px',
          `background:${heat * 4 > k + 0.3 ? SKIN.good : 'rgba(255,255,255,.12)'}`]);
        bars.appendChild(b);
      }
      row.append(text, bars);
      row.addEventListener('click', () => {
        const next = on ? you.pledges.filter((x) => x !== pl.id)
          : you.pledges.length >= 3 ? null : [...you.pledges, pl.id];
        if (next === null) { deny(); return; }
        clickSound();
        p.setPledges(day, next);
        this.update(true);
      });
      el.appendChild(row);
    }
    return el;
  }

  private paintCount(p: Politics): void {
    const t = p.counted;
    this.pane.appendChild(this.band('Election night', `${Math.round(t * 100)}% of the vote counted`,
      '#ff7a6b'));
    // Early boxes do not look like the final result: the running share leans
    // off the truth and settles onto it as the count goes on.
    const running = p.result.map((s, i) => Math.max(0.01,
      s + (1 - t) * 0.12 * Math.sin(p.elections * 3 + i * 2.1 + t * 9)));
    const sum = running.reduce((a, b) => a + b, 0);
    const shares = running.map((s) => s / sum);

    const room = document.createElement('div');
    css(room, ['margin:12px 10px 4px', 'padding:10px', 'border-radius:12px',
      'background:#f1e9d8', 'box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)']);
    room.innerHTML = crowd(this.voters(p), p.candidates.map((c) => c.colour), Math.floor(t * CROWD));
    this.pane.appendChild(room);

    const lead = shares.indexOf(Math.max(...shares));
    const list = document.createElement('div');
    css(list, ['padding-top:8px']);
    p.candidates.forEach((c, i) => list.appendChild(this.card(c, shares[i], i === lead)));
    this.pane.appendChild(list);
  }

  /** Who each little figure voted for, in the order they are counted. */
  private voters(p: Politics): number[] {
    const out: number[] = [];
    p.result.forEach((s, i) => { for (let k = 0; k < Math.round(s * CROWD); k++) out.push(i); });
    while (out.length < CROWD) out.push(0);
    out.length = CROWD;
    // A fixed shuffle, so figures do not change sides between frames.
    let seed = 7 + p.elections * 13;
    for (let i = out.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const j = seed % (i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  private paintTerm(p: Politics): void {
    const m = p.mayor;
    if (m === null) { this.paintClosed(p); return; }
    const day = this.host.day();
    const left = p.daysLeft(day);
    this.pane.appendChild(this.band('City Hall', `${left} day${left === 1 ? '' : 's'} left in the term`,
      m.colour));

    const hero = document.createElement('div');
    css(hero, ['display:flex', 'flex-direction:column', 'align-items:center', 'gap:6px',
      'padding:16px 14px 6px', 'text-align:center']);
    const face = document.createElement('div');
    face.innerHTML = portrait(m.face, m.colour, 96);
    const title = document.createElement('div');
    css(title, ['font:600 12px/1 var(--label)', 'letter-spacing:.2em', 'text-transform:uppercase',
      `color:${m.colour}`]);
    title.textContent = m.player ? 'Mayor · your candidate' : `Mayor · ${m.party}`;
    const name = document.createElement('div');
    css(name, ['font:800 22px/1 var(--display)', 'letter-spacing:.05em', `color:${SKIN.bright}`]);
    name.textContent = m.name;
    hero.append(face, title, name);
    this.pane.appendChild(hero);

    // Approval, with the recall line drawn on it.
    this.pane.appendChild(this.section('Approval'));
    const gauge = document.createElement('div');
    css(gauge, ['position:relative', 'height:12px', 'margin:0 14px', 'border-radius:6px',
      `background:${SKIN.track}`]);
    const fill = document.createElement('div');
    const a = p.approval;
    css(fill, ['height:100%', 'border-radius:6px', `width:${(a * 100).toFixed(1)}%`,
      `background:${a < RECALL_APPROVAL ? SKIN.bad : a < 0.45 ? SKIN.warn : SKIN.good}`,
      'transition:width .6s ease']);
    const mark = document.createElement('div');
    css(mark, ['position:absolute', 'top:-3px', 'bottom:-3px', `left:${RECALL_APPROVAL * 100}%`,
      'width:2px', `background:${SKIN.bad}`]);
    gauge.append(fill, mark);
    const read = document.createElement('div');
    css(read, ['display:flex', 'justify-content:space-between', 'padding:6px 14px 0',
      'font:600 11px/1.2 var(--ui)', `color:${SKIN.dim}`]);
    read.innerHTML = `<span style="color:${SKIN.bright}">${Math.round(a * 100)}% approve</span>`
      + '<span>recall below 22% for a week</span>';
    this.pane.append(gauge, read);

    // The mandate, pinned.
    this.pane.appendChild(this.section(m.player ? 'Your platform, now law' : 'Their mandate, now law'));
    const pins = document.createElement('div');
    css(pins, ['display:flex', 'flex-direction:column', 'gap:4px', 'padding:0 10px']);
    for (const id of m.pledges) {
      const pl = pledgeById(id);
      if (pl === undefined) continue;
      const row = document.createElement('div');
      css(row, ['display:flex', 'align-items:center', 'gap:9px', 'padding:8px 10px',
        'border-radius:9px', `background:${m.colour}14`, `border:1px solid ${m.colour}44`]);
      row.innerHTML = `<span style="display:flex;color:${m.colour}">${glyph('lock', 15)}</span>`
        + `<div><div style="font:700 12px/1.2 var(--ui);color:${SKIN.bright}">${pl.name}</div>`
        + `<div style="font:500 12px/1.3 var(--ui);color:${SKIN.dim}">${pl.pitch}</div></div>`;
      pins.appendChild(row);
    }
    const note = document.createElement('div');
    css(note, ['font:500 12px/1.45 var(--ui)', `color:${SKIN.faint}`, 'padding:8px 14px 0']);
    note.textContent = `Pinned until the next election. A term is ${TERM_DAYS} days; keep the city `
      + 'happy and solvent, and the mayor keeps the people’s patience.';
    this.pane.appendChild(pins);
    this.pane.appendChild(note);

    this.pane.appendChild(this.section('City news'));
    this.pane.appendChild(this.news(p));
  }

  private button(text: string, colour: string, enabled: boolean): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = text;
    b.disabled = !enabled;
    css(b, ['flex:1', 'padding:9px 8px', 'border-radius:9px', 'cursor:pointer',
      `border:1px solid ${colour}88`, `background:${colour}22`, `color:${SKIN.bright}`,
      'font:700 11.5px/1.1 var(--ui)', enabled ? '' : 'opacity:.4;cursor:not-allowed']);
    return b;
  }
}
