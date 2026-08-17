/**
 * window.__BM — the automation surface used by tools/screenshot.mjs.
 *
 * Critics need reproducible frames: same seed, same camera, same time of day,
 * same weather. Everything a shot needs to be deterministic goes through here.
 */

import type { Engine } from './engine';
import type { CaptureDirector, ShotMeta } from './capture-director';

export interface AutomationApi {
  ready: boolean;
  listShots(): string[];
  setupShot(name: string): ShotMeta | null;
  /** Advance the simulation by `ms` of game time in fixed increments. */
  settle(ms: number): void;
  perfReport(): { fps: number; frameMs: number; drawCalls: number; triangles: number; systems: Array<{ id: string; avgMs: number }> };
  setQuality(tier: number): void;
}

declare global {
  interface Window {
    __BM: AutomationApi;
  }
}

export function installAutomation(engine: Engine, director: CaptureDirector): void {
  const api: AutomationApi = {
    ready: false,

    listShots(): string[] {
      return director.listShots();
    },

    setupShot(name: string): ShotMeta | null {
      return director.setup(name);
    },

    settle(ms: number): void {
      // Drive deterministic frames rather than waiting on wall clock, so
      // captures are identical regardless of how fast the machine is.
      const step = 1000 / 60;
      const frames = Math.max(1, Math.round(ms / step));
      let t = performance.now();
      for (let i = 0; i < frames; i++) {
        t += step;
        engine.frame(t);
      }
    },

    perfReport() {
      const r = director.renderStats();
      return {
        fps: Math.round(engine.fps * 10) / 10,
        frameMs: Math.round(engine.frameMs * 100) / 100,
        drawCalls: r.drawCalls,
        triangles: r.triangles,
        systems: engine
          .getTimings()
          .slice(0, 12)
          .map((t) => ({ id: t.id, avgMs: Math.round(t.avgMs * 1000) / 1000 })),
      };
    },

    setQuality(tier: number): void {
      director.setQuality(tier);
    },
  };

  window.__BM = api;
  // Flip ready only once a frame has genuinely rendered.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      api.ready = true;
    });
  });
}
