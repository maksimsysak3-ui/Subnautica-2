/**
 * Draws the game's WebGPU canvas into an offscreen texture instead of the page.
 *
 * The software renderer these tools run under (SwiftShader) crashes the page
 * when it presents to a real canvas. Loaded as an init script, this swaps the
 * canvas's WebGPU context for one whose "current texture" is an ordinary
 * texture, so the game renders, runs and can be driven -- and `__grab()` copies
 * a frame back for screenshots.
 */
(() => {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...a) {
    if (type !== 'webgpu') return orig.call(this, type, ...a);
    const canvas = this; let dev = null, fmt = 'rgba8unorm', tex = null;
    const ctx = {
      canvas,
      configure(c) { dev = c.device; fmt = c.format; tex = null; },
      unconfigure() {},
      getConfiguration() { return { device: dev, format: fmt }; },
      getCurrentTexture() {
        const w = canvas.width, h = canvas.height;
        if (!tex || tex.width !== w || tex.height !== h) {
          tex = dev.createTexture({ size: [w, h], format: fmt,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
        }
        return tex;
      },
    };
    window.__grab = async () => {
      if (!tex) return 'no texture';
      const w = tex.width, h = tex.height, stride = Math.ceil(w * 4 / 256) * 256;
      const buf = dev.createBuffer({ size: stride * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      const e = dev.createCommandEncoder(); e.copyTextureToBuffer({ texture: tex }, { buffer: buf, bytesPerRow: stride }, [w, h]);
      dev.queue.submit([e.finish()]); await buf.mapAsync(GPUMapMode.READ);
      const src = new Uint8Array(buf.getMappedRange()); const img = new ImageData(w, h);
      const bgra = fmt.startsWith('bgra');
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const s = y * stride + x * 4, d = (y * w + x) * 4;
        img.data[d] = src[s + (bgra ? 2 : 0)]; img.data[d + 1] = src[s + 1]; img.data[d + 2] = src[s + (bgra ? 0 : 2)]; img.data[d + 3] = 255;
      }
      buf.unmap(); buf.destroy();
      let c2 = document.getElementById('__shot');
      if (!c2) { c2 = document.createElement('canvas'); c2.id = '__shot'; document.body.insertBefore(c2, document.body.firstChild); }
      const r = canvas.getBoundingClientRect();
      c2.width = w; c2.height = h;
      c2.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:0;pointer-events:none`;
      canvas.style.visibility = 'hidden';
      c2.getContext('2d').putImageData(img, 0, 0);
      return 'ok ' + w + 'x' + h;
    };
    return ctx;
  };
})();
