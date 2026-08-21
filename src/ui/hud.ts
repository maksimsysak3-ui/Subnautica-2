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

import * as THREE from 'three';
import type { System, EngineContext } from '../core/engine';
import { bus } from '../core/events';
import { services } from '../core/contracts';

/** Scratch for marker projection — this runs once per objective per frame. */
const _mv = new THREE.Vector3();

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
#hud .ammo .weapon { font-size: 11px; letter-spacing: .16em; color: var(--text-dim, #8ea0ae); margin-bottom: 2px; }
#hud .slots { position: absolute; right: 30px; bottom: 116px; display: flex; gap: 5px; justify-content: flex-end; }
#hud .slots i { display: block; width: 20px; height: 2px; background: rgba(255,255,255,.18); }
#hud .slots i.on { background: var(--brass, #c8a355); }
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

/* Damage vignette. Reads as blood in the periphery rather than a health bar —
   you feel how hurt you are instead of reading a number. */
#hud .hurt { position: absolute; inset: 0; pointer-events: none; opacity: 0;
  transition: opacity .35s ease;
  background: radial-gradient(ellipse at center,
    rgba(0,0,0,0) 42%, rgba(120,14,10,.30) 78%, rgba(90,8,6,.62) 100%); }

/* Directional hit indicator: which way the round came from. */
#hud .damageDir { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
#hud .damageDir i { position: absolute; left: -13px; top: -96px; width: 26px; height: 13px;
  opacity: 0; transform-origin: 13px 96px;
  background: linear-gradient(to bottom, rgba(226,74,58,.92), rgba(226,74,58,0));
  clip-path: polygon(50% 0, 100% 100%, 0 100%); }

#hud .vitals { position: absolute; left: 30px; bottom: 62px; font-size: 11px;
  letter-spacing: .2em; color: var(--text-dim, #8ea0ae); }
#hud .vitals b { color: var(--text, #d8e2ea); }
#hud .vitals.hurt b { color: #d4884e; }
#hud .vitals.critical b { color: #d4574e; }

/* Objectives. Top-left, quiet, always there — a tactical shooter's task list
   is reference material, not a notification. */
#hud .tasks { position: absolute; left: 30px; top: 26px; max-width: 320px;
  font-size: 11px; letter-spacing: .09em; line-height: 1.55; }
#hud .tasks .codename { color: var(--brass, #c8a355); letter-spacing: .26em;
  font-size: 10px; margin-bottom: 8px; }
#hud .tasks .task { display: flex; gap: 8px; color: var(--text-dim, #8ea0ae);
  margin-bottom: 4px; transition: color .3s ease, opacity .3s ease; }
#hud .tasks .task i { font-style: normal; width: 10px; flex: 0 0 10px; opacity: .8; }
#hud .tasks .task.done { color: #6f8a6a; opacity: .55; }
#hud .tasks .task.done span { text-decoration: line-through; }
#hud .tasks .task.opt { opacity: .68; font-style: italic; }
#hud .tasks .task.failed { color: #d4574e; }

/* Objective markers, clamped to the screen edge when off-view. A compass you
   have to interpret is worse than an arrow you do not. */
#hud .markers { position: absolute; inset: 0; }
#hud .markers b { position: absolute; transform: translate(-50%, -50%);
  font-size: 9px; letter-spacing: .16em; font-weight: 400; white-space: nowrap;
  color: var(--brass, #c8a355); padding: 2px 5px;
  border: 1px solid rgba(200,163,85,.45); background: rgba(5,7,10,.5); }
#hud .markers b.edge { opacity: .55; }
#hud .markers b em { font-style: normal; color: var(--text-dim, #8ea0ae);
  margin-left: 5px; }

/* Debrief. */
#hud .debrief { position: absolute; inset: 0; display: none; place-items: center;
  background: rgba(4,6,9,.86); backdrop-filter: blur(3px); }
#hud .debrief.on { display: grid; }
#hud .debrief .card { width: min(560px, 84vw); border: 1px solid rgba(255,255,255,.12);
  padding: 34px 38px; background: rgba(10,13,17,.9); }
#hud .debrief h2 { margin: 0 0 4px; font-size: 22px; letter-spacing: .3em; font-weight: 500; }
#hud .debrief .why { color: var(--text-dim, #8ea0ae); font-size: 12px;
  letter-spacing: .06em; line-height: 1.7; margin-bottom: 22px; }
#hud .debrief.success h2 { color: #8fbf7a; }
#hud .debrief.partial h2 { color: #d4a84e; }
#hud .debrief.failure h2, #hud .debrief.aborted h2 { color: #d4574e; }
#hud .debrief dl { display: grid; grid-template-columns: 1fr auto; gap: 7px 20px;
  margin: 0; font-size: 11px; letter-spacing: .12em; }
#hud .debrief dt { color: var(--text-faint, #55677a); }
#hud .debrief dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
#hud .debrief .again { margin-top: 26px; font-size: 10px; letter-spacing: .22em;
  color: var(--text-faint, #55677a); }
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
  private weaponEl!: HTMLElement;
  private slotsEl!: HTMLElement;
  private lastSlotKey = '';
  private hurtEl!: HTMLElement;
  private dirEl!: HTMLElement;
  private vitalsEl!: HTMLElement;
  private hitMarks: Array<{ el: HTMLElement; life: number }> = [];
  private tasksEl!: HTMLElement;
  private codenameEl!: HTMLElement;
  private markersEl!: HTMLElement;
  private debriefEl!: HTMLElement;
  private taskKey = '';
  private markerEls: HTMLElement[] = [];

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
    equipped: { malfunction: string | null; specId: string } | null;
    loadout?: Array<{ specId: string }>;
    slot?: number;
    swapTimer?: number;
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
        <div class="weapon">—</div>
        <div class="mag">30<span class="chamber">+1</span></div>
        <div class="reserve">210</div>
        <div class="mode">SEMI</div>
      </div>
      <div class="slots"></div>
      <div class="state">
        <div class="stance">STANCE <b>STANDING</b></div>
        <div class="stamina"><i style="width:100%"></i></div>
      </div>
      <div class="markers"></div>
      <div class="tasks"><div class="codename"></div><div class="list"></div></div>
      <div class="debrief"><div class="card">
        <h2></h2><div class="why"></div><dl></dl>
        <div class="again">PRESS <b>ESC</b> AND PICK A MAP TO RUN IT AGAIN</div>
      </div></div>
      <div class="hurt"></div>
      <div class="damageDir"></div>
      <div class="vitals">CONDITION <b>NOMINAL</b></div>
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
    this.weaponEl = root.querySelector('.weapon')!;
    this.slotsEl = root.querySelector('.slots')!;
    this.hurtEl = root.querySelector('.hurt')!;
    this.dirEl = root.querySelector('.damageDir')!;
    this.vitalsEl = root.querySelector('.vitals')!;
    this.tasksEl = root.querySelector('.tasks .list')!;
    this.codenameEl = root.querySelector('.tasks .codename')!;
    this.markersEl = root.querySelector('.markers')!;
    this.debriefEl = root.querySelector('.debrief')!;

    bus.on('mission:started', () => { this.taskKey = ''; this.debriefEl.className = 'debrief'; });
    bus.on('mission:objectiveCompleted', () => { this.taskKey = ''; });
    bus.on('mission:ended', () => this.showDebrief());

    bus.on('actor:damaged', (e) => { if (e.actorId === 0) this.onHurt(e.sourceId); });

    bus.on('ui:notify', ({ text }) => this.toast(text));
    bus.on('weapon:jammed', () => this.toast('WEAPON JAMMED — PULL TRIGGER TO CLEAR'));
    bus.on('door:locked', () => this.toast('LOCKED'));
    bus.on('weapon:reloadStart', ({ tactical }) =>
      this.toast(tactical ? 'RELOADING' : 'RELOADING — EMPTY'));
  }

  /**
   * Register a hit and point at whoever caused it.
   *
   * A directional indicator, not a number. Being shot from an angle you cannot
   * see is the situation that most needs information, and "12 damage" tells
   * you nothing useful about it while "from your left" tells you everything.
   */
  private onHurt(sourceId: number): void {
    const actors = services.tryGet('actors');
    const src = actors?.get(sourceId);
    const p = this.player;
    if (!src || !p) return;

    const dx = src.position.x - p.position.x;
    const dz = src.position.z - p.position.z;
    // Angle of the shooter relative to where the player is looking.
    const facing = Math.atan2(p.forward.x, p.forward.z);
    let rel = Math.atan2(dx, dz) - facing;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;

    const el = document.createElement('i');
    el.style.transform = `rotate(${rel}rad)`;
    el.style.opacity = '1';
    this.dirEl.appendChild(el);
    this.hitMarks.push({ el, life: 1.5 });
  }

  /**
   * The task list.
   *
   * Rebuilt only when it actually changes — this runs every frame, and the
   * objective list is the sort of thing that quietly costs a millisecond of
   * DOM churn per frame if you let it.
   */
  private renderTasks(): void {
    const m = services.tryGet('missions') as unknown as {
      current: { codename: string } | null;
      objectives: ReadonlyArray<{
        id: string; label: string; state: string; optional: boolean;
        hidden: boolean; progress: number; required: number;
      }>;
    } | undefined;
    if (!m?.current) {
      if (this.taskKey !== 'none') { this.taskKey = 'none'; this.tasksEl.innerHTML = ''; this.codenameEl.textContent = ''; }
      return;
    }
    const visible = m.objectives.filter((o) => !o.hidden && o.state !== 'pending');
    const key = m.current.codename + '|' + visible
      .map((o) => `${o.id}:${o.state}:${o.progress}`).join(',');
    if (key === this.taskKey) return;
    this.taskKey = key;

    this.codenameEl.textContent = m.current.codename;
    this.tasksEl.innerHTML = visible.map((o) => {
      const done = o.state === 'complete';
      const cls = `task${done ? ' done' : ''}${o.optional ? ' opt' : ''}` +
        (o.state === 'failed' ? ' failed' : '');
      const count = o.required > 1 && !done ? ` <em>${o.progress}/${o.required}</em>` : '';
      return `<div class="${cls}"><i>${done ? '✓' : o.state === 'failed' ? '✕' : '▸'}</i>` +
        `<span>${o.label}${count}</span></div>`;
    }).join('');
  }

  /**
   * Objective markers.
   *
   * Projected to screen, and clamped to the frame edge when the objective is
   * behind you or off to one side. An off-screen objective with no indicator
   * is the single most common way a player gets lost in a level they have
   * never seen, and a compass rose asks them to do the geometry themselves.
   */
  private renderMarkers(): void {
    const m = services.tryGet('missions') as unknown as {
      current: unknown;
      objectives: ReadonlyArray<{
        label: string; state: string; hidden: boolean;
        position?: { x: number; y: number; z: number };
      }>;
    } | undefined;
    const render = services.tryGet('render') as unknown as
      { camera: THREE.PerspectiveCamera } | undefined;
    if (!m?.current || !render || !this.player) {
      for (const el of this.markerEls) el.style.display = 'none';
      return;
    }

    const cam = render.camera;
    const live = m.objectives.filter(
      (o) => o.state === 'active' && !o.hidden && o.position);
    const w = window.innerWidth, h = window.innerHeight;
    const pad = 44;

    for (let i = 0; i < Math.max(live.length, this.markerEls.length); i++) {
      let el = this.markerEls[i];
      if (!el) {
        el = document.createElement('b');
        this.markersEl.appendChild(el);
        this.markerEls.push(el);
      }
      const o = live[i];
      if (!o?.position) { el.style.display = 'none'; continue; }

      const v = _mv.set(o.position.x, o.position.y + 1.2, o.position.z).project(cam);
      const behind = v.z > 1;
      let sx = (v.x * 0.5 + 0.5) * w;
      let sy = (-v.y * 0.5 + 0.5) * h;
      if (behind) { sx = w - sx; sy = h - sy; }

      const off = behind || sx < pad || sx > w - pad || sy < pad || sy > h - pad;
      if (off) {
        // Push it out along its own direction from centre, then clamp — so an
        // edge marker still points at where the thing actually is.
        const dx = sx - w / 2, dy = sy - h / 2;
        const len = Math.hypot(dx, dy) || 1;
        const scale = Math.min((w / 2 - pad) / Math.abs(dx || 1e-3),
                               (h / 2 - pad) / Math.abs(dy || 1e-3));
        sx = w / 2 + (dx / len) * len * scale;
        sy = h / 2 + (dy / len) * len * scale;
      }
      const dist = Math.hypot(
        o.position.x - this.player.position.x, o.position.z - this.player.position.z);
      el.style.display = '';
      el.className = off ? 'edge' : '';
      el.style.left = `${Math.round(Math.max(pad, Math.min(w - pad, sx)))}px`;
      el.style.top = `${Math.round(Math.max(pad, Math.min(h - pad, sy)))}px`;
      el.innerHTML = `${o.label.toUpperCase()}<em>${Math.round(dist)}m</em>`;
    }
  }

  private showDebrief(): void {
    const m = services.tryGet('missions') as unknown as {
      result: {
        outcome: string; reason: string; elapsed: number;
        objectivesComplete: number; objectivesTotal: number;
        stats: Record<string, number>;
      } | null;
    } | undefined;
    const r = m?.result;
    if (!r) return;

    const mins = Math.floor(r.elapsed / 60);
    const secs = Math.floor(r.elapsed % 60);
    const acc = r.stats.shotsFired > 0
      ? `${Math.round((r.stats.shotsHit / r.stats.shotsFired) * 100)}%` : '—';
    const title = { success: 'MISSION COMPLETE', partial: 'OBJECTIVES MET',
                    failure: 'MISSION FAILED', aborted: 'MISSION ABORTED' }[r.outcome]
                  ?? 'DEBRIEF';

    this.debriefEl.className = `debrief on ${r.outcome}`;
    this.debriefEl.querySelector('h2')!.textContent = title;
    this.debriefEl.querySelector('.why')!.textContent = r.reason;
    this.debriefEl.querySelector('dl')!.innerHTML = [
      ['Objectives', `${r.objectivesComplete} / ${r.objectivesTotal}`],
      ['Time', `${mins}:${String(secs).padStart(2, '0')}`],
      ['Hostiles down', String(r.stats.kills)],
      ['Headshots', String(r.stats.headshots)],
      ['Surrendered', String(r.stats.surrenders)],
      ['Accuracy', acc],
      ['Damage taken', String(Math.round(r.stats.damageTaken))],
      ['Alarm raised', r.stats.alerts > 0 ? 'YES' : 'no'],
      ['Non-combatants', String(r.stats.civiliansKilled)],
    ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
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
        : w.isReloading ? 'RELOADING'
        : (w.swapTimer ?? 0) > 0 ? 'DRAWING'
        : w.fireMode.toUpperCase();

      // Weapon name and slot pips. Rebuilt only when the loadout or the
      // selection actually changes — this runs every frame.
      const key = `${w.slot ?? 0}|${w.loadout?.length ?? 0}|${w.equipped?.specId ?? ''}`;
      if (key !== this.lastSlotKey) {
        this.lastSlotKey = key;
        const spec = w.equipped?.specId
          ? services.tryGet('weapons')?.specs.get(w.equipped.specId)
          : undefined;
        this.weaponEl.textContent = (spec?.name ?? '').toUpperCase();
        const n = w.loadout?.length ?? 0;
        this.slotsEl.innerHTML = Array.from({ length: n },
          (_v, i) => `<i class="${i === (w.slot ?? 0) ? 'on' : ''}"></i>`).join('');
      }
      const total = a.loaded + (a.chambered ? 1 : 0);
      this.ammoEl.classList.toggle('warn', total > 0 && total <= 8);
      this.ammoEl.classList.toggle('empty', total === 0);
    }

    this.renderTasks();
    this.renderMarkers();

    // --- hit indicators ---------------------------------------------------
    for (let i = this.hitMarks.length - 1; i >= 0; i--) {
      const m = this.hitMarks[i];
      m.life -= dt;
      if (m.life <= 0) {
        m.el.remove();
        this.hitMarks.splice(i, 1);
      } else {
        m.el.style.opacity = String(Math.min(1, m.life / 0.6));
      }
    }

    // --- condition --------------------------------------------------------
    const self = services.tryGet('actors')?.get(0);
    if (self) {
      const frac = self.health / Math.max(1, self.maxHealth);
      this.hurtEl.style.opacity = String(Math.min(1, (1 - frac) * 1.5));
      const label = frac > 0.85 ? 'NOMINAL' : frac > 0.6 ? 'WOUNDED'
        : frac > 0.3 ? 'SERIOUS' : 'CRITICAL';
      this.vitalsEl.innerHTML = `CONDITION <b>${label}</b>`;
      this.vitalsEl.classList.toggle('hurt', frac <= 0.85 && frac > 0.3);
      this.vitalsEl.classList.toggle('critical', frac <= 0.3);
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
