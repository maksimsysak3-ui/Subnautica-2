/**
 * The settings, and the panel that changes them.
 *
 * Two rules, both of which most settings screens break.
 *
 *   EVERY OPTION DOES SOMETHING. There is no switch in here that is read by
 *   nothing: each one is bound to a field the frame loop or the simulation
 *   actually reads, and the effect is visible on the next frame rather than on
 *   the next session. Shadows are the only one that rebuilds anything at all,
 *   and what it rebuilds is a texture and two bind groups.
 *
 *   AND IT SAYS WHAT IT COSTS. A graphics menu is a set of trades, so each row
 *   carries the trade in a line of its own rather than a number nobody can
 *   price.
 *
 * The values live in local storage under one key, so a player sets the game up
 * once on their machine and it stays that way.
 */

import { SKIN, css, panel, rule, key as keyStyle, setKey } from './skin';
import { setVolume, setMuted, click as clickSound } from './sound';

const STORE_KEY = 'citysim.settings.v1';

export interface SettingsValues {
  // ---- picture ----
  renderScale: number;
  shadows: boolean;
  shadowPixels: number;
  bloom: number;
  antialias: boolean;
  vignette: boolean;
  grass: number;
  autoScale: boolean;
  /** Screen-space ambient occlusion: contact shade between buildings. */
  ao: boolean;
  // ---- the living city ----
  movers: number;
  weather: boolean;
  // ---- interface ----
  tooltips: boolean;
  bubbles: boolean;
  notices: boolean;
  uiScale: number;
  // ---- sound ----
  volume: number;
  muted: boolean;
}

export const DEFAULTS: SettingsValues = {
  renderScale: 1, shadows: true, shadowPixels: 2048, bloom: 1, antialias: true,
  vignette: true, grass: 1, autoScale: true, ao: true,
  movers: 1, weather: true,
  tooltips: true, bubbles: true, notices: true, uiScale: 1,
  volume: 0.7, muted: false,
};

/** What the panel changes, and what the game does about each change. */
export interface SettingsHooks {
  apply(values: SettingsValues): void;
}

export class Settings {
  readonly values: SettingsValues = { ...DEFAULTS };
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly tabs: HTMLElement;
  private shown = false;
  private page = 'picture';

  constructor(parent: HTMLElement, private hooks: SettingsHooks) {
    this.load();

    this.root = document.createElement('div');
    this.root.dataset.panel = 'settings';
    css(this.root, ['position:absolute', 'inset:0', 'z-index:40', 'display:none',
      'align-items:center', 'justify-content:center', 'pointer-events:auto',
      'background:rgba(4,7,11,.55)', 'backdrop-filter:blur(3px)']);
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.close();
    });

    const card = document.createElement('div');
    css(card, [...panel(), 'width:min(760px, 92vw)', 'max-height:82vh',
      'display:flex', 'flex-direction:column', 'overflow:hidden', 'padding:0',
      'box-shadow:0 30px 80px rgba(0,0,0,.6)']);

    const head = document.createElement('div');
    css(head, ['display:flex', 'align-items:center', 'gap:12px',
      'padding:14px 16px 12px', `border-bottom:1px solid ${SKIN.edge}`]);
    const title = document.createElement('div');
    css(title, [`color:${SKIN.bright}`, 'font-size:15px', 'letter-spacing:.02em']);
    title.textContent = 'Settings';
    const shut = document.createElement('button');
    css(shut, ['margin-left:auto', 'width:26px', 'height:26px', 'padding:0',
      `border:1px solid ${SKIN.edge}`, `border-radius:${SKIN.radiusSmall}`,
      'background:transparent', `color:${SKIN.dim}`, 'cursor:pointer',
      `font:13px/1 ${SKIN.mono}`]);
    shut.textContent = '×';
    shut.setAttribute('aria-label', 'Close settings');
    shut.addEventListener('click', () => this.close());
    head.append(title, shut);

    this.tabs = document.createElement('div');
    css(this.tabs, ['display:flex', 'gap:6px', 'padding:12px 16px 0']);

    this.body = document.createElement('div');
    css(this.body, ['padding:14px 16px 18px', 'overflow:auto',
      'display:flex', 'flex-direction:column', 'gap:4px']);

    const foot = document.createElement('div');
    css(foot, ['display:flex', 'align-items:center', 'gap:10px',
      'padding:11px 16px', `border-top:1px solid ${SKIN.edge}`]);
    const note = document.createElement('div');
    css(note, [`color:${SKIN.faint}`, 'font-size:10px']);
    note.textContent = 'Saved on this machine. F3 shows the frame readout.';
    const reset = document.createElement('button');
    css(reset, ['margin-left:auto', 'padding:6px 12px',
      `border:1px solid ${SKIN.edge}`, `border-radius:${SKIN.radiusSmall}`,
      'background:transparent', `color:${SKIN.text}`, 'cursor:pointer',
      `font:11px/1 ${SKIN.mono}`]);
    reset.textContent = 'Reset to defaults';
    reset.addEventListener('click', () => {
      Object.assign(this.values, DEFAULTS);
      this.commit();
      this.paint();
    });
    foot.append(note, reset);

    card.append(head, this.tabs, this.body, foot);
    this.root.appendChild(card);
    parent.appendChild(this.root);

    for (const [id, name] of PAGES) {
      const b = document.createElement('button');
      b.dataset.page = id;
      css(b, ['padding:7px 13px', `border-radius:${SKIN.radiusSmall}`,
        `border:1px solid ${SKIN.edge}`, 'background:transparent',
        `color:${SKIN.dim}`, 'cursor:pointer', `font:11px/1 ${SKIN.mono}`,
        'letter-spacing:.04em']);
      b.textContent = name;
      b.addEventListener('click', () => { this.page = id; clickSound(); this.paint(); });
      this.tabs.appendChild(b);
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.shown) this.close();
    });

    this.apply();
    this.paint();
  }

  get open(): boolean { return this.shown; }

  toggle(): void { if (this.shown) this.close(); else this.show(); }

  show(): void {
    this.shown = true;
    this.root.style.display = 'flex';
    this.paint();
  }

  close(): void {
    this.shown = false;
    this.root.style.display = 'none';
  }

  /** Pushes the current values at the game. */
  apply(): void {
    setVolume(this.values.volume);
    setMuted(this.values.muted);
    document.documentElement.style.setProperty('--ui-scale', String(this.values.uiScale));
    this.hooks.apply(this.values);
  }

  private commit(): void {
    this.apply();
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.values));
    } catch {
      // A browser with storage switched off still gets to change settings; it
      // just does not remember them.
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw === null) return;
      const saved = JSON.parse(raw) as Partial<SettingsValues>;
      for (const k of Object.keys(DEFAULTS) as Array<keyof SettingsValues>) {
        const v = saved[k];
        if (typeof v === typeof DEFAULTS[k]) {
          (this.values[k] as unknown) = v;
        }
      }
    } catch {
      // A corrupt settings blob is not worth a crash on boot.
    }
  }

  // ---- the rows -------------------------------------------------------

  private paint(): void {
    for (const b of Array.from(this.tabs.children) as HTMLElement[]) {
      const on = b.dataset.page === this.page;
      b.style.color = on ? SKIN.bright : SKIN.dim;
      b.style.background = on ? 'rgba(98,212,255,.12)' : 'transparent';
      b.style.borderColor = on ? 'rgba(98,212,255,.4)' : SKIN.edge;
    }
    this.body.innerHTML = '';
    const rows = this.rowsFor(this.page);
    for (const row of rows) this.body.appendChild(row);
  }

  private rowsFor(page: string): HTMLElement[] {
    const v = this.values;
    const out: HTMLElement[] = [];
    if (page === 'picture') {
      out.push(this.choice('Resolution', 'How many pixels the city is drawn at. '
        + 'The single biggest thing you can trade.',
        [['50%', 0.5], ['70%', 0.7], ['85%', 0.85], ['100%', 1]],
        v.renderScale, (n) => { v.renderScale = n; v.autoScale = false; }));
      out.push(this.toggle2('Adjust automatically', 'Drops the resolution by itself '
        + 'when frames start being missed, and puts it back when they stop.',
        v.autoScale, (on) => { v.autoScale = on; }));
      out.push(rule());
      out.push(this.toggle2('Shadows', 'The sun pass. Off skips it entirely, '
        + 'which is a whole pass over the city.',
        v.shadows, (on) => { v.shadows = on; }));
      out.push(this.choice('Shadow detail', 'The shadow map’s size. Bigger is '
        + 'sharper edges and more memory.',
        [['Low', 1024], ['Medium', 2048], ['High', 4096]],
        v.shadowPixels, (n) => { v.shadowPixels = n; }));
      out.push(rule());
      out.push(this.choice('Bloom', 'The glow around what is brighter than the '
        + 'screen: lit windows, signage, the sun.',
        [['Off', 0], ['Subtle', 0.6], ['Normal', 1], ['Strong', 1.5]],
        v.bloom, (n) => { v.bloom = n; }));
      out.push(this.toggle2('Ambient occlusion', 'Soft contact shade where '
        + 'buildings meet the street and each other. Three passes at half size.',
        v.ao, (on) => { v.ao = on; }));
      out.push(this.toggle2('Antialiasing', 'Smooths the edges, then sharpens '
        + 'what that softened.', v.antialias, (on) => { v.antialias = on; }));
      out.push(this.toggle2('Vignette', 'Darkens the corners a little.',
        v.vignette, (on) => { v.vignette = on; }));
      out.push(rule());
      out.push(this.choice('Grass', 'Blades of real geometry near the camera.',
        [['Off', 0], ['Short', 0.6], ['Normal', 1], ['Deep', 1.4]],
        v.grass, (n) => { v.grass = n; }));
    } else if (page === 'city') {
      out.push(this.choice('Traffic and people drawn', 'How many of the vehicles '
        + 'and pedestrians the simulation is running get drawn. The rest still '
        + 'drive, still walk and still load the roads.',
        [['Fewer', 0.4], ['Some', 0.7], ['All', 1]],
        v.movers, (n) => { v.movers = n; }));
      out.push(this.toggle2('Weather', 'Cloud, rain and wet roads.',
        v.weather, (on) => { v.weather = on; }));
    } else if (page === 'interface') {
      out.push(this.choice('Interface size', 'Scales the panels and the bar.',
        [['Small', 0.9], ['Normal', 1], ['Large', 1.15]],
        v.uiScale, (n) => { v.uiScale = n; }));
      out.push(this.toggle2('Tooltips', 'The labels that appear under the pointer.',
        v.tooltips, (on) => { v.tooltips = on; }));
      out.push(this.toggle2('Thought bubbles', 'What buildings are complaining '
        + 'about, over the buildings.', v.bubbles, (on) => { v.bubbles = on; }));
      out.push(this.toggle2('Notices', 'The cards in the corner when something '
        + 'happens.', v.notices, (on) => { v.notices = on; }));
    } else {
      out.push(this.slider('Volume', 'Everything the game plays.',
        v.volume, (n) => { v.volume = n; }));
      out.push(this.toggle2('Mute', 'Silence, without forgetting the volume.',
        v.muted, (on) => { v.muted = on; }));
    }
    return out;
  }

  /** The shell every row shares: a name, a line about it, and the control. */
  private row(name: string, about: string): { el: HTMLElement; control: HTMLElement } {
    const el = document.createElement('div');
    css(el, ['display:flex', 'align-items:center', 'gap:16px', 'padding:9px 2px']);
    const text = document.createElement('div');
    css(text, ['display:flex', 'flex-direction:column', 'gap:3px', 'flex:1',
      'min-width:0']);
    const t = document.createElement('div');
    css(t, [`color:${SKIN.bright}`, 'font-size:12px']);
    t.textContent = name;
    const a = document.createElement('div');
    css(a, [`color:${SKIN.dim}`, 'font-size:10.5px', 'line-height:1.45']);
    a.textContent = about;
    text.append(t, a);
    const control = document.createElement('div');
    css(control, ['display:flex', 'gap:5px', 'flex:none']);
    el.append(text, control);
    return { el, control };
  }

  private choice(name: string, about: string, options: Array<[string, number]>,
    now: number, set: (n: number) => void): HTMLElement {
    const { el, control } = this.row(name, about);
    for (const [text, value] of options) {
      const b = document.createElement('button');
      b.textContent = text;
      keyStyle(b, SKIN.accent, 30);
      b.style.width = 'auto';
      b.style.height = '28px';
      b.style.padding = '0 11px';
      b.style.fontSize = '10.5px';
      setKey(b, SKIN.accent, Math.abs(value - now) < 1e-6);
      b.addEventListener('click', () => {
        set(value);
        clickSound();
        this.commit();
        this.paint();
      });
      control.appendChild(b);
    }
    return el;
  }

  private toggle2(name: string, about: string, now: boolean,
    set: (on: boolean) => void): HTMLElement {
    return this.choice(name, about, [['Off', 0], ['On', 1]], now ? 1 : 0,
      (n) => set(n === 1));
  }

  private slider(name: string, about: string, now: number,
    set: (n: number) => void): HTMLElement {
    const { el, control } = this.row(name, about);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0'; input.max = '1'; input.step = '0.05';
    input.value = String(now);
    css(input, ['width:180px', 'accent-color:' + SKIN.accent]);
    const read = document.createElement('div');
    css(read, [`color:${SKIN.bright}`, 'font-size:11px', 'width:36px',
      'text-align:right', 'font-variant-numeric:tabular-nums']);
    read.textContent = `${Math.round(now * 100)}%`;
    input.addEventListener('input', () => {
      const n = Number(input.value);
      read.textContent = `${Math.round(n * 100)}%`;
      set(n);
      this.apply();
    });
    input.addEventListener('change', () => this.commit());
    control.append(input, read);
    return el;
  }
}

const PAGES: Array<[string, string]> = [
  ['picture', 'Picture'],
  ['city', 'The city'],
  ['interface', 'Interface'],
  ['sound', 'Sound'],
];
