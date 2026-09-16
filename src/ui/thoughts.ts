/**
 * Thought bubbles: what the buildings are complaining about, over the buildings.
 *
 * A coverage map tells a player that a district is short of schools. It does not
 * tell them that the office block on the corner cannot fill its desks because
 * nobody in the city has a degree, and that sentence -- attached to that building
 * -- is the one that turns a simulation into a game with something to do in it.
 *
 * DRAWN AS INTERFACE, NOT AS GEOMETRY. These are billboards over the world, which
 * sounds like a job for the renderer and is not: they have to be *clickable*, they
 * have to carry an icon that already exists as artwork on the button the player
 * has to press, and there are at most a dozen of them on screen. A pooled dozen
 * absolutely-positioned buttons, projected through the camera a few times a
 * second, costs nothing measurable and gets keyboard focus, hover and hit-testing
 * for free. A GPU billboard pass would have to reinvent all three.
 *
 * A DOZEN, NOT ALL OF THEM. A city with ten thousand problems has ten thousand
 * problems, and drawing ten thousand icons says nothing at all. What is drawn is
 * the worst few in view: sorted by how bad the gripe is first and how close it is
 * second, and thinned so two bubbles never overlap -- which is what makes the
 * screen readable and also what makes the choice honest, because the thing
 * nearest the camera is the thing the player is looking at.
 */

import { Gripe, GRIPE_INFO } from '../sim';
import type { Complaint } from '../sim';
import { GLYPH, ZONE_STYLE, BRANCH_STYLE } from './zones';
import { EXTRA_GLYPH } from './info-views';
import type { Camera } from '../gfx/camera';

/** How often the bubbles are re-projected, in milliseconds. */
const REPAINT_MS = 150;

/** How many may be on screen at once. */
const MAX_SHOWN = 12;

/** Pixels two bubbles must keep between them. */
const APART = 64;

/** Metres above the ground the bubble floats. */
const LIFT = 26;

/** Past this many metres from the camera a bubble is not worth drawing. */
const FAR = 1400;

/**
 * The pictograms the zoning palette and the service rail between them do not have.
 *
 * Drawn in the same forty-eight unit box and with the same even-odd convention as
 * every other glyph here, so one renderer serves all of them.
 */
const THOUGHT_GLYPH: Record<string, string> = {
  // Two figures: the staff a building cannot find.
  workers: 'M17 6a6 6 0 1 0 0 12 6 6 0 1 0 0-12z'
    + 'M33 9a5 5 0 1 0 0 10 5 5 0 1 0 0-10z'
    + 'M17 20c-6 0-10 3.6-10 8.5V42h20V28.5C27 23.6 23 20 17 20z'
    + 'M33 21c-2.4 0-4.4.6-6 1.7 1.9 1.9 3 4.4 3 7.3V42h12V28c0-4.3-3.4-7-9-7z',
  // A mortarboard over a book: the qualification the city has not got.
  graduate: 'M24 8 4 17l20 9 20-9-20-9z'
    + 'M11 24v9c0 3.9 5.8 7 13 7s13-3.1 13-7v-9l-13 5.9L11 24z'
    + 'M40 20.4v11.2a2 2 0 1 0 2.6 0V19.2l-2.6 1.2z',
  // A shopping bag: the trade that is not there.
  customers: 'M14 15h20l3 27H11l3-27z'
    + 'M18 15a6 6 0 0 1 12 0h-3.6a2.4 2.4 0 0 0-4.8 0H18z'
    + 'M17 21h3v6h-3zM28 21h3v6h-3z',
};

/** Which palette a gripe's colour comes from. Warning amber where neither has one. */
function colourFor(icon: string): string {
  const branch = (BRANCH_STYLE as Record<string, { light: string } | undefined>)[icon];
  if (branch !== undefined) return branch.light;
  const zone = (ZONE_STYLE as Record<string, { light: string } | undefined>)[icon];
  if (zone !== undefined) return zone.light;
  return '#f0c24a';
}

function glyphFor(icon: string): string {
  return THOUGHT_GLYPH[icon] ?? EXTRA_GLYPH[icon]
    ?? (GLYPH as Record<string, string | undefined>)[icon] ?? THOUGHT_GLYPH.workers;
}

function style(el: HTMLElement, decls: string[]): void {
  el.style.cssText = decls.join(';');
}

interface Bubble {
  root: HTMLButtonElement;
  icon: HTMLElement;
  gripe: number;
  place: number;
}

/** A complaint with where it landed on screen. */
interface Placed {
  c: Complaint;
  sx: number;
  sy: number;
  dist: number;
  weight: number;
}

export class Thoughts {
  private readonly layer: HTMLElement;
  private readonly card: HTMLElement;
  private readonly cardTitle: HTMLElement;
  private readonly cardWhat: HTMLElement;
  private readonly cardFix: HTMLElement;
  private readonly bubbles: Bubble[] = [];
  private paintedAt = -1;
  private open = -1;
  private on = false;
  /** Scratch, reused, so a repaint at six hertz allocates nothing. */
  private readonly found: Placed[] = [];

  constructor(parent: HTMLElement, private groundAt: (x: number, z: number) => number) {
    this.layer = document.createElement('div');
    this.layer.dataset.panel = 'thoughts';
    style(this.layer, [
      'position:absolute', 'inset:0', 'z-index:5', 'pointer-events:none',
      'overflow:hidden', 'display:none',
    ]);

    this.card = document.createElement('div');
    this.card.dataset.panel = 'thought-card';
    style(this.card, [
      'position:absolute', 'display:none', 'max-width:270px', 'padding:10px 12px',
      'background:rgba(8,12,17,.94)', 'border:1px solid rgba(98,212,255,.22)',
      'border-radius:6px', 'backdrop-filter:blur(14px)',
      'font:11px/1.55 var(--mono)', 'color:#8fa3bd', 'pointer-events:auto',
      'transform:translate(-50%,-100%)', 'z-index:2',
    ]);
    this.cardTitle = document.createElement('div');
    style(this.cardTitle, ['font-size:12px', 'color:#e7f1fb', 'margin-bottom:4px']);
    this.cardWhat = document.createElement('div');
    this.cardFix = document.createElement('div');
    style(this.cardFix, ['margin-top:6px', 'color:#62d4ff']);
    this.card.append(this.cardTitle, this.cardWhat, this.cardFix);
    this.layer.appendChild(this.card);

    // Clicking anywhere that is not a bubble puts the card away. On the layer
    // rather than the document, because the layer does not take pointer events
    // and so never steals a click from the map underneath it.
    for (let i = 0; i < MAX_SHOWN; i++) this.bubbles.push(this.makeBubble());
    parent.appendChild(this.layer);
  }

  private makeBubble(): Bubble {
    const root = document.createElement('button');
    root.type = 'button';
    root.dataset.bubble = '';
    style(root, [
      'position:absolute', 'width:38px', 'height:38px', 'padding:0',
      'display:none', 'align-items:center', 'justify-content:center',
      'border-radius:50% 50% 50% 6px', 'border:1px solid rgba(98,212,255,.30)',
      'background:rgba(10,15,21,.90)', 'backdrop-filter:blur(8px)',
      'cursor:pointer', 'pointer-events:auto',
      'transform:translate(-50%,-100%)',
      'box-shadow:0 3px 12px rgba(0,0,0,.45)',
    ]);
    const icon = document.createElement('span');
    style(icon, ['display:flex', 'pointer-events:none']);
    root.appendChild(icon);
    const b: Bubble = { root, icon, gripe: Gripe.NONE, place: -1 };
    root.addEventListener('click', (e) => {
      e.stopPropagation();
      this.show(b);
    });
    this.layer.appendChild(root);
    return b;
  }

  /** Shown while the city is being played, hidden behind the menu. */
  set visible(on: boolean) {
    this.on = on;
    this.layer.style.display = on ? 'block' : 'none';
    if (!on) this.close();
  }

  close(): void {
    this.open = -1;
    this.card.style.display = 'none';
  }

  private show(b: Bubble): void {
    if (this.open === b.place) { this.close(); return; }
    const info = GRIPE_INFO[b.gripe];
    if (info === undefined) return;
    this.open = b.place;
    this.cardTitle.textContent = info.title;
    this.cardWhat.textContent = info.what;
    this.cardFix.textContent = info.fix;
    this.card.style.display = 'block';
    this.card.style.left = b.root.style.left;
    this.card.style.top = `${parseFloat(b.root.style.top) - 46}px`;
  }

  /**
   * Re-projects and re-lays out.
   *
   * @param now `performance.now()`.
   * @param list the complaints, as the simulation last swept them.
   */
  refresh(now: number, camera: Camera, width: number, height: number,
    list: readonly Complaint[]): void {
    if (!this.on) return;
    if (now - this.paintedAt < REPAINT_MS) return;
    this.paintedAt = now;

    const m = camera.viewProj;
    const ex = camera.eye[0], ez = camera.eye[2];
    const found = this.found;
    found.length = 0;

    for (const c of list) {
      const dx = c.x - ex, dz = c.z - ez;
      const dist = Math.hypot(dx, dz);
      if (dist > FAR) continue;
      const y = this.groundAt(c.x, c.z) + LIFT;
      // The full projection rather than `transformPoint`, because the sign of w
      // is the whole test: a point behind the camera divides to a perfectly
      // plausible screen position, and without this every bubble behind the
      // player appears mirrored in front of them.
      const w = m[3] * c.x + m[7] * y + m[11] * c.z + m[15];
      if (w <= 0.001) continue;
      const nx = (m[0] * c.x + m[4] * y + m[8] * c.z + m[12]) / w;
      const ny = (m[1] * c.x + m[5] * y + m[9] * c.z + m[13]) / w;
      if (nx < -1.05 || nx > 1.05 || ny < -1.05 || ny > 1.05) continue;
      found.push({
        c,
        sx: (nx * 0.5 + 0.5) * width,
        sy: (0.5 - ny * 0.5) * height,
        dist,
        weight: GRIPE_INFO[c.gripe]?.weight ?? 1,
      });
    }

    // Worst first, nearest second. A player looking at a street wants that
    // street's problems; a player looking at the whole city wants the fires.
    found.sort((a, b) => (b.weight - a.weight) || (a.dist - b.dist));

    let shown = 0;
    for (let i = 0; i < found.length && shown < MAX_SHOWN; i++) {
      const p = found[i];
      // Thinned on screen rather than in the world, because that is where the
      // overlap is: two buildings thirty metres apart are one icon from a
      // kilometre up and two from the kerb.
      let clash = false;
      for (let k = 0; k < shown; k++) {
        const q = this.bubbles[k];
        const qx = parseFloat(q.root.style.left), qy = parseFloat(q.root.style.top);
        if (Math.abs(qx - p.sx) < APART && Math.abs(qy - p.sy) < APART) { clash = true; break; }
      }
      if (clash) continue;
      this.place(this.bubbles[shown], p);
      shown++;
    }
    for (let i = shown; i < this.bubbles.length; i++) {
      this.bubbles[i].root.style.display = 'none';
      this.bubbles[i].place = -1;
    }
    // The card follows its bubble, and goes away when the building it is about
    // stops complaining or leaves the screen.
    if (this.open >= 0) {
      const still = this.bubbles.find((b) => b.place === this.open);
      if (still === undefined) this.close();
      else {
        this.card.style.left = still.root.style.left;
        this.card.style.top = `${parseFloat(still.root.style.top) - 46}px`;
      }
    }
  }

  private place(b: Bubble, p: Placed): void {
    b.root.style.display = 'flex';
    b.root.style.left = `${Math.round(p.sx)}px`;
    b.root.style.top = `${Math.round(p.sy)}px`;
    b.place = p.c.place;
    if (b.gripe === p.c.gripe) return;
    b.gripe = p.c.gripe;
    const info = GRIPE_INFO[p.c.gripe];
    const colour = colourFor(info?.icon ?? '');
    b.root.style.borderColor = colour + '66';
    b.root.title = info?.title ?? '';
    b.root.setAttribute('aria-label', info?.title ?? 'problem');
    b.icon.innerHTML = `<svg viewBox="0 0 48 48" width="21" height="21" aria-hidden="true">`
      + `<path d="${glyphFor(info?.icon ?? '')}" fill="${colour}" fill-rule="evenodd"/></svg>`;
  }
}
