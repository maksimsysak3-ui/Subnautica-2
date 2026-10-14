// Gridiron GM College: the opening, the main menu and choosing a program.
//
// Opening (about 6.4s, skippable), the same bones as the pro game's:
//   ignition    a light streak and "COLLEGE FOOTBALL 2026"
//   tunnel      the camera flies through a tunnel of the top programs' logos
//   conferences four conference banners sweep in from alternating sides, each
//               carrying its schools' logos across the screen
//   wordmark    white flash, then the chrome wordmark with the COLLEGE plate
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { SCHOOLS, SEASON, CONFS, TOP25, school, rosterOf, logo, logoDark, headshot, showColor, YR, height, type School } from './data';
import { CardHost } from './PlayerCard';
import { Hub, nextGame } from './Hub';
import { open } from './store';
import { record, rankOf, weekLabel } from './season';

type Screen = { id: 'menu' } | { id: 'select' } | { id: 'hub'; team: number; tab: string };
const SAVE = 'ggm-college-save';
const loadSave = (): { team: number; at: number } | null => { try { return JSON.parse(localStorage.getItem(SAVE) ?? 'null'); } catch { return null; } };

export function App() {
  const [opening, setOpening] = useState(true);
  const [screen, setScreen] = useState<Screen>({ id: 'menu' });
  const start = (team: number) => { try { localStorage.setItem(SAVE, JSON.stringify({ team, at: Date.now() })); } catch { /* private mode */ } setScreen({ id: 'hub', team, tab: 'Home' }); };
  return (
    <>
      {screen.id === 'menu' && <Menu entering={!opening} go={setScreen} />}
      {screen.id === 'select' && <Select back={() => setScreen({ id: 'menu' })} start={start} />}
      {screen.id === 'hub' && <Hub team={screen.team} tab={screen.tab} setTab={tab => setScreen({ id: 'hub', team: screen.team, tab })} back={() => setScreen({ id: 'menu' })} />}
      {opening && <Opening onDone={() => setOpening(false)} />}
      <CardHost />
    </>
  );
}

const Logo = ({ id, size, className, style }: { id: number; size?: number; className?: string; style?: CSSProperties }) => (
  <img className={className} src={logo(id)} width={size} height={size} alt="" style={style} onError={e => { const t = e.target as HTMLImageElement; if (!t.dataset.alt) { t.dataset.alt = '1'; t.src = logoDark(id); } else t.style.visibility = 'hidden'; }} />
);

// ---- opening -------------------------------------------------------------------------------
const OPEN_MS = 6400;
const BANNERS = ['SEC', 'Big Ten', 'Big 12', 'ACC'];
function Opening({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, OPEN_MS);
    const skip = () => onDone();
    window.addEventListener('keydown', skip);
    return () => { clearTimeout(t); window.removeEventListener('keydown', skip); };
  }, [onDone]);
  const tunnel = useMemo(() => TOP25.concat(SCHOOLS.filter(s => !TOP25.includes(s)).slice(0, 7)).map((s, i) => {
    const ring = Math.floor(i / 4), a = (i % 4) * (Math.PI / 2) + (ring % 2 ? Math.PI / 4 : 0);
    return { s, x: Math.cos(a) * 560, y: Math.sin(a) * 340, z: ring * 620 };
  }), []);
  return (
    <div className="op" onClick={onDone}>
      <div className="op-streak" /><div className="op-flare" />
      <div className="op-season"><span>College Football</span><b>{SEASON}</b></div>
      <div className="op-tunnel-cam"><div className="op-tunnel">
        {tunnel.map(({ s, x, y, z }) => (
          <div key={s.id} className="op-logo" style={{ transform: `translate3d(${x}px, ${y}px, ${-z}px)`, '--c': showColor(s) } as CSSProperties}><Logo id={s.id} /></div>
        ))}
      </div></div>
      {BANNERS.map((c, i) => {
        const members = SCHOOLS.filter(s => s.conf === c).sort((a, b) => b.ovr - a.ovr);
        const lead = members[0];
        return (
          <div key={c} className={`cop-band ${i % 2 ? 'r' : 'l'}`} style={{ '--i': i, '--c': lead ? showColor(lead) : '#223' } as CSSProperties}>
            <div className="cop-name"><span>Conference</span><b>{c}</b></div>
            <div className="cop-row">{[...members, ...members].map((s, j) => <Logo key={j} id={s.id} />)}</div>
          </div>
        );
      })}
      <div className="op-mark">
        <div className="op-word"><span className="ex">GRIDIRON</span><span className="chrome">GRIDIRON</span></div>
        <div className="op-gm">COLLEGE</div>
      </div>
      <div className="op-white" />
      <div className="op-skip">Press any key to skip</div>
    </div>
  );
}

// ---- main menu -----------------------------------------------------------------------------
// Four large tiles, Madden-style: each is its own piece of art (no faces, no mascots).
function Menu({ entering, go }: { entering: boolean; go: (s: Screen) => void }) {
  const save = loadSave();
  const saved = save ? school(save.team) : undefined;
  const [sel, setSel] = useState(0);
  const [about, setAbout] = useState(false);
  const qs = useMemo(() => TOP25[Math.floor(Math.random() * 10)], []);
  // The saved dynasty's live state for the Continue tile and the ticker.
  const dyn = useMemo(() => (saved ? open(saved.id) : undefined), [saved?.id]);
  const se = dyn?.season;
  const nxt = saved && se && dyn ? nextGame(saved, se, dyn.week) : null;
  const poll = se?.polls[se.polls.length - 1]?.slice(0, 25).map(id => school(id)) ?? TOP25;
  const tilt = (e: React.MouseEvent<HTMLButtonElement>) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--rx', `${((e.clientY - r.top) / r.height - 0.5) * -6}deg`); e.currentTarget.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 8}deg`); };
  const tiles = [
    ...(saved ? [{ k: 'Continue', sub: `${saved.school} · your dynasty`, art: 'continue', run: () => go({ id: 'hub', team: saved.id, tab: 'Home' }) }] : []),
    { k: 'New Dynasty', sub: `Take over any of ${SCHOOLS.length} FBS programs`, art: 'new', run: () => go({ id: 'select' }) },
    { k: 'Quick Start', sub: `Jump in as ${qs.school}`, art: 'quick', run: () => go({ id: 'hub', team: qs.id, tab: 'Home' }) },
    { k: 'How to Play', sub: 'Recruit, develop, win', art: 'how', run: () => setAbout(true) },
  ];
  useEffect(() => {
    if (!entering) return;
    const k = (e: KeyboardEvent) => {
      if (about) { if (e.key === 'Escape' || e.key === 'Enter') setAbout(false); return; }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setSel(i => (i + 1) % tiles.length);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setSel(i => (i - 1 + tiles.length) % tiles.length);
      else if (e.key === 'Enter') tiles[sel]?.run();
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [entering, sel, tiles.length, about]);
  const cur = tiles[sel]?.art === 'continue' && saved ? saved : tiles[sel]?.art === 'quick' ? qs : undefined;
  return (
    <div className={`mn${entering ? ' in' : ''}`} style={{ '--c': cur ? showColor(cur) : '#2f6fdf' } as CSSProperties}>
      <div className="mn-bg" />
      <header className="mn-top">
        <div className="mn-word">GRIDIRON <b>COLLEGE</b></div>
        <div className="mn-season">{SEASON} Season · {SCHOOLS.length} FBS programs · Real rosters</div>
      </header>
      <nav className="mn-tiles">
        {tiles.map((t, i) => {
          const tc = t.art === 'continue' && saved ? showColor(saved) : t.art === 'quick' ? showColor(qs) : undefined;
          return (
            <button key={t.k} className={`mn-tile ${t.art}${i === sel ? ' on' : ''}`} style={{ '--i': i, ...(tc ? { '--tc': tc } : {}) } as CSSProperties} onMouseEnter={() => setSel(i)} onMouseMove={tilt} onMouseLeave={e => { e.currentTarget.style.removeProperty('--rx'); e.currentTarget.style.removeProperty('--ry'); }} onClick={t.run}>
              <div className="mn-art">
                {t.art === 'new' && <div className="mn-mosaic">{[...SCHOOLS, ...SCHOOLS].map((x, j) => <Logo key={j} id={x.id} />)}</div>}
                {(t.art === 'continue' || t.art === 'quick') && <Logo id={(t.art === 'continue' ? saved! : qs).id} className="mn-biglogo" />}
                {t.art === 'how' && <svg viewBox="0 0 200 140" className="mn-play"><g fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">{[40, 70, 100, 130, 160].map(x => <circle key={x} cx={x} cy="96" r="7" />)}<path d="M40 89 L40 40 L70 30" /><path d="M160 89 L150 34" /><path d="M100 89 L100 60 L136 52" strokeDasharray="6 6" /></g><g stroke="#f5c443" strokeWidth="3" strokeLinecap="round">{[[60, 40], [110, 30], [150, 50]].map(([x, y]) => <path key={x} d={`M${x - 6} ${y - 6} L${x + 6} ${y + 6} M${x + 6} ${y - 6} L${x - 6} ${y + 6}`} />)}</g></svg>}
              </div>
              {t.art === 'continue' && se && dyn && saved && (
                <div className="mn-dyn">
                  <span><em>{weekLabel(dyn.week)}</em><b>{record(saved.id, se).s}</b></span>
                  {rankOf(saved.id, se) > 0 && <span><em>AP poll</em><b>#{rankOf(saved.id, se)}</b></span>}
                  {nxt && <span className="nx"><em>Next</em><b>{nxt.home ? 'vs' : '@'} <Logo id={nxt.o.id} size={20} /> {nxt.o.school}</b></span>}
                </div>
              )}
              <div className="mn-txt"><b>{t.k}</b><span>{t.sub}</span></div>
            </button>
          );
        })}
      </nav>
      <div className="cm-ticker"><div className="cm-ticker-k">{se && dyn && dyn.week > 0 ? `AP Top 25 · ${weekLabel(dyn.week)}` : 'Preseason Top 25'}</div><div className="cm-ticker-run"><div>
        {[...poll, ...poll].map((t, i) => <span key={i}><em>{(i % 25) + 1}</em><Logo id={t.id} size={18} />{t.school}</span>)}
      </div></div></div>
      {about && (
        <div className="cm-modal" onClick={() => setAbout(false)}>
          <div onClick={e => e.stopPropagation()}>
            <h2>How to play</h2>
            <p>Pick a program and build it into a champion. Every FBS roster is real, with ratings built from three seasons of production.</p>
            <p>Each week: set your depth chart, make the week's decisions, and recruit the class of 2027 against rival programs. Scout prospects to learn what they care about, then sell it.</p>
            <button className="cbtn primary" onClick={() => setAbout(false)}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- choose a program ----------------------------------------------------------------------
function Select({ back, start }: { back: () => void; start: (id: number) => void }) {
  const [conf, setConf] = useState<string>('All');
  const [q, setQ] = useState('');
  const list = SCHOOLS.filter(s => (conf === 'All' || s.conf === conf) && s.school.toLowerCase().includes(q.toLowerCase()));
  const [pick, setPick] = useState<School>(list[0] ?? SCHOOLS[0]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') back(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [back]);
  const roster = rosterOf(pick.id);
  return (
    <div className="cs" style={{ '--c': showColor(pick) } as CSSProperties}>
      <header className="cs-top">
        <button className="cbtn ghost" onClick={back}>‹ Menu</button>
        <h1>Choose your program</h1>
        <input placeholder="Search schools" value={q} onChange={e => setQ(e.target.value)} />
      </header>
      <div className="cs-confs">{['All', ...CONFS].map(c => <button key={c} className={conf === c ? 'on' : ''} onClick={() => setConf(c)}>{c}</button>)}</div>
      <div className="cs-body">
        <div className="cs-grid">
          {list.map(s => (
            <button key={s.id} className={`cs-card${s.id === pick.id ? ' on' : ''}`} style={{ '--tc': showColor(s) } as CSSProperties} onClick={() => setPick(s)} onDoubleClick={() => start(s.id)}>
              <Logo id={s.id} size={54} />
              <b>{s.school}</b>
              <span>{s.conf}</span>
              <em>{s.ovr}</em>
            </button>
          ))}
          {!list.length && <div className="cs-empty">No schools match.</div>}
        </div>
        <aside className="cs-detail" key={pick.id}>
          <div className="cs-hero">
            <Logo id={pick.id} className="cs-hero-logo" />
            <div><div className="cs-hero-name">{pick.school}</div><div className="cs-hero-sub">{pick.mascot} · {pick.conf}</div></div>
          </div>
          <div className="cs-kpis">
            <div><b>{pick.ovr}</b><span>Team OVR</span></div>
            <div><b>{TOP25.indexOf(pick) >= 0 ? `#${TOP25.indexOf(pick) + 1}` : 'NR'}</b><span>Preseason</span></div>
            <div><b>{'★'.repeat(Math.max(1, Math.round(pick.prestige)))}</b><span>Prestige</span></div>
            <div><b>{roster.length}</b><span>Roster</span></div>
          </div>
          <div className="cs-sec">Top players</div>
          <div className="cs-roster">{roster.slice(0, 8).map(p => (
            <div key={p.id} className="cs-p">
              <div className="cs-hs">{headshot(p) ? <img src={headshot(p)} alt="" onError={e => ((e.target as HTMLImageElement).style.visibility = 'hidden')} /> : null}</div>
              <div className="cs-pn"><b>{p.fn} {p.ln}</b><span>{p.pos} · {YR[p.yr]} · {height(p.ht)}, {p.wt}</span></div>
              <em>{p.ovr}</em>
            </div>
          ))}</div>
          <button className="cbtn primary big" onClick={() => start(pick.id)}>Coach {pick.school} ›</button>
        </aside>
      </div>
    </div>
  );
}

export { Logo };
