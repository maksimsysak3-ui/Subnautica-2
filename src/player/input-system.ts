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
  { action: 'forward',   keys: ['KeyW'],               label: 'Move forward' },
  { action: 'back',      keys: ['KeyS'],               label: 'Move back' },
  { action: 'left',      keys: ['KeyA'],               label: 'Move left' },
  { action: 'right',     keys: ['KeyD'],               label: 'Move right' },
  { action: 'sprint',    keys: ['ShiftLeft'],          label: 'Sprint' },
  { action: 'walk',      keys: ['AltLeft'],            label: 'Walk (quiet)' },
  { action: 'crouch',    keys: ['KeyC', 'ControlLeft'], label: 'Crouch / stand up' },
  { action: 'prone',     keys: ['KeyZ'],               label: 'Prone' },
  { action: 'jump',      keys: ['Space'],              label: 'Jump' },
  { action: 'leanLeft',  keys: ['KeyQ'],               label: 'Lean left' },
  { action: 'leanRight', keys: ['KeyX'],               label: 'Lean right' },
  // Aim is on E as well as the right mouse button. A held right-click is
  // awkward in an embedded view, and it is the one control the player uses
  // constantly.
  { action: 'aim',       keys: ['KeyE'],               label: 'Aim down sights' },
  { action: 'reload',    keys: ['KeyR'],               label: 'Reload' },
  { action: 'use',       keys: ['KeyF'],               label: 'Interact' },
  { action: 'fireMode',  keys: ['KeyB'],               label: 'Cycle fire mode' },
  { action: 'drone',     keys: ['KeyG'],               label: 'Deploy drone' },
  { action: 'nvg',       keys: ['KeyN'],               label: 'Night vision' },
  { action: 'map',       keys: ['KeyM', 'Tab'],        label: 'Tactical map' },
  { action: 'pause',     keys: ['Escape'],             label: 'Pause' },
  // Keyboard look — works even where pointer lock is unavailable.
  { action: 'turnLeft',  keys: ['ArrowLeft'],          label: 'Turn left' },
  { action: 'turnRight', keys: ['ArrowRight'],         label: 'Turn right' },
  { action: 'lookUp',    keys: ['ArrowUp'],            label: 'Look up' },
  { action: 'lookDown',  keys: ['ArrowDown'],          label: 'Look down' },
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
  /** Pointer-lock failures so far. Informational only — never latched. */
  private lockFailures = 0;
  /** When the lock was last exited, for the browser's re-request cooldown. */
  private lastExit = -1e9;
  private lockWatchdog = 0;
  private dragging = false;
  private lastDragX = 0;
  private lastDragY = 0;
  /** Fires when control mode changes, so the UI can update its hint. */
  onControlModeChange: ((mode: 'locked' | 'drag') => void) | null = null;
  /** Set once the player has dismissed the click-to-play overlay. */
  engaged = false;
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
    document.addEventListener('pointerlockerror', this.onLockError);
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
    if (this.locked) return;

    // Arm drag-look AND request the lock, in that order, every time.
    //
    // This used to request the lock and `return`, so dragging was never armed
    // on the click that triggered the request. In an embedding that refuses
    // pointer lock silently — no error, no rejection, the request simply never
    // takes effect — that meant the first click did nothing, and dragging did
    // nothing either, because the drag state was never set. The player was
    // left with a view they could not turn.
    //
    // Arming both is free: `onMouseMove` checks `this.locked` first, so if the
    // lock is granted the drag path is never reached.
    this.dragging = true;
    this.lastDragX = e.clientX;
    this.lastDragY = e.clientY;
    this.requestLock();
    e.preventDefault();
  };

  private onMouseUp = (e: MouseEvent): void => {
    this.mouseButtons.delete(e.button);
    this.dragging = false;
  };

  private onMouseMove = (e: MouseEvent): void => {
    // Accumulate raw deltas; the controller consumes them on the fixed step so
    // look speed doesn't vary with frame rate.
    const scale = this.player.aiming ? this.adsSensitivityScale : 1;

    let dx = 0;
    let dy = 0;
    if (this.locked) {
      dx = e.movementX;
      dy = e.movementY;
    } else if (this.dragging) {
      // movementX is unreliable outside pointer lock across browsers, so
      // track the delta ourselves.
      dx = e.clientX - this.lastDragX;
      dy = e.clientY - this.lastDragY;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
    } else {
      return;
    }

    this.pendingLookX += dx * this.sensitivity * scale;
    this.pendingLookY += dy * this.sensitivity * scale * (this.invertY ? -1 : 1);
  };

  private onLockChange = (): void => {
    const wasLocked = this.locked;
    this.locked = document.pointerLockElement === this.canvas;
    if (this.locked) {
      window.clearTimeout(this.lockWatchdog);
      this.lockFailures = 0;
      this.onControlModeChange?.('locked');
    } else if (wasLocked) {
      this.down.clear();
      this.mouseButtons.clear();
      bus.emit('ui:screenChanged', { screen: 'paused' });
    }
  };

  private onLockError = (): void => {
    this.noteLockFailure();
  };

  /**
   * Note a failure — but never latch it.
   *
   * The old behaviour set `lockSupported = false` on the *first* failure and
   * never tried again, so one spurious watchdog trip (a slow frame during
   * boot is enough) permanently downgraded the session to drag-look. Every
   * subsequent click then returned early without even attempting a lock,
   * which is a click that visibly does nothing.
   *
   * Failures are now only a hint for which hint text to show. The next click
   * tries pointer lock again regardless.
   */
  private noteLockFailure(): void {
    this.lockFailures++;
    this.onControlModeChange?.('drag');
  }

  /**
   * Ask for pointer lock. Safe to call on every click.
   *
   * Must run inside the user-gesture task, so there is no async work before
   * the request. Drag-look stays live the whole time — if the lock is granted
   * the drag path simply never sees a mousemove without lock, and if it is
   * refused the player can still look around. That combination is why this
   * cannot fail closed any more.
   */
  requestLock(): void {
    this.engaged = true;
    if (this.locked) return;

    const now = performance.now();
    // Chrome throws if a lock is re-requested within ~1s of a user-initiated
    // exit. Guard only that window, and only after an actual exit — a plain
    // rate limit swallowed legitimate clicks.
    if (now - this.lastExit < 1100) {
      this.onControlModeChange?.('drag');
      return;
    }
    if (now - this.lastLockRequest < 250) return;
    this.lastLockRequest = now;

    // Some embeddings refuse pointer lock silently: no error event, no promise
    // rejection, the request simply never takes effect. A sandboxed iframe
    // without allow="pointer-lock" behaves exactly this way. Fall back on a
    // timer rather than waiting for a signal that never comes.
    window.clearTimeout(this.lockWatchdog);
    this.lockWatchdog = window.setTimeout(() => {
      if (!this.locked) this.noteLockFailure();
    }, 600);

    try {
      const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === 'function') p.catch(() => this.noteLockFailure());
    } catch {
      this.noteLockFailure();
    }
  }

  /** True when the player is steering by dragging rather than by pointer lock. */
  get usingDragLook(): boolean {
    return !this.locked;
  }

  get isLocked(): boolean {
    return this.locked;
  }

  /**
   * Scripted input, for captures and tests.
   *
   * Anything set here wins over the keyboard and mouse for as long as it is
   * set. Without it a harness that writes to `player.input` directly is
   * overwritten on the very next frame by the block below, which is why every
   * aimed capture came back showing a hip carry: the director set `aim = true`
   * and this method cleared it 16 ms later.
   */
  readonly override: Partial<Record<'moveX' | 'moveZ' | 'sprint' | 'walk' | 'lean'
    | 'fire' | 'aim' | 'use' | 'reload', number | boolean>> = {};

  update(_dt: number, _ctx: EngineContext): void {
    const inp = this.player.input;

    inp.moveZ = (this.isDown('forward') ? 1 : 0) - (this.isDown('back') ? 1 : 0);
    inp.moveX = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    inp.sprint = this.isDown('sprint');
    inp.walk = this.isDown('walk');
    inp.lean = clamp((this.isDown('leanRight') ? 1 : 0) - (this.isDown('leanLeft') ? 1 : 0), -1, 1);
    inp.reload = this.consumePress('reload');
    // Latch the press: the controller consumes it on the next fixed step,
    // which may not happen on this frame.
    if (this.consumePress('use')) inp.use = true;

    // Mouse: left fires, right aims. E aims too — a held right-click is
    // awkward in an embedded view and aiming is the control used most.
    inp.fire = this.mouseButtons.has(0);
    inp.aim = this.mouseButtons.has(2) || this.isDown('aim');
    if (this.consumePress('jump')) inp.jump = true;

    // Scripted input last, so it wins.
    for (const [k, v] of Object.entries(this.override)) {
      (inp as unknown as Record<string, unknown>)[k] = v;
    }

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

    // Mouse look is the primary control. Keyboard turning stays only as a
    // fallback for embeddings that refuse pointer lock, and is suppressed
    // entirely while the pointer is locked so the two can never fight.
    if (!this.locked) {
      const turn = (this.isDown('turnRight') ? 1 : 0) - (this.isDown('turnLeft') ? 1 : 0);
      const pitch = (this.isDown('lookDown') ? 1 : 0) - (this.isDown('lookUp') ? 1 : 0);
      if (turn !== 0) this.pendingLookX += turn * 1.6 * _dt;
      if (pitch !== 0) this.pendingLookY += pitch * 1.1 * _dt;
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
    document.removeEventListener('pointerlockerror', this.onLockError);
  }
}
