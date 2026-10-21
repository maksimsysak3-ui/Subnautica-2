import { memo, useState } from 'react';
import type { Club, Player } from '../core/types';
import type { KitPattern } from '../data/clubs';
import { makeRng, hash } from '../core/rng';
import { regionOf, flagUrl, natName, type Region } from '../data/nations';
import { faceStats } from '../core/player';

// ---- crests -------------------------------------------------------------------------------
export const Crest = memo(function Crest({ club, size = 32, className }: { club: Club | undefined; size?: number; className?: string }) {
  const [bad, setBad] = useState(false);
  if (!club) return null;
  if (!bad && club.logo) return <img className={`crest ${className ?? ''}`} src={club.logo} alt={club.name} width={size} height={size} loading="lazy" onError={() => setBad(true)} draggable={false} />;
  return (
    <svg className={`crest ${className ?? ''}`} width={size} height={size} viewBox="0 0 40 40" aria-label={club.name}>
      <path d="M20 2 L36 7 V20 C36 30 28 36 20 38 C12 36 4 30 4 20 V7 Z" fill={club.c1} stroke={club.c2} strokeWidth="2.2" />
      <path d="M20 6 L32 10 V20 C32 27 26 32 20 34 Z" fill={club.c2} opacity=".22" />
      <text x="20" y="25" textAnchor="middle" fontSize={club.short.length > 3 ? 8 : 10} fontWeight="800" fill={club.c2} fontFamily="Barlow Condensed, sans-serif">{club.short}</text>
    </svg>
  );
});

export function Flag({ nat, h = 14 }: { nat: string; h?: number }) {
  const [bad, setBad] = useState(false);
  const url = flagUrl(nat);
  if (!url || bad) return <span className="flag-txt" style={{ fontSize: h * 0.65 }}>{nat}</span>;
  return <img className="flag" src={url} alt={natName(nat)} title={natName(nat)} height={h} style={{ height: h }} loading="lazy" onError={() => setBad(true)} />;
}

// ---- kits ---------------------------------------------------------------------------------
const SHIRT = 'M30 8 L42 4 C46 9 54 9 58 4 L70 8 L92 22 L84 40 L74 35 L74 96 L26 96 L26 35 L16 40 L8 22 Z';
export const Kit = memo(function Kit({ c1, c2, pattern, num, name, size = 80, away }: { c1: string; c2: string; pattern: KitPattern; num?: number; name?: string; size?: number; away?: boolean }) {
  const id = `k${hash(c1 + c2 + pattern + (away ? 'a' : ''))}`;
  const ink = luminance(c1) > 0.6 ? '#111' : '#fff';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="kit">
      <defs>
        <clipPath id={id}><path d={SHIRT} /></clipPath>
        <linearGradient id={id + 'g'} x1="0" x2="1"><stop offset="0" stopColor="#000" stopOpacity=".18" /><stop offset=".5" stopColor="#fff" stopOpacity=".08" /><stop offset="1" stopColor="#000" stopOpacity=".22" /></linearGradient>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect width="100" height="100" fill={c1} />
        {patternEls(pattern, c1, c2)}
        <rect width="100" height="100" fill={`url(#${id}g)`} />
      </g>
      <path d={SHIRT} fill="none" stroke="#000" strokeOpacity=".35" strokeWidth="1.2" />
      <path d="M42 4 C46 12 54 12 58 4" fill="none" stroke={c2} strokeWidth="3" />
      {num !== undefined && <text x="50" y="72" textAnchor="middle" fontSize="30" fontWeight="800" fill={pattern === 'stripes' || pattern === 'hoops' ? '#fff' : ink} stroke={pattern === 'stripes' || pattern === 'hoops' ? '#000' : 'none'} strokeWidth=".8" fontFamily="Barlow Condensed, sans-serif">{num}</text>}
      {name && <text x="50" y="40" textAnchor="middle" fontSize="9" fontWeight="700" fill={ink} fontFamily="Barlow Condensed, sans-serif" letterSpacing="1">{name.toUpperCase()}</text>}
    </svg>
  );
});
function patternEls(p: KitPattern, c1: string, c2: string) {
  switch (p) {
    case 'stripes': return [18, 34, 50, 66, 82].map(x => <rect key={x} x={x - 4} y="0" width="8" height="100" fill={c2} />);
    case 'pinstripe': return [20, 30, 40, 50, 60, 70, 80].map(x => <rect key={x} x={x} y="0" width="1.4" height="100" fill={c2} />);
    case 'hoops': return [22, 42, 62, 82].map(y => <rect key={y} x="0" y={y} width="100" height="10" fill={c2} />);
    case 'halves': return <rect x="50" y="0" width="50" height="100" fill={c2} />;
    case 'quarters': return <><rect x="50" y="0" width="50" height="50" fill={c2} /><rect x="0" y="50" width="50" height="50" fill={c2} /></>;
    case 'sash': return <path d="M10 0 L30 0 L100 80 L100 100 L88 100 L10 12 Z" fill={c2} />;
    case 'band': return <rect x="40" y="0" width="20" height="100" fill={c2} />;
    case 'hband': return <rect x="0" y="34" width="100" height="16" fill={c2} />;
    case 'sleeves': return <><path d="M0 0 L30 0 L26 40 L0 40 Z" fill={c2} /><path d="M70 0 L100 0 L100 40 L74 40 Z" fill={c2} /></>;
    case 'chevron': return <path d="M26 30 L50 50 L74 30 L74 42 L50 62 L26 42 Z" fill={c2} />;
    case 'yoke': return <rect x="0" y="0" width="100" height="22" fill={c2} />;
    default: return <><rect x="0" y="0" width="26" height="40" fill={c1} /><rect x="22" y="88" width="56" height="8" fill={c2} opacity=".9" /></>;
  }
}
export function luminance(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0.4;
  const n = parseInt(m[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
export const kitFor = (c: Club, away = false) => away ? { c1: c.a1, c2: c.a2, pattern: 'plain' as KitPattern } : { c1: c.c1, c2: c.c2, pattern: c.kit };

// ---- faces --------------------------------------------------------------------------------
const SKIN: Record<Region, [string[], number[]]> = {
  brit: [['#f2d0b5', '#e8bf9f', '#d9a982', '#b07a52', '#6b4428', '#4a2f1d'], [30, 30, 12, 8, 12, 8]],
  germ: [['#f2d0b5', '#e8bf9f', '#d9a982', '#b07a52', '#6b4428'], [34, 32, 16, 8, 10]],
  nord: [['#f6dcc6', '#f2d0b5', '#e8bf9f', '#6b4428'], [40, 34, 18, 8]],
  east: [['#f2d0b5', '#e8bf9f', '#d9a982'], [40, 40, 20]],
  balk: [['#ecc6a6', '#e0b190', '#cf9d78'], [35, 40, 25]],
  ital: [['#e8bf9f', '#d9a982', '#c9946c', '#6b4428'], [30, 38, 24, 8]],
  iber: [['#e8bf9f', '#d9a982', '#c9946c', '#8a5a37', '#4a2f1d'], [26, 34, 22, 10, 8]],
  fran: [['#f2d0b5', '#e0b190', '#c9946c', '#8a5a37', '#5a3820', '#3d2616'], [22, 20, 12, 12, 18, 16]],
  latam: [['#e0b190', '#cf9d78', '#b9835a', '#8a5a37', '#5a3820'], [20, 30, 28, 14, 8]],
  braz: [['#e8bf9f', '#cf9d78', '#a8714a', '#7a4c2c', '#4a2f1d', '#3a2414'], [16, 20, 20, 18, 16, 10]],
  wafr: [['#6b4428', '#5a3820', '#4a2f1d', '#3d2616', '#2e1c10'], [16, 26, 26, 20, 12]],
  nafr: [['#d9a982', '#c9946c', '#b07a52', '#8a5a37'], [24, 34, 28, 14]],
  arab: [['#d9a982', '#c9946c', '#b07a52', '#8a5a37'], [20, 34, 30, 16]],
  turk: [['#e8bf9f', '#d9a982', '#c9946c'], [30, 40, 30]],
  asia: [['#f2d6b8', '#e8c6a0', '#dcb48a'], [34, 40, 26]],
  usa: [['#f2d0b5', '#e8bf9f', '#c9946c', '#6b4428', '#4a2f1d'], [28, 26, 14, 16, 16]],
  carib: [['#6b4428', '#5a3820', '#4a2f1d', '#8a5a37'], [26, 30, 24, 20]],
};
const HAIR_LIGHT = ['#e8d08a', '#c9a35d', '#9c6b3c', '#6b4527', '#3b2717', '#1d140e'];
const HAIR_DARK = ['#3b2717', '#2a1c12', '#1d140e', '#111'];
function wpick<T>(r: () => number, items: T[], w: number[]): T { const tot = w.reduce((a, b) => a + b, 0); let x = r() * tot; for (let i = 0; i < items.length; i++) { x -= w[i]; if (x <= 0) return items[i]; } return items[items.length - 1]; }

export interface FaceSpec { skin: string; hair: string; hairStyle: number; beard: number; brow: number; eye: string; jaw: number; nose: number; mouth: number; ear: number; headW: number }
export function faceSpec(p: Pick<Player, 'name' | 'nat' | 'born'> & { id: number }): FaceSpec {
  const r = makeRng(hash(p.name + p.nat));
  const reg = regionOf(p.nat);
  const [tones, ws] = SKIN[reg];
  const skin = wpick(r, tones, ws);
  const darkSkin = ['#6b4428', '#5a3820', '#4a2f1d', '#3d2616', '#2e1c10', '#3a2414', '#7a4c2c'].includes(skin);
  const light = ['nord', 'brit', 'germ', 'east'].includes(reg) && !darkSkin;
  const hair = light ? wpick(r, HAIR_LIGHT, [10, 14, 22, 24, 20, 10]) : wpick(r, HAIR_DARK, [20, 30, 30, 20]);
  const styles = darkSkin ? [0, 1, 5, 6, 7, 8, 2] : [1, 2, 3, 4, 2, 3, 9, 0, 6];
  return {
    skin, hair, hairStyle: styles[Math.floor(r() * styles.length)], beard: Math.floor(r() * 5) === 0 ? 0 : Math.floor(r() * 4),
    brow: Math.floor(r() * 3), eye: light && r() < 0.35 ? wpick(r, ['#4a7bb7', '#5d8a5a', '#7a6a4f'], [5, 3, 3]) : '#3a2614',
    jaw: Math.floor(r() * 3), nose: Math.floor(r() * 3), mouth: Math.floor(r() * 3), ear: r() < 0.5 ? 0 : 1, headW: 0.94 + r() * 0.1,
  };
}

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** Procedural head-and-shoulders portrait in the player's kit. */
export const Face = memo(function Face({ p, club, size = 64, away = false }: { p: Player; club?: Club; size?: number; away?: boolean }) {
  const f = faceSpec(p);
  const k = club ? kitFor(club, away) : { c1: '#2b3550', c2: '#8fa3c7', pattern: 'plain' as KitPattern };
  const id = `f${p.id}`;
  const sk = f.skin, skD = shade(sk, 0.8), skL = shade(sk, 1.08);
  const hw = 26 * f.headW;
  const jawPath = f.jaw === 0 ? `M${50 - hw} 44 C${50 - hw} 70 ${50 - 12} 82 50 83 C${50 + 12} 82 ${50 + hw} 70 ${50 + hw} 44` : f.jaw === 1 ? `M${50 - hw} 44 C${50 - hw} 66 ${50 - 16} 82 50 82 C${50 + 16} 82 ${50 + hw} 66 ${50 + hw} 44` : `M${50 - hw} 44 C${50 - hw - 1} 72 ${50 - 10} 84 50 85 C${50 + 10} 84 ${50 + hw + 1} 72 ${50 + hw} 44`;
  const head = `${jawPath} C${50 + hw} 22 ${50 + 14} 14 50 14 C${50 - 14} 14 ${50 - hw} 22 ${50 - hw} 44 Z`;
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 100 120" className="face">
      <defs>
        <clipPath id={id + 'c'}><path d="M8 120 C10 100 26 94 50 93 C74 94 90 100 92 120 Z" /></clipPath>
        <radialGradient id={id + 'g'} cx=".42" cy=".38" r=".7"><stop offset="0" stopColor={skL} /><stop offset="1" stopColor={sk} /></radialGradient>
      </defs>
      {/* shirt */}
      <g clipPath={`url(#${id}c)`}>
        <rect x="0" y="88" width="100" height="40" fill={k.c1} />
        {k.pattern === 'stripes' && [22, 38, 54, 70, 86].map(x => <rect key={x} x={x - 4} y="88" width="8" height="40" fill={k.c2} />)}
        {k.pattern === 'hoops' && <rect x="0" y="106" width="100" height="7" fill={k.c2} />}
        {k.pattern === 'halves' && <rect x="50" y="88" width="50" height="40" fill={k.c2} />}
        {k.pattern === 'sash' && <path d="M20 88 L34 88 L80 128 L66 128 Z" fill={k.c2} />}
        {k.pattern === 'band' && <rect x="42" y="88" width="16" height="40" fill={k.c2} />}
        {k.pattern === 'hband' && <rect x="0" y="104" width="100" height="8" fill={k.c2} />}
        {k.pattern === 'sleeves' && <><rect x="0" y="88" width="20" height="40" fill={k.c2} /><rect x="80" y="88" width="20" height="40" fill={k.c2} /></>}
        <rect x="0" y="88" width="100" height="40" fill="#000" opacity=".12" />
      </g>
      {/* neck */}
      <path d="M40 76 L40 94 C44 99 56 99 60 94 L60 76 Z" fill={skD} />
      <path d="M38 93 C42 100 58 100 62 93 L64 96 C58 104 42 104 36 96 Z" fill={k.c2} />
      {/* ears */}
      <ellipse cx={50 - hw - 1} cy="50" rx="4.5" ry={f.ear ? 7 : 6} fill={skD} />
      <ellipse cx={50 + hw + 1} cy="50" rx="4.5" ry={f.ear ? 7 : 6} fill={skD} />
      {/* head */}
      <path d={head} fill={`url(#${id}g)`} />
      {/* beard */}
      {f.beard === 1 && <path d={`${jawPath} C${50 + hw - 2} 62 ${50 + 10} 66 50 66 C${50 - 10} 66 ${50 - hw + 2} 62 ${50 - hw} 44 Z`} fill={f.hair} opacity=".28" />}
      {f.beard === 2 && <path d={`${jawPath} C${50 + hw - 3} 60 ${50 + 12} 68 50 70 C${50 - 12} 68 ${50 - hw + 3} 60 ${50 - hw} 44 Z`} fill={f.hair} opacity=".85" />}
      {f.beard === 3 && <path d="M42 70 C46 68 54 68 58 70 C57 78 43 78 42 70 Z" fill={f.hair} opacity=".8" />}
      {/* hair */}
      {hairEl(f, hw)}
      {/* brows */}
      <path d={f.brow === 0 ? 'M34 41 Q40 37 46 40' : f.brow === 1 ? 'M34 40 L46 39' : 'M33 42 Q40 36 46 39'} stroke={f.hair === '#e8d08a' ? '#9c6b3c' : f.hair} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d={f.brow === 0 ? 'M54 40 Q60 37 66 41' : f.brow === 1 ? 'M54 39 L66 40' : 'M54 39 Q60 36 67 42'} stroke={f.hair === '#e8d08a' ? '#9c6b3c' : f.hair} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      {/* eyes */}
      <ellipse cx="40" cy="47" rx="4.6" ry="2.6" fill="#fff" /><ellipse cx="60" cy="47" rx="4.6" ry="2.6" fill="#fff" />
      <circle cx="40.6" cy="47.2" r="2.1" fill={f.eye} /><circle cx="60.6" cy="47.2" r="2.1" fill={f.eye} />
      <circle cx="41.2" cy="46.5" r=".6" fill="#fff" /><circle cx="61.2" cy="46.5" r=".6" fill="#fff" />
      <path d="M35 45 Q40 42.6 45 45" stroke={skD} strokeWidth="1" fill="none" /><path d="M55 45 Q60 42.6 65 45" stroke={skD} strokeWidth="1" fill="none" />
      {/* nose */}
      <path d={f.nose === 0 ? 'M50 49 L47 60 Q50 62 53 60' : f.nose === 1 ? 'M50 48 L46 61 Q50 63.5 54 61' : 'M50 50 L48 59 Q50 60.5 52 59'} stroke={skD} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* mouth */}
      <path d={f.mouth === 0 ? 'M43 68 Q50 71 57 68' : f.mouth === 1 ? 'M44 68 L56 68' : 'M43 67 Q50 72.5 57 67'} stroke={shade(sk, 0.55)} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
});
function hairEl(f: FaceSpec, hw: number) {
  const c = f.hair, L = 50 - hw, R = 50 + hw;
  switch (f.hairStyle) {
    case 0: return <path d={`M${L + 1} 36 C${L + 2} 18 ${R - 2} 18 ${R - 1} 36 C${R - 6} 26 ${L + 6} 26 ${L + 1} 36 Z`} fill={c} opacity=".55" />; // buzz
    case 1: return <path d={`M${L - 1} 40 C${L - 2} 14 ${R + 2} 14 ${R + 1} 40 C${R - 3} 26 ${50 + 6} 24 50 25 C${50 - 6} 24 ${L + 3} 26 ${L - 1} 40 Z`} fill={c} />; // short crop
    case 2: return <path d={`M${L - 2} 42 C${L - 4} 10 ${R + 4} 8 ${R + 2} 42 C${R} 30 ${R - 6} 22 ${50 + 4} 22 C${50 - 8} 26 ${L + 4} 24 ${L - 2} 42 Z`} fill={c} />; // side part
    case 3: return <path d={`M${L - 2} 40 C${L - 4} 4 ${R + 4} 4 ${R + 2} 40 L${R} 30 C${R - 8} 18 ${L + 8} 18 ${L} 30 Z M${L + 4} 22 C${50} 6 ${R - 2} 12 ${R - 4} 24`} fill={c} />; // quiff
    case 4: return <path d={`M${L - 3} 58 C${L - 8} 8 ${R + 8} 8 ${R + 3} 58 C${R + 1} 40 ${R - 3} 26 50 24 C${L + 3} 26 ${L - 1} 40 ${L - 3} 58 Z`} fill={c} />; // long
    case 5: return <path d={`M${L - 4} 42 C${L - 8} 2 ${R + 8} 2 ${R + 4} 42 C${R + 1} 28 ${L - 1} 28 ${L - 4} 42 Z`} fill={c} />; // afro
    case 6: return <g fill={c}>{[0, 1, 2, 3, 4, 5, 6].map(i => <rect key={i} x={L + 2 + i * (hw * 2 - 4) / 7} y={14 - Math.sin((i / 6) * Math.PI) * 4} width="3.4" height="18" rx="1.7" />)}<path d={`M${L} 36 C${L} 16 ${R} 16 ${R} 36 C${R - 6} 26 ${L + 6} 26 ${L} 36 Z`} /></g>; // twists
    case 7: return <path d={`M${50 - 7} 34 C${50 - 8} 8 ${50 + 8} 8 ${50 + 7} 34 C${50 + 3} 26 ${50 - 3} 26 ${50 - 7} 34 Z M${L + 2} 38 C${L + 2} 28 ${L + 6} 24 ${50 - 8} 22 M${R - 2} 38 C${R - 2} 28 ${R - 6} 24 ${50 + 8} 22`} fill={c} opacity=".9" />; // mohawk
    case 8: return null; // bald
    default: return <path d={`M${L - 2} 44 C${L - 6} 6 ${R + 6} 6 ${R + 2} 44 C${R + 2} 32 ${R - 4} 22 50 20 C${L + 4} 22 ${L - 2} 32 ${L - 2} 44 Z M${R - 2} 30 C${R + 4} 40 ${R + 4} 48 ${R + 2} 52`} fill={c} />; // messy
  }
}

// ---- rating chips & cards ----------------------------------------------------------------
export const ovrClass = (o: number) => o >= 85 ? 'o-elite' : o >= 80 ? 'o-gold' : o >= 75 ? 'o-good' : o >= 70 ? 'o-ok' : o >= 65 ? 'o-avg' : 'o-low';
export const Ovr = ({ v, small }: { v: number; small?: boolean }) => <span className={`ovr ${ovrClass(v)} ${small ? 'sm' : ''}`}>{Math.round(v)}</span>;

export function cardTier(p: Player): string {
  if (p.form >= 7.6 && p.s.apps >= 3) return 'inform';
  if (p.ovr >= 86) return 'hero';
  if (p.ovr >= 75) return 'gold';
  if (p.ovr >= 65) return 'silver';
  return 'bronze';
}
export function PlayerCard({ p, club, size = 1, onClick }: { p: Player; club?: Club; size?: number; onClick?: () => void }) {
  const fs = faceStats(p);
  const tier = cardTier(p);
  return (
    <div className={`fut fut-${tier}`} style={{ ['--s' as string]: size }} onClick={onClick}>
      <div className="fut-shine" />
      <div className="fut-top">
        <div className="fut-ovr">{p.ovr}</div>
        <div className="fut-pos">{p.pos}</div>
        <div className="fut-icons"><Flag nat={p.nat} h={13 * size} />{club && <Crest club={club} size={20 * size} />}</div>
      </div>
      <div className="fut-face"><Face p={p} club={club} size={92 * size} /></div>
      <div className="fut-name">{p.name.split(' ').slice(-1)[0]}</div>
      <div className="fut-stats">{fs.map(([k, v]) => <div key={k}><b>{Math.round(v)}</b><span>{k}</span></div>)}</div>
    </div>
  );
}

export function Stars({ n, max = 5 }: { n: number; max?: number }) {
  return <span className="stars">{Array.from({ length: max }, (_, i) => <i key={i} className={i < n ? 'on' : ''}>★</i>)}</span>;
}

export function Bar({ v, max = 99, color }: { v: number; max?: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, (v / max) * 100));
  const c = color ?? (v >= 85 ? '#22c55e' : v >= 75 ? '#84cc16' : v >= 65 ? '#eab308' : v >= 50 ? '#f97316' : '#ef4444');
  return <span className="bar"><i style={{ width: `${pct}%`, background: c }} /></span>;
}

export function TrophySvg({ size = 120, color = '#f5c542' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 100 130" className="trophy-svg">
      <defs><linearGradient id="tg" x1="0" x2="1"><stop offset="0" stopColor={shade(color.length === 7 ? color : '#f5c542', 0.65)} /><stop offset=".45" stopColor={color} /><stop offset=".55" stopColor="#fff8d0" /><stop offset="1" stopColor={shade(color.length === 7 ? color : '#f5c542', 0.7)} /></linearGradient></defs>
      <path d="M26 10 H74 C74 46 66 62 50 66 C34 62 26 46 26 10 Z" fill="url(#tg)" />
      <path d="M26 16 C8 16 8 42 30 46 M74 16 C92 16 92 42 70 46" fill="none" stroke="url(#tg)" strokeWidth="6" />
      <rect x="45" y="64" width="10" height="22" fill="url(#tg)" />
      <path d="M34 86 H66 L70 100 H30 Z" fill="url(#tg)" />
      <rect x="24" y="100" width="52" height="20" rx="3" fill="#3b2a12" />
      <rect x="30" y="105" width="40" height="10" rx="2" fill="url(#tg)" opacity=".7" />
    </svg>
  );
}
