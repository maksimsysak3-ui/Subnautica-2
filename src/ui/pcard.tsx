// The collectible player card used across the game: metallic frame by tier,
// team-colour art, headshot cut over a giant jersey number, the six attributes
// that drive his overall, and a holo foil on the elite tiers.
import { useRef, useState, type CSSProperties } from 'react';
import type { Player, Team } from '../core/types';
import { OVR_W, ATTR_NAME } from '../core/ratings';
import { app } from './store';
import { FaceArt } from './face';
import { Logo, vivid } from './components';

export const cardTier = (o: number) => (o >= 95 ? 'legend' : o >= 90 ? 'elite' : o >= 80 ? 'gold' : o >= 70 ? 'silver' : 'bronze');
export const keyAttrs = (p: Player, n = 6) => (Object.entries(OVR_W[p.pos]) as [keyof Player['attrs'], number][]).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);

export function PlayerCard({ p, size = 'md', team, onClick, style, label, hideOvr }: {
  p: Player; size?: 'sm' | 'md' | 'lg'; team?: Team; onClick?: () => void; style?: CSSProperties; label?: string; hideOvr?: boolean;
}) {
  const t = team ?? app.league?.teams[p.team];
  const [bad, setBad] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<{ x: number; y: number; gx: number; gy: number } | null>(null);
  const c1 = t ? vivid(t.colors[0]) : '#3a4558', c2 = t ? t.colors[1] : '#9aa3b5';
  const url = p.hs && !bad ? p.hs.replace('f_auto,q_auto', 'f_auto,q_auto,w_400') : undefined;
  const tier = cardTier(p.ovr);
  const W = { sm: 150, md: 200, lg: 290 }[size];
  return (
    <div ref={ref} className={`pc3 ${tier} ${size}${p.dev === 'X-Factor' ? ' xf' : ''}${onClick ? ' click' : ''}`} style={{ width: W, '--c1': c1, '--c2': c2, ...style } as CSSProperties}
      onClick={onClick ?? (() => app.go({ id: 'player', pid: p.id }))}
      onMouseMove={e => { const r = ref.current!.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height; setTilt({ x: (0.5 - py) * 14, y: (px - 0.5) * 16, gx: px * 100, gy: py * 100 }); }}
      onMouseLeave={() => setTilt(null)}>
      <div className="pc3-in" style={tilt ? { transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(0)`, transition: 'transform .06s', '--gx': `${tilt.gx}%`, '--gy': `${tilt.gy}%` } as CSSProperties : undefined}>
        <div className="pc3-art">
          <div className="pc3-num">{p.num || ''}</div>
          {t && <Logo team={t} size={W * 0.9} style={{ position: 'absolute', right: -W * 0.22, top: -W * 0.12, opacity: 0.16, filter: 'grayscale(.2)' }} />}
          {url ? <img className="pc3-face" src={url} alt="" loading="lazy" onError={() => setBad(true)} /> : <div className="pc3-face svg"><FaceArt p={p} team={t} size={W} /></div>}
        </div>
        <div className="pc3-top">
          {!hideOvr && <b className="pc3-ovr">{p.ovr}</b>}
          <span className="pc3-pos">{p.pos}</span>
          {t && <Logo team={t} size={W * 0.16} />}
        </div>
        {p.dev !== 'Normal' && <span className={`pc3-dev ${p.dev.replace(/\W/g, '')}`} title={p.dev}>{p.dev === 'X-Factor' ? 'XF' : p.dev === 'Superstar' ? 'SS' : '★'}</span>}
        <div className="pc3-plate">
          {label && <div className="pc3-label">{label}</div>}
          <div className="pc3-fn">{p.fn}</div>
          <div className="pc3-ln">{p.ln}</div>
          {size !== 'sm' && <div className="pc3-attrs">{keyAttrs(p).map(k => <div key={k} title={ATTR_NAME[k]}><b>{p.attrs[k]}</b><span>{k}</span></div>)}</div>}
        </div>
        <i className="pc3-foil" />
        <i className="pc3-glint" />
      </div>
    </div>
  );
}
