// The recruiting office: your board, the national search, your commits, and a dossier for each
// prospect (scouting report, priorities, the race between schools, and your actions this week).
import { useMemo, useState, type CSSProperties } from 'react';
import { FaceArt } from '../../src/ui/face';
import type { Player as NflPlayer } from '../../src/core/types';
import { school, showColor, type School } from './data';
import { useDynasty, update } from './store';
import { recruitClass, stateOf, untouchedCommit, act, endWeek, grade, letter, fit, PRIORITIES, COST, HOURS, SCHOLARSHIPS, type Recruit, type Priority } from './recruiting';
import { Logo } from './App';

/** A prospect's AI-generated face, wearing his high school's colours. */
export function RecruitFace({ x, size }: { x: Recruit; size: number }) {
  const p = useMemo(() => ({ id: `P0000-${x.n}`, col: `${x.city} High ${x.n % 7}`, status: 'PROSPECT', pos: x.pos, face: x.n }) as unknown as NflPlayer, [x.n]);
  return <div className="rf" style={{ width: size, height: size }}><FaceArt p={p} size={size} /></div>;
}
const Stars = ({ n }: { n: number }) => <span className="gold rstars">{'★'.repeat(n)}<span className="dimstar">{'★'.repeat(5 - n)}</span></span>;
const ht = (h: number) => `${Math.floor(h / 12)}'${h % 12}"`;

export function RecruitingTab({ s }: { s: School }) {
  const d = useDynasty(s.id);
  const all = recruitClass();
  const [view, setView] = useState<'Board' | 'Search' | 'Commits'>('Board');
  const [sel, setSel] = useState<string | null>(null);
  const [pos, setPos] = useState('All'), [stars, setStars] = useState(0), [stt, setStt] = useState('All');
  const status = (x: Recruit) => { const st = d.recruits[x.id]; if (st?.committed) return st.committed; return d.board.includes(x.id) ? undefined : untouchedCommit(x, d.week, s.id); };
  const board = d.board.map(id => all.find(x => x.id === id)!).filter(Boolean);
  const commits = all.filter(x => d.recruits[x.id]?.committed === s.id);
  const offered = Object.values(d.recruits).filter(r => r.offered).length;
  const search = all.filter(x => (pos === 'All' || x.pos === pos) && (!stars || x.stars === stars) && (stt === 'All' || x.state === stt)).slice(0, 120);
  const pts = (cs: Recruit[]) => cs.reduce((a, x) => a + [0, 0, 20, 45, 90, 160][x.stars], 0);
  const cur = sel ? all.find(x => x.id === sel) : undefined;
  return (
    <div className="rc">
      <div className="rc-top">
        <div className="rc-k"><b>{d.hours}<small>/{HOURS}</small></b><span>Hours this week</span></div>
        <div className="rc-k"><b>{offered}<small>/{SCHOLARSHIPS}</small></b><span>Offers out</span></div>
        <div className="rc-k"><b>${(d.nilBudget / 1e6).toFixed(2)}M</b><span>NIL budget</span></div>
        <div className="rc-k"><b>{commits.length}</b><span>Commits</span></div>
        <div className="rc-k"><b>{pts(commits)}</b><span>Class points</span></div>
        <div className="spacer" />
        <div className="rc-week"><span>Week {d.week}</span><button className="cbtn primary" onClick={() => update(endWeek)}>End recruiting week ›</button></div>
      </div>
      <div className="pills" style={{ marginBottom: 14 }}>{(['Board', 'Search', 'Commits'] as const).map(v => <button key={v} className={`pill${view === v ? ' on' : ''}`} onClick={() => setView(v)}>{v}{v === 'Board' ? ` (${board.length})` : v === 'Commits' ? ` (${commits.length})` : ''}</button>)}</div>
      <div className="rc-body">
        <section className="hc rc-list">
          {view === 'Search' && (
            <div className="rc-filters">
              <select value={pos} onChange={e => setPos(e.target.value)}>{['All', 'QB', 'RB', 'WR', 'TE', 'OT', 'G', 'C', 'EDGE', 'DT', 'LB', 'CB', 'S', 'K', 'P'].map(p => <option key={p}>{p}</option>)}</select>
              <select value={stars} onChange={e => setStars(Number(e.target.value))}><option value={0}>All stars</option>{[5, 4, 3, 2].map(n => <option key={n} value={n}>{n} stars</option>)}</select>
              <select value={stt} onChange={e => setStt(e.target.value)}><option>All</option>{[...new Set(all.map(x => x.state))].sort().map(x => <option key={x}>{x}</option>)}</select>
            </div>
          )}
          <div className="rc-rows">
            {(view === 'Board' ? board : view === 'Commits' ? commits : search).map(x => {
              const st = stateOf(d, x), c = status(x), mine = st.int[s.id] ?? 0;
              const ranked = Object.entries(st.int).sort((a, b) => b[1] - a[1]);
              const place = ranked.findIndex(([k]) => Number(k) === s.id) + 1;
              return (
                <button key={x.id} className={`rc-row${sel === x.id ? ' on' : ''}${c ? ' done' : ''}`} onClick={() => setSel(x.id)}>
                  <RecruitFace x={x} size={46} />
                  <div className="rc-n"><b>{x.fn} {x.ln}</b><span>{x.pos} · {x.city}, {x.state} · #{x.rank} nat · #{x.posRank} {x.pos}</span></div>
                  <Stars n={x.stars} />
                  <div className="rc-pri">{[0, 1, 2].map(i => <i key={i} className={i < (d.recruits[x.id]?.scouted ?? 0) ? 'on' : ''}>{i < (d.recruits[x.id]?.scouted ?? 0) ? x.pri[i] : '?'}</i>)}</div>
                  <div className="rc-int">{c ? <span className="rc-c"><Logo id={c} size={22} />{c === s.id ? 'Committed to you' : 'Committed'}</span> : d.board.includes(x.id) ? <><div className="bar"><i style={{ width: `${mine}%` }} /></div><em>{place ? `${place}${['st', 'nd', 'rd'][place - 1] ?? 'th'} of ${ranked.length}` : '—'}</em></> : <em>Not on board</em>}</div>
                </button>
              );
            })}
            {view === 'Board' && !board.length && <div className="pc-empty">Your board is empty. Find prospects in Search and contact them to add them.</div>}
          </div>
        </section>
        {cur ? <Dossier s={s} x={cur} /> : <section className="hc rc-dossier empty"><p className="dim">Select a prospect to open his dossier.</p></section>}
      </div>
    </div>
  );
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
      <header className="rc-dh">
        <RecruitFace x={x} size={110} />
        <div className="rc-did"><span>{x.city}, {x.state} · Class of 2027</span><b>{x.fn} {x.ln}</b><div><Stars n={x.stars} /><em>{x.pos} · {ht(x.ht)} · {x.wt} lbs</em></div><div className="rc-ranks"><i>#{x.rank} National</i><i>#{x.posRank} {x.pos}</i></div></div>
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
