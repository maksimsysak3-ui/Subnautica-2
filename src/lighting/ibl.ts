/**
 * Image-based lighting.
 *
 * OWNED BY: Lighting.
 *
 * ## Why this exists
 * `MeshStandardMaterial` is a physically-based shader, and a physically-based
 * metal has **no diffuse response at all** — every photon it sends to the eye
 * is a reflection of something. With no environment map there is nothing to
 * reflect, so a metal lit only by directional lights returns a narrow specular
 * highlight and black everywhere else.
 *
 * That is precisely what was wrong with the weapon: `metalness: 0.70` on the
 * receiver, `0.88` on the bluing, and no environment anywhere in the project.
 * The viewmodel lights had been pushed to intensity 6.5 chasing a problem that
 * more light cannot fix. Every metal surface in the level had the same bug.
 *
 * ## What it builds
 * A small procedural equirectangular sky — zenith tint, horizon haze, ground
 * bounce and a broad sun lobe — run through `PMREMGenerator` so roughness maps
 * to the right mip. 64x32 is plenty: an environment map is a low-frequency
 * signal, and blurred reflections are all a rough parkerised finish returns.
 *
 * It is rebuilt only when the sky has actually moved, because PMREM is a real
 * GPU pass and running it every frame would cost more than the lighting.
 */

import * as THREE from 'three';

const W = 64;
const H = 32;

export interface SkyEnvParams {
  /** Normalised direction *towards* the sun. */
  sunDir: THREE.Vector3;
  zenith: THREE.Color;
  horizon: THREE.Color;
  ground: THREE.Color;
  /** Overall scale — daylight is roughly 1, night far below it. */
  intensity: number;
  /** 0 clear, 1 fully overcast. Flattens the sun lobe into the sky. */
  cloudCover: number;
}

export class SkyEnvironment {
  private pmrem: THREE.PMREMGenerator;
  private data = new Float32Array(W * H * 4);
  private source: THREE.DataTexture;
  private target: THREE.WebGLRenderTarget | null = null;

  /** The cubemap to assign to `scene.environment`. */
  texture: THREE.Texture | null = null;

  private lastKey = '';

  constructor(renderer: THREE.WebGLRenderer) {
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();
    this.source = new THREE.DataTexture(this.data, W, H, THREE.RGBAFormat, THREE.FloatType);
    this.source.mapping = THREE.EquirectangularReflectionMapping;
    this.source.colorSpace = THREE.LinearSRGBColorSpace;
    this.source.minFilter = THREE.LinearFilter;
    this.source.magFilter = THREE.LinearFilter;
  }

  /**
   * Rebuild if the sky has moved enough to matter. Returns true if it did.
   *
   * The key is quantised deliberately: a one-degree sun move is not worth a
   * PMREM pass, and without the guard a smooth day/night cycle would trigger
   * one every single frame.
   */
  update(p: SkyEnvParams): boolean {
    const key = [
      p.sunDir.x.toFixed(2), p.sunDir.y.toFixed(2), p.sunDir.z.toFixed(2),
      p.zenith.getHexString(), p.horizon.getHexString(), p.ground.getHexString(),
      p.intensity.toFixed(2), p.cloudCover.toFixed(2),
    ].join('|');
    if (key === this.lastKey) return false;
    this.lastKey = key;

    this.rasterise(p);
    this.source.needsUpdate = true;

    const next = this.pmrem.fromEquirectangular(this.source);
    this.target?.dispose();
    this.target = next;
    this.texture = next.texture;
    return true;
  }

  private rasterise(p: SkyEnvParams): void {
    const d = this.data;
    // A clear sky puts most of its energy in a tight lobe; overcast smears it
    // across the whole dome, which is why an overcast day has soft shadows and
    // a metal object still reads as metal.
    const lobe = THREE.MathUtils.lerp(220, 6, p.cloudCover);
    const sunGain = THREE.MathUtils.lerp(28, 2.2, p.cloudCover);
    const dir = new THREE.Vector3();
    const c = new THREE.Color();

    for (let y = 0; y < H; y++) {
      // Equirect: v=0 is +Y (up), v=1 is -Y.
      const theta = ((y + 0.5) / H) * Math.PI;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      for (let x = 0; x < W; x++) {
        const phi = ((x + 0.5) / W) * Math.PI * 2 - Math.PI;
        dir.set(sinT * Math.sin(phi), cosT, sinT * Math.cos(phi));

        if (cosT >= 0) {
          // Sky: zenith to horizon, biased so most of the dome reads as sky
          // rather than as a band of haze.
          const t = Math.pow(1 - cosT, 2.2);
          c.copy(p.zenith).lerp(p.horizon, t);
          const cd = Math.max(0, dir.dot(p.sunDir));
          const sun = Math.pow(cd, lobe) * sunGain + Math.pow(cd, 6) * 0.35;
          c.r += sun; c.g += sun * 0.94; c.b += sun * 0.82;
        } else {
          // Ground: albedo lit by the sky, brightening back toward the horizon
          // where it catches more of the dome.
          const t = Math.pow(1 + cosT, 1.6);
          c.copy(p.ground).lerp(p.horizon, t * 0.55);
        }

        const i = (y * W + x) * 4;
        d[i] = c.r * p.intensity;
        d[i + 1] = c.g * p.intensity;
        d[i + 2] = c.b * p.intensity;
        d[i + 3] = 1;
      }
    }
  }

  dispose(): void {
    this.target?.dispose();
    this.source.dispose();
    this.pmrem.dispose();
  }
}
