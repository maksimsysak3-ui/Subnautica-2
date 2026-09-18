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
 * and posts that arrive while it is open.
 */

import { SKIN, css, panel, label, tip } from './skin';
import { click as clickSound, ping } from './sound';

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
  private shown = false;
  private seed = 3;
  private lastAt = 0;

  constructor(parent: HTMLElement, private read: () => CityMood | null) {
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
    tip(this.launcher, 'Cititok — what the city is posting', 'C');
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

    screen.append(notch, this.bar, head, this.feed);
    phone.appendChild(screen);
    this.root.appendChild(phone);
    parent.appendChild(this.root);

    window.addEventListener('keydown', (e) => {
      const typing = (e.target as HTMLElement | null)?.tagName === 'INPUT';
      if (typing || e.ctrlKey || e.metaKey) return;
      if (e.key === 'c' || e.key === 'C') this.toggle();
      else if (e.key === 'Escape' && this.shown) this.close();
    });
  }

  set visible(on: boolean) {
    this.launcher.style.display = on ? 'grid' : 'none';
    if (!on) this.close();
  }

  get open(): boolean { return this.shown; }

  toggle(): void { if (this.shown) this.close(); else this.show(); }

  show(): void {
    this.shown = true;
    this.root.style.display = 'block';
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

    const clock = new Date();
    this.bar.innerHTML = '';
    const time = document.createElement('span');
    time.textContent = `${String(clock.getHours()).padStart(2, '0')}:`
      + `${String(clock.getMinutes()).padStart(2, '0')}`;
    const spacer = document.createElement('span');
    css(spacer, ['margin-left:auto']);
    const signal = document.createElement('span');
    signal.textContent = `${mood.city} · ${Math.round(mood.happiness * 100)}% happy`;
    this.bar.append(time, spacer, signal);

    const posts = postsFor(mood, this.seed);
    this.feed.innerHTML = '';
    for (const post of posts) this.feed.appendChild(this.card(post));
    if (!quiet && posts.length > 0) ping();
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
