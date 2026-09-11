/**
 * The front of the game: a loading screen, then a menu.
 *
 * They are deliberately two different things, because they have two different
 * jobs. The loading screen has to hold attention while nothing can be
 * interacted with, so it is a painting -- full bleed, with the lock-up over it
 * and a bar that tells the truth about how far along the build is. The menu
 * has to get out of the way, so it is the game's own terrain at whatever hour
 * the clock has reached, turning slowly, with as little over the top of it as
 * the words will allow.
 *
 * The mark is six glass facets in a hexagon. On the loading screen they light
 * one per build step, so the thing you watch while waiting becomes the logo.
 */

import { listSaves, readSave, writeSave, deleteSave, fromCode, toCode } from '../sim';
import type { SaveInfo, World } from '../sim';
import { LOADING_ART } from './loading-art';

const INK = '#f2f6fb';
const DIM = '#a9bcd2';
const GLASS = 'rgba(12,19,30,.55)';
const EDGE = 'rgba(160,205,245,.22)';
const COOL = '#8fd8ff';
const UI = 'var(--ui, system-ui, -apple-system, "Segoe UI", sans-serif)';

export interface MenuHooks {
  /** Start on empty land with the road in from the edge. */
  onNew: () => void;
  /** Put a loaded world on the map. */
  onLoad: (world: World) => void;
  /** The world as it stands, for saving and for sharing. */
  world: () => World;
  /** Let the menu drive the camera and the clock while it is up. */
  cinematic: (on: boolean) => void;
}

export class Menu {
  private loader: HTMLElement;
  private root: HTMLElement;
  private facets: HTMLElement[] = [];
  private bar: HTMLElement;
  private step: HTMLElement;
  private body: HTMLElement;
  private note: HTMLElement;
  private lit = 0;
  private opened = false;

  constructor(host: HTMLElement, private hooks: MenuHooks) {
    this.loader = this.buildLoader();
    host.appendChild(this.loader);

    this.root = this.buildMenu();
    host.appendChild(this.root);

    this.bar = this.loader.querySelector('[data-bar]') as HTMLElement;
    this.step = this.loader.querySelector('[data-step]') as HTMLElement;
    this.body = this.root.querySelector('[data-body]') as HTMLElement;
    this.note = this.root.querySelector('[data-note]') as HTMLElement;
  }

  // ---- the loading screen ----------------------------------------------

  /**
   * Full bleed art, with everything else stacked down the middle of it.
   *
   * Every size below is a `clamp`, and the stack is capped at the viewport
   * height with its own gaps proportional to it. That is what makes the thing
   * fit rather than merely fitting on the screen it was designed on: a title
   * set in pixels overflows a laptop in landscape, and a stack sized in `vh`
   * with no ceiling collapses on a phone.
   */
  private buildLoader(): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:30', 'pointer-events:auto',
      'display:grid', 'place-items:center', 'overflow:hidden',
      'background:#070b12', `color:${INK}`, `font:400 14px/1.5 ${UI}`,
      'transition:opacity .85s ease',
    ].join(';');

    // The painting. `cover` so it fills any shape without distorting, and
    // biased low so the skyline stays in frame when the viewport is short --
    // the sky is the part that can be cropped without losing the picture.
    const art = document.createElement('div');
    art.style.cssText = [
      'position:absolute', 'inset:0',
      `background:url('${LOADING_ART}') center 38% / cover no-repeat`,
      // A slow drift in, so the first frame is not a static poster. Small
      // enough that nothing reaches an edge.
      'animation:citysim-drift 26s ease-out forwards',
    ].join(';');
    el.appendChild(art);

    // Two scrims rather than one. A flat wash over a painting kills it; these
    // darken only where the words are -- the middle band and the very bottom
    // -- and leave the sun, the water and the far shore untouched.
    const scrim = document.createElement('div');
    scrim.style.cssText = [
      'position:absolute', 'inset:0',
      'background:radial-gradient(58% 46% at 50% 52%,rgba(3,7,13,.86),rgba(3,7,13,.52) 52%,'
        + 'rgba(3,7,13,0) 84%),'
        + 'linear-gradient(180deg,rgba(4,8,14,.46) 0%,rgba(4,8,14,0) 26%,'
        + 'rgba(4,8,14,0) 64%,rgba(4,8,14,.72) 100%)',
    ].join(';');
    el.appendChild(scrim);

    const stack = document.createElement('div');
    stack.style.cssText = [
      'position:relative', 'display:flex', 'flex-direction:column',
      'align-items:center', 'gap:clamp(14px,2.4vh,26px)',
      'width:min(760px,88vw)', 'max-height:92vh', 'text-align:center',
      'animation:citysim-rise 1.1s cubic-bezier(.16,.84,.28,1) both',
    ].join(';');

    stack.appendChild(this.buildMark('clamp(84px,12vh,132px)', true));

    const h1 = document.createElement('h1');
    h1.textContent = 'CITYSIM';
    h1.style.cssText = [
      'margin:0', `font:800 clamp(38px,7.4vw,92px)/0.9 ${UI}`,
      'letter-spacing:clamp(.02em,.6vw,.10em)', `color:${INK}`,
      'text-shadow:0 2px 12px rgba(0,0,0,.55),0 8px 60px rgba(0,0,0,.5)',
      // Never wider than the stack, whatever the viewport does.
      'max-width:100%', 'white-space:nowrap',
    ].join(';');
    stack.appendChild(h1);

    const sub = document.createElement('p');
    sub.textContent = 'every building is a program';
    sub.style.cssText = [
      'margin:0', `font:500 clamp(9px,1.25vw,13px)/1.4 ${UI}`,
      'letter-spacing:clamp(.22em,.62vw,.42em)', 'text-transform:uppercase',
      `color:${COOL}`, 'text-shadow:0 1px 10px rgba(0,0,0,.7)',
      // The tracking adds a trailing space; the indent puts it back centre.
      'text-indent:clamp(.22em,.62vw,.42em)', 'max-width:100%',
    ].join(';');
    stack.appendChild(sub);

    // The bar. Thin, wide, and honest: it is driven by the build steps rather
    // than by a timer pretending to be one.
    const rail = document.createElement('div');
    rail.style.cssText = [
      'position:relative', 'width:min(420px,72vw)', 'height:3px',
      'border-radius:3px', 'background:rgba(255,255,255,.14)',
      'overflow:hidden', 'margin-top:clamp(4px,1.2vh,14px)',
    ].join(';');
    const fill = document.createElement('div');
    fill.dataset.bar = '';
    fill.style.cssText = [
      'position:absolute', 'inset:0 auto 0 0', 'width:0%', 'border-radius:3px',
      `background:linear-gradient(90deg,${COOL},#ffd7a1)`,
      'box-shadow:0 0 14px rgba(143,216,255,.6)',
      'transition:width .5s cubic-bezier(.3,.8,.4,1)',
    ].join(';');
    rail.appendChild(fill);
    stack.appendChild(rail);

    const step = document.createElement('p');
    step.dataset.step = '';
    step.style.cssText = [
      'margin:0', `font:500 clamp(10px,1.15vw,12px)/1.4 ${UI}`,
      'letter-spacing:.18em', 'text-transform:uppercase', `color:${DIM}`,
      'min-height:1.4em', 'text-shadow:0 1px 8px rgba(0,0,0,.8)',
    ].join(';');
    stack.appendChild(step);

    el.appendChild(stack);

    // Keyframes, once. Written into the document rather than inline because a
    // transform cannot be animated from a style attribute.
    if (!document.getElementById('citysim-menu-css')) {
      const css = document.createElement('style');
      css.id = 'citysim-menu-css';
      css.textContent = `
@keyframes citysim-drift { from { transform: scale(1.075); } to { transform: scale(1); } }
@keyframes citysim-rise {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  [style*="citysim-drift"], [style*="citysim-rise"] { animation: none !important; }
}`;
      document.head.appendChild(css);
    }
    return el;
  }

  // ---- the mark ---------------------------------------------------------

  /**
   * Six facets of glass in a hexagon.
   *
   * A facet is the trapezium between one edge of the hexagon and the same edge
   * shrunk towards the middle: six of them make a ring with a hollow centre.
   * Each is its own element because `backdrop-filter` frosts what is behind an
   * element, and one SVG cannot give six pieces six different views.
   */
  private buildMark(size: string, solid = false): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'position:relative', `width:${size}`, `aspect-ratio:1`, 'flex:0 0 auto',
      solid
        ? 'filter:drop-shadow(0 6px 20px rgba(0,0,0,.7)) drop-shadow(0 0 34px rgba(150,205,255,.45))'
        : 'filter:drop-shadow(0 14px 42px rgba(0,0,0,.6))',
    ].join(';');

    const corner = (i: number, r: number): [number, number] => {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r];
    };
    const OUT = 48, IN = 21, GAP = 0.055;
    const lerp = (a: [number, number], b: [number, number], t: number): [number, number] =>
      [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

    for (let i = 0; i < 6; i++) {
      const o0 = corner(i, OUT), o1 = corner(i + 1, OUT);
      const i0 = corner(i, IN), i1 = corner(i + 1, IN);
      // Pulled off both ends, which puts a seam of sky between one facet and
      // the next -- the detail that makes it read as panels rather than a ring.
      const p = [lerp(o0, o1, GAP), lerp(o1, o0, GAP), lerp(i1, i0, GAP), lerp(i0, i1, GAP)];
      const f = document.createElement('div');
      const tilt = Math.cos((i / 6) * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5;
      // Two ways of being glass, for two kinds of background.
      //
      // Over the live scene, `backdrop-filter` is the right answer: the facets
      // frost whatever the camera is looking at and change as it moves. Over
      // the painting it is the wrong one -- frosting a bright sunset sky gives
      // a bright panel on a bright ground, and the mark vanished. So on the
      // loading screen the facets are lit from within instead, pale and edged,
      // which reads at any brightness because it does not depend on what is
      // underneath.
      const face = solid
        ? `background:linear-gradient(${(i * 60 + 150) % 360}deg,`
            + `rgba(255,255,255,${(0.62 + tilt * 0.30).toFixed(2)}),`
            + `rgba(206,232,255,${(0.34 + tilt * 0.22).toFixed(2)}) 56%,`
            + `rgba(150,192,236,${(0.26 + tilt * 0.14).toFixed(2)}));`
            + 'box-shadow:inset 0 1px 0 rgba(255,255,255,.85)'
        : `background:linear-gradient(${(i * 60 + 150) % 360}deg,`
            + `rgba(212,236,255,${(0.20 + tilt * 0.30).toFixed(2)}),`
            + `rgba(128,182,230,.12) 58%,rgba(46,84,132,.26));`
            + `backdrop-filter:blur(2px) saturate(${(1.25 + tilt * 0.5).toFixed(2)})`
            + ` brightness(${(1.10 + tilt * 0.35).toFixed(2)})`;
      f.style.cssText = [
        'position:absolute', 'inset:0',
        `clip-path:polygon(${p.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(',')})`,
        face,
        solid ? 'opacity:.16' : 'opacity:.09',
        'transition:opacity .5s ease, filter .5s ease',
      ].join(';');
      this.facets.push(f);
      wrap.appendChild(f);
    }
    return wrap;
  }

  /** How far along the build is, 0 to 1, with the step named. */
  progress(t: number, label: string): void {
    const want = Math.min(6, Math.floor(t * 6 + 1e-4));
    for (; this.lit < want; this.lit++) {
      const f = this.facets[this.lit];
      f.style.opacity = '1';
      f.style.filter = 'brightness(1.55)';
      setTimeout(() => { f.style.filter = 'none'; }, 260);
    }
    this.bar.style.width = `${Math.round(Math.min(1, Math.max(0, t)) * 100)}%`;
    this.step.textContent = label;
  }

  // ---- the menu ---------------------------------------------------------

  /**
   * Clean and quiet, over the live terrain.
   *
   * One column on the left, nothing on the right, and a scrim that fades out
   * before it reaches the middle. The land is the background and the menu is a
   * caption on it.
   */
  private buildMenu(): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:20', 'pointer-events:none',
      'display:flex', 'align-items:center', 'opacity:0',
      'background:linear-gradient(97deg,rgba(4,8,15,.70) 0%,rgba(5,10,18,.40) 24%,'
        + 'rgba(6,11,20,.10) 44%,rgba(6,11,20,0) 60%)',
      `color:${INK}`, `font:400 14px/1.5 ${UI}`, 'transition:opacity .85s ease',
    ].join(';');

    const panel = document.createElement('div');
    panel.style.cssText = [
      'display:flex', 'flex-direction:column', 'align-items:flex-start',
      'gap:clamp(16px,2.6vh,26px)', 'padding:0 clamp(26px,5vw,68px)',
      'width:min(460px,86vw)', 'pointer-events:auto',
    ].join(';');
    el.appendChild(panel);

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;flex-direction:column;gap:5px';
    const h1 = document.createElement('h1');
    h1.textContent = 'CITYSIM';
    h1.style.cssText = [
      'margin:0', `font:800 clamp(34px,4.4vw,54px)/0.92 ${UI}`,
      'letter-spacing:-.02em', `color:${INK}`,
      'text-shadow:0 2px 30px rgba(0,0,0,.65)', 'white-space:nowrap',
    ].join(';');
    const sub = document.createElement('p');
    sub.textContent = 'every building is a program';
    sub.style.cssText = [
      'margin:0', `font:500 10px/1 ${UI}`, 'letter-spacing:.32em',
      'text-indent:.32em', 'text-transform:uppercase', `color:${COOL}`,
      'opacity:.9', 'text-shadow:0 1px 10px rgba(0,0,0,.6)',
    ].join(';');
    head.append(h1, sub);
    panel.appendChild(head);

    const body = document.createElement('div');
    body.dataset.body = '';
    body.style.cssText = 'display:flex;flex-direction:column;gap:8px;width:100%';
    panel.appendChild(body);

    const note = document.createElement('p');
    note.dataset.note = '';
    note.style.cssText = [
      'margin:0', 'min-height:2.6em', `color:${DIM}`, 'font-size:12px',
      'max-width:40ch', 'text-shadow:0 1px 10px rgba(0,0,0,.6)',
    ].join(';');
    panel.appendChild(note);
    return el;
  }

  /**
   * Loading is done: put the painting away and show the land.
   *
   * Idempotent, because two things can call it -- the build finishing, and the
   * timer that opens the menu anyway if the build overruns.
   */
  ready(): void {
    if (this.opened) return;
    this.opened = true;
    this.progress(1, '');
    this.hooks.cinematic(true);
    // The art goes first and the menu follows it, so there is a moment of the
    // terrain on its own between them. That beat is the whole transition.
    this.loader.style.opacity = '0';
    setTimeout(() => this.loader.remove(), 900);
    setTimeout(() => {
      this.show();
      this.root.style.opacity = '1';
    }, 420);
  }

  private show(): void {
    const saves = listSaves();
    this.body.replaceChildren();
    this.body.appendChild(this.button('New city', 'Empty land, and a road in from the edge',
      true, () => this.close(() => this.hooks.onNew())));
    if (saves.length > 0) {
      const last = saves[0];
      this.body.appendChild(this.button(`Continue — ${last.name}`,
        `${last.roads} roads, ${last.lots} placed · ${when(last.at)}`, false,
        () => this.open(last.key)));
    }
    this.body.appendChild(this.row([
      ['Load', () => this.showLoad(listSaves())],
      ['Join a city', () => this.showJoin()],
    ]));
    this.note.textContent = saves.length > 0
      ? 'Saves live in this browser. Clearing site data clears them.'
      : 'Draw a road, zone beside it, and buildings grow on the frontage.';
  }

  private showLoad(saves: SaveInfo[]): void {
    this.body.replaceChildren();
    if (saves.length === 0) {
      this.note.textContent = 'Nothing saved yet.';
    } else {
      const list = document.createElement('div');
      list.style.cssText = [
        'display:flex', 'flex-direction:column', 'gap:6px', 'width:100%',
        'max-height:min(320px,44vh)', 'overflow-y:auto',
      ].join(';');
      for (const s of saves) {
        const b = this.button(s.name, `${s.roads} roads, ${s.lots} placed · ${when(s.at)}`,
          false, () => this.open(s.key));
        const x = document.createElement('span');
        x.textContent = '✕';
        x.title = `Delete ${s.name}`;
        x.style.cssText = [
          'position:absolute', 'right:12px', 'top:50%', 'transform:translateY(-50%)',
          `color:${DIM}`, 'font-size:12px', 'padding:6px', 'border-radius:6px',
        ].join(';');
        x.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteSave(s.key);
          this.showLoad(listSaves());
        });
        b.appendChild(x);
        list.appendChild(b);
      }
      this.body.appendChild(list);
      this.note.textContent = 'Saves live in this browser. Clearing site data clears them.';
    }
    this.body.appendChild(this.row([['Back', () => this.show()]]));
  }

  /**
   * Joining, honestly.
   *
   * There is no server behind this, so "join" cannot mean what it means in a
   * game that has one, and pretending otherwise would be a button that lies.
   * What it can mean is that a city travels as text: paste someone's code and
   * you are standing on their map, with their roads and their zoning.
   */
  private showJoin(): void {
    this.body.replaceChildren();
    const box = document.createElement('textarea');
    box.placeholder = 'Paste a city code…';
    box.spellcheck = false;
    box.style.cssText = [
      'width:100%', 'height:96px', 'resize:none', 'padding:12px 14px',
      'border-radius:12px', `border:1px solid ${EDGE}`, `background:${GLASS}`,
      `color:${INK}`, 'font:400 11px/1.5 ui-monospace,monospace',
      'backdrop-filter:blur(12px)', 'outline:none',
    ].join(';');
    this.body.appendChild(box);
    this.body.appendChild(this.row([
      ['Join', () => {
        void (async (): Promise<void> => {
          const got = await fromCode(box.value);
          if (got === null) { this.note.textContent = 'That is not a city code.'; return; }
          this.close(() => this.hooks.onLoad(got.world));
        })();
      }],
      ['Copy mine', () => {
        void (async (): Promise<void> => {
          const code = await toCode(this.hooks.world(), 'Shared city');
          box.value = code;
          box.select();
          try {
            await navigator.clipboard.writeText(code);
            this.note.textContent = 'Copied. Anyone who pastes that lands on your map.';
          } catch {
            this.note.textContent = 'Copy it from the box — the clipboard was refused.';
          }
        })();
      }],
      ['Back', () => this.show()],
    ]));
    this.note.textContent = 'A city travels as text. There is no server — this is the whole of it.';
    box.focus();
  }

  private open(key: string): void {
    const got = readSave(key);
    if (got === null) { this.note.textContent = 'That save will not open.'; return; }
    this.close(() => this.hooks.onLoad(got.world));
  }

  // ---- parts ------------------------------------------------------------

  private button(label: string, hint: string, primary: boolean,
    onClick: () => void): HTMLElement {
    const b = document.createElement('button');
    b.style.cssText = [
      'position:relative', 'width:100%', 'text-align:left', 'cursor:pointer',
      'padding:12px 15px', 'border-radius:12px',
      `border:1px solid ${primary ? 'rgba(143,216,255,.42)' : EDGE}`,
      primary
        ? 'background:linear-gradient(160deg,rgba(56,142,196,.32),rgba(26,72,112,.28))'
        : `background:${GLASS}`,
      'backdrop-filter:blur(14px) saturate(1.2)', `color:${INK}`,
      `font:600 14px/1.25 ${UI}`,
      'box-shadow:0 6px 22px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.12)',
      'transition:transform .12s, border-color .12s',
    ].join(';');
    const t = document.createElement('div');
    t.textContent = label;
    const h = document.createElement('div');
    h.textContent = hint;
    h.style.cssText = `margin-top:3px;font:500 11px/1.35 inherit;color:${DIM}`;
    b.append(t, h);
    b.addEventListener('pointerenter', () => {
      b.style.transform = 'translateY(-1px)';
      b.style.borderColor = 'rgba(143,216,255,.6)';
    });
    b.addEventListener('pointerleave', () => {
      b.style.transform = 'none';
      b.style.borderColor = primary ? 'rgba(143,216,255,.42)' : EDGE;
    });
    b.addEventListener('click', onClick);
    return b;
  }

  private row(items: readonly (readonly [string, () => void])[]): HTMLElement {
    const r = document.createElement('div');
    r.style.cssText = 'display:flex;gap:8px;width:100%';
    for (const [label, fn] of items) {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = [
        'flex:1', 'padding:10px 14px', 'border-radius:11px', `border:1px solid ${EDGE}`,
        `background:${GLASS}`, 'backdrop-filter:blur(12px)', `color:${DIM}`,
        'cursor:pointer', `font:600 12px/1 ${UI}`, 'letter-spacing:.05em',
        'transition:color .12s, border-color .12s',
      ].join(';');
      b.addEventListener('pointerenter', () => {
        b.style.color = INK; b.style.borderColor = 'rgba(143,216,255,.5)';
      });
      b.addEventListener('pointerleave', () => {
        b.style.color = DIM; b.style.borderColor = EDGE;
      });
      b.addEventListener('click', fn);
      r.appendChild(b);
    }
    return r;
  }

  /** Fades out and hands over. The scene is already running underneath. */
  private close(then: () => void): void {
    this.root.style.opacity = '0';
    this.root.style.pointerEvents = 'none';
    this.hooks.cinematic(false);
    setTimeout(() => {
      this.root.remove();
      then();
    }, 460);
  }
}

/**
 * A save's age, in the words a person would use.
 *
 * A timestamp is a fact; "4 min ago" answers the question actually being
 * asked, which is "is this the one I was just in".
 */
function when(at: number): string {
  if (at === 0) return 'unknown';
  const s = Math.max(0, (Date.now() - at) / 1000);
  if (s < 90) return 'just now';
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 172800) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

/**
 * Saving from inside the game.
 *
 * A prompt rather than a panel: naming a save is the only decision, and a
 * screen built to collect one string is a screen in the way.
 */
export function saveFromGame(world: World, suggested: string,
  say: (text: string) => void): void {
  // A panel, not `window.prompt`.
  //
  // `prompt` is refused outright in a sandboxed iframe -- which is exactly
  // where this game is played most of the time -- and a refused prompt returns
  // null, which is indistinguishable from the player pressing cancel. So
  // saving looked like it worked and quietly did nothing, every time, with no
  // way to tell. This asks for the name itself.
  const back = document.createElement('div');
  back.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:40', 'display:grid', 'place-items:center',
    'background:rgba(4,8,14,.62)', 'backdrop-filter:blur(3px)',
    'font:400 14px/1.5 var(--ui, system-ui, sans-serif)',
  ].join(';');

  const card = document.createElement('div');
  card.style.cssText = [
    'display:flex', 'flex-direction:column', 'gap:12px', 'width:min(400px,90vw)',
    'padding:20px', 'border-radius:14px', 'background:rgba(17,25,37,.96)',
    'border:1px solid rgba(160,205,245,.22)', 'color:#f2f6fb',
    'box-shadow:0 24px 60px rgba(0,0,0,.6)',
  ].join(';');

  const h = document.createElement('div');
  h.textContent = 'Name this city';
  h.style.cssText = 'font:600 15px/1.2 inherit';
  const field = document.createElement('input');
  field.value = suggested;
  field.spellcheck = false;
  field.style.cssText = [
    'width:100%', 'padding:11px 13px', 'border-radius:10px',
    'border:1px solid rgba(160,205,245,.28)', 'background:rgba(8,13,21,.85)',
    'color:#f2f6fb', 'font:500 14px/1.2 inherit', 'outline:none',
  ].join(';');

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px';
  const shut = (): void => { back.remove(); document.removeEventListener('keydown', key); };
  const make = (label: string, primary: boolean, fn: () => void): HTMLElement => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = [
      'flex:1', 'padding:10px 14px', 'border-radius:10px', 'cursor:pointer',
      `border:1px solid ${primary ? 'rgba(143,216,255,.45)' : 'rgba(160,205,245,.20)'}`,
      primary ? 'background:rgba(56,142,196,.32)' : 'background:rgba(12,19,30,.7)',
      `color:${primary ? '#f2f6fb' : '#a9bcd2'}`, 'font:600 12px/1 inherit',
    ].join(';');
    b.addEventListener('click', fn);
    return b;
  };
  const commit = (): void => {
    const name = field.value.trim();
    if (name === '') { say('a city needs a name'); return; }
    const why = writeSave(world, name);
    shut();
    say(why === null ? `saved as “${name}”` : `could not save: ${why}`);
  };
  const key = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { shut(); say('not saved'); }
    if (e.key === 'Enter') commit();
  };
  document.addEventListener('keydown', key);

  row.append(make('Save', true, commit), make('Cancel', false, () => { shut(); say('not saved'); }));
  card.append(h, field, row);
  back.appendChild(card);
  document.body.appendChild(back);
  field.focus();
  field.select();
}
