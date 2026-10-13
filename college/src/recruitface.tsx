// Recruit portraits: an illustrated look of their own, deliberately unlike the pro game's faces.
// Every prospect is drawn from his seed (skin tone, head shape, hair, brows, eyes, nose, mouth,
// accessories) wearing his high school's practice shirt, on a two-tone backdrop in its colours.
import { memo } from 'react';

const SKIN = [['#f3d2b6', '#d9ad8c'], ['#e4b48f', '#c48f6a'], ['#c98f63', '#a46d45'], ['#a8704a', '#83532f'], ['#80502f', '#5f3a20'], ['#5e3a22', '#432815']];
const HAIR = ['#14100d', '#1f1610', '#2c1c12', '#3d2716', '#5a3a1e', '#7a5530', '#b98a4e', '#d8b46e'];
const HS = [['#0b2a5b', '#f2b705'], ['#7a0f1f', '#ffffff'], ['#0d4d2a', '#e8e8e8'], ['#3b1a68', '#f5c400'], ['#111111', '#d42027'], ['#0f5fa8', '#ffffff'], ['#c2410c', '#111111'], ['#4b5563', '#facc15'], ['#14532d', '#fbbf24'], ['#1e3a8a', '#ef4444']];
const h32 = (s: string) => { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return x >>> 0; };

interface Look { skin: string[]; hair: string; hairStyle: number; jaw: number; brow: number; eye: number; nose: number; mouth: number; fuzz: boolean; band: boolean; chain: boolean; hs: string[]; ear: boolean; tilt: number }
function look(seed: string): Look {
  let s = h32(seed); const r = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0) / 4294967296);
  const skinI = Math.floor(r() * SKIN.length);
  const dark = skinI >= 3;
  return {
    skin: SKIN[skinI], hair: HAIR[Math.floor(r() * (dark ? 3 : HAIR.length))], hairStyle: Math.floor(r() * 9),
    jaw: r(), brow: r(), eye: r(), nose: r(), mouth: Math.floor(r() * 4), fuzz: r() < 0.22, band: r() < 0.14, chain: r() < 0.2,
    hs: HS[Math.floor(r() * HS.length)], ear: r() < 0.12, tilt: (r() - 0.5) * 6,
  };
}

/** Hair drawn over the head; styles from a skin fade to locs. */
function Hair({ L }: { L: Look }) {
  const c = L.hair;
  switch (L.hairStyle) {
    case 0: return <path d="M30 44 C30 24 44 16 60 16 C76 16 90 24 90 44 C86 36 76 31 60 31 C44 31 34 36 30 44Z" fill={c} />;                          // short crop
    case 1: return <><path d="M29 46 C27 20 46 12 60 12 C76 12 93 20 91 46 C88 33 78 27 60 27 C42 27 32 33 29 46Z" fill={c} /><path d="M31 47 L31 40 M89 47 L89 40" stroke={c} strokeWidth="3" opacity=".5" /></>; // high top fade
    case 2: return <g fill={c}>{Array.from({ length: 13 }, (_, i) => <circle key={i} cx={34 + i * 4.3} cy={24 + Math.abs(6 - i) * 1.4} r="5.4" />)}<path d="M30 44 C30 28 44 22 60 22 C76 22 90 28 90 44 C85 36 75 32 60 32 C45 32 35 36 30 44Z" /></g>;          // twists
    case 3: return <path d="M24 50 C18 18 42 4 60 4 C80 4 102 18 96 50 C92 34 80 26 60 26 C40 26 28 34 24 50Z" fill={c} />;                          // big afro top
    case 4: return <g fill={c}><path d="M30 44 C30 24 44 17 60 17 C76 17 90 24 90 44 C85 35 75 31 60 31 C45 31 35 35 30 44Z" />{[38, 46, 54, 62, 70, 78].map(x => <path key={x} d={`M${x} 20 L${x + 2} 33`} stroke="#000" strokeOpacity=".25" strokeWidth="1.6" />)}</g>; // cornrows
    case 5: return <g fill={c}><path d="M28 48 C26 22 44 13 60 13 C78 13 94 22 92 48 C88 34 78 29 60 29 C42 29 32 34 28 48Z" />{[30, 36, 84, 90].map(x => <rect key={x} x={x - 2.5} y="40" width="5" height="26" rx="2.5" />)}</g>;      // locs
    case 6: return <path d="M30 42 C32 22 46 15 62 16 C80 17 92 28 88 44 C82 30 70 26 56 30 C46 33 38 36 30 42Z" fill={c} />;                         // side part
    case 7: return <path d="M31 42 C31 26 44 19 60 19 C76 19 89 26 89 42 C84 36 74 33 60 33 C46 33 36 36 31 42Z" fill={c} opacity=".85" />;           // buzz
    default: return <g fill={c}><path d="M29 46 C27 24 42 12 60 13 C80 14 94 26 90 46 C84 32 74 26 60 28 C46 29 34 34 29 46Z" />{[40, 52, 64, 76].map(x => <circle key={x} cx={x} cy={18} r="6" />)}</g>; // curly top
  }
}

/** The portrait: head, features, shirt and backdrop, all vector. */
export const RecruitPortrait = memo(function RecruitPortrait({ seed, size, pos }: { seed: string; size: number; pos?: string }) {
  const L = look(seed), [sk, sh] = L.skin, [h1, h2] = L.hs;
  const id = `rp${h32(seed) % 1e9}`;
  const jawW = 26 + L.jaw * 5, chinY = 86 + L.jaw * 4;
  const eyeY = 58, eyeDX = 11.5 + L.eye * 1.5, eyeH = 2.6 + L.eye * 1.6;
  const browW = 2.2 + L.brow * 2.2;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className="rport" aria-hidden>
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={h1} /><stop offset="1" stopColor={h1} stopOpacity=".65" /></linearGradient>
        <radialGradient id={`${id}f`} cx=".42" cy=".38" r=".75"><stop offset="0" stopColor={sk} /><stop offset="1" stopColor={sh} /></radialGradient>
        <clipPath id={`${id}c`}><rect width="120" height="120" rx="20" /></clipPath>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        <rect width="120" height="120" fill={`url(#${id}b)`} />
        <path d="M0 120 L0 78 L120 28 L120 120Z" fill={h2} opacity=".22" />
        {pos && <text x="112" y="24" textAnchor="end" fontSize="20" fontWeight="900" fill={h2} opacity=".55" fontFamily="'Barlow Condensed', Impact, sans-serif">{pos}</text>}
        <g transform={`translate(60 74) scale(1.12) translate(-60 -70) rotate(${L.tilt} 60 70)`}>
          {/* shirt and neck */}
          <path d="M14 122 C16 100 34 92 60 92 C86 92 104 100 106 122Z" fill={h1} stroke={h2} strokeWidth="3" />
          <path d="M44 93 Q60 104 76 93" fill="none" stroke={h2} strokeWidth="4" />
          <path d="M48 80 L48 95 Q60 101 72 95 L72 80Z" fill={sh} />
          {L.chain && <path d="M46 95 Q60 106 74 95" fill="none" stroke="#e6c35c" strokeWidth="1.6" />}
          {/* ears */}
          <ellipse cx="32" cy="62" rx="5" ry="8" fill={sh} /><ellipse cx="88" cy="62" rx="5" ry="8" fill={sh} />
          {L.ear && <circle cx="31" cy="69" r="1.6" fill="#f5f5f5" />}
          {/* head */}
          <path d={`M33 50 C33 30 45 22 60 22 C75 22 87 30 87 50 C87 66 ${60 + jawW} 78 66 ${chinY} C63 ${chinY + 2} 57 ${chinY + 2} 54 ${chinY} C${60 - jawW} 78 33 66 33 50Z`} fill={`url(#${id}f)`} />
          <Hair L={L} />
          {L.band && <rect x="31" y="36" width="58" height="6" rx="3" fill={h2} />}
          {/* brows, eyes, nose, mouth */}
          <path d={`M${60 - eyeDX - 6} ${eyeY - 6} Q${60 - eyeDX} ${eyeY - 9} ${60 - eyeDX + 6} ${eyeY - 6.5}`} stroke={L.hair} strokeWidth={browW} fill="none" strokeLinecap="round" />
          <path d={`M${60 + eyeDX - 6} ${eyeY - 6.5} Q${60 + eyeDX} ${eyeY - 9} ${60 + eyeDX + 6} ${eyeY - 6}`} stroke={L.hair} strokeWidth={browW} fill="none" strokeLinecap="round" />
          {[-1, 1].map(sx => <g key={sx}><ellipse cx={60 + sx * eyeDX} cy={eyeY} rx="4.6" ry={eyeH} fill="#fbfbf7" /><circle cx={60 + sx * eyeDX} cy={eyeY + 0.2} r="2.5" fill="#2a1a10" /><circle cx={60 + sx * eyeDX + 0.9} cy={eyeY - 0.8} r=".8" fill="#fff" /></g>)}
          <path d={`M58 ${eyeY + 4} Q${56 - L.nose * 2} ${eyeY + 13} 57 ${eyeY + 15} Q60 ${eyeY + 17} 63 ${eyeY + 15}`} fill="none" stroke={sh} strokeWidth="2" strokeLinecap="round" />
          {L.mouth === 0 && <path d="M52 79 Q60 83 68 79" fill="none" stroke="#6b3424" strokeWidth="2.2" strokeLinecap="round" />}
          {L.mouth === 1 && <path d="M51 78 Q60 86 69 78 Q60 81 51 78Z" fill="#fff" stroke="#6b3424" strokeWidth="1.6" />}
          {L.mouth === 2 && <path d="M53 80 L67 80" stroke="#6b3424" strokeWidth="2.2" strokeLinecap="round" />}
          {L.mouth === 3 && <path d="M52 80 Q61 82 68 77" fill="none" stroke="#6b3424" strokeWidth="2.2" strokeLinecap="round" />}
          {L.fuzz && <path d="M52 75 Q60 73 68 75" stroke={L.hair} strokeWidth="1.4" opacity=".55" fill="none" />}
          <path d="M40 66 Q44 72 50 70 M80 66 Q76 72 70 70" stroke={sh} strokeOpacity=".35" strokeWidth="2" fill="none" />
        </g>
      </g>
    </svg>
  );
});
