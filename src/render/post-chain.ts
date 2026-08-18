/**
 * The default post-process chain.
 *
 * OWNED BY: Graphics team.
 *
 * `RenderSystem` installs this during init, so the chain is part of the
 * renderer rather than something `main.ts` has to remember to wire. Other teams
 * can still `services.get('render').addPass(...)` their own passes; ordering is
 * by `PostPass.order`, and the slots below leave room between them.
 *
 * Order and the reasoning behind it:
 *
 *   10  ssao         needs raw depth; must run before anything blurs or
 *                    reprojects the image
 *   20  atmosphere   height fog + aerial perspective; wants AO already applied
 *                    so occluded geometry fogs from its shaded value
 *   30  taa          resolve before any pass that blurs across pixels, so the
 *                    history is a clean 1:1 image
 *   40  motionBlur   camera velocity; after TAA or it fights the history
 *   50  dof          after TAA for the same reason
 *   60  exposure     measures the final pre-grade image
 *   70  bloom        thresholds against the exposure measured above
 *   90  fxaa         Low-tier substitute for TAA
 *   1000 present     tone map, grade, and the only write to the backbuffer
 */

import type { PostPass } from '../core/contracts';
import { SsaoPass } from '../fx/postprocess/ssao-pass';
import { AtmospherePass } from '../fx/postprocess/atmosphere-pass';
import { TaaPass } from '../fx/postprocess/taa-pass';
import { MotionBlurPass } from '../fx/postprocess/motion-blur-pass';
import { DofPass } from '../fx/postprocess/dof-pass';
import { ExposurePass } from '../fx/postprocess/exposure-pass';
import { BloomPass } from '../fx/postprocess/bloom-pass';
import { FxaaPass } from '../fx/postprocess/fxaa-pass';
import { PresentPass } from '../fx/postprocess/present-pass';

export interface PostChain {
  ssao: SsaoPass;
  atmosphere: AtmospherePass;
  taa: TaaPass;
  motionBlur: MotionBlurPass;
  dof: DofPass;
  exposure: ExposurePass;
  bloom: BloomPass;
  fxaa: FxaaPass;
  present: PresentPass;
  all: PostPass[];
  /** Re-evaluate which passes a quality tier can afford. */
  applyQuality(tier: number): void;
}

export function createPostChain(): PostChain {
  const chain: PostChain = {
    ssao: new SsaoPass(),
    atmosphere: new AtmospherePass(),
    taa: new TaaPass(),
    motionBlur: new MotionBlurPass(),
    dof: new DofPass(),
    exposure: new ExposurePass(),
    bloom: new BloomPass(),
    fxaa: new FxaaPass(),
    present: new PresentPass(),
    all: [],
    applyQuality(tier: number) {
      // Low has no temporal budget: FXAA instead of TAA, no motion blur, no
      // depth of field, no bloom mip chain.
      chain.taa.enabled = tier >= 1;
      chain.fxaa.enabled = tier < 1;
      chain.ssao.enabled = true;
      chain.atmosphere.enabled = true;
      chain.exposure.enabled = true;
      chain.bloom.enabled = tier >= 1;
      chain.motionBlur.enabled = tier >= 2;
      chain.dof.enabled = tier >= 2;
      chain.present.enabled = true;
    },
  };
  chain.all = [
    chain.ssao,
    chain.atmosphere,
    chain.taa,
    chain.motionBlur,
    chain.dof,
    chain.exposure,
    chain.bloom,
    chain.fxaa,
    chain.present,
  ];
  return chain;
}
