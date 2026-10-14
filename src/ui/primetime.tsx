// Prime-time cold opens. Night games, the playoffs and rivalry weeks start like a network
// broadcast, each window with its own package: Thursday is electric (neon teal and violet,
// hard cuts, glitching type), Sunday is the marquee (gold on deep blue, a long sweeping
// flyover, fireworks, a brass swell), Monday is heavy (red, black and chrome, everything
// lands like a hit). Behind the graphics a 2.5D Canvas stadium (primestage.ts) flies the
// camera; in front, CSS-animated typography, a team-colour split screen, the two star
// players and the kickoff lower third. Click or any key skips; the open ends by handing off
// into the game. Branding is original: no real network or league marks.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Game, League, Player, StatLine, Team } from '../core/types';
import type { Weather } from '../sim/game';
import { Logo, Face, vivid } from './components';
import { standings, ROUND_NAME } from '../core/season';
import { heat } from '../core/rivalry';
import { mountStage, type Look } from './primestage';
import { playSting } from './primesound';
import './primetime.css';

const SHOW: Record<string, string> = { Thu: 'Thursday Night Football', Mon: 'Monday Night Football', SunN: 'Sunday Night Football', Sat: 'Saturday Showcase' };

/** Which show this game is, if any: night games, playoffs, or a big rivalry week. */
export function showFor(L: League, g: Game): string | undefined {
  if (g.week > 18) return g.week === 22 ? 'Super Bowl' : `${ROUND_NAME[g.week]} Round`;
  const night = +(g.time ?? '13:00').slice(0, 2) >= 19;
  const hour = +(g.time ?? '13:00').slice(0, 2);
  if (g.day === 'Thu' && !night) return 'Thanksgiving Football';
  if (g.day === 'Thu' || g.day === 'Mon') return SHOW[g.day];
  if (g.day === 'Sun' && night) return SHOW.SunN;
  if (g.day === 'Sun' && hour < 11) return 'International Series';
  if (g.day === 'Wed' || g.day === 'Fri') return `${g.day === 'Wed' ? 'Wednesday' : 'Friday'} Night Football`;
  if (g.day === 'Sat') return SHOW.Sat;
  if (heat(L, g.home, g.away) >= 55) return 'Rivalry Game';
  return undefined;
}

// The display fonts for the three packages, fetched once when the game loads.
if (typeof document !== 'undefined' && !document.getElementById('ptx-fonts')) {
  const l = document.createElement('link'); l.id = 'ptx-fonts'; l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Anton&family=Big+Shoulders+Display:wght@800;900&family=Cinzel:wght@600;700;900&display=swap';
  document.head.appendChild(l);
}

/** Each show's package: which look, its title lines, timing (seconds) and the impact beats. */
interface Pack { look: Look; t1: string; t2: string; dur: number; out: number; hits: number[]; cuts: number[] }
const TIMING: Record<Look, Omit<Pack, 'look' | 't1' | 't2'>> = {
  thu: { dur: 9.0, out: 0.55, hits: [0.3, 0.75, 1.2, 2.6, 4.85, 7.0], cuts: [0.85, 1.7, 2.6, 4.8, 7.0] },
  sun: { dur: 11.5, out: 0.7, hits: [1.15, 4.1, 7.0, 9.3], cuts: [] },
  mon: { dur: 10.0, out: 0.6, hits: [0.5, 1.1, 1.7, 3.5, 5.8, 6.1, 9.63], cuts: [3.1, 5.7, 7.7] },
};
function packFor(show: string): Pack {
  const m = /^(\w+) Night Football$/.exec(show);
  let look: Look = 'sun', t1 = show.toUpperCase(), t2 = 'FOOTBALL';
  if (m) { t1 = `${m[1].toUpperCase()} NIGHT`; look = m[1] === 'Monday' ? 'mon' : m[1] === 'Sunday' ? 'sun' : 'thu'; }
  else if (show === 'Saturday Showcase') { look = 'thu'; t1 = 'SATURDAY'; t2 = 'SHOWCASE'; }
  else if (show === 'International Series') { look = 'thu'; t1 = 'INTERNATIONAL'; t2 = 'SERIES'; }
  else if (show === 'Thanksgiving Football') { look = 'sun'; t1 = 'THANKSGIVING'; }
  else if (show === 'Rivalry Game') { look = 'mon'; t1 = 'RIVALRY'; t2 = 'WEEK'; }
  else if (show === 'Super Bowl') { look = 'sun'; t1 = 'SUPER BOWL'; t2 = 'CHAMPIONSHIP GAME'; }
  else if (/Round$/.test(show)) { look = 'sun'; t1 = show.replace(/ Round$/, '').replace('Conference Championship', 'CONFERENCE').toUpperCase(); t2 = /Conference/.test(show) ? 'CHAMPIONSHIP' : 'PLAYOFFS'; }
  return { look, t1, t2, ...TIMING[look] };
}

const KEY_POS: [string, number][] = [['QB', 0], ['RB', 0], ['WR', 0], ['WR', 1], ['TE', 0], ['EDGE', 0], ['EDGE', 1], ['DT', 0], ['LB', 0], ['CB', 0], ['S', 0]];
/** The man the broadcast builds the night around: best healthy starter, quarterbacks first among equals. */
function starOf(L: League, t: Team): Player | undefined {
  let best: Player | undefined, bs = -1;
  for (const [pos, i] of KEY_POS) {
    const p = L.players[t.depth[pos as keyof Team['depth']]?.[i] ?? '']; if (!p || p.injury) continue;
    const s = p.ovr + (pos === 'QB' ? 4 : 0); if (s > bs) { bs = s; best = p; }
  }
  return best;
}
const n0 = (v?: number) => (v ?? 0).toLocaleString('en-US');
function statLine(p: Player, s?: StatLine): string[] {
  if (!s || !s.gp) return [`${p.ovr} OVR`, p.arch, `${p.exp ? `${p.exp + 1}${p.exp === 0 ? 'ST' : p.exp === 1 ? 'ND' : p.exp === 2 ? 'RD' : 'TH'} SEASON` : 'ROOKIE'}`];
  if (p.pos === 'QB') return [`${n0(s.py)} YDS`, `${s.ptd} TD`, `${s.pint} INT`];
  if (p.pos === 'RB') return [`${n0(s.ry)} RUSH YDS`, `${s.rtd + s.rectd} TD`, `${n0(s.recy)} REC YDS`];
  if (p.pos === 'WR' || p.pos === 'TE') return [`${s.rec} REC`, `${n0(s.recy)} YDS`, `${s.rectd} TD`];
  return [`${s.tkl} TKL`, `${s.dsk % 1 ? s.dsk.toFixed(1) : s.dsk} SACKS`, `${s.dint} INT`];
}
const clock = (t?: string) => { const [h, m] = (t ?? '20:15').split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'} ET`; };
const chars = (s: string, base = 0): ReactNode[] => [...s].map((ch, i) => <span key={i} className="ptx-ch" style={{ '--i': i + base } as CSSProperties}>{ch === ' ' ? ' ' : ch}</span>);
const lum = (hex: string) => { const n = parseInt(hex.slice(1, 7), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
/** A team's second colour for accents, skipping black and white when it can. */
const second = (t: Team) => t.colors.slice(1).find(c => { const l = lum(c); return l > 30 && l < 235; }) ?? t.colors[1] ?? '#ffffff';

export function PrimeIntro({ L, g, weather, onDone }: { L: League; g: Game; weather: Weather; onDone: () => void }) {
  const show = showFor(L, g) ?? 'Sunday Night Football';
  const pk = useMemo(() => packFor(show), [show]);
  const away = L.teams[g.away], home = L.teams[g.home];
  const data = useMemo(() => {
    const st = standings(L);
    const rec = (t: Team) => { const s = st[t.abbr]; return s && s.w + s.l + s.t ? `${s.w}-${s.l}${s.t ? `-${s.t}` : ''}` : `${t.conf} ${t.div}`.toUpperCase(); };
    const side = (t: Team) => {
      const star = starOf(L, t);
      return { t, rec: rec(t), city: t.name.replace(new RegExp(`\\s*${t.nick}$`), '') || t.name, c: vivid(t.colors[0]), c2: vivid(second(t)), star, line: star ? statLine(star, star.stats[L.season]) : [] };
    };
    const hour = +(g.time ?? '20:00').slice(0, 2);
    const wx = weather.dome ? 'INDOORS · 72°' : `${weather.temp}° · ${weather.precip === 'rain' ? 'RAIN' : weather.precip === 'snow' ? 'SNOW' : weather.wind >= 15 ? `WIND ${weather.wind} MPH` : hour >= 18 ? 'CLEAR NIGHT' : 'CLEAR'}`;
    return { a: side(away), h: side(home), venue: g.neutral ?? home.stadium, city: g.neutral ? '' : side(home).city, wx, time: clock(g.time), night: hour >= 18, hour };
  }, [g.id]);
  const [phase, setPhase] = useState<'run' | 'out' | 'skip'>('run');
  const cv = useRef<HTMLCanvasElement>(null), shake = useRef<HTMLDivElement>(null);
  const ended = useRef(false);
  const end = () => { if (!ended.current) { ended.current = true; onDone(); } };
  const skip = () => { if (phase === 'run') { setPhase('skip'); setTimeout(end, 380); } else if (phase === 'skip') end(); };

  // Canvas stadium and the sound sting.
  useEffect(() => {
    let stop = () => {};
    try {
      stop = mountStage(cv.current!, {
        look: pk.look, home: data.h.c, home2: data.h.c2, away: data.a.c, away2: data.a.c2, logo: home.logo,
        precip: weather.precip, dome: weather.dome, dusk: data.hour < 18, hits: pk.hits, cuts: pk.cuts, shakeEl: shake.current, seed: parseInt(g.id.replace(/\D/g, '').slice(-8) || '7', 10),
      });
    } catch { /* no canvas: the graphics still play */ }
    const sting = playSting(pk.look, pk.hits);
    return () => { stop(); sting(); };
  }, []);
  // The open runs itself, then hands off into the game.
  useEffect(() => {
    const a = setTimeout(() => setPhase(p => (p === 'run' ? 'out' : p)), (pk.dur - pk.out) * 1000);
    const b = setTimeout(end, pk.dur * 1000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { e.preventDefault(); e.stopImmediatePropagation(); if (e.key === 'Escape') end(); else skip(); };
    window.addEventListener('keydown', key, true); return () => window.removeEventListener('keydown', key, true);
  });

  const { a, h } = data;
  const sideVars = (s: typeof a) => ({ '--c': s.c, '--c2': s.c2 } as CSSProperties);
  const title1 = pk.t1.split(' ');
  const card = (s: typeof a, k: 'a' | 'h') => s.star && (
    <div className={`ptx-card ${k}`} style={sideVars(s)}>
      <div className="ptx-cin">
        <div className="ptx-cbg"><Logo team={s.t} size={420} /></div>
        <b className="ptx-cnum">{s.star.num}</b>
        <div className="ptx-face"><Face p={s.star} size={300} team={s.t} /></div>
        <div className="ptx-cinfo">
          <div className="ptx-cpos"><Logo team={s.t} size={26} /><span>{s.star.pos} · {s.t.nick}</span></div>
          <div className="ptx-cfn">{s.star.fn}</div>
          <div className="ptx-cln">{s.star.ln}</div>
          <div className="ptx-cst">{s.line.map((x, i) => <span key={i}>{x}</span>)}</div>
        </div>
        <i className="ptx-sweep" />
      </div>
    </div>
  );
  const sideEl = (s: typeof a, k: 'a' | 'h') => (
    <div className={`ptx-side ${k}`} style={sideVars(s)}>
      <div className="ptx-wipe"><i className="ptx-ghost"><Logo team={s.t} size={900} /></i></div>
      <div className="ptx-team">
        <div className="ptx-logo"><Logo team={s.t} size={240} /></div>
        <div className="ptx-city">{s.city}</div>
        <div className="ptx-nick">{s.t.nick}</div>
        <div className="ptx-rec">{s.rec}</div>
      </div>
    </div>
  );

  return createPortal(
    <div className={`ptx ptx-${pk.look} ${phase !== 'run' ? `ptx-out${phase === 'skip' ? ' ptx-fast' : ''}` : ''}`} onClick={skip}
      style={{ '--a': a.c, '--a2': a.c2, '--h': h.c, '--h2': h.c2, '--dur': `${pk.dur}s` } as CSSProperties}>
      <canvas ref={cv} className="ptx-cv" />
      <div className="ptx-shake" ref={shake}>
        <section className="ptx-sc ptx-open">
          <div className="ptx-kick"><i />GGN SPORTS PRESENTS<i /></div>
          <h1 className="ptx-t1">{title1.map((w, i) => <span key={i} className={`ptx-w w${i}`} data-t={w}>{chars(w)}</span>)}</h1>
          <div className="ptx-t2"><i /><span>{chars(pk.t2)}</span><i /></div>
          <div className="ptx-tsub">{away.nick} <em>at</em> {home.nick}</div>
          {pk.look === 'mon' && <div className="ptx-slash" />}
        </section>
        <section className="ptx-sc ptx-match">
          {sideEl(a, 'a')}{sideEl(h, 'h')}
          <svg className="ptx-seam" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>{pk.look === 'sun' ? <line x1="50" y1="0" x2="50" y2="100" /> : pk.look === 'mon' ? <line x1="53.5" y1="0" x2="46.5" y2="100" /> : <line x1="56" y1="0" x2="44" y2="100" />}</svg>
          <div className="ptx-vs"><span>VS</span></div>
        </section>
        <section className="ptx-sc ptx-stars">
          <div className="ptx-shead">{pk.look === 'mon' ? 'Marquee Matchup' : pk.look === 'sun' ? 'The Stars Tonight' : 'Players to Watch'}</div>
          {card(a, 'a')}{card(h, 'h')}
        </section>
        <section className="ptx-sc ptx-lock">
          <div className="ptx-lk">
            <div className="ptx-lkl"><Logo team={away} size={150} /></div>
            <div className="ptx-lkt">
              <small>{pk.t1} {pk.t2}</small>
              <b>{away.nick}</b><em>at</em><b>{home.nick}</b>
            </div>
            <div className="ptx-lkl h"><Logo team={home} size={150} /></div>
          </div>
          <div className="ptx-l3">
            <div className="ptx-l3tag">{data.night ? 'Tonight' : 'Today'}</div>
            <div className="ptx-l3main"><b>{data.time}</b><span>{data.venue}{data.city ? ` · ${data.city}` : ''}</span></div>
            <div className="ptx-l3wx">{data.wx}</div>
          </div>
        </section>
      </div>
      <i className="ptx-bar t" /><i className="ptx-bar b" />
      <div className="ptx-bug"><b>GGN</b><span>{pk.t1}</span></div>
      <div className="ptx-fx" />
      <span className="ptx-skip">Click or press any key to skip</span>
    </div>,
    document.body,
  );
}
