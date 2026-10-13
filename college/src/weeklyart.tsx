// Artwork for the weekly decision cards: a painted vector scene per kind of decision, in the
// school's colours, set in a pennant-shaped panel (the pixel look stays in the pop-ups).
import { memo } from 'react';

const Stadium = ({ c }: { c: string }) => (
  <g opacity=".5">
    <path d="M0 112 C60 86 260 86 320 112 L320 150 L0 150Z" fill="#000" opacity=".35" />
    <path d="M0 118 C70 98 250 98 320 118" stroke={c} strokeWidth="3" fill="none" opacity=".6" />
    {Array.from({ length: 9 }, (_, i) => <rect key={i} x={18 + i * 34} y={70 - Math.abs(4 - i) * 3} width="3" height={34 + Math.abs(4 - i) * 3} fill="#000" opacity=".3" />)}
  </g>
);

function Subject({ kind, c, d }: { kind: string; c: string; d: string }) {
  switch (kind) {
    case 'helmet': return (
      <g transform="translate(110 22)">
        <path d="M10 70 C4 30 40 4 78 6 C112 8 128 34 124 62 L112 64 L106 88 L64 92 C34 94 14 88 10 70Z" fill={c} stroke="#0b0d12" strokeWidth="3" />
        <path d="M30 14 C52 4 88 4 110 26" stroke={d} strokeWidth="8" fill="none" />
        <path d="M104 50 L146 50 M104 64 L148 64 M108 78 L146 78 M118 46 L118 90 M136 46 L136 88" stroke="#d9dde4" strokeWidth="4" strokeLinecap="round" />
        <circle cx="60" cy="54" r="10" fill="#0b0d12" opacity=".75" />
        <path d="M24 36 C34 22 52 16 70 16" stroke="#fff" strokeOpacity=".35" strokeWidth="5" fill="none" strokeLinecap="round" />
      </g>);
    case 'chat': return (
      <g transform="translate(96 18)">
        <path d="M30 30 L70 18 L100 18 L140 30 L134 112 L36 112Z" fill={c} stroke="#0b0d12" strokeWidth="3" />
        <path d="M70 18 Q85 34 100 18" fill="none" stroke={d} strokeWidth="5" />
        <rect x="88" y="44" width="34" height="38" rx="6" fill={d} stroke="#0b0d12" strokeWidth="3" />
        <text x="105" y="74" textAnchor="middle" fontSize="30" fontWeight="900" fill={c} fontFamily="'Barlow Condensed', Impact, sans-serif">C</text>
        <path d="M30 30 L6 60 L22 72 L36 56 M140 30 L164 60 L148 72 L134 56" fill={c} stroke="#0b0d12" strokeWidth="3" />
      </g>);
    case 'whistle': return (
      <g transform="translate(90 26)">
        <path d="M40 40 L110 40 L110 22 L130 22 L130 46 C130 74 108 92 80 92 C52 92 30 74 30 56 C30 46 34 40 40 40Z" fill="#d9dde4" stroke="#0b0d12" strokeWidth="3" />
        <circle cx="80" cy="64" r="12" fill="#0b0d12" opacity=".7" />
        <path d="M30 56 C10 50 -2 30 10 12" stroke={c} strokeWidth="6" fill="none" />
        <g transform="translate(150 14)"><circle cx="34" cy="44" r="34" fill="#fff" stroke="#0b0d12" strokeWidth="3" /><circle cx="34" cy="44" r="27" fill="none" stroke={c} strokeWidth="4" /><path d="M34 44 L34 24 M34 44 L48 52" stroke="#0b0d12" strokeWidth="4" strokeLinecap="round" /><rect x="27" y="0" width="14" height="10" rx="3" fill="#0b0d12" /></g>
      </g>);
    case 'house': return (
      <g transform="translate(70 20)">
        <path d="M20 60 L90 10 L160 60" fill="none" stroke="#0b0d12" strokeWidth="4" />
        <path d="M30 56 L90 14 L150 56 L150 118 L30 118Z" fill="#f3efe4" stroke="#0b0d12" strokeWidth="3" />
        <path d="M24 60 L90 12 L156 60 L148 64 L90 22 L32 64Z" fill={c} />
        <rect x="76" y="76" width="28" height="42" fill={c} stroke="#0b0d12" strokeWidth="3" /><circle cx="98" cy="98" r="2.5" fill="#0b0d12" />
        <rect x="42" y="74" width="24" height="20" fill="#9cc7f0" stroke="#0b0d12" strokeWidth="3" /><rect x="114" y="74" width="24" height="20" fill="#ffd56a" stroke="#0b0d12" strokeWidth="3" />
        <g transform="translate(170 50)"><circle cx="16" cy="12" r="11" fill="#7b4b31" /><path d="M0 70 L2 34 C4 26 28 26 30 34 L32 70Z" fill={d} stroke="#0b0d12" strokeWidth="3" /><text x="16" y="56" textAnchor="middle" fontSize="16" fontWeight="900" fill={c} fontFamily="'Barlow Condensed', Impact, sans-serif">5★</text></g>
      </g>);
    case 'phone': return (
      <g transform="translate(118 10)">
        <rect x="0" y="0" width="84" height="132" rx="14" fill="#0b0d12" /><rect x="6" y="12" width="72" height="108" rx="6" fill="#f3f4f7" />
        <rect x="12" y="22" width="48" height="18" rx="8" fill="#d9dde4" /><rect x="24" y="46" width="48" height="18" rx="8" fill={c} /><rect x="12" y="70" width="40" height="18" rx="8" fill="#d9dde4" />
        <rect x="30" y="94" width="42" height="18" rx="8" fill={c} /><circle cx="42" cy="6" r="2" fill="#333" />
        <g transform="translate(96 30)"><circle cx="18" cy="18" r="18" fill={d} stroke="#0b0d12" strokeWidth="3" /><text x="18" y="25" textAnchor="middle" fontSize="20" fontWeight="900" fill={c} fontFamily="'Barlow Condensed', Impact, sans-serif">!</text></g>
      </g>);
    case 'mic': return (
      <g transform="translate(86 20)">
        <path d="M30 70 L120 70 L112 124 L38 124Z" fill={c} stroke="#0b0d12" strokeWidth="3" />
        <rect x="52" y="86" width="46" height="22" rx="4" fill={d} />
        {[44, 66, 88, 108].map((x, i) => <g key={x}><path d={`M${x} 70 L${75 + (i - 1.5) * 6} 40`} stroke="#0b0d12" strokeWidth="3" /><rect x={x - 7} y={18 + (i % 2) * 6} width="14" height="24" rx="7" fill={['#d83a3a', '#2f6fdf', '#f5c443', '#3fa34d'][i]} stroke="#0b0d12" strokeWidth="2.5" /></g>)}
        <g transform="translate(150 50)"><rect x="0" y="0" width="56" height="38" rx="5" fill="#0b0d12" /><circle cx="28" cy="19" r="12" fill="#333" stroke="#9aa3b2" strokeWidth="3" /><rect x="44" y="-8" width="8" height="8" fill="#d83a3a" /></g>
      </g>);
    case 'bag': return (
      <g transform="translate(98 18)">
        <path d="M44 40 C10 60 6 116 60 120 L100 120 C154 116 150 60 116 40Z" fill="#c9a24a" stroke="#0b0d12" strokeWidth="3" />
        <path d="M50 40 L60 18 L100 18 L110 40Z" fill="#b38a34" stroke="#0b0d12" strokeWidth="3" /><path d="M48 40 L112 40" stroke={c} strokeWidth="7" />
        <text x="80" y="98" textAnchor="middle" fontSize="44" fontWeight="900" fill="#0b0d12" opacity=".8" fontFamily="'Barlow Condensed', Impact, sans-serif">$</text>
        <g transform="translate(150 70)"><ellipse cx="22" cy="40" rx="22" ry="7" fill="#c9a24a" stroke="#0b0d12" strokeWidth="2" /><ellipse cx="22" cy="32" rx="22" ry="7" fill="#d8b45a" stroke="#0b0d12" strokeWidth="2" /><ellipse cx="22" cy="24" rx="22" ry="7" fill="#e6c35c" stroke="#0b0d12" strokeWidth="2" /></g>
      </g>);
    case 'trophy': return (
      <g transform="translate(110 14)">
        <path d="M30 10 L110 10 L106 50 C102 76 86 88 70 88 C54 88 38 76 34 50Z" fill="#f5c443" stroke="#0b0d12" strokeWidth="3" />
        <path d="M30 18 C4 18 4 56 36 60 M110 18 C136 18 136 56 104 60" fill="none" stroke="#f5c443" strokeWidth="7" />
        <rect x="60" y="88" width="20" height="18" fill="#e0b23a" stroke="#0b0d12" strokeWidth="3" /><rect x="40" y="106" width="60" height="22" rx="3" fill={c} stroke="#0b0d12" strokeWidth="3" />
        <path d="M46 20 C46 46 56 66 66 74" stroke="#fff" strokeOpacity=".45" strokeWidth="6" fill="none" strokeLinecap="round" />
      </g>);
    case 'book': return (
      <g transform="translate(92 24)">
        <path d="M10 40 L76 52 L76 122 L10 110Z" fill="#f3efe4" stroke="#0b0d12" strokeWidth="3" /><path d="M142 40 L76 52 L76 122 L142 110Z" fill="#fbf8f0" stroke="#0b0d12" strokeWidth="3" />
        {[64, 76, 88].map(y => <g key={y}><path d={`M20 ${y - 8} L66 ${y}`} stroke="#9aa3b2" strokeWidth="2" /><path d={`M86 ${y} L132 ${y - 8}`} stroke="#9aa3b2" strokeWidth="2" /></g>)}
        <g transform="translate(40 -6)"><path d="M0 22 L36 6 L72 22 L36 38Z" fill="#0b0d12" /><path d="M14 28 L14 42 C24 50 48 50 58 42 L58 28" fill="#0b0d12" /><path d="M66 24 L66 46" stroke={c} strokeWidth="3" /><circle cx="66" cy="48" r="4" fill={c} /></g>
      </g>);
    default: return (
      <g transform="translate(100 34)">
        <ellipse cx="60" cy="40" rx="62" ry="36" fill="#8b4a22" stroke="#0b0d12" strokeWidth="3" />
        <path d="M14 40 L106 40" stroke="#fff" strokeWidth="3" />{[34, 46, 58, 70, 82].map(x => <path key={x} d={`M${x} 34 L${x} 46`} stroke="#fff" strokeWidth="3" />)}
        <path d="M2 40 C10 20 24 10 36 8 M118 40 C110 60 96 70 84 72" stroke="#fff" strokeOpacity=".7" strokeWidth="4" fill="none" />
        {[-20, 140].map(x => <path key={x} d={`M${x} 92 L${x + 10} 62 L${x + 20} 92Z`} fill="#ff7a1a" stroke="#0b0d12" strokeWidth="2" />)}
      </g>);
  }
}

/** The scene for a decision card. */
export const DecisionArt = memo(function DecisionArt({ kind, c, d, id }: { kind: string; c: string; d: string; id: string }) {
  return (
    <svg viewBox="0 0 320 150" className="wk-art" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`wa-${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c} /><stop offset="1" stopColor="#0b0d12" /></linearGradient>
        <radialGradient id={`wg-${id}`} cx=".5" cy=".55" r=".55"><stop offset="0" stopColor="#fff" stopOpacity=".28" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="320" height="150" fill={`url(#wa-${id})`} />
      <circle cx="160" cy="80" r="90" fill={`url(#wg-${id})`} />
      <Stadium c={d} />
      <Subject kind={kind} c={c} d={d} />
    </svg>
  );
});
