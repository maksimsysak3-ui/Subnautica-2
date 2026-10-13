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
import { Mascot, Field3D } from './art';
import { Hub } from './Hub';

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
// Simple and clean: the featured program's colours, its field, mascot and logo, and four big
// buttons along the top.
function Menu({ entering, go }: { entering: boolean; go: (s: Screen) => void }) {
  const save = loadSave();
  const [feat, setFeat] = useState(0);
  const [sel, setSel] = useState(0);
  const [about, setAbout] = useState(false);
  useEffect(() => { const t = setInterval(() => setFeat(f => (f + 1) % 10), 7000); return () => clearInterval(t); }, []);
  const items = [
    ...(save && school(save.team) ? [{ k: 'Continue', sub: school(save.team).school, run: () => go({ id: 'hub', team: save.team, tab: 'Home' }) }] : []),
    { k: 'New Dynasty', sub: `Take over any of ${SCHOOLS.length} FBS programs`, run: () => go({ id: 'select' }) },
    { k: 'Quick Start', sub: 'A random program, straight in', run: () => { const s = SCHOOLS[Math.floor(Math.random() * SCHOOLS.length)]; go({ id: 'hub', team: s.id, tab: 'Home' }); } },
    { k: 'How to Play', sub: 'Recruit, develop, win the natty', run: () => setAbout(true) },
  ];
  useEffect(() => {
    if (!entering) return;
    const k = (e: KeyboardEvent) => {
      if (about) { if (e.key === 'Escape' || e.key === 'Enter') setAbout(false); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') setSel(i => (i + 1) % items.length);
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') setSel(i => (i - 1 + items.length) % items.length);
      else if (e.key === 'Enter') items[sel]?.run();
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [entering, sel, items.length, about]);
  const s = TOP25[feat], top = rosterOf(s.id).filter(p => p.hs).slice(0, 3), c = showColor(s);
  return (
    <div className={`cm${entering ? ' in' : ''}`} style={{ '--c': c, '--c2': s.c2 } as CSSProperties}>
      <div className="cm-sky" />
      <Field3D s={s} key={'f3' + feat} />
      <header className="cm-head">
        <div><div className="cm-word">GRIDIRON <b>COLLEGE</b></div><div className="cm-season">{SEASON} Season · {SCHOOLS.length} Programs · Real Rosters</div></div>
        <nav className="pills">
          {items.map((it, i) => (
            <button key={it.k} className={`pill big${i === sel ? ' on' : ''}`} style={{ '--i': i } as CSSProperties} onMouseEnter={() => setSel(i)} onClick={it.run}><b>{it.k}</b><span>{it.sub}</span></button>
          ))}
        </nav>
      </header>

      <section className="cm-show" key={'s' + feat}>
        <div className="cm-mascot"><Mascot s={s} size={360} /><Logo id={s.id} className="cm-badge" /></div>
        <div className="cm-card">
          <div className="cm-rank">No. {feat + 1} · Preseason</div>
          <div className="cm-school">{s.school}</div>
          <div className="cm-mascot-n">{s.mascot} · {s.conf}</div>
          <div className="cm-stats"><div><b>{s.ovr}</b><span>Team OVR</span></div><div><b className="gold">{'★'.repeat(Math.max(1, Math.round(s.prestige)))}</b><span>Prestige</span></div></div>
          <div className="cm-stars">{top.map(p => (
            <div key={p.id} className="cm-star"><div><img src={headshot(p)} alt="" onError={e => ((e.target as HTMLImageElement).style.visibility = 'hidden')} /></div><b>{p.fn[0]}. {p.ln}</b><span>{p.pos} · {YR[p.yr]} · {p.ovr}</span></div>
          ))}</div>
        </div>
      </section>
      <div className="cm-ticker"><div className="cm-ticker-k">Preseason Top 25</div><div className="cm-ticker-run"><div>
        {[...TOP25, ...TOP25].map((t, i) => <span key={i}><em>{(i % 25) + 1}</em><Logo id={t.id} size={18} />{t.school}</span>)}
      </div></div></div>
      {about && (
        <div className="cm-modal" onClick={() => setAbout(false)}>
          <div onClick={e => e.stopPropagation()}>
            <h2>How to play</h2>
            <p>Pick a program and build it into a champion. Every FBS roster is real, with the players' own headshots and ratings built from three seasons of production.</p>
            <p>Recruit high-school talent, develop four-year careers, work the transfer portal and NIL, and chase a playoff spot through your conference.</p>
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
