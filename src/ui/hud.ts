/**
 * Heads-up display.
 *
 * OWNED BY: UI/UX.
 *
 * Deliberately minimal, in the Ground Branch / Ready or Not tradition: no
 * floating waypoints, no damage numbers, no ammo count pulled from thin air.
 * What is shown is what an operator would actually know.
 *
 * The one thing that is *not* optional is the **interaction prompt**. A closed
 * gate with no prompt is indistinguishable from a wall — a player will walk up
 * to it, find it solid, and conclude the level is broken. That is exactly what
 * happened here: the compound gate was openable the whole time and nothing
 * said so.
 *
 * Ammo is deliberately imprecise until you check. The magazine readout shows
 * what you *know* — the last count you loaded minus what you have fired — and
 * the chambered round is shown separately, because "30 in the mag plus one up
 * the spout" is a real distinction that changes how you reload.
 */

import type { System, EngineContext } from '../core/engine';
import { bus } from '../core/events';
import { services } from '../core/contracts';

const CSS = `
#hud { position: fixed; inset: 0; pointer-events: none; z-index: 400;
  font-family: var(--mono, ui-monospace, monospace); color: var(--text, #d8e2ea); }
#hud .crosshair { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
  width: 22px; height: 22px; opacity: .85; }
#hud .crosshair i { position: absolute; background: rgba(230,240,248,.75); display: block; }
#hud .crosshair i.t { left: 50%; top: 0; width: 1px; height: 6px; margin-left: -.5px; }
#hud .crosshair i.b { left: 50%; bottom: 0; width: 1px; height: 6px; margin-left: -.5px; }
#hud .crosshair i.l { top: 50%; left: 0; height: 1px; width: 6px; margin-top: -.5px; }
#hud .crosshair i.r { top: 50%; right: 0; height: 1px; width: 6px; margin-top: -.5px; }
#hud .crosshair.hidden { opacity: 0; }

#hud .prompt { position: absolute; left: 50%; top: 56%; transform: translateX(-50%);
  font-size: 12px; letter-spacing: .18em; padding: 7px 16px;
  background: rgba(5,7,10,.66); border: 1px solid rgba(200,163,85,.5);
  white-space: nowrap; transition: opacity .12s ease; }
#hud .prompt b { color: var(--brass, #c8a355); font-weight: 600; }
#hud .prompt.hidden { opacity: 0; }

#hud .ammo { position: absolute; right: 30px; bottom: 26px; text-align: right; line-height: 1.25; }
#hud .ammo .mag { font-size: 30px; letter-spacing: .04em; font-variant-numeric: tabular-nums; }
#hud .ammo .mag .chamber { font-size: 15px; color: var(--brass, #c8a355); }
#hud .ammo .reserve { font-size: 12px; color: var(--text-dim, #8ea0ae); font-variant-numeric: tabular-nums; }
#hud .ammo .mode { font-size: 11px; letter-spacing: .22em; color: var(--text-faint, #55677a); margin-top: 3px; }
#hud .ammo.warn .mag { color: #d4884e; }
#hud .ammo.empty .mag { color: #d4574e; }

#hud .state { position: absolute; left: 30px; bottom: 26px; font-size: 11px;
  letter-spacing: .2em; color: var(--text-dim, #8ea0ae); line-height: 1.9; }
#hud .state .stance b { color: var(--text, #d8e2ea); }
#hud .stamina { width: 120px; height: 2px; background: rgba(255,255,255,.14); margin-top: 6px; }
#hud .stamina > i { display: block; height: 100%; background: var(--text-dim, #8ea0ae); transition: width .15s linear; }

#hud .alert { position: absolute; left: 50%; top: 16%; transform: translateX(-50%);
  font-size: 12px; letter-spacing: .24em; color: #d4574e; opacity: 0;
  transition: opacity .2s ease; }
#hud .alert.on { opacity: 1; }

#hud .toast { position: absolute; left: 50%; top: 62%; transform: translateX(-50%);
  font-size: 11px; letter-spacing: .16em; padding: 6px 14px;
  background: rgba(5,7,10,.7); border-left: 2px solid var(--brass, #c8a355);
  opacity: 0; transition: opacity .25s ease; white-space: nowrap; }
#hud .toast.on { opacity: 1; }
`;

export class Hud implements System {
  readonly id = 'hud';
  readonly order = 50;
  readonly initOrder = 60;
  readonly budgetMs = 0.4;

  private root!: HTMLElement;
  private promptEl!: HTMLElement;
  private crosshairEl!: HTMLElement;
  private magEl!: HTMLElement;
  private reserveEl!: HTMLElement;
  private modeEl!: HTMLElement;
  private ammoEl!: HTMLElement;
  private stanceEl!: HTMLElement;
  private staminaEl!: HTMLElement;
  private toastEl!: HTMLElement;
  private toastTimer = 0;

  /** Injected — the HUD reads state, it never reaches into other modules. */
  player: {
    position: { x: number; y: number; z: number };
    forward: { x: number; y: number; z: number };
    stance: string;
    stamina: number;
    maxStamina: number;
    adsProgress: number;
  } | null = null;

  weapons: {
    ammoCount: { loaded: number; chambered: boolean; reserve: number };
    fireMode: string;
    isReloading: boolean;
    equipped: { malfunction: string | null } | null;
  } | null = null;

  init(_ctx: EngineContext): void {
    if (typeof document === 'undefined') return;

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'hud';
    root.innerHTML = `
      <div class="crosshair"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i></div>
      <div class="prompt hidden"></div>
      <div class="ammo">
        <div class="mag">30<span class="chamber">+1</span></div>
        <div class="reserve">210</div>
        <div class="mode">SEMI</div>
      </div>
      <div class="state">
        <div class="stance">STANCE <b>STANDING</b></div>
        <div class="stamina"><i style="width:100%"></i></div>
      </div>
      <div class="alert">CONTACT</div>
      <div class="toast"></div>
    `;
    (document.getElementById('ui-root') ?? document.body).appendChild(root);

    this.root = root;
    this.promptEl = root.querySelector('.prompt')!;
    this.crosshairEl = root.querySelector('.crosshair')!;
    this.magEl = root.querySelector('.mag')!;
    this.reserveEl = root.querySelector('.reserve')!;
    this.modeEl = root.querySelector('.mode')!;
    this.ammoEl = root.querySelector('.ammo')!;
    this.stanceEl = root.querySelector('.stance b')!;
    this.staminaEl = root.querySelector('.stamina > i')!;
    this.toastEl = root.querySelector('.toast')!;

    bus.on('ui:notify', ({ text }) => this.toast(text));
    bus.on('weapon:jammed', () => this.toast('WEAPON JAMMED — PULL TRIGGER TO CLEAR'));
    bus.on('door:locked', () => this.toast('LOCKED'));
    bus.on('weapon:reloadStart', ({ tactical }) =>
      this.toast(tactical ? 'RELOADING' : 'RELOADING — EMPTY'));
  }

  toast(text: string): void {
    if (!this.toastEl) return;
    this.toastEl.textContent = text.toUpperCase();
    this.toastEl.classList.add('on');
    this.toastTimer = 2.4;
  }

  update(dt: number, _ctx: EngineContext): void {
    if (!this.root) return;

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.remove('on');
    }

    // --- interaction prompt ----------------------------------------------
    // This is the difference between a door and a wall.
    const world = services.tryGet('world') as unknown as {
      doors?: {
        nearest(p: { x: number; y: number; z: number }, r?: number): { id: number; name: string; state: string; locked: boolean } | null;
      };
    } | undefined;
    const p = this.player;
    let prompt = '';
    if (world?.doors && p) {
      const reach = {
        x: p.position.x + p.forward.x * 0.9,
        y: p.position.y - 0.5,
        z: p.position.z + p.forward.z * 0.9,
      };
      const door = world.doors.nearest(reach, 2.2);
      if (door) {
        prompt = door.locked
          ? `<b>${door.name.toUpperCase()}</b> — LOCKED`
          : `<b>F</b> ${door.state === 'open' ? 'CLOSE' : 'OPEN'} ${door.name.toUpperCase()}`;
      }
    }
    if (prompt) {
      this.promptEl.innerHTML = prompt;
      this.promptEl.classList.remove('hidden');
    } else {
      this.promptEl.classList.add('hidden');
    }

    // --- weapon -----------------------------------------------------------
    const w = this.weapons;
    if (w) {
      const a = w.ammoCount;
      this.magEl.innerHTML = `${a.loaded}${a.chambered ? '<span class="chamber">+1</span>' : ''}`;
      this.reserveEl.textContent = String(a.reserve);
      const jam = w.equipped?.malfunction;
      this.modeEl.textContent = jam
        ? 'MALFUNCTION'
        : w.isReloading ? 'RELOADING' : w.fireMode.toUpperCase();
      const total = a.loaded + (a.chambered ? 1 : 0);
      this.ammoEl.classList.toggle('warn', total > 0 && total <= 8);
      this.ammoEl.classList.toggle('empty', total === 0);
    }

    // --- player state -----------------------------------------------------
    if (p) {
      this.stanceEl.textContent = p.stance.toUpperCase();
      this.staminaEl.style.width = `${Math.round((p.stamina / Math.max(1, p.maxStamina)) * 100)}%`;
      // The crosshair is a hip-fire aid only; aiming uses the weapon's sights.
      this.crosshairEl.classList.toggle('hidden', p.adsProgress > 0.4);
    }
  }

  dispose(): void {
    this.root?.remove();
  }
}
