import { useMemo, useState } from 'react';
import { useApp, app } from '../store';
import { Logo, Ovr, Face, Portrait, Table, PlayerCell, DevBadge, Bar, Tabs, CountUp } from '../components';
import { NegotiationRoom } from './negotiate';
import { market } from '../../core/negotiate';
import type { GamePlan, Player } from '../../core/types';
import { capFor, capHit, capSpace, money, teamPayroll, yearsLeft, franchiseTag, marketValue } from '../../core/contracts';
import { freeAgents } from '../../core/freeagency';
import { askingPrice, expiringFor, applyTag } from '../../core/offseason';
import { teamRatings } from '../../core/league';
import { userGame, standings } from '../../core/season';
import { POS_ORDER } from '../../core/ratings';

// ---- free agency ------------------------------------------------------------------------------
const FA_DAYS = ['Legal Tampering', 'Opening Day', 'Day 3', 'Day 4', 'Second Wave', 'Day 6', 'Bargain Bin', 'Final Day'];
export function FreeAgencyScreen() {
  const L = useApp().league!;
  const [pos, setPos] = useState<string>('All');
  const [neg, setNeg] = useState<Player | null>(null);
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
      <div className="fa-top">{all.slice(0, 6).map(p => { const m = market(L, p); return (
        <div key={p.id} className="fa-tile" onClick={() => setNeg(p)}>
          <Portrait p={p} />
          <div className="pn">{p.fn[0]}. {p.ln}</div><div className="ps">{p.pos} · {Math.floor(p.age)} yrs · asks {money(askingPrice(L, p).apy)}</div>
          <div className="fa-meta"><span className="heat"><b style={{ width: `${m.heat * 100}%` }} /></span>{m.leader ? <><Logo team={L.teams[m.leader]} size={20} />{m.leader === L.user && <b className="good small">YOU</b>}</> : <span className="mute small">No offers</span>}</div>
        </div>); })}</div>
      <div className="row">{['All', ...POS_ORDER].map(p => <span key={p} className={`chip${pos === p ? ' on' : ''}`} onClick={() => setPos(p)}>{p}</span>)}</div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 280px', alignItems: 'start' }}>
        <Table rows={rows} rowKey={p => p.id} initial="ovr" onRow={p => setNeg(p)} cols={[
          { k: 'p', h: 'Player', get: p => <PlayerCell p={p} />, sort: p => p.ln },
          { k: 'ovr', h: 'OVR', get: p => <Ovr v={p.ovr} />, sort: p => p.ovr, cls: 'c' },
          { k: 'dev', h: 'Dev', get: p => <DevBadge d={p.dev} /> },
          { k: 'age', h: 'Age', get: p => Math.floor(p.age), sort: p => p.age, cls: 'c' },
          { k: 'ask', h: 'Asking / yr', get: p => money(askingPrice(L, p).apy), sort: p => askingPrice(L, p).apy, cls: 'r' },
          { k: 'yrs', h: 'Yrs', get: p => askingPrice(L, p).years, cls: 'c' },
          { k: 'heat', h: 'Market', get: p => <span className="heat"><b style={{ width: `${market(L, p).heat * 100}%` }} /></span>, sort: p => market(L, p).heat },
          { k: 'lead', h: 'Leaning', get: p => { const m = market(L, p); return m.leader ? <span className="row" style={{ gap: 4 }}><Logo team={L.teams[m.leader]} size={20} />{m.leader === L.user && <b className="good small">YOU</b>}</span> : ''; }, sort: p => market(L, p).offers.length },
          { k: 'mine', h: 'Your Offer', get: p => (L.fa?.offers[p.id] ?? []).some(o => o.team === L.user) ? <span className="chip on" style={{ padding: '0 6px' }}>On table</span> : L.talks?.[p.id]?.closed ? <span className="bad small">Talks off</span> : '' },
        ]} />
        <div className="card"><div className="h3">Signings</div>{signings.length ? signings.map(n => <div key={n.id} className="li small">{n.teams[0] && <Logo team={L.teams[n.teams[0]]} size={22} />}<span>{n.text}</span></div>) : <div className="small dim">No moves yet.</div>}</div>
      </div>
      {neg && <NegotiationRoom p={neg} close={() => { setNeg(null); app.touch(); }} />}
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

// ---- coach abilities (Madden 26-style tree) ---------------------------------------------------
export const COACH_ABILITIES: { id: string; tree: string; tier: number; desc: string; needs?: string }[] = [
  { id: 'Mentor', tree: 'Development', tier: 1, desc: '+12% XP for every player on your roster.' },
  { id: 'Rookie Camp', tree: 'Development', tier: 2, desc: 'Rookies earn +15% XP.', needs: 'Mentor' },
  { id: 'Player Development II', tree: 'Development', tier: 3, desc: 'Another +12% XP across the roster.', needs: 'Rookie Camp' },
  { id: 'QB Whisperer', tree: 'Development', tier: 2, desc: 'Quarterbacks earn +20% XP.', needs: 'Mentor' },
  { id: 'Motivator', tree: 'Game Day', tier: 1, desc: 'Your players play +1 rating point better on game day.' },
  { id: 'Disciplinarian', tree: 'Game Day', tier: 2, desc: '40% fewer pre-snap penalties.', needs: 'Motivator' },
  { id: 'Clock Manager', tree: 'Game Day', tier: 2, desc: 'Your team wins more one-score games late (+2 in the final 5 minutes).', needs: 'Motivator' },
  { id: 'Sports Science', tree: 'Health', tier: 1, desc: 'Players recover 6 extra condition points each week.' },
  { id: 'Iron Program', tree: 'Health', tier: 2, desc: '25% fewer in-game injuries.', needs: 'Sports Science' },
  { id: 'Cap Guru', tree: 'Front Office', tier: 1, desc: 'Players ask 6% less to re-sign with you.' },
  { id: 'Eye for Talent', tree: 'Front Office', tier: 1, desc: 'Scouting costs 25% fewer points.' },
  { id: 'Auto Depth', tree: 'Front Office', tier: 1, desc: 'Your depth chart re-optimises itself every week.' },
];
export function CoachScreen() {
  const L = useApp().league!;
  const c = L.coachTree;
  const trees = [...new Set(COACH_ABILITIES.map(a => a.tree))];
  return (
    <div className="grid">
      <div className="card hero"><div className="row" style={{ position: 'relative' }}><div><div className="up">Head Coach</div><div className="h1">{L.teams[L.user].coach.name}</div><div className="dim">{L.teams[L.user].coach.off} offense · {L.teams[L.user].coach.def} defense · GM {L.gm}</div></div><div className="spacer" />
        <div className="stat" style={{ textAlign: 'right' }}><span className="k">Level {c.level}</span><span className="v">{c.points} pts</span><div style={{ width: 200 }}><Bar v={c.xp} max={c.level * 450} /></div></div></div></div>
      <div className="grid g4">{trees.map(t => (
        <div key={t} className="card"><h3>{t}</h3>{COACH_ABILITIES.filter(a => a.tree === t).sort((a, b) => a.tier - b.tier).map(a => {
          const owned = c.unlocked.includes(a.id), locked = !!a.needs && !c.unlocked.includes(a.needs);
          return (
            <div key={a.id} className="card" style={{ padding: 12, margin: '10px 0', marginLeft: (a.tier - 1) * 12, borderColor: owned ? 'var(--good)' : undefined, opacity: locked ? 0.45 : 1, boxShadow: 'none' }}>
              <div className="row"><b>{a.id}</b><span className="small mute">Tier {a.tier}</span><div className="spacer" />{owned ? <span className="good small">✔ Active</span> : <button className="btn sm primary" disabled={locked || c.points < a.tier} onClick={() => { c.points -= a.tier; c.unlocked.push(a.id); app.toast(`${a.id} unlocked`); app.touch(); }}>{a.tier} pt</button>}</div>
              <div className="small dim" style={{ marginTop: 4 }}>{a.desc}</div>
            </div>
          );
        })}</div>
      ))}</div>
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
