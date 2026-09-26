/**
 * Smiley faces over buildings whose needs were just met.
 *
 * Power switched on, a clinic in reach, the bins collected: each building that
 * stops complaining sends up a little green face that rises and fades, and a
 * burst of them comes with a cheer. It is the payoff for fixing something --
 * the thought bubbles say what is wrong, and these say that the player just
 * put it right, over the exact buildings they helped.
 *
 * Plain elements rather than anything drawn by the renderer: a few dozen at a
 * time, alive for under two seconds, projected through the camera each frame.
 */

import type { Camera } from '../gfx/camera';
import type { Complaint } from '../sim/agents/complaints';
import { cheer } from './sound';

/** How long one face lives, in milliseconds. */
const LIFE = 1700;
/** Faces on screen at once; a burst beyond this is sampled. */
const MAX_LIVE = 36;
/** Metres above the ground a face starts. */
const LIFT = 14;
/** Beyond this, a face is too far away to be worth drawing. */
const FAR = 2600;
/** Least time between cheers, so a burst sounds like one. */
const SOUND_GAP = 900;

const FACE = '<svg width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="11.5" fill="#5fd07a" stroke="#1e5f33" stroke-width="1.5"/>'
  + '<circle cx="9" cy="10.5" r="1.6" fill="#1e5f33"/><circle cx="17" cy="10.5" r="1.6" fill="#1e5f33"/>'
  + '<path d="M7.6 15c1.4 3 3.3 4.2 5.4 4.2s4-1.2 5.4-4.2" stroke="#1e5f33" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>';

interface Face { el: HTMLElement; x: number; y: number; z: number; born: number }

export class Cheers {
  private readonly layer = document.createElement('div');
  private readonly faces: Face[] = [];
  private soundAt = -Infinity;

  constructor(parent: HTMLElement, private groundAt: (x: number, z: number) => number) {
    this.layer.dataset.panel = 'cheers';
    this.layer.style.cssText = 'position:absolute;inset:0;z-index:5;pointer-events:none;overflow:hidden';
    parent.appendChild(this.layer);
  }

  /** New met needs, from the simulation. Only those near enough to see are shown. */
  add(list: readonly Complaint[], camera: Camera, now: number): void {
    if (list.length === 0) return;
    const ex = camera.eye[0], ez = camera.eye[2];
    const near = list.filter((c) => Math.hypot(c.x - ex, c.z - ez) < FAR);
    if (near.length === 0) return;
    const room = Math.max(0, MAX_LIVE - this.faces.length);
    const step = Math.max(1, near.length / Math.max(1, room));
    let added = 0;
    for (let i = 0; i < near.length && added < room; i += step) {
      const c = near[Math.floor(i)];
      const el = document.createElement('div');
      el.innerHTML = FACE;
      el.style.cssText = 'position:absolute;left:0;top:0;will-change:transform,opacity;'
        + 'filter:drop-shadow(0 2px 4px rgba(0,0,0,.45))';
      this.layer.appendChild(el);
      // A little stagger, so a street lights up in a ripple rather than a flash.
      this.faces.push({ el, x: c.x, y: this.groundAt(c.x, c.z) + LIFT, z: c.z, born: now + added * 45 });
      added++;
    }
    if (added > 0 && now - this.soundAt > SOUND_GAP) {
      this.soundAt = now;
      cheer();
    }
  }

  /** Moves every face on, and retires the finished ones. */
  update(now: number, camera: Camera, width: number, height: number): void {
    const m = camera.viewProj;
    for (let i = this.faces.length - 1; i >= 0; i--) {
      const f = this.faces[i];
      const age = now - f.born;
      if (age > LIFE) { f.el.remove(); this.faces.splice(i, 1); continue; }
      if (age < 0) { f.el.style.opacity = '0'; continue; }
      const t = age / LIFE;
      const y = f.y + t * 10;
      const w = m[3] * f.x + m[7] * y + m[11] * f.z + m[15];
      if (w <= 0.001) { f.el.style.opacity = '0'; continue; }
      const sx = ((m[0] * f.x + m[4] * y + m[8] * f.z + m[12]) / w * 0.5 + 0.5) * width;
      const sy = (0.5 - (m[1] * f.x + m[5] * y + m[9] * f.z + m[13]) / w * 0.5) * height;
      // Pops in with a little overshoot, then drifts up and fades.
      const pop = t < 0.15 ? 0.4 + (t / 0.15) * 0.75 : t < 0.25 ? 1.15 - ((t - 0.15) / 0.1) * 0.15 : 1;
      f.el.style.opacity = String(t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3);
      f.el.style.transform = `translate(${sx - 13}px, ${sy - 13}px) scale(${pop})`;
    }
  }
}
