// Original illustrations for the college menus, all drawn in SVG/CSS and tinted with a
// school's colours: a mascot for the program's nickname (a generic animal, never a real
// team mark), a 3D field with painted end zone, pennants and a stadium skyline.
import type { CSSProperties } from 'react';
import type { School } from './data';
import { showColor } from './data';

type Kind = 'cat' | 'dog' | 'bird' | 'bear' | 'horn' | 'horse' | 'warrior' | 'shield';
export function mascotKind(m: string): Kind {
  const s = m.toLowerCase();
  if (/tiger|wildcat|panther|cougar|jaguar|bobcat|lion|bearcat/.test(s)) return 'cat';
  if (/bulldog|husk|dog|terrier|wolf|wolfpack|lobo|coyote|jackrabbit/.test(s)) return 'dog';
  if (/eagle|owl|hawk|falcon|duck|cardinal|jay|bird|gamecock|cock|raven|pelican|thunderbird|hen|mean green|ducks/.test(s)) return 'bird';
  if (/bear|bruin|grizzl|cub/.test(s)) return 'bear';
  if (/longhorn|bull|buffalo|ram|ox|steer|bison/.test(s)) return 'horn';
  if (/bronco|mustang|colt|stallion|horse|mule|aggie/.test(s)) return 'horse';
  if (/knight|warrior|trojan|spartan|viking|pirate|raider|rebel|cavalier|commodore|sooner|volunteer|seminole|minutem|patriot|midshipm|cadet|black knight|mountaineer|hokie|cowboy|gaucho/.test(s)) return 'warrior';
  return 'shield';
}

/** A mascot portrait in the school's colours. Original, generic artwork. */
export function Mascot({ s, size = 320, style }: { s: School; size?: number; style?: CSSProperties }) {
  const c1 = showColor(s), c2 = s.c2 && s.c2.toLowerCase() !== s.c1.toLowerCase() ? s.c2 : '#ffffff';
  const k = mascotKind(s.mascot);
  const id = `m${s.id}`;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} style={style} className="mascot">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c1} stopOpacity="1" /><stop offset="1" stopColor={c1} stopOpacity=".75" /></linearGradient>
        <radialGradient id={`${id}h`} cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#fff" stopOpacity=".35" /><stop offset=".6" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <filter id={`${id}s`} x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000" floodOpacity=".45" /></filter>
      </defs>
      <g filter={`url(#${id}s)`} stroke="#0b0d12" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
        {k === 'cat' && <>
          <path d="M40 70 L52 22 L84 52 Z M160 70 L148 22 L116 52 Z" fill={`url(#${id}g)`} />
          <path d="M50 36 L56 26 L72 46 Z M150 36 L144 26 L128 46 Z" fill={c2} strokeWidth="2" />
          <path d="M100 42 C140 42 168 70 166 110 C164 150 134 178 100 178 C66 178 36 150 34 110 C32 70 60 42 100 42 Z" fill={`url(#${id}g)`} />
          <path d="M100 118 C122 118 140 132 140 150 C140 166 122 176 100 176 C78 176 60 166 60 150 C60 132 78 118 100 118 Z" fill={c2} />
          <path d="M60 92 L88 100 L64 108 Z M140 92 L112 100 L136 108 Z" fill="#fff" />
          <path d="M70 100 L80 101 M130 100 L120 101" strokeWidth="5" />
          <path d="M90 126 L110 126 L100 138 Z" fill="#0b0d12" />
          <path d="M100 138 L100 148 M100 148 C92 156 84 154 80 150 M100 148 C108 156 116 154 120 150" fill="none" />
          <path d="M84 70 L92 84 M116 70 L108 84 M100 60 L100 80" strokeWidth="5" />
          <path d="M60 140 L30 134 M60 148 L28 152 M140 140 L170 134 M140 148 L172 152" strokeWidth="2.5" />
        </>}
        {k === 'dog' && <>
          <path d="M44 56 C24 60 20 96 34 118 C44 104 52 86 58 70 Z M156 56 C176 60 180 96 166 118 C156 104 148 86 142 70 Z" fill={c2} />
          <path d="M100 40 C146 40 162 74 160 108 C158 150 132 178 100 178 C68 178 42 150 40 108 C38 74 54 40 100 40 Z" fill={`url(#${id}g)`} />
          <path d="M58 132 C58 112 78 104 100 104 C122 104 142 112 142 132 C142 162 124 176 100 176 C76 176 58 162 58 132 Z" fill={c2} />
          <path d="M70 92 C74 84 84 84 88 92 M112 92 C116 84 126 84 130 92" fill="none" strokeWidth="5" />
          <ellipse cx="100" cy="118" rx="16" ry="11" fill="#0b0d12" />
          <path d="M72 148 C86 158 114 158 128 148" fill="none" />
          <path d="M80 148 L84 160 L90 150 M120 148 L116 160 L110 150" fill="#fff" strokeWidth="2.5" />
          <path d="M66 70 C80 64 90 66 96 74 M134 70 C120 64 110 66 104 74" fill="none" strokeWidth="5" />
        </>}
        {k === 'bird' && <>
          <path d="M44 66 C70 20 140 20 160 58 C178 92 164 136 134 150 L66 150 C40 134 30 96 44 66 Z" fill={`url(#${id}g)`} />
          <path d="M40 60 L18 40 L52 50 Z M60 40 L52 14 L78 34 Z" fill={c1} />
          <path d="M118 92 L182 110 L132 132 C120 124 112 108 118 92 Z" fill="#f5b70a" />
          <path d="M132 120 L176 112" strokeWidth="2.5" />
          <path d="M82 78 L118 88 L96 102 Z" fill="#fff" />
          <circle cx="102" cy="90" r="5" fill="#0b0d12" stroke="none" />
          <path d="M74 72 L124 84" strokeWidth="7" />
          <path d="M60 150 C70 170 130 172 140 150" fill={c2} />
        </>}
        {k === 'bear' && <>
          <circle cx="50" cy="56" r="24" fill={`url(#${id}g)`} /><circle cx="150" cy="56" r="24" fill={`url(#${id}g)`} />
          <circle cx="50" cy="56" r="11" fill={c2} strokeWidth="2.5" /><circle cx="150" cy="56" r="11" fill={c2} strokeWidth="2.5" />
          <path d="M100 42 C146 42 170 76 168 114 C166 154 136 178 100 178 C64 178 34 154 32 114 C30 76 54 42 100 42 Z" fill={`url(#${id}g)`} />
          <ellipse cx="100" cy="140" rx="38" ry="32" fill={c2} />
          <ellipse cx="100" cy="124" rx="15" ry="10" fill="#0b0d12" />
          <path d="M100 134 L100 146 C92 156 80 152 78 146 M100 146 C108 156 120 152 122 146" fill="none" />
          <path d="M66 92 L86 98 M134 92 L114 98" strokeWidth="6" />
          <path d="M62 80 L88 88 M138 80 L112 88" strokeWidth="5" />
        </>}
        {k === 'horn' && <>
          <path d="M60 70 C30 64 8 48 4 22 C24 42 46 46 70 50 Z M140 70 C170 64 192 48 196 22 C176 42 154 46 130 50 Z" fill="#f2ead8" />
          <path d="M100 44 C140 44 156 74 150 108 L136 160 C128 176 72 176 64 160 L50 108 C44 74 60 44 100 44 Z" fill={`url(#${id}g)`} />
          <path d="M72 140 C72 124 86 118 100 118 C114 118 128 124 128 140 C128 162 116 174 100 174 C84 174 72 162 72 140 Z" fill={c2} />
          <ellipse cx="88" cy="150" rx="5" ry="7" fill="#0b0d12" /><ellipse cx="112" cy="150" rx="5" ry="7" fill="#0b0d12" />
          <path d="M70 94 L90 100 M130 94 L110 100" strokeWidth="6" />
          <path d="M100 56 L100 104" fill="none" strokeWidth="3" />
        </>}
        {k === 'horse' && <>
          <path d="M70 40 L62 14 L86 32 Z M118 36 L124 10 L134 34 Z" fill={c1} />
          <path d="M84 30 C130 22 162 52 160 92 L150 150 C146 172 112 184 92 172 L56 148 C40 138 40 118 54 108 L74 92 C64 70 66 42 84 30 Z" fill={`url(#${id}g)`} />
          <path d="M84 30 C70 40 60 60 66 84 L50 70 C46 50 60 30 84 30 Z M120 26 C146 28 168 50 172 80 L158 74 C154 50 140 36 120 26 Z" fill={c2} />
          <ellipse cx="66" cy="146" rx="8" ry="6" fill="#0b0d12" />
          <path d="M104 78 L128 84 L110 94 Z" fill="#fff" /><circle cx="114" cy="86" r="4" fill="#0b0d12" stroke="none" />
        </>}
        {k === 'warrior' && <>
          <path d="M100 18 C144 18 170 50 170 92 L170 120 L150 120 L146 92 L54 92 L50 120 L30 120 L30 92 C30 50 56 18 100 18 Z" fill={`url(#${id}g)`} />
          <path d="M100 4 C112 20 112 40 100 52 C88 40 88 20 100 4 Z" fill={c2} />
          <path d="M96 0 L104 0 L106 30 L94 30 Z" fill={c2} strokeWidth="2" />
          <path d="M54 92 L146 92 L140 150 C130 176 70 176 60 150 Z" fill="#e8c9a6" />
          <path d="M46 88 L154 88 L154 104 L118 104 L110 132 L90 132 L82 104 L46 104 Z" fill={`url(#${id}g)`} />
          <path d="M72 116 L88 118 M128 116 L112 118" strokeWidth="5" />
          <path d="M84 150 C94 156 106 156 116 150" fill="none" />
        </>}
        {k === 'shield' && <>
          <path d="M100 14 L170 36 L164 112 C158 150 130 174 100 188 C70 174 42 150 36 112 L30 36 Z" fill={`url(#${id}g)`} />
          <path d="M100 32 L152 48 L148 110 C144 140 124 160 100 172 C76 160 56 140 52 110 L48 48 Z" fill="none" stroke={c2} strokeWidth="5" />
          <text x="100" y="124" textAnchor="middle" fontFamily="Barlow Condensed, sans-serif" fontWeight="900" fontStyle="italic" fontSize="58" fill={c2} stroke="#0b0d12" strokeWidth="3" paintOrder="stroke">{s.abbr.slice(0, 4)}</text>
        </>}
      </g>
      <path d="M40 40 C80 10 140 14 170 60 C140 40 90 36 40 70 Z" fill={`url(#${id}h)`} />
    </svg>
  );
}

/** A football field in perspective, painted in the school's colours with its name in the end zone. */
export function Field3D({ s }: { s: School }) {
  const c1 = showColor(s);
  return (
    <div className="f3" style={{ '--c': c1, '--c2': s.c2 } as CSSProperties}>
      <div className="f3-plane">
        <div className="f3-ez"><span>{s.school}</span></div>
        <div className="f3-turf">{Array.from({ length: 10 }, (_, i) => <i key={i} />)}</div>
        <div className="f3-mid" />
      </div>
    </div>
  );
}

/** A felt pennant in a school's colours. */
export function Pennant({ s, style }: { s: School; style?: CSSProperties }) {
  return (
    <div className="pen" style={{ '--c': showColor(s), '--c2': s.c2, ...style } as CSSProperties}>
      <span>{s.abbr}</span>
    </div>
  );
}

/** A night stadium skyline: bowl, light towers and a glowing sky in the school's colour. */
export function Stadium({ color }: { color: string }) {
  return (
    <svg className="stad" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" style={{ '--c': color } as CSSProperties}>
      <defs>
        <linearGradient id="stg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a2233" /><stop offset="1" stopColor="#090c13" /></linearGradient>
        <radialGradient id="stl" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#fff" stopOpacity=".9" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      <path d="M0 300 L0 190 C180 150 360 132 600 130 C840 132 1020 150 1200 190 L1200 300 Z" fill="url(#stg)" />
      <path d="M40 300 L40 210 C220 176 400 164 600 162 C800 164 980 176 1160 210 L1160 300 Z" fill="#0d121c" />
      {[[110, 80], [330, 54], [870, 54], [1090, 80]].map(([x, y], i) => (
        <g key={i}>
          <rect x={x - 3} y={y} width="6" height={300 - y} fill="#111723" />
          <rect x={x - 26} y={y - 14} width="52" height="18" rx="2" fill="#dfe6f2" />
          <circle cx={x} cy={y - 5} r="70" fill="url(#stl)" opacity=".35" className="stad-light" style={{ animationDelay: `${i * 0.4}s` }} />
        </g>
      ))}
      {Array.from({ length: 60 }, (_, i) => <circle key={i} cx={60 + i * 18.4} cy={186 - Math.sin(i / 59 * Math.PI) * 30 + (i % 3) * 3} r="1.6" fill="#fff" opacity={0.25 + (i % 5) * 0.12} className="stad-flash" style={{ animationDelay: `${(i * 0.37) % 3}s` }} />)}
    </svg>
  );
}
