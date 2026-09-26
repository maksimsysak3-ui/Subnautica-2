/**
 * Mod buildings, drawn in 3D outside the game's renderer.
 *
 * The build menu's icons are photographs taken offline through the game's own
 * shader (tools/icon-sheet.mjs), which a building made in the Blueprint Studio
 * five seconds ago cannot have. So this draws the real mesh -- the same one
 * the city will place -- with a small WebGL2 program: the materials as flat
 * colours, the brand tints, a sun and a sky, storey lines on the glass. Not
 * the game's lighting, but the actual model, turning.
 *
 * Two uses. `ModelView` is a live, draggable view for the studio. `modelIcon`
 * renders a still to an image once per building and caches it, for the mod
 * cards and the Landmarks drawer.
 */

import { FLOATS_PER_VERTEX, MAT, TINT } from '../assets/mesh';
import type { MeshBuilder } from '../assets/mesh';
import type { AssetDef } from '../assets/types';

const hex = (h: number): [number, number, number] => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

/** Each material's colour, sRGB. Unlisted ones are a light grey. */
const MAT_COLOUR: Record<number, number> = {
  [MAT.ROOF]: 0x8c9098, [MAT.HOUSING]: 0xd8cfc0, [MAT.GLASS]: 0x3e5a78, [MAT.METAL]: 0x9aa1a8,
  [MAT.BRICK]: 0xa4553c, [MAT.TRIM]: 0xe4e0d8, [MAT.SHOPFRONT]: 0x3a5672, [MAT.TILE]: 0x7a4a3a,
  [MAT.GROUND]: 0x6f8a55, [MAT.HOUSE_WALL]: 0xb86a4c, [MAT.SHED_WALL]: 0xa8adb2, [MAT.CONCRETE]: 0xbdbab2,
  [MAT.PLASTER]: 0xe3dccd, [MAT.PANE]: 0x4a6a8c, [MAT.ROOF_TILE]: 0x7c4636, [MAT.STONE]: 0xcdbf9f,
  [MAT.CLADDING]: 0x8e9aa6, [MAT.TIMBER]: 0x9a7650, [MAT.DARK_TRIM]: 0x2e333b, [MAT.RENDER]: 0xd6d0c4,
  [MAT.LAMP]: 0xffe2a0, [MAT.WATER]: 0x3f6f96, [MAT.FOLIAGE]: 0x4f8a4a, [MAT.BARK]: 0x6a4a30,
};
/** Materials drawn as glazing: darker, with a line at every storey. */
const GLAZED = [MAT.GLASS, MAT.PANE, MAT.SHOPFRONT];

const VS = `#version 300 es
layout(location=0) in vec3 p; layout(location=1) in vec3 n; layout(location=2) in vec3 c; layout(location=3) in float g;
uniform mat4 mvp; out vec3 vn; out vec3 vc; out float vg; out float vy;
void main() { vn = n; vc = c; vg = g; vy = p.y; gl_Position = mvp * vec4(p, 1.0); }`;
const FS = `#version 300 es
precision mediump float;
in vec3 vn; in vec3 vc; in float vg; in float vy; out vec4 o;
void main() {
  vec3 n = normalize(vn);
  vec3 sun = normalize(vec3(0.55, 0.75, 0.38));
  float d = max(dot(n, sun), 0.0);
  float sky = 0.5 + 0.5 * n.y;
  vec3 col = vc;
  if (vg > 1.5) { o = vec4(col * 1.6, 1.0); return; }          // lit: signs and crowns
  if (vg > 0.5) {                                               // glazing: storey lines, sky in the glass
    float line = smoothstep(0.0, 0.08, fract(vy / 3.8)) * smoothstep(1.0, 0.9, fract(vy / 3.8));
    col = mix(col * 0.45, col, line) + vec3(0.10, 0.14, 0.20) * max(n.y + 0.4, 0.0);
  }
  vec3 lit = col * (0.34 * mix(vec3(0.55, 0.52, 0.5), vec3(0.75, 0.85, 1.0), sky) + 0.95 * d * vec3(1.0, 0.95, 0.86));
  o = vec4(pow(lit, vec3(1.0 / 1.15)), 1.0);
}`;

interface Gpu { gl: WebGL2RenderingContext; prog: WebGLProgram; mvp: WebGLUniformLocation }

function setup(canvas: HTMLCanvasElement | OffscreenCanvas, keep: boolean): Gpu | null {
  const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: keep, alpha: true }) as WebGL2RenderingContext | null;
  if (gl === null) return null;
  const sh = (type: number, src: string): WebGLShader => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  return { gl, prog, mvp: gl.getUniformLocation(prog, 'mvp')! };
}

/** A mesh ready to draw: vertex buffer and its size. */
interface Model { vao: WebGLVertexArrayObject; buf: WebGLBuffer; count: number; min: number[]; max: number[] }

/** Flattens a mesh to position, normal, colour and a glaze/lit flag, and uploads it. */
function upload(g: Gpu, def: AssetDef, mesh: MeshBuilder): Model {
  const { vertices, indices } = mesh.build({ occlusion: false });
  const brand = def.brand?.colour ?? [0.8, 0.7, 0.5];
  const accent = def.brand?.accent ?? [0.3, 0.3, 0.3];
  const tint: Record<number, [number, number, number]> = {
    [TINT.BRAND]: brand, [TINT.BRAND_DARK]: brand.map((v) => v * 0.6) as [number, number, number],
    [TINT.ACCENT]: accent, [TINT.SIGN_LIT]: brand, [TINT.DOOR]: hex(0x5a4030), [TINT.AWNING]: brand,
    [TINT.METAL_DARK]: hex(0x2b2f35), [TINT.WOOD]: hex(0x8a6440), [TINT.GREEN]: hex(0x4f8a4a),
    [TINT.GREEN_DARK]: hex(0x3f7a3c), [TINT.SMOKE]: hex(0xcfcfcf), [TINT.STEAM]: hex(0xf0f0f0),
  };
  const out = new Float32Array(indices.length * 10);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < indices.length; i++) {
    const v = indices[i] * FLOATS_PER_VERTEX, o = i * 10;
    for (let k = 0; k < 6; k++) out[o + k] = vertices[v + k];
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], vertices[v + k]); max[k] = Math.max(max[k], vertices[v + k]); }
    const mat = vertices[v + 6], t = vertices[v + 8];
    const c = t !== 0 && tint[t] !== undefined ? tint[t] : hex(MAT_COLOUR[mat] ?? 0xb4b8bc);
    out[o + 6] = c[0]; out[o + 7] = c[1]; out[o + 8] = c[2];
    out[o + 9] = t === TINT.SIGN_LIT || mat === MAT.LAMP ? 2 : GLAZED.includes(mat as never) ? 1 : 0;
  }
  const { gl } = g;
  const vao = gl.createVertexArray()!;
  const buf = gl.createBuffer()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, out, gl.STATIC_DRAW);
  const F = 4 * 10;
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, F, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, F, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, F, 24);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, F, 36);
  gl.bindVertexArray(null);
  return { vao, buf, count: indices.length, min, max };
}

function free(g: Gpu, m: Model): void {
  g.gl.deleteBuffer(m.buf);
  g.gl.deleteVertexArray(m.vao);
}

/** A perspective view of the model's bounds, from `yaw` round and `pitch` up, filling the frame. */
function draw(g: Gpu, m: Model, w: number, h: number, yaw: number, pitch: number): void {
  const { gl } = g;
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE); // generators are not all wound the same way
  const cx = (m.min[0] + m.max[0]) / 2, cy = (m.min[1] + m.max[1]) / 2, cz = (m.min[2] + m.max[2]) / 2;
  const r = Math.hypot(m.max[0] - m.min[0], m.max[1] - m.min[1], m.max[2] - m.min[2]) / 2 || 1;
  const fov = 0.5, aspect = w / h;
  const dist = r / Math.sin(fov / 2) * (aspect < 1 ? 1 / aspect : 1) * 0.92;
  const eye = [cx + Math.sin(yaw) * Math.cos(pitch) * dist, cy + Math.sin(pitch) * dist, cz + Math.cos(yaw) * Math.cos(pitch) * dist];
  const f = norm([cx - eye[0], cy - eye[1], cz - eye[2]]);
  const s = norm(cross(f, [0, 1, 0]));
  const u = cross(s, f);
  const view = [s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0,
    -dot(s, eye), -dot(u, eye), dot(f, eye), 1];
  const near = Math.max(0.5, dist - r * 1.5), far = dist + r * 1.5, t = 1 / Math.tan(fov / 2);
  const proj = [t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0];
  gl.useProgram(g.prog);
  gl.uniformMatrix4fv(g.mvp, false, mul(proj, view));
  gl.bindVertexArray(m.vao);
  gl.drawArrays(gl.TRIANGLES, 0, m.count);
  gl.bindVertexArray(null);
}

const dot = (a: number[], b: number[]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: number[], b: number[]): number[] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: number[]): number[] => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function mul(a: number[], b: number[]): Float32Array {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let v = 0;
    for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = v;
  }
  return o;
}

// ---- stills ----------------------------------------------------------------

let still: { canvas: HTMLCanvasElement; g: Gpu } | null | undefined;
const icons = new Map<string, string>();

/**
 * A still of the building as an image URL, rendered once and kept. `key` names
 * the version of the model: a blueprint's key changes with the blueprint.
 * Empty string when the browser has no WebGL2.
 */
export function modelIconUrl(def: AssetDef, key = def.id, px = 104): string {
  const hit = icons.get(key);
  if (hit !== undefined) return hit;
  if (still === undefined) {
    const canvas = document.createElement('canvas');
    const g = setup(canvas, true);
    still = g === null ? null : { canvas, g };
  }
  if (still === null) return '';
  still.canvas.width = px;
  still.canvas.height = px;
  const m = upload(still.g, def, def.build(1));
  draw(still.g, m, px, px, 0.65, 0.42);
  const url = still.canvas.toDataURL('image/png');
  free(still.g, m);
  icons.set(key, url);
  return url;
}

/** The still as markup, for places that take an HTML string. */
export function modelIconHtml(def: AssetDef, size = 52, key = def.id): string {
  const url = modelIconUrl(def, key, size * 2);
  return url === '' ? (def.iconSvg ?? '')
    : `<img src="${url}" width="${size}" height="${size}" alt="" style="display:block;object-fit:contain">`;
}

// ---- live view --------------------------------------------------------------

/** A turning, draggable view of one building, for the Blueprint Studio. */
export class ModelView {
  readonly canvas = document.createElement('canvas');
  private readonly g: Gpu | null;
  private model: Model | null = null;
  private yaw = 0.65;
  private pitch = 0.32;
  private spin = true;
  private frame = 0;
  private pending: (() => AssetDef) | null = null;

  constructor() {
    this.canvas.className = 'mr-model-view';
    this.g = setup(this.canvas, false);
    let drag: { x: number; y: number } | null = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY };
      this.spin = false;
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (drag === null) return;
      this.yaw -= (e.clientX - drag.x) * 0.012;
      this.pitch = Math.max(0.02, Math.min(1.35, this.pitch + (e.clientY - drag.y) * 0.008));
      drag = { x: e.clientX, y: e.clientY };
    });
    this.canvas.addEventListener('pointerup', () => { drag = null; });
    this.canvas.addEventListener('dblclick', () => { this.spin = !this.spin; });
    const loop = (): void => {
      if (!this.canvas.isConnected && this.frame > 0) { this.dispose(); return; }
      this.frame = requestAnimationFrame(loop);
      if (this.pending !== null && this.g !== null) {
        const def = this.pending();
        this.pending = null;
        if (this.model !== null) free(this.g, this.model);
        this.model = upload(this.g, def, def.build(0));
      }
      if (this.spin) this.yaw += 0.006;
      this.paint();
    };
    this.frame = requestAnimationFrame(loop);
  }

  /** Whether the browser can draw it at all. */
  get ok(): boolean { return this.g !== null; }

  /** Shows a building. Built on the next frame, so a slider dragged fast builds once per frame. */
  show(make: () => AssetDef): void { this.pending = make; }

  private paint(): void {
    if (this.g === null || this.model === null) return;
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    draw(this.g, this.model, w, h, this.yaw, this.pitch);
  }

  private dispose(): void {
    cancelAnimationFrame(this.frame);
    if (this.g !== null && this.model !== null) free(this.g, this.model);
    this.model = null;
    this.g?.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
