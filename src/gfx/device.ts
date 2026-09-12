/**
 * WebGPU device ownership: acquisition, canvas configuration, resize, and
 * recovery from device loss.
 *
 * Device loss is not an edge case. Drivers time out, laptops sleep, browsers
 * reset the GPU process under memory pressure. A city builder is a program
 * people leave open for hours, so losing the device *will* happen, and the
 * only acceptable response is to rebuild and carry on -- not a black canvas.
 */

import { log } from '../util/log';
import { requestedFeatures, requestedLimits, reportCaps } from './caps';

export type InitFailure = 'no-webgpu' | 'no-adapter' | 'no-device';

export class GpuInitError extends Error {
  constructor(readonly kind: InitFailure, message: string) {
    super(message);
    this.name = 'GpuInitError';
  }
}

/**
 * What the frame loop draws into.
 *
 * A canvas context is one; an offscreen texture is another. The renderer only
 * ever asks for this frame's texture, so nothing above this line has to know
 * whether there is a window involved -- which is what lets the shot and
 * benchmark tools drive the real renderer instead of a copy of it.
 */
export interface Surface {
  getCurrentTexture(): GPUTexture;
}

export interface Viewport {
  /** Framebuffer size in physical device pixels. */
  width: number;
  height: number;
  dpr: number;
}

/** Hard ceiling on DPR. Retina at 3x is 9x the pixels for no visible gain. */
const MAX_DPR = 2;

/**
 * Most pixels the renderer will draw in one frame, before the browser scales
 * the result up to the window.
 *
 * A ceiling on the device pixel ratio is not a ceiling on anything. Two things
 * defeat it: `devicePixelContentBoxSize`, which reports the browser's real
 * backing-store size and skips the multiply entirely -- so on a retina display
 * the ratio was capped at two and then ignored -- and the size of the window
 * itself, because two hundred per cent of a small laptop screen and two
 * hundred per cent of a 4K monitor are not remotely the same amount of work.
 * A full-screen 4K window at that ratio is fifteen million pixels a frame, and
 * this scene shades every one of them: sky, then ground over the whole of it,
 * then a two-thousand-square shadow map besides.
 *
 * A budget on the product is the thing that actually holds. Two and a half
 * million is a little over 1920x1200 -- the resolution the game was tuned at,
 * where nothing changes -- and a bigger or denser display renders at that and
 * is scaled up, which costs some crispness at the edges of buildings and buys
 * back the frame rate it was spending on them.
 */
const PIXEL_BUDGET = 2_500_000;

/**
 * Resolution steps the frame-rate governor may choose between.
 *
 * Coarse and few, because changing one means rebuilding the swapchain and the
 * depth buffer, which costs a frame. Five steps span a four-to-one range in
 * pixels, which is more than the difference between the machines this has to
 * run on.
 */
export const RENDER_SCALES = [1, 0.86, 0.72, 0.6, 0.5] as const;

export class Gpu {
  readonly viewport: Viewport = { width: 1, height: 1, dpr: 1 };

  /**
   * A further multiplier on the framebuffer, set by the frame-rate governor.
   *
   * Separate from the budget above: the budget is a fixed ceiling that stops
   * a big display asking for absurd amounts of work, and this is what actually
   * responds to the machine in front of it.
   */
  private renderScale = 1;

  private resizeHandlers = new Set<(v: Viewport) => void>();
  private lostHandlers = new Set<(info: GPUDeviceLostInfo) => void>();
  private observer: ResizeObserver | null = null;
  /** The offscreen render target, on the headless path only. */
  private target: GPUTexture | null = null;
  private destroyed = false;

  private constructor(
    readonly canvas: HTMLCanvasElement | null,
    public adapter: GPUAdapter,
    public device: GPUDevice,
    readonly context: Surface,
    readonly format: GPUTextureFormat,
  ) {}

  /** The adapter and device request, shared by the canvas and headless paths. */
  private static async acquire(): Promise<{ adapter: GPUAdapter; device: GPUDevice }> {
    if (!('gpu' in navigator) || !navigator.gpu) {
      throw new GpuInitError('no-webgpu', 'navigator.gpu is undefined');
    }
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new GpuInitError('no-adapter', 'requestAdapter() returned null');
    try {
      const device = await adapter.requestDevice({
        label: 'citysim-device',
        requiredFeatures: requestedFeatures(adapter),
        requiredLimits: requestedLimits(adapter),
      });
      return { adapter, device };
    } catch (err) {
      throw new GpuInitError('no-device', String(err));
    }
  }

  /**
   * A device drawing into an offscreen texture, with no canvas and no window.
   *
   * The software rasteriser this repository's tools run under takes the
   * canvas presentation path down within a second, which for a long time meant
   * every headless picture of the game came from a hand-written copy of the
   * frame loop -- a copy that could, and did, drift from what the game draws.
   * Rendering to a texture avoids presentation entirely and lets the tools
   * construct the real Renderer.
   */
  static async headless(width: number, height: number,
    format: GPUTextureFormat = 'rgba8unorm'): Promise<Gpu> {
    const { adapter, device } = await Gpu.acquire();
    const target = device.createTexture({
      label: 'headless-target',
      size: { width, height },
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });
    const gpu = new Gpu(null, adapter, device, { getCurrentTexture: () => target }, format);
    gpu.target = target;
    gpu.viewport.width = width;
    gpu.viewport.height = height;
    gpu.viewport.dpr = 1;
    gpu.watchLoss();
    gpu.watchErrors();
    return gpu;
  }

  /**
   * The rendered frame, as tightly packed RGBA rows.
   *
   * Headless only -- there is no target texture to read on the canvas path.
   */
  async readPixels(): Promise<Uint8Array> {
    const target = this.target;
    if (!target) throw new Error('readPixels() needs a headless device');
    const { width, height } = this.viewport;
    // Buffer-to-texture copies want 256-byte row alignment, so the readback is
    // padded and unpicked here rather than by every caller.
    const stride = Math.ceil(width * 4 / 256) * 256;
    const buffer = this.device.createBuffer({
      size: stride * height,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const encoder = this.device.createCommandEncoder({ label: 'readback' });
    encoder.copyTextureToBuffer({ texture: target }, { buffer, bytesPerRow: stride },
      { width, height });
    this.device.queue.submit([encoder.finish()]);
    await buffer.mapAsync(GPUMapMode.READ);
    const padded = new Uint8Array(buffer.getMappedRange());
    const out = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      out.set(padded.subarray(y * stride, y * stride + width * 4), y * width * 4);
    }
    buffer.unmap();
    buffer.destroy();
    return out;
  }

  static async create(canvas: HTMLCanvasElement): Promise<Gpu> {
    const { adapter, device } = await Gpu.acquire();
    const context = canvas.getContext('webgpu');
    if (!context) {
      throw new GpuInitError('no-device', 'canvas.getContext("webgpu") returned null');
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    const gpu = new Gpu(canvas, adapter, device, context, format);
    reportCaps(adapter, device);
    log.info('gpu', `canvas format: ${format}`);

    gpu.configure();
    gpu.watchResize();
    gpu.watchLoss();
    gpu.watchErrors();
    return gpu;
  }

  private configure(): void {
    (this.context as GPUCanvasContext).configure({
      device: this.device,
      format: this.format,
      alphaMode: 'opaque',
      // RENDER_ATTACHMENT is implicit; COPY_SRC lets us grab screenshots later.
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });
  }

  // ---- resize ---------------------------------------------------------

  private watchResize(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    this.observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) this.applySize(entry);
    });
    // 'device-pixel-content-box' gives exact physical pixels, which is the
    // difference between a crisp canvas and a subtly blurry one on fractional
    // display scaling. Not every browser supports it; fall back to maths.
    try {
      this.observer.observe(canvas, { box: 'device-pixel-content-box' });
    } catch {
      this.observer.observe(canvas);
    }
    this.resizeNow();
  }

  private applySize(entry: ResizeObserverEntry): void {
    const dpr = Math.min(devicePixelRatio || 1, MAX_DPR);
    const exact = entry.devicePixelContentBoxSize?.[0];
    let w: number;
    let h: number;
    if (exact) {
      w = exact.inlineSize;
      h = exact.blockSize;
    } else {
      w = Math.round(entry.contentRect.width * dpr);
      h = Math.round(entry.contentRect.height * dpr);
    }
    this.setSize(w, h, dpr);
  }

  /**
   * Sets the governor's multiplier, and resizes if it changed.
   *
   * Returns whether anything moved, so the caller can tell a step that did
   * something from one that was already at the end of the range.
   */
  setRenderScale(scale: number): boolean {
    const next = Math.max(0.25, Math.min(1, scale));
    if (Math.abs(next - this.renderScale) < 1e-4) return false;
    this.renderScale = next;
    const before = this.viewport.width * this.viewport.height;
    this.resizeNow();
    return this.viewport.width * this.viewport.height !== before;
  }

  /** The governor's current multiplier. */
  get scale(): number { return this.renderScale; }

  /** Recomputes size from the element's current layout box. */
  resizeNow(): void {
    if (!this.canvas) return;
    const dpr = Math.min(devicePixelRatio || 1, MAX_DPR);
    const rect = this.canvas.getBoundingClientRect();
    this.setSize(Math.round(rect.width * dpr), Math.round(rect.height * dpr), dpr);
  }

  private setSize(w: number, h: number, dpr: number): void {
    const max = this.device.limits.maxTextureDimension2D;
    // The budget, applied here because this is the one place every path to a
    // framebuffer size passes through -- the resize observer's exact device
    // box, the fallback that multiplies by the ratio, and the initial measure.
    // Scaled on both axes together so the aspect ratio, and therefore the
    // projection, is untouched.
    const shrink = Math.min(1, Math.sqrt(PIXEL_BUDGET / Math.max(w * h, 1)))
      * this.renderScale;
    const width = Math.max(1, Math.min(Math.round(w * shrink), max));
    const height = Math.max(1, Math.min(Math.round(h * shrink), max));
    if (width === this.viewport.width && height === this.viewport.height) return;

    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.viewport.width = width;
    this.viewport.height = height;
    this.viewport.dpr = dpr;
    log.debug('gpu', `viewport ${width}x${height} @${dpr}x`
      + (shrink < 1 ? ` (scaled ${(shrink * 100).toFixed(0)}% from ${w}x${h})` : ''));
    for (const cb of this.resizeHandlers) cb(this.viewport);
  }

  onResize(cb: (v: Viewport) => void): () => void {
    this.resizeHandlers.add(cb);
    return () => this.resizeHandlers.delete(cb);
  }

  // ---- loss & errors --------------------------------------------------

  private watchLoss(): void {
    void this.device.lost.then((info) => {
      if (this.destroyed || info.reason === 'destroyed') return;
      log.error('gpu', `device lost: ${info.reason} -- ${info.message}`);
      for (const cb of this.lostHandlers) cb(info);
    });
  }

  private watchErrors(): void {
    this.device.addEventListener('uncapturederror', (e) => {
      const err = (e as GPUUncapturedErrorEvent).error;
      log.error('gpu', `uncaptured ${err.constructor.name}: ${err.message}`);
    });
  }

  onLost(cb: (info: GPUDeviceLostInfo) => void): void {
    this.lostHandlers.add(cb);
  }

  /**
   * Reacquires adapter and device after a loss and reconfigures the canvas.
   * Every GPU resource created from the old device is dead; callers must
   * rebuild theirs.
   */
  async recover(): Promise<void> {
    log.warn('gpu', 'attempting device recovery');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new GpuInitError('no-adapter', 'no adapter on recovery');

    this.adapter = adapter;
    this.device = await adapter.requestDevice({
      label: 'citysim-device (recovered)',
      requiredFeatures: requestedFeatures(adapter),
      requiredLimits: requestedLimits(adapter),
    });
    this.configure();
    this.watchLoss();
    this.watchErrors();
    log.info('gpu', 'device recovered');
  }

  destroy(): void {
    this.destroyed = true;
    this.observer?.disconnect();
    this.observer = null;
    this.resizeHandlers.clear();
    this.lostHandlers.clear();
    this.device.destroy();
  }
}
