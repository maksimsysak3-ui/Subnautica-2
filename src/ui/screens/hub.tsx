// Weekly Hub, laid out the way Madden 27 does it: Game Day up top, Action Cards
// beside it (only things that actually need a decision), then the team snapshot,
// the division, your top players, the news and the leaders.
import type { CSSProperties, ReactNode } from 'react';
import { useApp, app } from '../store';
import { Logo, Bar, Portrait, CountUp } from '../components';
import { AdvanceButton } from '../App';
import { divisionOrder, standings, userGame, weekGames } from '../../core/season';
import { teamRatings, rosterOf } from '../../core/league';
import { money } from '../../core/contracts';
import type { League, Player } from '../../core/types';
import { WeeklyCards } from './weekly';
import { ownerGoals, goalProgress } from '../../core/goals';

export function Hub() {
  const L = useApp().league!;
  const me = L.teams[L.user];
  const st = standings(L);
  const r = teamRatings(L, L.user);
  const div = divisionOrder(L, me.conf, me.div, st);
  const roster = rosterOf(L, L.user);
  const top = roster.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 6);
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 16 }}>
      <div style={{ gridColumn: 'span 12', minWidth: 0 }}><WeeklyCards /></div>
      <OwnerGoalsStrip />

      <div className="card" style={{ gridColumn: 'span 4' }}>
        <div className="snap">{([['Overall', r.ovr], ['Offense', r.off], ['Defense', r.def]] as const).map(([k, v]) => <div key={k}><b><CountUp v={v} /></b><span>{k}</span></div>)}</div>
        {([['Quarterback', r.qb], ['Skill', r.skill], ['O-Line', r.ol], ['D-Line', r.dl], ['Linebackers', r.lb], ['Secondary', r.db]] as const).map(([k, v]) => (
          <div key={k} className="unit"><span>{k}</span><Bar v={v - 50} max={49} /><b>{Math.round(v)}</b></div>
        ))}
      </div>
      <div className="card" style={{ gridColumn: 'span 4' }}>
        <h3>{me.conf} {me.div}<span className="more" onClick={() => app.go({ id: 'standings' })}>Standings</span></h3>
        {div.map((a, i) => (
          <div key={a} className="li" onClick={() => app.go({ id: 'team', team: a })} style={a === L.user ? { background: 'rgba(255,255,255,.05)' } : undefined}>
            <span className="num mute" style={{ width: 14 }}>{i + 1}</span><Logo team={L.teams[a]} size={30} />
            <b className="h3" style={{ flex: 1, fontSize: 18 }}>{L.teams[a].nick}</b>
            <span className="num" style={{ fontSize: 18 }}>{st[a].w}-{st[a].l}{st[a].t ? `-${st[a].t}` : ''}</span><span className="small mute" style={{ width: 30, textAlign: 'right' }}>{st[a].streak}</span>
          </div>
        ))}
      </div>
      <div className="card" style={{ gridColumn: 'span 4' }}>
        <h3>Top Players<span className="more" onClick={() => app.go({ id: 'roster' })}>Roster</span></h3>
        {top.slice(0, 5).map(p => <PRow key={p.id} p={p} sub={`${p.pos} · ${p.arch}`} />)}
      </div>

      <div className="card" style={{ gridColumn: 'span 8' }}>
        <h3>News Center<span className="more" onClick={() => app.go({ id: 'news' })}>All News</span></h3>
        <News L={L} />
      </div>
      <div className="card" style={{ gridColumn: 'span 4' }}><Leaders L={L} /></div>
      <WeekScores L={L} />
    </div>
  );
}

export function PRow({ p, sub, right }: { p: Player; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="prow" onClick={() => app.go({ id: 'player', pid: p.id })}>
      <Portrait p={p} size={48} ovr={false} />
      <div style={{ flex: 1, minWidth: 0 }}><div className="pn">{p.fn[0]}. {p.ln}</div><div className="ps">{sub ?? `${p.pos} · #${p.num}`}</div></div>
      {right ?? <span className={`ovr ${p.ovr >= 95 ? 't99' : p.ovr >= 90 ? 't90' : p.ovr >= 80 ? 't80' : p.ovr >= 70 ? 't70' : p.ovr >= 60 ? 't60' : 't0'}`}>{p.ovr}</span>}
    </div>
  );
}

export function GameDay({ L }: { L: League }) {
  const ug = userGame(L);
  const me = L.teams[L.user];
  if (!ug) return (
    <div className="gd" style={{ gridTemplateColumns: '1fr' }}>
      <div className="gd-side" style={{ '--c': me.colors[0], placeItems: 'start', alignContent: 'center', padding: '30px 36px 90px' } as CSSProperties}>
        <Logo team={me} size={300} style={{ position: 'absolute', right: -30, top: -20, opacity: 0.16 }} />
        <div className="up" style={{ color: 'rgba(255,255,255,.75)' }}>{L.phase === 'preseason' ? `${L.season} Preseason` : `${L.season} Offseason`}</div>
        <div className="h1" style={{ marginTop: 8 }}>{headline(L)}</div>
        <div style={{ maxWidth: 520, marginTop: 10, color: 'rgba(255,255,255,.75)' }}>{blurb(L)}</div>
      </div>
      <div className="gd-bar"><span className="k">Next</span><b>{headline(L)}</b><div className="spacer" /><AdvanceButton /></div>
    </div>
  );
  const away = L.teams[ug.away], home = L.teams[ug.home];
  const st = standings(L);
  const ra = teamRatings(L, away.abbr), rh = teamRatings(L, home.abbr);
  const side = (t: typeof away, rt: typeof ra) => (
    <div className="gd-side" style={{ '--c': t.colors[0] } as CSSProperties}>
      <div style={{ display: 'grid', justifyItems: 'center' }}>
        <Logo team={t} size={150} />
        <div className="gd-name">{t.nick}</div>
        <div className="gd-rec">{st[t.abbr].w}-{st[t.abbr].l}{st[t.abbr].t ? `-${st[t.abbr].t}` : ''} · OVR {rt.ovr}</div>
      </div>
    </div>
  );
  return (
    <div className="gd">
      {side(away, ra)}
      <div className="gd-mid">
        <div className="gd-when">{L.phase === 'playoffs' ? 'Playoffs' : `Week ${L.week}`}</div>
        <div className="gd-vs">{ug.result ? `${ug.result.as}–${ug.result.hs}` : '@'}</div>
        <div className="gd-when">{ug.day} {ug.time}<br />{ug.neutral ?? home.stadium}</div>
      </div>
      {side(home, rh)}
      <div className="gd-bar">
        <span className="k">Game Day</span><b>{away.abbr} @ {home.abbr}</b>
        <div className="spacer" />
        {!ug.result && <button className="btn" onClick={() => app.go({ id: 'preview', gid: ug.id })}>Matchup Preview</button>}
        <AdvanceButton />
      </div>
    </div>
  );
}

function News({ L }: { L: League }) {
  const items = L.news.filter(n => n.kind !== 'game').slice(0, 6);
  if (!items.length) return <div className="empty">The season has not started yet.</div>;
  return <div>{items.map(n => { const p = n.pid ? L.players[n.pid] : undefined; const t = n.teams[0] ? L.teams[n.teams[0]] : undefined; return (
    <div key={n.id} className="newsrow" onClick={() => p ? app.go({ id: 'player', pid: p.id }) : t ? app.go({ id: 'team', team: t.abbr }) : undefined}>
      {p ? <Portrait p={p} size={64} ovr={false} /> : t ? <div style={{ width: 64, height: 64, display: 'grid', placeItems: 'center', background: 'var(--s2)' }}><Logo team={t} size={44} /></div> : <div />}
      <div><div className="nk">{n.kind}</div><div className="nt">{n.text}</div></div>
    </div>
  ); })}</div>;
}

function Leaders({ L }: { L: League }) {
  const mine = Object.values(L.players).filter(p => p.team === L.user);
  const s = (p: Player) => p.stats[L.season];
  const has = mine.some(p => s(p)?.gp);
  const top = (f: (p: Player) => number) => mine.filter(p => s(p)).sort((a, b) => f(b) - f(a))[0];
  const cats: [string, Player | undefined, number][] = has ? [
    ['Passing Yds', top(p => s(p)!.py), 0], ['Rushing Yds', top(p => s(p)!.ry), 0], ['Receiving Yds', top(p => s(p)!.recy), 0], ['Sacks', top(p => s(p)!.dsk), 0], ['Tackles', top(p => s(p)!.tkl), 0],
  ].map(([k, p]) => [k as string, p as Player | undefined, p ? (k === 'Passing Yds' ? s(p as Player)!.py : k === 'Rushing Yds' ? s(p as Player)!.ry : k === 'Receiving Yds' ? s(p as Player)!.recy : k === 'Sacks' ? s(p as Player)!.dsk : s(p as Player)!.tkl) : 0]) : [];
  return (
    <>
      <h3>{has ? 'Team Leaders' : 'Coaching Staff'}<span className="more" onClick={() => app.go({ id: 'teamstats' })}>Team Stats</span></h3>
      {has ? cats.map(([k, p, v]) => p && <PRow key={k} p={p} sub={k} right={<b className="num" style={{ fontSize: 20 }}>{v.toLocaleString()}</b>} />)
        : <div className="list">
            {[['Head Coach', L.teams[L.user].coach.name], ['Offense', L.teams[L.user].coach.off], ['Defense', L.teams[L.user].coach.def], ['Coach Level', `Level ${L.coachTree.level}`], ['Job Security', `${Math.round(L.security)} / 100`]].map(([k, v]) => <div key={k} className="li" style={{ cursor: 'default', justifyContent: 'space-between' }}><span className="up">{k}</span><b>{v}</b></div>)}
          </div>}
    </>
  );
}

function WeekScores({ L }: { L: League }) {
  const games = weekGames(L, L.phase === 'regular' || L.phase === 'playoffs' ? L.week : 0);
  const prev = L.phase === 'regular' && L.week > 1 ? weekGames(L, L.week - 1) : [];
  const show = games.some(g => g.result) ? games : prev;
  if (!show.length) return null;
  return (
    <div style={{ gridColumn: 'span 12' }}>
      <div className="sec-h"><h2>Around the League · {show[0].week > 18 ? 'Playoffs' : `Week ${show[0].week}`}</h2><div className="line" /><span className="more-link" onClick={() => app.go({ id: 'schedule' })}>Schedule</span></div>
      <div className="gcards">
        {show.map(g => (
          <div key={g.id} className="gcard" style={{ '--ca': L.teams[g.away].colors[0], '--ch': L.teams[g.home].colors[0] } as CSSProperties} onClick={() => g.result && app.go({ id: 'box', gid: g.id })}>
            {[g.away, g.home].map((a, i) => { const sc = g.result ? (i ? g.result.hs : g.result.as) : undefined; const lose = g.result && sc! < (i ? g.result.as : g.result.hs); return <div key={a} className={`gc-team${lose ? ' lose' : ''}`}><Logo team={L.teams[a]} size={28} /><span>{L.teams[a].nick}</span><b>{sc ?? ''}</b></div>; })}
            <div className="gc-foot">{g.result ? `Final${g.result.ot ? '/OT' : ''}` : `${g.day ?? ''} ${g.time ?? ''}`}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
const headline = (L: League) => ({ preseason: 'The season awaits', resign: 'Decision time', freeagency: 'Free agency', draft: 'Draft day', camp: 'Training camp', regular: '', playoffs: '' }[L.phase]);
const blurb = (L: League) => ({
  preseason: 'Set the depth chart and game plan, trim to 53 and kick off.',
  resign: 'Contracts are expiring. Re-sign the core, tag a star, or let them walk.',
  freeagency: 'Make offers. Players weigh money, guarantees, contender status, scheme and role.',
  draft: 'Your scouts have their board. Trade up, trade down or take the best player available.',
  camp: 'Rookies report and position battles settle. Final cuts come next.', regular: '', playoffs: '',
}[L.phase]);
export { money };

/** The owner's four season goals with live progress. */
function OwnerGoalsStrip() {
  const L = useApp().league!;
  const s = ownerGoals(L);
  if (!s || (L.phase !== 'regular' && L.phase !== 'preseason')) return null;
  return (
    <div className="og" style={{ gridColumn: 'span 12' }}>
      <div className="og-h"><span className="up">Owner's goals</span><b>{L.season}</b><em>Job security {Math.round(L.security)}</em></div>
      {s.list.map(g => { const p = goalProgress(L, g); return (
        <div key={g.id} className={`og-g${p.met ? ' met' : ''}`}>
          <i>{p.met ? '✓' : ''}</i><div><b>{g.label}</b><span>{p.text}</span></div><em>+{g.reward}</em>
        </div>
      ); })}
    </div>
  );
}
