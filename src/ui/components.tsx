import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Dev, League, Player, Team } from '../core/types';
import { app } from './store';
import { FaceArt } from './face';

export const tier = (o: number) => (o >= 95 ? 't99' : o >= 90 ? 't90' : o >= 80 ? 't80' : o >= 70 ? 't70' : o >= 60 ? 't60' : 't0');
export function Ovr({ v, lg, style }: { v: number; lg?: boolean; style?: CSSProperties }) {
  return <span className={`ovr ${tier(v)}${lg ? ' lg' : ''}`} style={style}>{v}</span>;
}
const POS_GROUP: Record<string, string> = { QB: 'qb', RB: 'sk', FB: 'sk', WR: 'sk', TE: 'sk', OT: 'ol', G: 'ol', C: 'ol', EDGE: 'dl', DT: 'dl', LB: 'lb', CB: 'db', S: 'db', K: 'st', P: 'st', LS: 'st' };
/** Position label coloured by unit. */
export function PosTag({ pos }: { pos: string }) { return <span className={`postag ${POS_GROUP[pos] ?? 'st'}`}>{pos}</span>; }
export function Grade({ g, lg }: { g: string; lg?: boolean }) { return <span className={`grade ${g[0]}${lg ? ' lg' : ''}`}>{g}</span>; }
/** Development trait emblem: a bevelled metal crest (steel, bronze, gold, crimson) with a shine and its mark. */
export function DevIcon({ d, size = 22 }: { d: Dev; size?: number }) {
  const id = `dv${d.replace(/\W/g, '')}`;
  const pal = { Normal: ['#9aa1ad', '#3b404a', '#d5dae3', '#2a2e36'], Star: ['#f3c48c', '#7a3e10', '#ffe2bf', '#3a1c06'], Superstar: ['#fff1a0', '#a67402', '#fff9d8', '#4a3300'], 'X-Factor': ['#ff5b6c', '#5c0310', '#ffd0d5', '#26000a'] }[d];
  const hex = 'M12 1 21.8 6.7v10.6L12 23 2.2 17.3V6.7z', inner = 'M12 3.6 19.6 8v8L12 20.4 4.4 16V8z';
  return (
    <svg className={`devicon dv-${d.replace(/\W/g, '')}`} width={size} height={size} viewBox="0 0 24 24" aria-label={d} role="img">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stopColor={pal[0]} /><stop offset=".55" stopColor={pal[1]} /><stop offset="1" stopColor={pal[3]} /></linearGradient>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={pal[3]} /><stop offset="1" stopColor="#000" /></linearGradient>
        <clipPath id={`${id}c`}><path d={hex} /></clipPath>
      </defs>
      <path d={hex} fill={`url(#${id}g)`} stroke="rgba(0,0,0,.55)" strokeWidth=".7" />
      <path d={inner} fill={d === 'Normal' ? `url(#${id}f)` : `url(#${id}f)`} stroke={pal[2]} strokeWidth=".7" opacity={d === 'Normal' ? 0.8 : 0.95} />
      <g clipPath={`url(#${id}c)`}><path d="M-2 9 14 -3h5L3 14z" fill="#fff" opacity=".22" /></g>
      {d === 'Normal' && <circle cx="12" cy="12" r="2.4" fill={pal[2]} opacity=".85" />}
      {d === 'Star' && <path d="m12 7.3 1.45 3 3.3.45-2.4 2.25.6 3.3L12 14.75 9.05 16.3l.6-3.3-2.4-2.25 3.3-.45z" fill={pal[2]} />}
      {d === 'Superstar' && <><path d="m12 6.6 1.65 3.35 3.7.55-2.68 2.6.63 3.68L12 15.05l-3.3 1.73.63-3.68-2.68-2.6 3.7-.55z" fill={pal[2]} /><path d="M12 4.6v1.2M17.6 7.4l-.9.7M6.4 7.4l.9.7" stroke={pal[2]} strokeWidth=".9" strokeLinecap="round" /></>}
      {d === 'X-Factor' && <><path d="M8.2 7.4h2.5l1.3 2.4 1.3-2.4h2.5l-2.55 4.4 2.55 4.4h-2.5L12 13.8l-1.3 2.4H8.2l2.55-4.4z" fill="#fff" /><circle cx="17.2" cy="6.8" r=".8" fill="#fff" opacity=".9" /></>}
    </svg>
  );
}
export const DEV_BLURB: Record<Dev, string> = {
  Normal: 'Normal: develops slowly, no special abilities.',
  Star: 'Star: develops at a good pace and earns more from practice and games.',
  Superstar: 'Superstar: fast development and two Superstar abilities.',
  'X-Factor': 'X-Factor: elite development, three abilities and an X-Factor zone ability.',
};
export function DevBadge({ d, label = true }: { d: Dev; label?: boolean }) {
  return <span className={`dev ${d}`} title={DEV_BLURB[d]}><DevIcon d={d} size={18} />{label && d}</span>;
}

/** Real team logo from the CDN, with the Wikipedia mark and then a monogram as fallbacks. */
export function Logo({ team, size = 36, style }: { team?: Team; size?: number; style?: CSSProperties }) {
  const [src, setSrc] = useState(team?.logo);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setSrc(team?.logo); setFailed(false); }, [team?.abbr]);
  if (!team) return null;
  if (failed) return <span style={{ width: size, height: size, borderRadius: 10, display: 'inline-grid', placeItems: 'center', background: team.colors[0], color: team.colors[1], font: `800 ${size * 0.38}px var(--head)`, ...style }}>{team.abbr}</span>;
  return <img className="logo" src={src} width={size} height={size} alt={team.nick} loading="lazy" style={style}
    onError={() => (src === team.logo && team.logoAlt ? setSrc(team.logoAlt) : setFailed(true))} />;
}

/** Real headshot when the player has one; otherwise the procedural portrait. */
export function Face({ p, size = 44, team, style }: { p: Player; size?: number; team?: Team; style?: CSSProperties }) {
  const [bad, setBad] = useState(false);
  const t = team ?? (app.league?.teams[p.team]);
  const url = p.hs && !bad ? p.hs.replace('f_auto,q_auto', `f_auto,q_auto,w_${size > 120 ? 400 : 160}`) : undefined;
  return (
    <div className="face" style={{ width: size, height: size, background: t ? `radial-gradient(circle at 50% 35%, ${t.colors[0]}cc, #0b1120 85%)` : undefined, ...style }}>
      {url ? <img src={url} alt="" loading="lazy" onError={() => setBad(true)} /> : <FaceArt p={p} team={t} size={size} />}
    </div>
  );
}

/**
 * The player as Madden presents him outside the lineup: his headshot over his
 * team's colour with the team mark in the corner. Square, flat, no gimmicks.
 */
export function Portrait({ p, size = 120, team, ovr = true, style, onClick }: { p: Player; size?: number; team?: Team; ovr?: boolean; style?: CSSProperties; onClick?: () => void }) {
  const [bad, setBad] = useState(false);
  const t = team ?? app.league?.teams[p.team];
  const url = p.hs && !bad ? p.hs.replace('f_auto,q_auto', `f_auto,q_auto,w_${size > 140 ? 400 : 200}`) : undefined;
  const c = t ? vivid(t.colors[0]) : '#2a3040';
  return (
    <div className={`portrait${onClick ? ' click' : ''}`} style={{ width: size, height: size, '--pc': c, ...style } as CSSProperties} onClick={onClick}>
      {t && <Logo team={t} size={size * 0.95} style={{ position: 'absolute', right: -size * 0.28, bottom: -size * 0.22, opacity: 0.18 }} />}
      {url ? <img className="pt-img" src={url} alt="" loading="lazy" onError={() => setBad(true)} /> : <div className="pt-img svg"><FaceArt p={p} team={t} size={size} /></div>}
      {t && <span className="pt-logo"><Logo team={t} size={Math.max(16, size * 0.2)} /></span>}
      {ovr && <b className={`pt-ovr ${tier(p.ovr)}`}>{p.ovr}</b>}
    </div>
  );
}

export function PlayerCell({ p, sub }: { p: Player; sub?: ReactNode }) {
  return (
    <div className="pcell">
      <Face p={p} size={34} />
      <div style={{ lineHeight: 1.15 }}>
        <b>{p.fn} {p.ln}</b>{p.injury && <span className="bad small" title={p.injury.type}> ✚ {p.injury.weeks}w</span>}
        <div className="small mute">{sub ?? `${p.pos} · #${p.num} · ${p.arch}`}</div>
      </div>
    </div>
  );
}

/** Numbers that count up when they change: scoreboards, cap space, ratings. */
export function CountUp({ v, dur = 700, fmt = (x: number) => Math.round(x).toString() }: { v: number; dur?: number; fmt?: (x: number) => string }) {
  const [shown, setShown] = useState(v);
  const from = useRef(v);
  useEffect(() => {
    const start = performance.now(), a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(a + (v - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = v;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [v]);
  return <>{fmt(shown)}</>;
}

/** A card that tilts toward the cursor with a moving sheen: the 3D feel of a trading card. */
export function Tilt({ children, max = 10, style, className }: { children: ReactNode; max?: number; style?: CSSProperties; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ x: 0, y: 0, gx: 50, gy: 50, on: false });
  return (
    <div ref={ref} className={className}
      onMouseMove={e => { const r = ref.current!.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height; setT({ x: (py - 0.5) * -max, y: (px - 0.5) * max, gx: px * 100, gy: py * 100, on: true }); }}
      onMouseLeave={() => setT({ x: 0, y: 0, gx: 50, gy: 50, on: false })}
      style={{ perspective: 900, ...style }}>
      <div style={{ transform: `rotateX(${t.x}deg) rotateY(${t.y}deg)`, transition: t.on ? 'transform .05s' : 'transform .5s cubic-bezier(.2,.8,.2,1)', transformStyle: 'preserve-3d', position: 'relative', height: '100%' }}>
        {children}
        <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', background: `radial-gradient(circle at ${t.gx}% ${t.gy}%, rgba(255,255,255,${t.on ? 0.16 : 0}), transparent 45%)`, transition: 'background .2s' }} />
      </div>
    </div>
  );
}

export function Modal({ children, onClose, wide }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return <div className="modal-bg" onClick={onClose}><div className="modal" style={wide ? { width: 'min(1000px,100%)' } : undefined} onClick={e => e.stopPropagation()}>{children}</div></div>;
}

export function Tabs<T extends string>({ tabs, on, set }: { tabs: readonly T[]; on: T; set: (t: T) => void }) {
  return <div className="tabs">{tabs.map(t => <button key={t} className={`tab${t === on ? ' on' : ''}`} onClick={() => set(t)}>{t}</button>)}</div>;
}

export interface Col<T> { k: string; h: string; get: (r: T) => ReactNode; sort?: (r: T) => number | string; cls?: string; w?: number }
/**
 * Sortable table; rows beyond `limit` are paged so 2,000-player lists stay fast.
 * With `header`, it becomes the Madden spreadsheet: the row under the cursor (or
 * picked with the arrow keys) is highlighted white and shown large above the table.
 */
export function Table<T>({ rows, cols, onRow, rowKey, initial, desc = true, mine, limit = 150, header }: { rows: T[]; cols: Col<T>[]; onRow?: (r: T) => void; rowKey: (r: T) => string; initial?: string; desc?: boolean; mine?: (r: T) => boolean; limit?: number; header?: (r: T) => ReactNode }) {
  const [sort, setSort] = useState<{ k?: string; d: boolean }>({ k: initial, d: desc });
  const [page, setPage] = useState(1);
  const [focus, setFocus] = useState<string | null>(null);
  const body = useRef<HTMLTableSectionElement>(null);
  const sorted = useMemo(() => {
    const c = cols.find(c => c.k === sort.k);
    if (!c?.sort) return rows;
    const f = c.sort;
    return [...rows].sort((a, b) => { const x = f(a), y = f(b); const r = x < y ? -1 : x > y ? 1 : 0; return sort.d ? -r : r; });
  }, [rows, sort, cols]);
  const shown = sorted.slice(0, limit * page);
  const fi = header ? Math.max(0, shown.findIndex(r => rowKey(r) === focus)) : -1;
  const cur = header ? shown[fi] : undefined;
  useEffect(() => {
    if (!header) return;
    const k = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) || document.querySelector('.modal-bg')) return;
      const d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
      if (d) { e.preventDefault(); const n = shown[Math.max(0, Math.min(shown.length - 1, fi + d))]; if (n) { setFocus(rowKey(n)); body.current?.children[Math.max(0, Math.min(shown.length - 1, fi + d))]?.scrollIntoView({ block: 'nearest' }); } }
      else if (e.key === 'Enter' && cur && onRow) onRow(cur);
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  return (
    <>
      {header && cur && <div className="ft-head">{header(cur)}</div>}
      <div className={`scroll${header ? ' ft' : ''}`}>
        <table className="tbl">
          <thead><tr>{cols.map(c => <th key={c.k} className={c.cls} style={c.w ? { width: c.w } : undefined} onClick={() => c.sort && setSort(s => ({ k: c.k, d: s.k === c.k ? !s.d : true }))}>{c.h}{sort.k === c.k ? (sort.d ? ' ▾' : ' ▴') : ''}</th>)}</tr></thead>
          <tbody ref={body}>{shown.map((r, i) => <tr key={rowKey(r)} className={`${mine?.(r) ? 'me' : ''}${i === fi ? ' on' : ''}`} onMouseEnter={header ? () => setFocus(rowKey(r)) : undefined} onClick={() => onRow?.(r)}>{cols.map(c => <td key={c.k} className={c.cls}>{c.get(r)}</td>)}</tr>)}</tbody>
        </table>
        {sorted.length > shown.length && <div className="empty"><button className="btn sm" onClick={() => setPage(p => p + 1)}>Show more ({sorted.length - shown.length})</button></div>}
        {!rows.length && <div className="empty">Nothing here.</div>}
      </div>
    </>
  );
}

export function Bar({ v, max = 100, cls, color }: { v: number; max?: number; cls?: string; color?: string }) {
  return <div className={`bar ${cls ?? ''}`}><i style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, background: color }} /></div>;
}
export const attrColor = (v: number) => (v >= 90 ? '#34d399' : v >= 80 ? '#60a5fa' : v >= 70 ? '#cbd5e1' : v >= 60 ? '#f59e0b' : '#ef4444');

/** Applies the user's team colours to the whole UI. */
export function useTeamTheme(league: League | null) {
  useEffect(() => {
    const t = league?.teams[league.user];
    const root = document.documentElement.style;
    root.setProperty('--team', t ? vivid(t.colors[0]) : '#3b82f6');
    root.setProperty('--team2', t ? vivid(t.colors[1] === '#000000' || t.colors[1].toLowerCase() === '#ffffff' ? t.colors[2] ?? '#f5c542' : t.colors[1]) : '#f5c542');
  }, [league?.user]);
}
/** Lift very dark team colours so they read on a dark UI. */
export function vivid(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  if (l < 70) { const k = 70 / Math.max(1, l); r = Math.min(255, r * k + 30); g = Math.min(255, g * k + 30); b = Math.min(255, b * k + 40); }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

// ---- jersey ------------------------------------------------------------------------------
/** Home jersey per team: body, numbers, outline, sleeve stripes. */
export const UNIFORM: Record<string, { body: string; num: string; trim: string; stripes?: string[] }> = {
  ARI: { body: '#97233F', num: '#FFFFFF', trim: '#000000' }, ATL: { body: '#000000', num: '#FFFFFF', trim: '#A71930' }, BAL: { body: '#241773', num: '#FFFFFF', trim: '#000000', stripes: ['#000000'] },
  BUF: { body: '#00338D', num: '#FFFFFF', trim: '#C60C30', stripes: ['#C60C30', '#FFFFFF'] }, CAR: { body: '#0085CA', num: '#FFFFFF', trim: '#101820' }, CHI: { body: '#0B162A', num: '#FFFFFF', trim: '#C83803', stripes: ['#C83803', '#FFFFFF', '#C83803'] },
  CIN: { body: '#000000', num: '#FFFFFF', trim: '#FB4F14', stripes: ['#FB4F14'] }, CLE: { body: '#311D00', num: '#FF3C00', trim: '#FFFFFF', stripes: ['#FF3C00', '#FFFFFF', '#FF3C00'] }, DAL: { body: '#FFFFFF', num: '#003594', trim: '#869397', stripes: ['#003594'] },
  DEN: { body: '#FB4F14', num: '#FFFFFF', trim: '#002244' }, DET: { body: '#0076B6', num: '#FFFFFF', trim: '#B0B7BC' }, GB: { body: '#203731', num: '#FFFFFF', trim: '#FFB612', stripes: ['#FFB612', '#FFFFFF', '#FFB612'] },
  HOU: { body: '#03202F', num: '#FFFFFF', trim: '#A71930' }, IND: { body: '#002C5F', num: '#FFFFFF', trim: '#FFFFFF', stripes: ['#FFFFFF'] }, JAX: { body: '#101820', num: '#FFFFFF', trim: '#D7A22A' },
  KC: { body: '#E31837', num: '#FFFFFF', trim: '#FFB81C', stripes: ['#FFFFFF', '#FFB81C', '#FFFFFF'] }, LV: { body: '#000000', num: '#FFFFFF', trim: '#A5ACAF' }, LAC: { body: '#0080C6', num: '#FFFFFF', trim: '#FFC20E', stripes: ['#FFC20E'] },
  LA: { body: '#003594', num: '#FFD100', trim: '#FFFFFF', stripes: ['#FFD100'] }, MIA: { body: '#008E97', num: '#FFFFFF', trim: '#FC4C02' }, MIN: { body: '#4F2683', num: '#FFFFFF', trim: '#FFC62F', stripes: ['#FFC62F'] },
  NE: { body: '#002244', num: '#FFFFFF', trim: '#C60C30', stripes: ['#C60C30'] }, NO: { body: '#101820', num: '#D3BC8D', trim: '#FFFFFF' }, NYG: { body: '#0B2265', num: '#FFFFFF', trim: '#A71930' },
  NYJ: { body: '#125740', num: '#FFFFFF', trim: '#000000' }, PHI: { body: '#004C54', num: '#FFFFFF', trim: '#A5ACAF' }, PIT: { body: '#101820', num: '#FFB612', trim: '#FFFFFF', stripes: ['#FFB612'] },
  SF: { body: '#AA0000', num: '#FFFFFF', trim: '#B3995D', stripes: ['#FFFFFF', '#B3995D', '#FFFFFF'] }, SEA: { body: '#002244', num: '#FFFFFF', trim: '#69BE28' }, TB: { body: '#D50A0A', num: '#FFFFFF', trim: '#FF7900' },
  TEN: { body: '#0C2340', num: '#FFFFFF', trim: '#4B92DB' }, WAS: { body: '#5A1414', num: '#FFFFFF', trim: '#FFB612', stripes: ['#FFB612', '#FFFFFF', '#FFB612'] },
};
export function Jersey({ team, num, name, size = 200, back = true }: { team: Team; num: number; name?: string; size?: number; back?: boolean }) {
  const u = UNIFORM[team.abbr] ?? { body: team.colors[0], num: '#fff', trim: team.colors[1] };
  const id = `j${team.abbr}${num}${back ? 'b' : 'f'}`;
  const stripes = u.stripes ?? [];
  return (
    <svg width={size} height={size * 1.05} viewBox="0 0 200 210" style={{ filter: 'drop-shadow(0 12px 22px rgba(0,0,0,.55))' }}>
      <defs>
        <linearGradient id={`${id}g`} x1="0" x2="1"><stop offset="0" stopColor="#000" stopOpacity=".28" /><stop offset=".45" stopColor="#fff" stopOpacity=".07" /><stop offset="1" stopColor="#000" stopOpacity=".32" /></linearGradient>
        <pattern id={`${id}mesh`} width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".6" fill="#000" opacity=".12" /></pattern>
        <clipPath id={`${id}c`}><path d="M60 14 Q100 30 140 14 L186 40 L196 92 L160 100 L158 200 L42 200 L40 100 L4 92 L14 40 Z" /></clipPath>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        <rect width="200" height="210" fill={u.body} />
        {stripes.map((c, i) => <g key={i}><rect x="4" y={70 + i * 6} width="40" height="4" fill={c} transform="rotate(12 24 72)" /><rect x="156" y={70 + i * 6} width="40" height="4" fill={c} transform="rotate(-12 176 72)" /></g>)}
        <rect width="200" height="210" fill={`url(#${id}mesh)`} />
        <rect width="200" height="210" fill={`url(#${id}g)`} />
        <path d="M40 100 L44 200 M160 100 L156 200" stroke="#000" strokeOpacity=".25" strokeWidth="2" />
      </g>
      <path d={back ? 'M68 14 Q100 24 132 14' : 'M68 14 Q100 46 132 14'} fill="none" stroke={u.trim} strokeWidth="7" strokeLinecap="round" />
      {back && name && <text x="100" y="56" textAnchor="middle" fill={u.num} style={{ font: '700 15px var(--head)', letterSpacing: '.12em' }}>{name.toUpperCase()}</text>}
      <text x="100" y={back ? 160 : 150} textAnchor="middle" fill={u.num} stroke={u.trim} strokeWidth="3" paintOrder="stroke" style={{ font: `800 ${back ? 92 : 78}px var(--head)` }}>{num}</text>
    </svg>
  );
}
