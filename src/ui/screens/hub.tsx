import { useApp, app } from '../store';
import { Logo, Face, CountUp, Bar, Ovr } from '../components';
import { AdvanceButton } from '../App';
import { divisionOrder, standings, userGame, weekGames } from '../../core/season';
import { teamRatings, rosterOf } from '../../core/league';
import { capSpace, money, yearsLeft } from '../../core/contracts';
import type { League, Player } from '../../core/types';

/** Franchise home: big image tiles, the way a console franchise hub reads. */
export function Hub() {
  const L = useApp().league!;
  const me = L.teams[L.user];
  const st = standings(L);
  const r = teamRatings(L, L.user);
  const div = divisionOrder(L, me.conf, me.div, st);
  const roster = rosterOf(L, L.user);
  const star = roster.slice().sort((a, b) => b.ovr - a.ovr)[0];
  const qb = L.players[me.depth.QB?.[0] ?? ''] ?? star;
  const news = L.news.filter(n => n.pid && L.players[n.pid]).slice(0, 3);
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(12, minmax(0,1fr))' }}>
      <div style={{ gridColumn: 'span 8' }}><MatchupTile L={L} /></div>
      <div style={{ gridColumn: 'span 4' }}>{qb && <PlayerTile p={qb} kicker="Franchise Quarterback" />}</div>

      <div className="card" style={{ gridColumn: 'span 4' }}>
        <h3>{me.conf} {me.div}<span className="more" onClick={() => app.go({ id: 'standings' })}>Standings</span></h3>
        {div.map((a, i) => (
          <div key={a} className="li" onClick={() => app.go({ id: 'team', team: a })} style={a === L.user ? { borderLeftColor: 'var(--team2)', background: 'rgba(255,255,255,.04)' } : undefined}>
            <span className="num mute" style={{ width: 14 }}>{i + 1}</span><Logo team={L.teams[a]} size={30} /><b className="h3" style={{ flex: 1, fontSize: 17 }}>{L.teams[a].nick}</b>
            <span className="num" style={{ fontSize: 18 }}>{st[a].w}-{st[a].l}{st[a].t ? `-${st[a].t}` : ''}</span><span className="small mute" style={{ width: 30, textAlign: 'right' }}>{st[a].streak}</span>
          </div>
        ))}
      </div>
      <div className="card" style={{ gridColumn: 'span 4' }}>
        <h3>Team Ratings<span className="more" onClick={() => app.go({ id: 'teamstats' })}>Team Stats</span></h3>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          {[['OVR', r.ovr], ['OFF', r.off], ['DEF', r.def]].map(([k, v]) => <div key={k as string} className="stat" style={{ alignItems: 'center' }}><span className="k">{k}</span><span className="v" style={{ fontSize: 42 }}><CountUp v={v as number} /></span></div>)}
        </div>
        {([['Quarterback', r.qb], ['Skill', r.skill], ['O-Line', r.ol], ['D-Line', r.dl], ['Linebackers', r.lb], ['Secondary', r.db]] as const).map(([k, v]) => (
          <div key={k} className="row" style={{ gap: 10, margin: '5px 0' }}><span className="small up" style={{ width: 92, fontSize: 10 }}>{k}</span><div style={{ flex: 1 }}><Bar v={v - 50} max={49} /></div><span className="num" style={{ width: 26, textAlign: 'right' }}>{Math.round(v)}</span></div>
        ))}
      </div>
      <div className="card" style={{ gridColumn: 'span 4' }}>
        <h3>To Do</h3>
        <TodoList L={L} roster={roster} />
        <div className="divider" />
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="up">Owner job security</span><b className={L.security < 30 ? 'bad' : L.security > 70 ? 'good' : ''}>{Math.round(L.security)}</b></div>
        <Bar v={L.security} />
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}><span className="up">Coach level {L.coachTree.level}</span><span className="small dim">{L.coachTree.points} pt to spend</span></div>
        <Bar v={L.coachTree.xp} max={L.coachTree.level * 450} />
      </div>

      {news.map(n => { const p = L.players[n.pid!]; const t = L.teams[p.team]; return (
        <div key={n.id} className="tile" style={{ gridColumn: 'span 4', minHeight: 210 }} onClick={() => app.go({ id: 'player', pid: p.id })}>
          <div className="art" style={{ background: `linear-gradient(135deg, ${t?.colors[0] ?? '#223'}, #0b0d11 80%)` }}>
            {t && <Logo team={t} size={180} style={{ position: 'absolute', right: -30, top: -20, opacity: 0.18 }} />}
            <Face p={p} size={200} style={{ position: 'absolute', right: 6, bottom: 0, borderRadius: 0, background: 'transparent' }} />
          </div>
          <div className="shade" />
          <div className="lbl" style={{ right: 150 }}><div className="k">{n.kind}</div><div style={{ font: '700 15px/1.25 var(--body)' }}>{n.text}</div></div>
        </div>
      ); })}
      {news.length < 3 && <div className="card" style={{ gridColumn: `span ${12 - news.length * 4}` }}><h3>League News<span className="more" onClick={() => app.go({ id: 'news' })}>All News</span></h3>{L.news.slice(0, 5).map(n => <div key={n.id} className="li" style={{ cursor: 'default' }}>{n.teams[0] && L.teams[n.teams[0]] && <Logo team={L.teams[n.teams[0]]} size={26} />}<span>{n.text}</span></div>)}{!L.news.length && <div className="empty">The season has not started yet.</div>}</div>}

      <div className="card" style={{ gridColumn: 'span 12' }}><Leaders L={L} /></div>
      <WeekScores L={L} />
    </div>
  );
}

function MatchupTile({ L }: { L: League }) {
  const ug = userGame(L);
  const me = L.teams[L.user];
  if (!ug) return (
    <div className="tile" style={{ minHeight: 330, cursor: 'default' }}>
      <div className="art" style={{ background: `linear-gradient(110deg, ${me.colors[0]}, #0b0d11 70%)` }}><Logo team={me} size={340} style={{ position: 'absolute', right: -40, top: -30, opacity: 0.22 }} /></div>
      <div className="shade" />
      <div className="lbl"><div className="k">{L.phase === 'preseason' ? 'Preseason' : 'Offseason'}</div><div className="t" style={{ fontSize: 46 }}>{headline(L)}</div><div className="s" style={{ maxWidth: 560, margin: '6px 0 14px' }}>{blurb(L)}</div><AdvanceButton big /></div>
    </div>
  );
  const away = L.teams[ug.away], home = L.teams[ug.home];
  const st = standings(L);
  return (
    <div className="tile" style={{ minHeight: 330, cursor: 'default' }}>
      <div className="art" style={{ background: `linear-gradient(115deg, ${away.colors[0]} 0 49.6%, #0b0d11 49.6% 50.4%, ${home.colors[0]} 50.4%)` }}>
        <Logo team={away} size={250} style={{ position: 'absolute', left: '6%', top: 22 }} />
        <Logo team={home} size={250} style={{ position: 'absolute', right: '6%', top: 22 }} />
        <div style={{ position: 'absolute', left: '50%', top: 92, transform: 'translateX(-50%)', font: '900 italic 64px var(--head)', textShadow: '0 6px 20px rgba(0,0,0,.6)' }}>{ug.result ? `${ug.result.as}-${ug.result.hs}` : 'VS'}</div>
      </div>
      <div className="shade" />
      <div className="lbl row" style={{ alignItems: 'flex-end' }}>
        <div><div className="k">{L.phase === 'playoffs' ? 'Playoffs' : `Week ${L.week}`} · {ug.day} {ug.time} · {ug.neutral ?? home.stadium}</div>
          <div className="t" style={{ fontSize: 40 }}>{away.nick} <span className="dim">{st[away.abbr].w}-{st[away.abbr].l}</span> at {home.nick} <span className="dim">{st[home.abbr].w}-{st[home.abbr].l}</span></div>
          <div className="s">OVR {teamRatings(L, away.abbr).ovr} vs {teamRatings(L, home.abbr).ovr}</div></div>
        <div className="spacer" /><AdvanceButton big />
      </div>
    </div>
  );
}
function PlayerTile({ p, kicker }: { p: Player; kicker: string }) {
  const L = useApp().league!;
  const t = L.teams[p.team];
  const line = p.stats[L.season];
  return (
    <div className="tile" style={{ minHeight: 330 }} onClick={() => app.go({ id: 'player', pid: p.id })}>
      <div className="art" style={{ background: `linear-gradient(160deg, ${t.colors[0]}, #0b0d11 85%)` }}>
        <div style={{ position: 'absolute', right: 10, top: -10, font: '900 italic 200px/1 var(--head)', color: 'rgba(255,255,255,.08)' }}>{p.num}</div>
        <Face p={p} size={280} style={{ position: 'absolute', left: '50%', bottom: 30, transform: 'translateX(-50%)', borderRadius: 0, background: 'transparent' }} />
      </div>
      <div className="shade" />
      <div className="lbl row" style={{ alignItems: 'flex-end' }}>
        <div><div className="k">{kicker}</div><div className="t">{p.fn} {p.ln}</div><div className="s">{p.arch}{line ? ` · ${line.py ? `${line.py} yds, ${line.ptd} TD` : `${line.ry + line.recy} scrimmage yds`}` : ''}</div></div>
        <div className="spacer" /><Ovr v={p.ovr} lg />
      </div>
    </div>
  );
}
function Leaders({ L }: { L: League }) {
  const mine = Object.values(L.players).filter(p => p.team === L.user);
  const s = (p: Player) => p.stats[L.season];
  const top = (f: (p: Player) => number) => mine.filter(p => s(p)).sort((a, b) => f(b) - f(a))[0];
  const cats: [string, Player | undefined, string][] = mine.some(p => s(p)) ? [
    ['Passing', top(p => s(p)!.py), 'py'], ['Rushing', top(p => s(p)!.ry), 'ry'], ['Receiving', top(p => s(p)!.recy), 'recy'], ['Sacks', top(p => s(p)!.dsk), 'dsk'], ['Tackles', top(p => s(p)!.tkl), 'tkl'], ['Interceptions', top(p => s(p)!.dint), 'dint'],
  ] : mine.sort((a, b) => b.ovr - a.ovr).slice(0, 6).map(p => [p.pos, p, 'ovr']);
  return (
    <div>
      <div className="h3" style={{ marginBottom: 10 }}>{mine.some(p => s(p)) ? 'Team Leaders' : 'Top Players'}</div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(6, minmax(0,1fr))' }}>{cats.map(([k, p, f]) => p && (
        <div key={k} className="li" style={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: 0 }} onClick={() => app.go({ id: 'player', pid: p.id })}>
          <div className="row" style={{ gap: 8 }}><Face p={p} size={46} /><div className="num" style={{ fontSize: 26 }}>{f === 'ovr' ? p.ovr : (s(p)?.[f as 'py'] ?? 0)}</div></div>
          <div className="up">{k}</div><b>{p.fn[0]}. {p.ln}</b>
        </div>
      ))}</div>
    </div>
  );
}
function TodoList({ L, roster }: { L: League; roster: Player[] }) {
  const items: [string, () => void, boolean?][] = [];
  const unread = L.inbox.filter(m => !m.read).length;
  if (unread) items.push([`${unread} unread message${unread > 1 ? 's' : ''}`, () => app.go({ id: 'inbox' })]);
  if (roster.length > 53) items.push([`Cut ${roster.length - 53} to reach 53`, () => app.go({ id: 'roster' }), true]);
  if (capSpace(L, L.user) < 0) items.push(['Over the salary cap', () => app.go({ id: 'cap' }), true]);
  if (L.coachTree.points > 0) items.push([`Spend ${L.coachTree.points} coach point(s)`, () => app.go({ id: 'coach' })]);
  if (L.phase === 'resign') items.push([`${Object.values(L.players).filter(p => p.team === L.user && yearsLeft(p.contract, L.season) === 0).length} expiring contracts`, () => app.go({ id: 'resign' }), true]);
  if (L.phase === 'freeagency') items.push(['Free agency is open', () => app.go({ id: 'fa' })]);
  if (L.phase === 'draft') items.push(['You are on the draft clock soon', () => app.go({ id: 'draft' }), true]);
  if (L.phase === 'regular' || L.phase === 'preseason') items.push(['Set the weekly game plan', () => app.go({ id: 'plan' })]);
  if (L.inbox.some(m => m.action?.kind === 'trade')) items.push(['Trade offers waiting', () => app.go({ id: 'offers' }), true]);
  if (L.scoutPoints >= 25 && L.phase !== 'draft') items.push([`Scout the next class (${L.scoutPoints} pts)`, () => app.go({ id: 'scouting' })]);
  return <div className="list">{items.slice(0, 6).map(([t, f, hot]) => <div key={t} className="li" onClick={f}><span style={{ width: 8, height: 8, background: hot ? 'var(--bad)' : 'var(--team2)', transform: 'rotate(45deg)' }} /><span style={{ flex: 1, fontWeight: 600 }}>{t}</span><span className="mute">›</span></div>)}{!items.length && <div className="empty">All caught up.</div>}</div>;
}
function WeekScores({ L }: { L: League }) {
  const games = weekGames(L, L.phase === 'regular' || L.phase === 'playoffs' ? L.week : 0);
  const prev = L.phase === 'regular' && L.week > 1 ? weekGames(L, L.week - 1) : [];
  const show = games.some(g => g.result) ? games : prev;
  if (!show.length) return null;
  return (
    <div className="card" style={{ gridColumn: 'span 12' }}>
      <h3>Around the League · {show[0].week > 18 ? 'Playoffs' : `Week ${show[0].week}`}<span className="more" onClick={() => app.go({ id: 'schedule' })}>Schedule</span></h3>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 8 }}>
        {show.map(g => (
          <div key={g.id} className="li" style={{ flexDirection: 'column', alignItems: 'stretch', background: 'var(--panel2)', borderBottom: 0 }} onClick={() => g.result && app.go({ id: 'box', gid: g.id })}>
            {[g.away, g.home].map((a, i) => { const sc = g.result ? (i ? g.result.hs : g.result.as) : undefined; const win = g.result && sc! > (i ? g.result.as : g.result.hs); return <div key={a} className="row" style={{ gap: 8, opacity: g.result && !win ? 0.55 : 1 }}><Logo team={L.teams[a]} size={22} /><b style={{ flex: 1, fontFamily: 'var(--head)', fontSize: 16, textTransform: 'uppercase' }}>{L.teams[a].nick}</b><span className="num" style={{ fontSize: 18 }}>{sc ?? ''}</span></div>; })}
            <div className="small mute">{g.result ? `Final${g.result.ot ? '/OT' : ''}` : `${g.day ?? ''} ${g.time ?? ''}`}</div>
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
