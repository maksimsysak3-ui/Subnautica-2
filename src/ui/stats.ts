/**
 * The always-on budget readout.
 *
 * planning/CITY-SIM-DESIGN.md §8 says instrumentation goes in at M0, before
 * there is anything to measure. This is that. It starts as frame timing and
 * grows rows as systems land.
 */

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

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:absolute', 'top:10px', 'left:12px', 'padding:8px 11px',
      'background:rgba(6,9,13,.72)', 'border:1px solid rgba(98,212,255,.16)',
      'border-radius:3px', 'font:11px/1.6 var(--mono)', 'color:#8fa3bd',
      'pointer-events:none', 'white-space:pre', 'letter-spacing:.02em',
    ].join(';');
    parent.appendChild(this.el);
  }

  /**
   * Shows or hides the panel.
   *
   * It is an in-game readout and the main menu is not the game: a budget panel
   * sitting over the title is the game's instrumentation showing through its
   * own front door.
   */
  set visible(on: boolean) {
    this.el.style.display = on ? 'block' : 'none';
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

    const lines = [
      `${(seen > 0 ? 1000 / Math.max(iavg, 0.001) : 0).toFixed(0).padStart(4)} fps`,
      `${iavg.toFixed(1).padStart(5)} ms  frame`,
      `${imax.toFixed(1).padStart(5)} ms  worst`,
      `${avg.toFixed(2).padStart(5)} ms  cpu`,
    ];
    for (const [k, v] of this.rows) lines.push(`${v.padStart(5)}  ${k}`);
    this.el.textContent = lines.join('\n');
  }
}
