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

export interface Viewport {
  /** Framebuffer size in physical device pixels. */
  width: number;
  height: number;
  dpr: number;
}

/** Hard ceiling on DPR. Retina at 3x is 9x the pixels for no visible gain. */
const MAX_DPR = 2;

export class Gpu {
  readonly viewport: Viewport = { width: 1, height: 1, dpr: 1 };

  private resizeHandlers = new Set<(v: Viewport) => void>();
  private lostHandlers = new Set<(info: GPUDeviceLostInfo) => void>();
  private observer: ResizeObserver | null = null;
  private destroyed = false;

  private constructor(
    readonly canvas: HTMLCanvasElement,
    public adapter: GPUAdapter,
    public device: GPUDevice,
    readonly context: GPUCanvasContext,
    readonly format: GPUTextureFormat,
  ) {}

  static async create(canvas: HTMLCanvasElement): Promise<Gpu> {
    if (!('gpu' in navigator) || !navigator.gpu) {
      throw new GpuInitError('no-webgpu', 'navigator.gpu is undefined');
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    });
    if (!adapter) {
      throw new GpuInitError('no-adapter', 'requestAdapter() returned null');
    }

    let device: GPUDevice;
    try {
      device = await adapter.requestDevice({
        label: 'citysim-device',
        requiredFeatures: requestedFeatures(adapter),
        requiredLimits: requestedLimits(adapter),
      });
    } catch (err) {
      throw new GpuInitError('no-device', String(err));
    }

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
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'opaque',
      // RENDER_ATTACHMENT is implicit; COPY_SRC lets us grab screenshots later.
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });
  }

  // ---- resize ---------------------------------------------------------

  private watchResize(): void {
    this.observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) this.applySize(entry);
    });
    // 'device-pixel-content-box' gives exact physical pixels, which is the
    // difference between a crisp canvas and a subtly blurry one on fractional
    // display scaling. Not every browser supports it; fall back to maths.
    try {
      this.observer.observe(this.canvas, { box: 'device-pixel-content-box' });
    } catch {
      this.observer.observe(this.canvas);
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

  /** Recomputes size from the element's current layout box. */
  resizeNow(): void {
    const dpr = Math.min(devicePixelRatio || 1, MAX_DPR);
    const rect = this.canvas.getBoundingClientRect();
    this.setSize(Math.round(rect.width * dpr), Math.round(rect.height * dpr), dpr);
  }

  private setSize(w: number, h: number, dpr: number): void {
    const max = this.device.limits.maxTextureDimension2D;
    const width = Math.max(1, Math.min(w, max));
    const height = Math.max(1, Math.min(h, max));
    if (width === this.viewport.width && height === this.viewport.height) return;

    this.canvas.width = width;
    this.canvas.height = height;
    this.viewport.width = width;
    this.viewport.height = height;
    this.viewport.dpr = dpr;
    log.debug('gpu', `viewport ${width}x${height} @${dpr}x`);
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
