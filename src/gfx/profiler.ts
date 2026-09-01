/**
 * GPU timing via timestamp queries.
 *
 * CPU frame time -- all the stats overlay measured until now -- says nothing
 * about where the frame actually goes once work is submitted. A frame can look
 * like 0.4 ms of CPU while the GPU spends 20 ms on it, and optimising from
 * that number means optimising the wrong thing.
 *
 * Readback is asynchronous, so the numbers shown are a frame or two behind.
 * That is fine for a budget readout and would not be fine for anything that
 * feeds back into the frame -- which is why nothing does.
 *
 * Degrades to disabled when the adapter has no 'timestamp-query' feature,
 * which is common on Safari and on locked-down drivers.
 */

const NS_TO_MS = 1e-6;

export class GpuProfiler {
  readonly enabled: boolean;
  private querySet: GPUQuerySet | null = null;
  private resolveBuffer: GPUBuffer | null = null;
  private readBuffer: GPUBuffer | null = null;
  private pending = false;
  private results: Float64Array;

  constructor(device: GPUDevice, private scopes: readonly string[]) {
    this.enabled = device.features.has('timestamp-query');
    this.results = new Float64Array(scopes.length);
    if (!this.enabled) return;

    const count = scopes.length * 2;
    this.querySet = device.createQuerySet({ type: 'timestamp', count });
    this.resolveBuffer = device.createBuffer({
      label: 'timestamp-resolve',
      size: count * 8,
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });
    this.readBuffer = device.createBuffer({
      label: 'timestamp-read',
      size: count * 8,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
  }

  /** Pass into a render or compute pass descriptor as `timestampWrites`. */
  writes(scope: string): GPURenderPassTimestampWrites | undefined {
    if (!this.querySet) return undefined;
    const i = this.scopes.indexOf(scope);
    if (i < 0) return undefined;
    return {
      querySet: this.querySet,
      beginningOfPassWriteIndex: i * 2,
      endOfPassWriteIndex: i * 2 + 1,
    };
  }

  /** Call once per frame, after the passes are encoded and before submit. */
  resolve(encoder: GPUCommandEncoder): void {
    if (!this.querySet || !this.resolveBuffer || !this.readBuffer) return;
    // Skip while a readback is in flight: mapping a buffer that is already
    // mapped is an error, and one sample every few frames is plenty.
    if (this.pending) return;
    const count = this.scopes.length * 2;
    encoder.resolveQuerySet(this.querySet, 0, count, this.resolveBuffer, 0);
    encoder.copyBufferToBuffer(this.resolveBuffer, 0, this.readBuffer, 0, count * 8);
  }

  /** Call once per frame, after submit. Kicks off the async read. */
  poll(): void {
    const buf = this.readBuffer;
    if (!buf || this.pending) return;
    this.pending = true;
    buf.mapAsync(GPUMapMode.READ).then(
      () => {
        const times = new BigUint64Array(buf.getMappedRange().slice(0));
        for (let i = 0; i < this.scopes.length; i++) {
          const begin = times[i * 2];
          const end = times[i * 2 + 1];
          // A zero or inverted pair means the driver dropped the query.
          this.results[i] = end > begin ? Number(end - begin) * NS_TO_MS : this.results[i];
        }
        buf.unmap();
        this.pending = false;
      },
      () => { this.pending = false; },
    );
  }

  /** Most recent measurement in milliseconds, or 0 when unavailable. */
  ms(scope: string): number {
    const i = this.scopes.indexOf(scope);
    return i < 0 ? 0 : this.results[i];
  }

  destroy(): void {
    this.querySet?.destroy();
    this.resolveBuffer?.destroy();
    this.readBuffer?.destroy();
  }
}
