/**
 * The front of the game: a loading sequence, a title, and a way in.
 *
 * The whole thing is one idea. A menu that paints a picture of a city is
 * showing you something the game is not; this one has the game itself running
 * behind it, on a camera that drifts slowly round the site at dawn, with the
 * panel over the top. Nothing here is concept art -- it is the first frame of
 * the thing you are about to play, held still enough to read.
 *
 * The mark is six glass facets in a hexagon, and they are glass in earnest:
 * `backdrop-filter` frosts and brightens the live scene behind each one, so
 * the panels carry the real sky, the real hills and the real water, and they
 * change as the camera moves. That is also the loader -- the facets light one
 * at a time as the world is built, so the thing you watch while waiting is the
 * thing that becomes the logo, rather than a spinner borrowed from a form.
 */

import { listSaves, readSave, writeSave, deleteSave, fromCode, toCode } from '../sim';
import type { SaveInfo, World } from '../sim';

/**
 * The palette, taken off a dawn: the hour the game looks best and the one the
 * camera sits at while the menu is up.
 */
const INK = '#eaf1f8';
const DIM = '#9fb4cc';
const GLASS = 'rgba(14,22,34,.62)';
const EDGE = 'rgba(150,200,240,.20)';
const WARM = '#ffd39b';
const COOL = '#7fd4ff';

export interface MenuHooks {
  /** Start on empty land with the road in from the edge. */
  onNew: () => void;
  /** Put a loaded world on the map. */
  onLoad: (world: World) => void;
  /** The world as it stands, for saving and for sharing. */
  world: () => World;
  /** Where the camera should sit while the menu is up, and afterwards. */
  cinematic: (on: boolean) => void;
}

export class Menu {
  private root: HTMLElement;
  private facets: HTMLElement[] = [];
  private body: HTMLElement;
  private note: HTMLElement;
  private lit = 0;

  constructor(host: HTMLElement, private hooks: MenuHooks) {
    this.root = document.createElement('div');
    // The picture keeps the frame; the panel takes the left third.
    //
    // Centring everything was the first attempt and it put the title, the
    // buttons and the logo in one stack down the middle, which covers the one
    // thing worth looking at. A key art holds its city across the whole frame
    // and puts the words to one side of it, and that is what this does: a
    // gradient that only darkens the left, and nothing at all over the right.
    this.root.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:20', 'pointer-events:auto',
      'display:grid', 'grid-template-columns:minmax(340px,38%) 1fr',
      'align-items:center',
      // Barely there. The map *is* the background -- what this does is give the
      // words on the left enough ground to be read against, and stop before it
      // touches the picture. Everything on the panel carries its own shadow so
      // this can stay this light.
      'background:linear-gradient(97deg,rgba(4,8,15,.74) 0%,rgba(5,10,18,.44) 26%,'
        + 'rgba(6,11,20,.12) 46%,rgba(6,11,20,0) 62%)',
      `color:${INK}`, 'font:400 14px/1.5 var(--ui, system-ui, sans-serif)',
      'opacity:0', 'transition:opacity .7s ease',
    ].join(';');

    const panel = document.createElement('div');
    panel.style.cssText = [
      'display:flex', 'flex-direction:column', 'align-items:flex-start',
      'gap:20px', 'padding:0 clamp(28px,5vw,64px)', 'max-width:520px',
    ].join(';');
    this.root.appendChild(panel);

    // Mark beside the wordmark, not above it: a stacked logo is a splash
    // screen, a lock-up on one line is a masthead.
    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;gap:18px';
    head.appendChild(this.buildMark());

    const title = document.createElement('div');
    title.style.cssText = 'display:flex;flex-direction:column;gap:4px';
    const h1 = document.createElement('h1');
    h1.textContent = 'CITYSIM';
    // Heavy, tight and uppercase, with the strapline light and wide under it.
    // The contrast between the two is the whole typographic idea, and it is
    // the one the poster on the wall is using.
    h1.style.cssText = [
      'margin:0', 'font:800 clamp(40px,5.2vw,64px)/0.92 var(--ui, system-ui, sans-serif)',
      'letter-spacing:-.022em', `color:${INK}`,
      'text-shadow:0 2px 34px rgba(0,0,0,.6)',
    ].join(';');
    const sub = document.createElement('p');
    sub.textContent = 'every building is a program';
    sub.style.cssText = [
      'margin:0', 'font:500 10px/1 var(--ui, system-ui, sans-serif)',
      'letter-spacing:.34em', 'text-transform:uppercase', `color:${COOL}`,
      'opacity:.85',
    ].join(';');
    title.append(h1, sub);
    head.appendChild(title);
    panel.appendChild(head);

    this.body = document.createElement('div');
    this.body.style.cssText = [
      'display:flex', 'flex-direction:column', 'gap:9px', 'width:100%',
      // No reserved height. It was there to stop the panel jumping between
      // pages and it bought that with a permanent hole under the buttons,
      // which is a worse thing to look at than a panel that moves.
    ].join(';');
    panel.appendChild(this.body);

    this.note = document.createElement('p');
    this.note.style.cssText = [
      'margin:0', 'min-height:2.6em', `color:${DIM}`, 'font-size:12px',
      'letter-spacing:.02em', 'max-width:44ch',
    ].join(';');
    panel.appendChild(this.note);

    host.appendChild(this.root);
    requestAnimationFrame(() => { this.root.style.opacity = '1'; });
  }

  // ---- the mark, which is also the loader -------------------------------

  /**
   * Six glass facets around a hexagon.
   *
   * Laid out by angle rather than by a path, because each one has to be its
   * own element: `backdrop-filter` frosts what is behind an element, and one
   * SVG cannot give six pieces six different views of the scene.
   */
  private buildMark(): HTMLElement {
    const SIZE = 96;
    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'position:relative', `width:${SIZE}px`, `height:${SIZE}px`, 'flex:0 0 auto',
      'filter:drop-shadow(0 16px 44px rgba(0,0,0,.55))',
    ].join(';');

    // The six corners of a hexagon, point up, as percentages of the box.
    const corner = (i: number, r: number): [number, number] => {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r];
    };
    // A facet is the trapezium between one edge of the hexagon and the same
    // edge shrunk towards the middle: six of them make a ring with a hollow
    // centre, which is the shape on the poster rather than a pie chart.
    const OUT = 48, IN = 21, GAP = 0.055;
    const lerp = (a: [number, number], b: [number, number], t: number): [number, number] =>
      [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

    for (let i = 0; i < 6; i++) {
      const o0 = corner(i, OUT), o1 = corner(i + 1, OUT);
      const i0 = corner(i, IN), i1 = corner(i + 1, IN);
      // Pulled off both ends, which is what puts a seam of sky between one
      // facet and the next -- the detail that makes it read as panels of glass
      // rather than as a solid ring.
      const p = [
        lerp(o0, o1, GAP), lerp(o1, o0, GAP),
        lerp(i1, i0, GAP), lerp(i0, i1, GAP),
      ];
      const f = document.createElement('div');
      // Each facet catches the light a little differently, as glass at six
      // angles would. The ones facing the top are brighter.
      const tilt = Math.cos((i / 6) * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5;
      f.style.cssText = [
        'position:absolute', 'inset:0',
        `clip-path:polygon(${p.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(',')})`,
        `background:linear-gradient(${(i * 60 + 150) % 360}deg,`
          + `rgba(205,232,255,${(0.16 + tilt * 0.26).toFixed(2)}),`
          + `rgba(120,175,225,.10) 58%,rgba(48,86,132,.22))`,
        `backdrop-filter:blur(2px) saturate(${(1.25 + tilt * 0.5).toFixed(2)})`
          + ` brightness(${(1.10 + tilt * 0.35).toFixed(2)})`,
        'opacity:.08', 'transition:opacity .55s ease, filter .55s ease',
      ].join(';');
      this.facets.push(f);
      wrap.appendChild(f);
    }

    // The hairline along the outer edge, drawn once over the top so the
    // silhouette stays crisp where six clipped elements meet.
    const rim = document.createElement('div');
    const outer = Array.from({ length: 6 }, (_, i) => corner(i, OUT));
    rim.style.cssText = [
      'position:absolute', 'inset:0', 'pointer-events:none',
      `clip-path:polygon(${outer.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(',')})`,
      'background:radial-gradient(circle at 50% 26%,rgba(255,255,255,.22),transparent 62%)',
      'mix-blend-mode:screen',
    ].join(';');
    wrap.appendChild(rim);
    return wrap;
  }

  /**
   * How far along the loading is, 0 to 1.
   *
   * Lights facets in order. A progress bar would say the same thing; this says
   * it with the shape the player is about to recognise as the game's.
   */
  progress(t: number, label: string): void {
    const want = Math.min(6, Math.floor(t * 6 + 0.0001));
    for (; this.lit < want; this.lit++) {
      const f = this.facets[this.lit];
      f.style.opacity = '1';
      f.style.filter = 'brightness(1.5)';
      // The flare fades to the facet's resting brightness a moment later, so
      // each one lands rather than simply appearing.
      setTimeout(() => { f.style.filter = 'none'; }, 260);
    }
    this.note.textContent = label;
  }

  // ---- the front page ---------------------------------------------------

  ready(): void {
    for (const f of this.facets) f.style.opacity = '1';
    this.lit = 6;
    this.show();
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
      ['Load', () => this.showLoad(saves)],
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
        'max-height:250px', 'overflow-y:auto', 'padding-right:2px',
      ].join(';');
      for (const s of saves) {
        const b = this.button(s.name, `${s.roads} roads, ${s.lots} placed · ${when(s.at)}`,
          false, () => this.open(s.key));
        // A delete that sits inside the row rather than behind a mode.
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
      'width:100%', 'height:104px', 'resize:none', 'padding:12px 14px',
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
      'padding:13px 16px', 'border-radius:13px',
      `border:1px solid ${primary ? 'rgba(127,212,255,.45)' : EDGE}`,
      primary
        ? 'background:linear-gradient(160deg,rgba(60,150,200,.34),rgba(30,80,120,.30))'
        : `background:${GLASS}`,
      'backdrop-filter:blur(14px) saturate(1.2)', `color:${INK}`,
      'font:600 15px/1.25 var(--ui, system-ui, sans-serif)',
      'box-shadow:0 6px 22px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.14)',
      'transition:transform .12s, border-color .12s, background .12s',
    ].join(';');
    const t = document.createElement('div');
    t.textContent = label;
    const h = document.createElement('div');
    h.textContent = hint;
    h.style.cssText = `margin-top:3px;font:500 11px/1.35 inherit;color:${DIM};letter-spacing:.02em`;
    b.append(t, h);
    b.addEventListener('pointerenter', () => {
      b.style.transform = 'translateY(-1px)';
      b.style.borderColor = 'rgba(127,212,255,.6)';
    });
    b.addEventListener('pointerleave', () => {
      b.style.transform = 'none';
      b.style.borderColor = primary ? 'rgba(127,212,255,.45)' : EDGE;
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
        'flex:1', 'padding:11px 14px', 'border-radius:11px', `border:1px solid ${EDGE}`,
        `background:${GLASS}`, 'backdrop-filter:blur(12px)', `color:${DIM}`,
        'cursor:pointer', 'font:600 12px/1 var(--ui, system-ui, sans-serif)',
        'letter-spacing:.06em', 'transition:color .12s, border-color .12s',
      ].join(';');
      b.addEventListener('pointerenter', () => {
        b.style.color = INK; b.style.borderColor = 'rgba(127,212,255,.5)';
      });
      b.addEventListener('pointerleave', () => {
        b.style.color = DIM; b.style.borderColor = EDGE;
      });
      b.addEventListener('click', fn);
      r.appendChild(b);
    }
    return r;
  }

  /** Fades out, then hands over. The scene is already running underneath. */
  private close(then: () => void): void {
    this.root.style.opacity = '0';
    this.hooks.cinematic(false);
    setTimeout(() => {
      this.root.remove();
      then();
    }, 420);
  }
}

/**
 * A save's age, in the words a person would use.
 *
 * A timestamp is a fact; "4 minutes ago" is the answer to the question the
 * player is actually asking, which is "is this the one I was just in".
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
export function saveFromGame(world: World, suggested: string): string {
  const name = window.prompt('Name this city', suggested);
  if (name === null || name.trim() === '') return '';
  const why = writeSave(world, name.trim());
  return why === null ? `saved as “${name.trim()}”` : `could not save: ${why}`;
}

export { INK, DIM, WARM, COOL };
