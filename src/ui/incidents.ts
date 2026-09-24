/**
 * Emergencies, marked over the map: a fire, a break-in, somebody collapsed in
 * the street -- and whether anybody is coming.
 *
 * The simulation has always had them, and sent real vehicles on real roads to
 * answer them; nothing on screen said so, so a city could burn down a house at
 * a time without the player ever seeing one. A marker hangs over the roof of
 * every open incident in view, in the colour of the service it needs, pulsing
 * while nobody is assigned, and it says who is on the way. Clicking one
 * brings the camera to it.
 */

import type { Camera } from '../gfx/camera';
import type { IncidentView } from '../sim/agents/dispatch';
import { Need } from '../sim/agents/dispatch';
import { glyph } from './glyphs';

const REPAINT_MS = 90;
/** Metres from the camera beyond which a marker is not drawn. */
const FAR = 2600;
const MAX_SHOWN = 32;

interface Look { icon: string; colour: string; waiting: string; coming: string; working: string }

const LOOK: Record<number, Look> = {
  [Need.FIRE]: { icon: 'fire', colour: '#ff7a3d', waiting: 'Fire — no engine free',
    coming: 'Fire engine on the way', working: 'Firefighters on scene' },
  [Need.CRIME]: { icon: 'police', colour: '#6fa8ff', waiting: 'Break-in — no patrol free',
    coming: 'Police on the way', working: 'Police on scene' },
  [Need.MEDICAL]: { icon: 'health', colour: '#ff5d6c', waiting: 'Emergency — no ambulance',
    coming: 'Ambulance on the way', working: 'Paramedics on scene' },
};

export class IncidentMarkers {
  private readonly root: HTMLElement;
  private readonly pool: HTMLElement[] = [];
  private paintedAt = 0;
  on = true;

  constructor(parent: HTMLElement, private groundAt: (x: number, z: number) => number,
    private onFocus: (x: number, z: number) => void) {
    this.root = document.createElement('div');
    this.root.dataset.panel = 'incidents';
    this.root.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:4';
    parent.appendChild(this.root);
  }

  set visible(on: boolean) {
    this.on = on;
    this.root.style.display = on ? 'block' : 'none';
  }

  private marker(i: number): HTMLElement {
    let el = this.pool[i];
    if (el !== undefined) return el;
    el = document.createElement('button');
    el.className = 'mr-incident';
    el.innerHTML = '<span class="mr-incident-ring"></span><span class="mr-incident-icon"></span>'
      + '<span class="mr-incident-label"></span>';
    el.addEventListener('click', () => {
      const x = Number(el?.dataset.x), z = Number(el?.dataset.z);
      if (Number.isFinite(x) && Number.isFinite(z)) this.onFocus(x, z);
    });
    this.root.appendChild(el);
    this.pool.push(el);
    return el;
  }

  refresh(now: number, camera: Camera, width: number, height: number, view: IncidentView): void {
    if (!this.on || now - this.paintedAt < REPAINT_MS) return;
    this.paintedAt = now;
    const m = camera.viewProj;
    const ex = camera.eye[0], ez = camera.eye[2];
    let shown = 0;
    for (let i = 0; i < view.count && shown < MAX_SHOWN; i++) {
      const x = view.x[i], z = view.z[i];
      if (Math.hypot(x - ex, z - ez) > FAR) continue;
      const y = this.groundAt(x, z) + view.lift[i];
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (w <= 0.001) continue;
      const nx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
      const ny = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
      if (nx < -1.02 || nx > 1.02 || ny < -1.02 || ny > 1.02) continue;
      const look = LOOK[view.kind[i]];
      if (look === undefined) continue;
      const el = this.marker(shown++);
      const key = `${view.kind[i]}:${view.state[i]}`;
      if (el.dataset.key !== key) {
        el.dataset.key = key;
        el.dataset.state = String(view.state[i]);
        el.style.setProperty('--tone', look.colour);
        (el.children[1] as HTMLElement).innerHTML = glyph(look.icon, 18);
        const text = view.state[i] === 0 ? look.waiting
          : view.state[i] === 1 ? look.coming : look.working;
        (el.children[2] as HTMLElement).textContent = text;
        el.setAttribute('aria-label', text);
      }
      el.dataset.x = String(x);
      el.dataset.z = String(z);
      el.style.transform = `translate(${((nx * 0.5 + 0.5) * width).toFixed(1)}px,`
        + `${((0.5 - ny * 0.5) * height).toFixed(1)}px)`;
      el.style.display = 'block';
    }
    for (let i = shown; i < this.pool.length; i++) this.pool[i].style.display = 'none';
  }
}
