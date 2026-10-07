import { useMemo, useState } from 'react';
import { useApp, app } from '../store';
import { Logo, Ovr, Face, Table, PlayerCell, DevBadge, Modal, Bar, Tabs, CountUp } from '../components';
import { ExtendModal } from './team';
import type { GamePlan, Player } from '../../core/types';
import { capFor, capHit, capSpace, money, teamPayroll, yearsLeft, franchiseTag, marketValue } from '../../core/contracts';
import { freeAgents, makeOffer, signNow } from '../../core/freeagency';
import { askingPrice, expiringFor, applyTag, evaluateOffer } from '../../core/offseason';
import { teamRatings } from '../../core/league';
import { userGame, standings } from '../../core/season';
import { POS_ORDER } from '../../core/ratings';

// ---- free agency ------------------------------------------------------------------------------
export function FreeAgencyScreen() {
  const L = useApp().league!;
  const [pos, setPos] = useState<string>('All');
  const [offerFor, setOfferFor] = useState<Player | null>(null);
  const rows = freeAgents(L).filter(p => pos === 'All' || p.pos === pos);
  const open = L.phase === 'freeagency';
  return (
    <div className="grid">
      <div className="row"><div className="h2">Free Agents</div>{open ? <span className="chip on">Day {L.fa?.day} of 8</span> : <span className="chip">{L.phase === 'regular' ? 'In-season: unsigned players take fair offers immediately' : 'Signings outside free agency are immediate'}</span>}<div className="spacer" /><span className="dim">Cap space <b>{money(capSpace(L, L.user))}</b></span></div>
      <div className="row">{['All', ...POS_ORDER].map(p => <span key={p} className={`chip${pos === p ? ' on' : ''}`} onClick={() => setPos(p)}>{p}</span>)}</div>
      <Table rows={rows} rowKey={p => p.id} initial="ovr" onRow={p => setOfferFor(p)} cols={[
        { k: 'p', h: 'Player', get: p => <PlayerCell p={p} />, sort: p => p.ln },
        { k: 'ovr', h: 'OVR', get: p => <Ovr v={p.ovr} />, sort: p => p.ovr, cls: 'c' },
        { k: 'dev', h: 'Dev', get: p => <DevBadge d={p.dev} /> },
        { k: 'age', h: 'Age', get: p => Math.floor(p.age), sort: p => p.age, cls: 'c' },
        { k: 'ask', h: 'Asking / yr', get: p => money(askingPrice(L, p).apy), sort: p => askingPrice(L, p).apy, cls: 'r' },
        { k: 'yrs', h: 'Yrs', get: p => askingPrice(L, p).years, cls: 'c' },
        { k: 'mot', h: 'Motivations', get: p => <span className="small dim">{p.motiv.join(' · ')}</span> },
        { k: 'off', h: 'Offers', get: p => (L.fa?.offers[p.id]?.length ?? 0) || '', sort: p => L.fa?.offers[p.id]?.length ?? 0, cls: 'c' },
      ]} />
      {offerFor && <OfferModal p={offerFor} close={() => setOfferFor(null)} />}
    </div>
  );
}
function OfferModal({ p, close }: { p: Player; close: () => void }) {
  const L = useApp().league!;
  const ask = askingPrice(L, p);
  const [apy, setApy] = useState(ask.apy);
  const [years, setYears] = useState(ask.years);
  const [gtd, setGtd] = useState(Math.round(ask.gtd * 100));
  const interest = evaluateOffer(L, p, { apy, years, gtd: gtd / 100 }, L.user);
  const rival = (L.fa?.offers[p.id] ?? []).filter(o => o.team !== L.user);
  const submit = () => {
    const o = { apy, years, gtd: gtd / 100 };
    const r = L.phase === 'freeagency' ? makeOffer(L, p, o) : signNow(L, p, o);
    app.toast(r.msg); app.touch();
    if (r.ok) close();
  };
  return (
    <Modal onClose={close}>
      <div className="row"><Face p={p} size={70} /><div><div className="h2">{p.fn} {p.ln}</div><div className="small dim">{p.pos} · {Math.floor(p.age)} yrs · {p.arch} · Motivations: {p.motiv.join(', ')}</div></div><div className="spacer" /><Ovr v={p.ovr} lg /></div>
      <div className="small dim" style={{ marginTop: 10 }}>Asking {money(ask.apy)}/yr · {ask.years} years · {Math.round(ask.gtd * 100)}% guaranteed{rival.length ? ` · ${rival.length} other offer(s) on the table` : ''}</div>
      <div style={{ margin: '16px 0' }}>
        <label className="up">Per year: <b style={{ color: 'var(--text)' }}>{money(apy)}</b></label>
        <input type="range" min={Math.round(ask.apy * 0.5)} max={Math.round(ask.apy * 1.5)} step={25_000} value={apy} onChange={e => setApy(+e.target.value)} style={{ width: '100%' }} />
        <label className="up">Years: <b style={{ color: 'var(--text)' }}>{years}</b></label>
        <input type="range" min={1} max={5} value={years} onChange={e => setYears(+e.target.value)} style={{ width: '100%' }} />
        <label className="up">Guaranteed: <b style={{ color: 'var(--text)' }}>{gtd}%</b></label>
        <input type="range" min={0} max={90} value={gtd} onChange={e => setGtd(+e.target.value)} style={{ width: '100%' }} />
      </div>
      <div className="up">His interest</div>
      <div className="meter" style={{ margin: '8px 0 16px' }}><b style={{ left: `${interest * 100}%` }} /></div>
      <div className="row"><span className="small dim">Total {money(apy * years)} · Your cap space {money(capSpace(L, L.user))}</span><div className="spacer" /><button className="btn ghost" onClick={close}>Cancel</button><button className="btn primary" onClick={submit}>{L.phase === 'freeagency' ? 'Submit Offer' : 'Sign Now'}</button></div>
    </Modal>
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
      {neg && <ExtendModal p={neg} close={() => setNeg(null)} />}
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
