/**
 * Input — keyboard/mouse capture feeding `PlayerSystem.input`.
 *
 * OWNED BY: Player team.
 *
 * Deliberately thin: this translates devices into intent and nothing else.
 * No gameplay decisions live here, so rebinding and gamepad support can be
 * added later without touching the controller.
 *
 * Pointer lock is required for mouse look. Browsers only grant it from a user
 * gesture, and re-requesting too quickly after an exit throws, so the request
 * is gated behind a click and rate-limited.
 */

import type { System, EngineContext } from '../core/engine';
import { bus } from '../core/events';
import type { PlayerSystem } from './player-system';
import { clamp } from '../core/math';

export interface Binding {
  action: string;
  keys: string[];
  label: string;
}

/** Default bindings. The options UI edits this list. */
export const DEFAULT_BINDINGS: Binding[] = [
  { action: 'forward',   keys: ['KeyW', 'ArrowUp'],    label: 'Move forward' },
  { action: 'back',      keys: ['KeyS', 'ArrowDown'],  label: 'Move back' },
  { action: 'left',      keys: ['KeyA', 'ArrowLeft'],  label: 'Move left' },
  { action: 'right',     keys: ['KeyD', 'ArrowRight'], label: 'Move right' },
  { action: 'sprint',    keys: ['ShiftLeft'],          label: 'Sprint' },
  { action: 'walk',      keys: ['AltLeft'],            label: 'Walk (quiet)' },
  { action: 'crouch',    keys: ['KeyC', 'ControlLeft'], label: 'Crouch' },
  { action: 'prone',     keys: ['KeyZ'],               label: 'Prone' },
  { action: 'stand',     keys: ['Space'],              label: 'Stand' },
  { action: 'leanLeft',  keys: ['KeyQ'],               label: 'Lean left' },
  { action: 'leanRight', keys: ['KeyE'],               label: 'Lean right' },
  { action: 'reload',    keys: ['KeyR'],               label: 'Reload' },
  { action: 'use',       keys: ['KeyF'],               label: 'Interact' },
  { action: 'fireMode',  keys: ['KeyB'],               label: 'Cycle fire mode' },
  { action: 'drone',     keys: ['KeyG'],               label: 'Deploy drone' },
  { action: 'nvg',       keys: ['KeyN'],               label: 'Night vision' },
  { action: 'map',       keys: ['KeyM', 'Tab'],        label: 'Tactical map' },
  { action: 'pause',     keys: ['Escape'],             label: 'Pause' },
];

export class InputSystem implements System {
  readonly id = 'input';
  readonly order = 0;
  readonly initOrder = 40;
  readonly budgetMs = 0.3;

  /** Mouse sensitivity in radians per pixel. */
  sensitivity = 0.0022;
  /** Multiplier applied while aiming, so magnified optics stay controllable. */
  adsSensitivityScale = 0.65;
  invertY = false;

  private down = new Set<string>();
  private actions = new Map<string, string[]>();
  private mouseButtons = new Set<number>();
  private pendingLookX = 0;
  private pendingLookY = 0;
  private player!: PlayerSystem;
  private canvas!: HTMLCanvasElement;
  private locked = false;
  private lastLockRequest = 0;
  /** Edge-triggered actions consumed once per press. */
  private pressed = new Set<string>();

  constructor(private hostCanvas?: HTMLCanvasElement) {}

  init(ctx: EngineContext): void {
    this.player = ctx.engine.require<PlayerSystem>('player');
    this.canvas =
      this.hostCanvas ?? (document.getElementById('game') as HTMLCanvasElement);
    this.rebind(DEFAULT_BINDINGS);

    // Headless capture has no user to click; guard everything so boot never
    // depends on a device being present.
    if (typeof window === 'undefined' || !this.canvas) return;

    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onLockChange);
    // Right-click is aim-down-sights, not a context menu.
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  rebind(bindings: Binding[]): void {
    this.actions.clear();
    for (const b of bindings) this.actions.set(b.action, b.keys);
  }

  private isDown(action: string): boolean {
    const keys = this.actions.get(action);
    if (!keys) return false;
    for (const k of keys) if (this.down.has(k)) return true;
    return false;
  }

  /** True once per physical press. */
  consumePress(action: string): boolean {
    if (!this.pressed.has(action)) return false;
    this.pressed.delete(action);
    return true;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // Tab and Space scroll or move focus by default; the game owns them.
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.repeat) return;
    this.down.add(e.code);
    for (const [action, keys] of this.actions) {
      if (keys.includes(e.code)) this.pressed.add(action);
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
  };

  /** Dropping focus mid-movement would otherwise leave keys stuck down. */
  private onBlur = (): void => {
    this.down.clear();
    this.mouseButtons.clear();
  };

  private onMouseDown = (e: MouseEvent): void => {
    this.mouseButtons.add(e.button);
    if (!this.locked) this.requestLock();
  };

  private onMouseUp = (e: MouseEvent): void => {
    this.mouseButtons.delete(e.button);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.locked) return;
    // Accumulate raw deltas; the controller consumes them on the fixed step so
    // look speed doesn't vary with frame rate.
    const scale = this.player.aiming ? this.adsSensitivityScale : 1;
    this.pendingLookX += e.movementX * this.sensitivity * scale;
    this.pendingLookY += e.movementY * this.sensitivity * scale * (this.invertY ? -1 : 1);
  };

  private onLockChange = (): void => {
    this.locked = document.pointerLockElement === this.canvas;
    if (!this.locked) {
      this.down.clear();
      this.mouseButtons.clear();
      bus.emit('ui:screenChanged', { screen: 'paused' });
    }
  };

  requestLock(): void {
    const now = performance.now();
    // Browsers throw if pointer lock is re-requested immediately after an exit.
    if (now - this.lastLockRequest < 1200) return;
    this.lastLockRequest = now;
    try {
      const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === 'function') p.catch(() => { /* user dismissed */ });
    } catch {
      /* not supported — the game is still watchable, just not playable */
    }
  }

  get isLocked(): boolean {
    return this.locked;
  }

  update(_dt: number, _ctx: EngineContext): void {
    const inp = this.player.input;

    inp.moveZ = (this.isDown('forward') ? 1 : 0) - (this.isDown('back') ? 1 : 0);
    inp.moveX = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    inp.sprint = this.isDown('sprint');
    inp.walk = this.isDown('walk');
    inp.lean = clamp((this.isDown('leanRight') ? 1 : 0) - (this.isDown('leanLeft') ? 1 : 0), -1, 1);
    inp.reload = this.consumePress('reload');

    // Mouse: left fires, right aims.
    inp.fire = this.mouseButtons.has(0);
    inp.aim = this.mouseButtons.has(2);

    // Stance is a request, not a held state — the controller times transitions.
    if (this.consumePress('crouch')) {
      this.player.requestStance(this.player.stance === 'crouch' ? 'stand' : 'crouch');
    }
    if (this.consumePress('prone')) {
      this.player.requestStance(this.player.stance === 'prone' ? 'crouch' : 'prone');
    }
    if (this.consumePress('stand')) {
      this.player.requestStance('stand');
    }

    // Hand accumulated look deltas to the controller and reset.
    inp.lookX += this.pendingLookX;
    inp.lookY += this.pendingLookY;
    this.pendingLookX = 0;
    this.pendingLookY = 0;

    // Anything not consumed this frame is dropped, so a press can't queue up
    // and fire several frames later.
    this.pressed.clear();
  }

  dispose(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onLockChange);
  }
}
