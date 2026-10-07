import { useEffect, useRef, useState } from 'react';
import { useApp, app } from '../store';
import { Logo, Ovr, Face, Table, Tabs, DevBadge, Modal, Tilt } from '../components';
import type { Player } from '../../core/types';
import { aiPickNow, makePick, picksInOrder, prospects, scout, scoutedView, SCOUT_COST, positionNeeds } from '../../core/draft';
import { POS_ORDER, POS_NAME } from '../../core/ratings';
import { pickLabel } from '../../core/trade';
import { Rng } from '../../core/rng';
import { money } from '../../core/contracts';

export function DraftScreen() {
  const L = useApp().league!;
  const live = L.phase === 'draft' && L.draft && !L.draft.done;
  const [tab, setTab] = useState<'Big Board' | 'My Board' | 'Draft Order' | 'Results'>(live ? 'Big Board' : 'Big Board');
  const [pos, setPos] = useState('All');
  const [sel, setSel] = useState<Player | null>(null);
  const [announce, setAnnounce] = useState<{ p: Player; no: number; team: string } | null>(null);
  const [auto, setAuto] = useState(false);
  const pool = prospects(L).filter(p => pos === 'All' || p.pos === pos);
  const order = live ? picksInOrder(L) : [];
  const cursor = L.draft?.cursor ?? 0;
  const current = order[cursor];
  const onClock = live && current?.owner === L.user;
  const myPicks = L.picks.filter(k => k.owner === L.user && k.season === (L.phase === 'draft' ? L.season : L.season + 1));
  const needs = positionNeeds(L, L.user);
  const year = prospects(L)[0]?.draft.year ?? L.season + 1;
  const timer = useRef(0);

  // Live draft: AI teams pick on a short clock; the user's pick waits.
  useEffect(() => {
    if (!live || onClock || announce) return;
    timer.current = window.setTimeout(() => {
      const before = L.draft!.cursor;
      const pick = picksInOrder(L)[before];
      aiPickNow(L, new Rng(L.seed + before));
      const p = Object.values(L.players).find(x => x.draft.year === L.season && x.draft.pick === pick?.no);
      if (p && pick && (pick.no! <= 32 || pick.owner === L.user)) setAnnounce({ p, no: pick.no!, team: pick.owner });
      app.touch();
    }, auto ? 120 : cursor < 32 ? 900 : 260);
    return () => clearTimeout(timer.current);
  }, [live, onClock, cursor, announce, auto]);
  useEffect(() => { if (!announce) return; const t = setTimeout(() => setAnnounce(null), auto ? 500 : 2400); return () => clearTimeout(t); }, [announce]);
  useEffect(() => { if (onClock && auto) { const best = myBoard(L, pool)[0]; if (best) draft(best); } }, [onClock, auto]);

  const draft = (p: Player) => {
    const no = current!.no!;
    makePick(L, p.id);
    setAnnounce({ p, no, team: L.user });
    setSel(null);
    app.touch();
  };

  return (
    <div className="grid">
      <div className="card hero" style={{ padding: 18 }}>
        <div className="row" style={{ position: 'relative' }}>
          <div><div className="up" style={{ color: 'var(--team2)' }}>{live ? 'Live' : L.phase === 'draft' ? 'Complete' : 'Scouting'} · {year} NFL Draft</div>
            {live && current ? <div className="row"><Logo team={L.teams[current.owner]} size={56} /><div><div className="h2">{onClock ? 'You are on the clock' : `${L.teams[current.owner].name} on the clock`}</div><div className="dim">Round {current.round}, pick {current.no} ({pickLabel(L, current)})</div></div></div>
              : <div className="h2">{L.phase === 'draft' ? 'The draft is complete' : `${prospects(L).length} prospects in the ${year} class`}</div>}
          </div>
          <div className="spacer" />
          <div className="stat" style={{ textAlign: 'right' }}><span className="k">Scouting points</span><span className="v">{L.scoutPoints}</span></div>
          {live && <>
            <button className="btn" onClick={() => setAuto(a => !a)}>{auto ? '⏸ Stop Auto' : '⏩ Auto Draft'}</button>
            {!onClock && <button className="btn" onClick={() => { clearTimeout(timer.current); let guard = 0; while (!L.draft!.done && picksInOrder(L)[L.draft!.cursor]?.owner !== L.user && guard++ < 300) aiPickNow(L, new Rng(L.seed + L.draft!.cursor)); app.touch(); }}>Sim to My Pick</button>}
            <button className="btn" onClick={() => app.go({ id: 'trade' })}>Trade Picks</button>
          </>}
        </div>
        {live && <Ticker />}
      </div>
      <div className="row">
        <Tabs tabs={['Big Board', 'My Board', 'Draft Order', 'Results'] as const} on={tab} set={setTab} />
        <div className="spacer" />
        <span className="small dim">Your picks: {myPicks.map(k => pickLabel(L, k)).join(', ') || 'none'}</span>
      </div>
      {(tab === 'Big Board' || tab === 'My Board') && <>
        <div className="row">{['All', ...POS_ORDER].map(p => <span key={p} className={`chip${pos === p ? ' on' : ''}`} onClick={() => setPos(p)}>{p}{p !== 'All' && (needs[p as keyof typeof needs] ?? 0) >= 1.5 ? ' •' : ''}</span>)}</div>
        <Table rows={tab === 'My Board' ? myBoard(L, pool) : pool} rowKey={p => p.id} initial={tab === 'My Board' ? undefined : 'proj'} desc={false} onRow={setSel} cols={[
          { k: 'proj', h: 'Rank', get: p => <span className="num">{p.proj}</span>, sort: p => p.proj ?? 999, cls: 'c' },
          { k: 'p', h: 'Prospect', get: p => <div className="pcell"><Face p={p} size={36} /><div><b>{p.fn} {p.ln}</b><div className="small mute">{p.col}</div></div></div>, sort: p => p.ln },
          { k: 'pos', h: 'Pos', get: p => p.pos, sort: p => POS_ORDER.indexOf(p.pos), cls: 'c' },
          { k: 'grade', h: 'Scout Grade', get: p => { const v = scoutedView(p); return <span className="num">{v.ovrLo}–{v.ovrHi}</span>; }, sort: p => scoutedView(p).ovrLo, cls: 'c' },
          { k: 'arch', h: 'Archetype', get: p => (p.scout ?? 0) >= 1 ? p.arch : <span className="mute">?</span> },
          { k: 'dev', h: 'Dev', get: p => (p.scout ?? 0) >= 3 ? <DevBadge d={p.dev} /> : <span className="mute">?</span> },
          { k: 'forty', h: '40', get: p => p.combine?.forty.toFixed(2), sort: p => -(p.combine?.forty ?? 9), cls: 'c' },
          { k: 'age', h: 'Age', get: p => p.age, cls: 'c' },
          { k: 'proj2', h: 'Projection', get: p => projection(p.proj ?? 300) },
          { k: 'sc', h: 'Scouting', get: p => <ScoutPips lvl={p.scout ?? 0} />, sort: p => p.scout ?? 0, cls: 'c' },
        ]} />
      </>}
      {tab === 'Draft Order' && <div className="card"><div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 8 }}>{(live ? order : L.picks.filter(k => k.season === year)).slice(0, 64).map(k => <div key={k.id} className="li" style={{ borderBottom: 0, background: k.owner === L.user ? 'color-mix(in srgb, var(--team) 20%, transparent)' : 'rgba(255,255,255,.02)', borderRadius: 8, padding: 8 }}><span className="num mute" style={{ width: 28 }}>{k.no ?? '–'}</span><Logo team={L.teams[k.owner]} size={26} /><span style={{ flex: 1 }}>{L.teams[k.owner].nick}</span><span className="small mute">{k.orig !== k.owner ? `via ${k.orig}` : `R${k.round}`}</span></div>)}</div></div>}
      {tab === 'Results' && <Results />}
      {sel && <ProspectModal p={sel} close={() => setSel(null)} canDraft={!!onClock} onDraft={() => draft(sel)} />}
      {announce && <Announce {...announce} />}
    </div>
  );
}

/** The user's board: what your scouts believe, adjusted for need. */
function myBoard(L: ReturnType<typeof useApp>['league'] & object, pool: Player[]) {
  const needs = positionNeeds(L, L.user);
  return [...pool].sort((a, b) => score(b) - score(a));
  function score(p: Player) { const v = scoutedView(p); return (v.ovrLo + v.ovrHi) / 2 + (v.pot ? (v.pot - (v.ovrLo + v.ovrHi) / 2) * 0.4 : 4) + (needs[p.pos] ?? 0) * 1.2 - (p.proj ?? 200) * 0.01; }
}
const projection = (n: number) => (n <= 10 ? 'Top 10' : n <= 32 ? '1st Round' : n <= 64 ? '2nd Round' : n <= 100 ? '3rd Round' : n <= 160 ? 'Day 3' : n <= 230 ? 'Late Rounds' : 'Undrafted');
function ScoutPips({ lvl }: { lvl: number }) { return <span style={{ letterSpacing: 2 }}>{[1, 2, 3].map(i => <span key={i} style={{ color: i <= lvl ? 'var(--team2)' : 'var(--mute)' }}>●</span>)}</span>; }

function ProspectModal({ p, close, canDraft, onDraft }: { p: Player; close: () => void; canDraft: boolean; onDraft: () => void }) {
  const L = useApp().league!;
  const v = scoutedView(p);
  const next = (p.scout ?? 0) + 1;
  const cost = Math.round((SCOUT_COST[next] ?? 0) * (L.coachTree.unlocked.includes('Eye for Talent') ? 0.75 : 1));
  const top = (Object.entries(p.attrs) as [string, number][]).sort((a, b) => b[1] - a[1]).slice(0, (p.scout ?? 0) >= 2 ? 8 : 3);
  return (
    <Modal onClose={close} wide>
      <div className="grid" style={{ gridTemplateColumns: '240px 1fr', gap: 22 }}>
        <Tilt max={14}><div style={{ borderRadius: 18, overflow: 'hidden', background: 'linear-gradient(180deg,#1e2a48,#0b1120)', border: '1px solid var(--line2)', textAlign: 'center', padding: 16 }}>
          <Face p={p} size={190} style={{ margin: '0 auto' }} />
          <div className="h3" style={{ marginTop: 10 }}>{p.fn} {p.ln}</div><div className="small dim">{POS_NAME[p.pos]} · {p.col}</div>
          <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}><span className="chip">#{p.proj} overall</span><span className="chip">{projection(p.proj ?? 300)}</span></div>
        </div></Tilt>
        <div>
          <div className="row"><div className="stat"><span className="k">Scout Grade</span><span className="v">{v.ovrLo}–{v.ovrHi}</span></div><div className="stat"><span className="k">Potential</span><span className="v">{v.pot ?? '?'}</span></div><div className="stat"><span className="k">Dev</span><span className="v" style={{ fontSize: 16 }}>{v.dev ? <DevBadge d={v.dev} /> : '?'}</span></div><div className="spacer" /><ScoutPips lvl={p.scout ?? 0} /></div>
          <div className="up" style={{ margin: '14px 0 6px' }}>Combine</div>
          <div className="grid g3" style={{ gap: 8 }}>{p.combine && Object.entries({ '40': p.combine.forty.toFixed(2) + 's', Bench: p.combine.bench + ' reps', Vertical: p.combine.vert + '"', Broad: p.combine.broad + '"', '3-Cone': p.combine.cone + 's', Shuttle: p.combine.shuttle + 's' }).map(([k, val]) => <div key={k} className="card" style={{ padding: 8, boxShadow: 'none' }}><div className="up">{k}</div><b className="num" style={{ fontSize: 18 }}>{val}</b></div>)}</div>
          <div className="up" style={{ margin: '14px 0 6px' }}>{(p.scout ?? 0) >= 1 ? 'Scouting report' : 'Scout him to reveal ratings'}</div>
          {(p.scout ?? 0) >= 1 ? <div className="grid g4" style={{ gap: 8 }}>{top.map(([k, val]) => <div key={k} className="small"><b>{k}</b> {(p.scout ?? 0) >= 3 ? val : `${val - 4}-${Math.min(99, val + 4)}`}</div>)}</div> : <div className="small mute">Level 1 reveals his three best traits and archetype; level 2 all ratings within a range; level 3 exact ratings, development trait and ceiling.</div>}
          <div className="row" style={{ marginTop: 18 }}>
            {next <= 3 && <button className="btn" disabled={L.scoutPoints < cost} onClick={() => { scout(L, p); app.touch(); }}>Scout (level {next}) · {cost} pts</button>}
            <div className="spacer" />
            {canDraft && <button className="btn gold big" onClick={onDraft}>Draft {p.ln}</button>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** "With the Nth pick..." card that flies in after a selection. */
function Announce({ p, no, team }: { p: Player; no: number; team: string }) {
  const L = useApp().league!;
  const t = L.teams[team];
  return (
    <div className="modal-bg" style={{ background: 'rgba(3,5,10,.55)', pointerEvents: 'none' }}>
      <style>{`@keyframes slam { 0% { transform: scale(1.6) rotateX(40deg); opacity: 0 } 60% { transform: scale(.97) rotateX(0); opacity: 1 } 100% { transform: scale(1) } }`}</style>
      <div style={{ animation: 'slam .55s cubic-bezier(.2,.8,.2,1)', width: 'min(640px, 92vw)', borderRadius: 22, overflow: 'hidden', background: `linear-gradient(120deg, ${t.colors[0]}, #0b1120 75%)`, border: '2px solid rgba(255,255,255,.2)', boxShadow: '0 40px 100px rgba(0,0,0,.7)', perspective: 800 }}>
        <div className="row" style={{ padding: 22, gap: 20 }}>
          <Face p={p} size={150} team={t} />
          <div><div className="up" style={{ color: 'var(--gold)' }}>With pick #{no} in the {p.draft.year} NFL Draft</div><div className="row"><Logo team={t} size={40} /><span className="h3">The {t.nick} select</span></div>
            <div className="h1" style={{ margin: '6px 0' }}>{p.fn} {p.ln}</div><div className="dim">{POS_NAME[p.pos]} · {p.col}</div>
            <div className="row" style={{ marginTop: 10 }}><Ovr v={p.ovr} /><DevBadge d={p.dev} /><span className="small dim">{money(p.contract.years[0]?.base + (p.contract.years[0]?.bonus ?? 0))} cap hit</span></div></div>
        </div>
      </div>
    </div>
  );
}

function Ticker() {
  const L = useApp().league!;
  const done = Object.values(L.players).filter(p => p.draft.year === L.season && p.draft.pick > 0 && p.exp === 0).sort((a, b) => b.draft.pick - a.draft.pick).slice(0, 12);
  return (
    <div style={{ overflow: 'hidden', marginTop: 14, position: 'relative' }}>
      <div className="row" style={{ flexWrap: 'nowrap', gap: 10 }}>{done.map(p => (
        <div key={p.id} className="card fade-in" style={{ padding: '8px 12px', minWidth: 210, boxShadow: 'none', cursor: 'pointer' }} onClick={() => app.go({ id: 'player', pid: p.id })}>
          <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><span className="num mute">#{p.draft.pick}</span><Logo team={L.teams[p.draft.team]} size={24} /><div style={{ minWidth: 0 }}><b style={{ whiteSpace: 'nowrap' }}>{p.fn[0]}. {p.ln}</b><div className="small mute">{p.pos} · {p.col}</div></div></div>
        </div>
      ))}</div>
    </div>
  );
}
function Results() {
  const L = useApp().league!;
  const year = L.phase === 'draft' || L.phase === 'camp' || L.phase === 'preseason' || L.phase === 'regular' ? L.season : L.season;
  const picks = Object.values(L.players).filter(p => p.draft.year === year && p.draft.pick > 0).sort((a, b) => a.draft.pick - b.draft.pick);
  if (!picks.length) return <div className="card empty">No picks made yet.</div>;
  return <Table rows={picks} rowKey={p => p.id} onRow={p => app.go({ id: 'player', pid: p.id })} cols={[
    { k: 'no', h: 'Pick', get: p => p.draft.pick, sort: p => p.draft.pick, cls: 'c' },
    { k: 't', h: 'Team', get: p => <Logo team={L.teams[p.draft.team]} size={24} /> },
    { k: 'p', h: 'Player', get: p => <div className="pcell"><Face p={p} size={32} /><b>{p.fn} {p.ln}</b></div> },
    { k: 'pos', h: 'Pos', get: p => p.pos, cls: 'c' }, { k: 'col', h: 'College', get: p => p.col },
    { k: 'ovr', h: 'OVR', get: p => <Ovr v={p.ovr} />, sort: p => p.ovr, cls: 'c' }, { k: 'dev', h: 'Dev', get: p => <DevBadge d={p.dev} /> },
  ]} />;
}
