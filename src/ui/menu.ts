/**
 * Menus.
 *
 * OWNED BY: UI/UX.
 *
 * ## Why a menu is not decoration
 * Until now the game began with a click-to-play overlay and no way to choose
 * anything: no mission, no loadout, no settings. That is not a missing screen,
 * it is a missing *decision* — a tactical shooter is largely about the choices
 * you make before you go in, and with nothing to choose the first thirty
 * seconds of every session were identical.
 *
 * Three screens, one stack:
 *   DEPLOY   — pick the site and the tasking, read the briefing and the intel
 *   LOADOUT  — pick the weapon for each slot, and its finish
 *   SETTINGS — sensitivity, invert, field of view
 *
 * And a pause menu on Escape that reaches all three, because a setting you can
 * only change before you launch is a setting you change by quitting.
 *
 * ## One rule the layout follows
 * Nothing in here is a modal dialogue over the game. The menu takes the whole
 * screen and the game keeps rendering behind it at a blur — so the place you
 * are about to go is visible while you decide, which is the only reason a
 * briefing screen with a live backdrop is worth the frame cost.
 */

import type { System, EngineContext } from '../core/engine';
import { bus } from '../core/events';
import { services } from '../core/contracts';
import { MISSIONS, type MissionTemplate } from '../missions/catalogue';
import { SKINS } from '../weaponmodels/skins';

export type Screen = 'none' | 'deploy' | 'loadout' | 'controls' | 'settings';

const SITES: Array<{ id: 'villa' | 'quay'; name: string; blurb: string }> = [
  { id: 'villa', name: 'CASA VERDUGO',
    blurb: 'Walled cartel estate above the basin. One gate everybody watches, three ways in nobody does.' },
  { id: 'quay', name: 'MERIDIAN QUAY',
    blurb: 'Bonded cargo terminal. Container maze at ground level, catwalks above it, and cold rooms with one way out.' },
];

/** Weapons offered per slot. Slot 4 is always the sidearm. */
const SLOT_CHOICES: Array<{ label: string; ids: string[] }> = [
  { label: 'PRIMARY', ids: ['ho-mk4c', 'ho-mk4r', 'md-bp5', 'vp-ak74m', 'vp-akm', 'aw-g4', 'ho-mk8'] },
  { label: 'SECONDARY', ids: ['md-k7', 'tk-t9', 'ca-dm7', 'aw-mp7k', 'ca-vm9', 'tk-s57'] },
  { label: 'BREACHING', ids: ['ho-m590', 'md-b12', 'ca-as12'] },
  { label: 'SIDEARM', ids: ['aw-p9', 'vp-tk33', 'ho-m12', 'ca-x10'] },
];

const CONTROLS: Array<[string, string[][]]> = [
  ['MOVEMENT', [
    ['W A S D', 'Move'],
    ['Shift', 'Sprint'],
    ['Alt', 'Walk quietly'],
    ['Space', 'Jump'],
    ['C', 'Crouch / stand'],
    ['Z', 'Go prone'],
    ['Q / X', 'Lean left / right'],
  ]],
  ['WEAPON', [
    ['LMB', 'Fire'],
    ['E / RMB', 'Aim down sights'],
    ['R', 'Reload'],
    ['B', 'Change fire mode'],
    ['1 – 4', 'Select a slot'],
    ['V / Wheel', 'Next weapon'],
    ['Shift (ADS)', 'Hold breath'],
  ]],
  ['WORLD', [
    ['F', 'Open doors, use things'],
    ['T', 'Weapon light'],
    ['Mouse', 'Look'],
    ['Esc', 'Menu / release cursor'],
  ]],
];

const CSS = `
#menu { position: fixed; inset: 0; z-index: 600; display: none;
  font-family: var(--mono, ui-monospace, monospace); color: var(--text, #d8e2ea);
  background: rgba(5,7,10,.82); backdrop-filter: blur(7px) saturate(.7); }
#menu.on { display: grid; grid-template-rows: auto 1fr auto; }

#menu header { padding: 26px 46px 0; display: flex; align-items: baseline; gap: 28px; }
#menu header h1 { margin: 0; font-size: 19px; letter-spacing: .46em; font-weight: 500; }
#menu header nav { display: flex; gap: 4px; margin-left: auto; }
#menu header nav button { background: none; border: 1px solid transparent; color: var(--text-faint, #55677a);
  font: inherit; font-size: 11px; letter-spacing: .22em; padding: 8px 16px; cursor: pointer;
  transition: color .15s ease, border-color .15s ease; }
#menu header nav button:hover { color: var(--text, #d8e2ea); }
#menu header nav button.on { color: var(--brass, #c8a355); border-color: rgba(200,163,85,.4); }

#menu .body { overflow: auto; padding: 26px 46px; }
#menu .pane { display: none; }
#menu .pane.on { display: block; }

#menu .cols { display: grid; grid-template-columns: 300px 1fr; gap: 26px; align-items: start; }
#menu .list { display: flex; flex-direction: column; gap: 6px; }
#menu .opt { text-align: left; cursor: pointer; background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.10); color: var(--text-dim, #8ea0ae);
  font: inherit; padding: 11px 13px; transition: background .12s ease, border-color .12s ease; }
#menu .opt:hover { background: rgba(255,255,255,.07); border-color: rgba(200,163,85,.4); }
#menu .opt.on { border-color: var(--brass, #c8a355); background: rgba(200,163,85,.12); }
#menu .opt b { display: block; font-size: 12px; letter-spacing: .16em; color: #d8e2ea; font-weight: 600; }
#menu .opt.on b { color: var(--brass, #c8a355); }
#menu .opt i { display: block; font-style: normal; font-size: 10px; line-height: 1.55;
  color: var(--text-faint, #55677a); margin-top: 5px; }

#menu .detail { border-left: 1px solid rgba(255,255,255,.09); padding-left: 26px; min-height: 300px; }
#menu .detail h2 { margin: 0 0 3px; font-size: 15px; letter-spacing: .28em; font-weight: 500;
  color: var(--brass, #c8a355); }
#menu .detail .sub { font-size: 10px; letter-spacing: .2em; color: var(--text-faint, #55677a);
  margin-bottom: 18px; }
#menu .detail p { font-size: 12px; line-height: 1.85; letter-spacing: .04em;
  color: var(--text-dim, #8ea0ae); max-width: 60ch; margin: 0 0 18px; }
#menu .detail h3 { font-size: 10px; letter-spacing: .26em; color: var(--text-faint, #55677a);
  margin: 20px 0 8px; font-weight: 400; }
#menu .detail ul { margin: 0; padding-left: 16px; font-size: 11px; line-height: 1.9;
  color: var(--text-dim, #8ea0ae); }
#menu .tasklist { display: grid; gap: 5px; }
#menu .tasklist div { font-size: 11px; letter-spacing: .08em; color: var(--text-dim, #8ea0ae); }
#menu .tasklist div em { font-style: normal; color: var(--text-faint, #55677a); }

#menu .slots { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 22px; }
#menu .slots button { cursor: pointer; background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.10); color: var(--text-dim, #8ea0ae);
  font: inherit; font-size: 10px; letter-spacing: .2em; padding: 10px; }
#menu .slots button.on { border-color: var(--brass, #c8a355); color: var(--brass, #c8a355); }
#menu .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
#menu .stat { display: grid; grid-template-columns: 1fr auto; gap: 5px 16px; font-size: 11px;
  letter-spacing: .1em; max-width: 340px; }
#menu .stat dt { color: var(--text-faint, #55677a); }
#menu .stat dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }

#menu .row { display: flex; align-items: center; gap: 16px; margin-bottom: 16px;
  font-size: 11px; letter-spacing: .14em; color: var(--text-dim, #8ea0ae); }
#menu .row label { width: 190px; }
#menu .row input[type=range] { flex: 1; max-width: 300px; accent-color: #c8a355; }
#menu .row .val { width: 60px; text-align: right; font-variant-numeric: tabular-nums;
  color: var(--text, #d8e2ea); }
#menu .row input[type=checkbox] { accent-color: #c8a355; width: 15px; height: 15px; }

#menu .keys { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 30px 46px; max-width: 1080px; }
#menu .keys section h3 { font-size: 10px; letter-spacing: .26em; color: var(--text-faint, #55677a);
  margin: 0 0 12px; font-weight: 400; }
#menu .keys div { display: flex; align-items: baseline; gap: 14px; padding: 6px 0;
  border-bottom: 1px solid rgba(255,255,255,.05); font-size: 11px; letter-spacing: .08em; }
#menu .keys kbd { flex: 0 0 96px; font: inherit; font-size: 10px; letter-spacing: .12em;
  color: var(--brass, #c8a355); }
#menu .keys span { color: var(--text-dim, #8ea0ae); }

#menu footer { padding: 0 46px 30px; display: flex; gap: 12px; align-items: center; }
#menu footer .hint { font-size: 10px; letter-spacing: .18em; color: var(--text-faint, #55677a);
  margin-right: auto; }
#menu .go { cursor: pointer; background: rgba(200,163,85,.16); color: #f0e2c2;
  border: 1px solid rgba(200,163,85,.6); font: inherit; font-size: 12px;
  letter-spacing: .26em; padding: 14px 40px; transition: background .15s ease; }
#menu .go:hover { background: rgba(200,163,85,.3); }
#menu .ghost { cursor: pointer; background: none; color: var(--text-dim, #8ea0ae);
  border: 1px solid rgba(255,255,255,.14); font: inherit; font-size: 11px;
  letter-spacing: .2em; padding: 14px 24px; }
#menu .ghost:hover { color: var(--text, #d8e2ea); border-color: rgba(255,255,255,.3); }
`;

export interface MenuHooks {
  /** Build a map and start a mission on it. */
  deploy(site: 'villa' | 'quay', missionId: string): void;
  /** Give a slot a weapon. */
  setWeapon(slot: number, specId: string): void;
  /** Give a slot a finish. */
  setSkin(slot: number, skinId: string): void;
  settings: {
    sensitivity: number;
    invertY: boolean;
    fov: number;
    apply(): void;
  };
}

export class Menu implements System {
  readonly id = 'menu';
  readonly order = 52;
  readonly initOrder = 82;
  readonly budgetMs = 0.3;

  hooks: MenuHooks | null = null;

  private root!: HTMLElement;
  private screen: Screen = 'none';
  private site: 'villa' | 'quay' = 'villa';
  private mission: MissionTemplate = MISSIONS[0];
  private slot = 0;
  private slotWeapon = ['ho-mk4c', 'md-bp5', 'ho-m590', 'aw-p9'];
  private slotSkin = ['issue', 'issue', 'issue', 'issue'];

  /** True while a menu is up — the engine pauses and the cursor comes back. */
  get isOpen(): boolean { return this.screen !== 'none'; }

  init(_ctx: EngineContext): void {
    if (typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'menu';
    root.innerHTML = `
      <header>
        <h1>BLACK MERIDIAN</h1>
        <nav>
          <button data-screen="deploy">DEPLOY</button>
          <button data-screen="loadout">LOADOUT</button>
          <button data-screen="controls">CONTROLS</button>
          <button data-screen="settings">SETTINGS</button>
        </nav>
      </header>
      <div class="body">
        <div class="pane" data-pane="deploy"></div>
        <div class="pane" data-pane="loadout"></div>
        <div class="pane" data-pane="controls"></div>
        <div class="pane" data-pane="settings"></div>
      </div>
      <footer>
        <span class="hint">ESC CLOSES · THE GAME KEEPS RUNNING BEHIND THIS</span>
        <button class="ghost" data-act="close">RESUME</button>
        <button class="go" data-act="deploy">DEPLOY</button>
      </footer>
    `;
    document.body.appendChild(root);
    this.root = root;

    root.addEventListener('click', (e) => this.onClick(e));
    root.addEventListener('input', (e) => this.onInput(e));

    this.render();
  }

  open(screen: Screen = 'deploy'): void {
    this.screen = screen;
    this.root.classList.add('on');
    this.render();
    bus.emit('ui:screenChanged', { screen });
  }

  close(): void {
    this.screen = 'none';
    this.root.classList.remove('on');
    bus.emit('ui:screenChanged', { screen: 'game' });
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open('deploy');
  }

  // -----------------------------------------------------------------------

  private onClick(e: Event): void {
    const el = (e.target as HTMLElement).closest('[data-screen],[data-act],[data-pick]');
    if (!el) return;
    e.stopPropagation();
    const d = (el as HTMLElement).dataset;

    if (d.screen) { this.screen = d.screen as Screen; this.render(); return; }
    if (d.act === 'close') { this.close(); return; }
    if (d.act === 'deploy') {
      this.hooks?.deploy(this.site, this.mission.id);
      this.close();
      return;
    }
    if (d.pick === 'site') {
      this.site = d.value as 'villa' | 'quay';
      const first = MISSIONS.find((m) => m.siteId === this.site);
      if (first) this.mission = first;
    } else if (d.pick === 'mission') {
      this.mission = MISSIONS.find((m) => m.id === d.value) ?? this.mission;
    } else if (d.pick === 'slot') {
      this.slot = Number(d.value);
    } else if (d.pick === 'weapon') {
      this.slotWeapon[this.slot] = d.value!;
      this.hooks?.setWeapon(this.slot, d.value!);
    } else if (d.pick === 'skin') {
      this.slotSkin[this.slot] = d.value!;
      this.hooks?.setSkin(this.slot, d.value!);
    }
    this.render();
  }

  private onInput(e: Event): void {
    const el = e.target as HTMLInputElement;
    const s = this.hooks?.settings;
    if (!s || !el.dataset.setting) return;
    if (el.dataset.setting === 'sensitivity') s.sensitivity = Number(el.value) / 1000;
    if (el.dataset.setting === 'fov') s.fov = Number(el.value);
    if (el.dataset.setting === 'invert') s.invertY = el.checked;
    s.apply();
    this.render();
  }

  // -----------------------------------------------------------------------

  private render(): void {
    if (!this.root) return;
    for (const b of Array.from(this.root.querySelectorAll<HTMLElement>('nav button'))) {
      b.classList.toggle('on', b.dataset.screen === this.screen);
    }
    for (const p of Array.from(this.root.querySelectorAll<HTMLElement>('.pane'))) {
      p.classList.toggle('on', p.dataset.pane === this.screen);
    }
    this.renderDeploy();
    this.renderLoadout();
    this.renderControls();
    this.renderSettings();
  }

  private renderDeploy(): void {
    const pane = this.root.querySelector<HTMLElement>('[data-pane="deploy"]')!;
    const missions = MISSIONS.filter((m) => m.siteId === this.site);
    const m = this.mission;

    pane.innerHTML = `
      <div class="cols">
        <div class="list">
          ${SITES.map((s) => `
            <button class="opt ${s.id === this.site ? 'on' : ''}" data-pick="site" data-value="${s.id}">
              <b>${s.name}</b><i>${s.blurb}</i>
            </button>`).join('')}
          <h3 style="font-size:10px;letter-spacing:.26em;color:#55677a;margin:18px 0 6px;font-weight:400">TASKING</h3>
          ${missions.map((t) => `
            <button class="opt ${t.id === m.id ? 'on' : ''}" data-pick="mission" data-value="${t.id}">
              <b>${t.codename}</b><i>${'●'.repeat(Math.round(t.difficulty / 2))}${'○'.repeat(5 - Math.round(t.difficulty / 2))} &nbsp; ${t.hour < 6 || t.hour > 19 ? 'NIGHT' : t.hour > 17 ? 'DUSK' : 'DAY'}</i>
            </button>`).join('')}
        </div>
        <div class="detail">
          <h2>${m.codename}</h2>
          <div class="sub">${m.name.toUpperCase()} &nbsp;·&nbsp; DIFFICULTY ${m.difficulty}/10</div>
          <p>${m.briefing}</p>
          <h3>TASKING</h3>
          <div class="tasklist">
            ${m.objectives.filter((o) => !o.hidden).map((o) =>
              `<div>${o.optional ? '○' : '▸'} ${o.label}${o.optional ? ' <em>(optional)</em>' : ''}<br>
               <em style="padding-left:14px">${o.description}</em></div>`).join('')}
          </div>
          <h3>INTELLIGENCE</h3>
          <ul>${m.intel.map((i) => `<li>${i}</li>`).join('')}</ul>
        </div>
      </div>`;
  }

  private renderLoadout(): void {
    const pane = this.root.querySelector<HTMLElement>('[data-pane="loadout"]')!;
    const weapons = services.tryGet('weapons');
    const choices = SLOT_CHOICES[this.slot];
    const current = this.slotWeapon[this.slot];
    const spec = weapons?.specs.get(current);

    pane.innerHTML = `
      <div class="slots">
        ${SLOT_CHOICES.map((s, i) => `
          <button class="${i === this.slot ? 'on' : ''}" data-pick="slot" data-value="${i}">
            ${s.label}<br><span style="color:#8ea0ae;letter-spacing:.06em;font-size:10px">
            ${weapons?.specs.get(this.slotWeapon[i])?.name ?? '—'}</span>
          </button>`).join('')}
      </div>
      <div class="cols">
        <div class="list">
          ${choices.ids.map((id) => {
            const w = weapons?.specs.get(id);
            if (!w) return '';
            return `<button class="opt ${id === current ? 'on' : ''}" data-pick="weapon" data-value="${id}">
              <b>${w.name}</b><i>${w.make} · ${w.caliber} · ${w.barrelLengthMm}mm</i></button>`;
          }).join('')}
        </div>
        <div class="detail">
          <h2>${spec?.name ?? '—'}</h2>
          <div class="sub">${spec?.make ?? ''}</div>
          <p>${spec?.description ?? ''}</p>
          <h3>CHARACTERISTICS</h3>
          <dl class="stat">
            <dt>Calibre</dt><dd>${spec?.caliber ?? '—'}</dd>
            <dt>Barrel</dt><dd>${spec?.barrelLengthMm ?? 0} mm</dd>
            <dt>Cyclic</dt><dd>${spec?.rpm ?? 0} rpm</dd>
            <dt>Magazine</dt><dd>${spec?.baseMagazine ?? 0}</dd>
            <dt>Mass</dt><dd>${(spec?.massKg ?? 0).toFixed(1)} kg</dd>
            <dt>Ergonomics</dt><dd>${spec?.ergonomics ?? 0}</dd>
            <dt>Dispersion</dt><dd>${(spec?.spreadMoa ?? 0).toFixed(1)} MOA</dd>
          </dl>
          <h3>FINISH</h3>
          <div class="grid">
            ${SKINS.map((s) => `
              <button class="opt ${s.id === this.slotSkin[this.slot] ? 'on' : ''}"
                      data-pick="skin" data-value="${s.id}">
                <b>${s.name}</b><i>${s.blurb}</i></button>`).join('')}
          </div>
        </div>
      </div>`;
  }

  private renderControls(): void {
    const pane = this.root.querySelector<HTMLElement>('[data-pane="controls"]')!;
    // Rendered once — nothing here is stateful, and rebuilding it on every
    // slider drag would be pure churn.
    if (pane.childElementCount) return;
    pane.innerHTML = `
      <div class="keys">
        ${CONTROLS.map(([group, rows]) => `
          <section>
            <h3>${group}</h3>
            ${(rows as string[][]).map(([k, v]) => `<div><kbd>${k}</kbd><span>${v}</span></div>`).join('')}
          </section>`).join('')}
      </div>
      <p style="font-size:11px;line-height:1.9;color:#55677a;max-width:64ch;margin-top:26px">
        Escape opens this menu and gives the cursor back. Browsers only grant
        true cursor lock in some embeddings — if you are playing in a frame and
        the cursor stays visible, the game falls back to capturing mouse motion
        directly, which works the same but runs out of room at the window edge.
        Full screen gets you the real thing.
      </p>`;
  }

  private renderSettings(): void {
    const pane = this.root.querySelector<HTMLElement>('[data-pane="settings"]')!;
    const s = this.hooks?.settings;
    if (!s) { pane.innerHTML = ''; return; }
    pane.innerHTML = `
      <div class="row">
        <label>MOUSE SENSITIVITY</label>
        <input type="range" min="4" max="60" step="1" value="${Math.round(s.sensitivity * 1000)}"
               data-setting="sensitivity">
        <span class="val">${(s.sensitivity * 1000).toFixed(0)}</span>
      </div>
      <div class="row">
        <label>FIELD OF VIEW</label>
        <input type="range" min="52" max="96" step="1" value="${Math.round(s.fov)}" data-setting="fov">
        <span class="val">${Math.round(s.fov)}&deg;</span>
      </div>
      <div class="row">
        <label>INVERT VERTICAL</label>
        <input type="checkbox" ${s.invertY ? 'checked' : ''} data-setting="invert">
      </div>
      <p style="font-size:11px;line-height:1.9;color:#55677a;max-width:56ch;margin-top:26px">
        Field of view is the horizontal angle. Higher gives you more peripheral
        awareness and makes everything smaller; the default is the value the
        weapon models and the aim-down-sights transition were tuned against.
      </p>`;
  }
}
