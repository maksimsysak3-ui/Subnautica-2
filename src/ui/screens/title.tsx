// Title screen: a broadcast-style opening built from the league's real faces and
// marks, then the main menu. The menu has the same bones as the college game's
// (brand, big expanding tiles with tilt, a live franchise strip on Continue, a crawl
// along the bottom) dressed as a pro broadcast: a stadium at night, chrome wordmark,
// cut-corner panels and a rotating featured athlete in his team's colours.
//
// Opening (about 6.4s, skippable):
//   ignition   a light streak tears across black and leaves "THE 2026 SEASON"
//   tunnel     the camera flies through a tunnel of all 32 team logos
//   stars      rapid cuts: four of the league's best, each in his team's colours
//   wordmark   white flash, light rays, the chrome wordmark slams in with sparks
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { app, listSaves, loadLeague, useApp, type SaveMeta } from '../store';
import data from '../../data/league.json';
import { RAW_TEAMS } from '../../core/league';
import { standings, userGame, ROUND_NAME } from '../../core/season';
import type { League } from '../../core/types';
import { migrate } from './menu';
import { BottomLine, leagueCrawl, preseasonHeadlines } from '../ticker';
import '../menu.css';

type RawP = { id: string; fn: string; ln: string; pos: string; team: string; ovr: number; hs?: string; num?: number };
const PLAYERS = (data as unknown as { players: RawP[] }).players;
const TEAM = (abbr: string) => RAW_TEAMS.find(t => t.abbr === abbr);
const POS_NAME: Record<string, string> = { QB: 'Quarterback', WR: 'Wide Receiver', EDGE: 'Edge Rusher', RB: 'Running Back', DT: 'Defensive Tackle', TE: 'Tight End', CB: 'Cornerback', S: 'Safety', LB: 'Linebacker', OT: 'Tackle', G: 'Guard', C: 'Center', K: 'Kicker', P: 'Punter', LS: 'Long Snapper', FB: 'Fullback' };
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
  const [stage, setStage] = useState<'opening' | 'menu'>(openingSeen ? 'menu' : 'opening');
  const done = () => { openingSeen = true; setStage('menu'); };
  return (
    <>
      <Menu entering={stage === 'menu'} />
      {stage === 'opening' && <Opening onDone={done} />}
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
            <i className="op-cut-panel a" /><i className="op-cut-panel b" /><i className="op-cut-streak" />
            <div className="op-cut-name"><div className="op-cut-ovr"><b>{p.ovr}</b><span>OVR</span></div><span>{p.fn}</span><b><i>{p.ln}</i></b><em>{POS_NAME[p.pos] ?? p.pos} · {t.name}</em></div>
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
type RT = (typeof RAW_TEAMS)[number];
/** Who stands in the hero spot: a rotating star, or the selected tile's team's best player. */
type Hero = { fn: string; ln: string; pos: string; ovr: number; num?: number; hs?: string; team: RT };
const heroOf = (p: RawP): Hero => ({ ...p, team: TEAM(p.team)! });
const starOf = (abbr: string): Hero | undefined => { const p = PLAYERS.filter(q => q.team === abbr && q.hs).sort((a, b) => b.ovr - a.ovr)[0]; return p ? heroOf(p) : undefined; };
const ORD = ['', 'st', 'nd', 'rd', 'th'];
const PHASE: Record<string, string> = { preseason: 'Preseason', regular: 'Regular Season', playoffs: 'Playoffs', resign: 'Re-sign Period', freeagency: 'Free Agency', draft: 'Draft', camp: 'Training Camp' };
const logoErr = (t: RT) => (e: React.SyntheticEvent<HTMLImageElement>) => { const i = e.currentTarget; if (i.dataset.alt) i.style.visibility = 'hidden'; else { i.dataset.alt = '1'; i.src = t.logoAlt; } };
const TLogo = ({ t, className, size }: { t: RT; className?: string; size?: number }) => <img className={className} src={t.logo} width={size} height={size} alt="" onError={logoErr(t)} />;

/** Where a franchise stands, for the strip on the Continue tile and the hero. */
interface Franchise { L: League; team: RT; when: string; rec: string; place: string; next?: { opp: RT; home: boolean }; star?: Hero }
function franchiseOf(L: League): Franchise | undefined {
  const team = TEAM(L.user), t = L.teams[L.user];
  if (!team || !t) return undefined;
  const st = standings(L), me = st[L.user];
  const rank = Object.values(st).filter(x => L.teams[x.abbr]?.conf === t.conf && L.teams[x.abbr]?.div === t.div).sort((a, b) => b.pct - a.pct || b.w - a.w).findIndex(x => x.abbr === L.user) + 1;
  const g = L.phase === 'regular' || L.phase === 'playoffs' ? userGame(L) : undefined;
  const opp = g && !g.result ? TEAM(g.home === L.user ? g.away : g.home) : undefined;
  const best = Object.values(L.players).filter(p => p.team === L.user && p.status === 'ACT' && p.hs).sort((a, b) => b.ovr - a.ovr)[0];
  const when = L.phase === 'regular' ? `Week ${L.week}` : L.phase === 'playoffs' ? ROUND_NAME[L.week] ?? 'Playoffs' : L.phase === 'freeagency' ? `Free Agency · Day ${L.fa?.day ?? 1}` : PHASE[L.phase] ?? L.phase;
  return {
    L, team, when: `${L.season} · ${when}`,
    rec: me ? `${me.w}-${me.l}${me.t ? `-${me.t}` : ''}` : '0-0',
    place: rank ? `${rank}${ORD[rank]} ${t.conf} ${t.div}` : `${t.conf} ${t.div}`,
    next: opp && g ? { opp, home: g.home === L.user } : undefined,
    star: best ? { fn: best.fn, ln: best.ln, pos: best.pos, ovr: best.ovr, num: best.num, hs: best.hs, team } : undefined,
  };
}
const ago = (ms: number) => { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} hr ago` : `${Math.round(m / 1440)} days ago`; };

interface Tile { k: 'continue' | 'new' | 'quick' | 'load' | 'guide'; title: string; sub: string; team?: RT; go: () => void }

function Menu({ entering }: { entering: boolean }) {
  const { league: live } = useApp();
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [saved, setSaved] = useState<League | null>(null);
  const [star, setStar] = useState(0);
  const [sel, setSel] = useState(0);
  const [guide, setGuide] = useState(false);
  const quick = useMemo(() => RAW_TEAMS[Math.floor(Math.random() * RAW_TEAMS.length)], []);
  useEffect(() => { listSaves().then(setSaves); }, []);
  useEffect(() => { if (!entering) return; const t = setTimeout(() => setStar(s => (s + 1) % STARS.length), 7000); return () => clearTimeout(t); }, [entering, star]);
  // A franchise open in this session resumes as it is; otherwise the newest save is
  // opened in the background so Continue can show where it stands.
  const resume = live && !live.fired ? live : null;
  const last = saves[0];
  useEffect(() => {
    if (resume || !last) return;
    let on = true;
    loadLeague(last.slot).then(l => { if (on && l) { migrate(l); setSaved(l); } });
    return () => { on = false; };
  }, [last?.slot, !!resume]);
  const fr = useMemo(() => { const L = resume ?? saved; return L ? franchiseOf(L) : undefined; }, [resume, saved, live]);
  const contTeam = resume ? TEAM(resume.user) : last ? TEAM(last.team) : undefined;
  const cont = async () => {
    if (resume) { app.replace({ id: 'hub' }); return; }
    if (!last) return;
    const l = saved ?? await app.busy('Loading your franchise…', async () => { const x = await loadLeague(last.slot); if (x) migrate(x); return x; });
    if (l) { app.setLeague(l); app.replace({ id: 'hub' }); } else app.toast('That save could not be loaded');
  };
  const tiles: Tile[] = [
    ...(contTeam ? [{ k: 'continue' as const, title: 'Continue', sub: `${contTeam.name} · ${resume ? 'pick up where you left off' : `saved ${ago(last!.saved)}`}`, team: contTeam, go: cont }] : []),
    { k: 'new', title: 'New Franchise', sub: 'Take over any of 32 teams', go: () => app.go({ id: 'new' }) },
    { k: 'quick', title: 'Quick Start', sub: `Jump in as the ${quick.name}`, team: quick, go: () => quickStart(quick.abbr) },
    { k: 'load', title: 'Load Franchise', sub: saves.length ? `${saves.length} saved franchise${saves.length === 1 ? '' : 's'}` : 'No saved franchises yet', go: () => app.go({ id: 'load' }) },
    { k: 'guide', title: 'How to Play', sub: 'The franchise in two minutes', go: () => setGuide(true) },
  ];
  const on = Math.min(sel, tiles.length - 1);
  const cur = tiles[on];
  useEffect(() => {
    if (!entering) return;
    const k = (e: KeyboardEvent) => {
      if (guide) { if (e.key === 'Escape' || e.key === 'Enter') setGuide(false); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); setSel(i => (Math.min(i, tiles.length - 1) + 1) % tiles.length); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); setSel(i => (Math.min(i, tiles.length - 1) - 1 + tiles.length) % tiles.length); }
      else if (e.key === 'Enter') { e.preventDefault(); tiles[on]?.go(); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  // The hero: the selected team's best player, or the league's stars in rotation.
  const teamHero = cur?.k === 'continue' && cur.team ? (fr?.team.abbr === cur.team.abbr ? fr.star : undefined) ?? starOf(cur.team.abbr) : cur?.k === 'quick' ? starOf(quick.abbr) : undefined;
  const hero = teamHero ?? heroOf(STARS[star]);
  const ht = hero.team;
  const kicker = cur?.k === 'continue' ? 'Your Franchise' : cur?.k === 'quick' ? 'Quick Start' : 'Featured Athlete';
  const crawl = useMemo(() => fr ? leagueCrawl(fr.L) : [<span key="sec" className="sec">2026 Preseason</span>, ...preseasonHeadlines().map((h, i) => <em key={i}>{h}</em>)], [fr?.L]);
  const tilt = (e: React.MouseEvent<HTMLButtonElement>) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--rx', `${((e.clientY - r.top) / r.height - 0.5) * -7}deg`); e.currentTarget.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 9}deg`); };
  const untilt = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.removeProperty('--rx'); e.currentTarget.style.removeProperty('--ry'); };
  const heroKey = `${ht.abbr}-${hero.ln}`;
  return (
    <div className={`pm${entering ? ' in' : ''}`} style={{ '--c': showColor(ht), '--c2': ht.colors[1] ?? '#ffffff' } as CSSProperties}>
      <Stadium />
      <div className="pm-hero" key={'h' + heroKey}>
        <div className="pm-num">{hero.num ?? ''}</div>
        <TLogo t={ht} className="pm-mark" />
        {hero.hs && <img className="pm-ath" src={big(hero.hs)} alt="" onError={e => ((e.target as HTMLImageElement).style.visibility = 'hidden')} />}
      </div>
      <div className="pm-shade" />

      <header className="pm-top">
        <div className="pm-brand">
          <div className="pm-word"><span className="pm-chrome" data-t="GRIDIRON">GRIDIRON</span><b className="pm-plate">GM</b></div>
          <div className="pm-season"><i />2026 Season · 32 Teams · Real Rosters</div>
        </div>
        <div className="pm-topr">
          {resume && <button className="pm-opt" onClick={() => app.go({ id: 'options' })}>Options</button>}
          <span className="pm-hint"><kbd>↑</kbd><kbd>↓</kbd>Select <kbd>Enter</kbd>Confirm</span>
        </div>
      </header>

      <section className="pm-feat" key={'f' + heroKey}>
        <div className="pm-feat-k"><TLogo t={ht} />{kicker}</div>
        <div className="pm-feat-fn">{hero.fn}</div>
        <div className="pm-feat-ln">{hero.ln}</div>
        <div className="pm-feat-meta"><span>{POS_NAME[hero.pos] ?? hero.pos}</span><span>{ht.name}</span><b>{hero.ovr} OVR</b></div>
        {!teamHero && <div className="pm-dots">{STARS.map((_, i) => <i key={i} className={i === star ? 'on' : ''} onClick={() => setStar(i)} />)}</div>}
      </section>

      <nav className="pm-tiles">
        {tiles.map((t, i) => (
          <button key={t.k} className={`pm-tile ${t.k}${i === on ? ' on' : ''}`} style={{ '--i': i, ...(t.team ? { '--tc': showColor(t.team), '--tc2': t.team.colors[1] } : {}) } as CSSProperties}
            onMouseEnter={() => setSel(i)} onFocus={() => setSel(i)} onMouseMove={tilt} onMouseLeave={untilt} onClick={t.go}>
            <div className="pm-frame"><div className="pm-face">
              <div className="pm-art"><TileArt t={t} saves={saves} /></div>
              <div className="pm-idx">{String(i + 1).padStart(2, '0')}</div>
              {t.k === 'continue' && (fr && fr.team.abbr === t.team?.abbr ? (
                <div className="pm-strip">
                  <span><em>{fr.when}</em><b>{fr.rec}</b></span>
                  <span><em>Division</em><b>{fr.place}</b></span>
                  {fr.next && <span className="nx"><em>Next</em><b>{fr.next.home ? 'vs' : '@'} <TLogo t={fr.next.opp} size={22} /> {fr.next.opp.nick}</b></span>}
                </div>
              ) : last && (
                <div className="pm-strip"><span><em>{last.season} · {PHASE[last.phase] ?? last.phase}</em><b>{last.phase === 'regular' ? `Week ${last.week}` : 'Saved'}</b></span></div>
              ))}
              <div className="pm-txt"><b>{t.title}</b><span>{t.sub}</span></div>
              <i className="pm-sheen" />
            </div></div>
          </button>
        ))}
      </nav>

      {guide && <HowToPlay onClose={() => setGuide(false)} />}
      <BottomLine tag="Around the League" items={crawl} />
    </div>
  );
}

/** A stadium at night: light banks, beams, the bowl and a glowing field. */
function Stadium() {
  return (
    <div className="pm-stadium" aria-hidden>
      <div className="pm-sky" />
      <div className="pm-beams"><i /><i /><i /><i /></div>
      <div className="pm-lights l"><i /></div><div className="pm-lights r"><i /></div>
      <div className="pm-bowl"><div className="pm-flash">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${(i * 37 + 11) % 100}%`, top: `${(i * 23) % 70 + 10}%`, animationDelay: `${(i * 0.83) % 6}s` }} />)}</div></div>
      <div className="pm-field"><div className="pm-turf" /></div>
      <div className="pm-haze" />
    </div>
  );
}

function TileArt({ t, saves }: { t: Tile; saves: SaveMeta[] }) {
  switch (t.k) {
    case 'continue': case 'quick': return <><div className="pm-tteam" /><TLogo t={t.team!} className="pm-biglogo" /></>;
    case 'new': return <div className="pm-mosaic">{[...RAW_TEAMS, ...RAW_TEAMS].map((x, j) => <TLogo key={j} t={x} />)}</div>;
    case 'load': {
      const shown = saves.slice(0, 3);
      return <div className="pm-stack">{[0, 1, 2].map(j => { const s = shown[2 - j]; const st = s ? TEAM(s.team) : undefined; return <i key={j} style={st ? { '--sc': showColor(st) } as CSSProperties : undefined}>{st && <TLogo t={st} />}{s && <em>{s.season}</em>}</i>; })}</div>;
    }
    case 'guide': return (
      <svg viewBox="0 0 220 140" className="pm-play">
        <g stroke="rgba(255,255,255,.12)" strokeWidth="1">{[20, 50, 80, 110].map(y => <path key={y} d={`M0 ${y} H220`} />)}</g>
        <g fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">{[50, 80, 110, 140, 170].map(x => <circle key={x} cx={x} cy="104" r="7" />)}
          <path d="M50 97 L50 44 L84 30" /><path d="M170 97 L160 36" /><path d="M110 97 L110 66 L148 56" strokeDasharray="6 6" /><path d="M140 97 Q150 70 196 74" /></g>
        <g stroke="var(--gold, #ffd23f)" strokeWidth="3" strokeLinecap="round">{[[70, 40], [120, 30], [160, 54], [196, 46]].map(([x, y]) => <path key={x} d={`M${x - 6} ${y - 6} L${x + 6} ${y + 6} M${x + 6} ${y - 6} L${x - 6} ${y + 6}`} />)}</g>
      </svg>
    );
  }
}

/** Start a franchise with the team the Quick Start tile shows, skipping team select. */
function quickStart(team: string) {
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
    <div className="pm-guide" onClick={onClose}>
      <div className="pm-gc" onClick={e => e.stopPropagation()}>
        <div className="pm-gh"><b>How to Play</b><button className="pm-opt" onClick={onClose}>Close</button></div>
        <div className="pm-gg">{GUIDE.map(([h, b], i) => <div key={h}><span>{String(i + 1).padStart(2, '0')}</span><b>{h}</b><p>{b}</p></div>)}</div>
      </div>
    </div>
  );
}

