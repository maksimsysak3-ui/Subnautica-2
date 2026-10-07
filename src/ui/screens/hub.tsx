import { useApp, app } from '../store';
import { Logo, Face, CountUp, Bar, Tilt } from '../components';
import { AdvanceButton } from '../App';
import { divisionOrder, standings, userGame, weekGames } from '../../core/season';
import { teamRatings, rosterOf } from '../../core/league';
import { capSpace, money, yearsLeft } from '../../core/contracts';
import type { League, Player } from '../../core/types';

export function Hub() {
  const L = useApp().league!;
  const me = L.teams[L.user];
  const st = standings(L);
  const r = teamRatings(L, L.user);
  const ug = userGame(L);
  const opp = ug ? L.teams[ug.home === L.user ? ug.away : ug.home] : undefined;
  const div = divisionOrder(L, me.conf, me.div, st);
  const roster = rosterOf(L, L.user);
  const injured = Object.values(L.players).filter(p => p.team === L.user && p.injury).sort((a, b) => b.ovr - a.ovr);
  const leaders = teamLeaders(L);
  return (
    <div className="grid g3">
      <Tilt className="span2" max={4}>
        <div className="card hero" style={{ minHeight: 230 }}>
          {ug && opp ? (
            <div style={{ position: 'relative' }}>
              <div className="up" style={{ color: 'var(--team2)' }}>{L.phase === 'playoffs' ? 'Playoffs' : `Week ${L.week}`} · {ug.day ?? 'Sun'} {ug.time ?? '1:00'}{ug.neutral ? ` · ${ug.neutral}` : ug.home === L.user ? ` · ${me.stadium}` : ` · ${opp.stadium}`}</div>
              <div className="row" style={{ justifyContent: 'center', gap: 40, margin: '18px 0' }}>
                <TeamBlock L={L} abbr={ug.away} />
                <div style={{ textAlign: 'center' }}>{ug.result ? <div className="h1"><CountUp v={ug.result.as} /> – <CountUp v={ug.result.hs} /></div> : <div className="h1" style={{ opacity: .85 }}>VS</div>}<div className="small dim">{ug.result ? 'Final' : 'Kickoff'}</div></div>
                <TeamBlock L={L} abbr={ug.home} />
              </div>
              <div className="row" style={{ justifyContent: 'center' }}><AdvanceButton big /></div>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <div className="up" style={{ color: 'var(--team2)' }}>{L.phase === 'preseason' ? 'Preseason' : 'Offseason'}</div>
              <div className="h1" style={{ margin: '14px 0 6px' }}>{phaseHeadline(L)}</div>
              <div className="dim" style={{ marginBottom: 18, maxWidth: 560 }}>{phaseBlurb(L)}</div>
              <AdvanceButton big />
            </div>
          )}
        </div>
      </Tilt>
      <div className="card">
        <h3>Team Ratings</h3>
        <div className="row" style={{ justifyContent: 'space-around' }}>
          {[['OVR', r.ovr], ['OFF', Math.round(r.off)], ['DEF', Math.round(r.def)]].map(([k, v]) => <Ring key={k} label={k as string} v={v as number} />)}
        </div>
        <div className="divider" />
        {([['QB', r.qb], ['Skill', r.skill], ['O-Line', r.ol], ['D-Line', r.dl], ['Linebackers', r.lb], ['Secondary', r.db]] as const).map(([k, v]) => (
          <div key={k} className="row" style={{ gap: 10, margin: '6px 0' }}><span className="small" style={{ width: 86 }}>{k}</span><div style={{ flex: 1 }}><Bar v={v - 40} max={59} /></div><span className="num" style={{ width: 26, textAlign: 'right' }}>{Math.round(v)}</span></div>
        ))}
      </div>

      <div className="card">
        <h3>To Do</h3>
        <TodoList L={L} roster={roster} />
      </div>
      <div className="card">
        <h3>{me.conf} {me.div} <span className="more" onClick={() => app.go({ id: 'standings' })}>Standings ›</span></h3>
        {div.map((a, i) => (
          <div key={a} className="li" onClick={() => app.go({ id: 'team', team: a })} style={a === L.user ? { background: 'rgba(255,255,255,.05)', borderRadius: 8 } : undefined}>
            <span className="num mute" style={{ width: 14 }}>{i + 1}</span><Logo team={L.teams[a]} size={28} /><b style={{ flex: 1 }}>{L.teams[a].nick}</b>
            <span className="num">{st[a].w}-{st[a].l}{st[a].t ? `-${st[a].t}` : ''}</span><span className="small mute" style={{ width: 34, textAlign: 'right' }}>{st[a].streak}</span>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Front Office</h3>
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Owner Job Security</span><b className={L.security < 30 ? 'bad' : L.security > 70 ? 'good' : ''}>{Math.round(L.security)}</b></div>
        <Bar v={L.security} color={L.security < 30 ? '#ef4444' : undefined} />
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}><span className="small">Coach Level {L.coachTree.level}</span><span className="small dim">{L.coachTree.points} point{L.coachTree.points === 1 ? '' : 's'} to spend</span></div>
        <Bar v={L.coachTree.xp} max={L.coachTree.level * 450} />
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}><span className="small">Cap Space</span><b>{money(capSpace(L, L.user))}</b></div>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}><span className="small">Scouting Points</span><b>{L.scoutPoints}</b></div>
        <div className="row" style={{ marginTop: 14 }}><button className="btn sm" onClick={() => app.go({ id: 'coach' })}>Coach Abilities</button><button className="btn sm" onClick={() => app.go({ id: 'cap' })}>Cap Sheet</button></div>
      </div>

      <div className="card span2">
        <h3>League News <span className="more" onClick={() => app.go({ id: 'news' })}>All news ›</span></h3>
        <div className="list">
          {L.news.slice(0, 7).map(n => (
            <div key={n.id} className="li" onClick={() => n.pid && app.go({ id: 'player', pid: n.pid })}>
              {n.pid && L.players[n.pid] ? <Face p={L.players[n.pid]} size={38} /> : n.teams[0] && L.teams[n.teams[0]] ? <Logo team={L.teams[n.teams[0]]} size={34} /> : <span style={{ width: 34 }} />}
              <div style={{ flex: 1 }}><div style={{ fontWeight: n.big ? 700 : 500 }}>{n.text}</div><div className="small mute">{n.kind.toUpperCase()} · {n.season} wk {n.week}</div></div>
            </div>
          ))}
          {!L.news.length && <div className="empty">The season has not started yet.</div>}
        </div>
      </div>
      <div className="card">
        <h3>Team Leaders</h3>
        {leaders.map(([label, p, v]) => p && (
          <div key={label} className="li" onClick={() => app.go({ id: 'player', pid: p.id })}>
            <Face p={p} size={38} /><div style={{ flex: 1 }}><div className="up">{label}</div><b>{p.fn} {p.ln}</b></div><span className="num" style={{ fontSize: 20 }}>{v}</span>
          </div>
        ))}
        {!!injured.length && <><div className="divider" /><h3>Injuries</h3>{injured.slice(0, 5).map(p => <div key={p.id} className="li" onClick={() => app.go({ id: 'player', pid: p.id })}><Face p={p} size={30} /><span style={{ flex: 1 }}>{p.pos} {p.ln}</span><span className="small bad">{p.injury!.type} · {p.injury!.season ? 'season' : `${p.injury!.weeks}w`}</span></div>)}</>}
      </div>
      <WeekScores L={L} />
    </div>
  );
}

function TeamBlock({ L, abbr }: { L: League; abbr: string }) {
  const t = L.teams[abbr], st = standings(L)[abbr], r = teamRatings(L, abbr);
  return (
    <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => app.go({ id: 'team', team: abbr })}>
      <Logo team={t} size={110} style={{ filter: 'drop-shadow(0 14px 24px rgba(0,0,0,.6))' }} />
      <div className="h3" style={{ marginTop: 6 }}>{t.nick}</div>
      <div className="small dim">{st.w}-{st.l}{st.t ? `-${st.t}` : ''} · OVR {r.ovr}</div>
    </div>
  );
}
function Ring({ v, label }: { v: number; label: string }) {
  const k = Math.max(0, Math.min(1, (v - 50) / 49));
  return (
    <div style={{ position: 'relative', width: 84, height: 84 }}>
      <svg viewBox="0 0 100 100" width="84" height="84"><circle cx="50" cy="50" r="42" stroke="#1a2338" strokeWidth="9" fill="none" /><circle cx="50" cy="50" r="42" stroke="var(--team)" strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={`${k * 264} 264`} transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray 1s' }} /></svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}><div><div className="num" style={{ fontSize: 26, lineHeight: 1 }}><CountUp v={v} /></div><div className="up" style={{ fontSize: 9 }}>{label}</div></div></div>
    </div>
  );
}
function TodoList({ L, roster }: { L: League; roster: Player[] }) {
  const items: [string, () => void, boolean?][] = [];
  const unread = L.inbox.filter(m => !m.read).length;
  if (unread) items.push([`${unread} unread message${unread > 1 ? 's' : ''}`, () => app.go({ id: 'inbox' })]);
  if (roster.length > 53) items.push([`Cut ${roster.length - 53} player(s) to reach 53`, () => app.go({ id: 'roster' }), true]);
  if (capSpace(L, L.user) < 0) items.push(['You are over the salary cap', () => app.go({ id: 'cap' }), true]);
  if (L.coachTree.points > 0) items.push([`Spend ${L.coachTree.points} coach ability point(s)`, () => app.go({ id: 'coach' })]);
  if (L.phase === 'resign') items.push([`Re-sign: ${Object.values(L.players).filter(p => p.team === L.user && yearsLeft(p.contract, L.season) === 0).length} expiring contracts`, () => app.go({ id: 'resign' }), true]);
  if (L.phase === 'freeagency') items.push(['Free agency is open', () => app.go({ id: 'fa' })]);
  if (L.phase === 'draft') items.push(['The draft is on the clock', () => app.go({ id: 'draft' }), true]);
  if (L.phase === 'regular' || L.phase === 'preseason') items.push(['Set this week\'s game plan', () => app.go({ id: 'plan' })]);
  if (['regular', 'preseason'].includes(L.phase) && L.scoutPoints >= 25) items.push([`Scout the ${L.season + 1} class (${L.scoutPoints} pts)`, () => app.go({ id: 'draft' })]);
  if (Object.values(L.players).some(p => p.team === L.user && p.injury && p.status === 'ACT' && p.injury.weeks >= 4)) items.push(['Move long-term injuries to IR', () => app.go({ id: 'roster' })]);
  return <div className="list">{items.map(([t, f, hot]) => <div key={t} className="li" onClick={f}><span style={{ color: hot ? 'var(--bad)' : 'var(--team2)' }}>●</span><span style={{ flex: 1 }}>{t}</span><span className="mute">›</span></div>)}{!items.length && <div className="empty">All caught up.</div>}</div>;
}
function teamLeaders(L: League): [string, Player | undefined, string][] {
  const mine = Object.values(L.players).filter(p => p.team === L.user);
  const s = (p: Player) => p.stats[L.season];
  const top = (f: (p: Player) => number) => mine.filter(p => s(p)).sort((a, b) => f(b) - f(a))[0];
  const pass = top(p => s(p)!.py), rush = top(p => s(p)!.ry), rec = top(p => s(p)!.recy), sack = top(p => s(p)!.dsk), tkl = top(p => s(p)!.tkl);
  if (!pass) return mine.sort((a, b) => b.ovr - a.ovr).slice(0, 4).map((p, i) => [['Franchise Player', 'Star', 'Star', 'Star'][i], p, String(p.ovr)]);
  return [['Passing Yds', pass, String(s(pass)?.py ?? 0)], ['Rushing Yds', rush, String(s(rush)?.ry ?? 0)], ['Receiving Yds', rec, String(s(rec)?.recy ?? 0)], ['Sacks', sack, String(s(sack)?.dsk ?? 0)], ['Tackles', tkl, String(s(tkl)?.tkl ?? 0)]];
}
function WeekScores({ L }: { L: League }) {
  const games = weekGames(L, L.phase === 'regular' || L.phase === 'playoffs' ? L.week : 0);
  const prev = L.phase === 'regular' && L.week > 1 ? weekGames(L, L.week - 1) : [];
  const show = games.some(g => g.result) ? games : prev;
  if (!show.length) return null;
  return (
    <div className="card span2" style={{ gridColumn: '1 / -1' }}>
      <h3>Around the League · {show[0].week > 18 ? 'Playoffs' : `Week ${show[0].week}`} <span className="more" onClick={() => app.go({ id: 'schedule' })}>Schedule ›</span></h3>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px,1fr))', gap: 10 }}>
        {show.map(g => (
          <div key={g.id} className="card" style={{ padding: 10, cursor: g.result ? 'pointer' : 'default', boxShadow: 'none' }} onClick={() => g.result && app.go({ id: 'box', gid: g.id })}>
            {[g.away, g.home].map((a, i) => { const sc = g.result ? (i ? g.result.hs : g.result.as) : undefined; const win = g.result && sc! > (i ? g.result.as : g.result.hs); return <div key={a} className="row" style={{ gap: 8, opacity: g.result && !win ? 0.6 : 1 }}><Logo team={L.teams[a]} size={22} /><span style={{ flex: 1, fontWeight: win ? 800 : 500 }}>{L.teams[a].nick}</span><span className="num">{sc ?? ''}</span></div>; })}
            <div className="small mute">{g.result ? `Final${g.result.ot ? '/OT' : ''}` : `${g.day ?? ''} ${g.time ?? ''}`}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function phaseHeadline(L: League) {
  return { preseason: 'The season awaits', resign: 'Decision time', freeagency: 'Free agency is open', draft: 'Draft day', camp: 'Training camp', regular: '', playoffs: '' }[L.phase];
}
function phaseBlurb(L: League) {
  return {
    preseason: 'Set your depth chart and game plan, trim the roster to 53, and kick off the season.',
    resign: 'Contracts are expiring. Re-sign the core, tag a star, or let them walk into free agency.',
    freeagency: 'Make offers. Players weigh money, guarantees, your contender status, scheme fit and their motivations.',
    draft: 'Your scouts have done their work. Trade up, trade down, or take the best player on your board.',
    camp: 'Rookies report and position battles settle. Final cuts to 53 come next.', regular: '', playoffs: '',
  }[L.phase];
}
