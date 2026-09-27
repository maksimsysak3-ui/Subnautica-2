/**
 * The tech wheel: every device and desk in the game, a flick away.
 *
 * Hold Tab and a ring opens round the middle of the screen; point at a slice
 * and let go, and it opens. A quick tap of Tab leaves the ring open to click
 * instead, which is what a trackpad or a first-time player wants. Escape, or
 * a click in the middle, puts it away.
 *
 * It holds nothing of its own: each slice is a label, an icon and a callback
 * handed over by the game, so the wheel cannot drift out of step with what
 * the things it opens actually do.
 */

import { click as clickSound } from './sound';
import { tip } from './skin';

export interface WheelItem {
  label: string;
  /** Which device is drawn for it. */
  device: 'phone' | 'computer';
  /** What it says under the label in the middle. */
  hint: string;
  run: () => void;
}

const SIZE = 420;
/** Pointer travel from the centre, in pixels, before a side is picked. */
const DEAD = 40;
/** A Tab held longer than this is a hold; shorter is a tap. */
const TAP_MS = 220;

/** A box of six faces in CSS 3D, `w` wide, `h` tall, `d` deep, with classes for its faces. */
function box(w: number, h: number, d: number, cls: string): HTMLElement {
  const b = document.createElement('div');
  b.className = `mr-dev-box ${cls}`;
  b.style.width = `${w}px`;
  b.style.height = `${h}px`;
  const face = (name: string, fw: number, fh: number, t: string): void => {
    const f = document.createElement('div');
    f.className = `mr-dev-face is-${name}`;
    f.style.width = `${fw}px`;
    f.style.height = `${fh}px`;
    f.style.left = `${(w - fw) / 2}px`;
    f.style.top = `${(h - fh) / 2}px`;
    f.style.transform = t;
    b.appendChild(f);
  };
  face('front', w, h, `translateZ(${d / 2}px)`);
  face('back', w, h, `rotateY(180deg) translateZ(${d / 2}px)`);
  face('side', d, h, `rotateY(90deg) translateZ(${w / 2}px)`);
  face('side', d, h, `rotateY(-90deg) translateZ(${w / 2}px)`);
  face('cap', w, d, `rotateX(90deg) translateZ(${h / 2}px)`);
  face('cap', w, d, `rotateX(-90deg) translateZ(${h / 2}px)`);
  return b;
}

/** The phone: a slab with a screen, a camera pill and an app grid on it. */
function phoneModel(): HTMLElement {
  const m = document.createElement('div');
  m.className = 'mr-dev is-phone';
  const body = box(84, 170, 9, 'mr-dev-phone');
  const screen = body.querySelector('.is-front') as HTMLElement;
  screen.innerHTML = '<div class="mr-dev-pill"></div><div class="mr-dev-apps">'
    + '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>';
  (body.querySelector('.is-back') as HTMLElement).innerHTML = '<div class="mr-dev-lens"></div>';
  m.appendChild(body);
  return m;
}

/** The computer: a monitor on a stand, with a desktop, a window and a dock. */
function computerModel(): HTMLElement {
  const m = document.createElement('div');
  m.className = 'mr-dev is-computer';
  const screen = box(190, 122, 10, 'mr-dev-monitor');
  (screen.querySelector('.is-front') as HTMLElement).innerHTML = '<div class="mr-dev-desk">'
    + '<div class="mr-dev-bar"></div><div class="mr-dev-win"><span></span><span></span><span></span></div>'
    + '<div class="mr-dev-dock"><i></i><i></i><i></i><i></i><i></i></div></div>';
  const neck = box(26, 44, 8, 'mr-dev-neck');
  const foot = box(76, 6, 46, 'mr-dev-foot');
  m.append(screen, neck, foot);
  return m;
}

export class TechWheel {
  private readonly root: HTMLElement;
  private readonly sides: HTMLElement[] = [];
  private readonly caption: HTMLElement;
  private readonly sub: HTMLElement;
  private readonly launcher: HTMLButtonElement;
  private shown = false;
  private hot = -1;
  private downAt = 0;
  private holding = false;
  private enabled = false;
  private readonly dot: HTMLElement;

  /** Something waiting on one of the devices -- petitions on the computer. */
  badge(n: number): void {
    this.dot.hidden = n <= 0;
    if (n > 0) this.dot.textContent = String(n);
  }

  constructor(parent: HTMLElement, private items: readonly WheelItem[]) {
    this.launcher = document.createElement('button');
    this.launcher.className = 'mr-wheel-launch';
    this.launcher.setAttribute('aria-label', 'Devices');
    this.launcher.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">'
      + '<circle cx="10" cy="10" r="8"/><path d="M10 2v16"/></svg>';
    tip(this.launcher, 'Devices — your phone and the City Hall computer', 'Tab');
    this.launcher.addEventListener('click', () => { clickSound(); this.toggle(); });
    this.dot = document.createElement('span');
    this.dot.className = 'mr-pc-dot';
    this.dot.hidden = true;
    this.launcher.appendChild(this.dot);
    parent.appendChild(this.launcher);

    this.root = document.createElement('div');
    this.root.className = 'mr-wheel';
    this.root.dataset.panel = 'tech-wheel';
    this.root.hidden = true;
    this.root.setAttribute('role', 'menu');
    this.root.setAttribute('aria-label', 'Devices');
    this.root.style.width = `${SIZE}px`;
    this.root.style.height = `${SIZE}px`;

    items.forEach((item, i) => {
      const side = document.createElement('button');
      side.className = `mr-wheel-side is-${i === 0 ? 'left' : 'right'}`;
      side.setAttribute('role', 'menuitem');
      side.setAttribute('aria-label', item.label);
      const stage = document.createElement('div');
      stage.className = 'mr-dev-stage';
      stage.appendChild(item.device === 'phone' ? phoneModel() : computerModel());
      const name = document.createElement('span');
      name.className = 'mr-wheel-name';
      name.textContent = item.label;
      side.append(stage, name);
      side.addEventListener('pointerenter', () => this.light(i));
      side.addEventListener('click', () => this.choose(i));
      this.root.appendChild(side);
      this.sides.push(side);
    });

    const middle = document.createElement('div');
    middle.className = 'mr-wheel-middle';
    this.caption = document.createElement('b');
    this.sub = document.createElement('span');
    middle.append(this.caption, this.sub);
    middle.addEventListener('click', () => this.close());
    this.root.appendChild(middle);
    parent.appendChild(this.root);

    window.addEventListener('keydown', (e) => {
      if (!this.enabled || e.key !== 'Tab') return;
      // Only when nothing on the interface has focus: Tab moving between
      // buttons is how a keyboard player gets round the panels.
      const t = e.target as HTMLElement | null;
      if (t !== null && t !== document.body && t.tagName !== 'CANVAS' && !this.root.contains(t)) return;
      e.preventDefault();
      if (e.repeat) return;
      if (this.shown) { this.close(); return; }
      this.downAt = performance.now();
      this.holding = true;
      this.show();
    });
    window.addEventListener('keyup', (e) => {
      if (e.key !== 'Tab' || !this.holding) return;
      this.holding = false;
      // Released on a side after a hold: that is the pick. A tap leaves it open.
      if (performance.now() - this.downAt > TAP_MS && this.hot >= 0) this.choose(this.hot);
    });
    window.addEventListener('keydown', (e) => {
      if (this.shown && e.key === 'Escape') { e.stopPropagation(); this.close(); }
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.shown) return;
      const r = this.root.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      if (Math.hypot(dx, dy) < DEAD) { this.light(-1); return; }
      this.light(dx < 0 ? 0 : Math.min(1, this.items.length - 1));
    });
    this.light(-1);
  }

  set visible(on: boolean) {
    this.enabled = on;
    this.launcher.style.display = on ? 'grid' : 'none';
    if (!on) this.close();
  }

  toggle(): void { if (this.shown) this.close(); else this.show(); }

  show(): void {
    this.shown = true;
    this.root.hidden = false;
    this.light(-1);
    requestAnimationFrame(() => this.root.classList.add('is-open'));
  }

  close(): void {
    if (!this.shown) return;
    this.shown = false;
    this.holding = false;
    this.root.classList.remove('is-open');
    setTimeout(() => { if (!this.shown) this.root.hidden = true; }, 160);
  }

  private light(i: number): void {
    this.hot = i;
    this.sides.forEach((s, k) => s.classList.toggle('is-hot', k === i));
    const item = this.items[i];
    this.caption.textContent = item?.label ?? 'Devices';
    this.sub.textContent = item?.hint ?? 'point left or right';
  }

  private choose(i: number): void {
    const item = this.items[i];
    if (item === undefined) return;
    clickSound();
    this.close();
    item.run();
  }
}
