import type React from 'react';
import { useMemo, useState } from 'react';
import { useApp, app } from '../store';
import { Logo, Ovr, Face, DevIcon, vivid, Table, PlayerCell, Bar, Tabs, CountUp } from '../components';
import { NegotiationRoom } from './negotiate';
import { market } from '../../core/negotiate';
import type { GamePlan, Player } from '../../core/types';
import { capFor, capHit, capSpace, money, teamPayroll, yearsLeft, franchiseTag, marketValue } from '../../core/contracts';
import { freeAgents } from '../../core/freeagency';
import { askingPrice, expiringFor, applyTag } from '../../core/offseason';
import { teamRatings } from '../../core/league';
import { userGame, standings } from '../../core/season';
import { POS_ORDER } from '../../core/ratings';
import { COACH_ABILITIES, COACH_TREES, TREE_INFO, coachXpNeed, POINTS_PER_LEVEL, type CoachAbility } from '../../core/coaching';

// ---- free agency ------------------------------------------------------------------------------
const FA_DAYS = ['Legal Tampering', 'Opening Day', 'Day 3', 'Day 4', 'Second Wave', 'Day 6', 'Bargain Bin', 'Final Day'];
export function FreeAgencyScreen() {
  const L = useApp().league!;
  const [pos, setPos] = useState<string>('All');
  const [neg, setNeg] = useState<Player | null>(null);
  const [shown, setShown] = useState(40);
  const open = L.phase === 'freeagency';
  const all = freeAgents(L).sort((a, b) => b.ovr - a.ovr);
  const rows = all.filter(p => pos === 'All' || p.pos === pos);
  const day = L.fa?.day ?? 1;
  const signings = L.news.filter(n => n.kind === 'sign' && n.season === L.season).slice(0, 8);
  return (
    <div className="grid">
      <div className="row"><div className="h2">Free Agency</div><div className="spacer" /><span className="dim">Cap space <b className={capSpace(L, L.user) < 0 ? 'bad' : 'good'}>{money(capSpace(L, L.user))}</b></span></div>
      {open ? <div className="fa-days">{FA_DAYS.map((d, i) => <div key={d} className={i + 1 === day ? 'on' : i + 1 < day ? 'past' : ''}>{d}</div>)}</div>
        : <div className="card small dim">{L.phase === 'regular' ? 'In-season: unsigned players want a job. Agree to terms and he signs on the spot.' : 'Outside the free agency period, agreed deals are signed immediately.'}</div>}
      <div className="row">{['All', ...POS_ORDER].map(p => <span key={p} className={`chip${pos === p ? ' on' : ''}`} onClick={() => setPos(p)}>{p}</span>)}<div className="spacer" /><span className="small dim">{rows.length} available</span></div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px', alignItems: 'start' }}>
        <div className="falist">{rows.slice(0, shown).map(p => <FaRow key={p.id} p={p} onOpen={() => setNeg(p)} />)}
          {rows.length > shown && <div className="empty"><button className="btn sm" onClick={() => setShown(n => n + 40)}>Show more ({rows.length - shown})</button></div>}
          {!rows.length && <div className="empty">No free agents at this position.</div>}
        </div>
        <div className="card"><div className="h3">Signings</div>{signings.length ? signings.map(n => <div key={n.id} className="li small">{n.teams[0] && <Logo team={L.teams[n.teams[0]]} size={22} />}<span>{n.text}</span></div>) : <div className="small dim">No moves yet.</div>}</div>
      </div>
      {neg && <NegotiationRoom p={neg} close={() => { setNeg(null); app.touch(); }} />}
    </div>
  );
}

/** One free agent, the way Madden lists them: big photo, name, the line that matters, and his trait. */
function FaRow({ p, onOpen }: { p: Player; onOpen: () => void }) {
  const L = useApp().league!;
  const m = market(L, p), ask = askingPrice(L, p);
  const mine = (L.fa?.offers[p.id] ?? []).some(o => o.team === L.user);
  const was = Object.values(L.teams).find(t => t.abbr === p.draft.team);
  return (
    <div className={`farow${mine ? ' mine' : ''}`} onClick={onOpen}>
      <div className="fa-ph" style={{ '--pc': was ? vivid(was.colors[0]) : '#1d3a7a' } as React.CSSProperties}><Face p={p} size={64} /></div>
      <div className="fa-id"><b>{p.fn[0]}.{p.ln}</b><span>{p.ovr} OVR <i>|</i> {p.pos} <i>|</i> {p.arch} <i>|</i> {Math.floor(p.age)} YRS</span></div>
      <div className="fa-ask"><b>{money(ask.apy)}</b><span>{ask.years} yr ask</span></div>
      <div className="fa-mkt"><span className="heat"><b style={{ width: `${m.heat * 100}%` }} /></span><span>{mine ? 'Your offer is in' : m.leader ? <>Leaning <Logo team={L.teams[m.leader]} size={18} /></> : L.talks?.[p.id]?.closed ? 'Talks off' : 'No offers yet'}</span></div>
      <DevIcon d={p.dev} size={30} />
    </div>
  );
}

// ---- re-signing ------------------------------------------------------------------------------
export function ResignScreen() {
  const L = useApp().league!;
  const [neg, setNeg] = useState<Player | null>(null);
  const rows = L.phase === 'resign' ? expiringFor(L, L.user) : Object.values(L.players).filter(p => p.team === L.user && yearsLeft(p.contract, L.season) === 1);
  const tagged = Object.values(L.players).some(p => p.team === L.user && p.contract.tag && p.contract.years[0]?.s === L.season);
  return (
    <div className="grid">
      <div className="row"><div className="h2">{L.phase === 'resign' ? 'Expiring Contracts' : 'Contracts Expiring After This Season'}</div><div className="spacer" /><span className="dim">Cap space <b>{money(capSpace(L, L.user))}</b></span></div>
      {L.phase !== 'resign' && <div className="card small dim">You can extend these players now. When the season ends, anyone left unsigned here becomes a free agent unless you re-sign or tag him.</div>}
      <Table rows={rows} rowKey={p => p.id} initial="ovr" onRow={p => app.go({ id: 'player', pid: p.id })} cols={[
        { k: 'p', h: 'Player', get: p => <PlayerCell p={p} />, sort: p => p.ln },
        { k: 'ovr', h: 'OVR', get: p => <Ovr v={p.ovr} />, sort: p => p.ovr, cls: 'c' },
        { k: 'age', h: 'Age', get: p => Math.floor(p.age), sort: p => p.age, cls: 'c' },
        { k: 'ask', h: 'Asking', get: p => `${money(askingPrice(L, p).apy)} × ${askingPrice(L, p).years}`, sort: p => askingPrice(L, p).apy, cls: 'r' },
        { k: 'mv', h: 'Market', get: p => money(marketValue(p, L.season)), cls: 'r' },
        { k: 'act', h: '', get: p => <div className="row" onClick={e => e.stopPropagation()}><button className="btn sm primary" onClick={() => setNeg(p)}>Negotiate</button>{L.phase === 'resign' && !tagged && <button className="btn sm" title={`Tag: ${money(franchiseTag(L, p, L.season))}`} onClick={() => { const amt = applyTag(L, p); app.toast(`Franchise tag: ${money(amt)}`); app.touch(); }}>Tag {money(franchiseTag(L, p, L.season))}</button>}</div> },
      ]} />
      {neg && <NegotiationRoom p={neg} close={() => { setNeg(null); app.touch(); }} />}
    </div>
  );
}

// ---- cap ---------------------------------------------------------------------------------------
export function CapScreen() {
  const L = useApp().league!;
  const seasons = [L.season, L.season + 1, L.season + 2, L.season + 3];
  const roster = Object.values(L.players).filter(p => p.team === L.user && p.contract.years.length).sort((a, b) => capHit(b.contract, L.season) - capHit(a.contract, L.season));
  const used = teamPayroll(L, L.user, L.season), cap = capFor(L, L.season) + L.teams[L.user].rollover;
  return (
    <div className="grid">
      <div className="grid g4">
        <div className="card stat"><span className="k">{L.season} Cap</span><span className="v">{money(cap)}</span></div>
        <div className="card stat"><span className="k">Committed</span><span className="v">{money(used)}</span></div>
        <div className="card stat"><span className="k">Space</span><span className={`v ${cap - used < 0 ? 'bad' : 'good'}`}><CountUp v={cap - used} fmt={money} /></span></div>
        <div className="card stat"><span className="k">Dead Money</span><span className="v bad">{money(L.teams[L.user].dead[L.season] ?? 0)}</span></div>
      </div>
      <div className="card"><Bar v={used} max={cap} cls="cap" /></div>
      <div className="card"><div className="scroll"><table className="tbl"><thead><tr><th>Player</th><th className="c">OVR</th>{seasons.map(s => <th key={s} className="r">{s}</th>)}</tr></thead>
        <tbody>{roster.map(p => <tr key={p.id} onClick={() => app.go({ id: 'player', pid: p.id })}><td><PlayerCell p={p} /></td><td className="c"><Ovr v={p.ovr} /></td>{seasons.map(s => { const h = capHit(p.contract, s); const y = p.contract.years.find(v => v.s === s); return <td key={s} className="r" style={{ color: y?.v ? 'var(--warn)' : undefined }}>{h ? money(h) : ''}</td>; })}</tr>)}
          <tr><td><b>Totals</b></td><td />{seasons.map(s => <td key={s} className="r"><b>{money(teamPayroll(L, L.user, s))}</b><div className="small mute">of {money(capFor(L, s))}</div></td>)}</tr></tbody></table></div></div>
    </div>
  );
}

// ---- coach tree --------------------------------------------------------------------------------
type Ab = CoachAbility;
type NodeState = 'owned' | 'ready' | 'afford' | 'locked';
const ROMAN = ['', 'I', 'II', 'III'];
const ROWY = [0, 11, 46, 81]; // tier rows, % of the graph height
const LOCK = 'M7 10V7a5 5 0 0 1 10 0v3h1v11H6V10zm2 0h6V7a3 3 0 0 0-6 0z';
const Glyph = ({ d, s = 22 }: { d: string; s?: number }) => <svg viewBox="0 0 24 24" width={s} height={s}><path d={d} fill="currentColor" /></svg>;

function Medal({ a, st, big }: { a: Ab; st: NodeState; big?: boolean }) {
  return (
    <span className={`cx-medal ${st}${big ? ' big' : ''}`}>
      <svg className="cx-ring" viewBox="0 0 60 60"><circle cx="30" cy="30" r="27" /><circle cx="30" cy="30" r="21.5" /></svg>
      <span className="cx-core"><Glyph d={st === 'locked' ? LOCK : TREE_INFO[a.tree].glyph} s={big ? 34 : 22} /></span>
      <span className="cx-tier">{ROMAN[a.tier]}</span>
    </span>
  );
}

export function CoachScreen() {
  const L = useApp().league!;
  const c = L.coachTree;
  const me = L.teams[L.user];
  const [sel, setSel] = useState<string>(() => COACH_ABILITIES.find(a => !c.unlocked.includes(a.id) && (!a.needs || c.unlocked.includes(a.needs)))?.id ?? COACH_ABILITIES[0].id);
  const [just, setJust] = useState('');
  const ab = COACH_ABILITIES.find(a => a.id === sel) ?? COACH_ABILITIES[0];
  const state = (a: Ab): NodeState => c.unlocked.includes(a.id) ? 'owned' : a.needs && !c.unlocked.includes(a.needs) ? 'locked' : c.points >= a.tier ? 'ready' : 'afford';
  const need = coachXpNeed(c.level), pct = Math.min(1, c.xp / need);
  const unlock = (a: Ab) => { if (state(a) !== 'ready') return; c.points -= a.tier; c.unlocked.push(a.id); setJust(a.id); app.toast(`${a.id} unlocked: ${a.effect}`); app.touch(); };
  const owned = COACH_ABILITIES.filter(a => c.unlocked.includes(a.id));
  const spent = owned.reduce((n, a) => n + a.tier, 0), total = COACH_ABILITIES.reduce((n, a) => n + a.tier, 0);
  const kids = COACH_ABILITIES.filter(a => a.needs === ab.id);
  const st = state(ab);
  return (
    <div className="cx">
      <div className="cx-head" style={{ '--tc': vivid(me.colors[0]) } as React.CSSProperties}>
        <div className="cx-lvl">
          <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="7" /><circle cx="50" cy="50" r="44" fill="none" stroke="#fff" strokeWidth="7" strokeDasharray={`${276 * pct} 276`} transform="rotate(-90 50 50)" strokeLinecap="round" /></svg>
          <b>{c.level}</b><span>Level</span>
        </div>
        <div className="cx-id">
          <span className="up">Head Coach · {me.name}</span>
          <div className="h1">{me.coach.name}</div>
          <div className="cx-meta"><span>{me.coach.off} Offense</span><span>{me.coach.def} Defense</span><span>{c.xp} / {need} XP to level {c.level + 1}</span></div>
          <div className="cx-trees-strip">{COACH_TREES.map(t => { const n = COACH_ABILITIES.filter(a => a.tree === t), o = n.filter(a => c.unlocked.includes(a.id)).length; return (
            <a key={t} href={`#cx-${t}`} onClick={e => { e.preventDefault(); document.getElementById(`cx-${t}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }} style={{ '--tr': TREE_INFO[t].color } as React.CSSProperties}>
              <Glyph d={TREE_INFO[t].glyph} s={14} /><span>{t}</span><i><em style={{ width: `${(o / n.length) * 100}%` }} /></i><b>{o}/{n.length}</b>
            </a>); })}</div>
        </div>
        <div className="cx-pts"><b>{c.points}</b><span>Coach Points</span><small>{spent} of {total} invested</small></div>
      </div>

      <div className="cx-body">
        <div className="cx-board">{COACH_TREES.map(t => {
          const info = TREE_INFO[t], nodes = COACH_ABILITIES.filter(a => a.tree === t);
          const rows = [1, 2, 3].map(k => nodes.filter(a => a.tier === k));
          const at = (a: Ab) => { const r = rows[a.tier - 1]; return { x: ((r.indexOf(a) + 1) / (r.length + 1)) * 100, y: ROWY[a.tier] }; };
          const o = nodes.filter(a => c.unlocked.includes(a.id)).length;
          return (
            <section key={t} id={`cx-${t}`} className={`cx-tree${o === nodes.length ? ' done' : ''}`} style={{ '--tr': info.color } as React.CSSProperties}>
              <header>
                <span className="cx-crest"><Glyph d={info.glyph} s={20} /></span>
                <div><b>{t}</b><small>{info.blurb}</small></div>
                <span className="cx-count">{o}<i>/{nodes.length}</i></span>
                <i className="cx-prog"><em style={{ width: `${(o / nodes.length) * 100}%` }} /></i>
              </header>
              <div className="cx-graph">
                {[1, 2, 3].map(k => <span key={k} className="cx-row" style={{ top: `${ROWY[k]}%` }}>{ROMAN[k]}</span>)}
                <svg className="cx-links" viewBox="0 0 100 100" preserveAspectRatio="none">{nodes.filter(a => a.needs).map(a => {
                  const par = nodes.find(n => n.id === a.needs); if (!par) return null;
                  const A = at(par), B = at(a), y1 = A.y + 18, y2 = B.y - 7, m = (y1 + y2) / 2;
                  const cls = c.unlocked.includes(a.id) ? 'on' : c.unlocked.includes(par.id) ? 'open' : '';
                  return <path key={a.id} d={`M${A.x} ${y1} C${A.x} ${m} ${B.x} ${m} ${B.x} ${y2}`} className={cls} vectorEffect="non-scaling-stroke" />;
                })}</svg>
                {nodes.map(a => { const p = at(a), s2 = state(a); return (
                  <button key={a.id} className={`cx-node ${s2}${sel === a.id ? ' sel' : ''}${just === a.id ? ' just' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }}
                    onClick={() => setSel(a.id)} onDoubleClick={() => unlock(a)} title={`${a.id}: ${a.effect}`}>
                    <Medal a={a} st={s2} />
                    <span className="cx-name">{a.id}</span>
                    <em>{s2 === 'owned' ? 'Active' : s2 === 'locked' ? 'Locked' : `${a.tier} CP`}</em>
                  </button>
                ); })}
              </div>
            </section>
          );
        })}</div>

        <aside className="cx-side">
          <div className="cx-detail" style={{ '--tr': TREE_INFO[ab.tree].color } as React.CSSProperties}>
            <div className="cx-dtop"><Medal a={ab} st={st} big /><div><span className="ak">{ab.tree} · Tier {ROMAN[ab.tier]}</span><div className="h2">{ab.id}</div></div></div>
            <p>{ab.desc}</p>
            <div className="cx-effect"><span>Effect</span><b>{ab.effect}</b></div>
            <div className="cx-facts">
              <div><span>Cost</span><b>{ab.tier} coach point{ab.tier > 1 ? 's' : ''}</b></div>
              <div><span>Requires</span><b className={ab.needs ? (c.unlocked.includes(ab.needs) ? 'ok' : 'no') : ''}>{ab.needs ? <button className="cx-link" onClick={() => setSel(ab.needs!)}>{c.unlocked.includes(ab.needs) ? '✓ ' : ''}{ab.needs}</button> : 'Nothing'}</b></div>
              <div><span>Leads to</span><b>{kids.length ? kids.map(k => <button key={k.id} className="cx-link" onClick={() => setSel(k.id)}>{k.id}</button>) : 'Capstone'}</b></div>
            </div>
            {st === 'owned' ? <div className="cx-owned">Active on your team</div>
              : <button className="btn primary big" disabled={st !== 'ready'} onClick={() => unlock(ab)}>{st === 'locked' ? `Unlock ${ab.needs} first` : st === 'afford' ? `Need ${ab.tier - c.points} more point${ab.tier - c.points > 1 ? 's' : ''}` : `Unlock · ${ab.tier} CP`}</button>}
          </div>

          <div className="cx-card">
            <h4>Active bonuses <span>{owned.length}</span></h4>
            {owned.length ? owned.map(a => <button key={a.id} className="cx-bonus" style={{ '--tr': TREE_INFO[a.tree].color } as React.CSSProperties} onClick={() => setSel(a.id)}><Glyph d={TREE_INFO[a.tree].glyph} s={14} /><b>{a.id}</b><span>{a.effect}</span></button>)
              : <p className="mute small">Nothing yet. Pick a Tier I ability to start a tree.</p>}
          </div>

          <div className="cx-card">
            <h4>Earning points</h4>
            <div className="cx-earn"><span>Win</span><b>+120 XP</b></div>
            <div className="cx-earn"><span>Loss</span><b>+40 XP</b></div>
            <div className="cx-earn"><span>Playoff win</span><b>+260 XP</b></div>
            <div className="cx-earn"><span>Owner goal met</span><b>+120 XP</b></div>
            <div className="cx-earn"><span>Each coach level</span><b>+{POINTS_PER_LEVEL} CP</b></div>
            <div className="cx-xp"><i style={{ width: `${pct * 100}%` }} /></div>
            <div className="small mute">{need - c.xp} XP to level {c.level + 1}. Double-click any ability to unlock it.</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---- weekly strategy -----------------------------------------------------------------------------
export function PlanScreen() {
  const L = useApp().league!;
  const t = L.teams[L.user];
  const ug = userGame(L);
  const oppAbbr = ug ? (ug.home === L.user ? ug.away : ug.home) : undefined;
  const opp = oppAbbr ? L.teams[oppAbbr] : undefined;
  const report = useMemo(() => oppAbbr ? scoutingReport(L, oppAbbr) : null, [oppAbbr, L.week]);
  const set = <K extends keyof GamePlan>(k: K, v: GamePlan[K]) => { t.plan[k] = v; app.touch(); };
  const opt = <K extends keyof GamePlan>(k: K, vals: GamePlan[K][], desc: Record<string, string>) => (
    <div className="grid" style={{ gap: 8 }}>{vals.map(v => <div key={String(v)} className="li" onClick={() => set(k, v)} style={{ borderRadius: 10, padding: 10, background: t.plan[k] === v ? 'color-mix(in srgb, var(--team) 25%, transparent)' : 'rgba(255,255,255,.02)' }}><span className={`chip${t.plan[k] === v ? ' on' : ''}`}>{String(v)}</span><span className="small dim">{desc[String(v)]}</span></div>)}</div>
  );
  const tired = Object.values(L.players).filter(p => p.team === L.user && p.status === 'ACT' && p.cond < 80).sort((a, b) => a.cond - b.cond);
  return (
    <div className="grid g3">
      <div className="card span2">
        {opp && report ? <>
          <div className="row"><Logo team={opp} size={64} /><div><div className="up">Opponent Scouting Report</div><div className="h2">{opp.name}</div><div className="dim small">{opp.coach.name}: {opp.coach.off} / {opp.coach.def} · {standings(L)[oppAbbr!].w}-{standings(L)[oppAbbr!].l}</div></div></div>
          <div className="grid g4" style={{ margin: '16px 0' }}>
            <div className="stat"><span className="k">Pass rate</span><span className="v">{report.passRate}%</span></div>
            <div className="stat"><span className="k">Points / game</span><span className="v">{report.ppg}</span></div>
            <div className="stat"><span className="k">Offense</span><span className="v">{report.off}</span></div>
            <div className="stat"><span className="k">Defense</span><span className="v">{report.def}</span></div>
          </div>
          <div className="up" style={{ marginBottom: 6 }}>Players to watch</div>
          <div className="grid g3">{report.stars.map(p => <div key={p.id} className="li" onClick={() => app.go({ id: 'player', pid: p.id })}><Face p={p} size={40} /><div style={{ flex: 1 }}><b>{p.fn} {p.ln}</b><div className="small mute">{p.pos} · {p.arch}</div></div><Ovr v={p.ovr} /></div>)}</div>
          <div className="small dim" style={{ marginTop: 12 }}>Suggestion: {report.tip}</div>
        </> : <div className="empty">No game this week.</div>}
      </div>
      <div className="card"><h3>Wear & Tear</h3>{tired.slice(0, 8).map(p => <div key={p.id} className="row" style={{ margin: '6px 0' }}><span className="small" style={{ width: 120 }}>{p.pos} {p.ln}</span><div style={{ flex: 1 }}><Bar v={p.cond} color={p.cond < 60 ? '#ef4444' : p.cond < 75 ? '#f59e0b' : undefined} /></div><span className="small num" style={{ width: 36, textAlign: 'right' }}>{Math.round(p.cond)}%</span></div>)}{!tired.length && <div className="empty">Everyone is fresh.</div>}</div>
      <div className="card"><h3>Offensive Game Plan</h3>{opt('off', ['Balanced', 'Run Heavy', 'Pass Heavy', 'Vertical', 'Ball Control'], { Balanced: 'Take what the defense gives.', 'Run Heavy': 'Lean on the ground game and play-action.', 'Pass Heavy': 'Spread them out and throw.', Vertical: 'Push the ball downfield.', 'Ball Control': 'Short passes and runs, burn clock.' })}</div>
      <div className="card"><h3>Defensive Game Plan</h3>{opt('def', ['Balanced', 'Stop the Run', 'Stop the Pass', 'Blitz Heavy', 'Prevent'], { Balanced: 'Sound, base defense.', 'Stop the Run': 'Load the box; easier to throw on.', 'Stop the Pass': 'Light boxes, more coverage.', 'Blitz Heavy': 'Pressure the QB, risk big plays.', Prevent: 'Keep everything in front.' })}</div>
      <div className="card"><h3>Practice Intensity</h3>{opt('practice', ['Light', 'Normal', 'Intense'], { Light: 'Most recovery, least XP.', Normal: 'Balanced XP and recovery.', Intense: 'Most XP; more wear and practice injuries.' })}</div>
    </div>
  );
}
function scoutingReport(L: ReturnType<typeof useApp>['league'] & object, abbr: string) {
  const games = L.games.filter(g => g.season === L.season && g.result && (g.home === abbr || g.away === abbr));
  let pts = 0, pa = 0, ra = 0;
  for (const g of games) {
    pts += g.home === abbr ? g.result!.hs : g.result!.as;
    for (const [id, l] of Object.entries(g.result!.box?.players ?? {})) if (L.players[id]?.team === abbr) { pa += l.pa ?? 0; ra += l.ra ?? 0; }
  }
  const r = teamRatings(L, abbr);
  const stars = Object.values(L.players).filter(p => p.team === abbr && p.status === 'ACT' && !p.injury).sort((a, b) => b.ovr - a.ovr).slice(0, 6);
  const passRate = pa + ra ? Math.round((pa / (pa + ra)) * 100) : 56;
  const tip = r.qb > r.skill + 4 ? 'Their offense runs through the quarterback. Consider Stop the Pass or Blitz Heavy.' : passRate < 50 ? 'They run often. Stop the Run will force their quarterback to beat you.' : r.def > r.off ? 'A defense-first team. Ball Control limits turnovers against them.' : 'A balanced opponent. Stick to your identity.';
  return { passRate, ppg: games.length ? (pts / games.length).toFixed(1) : '—', off: Math.round(r.off), def: Math.round(r.def), stars, tip };
}
export { Tabs };
