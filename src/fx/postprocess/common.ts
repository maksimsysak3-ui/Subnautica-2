/**
 * Shared plumbing for the post-process chain.
 *
 * OWNED BY: Graphics team.
 *
 * Every pass in `src/fx/postprocess/` is a fullscreen triangle drawn with a
 * GLSL3 `RawShaderMaterial`. Raw materials mean three.js injects nothing — no
 * tone mapping chunk, no colour-space conversion, no fog. That is exactly what
 * we want: the chain owns the whole transfer function from HDR scene radiance
 * to the 8-bit backbuffer, and there is precisely one place where sRGB encoding
 * happens (the present pass).
 *
 * Two things live here that every pass needs:
 *   - `FullScreenQuad`, a tiny wrapper that shares the render system's
 *     fullscreen triangle geometry.
 *   - `GLSL_LIB`, the depth/space-reconstruction and colour helpers. Keeping
 *     them in one string means the SSAO, fog and TAA passes cannot disagree
 *     about how to turn a depth sample back into a view-space position — a
 *     class of bug that is extremely hard to see and extremely easy to make.
 */

import * as THREE from 'three';
import { frame, type PostContext } from '../../render/frame-state';

// ---------------------------------------------------------------------------
// Fullscreen triangle
// ---------------------------------------------------------------------------

export const FULLSCREEN_VERT = /* glsl */ `
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

let fallbackGeo: THREE.BufferGeometry | null = null;
function geometry(): THREE.BufferGeometry {
  if (frame.geometry) return frame.geometry;
  if (!fallbackGeo) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    fallbackGeo = g;
  }
  return fallbackGeo;
}

const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

export type Uniforms = Record<string, THREE.IUniform>;

/** One fullscreen draw: a raw GLSL3 material plus the shared triangle. */
export class FullScreenQuad {
  readonly material: THREE.RawShaderMaterial;
  private scene = new THREE.Scene();
  private mesh: THREE.Mesh | null = null;

  constructor(fragmentShader: string, uniforms: Uniforms, defines?: Record<string, string | number>) {
    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader,
      uniforms,
      defines: defines ? { ...defines } : undefined,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
      toneMapped: false,
    });
    this.scene.matrixWorldAutoUpdate = false;
  }

  get uniforms(): Uniforms {
    return this.material.uniforms as Uniforms;
  }

  /** Recompile with new defines — used when the quality tier changes. */
  setDefines(defines: Record<string, string | number>): void {
    this.material.defines = { ...defines };
    this.material.needsUpdate = true;
  }

  render(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null): void {
    if (!this.mesh) {
      this.mesh = new THREE.Mesh(geometry(), this.material);
      this.mesh.frustumCulled = false;
      this.mesh.matrixAutoUpdate = false;
      this.scene.add(this.mesh);
    }
    renderer.setRenderTarget(target);
    renderer.render(this.scene, orthoCam);
  }

  dispose(): void {
    this.material.dispose();
  }
}

// ---------------------------------------------------------------------------
// Render-target helpers
// ---------------------------------------------------------------------------

export function makeTarget(
  w: number,
  h: number,
  opts: Partial<THREE.RenderTargetOptions> = {},
): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(Math.max(1, w | 0), Math.max(1, h | 0), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    colorSpace: THREE.LinearSRGBColorSpace,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    ...opts,
  });
}

/**
 * Draw into the free ping-pong target, flip the pair, and publish the result as
 * the live colour texture. Every colour-modifying pass ends with this so the
 * chain never reads the target it is writing.
 */
export function writeAndSwap(ctx: PostContext, quad: FullScreenQuad): void {
  const dst = ctx.postA;
  quad.render(ctx.renderer, dst);
  ctx.swap();
  frame.current = dst.texture;
}

// ---------------------------------------------------------------------------
// Shared GLSL
// ---------------------------------------------------------------------------

/**
 * Precision + reconstruction + colour helpers.
 *
 * `precision highp sampler2D` matters: GLSL ES 3.00 defaults samplers to lowp
 * in fragment shaders, which quantises the 32-bit depth buffer badly enough to
 * band the AO and shear the TAA reprojection.
 */
export const GLSL_LIB = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;

const float PI = 3.141592653589793;
const float HALF_PI = 1.5707963267948966;

float luminance(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

float maxc(vec3 c) { return max(c.r, max(c.g, c.b)); }

/** Window-space depth (0..1) to positive view-space distance along -Z. */
float linearDepth(float d, float near, float far) {
  float z = d * 2.0 - 1.0;
  return (2.0 * near * far) / (far + near - z * (far - near));
}

/** Depth sample to view-space position (right-handed, -Z forward). */
vec3 viewPosition(vec2 uv, float d, mat4 invProj) {
  vec4 ndc = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 v = invProj * ndc;
  return v.xyz / v.w;
}

/** Depth sample to world-space position using the jittered inverse view-proj. */
vec3 worldPosition(vec2 uv, float d, mat4 invViewProj) {
  vec4 ndc = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 p = invViewProj * ndc;
  return p.xyz / p.w;
}

/** Cheap hash — used for dither, grain and per-pixel sample rotation. */
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

/**
 * Interleaved gradient noise (Jorge Jimenez). Unlike white noise this is
 * spatially well distributed at 1 sample per pixel, which is what makes a
 * 4-tap AO look like 16 taps once TAA has averaged a few frames.
 */
float igNoise(vec2 pixel) {
  return fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
}

// --- colour space ---------------------------------------------------------

vec3 rgbToYCoCg(vec3 c) {
  return vec3(
     0.25 * c.r + 0.5 * c.g + 0.25 * c.b,
     0.5  * c.r              - 0.5  * c.b,
    -0.25 * c.r + 0.5 * c.g - 0.25 * c.b);
}

vec3 yCoCgToRgb(vec3 c) {
  float t = c.x - c.z;
  return vec3(t + c.y, c.x + c.z, t - c.y);
}

vec3 linearToSrgb(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

/**
 * Reversible tone map used to weight TAA/bloom samples. Averaging in this space
 * stops a single 200-nit firefly from dominating an 8-frame accumulation.
 */
vec3 tonemapWeight(vec3 c)    { return c / (1.0 + maxc(c)); }
vec3 tonemapUnweight(vec3 c)  { return c / max(1e-4, 1.0 - maxc(c)); }
`;
