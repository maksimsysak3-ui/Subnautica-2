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
  /** Teleport the player (feet position) and face a yaw, for tests. */
  placePlayer(x: number, z: number, yaw: number): { x: number; y: number; z: number } | null;
  /** Drive player input for N fixed steps and return the resulting state. */
  drivePlayer(
    input: Partial<Record<'moveX' | 'moveZ' | 'sprint' | 'crouch', number | boolean>>,
    frames: number,
  ): { x: number; y: number; z: number; grounded: boolean; insideGeometry: boolean } | null;
  /** Toggle one post pass by id — lets a capture isolate what a pass costs. */
  setPass(id: string, enabled: boolean): boolean;
  /** Spawn a test actor. Returns its id. */
  spawnTarget(x: number, y: number, z: number, faction?: string): number;
  /** Fire N rounds at a world point and report what actually happened. */
  fireAt(
    x: number, y: number, z: number, rounds: number,
  ): {
    fired: number; impacts: number; actorHits: number; penetrations: number; ricochets: number;
    flightSeconds: number; dropMetres: number; impactSpeed: number;
  };
  /** Fire one level shot and sample it at `rangeM`. */
  ballisticProfile(rangeM: number): {
    muzzle: number; flightSeconds: number; dropMetres: number; impactSpeed: number; reached: boolean;
  };
  /** Equip a weapon by spec id with optional attachments. */
  equipWeapon(specId: string, attachments?: Record<string, string>, ammoId?: string): unknown;
  /** Current weapon readout. */
  weaponState(): unknown;
  listPasses(): Array<{ id: string; order: number; enabled: boolean }>;
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
      // Hide the boot and click-to-play chrome: a capture is meant to grade
      // the rendered frame, not the menu sitting on top of it.
      for (const id of ['boot', 'click-to-play']) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      }
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

    placePlayer(x: number, z: number, yaw: number) {
      return director.placePlayer(x, z, yaw);
    },

    drivePlayer(input, frames) {
      return director.drivePlayer(input, frames);
    },

    setPass(id: string, enabled: boolean): boolean {
      return director.setPass(id, enabled);
    },

    spawnTarget(x, y, z, faction) {
      return director.spawnTarget(x, y, z, faction);
    },

    fireAt(x, y, z, rounds) {
      return director.fireAt(x, y, z, rounds);
    },

    ballisticProfile(rangeM) {
      return director.ballisticProfile(rangeM);
    },

    equipWeapon(specId, attachments, ammoId) {
      return director.equipWeapon(specId, attachments, ammoId);
    },

    weaponState() {
      return director.weaponState();
    },

    listPasses() {
      return director.listPasses();
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
