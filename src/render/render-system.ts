/**
 * Render system — owns the WebGL context, the main/view scene split, and the
 * post-process chain.
 *
 * OWNED BY: Graphics team. Lighting team owns lighting/, and registers lights
 * into `scene` via services.render.
 *
 * Design notes:
 *  - Two scenes. The world renders with the world camera; the first-person
 *    weapon renders afterwards with a narrower FOV camera and a cleared depth
 *    buffer, which is how shooters avoid the viewmodel clipping into walls.
 *  - Post passes are registered by other systems (fog, bloom, grade) so the
 *    graphics team can reorder without those systems knowing.
 */

import * as THREE from 'three';
import type { System, EngineContext } from '../core/engine';
import { services, type IRenderContext, type PostPass } from '../core/contracts';
import { clamp } from '../core/math';

export interface QualityPreset {
  name: string;
  shadowMapSize: number;
  shadowCascades: number;
  anisotropy: number;
  pixelRatio: number;
  postScale: number;
  volumetricSteps: number;
  ssaoSamples: number;
  maxDynamicLights: number;
  foliageDensity: number;
  taa: boolean;
}

export const QUALITY_PRESETS: QualityPreset[] = [
  { name: 'Low',    shadowMapSize: 1024, shadowCascades: 2, anisotropy: 1,  pixelRatio: 0.75, postScale: 0.6,  volumetricSteps: 12, ssaoSamples: 6,  maxDynamicLights: 8,  foliageDensity: 0.35, taa: false },
  { name: 'Medium', shadowMapSize: 2048, shadowCascades: 3, anisotropy: 4,  pixelRatio: 1.0,  postScale: 0.75, volumetricSteps: 24, ssaoSamples: 10, maxDynamicLights: 16, foliageDensity: 0.6,  taa: true },
  { name: 'High',   shadowMapSize: 2048, shadowCascades: 4, anisotropy: 8,  pixelRatio: 1.0,  postScale: 1.0,  volumetricSteps: 40, ssaoSamples: 16, maxDynamicLights: 24, foliageDensity: 0.85, taa: true },
  { name: 'Ultra',  shadowMapSize: 4096, shadowCascades: 4, anisotropy: 16, pixelRatio: 1.0,  postScale: 1.0,  volumetricSteps: 64, ssaoSamples: 24, maxDynamicLights: 32, foliageDensity: 1.0,  taa: true },
];

export class RenderSystem implements System, IRenderContext {
  readonly id = 'render';
  /** Draws last… */
  readonly order = 60;
  /** …but must exist first: every other system needs the scene and camera. */
  readonly initOrder = -100;
  readonly budgetMs = 12;

  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  /** Separate scene/camera pair for the first-person weapon. */
  readonly viewScene = new THREE.Scene();
  readonly viewCamera: THREE.PerspectiveCamera;

  private passes: PostPass[] = [];
  private _quality = 2;
  private canvas: HTMLCanvasElement;

  /** Scene render target — post passes read from here. */
  sceneTarget!: THREE.WebGLRenderTarget;
  /** Ping-pong targets for post chain. */
  postA!: THREE.WebGLRenderTarget;
  postB!: THREE.WebGLRenderTarget;

  width = 1;
  height = 1;

  /** Base FOV in degrees; the player system narrows this when aiming. */
  baseFov = 74;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // we do our own AA in post; MSAA + deferred-ish passes don't mix
      alpha: false,
      stencil: false,
      depth: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true, // needed so headless screenshots capture the frame
    });
    this.renderer.debug.checkShaderErrors = true;
    this.renderer.autoClear = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(this.baseFov, 1, 0.05, 4000);
    this.camera.position.set(0, 1.7, 0);

    // Narrower FOV keeps the weapon proportioned like a real sight picture
    // instead of stretching at the screen edges.
    this.viewCamera = new THREE.PerspectiveCamera(55, 1, 0.002, 12);

    this.scene.matrixWorldAutoUpdate = true;
  }

  get quality(): number {
    return this._quality;
  }
  set quality(tier: number) {
    this._quality = clamp(Math.round(tier), 0, QUALITY_PRESETS.length - 1);
    this.applyQuality();
  }
  get preset(): QualityPreset {
    return QUALITY_PRESETS[this._quality];
  }

  init(_ctx: EngineContext): void {
    services.register('render', this);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.applyQuality();
  }

  private applyQuality(): void {
    const p = this.preset;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 1) * p.pixelRatio);
    this.renderer.shadowMap.needsUpdate = true;
    this.resize();
  }

  private resize(): void {
    const w = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const h = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);

    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.viewCamera.aspect = aspect;
    this.viewCamera.updateProjectionMatrix();

    const dpr = this.renderer.getPixelRatio();
    const rw = Math.max(1, Math.floor(w * dpr));
    const rh = Math.max(1, Math.floor(h * dpr));

    const opts: THREE.RenderTargetOptions = {
      type: THREE.HalfFloatType,
      colorSpace: THREE.LinearSRGBColorSpace,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      generateMipmaps: false,
    };

    this.sceneTarget?.dispose();
    this.postA?.dispose();
    this.postB?.dispose();

    this.sceneTarget = new THREE.WebGLRenderTarget(rw, rh, opts);
    this.sceneTarget.depthTexture = new THREE.DepthTexture(rw, rh, THREE.FloatType);
    this.postA = new THREE.WebGLRenderTarget(rw, rh, opts);
    this.postB = new THREE.WebGLRenderTarget(rw, rh, opts);

    for (const p of this.passes) p.resize?.(rw, rh);
  }

  addPass(pass: PostPass): void {
    this.removePass(pass.id);
    this.passes.push(pass);
    this.passes.sort((a, b) => a.order - b.order);
    pass.resize?.(this.sceneTarget.width, this.sceneTarget.height);
  }

  removePass(id: string): void {
    const i = this.passes.findIndex((p) => p.id === id);
    if (i >= 0) {
      this.passes[i].dispose?.();
      this.passes.splice(i, 1);
    }
  }

  getPass(id: string): PostPass | undefined {
    return this.passes.find((p) => p.id === id);
  }

  /** Swap the ping-pong targets — post passes call this after writing. */
  swap(): void {
    const t = this.postA;
    this.postA = this.postB;
    this.postB = t;
  }

  lateUpdate(dt: number, _ctx: EngineContext): void {
    const r = this.renderer;

    // --- world pass -------------------------------------------------------
    r.setRenderTarget(this.sceneTarget);
    r.clear(true, true, true);
    r.render(this.scene, this.camera);

    // --- viewmodel pass ---------------------------------------------------
    // Cleared depth so the weapon never intersects world geometry.
    if (this.viewScene.children.length > 0) {
      r.clearDepth();
      r.render(this.viewScene, this.viewCamera);
    }

    // --- post chain -------------------------------------------------------
    for (const pass of this.passes) {
      if (!pass.enabled) continue;
      pass.render(this, dt);
    }

    // If no pass presented to the screen, blit the scene target directly.
    if (!this.passes.some((p) => p.enabled && p.id === 'present')) {
      r.setRenderTarget(null);
      this.blit(this.sceneTarget.texture);
    }
  }

  // --- fullscreen blit helper shared by post passes -------------------------
  private static quadGeo: THREE.BufferGeometry | null = null;
  private blitMat: THREE.RawShaderMaterial | null = null;
  private quad: THREE.Mesh | null = null;
  private orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quadScene = new THREE.Scene();

  /** Draws a texture to the currently bound target. */
  blit(texture: THREE.Texture, material?: THREE.Material): void {
    if (!RenderSystem.quadGeo) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
      RenderSystem.quadGeo = g;
    }
    if (!this.blitMat) {
      this.blitMat = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: `
          in vec3 position; in vec2 uv; out vec2 vUv;
          void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
        fragmentShader: `
          precision highp float; in vec2 vUv; out vec4 outColor;
          uniform sampler2D tSrc;
          void main(){ outColor = texture(tSrc, vUv); }`,
        uniforms: { tSrc: { value: null } },
        depthTest: false,
        depthWrite: false,
      });
    }
    if (!this.quad) {
      this.quad = new THREE.Mesh(RenderSystem.quadGeo, this.blitMat);
      this.quad.frustumCulled = false;
      this.quadScene.add(this.quad);
    }
    const mat = material ?? this.blitMat;
    this.quad.material = mat;
    if (mat === this.blitMat) this.blitMat.uniforms.tSrc.value = texture;
    this.renderer.render(this.quadScene, this.orthoCam);
  }

  /** Shared fullscreen-triangle geometry for passes that build their own mesh. */
  static fullscreenGeometry(): THREE.BufferGeometry {
    if (!RenderSystem.quadGeo) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
      RenderSystem.quadGeo = g;
    }
    return RenderSystem.quadGeo;
  }

  stats(): { drawCalls: number; triangles: number; programs: number; textures: number } {
    const info = this.renderer.info;
    return {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      programs: info.programs?.length ?? 0,
      textures: info.memory.textures,
    };
  }

  dispose(): void {
    this.sceneTarget?.dispose();
    this.postA?.dispose();
    this.postB?.dispose();
    for (const p of this.passes) p.dispose?.();
    this.renderer.dispose();
  }
}
