/**
 * District names over the map, where the districts are.
 *
 * A painted district that is only a colour in one view is a district the
 * player forgets they made. The name stands over the middle of it, in the
 * street-sign face the rest of the city's lettering uses, with its colour as a
 * rule underneath -- small enough to read past, and gone when the camera is
 * down among the buildings where a label would sit in front of them.
 */

import type { Camera } from '../gfx/camera';
import type { Districts } from '../sim/districts';
import { DISTRICT_COLOURS } from '../sim/districts';

const REPAINT_MS = 60;
/** Closer than this and the labels are in the way of the buildings. */
const NEAR = 180;

export class DistrictLabels {
  private readonly root: HTMLElement;
  private readonly pool: HTMLElement[] = [];
  private centres: Array<{ id: number; name: string; colour: string; x: number; z: number }> = [];
  private seen = -1;
  private paintedAt = 0;

  constructor(parent: HTMLElement, private groundAt: (x: number, z: number) => number) {
    this.root = document.createElement('div');
    this.root.dataset.panel = 'district-labels';
    this.root.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:3;overflow:hidden';
    parent.appendChild(this.root);
  }

  set visible(on: boolean) { this.root.style.display = on ? 'block' : 'none'; }

  refresh(now: number, camera: Camera, width: number, height: number, D: Districts): void {
    if (now - this.paintedAt < REPAINT_MS) return;
    this.paintedAt = now;
    if (D.version !== this.seen) this.measure(D);
    const m = camera.viewProj;
    let shown = 0;
    if (camera.distance >= NEAR) {
      for (const c of this.centres) {
        const y = this.groundAt(c.x, c.z) + 20;
        const w = m[3] * c.x + m[7] * y + m[11] * c.z + m[15];
        if (w <= 0.001) continue;
        const nx = (m[0] * c.x + m[4] * y + m[8] * c.z + m[12]) / w;
        const ny = (m[1] * c.x + m[5] * y + m[9] * c.z + m[13]) / w;
        if (nx < -1.1 || nx > 1.1 || ny < -1.1 || ny > 1.1) continue;
        let el = this.pool[shown];
        if (el === undefined) {
          el = document.createElement('div');
          el.className = 'mr-district-label';
          el.append(document.createElement('span'), document.createElement('i'));
          this.root.appendChild(el);
          this.pool.push(el);
        }
        shown++;
        (el.firstChild as HTMLElement).textContent = c.name;
        el.style.setProperty('--tone', c.colour);
        el.style.transform = `translate(${((nx * 0.5 + 0.5) * width).toFixed(0)}px,`
          + `${((0.5 - ny * 0.5) * height).toFixed(0)}px) translate(-50%,-50%)`;
        el.style.display = 'block';
      }
    }
    for (let i = shown; i < this.pool.length; i++) this.pool[i].style.display = 'none';
  }

  /** Each district's centre of mass, worked out once per edit. */
  private measure(D: Districts): void {
    this.seen = D.version;
    const sum = new Map<number, [number, number, number]>();
    const g = D.grid, half = g / 2;
    for (let z = 0; z < g; z++) {
      for (let x = 0; x < g; x++) {
        const id = D.cells[z * g + x];
        if (id === 0) continue;
        const s = sum.get(id) ?? [0, 0, 0];
        s[0] += x; s[1] += z; s[2]++;
        sum.set(id, s);
      }
    }
    this.centres = D.list.flatMap((d) => {
      const s = sum.get(d.id);
      if (s === undefined) return [];
      return [{ id: d.id, name: d.name, colour: DISTRICT_COLOURS[d.colour % DISTRICT_COLOURS.length],
        x: (s[0] / s[2] - half + 0.5) * 8, z: (s[1] / s[2] - half + 0.5) * 8 }];
    });
  }
}
