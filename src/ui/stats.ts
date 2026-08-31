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

  /** Records one frame's CPU time in milliseconds. */
  sample(ms: number): void {
    this.samples[this.cursor] = ms;
    this.cursor = (this.cursor + 1) % this.samples.length;
  }

  /** Sets or replaces a named row. */
  set(key: string, value: string): void {
    this.rows.set(key, value);
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

    const lines = [
      `${(1000 / Math.max(avg, 0.001)).toFixed(0).padStart(4)} fps`,
      `${avg.toFixed(2).padStart(5)} ms  avg`,
      `${max.toFixed(2).padStart(5)} ms  peak`,
    ];
    for (const [k, v] of this.rows) lines.push(`${v.padStart(5)}  ${k}`);
    this.el.textContent = lines.join('\n');
  }
}
