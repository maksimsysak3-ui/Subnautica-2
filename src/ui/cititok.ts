/**
 * Cititok: the phone the city is posting from.
 *
 * Every number in this game is true and almost none of it is *said*. The
 * complaints panel knows four hundred buildings have no water; the happiness
 * figure knows the city is miserable; the traffic model knows the ring road is
 * a car park. A player reads those as bars on a card, once, if they open the
 * right panel.
 *
 * So the city gets a social feed. Every post is generated from something the
 * simulation actually holds -- a gripe that is currently the most common one, a
 * goal just met, the week's net, how fast the traffic is moving -- and written
 * the way somebody who lives there would put it. It is the same information the
 * panels carry, in the voice of the people it is happening to, which is the one
 * register a city builder never uses and the one that makes a city feel
 * inhabited.
 *
 * The phone is a phone: a slab with a notch, a status bar, a feed that scrolls,
 * and posts that arrive while it is open. It has two apps on it, because one
 * app on a phone is a mockup of a phone -- the feed, and the weather.
 */

import { SKIN, css, panel, label, tip } from './skin';
import { click as clickSound, ping } from './sound';
import type { Sky } from '../sim/weather';

/**
 * The weather, as the phone's second app reads it.
 *
 * The outlook is a real forecast, not a decoration: the model is a noise field
 * on the clock, so the sky six hours from now is the same lookup at a different
 * argument -- see `Weather.ahead`. What the app promises is what arrives.
 */
export interface WeatherRead {
  now: Sky;
  label: string;
  glyph: string;
  /** Hour of the game day, 0 to 24. */
  hour: number;
  /** Degrees celsius, and the wind in kilometres an hour. Both derived. */
  temp: number;
  wind: number;
  city: string;
  /** Hours ahead, and what the sky will be doing then. */
  outlook: Array<{ hour: number; label: string; glyph: string; sky: Sky; temp: number }>;
}

/** What the feed is built from: a reading, and how to phrase it. */
export interface CityMood {
  population: number;
  happiness: number;
  /** The most common complaint right now, as its title, or ''. */
  worstGripe: string;
  gripeCount: number;
  /** Mean traffic speed in kilometres an hour, and how many are driving. */
  speed: number;
  driving: number;
  /** The week's bottom line. */
  net: number;
  /** Share of buildings with power and water. */
  power: number;
  water: number;
  /** Bus and tram riders a day. */
  riders: number;
  /** What the city is called. */
  city: string;
  level: number;
}

interface Post {
  handle: string;
  text: string;
  likes: number;
  when: string;
  tone: 'good' | 'bad' | 'flat';
}

const HANDLES = [
  'nia_walks', 'ferrybridge_dan', 'tram_nerd', 'south_quarter', 'mrs_okafor',
  'late_shift_lee', 'allotment_pat', 'cyclist_jo', 'nightbus_ray', 'harbour_kid',
  'two_dogs_one_flat', 'civic_watch', 'park_run_sam', 'the_chip_shop',
  'planning_gripes', 'rooftop_mika',
];

/** One post, from one reading. Deterministic per reading, so it reads as real. */
function postsFor(m: CityMood, seed: number): Post[] {
  const out: Post[] = [];
  const pick = (n: number): string => HANDLES[(seed + n * 7) % HANDLES.length];
  const likes = (n: number): number =>
    Math.max(1, Math.round((m.population / 90 + 3) * (1 + ((seed * n) % 7) / 4)));

  if (m.worstGripe !== '') {
    out.push({
      handle: pick(1),
      text: `${m.gripeCount} buildings round here with the same problem: `
        + `${m.worstGripe.toLowerCase()}. Anyone at the council awake?`,
      likes: likes(3), when: 'now', tone: 'bad',
    });
  }
  if (m.power < 0.98 && m.population > 0) {
    out.push({
      handle: pick(2),
      text: `Lights went again. ${Math.round((1 - m.power) * 100)}% of the city `
        + 'is on a network that cannot cover it. Candles it is.',
      likes: likes(5), when: '2m', tone: 'bad',
    });
  } else if (m.population > 200) {
    out.push({
      handle: pick(2),
      text: 'Power has been solid all week, which is the nicest thing I will '
        + 'say about this place today.',
      likes: likes(2), when: '4m', tone: 'good',
    });
  }
  if (m.water < 0.95 && m.population > 0) {
    out.push({
      handle: pick(4),
      text: 'Tap ran brown again. Whoever is in charge of the water: we can '
        + 'see the river from here.',
      likes: likes(6), when: '11m', tone: 'bad',
    });
  }
  if (m.driving > 120) {
    out.push({
      handle: pick(6),
      text: m.speed < 18
        ? `${Math.round(m.speed)} km/h across town at this hour. I have walked it faster. `
          + 'I have *crawled* it faster.'
        : `Traffic actually moving today — ${Math.round(m.speed)} km/h. `
          + 'Do not jinx it.',
      likes: likes(4), when: '18m', tone: m.speed < 18 ? 'bad' : 'good',
    });
  }
  if (m.riders > 40) {
    out.push({
      handle: pick(8),
      text: `${Math.round(m.riders).toLocaleString()} of us on the buses today. `
        + 'Standing room only on the 3.',
      likes: likes(7), when: '25m', tone: 'good',
    });
  }
  if (m.net < 0) {
    out.push({
      handle: 'civic_watch',
      text: `${m.city} is losing money every week and the budget is public. `
        + 'Someone is going to have to say the word "tax".',
      likes: likes(9), when: '40m', tone: 'bad',
    });
  } else if (m.net > 0 && m.population > 300) {
    out.push({
      handle: 'civic_watch',
      text: `Books balanced again this week. Whoever is running ${m.city} `
        + 'can stay, for now.',
      likes: likes(8), when: '40m', tone: 'good',
    });
  }
  if (m.happiness > 0.7) {
    out.push({
      handle: pick(10),
      text: 'Honestly? Good place to live at the moment. Everything works and '
        + 'the park is full.',
      likes: likes(11), when: '1h', tone: 'good',
    });
  } else if (m.happiness < 0.42 && m.population > 100) {
    out.push({
      handle: pick(10),
      text: 'Everyone I know is talking about leaving. That is not a mood, '
        + 'that is a warning.',
      likes: likes(12), when: '1h', tone: 'bad',
    });
  }
  if (out.length < 4 && m.population > 0) {
    out.push({
      handle: pick(13),
      text: `Level ${m.level} city now. ${m.population.toLocaleString()} of us. `
        + 'Remember when this was a field?',
      likes: likes(14), when: '2h', tone: 'flat',
    });
  }
  if (m.population === 0) {
    out.push({
      handle: 'planning_gripes',
      text: 'Nothing here yet but a road and a very confident plan.',
      likes: 2, when: 'now', tone: 'flat',
    });
  }
  return out;
}

export class Cititok {
  private readonly root: HTMLElement;
  private readonly launcher: HTMLElement;
  private readonly feed: HTMLElement;
  private readonly bar: HTMLElement;
  /** The two apps, and the dock buttons that switch between them. */
  private readonly feedPane: HTMLElement;
  private readonly skyPane: HTMLElement;
  private readonly tabs: HTMLElement[] = [];
  private app: 'feed' | 'weather' = 'feed';
  private shown = false;
  private seed = 3;
  private lastAt = 0;

  constructor(parent: HTMLElement, private read: () => CityMood | null,
    private readWeather: () => WeatherRead | null = () => null) {
    // The button lives on the edge of the screen rather than on the bar: the
    // bar is for building, and this is not a tool.
    this.launcher = document.createElement('button');
    css(this.launcher, [...panel(), 'position:absolute', 'right:12px',
      'top:50%', 'transform:translateY(-50%)', 'width:44px', 'height:60px',
      'display:grid', 'place-items:center', 'cursor:pointer', 'padding:0',
      'pointer-events:auto', 'z-index:24', 'gap:3px']);
    this.launcher.innerHTML =
      '<svg width="17" height="26" viewBox="0 0 17 26" fill="none" '
      + `stroke="${SKIN.accent}" stroke-width="1.6">`
      + '<rect x="1" y="1" width="15" height="24" rx="3"/>'
      + `<line x1="6.5" y1="3.4" x2="10.5" y2="3.4" stroke="${SKIN.accent}"/></svg>`;
    tip(this.launcher, 'Cititok — what the city is posting, and the weather', 'C');
    this.launcher.addEventListener('click', () => { clickSound(); this.toggle(); });
    parent.appendChild(this.launcher);

    this.root = document.createElement('div');
    this.root.dataset.panel = 'cititok';
    css(this.root, ['position:absolute', 'right:66px', 'top:50%',
      'transform:translateY(-50%) scale(.96)', 'z-index:25', 'display:none',
      'opacity:0', 'transition:opacity .18s, transform .22s cubic-bezier(.2,.9,.3,1.1)',
      'pointer-events:auto']);

    // The phone: a slab with a notch and a screen in it.
    const phone = document.createElement('div');
    css(phone, ['width:304px', 'height:min(560px, 74vh)', 'border-radius:30px',
      'padding:9px', 'background:linear-gradient(160deg,#20262f,#0b0e13)',
      'border:1px solid rgba(255,255,255,.14)', 'display:flex',
      'box-shadow:0 30px 70px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.14)']);

    const screen = document.createElement('div');
    css(screen, ['flex:1', 'border-radius:22px', 'overflow:hidden',
      'display:flex', 'flex-direction:column', `background:${SKIN.panelSolid}`,
      'position:relative']);

    const notch = document.createElement('div');
    css(notch, ['position:absolute', 'left:50%', 'top:0',
      'transform:translateX(-50%)', 'width:96px', 'height:18px',
      'background:#0b0e13', 'border-radius:0 0 12px 12px', 'z-index:3']);

    this.bar = document.createElement('div');
    css(this.bar, ['display:flex', 'align-items:center', 'gap:8px',
      'padding:6px 14px 4px', `color:${SKIN.dim}`, 'font-size:9.5px',
      'font-variant-numeric:tabular-nums']);

    const head = document.createElement('div');
    css(head, ['display:flex', 'align-items:center', 'gap:8px',
      'padding:8px 14px 10px', `border-bottom:1px solid ${SKIN.edge}`]);
    const brand = document.createElement('div');
    css(brand, [`color:${SKIN.bright}`, 'font-size:14px', 'letter-spacing:.02em']);
    brand.innerHTML = `Citi<span style="color:${SKIN.accent}">tok</span>`;
    const sub = document.createElement('div');
    css(sub, [...label(), 'font-size:8px', 'margin-left:auto']);
    sub.textContent = 'your city, posting';
    head.append(brand, sub);

    this.feed = document.createElement('div');
    css(this.feed, ['flex:1', 'overflow:auto', 'display:flex',
      'flex-direction:column', 'gap:1px', 'padding:2px 0 10px']);

    this.feedPane = document.createElement('div');
    css(this.feedPane, ['flex:1', 'display:flex', 'flex-direction:column',
      'min-height:0']);
    this.feedPane.append(head, this.feed);

    this.skyPane = document.createElement('div');
    this.skyPane.dataset.pane = 'weather';
    css(this.skyPane, ['flex:1', 'display:none', 'flex-direction:column',
      'min-height:0', 'overflow:auto']);

    // The dock. Two apps, so it is two buttons -- and it is at the bottom of
    // the screen because that is where a phone puts them.
    const dock = document.createElement('div');
    css(dock, ['display:flex', 'gap:6px', 'padding:7px 10px 9px',
      `border-top:1px solid ${SKIN.edge}`, 'background:rgba(0,0,0,.18)']);
    const addTab = (name: string, glyph: string, app: 'feed' | 'weather'): void => {
      const b = document.createElement('button');
      b.dataset.app = app;
      css(b, ['flex:1', 'display:flex', 'flex-direction:column',
        'align-items:center', 'gap:2px', 'padding:5px 0 3px', 'cursor:pointer',
        'border:1px solid transparent', 'border-radius:11px',
        'background:transparent', `color:${SKIN.dim}`, 'font-size:8.5px',
        'letter-spacing:.09em', 'text-transform:uppercase', 'font-family:inherit']);
      b.innerHTML = `<span style="font-size:15px;line-height:1">${glyph}</span>`;
      const cap = document.createElement('span');
      cap.textContent = name;
      b.appendChild(cap);
      b.addEventListener('click', () => { clickSound(); this.showApp(app); });
      dock.appendChild(b);
      this.tabs.push(b);
    };
    addTab('Feed', '\u25a4', 'feed');
    addTab('Weather', '\u26c5', 'weather');

    screen.append(notch, this.bar, this.feedPane, this.skyPane, dock);
    phone.appendChild(screen);
    this.root.appendChild(phone);
    parent.appendChild(this.root);

    window.addEventListener('keydown', (e) => {
      const typing = (e.target as HTMLElement | null)?.tagName === 'INPUT';
      if (typing || e.ctrlKey || e.metaKey) return;
      if (e.key === 'c' || e.key === 'C') this.toggle();
      else if (this.shown && (e.key === 'w' || e.key === 'W')) {
        this.showApp(this.app === 'weather' ? 'feed' : 'weather');
      }
      else if (e.key === 'Escape' && this.shown) this.close();
    });
  }

  set visible(on: boolean) {
    this.launcher.style.display = on ? 'grid' : 'none';
    if (!on) this.close();
  }

  get open(): boolean { return this.shown; }

  /** Switches apps, and paints the one being switched to. */
  showApp(app: 'feed' | 'weather'): void {
    this.app = app;
    this.feedPane.style.display = app === 'feed' ? 'flex' : 'none';
    this.skyPane.style.display = app === 'weather' ? 'flex' : 'none';
    for (const b of this.tabs) {
      const on = b.dataset.app === app;
      b.style.color = on ? SKIN.bright : SKIN.dim;
      b.style.borderColor = on ? SKIN.edge : 'transparent';
      b.style.background = on ? 'rgba(255,255,255,.055)' : 'transparent';
    }
    if (app === 'weather') this.paintWeather();
  }

  toggle(): void { if (this.shown) this.close(); else this.show(); }

  show(): void {
    this.shown = true;
    this.root.style.display = 'block';
    this.showApp(this.app);
    this.refresh(true);
    requestAnimationFrame(() => {
      this.root.style.opacity = '1';
      this.root.style.transform = 'translateY(-50%) scale(1)';
    });
  }

  close(): void {
    this.shown = false;
    this.root.style.opacity = '0';
    this.root.style.transform = 'translateY(-50%) scale(.96)';
    setTimeout(() => { if (!this.shown) this.root.style.display = 'none'; }, 180);
  }

  /** Called from the frame. Refreshes on a slow beat while it is open. */
  update(now: number): void {
    if (!this.shown) return;
    if (now - this.lastAt < 5200) return;
    this.refresh(false);
  }

  private refresh(quiet: boolean): void {
    this.lastAt = performance.now();
    const mood = this.read();
    if (mood === null) return;
    this.seed = (this.seed + 1) % 977;

    this.bar.innerHTML = '';
    const time = document.createElement('span');
    // The phone is in the city, so it is on the city's clock. A real-world
    // wall clock here read as a bug the moment the weather app put the game's
    // own time two lines below it.
    const w = this.readWeather();
    const hour = w === null ? 0 : ((w.hour % 24) + 24) % 24;
    time.textContent = `${String(Math.floor(hour)).padStart(2, '0')}:`
      + `${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}`;
    const spacer = document.createElement('span');
    css(spacer, ['margin-left:auto']);
    const signal = document.createElement('span');
    signal.textContent = `${mood.city} · ${Math.round(mood.happiness * 100)}% happy`;
    this.bar.append(time, spacer, signal);

    if (this.app === 'weather') this.paintWeather();
    const posts = postsFor(mood, this.seed);
    this.feed.innerHTML = '';
    for (const post of posts) this.feed.appendChild(this.card(post));
    if (!quiet && posts.length > 0 && this.app === 'feed') ping();
  }

  /**
   * The weather app.
   *
   * Everything on it is read off the same model the sky over the city is drawn
   * from, including the six hours of outlook -- so a player who sees rain
   * coming on the phone sees it arrive out of the window.
   */
  private paintWeather(): void {
    const w = this.readWeather();
    this.skyPane.innerHTML = '';
    if (w === null) return;
    const hh = (h: number): string =>
      `${String(Math.floor(((h % 24) + 24) % 24)).padStart(2, '0')}:00`;

    // The headline: glyph, temperature, condition, place.
    const hero = document.createElement('div');
    css(hero, ['display:flex', 'flex-direction:column', 'align-items:center',
      'gap:2px', 'padding:18px 14px 14px',
      `background:linear-gradient(180deg,${skyWash(w.now)},transparent)`]);
    const place = document.createElement('div');
    css(place, [...label(), 'font-size:8.5px']);
    // The city's own clock, to the minute -- the outlook below rounds to the
    // hour because a forecast does, but the headline is what it is now.
    const mins = Math.floor((((w.hour % 24) + 24) % 24 % 1) * 60);
    place.textContent = `${w.city} · `
      + `${String(Math.floor(((w.hour % 24) + 24) % 24)).padStart(2, '0')}:`
      + `${String(mins).padStart(2, '0')}`;
    const glyph = document.createElement('div');
    css(glyph, ['font-size:52px', 'line-height:1.05']);
    glyph.textContent = w.glyph;
    const temp = document.createElement('div');
    css(temp, [`color:${SKIN.bright}`, 'font-size:34px', 'line-height:1',
      'font-variant-numeric:tabular-nums']);
    temp.textContent = `${Math.round(w.temp)}\u00b0`;
    const cond = document.createElement('div');
    css(cond, [`color:${SKIN.text}`, 'font-size:12px']);
    cond.textContent = w.label;
    hero.append(place, glyph, temp, cond);

    // The outlook, as a strip of hours.
    const strip = document.createElement('div');
    css(strip, ['display:flex', 'gap:4px', 'padding:10px 10px 12px',
      'overflow-x:auto', `border-bottom:1px solid ${SKIN.edge}`,
      `border-top:1px solid ${SKIN.edge}`]);
    for (const o of w.outlook) {
      const cell = document.createElement('div');
      css(cell, ['flex:1 0 42px', 'display:flex', 'flex-direction:column',
        'align-items:center', 'gap:3px', 'padding:7px 2px', 'border-radius:10px',
        `background:${skyWash(o.sky)}`]);
      const t = document.createElement('div');
      css(t, [`color:${SKIN.faint}`, 'font-size:8.5px',
        'font-variant-numeric:tabular-nums']);
      t.textContent = hh(o.hour);
      const g = document.createElement('div');
      css(g, ['font-size:17px', 'line-height:1']);
      g.textContent = o.glyph;
      const d = document.createElement('div');
      css(d, [`color:${SKIN.bright}`, 'font-size:10.5px',
        'font-variant-numeric:tabular-nums']);
      d.textContent = `${Math.round(o.temp)}\u00b0`;
      cell.append(t, g, d);
      strip.appendChild(cell);
    }

    // And the numbers behind it, each as the bar it actually is.
    const rows = document.createElement('div');
    css(rows, ['display:flex', 'flex-direction:column', 'gap:9px',
      'padding:13px 15px 16px']);
    const row = (name: string, value: string, fill: number, tone: string): void => {
      const el = document.createElement('div');
      css(el, ['display:flex', 'flex-direction:column', 'gap:4px']);
      const top = document.createElement('div');
      css(top, ['display:flex', 'align-items:baseline', 'gap:6px',
        `color:${SKIN.dim}`, 'font-size:9.5px', 'letter-spacing:.07em',
        'text-transform:uppercase']);
      const nm = document.createElement('span');
      nm.textContent = name;
      const val = document.createElement('span');
      css(val, [`color:${SKIN.bright}`, 'margin-left:auto', 'font-size:10.5px',
        'letter-spacing:0', 'text-transform:none',
        'font-variant-numeric:tabular-nums']);
      val.textContent = value;
      top.append(nm, val);
      const track = document.createElement('div');
      css(track, ['height:4px', 'border-radius:4px',
        'background:rgba(255,255,255,.08)', 'overflow:hidden']);
      const bar = document.createElement('div');
      css(bar, ['height:100%', `width:${Math.round(Math.min(1, Math.max(0, fill)) * 100)}%`,
        `background:${tone}`, 'border-radius:4px']);
      track.appendChild(bar);
      el.append(top, track);
      rows.appendChild(el);
    };
    row('Cloud', `${Math.round(w.now.cover * 100)}%`, w.now.cover, SKIN.dim);
    row('Rain', w.now.rain > 0.01 ? `${Math.round(w.now.rain * 100)}%` : 'none',
      w.now.rain, SKIN.accent);
    row('Visibility', w.now.fog > 0.3 ? 'poor' : w.now.fog > 0.1 ? 'moderate' : 'good',
      1 - w.now.fog, w.now.fog > 0.3 ? SKIN.bad : SKIN.good);
    row('Ground', w.now.wet > 0.6 ? 'wet' : w.now.wet > 0.2 ? 'damp' : 'dry',
      w.now.wet, SKIN.dim);
    row('Wind', `${Math.round(w.wind)} km/h`, w.wind / 60, SKIN.dim);

    const foot = document.createElement('div');
    css(foot, [`color:${SKIN.faint}`, 'font-size:9px', 'padding:0 15px 15px',
      'line-height:1.6']);
    foot.textContent = 'Six hours ahead. The outlook reads the same model the '
      + 'sky over the city is drawn from, so it is what will actually happen.';

    this.skyPane.append(hero, strip, rows, foot);
  }

  private card(post: Post): HTMLElement {
    const el = document.createElement('div');
    css(el, ['display:flex', 'gap:9px', 'padding:11px 14px',
      `border-bottom:1px solid ${SKIN.edge}`]);
    const face = document.createElement('div');
    // An avatar made from the handle: a coloured disc with two initials, which
    // is what every one of these looks like anyway.
    let h = 0;
    for (let i = 0; i < post.handle.length; i++) h = (h * 31 + post.handle.charCodeAt(i)) % 360;
    css(face, ['width:30px', 'height:30px', 'border-radius:30px', 'flex:none',
      `background:hsl(${h} 45% 34%)`, 'display:grid', 'place-items:center',
      `color:${SKIN.bright}`, 'font-size:11px']);
    face.textContent = post.handle.replace(/[^a-z]/g, '').slice(0, 2).toUpperCase();

    const body = document.createElement('div');
    css(body, ['display:flex', 'flex-direction:column', 'gap:4px', 'flex:1',
      'min-width:0']);
    const top = document.createElement('div');
    css(top, ['display:flex', 'align-items:baseline', 'gap:6px']);
    const name = document.createElement('span');
    css(name, [`color:${SKIN.bright}`, 'font-size:11px']);
    name.textContent = `@${post.handle}`;
    const when = document.createElement('span');
    css(when, [`color:${SKIN.faint}`, 'font-size:9.5px']);
    when.textContent = post.when;
    top.append(name, when);
    const text = document.createElement('div');
    css(text, [`color:${SKIN.text}`, 'font-size:11px', 'line-height:1.5']);
    text.textContent = post.text;
    const foot = document.createElement('div');
    css(foot, ['display:flex', 'align-items:center', 'gap:12px',
      `color:${SKIN.faint}`, 'font-size:9.5px']);
    const tone = post.tone === 'good' ? SKIN.good : post.tone === 'bad' ? SKIN.bad : SKIN.dim;
    const heart = document.createElement('span');
    css(heart, [`color:${tone}`]);
    heart.textContent = `♥ ${post.likes.toLocaleString()}`;
    const reply = document.createElement('span');
    reply.textContent = '↺ reply';
    foot.append(heart, reply);
    body.append(top, text, foot);
    el.append(face, body);
    return el;
  }
}

/**
 * A wash of colour for a sky, so the app reads before it is read.
 *
 * Not a palette lookup: the three numbers the model holds are mixed directly,
 * so a sky halfway between cloudy and raining is drawn halfway between.
 */
function skyWash(s: Sky): string {
  const blue = [0.29, 0.55, 0.82];
  const grey = [0.42, 0.45, 0.50];
  const slate = [0.20, 0.24, 0.31];
  const k = Math.min(1, s.cover);
  const r = Math.min(1, s.rain * 1.6);
  const mix = (i: number): number => {
    const dry = blue[i] * (1 - k) + grey[i] * k;
    return dry * (1 - r) + slate[i] * r;
  };
  const to255 = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 255);
  return `rgba(${to255(mix(0))},${to255(mix(1))},${to255(mix(2))},.22)`;
}
