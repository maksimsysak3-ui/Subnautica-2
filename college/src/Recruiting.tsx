// The recruiting office: your board, the national search, your commits, and a dossier for each
// prospect (scouting report, priorities, the race between schools, and your actions this week).
import { useMemo, useState, type CSSProperties } from 'react';
import { RECRUIT_FACES } from './recruitfaces';
import { playWeek, weekLabel } from './season';
import { school, showColor, type School } from './data';
import { useDynasty, update } from './store';
import { recruitClass, stateOf, untouchedCommit, act, endWeek, grade, letter, fit, PRIORITIES, COST, HOURS, SCHOLARSHIPS, type Recruit, type Priority } from './recruiting';
import { Logo } from './App';

// High school colours behind each portrait.
const HS_COL = [['#0b2a5b', '#f2b705'], ['#7a0f1f', '#e9e9e9'], ['#0d4d2a', '#e8e8e8'], ['#3b1a68', '#f5c400'], ['#1b1b1b', '#d42027'], ['#0f5fa8', '#ffffff'], ['#c2410c', '#111111'], ['#4b5563', '#facc15'], ['#14532d', '#fbbf24'], ['#1e3a8a', '#ef4444']];
/** A prospect's photo: a newly generated set of fictional recruits, separate from the pro game's faces. */
export function RecruitFace({ x, size }: { x: Recruit; size: number }) {
  const hs = HS_COL[(x.n * 7 + x.state.length) % HS_COL.length];
  return <div className="rf" style={{ width: size, height: size, '--h1': hs[0], '--h2': hs[1] } as CSSProperties}><img src={RECRUIT_FACES[(x.face * 37) % RECRUIT_FACES.length]} alt="" draggable={false} />{size >= 80 && <i>{x.pos}</i>}</div>;
}
const Stars = ({ n }: { n: number }) => <span className="gold rstars">{'★'.repeat(n)}<span className="dimstar">{'★'.repeat(5 - n)}</span></span>;
const ht = (h: number) => `${Math.floor(h / 12)}'${h % 12}"`;
const STAR_PTS = [0, 0, 20, 45, 90, 160];
/** A ring gauge: value out of max, with the label inside. */
const Ring = ({ v, max, label, sub, c }: { v: number; max: number; label: string; sub: string; c?: string }) => {
  const k = Math.max(0, Math.min(1, v / max)), R = 26, L = 2 * Math.PI * R;
  return (
    <div className="rw-ring"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="6" /><circle cx="32" cy="32" r={R} fill="none" stroke={c ?? 'var(--c)'} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${L * k} ${L}`} transform="rotate(-90 32 32)" /></svg><b>{label}</b><span>{sub}</span></div>
  );
};

export function RecruitingTab({ s }: { s: School }) {
  const d = useDynasty(s.id);
  const all = recruitClass();
  const [view, setView] = useState<'Board' | 'Search' | 'Commits' | 'Class rankings'>('Board');
  const [sel, setSel] = useState<string | null>(null);
  const [pos, setPos] = useState('All'), [stars, setStars] = useState(0), [stt, setStt] = useState('All');
  const status = (x: Recruit) => { const st = d.recruits[x.id]; if (st?.committed) return st.committed; return d.board.includes(x.id) ? undefined : untouchedCommit(x, d.week, s.id); };
  const board = d.board.map(id => all.find(x => x.id === id)!).filter(Boolean);
  const commits = all.filter(x => d.recruits[x.id]?.committed === s.id);
  const offered = Object.values(d.recruits).filter(r => r.offered).length;
  const search = all.filter(x => (pos === 'All' || x.pos === pos) && (!stars || x.stars === stars) && (stt === 'All' || x.state === stt)).slice(0, 120);
  // National class rankings: everyone's commits so far, by points.
  const classes = useMemo(() => {
    const pts: Record<number, { n: number; p: number; top: number }> = {};
    for (const x of all) { const c = status(x); if (!c) continue; const e = (pts[c] ??= { n: 0, p: 0, top: 0 }); e.n++; e.p += STAR_PTS[x.stars]; e.top = Math.max(e.top, x.stars); }
    return Object.entries(pts).map(([id, v]) => ({ id: Number(id), ...v })).sort((a, b) => b.p - a.p);
  }, [d.week, d.recruits, d.board]);
  const myRank = classes.findIndex(c => c.id === s.id) + 1;
  const myPts = commits.reduce((a, x) => a + STAR_PTS[x.stars], 0);
  const cur = sel ? all.find(x => x.id === sel) : undefined;
  const advance = () => update(x => { playWeek(x); endWeek(x); });
  const list = view === 'Board' ? board : view === 'Commits' ? commits : search;
  return (
    <div className="rw">
      <header className="rw-hero">
        <div className="rw-class">
          <span className="rw-k">Class of 2027 · {weekLabel(d.week)}</span>
          <div className="rw-rank"><b>{myRank ? `#${myRank}` : 'NR'}</b><div><em>National class rank</em><span>{commits.length} commits · {myPts} pts</span></div></div>
          <div className="rw-strip">{commits.slice(0, 10).map(x => <button key={x.id} onClick={() => { setSel(x.id); setView('Commits'); }} title={`${x.fn} ${x.ln}`}><RecruitFace x={x} size={40} /><i>{x.stars}</i></button>)}{!commits.length && <span className="dim">No commitments yet. Build your board and start making calls.</span>}</div>
        </div>
        <div className="rw-gauges">
          <Ring v={d.hours} max={HOURS} label={`${d.hours}`} sub="Hours left" />
          <Ring v={offered} max={SCHOLARSHIPS} label={`${offered}/${SCHOLARSHIPS}`} sub="Offers" c="#f5c542" />
          <Ring v={d.nilBudget} max={Math.max(d.nilBudget, (school(s.id).prestige ?? 2) * 350_000)} label={`$${(d.nilBudget / 1e6).toFixed(1)}M`} sub="NIL budget" c="#41d07a" />
          <button className="cbtn primary rw-end" onClick={advance}>End week ›<small>Plays this week's games too</small></button>
        </div>
      </header>
      <nav className="rw-tabs">{(['Board', 'Search', 'Commits', 'Class rankings'] as const).map(v => <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{v}{v === 'Board' ? <i>{board.length}</i> : v === 'Commits' ? <i>{commits.length}</i> : null}</button>)}</nav>
      {view === 'Class rankings' ? (
        <section className="hc rw-classes">{classes.slice(0, 30).map((c, i) => (
          <div key={c.id} className={c.id === s.id ? 'me' : ''} style={{ '--tc': showColor(school(c.id)) } as CSSProperties}><em>{i + 1}</em><Logo id={c.id} size={28} /><b>{school(c.id).school}</b><span>{c.n} commits · top {c.top}★</span><div className="bar"><i style={{ width: `${(c.p / Math.max(1, classes[0].p)) * 100}%` }} /></div><strong>{c.p}</strong></div>
        ))}{!classes.length && <p className="dim">Nobody has a commitment yet.</p>}</section>
      ) : (
      <div className="rw-body">
        <section className="rw-list">
          {view === 'Search' && (
            <div className="rc-filters">
              <select value={pos} onChange={e => setPos(e.target.value)}>{['All', 'QB', 'RB', 'WR', 'TE', 'OT', 'G', 'C', 'EDGE', 'DT', 'LB', 'CB', 'S', 'K', 'P'].map(p => <option key={p}>{p}</option>)}</select>
              <select value={stars} onChange={e => setStars(Number(e.target.value))}><option value={0}>All stars</option>{[5, 4, 3, 2].map(n => <option key={n} value={n}>{n} stars</option>)}</select>
              <select value={stt} onChange={e => setStt(e.target.value)}><option>All</option>{[...new Set(all.map(x => x.state))].sort().map(x => <option key={x}>{x}</option>)}</select>
            </div>
          )}
          {list.map(x => {
            const st = stateOf(d, x), c = status(x), mine = st.int[s.id] ?? 0;
            const ranked = Object.entries(st.int).sort((a, b) => b[1] - a[1]);
            const place = ranked.findIndex(([k]) => Number(k) === s.id) + 1;
            const onBoard = d.board.includes(x.id);
            const tag = c ? (c === s.id ? ['Committed', 'won'] : ['Gone', 'lost']) : !onBoard ? ['Not contacted', ''] : place === 1 ? ['Leading', 'lead'] : place && place <= 3 ? ['In the mix', 'mix'] : ['Trailing', 'trail'];
            return (
              <button key={x.id} className={`rw-card s${x.stars}${sel === x.id ? ' on' : ''}`} onClick={() => setSel(x.id)}>
                <RecruitFace x={x} size={58} />
                <div className="rw-id"><b>{x.fn} {x.ln}</b><Stars n={x.stars} /><span><u>{x.pos}</u>{x.city}, {x.state}</span><span className="rw-rk">#{x.rank} national · #{x.posRank} {x.pos}</span></div>
                <div className="rw-pri">{[0, 1, 2].map(i => <i key={i} className={i < st.scouted ? 'on' : ''}>{i < st.scouted ? x.pri[i] : '?'}</i>)}</div>
                <div className="rw-stat">
                  {c ? <Logo id={c} size={30} /> : onBoard ? <Ring v={mine} max={100} label={`${mine}`} sub={place ? `${place} of ${ranked.length}` : ''} /> : <span className="rw-rivals">{ranked.slice(0, 3).map(([k]) => <Logo key={k} id={Number(k)} size={20} />)}</span>}
                  <em className={`rw-tag ${tag[1]}`}>{tag[0]}</em>
                </div>
              </button>
            );
          })}
          {view === 'Board' && !board.length && <div className="pc-empty">Your board is empty. Find prospects in Search and contact them to add them.</div>}
        </section>
        {cur ? <Dossier s={s} x={cur} /> : <section className="hc rc-dossier empty"><div className="rw-pick"><svg viewBox="0 0 120 120" width="110" height="110"><circle cx="60" cy="44" r="24" fill="rgba(255,255,255,.12)" /><path d="M16 120 C18 88 36 76 60 76 C84 76 102 88 104 120Z" fill="rgba(255,255,255,.12)" /></svg><p className="dim">Select a prospect to open his dossier.</p></div></section>}
      </div>
      )}
    </div>
  );
}

/** Combine numbers from size, position and grade (shown once he has been scouted). */
function combine(x: Recruit): [string, string][] {
  const fast = ['WR', 'CB', 'RB', 'S'].includes(x.pos) ? 4.42 : ['LB', 'EDGE', 'TE', 'QB'].includes(x.pos) ? 4.62 : ['K', 'P'].includes(x.pos) ? 4.9 : 5.1;
  const forty = (fast + ((x.n * 7) % 17) / 100 - (x.ovr - 75) * 0.004).toFixed(2);
  const vert = Math.round(30 + (5.2 - Number(forty)) * 12 + (x.n % 5));
  return [['40', forty], ['Vert', `${vert}"`], ['Shuttle', (4 + (Number(forty) - 4.3) * 0.55 + (x.n % 9) / 100).toFixed(2)], ['Wingspan', `${Math.round(x.ht * 1.03)}"`]];
}

function Dossier({ s, x }: { s: School; x: Recruit }) {
  const d = useDynasty(s.id), st = stateOf(d, x);
  const [msg, setMsg] = useState('');
  const [nil, setNil] = useState(st.nil);
  const committed = st.committed ?? (d.board.includes(x.id) ? undefined : untouchedCommit(x, d.week, s.id));
  const run = (kind: Parameters<typeof act>[2], arg?: Priority | number) => update(dd => setMsg(act(dd, x, kind, arg)));
  const known = x.pri.slice(0, st.scouted);
  // Scouting narrows his rating: a wide range until you have seen him, his true number once fully scouted.
  const spread = [12, 7, 3, 0][st.scouted];
  const lo = Math.max(40, x.ovr - spread), hi = Math.min(99, x.ovr + spread);
  const race = Object.entries(st.int).map(([k, v]) => [Number(k), v] as const).sort((a, b) => b[1] - a[1]);
  const radar = ['Speed', 'Strength', 'Technique', 'Football IQ', 'Size', 'Upside'].map((k, i) => Math.max(30, Math.min(99, x.ovr + ((x.n * (i + 3)) % 17) - 8 + (k === 'Upside' ? x.pot - x.ovr : 0))));
  return (
    <section className="hc rc-dossier" key={x.id}>
      <header className="rc-dh rw-dh">
        <RecruitFace x={x} size={120} />
        <div className="rc-did"><span>{x.city}, {x.state} · Class of 2027</span><b>{x.fn} {x.ln}</b><div><Stars n={x.stars} /><em>{x.pos} · {ht(x.ht)} · {x.wt} lbs</em></div><div className="rc-ranks"><i>#{x.rank} National</i><i>#{x.posRank} {x.pos}</i><i>#{x.n % 40 + 1} in {x.state}</i></div>
          <div className="rw-combine">{combine(x).map(([k, v]) => <span key={k}><em>{k}</em>{st.scouted ? v : '—'}</span>)}</div></div>
        <div className="rc-rating"><span>Scouted rating</span><b>{lo === hi ? x.ovr : `${lo}-${hi}`}</b><em>{['Unscouted', 'Partial', 'Detailed', 'Complete'][st.scouted]}</em></div>
      </header>
      <div className="rc-grid">
        <div>
          <h4>Scouting report</h4>
          <svg viewBox="-110 -110 220 220" className="rc-radar">
            {[1, 0.66, 0.33].map(r => <polygon key={r} points={radar.map((_, i) => { const a = (i / 6) * Math.PI * 2 - Math.PI / 2; return `${Math.cos(a) * 90 * r},${Math.sin(a) * 90 * r}`; }).join(' ')} fill="none" stroke="rgba(255,255,255,.1)" />)}
            <polygon points={radar.map((v, i) => { const a = (i / 6) * Math.PI * 2 - Math.PI / 2, r = st.scouted ? v / 100 : 0.5; return `${Math.cos(a) * 90 * r},${Math.sin(a) * 90 * r}`; }).join(' ')} fill={st.scouted ? 'color-mix(in srgb, var(--c) 45%, transparent)' : 'rgba(255,255,255,.06)'} stroke={st.scouted ? 'var(--c)' : 'rgba(255,255,255,.25)'} strokeDasharray={st.scouted ? undefined : '4 4'} strokeWidth="2" />
            {radar.map((v, i) => { const a = (i / 6) * Math.PI * 2 - Math.PI / 2; return <text key={i} x={Math.cos(a) * 104} y={Math.sin(a) * 104 + 4} textAnchor="middle" fontSize="10" fill="#9aa3b2">{['SPD', 'STR', 'TEC', 'IQ', 'SIZE', 'UPS'][i]}{st.scouted >= 2 ? ` ${v}` : ''}</text>; })}
          </svg>
          {!st.scouted && <p className="dim small">Scout him to see the report.</p>}
        </div>
        <div>
          <h4>What matters to him</h4>
          <div className="rc-pris">{[0, 1, 2].map(i => {
            const p = x.pri[i], open = i < st.scouted, g = open ? grade(s, x, p, st.nil) : 0;
            return <div key={i} className={open ? 'open' : ''}><em>#{i + 1}</em><b>{open ? p : 'Unknown'}</b>{open ? <span className={`gr g${letter(g)[0]}`}>{letter(g)}</span> : <span className="gr">?</span>}</div>;
          })}</div>
          <p className="dim small">Your grade is how well {s.school} sells that priority. Fit overall: <b>{st.scouted >= 3 ? letter(fit(s, x, st.nil)) : '?'}</b></p>
        </div>
      </div>
      <h4>The race</h4>
      <div className="rc-race">{race.map(([id, v]) => (
        <div key={id} className={id === s.id ? 'me' : ''} style={{ '--tc': showColor(school(id)) } as CSSProperties}>
          <Logo id={id} size={24} /><b>{school(id).school}</b><div className="bar"><i style={{ width: `${v}%` }} /></div><em>{v}</em>
        </div>
      ))}</div>
      {committed ? <div className="rc-done"><Logo id={committed} size={34} />{committed === s.id ? 'Committed to you.' : `Committed to ${school(committed).school}.${st.lostReason ? ` ${st.lostReason}.` : ''}`}</div> : (
        <>
          <h4>This week</h4>
          <div className="rc-acts">
            <button onClick={() => run('scout')} disabled={st.scouted >= 3}>Scout <span>{COST.scout} hrs · reveals a priority</span></button>
            <button onClick={() => run('call')}>Call <span>{COST.call} hrs · small boost</span></button>
            <button onClick={() => run('visit')}>Home visit <span>{COST.visit} hrs · big boost, reveals a priority</span></button>
            <button onClick={() => run('offer')} disabled={st.offered}>{st.offered ? 'Offered' : 'Offer scholarship'} <span>Required to commit</span></button>
          </div>
          <div className="rc-sell">
            <span>Hard sell ({COST.sell} hrs, once a week). Pitch what he cares about:</span>
            <div>{PRIORITIES.map(p => <button key={p} disabled={st.hard} className={known.includes(p) ? 'known' : ''} onClick={() => run('sell', p)}>{p}<em>{letter(grade(s, x, p, st.nil))}</em></button>)}</div>
          </div>
          <div className="rc-nil"><span>NIL offer</span><input type="range" min={0} max={Math.max(st.nil, Math.min(1_500_000, d.nilBudget + st.nil))} step={25000} value={nil} onChange={e => setNil(Number(e.target.value))} /><b>${Math.round(nil / 1000)}K</b><button className="cbtn sm" onClick={() => run('nil', nil)}>Set</button></div>
        </>
      )}
      {(msg || st.log.length > 0) && <div className="rc-log">{msg && <b>{msg}</b>}{st.log.map((l, i) => <div key={i}>{l}</div>)}</div>}
    </section>
  );
}
