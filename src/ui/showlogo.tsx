// Show badges for the prime-time windows, in the style of modern network packages: a
// beveled metal shield, a stacked heavy wordmark ("THURSDAY / NIGHT / FOOTBALL"), and a
// band carrying the game's own network (GGN) and a football emblem. No real league or
// network marks are used. SVG: lit metal rims, recessed faces, chrome lettering.
import type { CSSProperties, ReactNode } from 'react';

type Mark = 'TNF' | 'SNF' | 'MNF';
export const showMark = (show: string): Mark | undefined => (/^Thursday Night/.test(show) ? 'TNF' : /^Sunday Night/.test(show) ? 'SNF' : /^Monday Night/.test(show) ? 'MNF' : undefined);

const SHIELD = 'M36 22 Q36 6 52 6 L348 6 Q364 6 364 22 L364 246 Q364 332 200 436 Q36 332 36 246 Z';
const FACE = 'M54 30 Q54 22 62 22 L338 22 Q346 22 346 30 L346 244 Q346 318 200 412 Q54 318 54 244 Z';
const HEAD = 'var(--head), "Arial Narrow", Impact, sans-serif';

/** A football: full, rounded body with tips, seams, white stripes and thick laces. */
const Ball = ({ x, y, s = 1, id }: { x: number; y: number; s?: number; id: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s}) rotate(-24)`}>
    <path d="M-30 0 C-24 -21 24 -21 30 0 C24 21 -24 21 -30 0 Z" fill={`url(#${id}-ball)`} stroke="#0b0d12" strokeWidth="2.6" strokeLinejoin="round" />
    <path d="M-26 -5 C-18 -17 18 -17 26 -5" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="2" />
    <path d="M-19 -13 C-22 -4 -22 4 -19 13 M19 -13 C22 -4 22 4 19 13" fill="none" stroke="#fff" strokeWidth="3.4" />
    <path d="M-19 -13 C-22 -4 -22 4 -19 13 M19 -13 C22 -4 22 4 19 13" fill="none" stroke="#0b0d12" strokeOpacity=".35" strokeWidth="1" transform="translate(1.6 0)" />
    <path d="M-10 0 L10 0" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    {[-6.5, -2.2, 2.2, 6.5].map(v => <path key={v} d={`M${v} -4.5 L${v} 4.5`} stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />)}
  </g>
);
/** Each show's (fictional) network: NOVA+ streams Thursdays, CROWN has Sundays, BLITZ has Mondays. */
const Net = ({ name, x, y, size = 40, fill, sub }: { name: string; x: number; y: number; size?: number; fill: string; sub?: string }) => (
  <g>
    <text x={x} y={y} textAnchor="middle" fontFamily={HEAD} fontWeight={800} fontStyle="italic" fontSize={size} letterSpacing={1} fill={fill} stroke="#0b0d12" strokeWidth={size / 14} paintOrder="stroke" textLength={size * 0.56 * name.length} lengthAdjust="spacingAndGlyphs">{name}</text>
    {sub && <text x={x} y={y + size * 0.55} textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontWeight={700} fontSize={size * 0.24} letterSpacing={size * 0.16} fill="#fff" opacity=".85">{sub}</text>}
  </g>
);
/** The stacked wordmark: chrome face, dark outline, bevel highlight; each word fitted to width. */
function Stack({ id, words, y0, size, gap, max, x = 200 }: { id: string; words: string[]; y0: number; size: number; gap: number; max: number; x?: number }) {
  const fit = (w: string) => Math.min(max, w.length * size * 0.5);
  const T = (w: string, i: number, p: Record<string, unknown>) => (
    <text x={x} y={y0 + i * gap} textAnchor="middle" fontFamily={HEAD} fontWeight={800} fontStyle="italic" fontSize={size} textLength={fit(w)} lengthAdjust="spacingAndGlyphs" {...p}>{w}</text>
  );
  return <>{words.map((w, i) => (
    <g key={w}>
      {T(w, i, { fill: '#000', opacity: 0.5, transform: 'translate(3 5)', filter: `url(#${id}-blur)` })}
      {T(w, i, { fill: `url(#${id}-chrome)`, stroke: '#0b0d12', strokeWidth: size / 11, paintOrder: 'stroke', strokeLinejoin: 'round' })}
      {T(w, i, { fill: 'none', stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 0.9, transform: 'translate(0 -1)' })}
    </g>
  ))}</>;
}

/** Shared frame: drop shadow, metal rim, recessed lit face, texture, gloss and light sweep. */
function Badge({ id, rim, face, children, over }: { id: string; rim: [string, string, string]; face: [string, string]; children: ReactNode; over?: ReactNode }) {
  return (
    <svg viewBox="0 0 400 448" width="100%" role="img" aria-label={id}>
      <defs>
        <filter id={`${id}-drop`} x="-20%" y="-10%" width="140%" height="130%"><feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#000" floodOpacity=".55" /></filter>
        <filter id={`${id}-blur`}><feGaussianBlur stdDeviation="2.2" /></filter>
        <filter id={`${id}-inset`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="7" result="b" /><feOffset dy="6" result="o" />
          <feComposite in="o" in2="SourceAlpha" operator="out" result="ring" /><feFlood floodColor="#000" floodOpacity=".65" />
          <feComposite in2="ring" operator="in" result="shadow" /><feComposite in="shadow" in2="SourceAlpha" operator="in" />
        </filter>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={rim[0]} /><stop offset=".45" stopColor={rim[1]} /><stop offset=".7" stopColor={rim[2]} /><stop offset="1" stopColor={rim[1]} /></linearGradient>
        <radialGradient id={`${id}-face`} cx=".3" cy=".18" r="1"><stop offset="0" stopColor={face[0]} /><stop offset=".75" stopColor={face[1]} /><stop offset="1" stopColor="#000" /></radialGradient>
        <linearGradient id={`${id}-chrome`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset=".5" stopColor="#e8ecf2" /><stop offset=".56" stopColor="#a7b0be" /><stop offset=".8" stopColor="#dfe4eb" /><stop offset="1" stopColor="#ffffff" /></linearGradient>
        <linearGradient id={`${id}-ball`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset=".55" stopColor="#d9dee6" /><stop offset="1" stopColor="#9aa3b2" /></linearGradient>
        <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".2" /><stop offset=".4" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".45" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <pattern id={`${id}-pin`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="1" height="6" fill="#fff" opacity=".035" /></pattern>
        <clipPath id={`${id}-clip`}><path d={SHIELD} /></clipPath>
        <clipPath id={`${id}-fclip`}><path d={FACE} /></clipPath>
      </defs>
      <g filter={`url(#${id}-drop)`}>
        <path d={SHIELD} fill={`url(#${id}-rim)`} />
        <path d={SHIELD} fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="1.5" transform="translate(0 1)" />
        <path d={FACE} fill={`url(#${id}-face)`} />
        <path d={FACE} fill={`url(#${id}-pin)`} />
        <g clipPath={`url(#${id}-fclip)`}>{children}</g>
        <path d={FACE} fill="#000" filter={`url(#${id}-inset)`} />
        <path d={FACE} fill="none" stroke="#000" strokeOpacity=".55" strokeWidth="2" />
        {over}
      </g>
      <g clipPath={`url(#${id}-clip)`}>
        <path d={SHIELD} fill={`url(#${id}-gloss)`} />
        <rect className="sl-shine" x="-240" y="0" width="110" height="448" fill={`url(#${id}-shine)`} transform="skewX(-18)" />
      </g>
    </svg>
  );
}

function TNF() {
  const id = 'sl-tnf';
  return <Badge id={id} rim={['#f4f8ff', '#9fb4d8', '#4b5b78']} face={['#3d8bff', '#0b2a8a']}>
    <defs><linearGradient id={`${id}-band`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#1a5bff" /><stop offset="1" stopColor="#4a9bff" /></linearGradient></defs>
    <path d="M54 22 L346 22 L346 128 L54 128 Z" fill={`url(#${id}-band)`} />
    <path d="M54 22 L346 22 L346 128 L54 128 Z" fill={`url(#${id}-pin)`} />
    <path d="M146 22 L168 22 L146 128 L124 128 Z" fill={`url(#${id}-chrome)`} />
    <rect x="54" y="128" width="292" height="6" fill={`url(#${id}-chrome)`} /><rect x="54" y="134" width="292" height="2" fill="#000" opacity=".4" />
    <Ball x={92} y={76} s={1.1} id={id} />
    <Net name="NOVA+" x={256} y={84} size={44} fill={`url(#${id}-chrome)`} sub="STREAMING" />
    <Stack id={id} words={['THURSDAY', 'NIGHT', 'FOOTBALL']} y0={198} size={56} gap={56} max={240} />
  </Badge>;
}

function MNF() {
  const id = 'sl-mnf';
  return <Badge id={id} rim={['#ff8a95', '#d6293d', '#6e0d18']} face={['#2a3440', '#07090c']} over={<>
    <g transform="translate(0 4)">
      <path d="M22 124 L378 124 L366 152 L378 180 L366 208 L378 236 L22 236 L34 208 L22 180 L34 152 Z" fill={`url(#${id}-banner)`} />
      <path d="M22 124 L378 124 L358 129 L42 129 Z" fill="#fff" opacity=".22" />
      <path d="M22 236 L378 236 L376 231 L24 231 Z" fill="#000" opacity=".35" />
    </g>
    <Stack id={id} words={['MONDAY', 'NIGHT', 'FOOTBALL']} y0={166} size={40} gap={36} max={244} />
  </>}>
    <defs><linearGradient id={`${id}-banner`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a5064" /><stop offset=".5" stopColor="#24384a" /><stop offset="1" stopColor="#152330" /></linearGradient></defs>
    <path d="M66 34 L334 34 L334 244 Q334 308 200 392 Q66 308 66 244 Z" fill="none" stroke="#3d556b" strokeWidth="3" />
    <Net name="BLITZ" x={200} y={94} size={50} fill={`url(#${id}-chrome)`} />

    <Ball x={200} y={316} s={1.45} id={id} />
  </Badge>;
}

function SNF() {
  const id = 'sl-snf';
  return <Badge id={id} rim={['#fff4c4', '#e2b23f', '#7a540d']} face={['#1d4f9e', '#04102a']}>
    <defs><linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff4c4" /><stop offset=".5" stopColor="#e2b23f" /><stop offset="1" stopColor="#a3730f" /></linearGradient></defs>
    {[110, 155, 200, 245, 290].map((x, i) => (
      <path key={x} transform={`translate(${x} ${66 - (i === 2 ? 6 : i % 2 ? 2 : 0)}) scale(${i === 2 ? 1.35 : 1})`} d="M0 -12 L3.5 -3.7 L12 -3.7 L5.2 1.6 L7.6 10 L0 5 L-7.6 10 L-5.2 1.6 L-12 -3.7 L-3.5 -3.7 Z" fill={`url(#${id}-gold)`} stroke="#0b0d12" strokeWidth="1.2" />
    ))}
    <Stack id={id} words={['SUNDAY', 'NIGHT', 'FOOTBALL']} y0={160} size={60} gap={62} max={246} />
    <rect x="112" y="300" width="176" height="3" fill={`url(#${id}-gold)`} />
    <Net name="CROWN" x={200} y={350} size={40} fill={`url(#${id}-gold)`} />
  </Badge>;
}

export function ShowLogo({ mark, size = 360, animate = true }: { mark: Mark; size?: number; animate?: boolean }) {
  return (
    <div className={`sl${animate ? ' anim' : ''}`} style={{ width: size, '--a': mark === 'TNF' ? '#2f7bff' : mark === 'MNF' ? '#d6293d' : '#e2b23f' } as CSSProperties}>
      {mark === 'TNF' ? <TNF /> : mark === 'MNF' ? <MNF /> : <SNF />}
    </div>
  );
}
