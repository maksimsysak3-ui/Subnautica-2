// The prime-time cold open in 3D (CSS 3D, no WebGL): the camera dollies in low over a
// lit field toward the show's mark, which swings round as a thick metal badge (stacked
// layers give it real depth), lands with a burst of sparks, and catches a light sweep.
// Light rigs pan across the stadium haze and the mark is reflected in the turf.
import type { CSSProperties } from 'react';
import { ShowLogo } from './showlogo';

type Mark = 'TNF' | 'SNF' | 'MNF';
const TINT: Record<Mark, [string, string]> = { TNF: ['#2f7bff', '#9ec5ff'], SNF: ['#e2b23f', '#ffe8a6'], MNF: ['#d6293d', '#ff9aa6'] };
const DEPTH = 14;   // extrusion layers

export function Show3D({ mark, venue }: { mark: Mark; venue: string }) {
  const [c, glow] = TINT[mark];
  const size = Math.min(380, window.innerHeight * 0.52);
  return (
    <div className="s3" style={{ '--c': c, '--g': glow } as CSSProperties}>
      <div className="s3-cam">
        <div className="s3-world">
          <div className="s3-floor"><i /></div>
          {[-1, 1].map(side => <div key={side} className={`s3-rig ${side < 0 ? 'l' : 'r'}`}>{[0, 1, 2, 3].map(k => <b key={k} />)}</div>)}
          {[0, 1, 2, 3].map(k => <div key={k} className={`s3-beam b${k}`} />)}
          <div className="s3-mark" style={{ width: size }}>
            {Array.from({ length: DEPTH }, (_, i) => (
              <div key={i} className="s3-layer" style={{ transform: `translateZ(${-i * 1.6}px)`, filter: i ? `brightness(${0.42 - i * 0.012}) saturate(.8)` : undefined }}>
                <ShowLogo mark={mark} size={size} animate={false} />
              </div>
            ))}
            <div className="s3-spec" />
          </div>
          <div className="s3-reflect" style={{ width: size }}><ShowLogo mark={mark} size={size} animate={false} /></div>
          <div className="s3-sparks">{Array.from({ length: 34 }, (_, i) => {
            const a = (i / 34) * Math.PI * 2, r = 180 + (i * 53) % 220;
            return <i key={i} style={{ '--x': `${Math.cos(a) * r}px`, '--y': `${Math.sin(a) * r * 0.6 - 60}px`, '--z': `${(i % 7) * 40 - 120}px`, animationDelay: `${1.55 + (i % 5) * 0.03}s` } as CSSProperties} />;
          })}</div>
        </div>
      </div>
      <div className="s3-haze" />
      <div className="s3-venue">{venue}</div>
    </div>
  );
}
