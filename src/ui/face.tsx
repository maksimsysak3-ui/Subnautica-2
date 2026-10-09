// Procedural portraits for players without a real headshot (draft prospects,
// generated players). Seeded by the player, so a face never changes.
import { GEN_FACES } from '../data/genfaces';
import { REAL_FACES } from '../data/realfaces';
import type { Player, Team } from '../core/types';
import { Rng } from '../core/rng';

const SKIN = ['#f3d2b8', '#e8bb98', '#d9a37c', '#c68a63', '#ad7350', '#925c3e', '#7a4a31', '#633a26', '#4f2d1e', '#3d2318'];
const HAIR = ['#0d0a08', '#1b120c', '#2b1b10', '#3d2615', '#5a3a1e', '#8a5a2b', '#b9894f', '#d8b46a', '#6b6b6b'];

export function faceSpec(p: Player) {
  const r = new Rng(p.face >>> 0);
  const skinI = Math.min(SKIN.length - 1, Math.max(0, Math.round(r.weighted([[1, 1], [2, 1.2], [3, 1.2], [5, 1.4], [6, 1.6], [7, 1.8], [8, 1.6], [9, 1]] as const) + r.int(-1, 1))));
  const dark = skinI >= 5;
  return {
    skin: SKIN[skinI], skinI,
    hair: dark ? HAIR[r.int(0, 2)] : HAIR[r.weighted([[0, 1], [1, 1], [2, 1], [3, 1.2], [4, 1.2], [5, 0.8], [6, 0.6], [7, 0.4]] as const)],
    style: r.weighted<string>(dark ? [['fade', 3], ['waves', 2], ['twists', 1.5], ['locs', 1.5], ['buzz', 2], ['bald', 0.8], ['afro', 0.8], ['braids', 1.2]] : [['short', 3], ['fade', 2], ['buzz', 1.5], ['flow', 1.5], ['curly', 1], ['bald', 0.4], ['mullet', 0.6]]),
    beard: r.weighted<string>([['none', 2.4], ['stubble', 2], ['goatee', 1.2], ['full', 1.6], ['mustache', 0.5], ['chin', 0.8]]),
    jaw: r.range(0.92, 1.12), width: r.range(0.94, 1.08) * (['OT', 'G', 'C', 'DT'].includes(p.pos) ? 1.06 : 1),
    eyeY: r.range(-2, 2), eyeGap: r.range(-2, 2), brow: r.range(-0.15, 0.2), nose: r.range(0.9, 1.15), lip: r.range(0.9, 1.15),
    iris: dark ? '#3a2416' : r.pick(['#3a2416', '#5b3a1e', '#41698a', '#5c7a4f', '#7a6040']),
  };
}

/** College colours (jersey, trim) for prospects, so a draft class looks like a draft class. */
const COLLEGE: Record<string, [string, string]> = {
  Alabama: ['#9e1b32', '#ffffff'], Georgia: ['#ba0c2f', '#000000'], 'Ohio State': ['#bb0000', '#a7b1b7'], Michigan: ['#00274c', '#ffcb05'], LSU: ['#461d7c', '#fdd023'], Texas: ['#bf5700', '#ffffff'],
  Oregon: ['#154733', '#fee123'], 'Penn State': ['#041e42', '#ffffff'], Clemson: ['#f56600', '#522d80'], 'Notre Dame': ['#0c2340', '#c99700'], USC: ['#990000', '#ffc72c'], Florida: ['#0021a5', '#fa4616'],
  'Florida State': ['#782f40', '#ceb888'], Miami: ['#f47321', '#005030'], Oklahoma: ['#841617', '#fdf9d8'], Tennessee: ['#ff8200', '#ffffff'], 'Texas A&M': ['#500000', '#ffffff'], Auburn: ['#0c2340', '#e87722'],
  Washington: ['#4b2e83', '#b7a57a'], Utah: ['#cc0000', '#ffffff'], Iowa: ['#000000', '#ffcd00'], Wisconsin: ['#c5050c', '#ffffff'], 'Ole Miss': ['#14213d', '#ce1126'], Missouri: ['#f1b82d', '#000000'],
  Kentucky: ['#0033a0', '#ffffff'], 'South Carolina': ['#73000a', '#000000'], 'Arizona State': ['#8c1d40', '#ffc627'], UCLA: ['#2d68c4', '#f2a900'], Colorado: ['#000000', '#cfb87c'], Louisville: ['#ad0000', '#000000'],
  'NC State': ['#cc0000', '#ffffff'], 'North Carolina': ['#7bafd4', '#13294b'], Duke: ['#003087', '#ffffff'], 'Virginia Tech': ['#630031', '#cf4420'], Pittsburgh: ['#003594', '#ffb81c'], 'Boise State': ['#0033a0', '#d64309'],
  TCU: ['#4d1979', '#a3a9ac'], Baylor: ['#154734', '#ffb81c'], 'Kansas State': ['#512888', '#ffffff'], 'Iowa State': ['#c8102e', '#f1be48'], Minnesota: ['#7a0019', '#ffcc33'], Nebraska: ['#e41c38', '#ffffff'],
  Purdue: ['#000000', '#cfb991'], Illinois: ['#13294b', '#e84a27'], Arkansas: ['#9d2235', '#ffffff'], 'Mississippi State': ['#660000', '#ffffff'], 'Texas Tech': ['#cc0000', '#000000'], BYU: ['#002e5d', '#ffffff'],
  SMU: ['#354ca1', '#cc0035'], Tulane: ['#006747', '#418fde'], Memphis: ['#003087', '#898d8d'], Toledo: ['#15397f', '#ffda00'], 'Western Michigan': ['#6c4023', '#b5a167'], 'App State': ['#222222', '#ffcc00'],
  'James Madison': ['#450084', '#cbb677'], 'North Dakota State': ['#0a5640', '#ffc82e'], Montana: ['#70263c', '#999999'], 'South Dakota State': ['#0033a0', '#ffd100'], Houston: ['#c8102e', '#ffffff'], Cincinnati: ['#e00122', '#000000'],
};
const collegeKit = (col: string): [string, string] => COLLEGE[col] ?? (() => { let h = 0; for (const c of col) h = (h * 31 + c.charCodeAt(0)) | 0; const pal: [string, string][] = [['#1e3a8a', '#fbbf24'], ['#7f1d1d', '#f5f5f4'], ['#14532d', '#facc15'], ['#4c1d95', '#e5e7eb'], ['#0f172a', '#f97316']]; return pal[Math.abs(h) % pal.length]; })();

/**
 * Real college prospects get their own headshot. Generated prospects (ids like P2031-14:
 * fictional names) get an AI-generated portrait of a
 * fictional player. Faces are spread so a class rarely repeats one; the player keeps his face
 * after he is drafted. Real players and real prospects never get one.
 */
export function genFace(p: Player): string | undefined {
  // Real prospects (2027-2030 classes): their own official college headshot.
  if (REAL_FACES[p.id]) return REAL_FACES[p.id];
  const m = /^P(\d{4})-(\d+)$/.exec(p.id);
  return m ? GEN_FACES[(+m[2] + +m[1] * 53) % GEN_FACES.length] : undefined;
}

export function FaceArt({ p, team, size }: { p: Player; team?: Team; size: number }) {
  const photo = genFace(p);
  if (photo) return <img src={photo} alt="" width={size} height={size} style={{ display: 'block', width: size, height: size, objectFit: 'cover', objectPosition: '50% 18%' }} />;
  const f = faceSpec(p);
  const id = `f${p.id.replace(/[^a-z0-9]/gi, '')}`;
  const shade = shadeHex(f.skin, -0.22), light = shadeHex(f.skin, 0.12);
  const prospect = !team && p.status === 'PROSPECT';
  const [cj, ct] = prospect ? collegeKit(p.col) : ['#334155', '#94a3b8'];
  const jersey = team?.colors[0] ?? cj, trim = team?.colors[1] ?? ct;
  const W = 46 * f.width, J = 58 * f.jaw;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} style={{ display: 'block' }}>
      <defs>
        <radialGradient id={`${id}s`} cx="45%" cy="38%" r="65%"><stop offset="0" stopColor={light} /><stop offset=".65" stopColor={f.skin} /><stop offset="1" stopColor={shade} /></radialGradient>
        <linearGradient id={`${id}j`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={shadeHex(jersey, 0.15)} /><stop offset="1" stopColor={shadeHex(jersey, -0.35)} /></linearGradient>
      </defs>
      {/* shoulders and jersey */}
      <path d="M18 200 Q24 152 72 140 L128 140 Q176 152 182 200 Z" fill={`url(#${id}j)`} />
      <path d="M78 140 Q100 162 122 140" fill="none" stroke={trim} strokeWidth="6" />
      {prospect && <><path d="M28 196 Q34 166 62 152" fill="none" stroke={trim} strokeWidth="5" strokeOpacity=".8" /><path d="M172 196 Q166 166 138 152" fill="none" stroke={trim} strokeWidth="5" strokeOpacity=".8" />
        <text x="100" y="192" textAnchor="middle" fontFamily="var(--head), Impact, sans-serif" fontWeight={800} fontSize="30" fill={trim} stroke="rgba(0,0,0,.35)" strokeWidth="1">{(Math.abs([...p.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % 89) + 1}</text></>}
      {/* neck */}
      <path d={`M${100 - 20} 118 L${100 - 22} 146 Q100 156 ${100 + 22} 146 L${100 + 20} 118 Z`} fill={shade} />
      {/* ears */}
      <ellipse cx={100 - W - 2} cy="98" rx="8" ry="13" fill={f.skin} /><ellipse cx={100 + W + 2} cy="98" rx="8" ry="13" fill={f.skin} />
      {/* head */}
      <path d={`M${100 - W} 86 Q${100 - W} 40 100 38 Q${100 + W} 40 ${100 + W} 86 Q${100 + W - 2} ${100 + J * 0.38} 100 ${70 + J} Q${100 - W + 2} ${100 + J * 0.38} ${100 - W} 86 Z`} fill={`url(#${id}s)`} />
      <Beard kind={f.beard} hair={f.hair} W={W} J={J} />
      {/* eyes */}
      {[-1, 1].map(s => {
        const x = 100 + s * (17 + f.eyeGap), y = 92 + f.eyeY;
        return <g key={s}>
          <path d={`M${x - 9} ${y} Q${x} ${y - 6} ${x + 9} ${y} Q${x} ${y + 4} ${x - 9} ${y} Z`} fill="#f4f1ea" />
          <circle cx={x} cy={y - 0.5} r="3.6" fill={f.iris} /><circle cx={x} cy={y - 0.5} r="1.7" fill="#0b0b0b" /><circle cx={x + 1.2} cy={y - 1.8} r=".9" fill="#fff" />
          <path d={`M${x - 10} ${y - 1} Q${x} ${y - 8} ${x + 10} ${y - 1}`} fill="none" stroke={shadeHex(f.skin, -0.45)} strokeWidth="1.6" />
          <path d={`M${x - 11} ${y - 11 - f.brow * 8 * s * 0} Q${x} ${y - 15 - f.brow * 6} ${x + 11} ${y - 11}`} fill="none" stroke={f.hair} strokeWidth="3.6" strokeLinecap="round" />
        </g>;
      })}
      {/* nose */}
      <path d={`M98 96 Q96 ${108 + f.nose * 4} ${92 - f.nose * 2} ${113 + f.nose * 2} Q100 ${118 + f.nose * 2} ${108 + f.nose * 2} ${113 + f.nose * 2} Q104 ${108 + f.nose * 4} 102 96`} fill={shade} opacity=".55" />
      {/* mouth */}
      <path d={`M${88 - f.lip * 2} 126 Q100 ${129 + f.lip} ${112 + f.lip * 2} 126`} fill="none" stroke={shadeHex(f.skin, -0.5)} strokeWidth="2.4" strokeLinecap="round" />
      <path d={`M${90} 127.5 Q100 ${133 + f.lip * 2} 110 127.5`} fill={shadeHex(f.skin, -0.18)} opacity=".7" />
      <Hair style={f.style} hair={f.hair} W={W} />
    </svg>
  );
}

function Hair({ style, hair, W }: { style: string; hair: string; W: number }) {
  const top = `M${100 - W - 1} 80 Q${100 - W - 4} 34 100 30 Q${100 + W + 4} 34 ${100 + W + 1} 80`;
  switch (style) {
    case 'bald': return <path d={`M${100 - W + 6} 52 Q100 36 ${100 + W - 6} 52`} fill="none" stroke="#fff" strokeOpacity=".18" strokeWidth="6" />;
    case 'buzz': return <path d={`${top} Q${100 + W - 4} 56 100 52 Q${100 - W + 4} 56 ${100 - W - 1} 80 Z`} fill={hair} opacity=".75" />;
    case 'fade': case 'short': case 'waves': return <g><path d={`${top} Q${100 + W - 6} 54 100 50 Q${100 - W + 6} 54 ${100 - W - 1} 80 Z`} fill={hair} />{style === 'waves' && [0, 1, 2].map(i => <path key={i} d={`M${100 - W + 10} ${40 + i * 5} Q100 ${34 + i * 5} ${100 + W - 10} ${40 + i * 5}`} fill="none" stroke="#fff" strokeOpacity=".08" strokeWidth="2" />)}</g>;
    case 'afro': return <ellipse cx="100" cy="46" rx={W + 16} ry="30" fill={hair} />;
    case 'curly': return <g fill={hair}>{Array.from({ length: 11 }, (_, i) => <circle key={i} cx={100 - W + i * (W / 5)} cy={42 + Math.sin(i) * 4} r="10" />)}</g>;
    case 'flow': case 'mullet': return <path d={`${top} L${100 + W + 4} ${style === 'mullet' ? 130 : 108} Q${100 + W - 6} 60 100 52 Q${100 - W + 6} 60 ${100 - W - 4} ${style === 'mullet' ? 130 : 108} Z`} fill={hair} />;
    case 'twists': case 'locs': case 'braids': return <g>{Array.from({ length: style === 'braids' ? 7 : 12 }, (_, i) => { const n = style === 'braids' ? 7 : 12; const x = 100 - W + (i / (n - 1)) * 2 * W; const len = style === 'locs' ? 80 : style === 'braids' ? 40 : 34; return <path key={i} d={`M${x} 38 Q${x + (x < 100 ? -6 : 6)} ${50 + len / 2} ${x + (x < 100 ? -10 : 10)} ${44 + len}`} stroke={hair} strokeWidth={style === 'braids' ? 5 : 7} strokeLinecap="round" fill="none" />; })}<path d={`${top} Q100 46 ${100 - W - 1} 80 Z`} fill={hair} /></g>;
    default: return null;
  }
}
function Beard({ kind, hair, W, J }: { kind: string; hair: string; W: number; J: number }) {
  const chin = 70 + J;
  switch (kind) {
    case 'stubble': return <path d={`M${100 - W + 4} 104 Q100 ${chin + 6} ${100 + W - 4} 104 Q100 ${chin - 4} ${100 - W + 4} 104 Z`} fill={hair} opacity=".22" />;
    case 'full': return <path d={`M${100 - W + 1} 98 Q${100 - W + 4} ${chin} 100 ${chin + 6} Q${100 + W - 4} ${chin} ${100 + W - 1} 98 Q${100 + W - 10} 124 100 120 Q${100 - W + 10} 124 ${100 - W + 1} 98 Z`} fill={hair} opacity=".92" />;
    case 'goatee': return <g fill={hair}><path d={`M88 122 Q100 116 112 122 L110 126 Q100 122 90 126 Z`} /><path d={`M92 132 Q100 ${chin + 4} 108 132 Q100 136 92 132 Z`} /></g>;
    case 'mustache': return <path d="M86 122 Q100 115 114 122 Q100 120 86 122 Z" fill={hair} />;
    case 'chin': return <path d={`M90 134 Q100 ${chin + 5} 110 134 Q100 138 90 134 Z`} fill={hair} />;
    default: return null;
  }
}
export function shadeHex(hex: string, k: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  const f = (c: number) => Math.round(Math.max(0, Math.min(255, k < 0 ? c * (1 + k) : c + (255 - c) * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
