// The recruiting office. Two screens, broadcast-style:
//  - the board: a sortable, filterable table of prospects with the week's hours meter and the
//    team's needs by position along the top;
//  - a prospect: photo header, then Overview / Recruiting / Scouting. Recruiting has the actions
//    (with their hour costs) on the left, the pitch grid in the middle (one tile per motivation,
//    with your school's grade) and what he cares about on the right, above the race for him.
// All rules (hours, caps, stages, commitments) live in recruiting.ts; this file only displays
// them and calls act().
import './recruiting.css';
import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { RECRUIT_FACES } from './recruitfaces';
import { weekLabel, teamSchedule } from './season';
import { school, logo, logoDark, showColor, height, type School } from './data';
import { useDynasty, update, type Dynasty, type RecruitState } from './store';
import {
  recruitClass, recruitById, stateOf, ensureWorld, act, blocked, gradeScore, letter, ovrRange, revealed, needs, classTable, timeline, failsDeal,
  hoursBudget, hoursUsed, hrsThisWeek, actsThisWeek, offersOut, commitsOf, activeBoard, homeWeeks, visitsIn, closed, coordinator, offenseStyle, defenseStyle,
  MOTIVATIONS, ACTIONS, STAGES, POSITIONS, CAP, BOARD_MAX, OFFERS, CLASS_MAX, VISITS_PER_WEEK, STAR_PTS, DEAL_CAP,
  type Recruit, type Motivation, type ActionKey,
} from './recruiting';

// ---- small pieces ------------------------------------------------------------------------------
// High school colours behind each portrait.
const HS_COL = [['#0b2a5b', '#f2b705'], ['#7a0f1f', '#e9e9e9'], ['#0d4d2a', '#e8e8e8'], ['#3b1a68', '#f5c400'], ['#1b1b1b', '#d42027'], ['#0f5fa8', '#ffffff'], ['#c2410c', '#111111'], ['#4b5563', '#facc15'], ['#14532d', '#fbbf24'], ['#1e3a8a', '#ef4444']];
/** A prospect's photo: the generated set of fictional recruits, separate from the pro game's faces. */
export function RecruitFace({ x, size }: { x: Recruit; size: number }) {
  const hs = HS_COL[(x.n * 7 + x.state.length) % HS_COL.length];
  return <div className="rf" style={{ width: size, height: size, '--h1': hs[0], '--h2': hs[1] } as CSSProperties}><img src={RECRUIT_FACES[(x.face * 37) % RECRUIT_FACES.length]} alt="" draggable={false} />{size >= 80 && <i>{x.pos}</i>}</div>;
}
const Stars = ({ n }: { n: number }) => <span className="rx-stars" aria-label={`${n} stars`}>{'★'.repeat(n)}<span>{'★'.repeat(5 - n)}</span></span>;
/** A school's logo on a team-colour disc, with its abbreviation when the logo cannot load. */
function Mark({ id, size = 24 }: { id: number; size?: number }) {
  const s = school(id);
  return (
    <span className="rx-mark" title={s.school} style={{ width: size, height: size, '--tc': showColor(s), fontSize: Math.max(7, size * 0.3) } as CSSProperties}>
      <b>{s.abbr}</b>
      <img src={logo(id)} alt="" loading="lazy" onLoad={e => { e.currentTarget.parentElement!.dataset.ok = '1'; }} onError={e => { const t = e.currentTarget; if (!t.dataset.alt) { t.dataset.alt = '1'; t.src = logoDark(id); } else t.style.display = 'none'; }} />
    </span>
  );
}
const gradeClass = (g: string) => `rx-gr g${g[0]}`;
const Grade = ({ v, big }: { v: number; big?: boolean }) => { const l = letter(v); return <em className={`${gradeClass(l)}${big ? ' big' : ''}`}>{l}</em>; };

// Line icons for motivations and actions (24x24, stroked).
const ICON: Record<string, string> = {
  'Academic Prestige': 'M2 9l10-5 10 5-10 5zM6 11v5c0 1.6 2.7 3 6 3s6-1.4 6-3v-5M22 9v6',
  'Athletic Facilities': 'M6.5 6v12M17.5 6v12M3 9.5v5M21 9.5v5M6.5 12h11',
  'Brand Exposure': 'M3 5h18v12H3zM8 21h8M12 17v4M10 8.5l5 2.5-5 2.5z',
  'Campus Lifestyle': 'M3 21h18M5 21V10l7-5 7 5v11M10 21v-5h4v5M9 11h.01M15 11h.01',
  'Championship Contender': 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3.5 3.8M16 6h3a3 3 0 0 1-3.5 3.8M12 13v3M8.5 20h7M9.5 16h5v4h-5z',
  'Coach Prestige': 'M12 3l2.6 5.5 6 .8-4.4 4.1 1.1 6L12 16.6l-5.3 2.8 1.1-6-4.4-4.1 6-.8z',
  'Coach Stability': 'M12 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM12 8v13M5 13a7 7 0 0 0 14 0M8.5 11h7',
  'Conference Prestige': 'M12 3l8 3v6c0 4.8-3.4 8-8 9-4.6-1-8-4.2-8-9V6zM8.5 12l2.5 2.5 4.5-5',
  'Playing Style': 'M4.5 6.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0M15 15l5 5M20 15l-5 5M7 9.5c0 5 3 8 7.5 8.5M12.5 6.5H19l-2-2M19 6.5l-2 2',
  'Playing Time': 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2M10 2h4M12 2v3M19 5l1.5 1.5',
  'Pro Potential': 'M3 17l6-6 4 4 8-8M15 7h6v6',
  'Program Tradition': 'M3 21h18M4 10h16M12 3l9 5H3zM6 10v9M10 10v9M14 10v9M18 10v9',
  'Proximity to Home': 'M12 22s7-6.4 7-12a7 7 0 0 0-14 0c0 5.6 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  'Stadium Atmosphere': 'M3 10v4h3l8 5V5L6 10zM17.5 8.5a5 5 0 0 1 0 7M20 6a8.5 8.5 0 0 1 0 12',
  dm: 'M4 5h16v11H9l-5 4zM8 9.5h8M8 12.5h5',
  ff: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5M16.5 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM15 14.6c3.4-.6 6.5 1.4 6.5 5.4',
  hc: 'M9 3h6v3H9zM6 5h12v16H6zM9 11h6M9 15h4',
  house: 'M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-6h4v6',
  scout: 'M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  offer: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  visit: 'M4 6h16v15H4zM4 10h16M8 3v5M16 3v5M9 15l2 2 4-4',
  deal: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  back: 'M15 18l-6-6 6-6',
  next: 'M9 18l6-6-6-6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  lock: 'M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
};
const Icon = ({ k, size = 22 }: { k: string; size?: number }) => (
  <svg className="rx-ic" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON[k] ?? ''} /></svg>
);
const SHORT: Record<string, string> = { 'Academic Prestige': 'Academics', 'Athletic Facilities': 'Facilities', 'Brand Exposure': 'Brand', 'Campus Lifestyle': 'Campus Life', 'Championship Contender': 'Title Contender', 'Coach Prestige': 'Coach Prestige', 'Coach Stability': 'Coach Stability', 'Conference Prestige': 'Conference', 'Playing Style': 'Playing Style', 'Playing Time': 'Playing Time', 'Pro Potential': 'Pro Potential', 'Program Tradition': 'Tradition', 'Proximity to Home': 'Close to Home', 'Stadium Atmosphere': 'Atmosphere' };

const ord = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;
/** The race for a prospect: schools still on his list, best first, with share of the total. */
function race(st: RecruitState) {
  const r = Object.entries(st.int).map(([k, v]) => ({ id: Number(k), v })).sort((a, b) => b.v - a.v);
  const sum = r.reduce((a, x) => a + x.v, 0) || 1;
  return r.map(x => ({ ...x, share: Math.round((x.v / sum) * 100) }));
}
type Row = { x: Recruit; st: RecruitState; mine?: number; place: number; stage: number; hrs: number; range: [number, number] };
function rowOf(d: Dynasty, x: Recruit): Row {
  const st = stateOf(d, x), r = race(st), mine = st.int[d.team];
  return { x, st, mine, place: r.findIndex(e => e.id === d.team) + 1, stage: st.committed !== undefined ? 4 : st.stg ?? 0, hrs: hrsThisWeek(d, st), range: ovrRange(x, st.sc ?? 0) };
}
function StagePill({ r, me }: { r: Row; me: number }) {
  if (r.st.committed !== undefined) return <span className={`rx-stage c ${r.st.committed === me ? 'won' : 'lost'}`}><Mark id={r.st.committed} size={16} />{r.st.committed === me ? 'Committed' : 'Committed'}</span>;
  return <span className={`rx-stage s${r.stage}`}>{STAGES[r.stage]}</span>;
}

// ---- the tab -------------------------------------------------------------------------------------
type View = 'Board' | 'Search' | 'Commits' | 'Class Rankings';
type SortKey = 'rank' | 'name' | 'pos' | 'stars' | 'ovr' | 'int' | 'hrs' | 'stage';

export function RecruitingTab({ s }: { s: School }) {
  const d = useDynasty(s.id);
  useEffect(() => { if (d.rv !== 2) update(ensureWorld); }, [d.rv]);
  const [view, setView] = useState<View>('Board');
  const [sel, setSel] = useState<string | null>(null);
  const [pos, setPos] = useState('All'), [stars, setStars] = useState(0), [stt, setStt] = useState('All'), [openOnly, setOpenOnly] = useState(true);
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'rank', dir: 1 });
  const [more, setMore] = useState(60);
  const [recapOpen, setRecapOpen] = useState(true);
  const all = recruitClass();
  const commits = commitsOf(d);
  const board = activeBoard(d);
  const need = useMemo(() => needs(s.id), [s.id]);
  const budget = hoursBudget(d), used = hoursUsed(d);
  const table = useMemo(() => classTable(d), [d.recruits]);
  const myRank = table.findIndex(c => c.id === s.id) + 1;

  const listIds = view === 'Board' ? d.board : view === 'Commits' ? commits.map(x => x.id) : all.map(x => x.id);
  const rows = useMemo(() => {
    let r = listIds.map(id => recruitById(id)!).filter(Boolean).map(x => rowOf(d, x));
    if (pos !== 'All') r = r.filter(e => e.x.pos === pos);
    if (stars) r = r.filter(e => e.x.stars === stars);
    if (view === 'Search') { if (stt !== 'All') r = r.filter(e => e.x.state === stt); if (openOnly) r = r.filter(e => e.st.committed === undefined); }
    const key = (e: Row): number | string => sort.k === 'rank' ? e.x.rank : sort.k === 'name' ? e.x.ln + e.x.fn : sort.k === 'pos' ? POSITIONS.indexOf(e.x.pos) : sort.k === 'stars' ? -e.x.stars : sort.k === 'ovr' ? -(e.range[0] + e.range[1]) : sort.k === 'int' ? -(e.mine ?? -1) : sort.k === 'hrs' ? -e.hrs : -e.stage;
    return r.sort((a, b) => { const p = key(a), q = key(b); return (p < q ? -1 : p > q ? 1 : a.x.rank - b.x.rank) * sort.dir; });
  }, [d, view, pos, stars, stt, openOnly, sort]);
  const ids = rows.map(r => r.x.id);
  const cur = sel ? recruitById(sel) : undefined;
  const recap = d.recap && d.recap.wk === d.week && d.recap.items.length ? d.recap : undefined;
  const sortBy = (k: SortKey) => setSort(v => ({ k, dir: v.k === k ? (v.dir === 1 ? -1 : 1) : 1 }));
  const Th = ({ k, children, cls }: { k?: SortKey; children: ReactNode; cls?: string }) => k ? <button className={`rx-th ${cls ?? ''}${sort.k === k ? ' on' : ''}`} onClick={() => sortBy(k)}>{children}{sort.k === k ? <i>{sort.dir === 1 ? '▲' : '▼'}</i> : null}</button> : <span className={`rx-th ${cls ?? ''}`}>{children}</span>;

  return (
    <div className="rx">
      <header className="rx-top">
        <div className="rx-title">
          <span>Recruiting · Class of 2027</span>
          <b>{closed(d) ? 'Signing Day' : weekLabel(d.week)}</b>
        </div>
        <div className="rx-meter">
          <div className="rx-meter-k"><span>HRS</span><b>{used}<small>/{budget}</small></b></div>
          <div className="rx-meter-bar"><i style={{ width: `${Math.min(100, (used / budget) * 100)}%` }} /></div>
          <em>{closed(d) ? 'Recruiting is closed' : `${budget - used} hours left this week · ${CAP} max per prospect`}</em>
        </div>
        <div className="rx-kpis">
          <div><b>{offersOut(d)}<small>/{OFFERS}</small></b><span>Offers</span></div>
          <div><b>{board.length}<small>/{BOARD_MAX}</small></b><span>Board</span></div>
          <div><b>{commits.length}<small>/{CLASS_MAX}</small></b><span>Commits</span></div>
          <div><b>{myRank ? `#${myRank}` : 'NR'}</b><span>Class rank</span></div>
        </div>
      </header>
      {!cur && <div className="rx-needs">
        <span className="rx-needs-k">Team needs</span>
        {POSITIONS.map(p => {
          const c = commits.filter(x => x.pos === p).length, t = c + board.filter(id => recruitById(id)?.pos === p).length, n = need[p];
          return <button key={p} className={`rx-need${c >= n && n ? ' done' : t >= n && n ? ' set' : n ? '' : ' none'}${pos === p ? ' on' : ''}`} onClick={() => setPos(pos === p ? 'All' : p)} title={`${c} committed, ${t} targeted, ${n} needed`}><b>{p}</b><span>{t}/{n}</span></button>;
        })}
      </div>}
      {recap && !cur && (
        <section className={`rx-recap${recapOpen ? '' : ' shut'}`}>
          <button className="rx-recap-h" onClick={() => setRecapOpen(!recapOpen)}><b>{weekLabel(d.week - 1)} results</b><span>{recap.items.length} update{recap.items.length > 1 ? 's' : ''}</span><i>{recapOpen ? '–' : '+'}</i></button>
          {recapOpen && <div className="rx-recap-list">{recap.items.slice(0, 12).map((it, i) => { const [kind, id, text] = it.split('|'); return <button key={i} className={`k-${kind}`} onClick={() => setSel(id)}><i />{text}</button>; })}</div>}
        </section>
      )}
      {cur ? <Prospect s={s} x={cur} back={() => setSel(null)} nav={ids.length > 1 && ids.includes(cur.id) ? (k: number) => setSel(ids[(ids.indexOf(cur.id) + k + ids.length) % ids.length]) : undefined} /> : (
        <>
          <nav className="rx-tabs">
            {(['Board', 'Search', 'Commits', 'Class Rankings'] as View[]).map(v => <button key={v} className={view === v ? 'on' : ''} onClick={() => { setView(v); setMore(60); }}>{v}{v === 'Board' ? <i>{board.length}</i> : v === 'Commits' ? <i>{commits.length}</i> : null}</button>)}
          </nav>
          {view === 'Class Rankings' ? <ClassRankings d={d} me={s.id} table={table} /> : (
            <section className="rx-panel">
              <div className="rx-filters">
                <div className="rx-chips">{['All', ...POSITIONS].map(p => <button key={p} className={pos === p ? 'on' : ''} onClick={() => setPos(p)}>{p}</button>)}</div>
                <div className="rx-chips stars">{[0, 5, 4, 3, 2].map(n => <button key={n} className={stars === n ? 'on' : ''} onClick={() => setStars(n)}>{n ? `${n}★` : 'All ★'}</button>)}</div>
                {view === 'Search' && <>
                  <select value={stt} onChange={e => setStt(e.target.value)} aria-label="Home state"><option value="All">All states</option>{[...new Set(all.map(x => x.state))].sort().map(x => <option key={x}>{x}</option>)}</select>
                  <label className="rx-check"><input type="checkbox" checked={openOnly} onChange={e => setOpenOnly(e.target.checked)} />Uncommitted only</label>
                </>}
              </div>
              <div className={`rx-table v-${view.toLowerCase()}`}>
                <div className="rx-tr rx-head">
                  <Th k="rank" cls="c-rank">Rk</Th><Th k="name" cls="c-name">Prospect</Th><Th k="pos" cls="c-pos">Pos</Th><Th k="stars" cls="c-stars">Stars</Th><Th k="ovr" cls="c-ovr">OVR</Th>
                  <Th k="int" cls="c-int">Interest</Th><Th k="hrs" cls="c-hrs">Hrs</Th><Th k="stage" cls="c-stage">Stage</Th><Th cls="c-top">Top schools</Th><Th cls="c-db"><span title="Dealbreaker">DB</span></Th><Th cls="c-act"> </Th>
                </div>
                {rows.slice(0, view === 'Search' ? more : rows.length).map(r => <BoardRow key={r.x.id} r={r} d={d} me={s.id} open={() => setSel(r.x.id)} />)}
                {!rows.length && <div className="rx-empty">{view === 'Board' ? (d.board.length ? 'No prospects match these filters.' : 'Your board is empty. Open Search and add up to 35 prospects you want to work this season.') : view === 'Commits' ? 'No commitments yet.' : 'No prospects match these filters.'}</div>}
              </div>
              {view === 'Search' && rows.length > more && <button className="rx-more" onClick={() => setMore(m => m + 60)}>Show more ({rows.length - more} left)</button>}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function BoardRow({ r, d, me, open }: { r: Row; d: Dynasty; me: number; open: () => void }) {
  const { x, st } = r;
  const rv = revealed(st.sc ?? 0), onBoard = d.board.includes(x.id);
  const top = race(st).slice(0, 5);
  const addWhy = blocked(d, x, 'board');
  const toggle = (e: MouseEvent) => { e.stopPropagation(); update(dd => { act(dd, x, onBoard ? 'unboard' : 'board'); }); };
  return (
    <div className={`rx-tr rx-row${onBoard ? ' mine' : ''}${st.committed !== undefined ? ' done' : ''}`} onClick={open} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') open(); }}>
      <span className="c-rank">{x.rank}</span>
      <span className="c-name"><RecruitFace x={x} size={38} /><span><b>{x.fn} {x.ln}</b><small>{x.city}, {x.state}</small></span></span>
      <span className="c-pos"><u>{x.pos}</u></span>
      <span className="c-stars"><Stars n={x.stars} /></span>
      <span className={`c-ovr${r.range[0] === r.range[1] ? ' exact' : ''}`}>{r.range[0] === r.range[1] ? r.range[0] : `${r.range[0]}–${r.range[1]}`}</span>
      <span className="c-int">{r.mine !== undefined ? <><span className="rx-bar"><i style={{ width: `${Math.min(100, r.mine)}%` }} /></span><b>{Math.round(r.mine)}</b><small className={r.place === 1 ? 'lead' : ''}>{r.place ? `${ord(r.place)} of ${Object.keys(st.int).length}` : ''}{st.dl ? <em className={st.dl > 0 ? 'up' : 'dn'}>{st.dl > 0 ? '▲' : '▼'}{Math.abs(Math.round(st.dl))}</em> : null}</small></> : <small className={`out${st.lostReason ? ' bad' : ''}`}>{st.lostReason ?? 'Not recruiting him'}</small>}</span>
      <span className="c-hrs">{onBoard && st.committed === undefined ? <><span className="rx-seg">{[10, 20, 30, 40, 50].map(t => <i key={t} className={r.hrs >= t ? 'on' : ''} />)}</span><small>{r.hrs}</small></> : <small>—</small>}</span>
      <span className="c-stage"><StagePill r={r} me={me} /></span>
      <span className="c-top">{st.committed !== undefined ? null : top.map((t, i) => <span key={t.id} className={`${i === 0 ? 'lead ' : ''}${t.id === me ? 'me' : ''}`}><Mark id={t.id} size={i === 0 ? 24 : 20} /></span>)}</span>
      <span className="c-db">{x.deal && rv.deal ? <span className={`rx-db${failsDeal(school(me), x, d) ? ' fail' : ''}`} title={`Dealbreaker: ${x.deal}`}><Icon k="deal" size={15} /></span> : null}</span>
      <span className="c-act">{st.committed === undefined && !closed(d) ? <button className={`rx-add${onBoard ? ' on' : ''}`} disabled={!onBoard && !!addWhy} title={onBoard ? 'Remove from board' : addWhy ?? 'Add to board'} onClick={toggle}><Icon k={onBoard ? 'minus' : 'plus'} size={15} /></button> : null}</span>
    </div>
  );
}

function ClassRankings({ d, me, table }: { d: Dynasty; me: number; table: ReturnType<typeof classTable> }) {
  const top = table.slice(0, 30), mine = table.findIndex(c => c.id === me);
  return (
    <section className="rx-panel rx-classes">
      {top.map((c, i) => (
        <div key={c.id} className={c.id === me ? 'me' : ''} style={{ '--tc': showColor(school(c.id)) } as CSSProperties}>
          <em>{i + 1}</em><Mark id={c.id} size={28} /><b>{school(c.id).school}</b><span>{c.n} commits · top {c.top}★</span><div className="rx-bar"><i style={{ width: `${(c.p / Math.max(1, table[0].p)) * 100}%` }} /></div><strong>{c.p}</strong>
        </div>
      ))}
      {mine >= 30 && <div className="me"><em>{mine + 1}</em><Mark id={me} size={28} /><b>{school(me).school}</b><span>{table[mine].n} commits</span><div className="rx-bar"><i style={{ width: `${(table[mine].p / Math.max(1, table[0].p)) * 100}%` }} /></div><strong>{table[mine].p}</strong></div>}
      {!table.length && <p className="rx-empty">Nobody has a commitment yet. Points: 5★ {STAR_PTS[5]}, 4★ {STAR_PTS[4]}, 3★ {STAR_PTS[3]}, 2★ {STAR_PTS[2]}.</p>}
    </section>
  );
}

// ---- a prospect --------------------------------------------------------------------------------
const TABS = ['Overview', 'Recruiting', 'Scouting'] as const;
function Prospect({ s, x, back, nav }: { s: School; x: Recruit; back: () => void; nav?: (k: number) => void }) {
  const d = useDynasty(s.id);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Recruiting');
  const [msg, setMsg] = useState('');
  useEffect(() => setMsg(''), [x.id, d.week]);
  const r = rowOf(d, x), st = r.st, me = s.id;
  const onBoard = d.board.includes(x.id);
  const run = (kind: Parameters<typeof act>[2], arg?: string | number) => update(dd => setMsg(act(dd, x, kind, arg)));
  const addWhy = blocked(d, x, 'board');
  const rc = race(st);
  return (
    <section className="rx-p" key={x.id}>
      <div className="rx-p-nav">
        <button className="rx-back" onClick={back}><Icon k="back" size={18} />Board</button>
        {nav && <div><button onClick={() => nav(-1)} aria-label="Previous prospect"><Icon k="back" size={18} /></button><button onClick={() => nav(1)} aria-label="Next prospect"><Icon k="next" size={18} /></button></div>}
      </div>
      <header className="rx-p-head">
        <div className="rx-p-photo"><RecruitFace x={x} size={150} /></div>
        <div className="rx-p-id">
          <span className="rx-p-k">{x.city}, {x.state} · Class of 2027</span>
          <h2><span>{x.fn}</span> {x.ln}</h2>
          <div className="rx-p-line"><Stars n={x.stars} /><u>{x.pos}</u><span>{height(x.ht)} · {x.wt} lbs</span></div>
          <div className="rx-p-ranks"><i><b>#{x.rank}</b>National</i><i><b>#{x.posRank}</b>{x.pos}</i><i><b>#{(x.n % 40) + 1}</b>{x.state}</i></div>
        </div>
        <div className="rx-p-side">
          <div className="rx-p-ovr"><span>Rating</span><b>{r.range[0] === r.range[1] ? r.range[0] : `${r.range[0]}–${r.range[1]}`}</b><em>{(st.sc ?? 0) >= 100 ? 'Fully scouted' : `${st.sc ?? 0}% scouted`}</em></div>
          <div className="rx-p-st">
            <StagePill r={r} me={me} />
            {r.mine !== undefined && st.committed === undefined ? <span className="rx-p-int"><b>{Math.round(r.mine)}</b>interest · {r.place ? `${ord(r.place)} of ${rc.length}` : ''}</span> : null}
          </div>
          {st.committed === undefined && !closed(d) && <button className={`rx-p-board${onBoard ? ' on' : ''}`} disabled={!onBoard && !!addWhy} title={addWhy} onClick={() => run(onBoard ? 'unboard' : 'board')}><Icon k={onBoard ? 'check' : 'plus'} size={16} />{onBoard ? 'On your board' : addWhy ?? 'Add to board'}</button>}
        </div>
      </header>
      {st.committed !== undefined && <div className={`rx-p-done ${st.committed === me ? 'won' : 'lost'}`}><Mark id={st.committed} size={34} /><div><b>{st.committed === me ? `Committed to ${s.school}` : `Committed to ${school(st.committed).school}`}</b>{st.committed !== me && st.lostReason ? <span>{st.lostReason}</span> : null}</div></div>}
      <nav className="rx-p-tabs">{TABS.map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</nav>
      {msg && <div className="rx-msg" role="status">{msg}</div>}
      {tab === 'Recruiting' && <RecruitPane d={d} s={s} x={x} st={st} run={run} />}
      {tab === 'Overview' && <Overview d={d} s={s} x={x} st={st} />}
      {tab === 'Scouting' && <Scouting d={d} s={s} x={x} st={st} run={run} />}
    </section>
  );
}

type Run = (kind: Parameters<typeof act>[2], arg?: string | number) => void;
function RecruitPane({ d, s, x, st, run }: { d: Dynasty; s: School; x: Recruit; st: RecruitState; run: Run }) {
  const me = s.id, acts = actsThisWeek(d, st), used = hrsThisWeek(d, st);
  const locked = acts.some(k => k !== 'scout');
  const live = st.committed === undefined && !closed(d) && st.int[me] !== undefined;
  const left = hoursBudget(d) - hoursUsed(d);
  const ACTS: ActionKey[] = ['scout', 'dm', 'ff', 'hc', 'house'];
  const offerWhy = blocked(d, x, 'offer'), visitWhy = blocked(d, x, 'visit');
  const homes = homeWeeks(d);
  const sched = teamSchedule(me, d.season);
  return (
    <div className="rx-rec">
      <section className="rx-col rx-acts">
        <h4>Actions <span>{used}/{CAP} hrs</span></h4>
        <div className="rx-seg big">{[10, 20, 30, 40, 50].map(t => <i key={t} className={used >= t ? 'on' : ''} />)}</div>
        <p className="rx-note">{left} program hours left this week</p>
        {ACTS.map(k => {
          const a = ACTIONS[k], why = blocked(d, x, k), done = k !== 'scout' && acts.includes(k), n = acts.filter(z => z === k).length;
          return (
            <button key={k} className={`rx-act${done ? ' done' : ''}`} disabled={!!why} onClick={() => run(k)}>
              <span className="rx-act-ic"><Icon k={done ? 'check' : k} /></span>
              <span className="rx-act-t"><b>{a.name}{k === 'scout' && n ? ` ×${n}` : ''}</b><small>{done ? 'Done this week' : why ?? a.desc}</small></span>
              <em>{a.cost}<small>HRS</small></em>
            </button>
          );
        })}
        <button className={`rx-act${st.offered ? ' done' : ''}`} disabled={!!offerWhy} onClick={() => run('offer')}>
          <span className="rx-act-ic"><Icon k={st.offered ? 'check' : 'offer'} /></span>
          <span className="rx-act-t"><b>{st.offered ? 'Scholarship offered' : 'Offer scholarship'}</b><small>{st.offered ? 'Required before he can commit' : offerWhy ?? `${OFFERS - offersOut(d)} of ${OFFERS} offers left`}</small></span>
          <em>0<small>HRS</small></em>
        </button>
        <div className={`rx-act rx-visit${st.vis || st.visited ? ' done' : ''}${visitWhy && !st.vis ? ' off' : ''}`}>
          <span className="rx-act-ic"><Icon k={st.vis || st.visited ? 'check' : 'visit'} /></span>
          <span className="rx-act-t"><b>Official visit</b><small>{st.visited ? 'He has visited campus' : st.vis ? `Home game, week ${st.vis} vs ${(() => { const g = sched.find(z => z.wk === st.vis); return g && !g.bye ? g.o.school : '—'; })()}` : visitWhy ?? `Pick a home game (${VISITS_PER_WEEK} visits a weekend)`}</small>
            {!visitWhy && !st.vis && <span className="rx-wks">{homes.map(w => { const n = visitsIn(d, w); return <button key={w} disabled={n >= VISITS_PER_WEEK} onClick={() => run('visit', w)}>Wk {w}<i>{VISITS_PER_WEEK - n} left</i></button>; })}</span>}
            {st.vis && !st.visited && live && <button className="rx-link" onClick={() => run('unvisit')}>Cancel visit</button>}
          </span>
          <em>0<small>HRS</small></em>
        </div>
        {locked && live && <button className="rx-undo" onClick={() => run('undo')}><Icon k="undo" size={16} />Undo last contact</button>}
      </section>

      <section className="rx-col rx-pitch">
        <h4>Pitch <span>{st.pitch ? SHORT[st.pitch] : 'None set'}</span></h4>
        <p className="rx-note">{!live ? 'Recruiting is over for him.' : locked ? <><Icon k="lock" size={13} /> Locked in for this week. Interest lands when the week ends.</> : 'Pick what to sell him this week. It multiplies every contact you make.'}</p>
        <div className="rx-grid">
          {MOTIVATIONS.map(m => {
            const g = gradeScore(s, x, m, d), rk = x.mot.indexOf(m), known = rk >= 0 && rk < revealed(st.sc ?? 0).mot;
            const isDeal = x.deal === m && revealed(st.sc ?? 0).deal;
            return (
              <button key={m} className={`rx-tile${st.pitch === m ? ' on' : ''}${known ? ' known' : ''}${isDeal ? ' deal' : ''}`} disabled={!live || locked} onClick={() => run('pitch', st.pitch === m ? '' : m)} title={m}>
                {known && <i className="rx-tile-rk">#{rk + 1}</i>}
                {isDeal && <i className="rx-tile-db"><Icon k="deal" size={12} /></i>}
                <Icon k={m} size={30} />
                <span>{SHORT[m]}</span>
                <Grade v={g} />
              </button>
            );
          })}
        </div>
      </section>

      <section className="rx-col rx-mots">
        <h4>What he wants</h4>
        <Motivations d={d} s={s} x={x} st={st} />
        <h4 className="gap">Top schools</h4>
        <TopSchools d={d} x={x} st={st} me={me} />
      </section>
      {st.log.length > 0 && <section className="rx-log"><h4>Activity</h4>{st.log.slice(0, 8).map((l, i) => <div key={i}>{l}</div>)}</section>}
    </div>
  );
}

function Motivations({ d, s, x, st }: { d: Dynasty; s: School; x: Recruit; st: RecruitState }) {
  const rv = revealed(st.sc ?? 0);
  const best = (m: Motivation) => { const ids = Object.keys(st.int).map(Number).filter(id => id !== s.id); return ids.length ? Math.max(...ids.map(id => gradeScore(school(id), x, m, d))) : undefined; };
  return (
    <div className="rx-motl">
      {[0, 1, 2].map(i => {
        const open = i < rv.mot, m = x.mot[i], g = open ? gradeScore(s, x, m, d) : 0, b = open ? best(m) : undefined;
        return (
          <div key={i} className={`rx-mot${open ? ' open' : ''}${open && x.deal === m && rv.deal ? ' deal' : ''}`}>
            <em>#{i + 1}</em>
            {open ? <Icon k={m} size={20} /> : <span className="rx-q">?</span>}
            <span><b>{open ? m : 'Unknown'}</b><small>{open ? (b !== undefined ? `Best rival: ${letter(b)}` : 'No rivals left') : `Scout to ${[25, 50, 75][i]}% to reveal`}</small></span>
            {open ? <Grade v={g} big /> : <em className="rx-gr">?</em>}
          </div>
        );
      })}
      <div className={`rx-mot dealrow${rv.deal && x.deal ? (failsDeal(s, x, d) ? ' fail' : ' pass') : ''}`}>
        <em><Icon k="deal" size={16} /></em>
        <span><b>{!rv.deal ? 'Dealbreaker unknown' : x.deal ? `Dealbreaker: ${x.deal}` : 'No dealbreaker'}</b><small>{!rv.deal ? 'Scout to 50% to find out' : x.deal ? `Needs ${letter(x.dealReq)} or better. ${failsDeal(s, x, d) ? `You fail it: your interest is capped at ${DEAL_CAP}%.` : 'You pass.'}` : 'Nothing rules a school out for him.'}</small></span>
        {rv.deal && x.deal ? <Grade v={gradeScore(s, x, x.deal, d)} big /> : null}
      </div>
    </div>
  );
}

function TopSchools({ d, x, st, me }: { d: Dynasty; x: Recruit; st: RecruitState; me: number }) {
  const r = race(st), full = (st.sc ?? 0) >= 75;
  if (!r.length) return <p className="rx-note">Nobody is recruiting him.</p>;
  return (
    <div className="rx-schools">
      {r.map((e, i) => {
        const sc = school(e.id);
        return (
          <div key={e.id} className={`${e.id === me ? 'me' : ''}${st.committed === e.id ? ' won' : ''}`} style={{ '--tc': showColor(sc) } as CSSProperties}>
            <em>{i + 1}</em><Mark id={e.id} size={26} />
            <span><b>{sc.school}</b><span className="rx-bar"><i style={{ width: `${Math.min(100, e.v)}%` }} /></span></span>
            <strong>{Math.round(e.v)}<span title="Share of his interest">{e.share}%</span>{full && <small title="Fit on his motivations">{letter(x.mot.reduce((a, m, k) => a + gradeScore(sc, x, m, d) * [0.5, 0.3, 0.2][k], 0))}</small>}</strong>
          </div>
        );
      })}
    </div>
  );
}

/** Combine numbers from size, position and rating (shown once he has been scouted). */
function combine(x: Recruit): [string, string][] {
  const fast = ['WR', 'CB', 'RB', 'S'].includes(x.pos) ? 4.42 : ['LB', 'EDGE', 'TE', 'QB'].includes(x.pos) ? 4.62 : ['K', 'P'].includes(x.pos) ? 4.9 : 5.1;
  const forty = (fast + ((x.n * 7) % 17) / 100 - (x.ovr - 75) * 0.004).toFixed(2);
  const vert = Math.round(30 + (5.2 - Number(forty)) * 12 + (x.n % 5));
  return [['40-yard', forty], ['Vertical', `${vert}"`], ['Shuttle', (4 + (Number(forty) - 4.3) * 0.55 + (x.n % 9) / 100).toFixed(2)], ['Wingspan', `${Math.round(x.ht * 1.03)}"`]];
}
const ATTRS = ['Speed', 'Strength', 'Technique', 'Football IQ', 'Size', 'Upside'];
const attrs = (x: Recruit) => ATTRS.map((k, i) => Math.max(30, Math.min(99, x.ovr + ((x.n * (i + 3)) % 17) - 8 + (k === 'Upside' ? x.pot - x.ovr : 0))));

function Overview({ d, s, x, st }: { d: Dynasty; s: School; x: Recruit; st: RecruitState }) {
  const tl = timeline(x), sc = st.sc ?? 0, me = s.id;
  const steps = [['Open', 0], ['Top 8', tl[0]], ['Top 5', tl[1]], ['Top 3', tl[2]], ['Decision', tl[3]]] as const;
  const stage = st.committed !== undefined ? 4 : st.stg ?? 0;
  const style = ['QB', 'RB', 'WR', 'TE', 'OT', 'G', 'C'].includes(x.pos) ? offenseStyle(s) : defenseStyle(s);
  return (
    <div className="rx-ov">
      <section className="rx-col">
        <h4>Profile</h4>
        <dl className="rx-dl">
          <dt>Hometown</dt><dd>{x.city}, {x.state}</dd>
          <dt>Size</dt><dd>{height(x.ht)}, {x.wt} lbs</dd>
          <dt>Position rank</dt><dd>#{x.posRank} {x.pos}</dd>
          <dt>Your scheme</dt><dd>{style}</dd>
          <dt>Hours from you</dt><dd>{st.tot ?? 0} total · {hrsThisWeek(d, st)} this week</dd>
          <dt>Official visit</dt><dd>{st.visited ? 'Visited' : st.vis ? `Week ${st.vis}` : 'Not scheduled'}</dd>
        </dl>
        <h4 className="gap">Combine</h4>
        <div className="rx-combine">{combine(x).map(([k, v]) => <span key={k}><em>{k}</em>{sc >= 25 ? v : '—'}</span>)}</div>
      </section>
      <section className="rx-col">
        <h4>Recruitment timeline</h4>
        <ol className="rx-tl">{steps.map(([k, w], i) => <li key={k} className={i < stage || (i === 4 && st.committed !== undefined) ? 'past' : i === stage ? 'now' : ''}><i /><b>{k}</b><span>{i === 0 ? 'Preseason' : i === 4 ? (st.committed !== undefined ? `Committed to ${school(st.committed).school}` : `Week ${w} at the earliest`) : `About week ${w}`}</span></li>)}</ol>
        <p className="rx-note">He commits once one school clearly leads his list. Schools left off a cut are out for good.</p>
      </section>
      <section className="rx-col">
        <h4>Top schools</h4>
        <TopSchools d={d} x={x} st={st} me={me} />
      </section>
    </div>
  );
}

function Scouting({ d, s, x, st, run }: { d: Dynasty; s: School; x: Recruit; st: RecruitState; run: Run }) {
  const sc = st.sc ?? 0, why = blocked(d, x, 'scout'), [lo, hi] = ovrRange(x, sc), av = attrs(x);
  const spread = Math.round((hi - lo) / 2);
  const ev = coordinator(s).evaluation;
  const steps: [number, string][] = [[25, `#1 motivation · rating ±6`], [50, '#2 motivation · dealbreaker · ±4'], [75, '#3 motivation · ±2'], [100, 'True rating']];
  return (
    <div className="rx-sc">
      <section className="rx-col">
        <h4>Scouting report <span>{sc}%</span></h4>
        <div className="rx-sc-bar"><i style={{ width: `${sc}%` }} />{steps.map(([t]) => <u key={t} style={{ left: `${t}%` }} className={sc >= t ? 'on' : ''} />)}</div>
        <ul className="rx-sc-steps">{steps.map(([t, l]) => <li key={t} className={sc >= t ? 'on' : ''}><b>{t}%</b>{l}</li>)}</ul>
        <button className="rx-act" disabled={!!why} onClick={() => run('scout')}>
          <span className="rx-act-ic"><Icon k="scout" /></span>
          <span className="rx-act-t"><b>Scout</b><small>{why ?? `Coordinator evaluation ${ev}. Repeat scouting in a week yields less.`}</small></span>
          <em>{ACTIONS.scout.cost}<small>HRS</small></em>
        </button>
      </section>
      <section className="rx-col">
        <h4>Rating <span>{lo === hi ? 'Exact' : `${lo}–${hi}`}</span></h4>
        <div className="rx-attrs">{ATTRS.map((k, i) => {
          const v = av[i], a = Math.max(30, v - spread - 3), b = Math.min(99, v + spread + 3);
          return <div key={k}><span>{k}</span><span className="rx-range"><i style={{ left: `${a}%`, width: `${Math.max(1.2, b - a)}%` }} /></span><b>{sc >= 100 ? v : sc >= 25 ? `${a}–${b}` : '?'}</b></div>;
        })}</div>
        <p className="rx-note">Ranges narrow as you scout. A prospect who has never been scouted shows a wide, off-centre range.</p>
      </section>
    </div>
  );
}
