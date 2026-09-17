/**
 * The always-on budget readout.
 *
 * planning/CITY-SIM-DESIGN.md §8 says instrumentation goes in at M0, before
 * there is anything to measure. This is that. It starts as frame timing and
 * grows rows as systems land.
 */

import { SKIN, panel, label, css } from './skin';

export class Stats {
  private el: HTMLElement;
  private samples = new Float32Array(120);
  private cursor = 0;
  /**
   * Wall-clock intervals between presented frames.
   *
   * Separate from the CPU samples above, and the more honest of the two. The
   * panel used to divide a thousand by the time it took to *encode* a frame
   * and call that the frame rate, which read six thousand while the picture in
   * front of the player stuttered -- the encode was never the thing that was
   * slow. This is the number a player means by "fps".
   */
  private intervals = new Float32Array(120);
  private beat = 0;
  private lastPaint = 0;
  private rows = new Map<string, string>();
  /**
   * Whether the panel is wanted at all.
   *
   * It is the engine's readout, not the city's: frame times, draw counts, how
   * many milliseconds a second the simulation is costing. All of that belongs
   * to whoever is building the game, and none of it belongs in front of
   * somebody playing it -- the city's own figures live on the bar at the bottom
   * of the screen, where a city builder puts them. F3 brings this back, which is
   * the key every game with a debug readout already uses.
   */
  private wanted = false;
  private allowed = false;

  /** The headline figures, in the order they are shown. */
  private readonly headOrder = ['money', 'citizens', 'when'];
  private head!: HTMLElement;
  private detail!: HTMLElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.dataset.panel = 'stats';
    css(this.el, [...panel(), 'position:absolute', 'top:12px', 'left:12px',
      'padding:10px 13px 9px', 'pointer-events:none',
      'display:flex', 'flex-direction:column', 'gap:7px', 'min-width:186px']);

    // The city's own figures, large. What a player checks constantly belongs at
    // the top of the screen in a size they can read without stopping -- the
    // panel used to open with the frame rate, which is a number for whoever is
    // building the game rather than for whoever is playing it.
    this.head = document.createElement('div');
    css(this.head, ['display:flex', 'flex-direction:column', 'gap:5px']);

    const rule = document.createElement('div');
    css(rule, ['height:1px', `background:${SKIN.edge}`]);

    // And the instrumentation, small and dim, under a line. Still there, still
    // live, and no longer the first thing anybody sees.
    this.detail = document.createElement('div');
    css(this.detail, ['display:grid', 'grid-template-columns:auto 1fr',
      'column-gap:8px', 'row-gap:1px', `color:${SKIN.faint}`, 'font-size:9.5px',
      'font-variant-numeric:tabular-nums']);

    this.el.append(this.head, rule, this.detail);
    parent.appendChild(this.el);
    this.el.style.display = 'none';
    addEventListener('keydown', (e) => {
      if (e.key !== 'F3') return;
      e.preventDefault();
      this.wanted = !this.wanted;
      this.apply();
    });
  }

  /**
   * Shows or hides the panel.
   *
   * It is an in-game readout and the main menu is not the game: a budget panel
   * sitting over the title is the game's instrumentation showing through its
   * own front door.
   */
  set visible(on: boolean) {
    this.allowed = on;
    this.apply();
  }

  /** Whether the readout is on screen. Tools ask; the game does not. */
  get showing(): boolean { return this.allowed && this.wanted; }

  private apply(): void {
    this.el.style.display = this.allowed && this.wanted ? 'flex' : 'none';
  }

  /** Records the gap since the previous frame, in milliseconds. */
  interval(ms: number): void {
    if (ms <= 0 || ms > 1000) return;
    this.intervals[this.beat] = ms;
    this.beat = (this.beat + 1) % this.intervals.length;
  }

  /**
   * Whether the panel is about to repaint.
   *
   * Callers use it to skip building the row strings on the frames that would
   * throw them away, which at a few hundred frames a second is most of them.
   */
  due(now: number): boolean {
    return now - this.lastPaint >= 250;
  }

  /** Records one frame's CPU time in milliseconds. */
  sample(ms: number): void {
    this.samples[this.cursor] = ms;
    this.cursor = (this.cursor + 1) % this.samples.length;
  }

  /** Sets or replaces a named row. */
  set(key: string, value: string): void {
    this.rows.set(key, value);
  }

  /** The current rows, for tools that read the numbers rather than the panel. */
  snapshot(): Record<string, string> {
    return Object.fromEntries(this.rows);
  }

  paint(now: number): void {
    if (now - this.lastPaint < 250) return;   // 4Hz is plenty; repainting DOM is not free
    // Nothing to paint into while it is hidden, and it is hidden almost always.
    if (!this.allowed || !this.wanted) { this.lastPaint = now; return; }
    this.lastPaint = now;

    let sum = 0;
    let max = 0;
    for (const s of this.samples) {
      sum += s;
      if (s > max) max = s;
    }
    const avg = sum / this.samples.length;

    // The real frame rate, and the worst interval in the last two seconds.
    // The worst one is the row that matters: an average of eight milliseconds
    // with a forty in it is not a smooth game, and the average alone hides
    // exactly the hitch a player is complaining about.
    let isum = 0;
    let imax = 0;
    let seen = 0;
    for (const s of this.intervals) {
      if (s <= 0) continue;
      isum += s;
      if (s > imax) imax = s;
      seen++;
    }
    const iavg = seen > 0 ? isum / seen : 0;

    // ---- the city ---------------------------------------------------------
    const want = this.headOrder.filter((k) => this.rows.has(k));
    while (this.head.children.length < want.length) {
      const row = document.createElement('div');
      css(row, ['display:flex', 'align-items:baseline', 'gap:6px']);
      const v = document.createElement('span');
      css(v, [`font:300 17px/1 ${SKIN.mono}`, `color:${SKIN.bright}`,
        'font-variant-numeric:tabular-nums', 'letter-spacing:-.01em']);
      // A second, smaller figure beside the first, for the ones that have one:
      // a balance means little without the direction it is heading in, and the
      // two on one line at one size read as a single unparseable string.
      const sub = document.createElement('span');
      css(sub, ['font-size:10px', `color:${SKIN.dim}`,
        'font-variant-numeric:tabular-nums']);
      const k = document.createElement('span');
      css(k, [...label(), 'font-size:8.5px', 'margin-left:auto']);
      row.append(v, sub, k);
      this.head.appendChild(row);
    }
    while (this.head.children.length > want.length) {
      this.head.lastElementChild?.remove();
    }
    for (let i = 0; i < want.length; i++) {
      const row = this.head.children[i] as HTMLElement;
      const v = row.children[0] as HTMLElement;
      const sub = row.children[1] as HTMLElement;
      const k = row.children[2] as HTMLElement;
      // A vertical bar splits the headline from its footnote. A separator
      // rather than two calls, so every caller stays one `set`.
      const raw = this.rows.get(want[i]) ?? '';
      const cut = raw.indexOf('|');
      const main = cut < 0 ? raw : raw.slice(0, cut);
      const tail = cut < 0 ? '' : raw.slice(cut + 1);
      if (v.textContent !== main) v.textContent = main;
      if (sub.textContent !== tail) sub.textContent = tail;
      if (k.textContent !== want[i]) k.textContent = want[i];
    }

    // ---- and the instrumentation ------------------------------------------
    const lines: Array<[string, string]> = [
      [`${(seen > 0 ? 1000 / Math.max(iavg, 0.001) : 0).toFixed(0)} fps`,
        `${iavg.toFixed(1)} ms`],
      ['worst', `${imax.toFixed(1)} ms`],
      ['cpu', `${avg.toFixed(2)} ms`],
    ];
    for (const [k, v] of this.rows) {
      if (this.headOrder.includes(k)) continue;
      lines.push([k, v]);
    }
    while (this.detail.children.length < lines.length * 2) {
      const cell = document.createElement('span');
      this.detail.appendChild(cell);
    }
    while (this.detail.children.length > lines.length * 2) {
      this.detail.lastElementChild?.remove();
    }
    for (let i = 0; i < lines.length; i++) {
      const a = this.detail.children[i * 2] as HTMLElement;
      const b = this.detail.children[i * 2 + 1] as HTMLElement;
      if (a.textContent !== lines[i][0]) a.textContent = lines[i][0];
      if (b.textContent !== lines[i][1]) b.textContent = lines[i][1];
      b.style.textAlign = 'right';
    }
  }
}
