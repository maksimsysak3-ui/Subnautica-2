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
import { clamp, DEG2RAD } from '../core/math';
import { frame, JITTER_SEQUENCE } from './frame-state';
import { createPostChain, type PostChain } from './post-chain';

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

  private chain: PostPass[] = [];
  private _quality = 2;
  private canvas: HTMLCanvasElement;

  /** The graphics team's default post chain, installed during init. */
  post!: PostChain;

  // Temporal bookkeeping for TAA / motion blur.
  private prevViewProjection = new THREE.Matrix4();
  private prevCameraPos = new THREE.Vector3();
  private prevCameraQuat = new THREE.Quaternion();
  private jitterSaved = new THREE.Vector2();
  private tmpMatrix = new THREE.Matrix4();
  private historyValid = false;

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
    // NO tone mapping here. The scene renders to a linear HDR target and the
    // present pass owns the whole output transform (exposure → ACES → grade).
    // Leaving three's material-level ACES on applies the curve twice — once
    // into the scene target and again at present — which crushes everything
    // except materials flagged toneMapped:false (which is why the sky looked
    // right while the world went black).
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Near/far ratio governs depth-buffer precision, and every pass that
    // reconstructs world position from depth (fog, SSAO, motion blur) inherits
    // it. 0.05→4000 is a ratio of 80,000, which quantised distant positions
    // badly enough to band the aerial perspective across open terrain. The
    // first-person weapon has its own camera, so the world camera does not
    // need a near plane measured in centimetres.
    this.camera = new THREE.PerspectiveCamera(this.baseFov, 1, 0.25, 2400);
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

    // The post chain ships with the renderer rather than being wired in
    // main.ts: it is not optional dressing, it is the renderer's output
    // transform. Individual passes stay disableable via `render.post.<id>`.
    this.post = createPostChain();
    for (const pass of this.post.all) this.addPass(pass);

    this.applyQuality();
  }

  private applyQuality(): void {
    const p = this.preset;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 1) * p.pixelRatio);
    this.renderer.shadowMap.needsUpdate = true;
    this.post?.applyQuality(this._quality);
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

    frame.width = rw;
    frame.height = rh;
    // New targets mean every temporal history is stale.
    frame.resetHistory = true;
    this.historyValid = false;

    for (const p of this.chain) p.resize?.(rw, rh);
  }

  addPass(pass: PostPass): void {
    this.removePass(pass.id);
    this.chain.push(pass);
    this.chain.sort((a, b) => a.order - b.order);
    pass.resize?.(this.sceneTarget.width, this.sceneTarget.height);
  }

  removePass(id: string): void {
    const i = this.chain.findIndex((p) => p.id === id);
    if (i >= 0) {
      this.chain[i].dispose?.();
      this.chain.splice(i, 1);
    }
  }

  /** Read-only view of the chain, for the capture harness and perf overlay. */
  get passes(): readonly PostPass[] {
    return this.chain;
  }

  getPass(id: string): PostPass | undefined {
    return this.chain.find((p) => p.id === id);
  }

  /** Swap the ping-pong targets — post passes call this after writing. */
  swap(): void {
    const t = this.postA;
    this.postA = this.postB;
    this.postB = t;
  }

  /**
   * Publish everything the post chain needs about this frame, and bake the TAA
   * sub-pixel offset into the projection matrix.
   *
   * The jitter has to go in *here*, after gameplay has finished moving the
   * camera and set its FOV, and it has to come back out immediately after the
   * draw so nothing outside the renderer ever observes a jittered projection.
   * `frame.invViewProjection` deliberately keeps the jitter — it is the matrix
   * that matches the depth buffer we just rendered, and unprojecting depth with
   * an unjittered inverse is a half-pixel error that shows up as TAA shimmer.
   */
  private beginFrame(dt: number): void {
    const cam = this.camera;
    cam.updateMatrixWorld();

    frame.index++;
    frame.dt = dt;
    frame.time += dt;
    frame.geometry = RenderSystem.fullscreenGeometry();
    frame.width = this.sceneTarget.width;
    frame.height = this.sceneTarget.height;
    frame.near = cam.near;
    frame.far = cam.far;
    frame.fovY = cam.fov * DEG2RAD;

    frame.prevCameraPosition.copy(this.prevCameraPos);
    frame.cameraPosition.copy(cam.position);
    frame.cameraDelta = this.historyValid ? cam.position.distanceTo(this.prevCameraPos) : 0;
    frame.cameraTurn = this.historyValid ? cam.quaternion.angleTo(this.prevCameraQuat) : 0;

    // A cut, a teleport or a capture-director camera set invalidates every
    // temporal buffer. Detect it here rather than making every pass guess.
    if (!this.historyValid || frame.cameraDelta > 8 || frame.cameraTurn > 0.6) {
      frame.resetHistory = true;
    }

    frame.viewMatrix.copy(cam.matrixWorldInverse);
    frame.prevViewProjection.copy(this.historyValid ? this.prevViewProjection : this.tmpMatrix.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    frame.viewProjection.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);

    // --- TAA jitter -------------------------------------------------------
    const taaActive =
      this.preset.taa && (this.getPass('taa')?.enabled ?? false) && frame.width > 1;
    this.jitterSaved.set(cam.projectionMatrix.elements[8], cam.projectionMatrix.elements[9]);
    if (taaActive) {
      const j = JITTER_SEQUENCE[frame.index % JITTER_SEQUENCE.length];
      frame.jitter.set(j.x, j.y);
      frame.jitterClip.set((2 * j.x) / frame.width, (2 * j.y) / frame.height);
      cam.projectionMatrix.elements[8] += frame.jitterClip.x;
      cam.projectionMatrix.elements[9] += frame.jitterClip.y;
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
      // The viewmodel shares the screen, so it must share the jitter or it
      // will crawl against a resolved world.
      this.viewCamera.projectionMatrix.elements[8] += frame.jitterClip.x;
      this.viewCamera.projectionMatrix.elements[9] += frame.jitterClip.y;
      this.viewCamera.projectionMatrixInverse.copy(this.viewCamera.projectionMatrix).invert();
    } else {
      frame.jitter.set(0, 0);
      frame.jitterClip.set(0, 0);
    }

    frame.invProjection.copy(cam.projectionMatrixInverse);
    this.tmpMatrix.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    frame.invViewProjection.copy(this.tmpMatrix).invert();

    frame.current = this.sceneTarget.texture;
    frame.bloomTexture = null;
    frame.aoTexture = null;
  }

  private endFrame(): void {
    const cam = this.camera;
    if (frame.jitterClip.x !== 0 || frame.jitterClip.y !== 0) {
      cam.projectionMatrix.elements[8] = this.jitterSaved.x;
      cam.projectionMatrix.elements[9] = this.jitterSaved.y;
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
      this.viewCamera.projectionMatrix.elements[8] -= frame.jitterClip.x;
      this.viewCamera.projectionMatrix.elements[9] -= frame.jitterClip.y;
      this.viewCamera.projectionMatrixInverse.copy(this.viewCamera.projectionMatrix).invert();
    }
    this.prevViewProjection.copy(frame.viewProjection);
    this.prevCameraPos.copy(cam.position);
    this.prevCameraQuat.copy(cam.quaternion);
    this.historyValid = true;
    frame.resetHistory = false;
  }

  lateUpdate(dt: number, _ctx: EngineContext): void {
    const r = this.renderer;

    this.beginFrame(dt);

    // --- world pass -------------------------------------------------------
    r.setRenderTarget(this.sceneTarget);
    r.clear(true, true, true);
    r.render(this.scene, this.camera);

    // Snapshot here. three resets renderer.info at the start of every
    // render() call, and the final one each frame is a fullscreen post quad,
    // so reading it afterwards always reported one draw call and one triangle.
    this.worldStats.drawCalls = r.info.render.calls;
    this.worldStats.triangles = r.info.render.triangles;

    // --- viewmodel pass ---------------------------------------------------
    // Cleared depth so the weapon never intersects world geometry.
    if (this.viewScene.children.length > 0) {
      r.clearDepth();
      r.render(this.viewScene, this.viewCamera);
    }

    // --- post chain -------------------------------------------------------
    for (const pass of this.chain) {
      if (!pass.enabled) continue;
      pass.render(this, dt);
    }

    // If no pass presented to the screen, blit the scene target directly.
    if (!this.chain.some((p) => p.enabled && p.id === 'present')) {
      r.setRenderTarget(null);
      this.blit(frame.current ?? this.sceneTarget.texture);
    }

    this.endFrame();
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

  /** Draw calls and triangles for the world pass, captured before post. */
  private worldStats = { drawCalls: 0, triangles: 0 };

  stats(): { drawCalls: number; triangles: number; programs: number; textures: number } {
    const info = this.renderer.info;
    return {
      drawCalls: this.worldStats.drawCalls,
      triangles: this.worldStats.triangles,
      programs: info.programs?.length ?? 0,
      textures: info.memory.textures,
    };
  }

  dispose(): void {
    this.sceneTarget?.dispose();
    this.postA?.dispose();
    this.postB?.dispose();
    for (const p of this.chain) p.dispose?.();
    this.renderer.dispose();
  }
}
