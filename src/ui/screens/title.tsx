// Title screen: a broadcast-style opening built from the league's real faces and
// marks, then a Madden-style main menu with the cover athlete, big image tiles and
// a live news crawl.
//
// Opening (about 6.4s, skippable):
//   ignition   a light streak tears across black and leaves "THE 2026 SEASON"
//   tunnel     the camera flies through a tunnel of all 32 team logos
//   stars      rapid cuts: four of the league's best, each in his team's colours
//   wordmark   white flash, light rays, the chrome wordmark slams in with sparks
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { app, listSaves, loadLeague, type SaveMeta } from '../store';
import data from '../../data/league.json';
import { RAW_TEAMS } from '../../core/league';
import { migrate } from './menu';
import { BottomLine, preseasonHeadlines } from '../ticker';
import { Prelude } from '../prelude';

type RawP = { id: string; fn: string; ln: string; pos: string; team: string; ovr: number; hs?: string; num?: number };
const PLAYERS = (data as unknown as { players: RawP[] }).players;
const TEAM = (abbr: string) => RAW_TEAMS.find(t => t.abbr === abbr);
const POS_NAME: Record<string, string> = { QB: 'Quarterback', WR: 'Wide Receiver', EDGE: 'Edge Rusher', RB: 'Running Back', DT: 'Defensive Tackle', TE: 'Tight End', CB: 'Cornerback', S: 'Safety', LB: 'Linebacker', OT: 'Tackle' };
/** The league's best at marquee positions, one per team and in clearly different colours. */
const STARS = (() => {
  const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const far = (a: string, b: string) => { const [x, y] = [rgb(a), rgb(b)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) > 110; };
  const out: RawP[] = [];
  for (const pos of ['QB', 'WR', 'EDGE', 'RB', 'TE', 'CB', 'DT', 'S']) {
    const pool = PLAYERS.filter(q => q.pos === pos && q.hs && q.team && TEAM(q.team)).sort((a, b) => b.ovr - a.ovr);
    const p = pool.find(q => out.every(o => o.team !== q.team && far(TEAM(o.team)!.colors[0], TEAM(q.team)!.colors[0]))) ?? pool.find(q => out.every(o => o.team !== q.team));
    if (p) out.push(p);
  }
  return out;
})();
/** A team's showcase colour: its primary, or the secondary when the primary is near-black. */
const lum = (h: string) => { const n = parseInt(h.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
const showColor = (t: { colors: string[] }) => (lum(t.colors[0]) < 40 && t.colors[1] ? t.colors[1] : t.colors[0]);
const big = (url?: string) => url?.replace('f_auto,q_auto', 'f_auto,q_auto,w_900');
let openingSeen = false;

export function MainMenu() {
  const [stage, setStage] = useState<'prelude' | 'opening' | 'menu'>(openingSeen ? 'menu' : 'prelude');
  const done = () => { openingSeen = true; setStage('menu'); };
  return (
    <>
      <Menu entering={stage === 'menu'} />
      {stage === 'opening' && <Opening onDone={done} />}
      {stage === 'prelude' && <Prelude onDone={() => setStage('opening')} onSkip={done} />}
    </>
  );
}

// ---- the opening ------------------------------------------------------------------------
const OPEN_MS = 6400;
function Opening({ onDone }: { onDone: () => void }) {
  const sparks = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const t = setTimeout(onDone, OPEN_MS);
    const skip = () => onDone();
    window.addEventListener('keydown', skip);
    return () => { clearTimeout(t); window.removeEventListener('keydown', skip); };
  }, [onDone]);
  // Sparks burst when the wordmark lands.
  useEffect(() => {
    const cv = sparks.current!; const ctx = cv.getContext('2d')!;
    let raf = 0; const start = performance.now() + 4560;
    const N = 160;
    const ps = Array.from({ length: N }, () => { const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 16; return { a, v, x: 0, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.55 - 3, life: 0.6 + Math.random() * 0.9, hue: 38 + Math.random() * 20 }; });
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const w = (cv.width = cv.clientWidth * devicePixelRatio), h = (cv.height = cv.clientHeight * devicePixelRatio);
      const t = (now - start) / 1000;
      if (t < 0) return;
      ctx.globalCompositeOperation = 'lighter';
      for (const p of ps) {
        if (t > p.life) continue;
        const k = t / p.life;
        const x = w / 2 + (p.vx * t * 60 + 0) * devicePixelRatio, y = h * 0.47 + (p.vy * t * 60 + 220 * t * t) * devicePixelRatio;
        ctx.strokeStyle = `hsla(${p.hue}, 100%, ${70 - k * 30}%, ${1 - k})`;
        ctx.lineWidth = 2.2 * devicePixelRatio;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx * 2.4 * devicePixelRatio, y - (p.vy + 440 * t / 60) * 2.4 * devicePixelRatio); ctx.stroke();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  // Tunnel: 32 logos on rings receding from the camera.
  const tunnel = useMemo(() => RAW_TEAMS.map((t, i) => {
    const ring = Math.floor(i / 4), a = (i % 4) * (Math.PI / 2) + (ring % 2 ? Math.PI / 4 : 0);
    return { t, x: Math.cos(a) * 560, y: Math.sin(a) * 340, z: ring * 620 };
  }), []);
  const cuts = STARS.slice(0, 4);
  return (
    <div className="op" onClick={onDone}>
      {/* ignition */}
      <div className="op-streak" /><div className="op-flare" />
      <div className="op-season"><span>The 2026</span><b>Season</b></div>
      {/* tunnel */}
      <div className="op-tunnel-cam"><div className="op-tunnel">
        {tunnel.map(({ t, x, y, z }) => (
          <div key={t.abbr} className="op-logo" style={{ transform: `translate3d(${x}px, ${y}px, ${-z}px)`, '--c': t.colors[0] } as CSSProperties}>
            <img src={t.logo} alt="" onError={e => { (e.target as HTMLImageElement).src = t.logoAlt; }} />
          </div>
        ))}
      </div></div>
      {/* star cuts */}
      {cuts.map((p, i) => {
        const t = TEAM(p.team)!;
        return (
          <div key={p.id} className="op-cut" style={{ '--i': i, '--c1': showColor(t), '--c2': t.colors[1] } as CSSProperties}>
            <div className="op-cut-num">{p.num ?? ''}</div>
            <img className="op-cut-logo" src={t.logo} alt="" onError={e => { (e.target as HTMLImageElement).src = t.logoAlt; }} />
            <img className="op-cut-hs" src={big(p.hs)} alt="" onError={e => ((e.target as HTMLImageElement).style.visibility = 'hidden')} />
            <div className="op-cut-name"><span>{p.fn}</span><b>{p.ln}</b><em>{POS_NAME[p.pos] ?? p.pos} · {t.name}</em></div>
          </div>
        );
      })}
      {/* wordmark */}
      <div className="op-mark">
        <div className="op-rays" />
        <div className="op-word"><span className="ex">GRIDIRON</span><span className="chrome">GRIDIRON</span></div>
        <div className="op-gm">GM</div>
        <canvas ref={sparks} className="op-sparks" />
      </div>
      <div className="op-white" />
      <div className="op-skip">Press any key to skip</div>
    </div>
  );
}

// ---- the main menu ------------------------------------------------------------------------
function Menu({ entering }: { entering: boolean }) {
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [star, setStar] = useState(0);
  const [sel, setSel] = useState(0);
  const [guide, setGuide] = useState(false);
  const crawl = useMemo(() => preseasonHeadlines().map((h, i) => <em key={i}>{h}</em>), []);
  useEffect(() => { listSaves().then(setSaves); }, []);
  useEffect(() => { const t = setInterval(() => setStar(s => (s + 1) % STARS.length), 7000); return () => clearInterval(t); }, []);
  const last = saves[0];
  const lt = last ? RAW_TEAMS.find(t => t.abbr === last.team || t.name === last.team || t.nick === last.team) : undefined;
  const tiles = useMemo(() => [
    ...(last ? [{ k: 'continue', title: 'Continue', sub: `${last.name ?? ''}`.trim() || 'Franchise', meta: `${last.season} · ${last.phase}${last.week ? ` · Week ${last.week}` : ''}`, go: async () => { const l = await loadLeague(last.slot); if (l) { migrate(l); app.setLeague(l); app.replace({ id: 'hub' }); } } }] : []),
    { k: 'new', title: 'New Franchise', sub: 'Take over any of 32 teams', meta: 'Real 2026 rosters, contracts & cap', go: async () => app.go({ id: 'new' }) },
    { k: 'quick', title: 'Quick Start', sub: 'A random team, straight to the coach room', meta: 'Pro difficulty', go: async () => quickStart() },
    { k: 'load', title: 'Load Franchise', sub: `${saves.length} saved franchise${saves.length === 1 ? '' : 's'}`, meta: 'Pick up where you left off', go: async () => app.go({ id: 'load' }) },
    { k: 'guide', title: 'How to Play', sub: 'The franchise in two minutes', meta: 'Weekly actions, trades, archetypes, the press', go: async () => setGuide(true) },
  ], [saves, last]);
  useEffect(() => {
    if (!entering) return;
    const k = (e: KeyboardEvent) => {
      if (guide) { if (e.key === 'Escape' || e.key === 'Enter') setGuide(false); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') setSel(i => (i + 1) % tiles.length);
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') setSel(i => (i - 1 + tiles.length) % tiles.length);
      else if (e.key === 'Enter') tiles[sel]?.go();
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [tiles, sel, entering, guide]);
  const p = STARS[star], t = TEAM(p.team)!;
  return (
    <div className={`mm${entering ? ' in' : ''}`} style={{ '--c1': showColor(t), '--c2': t.colors[1] } as CSSProperties}>
      <div className="mm-bg" key={'bg' + star} />
      <div className="mm-beams"><i /><i /><i /></div>
      <img className="mm-mark" key={'m' + star} src={t.logo} alt="" onError={e => { (e.target as HTMLImageElement).src = t.logoAlt; }} />
      <div className="mm-num" key={'n' + star}>{p.num ?? ''}</div>
      <img className="mm-hero" key={'h' + star} src={big(p.hs)} alt="" onError={e => ((e.target as HTMLImageElement).style.visibility = 'hidden')} />
      <div className="mm-vignette" />

      <header className="mm-top">
        <div className="mm-word">GRIDIRON<b>GM</b></div>
        <div className="mm-season">2026 Season · Real Rosters</div>
      </header>

      <div className="mm-cover" key={'c' + star}>
        <div className="mm-cover-k">Cover Athlete</div>
        <div className="mm-cover-fn">{p.fn}</div>
        <div className="mm-cover-ln">{p.ln}</div>
        <div className="mm-cover-meta"><span>{POS_NAME[p.pos] ?? p.pos}</span><span>{t.name}</span><b>{p.ovr} OVR</b></div>
        <div className="mm-dots">{STARS.map((_, i) => <i key={i} className={i === star ? 'on' : ''} onClick={() => setStar(i)} />)}</div>
      </div>

      <nav className="mm-tiles">
        {tiles.map((x, i) => (
          <button key={x.k} className={`mm-tile ${x.k}${i === sel ? ' on' : ''}`} style={{ '--i': i } as CSSProperties} onMouseEnter={() => setSel(i)} onClick={() => x.go()}>
            <div className="mm-tile-art">
              {x.k === 'continue' && lt && <><div className="mm-tile-team" style={{ background: `linear-gradient(135deg, ${lt.colors[0]}, #05070c 85%)` }} /><img src={lt.logo} alt="" onError={e => { (e.target as HTMLImageElement).src = lt.logoAlt; }} /></>}
              {x.k === 'new' && <div className="mm-mosaic">{[...RAW_TEAMS, ...RAW_TEAMS].map((tm, j) => <img key={j} src={tm.logo} alt="" onError={e => { (e.target as HTMLImageElement).src = tm.logoAlt; }} />)}</div>}
              {x.k === 'load' && <div className="mm-stack">{[0, 1, 2].map(j => <i key={j} />)}</div>}
              {(x.k === 'quick' || x.k === 'guide') && <div className="mm-tile-ico">{ICONS[x.k]}</div>}
            </div>
            <div className="mm-tile-txt"><b>{x.title}</b><span>{x.sub}</span><em>{x.meta}</em></div>
          </button>
        ))}
      </nav>
      {guide && <HowToPlay onClose={() => setGuide(false)} />}
      <div className="mm-hint">↑ ↓ Select · Enter Confirm</div>

      <BottomLine tag="Around the League" items={[<span key="sec" className="sec">2026 Preseason</span>, ...crawl]} />
    </div>
  );
}

const ICONS: Record<string, ReactNode> = {
  continue: <svg viewBox="0 0 24 24"><path d="M7 5v14l11-7z" fill="currentColor" /></svg>,
  new: <svg viewBox="0 0 24 24"><path d="M12 3 20 7v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" /></svg>,
  quick: <svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor" /></svg>,
  load: <svg viewBox="0 0 24 24"><path d="M4 6h6l2 2h8v11H4z" fill="none" stroke="currentColor" strokeWidth="2" /></svg>,
  guide: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.6V14M12 17v.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>,
};

/** Start a franchise with a random team, skipping team select. */
function quickStart() {
  const teams = RAW_TEAMS.map(t => t.abbr);
  const team = teams[Math.floor(Math.random() * teams.length)];
  app.busy('Building your franchise…', async () => {
    const { createLeague } = await import('../../core/league');
    app.setLeague(createLeague(team, 'You', { difficulty: 'Pro' }));
    app.replace({ id: 'coachcreate', first: true });
  });
}

const GUIDE: [string, string][] = [
  ['The week', 'The Weekly Hub deals you decisions: holdouts, rivalries, the owner, the media. Every choice shows its stakes. Then play the game call by call, or sim it, and take the podium after.'],
  ['Your roster', 'Set the depth chart (untouched positions stay sorted for you), trade with real pick values, sign free agents, re-sign your core and keep the cap legal.'],
  ['Player growth', 'Players earn skill points by hitting goals. Spend them on archetype trees: finishing levels makes them Stars, Superstars and X-Factors. Auto-spend is available.'],
  ['Your coach', 'Earn coach XP by winning to unlock your coaching tree. What you say to the press moves fans, players, the owner and next week’s momentum.'],
  ['The owner', 'Each season the owner sets goals. Hit them and your job is safe; miss enough and you are fired.'],
  ['Controls', 'Q / E switch tabs, arrows move, Enter selects, X delegates an action card to your staff, Esc goes back.'],
];
function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="mm-guide" onClick={onClose}>
      <div className="mm-gc" onClick={e => e.stopPropagation()}>
        <div className="mm-gh"><b>How to Play</b><button className="btn" onClick={onClose}>Close</button></div>
        <div className="mm-gg">{GUIDE.map(([h, b], i) => <div key={h}><span>{String(i + 1).padStart(2, '0')}</span><b>{h}</b><p>{b}</p></div>)}</div>
      </div>
    </div>
  );
}
