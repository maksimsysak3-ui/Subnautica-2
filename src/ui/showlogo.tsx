// Show badges for the prime-time windows, in the style of modern network packages: a
// beveled shield, a stacked heavy wordmark ("THURSDAY / NIGHT / FOOTBALL"), and a band
// carrying the game's own network (GGN) and a football emblem. No real league or network
// marks are used. SVG with gradients and a soft drop shadow for depth.
import type { CSSProperties, ReactNode } from 'react';

type Mark = 'TNF' | 'SNF' | 'MNF';
export const showMark = (show: string): Mark | undefined => (/^Thursday Night/.test(show) ? 'TNF' : /^Sunday Night/.test(show) ? 'SNF' : /^Monday Night/.test(show) ? 'MNF' : undefined);

const SHIELD = 'M40 20 Q40 8 52 8 L348 8 Q360 8 360 20 L360 250 Q360 330 200 432 Q40 330 40 250 Z';
const INNER = 'M58 26 L342 26 L342 248 Q342 318 200 408 Q58 318 58 248 Z';
const WORD = { fontFamily: 'var(--head), "Arial Narrow", Impact, sans-serif', fontWeight: 800, fontStyle: 'italic' as const };

/** A football emblem: laces and seams, no league mark. */
const Ball = ({ x, y, s = 1, c = '#fff' }: { x: number; y: number; s?: number; c?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s}) rotate(-30)`}>
    <ellipse rx="26" ry="15" fill={c} />
    <path d="M-15 0 L15 0" stroke="#000" strokeOpacity=".55" strokeWidth="2" />
    {[-9, -3, 3, 9].map(v => <path key={v} d={`M${v} -4 L${v} 4`} stroke="#000" strokeOpacity=".55" strokeWidth="2" />)}
  </g>
);
/** GGN network mark. */
const Net = ({ x, y, c = '#fff', size = 30 }: { x: number; y: number; c?: string; size?: number }) => (
  <text x={x} y={y} textAnchor="middle" style={{ fontFamily: 'var(--head), Impact, sans-serif', fontWeight: 800, fontStyle: 'italic' }} fontSize={size} letterSpacing={2} fill={c}>GGN</text>
);
/** The stacked wordmark with a silver face and a dark offset for depth. */
function Stack({ words, y0, size, gap, fill, x = 200, max = 270 }: { words: string[]; y0: number; size: number; gap: number; fill: string; x?: number; max?: number }) {
  // Each word is fitted to a width (whatever font loads), so nothing spills past the shield.
  const fit = (w: string) => Math.min(max, w.length * size * 0.5);
  return <>{words.map((w, i) => (
    <g key={w}>
      <text x={x + 3} y={y0 + i * gap + 4} textAnchor="middle" style={WORD} fontSize={size} fill="#000" opacity=".45" textLength={fit(w)} lengthAdjust="spacingAndGlyphs">{w}</text>
      <text x={x} y={y0 + i * gap} textAnchor="middle" style={WORD} fontSize={size} fill={fill} textLength={fit(w)} lengthAdjust="spacingAndGlyphs">{w}</text>
    </g>
  ))}</>;
}

function Badge({ id, children }: { id: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 400 440" width="100%" role="img" aria-label={id}>
      <defs>
        <linearGradient id={`${id}-silver`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset=".55" stopColor="#e6eaf0" /><stop offset=".6" stopColor="#b8c0cc" /><stop offset="1" stopColor="#f3f5f8" /></linearGradient>
        <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".22" /><stop offset=".45" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".55" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <clipPath id={`${id}-clip`}><path d={SHIELD} /></clipPath>
      </defs>
      {children}
      {/* Gloss and a light sweep across the whole badge. */}
      <g clipPath={`url(#${id}-clip)`}>
        <path d={SHIELD} fill={`url(#${id}-gloss)`} />
        <rect className="sl-shine" x="-220" y="0" width="120" height="440" fill={`url(#${id}-shine)`} transform="skewX(-18)" />
      </g>
    </svg>
  );
}

function TNF() {
  const id = 'sl-tnf';
  return <Badge id={id}>
    <defs>
      <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2f7bff" /><stop offset=".55" stopColor="#1442c9" /><stop offset="1" stopColor="#0a1f7a" /></linearGradient>
      <linearGradient id={`${id}-band`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#1c5cff" /><stop offset="1" stopColor="#3b8bff" /></linearGradient>
    </defs>
    <path d={SHIELD} fill={`url(#${id}-body)`} />
    <path d="M40 20 Q40 8 52 8 L348 8 Q360 8 360 20 L360 122 L40 122 Z" fill={`url(#${id}-band)`} />
    <path d="M150 8 L172 8 L150 122 L128 122 Z" fill="#fff" opacity=".9" />
    <rect x="40" y="122" width="320" height="5" fill="#fff" opacity=".9" />
    <Ball x={90} y={66} s={0.95} />
    <Net x={262} y={78} size={44} />
    <text x="262" y="102" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontWeight={600} fontSize={12} letterSpacing={6} fill="#dbe6ff">SPORTS</text>
    <Stack words={['THURSDAY', 'NIGHT', 'FOOTBALL']} y0={200} size={62} gap={64} fill={`url(#${id}-silver)`} max={262} />
  </Badge>;
}

function MNF() {
  const id = 'sl-mnf';
  return <Badge id={id}>
    <defs><linearGradient id={`${id}-banner`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2c3e4f" /><stop offset="1" stopColor="#1b2833" /></linearGradient></defs>
    <path d={SHIELD} fill="#d6293d" />
    <path d="M50 30 Q50 18 62 18 L338 18 Q350 18 350 30 L350 248 Q350 322 200 418 Q50 322 50 248 Z" fill="#0d1216" />
    <path d={INNER} fill="none" stroke="#2c3e4f" strokeWidth="4" transform="translate(0 8)" />
    <Net x={200} y={88} size={50} />
    {/* Notched banner across the middle. */}
    <path d="M28 120 L372 120 L360 150 L372 180 L360 210 L372 240 L28 240 L40 210 L28 180 L40 150 Z" fill={`url(#${id}-banner)`} stroke="#3d556b" strokeWidth="2" />
    <Stack words={['MONDAY', 'NIGHT', 'FOOTBALL']} y0={160} size={40} gap={37} fill={`url(#${id}-silver)`} max={250} />
    <Ball x={200} y={318} s={1.3} c="#e8ecf2" />
  </Badge>;
}

function SNF() {
  const id = 'sl-snf';
  return <Badge id={id}>
    <defs>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff1b8" /><stop offset=".45" stopColor="#e2b23f" /><stop offset="1" stopColor="#9a6d12" /></linearGradient>
      <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#123a7a" /><stop offset="1" stopColor="#06142e" /></linearGradient>
    </defs>
    <path d={SHIELD} fill={`url(#${id}-gold)`} />
    <path d="M52 30 Q52 20 62 20 L338 20 Q348 20 348 30 L348 248 Q348 320 200 416 Q52 320 52 248 Z" fill={`url(#${id}-body)`} />
    {/* A row of stars across the top. */}
    {[110, 155, 200, 245, 290].map((x, i) => <path key={x} transform={`translate(${x} ${62 - (i === 2 ? 6 : i % 2 ? 2 : 0)}) scale(${i === 2 ? 1.3 : 1})`} d="M0 -12 L3.5 -3.7 L12 -3.7 L5.2 1.6 L7.6 10 L0 5 L-7.6 10 L-5.2 1.6 L-12 -3.7 L-3.5 -3.7 Z" fill={`url(#${id}-gold)`} />)}
    <Stack words={['SUNDAY', 'NIGHT', 'FOOTBALL']} y0={156} size={60} gap={62} fill={`url(#${id}-silver)`} max={250} />
    <rect x="110" y="300" width="180" height="2" fill={`url(#${id}-gold)`} />
    <Net x={200} y={348} size={40} c="#e2b23f" />
  </Badge>;
}

export function ShowLogo({ mark, size = 360, animate = true }: { mark: Mark; size?: number; animate?: boolean }) {
  return (
    <div className={`sl${animate ? ' anim' : ''}`} style={{ width: size, '--a': mark === 'TNF' ? '#2f7bff' : mark === 'MNF' ? '#d6293d' : '#e2b23f' } as CSSProperties}>
      {mark === 'TNF' ? <TNF /> : mark === 'MNF' ? <MNF /> : <SNF />}
    </div>
  );
}
