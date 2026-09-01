/**
 * Benchmark mode: append ?bench to the URL.
 *
 * planning/CITY-SIM-DESIGN.md fixes budgets -- draw calls, triangles, agents,
 * milliseconds per tick -- that were written from experience rather than from
 * measurement. This is what turns them into numbers. It flies a fixed route
 * over the city and reports frame time at each stop, so the same run on two
 * machines is comparable, and so a regression six months from now is visible
 * rather than a vague sense that it got slower.
 *
 * Deliberately not a stress test that finds the breaking point. It measures
 * the camera positions a player actually uses: street level, district, city,
 * and the whole map.
 */

import type { Camera } from './gfx/camera';
import type { Renderer } from './gfx/renderer';
import { log } from './util/log';

interface Stop {
  name: string;
  distance: number;
  pitch: number;
}

const ROUTE: Stop[] = [
  { name: 'street', distance: 60, pitch: 22 },
  { name: 'district', distance: 260, pitch: 30 },
  { name: 'downtown', distance: 700, pitch: 38 },
  { name: 'city', distance: 1600, pitch: 46 },
  { name: 'whole map', distance: 3200, pitch: 58 },
];

/** Milliseconds spent at each stop; the first are discarded as warm-up. */
const SETTLE_MS = 600;
const MEASURE_MS = 1400;

export interface StopResult {
  name: string;
  distance: number;
  fps: number;
  cpuMs: number;
  gpuCullMs: number;
  gpuDrawMs: number;
  drawnNear: number;
  drawnFar: number;
}

export class Benchmark {
  private index = 0;
  private elapsed = 0;
  private samples: number[] = [];
  private gpuCull: number[] = [];
  private gpuDraw: number[] = [];
  readonly results: StopResult[] = [];
  private done = false;

  constructor(
    private camera: Camera,
    private renderer: Renderer,
    private onFinish: (results: StopResult[]) => void,
  ) {
    this.apply();
    log.info('bench', `running ${ROUTE.length} stops, about ${
      ((SETTLE_MS + MEASURE_MS) * ROUTE.length / 1000).toFixed(0)}s`);
  }

  private apply(): void {
    const stop = ROUTE[this.index];
    this.camera.focus[0] = 0;
    this.camera.focus[2] = 0;
    this.camera.distance = stop.distance;
    this.camera.pitch = (stop.pitch * Math.PI) / 180;
    this.camera.update();
  }

  /** Call once per frame with the frame's delta in seconds. */
  update(dt: number): void {
    if (this.done) return;
    const ms = dt * 1000;
    this.elapsed += ms;

    // Turn slowly through the measurement, so the numbers cover a spread of
    // orientations rather than one lucky angle.
    this.camera.yaw += dt * 0.25;
    this.camera.update();

    if (this.elapsed > SETTLE_MS) {
      this.samples.push(ms);
      this.gpuCull.push(this.renderer.gpuMs('cull'));
      this.gpuDraw.push(this.renderer.gpuMs('draw'));
    }
    if (this.elapsed < SETTLE_MS + MEASURE_MS) return;

    this.record();
    this.index++;
    if (this.index >= ROUTE.length) {
      this.done = true;
      this.onFinish(this.results);
      return;
    }
    this.elapsed = 0;
    this.samples = [];
    this.gpuCull = [];
    this.gpuDraw = [];
    this.apply();
  }

  private record(): void {
    const stop = ROUTE[this.index];
    const mean = (xs: number[]): number =>
      xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
    const frame = mean(this.samples);
    const [near, far] = this.renderer.drawn;

    this.results.push({
      name: stop.name,
      distance: stop.distance,
      fps: frame > 0 ? 1000 / frame : 0,
      cpuMs: frame,
      gpuCullMs: mean(this.gpuCull),
      gpuDrawMs: mean(this.gpuDraw),
      drawnNear: near,
      drawnFar: far,
    });
  }
}

/** Formats results as a table, for the log console and the clipboard. */
export function formatResults(results: StopResult[], instances: number): string {
  const pad = (s: string, n: number): string => s.padStart(n);
  const lines = [
    `citysim benchmark — ${instances.toLocaleString()} buildings`,
    `${navigator.userAgent}`,
    '',
    'stop        dist    fps   frame   gpu cull   gpu draw    drawn',
  ];
  for (const r of results) {
    lines.push(
      r.name.padEnd(10) +
      pad(`${r.distance}m`, 7) +
      pad(r.fps.toFixed(0), 7) +
      pad(`${r.cpuMs.toFixed(1)}ms`, 8) +
      pad(r.gpuCullMs ? `${r.gpuCullMs.toFixed(2)}ms` : '—', 11) +
      pad(r.gpuDrawMs ? `${r.gpuDrawMs.toFixed(2)}ms` : '—', 11) +
      pad((r.drawnNear + r.drawnFar).toLocaleString(), 9),
    );
  }
  return lines.join('\n');
}
