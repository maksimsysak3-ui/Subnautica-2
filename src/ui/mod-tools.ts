/**
 * The tools the enabled tool mods add: a small dock in the city's corner.
 *
 * Photo Mode takes the interface away, draws a letterbox and turns the camera
 * slowly round the city -- the camera is still the player's to drag, and
 * Escape or the button brings everything back. Sky Control holds the hour and
 * the weather where the player puts them, and hands both back to the clock
 * with Auto.
 *
 * Only built when one of those mods is on; see `toolOn`.
 */

import type { Renderer } from '../gfx/renderer';
import type { Camera } from '../gfx/camera';
import { toolOn } from '../sim/mods';
import { glyph } from './glyphs';

/** Named weathers, as the front the sky model turns into them. See `skyOf`. */
const WEATHERS: ReadonlyArray<[string, string, number | null]> = [
  ['Auto', 'views', null], ['Clear', 'sun', 0.02], ['Fog', 'fog', 0.2], ['Cloudy', 'partly', 0.42],
  ['Overcast', 'cloud', 0.62], ['Rain', 'rain', 0.82], ['Storm', 'storm', 1],
];

export class ModTools {
  private readonly root = document.createElement('div');
  private readonly sky = document.createElement('div');
  private readonly bars = document.createElement('div');
  private photo = false;
  private orbit = true;
  private shown = true;
  /** The weather and hour the player chose, kept while the menu borrows the sky. */
  private front: number | null = null;
  private held: number | null = null;

  constructor(host: HTMLElement, private renderer: Renderer, private camera: Camera) {
    this.root.className = 'mr-modtools';
    this.bars.className = 'mr-letterbox';
    this.bars.innerHTML = '<i></i><i></i>';
    if (toolOn('photo')) this.root.appendChild(this.button('look', 'Photo mode', () => this.setPhoto(!this.photo)));
    if (toolOn('sky')) {
      this.root.appendChild(this.button('sun', 'Sky control', () => { this.sky.hidden = !this.sky.hidden; }));
      this.buildSky();
      this.root.appendChild(this.sky);
    }
    host.append(this.bars, this.root);
    addEventListener('keydown', (e) => {
      if (!this.photo) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.setPhoto(false); }
      else if (e.key === ' ' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault(); e.stopImmediatePropagation(); this.orbit = !this.orbit;
      }
    }, true);
  }

  /** Whether any tool mod is on, so there is a dock worth building. */
  static wanted(): boolean { return toolOn('photo') || toolOn('sky'); }

  /** Hidden behind the menu with the rest of the game's interface. */
  set visible(on: boolean) {
    if (on === this.shown) return;
    this.shown = on;
    if (!on && this.photo) this.setPhoto(false);
    this.root.hidden = !on;
    if (!on) {
      this.held = this.renderer.sunHeld;
      this.renderer.sunHeld = null;
    } else {
      this.renderer.sunHeld = this.held;
    }
  }

  /** Puts the player's weather back after the menu has had the sky. */
  resume(): void {
    if (this.front !== null) this.renderer.weather.set(this.front);
  }

  /** Per frame: Photo Mode's slow turn. */
  update(dt: number): void {
    if (!this.photo || !this.orbit) return;
    this.camera.yaw += dt * 0.035;
    this.camera.update();
  }

  private setPhoto(on: boolean): void {
    if (on && !this.shown) return;
    this.photo = on;
    this.orbit = true;
    document.body.classList.toggle('is-photo', on);
    this.bars.classList.toggle('is-on', on);
    this.root.classList.toggle('is-photo', on);
    if (on) this.sky.hidden = true;
  }

  private button(icon: string, label: string, run: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = 'mr-modtool';
    b.innerHTML = glyph(icon, 20);
    b.title = label;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', run);
    return b;
  }

  private buildSky(): void {
    this.sky.className = 'mr-skypanel';
    this.sky.hidden = true;
    const head = document.createElement('div');
    head.className = 'mr-skypanel-head';
    const hour = document.createElement('b');
    const hold = document.createElement('label');
    hold.className = 'mr-mod-check';
    const box = document.createElement('input');
    box.type = 'checkbox';
    hold.append(box, document.createTextNode(' Hold the hour'));
    head.append(document.createTextNode('Time of day'), hour);
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '0'; range.max = '1'; range.step = '0.001';
    const show = (): void => {
      const t = Number(range.value), h = Math.floor(t * 24), m = Math.floor((t * 24 % 1) * 60);
      hour.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };
    const sync = (): void => { range.value = String(this.renderer.timeOfDay); show(); };
    range.addEventListener('input', () => {
      box.checked = true;
      this.renderer.sunHeld = Number(range.value);
      show();
    });
    box.addEventListener('change', () => {
      this.renderer.sunHeld = box.checked ? Number(range.value) : null;
    });
    // The slider follows the clock whenever the panel opens and nothing holds it.
    new MutationObserver(() => { if (!this.sky.hidden && this.renderer.sunHeld === null) sync(); })
      .observe(this.sky, { attributes: true, attributeFilter: ['hidden'] });
    sync();

    const weather = document.createElement('div');
    weather.className = 'mr-seg';
    WEATHERS.forEach(([name, icon, front], i) => {
      const b = document.createElement('button');
      b.className = `mr-seg-btn${i === 0 ? ' is-on' : ''}`;
      b.innerHTML = `${glyph(icon, 14)}<span>${name}</span>`;
      b.addEventListener('click', () => {
        weather.querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', x === b));
        this.front = front;
        if (front === null) this.renderer.weather.release();
        else this.renderer.weather.set(front);
      });
      weather.appendChild(b);
    });
    const label = document.createElement('div');
    label.className = 'mr-skypanel-head';
    label.textContent = 'Weather';
    this.sky.append(head, range, hold, label, weather);
  }
}
